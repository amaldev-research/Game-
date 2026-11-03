/* =========================================================================
   EUVERIFY – THE GLOBAL MARKET ADVENTURE
   A 2D side-scrolling platformer in vanilla JS + HTML5 Canvas.
   India → United Kingdom → European Union → Global Market Success.
   All art is drawn in code (plus the Euverify logos in logos.js), the world
   map comes from Natural Earth (worldmap.js) and all sound is synthesised.
   ========================================================================= */
(() => {
'use strict';

/* ------------------------------------------------------------ constants */
const T = 40, ROWS = 13;
let VW = 960; const VH = 520;
const GRAV = 2000, MAX_FALL = 900;
const WALK = 230, RUN = 345, ACC_G = 1900, ACC_A = 1200, FRICTION = 2300;
const JUMP_V = 730, DJUMP_V = 640;
const MAX_STR = 5;
const TAU = Math.PI * 2;

const C = {
  green: '#C3FF66', yellow: '#FEEA99', purple: '#6B4C9A', ink: '#000000',
  skin: '#F1C27D', hair: '#3B2618', pipe: '#6B4C9A', pipeHi: '#9576C9', pipeDark: '#4A3270',
  steel: '#9AA4AE', steelDark: '#5E6872'
};

const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
canvas.width = VW; canvas.height = VH;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/* ------------------------------------------------------- brand logos */
const LOGO_SRC = window.EUVERIFY_LOGOS || {};
const LOGO = {};
['icon', 'word', 'wordWhite'].forEach(k => { const im = new Image(); if (LOGO_SRC[k]) im.src = LOGO_SRC[k]; LOGO[k] = im; });
const ready = im => im && im.complete && im.naturalWidth > 0;
function drawLogo(c, im, cx, cy, w) {
  if (!ready(im)) return false;
  const h = w * im.naturalHeight / im.naturalWidth;
  c.drawImage(im, cx - w / 2, cy - h / 2, w, h);
  return true;
}
document.querySelectorAll('img[data-logo]').forEach(im => { if (LOGO_SRC[im.dataset.logo]) im.src = LOGO_SRC[im.dataset.logo]; });

function fitCanvas() {
  const r = $('stage').getBoundingClientRect();
  if (!r.width || !r.height) return;
  const nv = Math.round(clamp(VH * r.width / r.height, 680, 1240));
  if (nv !== VW) { VW = nv; canvas.width = VW; canvas.height = VH; }
}

/* ================================================================ AUDIO */
const Sound = (() => {
  let ac = null, sfx = null, music = null, musicOn = true, timer = null, nextT = 0, step = 0, noiseBuf = null, tune = 0;
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC();
    const master = ac.createGain(); master.gain.value = 0.85; master.connect(ac.destination);
    sfx = ac.createGain(); sfx.connect(master);
    music = ac.createGain(); music.gain.value = 0.5; music.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function play(f, dur, type, vol, slide, t, dest) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfx); o.start(t); o.stop(t + dur + 0.03);
  }
  function tone(f, dur, type = 'square', vol = 0.07, slide = null, delay = 0) { if (ac) play(f, dur, type, vol, slide, ac.currentTime + delay); }
  function noise(dur, vol, freq = 1000, delay = 0, dest) {
    if (!ac) return;
    const t = ac.currentTime + Math.max(0, delay);
    const s = ac.createBufferSource(); s.buffer = noiseBuf; if (dur > 0.45) s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfx); s.start(t); s.stop(t + dur + 0.02);
  }
  const arp = (notes, gap, type = 'square', vol = 0.06, dur = 0.12) => notes.forEach((m, i) => tone(mf(m), dur, type, vol, null, i * gap));

  // Three original loops: India (raga-flavoured, D), UK (brisk major, C), EU (bright march, F).
  const TUNES = [
    { bpm: 140, wave: 'triangle', mel: [74,0,76,77,79,0,77,76, 74,0,72,74,76,0,0,0, 74,76,79,81,79,77,76,74, 72,0,74,0,74,0,0,0], roots: [50,50,48,50] },
    { bpm: 152, wave: 'square', mel: [72,0,76,0,79,77,76,74, 72,0,69,0,71,72,74,0, 76,0,79,0,81,79,77,76, 74,0,71,0,72,0,0,0], roots: [48,45,41,43] },
    { bpm: 160, wave: 'square', mel: [77,0,81,0,84,0,81,77, 79,0,82,0,86,0,82,79, 81,79,77,76,77,0,72,0, 74,76,77,79,77,0,0,0], roots: [41,46,48,41] }
  ];
  function schedule() {
    const tn = TUNES[tune], stepDur = 60 / tn.bpm / 2;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.02;
    while (nextT < ac.currentTime + 0.12) {
      const m = tn.mel[step % tn.mel.length];
      if (m) play(mf(m), stepDur * 0.9, tn.wave, tn.wave === 'triangle' ? 0.06 : 0.028, null, nextT, music);
      if (step % 2 === 0) {
        const bar = Math.floor(step / 8) % tn.roots.length, q = (step / 2) % 4, root = tn.roots[bar];
        play(mf(q % 2 ? root + 7 : root), stepDur * 1.6, 'triangle', 0.1, null, nextT, music);
      }
      if (step % 4 === 2) noise(0.04, 0.05, 6000, nextT - ac.currentTime, music);
      if (step % 8 === 0) noise(0.08, 0.09, 300, nextT - ac.currentTime, music);
      nextT += stepDur; step++;
    }
  }
  return {
    init,
    startMusic(i) { if (i != null) { if (i !== tune) step = 0; tune = i; } if (!ac || !musicOn || timer) return; nextT = ac.currentTime + 0.06; timer = setInterval(schedule, 25); },
    stopMusic() { clearInterval(timer); timer = null; },
    toggle() { musicOn = !musicOn; return musicOn; },
    get on() { return musicOn; },
    jump()   { tone(380, 0.14, 'square', 0.06, 760); },
    djump()  { tone(560, 0.14, 'square', 0.055, 1150); noise(0.08, 0.05, 2500); },
    land()   { noise(0.07, 0.12, 380); },
    coin()   { tone(988, 0.07, 'square', 0.05); tone(1319, 0.22, 'square', 0.05, null, 0.07); },
    box()    { tone(660, 0.08, 'triangle', 0.08); tone(990, 0.16, 'triangle', 0.08, null, 0.07); },
    doc()    { arp([72, 76, 79, 84], 0.05, 'triangle', 0.08, 0.12); noise(0.1, 0.05, 4000); },
    bump()   { tone(160, 0.09, 'square', 0.08, 90); },
    breakB() { noise(0.18, 0.25, 1400); tone(220, 0.12, 'square', 0.05, 80); },
    stomp()  { tone(320, 0.12, 'square', 0.08, 110); },
    hurt()   { tone(520, 0.3, 'sawtooth', 0.06, 140); },
    shield() { tone(900, 0.2, 'sine', 0.09, 300); noise(0.15, 0.08, 3000); },
    sprout() { arp([60, 64, 67, 72], 0.05, 'triangle', 0.08, 0.1); },
    canister(){ arp([62, 66, 69, 74, 78], 0.045, 'square', 0.05, 0.1); tone(300, 0.35, 'sine', 0.06, 900); },
    power()  { arp([60, 64, 67, 72, 76, 79, 84, 88], 0.06, 'square', 0.055, 0.14); tone(600, 0.6, 'sine', 0.07, 2400, 0.1); noise(0.4, 0.06, 7000, 0.15); },
    scan()   { tone(400, 0.5, 'sine', 0.05, 1600); },
    gate()   { arp([67, 72, 76, 79, 84], 0.07, 'square', 0.06, 0.16); noise(0.3, 0.08, 800); },
    deny()   { tone(220, 0.12, 'square', 0.07); tone(180, 0.2, 'square', 0.07, null, 0.12); },
    tick()   { tone(1200, 0.04, 'square', 0.04); },
    life()   { arp([76, 79, 88, 84, 86, 91], 0.08, 'square', 0.05, 0.12); },
    wall()   { noise(0.35, 0.3, 900); tone(140, 0.25, 'sawtooth', 0.06, 60); },
    check()  { arp([67, 72, 76], 0.07, 'triangle', 0.08, 0.15); },
    die()    { arp([71, 70, 69, 68, 60, 55], 0.11, 'square', 0.06, 0.16); },
    over()   { arp([67, 64, 60, 55, 52, 48], 0.16, 'triangle', 0.09, 0.25); },
    plane()  { if (!ac) return; noise(2.6, 0.06, 900); tone(140, 2.6, 'sawtooth', 0.025, 220); },
    ding()   { tone(1568, 0.4, 'sine', 0.08); tone(2093, 0.5, 'sine', 0.06, null, 0.1); },
    fanfare(){ arp([60, 64, 67, 72, 67, 72, 76, 79, 84], 0.1, 'square', 0.06, 0.18); },
    finale() { arp([60, 64, 67, 72, 76, 79, 84, 88, 91, 96], 0.09, 'square', 0.06, 0.25); arp([48, 55, 60, 64], 0.36, 'triangle', 0.12, 0.5); }
  };
})();

/* ============================================================== FLAGS */
const flagCache = {};
function star(c, x, y, r, rot = -Math.PI / 2) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5, rr2 = i % 2 ? r * 0.4 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  c.closePath(); c.fill();
}
function paintFlag(c, key, w, h) {
  if (key === 'IN') {
    c.fillStyle = '#FF9933'; c.fillRect(0, 0, w, h / 3);
    c.fillStyle = '#FFFFFF'; c.fillRect(0, h / 3, w, h / 3);
    c.fillStyle = '#138808'; c.fillRect(0, 2 * h / 3, w, h / 3 + 1);
    const r = h / 3 * 0.75 / 2, cx = w / 2, cy = h / 2;
    c.strokeStyle = '#000080'; c.lineWidth = Math.max(0.8, h / 60);
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
    c.lineWidth = Math.max(0.4, h / 140);
    for (let i = 0; i < 24; i++) { const a = i * TAU / 24; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); c.stroke(); }
    c.fillStyle = '#000080'; c.beginPath(); c.arc(cx, cy, r * 0.2, 0, TAU); c.fill();
  } else if (key === 'GB') {
    // Union Flag drawn on the official 60×30 grid (same geometry as the reference SVG),
    // including the counterchanged red saltire.
    c.save(); c.scale(w / 60, h / 30);
    c.beginPath(); c.rect(0, 0, 60, 30); c.clip();
    c.fillStyle = '#012169'; c.fillRect(0, 0, 60, 30);
    const saltire = () => { c.beginPath(); c.moveTo(0, 0); c.lineTo(60, 30); c.moveTo(60, 0); c.lineTo(0, 30); };
    c.strokeStyle = '#FFFFFF'; c.lineWidth = 6; saltire(); c.stroke();
    c.save();
    c.beginPath();
    c.moveTo(30, 15); c.lineTo(60, 15); c.lineTo(60, 30); c.closePath();
    c.moveTo(30, 15); c.lineTo(30, 30); c.lineTo(0, 30); c.closePath();
    c.moveTo(30, 15); c.lineTo(0, 15); c.lineTo(0, 0); c.closePath();
    c.moveTo(30, 15); c.lineTo(30, 0); c.lineTo(60, 0); c.closePath();
    c.clip();
    c.strokeStyle = '#C8102E'; c.lineWidth = 4; saltire(); c.stroke();
    c.restore();
    c.fillStyle = '#FFFFFF'; c.fillRect(25, 0, 10, 30); c.fillRect(0, 10, 60, 10);
    c.fillStyle = '#C8102E'; c.fillRect(27, 0, 6, 30); c.fillRect(0, 12, 60, 6);
    c.restore();
  } else if (key === 'EU') {
    c.fillStyle = '#003399'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#FFCC00';
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12 - Math.PI / 2; star(c, w / 2 + Math.cos(a) * h / 3, h / 2 + Math.sin(a) * h / 3, h / 18 * 1.15); }
  }
}
function flagImage(key) {
  if (flagCache[key]) return flagCache[key];
  const cv = document.createElement('canvas'); cv.width = 120; cv.height = 80;
  paintFlag(cv.getContext('2d'), key, 120, 80);
  return (flagCache[key] = cv);
}
function drawWavingFlag(c, key, x, y, w, h, t) {
  const img = flagImage(key), slices = 12, sw = w / slices;
  for (let i = 0; i < slices; i++) {
    const off = Math.sin(i * 0.6) * (i / slices) * h * 0.08;
    c.drawImage(img, i * img.width / slices, 0, img.width / slices + 1, img.height, x + i * sw, y + off, sw + 0.6, h);
  }
}
function drawFlagPole(c, key, x, groundY, t, scale = 1) {
  const ph = 110 * scale;
  c.fillStyle = '#5b5b5b'; c.fillRect(x - 2, groundY - ph, 4, ph);
  c.fillStyle = '#d9b44a'; c.beginPath(); c.arc(x, groundY - ph - 3, 4, 0, TAU); c.fill();
  drawWavingFlag(c, key, x + 2, groundY - ph, 48 * scale, 32 * scale, t + x * 0.01);
}
function setFlagCanvas(cv, key) { const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); paintFlag(c, key, cv.width, cv.height); }

/* ============================================================ WORLD MAP */
const K = 1.22; // vertical stretch for a friendlier equirectangular look
const MAP = (window.WORLD_MAP || []).map(f => {
  const p = new Path2D();
  f.r.forEach(ring => {
    let x = 0, y = 0;
    for (let i = 0; i < ring.length; i += 2) {
      x += ring[i]; y += ring[i + 1];
      const X = x / 10, Y = y / 10 * K;
      if (i === 0) p.moveTo(X, Y); else p.lineTo(X, Y);
    }
    p.closePath();
  });
  return { g: f.g, p };
});
const PLACES = {
  MUM: [72.88, 19.08], DEL: [77.2, 28.6], LON: [-0.13, 51.5], BRU: [4.35, 50.85],
  NYC: [-74, 40.7], SAO: [-46.6, -23.5], DXB: [55.3, 25.2], SYD: [151.2, -33.9], TYO: [139.7, 35.7], JNB: [28, -26.2], SIN: [103.8, 1.35]
};
const HL = { IN: '#FF9933', GB: '#D3263A', EU: '#2F5FE0' };
function mapXY(view, W, H, lon, lat) {
  const s = W / view.span;
  return [(lon - view.cx) * s + W / 2, (view.cy - lat) * K * s + H / 2];
}
function routePoint(a, b, t, bulge) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  const cx = mx - dy / L * L * bulge, cy = my + dx / L * L * bulge;
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]];
}
function drawMap(c, W, H, view, o) {
  const s = W / view.span;
  c.save();
  c.fillStyle = '#0d2c4a'; c.fillRect(0, 0, W, H);
  // ocean graticule
  c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 15) { const [x] = mapXY(view, W, H, lon, 0); if (x > -2 && x < W + 2) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } }
  for (let lat = -75; lat <= 75; lat += 15) { const [, y] = mapXY(view, W, H, 0, lat); if (y > -2 && y < H + 2) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } }
  c.translate(W / 2, H / 2); c.scale(s, s); c.translate(-view.cx, view.cy * K);
  const hl = o.hl || {};
  MAP.forEach(f => {
    const a = f.g ? (hl[f.g] || 0) : 0;
    c.fillStyle = a > 0 ? mix('#E9E3D2', HL[f.g], a) : (o.dim ? '#C9C3B4' : '#E9E3D2');
    c.fill(f.p);
  });
  c.lineWidth = 0.9 / s; c.strokeStyle = 'rgba(40,40,40,0.35)';
  MAP.forEach(f => c.stroke(f.p));
  // gold outline for highlighted EU
  if ((hl.EU || 0) > 0.3) { c.lineWidth = 1.6 / s; c.strokeStyle = `rgba(255,204,0,${hl.EU * 0.9})`; MAP.forEach(f => { if (f.g === 'EU') c.stroke(f.p); }); }
  c.restore();

  // routes
  (o.routes || []).forEach(r => {
    if (r.prog <= 0) return;
    const pts = [];
    const n = 48, end = Math.min(1, r.prog);
    for (let i = 0; i <= n; i++) { const t = end * i / n; const [lo, la] = routePoint(PLACES[r.a], PLACES[r.b], t, r.bulge || 0.25); pts.push(mapXY(view, W, H, lo, la)); }
    c.save(); c.lineCap = 'round';
    c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 6; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
    c.strokeStyle = r.color || C.green; c.lineWidth = 3; c.setLineDash([9, 7]); c.lineDashOffset = -(o.t || 0) * 30;
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
    c.restore();
  });
  // city pins
  (o.pins || []).forEach(pin => {
    const [x, y] = mapXY(view, W, H, PLACES[pin.at][0], PLACES[pin.at][1]);
    const pulse = ((o.t || 0) * 1.4 + (pin.ph || 0)) % 1;
    c.strokeStyle = `rgba(195,255,102,${1 - pulse})`; c.lineWidth = 3;
    c.beginPath(); c.arc(x, y, 6 + pulse * 26, 0, TAU); c.stroke();
    c.fillStyle = '#000'; c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill();
    c.fillStyle = C.green; c.beginPath(); c.arc(x, y, 4.5, 0, TAU); c.fill();
    if (pin.label) {
      c.font = '800 13px Poppins, sans-serif'; c.textAlign = 'center';
      const tw = c.measureText(pin.label).width + 16;
      const ly = y + (pin.below ? 26 : -24);
      c.fillStyle = '#000'; rrc(c, x - tw / 2, ly - 12, tw, 22, 11); c.fill();
      c.fillStyle = '#fff'; c.fillText(pin.label, x, ly + 4);
      if (pin.flag) { const fl = flagImage(pin.flag); c.drawImage(fl, x - tw / 2 - 30, ly - 11, 27, 18); }
    }
  });
  // plane
  if (o.plane) {
    const { r, t } = o.plane;
    const [lo, la] = routePoint(PLACES[r.a], PLACES[r.b], t, r.bulge || 0.25);
    const [lo2, la2] = routePoint(PLACES[r.a], PLACES[r.b], Math.min(1, t + 0.01), r.bulge || 0.25);
    const [x, y] = mapXY(view, W, H, lo, la), [x2, y2] = mapXY(view, W, H, lo2, la2);
    drawPlane(c, x, y, Math.atan2(y2 - y, x2 - x), o.planeScale || 1);
  }
  // travelling packages
  (o.packages || []).forEach(pk => {
    const [lo, la] = routePoint(PLACES[pk.a], PLACES[pk.b], pk.t, pk.bulge || 0.25);
    const [x, y] = mapXY(view, W, H, lo, la);
    drawPackage(c, x, y, 0.8);
  });
}
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp(pa >> 16, pb >> 16, t)), g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t)), bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}
function drawPlane(c, x, y, ang, s = 1) {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(4, 10, 16, 5, 0, 0, TAU); c.fill();
  c.fillStyle = '#ffffff'; c.strokeStyle = '#000'; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(-16, -3); c.lineTo(12, -3); c.quadraticCurveTo(20, 0, 12, 3); c.lineTo(-16, 3); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = C.green;
  c.beginPath(); c.moveTo(-2, -3); c.lineTo(-10, -16); c.lineTo(-5, -16); c.lineTo(6, -3); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-2, 3); c.lineTo(-10, 16); c.lineTo(-5, 16); c.lineTo(6, 3); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-16, -3); c.lineTo(-20, -9); c.lineTo(-16, -9); c.lineTo(-11, -3); c.fill(); c.stroke();
  c.restore();
}
function drawPackage(c, x, y, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = '#000'; c.fillRect(-11, -9, 22, 18);
  c.fillStyle = '#C98B52'; c.fillRect(-9.5, -7.5, 19, 15);
  c.fillStyle = '#E8B57E'; c.fillRect(-9.5, -7.5, 19, 4);
  c.fillStyle = C.green; c.fillRect(-2, -7.5, 4, 15);
  c.restore();
}

