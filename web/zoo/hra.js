// Slovní zoo: obrazovky (mapa zoo, výběh, lekce, úloha, souhrn, tahák, nastavení) a průběh kurzu.
// Kurz: v každém výběhu lekce → trénink po kolech, dokud nejsou zvládnuté všechny dovednosti → souboj se Zmatkářem
// (bez nápověd, nejvýš 1 chyba) → další výběh. Nakonec Velká zkouška ze všech slovních druhů.
// Nápovědy (otázky zvířat) mizí: u nové dovednosti svítí, po prvním úspěchu jsou bledé, pak schované (💡 je ukáže,
// jen se pak úloha nepočítá do zvládnutí). Chyba = zvíře vysvětlí proč, hráč to musí udělat sám a úloha se vrátí.
import { generuj, pripravData, vysvetli, vyber, zamichej, esc, cap } from './ulohy.js';
import { prisera } from './prisery.js';
import { zvuk, nastavZtlumeni, odemkni } from './zvuk.js';
import * as postup from './postup.js';

const POCHVALY = ['Správně!', 'Výborně!', 'Přesně tak!', 'Paráda!', 'Ano!', 'Super!', 'Mňam!', 'Bravo!'];
let K = null, DATA = null;
const POL = {};               // gid „vybeh:polozka“ → { tema, p }
let S = { obr: 'nacitani' };
let tahak = false;
let casovac = null;
let vrMozne = false, veVR = false;
const posluchaci = [];
export function poslouchej(fn) { posluchaci.push(fn); }
export const stav = () => S;
export const data = () => DATA;
export function nastavVR(v) { veVR = v; render(); }
const oznam = () => posluchaci.forEach((f) => f(S));
const app = () => document.getElementById('app');
const zrus = () => { clearTimeout(casovac); casovac = null; };

// ---------- načtení ----------
export async function start() {
  const j = (u) => fetch(u, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(u); return r.json(); });
  try {
    const [kurz, druhy, slova, vety, promeny, vybehy] = await Promise.all(['kurz', 'druhy', 'slova', 'vety', 'promeny', 'vybehy'].map((n) => j(`data/${n}.json`)));
    DATA = pripravData({ druhy, slova, vety, promeny, vybehy });
    const temata = vybehy.vybehy.map((t) => {
      const d = t.druh ? DATA.D[t.druh] : null;
      const x = { ...t, ikona: t.ikona || d.ikona, nazev: t.nazev || d.nazev, barva: t.barva || d.barva };
      x.polozky.forEach((p) => { p.gid = `${t.id}:${p.id}`; p.serie = p.serie || 3; POL[p.gid] = { tema: x, p }; });
      return x;
    });
    // pseudo-položky Velké zkoušky
    for (const g of ['krmeni', 'veta', 'najdi', 'vlacek', 'cislo', 'zkus', 'satna', 'skupina']) POL[`zav:${g}`] = { tema: null, p: { gid: `zav:${g}`, gen: g, nazev: 'Velká zkouška', serie: 1 } };
    K = { ...kurz, temata };
  } catch (e) {
    app().innerHTML = `<div class="karta chyba-nacteni">Nepodařilo se načíst zoo (${esc(e.message)}). Zkus stránku obnovit.</div>`;
    return;
  }
  nastavZtlumeni(!postup.P.nast.zvuk);
  document.addEventListener('click', klik);
  document.addEventListener('keydown', klavesa);
  nastavTazeni();
  const q = new URLSearchParams(location.search);
  if (navigator.xr?.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then((ok) => { vrMozne = ok; if (ok) render(); }).catch(() => {});
  if (q.has('vrnahled')) import('./vr.js').then((m) => m.nahledVR());
  if (q.get('lekce')) otevriLekci(q.get('lekce')); else jdi({ obr: 'mapa' });
  window.__zoo = { K, DATA, S: () => S, postup, akce, render, POL };
}

// ---------- stav kurzu ----------
const T = (id) => K.temata.find((x) => x.id === id);
const vsechnyPolozky = () => K.temata.flatMap((t) => t.polozky.map((p) => p.gid));
const temaHotovo = (t) => postup.tema(t.id).strazce;
const odemcene = (i) => i === 0 || temaHotovo(K.temata[i - 1]) || postup.P.vseOdemceno;
const zvladnuto = (t) => t.polozky.filter((p) => postup.zvladnuta(p.gid)).length;
const slabaMista = () => K.temata.filter(temaHotovo).flatMap((t) => t.polozky.map((p) => p.gid)).filter((g) => !postup.zvladnuta(g));
const aktualni = () => K.temata.find((t) => !temaHotovo(t)) || null;
const kurzHotov = () => !aktualni() && postup.P.zaverecna.splnena && !slabaMista().length;
// Druhy, které hráč zná, když je ve výběhu i (včetně): zvířata výběhů 0…i.
const naucDo = (i) => K.temata.slice(0, i + 1).map((t) => t.druh).filter(Boolean);
const indexAkt = () => { const a = aktualni(); return a ? K.temata.indexOf(a) : K.temata.length - 1; };
const znamDruhy = () => naucDo(Math.max(indexAkt(), ...K.temata.map((t, i) => (temaHotovo(t) ? i : -1))));
function hodnost() {
  let h = K.hodnosti[0];
  for (const x of K.hodnosti) if (postup.P.mince >= x.od) h = x;
  return { ...h, dalsi: K.hodnosti.find((x) => x.od > postup.P.mince) };
}
function dalsiKrok() {
  const t = aktualni();
  if (t) {
    if (slabaMista().length >= 3) return { akce: 'oprava', text: `🩹 Nejdřív slabá místa (${slabaMista().length})` };
    if (!postup.tema(t.id).lekce) return { akce: `lekce:${t.id}`, text: `📖 Lekce: ${t.ikona} ${t.nazev}` };
    if (zvladnuto(t) < t.polozky.length) return { akce: `trenink:${t.id}`, text: `🏋️ Trénink: ${t.ikona} ${t.nazev}` };
    return { akce: `strazce:${t.id}`, text: `⚔️ Souboj: ${t.strazce.jmeno}` };
  }
  if (slabaMista().length) return { akce: 'oprava', text: `🩹 Slabá místa (${slabaMista().length})` };
  if (!postup.P.zaverecna.splnena) return { akce: 'zaverecna', text: `🏆 ${K.zaverecna.nazev}` };
  return { akce: 'udrzba', text: '🔁 Udržovací trénink' };
}

