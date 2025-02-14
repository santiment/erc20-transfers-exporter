const Web3 = require('web3');
const jayson = require('jayson/promise');
const constants = require('./lib/constants');
const { logger } = require('../../lib/logger');
const { transactionOrder, stableSort } = require('../eth/lib/util');
const BaseWorker = require('../../lib/worker_base');
const Web3Wrapper = require('../eth/lib/web3_wrapper');


class TRACEWorker extends BaseWorker {
  constructor() {
    super();

    logger.info(`Connecting to Ethereum node ${constants.NODE_URL}`);
    this.web3 = new Web3(new Web3.providers.HttpProvider(constants.NODE_URL));
    this.web3Wrapper = new Web3Wrapper(this.web3);
    this.ethClient = jayson.client.http(constants.NODE_URL);
  }

  async fetchTraces(fromBlock, toBlock) {
    const blockRequests = [];
    for (let i = fromBlock; i <= toBlock; i++) {
      blockRequests.push(
        this.ethClient.request(
          'trace_block',
          [this.web3Wrapper.parseNumberToHex(i)],
          undefined,
          false
        )
      );
    }
    const responses = await this.ethClient.request(blockRequests);
    const results = responses.map((response) => response['result'])
    const traces = []
    for (const blockTraces of results) {
      for (const trace of blockTraces) {
        traces.push(trace);
      }
    }
    return traces;
  }

  async work() {
    if (this.lastConfirmedBlock === this.lastExportedBlock) {
      // We are up to date with the blockchain (aka 'current mode'). Sleep longer after finishing this loop.
      this.sleepTimeMsec = constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;

      // On the previous cycle we closed the gap to the head of the blockchain.
      // Check if there are new blocks now.
      const newConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;
      if (newConfirmedBlock === this.lastConfirmedBlock) {
        // The Node has not progressed
        return [];
      }
      this.lastConfirmedBlock = newConfirmedBlock;
    }
    else {
      // We are still catching with the blockchain (aka 'historic mode'). Do not sleep after this loop.
      this.sleepTimeMsec = 0;
    }

    const toBlock = Math.min(this.lastExportedBlock + constants.BLOCK_INTERVAL, this.lastConfirmedBlock);
    const fromBlock = this.lastExportedBlock + 1;

    logger.info(`Fetching traces for interval ${fromBlock}:${toBlock}`);
    const traces = await this.fetchTraces(fromBlock, toBlock);

    if (traces.length > 0) {
      stableSort(traces, transactionOrder);
      for (let i = 0; i < traces.length; i++) {
        traces[i].primaryKey = this.lastPrimaryKey + i + 1;
      }

      this.lastPrimaryKey += traces.length;
    }

    this.lastExportTime = Date.now();
    this.lastExportedBlock = toBlock;

    return traces;
  }

  async init() {
    this.lastConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;
  }

}

module.exports = {
  worker: TRACEWorker
};
