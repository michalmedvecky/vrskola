// Řízení aplikace: obrazovky (domů, lekce, trénink, souhrn, volné hraní, nastavení) a „model obrazovky“ (vm),
// který kreslí dvě vykreslovadla: běžná stránka (ui.js) a panel ve VR (vr.js). Obě posílají akce zpět sem.
import { JEDNOTKY, VSECHNY_POLOZKY, jednotkaPolozky } from './kurz.js';
import { vytvor, tonZRetezce } from './cviceni.js';
import { stupnice, stupniceNahoruDolu, midi, jmeno, tridaTonu, zamichej, nahodny, DRUHY, DUR, MOLL } from './hudba.js';
import { hrajTon, hrajSled, zastav, znelka, nastavZtlumeni, odemkni } from './zvuk.js';
import * as postup from './postup.js';

const DELKA_SEZENI = 12, DELKA_ZKOUSKY = 25, MAX_CHYB_ZKOUSKY = 2;
const POCHVALY = ['Správně!', 'Výborně!', 'Přesně tak!', 'Paráda!', 'Ano!', 'Super!'];

let S = { obrazovka: 'domu' };
let hraje = new Set();      // klávesy, které právě zní z ukázky
let stisknute = new Set();  // klávesy, které žák drží
const posluchaci = [];
export function poslouchej(fn) { posluchaci.push(fn); }
export function render() { const vm = model(); posluchaci.forEach((f) => f(vm)); }
let casovac = null;
const zrusCasovac = () => { clearTimeout(casovac); casovac = null; };

function prehrajSled(sled, opts = {}) {
  return hrajSled(sled, { ...opts, priTonu: (tony) => { hraje = new Set(tony); render(); } });
}

// ---------- přechody ----------
export function akce(id) {
  odemkni();
  const [co, arg] = id.split(/:(.*)/s);
  switch (co) {
    case 'domu': zastav(); zrusCasovac(); S = { obrazovka: 'domu' }; break;
    case 'pokracovat': pokracuj(); return;
    case 'lekce': otevriLekci(arg); return;
    case 'trenink': zacniTrenink({ druh: 'jednotka', jednotka: arg, volny: postup.jednotka(arg).hotovo }); return;
    case 'snimek': posunSnimek(+arg); return;
    case 'ukazka': hrajUkazku(); return;
    case 'odp': odpovez(arg); return;
    case 'prehraj': { const c = S.cviceni; if (c) prehrajSled(S.stav === 'vyhodnoceno' ? c.ukaz.sled : c.prehraj); return; }
    case 'dalsi': dalsiOtazka(); return;
    case 'hrani': zastav(); S = { obrazovka: 'hrani' }; break;
    case 'nastaveni': S = { obrazovka: 'nastaveni' }; break;
    case 'popisky': postup.P.nast.popisky = !postup.P.nast.popisky; postup.uloz(); break;
    case 'zvuk': postup.P.nast.zvuk = !postup.P.nast.zvuk; nastavZtlumeni(!postup.P.nast.zvuk); postup.uloz(); break;
    case 'smazat': S = { obrazovka: 'smazat' }; break;
    case 'smazat-ano': postup.smaz(); S = { obrazovka: 'domu' }; break;
    case 'stupnice': { const [idT, druh] = arg.split('|'); ukazStupnici(idT, druh); return; }
    default: break;
  }
  render();
}

export function pokracuj() {
  const j = postup.aktualniJednotka();
  if (j) { if (!postup.jednotka(j.id).lekce) otevriLekci(j.id); else zacniTrenink({ druh: 'jednotka', jednotka: j.id }); return; }
  if (postup.slabaMista().length) { zacniTrenink({ druh: 'oprava' }); return; }
  if (!postup.P.zkouska.splnena) { zacniTrenink({ druh: 'zkouska' }); return; }
  zacniTrenink({ druh: 'udrzba' });
}

