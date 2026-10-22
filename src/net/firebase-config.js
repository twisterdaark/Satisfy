/* Satisfy — Firebase web config for project satisfy-online-8yjeix (created by the owner, Spark plan).
 *
 * This is the public web-app config, not a secret: every Firebase web app ships it to the browser.
 * Access is controlled by backend/database.rules.json and the Auth authorized domains.
 * Loading this file does nothing by itself; the SDK is fetched only when online play is requested.
 */
(function (root) {
  'use strict';
  var ns = root.Satisfy = root.Satisfy || {};
  ns.firebaseConfig = Object.freeze({
    apiKey: 'AIzaSyDAxELSgwXI7Xri5tIG-p1m0QGGNgw9PM4',
    authDomain: 'satisfy-online-8yjeix.firebaseapp.com',
    databaseURL: 'https://satisfy-online-8yjeix-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'satisfy-online-8yjeix',
    storageBucket: 'satisfy-online-8yjeix.firebasestorage.app',
    messagingSenderId: '564433517305',
    appId: '1:564433517305:web:52eb415373d8252d8b4028',
  });
  // Owner feedback #3: the game is online at its plain address. Without ?net=… the page behaves like ?net=online (sign in, pick
  // your player name, Play; no New game / Continue). This is on by default on the GitHub Pages host (a7439b3), so local files
  // and the test harness stay offline; ?net=off plays offline anywhere and ?net=local stays for two-tab tests. A value set
  // before this file loads is kept: a test turns it on that way, and a custom domain can be added here.
  if (ns.netOnlineOnly === undefined) ns.netOnlineOnly = !!(root.location && /\.github\.io$/.test(root.location.hostname || ''));
  // SAT-ONLINE-120 (plan U022): a test environment kept apart from the real one. With ?emu (or ?emu=host), and only when the
  // page itself is served from this computer (localhost, 127.0.0.1, ::1), online play talks to the Firebase emulators on that
  // host (the database on 9000, sign-in on 9099; docs/online/EMULATOR.md) instead of the project above. On any other host,
  // the public site included, ?emu is ignored, so nothing the players load can point at a test database. Claude-B's review of
  // #155: the emulator host is this computer or one on the local network too (127.x, 10.x, 172.16-31.x, 192.168.x, a .local
  // name); any other host is ignored, so a link can't send a local page's sign-in to a machine on the internet.
  ns.firebaseEmulator = (function () {
    var L = root.location, h = L && L.hostname || '', q = L && L.search || '', m = /[?&]emu(?:=([A-Za-z0-9.-]{1,64}))?(?:&|$)/.exec(q);
    if (!m || !/^(localhost|127\.0\.0\.1|\[::1\]|::1)$/.test(h)) return null;
    var host = m[1] && m[1] !== '1' ? m[1].toLowerCase() : '127.0.0.1';
    if (!lanHost(host)) return null;
    return Object.freeze({ host: host, dbPort: 9000, authUrl: 'http://' + host + ':9099' });
  })();
  function lanHost(x) {
    if (x === 'localhost' || /^[a-z0-9]([a-z0-9-]{0,62})?\.local$/.test(x)) return true;
    var p = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(x);
    if (!p) return false;
    var a = +p[1], b = +p[2];
    if (+p[1] > 255 || +p[2] > 255 || +p[3] > 255 || +p[4] > 255) return false;
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
})(typeof window !== 'undefined' ? window : globalThis);
