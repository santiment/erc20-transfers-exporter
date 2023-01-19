const constants = require('./constants');


function isFullIntervalAvailable(worker) {
  return worker.lastExportedBlock + constants.BLOCK_INTERVAL < worker.lastConfirmedBlock;
}
/**
 * Return the next interval to be fetched.
 * NOTE: this method modifies the member variables of its argument
 *
 * @param {*} worker A worker object, member variables would be modified
 * @returns An object like so:
 * {
 *  success: Boolean,
 *  fromBlock: Integer,
 *  toBlock: Integer
 * }
 */
async function nextIntervalCalculator(worker) {
  // Check if we need to ask the Node for new Head block. This is an optimization to skip this call when the exporter
  // is behind the last seen Head anyways.
  const firstIntervalCheck = isFullIntervalAvailable(worker);
  if (!firstIntervalCheck) {
    // The exporter has progress to a point where now it does not have a full BLOCK_INTERVAL to fetch.
    // Check if the Node has extended the Head.
    const newConfirmedBlock = await worker.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;
    if (newConfirmedBlock > worker.lastConfirmedBlock) {
      // The Node has progressed
      worker.lastConfirmedBlock = newConfirmedBlock;
    }
  }

  const secondIntervalCheck = firstIntervalCheck || isFullIntervalAvailable(worker);

  if (secondIntervalCheck) {
    // There is enough data to fetch right away

    // If data was available without asking with Node, we are catching up and should come back straight away
    if (firstIntervalCheck) {
      worker.sleepTimeMsec = 0;
    }
    else {
      // If data became available only after asking the Node, we are close to the Head, come back later
      worker.sleepTimeMsec = constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;
    }

    return {
      success: true,
      fromBlock: worker.lastExportedBlock + 1,
      toBlock: worker.lastExportedBlock + constants.BLOCK_INTERVAL
    };
  }
  else {
    // The Node has not progressed enough to generate a new interval
    worker.sleepTimeMsec = constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;
    return { success: false };
  }
}

module.exports = {
  nextIntervalCalculator
};
