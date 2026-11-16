// Zobrazení úloh v panelu truhly. Každá úloha kontroluje každý krok hned, za chybu ubude srdíčko.
// spustUlohu(el, uloha, {zivoty}) → Promise<{ ok, chyby: [text] }>
import { zvuk, rekni } from './zvuky.js';
import { zamichej } from './ulohy.js';

const h = (tag, attrs = {}, ...deti) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const d of deti.flat()) if (d != null) e.append(d);
  return e;
};
const zatres = (e) => { e.classList.remove('zatres'); void e.offsetWidth; e.classList.add('zatres'); };

export function spustUlohu(el, u, { zivoty = 2 } = {}) {
  return new Promise((hotovo) => {
    el.innerHTML = '';
    window.__mkUloha = u; // pro automatické testy
    let zbyva = u.zivoty || zivoty;
    const chyby = [];
    const srdce = h('div', { class: 'srdce' });
    const ukazSrdce = () => { srdce.textContent = '❤️'.repeat(Math.max(0, zbyva)) + '🤍'.repeat(Math.max(0, (u.zivoty || zivoty) - zbyva)); };
    ukazSrdce();
    el.append(h('div', { class: 'uloha-hlava' }, h('div', { class: 'pokyn', html: u.pokyn || '' }), srdce));
    const telo = h('div', { class: 'uloha-telo' });
    el.append(telo);
    let skonceno = false;
    const konec = (ok) => { if (skonceno) return; skonceno = true; setTimeout(() => hotovo({ ok, chyby }), ok ? 650 : 900); };
    // vrací true, když ještě hraje
    const chyba = (prvek, popis) => {
      if (skonceno) return false;
      zvuk.spatne(); if (prvek) zatres(prvek);
      chyby.push(popis);
      zbyva--; ukazSrdce(); zatres(srdce);
      if (zbyva <= 0) { konec(false); return false; }
      return true;
    };
    const ctx = { telo, chyba, konec, zvuk };
    ({ postupne, vyber, sloupec, kroky, skladani })[u.typ](u, ctx);
  });
}

// ---------- postupné doplňování (písmena, pády…) ----------
function postupne(u, { telo, chyba, konec }) {
  const veta = h('div', { class: 'veta' });
  const mista = [];
  for (const c of u.casti) {
    if (typeof c === 'string') { veta.append(c); continue; }
    const e = h('span', { class: c.zobraz === '_' ? 'mezera' : 'znacka' }, c.zobraz === '_' ? ' ' : c.zobraz);
    mista.push({ c, e });
    veta.append(e);
  }
  const tlacitka = h('div', { class: 'moznosti' + (u.tlacitkaVelka ? ' moznosti-pady' : '') });
  telo.append(veta, tlacitka);
  let i = 0;
  const ukaz = () => {
    mista.forEach((m, k) => m.e.classList.toggle('aktivni', k === i));
    tlacitka.innerHTML = '';
    if (i >= mista.length) { zvuk.dobre(); konec(true); return; }
    const { c, e } = mista[i];
    for (const m of c.moznosti) {
      const b = h('button', { class: 'tl moznost' }, h('span', { class: 'hodnota' }, m.popis ?? m.hodnota), m.napoveda ? h('small', {}, m.napoveda) : null);
      b.onclick = () => {
        if (m.hodnota === c.spravne) {
          zvuk.klik();
          e.textContent = c.odhal; e.classList.add('hotovo'); e.classList.remove('aktivni');
          if (c.stitek) e.append(h('sup', {}, c.stitek.replace('. pád', '.')));
          i++; ukaz();
        } else chyba(e, `${u.popis}: ${c.odhal} (ne ${m.popis ?? m.hodnota})`);
      };
      tlacitka.append(b);
    }
  };
  ukaz();
}

// ---------- výběr z možností (diktát, obecné otázky) ----------
function vyber(u, { telo, chyba, konec }) {
  if (u.mluvit) {
    const repro = h('button', { class: 'tl repro' }, '🔊 Poslechnout');
    repro.onclick = () => rekni(u.mluvit, u.jazyk);
    telo.append(repro);
    setTimeout(() => rekni(u.mluvit, u.jazyk), 400);
  }
  if (u.otazka) telo.append(h('div', { class: 'veta', html: u.otazka }));
  const tl = h('div', { class: 'moznosti svisle' });
  u.moznosti.forEach((m, k) => {
    const b = h('button', { class: 'tl moznost dlouha' }, m);
    b.onclick = () => {
      if (k === u.spravna) { zvuk.dobre(); b.classList.add('spravne'); tl.querySelectorAll('button').forEach((x) => (x.disabled = true)); konec(true); }
      else if (chyba(b, `${u.popis}: vybráno „${m}“`)) b.disabled = true;
    };
    tl.append(b);
  });
  telo.append(tl);
}

