'use strict';
// SAT-ONLINE-102 (plan U369, U021): the Realtime Database rules in backend/database.rules.json, evaluated in Node. This is
// the real file, not the fake's hand-written copy, so a test here checks what Firebase will be told.
//
// What it models (Firebase RTDB security rules):
// - .read and .write cascade. Access to a location is granted if a rule on the location or on any ancestor grants it.
//   A write that no rule on its path grants is still allowed when every location it changes beneath is granted further down.
// - .validate runs, after a write is granted, on every location the write leaves with data: the written location and
//   everything under it. It does not cascade, and a location left empty is not validated.
// - A literal key's rules take precedence over a $wildcard's; the wildcard binds $name to the key.
// - In expressions: auth (null or {uid}), now, root/data/newData snapshots (child, parent, val, exists, hasChild,
//   hasChildren, isNumber, isString, isBoolean), and the string methods beginsWith, endsWith, contains, matches,
//   toLowerCase, toUpperCase, replace, length. == and != compare as === and !==, as in the rules language.
// - An expression that fails (null.length, a missing method) is false, as Firebase treats a rule that errors.
// - A server timestamp ({'.sv': 'timestamp'}) is `now` in newData and in what is stored.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RULES_FILE = path.join(__dirname, '..', '..', 'backend', 'database.rules.json');
const SV = { '.sv': 'timestamp' };

const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const segs = (p) => String(p || '').split('/').filter(Boolean);

function getAt(tree, ss) { let o = tree; for (const s of ss) { if (!isObj(o) || !(s in o)) return null; o = o[s]; } return o === undefined ? null : o; }
// a node with no data is no node: empty objects go, as the database never stores them
function prune(o) {
  if (!isObj(o)) return o;
  for (const k of Object.keys(o)) { const v = prune(o[k]); if (v === null || v === undefined || (isObj(v) && !Object.keys(v).length)) delete o[k]; else o[k] = v; }
  return o;
}
function resolveSV(v, now) {
  if (isObj(v) && v['.sv'] === 'timestamp' && Object.keys(v).length === 1) return now;
  if (isObj(v)) { const o = {}; for (const k in v) o[k] = resolveSV(v[k], now); return o; }
  return v;
}
function setAt(tree, ss, v) {
  if (!ss.length) return isObj(v) ? clone(v) : {};
  if (!isObj(tree)) tree = {};
  let o = tree;
  for (let i = 0; i < ss.length - 1; i++) { if (!isObj(o[ss[i]])) o[ss[i]] = {}; o = o[ss[i]]; }
  if (v === null) delete o[ss[ss.length - 1]]; else o[ss[ss.length - 1]] = clone(v);
  return tree;
}

// a read-only view of one location, as rules see it
class Snap {
  constructor(tree, ss) { this.t = tree; this.ss = ss; }
  val() { const v = getAt(this.t, this.ss); return v === undefined ? null : v; }
  child(k) { return new Snap(this.t, this.ss.concat(segs(String(k)))); }
  parent() { return new Snap(this.t, this.ss.slice(0, -1)); }
  exists() { const v = this.val(); return v !== null && !(isObj(v) && !Object.keys(v).length); }
  hasChild(k) { return this.child(k).exists(); }
  hasChildren(ks) { const v = this.val(); if (!isObj(v)) return false; return ks === undefined ? Object.keys(v).length > 0 : ks.every((k) => this.child(k).exists()); }
  isNumber() { return typeof this.val() === 'number'; }
  isString() { return typeof this.val() === 'string'; }
  isBoolean() { return typeof this.val() === 'boolean'; }
  getPriority() { return null; }
}

// == and != as === and !== (outside strings and regexes)
function strictEq(expr) {
  let out = '', i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === "'" || c === '"') { let j = i + 1; while (j < expr.length && expr[j] !== c) j += expr[j] === '\\' ? 2 : 1; out += expr.slice(i, j + 1); i = j + 1; continue; }
    if (c === '/' && /[(,]\s*$/.test(out)) { let j = i + 1; while (j < expr.length && expr[j] !== '/') j += expr[j] === '\\' ? 2 : 1; out += expr.slice(i, j + 1); i = j + 1; continue; }
    if ((c === '=' || c === '!') && expr[i + 1] === '=' && expr[i + 2] !== '=') { out += c + '=='; i += 2; continue; }
    if ((c === '=' || c === '!') && expr[i + 1] === '=' && expr[i + 2] === '=') { out += c + '=='; i += 3; continue; }
    out += c; i++;
  }
  return out;
}

const ctx = vm.createContext({});
vm.runInContext(`String.prototype.beginsWith = String.prototype.startsWith; String.prototype.contains = String.prototype.includes;
  String.prototype.matches = function (r) { return r.test(String(this)); };`, ctx);
const compiled = new Map();
function evalExpr(expr, env) {
  if (expr === true || expr === false) return expr;
  let fn = compiled.get(expr);
  if (!fn) {
    const vars = [...new Set((expr.match(/\$[A-Za-z0-9_]+/g) || []))];
    fn = vm.runInContext(`(function (auth, now, root, data, newData${vars.map((v) => ', ' + v).join('')}) { return (${strictEq(expr)}); })`, ctx);
    fn.vars = vars;
    compiled.set(expr, fn);
  }
  try { return fn(env.auth, env.now, env.root, env.data, env.newData, ...fn.vars.map((v) => env.vars[v])) === true; } catch (e) { return false; }
}

