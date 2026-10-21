/* Satisfy — player-to-player trade without a game server (SAT-ONLINE-039, owner 2026-10-19).
 *
 * Flow: ask → accept → both edit their offer (gold and bag items) → both Accept → both Confirm → one swap in the database.
 *   trade.ask      A asks B (both visible, within C.R); A has already created trades/{id} = {a, b}
 *   trade.accept / trade.decline
 *   trade.cancel   either side, any time before the swap (also: walking apart, going away, IDLE_MS)
 * Every message carries payload.to (recipient uid) and payload.trade (trade id).
 *
 * Each side writes only its own offer, tradeSides/{id}/{uid} = {g, it: {iid: item JSON}, rev, acc, conf}. Any change to
 * an offer bumps its rev and clears that side's acc/conf; a side that sees the other's rev change clears its own too.
 * Accept and Confirm record the other side's rev they agree to (acc, conf), so an agreement is always about one exact
 * offer. When both have confirmed each other's current rev, the swap is ONE multi-path database update (store.commit):
 * tradeDone/{id} (write-once) plus tradedItems/{iid} = {o: new owner, t: id} for every item, keyed by the item's unique
 * id. The rules accept a ledger entry only from that trade, only for an item its giver offered, and only when the item
 * isn't recorded as someone else's: so an item can't be traded twice (a reloaded old save still has it, but the ledger
 * says it left). The update is all or nothing; when tradeDone appears each side applies the swap to its own save once.
 *
 * Not cheat-proof yet (owner): gold has no ledger, and a modified client could offer what it doesn't have. A game
 * server (D3) closes that later.
 *
 * Exposes `Satisfy.trade.create({ presence, uid, now?, store, pos, bag, gold, blocked? })`.
 *   store: { create(id, a, b), side(id, uid, offer), watch(id, uid, cb) -> off, read(id, uid), watchDone(id, cb) -> off,
 *            commit(id, by, a, b, offerA, offerB) }: promises; Satisfy.firebase.tradeStore(sdk) is the database one.
 *   bag(): the items the local player may give, [{iid, json}]; gold(): the gold it has.
 */