// ---------- číselná klávesnice ----------
function klavesnice(naCislo, sOK) {
  const k = h('div', { class: 'klavesnice' + (sOK ? '' : ' bez-ok') });
  for (const c of ['7', '8', '9', '4', '5', '6', '1', '2', '3', '⌫', '0', 'OK']) {
    if (!sOK && c === 'OK') { k.append(h('span')); continue; }
    if (!sOK && c === '⌫') { k.append(h('span')); continue; }
    const b = h('button', { class: 'tl klavesa' + (c === 'OK' ? ' ok' : '') }, c);
    b.onclick = () => naCislo(c);
    k.append(b);
  }
  return k;
}

// ---------- písemné počítání pod sebou ----------
function sloupec(u, { telo, chyba, konec }) {
  const { a, b, operace } = u;
  const radky = []; // {cislice: [..], posun, kontrola:boolean}
  const kroky = []; // pořadí buněk ke kontrole: {radek, sloupec(od prava), hodnota}
  let mezisoucty = [];
  if (operace === '×' && b >= 10) {
    const cif = String(b).split('').reverse().map(Number);
    mezisoucty = cif.map((c, i) => ({ hodnota: a * c, posun: i }));
  }
  const vysledek = u.vysledek;
  const sirka = Math.max(String(a).length, String(b).length + 1, String(vysledek).length, ...mezisoucty.map((m) => String(m.hodnota).length + m.posun)) + 1;
  const grid = h('div', { class: 'sloupec', style: `grid-template-columns: repeat(${sirka}, 1fr)` });
  const bunka = (text, cls = '') => h('div', { class: 'bunka ' + cls }, text);
  const radek = (cislo, znak = '', cls = '') => {
    const s = String(cislo);
    for (let i = 0; i < sirka; i++) {
      const odPrava = sirka - 1 - i;
      if (znak && odPrava === s.length) grid.append(bunka(znak, 'znak'));
      else grid.append(bunka(odPrava < s.length ? s[s.length - 1 - odPrava] : '', cls));
    }
  };
  const vstupniRadek = (cislo, posun, nazev) => {
    const s = String(cislo);
    const bunky = [];
    for (let i = 0; i < sirka; i++) {
      const odPrava = sirka - 1 - i;
      const pozice = odPrava - posun;
      const e = bunka('', pozice >= 0 && pozice < s.length ? 'vstup' : (pozice < 0 && pozice > -2 && posun ? 'posun' : ''));
      if (pozice >= 0 && pozice < s.length) bunky.push({ e, hodnota: s[s.length - 1 - pozice], pozice, nazev });
      grid.append(e);
    }
    bunky.sort((x, y) => x.pozice - y.pozice);
    kroky.push(...bunky);
  };
  const cara = () => { for (let i = 0; i < sirka; i++) grid.append(bunka('', 'cara')); };
  radek(a);
  radek(b, operace === '-' ? '−' : '×');
  cara();
  if (mezisoucty.length) {
    mezisoucty.forEach((m, i) => vstupniRadek(m.hodnota, m.posun, `${a} × ${String(b).split('').reverse()[i]}`));
    cara();
  }
  vstupniRadek(vysledek, 0, mezisoucty.length ? 'součet' : 'výsledek');
  const napoveda = h('div', { class: 'napoveda-krok' });
  telo.append(h('div', { class: 'sloupec-obal' }, grid, napoveda));
  let i = 0;
  const ukaz = () => {
    kroky.forEach((k, j) => k.e.classList.toggle('aktivni', j === i));
    if (i < kroky.length) {
      const k = kroky[i];
      napoveda.textContent = mezisoucty.length
        ? (k.nazev === 'součet' ? 'Teď mezivýsledky sečti.' : `Násobíš: ${k.nazev}`)
        : '';
    }
  };
  ukaz();
  u._cislice = kroky.map((k) => k.hodnota);
  telo.append(klavesnice((c) => {
    if (i >= kroky.length) return;
    const k = kroky[i];
    if (c === k.hodnota) {
      zvuk.klik(); k.e.textContent = c; k.e.classList.add('hotovo'); i++; ukaz();
      if (i >= kroky.length) { zvuk.dobre(); konec(true); }
    } else chyba(k.e, `${u.popis}: ${k.nazev}, číslice ${k.hodnota} (napsáno ${c})`);
  }, false));
}

