import assert from 'assert'
import { Web3Interface, safeCastToNumber } from './web3_wrapper';
import { ETHBlock, ETHTransaction, ETHTransfer, ETHReceipt, ETHReceiptsMap } from '../eth_types';
import { BURN_ADDRESS, LONDON_FORK_BLOCK } from './constants';


function isETHTransaction(transaction: ETHTransaction | string): transaction is ETHTransaction {
  return typeof transaction === 'object' && 'hash' in transaction && 'from' in transaction;
}

export class FeesDecoder {
  private web3Wrapper: Web3Interface;

  constructor(web3Wrapper: Web3Interface) {
    this.web3Wrapper = web3Wrapper;
  }

  getPreLondonForkFees(transaction: ETHTransaction, block: ETHBlock, receipts: ETHReceiptsMap): ETHTransfer[] {
    const gasExpense = BigInt(this.web3Wrapper.parseHexToNumber(transaction.gasPrice)) *
      BigInt(this.web3Wrapper.parseHexToNumber(receipts[transaction.hash].gasUsed));
    return [{
      from: transaction.from,
      to: block.miner,
      value: Number(gasExpense),
      valueExactBase36: gasExpense.toString(36),
      blockNumber: safeCastToNumber(this.web3Wrapper.parseHexToNumber(transaction.blockNumber)),
      timestamp: safeCastToNumber(this.web3Wrapper.parseHexToNumber(block.timestamp)),
      transactionHash: transaction.hash,
      type: 'fee'
    }];
  }

  getBurntFee(transaction: ETHTransaction, block: ETHBlock, receipts: ETHReceiptsMap,
    burnAddress: string): ETHTransfer {
    const gasExpense = (block.baseFeePerGas === undefined) ?
      0
      :
      BigInt(this.web3Wrapper.parseHexToNumber(block.baseFeePerGas)) *
      BigInt(this.web3Wrapper.parseHexToNumber(receipts[transaction.hash].gasUsed))

    return {
      from: transaction.from,
      to: burnAddress,
      value: Number(gasExpense),
      valueExactBase36: gasExpense.toString(36),
      blockNumber: safeCastToNumber(this.web3Wrapper.parseHexToNumber(transaction.blockNumber)),
      timestamp: safeCastToNumber(this.web3Wrapper.parseHexToNumber(block.timestamp)),
      transactionHash: transaction.hash,
      type: 'fee_burnt'
    };
  }

  /**
   * We depend on:
   * "Block validity is defined in the reference implementation below. The GASPRICE (0x3a) opcode MUST return the
   * effective_gas_price as defined in the reference implementation below."
   *
   * 'gasPrice' would be set to gas price paid by the signer of the transaction no matter if the transaction is
   * 'type 0, 1 or 2.
   *
   * https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1559.md
   **/
  getMinerFee(transaction: ETHTransaction, block: ETHBlock, receiptsMap: ETHReceiptsMap): ETHTransfer | undefined {
    const baseFeePerGas = (block.baseFeePerGas === undefined) ?
      BigInt(0) : BigInt(this.web3Wrapper.parseHexToNumber(block.baseFeePerGas));

    const tipMinerPerGas = BigInt(this.web3Wrapper.parseHexToNumber(transaction.gasPrice)) - baseFeePerGas;
    const gasExpense = tipMinerPerGas * BigInt(this.web3Wrapper.parseHexToNumber(receiptsMap[transaction.hash].gasUsed));
    if (tipMinerPerGas > 0) {
      return {
        from: transaction.from,
        to: block.miner,
        value: Number(gasExpense),
        valueExactBase36: gasExpense.toString(36),
        blockNumber: safeCastToNumber(this.web3Wrapper.parseHexToNumber(transaction.blockNumber)),
        timestamp: safeCastToNumber(this.web3Wrapper.parseHexToNumber(block.timestamp)),
        transactionHash: transaction.hash,
        type: 'fee'
      };
    }
    else {
      return undefined
    }
  }

  getPostLondonForkFees(transaction: ETHTransaction, block: ETHBlock, receiptsMap: ETHReceiptsMap): ETHTransfer[] {
    const result: ETHTransfer[] = [];
    result.push(this.getBurntFee(transaction, block, receiptsMap, BURN_ADDRESS));
    const minerFee = this.getMinerFee(transaction, block, receiptsMap);
    if (minerFee !== undefined) {
      result.push(minerFee)
    }

    return result;
  }

  getFeesFromTransactionsInBlock(block: ETHBlock, blockNumber: number, receipts: ETHReceipt[], isETH: boolean): ETHTransfer[] {
    const result: ETHTransfer[] = [];
    const receiptsMap: ETHReceiptsMap = {};
    receipts.forEach((receipt: ETHReceipt) => {
      receiptsMap[receipt.transactionHash] = receipt;
    });
    block.transactions.forEach((transaction: ETHTransaction | string) => {
      assert(isETHTransaction(transaction), "To get fees, ETH transaction should be expanded and not just the hash.");

      const feeTransfers: ETHTransfer[] =
        isETH && blockNumber >= LONDON_FORK_BLOCK ?
          this.getPostLondonForkFees(transaction, block, receiptsMap) :
          this.getPreLondonForkFees(transaction, block, receiptsMap);

      result.push(...feeTransfers);
    });
    return result;
  }
}
