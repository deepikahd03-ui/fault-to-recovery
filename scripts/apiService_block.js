/* ---------------------------------------------------------------------
   apiService.js — thin REST client for the Flask backend.
   All data fetching goes through http://localhost:5000/api/...
   (Phase 1 used an in-memory mock + client-side graph engine; Phase 2
    swaps in the real Python/Flask + networkx API. The React layer is
    unchanged — to retarget, just change API_BASE.)
--------------------------------------------------------------------- */
// Origin-aware: when served by Flask (localhost OR a public tunnel/domain), use the
// same origin so visitors reach the right backend. When opened as file://, fall back
// to the local Flask dev server.
const API_BASE =
  (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
    ? window.location.origin + '/api'
    : 'http://localhost:5000/api';

async function _jfetch(path, opts = {}) {
  const res = await fetch(API_BASE + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) {
    let msg = 'API error ' + res.status;
    try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

const apiService = {
  async login(creds) { return _jfetch('/login', { method: 'POST', body: JSON.stringify(creds) }); },
  async getGridState() { return _jfetch('/network/state'); },
  async tickTelemetry() { return _jfetch('/network/state'); },
  async triggerScenario(sid) {
    if (sid === 'S3') return _jfetch('/simulate/reset', { method: 'POST' });
    return _jfetch('/simulate/fault', { method: 'POST', body: JSON.stringify({ scenario: sid }) });
  },
  async executeRestoration() { return _jfetch('/simulate/restore', { method: 'POST' }); },
  async resetGrid() { return _jfetch('/simulate/reset', { method: 'POST' }); },
  async getEventHistory(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.type && filters.type !== 'all') qs.set('type', filters.type);
    if (filters.q) qs.set('q', filters.q);
    const q = qs.toString();
    return _jfetch('/events' + (q ? '?' + q : ''));
  },
};
