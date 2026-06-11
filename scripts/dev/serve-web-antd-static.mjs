import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve('apps/web-antd/dist');
const port = Number(process.env.PORT || 5667);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveFile(url = '/') {
  const pathname = decodeURIComponent(url.split('?')[0] || '/');
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const candidate = resolve(join(root, safePath));
  if (!candidate.startsWith(root)) return join(root, 'index.html');
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return join(root, 'index.html');
}

createServer((request, response) => {
  const file = resolveFile(request.url);
  response.setHeader('Content-Type', contentTypes[extname(file)] || 'application/octet-stream');
  createReadStream(file).pipe(response);
}).listen(port, '0.0.0.0', () => {
  console.log(`web-antd static server listening on http://localhost:${port}`);
});
