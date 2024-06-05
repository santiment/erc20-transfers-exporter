const sinon = require('sinon');
const rewire = require('rewire');
import assert from 'assert';
// For this test, presume we are creating the ETH worker
process.env.BLOCKCHAIN = 'eth';
process.env.TEST_ENV = 'true';
import { Main } from '../main';
const { Main: MainRewired } = rewire('../main');
const { main } = rewire('../index');
import { BaseWorker } from '../lib/worker_base';
import { Exporter } from '../lib/kafka_storage';
import { ETHWorker } from '../blockchains/eth/eth_worker';
import ethConstants from '../blockchains/eth/lib/constants';
import zkClientAsync from '../lib/zookeeper_client_async';


const blockchain = 'eth';
describe('Main tests', () => {
  const constants = {
    START_BLOCK: -1,
    START_PRIMARY_KEY: -1
  };

  afterEach(() => {
    sinon.restore();
  });

  it('initExporter returns error when Exporter connect() fails', async () => {
    sinon
      .stub(zkClientAsync.prototype, 'connectAsync')
      .rejects(new Error('Exporter connection failed'));

    const mainInstance = new Main();
    try {
      await mainInstance.init(blockchain);
    } catch (err) {
      if (err instanceof Error) {
        assert.strictEqual(err.message, 'Error when initializing exporter: Exporter connection failed');
      }
      else {
        assert.fail('Exception is not an instance of Error')
      }
    }
  });

  it('initExporter returns error when Exporter initTransactions() fails', async () => {
    sinon
      .stub(Exporter.prototype, 'connect')
      .resolves();

    sinon
      .stub(Exporter.prototype, 'initTransactions')
      .rejects(new Error('Exporter initTransactions failed'));

    const mainInstance = new Main();
    try {
      await mainInstance.init(blockchain);
    } catch (err) {
      if (err instanceof Error) {
        assert.strictEqual(err.message, 'Error when initializing exporter: Exporter initTransactions failed');
      }
      else {
        assert.fail('Exception is not an instance of Error')
      }
    }
  });

  it('handleInitPosition changes the lastProcessedPosition accordingly 1', async () => {
    const exporterStub = sinon.createStubInstance(Exporter);
    exporterStub.getLastPosition.returns(JSON.parse('{"blockNumber":123456,"primaryKey":0}'));

    const mainInstance = new MainRewired();
    mainInstance.exporter = exporterStub;
    mainInstance.worker = new BaseWorker(constants);

    sinon.spy(mainInstance, 'handleInitPosition');
    await mainInstance.handleInitPosition();

    assert(mainInstance.handleInitPosition.calledOnce);
    assert.strictEqual(mainInstance.lastProcessedPosition.blockNumber, 123456);
    assert.strictEqual(mainInstance.lastProcessedPosition.primaryKey, 0);
  });

  it('handleInitPosition changes the lastProcessedPosition accordingly 2', async () => {
    const exporterStub = sinon.createStubInstance(Exporter);
    exporterStub.getLastPosition.returns(null);

    const mainInstance = new MainRewired();
    mainInstance.exporter = exporterStub;
    mainInstance.worker = new BaseWorker(constants);

    sinon.spy(mainInstance, 'handleInitPosition');
    await mainInstance.handleInitPosition();

    assert(mainInstance.handleInitPosition.calledOnce);
    assert.strictEqual(mainInstance.lastProcessedPosition.blockNumber, -1);
    assert.strictEqual(mainInstance.lastProcessedPosition.primaryKey, -1);
  });

  it('handleInitPosition throws error when exporter.getLastPosition() fails', async () => {
    const exporterStub = sinon.createStubInstance(Exporter);
    exporterStub.getLastPosition.throws(new Error('Exporter getLastPosition failed'));

    const mainInstance = new Main();
    sinon.stub(mainInstance, 'exporter').value(exporterStub);
    sinon.stub(mainInstance, 'worker').value(new BaseWorker(constants));

    try {
      await mainInstance.handleInitPosition();
      assert.fail('handleInitPosition should have thrown an error');
    } catch (err) {
      if (err instanceof Error) {
        assert.strictEqual(err.message, 'Exporter getLastPosition failed');
      }
      else {
        assert.fail('Exception is not an instance of Error')
      }
    }
  });

  it('handleInitPosition throws error when exporter.savePosition() fails', async () => {
    const exporterStub = sinon.createStubInstance(Exporter);
    exporterStub.getLastPosition.returns(null);
    exporterStub.savePosition.throws(new Error('Exporter savePosition failed'));

    const mainInstance = new Main();
    sinon.stub(mainInstance, 'exporter').value(exporterStub);
    sinon.stub(mainInstance, 'worker').value(new BaseWorker(constants));

    try {
      await mainInstance.handleInitPosition();
      assert.fail('handleInitPosition should have thrown an error');
    } catch (err) {
      if (err instanceof Error) {
        assert.strictEqual(err.message, 'Exporter savePosition failed');
      }
      else {
        assert.fail('Exception is not an instance of Error')
      }
    }
  });

  it('initWorker throws error when worker is already present', async () => {
    const mainInstance = new Main();
    sinon.stub(mainInstance, 'worker').value(new BaseWorker(constants));
    try {
      await mainInstance.initWorker('eth', {});
      assert.fail('initWorker should have thrown an error');
    } catch (err) {
      if (err instanceof Error) {
        assert.strictEqual(err.message, 'Worker is already set');
      }
      else {
        assert.fail('Exception is not an instance of Error')
      }
    }
  });

  it('initWorker throws an error when worker.init() fails', async () => {
    const mainInstance = new Main();
    sinon.stub(mainInstance, 'exporter').value(new Exporter('test-exporter', true, 'topic-not-used'));

    sinon.stub(ETHWorker.prototype, 'init').rejects(new Error('Worker init failed'));

    try {
      await mainInstance.initWorker('eth', ethConstants);
      assert.fail('initWorker should have thrown an error');
    } catch (err) {
      if (err instanceof Error) {
        assert.strictEqual(err.message, 'Worker init failed');
      }
      else {
        assert.fail('Exception is not an instance of Error')
      }
    }
  });

  it('initWorker throws an error when handleInitPosition() fails', async () => {
    const mainInstance = new Main();
    sinon.stub(mainInstance, 'exporter').value(new Exporter('test-exporter', true, 'topic-not-used'));
    sinon.stub(ETHWorker.prototype, 'init').resolves();

    sinon.stub(mainInstance, 'handleInitPosition').throws(new Error('Error when initializing position'));

    try {
      await mainInstance.initWorker('eth', ethConstants);
      assert.fail('initWorker should have thrown an error');
    } catch (err) {
      if (err instanceof Error) {
        assert.strictEqual(err.message, 'Error when initializing position');
      }
      else {
        assert.fail('Exception is not an instance of Error')
      }
    }
  });

  it('initWorker success', async () => {
    const mainInstance = new MainRewired();
    mainInstance.exporter = new Exporter('test-exporter', true, 'topic-not-used');
    sinon.stub(ETHWorker.prototype, 'init').resolves();
    sinon.stub(mainInstance, 'handleInitPosition').resolves();

    await mainInstance.initWorker('eth', ethConstants);
    assert(mainInstance.handleInitPosition.calledOnce);
  });

  it('workLoop throws error when worker can\'t be initialised', async () => {
    sinon.stub(BaseWorker.prototype, 'work').rejects(new Error('Error in worker "work" method'));
    const mainInstance = new Main();
    sinon.stub(mainInstance, 'worker').value(new BaseWorker(constants));
    try {
      await mainInstance.workLoop();
      assert.fail('workLoop should have thrown an error');
    } catch (err) {
      if (err instanceof Error) {
        assert.strictEqual(err.message, 'Error in worker "work" method');
      }
      else {
        assert.fail('Exception is not an instance of Error')
      }
    }
  });

  it('workLoop throws error when storeEvents() fails', async () => {
    sinon.stub(BaseWorker.prototype, 'work').resolves([1, 2, 3]);
    sinon.stub(Main.prototype, 'updateMetrics').returns(null);
    sinon.stub(Exporter.prototype, 'storeEvents').rejects(new Error('storeEvents failed'));

    const mainInstance = new Main();
    sinon.stub(mainInstance, 'worker').value(new BaseWorker(constants));
    sinon.stub(mainInstance, 'exporter').value(new Exporter('test-exporter', true, 'topic-not-used'));
    try {
      await mainInstance.workLoop();
      assert.fail('workLoop should have thrown an error');
    } catch (err) {
      if (err instanceof Error) {
        assert.strictEqual(err.message, 'storeEvents failed');
      }
      else {
        assert.fail('Exception is not an instance of Error')
      }
    }
  });

  it('workLoop throws error when savePosition() fails', async () => {
    sinon.stub(BaseWorker.prototype, 'work').resolves([1, 2, 3]);
    sinon.stub(Main.prototype, 'updateMetrics').returns(null);
    sinon.stub(Exporter.prototype, 'storeEvents').resolves();
    sinon.stub(Exporter.prototype, 'savePosition').rejects(new Error('savePosition failed'));

    const mainInstance = new Main();
    sinon.stub(mainInstance, 'worker').value(new BaseWorker(constants));
    sinon.stub(mainInstance, 'exporter').value(new Exporter('test-exporter', true, 'topic-not-used'));

    try {
      await mainInstance.workLoop();
      assert.fail('workLoop should have thrown an error');
    } catch (err) {
      if (err instanceof Error) {
        assert.strictEqual(err.message, 'savePosition failed');
      }
      else {
        assert.fail('Exception is not an instance of Error')
      }
    }
  });
});


