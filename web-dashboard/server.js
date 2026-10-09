/**
 * FLOOD-SENTINEL local server – runs the same website and the same /api functions as Vercel,
 * so you can test on a laptop. Run `npm install` once, then `npm start`, open http://localhost:3000
 * Sign in with the same username/password (defaults admin / admin, or ADMIN_USER / ADMIN_PASS).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');
const API = {
  '/api/telemetry': require('../api/telemetry.js'),
  '/api/history': require('../api/history.js'),
  '/api/control': require('../api/control.js'),
  '/api/login': require('../api/login.js'),
  '/api/session': require('../api/session.js'),
};
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const handler = API[url.pathname];
  if (handler) {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try { req.body = body ? JSON.parse(body) : undefined; } catch (e) { req.body = body; }
      req.query = Object.fromEntries(url.searchParams);
      const shim = {
        setHeader: (k, v) => res.setHeader(k, v),
        status(c) { res.statusCode = c; return this; },
        json(b) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)); return this; },
        end() { res.end(); return this; },
      };
      try { await handler(req, shim); } catch (e) { res.statusCode = 500; res.end('{"error":"server error"}'); }
    });
    return;
  }
  const file = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}api${path.sep}`)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404 Not Found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`FLOOD-SENTINEL local server: http://localhost:${PORT}`));
