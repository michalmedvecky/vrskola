// Závodní kůň: vlastnosti z koupených věcí (data/obchod.json) a kreslení z boku (stáj, obchod, dostihy).
// Na začátku je to stará, nemotorná a neupravená kobyla Herka: zablácená, rozcuchaná, vyhublá, hlavu nese nízko.
// Každá koupená věc ji viditelně změní (krása: koupel, lesk, hříva, mašle, čabraka…; zdraví: přestane být vyhublá a kulhat).

export const SRST = ['#8d5524', '#3b2618', '#c68642', '#e8dcc8', '#9e9e9e', '#d9b26a', '#f4f1ea'];
export const NAZVY_SRSTI = ['hnědák', 'vraník', 'ryzák', 'bělouš', 'grošák', 'plavák', 'bílý'];
export const HRIVA = ['#2b1d14', '#f5f0e0', '#e8c46a', '#7a4a1e', '#555555', '#c0392b'];
export const DOPLNKY = ['#e74c3c', '#ff6fa8', '#9b59b6', '#3498db', '#2ecc71', '#f1c40f'];
export const VYCHOZI_KUN = { jmeno: 'Herka', srst: 0, hriva: 0, doplnek: 1, koupeno: [] };

// Kolik stupňů má kůň v každé vlastnosti (= počet koupených věcí z kategorie).
export function stupne(kun, obchod) {
  const s = {};
  for (const v of obchod.vlastnosti) s[v.id] = v.veci.filter((x) => kun.koupeno.includes(x.id)).length;
  return s;
}
// Druhá a další věc síly a obratnosti vyžaduje zdraví: věc č. i (od 0) potřebuje zdraví aspoň i − 1.
export function potrebneZdravi(vlastnost, index) { return vlastnost.potrebuje ? Math.max(0, index - 1) : 0; }
// Další věc, kterou jde v kategorii koupit (věci jdou popořadě), a proč případně ne.
export function dalsiVec(kun, obchod, vlastnost) {
  const st = stupne(kun, obchod);
  const i = vlastnost.veci.findIndex((x) => !kun.koupeno.includes(x.id));
  if (i < 0) return { hotovo: true };
  const zdravi = potrebneZdravi(vlastnost, i);
  return { vec: vlastnost.veci[i], index: i, chybiZdravi: Math.max(0, zdravi - (st[vlastnost.potrebuje] || 0)), zdravi };
}
// Dukáty navíc od diváků po každém dostihu (za krásu).
export const bonusKrasy = (krasa) => Math.floor(krasa / 2);
// Jak koni říkají diváci podle průměru vlastností
export function prezdivka(st) {
  const p = (st.kondice + st.rychlost + st.skok + st.krasa) / 4;
  return p < 0.5 ? 'stará herka' : p < 2 ? 'kobylka, co se snaží' : p < 3.5 ? 'šikovný koník' : p < 5 ? 'závodní kůň' : p < 6.5 ? 'hvězda Posázaví' : p < 7.75 ? 'šampion' : 'legenda Kounic';
}