/* ================================================================= DOCS */
const DOCS = {
  // India
  spec:    { t: 'Product specification', d: 'Know exactly what you sell: materials, intended users and how it is used. Every market’s rules start here.' },
  plan:    { t: 'Export plan', d: 'Each target market has its own product-safety rules. Check them before you ship.' },
  test:    { t: 'Test report', d: 'Lab test reports show your product was checked against the right standards.' },
  // UK
  ukTech:  { t: 'Technical documentation', d: 'Design files, test reports and your risk assessment, ready to show UK authorities if they ask.' },
  ukRisk:  { t: 'Risk assessment', d: 'Shows you identified your product’s hazards and how you reduced them.' },
  ukLabel: { t: 'Product label', d: 'A product identifier, the manufacturer’s name and address, the importer’s where relevant, and warnings in English.' },
  ukDoc:   { t: 'UK Declaration of Conformity', d: 'For UKCA-marked products, it lists the UK laws and standards the product meets.' },
  ukca:    { t: 'UKCA marking', d: 'Some products sold in Great Britain can carry UKCA marking, and for many CE marking is still accepted. Check the rules for your product.' },
  ukRp:    { t: 'UK Responsible Person', d: 'Some products, like cosmetics, need a UK Responsible Person. Others need a UK importer or authorised representative named.' },
  // EU
  techFile:{ t: 'Technical file', d: 'The evidence behind your declaration: drawings, test reports and risk assessment. Often kept for 10 years.' },
  euRisk:  { t: 'Risk assessment', d: 'Required under EU product laws and the GPSR. Update it when your product changes.' },
  laws:    { t: 'Applicable laws & standards', d: 'Find which EU laws apply to your product. Harmonised standards help you show conformity.' },
  euDoc:   { t: 'EU Declaration of Conformity', d: 'The manufacturer’s signed statement that the product meets every EU law that applies to it.' },
  ce:      { t: 'CE marking', d: 'Only for products covered by CE legislation, like toys, electronics or machinery. It goes on once conformity is shown.' },
  euAr:    { t: 'EU responsible operator', d: 'Many products need an economic operator in the EU, such as an authorised representative, named on the product or packaging.' },
  euLabel: { t: 'Labels & instructions', d: 'Safety information and instructions in the language of each EU country where you sell.' },
  // hidden bonus (Technical File Scanner)
  hs1:     { t: 'Supplier declarations', d: 'Material declarations from suppliers help you check substance rules such as REACH.', bonus: true },
  hs2:     { t: 'Traceability records', d: 'Batch numbers and records help you find affected products fast if there’s a recall.', bonus: true },
  hs3:     { t: 'Instructions for use', d: 'Clear instructions and warnings are part of making a product safe to use.', bonus: true }
};

/* =============================================================== LEVELS */
const LEVELS = [
  { key: 'IN', name: 'India', title: 'INDIA: THE BUSINESS BEGINS', theme: 'india', cols: 150, time: 300, speed: 0.7, tune: 0,
    welcome: 'INDIA: THE BUSINESS BEGINS', welcomeSub: 'Your business journey begins in India!', build: buildIndia },
  { key: 'GB', name: 'United Kingdom', title: 'UK: THE COMPLIANCE CHALLENGE', theme: 'uk', cols: 190, time: 260, speed: 1.0, tune: 1,
    welcome: 'WELCOME TO THE UNITED KINGDOM!', welcomeSub: 'The compliance challenge', build: buildUK },
  { key: 'EU', name: 'European Union', title: 'EU: THE GLOBAL COMPLIANCE MISSION', theme: 'eu', cols: 220, time: 240, speed: 1.35, tune: 2,
    welcome: 'WELCOME TO THE EUROPEAN MARKET!', welcomeSub: 'The global compliance mission', build: buildEU }
];

let COLS = 150;
let grid, contents, pipes, signs, flags, gates, platforms, switches, stories, guides, itemSpawns, enemySpawns, finish, respawns;

function newWorld(cols) {
  COLS = cols;
  grid = Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
  contents = {}; pipes = []; signs = []; flags = []; gates = []; platforms = []; switches = []; stories = []; guides = [];
  itemSpawns = []; enemySpawns = []; finish = null; respawns = [];
}
const B = {
  set(x, y, c) { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) grid[y][x] = c; },
  ground(a, b) { for (let x = a; x <= b; x++) { B.set(x, 11, 'G'); B.set(x, 12, 'G'); } },
  row(a, b, y, c) { for (let x = a; x <= b; x++) B.set(x, y, c); },
  col(x, y0, y1, c) { for (let y = y0; y <= y1; y++) B.set(x, y, c); },
  pipe(x, h) { for (let y = 11 - h; y < 11; y++) { B.set(x, y, 'P'); B.set(x + 1, y, 'P'); } pipes.push({ x, h }); },
  box(x, y, what) { B.set(x, y, 'Q'); contents[x + ',' + y] = what; },
  hidden(x, y, what) { B.set(x, y, 'H'); contents[x + ',' + y] = what; },
  stairsUp(x0, n) { for (let i = 0; i < n; i++) B.col(x0 + i, 10 - i, 10, 'S'); },
  stairsDown(x0, n) { for (let i = 0; i < n; i++) B.col(x0 + i, 10 - (n - 1 - i), 10, 'S'); },
  item(type, tx, ty, extra) { itemSpawns.push(Object.assign({ type, tx, ty }, extra || {})); },
  doc(id, tx, ty, hidden) { itemSpawns.push({ type: 'doc', tx, ty, doc: id, hidden: !!hidden }); },
  enemy(type, tx, ty = null, range = 0) { enemySpawns.push({ type, tx, ty, range }); },
  plat(tx, ty, w, dx, dy, period) { platforms.push({ x0: tx * T, y0: ty * T, w: w * T, h: 16, dx: dx * T, dy: dy * T, period, x: tx * T, y: ty * T, px: tx * T, py: ty * T, ph: Math.random() }); },
  gate(col, needs, label) { B.col(col, 2, 10, 'C'); gates.push({ col, needs, label, open: false, kind: 'check', anim: 0 }); },
  timedGate(col, switchCol, secs, label) {
    B.col(col, 2, 10, 'D');
    const g = { col, label, kind: 'timed', open: false, passed: false, secs, left: 0, anim: 0 };
    gates.push(g); switches.push({ col: switchCol, gate: g, pressed: 0 });
  },
  barrier(col, y0 = 3) { B.col(col, y0, 10, 'X'); },
  spikes(...xs) { xs.forEach(x => B.set(x, 10, 'K')); },
  story(tx, text) { stories.push({ x: tx * T, text, shown: false }); },
  guide(tx, ty, gives, lines) { guides.push({ x: tx * T, y: ty * T, gives, lines, given: false, t: 0, line: 0, lineT: 0 }); },
  flag(tx) { flags.push(tx * T); },
  sign(tx, text) { signs.push({ x: tx * T, text }); },
  respawn(tx) { respawns.push(tx * T); },
  finish(tx, kind, label) { finish = { x: tx * T, kind, label }; }
};

function buildIndia() {
  newWorld(LEVELS[0].cols);
  B.ground(0, 40);
  B.story(1, 'Your business journey begins in India!');
  B.sign(2.2, 'START →'); B.flag(5);
  [6, 7, 8].forEach(x => B.item('seal', x, 9));
  B.box(10, 7, 'seal');
  B.doc('spec', 12, 9);
  B.row(14, 16, 7, 'B'); B.box(15, 7, 'canister');
  B.item('box', 18, 10); B.enemy('blob', 20);
  B.pipe(24, 2); B.item('canister', 27, 10); B.enemy('blob', 30);
  B.item('box', 33, 10); B.doc('plan', 36, 9);
  B.flag(38);
  [41, 42].forEach(x => B.item('seal', x, 7));
  B.ground(43, 80);
  B.row(46, 49, 8, 'S'); [46, 47, 48, 49].forEach(x => B.item('seal', x, 7));
  B.item('box', 52, 10); B.item('canister', 54, 10);
  B.hidden(56, 7, 'life');
  B.doc('test', 59, 9); B.respawn(60);
  B.story(60, 'Your product is ready. Are you ready for global markets?');
  B.sign(64.2, 'EXPORT CHECK');
  B.gate(68, ['spec', 'plan'], 'EXPORT READINESS CHECK');
  B.flag(70); B.enemy('blob', 74); B.item('box', 77, 10);
  B.plat(81, 9, 2, 1.2, 0, 4.5);
  B.ground(85, 130);
  B.pipe(90, 3); B.enemy('blob', 95);
  B.row(98, 102, 7, 'B'); B.box(100, 7, 'canister'); B.box(98, 7, 'seal');
  B.item('box', 104, 10); B.enemy('blob', 106); B.flag(108);
  [110, 111, 112].forEach(x => B.item('seal', x, 9));
  B.stairsUp(114, 4); B.ground(131, 149);
  [118, 119, 120].forEach(x => B.item('seal', x, 6));
  B.respawn(121); B.story(121, 'Your next destination: United Kingdom!');
  B.item('box', 124, 10); B.enemy('blob', 127); B.flag(132);
  B.guide(136, 8.4, 'none', ['Great start! I’m your Euverify guide.', 'The UK has its own rules. See you there!']);
  B.finish(142, 'gateway', 'INTERNATIONAL EXPORT GATEWAY');
}

function buildUK() {
  newWorld(LEVELS[1].cols);
  B.ground(0, 24);
  B.story(1, 'Expanding into the UK requires the right compliance documentation.');
  B.flag(3);
  B.guide(11.5, 9.3, 'costume', ['Hi! I’m your Euverify guide.', 'Take my power-up: Compliance Shield and Documentation Power!', 'Collect the documents each checkpoint asks for.']);
  B.doc('ukTech', 15, 9);
  B.enemy('paper', 18, 7, 3);
  B.row(19, 21, 7, 'B'); B.doc('ukRisk', 22, 8);
  B.ground(28, 60);
  B.item('seal', 25, 8); B.item('seal', 26, 7); B.item('seal', 27, 8);
  B.doc('ukLabel', 32, 9); B.enemy('blob', 36); B.item('canister', 39, 10);
  B.enemy('bot', 44); B.flag(46);
  B.sign(45.5, 'MISSING DOCS!');
  B.barrier(48);
  B.story(50, 'Missing documents? Don’t let them stop your business!');
  B.respawn(52);
  B.gate(56, ['ukTech', 'ukRisk', 'ukLabel'], 'UK PRODUCT SAFETY CHECKPOINT');
  B.plat(61, 9, 2, 2, 0, 4);
  B.ground(65, 110);
  B.pipe(70, 3); B.item('canister', 68, 10); B.enemy('paper', 74, 6, 3);
  B.row(76, 80, 7, 'B'); B.box(77, 7, 'badge'); B.box(79, 7, 'canister');
  B.enemy('bot', 82); B.item('canister', 86, 10); B.enemy('paper', 84, 8, 2);
  B.doc('ukDoc', 90, 8); B.flag(92);
  B.row(95, 97, 8, 'S'); B.doc('ukca', 96, 7);
  B.story(100, 'Euverify helps businesses navigate UK compliance requirements.');
  B.doc('ukRp', 104, 9); B.respawn(102);
  B.gate(108, ['ukDoc', 'ukca', 'ukRp'], 'UKCA & UK RESPONSIBLE PERSON CHECKPOINT');
  B.plat(111, 9, 2, 3, 0, 4.5);
  B.ground(116, 150);
  B.spikes(120, 121); B.enemy('paper', 125, 7, 3); B.enemy('blob', 128);
  B.hidden(130, 7, 'life'); B.enemy('paper', 133, 8, 2);
  B.row(136, 140, 7, 'B'); B.box(138, 7, 'seal'); B.box(140, 7, 'canister');
  B.enemy('blob', 141); B.flag(143); B.respawn(144);
  B.story(145, 'Get the right documentation and move forward!');
  B.plat(151, 8, 2, 0, 2, 3.5); B.plat(153, 9, 1.5, 0, -2, 3.5);
  B.ground(155, 189);
  B.enemy('bot', 160); B.enemy('paper', 165, 7, 3);
  [162, 163, 164].forEach(x => B.item('seal', x, 9));
  B.stairsUp(170, 4); [170, 171, 172, 173].forEach((x, i) => B.item('seal', x, 9 - i));
  B.flag(177);
  B.finish(182, 'border', 'EU BORDER GATEWAY');
}

function buildEU() {
  newWorld(LEVELS[2].cols);
  B.ground(0, 20);
  B.story(1, 'Entering the European market requires preparation.');
  B.flag(3);
  B.guide(10.5, 9.3, 'scanner', ['Welcome to the EU!', 'Here’s my Technical File Scanner: it finds hidden documents.', 'Knowledge Boost on: documents now score double!']);
  B.doc('techFile', 13, 9); B.enemy('paper', 15, 7, 3);
  B.doc('euRisk', 18, 8);
  B.plat(21, 9, 1.5, 2, 0, 3.4);
  B.ground(25, 34);
  B.row(27, 28, 8, 'S'); B.doc('laws', 28, 7);
  B.enemy('bot', 32); B.enemy('paper', 30, 6, 2);
  B.story(30, 'Understand the regulations applicable to your product.');
  B.plat(35, 9, 1.5, 3, 0, 3.6);
  B.ground(40, 52);
  B.doc('hs1', 45, 5, true); B.row(44, 46, 6, 'S');
  B.respawn(47);
  B.gate(50, ['techFile', 'euRisk', 'laws'], 'TECHNICAL FILE CHECKPOINT');
  B.plat(53, 9, 1.5, 4, 0, 3.8);
  B.ground(59, 80);
  B.item('canister', 61, 10);
  B.row(64, 68, 7, 'B'); B.box(66, 7, 'badge'); B.box(64, 7, 'seal');
  B.enemy('blob', 68); B.item('canister', 70, 10); B.enemy('bot', 72); B.enemy('paper', 74, 7, 3);
  B.doc('euDoc', 74, 8); B.enemy('bot', 77); B.doc('ce', 79, 9); B.flag(76);
  B.respawn(81);
  B.sign(81.2, 'TIMED CHECK!');
  B.timedGate(96, 83, 10, 'TIMED COMPLIANCE CHECK');
  B.ground(81, 84);
  B.plat(85, 9, 1.5, 2.5, 0, 2.8);
  B.col(89, 9, 10, 'S'); B.set(89, 11, 'G'); B.set(89, 12, 'G');
  B.plat(90, 8, 1.5, 0, 2, 2.6);
  B.ground(92, 100);
  B.doc('euAr', 99, 9);
  B.story(101, 'Keep your technical documentation organised.');
  B.ground(101, 118);
  B.doc('hs2', 108, 4, true); B.row(107, 109, 5, 'S'); B.row(104, 105, 8, 'S');
  B.enemy('paper', 110, 7, 3); B.enemy('bot', 112); B.respawn(113);
  B.gate(116, ['euDoc', 'ce', 'euAr'], 'MARKET ACCESS CHECKPOINT');
  B.plat(119, 9, 1.5, 2, 0, 3); B.plat(122, 8, 1.5, 0, 2, 3);
  B.ground(125, 160);
  B.enemy('paper', 130, 7, 3); B.enemy('bot', 135); B.enemy('paper', 138, 8, 2);
  B.spikes(140, 141); B.enemy('blob', 143); B.flag(145); B.respawn(146);
  B.row(147, 151, 7, 'B'); B.box(149, 7, 'canister'); B.box(151, 7, 'seal');
  B.enemy('paper', 150, 6, 3);
  B.story(152, 'Euverify helps businesses manage their EU and UK compliance documentation journey.');
  B.sign(153.5, 'MISSING DOCS!');
  B.barrier(156); B.doc('euLabel', 158, 9);
  B.plat(161, 9, 1.5, 3, 0, 3.2);
  B.ground(166, 219);
  B.respawn(168);
  B.gate(172, ['euLabel'], 'LABELLING CHECKPOINT');
  B.enemy('bot', 178); B.doc('hs3', 180, 6, true); B.row(179, 181, 7, 'S');
  B.enemy('paper', 183, 7, 3); B.enemy('bot', 188); B.flag(184);
  B.stairsUp(190, 4); [190, 191, 192, 193].forEach((x, i) => B.item('seal', x, 9 - i));
  B.flag(198);
  B.finish(206, 'portal', 'GLOBAL MARKET SUCCESS');
}

const SOLID = new Set(['G', 'B', 'Q', 'U', 'P', 'S', 'X', 'C', 'D']);
function tile(cx, cy) { if (cx < 0 || cx >= COLS) return 'W'; if (cy < 0 || cy >= ROWS) return '.'; return grid[cy][cx]; }
const isSolid = t => t === 'W' || SOLID.has(t);

/* ================================================================ INPUT */
const keys = { left: false, right: false, jump: false, sprint: false };
let jumpPressed = false, jumpReleased = false;
function setKey(k, down) {
  if (k === 'jump') { if (down && !keys.jump) jumpPressed = true; if (!down && keys.jump) jumpReleased = true; }
  keys[k] = down;
}
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint' };
window.addEventListener('keydown', e => {
  if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (state !== 'play' && e.target && e.target.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { if (!e.repeat) togglePause(); e.preventDefault(); return; }
  if (e.code === 'KeyM') { if (!e.repeat) toggleMusic(); return; }
  if ((state === 'cine') && (e.code === 'Space' || e.code === 'Enter') && !e.repeat) { skipCine(); e.preventDefault(); return; }
  const k = KEYMAP[e.code];
  if (k) { e.preventDefault(); if (!e.repeat || k !== 'jump') setKey(k, true); }
});
window.addEventListener('keyup', e => { if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return; const k = KEYMAP[e.code]; if (k) { if (!(state !== 'play' && e.target && e.target.tagName === 'BUTTON')) e.preventDefault(); setKey(k, false); } });
window.addEventListener('blur', () => { Object.keys(keys).forEach(k => setKey(k, false)); if (state === 'play') togglePause(); });
document.querySelectorAll('.tbtn').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); b.classList.add('active'); setKey(k, true); };
  const off = e => { e.preventDefault(); b.classList.remove('active'); setKey(k, false); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off);
  b.addEventListener('lostpointercapture', off); b.addEventListener('contextmenu', e => e.preventDefault());
});

/* ============================================================= STATE */
let state = 'menu', levelIdx = 0, L = LEVELS[0];
let player, items, enemies, particles, popups, bumps, camX = 0, levelTime, score, lives, respawnX, transformT = 0, deadT = 0,
    shake = 0, frameT = 0, clouds, power, docsGot, levelStart = null, hintT = 0, doneT = 0, scanT = 0;

function freshPower() { return { costume: false, shield: false, shieldReady: true, shieldT: 0, docPower: false, scanner: false, boost: false }; }
function newPlayer(x) {
  return { x, y: 11 * T - 36, w: 26, h: 36, vx: 0, vy: 0, onGround: false, jumps: 0, coyote: 0, buffer: 0, facing: 1, phase: 0,
    inv: 0, hearts: 3, strength: 1, cans: 0, glow: 0, landT: 0, plat: null };
}
function makeItem(type, x, y, fromBox = false) {
  const sizes = { seal: [24, 24], canister: [26, 32], badge: [32, 32], life: [28, 26], box: [28, 26], doc: [28, 34] };
  const [w, h] = sizes[type];
  return { type, x, y, w, h, t: Math.random() * 6, rise: fromBox ? 1 : 0, baseY: y, alive: true };
}
function makeEnemy(s) {
  const dims = { blob: [32, 28], bot: [32, 34], cloud: [46, 30], paper: [30, 24] };
  const [w, h] = dims[s.type];
  const x = s.tx * T + (T - w) / 2, y = s.ty != null ? s.ty * T : 11 * T - h;
  const sp = L.speed;
  const base = { blob: -62, bot: -52, cloud: -60, paper: -110 }[s.type] * sp;
  return { type: s.type, x, y, w, h, vx: base, vy: 0, baseY: y, minX: x - s.range * T, maxX: x + s.range * T, t: Math.random() * 6,
    alive: true, dead: 0, active: false, onGround: false };
}