// ---------- složené příklady po krocích ----------
function kroky(u, { telo, chyba, konec }) {
  const vyraz = h('div', { class: 'vyraz-velky' }, u.vyraz);
  const historie = h('div', { class: 'historie' });
  const plocha = h('div', { class: 'krok-plocha' });
  telo.append(vyraz, historie, plocha);
  let i = 0;
  const dalsi = () => {
    plocha.innerHTML = '';
    if (i >= u.kroky.length) { zvuk.dobre(); konec(true); return; }
    const k = u.kroky[i];
    if (k.vyrazPred) vyraz.textContent = k.vyrazPred;
    if (k.moznosti) {
      plocha.append(h('div', { class: 'otazka-kroku', html: k.otazka.replace(/<span class="vyraz">.*<\/span>/, '') }));
      const tl = h('div', { class: 'moznosti' });
      for (const m of k.moznosti) {
        const b = h('button', { class: 'tl moznost dlouha' }, m);
        b.onclick = () => {
          if (m === k.spravne) { zvuk.klik(); historie.append(h('div', { class: 'radek-historie' }, `Nejdřív: ${m}`)); i++; dalsi(); }
          else if (chyba(b, `${u.popis}: první krok ${k.spravne} (ne ${m})`)) b.disabled = true;
        };
        tl.append(b);
      }
      plocha.append(tl);
      return;
    }
    let zadano = '';
    const pole = h('span', { class: 'pole-cisla' }, ' ');
    plocha.append(h('div', { class: 'otazka-kroku' }, h('span', { html: k.otazka }), ' ', pole));
    plocha.append(klavesnice((c) => {
      if (c === '⌫') zadano = zadano.slice(0, -1);
      else if (c === 'OK') {
        if (!zadano) return;
        if (zadano === k.spravne) {
          zvuk.klik();
          historie.append(h('div', { class: 'radek-historie', html: `${k.otazka} <b>${k.spravne}</b>` }));
          i++; dalsi(); return;
        }
        if (chyba(pole, `${u.popis}: ${k.otazka.replace(/<[^>]+>/g, '')} ${k.spravne} (napsáno ${zadano})`)) zadano = '';
      } else if (zadano.length < 6) zadano += c;
      pole.textContent = zadano || ' ';
    }, true));
  };
  dalsi();
}

// ---------- skládání vět z kartiček ----------
function skladani(u, { telo, chyba, konec }) {
  if (u.predloha) {
    const p = h('div', { class: 'predloha' }, h('span', {}, u.predloha));
    const r = h('button', { class: 'tl repro male' }, '🔊');
    r.onclick = () => rekni(u.predloha, u.jazyk, 0.9);
    p.append(r);
    telo.append(p);
  }
  const cil = h('div', { class: 'cil-vety' });
  const karty = h('div', { class: 'karticky' });
  telo.append(cil, karty);
  let i = 0;
  for (const t of zamichej([...u.tokeny, ...u.navic])) {
    const b = h('button', { class: 'tl karticka' }, t);
    b.onclick = () => {
      if (t === u.tokeny[i]) {
        zvuk.klik(); b.remove(); cil.append(h('span', { class: 'slovo' }, t)); i++;
        if (i >= u.tokeny.length) {
          cil.append(h('span', { class: 'slovo konec' }, u.konec));
          rekni(u.tokeny.join(' ') + u.konec, u.jazyk, 0.9);
          zvuk.dobre(); konec(true);
        }
      } else chyba(b, `${u.popis} (kartička „${t}“ místo „${u.tokeny[i]}“)`);
    };
    karty.append(b);
  }
}

// ---------- zámek truhly: krátká otázka ----------
export function zobrazZamek(el, z) {
  return new Promise((hotovo) => {
    el.innerHTML = '';
    window.__mkZamek = z;
    el.append(h('div', { class: 'pokyn' }, z.pokyn));
    if (z.otazka) el.append(h('div', { class: 'veta zamek-otazka', html: z.otazka }));
    const tl = h('div', { class: 'moznosti' + (z.maleMoznosti ? ' svisle' : '') });
    z.moznosti.forEach((m, k) => {
      const b = h('button', { class: 'tl moznost' + (z.maleMoznosti ? ' dlouha' : ' kulata') }, m);
      b.onclick = () => {
        tl.querySelectorAll('button').forEach((x) => (x.disabled = true));
        if (k === z.spravna) { zvuk.zamek(); b.classList.add('spravne'); setTimeout(() => hotovo(true), 450); }
        else { zvuk.spatne(); zatres(el); b.classList.add('spatne'); setTimeout(() => hotovo(false), 700); }
      };
      tl.append(b);
    });
    el.append(tl);
  });
}