function smichej(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
function tmavsi(hex, o) { return hex.startsWith('#') ? smichej(hex, '#000000', o) : hex; }
const ov = (ctx, x, y, rx, ry, barva, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fillStyle = barva; ctx.fill(); };

// Nakreslí koně z boku, kopyta na (0,0), hlavou doprava, délka ~110 jednotek.
// kun = { vzhled: {srst, hriva, doplnek}, st: {kondice, rychlost, skok, krasa} } – u soupeřů stačí barva a st.
// stav = { t, faze (krok cvalu), beh 0..1, vyska 0..1 (skok), zakopnuti 0..1, jezdec: {kuze, vlasy, triko, helma} | null }
export function nakresliKone(ctx, kun, stav = {}) {
  const { t = 0, faze = 0, beh = 0, vyska = 0, zakopnuti = 0, jezdec = null } = stav;
  const st = kun.st || { kondice: 8, rychlost: 8, skok: 8, krasa: 8 };
  const vz = kun.vzhled || {};
  const krasa = st.krasa ?? 8, kondice = st.kondice ?? 8, sila = st.rychlost ?? 4;
  const zaklad = kun.barva || SRST[(vz.srst ?? 0) % SRST.length];
  const srst = krasa < 1 ? smichej(zaklad, '#7d6e5a', 0.45) : zaklad;
  const tmava = tmavsi(srst.startsWith('#') ? srst : '#7d6e5a', 0.22);
  const hrivaB = kun.hrivaBarva || (krasa < 1 ? '#4a3f33' : HRIVA[(vz.hriva ?? 0) % HRIVA.length]);
  const doplnek = DOPLNKY[(vz.doplnek ?? 0) % DOPLNKY.length];
  const vyhubla = Math.max(0, 3 - kondice) / 3; // 1 = kost a kůže
  const svaly = sila / 8;
  const stoji = beh < 0.05 && vyska === 0;
  const kulha = stoji && kondice < 2;

  ctx.save();
  // stín
  ov(ctx, 0, 1, 44 * (1 - vyska * 0.35), 5, `rgba(0,0,0,${0.22 * (1 - vyska * 0.5)})`);
  // zakopnutí: kůň se nakloní dopředu
  ctx.translate(0, -vyska * 34 + (beh > 0 ? Math.abs(Math.sin(faze)) * -3 * beh : 0));
  ctx.rotate(zakopnuti * 0.28 + (stoji ? 0 : -vyska * 0.12) + (kulha ? Math.sin(t * 2) * 0.015 : 0));

  const nohaSirka = 5.2 + svaly * 1.6 - vyhubla * 0.8;
  const noha = (hx, hy, faz, predni, barva) => {
    let u, l;
    if (vyska > 0.05) { u = predni ? -1.0 * vyska : 0.9 * vyska; l = predni ? 1.6 * vyska : -1.2 * vyska; }
    else if (stoji) { u = 0; l = 0; if (kulha && !predni && faz > 1) { u = 0.15; l = -0.5; } }
    else { const f = faze + faz; u = Math.sin(f) * 0.75 * beh; l = (predni ? 1 : -1) * Math.max(0, Math.cos(f)) * 1.1 * beh; }
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(u);
    ctx.strokeStyle = barva; ctx.lineCap = 'round'; ctx.lineWidth = nohaSirka;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 19); ctx.stroke();
    ctx.translate(0, 19); ctx.rotate(l);
    ctx.lineWidth = nohaSirka * 0.72; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 17); ctx.stroke();
    // kopyto (od 4. věci krásy lesklé)
    ctx.fillStyle = krasa >= 4 ? (krasa >= 8 ? '#f5c518' : '#3a2a20') : '#5b4a3a';
    ctx.beginPath(); ctx.roundRect(-3.6, 15.5, 7.2, 5, 1.5); ctx.fill();
    if (krasa >= 4) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-2.5, 16.3, 2, 2); }
    ctx.restore();
  };
  const tmaveNohy = tmavsi(srst.startsWith('#') ? srst : '#7d6e5a', 0.32);
  // vzdálené nohy
  noha(-24, -42, Math.PI + 0.6, false, tmaveNohy);
  noha(22, -42, Math.PI + 2.2, true, tmaveNohy);

  // ocas
  const vlnaOcasu = Math.sin(t * 6 + faze) * (2 + beh * 6);
  ctx.strokeStyle = hrivaB; ctx.lineCap = 'round';
  if (krasa < 3) {
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-34, -56); ctx.quadraticCurveTo(-44 - i * 2, -48 + vlnaOcasu * 0.5, -40 - i * 3, -28 + i * 3 + vlnaOcasu * 0.3); ctx.stroke(); }
  } else {
    ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-34, -56); ctx.quadraticCurveTo(-50, -50 - beh * 6 + vlnaOcasu * 0.4, -48 - beh * 10, -26 - beh * 12 + vlnaOcasu); ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(-36, -55); ctx.quadraticCurveTo(-48, -48, -46 - beh * 10, -30 - beh * 12 + vlnaOcasu); ctx.stroke();
    if (krasa >= 5) { ctx.fillStyle = doplnek; ctx.beginPath(); ctx.moveTo(-39, -54); ctx.lineTo(-45, -60); ctx.lineTo(-44, -50); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(-39, -54); ctx.lineTo(-33, -61); ctx.lineTo(-35, -50); ctx.closePath(); ctx.fill(); }
  }

  // tělo
  const brucho = 15 - vyhubla * 3 + svaly * 1.5;
  ov(ctx, -2, -52, 36, brucho, srst);
  ov(ctx, -26, -54, 12, 13, srst); // záď
  ov(ctx, 20, -54, 13, 14 + svaly * 1.5, srst); // hrudník
  if (krasa >= 2) { // lesk
    const g = ctx.createLinearGradient(0, -68, 0, -40);
    g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-2, -54, 34, brucho - 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (krasa < 1) { // bláto
    for (const [x, y, r] of [[-20, -46, 6], [4, -58, 4.5], [14, -46, 5], [-8, -42, 4], [-30, -50, 3.5]]) ov(ctx, x, y, r, r * 0.7, 'rgba(90,70,40,0.55)');
  }
  if (vyhubla > 0) { // žebra
    ctx.strokeStyle = `rgba(0,0,0,${0.18 * vyhubla})`; ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-2 + i * 6, -50, 10, 1.2, 2.0); ctx.stroke(); }
  }
  // čabraka a sedlo
  if (krasa >= 6) {
    ctx.fillStyle = doplnek; ctx.beginPath(); ctx.roundRect(-16, -66, 26, 20, 5); ctx.fill();
    ctx.strokeStyle = '#f5c518'; ctx.lineWidth = 2; ctx.stroke();
  }
  if (jezdec) {
    ctx.fillStyle = '#6d3b1e'; ctx.beginPath(); ctx.ellipse(-4, -66, 13, 4.5, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(-12, -67, 18, 4);
  }

  // krk a hlava (nemocný kůň nese hlavu nízko)
  const kyv = Math.sin(faze * 2) * 2.5 * beh;
  const pokles = vyhubla * 10 + (stoji ? Math.sin(t * 1.5) * 1.2 : 0) - vyska * 4;
  const hx = 46 + beh * 4, hy = -86 + pokles + kyv;
  ctx.fillStyle = srst;
  ctx.beginPath();
  ctx.moveTo(14, -66); ctx.quadraticCurveTo(28, -78 + pokles * 0.5, hx - 8, hy - 6);
  ctx.lineTo(hx + 2, hy + 4); ctx.quadraticCurveTo(36, -60 + pokles * 0.4, 30, -44); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(0.75 + vyhubla * 0.25);
  ov(ctx, 0, 0, 9.5, 8, srst);
  ov(ctx, 11, 0.5, 10, 6.2, srst);
  ov(ctx, 17, 1, 5.5, 5.4, tmava);
  ov(ctx, 19, -0.5, 1.2, 1, 'rgba(0,0,0,0.55)');
  ctx.restore();
  // ucho
  ctx.fillStyle = srst; ctx.beginPath(); ctx.moveTo(hx - 6, hy - 6); ctx.lineTo(hx - 6 - (vyhubla * 4), hy - 17 + vyhubla * 3); ctx.lineTo(hx, hy - 8); ctx.closePath(); ctx.fill();
  // oko (unavené u nemocného koně)
  ov(ctx, hx + 2, hy - 1, 2.1, vyhubla > 0.5 ? 1 : 2.3, '#1d1d1d');
  if (vyhubla <= 0.5) ov(ctx, hx + 2.7, hy - 1.8, 0.7, 0.7, '#fff');
  // uzdečka
  ctx.strokeStyle = krasa >= 8 ? '#f5c518' : krasa >= 7 ? '#dfe6e9' : '#4a2c17'; ctx.lineWidth = 1.6;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(0.75 + vyhubla * 0.25);
  ctx.beginPath(); ctx.moveTo(9, -6); ctx.lineTo(10, 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3, -7); ctx.lineTo(9, -5); ctx.stroke();
  if (krasa >= 7) { for (let i = 0; i < 4; i++) ov(ctx, 8 + i * 2.5, -5 + Math.sin(i) * 1, 1, 1, '#fff'); }
  ctx.restore();
  if (jezdec) { ctx.strokeStyle = '#4a2c17'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx + 10, hy + 9); ctx.lineTo(22, -72); ctx.stroke(); }

  // hříva podél krku
  ctx.strokeStyle = hrivaB; ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const p = i / 7;
    const x = hx - 8 - p * (hx - 22), y = hy - 6 + p * (-66 - (hy - 6)) ;
    const vlna = Math.sin(t * 7 + i + faze) * (1 + beh * 2);
    if (krasa < 3) { // rozcuchaná
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7 + (i % 2) * 5, y - 6 - (i % 3) * 3 + vlna); ctx.stroke();
    } else if (krasa >= 5) { // zapletená s mašlemi
      ov(ctx, x - 1, y - 2, 3.4, 3.4, hrivaB);
      if (i % 3 === 1) { ctx.fillStyle = doplnek; ctx.beginPath(); ctx.moveTo(x - 1, y - 5); ctx.lineTo(x - 6, y - 9); ctx.lineTo(x - 5, y - 2); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 1, y - 5); ctx.lineTo(x + 4, y - 10); ctx.lineTo(x + 3, y - 3); ctx.closePath(); ctx.fill(); }
    } else { // učesaná
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 6, y + 1 + vlna, x - 9 - beh * 4, y + 5 + vlna); ctx.stroke();
    }
  }
  // ofina
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx - 5, hy - 8); ctx.quadraticCurveTo(hx + 2, hy - 10, hx + 4, hy - 4); ctx.stroke();

  // jezdkyně
  if (jezdec) nakresliJezdce(ctx, jezdec, { t, faze, beh, vyska });

  // blízké nohy
  noha(-20, -42, 0.3, false, srst);
  noha(26, -42, 1.5, true, srst);

  // třpytky u nejkrásnějšího koně
  if (krasa >= 8) {
    for (let i = 0; i < 5; i++) {
      const a = t * 1.3 + i * 1.7, x = Math.cos(a) * 46, y = -60 + Math.sin(a * 1.4) * 30, s = 1.5 + Math.sin(t * 6 + i) * 1.2;
      if (s > 0.5) { ctx.fillStyle = 'rgba(255,240,150,0.9)'; ctx.beginPath(); ctx.moveTo(x, y - s * 2); ctx.lineTo(x + s * 0.5, y); ctx.lineTo(x, y + s * 2); ctx.lineTo(x - s * 0.5, y); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - s * 2, y); ctx.lineTo(x, y + s * 0.5); ctx.lineTo(x + s * 2, y); ctx.lineTo(x, y - s * 0.5); ctx.closePath(); ctx.fill(); }
    }
  }
  ctx.restore();
}

