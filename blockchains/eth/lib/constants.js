const BURN_ADDRESS = 'burn';
const ETH_WITHDRAWAL = 'withdrawal';
const LONDON_FORK_BLOCK = 12965000;
const SHANGHAI_FORK_BLOCK = 17034871;
const THE_MERGE = 15537393;
const IS_ETH = parseInt(process.env.IS_ETH || '1');
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || '3');
const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || '100');
const RECEIPTS_API_METHOD = process.env.RECEIPTS_API_METHOD || 'eth_getBlockReceipts';
const NODE_URL = process.env.NODE_URL || process.env.PARITY_URL || 'http://localhost:8545/';
const LOOP_INTERVAL_CURRENT_MODE_SEC = parseInt(process.env.LOOP_INTERVAL_CURRENT_MODE_SEC || '30');

module.exports = {
    BLOCK_INTERVAL,
    CONFIRMATIONS,
    NODE_URL,
    LOOP_INTERVAL_CURRENT_MODE_SEC,
    BURN_ADDRESS,
    ETH_WITHDRAWAL,
    IS_ETH,
    LONDON_FORK_BLOCK,
    SHANGHAI_FORK_BLOCK,
    THE_MERGE,
    RECEIPTS_API_METHOD
};
