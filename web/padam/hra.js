// Padám padám: hra na určování pádů pro tablet. Městečko se čtyřmi minihrami a sedmi pádníky.
// Postup se ukládá jen v prohlížeči (localStorage), žádný server. Obsah (věty, slova) je v data/*.json.
import { PADY, CISLA_PADU, $, el, esc, cekej, rozeberVetu, predlozkaPred, podrzeni, odznak } from './spolecne.js';
import { zvuk, nastavZtlumeni, umimMluvit, rekni } from './zvuky.js';
import { pradnikSVG, stadium, doDalsiho, STADIA, POVIDANI } from './pradnici.js';
import { vytah } from './vytah.js';
import { ptacek, ptacekSVG } from './ptacek.js';
import { promeny, tabulkaTvaru } from './promeny.js';
import { detektiv, hodnost, HODNOSTI } from './detektiv.js';

const KLIC = 'padam-v1';
const HRY = { vytah, ptacek, promeny, detektiv };
const POPIS_HER = {
  vytah: { ikona: '🛗', barva: '#f6c35b', text: 'Odvez slovo do patra jeho pádu.' },
  ptacek: { ikona: ptacekSVG(), barva: '#9fd8f7', text: 'Pípa se ptá s předložkou. Odpověz mu.' },
  promeny: { ikona: '🪄', barva: '#c9a7f2', text: 'Jedno slovo, sedm kouzelných proměn.' },
  detektiv: { ikona: '🔍', barva: '#9bd3a8', text: 'Najdi ve větě slovo v hledaném pádu.' },
};
const NAZVY_UROVNI = ['', 'otázky svítí', 'otázky jsou bledé', 'otázky jsou schované'];
const POSTUP_ZA = 8;      // kolik správných bez nápovědy za sebou posune na další úroveň
const POKLES_ZA = 3;      // kolik chyb z posledních 6 vrátí úroveň zpět

const VYCHOZI_NASTAVENI = { zvuk: true, cteni: true, balik: null, urovne: { vytah: 0, ptacek: 0, promeny: 0, detektiv: 0 } };
function novyStav() {
  return {
    verze: 1, nastaveni: structuredClone(VYCHOZI_NASTAVENI),
    urovne: { vytah: 1, ptacek: 1, promeny: 1, detektiv: 1 }, serie: {}, posledni: {},
    body: {}, pady: {}, hvezdy: {}, kol: {}, predlozky: {}, sbirka: {}, pripady: 0, nedavne: {}, chyby: [],
  };
}
let stav = nacti();
function nacti() {
  try {
    const s = JSON.parse(localStorage.getItem(KLIC));
    if (s && s.verze === 1) {
      const n = novyStav();
      return { ...n, ...s, nastaveni: { ...n.nastaveni, ...s.nastaveni, urovne: { ...n.nastaveni.urovne, ...s.nastaveni?.urovne } }, urovne: { ...n.urovne, ...s.urovne } };
    }
  } catch { /* poškozený záznam: začni znovu */ }
  return novyStav();
}
function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(stav)); } catch { /* nevadí */ } }

const params = new URLSearchParams(location.search);
let data = null;
let baliky = [];

