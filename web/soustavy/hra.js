// Dvojvrch (soustavy rovnic): obrazovky (mapa táborů, tábor, lekce, úloha, souhrn, nastavení) a průběh kurzu.
// Kurz: v každém táboře lekce → trénink po kolech, dokud nejsou zvládnuté všechny položky → souboj se strážcem
// (jen výsledky, nejvýš 1 chyba) → další tábor. Nakonec Vrchol (závěrečná zkouška ze všeho).
// Stejná stavba jako Zlomková výprava (web/zlomky), jen odpovědi jsou čísla do políček (x =, y =, …) nebo volby.
import { generuj } from './generatory.js';
import { zkontroluj, spravneHTML, odpovedHTML as odpovedPoli, text, vyber, zamichej } from './cisla.js';
import { kresba } from './kresby.js';
import { prisera } from './prisery.js';
import { zvuk, nastavZtlumeni, odemkni } from './zvuk.js';
import * as postup from './postup.js';

const POCHVALY = ['Správně!', 'Výborně!', 'Přesně tak!', 'Paráda!', 'Ano!', 'Super!', 'Skvělé!'];
let K = null;                 // kurz z JSONu
const POL = {};               // id položky „tema:polozka“ → { tema, p }
let S = { obr: 'nacitani' };
let casovac = null;
let vrMozne = false, veVR = false;
const posluchaci = [];
// VR (vr.js) poslouchá každé překreslení: překreslí panel a pozná zásah, chybu, konec souboje.
export function poslouchej(fn) { posluchaci.push(fn); }
export const stav = () => S;
export function nastavVR(v) { veVR = v; render(); }
const oznam = () => posluchaci.forEach((f) => f(S));
const app = () => document.getElementById('app');
const zrus = () => { clearTimeout(casovac); casovac = null; };

// ---------- načtení ----------
export async function start() {
  const j = (u) => fetch(u, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(u); return r.json(); });
  try {
    const kurz = await j('data/kurz.json');
    const temata = await Promise.all(kurz.temata.map((id) => j(`data/${id}.json`)));
    const data = { sablony: {}, pevne: {} };
    for (const t of temata) {
      Object.assign(data.sablony, t.sablony || {});
      for (const [k, v] of Object.entries(t.pevne || {})) data.pevne[k] = [...(data.pevne[k] || []), ...v];
      t.polozky.forEach((p) => { p.gid = `${t.id}:${p.id}`; p.serie = p.serie || 3; POL[p.gid] = { tema: t, p }; });
    }
    K = { ...kurz, temata, data };
  } catch (e) {
    app().innerHTML = `<div class="karta chyba-nacteni">Nepodařilo se načíst úlohy (${e.message}). Zkus stránku obnovit.</div>`;
    return;
  }
  nastavZtlumeni(!postup.P.nast.zvuk);
  document.addEventListener('click', klik);
  document.addEventListener('keydown', klavesa);
  const q = new URLSearchParams(location.search);
  if (navigator.xr?.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then((ok) => { vrMozne = ok; if (ok) render(); }).catch(() => {});
  if (q.has('vrnahled')) import('./vr.js').then((m) => m.nahledVR());
  if (q.get('lekce')) otevriLekci(q.get('lekce')); else jdi({ obr: 'mapa' });
  window.__soustavy = { K, S: () => S, postup, akce, render, generuj: (gid) => generuj(POL[gid].p.gen, POL[gid].p.param, K.data, []) };
}

// ---------- stav kurzu ----------
const vsechnyPolozky = () => K.temata.flatMap((t) => t.polozky.map((p) => p.gid));
const temaHotovo = (t) => postup.tema(t.id).strazce;
const odemcene = (i) => i === 0 || temaHotovo(K.temata[i - 1]) || postup.P.vseOdemceno;
const zvladnuto = (t) => t.polozky.filter((p) => postup.zvladnuta(p.gid)).length;
const slabaMista = () => K.temata.filter(temaHotovo).flatMap((t) => t.polozky.map((p) => p.gid)).filter((g) => !postup.zvladnuta(g));
const aktualni = () => K.temata.find((t) => !temaHotovo(t)) || null;
const kurzHotov = () => !aktualni() && postup.P.zaverecna.splnena && !slabaMista().length;
function hodnost() {
  let h = K.hodnosti[0];
  for (const x of K.hodnosti) if (postup.P.krystaly >= x.od) h = x;
  const dalsi = K.hodnosti.find((x) => x.od > postup.P.krystaly);
  return { ...h, dalsi };
}
function dalsiKrok() {
  const t = aktualni();
  if (t) {
    if (slabaMista().length >= 3) return { akce: 'oprava', text: `🩹 Nejdřív slabá místa (${slabaMista().length})` };
    if (!postup.tema(t.id).lekce) return { akce: `lekce:${t.id}`, text: `📖 Lekce: ${t.nazev}` };
    if (zvladnuto(t) < t.polozky.length) return { akce: `trenink:${t.id}`, text: `🏋️ Trénink: ${t.nazev}` };
    return { akce: `strazce:${t.id}`, text: `⚔️ Souboj se strážcem: ${t.strazce.jmeno}` };
  }
  if (slabaMista().length) return { akce: 'oprava', text: `🩹 Slabá místa (${slabaMista().length})` };
  if (!postup.P.zaverecna.splnena) return { akce: 'zaverecna', text: `🏛️ ${K.zaverecna.nazev}` };
  return { akce: 'udrzba', text: '🔁 Udržovací trénink' };
}

