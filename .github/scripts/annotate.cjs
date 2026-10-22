'use strict';
// SAT-ONLINE-107: the failures of a node --test (TAP) log as GitHub error annotations, so a red check shows what failed
// on the pull request page (and in the checks API) without opening the job's log. Usage: node annotate.cjs <log file>
const fs = require('node:fs');

const lines = fs.readFileSync(process.argv[2] || 'test.log', 'utf8').split(/\r?\n/);
const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
let n = 0;
for (let i = 0; i < lines.length && n < 10; i++) {
  const m = /^(\s*)not ok \d+ - (.*)$/.exec(lines[i]);
  if (!m) continue;
  const pad = m[1].length, block = [];
  let j = i + 1;
  for (; j < lines.length; j++) {
    const l = lines[j];
    if (new RegExp('^\\s{' + pad + '}\\s{0,2}\\.\\.\\.\\s*$').test(l)) break;
    block.push(l.slice(Math.min(pad + 2, l.length - l.trimStart().length)));
  }
  i = j;
  if (block.some((l) => /failureType: 'subtestsFailed'/.test(l))) continue; // the file or a parent: its subtest is reported
  const keep = [];
  let stack = 0, inStack = false;
  for (const l of block) {
    if (/^(duration_ms|type|location|failureType|code|operator|name):/.test(l)) { inStack = false; continue; }
    if (/^stack:/.test(l)) { inStack = true; continue; }
    if (/^---$/.test(l.trim())) continue;
    if (inStack) { if (stack++ < 4) keep.push(l); continue; }
    keep.push(l);
  }
  console.log('::error title=' + esc(m[2].slice(0, 120)).replace(/[:,]/g, ' ') + '::' + esc(keep.join('\n').slice(0, 3000)));
  n++;
}
if (!n) console.log('::error title=tests failed::no "not ok" line in the log; see the step output');
