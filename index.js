/* jslint es6 */
"use strict";
const pkg = require('./package.json');
const Web3 = require('web3')
const { decodeAddress } = require('./lib/util')
const { Exporter } = require('san-exporter')
const exporter = new Exporter(pkg.name)

const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || "100")
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || "3")
const TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

const PARITY_NODE = process.env.PARITY_URL || "http://localhost:8545/";
console.info(`Connecting to parity node ${PARITY_NODE}`)
let web3 = new Web3(new Web3.providers.HttpProvider(PARITY_NODE))

let lastProcessedPosition = {
  blockNumber: parseInt(process.env.START_BLOCK || "-1"),
  primaryKey: parseInt(process.env.START_PRIMARY_KEY || "-1")
}

async function getBlockTimestamp(blockNumber) {
  const block = await web3.eth.getBlock(blockNumber)

  return block["timestamp"]
}

async function decodeEvent(event, blockTimestamps) {
  if (!event["topics"][1] || !event["topics"][2]) {
    return null
  }

  let timestamp
  if (!blockTimestamps[event["blockNumber"]]) {
    timestamp = blockTimestamps[event["blockNumber"]] = await getBlockTimestamp(event["blockNumber"])
  } else {
    timestamp = blockTimestamps[event["blockNumber"]]
  }

  return {
    from: decodeAddress(event["topics"][1]),
    to: decodeAddress(event["topics"][2]),
    value: parseFloat(web3.utils.hexToNumberString(event["data"])),
    valueExactBase36: web3.utils.toBN(event["data"]).toString(36),
    contract: event["address"].toLowerCase(),
    blockNumber: parseInt(web3.utils.hexToNumberString(event["blockNumber"])),
    timestamp: timestamp,
    transactionHash: event["transactionHash"],
    logIndex: parseInt(web3.utils.hexToNumberString(event["logIndex"]))
  }
}

async function getPastEvents(fromBlock, toBlock) {
  const blockTimestamps = {}

  let events = await web3.eth.getPastLogs({
    fromBlock: web3.utils.numberToHex(fromBlock),
    toBlock: web3.utils.numberToHex(toBlock)/*,
    topics: [TRANSFER_EVENT_TOPIC]*/
  })

  // Parity has a bug when filtering topics: https://github.com/paritytech/parity-ethereum/issues/9629
  // TODO: Revert it when they fix it
  events = events.filter(x => x.topics && x.topics.includes(TRANSFER_EVENT_TOPIC))

  const result = []
  for (let i = 0;i < events.length; i++) {
    const decodedEvent = await decodeEvent(events[i], blockTimestamps)

    if (decodedEvent) result.push(decodedEvent)
  }

  return result
}

async function work() {
  const currentBlock = await web3.eth.getBlockNumber() - CONFIRMATIONS
  console.info(`Fetching transfer events for interval ${lastProcessedPosition.blockNumber}:${currentBlock}`)

  while (lastProcessedPosition.blockNumber < currentBlock) {
    const toBlock = Math.min(lastProcessedPosition.blockNumber + BLOCK_INTERVAL, currentBlock)
    const events = await getPastEvents(lastProcessedPosition.blockNumber + 1, toBlock)

    if (events.length > 0) {
      for(let i = 0; i < events.length; i++) {
        events[i].primaryKey = lastProcessedPosition.primaryKey + i + 1
      }

      console.info(`Storing and setting primary keys ${events.length} messages for blocks ${lastProcessedPosition.blockNumber + 1}:${toBlock}`)
      
      await exporter.sendDataWithKey(events, "primaryKey")

      lastProcessedPosition.primaryKey += events.length
    }

    lastProcessedPosition.blockNumber = toBlock
    await exporter.savePosition(lastProcessedPosition)
  }
}

async function fetchEvents() {
  await work()
  .then(() => {
    console.log(`Progressed to position ${JSON.stringify(lastProcessedPosition)}`)

    // Look for new events every 30 sec
    setTimeout(fetchEvents, 30 * 1000)
  })
}

async function initLastProcessedBlock() {
  const lastPosition = await exporter.getLastPosition()

  if (lastPosition) {
    lastProcessedPosition = lastPosition
    console.info(`Resuming export from position ${JSON.stringify(lastPosition)}`)
  } else {
    await exporter.savePosition(lastProcessedPosition)
    console.info(`Initialized exporter with initial position ${JSON.stringify(lastProcessedPosition)}`)
  }
}

async function init() {
  await exporter.connect()
  await initLastProcessedBlock()
  await fetchEvents()
}

init()
