'use strict';
// Headless test harness for the Satisfy prototype (SAT-ONLINE-001).
// Loads index.html in Chromium with a seeded Math.random and a manual frame clock,
// so the same scripted actions produce the same state on any build.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

let chromium, PW;
try {
  PW = require('playwright');
  ({ chromium } = PW);
} catch (e) {
  throw new Error('playwright is not installed. Run: npm install && npm run setup:browsers');
}

const ROOT = path.resolve(__dirname, '..', '..');
const CURRENT_HTML = process.env.SATISFY_HTML ? path.resolve(process.env.SATISFY_HTML) : path.join(ROOT, 'index.html');
// Golden/render baseline: the main commit this branch is based on. Bump it when rebasing onto a
// newer main (or set SATISFY_BASELINE=<sha> to compare with any other commit).
// R0 history: ce29772 (pre-online), 1899cdb (+ #6 CSS hotfix), 6ef0595 (+ v2 art, #5), 6295a5f (+ Patrian, AI, wider map), 3c343ec (+ town quests, Piaro balance, Guardian Knight), fe34ae0 (+ equipment, guilds, WS world state, events), daaef26 (+ companions, dragon, auction, Yatan), 7d57d5f (+ siege, Muller), 1d8ed5d (v1.22), 7e7a02b (v1.28 monster pack), e9f66b6 (v1.38 + the merges: the quest guide arrow and the harbor are drawn).
const BASELINE_SHA = process.env.SATISFY_BASELINE || 'e9f66b6fba62cb7c951ebe0953029775f7e4ac91';
// the R0 baseline (before the safe saves and ids): the characterization tests document its bugs, so they keep it when
// BASELINE_SHA moves on for the parity tests (it moved in aaa59ee, and the corrupt-save one failed since)
const R0_SHA = '34b2ea5094d6d1597b4acb67d338d99d8765b745';
const LEGACY_KEY = 'satisfy_proto_v4';
const FAKE_FIREBASE = path.join(__dirname, 'fake-firebase.js');

// Runs before the game script. Must not change gameplay, only make it reproducible.
const INIT_SCRIPT = `(() => {
  let a = 0x5eed1234 | 0;
  Math.random = function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let now = 0;
  const queue = [];
  performance.now = () => now;
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.__step = (n = 1, dt = 1000 / 60) => {
    for (let i = 0; i < n; i++) { now += dt; const cbs = queue.splice(0); for (const cb of cbs) cb(now); }
    return now;
  };
})();`;

let browserPromise = null;
function browser() {
  // SATISFY_BROWSER=firefox|webkit runs the same tests in another engine (SAT-ONLINE-107, plan U370; CI installs them)
  // Firefox gives each file:// page an origin of its own by default, so the storage seeded on the blank page would not reach the game
  const name = process.env.SATISFY_BROWSER || 'chromium';
  if (!browserPromise) browserPromise = (PW[name] || chromium).launch(name === 'firefox' ? { firefoxUserPrefs: { 'security.fileuri.strict_origin_policy': false } } : {});
  return browserPromise;
}
async function closeBrowser() {
  if (browserPromise) { const b = await browserPromise; browserPromise = null; await b.close(); }
}

// The baseline build is exported as a whole tree (git archive), because index.html loads
// sibling scripts (src/, sprites-original/) since 4533320.
function baselineHtml(sha = BASELINE_SHA) {
  const dir = path.join(os.tmpdir(), 'satisfy-baseline-' + sha.slice(0, 12));
  const file = path.join(dir, 'index.html');
  if (fs.existsSync(file)) return file;
  const archive = () => execFileSync('git', ['-C', ROOT, 'archive', '--format=tar', sha], { maxBuffer: 256 << 20 });
  let tar;
  try { tar = archive(); } catch (e) {
    try { execFileSync('git', ['-C', ROOT, 'fetch', '--depth=1', 'origin', sha], { stdio: 'ignore' }); tar = archive(); }
    catch (e2) { return null; }
  }
  const tmp = dir + '.part-' + process.pid;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  execFileSync('tar', ['-x', '-f', '-', '-C', tmp], { input: tar }); // -f -: Windows tar reads a tape device otherwise
  try { fs.renameSync(tmp, dir); } catch (e) { fs.rmSync(tmp, { recursive: true, force: true }); } // another test process won
  return fs.existsSync(file) ? file : null;
}

/**
 * Open the game in a fresh, isolated browser context.
 * @param {object} [opts]
 * @param {string} [opts.html] path to index.html (defaults to the working tree)
 * @param {Record<string,string>} [opts.storage] localStorage to seed before the game boots
 * @param {string} [opts.query] URL query, e.g. '?net=local&slot=a'
 * @param {object} [opts.ctx] reuse a context from newContext() so several pages share storage and BroadcastChannel
 */
let blank = null;
function blankUrl() {
  if (!blank) { blank = path.join(os.tmpdir(), 'satisfy-blank.html'); fs.writeFileSync(blank, '<!doctype html><title>seed</title>'); }
  return pathToFileURL(blank).href;
}

