import crypto from 'crypto';
import Kafka, { ProducerGlobalConfig } from 'node-rdkafka';
import { BLOCKCHAIN } from './constants';
import { log_according_to_syslog_level, logger, SYSLOG_LOG_LEVEL } from './logger';


const ZOOKEEPER_URL: string = process.env.ZOOKEEPER_URL || 'localhost:2181';

const FORMAT_HEADER: string = 'format=json;';
const RDKAFKA_DEBUG: string | null = process.env.RDKAFKA_DEBUG || null;
const KAFKA_URL: string = process.env.KAFKA_URL || 'localhost:9092';
const KAFKA_COMPRESSION_CODEC: string = process.env.KAFKA_COMPRESSION_CODEC || 'lz4';
const KAFKA_FLUSH_TIMEOUT: number = parseInt(process.env.KAFKA_FLUSH_TIMEOUT || '10000');
const BUFFERING_MAX_MESSAGES: number = parseInt(process.env.BUFFERING_MAX_MESSAGES || '150000');
const TRANSACTIONS_TIMEOUT_MS: number = parseInt(process.env.TRANSACTIONS_TIMEOUT_MS || '60000');
const KAFKA_MESSAGE_MAX_BYTES: number = parseInt(process.env.KAFKA_MESSAGE_MAX_BYTES || '10485760');

/**
 * A class to pick partition for an event.
 */
class Partitioner {
  private hashFunction: ((value: object) => number) | null;
  private partitionCount: number = -1;

  constructor() {
    this.hashFunction = null;
  }

  async init(hashFunction: ((value: object) => number), topicName: string, producer: Kafka.Producer) {
    this.hashFunction = hashFunction;
    this.partitionCount = await this.findPartitionCount(topicName, producer);
    if (this.partitionCount <= 0) {
      throw new Error('Partition count should be > 0');
    }
  }

  async findPartitionCount(topicName: string, producer: Kafka.Producer) {
    // We depend on the producer already being connected
    logger.info(`Finding partition count for topic ${topicName}`);
    const metadata: Kafka.Metadata = await new Promise((resolve, reject) => {
      producer.getMetadata({ topic: topicName, timeout: 10000 }, (err: Kafka.LibrdKafkaError, metadata: Kafka.Metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata);
        }
      });
    });

    // Find the topic's metadata and extract the number of partitions
    const topicMetadata = metadata.topics.find(t => t.name === topicName);
    if (topicMetadata) {
      logger.info(`Topic ${topicName} is found to have ${topicMetadata.partitions.length} partitions`);
      return topicMetadata.partitions.length;
    } else {
      throw new Error(`Topic "${topicName}" not found!`);
    }
  }

  /**
   * Return partition number for the event argument
   * @param {object} event An event to be written to Kafka
   * @returns {number} A partition number chosen for this event
   */
  getPartitionNumber(event: object) {
    if (!this.hashFunction) {
      // Should be left to 'null' if we want library to choose partition for us
      throw new Error('Hash function in partitioner is not initialized');
    }

    return this.hashFunction(event) % this.partitionCount;
  }

  getPartitionCount() {
    return this.partitionCount;
  }
}

function castCompression(compression: string): 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd' {
  const validCompressions = ['none', 'gzip', 'snappy', 'lz4', 'zstd'];
  if (validCompressions.includes(compression)) {
    return compression as 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';
  }
  throw new Error(`Invalid compression value: ${compression}`);
}

export class KafkaStorage {
  private readonly exporter_name: string;
  private readonly producer: Kafka.Producer;
  private readonly topicName: string;
  private partitioner: Partitioner | null;

  constructor(exporter_name: string, transactional: boolean, topicName: string) {
    this.exporter_name = exporter_name;

    const producer_settings: ProducerGlobalConfig = {
      'metadata.broker.list': KAFKA_URL,
      'client.id': this.exporter_name,
      'compression.codec': castCompression(KAFKA_COMPRESSION_CODEC),
      'queue.buffering.max.messages': BUFFERING_MAX_MESSAGES,
      'message.max.bytes': KAFKA_MESSAGE_MAX_BYTES,
      'dr_cb': true,
      'log_level': SYSLOG_LOG_LEVEL
    };

    if (RDKAFKA_DEBUG) {
      producer_settings['debug'] = RDKAFKA_DEBUG;
    }

    this.topicName = topicName;

    if (transactional) {
      const uniqueIdentifier = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now();
      const transactionalID = `${this.topicName}-${uniqueIdentifier}-${timestamp}`;
      producer_settings['transactional.id'] = transactionalID;
      producer_settings['enable.idempotence'] = true;
    }

    this.producer = new Kafka.Producer(producer_settings);

    this.producer.on('event.log', function (log) {
      log_according_to_syslog_level(log.severity, log.fac, log.message);
    });

    this.partitioner = null;
  }

  get zookeeperPositionNode() {
    // Generally it may be an arbitrary position object, not necessarily block number. We keep this name for backward compatibility
    return `/${this.exporter_name}/${this.topicName}/block-number`;
  }