function loadLevel(i, keepProgress) {
  levelIdx = i; L = LEVELS[i];
  L.build();
  items = itemSpawns.map(s => {
    const sz = { seal: 24, canister: 26, box: 28, doc: 28 }[s.type] || 26;
    const it = makeItem(s.type, s.tx * T + (T - sz) / 2, s.ty * T + (s.type === 'seal' ? 8 : 4));
    if (s.type === 'doc') { it.doc = s.doc; it.hidden = s.hidden; }
    return it;
  });
  enemies = enemySpawns.map(makeEnemy);
  particles = []; popups = []; bumps = {};
  clouds = Array.from({ length: 14 }, (_, k) => ({ x: k * 520 + Math.random() * 200, y: 30 + Math.random() * 130, s: 0.7 + Math.random() * 0.6 }));
  docsGot = new Set();
  respawnX = 9 * T;
  const carried = player ? { strength: player.strength, cans: player.cans } : { strength: 1, cans: 0 };
  player = newPlayer(respawnX); Object.assign(player, carried);
  camX = 0; levelTime = L.time; transformT = 0; deadT = 0; shake = 0; hintT = 0;
  if (!keepProgress) levelStart = { score, lives, strength: player.strength, cans: player.cans, power: JSON.parse(JSON.stringify(power)) };
  last = {};
}

/* ============================================================ HELPERS */
function burst(x, y, n, colors, speed = 260, grav = 600, size = 4, life = 0.7) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = speed * (0.3 + Math.random() * 0.7);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, life: life * (0.6 + Math.random() * 0.6), max: life, color: colors[i % colors.length], size: size * (0.6 + Math.random() * 0.8), grav });
  }
}
function popup(x, y, text, color = '#000', big = false) { popups.push({ x, y, text, color, t: 0, big }); }
function addScore(n, x, y) { score += n; if (x != null) popup(x, y, '+' + n); }

let toastTimer = 0;
function toast(msg, ms = 2400) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, ms); }
let storyTimer = 0;
function showStory(text, ms = 3600) {
  const el = $('story'); el.textContent = text; el.hidden = true; void el.offsetWidth; el.hidden = false;
  clearTimeout(storyTimer); storyTimer = setTimeout(() => el.hidden = true, ms);
}
let infoQueue = [], infoBusy = false, infoTimer = 0;
function showInfo(kicker, title, text) { infoQueue.push({ kicker, title, text }); if (!infoBusy) nextInfo(); }
function nextInfo() {
  const el = $('infoCard');
  const n = infoQueue.shift();
  if (!n) { infoBusy = false; el.hidden = true; return; }
  infoBusy = true;
  $('infoKicker').textContent = n.kicker; $('infoTitle').textContent = n.title; $('infoText').textContent = n.text;
  el.hidden = true; void el.offsetWidth; el.hidden = false;
  clearTimeout(infoTimer); infoTimer = setTimeout(nextInfo, 5200);
}
function clearInfo() { infoQueue = []; clearTimeout(infoTimer); infoBusy = false; $('infoCard').hidden = true; $('story').hidden = true; $('timerPill').hidden = true; }

const ABILITY = { 2: 'STRENGTH 2 · Brick breaker unlocked', 3: 'STRENGTH 3 · Power stomp: beat spiky bots', 4: 'STRENGTH 4 · Barrier breaker unlocked', 5: 'STRENGTH 5 · Compliance aura activated!' };
function gainStrength(n) {
  const before = player.strength;
  player.strength = Math.min(MAX_STR, player.strength + n); player.glow = 1;
  for (let s = before + 1; s <= player.strength; s++) setTimeout(() => { if (state === 'play' || state === 'transform') toast(ABILITY[s]); }, (s - before - 1) * 1000);
  return player.strength - before;
}
function levelDocs() { return items ? items.filter(i => i.type === 'doc' && !DOCS[i.doc].bonus).length + [...docsGot].filter(d => !DOCS[d].bonus).length : 0; }

/* ============================================================= BLOCKS */
function hitBlockFromBelow(cx, cy) {
  const t = tile(cx, cy), key = cx + ',' + cy, px = cx * T + T / 2, py = cy * T;
  enemies.forEach(e => { if (e.alive && e.type !== 'cloud' && e.type !== 'paper' && e.x + e.w > cx * T && e.x < cx * T + T && Math.abs(e.y + e.h - py) < 4) killEnemy(e, true); });
  if (t === 'Q' || t === 'H') {
    grid[cy][cx] = 'U'; bumps[key] = 0.18;
    release(contents[key] || 'seal', cx, cy);
    if (t === 'H') { popup(px, py - 10, 'SECRET!', C.purple, true); burst(px, py, 16, [C.green, C.yellow, '#fff'], 220, 300); }
  } else if (t === 'B') {
    if (player.strength >= 2) { grid[cy][cx] = '.'; Sound.breakB(); shake = 0.15; burst(px, py + T / 2, 14, [themeBrick(), '#000', '#f0a07a'], 320, 1400, 6, 1); addScore(50, px, py); }
    else { bumps[key] = 0.18; Sound.bump(); }
  } else Sound.bump();
}
function release(what, cx, cy) {
  const x = cx * T, y = cy * T;
  if (what === 'seal') {
    Sound.coin(); addScore(100, x + T / 2, y - 20);
    particles.push({ x: x + T / 2, y: y - 10, vx: 0, vy: -420, life: 0.45, max: 0.45, color: 'seal', size: 12, grav: 1400 });
  } else {
    const sz = { canister: 26, badge: 32, life: 28 }[what];
    const it = makeItem(what, x + (T - sz) / 2, y, true);
    it.baseY = y - it.h - 4; it.y = y; it.mover = true; it.vx = 75; it.vy = 0;
    items.push(it); Sound.sprout();
  }
}

/* =============================================================== UPDATE */
function update(dt) {
  frameT += dt;
  if (shake > 0) shake -= dt;
  updateParticles(dt);
  popups.forEach(p => p.t += dt); popups = popups.filter(p => p.t < 1);
  if (state === 'transform') {
    transformT -= dt;
    if (Math.random() < 0.8) burst(player.x + player.w / 2, player.y + player.h / 2, 3, [C.green, C.yellow, '#fff', C.purple], 280, 0, 4, 0.6);
    if (transformT <= 0) { state = 'play'; $('banner').hidden = true; }
    return;
  }
  if (state === 'dead') { deadT -= dt; player.vy += GRAV * dt * 0.8; player.y += player.vy * dt; if (deadT <= 0) afterDeath(); return; }
  if (state === 'levelDone') { doneT -= dt; updatePlatforms(dt); if (doneT <= 0) afterLevel(); return; }
  if (state !== 'play') return;

  levelTime -= dt;
  if (levelTime <= 0) { levelTime = 0; die(); return; }
  if (hintT > 0) hintT -= dt;

  updatePlatforms(dt);
  updatePlayer(dt);
  updatePower(dt);
  updateItems(dt);
  updateEnemies(dt);
  updateGuides(dt);
  updateGates(dt);
  updateCamera(dt);
  for (const k in bumps) { bumps[k] -= dt; if (bumps[k] <= 0) delete bumps[k]; }

  stories.forEach(s => { if (!s.shown && player.x > s.x) { s.shown = true; showStory(s.text); } });
  respawns.forEach(r => { if (player.x > r && respawnX < r) respawnX = r; });
  if (finish && player.x + player.w / 2 > finish.x + T * 0.5 && player.onGround) levelComplete();
  updateHUD();
}

function updatePlatforms(dt) {
  platforms.forEach(p => {
    p.px = p.x; p.py = p.y;
    const k = 0.5 - 0.5 * Math.cos((frameT / p.period + p.ph) * TAU);
    p.x = p.x0 + p.dx * k; p.y = p.y0 + p.dy * k;
  });
}

function updatePlayer(dt) {
  const p = player;
  // ride moving platform
  if (p.plat) {
    const pl = p.plat;
    if (p.x + p.w > pl.x && p.x < pl.x + pl.w && Math.abs(p.y + p.h - pl.py) < 6) { p.x += pl.x - pl.px; p.y = pl.y - p.h; p.onGround = true; }
    else p.plat = null;
  }
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const top = keys.sprint ? RUN : WALK, acc = p.onGround ? ACC_G : ACC_A;
  if (dir) {
    p.vx += dir * acc * dt;
    if (Math.abs(p.vx) > top) p.vx = Math.sign(p.vx) * Math.max(top, Math.abs(p.vx) - FRICTION * dt);
    p.facing = dir;
  } else if (p.onGround) { const f = FRICTION * dt; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f; }
  else p.vx *= 1 - 1.5 * dt;

  if (jumpPressed) p.buffer = 0.12;
  jumpPressed = false;
  if (p.buffer > 0) {
    if (p.onGround || p.coyote > 0) { p.vy = -JUMP_V - Math.abs(p.vx) * 0.12; p.jumps = 1; p.onGround = false; p.coyote = 0; p.buffer = 0; p.plat = null; Sound.jump(); }
    else if (p.jumps < 2) { p.vy = -DJUMP_V; p.jumps = 2; p.buffer = 0; Sound.djump(); burst(p.x + p.w / 2, p.y + p.h, 10, ['#fff', C.green], 160, 200, 4, 0.4); }
  }
  p.buffer -= dt;
  if (jumpReleased) { if (p.vy < -280) p.vy *= 0.5; jumpReleased = false; }

  if (!p.plat) p.vy = Math.min(MAX_FALL, p.vy + GRAV * dt);
  const wasGround = p.onGround, fallV = p.vy, prevBottom = p.y + p.h;
  p.x += p.vx * dt; if (p.x < 0) { p.x = 0; p.vx = 0; }
  resolveX(p, true);
  if (!p.plat) { p.y += p.vy * dt; p.onGround = false; resolveY(p, true); }
  // land on moving platforms (one-way, from above)
  if (!p.onGround && p.vy >= 0) {
    for (const pl of platforms) {
      if (p.x + p.w > pl.x + 2 && p.x < pl.x + pl.w - 2 && prevBottom <= pl.py + 6 && p.y + p.h >= pl.y) {
        p.y = pl.y - p.h; p.vy = 0; p.onGround = true; p.plat = pl; break;
      }
    }
  }
  if (p.onGround) { p.jumps = 0; p.coyote = 0.09; if (!wasGround && fallV > 380) { Sound.land(); p.landT = 0.12; burst(p.x + p.w / 2, p.y + p.h, 6, ['#fff', '#e8e2c8'], 120, 300, 3, 0.35); } }
  else p.coyote -= dt;
  p.phase += Math.abs(p.vx) * dt * 0.09;
  if (p.inv > 0) p.inv -= dt;
  if (p.glow > 0) p.glow -= dt * 0.8;
  if (p.landT > 0) p.landT -= dt;
  if (p.strength >= 3 && Math.abs(p.vx) > 120 && Math.random() < 0.35)
    particles.push({ x: p.x + p.w / 2 - p.facing * 10, y: p.y + 6 + Math.random() * p.h, vx: -p.facing * 30, vy: -20, life: 0.4, max: 0.4, color: power.costume ? C.green : '#b48cff', size: 3, grav: 0 });

  const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - 1) / T), y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + p.h - 1) / T);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (tile(cx, cy) === 'K' && p.y + p.h > cy * T + T * 0.45) hurt(true);
  switches.forEach(sw => {
    if (sw.pressed > 0) { sw.pressed -= dt; return; }
    if (!sw.gate.passed && p.x + p.w > sw.col * T + 4 && p.x < sw.col * T + T - 4 && p.y + p.h >= 11 * T - 2) pressSwitch(sw);
  });
  if (p.y > VH + 60) die();
}

function resolveX(o, isPlayer) {
  const y0 = Math.floor(o.y / T), y1 = Math.floor((o.y + o.h - 1) / T);
  const dir = o.vx > 0 ? 1 : o.vx < 0 ? -1 : 0;
  if (!dir) return;
  const cx = dir > 0 ? Math.floor((o.x + o.w) / T) : Math.floor(o.x / T);
  for (let cy = y0; cy <= y1; cy++) {
    const t = tile(cx, cy);
    if (isSolid(t)) {
      if (isPlayer) {
        if (t === 'X' && tryBreakBarrier(cx)) return;
        if (t === 'C') touchGate(cx);
        if (t === 'D' && hintT <= 0) { hintT = 2.5; toast('Timed gate closed. Step on the switch to open it!'); }
      }
      o.x = dir > 0 ? cx * T - o.w - 0.01 : (cx + 1) * T + 0.01;
      o.vx = isPlayer ? 0 : -o.vx; o.hitWall = true; return;
    }
  }
}
function resolveY(o, isPlayer) {
  const x0 = Math.floor((o.x + 1) / T), x1 = Math.floor((o.x + o.w - 2) / T);
  if (o.vy > 0) {
    const cy = Math.floor((o.y + o.h) / T);
    for (let cx = x0; cx <= x1; cx++) if (isSolid(tile(cx, cy))) { o.y = cy * T - o.h; o.vy = 0; o.onGround = true; return; }
  } else if (o.vy < 0) {
    const cy = Math.floor(o.y / T);
    let hit = null, best = 1e9;
    for (let cx = x0; cx <= x1; cx++) {
      const t = tile(cx, cy);
      if (isSolid(t) || (isPlayer && t === 'H')) { const d = Math.abs(cx * T + T / 2 - (o.x + o.w / 2)); if (d < best) { best = d; hit = cx; } }
    }
    if (hit !== null) { o.y = (cy + 1) * T + 0.01; o.vy = 40; if (isPlayer) hitBlockFromBelow(hit, cy); }
  }
}

function tryBreakBarrier(cx) {
  if (power.docPower || player.strength >= 4) {
    for (let cy = 0; cy < ROWS; cy++) if (grid[cy][cx] === 'X') { grid[cy][cx] = '.'; burst(cx * T + T / 2, cy * T + T / 2, 8, ['#ffffff', '#E74C3C', '#f4f1e6'], 380, 900, 6, 1); }
    Sound.wall(); shake = 0.35; addScore(800, cx * T, 6 * T);
    toast(power.docPower ? 'Documentation Power! Barrier cleared' : 'Barrier smashed!');
    return true;
  }
  if (hintT <= 0) { hintT = 2.5; toast('Paperwork barrier! Get Euverify Documentation Power or strength 4'); }
  return false;
}

/* ---------------------------------------------------------------- gates */
function gateAt(col) { return gates.find(g => g.col === col); }
function touchGate(col) {
  const g = gateAt(col); if (!g || g.open) return;
  const missing = g.needs.filter(d => !docsGot.has(d));
  if (!missing.length) openGate(g, true);
  else if (hintT <= 0) {
    hintT = 2.2; Sound.deny();
    toast('Missing: ' + missing.map(d => DOCS[d].t).join(', '), 3200);
  }
}
function openGate(g, award) {
  g.open = true; g.anim = 1;
  for (let cy = 0; cy < ROWS; cy++) if (grid[cy][g.col] === 'C' || grid[cy][g.col] === 'D') grid[cy][g.col] = '.';
  if (award) {
    Sound.gate(); addScore(500, g.col * T + T / 2, 5 * T);
    burst(g.col * T + T / 2, 6 * T, 30, [C.green, '#fff', C.yellow], 360, 300, 5, 0.9);
    showInfo('Checkpoint cleared', g.label, 'Documents in order. Keep moving, and keep them up to date.');
    respawnX = Math.max(respawnX, g.col * T + T);
  }
}
function pressSwitch(sw) {
  const g = sw.gate;
  sw.pressed = 0.6;
  if (g.open) { g.left = g.secs; return; }
  g.open = true; g.left = g.secs; g.anim = 1;
  for (let cy = 0; cy < ROWS; cy++) if (grid[cy][g.col] === 'D') grid[cy][g.col] = 'd';
  Sound.gate(); toast('Timed check started! Reach the gate in ' + g.secs + ' seconds');
}
function updateGates(dt) {
  gates.forEach(g => {
    if (g.anim > 0) g.anim -= dt;
    if (g.kind !== 'timed' || !g.open || g.passed) return;
    if (player.x > g.col * T + T) {
      g.passed = true; $('timerPill').hidden = true;
      for (let cy = 0; cy < ROWS; cy++) if (grid[cy][g.col] === 'd') grid[cy][g.col] = '.';
      Sound.gate(); addScore(700, g.col * T, 5 * T); showInfo('Timed check passed', g.label, 'Authorities can ask for your documents at short notice. Keep them organised and ready.');
      respawnX = Math.max(respawnX, g.col * T + T);
      return;
    }
    const before = Math.ceil(g.left);
    g.left -= dt;
    if (Math.ceil(g.left) !== before && g.left > 0) Sound.tick();
    const pill = $('timerPill'); pill.hidden = false; pill.textContent = '⏱ ' + Math.max(0, g.left).toFixed(1) + 's';
    if (g.left <= 0) {
      const inside = player.x + player.w > g.col * T && player.x < g.col * T + T;
      if (inside) { g.left = 0.2; return; }
      g.open = false; pill.hidden = true;
      for (let cy = 0; cy < ROWS; cy++) if (grid[cy][g.col] === 'd') grid[cy][g.col] = 'D';
      Sound.deny(); toast('Too slow! Step on the switch to try again');
    }
  });
}

/* ------------------------------------------------------------- power */
function updatePower(dt) {
  if (power.shield && !power.shieldReady) { power.shieldT -= dt; if (power.shieldT <= 0) { power.shieldReady = true; toast('Compliance Shield recharged'); } }
  if (power.scanner) {
    scanT -= dt;
    if (scanT <= 0) {
      scanT = 2.4;
      let found = false;
      items.forEach(it => {
        if (it.type === 'doc' && it.hidden && Math.abs(it.x - player.x) < 8 * T) { it.hidden = false; it.revealed = 1; found = true; burst(it.x + 14, it.y + 16, 14, [C.green, '#fff'], 160, 0, 4, 0.6); }
      });
      particles.push({ x: player.x + player.w / 2, y: player.y + player.h / 2, vx: 0, vy: 0, life: 0.9, max: 0.9, color: 'scan', size: 0, grav: 0 });
      if (found) { Sound.scan(); toast('Scanner found a hidden document!'); }
    }
  }
}
function activateEuverify(cx, cy, fromGuide) {
  const first = !power.costume;
  power.costume = true; power.shield = true; power.shieldReady = true; power.docPower = true;
  player.hearts = 3;
  gainStrength(2);
  addScore(first ? 1000 : 1500, cx, cy - 20);
  Sound.power(); shake = 0.25;
  burst(cx, cy, 50, [C.green, C.yellow, '#fff', C.purple], 420, 50, 6, 1.1);
  state = 'transform'; transformT = 1.35;
  drawPortrait($('bannerHero'), 'eu', player.strength);
  $('bannerTitle').textContent = 'EUVERIFY POWER ACTIVATED!';
  $('bannerSub').textContent = first ? 'Compliance Shield · Documentation Power · Strength +2' : 'Power topped up · Strength +2';
  const b = $('banner'); b.hidden = true; void b.offsetWidth; b.hidden = false;
  if (first) setTimeout(() => showInfo('Euverify power', 'Compliance Shield & Documentation Power', 'The shield blocks one hit and recharges. Documentation Power breaks paperwork barriers.'), 1500);
  updateHUD(true);
}
function activateScanner() {
  power.scanner = true; power.boost = true; scanT = 0.3;
  levelTime += 30;
  Sound.scan(); Sound.power();
  $('bannerTitle').textContent = 'EUVERIFY POWER ACTIVATED!';
  $('bannerSub').textContent = 'Technical File Scanner · Knowledge Boost · +30s';
  drawPortrait($('bannerHero'), power.costume ? 'eu' : 'classic', player.strength);
  const b = $('banner'); b.hidden = true; void b.offsetWidth; b.hidden = false;
  state = 'transform'; transformT = 1.35;
  setTimeout(() => showInfo('Euverify power', 'Technical File Scanner', 'Pulses every few seconds and reveals hidden documents nearby. Knowledge Boost doubles document points.'), 1500);
}

