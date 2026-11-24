// Zobrazení úloh v panelu truhly: písemné počítání pod sebou a písemné dělení.
// Každá číslice se kontroluje hned, za chybu ubude srdíčko a ukáže se nápověda k tomu kroku.
// spustUlohu(el, uloha, {zivoty, prenos, psani}) → Promise<{ ok, chyby: [text] }>
// psani: true = číslice se píšou tužkou (nebo prstem) na psací plochu, jinak číselná klávesnice.
import { zvuk } from './zvuky.js';
import { prenosy, ZNAK, hezky } from './ulohy.js';
import { rozpoznej, ulozVzorek, modelPripraven } from './cislice.js';

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
const cif = (n, k) => Math.floor(n / 10 ** k) % 10; // k-tá číslice od jednotek
const delka = (n) => String(n).length;

export function spustUlohu(el, u, { zivoty = 2, prenos = true, psani = false } = {}) {
  return new Promise((hotovo) => {
    el.innerHTML = '';
    window.__dsUloha = u; // pro automatické testy
    const max = u.zivoty || zivoty;
    let zbyva = max;
    const chyby = [];
    const srdce = h('div', { class: 'srdce' });
    const ukazSrdce = () => { srdce.textContent = '❤️'.repeat(Math.max(0, zbyva)) + '🤍'.repeat(Math.max(0, max - zbyva)); };
    ukazSrdce();
    el.append(h('div', { class: 'uloha-hlava' }, h('div', { class: 'pokyn', html: u.pokyn || '' }), srdce));
    const telo = h('div', { class: 'uloha-telo' });
    el.append(telo);
    let skonceno = false;
    const konec = (ok) => { if (skonceno) return; skonceno = true; setTimeout(() => hotovo({ ok, chyby }), ok ? 650 : 900); };
    const chyba = (prvek, popis) => {
      if (skonceno) return false;
      zvuk.spatne(); if (prvek) zatres(prvek);
      chyby.push(popis);
      zbyva--; ukazSrdce(); zatres(srdce);
      if (zbyva <= 0) { konec(false); return false; }
      return true;
    };
    const vstup = psani && modelPripraven() ? psaciPlocha : klavesnice;
    const ctx = { telo, chyba, konec, prenos, vstup };
    (u.typ === 'deleni' ? deleni : sloupec)(u, ctx);
  });
}

// ---------- číselná klávesnice ----------
function klavesnice(naCislo, sOK) {
  const k = h('div', { class: 'klavesnice' + (sOK ? '' : ' bez-ok') });
  for (const c of ['7', '8', '9', '4', '5', '6', '1', '2', '3', '⌫', '0', 'OK']) {
    if (!sOK && (c === 'OK' || c === '⌫')) { k.append(h('span')); continue; }
    const b = h('button', { class: 'tl klavesa' + (c === 'OK' ? ' ok' : '') }, c);
    b.onclick = () => naCislo(c);
    k.append(b);
  }
  klavesyPocitace(k, naCislo, sOK);
  return k;
}

// klávesnice počítače (PC a tablet s klávesnicí) – funguje u klávesnice i u psaní
function klavesyPocitace(prvek, naCislo, sOK) {
  const kl = (e) => {
    if (!prvek.isConnected) { removeEventListener('keydown', kl); return; }
    if (/^[0-9]$/.test(e.key)) naCislo(e.key);
    else if (sOK && e.key === 'Enter') naCislo('OK');
    else if (sOK && e.key === 'Backspace') naCislo('⌫');
  };
  addEventListener('keydown', kl);
}

