const { logger } = require('../../../lib/logger');

/**
   * It is expected that transactions for the last included in the batch block are not complete.
   * We discard the non completed block and would re-try it on next iteration.
   */
function discardNotCompletedBlock(transactions) {
  const lastBlockNumber = transactions[transactions.length - 1].block.number;
  let index = transactions.length - 2;
  while (index >= 0 && transactions[index].block.number === lastBlockNumber) {
    --index;
  }

  if (transactions[index + 1].block.transactionsCount !== (transactions.length - index - 1)) {
    if (index < 0) {
      throw new Error(`Single extracted block is partial. Exporter would not be able to progress.
          Block number is ${lastBlockNumber} it has ${transactions[0].block.transactionsCount} but only
          ${transactions.length - 1} were extracted.`);
    }
    logger.debug(`Removing ${transactions.length - index - 1} transactions from partial block ${lastBlockNumber}`);
    return transactions.slice(0, index + 1);
  }

  return transactions;
}

function verifyBlockComplete(blockNumber, transactionsSeen, transactionsExpected) {
  const transactionsExpectedCasted = (typeof transactionsExpected === 'string') ?
    parseInt(transactionsExpected, 10) : transactionsExpected;

  if (transactionsSeen !== transactionsExpectedCasted) {
    let strMessage = `Block ${blockNumber} should have ${transactionsExpected}`;
    strMessage += ` transactions but we extracted ${transactionsSeen}`;
    throw new Error(strMessage);
  }
}

function verifyAllBlocksComplete(transactions) {
  let lastBlockNumber = transactions[0].block.number;
  let transactionsInBlock = 1;

  for (let i = 1; i < transactions.length; i++) {
    if (transactions[i].block.number !== lastBlockNumber) {
      // We have finished iterating transactions from the previous block. Check that all transactions are extracted.
      const lastBlock = transactions[i - 1].block;
      verifyBlockComplete(lastBlock.number, transactionsInBlock, lastBlock.transactionsCount);
      transactionsInBlock = 0;
      lastBlockNumber = transactions[i].block.number;
    }
    ++transactionsInBlock;
  }

  const lastBlock = transactions[transactions.length - 1].block;
  verifyBlockComplete(lastBlock.number, transactionsInBlock, lastBlock.transactionsCount);
}

module.exports = {
  discardNotCompletedBlock, verifyAllBlocksComplete
};