// ---------- data ----------
async function nactiJson(soubor) {
  const r = await fetch(`data/${soubor}`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${soubor}: ${r.status}`);
  return r.json();
}
async function nactiData() {
  baliky = (await nactiJson('obsah.json')).baliky;
  const balik = baliky.find((b) => b.id === (params.get('balik') || stav.nastaveni.balik)) || baliky[0];
  stav.nastaveni.balik = balik.id;
  const seznam = async (soubory, pole) => (await Promise.all((soubory || []).map(nactiJson))).flatMap((j) => j[pole] || []);
  const [vety, polozky, slova] = await Promise.all([seznam(balik.vety, 'vety'), seznam(balik.ptacek, 'polozky'), seznam(balik.promeny, 'slova')]);
  return {
    balik,
    vety: vety.map((veta) => ({ veta, kusy: rozeberVetu(veta) })).filter((v) => v.kusy.some((k) => k.slovo && k.pad)),
    ptacek: polozky.map((p) => {
      const kusy = rozeberVetu(p.veta);
      const i = kusy.findIndex((k) => k.slovo);
      const predlozka = p.predlozka ? { psana: p.predlozka, zaklad: predlozkaPred(p.predlozka).zaklad } : predlozkaPred(kusy[i - 1]?.text);
      return { ...p, kusy: [kusy[i - 1] || { text: '' }, kusy[i], kusy[i + 1] || { text: '' }], predlozka };
    }).filter((p) => p.predlozka),
    promeny: slova.filter((s) => s.tvary?.length === 7 && s.sceny?.length === 7),
  };
}

// ---------- zápis výsledků, úrovně nápověd, růst pádníků ----------
const bodyPadu = (c) => stav.body[c] || 0;
const urovenHry = (id) => stav.nastaveni.urovne[id] || stav.urovne[id] || 1;

function zaznam(id, { pad, ok, napoveda, chyba, predlozka }) {
  const s = (stav.pady[pad] ||= { ok: 0, spatne: 0, posledni: [] });
  s[ok ? 'ok' : 'spatne']++;
  s.posledni = [...s.posledni, ok && !napoveda ? 1 : 0].slice(-20);
  if (predlozka && ok) stav.predlozky[`${predlozka}|${pad}`] = (stav.predlozky[`${predlozka}|${pad}`] || 0) + 1;
  if (chyba) stav.chyby = [{ hra: id, ...chyba, cas: Date.now() }, ...stav.chyby].slice(0, 30);

  const vysledek = {};
  const predtim = stadium(bodyPadu(pad));
  if (ok) stav.body[pad] = bodyPadu(pad) + (napoveda ? 1 : 2);
  if (stadium(bodyPadu(pad)) > predtim) { vysledek.oslava = true; vysledek.vyrostl = pad; }

  // úrovně nápověd: posun nahoru po sérii bez nápovědy, dolů po víc chybách
  stav.posledni[id] = [...(stav.posledni[id] || []), ok].slice(-6);
  if (ok && !napoveda) stav.serie[id] = (stav.serie[id] || 0) + 1;
  else if (!ok) stav.serie[id] = 0;
  const u = stav.urovne[id];
  if (stav.serie[id] >= POSTUP_ZA && u < 3) {
    stav.urovne[id] = u + 1; stav.serie[id] = 0; stav.posledni[id] = [];
    vysledek.uroven = +1;
  } else if (stav.posledni[id].filter((x) => !x).length >= POKLES_ZA && u > 1) {
    stav.urovne[id] = u - 1; stav.serie[id] = 0; stav.posledni[id] = [];
    vysledek.uroven = -1;
  }
  uloz();
  if (vysledek.vyrostl) setTimeout(() => oslavRust(vysledek.vyrostl), 300);
  return vysledek;
}

function oslavRust(pad) {
  zvuk.rust();
  const st = stadium(bodyPadu(pad));
  oznameni(`<div class="rust">${pradnikSVG(pad, bodyPadu(pad), { velikost: 90, radost: true })}<div><b>${PADY[pad].jmeno}</b> ${st === 1 ? 'se vylíhl z vajíčka!' : `vyrostl: ${STADIA[st].nazev}!`}</div></div>`, 2600);
}

// ---------- obrazovky ----------
const obrazovka = $('#obrazovka');
let token = 0;

function domu() {
  token++;
  window.speechSynthesis?.cancel();
  const hub = el('div', 'mestecko');
  const nazev = el('h1', 'nazev-hry', [...'Padám padám'].map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`).join(''));
  const hvezd = Object.values(stav.hvezdy).reduce((a, b) => a + b, 0);
  const lista = el('div', 'lista', `<span class="hvezdy-celkem">⭐ ${hvezd}</span>`);
  const tlSbirka = el('button', 'tl kulate', '📒');
  tlSbirka.setAttribute('aria-label', 'Sbírka');
  tlSbirka.onclick = () => { zvuk.klik(); sbirka(); };
  const tlRodice = el('button', 'tl kulate rodice', '⚙️');
  tlRodice.setAttribute('aria-label', 'Pro rodiče (podrž)');
  tlRodice.onclick = () => oznameni('Pro rodiče: podrž ozubené kolečko 2 vteřiny.');
  podrzeni(tlRodice, nastaveni);
  lista.append(tlSbirka, tlRodice);

  const domy = el('div', 'domy');
  for (const [id, hra] of Object.entries(HRY)) {
    const p = POPIS_HER[id];
    const u = urovenHry(id);
    const navic = {
      vytah: '',
      ptacek: `🎵 ${Object.keys(stav.predlozky).filter((k) => stav.predlozky[k] >= 2).length} písniček`,
      promeny: `📖 ${Object.keys(stav.sbirka).length} slov ve sbírce`,
      detektiv: `🎖️ ${hodnost(stav.pripady || 0)}`,
    }[id];
    const d = el('button', `dum dum-${id}`, `
      <span class="dum-ikona">${p.ikona}</span>
      <span class="dum-nazev">${hra.nazev}</span>
      <span class="dum-text">${p.text}</span>
      <span class="dum-stav"><span class="mistr" title="${NAZVY_UROVNI[u]}">${'★'.repeat(u)}${'☆'.repeat(3 - u)}</span> <span>⭐ ${stav.hvezdy[id] || 0}</span></span>
      ${navic ? `<span class="dum-navic">${navic}</span>` : ''}`);
    d.style.setProperty('--b', p.barva);
    d.onclick = () => { zvuk.klik(); hraj(id); };
    domy.append(d);
  }

  const pradnici = el('div', 'pradnici');
  for (const c of CISLA_PADU) {
    const b = el('button', 'pradnik-tl', `${pradnikSVG(c, bodyPadu(c), { velikost: 72 })}<span>${PADY[c].jmeno}</span>`);
    b.onclick = () => { zvuk.klik(); kartaPradnika(c); };
    pradnici.append(b);
  }
  hub.append(lista, nazev, domy, el('div', 'pradnici-nadpis', 'Pádníci rostou, když určuješ jejich pád'), pradnici);
  obrazovka.replaceChildren(hub);
}

