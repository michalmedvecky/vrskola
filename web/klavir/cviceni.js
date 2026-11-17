// Generátor cvičení: z id položky („hraj:D-dur“, „sluch:fis“…) udělá jedno konkrétní zadání.
// Cvičení je buď „volba“ (tlačítka s možnostmi), nebo „klavesy“ (odpověď se hraje na klaviatuře).
import {
  midi, jmeno, zJmena, velke, tridaTonu, jmenaKlavesy, stupnice, stupniceNahoruDolu, predznamenani, popisPredznamenani,
  kratkePredz, paralelni, nazevToniny, tonina, kvintakord, DUR, MOLL, DRUHY, zamichej, nahodny,
} from './hudba.js';

export const ROZSAH = [60, 84]; // c1–c3
export function tonZRetezce(s) { // 'cis1' → MIDI
  const m = /^([a-z]+)(\d)$/.exec(s);
  return midi({ ...zJmena(m[1]), o: +m[2] });
}
const RIMSKE = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const BILE = ['c', 'd', 'e', 'f', 'g', 'a', 'h'];
const volby = (texty) => zamichej([...new Set(texty)]).map((t) => ({ id: t, text: t }));
const doplnDo = (spravne, kandidati, n = 4) => {
  const out = [spravne];
  for (const k of zamichej(kandidati)) { if (out.length >= n) break; if (!out.includes(k)) out.push(k); }
  return out;
};
// pad: 1 = která (harmonická), 4 = zahraj (harmonickou), 6 = v (harmonické)
const TVARY = { aiolska: ['přirozená (aiolská)', 'přirozenou (aiolskou)', 'přirozené (aiolské)'], harmonicka: ['harmonická', 'harmonickou', 'harmonické'], melodicka: ['melodická', 'melodickou', 'melodické'] };
const nazevDruhu = (id, druh, pad = 1) => nazevToniny(id) + (druh && druh !== 'dur' ? ' ' + TVARY[druh][{ 1: 0, 4: 1, 6: 2 }[pad]] : '');
function znackyStupnice(tony) {
  const z = {};
  tony.forEach((t) => { z[midi(t)] = { barva: 'zvyr', text: jmeno(t) }; });
  return z;
}
// Kde na klaviatuře ukázat tón dané třídy (náhodně v jedné ze dvou oktáv).
function nahodnaPoloha(pc) { const o = Math.random() < 0.5 ? 60 : 72; return o + pc; }

export function vytvor(id) {
  const [typ, a, b] = id.split(':');
  const c = GEN[typ](a, b);
  c.id = id;
  return c;
}

