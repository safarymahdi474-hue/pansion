'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.webmanifest']);

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; " +
    "connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function send(res, status, body, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS, ...extra });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request');
  }
  if (pathname.includes('\0')) return send(res, 400, 'Bad request');

  if (pathname === '/healthz') return send(res, 200, 'ok', { 'Cache-Control': 'no-store' });

  let target = path.resolve(PUBLIC, '.' + pathname);
  // must stay strictly inside PUBLIC (note the path.sep: "/public-secret" must not pass)
  if (target !== PUBLIC && !target.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Forbidden');

  fs.stat(target, (err, st) => {
    if (!err && st.isDirectory()) {
      target = path.join(target, 'index.html');
      return fs.stat(target, (e2, st2) => (e2 ? send(res, 404, 'Not found') : serve(req, res, target, st2)));
    }
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    serve(req, res, target, st);
  });
});

function serve(req, res, file, st) {
  const ext = path.extname(file).toLowerCase();
  const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  const isFont = ext === '.woff2';
  const headers = {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    ETag: etag,
    'Last-Modified': st.mtime.toUTCString(),
    'Cache-Control': isFont ? 'public, max-age=604800, immutable' : 'public, max-age=0, must-revalidate',
    Vary: 'Accept-Encoding',
    ...SECURITY_HEADERS,
  };

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }

  const wantsGzip = COMPRESSIBLE.has(ext) && st.size > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (wantsGzip) headers['Content-Encoding'] = 'gzip';
  else headers['Content-Length'] = st.size;

  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();

  const stream = fs.createReadStream(file);
  stream.on('error', () => res.destroy());
  if (wantsGzip) stream.pipe(zlib.createGzip()).pipe(res);
  else stream.pipe(res);
}

server.listen(PORT, '0.0.0.0', () => console.log(`Pansion listening on ${PORT}`));

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