// ---------- akce ----------
function klik(e) {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  odemkni();
  akce(el.dataset.a, el);
}
export function akce(a, el) {
  const [co, arg] = a.split(/:(.*)/s);
  switch (co) {
    case 'mapa': zrus(); jdi({ obr: 'mapa' }); break;
    case 'pokracuj': akce(dalsiKrok().akce); break;
    case 'ostrov': jdi({ obr: 'ostrov', tema: arg }); break;
    case 'lekce': otevriLekci(arg); break;
    case 'snimek': posunSnimek(+arg); break;
    case 'trenink': zacni({ druh: 'trenink', tema: arg }); break;
    case 'strazce': zacni({ druh: 'strazce', tema: arg }); break;
    case 'zaverecna': zacni({ druh: 'zaverecna' }); break;
    case 'oprava': zacni({ druh: 'oprava' }); break;
    case 'udrzba': zacni({ druh: 'udrzba' }); break;
    case 'k': stiskni(arg); break;
    case 'pole': if (S.v) { S.v.f = +arg; prekresliVstup(); } break;
    case 'ok': odesli(); break;
    case 'napoveda': ukazNapovedu(); break;
    case 'volba': odesli({ id: arg }); break;
    case 'dalsi': dalsiUloha(); break;
    case 'nastaveni': jdi({ obr: 'nastaveni' }); break;
    case 'vr': import('./vr.js').then((m) => m.spustVR()).catch((e) => console.error(e)); break;
    case 'vr-konec': import('./vr.js').then((m) => m.ukonciVR()); break;
    case 'zvuk': postup.P.nast.zvuk = !postup.P.nast.zvuk; nastavZtlumeni(!postup.P.nast.zvuk); postup.uloz(); render(); break;
    case 'odemknout': postup.P.vseOdemceno = !postup.P.vseOdemceno; postup.uloz(); render(); break;
    case 'smazat': jdi({ obr: 'smazat' }); break;
    case 'smazat-ano': postup.smaz(); jdi({ obr: 'mapa' }); break;
    default: break;
  }
}
function jdi(s) { zrus(); S = s; render(); window.scrollTo?.(0, 0); }

// ---------- lekce ----------
function otevriLekci(id) {
  const t = K.temata.find((x) => x.id === id);
  if (!t) return jdi({ obr: 'mapa' });
  jdi({ obr: 'lekce', tema: id, snimek: 0 });
}
function posunSnimek(d) {
  const t = K.temata.find((x) => x.id === S.tema), n = S.snimek + d;
  if (n >= t.lekce.length) { postup.tema(t.id).lekce = true; postup.uloz(); zvuk.hvezda(); return zacni({ druh: 'trenink', tema: t.id }); }
  S.snimek = Math.max(0, n); render();
}

// ---------- trénink, strážce, závěrečná zkouška ----------
function zacni(nast) {
  zrus();
  S = { obr: 'uloha', ...nast, poradi: 0, znovu: [], posledni: [], poslPevne: [], spravne: 0, chyby: 0, nove: [], zapomenute: [], combo: 0, ziskano: 0 };
  if (nast.druh === 'strazce') {
    const t = K.temata.find((x) => x.id === nast.tema);
    S.plan = zamichej([...t.polozky.map((p) => p.gid), ...Array.from({ length: Math.max(0, K.strazce.otazek - t.polozky.length) }, () => vyber(t.polozky).gid)]);
    S.zivoty = K.strazce.zivotu; S.strazce = t.strazce; S.hp = S.plan.length;
    postup.tema(t.id).pokusy++; postup.uloz();
  }
  if (nast.druh === 'zaverecna') {
    const z = K.zaverecna;
    const povinne = K.temata.map((t) => vyber(t.polozky.filter((p) => p.gen !== 'pevne')).gid);
    const pevne = Array(z.pevnychUloh).fill(z.pevnaPolozka);
    const ostatni = Array.from({ length: Math.max(0, z.otazek - povinne.length - pevne.length) }, () => vyber(vsechnyPolozky().filter((g) => POL[g].p.gen !== 'pevne')));
    S.plan = zamichej([...povinne, ...pevne, ...ostatni]);
    S.zivoty = z.zivotu; S.strazce = z.strazce; S.hp = S.plan.length;
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
    const vse = vsechnyPolozky().sort((a, b) => postup.polozka(a).t - postup.polozka(b).t);
    const chybove = vse.filter((x) => postup.polozka(x).ch > 0);
    return vyber(neopakuj(Math.random() < 0.3 && chybove.length ? chybove : vse.slice(0, 12)));
  }
  const t = K.temata.find((x) => x.id === S.tema);
  const ids = t.polozky.map((p) => p.gid), nezvl = ids.filter((g) => !postup.zvladnuta(g));
  if (!nezvl.length) return vyber(neopakuj(ids)); // tábor už zvládnutý: volné procvičování
  const r = Math.random(), sl = slabaMista().filter((g) => POL[g].tema !== t);
  if (sl.length && r < 0.25) return vyber(neopakuj(sl));
  const starsi = K.temata.filter((x) => x !== t && temaHotovo(x)).flatMap((x) => x.polozky.map((p) => p.gid)).filter(postup.zvladnuta);
  if (starsi.length && r > 1 - K.trenink.podilOpakovani) return starsi.sort((a, b) => postup.polozka(a).t - postup.polozka(b).t)[0];
  return nejslabsi(neopakuj(nezvl));
}

