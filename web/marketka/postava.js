// Postavička: vymyšlený malý cestovatel, kreslený vektorově na canvas. Vzhled si dítě skládá samo.

export const VOLBY = {
  kuze: ['#f9d7b9', '#eebf98', '#d9a275', '#b97c50', '#8a5634'],
  vlasy: ['kratke', 'culiky', 'cop', 'kudrny', 'dlouhe', 'jezek'],
  barvaVlasu: ['#3b2618', '#6d4325', '#b5722f', '#e8c46a', '#d9542b', '#222222', '#8e5bd6', '#2f8fd8'],
  triko: ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#ff6fa8'],
  spodek: ['kalhoty', 'sukne', 'kratasy'],
  barvaSpodku: ['#2c3e75', '#6b4f2a', '#4a4a4a', '#c0392b', '#16a085', '#8e44ad'],
  cepice: ['nic', 'kulich', 'klobouk', 'korunka', 'ksiltovka', 'kvetina'],
  brasna: ['#8b4513', '#c0392b', '#27ae60', '#2980b9', '#8e44ad', '#f39c12'],
};

export const POPISY = {
  kuze: 'Barva kůže', vlasy: 'Vlasy', barvaVlasu: 'Barva vlasů', triko: 'Tričko', spodek: 'Oblečení',
  barvaSpodku: 'Barva oblečení', cepice: 'Na hlavu', brasna: 'Brašnička',
};

export const VYCHOZI = {
  jmeno: '', kuze: 0, vlasy: 1, barvaVlasu: 1, triko: 7, spodek: 1, barvaSpodku: 0, cepice: 0, brasna: 0,
};

export function nahodnyVzhled() {
  const v = { ...VYCHOZI };
  for (const k of Object.keys(VOLBY)) v[k] = Math.floor(Math.random() * VOLBY[k].length);
  return v;
}

const val = (vz, k) => VOLBY[k][(vz[k] ?? 0) % VOLBY[k].length];

function ovalek(ctx, x, y, rx, ry, barva) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = barva; ctx.fill();
}
function tmavsi(hex, o = 0.25) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - o)), g = Math.round(((n >> 8) & 255) * (1 - o)), b = Math.round((n & 255) * (1 - o));
  return `rgb(${r},${g},${b})`;
}

