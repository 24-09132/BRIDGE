/**
 * Vercel Serverless Function: /api/telemetry
 * Handles:
 *  - POST: Ingests sensor telemetry from ESP32 with x-api-key authentication
 *  - GET: Serves the latest telemetry to the web dashboard
 */
const { redis, memoryTelemetry, memoryHistory, isAuthorized, setCorsHeaders, getSession } = require('./_db');

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 1. GET Request: Dashboard fetching latest telemetry
  if (req.method === 'GET') {
    if (!getSession(req)) return res.status(401).json({ error: 'Please sign in' });
    try {
      if (redis) {
        const stored = await redis.get('bridge:telemetry');
        if (stored) {
          const data = typeof stored === 'string' ? JSON.parse(stored) : stored;
          return res.status(200).json(data);
        }
      }
      // Return memory fallback if Redis empty or not yet configured
      return res.status(200).json(memoryTelemetry);
    } catch (err) {
      console.error('[API] Error retrieving telemetry:', err);
      return res.status(200).json(memoryTelemetry);
    }
  }

  // 2. POST Request: IoT device pushing telemetry
  if (req.method === 'POST') {
    // Authenticate API Key
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
    }

    try {
      let payload = req.body;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch (e) {
          return res.status(400).json({ error: 'Invalid JSON payload' });
        }
      }

      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Payload must be a JSON object' });
      }

      // Format clean record
      const num = (v, d = null) => (v === undefined || v === null || isNaN(parseFloat(v)) ? d : parseFloat(v));
      const telemetryRecord = {
        // FLOOD-SENTINEL fields
        rainfall_mm: num(payload.rainfall_mm, 0),
        rain_rate: num(payload.rain_rate, 0),
        rain_class: String(payload.rain_class ?? 'Unknown'),
        pook_cm: num(payload.pook_cm, num(payload.pook_mm, 0) / 10),
        bay_cm: num(payload.bay_cm, num(payload.bay_mm, 0) / 10),
        flood_prob: num(payload.flood_prob),
        road_class: parseInt(payload.road_class ?? -1),
        road_condition: String(payload.road_condition ?? 'UNKNOWN'),
        sms_sent: parseInt(payload.sms_sent ?? 0),
        gsm_ready: Boolean(payload.gsm_ready),
        mode: payload.mode === 'simulation' ? 'simulation' : 'live',
        source: String(payload.source ?? ''),
        // raw sensor readings
        rain_adc: parseInt(payload.rain_adc ?? 0),
        s1_adc: parseInt(payload.s1_adc ?? 0),
        s2_adc: parseInt(payload.s2_adc ?? 0),
        water_pct: num(payload.water_pct, 0),
        led_green: Boolean(payload.led_green),
        led_yellow: Boolean(payload.led_yellow),
        led_red: Boolean(payload.led_red),
        led_blue: Boolean(payload.led_blue),
        rssi: parseInt(payload.rssi ?? -60),
        uptime: parseInt(payload.uptime ?? 0),
        timestamp: Date.now()
      };

      const historyPoint = {
        t: telemetryRecord.timestamp,
        p: telemetryRecord.flood_prob,
        c: telemetryRecord.road_class,
        r: telemetryRecord.rainfall_mm,
        q: telemetryRecord.rain_rate,
        k: telemetryRecord.pook_cm,
        b: telemetryRecord.bay_cm,
        m: telemetryRecord.mode === 'simulation' ? 1 : 0
      };

      // Update in-memory cache
      Object.assign(memoryTelemetry, telemetryRecord);
      memoryHistory.unshift(historyPoint);
      if (memoryHistory.length > 240) memoryHistory.length = 240;

      // If Upstash Redis is connected, persist record and append to history log
      if (redis) {
        await redis.set('bridge:telemetry', JSON.stringify(telemetryRecord));
        
        // Keep about the latest 240 points
        await redis.lpush('bridge:history', JSON.stringify(historyPoint));
        if (Math.random() < 0.1) await redis.ltrim('bridge:history', 0, 239);   // trim now and then to save free-tier commands
      }

      return res.status(200).json({
        status: 'ok',
        received: true,
        timestamp: telemetryRecord.timestamp
      });
    } catch (err) {
      console.error('[API] Error handling telemetry POST:', err);
      return res.status(500).json({ error: 'Internal server error processing telemetry' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
