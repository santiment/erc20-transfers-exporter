import { logger } from '../../lib/logger';
import { BaseWorker } from '../../lib/worker_base';
import { ICPBlock, Transaction, ExtendedTransaction } from './lib/icp_types';
import fetch from 'node-fetch';
import assert from 'assert';
import { transactionOrder, stableSort } from './lib/util';
import BigNumber from 'bignumber.js';

export class ICPWorker extends BaseWorker {
  private readonly NODE_URL: string;
  private readonly RPC_USERNAME: string;
  private readonly RPC_PASSWORD: string;
  private readonly CONFIRMATIONS: number;
  private readonly MAX_CONCURRENT_REQUESTS: number;
  private readonly LOOP_INTERVAL_CURRENT_MODE_SEC: number;
  private readonly BURN_ADDRESS: string;
  private readonly AUTH: string;

  constructor(settings: any) {
    super(settings);

    this.NODE_URL = settings.NODE_URL;
    this.RPC_PASSWORD = settings.RPC_PASSWORD;
    this.RPC_USERNAME = settings.RPC_USERNAME;
    this.CONFIRMATIONS = settings.CONFIRMATIONS;
    this.MAX_CONCURRENT_REQUESTS = settings.MAX_CONCURRENT_REQUESTS;
    this.LOOP_INTERVAL_CURRENT_MODE_SEC = settings.LOOP_INTERVAL_CURRENT_MODE_SEC;
    this.BURN_ADDRESS = settings.BURN_ADDRESS;
    this.AUTH = Buffer.from(`${this.RPC_USERNAME}:${this.RPC_PASSWORD}`).toString('base64');
  }

  async init() {
    this.lastConfirmedBlock = await this.getBlockNumber() - this.CONFIRMATIONS;
  }

