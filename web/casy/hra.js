// Hotel Kuriózum: obrazovky (hotel, patro, lekce, úloha, souhrn, album, tahák, nastavení) a průběh kurzu.
// Kurz: v každém patře lekce → trénink po kolech, dokud nejsou zvládnuté všechny dovednosti → souboj s inspektorem
// (bez nápověd, nejvýš 1 chyba) → další patro. Nakonec Velká inspekce ze všeho.
// Sbírání: každá úloha obsluhuje jednoho hosta; správně napoprvé = srdíčko. Plná srdíčka = kartička do alba.
// Občas přijede tajný host (vzácná kartička). Nápovědy mizí: svítí → bledé → schované (💡 je ukáže, úloha se pak
// nepočítá do zvládnutí). Chyba = vysvětlení proč, hráč to musí opravit sám a úloha se za 3 úlohy vrátí.
import { generuj, pripravData, kartaHosta, md, vyber, zamichej, esc } from './ulohy.js';
import { prisera } from './prisery.js';
import { zvuk, nastavZtlumeni, odemkni } from './zvuk.js';
import * as postup from './postup.js';

const POCHVALY = ['Správně!', 'Výborně!', 'Přesně tak!', 'Paráda!', 'Ano!', 'Super!', 'Excellent!', 'Well done!', 'Bravo!'];
const DIKY = ['Thank you!', 'Lovely!', 'Wonderful!', 'Great job!', 'Perfect!', 'Splendid!'];
// Pseudo-položky Velké inspekce: klíč z kurz.json → generátor.
const ZAV = {
  cas: ['cas', { osoby: 'vse' }], cas2: ['cas2'], tvar: ['tvar', { cas: 'mix' }], pravopisS: ['pravopis', { cas: 's' }], pravopisC: ['pravopis', { cas: 'c' }],
  zapor: ['zapor', { cas: 'mix' }], otazka: ['otazka', { cas: 'mix' }], kratka: ['kratka'], oprav: ['oprav'],
  lina: ['vety', { skupina: 'lina' }], kontext: ['vety', { skupina: 'kontext' }], dvoji: ['vety', { skupina: 'dvoji' }], docasne: ['vety', { skupina: 'docasne' }],
};
let K = null, DATA = null;
const POL = {};               // gid „patro:polozka“ → { tema, p }
let S = { obr: 'nacitani' };
let prekryv = null;           // null | 'tahak' | { karta: id }
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
    const [kurz, patra, hoste, jazyk, vety] = await Promise.all(['kurz', 'patra', 'hoste', 'jazyk', 'vety'].map((n) => j(`data/${n}.json`)));
    DATA = pripravData({ jazyk, hoste, vety });
    const temata = patra.patra.map((t) => {
      t.polozky.forEach((p) => { p.gid = `${t.id}:${p.id}`; p.serie = p.serie || 3; POL[p.gid] = { tema: t, p }; });
      return { ...t, strazce: t.inspektor };
    });
    for (const [k, [gen, param]] of Object.entries(ZAV)) POL[`zav:${k}`] = { tema: null, p: { gid: `zav:${k}`, gen, param, nazev: kurz.zaverecna.nazev, serie: 1 } };
    K = { ...kurz, temata };
  } catch (e) {
    app().innerHTML = `<div class="karta chyba-nacteni">Nepodařilo se otevřít hotel (${esc(e.message)}). Zkus stránku obnovit.</div>`;
    return;
  }
  nastavZtlumeni(!postup.P.nast.zvuk);
  document.addEventListener('click', klik);
  document.addEventListener('keydown', klavesa);
  const q = new URLSearchParams(location.search);
  if (navigator.xr?.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then((ok) => { vrMozne = ok; if (ok) render(); }).catch(() => {});
  if (q.has('vrnahled')) import('./vr.js').then((m) => m.nahledVR());
  if (q.get('lekce')) otevriLekci(q.get('lekce')); else jdi({ obr: 'mapa' });
  window.__casy = { K, DATA, S: () => S, postup, akce, render, POL, generuj };
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
const hosteDo = (i) => K.temata.slice(0, i).flatMap((t) => t.hoste);
const indexAkt = () => { const a = aktualni(); return a ? K.temata.indexOf(a) : K.temata.length - 1; };
const vsichniHoste = () => K.temata.flatMap((t) => t.hoste);
function hodnost() {
  let h = K.hodnosti[0];
  for (const x of K.hodnosti) if (postup.P.mince >= x.od) h = x;
  return { ...h, dalsi: K.hodnosti.find((x) => x.od > postup.P.mince) };
}
function dalsiKrok() {
  const t = aktualni();
  if (t) {
    if (slabaMista().length >= 3) return { akce: 'oprava', text: `🩹 Nejdřív slabá místa (${slabaMista().length})` };
    if (!postup.tema(t.id).lekce) return { akce: `lekce:${t.id}`, text: `📖 Lekce: ${t.nazev}` };
    if (zvladnuto(t) < t.polozky.length) return { akce: `trenink:${t.id}`, text: `🛎️ Služba: ${t.nazev}` };
    return { akce: `strazce:${t.id}`, text: `🕵️ Kontrola: ${t.strazce.jmeno}` };
  }
  if (slabaMista().length) return { akce: 'oprava', text: `🩹 Slabá místa (${slabaMista().length})` };
  if (!postup.P.zaverecna.splnena) return { akce: 'zaverecna', text: `🏆 ${K.zaverecna.nazev}` };
  return { akce: 'udrzba', text: '🔁 Udržovací služba' };
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
  if (!['tahak', 'karta', 'zavri'].includes(co)) prekryv = null;
  switch (co) {
    case 'mapa': zrus(); jdi({ obr: 'mapa' }); break;
    case 'pokracuj': akce(dalsiKrok().akce); break;
    case 'patro': jdi({ obr: 'patro', tema: arg }); break;
    case 'lekce': otevriLekci(arg); break;
    case 'snimek': posunSnimek(+arg); break;
    case 'trenink': zacni({ druh: 'trenink', tema: arg }); break;
    case 'strazce': zacni({ druh: 'strazce', tema: arg }); break;
    case 'zaverecna': zacni({ druh: 'zaverecna' }); break;
    case 'oprava': zacni({ druh: 'oprava' }); break;
    case 'udrzba': zacni({ druh: 'udrzba' }); break;
    case 'volba': odpovez(arg); break;
    case 'napoveda': ukazNapovedu(); break;
    case 'dalsi': dalsiUloha(); break;
    case 'album': jdi({ obr: 'album' }); break;
    case 'karta': prekryv = { karta: arg }; render(); break;
    case 'tahak': prekryv = prekryv === 'tahak' ? null : 'tahak'; render(); break;
    case 'zavri': prekryv = null; render(); break;
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

// ---------- služba (trénink), kontrola (souboj), Velká inspekce ----------
function zacni(nast) {
  zrus();
  S = { obr: 'uloha', ...nast, poradi: 0, znovu: [], posledni: [], posl: [], spravne: 0, chyby: 0, nove: [], zapomenute: [], karty: [], combo: 0, ziskano: 0 };
  if (nast.druh === 'strazce') {
    const t = T(nast.tema);
    const zaklad = t.polozky.map((p) => p.gid);
    S.plan = zamichej([...zaklad, ...Array.from({ length: Math.max(0, K.strazce.otazek - zaklad.length) }, () => vyber(zaklad))]);
    S.zivoty = K.strazce.zivotu; S.max = K.strazce.zivotu; S.strazce = t.strazce; S.hp = S.plan.length;
    postup.tema(t.id).pokusy++; postup.uloz();
  }
  if (nast.druh === 'zaverecna') {
    const z = K.zaverecna;
    S.plan = zamichej(z.plan.slice(0, z.otazek).map((g) => `zav:${g}`));
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
  // Dovednosti se přidávají postupně: nová přijde, až má každá předchozí aspoň jeden úspěch.
  const prvniNova = ids.findIndex((g) => { const x = postup.polozka(g); return x.ok + x.ch === 0; });
  const predchoziJdou = ids.slice(0, Math.max(0, prvniNova)).every((g) => postup.polozka(g).s > 0 || postup.zvladnuta(g));
  const povolene = prvniNova < 0 ? nezvl : nezvl.filter((g) => ids.indexOf(g) < prvniNova + (predchoziJdou ? 1 : 0));
  return nejslabsi(neopakuj(povolene.length ? povolene : nezvl));
}

// Kontext pro generátor: hosté patra, ze kterého úloha je, a hosté starších pater.
function kontext(gid) {
  const { tema } = POL[gid];
  const chybi = vsichniHoste().filter((h) => !postup.maKartu(h));
  if (!tema) return { hoste: vsichniHoste(), starsi: [], chybi, posl: S.posl };
  const i = K.temata.indexOf(tema);
  // V opakování ve vyšším patře obsluhuješ hosty patra, ve kterém právě jsi.
  const ted = S.tema && T(S.tema) !== tema ? T(S.tema) : tema;
  return { hoste: ted.hoste, starsi: hosteDo(Math.max(i, K.temata.indexOf(ted))), chybi, posl: S.posl };
}

function dalsiUloha(prvni) {
  zrus();
  if (!prvni) S.poradi++;
  if (souboj() && (S.zivoty <= 0 || S.poradi >= S.plan.length)) return konecSouboje();
  if (S.druh === 'trenink') {
    const t = T(S.tema);
    if (zvladnuto(t) === t.polozky.length && !postup.tema(t.id).strazce && !S.znovu.length) return souhrn({ patroZvladnuto: true });
  }
  if (S.druh === 'oprava' && !slabaMista().length) return souhrn({});
  if (!souboj() && S.poradi >= delkaKola()) return souhrn({});
  const gid = vyberPolozku();
  if (!gid) return souhrn({});
  const { p } = POL[gid];
  S.posledni = [gid, ...S.posledni].slice(0, 2);
  let u = null;
  for (let pokus = 0; pokus < 6; pokus++) { u = generuj(p.gen, p.param, kontext(gid)); if (!S.posl.includes(u.klic)) break; }
  S.posl = [u.klic, ...S.posl].slice(0, 14);
  S.gid = gid; S.u = u;
  S.stav = 'ceka'; S.pokus = 0; S.chybaVUloze = false; S.napoveda = false; S.zprava = null; S.spatne = []; S.odhaleno = false;
  S.opakovani = S.druh === 'trenink' && POL[gid].tema && POL[gid].tema.id !== S.tema;
  render();
}

// Úroveň nápovědy: 0 = svítí, 1 = bledá, 2 = schovaná.
function uroven() {
  if (souboj()) return 2;
  if (S.napoveda) return 0;
  return Math.min(2, postup.polozka(S.gid).s);
}

// ---------- odpovědi ----------
function odpovez(id) {
  if (S.obr !== 'uloha' || S.stav !== 'ceka') return;
  const u = S.u;
  if (S.spatne.includes(id) || !u.moznosti.some((m) => m.id === id)) return;
  if (id === u.spravne) return dokonci(true);
  const m = u.moznosti.find((x) => x.id === id);
  if (souboj()) return chybaSouboje(u.vysvetleni);
  S.chybaVUloze = true; S.combo = 0; S.pokus++;
  zvuk.spatne();
  if (S.pokus >= 2 || u.moznosti.length - S.spatne.length <= 2) { S.spatne.push(id); S.odhaleno = true; return dokonci(false, u.vysvetleni); }
  S.spatne.push(id);
  S.zprava = { typ: 'chyba1', text: `${m.proc || 'Tohle ne.'} Zkus to znovu.` };
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
  S.zprava = { typ: 'chyba', text: `${md('Správně je to takhle:')} ${text}` };
  render();
}

// Úloha dokončena. U chyby se ukáže řešení a úloha se vrátí.
function dokonci(ok, vysv) {
  S.stav = 'vyhodnoceno';
  const p = POL[S.gid].p;
  const spravne = ok && !S.chybaVUloze;
  if (souboj()) {
    S.spravne++; S.hp--; S.combo++;
    pridejMince(1);
    postup.zapis(S.gid, true, p.serie);
    zvuk.zasah();
    S.zprava = { typ: 'ok', text: `${vyber(POCHVALY)} Inspektor škrtá další bod v seznamu chyb! 📋✔️` };
    render();
    casovac = setTimeout(dalsiUloha, 1500);
    return;
  }
  const r = postup.zapis(S.gid, spravne ? (S.napoveda ? null : true) : false, p.serie);
  if (r.zvladnuta) S.nove.push(S.gid);
  if (r.zapomenuta) S.zapomenute.push(S.gid);
  if (spravne) {
    S.spravne++; S.combo++;
    postup.P.nejdelsiSerie = Math.max(postup.P.nejdelsiSerie, S.combo);
    const zisk = pridejMince(nasobitel());
    let extra = '', zastav = false;
    if (!S.napoveda && S.u.host) {
      const h = DATA.H[S.u.host];
      if (postup.srdicko(h.id, K.srdciNaKartu)) { S.karty.push(h.id); extra += novaKarta(h, false); zastav = true; zvuk.vyhra(); }
      else if (!postup.maKartu(h.id)) extra += ` <span class="dik">${h.ikona} „${vyber(DIKY)}“ ❤️</span>`;
      const tajny = zkusTajneho();
      if (tajny) { S.karty.push(tajny.id); extra += novaKarta(tajny, true); zastav = true; }
    }
    const nap = S.napoveda ? ' <small>(s nápovědou se nepočítá do zvládnutí ani do srdíček)</small>' : '';
    S.zprava = { typ: 'ok', text: `${vyber(POCHVALY)} +${zisk} 🪙${nap}${r.zvladnuta ? ` <b>⭐ „${p.nazev}“ zvládnuto!</b>` : ''}${extra}` };
    if (!zastav) r.zvladnuta ? zvuk.hvezda() : zvuk.dobre();
    S.zastav = zastav;
    render();
    if (!zastav) casovac = setTimeout(dalsiUloha, r.zvladnuta ? 1900 : 1400);
  } else {
    S.chyby++; S.combo = 0;
    S.znovu.push({ id: S.gid, kdy: S.poradi + 3 });
    S.zprava = ok
      ? { typ: 'dokonceno', text: `Hotovo, ale s chybou. ${S.u.vysvetleni} <div class="vrati">🔁 Úloha se ti brzy vrátí, ať ji dáš napoprvé.</div>` }
      : { typ: 'chyba', text: `${vysv || ''} <div class="vrati">🔁 Úloha se ti brzy vrátí.</div>` };
    if (ok) zvuk.krok();
    render();
  }
}
const novaKarta = (h, tajny) => `<div class="nova-karta ${tajny ? 'tajna' : ''}" style="--b:${h.barva}"><span class="nk-ik">${h.ikona}</span><div><b>${tajny ? '🛎️ Přijel tajný host!' : '🎉 Spokojený host!'}</b><br>${esc(h.jmeno)} ti dal${h.os === 'she' ? 'a' : ''} kartičku do alba.</div>${'<button class="tl male" data-a="karta:' + h.id + '">Ukázat</button>'}</div>`;
function zkusTajneho() {
  const t = K.tajnyHost;
  if (indexAkt() < t.odPatra && !postup.P.vseOdemceno) return null;
  if (Math.random() >= t.sance) return null;
  const zbyva = DATA.tajni.filter((h) => !postup.maKartu(h.id));
  if (!zbyva.length) return null;
  const h = vyber(zbyva);
  postup.P.tajni.push(h.id); postup.uloz();
  return h;
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
  if (x.patroZvladnuto) zvuk.vyhra();
  render();
}

// ---------- klávesnice počítače: 1–4 = možnost, Enter = další ----------
function klavesa(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape' && prekryv) { prekryv = null; render(); return; }
  if (S.obr === 'lekce') {
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); posunSnimek(1); }
    if (e.key === 'ArrowLeft') posunSnimek(-1);
    return;
  }
  if (S.obr === 'souhrn' && e.key === 'Enter') { e.preventDefault(); document.querySelector('.tl.hlavni')?.click(); return; }
  if (S.obr !== 'uloha') return;
  if (S.stav === 'vyhodnoceno') { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dalsiUloha(); } return; }
  const i = +e.key - 1;
  if (S.u.moznosti[i]) { e.preventDefault(); odpovez(S.u.moznosti[i].id); }
}

// ================= vykreslení =================
const tl = (a, t, styl = '', x = '') => `<button class="tl ${styl}" data-a="${a}" ${x}>${t}</button>`;
const srdicka = (id) => {
  if (postup.maKartu(id)) return '<span class="srdce plna-karta">🗂️</span>';
  const n = postup.P.srdce[id] || 0;
  return `<span class="srdce">${'❤️'.repeat(n)}${'🤍'.repeat(Math.max(0, K.srdciNaKartu - n))}</span>`;
};

export function render() {
  const el = app(); if (!el || !K) return;
  const o = S.obr;
  el.className = 'obr-' + o;
  el.innerHTML = (o === 'mapa' ? rMapa() : o === 'patro' ? rPatro() : o === 'lekce' ? rLekce() : o === 'uloha' ? rUloha()
    : o === 'souhrn' ? rSouhrn() : o === 'album' ? rAlbum() : o === 'nastaveni' ? rNastaveni() : o === 'smazat' ? rSmazat() : '')
    + (prekryv === 'tahak' ? rTahak() : prekryv?.karta ? rKarta(prekryv.karta) : '');
  if (o === 'uloha') document.querySelector('.zprava')?.scrollIntoView?.({ block: 'nearest' });
  oznam();
}

function hlavicka(levy) {
  const h = hodnost(), nKaret = postup.P.album.length + postup.P.tajni.length;
  return `<header class="hlava">${levy || `<div class="logo">🛎️ ${K.nazev}</div>`}
    <div class="hlava-vpravo"><span class="mince" title="Spropitné">🪙 ${postup.P.mince}</span><span class="hodnost">${h.nazev}</span>${tl('album', `🗂️ <small>${nKaret}</small>`, 'male', 'title="Album hostů"')}${tl('tahak', '📖', 'male kulate', 'aria-label="Tahák" title="Tahák: pravidla obou časů"')}${veVR ? tl('vr-konec', 'Opustit VR', 'male') : vrMozne ? tl('vr', '🥽 Do VR', 'male hlavni') : ''}${tl('nastaveni', '⚙️', 'male kulate', 'aria-label="Nastavení"')}</div></header>`;
}

// Hotel: patra odspodu nahoru, v každém okna s hosty (rozsvícená = host je v albu).
function okna(t, od) {
  return t.hoste.map((id) => {
    const h = DATA.H[id], ma = postup.maKartu(id);
    return `<span class="okno ${ma ? 'sviti' : ''} ${od ? '' : 'zavrene'}" title="${od ? esc(h.jmeno) : ''}">${ma ? h.ikona : od ? '<span class="zaves"></span>' : ''}</span>`;
  }).join('');
}
function rFasada(maly) {
  const patra = K.temata.map((t, i) => {
    const st = postup.tema(t.id), od = odemcene(i), z = zvladnuto(t), n = t.polozky.length;
    const hvezdy = (st.lekce ? 1 : 0) + (z === n ? 1 : 0) + (st.strazce ? 1 : 0);
    if (maly) return `<div class="patro-radek mini ${od ? '' : 'zamceno'}"><div class="okna">${okna(t, od)}</div></div>`;
    return `<button class="patro-radek ${od ? '' : 'zamceno'} ${st.strazce ? 'hotovo' : ''} ${aktualni() === t ? 'aktualni' : ''}" data-a="patro:${t.id}" ${od ? '' : 'disabled'} style="--b:${t.barva}">
      <span class="patro-cedule"><span class="patro-ik">${od ? t.ikona : '🔒'}</span><span class="patro-text"><b>${esc(t.nazev)}</b><small>${od ? t.kratce : 'Zatím zamčeno'}</small>
        <span class="hvezdy">${'★'.repeat(hvezdy)}<span class="prazdne">${'★'.repeat(3 - hvezdy)}</span></span></span></span>
      <span class="okna">${okna(t, od)}</span>
      ${st.strazce ? '<span class="porazen">🏆</span>' : ''}
    </button>`;
  }).reverse().join('');
  const zav = K.zaverecna, zOd = !aktualni() || postup.P.vseOdemceno, hotovych = K.temata.filter(temaHotovo).length + (postup.P.zaverecna.splnena ? 1 : 0);
  const strecha = maly ? '' : `<button class="strecha ${zOd ? '' : 'zamceno'} ${postup.P.zaverecna.splnena ? 'hotovo' : ''}" data-a="zaverecna" ${zOd ? '' : 'disabled'}>
      <span>${zOd ? '🏆' : '🔒'} <b>Střecha: ${zav.nazev}</b></span><small>${postup.P.zaverecna.splnena ? 'Splněno! 🎉' : zOd ? 'Všechno ze všech pater' : 'Otevře se po všech patrech'}</small></button>`;
  return `<div class="hotel ${maly ? 'maly' : ''}">
    <div class="stit"><span class="neon">HOTEL KURIÓZUM</span><span class="hvezdy-hotelu">${'★'.repeat(hotovych)}<span class="prazdne">${'★'.repeat(K.temata.length + 1 - hotovych)}</span></span></div>
    ${strecha}${patra}
    <div class="prizemi-dvere"><span class="dvere-hotelu">🚪</span><span class="kocka-recepce">🛎️</span></div>
  </div>`;
}

function rMapa() {
  const d = dalsiKrok(), h = hodnost(), slaba = slabaMista().length;
  return `${hlavicka()}
  <main class="mapa">
    <section class="karta uvod">
      <h1>🛎️ ${K.nazev}</h1>
      <p>${K.podtitul}. Obsluhuj hosty, sbírej jejich kartičky a dostaň se až na střechu k Velké inspekci.</p>
      ${tl('pokracuj', d.text + ' ▶', 'hlavni velke blika')}
      <div class="statistika">${h.dalsi ? `Do hodnosti <b>${h.dalsi.nazev}</b> chybí ${h.dalsi.od - postup.P.mince} 🪙` : 'Nejvyšší hodnost! 🎖️'} · 🗂️ ${postup.P.album.length}/${vsichniHoste().length} hostů${postup.P.tajni.length ? ` · 🛎️ tajní ${postup.P.tajni.length}/${DATA.tajni.length}` : ''}${slaba ? ` · 🩹 slabých míst: ${slaba}` : ''}</div>
    </section>
    ${rFasada(false)}
    ${kurzHotov() ? `<section class="karta hotovo-kurz">🎓 <b>Hotel má pět hvězdiček a ty oba časy umíš!</b> Udržovací služba ti je občas připomene. ${tl('udrzba', '🔁 Udržovací služba', 'hlavni')}</section>` : ''}
  </main>`;
}

function rPatro() {
  const t = T(S.tema), st = postup.tema(t.id), z = zvladnuto(t), n = t.polozky.length;
  const polozky = t.polozky.map((p) => {
    const pp = postup.polozka(p.gid);
    return `<li class="${pp.z ? 'zvladnuto' : ''}"><span>${pp.z ? '⭐' : '○'} ${esc(p.nazev)}</span><span class="serie">${Array.from({ length: p.serie }, (_, i) => `<i class="${i < Math.min(pp.s, p.serie) ? 'plna' : ''}"></i>`).join('')}</span></li>`;
  }).join('');
  const hoste = t.hoste.map((id) => {
    const h = DATA.H[id], ma = postup.maKartu(id);
    return `<button class="host-dlazdice ${ma ? 'ma' : ''}" ${ma ? `data-a="karta:${id}"` : 'disabled'} style="--b:${h.barva}"><span class="hd-ik">${h.ikona}</span><b>${esc(h.kratke)}</b><small>pokoj ${h.pokoj}</small>${srdicka(id)}</button>`;
  }).join('');
  return `${hlavicka(tl('mapa', '◀ Hotel', 'male'))}
  <main class="patro-detail">
    <section class="karta" style="--b:${t.barva}">
      <div class="patro-hlava"><span class="velka-ikona">${t.ikona}</span><div><h1>${esc(t.nazev)}</h1><p>${t.kratce}</p></div></div>
      <div class="tlacitka">
        ${tl(`lekce:${t.id}`, `📖 Lekce${st.lekce ? ' ✓' : ''}`, st.lekce ? '' : 'hlavni')}
        ${tl(`trenink:${t.id}`, `🛎️ Služba (${z}/${n})`, st.lekce && z < n ? 'hlavni' : '')}
        ${tl(`strazce:${t.id}`, st.strazce ? '🕵️ Kontrola znovu' : '🕵️ Kontrola inspektora', !st.strazce && z === n ? 'hlavni' : '', z === n || st.strazce ? '' : 'disabled title="Nejdřív zvládni všechny dovednosti"')}
      </div>
      <h2>Hosté v patře</h2>
      <div class="hoste-mrizka">${hoste}</div>
      <p class="mala">Každá správná odpověď napoprvé potěší hosta ❤️. Když má host ${K.srdciNaKartu} srdíčka, dá ti svou kartičku do alba.</p>
      <h2>Dovednosti</h2>
      <ul class="dovednosti">${polozky}</ul>
      <p class="mala">Dovednost je zvládnutá, když ji několikrát za sebou (kolik je teček) dáš napoprvé bez chyby. Nápovědy ze začátku svítí, pak blednou a nakonec zmizí.</p>
    </section>
    <section class="karta strazce-karta">
      ${prisera(t.strazce, st.strazce ? 'porazen' : '')}
      <div><h2>${esc(t.strazce.jmeno)}</h2><p class="bublina">${esc(st.strazce ? t.strazce.porazen : t.strazce.hlaska)}</p>
      <p class="mala">Kontrola: ${K.strazce.otazek} úloh, bez nápověd, smíš udělat 1 chybu.</p></div>
    </section>
  </main>`;
}

const priklad = (s) => md(s);
function rLekce() {
  const t = T(S.tema), sn = t.lekce[S.snimek], posl = S.snimek === t.lekce.length - 1;
  let obr = '';
  if (sn.hotel) obr += rFasada(true);
  if (sn.host) { const h = DATA.H[sn.host], k = kartaHosta(h, 2); obr += `<div class="lekce-host" style="--b:${h.barva}"><span class="obri">${h.ikona}</span><div><b>${esc(h.jmeno)}</b><div class="mala">${esc(h.popis)}</div>${k.zvyky.map((z) => `<div>📖 ${z.html}</div>`).join('')}<div>🔑 ${k.ted.html}</div></div></div>`; }
  if (sn.dirka) { const h = DATA.H[sn.dirka], a = h.ted[0]; obr += `<div class="dirka-obal"><div class="dvere"><span class="cislo-dveri">${h.pokoj}</span></div><div class="dirka"><span class="dirka-host">${h.ikona}</span><span class="dirka-akce">${a.ik}</span></div></div>`; }
  const tab = sn.tabulka ? `<table class="tabulka">${sn.tabulka.map((r) => `<tr>${r.map((c) => `<td>${priklad(c)}</td>`).join('')}</tr>`).join('')}</table>` : '';
  const pri = sn.priklady ? `<div class="priklady">${sn.priklady.map(([en, cs]) => `<div class="priklad"><span class="en">${priklad(en)}</span>${cs ? `<span class="cs">${md(cs)}</span>` : ''}</div>`).join('')}</div>` : '';
  return `${hlavicka(tl('mapa', '◀ Hotel', 'male'))}
  <main class="lekce">
    <div class="pokrok-lekce">${t.lekce.map((_, i) => `<i class="${i <= S.snimek ? 'plna' : ''}"></i>`).join('')}</div>
    <section class="karta snimek">
      <div class="stitek">${t.ikona} ${esc(t.nazev)} · lekce ${S.snimek + 1}/${t.lekce.length}</div>
      <h1>${md(sn.nadpis)}</h1>
      ${obr}
      ${sn.text.map((p) => `<p>${md(p)}</p>`).join('')}
      ${tab}${pri}
    </section>
    <div class="tlacitka">
      ${S.snimek > 0 ? tl('snimek:-1', '◀ Zpět') : ''}
      ${tl('snimek:1', posl ? 'Jdu do služby 🛎️' : 'Další ▶', 'hlavni velke')}
    </div>
  </main>`;
}

function rUloha() {
  const u = S.u;
  let horni;
  if (souboj()) {
    const max = S.plan.length;
    horni = `<div class="souboj">
      <div class="souboj-prisera ${S.zprava?.typ === 'ok' ? 'zasazena' : ''}">${prisera(S.strazce, S.zprava?.typ === 'chyba' ? 'smich' : '')}</div>
      <div class="souboj-info"><b>${esc(S.strazce.jmeno)}</b>
        <div class="hp"><span style="width:${(100 * S.hp) / max}%"></span></div>
        <div class="zivoty">${'❤️'.repeat(Math.max(0, S.zivoty))}${'🖤'.repeat(Math.max(0, S.max - S.zivoty))} <small>úloha ${S.poradi + 1}/${max}</small></div>
        ${S.poradi === 0 && S.stav === 'ceka' ? `<p class="bublina">${esc(S.strazce.hlaska)}</p>` : ''}
      </div></div>`;
  } else {
    const t = S.tema && T(S.tema);
    const nazev = S.druh === 'oprava' ? '🩹 Slabá místa' : S.druh === 'udrzba' ? '🔁 Udržovací služba' : `${t.ikona} ${esc(t.nazev)}`;
    const pokrok = S.druh === 'trenink' ? `<span class="zvl">⭐ ${zvladnuto(t)}/${t.polozky.length}</span>` : '';
    horni = `<div class="trenink-hlava"><span>${nazev}</span>${pokrok}
      <span class="kolo">${Array.from({ length: delkaKola() }, (_, i) => `<i class="${i < S.poradi ? 'plna' : i === S.poradi ? 'ted' : ''}"></i>`).join('')}</span>
      <span class="combo ${S.combo >= 3 ? 'hori' : ''}">🔥 ${S.combo}${nasobitel() > 1 ? ` <small>×${nasobitel()}</small>` : ''}</span></div>`;
  }
  const p = POL[S.gid].p, lvl = uroven();
  const h = u.host && DATA.H[u.host];
  const host = h && !souboj() ? `<div class="host-pruh" style="--b:${h.barva}"><span class="hp-ik ${S.zprava?.typ === 'ok' ? 'skace' : ''}">${h.ikona}</span><span class="hp-jm">${esc(h.jmeno)} <small>· pokoj ${h.pokoj}</small></span>${srdicka(h.id)}</div>` : '';
  const nap = !souboj() && S.stav === 'ceka' && lvl === 2 && u.rada
    ? tl('napoveda', '💡', 'male kulate napoveda-tl', 'title="Ukázat nápovědu (úloha se pak nepočítá do zvládnutí)" aria-label="Nápověda"') : '';
  const zadani = S.stav !== 'ceka' && u.hotovo ? u.hotovo : u.zadani;
  const moz = `<div class="volby ${u.moznosti.some((m) => m.html.length > 22) ? 'dlouhe' : ''}">${u.moznosti.map((m, i) => {
    const sp = S.spatne.includes(m.id), ok = S.stav !== 'ceka' && m.id === u.spravne;
    return `<button class="tl volba ${sp ? 'spatne' : ''} ${ok ? 'spravne' : ''}" data-a="volba:${m.id}" ${sp || S.stav !== 'ceka' ? 'disabled' : ''}><small>${i + 1}</small> <span>${m.html}</span></button>`;
  }).join('')}</div>`;
  const dalsiTl = S.stav === 'vyhodnoceno' && (S.zprava?.typ !== 'ok' || S.zastav) ? `<div class="tlacitka">${tl('dalsi', 'Další ▶', 'hlavni velke')}</div>` : '';
  return `${hlavicka(tl('mapa', '✕', 'male kulate', 'aria-label="Konec"'))}
  <main class="uloha nap-${lvl}">
    ${horni}
    <section class="karta zadani-karta">
      ${host}
      <div class="stitek">${S.opakovani ? '🔁 Opakování · ' : ''}${esc(p.nazev)}</div>${nap}
      <div class="otazka">${u.otazka}</div>
      ${u.scena || ''}
      ${zadani ? `<div class="veta-zadani">${zadani}</div>` : ''}
      ${u.rada && lvl < 2 ? `<div class="rada nap-${lvl}">💡 ${u.rada}</div>` : ''}
      ${S.zprava ? `<div id="zprava" class="zprava ${S.zprava.typ}">${S.zprava.text}</div>` : ''}
    </section>
    ${moz}
    ${dalsiTl}
  </main>`;
}

function rSouhrn() {
  const p = S.prev;
  if (S.souboj) {
    const zav = p.druh === 'zaverecna', t = !zav && T(p.tema);
    const i = t ? K.temata.indexOf(t) : -1, dalsi = t && K.temata[i + 1];
    const nadpis = S.vyhra ? (zav ? '🎓 Velká inspekce je splněná!' : `🏆 ${p.strazce.jmeno} je spokojený!`) : `${p.strazce.jmeno} našel moc chyb`;
    const popis = S.vyhra
      ? (zav ? 'Hotel Kuriózum dostal pět hvězdiček. Present simple i present continuous umíš! Udržovací služba ti je občas připomene.' : `${esc(p.strazce.porazen)} +20 🪙${dalsi ? ` Otevřelo se další patro: <b>${dalsi.ikona} ${esc(dalsi.nazev)}</b>.` : ' To bylo poslední patro – čeká tě Velká inspekce na střeše!'}`)
      : 'Nevadí. Dovednosti, ve kterých jsi chyboval, se vrátily do služby. Procvič je a zkus to znovu – inspektor počká.';
    return `${hlavicka()}
    <main class="souhrn"><section class="karta stred ${S.vyhra ? 'vyhra' : ''}">
      ${prisera(p.strazce, S.vyhra ? 'porazen' : '')}
      <h1>${nadpis}</h1><p>${popis}</p>
      <p class="velke-cislo">${p.spravne} správně · ${p.chyby} ${p.chyby === 1 ? 'chyba' : p.chyby >= 2 && p.chyby <= 4 ? 'chyby' : 'chyb'}</p>
      ${S.vyhra ? '<div class="konfety">' + Array.from({ length: 24 }, (_, i) => `<i style="--i:${i}"></i>`).join('') + '</div>' : ''}
      <div class="tlacitka">${S.vyhra ? tl('pokracuj', dalsiKrok().text + ' ▶', 'hlavni velke') : tl(zav ? 'oprava' : `trenink:${p.tema}`, '🛎️ Procvičit', 'hlavni velke')}${tl('mapa', '🏨 Hotel')}</div>
    </section></main>`;
  }
  const t = p.tema && T(p.tema);
  const nove = p.nove.map((g) => POL[g].p.nazev), zap = p.zapomenute.map((g) => POL[g].p.nazev);
  const karty = (p.karty || []).map((id) => DATA.H[id]);
  const nadpis = S.patroZvladnuto ? '⭐ Všechny dovednosti zvládnuté!' : p.druh === 'oprava' && !slabaMista().length ? '🩹 Slabá místa jsou spravená!' : 'Směna skončila';
  const hlavni = S.patroZvladnuto ? tl(`strazce:${t.id}`, `🕵️ Na kontrolu: ${esc(t.strazce.jmeno)}`, 'hlavni velke blika') : tl('pokracuj', dalsiKrok().text + ' ▶', 'hlavni velke');
  return `${hlavicka()}
  <main class="souhrn"><section class="karta stred">
    ${S.patroZvladnuto ? prisera(t.strazce) : ''}
    <h1>${nadpis}</h1>
    ${S.patroZvladnuto ? `<p class="bublina">${esc(t.strazce.hlaska)}</p>` : ''}
    <p class="velke-cislo">${p.spravne} napoprvé správně z ${p.poradi} · +${p.ziskano} 🪙</p>
    ${karty.length ? `<p>🗂️ Nové kartičky: ${karty.map((h) => `<button class="mini-karta" data-a="karta:${h.id}" style="--b:${h.barva}">${h.ikona} ${esc(h.kratke)}</button>`).join(' ')}</p>` : ''}
    ${t && p.druh === 'trenink' ? `<p>${t.ikona} ${esc(t.nazev)}: zvládnuto ${zvladnuto(t)} z ${t.polozky.length} dovedností.</p>` : ''}
    ${nove.length ? `<p>⭐ Nově zvládnuto: <b>${nove.map(esc).join(', ')}</b></p>` : ''}
    ${zap.length ? `<p>🩹 Zapomenuto (vrátí se do opakování): ${zap.map(esc).join(', ')}</p>` : ''}
    <div class="tlacitka">${hlavni}${!S.patroZvladnuto && p.druh === 'trenink' && dalsiKrok().akce !== `trenink:${p.tema}` ? tl(`trenink:${p.tema}`, '🛎️ Ještě směnu') : ''}${tl('mapa', '🏨 Hotel')}</div>
  </section></main>`;
}

// Album hostů: kartičky (získané barevně, ostatní jako zavřené dveře).
function rAlbum() {
  const dlazdice = (h) => {
    const ma = postup.maKartu(h.id);
    return ma
      ? `<button class="album-karta" data-a="karta:${h.id}" style="--b:${h.barva}"><span class="ak-ik">${h.ikona}</span><b>${esc(h.kratke)}</b><small>pokoj ${h.pokoj}</small></button>`
      : `<div class="album-karta prazdna"><span class="ak-ik">🚪</span><b>${h.tajny ? '???' : `Pokoj ${h.pokoj}`}</b>${h.tajny ? '<small>tajný host</small>' : srdicka(h.id)}</div>`;
  };
  const patra = K.temata.map((t) => `<h2>${t.ikona} ${esc(t.nazev)}</h2><div class="album-mrizka">${t.hoste.map((id) => dlazdice(DATA.H[id])).join('')}</div>`).join('');
  return `${hlavicka(tl('mapa', '◀ Hotel', 'male'))}
  <main class="album"><section class="karta">
    <h1>🗂️ Album hostů <small>${postup.P.album.length}/${vsichniHoste().length}</small></h1>
    <p class="mala">Klepni na kartičku a přečti si, co host dělá každý den 📖 a co dělá právě teď 🔑.</p>
    ${patra}
    <h2>🛎️ Tajní hosté <small>${postup.P.tajni.length}/${DATA.tajni.length}</small></h2>
    <p class="mala">Přijíždějí jen občas, za správnou odpověď ve službě. Nikdo neví kdy.</p>
    <div class="album-mrizka">${DATA.tajni.map((h) => dlazdice({ ...h, tajny: true })).join('')}</div>
  </section></main>`;
}

function rKarta(id) {
  const h = DATA.H[id];
  if (!h || !postup.maKartu(id)) return '';
  const k = kartaHosta(h);
  return `<div class="tahak-pozadi" data-a="zavri"></div><section class="karta-hosta ${h.tajny ? 'tajna' : ''}" style="--b:${h.barva}">
    <div class="kh-hlava"><span class="kh-ik">${h.ikona}</span><div><h2>${esc(h.jmeno)}</h2><small>${h.tajny ? '🛎️ tajný host' : `pokoj ${h.pokoj}`}</small></div>${tl('zavri', '✕', 'male kulate', 'aria-label="Zavřít"')}</div>
    <p class="kh-popis">${esc(h.popis)}</p>
    <div class="kh-oddil">📖 <b>Every day…</b></div>
    ${k.zvyky.map((z) => `<div class="kh-veta"><span>${z.ik}</span> ${z.html}</div>`).join('')}
    <div class="kh-oddil">🔑 <b>Right now…</b></div>
    <div class="kh-veta ted"><span>${k.ted.ik}</span> ${k.ted.html}</div>
  </section>`;
}

// Tahák: pravidla obou časů, signální slova a líná slovesa.
function rTahak() {
  const J = DATA.J;
  const sig = (c) => J.signaly[c].map((s) => `<span class="signal sig-${c}" title="${esc(s.cs)}">${esc(s.t)}</span>`).join(' ');
  return `<div class="tahak-pozadi" data-a="tahak"></div><section class="tahak karta"><div class="tahak-hlava"><h2>📖 Tahák poslíčka</h2>${tl('tahak', '✕', 'male kulate', 'aria-label="Zavřít"')}</div>
    <div class="tahak-mrizka">
      <div class="tahak-blok sig-s-blok"><h3>📖 Present simple</h3><p>zvyk, pravidelně, vždycky platí</p>
        <p>I / you / we / they <b>play</b><br>he / she / it <b>play<u>s</u></b> (watch<u>es</u>, fl<u>ies</u>, <u>has</u>)</p>
        <p>✗ I <b>don't</b> play · he <b>doesn't</b> play<br>❓ <b>Do</b> you play? · <b>Does</b> he play?</p>
        <p>${sig('s')}</p></div>
      <div class="tahak-blok sig-c-blok"><h3>🔑 Present continuous</h3><p>právě teď, dočasně</p>
        <p>I <b>am</b> play<u>ing</u> · he/she/it <b>is</b> play<u>ing</u><br>you / we / they <b>are</b> play<u>ing</u> (mak<u>ing</u>, swi<u>mm</u>ing, l<u>y</u>ing)</p>
        <p>✗ I <b>am not</b> · he <b>isn't</b> · they <b>aren't</b> playing<br>❓ <b>Is</b> he playing? · <b>Are</b> you playing?</p>
        <p>${sig('c')}</p></div>
    </div>
    <div class="tahak-blok"><h3>😴 Líná slovesa (bez -ing)</h3><p>${J.lina.map((x) => `<b>${x}</b>`).join(', ')}</p><p class="mala">have = mít (bez -ing), ale have lunch / a shower / fun → is having. think = myslet si (bez -ing), think about = přemýšlet → is thinking.</p></div>
  </section>`;
}

function rNastaveni() {
  const P = postup.P, posl = [...new Set(P.chyby.slice(0, 15).map((c) => POL[c.id]?.p.nazev).filter(Boolean))];
  const celkem = vsechnyPolozky().length, zvl = vsechnyPolozky().filter(postup.zvladnuta).length;
  return `${hlavicka(tl('mapa', '◀ Hotel', 'male'))}
  <main class="nastaveni"><section class="karta">
    <h1>⚙️ Nastavení a přehled</h1>
    <p>Zvládnuto ${zvl} z ${celkem} dovedností · spokojených inspektorů ${K.temata.filter(temaHotovo).length} z ${K.temata.length} · kartiček hostů ${P.album.length} z ${vsichniHoste().length} (tajných ${P.tajni.length}) · vyřešených úloh ${P.odpovedi} · nejdelší série ${P.nejdelsiSerie} 🔥</p>
    <p>${K.zaverecna.nazev}: ${P.zaverecna.splnena ? 'splněná ✅' : P.zaverecna.pokusy ? `zatím nesplněná (pokusů ${P.zaverecna.pokusy}, nejlépe ${P.zaverecna.nejlepsi ?? 0} správně)` : 'ještě nebyla'}.</p>
    ${posl.length ? `<p>Poslední chyby: ${posl.map(esc).join(', ')}.</p>` : ''}
    <div class="tlacitka">
      ${tl('zvuk', `Zvuk: ${P.nast.zvuk ? 'zapnutý 🔊' : 'vypnutý 🔇'}`)}
      ${tl('odemknout', P.vseOdemceno ? '🔓 Všechna patra odemčená' : '🔒 Odemknout všechna patra')}
      ${tl('smazat', '🗑 Smazat postup', 'nebezpecne')}
    </div>
    <p class="mala">Odemčení se hodí, když už něco umíš a chceš rovnou do vyššího patra (nebo pro rodiče a učitele). Postup se ukládá jen v tomhle prohlížeči.</p>
    <p class="mala">Klávesnice na počítači: <b>1–4</b> vybere možnost, <b>Enter</b> = další, <b>Esc</b> zavře tahák.</p>
  </section></main>`;
}
function rSmazat() {
  return `${hlavicka()}<main class="nastaveni"><section class="karta stred"><h1>Opravdu smazat celý postup?</h1><p>Hotel začne znovu od přízemí a album bude prázdné. Nejde to vrátit.</p>
    <div class="tlacitka">${tl('smazat-ano', 'Ano, smazat', 'nebezpecne')}${tl('nastaveni', 'Ne, zpět', 'hlavni')}</div></section></main>`;
}