function dalsiUloha(prvni) {
  zrus();
  if (!prvni) S.poradi++;
  if (souboj() && (S.zivoty <= 0 || S.poradi >= S.plan.length)) return konecSouboje();
  if (S.druh === 'trenink') {
    const t = K.temata.find((x) => x.id === S.tema);
    if (!S.volne && zvladnuto(t) === t.polozky.length && !postup.tema(t.id).strazce && !S.znovu.length) return souhrn({ ostrovZvladnut: true });
  }
  if (S.druh === 'oprava' && !slabaMista().length) return souhrn({});
  if (!souboj() && S.poradi >= delkaKola()) return souhrn({});
  const gid = vyberPolozku();
  if (!gid) return souhrn({});
  const { p } = POL[gid];
  S.posledni = [gid, ...S.posledni].slice(0, 2);
  const u = generuj(p.gen, p.param, K.data, S.poslPevne);
  if (p.gen === 'pevne') S.poslPevne = [u.zadani, ...S.poslPevne].slice(0, 12);
  S.gid = gid; S.u = u;
  S.rezim = souboj() || postup.polozka(gid).s > 0 ? 'vysledek' : 'kroky';
  S.krok = 0; S.pokus = 0; S.chybaVUloze = false; S.napoveda = false; S.hotove = []; S.zprava = null; S.stav = 'ceka';
  S.opakovani = S.druh === 'trenink' && POL[gid].tema.id !== S.tema;
  noveV();
  render();
}
const aktKrok = () => (S.rezim === 'vysledek' ? S.u.vysledek : S.u.kroky[S.krok]);
function noveV() {
  const k = aktKrok();
  S.v = { pole: (k?.pole || []).map(() => ''), f: 0 };
}

// ---------- zadávání ----------
// Políčko je text: číslice, minus na začátku, desetinná čárka nebo lomítko (zlomek 3/4).
function stiskni(x) {
  if (S.obr !== 'uloha' || S.stav !== 'ceka' || !S.v) return;
  const k = aktKrok(), v = S.v;
  if (k.typ !== 'cisla') return;
  zvuk.klik();
  if (x === 'ok') return odesli();
  const n = v.pole.length;
  let t = v.pole[v.f] ?? '';
  if (x === '⌫') { if (t) t = t.slice(0, -1); else if (v.f > 0) { v.f--; prekresliVstup(); return; } }
  else if (x === '−') t = t.startsWith('−') ? t.slice(1) : '−' + t;
  else if (x === ',') { if (!/[,/]/.test(t)) t = (/\d$/.test(t) ? t : t + '0') + ','; }
  else if (x === '/') { if (!/[,/]/.test(t) && /\d$/.test(t)) t += '/'; }
  else if (x === 'dalsi') { v.f = (v.f + 1) % n; prekresliVstup(); return; }
  else if (x === 'zpet') { v.f = (v.f + n - 1) % n; prekresliVstup(); return; }
  else if (/^\d$/.test(x) && t.replace('−', '').length < 7) t += x;
  v.pole[v.f] = t;
  S.zprava = S.zprava?.typ === 'skoro' ? null : S.zprava;
  prekresliVstup();
}
function ukazNapovedu() {
  if (S.stav !== 'ceka' || S.napoveda) return;
  S.napoveda = true; S.chybaVUloze = true;
  render();
}