// ---------- lekce ----------
function otevriLekci(id) {
  zastav(); zrusCasovac();
  S = { obrazovka: 'lekce', jednotka: JEDNOTKY.find((j) => j.id === id), snimek: 0, znacky: {} };
  vstupNaSnimek();
}
function posunSnimek(d) {
  const j = S.jednotka, n = S.snimek + d;
  if (n >= j.lekce.length) {
    postup.jednotka(j.id).lekce = true; postup.uloz();
    zacniTrenink({ druh: 'jednotka', jednotka: j.id, volny: postup.jednotka(j.id).hotovo });
    return;
  }
  S.snimek = Math.max(0, n);
  vstupNaSnimek();
}
function ukazkaSnimku() { return S.obrazovka === 'lekce' ? S.jednotka.lekce[S.snimek].ukazka : null; }
function vstupNaSnimek() {
  zastav(); zrusCasovac(); hraje = new Set();
  const u = ukazkaSnimku();
  S.znacky = u ? znackyUkazky(u) : {};
  render();
  if (u) casovac = setTimeout(hrajUkazku, 500);
}
function znackyUkazky(u) {
  const z = {};
  if (u.stupnice) {
    const tony = u.jenNahoru ? stupnice(u.stupnice, u.druh) : stupniceNahoruDolu(u.stupnice, u.druh);
    tony.forEach((t) => { z[midi(t)] = { barva: 'zvyr', text: jmeno(t) }; });
  } else {
    u.tony.flat().forEach((s) => { z[tonZRetezce(s)] = { barva: 'zvyr', text: s.replace(/\d$/, '') }; });
  }
  return z;
}
function hrajUkazku() {
  const u = ukazkaSnimku(); if (!u) return;
  const sled = u.stupnice
    ? (u.jenNahoru ? stupnice(u.stupnice, u.druh) : stupniceNahoruDolu(u.stupnice, u.druh)).map(midi)
    : u.tony.map((x) => (Array.isArray(x) ? x.map(tonZRetezce) : tonZRetezce(x)));
  prehrajSled(sled);
}
function ukazStupnici(idT, druh) {
  zastav();
  const tony = stupniceNahoruDolu(idT, druh || undefined);
  S.znacky = Object.fromEntries(tony.map((t) => [midi(t), { barva: 'zvyr', text: jmeno(t) }]));
  render();
  prehrajSled(tony.map(midi));
}

// ---------- trénink ----------
function zacniTrenink(nast) {
  zastav(); zrusCasovac();
  S = { obrazovka: 'trenink', ...nast, poradi: 0, znovu: [], posledni: [], spravne: 0, chyby: 0, nove: [], zapomenute: [] };
  if (nast.druh === 'zkouska') {
    const povinne = JEDNOTKY.map((j) => nahodny(j.polozky));
    const ostatni = zamichej(VSECHNY_POLOZKY.filter((p) => !povinne.includes(p))).slice(0, DELKA_ZKOUSKY - povinne.length);
    S.planZkousky = zamichej([...povinne, ...ostatni]);
  }
  dalsiOtazka(true);
}
function delkaSezeni() { return S.druh === 'zkouska' ? S.planZkousky.length : S.druh === 'oprava' ? Math.max(DELKA_SEZENI, 1) : DELKA_SEZENI; }

function vyberPolozku() {
  if (S.druh === 'zkouska') return S.planZkousky[S.poradi];
  const due = S.znovu.findIndex((z) => z.kdy <= S.poradi);
  if (due >= 0) return S.znovu.splice(due, 1)[0].id;
  const neopakuj = (seznam) => { const f = seznam.filter((x) => !S.posledni.includes(x)); return f.length ? f : seznam; };
  const nejslabsi = (seznam) => {
    const min = Math.min(...seznam.map((x) => postup.polozka(x).s));
    return nahodny(seznam.filter((x) => postup.polozka(x).s === min));
  };
  if (S.druh === 'oprava') { const sl = postup.slabaMista(); return sl.length ? nejslabsi(neopakuj(sl)) : null; }
  if (S.druh === 'udrzba') {
    // nejdéle neviděné a chybové mají přednost
    const vse = [...VSECHNY_POLOZKY].sort((a, b) => postup.polozka(a).t - postup.polozka(b).t);
    return nahodny(neopakuj(Math.random() < 0.3 ? vse.filter((x) => postup.polozka(x).ch > 0).slice(0, 15) : vse.slice(0, 20)).filter(Boolean)) || nahodny(vse);
  }
  // jednotka
  const j = JEDNOTKY.find((x) => x.id === S.jednotka);
  const nezvladnute = j.polozky.filter((x) => !postup.zvladnuta(x));
  if (S.volny) { // opakování hotové jednotky
    return nezvladnute.length ? nejslabsi(neopakuj(nezvladnute)) : nahodny(neopakuj(j.polozky));
  }
  if (!nezvladnute.length) return null;
  const slaba = postup.slabaMista().filter((x) => jednotkaPolozky[x] !== j.id);
  const r = Math.random();
  if (slaba.length && r < 0.3) return nahodny(neopakuj(slaba));
  const starsi = VSECHNY_POLOZKY.filter((x) => postup.jednotka(jednotkaPolozky[x]).hotovo && postup.zvladnuta(x));
  if (starsi.length && r > 0.86) return [...starsi].sort((a, b) => postup.polozka(a).t - postup.polozka(b).t)[0];
  return nejslabsi(neopakuj(nezvladnute));
}

