// Obrázky do lekcí a úloh v SVG. Zatím jeden druh: soustava souřadnic s přímkami rovnic ax + by = c.
// Spec: { typ: 'graf', primky: [{ e: [a, b, c], popis?, carkovane? }], body?: [{ x, y, popis? }], rozsah?: 6 }.

const BARVY = ['#2d7dd2', '#e8590c', '#2f9e44'];

export function kresba(spec) {
  if (!spec) return '';
  if (spec.typ === 'graf') return graf(spec);
  return '';
}

// Úsek přímky ax + by = c uvnitř čtverce [−R, R]², nebo null.
function usek([a, b, c], R) {
  const body = [];
  if (b !== 0) for (const x of [-R, R]) { const y = (c - a * x) / b; if (y >= -R - 1e-9 && y <= R + 1e-9) body.push([x, y]); }
  if (a !== 0) for (const y of [-R, R]) { const x = (c - b * y) / a; if (x >= -R - 1e-9 && x <= R + 1e-9) body.push([x, y]); }
  const jine = body.filter((p, i) => body.findIndex((q) => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6) === i);
  if (jine.length < 2) return null;
  return jine.sort((p, q) => p[0] - q[0] || p[1] - q[1]).slice(0, 2);
}

function graf(spec) {
  const r = spec.rozsah || 6, R = r + 0.6, W = 320, u = W / (2 * R);
  const X = (x) => +((x + R) * u).toFixed(1), Y = (y) => +((R - y) * u).toFixed(1);
  let s = '';
  for (let i = -r; i <= r; i++) {
    s += `<line class="graf-mriz" x1="${X(i)}" y1="${Y(-R)}" x2="${X(i)}" y2="${Y(R)}"/><line class="graf-mriz" x1="${X(-R)}" y1="${Y(i)}" x2="${X(R)}" y2="${Y(i)}"/>`;
  }
  s += `<line class="graf-osa" x1="${X(-R)}" y1="${Y(0)}" x2="${X(R) - 4}" y2="${Y(0)}"/><line class="graf-osa" x1="${X(0)}" y1="${Y(-R)}" x2="${X(0)}" y2="${Y(R) + 4}"/>`;
  s += `<path class="graf-sipka" d="M${X(R)},${Y(0)} l-10,-5 v10 z"/><path class="graf-sipka" d="M${X(0)},${Y(R)} l-5,10 h10 z"/>`;
  s += `<text class="graf-popis-osy" x="${X(R) - 8}" y="${Y(0) + 20}">x</text><text class="graf-popis-osy" x="${X(0) + 10}" y="${Y(R) + 14}">y</text>`;
  for (let i = -r; i <= r; i++) {
    if (!i || (r > 6 && i % 2)) continue;
    s += `<text class="graf-cislo" x="${X(i)}" y="${Y(0) + 14}">${String(i).replace('-', '−')}</text>`;
    s += `<text class="graf-cislo vlevo" x="${X(0) - 4}" y="${Y(i) + 4}">${String(i).replace('-', '−')}</text>`;
  }
  s += `<text class="graf-cislo vlevo" x="${X(0) - 4}" y="${Y(0) + 14}">0</text>`;
  (spec.primky || []).forEach((p, i) => {
    const us = usek(p.e, R); if (!us) return;
    const barva = p.barva || BARVY[i % BARVY.length];
    const [[x1, y1], [x2, y2]] = us;
    s += `<line class="graf-primka${p.carkovane ? ' carkovane' : ''}" stroke="${barva}" x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}"/>`;
    if (p.popis) {
      const t = [0.86, 0.14, 0.5][i % 3], lx = x1 + (x2 - x1) * t, ly = y1 + (y2 - y1) * t;
      const sir = 9 + 8.4 * p.popis.length;
      const px = Math.min(W - sir - 2, Math.max(2, X(lx) + 6)), py = Math.min(W - 6, Math.max(18, Y(ly) - 8));
      s += `<rect class="graf-stitek" x="${px - 4}" y="${py - 15}" width="${sir}" height="21" rx="6"/><text class="graf-text" fill="${barva}" x="${px}" y="${py}">${p.popis.replace(/-/g, '−')}</text>`;
    }
  });
  for (const b of spec.body || []) {
    s += `<circle class="graf-bod" cx="${X(b.x)}" cy="${Y(b.y)}" r="6"/>`;
    if (b.popis) s += `<text class="graf-text bod" x="${X(b.x) + 9}" y="${Y(b.y) + 20}">${b.popis.replace(/-/g, '−')}</text>`;
  }
  return `<svg class="kresba graf" viewBox="0 0 ${W} ${W}" role="img" aria-label="Graf přímek">${s}</svg>`;
}
