#!/bin/bash

set -e

echo "========================================"
echo "INSTALANDO MONGODB DATABASE TOOLS"
echo "========================================"

TOOLS_DIR="$(pwd)/mongodb-tools"

rm -rf "$TOOLS_DIR"

mkdir -p "$TOOLS_DIR"

curl -L \
  https://fastdl.mongodb.org/tools/db/mongodb-database-tools-ubuntu2404-x86_64-100.18.0.tgz \
  -o /tmp/mongodb-tools.tgz

tar -xzf /tmp/mongodb-tools.tgz \
  -C "$TOOLS_DIR" \
  --strip-components=1

echo "MongoDB Database Tools instaladas em:"
echo "$TOOLS_DIR/bin"

"$TOOLS_DIR/bin/mongodump" --version

echo "========================================"
echo "MONGODB TOOLS OK"
echo "========================================"