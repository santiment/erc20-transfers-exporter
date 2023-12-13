const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || '3');
const LOOP_INTERVAL_CURRENT_MODE_SEC = parseInt(process.env.LOOP_INTERVAL_CURRENT_MODE_SEC || '30');
const NODE_REQUEST_RETRY = parseInt(process.env.NODE_REQUEST_RETRY || '5');

module.exports = {
    CONFIRMATIONS,
    LOOP_INTERVAL_CURRENT_MODE_SEC,
    NODE_REQUEST_RETRY
};
