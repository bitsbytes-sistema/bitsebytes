#!/bin/bash

set -e

echo "========================================"
echo "INSTALANDO MONGODB DATABASE TOOLS"
echo "========================================"

curl -L \
  https://fastdl.mongodb.org/tools/db/mongodb-database-tools-ubuntu2404-x86_64-100.18.0.tgz \
  -o /tmp/mongodb-tools.tgz

mkdir -p /tmp/mongodb-tools

tar -xzf /tmp/mongodb-tools.tgz \
  -C /tmp/mongodb-tools \
  --strip-components=1

echo "MongoDB Database Tools instaladas."

export PATH="/tmp/mongodb-tools/bin:$PATH"

mongodump --version

echo "========================================"
echo "MONGODB TOOLS OK"
echo "========================================"