// Dukáty a dostihy – hlavní logika hry (obrazovky, truhly, dukáty, obchod, stáj, dostihy, ukládání).
// Postup se ukládá jen v prohlížeči (localStorage), žádný server. Kostra převzatá ze Strážců klýčú.
import { Mapa } from './mapa.js';
import { nakresliJezdkyni, VOLBY, POPISY, VYCHOZI, VOLBY_HOBBY, POPISY_HOBBY, VYCHOZI_HOBBY, NAZVY_VOLEB } from './postava.js';
import { vytvorUlohu, OPERACE, ZNAK, zamichej, hezky } from './ulohy.js';
import { spustUlohu, psaciPlocha } from './ulohy-ui.js';
import { nactiModel, ulozVzorek, smazRukopis, pocetVzorku } from './cislice.js';
import { zvuk, nastavZtlumeni } from './zvuky.js';
import { nakresliKone, VYCHOZI_KUN, SRST, NAZVY_SRSTI, HRIVA, DOPLNKY, stupne, dalsiVec, bonusKrasy, prezdivka } from './kun.js';
import { spustDostih } from './dostihy-ui.js';
import { MAX_STUPEN } from './dostihy.js';

const KLIC = 'dostihy-v1';
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);

// ---------- stav ----------
const VYCHOZI_NASTAVENI = {
  operace: { '+': true, '-': true, '×': true, ':': true }, minObt: 1, maxObt: 5, zivoty: 2, pauza: 1, obnova: 15,
  odpocinek: null, prenos: true, psani: true, pomoc: 0, zvuk: true, mapa: null,
};
let stav = nactiStav();
function nactiStav() {
  try {
    const s = JSON.parse(localStorage.getItem(KLIC));
    if (s && s.verze === 1) return { ...s, nastaveni: { ...VYCHOZI_NASTAVENI, ...s.nastaveni, operace: { ...VYCHOZI_NASTAVENI.operace, ...s.nastaveni?.operace } }, kun: { ...VYCHOZI_KUN, ...s.kun } };
  } catch { /* prázdné nebo zakázané úložiště */ }
  return {
    verze: 1, postava: null, hobby: null, kun: { ...VYCHOZI_KUN, koupeno: [] }, dukaty: 0, vydelano: 0, utraceno: 0,
    truhly: {}, pozice: null, odpocinek: 0, dostihy: { zavodu: 0, vyher: 0, ligy: {} }, stat: {}, chyby: [],
    nastaveni: { ...VYCHOZI_NASTAVENI },
  };
}
function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(stav)); } catch { /* nevadí */ } }

let mapa = null, dataMapy = null, mapyIndex = null, ukoly = null, obchod = null, zavodiste = null;
let panelOtevreny = false;

