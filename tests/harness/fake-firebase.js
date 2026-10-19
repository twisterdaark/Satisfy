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
    const pp = parentOf(p);
    if (pp && !data.has(pp)) for (const cb of valueCbs.get(pp) || []) setTimeout(() => cb(snap(pp, nodeVal(pp))), 0);
  }
  function nodeVal(p) {
    if (data.has(p)) return data.get(p);
    const kids = {}; let n = 0;
    for (const [k, v] of data) if (parentOf(k) === p) { kids[keyOf(k)] = v; n++; }
    return n ? kids : null;
  }
  function apply(op, p, v) {
    if (op === 'set') { const old = data.get(p); data.set(p, v); fire(p, old, v); }
    else if (op === 'remove' && data.has(p)) { const old = data.get(p); data.delete(p); fire(p, old, undefined); }
  }
  ch.onmessage = (e) => {
    if (!connected) return;
    const m = e.data;
    // durable records (account IDs, handles: SAT-ONLINE-026) outlive the page that wrote them, as on the server
    if (m.op === 'hello') { for (const [p, v] of data) if (mine.has(p) || /^(accountIds|handles|kills|bounties|bountyPaid)\//.test(p)) ch.postMessage({ op: 'set', p, v }); return; }
    // A hello reply carries the replier's copy, which may be older than what this page has just written (a page
    // that reloads and claims sessions/{uid} at once). The real database orders writes, so keep the newest.
    const cur = data.get(m.p);
    if (m.op === 'set' && cur && m.v && typeof cur.t === 'number' && typeof m.v.t === 'number' && m.v.t < cur.t) return;
    apply(m.op, m.p, m.v);
  };
  function write(op, p, v) { apply(op, p, v); ch.postMessage({ op, p, v }); }

  const FIELDS = ['v', 'uid', 'sid', 'handle', 'look', 'cls', 'lv', 'title', 'zone', 'room', 'x', 'y', 'dir', 'anim', 'arm', 'party', 'duel', 'mv', 'hp', 'em', 'role', 'wp', 'fx', 'gu', 'rs', 'ol', 'seq', 't'];
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
  function rules(p, v, existing) {
    const seg = p.split('/');
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
    if ('rs' in v && !(typeof v.rs === 'string' && v.rs.length <= 515 && /^[A-Za-z0-9:_.-]+( [A-Za-z0-9:_.-]+){0,3}$/.test(v.rs))) return 'rs';
    if ('ol' in v && v.ol !== 1) return 'ol';
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
      return Promise.resolve({ key: keyOf(p) });
    },
    set: (r, v) => {
      const err = rules(r.path, v, false);
      F.log.push({ op: 'set', path: r.path, err });
      if (err) { F.rejected.push(err); return Promise.reject(Object.assign(new Error(err), { code: 'PERMISSION_DENIED' })); }
      const stored = clone(v); if (stored && typeof stored === 'object') stored.t = Date.now(); // handles/accountIds hold strings
      mine.add(r.path);
      if (!connected) { pending.set(r.path, stored); return Promise.resolve(); }
      write('set', r.path, stored);
      return Promise.resolve();
    },
    // RTDB update(): merge into the stored node (null removes a field), then check the rules on the result
    update: (r, diff) => {
      if (!r.path) { // a multi-location update at the root (SAT-ONLINE-039): all or nothing, each path checked against the data before it
        const ps = Object.keys(diff);bDiff = diff;let errs;try{errs = ps.map((p) => rules(p, diff[p], data.has(p))).filter(Boolean);}finally{bDiff = null;}
        F.log.push({ op: 'update', path: '', err: errs[0] || null, keys: ps.slice().sort() });
        if (errs.length) { F.rejected.push(errs[0]); return Promise.reject(Object.assign(new Error(errs[0]), { code: 'PERMISSION_DENIED' })); }
        const fix = (x) => (x && typeof x === 'object' ? (JSON.stringify(x) === JSON.stringify(SV) ? Date.now() : Object.fromEntries(Object.entries(x).map(([k, y]) => [k, fix(y)]))) : x);
        for (const p of ps) {
          if (diff[p] === null) { for (const k of [...data.keys()]) if (k === p || k.startsWith(p + '/')) { mine.delete(k); write('remove', k); } continue; }
          mine.add(p); write('set', p, fix(clone(diff[p])));
        }
        return Promise.resolve();
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
      return Promise.resolve();
    },
    remove: (r) => {
      const err = rules(r.path, null, true);
      F.log.push({ op: 'remove', path: r.path, err });
      if (err) { F.rejected.push(err); return Promise.reject(new Error(err)); }
      mine.delete(r.path); pending.delete(r.path);
      if (connected) write('remove', r.path);
      return Promise.resolve();
    },
    // one-shot read: the exact node, or its direct children as an object (enough for the cloud index)
    // the server answers reads with everything stored; here the other pages' copies arrive as hello replies, so a read
    // right after loading waits for them (otherwise a reload could read accountIds before they came back)
    get: (r) => {
      const wait = helloAt + 150 - Date.now();
      if (wait > 0) return new Promise((res) => setTimeout(res, wait)).then(() => database.get(r));
      const seg = r.path.split('/');
      const tm = ['trades', 'tradeSides', 'tradeDone'].includes(seg[0]) && tradeMeta(seg[1]);
      const readable = ['profiles', 'accountIds', 'handles', 'chat', 'news', 'presence', 'mobs', 'tradedItems', 'kills', 'bounties', 'bountyPaid'].includes(seg[0]) ? !!user : tm ? !!user && (tm.a === user.uid || tm.b === user.uid) : ['cloudIndex', 'cloudSaves', 'inbox', 'sessions'].includes(seg[0]) && user && seg[1] === user.uid;
      F.log.push({ op: 'get', path: r.path });
      if (!readable) return Promise.reject(Object.assign(new Error('PERMISSION_DENIED: read ' + r.path), { code: 'PERMISSION_DENIED' }));
      if (data.has(r.path)) return Promise.resolve(snap(r.path, data.get(r.path)));
      const kids = {};
      for (const [p, v] of data) if (parentOf(p) === r.path) kids[keyOf(p)] = v;
      return Promise.resolve(snap(r.path, Object.keys(kids).length ? kids : null));
    },
    onChildAdded: listen('added'),
    onChildChanged: listen('changed'),
    onChildRemoved: listen('removed'),
    onValue: (r, cb) => {
      if (r.path === '.info/serverTimeOffset') { setTimeout(() => cb(snap(r.path, F.serverOffset || 0)), 0); return () => {}; } // a test sets F.serverOffset for a device whose clock is off
      if (r.path !== '.info/connected') {
        const seg = r.path.split('/');
        const tm = (seg[0] === 'tradeSides' && seg.length === 3) || (seg[0] === 'tradeDone' && seg.length === 2) ? tradeMeta(seg[1]) : null;
        const ok = r.path === 'bounties' ? !!user : seg[0] === 'sessions' ? user && seg[1] === user.uid : tm ? !!user && (tm.a === user.uid || tm.b === user.uid) : (seg[0] === 'presence' && seg.length === 4 || r.path === 'world/satisfy/own') && !!user;
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