/* ------------------------------------------------------------- guides */
function updateGuides(dt) {
  guides.forEach(g => {
    g.t += dt;
    const gx = g.x + 20, gy = g.y + Math.sin(g.t * 2.2) * 6;
    const near = Math.abs(player.x + player.w / 2 - gx) < 160;
    g.talking = near;
    if (near) { g.lineT += dt; if (g.lineT > 3.2) { g.lineT = 0; g.line = (g.line + 1) % g.lines.length; } }
    const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
    if (!g.given && g.gives !== 'none' && Math.abs(pcx - gx) < 30 && Math.abs(pcy - gy) < 72) {
      g.given = true; g.line = Math.min(1, g.lines.length - 1); g.lineT = 0;
      if (g.gives === 'costume') activateEuverify(gx, gy, true);
      else if (g.gives === 'scanner') { if (!power.costume) { power.costume = true; power.shield = true; power.docPower = true; power.shieldReady = true; } activateScanner(); }
    }
  });
}

/* ------------------------------------------------------------- items */
function updateItems(dt) {
  items.forEach(it => {
    if (!it.alive) return;
    it.t += dt;
    if (it.revealed > 0) it.revealed -= dt;
    if (it.rise > 0) { it.rise -= dt * 2.6; it.y = it.baseY + Math.max(0, it.rise) * (it.h + 4); if (it.rise <= 0) it.y = it.baseY; return; }
    let box;
    if (it.mover) {
      it.vy = Math.min(MAX_FALL, it.vy + GRAV * dt);
      it.x += it.vx * dt; resolveX(it, false);
      it.y += it.vy * dt; it.onGround = false; resolveY(it, false);
      if (it.y > VH + 80) { it.alive = false; return; }
      box = it;
    } else {
      const bob = it.type === 'seal' || it.type === 'box' ? 0 : Math.sin(it.t * 3) * 4;
      box = { x: it.x, y: it.baseY + bob, w: it.w, h: it.h };
    }
    if (it.hidden) return;
    if (overlap(player, box)) collect(it);
  });
  items = items.filter(i => i.alive);
}
function collect(it) {
  it.alive = false;
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
  if (it.type === 'seal') { Sound.coin(); addScore(100, cx, cy - 10); burst(cx, cy, 8, [C.green, '#fff'], 150, 0, 3, 0.4); }
  else if (it.type === 'box') { Sound.box(); addScore(150, cx, cy - 10); burst(cx, cy, 10, ['#C98B52', C.green, '#fff'], 170, 200, 4, 0.5); }
  else if (it.type === 'canister') {
    player.cans++; Sound.canister();
    if (gainStrength(1)) popup(cx, cy - 16, 'STRENGTH ' + player.strength, C.purple, true); else addScore(300, cx, cy - 30);
    addScore(200, cx, cy); burst(cx, cy, 22, [C.purple, '#b48cff', C.green, '#fff'], 300, 100, 5, 0.8);
  } else if (it.type === 'badge') activateEuverify(cx, cy);
  else if (it.type === 'life') { lives++; player.hearts = 3; Sound.life(); popup(cx, cy - 10, '1-UP', '#D6336C', true); burst(cx, cy, 16, ['#FF5A5F', '#fff'], 200, 100, 4, 0.6); }
  else if (it.type === 'doc') {
    const d = DOCS[it.doc]; docsGot.add(it.doc); Sound.doc();
    const pts = (d.bonus ? 600 : 300) * (power.boost ? 2 : 1);
    addScore(pts, cx, cy - 10); popup(cx, cy - 30, d.t.toUpperCase(), C.purple, true);
    burst(cx, cy, 18, ['#fff', C.green, C.yellow], 220, 100, 4, 0.7);
    showInfo(d.bonus ? 'Hidden document found' : 'Document collected', d.t, d.d);
  }
}

/* ------------------------------------------------------------- enemies */
function killEnemy(e, flipped = false) {
  e.alive = false; e.dead = 0.6; e.flipped = flipped;
  burst(e.x + e.w / 2, e.y + e.h / 2, 12, e.type === 'bot' ? ['#9aa4ae', '#E74C3C', C.purple] : e.type === 'paper' ? ['#fff', '#ddd', '#E74C3C'] : ['#7A6A3A', '#a89a5c', C.green], 240, 600, 4, 0.6);
  addScore(200, e.x + e.w / 2, e.y); Sound.stomp();
}
function updateEnemies(dt) {
  const p = player;
  enemies.forEach(e => {
    if (!e.alive) { if (e.dead > 0) e.dead -= dt; return; }
    if (!e.active) { if (e.x < camX + VW + 120) e.active = true; else return; }
    e.t += dt;
    if (e.type === 'cloud' || e.type === 'paper') {
      e.x += e.vx * dt * (e.type === 'paper' ? 1 : 0.8);
      if (e.x < e.minX || e.x > e.maxX) { e.vx = -e.vx; e.x = clamp(e.x, e.minX, e.maxX); }
      e.y = e.baseY + Math.sin(e.t * (e.type === 'paper' ? 3.2 * L.speed : 2.2)) * (e.type === 'paper' ? 46 : 34);
    } else {
      e.vy = Math.min(MAX_FALL, e.vy + GRAV * dt);
      e.x += e.vx * dt; resolveX(e, false);
      e.y += e.vy * dt; e.onGround = false; resolveY(e, false);
      if (e.onGround) { const ahead = e.vx > 0 ? e.x + e.w + 2 : e.x - 2; if (!isSolid(tile(Math.floor(ahead / T), Math.floor((e.y + e.h + 4) / T)))) e.vx = -e.vx; }
      if (e.y > VH + 80) e.alive = false;
    }
    if (state === 'play' && overlap(p, e)) {
      const stompable = e.type !== 'bot' || p.strength >= 3;
      const fromAbove = p.vy > 60 && (p.y + p.h) - e.y < 22;
      if (fromAbove && stompable) { killEnemy(e); p.vy = keys.jump ? -620 : -460; p.jumps = 1; p.plat = null; }
      else if (p.strength >= 5) { killEnemy(e); popup(e.x, e.y - 10, 'AURA!', C.purple, true); }
      else if (fromAbove && e.type === 'bot') { p.vy = -420; hurt(); }
      else hurt();
    }
  });
}

function hurt(spike = false) {
  const p = player;
  if (p.inv > 0 || state !== 'play') return;
  if (power.shield && power.shieldReady) {
    power.shieldReady = false; power.shieldT = 10; p.inv = 1.1; Sound.shield();
    burst(p.x + p.w / 2, p.y + p.h / 2, 26, [C.green, '#fff'], 300, 0, 4, 0.6);
    popup(p.x + p.w / 2, p.y - 10, 'SHIELD!', C.purple, true);
    p.vy = -300; return;
  }
  p.hearts--; p.inv = 1.6; Sound.hurt(); shake = 0.2;
  p.vy = -380; p.vx = -p.facing * 200; p.plat = null;
  burst(p.x + p.w / 2, p.y + p.h / 2, 10, ['#FF5A5F', '#fff'], 200, 300, 4, 0.5);
  if (p.hearts <= 0) die(); else if (spike) toast('Ouch! Mind the warning signs');
}
function die() {
  if (state !== 'play') return;
  state = 'dead'; deadT = 1.4; lives--; Sound.die(); Sound.stopMusic();
  player.vy = -600; player.vx = 0; player.plat = null; $('timerPill').hidden = true;
  updateHUD(true);
}
function afterDeath() {
  if (lives <= 0) {
    state = 'over'; Sound.over(); clearInfo();
    $('overScore').textContent = String(score).padStart(6, '0');
    show('overScreen'); $('touch').hidden = true; return;
  }
  const keep = { strength: player.strength, cans: player.cans };
  player = newPlayer(respawnX); Object.assign(player, keep);
  player.inv = 2; levelTime = Math.max(levelTime, 90);
  gates.forEach(g => { if (g.kind === 'timed' && g.open && !g.passed) { g.open = false; for (let cy = 0; cy < ROWS; cy++) if (grid[cy][g.col] === 'd') grid[cy][g.col] = 'D'; } });
  camX = Math.max(0, respawnX - VW * 0.35);
  state = 'play'; Sound.startMusic(L.tune); toast('Back at the last checkpoint');
  updateHUD(true);
}

function levelComplete() {
  state = 'levelDone'; doneT = 2.2; Sound.stopMusic(); Sound.fanfare();
  const tb = Math.floor(levelTime) * 10; score += tb;
  $('bannerTitle').textContent = (L.key === 'EU' ? 'GLOBAL MARKET REACHED!' : 'LEVEL COMPLETE!');
  $('bannerSub').textContent = 'Time bonus +' + tb + ' · Documents ' + [...docsGot].filter(d => !DOCS[d].bonus).length + '/' + levelDocs();
  drawPortrait($('bannerHero'), power.costume ? 'eu' : 'classic', player.strength);
  const b = $('banner'); b.hidden = true; void b.offsetWidth; b.hidden = false;
  for (let i = 0; i < 6; i++) setTimeout(() => burst(finish.x + T, 5 * T, 30, [C.green, C.yellow, C.purple, '#fff'], 420, 300, 5, 1.2), i * 160);
  clearInfo(); updateHUD(true);
}
function afterLevel() {
  $('banner').hidden = true;
  $('hud').hidden = true; $('touch').hidden = true;
  if (levelIdx === 0) startCine('toUK');
  else if (levelIdx === 1) startCine('toEU');
  else startCine('final');
}
function updateCamera(dt) {
  const target = player.x - VW * 0.38 + player.facing * 40;
  camX += (target - camX) * Math.min(1, dt * 6);
  camX = clamp(camX, 0, COLS * T - VW);
}
function updateParticles(dt) {
  particles.forEach(p => { p.life -= dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; });
  particles = particles.filter(p => p.life > 0);
}

/* =========================================================== CINEMATICS */
// A cinematic is a timeline drawn on the game canvas: world map, highlights, a route, a plane and a zoom.
let cine = null;
const VIEWS = {
  world:  { cx: 40, cy: 30, span: 150 },
  india:  { cx: 79, cy: 22, span: 34 },
  inUk:   { cx: 37, cy: 37, span: 105 },
  uk:     { cx: -2.5, cy: 54, span: 15 },
  ukEu:   { cx: 8, cy: 50, span: 42 },
  eu:     { cx: 9, cy: 50, span: 30 },
  euZoom: { cx: 4.5, cy: 50.5, span: 10 },
  final:  { cx: 50, cy: 18, span: 240 }
};
function lerpView(a, b, t) { return { cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), span: Math.exp(lerp(Math.log(a.span), Math.log(b.span), t)) }; }
function startCine(kind) {
  state = 'cine'; Sound.stopMusic(); clearInfo();
  hideScreens(); $('hud').hidden = true; $('touch').hidden = true; $('finalScreen').hidden = true;
  cine = { kind, t: 0, cues: {} };
  cine.dur = { intro: 5.2, toUK: 7.6, toEU: 7.6, final: 1e9 }[kind];
  $('btnSkip').hidden = kind === 'final';
  $('mapCaption').hidden = false;
  if (kind === 'final') { Sound.finale(); finalParticles = []; }
}
function cue(name, at, fn) { if (cine.t >= at && !cine.cues[name]) { cine.cues[name] = 1; fn(); } }
function caption(kicker, title) { $('mapKicker').textContent = kicker; $('mapTitle').textContent = title; }
function skipCine() { if (cine && cine.kind !== 'final') cine.t = cine.dur; }
function updateCine(dt) {
  cine.t += dt; frameT += dt;
  const k = cine.kind, t = cine.t;
  if (k === 'intro') {
    cue('a', 0, () => caption('Stage 1 · Where it starts', 'INDIA'));
    cue('b', 1.4, () => { Sound.ding(); caption('Your business journey begins', 'IN INDIA!'); });
  } else if (k === 'toUK') {
    cue('a', 0, () => { Sound.ding(); caption('Level 1 complete', 'NEXT STOP: UNITED KINGDOM'); });
    cue('b', 1.0, () => { Sound.plane(); caption('Exporting your product', 'INDIA  ✈  UNITED KINGDOM'); });
    cue('c', 3.9, () => { Sound.ding(); caption('Arriving in', 'THE UNITED KINGDOM'); });
  } else if (k === 'toEU') {
    cue('a', 0, () => { Sound.ding(); caption('Level 2 complete', 'NEXT STOP: EUROPEAN UNION'); });
    cue('b', 1.0, () => { Sound.plane(); caption('Expanding further', 'UNITED KINGDOM  ✈  EUROPEAN UNION'); });
    cue('c', 3.9, () => { Sound.ding(); caption('Arriving in', 'THE EUROPEAN UNION'); });
  } else if (k === 'final') {
    cue('a', 0, () => caption('Your journey', 'INDIA → UK → EU → THE WORLD'));
    cue('b', 3.2, () => { $('mapCaption').hidden = true; $('finalScore').textContent = 'Final score ' + String(score).padStart(6, '0'); $('finalScreen').hidden = false; });
    if (Math.random() < 0.25) finalParticles.push({ x: Math.random() * VW, y: -10, vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 80, c: [C.green, C.yellow, C.purple, '#fff'][Math.floor(Math.random() * 4)], r: Math.random() * 6, life: 8 });
    finalParticles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 3; p.life -= dt; });
    finalParticles = finalParticles.filter(p => p.life > 0 && p.y < VH + 20);
  }
  if (t >= cine.dur) endCine();
}
let finalParticles = [];
function endCine() {
  const k = cine.kind; cine = null;
  $('mapCaption').hidden = true; $('btnSkip').hidden = true;
  if (k === 'intro') beginLevel(0);
  else if (k === 'toUK') beginLevel(1);
  else if (k === 'toEU') beginLevel(2);
}
function drawCine() {
  const k = cine.kind, t = cine.t, W = VW, H = VH;
  let view, o = { t: frameT };
  if (k === 'intro') {
    const z = ease(clamp((t - 1.6) / 2.6, 0, 1));
    view = lerpView(VIEWS.world, VIEWS.india, z);
    o.hl = { IN: clamp(t / 1.2, 0, 1) };
    o.pins = [{ at: 'MUM', label: 'India', flag: 'IN' }];
  } else if (k === 'toUK' || k === 'toEU') {
    const uk = k === 'toUK';
    const r = uk ? { a: 'MUM', b: 'LON', bulge: 0.22 } : { a: 'LON', b: 'BRU', bulge: 0.45 };
    const start = uk ? VIEWS.inUk : VIEWS.ukEu, end = uk ? VIEWS.uk : VIEWS.euZoom;
    const intro = uk ? lerpView(VIEWS.india, VIEWS.inUk, ease(clamp(t / 1.0, 0, 1))) : lerpView(VIEWS.uk, VIEWS.ukEu, ease(clamp(t / 1.0, 0, 1)));
    const prog = ease(clamp((t - 1.0) / 2.8, 0, 1));
    const z = ease(clamp((t - 4.9) / 1.9, 0, 1));
    view = t < 1.0 ? intro : lerpView(start, end, z);
    o.hl = uk ? { IN: 1 - 0.4 * z, GB: ease(clamp((t - 3.8) / 0.8, 0, 1)) } : { IN: 0.6, GB: 1 - 0.3 * z, EU: ease(clamp((t - 3.8) / 0.8, 0, 1)) };
    o.routes = uk ? [{ ...r, prog }] : [{ a: 'MUM', b: 'LON', bulge: 0.22, prog: 1, color: 'rgba(195,255,102,0.45)' }, { ...r, prog }];
    if (t > 1.0 && t < 4.4) { o.plane = { r, t: prog }; o.planeScale = uk ? 1.1 : 1.3; }
    o.pins = uk ? [{ at: 'MUM', label: 'India', flag: 'IN', below: true }, ...(t > 3.8 ? [{ at: 'LON', label: 'United Kingdom', flag: 'GB' }] : [])]
                : [{ at: 'LON', label: 'United Kingdom', flag: 'GB' }, ...(t > 3.8 ? [{ at: 'BRU', label: 'European Union', flag: 'EU', below: true }] : [])];
  } else {
    // final
    view = lerpView(VIEWS.eu, VIEWS.final, ease(clamp(t / 2.2, 0, 1)));
    o.hl = { IN: 1, GB: 1, EU: 1 };
    const g = (a, b, at, bulge = 0.25) => ({ a, b, bulge, prog: ease(clamp((t - at) / 1.6, 0, 1)) });
    o.routes = [g('MUM', 'LON', 0.4, 0.22), g('LON', 'BRU', 0.9, 0.45), g('MUM', 'NYC', 2.2, 0.2), g('MUM', 'SAO', 2.5, 0.2), g('MUM', 'DXB', 2.0, 0.3), g('MUM', 'SYD', 2.6, -0.2), g('MUM', 'TYO', 2.3, -0.25), g('MUM', 'JNB', 2.4, 0.2), g('MUM', 'SIN', 2.1, -0.3)];
    o.packages = [];
    o.routes.forEach((r, i) => { if (r.prog >= 1) for (let j = 0; j < 2; j++) o.packages.push({ a: r.a, b: r.b, bulge: r.bulge, t: ((t * 0.18 + i * 0.13 + j * 0.5) % 1) }); });
    o.pins = [{ at: 'MUM', label: 'India', flag: 'IN', below: true }, { at: 'LON', label: 'UK', flag: 'GB' }, { at: 'BRU', label: 'EU', flag: 'EU', below: true }];
  }
  drawMap(ctx, W, H, view, o);
  if (k === 'final') drawFinalScene(t);
  // fade at the end of transitions
  if (k !== 'final') {
    const f = clamp((t - (cine.dur - 0.7)) / 0.7, 0, 1);
    if (f > 0) { ctx.fillStyle = `rgba(255,255,255,${f})`; ctx.fillRect(0, 0, W, H); }
    const fi = clamp(1 - t / 0.5, 0, 1);
    if (fi > 0) { ctx.fillStyle = `rgba(255,255,255,${fi})`; ctx.fillRect(0, 0, W, H); }
  }
}
function drawFinalScene(t) {
  const W = VW, H = VH, gy = H - 40;
  // global business skyline + Euverify destination
  ctx.fillStyle = 'rgba(13,44,74,0.0)';
  const rise = ease(clamp((t - 0.8) / 1.4, 0, 1));
  ctx.save(); ctx.translate(0, (1 - rise) * 200);
  ctx.fillStyle = '#0a1f36';
  for (let i = 0; i < 14; i++) { const bw = 50 + (i * 37) % 40, bh = 60 + (i * 53) % 90; ctx.fillRect(i * (W / 13) - 10, gy - bh, bw, bh); }
  ctx.fillStyle = '#1b3a5c'; for (let i = 0; i < 14; i++) { const bh = 60 + (i * 53) % 90; for (let r2 = 0; r2 < 4; r2++) ctx.fillRect(i * (W / 13) + 2, gy - bh + 10 + r2 * 16, 6, 8); }
  // Euverify tower
  const tx = W * 0.86, tw = 190, th = 230;
  ctx.fillStyle = '#000'; ctx.fillRect(tx - tw / 2 - 4, gy - th - 4, tw + 8, th + 4);
  ctx.fillStyle = '#fff'; ctx.fillRect(tx - tw / 2, gy - th, tw, th);
  ctx.fillStyle = '#000'; ctx.fillRect(tx - tw / 2, gy - th, tw, 46);
  drawLogo(ctx, LOGO.wordWhite, tx, gy - th + 23, 160);
  ctx.fillStyle = C.green; ctx.fillRect(tx - tw / 2, gy - th + 46, tw, 4);
  for (let r2 = 0; r2 < 4; r2++) for (let c2 = 0; c2 < 4; c2++) { ctx.fillStyle = (r2 + c2 + Math.floor(t)) % 3 ? '#BFE6FF' : C.yellow; ctx.fillRect(tx - tw / 2 + 16 + c2 * 44, gy - th + 64 + r2 * 38, 30, 26); }
  ctx.fillStyle = C.green; ctx.fillRect(tx - 26, gy - 54, 52, 54); ctx.fillStyle = '#000'; ctx.fillRect(tx - 21, gy - 49, 42, 49);
  drawLogo(ctx, LOGO.icon, tx, gy - 26, 30);
  // flags
  ['IN', 'GB', 'EU'].forEach((f, i) => drawFlagPole(ctx, f, tx - 70 + i * 60, gy - th - 4, t, 0.5));
  // ground
  ctx.fillStyle = '#000'; ctx.fillRect(0, gy, W, 40); ctx.fillStyle = C.green; ctx.fillRect(0, gy, W, 5);
  // the hero, proudly
  const hx = W * 0.13;
  ctx.save(); ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(hx, gy - 60, 10, hx, gy - 60, 120); g.addColorStop(0, 'rgba(195,255,102,0.45)'); g.addColorStop(1, 'rgba(195,255,102,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, gy - 60, 120, 0, TAU); ctx.fill(); ctx.restore();
  drawHero(ctx, hx, gy, { costume: 'eu', facing: 1, strength: player ? player.strength : 5, scale: 2.3, showText: true, t, air: false, vx: 0 });
  ctx.restore();
  finalParticles.forEach(p => { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); });
}

