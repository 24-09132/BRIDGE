/**
 * Vercel Serverless Function: /api/login
 *  POST { username, password }  -> signs in (sets a secure session cookie for 12 hours)
 *  POST { logout: true }        -> signs out
 */
const { checkLogin, makeSessionCookie, clearSessionCookie } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};
  if (b.logout) {
    res.setHeader('Set-Cookie', clearSessionCookie());
    return res.status(200).json({ ok: true });
  }
  if (!checkLogin(String(b.username ?? ''), String(b.password ?? ''))) {
    await new Promise((r) => setTimeout(r, 600));   // slow down password guessing
    return res.status(401).json({ error: 'Incorrect username or password' });
  }
  res.setHeader('Set-Cookie', makeSessionCookie(String(b.username)));
  return res.status(200).json({ ok: true });
};