async function hraj(id) {
  const muj = ++token;
  const hra = HRY[id];
  const ctx = {
    data, stav, zvuk,
    uroven: urovenHry(id),
    bodyPadu,
    nedavne: (k) => stav.nedavne[k] || [],
    pouzito: (k, klic) => { stav.nedavne[k] = [...(stav.nedavne[k] || []).filter((x) => x !== klic), klic].slice(-Math.max(8, Math.floor(({ vety: data.vety.length, detektiv: data.vety.length, ptacek: data.ptacek.length, promeny: data.promeny.length }[k] || 20) * 0.7))); },
    zaznam: (z) => { const v = zaznam(id, z); if (v.uroven) zmenyUrovne.push(v.uroven); return v; },
    cteni: (vetaEl, text) => {
      if (!stav.nastaveni.cteni || !umimMluvit('cs-CZ')) return;
      const b = el('button', 'precti', '🔊');
      b.setAttribute('aria-label', 'Přečíst větu');
      b.onclick = (e) => { e.stopPropagation(); rekni(text ? text() : vetaEl.textContent.replace(/[()]/g, '')); };
      vetaEl.before(b);
    },
  };
  const zmenyUrovne = [];
  let kolo;
  try { kolo = hra.zacni(ctx); } catch (e) { console.error(e); oznameni('V datech pro tuhle hru nic není.'); return; }
  const n = hra.delka(ctx);
  const vysledky = [];

  const obal = el('div', `hraci-plocha hra-${id}`);
  const hlava = el('div', 'hlava');
  const zpet = el('button', 'tl kulate', '🏠');
  zpet.setAttribute('aria-label', 'Domů');
  zpet.onclick = () => { zvuk.klik(); domu(); };
  const tecky = el('div', 'tecky', Array.from({ length: n }, () => '<span></span>').join(''));
  const info = el('div', 'uroven-info', `<span class="mistr">${'★'.repeat(ctx.uroven)}${'☆'.repeat(3 - ctx.uroven)}</span>`);
  hlava.append(zpet, el('div', 'hlava-nazev', hra.nazev), tecky, info);
  const plocha = el('div', 'plocha');
  obal.append(hlava, plocha);
  obrazovka.replaceChildren(obal);

  for (let i = 0; i < n; i++) {
    tecky.children[i].classList.add('ted');
    const r = await hra.ukol(plocha, ctx, kolo, i);
    if (muj !== token) return;
    tecky.children[i].className = r.ok ? 'dobre' : 'spatne';
    vysledky.push(r.ok);
    uloz();
  }

  // konec kola
  const chyb = vysledky.filter((x) => !x).length;
  const hvezdy = chyb <= Math.floor(n / 8) ? 3 : chyb <= Math.ceil(n / 3) ? 2 : 1;
  stav.hvezdy[id] = (stav.hvezdy[id] || 0) + hvezdy;
  stav.kol[id] = (stav.kol[id] || 0) + 1;
  const extra = hra.konec ? hra.konec(ctx, kolo, vysledky) : '';
  uloz();
  const zmena = zmenyUrovne.reduce((a, b) => a + b, 0);
  const u = urovenHry(id);
  const konec = el('div', 'konec-kola');
  konec.innerHTML = `
    <div class="velke-hvezdy">${[1, 2, 3].map((h) => `<span class="${h <= hvezdy ? 'plna' : ''}" style="--i:${h}">★</span>`).join('')}</div>
    <div class="konec-text">${hvezdy === 3 ? 'Paráda!' : hvezdy === 2 ? 'Moc dobře!' : 'Dobrý začátek!'} ${n - chyb} z ${n} napoprvé.</div>
    ${zmena > 0 ? `<div class="zmena-urovne nahoru">Jsi lepší a lepší! Nápovědy se schovávají: ${NAZVY_UROVNI[u]}. <span class="mistr">${'★'.repeat(u)}${'☆'.repeat(3 - u)}</span></div>` : ''}
    ${zmena < 0 ? `<div class="zmena-urovne">Otázky ti zase trochu posvítí: ${NAZVY_UROVNI[u]}.</div>` : ''}
    ${id === 'detektiv' ? `<div class="konec-text male">Vyřešené případy: ${stav.pripady || 0}. Hodnost: <b>${hodnost(stav.pripady || 0)}</b></div>` : ''}
    ${extra}`;
  const tl = el('div', 'tlacitka');
  const znovu = el('button', 'tl hlavni velke', 'Ještě jednou ▶');
  znovu.onclick = () => { zvuk.klik(); hraj(id); };
  const doMesta = el('button', 'tl velke', '🏠 Do městečka');
  doMesta.onclick = () => { zvuk.klik(); domu(); };
  tl.append(doMesta, znovu);
  konec.append(tl);
  plocha.replaceChildren(konec);
  if (hvezdy === 3) { zvuk.fanfara(); konfety(); } else zvuk.dobre();
}

