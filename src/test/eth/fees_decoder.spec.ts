import assert from 'assert';
import { Web3Interface, constructWeb3WrapperNoCredentials, safeCastToNumber } from '../../blockchains/eth/lib/web3_wrapper';
import { FeesDecoder } from '../../blockchains/eth/lib/fees_decoder';
import { ETHBlock, ETHReceipt } from '../../blockchains/eth/eth_types';
import * as constants from '../../blockchains/eth/lib/constants';

/**
 * A transaction for which there is zero 'maxPriorityFeePerGas' and also 'maxFeePerGas' - 'baseFeePerGas' = 0.
 * This should produce no miner fee transfer.
 */
const block_json_post_london_zero_priority: ETHBlock = {
  'baseFeePerGas': '0xba37423df',
  'gasLimit': '0x1caa85f',
  'gasUsed': '0x9041b5',
  'hash': '0x6b029d5ebe5ca9bc568cd8630bd0af3d6b2b7ebed39fb7a6127a9169017010bd',
  'miner': '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
  'number': '0xcd2f91',
  'timestamp': '0x616e7e04',
  'totalDifficulty': '0x6ec3c4e96a280cc26b8',
  'difficulty': '18092216360',
  'size': '1076',
  'transactions': [{
    'blockHash': '0x6b029d5ebe5ca9bc568cd8630bd0af3d6b2b7ebed39fb7a6127a9169017010bd',
    'blockNumber': '0xcd2f91',
    'from': '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
    'gas': '0x3d090',
    'gasPrice': '0xba37423df',
    'maxPriorityFeePerGas': '0x0',
    'maxFeePerGas': '0xba37423df',
    'hash': '0xc8bebc11bbe703cdfb2a1a9599221baf4f19a1e20808866346791799d2dac7a9',
    'to': '0x48ee18b6dd7d10214be35ba540b606b3a2c44d7c',
    'transactionIndex': '0x0',
    'value': '0x4290f39ca406a4',
    'type': '0x2'
  }]
};

const block_json_post_london_with_priority: ETHBlock = {
  'baseFeePerGas': '0xba37423df',
  'gasLimit': '0x1caa85f',
  'gasUsed': '0x9041b5',
  'hash': '0x6b029d5ebe5ca9bc568cd8630bd0af3d6b2b7ebed39fb7a6127a9169017010bd',
  'miner': '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
  'number': '0xcd2f91',
  'timestamp': '0x616e7e04',
  'totalDifficulty': '0x6ec3c4e96a280cc26b8',
  'difficulty': '18092216360',
  'size': '1076',
  'transactions': [
    {
      'blockHash': '0x6b029d5ebe5ca9bc568cd8630bd0af3d6b2b7ebed39fb7a6127a9169017010bd',
      'blockNumber': '0xcd2f91',
      'from': '0x8ae57a027c63fca8070d1bf38622321de8004c67',
      'gas': '0x2a6af',
      'gasPrice': '0xbdf0eeddf',
      'maxPriorityFeePerGas': '0x3b9aca00',
      'maxFeePerGas': '0x19284a2404',
      'hash': '0x1e53bf3951f6cb70461df500ec75ed5d88d73bd44d88ca7faabaa4b1e65aec98',
      'to': '0x2f102e69cbce4938cf7fb27adb40fad097a13668',
      'transactionIndex': '0xa4',
      'value': '0x0',
      'type': '0x2'
    }
  ]
};

const block_json_post_london_old_tx_type: ETHBlock = {
  'baseFeePerGas': '0xf6e9b0a7f',
  'gasLimit': '0x1caa85f',
  'gasUsed': '0x9041b5',
  'hash': '0xc66d31320e1b56947efc0b3014950a1211063cd8cbf12399ebbc905d54bca00a',
  'miner': '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
  'number': '0xcb3928',
  'timestamp': '0x6153e50a',
  'totalDifficulty': '0x6ec3c4e96a280cc26b8',
  'difficulty': '18092216360',
  'size': '1076',
  'transactions': [{
    'blockHash': '0xc66d31320e1b56947efc0b3014950a1211063cd8cbf12399ebbc905d54bca00a',
    'blockNumber': '0xcb3928',
    'from': '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740',
    'gas': '0x5208',
    'gasPrice': '0xfe5d09e7f',
    'maxPriorityFeePerGas': '0x77359400',
    'maxFeePerGas': '0x1e80355e00',
    'hash': '0xec5b5841e0a425bf69553a0ccecfa58b053a63e30f5fbdd9ecbdee5e9fb0666c',
    'to': '0x9fae918aeb96e876e25ee6975bcc2976cf48f595',
    'transactionIndex': '0x61',
    'value': '0x765ae822ac7f2000',
    'type': '0x2'
  }]
};

