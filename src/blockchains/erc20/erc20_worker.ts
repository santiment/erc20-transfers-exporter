'use strict';
import { logger } from '../../lib/logger';
import { KafkaStorage } from '../../lib/kafka_storage';
import { constructRPCClient } from '../../lib/http_client';
import { extendEventsWithPrimaryKey } from './lib/extend_events_key';
import { ContractOverwrite, changeContractAddresses, extractChangedContractAddresses } from './lib/contract_overwrite';
import { stableSort, readJsonFile } from './lib/util';
import { BaseWorker, WorkResult, WorkResultMultiMode } from '../../lib/worker_base';
import { nextIntervalCalculator, setWorkerSleepTime, analyzeWorkerContext, NO_WORK_SLEEP } from '../eth/lib/next_interval_calculator';
import { Web3Interface, constructWeb3Wrapper } from '../eth/lib/web3_wrapper';
import { TimestampsCache } from './lib/timestamps_cache';
import { getPastEvents } from './lib/fetch_events';
import { initBlocksList } from '../../lib/fetch_blocks_list';
import { HTTPClientInterface } from '../../types';
import { ERC20Transfer } from './erc20_types';


/**
 * A simple non cryptographic hash function similar to Java's 'hashCode'
 * @param {string} input A string input
 * @returns {number} A 32 bit positive integer
 */
function simpleHash(input: string): number {
  var hash = 0, i, chr;

  if (input.length === 0) return hash;

  for (i = 0; i < input.length; i++) {
    chr = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export class ERC20Worker extends BaseWorker {
  private web3Wrapper: Web3Interface;
  private ethClient: HTTPClientInterface;
  private getPastEventsFun: (web3Wrapper: Web3Interface, from: number, to: number, allOldContracts: any,
    timestampsCache: any) => any = getPastEvents;
  private contractsOverwriteArray: any;
  private contractsUnmodified: any;
  // This field is heavily tested in unit tests. Most probably we should change this and instead assert only the
  // overall logic, not the state of member variables.
  public blocksList: any;

  private allOldContracts: any;


  constructor(settings: any) {
    super(settings);

    logger.info(`Connecting to Ethereum node ${settings.NODE_URL}`);
    this.web3Wrapper = constructWeb3Wrapper(settings.NODE_URL, settings.RPC_USERNAME, settings.RPC_PASSWORD);
    this.ethClient = constructRPCClient(settings.NODE_URL, settings.RPC_USERNAME, settings.RPC_PASSWORD,
      settings.DEFAULT_TIMEOUT);
    this.contractsOverwriteArray = [];
    this.contractsUnmodified = [];
    this.allOldContracts = [];
  }

  async init(storage: KafkaStorage | Map<string, KafkaStorage>) {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;

    if (this.settings.EXPORT_BLOCKS_LIST) {
      this.blocksList = initBlocksList();
    }

    if (this.settings.CONTRACT_MODE !== 'vanilla') {
      const parsedContracts = await readJsonFile(this.settings.CONTRACT_MAPPING_FILE_PATH);

      if (parsedContracts.modified_contracts) {
        this.contractsOverwriteArray = parsedContracts.modified_contracts.map((contract: any) => new ContractOverwrite(contract));
        this.allOldContracts = this.contractsOverwriteArray.flatMap((obj: any) => obj.oldAddresses);
      }
      if (parsedContracts.unmodified_contracts) {
        this.contractsUnmodified = parsedContracts.unmodified_contracts.map((contract: any) => contract.toLowerCase());
      }

      logger.info(`Running in '${this.settings.CONTRACT_MODE}' contracts mode', ` +
        `${this.contractsOverwriteArray.length + this.contractsUnmodified.length} contracts will be monitored.`);
      logger.info(`Overwritten contracts are: ${JSON.stringify(this.contractsOverwriteArray)}`);
      logger.info(`Extracted unmodified contracts are: ${JSON.stringify(this.contractsUnmodified)}`);
    }

    if (this.settings.EVENTS_IN_SAME_PARTITION) {
      if (!(storage instanceof KafkaStorage)) {
        throw Error('Single Kafka storage needs to be provided for events in same partition')
      }
      await storage.initPartitioner((event: any) => simpleHash(event.contract));
    }
  }

  getBlocksListInterval() {
    if (this.lastExportedBlock === -1 && this.blocksList.length > 0) {
      return {
        success: true,
        fromBlock: this.blocksList[0][0],
        toBlock: this.blocksList[0][1]
      };
    }
    while (this.blocksList.length > 0 && this.lastExportedBlock >= this.blocksList[0][1]) {
      this.blocksList.shift();
    }
    if (this.blocksList.length === 0) {
      return { success: false };
    }
    return {
      success: true,
      fromBlock: this.blocksList[0][0],
      toBlock: this.blocksList[0][1]
    };
  }

  async work(): Promise<WorkResult | WorkResultMultiMode> {
    const workerContext = await analyzeWorkerContext(this);
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return [];

    const interval = this.settings.EXPORT_BLOCKS_LIST ?
      this.getBlocksListInterval() :
      nextIntervalCalculator(this);

    logger.info(`Fetching transfer events for interval ${interval.fromBlock}:${interval.toBlock}`);

    let events = [];
    let overwritten_events: any = [];
    const timestampsCache = new TimestampsCache(this.ethClient, this.web3Wrapper, interval.fromBlock, interval.toBlock);
    if ('extract_exact_overwrite' === this.settings.CONTRACT_MODE) {
      if (this.allOldContracts.length > 0) {
        events = await this.getPastEventsFun(this.web3Wrapper, interval.fromBlock, interval.toBlock, this.allOldContracts, timestampsCache);
        changeContractAddresses(events, this.contractsOverwriteArray);
      }

      if (this.contractsUnmodified.length > 0) {
        const rawEvents = await this.getPastEventsFun(this.web3Wrapper, interval.fromBlock, interval.toBlock, this.contractsUnmodified,
          timestampsCache);

        for (const event of rawEvents) {
          events.push(event);
        }
      }
    }
    else {
      events = await this.getPastEventsFun(this.web3Wrapper, interval.fromBlock, interval.toBlock, null, timestampsCache);
      if ('extract_all_append' === this.settings.CONTRACT_MODE) {
        overwritten_events = extractChangedContractAddresses(events, this.contractsOverwriteArray);
      }
    }

    if (events.length > 0) {
      extendEventsWithPrimaryKey(events, overwritten_events);
      logger.info(`Setting primary keys ${events.length} messages for blocks ${interval.fromBlock}:${interval.toBlock}`);
      this.lastPrimaryKey = events[events.length - 1].primaryKey;
    }

    this.lastExportedBlock = interval.toBlock;
    const resultEvents = events.concat(overwritten_events);

    // If overwritten events have been generated, they need to be merged into the original events
    if (overwritten_events.length > 0) {
      stableSort(resultEvents, function primaryKeyOrder(a: ERC20Transfer, b: ERC20Transfer) {
        if (typeof a.primaryKey !== 'number' || typeof b.primaryKey !== 'number') {
          throw Error('Primary keys should be set to number before event')
        }
        return a.primaryKey - b.primaryKey;
      });
    }

    return resultEvents;
  }
}