// Jezdkyně v sedle (zjednodušená postavička: barvy z editoru postavičky nebo dres soupeře).
function nakresliJezdce(ctx, j, { faze, beh }) {
  const houp = Math.sin(faze * 2) * 1.6 * beh;
  ctx.save(); ctx.translate(0, houp);
  const predklon = 0.35 + beh * 0.35;
  // noha
  ctx.strokeStyle = j.kalhoty || '#2c3e75'; ctx.lineCap = 'round'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-4, -70); ctx.lineTo(7, -60); ctx.lineTo(4, -50); ctx.stroke();
  ctx.fillStyle = '#2b1d14'; ctx.beginPath(); ctx.ellipse(6, -48, 4.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  // trup
  ctx.save(); ctx.translate(-4, -70); ctx.rotate(predklon);
  ctx.fillStyle = j.triko || '#e74c3c'; ctx.beginPath(); ctx.roundRect(-5.5, -22, 11, 23, 5); ctx.fill();
  // culík za helmou
  ctx.strokeStyle = j.vlasy || '#6d4325'; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(-3, -31); ctx.quadraticCurveTo(-12, -30 + Math.sin(faze * 2) * 3, -15, -24 + Math.sin(faze * 2 + 1) * 4); ctx.stroke();
  // hlava a helma
  ov(ctx, 1, -30, 7.5, 7.5, j.kuze || '#f9d7b9');
  ov(ctx, 4, -30, 1.1, 1.3, '#222');
  ctx.fillStyle = j.helma || '#222'; ctx.beginPath(); ctx.arc(0.5, -32, 8.3, Math.PI * 1.02, Math.PI * 2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(7, -32.5, 4.5, 1.6, 0.1, 0, Math.PI * 2); ctx.fill();
  // ruka k otěžím
  ctx.strokeStyle = j.triko || '#e74c3c'; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(1, -18); ctx.lineTo(10, -8); ctx.stroke();
  ctx.strokeStyle = j.kuze || '#f9d7b9'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(13, -6); ctx.stroke();
  ctx.restore();
  ctx.restore();
}