/* =============================================================== RENDER */
const THEMES = {
  india: { skyTop: '#FFB65C', skyBot: '#FFE9B8', sun: '#FFF4C8', dirt: '#B85C33', dirtDark: '#94461F', top: '#6BBF3A', topHi: '#C3FF66', brick: '#C0582E', mortar: '#7A2E12' },
  uk:    { skyTop: '#8EA3B8', skyBot: '#D5DEE6', sun: null, dirt: '#5F666D', dirtDark: '#4C5258', top: '#9AA1A8', topHi: '#D3D7DB', brick: '#9C4A33', mortar: '#5A2518' },
  eu:    { skyTop: '#7FC0FF', skyBot: '#E6F3FF', sun: '#FFF6CF', dirt: '#8C7B62', dirtDark: '#6E5F4A', top: '#C9B894', topHi: '#EDE3C8', brick: '#A79C8C', mortar: '#6B6253' }
};
function themeBrick() { return THEMES[L.theme].brick; }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.setLineDash([]);
  if (state === 'cine' && cine) { drawCine(); return; }
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 8 * shake / 0.3, (Math.random() - 0.5) * 6 * shake / 0.3);
  drawBackground();
  ctx.save(); ctx.translate(-Math.round(camX), 0);
  drawFlags();
  drawFinish();
  drawPipes();
  drawTiles();
  drawGates();
  drawSwitches();
  drawPlatforms();
  drawSigns();
  items.forEach(drawItem);
  enemies.forEach(drawEnemy);
  drawGuides();
  drawPlayerInWorld();
  drawParticles();
  drawPopups();
  ctx.restore();
  ctx.restore();
}

/* ---------- backgrounds */
function sky(th) {
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, th.skyTop); g.addColorStop(0.75, th.skyBot); g.addColorStop(1, th.skyBot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  if (th.sun) { ctx.fillStyle = th.sun; ctx.beginPath(); ctx.arc(VW * 0.82 - camX * 0.02, 90, 44, 0, TAU); ctx.fill(); }
}
function cloudsLayer(color, f = 0.3) {
  clouds.forEach(cl => {
    const x = ((cl.x - camX * f) % 7280 + 7280) % 7280 - 200;
    if (x > VW + 200) return;
    ctx.fillStyle = color; ctx.beginPath();
    ctx.arc(x, cl.y, 22 * cl.s, 0, TAU); ctx.arc(x + 26 * cl.s, cl.y - 12 * cl.s, 28 * cl.s, 0, TAU); ctx.arc(x + 58 * cl.s, cl.y, 22 * cl.s, 0, TAU); ctx.rect(x, cl.y, 58 * cl.s, 22 * cl.s); ctx.fill();
  });
}
function rep(f, period, fn) {
  // repeat a decoration every `period` px of parallax space
  const off = camX * f;
  const i0 = Math.floor((off - 300) / period), i1 = Math.floor((off + VW + 300) / period);
  for (let i = i0; i <= i1; i++) fn(i * period - off, i);
}
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function drawBackground() {
  const th = THEMES[L.theme];
  sky(th);
  if (L.theme === 'india') bgIndia(th); else if (L.theme === 'uk') bgUK(th); else bgEU(th);
}

function bgIndia(th) {
  // kites
  for (let i = 0; i < 4; i++) {
    const x = ((i * 300 - camX * 0.1) % (VW + 200) + VW + 200) % (VW + 200) - 100, y = 70 + i * 26;
    ctx.fillStyle = ['#E63946', '#2A9D8F', '#8338EC', '#FB5607'][i];
    ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 12); ctx.lineTo(x - 9, y); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.quadraticCurveTo(x - 20, y + 60, x - 10, y + 120); ctx.stroke();
  }
  // far hills
  ctx.fillStyle = '#F2C38C';
  rep(0.12, 520, x => { ctx.beginPath(); ctx.ellipse(x + 260, 330, 330, 130, 0, Math.PI, 0); ctx.fill(); });
  ctx.fillRect(0, 330, VW, VH);
  // city skyline: domes, minarets, temple spires, towers
  rep(0.28, 900, (x, i) => {
    ctx.fillStyle = '#D9884E';
    // palace with domes
    ctx.fillRect(x + 40, 260, 220, 120);
    ctx.beginPath(); ctx.arc(x + 150, 262, 58, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 150, 190); ctx.lineTo(x + 146, 205); ctx.lineTo(x + 154, 205); ctx.fill();
    [x + 70, x + 230].forEach(dx => { ctx.beginPath(); ctx.arc(dx, 262, 24, Math.PI, 0); ctx.fill(); });
    [x + 34, x + 266].forEach(mx => { ctx.fillRect(mx - 6, 200, 12, 180); ctx.beginPath(); ctx.arc(mx, 200, 10, Math.PI, 0); ctx.fill(); });
    // temple shikhara
    ctx.fillStyle = '#C8743E';
    ctx.beginPath(); ctx.moveTo(x + 340, 380); ctx.quadraticCurveTo(x + 345, 250, x + 380, 222); ctx.quadraticCurveTo(x + 415, 250, x + 420, 380); ctx.fill();
    ctx.fillRect(x + 376, 208, 8, 16);
    // modern towers
    ctx.fillStyle = '#E09A62';
    for (let k = 0; k < 5; k++) { const bh = 90 + rnd(i * 7 + k) * 110; ctx.fillRect(x + 470 + k * 70, 380 - bh, 52, bh); }
    ctx.fillStyle = 'rgba(255,240,200,0.45)';
    for (let k = 0; k < 5; k++) { const bh = 90 + rnd(i * 7 + k) * 110; for (let w = 0; w < bh / 22 - 1; w++) ctx.fillRect(x + 478 + k * 70, 390 - bh + w * 22, 36, 6); }
  });
  // near: market stalls & palms
  rep(0.55, 640, (x, i) => {
    const gy = 440;
    // palm
    ctx.fillStyle = '#7A5230'; ctx.fillRect(x + 40, gy - 150, 10, 150);
    ctx.fillStyle = '#2E8B57';
    for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.5; ctx.beginPath(); ctx.ellipse(x + 45 + Math.cos(a) * 30, gy - 150 + Math.sin(a) * 16, 34, 8, a, 0, TAU); ctx.fill(); }
    // stalls
    const cols = [['#E63946', '#FFFFFF'], ['#FFB703', '#FB8500'], ['#2A9D8F', '#E9F5DB'], ['#8338EC', '#FFD6FF']];
    for (let k = 0; k < 2; k++) {
      const sx = x + 140 + k * 200, c2 = cols[(((i + k) % 4) + 4) % 4];
      ctx.fillStyle = '#8B5A2B'; ctx.fillRect(sx, gy - 70, 6, 70); ctx.fillRect(sx + 124, gy - 70, 6, 70);
      for (let s = 0; s < 8; s++) { ctx.fillStyle = c2[s % 2]; ctx.fillRect(sx - 6 + s * 18, gy - 92, 18, 26); }
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(sx - 6, gy - 66, 144, 4);
      ctx.fillStyle = '#C98B52'; ctx.fillRect(sx + 10, gy - 34, 110, 34);
      ['#FF6B6B', '#FFD166', '#06D6A0', '#F78C6B'].forEach((fc, j) => { ctx.fillStyle = fc; ctx.beginPath(); ctx.arc(sx + 26 + j * 26, gy - 38, 8, 0, TAU); ctx.fill(); });
    }
  });
}

function bgUK(th) {
  cloudsLayer('#E9EDF1', 0.3);
  // Thames haze
  ctx.fillStyle = '#B9C5D1'; ctx.fillRect(0, 300, VW, VH);
  // London skyline (repeats every 1500 px of parallax space)
  rep(0.25, 1500, (x, i) => {
    const base = 380;
    ctx.fillStyle = '#6E7F91';
    // Houses of Parliament
    ctx.fillRect(x + 60, base - 70, 300, 70);
    for (let k = 0; k < 10; k++) { ctx.fillRect(x + 66 + k * 30, base - 86, 6, 18); }
    ctx.fillRect(x + 300, base - 120, 40, 120);
    // Elizabeth Tower (Big Ben)
    const bx = x + 40;
    ctx.fillRect(bx, base - 230, 40, 230);
    ctx.fillRect(bx - 4, base - 185, 48, 8);
    ctx.beginPath(); ctx.moveTo(bx - 2, base - 230); ctx.lineTo(bx + 20, base - 290); ctx.lineTo(bx + 42, base - 230); ctx.fill();
    ctx.fillRect(bx + 18, base - 305, 4, 18);
    ctx.fillStyle = '#F4EBD0'; ctx.beginPath(); ctx.arc(bx + 20, base - 205, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3B4652'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx + 20, base - 205, 13, 0, TAU); ctx.stroke();
    const hr = 1.4, mn = 0;
    ctx.beginPath(); ctx.moveTo(bx + 20, base - 205); ctx.lineTo(bx + 20 + Math.sin(hr) * 7, base - 205 - Math.cos(hr) * 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + 20, base - 205); ctx.lineTo(bx + 20 + Math.sin(mn) * 11, base - 205 - Math.cos(mn) * 11); ctx.stroke();
    // London Eye
    const ex = x + 520, ey = base - 120, er = 110;
    ctx.strokeStyle = '#7F90A3'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.5; const rot = 0;
    for (let k = 0; k < 16; k++) { const a = rot + k * TAU / 16; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a) * er, ey + Math.sin(a) * er); ctx.stroke();
      ctx.fillStyle = '#9FB0C2'; ctx.beginPath(); ctx.ellipse(ex + Math.cos(a) * er, ey + Math.sin(a) * er, 7, 5, 0, 0, TAU); ctx.fill(); }
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(ex - 40, base); ctx.lineTo(ex, ey); ctx.lineTo(ex + 40, base); ctx.stroke();
    // St Paul's dome
    ctx.fillStyle = '#6E7F91';
    ctx.fillRect(x + 700, base - 80, 120, 80); ctx.beginPath(); ctx.arc(x + 760, base - 80, 44, Math.PI, 0); ctx.fill(); ctx.fillRect(x + 756, base - 140, 8, 20);
    // The Shard & Gherkin-like towers
    ctx.fillStyle = '#5C6E82';
    ctx.beginPath(); ctx.moveTo(x + 900, base); ctx.lineTo(x + 950, base - 300); ctx.lineTo(x + 1000, base); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 1080, base - 90, 32, 100, 0, 0, TAU); ctx.fill();
    for (let k = 0; k < 6; k++) { const bh = 80 + rnd(i * 5 + k) * 120; ctx.fillRect(x + 1140 + k * 56, base - bh, 46, bh); }
  });
  // near: terraced houses, phone box, lamp posts
  rep(0.55, 700, (x, i) => {
    const gy = 440;
    for (let k = 0; k < 4; k++) {
      const hx = x + k * 90;
      ctx.fillStyle = ['#9C4A33', '#8A3F2C', '#A55A3C', '#7E3A2A'][(((i + k) % 4) + 4) % 4]; ctx.fillRect(hx, gy - 150, 88, 150);
      ctx.fillStyle = '#3B3B3B'; ctx.beginPath(); ctx.moveTo(hx - 4, gy - 150); ctx.lineTo(hx + 44, gy - 182); ctx.lineTo(hx + 92, gy - 150); ctx.fill();
      ctx.fillStyle = '#F2F2F2'; for (let w = 0; w < 2; w++) { ctx.fillRect(hx + 12 + w * 40, gy - 132, 26, 30); ctx.fillRect(hx + 12 + w * 40, gy - 86, 26, 30); }
      ctx.fillStyle = ['#1D3557', '#2A9D8F', '#C1121F', '#000'][(((i + k) % 4) + 4) % 4]; ctx.fillRect(hx + 34, gy - 50, 20, 50);
    }
    // phone box
    const px = x + 420;
    ctx.fillStyle = '#C8102E'; ctx.fillRect(px, gy - 92, 34, 92); ctx.fillRect(px - 2, gy - 98, 38, 8);
    ctx.fillStyle = '#F7E9C8'; for (let r2 = 0; r2 < 3; r2++) for (let c2 = 0; c2 < 2; c2++) ctx.fillRect(px + 6 + c2 * 12, gy - 80 + r2 * 18, 9, 14);
    // lamp post
    ctx.fillStyle = '#2B2D42'; ctx.fillRect(x + 520, gy - 130, 5, 130); ctx.fillRect(x + 512, gy - 136, 20, 10);
    ctx.fillStyle = '#FFE8A3'; ctx.fillRect(x + 515, gy - 128, 14, 10);
  });
}
let rainDrops = [];
function drawRain() {
  if (rainDrops.length < 70) for (let i = 0; i < 70; i++) rainDrops.push({ x: Math.random() * 1400, y: Math.random() * VH, s: 300 + Math.random() * 200 });
  const on = (Math.sin(frameT * 0.15) > 0.2);
  if (!on) return;
  ctx.strokeStyle = 'rgba(220,230,240,0.45)'; ctx.lineWidth = 1;
  rainDrops.forEach(d => { d.y += d.s / 60; d.x -= 1; if (d.y > VH) { d.y = -10; d.x = Math.random() * (VW + 100); } ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 3, d.y + 10); ctx.stroke(); });
}

function bgEU(th) {
  cloudsLayer('#FFFFFF', 0.3);
  // drifting gold stars
  ctx.fillStyle = 'rgba(255,204,0,0.55)';
  for (let i = 0; i < 12; i++) { const x = (i * 97 - camX * 0.05) % VW, y = 40 + (i * 41) % 160; star(ctx, (x + VW) % VW, y, 4); }
  const prog = camX / Math.max(1, COLS * T - VW);
  ctx.fillStyle = '#B9D6EE'; ctx.fillRect(0, 330, VW, VH);
  // three cities across the level: Paris → Amsterdam → Brussels
  rep(0.25, 1300, (x, i) => {
    const base = 380, city = prog < 0.36 ? 0 : prog < 0.7 ? 1 : 2;
    ctx.fillStyle = '#5E7590';
    if (city === 0) {
      // Eiffel Tower
      const ex = x + 200;
      ctx.beginPath(); ctx.moveTo(ex - 70, base); ctx.quadraticCurveTo(ex - 18, base - 120, ex - 8, base - 300); ctx.lineTo(ex + 8, base - 300); ctx.quadraticCurveTo(ex + 18, base - 120, ex + 70, base); ctx.lineTo(ex + 44, base); ctx.quadraticCurveTo(ex, base - 70, ex - 44, base); ctx.closePath(); ctx.fill();
      ctx.fillRect(ex - 40, base - 112, 80, 8); ctx.fillRect(ex - 24, base - 200, 48, 6); ctx.fillRect(ex - 2, base - 330, 4, 32);
      // Haussmann blocks
      for (let k = 0; k < 6; k++) { const hx = x + 330 + k * 140; ctx.fillRect(hx, base - 120, 128, 120); ctx.fillStyle = '#4E637C'; ctx.beginPath(); ctx.moveTo(hx - 4, base - 120); ctx.lineTo(hx + 10, base - 146); ctx.lineTo(hx + 118, base - 146); ctx.lineTo(hx + 132, base - 120); ctx.fill(); ctx.fillStyle = '#5E7590'; }
      ctx.beginPath(); ctx.arc(x + 1180, base - 120, 50, Math.PI, 0); ctx.fill(); ctx.fillRect(x + 1130, base - 120, 100, 120);
    } else if (city === 1) {
      // Amsterdam canal houses + windmill
      for (let k = 0; k < 10; k++) {
        const hx = x + k * 70, hh = 150 + rnd(i * 11 + k) * 60;
        ctx.fillStyle = ['#5E7590', '#6B829D', '#546A84'][k % 3];
        ctx.fillRect(hx, base - hh, 60, hh);
        ctx.beginPath(); ctx.moveTo(hx, base - hh); ctx.lineTo(hx + 10, base - hh - 14); ctx.lineTo(hx + 18, base - hh - 14); ctx.lineTo(hx + 22, base - hh - 32); ctx.lineTo(hx + 38, base - hh - 32); ctx.lineTo(hx + 42, base - hh - 14); ctx.lineTo(hx + 50, base - hh - 14); ctx.lineTo(hx + 60, base - hh); ctx.fill();
      }
      const wx = x + 900, wy = base - 150;
      ctx.fillStyle = '#5E7590'; ctx.beginPath(); ctx.moveTo(wx - 40, base); ctx.lineTo(wx - 22, wy); ctx.lineTo(wx + 22, wy); ctx.lineTo(wx + 40, base); ctx.fill();
      ctx.strokeStyle = '#4E637C'; ctx.lineWidth = 8;
      for (let k = 0; k < 4; k++) { const a = 0.4 + k * Math.PI / 2; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * 90, wy + Math.sin(a) * 90); ctx.stroke(); }
      ctx.fillStyle = '#9FC2E2'; ctx.fillRect(x, base - 10, 1300, 10);
    } else {
      // Brussels: Grand-Place guildhalls with gold, and an EU institutions building
      for (let k = 0; k < 7; k++) {
        const hx = x + k * 80, hh = 170 + (k % 3) * 25;
        ctx.fillStyle = '#5E7590'; ctx.fillRect(hx, base - hh, 70, hh);
        ctx.beginPath(); ctx.moveTo(hx, base - hh); ctx.lineTo(hx + 35, base - hh - 50); ctx.lineTo(hx + 70, base - hh); ctx.fill();
        ctx.fillStyle = 'rgba(255,204,0,0.8)'; ctx.fillRect(hx + 4, base - hh + 10, 62, 3); ctx.beginPath(); ctx.arc(hx + 35, base - hh - 50, 4, 0, TAU); ctx.fill();
      }
      // town hall spire
      ctx.fillStyle = '#4E637C'; ctx.fillRect(x + 600, base - 200, 160, 200); ctx.fillRect(x + 670, base - 300, 20, 100);
      ctx.beginPath(); ctx.moveTo(x + 665, base - 300); ctx.lineTo(x + 680, base - 360); ctx.lineTo(x + 695, base - 300); ctx.fill();
      // modern EU building with flags
      ctx.fillStyle = '#6B829D'; ctx.beginPath(); ctx.moveTo(x + 820, base); ctx.lineTo(x + 840, base - 140); ctx.lineTo(x + 1060, base - 140); ctx.lineTo(x + 1080, base); ctx.fill();
      ctx.fillStyle = '#9FC2E2'; for (let r2 = 0; r2 < 5; r2++) ctx.fillRect(x + 848, base - 128 + r2 * 24, 204, 8);
    }
  });
  // near: bridge over a canal, flower boxes, street lamps
  rep(0.55, 760, (x, i) => {
    const gy = 440;
    ctx.fillStyle = '#7FB3E0'; ctx.fillRect(x + 80, gy - 18, 260, 18);
    ctx.fillStyle = '#B9A88C'; ctx.beginPath(); ctx.moveTo(x + 60, gy - 18); ctx.quadraticCurveTo(x + 210, gy - 80, x + 360, gy - 18); ctx.lineTo(x + 360, gy - 36); ctx.quadraticCurveTo(x + 210, gy - 98, x + 60, gy - 36); ctx.fill();
    ctx.fillStyle = '#8C7B62'; for (let k = 0; k < 9; k++) ctx.fillRect(x + 90 + k * 30, gy - 80 + Math.abs(k - 4) * 9, 4, 22);
    ctx.fillStyle = '#2B2D42'; ctx.fillRect(x + 460, gy - 120, 5, 120); ctx.beginPath(); ctx.arc(x + 462, gy - 124, 10, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#FFE8A3'; ctx.fillRect(x + 455, gy - 124, 15, 8);
    ctx.fillStyle = '#D62828'; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + 560 + k * 14, gy - 8, 6, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#2B9348'; ctx.fillRect(x + 550, gy - 6, 74, 6);
  });
}

