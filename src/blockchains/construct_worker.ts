'use strict';
import { BaseWorker } from '../lib/worker_base';
import { CardanoWorker } from './cardano/cardano_worker';
import { ERC20Worker } from './erc20/erc20_worker';
import { ETHWorker } from './eth/eth_worker';
import { ETHBlocksWorker } from './eth_blocks/eth_blocks_worker';
import { ETHContractsWorker } from './eth_contracts/eth_contracts_worker';
import { MaticWorker } from './matic/matic_worker';
import { ReceiptsWorker } from './receipts/receipts_worker';
import { UTXOWorker } from './utxo/utxo_worker';
import { XRPWorker } from './xrp/xrp_worker';
import { ICPWorker } from './icp/icp_worker';
import { ICRCWorker } from './icrc/icrc_worker';

export function constructWorker(blockchain: string, settings: any): BaseWorker {
  switch (blockchain) {
    case 'cardano':
      return new CardanoWorker(settings);
    case 'erc20':
      return new ERC20Worker(settings);
    case 'eth':
      return new ETHWorker(settings);
    case 'eth_blocks':
      return new ETHBlocksWorker(settings);
    case 'matic':
      return new MaticWorker(settings);
    case 'receipts':
      return new ReceiptsWorker(settings);
    case 'utxo':
      return new UTXOWorker(settings);
    case 'xrp':
      return new XRPWorker(settings);
    case 'eth_contracts':
      return new ETHContractsWorker(settings);
    case 'icp':
      return new ICPWorker(settings);
    case 'icrc':
      return new ICRCWorker(settings);
    default:
      throw Error(`Blockchain type '${blockchain}' is not recognized`);
  }
}

