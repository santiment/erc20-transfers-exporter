'use strict';
import { logger } from './logger';
import { KafkaStorage } from './kafka_storage';
import { ExporterPosition } from '../types'

export type WorkResult = any[]
export type WorkResultMultiMode = Map<string, WorkResult>

export class BaseWorker {
  public lastExportTime: number;
  public lastConfirmedBlock: number;
  public lastExportedBlock: number;
  public lastRequestStartTime: number;
  public lastPrimaryKey: number;
  public sleepTimeMsec: number;
  public settings: any;

  constructor(constants: any) {
    // To prevent healthcheck failing during initialization and processing first
    // part of data, we set lastExportTime to current time.
    this.lastExportTime = Date.now();
    this.lastConfirmedBlock = -1;
    this.lastExportedBlock = -1;
    this.lastRequestStartTime = 0;
    this.lastPrimaryKey = 0;
    this.sleepTimeMsec = 0;
    this.settings = constants;
  }

  /**
   * To be implemented on inheritance.
   *
   * Upon returning from the method call the implementation should have updated all the member variables of the
   * base class.
   */
  work(): Promise<WorkResult | WorkResultMultiMode> {
    throw new Error('"work" method need to be overriden');
  }
  // To be implemented on inheritance.
  async init(_storage: KafkaStorage | Map<string, KafkaStorage>) {
    throw new Error('"init" method need to be overriden');
  }

  /**
   * Should be overriden depending on blockchain implementation.
   *
   * @returns Number of new requests made towards the Node endpoint. Used for metrics purposes.
   */
  getNewRequestsCount(): number {
    return 1;
  }

  /**
   * @param {Object} Return an object that is to be stored in Zookeeper. Overwrite with the exact fields that are
   * needed to later recover position.
   */
  getLastProcessedPosition(): ExporterPosition {
    return {
      blockNumber: this.lastExportedBlock,
      primaryKey: this.lastPrimaryKey
    };
  }

  /**
   * Initialize the position from which export should start based on latest stored position in Zookeeper.
   * Would be invoked after init() above.
   *
   * Default implementation for exporters which progress per block number.
   * @param {JSON} lastProcessedPosition
   * @return {Object} The received or modified object describing the position to start from.
   */
  initPosition(lastProcessedPosition: ExporterPosition) {
    if (lastProcessedPosition) {
      logger.info(`Resuming export from position ${JSON.stringify(lastProcessedPosition)}`);
    } else {
      lastProcessedPosition = {
        blockNumber: this.settings.START_BLOCK,
        primaryKey: this.settings.START_PRIMARY_KEY
      };
      logger.info(`Initialized exporter with initial position ${JSON.stringify(lastProcessedPosition)}`);
    }
    this.lastExportedBlock = lastProcessedPosition.blockNumber;
    this.lastPrimaryKey = lastProcessedPosition.primaryKey;

    return lastProcessedPosition;
  }

  /**
   * A healthcheck metric for  theblockchain. Can be a check on the Node and/or other.
   * @returns {Promise} Promise that needs to be overriden
   */
  healthcheck() {
    return Promise.reject('healthcheck method needs to be overriden');
  }
}