// ---------- vyhodnocení ----------
function odesli(volba) {
  if (S.obr !== 'uloha' || S.stav !== 'ceka') return;
  const k = aktKrok(), v = S.v;
  let odp;
  if (k.typ === 'volba') { if (!volba) return; odp = volba; }
  else {
    // Prázdné políčko: OK skočí do dalšího prázdného (pohodlné psaní x, pak y), chyba to není.
    const prazdne = v.pole.findIndex((t) => !t || t === '−');
    if (prazdne >= 0 && v.pole[v.f] && prazdne !== v.f) { v.f = prazdne; zvuk.klik(); return prekresliVstup(); }
    odp = { pole: v.pole };
  }
  const r = zkontroluj(k, odp);
  if (r.prazdne) { S.zprava = { typ: 'skoro', text: r.skoro || 'Nejdřív něco napiš.' }; return render(); }
  if (r.skoro) { S.zprava = { typ: 'skoro', text: r.skoro }; zvuk.skoro(); return render(); }
  const html = odpovedHTML(k, odp);
  if (r.ok) {
    S.hotove.push({ krok: k, html, ok: true });
    return dalsiKrokUlohy(1, true);
  }
  // chyba
  zvuk.spatne();
  if (souboj()) {
    S.hotove.push({ krok: k, html, ok: false });
    S.zivoty--; S.chyby++; S.combo = 0;
    postup.zapis(S.gid, false, POL[S.gid].p.serie);
    S.stav = 'vyhodnoceno';
    S.zprava = { typ: 'chyba', text: `Správně je ${spravneHTML(k)}.`, vysvetleni: S.u.vysvetleni };
    return render();
  }
  S.chybaVUloze = true; S.combo = 0;
  if (S.rezim === 'vysledek') {
    // Výsledek nesedí: projdeme úlohu po krocích, ať je vidět, kde je chyba.
    S.rezim = 'kroky'; S.krok = 0; S.pokus = 0; S.hotove = [];
    S.zprava = { typ: 'info', text: `${html} není správně. Nevadí – projdeme to po krocích a najdeme, kde se to pokazilo.` };
    noveV();
    return render();
  }
  S.pokus++;
  if (S.pokus === 1) {
    S.zprava = { typ: 'chyba1', text: 'Tenhle krok nesedí. Zkus to ještě jednou.' + (k.napoveda ? ` <span class="rada">💡 ${k.napoveda}</span>` : '') };
    noveV(); return render();
  }
  S.hotove.push({ krok: k, html: spravneHTML(k), ok: false, bylo: html });
  dalsiKrokUlohy(1, false);
}
function odpovedHTML(k, o) {
  if (k.typ === 'volba') return k.moznosti.find((m) => m.id === o.id)?.html ?? '';
  return odpovedPoli(k, o.pole);
}
function dalsiKrokUlohy(o, ok) {
  S.pokus = 0; S.napoveda = S.napoveda && S.rezim === 'kroky' ? S.napoveda : false;
  const posledni = S.rezim === 'vysledek' || S.krok + o >= S.u.kroky.length;
  if (!posledni) {
    S.krok += o; S.zprava = ok ? { typ: 'ok-krok', text: '✓' } : { typ: 'chyba', text: `Správně bylo ${spravneHTML(S.hotove[S.hotove.length - 1].krok)}. Pokračuj dalším krokem.` };
    if (ok) zvuk.krok();
    S.napoveda = false;
    noveV(); return render();
  }
  // úloha dokončena
  S.stav = 'vyhodnoceno';
  const spravne = !S.chybaVUloze && ok;
  const p = POL[S.gid].p;
  if (souboj()) {
    S.spravne++; S.hp--; S.combo++;
    pridejKrystaly(1);
    postup.zapis(S.gid, true, p.serie);
    zvuk.zasah();
    S.zprava = { typ: 'ok', text: `${vyber(POCHVALY)} Zásah! 💥` };
    render();
    casovac = setTimeout(dalsiUloha, 1300);
    return;
  }
  const r = postup.zapis(S.gid, spravne, p.serie);
  if (r.zvladnuta) S.nove.push(S.gid);
  if (r.zapomenuta) S.zapomenute.push(S.gid);
  if (spravne) {
    S.spravne++; S.combo++;
    postup.P.nejdelsiSerie = Math.max(postup.P.nejdelsiSerie, S.combo);
    const zisk = pridejKrystaly(nasobitel());
    S.zprava = { typ: 'ok', text: `${vyber(POCHVALY)} +${zisk} 💎${r.zvladnuta ? ` <b>⭐ „${p.nazev}“ zvládnuto!</b>` : ''}` };
    r.zvladnuta ? zvuk.hvezda() : zvuk.dobre();
    render();
    casovac = setTimeout(dalsiUloha, r.zvladnuta ? 1900 : 1300);
  } else {
    S.chyby++; S.combo = 0;
    S.znovu.push({ id: S.gid, kdy: S.poradi + 3 });
    S.zprava = { typ: ok ? 'dokonceno' : 'chyba', text: ok ? 'Došel jsi do konce. Úloha se ti brzy vrátí, ať ji dáš napoprvé.' : 'Tohle se nepovedlo, úloha se ti brzy vrátí.', vysvetleni: S.u.vysvetleni };
    render();
  }
}
const nasobitel = () => (S.combo >= 10 ? 4 : S.combo >= 6 ? 3 : S.combo >= 3 ? 2 : 1);
function pridejKrystaly(n) { postup.P.krystaly += n; S.ziskano += n; postup.uloz(); return n; }

function konecSouboje() {
  const vyhra = S.zivoty > 0;
  if (S.druh === 'strazce') {
    if (vyhra) { postup.tema(S.tema).strazce = true; pridejKrystaly(20); }
  } else {
    const z = postup.P.zaverecna;
    if (vyhra) { z.splnena = true; pridejKrystaly(50); }
    z.nejlepsi = Math.max(z.nejlepsi ?? 0, S.spravne);
  }
  postup.uloz();
  vyhra ? zvuk.vyhra() : zvuk.prohra();
  souhrn({ souboj: true, vyhra });
}
function souhrn(x) {
  zrus();
  const prev = S;
  S = { obr: 'souhrn', prev, ...x };
  if (x.ostrovZvladnut) zvuk.vyhra();
  render();
}

// ---------- klávesnice počítače ----------
function klavesa(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (S.obr === 'lekce') {
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); posunSnimek(1); }
    if (e.key === 'ArrowLeft') posunSnimek(-1);
    return;
  }
  if (S.obr === 'souhrn' && e.key === 'Enter') { e.preventDefault(); document.querySelector('.tl.hlavni')?.click(); return; }
  if (S.obr !== 'uloha') return;
  if (S.stav === 'vyhodnoceno') { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dalsiUloha(); } return; }
  const k = aktKrok(); if (!k) return;
  if (k.typ === 'volba') { const i = +e.key - 1; if (k.moznosti[i]) { e.preventDefault(); odesli({ id: k.moznosti[i].id }); } return; }
  const m = { Backspace: '⌫', Enter: 'ok', ',': ',', '.': ',', '/': '/', '-': '−', '−': '−', Tab: 'dalsi', ArrowRight: 'dalsi', ArrowDown: 'dalsi', ArrowLeft: 'zpet', ArrowUp: 'zpet', ' ': 'dalsi' }[e.key] || (/^\d$/.test(e.key) ? e.key : null);
  if (m) { e.preventDefault(); stiskni(m); }
}

