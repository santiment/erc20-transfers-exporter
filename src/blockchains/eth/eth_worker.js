const { Web3 } = require('web3');
const { filterErrors } = require('./lib/filter_errors');
const { logger } = require('../../lib/logger');
const { constructRPCClient } = require('../../lib/http_client');
const { injectDAOHackTransfers, DAO_HACK_FORK_BLOCK } = require('./lib/dao_hack');
const { getGenesisTransfers } = require('./lib/genesis_transfers');
const { transactionOrder, stableSort } = require('./lib/util');
const BaseWorker = require('../../lib/worker_base');
const Web3Wrapper = require('./lib/web3_wrapper');
const { decodeTransferTrace } = require('./lib/decode_transfers');
const { FeesDecoder } = require('./lib/fees_decoder');
const { nextIntervalCalculator, analyzeWorkerContext, setWorkerSleepTime, NO_WORK_SLEEP } = require('./lib/next_interval_calculator');
const { WithdrawalsDecoder } = require('./lib/withdrawals_decoder');

class ETHWorker extends BaseWorker {
  constructor(settings) {
    super(settings);

    logger.info(`Connecting to Ethereum node ${settings.NODE_URL}`);
    logger.info(`Applying the following settings: ${JSON.stringify(settings)}`);
    this.web3Wrapper = new Web3Wrapper(new Web3(new Web3.providers.HttpProvider(settings.NODE_URL)));
    this.ethClient = constructRPCClient(settings.NODE_URL);

    this.feesDecoder = new FeesDecoder(this.web3Wrapper);
    this.withdrawalsDecoder = new WithdrawalsDecoder(this.web3Wrapper);
  }

  parseEthInternalTrx(result) {
    const traces = filterErrors(result);

    return traces
      .filter((trace) =>
        trace['action']['value'] !== '0x0' &&
        trace['action']['balance'] !== '0x0' &&
        !(trace['type'] === 'call' && trace['action']['callType'] !== 'call')
      );
  }

  fetchEthInternalTrx(fromBlock, toBlock) {
    return this.ethClient.request('trace_filter', [{
      fromBlock: this.web3Wrapper.parseNumberToHex(fromBlock),
      toBlock: this.web3Wrapper.parseNumberToHex(toBlock)
    }]).then((data) => this.parseEthInternalTrx(data['result']));
  }

  async fetchBlocks(fromBlock, toBlock) {
    const blockRequests = [];
    for (let i = fromBlock; i <= toBlock; i++) {
      blockRequests.push(
        this.ethClient.request(
          'eth_getBlockByNumber',
          [this.web3Wrapper.parseNumberToHex(i), true],
          undefined,
          false
        )
      );
    }

    const responses = await this.ethClient.request(blockRequests);
    const result = new Map();
    responses.forEach((response, index) => result.set(fromBlock + index, response.result));
    return result;
  }

  async fetchReceipts(fromBlock, toBlock) {
    const batch = [];
    for (let currBlock = fromBlock; currBlock <= toBlock; currBlock++) {
      batch.push(
        this.ethClient.request(
          this.settings.RECEIPTS_API_METHOD,
          [this.web3Wrapper.parseNumberToHex(currBlock)],
          undefined,
          false
        )
      );
    }
    const finishedRequests = await this.ethClient.request(batch);
    const result = {};

    finishedRequests.forEach((response) => {
      if (response.result) {
        response.result.forEach((receipt) => {
          result[receipt.transactionHash] = receipt;
        });
      }
      else {
        throw new Error(JSON.stringify(response));
      }
    });

    return result;
  }

  async fetchData(fromBlock, toBlock) {
    return await Promise.all([
      this.fetchEthInternalTrx(fromBlock, toBlock),
      this.fetchBlocks(fromBlock, toBlock),
      this.fetchReceipts(fromBlock, toBlock),
    ]);
  }

  transformPastEvents(fromBlock, toBlock, traces, blocks, receipts) {
    let events = [];
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

  transformPastTransferEvents(traces, blocksMap) {
    const result = [];

    for (let i = 0; i < traces.length; i++) {
      const block_timestamp = this.web3Wrapper.parseHexToNumber(blocksMap.get(traces[i]['blockNumber']).timestamp);
      result.push(decodeTransferTrace(traces[i], block_timestamp, this.web3Wrapper));
    }

    return result;
  }

  transformPastTransactionEvents(blocks, receipts) {
    const result = [];

    for (const block of blocks) {
      const blockNumber = this.web3Wrapper.parseHexToNumber(block.number);
      const decoded_transactions = this.feesDecoder.getFeesFromTransactionsInBlock(block, blockNumber, receipts);
      if (this.settings.IS_ETH && blockNumber >= this.settings.SHANGHAI_FORK_BLOCK) {
        const blockTimestamp = this.web3Wrapper.parseHexToNumber(block.timestamp);
        decoded_transactions.push(...this.withdrawalsDecoder.getBeaconChainWithdrawals(block.withdrawals, blockNumber, blockTimestamp));
      }
      result.push(...decoded_transactions);
    }

    return result;
  }

  async generateTask(interval) {
    const data = await this.fetchData(interval.fromBlock, interval.toBlock);
    const transformedData = this.transformEvents(interval.fromBlock, interval.toBlock, data);
    transformedData.forEach((data) => this.buffer.push(data));
  }

  async work() {
    const workerContext = await analyzeWorkerContext(this);
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return [];

    const { fromBlock, toBlock } = nextIntervalCalculator(this);
    logger.info(`Fetching transfer events for interval ${fromBlock}:${toBlock}`);
    const [traces, blocks, receipts] = await this.fetchData(fromBlock, toBlock);
    const events = this.transformPastEvents(fromBlock, toBlock, traces, blocks, receipts);

    if (events.length > 0) {
      stableSort(events, transactionOrder);
      for (let i = 0; i < events.length; i++) {
        events[i].primaryKey = this.lastPrimaryKey + i + 1;
      }

      this.lastPrimaryKey += events.length;
    }

    this.lastExportedBlock = toBlock;

    return events;
  }

  async init() {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;
  }
}

module.exports = {
  worker: ETHWorker
};
