// Hudební teorie: české názvy tónů, stavba stupnic, předznamenání, paralelní tóniny.
// Tón = { l: písmeno 0–6 (c d e f g a h), a: posuvka −2…+2, o: oktáva (1 = jednočárková, c1 = MIDI 60) }.

export const PISMENA = ['c', 'd', 'e', 'f', 'g', 'a', 'h'];
const ZAKLAD = [0, 2, 4, 5, 7, 9, 11];

export function midi(t) { return 60 + (t.o - 1) * 12 + ZAKLAD[t.l] + t.a; }
export const tridaTonu = (m) => ((m % 12) + 12) % 12;
export function frekvence(m) { return 440 * Math.pow(2, (m - 69) / 12); }

// Český název tónu: cis, dis, es, as, b, ces, fes, cisis, heses…
export function jmeno(t) {
  const p = PISMENA[t.l];
  if (t.a === 0) return p;
  if (t.a > 0) return p + 'is'.repeat(t.a);
  if (p === 'h') return t.a === -1 ? 'b' : 'heses';
  if (p === 'e') return t.a === -1 ? 'es' : 'eses';
  if (p === 'a') return t.a === -1 ? 'as' : 'asas';
  return p + 'es'.repeat(-t.a);
}
export const velke = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Rozbor názvu tónu („fis“, „b“, „es“) zpět na písmeno a posuvku.
export function zJmena(s) {
  s = s.toLowerCase();
  const zvl = { b: [6, -1], es: [2, -1], as: [5, -1], heses: [6, -2], eses: [2, -2], asas: [5, -2] };
  if (zvl[s]) return { l: zvl[s][0], a: zvl[s][1] };
  const l = PISMENA.indexOf(s[0]);
  const zbytek = s.slice(1);
  if (!zbytek) return { l, a: 0 };
  if (/^(is)+$/.test(zbytek)) return { l, a: zbytek.length / 2 };
  if (/^(es)+$/.test(zbytek)) return { l, a: -zbytek.length / 2 };
  throw new Error('Neznámý tón ' + s);
}

// Všechny pojmenování jedné klávesy (pro odpovědi „černá klávesa = cis i des“).
const JMENA_TRID = [['c', 'his'], ['cis', 'des'], ['d'], ['dis', 'es'], ['e', 'fes'], ['f', 'eis'], ['fis', 'ges'], ['g'], ['gis', 'as'], ['a'], ['ais', 'b'], ['h', 'ces']];
export function jmenaKlavesy(m) { return JMENA_TRID[tridaTonu(m)]; }
export const jeCerna = (m) => [1, 3, 6, 8, 10].includes(tridaTonu(m));

export const DRUHY = {
  dur: { intervaly: [0, 2, 4, 5, 7, 9, 11, 12], nazev: '' },
  aiolska: { intervaly: [0, 2, 3, 5, 7, 8, 10, 12], nazev: 'přirozená (aiolská)' },
  harmonicka: { intervaly: [0, 2, 3, 5, 7, 8, 11, 12], nazev: 'harmonická' },
  melodicka: { intervaly: [0, 2, 3, 5, 7, 9, 11, 12], nazev: 'melodická' },
};

// Tóniny: id „D-dur“, „fis-moll“. Pořadí podle kvintového kruhu.
export const DUR = ['C', 'G', 'D', 'A', 'E', 'H', 'Fis', 'Cis', 'F', 'B', 'Es', 'As', 'Des', 'Ges', 'Ces'];
export const MOLL = ['a', 'e', 'h', 'fis', 'cis', 'gis', 'dis', 'ais', 'd', 'g', 'c', 'f', 'b', 'es', 'as'];

export function tonina(id) {
  const [t, rod] = id.split('-');
  const tonika = zJmena(t);
  return { id, tonika, rod, nazev: (rod === 'dur' ? velke(jmeno(tonika)) : jmeno(tonika)) + ' ' + rod };
}
export function nazevToniny(id) { return tonina(id).nazev; }

// Stupnice od toniky nahoru (8 tónů) v klávesovém rozsahu c1–c3.
export function stupnice(id, druh) {
  const tn = tonina(id);
  if (!druh) druh = tn.rod === 'dur' ? 'dur' : 'aiolska';
  let o = 1;
  if (midi({ ...tn.tonika, o }) < 60) o = 2;
  const zaklad = midi({ ...tn.tonika, o });
  return DRUHY[druh].intervaly.map((iv, i) => {
    const l = (tn.tonika.l + i) % 7;
    const oo = o + Math.floor((tn.tonika.l + i) / 7);
    const cil = zaklad + iv;
    return { l, a: cil - midi({ l, a: 0, o: oo }), o: oo };
  });
}
// Melodická moll: nahoru se zvýší 6. a 7. stupeň, dolů se hraje přirozená.
export function stupniceNahoruDolu(id, druh) {
  const nahoru = stupnice(id, druh);
  if (druh !== 'melodicka') return nahoru;
  const dolu = stupnice(id, 'aiolska').slice(0, 7).reverse();
  return [...nahoru, ...dolu];
}

export const PORADI_KRIZKU = ['fis', 'cis', 'gis', 'dis', 'ais', 'eis', 'his'];
export const PORADI_BECEK = ['b', 'es', 'as', 'des', 'ges', 'ces', 'fes'];

// Předznamenání tóniny: { pocet, znak: '♯' | '♭' | '', tony: ['fis', 'cis'] }
export function predznamenani(id) {
  const tony = stupnice(id).slice(0, 7);
  const krizky = tony.filter((t) => t.a > 0).length;
  const becka = tony.filter((t) => t.a < 0).length;
  if (krizky) return { pocet: krizky, znak: '♯', tony: PORADI_KRIZKU.slice(0, krizky) };
  if (becka) return { pocet: becka, znak: '♭', tony: PORADI_BECEK.slice(0, becka) };
  return { pocet: 0, znak: '', tony: [] };
}
export function popisPredznamenani(p) {
  if (!p.pocet) return 'bez předznamenání';
  const slovo = p.znak === '♯' ? (p.pocet === 1 ? 'křížek' : p.pocet < 5 ? 'křížky' : 'křížků') : (p.pocet === 1 ? 'béčko' : p.pocet < 5 ? 'béčka' : 'béček');
  return `${p.pocet} ${slovo}`;
}
export const kratkePredz = (p) => (p.pocet ? `${p.pocet} ${p.znak}` : '0');

// Paralelní tónina: moll leží o malou tercii níž než dur, mají stejné předznamenání.
export function paralelni(id) {
  const tn = tonina(id);
  const m = midi({ ...tn.tonika, o: 2 });
  if (tn.rod === 'dur') {
    const l = (tn.tonika.l + 5) % 7;
    const zakl = midi({ l, a: 0, o: 2 }) - (l > tn.tonika.l ? 12 : 0);
    return jmeno({ l, a: m - 3 - zakl }) + '-moll';
  }
  const l = (tn.tonika.l + 2) % 7;
  const zakl = midi({ l, a: 0, o: 2 }) + (l < tn.tonika.l ? 12 : 0);
  return velke(jmeno({ l, a: m + 3 - zakl })) + '-dur';
}

// Kvintakord (dur nebo moll) na daném MIDI.
export function kvintakord(koren, rod) { return [koren, koren + (rod === 'dur' ? 4 : 3), koren + 7]; }

export function zamichej(pole) {
  const a = [...pole];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const nahodny = (pole) => pole[Math.floor(Math.random() * pole.length)];