// ---------- akce ----------
function klik(e) {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  odemkni();
  akce(el.dataset.a, el);
}
export function akce(a) {
  const [co, arg] = a.split(/:(.*)/s);
  if (co !== 'tahak' && tahak) { tahak = false; }
  switch (co) {
    case 'mapa': zrus(); jdi({ obr: 'mapa' }); break;
    case 'pokracuj': akce(dalsiKrok().akce); break;
    case 'vybeh': jdi({ obr: 'vybeh', tema: arg }); break;
    case 'lekce': otevriLekci(arg); break;
    case 'snimek': posunSnimek(+arg); break;
    case 'trenink': zacni({ druh: 'trenink', tema: arg }); break;
    case 'strazce': zacni({ druh: 'strazce', tema: arg }); break;
    case 'zaverecna': zacni({ druh: 'zaverecna' }); break;
    case 'oprava': zacni({ druh: 'oprava' }); break;
    case 'udrzba': zacni({ druh: 'udrzba' }); break;
    case 'volba': odpovez(arg); break;
    case 'oznac': oznac(+arg); break;
    case 'hotovo': hotovoNajdi(); break;
    case 'napoveda': ukazNapovedu(); break;
    case 'dalsi': dalsiUloha(); break;
    case 'tahak': tahak = !tahak; render(); break;
    case 'nastaveni': jdi({ obr: 'nastaveni' }); break;
    case 'vr': import('./vr.js').then((m) => m.spustVR()).catch((e) => console.error(e)); break;
    case 'vr-konec': import('./vr.js').then((m) => m.ukonciVR()); break;
    case 'zvuk': postup.P.nast.zvuk = !postup.P.nast.zvuk; nastavZtlumeni(!postup.P.nast.zvuk); postup.uloz(); render(); break;
    case 'odemknout': postup.P.vseOdemceno = !postup.P.vseOdemceno; postup.uloz(); render(); break;
    case 'smazat': jdi({ obr: 'smazat' }); break;
    case 'smazat-ano': postup.smaz(); jdi({ obr: 'mapa' }); break;
    default: render(); break;
  }
}
function jdi(s) { zrus(); S = s; render(); window.scrollTo?.(0, 0); }

// ---------- lekce ----------
function otevriLekci(id) {
  if (!T(id)) return jdi({ obr: 'mapa' });
  jdi({ obr: 'lekce', tema: id, snimek: 0 });
}
function posunSnimek(d) {
  const t = T(S.tema), n = S.snimek + d;
  if (n >= t.lekce.length) { postup.tema(t.id).lekce = true; postup.uloz(); zvuk.hvezda(); return zacni({ druh: 'trenink', tema: t.id }); }
  S.snimek = Math.max(0, n); render();
}

// ---------- trénink, souboj, Velká zkouška ----------
function zacni(nast) {
  zrus();
  S = { obr: 'uloha', ...nast, poradi: 0, znovu: [], posledni: [], posl: [], spravne: 0, chyby: 0, nove: [], zapomenute: [], combo: 0, ziskano: 0 };
  if (nast.druh === 'strazce') {
    const t = T(nast.tema);
    // Vláček a hledání jsou delší, proto ve souboji nanejvýš jednou; zbytek slova a věty.
    const zaklad = t.polozky.map((p) => p.gid);
    const kratke = t.polozky.filter((p) => !['vlacek', 'najdi'].includes(p.gen)).map((p) => p.gid);
    S.plan = zamichej([...zaklad, ...Array.from({ length: Math.max(0, K.strazce.otazek - zaklad.length) }, () => vyber(kratke))]);
    S.zivoty = K.strazce.zivotu; S.max = K.strazce.zivotu; S.strazce = t.strazce; S.hp = S.plan.length;
    postup.tema(t.id).pokusy++; postup.uloz();
  }
  if (nast.druh === 'zaverecna') {
    const z = K.zaverecna;
    const zakl = ['veta', 'veta', 'veta', 'veta', 'krmeni', 'krmeni', 'krmeni', 'najdi', 'najdi', 'vlacek', 'vlacek', 'cislo', 'zkus', vyber(['satna', 'skupina'])];
    S.plan = zamichej(zakl.slice(0, z.otazek).map((g) => `zav:${g}`));
    S.zivoty = z.zivotu; S.max = z.zivotu; S.strazce = z.strazce; S.hp = S.plan.length;
    postup.P.zaverecna.pokusy++; postup.uloz();
  }
  dalsiUloha(true);
}
const souboj = () => S.druh === 'strazce' || S.druh === 'zaverecna';
const delkaKola = () => (souboj() ? S.plan.length : K.trenink.delkaKola);

function vyberPolozku() {
  if (souboj()) return S.plan[S.poradi];
  const due = S.znovu.findIndex((z) => z.kdy <= S.poradi);
  if (due >= 0) return S.znovu.splice(due, 1)[0].id;
  const neopakuj = (sez) => { const f = sez.filter((x) => !S.posledni.includes(x)); return f.length ? f : sez; };
  const nejslabsi = (sez) => { const m = Math.min(...sez.map((x) => postup.polozka(x).s)); return vyber(sez.filter((x) => postup.polozka(x).s === m)); };
  if (S.druh === 'oprava') { const sl = slabaMista(); return sl.length ? nejslabsi(neopakuj(sl)) : null; }
  if (S.druh === 'udrzba') {
    const vse = K.temata.filter(temaHotovo).flatMap((t) => t.polozky.map((p) => p.gid)).sort((a, b) => postup.polozka(a).t - postup.polozka(b).t);
    if (!vse.length) return null;
    const chybove = vse.filter((x) => postup.polozka(x).ch > 0);
    return vyber(neopakuj(Math.random() < 0.3 && chybove.length ? chybove : vse.slice(0, 12)));
  }
  const t = T(S.tema);
  const ids = t.polozky.map((p) => p.gid), nezvl = ids.filter((g) => !postup.zvladnuta(g));
  if (!nezvl.length) return vyber(neopakuj(ids));
  const r = Math.random(), sl = slabaMista().filter((g) => POL[g].tema !== t);
  if (sl.length && r < 0.25) return vyber(neopakuj(sl));
  const starsi = K.temata.filter((x) => x !== t && temaHotovo(x)).flatMap((x) => x.polozky.map((p) => p.gid)).filter(postup.zvladnuta);
  if (starsi.length && r > 1 - K.trenink.podilOpakovani) return starsi.sort((a, b) => postup.polozka(a).t - postup.polozka(b).t)[0];
  // Dovednosti se přidávají postupně: nová (ještě nezkoušená) přijde, až má každá předchozí aspoň jeden úspěch.
  const prvniNova = ids.findIndex((g) => { const x = postup.polozka(g); return x.ok + x.ch === 0; });
  const predchoziJdou = ids.slice(0, Math.max(0, prvniNova)).every((g) => postup.polozka(g).s > 0 || postup.zvladnuta(g));
  const povolene = prvniNova < 0 ? nezvl : nezvl.filter((g) => ids.indexOf(g) < prvniNova + (predchoziJdou ? 1 : 0));
  return nejslabsi(neopakuj(povolene.length ? povolene : nezvl));
}

function kontext(gid) {
  const { tema } = POL[gid];
  if (!tema) return { cil: null, naucene: znamDruhy(), posl: S.posl };
  const i = K.temata.indexOf(tema), j = S.tema ? K.temata.indexOf(T(S.tema)) : indexAkt();
  return { cil: tema.druh, naucene: naucDo(Math.max(i, j)), posl: S.posl };
}

