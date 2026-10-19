'use strict';
// Save fixtures shaped exactly like what earlier builds wrote to localStorage.

// Written by Patch 3 (a56c7ee): S.v = 4, stats started at 1, key satisfy_proto_v4.
const LEGACY_V4 = {
  S: {
    v: 4, look: { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }, cls: 'novice', lv: 6, xp: 12, gold: 345, bread: 2,
    tl: {}, title: '', qs: { kh1: { st: 2, c: 0 } }, kills: { rabbit: 12, boar: 3 }, met: { khan: 1 }, ev: {}, playT: 1234,
    sk: {}, firstLeg: 0, raid: 0, mats: { ore: 3, wood: 4, leather: 5, blue: 0, mstone: 0 }, arrows: [0, 0, 0, 0, 0],
    arrowsMade: 0, sold: 1, items: [{ uid: 1, id: 'rusty', slot: 'w', r: 0, atk: 25, spd: 0.4 }], eqW: 1, eqA: 0, uid: 1,
    made: {}, smith: 2, sxp: 30, patience: 0, guardDown: false, hits: 0, st: { str: 3, sta: 2, agi: 1, int: 1, dex: 1 },
    pts: 0, bonus: 0, got: {}, hid: { comp: 10, indom: 10, dign: 10, insi: 10 }, immT: 0, zone: 'zWin',
  },
  P: { x: 500, y: 600, hp: 120, st: 80, mp: 3, food: 50 },
};

// A save from a hypothetical newer build (schema 6) opened by this build.
const NEWER_V6 = JSON.parse(JSON.stringify(LEGACY_V4));
NEWER_V6.S.v = 6;
NEWER_V6.S.st = { str: 14, sta: 12, agi: 10, int: 10, dex: 10 };
NEWER_V6.S.future = { guild: 'Overgeared' };

// Truncated write (tab closed mid-save, quota error, manual edit).
const CORRUPT_RAW = '{"S":{"v":5,"look":{"n":"Grid"},"lv":9,"gold":9';

module.exports = { LEGACY_V4, NEWER_V6, CORRUPT_RAW };
