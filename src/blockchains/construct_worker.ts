'use strict';
import { BaseWorker } from '../lib/worker_base';
import { CardanoWorker } from './cardano/cardano_worker';
import { ERC20Worker } from './erc20/erc20_worker';
import { ETHWorker } from './eth/eth_worker';
import { ETHBlocksWorker } from './eth_blocks/eth_blocks_worker';
import { MaticWorker } from './matic/matic_worker';

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
    default:
      throw Error(`Blockchain type '${blockchain}' is not recognized`);
  }
}

