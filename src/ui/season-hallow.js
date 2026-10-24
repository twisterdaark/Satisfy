/* Harvest Night (SAT-ONLINE-179, plan U307 "Seasonal town decorations": "asset pack lazy load behind event"). Claude-A.
   Loaded by index.html only while the season is on (decNow, the end of October), so the rest of the year costs nothing.
   Only drawn, from the buildings and towns the game already has: a carved pumpkin at each front corner of every town
   building (lit from dusk), a string of orange and violet bulbs under its eaves, and bats over the towns at night. Nothing
   is solid or something to use, nothing is in the state, and it has its own random stream. Reduced motion: no blinking,
   no bats. Every shape is drawn here in code: no picture comes from anywhere else. */
(function (root) {
  'use strict';
  var ns = root.Satisfy = root.Satisfy || {};
  function mul(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var R = mul(0x4a110e), SP = null, BATS = [];
  // the front of each town building: its two corners and its eaves, in world pixels (worked out once)
  function spots(A) {
    if (SP) return SP;
    SP = [];
    for (var i = 0; i < A.buildings.length; i++) {
      var b = A.buildings[i];
      if (!b || !(b.w > 0)) continue;
      var x0 = b.x * A.TS, x1 = (b.x + b.w) * A.TS, y1 = (b.y + b.h) * A.TS;
      if (!A.inTown(x0 + 8, y1 + 8)) continue;
      SP.push({ x0: x0, x1: x1, y1: y1, ph: (b.x * 7 + b.y * 13) % 10 });
    }
    return SP;
  }
  function pumpkin(g, x, y, lit, A) {
    x = Math.round(x); y = Math.round(y);
    if (lit > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .45 * lit * (A.RMO ? 1 : .85 + .15 * Math.sin(A.gTime * 7 + x)); var gr = g.createRadialGradient(x, y - 3, 0, x, y - 3, 14); gr.addColorStop(0, '#ffb040'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - 14, y - 17, 28, 28); g.restore(); }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 4, y, 9, 2);
    g.fillStyle = '#c85a12'; g.fillRect(x - 4, y - 6, 9, 6); g.fillRect(x - 3, y - 7, 7, 1); g.fillRect(x - 3, y, 7, 1);
    g.fillStyle = '#e87a22'; g.fillRect(x - 3, y - 6, 2, 6); g.fillRect(x + 1, y - 6, 2, 6);
    g.fillStyle = '#4a7a2a'; g.fillRect(x, y - 9, 1, 2); g.fillRect(x + 1, y - 9, 1, 1);
    g.fillStyle = lit > .2 ? '#ffe07a' : '#5a2a08'; // the carved face
    g.fillRect(x - 3, y - 5, 2, 1); g.fillRect(x + 2, y - 5, 2, 1); g.fillRect(x - 2, y - 2, 5, 1); g.fillRect(x - 1, y - 3, 1, 1); g.fillRect(x + 1, y - 3, 1, 1);
  }
  function bulbs(g, s, lit, A) {
    var a = s.x0 + 3, b = s.x1 - 3, y = s.y1 - 31, n = Math.max(2, Math.floor((b - a) / 6));
    g.strokeStyle = 'rgba(40,30,30,.7)'; g.lineWidth = 1; g.beginPath();
    for (var i = 0; i <= n; i++) { var k = i / n, x = a + (b - a) * k, yy = y + Math.sin(k * Math.PI) * 4; if (i) g.lineTo(x, yy); else g.moveTo(x, yy); }
    g.stroke();
    for (var j = 1; j < n; j++) {
      var q = j / n, bx = Math.round(a + (b - a) * q), by = Math.round(y + Math.sin(q * Math.PI) * 4) + 1, on = A.RMO || Math.sin(A.gTime * 3 + j * 1.7 + s.ph) > -.4, col = j % 2 ? '#ff9a2a' : '#b06aff';
      if (lit > 0 && on) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .35 * lit; g.fillStyle = col; g.fillRect(bx - 2, by - 1, 5, 5); g.restore(); }
      g.fillStyle = on ? col : '#5a4a4a'; g.fillRect(bx, by, 2, 2);
    }
  }
  function bat(g, x, y, t) {
    var up = Math.sin(t * 16) > 0; x = Math.round(x); y = Math.round(y);
    g.fillStyle = '#2a1a32';
    g.fillRect(x, y, 2, 2);
    if (up) { g.fillRect(x - 3, y - 2, 3, 1); g.fillRect(x + 2, y - 2, 3, 1); g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 2, y - 1, 1, 1); }
    else { g.fillRect(x - 3, y + 1, 3, 1); g.fillRect(x + 2, y + 1, 3, 1); }
  }
  function ents(A, E) {
    var g = A.ctx, lit = Math.min(1, A.dark * 1.6), S = spots(A);
    for (var i = 0; i < S.length; i++) {
      var s = S[i];
      if (s.x1 < A.camX - 40 || s.x0 > A.camX + A.VW + 40 || s.y1 < A.camY - 50 || s.y1 > A.camY + A.VH + 60) continue;
      (function (s) {
        E.push({ y: s.y1 + 6, f: function () { pumpkin(g, s.x0 + 7, s.y1 + 6, lit, A); pumpkin(g, s.x1 - 7, s.y1 + 6, lit, A); } });
        E.push({ y: s.y1 - 2, f: function () { bulbs(g, s, lit, A); } });
      })(s);
    }
    // bats over a town at night, around you
    if (A.RMO || A.dark < .5 || !A.inTown(A.P.x, A.P.y)) { BATS.length = 0; return; }
    while (BATS.length < 7) BATS.push({ x: A.P.x + (R() - .5) * A.VW, y: A.P.y - 40 - R() * 80, a: R() * 7, r: 20 + R() * 40, s: .6 + R() * .8 });
    E.push({ y: A.camY + A.VH + 1000, f: function () {
      for (var i = 0; i < BATS.length; i++) {
        var b = BATS[i]; b.a += .016 * b.s * 2;
        bat(g, b.x + Math.cos(b.a) * b.r, b.y + Math.sin(b.a * 1.7) * b.r * .4, A.gTime + i);
        if (Math.abs(b.x - A.P.x) > A.VW) { b.x = A.P.x + (R() - .5) * A.VW; b.y = A.P.y - 40 - R() * 80; }
      }
    } });
  }
  ns.seasonPack = { id: 'hallow', ents: ents, greet: { ar: '🎃 ليلة الحصاد وصلت المدن! القرع منوّر والفوانيس متعلقة، وبالليل الخفافيش طايرة.', en: '🎃 Harvest Night has come to the towns! The pumpkins are lit, the lanterns are up, and at night the bats are out.' } };
})(typeof window !== 'undefined' ? window : globalThis);
