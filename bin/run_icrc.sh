#! /bin/sh
set -e

BLOCKCHAIN=icrc NODE_URL=https://icrc-rosetta-ckbtc.santiment.net CKBTC_NODE_URL=https://icrc-rosetta-ckbtc.santiment.net CKETH_NODE_URL=https://icrc-rosetta-cketh.santiment.net CKUSDC_NODE_URL=https://icrc-rosetta-ckusdc.santiment.net CKUSDT_NODE_URL=https://icrc-rosetta-ckusdt.santiment.net docker compose -f docker/docker-compose.yaml up --build
docker compose -f docker/docker-compose.yaml rm -f
