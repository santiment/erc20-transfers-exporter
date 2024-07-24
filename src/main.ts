'use strict';
import url from 'url';
import { Server, IncomingMessage, ServerResponse } from 'http'
const { send, serve } = require('micro');
const metrics = require('./lib/metrics');
import { logger } from './lib/logger';
import { KafkaStorage } from './lib/kafka_storage';
import { ZookeeperState } from './lib/zookeeper_state';
const EXPORTER_NAME = process.env.EXPORTER_NAME || 'san-chain-exporter';
import { EXPORT_TIMEOUT_MLS } from './lib/constants';
import { constructWorker } from './blockchains/construct_worker'
import { ExporterPosition } from './types'
import { BaseWorker, WorkResult, WorkResultMultiMode } from './lib/worker_base';

export class Main {
  private worker!: BaseWorker;
  private shouldWork: boolean;
  private kafkaStorage!: KafkaStorage | Map<string, KafkaStorage>;
  private zookeeperState!: ZookeeperState;
  private lastProcessedPosition!: ExporterPosition;
  private microServer: Server;
  private mergedConstants: any;

  constructor() {
    this.shouldWork = true;
    this.microServer = new Server(serve(async (request: IncomingMessage, response: ServerResponse) => {
      microHandler(request, response, this);
    }
    ))
  }

  async initExporter(exporterName: string, isTransactions: boolean, kafkaTopic: string | Map<string, string>) {
    if (typeof kafkaTopic === 'string') {
      this.kafkaStorage = new KafkaStorage(exporterName, isTransactions, kafkaTopic);
      this.zookeeperState = new ZookeeperState(exporterName, kafkaTopic);
    }
    else if (kafkaTopic instanceof Map) {
      this.kafkaStorage = new Map(Array.from(kafkaTopic, ([mode, topic]) => [mode, new KafkaStorage(exporterName, isTransactions, topic)]))
      const kafkaTopicConcat = Array.from(kafkaTopic.keys()).join('-')
      this.zookeeperState = new ZookeeperState(exporterName, kafkaTopicConcat);
    } else {
      throw new Error(`kafkaTopic variable should be either string or Map. It is: ${kafkaTopic}`);
    }


    const kafkaStoragesArray = (this.kafkaStorage instanceof Map) ? Array.from(this.kafkaStorage.values()) : [this.kafkaStorage]
    await Promise.all(kafkaStoragesArray.map(storage => storage.connect().then(() => storage.initTransactions())))
    await this.zookeeperState.connect();
  }

  async handleInitPosition() {
    const lastRecoveredPosition = await this.zookeeperState.getLastPosition();
    this.lastProcessedPosition = this.worker.initPosition(lastRecoveredPosition);
    await this.zookeeperState.savePosition(this.lastProcessedPosition);
  }

