import { logger } from '../../lib/logger';
import { constructRPCClient } from '../../lib/http_client';
import { injectDAOHackTransfers, DAO_HACK_FORK_BLOCK } from './lib/dao_hack';
import { getGenesisTransfers } from './lib/genesis_transfers';
import { transactionOrder, stableSort } from './lib/util';
import { BaseWorker, WorkResult, WorkResultMultiMode } from '../../lib/worker_base';
import { Web3Interface, constructWeb3Wrapper, safeCastToNumber } from './lib/web3_wrapper';
import { decodeTransferTrace } from './lib/decode_transfers';
import { FeesDecoder } from './lib/fees_decoder';
import { nextIntervalCalculator, analyzeWorkerContext, setWorkerSleepTime, NO_WORK_SLEEP } from './lib/next_interval_calculator';
import { WithdrawalsDecoder } from './lib/withdrawals_decoder';
import { fetchEthInternalTrx, fetchBlocks, fetchReceipts } from './lib/fetch_data';
import { HTTPClientInterface } from '../../types';
import { Trace, ETHBlock, ETHTransfer, ETHReceipt } from './eth_types';
import { EOB, collectEndOfBlocks } from './lib/end_of_block';
import { assertIsDefined, parseKafkaTopicToObject } from '../../lib/utils';
import { decodeReceipt } from './lib/helper_receipts'

export class ETHWorker extends BaseWorker {
  private web3Wrapper: Web3Interface;
  private ethClient: HTTPClientInterface;
  private feesDecoder: FeesDecoder;
  private withdrawalsDecoder: WithdrawalsDecoder;
  private modes: string[];

  constructor(settings: any) {
    super(settings);

    logger.info(`Connecting to Ethereum node ${settings.NODE_URL}`);
    this.web3Wrapper = constructWeb3Wrapper(settings.NODE_URL, settings.RPC_USERNAME, settings.RPC_PASSWORD);
    this.ethClient = constructRPCClient(settings.NODE_URL, settings.RPC_USERNAME, settings.RPC_PASSWORD,
      settings.DEFAULT_TIMEOUT)

    this.feesDecoder = new FeesDecoder(this.web3Wrapper);
    this.withdrawalsDecoder = new WithdrawalsDecoder(this.web3Wrapper);
    this.modes = [];
  }

  async fetchData(fromBlock: number, toBlock: number): Promise<[Trace[], Map<number, ETHBlock>, ETHReceipt[]]> {
    const traces: Promise<Trace[]> = this.isTracesNeeded() ? fetchEthInternalTrx(this.ethClient, this.web3Wrapper, fromBlock, toBlock) : Promise.resolve([]);
    const blocks: Promise<Map<number, ETHBlock>> = fetchBlocks(this.ethClient, this.web3Wrapper, fromBlock, toBlock, true);
    const receipts: Promise<ETHReceipt[]> = this.isReceiptsNeeded() ? fetchReceipts(this.ethClient, this.web3Wrapper,
      this.settings.RECEIPTS_API_METHOD, fromBlock, toBlock) : Promise.resolve([]);
    return await Promise.all([traces, blocks, receipts]);
  }

  transformPastEvents(fromBlock: number, toBlock: number, traces: Trace[], blocks: any, receipts: ETHReceipt[]): ETHTransfer[] {
    let events: ETHTransfer[] = [];
    if (fromBlock === 0) {
      logger.info('Adding the GENESIS transfers');
      events.push(...getGenesisTransfers(this.web3Wrapper));
    }

    const transformedTransferEvents = this.transformPastTransferEvents(traces, blocks);
    const transformedTransactionEvents = this.transformPastTransactionEvents(blocks.values(), receipts);
    for (let event of transformedTransferEvents) events.push(event);
    for (let event of transformedTransactionEvents) events.push(event);
    if (fromBlock <= DAO_HACK_FORK_BLOCK && DAO_HACK_FORK_BLOCK <= toBlock) {
      logger.info('Adding the DAO hack transfers');
      events = injectDAOHackTransfers(events, this.web3Wrapper);
    }

    return events;
  }

  transformPastTransferEvents(traces: Trace[], blocksMap: Map<number, ETHBlock>): ETHTransfer[] {
    const result: ETHTransfer[] = [];

    for (let i = 0; i < traces.length; i++) {
      const blockNumber = traces[i]['blockNumber'];
      const block = blocksMap.get(blockNumber);
      if (block === undefined) {
        throw Error(`Block ${blockNumber} is not found in block map`)
      }
      const blockTimestamp: number = safeCastToNumber(this.web3Wrapper.parseHexToNumber(block.timestamp));
      result.push(decodeTransferTrace(traces[i], blockTimestamp, this.web3Wrapper));
    }

    return result;
  }

