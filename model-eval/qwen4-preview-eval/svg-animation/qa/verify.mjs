/* verify.mjs —— 部署页验证：对比表入口与三个动画页的运行时行为。
 * 零第三方依赖（Node 内置模块 + 本机 Chrome/Edge 的 CDP）。
 * 用法：node qa/verify.mjs                      # 自动起本地服务，跑完关掉
 *       node qa/verify.mjs --base https://mrlian.ai/model-eval/qwen4-preview-eval   # 直接验线上
 * 截图落在 qa/shots-verify/。退出码 0 = 全通过。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep, decodePng, diffRatio, startServer } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const bi = argv.indexOf('--base');
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const server = bi >= 0 ? null : await startServer(REPO, 8130);
const BASE = bi >= 0 ? argv[bi + 1] : server.url + '/model-eval/qwen4-preview-eval';
const OUT = path.join(HERE, 'shots-verify');
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
const ok = (name, pass, detail = '') => {
  if (!pass) fails++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const b = await launch(1440, 900);
const ws = b.ws;
const errors = [];
ws.onEvent(m => {
  const p = m.params || {};
  if (m.method === 'Runtime.exceptionThrown') errors.push('EXC ' + JSON.stringify(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text).slice(0, 240));
  if (m.method === 'Runtime.consoleAPICalled' && p.type === 'error') errors.push('CONSOLE ' + JSON.stringify(p.args?.map(a => a.value ?? a.description)).slice(0, 240));
  if (m.method === 'Log.entryAdded' && p.entry?.level === 'error') errors.push('LOG ' + p.entry.text + ' ' + (p.entry.url || ''));
});
await ws.call('Page.enable'); await ws.call('Runtime.enable'); await ws.call('Log.enable'); await ws.call('Network.enable');
// 授予剪贴板读写权限，才能真验证"复制当前帧"
await ws.call('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
await ws.call('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__probe=1;' });

const shot = async (name) => {
  const r = await ws.call('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(r.data, 'base64');
  fs.writeFileSync(path.join(OUT, name + '.png'), buf);
  return decodePng(buf);
};
const goto = async (url, ms = 1400) => { await ws.call('Page.navigate', { url }); await sleep(ms); };
const viewport = async (w, h) => {
  await ws.call('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 });
  await sleep(500);
};

/* ---------------- 1. 对比表首页 ---------------- */
errors.length = 0;
await goto(BASE + '/index.html');
await viewport(1440, 900);
const idx = await ws.eval(`(() => {
  const links = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'));
  return { title: document.title, svgLinks: links.filter(h => h.startsWith('svg-animation/')),
    rows: document.querySelectorAll('table tr').length,
    hasOverview: links.some(h => h === 'svg-animation/index.html'),
    hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
})()`);
ok('首页 · 三个动画入口存在', idx.svgLinks.length === 3, `${idx.svgLinks.length} 个链接`);
ok('首页 · 无总览入口', !idx.hasOverview);
ok('首页 · 无横向溢出', !idx.hasOverflow);
await shot('01-index-desktop');

const reach = await ws.eval(`(async () => {
  const hs = [...new Set([...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')))];
  const out = [];
  for (const h of hs){ const r = await fetch(h, { method: 'GET' }); out.push([h, r.status]); }
  return out;
})()`, true);
ok('首页 · 所有链接可达', reach.every(([, s]) => s === 200), reach.filter(([, s]) => s !== 200).map(x => x.join('=')).join(',') || `${reach.length} 个全部 200`);
ok('首页 · 控制台干净', errors.length === 0, errors.join(' | '));

await viewport(390, 844);
const mobIdx = await ws.eval(`document.documentElement.scrollWidth > window.innerWidth + 1`);
ok('首页 · 手机无横向溢出', !mobIdx);
await shot('02-index-mobile');
await viewport(1600, 900);

