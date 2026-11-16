// Strážcy klýčú – hlavní logika hry (obrazovky, postup, ukládání).
// Postup se ukládá jen v prohlížeči (localStorage), žádný server.
import { Mapa } from './mapa.js';
import { nakresliPostavu, VOLBY, POPISY, VYCHOZI } from './postava.js';
import { vytvorUlohu, vytvorZamek, zamichej } from './ulohy.js';
import { spustUlohu, zobrazZamek } from './ulohy-ui.js';
import { zvuk, nastavZtlumeni, umimMluvit } from './zvuky.js';
import { NALEPKY, nalepka, vyberNalepku, hodnost } from './nalepky.js';

const KLIC = 'marketka-v1'; // původní název hry, ať se neztratí uložený postup
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);

// ---------- stav ----------
const VYCHOZI_NASTAVENI = { zamku: 10, truhelNaKlic: 2, pauza: 1, zivoty: 2, temata: {}, mapa: null, balik: null, zvuk: true };
let stav = nactiStav();
function nactiStav() {
  try {
    const s = JSON.parse(localStorage.getItem(KLIC));
    if (s && s.verze === 1) { // v1: klíč za každou truhlu, pauza 5 min → nové výchozí hodnoty
      s.verze = 2;
      s.nastaveni = { ...s.nastaveni, truhelNaKlic: 2, pauza: s.nastaveni?.pauza === 5 ? 1 : s.nastaveni?.pauza };
    }
    if (s && s.verze === 2) return { ...s, nastaveni: { ...VYCHOZI_NASTAVENI, ...s.nastaveni } };
  } catch { /* prázdné nebo zakázané úložiště */ }
  return { verze: 2, postava: null, nastaveni: { ...VYCHOZI_NASTAVENI }, kolo: null, pozice: null, nalepky: [], hradu: 0, stat: {}, chyby: [] };
}
function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(stav)); } catch { /* nevadí */ } }

let mapa = null, dataMapy = null, temata = [], mapyIndex = null, ukolyIndex = null, odmeny = null;
let panelOtevreny = false;

