'use strict';
// QA: one shard of the regression files for the full run (.github/workflows/regression-full.yml). Usage:
// node shard.cjs <index> <count> -> the files of that shard, space-separated. The files are taken in name order and dealt
// round-robin, so every file is in exactly one shard and the same one each time.
const fs = require('node:fs');
const path = require('node:path');

const [i, n] = process.argv.slice(2).map(Number);
if (!(n >= 1 && i >= 0 && i < n)) { console.error('usage: node shard.cjs <index> <count>'); process.exit(2); }
const dir = path.join(__dirname, '..', '..', 'tests', 'regression');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.cjs')).sort();
process.stdout.write(files.filter((f, k) => k % n === i).map((f) => 'tests/regression/' + f).join(' '));
