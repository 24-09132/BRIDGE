/**
 * Vercel Serverless Function: /api/session
 *  GET -> { ok: true, user } when signed in, otherwise 401
 */
const { getSession } = require('./_db');

module.exports = async (req, res) => {
  const s = getSession(req);
  if (!s) return res.status(401).json({ ok: false });
  return res.status(200).json({ ok: true, user: s.u });
};