const receipts_json_post_london_old_tx_type: ETHReceipt[] = [{
  'blockHash': '0xc66d31320e1b56947efc0b3014950a1211063cd8cbf12399ebbc905d54bca00a',
  'blockNumber': '0xcb3928',
  'cumulativeGasUsed': '0x3880ad',
  'gasUsed': '0x5208',
  'logs': [],
  'transactionHash': '0xec5b5841e0a425bf69553a0ccecfa58b053a63e30f5fbdd9ecbdee5e9fb0666c',
  'transactionIndex': '0x61'
}];

const receipts_json_post_london_no_priority: ETHReceipt[] = [{
  'blockHash': '0x6b029d5ebe5ca9bc568cd8630bd0af3d6b2b7ebed39fb7a6127a9169017010bd',
  'blockNumber': '0xcd2f91',
  'cumulativeGasUsed': '0x5208',
  'gasUsed': '0x5208',
  'logs': [],
  'transactionHash': '0xc8bebc11bbe703cdfb2a1a9599221baf4f19a1e20808866346791799d2dac7a9',
  'transactionIndex': '0x0'
}];

const receipts_json_post_london_with_priority: ETHReceipt[] = [{
  'blockHash': '0x6b029d5ebe5ca9bc568cd8630bd0af3d6b2b7ebed39fb7a6127a9169017010bd',
  'blockNumber': '0xcd2f91',
  'cumulativeGasUsed': '0x9041b5',
  'gasUsed': '0x11d7e',
  'logs': [],
  'transactionHash': '0x1e53bf3951f6cb70461df500ec75ed5d88d73bd44d88ca7faabaa4b1e65aec98',
  'transactionIndex': '0xa4'
}];

const block_json_pre_london: ETHBlock = {
  'gasLimit': '0x2fefd8',
  'gasUsed': '0xc444',
  'hash': '0x8e38b4dbf6b11fcc3b9dee84fb7986e29ca0a02cecd8977c161ff7333329681e',
  'miner': '0x2a65aca4d5fc5b5c859090a6c34d164135398226',
  'number': '0xf4240',
  'timestamp': '0x56bfb415',
  'totalDifficulty': '0x6ec3c4e96a280cc26b8',
  'difficulty': '18092216360',
  'size': '1076',
  'transactions': [{
    'blockHash': '0x8e38b4dbf6b11fcc3b9dee84fb7986e29ca0a02cecd8977c161ff7333329681e',
    'blockNumber': '0xf4240',
    'from': '0x39fa8c5f2793459d6622857e7d9fbb4bd91766d3',
    'gas': '0x1f8dc',
    'gasPrice': '0x12bfb19e60',
    'hash': '0xea1093d492a1dcb1bef708f771a99a96ff05dcab81ca76c31940300177fcf49f',
    'to': '0xc083e9947cf02b8ffc7d3090ae9aea72df98fd47',
    'transactionIndex': '0x0',
    'value': '0x56bc75e2d63100000',
    'type': '0x2'
  }]
};

const receipts_json_pre_london: ETHReceipt[] = [{
  'blockHash': '0x8e38b4dbf6b11fcc3b9dee84fb7986e29ca0a02cecd8977c161ff7333329681e',
  'blockNumber': '0xf4240',
  'cumulativeGasUsed': '0x723c',
  'gasUsed': '0x723c',
  'logs': [],
  'transactionHash': '0xea1093d492a1dcb1bef708f771a99a96ff05dcab81ca76c31940300177fcf49f',
  'transactionIndex': '0x0'
}];