function dalsiUloha(prvni) {
  zrus();
  if (!prvni) S.poradi++;
  if (souboj() && (S.zivoty <= 0 || S.poradi >= S.plan.length)) return konecSouboje();
  if (S.druh === 'trenink') {
    const t = T(S.tema);
    if (zvladnuto(t) === t.polozky.length && !postup.tema(t.id).strazce && !S.znovu.length) return souhrn({ vybehZvladnut: true });
  }
  if (S.druh === 'oprava' && !slabaMista().length) return souhrn({});
  if (!souboj() && S.poradi >= delkaKola()) return souhrn({});
  const gid = vyberPolozku();
  if (!gid) return souhrn({});
  const { p } = POL[gid];
  S.posledni = [gid, ...S.posledni].slice(0, 2);
  const u = generuj(p.gen, p.param, DATA, kontext(gid));
  S.posl = [u.klic, ...S.posl].slice(0, 14);
  S.gid = gid; S.u = u;
  S.stav = 'ceka'; S.pokus = 0; S.chybaVUloze = false; S.napoveda = false; S.zprava = null;
  S.spatne = []; S.oznacene = []; S.vagon = 0; S.prirazeno = {}; S.chybneVagony = []; S.odhaleno = false;
  S.opakovani = S.druh === 'trenink' && POL[gid].tema && POL[gid].tema.id !== S.tema;
  render();
}

// Úroveň nápovědy: 0 = otázky zvířat svítí, 1 = bledé, 2 = schované.
function uroven() {
  if (souboj()) return 2;
  if (S.napoveda) return 0;
  return Math.min(2, postup.polozka(S.gid).s);
}

// ---------- odpovědi ----------
// Pro VR: má teď hráč krmit (vybrat zvíře)? Vrací { slovo, moznosti, kos, spatne, uroven } nebo null.
export function krmeni() {
  if (S.obr !== 'uloha' || S.stav !== 'ceka') return null;
  const u = S.u;
  if (u.typ === 'druh') return { slovo: u.slovo, moznosti: u.moznosti, kos: u.kos, spatne: S.spatne, uroven: uroven() };
  if (u.typ === 'vlacek') return { slovo: u.veta[u.poradi[S.vagon]].t, moznosti: u.moznosti, kos: false, spatne: S.spatne, uroven: uroven() };
  return null;
}

function odpovez(arg) {
  if (S.obr !== 'uloha' || S.stav !== 'ceka') return;
  const u = S.u;
  if (u.typ === 'volba') return odpovezVolbu(arg);
  const n = +arg;
  if (u.typ === 'druh') {
    if (S.spatne.includes(n)) return;
    if (n === u.spravne) return dokonci(true);
    return chybaDruhu(n, { slovo: u.slovo, spravne: u.spravne, skutecny: u.skutecny, pozn: u.pozn });
  }
  if (u.typ === 'vlacek') {
    const i = u.poradi[S.vagon], tok = u.veta[i];
    if (S.spatne.includes(n)) return;
    if (n === tok.d) {
      S.prirazeno[i] = n; S.vagon++; S.spatne = []; S.pokus = 0;
      if (S.vagon >= u.poradi.length) return dokonci(true);
      zvuk.krok(); S.zprava = { typ: 'ok-krok', text: `✓ ${esc(tok.t)} = ${DATA.D[n].ikona} ${DATA.D[n].jedn}` };
      return render();
    }
    const pozn = u.pozn?.[tok.t] || DATA.pozn[tok.t.toLowerCase()] || '';
    const info = { slovo: tok.t, spravne: tok.d, skutecny: tok.d, pozn };
    if (souboj()) {
      S.chybneVagony.push(i);
      u.poradi.slice(S.vagon).forEach((k) => { S.prirazeno[k] = u.veta[k].d; });
      return chybaSouboje(vysvetli(DATA, { ...info, zvoleny: n }));
    }
    S.chybaVUloze = true; S.combo = 0; S.pokus++;
    zvuk.spatne();
    if (S.pokus >= 2) {
      S.chybneVagony.push(i); S.prirazeno[i] = tok.d; S.vagon++; S.spatne = []; S.pokus = 0;
      S.zprava = { typ: 'chyba', text: vysvetli(DATA, { ...info, zvoleny: n }) + ' Jedeme dál.' };
      if (S.vagon >= u.poradi.length) return dokonci(false);
      return render();
    }
    S.spatne.push(n);
    S.zprava = { typ: 'chyba1', text: vysvetli(DATA, { ...info, zvoleny: n }) + ' Teď to zkus sám.' };
    return render();
  }
}
function chybaDruhu(n, info) {
  const text = vysvetli(DATA, { ...info, zvoleny: n });
  if (souboj()) return chybaSouboje(text);
  S.chybaVUloze = true; S.combo = 0; S.pokus++;
  zvuk.spatne();
  if (S.pokus >= 2) { S.odhaleno = true; return dokonci(false, text); }
  S.spatne.push(n);
  S.zprava = { typ: 'chyba1', text: text + ' Teď to zkus sám.' };
  render();
}
function odpovezVolbu(id) {
  const u = S.u;
  if (S.spatne.includes(id)) return;
  if (id === u.spravne) return dokonci(true);
  if (souboj()) return chybaSouboje(u.vysvetleni);
  S.chybaVUloze = true; S.combo = 0; S.pokus++;
  zvuk.spatne();
  if (S.pokus >= 2 || u.moznosti.length === 2) { S.odhaleno = true; return dokonci(false, u.vysvetleni); }
  S.spatne.push(id);
  S.zprava = { typ: 'chyba1', text: `Tohle ne. ${u.vysvetleni} Teď to zkus sám.` };
  render();
}
function oznac(i) {
  if (S.obr !== 'uloha' || S.stav !== 'ceka' || S.u.typ !== 'najdi') return;
  const x = S.oznacene.indexOf(i);
  if (x >= 0) S.oznacene.splice(x, 1); else S.oznacene.push(i);
  zvuk.klik(); render();
}
function hotovoNajdi() {
  if (S.obr !== 'uloha' || S.stav !== 'ceka' || S.u.typ !== 'najdi') return;
  const u = S.u, sp = new Set(u.spravne), oz = new Set(S.oznacene);
  if (!oz.size) { S.zprava = { typ: 'info', text: 'Nejdřív klepni na slova, která patří zvířeti.' }; return render(); }
  const chybi = u.spravne.filter((i) => !oz.has(i)), navic = S.oznacene.filter((i) => !sp.has(i));
  if (!chybi.length && !navic.length) return dokonci(true);
  const d = DATA.D[u.cil];
  const casti = [];
  if (navic.length) {
    const t = u.veta[navic[0]];
    casti.push(`<b>${esc(t.t)}</b> sem nepatří. ` + vysvetli(DATA, { slovo: t.t, spravne: t.d, skutecny: t.d, zvoleny: -1, pozn: u.pozn[t.t] || '' }));
  }
  if (chybi.length) casti.push(`Ještě ${chybi.length === 1 ? 'ti chybí jedno slovo' : `ti chybí ${chybi.length} slova`}. ${d.ikona} ${d.zvire} se ptá: „${d.otazka}“`);
  if (souboj()) { S.oznacene = [...u.spravne]; S.navic = navic; return chybaSouboje(casti.join(' ')); }
  S.chybaVUloze = true; S.combo = 0; S.pokus++;
  zvuk.spatne();
  if (S.pokus >= 2) { S.navic = navic; S.chybi = chybi; S.oznacene = [...u.spravne]; S.odhaleno = true; return dokonci(false, casti.join(' ')); }
  S.oznacene = S.oznacene.filter((i) => sp.has(i)); // co bylo navíc, odznačíme (už víš proč)
  S.zprava = { typ: 'chyba1', text: casti.join(' ') + ' Zkus to opravit.' };
  render();
}
function ukazNapovedu() {
  if (S.stav !== 'ceka' || S.napoveda || souboj()) return;
  S.napoveda = true; render();
}

