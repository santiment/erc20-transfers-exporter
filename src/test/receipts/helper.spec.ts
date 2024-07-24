import assert from 'assert';
import { decodeReceipt } from '../../blockchains/eth/lib/helper_receipts';
import { Web3Interface, constructWeb3WrapperNoCredentials } from '../../blockchains/eth/lib/web3_wrapper';
import { NODE_URL } from '../../blockchains/eth/lib/constants';

const web3Wrapper: Web3Interface = constructWeb3WrapperNoCredentials(NODE_URL);


context('receipt without logs', () => {
  const receipt = {
    blockHash: '0x209bc40be9e6961d88435382b91754b7a6e180d6cbf9120a61246e1d2506f3a6',
    blockNumber: '0xf4fbb',
    contractAddress: null,
    cumulativeGasUsed: '0x5208',
    from: '0x2a65aca4d5fc5b5c859090a6c34d164135398226',
    gasUsed: '0x5208',
    logs: [],
    logsBloom: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    root: '0x1806fd9f2ef8bf8dce03665b4c80a1740efe4194f90864c662e7af6a80a02a08',
    to: '0xe33977e292ccef99ea8828733e97562f3690a8ad',
    transactionHash: '0x88217032c83348c7aae522090d7a5b932609860a5f6760e98e9048f6ddc55ad8',
    transactionIndex: '0x0'
  };

  describe('receipt decoding', () => {
    it('converts blockNumber from hex to number', () => {
      const result = decodeReceipt(receipt, web3Wrapper);

      const expected = {
        blockHash: '0x209bc40be9e6961d88435382b91754b7a6e180d6cbf9120a61246e1d2506f3a6',
        blockNumber: 1003451,
        contractAddress: null,
        cumulativeGasUsed: '21000',
        from: '0x2a65aca4d5fc5b5c859090a6c34d164135398226',
        gasUsed: '21000',
        logsBloom: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        root: '0x1806fd9f2ef8bf8dce03665b4c80a1740efe4194f90864c662e7af6a80a02a08',
        status: null,
        to: '0xe33977e292ccef99ea8828733e97562f3690a8ad',
        transactionHash: '0x88217032c83348c7aae522090d7a5b932609860a5f6760e98e9048f6ddc55ad8',
        transactionIndex: 0
      };

      assert.deepStrictEqual(result, expected);
    });
  });
});

context('receipt with logs', () => {
  const receipt = {
    timestamp: '2020-10-02T08:51:25.779Z',
    level: 'info',
    blockHash: '0xa6e57d9dc2447ba63bef1dfd03b7885cf71753a93260f66016463b2e3b32d82e',
    blockNumber: '0xF52DA',
    contractAddress: null,
    cumulativeGasUsed: '0x242F8',
    from: '0xae04420f8e66003b201ac5ec59cc529c2ec5b12f',
    gasUsed: '0xFAD8',
    logs: [
      {
        address: '0x6e3ded77aa29924ba55a87c23ee7d985b07212c6',
        blockHash: '0xa6e57d9dc2447ba63bef1dfd03b7885cf71753a93260f66016463b2e3b32d82e',
        blockNumber: '0xf52da',
        data: '0x0',
        logIndex: '0x0',
        removed: false,
        topics: ['0x92ca3a80853e6663fa31fa10b99225f18d4902939b4c53a9caae9043f6efd004'],
        transactionHash: '0xad637af875b539171853d144933b84680a93ccbefa22a68f127dc099fc26a43d',
        transactionIndex: '0x4',
        transactionLogIndex: '0x0',
        type: 'mined'
      }
    ],
    logsBloom: '0x0',
    root: '0x2b29b7a06c5bdd1d0287e0327bf2eb94a10bdd4ab9a11fce81787d6956d75f3b',
    to: '0x6e3ded77aa29924ba55a87c23ee7d985b07212c6',
    transactionHash: '0xad637af875b539171853d144933b84680a93ccbefa22a68f127dc099fc26a43d',
    transactionIndex: '0x4'
  };

  describe('receipt decoding', () => {
    it('merges columnized logs', () => {
      const expected = {
        timestamp: '2020-10-02T08:51:25.779Z',
        level: 'info',
        blockHash: '0xa6e57d9dc2447ba63bef1dfd03b7885cf71753a93260f66016463b2e3b32d82e',
        blockNumber: 1004250,
        contractAddress: null,
        cumulativeGasUsed: '148216',
        from: '0xae04420f8e66003b201ac5ec59cc529c2ec5b12f',
        gasUsed: '64216',
        "logs.address": ['0x6e3ded77aa29924ba55a87c23ee7d985b07212c6'],
        "logs.data": ['0x0'],
        "logs.logIndex": [0],
        "logs.removed": [false],
        "logs.topics": [['0x92ca3a80853e6663fa31fa10b99225f18d4902939b4c53a9caae9043f6efd004']],
        "logs.transactionLogIndex": [0],
        "logs.type": ['mined'],
        logsBloom: '0x0',
        root: '0x2b29b7a06c5bdd1d0287e0327bf2eb94a10bdd4ab9a11fce81787d6956d75f3b',
        status: null,
        to: '0x6e3ded77aa29924ba55a87c23ee7d985b07212c6',
        transactionHash: '0xad637af875b539171853d144933b84680a93ccbefa22a68f127dc099fc26a43d',
        transactionIndex: 4
      };

      const result = decodeReceipt(receipt, web3Wrapper);

      assert.deepStrictEqual(result, expected);
    });
  });
});


