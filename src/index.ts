'use strict';
import { logger } from './lib/logger';
import * as constantsBase from './lib/constants';
import { getBoolEnvVariable } from './lib/utils';
import { Main } from './main'


let mainInstance: Main;

export async function main() {
  mainInstance = new Main();

  try {
    await mainInstance.init(constantsBase);
  } catch (err: any) {
    logger.error(err.stack);
    throw new Error(`Error initializing exporter: ${err.message}`);
  }
  try {
    await mainInstance.workLoop();
    await mainInstance.disconnect();
    logger.info('Bye!');
  } catch (err: any) {
    logger.error(err.stack);
    throw new Error(`Error in exporter work loop: ${err.message}`);
  }
}

if (!getBoolEnvVariable('TEST_ENV', false)) {
  process.on('SIGINT', () => {
    mainInstance.stop();
  });
  process.on('SIGTERM', () => {
    mainInstance.stop();
  });

  main();
}


