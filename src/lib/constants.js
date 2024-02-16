const BLOCKCHAIN = process.env.BLOCKCHAIN;
const CONFIG_PATH = process.env.CONFIG_PATH;
const START_BLOCK = parseInt(process.env.START_BLOCK || '0') - 1;
const EXPORT_BLOCKS_LIST = process.env.EXPORT_BLOCKS_LIST || false;
const PQUEUE_MAX_SIZE = parseInt(process.env.PQUEUE_MAX_SIZE || '100');
const MAX_TASK_DATA_KEYS = parseInt(process.env.PQUEUE_MAX_SIZE || '10');
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '1');
const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || '50');
const START_PRIMARY_KEY = parseInt(process.env.START_PRIMARY_KEY || '-1');
const WRITE_SIGNAL_RECORDS_KAFKA = process.env.WRITE_SIGNAL_RECORDS_KAFKA || false;
const EXPORT_TIMEOUT_MLS = parseInt(process.env.EXPORT_TIMEOUT_MLS) || 1000 * 60 * 5; // 5 minutes
const EXPORT_BLOCKS_LIST_MAX_INTERVAL = parseInt(process.env.EXPORT_BLOCKS_LIST_MAX_INTERVAL) || 50;

module.exports = {
  BLOCKCHAIN,
  CONFIG_PATH,
  START_BLOCK,
  BLOCK_INTERVAL,
  PQUEUE_MAX_SIZE,
  START_PRIMARY_KEY,
  EXPORT_BLOCKS_LIST,
  MAX_TASK_DATA_KEYS,
  EXPORT_TIMEOUT_MLS,
  MAX_CONCURRENT_REQUESTS,
  WRITE_SIGNAL_RECORDS_KAFKA,
  EXPORT_BLOCKS_LIST_MAX_INTERVAL
};