// ================= vykreslení =================
function render() {
  const el = app(); if (!el || !K) return;
  const o = S.obr;
  el.className = 'obr-' + o;
  el.innerHTML = o === 'mapa' ? rMapa() : o === 'ostrov' ? rOstrov() : o === 'lekce' ? rLekce() : o === 'uloha' ? rUloha()
    : o === 'souhrn' ? rSouhrn() : o === 'nastaveni' ? rNastaveni() : o === 'smazat' ? rSmazat() : '';
  if (o === 'uloha') {
    const karta = document.querySelector('.zadani-karta');
    if (karta && !S.hotove.length && (!S.zprava || S.zprava.typ === 'ok-krok')) karta.scrollTop = 0;
    else (document.querySelector('.zprava:not(.ok-krok)') || document.querySelector('.krok-aktualni'))?.scrollIntoView?.({ block: 'nearest' });
  }
  if (o === 'mapa' && veVR) document.querySelector('.ostrov.aktualni')?.scrollIntoView?.({ block: 'nearest' });
  oznam();
}
function prekresliVstup() {
  const el = document.getElementById('vstup');
  if (!el) return render();
  el.innerHTML = rVstup(aktKrok());
  const z = document.getElementById('zprava'), nova = rZprava();
  if (z && z.outerHTML !== nova) z.outerHTML = nova;
  oznam();
}
const tl = (a, t, styl = '', x = '') => `<button class="tl ${styl}" data-a="${a}" ${x}>${t}</button>`;

function hlavicka(levy) {
  const h = hodnost();
  return `<header class="hlava">${levy || `<div class="logo">⛰️ ${K.nazev}</div>`}
    <div class="hlava-vpravo"><span class="krystaly" title="Krystaly">💎 ${postup.P.krystaly}</span><span class="hodnost">${h.nazev}</span>${veVR ? tl('vr-konec', 'Opustit VR', 'male') : vrMozne ? tl('vr', '🥽 Do VR', 'male hlavni') : ''}${tl('nastaveni', '⚙️', 'male kulate', 'aria-label="Nastavení"')}</div></header>`;
}

function rMapa() {
  const d = dalsiKrok(), h = hodnost();
  const ostrovy = K.temata.map((t, i) => {
    const st = postup.tema(t.id), od = odemcene(i), z = zvladnuto(t), n = t.polozky.length;
    const hvezdy = (st.lekce ? 1 : 0) + (z === n ? 1 : 0) + (st.strazce ? 1 : 0);
    return `<button class="ostrov ${od ? '' : 'zamceno'} ${st.strazce ? 'hotovo' : ''} ${aktualni() === t ? 'aktualni' : ''}" data-a="ostrov:${t.id}" ${od ? '' : 'disabled'} style="--b:${t.strazce.barva}">
      <span class="ostrov-ikona">${od ? t.ikona : '🔒'}</span>
      <span class="ostrov-text"><b>${i + 1}. ${t.nazev}</b><small>${t.misto}</small>
      <span class="hvezdy">${'★'.repeat(hvezdy)}<span class="prazdne">${'★'.repeat(3 - hvezdy)}</span></span>
      <span class="mini-pokrok"><span style="width:${(100 * z) / n}%"></span></span></span>
      ${st.strazce ? '<span class="porazen">🏆</span>' : ''}
    </button>`;
  }).join('');
  const zav = K.zaverecna, zOd = !aktualni() || postup.P.vseOdemceno;
  const slaba = slabaMista().length;
  return `${hlavicka()}
  <main class="mapa">
    <section class="karta uvod">
      <h1>${K.nazev}</h1>
      <p>${K.podtitul}. V každém táboře je lekce, trénink a strážce. Strážce pustí výš jen toho, kdo téma opravdu umí.</p>
      ${tl('pokracuj', d.text + ' ▶', 'hlavni velke blika')}
      <div class="statistika">${h.dalsi ? `Do hodnosti <b>${h.dalsi.nazev}</b> chybí ${h.dalsi.od - postup.P.krystaly} 💎` : 'Nejvyšší hodnost! 🎖️'}${slaba ? ` · 🩹 slabých míst: ${slaba}` : ''}</div>
    </section>
    <div class="cesta">${ostrovy}
      <button class="ostrov brana ${zOd ? '' : 'zamceno'} ${postup.P.zaverecna.splnena ? 'hotovo' : ''}" data-a="zaverecna" ${zOd ? '' : 'disabled'} style="--b:${zav.strazce.barva}">
        <span class="ostrov-ikona">${zOd ? '🏔️' : '🔒'}</span>
        <span class="ostrov-text"><b>${zav.nazev}</b><small>${postup.P.zaverecna.splnena ? 'Splněno! 🎉' : zOd ? 'Závěrečná zkouška ze všeho' : 'Otevře se po všech táborech'}</small></span>
        ${postup.P.zaverecna.splnena ? '<span class="porazen">🏆</span>' : ''}
      </button>
    </div>
    ${kurzHotov() ? `<section class="karta hotovo-kurz">🎓 <b>Soustavy rovnic máš zvládnuté celé!</b> Udržovací trénink ti je občas připomene, ať je do přijímaček nezapomeneš. ${tl('udrzba', '🔁 Udržovací trénink', 'hlavni')}</section>` : ''}
  </main>`;
}

