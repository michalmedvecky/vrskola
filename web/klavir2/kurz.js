// Osnova kurzu: lekce (výklad s ukázkami) a položky, které se v tréninku musí zvládnout.
// Pořadí jednotek je pořadí, v jakém se otvírají. Typy položek generuje cviceni.js.
import { DUR, MOLL } from './hudba.js';

const dur = (t) => t + '-dur';
const moll = (t) => t + '-moll';
const produr = (tt) => tt.flatMap((t) => [`hraj:${dur(t)}`, `predz:${dur(t)}`, `ton:${dur(t)}`]);
const promoll = (tt) => tt.flatMap((t) => [`hraj:${moll(t)}:harmonicka`, `hraj:${moll(t)}:melodicka`, `ton:${moll(t)}:harmonicka`, `paral:${moll(t)}`]);

// Ukázka na snímku lekce: { tony: ['c1','e1'] } zvýrazní a přehraje tóny (pole v poli = akord),
// { stupnice: 'D-dur', druh } přehraje stupnici s názvy tónů na klávesách.
export const JEDNOTKY = [
  {
    id: 'klaviatura', nazev: 'Klaviatura a bílé klávesy', ikona: '🎹',
    lekce: [
      { text: ['Klaviatura se opakuje po dvanácti klávesách: sedm bílých a pět černých.', 'Černé klávesy tvoří skupinky po dvou a po třech. Podle nich se na klavíru orientuješ.'], ukazka: { tony: ['cis1', 'dis1', 'fis1', 'gis1', 'ais1'] } },
      { text: ['Bílé klávesy se jmenují c, d, e, f, g, a, h.', 'Tón c leží vždycky těsně vlevo od dvojice černých kláves. Tón f leží těsně vlevo od trojice.'], ukazka: { tony: ['c1', 'd1', 'e1', 'f1', 'g1', 'a1', 'h1', 'c2'] } },
      { text: ['Pozor na české názvy: sedmý tón je h (v angličtině se mu říká B).', 'Písmenem b se u nás označuje černá klávesa mezi a a h.'], ukazka: { tony: ['a1', 'b1', 'h1'] } },
      { text: ['Od jednoho c k dalšímu c je oktáva. Na téhle klaviatuře jsou dvě: od c¹ (jednočárkovaného) po c³.', 'Tóny se stejným jménem v různých oktávách zní „stejně, jen výš“.'], ukazka: { tony: ['c1', 'c2', 'c3', ['c1', 'c2']] } },
    ],
    polozky: ['c', 'd', 'e', 'f', 'g', 'a', 'h'].map((t) => 'bila:' + t),
  },
  {
    id: 'cerne', nazev: 'Půltóny, křížky a béčka', ikona: '♯',
    lekce: [
      { text: ['Půltón je nejmenší krok na klaviatuře: z klávesy na tu úplně nejbližší, bílou nebo černou (c–cis, e–f).', 'Celý tón jsou dva půltóny (c–d, e–fis).'], ukazka: { tony: ['c1', 'cis1', 'c1', 'd1'] } },
      { text: ['Mezi e–f a mezi h–c není černá klávesa. Proto jsou tam bílé klávesy jen půltón od sebe.'], ukazka: { tony: ['e1', 'f1', 'h1', 'c2'] } },
      { text: ['Křížek ♯ zvýší tón o půltón. K názvu se přidá -is: c → cis, f → fis, g → gis.'], ukazka: { tony: ['c1', 'cis1', 'f1', 'fis1'] } },
      { text: ['Béčko ♭ sníží tón o půltón. Přidá se -es: d → des, g → ges.', 'Výjimky: e → es, a → as a h → b.'], ukazka: { tony: ['e1', 'es1', 'a1', 'as1', 'h1', 'b1'] } },
      { text: ['Každá černá klávesa má proto dvě jména: cis = des, dis = es, fis = ges, gis = as, ais = b.', 'I bílé klávesy můžou mít druhé jméno: eis = f, his = c, fes = e, ces = h. Budou se hodit ve stupnicích s mnoha křížky a béčky.'], ukazka: { tony: ['fis1', 'ges1'] } },
    ],
    polozky: [...['cis', 'dis', 'fis', 'gis', 'ais', 'des', 'es', 'ges', 'as', 'b'].map((t) => 'cerna:' + t), 'pul'],
  },
  {
    id: 'sluch-bile', nazev: 'Sluch: bílé tóny', ikona: '👂',
    lekce: [
      { text: ['Teď budeš poznávat tóny podle sluchu.', 'Nejdřív vždycky zazní c¹ jako záchytný bod, hned potom hledaný tón. Poslouchej, o kolik je výš.'], ukazka: { tony: ['c1', 'e1', 'c1', 'g1'] } },
      { text: ['Pomůže ti, když si v duchu zazpíváš stupnici od c nahoru a zastavíš se u hledaného tónu.'], ukazka: { stupnice: 'C-dur' } },
      { text: ['V tréninku je ťuknutí na klávesu rovnou odpovědí, nanečisto si zkoušet nejde.', 'Tlačítkem ▶ si tóny pustíš znovu, kolikrát chceš.'] },
    ],
    polozky: ['c', 'd', 'e', 'f', 'g', 'a', 'h'].map((t) => 'sluch:' + t),
  },
  {
    id: 'stavba-dur', nazev: 'Stavba durové stupnice', ikona: '🪜',
    lekce: [
      { text: ['Stupnice je řada osmi tónů od základního tónu (toniky) až k jeho oktávě. Tóny se počítají jako stupně I až VIII.'], ukazka: { stupnice: 'C-dur' } },
      { text: ['Durová stupnice má vždy stejný vzorec kroků:', 'celý – celý – půl – celý – celý – celý – půl.', 'Půltóny jsou mezi III.–IV. a VII.–VIII. stupněm.'], ukazka: { tony: ['e1', 'f1', 'h1', 'c2'] } },
      { text: ['C dur je jediná durová stupnice jen z bílých kláves: půltóny e–f a h–c padnou přesně na III.–IV. a VII.–VIII. stupeň.'], ukazka: { stupnice: 'C-dur' } },
      { text: ['Začneš-li na g, VII. stupeň musí být jen půltón pod g. Proto místo f hraješ fis.', 'Tak vzniká G dur s jedním křížkem.'], ukazka: { stupnice: 'G-dur' } },
      { text: ['Pravidlo psaní: každé písmeno se ve stupnici objeví právě jednou. Proto se v G dur píše fis, nikdy ges.'] },
    ],
    polozky: ['hraj:C-dur', 'pultony-dur', 'hraj:G-dur', 'predz:G-dur', 'ton:G-dur'],
  },
  {
    id: 'krizky-1', nazev: 'Křížkové dur: D, A, E', ikona: '♯',
    lekce: [
      { text: ['Křížkové durové stupnice jdou po kvintách (o 5 stupňů výš): C → G → D → A → E → H → Fis → Cis.', 'Každá další má o jeden křížek víc.'] },
      { text: ['Nový křížek přibude vždy na VII. stupni, tedy půltón pod tónikou. Je to takzvaný citlivý tón.', 'D dur: fis, cis.'], ukazka: { stupnice: 'D-dur' } },
      { text: ['A dur: fis, cis, gis.'], ukazka: { stupnice: 'A-dur' } },
      { text: ['E dur: fis, cis, gis, dis.', 'Pořadí křížků v předznamenání je pořád stejné: fis, cis, gis, dis, ais, eis, his.'], ukazka: { stupnice: 'E-dur' } },
    ],
    polozky: produr(['D', 'A', 'E']),
  },
  {
    id: 'krizky-2', nazev: 'Křížkové dur: H, Fis, Cis', ikona: '♯',
    lekce: [
      { text: ['H dur má 5 křížků: fis, cis, gis, dis, ais.'], ukazka: { stupnice: 'H-dur' } },
      { text: ['Fis dur má 6 křížků. Šestý je eis, a to je bílá klávesa f!', 'Píše se eis, protože písmeno f už je ve stupnici obsazené (fis).'], ukazka: { stupnice: 'Fis-dur' } },
      { text: ['Cis dur má všech 7 tónů zvýšených. Sedmý křížek je his, zní jako c.'], ukazka: { stupnice: 'Cis-dur' } },
      { text: ['Kontrola: tónika durové stupnice s křížky je vždy půltón nad posledním křížkem předznamenání (poslední ais → H dur).'] },
    ],
    polozky: produr(['H', 'Fis', 'Cis']),
  },
  {
    id: 'becka-1', nazev: 'Béčkové dur: F, B, Es', ikona: '♭',
    lekce: [
      { text: ['Béčkové durové stupnice jdou opačně, po kvartách: C → F → B → Es → As → Des → Ges → Ces.', 'Každá další má o jedno béčko víc.'] },
      { text: ['F dur: IV. stupeň musí být jen půltón nad III. stupněm (a). Proto místo h hraješ b.'], ukazka: { stupnice: 'F-dur' } },
      { text: ['B dur: b, es.', 'Pořadí béček je pořadí křížků pozpátku: b, es, as, des, ges, ces, fes.'], ukazka: { stupnice: 'B-dur' } },
      { text: ['Es dur: b, es, as.', 'Trik: předposlední béčko v předznamenání je název stupnice (b, es, as → Es dur).'], ukazka: { stupnice: 'Es-dur' } },
    ],
    polozky: produr(['F', 'B', 'Es']),
  },
  {
    id: 'becka-2', nazev: 'Béčkové dur: As, Des, Ges, Ces', ikona: '♭',
    lekce: [
      { text: ['As dur: b, es, as, des.'], ukazka: { stupnice: 'As-dur' } },
      { text: ['Des dur: 5 béček. Zní stejně jako Cis dur, jen se jinak píše.'], ukazka: { stupnice: 'Des-dur' } },
      { text: ['Ges dur: 6 béček. Šesté je ces, zní jako h.'], ukazka: { stupnice: 'Ges-dur' } },
      { text: ['Ces dur: všech 7 tónů snížených, i fes (zní jako e). Zní stejně jako H dur.'], ukazka: { stupnice: 'Ces-dur' } },
    ],
    polozky: produr(['As', 'Des', 'Ges', 'Ces']),
  },
  {
    id: 'moll', nazev: 'Molové stupnice', ikona: '🌙',
    lekce: [
      { text: ['Molová stupnice zní tmavěji, smutněji. Přirozená (aiolská) moll má půltóny mezi II.–III. a V.–VI. stupněm.', 'a moll je jen z bílých kláves.'], ukazka: { stupnice: 'a-moll', druh: 'aiolska' } },
      { text: ['Každá durová stupnice má paralelní moll se stejným předznamenáním. Leží o malou tercii (3 půltóny) níž.', 'C dur → a moll, G dur → e moll, F dur → d moll.'], ukazka: { tony: ['c2', 'a1'] } },
      { text: ['Harmonická moll má zvýšený VII. stupeň: v a moll gis.', 'Mezi VI. a VII. stupněm je pak krok o 3 půltóny (f–gis). Ten ji hned prozradí.'], ukazka: { stupnice: 'a-moll', druh: 'harmonicka' } },
      { text: ['Melodická moll má nahoru zvýšený VI. i VII. stupeň (fis, gis), dolů se hraje přirozená.'], ukazka: { stupnice: 'a-moll', druh: 'melodicka' } },
    ],
    polozky: ['hraj:a-moll:aiolska', 'hraj:a-moll:harmonicka', 'hraj:a-moll:melodicka', 'druh-moll', 'paral:a-moll'],
  },
  {
    id: 'sluch-dm', nazev: 'Sluch: dur, nebo moll? Černé tóny', ikona: '👂',
    lekce: [
      { text: ['Dur zní jasně, moll tmavěji. Rozdíl dělá hlavně III. stupeň:', 'v dur je od toniky velká tercie (4 půltóny), v moll malá tercie (3 půltóny).'], ukazka: { tony: [['c1', 'e1', 'g1'], ['c1', 'es1', 'g1']] } },
      { text: ['Kvintakord jsou tři tóny: I., III. a V. stupeň. C dur: c–e–g, c moll: c–es–g.'], ukazka: { tony: ['c1', 'e1', 'g1', ['c1', 'e1', 'g1'], 'c1', 'es1', 'g1', ['c1', 'es1', 'g1']] } },
      { text: ['Přidají se i černé klávesy při poznávání tónů. Jako dřív zazní nejdřív c¹, pak hledaný tón.'], ukazka: { tony: ['c1', 'fis1'] } },
    ],
    polozky: ['sluch-dm:akord', 'sluch-dm:stupnice', ...['cis', 'dis', 'fis', 'gis', 'ais'].map((t) => 'sluch:' + t)],
  },
  {
    id: 'moll-krizky', nazev: 'Molové stupnice s křížky', ikona: '♯',
    lekce: [
      { text: ['Molovou stupnici odvodíš od paralelní dur: e moll má stejně jako G dur jeden křížek (fis).', 'V harmonické přidáš zvýšený VII. stupeň: dis.'], ukazka: { stupnice: 'e-moll', druh: 'harmonicka' } },
      { text: ['h moll (2 ♯ jako D dur), fis moll (3 ♯ jako A dur), cis moll (4 ♯ jako E dur).'], ukazka: { stupnice: 'h-moll', druh: 'melodicka' } },
      { text: ['Zvyšuje-li se tón, který už křížek má, vznikne dvojkřížek: v gis moll harmonické je VII. stupeň fisis (zní jako g).', 'dis moll: cisis, ais moll: gisis.'], ukazka: { stupnice: 'gis-moll', druh: 'harmonicka' } },
    ],
    polozky: promoll(['e', 'h', 'fis', 'cis', 'gis', 'dis', 'ais']),
  },
  {
    id: 'sluch-druh', nazev: 'Sluch: druhy moll', ikona: '👂',
    lekce: [
      { text: ['Přirozená moll zní klidně a „staře“, harmonická má nápadný velký skok mezi VI. a VII. stupněm, melodická zní nahoru skoro jako dur, jen má malou tercii.'], ukazka: { stupnice: 'd-moll', druh: 'aiolska' } },
      { text: ['Poslechni si harmonickou…'], ukazka: { stupnice: 'd-moll', druh: 'harmonicka' } },
      { text: ['… a melodickou (v tréninku zazní jen nahoru).'], ukazka: { stupnice: 'd-moll', druh: 'melodicka', jenNahoru: true } },
    ],
    polozky: ['sluch-druh'],
  },
  {
    id: 'moll-becka', nazev: 'Molové stupnice s béčky', ikona: '♭',
    lekce: [
      { text: ['d moll má jedno béčko jako F dur. Harmonická: zvýšený VII. stupeň cis.'], ukazka: { stupnice: 'd-moll', druh: 'harmonicka' } },
      { text: ['Zvýšit tón s béčkem znamená béčko zrušit (odrážka ♮): c moll harmonická má h, f moll má e.'], ukazka: { stupnice: 'c-moll', druh: 'harmonicka' } },
      { text: ['g moll (2 ♭), c moll (3 ♭), f moll (4 ♭), b moll (5 ♭), es moll (6 ♭), as moll (7 ♭).'], ukazka: { stupnice: 'f-moll', druh: 'melodicka' } },
    ],
    polozky: promoll(['d', 'g', 'c', 'f', 'b', 'es', 'as']),
  },
];

export const VSECHNY_POLOZKY = JEDNOTKY.flatMap((j) => j.polozky);
export const jednotkaPolozky = Object.fromEntries(JEDNOTKY.flatMap((j) => j.polozky.map((p) => [p, j.id])));

// Kolikrát za sebou napoprvé správně, než je položka zvládnutá.
export function potrebnaSerie(id) {
  if (id.startsWith('sluch-dm')) return 5;
  if (id === 'sluch-druh') return 4;
  if (id === 'pul') return 4;
  if (id === 'druh-moll') return 3;
  if (id.startsWith('sluch:')) return 3;
  return 2;
}

// Kontrola, že jsou všechny tóniny v kurzu (pro test).
export const KONTROLA = { DUR, MOLL };
