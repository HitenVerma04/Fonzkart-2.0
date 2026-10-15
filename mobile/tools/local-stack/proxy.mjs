// Serves an app's web build and forwards /api, /actuator and /uploads to the backend, so the browser sees one origin
// (the backend sends no CORS headers; phones do not need this). Used by run.sh for local end-to-end checks.
//   node proxy.mjs <web build dir> <backend url> <port>
import { createServer, request } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const [dir, backend, port = '8099'] = process.argv.slice(2);
const target = new URL(backend);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
  '.woff2': 'font/woff2', '.webp': 'image/webp',
};

createServer((req, res) => {
  const path = (req.url || '/').split('?')[0];
  if (/^\/(api|actuator|uploads)(\/|$)/.test(path)) {
    const upstream = request({
      hostname: target.hostname, port: target.port || 80, path: req.url, method: req.method,
      headers: { ...req.headers, host: target.host },
    }, up => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    });
    upstream.on('error', () => { res.writeHead(502); res.end('backend unavailable'); });
    req.pipe(upstream);
    return;
  }
  let file = normalize(join(dir, decodeURIComponent(path)));
  if (!file.startsWith(normalize(dir)) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(dir, 'index.html'); // single-page app: every route is index.html
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(Number(port), () => console.log(`preview on http://localhost:${port} -> ${backend}`));