// ---------- psací plocha: číslice se píše tužkou nebo prstem ----------
// Po zvednutí tužky a krátké chvilce se číslice přečte. Když si čtení není jisté, nabídne
// „Je to 1, nebo 7?“ (bez ztráty srdíčka) a vybranou podobu si zapamatuje jako vzorek rukopisu.
// Jakmile tablet jednou ohlásí tužku, dotyky prstem (dlaní) se na ploše ignorují.
let videnaTuzka = false;
export const CEKANI_NA_DOPSANI = 900;
export function psaciPlocha(naCislo, sOK, naVysledek = null) {
  const obal = h('div', { class: 'psani' + (sOK ? ' s-ok' : '') });
  const stav = h('div', { class: 'psani-stav' }, 'Napiš číslici ✏️');
  const cv = h('canvas', { class: 'psaci-plocha' });
  const volby = h('div', { class: 'psani-volby' });
  volby.hidden = true;
  const tl = h('div', { class: 'psani-tlacitka' });
  tl.append(h('button', { class: 'tl psani-smaz', onclick: () => { smaz(); stav.textContent = 'Napiš číslici ✏️'; } }, '🧽 Smazat'));
  if (sOK) {
    tl.append(h('button', { class: 'tl klavesa', onclick: () => naCislo('⌫') }, '⌫'));
    tl.append(h('button', { class: 'tl klavesa ok', onclick: () => naCislo('OK') }, 'OK'));
  }
  obal.append(stav, h('div', { class: 'psani-list' }, cv, volby), tl);

  let tahy = [], tah = null, casovac = 0, dpr = 1, ukazujeVolby = false;
  const g = cv.getContext('2d');
  const prekresli = () => {
    const w = cv.clientWidth, v = cv.clientHeight;
    dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(v * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(v * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, v);
    // linka jako v sešitě
    g.strokeStyle = '#cfe0f0'; g.lineWidth = 2; g.setLineDash([8, 8]);
    g.beginPath(); g.moveTo(10, v * 0.82); g.lineTo(w - 10, v * 0.82); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#1f3a93'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = Math.max(5, v / 28);
    for (const t of tahy) {
      g.beginPath(); t.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      if (t.length === 1) g.lineTo(t[0][0] + 0.1, t[0][1]);
      g.stroke();
    }
  };
  const smaz = () => { clearTimeout(casovac); tahy = []; tah = null; skryjVolby(); prekresli(); };
  const skryjVolby = () => { ukazujeVolby = false; volby.hidden = true; volby.innerHTML = ''; };
  const odevzdej = (c) => {
    smaz();
    stav.innerHTML = `Přečteno: <b>${c}</b>`;
    naCislo(c);
  };
  const vyhodnot = () => {
    const r = rozpoznej(tahy);
    if (!r) { smaz(); return; }
    if (naVysledek) { smaz(); naVysledek(r); return; } // učení rukopisu: jen předat
    if (r.jistota >= 0.8) { odevzdej(r.cislice); return; }
    // nejisté čtení: nabídnout možnosti, nic se nepočítá jako chyba
    const moznosti = r.poradi.filter((x, i) => i === 0 || x.p >= 0.06).slice(0, 3);
    ukazujeVolby = true;
    volby.innerHTML = '';
    volby.append(h('div', { class: 'psani-otazka' }, moznosti.length > 1 ? 'Co jsi napsala?' : 'Je to tahle číslice?'));
    const rada = h('div', { class: 'psani-moznosti' });
    for (const m of moznosti) {
      rada.append(h('button', { class: 'tl klavesa', onclick: () => { ulozVzorek(m.c, r.rysy); zvuk.klik(); odevzdej(String(m.c)); } }, String(m.c)));
    }
    rada.append(h('button', { class: 'tl psani-znovu', onclick: () => { smaz(); stav.textContent = 'Napiš ji znovu, větší a pomaleji ✏️'; } }, '✏️ Znovu'));
    volby.append(rada);
    volby.hidden = false;
  };

  const bod = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'pen') videnaTuzka = true;
    else if (e.pointerType === 'touch' && videnaTuzka) return; // dlaň položená na tabletu
    e.preventDefault();
    if (ukazujeVolby) { tahy = []; skryjVolby(); }
    clearTimeout(casovac);
    cv.setPointerCapture?.(e.pointerId);
    tah = { id: e.pointerId, body: [bod(e)] };
    tahy.push(tah.body);
    prekresli();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!tah || e.pointerId !== tah.id) return;
    const evs = e.getCoalescedEvents?.() || [e];
    for (const x of evs) tah.body.push(bod(x));
    prekresli();
  });
  const zvednuti = (e) => {
    if (!tah || e.pointerId !== tah.id) return;
    tah = null;
    clearTimeout(casovac);
    casovac = setTimeout(vyhodnot, CEKANI_NA_DOPSANI);
  };
  cv.addEventListener('pointerup', zvednuti);
  cv.addEventListener('pointercancel', zvednuti);
  new ResizeObserver(() => prekresli()).observe(cv);
  obal._psani = { tahy: () => tahy, vyhodnot }; // pro automatické testy
  klavesyPocitace(obal, naCislo, sOK);
  return obal;
}

// velikost buňky podle šířky panelu (9 cifer se musí vejít i na mobil)
function velikostBunky(telo, sloupcu, max = 46, radku = 0) {
  const w = telo.clientWidth || Math.min(innerWidth - 60, 860);
  const naSirku = innerWidth > innerHeight && innerWidth >= 700;
  const prostor = naSirku ? w - 300 : w - 30; // na šířku je vedle klávesnice
  const naVysku = radku ? Math.floor((innerHeight - (naSirku ? 130 : 420)) / (radku * 1.12)) : 999; // ať se vejde i na nízký mobil na šířku
  return Math.max(22, Math.min(max, Math.floor(prostor / sloupcu) - 4, naVysku));
}