function chybaSouboje(text) {
  zvuk.spatne();
  S.zivoty--; S.chyby++; S.combo = 0;
  postup.zapis(S.gid, false, POL[S.gid].p.serie);
  S.stav = 'vyhodnoceno'; S.odhaleno = true;
  S.zprava = { typ: 'chyba', text };
  render();
}

// Úloha dokončena (správně = bez chyby). U chyby po druhém pokusu se ukáže řešení a úloha se vrátí.
function dokonci(ok, vysv) {
  S.stav = 'vyhodnoceno';
  const p = POL[S.gid].p;
  const spravne = ok && !S.chybaVUloze;
  if (souboj()) {
    S.spravne++; S.hp--; S.combo++;
    pridejMince(1);
    postup.zapis(S.gid, true, p.serie);
    zvuk.zasah();
    S.zprava = { typ: 'ok', text: `${vyber(POCHVALY)} Zmatkář dostal banánem! 🍌💥` };
    render();
    casovac = setTimeout(dalsiUloha, 1400);
    return;
  }
  const r = postup.zapis(S.gid, spravne ? (S.napoveda ? null : true) : false, p.serie);
  if (r.zvladnuta) S.nove.push(S.gid);
  if (r.zapomenuta) S.zapomenute.push(S.gid);
  const ukazka = S.u.ukazka ? `<div class="ukazka">${S.u.ukazka}</div>` : '';
  if (spravne) {
    S.spravne++; S.combo++;
    postup.P.nejdelsiSerie = Math.max(postup.P.nejdelsiSerie, S.combo);
    const zisk = pridejMince(nasobitel());
    const nap = S.napoveda ? ' <small>(s nápovědou se nepočítá do zvládnutí)</small>' : '';
    S.zprava = { typ: 'ok', text: `${vyber(POCHVALY)} +${zisk} 🍌${nap}${r.zvladnuta ? ` <b>⭐ „${p.nazev}“ zvládnuto!</b>` : ''}${ukazka}` };
    r.zvladnuta ? zvuk.hvezda() : zvuk.dobre();
    render();
    if (!ukazka) casovac = setTimeout(dalsiUloha, r.zvladnuta ? 1900 : 1300);
  } else {
    S.chyby++; S.combo = 0;
    S.znovu.push({ id: S.gid, kdy: S.poradi + 3 });
    S.zprava = ok
      ? { typ: 'dokonceno', text: `Hotovo, ale s chybou. Tahle úloha se ti brzy vrátí, ať ji dáš napoprvé.${ukazka}` }
      : { typ: 'chyba', text: `${vysv || ''} <div class="vrati">🔁 Úloha se ti brzy vrátí.</div>` };
    if (ok) zvuk.krok();
    render();
  }
}
const nasobitel = () => (S.combo >= 10 ? 4 : S.combo >= 6 ? 3 : S.combo >= 3 ? 2 : 1);
function pridejMince(n) { postup.P.mince += n; S.ziskano += n; postup.uloz(); return n; }

function konecSouboje() {
  const vyhra = S.zivoty > 0;
  if (S.druh === 'strazce') { if (vyhra) { postup.tema(S.tema).strazce = true; pridejMince(20); } }
  else {
    const z = postup.P.zaverecna;
    if (vyhra) { z.splnena = true; pridejMince(50); }
    z.nejlepsi = Math.max(z.nejlepsi ?? 0, S.spravne);
  }
  postup.uloz();
  vyhra ? zvuk.vyhra() : zvuk.prohra();
  souhrn({ souboj: true, vyhra });
}
function souhrn(x) {
  zrus();
  S = { obr: 'souhrn', prev: S, ...x };
  if (x.vybehZvladnut) zvuk.vyhra();
  render();
}

// ---------- klávesnice počítače: číslice = zvíře podle čísla druhu, K = košík, 1–4 u voleb ----------
function klavesa(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape' && tahak) { tahak = false; render(); return; }
  if (S.obr === 'lekce') {
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); posunSnimek(1); }
    if (e.key === 'ArrowLeft') posunSnimek(-1);
    return;
  }
  if (S.obr === 'souhrn' && e.key === 'Enter') { e.preventDefault(); document.querySelector('.tl.hlavni')?.click(); return; }
  if (S.obr !== 'uloha') return;
  if (S.stav === 'vyhodnoceno') { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dalsiUloha(); } return; }
  const u = S.u;
  if (u.typ === 'volba') { const i = +e.key - 1; if (u.moznosti[i]) { e.preventDefault(); odpovez(u.moznosti[i].id); } return; }
  if (u.typ === 'najdi') { if (e.key === 'Enter') { e.preventDefault(); hotovoNajdi(); } return; }
  if (/^\d$/.test(e.key)) { const n = e.key === '0' ? 10 : +e.key; if (u.moznosti.includes(n)) { e.preventDefault(); odpovez(String(n)); } }
  if ((e.key === 'k' || e.key === 'K') && u.kos) odpovez('0');
}

// ---------- tažení slova na zvíře (tablet, myš) ----------
function nastavTazeni() {
  let tah = null;
  document.addEventListener('pointerdown', (e) => {
    const k = e.target.closest('.krmivo, .zvyraznene');
    if (!k || S.stav !== 'ceka' || veVR) return;
    const r = k.getBoundingClientRect();
    tah = { el: k, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, klon: null };
  });
  document.addEventListener('pointermove', (e) => {
    if (!tah) return;
    if (!tah.klon && Math.hypot(e.clientX - tah.x, e.clientY - tah.y) < 8) return;
    if (!tah.klon) {
      tah.klon = tah.el.cloneNode(true); tah.klon.classList.add('leti');
      tah.klon.style.width = tah.el.offsetWidth + 'px';
      document.body.appendChild(tah.klon); tah.el.classList.add('prazdne');
    }
    tah.klon.style.left = e.clientX - tah.dx + 'px'; tah.klon.style.top = e.clientY - tah.dy + 'px';
    document.querySelectorAll('.zvire-tl.nad').forEach((x) => x.classList.remove('nad'));
    tah.klon.style.display = 'none';
    document.elementFromPoint(e.clientX, e.clientY)?.closest('.zvire-tl')?.classList.add('nad');
    tah.klon.style.display = '';
  });
  const konec = (e) => {
    if (!tah) return;
    const t = tah; tah = null;
    if (!t.klon) return;
    t.klon.remove(); t.el.classList.remove('prazdne');
    const cil = document.elementFromPoint(e.clientX, e.clientY)?.closest('.zvire-tl:not(:disabled)');
    document.querySelectorAll('.zvire-tl.nad').forEach((x) => x.classList.remove('nad'));
    if (cil) { odemkni(); akce(cil.dataset.a); }
  };
  document.addEventListener('pointerup', konec);
  document.addEventListener('pointercancel', konec);
}