// the rule nodes on a path: [{node, depth, vars}] from the root down, as long as a rule node matches
function chain(rules, ss) {
  const out = [{ node: rules, depth: 0, vars: {} }];
  let node = rules, vars = {};
  for (let i = 0; i < ss.length; i++) {
    const k = ss[i];
    let next = isObj(node[k]) && k[0] !== '$' && k[0] !== '.' ? node[k] : null;
    if (!next) { const w = Object.keys(node).find((x) => x[0] === '$'); if (w) { next = node[w]; vars = Object.assign({}, vars, { [w]: k }); } }
    if (!next) break;
    node = next;
    out.push({ node, depth: i + 1, vars });
  }
  return out;
}

function load(file = RULES_FILE) { return JSON.parse(fs.readFileSync(file, 'utf8')).rules; }

/**
 * Whether a multi-location update (or a set, as one path) is allowed.
 * @param {object} rules the "rules" object
 * @param {object} state the database before, as one nested object
 * @param {object} update {path: value|null}
 * @param {{auth?:{uid:string}|null, now?:number}} who
 * @returns {{ok:boolean, granted:boolean, why?:string, after?:object}} granted: the .write rules let it through (valid or not)
 */
function write(rules, state, update, who = {}) {
  const now = who.now != null ? who.now : Date.now(), auth = who.auth || null;
  const before = clone(state || {}) || {};
  let after = clone(before);
  for (const p of Object.keys(update)) after = setAt(after, segs(p), resolveSV(update[p], now));
  after = prune(after);
  const rootS = new Snap(before, []);
  const env = (vars, ss) => ({ auth, now, root: rootS, data: new Snap(before, ss), newData: new Snap(after, ss), vars });
  // a write at ss: granted on its path, or else every changed location beneath is
  function granted(ss) {
    const ch = chain(rules, ss);
    for (const c of ch) if ('.write' in c.node && evalExpr(c.node['.write'], env(c.vars, ss.slice(0, c.depth)))) return true;
    if (ch.length <= ss.length) return false; // no rules down to here: nothing below can grant
    const o = getAt(before, ss), n = getAt(after, ss);
    if (!isObj(o) && !isObj(n)) return false;
    const ks = new Set([...Object.keys(isObj(o) ? o : {}), ...Object.keys(isObj(n) ? n : {})]);
    let any = false;
    for (const k of ks) { if (JSON.stringify(getAt(before, ss.concat(k))) === JSON.stringify(getAt(after, ss.concat(k)))) continue; any = true; if (!granted(ss.concat(k))) return false; }
    return any;
  }
  function valid(ss) {
    const v = getAt(after, ss);
    if (v === null) return null;
    const ch = chain(rules, ss), c = ch[ch.length - 1];
    if (ch.length === ss.length + 1) {
      if ('.validate' in c.node && !evalExpr(c.node['.validate'], env(c.vars, ss))) return '/' + ss.join('/') + ' .validate';
    } else return null; // no rule node here: nothing below is validated
    if (isObj(v)) for (const k of Object.keys(v)) { const e = valid(ss.concat(k)); if (e) return e; }
    return null;
  }
  for (const p of Object.keys(update)) if (!granted(segs(p))) return { ok: false, granted: false, why: p + ' .write' };
  for (const p of Object.keys(update)) { const e = valid(segs(p)); if (e) return { ok: false, granted: true, why: e }; }
  return { ok: true, granted: true, after };
}

/** The depth of the first rule on `p`'s own path (the location or above it) whose .write lets `update` through, or -1. */
function grantedAbove(rules, state, update, p, who = {}) {
  const now = who.now != null ? who.now : Date.now(), auth = who.auth || null, ss = segs(p);
  const before = clone(state || {}) || {};
  let after = clone(before);
  for (const q of Object.keys(update)) after = setAt(after, segs(q), resolveSV(update[q], now));
  after = prune(after);
  for (const c of chain(rules, ss)) if ('.write' in c.node && evalExpr(c.node['.write'], { auth, now, root: new Snap(before, []), data: new Snap(before, ss.slice(0, c.depth)), newData: new Snap(after, ss.slice(0, c.depth)), vars: c.vars })) return c.depth;
  return -1;
}

/** Whether a read of `p` is allowed (a grant on the path; rules beneath don't help). */
function read(rules, state, p, who = {}) {
  const now = who.now != null ? who.now : Date.now(), auth = who.auth || null, ss = segs(p), t = state || {};
  for (const c of chain(rules, ss)) if ('.read' in c.node && evalExpr(c.node['.read'], { auth, now, root: new Snap(t, []), data: new Snap(t, ss.slice(0, c.depth)), newData: null, vars: c.vars })) return true;
  return false;
}

module.exports = { load, write, read, grantedAbove, chain, evalExpr, strictEq, SV, RULES_FILE };