function jednotkaDokoncena() {
  if (S.druh !== 'jednotka' || S.volny) return false;
  const j = JEDNOTKY.find((x) => x.id === S.jednotka);
  return j.polozky.every(postup.zvladnuta);
}

function dalsiOtazka(prvni) {
  zastav(); zrusCasovac(); hraje = new Set();
  if (!prvni) S.poradi++;
  if (jednotkaDokoncena() && !S.znovu.length) {
    postup.jednotka(S.jednotka).hotovo = true; postup.uloz();
    return ukazSouhrn(true);
  }
  if (S.druh === 'oprava' && !postup.slabaMista().length) return ukazSouhrn();
  if (S.poradi >= delkaSezeni()) return ukazSouhrn();
  const id = vyberPolozku();
  if (!id) return ukazSouhrn();
  S.posledni = [id, ...S.posledni].slice(0, 2);
  S.cviceni = vytvor(id);
  S.stav = 'ceka'; S.zadano = []; S.vybrano = null; S.zprava = null;
  S.opakovani = jednotkaPolozky[id] !== S.jednotka && S.druh === 'jednotka';
  render();
  if (S.cviceni.autoPrehraj) casovac = setTimeout(() => prehrajSled(S.cviceni.prehraj, { tempo: 0.7 }), 450);
}

function odpovez(volba) {
  if (S.obrazovka !== 'trenink' || S.stav !== 'ceka' || S.cviceni.typ !== 'volba') return;
  S.vybrano = volba;
  vyhodnot(volba === S.cviceni.spravne);
}

export function klavesa(m) {
  odemkni();
  hrajTon(m);
  stisknute.add(m); render();
  setTimeout(() => { stisknute.delete(m); render(); }, 220);
  if (S.obrazovka !== 'trenink' || S.stav !== 'ceka' || S.cviceni.typ !== 'klavesy') return;
  if (S.cviceni.sluch) zastav();
  const c = S.cviceni, i = S.zadano.length;
  const ok = tridaTonu(m) === c.ocekavane[i];
  S.zadano.push({ m, ok, text: ok ? c.jmena[i] : '✗' });
  if (!ok) return vyhodnot(false);
  if (S.zadano.length === c.ocekavane.length) return vyhodnot(true);
  render();
}

function vyhodnot(spravne) {
  const c = S.cviceni;
  S.stav = 'vyhodnoceno';
  const r = S.druh === 'zkouska' && !spravne
    ? postup.zapis(c.id, false)
    : postup.zapis(c.id, spravne);
  if (r.zvladnuta) S.nove.push(c.id);
  if (r.zapomenuta) S.zapomenute.push(c.id);
  if (spravne) {
    S.spravne++;
    S.zprava = { typ: 'ok', text: nahodny(POCHVALY) + (r.zvladnuta ? ' ⭐ Zvládnuto!' : '') };
    znelka.dobre();
    if (c.typ === 'klavesy' && c.ocekavane.length > 1) { /* celá stupnice: nech dozvít */ }
    casovac = setTimeout(dalsiOtazka, c.typ === 'klavesy' && c.ocekavane.length > 1 ? 1600 : 1200);
  } else {
    S.chyby++;
    S.zprava = { typ: 'chyba', text: c.vysvetleni };
    znelka.spatne();
    if (S.druh !== 'zkouska') S.znovu.push({ id: c.id, kdy: S.poradi + 3 });
    casovac = setTimeout(() => prehrajSled(c.ukaz.sled), 500);
  }
  render();
}

function ukazSouhrn(jednotkaHotova) {
  zastav(); zrusCasovac();
  const prev = S;
  S = { obrazovka: 'souhrn', prev, jednotkaHotova };
  if (prev.druh === 'zkouska') {
    postup.P.zkouska.pokusy++;
    if (prev.chyby <= MAX_CHYB_ZKOUSKY) postup.P.zkouska.splnena = true;
    postup.uloz();
    S.zkouskaOk = prev.chyby <= MAX_CHYB_ZKOUSKY;
  }
  if (jednotkaHotova || S.zkouskaOk || postup.kurzHotov()) znelka.hotovo();
  render();
}

