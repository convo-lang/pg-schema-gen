#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

node --inspect src/pg-schema-gen.js --sql-file ./test-files/test-2.sql --out tmp/schema --verbose