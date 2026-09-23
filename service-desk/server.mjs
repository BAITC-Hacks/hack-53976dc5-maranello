import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('./', import.meta.url)));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.csv': 'text/csv' };
const port = Number(process.env.PORT || 4173);
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!['/', '/index.html', '/style.css', '/app.js', '/core.js', '/example.csv'].includes(url.pathname)) { res.writeHead(404).end(); return; }
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': (types[path.extname(target)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Service Desk: http://127.0.0.1:${port}`));
