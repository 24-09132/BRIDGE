/**
 * Vercel Serverless Function: /api/history
 * Returns the latest time-series history records for charts (oldest first)
 */
const { redis, memoryHistory, setCorsHeaders, getSession } = require('./_db');

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!getSession(req)) return res.status(401).json({ error: 'Please sign in' });

  try {
    if (redis) {
      const records = await redis.lrange('bridge:history', 0, 239);
      if (records && records.length > 0) {
        const parsed = records.map(r => typeof r === 'string' ? JSON.parse(r) : r);
        return res.status(200).json(parsed.reverse());
      }
    }
    return res.status(200).json(memoryHistory.slice().reverse());
  } catch (err) {
    console.error('[API] Error fetching history:', err);
    return res.status(500).json({ error: 'Failed to retrieve history' });
  }
};