// ---------- model obrazovky ----------
function klaviatura(znacky = {}, popisky = postup.P.nast.popisky) {
  return { znacky, popisky, hraje: [...hraje], stisknute: [...stisknute] };
}
const pct = (x) => Math.round(x * 100) + ' %';

function model() {
  const o = S.obrazovka;
  if (o === 'domu') return modelDomu();
  if (o === 'lekce') {
    const j = S.jednotka, sn = j.lekce[S.snimek], posl = S.snimek === j.lekce.length - 1;
    return {
      obrazovka: o, nadpis: `${j.ikona} ${j.nazev}`, stitek: `📖 Lekce · ${S.snimek + 1}/${j.lekce.length}`,
      pokrok: { hodnota: (S.snimek + 1) / j.lekce.length },
      odstavce: sn.text,
      tlacitka: [
        ...(S.snimek > 0 ? [{ id: 'snimek:-1', text: '◀ Zpět' }] : [{ id: 'domu', text: '🏠' }]),
        ...(sn.ukazka ? [{ id: 'ukazka', text: '▶ Přehrát ukázku' }] : []),
        { id: 'snimek:1', text: posl ? 'Jdeme trénovat 🎹' : 'Další ▶', styl: 'hlavni' },
      ],
      klaviatura: klaviatura(S.znacky, true),
    };
  }
  if (o === 'trenink') return modelTreninku();
  if (o === 'souhrn') return modelSouhrnu();
  if (o === 'hrani') {
    return {
      obrazovka: o, nadpis: '🎹 Volné hraní', odstavce: ['Hraj, co chceš. Můžeš si nechat zahrát libovolnou stupnici:'],
      vyber: [
        ...DUR.map((t) => ({ id: `stupnice:${t}-dur|`, text: `${t} dur`, skupina: 'Dur' })),
        ...MOLL.map((t) => ({ id: `stupnice:${t}-moll|aiolska`, text: `${t} moll`, skupina: 'Moll přirozená' })),
        ...MOLL.map((t) => ({ id: `stupnice:${t}-moll|harmonicka`, text: `${t} moll`, skupina: 'Moll harmonická' })),
        ...MOLL.map((t) => ({ id: `stupnice:${t}-moll|melodicka`, text: `${t} moll`, skupina: 'Moll melodická' })),
      ],
      tlacitka: [{ id: 'domu', text: '🏠 Domů' }],
      klaviatura: klaviatura(S.znacky || {}, true),
    };
  }
  if (o === 'nastaveni') {
    const P = postup.P;
    return {
      obrazovka: o, nadpis: '⚙️ Nastavení a přehled',
      odstavce: [`Odpovědí celkem: ${P.odpovedi}. Zvládnuto ${pct(postup.celkovyPodil())} kurzu. Závěrečná zkouška: ${P.zkouska.splnena ? 'splněná ✅' : P.zkouska.pokusy ? `zatím nesplněná (pokusů ${P.zkouska.pokusy})` : 'ještě nebyla'}.`,
        ...(P.chyby.length ? ['Poslední chyby: ' + [...new Set(P.chyby.slice(0, 12).map((c) => popisPolozky(c.id)))].join(', ') + '.'] : [])],
      tlacitka: [
        { id: 'popisky', text: `Názvy na klávesách: ${P.nast.popisky ? 'ano' : 'ne'}` },
        { id: 'zvuk', text: `Zvuk: ${P.nast.zvuk ? 'zapnutý 🔊' : 'vypnutý 🔇'}` },
        { id: 'smazat', text: '🗑 Smazat postup', styl: 'nebezpecne' },
        { id: 'domu', text: '🏠 Domů', styl: 'hlavni' },
      ],
      klaviatura: klaviatura(),
    };
  }
  if (o === 'smazat') {
    return { obrazovka: o, nadpis: 'Opravdu smazat celý postup?', odstavce: ['Kurz začne znovu od první lekce. Nejde to vrátit.'],
      tlacitka: [{ id: 'nastaveni', text: 'Ne, nechat' }, { id: 'smazat-ano', text: 'Ano, smazat', styl: 'nebezpecne' }], klaviatura: klaviatura() };
  }
  return { obrazovka: o, nadpis: '', klaviatura: klaviatura() };
}