// ================= vykreslení =================
// Text lekce: **tučně**, [slovo|N] = štítek slova s barvou a zvířetem druhu N.
const text = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[([^|\]]+)\|(\d+)\]/g, (_, w, n) => stitek(w, +n));
const stitek = (w, n) => { const d = DATA.D[n]; return `<span class="chip" style="--b:${d.barva}" title="${d.jedn}">${d.ikona} ${w}</span>`; };
const tl = (a, t, styl = '', x = '') => `<button class="tl ${styl}" data-a="${a}" ${x}>${t}</button>`;

export function render() {
  const el = app(); if (!el || !K) return;
  const o = S.obr;
  el.className = 'obr-' + o;
  el.innerHTML = (o === 'mapa' ? rMapa() : o === 'vybeh' ? rVybeh() : o === 'lekce' ? rLekce() : o === 'uloha' ? rUloha()
    : o === 'souhrn' ? rSouhrn() : o === 'nastaveni' ? rNastaveni() : o === 'smazat' ? rSmazat() : '') + (tahak ? rTahak() : '');
  if (o === 'uloha') document.querySelector('.zprava:not(.ok-krok)')?.scrollIntoView?.({ block: 'nearest' });
  oznam();
}

function hlavicka(levy) {
  const h = hodnost();
  return `<header class="hlava">${levy || `<div class="logo">🦒 ${K.nazev}</div>`}
    <div class="hlava-vpravo"><span class="mince" title="Banány">🍌 ${postup.P.mince}</span><span class="hodnost">${h.nazev}</span>${tl('tahak', '📖', 'male kulate', 'aria-label="Tahák" title="Tahák: všechna zvířata a jejich otázky"')}${veVR ? tl('vr-konec', 'Opustit VR', 'male') : vrMozne ? tl('vr', '🥽 Do VR', 'male hlavni') : ''}${tl('nastaveni', '⚙️', 'male kulate', 'aria-label="Nastavení"')}</div></header>`;
}

function rMapa() {
  const d = dalsiKrok(), h = hodnost();
  const vybehy = K.temata.map((t, i) => {
    const st = postup.tema(t.id), od = odemcene(i), z = zvladnuto(t), n = t.polozky.length;
    const hvezdy = (st.lekce ? 1 : 0) + (z === n ? 1 : 0) + (st.strazce ? 1 : 0);
    const cislo = t.druh ? `<span class="cislo-druhu">${t.druh}</span>` : '<span class="cislo-druhu satna">1–5 × 6–10</span>';
    return `<button class="vybeh ${od ? '' : 'zamceno'} ${st.strazce ? 'hotovo' : ''} ${aktualni() === t ? 'aktualni' : ''}" data-a="vybeh:${t.id}" ${od ? '' : 'disabled'} style="--b:${t.barva}">
      ${cislo}
      <span class="vybeh-zvire">${od ? t.ikona : '🔒'}</span>
      <b>${od ? cap(t.nazev) : '???'}</b><small>${od ? t.vybeh : 'Zatím zavřeno'}</small>
      <span class="hvezdy">${'★'.repeat(hvezdy)}<span class="prazdne">${'★'.repeat(3 - hvezdy)}</span></span>
      <span class="mini-pokrok"><span style="width:${(100 * z) / n}%"></span></span>
      ${st.strazce ? '<span class="porazen">🏆</span>' : ''}
    </button>`;
  }).join('');
  const zav = K.zaverecna, zOd = !aktualni() || postup.P.vseOdemceno, slaba = slabaMista().length;
  return `${hlavicka()}
  <main class="mapa">
    <section class="karta uvod">
      <h1>🦒 ${K.nazev}</h1>
      <p>${K.podtitul}. Každé zvíře se ptá svou otázkou a sní jen slova, která na ni odpovídají. V každém výběhu je lekce, krmení a nakonec Zmatkář, který krmení plete.</p>
      ${tl('pokracuj', d.text + ' ▶', 'hlavni velke blika')}
      <div class="statistika">${h.dalsi ? `Do hodnosti <b>${h.dalsi.nazev}</b> chybí ${h.dalsi.od - postup.P.mince} 🍌` : 'Nejvyšší hodnost! 🎖️'}${slaba ? ` · 🩹 slabých míst: ${slaba}` : ''}</div>
    </section>
    <div class="zoo">${vybehy}
      <button class="vybeh brana ${zOd ? '' : 'zamceno'} ${postup.P.zaverecna.splnena ? 'hotovo' : ''}" data-a="zaverecna" ${zOd ? '' : 'disabled'} style="--b:${zav.strazce.barva}">
        <span class="vybeh-zvire">${zOd ? '🏆' : '🔒'}</span>
        <b>${zav.nazev}</b><small>${postup.P.zaverecna.splnena ? 'Splněno! 🎉' : zOd ? 'Všechna zvířata najednou' : 'Otevře se po všech výbězích'}</small>
        ${postup.P.zaverecna.splnena ? '<span class="porazen">🏆</span>' : ''}
      </button>
    </div>
    ${kurzHotov() ? `<section class="karta hotovo-kurz">🎓 <b>Slovní druhy máš zvládnuté všechny!</b> Udržovací trénink ti je občas připomene. ${tl('udrzba', '🔁 Udržovací trénink', 'hlavni')}</section>` : ''}
  </main>`;
}

function rVybeh() {
  const t = T(S.tema), st = postup.tema(t.id), z = zvladnuto(t), n = t.polozky.length, d = t.druh && DATA.D[t.druh];
  const polozky = t.polozky.map((p) => {
    const pp = postup.polozka(p.gid);
    return `<li class="${pp.z ? 'zvladnuto' : ''}"><span>${pp.z ? '⭐' : '○'} ${p.nazev}</span><span class="serie">${Array.from({ length: p.serie }, (_, i) => `<i class="${i < Math.min(pp.s, p.serie) ? 'plna' : ''}"></i>`).join('')}</span></li>`;
  }).join('');
  return `${hlavicka(tl('mapa', '◀ Zoo', 'male'))}
  <main class="vybeh-detail">
    <section class="karta" style="--b:${t.barva}">
      <div class="vybeh-hlava"><span class="velka-ikona">${t.ikona}</span><div><h1>${cap(t.nazev)}${t.druh ? ` <span class="cislo-druhu">${t.druh}</span>` : ''}</h1><p>${t.vybeh}${d ? ` · ${d.zvire} se ptá: <b>${d.otazka}</b>` : ''}</p></div></div>
      <div class="tlacitka">
        ${tl(`lekce:${t.id}`, `📖 Lekce${st.lekce ? ' ✓' : ''}`, st.lekce ? '' : 'hlavni')}
        ${tl(`trenink:${t.id}`, `🍌 Krmení (${z}/${n})`, st.lekce && z < n ? 'hlavni' : '')}
        ${tl(`strazce:${t.id}`, st.strazce ? '⚔️ Souboj znovu' : '⚔️ Souboj se Zmatkářem', !st.strazce && z === n ? 'hlavni' : '', z === n || st.strazce ? '' : 'disabled title="Nejdřív zvládni všechny dovednosti"')}
      </div>
      <h2>Dovednosti</h2>
      <ul class="dovednosti">${polozky}</ul>
      <p class="mala">Dovednost je zvládnutá, když ji několikrát za sebou (kolik je teček) dáš napoprvé bez chyby. Ze začátku ti zvířata napovídají svými otázkami, pak nápovědy blednou a nakonec zmizí.</p>
    </section>
    <section class="karta strazce-karta">
      ${prisera(t.strazce, st.strazce ? 'porazen' : '')}
      <div><h2>${t.strazce.jmeno}</h2><p class="bublina">${st.strazce ? 'No jo, no jo… vyhrál jsi. Už nic neplétu.' : t.strazce.hlaska}</p>
      <p class="mala">Souboj: ${K.strazce.otazek} úloh, bez nápověd, smíš udělat 1 chybu.</p></div>
    </section>
  </main>`;
}

