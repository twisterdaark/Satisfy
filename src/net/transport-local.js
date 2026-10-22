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
    var handler = null, feeds = {}; // world feeds (SAT-ONLINE-026): chat, news; each on its own channel
    function fc(kind) { if (!feeds[kind]) feeds[kind] = new root.BroadcastChannel((name || 'satisfy-net-v1') + '-' + kind); return feeds[kind]; }
    ch.onmessage = function (e) { if (handler) handler(e.data); };
    return {
      kind: 'local',
      send: function (env) { try { ch.postMessage(env); } catch (e) { /* closed or not cloneable */ } },
      onmessage: function (fn) { handler = fn; },
      feedOn: function (kind, fn) { fc(kind).onmessage = function (e) { fn(e.data); }; },
      feedSay: function (kind, m) { try { fc(kind).postMessage(JSON.parse(JSON.stringify(m))); } catch (e) { /* closed */ } },
      world: function (fn) { this.feedOn('chat', fn); },
      sayWorld: function (m) { this.feedSay('chat', { from: m.from, h: m.h, text: m.text }); },
      // shared monsters (SAT-ONLINE-026), the shape of the Firebase transport's: {zone, h, m} on the 'mobs' channel
      mobsOn: function (zone, fn) {
        var all = {};
        if (!zone) { fc('mobs').onmessage = null; return; }
        fc('mobs').onmessage = function (e) { var v = e.data; if (!v || v.zone !== zone || typeof v.h !== 'string') return; if (v.m) all[v.h] = { t: v.t, m: v.m }; else delete all[v.h]; fn(all); };
      },
      mobsPut: function (zone, m, h) {
        if (this.mz && (this.mz !== zone || !m)) { try { fc('mobs').postMessage({ zone: this.mz, h: h, m: null }); } catch (e) { /* closed */ } this.mz = null; }
        if (!zone || !m) return;
        this.mz = zone;
        try { fc('mobs').postMessage({ zone: zone, h: h, m: m, t: Date.now() }); } catch (e) { /* closed */ }
      },
      close: function () { handler = null; try { ch.close(); for (var k in feeds) feeds[k].close(); } catch (e) { /* ignore */ } },
    };
  }

  function hub() {
    var peers = [];
    return {
      peers: function () { return peers.length; },
      connect: function () {
        var me = { handler: null, closed: false };
        peers.push(me);
        return {
          kind: 'memory',
          // structured clone keeps receivers from sharing objects with the sender; closed, it sends nothing (SAT-ONLINE-148:
          // the same contract as the others)
          send: function (env) {
            if (me.closed) return;
            var copy = JSON.parse(JSON.stringify(env));
            peers.forEach(function (p) { if (p !== me && p.handler) p.handler(JSON.parse(JSON.stringify(copy))); });
          },
          onmessage: function (fn) { me.handler = fn; },
          close: function () { me.closed = true; me.handler = null; peers = peers.filter(function (p) { return p !== me; }); },
        };
      },
    };
  }

  var ns = root.Satisfy = root.Satisfy || {};
  ns.transports = Object.freeze({ local: local, hub: hub });
})(typeof window !== 'undefined' ? window : globalThis);
