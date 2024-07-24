export type TraceAction = {
  author?: string,
  address?: string,
  rewardType?: string,
  callType?: string,
  from?: string,
  to?: string,
  value?: string,
  balance?: string,
  refundAddress?: string
}

export type TraceResult = {
  gasUsed: string,
  address?: string
}

export type Trace = {
  action: TraceAction,
  blockHash: string,
  blockNumber: number,
  result: TraceResult,
  subtraces: number,
  traceAddress: number[],
  transactionHash: string,
  transactionPosition: number,
  type: string,
  error?: string
}

export type ETHBlock = {
  baseFeePerGas?: string,
  gasLimit: string,
  gasUsed: string,
  hash: string,
  miner: string,
  number: string,
  timestamp: string,
  totalDifficulty: string,
  difficulty: string,
  size: string,
  minGasPrice?: string
  // Withdrawals should be set for ETH post-Shenghai upgrade
  withdrawals?: BeaconChainWithdrawal[],
  // Transactions can be expanded or just hashes
  transactions: ETHTransaction[] | string[]
}

export type BeaconChainWithdrawal = {
  index: string,
  validatorIndex: string,
  address: string,
  amount: string
};

export type ETHTransaction = {
  from: string,
  to: string,
  hash: string,
  blockNumber: string,
  gasPrice: string
  blockHash: string,
  gas: string,
  transactionIndex: string,
  value: string,
  type: string,
  maxPriorityFeePerGas?: string,
  maxFeePerGas?: string
};

export type ETHTransfer = {
  from: string,
  to: string,
  value: number,
  valueExactBase36: string,
  blockNumber: number,
  timestamp: number,
  transactionHash?: string,
  transactionPosition?: number,
  type: string,
  primaryKey?: number,
}

export type ETHReceipt = {
  blockNumber: string,
  blockHash: string,
  gasUsed: string,
  transactionHash: string,
  cumulativeGasUsed: string,
  logs: any[],
  transactionIndex: string
}

export type ETHReceiptDecoded = {
  blockNumber: number,
  blockHash: string,
  gasUsed: string,
  transactionHash: string,
  cumulativeGasUsed: string,
  logs: any[],
  transactionIndex: number,
  status: number,
  timestamp: string
}

export type ETHReceiptsMap = {
  [transactionHash: string]: ETHReceipt;
}


