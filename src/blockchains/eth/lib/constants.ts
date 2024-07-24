import { getLazyBoolEnvVariable, getIntEnvVariable } from '../../../lib/utils';

export const BURN_ADDRESS = 'burn';
export const ETH_WITHDRAWAL = 'withdrawal';
export const LONDON_FORK_BLOCK = 12965000;
export const SHANGHAI_FORK_BLOCK = 17034871;
export const IS_ETH = getLazyBoolEnvVariable('IS_ETH');
export const CONFIRMATIONS = getIntEnvVariable('CONFIRMATIONS', 3);
export const BLOCK_INTERVAL = getIntEnvVariable('BLOCK_INTERVAL', 100);
export const RECEIPTS_API_METHOD = process.env.RECEIPTS_API_METHOD || 'eth_getBlockReceipts';
export const NODE_URL = process.env.NODE_URL || 'http://localhost:8545/';
export const LOOP_INTERVAL_CURRENT_MODE_SEC = getIntEnvVariable('LOOP_INTERVAL_CURRENT_MODE_SEC', 30);
export const NATIVE_TOKEN_MODE = 'native_token_transfers';
export const RECEIPTS_MODE = 'receipts';