/* ---------------- 2. 三个动画页 ---------------- */
for (const [file, name, loop] of [['pelican-bike.html', 'pelican-bike', 20], ['croc-watch.html', 'croc-watch', 24], ['octopus-clock.html', 'octopus-clock', 30]]){
  errors.length = 0;
  await goto(BASE + '/svg-animation/' + file);
  await viewport(1600, 900);
  await sleep(900);
  const st = await ws.eval(`(() => { const q = window.__QA__; return { ready: q.ready(), case: q.case(), loop: q.state().loop,
    svgCount: document.querySelectorAll('#scene *').length,
    hudButtons: [...document.querySelectorAll('#hud button')].map(b => b.id),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1 }; })()`);
  ok(`${name} · 打开即播 + QA 就绪`, st.ready && st.case === name && st.loop === loop, JSON.stringify({ ready: st.ready, loop: st.loop }));
  ok(`${name} · 工具栏七件套齐全`, ['btnPlay', 'btnDl', 'btnCopy', 'btnHide'].every(id => st.hudButtons.includes(id)), st.hudButtons.join(','));
  ok(`${name} · 无横向溢出`, !st.overflow);

  // 画面真的在动
  await ws.eval(`window.__QA__.resume()`);
  await sleep(700);
  const a = await shot(`10-${name}-a`);
  await sleep(1000);
  const c = await shot(`10-${name}-b`);
  const d = diffRatio(a, c);
  ok(`${name} · 1 秒像素差 ≥ 2%`, d >= 0.02, (d * 100).toFixed(1) + '%');

  // 暂停 / 播放
  await ws.eval(`document.getElementById('btnPlay').click()`);
  await sleep(250);
  const p1 = await ws.eval(`window.__QA__.state().t`);
  await sleep(600);
  const p2 = await ws.eval(`window.__QA__.state().t`);
  ok(`${name} · 暂停后时间冻结`, Math.abs(p2 - p1) < 1e-9, `${p1.toFixed(3)} → ${p2.toFixed(3)}`);
  await ws.eval(`document.getElementById('btnPlay').click()`);
  await sleep(600);
  const p3 = await ws.eval(`window.__QA__.state().t`);
  ok(`${name} · 恢复后继续走`, p3 > p2, `${p2.toFixed(3)} → ${p3.toFixed(3)}`);

  // 相位滑杆
  await ws.eval(`(() => { const s = document.getElementById('scrub'); s.value = ${loop / 2};
    s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(200);
  const seekNow = await ws.eval(`window.__QA__.state().t`);
  ok(`${name} · 相位滑杆可定格`, Math.abs(seekNow - loop / 2) < 0.6, `${seekNow.toFixed(2)} 目标 ${(loop / 2).toFixed(2)}`);

  // 倍速
  const speedRes = await ws.eval(`(async () => {
    const q = window.__QA__;
    q.resume();
    const sel = document.getElementById('speed');
    sel.value = '2'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    const t0 = q.state().t;
    await new Promise(r => setTimeout(r, 1000));
    const t1 = q.state().t;
    sel.value = '1'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    return { advanced: t1 - t0, playing: document.getElementById('btnPlay').textContent.includes('暂停') };
  })()`, true);
  ok(`${name} · 2× 倍速生效`, speedRes.playing && speedRes.advanced > 1.5, `1 秒走了 ${speedRes.advanced.toFixed(2)} 秒`);
  const seekT = await ws.eval(`window.__QA__.state().t`);
  await ws.eval(`(() => { const s = document.getElementById('speed'); s.value = '1'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);

  // 复制当前帧 SVG：用真实鼠标点击（带用户手势与焦点），再读剪贴板核对
  await ws.call('Page.bringToFront').catch(() => {});
  const box = await ws.eval(`(() => { const r = document.getElementById('btnCopy').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']){
    await ws.call('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  }
  await sleep(500);
  const copy = await ws.eval(`(async () => {
    const toast = document.getElementById('toast');
    const box2 = document.getElementById('svgBox');
    let clip = '';
    try { clip = await navigator.clipboard.readText(); } catch (e){ clip = ''; }
    return { toastShown: toast.classList.contains('show'), toastText: toast.textContent,
      modal: box2.classList.contains('show'), modalLen: document.getElementById('svgText').value.length,
      clipIsSvg: clip.startsWith('<?xml') && clip.includes('<svg'), clipLen: clip.length,
      focused: document.hasFocus() };
  })()`, true);
  const copied = copy.clipIsSvg && copy.clipLen > 5000;
  const fallbackOk = copy.modal && copy.modalLen > 5000;
  ok(`${name} · 复制当前帧有明确反馈`, copied || fallbackOk,
    copied ? `剪贴板 ${copy.clipLen} 字符` : (fallbackOk ? `剪贴板不可用（headless 无焦点），兜底弹窗给出 ${copy.modalLen} 字符源码` : copy.toastText));
  if (copy.modal){
    const closed = await ws.eval(`(() => { document.getElementById('svgClose').click();
      return !document.getElementById('svgBox').classList.contains('show'); })()`);
    ok(`${name} · 兜底弹窗可关闭`, closed);
  }

  // 下载 SVG（拦截 blob，确认能生成合法 SVG）
  const dl = await ws.eval(`(() => {
    let captured = null;
    const origCreate = URL.createObjectURL;
    const origClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = function(blob){ captured = blob; return origCreate.call(URL, blob); };
    HTMLAnchorElement.prototype.click = function(){ /* 不真的下载 */ };
    document.getElementById('btnDl').click();
    URL.createObjectURL = origCreate;
    HTMLAnchorElement.prototype.click = origClick;
    return captured ? { type: captured.type, size: captured.size } : null;
  })()`);
  ok(`${name} · 下载生成 image/svg+xml`, dl && dl.type === 'image/svg+xml' && dl.size > 5000, JSON.stringify(dl));

  // 隐藏 / 恢复工具栏 + 快捷键
  const hud = await ws.eval(`(() => {
    const h = document.getElementById('hud'), r = document.getElementById('hudRestore');
    document.getElementById('btnHide').click();
    const hidden = h.classList.contains('hidden') && r.classList.contains('show');
    const faded = parseFloat(getComputedStyle(r).opacity);
    r.click();
    const shown = !h.classList.contains('hidden') && !r.classList.contains('show');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));
    const byKey = h.classList.contains('hidden');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));
    return { hidden, shown, byKey, faded };
  })()`);
  ok(`${name} · 工具栏可隐藏/恢复/快捷键`, hud.hidden && hud.shown && hud.byKey, JSON.stringify(hud));
  ok(`${name} · 收起态按钮不挡画面`, hud.faded <= 0.3, `opacity=${hud.faded}`);

  // 空格暂停
  const space = await ws.eval(`(() => { const before = document.getElementById('btnPlay').textContent;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    const after = document.getElementById('btnPlay').textContent;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    return before !== after; })()`);
  ok(`${name} · 空格切换播放`, space);

  // 嵌入模式
  await goto(BASE + '/svg-animation/' + file + '?embed=1', 1100);
  const embed = await ws.eval(`document.getElementById('hud').classList.contains('hidden')`);
  ok(`${name} · ?embed=1 自动收起工具栏`, embed === true);

  // 缩放
  await goto(BASE + '/svg-animation/' + file, 1100);
  for (const [w, h, tag] of [[1024, 768, 'tablet'], [390, 844, 'phone'], [1920, 1080, 'wide']]){
    await viewport(w, h);
    const geo = await ws.eval(`(() => { const s = document.getElementById('scene').getBoundingClientRect();
      const hud = document.getElementById('hud').getBoundingClientRect();
      return { sw: Math.round(s.width), sh: Math.round(s.height), iw: window.innerWidth, ih: window.innerHeight,
        hudIn: hud.left >= 0 && hud.right <= window.innerWidth + 1 && hud.bottom <= window.innerHeight + 1,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1 }; })()`);
    ok(`${name} · ${tag} 画面铺满且工具栏在屏内`, geo.sw >= geo.iw - 1 && geo.sh >= geo.ih - 1 && geo.hudIn && !geo.overflow, JSON.stringify(geo));
    await shot(`11-${name}-${tag}`);
  }
  await viewport(1600, 900);

  // 循环无缝（首尾截图）
  await ws.eval(`window.__QA__.setLoopTime(0)`); await sleep(150);
  const l0 = await shot(`12-${name}-t0`);
  await ws.eval(`window.__QA__.setLoopTime(${loop})`); await sleep(150);
  const l1 = await shot(`12-${name}-tloop`);
  const dl2 = diffRatio(l0, l1);
  ok(`${name} · 循环首尾差异 < 3%`, dl2 < 0.03, (dl2 * 100).toFixed(2) + '%');
  await ws.eval(`window.__QA__.resume()`);
  await sleep(2200);
  const fps = await ws.eval(`new Promise(res => { const ts = []; let s0 = 0;
    const tick = t => { if (!s0) s0 = t; ts.push(t); if (t - s0 < 2000) requestAnimationFrame(tick);
      else res((ts.length - 1) * 1000 / (t - s0)); }; requestAnimationFrame(tick); })`, true);
  ok(`${name} · 帧率 ≥ 55`, fps >= 55, fps.toFixed(1) + ' fps');
  ok(`${name} · 控制台干净`, errors.length === 0, errors.join(' | '));
}

await b.close();
if (server) server.close();
console.log(`\n==== 部署验证：${fails === 0 ? '全部通过' : fails + ' 项失败'} ====`);
process.exit(fails ? 1 : 0);