  #isWorkerSet() {
    if (this.worker) throw new Error('Worker is already set');
  }

  // Hide passwords from settings, we do not want to log authentication data.
  getSettingsWithHiddenPasswords(constants: any): any {
    let copy = JSON.parse(JSON.stringify(constants));
    if (copy.RPC_USERNAME !== undefined) {
      copy.RPC_USERNAME = "*****"
    }
    if (copy.RPC_PASSWORD !== undefined) {
      copy.RPC_PASSWORD = "*****"
    }

    return copy;
  }

  private async initWorker() {
    this.#isWorkerSet();
    logger.info(`Applying the following settings: ${JSON.stringify(this.getSettingsWithHiddenPasswords(this.mergedConstants))}`);
    this.worker = constructWorker(this.mergedConstants.BLOCKCHAIN, this.mergedConstants);
    await this.worker.init(this.kafkaStorage);
    await this.handleInitPosition();
  }

  async init(constantsBase: any) {
    if (constantsBase.BLOCKCHAIN === undefined) {
      throw Error("'BLOCKCHAIN' variable need to be defined")
    }
    const blockchainSpecificConstants = require(`./blockchains/${constantsBase.BLOCKCHAIN}/lib/constants`);
    this.mergedConstants = { ...constantsBase, ...blockchainSpecificConstants };
    await this.initExporter(EXPORTER_NAME, true, this.mergedConstants.KAFKA_TOPIC);
    await this.initWorker();
    metrics.startCollection();

    this.microServer.on('error', (err) => {
      logger.error('Monitoring Micro server failure:', err);
      process.exit(1);
    });
    this.microServer.listen(3000, () => {
      logger.info('Micro Server started on port 3000');
    });
  }

  /**
   * The metrics are intended to monitor different aspects of the exporter's work
   * such as the number of requests and the response time.
  */
  updateMetrics() {
    metrics.currentBlock.set(this.worker.lastConfirmedBlock);
    metrics.requestsCounter.inc(this.worker.getNewRequestsCount());
    metrics.requestsResponseTime.observe(Date.now() - this.worker.lastRequestStartTime);
    metrics.lastExportedBlock.set(this.worker.lastExportedBlock);
  }

  async writeDataToKafka(workResult: WorkResult | WorkResultMultiMode) {
    if (Array.isArray(workResult)) {
      if (!(this.kafkaStorage instanceof KafkaStorage)) {
        throw new Error('Worker returns data for single Kafka storage and multiple are defined')
      }

      if (workResult.length > 0) {
        await this.kafkaStorage.storeEvents(workResult, this.mergedConstants.WRITE_SIGNAL_RECORDS_KAFKA);
      }
    }
    else if (workResult instanceof Map) {
      if (!(this.kafkaStorage instanceof Map)) {
        throw new Error('Worker returns data for multiple Kafka storages and single is defined')
      }
      for (const [mode, data] of workResult.entries()) {
        const kafkaStoragePerMode = this.kafkaStorage.get(mode)
        if (!kafkaStoragePerMode) {
          throw Error(`Workers returns data for mode ${mode} and no worker is defined for this mode`)
        }

        await kafkaStoragePerMode.storeEvents(data, this.mergedConstants.WRITE_SIGNAL_RECORDS_KAFKA);
      }
    }
    else {
      throw new Error('Worker returns unexpected data type')
    }
  }

  async workLoop() {
    while (this.shouldWork) {
      this.worker.lastRequestStartTime = Date.now();
      const workResult: WorkResult | WorkResultMultiMode = await this.worker.work();

      this.worker.lastExportTime = Date.now();

      this.updateMetrics();
      this.lastProcessedPosition = this.worker.getLastProcessedPosition();

      await this.writeDataToKafka(workResult);

      await this.zookeeperState.savePosition(this.lastProcessedPosition);
      logger.info(`Progressed to position ${JSON.stringify(this.lastProcessedPosition)}, last confirmed Node block: ${this.worker.lastConfirmedBlock}`);

      if (this.shouldWork) {
        await new Promise((resolve) => setTimeout(resolve, this.worker.sleepTimeMsec));
      }
    }
  }

  async disconnect() {
    if (this.kafkaStorage instanceof KafkaStorage) {
      await this.kafkaStorage.disconnect();
    }
    else if (this.kafkaStorage instanceof Map) {
      await Promise.all(Array.from(this.kafkaStorage.values()).map(storage => storage.disconnect()));
    }
    if (this.zookeeperState) {
      await this.zookeeperState.disconnect();
    }
    if (this.microServer) {
      this.microServer.close();
    }
  }

  stop() {
    if (this.shouldWork) {
      logger.info('Triggering graceful exporter stop');
      this.shouldWork = false;
    }
    else {
      logger.info('Exiting immediately');
      process.exit();
    }
  }

  healthcheckKafka(): boolean {
    if (this.kafkaStorage instanceof KafkaStorage) {
      return this.kafkaStorage.isConnected();
    }
    else if (this.kafkaStorage instanceof Map) {
      return Array.from(this.kafkaStorage.values()).every(storage => storage.isConnected());
    }
    else {
      return false;
    }
  }

  healthcheckExportTimeout(): boolean {
    const timeFromLastExport = Date.now() - this.worker.lastExportTime;
    const isExportTimeoutExceeded = timeFromLastExport > EXPORT_TIMEOUT_MLS;
    if (isExportTimeoutExceeded) {
      logger.warn(`Time from the last export ${timeFromLastExport}ms exceeded limit ` +
        `${EXPORT_TIMEOUT_MLS}ms. Node last block is ${this.worker.lastConfirmedBlock}.`);
      return false;
    } else {
      return true;
    }
  }

  healthcheck(): boolean {
    return this.healthcheckKafka() && this.healthcheckExportTimeout();
  }
}


const microHandler = async (request: IncomingMessage, response: ServerResponse, mainInstance: Main) => {
  let requestURL: string;

  if (request.url !== undefined) {
    requestURL = request.url;
  }
  else {
    throw Error('URL needs to be set in micro call')
  }

  const req = url.parse(requestURL, true);

  switch (req.pathname) {
    case '/healthcheck':
      if (mainInstance.healthcheck()) {
        return send(response, 200, 'ok');
      }
      else {
        logger.error('Healthcheck failed');
        return send(response, 500, "Healthcheck failed");
      }
    case '/metrics':
      response.setHeader('Content-Type', metrics.register.contentType);
      return send(response, 200, await metrics.register.metrics());
    default:
      return send(response, 404, 'Not found');
  }
};



