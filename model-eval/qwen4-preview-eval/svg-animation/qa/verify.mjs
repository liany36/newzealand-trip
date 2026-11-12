/* verify.mjs —— 部署页验证：对比表入口、展示页交互、三个动画的运行时行为。
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
    hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
})()`);
ok('首页 · 附加题 D 入口存在', idx.svgLinks.length === 4, `${idx.svgLinks.length} 个链接`);
ok('首页 · 无横向溢出', !idx.hasOverflow);
await shot('01-index-desktop');

// 链接可达性（含返回链接）
const reach = await ws.eval(`(async () => {
  const hs = [...new Set([...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')))];
  const out = [];
  for (const h of hs){ const r = await fetch(h, { method: 'GET' }); out.push([h, r.status]); }
  return out;
})()`, true);
ok('首页 · 所有链接可达', reach.every(([, s]) => s === 200), reach.filter(([, s]) => s !== 200).map(x => x.join('=')).join(',') || `${reach.length} 个全部 200`);
ok('首页 · 控制台干净', errors.length === 0, errors.join(' | '));

/* ---------------- 2. 展示页 ---------------- */
errors.length = 0;
await goto(BASE + '/svg-animation/index.html');
await viewport(1440, 900);
const gal = await ws.eval(`(() => ({
  imgs: [...document.images].map(i => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 })),
  cards: document.querySelectorAll('.scene').length,
  back: document.querySelector('.back').getAttribute('href'),
  overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
}))()`);
ok('展示页 · 三张预览图都加载', gal.imgs.length === 3 && gal.imgs.every(i => i.ok), JSON.stringify(gal.imgs.map(i => i.ok)));
ok('展示页 · 三张卡片', gal.cards === 3);
ok('展示页 · 无横向溢出', !gal.overflow);
await shot('02-gallery-desktop');

// 内嵌播放：第一张
await ws.eval(`document.querySelectorAll('[data-play]')[0].click()`);
await sleep(1600);
const play1 = await ws.eval(`(() => {
  const s = document.querySelectorAll('.scene')[0];
  const f = s.querySelector('iframe');
  return { live: s.classList.contains('live'), src: f && f.getAttribute('src'),
    label: s.querySelector('[data-play]').textContent.trim(),
    badge: s.querySelector('.badge-t').textContent.trim(),
    innerReady: !!(f && f.contentWindow.__QA__ && f.contentWindow.__QA__.ready()),
    innerHudHidden: !!(f && f.contentDocument.getElementById('hud').classList.contains('hidden')),
    innerT: f && f.contentWindow.__QA__ ? f.contentWindow.__QA__.state().t : null };
})()`);
ok('展示页 · 内嵌播放起来', play1.live && play1.innerReady, JSON.stringify({ src: play1.src, ready: play1.innerReady }));
ok('展示页 · 嵌入时工具栏自动收起', play1.innerHudHidden);
ok('展示页 · 按钮与角标同步', play1.label.includes('停止') && play1.badge === '正在播放', play1.label + ' / ' + play1.badge);
await sleep(900);
const t2 = await ws.eval(`document.querySelectorAll('.scene')[0].querySelector('iframe').contentWindow.__QA__.state().t`);
ok('展示页 · 内嵌动画真的在走', t2 > play1.innerT, `${play1.innerT?.toFixed(2)} → ${t2.toFixed(2)}`);
await shot('03-gallery-playing');

// 切到第二张：第一张必须停掉、iframe 移除
await ws.eval(`document.querySelectorAll('[data-play]')[1].click()`);
await sleep(1500);
const sw = await ws.eval(`(() => {
  const ss = [...document.querySelectorAll('.scene')];
  return { live: ss.map(s => s.classList.contains('live')), frames: document.querySelectorAll('iframe').length,
    labels: ss.map(s => s.querySelector('[data-play]').textContent.trim()),
    case2: ss[1].querySelector('iframe').contentWindow.__QA__.case() };
})()`);
ok('展示页 · 同时只播一个', sw.live.filter(Boolean).length === 1 && sw.frames === 1, JSON.stringify(sw.live));
ok('展示页 · 切换后第二个场景正确', sw.case2 === 'croc-watch', sw.case2);

// 停止：iframe 移除、回到静帧
await ws.eval(`document.querySelectorAll('[data-play]')[1].click()`);
await sleep(500);
const stopped = await ws.eval(`(() => ({ frames: document.querySelectorAll('iframe').length,
  live: [...document.querySelectorAll('.scene')].some(s => s.classList.contains('live')),
  imgVisible: getComputedStyle(document.querySelectorAll('.scene')[1].querySelector('img')).opacity }))()`);
ok('展示页 · 停止后回到静帧', stopped.frames === 0 && !stopped.live && stopped.imgVisible === '1', JSON.stringify(stopped));

// 反复切 6 次，确认不堆积 iframe / 定时器
for (let i = 0; i < 6; i++){
  await ws.eval(`document.querySelectorAll('[data-play]')[${i % 3}].click()`);
  await sleep(320);
}
const stress = await ws.eval(`document.querySelectorAll('iframe').length`);
ok('展示页 · 反复切换不堆积 iframe', stress <= 1, `当前 ${stress} 个`);
await ws.eval(`[...document.querySelectorAll('.scene')].forEach(s => { if (s.classList.contains('live')) s.querySelector('[data-play]').click(); })`);

// 返回链接
const backStatus = await ws.eval(`fetch(document.querySelector('.back').getAttribute('href')).then(r => r.status)`, true);
ok('展示页 · 返回对比表可达', backStatus === 200, String(backStatus));

// 手机布局
await viewport(390, 844);
const mob = await ws.eval(`(() => {
  const r = document.querySelector('.frame').getBoundingClientRect();
  const btn = document.querySelector('[data-play]').getBoundingClientRect();
  return { overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    frameW: Math.round(r.width), frameH: Math.round(r.height), btnW: Math.round(btn.width),
    ratio: +(r.width / r.height).toFixed(2) };
})()`);
ok('展示页 · 手机无横向溢出', !mob.overflow, JSON.stringify(mob));
ok('展示页 · 手机画面保持 16:9', Math.abs(mob.ratio - 16 / 9) < 0.05, String(mob.ratio));
await shot('04-gallery-mobile');
await ws.eval(`document.querySelectorAll('[data-play]')[2].click()`);
await sleep(1600);
await shot('05-gallery-mobile-playing');
const mobPlay = await ws.eval(`!!document.querySelectorAll('.scene')[2].querySelector('iframe').contentWindow.__QA__.ready()`);
ok('展示页 · 手机内嵌播放可用', mobPlay);
await ws.eval(`document.querySelectorAll('[data-play]')[2].click()`);
ok('展示页 · 控制台干净', errors.length === 0, errors.join(' | '));

/* ---------------- 3. 三个场景各自的全屏页 ---------------- */
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
