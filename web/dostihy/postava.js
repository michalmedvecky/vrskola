// Postavička: vymyšlená holčička (převzato ze Strážců klýčú) na hobbyhorsovi, kreslená vektorově na canvas.
// Vzhled holčičky i hobbyhorse si dítě skládá samo.

export const VOLBY = {
  kuze: ['#f9d7b9', '#eebf98', '#d9a275', '#b97c50', '#8a5634'],
  vlasy: ['kratke', 'culiky', 'cop', 'kudrny', 'dlouhe', 'jezek'],
  barvaVlasu: ['#3b2618', '#6d4325', '#b5722f', '#e8c46a', '#d9542b', '#222222', '#8e5bd6', '#2f8fd8'],
  triko: ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#ff6fa8'],
  spodek: ['kalhoty', 'sukne', 'kratasy'],
  barvaSpodku: ['#2c3e75', '#6b4f2a', '#4a4a4a', '#c0392b', '#16a085', '#8e44ad'],
  cepice: ['helma', 'nic', 'kulich', 'klobouk', 'korunka', 'kvetina'],
  barvaHelmy: ['#222222', '#2c3e75', '#c0392b', '#ff6fa8', '#8e44ad', '#16a085'],
};

export const POPISY = {
  kuze: 'Barva kůže', vlasy: 'Vlasy', barvaVlasu: 'Barva vlasů', triko: 'Tričko', spodek: 'Oblečení',
  barvaSpodku: 'Barva oblečení', cepice: 'Na hlavu', barvaHelmy: 'Barva helmy',
};

export const VYCHOZI = {
  jmeno: '', kuze: 0, vlasy: 1, barvaVlasu: 3, triko: 7, spodek: 1, barvaSpodku: 4, cepice: 0, barvaHelmy: 3,
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
export function nakresliPostavu(ctx, vz, { t = 0, chuze = 0, smer = 1, radost = 0, doplnek = null } = {}) {
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

  if (doplnek) doplnek(ctx, krok);

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
  } else if (cep === 'helma') {
    const hb = val(vz, 'barvaHelmy');
    ctx.fillStyle = hb; ctx.beginPath(); ctx.arc(0, hy - 3, 16.5, Math.PI * 1.05, Math.PI * 1.98); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(13, hy - 4, 8, 2.6, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-4, hy - 13, 6, 3, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = tmavsi(hb.startsWith('#') ? hb : '#222222', 0.3); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-12, hy - 2); ctx.quadraticCurveTo(-8, hy + 12, 0, hy + 13); ctx.stroke();
  } else if (cep === 'kvetina') {
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ovalek(ctx, 9 + Math.cos(a) * 4.5, hy - 12 + Math.sin(a) * 4.5, 3.5, 3.5, '#ff6fa8'); }
    ovalek(ctx, 9, hy - 12, 2.8, 2.8, '#f5c518');
  }
  ctx.restore();
}

// ---------- hobbyhorse (koník na tyči), na kterém holčička jezdí po mapě ----------
export const VOLBY_HOBBY = {
  hlava: ['#f4efe6', '#d9b26a', '#c68642', '#8d5524', '#3b2618', '#b8b8b8', '#ffb3d9', '#a8d8f0'],
  hriva: ['#3b2618', '#f5f0e0', '#e8c46a', '#d9542b', '#ff6fa8', '#8e5bd6', '#2f8fd8', '#222222'],
  uces: ['kratka', 'dlouha', 'copanky', 'duha'],
  uzdicka: ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#ff6fa8', '#222222'],
  ozdoba: ['nic', 'masle', 'kvetina', 'hvezda', 'roh'],
  tyc: ['#c49a6c', '#e74c3c', '#3498db', '#f1c40f', '#ffffff', '#9b59b6'],
};
export const POPISY_HOBBY = { hlava: 'Barva koníka', hriva: 'Barva hřívy', uces: 'Hříva', uzdicka: 'Uzdička', ozdoba: 'Ozdoba', tyc: 'Tyč' };
export const VYCHOZI_HOBBY = { jmeno: '', hlava: 2, hriva: 4, uces: 1, uzdicka: 5, ozdoba: 1, tyc: 0 };
export const NAZVY_VOLEB = {
  kratke: 'krátké', culiky: 'culíky', cop: 'cop', kudrny: 'kudrny', dlouhe: 'dlouhé', jezek: 'ježek',
  kalhoty: 'kalhoty', sukne: 'sukně', kratasy: 'kraťasy', nic: '–', kulich: 'kulich', klobouk: 'klobouk', korunka: 'korunka',
  kvetina: 'kytička', helma: 'helma', kratka: 'krátká', dlouha: 'dlouhá', copanky: 'copánky', duha: 'duhová',
  masle: 'mašle', hvezda: 'hvězdička', roh: 'roh jednorožce',
};
const DUHA = ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];
const hv = (vz, k) => VOLBY_HOBBY[k][(vz?.[k] ?? 0) % VOLBY_HOBBY[k].length];