function rLekce() {
  const t = T(S.tema), sn = t.lekce[S.snimek], posl = S.snimek === t.lekce.length - 1;
  let obr = '';
  if (sn.zvire) { const d = DATA.D[sn.zvire]; obr += `<div class="lekce-zvire" style="--b:${d.barva}"><span class="obri">${d.ikona}</span><div><b>${d.zvire}</b> · ${d.cislo}. ${d.nazev}<div class="bublina">${d.otazka}</div></div></div>`; }
  if (sn.zoo) obr += `<div class="zoo-nahled">${Object.values(DATA.D).map((d) => `<span class="zn" style="--b:${d.barva}"><span>${d.ikona}</span><small>${d.cislo}. ${d.nazev}</small></span>`).join('')}</div>`;
  if (sn.veta) obr += rVlak(DATA.vety.find((v) => v.v === sn.veta)?.tok || [], { ukaz: sn.ukaz });
  if (sn.satna) obr += sn.satna === 'ohebna'
    ? `<div class="satna-ukazka">${DATA.ohebna.slice(0, 4).map((e) => `<div>👕 <b>${esc(e.slovo)}</b>: ${e.tvary.map((x) => `<span class="tvar">${esc(x)}</span>`).join(' ')}</div>`).join('')}</div>`
    : `<div class="satna-ukazka">${DATA.neohebna.filter((_, i) => i % 3 === 0).slice(0, 4).map((e) => `<div>🧥 <b>${esc(e.slovo)}</b>: ${e.vety.map((x) => `<span class="tvar">${esc(x)}</span>`).join(' ')}</div>`).join('')}</div>`;
  return `${hlavicka(tl('mapa', '◀ Zoo', 'male'))}
  <main class="lekce">
    <div class="pokrok-lekce">${t.lekce.map((_, i) => `<i class="${i <= S.snimek ? 'plna' : ''}"></i>`).join('')}</div>
    <section class="karta snimek">
      <div class="stitek">${t.ikona} ${t.vybeh} · lekce ${S.snimek + 1}/${t.lekce.length}</div>
      <h1>${text(sn.nadpis)}</h1>
      ${obr}
      ${sn.text.map((p) => `<p>${text(p)}</p>`).join('')}
    </section>
    <div class="tlacitka">
      ${S.snimek > 0 ? tl('snimek:-1', '◀ Zpět') : ''}
      ${tl('snimek:1', posl ? 'Jdeme krmit 🍌' : 'Další ▶', 'hlavni velke')}
    </div>
  </main>`;
}

// Věta jako vláček. opt.ukaz = zvýraznit druh (lekce); opt.hra = úloha vláček; opt.najdi = klikací slova.
function rVlak(tok, opt = {}) {
  const u = S.u;
  const vagony = tok.map((t, i) => {
    let tridy = 'vagon', zv = '', a = '';
    if (opt.ukaz != null) { if (t.d === opt.ukaz) { tridy += ' zvyrazneny'; zv = DATA.D[t.d].ikona; } }
    else if (opt.hra) {
      const prir = S.prirazeno[i];
      if (!u.poradi.includes(i)) { tridy += ' neznamy'; zv = '❔'; }
      else if (prir) { tridy += S.chybneVagony.includes(i) ? ' spatne' : ' hotovy'; zv = DATA.D[prir].ikona; }
      else if (S.stav === 'ceka' && u.poradi[S.vagon] === i) { tridy += ' aktualni'; zv = '👉'; }
      else zv = '·';
    } else if (opt.najdi) {
      const oz = S.oznacene.includes(i);
      if (oz && S.stav === 'ceka') tridy += ' oznaceny';
      if (S.stav !== 'ceka') {
        if (u.spravne.includes(i)) { tridy += (S.chybi || []).includes(i) ? ' chybel' : ' hotovy'; zv = DATA.D[u.cil].ikona; }
        if ((S.navic || []).includes(i)) tridy += ' spatne';
      } else if (oz) zv = DATA.D[u.cil].ikona;
      a = S.stav === 'ceka' ? `data-a="oznac:${i}"` : '';
    }
    const st = opt.ukaz != null && t.d === opt.ukaz ? `style="--b:${DATA.D[t.d].barva}"` : opt.hra && S.prirazeno[i] ? `style="--b:${DATA.D[S.prirazeno[i]].barva}"` : '';
    const tag = a ? 'button' : 'span';
    return `<${tag} class="${tridy}" ${a} ${st}><span class="vagon-zv">${zv}</span><span class="vagon-sl">${esc(t.t)}${esc(t.p)}</span></${tag}>`;
  }).join('');
  return `<div class="vlak ${opt.najdi ? 'najdi' : ''}"><span class="lokomotiva">🚂</span>${vagony}</div>`;
}

function rZvirata(moznosti, kos, spravne) {
  const lvl = uroven();
  const tl2 = moznosti.map((n) => {
    const d = DATA.D[n], sp = S.spatne.includes(n), ok = S.stav !== 'ceka' && n === spravne;
    return `<button class="zvire-tl ${sp ? 'spatne' : ''} ${ok ? 'spravne' : ''}" data-a="volba:${n}" style="--b:${d.barva}" ${sp || S.stav !== 'ceka' ? 'disabled' : ''}>
      <span class="zv-ik">${d.ikona}</span><span class="zv-jm"><small class="cislo-druhu">${n}</small> ${d.nazev}</span><span class="zv-ot">${d.otazka}</span></button>`;
  }).join('');
  const k = kos ? `<button class="zvire-tl kos ${S.spatne.includes(0) ? 'spatne' : ''} ${S.stav !== 'ceka' && spravne === 0 ? 'spravne' : ''}" data-a="volba:0" ${S.spatne.includes(0) || S.stav !== 'ceka' ? 'disabled' : ''}>
      <span class="zv-ik">🧺</span><span class="zv-jm">košík</span><span class="zv-ot">Tohle zvíře v zoo ještě není</span></button>` : '';
  return `<div class="zvirata nap-${lvl}">${tl2}${k}</div>`;
}

