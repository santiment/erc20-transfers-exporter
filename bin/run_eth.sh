#! /bin/sh
set -e

BLOCKCHAIN=eth docker-compose -f docker/docker-compose.yaml up --build
docker-compose -f docker/docker-compose.yaml rm -f