export function popisPolozky(id) {
  const [t, a, b] = id.split(':');
  const n = (x) => (x || '').replace('-', ' ');
  return { bila: `tón ${a}`, cerna: `tón ${a}`, pul: 'půltón / celý tón', hraj: `hrát ${n(a)}${b ? ' ' + DRUHY[b].nazev.split(' ')[0] : ''}`,
    predz: `předznamenání ${n(a)}`, ton: `tóny ${n(a)}${b ? ' ' + DRUHY[b].nazev.split(' ')[0] : ''}`, 'pultony-dur': 'půltóny v dur',
    'druh-moll': 'druhy moll', paral: `paralelní k ${n(a)}`, sluch: `sluchem ${a}`, 'sluch-dm': `sluchem dur/moll (${a})`, 'sluch-druh': 'sluchem druhy moll' }[t];
}

function modelDomu() {
  const akt = postup.aktualniJednotka();
  const slaba = postup.slabaMista();
  let dalsi;
  if (akt) dalsi = postup.jednotka(akt.id).lekce ? `🎹 Trénink: ${akt.nazev}` : `📖 Lekce: ${akt.nazev}`;
  else if (slaba.length) dalsi = `🔁 Opravit slabá místa (${slaba.length})`;
  else if (!postup.P.zkouska.splnena) dalsi = '🎓 Závěrečná zkouška';
  else dalsi = '🔁 Udržovací trénink';
  const hotovo = postup.kurzHotov();
  return {
    obrazovka: 'domu', nadpis: '🎹 Stupnice a sluch', stitek: 'Příprava na talentové zkoušky',
    pokrok: { hodnota: postup.celkovyPodil(), text: `Zvládnuto ${pct(postup.celkovyPodil())} kurzu` },
    odstavce: hotovo ? ['🎓 Celý kurz je zvládnutý, včetně závěrečné zkoušky! Udržovací trénink pomůže, ať to nezapadne.'] : [],
    tlacitka: [{ id: 'pokracovat', text: dalsi, styl: 'hlavni velke' }],
    seznam: JEDNOTKY.map((j) => {
      const st = postup.stavJednotky(j), ju = postup.jednotka(j.id);
      const odemcena = ju.hotovo || j === akt;
      return { id: j.id, ikona: j.ikona, nazev: j.nazev, hodnota: st.podil, text: `${st.hotovych}/${st.celkem}`,
        stav: ju.hotovo ? (j.polozky.every(postup.zvladnuta) ? 'hotovo' : 'slabe') : j === akt ? 'aktualni' : 'zamceno', odemcena };
    }),
    dole: [{ id: 'hrani', text: '🎹 Volné hraní' }, { id: 'nastaveni', text: '⚙️ Nastavení' }],
    klaviatura: klaviatura(),
  };
}

function modelTreninku() {
  const c = S.cviceni;
  const nazvy = { jednotka: '🎹 Trénink', oprava: '🔁 Slabá místa', zkouska: '🎓 Závěrečná zkouška', udrzba: '🔁 Udržovací trénink' };
  const j = S.jednotka && JEDNOTKY.find((x) => x.id === S.jednotka);
  let znacky = { ...(c.znacky || {}) };
  let radek = c.radek ? c.radek.map((x) => ({ ...x })) : null;
  if (c.typ === 'klavesy' && c.ocekavane.length > 1) {
    radek = c.ocekavane.map((_, i) => (S.zadano[i] ? { text: S.zadano[i].text, stav: S.zadano[i].ok ? 'ok' : 'chyba' } : { text: '·', stav: i === S.zadano.length && S.stav === 'ceka' ? 'aktivni' : '' }));
  }
  S.zadano.forEach((z) => { znacky[z.m] = { barva: z.ok ? 'ok' : 'chyba', text: z.ok ? z.text : '' }; });
  if (S.stav === 'vyhodnoceno' && S.zprava.typ === 'chyba') {
    znacky = { ...c.ukaz.znacky };
    S.zadano.filter((z) => !z.ok).forEach((z) => { znacky[z.m] = { barva: 'chyba', text: '✗' }; });
    if (radek && c.ocekavane) radek = c.jmena.map((t, i) => ({ text: t, stav: S.zadano[i]?.ok ? 'ok' : 'oprava' }));
    if (radek && c.typ === 'volba' && c.radek) radek = c.radek.map((x) => (x.stav === 'aktivni' ? { text: c.spravne, stav: 'oprava' } : x));
  }
  if (S.stav === 'vyhodnoceno' && S.zprava.typ === 'ok' && c.radek && c.typ === 'volba') radek = c.radek.map((x) => (x.stav === 'aktivni' ? { text: c.spravne, stav: 'ok' } : x));
  const moznosti = c.moznosti?.map((m) => ({ ...m, stav: S.stav === 'vyhodnoceno' ? (m.id === c.spravne ? 'ok' : m.id === S.vybrano ? 'chyba' : 'tlumeno') : '' }));
  const tl = [{ id: 'domu', text: '🏠' }];
  if (c.prehraj || (S.stav === 'vyhodnoceno' && c.ukaz.sled)) tl.push({ id: 'prehraj', text: '▶ Přehrát' + (c.sluch && S.stav === 'ceka' ? ' znovu' : '') });
  if (S.stav === 'vyhodnoceno') tl.push({ id: 'dalsi', text: S.zprava.typ === 'ok' ? 'Další ▶' : 'Rozumím, další ▶', styl: 'hlavni' });
  const delka = delkaSezeni();
  return {
    obrazovka: 'trenink',
    nadpis: nazvy[S.druh] + (j && S.druh === 'jednotka' ? `: ${j.nazev}` : ''),
    stitek: S.opakovani ? '🔁 opakování' : `${Math.min(S.poradi + 1, delka)}/${delka}`,
    pokrok: { hodnota: S.poradi / delka },
    zadani: c.zadani, napoveda: S.stav === 'ceka' ? c.napoveda : null,
    radek, moznosti, zprava: S.zprava, tlacitka: tl,
    ceka: S.stav === 'ceka' && c.typ === 'klavesy',
    klaviatura: klaviatura(znacky, c.popisky && postup.P.nast.popisky),
  };
}

