import { logger } from '../../lib/logger';
import { BaseWorker } from '../../lib/worker_base';
import { ICRCBlock, Transaction, ExtendedTransaction, TransferPart } from './lib/icrc_types';
import fetch from 'node-fetch';
import assert from 'assert';
import { transactionOrder, stableSort } from './lib/util';
import BigNumber from 'bignumber.js';

export class ICRCWorker extends BaseWorker {
  private readonly NODE_URL: string;

  private readonly RPC_USERNAME: string;
  private readonly RPC_PASSWORD: string;
  private readonly CONFIRMATIONS: number;
  private readonly MAX_CONCURRENT_REQUESTS: number;
  private readonly CANISTER: string;

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
    this.CANISTER = settings.CANISTER;
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
              network: `${this.CANISTER}`,
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

  async fetchBlock(block_index: number, retries = 3, retryDelay = 1000): Promise<ICRCBlock> {
    const fetchWithRetry = async (attempt: number): Promise<ICRCBlock> => {
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
              network: `${this.CANISTER}`,
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
        let block: ICRCBlock = data.block;
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

  async getTransactions(blocks: ICRCBlock[]) {
    const transactions: Transaction[] = [];

    for (const block of blocks) {
      const blockNumber = block.block_identifier.index;
      const timestamp = BigNumber(block.timestamp).div(1000).toFixed(0).toString();
      let transactionsInBlock = transactions.length;
      for (const tx of block.transactions) {
        const txHash = tx.transaction_identifier.hash;
        //let from, to, index, valueFrom, valueTo, operationIndexFrom, operationIndexTo, symbolFrom, symbolTo;
        assert (tx.operations.length >= 1 && tx.operations.length <= 4);
        let isZeroTransfer = false;
        let toTransferOperations: TransferPart[] = [];
        let fromTransferOperations : TransferPart[] = [];
        for (const operation of tx.operations) {
          if (operation.type === 'FEE') {
            const transactionJson: Transaction = {
              timestamp: timestamp,
              blockNumber: blockNumber,
              transactionHash: txHash,
              from: operation.account.address + '/' + operation.account.sub_account.address,
              to: this.BURN_ADDRESS,
              value: operation.amount.value.replace(/-/g, ''),
              symbol: operation.amount.currency.symbol,
              type: operation.type,
            };
            transactions.push(transactionJson);
          }
          if (operation.type === 'BURN') {
            const transactionJson: Transaction = {
              timestamp: timestamp,
              blockNumber: blockNumber,
              transactionHash: txHash,
              from: operation.account.address + '/' + operation.account.sub_account.address,
              to: this.BURN_ADDRESS,
              value: operation.amount.value.replace(/-/g, ''),
              symbol: operation.amount.currency.symbol,
              type: operation.type,
            };
            transactions.push(transactionJson);
          }
          else if (operation.type === 'MINT') {
            const transactionJson: Transaction = {
              timestamp: timestamp,
              blockNumber: blockNumber,
              transactionHash: txHash,
              from: 'mint',
              to:  operation.account.address + '/' + operation.account.sub_account.address,
              value: operation.amount.value,
              symbol: operation.amount.currency.symbol,
              type: operation.type,
            };
            transactions.push(transactionJson);
          }
          else if (operation.type === 'FEE_COLLECTOR') {
            const transactionJson: Transaction = {
              timestamp: timestamp,
              blockNumber: blockNumber,
              transactionHash: txHash,
              from: 'mint',
              to:  operation.account.address + '/' + operation.account.sub_account.address,
              value: operation.amount.value,
              symbol: operation.amount.currency.symbol,
              type: operation.type,
            };
            transactions.push(transactionJson);
          }
          else if (operation.type === 'APPROVE') {
            const transactionJson: Transaction = {
              timestamp: timestamp,
              blockNumber: blockNumber,
              transactionHash: txHash,
              from: operation.account.address + '/' + operation.account.sub_account.address,
              to:  operation.account.address,
              value: operation.metadata.allowance.value,
              symbol: operation.metadata.allowance.currency.symbol,
              type: operation.type,
            };
            transactions.push(transactionJson);
          }
          else if (operation.type === 'TRANSFER' && (operation.amount.value.includes("-") || operation.amount.value === "0") && !isZeroTransfer) {
            const fromOperation: TransferPart = {
              address: operation.account.address + '/' + operation.account.sub_account.address,
              value: operation.amount.value.replace(/-/g, ''),
              symbol: operation.amount.currency.symbol,
              operationIndex: operation.operation_identifier.index
            }
            isZeroTransfer = true;
            fromTransferOperations.push(fromOperation);
          }
          else if (operation.type === 'TRANSFER' && !operation.amount.value.includes("-")) {
            const toOperation: TransferPart = {
              address: operation.account.address + '/' + operation.account.sub_account.address,
              value: operation.amount.value,
              symbol: operation.amount.currency.symbol,
              operationIndex: operation.operation_identifier.index
            }
            toTransferOperations.push(toOperation);
          }
          
          if (operation.type !== 'TRANSFER' && operation.type !== 'APPROVE' && operation.type !== 'MINT' && operation.type !== 'FEE' && operation.type !== 'BURN' && operation.type !== 'FEE_COLLECTOR' && operation.type !== 'SPENDER'){
            console.log(operation.type);
            console.log(operation);
            console.log(block);
            assert(operation.type === 'TRANSFER' || operation.type === 'APPROVE' || operation.type === 'MINT' || operation.type === 'FEE' || operation.type === 'BURN' || operation.type === 'FEE_COLLECTOR');
          }
        }
        assert (fromTransferOperations.length === toTransferOperations.length);

        let cnt = 0;
        for (const fromOperation of fromTransferOperations) {
          for (const toOperation of toTransferOperations) {
            if (fromOperation.value === toOperation.value && fromOperation.symbol === toOperation.symbol && (Number(fromOperation.operationIndex) + 1 === Number(toOperation.operationIndex) || Number(fromOperation.operationIndex) === Number(toOperation.operationIndex) + 1)) {
              const transactionJson: Transaction = {
                timestamp: timestamp,
                blockNumber: blockNumber,
                transactionHash: txHash,
                from: fromOperation.address,
                to: toOperation.address,
                value: fromOperation.value,
                symbol: fromOperation.symbol,
                type: 'TRANSFER',
              };
              transactions.push(transactionJson);
              cnt += 1;
            }
          }
        }
        assert (fromTransferOperations.length === cnt);
      }
      transactionsInBlock =  transactions.length - transactionsInBlock;
      if(transactionsInBlock > 3) {
        console.log(transactionsInBlock);
        console.log(block);
      }
      assert(transactionsInBlock <= 3);
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
    //console.log(transactions.length, this.BLOCK_INTERVAL);
    assert(transactions.length >= 0 && transactions.length <= 100);
    let extendedTransactions: (ExtendedTransaction)[] = [];
    if (transactions.length > 0) {
      stableSort(transactions, transactionOrder);
      extendedTransactions = extendTransactionsWithPrimaryKey(transactions);

      this.lastPrimaryKey += transactions.length;
    }

    this.lastExportedBlock += blocks.length;
    return extendedTransactions;
  }
}

export function extendTransactionsWithPrimaryKey(transactions: Transaction[]): ExtendedTransaction[] {
  return transactions.map((transaction, index) => ({
    ...transaction,
    primaryKey: transaction.blockNumber + index + 1,
    transactionPosition: 0,
    valueExactBase36: BigNumber(transaction.value).toString(36)
  }));
}