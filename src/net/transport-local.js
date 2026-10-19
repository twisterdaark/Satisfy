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
    var handler = null;
    ch.onmessage = function (e) { if (handler) handler(e.data); };
    // shared monsters (SAT-ONLINE-031), the shape of the Firebase transport's: {zone, h, m} on a second channel
    var mch = null, mz = null, mw = null;
    function mc() {
      if (!mch) {
        mch = new root.BroadcastChannel((name || 'satisfy-net-v1') + '-mobs');
        mch.onmessage = function (e) {
          var v = e.data;
          if (!mw || !v || v.zone !== mw.zone || typeof v.h !== 'string') return;
          if (v.m && typeof v.m === 'object') mw.all[v.h] = { t: v.t, m: v.m }; else delete mw.all[v.h];
          mw.fn(mw.all);
        };
      }
      return mch;
    }
    return {
      kind: 'local',
      send: function (env) { try { ch.postMessage(env); } catch (e) { /* closed or not cloneable */ } },
      onmessage: function (fn) { handler = fn; },
      /** Follow the host lists of zone `zone` (null: stop): fn({hostUid: {t, m}}) on every change. */
      mobsOn: function (zone, fn) { mw = zone ? { zone: zone, fn: fn, all: {} } : null; if (zone) mc(); },
      /** Post our list for zone `zone` as host h (null zone or m: withdraw it). */
      mobsPut: function (zone, m, h) {
        var c = mc();
        if (mz && (mz !== zone || !m)) { try { c.postMessage({ zone: mz, h: h, m: null }); } catch (e) { /* closed */ } mz = null; }
        if (!zone || !m) return;
        mz = zone;
        try { c.postMessage({ zone: zone, h: h, m: m, t: Date.now() }); } catch (e) { /* closed */ }
      },
      close: function () { handler = null; mw = null; try { ch.close(); } catch (e) { /* ignore */ } try { if (mch) mch.close(); } catch (e) { /* ignore */ } },
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
