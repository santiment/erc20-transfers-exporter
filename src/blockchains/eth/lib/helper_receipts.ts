import { ETHReceipt } from "../eth_types";

const lang = require('lodash/lang');
const object = require('lodash/object');
const collection = require('lodash/collection');

import { Web3Interface } from './web3_wrapper';

/*const parseReceipts = (responses) => {
  const receipts = responses.map((response) => response['result']);
  return array.compact(array.flatten(receipts));
};

const parseBlocks = (responses) => {
  return responses.map((response) => response['result']);
};

const parseTransactionReceipts = (responses) => {
  const receipts = responses.map((response) => response['result']);
  return receipts;
};
*/
const decodeLog = (log: any, web3Wrapper: Web3Interface) => {
  collection.forEach(['blockNumber', 'blockHash', 'transactionHash', 'transactionIndex'],
    (key: string) => object.unset(log, key));

  collection.forEach(['logIndex', 'transactionLogIndex'],
    (key: string) => {
      if (Object.prototype.hasOwnProperty.call(log, key) && log[key] !== undefined) {
        log[key] = web3Wrapper.parseHexToNumber(log[key]);
      }
      else {
        log[key] = null;
      }
    }
  );

  return log;
};

const columnizeLogs = (logs: any[], web3Wrapper: Web3Interface) => {
  if (logs.length === 0) { return []; }

  const decodedLogs = collection.map(logs, (log: any) => decodeLog(log, web3Wrapper));
  const logKeys = object.keys(decodedLogs[0]);
  const result: any = {};
  collection.forEach(logKeys, (key: string) => result[`logs.${key}`] = decodedLogs.map((log: any) => log[key]));

  return result;
};

export function decodeReceipt(receipt: ETHReceipt, web3Wrapper: Web3Interface) {
  const clonedReceipt = lang.cloneDeep(receipt);

  collection.forEach(['blockNumber', 'status', 'transactionIndex'],
    (key: string) => {
      if (Object.prototype.hasOwnProperty.call(clonedReceipt, key) && clonedReceipt[key] !== undefined) {
        clonedReceipt[key] = web3Wrapper.parseHexToNumber(clonedReceipt[key]);
      }
      else {
        clonedReceipt[key] = null;
      }
    }
  );

  collection.forEach(['cumulativeGasUsed', 'gasUsed'],
    (key: string) => clonedReceipt[key] = web3Wrapper.parseHexToNumberString(clonedReceipt[key])
  );

  object.merge(clonedReceipt, columnizeLogs(clonedReceipt['logs'], web3Wrapper));
  object.unset(clonedReceipt, 'logs');

  return clonedReceipt;
};

/*const decodeBlock = (block, web3Wrapper) => {
  return {
    timestamp: web3Wrapper.parseHexToNumber(block.timestamp),
    number: web3Wrapper.parseHexToNumber(block.number)
  };
};

const prepareBlockTimestampsObject = (blocks) => {
  let obj = {};
  for (const block of blocks) { obj[block.number] = block.timestamp; }

  return obj;
};*/