  async getBlockNumber(retries = 3, retryDelay = 1000): Promise<number> {
    const fetchWithRetry = async (attempt: number): Promise<number> => {
      try {
        const response = await fetch(this.NODE_URL + '/network/status', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${this.AUTH}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            network_identifier: {
              blockchain: 'Internet Computer',
              network: '00000000000000020101',
            },
            metadata: {},
          }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch block number: ${response.statusText}`);
      }
      const data = await response.json();
      const blockIndex: number = data.current_block_identifier?.index;

      return blockIndex;
      } catch (error) {
        if (attempt < retries) {
          logger.info(`Attempt ${attempt + 1} failed. Retrying in ${retryDelay}ms...`);
          await new Promise(res => setTimeout(res, retryDelay));
          return fetchWithRetry(attempt + 1);
        } else {
          if (error instanceof Error) {
            throw new Error(`Failed to fetch block number after ${retries} retries: ${error.message}`);
          } else {
            throw new Error(`Failed to fetch block number after ${retries} retries: Unknown error`);
          }
        }
      }
    };
    return fetchWithRetry(0)
  }

  async fetchBlock(block_index: number, retries = 3, retryDelay = 1000): Promise<ICPBlock> {
    const fetchWithRetry = async (attempt: number): Promise<ICPBlock> => {
      try {
        const response = await fetch(this.NODE_URL + '/block', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${this.AUTH}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            network_identifier: {
              blockchain: 'Internet Computer',
              network: '00000000000000020101',
            },
            block_identifier: {
              index: block_index,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch block: ${response.statusText}`);
        }

        const data = await response.json();
        let block: ICPBlock = data.block;
        return block;
      } catch (error) {
        if (attempt < retries) {
          logger.info(`Attempt ${attempt + 1} failed. Retrying in ${retryDelay}ms...`);
          await new Promise(res => setTimeout(res, retryDelay));
          return fetchWithRetry(attempt + 1);
        } else {
          if (error instanceof Error) {
            throw new Error(`Failed to fetch block after ${retries} retries: ${error.message}`);
          } else {
            throw new Error(`Failed to fetch block after ${retries} retries: Unknown error`);
          }
        }
      }
    };

    return fetchWithRetry(0); // Start with the first attempt
}

  async getTransactions(blocks: ICPBlock[]) {
    const transactions: Transaction[] = [];

    for (const block of blocks) {
      const blockNumber = block.block_identifier.index;
      for (const tx of block.transactions) {
        const txHash = tx.transaction_identifier.hash;
        const timestamp = tx.metadata.timestamp;
        let from, to, valueFrom, valueTo, operationIndexFrom, operationIndexTo, symbolFrom, symbolTo;
        assert (tx.operations.length >= 1 && tx.operations.length <= 3);
        for (const operation of tx.operations) {
          if (operation.type === 'FEE') {
            const transactionJson: Transaction = {
              timestamp: BigNumber(timestamp).div(1000000000).toFixed(0).toString(), // nanoseconds to seconds
              blockNumber: blockNumber,
              transactionHash: txHash,
              from: operation.account.address,
              to: this.BURN_ADDRESS,
              value: operation.amount.value.replace(/-/g, ''),
              symbol: operation.amount.currency.symbol,
              type: operation.type,
            };
            transactions.push(transactionJson);
          }
          else if (operation.type === 'MINT') {
            const transactionJson: Transaction = {
              timestamp: BigNumber(timestamp).div(1000000000).toFixed(0).toString(), // nanoseconds to seconds
              blockNumber: blockNumber,
              transactionHash: txHash,
              from: 'mint',
              to:  operation.account.address,
              value: operation.amount.value,
              symbol: operation.amount.currency.symbol,
              type: operation.type,
            };
            transactions.push(transactionJson);
          }
          else if (operation.type === 'APPROVE') {
            const transactionJson: Transaction = {
              timestamp: BigNumber(timestamp).div(1000000000).toFixed(0).toString(), // nanoseconds to seconds
              blockNumber: blockNumber,
              transactionHash: txHash,
              from: operation.account.address,
              to:  operation.metadata.spender,
              value: operation.metadata.allowance.e8s,
              symbol: 'ICP',
              type: operation.type,
            };
            transactions.push(transactionJson);
          }
          else if (operation.type === 'TRANSACTION' && operation.amount.value.includes("-")) {
            from = operation.account.address;
            valueFrom = operation.amount.value.replace(/-/g, '');
            symbolFrom = operation.amount.currency.symbol;
            operationIndexFrom = operation.operation_identifier.index;
          }
          else if (operation.type === 'TRANSACTION' && !operation.amount.value.includes("-")) {
            to = operation.account.address;
            valueTo = operation.amount.value;
            symbolTo = operation.amount.currency.symbol; 
            operationIndexTo = operation.operation_identifier.index;
          }
          if (operation.type === 'TRANSACTION' && from && to && valueTo && symbolTo && valueFrom === valueTo && (Number(operationIndexFrom) + 1 === Number(operationIndexTo) || Number(operationIndexFrom) === Number(operationIndexTo) + 1)) {
            const transactionJson: Transaction = {
              timestamp: BigNumber(timestamp).div(1000000000).toFixed(0).toString(), // nanoseconds to seconds
              blockNumber: blockNumber,
              transactionHash: txHash,
              from: from,
              to: to,
              value: valueTo,
              symbol: symbolTo,
              type: operation.type,
            };
            transactions.push(transactionJson);            
          }
        }
      }
    }
    return transactions;
  }

  async work() {
    if (this.lastConfirmedBlock === this.lastExportedBlock) {
      this.sleepTimeMsec = this.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;
      const newConfirmedBlock = await this.getBlockNumber() - this.CONFIRMATIONS;
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

    let transactions: (Transaction)[] = await this.getTransactions(blocks);
    let extendedTransactions: (ExtendedTransaction)[] = [];
    if (transactions.length > 0) {
      stableSort(transactions, transactionOrder);
      extendedTransactions = extendTransactionsWithPrimaryKey(transactions, this.lastPrimaryKey);

      this.lastPrimaryKey += transactions.length;
    }

    this.lastExportedBlock += blocks.length;
    return extendedTransactions;
  }
}

export function extendTransactionsWithPrimaryKey(transactions: Transaction[], lastPrimaryKey: number): ExtendedTransaction[] {
  return transactions.map((transaction, index) => ({
    ...transaction,
    primaryKey: lastPrimaryKey + index + 1, // Example logic to set primaryKey
    transactionPosition: 0,
    valueExactBase36: BigNumber(transaction.value).toString(36)
  }));
}