/* ---------- world objects */
function drawFlags() { flags.forEach(x => { if (x > camX - 100 && x < camX + VW + 100) drawFlagPole(ctx, L.key, x + 20, 11 * T, frameT); }); }

function drawTiles() {
  const th = THEMES[L.theme];
  const c0 = Math.max(0, Math.floor(camX / T) - 1), c1 = Math.min(COLS - 1, Math.ceil((camX + VW) / T) + 1);
  for (let cy = 0; cy < ROWS; cy++) for (let cx = c0; cx <= c1; cx++) {
    const t = grid[cy][cx]; if (t === '.' || t === 'H' || t === 'P' || t === 'C' || t === 'D' || t === 'd') continue;
    const x = cx * T; let y = cy * T;
    const b = bumps[cx + ',' + cy]; if (b) y -= Math.sin((0.18 - b) / 0.18 * Math.PI) * 10;
    switch (t) {
      case 'G': {
        const top = tile(cx, cy - 1) !== 'G';
        ctx.fillStyle = th.dirt; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = th.dirtDark; const h = (cx * 7 + cy * 13) % 5;
        if (L.theme === 'eu') { ctx.fillRect(x, y + 20, T, 2); ctx.fillRect(x + (cy % 2 ? 10 : 28), y, 2, 20); ctx.fillRect(x + (cy % 2 ? 28 : 10), y + 22, 2, 18); }
        else if (L.theme === 'uk') { ctx.fillRect(x + 6 + h * 4, y + 16, 8, 2); ctx.fillRect(x + 22 - h, y + 30, 10, 2); }
        else { ctx.fillRect(x + 6 + h * 3, y + 14 + h, 5, 4); ctx.fillRect(x + 24 - h, y + 28 - h, 6, 4); }
        if (top) {
          ctx.fillStyle = th.top; ctx.fillRect(x, y, T, 12);
          ctx.fillStyle = th.topHi; ctx.fillRect(x, y, T, 4);
          if (L.theme === 'india') { ctx.fillStyle = th.top; for (let i = 0; i < 4; i++) ctx.fillRect(x + i * 10 + 3, y + 12, 5, 3 + ((cx + i) % 2) * 3); }
          else if (L.theme === 'uk') { ctx.fillStyle = '#7E858C'; ctx.fillRect(x + 19, y + 4, 2, 8); }
          else { ctx.fillStyle = th.dirtDark; ctx.fillRect(x + 13, y + 4, 2, 8); ctx.fillRect(x + 29, y + 4, 2, 8); }
        }
        break;
      }
      case 'B':
        ctx.fillStyle = th.brick; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = th.mortar;
        ctx.fillRect(x, y + 19, T, 2); ctx.fillRect(x, y + T - 2, T, 2); ctx.fillRect(x, y, T, 2);
        ctx.fillRect(x + 19, y, 2, 19); ctx.fillRect(x + 8, y + 21, 2, 19); ctx.fillRect(x + 30, y + 21, 2, 19);
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + 2, y + 2, 16, 3);
        break;
      case 'Q': {
        const pulse = 0.5 + Math.sin(frameT * 5 + cx) * 0.5;
        ctx.fillStyle = C.ink; rr(x + 1, y + 1, T - 2, T - 2, 6); ctx.fill();
        ctx.fillStyle = C.yellow; rr(x + 4, y + 4, T - 8, T - 8, 4); ctx.fill();
        ctx.fillStyle = `rgba(195,255,102,${0.35 + pulse * 0.45})`; ctx.fillRect(x + 4, y + 4, T - 8, 5);
        drawLogo(ctx, LOGO.icon, x + T / 2, y + T / 2, 25);
        break;
      }
      case 'U':
        ctx.fillStyle = C.ink; rr(x + 1, y + 1, T - 2, T - 2, 6); ctx.fill();
        ctx.fillStyle = '#B9A880'; rr(x + 4, y + 4, T - 8, T - 8, 4); ctx.fill();
        ctx.fillStyle = C.ink; [[9, 9], [27, 9], [9, 27], [27, 27]].forEach(([a, b2]) => ctx.fillRect(x + a, y + b2, 4, 4));
        break;
      case 'S':
        ctx.fillStyle = C.steelDark; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = C.steel; ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
        ctx.fillStyle = '#C9D0D6'; ctx.fillRect(x + 2, y + 2, T - 4, 4);
        ctx.fillStyle = C.steelDark; [[7, 11], [29, 11], [7, 29], [29, 29]].forEach(([a, b2]) => { ctx.beginPath(); ctx.arc(x + a, y + b2, 2.5, 0, TAU); ctx.fill(); });
        break;
      case 'X': {
        // paperwork barrier: stacked files with red "MISSING" tape
        ctx.fillStyle = '#F4F1E6'; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = '#D9D3C0'; for (let k = 0; k < 5; k++) ctx.fillRect(x + 2, y + 4 + k * 7, T - 4, 2);
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, T, T); ctx.clip();
        ctx.strokeStyle = '#E74C3C'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x - 4, y + T); ctx.lineTo(x + T + 4, y); ctx.stroke(); ctx.restore();
        ctx.strokeStyle = '#8E1F14'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
        if (cy % 3 === 0) { ctx.fillStyle = '#000'; ctx.font = '800 7px Poppins, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MISSING', x + T / 2, y + T / 2 + 3); }
        break;
      }
      case 'K': {
        // regulatory warning sign
        const sx = x + T / 2, sy = y + 6;
        ctx.fillStyle = '#555'; ctx.fillRect(sx - 2, sy + 22, 4, 12);
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(sx, sy - 2); ctx.lineTo(sx + 17, sy + 26); ctx.lineTo(sx - 17, sy + 26); ctx.fill();
        ctx.fillStyle = '#FFC300'; ctx.beginPath(); ctx.moveTo(sx, sy + 3); ctx.lineTo(sx + 13, sy + 23); ctx.lineTo(sx - 13, sy + 23); ctx.fill();
        ctx.fillStyle = '#000'; ctx.fillRect(sx - 1.5, sy + 9, 3, 8); ctx.fillRect(sx - 1.5, sy + 19, 3, 2.5);
        break;
      }
    }
  }
}
function drawPipes() {
  pipes.forEach(pp => {
    const x = pp.x * T, top = (11 - pp.h) * T, w = 2 * T;
    if (x > camX + VW + 100 || x + w < camX - 100) return;
    ctx.fillStyle = C.pipeDark; ctx.fillRect(x + 4, top + 16, w - 8, pp.h * T - 16);
    ctx.fillStyle = C.pipe; ctx.fillRect(x + 8, top + 16, w - 20, pp.h * T - 16);
    ctx.fillStyle = C.pipeHi; ctx.fillRect(x + 14, top + 16, 8, pp.h * T - 16);
    ctx.fillStyle = C.pipeDark; for (let yy = top + 46; yy < 11 * T - 10; yy += 34) ctx.fillRect(x + 4, yy, w - 8, 4);
    ctx.fillStyle = C.ink; rr(x - 2, top - 2, w + 4, 22, 5); ctx.fill();
    ctx.fillStyle = C.pipe; rr(x, top, w, 18, 4); ctx.fill();
    ctx.fillStyle = C.green; ctx.fillRect(x, top + 12, w, 4);
  });
}
function drawGates() {
  gates.forEach(g => {
    const x = g.col * T;
    if (x > camX + VW + 200 || x < camX - 200) return;
    const timed = g.kind === 'timed';
    const closedCells = []; for (let cy = 0; cy < ROWS; cy++) { const t = grid[cy][g.col]; if (t === 'C' || t === 'D') closedCells.push(cy); }
    // pillars
    ctx.fillStyle = '#000'; ctx.fillRect(x - 12, 2 * T - 10, 10, 9 * T + 10); ctx.fillRect(x + T + 2, 2 * T - 10, 10, 9 * T + 10);
    ctx.fillStyle = timed ? C.yellow : C.green; ctx.fillRect(x - 10, 2 * T - 8, 6, 9 * T + 8); ctx.fillRect(x + T + 4, 2 * T - 8, 6, 9 * T + 8);
    // barrier bars
    closedCells.forEach(cy => {
      const y = cy * T;
      ctx.fillStyle = timed ? 'rgba(254,234,153,0.85)' : 'rgba(195,255,102,0.55)'; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = '#000'; ctx.fillRect(x + 6, y, 4, T); ctx.fillRect(x + 18, y, 4, T); ctx.fillRect(x + 30, y, 4, T);
    });
    if (g.open && g.anim > 0) { ctx.fillStyle = `rgba(195,255,102,${g.anim})`; ctx.fillRect(x - 10, 2 * T, T + 20, 9 * T); }
    // sign plate with required documents
    const plateW = 230, px = x + T / 2 - plateW / 2, py = 5 * T + 6;
    ctx.fillStyle = '#000'; rr(px - 3, py - 3, plateW + 6, 62, 10); ctx.fill();
    ctx.fillStyle = g.open ? C.green : '#FFFFFF'; rr(px, py, plateW, 56, 8); ctx.fill();
    ctx.fillStyle = '#000'; ctx.font = '800 10px Poppins, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(timed ? (g.passed ? '✓ PASSED' : g.open ? 'GATE OPEN' : g.label) : (g.open ? '✓ CLEARED' : g.label), x + T / 2, py + 16, plateW - 12);
    ctx.font = '600 9px Poppins, sans-serif';
    if (timed) ctx.fillText(g.open ? (g.passed ? 'Well done!' : 'GO GO GO!') : 'Step on the switch, then run!', x + T / 2, py + 36);
    else {
      const parts = g.needs.map(d => (docsGot.has(d) ? '✓ ' : '○ ') + DOCS[d].t);
      const line1 = parts.slice(0, 2).join('   '), line2 = parts.slice(2).join('   ');
      ctx.fillText(line1, x + T / 2, py + 33, plateW - 10); if (line2) ctx.fillText(line2, x + T / 2, py + 47, plateW - 10);
    }
    if (!timed) drawLogo(ctx, LOGO.icon, px + 4, py + 2, 18);
  });
}
function drawSwitches() {
  switches.forEach(sw => {
    const x = sw.col * T, y = 11 * T;
    const g = sw.gate, active = g.open && !g.passed;
    ctx.fillStyle = '#000'; rr(x + 4, y - 10, T - 8, 12, 4); ctx.fill();
    ctx.fillStyle = g.passed ? C.green : active ? C.yellow : '#E74C3C'; rr(x + 7, y - (active ? 6 : 9), T - 14, 7, 3); ctx.fill();
    ctx.fillStyle = '#000'; ctx.font = '800 9px Poppins, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SWITCH', x + T / 2, y - 16);
  });
}
function drawPlatforms() {
  platforms.forEach(p => {
    if (p.x > camX + VW + 50 || p.x + p.w < camX - 50) return;
    ctx.fillStyle = '#000'; rr(p.x - 1, p.y - 1, p.w + 2, p.h + 2, 5); ctx.fill();
    ctx.fillStyle = C.purple; rr(p.x + 1, p.y + 1, p.w - 2, p.h - 2, 4); ctx.fill();
    ctx.fillStyle = C.green; ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let k = 10; k < p.w - 6; k += 16) { ctx.beginPath(); ctx.moveTo(k + p.x, p.y + 12); ctx.lineTo(k + p.x + 4, p.y + 7); ctx.lineTo(k + p.x + 8, p.y + 12); ctx.fill(); }
  });
}
function drawSigns() {
  signs.forEach(s => {
    const x = s.x, y = 11 * T;
    if (x > camX + VW + 120 || x < camX - 200) return;
    ctx.fillStyle = '#7a5230'; ctx.fillRect(x + 22, y - 46, 6, 46);
    ctx.font = '700 11px Poppins, sans-serif';
    const tw = ctx.measureText(s.text).width + 18;
    ctx.fillStyle = C.ink; rr(x + 25 - tw / 2 - 2, y - 72, tw + 4, 30, 6); ctx.fill();
    ctx.fillStyle = C.yellow; rr(x + 25 - tw / 2, y - 70, tw, 26, 5); ctx.fill();
    ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.fillText(s.text, x + 25, y - 52);
  });
}
function drawFinish() {
  if (!finish) return;
  const x = finish.x, base = 11 * T;
  if (x > camX + VW + 400 || x < camX - 600) return;
  if (finish.kind === 'gateway') {
    // International Export Gateway: a grand arch
    ctx.fillStyle = '#000'; ctx.fillRect(x - 84, base - 264, 248, 264);
    ctx.fillStyle = '#E8C99A'; ctx.fillRect(x - 80, base - 260, 240, 260);
    ctx.fillStyle = '#D2A86E'; ctx.fillRect(x - 80, base - 260, 240, 34);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(x - 10, base); ctx.lineTo(x - 10, base - 130); ctx.arc(x + 40, base - 130, 50, Math.PI, 0); ctx.lineTo(x + 90, base); ctx.fill();
    ctx.fillStyle = '#FFE9B8'; ctx.beginPath(); ctx.moveTo(x - 4, base); ctx.lineTo(x - 4, base - 130); ctx.arc(x + 40, base - 130, 44, Math.PI, 0); ctx.lineTo(x + 84, base); ctx.fill();
    [x - 70, x + 120].forEach(mx => { ctx.fillStyle = '#D2A86E'; ctx.fillRect(mx, base - 320, 30, 60); ctx.beginPath(); ctx.arc(mx + 15, base - 320, 15, Math.PI, 0); ctx.fill(); });
    ctx.fillStyle = '#000'; ctx.font = '800 13px Poppins, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('INTERNATIONAL', x + 40, base - 244); ctx.fillText('EXPORT GATEWAY', x + 40, base - 230);
    drawPlane(ctx, x + 40, base - 190, -0.2, 1.4);
    drawWavingFlag(ctx, 'IN', x - 78, base - 214, 54, 36, frameT); drawWavingFlag(ctx, 'GB', x + 104, base - 214, 54, 36, frameT);
  } else if (finish.kind === 'border') {
    // EU border gateway
    ctx.fillStyle = '#000'; ctx.fillRect(x - 64, base - 230, 208, 34);
    ctx.fillStyle = '#003399'; ctx.fillRect(x - 60, base - 226, 200, 26);
    ctx.fillStyle = '#FFCC00'; ctx.font = '800 13px Poppins, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('EU BORDER GATEWAY', x + 40, base - 208);
    [x - 60, x + 120].forEach(px => { ctx.fillStyle = '#000'; ctx.fillRect(px - 2, base - 200, 24, 200); ctx.fillStyle = '#E5E5E5'; ctx.fillRect(px, base - 200, 20, 200); });
    ctx.save(); ctx.translate(x + 140, base - 70); ctx.rotate(-0.6);
    for (let k = 0; k < 8; k++) { ctx.fillStyle = k % 2 ? '#fff' : '#E74C3C'; ctx.fillRect(-k * 18 - 18, -4, 18, 8); } ctx.restore();
    drawWavingFlag(ctx, 'EU', x + 4, base - 190, 72, 48, frameT); drawWavingFlag(ctx, 'GB', x - 40, base - 120, 48, 32, frameT);
    ctx.fillStyle = '#fff'; rr(x + 2, base - 128, 76, 40, 6); ctx.fill(); ctx.fillStyle = '#003399'; ctx.font = '800 10px Poppins, sans-serif'; ctx.fillText('WELCOME', x + 40, base - 110); ctx.fillText('TO THE EU', x + 40, base - 97);
  } else {
    // Global Market Success portal
    const cx = x + 60, cy = base - 150, r = 110;
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, r + 40); g.addColorStop(0, 'rgba(195,255,102,0.9)'); g.addColorStop(1, 'rgba(195,255,102,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r + 40, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0d2c4a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    ctx.translate(cx - r, cy - r);
    const v = { cx: 40, cy: 25, span: 160 };
    drawMap(ctx, r * 2, r * 2, v, { hl: { IN: 1, GB: 1, EU: 1 } });
    ctx.restore();
    ctx.strokeStyle = C.green; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#000'; rr(cx - 120, base - 330, 240, 52, 10); ctx.fill();
    drawLogo(ctx, LOGO.wordWhite, cx, base - 312, 150);
    ctx.fillStyle = C.green; ctx.font = '800 11px Poppins, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('GLOBAL MARKET SUCCESS', cx, base - 286);
    ctx.fillStyle = '#000'; ctx.fillRect(cx - 50, base - 20, 100, 20); ctx.fillStyle = C.green; ctx.fillRect(cx - 50, base - 20, 100, 4);
  }
}