async function nactiJson(cesta) {
  const r = await fetch(cesta, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${cesta}: ${r.status}`);
  return r.json();
}
async function nactiData() {
  [mapyIndex, ukoly, obchod, zavodiste] = await Promise.all(['mapy', 'ukoly', 'obchod', 'dostihy'].map((s) => nactiJson(`data/${s}.json`)));
  const idMapy = params.get('mapa') || stav.nastaveni.mapa;
  const m = mapyIndex.mapy.find((x) => x.id === idMapy) || mapyIndex.mapy[0];
  if (stav.nastaveni.mapa && stav.nastaveni.mapa !== m.id) stav.truhly = {};
  stav.nastaveni.mapa = m.id;
  dataMapy = await nactiJson('data/' + m.soubor);
}

const startId = () => dataMapy.start;
const mesto = (id) => dataMapy.mesta.find((m) => m.id === id);
const mestoNazev = (id) => mesto(id)?.nazev || id;
const vKounicich = () => dataMapy.vLokale || `v ${mestoNazev(startId())}`;
const mestaSTruhlou = () => dataMapy.mesta.filter((m) => m.id !== startId());
const zapnuteOperace = () => { const o = OPERACE.filter((x) => stav.nastaveni.operace[x]); return o.length ? o : OPERACE; };
const st = () => stupne(stav.kun, obchod);
const odpocinekPo = () => stav.nastaveni.odpocinek ?? zavodiste.odpocinek ?? 2;
const dukatu = (n) => `${n} ${n === 1 ? 'dukát' : n >= 2 && n <= 4 ? 'dukáty' : 'dukátů'}`;
const truhel = (n) => `${n} ${n === 1 ? 'truhlu' : n >= 2 && n <= 4 ? 'truhly' : 'truhel'}`;

// ---------- truhly ----------
// Obtížnost truhly (= počet dukátů) roste se vzdáleností od Kounic, s trochou náhody.
// Operace se střídají tak, aby jich na mapě bylo zhruba stejně.
function novaTruhla(id) {
  const s = mesto(startId()), m = mesto(id);
  const max = Math.max(...mestaSTruhlou().map((x) => Math.hypot(x.x - s.x, x.y - s.y)));
  const d = Math.hypot(m.x - s.x, m.y - s.y) / max;
  const n = stav.nastaveni;
  const lo = Math.min(n.minObt, n.maxObt), hi = Math.max(n.minObt, n.maxObt);
  const obtiznost = Math.max(lo, Math.min(hi, Math.round(1 + d * 4 + (Math.random() - 0.5) * 2.2)));
  const pocty = Object.fromEntries(zapnuteOperace().map((o) => [o, 0]));
  for (const t of Object.values(stav.truhly)) if (t.stav !== 'prazdna' && pocty[t.op] !== undefined) pocty[t.op]++;
  const nejmene = Math.min(...Object.values(pocty));
  const op = zamichej(Object.keys(pocty).filter((o) => pocty[o] === nejmene))[0];
  stav.truhly[id] = { obtiznost, op, stav: 'plna', do: 0 };
}
function pripravTruhly() {
  for (const m of mestaSTruhlou()) {
    const t = stav.truhly[m.id];
    if (!t || !zapnuteOperace().includes(t.op) || (t.stav === 'plna' && (t.obtiznost < stav.nastaveni.minObt || t.obtiznost > stav.nastaveni.maxObt))) novaTruhla(m.id);
  }
  uloz();
}
function stavMesta(id) {
  if (id === startId()) return null;
  let t = stav.truhly[id];
  if (!t) { novaTruhla(id); t = stav.truhly[id]; uloz(); }
  if (t.stav !== 'plna' && t.do <= Date.now()) {
    if (t.stav === 'prazdna') novaTruhla(id); else t.stav = 'plna';
    t = stav.truhly[id]; uloz();
  }
  return { ...t, zbyva: t.stav === 'plna' ? 0 : (t.do - Date.now()) / 1000 };
}

// ---------- HUD ----------
function obnovHud() {
  $('#hud').hidden = false;
  $('#dukaty').textContent = stav.dukaty;
  const o = stav.odpocinek > 0;
  $('#kun-stav').innerHTML = `🐴 <small>${o ? `odpočívá (${stav.odpocinek})` : 'připravená'}</small>`;
  $('#kun-stav').classList.toggle('odpociva', o);
  nastavZtlumeni(!stav.nastaveni.zvuk);
}
function pridejDukaty(n, odkud) {
  const cil = $('#mesec').getBoundingClientRect();
  const z = odkud?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  for (let i = 0; i < n; i++) {
    const d = div('letici-dukat', '🪙');
    d.style.left = z.left + z.width / 2 + 'px'; d.style.top = z.top + z.height / 2 + 'px';
    d.style.setProperty('--dx', cil.left + cil.width / 2 - (z.left + z.width / 2) + 'px');
    d.style.setProperty('--dy', cil.top + cil.height / 2 - (z.top + z.height / 2) + 'px');
    d.style.animationDelay = i * 0.12 + 's';
    document.body.append(d);
    setTimeout(() => d.remove(), 1200 + i * 120);
  }
  stav.dukaty += n; stav.vydelano += n; uloz();
  zvuk.mince(n);
  setTimeout(() => { obnovHud(); $('#mesec').classList.remove('cink'); void $('#mesec').offsetWidth; $('#mesec').classList.add('cink'); }, 700 + n * 120);
}

let bublinaCas = null;
function bublina(text, ms = 6000) {
  const b = $('#bublina');
  b.innerHTML = text; b.hidden = false; b.classList.remove('ukaz'); void b.offsetWidth; b.classList.add('ukaz');
  clearTimeout(bublinaCas);
  if (ms) bublinaCas = setTimeout(() => { b.hidden = true; }, ms);
}
function napovez() {
  const dalsi = obchod.vlastnosti.map((v) => dalsiVec(stav.kun, obchod, v)).filter((x) => x.vec && !x.chybiZdravi).sort((a, b) => a.vec.cena - b.vec.cena)[0];
  if (dalsi && stav.dukaty >= dalsi.vec.cena) bublina(`Máš ${dukatu(stav.dukaty)}! <b>${vKounicich()}</b> si můžeš koupit ${dalsi.vec.ikona} ${dalsi.vec.nazev}. 🛒`);
  else if (stav.odpocinek <= 0 && stav.dostihy.zavodu === 0) bublina(`${stav.kun.jmeno} je připravená na první dostih <b>${vKounicich()}</b>. 🏇 Nebo nejdřív sbírej dukáty v truhličkách!`);
  else if (stav.odpocinek > 0) bublina(`${stav.kun.jmeno} odpočívá. Otevři ještě ${truhel(stav.odpocinek)} a může znovu závodit. ✨`);
  else bublina('Klepni na vesnici se zlatou truhličkou. Čím víc dukátů nad ní, tím těžší příklad. ✨');
}

// ---------- panel ----------
function otevriPanel(obsah, { zavritelny = true, trida = '' } = {}) {
  panelOtevreny = true;
  $('#bublina').hidden = true;
  const p = $('#panel');
  p.hidden = false;
  p.querySelector('.panel').className = 'panel ' + trida;
  $('#panel-zavrit').hidden = !zavritelny;
  const el = $('#panel-obsah');
  el.innerHTML = '';
  if (typeof obsah === 'string') el.innerHTML = obsah; else if (obsah) el.append(obsah);
  p.querySelector('.panel').scrollTop = 0;
  return el;
}
function zavriPanel() {
  panelOtevreny = false;
  $('#panel').hidden = true;
  $('#panel-obsah').innerHTML = '';
  animace.clear();
}
let naZavreni = null;
$('#panel-zavrit').onclick = () => { zvuk.klik(); const f = naZavreni; naZavreni = null; zavriPanel(); if (f) f(); };
const tlacitko = (text, onclick, trida = '') => { const b = document.createElement('button'); b.className = 'tl velke ' + trida; b.innerHTML = text; b.onclick = () => { zvuk.klik(); onclick(b); }; return b; };
const div = (trida, html = '') => { const d = document.createElement('div'); d.className = trida; d.innerHTML = html; return d; };

// kreslení náhledů na canvas v panelu (postavička, kůň) – jedna smyčka pro všechny
const animace = new Set();
(function smyckaNahledu() {
  const t = performance.now() / 1000;
  for (const f of animace) f(t);
  requestAnimationFrame(smyckaNahledu);
})();
function platno(trida, w, h, kresli) {
  const cv = document.createElement('canvas');
  cv.className = trida; cv.width = w * 2; cv.height = h * 2;
  const f = (t) => { if (!cv.isConnected) return; const c = cv.getContext('2d'); c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, w, h); kresli(c, t); };
  animace.add(f);
  return cv;
}
const vzhledKone = () => ({ vzhled: stav.kun, st: st() });
const jezdec = () => {
  const p = { ...VYCHOZI, ...(stav.postava || {}) };
  return { kuze: VOLBY.kuze[p.kuze % VOLBY.kuze.length], vlasy: VOLBY.barvaVlasu[p.barvaVlasu % VOLBY.barvaVlasu.length], triko: VOLBY.triko[p.triko % VOLBY.triko.length],
    helma: VOLBY.barvaHelmy[p.barvaHelmy % VOLBY.barvaHelmy.length], kalhoty: VOLBY.barvaSpodku[p.barvaSpodku % VOLBY.barvaSpodku.length] };
};
const platnoKone = (w = 300, h = 200, meritko = 1.6) => platno('nahled-kone', w, h, (c, t) => {
  c.translate(w / 2 - 6, h - 14); c.scale(meritko, meritko);
  nakresliKone(c, vzhledKone(), { t });
});

// ---------- holčička a hobbyhorse ----------
function obrazovkaPostavy(poDokonceni) {
  const vz = { ...VYCHOZI, ...(stav.postava || {}) };
  const hb = { ...VYCHOZI_HOBBY, ...(stav.hobby || {}) };
  const obal = div('postava-editor');
  obal.append(div('nadpis', stav.postava ? 'Uprav holčičku a koníka' : 'Kdo vyrazí na cestu?'));
  const radek = div('editor-radek');
  const cv = platno('nahled', 220, 270, (c, t) => {
    c.translate(100, 250); c.scale(2.9, 2.9);
    nakresliJezdkyni(c, vz, hb, { t, chuze: Math.sin(t * 0.7) > 0.3 ? 1 : 0, radost: 0 });
  });
  const volby = div('volby');
  radek.append(cv, volby);
  obal.append(radek);
  const zalozky = div('zalozky');
  const obsah = div('volby-obsah');
  const kreslitVolby = (co) => {
    obsah.innerHTML = '';
    zalozky.querySelectorAll('button').forEach((b) => b.classList.toggle('vybrany', b.dataset.co === co));
    const [V, P, cil] = co === 'holka' ? [VOLBY, POPISY, vz] : [VOLBY_HOBBY, POPISY_HOBBY, hb];
    const jmeno = document.createElement('input');
    jmeno.className = 'jmeno'; jmeno.maxLength = 16; jmeno.value = cil.jmeno || '';
    jmeno.placeholder = co === 'holka' ? 'Tvoje jméno' : 'Jméno koníka (nemusíš)';
    jmeno.oninput = () => { cil.jmeno = jmeno.value.trim(); };
    obsah.append(jmeno);
    for (const k of Object.keys(V)) {
      const r = div('volba');
      r.append(div('popis', P[k]));
      const moz = div('volba-moznosti');
      V[k].forEach((v, i) => {
        const b = document.createElement('button');
        b.className = 'vzorek' + (cil[k] === i ? ' vybrany' : '');
        if (String(v).startsWith('#')) b.style.background = v;
        else b.textContent = NAZVY_VOLEB[v] || v;
        b.onclick = () => { zvuk.klik(); cil[k] = i; moz.querySelectorAll('.vzorek').forEach((x, j) => x.classList.toggle('vybrany', j === i)); };
        moz.append(b);
      });
      r.append(moz);
      obsah.append(r);
    }
  };
  for (const [co, text] of [['holka', '👧 Holčička'], ['kun', '🐴 Hobbyhorse']]) {
    const b = document.createElement('button');
    b.className = 'tl zalozka'; b.dataset.co = co; b.textContent = text;
    b.onclick = () => { zvuk.klik(); kreslitVolby(co); };
    zalozky.append(b);
  }
  volby.append(zalozky, obsah);
  kreslitVolby('holka');
  obal.append(tlacitko('Hotovo, jedeme! ➜', () => { stav.postava = { ...vz }; stav.hobby = { ...hb }; uloz(); zavriPanel(); poDokonceni(); }, 'hlavni'));
  otevriPanel(obal, { zavritelny: !!stav.postava, trida: 'siroky' });
  naZavreni = null;
}

function uvod(dalsi) {
  const jmeno = stav.postava?.jmeno ? `, ${stav.postava.jmeno}` : '';
  const obal = div('uvod');
  obal.append(platnoKone(320, 190, 1.5));
  obal.append(div('pribeh', `<p><b>Ahoj${jmeno}!</b> ${vKounicich()[0].toUpperCase() + vKounicich().slice(1)} na tebe ve stáji čeká kobyla <b>${stav.kun.jmeno}</b>.</p>
    <p>Je stará, nemotorná, zablácená a sotva chodí. Na dostizích zakopne o každou překážku. Ale ty z ní můžeš udělat šampionku!</p>
    <p>Jezdi na koníkovi po kraji a otevírej truhličky. Každá se otevře, když spočítáš její příklad, a dá ti <b>1 až 5 dukátů</b>.
    Za dukáty ${vKounicich()} koupíš koni dobré jídlo, péči i trénink. A pak hurá na dostihy!</p>`));
  obal.append(tlacitko('Vyrazit! 🐴', () => { zavriPanel(); dalsi(); }, 'hlavni'));
  otevriPanel(obal, { zavritelny: false, trida: 'siroky' });
}

// ---------- vesnice a truhla ----------
function truhlaSvg(st, oteviraSe = false) {
  const vika = st === 'otevrena'
    ? `<path class="${oteviraSe ? 'vika-otevira' : ''}" d="M20 62 L26 22 Q70 6 114 22 L120 62Z" fill="#c68642" stroke="#7a4a1e" stroke-width="3"/>`
    : '<path d="M18 62 Q70 22 122 62Z" fill="#c68642" stroke="#7a4a1e" stroke-width="3"/>';
  const zare = st === 'otevrena' ? '<ellipse cx="70" cy="62" rx="46" ry="12" fill="#fff3a0" opacity=".9"/>' : '';
  const retez = st === 'zamcena' ? '<g stroke="#7f8c8d" stroke-width="6" stroke-linecap="round"><path d="M18 64 L122 116"/><path d="M122 64 L18 116"/></g><text x="70" y="98" font-size="26" text-anchor="middle">⏳</text>' : '';
  const zamek = st === 'zavrena' ? '<g transform="translate(70 80)"><path d="M-8 0 v-8 a8 8 0 0 1 16 0 v8" fill="none" stroke="#7b5e57" stroke-width="4"/><rect x="-12" y="-1" width="24" height="20" rx="4" fill="#f5c518" stroke="#a0782b" stroke-width="2"/><circle cx="0" cy="8" r="3" fill="#5d4037"/></g>' : '';
  return `<svg class="truhla-svg ${st}" viewBox="0 0 140 130">
    <ellipse cx="70" cy="122" rx="56" ry="7" fill="rgba(0,0,0,.18)"/>
    ${zare}<rect x="18" y="62" width="104" height="56" rx="6" fill="#8d5524" stroke="#5d3412" stroke-width="3"/>
    <rect x="18" y="74" width="104" height="7" fill="#f5c518"/>${vika}${zamek}${retez}</svg>`;
}
const stitekTruhly = (t) => `<div class="stitek-truhly"><span class="op">${ZNAK[t.op]}</span><span class="mince">${'🪙'.repeat(t.obtiznost)}</span><small>${ukoly.operace[t.op].nazev} · obtížnost ${t.obtiznost}</small></div>`;

async function navstevaMesta(id) {
  const t = stavMesta(id);
  const obal = div('mesto');
  obal.append(div('nadpis', mestoNazev(id)));
  const scena = div('truhla-scena');
  obal.append(scena);
  const plocha = div('plocha');
  obal.append(plocha);
  otevriPanel(obal, { trida: 'uloha-panel' });
  naZavreni = napovez;

  if (t.stav === 'prazdna') {
    scena.innerHTML = truhlaSvg('otevrena');
    const m = Math.ceil(t.zbyva / 60);
    plocha.append(div('pribeh', `Truhlička je prázdná, dukáty už máš. Znovu se naplní ${m <= 1 ? 'za chvilku' : `asi za ${m} minut`}. Zkus jinou vesnici!`));
    plocha.append(tlacitko('Jet dál ➜', () => { zavriPanel(); napovez(); }));
    return;
  }
  if (t.stav === 'zamcena') {
    scena.innerHTML = truhlaSvg('zamcena');
    const m = Math.ceil(t.zbyva / 60);
    plocha.append(div('pribeh', `Truhlička je zakletá ještě ${m <= 1 ? 'chvilku' : `asi ${m} minut`}. Zkus mezitím jinou vesnici a pak se vrať!`));
    plocha.append(tlacitko('Jet jinam ➜', () => { zavriPanel(); napovez(); }));
    return;
  }
  scena.innerHTML = truhlaSvg('zavrena');
  scena.insertAdjacentHTML('beforeend', stitekTruhly(t));
  plocha.append(div('pribeh', `Truhlička skrývá <b>${dukatu(t.obtiznost)}</b>. Otevře se, když správně spočítáš příklad.`));
  const tl = div('tlacitka');
  tl.append(tlacitko('🔓 Otevřít truhlu', () => resitTruhlu(id, t, scena, plocha), 'hlavni'));
  plocha.append(tl);
}

async function resitTruhlu(id, t, scena, plocha) {
  scena.classList.add('mala');
  plocha.innerHTML = '';
  const uEl = div('uloha');
  plocha.append(uEl);
  const uloha = vytvorUlohu(ukoly, t.op, t.obtiznost);
  const zivoty = stav.nastaveni.zivoty + (t.obtiznost >= 3 ? 1 : 0) + (t.obtiznost >= 5 ? 1 : 0);
  if (stav.nastaveni.psani) await nactiModel().catch(() => {}); // bez sítě zůstane klávesnice
  $('#panel-zavrit').hidden = true; // úloha se dodělá (nebo prohraje), neutíká se od ní
  const vysledek = await spustUlohu(uEl, uloha, { zivoty, prenos: stav.nastaveni.prenos, psani: stav.nastaveni.psani });
  $('#panel-zavrit').hidden = false;
  zapisStatistiku(t, uloha, vysledek);
  plocha.innerHTML = '';
  scena.classList.remove('mala');
  if (vysledek.ok) {
    stav.truhly[id] = { ...stav.truhly[id], stav: 'prazdna', do: Date.now() + stav.nastaveni.obnova * 60000 };
    if (stav.odpocinek > 0) stav.odpocinek--;
    uloz();
    scena.innerHTML = truhlaSvg('otevrena', true) + `<div class="vyletujici-dukaty">${'🪙'.repeat(t.obtiznost)}</div>`;
    pridejDukaty(t.obtiznost, scena);
    mapa.postava.radost = 1; setTimeout(() => { mapa.postava.radost = 0; }, 2000);
    plocha.append(div('pribeh', `<b>Hurá! Správně!</b> V truhle bylo <b>${dukatu(t.obtiznost)}</b>. Teď máš v měšci ${dukatu(stav.dukaty + 0)}.`));
    if (stav.odpocinek === 0 && vysledek.ok && stav.dostihy.zavodu > 0) plocha.append(div('pribeh male', `🐴 ${stav.kun.jmeno} si odpočinula a může zase závodit!`));
    plocha.append(tlacitko('Do měšce! 💰', () => { zavriPanel(); napovez(); }, 'hlavni'));
  } else {
    stav.truhly[id] = { ...stav.truhly[id], stav: 'zamcena', do: Date.now() + stav.nastaveni.pauza * 60000 };
    uloz();
    zvuk.smutne();
    scena.innerHTML = truhlaSvg('zamcena');
    plocha.append(div('pribeh', '<b>Ajaj, tentokrát to nevyšlo.</b> Truhla se zase zamkla.'));
    plocha.append(div('reseni', `<div class="reseni-nadpis">Správně to mělo být:</div>${uloha.reseni}`));
    plocha.append(div('pribeh male', `Musíš z vesnice odjet. Truhla se dá znovu zkusit za ${stav.nastaveni.pauza} ${stav.nastaveni.pauza === 1 ? 'minutu' : stav.nastaveni.pauza < 5 ? 'minuty' : 'minut'}.`));
    plocha.append(tlacitko('Odjet z vesnice ➜', () => { zavriPanel(); odjedZMesta(id); }));
  }
}

// Po neúspěchu holčička sama odjede k nejbližší sousední vesnici.
function odjedZMesta(id) {
  const nej = (mapa.sousede.get(id) || []).slice().sort((a, b) => a.len - b.len)[0];
  if (!nej) return napovez();
  const kam = nej.a === id ? nej.b : nej.a;
  bublina('Zkus jinou vesnici a pak se vrať. ⏳');
  mapa.jdi(kam).then(() => { stav.pozice = kam; uloz(); });
}

function zapisStatistiku(t, uloha, v) {
  const s = (stav.stat[t.op] ||= { ok: 0, chyb: 0, obt: {} });
  const o = (s.obt[t.obtiznost] ||= { ok: 0, chyb: 0 });
  if (v.ok) { s.ok++; o.ok++; } else { s.chyb++; o.chyb++; }
  for (const c of v.chyby) stav.chyby.unshift({ kdy: Date.now(), op: t.op, text: c });
  stav.chyby = stav.chyby.slice(0, 60);
  uloz();
}

// ---------- Kounice: stáj, obchod, dostihy ----------
function navstevaKounic() {
  const obal = div('kounice');
  obal.append(div('nadpis', `${mestoNazev(startId())} – stáj a závodiště`));
  const s = st();
  const horni = div('kounice-horni');
  horni.append(platnoKone(300, 190, 1.45));
  const info = div('kun-info');
  info.innerHTML = `<div class="kun-jmeno">${esc(stav.kun.jmeno)}</div><div class="kun-prezdivka">${prezdivka(s)}</div>
    ${radkyVlastnosti(s)}
    <div class="kun-odpocinek ${stav.odpocinek > 0 ? 'odpociva' : ''}">${stav.odpocinek > 0 ? `😴 Odpočívá. Může závodit, až otevřeš ještě <b>${truhel(stav.odpocinek)}</b>.` : '🏇 Je připravená závodit!'}</div>
    ${stav.dostihy.zavodu ? `<div class="kun-skore">🏁 dostihů: <b>${stav.dostihy.zavodu}</b> · 🥇 výher: <b>${stav.dostihy.vyher}</b></div>` : ''}`;
  horni.append(info);
  obal.append(horni);
  const tl = div('tlacitka kounice-tl');
  tl.append(tlacitko('🏇 Dostihy', () => vyberDostihu(), 'hlavni'));
  tl.append(tlacitko('🛒 Obchod pro koně', () => obchodPanel()));
  tl.append(tlacitko('🪮 Stáj: vzhled koně', () => stajPanel()));
  tl.append(tlacitko('👧 Holčička a koník', () => obrazovkaPostavy(() => navstevaKounic())));
  obal.append(tl);
  otevriPanel(obal, { trida: 'siroky' });
  naZavreni = napovez;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function radkyVlastnosti(s) {
  return `<div class="vlastnosti">${obchod.vlastnosti.map((v) => `<div class="vlastnost"><span class="v-ikona">${v.ikona}</span><span class="v-nazev">${v.nazev}</span>
    <span class="v-pruh">${[...Array(MAX_STUPEN)].map((_, i) => `<i class="${i < s[v.id] ? 'plny' : ''}"></i>`).join('')}</span></div>`).join('')}</div>`;
}

function obchodPanel() {
  const obal = div('obchod');
  obal.append(div('nadpis', '🛒 Obchod pro koně'));
  const horni = div('obchod-horni');
  horni.append(platnoKone(240, 150, 1.15));
  const mesec = div('obchod-mesec');
  horni.append(mesec);
  obal.append(horni);
  obal.append(div('pribeh male', obchod.popis));
  const karty = div('obchod-karty');
  obal.append(karty);
  const kresli = () => {
    mesec.innerHTML = `V měšci máš<br><b>🪙 ${stav.dukaty}</b>`;
    karty.innerHTML = '';
    const s = st();
    for (const v of obchod.vlastnosti) {
      const k = div('karta-vlastnosti');
      k.innerHTML = `<div class="kv-hlava"><span>${v.ikona} <b>${v.nazev}</b></span><span class="v-pruh">${[...Array(MAX_STUPEN)].map((_, i) => `<i class="${i < s[v.id] ? 'plny' : ''}"></i>`).join('')}</span></div>
        <div class="kv-ucinek">${v.ucinek}</div>
        <div class="kv-koupeno">${v.veci.map((x) => `<span class="${stav.kun.koupeno.includes(x.id) ? 'mam' : ''}" title="${esc(x.nazev)}">${x.ikona}</span>`).join('')}</div>`;
      const d = dalsiVec(stav.kun, obchod, v);
      if (d.hotovo) k.append(div('kv-hotovo', '⭐ Všechno koupeno!'));
      else {
        const vec = div('kv-vec', `<span class="kv-ikona">${d.vec.ikona}</span><span class="kv-nazev">${d.vec.nazev}</span>`);
        const b = document.createElement('button');
        b.className = 'tl koupit';
        const malo = stav.dukaty < d.vec.cena;
        b.innerHTML = `Koupit za 🪙 ${d.vec.cena}`;
        b.disabled = malo || d.chybiZdravi > 0;
        b.onclick = () => koupit(v, d.vec, b);
        vec.append(b);
        k.append(vec);
        if (d.chybiZdravi > 0) k.append(div('kv-proc', `❤️ Nejdřív potřebuje víc zdraví (aspoň ${d.zdravi}).`));
        else if (malo) k.append(div('kv-proc', `Chybí ještě ${dukatu(d.vec.cena - stav.dukaty)}.`));
      }
      karty.append(k);
    }
  };
  const koupit = (v, vec, b) => {
    if (stav.dukaty < vec.cena) return;
    stav.dukaty -= vec.cena; stav.utraceno += vec.cena;
    stav.kun.koupeno.push(vec.id);
    uloz(); obnovHud(); zvuk.nakup(); konfety(30);
    b.closest('.karta-vlastnosti').classList.add('koupeno');
    bublina(`${vec.ikona} <b>${vec.nazev}</b>! ${stav.kun.jmeno} je zase o kousek lepší. ${v.ikona}`, 3500);
    setTimeout(kresli, 350);
  };
  kresli();
  obal.append(tlacitko('← Zpět do stáje', () => navstevaKounic()));
  otevriPanel(obal, { trida: 'siroky' });
  naZavreni = napovez;
}

function stajPanel() {
  const obal = div('staj');
  obal.append(div('nadpis', '🪮 Stáj'));
  const radek = div('editor-radek');
  radek.append(platnoKone(300, 200, 1.55));
  const volby = div('volby');
  const jmeno = document.createElement('input');
  jmeno.className = 'jmeno'; jmeno.maxLength = 16; jmeno.value = stav.kun.jmeno; jmeno.placeholder = 'Jméno koně';
  jmeno.oninput = () => { stav.kun.jmeno = jmeno.value.trim() || 'Herka'; uloz(); };
  volby.append(jmeno);
  const s = st();
  const volba = (popis, klic, barvy, nazvy, poznamka = '') => {
    const r = div('volba');
    r.append(div('popis', popis + (poznamka ? ` <small>${poznamka}</small>` : '')));
    const moz = div('volba-moznosti');
    barvy.forEach((b, i) => {
      const e = document.createElement('button');
      e.className = 'vzorek' + (stav.kun[klic] === i ? ' vybrany' : '');
      e.style.background = b; if (nazvy) e.title = nazvy[i];
      e.onclick = () => { zvuk.klik(); stav.kun[klic] = i; uloz(); moz.querySelectorAll('.vzorek').forEach((x, j) => x.classList.toggle('vybrany', j === i)); };
      moz.append(e);
    });
    r.append(moz); volby.append(r);
  };
  volba('Barva srsti', 'srst', SRST, NAZVY_SRSTI, s.krasa < 1 ? '(pod blátem ji uvidíš až po koupeli 🛁)' : '');
  volba('Barva hřívy', 'hriva', HRIVA, null, s.krasa < 1 ? '(po koupeli 🛁)' : '');
  volba('Mašle a čabraka', 'doplnek', DOPLNKY, null, s.krasa < 5 ? '(mašle a čabraku koupíš v obchodě 🎀)' : '');
  radek.append(volby);
  obal.append(radek);
  obal.append(div('pribeh male', `${esc(stav.kun.jmeno)} je teď <b>${prezdivka(s)}</b>. ${s.kondice < 2 ? 'Je vyhublá a kulhá, potřebuje zdraví ❤️. ' : ''}${s.krasa < 1 ? 'Je celá zablácená, chtělo by to koupel 🛁.' : ''}`));
  obal.append(tlacitko('← Zpět do stáje', () => navstevaKounic()));
  otevriPanel(obal, { trida: 'siroky' });
  naZavreni = napovez;
}

// odhad šance podle síly koně proti soupeřům ligy (jen pro dítě jako vodítko)
function sanceLigy(liga) {
  const s = st();
  const kun = (s.rychlost + s.kondice + s.skok) / 3;
  const nej = Math.max(...liga.souperi.map((r) => (r[0] + r[1]) / 2));
  const r = kun - nej;
  return r < -2.2 ? ['malá', 'mala'] : r < -0.6 ? ['střední', 'stredni'] : ['velká', 'velka'];
}

function vyberDostihu() {
  const obal = div('vyber-dostihu');
  obal.append(div('nadpis', `🏇 ${zavodiste.nazev}`));
  if (stav.odpocinek > 0) {
    obal.append(div('pribeh', `😴 <b>${esc(stav.kun.jmeno)}</b> je po posledním dostihu unavená. Otevři ještě <b>${truhel(stav.odpocinek)}</b> a může znovu běžet.`));
    obal.append(tlacitko('Jdu na truhličky ➜', () => { zavriPanel(); napovez(); }, 'hlavni'));
    obal.append(tlacitko('← Zpět do stáje', () => navstevaKounic()));
    otevriPanel(obal, { trida: 'siroky' });
    naZavreni = napovez;
    return;
  }
  obal.append(div('pribeh male', 'Drž 🥕 <b>Pobídni</b>, ať kůň zrychlí (dokud má síly). Klepni na ⤴ <b>Skoč!</b>, když je kůň v zeleném pruhu před překážkou.'));
  const seznam = div('ligy');
  for (const liga of zavodiste.ligy) {
    const [sance, tr] = sanceLigy(liga);
    const l = div('liga');
    const vyhry = stav.dostihy.ligy[liga.id]?.vyher || 0;
    l.innerHTML = `<div class="liga-ikona">${liga.ikona}</div><div class="liga-text"><b>${liga.nazev}</b><small>${liga.popis}</small>
      <small>Výhra: 🥇 ${liga.ceny[0]} · 🥈 ${liga.ceny[1]} · 🥉 ${liga.ceny[2]} dukátů${vyhry ? ` · vyhráno ${vyhry}×` : ''}</small>
      <small class="sance ${tr}">Šance na výhru: ${sance}</small></div>`;
    const b = document.createElement('button');
    b.className = 'tl hlavni';
    b.innerHTML = liga.startovne ? `Startovné<br>🪙 ${liga.startovne}` : 'Start<br>zdarma';
    b.disabled = stav.dukaty < liga.startovne;
    b.onclick = () => { zvuk.klik(); zavod(liga); };
    l.append(b);
    seznam.append(l);
  }
  obal.append(seznam);
  obal.append(tlacitko('← Zpět do stáje', () => navstevaKounic()));
  otevriPanel(obal, { trida: 'siroky' });
  naZavreni = napovez;
}

async function zavod(liga) {
  if (stav.dukaty < liga.startovne || stav.odpocinek > 0) return;
  stav.dukaty -= liga.startovne; stav.utraceno += liga.startovne;
  uloz(); obnovHud();
  zavriPanel();
  $('#hud').hidden = true;
  const s = st();
  const { misto, poradi } = await spustDostih(liga, { jmeno: stav.kun.jmeno, st: s, vzhled: stav.kun, jezdec: jezdec(), pomoc: stav.nastaveni.pomoc });
  const cena = liga.ceny[misto - 1] || 0;
  const bonus = bonusKrasy(s.krasa);
  stav.dostihy.zavodu++;
  const l = (stav.dostihy.ligy[liga.id] ||= { zavodu: 0, vyher: 0, nejlepsi: 9 });
  l.zavodu++; l.nejlepsi = Math.min(l.nejlepsi, misto);
  if (misto === 1) { stav.dostihy.vyher++; l.vyher++; }
  stav.odpocinek = odpocinekPo();
  uloz(); obnovHud();
  const obal = div('vysledek-dostihu');
  const medaile = ['🥇', '🥈', '🥉', '🎗️'][misto - 1] || '🎗️';
  obal.append(div('nadpis', misto === 1 ? `Vítězství! ${medaile}` : `${misto}. místo ${medaile}`));
  obal.append(div('medaile-velka', medaile));
  obal.append(div('poradi', poradi.map((k, i) => `<div class="${k.hrac ? 'ja' : ''}"><b>${i + 1}.</b> ${esc(k.jmeno)}${k.hrac ? ' (ty)' : ''}</div>`).join('')));
  const texty = [];
  if (cena) texty.push(`Výhra: <b>${dukatu(cena)}</b>`);
  if (bonus) texty.push(`Diváci za krásu: <b>+${dukatu(bonus)}</b> ✨`);
  obal.append(div('pribeh', texty.length ? texty.join('<br>') : 'Tentokrát bez výhry. Příště to vyjde!'));
  obal.append(div('pribeh male', misto === 1 ? 'Paráda! Zkus někdy těžší dostih. 🏆' : misto <= 2 ? 'Skoro! Zkus skákat přesně v zeleném pruhu a šetřit síly na konec.' : 'Lepší kůň běží snáz: kup mu v obchodě sílu, obratnost a zdraví. 🛒'));
  obal.append(div('pribeh male', `😴 Teď si ${esc(stav.kun.jmeno)} musí odpočinout: otevři ${truhel(stav.odpocinek)}.`));
  const tl = tlacitko('Do stáje ➜', () => navstevaKounic(), 'hlavni');
  obal.append(tl);
  otevriPanel(obal, { zavritelny: false });
  if (misto === 1) { zvuk.fanfara(); konfety(); }
  if (cena + bonus) setTimeout(() => pridejDukaty(cena + bonus, obal.querySelector('.medaile-velka')), 500);
}

// ---------- nastavení pro rodiče ----------
function branaRodicu() {
  const obal = div('brana-rodicu');
  obal.append(div('nadpis', 'Pro rodiče'));
  obal.append(div('pribeh', 'Podrž tlačítko 2 sekundy.'));
  const b = document.createElement('button');
  b.className = 'tl velke drzet'; b.innerHTML = '<span class="plneni"></span><span class="txt">Podržet</span>';
  let cas = null;
  const zrus = () => { clearTimeout(cas); b.classList.remove('drzim'); };
  b.addEventListener('pointerdown', () => { b.classList.add('drzim'); cas = setTimeout(() => { zavriPanel(); nastaveni(); }, 2000); });
  b.addEventListener('pointerup', zrus); b.addEventListener('pointerleave', zrus); b.addEventListener('pointercancel', zrus);
  obal.append(b);
  otevriPanel(obal);
  naZavreni = null;
}

function nastaveni() {
  const n = stav.nastaveni;
  const obal = div('nastaveni');
  obal.append(div('nadpis', 'Nastavení'));
  const radek = (popis, prvek) => { const r = div('nast-radek'); r.append(div('nast-popis', popis), prvek); obal.append(r); return r; };
  const posuvnik = (min, max, hodnota, format, zmena) => {
    const w = div('posuvnik');
    const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.value = hodnota;
    const out = div('hodnota', format(hodnota));
    i.oninput = () => { out.textContent = format(+i.value); zmena(+i.value); uloz(); };
    w.append(i, out); return w;
  };
  const ops = div('temata');
  for (const o of OPERACE) {
    const l = document.createElement('label');
    const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!n.operace[o];
    c.onchange = () => { n.operace[o] = c.checked; pripravTruhly(); };
    l.append(c, ` ${ZNAK[o]}  ${ukoly.operace[o].nazev}`);
    ops.append(l);
  }
  radek('Co se počítá', ops);
  radek('Nejnižší obtížnost truhly', posuvnik(1, 5, n.minObt, (v) => '🪙'.repeat(v), (v) => { n.minObt = v; pripravTruhly(); }));
  radek('Nejvyšší obtížnost truhly', posuvnik(1, 5, n.maxObt, (v) => '🪙'.repeat(v), (v) => { n.maxObt = v; pripravTruhly(); }));
  radek('Srdíček v úloze (u obtížnosti 3+ o jedno, u 5 o dvě víc)', posuvnik(1, 5, n.zivoty, (v) => '❤️'.repeat(v), (v) => { n.zivoty = v; }));
  radek('Pauza truhly po chybě', posuvnik(1, 15, n.pauza, (v) => `${v} min`, (v) => { n.pauza = v; }));
  radek('Prázdná truhla se znovu naplní za', posuvnik(1, 120, n.obnova, (v) => `${v} min`, (v) => { n.obnova = v; }));
  radek('Odpočinek koně po dostihu', posuvnik(0, 6, odpocinekPo(), (v) => (v ? `${truhel(v)}` : 'bez odpočinku'), (v) => { n.odpocinek = v; if (stav.odpocinek > v) stav.odpocinek = v; obnovHud(); }));
  radek('Soupeři v dostizích čekají na slabšího koně', posuvnik(0, 3, n.pomoc * 2, (v) => ['normálně', 'trochu víc', 'víc', 'hodně'][v], (v) => { n.pomoc = v / 2; }));
  const pr = document.createElement('input'); pr.type = 'checkbox'; pr.checked = n.prenos;
  pr.onchange = () => { n.prenos = pr.checked; uloz(); };
  radek('Ukazovat přenos nad sloupcem („1 si pamatuj“)', pr);
  const ps = document.createElement('input'); ps.type = 'checkbox'; ps.checked = n.psani;
  ps.onchange = () => { n.psani = ps.checked; uloz(); if (n.psani) nactiModel().catch(() => {}); };
  const psObal = div('psani-nast');
  psObal.append(ps, div('male', `Vypnuto = číselná klávesnice. ${pocetVzorku() ? `Hra zná ${pocetVzorku()} vzorků rukopisu.` : 'Hra se zatím neučila rukopis.'}`),
    tlacitko('✏️ Naučit hru můj rukopis', () => { zavriPanel(); uceniRukopisu(); }));
  if (pocetVzorku()) { const sm = tlacitko('Zapomenout rukopis', () => { smazRukopis(); sm.remove(); }, 'male-tl'); psObal.append(sm); }
  radek('Číslice psát tužkou nebo prstem', psObal);
  const zv = document.createElement('input'); zv.type = 'checkbox'; zv.checked = n.zvuk;
  zv.onchange = () => { n.zvuk = zv.checked; uloz(); obnovHud(); };
  radek('Zvuky', zv);

  const sta = div('statistika');
  let html = '<table><tr><th>Počítání</th><th>vyřešeno</th><th>nepovedlo se</th><th>podle obtížnosti (✓/✗)</th></tr>';
  for (const o of OPERACE) {
    const s = stav.stat[o];
    html += `<tr><td>${ZNAK[o]} ${ukoly.operace[o].nazev}</td><td>${s?.ok || 0}</td><td>${s?.chyb || 0}</td><td>${[1, 2, 3, 4, 5].map((i) => (s?.obt?.[i] ? `${i}: ${s.obt[i].ok}/${s.obt[i].chyb}` : '')).filter(Boolean).join(' · ')}</td></tr>`;
  }
  html += '</table>';
  html += `<p>Dukátů vyděláno celkem: <b>${stav.vydelano}</b>, utraceno: <b>${stav.utraceno}</b>. Dostihů: <b>${stav.dostihy.zavodu}</b>, výher: <b>${stav.dostihy.vyher}</b>.</p>`;
  if (stav.chyby.length) {
    html += '<div class="posledni-chyby"><b>Poslední chyby</b><ul>' + stav.chyby.slice(0, 25).map((c) =>
      `<li><small>${new Date(c.kdy).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</small> ${esc(c.text)}</li>`).join('') + '</ul></div>';
  }
  sta.innerHTML = html;
  radek('Jak se daří', sta);

  const tl = div('tlacitka');
  tl.append(tlacitko('Upravit holčičku a koníka', () => { zavriPanel(); obrazovkaPostavy(napovez); }));
  if (document.fullscreenEnabled) tl.append(tlacitko('Celá obrazovka', () => { document.documentElement.requestFullscreen?.(); }));
  const reset = tlacitko('Začít úplně znovu', () => {
    if (!reset.dataset.potvrd) { reset.dataset.potvrd = 1; reset.innerHTML = 'Opravdu smazat dukáty, koně i postup? Klepni znovu.'; return; }
    localStorage.removeItem(KLIC); location.reload();
  }, 'nebezpecne');
  tl.append(reset);
  obal.append(tl);
  otevriPanel(obal, { trida: 'siroky' });
  naZavreni = napovez;
}

// ---------- učení rukopisu: každou číslici napsat dvakrát ----------
function uceniRukopisu() {
  const poradi = [...zamichej([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), ...zamichej([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])];
  let i = 0, poznano = 0;
  const obal = div('uceni-rukopisu');
  obal.append(div('nadpis', '✏️ Naučím se tvůj rukopis'));
  const vyzva = div('vyzva-rukopis');
  const prubeh = div('male');
  const ukaz = () => { vyzva.innerHTML = `Napiš číslici <b>${poradi[i]}</b>`; prubeh.textContent = `${i + 1} / ${poradi.length}`; };
  const plocha = psaciPlocha(() => {}, false, (r) => {
    if (i >= poradi.length) return;
    ulozVzorek(poradi[i], r.rysy);
    if (Number(r.cislice) === poradi[i]) poznano++;
    zvuk.klik();
    i++;
    if (i < poradi.length) { ukaz(); return; }
    plocha.remove();
    vyzva.innerHTML = `Hotovo! 🎉 Hned napoprvé jsem správně přečetl <b>${poznano} z ${poradi.length}</b> číslic. Teď už tvůj rukopis znám líp.`;
    prubeh.textContent = '';
    const tl = div('tlacitka'); tl.append(tlacitko('Hotovo', () => zavriPanel(), 'hlavni')); obal.append(tl);
  });
  ukaz();
  obal.append(vyzva, plocha, prubeh);
  otevriPanel(obal);
  naZavreni = napovez;
}

// ---------- drobnosti ----------
function splash() {
  return new Promise((hotovo) => {
    const el = $('#splash');
    el.querySelector('.splash-stat').innerHTML = stav.postava
      ? `V měšci: <b>🪙 ${stav.dukaty}</b> · ${esc(stav.kun.jmeno)} je ${prezdivka(st())}${stav.dostihy.vyher ? ` · 🥇 ${stav.dostihy.vyher}×` : ''}`
      : '';
    const cv = el.querySelector('canvas');
    const f = (t) => {
      if (el.hidden) return;
      const c = cv.getContext('2d'); c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, 340, 170);
      c.save(); c.translate(150, 160); c.scale(1.35, 1.35);
      nakresliKone(c, { vzhled: { srst: 2, hriva: 2, doplnek: 1 }, st: { krasa: 8, kondice: 8, rychlost: 6 } }, { t, faze: t * 9, beh: 1, jezdec: jezdec() });
      c.restore();
    };
    animace.add(f);
    el.hidden = false;
    el.querySelector('.splash-hrat').onclick = () => {
      zvuk.mince(3);
      el.classList.add('pryc');
      setTimeout(() => { el.hidden = true; el.classList.remove('pryc'); animace.delete(f); hotovo(); }, 500);
    };
  });
}
function konfety(pocet = 80) {
  const el = $('#konfety');
  const barvy = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#ff6fa8'];
  for (let i = 0; i < pocet; i++) {
    const k = document.createElement('i');
    k.style.left = Math.random() * 100 + 'vw';
    k.style.background = barvy[i % barvy.length];
    k.style.animationDelay = Math.random() * 0.6 + 's';
    k.style.animationDuration = 1.8 + Math.random() * 1.5 + 's';
    el.append(k);
    setTimeout(() => k.remove(), 4200);
  }
}

// ---------- start ----------
let posledniKrok = 0;
async function start() {
  if (stav.nastaveni.psani) nactiModel().catch(() => {}); // psaní tužkou: síť se načte dopředu
  try { await nactiData(); }
  catch (e) { $('#nacitani').textContent = 'Mapu se nepodařilo načíst: ' + e.message; return; }
  if (!dataMapy.mesta.some((m) => m.id === stav.pozice)) stav.pozice = startId();
  pripravTruhly();

  mapa = new Mapa($('#mapa'), dataMapy, {
    naKlepnuti: async (id) => {
      if (panelOtevreny || mapa.postava.cesta || document.querySelector('.dostih')) return;
      zvuk.klik();
      $('#bublina').hidden = true;
      if (mapa.postava.mesto !== id) {
        const dojel = await mapa.jdi(id);
        if (!dojel) return;
        stav.pozice = id; uloz();
      }
      if (id === startId()) navstevaKounic(); else navstevaMesta(id);
    },
    stavMesta,
    vzhled: () => stav.postava || VYCHOZI,
    hobby: () => stav.hobby || VYCHOZI_HOBBY,
    krok: (s) => { if (s - posledniKrok > 30 || s < posledniKrok) { posledniKrok = s; zvuk.kopyto(); } },
  });
  mapa.postavaNa(stav.pozice);
  let posledni = performance.now();
  const smycka = (t) => {
    const dt = Math.min(0.05, (t - posledni) / 1000); posledni = t;
    if (!document.querySelector('.dostih')) mapa.snimek(dt); // během dostihu se mapa nekreslí
    requestAnimationFrame(smycka);
  };
  requestAnimationFrame(smycka);
  $('#nacitani').hidden = true;

  $('#tl-nastaveni').onclick = () => { if (!mapa.postava.cesta && !panelOtevreny) { zvuk.klik(); branaRodicu(); } };
  $('#mesec').onclick = () => { zvuk.klik(); napovez(); };
  $('#kun-stav').onclick = async () => {
    if (panelOtevreny || mapa.postava.cesta) return;
    zvuk.klik();
    if (mapa.postava.mesto !== startId()) { bublina(`Jedeme za ${esc(stav.kun.jmeno)} do Kounic! 🐴`, 2500); const ok = await mapa.jdi(startId()); if (!ok) return; stav.pozice = startId(); uloz(); }
    navstevaKounic();
  };

  await splash();
  if (!stav.postava) obrazovkaPostavy(() => { obnovHud(); uvod(napovez); });
  else { obnovHud(); napovez(); }
}
// Tajný kód pro rodiče: napsat HOPHOP na klávesnici = 20 dukátů (na zkoušení obchodu a dostihů bez počítání).
let tajne = '';
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.key.length !== 1) return;
  tajne = (tajne + e.key.toUpperCase()).slice(-6);
  if (tajne !== 'HOPHOP') return;
  tajne = '';
  pridejDukaty(20);
  bublina('🪄 Kouzlo HOPHOP! Do měšce přibylo 20 dukátů.', 3000);
});

start();

// háčky pro automatické testy
window.__ds = { get stav() { return stav; }, get mapa() { return mapa; }, uloz, nastaveni, uceniRukopisu, obnovHud, navstevaMesta, navstevaKounic, obchodPanel, stajPanel, vyberDostihu, zavod, pridejDukaty, hezky };