const GEN = {
  // Bílé klávesy: najdi / pojmenuj
  bila(t) {
    const pc = tridaTonu(midi({ ...zJmena(t), o: 1 }));
    if (Math.random() < 0.5) {
      return { typ: 'klavesy', zadani: `Najdi na klaviatuře tón ${t}.`, ocekavane: [pc], jmena: [t], popisky: false,
        vysvetleni: `Tón ${t}: ${t === 'c' ? 'vlevo od dvojice černých kláves' : t === 'f' ? 'vlevo od trojice černých kláves' : 'počítej od c: c, d, e, f, g, a, h'}.`,
        ukaz: { znacky: { [60 + pc]: { barva: 'ok', text: t }, [72 + pc]: { barva: 'ok', text: t } }, sled: [60 + pc] } };
    }
    const m = nahodnaPoloha(pc);
    return { typ: 'volba', zadani: 'Jak se jmenuje zvýrazněná klávesa?', popisky: false, znacky: { [m]: { barva: 'zvyr', text: '?' } },
      moznosti: volby(doplnDo(t, BILE.filter((x) => x !== t))), spravne: t,
      vysvetleni: `Je to ${t}.`, ukaz: { znacky: { [m]: { barva: 'ok', text: t } }, sled: [m] } };
  },
  // Černé klávesy: dvě jména
  cerna(t) {
    const tn = zJmena(t), pc = tridaTonu(midi({ ...tn, o: 1 }));
    const krizek = tn.a > 0;
    const druhe = jmenaKlavesy(pc).find((x) => x !== t);
    if (Math.random() < 0.5) {
      return { typ: 'klavesy', zadani: `Najdi na klaviatuře tón ${t}.`, ocekavane: [pc], jmena: [t], popisky: true,
        vysvetleni: `${t} = ${krizek ? 'zvýšené' : 'snížené'} ${BILE[tn.l]} (${krizek ? 'o půltón výš' : 'o půltón níž'}). Stejná klávesa se jmenuje i ${druhe}.`,
        ukaz: { znacky: { [60 + pc]: { barva: 'ok', text: t }, [72 + pc]: { barva: 'ok', text: t } }, sled: [60 + pc] } };
    }
    const m = nahodnaPoloha(pc);
    const stejny = (krizek ? ['cis', 'dis', 'fis', 'gis', 'ais'] : ['des', 'es', 'ges', 'as', 'b']).filter((x) => x !== t);
    return { typ: 'volba', zadani: `Jak se jmenuje zvýrazněná klávesa, když ji píšeš ${krizek ? 's křížkem ♯' : 's béčkem ♭'}?`, popisky: true,
      znacky: { [m]: { barva: 'zvyr', text: '?' } },
      moznosti: volby([t, druhe, ...zamichej(stejny).slice(0, 2)]), spravne: t,
      vysvetleni: `${krizek ? 'S křížkem' : 'S béčkem'} je to ${t}, ${krizek ? 's béčkem' : 's křížkem'} ${druhe}.`,
      ukaz: { znacky: { [m]: { barva: 'ok', text: t } }, sled: [m] } };
  },
  pul() {
    const vzd = Math.random() < 0.5 ? 1 : 2;
    const dolni = 60 + Math.floor(Math.random() * 20);
    const horni = dolni + vzd;
    const sp = vzd === 1 ? 'Půltón' : 'Celý tón';
    return { typ: 'volba', zadani: 'Je mezi zvýrazněnými klávesami půltón, nebo celý tón?', popisky: true,
      znacky: { [dolni]: { barva: 'zvyr' }, [horni]: { barva: 'zvyr' } }, prehraj: [dolni, horni],
      moznosti: [{ id: 'Půltón', text: 'Půltón' }, { id: 'Celý tón', text: 'Celý tón' }], spravne: sp,
      vysvetleni: vzd === 1 ? 'Jsou to sousední klávesy, mezi nimi už žádná není: půltón.' : 'Mezi nimi leží ještě jedna klávesa, takže jsou to dva půltóny = celý tón.',
      ukaz: { znacky: { [dolni]: { barva: 'ok' }, [dolni + 1]: { barva: vzd === 2 ? 'chyba' : 'ok' }, [horni]: { barva: 'ok' } }, sled: [dolni, horni] } };
  },
  // Zahraj stupnici
  hraj(idT, druh) {
    const tony = stupniceNahoruDolu(idT, druh);
    const nazev = nazevDruhu(idT, druh, 4);
    const dolu = druh === 'melodicka';
    return { typ: 'klavesy', zadani: `Zahraj ${nazev}${dolu ? ' nahoru a zase dolů' : ' nahoru'}.`, popisky: true,
      napoveda: `Začni na tónice ${jmeno(tony[0])}.`, ocekavane: tony.map((t) => tridaTonu(midi(t))), jmena: tony.map(jmeno),
      vysvetleni: `${nazevDruhu(idT, druh)}: ${tony.map(jmeno).join(' – ')}`,
      ukaz: { znacky: znackyStupnice(tony), sled: tony.map(midi) } };
  },
  // Předznamenání durové tóniny
  predz(idT) {
    const p = predznamenani(idT), nazev = nazevToniny(idT);
    const varianta = Math.floor(Math.random() * 3);
    const vysv = `${nazev}: ${popisPredznamenani(p)}${p.pocet ? ' (' + p.tony.join(', ') + ')' : ''}.`;
    const ukaz = { znacky: znackyStupnice(stupnice(idT)), sled: stupnice(idT).map(midi) };
    if (varianta === 0 || p.pocet === 0) {
      const kand = [];
      for (let n = 0; n <= 7; n++) for (const z of ['♯', '♭']) if (Math.abs(n - p.pocet) <= 2) kand.push(kratkePredz({ pocet: n, znak: z }));
      return { typ: 'volba', zadani: `Kolik předznamenání má ${nazev}?`, popisky: true,
        moznosti: volby(doplnDo(kratkePredz(p), kand.filter((x) => x !== kratkePredz(p)))), spravne: kratkePredz(p), vysvetleni: vysv, ukaz };
    }
    if (varianta === 1) {
      const kand = DUR.filter((t) => t + '-dur' !== idT).map((t) => t + ' dur');
      const blizke = kand.filter((n) => { const q = predznamenani(n.replace(' ', '-')); return q.znak === p.znak || q.pocet === p.pocet; });
      return { typ: 'volba', zadani: `Která durová stupnice má ${popisPredznamenani(p)}?`, popisky: true,
        moznosti: volby(doplnDo(nazev, blizke)), spravne: nazev, vysvetleni: vysv, ukaz };
    }
    const sp = p.tony.join(', ');
    const rada = p.znak === '♯' ? ['fis', 'cis', 'gis', 'dis', 'ais', 'eis', 'his'] : ['b', 'es', 'as', 'des', 'ges', 'ces', 'fes'];
    const kand = [rada.slice(0, p.pocet + 1).join(', '), rada.slice(0, Math.max(1, p.pocet - 1)).join(', '), rada.slice(1, p.pocet + 1).join(', '),
      (p.znak === '♯' ? ['b', 'es', 'as', 'des', 'ges', 'ces', 'fes'] : ['fis', 'cis', 'gis', 'dis', 'ais', 'eis', 'his']).slice(0, p.pocet).join(', ')];
    return { typ: 'volba', zadani: `Které tóny jsou v ${nazev} ${p.znak === '♯' ? 'zvýšené křížkem' : 'snížené béčkem'}?`, popisky: true,
      moznosti: volby(doplnDo(sp, kand.filter((x) => x && x !== sp))), spravne: sp, vysvetleni: vysv, ukaz };
  },
  // Doplň chybějící tón stupnice (správný pravopis)
  ton(idT, druh) {
    const tony = stupnice(idT, druh);
    let i = druh === 'harmonicka' && Math.random() < 0.5 ? 6 : 1 + Math.floor(Math.random() * 6);
    const t = tony[i], sp = jmeno(t);
    const kand = new Set();
    for (const d of [-1, 1]) if (Math.abs(t.a + d) <= 2) kand.add(jmeno({ l: t.l, a: t.a + d }));
    for (const dl of [-1, 1]) { // stejná klávesa, jiné písmeno
      const l = (t.l + dl + 7) % 7;
      const cil = midi({ ...t, o: 4 }), zakl = midi({ l, a: 0, o: 4 }) + (dl > 0 && l < t.l ? 12 : 0) - (dl < 0 && l > t.l ? 12 : 0);
      const a = cil - zakl; if (Math.abs(a) <= 2) kand.add(jmeno({ l, a }));
    }
    kand.delete(sp);
    const nazev = nazevDruhu(idT, druh, 6);
    const radek = tony.map((x, j) => ({ text: j === i ? '?' : jmeno(x), stav: j === i ? 'aktivni' : '' }));
    return { typ: 'volba', zadani: `Který tón chybí v ${nazev}?`, radek, popisky: true, rimske: true,
      napoveda: `Hledáme ${RIMSKE[i]}. stupeň.`,
      moznosti: volby(doplnDo(sp, [...kand])), spravne: sp,
      vysvetleni: `${RIMSKE[i]}. stupeň v ${nazev} je ${sp}. Každé písmeno je ve stupnici jen jednou: ${tony.map(jmeno).join(' – ')}.`,
      ukaz: { znacky: znackyStupnice(tony), sled: tony.map(midi) } };
  },
  'pultony-dur'() {
    const sp = 'III.–IV. a VII.–VIII.';
    return { typ: 'volba', zadani: 'Mezi kterými stupni durové stupnice jsou půltóny?', popisky: true,
      moznosti: volby([sp, 'II.–III. a V.–VI.', 'III.–IV. a VI.–VII.', 'IV.–V. a VII.–VIII.']), spravne: sp,
      vysvetleni: 'Vzorec dur: celý – celý – PŮL – celý – celý – celý – PŮL. V C dur jsou to e–f a h–c.',
      ukaz: { znacky: { 64: { barva: 'ok', text: 'III' }, 65: { barva: 'ok', text: 'IV' }, 71: { barva: 'ok', text: 'VII' }, 72: { barva: 'ok', text: 'VIII' } }, sled: [64, 65, 71, 72] } };
  },
  'druh-moll'() {
    const idT = nahodny(['a', 'e', 'd', 'h', 'g']) + '-moll';
    const druh = nahodny(['aiolska', 'harmonicka', 'melodicka']);
    const tony = stupnice(idT, druh);
    const nazvy = { aiolska: 'přirozená', harmonicka: 'harmonická', melodicka: 'melodická' };
    const tn = tonina(idT);
    return { typ: 'volba', zadani: `Která ${tn.nazev} je to (nahoru)?`, radek: tony.map((t) => ({ text: jmeno(t) })), popisky: true,
      znacky: znackyStupnice(tony), prehraj: tony.map(midi),
      moznosti: Object.values(nazvy).map((n) => ({ id: n, text: n })), spravne: nazvy[druh],
      vysvetleni: 'Přirozená: VI. i VII. stupeň podle předznamenání. Harmonická: zvýšený jen VII. Melodická: zvýšený VI. i VII.',
      ukaz: { znacky: znackyStupnice(tony), sled: tony.map(midi) } };
  },
  // Paralelní tónina / předznamenání molové stupnice
  paral(idT) {
    const par = paralelni(idT), nazev = nazevToniny(idT), nazevPar = nazevToniny(par);
    const p = predznamenani(idT);
    const vysv = `${nazev} a ${nazevPar} jsou paralelní: obě mají ${popisPredznamenani(p)}${p.pocet ? ' (' + p.tony.join(', ') + ')' : ''}. Moll leží o malou tercii (3 půltóny) pod dur.`;
    const ukaz = { znacky: znackyStupnice(stupnice(idT)), sled: stupnice(idT).map(midi) };
    const v = Math.floor(Math.random() * 3);
    if (v === 0) {
      const kand = MOLL.filter((t) => t + '-moll' !== idT).map((t) => t + ' moll');
      const blizke = kand.filter((n) => { const q = predznamenani(n.replace(' ', '-')); return Math.abs(q.pocet - p.pocet) <= 1 || q.znak === p.znak; });
      return { typ: 'volba', zadani: `Ke které molové stupnici je ${nazevPar} paralelní?`, popisky: true,
        moznosti: volby(doplnDo(nazev, blizke)), spravne: nazev, vysvetleni: vysv, ukaz };
    }
    if (v === 1) {
      const kand = DUR.filter((t) => t + '-dur' !== par).map((t) => t + ' dur');
      // typická chyba: dur se stejným písmenem (a moll → A dur) a o kvintu vedle
      const tn = tonina(idT);
      const zamena = velke(jmeno(tn.tonika)) + ' dur';
      return { typ: 'volba', zadani: `Jaká je paralelní durová stupnice k ${nazev}?`, popisky: true,
        moznosti: volby(doplnDo(nazevPar, [...(kand.includes(zamena) ? [zamena] : []), ...zamichej(kand).slice(0, 4)])), spravne: nazevPar, vysvetleni: vysv, ukaz };
    }
    const kand = [];
    for (let n = 0; n <= 7; n++) for (const z of ['♯', '♭']) if (Math.abs(n - p.pocet) <= 2) kand.push(kratkePredz({ pocet: n, znak: z }));
    return { typ: 'volba', zadani: `Kolik předznamenání má ${nazev}?`, popisky: true,
      moznosti: volby(doplnDo(kratkePredz(p), kand.filter((x) => x !== kratkePredz(p)))), spravne: kratkePredz(p), vysvetleni: vysv + ` Stejně jako ${nazevPar}.`, ukaz };
  },
  // Sluch: c1, pak hledaný tón; odpověď na klaviatuře
  sluch(t) {
    let m = midi({ ...zJmena(t), o: 1 });
    if (m === 60) m = 72; // c: oktáva nad záchytným c1
    const pc = tridaTonu(m);
    return { typ: 'klavesy', sluch: true, zadani: 'Nejdřív zazní c¹, potom hledaný tón. Ťukni na klávesu, kterou slyšíš.', popisky: true,
      prehraj: [60, m], autoPrehraj: true, ocekavane: [pc], jmena: [t],
      vysvetleni: `Byl to tón ${t}.`, ukaz: { znacky: { 60: { barva: 'zvyr', text: 'c' }, [m]: { barva: 'ok', text: t } }, sled: [60, m] } };
  },
  'sluch-dm'(varianta) {
    const rod = Math.random() < 0.5 ? 'dur' : 'moll';
    const koren = 57 + Math.floor(Math.random() * 12);
    let sled;
    if (varianta === 'akord') { const k = kvintakord(koren, rod); sled = [...k, k]; }
    else { const iv = DRUHY[rod === 'dur' ? 'dur' : 'aiolska'].intervaly; sled = iv.map((i) => koren + i); }
    const sp = rod === 'dur' ? 'Dur' : 'Moll';
    return { typ: 'volba', sluch: true, zadani: varianta === 'akord' ? 'Poslouchej kvintakord. Je durový, nebo molový?' : 'Poslouchej stupnici. Je durová, nebo molová?', popisky: true,
      prehraj: sled, autoPrehraj: true,
      moznosti: [{ id: 'Dur', text: 'Dur ☀️' }, { id: 'Moll', text: 'Moll 🌙' }], spravne: sp,
      vysvetleni: rod === 'dur' ? 'Byla to dur: velká tercie (4 půltóny) od základního tónu, zní jasně.' : 'Byla to moll: malá tercie (3 půltóny) od základního tónu, zní tmavěji.',
      ukaz: { znacky: Object.fromEntries([koren, koren + (rod === 'dur' ? 4 : 3), koren + 7].filter((m) => m >= 60 && m <= 84).map((m) => [m, { barva: 'ok' }])), sled } };
  },
  'sluch-druh'() {
    const idT = nahodny(MOLL) + '-moll';
    const druh = nahodny(['aiolska', 'harmonicka', 'melodicka']);
    const tony = stupnice(idT, druh);
    const nazvy = { aiolska: 'přirozená', harmonicka: 'harmonická', melodicka: 'melodická' };
    return { typ: 'volba', sluch: true, zadani: 'Poslouchej molovou stupnici. Která to je?', popisky: true,
      prehraj: tony.map(midi), autoPrehraj: true,
      moznosti: Object.values(nazvy).map((n) => ({ id: n, text: n })), spravne: nazvy[druh],
      vysvetleni: `Byla to ${nazevDruhu(idT, druh)}: ${tony.map(jmeno).join(' – ')}.`,
      ukaz: { znacky: znackyStupnice(tony), sled: tony.map(midi) } };
  },
};
