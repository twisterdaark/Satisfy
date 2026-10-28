'use strict';
// SAT-ONLINE-147: classes as data (src/content/classpacks.js). A pack given to the page before it loads is installed with
// its name, its trial at a trainer and its skills; each kind of skill works like the hand-made ones (a thrust hits what is
// in front, a nova what is around, a buff and a passive raise the stats they name); the class keeps through a reload; and a
// pack can't replace what exists.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const PACK = {
  id: 'tstcls', n: { en: 'Test Blade', ar: 'سيف التجربة' }, root: 'warrior', from: ['warrior'], by: 'tw', lv: 20, mst: ['melee', 1],
  obj: { t: 'kill', it: 'rabbit', n: 2 }, xp: 100, gold: 10,
  q: { n: { en: 'The Test Trial', ar: 'اختبار التجربة' }, o: { en: 'Kill two rabbits.', ar: 'اقتل أرنبين.' }, w: { en: 'Not yet.', ar: 'لسه.' }, d: { en: 'You are a Test Blade.', ar: 'بقيت سيف التجربة.' } },
  skills: [
    { id: 'tsline', n: { en: 'Test Thrust', ar: 'طعنة' }, d: { en: 'A thrust.', ar: 'طعنة.' }, lv: 20, kind: 'line', r: 70, mul: 2 },
    { id: 'tsnova', n: { en: 'Test Nova', ar: 'دايرة' }, d: { en: 'All around.', ar: 'حواليك.' }, lv: 20, kind: 'nova', r: 50, mul: 1.5 },
    { id: 'tsbuff', n: { en: 'Test Might', ar: 'قوة' }, d: { en: '+50% attack for 10 s.', ar: '+50% هجوم.' }, lv: 20, kind: 'buff', stat: 'atk', pct: 0.5, dur: 10 },
    { id: 'tspas', n: { en: 'Test Body', ar: 'جسم' }, d: { en: '+20% health.', ar: '+20% صحة.' }, lv: 20, kind: 'pas', stat: 'hp', pct: 0.2 },
    // replaces nothing: a skill id that exists is left alone
    { id: 'thrust', n: { en: 'Stolen', ar: 'x' }, lv: 20, kind: 'line' },
  ],
};
const BAD = { id: 'lancer', n: { en: 'Not the Lancer', ar: 'x' }, root: 'warrior' };
const init = { content: 'window.Satisfy = window.Satisfy || {}; (window.Satisfy.classPacks = window.Satisfy.classPacks || []).push(' + JSON.stringify(PACK) + ', ' + JSON.stringify(BAD) + ');' };

test('class packs: installed with their trial and skills; each kind of skill works; kept through a reload; nothing replaced', async () => {
  const ctx = await H.newContext({ scripts: [init] });
  try {
    const g = await H.openGame({ ctx });
    await H.newGame(g);
    assert.deepEqual((await g.eval(() => window.__GCP.packs())).filter((k) => k === 'tstcls' || k === 'lancer'), ['tstcls'], 'the new one, not the Lancer');
    assert.deepEqual(await g.eval(() => { const G = window.__G, Q = G.QD.cptstcls; return [Q.by, Q.lv, Q.promo, Q.from]; }), ['tw', 20, 'tstcls', ['warrior']], 'its trial at the trainer');
    assert.equal(await g.eval(() => window.__GCP.t('cl_tstcls')), 'Test Blade');
    assert.equal(await g.eval(() => window.__GCP.t('cl_lancer')), 'Spear Knight', 'the Lancer (the novel\'s Spear Knight) is still itself');

    // become one; its skills, with the hand-made Lancer thrust left as it was
    await g.eval(() => { const S = window.__G.S; S.cls = 'tstcls'; S.cbase = 'warrior'; S.lv = 20; S.xp = 0; });
    await g.step(2);
    const hp0 = await g.eval(() => window.__G.maxHP());
    assert.ok(Math.abs(await g.eval(() => window.__GCP.stat('hp')) - 0.2) < 1e-9, 'the passive');
    await g.eval(() => { window.__G.S.cls = 'warrior'; }); const hpW = await g.eval(() => window.__G.maxHP()); await g.eval(() => { window.__G.S.cls = 'tstcls'; });
    assert.ok(Math.abs(hp0 / hpW - 1.2) < 0.02, 'health +20%: ' + hp0 + ' vs ' + hpW);
    assert.equal(await g.eval(() => window.__GCP.t('sk_thrust')), 'Thrust', 'an existing skill is not replaced');

    // a monster in front: the thrust hits it; one beside: the nova does
    const hitWith = (k, dx, dy) => g.eval(([key, x, y]) => {
      const G = window.__G, P = G.P, m = G.mons().find((q) => !q.dead && !window.__GCP.boss(q.type));
      for (const o of G.mons()) if (o !== m && Math.hypot(o.x - P.x, o.y - P.y) < 300) { o.dead = true; o.rt = 1e9; }
      m.x = P.x + x; m.y = P.y + y; m.hp = m.max = 1e6; P.dir = 2; P.mp = 999; P.cd = {}; window.__GSKF.cast(key); return m.hp;
    }, [k, dx, dy]);
    await g.eval(() => { window.__G.P.inv = 1e9; });
    assert.ok((await hitWith('tsline', 30, 0)) < 1e6, 'the thrust hit what is in front');
    await g.step(2);
    assert.ok((await hitWith('tsnova', 0, 25)) < 1e6, 'the nova hit what is beside');
    // the buff: +50% attack while it lasts
    const a0 = await g.eval(() => window.__GCP.atk());
    await g.eval(() => window.__GSKF.cast('tsbuff')); await g.step(2);
    assert.ok(Math.abs(await g.eval(() => window.__GCP.stat('atk')) - 0.5) < 1e-9);
    assert.ok((await g.eval(() => window.__GCP.atk())) > a0 * 1.4, 'attack up');
    await g.step(660); // 11 s
    assert.equal(await g.eval(() => window.__GCP.stat('atk')), 0, 'and over');

    // kept through a reload
    await g.eval(() => window.__G.save(true));
    await g.page.reload(); await g.step(2); await H.continueGame(g);
    assert.equal(await g.eval(() => window.__G.S.cls), 'tstcls');
    assert.ok(Math.abs(await g.eval(() => window.__GCP.stat('hp')) - 0.2) < 1e-9, 'the passive again');
    assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