async function nactiJson(cesta) {
  const r = await fetch(cesta, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${cesta}: ${r.status}`);
  return r.json();
}

async function nactiData() {
  [mapyIndex, ukolyIndex, odmeny] = await Promise.all([nactiJson('data/mapy.json'), nactiJson('data/ukoly.json'),
    nactiJson('data/odmeny.json').catch(() => null)]); // komnaty hradu jsou nepovinné
  const idMapy = params.get('mapa') || stav.nastaveni.mapa;
  const m = mapyIndex.mapy.find((x) => x.id === idMapy) || mapyIndex.mapy[0];
  stav.nastaveni.mapa = m.id;
  dataMapy = await nactiJson('data/' + m.soubor);
  const idBaliku = params.get('ukoly') || stav.nastaveni.balik;
  const b = ukolyIndex.baliky.find((x) => x.id === idBaliku) || ukolyIndex.baliky[0];
  stav.nastaveni.balik = b.id;
  temata = await Promise.all(b.temata.map((s) => nactiJson('data/' + s)));
  for (const t of temata) if (stav.nastaveni.temata[t.id] === undefined) stav.nastaveni.temata[t.id] = true;
}

const startId = () => dataMapy.start;
const mestoNazev = (id) => dataMapy.mesta.find((m) => m.id === id)?.nazev || id;
const mestaSTruhlou = () => dataMapy.mesta.filter((m) => m.id !== startId());
const naKlic = () => Math.max(1, stav.nastaveni.truhelNaKlic || 1);
const maxZamku = () => Math.floor(mestaSTruhlou().length / naKlic());
const zapnutaTemata = () => {
  const z = temata.filter((t) => stav.nastaveni.temata[t.id]);
  return z.length ? z : temata;
};

function noveKolo() {
  const cislo = (stav.kolo?.cislo || 0) + 1;
  const zamku = Math.min(stav.nastaveni.zamku, maxZamku());
  stav.kolo = { cislo, zamku, otevreno: 0, klice: 0, kousky: 0, cas: 0, hotova: [], zamceno: {}, temata: {} };
  rozdelTemata();
  uloz();
}
// Každé vesnici přidělí téma tak, aby se střídala rovnoměrně.
function rozdelTemata() {
  const t = zamichej(zapnutaTemata().map((x) => x.id));
  zamichej(mestaSTruhlou()).forEach((m, i) => { stav.kolo.temata[m.id] = t[i % t.length]; });
}
function temaMesta(id) {
  let t = temata.find((x) => x.id === stav.kolo.temata[id] && stav.nastaveni.temata[x.id]);
  if (!t) { t = zamichej(zapnutaTemata())[0]; stav.kolo.temata[id] = t.id; uloz(); }
  return t;
}

function stavMesta(id) {
  if (!stav.kolo) return null;
  if (stav.kolo.hotova.includes(id)) return { stav: 'otevrena' };
  const do_ = stav.kolo.zamceno[id];
  if (do_ && do_ > Date.now()) return { stav: 'zamcena', zbyva: (do_ - Date.now()) / 1000 };
  return { stav: 'zavrena' };
}
const zbyvaKlicu = () => stav.kolo.zamku - stav.kolo.otevreno - stav.kolo.klice;

// ---------- HUD ----------
function obnovHud() {
  $('#hud').hidden = false;
  const k = stav.kolo;
  const pul = k.kousky ? `<span class="pulklic" title="kousek klíče">🗝️<small>${k.kousky}/${naKlic()}</small></span>` : '';
  $('#klice').innerHTML = (k.klice ? '🗝️'.repeat(Math.min(k.klice, 6)) + (k.klice > 6 ? `<b>×${k.klice}</b>` : '') : '') + pul || '<i>prázdná</i>';
  $('#hrad-stav').innerHTML = `🏰 <span class="zamky">${'🔓'.repeat(k.otevreno)}${'🔒'.repeat(Math.max(0, k.zamku - k.otevreno))}</span>`;
  $('#pocet-nalepek').textContent = stav.nalepky.length;
  nastavZtlumeni(!stav.nastaveni.zvuk);
}

let bublinaCas = null;
function bublina(text, ms = 6000) {
  const b = $('#bublina');
  b.innerHTML = text; b.hidden = false; b.classList.remove('ukaz'); void b.offsetWidth; b.classList.add('ukaz');
  clearTimeout(bublinaCas);
  if (ms) bublinaCas = setTimeout(() => { b.hidden = true; }, ms);
}
function napovez() {
  const k = stav.kolo, hrad = mestoNazev(startId());
  if (k.klice > 0 && k.klice >= k.zamku - k.otevreno) bublina(`Máš všechny klíče! Běž na hrad do města <b>${hrad}</b>. 🏰`, 0);
  else if (k.klice > 0) bublina(`V brašně máš ${k.klice === 1 ? 'klíč' : 'klíče'}. Můžeš hledat dál, nebo je zanést na hrad (<b>${hrad}</b>).`);
  else if (k.kousky) bublina(`Máš kousek klíče. Otevři ještě ${naKlic() - k.kousky === 1 ? 'jednu truhlu' : `${naKlic() - k.kousky} truhly`} a klíč bude celý! ✨`);
  else bublina('Klepni na vesnici se zlatou truhličkou a vyraz tam! ✨');
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
  return el;
}
function zavriPanel() {
  panelOtevreny = false;
  $('#panel').hidden = true;
  $('#panel-obsah').innerHTML = '';
}
let naZavreni = null;
$('#panel-zavrit').onclick = () => { zvuk.klik(); const f = naZavreni; naZavreni = null; zavriPanel(); if (f) f(); };
const tlacitko = (text, onclick, trida = '') => { const b = document.createElement('button'); b.className = 'tl velke ' + trida; b.innerHTML = text; b.onclick = () => { zvuk.klik(); onclick(); }; return b; };
const div = (trida, html = '') => { const d = document.createElement('div'); d.className = trida; d.innerHTML = html; return d; };

// ---------- postavička ----------
function obrazovkaPostavy(poDokonceni) {
  const vz = { ...VYCHOZI, ...(stav.postava || {}) };
  const obal = div('postava-editor');
  obal.append(div('nadpis', stav.postava ? 'Uprav svou postavičku' : 'Kdo vyrazí na cestu?'));
  const radek = div('editor-radek');
  const cv = document.createElement('canvas');
  cv.className = 'nahled'; cv.width = 360; cv.height = 440;
  const volby = div('volby');
  radek.append(cv, volby);
  obal.append(radek);
  let t = 0, bezi = true;
  const kresli = () => {
    if (!bezi) return;
    t += 0.016;
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    c.translate(180, 400); c.scale(4.2, 4.2);
    nakresliPostavu(c, vz, { t, chuze: 0, radost: (Math.sin(t * 0.8) > 0.6 ? 1 : 0) });
    requestAnimationFrame(kresli);
  };
  kresli();
  const jmeno = document.createElement('input');
  jmeno.className = 'jmeno'; jmeno.placeholder = 'Jméno (nemusíš)'; jmeno.maxLength = 16; jmeno.value = vz.jmeno || '';
  jmeno.oninput = () => { vz.jmeno = jmeno.value.trim(); };
  volby.append(jmeno);
  for (const k of Object.keys(VOLBY)) {
    const r = div('volba');
    r.append(div('popis', POPISY[k]));
    const moz = div('volba-moznosti');
    VOLBY[k].forEach((v, i) => {
      const b = document.createElement('button');
      b.className = 'vzorek' + (vz[k] === i ? ' vybrany' : '');
      if (String(v).startsWith('#')) b.style.background = v;
      else b.textContent = { kratke: 'krátké', culiky: 'culíky', cop: 'cop', kudrny: 'kudrny', dlouhe: 'dlouhé', jezek: 'ježek',
        kalhoty: 'kalhoty', sukne: 'sukně', kratasy: 'kraťasy', nic: '–', kulich: 'kulich', klobouk: 'klobouk', korunka: 'korunka',
        ksiltovka: 'kšiltovka', kvetina: 'kytička' }[v] || v;
      b.onclick = () => { zvuk.klik(); vz[k] = i; moz.querySelectorAll('.vzorek').forEach((x, j) => x.classList.toggle('vybrany', j === i)); };
      moz.append(b);
    });
    r.append(moz);
    volby.append(r);
  }
  obal.append(tlacitko('Hotovo, jdeme na to! ➜', () => { bezi = false; stav.postava = { ...vz }; uloz(); zavriPanel(); poDokonceni(); }, 'hlavni'));
  otevriPanel(obal, { zavritelny: !!stav.postava, trida: 'siroky' });
  naZavreni = () => { bezi = false; };
}

// ---------- hrad ----------
function svgHradu(zamku, otevreno, brana = false) {
  const zamky = [];
  const naRadek = Math.min(zamku, 8);
  for (let i = 0; i < zamku; i++) {
    const r = Math.floor(i / naRadek), s = i % naRadek;
    const vRadku = Math.min(naRadek, zamku - r * naRadek);
    const x = 200 + (s - (vRadku - 1) / 2) * 34, y = 172 + r * 40;
    const o = i < otevreno;
    zamky.push(`<g class="visak ${o ? 'otevreny' : ''}" data-i="${i}" transform="translate(${x} ${y})">
      <path d="M-7 -2 v-7 a7 7 0 0 1 14 0 ${o ? 'v-6' : 'v7'}" fill="none" stroke="#7b5e57" stroke-width="3.5" class="okovy"/>
      <rect x="-11" y="-3" width="22" height="19" rx="4" fill="${o ? '#7dcea0' : '#f5c518'}" stroke="#a0782b" stroke-width="1.5"/>
      <circle cx="0" cy="5" r="2.6" fill="#5d4037"/><rect x="-1" y="6" width="2" height="5" fill="#5d4037"/></g>`);
  }
  return `<svg class="hrad-svg ${brana ? 'brana-otevrena' : ''}" viewBox="0 0 400 300">
    <defs><linearGradient id="nebe" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8fd3f4"/><stop offset="1" stop-color="#e0f4ff"/></linearGradient></defs>
    <rect width="400" height="300" rx="18" fill="url(#nebe)"/>
    <ellipse cx="200" cy="300" rx="260" ry="60" fill="#8bc34a"/>
    <g fill="#d8cfc0" stroke="#a99f90" stroke-width="2">
      <rect x="60" y="110" width="280" height="160"/>
      <rect x="40" y="70" width="60" height="200"/><rect x="300" y="70" width="60" height="200"/>
      <rect x="160" y="40" width="80" height="80"/>
    </g>
    <g fill="#d8cfc0">${[...Array(12)].map((_, i) => `<rect x="${66 + i * 23}" y="96" width="13" height="16"/>`).join('')}</g>
    <path d="M32 72 L70 18 L108 72Z M292 72 L330 18 L368 72Z M152 42 L200 -2 L248 42Z" fill="#c0392b"/>
    <g fill="#3d3d55"><rect x="62" y="110" width="16" height="24" rx="8"/><rect x="322" y="110" width="16" height="24" rx="8"/><rect x="190" y="62" width="20" height="30" rx="10"/></g>
    <g class="vlajky" fill="#e74c3c"><path d="M70 18 v-16 l20 6 l-20 6"/><path d="M330 18 v-16 l20 6 l-20 6"/></g>
    <path class="brana" d="M150 270 V180 a50 50 0 0 1 100 0 V270Z" fill="#6d4c41" stroke="#4e342e" stroke-width="3"/>
    <path class="brana-svetlo" d="M150 270 V180 a50 50 0 0 1 100 0 V270Z" fill="#fff6c8"/>
    ${zamky.join('')}
  </svg>`;
}

function uvodHradu(dalsi) {
  const k = stav.kolo;
  const jmeno = stav.postava?.jmeno ? `, ${stav.postava.jmeno}` : '';
  const obal = div('uvod');
  obal.innerHTML = svgHradu(k.zamku, k.otevreno) +
    `<div class="pribeh"><p><b>Ahoj${jmeno}!</b> Na hradě je schovaný poklad, ale někdo ho zamkl na <b>${k.zamku} zámků</b>.</p>
     <p>Klíče jsou ukryté v truhličkách po celém kraji${naKlic() > 1 ? `. Každý klíč je rozlomený na ${naKlic() === 2 ? 'dvě půlky' : `${naKlic()} kousky`} a každý kousek je v jiné truhle` : ''}. Truhličky jsou kouzelné: otevřou se jen tomu, kdo vyluští jejich hádanku.</p>
     <p>Najdi klíče, přines je na hrad a odemkni ho!</p></div>`;
  obal.append(tlacitko('Vyrazit na cestu! 🗺️', () => { zavriPanel(); dalsi(); }, 'hlavni'));
  otevriPanel(obal, { zavritelny: false, trida: 'siroky' });
}

async function navstevaHradu() {
  const k = stav.kolo;
  const obal = div('hrad-navsteva');
  obal.append(div('nadpis', `Hrad – ${mestoNazev(startId())}`));
  const svg = div('hrad-obal', svgHradu(k.zamku, k.otevreno));
  obal.append(svg);
  const text = div('pribeh');
  obal.append(text);
  const tl = div('tlacitka');
  obal.append(tl);
  otevriPanel(obal, { trida: 'siroky' });
  naZavreni = napovez;
  if (maKomnaty()) obal.append(tlacitko(`🚪 Komnaty hradu (${otevrenychKomnat()} / ${odmeny.komnaty.length})`, () => komnaty(), 'komnaty-tl'));
  if (!k.klice) {
    text.innerHTML = `Ještě ${zbyvaKlicu() === 1 ? 'chybí 1 klíč' : `chybí ${zbyvaKlicu()} klíčů`}. Klíče najdeš v truhličkách ve vesnicích.`;
    tl.append(tlacitko('Jdu hledat ➜', () => { zavriPanel(); napovez(); }));
    return;
  }
  text.innerHTML = `V brašně máš <b>${k.klice}</b> ${k.klice === 1 ? 'klíč' : k.klice < 5 ? 'klíče' : 'klíčů'}. Odemkni jimi zámky!`;
  tl.append(tlacitko('🗝️ Odemknout zámky', async () => {
    tl.innerHTML = '';
    $('#panel-zavrit').hidden = true;
    while (k.klice > 0 && k.otevreno < k.zamku) {
      const visak = svg.querySelector(`.visak[data-i="${k.otevreno}"]`);
      const klic = div('letici-klic', '🗝️');
      const r = visak.getBoundingClientRect();
      klic.style.left = r.left + r.width / 2 + 'px'; klic.style.top = r.top + 'px';
      document.body.append(klic);
      await pauza(450);
      klic.remove();
      visak.classList.add('otevreny', 'cvak');
      visak.querySelector('rect').setAttribute('fill', '#7dcea0');
      visak.querySelector('.okovy').setAttribute('d', 'M-7 -2 v-7 a7 7 0 0 1 14 0 v-6');
      zvuk.zamek();
      k.klice--; k.otevreno++;
      uloz(); obnovHud();
      await pauza(250);
    }
    if (k.otevreno >= k.zamku) { await hradOtevren(svg); return; }
    $('#panel-zavrit').hidden = false;
    text.innerHTML = `Odemčeno ${k.otevreno} z ${k.zamku}. Ještě ${zbyvaKlicu() === 1 ? 'chybí 1 klíč' : `chybí ${zbyvaKlicu()} klíčů`}!`;
    tl.append(tlacitko('Jdu hledat další ➜', () => { zavriPanel(); napovez(); }));
  }, 'hlavni'));
}

async function hradOtevren(svg) {
  svg.querySelector('svg').classList.add('brana-otevrena');
  svg.parentElement.querySelector('.pribeh').innerHTML = '<b>Všechny zámky povolily! Brána se otevírá…</b>';
  zvuk.fanfara();
  konfety();
  await pauza(1600);
  stav.hradu++;
  const nova = vyberNalepku(stav.nalepky);
  const cas = stav.kolo.cas || 0;
  const rekord = stav.nalepky.every((s) => !s.cas || cas < s.cas);
  stav.nalepky.push({ ...nova, kdy: Date.now(), cas: Math.round(cas) });
  uloz();
  const n = nalepka(nova.id);
  const obal = div('darek');
  obal.innerHTML = `<div class="nadpis">Hrad je odemčený! 🎉</div><p>V pokladnici leží dárek. Klepni na něj!</p>`;
  const krabice = div('krabice', '🎁');
  obal.append(krabice);
  otevriPanel(obal, { zavritelny: false });
  krabice.onclick = async () => {
    krabice.onclick = null;
    krabice.classList.add('otevirani');
    zvuk.klic();
    await pauza(700);
    krabice.replaceWith(div(`nalepka velka ${nova.zlata ? 'zlata' : ''} odhaleni`, `<span>${n.emoji}</span>`));
    const popis = div('pribeh', `<p>Nová nálepka: <b>${n.nazev}${nova.zlata ? ' (zlatá!)' : ''}</b></p>
      <p class="cas-hradu">⏱ Odemčení hradu trvalo <b>${formatCas(cas)}</b>${rekord && stav.nalepky.length > 1 ? ' – <b>nový rekord!</b> 🏆' : ''}</p>
      <p>Ve sbírce máš ${stav.nalepky.length} ${stav.nalepky.length === 1 ? 'nálepku' : stav.nalepky.length < 5 ? 'nálepky' : 'nálepek'}. Tvoje hodnost: <b>${hodnost(stav.hradu)}</b></p>
      <p>Jenže… v noci přiletěl kouzelník a zamkl hrad znovu! Najdeš klíče i tentokrát?</p>`);
    obal.append(popis);
    const dalsiKolo = () => { noveKolo(); zavriPanel(); obnovHud(); uvodHradu(napovez); };
    if (maKomnaty() && stav.hradu <= odmeny.komnaty.length) {
      const c = stav.hradu;
      obal.append(div('pribeh komnata-nova', `<p>🚪 <b>A ještě něco!</b> Uvnitř hradu se odemkly dveře do komnaty č. ${c}.</p>`));
      obal.append(tlacitko('Jít do komnaty ➜', () => komnaty(c, dalsiKolo), 'hlavni'));
    } else obal.append(tlacitko('Nové dobrodružství ➜', dalsiKolo, 'hlavni'));
    konfety();
  };
}

// ---------- komnaty hradu (odměny za otevřené hrady, data/odmeny.json) ----------
const maKomnaty = () => !!odmeny?.komnaty?.length;
const otevrenychKomnat = () => Math.min(stav.hradu, odmeny.komnaty.length);
// nova = číslo právě odemčené komnaty (zvýrazní se), pak = co dělat po zavření (nové kolo)
function komnaty(nova = 0, pak = null) {
  const obal = div('komnaty');
  obal.append(div('nadpis', odmeny.nazev || 'Komnaty hradu'));
  if (odmeny.popis) obal.append(div('pribeh male', odmeny.popis));
  const chodba = div('chodba');
  const otevreno = otevrenychKomnat();
  stav.videneKomnaty ||= [];
  odmeny.komnaty.forEach((kom, i) => {
    const c = i + 1;
    const odemcena = c <= otevreno;
    const videna = stav.videneKomnaty.includes(c);
    const dvere = document.createElement(odemcena ? 'a' : 'div');
    dvere.className = `dvere ${odemcena ? 'odemcene' : 'zamcene'} ${c === nova ? 'nove' : ''} ${videna ? 'videne' : ''}`;
    dvere.innerHTML = `<span class="cislo">${c}</span>
      <span class="kridlo"><span class="klika"></span>${odemcena ? '' : '<span class="visak-dvere">🔒</span>'}</span>
      <span class="popis ${odemcena || c === otevreno + 1 ? '' : 'prazdne'}">${odemcena ? `<b>${kom.nazev}</b><small>${kom.popisek || ''}</small>` : c === otevreno + 1 ? '<small>otevře se po dalším hradu</small>' : '<small>&nbsp;</small>'}</span>`;
    if (odemcena) {
      dvere.href = kom.odkaz; dvere.target = '_blank'; dvere.rel = 'noopener';
      dvere.addEventListener('click', () => {
        zvuk.zamek();
        if (!videna) { stav.videneKomnaty.push(c); uloz(); }
        dvere.classList.add('videne', 'otevira');
      });
    }
    chodba.append(dvere);
  });
  obal.append(chodba);
  if (pak) obal.append(tlacitko('Nové dobrodružství ➜', () => { zavriPanel(); pak(); }, 'hlavni'));
  otevriPanel(obal, { trida: 'siroky', zavritelny: !pak });
  naZavreni = pak || napovez;
  if (nova) setTimeout(() => chodba.querySelector('.nove')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
}

// ---------- vesnice a truhla ----------
async function navstevaMesta(id) {
  const st = stavMesta(id);
  const obal = div('mesto');
  obal.append(div('nadpis', mestoNazev(id)));
  const scena = div('truhla-scena');
  obal.append(scena);
  const plocha = div('plocha');
  obal.append(plocha);
  otevriPanel(obal);
  naZavreni = napovez;

  if (st.stav === 'otevrena') {
    scena.innerHTML = truhlaSvg('otevrena');
    plocha.append(div('pribeh', 'Truhlička je prázdná – klíč odsud už máš. Zkus jinou vesnici!'));
    plocha.append(tlacitko('Jít dál ➜', () => { zavriPanel(); napovez(); }));
    return;
  }
  if (st.stav === 'zamcena') {
    scena.innerHTML = truhlaSvg('zamcena');
    const m = Math.ceil(st.zbyva / 60);
    plocha.append(div('pribeh', `Truhlička je zakletá ještě ${m === 1 ? 'chvilku' : `asi ${m} minut`}. Zkus mezitím jinou vesnici a pak se vrať!`));
    plocha.append(tlacitko('Jít jinam ➜', () => { zavriPanel(); napovez(); }));
    return;
  }

  const tema = temaMesta(id);
  scena.innerHTML = truhlaSvg('zavrena');
  // 1) zámek truhly
  while (true) {
    const ok = await zobrazZamek(plocha, vytvorZamek(tema));
    if (!panelOtevreny) return;
    if (ok) break;
    plocha.innerHTML = '<div class="pribeh">Zámek nepovolil. Zkus to ještě jednou!</div>';
    await pauza(900);
    if (!panelOtevreny) return;
  }
  scena.innerHTML = truhlaSvg('otevrena', true);
  await pauza(600);
  if (!panelOtevreny) return;
  // 2) úloha
  scena.classList.add('mala');
  plocha.innerHTML = '';
  const kouzlo = div('kouzlo-nadpis', `✨ ${tema.kouzlo || 'Kouzlo truhly'} ✨`);
  plocha.append(kouzlo);
  const uEl = div('uloha');
  plocha.append(uEl);
  const uloha = vytvorUlohu(tema, { diktat: umimMluvit('cs-CZ'), nedavno: stav.nedavno });
  // pamatuje si posledních 300 použitých vět a zadání, ať se neopakují dřív, než se vystřídají ostatní
  stav.nedavno = [...(stav.nedavno || []).filter((x) => !uloha.pouzite.includes(x)), ...uloha.pouzite].slice(-300);
  $('#panel-zavrit').hidden = true; // úloha se dodělá (nebo prohraje), neutíká se od ní
  const vysledek = await spustUlohu(uEl, uloha, { zivoty: stav.nastaveni.zivoty });
  $('#panel-zavrit').hidden = false;
  zapisStatistiku(tema, uloha, vysledek);
  plocha.innerHTML = '';
  scena.classList.remove('mala');
  if (vysledek.ok) {
    const k = stav.kolo;
    k.kousky = (k.kousky || 0) + 1;
    const cely = k.kousky >= naKlic();
    if (cely) { k.kousky = 0; k.klice++; }
    k.hotova.push(id);
    uloz();
    scena.innerHTML = truhlaSvg('otevrena') + `<div class="vyletujici-klic ${cely || naKlic() === 1 ? '' : 'kousek'}">🗝️</div>`;
    zvuk.klic();
    mapa.postava.radost = 1; setTimeout(() => { mapa.postava.radost = 0; }, 2000);
    plocha.append(div('pribeh', naKlic() === 1 ? '<b>Hurá! Truhla ti dala klíč.</b> Schovej ho do brašničky.'
      : cely ? '<b>Hurá! Poslední kousek – klíč je celý!</b> Schovej ho do brašničky.'
      : `<b>Hurá! Truhla ti dala kousek klíče.</b> Najdi ještě ${naKlic() - k.kousky === 1 ? 'jednu truhlu' : `${naKlic() - k.kousky} truhly`} a klíč bude celý.`));
    obnovHud();
    plocha.append(tlacitko(cely || naKlic() === 1 ? 'Do brašničky! 👜' : 'Hledat další truhlu ➜', () => { zavriPanel(); napovez(); }, 'hlavni'));
  } else {
    stav.kolo.zamceno[id] = Date.now() + stav.nastaveni.pauza * 60000;
    uloz();
    zvuk.smutne();
    scena.innerHTML = truhlaSvg('zamcena');
    plocha.append(div('pribeh', `<b>Ajaj, kouzlo se tentokrát nepovedlo.</b> Truhla se zase zamkla.`));
    plocha.append(div('reseni', `<div class="reseni-nadpis">Správně to mělo být:</div>${uloha.reseni}`));
    plocha.append(div('pribeh male', `Musíš z vesnice odejít. Truhla se dá znovu zkusit za ${stav.nastaveni.pauza} ${stav.nastaveni.pauza === 1 ? 'minutu' : stav.nastaveni.pauza < 5 ? 'minuty' : 'minut'}.`));
    plocha.append(tlacitko('Odejít z vesnice ➜', () => { zavriPanel(); odejdiZMesta(id); }));
  }
}

// Po neúspěchu postavička sama odejde k nejbližší sousední vesnici, ať je jasné, že musí jinam.
function odejdiZMesta(id) {
  const sousede = mapa.sousede.get(id) || [];
  const nej = sousede.slice().sort((a, b) => a.len - b.len)[0];
  if (!nej) return napovez();
  const kam = nej.a === id ? nej.b : nej.a;
  bublina('Zkus jinou vesnici a pak se vrať. ⏳');
  mapa.jdi(kam).then(() => { stav.pozice = kam; uloz(); });
}

function truhlaSvg(st, oteviraSe = false) {
  const vika = st === 'otevrena'
    ? `<path class="${oteviraSe ? 'vika-otevira' : ''}" d="M20 62 L26 22 Q70 6 114 22 L120 62Z" fill="#c68642" stroke="#7a4a1e" stroke-width="3"/>`
    : `<path d="M18 62 Q70 22 122 62Z" fill="#c68642" stroke="#7a4a1e" stroke-width="3"/>`;
  const zare = st === 'otevrena' ? '<ellipse cx="70" cy="62" rx="46" ry="12" fill="#fff3a0" opacity=".9"/>' : '';
  const retez = st === 'zamcena' ? '<g stroke="#7f8c8d" stroke-width="6" stroke-linecap="round"><path d="M18 64 L122 116"/><path d="M122 64 L18 116"/></g><text x="70" y="98" font-size="26" text-anchor="middle">⏳</text>' : '';
  const zamek = st === 'zavrena' ? '<g transform="translate(70 80)"><path d="M-8 0 v-8 a8 8 0 0 1 16 0 v8" fill="none" stroke="#7b5e57" stroke-width="4"/><rect x="-12" y="-1" width="24" height="20" rx="4" fill="#f5c518" stroke="#a0782b" stroke-width="2"/><circle cx="0" cy="8" r="3" fill="#5d4037"/></g>' : '';
  return `<svg class="truhla-svg ${st}" viewBox="0 0 140 130">
    <ellipse cx="70" cy="122" rx="56" ry="7" fill="rgba(0,0,0,.18)"/>
    ${zare}<rect x="18" y="62" width="104" height="56" rx="6" fill="#8d5524" stroke="#5d3412" stroke-width="3"/>
    <rect x="18" y="74" width="104" height="7" fill="#f5c518"/>${vika}${zamek}${retez}</svg>`;
}

function zapisStatistiku(tema, uloha, v) {
  const s = (stav.stat[tema.id] ||= { ok: 0, chyb: 0, podtypy: {} });
  const p = (s.podtypy[uloha.podtyp] ||= { ok: 0, chyb: 0 });
  if (v.ok) { s.ok++; p.ok++; } else { s.chyb++; p.chyb++; }
  for (const c of v.chyby) stav.chyby.unshift({ kdy: Date.now(), tema: tema.id, text: c });
  stav.chyby = stav.chyby.slice(0, 60);
  uloz();
}

// ---------- album ----------
function album() {
  const obal = div('album');
  const mam = new Map();
  for (const s of stav.nalepky) {
    const x = mam.get(s.id) || { pocet: 0, zlata: false, cas: null };
    x.pocet++; x.zlata ||= s.zlata;
    if (s.cas && (!x.cas || s.cas < x.cas)) x.cas = s.cas;
    mam.set(s.id, x);
  }
  const casy = stav.nalepky.filter((s) => s.cas).map((s) => s.cas);
  obal.append(div('nadpis', 'Moje sbírka nálepek'));
  obal.append(div('pribeh', `Hodnost: <b>${hodnost(stav.hradu)}</b> · odemčených hradů: <b>${stav.hradu}</b> · nálepek: <b>${mam.size} / ${NALEPKY.length}</b>${casy.length ? ` · nejrychlejší hrad: <b>${formatCas(Math.min(...casy))}</b>` : ''}`));
  const mriz = div('mriz-nalepek');
  for (const n of NALEPKY) {
    const m = mam.get(n.id);
    mriz.append(div(`nalepka ${m ? '' : 'chybi'} ${m?.zlata ? 'zlata' : ''}`, m ? `<span>${n.emoji}</span><small>${n.nazev}</small>${m.cas ? `<small class="cas">⏱ ${formatCas(m.cas)}</small>` : ''}${m.pocet > 1 ? `<b class="pocet">×${m.pocet}</b>` : ''}` : '<span>?</span><small>&nbsp;</small>'));
  }
  obal.append(mriz);
  if (maKomnaty()) obal.append(tlacitko(`🚪 Komnaty hradu (${otevrenychKomnat()} / ${odmeny.komnaty.length})`, () => komnaty()));
  otevriPanel(obal, { trida: 'siroky' });
  naZavreni = null;
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
  const zamkyRadek = radek('Počet zámků na hradě', posuvnik(1, maxZamku(), Math.min(n.zamku, maxZamku()), (v) => String(v), (v) => {
    n.zamku = v;
    stav.kolo.zamku = Math.max(v, stav.kolo.otevreno); // už odemčené zámky zůstávají
    obnovHud();
  }));
  radek('Truhliček na jeden klíč', posuvnik(1, 3, naKlic(), (v) => String(v), (v) => {
    n.truhelNaKlic = v;
    const max = maxZamku();
    zamkyRadek.querySelector('input').max = max;
    if (n.zamku > max) { n.zamku = max; zamkyRadek.querySelector('input').value = max; zamkyRadek.querySelector('.hodnota').textContent = max; }
    stav.kolo.zamku = Math.max(Math.min(stav.kolo.zamku, max), stav.kolo.otevreno);
    obnovHud();
  }));
  radek('Pauza truhly po chybě', posuvnik(1, 15, n.pauza, (v) => `${v} min`, (v) => { n.pauza = v; }));
  radek('Srdíček v úloze (kolik chyb se odpustí + 1)', posuvnik(1, 4, n.zivoty, (v) => '❤️'.repeat(v), (v) => { n.zivoty = v; }));
  const tem = div('temata');
  for (const t of temata) {
    const l = document.createElement('label');
    const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!n.temata[t.id];
    c.onchange = () => { n.temata[t.id] = c.checked; rozdelTemata(); uloz(); };
    l.append(c, ' ' + t.nazev);
    tem.append(l);
  }
  radek('Co se procvičuje', tem);
  if (ukolyIndex.baliky.length > 1) {
    const s = document.createElement('select');
    for (const b of ukolyIndex.baliky) s.append(new Option(b.nazev, b.id, false, b.id === n.balik));
    s.onchange = () => { n.balik = s.value; uloz(); location.reload(); };
    radek('Sada úkolů', s);
  }
  if (mapyIndex.mapy.length > 1) {
    const s = document.createElement('select');
    for (const m of mapyIndex.mapy) s.append(new Option(m.nazev, m.id, false, m.id === n.mapa));
    s.onchange = () => { n.mapa = s.value; stav.kolo = null; stav.pozice = null; uloz(); location.reload(); };
    radek('Mapa', s);
  }
  const zv = document.createElement('input'); zv.type = 'checkbox'; zv.checked = n.zvuk;
  zv.onchange = () => { n.zvuk = zv.checked; uloz(); obnovHud(); };
  radek('Zvuky', zv);

  // statistika
  const st = div('statistika');
  let html = '<table><tr><th>Téma</th><th>vyřešeno</th><th>nepovedlo se</th></tr>';
  for (const t of temata) {
    const s = stav.stat[t.id];
    html += `<tr><td>${t.nazev}</td><td>${s?.ok || 0}</td><td>${s?.chyb || 0}</td></tr>`;
  }
  html += '</table>';
  if (stav.chyby.length) {
    html += '<div class="posledni-chyby"><b>Poslední chyby</b><ul>' + stav.chyby.slice(0, 25).map((c) =>
      `<li><small>${new Date(c.kdy).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</small> ${c.text.replace(/</g, '&lt;')}</li>`).join('') + '</ul></div>';
  }
  st.innerHTML = html;
  radek('Jak se daří', st);

  const tl = div('tlacitka');
  tl.append(tlacitko('Upravit postavičku', () => { zavriPanel(); obrazovkaPostavy(napovez); }));
  if (document.fullscreenEnabled) tl.append(tlacitko('Celá obrazovka', () => { document.documentElement.requestFullscreen?.(); }));
  const reset = tlacitko('Začít úplně znovu', () => {
    if (!reset.dataset.potvrd) { reset.dataset.potvrd = 1; reset.innerHTML = 'Opravdu smazat postup i nálepky? Klepni znovu.'; return; }
    localStorage.removeItem(KLIC); location.reload();
  }, 'nebezpecne');
  tl.append(reset);
  obal.append(tl);
  otevriPanel(obal, { trida: 'siroky' });
  naZavreni = napovez;
}

// ---------- drobnosti ----------
const pauza = (ms) => new Promise((r) => setTimeout(r, ms));
// 754 000 ms → „12 min 34 s“
function formatCas(ms) {
  const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), z = s % 60;
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min ${z} s`;
  return `${z} s`;
}

// Měření času kola: počítá se jen čas, kdy je hra vidět a dítě v posledních 2 minutách sáhlo na obrazovku
// (hraní přes několik dní se tak nesčítá s přestávkami).
let posledniDotyk = Date.now(), posledniUlozeniCasu = 0;
document.addEventListener('pointerdown', () => { posledniDotyk = Date.now(); }, true);
function merCas(dt) {
  if (!stav.kolo || document.hidden || !$('#splash').hidden || Date.now() - posledniDotyk > 120000) return;
  stav.kolo.cas = (stav.kolo.cas || 0) + dt * 1000;
  if (Date.now() - posledniUlozeniCasu > 5000) { posledniUlozeniCasu = Date.now(); uloz(); }
}

// Úvodní obrazovka: klepnutí zároveň odemkne zvuk (prohlížeče ho bez dotyku nepustí).
function splash() {
  return new Promise((hotovo) => {
    const el = $('#splash');
    const casy = stav.nalepky.filter((s) => s.cas).map((s) => s.cas);
    el.querySelector('.splash-stat').innerHTML = stav.hradu
      ? `Odemčených hradů: <b>${stav.hradu}</b> · hodnost: <b>${hodnost(stav.hradu)}</b>${casy.length ? ` · rekord: <b>${formatCas(Math.min(...casy))}</b>` : ''}`
      : '';
    el.hidden = false;
    el.querySelector('.splash-hrat').onclick = () => {
      zvuk.klic();
      el.classList.add('pryc');
      setTimeout(() => { el.hidden = true; el.classList.remove('pryc'); hotovo(); }, 500);
    };
  });
}
function konfety() {
  const el = $('#konfety');
  const barvy = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#ff6fa8'];
  for (let i = 0; i < 80; i++) {
    const k = document.createElement('i');
    k.style.left = Math.random() * 100 + 'vw';
    k.style.background = barvy[i % barvy.length];
    k.style.animationDelay = Math.random() * 0.6 + 's';
    k.style.animationDuration = 1.8 + Math.random() * 1.5 + 's';
    k.style.transform = `rotate(${Math.random() * 360}deg)`;
    el.append(k);
    setTimeout(() => k.remove(), 4200);
  }
}

// ---------- start ----------
let posledniKrok = 0;
async function start() {
  try { await nactiData(); }
  catch (e) { $('#nacitani').textContent = 'Mapu se nepodařilo načíst: ' + e.message; return; }
  if (!stav.kolo || !dataMapy.mesta.some((m) => m.id === stav.pozice)) { stav.pozice = startId(); }
  if (!stav.kolo) noveKolo();
  uloz();

  mapa = new Mapa($('#mapa'), dataMapy, {
    naKlepnuti: async (id) => {
      if (panelOtevreny || mapa.postava.cesta) return;
      zvuk.klik();
      $('#bublina').hidden = true;
      if (mapa.postava.mesto !== id) {
        const dosel = await mapa.jdi(id);
        if (!dosel) return;
        stav.pozice = id; uloz();
      }
      if (id === startId()) navstevaHradu(); else navstevaMesta(id);
    },
    stavMesta,
    stavHradu: () => ({ zamku: stav.kolo.zamku, otevreno: stav.kolo.otevreno }),
    vzhled: () => stav.postava || VYCHOZI,
    krok: (s) => { if (s - posledniKrok > 38 || s < posledniKrok) { posledniKrok = s; zvuk.krok(); } },
  });
  mapa.postavaNa(stav.pozice);
  let posledni = performance.now();
  const smycka = (t) => { const dt = Math.min(0.05, (t - posledni) / 1000); mapa.snimek(dt); merCas(dt); posledni = t; requestAnimationFrame(smycka); };
  requestAnimationFrame(smycka);
  $('#nacitani').hidden = true;

  $('#tl-album').onclick = () => { if (!mapa.postava.cesta) { zvuk.klik(); album(); } };
  $('#tl-nastaveni').onclick = () => { if (!mapa.postava.cesta) { zvuk.klik(); branaRodicu(); } };
  $('#brasna').onclick = () => { zvuk.klik(); napovez(); };

  await splash();
  if (!stav.postava) obrazovkaPostavy(() => { obnovHud(); uvodHradu(napovez); });
  else { obnovHud(); napovez(); }
}
start();

// háčky pro automatické testy
window.__mk = { formatCas, komnaty, get stav() { return stav; }, get mapa() { return mapa; }, uloz, noveKolo, obnovHud, navstevaMesta, navstevaHradu };
