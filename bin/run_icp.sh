#! /bin/sh
set -e

BLOCKCHAIN=icp NODE_URL=https://icp-rosetta-backup.santiment.net docker compose -f docker/docker-compose.yaml up --build
docker compose -f docker/docker-compose.yaml rm -f