// ---------- panely ----------
const panel = $('#panel'), panelObsah = $('#panel-obsah');
function otevriPanel(obsah, siroky = false) {
  panelObsah.replaceChildren(...[].concat(obsah));
  panel.querySelector('.panel').classList.toggle('siroky', siroky);
  panel.hidden = false;
}
function zavriPanel() { panel.hidden = true; }
$('#panel-zavrit').onclick = () => { zvuk.klik(); zavriPanel(); domu(); };
panel.addEventListener('click', (e) => { if (e.target === panel) { zavriPanel(); domu(); } });

function kartaPradnika(c) {
  const b = bodyPadu(c);
  const dalsi = doDalsiho(b);
  const st = stadium(b);
  otevriPanel(el('div', 'karta-pradnika', `
    <div class="kp-obrazek" style="--b:${PADY[c].barva}">${pradnikSVG(c, b, { velikost: 150, radost: st > 0 })}</div>
    <div>
      <h2 class="nadpis" style="color:${PADY[c].barva}">${PADY[c].jmeno}</h2>
      <div class="kp-pad">${odznak(c, true)}</div>
      <p>${POVIDANI[c]}</p>
      <p class="male">Teď: <b>${STADIA[st].nazev}</b>. ${dalsi === null ? 'Víc už vyrůst nemůže!' : `Do dalšího růstu chybí ${dalsi} ${dalsi === 1 ? 'bod' : dalsi < 5 ? 'body' : 'bodů'}.`}
      <br>Správně napoprvé bez 💡 = 2 body, s nápovědou 1 bod.</p>
    </div>`));
}

