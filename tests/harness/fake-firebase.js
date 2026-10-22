// Test-only stand-in for the Firebase modular SDK (app, auth, database), injected with addInitScript.
// Pages in the same browser context share one fake Realtime Database over a BroadcastChannel.
// set()/remove() are checked against a copy of the presence rules in backend/database.rules.json,
// so a client that writes the wrong path or shape fails here the way it would on the server.
(() => {
  if (window.__fakeRTDB) return;
  const ch = new BroadcastChannel('fake-rtdb');
  const SV = { '.sv': 'timestamp' };
  const data = new Map();
  const listeners = [];
  const mine = new Set();
  const discon = new Set();
  const connCbs = [];
  const pending = new Map();
  let user = null;
  let connected = true;
  const F = (window.__fakeRTDB = { log: [], listens: [], rejected: [], data, sdkVersion: undefined, nextName: 'Tester', nextUid: null, popupBlocked: false, redirected: false });

  const parentOf = (p) => p.slice(0, p.lastIndexOf('/'));
  const keyOf = (p) => p.slice(p.lastIndexOf('/') + 1);
  const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
  const snap = (p, v) => ({ key: keyOf(p), val: () => clone(v) });
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b + 256).toString(16).slice(1)).join('');

  let helloAt = 0;
  const valueCbs = new Map(); // exact path -> callbacks (onValue on a data path)
  // old/v: the child before and after (undefined = absent). A child listener sees the child through
  // its query (l.match): entering the query is 'added', leaving it 'removed', changing inside it
  // 'changed', the way RTDB fires child events for a range query.
  function fire(p, old, v) {
    for (const l of listeners) {
      if (l.parent !== parentOf(p)) continue;
      const was = old !== undefined && l.match(old), is = v !== undefined && l.match(v);
      const type = was && is ? 'changed' : is ? 'added' : was ? 'removed' : null;
      if (type === l.type) setTimeout(() => l.cb(snap(p, type === 'removed' ? old : v)), 0);
    }
    for (const cb of valueCbs.get(p) || []) setTimeout(() => cb(snap(p, v === undefined ? null : v)), 0);
    // every ancestor watched as a whole (SAT-ONLINE-080: guildEventSign/{gid} is watched, written two levels down)
    for (let pp = p.includes('/') ? parentOf(p) : ''; pp; pp = pp.includes('/') ? parentOf(pp) : '') { const q = pp; if (!data.has(q)) for (const cb of valueCbs.get(q) || []) setTimeout(() => cb(snap(q, nodeVal(q))), 0); }
  }
  // a node as the database would return it: its own value, or everything stored under it, nested
  function nodeVal(p) {
    if (data.has(p)) return data.get(p);
    const out = {}, pre = p + '/'; let n = 0;
    for (const [k, v] of data) {
      if (!k.startsWith(pre)) continue;
      const rest = k.slice(pre.length).split('/'); let o = out;
      for (let i = 0; i < rest.length - 1; i++) o = o[rest[i]] = o[rest[i]] && typeof o[rest[i]] === 'object' ? o[rest[i]] : {};
      o[rest[rest.length - 1]] = v; n++;
    }
    return n ? out : null;
  }
  function apply(op, p, v) {
    if (op === 'set') { const old = data.get(p); data.set(p, v); fire(p, old, v); }
    else if (op === 'remove' && data.has(p)) { const old = data.get(p); data.delete(p); fire(p, old, undefined); }
  }
  ch.onmessage = (e) => {
    if (!connected) return;
    const m = e.data;
    // durable records (account IDs, handles: SAT-ONLINE-026) outlive the page that wrote them, as on the server
    if (m.op === 'hello') { for (const [p, v] of data) if (mine.has(p) || /^(accountIds|handles|guilds|guildNames|guildMembers|guildInv|guildVault|guildVaultTaken|guildBank|guildBuild|guildLog|guildNote|guildRecruit|guildEvents|guildEventSign|guildWeek|guildWeekPaid|guildAllyAsk|guildAlly|guildAllyCd|guildDiplo|guildWarAsk|guildWar|guildWarKill|announce|admins|guildTrophy|repairOrders|repairDone|repairPaid|tradeLog|tradeRep|trades|tradeSides|tradeDone|tradedItems|mutes|reports|drops|dropClaims|kills|bounties|bountyPaid|arena|friends|friendReq|lfg|nat|natPaid|ranks|lockouts|world\/satisfy\/(legends|wb))\//.test(p)) ch.postMessage({ op: 'set', p, v }); return; }
    // A hello reply carries the replier's copy, which may be older than what this page has just written (a page
    // that reloads and claims sessions/{uid} at once). The real database orders writes, so keep the newest.
    const cur = data.get(m.p);
    if (m.op === 'set' && cur && m.v && typeof cur.t === 'number' && typeof m.v.t === 'number' && m.v.t < cur.t) return;
    apply(m.op, m.p, m.v);
  };
  function write(op, p, v) { apply(op, p, v); ch.postMessage({ op, p, v }); }
  // The real database fires this page's own listeners for a write before the write's promise resolves (a local remove()
  // has already dropped the node when .then runs: Claude-B, #129/#131). The listeners above run on timers queued by
  // write(), so a promise settled on a later timer resolves after them.
  const acked = (v) => new Promise((res) => setTimeout(() => res(v), 0));
  // the paths a root update claims for its first writer only (each one's rules need !data.exists() or the like)
  const CLAIM_RE = /^(repairOrders|guildNames|guildVaultTaken|guildBank|dropClaims|tradeDone|tradedItems|bountyPaid|world\/satisfy\/(legends|wb))\//, CLAIM_WAIT = 120;
  function rootUpdate(diff) {
    const ps = Object.keys(diff);curDiff = diff;bDiff = diff;let errs;try{errs = ps.map((p) => rules(p, diff[p], data.has(p))).filter(Boolean);}finally{curDiff = null;bDiff = null;}
    F.log.push({ op: 'update', path: '', err: errs[0] || null, keys: ps.slice().sort() });
    if (errs.length) { F.rejected.push(errs[0]); return Promise.reject(Object.assign(new Error(errs[0]), { code: 'PERMISSION_DENIED' })); }
    const fix = (x) => (x && typeof x === 'object' ? (JSON.stringify(x) === JSON.stringify(SV) ? Date.now() : Object.fromEntries(Object.entries(x).map(([k, y]) => [k, fix(y)]))) : x);
    for (const p of ps) {
      if (diff[p] === null) { for (const k of [...data.keys()]) if (k === p || k.startsWith(p + '/')) { mine.delete(k); write('remove', k); } continue; }
      mine.add(p); write('set', p, fix(clone(diff[p])));
    }
    return acked();
  }

  const FIELDS = ['v', 'uid', 'sid', 'handle', 'look', 'cls', 'lv', 'title', 'zone', 'room', 'x', 'y', 'dir', 'anim', 'arm', 'party', 'duel', 'mv', 'hp', 'em', 'role', 'wp', 'fx', 'gu', 'rs', 'rd', 'ol', 'gd', 'seq', 't'];
  const POS_X = 16384, POS_Y = 8192, POS_Y0 = -4096; // = database.rules.json x/y bounds (checked by tests/unit/rules.test.cjs)
  const REQUIRED = ['v', 'uid', 'sid', 'handle', 'look', 'cls', 'lv', 'zone', 'x', 'y', 'dir', 'anim', 'arm', 'seq', 't'];
  // SAT-ONLINE-039 trades, as backend/database.rules.json: every condition reads the data as it was before the write
  const TID_RE = /^t_[A-Za-z0-9_-]{1,60}$/, IID_RE = /^it_[a-z0-9_]{4,40}_[0-9]+$/;
  const isInt = (x, lo) => typeof x === 'number' && x >= lo && x % 1 === 0;
  function tradeMeta(tid) { const m = data.get('trades/' + tid); return m && typeof m === 'object' ? m : null; }
  function tradeConfirmed(tid) {
    const m = tradeMeta(tid); if (!m) return false;
    const A = data.get('tradeSides/' + tid + '/' + m.a), B = data.get('tradeSides/' + tid + '/' + m.b);
    return !!A && !!B && A.rev != null && B.rev != null && A.acc === B.rev && B.acc === A.rev && A.conf === B.rev && B.conf === A.rev;
  }
  function tradeRules(seg, v) {
    if (!user) return 'PERMISSION_DENIED: trade';
    const path = seg.join('/'), me = user.uid;
    if (seg[0] === 'trades') {
      if (seg.length !== 2 || !TID_RE.test(seg[1]) || data.has(path) || !v) return 'PERMISSION_DENIED: trades ' + path;
      if (Object.keys(v).sort().join(',') !== 'a,b,t' || v.a !== me || typeof v.b !== 'string' || !v.b || v.b.length > 128 || v.b === me || JSON.stringify(v.t) !== JSON.stringify(SV)) return 'trades fields';
      return null;
    }
    const m = tradeMeta(seg[1]), part = !!m && (m.a === me || m.b === me);
    if (seg[0] === 'tradeSides') {
      if (seg.length !== 3 || seg[2] !== me || !part || data.has('tradeDone/' + seg[1])) return 'PERMISSION_DENIED: tradeSides ' + path;
      if (!v) return 'tradeSides null';
      for (const k in v) if (!['g', 'rev', 'acc', 'conf', 'it', 't'].includes(k)) return 'tradeSides field ' + k;
      if (!(isInt(v.g, 0) && v.g <= 1000000000 && isInt(v.rev, 1) && isInt(v.acc, -1) && isInt(v.conf, -1))) return 'tradeSides numbers';
      if ('it' in v && !(v.it && typeof v.it === 'object' && Object.keys(v.it).every((k) => IID_RE.test(k) && typeof v.it[k] === 'string' && v.it[k].length <= 600))) return 'tradeSides it';
      return JSON.stringify(v.t) === JSON.stringify(SV) ? null : 'tradeSides t';
    }
    if (seg[0] === 'tradeDone') {
      if (seg.length !== 2 || !part || data.has(path) || !v || !tradeConfirmed(seg[1])) return 'PERMISSION_DENIED: tradeDone ' + path;
      return Object.keys(v).sort().join(',') === 'by,t' && v.by === me && JSON.stringify(v.t) === JSON.stringify(SV) ? null : 'tradeDone fields';
    }
    // tradedItems/{iid} = {o, t, at}: an item moves only inside a confirmed, not yet done trade it was offered in, and only
    // away from the player the ledger last recorded
    if (seg.length !== 2 || !IID_RE.test(seg[1]) || !v || typeof v.t !== 'string') return 'PERMISSION_DENIED: tradedItems ' + path;
    if (Object.keys(v).sort().join(',') !== 'at,o,t' || JSON.stringify(v.at) !== JSON.stringify(SV) || !TID_RE.test(v.t)) return 'tradedItems fields';
    const T = tradeMeta(v.t);
    if (!T || (T.a !== me && T.b !== me) || data.has('tradeDone/' + v.t) || !tradeConfirmed(v.t)) return 'PERMISSION_DENIED: tradedItems trade';
    const giver = v.o === T.a ? T.b : v.o === T.b ? T.a : null, offer = giver && data.get('tradeSides/' + v.t + '/' + giver);
    if (!giver || !offer || !offer.it || !(seg[1] in offer.it)) return 'PERMISSION_DENIED: tradedItems not offered';
    const cur = data.get(path);
    if (cur && cur.o !== giver) return 'PERMISSION_DENIED: tradedItems not the giver\'s';
    return null;
  }
  // SAT-ONLINE-046 guilds, as backend/database.rules.json: conditions read the data before the write; curDiff holds the
  // other paths of the same multi-location update (the rules' newData.parent()... of a new guild and its name)
  let curDiff = null;
  const GID_RE = /^g_[A-Za-z0-9]{1,128}$/;
  const after = (p) => (curDiff && p in curDiff ? curDiff[p] : data.has(p) ? data.get(p) : null);
  const rkOf = (gid, uid) => { const m = data.get('guildMembers/' + gid + '/' + uid); return m && m.rk || ''; };
  const rightOf = (g, uid, x) => { const r = rkOf(g, uid), pm = (data.get('guilds/' + g) || {}).perm || {}; return r === 'm' || (r === 'o' && (pm.o || {})[x] !== false) || (r === 'r' && (pm.r || {})[x] === true); }; // SAT-ONLINE-104
  const isSV = (x) => JSON.stringify(x) === JSON.stringify(SV);
  function guildRules(seg, v) {
    if (!user) return 'PERMISSION_DENIED: guild';
    const me = user.uid, path = seg.join('/'), old = data.has(path) ? data.get(path) : null;
    // SAT-ONLINE-104: a right of a rank (perm/{o|r}/{inv, take, spend, note, ev}, set by the master): the master always; an
    // officer unless the master took it away; a member if the master gave it. And a guild's records go only with the guild
    const right = (g, x) => { const r = rkOf(g, me), pm = (data.get('guilds/' + g) || {}).perm || {}; return r === 'm' || (r === 'o' && (pm.o || {})[x] !== false) || (r === 'r' && (pm.r || {})[x] === true); };
    const gone = (g) => !after('guilds/' + g);
    if (seg[0] === 'guilds') {
      const gid = seg[1];
      if (seg.length !== 2 || !GID_RE.test(gid)) return 'PERMISSION_DENIED: guilds ' + path;
      // SAT-ONLINE-076: an officer takes over from a master away 14 days, becoming 'm' while the master becomes 'o'
      const away = (u) => { const m = data.get('guildMembers/' + gid + '/' + u); return !!m && m.on < Date.now() - 1209600000; };
      const rkAfter = (u) => { const m = after('guildMembers/' + gid + '/' + u); return m && m.rk || ''; };
      const claim = !!old && rkOf(gid, me) === 'o' && away(old.master) && !!v && v.master === me && rkAfter(me) === 'm' && rkAfter(old.master) === 'o';
      if (!(old ? old.master === me || claim : gid === 'g_' + me)) return 'PERMISSION_DENIED: guilds write ' + path;
      if (v === null) return null;
      const gk = Object.keys(v).sort().join(',');
      const gk0 = gk.replace(/,?perm/, ''); // perm: the ranks' rights (SAT-ONLINE-104)
      if (gk0 !== 'col,master,name,nk,t' && !(gk0 === 'col,emb,master,name,nk,t' && isInt(v.emb, 0) && v.emb <= 15)) return 'guilds fields'; // emb: the banner (SAT-ONLINE-084)
      if ('perm' in v && !(v.perm && typeof v.perm === 'object' && Object.keys(v.perm).every((k) => (k === 'o' || k === 'r') && v.perm[k] && typeof v.perm[k] === 'object' && Object.keys(v.perm[k]).every((x) => ['inv', 'take', 'spend', 'note', 'ev'].includes(x) && typeof v.perm[k][x] === 'boolean')))) return 'guilds perm';
      // the master is yourself, or (the master handing over) an officer who becomes 'm' while you become 'o'
      const handTo = !!old && old.master === me && v.master !== me && rkOf(gid, v.master) === 'o' && rkAfter(v.master) === 'm' && rkAfter(me) === 'o';
      if (!(typeof v.name === 'string' && v.name.length >= 2 && v.name.length <= 18 && v.nk === v.name.toLowerCase() && (v.master === me || handTo) && /^#[0-9a-fA-F]{6}$/.test(v.col))) return 'guilds values';
      if (!(isSV(v.t) || (old && v.t === old.t))) return 'guilds t';
      return after('guildNames/' + v.nk) === gid ? null : 'PERMISSION_DENIED: guilds name entry';
    }
    if (seg[0] === 'guildNames') {
      if (seg.length !== 2) return 'PERMISSION_DENIED: guildNames ' + path;
      if (v === null) return old && ((data.get('guilds/' + old) || {}).master === me || (old === 'g_' + me && !data.has('guilds/' + old))) ? null : 'PERMISSION_DENIED: guildNames remove';
      if (old !== null || v !== 'g_' + me) return 'PERMISSION_DENIED: guildNames taken ' + path;
      const g = after('guilds/' + v);
      return g && g.nk === seg[1] ? null : 'guildNames guild';
    }
    if (seg[0] === 'guildWeek' || seg[0] === 'guildWeekPaid') { // SAT-ONLINE-081: the weekly goal and its rewards
      const gid = seg[1], member = data.has('guildMembers/' + gid + '/' + me), master = (data.get('guilds/' + gid) || {}).master === me;
      if (seg.length <= 3) return v === null && master && gone(gid) && (seg.length === 2 || seg[0] === 'guildWeek') ? null : 'PERMISSION_DENIED: ' + seg[0] + ' ' + path;
      if (!/^w[0-9]{4,6}$/.test(seg[2]) || seg[3] !== me) return 'PERMISSION_DENIED: ' + seg[0] + ' write';
      if (seg[0] === 'guildWeek') {
        if (seg.length !== 4) return 'PERMISSION_DENIED: guildWeek ' + path;
        if (v === null) return null;
        if (!member) return 'PERMISSION_DENIED: guildWeek member';
        if (Object.keys(v).sort().join(',') !== 'k,n,t') return 'guildWeek fields';
        return typeof v.n === 'string' && v.n.length <= 24 && isInt(v.k, 0) && v.k <= 1500 && (!old || v.k >= old.k) && isSV(v.t) ? null : 'guildWeek values';
      }
      if (seg.length !== 5 || !/^[123]$/.test(seg[4]) || old || !member || v === null) return 'PERMISSION_DENIED: guildWeekPaid';
      return Object.keys(v).join(',') === 't' && isSV(v.t) ? null : 'guildWeekPaid values';
    }
    if (seg[0] === 'guildEvents' || seg[0] === 'guildEventSign') { // SAT-ONLINE-080: guild events and who is going
      const gid = seg[1], mo = right(gid, 'ev'), master = (data.get('guilds/' + gid) || {}).master === me;
      if (seg.length === 2) return v === null && master && gone(gid) ? null : 'PERMISSION_DENIED: ' + seg[0] + ' ' + path;
      if (seg[0] === 'guildEvents') {
        if (seg.length !== 3 || !mo || (old && v !== null)) return 'PERMISSION_DENIED: guildEvents write';
        if (v === null) return null;
        if (!/^e_[A-Za-z0-9_-]{1,40}$/.test(seg[2]) || Object.keys(v).sort().join(',') !== 'at,by,n,t,title') return 'guildEvents fields';
        const now = Date.now();
        return typeof v.title === 'string' && v.title.length >= 1 && v.title.length <= 60 && typeof v.at === 'number' && v.at > now && v.at <= now + 2592000000 && v.by === me && typeof v.n === 'string' && v.n.length <= 24 && isSV(v.t) ? null : 'guildEvents values';
      }
      if (seg.length === 3) return v === null && mo ? null : 'PERMISSION_DENIED: guildEventSign ' + path;
      if (seg.length !== 4 || seg[3] !== me || !data.has('guildMembers/' + gid + '/' + me) || (v !== null && !data.has('guildEvents/' + gid + '/' + seg[2]))) return 'PERMISSION_DENIED: guildEventSign write';
      if (v === null) return null;
      return Object.keys(v).sort().join(',') === 'n,t' && typeof v.n === 'string' && v.n.length <= 24 && isSV(v.t) ? null : 'guildEventSign values';
    }
    if (['guildWarAsk', 'guildWar', 'guildWarKill'].includes(seg[0])) { // SAT-ONLINE-086: guild wars
      const mo = (g) => ['m', 'o'].includes(rkOf(g, me)), now = Date.now(), hour = (x) => typeof x === 'number' && x % 3600000 === 0;
      if (seg.length === 2) return v === null && (data.get('guilds/' + seg[1]) || {}).master === me ? null : 'PERMISSION_DENIED: ' + seg[0] + ' ' + path;
      if (seg[0] === 'guildWarAsk') {
        const to = seg[1], from = seg[2], al = data.get('guildAlly/' + from + '/' + to);
        if (seg.length !== 3) return 'PERMISSION_DENIED: guildWarAsk ' + path;
        if (v === null) return mo(from) || mo(to) ? null : 'PERMISSION_DENIED: guildWarAsk remove';
        if (!mo(from) || from === to || !data.has('guilds/' + to) || (al && al.until >= now)) return 'PERMISSION_DENIED: guildWarAsk write';
        return Object.keys(v).sort().join(',') === 'at,by,n,t' && v.n === (data.get('guilds/' + from) || {}).name && hour(v.at) && v.at >= now + 1800000 && v.at <= now + 604800000 && v.by === me && isSV(v.t) ? null : 'guildWarAsk values';
      }
      if (seg[0] === 'guildWar') {
        const g = seg[1], o = seg[2];
        if (seg.length !== 3) return 'PERMISSION_DENIED: guildWar ' + path;
        if (v === null) return (mo(g) || mo(o)) && old && (old.at > now + 600000 || old.at + 3600000 < now) ? null : 'PERMISSION_DENIED: guildWar remove';
        const ask = (a, b) => (data.get('guildWarAsk/' + a + '/' + b) || {}).at === v.at;
        if (!((!old || old.at + 3600000 < now) && ((mo(g) && ask(g, o)) || (mo(o) && ask(o, g))))) return 'PERMISSION_DENIED: guildWar write';
        return Object.keys(v).sort().join(',') === 'at,n,t' && v.n === (data.get('guilds/' + o) || {}).name && hour(v.at) && v.at > now && isSV(v.t) ? null : 'guildWar values';
      }
      const g = seg[1], o = seg[2], w = data.get('guildWar/' + g + '/' + o); // guildWarKill/{g}/{o}/{uid}
      if (seg.length !== 4 || seg[3] !== me || v === null || !data.has('guildMembers/' + g + '/' + me)) return 'PERMISSION_DENIED: guildWarKill ' + path;
      if (Object.keys(v).sort().join(',') !== 'at,k,n,t' || !w || v.at !== w.at || now < v.at || now > v.at + 3900000) return 'PERMISSION_DENIED: guildWarKill window';
      return typeof v.n === 'string' && v.n.length <= 24 && isInt(v.k, 1) && v.k <= 200 && (!old || old.at !== v.at || v.k >= old.k) && isSV(v.t) ? null : 'guildWarKill values';
    }
    if (['guildAllyAsk', 'guildAlly', 'guildAllyCd', 'guildDiplo'].includes(seg[0])) { // SAT-ONLINE-085: alliances and the diplomacy log
      const mo = (g) => ['m', 'o'].includes(rkOf(g, me)), now = Date.now();
      if (seg.length === 2) return v === null && seg[0] !== 'guildAllyCd' && (data.get('guilds/' + seg[1]) || {}).master === me && (seg[0] !== 'guildDiplo' || gone(seg[1])) ? null : 'PERMISSION_DENIED: ' + seg[0] + ' ' + path;
      if (seg.length !== 3) return 'PERMISSION_DENIED: ' + seg[0] + ' ' + path;
      if (seg[0] === 'guildAllyAsk') {
        const to = seg[1], from = seg[2];
        if (v === null) return mo(from) || mo(to) ? null : 'PERMISSION_DENIED: guildAllyAsk remove';
        const cdOk = (a, b) => { const c = data.get('guildAllyCd/' + a + '/' + b); return !c || c.t < now - 86400000; };
        if (!mo(from) || from === to || !data.has('guilds/' + to) || !cdOk(from, to) || !cdOk(to, from)) return 'PERMISSION_DENIED: guildAllyAsk write';
        return Object.keys(v).sort().join(',') === 'by,n,t' && v.n === (data.get('guilds/' + from) || {}).name && v.by === me && isSV(v.t) ? null : 'guildAllyAsk values';
      }
      if (seg[0] === 'guildAlly') {
        const g = seg[1], o = seg[2];
        if (v === null) return mo(g) || mo(o) ? null : 'PERMISSION_DENIED: guildAlly remove';
        const fresh = (a, b) => { const x = data.get('guildAllyAsk/' + a + '/' + b); return !!x && x.t > now - 604800000; };
        if (!((mo(g) && fresh(g, o)) || (mo(o) && fresh(o, g)))) return 'PERMISSION_DENIED: guildAlly write';
        return Object.keys(v).sort().join(',') === 'n,t,until' && v.n === (data.get('guilds/' + o) || {}).name && typeof v.until === 'number' && v.until > now && v.until <= now + 2678400000 && isSV(v.t) ? null : 'guildAlly values';
      }
      if (seg[0] === 'guildAllyCd') return v !== null && mo(seg[1]) ? (Object.keys(v).join(',') === 't' && isSV(v.t) ? null : 'guildAllyCd values') : 'PERMISSION_DENIED: guildAllyCd ' + path;
      const gid = seg[1], o = v && v.o; // guildDiplo/{gid}/{id}: never changed; your guild's, or the other side's as its partner or answering it
      if (old || v === null) return 'PERMISSION_DENIED: guildDiplo ' + path;
      const counter = typeof o === 'string' && mo(o) && (data.has('guildAlly/' + gid + '/' + o) || data.has('guildAllyAsk/' + o + '/' + gid) || data.has('guildWarAsk/' + o + '/' + gid));
      if (!(mo(gid) || counter)) return 'PERMISSION_DENIED: guildDiplo write';
      return /^d_[A-Za-z0-9_-]{1,40}$/.test(seg[2]) && (Object.keys(v).sort().join(',') === 'by,k,n,o,t' || (Object.keys(v).sort().join(',') === 'at,by,k,n,o,t' && typeof v.at === 'number' && v.at % 3600000 === 0)) && ['ask', 'ally', 'decline', 'break', 'end', 'warask', 'war', 'warno'].includes(v.k) && GID_RE.test(o) && o !== gid && typeof v.n === 'string' && v.n.length <= 18 && v.by === me && isSV(v.t) ? null : 'guildDiplo values';
    }
    if (seg[0] === 'guildRecruit') { // SAT-ONLINE-078: posted by the master or an officer, for all to read
      const gid = seg[1], r = rkOf(gid, me);
      if (seg.length !== 2) return 'PERMISSION_DENIED: guildRecruit ' + path;
      if (!(right(gid, 'inv') || (v === null && !data.has('guilds/' + gid)))) return 'PERMISSION_DENIED: guildRecruit write';
      if (v === null) return null;
      if (Object.keys(v).sort().join(',') !== 'by,m,msg,n,t') return 'guildRecruit fields';
      return typeof v.n === 'string' && v.n.length >= 2 && v.n.length <= 18 && typeof v.msg === 'string' && v.msg.length <= 120 && isInt(v.m, 0) && v.m <= 250 && v.by === me && isSV(v.t) && data.has('guilds/' + gid) ? null : 'guildRecruit values';
    }
    if (seg[0] === 'guildApply' || seg[0] === 'guildRej') { // SAT-ONLINE-078: applications and refusals
      const gid = seg[1], mo = right(gid, 'inv');
      if (seg.length === 2) return v === null && (data.get('guilds/' + gid) || {}).master === me && gone(gid) ? null : 'PERMISSION_DENIED: ' + seg[0] + ' ' + path;
      if (seg.length !== 3) return 'PERMISSION_DENIED: ' + seg[0] + ' ' + path;
      const uid = seg[2];
      if (seg[0] === 'guildApply') {
        if (v === null) return uid === me || mo ? null : 'PERMISSION_DENIED: guildApply remove';
        const rej = data.get('guildRej/' + gid + '/' + uid);
        if (uid !== me || !data.has('guildRecruit/' + gid) || data.has('guildMembers/' + gid + '/' + uid) || (rej && !(rej.t < Date.now() - 604800000))) return 'PERMISSION_DENIED: guildApply closed';
        if (Object.keys(v).sort().join(',') !== 'lv,n,t') return 'guildApply fields';
        return typeof v.n === 'string' && v.n.length >= 1 && v.n.length <= 24 && isInt(v.lv, 0) && v.lv <= 999 && isSV(v.t) ? null : 'guildApply values';
      }
      if (!mo) return 'PERMISSION_DENIED: guildRej write';
      if (v === null) return null;
      return Object.keys(v).sort().join(',') === 'by,t' && v.by === me && isSV(v.t) ? null : 'guildRej values';
    }
    if (seg[0] === 'guildNote') { // SAT-ONLINE-076: the notice; the master and officers write the next version
      const gid = seg[1], r = rkOf(gid, me);
      if (seg.length !== 2) return 'PERMISSION_DENIED: guildNote ' + path;
      if (v === null) return right(gid, 'note') || ((data.get('guilds/' + gid) || {}).master === me && gone(gid)) ? null : 'PERMISSION_DENIED: guildNote remove';
      if (!right(gid, 'note')) return 'PERMISSION_DENIED: guildNote write';
      if (Object.keys(v).sort().join(',') !== 'by,n,s,t,v') return 'guildNote fields';
      return typeof v.s === 'string' && v.s.length >= 1 && v.s.length <= 240 && v.by === me && typeof v.n === 'string' && v.n.length <= 24 && v.v === (old ? old.v + 1 : 1) && isSV(v.t) ? null : 'guildNote values';
    }
    if (seg[0] === 'guildMembers') {
      const gid = seg[1], master = (data.get('guilds/' + gid) || {}).master === me;
      if (seg.length === 2) return v === null && master && gone(gid) ? null : 'PERMISSION_DENIED: guildMembers ' + path;
      if (seg.length !== 3) return 'PERMISSION_DENIED: guildMembers ' + path;
      const uid = seg[2], masterAfter = (after('guilds/' + gid) || {}).master;
      let ok = false;
      if (uid === me) {
        if (!old && v) ok = (v.rk === 'r' && data.has('guildInv/' + me + '/' + gid) && data.has('guilds/' + gid)) || (v.rk === 'm' && gid === 'g_' + me && !data.has('guilds/' + gid));
        else if (old && v) ok = v.rk === old.rk || (old.rk === 'm' && v.rk === 'o' && masterAfter !== me) || (old.rk === 'o' && v.rk === 'm' && masterAfter === me);
        else if (old && !v) ok = old.rk !== 'm';
      } else if (old) {
        ok = (master && (!v || (v.n === old.n && v.c === old.c))) || (!v && old.rk === 'r' && rkOf(gid, me) === 'o') || (!!v && old.rk === 'm' && v.rk === 'o' && v.n === old.n && v.c === old.c && masterAfter === me);
      }
      if (!ok) return 'PERMISSION_DENIED: guildMembers write ' + path;
      if (v === null) return null;
      if (Object.keys(v).sort().join(',') !== 'c,n,on,rk') return 'guildMembers fields';
      if (!(v.rk === 'r' || v.rk === 'o' || (v.rk === 'm' && masterAfter === uid))) return 'guildMembers rk';
      if (!(typeof v.n === 'string' && v.n.length <= 24 && isInt(v.c, 0) && v.c <= 1e12)) return 'guildMembers n/c';
      return isSV(v.on) || (old && v.on === old.on) ? null : 'guildMembers on';
    }
    if (seg[0] === 'guildBank' || seg[0] === 'guildBuild' || seg[0] === 'guildLog') { // SAT-ONLINE-065: the treasury, the buildings, the log
      const gid = seg[1], member = data.has('guildMembers/' + gid + '/' + me), master = (data.get('guilds/' + gid) || {}).master === me, boss = right(gid, 'spend');
      if (seg.length === 2 && v === null) return master && gone(gid) ? null : 'PERMISSION_DENIED: ' + seg[0] + ' remove';
      if (seg[0] === 'guildBank') {
        if (seg.length !== 2 || !member) return 'PERMISSION_DENIED: guildBank ' + path;
        if (Object.keys(v).sort().join(',') !== 'in,lb,lg,s,t' || !isInt(v.in, 0) || !isInt(v.s, 0) || !isInt(v.lg, 1) || v.lg > 1e6 || typeof v.lb !== 'string' || !isSV(v.t) || v.s > v.in) return 'guildBank fields';
        const give = old ? v.s === old.s && v.in === old.in + v.lg && v.lb === me : v.s === 0 && v.in === v.lg && v.lb === me;
        const spend = !!old && v.in === old.in && v.s > old.s && boss && ['forge', 'train', 'gold'].some((b) => { const n = after('guildBuild/' + gid + '/' + b), o = data.get('guildBuild/' + gid + '/' + b); return n != null && (o == null || n > o); }); // only with a building raised (Claude-B's review of #99)
        return give || spend ? null : 'PERMISSION_DENIED: guildBank stale or not yours';
      }
      if (seg[0] === 'guildBuild') {
        if (seg.length !== 3 || !boss || !['forge', 'train', 'gold'].includes(seg[2])) return 'PERMISSION_DENIED: guildBuild ' + path;
        if (!(isInt(v, 1) && v <= 3 && v === (old || 0) + 1)) return 'guildBuild level';
        const s0 = (data.get('guildBank/' + gid) || {}).s, s1 = (after('guildBank/' + gid) || {}).s;
        return s1 === s0 + [0, 50000, 150000, 400000][v] ? null : 'PERMISSION_DENIED: guildBuild cost';
      }
      if (seg.length !== 3 || !member || old || !/^l_[A-Za-z0-9_-]{1,40}$/.test(seg[2])) return 'PERMISSION_DENIED: guildLog ' + path;
      const ks = Object.keys(v).sort().join(',');
      if (!['by,g,k,n,t', 'b,by,g,k,l,n,t'].includes(ks) || v.by !== me || !['give', 'build'].includes(v.k) || !isSV(v.t)) return 'guildLog fields';
      return null;
    }
    if (seg[0] === 'guildChat') { // SAT-ONLINE-049: members write new lines as themselves; the master clears it all on disband
      const gid = seg[1], member = data.has('guildMembers/' + gid + '/' + me);
      if (seg.length === 2) return v === null && (data.get('guilds/' + gid) || {}).master === me && gone(gid) ? null : 'PERMISSION_DENIED: guildChat ' + path;
      if (seg.length !== 3 || !member) return 'PERMISSION_DENIED: guildChat ' + path;
      if (v === null) return old && old.t < Date.now() - 86400000 ? null : 'PERMISSION_DENIED: guildChat remove';
      if (old || v.from !== me) return 'PERMISSION_DENIED: guildChat write';
      if (Object.keys(v).sort().join(',') !== 'from,h,t,text' || v.h !== data.get('accountIds/' + me) || typeof v.text !== 'string' || v.text.length < 1 || v.text.length > 120) return 'guildChat fields';
      return isSV(v.t) ? null : 'guildChat t';
    }
    if (seg[0] === 'guildVault' || seg[0] === 'guildVaultTaken') { // SAT-ONLINE-050
      const gid = seg[1], r = rkOf(gid, me), master = (data.get('guilds/' + gid) || {}).master === me;
      if (seg.length === 2) return v === null && master && gone(gid) ? null : 'PERMISSION_DENIED: ' + path;
      if (seg.length !== 3) return 'PERMISSION_DENIED: ' + path;
      const e = data.get('guildVault/' + gid + '/' + seg[2]), take = right(gid, 'take');
      if (seg[0] === 'guildVault') {
        if (!r) return 'PERMISSION_DENIED: guildVault member';
        if (v === null) return old && (take || old.by === me) ? null : 'PERMISSION_DENIED: guildVault take';
        if (old || v.by !== me || !/^v_[A-Za-z0-9_-]{1,80}$/.test(seg[2])) return 'PERMISSION_DENIED: guildVault put';
        for (const k in v) if (!['k', 'n', 'r', 'it', 'by', 'byN', 't'].includes(k)) return 'guildVault field ' + k;
        if (!(typeof v.k === 'string' && /^[a-z0-9_]{1,24}$/.test(v.k) && isInt(v.n, 1) && v.n <= 99999 && isInt(v.r, 0) && v.r <= 9 && (!('it' in v) || (typeof v.it === 'string' && v.it.length <= 600)))) return 'guildVault values';
        return isSV(v.t) ? null : 'guildVault t';
      }
      if (v === null) return old && old.t < Date.now() - 86400000 ? null : 'PERMISSION_DENIED: guildVaultTaken remove';
      if (old || v.by !== me || !e || !(take || e.by === me)) return 'PERMISSION_DENIED: guildVaultTaken ' + path;
      return Object.keys(v).sort().join(',') === 'by,t' && isSV(v.t) ? null : 'guildVaultTaken fields';
    }
    // guildInv/{uid}/{gid}
    if (seg.length !== 3) return 'PERMISSION_DENIED: guildInv ' + path;
    const uid = seg[1], gid = seg[2];
    if (!((uid === me && v === null) || (right(gid, 'inv') && (v === null || !data.has('guildMembers/' + gid + '/' + uid))))) return 'PERMISSION_DENIED: guildInv write ' + path;
    if (v === null) return null;
    for (const k in v) if (!['n', 'by', 'byN', 't'].includes(k)) return 'guildInv field ' + k;
    if (!(typeof v.n === 'string' && v.n.length <= 18 && v.by === me && (!('byN' in v) || (typeof v.byN === 'string' && v.byN.length <= 24)))) return 'guildInv values';
    return isSV(v.t) ? null : 'guildInv t';
  }
  // SAT-ONLINE-048 dropped items, as backend/database.rules.json (server time = this page's clock)
  function dropRules(seg, v) {
    if (!user || seg.length !== 2) return 'PERMISSION_DENIED: ' + seg.join('/');
    const me = user.uid, path = seg.join('/'), old = data.has(path) ? data.get(path) : null, now = Date.now(), SVs = JSON.stringify(SV);
    if (seg[0] === 'drops') {
      if (!/^d_[A-Za-z0-9_-]{1,80}$/.test(seg[1])) return 'drops id';
      if (v === null) { const c = data.get('dropClaims/' + seg[1]); return old && (old.o === me || (c && c.by === me) || now > old.t + 120000) ? null : 'PERMISSION_DENIED: drops remove'; }
      if (old || v.o !== me) return 'PERMISSION_DENIED: drops write';
      for (const k in v) if (!['o', 'x', 'y', 'k', 'n', 'r', 'it', 't'].includes(k)) return 'drops field ' + k;
      if (!(typeof v.x === 'number' && v.x >= 0 && v.x < 16384 && typeof v.y === 'number' && v.y >= -4096 && v.y < 8192)) return 'drops x/y';
      if (!(typeof v.k === 'string' && /^[a-z0-9_]{1,24}$/.test(v.k) && isInt(v.n, 1) && v.n <= 99999 && isInt(v.r, 0) && v.r <= 9)) return 'drops k/n/r';
      if ('it' in v && !(typeof v.it === 'string' && v.it.length <= 600)) return 'drops it';
      return JSON.stringify(v.t) === SVs ? null : 'drops t';
    }
    const d = data.get('drops/' + seg[1]);
    if (v === null) return old && (old.by === me || now > old.t + 120000) ? null : 'PERMISSION_DENIED: dropClaims remove';
    if (old || !d || now >= d.t + 60000 || !(d.o === me || now > d.t + 2000)) return 'PERMISSION_DENIED: dropClaims ' + path;
    return Object.keys(v).sort().join(',') === 'by,t' && v.by === me && JSON.stringify(v.t) === SVs ? null : 'dropClaims fields';
  }
  // SAT-ONLINE-051 bounties, as backend/database.rules.json (curDiff: the other paths of the same update)
  let bDiff = null;
  function bountyRules(seg, v) {
    if (!user) return 'PERMISSION_DENIED: bounty';
    const me = user.uid, path = seg.join('/'), old = data.has(path) ? data.get(path) : null, SVs = JSON.stringify(SV);
    if (seg[0] === 'kills') {
      if (seg.length !== 3 || seg[1] !== me || !/^k_[A-Za-z0-9_-]{1,80}$/.test(seg[2])) return 'PERMISSION_DENIED: kills ' + path;
      if (v === null) return null;
      if (old) return 'PERMISSION_DENIED: kills rewrite';
      return Object.keys(v).sort().join(',') === 'k,t' && typeof v.k === 'string' && v.k && v.k.length <= 128 && v.k !== me && JSON.stringify(v.t) === SVs ? null : 'kills fields';
    }
    if (seg.length !== 2) return 'PERMISSION_DENIED: ' + path;
    const bid = seg[1], b = data.get('bounties/' + bid);
    if (seg[0] === 'bounties') {
      if (v === null) { const paid = bDiff && bDiff['bountyPaid/' + bid]; return old && (old.by === me || (paid && paid.by === me)) ? null : 'PERMISSION_DENIED: bounties remove'; }
      if (old || v.by !== me || v.tu === me || !/^b_[A-Za-z0-9_-]{1,80}$/.test(bid)) return 'PERMISSION_DENIED: bounties write';
      if (Object.keys(v).sort().join(',') !== 'by,byN,g,t,tN,tu') return 'bounties fields';
      if (!(typeof v.byN === 'string' && v.byN.length <= 24 && typeof v.tN === 'string' && v.tN.length <= 24 && typeof v.tu === 'string' && v.tu && v.tu.length <= 128 && isInt(v.g, 100) && v.g <= 10000000)) return 'bounties values';
      return JSON.stringify(v.t) === SVs ? null : 'bounties t';
    }
    // bountyPaid/{bid} {by, kid, g, t}: once, by whoever the target's own client says killed it after the bounty was set
    if (old || !v || v.by !== me || !b || b.by === me || b.tu === me) return 'PERMISSION_DENIED: bountyPaid ' + path;
    const k = typeof v.kid === 'string' && data.get('kills/' + b.tu + '/' + v.kid);
    if (!k || k.k !== me || !(k.t > b.t)) return 'PERMISSION_DENIED: bountyPaid kill';
    return Object.keys(v).sort().join(',') === 'by,g,kid,t' && v.g === b.g && JSON.stringify(v.t) === SVs ? null : 'bountyPaid fields';
  }
  // SAT-ONLINE-053 arena seasons, as backend/database.rules.json: your own rating; one win or loss and at most 64 points a write
  function arenaRules(seg, v) {
    if (!user || seg.length !== 3 || !/^s20[0-9]{4}$/.test(seg[1]) || seg[2] !== user.uid) return 'PERMISSION_DENIED: arena ' + seg.join('/');
    if (v === null) return null;
    const old = data.get(seg.join('/'));
    if (Object.keys(v).sort().join(',') !== 'l,n,r,t,w' || !isInt(v.r, 0) || v.r > 4000 || !isInt(v.w, 0) || !isInt(v.l, 0) || typeof v.n !== 'string' || v.n.length > 24 || JSON.stringify(v.t) !== JSON.stringify(SV)) return 'arena fields';
    if (!old) return v.w + v.l <= 1 && v.r >= 936 && v.r <= 1064 ? null : 'arena first';
    const one = (v.w === old.w + 1 && v.l === old.l) || (v.l === old.l + 1 && v.w === old.w);
    return one && Math.abs(v.r - old.r) <= 64 ? null : 'arena step';
  }
  // SAT-ONLINE-054: world/satisfy/legends/{k} {uid, n, t}: taken once, then only its owner changes or frees it
  function worldRules(seg, v) {
    if (!user || seg.length !== 4 || seg[1] !== 'satisfy' || seg[2] !== 'legends' || !/^[a-z0-9_]{1,24}$/.test(seg[3])) return 'PERMISSION_DENIED: ' + seg.join('/');
    const old = data.get(seg.join('/'));
    if (old && old.uid !== user.uid) return 'PERMISSION_DENIED: legend taken';
    if (v === null) return old ? null : 'PERMISSION_DENIED: legend remove';
    return Object.keys(v).sort().join(',') === 'n,t,uid' && v.uid === user.uid && typeof v.n === 'string' && v.n.length >= 1 && v.n.length <= 24 && JSON.stringify(v.t) === JSON.stringify(SV) ? null : 'legend fields';
  }
  // SAT-ONLINE-055 rankings: ranks/{lv|gold}/{uid} {v, n, t}, each player its own
  function rankRules(seg, v) {
    if (!user || seg.length !== 3 || !['lv', 'gold'].includes(seg[1]) || seg[2] !== user.uid) return 'PERMISSION_DENIED: ' + seg.join('/');
    if (v === null) return null;
    return Object.keys(v).sort().join(',') === 'n,t,v' && isInt(v.v, 0) && v.v <= 1e12 && typeof v.n === 'string' && v.n.length >= 1 && v.n.length <= 24 && JSON.stringify(v.t) === JSON.stringify(SV) ? null : 'ranks fields';
  }
  // SAT-ONLINE-056: world/satisfy/wb/{type} {at, by, t}: a world boss's respawn time, set by its killer, once per kill
  function wbRules(seg, v) {
    if (!user || seg.length !== 4 || seg[1] !== 'satisfy' || seg[2] !== 'wb' || !/^[a-z0-9_]{1,16}$/.test(seg[3])) return 'PERMISSION_DENIED: ' + seg.join('/');
    const old = data.get(seg.join('/')), now = Date.now();
    if (old && !(old.at < now)) return 'PERMISSION_DENIED: wb running';
    if (v === null) return 'PERMISSION_DENIED: wb remove';
    return Object.keys(v).sort().join(',') === 'at,by,t' && typeof v.at === 'number' && v.at > now && v.at <= now + 7200000 && v.by === user.uid && JSON.stringify(v.t) === JSON.stringify(SV) ? null : 'wb fields';
  }
  // SAT-ONLINE-059: lockouts/{uid}/{week}/{boss} {t}: your own, taken once a week per boss
  function lockRules(seg, v) {
    if (seg.length === 2 && user && seg[1] === user.uid && v === null) return null; // SAT-ONLINE-066: the owner deletes them all
    if (!user || seg.length !== 4 || seg[1] !== user.uid || !/^w[0-9]{4,6}$/.test(seg[2]) || !/^[a-z0-9_]{1,16}$/.test(seg[3])) return 'PERMISSION_DENIED: ' + seg.join('/');
    if (data.has(seg.join('/'))) return 'PERMISSION_DENIED: lockout taken';
    return v && Object.keys(v).join(',') === 't' && JSON.stringify(v.t) === JSON.stringify(SV) ? null : 'lockout fields';
  }
  // SAT-ONLINE-064 the National Competition: nat/{id}/{uid} your own scores, only upward; natPaid/{id}/{uid} once
  function natRules(seg, v) {
    if (!user || seg.length !== 3 || !/^n[0-9]{1,8}$/.test(seg[1]) || seg[2] !== user.uid) return 'PERMISSION_DENIED: ' + seg.join('/');
    const old = data.get(seg.join('/'));
    if (seg[0] === 'natPaid') return !old && v && Object.keys(v).sort().join(',') === 'g,t' && isInt(v.g, 0) && v.g <= 100000 && JSON.stringify(v.t) === JSON.stringify(SV) ? null : 'PERMISSION_DENIED: natPaid';
    if (v === null) return null;
    if (Object.keys(v).sort().join(',') !== 'c,d,h,n,s,t' || !['h', 'c', 'd'].every((k) => isInt(v[k], 0) && v[k] <= 1e6) || v.s !== v.h + v.c + v.d || typeof v.n !== 'string' || v.n.length < 1 || v.n.length > 24 || JSON.stringify(v.t) !== JSON.stringify(SV)) return 'nat fields';
    return !old || (v.h >= old.h && v.c >= old.c && v.d >= old.d) ? null : 'nat down';
  }
  // SAT-ONLINE-067 friends: an ask to someone not yet a friend; friends on both sides only from an ask; either side removes
  function friendRules(seg, v) {
    if (user && seg.length === 2 && seg[1] === user.uid && v === null) return null; // your own list, all at once ("Delete my online data")
    if (!user || seg.length !== 3) return 'PERMISSION_DENIED: ' + seg.join('/');
    const me = user.uid, [k, a, b] = seg, old = data.get(seg.join('/'));
    const okV = (x) => x && Object.keys(x).sort().join(',') === 'n,t' && typeof x.n === 'string' && x.n.length >= 1 && x.n.length <= 24 && JSON.stringify(x.t) === JSON.stringify(SV);
    if (k === 'friendReq') { // friendReq/{to}/{from}
      if (v === null) return me === a || me === b ? null : 'PERMISSION_DENIED: friendReq remove';
      return me === b && a !== b && !old && !data.has('friends/' + a + '/' + b) && okV(v) ? null : 'PERMISSION_DENIED: friendReq';
    }
    if (v === null) return me === a || me === b ? null : 'PERMISSION_DENIED: friends remove'; // friends/{uid}/{f}
    const asked = me === a ? data.has('friendReq/' + a + '/' + b) : me === b ? data.has('friendReq/' + b + '/' + a) : false;
    return asked && okV(v) ? null : 'PERMISSION_DENIED: friends';
  }
  function rules(p, v, existing) {
    const seg = p.split('/');
    if (seg[0] === 'friends' || seg[0] === 'friendReq') return friendRules(seg, v);
    if (seg[0] === 'whisper') { // SAT-ONLINE-070: only from a friend; the one it is for deletes it
      if (!user || seg.length !== 3) return 'PERMISSION_DENIED: whisper ' + p;
      const old = data.get(p);
      if (v === null) return seg[1] === user.uid ? null : 'PERMISSION_DENIED: whisper remove';
      if (old || v.from !== user.uid || !data.has('friends/' + seg[1] + '/' + user.uid)) return 'PERMISSION_DENIED: whisper not a friend';
      return Object.keys(v).sort().join(',') === 'from,h,t,text' && typeof v.h === 'string' && v.h.length <= 24 && typeof v.text === 'string' && v.text.length >= 1 && v.text.length <= 120 && JSON.stringify(v.t) === JSON.stringify(SV) ? null : 'whisper fields';
    }
    if (seg[0] === 'reports') { // SAT-ONLINE-071: once, as yourself, about someone else
      if (!user || seg.length !== 2 || data.has(p) || !v || v.by !== user.uid) return 'PERMISSION_DENIED: reports';
      return Object.keys(v).sort().join(',') === 'about,aboutN,by,byN,said,t,why' && typeof v.about === 'string' && v.about !== user.uid && ['spam', 'abuse', 'cheat', 'other'].includes(v.why) && typeof v.said === 'string' && v.said.length <= 360 && JSON.stringify(v.t) === JSON.stringify(SV) ? null : 'reports fields';
    }
    if (seg[0] === 'admins') return 'PERMISSION_DENIED: admins'; // SAT-ONLINE-079: set in the console only
    if (seg[0] === 'appeals' || seg[0] === 'appealDone') { // SAT-ONLINE-087: a muted player's appeal, the owner's answer
      const adm = !!user && data.get('admins/' + user.uid) === true, now = Date.now(), old = data.get(p), mu = data.get('mutes/' + seg[1]);
      if (!user || seg.length !== 2) return 'PERMISSION_DENIED: ' + seg[0];
      if (seg[0] === 'appeals') {
        if (v === null) return adm ? null : 'PERMISSION_DENIED: appeals remove';
        if (seg[1] !== user.uid || !mu || !(mu.until > now) || (old && old.mt === mu.t)) return 'PERMISSION_DENIED: appeals write';
        return Object.keys(v).sort().join(',') === 'mt,n,t,why' && v.mt === mu.t && typeof v.why === 'string' && v.why.length >= 1 && v.why.length <= 300 && typeof v.n === 'string' && v.n.length <= 24 && isSV(v.t) ? null : 'appeals values';
      }
      if (!adm || v === null) return 'PERMISSION_DENIED: appealDone';
      return Object.keys(v).sort().join(',') === 'a,by,mt,t' && v.mt === (data.get('appeals/' + seg[1]) || {}).mt && (v.a === 'lift' || v.a === 'keep') && v.by === user.uid && isSV(v.t) ? null : 'appealDone values';
    }
    if (seg[0] === 'balance') { // SAT-ONLINE-088: your own week's numbers; admins read them
      if (!user || seg.length !== 2 || seg[1] !== user.uid) return 'PERMISSION_DENIED: balance ' + p;
      if (v === null) return null;
      const n6 = (x) => isInt(x, 0) && x <= 1000000;
      const ks = Object.keys(v).sort().join(','), g11 = (x) => isInt(x, 0) && x <= 1e11; // gi, go: gold in and out (SAT-ONLINE-093)
      return (ks === 'cls,l,lv,n,s,t,w,wk' || (ks === 'cls,gi,go,l,lv,n,s,t,w,wk' && g11(v.gi) && g11(v.go))) && typeof v.wk === 'string' && /^w[0-9]{1,6}$/.test(v.wk) && typeof v.cls === 'string' && v.cls.length >= 1 && v.cls.length <= 16 && isInt(v.lv, 1) && v.lv <= 999 && n6(v.n) && typeof v.s === 'number' && v.s >= 0 && v.s <= 100000000 && n6(v.w) && n6(v.l) && isSV(v.t) ? null : 'balance values';
    }
    if (seg[0] === 'guildTrophy') { // SAT-ONLINE-090: a season's trophy, written by admins
      if (!user || seg.length !== 3 || data.get('admins/' + user.uid) !== true) return 'PERMISSION_DENIED: guildTrophy ' + p;
      if (v === null) return null;
      return /^s[0-9]{4}-[0-9]{2}$/.test(seg[2]) && Object.keys(v).sort().join(',') === 'by,k,p,t' && ['gold', 'silver', 'bronze'].includes(v.k) && isInt(v.p, 0) && v.p <= 100 && v.by === user.uid && isSV(v.t) ? null : 'guildTrophy values';
    }
    if (['repairOrders', 'repairDone', 'repairPaid'].includes(seg[0])) { // SAT-ONLINE-096: repair orders for player smiths
      if (!user) return 'PERMISSION_DENIED: ' + seg[0];
      const me = user.uid, old = data.get(p);
      if (seg[0] === 'repairOrders') {
        if (seg.length !== 2 || !/^r_[A-Za-z0-9_-]{1,60}$/.test(seg[1])) return 'PERMISSION_DENIED: repairOrders ' + p;
        if (v === null) return old && (old.by === me || ((after('repairDone/' + old.by + '/' + seg[1]) || {}).by === me && !data.has('repairDone/' + old.by + '/' + seg[1]))) ? null : 'PERMISSION_DENIED: repairOrders remove';
        if (old || v.by !== me) return 'PERMISSION_DENIED: repairOrders write';
        return Object.keys(v).sort().join(',') === 'by,d,fee,iid,it,n,t' && typeof v.n === 'string' && v.n.length <= 24 && IID_RE.test(v.iid) && typeof v.it === 'string' && v.it.length >= 1 && v.it.length <= 40 && isInt(v.d, 0) && v.d <= 99 && isInt(v.fee, 1) && v.fee <= 1e7 && isSV(v.t) ? null : 'repairOrders values';
      }
      if (seg.length !== 3) return 'PERMISSION_DENIED: ' + seg[0] + ' ' + p;
      const O = data.get('repairOrders/' + seg[2]);
      if (seg[0] === 'repairDone') {
        if (v === null) return seg[1] === me ? null : 'PERMISSION_DENIED: repairDone remove';
        if (old || !O || O.by !== seg[1] || seg[1] === me || after('repairOrders/' + seg[2]) !== null) return 'PERMISSION_DENIED: repairDone write';
        return Object.keys(v).sort().join(',') === 'by,fee,iid,sn,t' && v.iid === O.iid && v.fee === O.fee && v.by === me && typeof v.sn === 'string' && v.sn.length <= 24 && isSV(v.t) ? null : 'repairDone values';
      }
      if (seg[1] !== me) return 'PERMISSION_DENIED: repairPaid ' + p;
      if (v === null) return old !== undefined ? null : 'PERMISSION_DENIED: repairPaid remove'; // collected once: two pages of one account can't both
      if (old || !O || O.by === me || (after('repairDone/' + O.by + '/' + seg[2]) || {}).by !== me) return 'PERMISSION_DENIED: repairPaid write';
      return Object.keys(v).sort().join(',') === 'g,t' && v.g === O.fee && isSV(v.t) ? null : 'repairPaid values';
    }
    if (seg[0] === 'crashes' || seg[0] === 'mutes' || seg[0] === 'reportDone') { // SAT-ONLINE-082
      const adm = !!user && data.get('admins/' + user.uid) === true, now = Date.now(), old = data.get(p);
      if (!user || seg.length !== 2) return 'PERMISSION_DENIED: ' + seg[0];
      if (seg[0] === 'crashes') {
        if (old !== undefined || v === null) return 'PERMISSION_DENIED: crashes write';
        const ks = Object.keys(v).sort().join(',');
        if (ks !== 'by,m,s,t,v' && ks !== 'by,m,s,t,v,z') return 'crashes fields';
        return typeof v.m === 'string' && v.m.length >= 1 && v.m.length <= 200 && typeof v.s === 'string' && v.s.length <= 800 && typeof v.v === 'string' && v.v.length <= 16 && (v.z === undefined || (typeof v.z === 'string' && v.z.length <= 24)) && v.by === user.uid && isSV(v.t) ? null : 'crashes values';
      }
      if (!adm) return 'PERMISSION_DENIED: ' + seg[0] + ' admins only';
      if (v === null) return null;
      if (seg[0] === 'mutes') {
        const ks = Object.keys(v).sort().join(',');
        if (ks !== 'by,t,until' && ks !== 'by,t,until,why') return 'mutes fields';
        return typeof v.until === 'number' && v.until > now && v.until <= now + 2592000000 && (v.why === undefined || (typeof v.why === 'string' && v.why.length <= 60)) && v.by === user.uid && isSV(v.t) ? null : 'mutes values';
      }
      return Object.keys(v).sort().join(',') === 'a,by,t' && (v.a === 'ok' || v.a === 'mute') && v.by === user.uid && isSV(v.t) ? null : 'reportDone values';
    }
    if (seg[0] === 'announce') { // SAT-ONLINE-079: only an admin posts
      if (!user || seg.length !== 2 || data.get('admins/' + user.uid) !== true) return 'PERMISSION_DENIED: announce ' + p;
      if (v === null) return null;
      const keys = Object.keys(v).sort().join(','), str = (x) => typeof x === 'string' && x.length >= 1 && x.length <= 200, now = Date.now();
      if (!(keys === 'ar,by,en,k,t' && v.k === 'msg') && !(keys === 'ar,at,by,en,k,t' && (v.k === 'msg' || v.k === 'maint'))) return 'announce fields';
      if (v.at !== undefined && !(typeof v.at === 'number' && v.at > now && v.at <= now + 86400000)) return 'announce at';
      return str(v.ar) && str(v.en) && v.by === user.uid && isSV(v.t) ? null : 'announce values';
    }
    if (seg[0] === 'lfg') { // SAT-ONLINE-073: your own entry
      if (!user || seg.length !== 2 || seg[1] !== user.uid) return 'PERMISSION_DENIED: lfg ' + p;
      if (v === null) return null;
      return Object.keys(v).sort().join(',') === 'cls,k,lv,n,r,t,z' && ['', 'tank', 'healer', 'damage', 'support'].includes(v.r) && typeof v.n === 'string' && v.n.length >= 1 && v.n.length <= 24 && isInt(v.lv, 0) && v.lv <= 999 && ['raid', 'party', 'dungeon', 'duel'].includes(v.k) && typeof v.z === 'string' && v.z.length <= 24 && JSON.stringify(v.t) === JSON.stringify(SV) ? null : 'lfg fields';
    }
    if (seg[0] === 'lockouts') return lockRules(seg, v);
    if (seg[0] === 'nat' || seg[0] === 'natPaid') return natRules(seg, v);
    if (seg[0] === 'arena') return arenaRules(seg, v);
    if (seg[0] === 'world' && seg[2] === 'wb') return wbRules(seg, v);
    if (seg[0] === 'world') return worldRules(seg, v);
    if (seg[0] === 'ranks') return rankRules(seg, v);
    if (['guilds', 'guildNames', 'guildMembers', 'guildInv', 'guildChat', 'guildVault', 'guildVaultTaken', 'guildBank', 'guildBuild', 'guildLog', 'guildNote', 'guildRecruit', 'guildApply', 'guildRej', 'guildEvents', 'guildEventSign', 'guildWeek', 'guildWeekPaid', 'guildAllyAsk', 'guildAlly', 'guildAllyCd', 'guildDiplo', 'guildWarAsk', 'guildWar', 'guildWarKill'].includes(seg[0])) return guildRules(seg, v);
    if (seg[0] === 'drops' || seg[0] === 'dropClaims') return dropRules(seg, v);
    if (seg[0] === 'kills' || seg[0] === 'bounties' || seg[0] === 'bountyPaid') return bountyRules(seg, v);
    if (seg[0] === 'inbox') return inboxRules(seg, v, existing);
    if (seg[0] === 'profiles' || seg[0] === 'cloudIndex' || seg[0] === 'cloudSaves') return cloudRules(seg, v);
    if (seg[0] === 'handles' || seg[0] === 'accountIds' || seg[0] === 'chat' || seg[0] === 'news') return idRules(seg, v);
    // mobs/satisfy/{zone}/{uid} = {t, m: {key: "x,y,hp,flags,lv"}} (shared monsters, SAT-ONLINE-026)
    if (seg[0] === 'mobs') {
      if (seg.length !== 4 || seg[1] !== 'satisfy' || !/^[A-Za-z0-9_-]{1,24}$/.test(seg[2]) || !user || seg[3] !== user.uid) return 'PERMISSION_DENIED: mobs ' + p;
      if (v === null) return null;
      if (Object.keys(v).sort().join(',') !== 'm,t' || JSON.stringify(v.t) !== JSON.stringify(SV) || !v.m || typeof v.m !== 'object') return 'mobs fields';
      return Object.keys(v.m).every((k) => /^[a-z0-9_]{1,16}@-?[0-9]{1,6},-?[0-9]{1,6}$/.test(k) && typeof v.m[k] === 'string' && v.m[k].length <= 64) ? null : 'mobs m';
    }
    if (seg[0] === 'tradeLog' || seg[0] === 'tradeRep') { // SAT-ONLINE-089: your own record of a trade done between the two
      if (!user || seg.length !== 3 || seg[1] !== user.uid || data.has(p) || v === null || !TID_RE.test(seg[2]) || !data.has('tradeDone/' + seg[2])) return 'PERMISSION_DENIED: ' + seg[0] + ' ' + p;
      const T = tradeMeta(seg[2]), me = user.uid, other = T && (T.a === me ? T.b : T.b === me ? T.a : null);
      if (!other || v.o !== other) return seg[0] + ' party';
      if (seg[0] === 'tradeRep') return Object.keys(v).sort().join(',') === 'o,t' && isSV(v.t) ? null : 'tradeRep values';
      const side = (u) => (data.get('tradeSides/' + seg[2] + '/' + u) || {}).g, cnt = (x) => isInt(x, 0) && x <= 8;
      return Object.keys(v).sort().join(',') === 'gg,gi,ig,ii,o,on,t' && v.gg === side(me) && v.gi === side(other) && cnt(v.ig) && cnt(v.ii) && typeof v.on === 'string' && v.on.length <= 24 && isSV(v.t) ? null : 'tradeLog values';
    }
    if (['trades', 'tradeSides', 'tradeDone', 'tradedItems'].includes(seg[0])) return tradeRules(seg, v);
    if (seg[0] === 'sessions') {
      if (seg.length !== 2 || !user || seg[1] !== user.uid) return 'PERMISSION_DENIED: not your session';
      if (v === null) return null;
      if (Object.keys(v).sort().join(',') !== 'sid,t' || typeof v.sid !== 'string' || v.sid.length < 8 || v.sid.length > 64) return 'session fields';
      return JSON.stringify(v.t) === JSON.stringify(SV) ? null : 'session t';
    }
    if (seg.length !== 4 || seg[0] !== 'presence' || seg[1] !== 'satisfy' || seg[2] !== 'main') return 'PERMISSION_DENIED: path ' + p;
    if (!user || seg[3] !== user.uid) return 'PERMISSION_DENIED: not your node';
    if (v === null) return null;
    for (const k in v) if (!FIELDS.includes(k)) return 'invalid field ' + k;
    for (const k of REQUIRED) if (!(k in v)) return 'missing ' + k;
    for (const k in v) if (v[k] === null) return 'null ' + k;
    if (v.v !== 1 || v.uid !== user.uid) return 'bad v/uid';
    if (JSON.stringify(v.t) !== JSON.stringify(SV)) return 't must be the server timestamp';
    if (typeof v.sid !== 'string' || v.sid.length < 8 || v.sid.length > 64) return 'sid';
    if (typeof v.handle !== 'string' || v.handle.length > 24) return 'handle';
    // the rules require handle = accountIds/{uid}; here only once the account has an ID, so tests that never pick one still run
    if (data.has('accountIds/' + user.uid) && v.handle !== data.get('accountIds/' + user.uid)) return 'handle is not the account ID';
    if (!(v.x >= 0 && v.x < POS_X && v.y >= POS_Y0 && v.y < POS_Y)) return 'position';
    if (!/^(idle|walk|attack|dodge|dead)$/.test(v.anim)) return 'anim';
    if (v.arm !== 0 && v.arm !== 1) return 'arm';
    if ('room' in v && (typeof v.room !== 'string' || v.room.length > 16)) return 'room';
    if ('party' in v && (typeof v.party !== 'string' || v.party.length > 40)) return 'party';
    if ('duel' in v && !(typeof v.duel === 'string' && /^d_[A-Za-z0-9_-]{1,40}:(100|[1-9]?[0-9])$/.test(v.duel))) return 'duel';
    if ('mv' in v && !(typeof v.mv === 'string' && /^[0-9a-f]{8}$/.test(v.mv))) return 'mv';
    if ('hp' in v && !(typeof v.hp === 'number' && v.hp >= 0 && v.hp <= 100)) return 'hp';
    if ('em' in v && !/^(wave|dance|point|cheer)$/.test(v.em)) return 'em';
    if ('role' in v && !/^(tank|healer|damage|support)$/.test(v.role)) return 'role';
    if ('rs' in v && !(typeof v.rs === 'string' && v.rs.length <= 1160 && /^[A-Za-z0-9:_.-]+( [A-Za-z0-9:_.-]+){0,8}$/.test(v.rs))) return 'rs';
    if ('rd' in v && v.rd !== 1) return 'rd';
    if ('ol' in v && v.ol !== 1 && v.ol !== 2) return 'ol';
    if ('gd' in v && !(typeof v.gd === 'string' && /^g_[A-Za-z0-9]{1,128}$/.test(v.gd))) return 'gd';
    if ('wp' in v && !/^[a-z0-9_]{1,16}:[0-9](:[0-9]{1,2})?$/.test(v.wp)) return 'wp';
    if ('fx' in v && !(typeof v.fx === 'string' && v.fx.length <= 2400)) return 'fx';
    if ('gu' in v && !(Number.isInteger(v.gu) && v.gu >= 1 && v.gu <= 256)) return 'gu';
    return null;
  }
  // SAT-ONLINE-026: handles/{lowercase ID} = uid (first come), accountIds/{uid} = ID (needs that handle), world feeds
  // chat|news/satisfy/{id} = {from, h, ...} written as yourself under your ID, removable by anyone after 10 min
  function idRules(seg, v) {
    if (!user) return 'PERMISSION_DENIED: signed out';
    const p = seg.join('/'), old = data.has(p) ? data.get(p) : undefined;
    if (seg[0] === 'handles') {
      if (seg.length !== 2) return 'PERMISSION_DENIED: path';
      if (v === null) return old === user.uid ? null : 'PERMISSION_DENIED: not your handle';
      if (old !== undefined || v !== user.uid) return 'PERMISSION_DENIED: handle taken';
      return /^[a-z0-9_]{3,16}$/.test(seg[1]) ? null : 'handle name';
    }
    if (seg[0] === 'accountIds') {
      if (seg.length !== 2 || seg[1] !== user.uid) return 'PERMISSION_DENIED: not your id';
      if (v === null) return null;
      if (old !== undefined) return 'PERMISSION_DENIED: id is set';
      return typeof v === 'string' && /^[A-Za-z0-9_]{3,16}$/.test(v) && data.get('handles/' + v.toLowerCase()) === user.uid ? null : 'account id';
    }
    if (seg.length !== 3 || seg[1] !== 'satisfy') return 'PERMISSION_DENIED: path';
    if (v === null) return old && old.t < Date.now() - 600000 ? null : 'PERMISSION_DENIED: too new';
    if (old !== undefined) return 'PERMISSION_DENIED: write once';
    if (v.from !== user.uid || v.h !== data.get('accountIds/' + user.uid) || JSON.stringify(v.t) !== JSON.stringify(SV)) return seg[0] + ' from/h/t';
    if (seg[0] === 'chat' && data.has('mutes/' + user.uid) && !(data.get('mutes/' + user.uid).until < Date.now())) return 'PERMISSION_DENIED: muted'; // SAT-ONLINE-082
    if (seg[0] === 'chat') return keysAre(v, ['from', 'h', 'text', 't']) && typeof v.text === 'string' && v.text.length >= 1 && v.text.length <= 120 ? null : 'chat fields';
    if (!/^[A-Za-z]{2,16}$/.test(v.k) || Object.keys(v).some((k) => !['from', 'h', 'k', 'p', 't'].includes(k))) return 'news fields';
    return !v.p || Object.keys(v.p).every((k) => ['lv', 'f', 'rk'].includes(k) && typeof v.p[k] === 'number') ? null : 'news p';
  }
  // profiles/{uid}, cloudIndex/{uid}/{pid}, cloudSaves/{uid}/{pid} (SAT-ONLINE-007): owner writes only
  const PID = /^[a-z0-9_]{4,40}$/;
  const keysAre = (o, want) => Object.keys(o).sort().join(',') === [...want].sort().join(',');
  const lookOk = (l) => l && keysAre(l, ['hair', 'hc', 'skin', 'top']) && Object.values(l).every((n) => typeof n === 'number' && n >= 0 && n <= 31);
  function cloudRules(seg, v) {
    if (!user || seg[1] !== user.uid) return 'PERMISSION_DENIED: not your ' + seg[0];
    if (v === null) return seg.length === (seg[0] === 'profiles' ? 2 : 3) ? null : 'PERMISSION_DENIED: path';
    if (JSON.stringify(v.t) !== JSON.stringify(SV)) return seg[0] + ' t';
    if (seg[0] === 'profiles') {
      if (seg.length !== 2) return 'PERMISSION_DENIED: path';
      if (!keysAre(v, ['handle', 'look', 'language', 'titleId', 'classId', 'lv', 'revision', 't'])) return 'profile fields';
      if (typeof v.handle !== 'string' || v.handle.length > 24 || !lookOk(v.look) || !['ar', 'en'].includes(v.language)) return 'profile values';
      if (typeof v.titleId !== 'string' || v.titleId.length > 32 || typeof v.classId !== 'string' || v.classId.length > 16) return 'profile values';
      if (!(v.lv >= 1 && v.lv <= 999) || !(v.revision >= 0)) return 'profile values';
      const old = data.get(seg.join('/'));
      if (old && !(v.revision > old.revision)) return 'profile revision must go up';
      return null;
    }
    if (seg.length !== 3 || !PID.test(seg[2])) return 'PERMISSION_DENIED: path';
    if (seg[0] === 'cloudSaves') {
      if (!keysAre(v, ['blob', 'rev', 't'])) return 'cloud save fields';
      return typeof v.blob === 'string' && v.blob.length > 0 && v.blob.length <= 400000 && v.rev >= 0 ? null : 'cloud save values';
    }
    if (!keysAre(v, ['pid', 'handle', 'lv', 'cls', 'schema', 'savedAt', 'rev', 'size', 't'])) return 'cloud index fields';
    if (v.pid !== seg[2] || typeof v.handle !== 'string' || v.handle.length > 24 || typeof v.cls !== 'string' || v.cls.length > 16) return 'cloud index values';
    return v.lv >= 1 && v.lv <= 999 && v.schema >= 1 && v.schema <= 99 && v.savedAt >= 0 && v.rev >= 0 && v.size >= 1 && v.size <= 400000 ? null : 'cloud index values';
  }

  // inbox/{uid}/{msg}: the owner may delete; anyone signed in may create a new message as themselves
  function inboxRules(seg, v, existing) {
    if (seg.length !== 3 || !user) return 'PERMISSION_DENIED: inbox path';
    if (v === null) return seg[1] === user.uid ? null : 'PERMISSION_DENIED: not your inbox';
    if (existing) return 'PERMISSION_DENIED: inbox messages are write-once';
    if (v.from !== user.uid) return 'PERMISSION_DENIED: forged from';
    const keys = Object.keys(v).sort().join(',');
    if (keys !== 'from,payload,seq,sid,t,type') return 'inbox fields ' + keys;
    if (!/^(party\.(invite|accept|decline|kick|ping)|duel\.(challenge|accept|decline|ready|hit|hp|yield|end)|raid\.(hit|state|kill)|chat\.(say)|pvp\.(hit|kill)|trade\.(ask|accept|decline|cancel))$/.test(v.type)) return 'inbox type';
    const pk = Object.keys(v.payload).sort().join(',');
    if (v.payload.to !== seg[1]) return 'inbox payload';
    if (v.type.startsWith('party.')) {
      const ok = v.type === 'party.ping' ? ['k,n,party,to'] : v.type === 'party.kick' ? ['party,to', 'k,party,to'] : ['party,to']; // kick k: 1 (SAT-ONLINE-037)
      if (!ok.includes(pk)) return 'inbox payload ' + pk;
      if (v.type === 'party.kick' && 'k' in v.payload && v.payload.k !== 1) return 'inbox kick k';
      if (v.type === 'party.ping' && !(v.payload.k >= 0 && v.payload.k <= 1000000000 && v.payload.n >= -4096 && v.payload.n <= 1000000000)) return 'inbox ping';
      if (typeof v.payload.party !== 'string' || v.payload.party.length > 40) return 'inbox party';
    } else if (v.type.startsWith('chat.')) {
      if (pk !== 'party,text,to') return 'inbox chat payload ' + pk;
      if (typeof v.payload.party !== 'string' || v.payload.party.length > 40) return 'inbox party';
      if (typeof v.payload.text !== 'string' || v.payload.text.length < 1 || v.payload.text.length > 120) return 'inbox text';
    } else if (v.type.startsWith('pvp.')) {
      if (!['k,to', 'k,n,to'].includes(pk)) return 'inbox pvp payload ' + pk;
      if (!(typeof v.payload.k === 'number' && v.payload.k >= 0 && v.payload.k <= 1000000000)) return 'inbox k';
      if ('n' in v.payload && !(typeof v.payload.n === 'number' && v.payload.n >= 0 && v.payload.n <= 1000000000)) return 'inbox n';
    } else if (v.type.startsWith('trade.')) {
      if (pk !== 'to,trade' || !TID_RE.test(v.payload.trade)) return 'inbox trade payload ' + pk;
    } else if (v.type.startsWith('raid.')) {
      if (!['raid,to', 'k,raid,to', 'k,n,raid,to'].includes(pk)) return 'inbox raid payload ' + pk;
      if (typeof v.payload.raid !== 'string' || v.payload.raid.length > 64) return 'inbox raid';
      if ('k' in v.payload && !(typeof v.payload.k === 'number' && v.payload.k >= 0 && v.payload.k <= 1000000000)) return 'inbox k';
      if ('n' in v.payload && !(typeof v.payload.n === 'number' && v.payload.n >= 0 && v.payload.n <= 1000000000)) return 'inbox n';
    } else {
      if (!['duel,to', 'duel,k,to', 'duel,k,n,to'].includes(pk)) return 'inbox duel payload ' + pk;
      if (typeof v.payload.duel !== 'string' || v.payload.duel.length > 40) return 'inbox duel';
      if ('k' in v.payload && !(typeof v.payload.k === 'number' && v.payload.k >= 0 && v.payload.k <= 1000000000)) return 'inbox k';
      if ('n' in v.payload && !(typeof v.payload.n === 'number' && v.payload.n >= 0 && v.payload.n <= 1000000000)) return 'inbox n';
    }
    if (JSON.stringify(v.t) !== JSON.stringify(SV)) return 'inbox t';
    return null;
  }

  // query(ref, orderByChild(k), startAt(lo), endAt(hi)): numeric range on one child, as RTDB orders it
  // (a child without a number there sorts before every number, so a range never includes it);
  // equalTo(v): exactly that value (a child without it never matches)
  function matcher(q) {
    if (!q || !q.child) return () => true;
    if ('eq' in q) return (v) => !!v && v[q.child] === q.eq;
    return (v) => { const x = v && v[q.child]; return typeof x === 'number' && (q.lo == null || x >= q.lo) && (q.hi == null || x <= q.hi); };
  }
  function listen(type) {
    return (r, cb) => {
      const match = matcher(r.q);
      const l = { type, parent: r.path, cb, match };
      listeners.push(l);
      F.listens.push({ path: r.path, type, q: r.q || null });
      if (type === 'added') for (const [p, v] of data) if (parentOf(p) === r.path && match(v)) setTimeout(() => cb(snap(p, v)), 0);
      return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
    };
  }

  const database = {
    getDatabase: (app, url) => { F.databaseURL = url; return {}; },
    ref: (db, path) => ({ path: path || '', key: path ? keyOf(path) : null }),
    query: (r, ...cs) => ({ path: r.path, key: r.key, q: Object.assign({}, r.q, ...cs) }),
    orderByChild: (child) => ({ child }),
    startAt: (lo) => ({ lo }),
    endAt: (hi) => ({ hi }),
    equalTo: (eq) => ({ eq }),
    serverTimestamp: () => SV,
    push: (r, v) => {
      const p = r.path + '/-' + Date.now().toString(36) + rid();
      const err = rules(p, v, false);
      F.log.push({ op: 'push', path: p, err });
      if (err) { F.rejected.push(err); return Promise.reject(Object.assign(new Error(err), { code: 'PERMISSION_DENIED' })); }
      const stored = clone(v); stored.t = Date.now();
      if (connected) write('set', p, stored); else pending.set(p, stored);
      return connected ? acked({ key: keyOf(p) }) : Promise.resolve({ key: keyOf(p) });
    },
    set: (r, v) => {
      const err = rules(r.path, v, false);
      F.log.push({ op: 'set', path: r.path, err });
      if (err) { F.rejected.push(err); return Promise.reject(Object.assign(new Error(err), { code: 'PERMISSION_DENIED' })); }
      const stored = clone(v); if (stored && typeof stored === 'object') stored.t = Date.now(); // handles/accountIds hold strings
      mine.add(r.path);
      if (!connected) { pending.set(r.path, stored); return Promise.resolve(); }
      write('set', r.path, stored);
      return acked();
    },
    // RTDB update(): merge into the stored node (null removes a field), then check the rules on the result
    update: (r, diff) => {
      if (!r.path) { // a multi-location update at the root (SAT-ONLINE-039): all or nothing, each path checked against the data before it
        // A claim (a path the rules let only its first writer take) waits its turn across the pages, as the real database
        // orders writes: the pages hold one lock in turn, and each waits for the last one's copy to arrive before it checks.
        // Without it two pages taking the same vault piece at once both passed on their own copies (Claude-B, #13).
        if (Object.keys(diff).some((p) => CLAIM_RE.test(p)) && navigator.locks) return navigator.locks.request('fake-rtdb-claim', () => new Promise((res) => setTimeout(res, CLAIM_WAIT)).then(() => rootUpdate(diff)));
        return rootUpdate(diff);
      }
      const cur = data.has(r.path) ? clone(data.get(r.path)) : (pending.has(r.path) ? clone(pending.get(r.path)) : {});
      // a key with slashes ("m/<key>") is a path inside the node, as RTDB update() takes it (SAT-ONLINE-042)
      for (const k in diff) {
        const ks = k.split('/'); let o = cur;
        for (let i = 0; i < ks.length - 1; i++) { if (!o[ks[i]] || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
        const last = ks[ks.length - 1];
        if (diff[k] === null) delete o[last]; else o[last] = clone(diff[k]);
      }
      if ('t' in diff) cur.t = diff.t; // the rules see the server-time sentinel, as with set()
      const err = rules(r.path, cur, false);
      F.log.push({ op: 'update', path: r.path, err, keys: Object.keys(diff).sort() });
      if (err) { F.rejected.push(err); return Promise.reject(Object.assign(new Error(err), { code: 'PERMISSION_DENIED' })); }
      const stored = clone(cur); stored.t = Date.now();
      mine.add(r.path);
      if (!connected) { pending.set(r.path, stored); return Promise.resolve(); }
      write('set', r.path, stored);
      return acked();
    },
    remove: (r) => {
      const err = rules(r.path, null, true);
      F.log.push({ op: 'remove', path: r.path, err });
      if (err) { F.rejected.push(err); return Promise.reject(new Error(err)); }
      mine.delete(r.path); pending.delete(r.path);
      if (connected) write('remove', r.path);
      return connected ? acked() : Promise.resolve();
    },
    // one-shot read: the node, nested as the server holds it (SAT-ONLINE-090; it was one level, enough for the cloud index)
    // the server answers reads with everything stored; here the other pages' copies arrive as hello replies, so a read
    // right after loading waits for them (otherwise a reload could read accountIds before they came back)
    get: (r) => {
      const wait = helloAt + 150 - Date.now();
      if (wait > 0) return new Promise((res) => setTimeout(res, wait)).then(() => database.get(r));
      const seg = r.path.split('/');
      const tm = ['trades', 'tradeSides', 'tradeDone'].includes(seg[0]) && tradeMeta(seg[1]);
      const readable = ['profiles', 'accountIds', 'handles', 'chat', 'news', 'presence', 'mobs', 'tradedItems', 'kills', 'bounties', 'bountyPaid', 'drops', 'dropClaims', 'guilds', 'guildNames', 'guildMembers', 'arena', 'ranks', 'nat', 'lfg', 'guildRecruit', 'guildAlly', 'guildAllyCd', 'guildWar', 'guildWarKill', 'tradeRep', 'guildTrophy', 'repairOrders'].includes(seg[0]) ? !!user : seg[0] === 'guildWeek' && seg.length === 1 ? !!user && data.get('admins/' + user.uid) === true : (seg[0] === 'repairDone' || seg[0] === 'repairPaid') ? !!user && seg[1] === user.uid : seg[0] === 'tradeLog' ? !!user && seg[1] === user.uid : seg[0] === 'guildAllyAsk' ? !!user && seg.length === 3 && ['m', 'o'].includes(rkOf(seg[2], user.uid)) : seg[0] === 'guildWeekPaid' ? !!user && seg.length === 4 && seg[3] === user.uid : (seg[0] === 'guildApply' || seg[0] === 'guildRej') ? !!user && (seg.length === 3 ? seg[2] === user.uid : rightOf(seg[1], user.uid, 'inv')) : seg[0] === 'guildInv' ? !!user && seg[1] === user.uid : ['guildBank', 'guildBuild', 'guildLog', 'guildNote'].includes(seg[0]) ? !!user && data.has('guildMembers/' + seg[1] + '/' + user.uid) : tm ? !!user && (tm.a === user.uid || tm.b === user.uid) : ['cloudIndex', 'cloudSaves', 'inbox', 'sessions', 'lockouts', 'friends', 'friendReq', 'whisper', 'admins'].includes(seg[0]) && user && seg[1] === user.uid || ['crashes', 'reports', 'reportDone', 'balance'].includes(seg[0]) && !!user && data.get('admins/' + user.uid) === true || ['appeals', 'appealDone'].includes(seg[0]) && !!user && (data.get('admins/' + user.uid) === true || (seg.length === 2 && seg[1] === user.uid)) || seg[0] === 'mutes' && !!user || seg[0] === 'natPaid' && !!user && seg[2] === user.uid;
      F.log.push({ op: 'get', path: r.path });
      if (!readable) return Promise.reject(Object.assign(new Error('PERMISSION_DENIED: read ' + r.path), { code: 'PERMISSION_DENIED' }));
      return Promise.resolve(snap(r.path, nodeVal(r.path))); // the node as the server holds it, nested (SAT-ONLINE-090: guildWeek)
    },
    onChildAdded: listen('added'),
    onChildChanged: listen('changed'),
    onChildRemoved: listen('removed'),
    onValue: (r, cb) => {
      if (r.path === '.info/serverTimeOffset') { setTimeout(() => cb(snap(r.path, F.serverOffset || 0)), 0); return () => {}; } // a test sets F.serverOffset for a device whose clock is off
      if (r.path !== '.info/connected') {
        const seg = r.path.split('/');
        const tm = (seg[0] === 'tradeSides' && seg.length === 3) || (seg[0] === 'tradeDone' && seg.length === 2) ? tradeMeta(seg[1]) : null;
        const gl = (seg[0] === 'guilds' || seg[0] === 'guildMembers') && seg.length === 2 ? !!user : ['guildVault', 'guildBank', 'guildBuild', 'guildLog', 'guildNote', 'guildEvents', 'guildEventSign', 'guildDiplo'].includes(seg[0]) && seg.length === 2 ? !!user && data.has('guildMembers/' + seg[1] + '/' + user.uid) : (seg[0] === 'guildAlly' || seg[0] === 'guildWar') && seg.length === 2 ? !!user : seg[0] === 'guildWarKill' && seg.length === 3 ? !!user : (seg[0] === 'guildAllyAsk' || seg[0] === 'guildWarAsk') && seg.length === 2 ? !!user && ['m', 'o'].includes(rkOf(seg[1], user.uid)) : seg[0] === 'guildWeek' && seg.length === 3 ? !!user && data.has('guildMembers/' + seg[1] + '/' + user.uid) : seg[0] === 'guildApply' && seg.length === 2 ? !!user && rightOf(seg[1], user.uid, 'inv') : seg[0] === 'guildInv' && seg.length === 2 ? !!user && seg[1] === user.uid : null;
        const ok = gl !== null ? gl : r.path === 'bounties' || r.path === 'lfg' || r.path === 'announce' || seg[0] === 'mutes' && seg.length === 2 ? !!user : seg[0] === 'appealDone' && seg.length === 2 ? !!user && seg[1] === user.uid : seg[0] === 'sessions' || seg[0] === 'lockouts' || seg[0] === 'friends' || seg[0] === 'friendReq' || ((seg[0] === 'repairDone' || seg[0] === 'repairPaid') && seg.length === 2) ? user && seg[1] === user.uid : tm ? !!user && (tm.a === user.uid || tm.b === user.uid) : (seg[0] === 'presence' && seg.length === 4 || r.path === 'world/satisfy/own' || r.path === 'world/satisfy/legends' || r.path === 'world/satisfy/wb') && !!user;
        if (!ok) throw new Error('fake onValue: unsupported path ' + r.path);
        F.listens.push({ path: r.path, type: 'value', q: null });
        if (!valueCbs.has(r.path)) valueCbs.set(r.path, []);
        valueCbs.get(r.path).push(cb);
        setTimeout(() => cb(snap(r.path, nodeVal(r.path))), 0);
        return () => { const a = valueCbs.get(r.path) || [], i = a.indexOf(cb); if (i >= 0) a.splice(i, 1); };
      }
      connCbs.push(cb);
      setTimeout(() => cb(snap(r.path, connected)), 0);
      return () => { const i = connCbs.indexOf(cb); if (i >= 0) connCbs.splice(i, 1); };
    },
    onDisconnect: (r) => ({ remove: () => { discon.add(r.path); return Promise.resolve(); }, cancel: () => { discon.delete(r.path); F.log.push({ op: 'cancelOnDisconnect', path: r.path }); return Promise.resolve(); } }),
  };

  // Simulates the network dropping: the "server" runs onDisconnect for this client, the client sees
  // nobody else until it reconnects, and writes made meanwhile are flushed on reconnect.
  F.setConnected = (up) => {
    if (!up && connected) {
      for (const p of discon) ch.postMessage({ op: 'remove', p });
      discon.clear();
      for (const p of [...data.keys()]) if (!mine.has(p)) apply('remove', p);
      connected = false;
    } else if (up && !connected) {
      connected = true;
      for (const [p, v] of pending) write('set', p, v);
      pending.clear();
      ch.postMessage({ op: 'hello' });
    }
    for (const cb of connCbs) setTimeout(() => cb(snap('.info/connected', connected)), 0);
  };
  addEventListener('pagehide', () => { for (const p of discon) ch.postMessage({ op: 'remove', p }); });
  // what this page listens to and has armed for a disconnect now (SAT-ONLINE-112: a reconnect must not add listeners)
  F.active = () => ({ child: listeners.length, value: [...valueCbs.values()].reduce((n, a) => n + a.length, 0), conn: connCbs.length, discon: [...discon].sort() });

  const auth = {
    getAuth: () => ({}),
    // the real provider's setCustomParameters (37f15f6: prompt=select_account shows the account chooser every time)
    GoogleAuthProvider: function GoogleAuthProvider() { this.params = {}; this.setCustomParameters = (o) => { this.params = Object.assign({}, o); return this; }; },
    onAuthStateChanged: (a, cb) => {
      if (!user) { try { user = JSON.parse(sessionStorage.getItem('fakeFirebaseUser')); } catch (e) { user = null; } }
      setTimeout(() => cb(user), 0);
      return () => {};
    },
    signInWithPopup: (a, provider) => {
      F.authParams = provider && provider.params ? provider.params : null;
      if (F.popupBlocked) return Promise.reject(Object.assign(new Error('blocked'), { code: 'auth/popup-blocked' }));
      user = { uid: F.nextUid || 'g' + rid(), displayName: F.nextName }; // nextUid: the same Google account on a second device
      sessionStorage.setItem('fakeFirebaseUser', JSON.stringify(user));
      return Promise.resolve({ user });
    },
    signInWithRedirect: (a, provider) => { F.redirected = true; F.authParams = provider && provider.params ? provider.params : null; return Promise.resolve(); },
    signOut: () => { user = null; sessionStorage.removeItem('fakeFirebaseUser'); return Promise.resolve(); },
  };
  const app = { initializeApp: (cfg, name) => { F.config = cfg; return { name }; } };

  window.__SATISFY_FIREBASE_LOADER__ = (ver) => { F.sdkVersion = ver; ch.postMessage({ op: 'hello' }); helloAt = Date.now(); return Promise.resolve({ app, auth, database }); };
})();
