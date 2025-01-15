import { KafkaStorage } from '../lib/kafka_storage';
import Kafka from 'node-rdkafka';
const KAFKA_URL: string = assertStringEnv(process.env.KAFKA_URL);
const KAFKA_TOPIC: string = assertStringEnv(process.env.KAFKA_TOPIC);

function assertStringEnv(stringEnv: string | undefined): string {
  if (stringEnv !== undefined) {
    return stringEnv
  }
  else {
    throw Error(`${stringEnv} ENV variable should be set `)
  }
}

class TestConsumer {
  private consumer: Kafka.KafkaConsumer;
  private num_received: number;
  private dataReadPromise: Promise<void>;
  private subscribedPromise: Promise<void>;

  constructor(topic: string, num_expected: number) {
    this.num_received = 0;

    this.consumer = new Kafka.KafkaConsumer({
      'metadata.broker.list': KAFKA_URL,
      'group.id': 'node-rdkafka-consumer-flow-example',
      'debug': 'all',
      'topic.metadata.refresh.interval.ms': 500,
      'enable.auto.commit': true,
      'isolation.level': 'read_committed'
    },
      {
        'auto.offset.reset': 'earliest', // Start reading from the earliest message
      });

    // Copying the member variables so that they are seen in the closures
    const consumer = this.consumer;
    let num_received = this.num_received;

    this.consumer.setDefaultConsumeTimeout(1000);

    this.dataReadPromise = new Promise((resolve) => {
      consumer.on('data', function (m) {
        num_received++;
        if (num_received === num_expected) {
          resolve();
        }
      });
    });

    this.subscribedPromise = new Promise<void>((resolve, reject) => {
      consumer.on('event.error', function (err) {
        console.error('Error from consumer');
        console.error(err);
        reject(err);
      });
      consumer.on('ready', function () {
        consumer.subscribe([topic]);
      });
      consumer.on('subscribed', function () {
        consumer.consume();
        resolve();
      });
    });

    this.consumer.connect();
  }

  async waitSubscribed() {
    await this.subscribedPromise;
  }

  async waitData() {
    await this.dataReadPromise;
  }

  disconnect(done: () => void) {
    this.consumer.disconnect(done);
  }
}


describe('Producer transactions', function () {
  let kafkaStorage: KafkaStorage;
  let testConsumer: TestConsumer;
  let num_messages_test = 3;

  beforeEach(function (done) {
    this.timeout(20000);

    kafkaStorage = new KafkaStorage('test-exporter', true, KAFKA_TOPIC);
    kafkaStorage.connect().then(() => {
      testConsumer = new TestConsumer(KAFKA_TOPIC, num_messages_test);
      done();
    });
  });

  afterEach(async function (done) {
    this.timeout(10000);
    await kafkaStorage.disconnect()

    testConsumer.disconnect(function () {
      done();
    });
  });

  it('should get 100% deliverability if transaction is commited', async function () {
    this.timeout(20000);

    await testConsumer.waitSubscribed();

    await kafkaStorage.initTransactions();
    await kafkaStorage.beginTransaction();

    // Do a small delay before starting writing messages, otherwise the consumer is missing them.
    // This should not really be needed, because we have received the 'subscribed' event in the
    // consumer but there is something I am missing.
    setTimeout(async function () {
      for (let i = 0; i < num_messages_test; i++) {
        kafkaStorage.sendDataWithKey({
          timestamp: 10000000,
          iso_date: new Date().toISOString(),
          key: 1
        }, 'key', null);
      }
      await kafkaStorage.commitTransaction();
    }, 2000);

    await testConsumer.waitData();
  });

  it('using the \'storeEvents\' function should begin and commit a transaction', async function () {
    // We need the huge timeout because starting and closing a transaction takes around 1 sec
    this.timeout(10000);
    await kafkaStorage.initTransactions();

    const testEvent = {
      'contract': '0xdac17f958d2ee523a2206206994597c13d831ec7',
      'blockNumber': 10449812,
      'timestamp': 0,
      'transactionHash': '0x0bdd08bd9af129373d2b8011775d3d8b0588e30f45b0f3c1b7d85d689d05c42b',
      'logIndex': 122,
      'to': '0xd49e06c1ed4925af893a503bfcb9cff947e7679e',
      'from': '0x5a5d5d0cde67e18f00e5d08ad7890858a6ee62bc',
      'value': 103000000,
      'valueExactBase36': '1pbnb4'
    };


    await testConsumer.waitSubscribed();

    setTimeout(async function () {
      for (let i = 0; i < num_messages_test; i++) {
        await kafkaStorage.storeEvents([testEvent], false);
      }
    }, 1000);

    await testConsumer.waitData();
  });

});
