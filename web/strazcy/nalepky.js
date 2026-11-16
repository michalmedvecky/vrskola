// Nálepky do sbírky: odměna za každé otevření hradu. Když má dítě všechny, sbírá zlaté verze.
export const NALEPKY = [
  ['jednorozec', '🦄', 'Jednorožec'], ['drak', '🐉', 'Dráček'], ['liska', '🦊', 'Liška'], ['panda', '🐼', 'Panda'],
  ['koala', '🐨', 'Koala'], ['tygr', '🐯', 'Tygr'], ['lev', '🦁', 'Lev'], ['zabka', '🐸', 'Žabka'],
  ['chobotnice', '🐙', 'Chobotnice'], ['motyl', '🦋', 'Motýl'], ['beruska', '🐞', 'Beruška'], ['zelva', '🐢', 'Želva'],
  ['dinosaurus', '🦖', 'Dinosaurus'], ['delfin', '🐬', 'Delfín'], ['sova', '🦉', 'Sova'], ['tucnak', '🐧', 'Tučňák'],
  ['duha', '🌈', 'Duha'], ['hvezda', '⭐', 'Hvězda'], ['mesic', '🌙', 'Měsíc'], ['slunce', '☀️', 'Sluníčko'],
  ['ctyrlistek', '🍀', 'Čtyřlístek'], ['slunecnice', '🌻', 'Slunečnice'], ['jahoda', '🍓', 'Jahoda'], ['meloun', '🍉', 'Meloun'],
  ['kobliha', '🍩', 'Kobliha'], ['dortik', '🧁', 'Dortík'], ['lizatko', '🍭', 'Lízátko'], ['balonek', '🎈', 'Balónek'],
  ['paleta', '🎨', 'Paleta'], ['kytara', '🎸', 'Kytara'], ['raketa', '🚀', 'Raketa'], ['ufo', '🛸', 'Létající talíř'],
  ['lodka', '⛵', 'Lodička'], ['koruna', '👑', 'Koruna'], ['diamant', '💎', 'Diamant'], ['kouzlo', '🪄', 'Kouzelná hůlka'],
].map(([id, emoji, nazev]) => ({ id, emoji, nazev }));

export const HODNOSTI = [
  [0, 'Poutník'], [1, 'Průzkumník'], [3, 'Stopař'], [5, 'Dobrodruh'], [8, 'Strážce cest'],
  [12, 'Hrdina kraje'], [18, 'Rytíř klíčů'], [25, 'Pán hradu'], [36, 'Legenda'],
];
export function hodnost(pocetOtevreni) {
  let h = HODNOSTI[0][1];
  for (const [n, nazev] of HODNOSTI) if (pocetOtevreni >= n) h = nazev;
  return h;
}

// Vybere novou nálepku: nejdřív chybějící, pak zlaté verze chybějících zlatých.
export function vyberNalepku(sbirka) {
  const mam = new Set(sbirka.map((s) => s.id + (s.zlata ? '*' : '')));
  let kandidati = NALEPKY.filter((n) => !mam.has(n.id)).map((n) => ({ id: n.id, zlata: false }));
  if (!kandidati.length) kandidati = NALEPKY.filter((n) => !mam.has(n.id + '*')).map((n) => ({ id: n.id, zlata: true }));
  if (!kandidati.length) kandidati = NALEPKY.map((n) => ({ id: n.id, zlata: true }));
  return kandidati[Math.floor(Math.random() * kandidati.length)];
}
export const nalepka = (id) => NALEPKY.find((n) => n.id === id);
