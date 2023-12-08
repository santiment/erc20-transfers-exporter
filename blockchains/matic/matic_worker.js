const { Web3 } = require('web3');
const jayson = require('jayson/promise');
const { logger } = require('../../lib/logger');
const BaseWorker = require('../../lib/worker_base');
const Web3Wrapper = require('../eth/lib/web3_wrapper');
const { extendEventsWithPrimaryKey } = require('../erc20/lib/extend_events_key');
const { getPastEvents } = require('./lib/fetch_events');
const { nextIntervalCalculator } = require('../eth/lib/next_interval_calculator');


class MaticWorker extends BaseWorker {
  constructor(settings) {
    super(settings);

    logger.info(`Connecting to Polygon node ${settings.NODE_URL}`);
    this.web3Wrapper = new Web3Wrapper(new Web3(new Web3.providers.HttpProvider(settings.NODE_URL)));
    if (settings.NODE_URL.substring(0, 5) === 'https') {
      this.ethClient = jayson.client.https(settings.NODE_URL);
    } else {
      this.ethClient = jayson.client.http(settings.NODE_URL);
    }
  }

  async work() {
    const result = await nextIntervalCalculator(this);
    if (!result.success) {
      return [];
    }

    logger.info(`Fetching transfer events for interval ${result.fromBlock}:${result.toBlock}`);

    const events = await getPastEvents(this.web3Wrapper, result.fromBlock, result.toBlock);

    if (events.length > 0) {
      extendEventsWithPrimaryKey(events);
      logger.info(`Setting primary keys ${events.length} messages for blocks ${result.fromBlock}:${result.toBlock}`);
      this.lastPrimaryKey = events[events.length - 1].primaryKey;
    }

    this.lastExportedBlock = result.toBlock;
    return events;

  }

  async init() {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;
  }
}

module.exports = {
  worker: MaticWorker
};