  transformPastTransactionEvents(blocks: ETHBlock[], receipts: ETHReceipt[]): ETHTransfer[] {
    const result: ETHTransfer[] = [];

    for (const block of blocks) {
      const blockNumber = safeCastToNumber(this.web3Wrapper.parseHexToNumber(block.number));
      const decoded_transactions = this.feesDecoder.getFeesFromTransactionsInBlock(block, blockNumber, receipts,
        this.settings.IS_ETH);
      if (block.withdrawals !== undefined) {
        const blockTimestamp = safeCastToNumber(this.web3Wrapper.parseHexToNumber(block.timestamp));
        decoded_transactions.push(...this.withdrawalsDecoder.getBeaconChainWithdrawals(block.withdrawals, blockNumber, blockTimestamp));
      }
      result.push(...decoded_transactions);
    }

    return result;
  }

  isReceiptsNeeded(): boolean {
    return this.modes.includes(this.settings.NATIVE_TOKEN_MODE) || this.modes.includes(this.settings.RECEIPTS_MODE)
  }

  isTracesNeeded(): boolean {
    return this.modes.includes(this.settings.NATIVE_TOKEN_MODE)
  }

  getTransfersOutput(fromBlock: number, toBlock: number, traces: Trace[],
    blocks: Map<number, ETHBlock>, receipts: ETHReceipt[], endOfBlockEvents: EOB[]): WorkResult {
    assertIsDefined(traces, "Traces are needed for native token transfers");
    assertIsDefined(receipts, "Receipts are needed for native token transfers");

    const events: (ETHTransfer | EOB)[] = this.transformPastEvents(fromBlock, toBlock, traces, blocks, receipts);


    events.push(...endOfBlockEvents)
    if (events.length > 0) {
      stableSort(events, transactionOrder);
      extendEventsWithPrimaryKey(events, this.lastPrimaryKey);

      this.lastPrimaryKey += events.length;
    }

    return events;
  }

  getReceiptsOutput(blocks: Map<number, ETHBlock>, receipts: ETHReceipt[]): WorkResult {
    assertIsDefined(receipts, "Receipts are needed for receipts extraction");
    assertIsDefined(blocks, "Blocks are needed for extraction");
    const decodedReceipts = receipts.map((receipt: any) => decodeReceipt(receipt, this.web3Wrapper));
    decodedReceipts.forEach(receipt => {
      const block = blocks.get(receipt.blockNumber)
      assertIsDefined(block, `Block ${receipt.blockNumber} is missing`)
      receipt.timestamp = block.timestamp;
    });
    return decodedReceipts;
  }

  async work(): Promise<WorkResultMultiMode> {
    const result: WorkResultMultiMode = {};
    const workerContext = await analyzeWorkerContext(this);
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return result;

    const { fromBlock, toBlock } = nextIntervalCalculator(this);

    logger.info(`Fetching events for interval ${fromBlock}:${toBlock}`);

    const [traces, blocks, receipts] = await this.fetchData(fromBlock, toBlock);


    this.lastExportedBlock = toBlock;

    assertIsDefined(blocks, "Blocks are needed for extraction");
    // TODO consider if EOB events should also be present in other output topics
    const endOfBlockEvents = collectEndOfBlocks(fromBlock, toBlock, blocks, this.web3Wrapper)
    if (this.modes.includes(this.settings.NATIVE_TOKEN_MODE)) {
      result[this.settings.NATIVE_TOKEN_MODE] = this.getTransfersOutput(fromBlock, toBlock, traces, blocks,
        receipts, endOfBlockEvents);
    }
    if (this.modes.includes(this.settings.RECEIPTS_MODE)) {
      result[this.settings.RECEIPTS_MODE] = this.getReceiptsOutput(blocks, receipts);
    }

    return result;
  }

  async init(): Promise<void> {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;

    if (!this.settings.KAFKA_TOPIC.includes(":")) {
      throw new Error("ETH worker, expects KAFKA_TOPIC in mode:name format")
    }
    else {
      const mapping = parseKafkaTopicToObject(this.settings.KAFKA_TOPIC)
      this.modes = Object.keys(mapping);
    }
  }
}

export function extendEventsWithPrimaryKey<T extends { primaryKey?: number }>(events: T[], lastPrimaryKey: number) {
  for (let i = 0; i < events.length; i++) {
    events[i].primaryKey = lastPrimaryKey + i + 1;
  }
}

