/* qa/lib.mjs —— QA 共用底座：裸 CDP WebSocket、浏览器发现、PNG 解码、静态服务器。
 * 零第三方依赖（Node 内置模块）。模式借鉴 tools/browser-check.mjs，但为断言做了精简。 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- 浏览器发现 ---------------- */
export function findBrowser(){
  const c = [];
  const add = p => { if (p && fs.existsSync(p) && !c.includes(p)) c.push(p); };
  if (process.env.BROWSER_CHECK_CHROME) add(process.env.BROWSER_CHECK_CHROME);
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env['LOCALAPPDATA'] || '';
  add(path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  add(path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  if (local) add(path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  add(path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  add(path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  add('/usr/bin/google-chrome'); add('/usr/bin/chromium'); add('/usr/bin/chromium-browser');
  return c[0] || null;
}

/* ---------------- CDP 客户端 ----------------
 * 下面这段 WsClient 取自本题工具链 tools/browser-check.mjs（原样搬运，未改逻辑）。
 * 手写 WS 客户端在本机 headless Chrome 上会让 renderer 崩，这份实现已验证稳定。 */
class WsClient {
  constructor(sock) {
    this.sock = sock;
    this.buf = Buffer.alloc(0);
    this.upgraded = false;
    this.closed = false;
    this.fragOp = null;
    this.fragParts = [];
    this.waiters = new Map();
    this.seq = 0;
    this.events = [];
    this._onEvent = null;
    this._upgradeWaiters = [];
    sock.on('data', (chunk) => this._onData(chunk));
    sock.on('error', (err) => this._failAll(err));
    sock.on('close', () => {
      this.closed = true;
      this._failAll(new Error('WebSocket 已关闭'));
    });
  }

  static connect(wsUrl) {
    return new Promise((resolve, reject) => {
      let u;
      try {
        u = new URL(wsUrl);
      } catch (e) {
        return reject(new Error(`CDP 返回的 WebSocket 地址不合法：${wsUrl}`));
      }
      const isTls = u.protocol === 'wss:';
      const port = Number(u.port) || (isTls ? 443 : 80);
      const sock = isTls
        ? require('node:tls').connect({ host: u.hostname, port })
        : net.connect(port, u.hostname);
      const client = new WsClient(sock);
      const key = crypto.randomBytes(16).toString('base64');
      const onConnect = () => {
        sock.write(
          `GET ${u.pathname}${u.search} HTTP/1.1\r\n` +
          `Host: ${u.hostname}:${port}\r\n` +
          `Upgrade: websocket\r\nConnection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
        );
      };
      if (isTls) sock.once('secureConnect', onConnect);
      else sock.once('connect', onConnect);
      const timer = setTimeout(() => reject(new Error('连接 CDP WebSocket 超时')), 15000);
      client._onUpgrade = (ok) => {
        clearTimeout(timer);
        if (ok) resolve(client);
        else reject(new Error('CDP WebSocket 握手失败（HTTP 101 没拿到）'));
      };
    });
  }

  _onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    if (!this.upgraded) {
      const i = this.buf.indexOf('\r\n\r\n');
      if (i === -1) return;
      const head = this.buf.slice(0, i).toString('utf8');
      this.buf = this.buf.slice(i + 4);
      this.upgraded = true;
      const ok = /^HTTP\/1\.1 101/.test(head);
      if (this._onUpgrade) this._onUpgrade(ok);
      if (!ok) return;
    }
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0];
      const b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0;
      const op = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (this.buf.length < 4) return;
        len = this.buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (this.buf.length < 10) return;
        const big = this.buf.readBigUInt64BE(2);
        if (big > BigInt(64 * 1024 * 1024)) {
          this._failAll(new Error('WebSocket 单帧超过 64MB，放弃'));
          this.sock.destroy();
          return;
        }
        len = Number(big);
        off = 10;
      }
      let mask = null;
      if (masked) {
        if (this.buf.length < off + 4) return;
        mask = this.buf.slice(off, off + 4);
        off += 4;
      }
      if (this.buf.length < off + len) return;
      let payload = this.buf.slice(off, off + len);
      if (mask) {
        const out = Buffer.alloc(len);
        for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i % 4];
        payload = out;
      }
      this.buf = this.buf.slice(off + len);
      if (op === 0x8) { // close
        if (!this.closed) this.sock.end();
        this.closed = true;
        return;
      }
      if (op === 0x9) { // ping → 回 pong
        this._writeFrame(0xa, payload);
        continue;
      }
      if (op === 0xa) continue; // pong
      // 文本（1）或二进制（2）或续帧（0）
      if (op === 0x1 || op === 0x2) {
        this.fragOp = op;
        this.fragParts = [payload];
      } else if (op === 0x0) {
        this.fragParts.push(payload);
      } else {
        continue;
      }
      if (!fin) continue;
      const whole = Buffer.concat(this.fragParts);
      this.fragParts = [];
      const isText = this.fragOp === 0x1;
      this.fragOp = null;
      if (isText) this._dispatch(whole.toString('utf8'));
    }
  }

  _writeFrame(op, payload) {
    const d = Buffer.from(payload);
    const n = d.length;
    let head;
    if (n < 126) head = Buffer.from([0x80 | op, 0x80 | n]);
    else if (n < 65536) {
      head = Buffer.alloc(4);
      head[0] = 0x80 | op;
      head[1] = 0x80 | 126;
      head.writeUInt16BE(n, 2);
    } else {
      head = Buffer.alloc(10);
      head[0] = 0x80 | op;
      head[1] = 0x80 | 127;
      head.writeBigUInt64BE(BigInt(n), 2);
    }
    const mask = crypto.randomBytes(4);
    const masked = Buffer.alloc(n);
    for (let i = 0; i < n; i++) masked[i] = d[i] ^ mask[i % 4];
    this.sock.write(Buffer.concat([head, mask, masked]));
  }

  _dispatch(text) {
    let msg;
    try {
      msg = JSON.parse(text);
    } catch (_) {
      return;
    }
    if (msg.id && this.waiters.has(msg.id)) {
      const w = this.waiters.get(msg.id);
      this.waiters.delete(msg.id);
      clearTimeout(w.timer);
      if (msg.error) w.reject(new Error(`${w.method} 失败：${msg.error.message || JSON.stringify(msg.error)}`));
      else w.resolve(msg.result || {});
      return;
    }
    if (this._onEvent) {
      try {
        this._onEvent(msg);
      } catch (_) { /* 事件回调出错不影响主流程 */ }
    }
  }

  call(method, params = {}, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      if (this.closed) return reject(new Error('WebSocket 已关闭，无法发送 ' + method));
      const id = ++this.seq;
      const timer = setTimeout(() => {
        this.waiters.delete(id);
        reject(new Error(`${method} 超时（${timeoutMs}ms 没等到响应）`));
      }, timeoutMs);
      this.waiters.set(id, { resolve, reject, timer, method });
      this._writeFrame(0x1, JSON.stringify({ id, method, params }));
    });
  }

  onEvent(fn) {
    this._onEvent = fn;
  }

  _failAll(err) {
    for (const [, w] of this.waiters) {
      clearTimeout(w.timer);
      w.reject(err);
    }
    this.waiters.clear();
  }

  close() {
    try {
      this._writeFrame(0x8, Buffer.alloc(0));
    } catch (_) { /* 忽略 */ }
    try {
      this.sock.destroy();
    } catch (_) { /* 忽略 */ }
    this.closed = true;
  }
}

async function getWsClient(){ return WsClient; }

/* ---------------- 启动 headless 浏览器 ---------------- */
export async function launch(width = 1600, height = 900){
  const exe = findBrowser();
  if (!exe) throw new Error('找不到 Chrome/Edge');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-svg-'));
  const port = 9300 + Math.floor(Math.random() * 400);
  const proc = spawn(exe, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-component-update',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--disable-features=Translate,MediaRouter,OptimizationHints',
    '--mute-audio', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required',
    '--remote-allow-origins=*', 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  proc.on('exit', (code, sig) => console.error('CHROME EXIT', code, sig));
  const deadline = Date.now() + 25000;
  let page = null;
  while (Date.now() < deadline){
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1500) });
      const list = await r.json();
      page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) break;
    } catch {}
    await sleep(250);
  }
  if (!page){ proc.kill(); throw new Error('浏览器 DevTools 没起来'); }
  const WsClient = await getWsClient();
  const ws = await WsClient.connect(page.webSocketDebuggerUrl);
  ws.eval = async (expression, awaitPromise = false) => {
    const r = await ws.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) throw new Error('页面内 JS 报错：' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 400));
    return r.result ? r.result.value : undefined;
  };
  return {
    ws, exe,
    async close(){ ws.close(); proc.kill(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} },
  };
}

/* ---------------- PNG 解码（8bit 非隔行） ---------------- */
export function decodePng(buf){
  let off = 8, ihdr = null; const idat = [];
  while (off + 8 <= buf.length){
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.slice(off + 8, off + 8 + len); off += 12 + len;
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], ct: data[9], interlace: data[12] };
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (!ihdr || ihdr.depth !== 8 || ihdr.interlace !== 0) throw new Error('PNG 格式不支持');
  const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.ct];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { w, h } = ihdr, stride = w * bpp, px = Buffer.alloc(stride * h);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  let pos = 0;
  for (let y = 0; y < h; y++){
    const ft = raw[pos++], row = y * stride, prev = y > 0 ? (y - 1) * stride : -1;
    for (let i = 0; i < stride; i++){
      const x = raw[pos + i];
      const a = i >= bpp ? px[row + i - bpp] : 0, b = prev >= 0 ? px[prev + i] : 0, c = prev >= 0 && i >= bpp ? px[prev + i - bpp] : 0;
      let v;
      if (ft === 0) v = x; else if (ft === 1) v = x + a; else if (ft === 2) v = x + b;
      else if (ft === 3) v = x + ((a + b) >> 1); else if (ft === 4) v = x + paeth(a, b, c);
      else throw new Error('未知行过滤 ' + ft);
      px[row + i] = v & 255;
    }
    pos += stride;
  }
  return { w, h, bpp, px };
}
export function lumaStats(img){
  let n = 0, sum = 0, sq = 0;
  const step = Math.max(1, Math.floor(Math.sqrt(img.w * img.h / 20000)));
  for (let y = 0; y < img.h; y += step) for (let x = 0; x < img.w; x += step){
    const i = (y * img.w + x) * img.bpp;
    const l = 0.299 * img.px[i] + 0.587 * img.px[i + (img.bpp >= 3 ? 1 : 0)] + 0.114 * img.px[i + (img.bpp >= 3 ? 2 : 0)];
    n++; sum += l; sq += l * l;
  }
  const mean = sum / n;
  return { mean, variance: Math.max(0, sq / n - mean * mean), stdDev: Math.sqrt(Math.max(0, sq / n - mean * mean)) };
}
/* 两张同尺寸截图的差异比例：抽样像素亮度差 > 10 记为变化 */
export function diffRatio(a, b){
  if (a.w !== b.w || a.h !== b.h) return 1;
  let n = 0, changed = 0;
  const step = 2;
  for (let y = 0; y < a.h; y += step) for (let x = 0; x < a.w; x += step){
    const ia = (y * a.w + x) * a.bpp, ib = (y * b.w + x) * b.bpp;
    const la = 0.299 * a.px[ia] + 0.587 * a.px[ia + (a.bpp >= 3 ? 1 : 0)] + 0.114 * a.px[ia + (a.bpp >= 3 ? 2 : 0)];
    const lb = 0.299 * b.px[ib] + 0.587 * b.px[ib + (b.bpp >= 3 ? 1 : 0)] + 0.114 * b.px[ib + (b.bpp >= 3 ? 2 : 0)];
    n++; if (Math.abs(la - lb) > 10) changed++;
  }
  return changed / n;
}

/* ---------------- 内置静态服务器（零依赖，仓库自包含） ---------------- */
export async function startServer(root, wantPort = 8130){
  const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
    '.mjs':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
    '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.png':'image/png', '.css':'text/css; charset=utf-8' };
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
    catch { res.writeHead(400); res.end('bad url'); return; }
    let file = path.join(root, pathname);
    if (!path.resolve(file).startsWith(path.resolve(root))){ res.writeHead(403); res.end('forbidden'); return; }
    try {
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      const data = fs.readFileSync(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': data.length, 'Cache-Control': 'no-store' });
      res.end(data);
    } catch { res.writeHead(404); res.end('404 ' + pathname); }
  });
  const port = await new Promise((res, rej) => {
    let p = wantPort, tries = 0;
    server.on('error', e => {
      if (e.code === 'EADDRINUSE' && tries++ < 20){ p++; server.listen(p, '127.0.0.1'); }
      else rej(e);
    });
    server.once('listening', () => res(p));
    server.listen(p, '127.0.0.1');
  });
  return { port, url: `http://127.0.0.1:${port}`, close: () => server.close() };
}
