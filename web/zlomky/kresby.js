// Obrázky zlomků v SVG: koláč (pizza), čokoláda (pruh nebo mřížka), číselná osa. Vrací řetězec SVG.
// Spec z generátoru nebo z JSONu lekce: { typ: 'kolac'|'pruh'|'cokolada'|'osa'|'vedle', ... }.
// U „vybarvi“ dostane každý díl data-dil=i a dá se na něj klepnout (UI přepíná třídu .plny).

const BARVY = { plny: '#ff9f43', okraj: '#5b3416', prazdny: '#fff7e6' };

export function kresba(spec, opts = {}) {
  if (!spec) return '';
  switch (spec.typ) {
    case 'kolac': return kolac(spec.n, spec.k, opts, spec);
    case 'pruh': return cokolada(spec.n, 1, spec.k, opts, spec);
    case 'cokolada': { const [r, s] = rozlozeni(spec.n, spec.radky); return cokolada(s, r, spec.k, opts, spec); }
    case 'osa': return osa(spec);
    case 'vedle': return `<div class="kresby-vedle">${spec.kresby.map((k) => `<figure>${kresba(k, opts)}${k.popis ? `<figcaption>${k.popis}</figcaption>` : ''}</figure>`).join('')}</div>`;
    case 'vice': return `<div class="kresby-vedle">${Array.from({ length: spec.pocet }, (_, i) => kresba({ ...spec.vzor, k: Math.max(0, Math.min(spec.vzor.n, spec.k - i * spec.vzor.n)) }, opts)).join('')}</div>`;
    default: return '';
  }
}

function rozlozeni(n, radky) {
  if (radky) return [radky, n / radky];
  for (const r of [3, 2, 4]) if (n % r === 0 && n / r >= r && n > 6) return [r, n / r];
  return [1, n];
}

const plnych = (k, i, spec) => (spec.vybarvene ? spec.vybarvene.includes(i) : i < k);

function kolac(n, k, opts, spec) {
  const R = 90, cx = 100, cy = 100;
  let d = '';
  if (n === 1) {
    d = `<circle cx="${cx}" cy="${cy}" r="${R}" class="dil${plnych(k, 0, spec) ? ' plny' : ''}" data-dil="0"${opts.klik ? ' data-a="dil:0"' : ''}/>`;
  } else {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
      const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0), x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
      const velky = 1 / n > 0.5 ? 1 : 0;
      d += `<path d="M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 ${velky} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" class="dil${plnych(k, i, spec) ? ' plny' : ''}" data-dil="${i}"${opts.klik ? ` data-a="dil:${i}"` : ''}/>`;
    }
  }
  return `<svg class="kresba kolac${opts.klik ? ' klikaci' : ''}" viewBox="0 0 200 200" role="img"><circle cx="100" cy="100" r="96" class="kurka"/>${d}</svg>`;
}

function cokolada(sloupcu, radku, k, opts, spec) {
  const W = 280, s = Math.min(W / sloupcu, radku === 1 ? 70 : 52), w = s * sloupcu, h = radku === 1 ? 64 : s * radku;
  const sh = radku === 1 ? 64 : s;
  let d = '';
  for (let r = 0; r < radku; r++) for (let c = 0; c < sloupcu; c++) {
    const i = r * sloupcu + c;
    d += `<rect x="${(c * s + 3).toFixed(2)}" y="${(r * sh + 3).toFixed(2)}" width="${(s - 2).toFixed(2)}" height="${(sh - 2).toFixed(2)}" rx="4" class="dil${plnych(k, i, spec) ? ' plny' : ''}" data-dil="${i}"${opts.klik ? ` data-a="dil:${i}"` : ''}/>`;
  }
  return `<svg class="kresba cokolada${opts.klik ? ' klikaci' : ''}" viewBox="0 0 ${(w + 4).toFixed(2)} ${(h + 4).toFixed(2)}" role="img">${d}</svg>`;
}

// Číselná osa od 0 do `do` (celé číslo), každý celek rozdělený na `deleni` dílků.
// body: [{ pismeno: 'A', c: 3 }] = bod na c-tém dílku. oznac: [{ c, text }] = popisek pod dílkem.
function osa(spec) {
  const W = 340, L = 20, P = 20, n = spec.do * spec.deleni, krok = (W - L - P) / n, y = 60;
  let d = `<line x1="${L - 10}" y1="${y}" x2="${W - P + 14}" y2="${y}" class="osa-cara"/><path d="M${W - P + 14},${y - 6} l10,6 l-10,6 z" class="osa-sipka"/>`;
  for (let i = 0; i <= n; i++) {
    const x = L + i * krok, cele = i % spec.deleni === 0;
    d += `<line x1="${x}" y1="${y - (cele ? 12 : 7)}" x2="${x}" y2="${y + (cele ? 12 : 7)}" class="osa-dilek${cele ? ' cele' : ''}"/>`;
    if (cele) d += `<text x="${x}" y="${y + 34}" class="osa-cislo">${i / spec.deleni}</text>`;
  }
  for (const o of spec.oznac || []) d += `<text x="${L + o.c * krok}" y="${y + 34}" class="osa-popis">${o.text}</text>`;
  for (const b of spec.body || []) {
    const x = L + b.c * krok;
    d += `<circle cx="${x}" cy="${y}" r="7" class="osa-bod"/><text x="${x}" y="${y - 18}" class="osa-pismeno">${b.pismeno}</text>`;
  }
  return `<svg class="kresba osa" viewBox="0 0 ${W + 14} 100" role="img">${d}</svg>`;
}

export const barvy = BARVY;
