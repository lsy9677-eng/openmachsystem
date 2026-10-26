import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http://127.0.0.1:9199; connect-src 'self' data: blob: http://127.0.0.1:9099 http://127.0.0.1:8080 http://127.0.0.1:9199; worker-src blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";
http.createServer(async (req, res) => {
  if (!['127.0.0.1:8000', 'localhost:8000'].includes(req.headers.host)) { res.writeHead(403).end('Unapproved host'); return; }
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const url = new URL(req.url, 'http://127.0.0.1:8000');
  if (/^\/(api|naver|kakao)\//.test(url.pathname)) {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, success: true, mock: true, message: '개발 모의 응답' })); return;
  }
  try {
    const relative = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
    if (relative.split('/').some(segment => segment.startsWith('.'))) throw new Error();
    // Explicit public asset list. Never serve credentials, node_modules, functions or .git.
    if (!/^(index\.html|privacy\.html|manifest\.json|(?:logo-230|icon-\d+)\.png|assets\/(?:js|css|images|audio)\/[^\\]+|guide\/[^\\]+|data\/test-teams-100\.json)$/.test(relative)) throw new Error();
    if (/^(?:sw|firebase-messaging-sw)\.js$/.test(path.basename(relative))) throw new Error();
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) throw new Error();
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(data);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(8000, '127.0.0.1', () => console.log('230MATCH local: http://127.0.0.1:8000 (demo-230match only)'));
