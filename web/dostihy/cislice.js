// Rozpoznávání psaných číslic (tužka nebo prst) přímo v prohlížeči, bez internetu.
// Malá konvoluční síť natrénovaná na MNIST (nastroje/dostihy-cislice-trenink.py), váhy v cislice-model.json (int8).
// K tomu „rukopis“: vzorky, které hráčka napsala sama (učení v nastavení nebo volba „myslela jsi…?“).
// Ty se porovnávají s novým tahem podle vnitřních rysů sítě a čtení posunou k jejímu rukopisu.

let model = null, nacitani = null;

export function nactiModel(url = new URL('cislice-model.json', import.meta.url)) {
  if (model) return Promise.resolve(model);
  if (!nacitani) {
    nacitani = fetch(url).then((r) => { if (!r.ok) throw new Error('model ' + r.status); return r.json(); }).then(nastavModel)
      .catch((e) => { nacitani = null; throw e; });
  }
  return nacitani;
}
export function nastavModel(j) {
  const v = {};
  for (const l of j.vrstvy) {
    const bin = atob(l.data);
    const a = new Float32Array(bin.length);
    for (let i = 0; i < bin.length; i++) { const b = bin.charCodeAt(i); a[i] = (b > 127 ? b - 256 : b) * l.meritko; }
    v[l.nazev] = a;
  }
  model = v;
  return v;
}
export const modelPripraven = () => !!model;

// ---------- síť ----------
function konvoluce(vstup, kan, n, w, b, ven) { // padding 1, 3×3, ReLU
  const out = new Float32Array(ven * n * n);
  for (let o = 0; o < ven; o++) {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let s = b[o];
      for (let c = 0; c < kan; c++) {
        const wb = (o * kan + c) * 9, ib = c * n * n;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= n) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= n) continue;
            s += vstup[ib + yy * n + xx] * w[wb + (dy + 1) * 3 + dx + 1];
          }
        }
      }
      out[o * n * n + y * n + x] = s > 0 ? s : 0;
    }
  }
  return out;
}
function pool(v, kan, n) {
  const m = n / 2, out = new Float32Array(kan * m * m);
  for (let c = 0; c < kan; c++) for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) {
    const i = c * n * n + 2 * y * n + 2 * x;
    out[c * m * m + y * m + x] = Math.max(v[i], v[i + 1], v[i + n], v[i + n + 1]);
  }
  return out;
}
function husta(v, w, b, ven, relu) {
  const n = v.length, out = new Float32Array(ven);
  for (let o = 0; o < ven; o++) { let s = b[o]; for (let i = 0; i < n; i++) s += v[i] * w[o * n + i]; out[o] = relu && s < 0 ? 0 : s; }
  return out;
}
// obraz 28×28 (0..1) → { p: pravděpodobnosti 0–9, rysy: 64 čísel }
export function predikuj(obraz) {
  const m = model;
  let x = pool(konvoluce(obraz, 1, 28, m['c1.weight'], m['c1.bias'], 16), 16, 28);
  x = pool(konvoluce(x, 16, 14, m['c2.weight'], m['c2.bias'], 32), 32, 14);
  const rysy = husta(x, m['f1.weight'], m['f1.bias'], 64, true);
  const z = husta(rysy, m['f2.weight'], m['f2.bias'], 10, false);
  const mx = Math.max(...z);
  const e = z.map((v) => Math.exp(v - mx)), s = e.reduce((a, b) => a + b, 0);
  return { p: Array.from(e, (v) => v / s), rysy: Array.from(rysy) };
}

// ---------- tahy → obraz jako v MNIST (číslice v rámečku 20×20, těžiště uprostřed 28×28) ----------
export function obrazZTahu(tahy) {
  const body = tahy.flat();
  if (!body.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of body) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const w = x1 - x0, hgt = y1 - y0, vel = Math.max(w, hgt);
  if (vel < 6) return null; // jen tečka
  const S = 4, N = 28 * S;
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  const k = (20 * S) / vel;
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  g.lineWidth = 2.6 * S;
  const ox = (N - w * k) / 2, oy = (N - hgt * k) / 2;
  for (const t of tahy) {
    g.beginPath();
    t.forEach(([x, y], i) => { const px = ox + (x - x0) * k, py = oy + (y - y0) * k; if (i) g.lineTo(px, py); else g.moveTo(px, py); });
    if (t.length === 1) { g.arc(ox + (t[0][0] - x0) * k, oy + (t[0][1] - y0) * k, g.lineWidth / 2, 0, 7); g.fill(); } else g.stroke();
  }
  const d = g.getImageData(0, 0, N, N).data;
  const mal = new Float32Array(784);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) mal[((y / S) | 0) * 28 + ((x / S) | 0)] += d[(y * N + x) * 4] / 255 / (S * S);
  // posun těžiště doprostřed
  let sx = 0, sy = 0, sm = 0;
  for (let i = 0; i < 784; i++) { sx += (i % 28) * mal[i]; sy += ((i / 28) | 0) * mal[i]; sm += mal[i]; }
  const dx = Math.round(13.5 - sx / sm), dy = Math.round(13.5 - sy / sm);
  const out = new Float32Array(784);
  for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
    const yy = y - dy, xx = x - dx;
    if (yy >= 0 && yy < 28 && xx >= 0 && xx < 28) out[y * 28 + x] = Math.min(1, mal[yy * 28 + xx]);
  }
  return out;
}

// ---------- rukopis hráčky ----------
const KLIC = 'dostihy-rukopis';
const NA_CISLICI = 12;
export function nactiRukopis() {
  try { const r = JSON.parse(localStorage.getItem(KLIC)); if (r && r.vzorky) return r; } catch { /* nic */ }
  return { vzorky: {} };
}
export function ulozVzorek(cislice, rysy) {
  const r = nactiRukopis();
  const s = (r.vzorky[cislice] ||= []);
  s.push(rysy.map((v) => Math.round(v * 100) / 100));
  if (s.length > NA_CISLICI) s.splice(0, s.length - NA_CISLICI);
  try { localStorage.setItem(KLIC, JSON.stringify(r)); } catch { /* plné úložiště nevadí */ }
}
export function smazRukopis() { try { localStorage.removeItem(KLIC); } catch { /* nic */ } }
export const pocetVzorku = () => Object.values(nactiRukopis().vzorky).reduce((a, s) => a + s.length, 0);

const kos = (a, b) => { let s = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return s / (Math.sqrt(na * nb) || 1); };

// tahy → { cislice, jistota, poradi: [{c, p}], rysy } nebo null (prázdné / tečka)
export function rozpoznej(tahy) {
  const obraz = obrazZTahu(tahy);
  if (!obraz || !model) return null;
  const { p, rysy } = predikuj(obraz);
  const skore = p.map((x) => Math.log(x + 1e-6));
  const vz = nactiRukopis().vzorky;
  for (let c = 0; c < 10; c++) {
    const s = vz[c];
    if (!s?.length) continue;
    const nej = Math.max(...s.map((v) => kos(v, rysy)));
    skore[c] += 10 * Math.max(0, nej - 0.8); // vlastní vzorek hodně podobný → přidat
  }
  const mx = Math.max(...skore);
  const e = skore.map((v) => Math.exp(v - mx)), su = e.reduce((a, b) => a + b, 0);
  const poradi = e.map((v, c) => ({ c, p: v / su })).sort((a, b) => b.p - a.p);
  return { cislice: String(poradi[0].c), jistota: poradi[0].p, poradi, rysy, obraz };
}
