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
})(typeof window !== 'undefined' ? window : globalThis);
