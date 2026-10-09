/**
 * Vercel Serverless Function: /api/control
 * Lets the website's Simulation / Trial Results pages drive the real ESP32 for demonstrations.
 *  - POST (signed-in website only): { active, rain, rate, pook, bay, sms, source }
 *  - GET  (ESP32 + website):       current override, or { active: false }
 * An override expires 60 s after the last POST, so the device returns to its real sensors
 * on its own if the browser is closed.
 */
const { redis, setCorsHeaders, getSession } = require('./_db');

const TTL_S = 60;
let memoryControl = null;

async function readControl() {
  if (redis) {
    const v = await redis.get('bridge:control');
    if (!v) return null;
    return typeof v === 'string' ? JSON.parse(v) : v;
  }
  if (memoryControl && memoryControl.expiresAt > Date.now()) return memoryControl;
  return null;
}

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const c = await readControl();
      if (!c) return res.status(200).json({ active: false });
      return res.status(200).json({ ...c, active: true, remaining_ms: Math.max(0, c.expiresAt - Date.now()) });
    }

    if (req.method === 'POST') {
      let b = req.body;
      if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); } }
      if (!b || typeof b !== 'object') return res.status(400).json({ error: 'Invalid body' });
      if (!getSession(req)) return res.status(401).json({ error: 'Please sign in' });

      if (!b.active) {
        if (redis) await redis.del('bridge:control');
        memoryControl = null;
        return res.status(200).json({ status: 'ok', active: false });
      }

      const num = (v, max) => Math.min(max, Math.max(0, parseFloat(v) || 0));
      const c = {
        rain: num(b.rain, 200), rate: num(b.rate, 300),
        pook: num(b.pook, 10), bay: num(b.bay, 10),
        sms: Boolean(b.sms),
        source: b.source === 'trial' ? 'trial' : 'simulation',
        updated: Date.now(),
        expiresAt: Date.now() + TTL_S * 1000,
      };
      if (redis) await redis.set('bridge:control', JSON.stringify(c), { ex: TTL_S });
      memoryControl = c;
      return res.status(200).json({ status: 'ok', active: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[API] control error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
