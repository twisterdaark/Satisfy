'use strict';
// SAT-ONLINE-029 (owner feedback #1): one unique player name per account, taken first come first served.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const { account: A } = loadModules('src/net/account.js');

// one database shared by several accounts, with the handles/ write rule: a taken name can't be written by another uid
function db() {
  const data = new Map();
  const sdkFor = (uid) => ({ db: {}, m: { database: {
    ref: (d, path) => ({ path }),
    serverTimestamp: () => ({ '.sv': 'timestamp' }),
    get: (r) => Promise.resolve({ val: () => (data.has(r.path) ? JSON.parse(JSON.stringify(data.get(r.path))) : null) }),
    set: (r, v) => {
      const cur = data.get(r.path);
      if (r.path.startsWith('handles/') && cur && cur.uid !== uid) return Promise.reject(Object.assign(new Error('denied'), { code: 'PERMISSION_DENIED' }));
      data.set(r.path, v); return Promise.resolve();
    },
    remove: (r) => { const cur = data.get(r.path); if (cur && cur.uid && cur.uid !== uid) return Promise.reject(new Error('denied')); data.delete(r.path); return Promise.resolve(); },
  } } });
  return { data, sdkFor };
}

test('names: 3-16 letters, digits or _; the key is the lower case', () => {
  for (const ok of ['Grid', 'abc', 'A_1', 'x'.repeat(16)]) assert.ok(A.valid(ok), ok);
  for (const bad of ['ab', 'x'.repeat(17), 'with space', 'جريد', 'a.b', '', null]) assert.ok(!A.valid(bad), String(bad));
  assert.equal(A.keyOf('GrId_9'), 'grid_9');
});

test('take a name, see it taken by others (any case), rename and free the old one', async () => {
  const { data, sdkFor } = db();
  const a = A.create(sdkFor('ua'), 'ua'), b = A.create(sdkFor('ub'), 'ub');
  assert.equal(await a.load(), null);
  assert.equal(await a.check('Grid'), 'free');
  assert.equal(await a.claim('Grid'), 'Grid');
  assert.equal(await a.load(), 'Grid');
  assert.deepEqual(data.get('handles/grid').uid, 'ua');
  assert.equal(await b.check('GRID'), 'taken');
  assert.equal(await a.check('grid'), 'mine');
  await assert.rejects(b.claim('grid'), (e) => e.code === 'taken');
  await assert.rejects(b.claim('no way'), (e) => e.code === 'bad');
  assert.equal(await a.claim('Grid2', 'Grid'), 'Grid2');
  assert.equal(data.has('handles/grid'), false, 'the old name is free again');
  assert.equal(await b.claim('Grid'), 'Grid');
  assert.equal(await b.load(), 'Grid');
});

test('a race for one name: the second write is refused and reported as taken', async () => {
  const { sdkFor } = db();
  const a = A.create(sdkFor('ua'), 'ua'), b = A.create(sdkFor('ub'), 'ub');
  const [ra, rb] = await Promise.allSettled([a.claim('Same'), b.claim('Same')]);
  assert.equal([ra, rb].filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal([ra, rb].find((r) => r.status === 'rejected').reason.code, 'taken');
});
