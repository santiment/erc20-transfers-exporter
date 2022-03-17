/* jslint es6 */
"use strict";
const got = require('got');
const uuidv1 = require('uuid/v1')
const BaseWorker = require("../../lib/worker_base")
const constants = require("./lib/constants")
const util = require("./lib/util")
const { logger } = require('../../lib/logger')

const CARDANO_GRAPHQL_URL = process.env.CARDANO_GRAPHQL_URL || "http://localhost:3100/graphql"
const DEFAULT_TIMEOUT_MSEC = parseInt(process.env.DEFAULT_TIMEOUT || "30000")

class CardanoWorker extends BaseWorker {
  constructor() {
    super()
  }

  async sendRequest(query) {
      return await got.post(CARDANO_GRAPHQL_URL, {
        json: {
          jsonrpc: '2.0',
          id: uuidv1(),
          query: query
        },
        responseType: 'json',
        timeout: DEFAULT_TIMEOUT_MSEC
      }).json()
  }

  async getCurrentBlock() {
    const response = await this.sendRequest(`{ cardano { tip { number } } }`)

    if (response.data === null) {
      throw new Error('Error getting Cardano current block number')
    }
    return response.data.cardano.tip.number
  }

  async getGenesisTransactionsPage(offset) {
    const response = await this.sendRequest(`
    {
      transactions(
          where: {
            block: { hash: { _eq: "5f20df933584822601f9e3f8c024eb5eb252fe8cefb24d1317dc3d432e940ebb" } }
          }
          offset: ${offset}
          order_by: { includedAt: asc }
        ) {
          includedAt
          blockIndex
          fee
          hash

          block {
            number
            epochNo
            transactionsCount
          }

          inputs {
            address
            value
          }

          outputs {
            address
            value
          }
        }
      }
    `)

    if (response.data === null) {
      throw new Error(`Error getting transactions for genesis block offset: ${offset} limit: ${limit}`)
    }

    return response.data.transactions;
  }

  async getGenesisTransactions() {
    let current_offset = 0
    const transactionsMerged = []
    let transactionsBatch = []

    do {
      transactionsBatch = await this.getGenesisTransactionsPage(current_offset)
      transactionsMerged.push(...transactionsBatch)
      current_offset += transactionsBatch.length
    }
    while (transactionsBatch.length > 0)

    logger.info(`Extracted ${transactionsMerged.length} genesis transactions`)
    return transactionsMerged
  }

  // Genesis transfers have block number set to 'null'. For our computation purposes we need some block number.
  // We set it to 0.
  setBlockZeroForGenesisTransfers(transactions) {
    transactions.forEach(transaction => {
      if (transaction.block.number != null) {
        throw new Error(`Unexpected block number ${transaction.block.number} for genesis transaction
        ${transaction.hash}`)
      }
      transaction.block.number = 0
    })
  }

  async getTransactions(blockNumber, lastConfirmedBlock) {
    const response = await this.sendRequest(`
    {
      transactions(
        where: {
          block: { epoch: { number: { _is_null: false } } }
          _and: [{ block: { number: { _gte: ${blockNumber} } } },
                 { block: { number: { _lt: ${lastConfirmedBlock} } } }]
        }
        order_by: { includedAt: asc }
      ) {
        includedAt
        blockIndex
        fee
        hash

        block {
          number
          epochNo
          transactionsCount
        }

        inputs {
          address
          value
        }

        outputs {
          address
          value
        }

      }
    }`)

    if (response.data === null) {
      throw new Error(`Error getting transactions for current block number ${blockNumber}`)
    }

    return response.data.transactions;
  }

  async init() {
    this.lastConfirmedBlock = await this.getCurrentBlock() - constants.CONFIRMATIONS
  }

  async work() {
    if (this.lastExportedBlock >= this.lastConfirmedBlock - 1) {
      // We are up to date with the blockchain (aka 'current mode'). Sleep longer after finishing this loop.
      // The last confirmed block may be partial and would not be exported. Allow for one block gap.
      this.sleepTimeMsec = constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;

      // On the previous cycle we closed the gap to the head of the blockchain.
      // Check if there are new blocks now.
      const newConfirmedBlock = await this.getCurrentBlock() - constants.CONFIRMATIONS
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

    let transactions = null
    if (this.lastExportedBlock < 0) {
      transactions = await this.getGenesisTransactions();
      if (transactions.length == 0) {
        throw new Error('Error getting Cardano genesis transactions')
      }
      this.setBlockZeroForGenesisTransfers(transactions)
    }
    else {
      const fromBlock = this.lastExportedBlock + 1
      transactions = await this.getTransactions(fromBlock, this.lastConfirmedBlock)
      if (transactions.length == 0) {
        return []
      }
    }

    transactions = util.discardNotCompletedBlock(transactions)
    util.verifyAllBlocksComplete(transactions)

    for (let i = 0; i < transactions.length; i++) {
      transactions[i].primaryKey = this.lastPrimaryKey + i + 1
    }

    this.lastExportTime = Date.now()
    this.lastExportedBlock = transactions[transactions.length - 1].block.number
    this.lastPrimaryKey += transactions.length

    return transactions
  }
}



module.exports = {
  worker: CardanoWorker
}