// Koník na tyči v souřadnicích postavy (nohy v 0,0, kouká doprava). krok = fáze chůze (-1..1).
export function nakresliHobby(ctx, vz, krok = 0, t = 0) {
  const bob = krok * 1.6;
  const hlava = hv(vz, 'hlava'), hriva = hv(vz, 'hriva'), uces = hv(vz, 'uces');
  ctx.save();
  ctx.translate(0, bob);
  // tyč (prochází mezi nohama, vzadu kousek trčí)
  ctx.strokeStyle = tmavsi(hv(vz, 'tyc'), 0.25); ctx.lineWidth = 4.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-30, -6); ctx.lineTo(22, -30); ctx.stroke();
  ctx.strokeStyle = hv(vz, 'tyc'); ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(-30, -6); ctx.lineTo(22, -30); ctx.stroke();
  ctx.translate(10, 7); // hlava koníka je před holčičkou
  // krk a hlava
  ctx.fillStyle = hlava;
  ctx.beginPath(); ctx.moveTo(8, -30); ctx.quadraticCurveTo(10, -46, 17, -57); ctx.lineTo(25, -52); ctx.quadraticCurveTo(19, -42, 18, -30); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.translate(22, -53); ctx.rotate(0.55);
  ovalek(ctx, 0, 0, 8, 7, hlava);
  ovalek(ctx, 9, 1, 7, 5, hlava);
  ovalek(ctx, 13, 1.5, 3.2, 3.6, tmavsi(hlava.startsWith('#') ? hlava : '#888888', 0.12));
  ctx.restore();
  // ucho
  ctx.beginPath(); ctx.moveTo(16, -58); ctx.lineTo(17.5, -67); ctx.lineTo(21.5, -59); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,140,170,0.6)'; ctx.beginPath(); ctx.moveTo(17.3, -59); ctx.lineTo(18, -64.5); ctx.lineTo(20.2, -59.5); ctx.closePath(); ctx.fill();
  // oko, nozdra, úsměv
  ovalek(ctx, 23, -55, 1.7, 2, '#222');
  ovalek(ctx, 23.6, -55.7, 0.6, 0.6, '#fff');
  ovalek(ctx, 31, -45.5, 0.9, 0.7, 'rgba(0,0,0,0.5)');
  ctx.strokeStyle = 'rgba(80,40,30,0.7)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(28.5, -44.5, 2.4, 0.2, 1.6); ctx.stroke();
  // uzdička
  ctx.strokeStyle = hv(vz, 'uzdicka'); ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(27.5, -47.5, 4.2, 5.2, 0.55, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(19, -60); ctx.lineTo(25, -51); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(25, -45); ctx.quadraticCurveTo(8, -40, -2, -38); ctx.stroke();
  // hříva podél krku
  const vlna = Math.sin(t * 9) * 1.5 * Math.abs(krok);
  if (uces === 'copanky') {
    for (let i = 0; i < 5; i++) ovalek(ctx, 13 - i * 1.6 + vlna * 0.3, -58 + i * 5.5, 2.8, 2.8, hriva);
  } else {
    const delkaPramenu = uces === 'kratka' ? 4 : 9;
    for (let i = 0; i < 7; i++) {
      const x = 15 - i * 1.4, y = -60 + i * 4.3;
      ctx.strokeStyle = uces === 'duha' ? DUHA[i % DUHA.length] : hriva; ctx.lineWidth = uces === 'kratka' ? 3.2 : 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - delkaPramenu * 0.6, y + 2 + vlna, x - delkaPramenu, y + 4 + vlna); ctx.stroke();
    }
    // ofina
    ctx.strokeStyle = uces === 'duha' ? DUHA[0] : hriva; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(19, -60); ctx.quadraticCurveTo(23, -61, 24, -58); ctx.stroke();
  }
  // ozdoba
  const oz = hv(vz, 'ozdoba');
  if (oz === 'masle') {
    ctx.fillStyle = hv(vz, 'uzdicka');
    ctx.beginPath(); ctx.moveTo(14, -61); ctx.lineTo(9, -65); ctx.lineTo(9, -57); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(14, -61); ctx.lineTo(19, -66); ctx.lineTo(19, -57); ctx.closePath(); ctx.fill();
    ovalek(ctx, 14, -61, 1.8, 1.8, tmavsi(hv(vz, 'uzdicka'), 0.25));
  } else if (oz === 'kvetina') {
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ovalek(ctx, 21 + Math.cos(a) * 2.6, -61 + Math.sin(a) * 2.6, 2, 2, '#fff'); }
    ovalek(ctx, 21, -61, 1.6, 1.6, '#f5c518');
  } else if (oz === 'hvezda') {
    ctx.fillStyle = '#f5c518'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 1.4 : 3.4, a = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(25 + Math.cos(a) * r, -57 + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  } else if (oz === 'roh') {
    ctx.fillStyle = '#f5d76e'; ctx.beginPath(); ctx.moveTo(21, -61); ctx.lineTo(28, -73); ctx.lineTo(24.5, -59.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 0.8;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(21.5 + i * 1.6, -61 - i * 2.8); ctx.lineTo(23.5 + i * 1.3, -60 - i * 2.6); ctx.stroke(); }
  }
  ctx.restore();
}

// Holčička na hobbyhorsovi (na mapě a v náhledu).
export function nakresliJezdkyni(ctx, vz, hobby, stav = {}) {
  nakresliPostavu(ctx, vz, { ...stav, doplnek: (c, krok) => nakresliHobby(c, hobby, krok, stav.t || 0) });
}