describe('Fees decoder test', function () {
  const web3Wrapper: Web3Interface = constructWeb3WrapperNoCredentials(constants.NODE_URL);
  const feesDecoder = new FeesDecoder(web3Wrapper);

  it('test fees post London zero priority', async function () {
    const postLondonFees = feesDecoder.getFeesFromTransactionsInBlock(block_json_post_london_zero_priority,
      safeCastToNumber(web3Wrapper.parseHexToNumber(block_json_post_london_zero_priority.number)),
      receipts_json_post_london_no_priority, true);

    const expected = [{
      from: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
      to: constants.BURN_ADDRESS,
      value: 1049725694283000,
      valueExactBase36: 'ac3hbr9fco',
      blockNumber: 13447057,
      timestamp: 1634631172,
      transactionHash: '0xc8bebc11bbe703cdfb2a1a9599221baf4f19a1e20808866346791799d2dac7a9',
      type: 'fee_burnt'
    }
    ];

    assert.deepStrictEqual(postLondonFees, expected);
  });

  it('test fees post London with priority', async function () {
    const postLondonFees = feesDecoder.getFeesFromTransactionsInBlock(block_json_post_london_with_priority,
      safeCastToNumber(web3Wrapper.parseHexToNumber(block_json_post_london_with_priority.number)),
      receipts_json_post_london_with_priority, true);

    const expected = [{
      blockNumber: 13447057,
      from: '0x8ae57a027c63fca8070d1bf38622321de8004c67',
      timestamp: 1634631172,
      to: constants.BURN_ADDRESS,
      transactionHash: '0x1e53bf3951f6cb70461df500ec75ed5d88d73bd44d88ca7faabaa4b1e65aec98',
      type: 'fee_burnt',
      value: 3653345337731778,
      valueExactBase36: 'zz03ofi5du'
    },
    {
      from: '0x8ae57a027c63fca8070d1bf38622321de8004c67',
      to: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
      value: 73086000000000,
      valueExactBase36: 'pwn8tdiio',
      blockNumber: 13447057,
      timestamp: 1634631172,
      transactionHash: '0x1e53bf3951f6cb70461df500ec75ed5d88d73bd44d88ca7faabaa4b1e65aec98',
      type: 'fee'
    }
    ];

    assert.deepStrictEqual(postLondonFees, expected);
  });

  it('test old type fees post London', async function () {
    const postLondonFees = feesDecoder.getFeesFromTransactionsInBlock(block_json_post_london_old_tx_type,
      safeCastToNumber(web3Wrapper.parseHexToNumber(block_json_post_london_old_tx_type.number)),
      receipts_json_post_london_old_tx_type, true);

    const expected = [{
      blockNumber: 13318440,
      from: '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740',
      timestamp: 1632888074,
      to: constants.BURN_ADDRESS,
      transactionHash: '0xec5b5841e0a425bf69553a0ccecfa58b053a63e30f5fbdd9ecbdee5e9fb0666c',
      type: 'fee_burnt',
      value: 1391883443307000,
      valueExactBase36: 'dpdqfcs260'
    },
    {
      from: '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740',
      to: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
      value: 42000000000000,
      valueExactBase36: 'evyj7lbeo',
      blockNumber: 13318440,
      timestamp: 1632888074,
      transactionHash: '0xec5b5841e0a425bf69553a0ccecfa58b053a63e30f5fbdd9ecbdee5e9fb0666c',
      type: 'fee'
    }
    ];

    assert.deepStrictEqual(postLondonFees, expected);
  });

  it('test fees pre London', async function () {
    const preLondonFees = feesDecoder.getFeesFromTransactionsInBlock(block_json_pre_london,
      safeCastToNumber(web3Wrapper.parseHexToNumber(block_json_pre_london.number)),
      receipts_json_pre_london, true);

    const expected = [{
      from: '0x39fa8c5f2793459d6622857e7d9fbb4bd91766d3',
      to: '0x2a65aca4d5fc5b5c859090a6c34d164135398226',
      value: 2354887722000000,
      valueExactBase36: 'n6qkhga2dc',
      blockNumber: 1000000,
      timestamp: 1455404053,
      transactionHash: '0xea1093d492a1dcb1bef708f771a99a96ff05dcab81ca76c31940300177fcf49f',
      type: 'fee'
    }];

    assert.deepStrictEqual(preLondonFees, expected);
  });

});