async function openGame(opts = {}) {
  const html = opts.html || CURRENT_HTML;
  const shared = !!opts.ctx;
  const ctx = opts.ctx || await newContext();
  const external = ctx.__external;
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/^Failed to load resource/.test(m.text())) return; // aborted external request, tracked in `external`
    errors.push('console: ' + m.text());
  });
  const url = pathToFileURL(html).href + (opts.query || '');
  const storage = { satisfy_lang: 'en', satisfy_tw: '0', ...(opts.storage || {}) }; // satisfy_tw: dialog lines show at once
  // Seed localStorage from an empty file:// page first (all file: URLs share one storage origin),
  // then load the game once. This used to be goto(game) + seed + reload: two full boots.
  // A page in a shared context (two tabs) keeps what the other tab stored.
  await page.goto(blankUrl());
  await page.evaluate(([st, keep]) => { if (!keep) localStorage.clear(); for (const k in st) if (st[k] != null) localStorage.setItem(k, st[k]); }, [storage, shared]);
  await page.goto(url);
  await step(page, 2);
  const g = {
    page, ctx, errors, external, html,
    step: (n, dt) => step(page, n, dt),
    mode: () => page.evaluate(() => window.__G.mode),
    storage: () => page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; }),
    eval: (fn, arg) => page.evaluate(fn, arg),
    waitMode: (want, ms) => waitMode(page, want, ms),
    reload: async () => { await page.reload(); await step(page, 2); },
    close: () => (shared ? page.close() : ctx.close()),
  };
  return g;
}

/**
 * A fresh isolated browser context with the deterministic init script and no network.
 * @param {{scripts?:string[]}} [opts] extra init scripts (paths), e.g. tests/harness/fake-firebase.js
 */
/**
 * An init script that runs the page's Date.now on a fixed moment (moving on in real time). The weather, world events and
 * sieges follow the wall clock, so a test that compares drawings or monster positions passes at any hour on this one:
 * 2026-01-05 09:40:30 UTC, clear weather, no event, no siege (SAT-ONLINE-057/062). The offset is fixed when this is
 * called, so every page of one context shares one clock.
 */
function fixedClock(at = 1767606030000) {
  return { content: `(() => { if (window.__fixedClock) return; window.__fixedClock = ${at}; const real = Date.now.bind(Date), off = ${at} - ${Date.now()}; Date.now = () => real() + off; })();` };
}

async function newContext(opts = {}) {
  const ctx = await (await browser()).newContext(opts.device || {}); // device: Playwright context options (a phone's viewport, touch)
  await ctx.addInitScript(INIT_SCRIPT);
  // every test runs on the fixed clock unless it asks for the real one (opts.clock === false): the weather, world events,
  // sieges and the National Competition follow Date.now, and failed tests by the hour (SAT-ONLINE-072). A test's own
  // H.fixedClock(at) in opts.scripts sets the time instead.
  const ownClock = (opts.scripts || []).some((s) => s && typeof s === 'object' && /window\.__fixedClock/.test(s.content || ''));
  if (opts.clock !== false && !ownClock) await ctx.addInitScript(fixedClock());
  for (const s of opts.scripts || []) await ctx.addInitScript(typeof s === 'string' ? { path: s } : s); // a file, or { content }
  // Hermetic: the game must run with no network (it only asks for Google Fonts, which may fail).
  ctx.__external = [];
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    ctx.__external.push(u);
    return route.abort();
  });
  return ctx;
}

async function step(page, n = 1, dt) { await page.evaluate(([n, dt]) => window.__step(n, dt), [n, dt]); }

// Screen transitions (fadeTo) run on real 300 ms timeouts, not frames. Waiting must not
// advance the frame clock, or the number of simulated frames (regen, hunger, NPC events)
// would depend on machine speed and break golden comparisons. Frames run only via g.step().
async function waitMode(page, want, ms = 10000) {
  const wants = Array.isArray(want) ? want : [want];
  const end = Date.now() + ms;
  let m;
  while (Date.now() < end) {
    m = await page.evaluate(() => window.__G.mode);
    if (wants.includes(m)) return m;
    await page.waitForTimeout(40);
  }
  throw new Error(`mode stayed "${m}", expected ${wants.join('|')}`);
}

const DEFAULT_LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };

async function newGame(g, look = DEFAULT_LOOK) {
  await g.eval((L) => window.__G.newGame(L), look);
  await g.waitMode('cut');
  await g.eval(() => { if (window.__G.CARD) window.__G.CARD(); });
  await g.waitMode('play');
}

async function continueGame(g) {
  await g.eval(() => window.__G.act('cont'));
  await g.waitMode('play');
}

// Durable state minus clocks that depend on how many frames ran.
const VOLATILE_S = ['playT', 'bqT', 'immT', 'fog', 'mrt', 'wv']; // fog: map cells seen, grows with every step (and baselines before it have none); mrt: wall-clock respawn times of killed monsters; wv: map layout version (4 since the map doubled, the baseline has 3)
// Random per character (SAT-ONLINE-005): S.pid and the item ids derived from it. Baseline builds only
// make a pid on a guild join, so golden/rollback comparisons drop them; tests/regression/ids.test.cjs checks them.
const IDENTITY_S = ['pid'];
async function snapshot(g) {
  return g.eval(([vol, idn]) => {
    const S = JSON.parse(JSON.stringify(window.__G.S));
    for (const k of vol) delete S[k];
    for (const k of idn) delete S[k];
    for (const it of S.items || []) delete it.iid;
    const P = window.__G.P;
    return { S, P: { x: P.x, y: P.y, hp: P.hp, mp: P.mp, st: P.st, food: P.food } };
  }, [VOLATILE_S, IDENTITY_S]);
}

module.exports = {
  ROOT, CURRENT_HTML, BASELINE_SHA, R0_SHA, LEGACY_KEY, fixedClock, FAKE_FIREBASE, DEFAULT_LOOK, VOLATILE_S, IDENTITY_S,
  openGame, newContext, closeBrowser, baselineHtml, newGame, continueGame, snapshot,
};