function drawItem(it) {
  if (it.x > camX + VW + 50 || it.x + it.w < camX - 50) return;
  if (it.hidden) {
    if (power.scanner) { ctx.strokeStyle = `rgba(195,255,102,${0.25 + Math.sin(frameT * 6) * 0.15})`; ctx.setLineDash([3, 4]); ctx.strokeRect(it.x, it.baseY, it.w, it.h); ctx.setLineDash([]); }
    return;
  }
  const bob = it.rise > 0 || it.mover || it.type === 'seal' || it.type === 'box' ? 0 : Math.sin(it.t * 3) * 4;
  const x = it.x, y = (it.mover || it.rise > 0 ? it.y : it.baseY) + bob, cx = x + it.w / 2, cy = y + it.h / 2;
  if (it.type === 'seal') drawSeal(cx, cy, Math.cos(it.t * 4));
  else if (it.type === 'box') drawPackage(ctx, cx, cy + 2, 1.25);
  else if (it.type === 'canister') drawCanister(x, y, it.t);
  else if (it.type === 'badge') drawBadge(cx, cy, it.t);
  else if (it.type === 'life') drawHeart(cx, cy, 13, '1UP');
  else if (it.type === 'doc') drawDoc(x, y, it);
}
function drawSeal(cx, cy, spin) {
  const sx = Math.max(0.25, Math.abs(spin));
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sx, 1);
  if (!drawLogo(ctx, LOGO.icon, 0, 0, 25)) { ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill(); ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawDoc(x, y, it) {
  const bonus = DOCS[it.doc].bonus;
  ctx.save();
  ctx.shadowColor = bonus ? C.yellow : '#ffffff'; ctx.shadowBlur = 10 + Math.sin(it.t * 5) * 6;
  ctx.fillStyle = '#000'; rr(x - 1, y - 1, 30, 36, 4); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + 20, y + 1); ctx.lineTo(x + 27, y + 8); ctx.lineTo(x + 27, y + 33); ctx.lineTo(x + 1, y + 33); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#D9D9D9'; ctx.beginPath(); ctx.moveTo(x + 20, y + 1); ctx.lineTo(x + 27, y + 8); ctx.lineTo(x + 20, y + 8); ctx.fill();
  ctx.fillStyle = '#9A9A9A'; for (let k = 0; k < 4; k++) ctx.fillRect(x + 5, y + 12 + k * 4.5, k === 3 ? 10 : 17, 2);
  ctx.fillStyle = bonus ? '#E0A800' : C.purple; ctx.fillRect(x + 1, y + 1, 4, 32);
  drawLogo(ctx, LOGO.icon, x + 20, y + 27, 11);
  if (it.revealed > 0) { ctx.strokeStyle = `rgba(195,255,102,${it.revealed})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + 14, y + 17, 30 - it.revealed * 10, 0, TAU); ctx.stroke(); }
}
function drawCanister(x, y, t) {
  const glow = 0.5 + Math.sin(t * 5) * 0.5;
  ctx.save(); ctx.shadowColor = '#b48cff'; ctx.shadowBlur = 10 + glow * 12;
  ctx.fillStyle = C.ink; rr(x - 1, y + 2, 28, 31, 6); ctx.fill(); ctx.restore();
  ctx.fillStyle = C.purple; rr(x + 1, y + 4, 24, 27, 5); ctx.fill();
  ctx.fillStyle = '#3d2a5c'; ctx.fillRect(x + 1, y + 10, 24, 3); ctx.fillRect(x + 1, y + 24, 24, 3);
  ctx.fillStyle = C.ink; ctx.fillRect(x + 7, y - 1, 12, 6);
  ctx.fillStyle = `rgba(195,255,102,${0.6 + glow * 0.4})`; ctx.fillRect(x + 4, y + 14, 5, 9);
  ctx.save(); ctx.translate(x + 17, y + 18.5); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#FF9F1C'; ctx.fillRect(-5, -5, 10, 10); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.strokeRect(-5, -5, 10, 10); ctx.restore();
  ctx.fillStyle = C.ink; ctx.fillRect(x + 16.2, y + 15, 1.8, 4.2); ctx.fillRect(x + 16.2, y + 20.2, 1.8, 1.6);
}
function drawBadge(cx, cy, t) {
  const r = 15 + Math.sin(t * 6) * 1.5;
  ctx.save(); ctx.shadowColor = C.green; ctx.shadowBlur = 20 + Math.sin(t * 6) * 10;
  ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, TAU); ctx.fill(); ctx.restore();
  drawLogo(ctx, LOGO.icon, cx, cy, r * 2);
  for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1; ctx.fillStyle = i % 2 ? C.yellow : '#fff'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24, 2.4, 0, TAU); ctx.fill(); }
}
function drawHeart(cx, cy, s, label) {
  ctx.fillStyle = '#FF5A5F'; ctx.beginPath(); ctx.moveTo(cx, cy + s);
  ctx.bezierCurveTo(cx - s * 1.6, cy - s * 0.2, cx - s * 0.6, cy - s * 1.3, cx, cy - s * 0.4);
  ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.3, cx + s * 1.6, cy - s * 0.2, cx, cy + s); ctx.fill();
  if (label) { ctx.fillStyle = '#fff'; ctx.font = '800 8px Poppins, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, cx, cy + 3); }
}
function drawEnemy(e) {
  if (!e.alive && e.dead <= 0) return;
  if (e.x > camX + VW + 60 || e.x + e.w < camX - 60) return;
  const x = e.x, y = e.y, w = e.w, h = e.h;
  ctx.save();
  if (!e.alive) { ctx.globalAlpha = Math.max(0, e.dead / 0.6); if (e.flipped) { ctx.translate(x + w / 2, y + h / 2); ctx.scale(1, -1); ctx.translate(-(x + w / 2), -(y + h / 2)); } }
  const dir = e.vx > 0 ? 1 : -1;
  if (e.type === 'blob') {
    // "Red Tape Blob"
    const squash = e.alive ? 1 + Math.sin(e.t * 10) * 0.05 : 0.4, bh = h * squash, by = y + h - bh;
    ctx.fillStyle = '#8E2B22'; ctx.fillRect(x + 4, y + h - 5, 9, 5); ctx.fillRect(x + w - 13, y + h - 5, 9, 5);
    ctx.fillStyle = '#C0392B'; ctx.beginPath(); ctx.ellipse(x + w / 2, by + bh * 0.55, w / 2, bh * 0.55, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(x, by + bh * 0.55 - 1, w, bh * 0.35);
    ctx.fillStyle = '#F5D0C5'; ctx.fillRect(x + 2, by + bh * 0.55, w - 4, 3);
    if (e.alive) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + w / 2 - 6 + dir * 2, by + bh * 0.42, 4.5, 0, TAU); ctx.arc(x + w / 2 + 6 + dir * 2, by + bh * 0.42, 4.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x + w / 2 - 6 + dir * 3.5, by + bh * 0.44, 2.2, 0, TAU); ctx.arc(x + w / 2 + 6 + dir * 3.5, by + bh * 0.44, 2.2, 0, TAU); ctx.fill();
      ctx.fillRect(x + w / 2 - 11, by + bh * 0.22, 8, 2.4); ctx.fillRect(x + w / 2 + 3, by + bh * 0.22, 8, 2.4);
    }
  } else if (e.type === 'bot') {
    const st = Math.sin(e.t * 12) * 2;
    ctx.fillStyle = '#3B4046'; ctx.fillRect(x + 6, y + h - 8 + st, 7, 8 - st); ctx.fillRect(x + w - 13, y + h - 8 - st, 7, 8 + st);
    ctx.fillStyle = '#5A6068'; rr(x + 1, y + 8, w - 2, h - 15, 6); ctx.fill();
    ctx.fillStyle = '#E74C3C'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + 3 + i * 7, y + 9); ctx.lineTo(x + 6.5 + i * 7, y); ctx.lineTo(x + 10 + i * 7, y + 9); ctx.fill(); }
    ctx.fillStyle = '#1b1b1f'; rr(x + 5, y + 13, w - 10, 9, 4); ctx.fill();
    ctx.fillStyle = `rgba(180,140,255,${0.7 + Math.sin(e.t * 8) * 0.3})`; ctx.fillRect(x + w / 2 - 5 + dir * 5, y + 15, 10, 5);
    ctx.fillStyle = '#FF9F1C'; ctx.fillRect(x + 6, y + 25, w - 12, 3);
  } else if (e.type === 'paper') {
    // flying document papers
    const flap = Math.sin(e.t * 14) * 0.25;
    ctx.translate(x + w / 2, y + h / 2); ctx.rotate(flap + dir * 0.1);
    for (let k = 2; k >= 0; k--) {
      ctx.fillStyle = k ? '#E8E8E8' : '#FFFFFF'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(-15 + k * 3, -12 - k * 2, 26, 22); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#A0A0A0'; for (let k = 0; k < 3; k++) ctx.fillRect(-11, -6 + k * 5, 16, 2);
    ctx.fillStyle = '#E74C3C'; ctx.save(); ctx.rotate(-0.3); ctx.fillRect(-14, 1, 26, 6); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = '800 5px Poppins, sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.rotate(-0.3); ctx.fillText('MISSING', -1, 6); ctx.restore();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-4 + dir * 3, -8, 1.8, 0, TAU); ctx.arc(4 + dir * 3, -8, 1.8, 0, TAU); ctx.fill();
  } else if (e.type === 'cloud') {
    ctx.globalAlpha *= 0.92; ctx.fillStyle = '#8D7FA8';
    ctx.beginPath(); ctx.arc(x + 12, y + 18, 12, 0, TAU); ctx.arc(x + 24, y + 11, 13, 0, TAU); ctx.arc(x + 36, y + 18, 11, 0, TAU); ctx.rect(x + 10, y + 16, 28, 14); ctx.fill();
  }
  ctx.restore();
}
function drawGuides() {
  guides.forEach(g => {
    const gx = g.x + 20, gy = g.y + Math.sin(g.t * 2.2) * 6;
    if (gx > camX + VW + 100 || gx < camX - 100) return;
    // glow
    const gr = ctx.createRadialGradient(gx, gy, 4, gx, gy, 46); gr.addColorStop(0, 'rgba(195,255,102,0.55)'); gr.addColorStop(1, 'rgba(195,255,102,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, 46, 0, TAU); ctx.fill();
    // propellers
    ctx.fillStyle = '#000'; ctx.fillRect(gx - 2, gy - 30, 4, 10);
    const sp = Math.abs(Math.sin(g.t * 30)) * 18 + 4;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(gx - sp, gy - 32, sp * 2, 3);
    // body = the Euverify icon
    ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(gx, gy, 22, 0, TAU); ctx.fill();
    drawLogo(ctx, LOGO.icon, gx, gy, 38);
    // little eyes above the tick
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gx - 6, gy - 9, 3, 0, TAU); ctx.arc(gx + 6, gy - 9, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(gx - 6 + player.facing * 0, gy - 9, 1.5, 0, TAU); ctx.arc(gx + 6, gy - 9, 1.5, 0, TAU); ctx.fill();
    // name tag
    ctx.fillStyle = '#000'; rr(gx - 40, gy + 26, 80, 16, 8); ctx.fill();
    ctx.fillStyle = C.green; ctx.font = '800 9px Poppins, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('EUVERIFY GUIDE', gx, gy + 37);
    // speech bubble
    if (g.talking) {
      const text = g.lines[g.line];
      ctx.font = '700 12px Poppins, sans-serif';
      const words = text.split(' '), lines = []; let ln = '';
      words.forEach(w2 => { const test = ln ? ln + ' ' + w2 : w2; if (ctx.measureText(test).width > 200) { lines.push(ln); ln = w2; } else ln = test; });
      lines.push(ln);
      const bw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 20, bh = lines.length * 16 + 14;
      const bx = clamp(gx - bw / 2, camX + 8, camX + VW - bw - 8), by = gy - 44 - bh;
      ctx.fillStyle = '#000'; rr(bx - 2, by - 2, bw + 4, bh + 4, 12); ctx.fill();
      ctx.fillStyle = '#fff'; rr(bx, by, bw, bh, 10); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(gx - 8, by + bh); ctx.lineTo(gx, by + bh + 10); ctx.lineTo(gx + 8, by + bh); ctx.fill();
      ctx.fillStyle = '#000'; ctx.textAlign = 'left'; lines.forEach((l, i) => ctx.fillText(l, bx + 10, by + 20 + i * 16));
    }
  });
}

/* ---------------------------------------------------- the hero (original) */
function drawHero(c, cx, by, o) {
  const s = o.scale || 1, eu = o.costume === 'eu', str = o.strength || 1;
  const move = Math.min(1, Math.abs(o.vx || 0) / 200);
  const swing = o.air ? 0 : Math.sin(o.phase || 0) * move;
  const squat = o.land ? 3 : 0;
  c.save();
  c.translate(cx, by); c.scale(s * (o.facing || 1), s);

  // aura grows with strength
  if (str > 1 || eu || o.glow > 0) {
    const r = 20 + str * 5 + (o.glow > 0 ? o.glow * 20 : 0);
    const g = c.createRadialGradient(0, -22, 2, 0, -22, r);
    g.addColorStop(0, eu ? 'rgba(195,255,102,0.5)' : 'rgba(180,140,255,0.45)');
    g.addColorStop(1, 'rgba(195,255,102,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, -22, r, 0, Math.PI * 2); c.fill();
  }

  const P = eu
    ? { top: '#141414', panel: C.green, pants: '#1E1E1E', shoe: '#000000', sole: C.green, sleeve: '#141414' }
    : { top: '#2BB3A3', panel: '#2BB3A3', pants: '#2F4858', shoe: '#FFFFFF', sole: '#8A949C', sleeve: '#2BB3A3' };
  const bulk = (str - 1) * 0.9;           // shoulders & arms widen with strength
  const tw = 9 + bulk * 0.6;              // half torso width

  // cape (Euverify costume)
  if (eu) {
    const flap = Math.sin((o.t || 0) * 9) * 2 + move * 6 + (o.air ? 5 : 0);
    c.fillStyle = C.purple;
    c.beginPath(); c.moveTo(-tw + 2, -31 + squat); c.lineTo(-tw - 9 - flap, -8); c.lineTo(-2, -12); c.lineTo(tw - 3, -31 + squat); c.closePath(); c.fill();
    c.fillStyle = '#4A3270'; c.fillRect(-tw - 6 - flap, -11, 7, 2);
  }

  // back leg + arm
  leg(c, -3 + swing * -5, P, squat, o.air ? -4 : 0);
  arm(c, -tw + 1, swing * 6, P, bulk, squat, '#d9a964');

  // torso
  c.fillStyle = '#000'; rrc(c, -tw - 1, -33 + squat, tw * 2 + 2, 20, 5); c.fill();
  c.fillStyle = P.top; rrc(c, -tw, -32 + squat, tw * 2, 18, 4); c.fill();
  if (eu) {
    // green shirt panel with brand
    c.fillStyle = P.panel;
    c.fillRect(-tw, -32 + squat, tw * 2, 1.8);                       // green collar
    if (ready(LOGO.wordWhite) && o.showText) {
      // real Euverify wordmark across the chest (close-ups)
      c.save(); if ((o.facing || 1) < 0) c.scale(-1, 1);
      const armW = 4.5 + bulk;
      drawLogo(c, LOGO.wordWhite, -armW / 2 + 0.5, -24 + squat, tw * 2 - armW - 1);
      c.restore();
    } else if (ready(LOGO.icon)) {
      // Euverify tick badge on the chest (in game)
      c.save(); if ((o.facing || 1) < 0) c.scale(-1, 1);
      c.fillStyle = C.green; c.beginPath(); c.arc(0.5, -24 + squat, 5.6, 0, Math.PI * 2); c.fill();
      drawLogo(c, LOGO.icon, 0.5, -24 + squat, 10);
      c.restore();
    } else if (o.showText) { rrc(c, -tw + 1.5, -30 + squat, tw * 2 - 3, 14, 2); c.fill();
      c.fillStyle = '#000'; c.font = '800 3.3px Poppins, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.save(); if ((o.facing || 1) < 0) c.scale(-1, 1); const tW = c.measureText('EUVERIFY').width, room = tw * 2 - 4; c.translate(0, -23 + squat); if (tW > room) c.scale(room / tW, room / tW); c.fillText('EUVERIFY', 0, 0); c.restore(); c.textBaseline = 'alphabetic';
    } else {
      c.fillRect(-4.5, -32 + squat, 9, 18);
      c.fillStyle = '#000'; const ex = -2.6, ey = -27 + squat;
      c.fillRect(ex, ey, 1.4, 8); c.fillRect(ex, ey, 5, 1.4); c.fillRect(ex, ey + 3.3, 4, 1.4); c.fillRect(ex, ey + 6.6, 5, 1.4);
    }
    c.fillStyle = C.green; c.fillRect(-tw, -16 + squat, tw * 2, 2.4); // belt
  } else {
    c.fillStyle = '#1F8F83'; c.fillRect(-6, -21 + squat, 12, 5);  // hoodie pocket
    c.fillStyle = '#FFFFFF'; c.fillRect(-1, -32 + squat, 2, 6);    // drawstring
    c.fillStyle = '#FF8A00'; c.fillRect(-tw, -16 + squat, tw * 2, 2.4);
  }

  // front leg
  leg(c, 3 + swing * 5, P, squat, o.air ? 3 : 0);

  // head
  c.fillStyle = '#000'; c.beginPath(); c.arc(1, -40 + squat, 10, 0, Math.PI * 2); c.fill();
  c.fillStyle = C.skin; c.beginPath(); c.arc(1, -40 + squat, 9, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#E3A869'; c.beginPath(); c.arc(8.5, -38 + squat, 2.2, 0, Math.PI * 2); c.fill();   // nose
  c.fillStyle = '#000'; c.beginPath(); c.ellipse(4.5, -41.5 + squat, 1.4, 2.2, 0, 0, Math.PI * 2); c.fill(); // eye
  c.strokeStyle = '#000'; c.lineWidth = 1.2; c.beginPath(); c.arc(4, -36.5 + squat, 3, 0.15 * Math.PI, 0.8 * Math.PI); c.stroke(); // smile
  if (eu || str >= 3) { c.strokeStyle = '#000'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(2.5, -45 + squat); c.lineTo(7, -44 + squat); c.stroke(); } // determined brow

  if (eu) {
    // swept hair + green headband + earpiece
    c.fillStyle = C.hair; c.beginPath(); c.arc(0, -43 + squat, 9, Math.PI * 1.05, Math.PI * 1.95); c.fill();
    c.beginPath(); c.moveTo(-9, -44 + squat); c.lineTo(-13, -49 + squat); c.lineTo(-4, -48 + squat); c.fill();
    c.fillStyle = C.green; c.fillRect(-9, -46 + squat, 19, 3);
    c.fillStyle = '#000'; c.fillRect(-4, -41 + squat, 3, 5);
  } else {
    // orange safety helmet
    c.fillStyle = '#000'; c.beginPath(); c.arc(0, -44 + squat, 10.5, Math.PI, 0); c.fill();
    c.fillStyle = '#FF8A00'; c.beginPath(); c.arc(0, -44 + squat, 9.3, Math.PI, 0); c.fill();
    c.fillStyle = '#000'; rrc(c, -11, -45 + squat, 25, 4, 2); c.fill();
    c.fillStyle = '#FFB347'; rrc(c, -10, -44.3 + squat, 23, 2.4, 1); c.fill();
    c.fillStyle = '#FFFFFF'; c.fillRect(-1.5, -53 + squat, 3, 8);
    c.fillStyle = C.hair; c.fillRect(-9, -43 + squat, 4, 4);
  }

  // front arm
  arm(c, tw - 1, -swing * 6, P, bulk, squat, C.skin);
  c.restore();

  function leg(cc, lx, P2, sq, lift) {
    cc.fillStyle = '#000'; cc.fillRect(lx - 3.5, -15 + sq, 7, 11 - lift);
    cc.fillStyle = P2.pants; cc.fillRect(lx - 2.5, -15 + sq, 5, 10 - lift);
    cc.fillStyle = '#000'; rrc(cc, lx - 4, -6 - lift, 10, 6, 2); cc.fill();
    cc.fillStyle = P2.shoe; rrc(cc, lx - 3, -5.5 - lift, 8, 4, 1.5); cc.fill();
    cc.fillStyle = P2.sole; cc.fillRect(lx - 3, -2 - lift, 8.5, 1.6);
  }
  function arm(cc, ax, sw, P2, bk, sq, hand) {
    const aw = 4.5 + bk;
    cc.save(); cc.translate(ax, -30 + sq); cc.rotate(sw * 0.12 + (o.air ? -0.9 : 0));
    cc.fillStyle = '#000'; rrc(cc, -aw / 2 - 1, -1, aw + 2, 13, 3); cc.fill();
    cc.fillStyle = P2.sleeve; rrc(cc, -aw / 2, 0, aw, 9, 2.5); cc.fill();
    cc.fillStyle = C.skin; cc.beginPath(); cc.arc(0, 11, aw / 2 + 0.6, 0, Math.PI * 2); cc.fill();
    cc.restore();
  }
}
function rrc(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }


function drawPlayerInWorld() {
  const p = player;
  if (state !== 'dead' && p.inv > 0 && Math.floor(p.inv * 14) % 2 === 0) return;
  let costume = power.costume ? 'eu' : 'classic';
  if (state === 'transform') {
    costume = Math.floor(transformT * 12) % 2 ? 'eu' : 'classic';
    if (power.scanner && power.costume) costume = 'eu';
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = C.green; ctx.lineWidth = 4;
    const r = (1.35 - transformT) * 120;
    ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, r * 0.6, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  drawHero(ctx, p.x + p.w / 2, p.y + p.h + 0.5, {
    costume, facing: p.facing, phase: p.phase, vx: p.vx, air: !p.onGround && state !== 'dead', strength: p.strength,
    glow: Math.max(p.glow, state === 'transform' ? 1 : 0), t: frameT, land: p.landT > 0, scale: 0.95
  });
  // compliance shield bubble
  if (power.shield && power.shieldReady && state === 'play') {
    ctx.strokeStyle = `rgba(195,255,102,${0.45 + Math.sin(frameT * 4) * 0.2})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2 - 6, 26, 34, 0, 0, TAU); ctx.stroke();
  }
}
function drawParticles() {
  particles.forEach(p => {
    const a = Math.max(0, p.life / p.max);
    if (p.color === 'seal') { ctx.save(); ctx.globalAlpha = a; drawSeal(p.x, p.y, Math.cos(p.life * 30)); ctx.restore(); return; }
    if (p.color === 'scan') { ctx.strokeStyle = `rgba(195,255,102,${a * 0.8})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, (1 - a) * 8 * T, 0, TAU); ctx.stroke(); return; }
    ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.globalAlpha = 1;
}
function drawPopups() {
  popups.forEach(p => {
    ctx.globalAlpha = 1 - p.t;
    ctx.font = p.big ? '800 14px Poppins, sans-serif' : '700 13px Poppins, sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.strokeText(p.text, p.x, p.y - p.t * 40);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y - p.t * 40);
  });
  ctx.globalAlpha = 1;
}
function drawPortrait(cv, costume, strength) {
  const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
  drawHero(c, cv.width / 2, cv.height * 0.95, { costume, facing: 1, strength, scale: cv.height / 58, showText: true, t: 0 });
}

/* ================================================================== HUD */
let last = {};
function updateHUD(force) {
  if (!player || !L) return;
  const got = [...docsGot].filter(d => !DOCS[d].bonus).length;
  const v = { lv: levelIdx, s: score, l: lives, h: player.hearts, st: player.strength, d: got + '/' + levelDocs(), t: Math.ceil(levelTime), co: power.costume,
    pw: [power.shield ? (power.shieldReady ? 2 : 1) : 0, power.docPower, power.scanner, power.boost].join(), pr: Math.round(player.x / (COLS * T) * 200) };
  if (!force && JSON.stringify(v) === JSON.stringify(last)) return;
  if (force || v.lv !== last.lv) { setFlagCanvas($('hudFlag'), L.key); $('hudLevelNo').textContent = 'LEVEL ' + (levelIdx + 1); $('hudCountry').textContent = L.name; }
  $('hudScore').textContent = String(v.s).padStart(6, '0');
  $('hudLives').textContent = '×' + Math.max(0, v.l);
  $('hudHearts').textContent = '♥'.repeat(Math.max(0, v.h)) + '♡'.repeat(Math.max(0, 3 - v.h));
  if (force || v.st !== last.st) $('hudStrength').innerHTML = Array.from({ length: MAX_STR }, (_, i) => `<i class="${i < v.st ? 'on' : ''}${v.st === MAX_STR && i < v.st ? ' max' : ''}"></i>`).join('');
  $('hudDocs').textContent = v.d;
  $('hudTime').textContent = v.t;
  if (force || v.pw !== last.pw || v.co !== last.co) {
    $('hudPower').innerHTML = !power.costume ? '<i>OFF</i>' :
      `<i class="${power.shieldReady ? 'on' : 'wait'}">SHIELD</i><i class="on">DOCS</i>${power.scanner ? '<i class="on">SCAN</i>' : ''}${power.boost ? '<i class="on">BOOST</i>' : ''}`;
  }
  if (force || v.co !== last.co || v.st !== last.st) drawPortrait($('portrait'), power.costume ? 'eu' : 'classic', v.st);
  $('hudProgress').style.width = clamp(v.pr / 2, 0, 100) + '%';
  last = v;
}

/* ============================================================== SCREENS */
const SCREENS = ['startScreen', 'howScreen', 'aboutScreen', 'pauseScreen', 'overScreen'];
function show(id) { SCREENS.forEach(s => $(s).hidden = s !== id); }
function hideScreens() { SCREENS.forEach(s => $(s).hidden = true); }
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) $('shell').classList.add('touch-on');

function newGame() {
  Sound.init(); if (isTouch) tryFullscreen();
  score = 0; lives = 3; power = freshPower(); player = null;
  $('finalScreen').hidden = true;
  startCine('intro');
}
function beginLevel(i) {
  loadLevel(i, false);
  hideScreens(); $('hud').hidden = false; $('touch').hidden = !isTouch; $('finalScreen').hidden = true;
  state = 'play'; jumpPressed = false; jumpReleased = false;
  Sound.startMusic(L.tune);
  setFlagCanvas($('welcomeFlag'), L.key);
  $('welcomeText').textContent = L.welcome; $('welcomeSub').textContent = L.welcomeSub;
  const w = $('welcome'); w.hidden = true; void w.offsetWidth; w.hidden = false;
  setTimeout(() => { w.hidden = true; }, 2900);
  updateHUD(true);
}
function retryLevel() {
  if (levelStart) { score = levelStart.score; lives = Math.max(3, levelStart.lives); power = JSON.parse(JSON.stringify(levelStart.power)); }
  const keepStr = levelStart ? { strength: levelStart.strength, cans: levelStart.cans } : null;
  player = null;
  loadLevel(levelIdx, true);
  if (keepStr) Object.assign(player, keepStr);
  hideScreens(); $('hud').hidden = false; $('touch').hidden = !isTouch;
  state = 'play'; Sound.startMusic(L.tune); updateHUD(true);
  showStory(L.welcomeSub);
}
function toMenu() {
  state = 'menu'; Sound.stopMusic(); clearInfo(); cine = null;
  ['hud', 'touch', 'banner', 'finalScreen', 'mapCaption', 'btnSkip', 'welcome'].forEach(id => $(id).hidden = true);
  show('startScreen');
}
function togglePause() {
  if (state === 'play') { state = 'paused'; Sound.stopMusic(); show('pauseScreen'); }
  else if (state === 'paused') { state = 'play'; hideScreens(); Sound.startMusic(L.tune); }
}
function toggleMusic() { Sound.init(); const on = Sound.toggle(); $('btnMusic').classList.toggle('off', !on); if (on && state === 'play') Sound.startMusic(L.tune); else Sound.stopMusic(); }

$('btnStart').onclick = newGame; $('btnHowPlay').onclick = newGame; $('btnAboutPlay').onclick = newGame;
$('btnHow').onclick = () => show('howScreen'); $('btnHowBack').onclick = () => show('startScreen');
$('btnAbout').onclick = () => show('aboutScreen'); $('btnAboutBack').onclick = () => show('startScreen');
$('btnResume').onclick = togglePause; $('btnPauseRetry').onclick = retryLevel; $('btnPauseMenu').onclick = toMenu;
$('btnRetry').onclick = retryLevel; $('btnOverMenu').onclick = toMenu;
$('btnPlayAgain').onclick = newGame;
$('btnClaimWin').onclick = () => openClaim(10);
$('btnClaimOver').onclick = () => openClaim(5);
$('btnClaimCancel').onclick = closeClaim;
$('btnClaimDone').onclick = closeClaim;
$('claimForm').addEventListener('submit', submitClaim);
['claimCompany', 'claimCategory', 'claimEmail', 'claimConsent'].forEach(id => $(id).addEventListener('input', () => { $('claimErr').textContent = ''; }));
$('btnPause').onclick = togglePause; $('btnMusic').onclick = toggleMusic;
$('btnSkip').onclick = skipCine;
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });

/* ------------------------------------------------------- discount claims */
// Winners (reached Global Market Success) get 10%, everyone who plays gets 5%.
// Entries are saved to the artifact's shared database (collection "leads"),
// readable only by the owner and editors.
let claim = null, dbPromise = null;
// Self-hosted copy only: paste a form endpoint (e.g. a Google Apps Script web app or Formspree URL)
// to receive entries as JSON. Leave empty on the claude.ai link, which saves to its own private list.
const LEAD_ENDPOINT = '';
function getDb() {
  if (!dbPromise) dbPromise = (window.claude && window.claude.use) ? window.claude.use('db').catch(() => null) : Promise.resolve(null);
  return dbPromise;
}
function claimCode(pct) {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = ''; const buf = new Uint32Array(6); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(buf) : buf.forEach((_, i) => buf[i] = Math.random() * 1e9);
  buf.forEach(n => r += A[n % A.length]);
  return 'EV' + (pct === 10 ? 'W10' : 'P05') + '-' + r;
}
function openClaim(pct) {
  claim = { pct, code: claimCode(pct), from: state };
  $('claimPct').textContent = pct + '%';
  $('claimWho').textContent = pct === 10 ? 'Winner reward' : 'Thanks for playing';
  $('claimLead').textContent = pct === 10
    ? 'You reached Global Market Success! Claim 10% off your first year of any Euverify plan.'
    : 'Every player gets 5% off their first year of any Euverify plan.';
  $('claimForm').reset(); $('claimErr').textContent = '';
  $('claimForm').hidden = false; $('claimDoneBox').hidden = true;
  $('btnClaimSubmit').disabled = false; $('btnClaimSubmit').textContent = 'Claim my ' + pct + '% discount';
  $('claimScreen').hidden = false;
  setTimeout(() => $('claimCompany').focus(), 50);
}
function closeClaim() { $('claimScreen').hidden = true; claim = null; }
async function submitClaim(e) {
  e.preventDefault();
  if (!claim) return;
  const company = $('claimCompany').value.trim(), category = $('claimCategory').value, email = $('claimEmail').value.trim();
  const err = $('claimErr');
  if (!company) { err.textContent = 'Enter your company name.'; $('claimCompany').focus(); return; }
  if (!category) { err.textContent = 'Choose a product category.'; $('claimCategory').focus(); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = 'Enter a valid email address, like name@company.com.'; $('claimEmail').focus(); return; }
  if (!$('claimConsent').checked) { err.textContent = 'Tick the box so we can email your discount.'; return; }
  err.textContent = '';
  const btn = $('btnClaimSubmit'); btn.disabled = true; btn.textContent = 'Saving…';
  const entry = {
    company: company.slice(0, 120), category, email: email.slice(0, 160), discount: claim.pct, code: claim.code,
    result: claim.pct === 10 ? 'Completed game' : 'Played', score, levelReached: (LEVELS[levelIdx] || {}).name || '',
    consent: true, createdAt: new Date().toISOString(), source: 'Euverify Global Market Adventure'
  };
  let saved = false;
  try {
    const db = await getDb();
    if (db) {
      try { await db.collection('leads').add(entry); saved = true; }
      catch (x) { if (x && x.code === 'unavailable') { await new Promise(r => setTimeout(r, 600 + Math.random() * 600)); await db.collection('leads').add(entry); saved = true; } }
    }
  } catch (x) { saved = false; }
  if (!saved && LEAD_ENDPOINT) {
    try { const r = await fetch(LEAD_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(entry) }); saved = r.ok; } catch (x) { saved = false; }
  }
  $('claimForm').hidden = true; $('claimDoneBox').hidden = false;
  $('claimCode').textContent = claim.code;
  $('claimDonePct').textContent = claim.pct + '% off your first year';
  $('claimDoneMsg').textContent = saved
    ? 'Thanks, ' + company + '! Your details are saved. The Euverify team will email your discount to ' + email + '.'
    : 'We couldn\u2019t save your details on this device. Show this screen to the Euverify team and we\u2019ll register your discount.';
  Sound.coin();
}

/* --------------------------------------------------------- phone support */
/* ------------------------------------------------ full screen, every browser
   Browsers only allow full screen from a tap or key press, so the game asks for it
   on the first tap anywhere (and again on Start / Play again).
   - Chrome, Edge, Samsung Internet, Firefox, Opera (Android & desktop): standard API.
   - Safari on Mac and iPad, older Chrome/Android: webkit-prefixed API.
   - Old Firefox / old Edge & IE: moz / ms prefixed API.
   - Safari on iPhone has no full-screen API for pages: the game fills the screen
     edge to edge, and "Add to Home Screen" runs it full screen like an app. */
const D = document, ROOT = document.documentElement;
const FS = {
  enabled() { return !!(D.fullscreenEnabled || D.webkitFullscreenEnabled || D.mozFullScreenEnabled || D.msFullscreenEnabled || ROOT.webkitRequestFullScreen); },
  element() { return D.fullscreenElement || D.webkitFullscreenElement || D.webkitCurrentFullScreenElement || D.mozFullScreenElement || D.msFullscreenElement || null; },
  request(el) {
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (!fn) return Promise.resolve(false);
    try {
      const r = fn === el.requestFullscreen ? fn.call(el, { navigationUI: 'hide' }) : fn.call(el);
      return Promise.resolve(r).then(() => true, () => false);
    } catch (e) { return Promise.resolve(false); }
  },
  exit() {
    const fn = D.exitFullscreen || D.webkitExitFullscreen || D.webkitCancelFullScreen || D.mozCancelFullScreen || D.msExitFullscreen;
    try { if (fn) Promise.resolve(fn.call(D)).catch(() => {}); } catch (e) {}
  }
};
const isFull = () => !!FS.element();
// iPhone Safari exposes parts of the API but never actually enters full screen, so treat it as unsupported.
const canFull = () => FS.enabled() && !isIPhone;
const isInstalled = () => matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIPhone = /iPhone|iPod/.test(navigator.userAgent);
let wantFull = false;
function lockLandscape() { try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) {} }
function tryFullscreen() {
  wantFull = true;
  if (isInstalled() || isFull() || !canFull()) { lockLandscape(); hideBars(); return Promise.resolve(isFull()); }
  return FS.request(ROOT).then(ok => ok || FS.request($('shell'))).then(ok => { lockLandscape(); setTimeout(fitCanvas, 150); return ok; });
}
// iPhone Safari: nudge the browser bars away where it still allows it (older iOS),
// and keep the game sized to the visible area.
function hideBars() { try { if (window.scrollY < 1) window.scrollTo(0, 1); } catch (e) {} setTimeout(fitCanvas, 300); }
function onFsChange() {
  $('fsPill').hidden = !(isTouch && wantFull && canFull() && !isFull() && $('fsGate').hidden && !isInstalled());
  setTimeout(fitCanvas, 120);
}
['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(ev => D.addEventListener(ev, onFsChange));
$('fsPill').onclick = () => { tryFullscreen().then(onFsChange); };

// The first tap or key press anywhere starts full screen automatically.
function firstGesture() {
  ['touchend', 'click', 'keydown'].forEach(ev => D.removeEventListener(ev, firstGesture, true));
  Sound.init();
  if (isTouch) tryFullscreen().then(gateDone);
}
function gateDone() { $('fsGate').hidden = true; onFsChange(); setTimeout(() => { if (typeof iosPrompt === 'function') iosPrompt(); }, 400); }
['touchend', 'click', 'keydown'].forEach(ev => D.addEventListener(ev, firstGesture, true));

// Phones and tablets open on a one-tap launch screen.
if (isTouch && !isInstalled()) {
  $('fsGate').hidden = false;
  if (!canFull()) {
    $('btnFsGo').textContent = '▶ TAP TO PLAY';
    $('fsNote').textContent = 'Hold your phone sideways';
    $('fsTip').hidden = !isIPhone;
  }
}
$('btnFsGo').onclick = () => { tryFullscreen().then(gateDone); if (!canFull()) gateDone(); };

/* iPhone: no full-screen API, so the page is made scrollable behind the (fixed) game.
   One swipe up scrolls it and Safari tucks its address and tab bars away. */
const iosScroll = isIPhone && !isInstalled() && !canFull();
let iosSkipped = false, iosMaxH = 0, iosShownAt = 0;
function iosLandscape() { return innerWidth > innerHeight; }
function iosBarsLikelyShown() { return window.scrollY < 20 || innerHeight < iosMaxH - 30; }
function iosPrompt() {
  if (!iosScroll || iosSkipped || !$('fsGate').hidden) return;
  const show = iosLandscape() && iosBarsLikelyShown();
  if (show && $('iosSwipe').hidden) iosShownAt = performance.now();
  $('iosSwipe').hidden = !show;
}
if (iosScroll) {
  ROOT.classList.add('ios-scroll');
  $('fsTip').hidden = true;                // the swipe screen carries the tip instead
  window.addEventListener('scroll', () => {
    if (iosLandscape()) iosMaxH = Math.max(iosMaxH, innerHeight);
    if (window.scrollY > 20) $('iosSwipe').hidden = true;
    fitCanvas();
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (iosLandscape()) iosMaxH = Math.max(iosMaxH, innerHeight);
    setTimeout(() => { fitCanvas(); iosPrompt(); }, 250);
  });
  $('btnIosSkip').onclick = () => { if (performance.now() - iosShownAt < 700) return; iosSkipped = true; $('iosSwipe').hidden = true; };
}

// Android/desktop Chrome & Edge: offer "Install app" (runs full screen from the home screen).
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; const b = $('btnInstall'); if (b) b.hidden = false; });
if ($('btnInstall')) $('btnInstall').onclick = () => { if (!installEvt) return; installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; $('btnInstall').hidden = true; }); };
window.addEventListener('appinstalled', () => { const b = $('btnInstall'); if (b) b.hidden = true; });

if (!canFull()) $('btnFull').hidden = true;
$('btnFull').onclick = () => { if (isFull()) FS.exit(); else tryFullscreen(); };
function onResize() { fitCanvas(); if (isTouch && innerHeight > innerWidth && state === 'play') togglePause(); }
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 250));
if (window.ResizeObserver) new ResizeObserver(fitCanvas).observe($('stage'));
fitCanvas();

document.querySelectorAll('[data-flag]').forEach(el => { try { el.style.backgroundImage = 'url(' + flagImage(el.dataset.flag).toDataURL() + ')'; } catch (e) {} });
/* --------------------------------------------- start-screen map preview */
const pv = $('previewMap'), pctx = pv.getContext('2d');
function drawPreview(t) {
  const W = pv.width, H = pv.height, view = { cx: 38, cy: 38, span: 100 };
  const cyc = t % 9;
  const p1 = ease(clamp((cyc - 0.5) / 2.5, 0, 1)), p2 = ease(clamp((cyc - 3.6) / 1.6, 0, 1));
  drawMap(pctx, W, H, view, {
    t, hl: { IN: 1, GB: clamp((cyc - 2.8) / 0.6, 0, 1), EU: clamp((cyc - 5.0) / 0.6, 0, 1) },
    routes: [{ a: 'MUM', b: 'LON', bulge: 0.22, prog: p1 }, { a: 'LON', b: 'BRU', bulge: 0.5, prog: p2 }],
    plane: cyc < 3.2 ? { r: { a: 'MUM', b: 'LON', bulge: 0.22 }, t: p1 } : cyc < 5.4 ? { r: { a: 'LON', b: 'BRU', bulge: 0.5 }, t: p2 } : null,
    planeScale: 0.9,
    pins: [{ at: 'MUM', label: '1 India', below: true }, { at: 'LON', label: '2 UK' }, { at: 'BRU', label: '3 EU', below: true }]
  });
}

/* ============================================================ MAIN LOOP */
let acc = 0, prev = performance.now();
power = freshPower();
loadLevel(0, false); score = 0; lives = 3;
function frame(now) {
  requestAnimationFrame(frame);
  try { step(now); } catch (err) { console.error(err); }
}
function step(now) {
  const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
  if (state === 'menu') {
    frameT += dt; camX += dt * 40; if (camX > 40 * T) camX = 0;
    player.x = camX + 300; player.phase += dt * 12; player.vx = 180; player.onGround = true; player.facing = 1; player.y = 11 * T - 36;
    updatePlatforms(dt); updateParticles(dt);
    if (!$('startScreen').hidden) drawPreview(frameT);
    render();
  } else if (state === 'cine') {
    if (cine) updateCine(dt);
    if (cine) render();
  } else {
    acc += dt;
    while (acc >= 1 / 60) { update(1 / 60); acc -= 1 / 60; }
    render();
  }
}
requestAnimationFrame(frame);

window.EuverifyGlobal = { get state() { return state; }, get player() { return player; }, get level() { return levelIdx; }, get score() { return score; },
  get power() { return power; }, get docs() { return [...docsGot]; }, get gates() { return gates; }, newGame, skip: skipCine, beginLevel };
})();