// ---------- písemné sčítání, odčítání a násobení pod sebou ----------
function sloupec(u, { telo, chyba, konec, prenos, vstup }) {
  const { a, b, operace } = u;
  const kroky = []; // pořadí buněk ke kontrole
  let mezisoucty = [];
  if (operace === '×' && b >= 10) mezisoucty = String(b).split('').reverse().map((c, i) => ({ hodnota: a * Number(c), posun: i, m: Number(c) }));
  const vysledek = u.vysledek;
  const sirka = Math.max(delka(a), delka(b) + 1, delka(vysledek), ...mezisoucty.map((m) => delka(m.hodnota) + m.posun)) + 1;
  const ukazPrenos = prenos && !mezisoucty.length;
  const pren = ukazPrenos ? prenosy(operace, a, b) : [];
  const grid = h('div', { class: 'sloupec', style: `grid-template-columns: repeat(${sirka}, var(--b))` });
  const bunka = (text, cls = '') => h('div', { class: 'bunka ' + cls }, text);
  const prenosBunky = [];
  if (ukazPrenos) for (let i = 0; i < sirka; i++) { const e = bunka('', 'prenos'); prenosBunky[sirka - 1 - i] = e; grid.append(e); }
  const radek = (cislo, znak = '') => {
    const s = String(cislo);
    for (let i = 0; i < sirka; i++) {
      const odPrava = sirka - 1 - i;
      if (znak && odPrava === sirka - 1) grid.append(bunka(znak, 'znak'));
      else grid.append(bunka(odPrava < s.length ? s[s.length - 1 - odPrava] : ''));
    }
  };
  const vstupniRadek = (cislo, posun, info) => {
    const s = String(cislo);
    const bunky = [];
    for (let i = 0; i < sirka; i++) {
      const odPrava = sirka - 1 - i;
      const pozice = odPrava - posun;
      const je = pozice >= 0 && pozice < s.length;
      const e = bunka('', je ? 'vstup' : (pozice < 0 && pozice > -2 && posun ? 'posun' : ''));
      if (je) bunky.push({ e, hodnota: s[s.length - 1 - pozice], pozice, sloupec: odPrava, ...info });
      grid.append(e);
    }
    bunky.sort((x, y) => x.pozice - y.pozice);
    kroky.push(...bunky);
  };
  const cara = () => { for (let i = 0; i < sirka; i++) grid.append(bunka('', 'cara')); };
  radek(a);
  radek(b, ZNAK[operace]);
  cara();
  if (mezisoucty.length) {
    mezisoucty.forEach((m) => vstupniRadek(m.hodnota, m.posun, { druh: 'mezi', m: m.m, nazev: `${hezky(a)} × ${m.m}` }));
    cara();
  }
  vstupniRadek(vysledek, 0, { druh: mezisoucty.length ? 'soucet' : 'vysledek' });

  // nápověda ke konkrétní číslici (ukáže se po chybě)
  const napovedaK = (k) => {
    if (k.druh === 'mezi') {
      const p = prenosy('×', a, k.m)[k.pozice] || 0;
      if (k.pozice >= delka(a)) return `Zbylo ti v paměti ${p} – napiš ho.`;
      const v = cif(a, k.pozice) * k.m + p;
      return `${cif(a, k.pozice)} × ${k.m}${p ? ` + ${p}` : ''} = ${v} → napiš ${v % 10}${v >= 10 ? `, ${Math.floor(v / 10)} si pamatuj` : ''}`;
    }
    if (k.druh === 'soucet') {
      const cisla = mezisoucty.map((m) => (k.sloupec - m.posun >= 0 ? cif(m.hodnota, k.sloupec - m.posun) : 0));
      let c = 0;
      for (let s = 0; s < k.sloupec; s++) c = Math.floor((mezisoucty.reduce((x, m) => x + (s - m.posun >= 0 ? cif(m.hodnota, s - m.posun) : 0), 0) + c) / 10);
      const v = cisla.reduce((x, y) => x + y, 0) + c;
      return `Sečti sloupec: ${cisla.join(' + ')}${c ? ` + ${c}` : ''} = ${v} → napiš ${v % 10}`;
    }
    const p = operace === '×' ? prenosy('×', a, b)[k.pozice] || 0 : prenosy(operace, a, b)[k.pozice] || 0;
    const da = cif(a, k.pozice), db = cif(b, k.pozice);
    if (operace === '+') { const v = da + db + p; return `${da} + ${db}${p ? ` + ${p}` : ''} = ${v} → napiš ${v % 10}${v >= 10 ? ', 1 si pamatuj' : ''}`; }
    if (operace === '-') {
      const s = db + p;
      return s <= da ? `${db}${p ? ` + ${p}` : ''} a kolik do ${da}? → ${da - s}` : `${db}${p ? ` + ${p}` : ''} a kolik do ${10 + da}? → ${10 + da - s}, 1 si pamatuj`;
    }
    if (k.pozice >= delka(a)) return `Zbylo ti v paměti ${p} – napiš ho.`;
    const v = da * b + p;
    return `${da} × ${b}${p ? ` + ${p}` : ''} = ${v} → napiš ${v % 10}${v >= 10 ? `, ${Math.floor(v / 10)} si pamatuj` : ''}`;
  };

  const napoveda = h('div', { class: 'napoveda-krok' });
  telo.append(h('div', { class: 'sloupec-obal' }, grid, napoveda));
  telo.style.setProperty('--b', velikostBunky(telo, sirka, 46, 3.6 + (mezisoucty.length ? mezisoucty.length + 0.5 : 0) + (ukazPrenos ? 0.6 : 0)) + 'px');
  let i = 0;
  const ukaz = () => {
    kroky.forEach((k, j) => k.e.classList.toggle('aktivni', j === i));
    napoveda.classList.remove('po-chybe');
    if (i < kroky.length) {
      const k = kroky[i];
      napoveda.textContent = k.druh === 'mezi' ? `Násobíš: ${k.nazev}` : k.druh === 'soucet' ? 'Teď mezivýsledky sečti.' : '';
    }
  };
  ukaz();
  u._cislice = kroky.map((k) => k.hodnota);
  telo.append(vstup((c) => {
    if (i >= kroky.length) return;
    const k = kroky[i];
    if (c === k.hodnota) {
      zvuk.klik(); k.e.textContent = c; k.e.classList.add('hotovo');
      if (ukazPrenos && k.druh === 'vysledek' && pren[k.pozice + 1] && prenosBunky[k.sloupec + 1]) {
        prenosBunky[k.sloupec + 1].textContent = pren[k.pozice + 1];
        prenosBunky[k.sloupec + 1].classList.add('ukaz');
      }
      i++; ukaz();
      if (i >= kroky.length) { zvuk.dobre(); konec(true); }
    } else if (chyba(k.e, `${u.popis}: ${k.druh === 'mezi' ? k.nazev + ', ' : ''}číslice ${k.hodnota} (napsáno ${c})`)) {
      napoveda.textContent = '💡 ' + napovedaK(k);
      napoveda.classList.add('po-chybe');
    }
  }, false));
}

