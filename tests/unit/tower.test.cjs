// The Tower of Wisdom (major #5): floors fit west of the Behen boxes, the tower is an instance for one, S.wis persists.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const state = fs.readFileSync(path.join(__dirname, '../../src/core/state.js'), 'utf8');

test('six floors fit between x 0 and the first Behen box (232)', () => {
  const m = html.match(/const TWF=\[([^\]]*)\],twX0=i=>(\d+)\+i\*(\d+),TWX1=(\d+)/);
  assert.ok(m, 'TWF/twX0/TWX1');
  const n = m[1].split(',').length, x0 = +m[2], step = +m[3], x1 = +m[4];
  assert.equal(n, 6);
  assert.ok(x0 + (n - 1) * step + 35 < x1, 'last floor ends before TWX1');
  assert.equal(x1, 232);
  assert.match(html, /bhX0=i=>232\+i\*66|const bhX0=i=>232/);
});

test('the tower is solo, hidden from other players, and its own zone', () => {
  assert.match(html, /const solo=\(x,y\)=>\{if\(inBh\(x,y\)\|\|inTw\(x,y\)\)return true;/);
  assert.match(html, /\|\|inTw\(P\.x,P\.y\)\|\|inTw\(r\.x,r\.y\)\)return false;/);
  assert.match(html, /return x<TWX1\*TS\?'zWisdom':'zBehen';/);
});

test('S.wis is durable and every title the tower gives is listed in the status window', () => {
  assert.match(state, /'wis',/);
  const own = html.match(/const own=\[([^\]]*)\]/)[1];
  for (const k of ['pioneer', 'bibanF', 'paint', 'echo', 'duke', 'oath', 'senses', 'beastf', 'tenth']) {
    assert.ok(own.includes("'" + k + "'"), k);
    assert.match(html, new RegExp('"tl_' + k + 'D":'), 'tl_' + k + 'D');
  }
});
