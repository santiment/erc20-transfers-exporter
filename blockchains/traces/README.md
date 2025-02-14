# ETH Traces Exporter

A small service that exports all ETH Traces from the Ethereum blockchain to a Kafka topic. It is written in javascript and uses ![web3.js](https://github.com/ethereum/web3.js/) library which implements the Ethereum JSON RPC spec.

The script is exporting block traces and reorganizing them before they are pushed to Kafka topic.

## Running the service

To test that the exporter is running correctly use:

```bash
$ ./bin/run_traces.sh
```

## Running the tests

The 'traces' tests are discovered by Mocha test framework. To run all tests run:

```bash
$ ./bin/test.sh
```