function rOstrov() {
  const t = K.temata.find((x) => x.id === S.tema), st = postup.tema(t.id), z = zvladnuto(t), n = t.polozky.length;
  const polozky = t.polozky.map((p) => {
    const pp = postup.polozka(p.gid);
    return `<li class="${pp.z ? 'zvladnuto' : ''}"><span>${pp.z ? '⭐' : '○'} ${p.nazev}</span><span class="serie">${Array.from({ length: p.serie }, (_, i) => `<i class="${i < Math.min(pp.s, p.serie) ? 'plna' : ''}"></i>`).join('')}</span></li>`;
  }).join('');
  return `${hlavicka(tl('mapa', '◀ Mapa', 'male'))}
  <main class="ostrov-detail">
    <section class="karta">
      <div class="ostrov-hlava"><span class="velka-ikona">${t.ikona}</span><div><h1>${t.nazev}</h1><p>${t.misto}</p></div></div>
      <div class="tlacitka">
        ${tl(`lekce:${t.id}`, `📖 Lekce${st.lekce ? ' ✓' : ''}`, st.lekce ? '' : 'hlavni')}
        ${tl(`trenink:${t.id}`, `🏋️ Trénink (${z}/${n})`, st.lekce && z < n ? 'hlavni' : '')}
        ${tl(`strazce:${t.id}`, st.strazce ? '⚔️ Souboj znovu' : '⚔️ Souboj se strážcem', !st.strazce && z === n ? 'hlavni' : '', z === n || st.strazce ? '' : 'disabled title="Nejdřív zvládni všechny dovednosti"')}
      </div>
      <h2>Dovednosti</h2>
      <ul class="dovednosti">${polozky}</ul>
      <p class="mala">Dovednost je zvládnutá, když ji několikrát za sebou (kolik je teček) vyřešíš napoprvé bez chyby. Napoprvé se počítá po krocích, potom už jen výsledek.</p>
    </section>
    <section class="karta strazce-karta">
      ${prisera(t.strazce, st.strazce ? 'porazen' : '')}
      <div><h2>${t.strazce.jmeno}</h2><p class="bublina">${st.strazce ? 'Dobře, dobře… vyhrál jsi. Můžeš dál.' : t.strazce.hlaska}</p>
      <p class="mala">Souboj: ${K.strazce.otazek} úloh, jen výsledky, ${K.strazce.zivotu === 2 ? 'smíš udělat 1 chybu' : `máš ${K.strazce.zivotu} životy`}.</p></div>
    </section>
  </main>`;
}

function rLekce() {
  const t = K.temata.find((x) => x.id === S.tema), sn = t.lekce[S.snimek], posl = S.snimek === t.lekce.length - 1;
  return `${hlavicka(tl('mapa', '◀ Mapa', 'male'))}
  <main class="lekce">
    <div class="pokrok-lekce">${t.lekce.map((_, i) => `<i class="${i <= S.snimek ? 'plna' : ''}"></i>`).join('')}</div>
    <section class="karta snimek">
      <div class="stitek">${t.ikona} ${t.nazev} · lekce ${S.snimek + 1}/${t.lekce.length}</div>
      <h1>${text(sn.nadpis)}</h1>
      ${sn.text.map((p) => `<p>${text(p)}</p>`).join('')}
      ${sn.kresba ? `<div class="kresba-obal">${kresba(sn.kresba)}</div>` : ''}
    </section>
    <div class="tlacitka">
      ${S.snimek > 0 ? tl('snimek:-1', '◀ Zpět') : ''}
      ${tl('snimek:1', posl ? 'Jdeme trénovat 🏋️' : 'Další ▶', 'hlavni velke')}
    </div>
  </main>`;
}

function rUloha() {
  const u = S.u, k = aktKrok();
  let horni;
  if (souboj()) {
    const max = S.plan.length;
    horni = `<div class="souboj">
      <div class="souboj-prisera ${S.zprava?.typ === 'ok' ? 'zasazena' : ''}">${prisera(S.strazce, S.zprava?.typ === 'chyba' ? 'smich' : '')}</div>
      <div class="souboj-info"><b>${S.strazce.jmeno}</b>
        <div class="hp"><span style="width:${(100 * S.hp) / max}%"></span></div>
        <div class="zivoty">${'❤️'.repeat(Math.max(0, S.zivoty))}${'🖤'.repeat(Math.max(0, (S.druh === 'strazce' ? K.strazce.zivotu : K.zaverecna.zivotu) - S.zivoty))} <small>úloha ${S.poradi + 1}/${max}</small></div>
        ${S.poradi === 0 && S.stav === 'ceka' && !S.hotove.length ? `<p class="bublina">${S.strazce.hlaska}</p>` : ''}
      </div></div>`;
  } else {
    const t = K.temata.find((x) => x.id === S.tema);
    const nazev = S.druh === 'oprava' ? '🩹 Slabá místa' : S.druh === 'udrzba' ? '🔁 Udržovací trénink' : `${t.ikona} ${t.nazev}`;
    const pokrok = S.druh === 'trenink' ? `<span class="zvl">⭐ ${zvladnuto(t)}/${t.polozky.length}</span>` : '';
    horni = `<div class="trenink-hlava"><span>${nazev}</span>${pokrok}
      <span class="kolo">${Array.from({ length: delkaKola() }, (_, i) => `<i class="${i < S.poradi ? 'plna' : i === S.poradi ? 'ted' : ''}"></i>`).join('')}</span>
      <span class="combo ${S.combo >= 3 ? 'hori' : ''}">🔥 ${S.combo}${nasobitel() > 1 ? ` <small>×${nasobitel()}</small>` : ''}</span></div>`;
  }
  const p = POL[S.gid].p;
  const stitek = `${S.opakovani ? '🔁 Opakování · ' : ''}${p.nazev}${!souboj() ? ` · ${S.rezim === 'kroky' ? 'po krocích' : 'jen výsledek'}` : ''}`;
  const hotove = S.rezim === 'kroky' || S.hotove.length ? S.hotove.map((h) => `<div class="krok-hotovy ${h.ok ? 'ok' : 'spatne'}"><span class="krok-ot">${h.krok.otazka}</span> <span class="krok-odp">${h.ok ? '✓' : '✗'} ${h.bylo ? `<s>${h.bylo}</s> → ` : ''}${h.html}</span></div>`).join('') : '';
  const kreslit = !!u.kresba;
  return `${hlavicka(tl('mapa', '✕', 'male kulate', 'aria-label="Konec"'))}
  <main class="uloha ${S.stav === 'ceka' && k.typ === 'cisla' ? 's-klavesnici' : ''}">
    ${horni}
    <section class="karta zadani-karta">
      <div class="stitek">${stitek}</div>
      <div class="zadani">${u.zadani}</div>
      ${kreslit ? `<div class="kresba-obal">${kresba(u.kresba)}</div>` : ''}
      ${S.rezim === 'kroky' && u.kroky.length > 1 ? `<div class="kroky-pocet">Krok ${Math.min(S.krok + 1, u.kroky.length)} z ${u.kroky.length}</div>` : ''}
      <div class="kroky">${hotove}</div>
      ${S.stav === 'ceka' ? `<div class="krok-aktualni">${rNapovedaTl(k)}<div class="krok-ot">${k.otazka}</div><div id="vstup">${rVstup(k)}</div></div>` : ''}
      ${S.napoveda && S.stav === 'ceka' && k.napoveda ? `<div class="rada">💡 ${k.napoveda}</div>` : ''}
      ${rZprava()}
    </section>
    ${S.stav === 'ceka' ? rKlavesnice(k) : `<div class="tlacitka">${S.zprava?.typ === 'ok' ? '' : tl('dalsi', 'Další ▶', 'hlavni velke')}</div>`}
  </main>`;
}

