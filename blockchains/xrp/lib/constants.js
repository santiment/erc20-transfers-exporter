// Although we request the last 'validated' block we are seeing blocks which are neither validated nor even closed.
// We introduce this extra delay to prevent this.
// In terms of time, 20 blocks is a delay between 1 and 2 minutes.
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || '20');
const SEND_BATCH_SIZE = parseInt(process.env.SEND_BATCH_SIZE || '30');
const DEFAULT_WS_TIMEOUT = parseInt(process.env.DEFAULT_WS_TIMEOUT || '10000');
const CONNECTIONS_COUNT = parseInt(process.env.CONNECTIONS_COUNT || '1');
const MAX_CONNECTION_CONCURRENCY = parseInt(process.env.MAX_CONNECTION_CONCURRENCY || '10');
const XRP_NODE_URLS = process.env.XRP_NODE_URLS || 'wss://s2.ripple.com';
const EXPORT_TIMEOUT_MLS = parseInt(process.env.EXPORT_TIMEOUT_MLS || 1000 * 60 * 5);
const LOOP_INTERVAL_CURRENT_MODE_SEC = parseInt(process.env.LOOP_INTERVAL_CURRENT_MODE_SEC || '30');
const XRP_ENDPOINT_RETRIES = parseInt(process.env.XRP_ENDPOINT_RETIRES || '100');
const REQUEST_RATE_INTERVAL_MSEC = parseInt(process.env.REQUEST_RATE_INTERVAL_MSEC || '0');
const REQUEST_RATE_INTERVAL_CAP = parseInt(process.env.REQUEST_RATE_INTERVAL_CAP || '0');

module.exports = {
  SEND_BATCH_SIZE,
  DEFAULT_WS_TIMEOUT,
  CONNECTIONS_COUNT,
  MAX_CONNECTION_CONCURRENCY,
  XRP_NODE_URLS,
  EXPORT_TIMEOUT_MLS,
  CONFIRMATIONS,
  LOOP_INTERVAL_CURRENT_MODE_SEC,
  XRP_ENDPOINT_RETRIES,
  REQUEST_RATE_INTERVAL_MSEC,
  REQUEST_RATE_INTERVAL_CAP
};
