'use strict';
// (plan U380) Art provenance: every art file has a line in docs/art/provenance.json (where it comes from, its licence), and
// nothing the game ships loads an image from outside the repository: the only outside hosts are the fonts, the Firebase
// SDK, the database and the SVG namespace, each listed there.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/art/provenance.json'), 'utf8'));
const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]));
const glob = (p) => new RegExp('^' + p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');

test('every art file has its origin and licence in the provenance manifest', () => {
  const pats = M.files.map((f) => { assert.ok(f.path && f.origin && f.licence, 'a full line: ' + JSON.stringify(f)); return glob(f.path); });
  const files = [...walk('sprites-original'), ...walk('icons')];
  assert.ok(files.length > 100, 'the art is there: ' + files.length);
  assert.deepEqual(files.filter((f) => !pats.some((r) => r.test(f))), [], 'files with no line in docs/art/provenance.json');
});

test('nothing shipped loads an image from outside; every outside host is listed', () => {
  const shipped = ['index.html', 'manifest.webmanifest', ...walk('src').filter((f) => f.endsWith('.js')), ...walk('sprites-original').filter((f) => /^sprites-original\/[^/]+\.js$/.test(f))];
  const hosts = new Set(), images = [];
  for (const f of shipped) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of s.matchAll(/https?:\/\/([a-z0-9.-]+)[^\s'"`)<>]*/gi)) {
      hosts.add(m[1].toLowerCase());
      if (/\.(png|jpe?g|gif|webp|svg|ico|bmp|avif)(\?|#|$)/i.test(m[0])) images.push(f + ': ' + m[0]);
    }
  }
  assert.deepEqual(images, [], 'images from outside');
  const listed = M.external.map((e) => e.host).join(' ');
  assert.deepEqual([...hosts].filter((h) => !listed.includes(h)), [], 'outside hosts not in docs/art/provenance.json');
});
