/* Satisfy — class packs (SAT-ONLINE-147): classes as data, installed by the game at load (index.html, cpInstall).
 *
 * Each pack: {id, n: {en, ar}, root: the base class it grows from ('warrior', 'archer', 'mage', 'thief', 'priest',
 * 'smith', 'gknight'), from: [classes that may take the trial], by: the trainer who gives it ('tw', 'ta', 'tm', 'tk',
 * 'cassus', 'hood'), lv, mst: [weapon kind, mastery], obj: the trial's objective (the quest engine's: {t: 'kill', it,
 * n, wk?}, ...), xp, gold, q: {n, o, w, d}: the trial's name, offer, waiting and done lines ({en, ar} each), col, and
 * skills: [{id, n, d, lv, mp, cd, need?, col?, kind, ...}] (the kinds and their fields are listed by cpFn in index.html).
 * A pack never replaces a class, a skill or a quest that exists.
 */
(function (root) {
  'use strict';
  var ns = root.Satisfy = root.Satisfy || {};
  var L = ns.classPacks = ns.classPacks || [];
  void L; // the classes go here
})(typeof window !== 'undefined' ? window : globalThis);
