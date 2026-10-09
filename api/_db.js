/**
 * Database & Authentication Helper for Vercel Serverless Functions
 * Supports Upstash Redis with graceful in-memory fallback
 */
const { Redis } = require('@upstash/redis');
const crypto = require('crypto');

let redis = null;
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (redisUrl && redisToken) {
  try {
    redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  } catch (err) {
    console.warn('[DB] Upstash Redis initialization error:', err.message);
  }
}

// In-memory fallback telemetry (used only when Upstash Redis is not connected).
// Starts empty so the dashboard never shows made-up readings as "online".
let memoryTelemetry = {};

let memoryHistory = [];

/**
 * Validates request authorization using API Key
 * Supports environment variables: API_KEY, bridge_key, BRIDGE_KEY
 * Expected default key value: 'bridgingthegap'
 */
function isAuthorized(req) {
  const configuredKey = process.env.API_KEY || process.env.bridge_key || process.env.BRIDGE_KEY || 'bridgingthegap';
  
  // Extract key from headers (x-api-key, bridge_key, bridge-key) or query string
  const headerKey = req.headers['x-api-key'] || req.headers['bridge_key'] || req.headers['bridge-key'] || req.headers['x-bridge-key'];
  let queryKey = req.query && (req.query.key || req.query.bridge_key);
  if (!queryKey && req.url) {
    try {
      const u = new URL(req.url, 'http://localhost');
      queryKey = u.searchParams.get('key') || u.searchParams.get('bridge_key');
    } catch (e) {}
  }

  const providedKey = headerKey || queryKey;
  
  return Boolean(providedKey) && providedKey === configuredKey;
}

/**
 * Website login (username/password are checked here on the server, never in the browser).
 * Change them in Vercel → Settings → Environment Variables: ADMIN_USER and ADMIN_PASS.
 */
const SESSION_HOURS = 12;
function adminUser() { return process.env.ADMIN_USER || 'admin'; }
function adminPass() { return process.env.ADMIN_PASS || 'admin'; }
function sessionSecret() {
  return process.env.SESSION_SECRET || ('fs-' + adminUser() + ':' + adminPass() + ':' + (process.env.bridge_key || process.env.API_KEY || 'bridgingthegap'));
}
function sign(data) { return crypto.createHmac('sha256', sessionSecret()).update(data).digest('base64url'); }
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function checkLogin(user, pass) { return safeEqual(user, adminUser()) && safeEqual(pass, adminPass()); }

function makeSessionCookie(user) {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const data = Buffer.from(JSON.stringify({ u: user, exp })).toString('base64url');
  const token = data + '.' + sign(data);
  return `fs_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}`;
}
function clearSessionCookie() { return 'fs_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'; }

function getSession(req) {
  const raw = (req.headers && req.headers.cookie) || '';
  const m = raw.match(/(?:^|;\s*)fs_session=([^;]+)/);
  if (!m) return null;
  const [data, sig] = m[1].split('.');
  if (!data || !sig || !safeEqual(sig, sign(data))) return null;
  try {
    const s = JSON.parse(Buffer.from(data, 'base64url').toString());
    return s.exp > Date.now() ? s : null;
  } catch (e) { return null; }
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-api-key, bridge_key, bridge-key, x-bridge-key, Content-Type');
}

module.exports = {
  redis,
  memoryTelemetry,
  memoryHistory,
  isAuthorized,
  setCorsHeaders,
  checkLogin,
  makeSessionCookie,
  clearSessionCookie,
  getSession
};
