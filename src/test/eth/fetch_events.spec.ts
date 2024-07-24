import assert from 'assert';
import { ETHWorker } from '../../blockchains/eth/eth_worker';
import * as constants from '../../blockchains/eth/lib/constants';
import { injectDAOHackTransfers, DAO_HACK_ADDRESSES, DAO_HACK_FORK_BLOCK } from '../../blockchains/eth/lib/dao_hack';
import { Web3Interface, constructWeb3WrapperNoCredentials } from '../../blockchains/eth/lib/web3_wrapper';
import { ETHBlock, ETHReceipt, ETHTransfer } from '../../blockchains/eth/eth_types';

describe('fetch past events', function () {
  const transaction = {
    blockHash: '0x22854625d4c18b3034461851a6fb181209e77a242adbd923989e7113a60fec56',
    blockNumber: '0x572559',
    chainId: null,
    condition: null,
    creates: null,
    from: '0x03b16ab6e23bdbeeab719d8e4c49d63674876253',
    gas: '0x18be0',
    gasPrice: '0x3a35294400',
    hash: '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d',
    input: '0x454a2ab300000000000000000000000000000000000000000000000000000000000bf518',
    nonce: '0x9a9',
    publicKey: '0x077f2583a73ed1db394591aa209713b0d66c305a403bbf0c37ebe329eb517877f0654196a1a47817fdf5732e27430a7cc9ef304741f34e50e0690931823ef020',
    r: '0x2fb44a3c0826e6d874ec664b60577b5b1baa7b03a21f95c8508653593b0bcd27',
    raw: '0xf8938209a9853a3529440083018be094b1690c08e213a35ed9bab7b318de14420fb57d8c8804712d3e1aa21b20a4454a2ab300000000000000000000000000000000000000000000000000000000000bf5181ca02fb44a3c0826e6d874ec664b60577b5b1baa7b03a21f95c8508653593b0bcd27a07d798edb0c7ddc16868d433728b533047379eb0afd8c0f461215ffe16674fd52',
    s: '0x7d798edb0c7ddc16868d433728b533047379eb0afd8c0f461215ffe16674fd52',
    standardV: '0x1',
    to: '0xb1690c08e213a35ed9bab7b318de14420fb57d8c',
    transactionHash: '0xfe79891a2150c8acecf0789ef4a20310686651cf0edc2819da7e1e6305bae030',
    transactionIndex: '0x0',
    v: '0x1c',
    value: '0x4712d3e1aa21b20',
    type: "call"
  };
  const blocks = new Map<number, ETHBlock>();
  blocks.set(5711193,
    {
      difficulty: '0xb8d1a2118a1d5',
      gasLimit: '0x7a2047',
      gasUsed: '0x7a0166',
      hash: '0x22854625d4c18b3034461851a6fb181209e77a242adbd923989e7113a60fec56',
      miner: '0x829bd824b016326a401d083b33d092293333a830',
      number: '0x572559',
      size: '0x915a',
      timestamp: '0x5b109a83',
      totalDifficulty: '0xf4890fc4320c56c9a4',
      transactions: [transaction],
    });

  const receipts: ETHReceipt[] = [
    {
      'blockHash': '0x22854625d4c18b3034461851a6fb181209e77a242adbd923989e7113a60fec56',
      'blockNumber': '0x572559',
      'cumulativeGasUsed': '0xdc18',
      'gasUsed': '0xdc18',
      'logs': [{
        'address': '0xb1690c08e213a35ed9bab7b318de14420fb57d8c',
        'blockHash': '0x22854625d4c18b3034461851a6fb181209e77a242adbd923989e7113a60fec56',
        'blockNumber': '0x572559',
        'data': '0x00000000000000000000000000000000000000000000000000000000000bf51800000000000000000000000000000000000000000000000004704ed9dfca173400000000000000000000000003b16ab6e23bdbeeab719d8e4c49d63674876253',
        'logIndex': '0x0',
        'removed': false,
        'topics': ['0x4fcc30d90a842164dd58501ab874a101a3749c3d4747139cefe7c876f4ccebd2'],
        'transactionHash': '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d',
        'transactionIndex': '0x0',
        'transactionLogIndex': '0x0',
        'type': 'mined'
      }, {
        'address': '0x06012c8cf97bead5deae237070f9587f8e7a266d',
        'blockHash': '0x22854625d4c18b3034461851a6fb181209e77a242adbd923989e7113a60fec56',
        'blockNumber': '0x572559',
        'data': '0x000000000000000000000000b1690c08e213a35ed9bab7b318de14420fb57d8c00000000000000000000000003b16ab6e23bdbeeab719d8e4c49d6367487625300000000000000000000000000000000000000000000000000000000000bf518',
        'logIndex': '0x1',
        'removed': false,
        'topics': ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'],
        'transactionHash': '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d',
        'transactionIndex': '0x0',
        'transactionLogIndex': '0x1',
        'type': 'mined'
      }],
      'transactionHash': '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d',
      'transactionIndex': '0x0'
    }
  ];
  const trace = {
    'action': {
      'callType': 'call',
      'from': '0x03b16ab6e23bdbeeab719d8e4c49d63674876253',
      'gas': '0x13788',
      'input': '0x454a2ab300000000000000000000000000000000000000000000000000000000000bf518',
      'to': '0xb1690c08e213a35ed9bab7b318de14420fb57d8c',
      'value': '0x4712d3e1aa21b20'
    },
    'blockHash': '0x22854625d4c18b3034461851a6fb181209e77a242adbd923989e7113a60fec56',
    'blockNumber': 5711193,
    'result': { 'gasUsed': '0x13788', 'output': '0x' },
    'subtraces': 3,
    'traceAddress': [],
    'transactionHash': '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d',
    'transactionPosition': 0,
    'type': 'call'
  };

  const worker = new ETHWorker(constants);
  let feeResult!: ETHTransfer;
  let callResult!: ETHTransfer;

  beforeEach(function () {
    feeResult = {
      from: '0x03b16ab6e23bdbeeab719d8e4c49d63674876253',
      to: '0x829bd824b016326a401d083b33d092293333a830',
      value: 14086000000000000,
      valueExactBase36: '3up2j2e99ts',
      blockNumber: 5711193,
      timestamp: 1527814787,
      transactionHash: '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d',
      type: 'fee'
    };

    callResult = {
      from: '0x03b16ab6e23bdbeeab719d8e4c49d63674876253',
      to: '0xb1690c08e213a35ed9bab7b318de14420fb57d8c',
      value: 320086793278069500,
      valueExactBase36: '2fjpaqu9o0tc',
      blockNumber: 5711193,
      timestamp: 1527814787,
      transactionHash: '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d',
      transactionPosition: 0,
      type: 'call'
    };
  });


  it('parse transaction events', function () {
    const result = worker.transformPastTransactionEvents([...blocks.values()], receipts);
    const expectedResult = [feeResult];

    assert.deepStrictEqual(result, expectedResult);
  });

  it('parse transfer events', function () {
    const result = worker.transformPastTransferEvents([trace], blocks);
    const expectedResult = [callResult];

    assert.deepStrictEqual(result, expectedResult);
  });

  it('add genesis events', function () {
    const result = worker.transformPastEvents(0, 1, [trace], blocks, receipts);

    const firstGenesisEvent: ETHTransfer = {
      from: 'GENESIS',
      to: '0x000d836201318ec6899a67540690382780743280',
      value: 200000000000000000000,
      valueExactBase36: '167i830vk1gbnk',
      blockNumber: 0,
      timestamp: 1438269973,
      transactionHash: 'GENESIS_000d836201318ec6899a67540690382780743280',
      type: 'genesis'
    };


    assert.deepStrictEqual(result[0], firstGenesisEvent);
  });

  it('genesis events ordering', function () {
    const result = worker.transformPastEvents(0, 1, [trace], blocks, receipts);

    const genesisEventsInserted = 8894;
    assert.strictEqual(result.length, genesisEventsInserted + 2);
    assert.deepStrictEqual(callResult, result[genesisEventsInserted]);
    assert.deepStrictEqual(feeResult, result[genesisEventsInserted + 1]);
  });

  it('DAO hack events', function () {
    const result = worker.transformPastEvents(DAO_HACK_FORK_BLOCK - 1, DAO_HACK_FORK_BLOCK + 1, [trace], blocks, receipts);
    const expectedEvents = DAO_HACK_ADDRESSES.length + 2;

    assert.deepStrictEqual(expectedEvents, result.length);
  });

  it('DAO hack events ordering', function () {
    // Test that DAO hack events are inserted in between the others
    feeResult.blockNumber = DAO_HACK_FORK_BLOCK - 1;
    callResult.blockNumber = DAO_HACK_FORK_BLOCK - 1;

    const eventsResult = [feeResult, callResult];
    const web3Wrapper: Web3Interface = constructWeb3WrapperNoCredentials(constants.NODE_URL);
    injectDAOHackTransfers(eventsResult, web3Wrapper);

    assert.deepStrictEqual(feeResult, eventsResult[0]);
    assert.deepStrictEqual(callResult, eventsResult[1]);
  });
});