function sbirka(zalozka = 'pady') {
  const obsah = el('div', 'sbirka');
  const zal = el('div', 'zalozky');
  for (const [k, t] of [['pady', '🏠 Pádová věž'], ['zpevnik', '🎵 Ptačí zpěvník'], ['promeny', '📖 Proměny']]) {
    const b = el('button', `zalozka${k === zalozka ? ' aktivni' : ''}`, t);
    b.onclick = () => { zvuk.klik(); sbirka(k); };
    zal.append(b);
  }
  obsah.append(zal);
  if (zalozka === 'pady') {
    obsah.append(el('div', 'vez-tahak', [...CISLA_PADU].reverse().map((c) => `
      <div class="vt-patro" style="--b:${PADY[c].barva}">${pradnikSVG(c, bodyPadu(c), { velikost: 44 })}<b>${c}. pád</b><span>${PADY[c].otazka}</span></div>`).join('')));
    obsah.append(el('p', 'pribeh male', 'Pád poznáš podle otázky: zeptej se ve větě a podívej se, která otázka sedí.'));
  } else if (zalozka === 'zpevnik') {
    // předložky z dat seskupené podle pádu; naučené (aspoň 2× správně) svítí
    const podlePadu = {};
    for (const p of data.ptacek) (podlePadu[p.pad] ||= new Set()).add(p.predlozka.zaklad);
    const radky = Object.keys(podlePadu).sort().map((c) => `
      <div class="zp-radek" style="--b:${PADY[c].barva}"><span class="zp-pad">${odznak(Number(c), true)}</span><span class="zp-noty">${[...podlePadu[c]].map((pr) => {
        const n = stav.predlozky[`${pr}|${c}`] || 0;
        return `<span class="nota ${n >= 2 ? 'naucena' : ''}">${n >= 2 ? '🎵 ' : ''}${esc(pr)}</span>`;
      }).join('')}</span></div>`).join('');
    obsah.append(el('div', 'zpevnik', radky));
    obsah.append(el('p', 'pribeh male', 'Písnička se rozsvítí, když předložku dvakrát trefíš. Některé předložky chodí se dvěma pády (na stole × na stůl).'));
  } else {
    const mam = data.promeny.filter((s) => stav.sbirka[s.slovo]);
    const mriz = el('div', 'mriz-promen');
    for (const s of data.promeny) {
      const ma = !!stav.sbirka[s.slovo];
      const b = el('button', `karticka ${ma ? '' : 'zamcena'}`, ma ? `<span>${s.obrazek}</span><b>${esc(s.slovo)}</b>` : '<span>❔</span><b>?</b>');
      if (ma) b.onclick = () => { zvuk.klik(); detail.innerHTML = `<div class="tabulka-promen"><div class="tp-obrazek">${s.obrazek}</div>${tabulkaTvaru(s)}</div>`; };
      mriz.append(b);
    }
    const detail = el('div', 'detail-promeny', mam.length ? 'Ťukni na slovo a uvidíš všechny jeho proměny.' : 'Zatím tu nic není. Zahraj si Proměny!');
    obsah.append(mriz, detail);
  }
  otevriPanel(obsah, true);
}

