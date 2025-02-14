import { getIntEnvVariable } from '../../../lib/utils';

export const BURN_ADDRESS = 'burn';
export const CONFIRMATIONS = getIntEnvVariable('CONFIRMATIONS', 10);
export const NODE_URL = process.env.NODE_URL || 'http://localhost:8545/';
export const LOOP_INTERVAL_CURRENT_MODE_SEC = getIntEnvVariable('LOOP_INTERVAL_CURRENT_MODE_SEC', 10);
exports.RPC_USERNAME = process.env.RPC_USERNAME;
exports.RPC_PASSWORD = process.env.RPC_PASSWORD;
export const MAX_CONCURRENT_REQUESTS = getIntEnvVariable('MAX_CONCURRENT_REQUESTS', 50);

