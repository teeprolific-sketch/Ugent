// Production server for self-hosting: Next.js, plus gzip on API replies.
// Next.js 16 sends route-handler replies uncompressed (its own compression and the usual middleware both miss
// them), and phones on mobile data pay for every byte. A sync of 40 tasks drops from about 12 KB to about 0.5 KB.
// Hosts that compress at the edge (Vercel, Cloudflare, nginx with gzip on) can use `next start` instead.
import next from 'next';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOSTNAME ?? '0.0.0.0';
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();
const MIN_BYTES = 1024; // smaller replies gain little

/** API replies are small JSON documents, so collect each one whole, then gzip it if that's worth it. */
function gzipApiReply(req, res) {
  if (!req.url?.startsWith('/api/') || !/\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) return;
  const end = res.end.bind(res), writeHead = res.writeHead.bind(res);
  const chunks = [];
  const add = (chunk, enc) => { if (chunk != null && typeof chunk !== 'function') chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof enc === 'string' ? enc : 'utf8')); };
  let status = null;
  res.writeHead = (code, ...rest) => {
    status = code;
    const headers = rest.find((x) => x && typeof x === 'object');
    if (Array.isArray(headers)) for (let i = 0; i < headers.length; i += 2) res.setHeader(headers[i], headers[i + 1]);
    else if (headers) for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return res;
  };
  res.flushHeaders = () => {};
  res.write = (chunk, enc, cb) => { add(chunk, enc); (typeof enc === 'function' ? enc : cb)?.(); return true; };
  res.end = (chunk, enc, cb) => {
    add(chunk, enc);
    const done = typeof chunk === 'function' ? chunk : typeof enc === 'function' ? enc : cb;
    let body = Buffer.concat(chunks);
    const type = String(res.getHeader('content-type') ?? '');
    res.removeHeader('transfer-encoding');
    if (body.length >= MIN_BYTES && type.includes('json') && !res.getHeader('content-encoding')) {
      body = gzipSync(body);
      res.setHeader('content-encoding', 'gzip');
      const vary = String(res.getHeader('vary') ?? '');
      res.setHeader('vary', vary ? `${vary}, Accept-Encoding` : 'Accept-Encoding');
    }
    res.setHeader('content-length', body.length);
    writeHead(status ?? res.statusCode);
    return end(body, done);
  };
}

await app.prepare();
createServer((req, res) => {
  gzipApiReply(req, res);
  void handle(req, res);
}).listen(port, hostname, () => {
  console.log(`Ugent API ready on http://${hostname}:${port}`);
});
