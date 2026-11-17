// Vykreslení na běžnou stránku (PC, tablet, Quest v prohlížeči): horní lišta, panel s obsahem, klaviatura dole.
import { akce, klavesa, poslouchej } from './hra.js';
import { ROZSAH } from './cviceni.js';
import { jeCerna, jmenaKlavesy } from './hudba.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = (s) => document.querySelector(s);
const tl = (t) => `<button class="tl ${t.styl || ''}" data-akce="${esc(t.id)}">${esc(t.text)}</button>`;

// ---------- klaviatura ----------
const klavesy = {};
function postavKlaviaturu() {
  const k = $('#klaviatura');
  const bile = [];
  for (let m = ROZSAH[0]; m <= ROZSAH[1]; m++) if (!jeCerna(m)) bile.push(m);
  const sirka = 100 / bile.length;
  for (let m = ROZSAH[0]; m <= ROZSAH[1]; m++) {
    const el = document.createElement('div');
    el.className = 'klavesa ' + (jeCerna(m) ? 'cerna' : 'bila');
    el.dataset.m = m;
    if (jeCerna(m)) {
      const i = bile.indexOf(m - 1);
      el.style.left = `calc(${(i + 1) * sirka}% - ${sirka * 0.3}%)`; el.style.width = sirka * 0.6 + '%';
    } else { el.style.left = bile.indexOf(m) * sirka + '%'; el.style.width = sirka + '%'; }
    el.innerHTML = '<span class="popisek"></span>';
    k.appendChild(el); klavesy[m] = el;
  }
  // Dotyk i myš: stisk = tón. Víc prstů najednou (akordy) funguje přes pointer události.
  k.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.klavesa'); if (!el) return;
    e.preventDefault(); klavesa(+el.dataset.m);
  });
  // Klávesnice počítače: a w s e d f t g z/y h u j k o l p ; ' → c1 … e2
  const mapa = 'awsedftgzhujkolp;\'';
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    let i = mapa.indexOf(e.key.toLowerCase()); if (e.key.toLowerCase() === 'y') i = 7;
    if (i >= 0) { klavesa(ROZSAH[0] + i); return; }
    if (e.key === 'Enter') { const hl = document.querySelector('#panel .tl.hlavni'); if (hl) hl.click(); }
    if (/^[1-4]$/.test(e.key)) { const m = document.querySelectorAll('#panel .moznost')[+e.key - 1]; if (m) m.click(); }
  });
}
function kresliKlaviaturu(kv) {
  for (const [m, el] of Object.entries(klavesy)) {
    const z = kv.znacky[m];
    el.classList.toggle('zvyr', z?.barva === 'zvyr');
    el.classList.toggle('ok', z?.barva === 'ok');
    el.classList.toggle('chyba', z?.barva === 'chyba');
    el.classList.toggle('hraje', kv.hraje.includes(+m));
    el.classList.toggle('stisk', kv.stisknute.includes(+m));
    let text = z?.text ?? '';
    if (!text && kv.popisky && !jeCerna(+m)) text = jmenaKlavesy(+m)[0] + (+m % 12 === 0 ? (+m === 60 ? '¹' : +m === 72 ? '²' : '³') : '');
    el.firstChild.textContent = text;
  }
}

// ---------- panel ----------
let posledniObrazovka = null;
function kresli(vm) {
  $('#nadpis').textContent = vm.nadpis || '';
  $('#stitek').textContent = vm.stitek || '';
  $('#pokrok').style.width = vm.pokrok ? Math.round(vm.pokrok.hodnota * 100) + '%' : '0';
  $('#pokrok-obal').hidden = !vm.pokrok;
  const h = [];
  if (vm.pokrok?.text) h.push(`<div class="pokrok-text">${esc(vm.pokrok.text)}</div>`);
  if (vm.zadani) h.push(`<div class="zadani">${esc(vm.zadani)}</div>`);
  if (vm.napoveda) h.push(`<div class="napoveda">${esc(vm.napoveda)}</div>`);
  (vm.odstavce || []).forEach((o) => h.push(`<p>${esc(o)}</p>`));
  if (vm.radek) h.push(`<div class="radek">${vm.radek.map((r) => `<span class="ton ${r.stav || ''}">${esc(r.text)}</span>`).join('')}</div>`);
  if (vm.moznosti) h.push(`<div class="moznosti">${vm.moznosti.map((m, i) => `<button class="tl moznost ${m.stav || ''}" data-akce="odp:${esc(m.id)}" ${m.stav ? 'disabled' : ''}><small>${i + 1}</small>${esc(m.text)}</button>`).join('')}</div>`);
  if (vm.ceka) h.push('<div class="napoveda klav">⬇ Odpověz na klaviatuře</div>');
  if (vm.zprava) h.push(`<div class="zprava ${vm.zprava.typ}">${esc(vm.zprava.text)}</div>`);
  if (vm.tlacitka) h.push(`<div class="tlacitka">${vm.tlacitka.map(tl).join('')}</div>`);
  if (vm.seznam) {
    h.push('<div class="seznam">' + vm.seznam.map((j, i) => `
      <div class="jednotka ${j.stav}">
        <div class="j-ikona">${esc(j.ikona)}</div>
        <div class="j-telo"><div class="j-nazev">${i + 1}. ${esc(j.nazev)}</div>
          <div class="j-lista"><div style="width:${Math.round(j.hodnota * 100)}%"></div></div></div>
        <div class="j-akce">${j.odemcena ? `<button class="tl male" data-akce="lekce:${j.id}" title="Lekce">📖</button><button class="tl male" data-akce="trenink:${j.id}" title="Trénink">🎹</button>` : '🔒'}</div>
      </div>`).join('') + '</div>');
  }
  if (vm.vyber) {
    const sk = {};
    vm.vyber.forEach((v) => (sk[v.skupina] ||= []).push(v));
    for (const [n, vv] of Object.entries(sk)) h.push(`<div class="vyber"><b>${esc(n)}</b>${vv.map((v) => `<button class="tl male" data-akce="${esc(v.id)}">${esc(v.text)}</button>`).join('')}</div>`);
  }
  if (vm.dole) h.push(`<div class="tlacitka dole">${vm.dole.map(tl).join('')}</div>`);
  const panel = $('#panel');
  const html = h.join('');
  if (panel.dataset.html !== html) {
    panel.innerHTML = html; panel.dataset.html = html;
    if (posledniObrazovka !== vm.obrazovka + vm.zadani) panel.scrollTop = 0;
    if (vm.zprava?.typ === 'chyba') panel.querySelector('.zprava')?.scrollIntoView({ block: 'nearest' });
  }
  posledniObrazovka = vm.obrazovka + vm.zadani;
  document.body.dataset.obrazovka = vm.obrazovka;
  kresliKlaviaturu(vm.klaviatura);
}

export function startUI() {
  postavKlaviaturu();
  document.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-akce]'); if (!b || b.disabled) return;
    akce(b.dataset.akce);
  });
  poslouchej(kresli);
}
