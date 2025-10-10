#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

node src/pg-schema-gen.js --sql-file ./test-files/test.sql \
    --parsed-sql-out tmp/parsed-sql.json \
    --ts-out tmp/types.ts \
    --zod-out tmp/zod.ts \
    --convo-out tmp/types.convo \
    --type-map-out tmp/type-map.json \
    --type-map-out tmp/type-map.json \
    --table-map-out tmp/table-map.json \
    --ts-table-map-out tmp/table-map.ts \
    --verbose