function modelSouhrnu() {
  const p = S.prev, j = p.jednotka && JEDNOTKY.find((x) => x.id === p.jednotka);
  const odst = [`Správně ${p.spravne} z ${p.spravne + p.chyby}.`];
  if (p.nove.length) odst.push(`⭐ Nově zvládnuto: ${p.nove.map(popisPolozky).join(', ')}.`);
  if (p.zapomenute.length) odst.push(`🔁 K zopakování: ${p.zapomenute.map(popisPolozky).join(', ')}.`);
  let nadpis = 'Kolo hotové';
  if (S.jednotkaHotova) {
    nadpis = `🎉 Hotovo: ${j.nazev}`;
    const dalsi = postup.aktualniJednotka();
    odst.push(dalsi ? `Další na řadě: ${dalsi.nazev}.` : 'Všechny lekce máš za sebou. Teď už jen opravit slabá místa a závěrečná zkouška!');
  } else if (p.druh === 'zkouska') {
    nadpis = S.zkouskaOk ? '🎓 Zkouška splněná!' : 'Zkouška tentokrát nevyšla';
    odst.push(S.zkouskaOk ? (postup.slabaMista().length ? 'Pár chyb se ještě musí dopilovat, pak je kurz hotový.' : 'Celý kurz je zvládnutý. Gratuluju!') : `Povolené jsou nejvýš ${MAX_CHYB_ZKOUSKY} chyby. Chybné položky se teď procvičí a pak to zkusíme znovu.`);
  } else if (j && p.druh === 'jednotka' && !p.volny) {
    const st = postup.stavJednotky(j);
    odst.push(`Lekce „${j.nazev}“: zvládnuto ${st.hotovych} z ${st.celkem}. Trénuje se, dokud nebude všechno.`);
  }
  if (postup.kurzHotov()) odst.push('🎓 Celý kurz je zvládnutý!');
  const tl = [{ id: 'domu', text: '🏠 Domů' }];
  if (j && !S.jednotkaHotova && p.druh === 'jednotka') tl.push({ id: `lekce:${j.id}`, text: '📖 Zopakovat lekci' });
  tl.push({ id: 'pokracovat', text: 'Pokračovat ▶', styl: 'hlavni' });
  return { obrazovka: 'souhrn', nadpis, odstavce: odst, tlacitka: tl, pokrok: { hodnota: postup.celkovyPodil(), text: `Celý kurz: ${pct(postup.celkovyPodil())}` }, klaviatura: klaviatura() };
}

export function start() {
  nastavZtlumeni(!postup.P.nast.zvuk);
  const q = new URLSearchParams(location.search);
  if (q.get('lekce')) otevriLekci(q.get('lekce'));
  else render();
}

// Pro testy (Playwright)
window.__klavir = { akce, klavesa, get S() { return S; }, postup, model };