describe('main function', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('main function throws error when initialization fails', async () => {
    sinon.stub(Main.prototype, 'init').rejects(new Error('Main init failed'));

    try {
      await main();
      assert.fail('main function should have thrown an error');
    } catch (err) {
      if (err instanceof Error) {
        assert.strictEqual(err.message, 'Error initializing exporter: Main init failed');
      }
      else {
        assert.fail('Exception is not an instance of Error')
      }
    }
  });

  it('main function throws error when workLoop fails', async () => {
    sinon.stub(Main.prototype, 'init').resolves();
    sinon.stub(Main.prototype, 'workLoop').rejects(new Error('Main workLoop failed'));

    try {
      await main();
      assert.fail('main function should have thrown an error');
    } catch (err) {
      if (err instanceof Error) {
        assert.strictEqual(err.message, 'Error in exporter work loop: Main workLoop failed');
      }
      else {
        assert.fail('Exception is not an instance of Error')
      }
    }
  });

  it('main function throws error when disconnecting fails', async () => {
    sinon.stub(Main.prototype, 'init').resolves();
    sinon.stub(Main.prototype, 'workLoop').resolves();
    sinon.stub(Main.prototype, 'disconnect').rejects(new Error('Main disconnect failed'));

    try {
      await main();
      assert.fail('main function should have thrown an error');
    } catch (err) {
      if (err instanceof Error) {
        assert.strictEqual(err.message, 'Error in exporter work loop: Main disconnect failed');
      }
      else {
        assert.fail('Exception is not an instance of Error')
      }
    }
  });

  it('main function works', async () => {
    const initStub = sinon.stub(Main.prototype, 'init').resolves();
    const workLoopStub = sinon.stub(Main.prototype, 'workLoop').resolves();
    const disconnectStub = sinon.stub(Main.prototype, 'disconnect').resolves();

    await main();

    sinon.assert.calledOnce(initStub);
    sinon.assert.calledOnce(workLoopStub);
    sinon.assert.calledOnce(disconnectStub);
  });
}

);
