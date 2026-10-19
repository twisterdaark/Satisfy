/* Satisfy — local transports (SAT-ONLINE-002). No network, no backend.
 *
 *   Satisfy.transports.local(name)  BroadcastChannel between tabs of the same browser (dev: ?net=local)
 *   Satisfy.transports.hub()        in-memory hub for tests; hub.connect() returns a transport
 *
 * A transport is { kind, send(envelope), onmessage(fn), close() }. Delivery is best-effort and
 * never echoes a message back to its sender, matching what the Firebase transport will do.
 */
(function (root) {
  'use strict';

  function local(name) {
    var ch = new root.BroadcastChannel(name || 'satisfy-net-v1');
    var handler = null, wch = null; // wch: world chat (SAT-ONLINE-026), its own channel
    function wc() { if (!wch) wch = new root.BroadcastChannel((name || 'satisfy-net-v1') + '-world'); return wch; }
    ch.onmessage = function (e) { if (handler) handler(e.data); };
    return {
      kind: 'local',
      send: function (env) { try { ch.postMessage(env); } catch (e) { /* closed or not cloneable */ } },
      onmessage: function (fn) { handler = fn; },
      world: function (fn) { wc().onmessage = function (e) { fn(e.data); }; },
      sayWorld: function (m) { try { wc().postMessage({ from: m.from, h: m.h, text: m.text }); } catch (e) { /* closed */ } },
      close: function () { handler = null; try { ch.close(); if (wch) wch.close(); } catch (e) { /* ignore */ } },
    };
  }

  function hub() {
    var peers = [];
    return {
      peers: function () { return peers.length; },
      connect: function () {
        var me = { handler: null };
        peers.push(me);
        return {
          kind: 'memory',
          // structured clone keeps receivers from sharing objects with the sender
          send: function (env) {
            var copy = JSON.parse(JSON.stringify(env));
            peers.forEach(function (p) { if (p !== me && p.handler) p.handler(JSON.parse(JSON.stringify(copy))); });
          },
          onmessage: function (fn) { me.handler = fn; },
          close: function () { me.handler = null; peers = peers.filter(function (p) { return p !== me; }); },
        };
      },
    };
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.transports = Object.freeze({ local: local, hub: hub });
})(typeof window !== 'undefined' ? window : globalThis);
