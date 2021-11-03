const Web3 = require('web3')
const jayson = require('jayson/promise');
const { filterErrors } = require('blockchain-utils/eth')
const constants = require('./lib/constants')
const { logger } = require('../../lib/logger')
const { injectDAOHackTransfers, DAO_HACK_FORK_BLOCK } = require('./lib/dao_hack')
const { getGenesisTransfers } = require('./lib/genesis_transfers')
const { transactionOrder, stableSort, computeGasExpense,
  computeGasExpenseBase36 } = require('./lib/util')
const BaseWorker = require('../../lib/worker_base')
const Web3Wrapper = require('./lib/web3_wrapper')
const {decodeTransferTrace} = require('./lib/decode_transfers')


class ETHWorker extends BaseWorker {
  constructor() {
    super()

    logger.info(`Connecting to parity node ${constants.PARITY_NODE}`)
    this.web3 = new Web3(new Web3.providers.HttpProvider(constants.PARITY_NODE))
    this.web3Wrapper = new Web3Wrapper(this.web3)
    this.parityClient = jayson.client.http(constants.PARITY_NODE);
  }

  fetchEthInternalTrx(fromBlock, toBlock) {
    return this.parityClient.request('trace_filter', [{
      fromBlock: this.web3Wrapper.parseNumberToHex(fromBlock),
      toBlock: this.web3Wrapper.parseNumberToHex(toBlock)
    }]).then((data) => {
      const traces = filterErrors(data["result"])

      return traces
        .filter((trace) =>
          trace["action"]["value"] != "0x0" &&
          trace["action"]["balance"] != "0x0" &&
          !(trace["type"] == "call" && trace["action"]["callType"] != "call")
        )
    })
  }

  async fetchBlocks(fromBlock, toBlock) {
    const blockRequests = []
    for (let i = fromBlock; i <= toBlock; i++) {
      blockRequests.push(
        this.parityClient.request(
          'eth_getBlockByNumber',
          [this.web3Wrapper.parseNumberToHex(i), true],
          undefined,
          false
        )
      )
    }

    const responses = await this.parityClient.request(blockRequests);
    const result = new Map()
    responses.forEach((response, index) => result.set(fromBlock + index, response.result))
    return result
  }

  async fetchReceipts(blockNumbers) {
    const responses = []

    for (const blockNumber of blockNumbers) {
      const req = this.parityClient.request('parity_getBlockReceipts', [this.web3Wrapper.parseNumberToHex(blockNumber)], undefined, false)
      responses.push(this.parityClient.request([req]))
    }

    const finishedRequests = await Promise.all(responses)
    const result = {}

    finishedRequests.forEach((blockResponses) => {
      if (!blockResponses) return

      blockResponses.forEach((blockResponse) => {
        if (blockResponse.result) {
          blockResponse.result.forEach((receipt) => {
            result[receipt.transactionHash] = receipt
          })
        }
      })
    })

    return result
  }

  decodeTransactionsInBlock(block, receipts) {
    const result = []
    block.transactions.forEach((transaction) =>
      result.push({
        from: transaction.from,
        to: block.miner,
        value: computeGasExpense(this.web3, transaction.gasPrice, receipts[transaction.hash].gasUsed),
        valueExactBase36: computeGasExpenseBase36(this.web3, transaction.gasPrice, receipts[transaction.hash].gasUsed),
        blockNumber: this.web3Wrapper.parseHexToNumber(transaction.blockNumber),
        timestamp: this.web3Wrapper.parseHexToNumber(block.timestamp),
        transactionHash: transaction.hash,
        type: "fee"
      })
    )
    return result
  }

  async fetchTracesBlocksAndReceipts(fromBlock, toBlock) {
    logger.info(`Fetching traces for blocks ${fromBlock}:${toBlock}`)
    const [traces, blocks] = await Promise.all([
      this.fetchEthInternalTrx(fromBlock, toBlock),
      this.fetchBlocks(fromBlock, toBlock)
    ])
    logger.info(`Fetching receipts of ${fromBlock}:${toBlock}`)
    const receipts = await this.fetchReceipts(blocks.keys())

    return [traces, blocks, receipts]
  }

  async getPastEvents(fromBlock, toBlock, traces, blocks, receipts) {
    let events = []
    if (fromBlock == 0) {
      logger.info("Adding the GENESIS transfers")
      events.push(... getGenesisTransfers(this.web3))
    }

    events.push(... await this.getPastTransferEvents(traces, blocks))
    events.push(... await this.getPastTransactionEvents(blocks.values(), receipts))
    if (fromBlock <= DAO_HACK_FORK_BLOCK && DAO_HACK_FORK_BLOCK <= toBlock) {
      logger.info("Adding the DAO hack transfers")
      events = injectDAOHackTransfers(events)
    }

    return events
  }


  async getPastTransferEvents(traces, blocksMap) {
    const result = []

    for (let i = 0; i < traces.length; i++) {
      const block_timestamp = this.web3Wrapper.decodeTimestampFromBlock(blocksMap.get(traces[i]["blockNumber"]))
      result.push(decodeTransferTrace(traces[i], block_timestamp, this.web3Wrapper))
    }

    return result
  }

  async getPastTransactionEvents(blocks, receipts) {
    const result = []

    for (const block of blocks) {
      const decoded_transactions = this.decodeTransactionsInBlock(block, receipts)
      result.push(...decoded_transactions)
    }

    return result
  }

  async work() {
    if (this.lastConfirmedBlock == this.lastExportedBlock) {
      // We are up to date with the blockchain (aka 'current mode'). Sleep longer after finishing this loop.
      this.sleepTimeMsec = constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;

      // On the previous cycle we closed the gap to the head of the blockchain.
      // Check if there are new blocks now.
      const newConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS
      if (newConfirmedBlock == this.lastConfirmedBlock) {
        // The Node has not progressed
        return []
      }
      this.lastConfirmedBlock = newConfirmedBlock
    }
    else {
      // We are still catching with the blockchain (aka 'historic mode'). Do not sleep after this loop.
      this.sleepTimeMsec = 0
    }

    const toBlock = Math.min(this.lastExportedBlock + constants.BLOCK_INTERVAL, this.lastConfirmedBlock)
    const fromBlock = this.lastExportedBlock + 1

    logger.info(`Fetching transfer events for interval ${fromBlock}:${toBlock}`)
    const [traces, blocks, receipts] = await this.fetchTracesBlocksAndReceipts(fromBlock, toBlock)
    const events = await this.getPastEvents(fromBlock, toBlock, traces, blocks, receipts)

    if (events.length > 0) {
      stableSort(events, transactionOrder)
      for (let i = 0; i < events.length; i++) {
        events[i].primaryKey = this.lastPrimaryKey + i + 1
      }

      this.lastPrimaryKey += events.length
    }

    this.lastExportTime = Date.now()
    this.lastExportedBlock = toBlock

    return events
  }

  async init() {
    this.lastConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS
  }

}

module.exports = {
  worker: ETHWorker
}
