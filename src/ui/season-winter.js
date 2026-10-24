/* Winter Lights (SAT-ONLINE-179, plan U307 "Seasonal town decorations": "asset pack lazy load behind event"). Claude-A.
   Loaded by index.html only while the season is on (decNow, the second half of December to the first days of January).
   Only drawn, from the buildings the game already has: a wreath on every town building's front, a string of coloured
   bulbs under its eaves, and a snowman beside every other one. Nothing is solid or something to use, nothing is in the
   state. Reduced motion: no blinking. Every shape is drawn here in code. */
(function (root) {
  'use strict';
  var ns = root.Satisfy = root.Satisfy || {};
  var SP = null, COL = ['#ff5a5a', '#ffe07a', '#7ad07a', '#6ab0ff', '#e0a0ff'];
  function spots(A) {
    if (SP) return SP;
    SP = [];
    for (var i = 0; i < A.buildings.length; i++) {
      var b = A.buildings[i];
      if (!b || !(b.w > 0)) continue;
      var x0 = b.x * A.TS, x1 = (b.x + b.w) * A.TS, y1 = (b.y + b.h) * A.TS;
      if (!A.inTown(x0 + 8, y1 + 8)) continue;
      SP.push({ x0: x0, x1: x1, y1: y1, ph: (b.x * 7 + b.y * 13) % 10, snow: (b.x + b.y) % 2 === 0 });
    }
    return SP;
  }
  function bulbs(g, s, lit, A) {
    var a = s.x0 + 3, b = s.x1 - 3, y = s.y1 - 31, n = Math.max(2, Math.floor((b - a) / 5));
    g.strokeStyle = 'rgba(30,50,30,.75)'; g.lineWidth = 1; g.beginPath();
    for (var i = 0; i <= n; i++) { var k = i / n, x = a + (b - a) * k, yy = y + Math.sin(k * Math.PI) * 4; if (i) g.lineTo(x, yy); else g.moveTo(x, yy); }
    g.stroke();
    for (var j = 1; j < n; j++) {
      var q = j / n, bx = Math.round(a + (b - a) * q), by = Math.round(y + Math.sin(q * Math.PI) * 4) + 1, on = A.RMO || Math.sin(A.gTime * 2.5 + j * 2.3 + s.ph) > -.5, col = COL[j % COL.length];
      if (on && lit > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .3 + .3 * lit; g.fillStyle = col; g.fillRect(bx - 2, by - 1, 5, 5); g.restore(); }
      g.fillStyle = on ? col : '#4a4a5a'; g.fillRect(bx, by, 2, 2);
    }
  }
  function wreath(g, x, y) {
    x = Math.round(x); y = Math.round(y);
    g.fillStyle = '#2e6a32'; g.fillRect(x - 3, y - 3, 7, 1); g.fillRect(x - 3, y + 3, 7, 1); g.fillRect(x - 4, y - 2, 1, 5); g.fillRect(x + 4, y - 2, 1, 5);
    g.fillStyle = '#3e8a3e'; g.fillRect(x - 3, y - 2, 1, 5); g.fillRect(x + 3, y - 2, 1, 5); g.fillRect(x - 2, y - 2, 5, 1); g.fillRect(x - 2, y + 2, 5, 1);
    g.fillStyle = '#e03a3a'; g.fillRect(x - 1, y + 3, 3, 2); g.fillStyle = '#ffe07a'; g.fillRect(x - 2, y - 2, 1, 1); g.fillRect(x + 2, y + 1, 1, 1);
  }
  function snowman(g, x, y) {
    x = Math.round(x); y = Math.round(y);
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x - 5, y, 11, 2);
    g.fillStyle = '#eef4fa'; g.fillRect(x - 4, y - 7, 9, 7); g.fillRect(x - 3, y - 8, 7, 1); g.fillRect(x - 3, y - 13, 7, 5); g.fillRect(x - 2, y - 14, 5, 1);
    g.fillStyle = '#c8d4e0'; g.fillRect(x + 3, y - 6, 1, 5); g.fillRect(x + 2, y - 12, 1, 3);
    g.fillStyle = '#2a2a32'; g.fillRect(x - 3, y - 16, 7, 2); g.fillRect(x - 2, y - 19, 5, 3); g.fillRect(x - 1, y - 12, 1, 1); g.fillRect(x + 1, y - 12, 1, 1); g.fillRect(x, y - 5, 1, 1); g.fillRect(x, y - 3, 1, 1);
    g.fillStyle = '#ff8a2a'; g.fillRect(x, y - 11, 2, 1);
    g.fillStyle = '#d83a3a'; g.fillRect(x - 3, y - 9, 7, 1); g.fillRect(x + 2, y - 8, 1, 3);
  }
  function ents(A, E) {
    var g = A.ctx, lit = Math.min(1, .35 + A.dark * 1.3), S = spots(A);
    for (var i = 0; i < S.length; i++) {
      var s = S[i];
      if (s.x1 < A.camX - 40 || s.x0 > A.camX + A.VW + 40 || s.y1 < A.camY - 50 || s.y1 > A.camY + A.VH + 60) continue;
      (function (s) {
        E.push({ y: s.y1 - 2, f: function () { bulbs(g, s, lit, A); wreath(g, (s.x0 + s.x1) / 2, s.y1 - 22); } });
        if (s.snow) E.push({ y: s.y1 + 8, f: function () { snowman(g, s.x1 + 4, s.y1 + 8); } });
      })(s);
    }
  }
  ns.seasonPack = { id: 'winter', ents: ents, greet: { ar: '✨ أنوار الشتا نوّرت المدن! أكاليل وأنوار ملونة ورجالة تلج.', en: '✨ Winter Lights are up in the towns! Wreaths, coloured lights and snowmen.' } };
})(typeof window !== 'undefined' ? window : globalThis);