function rZprava() {
  const z = S.zprava;
  if (!z) return '<div id="zprava"></div>';
  return `<div id="zprava" class="zprava ${z.typ}">${z.text}${z.vysvetleni ? `<div class="vysvetleni"><b>Řešení:</b> ${z.vysvetleni}</div>` : ''}</div>`;
}

function rVstup(k) {
  const v = S.v;
  if (k.typ === 'cisla') {
    const pole = (i) => `<button class="pole ${v.f === i ? 'fokus' : ''} ${v.pole[i] ? '' : 'prazdne'}" data-a="pole:${i}">${v.pole[i] || ''}</button>`;
    return `<div class="vstup-cisla">${k.pole.map((p, i) => `<span class="pole-skup">${p.pred ? `<span class="popisek">${p.pred}</span>` : ''}${pole(i)}${p.za ? `<span class="popisek">${p.za}</span>` : ''}</span>`).join('')}
      ${tl('ok', 'OK ✓', 'hlavni ok-tl')}</div>`;
  }
  if (k.typ === 'volba') return `<div class="volby">${k.moznosti.map((m, i) => `<button class="tl volba" data-a="volba:${m.id}"><small>${i + 1}</small> ${m.html}</button>`).join('')}</div>`;
  return '';
}

const rNapovedaTl = (k) => (!souboj() && S.rezim === 'kroky' && k.napoveda && !S.napoveda && S.pokus === 0
  ? tl('napoveda', '💡', 'male kulate napoveda-tl', 'title="Nápověda (úloha se pak nepočítá do zvládnutí)" aria-label="Nápověda"') : '');
function rKlavesnice(k) {
  if (k.typ !== 'cisla') return '';
  const kl = (x, t = x, styl = '') => `<button class="kl ${styl}" data-a="k:${x}">${t}</button>`;
  const vic = k.pole.length > 1;
  return `<div class="klavesnice-obal"><div class="klavesnice">
    ${kl('7')}${kl('8')}${kl('9')}${kl('⌫', '⌫', 'fn')}
    ${kl('4')}${kl('5')}${kl('6')}${kl('−', '−', 'fn znamenko')}
    ${kl('1')}${kl('2')}${kl('3')}${kl('/', '/', 'fn znamenko')}
    ${kl('0')}${kl(',', ',', 'fn')}${vic ? kl('dalsi', 'další ▸', 'fn') : kl('', '', 'fn prazdna')}${kl('ok', 'OK', 'ok jedna')}
  </div></div>`;
}