function nastaveni(potvrdSmazani = false) {
  const n = stav.nastaveni;
  const o = el('div', 'nastaveni');
  o.append(el('h2', 'nadpis', 'Pro rodiče'));
  // úspěšnost po pádech
  const pady = el('div', 'stat-pady');
  for (const c of CISLA_PADU) {
    const s = stav.pady[c] || { ok: 0, spatne: 0, posledni: [] };
    const celkem = s.ok + s.spatne;
    const pct = celkem ? Math.round((s.ok / celkem) * 100) : null;
    const posl = s.posledni.length ? Math.round((s.posledni.reduce((a, b) => a + b, 0) / s.posledni.length) * 100) : null;
    pady.append(el('div', 'sp-radek', `${odznak(c)}<span class="sp-pruh"><i style="width:${pct ?? 0}%;background:${PADY[c].barva}"></i></span>
      <span class="sp-cisla">${celkem ? `${pct} % z ${celkem}` : '–'}${posl !== null ? ` · posledních ${s.posledni.length}: ${posl} %` : ''}</span>`));
  }
  o.append(el('h3', '', 'Úspěšnost podle pádů (napoprvé)'), pady);
  o.append(el('p', 'male', '„Posledních“ počítá jen odpovědi bez nápovědy. Pády s nejnižším číslem stojí za procvičení i doma.'));

  // úrovně nápověd
  o.append(el('h3', '', 'Nápovědy'));
  o.append(el('p', 'male', `Auto: po ${POSTUP_ZA} správných bez nápovědy za sebou se nápovědy schovají o stupeň, po ${POKLES_ZA} chybách z posledních 6 se zase ukážou.`));
  for (const [id, hra] of Object.entries(HRY)) {
    const r = el('div', 'nast-radek', `<span>${hra.nazev}</span>`);
    const sel = el('select', 'vyber');
    sel.innerHTML = `<option value="0">Auto (teď ${stav.urovne[id]}: ${NAZVY_UROVNI[stav.urovne[id]]})</option>${[1, 2, 3].map((u) => `<option value="${u}">Vždy ${u}: ${NAZVY_UROVNI[u]}</option>`).join('')}`;
    sel.value = String(n.urovne[id] || 0);
    sel.onchange = () => { n.urovne[id] = Number(sel.value); uloz(); };
    r.append(sel);
    o.append(r);
  }

  o.append(el('h3', '', 'Hra'));
  const prepinac = (popis, klic, poZmene) => {
    const r = el('label', 'nast-radek', `<span>${popis}</span>`);
    const c = el('input');
    c.type = 'checkbox'; c.checked = !!n[klic];
    c.onchange = () => { n[klic] = c.checked; uloz(); poZmene?.(); };
    r.append(c);
    o.append(r);
  };
  prepinac('Zvuky', 'zvuk', () => nastavZtlumeni(!n.zvuk));
  prepinac('Tlačítko 🔊 pro přečtení věty', 'cteni');
  if (baliky.length > 1) {
    const r = el('div', 'nast-radek', '<span>Sada vět a slov</span>');
    const sel = el('select', 'vyber', baliky.map((b) => `<option value="${esc(b.id)}">${esc(b.nazev)}</option>`).join(''));
    sel.value = n.balik;
    sel.onchange = async () => { n.balik = sel.value; uloz(); data = await nactiData(); };
    r.append(sel);
    o.append(r);
  }

  if (stav.chyby.length) {
    o.append(el('h3', '', 'Poslední chyby'));
    o.append(el('div', 'chyby', stav.chyby.slice(0, 12).map((ch) => `<div class="chyba"><span class="ch-hra">${HRY[ch.hra]?.nazev || ''}</span>
      ${esc(ch.veta)} → <b>${esc(ch.slovo)}</b> je ${odznak(ch.spravne)}, zvoleno: ${typeof ch.zvoleno === 'number' ? odznak(ch.zvoleno) : `„${esc(ch.zvoleno)}“`}</div>`).join('')));
  }
  const kol = Object.entries(stav.kol).map(([id, k]) => `${HRY[id]?.nazev}: ${k}`).join(' · ');
  o.append(el('p', 'male', `Odehraná kola: ${kol || 'zatím žádné'}. Detektiv: ${stav.pripady || 0} případů (hodnosti: ${HODNOSTI.map((h) => h.nazev).join(', ')}).`));

  const smaz = el('button', 'tl nebezpecne', potvrdSmazani ? 'Opravdu smazat všechno? Ťukni znovu.' : 'Smazat postup a začít znovu');
  smaz.onclick = () => {
    if (!potvrdSmazani) { nastaveni(true); return; }
    localStorage.removeItem(KLIC); stav = novyStav(); uloz(); zavriPanel(); domu();
  };
  o.append(el('div', 'tlacitka', [smaz]));
  otevriPanel(o, true);
}

// ---------- drobnosti ----------
let casOznameni = null;
function oznameni(html, ms = 2200) {
  const b = $('#oznameni');
  b.innerHTML = html;
  b.hidden = false;
  b.classList.remove('ukaz'); void b.offsetWidth; b.classList.add('ukaz');
  clearTimeout(casOznameni);
  casOznameni = setTimeout(() => { b.hidden = true; }, ms);
}
function konfety() {
  const k = $('#konfety');
  const kusy = ['⭐', '✨', '🎉', '💛', '🌟'];
  for (let i = 0; i < 26; i++) {
    const s = el('span', '', kusy[i % kusy.length]);
    s.style.left = `${Math.random() * 100}vw`;
    s.style.animationDelay = `${Math.random() * 0.6}s`;
    s.style.fontSize = `${20 + Math.random() * 22}px`;
    k.append(s);
    setTimeout(() => s.remove(), 3200);
  }
}

// ---------- start ----------
(async () => {
  nastavZtlumeni(!stav.nastaveni.zvuk);
  try {
    data = await nactiData();
  } catch (e) {
    console.error(e);
    $('#nacitani').textContent = 'Nepodařilo se načíst data hry. Zkus stránku obnovit.';
    return;
  }
  uloz();
  $('#nacitani').hidden = true;
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
  const rovnou = params.get('hra');
  if (rovnou && HRY[rovnou]) hraj(rovnou); else domu();
  window.__padam = { stav: () => stav, data: () => data, hraj, domu, nastaveni };
})();
