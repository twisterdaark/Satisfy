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
})(typeof window !== 'undefined' ? window : globalThis);