  get zookeeperTimestampNode() {
    return `/${this.exporter_name}/${this.topicName}/timestamp`;
  }

  /**
   * @returns {Promise} Promise, resolved on connection completed.
   */
  async connect(): Promise<void> {
    logger.info(`Connecting to zookeeper host ${ZOOKEEPER_URL}`);


    logger.info(`Connecting to kafka host ${KAFKA_URL}`);
    const promise_result = new Promise<void>((resolve, reject) => {
      this.producer.on('ready', () => resolve());
      this.producer.on('event.error', reject);
      // The user can provide a callback for delivery reports with the
      // dedicated method 'subscribeDeliveryReports'.
      this.producer.on('delivery-report', function (err) {
        if (err) {
          reject(err);
        }
      });
    });
    this.producer.connect();
    return promise_result;
  }

  /**
   * Disconnect from Kafka.
   * This method is completed once the callback is invoked.
   */
  async disconnect(): Promise<void> {
    if (!this.producer.isConnected()) {
      logger.info(`Producer is NOT connected to kafka host ${KAFKA_URL}`);
      return;
    }

    logger.info(`Disconnecting from kafka host ${KAFKA_URL}`);
    const promise_result = new Promise<void>((resolve, reject) => {
      this.producer.disconnect(() => resolve());
    })

    await promise_result;
  }


  async sendDataWithKey(events: object | Array<object>, keyField: string, signalRecordData: object | null) {
    const arrayEvents: Array<object> = (events.constructor !== Array) ? [events] : events

    if (signalRecordData !== null && this.partitioner === null) {
      throw new Error('Signal record logic needs partitioner');
    }

    arrayEvents.forEach((event: any) => {
      const partitionNumberPayload = this.partitioner ? this.partitioner.getPartitionNumber(event) : null;
      const eventString = typeof event === 'object' ? JSON.stringify(event) : event;
      this.producer.produce(this.topicName, partitionNumberPayload, Buffer.from(eventString), event[keyField]);
      if (signalRecordData !== null && this.partitioner !== null) {
        const signalRecordString = typeof signalRecordData === 'object' ? JSON.stringify(signalRecordData) : signalRecordData;
        for (let partitionNumber = 0; partitionNumber < this.partitioner.getPartitionCount(); ++partitionNumber) {
          if (partitionNumber !== partitionNumberPayload) {
            this.producer.produce(this.topicName, partitionNumber, Buffer.from(signalRecordString), event[keyField]);
          }
        }
      }
    });

    return new Promise<void>((resolve, reject) =>
      this.producer.flush(KAFKA_FLUSH_TIMEOUT, (err) => {
        if (err) return reject(err);
        resolve();
      })
    );
  }

  /**
   * Subscribe to delivery reports.
   * @param {Function} Callback to be invoked on message delivery.
   */
  async subscribeDeliveryReports(callback: () => void) {
    this.producer.on('delivery-report', callback);
  }

  /**
   * Unsubscribe from delivery reports, restoring the default error checking.
   */
  async unSubscribeDeliveryReports() {
    this.producer.on('delivery-report', function (err) {
      if (err) {
        throw err;
      }
    });
  }

  async initTransactions() {
    const promise = new Promise<void>((resolve, reject) => {
      this.producer.initTransactions(TRANSACTIONS_TIMEOUT_MS, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    await promise;
  }

  async storeEvents(events: object, writeSignalRecordsKafka: boolean) {
    await this.beginTransaction();
    const signalRecord: object | null = writeSignalRecordsKafka ? { 'santiment_signal_record': true } : null
    try {
      if (BLOCKCHAIN === 'utxo') {
        await this.sendDataWithKey(events, 'height', signalRecord);
      } else if (BLOCKCHAIN === 'receipts') {
        await this.sendDataWithKey(events, 'transactionHash', signalRecord);
      } else {
        await this.sendDataWithKey(events, 'primaryKey', signalRecord);
      }
      await this.commitTransaction();
    } catch (exception) {
      logger.error('Error storing data to Kafka:' + exception);
      await this.abortTransaction();
      throw exception;
    }
  }

  async beginTransaction() {
    const promise = new Promise<void>((resolve, reject) => {
      this.producer.beginTransaction((err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    await promise;
  }

  async commitTransaction() {
    const promise = new Promise<void>((resolve, reject) => {
      this.producer.commitTransaction(TRANSACTIONS_TIMEOUT_MS, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    await promise;
  }

  async abortTransaction() {
    const promise = new Promise<void>((resolve, reject) => {
      this.producer.abortTransaction(TRANSACTIONS_TIMEOUT_MS, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    await promise;
  }

  async initPartitioner(hashFunction: ((value: object) => number)) {
    // We delay the finding of the partition count so that we are sure that we have a connected producer
    this.partitioner = new Partitioner();
    await this.partitioner.init(hashFunction, this.topicName, this.producer);
  }

  isConnected(): boolean {
    return this.producer.isConnected();
  }
}

