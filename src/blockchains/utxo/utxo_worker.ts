'use strict';
import { logger } from '../../lib/logger';
import { constructRPCClient } from '../../lib/http_client';
import { BaseWorker, WorkResult, WorkResultMultiMode } from '../../lib/worker_base';
import { KafkaStorage } from '../../lib/kafka_storage';
import { HTTPClientInterface } from '../../types';


export class UTXOWorker extends BaseWorker {
  private readonly NODE_URL: string;
  private readonly MAX_RETRIES: number;
  private readonly RPC_USERNAME: string;
  private readonly RPC_PASSWORD: string;
  private readonly CONFIRMATIONS: number;
  private readonly DEFAULT_TIMEOUT: number;
  private readonly MAX_CONCURRENT_REQUESTS: number;
  private readonly LOOP_INTERVAL_CURRENT_MODE_SEC: number;
  private client: HTTPClientInterface;

  constructor(settings: any) {
    super(settings);

    this.NODE_URL = settings.NODE_URL;
    this.MAX_RETRIES = settings.MAX_RETRIES;
    this.RPC_PASSWORD = settings.RPC_PASSWORD;
    this.RPC_USERNAME = settings.RPC_USERNAME;
    this.CONFIRMATIONS = settings.CONFIRMATIONS;
    this.DEFAULT_TIMEOUT = settings.DEFAULT_TIMEOUT;
    this.MAX_CONCURRENT_REQUESTS = settings.MAX_CONCURRENT_REQUESTS;
    this.LOOP_INTERVAL_CURRENT_MODE_SEC = settings.LOOP_INTERVAL_CURRENT_MODE_SEC;

    logger.info(`Connecting to the node ${this.NODE_URL}`);
    this.client = constructRPCClient(this.NODE_URL, this.RPC_USERNAME, this.RPC_PASSWORD, this.DEFAULT_TIMEOUT);
  }

  async init(storage: KafkaStorage | Map<string, KafkaStorage>) {
    const blockchainInfo = await this.sendRequestWithRetry('getblockchaininfo', []);
    this.lastConfirmedBlock = blockchainInfo.blocks - this.CONFIRMATIONS;
    if (!(storage instanceof KafkaStorage)) {
      throw Error('Single Kafka storage needs to be provided for UTXO exporter')
    }
    await storage.initPartitioner((event: any) => event['height']);
  }

  async sendRequest(method: string, params: any) {
    return this.client.request(method, params).then(({ result, error }) => {
      if (error) {
        return Promise.reject(error);
      }

      return result;
    });
  }

  async sendRequestWithRetry(method: string, params: object) {
    let retries = 0;
    let retryIntervalMs = 0;
    while (retries < this.MAX_RETRIES) {
      try {
        const response = await this.sendRequest(method, params).catch(err => Promise.reject(err));
        if (response.error || response.result === null) {
          retries++;
          retryIntervalMs += (2000 * retries);
          logger.error(`sendRequest with ${method} failed. Reason: ${response.error}. Retrying for ${retries} time`);
          await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
          continue;
        }
        return response;
      } catch (err: any) {
        retries++;
        retryIntervalMs += (2000 * retries);
        logger.error(
          `Try block in sendRequest for ${method} failed. Reason: ${err.toString()}. Waiting ${retryIntervalMs} and retrying for ${retries} time`
        );
        await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
      }
    }
    return Promise.reject(`sendRequest for ${method} failed after ${this.MAX_RETRIES} retries`);
  }

  async fetchBlock(block_index: number) {
    const blockHash = await this.sendRequestWithRetry('getblockhash', [block_index]);
    return await this.sendRequestWithRetry('getblock', [blockHash, 2]);
  }

  async work(): Promise<WorkResult | WorkResultMultiMode> {
    if (this.lastConfirmedBlock === this.lastExportedBlock) {
      this.sleepTimeMsec = this.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;

      const blockchainInfo = await this.sendRequestWithRetry('getblockchaininfo', []);
      const newConfirmedBlock = blockchainInfo.blocks - this.CONFIRMATIONS;
      if (newConfirmedBlock === this.lastConfirmedBlock) {
        return [];
      }
      this.lastConfirmedBlock = newConfirmedBlock;
    }
    else {
      this.sleepTimeMsec = 0;
    }

    const numConcurrentRequests = Math.min(this.MAX_CONCURRENT_REQUESTS, this.lastConfirmedBlock - this.lastExportedBlock);
    const requests = Array.from({ length: numConcurrentRequests }, (_, i) => this.fetchBlock(this.lastExportedBlock + 1 + i));
    const blocks = await Promise.all(requests);
    this.lastExportedBlock += blocks.length;
    return blocks;
  }
}