function rSouhrn() {
  const p = S.prev;
  if (S.souboj) {
    const zav = p.druh === 'zaverecna', t = !zav && K.temata.find((x) => x.id === p.tema);
    const i = t ? K.temata.indexOf(t) : -1, dalsi = t && K.temata[i + 1];
    const nadpis = S.vyhra ? (zav ? `🎓 Jsi na vrcholu! ${K.zaverecna.nazev} je zdolaný!` : `🏆 ${p.strazce.jmeno} je ${p.strazce.rod === 'z' ? 'poražena' : 'poražen'}!`) : `${p.strazce.jmeno} tentokrát ${p.strazce.rod === 'z' ? 'vyhrála' : 'vyhrál'}`;
    const popis = S.vyhra
      ? (zav ? 'Zvládl jsi závěrečnou zkoušku ze všech soustav. Tohle na přijímačkách dáš! Udržovací trénink ti soustavy občas připomene.' : `${t.misto} je tvůj. +20 💎${dalsi ? ` Otevřel se další tábor: <b>${dalsi.ikona} ${dalsi.nazev}</b>.` : ` To byl poslední tábor, čeká tě ${K.zaverecna.nazev}!`}`)
      : 'Nevadí. Dovednosti, ve kterých jsi chyboval, se vrátily do tréninku. Procvič je a zkus to znovu – strážce počká.';
    return `${hlavicka()}
    <main class="souhrn"><section class="karta stred ${S.vyhra ? 'vyhra' : ''}">
      ${prisera(p.strazce, S.vyhra ? 'porazen' : '')}
      <h1>${nadpis}</h1><p>${popis}</p>
      <p class="velke-cislo">${p.spravne} správně · ${p.chyby} ${p.chyby === 1 ? 'chyba' : p.chyby >= 2 && p.chyby <= 4 ? 'chyby' : 'chyb'}</p>
      ${S.vyhra ? '<div class="konfety">' + Array.from({ length: 24 }, (_, i) => `<i style="--i:${i}"></i>`).join('') + '</div>' : ''}
      <div class="tlacitka">${S.vyhra ? tl('pokracuj', dalsiKrok().text + ' ▶', 'hlavni velke') : tl(zav ? 'oprava' : `trenink:${p.tema}`, '🏋️ Procvičit', 'hlavni velke')}${tl('mapa', '🗺️ Mapa')}</div>
    </section></main>`;
  }
  const t = p.tema && K.temata.find((x) => x.id === p.tema);
  const nove = p.nove.map((g) => POL[g].p.nazev);
  const zap = p.zapomenute.map((g) => POL[g].p.nazev);
  const nadpis = S.ostrovZvladnut ? `⭐ Všechny dovednosti zvládnuté!` : p.druh === 'oprava' && !slabaMista().length ? '🩹 Slabá místa jsou spravená!' : 'Kolo dokončeno';
  const hlavni = S.ostrovZvladnut ? tl(`strazce:${t.id}`, `⚔️ Na strážce: ${t.strazce.jmeno}`, 'hlavni velke blika') : tl('pokracuj', dalsiKrok().text + ' ▶', 'hlavni velke');
  return `${hlavicka()}
  <main class="souhrn"><section class="karta stred">
    ${S.ostrovZvladnut ? prisera(t.strazce) : ''}
    <h1>${nadpis}</h1>
    ${S.ostrovZvladnut ? `<p class="bublina">${t.strazce.hlaska}</p>` : ''}
    <p class="velke-cislo">${p.spravne} napoprvé správně z ${p.poradi} · +${p.ziskano} 💎</p>
    ${t && p.druh === 'trenink' ? `<p>${t.ikona} ${t.nazev}: zvládnuto ${zvladnuto(t)} z ${t.polozky.length} dovedností.</p>` : ''}
    ${nove.length ? `<p>⭐ Nově zvládnuto: <b>${nove.join(', ')}</b></p>` : ''}
    ${zap.length ? `<p>🩹 Zapomenuto (vrátí se do opakování): ${zap.join(', ')}</p>` : ''}
    <div class="tlacitka">${hlavni}${!S.ostrovZvladnut && p.druh === 'trenink' && dalsiKrok().akce !== `trenink:${p.tema}` ? tl(`trenink:${p.tema}`, '🏋️ Ještě kolo') : ''}${tl('mapa', '🗺️ Mapa')}</div>
  </section></main>`;
}

function rNastaveni() {
  const P = postup.P, posl = [...new Set(P.chyby.slice(0, 15).map((c) => POL[c.id]?.p.nazev).filter(Boolean))];
  const celkem = vsechnyPolozky().length, zvl = vsechnyPolozky().filter(postup.zvladnuta).length;
  return `${hlavicka(tl('mapa', '◀ Mapa', 'male'))}
  <main class="nastaveni"><section class="karta">
    <h1>⚙️ Nastavení a přehled</h1>
    <p>Zvládnuto ${zvl} z ${celkem} dovedností · poražených strážců ${K.temata.filter(temaHotovo).length} z ${K.temata.length} · vyřešených úloh ${P.odpovedi} · nejdelší série ${P.nejdelsiSerie} 🔥</p>
    <p>${K.zaverecna.nazev}: ${P.zaverecna.splnena ? 'splněná ✅' : P.zaverecna.pokusy ? `zatím nesplněná (pokusů ${P.zaverecna.pokusy}, nejlépe ${P.zaverecna.nejlepsi ?? 0} správně)` : 'ještě nebyla'}.</p>
    ${posl.length ? `<p>Poslední chyby: ${posl.join(', ')}.</p>` : ''}
    <div class="tlacitka">
      ${tl('zvuk', `Zvuk: ${P.nast.zvuk ? 'zapnutý 🔊' : 'vypnutý 🔇'}`)}
      ${tl('odemknout', P.vseOdemceno ? '🔓 Všechny tábory odemčené' : '🔒 Odemknout všechny tábory')}
      ${tl('smazat', '🗑 Smazat postup', 'nebezpecne')}
    </div>
    <p class="mala">Odemčení se hodí, když už něco umíš a chceš rovnou na pozdější téma (nebo pro rodiče a učitele). Postup se ukládá jen v tomhle prohlížeči.</p>
    <p class="mala">Klávesnice na počítači: číslice, <b>-</b> minus, <b>,</b> desetinná čárka, <b>/</b> zlomek (3/4), <b>Tab</b> nebo šipky přepínají políčka (x, y), <b>Enter</b> potvrdí, <b>1–4</b> vybere možnost.</p>
  </section></main>`;
}
function rSmazat() {
  return `${hlavicka()}<main class="nastaveni"><section class="karta stred"><h1>Opravdu smazat celý postup?</h1><p>Výprava začne znovu od prvního tábora. Nejde to vrátit.</p>
    <div class="tlacitka">${tl('smazat-ano', 'Ano, smazat', 'nebezpecne')}${tl('nastaveni', 'Ne, zpět', 'hlavni')}</div></section></main>`;
}
