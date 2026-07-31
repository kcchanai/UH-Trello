import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server = http.createServer(async (request, response) => {
  try {
    const raw = new URL(request.url, 'http://127.0.0.1').pathname;
    const relative = raw === '/' ? 'index.html' : decodeURIComponent(raw).replace(/^\/+/, '');
    const file = path.resolve(root, relative);
    if (!file.startsWith(root) || !(await stat(file)).isFile()) throw new Error('not found');
    response.writeHead(200, {'content-type': mime[path.extname(file)] || 'application/octet-stream'});
    response.end(await readFile(file));
  } catch { response.writeHead(404).end('Not found'); }
});
server.listen(4173, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
console.log('Flowboard test server ready at http://127.0.0.1:4173');
const close = () => server.close();
process.on('SIGTERM', close); process.on('SIGINT', close);
