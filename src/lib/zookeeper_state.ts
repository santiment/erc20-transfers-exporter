import ZookeeperClientAsync from './zookeeper_client_async';
import { logger } from './logger';


const ZOOKEEPER_URL: string = process.env.ZOOKEEPER_URL || 'localhost:2181';
const ZOOKEEPER_RETRIES: number = parseInt(process.env.ZOOKEEPER_RETRIES || '0');
const ZOOKEEPER_SPIN_DELAY: number = parseInt(process.env.ZOOKEEPER_SPIN_DELAY || '1000');
const ZOOKEEPER_SESSION_TIMEOUT: number = parseInt(process.env.ZOOKEEPER_SESSION_TIMEOUT || '30000');

const FORMAT_HEADER: string = 'format=json;';


export class ZookeeperState {
  private readonly exporter_name: string;
  private readonly topicName: string;
  private readonly zookeeperClient: ZookeeperClientAsync;


  constructor(exporter_name: string, topicName: string) {
    this.exporter_name = exporter_name;

    this.topicName = topicName;

    this.zookeeperClient = new ZookeeperClientAsync(ZOOKEEPER_URL,
      {
        sessionTimeout: ZOOKEEPER_SESSION_TIMEOUT,
        spinDelay: ZOOKEEPER_SPIN_DELAY,
        retries: ZOOKEEPER_RETRIES
      }
    );
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

    try {
      await this.zookeeperClient.connectAsync();
    }
    catch (ex) {
      console.error('Error connecting to Zookeeper: ', ex);
      throw ex;
    }
  }

  /**
   * Disconnect from Zookeeper.
  */
  async disconnect() {
    logger.info(`Disconnecting from zookeeper host ${ZOOKEEPER_URL}`);
    await this.zookeeperClient.closeAsync();
  }

  async getLastPosition() {
    if (await this.zookeeperClient.existsAsync(this.zookeeperPositionNode)) {
      const previousPosition = await this.zookeeperClient.getDataAsync(
        this.zookeeperPositionNode
      );

      try {
        if (Buffer.isBuffer(previousPosition && previousPosition.data)) {
          const value = previousPosition.data.toString('utf8');

          if (value.startsWith(FORMAT_HEADER)) {
            return JSON.parse(value.replace(FORMAT_HEADER, ''));
          } else {
            return previousPosition.data;
          }
        }
      } catch (err) {
        logger.error(err);
      }
    }

    return null;
  }

  async savePosition(position: object) {
    if (typeof position !== 'undefined') {
      const newNodeValue = Buffer.from(
        FORMAT_HEADER + JSON.stringify(position),
        'utf-8'
      );

      if (await this.zookeeperClient.existsAsync(this.zookeeperPositionNode)) {
        return this.zookeeperClient.setDataAsync(
          this.zookeeperPositionNode,
          newNodeValue
        );
      } else {
        return this.zookeeperClient.mkdirpAsync(
          this.zookeeperPositionNode,
          newNodeValue
        );
      }
    }
  }
}