(function (root) {
  'use strict';

  var C = Object.freeze({ R: 64, KEEP_R: 160, ASK_MS: 30000, IDLE_MS: 300000, GONE_MS: 6000, MAX_ITEMS: 8, ITEM_MAX: 600, GOLD_MAX: 1000000000, COMMIT_WAIT_MS: 3000, REJECT_MS: 1500, CHECK_MS: 400 });
  var TYPES = ['trade.ask', 'trade.accept', 'trade.decline', 'trade.cancel'];
  var ID_RE = /^t_[A-Za-z0-9_-]{1,60}$/, IID_RE = /^it_[a-z0-9_]{4,40}_\d+$/;

  // an offer as stored: g, it, rev, acc, conf; anything else (or a bad one) reads as nothing offered
  function cleanOffer(v) {
    if (!v || typeof v !== 'object') return null;
    var o = { g: Math.max(0, Math.min(C.GOLD_MAX, Math.floor(+v.g || 0))), it: {}, rev: +v.rev | 0, acc: Number.isInteger(v.acc) ? v.acc : -1, conf: Number.isInteger(v.conf) ? v.conf : -1 };
    var it = v.it && typeof v.it === 'object' ? v.it : {}, n = 0;
    for (var k in it) if (IID_RE.test(k) && typeof it[k] === 'string' && it[k].length <= C.ITEM_MAX && n < C.MAX_ITEMS) { o.it[k] = it[k]; n++; }
    return o;
  }
  function agreed(a, b) { return !!a && !!b && a.acc === b.rev && b.acc === a.rev; }
  function confirmed(a, b) { return agreed(a, b) && a.conf === b.rev && b.conf === a.rev; }

  function create(o) {
    var P = o.presence, self = o.uid, now = o.now || function () { return Date.now(); }, store = o.store;
    var pos = o.pos, bag = o.bag, gold = o.gold, blocked = o.blocked || function () { return false; };
    var listeners = [], asks = new Map(), seq = 0;
    var T = null; // the current trade: {id, foe, handle, a, b, phase: asking|open|done, mine, theirs, since, seen, offs, waitT}

    function emit(e) { for (var i = 0; i < listeners.length; i++) { try { listeners[i](e); } catch (x) { /* ignore */ } } }
    function byUid(uid) { var hit = null; P.remotes().forEach(function (r) { if (r.uid === uid) hit = r; }); return hit; }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function send(type, to, id) { P.send(type, { to: to, trade: id }); }
    function newId() { return 't_' + String(self).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 24) + '_' + Math.floor(now()).toString(36) + (++seq).toString(36); }
    function close(type, why, tell) {
      if (!T) return;
      if (tell) send('trade.cancel', T.foe, T.id);
      (T.offs || []).forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
      var was = T; T = null;
      emit({ type: type, why: why || '', handle: was.handle });
    }
    function writeMine() { if (T && T.phase === 'open') store.side(T.id, self, T.mine).catch(function () { close('failed', 'write', true); }); }
    function changed() { if (!T) return; T.mine.rev++; T.mine.acc = -1; T.mine.conf = -1; T.since = now(); writeMine(); emit({ type: 'changed' }); }
    // the offer follows the bag: an item sold, dropped or changed meanwhile, or gold spent, changes the offer (so the accepts
    // reset) instead of handing over something that is no longer there
    function recheck() {
      var have = {}, ch = false, k;
      (bag() || []).forEach(function (x) { have[x.iid] = x.json; });
      for (k in T.mine.it) {
        if (have[k] === T.mine.it[k]) continue;
        if (typeof have[k] === 'string' && have[k].length <= C.ITEM_MAX) T.mine.it[k] = have[k]; else delete T.mine.it[k];
        ch = true;
      }
      var g = Math.max(0, Math.floor(gold() || 0));
      if (T.mine.g > g) { T.mine.g = g; ch = true; }
      if (ch) changed();
    }
    function open() {
      T.phase = 'open'; T.since = now(); T.seen = now();
      T.mine = { g: 0, it: {}, rev: 1, acc: -1, conf: -1 }; T.theirs = null;
      writeMine();
      T.offs = [
        store.watch(T.id, T.foe, function (v) {
          if (!T || T.phase !== 'open') return;
          var th = cleanOffer(v);
          if (th && (!T.theirs || th.rev !== T.theirs.rev) && (T.mine.acc !== -1 || T.mine.conf !== -1)) { T.mine.acc = -1; T.mine.conf = -1; writeMine(); }
          T.theirs = th; T.since = now();
          emit({ type: 'changed' });
          maybeCommit();
        }),
        store.watchDone(T.id, function (v) { if (v && T && T.phase === 'open') finish(); }),
      ];
      emit({ type: 'open', handle: T.handle });
    }
    // the swap is in the database: read both offers as they were confirmed (no offer can change after tradeDone), then
    // let the game apply them once
    function finish() {
      var t = T; t.phase = 'done';
      (t.offs || []).forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
      Promise.all([store.read(t.id, self), store.read(t.id, t.foe)]).then(function (v) {
        if (T === t) T = null;
        emit({ type: 'done', give: cleanOffer(v[0]) || t.mine, get: cleanOffer(v[1]) || t.theirs || { g: 0, it: {} }, handle: t.handle, id: t.id, foe: t.foe });
      }, function () { if (T === t) T = null; emit({ type: 'failed', why: 'read', handle: t.handle }); });
    }
    function maybeCommit() {
      if (!T || T.phase !== 'open' || !confirmed(T.mine, T.theirs)) { if (T) T.waitT = 0; return; }
      // one side writes the swap: the lower uid at once, the other only if nothing happened for COMMIT_WAIT_MS
      if (self < T.foe) commit(); else if (!T.waitT) T.waitT = now();
    }
    function commit() {
      if (!T || T.committing) return;
      var t = T, A = t.a === self ? t.mine : t.theirs, B = t.a === self ? t.theirs : t.mine;
      t.committing = true;
      store.commit(t.id, self, t.a, t.b, A, B).then(function () { t.committing = false; }, function () {
        t.committing = false;
        if (T !== t || t.phase !== 'open') return; // the other side's update won: tradeDone will arrive
        // refused: someone changed meanwhile, or an item is no longer the giver's (the ledger says it left). Unless the
        // swap shows up after all (the other side's update), tick() ends the trade REJECT_MS later.
        t.rejectedAt = now();
      });
    }

    P.on(function (ev) {
      if (ev.type !== 'message') return;
      var env = ev.env, pl = env.payload || {};
      if (TYPES.indexOf(env.type) < 0 || pl.to !== self || typeof pl.trade !== 'string' || !ID_RE.test(pl.trade)) return;
      var from = P.get(ev.sid);
      if (!from || !from.uid) return;
      var mine = T && T.id === pl.trade && T.foe === from.uid;
      switch (env.type) {
        case 'trade.ask':
          if (blocked(from.uid)) return;
          if (T) { send('trade.decline', from.uid, pl.trade); return; }
          asks.set(pl.trade, { trade: pl.trade, from: from.uid, handle: from.handle || '', t: now() });
          emit({ type: 'ask', trade: pl.trade, handle: from.handle || '' });
          break;
        case 'trade.accept':
          if (mine && T.phase === 'asking') open();
          break;
        case 'trade.decline':
          if (mine && T.phase === 'asking') close('declined', '', false);
          break;
        case 'trade.cancel':
          asks.delete(pl.trade);
          if (mine && T.phase !== 'done') close('cancelled', 'them', false);
          break;
      }
    });

    var api = {
      /** Ask a visible remote player to trade. Returns 'sent' or why not: bad, busy, far. */
      ask: function (r) {
        if (!r || !r.uid || r.uid === self) return 'bad';
        if (T) return 'busy';
        if (dist(pos(), r) > C.R) return 'far';
        var id = newId();
        T = { id: id, foe: r.uid, handle: r.handle || '', a: self, b: r.uid, phase: 'asking', since: now(), seen: now() };
        var t = T;
        store.create(id, self, r.uid).then(function () { if (T === t) send('trade.ask', r.uid, id); }, function () { if (T === t) close('failed', 'create', false); });
        return 'sent';
      },
      pendingAsk: function () { var best = null; asks.forEach(function (v) { if (!best || v.t > best.t) best = v; }); return best; },
      accept: function (id) {
        var a = asks.get(id);
        if (!a || T) return false;
        asks.clear();
        T = { id: id, foe: a.from, handle: a.handle, a: a.from, b: self, phase: 'open', since: now(), seen: now() };
        send('trade.accept', a.from, id);
        open();
        return true;
      },
      decline: function (id) { var a = asks.get(id); if (!a) return false; asks.delete(id); send('trade.decline', a.from, id); return true; },
      /** Offer this much gold (whole, at most what you have). */
      setGold: function (n) {
        if (!T || T.phase !== 'open') return false;
        var g = Math.max(0, Math.min(Math.floor(+n || 0), Math.floor(gold() || 0), C.GOLD_MAX));
        if (g === T.mine.g) return true;
        T.mine.g = g; changed(); return true;
      },
      /** Put a bag item in, or take it out again. Returns false for an item you can't give or a full offer. */
      toggle: function (iid) {
        if (!T || T.phase !== 'open') return false;
        if (T.mine.it[iid]) { delete T.mine.it[iid]; changed(); return true; }
        var it = (bag() || []).find(function (x) { return x.iid === iid; });
        if (!it || !IID_RE.test(iid) || typeof it.json !== 'string' || it.json.length > C.ITEM_MAX || Object.keys(T.mine.it).length >= C.MAX_ITEMS) return false;
        T.mine.it[iid] = it.json; changed(); return true;
      },
      /** Agree to the other offer as it is now. Pressing it again takes the agreement back. */
      acceptOffer: function () {
        if (!T || T.phase !== 'open' || !T.theirs) return false;
        if (T.mine.acc === T.theirs.rev) { T.mine.acc = -1; T.mine.conf = -1; } else T.mine.acc = T.theirs.rev;
        writeMine(); emit({ type: 'changed' }); return true;
      },
      /** Final yes, once both have accepted each other's current offer. */
      confirm: function () {
        if (!T || T.phase !== 'open' || !agreed(T.mine, T.theirs)) return false;
        // the offer must still be possible: the gold and every item are still ours
        if (T.mine.g > (gold() || 0)) return false;
        var have = {}; (bag() || []).forEach(function (x) { have[x.iid] = 1; });
        for (var k in T.mine.it) if (!have[k]) return false;
        T.mine.conf = T.theirs.rev; writeMine(); emit({ type: 'changed' }); maybeCommit(); return true;
      },
      cancel: function () { if (T && T.phase !== 'done') close('cancelled', 'me', true); },
      /** Expire asks; cancel when the other walks away or goes; the fallback commit. Call about once per frame. */
      tick: function () {
        var t = now();
        asks.forEach(function (v, k) { if (t - v.t > C.ASK_MS) asks.delete(k); });
        if (!T || T.phase === 'done') return;
        if (T.phase === 'asking' && t - T.since > C.ASK_MS) { close('cancelled', 'timeout', true); return; }
        var r = byUid(T.foe);
        if (r) { T.seen = t; if (dist(pos(), r) > C.KEEP_R) { close('cancelled', 'far', true); return; } }
        else if (t - T.seen > C.GONE_MS) { close('cancelled', 'gone', true); return; }
        if (t - T.since > C.IDLE_MS) { close('cancelled', 'timeout', true); return; }
        if (T.phase === 'open' && T.rejectedAt && t - T.rejectedAt > C.REJECT_MS) { close('failed', 'rejected', true); return; }
        if (T.phase === 'open' && !T.committing && t - (T.chkT || 0) >= C.CHECK_MS) { T.chkT = t; recheck(); }
        if (T.phase === 'open' && T.waitT && confirmed(T.mine, T.theirs) && t - T.waitT > C.COMMIT_WAIT_MS) { T.waitT = t; commit(); }
      },
      state: function () {
        if (!T) return { phase: 'idle' };
        return { phase: T.phase, id: T.id, foe: T.foe, handle: T.handle, mine: T.mine || null, theirs: T.theirs || null,
          accepted: !!(T.mine && T.theirs && T.mine.acc === T.theirs.rev), theyAccepted: !!(T.mine && T.theirs && T.theirs.acc === T.mine.rev),
          confirmed: !!(T.mine && T.theirs && T.mine.conf === T.theirs.rev), theyConfirmed: !!(T.mine && T.theirs && T.theirs.conf === T.mine.rev),
          canConfirm: !!(T.mine && agreed(T.mine, T.theirs)) };
      },
      on: function (fn) { listeners.push(fn); },
    };
    return api;
  }

  /** An in-memory store with the database's checks (tests; also documents what the rules enforce). */
  function memoryStore() {
    var data = { trades: {}, sides: {}, done: {}, items: {} }, watchers = [];
    function fire() { watchers.slice().forEach(function (w) { setTimeoutish(w); }); }
    function setTimeoutish(w) { try { w(); } catch (e) { /* ignore */ } }
    function sideOf(id, uid) { return (data.sides[id] || {})[uid] || null; }
    function both(id) { var m = data.trades[id]; return m ? [cleanOffer(sideOf(id, m.a)), cleanOffer(sideOf(id, m.b))] : [null, null]; }
    var S = {
      data: data,
      create: function (id, a, b) { if (data.trades[id]) return Promise.reject(new Error('exists')); data.trades[id] = { a: a, b: b }; return Promise.resolve(); },
      side: function (id, uid, v) {
        var m = data.trades[id];
        if (!m || (m.a !== uid && m.b !== uid) || data.done[id]) return Promise.reject(new Error('PERMISSION_DENIED'));
        (data.sides[id] = data.sides[id] || {})[uid] = JSON.parse(JSON.stringify(v)); fire(); return Promise.resolve();
      },
      watch: function (id, uid, cb) { var last; var w = function () { var v = JSON.stringify(sideOf(id, uid)); if (v !== last) { last = v; cb(sideOf(id, uid)); } }; watchers.push(w); w(); return function () { var i = watchers.indexOf(w); if (i >= 0) watchers.splice(i, 1); }; },
      read: function (id, uid) { return Promise.resolve(sideOf(id, uid)); },
      watchDone: function (id, cb) { var sent = false; var w = function () { if (!sent && data.done[id]) { sent = true; cb(data.done[id]); } }; watchers.push(w); w(); return function () { var i = watchers.indexOf(w); if (i >= 0) watchers.splice(i, 1); }; },
      commit: function (id, by, a, b) {
        var m = data.trades[id], s = both(id);
        if (!m || data.done[id] || (by !== m.a && by !== m.b) || !confirmed(s[0], s[1])) return Promise.reject(new Error('PERMISSION_DENIED'));
        var moves = [];
        Object.keys(s[0].it).forEach(function (k) { moves.push([k, m.b, m.a]); });
        Object.keys(s[1].it).forEach(function (k) { moves.push([k, m.a, m.b]); });
        for (var i = 0; i < moves.length; i++) { var cur = data.items[moves[i][0]]; if (cur && cur.o !== moves[i][2]) return Promise.reject(new Error('PERMISSION_DENIED: ' + moves[i][0])); }
        moves.forEach(function (x) { data.items[x[0]] = { o: x[1], t: id }; });
        data.done[id] = { by: by };
        fire();
        return Promise.resolve();
      },
    };
    return S;
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.trade = Object.freeze({ create: create, memoryStore: memoryStore, cleanOffer: cleanOffer, C: C, TYPES: TYPES, ID_RE: ID_RE });
})(typeof window !== 'undefined' ? window : globalThis);
