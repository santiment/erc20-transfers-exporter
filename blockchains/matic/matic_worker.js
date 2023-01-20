const Web3 = require('web3');
const jayson = require('jayson/promise');
const constants = require('./lib/constants');
const { logger } = require('../../lib/logger');
const BaseWorker = require('../../lib/worker_base');
const Web3Wrapper = require('../eth/lib/web3_wrapper');
const { extendEventsWithPrimaryKey } = require('../erc20/lib/extend_events_key');
const { getPastEvents } = require('./lib/fetch_events');
const { setGlobalTimestampManager } = require('../erc20/lib/fetch_events');
const { nextIntervalCalculator } = require('../eth/lib/next_interval_calculator');


class MaticWorker extends BaseWorker {
  constructor() {
    super();

    logger.info(`Connecting to Polygon node ${constants.NODE_URL}`);
    this.web3 = new Web3(new Web3.providers.HttpProvider(constants.NODE_URL));
    this.web3Wrapper = new Web3Wrapper(this.web3);
    this.ethClient = jayson.client.https(constants.NODE_URL);
  }

  async work() {
    const result = await nextIntervalCalculator(this);
    if (!result.success) {
      return [];
    }

    logger.info(`Fetching transfer events for interval ${result.fromBlock}:${result.toBlock}`);

    const events = await getPastEvents(this.web3, result.fromBlock, result.toBlock);

    if (events.length > 0) {
      extendEventsWithPrimaryKey(events);
      logger.info(`Setting primary keys ${events.length} messages for blocks ${this.fromBlock}:${result.toBlock}`);
      this.lastPrimaryKey = events[events.length - 1].primaryKey;
    }

    this.lastExportTime = Date.now();
    this.lastExportedBlock = result.toBlock;
    return events;

  }

  async init(exporter) {
    this.lastConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;
    setGlobalTimestampManager(exporter);
  }
}

module.exports = {
  worker: MaticWorker
};
