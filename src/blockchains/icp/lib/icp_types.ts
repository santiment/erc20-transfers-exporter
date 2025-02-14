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
};

type OperationIdentifier = {
    index: string;
};

type Allowance = {
    e8s: string;
};

type OperationMetadata = {
    allowance: Allowance;
    expected_allowance: string;
    expires_at: string;
    from: string;
    spender: string;
};

type Operation = {
    operation_identifier: OperationIdentifier;
    type: string;
    status: string;
    account: Account;
    amount: Amount;
    metadata: OperationMetadata;
};

type TransactionIdentifier = {
    hash: string;
};

type Metadata = {
    block_height: string;
    memo: string;
    timestamp: string;
};

export type ICPTransaction = {
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