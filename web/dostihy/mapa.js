// Mapa kraje: vykresluje data mapy (data/mapa-*.json) na canvas s paralaxou, jezdí po ní holčička na hobbyhorsovi.
// Převzato ze Strážců klýčú: místo hradu je ve startovním městě závodiště se stájí, truhly ukazují obtížnost (dukáty).
// Mapa je obecná: řeky, lesy, kopce, města a cesty mezi nimi jsou jen data; volitelně jde podložit obrázkem
// (pozadi.obrazek, roztažený přes celou mapu).
import { nakresliJezdkyni } from './postava.js';

function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) {
  let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function bodVPolygonu(x, y, body) {
  let uvnitr = false;
  for (let i = 0, j = body.length - 1; i < body.length; j = i++) {
    const [xi, yi] = body[i], [xj, yj] = body[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) uvnitr = !uvnitr;
  }
  return uvnitr;
}
// Hladká křivka přes body (Catmull-Rom → Bézier)
function hladkaCesta(ctx, body, zavrena = false) {
  const n = body.length;
  const p = (i) => body[zavrena ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  ctx.moveTo(body[0][0], body[0][1]);
  const konec = zavrena ? n : n - 1;
  for (let i = 0; i < konec; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (zavrena) ctx.closePath();
}

const STRECHY = ['#c0392b', '#b5482c', '#a93226', '#8e4a2b', '#d35400'];
const ZDI = ['#fdf2dc', '#f7e3c0', '#fff8ec', '#f3d9b1', '#efe6d6'];

export class Mapa {
  constructor(canvas, data, volby) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.d = data;
    this.v = volby; // { naKlepnuti(id), stavMesta(id), vzhled(), hobby() }
    this.cas = 0;
    this.mesta = new Map(data.mesta.map((m) => [m.id, m]));
    this.kamera = { x: 0, y: 0, zoom: 1, priblizeni: 1, sleduj: true };
    this.postava = { x: 0, y: 0, smer: 1, chuze: 0, radost: 0, cesta: null };
    this.priprav();
    this.vstup();
    if (data.pozadi?.obrazek) { this.obr = new Image(); this.obr.src = data.pozadi.obrazek; }
    const start = this.mesta.get(data.start) || data.mesta[0];
    this.postavaNa(start.id);
  }

  priprav() {
    const d = this.d;
    const r = rng(d.id || 'mapa');
    // cesty: mírně prohnuté, navzorkované na lomenou čáru
    this.cesty = [];
    this.sousede = new Map(d.mesta.map((m) => [m.id, []]));
    for (const [a, b, pres] of d.cesty) {
      const A = this.mesta.get(a), B = this.mesta.get(b);
      if (!A || !B) continue;
      const dx = B.x - A.x, dy = B.y - A.y, delka = Math.hypot(dx, dy);
      const ohyb = (r() - 0.5) * 0.3 * delka;
      const kx = (A.x + B.x) / 2 - (dy / delka) * ohyb, ky = (A.y + B.y) / 2 + (dx / delka) * ohyb;
      const body = [];
      const ridici = pres ? [[A.x, A.y], ...pres, [B.x, B.y]] : null;
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        if (ridici) { // lomená přes zadané body
          const seg = Math.min(ridici.length - 2, Math.floor(t * (ridici.length - 1)));
          const lt = t * (ridici.length - 1) - seg;
          body.push([ridici[seg][0] + (ridici[seg + 1][0] - ridici[seg][0]) * lt, ridici[seg][1] + (ridici[seg + 1][1] - ridici[seg][1]) * lt]);
        } else {
          body.push([(1 - t) ** 2 * A.x + 2 * (1 - t) * t * kx + t * t * B.x, (1 - t) ** 2 * A.y + 2 * (1 - t) * t * ky + t * t * B.y]);
        }
      }
      let len = 0;
      for (let i = 1; i < body.length; i++) len += Math.hypot(body[i][0] - body[i - 1][0], body[i][1] - body[i - 1][1]);
      const c = { a, b, body, len };
      this.cesty.push(c);
      this.sousede.get(a).push(c);
      this.sousede.get(b).push(c);
    }
    // stromy v lesích
    this.stromy = [];
    for (const les of d.lesy || []) {
      const xs = les.body.map((p) => p[0]), ys = les.body.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const krok = les.hustota || 34;
      for (let y = y0; y < y1; y += krok * 0.8) {
        for (let x = x0; x < x1; x += krok) {
          const px = x + (r() - 0.5) * krok, py = y + (r() - 0.5) * krok;
          if (!bodVPolygonu(px, py, les.body)) continue;
          if (d.mesta.some((m) => Math.hypot(m.x - px, m.y - py) < 70 + m.velikost * 18)) continue;
          if (this.cesty.some((c) => c.body.some((b) => Math.abs(b[0] - px) < 16 && Math.abs(b[1] - py) < 16))) continue;
          this.stromy.push({ x: px, y: py, v: 18 + r() * 14, jehl: r() < 0.45, odst: r() });
        }
      }
    }
    // osamělé stromy a remízky v polích
    for (let i = 0; i < (d.sirka * d.vyska) / 60000; i++) {
      const px = r() * d.sirka, py = r() * d.vyska;
      if (d.mesta.some((m) => Math.hypot(m.x - px, m.y - py) < 80)) continue;
      if (this.cesty.some((c) => c.body.some((b) => Math.abs(b[0] - px) < 18 && Math.abs(b[1] - py) < 18))) continue;
      const n = 1 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) this.stromy.push({ x: px + (r() - 0.5) * 50, y: py + (r() - 0.5) * 40, v: 16 + r() * 12, jehl: r() < 0.3, odst: r() });
    }
    this.stromy.sort((a, b) => a.y - b.y);
    // pole (barevné záplaty)
    this.pole = [];
    for (let i = 0; i < (d.sirka * d.vyska) / 9000; i++) {
      this.pole.push({ x: r() * d.sirka, y: r() * d.vyska, w: 60 + r() * 140, h: 40 + r() * 90, rot: (r() - 0.5) * 0.9,
        barva: ['#d9e8a0', '#c8df8a', '#e6dc8e', '#b9d98a', '#e8e2a6', '#cfe39b'][Math.floor(r() * 6)] });
    }
    // domky měst
    for (const m of d.mesta) {
      const rr = rng(m.id);
      const pocet = 3 + (m.velikost || 1) * 2;
      m.domy = [];
      for (let i = 0; i < pocet; i++) {
        const a = rr() * Math.PI * 2, vz = (0.3 + rr() * 0.7) * (20 + (m.velikost || 1) * 12);
        m.domy.push({ dx: Math.cos(a) * vz * 1.3, dy: Math.sin(a) * vz * 0.7, w: 16 + rr() * 9, h: 12 + rr() * 8,
          zed: ZDI[Math.floor(rr() * ZDI.length)], strecha: STRECHY[Math.floor(rr() * STRECHY.length)], kostel: false });
      }
      if ((m.velikost || 1) >= 2 && m.id !== d.start) m.domy.push({ dx: 4, dy: -6, w: 18, h: 18, zed: '#fff8ec', strecha: '#5d6d7e', kostel: true });
      if (m.id === d.start) m.domy = m.domy.filter((h) => Math.hypot(h.dx + 10, h.dy + 20) > 95).map((h) => ({ ...h, dx: h.dx * 1.6, dy: h.dy * 1.3 }));
      m.domy.sort((p, q) => p.dy - q.dy);
    }
    // mraky
    this.mraky = [];
    for (let i = 0; i < 14; i++) {
      const kusy = [];
      const n = 4 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) kusy.push([(k - n / 2) * 26 + r() * 10, (r() - 0.5) * 20, 22 + r() * 22]);
      this.mraky.push({ x: r() * d.sirka, y: r() * d.vyska, kusy, rychlost: 6 + r() * 8 });
    }
    this.ptaci = [];
  }

  // ---------- pohyb postavy ----------
  postavaNa(id) {
    const m = this.mesta.get(id);
    this.postava.x = m.x; this.postava.y = m.y; this.postava.mesto = id; this.postava.cesta = null;
    this.kamera.x = m.x; this.kamera.y = m.y - 40;
  }

  najdiCestu(z, kam) {
    const dist = new Map([[z, 0]]), pred = new Map(), hotovo = new Set();
    while (true) {
      let u = null, best = Infinity;
      for (const [k, v] of dist) if (!hotovo.has(k) && v < best) { best = v; u = k; }
      if (u === null) return null;
      if (u === kam) break;
      hotovo.add(u);
      for (const c of this.sousede.get(u)) {
        const w = c.a === u ? c.b : c.a;
        const nd = best + c.len;
        if (nd < (dist.get(w) ?? Infinity)) { dist.set(w, nd); pred.set(w, { z: u, c }); }
      }
    }
    const body = [];
    let k = kam;
    const kusy = [];
    while (k !== z) { const p = pred.get(k); kusy.unshift({ c: p.c, obracene: p.c.a !== p.z }); k = p.z; }
    for (const { c, obracene } of kusy) {
      const b = obracene ? c.body.slice().reverse() : c.body;
      body.push(...(body.length ? b.slice(1) : b));
    }
    return body;
  }

  jdi(kam) {
    const z = this.postava.mesto;
    if (this.postava.cesta || z === kam) return Promise.resolve(false);
    const body = this.najdiCestu(z, kam);
    if (!body) return Promise.resolve(false);
    const delky = [0];
    for (let i = 1; i < body.length; i++) delky.push(delky[i - 1] + Math.hypot(body[i][0] - body[i - 1][0], body[i][1] - body[i - 1][1]));
    const celkem = delky[delky.length - 1];
    const rychlost = Math.max(300, celkem / 4); // na hobbyhorsovi to jde rychleji: dlouhá cesta nejvýš ~4 s
    this.kamera.sleduj = true;
    return new Promise((hotovo) => {
      this.postava.cesta = { body, delky, celkem, s: 0, rychlost, kam, hotovo };
      this.postava.mesto = null;
    });
  }

  posunPostavu(dt) {
    const p = this.postava, c = p.cesta;
    if (!c) { p.chuze = Math.max(0, p.chuze - dt * 4); return; }
    p.chuze = Math.min(1, p.chuze + dt * 5);
    c.s = Math.min(c.celkem, c.s + c.rychlost * dt * Math.min(1, 0.35 + c.s / 60) * Math.min(1, 0.3 + (c.celkem - c.s) / 50));
    let i = 1;
    while (i < c.delky.length - 1 && c.delky[i] < c.s) i++;
    const t = (c.s - c.delky[i - 1]) / Math.max(0.001, c.delky[i] - c.delky[i - 1]);
    const [x0, y0] = c.body[i - 1], [x1, y1] = c.body[i];
    p.x = x0 + (x1 - x0) * t; p.y = y0 + (y1 - y0) * t;
    if (Math.abs(x1 - x0) > 0.5) p.smer = x1 > x0 ? 1 : -1;
    if (this.v.krok) this.v.krok(c.s);
    if (c.s >= c.celkem) {
      p.cesta = null; p.mesto = c.kam;
      c.hotovo(true);
    }
  }

  // ---------- vstup: klepnutí, posouvání, roztažení dvěma prsty ----------
  vstup() {
    const body = new Map();
    let tah = null, pinch = null;
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      body.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (body.size === 1) tah = { x: e.clientX, y: e.clientY, kx: this.kamera.x, ky: this.kamera.y, pohyb: 0 };
      if (body.size === 2) {
        const [a, b] = [...body.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), p: this.kamera.priblizeni };
        tah = null;
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!body.has(e.pointerId)) return;
      body.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && body.size === 2) {
        const [a, b] = [...body.values()];
        this.kamera.priblizeni = Math.max(0.55, Math.min(1.9, pinch.p * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
      } else if (tah) {
        const dx = e.clientX - tah.x, dy = e.clientY - tah.y;
        tah.pohyb = Math.max(tah.pohyb, Math.hypot(dx, dy));
        if (tah.pohyb > 10) {
          this.kamera.sleduj = false;
          this.kamera.x = tah.kx - dx / this.kamera.zoom;
          this.kamera.y = tah.ky - dy / this.kamera.zoom;
          this.omezKameru();
        }
      }
    });
    const konec = (e) => {
      if (!body.has(e.pointerId)) return;
      body.delete(e.pointerId);
      if (tah && tah.pohyb <= 10 && !pinch) this.klepnuti(e.clientX, e.clientY);
      if (body.size < 2) pinch = null;
      tah = null;
    };
    cv.addEventListener('pointerup', konec);
    cv.addEventListener('pointercancel', (e) => { body.delete(e.pointerId); tah = null; pinch = null; });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.kamera.priblizeni = Math.max(0.55, Math.min(1.9, this.kamera.priblizeni * (e.deltaY < 0 ? 1.1 : 0.9)));
    }, { passive: false });
  }

  klepnuti(cx, cy) {
    const rect = this.cv.getBoundingClientRect();
    const x = cx - rect.left, y = cy - rect.top;
    let nej = null, nejD = 60;
    for (const m of this.d.mesta) {
      const [sx, sy] = this.naObrazovku(m.x, m.y);
      const d = Math.min(Math.hypot(sx - x, sy - y), Math.hypot(sx - x, sy + 30 * this.kamera.zoom - y));
      if (d < nejD) { nejD = d; nej = m; }
    }
    if (nej) this.v.naKlepnuti(nej.id);
  }

  naObrazovku(x, y, f = 1) {
    const k = this.kamera;
    const cx = this.d.sirka / 2, cy = this.d.vyska / 2;
    return [(x - (k.x * f + (1 - f) * cx)) * k.zoom + this.W / 2, (y - (k.y * f + (1 - f) * cy)) * k.zoom + this.H / 2];
  }

  omezKameru() {
    const k = this.kamera, okraj = 120;
    const pw = this.W / 2 / k.zoom, ph = this.H / 2 / k.zoom;
    k.x = Math.max(pw - okraj, Math.min(this.d.sirka - pw + okraj, k.x));
    k.y = Math.max(ph - okraj, Math.min(this.d.vyska - ph + okraj, k.y));
    if (pw * 2 > this.d.sirka + okraj * 2) k.x = this.d.sirka / 2;
    if (ph * 2 > this.d.vyska + okraj * 2) k.y = this.d.vyska / 2;
  }

  // ---------- kreslení ----------
  velikost() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = this.cv.clientWidth, H = this.cv.clientHeight;
    if (this.cv.width !== Math.round(W * dpr) || this.cv.height !== Math.round(H * dpr)) {
      this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    }
    this.W = W; this.H = H; this.dpr = dpr;
  }

  // naklonění vysokých věcí od středu obrazovky (pocit hloubky při posouvání)
  naklon(ctx, sx, sy) {
    const lx = ((sx - this.W / 2) / (this.W / 2)) * 0.32;
    const ly = ((sy - this.H / 2) / (this.H / 2)) * 0.22;
    ctx.transform(1, 0, -lx, 1 - ly, 0, 0);
  }

  snimek(dt) {
    this.cas += dt;
    this.velikost();
    this.posunPostavu(dt);
    const k = this.kamera, p = this.postava;
    const zakladniZoom = Math.max(this.W, this.H) / 1250;
    const cilZoom = zakladniZoom * k.priblizeni * (p.cesta ? 0.93 : 1);
    k.zoom += (cilZoom - k.zoom) * Math.min(1, dt * 3);
    if (k.sleduj) {
      const tx = p.x, ty = p.y - 40;
      k.x += (tx - k.x) * Math.min(1, dt * 3.2);
      k.y += (ty - k.y) * Math.min(1, dt * 3.2);
    }
    this.omezKameru();
    this.kresli();
  }

  kresli() {
    const ctx = this.ctx, d = this.d, k = this.kamera, t = this.cas;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // moře za okrajem mapy (nejpomalejší vrstva)
    ctx.fillStyle = '#5fb3c9';
    ctx.fillRect(0, 0, this.W, this.H);
    const f0 = 0.55;
    ctx.save();
    const [ox, oy] = this.naObrazovku(0, 0, f0);
    ctx.translate(ox, oy); ctx.scale(k.zoom, k.zoom);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
    for (let y = -800; y < d.vyska + 800; y += 90) {
      for (let x = -800 + ((y / 90) % 2) * 60; x < d.sirka + 800; x += 140) {
        const v = Math.sin(t * 1.2 + x * 0.01 + y * 0.02) * 6;
        ctx.beginPath(); ctx.moveTo(x, y + v); ctx.quadraticCurveTo(x + 15, y - 8 + v, x + 30, y + v); ctx.stroke();
      }
    }
    ctx.restore();

    // pevnina
    const svet = (f = 1) => { const [sx, sy] = this.naObrazovku(0, 0, f); ctx.setTransform(this.dpr * k.zoom, 0, 0, this.dpr * k.zoom, this.dpr * sx, this.dpr * sy); };
    svet(1);
    ctx.fillStyle = '#e9d9a6';
    ctx.beginPath(); ctx.roundRect(-40, -40, d.sirka + 80, d.vyska + 80, 90); ctx.fill();
    ctx.fillStyle = d.pozadi?.barva || '#b7d98b';
    ctx.beginPath(); ctx.roundRect(-10, -10, d.sirka + 20, d.vyska + 20, 70); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(-10, -10, d.sirka + 20, d.vyska + 20, 70); ctx.clip();
    if (this.obr?.complete && this.obr.naturalWidth) ctx.drawImage(this.obr, 0, 0, d.sirka, d.vyska);
    else {
      for (const p of this.pole) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.barva;
        ctx.beginPath(); ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 10); ctx.fill(); ctx.restore();
      }
    }
    ctx.restore();

    // kopce (o kousek pomalejší vrstva než zem → hloubka)
    svet(0.94);
    for (const h of d.kopce || []) {
      const g = ctx.createRadialGradient(h.x - h.r * 0.3, h.y - h.r * 0.35, h.r * 0.1, h.x, h.y, h.r);
      g.addColorStop(0, 'rgba(255,255,230,0.55)'); g.addColorStop(0.55, 'rgba(120,160,80,0.25)'); g.addColorStop(1, 'rgba(70,110,50,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(90,120,60,0.12)'; ctx.lineWidth = 1.5;
      for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * (1 - i * 0.22), h.r * (1 - i * 0.22) * 0.8, 0, 0, Math.PI * 2); ctx.stroke(); }
    }

    svet(1);
    // podklad lesů
    for (const les of d.lesy || []) {
      ctx.fillStyle = 'rgba(80,140,70,0.35)';
      ctx.beginPath(); hladkaCesta(ctx, les.body, true); ctx.fill();
    }
    // řeky
    for (const r of d.reky || []) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#8fc6d8'; ctx.lineWidth = (r.sirka || 12) + 8; ctx.beginPath(); hladkaCesta(ctx, r.body); ctx.stroke();
      ctx.strokeStyle = '#4fa3d1'; ctx.lineWidth = r.sirka || 12; ctx.beginPath(); hladkaCesta(ctx, r.body); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([14, 30]); ctx.lineDashOffset = -t * 30;
      ctx.beginPath(); hladkaCesta(ctx, r.body); ctx.stroke(); ctx.setLineDash([]);
    }
    // cesty
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const c of this.cesty) {
      ctx.strokeStyle = '#a5845a'; ctx.lineWidth = 12; ctx.beginPath(); c.body.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    }
    for (const c of this.cesty) {
      ctx.strokeStyle = '#f2dfb2'; ctx.lineWidth = 8; ctx.beginPath(); c.body.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    }
    // stopy právě procházené cesty
    if (this.postava.cesta) {
      const c = this.postava.cesta;
      ctx.strokeStyle = 'rgba(200,80,40,0.55)'; ctx.lineWidth = 3; ctx.setLineDash([2, 12]);
      ctx.beginPath(); c.body.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
    }
    // popisky krajů
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of d.popisky || []) {
      ctx.font = 'italic 700 46px Georgia, serif'; ctx.fillStyle = 'rgba(60,80,40,0.28)'; ctx.fillText(p.text, p.x, p.y);
    }
    for (const r of d.reky || []) {
      if (!r.nazev) continue;
      const b = r.body[Math.floor(r.body.length * 0.45)];
      ctx.font = 'italic 600 22px Georgia, serif'; ctx.fillStyle = 'rgba(30,90,140,0.6)'; ctx.fillText(r.nazev, b[0], b[1] + 26);
    }

    // stíny mraků na zemi
    for (const m of this.mraky) {
      const x = ((m.x + t * m.rychlost) % (d.sirka + 600)) - 300;
      ctx.fillStyle = 'rgba(30,50,30,0.10)';
      for (const [dx, dy, r] of m.kusy) { ctx.beginPath(); ctx.arc(x + dx + 60, m.y + dy + 90, r, 0, Math.PI * 2); ctx.fill(); }
    }

    // vysoké věci (stromy, domy, hrad, postava) – seřazené podle y, s naklopením
    const veci = [];
    const vidim = (x, y, o = 120) => { const [sx, sy] = this.naObrazovku(x, y); return sx > -o && sx < this.W + o && sy > -o && sy < this.H + o * 1.5; };
    for (const s of this.stromy) if (vidim(s.x, s.y, 60)) veci.push({ y: s.y, kresli: () => this.strom(s) });
    for (const m of d.mesta) {
      if (!vidim(m.x, m.y, 220)) continue;
      for (const h of m.domy) veci.push({ y: m.y + h.dy, kresli: () => this.dum(m.x + h.dx, m.y + h.dy, h) });
      if (m.id === d.start) { veci.push({ y: m.y - 40, kresli: () => this.zavodiste(m) }); veci.push({ y: m.y - 8, kresli: () => this.staj(m) }); }
      else veci.push({ y: m.y + 34, kresli: () => this.truhla(m) });
    }
    veci.push({ y: this.postava.y + 1, kresli: () => this.kresliPostavu() });
    veci.sort((a, b) => a.y - b.y);
    for (const v of veci) v.kresli();

    // jmenovky měst (na obrazovce, stálá velikost)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const m of d.mesta) {
      if (!vidim(m.x, m.y, 200)) continue;
      const [sx, sy] = this.naObrazovku(m.x, m.y + (m.id === d.start ? 30 : 58));
      const velky = m.id === d.start;
      ctx.font = `800 ${velky ? 19 : 15}px system-ui, sans-serif`;
      const w = ctx.measureText(m.nazev).width + 18;
      ctx.fillStyle = velky ? '#7b2d26' : 'rgba(255,255,255,0.92)';
      ctx.beginPath(); ctx.roundRect(sx - w / 2, sy - 13, w, 26, 13); ctx.fill();
      ctx.fillStyle = velky ? '#fff' : '#4a3520'; ctx.fillText(m.nazev, sx, sy + 1);
      const st = this.v.stavMesta(m.id);
      if (st && (st.stav === 'zamcena' || st.stav === 'prazdna') && st.zbyva > 0) {
        const txt = `${st.stav === 'zamcena' ? '⏳' : '↻'} ${Math.floor(st.zbyva / 60)}:${String(Math.floor(st.zbyva % 60)).padStart(2, '0')}`;
        ctx.font = '700 14px system-ui, sans-serif';
        const w2 = ctx.measureText(txt).width + 14;
        ctx.fillStyle = st.stav === 'zamcena' ? 'rgba(80,60,120,0.9)' : 'rgba(90,110,90,0.85)'; ctx.beginPath(); ctx.roundRect(sx - w2 / 2, sy + 15, w2, 22, 11); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(txt, sx, sy + 26);
      }
    }

    // mraky (nejrychlejší vrstva)
    svet(1.35);
    for (const m of this.mraky) {
      const x = ((m.x + t * m.rychlost) % (d.sirka + 600)) - 300;
      for (const [dx, dy, r] of m.kusy) {
        ctx.fillStyle = 'rgba(255,255,255,0.78)'; ctx.beginPath(); ctx.arc(x + dx, m.y + dy, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    // ptáci
    if (Math.random() < 0.004 && this.ptaci.length < 3) {
      const y = k.y + (Math.random() - 0.5) * 500;
      this.ptaci.push({ x: k.x - this.W / k.zoom, y, n: 3 + Math.floor(Math.random() * 3), v: 90 + Math.random() * 60 });
    }
    svet(1.5);
    ctx.strokeStyle = 'rgba(40,40,60,0.7)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (const b of this.ptaci) {
      b.x += b.v * 0.016;
      for (let i = 0; i < b.n; i++) {
        const x = b.x - i * 22 - (i % 2) * 8, y = b.y + (i % 2 ? 14 : 0) + i * 6, kr = Math.sin(t * 9 + i) * 5;
        ctx.beginPath(); ctx.moveTo(x - 9, y - kr); ctx.quadraticCurveTo(x - 4, y - 5, x, y); ctx.quadraticCurveTo(x + 4, y - 5, x + 9, y - kr); ctx.stroke();
      }
    }
    this.ptaci = this.ptaci.filter((b) => b.x < k.x + this.W / k.zoom * 1.5);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // připraví transformaci pro vysoký objekt stojící na (x,y)
  vysoky(x, y, f) {
    const ctx = this.ctx, k = this.kamera;
    const [sx, sy] = this.naObrazovku(x, y);
    ctx.save();
    ctx.setTransform(this.dpr * k.zoom, 0, 0, this.dpr * k.zoom, this.dpr * sx, this.dpr * sy);
    this.naklon(ctx, sx, sy);
    f(ctx);
    ctx.restore();
  }

  strom(s) {
    this.vysoky(s.x, s.y, (ctx) => {
      const kyv = Math.sin(this.cas * 1.3 + s.x * 0.05) * 0.04;
      ctx.fillStyle = 'rgba(30,50,20,0.22)'; ctx.beginPath(); ctx.ellipse(4, 0, s.v * 0.45, s.v * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.transform(1, 0, kyv, 1, 0, 0);
      ctx.fillStyle = '#7a5230'; ctx.fillRect(-2, -s.v * 0.45, 4, s.v * 0.45);
      if (s.jehl) {
        const z = ['#2e7d4f', '#276b44', '#33885a'][Math.floor(s.odst * 3)];
        ctx.fillStyle = z;
        for (let i = 0; i < 3; i++) {
          const y0 = -s.v * (0.3 + i * 0.28), w = s.v * (0.42 - i * 0.1);
          ctx.beginPath(); ctx.moveTo(-w, y0); ctx.lineTo(0, y0 - s.v * 0.45); ctx.lineTo(w, y0); ctx.closePath(); ctx.fill();
        }
      } else {
        const z = ['#5aa64a', '#4c9a41', '#69b552', '#7fbf4f'][Math.floor(s.odst * 4)];
        ctx.fillStyle = z;
        ctx.beginPath(); ctx.arc(0, -s.v * 0.75, s.v * 0.42, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-s.v * 0.25, -s.v * 0.55, s.v * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s.v * 0.27, -s.v * 0.58, s.v * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(-s.v * 0.12, -s.v * 0.88, s.v * 0.16, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  dum(x, y, h) {
    this.vysoky(x, y, (ctx) => {
      ctx.fillStyle = 'rgba(30,40,20,0.22)'; ctx.beginPath(); ctx.ellipse(3, 1, h.w * 0.7, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = h.zed; ctx.fillRect(-h.w / 2, -h.h, h.w, h.h);
      ctx.strokeStyle = 'rgba(80,50,30,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(-h.w / 2, -h.h, h.w, h.h);
      ctx.fillStyle = h.strecha;
      ctx.beginPath(); ctx.moveTo(-h.w / 2 - 3, -h.h); ctx.lineTo(0, -h.h - h.w * 0.55); ctx.lineTo(h.w / 2 + 3, -h.h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6fb6e0'; ctx.fillRect(-h.w / 4 - 2, -h.h * 0.7, 4, 4); ctx.fillRect(h.w / 4 - 2, -h.h * 0.7, 4, 4);
      ctx.fillStyle = '#7a4a2a'; ctx.fillRect(-2, -6, 4, 6);
      if (h.kostel) {
        ctx.fillStyle = h.zed; ctx.fillRect(-4, -h.h - 26, 8, 26);
        ctx.fillStyle = h.strecha; ctx.beginPath(); ctx.moveTo(-5, -h.h - 26); ctx.lineTo(0, -h.h - 40); ctx.lineTo(5, -h.h - 26); ctx.fill();
        ctx.fillStyle = '#f5c518'; ctx.fillRect(-0.7, -h.h - 46, 1.4, 6);
      }
    });
  }

  // závodiště: ovál dráhy s bílým plůtkem, tribuna s praporky
  zavodiste(m) {
    this.vysoky(m.x + 6, m.y - 40, (ctx) => {
      const t = this.cas;
      ctx.fillStyle = 'rgba(30,40,20,0.18)'; ctx.beginPath(); ctx.ellipse(4, 4, 96, 34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9a26b'; ctx.beginPath(); ctx.ellipse(0, 0, 92, 32, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7fbf4f'; ctx.beginPath(); ctx.ellipse(0, 0, 70, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(0, 0, 92, 32, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 70, 18, 0, 0, Math.PI * 2); ctx.stroke();
      // překážky na dráze
      for (const a of [0.4, 1.4, 2.6, 3.8, 5.1]) {
        const x = Math.cos(a) * 81, y = Math.sin(a) * 25;
        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 5, y - 4); ctx.lineTo(x + 5, y - 4); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x - 5, y - 6); ctx.moveTo(x + 5, y); ctx.lineTo(x + 5, y - 6); ctx.stroke();
      }
      // koníček běžící po dráze
      const a = t * 0.9, kx = Math.cos(a) * 81, ky = Math.sin(a) * 25, sk = Math.abs(Math.sin(t * 9)) * 2;
      ctx.fillStyle = '#8d5524'; ctx.beginPath(); ctx.ellipse(kx, ky - 5 - sk, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(kx + (Math.sin(a) > 0 ? -8 : 4), ky - 9 - sk, 4, 4);
      // tribuna
      ctx.fillStyle = '#f3e3c3'; ctx.fillRect(-40, -46, 80, 22);
      ctx.fillStyle = '#5d6d7e'; ctx.beginPath(); ctx.moveTo(-46, -46); ctx.lineTo(0, -60); ctx.lineTo(46, -46); ctx.closePath(); ctx.fill();
      const barvy = ['#e74c3c', '#f1c40f', '#3498db', '#ff6fa8', '#2ecc71'];
      for (let i = 0; i < 14; i++) { ctx.fillStyle = barvy[i % 5]; ctx.beginPath(); ctx.arc(-34 + i * 5.2, -34 + (i % 2) * 5 + Math.sin(t * 6 + i) * 0.8, 2.2, 0, Math.PI * 2); ctx.fill(); }
      for (const x of [-46, 0, 46]) {
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, x ? -46 : -60); ctx.lineTo(x, (x ? -46 : -60) - 16); ctx.stroke();
        ctx.fillStyle = barvy[(x + 46) / 46]; ctx.beginPath(); ctx.moveTo(x, (x ? -62 : -76)); ctx.quadraticCurveTo(x + 6, (x ? -60 : -74) + Math.sin(t * 5 + x) * 2, x + 12, (x ? -58 : -72)); ctx.lineTo(x, (x ? -55 : -69)); ctx.fill();
      }
    });
  }

  // stáj s obchodem (dřevěná stavba, nad vraty podkova)
  staj(m) {
    this.vysoky(m.x - 70, m.y + 10, (ctx) => {
      ctx.fillStyle = 'rgba(30,40,20,0.22)'; ctx.beginPath(); ctx.ellipse(3, 2, 38, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a0522d'; ctx.fillRect(-32, -30, 64, 30);
      ctx.strokeStyle = 'rgba(60,30,10,0.35)'; ctx.lineWidth = 1;
      for (let y = -26; y < 0; y += 5) { ctx.beginPath(); ctx.moveTo(-32, y); ctx.lineTo(32, y); ctx.stroke(); }
      ctx.fillStyle = '#7b2d26'; ctx.beginPath(); ctx.moveTo(-37, -30); ctx.lineTo(0, -52); ctx.lineTo(37, -30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5d3412'; ctx.beginPath(); ctx.roundRect(-10, -20, 20, 20, [8, 8, 0, 0]); ctx.fill();
      ctx.strokeStyle = '#f5c518'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, -38, 5, 0.2, Math.PI - 0.2, true); ctx.stroke();
      ctx.fillStyle = '#fff8ec'; ctx.fillRect(-26, -24, 9, 8); ctx.fillRect(17, -24, 9, 8);
      // koňská hlava v okénku
      ctx.fillStyle = '#8d5524'; ctx.beginPath(); ctx.ellipse(21.5, -19, 3, 4, 0.3, 0, Math.PI * 2); ctx.fill();
    });
  }

  truhla(m) {
    const st = this.v.stavMesta(m.id) || { stav: 'plna', obtiznost: 1 };
    this.vysoky(m.x + 2, m.y + 34, (ctx) => {
      const t = this.cas;
      if (st.stav === 'plna') {
        const zar = 0.5 + Math.sin(t * 3 + m.x) * 0.5;
        const g = ctx.createRadialGradient(0, -8, 2, 0, -8, 30);
        g.addColorStop(0, `rgba(255,230,120,${0.55 + zar * 0.3})`); g.addColorStop(1, 'rgba(255,230,120,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -8, 30, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(30,40,20,0.25)'; ctx.beginPath(); ctx.ellipse(2, 1, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
      const skok = st.stav === 'plna' ? Math.max(0, Math.sin(t * 2.2 + m.y)) ** 8 * 4 : 0;
      ctx.translate(0, -skok);
      ctx.fillStyle = '#8d5524'; ctx.fillRect(-12, -14, 24, 14);
      ctx.fillStyle = '#c68642';
      if (st.stav === 'prazdna') {
        ctx.beginPath(); ctx.moveTo(-12, -14); ctx.lineTo(-10, -26); ctx.lineTo(12, -26); ctx.lineTo(12, -14); ctx.fill();
        ctx.fillStyle = '#2ecc71'; ctx.font = '900 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('✓', 0, -3);
        return;
      }
      ctx.beginPath(); ctx.moveTo(-13, -14); ctx.quadraticCurveTo(0, -24, 13, -14); ctx.fill();
      ctx.fillStyle = '#f5c518'; ctx.fillRect(-13, -9, 26, 2.5); ctx.fillRect(-2.5, -13, 5, 6);
      if (st.stav === 'zamcena') {
        ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-13, -16); ctx.lineTo(13, 0); ctx.moveTo(13, -16); ctx.lineTo(-13, 0); ctx.stroke();
      }
      // obtížnost = počet dukátů nad truhlou
      const n = st.obtiznost || 1;
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 9, y = -32 - Math.sin(t * 2 + i * 0.7) * 1.2;
        ctx.fillStyle = '#b8860b'; ctx.beginPath(); ctx.arc(x, y + 0.8, 4.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(x, y, 4.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x - 1.3, y - 1.3, 1.3, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  kresliPostavu() {
    const p = this.postava;
    this.vysoky(p.x, p.y, (ctx) => {
      ctx.scale(0.85, 0.85);
      nakresliJezdkyni(ctx, this.v.vzhled(), this.v.hobby(), { t: this.cas, chuze: p.chuze, smer: p.smer, radost: p.radost });
    });
  }
}