// ---------- písemné dělení ----------
function deleni(u, { telo, chyba, konec, vstup }) {
  const s = String(u.delenec), n = s.length, d = u.delitel;
  const kroky = u.kroky;
  const radku = 1 + kroky.length;
  // první řádek: dělenec : dělitel = podíl (na úzké obrazovce se „: dělitel = podíl“ zalomí pod dělenec);
  // pod dělencem mřížka se zbytky, zarovnaná na stejný levý okraj; řádky přibývají postupně
  const levy = h('div', { class: 'deleni-levy', style: `grid-template-columns: repeat(${n + 1}, var(--b))` });
  const bunky = [[]]; // bunky[radek][sloupec], řádek 0 = dělenec
  const delenecEl = h('div', { class: 'deleni-delenec' });
  for (let c = 0; c < n; c++) { const e = h('span', { class: 'bunka delenec' }, s[c]); bunky[0].push(e); delenecEl.append(e); }
  const radkyZbytku = [];
  for (let r = 1; r < radku; r++) {
    bunky.push([]);
    const radek = [];
    for (let c = 0; c <= n; c++) { const e = h('div', { class: 'bunka' }); e.hidden = true; bunky[r].push(e); radek.push(e); levy.append(e); }
    radkyZbytku.push(radek);
  }
  const podil = [];
  const pravy = h('div', { class: 'deleni-pravy' }, h('span', { class: 'bunka znak' }, ':'), ...String(d).split('').map((x) => h('span', { class: 'bunka' }, x)),
    h('span', { class: 'bunka znak' }, '='), ...kroky.map(() => { const e = h('span', { class: 'bunka vstup' }); podil.push(e); return e; }));
  const zbytekEl = h('div', { class: 'deleni-zbytek' });
  const napoveda = h('div', { class: 'napoveda-krok' });
  const pole = h('span', { class: 'pole-cisla' }, ' ');
  const dotaz = h('div', { class: 'otazka-kroku' });
  telo.append(h('div', { class: 'deleni-obal' }, h('div', { class: 'deleni' }, h('div', { class: 'deleni-prvni' }, delenecEl, pravy), levy), zbytekEl, dotaz, napoveda));
  telo.style.setProperty('--b', velikostBunky(telo, n + String(d).length + 2 + kroky.length + 1, 42) + 'px');

  const zvyrazni = (j) => {
    bunky.flat().forEach((e) => e.classList.remove('cast'));
    if (j >= kroky.length) return;
    const k = kroky[j];
    if (j === 0) for (let c = 0; c <= k.sloupec; c++) bunky[0][c].classList.add('cast');
    else {
      const len = String(kroky[j - 1].zbytek).length + 1;
      for (let c = k.sloupec - len + 1; c <= k.sloupec; c++) if (c >= 0) bunky[j][c].classList.add('cast');
    }
  };
  // řádek j (1..) = zbytek po kroku j-1 a připsaná číslice
  const napisZbytek = (j) => {
    const k = kroky[j];
    radkyZbytku[j].forEach((e) => { e.hidden = false; });
    const z = String(k.zbytek);
    const posledni = j === kroky.length - 1;
    for (let c = 0; c < z.length; c++) {
      const sl = k.sloupec - z.length + 1 + c;
      if (sl >= 0) { bunky[j + 1][sl].textContent = z[c]; bunky[j + 1][sl].classList.add('hotovo'); }
    }
    if (!posledni) {
      const e = bunky[j + 1][k.sloupec + 1];
      e.textContent = s[k.sloupec + 1]; e.classList.add('pripsana');
      bunky[0][k.sloupec + 1].classList.add('stazena');
    }
  };

  let j = 0, faze = 'q', zadano = '';
  const ukaz = () => {
    zvyrazni(j);
    podil.forEach((e, x) => e.classList.toggle('aktivni', faze === 'q' && x === j));
    napoveda.textContent = ''; napoveda.classList.remove('po-chybe');
    if (j >= kroky.length) return;
    const k = kroky[j];
    if (faze === 'q') dotaz.innerHTML = `Kolikrát se <b>${d}</b> vejde do <b>${k.cast}</b>?`;
    else { zadano = ''; pole.textContent = ' '; dotaz.innerHTML = `Kolik zbude? `; dotaz.append(pole); }
  };
  ukaz();
  const kl = vstup((c) => {
    if (j >= kroky.length) return;
    const k = kroky[j];
    if (faze === 'q') {
      if (!/^\d$/.test(c)) return;
      if (Number(c) === k.cislice) {
        zvuk.klik(); podil[j].textContent = c; podil[j].classList.add('hotovo');
        faze = 'r'; ukaz();
      } else if (chyba(podil[j], `${u.popis}: ${k.cast} : ${d} = ${k.cislice} (napsáno ${c})`)) {
        const v = Number(c) * d;
        napoveda.textContent = `💡 ${c} × ${d} = ${v}` + (v > k.cast ? ` – to je víc než ${k.cast}, zkus menší číslo.` : ` – to se vejde, ale zkus, jestli se nevejde víckrát.`);
        napoveda.classList.add('po-chybe');
      }
      return;
    }
    if (c === '⌫') zadano = zadano.slice(0, -1);
    else if (c === 'OK') {
      if (!zadano) return;
      if (Number(zadano) === k.zbytek) {
        zvuk.klik(); napisZbytek(j);
        j++; faze = 'q';
        if (j >= kroky.length) {
          dotaz.innerHTML = `${hezky(u.delenec)} : ${d} = <b>${hezky(u.podil)}</b>`;
          if (u.zbytek) zbytekEl.innerHTML = `zbytek <b>${u.zbytek}</b>`;
          zvyrazni(j); zvuk.dobre(); konec(true); kl.remove(); return;
        }
        ukaz(); return;
      }
      if (chyba(pole, `${u.popis}: ${k.cast} − ${k.cislice}·${d} = ${k.zbytek} (napsáno ${zadano})`)) {
        napoveda.textContent = `💡 ${k.cislice} × ${d} = ${k.cislice * d}, a ${k.cast} − ${k.cislice * d} = ?`;
        napoveda.classList.add('po-chybe');
        zadano = '';
      }
    } else if (zadano.length < String(d).length + 1) zadano += c;
    pole.textContent = zadano || ' ';
  }, true);
  telo.append(kl);
}