function rUloha() {
  const u = S.u;
  let horni;
  if (souboj()) {
    const max = S.plan.length;
    horni = `<div class="souboj">
      <div class="souboj-prisera ${S.zprava?.typ === 'ok' ? 'zasazena' : ''}">${prisera(S.strazce, S.zprava?.typ === 'chyba' ? 'smich' : '')}</div>
      <div class="souboj-info"><b>${S.strazce.jmeno}</b>
        <div class="hp"><span style="width:${(100 * S.hp) / max}%"></span></div>
        <div class="zivoty">${'❤️'.repeat(Math.max(0, S.zivoty))}${'🖤'.repeat(Math.max(0, S.max - S.zivoty))} <small>úloha ${S.poradi + 1}/${max}</small></div>
        ${S.poradi === 0 && S.stav === 'ceka' ? `<p class="bublina">${S.strazce.hlaska}</p>` : ''}
      </div></div>`;
  } else {
    const t = S.tema && T(S.tema);
    const nazev = S.druh === 'oprava' ? '🩹 Slabá místa' : S.druh === 'udrzba' ? '🔁 Udržovací trénink' : `${t.ikona} ${cap(t.nazev)}`;
    const pokrok = S.druh === 'trenink' ? `<span class="zvl">⭐ ${zvladnuto(t)}/${t.polozky.length}</span>` : '';
    horni = `<div class="trenink-hlava"><span>${nazev}</span>${pokrok}
      <span class="kolo">${Array.from({ length: delkaKola() }, (_, i) => `<i class="${i < S.poradi ? 'plna' : i === S.poradi ? 'ted' : ''}"></i>`).join('')}</span>
      <span class="combo ${S.combo >= 3 ? 'hori' : ''}">🔥 ${S.combo}${nasobitel() > 1 ? ` <small>×${nasobitel()}</small>` : ''}</span></div>`;
  }
  const p = POL[S.gid].p;
  const nap = !souboj() && S.stav === 'ceka' && uroven() === 2 && (u.typ === 'druh' || u.typ === 'vlacek' || u.typ === 'najdi')
    ? tl('napoveda', '💡', 'male kulate napoveda-tl', 'title="Ukázat otázky zvířat (úloha se pak nepočítá do zvládnutí)" aria-label="Nápověda"') : '';
  let obsah = '', dole = '';
  if (u.typ === 'druh') {
    obsah = u.veta
      ? `<div class="otazka">Komu patří zvýrazněné slovo <b>v téhle větě</b>?</div><div class="veta-text">${u.veta.map((t, i) => (i === u.idx ? `<span class="zvyraznene">${esc(t.t)}</span>` : esc(t.t)) + esc(t.p)).join(' ')}</div>`
      : `<div class="otazka">Kterému zvířeti dáš tohle slovo?</div><div class="krmivo-obal"><span class="krmivo">${esc(u.slovo)}</span></div><div class="mala tazeni">Přetáhni slovo na zvíře, nebo na zvíře klepni.</div>`;
    dole = rZvirata(u.moznosti, u.kos, u.spravne);
  } else if (u.typ === 'najdi') {
    const d = DATA.D[u.cil], lvl = uroven();
    obsah = `<div class="otazka">${d.ikona} ${d.zvire} má hlad! Klepni na <b>všechna</b> slova, která patří jemu (${d.nazev}).</div>
      ${lvl < 2 ? `<div class="rada nap-${lvl}">${d.ikona} ${d.zvire} se ptá: <b>${d.otazka}</b></div>` : ''}
      ${rVlak(u.veta, { najdi: true })}`;
    dole = S.stav === 'ceka' ? `<div class="tlacitka">${tl('hotovo', `Nakrmit ${d.ikona} (${S.oznacene.length})`, 'hlavni velke')}</div>` : '';
  } else if (u.typ === 'vlacek') {
    const i = u.poradi[S.vagon];
    obsah = `<div class="otazka">Vláček veze slova ze zoo. Přiřaď ${S.stav === 'ceka' ? `slovu <b class="slovo-velke">${esc(u.veta[i].t)}</b>` : 'každému slovu'} jeho zvíře.</div>${rVlak(u.veta, { hra: true })}
      <div class="mala">Vagon ${Math.min(S.vagon + 1, u.poradi.length)} z ${u.poradi.length}. ❔ = zvíře, které zatím neznáš.</div>`;
    dole = S.stav === 'ceka' ? rZvirata(u.moznosti, false, null) : '';
  } else if (u.typ === 'volba') {
    obsah = `<div class="otazka">${u.otazka}</div>`;
    dole = `<div class="volby">${u.moznosti.map((m, i) => {
      const sp = S.spatne.includes(m.id), ok = S.stav !== 'ceka' && m.id === u.spravne;
      return `<button class="tl volba ${sp ? 'spatne' : ''} ${ok ? 'spravne' : ''}" data-a="volba:${m.id}" ${sp || S.stav !== 'ceka' ? 'disabled' : ''}><small>${i + 1}</small> ${m.html}</button>`;
    }).join('')}</div>`;
  }
  const stitekUlohy = `${S.opakovani ? '🔁 Opakování · ' : ''}${p.nazev}`;
  return `${hlavicka(tl('mapa', '✕', 'male kulate', 'aria-label="Konec"'))}
  <main class="uloha typ-${u.typ}">
    ${horni}
    <section class="karta zadani-karta">
      <div class="stitek">${stitekUlohy}</div>${nap}
      ${obsah}
      ${rZprava()}
    </section>
    ${dole}
    ${S.stav === 'vyhodnoceno' && S.zprava?.typ !== 'ok' || (S.stav === 'vyhodnoceno' && u.ukazka && !souboj()) ? `<div class="tlacitka">${tl('dalsi', 'Další ▶', 'hlavni velke')}</div>` : ''}
  </main>`;
}

function rZprava() {
  const z = S.zprava;
  if (!z) return '<div id="zprava"></div>';
  return `<div id="zprava" class="zprava ${z.typ}">${z.text}</div>`;
}

