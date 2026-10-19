'use strict';
// backend/database.rules.json must agree with the PlayerPublic contract and with the fake used in tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadModules, ROOT } = require('../harness/load-module.cjs');

const { net: N } = loadModules('src/net/contracts.js');
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend/database.rules.json'), 'utf8')).rules;
const node = rules.presence.$world.$shard.$uid;
const firebaseJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
const NULLABLE = ['title', 'room', 'party', 'duel', 'mv', 'hp', 'em', 'role', 'wp', 'fx', 'gu', 'rs', 'ol', 'gd']; // omitted when null/empty is allowed by the client

test('deny by default; presence readable only when signed in, writable only by its owner', () => {
  assert.equal(rules['.read'], false);
  assert.equal(rules['.write'], false);
  assert.equal(rules.presence.$world.$shard['.read'], 'auth != null');
  assert.equal(node['.write'], 'auth != null && auth.uid === $uid');
  assert.equal(node.uid['.validate'], 'newData.val() === $uid');
  assert.equal(node.t['.validate'], 'newData.val() === now', 'server time only');
  assert.equal(node.$other['.validate'], false, 'unknown fields rejected');
  assert.equal(firebaseJson.database.rules, 'backend/database.rules.json');
});

test('every PlayerPublic field has a rule, required fields match the contract', () => {
  for (const f of N.PUBLIC_FIELDS) assert.ok(node[f], `rule for ${f}`);
  assert.ok(node.seq, 'rule for seq');
  const required = /hasChildren\(\[(.*)\]\)/.exec(node['.validate'])[1].split(',').map((s) => s.trim().replace(/'/g, ''));
  assert.deepEqual(required.sort(), [...N.PUBLIC_FIELDS.filter((f) => !NULLABLE.includes(f)), 'seq'].sort());
});

test('limits match the contract and the world', () => {
  assert.match(node.handle['.validate'], new RegExp('length <= ' + N.LIMITS.handle));
  assert.match(node.title['.validate'], new RegExp('length <= ' + N.LIMITS.title));
  assert.match(node.x['.validate'], new RegExp('< ' + N.LIMITS.posX + '"?$'));
  assert.match(node.y['.validate'], new RegExp('< ' + N.LIMITS.posY + '"?$'));
  const anims = /\^\((.*)\)\$/.exec(node.anim['.validate'])[1].split('|');
  assert.deepEqual(anims, N.ANIMS);
  assert.deepEqual(/\^\((.*)\)\$/.exec(node.em['.validate'])[1].split('|'), N.EMOTES, 'emotes: the same fixed list');
  assert.deepEqual(/\^\((.*)\)\$/.exec(node.role['.validate'])[1].split('|'), N.ROLES, 'party roles: the same fixed list');
});

test('the test fake enforces the same required fields', () => {
  const fake = fs.readFileSync(path.join(ROOT, 'tests/harness/fake-firebase.js'), 'utf8');
  const req = JSON.parse(/const REQUIRED = (\[.*\]);/.exec(fake)[1].replace(/'/g, '"'));
  assert.deepEqual(req.sort(), [...N.PUBLIC_FIELDS.filter((f) => !NULLABLE.includes(f)), 'seq'].sort());
});

test('position bounds cover the whole map, and the fake uses the same bounds', () => {
  // Read the map size from index.html so a wider map fails here, not in a live Winston write.
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = /TS=(\d+),LW=(\d+),GAPS=(\[\[[\d,\[\]]*\]\]),MW=.*?,MH=(\d+)/.exec(html);
  assert.ok(m, 'map constants found in index.html');
  const [ts, lw, gaps, mh] = [+m[1], +m[2], JSON.parse(m[3]), +m[4]];
  const mw = lw + gaps.reduce((a, g) => a + g[1], 0);
  assert.ok(mw * ts <= N.LIMITS.posX, `map width ${mw * ts}px fits under ${N.LIMITS.posX}`);
  assert.ok(mh * ts <= N.LIMITS.posY, `map height ${mh * ts}px fits under ${N.LIMITS.posY}`);
  // the north (SAT-WORLD-003) is rows -NR..-1: y goes down to -NR*TS
  const nr = +(/,NR=(\d+)/.exec(html) || [0, 0])[1];
  assert.ok(-nr * ts >= N.LIMITS.posYMin, `north edge ${-nr * ts}px fits above ${N.LIMITS.posYMin}`);
  assert.match(node.y['.validate'], new RegExp('>= ' + N.LIMITS.posYMin + ' '));
  const fake = fs.readFileSync(path.join(ROOT, 'tests/harness/fake-firebase.js'), 'utf8');
  const fb = /const POS_X = (\d+), POS_Y = (\d+), POS_Y0 = (-\d+);/.exec(fake);
  assert.deepEqual([+fb[1], +fb[2], +fb[3]], [N.LIMITS.posX, N.LIMITS.posY, N.LIMITS.posYMin]);
});

test('presence is indexed on exactly the children the interest queries order by (U009: x; party)', () => {
  assert.deepEqual(rules.presence.$world.$shard['.indexOn'], ['x', 'party']);
  const fb = fs.readFileSync(path.join(ROOT, 'src/net/firebase.js'), 'utf8');
  assert.deepEqual([...new Set([...fb.matchAll(/orderByChild\('(\w+)'\)/g)].map((m) => m[1]))].sort(), ['party', 'r', 't', 'x']);
  assert.deepEqual(rules.arena.$season['.indexOn'], ['r'], 'the arena board orders by rating (SAT-ONLINE-053)');
  assert.deepEqual(rules.chat.$world['.indexOn'], ['t'], 'world chat prunes old lines by t (SAT-ONLINE-026)');
  // the radius must cover the screen after a full re-centre step: |offset| <= step, half screen = W / 2
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const I = /const NET_INTEREST=\{radius:(\d+),step:(\d+)\}/.exec(html), W = +/const W=(\d+),H=/.exec(html)[1];
  assert.ok(I, 'NET_INTEREST in index.html');
  assert.ok(+I[2] + W / 2 < +I[1], `step ${I[2]} + half screen ${W / 2} < radius ${I[1]}`);
});

test('inbox: only the owner reads and deletes; senders create write-once messages as themselves', () => {
  const box = rules.inbox.$uid, msg = box.$msg;
  assert.equal(box['.read'], 'auth != null && auth.uid === $uid');
  assert.equal(msg['.write'], "auth != null && ((auth.uid === $uid && !newData.exists()) || (!data.exists() && newData.child('from').val() === auth.uid))");
  assert.equal(msg.payload.to['.validate'], 'newData.val() === $uid');
  assert.equal(msg.t['.validate'], 'newData.val() === now');
  assert.equal(msg.$other['.validate'], false);
  assert.equal(msg.payload.$other['.validate'], false);
  // "party\.(a|b)|duel\.(c|d)" -> ['party.a', 'party.b', 'duel.c', 'duel.d']
  const expand = (src) => [...src.matchAll(/(\w+)\\\.\(([^)]*)\)/g)].flatMap((m) => m[2].split('|').map((x) => m[1] + '.' + x));
  const types = expand(/matches\(\/(.*)\/\)/.exec(msg.type['.validate'])[1]);
  const fb = fs.readFileSync(path.join(ROOT, 'src/net/firebase.js'), 'utf8');
  const sent = expand(/DIRECTED = \/(.*)\/;/.exec(fb)[1]);
  assert.deepEqual(types, sent, 'rules accept exactly the messages the transport sends');
  assert.deepEqual(types.filter((x) => x.startsWith('party.')), ['party.invite', 'party.accept', 'party.decline', 'party.kick', 'party.ping']);
  const { duel: DU } = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/duel.js');
  assert.deepEqual(types.filter((x) => x.startsWith('duel.')), [...DU.TYPES], 'every duel message can travel');
  const { raid: RA } = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/party.js', 'src/net/raid.js');
  assert.deepEqual(types.filter((x) => x.startsWith('raid.')), [...RA.TYPES], 'every raid message can travel');
  assert.match(msg.payload.raid['.validate'], /length <= 64/);
  assert.match(msg.payload['.validate'], /beginsWith\('raid\.'\)/);
  const fake = fs.readFileSync(path.join(ROOT, 'tests/harness/fake-firebase.js'), 'utf8');
  assert.deepEqual(expand(/if \(!\/(.*)\/\.test\(v\.type\)\)/.exec(fake)[1]), types, 'the fake accepts the same types');
  for (const f of ['party', 'duel']) assert.match(msg.payload[f]['.validate'], /length <= 40/);
  assert.match(msg.payload['.validate'], /beginsWith\('party\.'\)/);
  assert.match(msg.payload['.validate'], /beginsWith\('duel\.'\)/);
  // SAT-ONLINE-016: party chat, text only in chat messages, as long as Satisfy.chat allows
  const { chat: CH } = loadModules('src/net/chat.js');
  assert.deepEqual(types.filter((x) => x.startsWith('chat.')), [...CH.TYPES]);
  assert.match(msg.payload.text['.validate'], new RegExp('length <= ' + CH.C.MAX_LEN + '$'));
  assert.match(msg.payload['.validate'], /beginsWith\('chat\.'\) && newData\.hasChildren\(\['party', 'text'\]\)/);
  // SAT-ONLINE-038: open PvP hits and kill reports, k (and n) only
  const { pvp: PV } = loadModules('src/net/contracts.js', 'src/net/pvp.js');
  assert.deepEqual(types.filter((x) => x.startsWith('pvp.')), [...PV.TYPES], 'every pvp message can travel');
  assert.match(msg.payload['.validate'], /beginsWith\('pvp\.'\) && newData\.hasChild\('k'\) && !newData\.hasChild\('party'\) && !newData\.hasChild\('duel'\) && !newData\.hasChild\('raid'\) && !newData\.hasChild\('text'\)/);
  assert.equal(node.ol['.validate'], 'newData.val() === 1 || newData.val() === 2', 'the outlaw mark is 1, 2 (a murderer: SAT-ONLINE-052) or absent');
  // SAT-ONLINE-039: trade asks carry only the trade id
  const { trade: TR } = loadModules('src/net/contracts.js', 'src/net/presence.js', 'src/net/trade.js');
  assert.deepEqual(types.filter((x) => x.startsWith('trade.')), [...TR.TYPES], 'every trade message can travel');
  assert.match(msg.payload['.validate'], /beginsWith\('trade\.'\) && newData\.hasChild\('trade'\) && !newData\.hasChild\('party'\) && !newData\.hasChild\('duel'\) && !newData\.hasChild\('raid'\) && !newData\.hasChild\('text'\) && !newData\.hasChild\('k'\) && !newData\.hasChild\('n'\)/);
  assert.equal(msg.payload.trade['.validate'], "newData.isString() && newData.val().matches(/" + TR.ID_RE.source + "/)");
  for (const kind of ['party', 'duel', 'raid', 'pvp', 'trade']) assert.match(msg.payload['.validate'], new RegExp("beginsWith\\('" + kind + "\\.'\\)[^|]*!newData\\.hasChild\\('text'\\)"), kind + ' messages carry no text');
});

test('profiles and cloud saves: owner writes only; cloud saves are private; limits match Satisfy.cloud', () => {
  const { cloud: CL } = loadModules('src/net/cloud.js');
  const prof = rules.profiles.$uid, idx = rules.cloudIndex.$uid, sav = rules.cloudSaves.$uid;
  const owner = 'auth != null && auth.uid === $uid';
  assert.equal(prof['.read'], 'auth != null', 'the public profile is readable by signed-in players');
  assert.equal(prof['.write'], owner);
  assert.match(prof['.validate'], /revision'\)\.val\(\) > data\.child\('revision'\)\.val\(\)/, 'no stale overwrite');
  for (const n of [idx, sav]) { assert.equal(n['.read'], owner, 'cloud saves are private'); assert.equal(n.$pid['.write'], owner); assert.equal(n.$pid.$other['.validate'], false); }
  assert.equal(prof.$other['.validate'], false);
  assert.match(sav.$pid.blob['.validate'], new RegExp('length <= ' + CL.MAX_BLOB + '$'));
  assert.match(idx.$pid.size['.validate'], new RegExp('<= ' + CL.MAX_BLOB + '$'));
  // doc §23 public fields, nothing private (gold, items) can be stored under the public parent
  const fields = Object.keys(prof).filter((k) => !k.startsWith('.') && !k.startsWith('$')).sort();
  assert.deepEqual(fields, ['classId', 'handle', 'language', 'look', 'lv', 'revision', 't', 'titleId']);
  const p = CL.profileFrom({ look: { n: 'G' } }, 'en', 1);
  assert.deepEqual(Object.keys(p).concat('t').sort(), fields, 'the client writes exactly these fields');
});

test('sessions: one lease node per account, owner only, server time', () => {
  const s = rules.sessions.$uid, owner = 'auth != null && auth.uid === $uid';
  assert.equal(s['.read'], owner);
  assert.equal(s['.write'], owner);
  assert.equal(s.t['.validate'], 'newData.val() === now');
  assert.equal(s.$other['.validate'], false);
  const fb = fs.readFileSync(path.join(ROOT, 'src/net/firebase.js'), 'utf8');
  assert.match(fb, /'sessions\/' \+ uid/);
});

// SAT-ONLINE-032 (review #12, optional there): one account can't create presence nodes under any number of shard names
test('presence: one shard name only', () => {
  assert.equal(rules.presence.$world.$shard['.validate'], "$shard === 'main'");
  const fake = fs.readFileSync(path.join(ROOT, 'tests/harness/fake-firebase.js'), 'utf8');
  assert.match(fake, /seg\[2\] !== 'main'/);
});

// SAT-ONLINE-039: the trade swap is guarded by the rules, not only by the clients
test('trades: participants only; each writes its own offer until the swap; the swap needs both confirms; the ledger moves an item once', () => {
  const tr = rules.trades.$tid, sides = rules.tradeSides.$tid, done = rules.tradeDone.$tid, led = rules.tradedItems.$iid;
  assert.equal(tr['.write'], "auth != null && !data.exists() && newData.child('a').val() === auth.uid", 'the asker creates it, once');
  assert.match(tr['.read'], /data\.child\('a'\)\.val\(\) === auth\.uid \|\| data\.child\('b'\)\.val\(\) === auth\.uid/);
  assert.match(sides.$uid['.write'], /^auth != null && auth\.uid === \$uid && /, 'only your own offer');
  assert.match(sides.$uid['.write'], /!root\.child\('tradeDone'\)\.child\(\$tid\)\.exists\(\)$/, 'frozen once the swap is written');
  assert.match(sides.$uid.it.$iid['.validate'], /length <= 600$/);
  assert.match(done['.write'], /!data\.exists\(\)/, 'the swap is written once');
  for (const k of ['acc', 'conf']) assert.ok(done['.write'].includes(`.child('${k}').val() === root.child('tradeSides').child($tid).child(root.child('trades').child($tid).child('b').val()).child('rev').val()`), 'both sides agree to the exact other offer: ' + k);
  assert.match(led['.write'], /!root\.child\('tradeDone'\)\.child\(newData\.child\('t'\)\.val\(\)\)\.exists\(\)/, 'only while the swap is being written');
  assert.match(led['.write'], /\(!data\.exists\(\) \|\| data\.child\('o'\)\.val\(\) === /, "only away from the item's recorded owner");
  assert.match(led['.write'], /\.child\('it'\)\.child\(\$iid\)\.exists\(\)/, 'only an item its giver offered');
  for (const n of [tr, sides.$uid, done, led]) assert.equal(n.$other['.validate'], false);
});

test('guilds: a founder makes one guild with a unique name; joining needs an invitation; ranks decide kicks and promotions', () => {
  const g = rules.guilds.$gid, nm = rules.guildNames.$nk, mem = rules.guildMembers.$gid, m = mem.$uid, inv = rules.guildInv.$uid;
  const { guild: GU } = loadModules('src/net/guild.js');
  assert.equal(rules.guilds['.read'], 'auth != null');
  assert.match(g['.write'], /!data\.exists\(\) && \$gid === 'g_' \+ auth\.uid/, 'a new guild is the founder\'s own id');
  assert.match(g['.write'], /data\.child\('master'\)\.val\(\) === auth\.uid/, 'only its master changes or removes it');
  assert.match(g['.validate'], /newData\.child\('nk'\)\.val\(\) === newData\.child\('name'\)\.val\(\)\.toLowerCase\(\)/);
  assert.match(g['.validate'], /child\('guildNames'\)\.child\(newData\.child\('nk'\)\.val\(\)\)\.val\(\) === \$gid/, 'written with its name entry');
  assert.equal(g.name['.validate'], 'newData.isString() && newData.val().length >= ' + GU.C.NAME_MIN + ' && newData.val().length <= ' + GU.C.NAME_MAX);
  assert.match(nm['.write'], /!data\.exists\(\) && newData\.val\(\) === 'g_' \+ auth\.uid/, 'a name is taken once');
  assert.equal(mem['.write'], "auth != null && !newData.exists() && root.child('guilds').child($gid).child('master').val() === auth.uid", 'the master removes all members (disband)');
  assert.match(m['.write'], /newData\.child\('rk'\)\.val\(\) === 'r' && root\.child\('guildInv'\)\.child\(\$uid\)\.child\(\$gid\)\.exists\(\)/, 'join as a member, only while invited');
  assert.match(m['.write'], /newData\.child\('rk'\)\.val\(\) === data\.child\('rk'\)\.val\(\)/, 'nobody changes their own rank');
  assert.match(m['.write'], /data\.child\('rk'\)\.val\(\) !== 'm'\)/, 'the master does not just leave');
  assert.match(m['.write'], /data\.child\('rk'\)\.val\(\) === 'r' && root\.child\('guildMembers'\)\.child\(\$gid\)\.child\(auth\.uid\)\.child\('rk'\)\.val\(\) === 'o'/, 'an officer kicks members only');
  assert.match(m.rk['.validate'], /newData\.val\(\) === 'm' && \$uid === auth\.uid && \$gid === 'g_' \+ auth\.uid/, 'the only master is the founder');
  assert.equal(inv['.read'], 'auth != null && auth.uid === $uid', 'your invitations are yours to read');
  assert.match(inv.$gid['.write'], /=== 'm' \|\| .*=== 'o'\)/, 'masters and officers invite');
  assert.equal(inv.$gid.by['.validate'], 'newData.val() === auth.uid');
  for (const n of [g, m, inv.$gid]) assert.equal(n.$other['.validate'], false);
  assert.equal(node.gd['.validate'], "newData.isString() && newData.val().matches(/" + GU.GID_RE.source + "/)", 'presence gd: a guild id');
  // SAT-ONLINE-050: the vault; taking writes guildVaultTaken once, so one player gets a thing
  const gv = rules.guildVault.$gid, gt = rules.guildVaultTaken.$gid;
  assert.equal(gv['.read'], "auth != null && root.child('guildMembers').child($gid).child(auth.uid).exists()");
  assert.match(gv.$vid['.write'], /!data\.exists\(\) && newData\.child\('by'\)\.val\(\) === auth\.uid/, 'a member puts things in as itself');
  assert.match(gv.$vid['.write'], /=== 'o'\) \|\| data\.child\('by'\)\.val\(\) === auth\.uid\)/, 'the master and officers take out, a member its own');
  assert.match(gt.$vid['.write'], /!data\.exists\(\) && newData\.child\('by'\)\.val\(\) === auth\.uid && root\.child\('guildVault'\)\.child\(\$gid\)\.child\(\$vid\)\.exists\(\)/, 'once per thing');
  assert.equal(gv.$vid.it['.validate'], rules.tradeSides.$tid.$uid.it.$iid['.validate'].replace(/^\$iid\.matches\([^)]*\) && /, ''), 'an item as plain values, as in trades');
  // SAT-ONLINE-049: guild chat, members only
  const gc = rules.guildChat.$gid;
  assert.equal(gc['.read'], "auth != null && root.child('guildMembers').child($gid).child(auth.uid).exists()");
  assert.match(gc.$id['.write'], /root\.child\('guildMembers'\)\.child\(\$gid\)\.child\(auth\.uid\)\.exists\(\) && \(\(!data\.exists\(\) && newData\.child\('from'\)\.val\(\) === auth\.uid\)/);
  assert.equal(gc.$id.h['.validate'], rules.chat.$world.$id.h['.validate'], 'the sender is its account ID, as in world chat');
  assert.equal(gc.$id.text['.validate'], rules.chat.$world.$id.text['.validate']);
});

test('drops: the dropper writes it; one claim per drop, others after 2 s and within 60 s; the claimant or the dropper clears it', () => {
  const d = rules.drops.$did, c = rules.dropClaims.$did;
  assert.equal(rules.drops['.read'], 'auth != null');
  assert.match(d['.write'], /!data\.exists\(\) && newData\.child\('o'\)\.val\(\) === auth\.uid/, 'written once by the dropper');
  assert.match(d['.write'], /root\.child\('dropClaims'\)\.child\(\$did\)\.child\('by'\)\.val\(\) === auth\.uid/, 'the claimant clears it');
  assert.match(d['.write'], /now > data\.child\('t'\)\.val\(\) \+ 120000/, 'anyone clears a stale one');
  assert.equal(d.x['.validate'], node.x['.validate'], 'x bounds as presence');
  assert.equal(d.y['.validate'], node.y['.validate'], 'y bounds as presence');
  assert.equal(d.it['.validate'], 'newData.isString() && newData.val().length <= 600', 'an item as plain values, as in trades');
  assert.match(c['.write'], /!data\.exists\(\) && newData\.child\('by'\)\.val\(\) === auth\.uid && root\.child\('drops'\)\.child\(\$did\)\.exists\(\)/, 'one claim, on a drop that is there');
  assert.match(c['.write'], /now < root\.child\('drops'\)\.child\(\$did\)\.child\('t'\)\.val\(\) \+ 60000/, 'within its 60 s');
  assert.match(c['.write'], /now > root\.child\('drops'\)\.child\(\$did\)\.child\('t'\)\.val\(\) \+ 2000/, 'others after 2 s');
  for (const n of [d, c]) assert.equal(n.$other['.validate'], false);
});

test('bounties: set by anyone but the target; claimed once, by whoever the target\'s own kill record names, for a kill after the bounty', () => {
  const b = rules.bounties.$bid, pd = rules.bountyPaid.$bid, k = rules.kills.$v.$kid;
  assert.match(b['.write'], /!data\.exists\(\) && newData\.child\('by'\)\.val\(\) === auth\.uid && newData\.child\('tu'\)\.val\(\) !== auth\.uid/);
  assert.match(b['.write'], /child\('bountyPaid'\)\.child\(\$bid\)\.child\('by'\)\.val\(\) === auth\.uid/, 'removed by its claim in the same update');
  assert.equal(k['.write'], 'auth != null && $v === auth.uid && (!data.exists() || !newData.exists())', 'only the victim writes its kill record');
  assert.match(pd['.write'], /!data\.exists\(\) && newData\.child\('by'\)\.val\(\) === auth\.uid/, 'once');
  assert.match(pd['.write'], /\.child\('k'\)\.val\(\) === auth\.uid/, 'the target named the claimer');
  assert.match(pd['.write'], /\.child\('t'\)\.val\(\) > root\.child\('bounties'\)\.child\(\$bid\)\.child\('t'\)\.val\(\)/, 'a kill after the bounty');
  assert.match(pd['.validate'], /newData\.child\('g'\)\.val\(\) === root\.child\('bounties'\)\.child\(\$bid\)\.child\('g'\)\.val\(\)/, 'the gold the bounty says');
  for (const n of [b, pd, k]) assert.equal(n.$other['.validate'], false);
});

test('arena seasons: your own rating only; a first entry near 1000; then one win or loss and at most 64 points a write', () => {
  const a = rules.arena.$season, u = a.$uid;
  assert.equal(a['.validate'], "$season.matches(/^s20[0-9]{4}$/)");
  assert.equal(u['.write'], 'auth != null && auth.uid === $uid');
  assert.match(u['.validate'], /newData\.child\('r'\)\.val\(\) >= 936 && newData\.child\('r'\)\.val\(\) <= 1064/, 'a first entry is 1000 +- 64');
  assert.match(u['.validate'], /newData\.child\('w'\)\.val\(\) === data\.child\('w'\)\.val\(\) \+ 1 && newData\.child\('l'\)\.val\(\) === data\.child\('l'\)\.val\(\)/);
  assert.match(u['.validate'], /newData\.child\('r'\)\.val\(\) >= data\.child\('r'\)\.val\(\) - 64 && newData\.child\('r'\)\.val\(\) <= data\.child\('r'\)\.val\(\) \+ 64/);
  assert.equal(u.$other['.validate'], false);
});

test('legends (SAT-ONLINE-054): a legend is taken once, then only its holder changes or frees it', () => {
  const L = rules.world.$world.legends, k = L.$k;
  assert.equal(L['.read'], 'auth != null');
  assert.match(k['.write'], /!data\.exists\(\) && newData\.child\('uid'\)\.val\(\) === auth\.uid/);
  assert.match(k['.write'], /data\.exists\(\) && data\.child\('uid'\)\.val\(\) === auth\.uid/);
  assert.equal(k.uid['.validate'], 'newData.val() === auth.uid');
  assert.equal(k.$other['.validate'], false);
});

test('rankings (SAT-ONLINE-055): each player writes only its own level and gold; the lists are indexed on v', () => {
  const r = rules.ranks.$kind;
  assert.equal(r['.validate'], "$kind === 'lv' || $kind === 'gold'");
  assert.deepEqual(r['.indexOn'], ['v']);
  assert.equal(r.$uid['.write'], 'auth != null && auth.uid === $uid');
  assert.equal(r.$uid.$other['.validate'], false);
});

// The Firebase deploy rejects an expression with an unclosed parenthesis ("missing ) in parenthetical"), and nothing
// else here parses the expressions. Merging two rules files by hand once lost one; check every expression before a deploy.
function exprProblem(e) {
  let depth = 0, quote = null, regex = false, prev = '';
  for (let i = 0; i < e.length; i++) {
    const c = e[i];
    if (quote || regex) {
      if (c === '\\') { i++; continue; }
      if (quote && c === quote) quote = null;
      else if (regex && c === '/') regex = false;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    else if (c === '/' && (prev === '(' || prev === ',')) regex = true;
    else if (c === '(') depth++;
    else if (c === ')' && --depth < 0) return 'a ) without its ( at ' + i;
    if (!/\s/.test(c)) prev = c;
  }
  return quote ? 'an unclosed string' : regex ? 'an unclosed regex' : depth ? depth + ' unclosed (' : null;
}
test('every rule expression is well formed: balanced parentheses, closed strings and regexes', () => {
  assert.equal(exprProblem("a && (b || c('x)'))"), null);
  assert.equal(exprProblem("v.matches(/^(a|b)$/) && (x"), '1 unclosed (', 'the checker finds a lost )');
  const bad = [];
  (function walk(o, p) {
    for (const k of Object.keys(o)) {
      const v = o[k], at = p + '/' + k;
      if (v && typeof v === 'object') walk(v, at);
      else if (typeof v === 'string' && /^\.(read|write|validate)$/.test(k)) { const why = exprProblem(v); if (why) bad.push(at + ': ' + why); }
    }
  })(rules, '');
  assert.deepEqual(bad, []);
});
