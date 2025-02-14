type Currency = {
    symbol: string;
    decimals: string;
};

type Amount = {
    value: string;
    currency: Currency;
};

type Account = {
    address: string;
    sub_account: Subaccount;
};

type ICRCAccount = {
    address: string;
    sub_account: Subaccount;
};

type Subaccount = {
    address: string;
};

type OperationIdentifier = {
    index: number;
};

type Allowance = {
    currency: Currency;
    value: string;
};

type EffectiveFee = {
    currency: Currency;
    value: string;
}

type OperationMetadata = {
    allowance: Allowance;
    value: string;
};

type Operation = {
    operation_identifier: OperationIdentifier;
    type: string;
    status: string;
    account: ICRCAccount;
    amount: Amount;
    metadata: OperationMetadata;
};

type TransactionIdentifier = {
    hash: string;
};

type Metadata = {
    block_created_at_nano_seconds: string;
    fee_collector_block_index: string;
};

export type ICPTransaction = {
    transaction_identifier: TransactionIdentifier;
    operations: Operation[];
    metadata: Metadata;
};

export type ICRCTransaction = {
    transaction_identifier: TransactionIdentifier;
    operations: Operation[];
    metadata: Metadata;
};

type BlockIdentifier = {
    index: number;
    hash: string;
};

type ParentBlockIdentifier = BlockIdentifier;

type BlockMetadata = {
    block_height: number;
    memo: number;
    timestamp: number;
};

export type ICPBlock = {
    block_identifier: BlockIdentifier;
    parent_block_identifier: ParentBlockIdentifier;
    timestamp: number;
    transactions: ICPTransaction[];
};

export type ICRCBlock = {
    block_identifier: BlockIdentifier;
    parent_block_identifier: ParentBlockIdentifier;
    timestamp: number;
    transactions: ICRCTransaction[];
};

export type Transaction = {
    timestamp: string;
    blockNumber: number,
    transactionHash: string;
    from: string;
    to: string;
    value: string;
    symbol: string;
    type: string;
}

export type ExtendedTransaction = Transaction & {
    primaryKey?: number;
    transactionPosition?: number;
    valueExactBase36: string;
  };


export type TransferPart = {
    address: string,
    value: string,
    symbol: string;
    operationIndex: number;
}
  