function rSouhrn() {
  const p = S.prev;
  if (S.souboj) {
    const zav = p.druh === 'zaverecna', t = !zav && T(p.tema);
    const i = t ? K.temata.indexOf(t) : -1, dalsi = t && K.temata[i + 1];
    const nadpis = S.vyhra ? (zav ? '🎓 Velká zkouška je splněná!' : `🏆 ${p.strazce.jmeno} je poražen!`) : `${p.strazce.jmeno} tentokrát vyhrál`;
    const popis = S.vyhra
      ? (zav ? 'Všech deset zvířat má správné krmení. Slovní druhy umíš! Udržovací trénink ti je občas připomene.' : `${t.vybeh} je v pořádku. +20 🍌${dalsi ? ` Otevřel se další výběh: <b>${dalsi.ikona} ${cap(dalsi.nazev)}</b>.` : ' To byl poslední výběh – čeká tě Velká zkouška!'}`)
      : 'Nevadí. Dovednosti, ve kterých jsi chyboval, se vrátily do krmení. Procvič je a zkus to znovu – Zmatkář počká.';
    return `${hlavicka()}
    <main class="souhrn"><section class="karta stred ${S.vyhra ? 'vyhra' : ''}">
      ${prisera(p.strazce, S.vyhra ? 'porazen' : '')}
      <h1>${nadpis}</h1><p>${popis}</p>
      <p class="velke-cislo">${p.spravne} správně · ${p.chyby} ${p.chyby === 1 ? 'chyba' : p.chyby >= 2 && p.chyby <= 4 ? 'chyby' : 'chyb'}</p>
      ${S.vyhra ? '<div class="konfety">' + Array.from({ length: 24 }, (_, i) => `<i style="--i:${i}"></i>`).join('') + '</div>' : ''}
      <div class="tlacitka">${S.vyhra ? tl('pokracuj', dalsiKrok().text + ' ▶', 'hlavni velke') : tl(zav ? 'oprava' : `trenink:${p.tema}`, '🍌 Procvičit', 'hlavni velke')}${tl('mapa', '🦒 Zoo')}</div>
    </section></main>`;
  }
  const t = p.tema && T(p.tema);
  const nove = p.nove.map((g) => POL[g].p.nazev), zap = p.zapomenute.map((g) => POL[g].p.nazev);
  const nadpis = S.vybehZvladnut ? '⭐ Všechny dovednosti zvládnuté!' : p.druh === 'oprava' && !slabaMista().length ? '🩹 Slabá místa jsou spravená!' : 'Kolo dokončeno';
  const hlavni = S.vybehZvladnut ? tl(`strazce:${t.id}`, `⚔️ Na Zmatkáře: ${t.strazce.jmeno}`, 'hlavni velke blika') : tl('pokracuj', dalsiKrok().text + ' ▶', 'hlavni velke');
  return `${hlavicka()}
  <main class="souhrn"><section class="karta stred">
    ${S.vybehZvladnut ? prisera(t.strazce) : ''}
    <h1>${nadpis}</h1>
    ${S.vybehZvladnut ? `<p class="bublina">${t.strazce.hlaska}</p>` : ''}
    <p class="velke-cislo">${p.spravne} napoprvé správně z ${p.poradi} · +${p.ziskano} 🍌</p>
    ${t && p.druh === 'trenink' ? `<p>${t.ikona} ${cap(t.nazev)}: zvládnuto ${zvladnuto(t)} z ${t.polozky.length} dovedností.</p>` : ''}
    ${nove.length ? `<p>⭐ Nově zvládnuto: <b>${nove.join(', ')}</b></p>` : ''}
    ${zap.length ? `<p>🩹 Zapomenuto (vrátí se do opakování): ${zap.join(', ')}</p>` : ''}
    <div class="tlacitka">${hlavni}${!S.vybehZvladnut && p.druh === 'trenink' && dalsiKrok().akce !== `trenink:${p.tema}` ? tl(`trenink:${p.tema}`, '🍌 Ještě kolo') : ''}${tl('mapa', '🦒 Zoo')}</div>
  </section></main>`;
}

// Tahák: zvířata, která už hráč zná, s otázkou, poznávačkou a příklady.
function rTahak() {
  const zna = new Set(znamDruhy()), satna = temaHotovo(T('satna')) || postup.tema('satna').lekce || postup.P.vseOdemceno;
  const karty = Object.values(DATA.D).map((d) => (zna.has(d.cislo) || postup.P.vseOdemceno
    ? `<div class="tahak-karta" style="--b:${d.barva}"><span class="obri">${d.ikona}</span><div><b>${d.cislo}. ${d.nazev}</b> <small>(${d.zvire}${satna ? `, ${d.ohebny ? 'ohebné' : 'neohebné'}` : ''})</small>
      <div class="tahak-ot">${d.otazka}</div><div class="mala">${d.poznavacka}</div></div></div>`
    : `<div class="tahak-karta zamceno"><span class="obri">❔</span><div><b>${d.cislo}. ???</b><div class="mala">Tohle zvíře v zoo ještě není.</div></div></div>`)).join('');
  return `<div class="tahak-pozadi" data-a="tahak"></div><section class="tahak karta"><div class="tahak-hlava"><h2>📖 Tahák – zvířata v zoo</h2>${tl('tahak', '✕', 'male kulate', 'aria-label="Zavřít"')}</div>
    ${satna ? '<p class="mala">👕 Ohebné (dají se převléknout): 1–5 · 🧥 Neohebné (pořád stejné): 6–10</p>' : ''}
    <div class="tahak-mrizka">${karty}</div></section>`;
}

function rNastaveni() {
  const P = postup.P, posl = [...new Set(P.chyby.slice(0, 15).map((c) => POL[c.id]?.p.nazev).filter(Boolean))];
  const celkem = vsechnyPolozky().length, zvl = vsechnyPolozky().filter(postup.zvladnuta).length;
  return `${hlavicka(tl('mapa', '◀ Zoo', 'male'))}
  <main class="nastaveni"><section class="karta">
    <h1>⚙️ Nastavení a přehled</h1>
    <p>Zvládnuto ${zvl} z ${celkem} dovedností · poražených Zmatkářů ${K.temata.filter(temaHotovo).length} z ${K.temata.length} · vyřešených úloh ${P.odpovedi} · nejdelší série ${P.nejdelsiSerie} 🔥</p>
    <p>${K.zaverecna.nazev}: ${P.zaverecna.splnena ? 'splněná ✅' : P.zaverecna.pokusy ? `zatím nesplněná (pokusů ${P.zaverecna.pokusy}, nejlépe ${P.zaverecna.nejlepsi ?? 0} správně)` : 'ještě nebyla'}.</p>
    ${posl.length ? `<p>Poslední chyby: ${posl.join(', ')}.</p>` : ''}
    <div class="tlacitka">
      ${tl('zvuk', `Zvuk: ${P.nast.zvuk ? 'zapnutý 🔊' : 'vypnutý 🔇'}`)}
      ${tl('odemknout', P.vseOdemceno ? '🔓 Všechny výběhy odemčené' : '🔒 Odemknout všechny výběhy')}
      ${tl('smazat', '🗑 Smazat postup', 'nebezpecne')}
    </div>
    <p class="mala">Odemčení se hodí, když už něco umíš a chceš rovnou na pozdější výběh (nebo pro rodiče a učitele). Postup se ukládá jen v tomhle prohlížeči.</p>
    <p class="mala">Klávesnice na počítači: číslice = zvíře podle čísla slovního druhu (0 = 10), <b>K</b> = košík, <b>1–4</b> vybere možnost, <b>Enter</b> = další.</p>
  </section></main>`;
}
function rSmazat() {
  return `${hlavicka()}<main class="nastaveni"><section class="karta stred"><h1>Opravdu smazat celý postup?</h1><p>Zoo začne znovu od prvního výběhu. Nejde to vrátit.</p>
    <div class="tlacitka">${tl('smazat-ano', 'Ano, smazat', 'nebezpecne')}${tl('nastaveni', 'Ne, zpět', 'hlavni')}</div></section></main>`;
}