// Nakreslí postavu s nohama v bodě (0,0), výška ~78 jednotek.
// t = čas v s, chuze = 0..1 (míra kráčení), smer = 1 doprava / -1 doleva, radost = 0..1 (poskakování)
export function nakresliPostavu(ctx, vz, { t = 0, chuze = 0, smer = 1, radost = 0 } = {}) {
  const krok = Math.sin(t * 11) * chuze;
  const houpani = Math.abs(Math.cos(t * 11)) * 3 * chuze + Math.abs(Math.sin(t * 7)) * 8 * radost;
  const kuze = val(vz, 'kuze');
  const vlasy = val(vz, 'barvaVlasu');
  const triko = val(vz, 'triko');
  const spodek = val(vz, 'barvaSpodku');

  ctx.save();
  // stín
  ovalek(ctx, 0, 0, 16 - houpani * 0.6, 5, 'rgba(0,0,0,0.22)');
  ctx.translate(0, -houpani);
  ctx.scale(smer, 1);
  ctx.lineCap = 'round';

  // nohy
  const noha = (uhel, barva) => {
    ctx.save(); ctx.translate(0, -24); ctx.rotate(uhel);
    ctx.strokeStyle = barva; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 20); ctx.stroke();
    ovalek(ctx, 2, 22, 5.5, 3.5, '#3a2a20');
    ctx.restore();
  };
  const barvaNohou = val(vz, 'spodek') === 'kalhoty' ? spodek : kuze;
  ctx.save(); ctx.translate(-4, 0); noha(krok * 0.6, barvaNohou); ctx.restore();
  ctx.save(); ctx.translate(4, 0); noha(-krok * 0.6, barvaNohou); ctx.restore();

  // zadní ruka
  const ruka = (uhel) => {
    ctx.save(); ctx.translate(0, -42); ctx.rotate(uhel);
    ctx.strokeStyle = triko; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 9); ctx.stroke();
    ctx.strokeStyle = kuze; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, 15); ctx.stroke();
    ctx.restore();
  };
  ctx.save(); ctx.translate(-7, 0); ruka(-krok * 0.7 - 0.15 - radost * 2.2 * Math.abs(Math.sin(t * 7))); ctx.restore();

  // tělo
  ctx.fillStyle = triko;
  ctx.beginPath(); ctx.moveTo(-10, -46); ctx.quadraticCurveTo(0, -50, 10, -46); ctx.lineTo(11, -26); ctx.lineTo(-11, -26); ctx.closePath(); ctx.fill();
  const druh = val(vz, 'spodek');
  ctx.fillStyle = spodek;
  if (druh === 'sukne') { ctx.beginPath(); ctx.moveTo(-11, -29); ctx.lineTo(11, -29); ctx.lineTo(15, -17); ctx.lineTo(-15, -17); ctx.closePath(); ctx.fill(); }
  else if (druh === 'kratasy') { ctx.fillRect(-11, -29, 22, 9); }
  else { ctx.fillRect(-11, -29, 22, 6); }

  // brašnička přes rameno
  ctx.strokeStyle = tmavsi(val(vz, 'brasna'), 0.3); ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-8, -46); ctx.lineTo(9, -30); ctx.stroke();
  ctx.fillStyle = val(vz, 'brasna');
  ctx.beginPath(); ctx.roundRect(5, -34, 12, 10, 3); ctx.fill();
  ctx.fillStyle = tmavsi(val(vz, 'brasna'), 0.35); ctx.fillRect(5, -34, 12, 3.5);
  ctx.fillStyle = '#f5d76e'; ctx.fillRect(10, -31.5, 2.5, 2.5);

  // přední ruka
  ctx.save(); ctx.translate(7, 0); ruka(krok * 0.7 + 0.15 + radost * 2.2 * Math.abs(Math.sin(t * 7 + 1))); ctx.restore();

  // hlava
  const hy = -62;
  const styl = val(vz, 'vlasy');
  if (styl === 'dlouhe' || styl === 'cop') {
    ctx.fillStyle = vlasy;
    if (styl === 'dlouhe') { ctx.beginPath(); ctx.roundRect(-15, hy - 6, 30, 28, 8); ctx.fill(); }
    else { ctx.save(); ctx.translate(-12, hy + 4); ctx.rotate(0.3 + krok * 0.2);
      for (let i = 0; i < 3; i++) ovalek(ctx, 0, i * 7, 4.5, 4.5, vlasy);
      ovalek(ctx, 0, 22, 3, 3, '#e74c3c'); ctx.restore(); }
  }
  if (styl === 'culiky') {
    ctx.save();
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * 15, hy - 2); ctx.rotate(s * (0.4 + Math.sin(t * 11) * 0.12 * chuze));
      ovalek(ctx, s * 5, 4, 7, 5, vlasy); ctx.restore(); ovalek(ctx, s * 14, hy - 2, 2.5, 2.5, '#e74c3c'); }
    ctx.restore();
  }
  ovalek(ctx, 0, hy, 15, 15, kuze);
  // obličej
  ovalek(ctx, 5, hy + 1, 1.9, 2.4, '#222');
  ovalek(ctx, -3, hy + 1, 1.9, 2.4, '#222');
  ovalek(ctx, 9, hy + 6, 3, 2, 'rgba(255,110,110,0.45)');
  ovalek(ctx, -7, hy + 6, 3, 2, 'rgba(255,110,110,0.45)');
  ctx.strokeStyle = '#7a3b2e'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(1.5, hy + 5, 4, 0.25, Math.PI - 0.25); ctx.stroke();

  // vlasy nahoře
  ctx.fillStyle = vlasy;
  if (styl === 'kudrny') {
    for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; ovalek(ctx, Math.cos(a) * 14, hy + Math.sin(a) * 13 - 1, 6, 6, vlasy); }
  } else if (styl === 'jezek') {
    ctx.beginPath(); ctx.moveTo(-15, hy - 2);
    for (let i = 0; i <= 6; i++) { const x = -15 + i * 5; ctx.lineTo(x, hy - (i % 2 ? 22 : 12)); }
    ctx.lineTo(15, hy - 2); ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(0, hy - 1, 15.5, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(4, hy - 8, -2, hy - 5);
    ctx.quadraticCurveTo(-10, hy - 6, -15.3, hy - 1); ctx.fill();
  }

  // pokrývka hlavy
  const cep = val(vz, 'cepice');
  if (cep === 'kulich') {
    ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(0, hy - 6, 15, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-16, hy - 8, 32, 5); ovalek(ctx, 0, hy - 22, 5, 5, '#fff');
  } else if (cep === 'klobouk') {
    ovalek(ctx, 0, hy - 9, 22, 5, '#a0703c');
    ctx.fillStyle = '#b8834a'; ctx.beginPath(); ctx.roundRect(-11, hy - 24, 22, 16, 5); ctx.fill();
    ctx.fillStyle = '#5b3a1e'; ctx.fillRect(-11, hy - 13, 22, 4);
  } else if (cep === 'korunka') {
    ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.moveTo(-11, hy - 10); ctx.lineTo(-11, hy - 22); ctx.lineTo(-5, hy - 15);
    ctx.lineTo(0, hy - 25); ctx.lineTo(5, hy - 15); ctx.lineTo(11, hy - 22); ctx.lineTo(11, hy - 10); ctx.closePath(); ctx.fill();
    ovalek(ctx, 0, hy - 14, 2, 2, '#e74c3c');
  } else if (cep === 'ksiltovka') {
    ctx.fillStyle = '#2980b9'; ctx.beginPath(); ctx.arc(0, hy - 5, 15, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.ellipse(13, hy - 5, 11, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  } else if (cep === 'kvetina') {
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ovalek(ctx, 9 + Math.cos(a) * 4.5, hy - 12 + Math.sin(a) * 4.5, 3.5, 3.5, '#ff6fa8'); }
    ovalek(ctx, 9, hy - 12, 2.8, 2.8, '#f5c518');
  }
  ctx.restore();
}
