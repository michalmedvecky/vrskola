// Úlohy: písemné sčítání, odčítání, násobení a dělení (až 9 cifer) podle obtížnosti 1–5.
// Rozsahy (počty cifer) jsou v data/ukoly.json, takže jdou měnit bez programování.
// Žádné DOM: modul jde použít i v Node (testy v nastroje/dostihy-test.mjs).

export const nahodne = (pole) => pole[Math.floor(Math.random() * pole.length)];
export const cislo = ([min, max]) => min + Math.floor(Math.random() * (max - min + 1));
export function zamichej(pole) {
  const p = pole.slice();
  for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  return p;
}
export const ZNAK = { '+': '+', '-': '−', '×': '×', ':': ':' };
export const OPERACE = ['+', '-', '×', ':'];

// číslo s daným počtem cifer; bezNul = žádná nula mezi ciframi, bezNulyNaKonci = poslední cifra není 0
function cisloCifer(cifer, { bezNul = false, bezNulyNaKonci = false } = {}) {
  let s = String(1 + Math.floor(Math.random() * 9));
  for (let i = 1; i < cifer; i++) s += String(bezNul ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10));
  if (bezNulyNaKonci && s.endsWith('0')) s = s.slice(0, -1) + String(1 + Math.floor(Math.random() * 9));
  return Number(s);
}
// mezery v dlouhých číslech: 123456789 → „123 456 789“ (tenká nezalomitelná mezera)
export const hezky = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function prechodySecitani(a, b) {
  let n = 0, p = 0;
  while (a > 0 || b > 0) { p = (a % 10) + (b % 10) + p >= 10 ? 1 : 0; n += p; a = Math.floor(a / 10); b = Math.floor(b / 10); }
  return n;
}
export function prechodyOdcitani(a, b) {
  let n = 0, p = 0;
  while (a > 0 || b > 0) { p = (a % 10) < (b % 10) + p ? 1 : 0; n += p; a = Math.floor(a / 10); b = Math.floor(b / 10); }
  return n;
}

// Pomocná čísla nad sloupci (co si „pamatuju“): pro sčítání přenos, pro odčítání výpůjčka
// (česká metoda doplňováním: „1 dál“ se přičte k číslici menšitele), pro násobení jednociferným přenos.
// Vrací pole podle sloupců od jednotek: prenos[i] = co se přenáší DO sloupce i.
export function prenosy(operace, a, b) {
  const p = [0];
  let x = a, y = b, c = 0;
  if (operace === '×') {
    while (x > 0) { c = Math.floor(((x % 10) * b + c) / 10); p.push(c); x = Math.floor(x / 10); }
    return p;
  }
  while (x > 0 || y > 0) {
    const da = x % 10, db = y % 10;
    c = operace === '+' ? (da + db + c >= 10 ? 1 : 0) : (da < db + c ? 1 : 0);
    p.push(c);
    x = Math.floor(x / 10); y = Math.floor(y / 10);
  }
  return p;
}

function secitani(u) {
  let a, b;
  for (let i = 0; i < 400; i++) {
    a = cisloCifer(cislo(u.a)); b = cisloCifer(cislo(u.b));
    if (a + b > 999999999) continue;
    if (prechodySecitani(a, b) >= (u.minPrechodu || 0)) break;
  }
  return { a, b, vysledek: a + b };
}
function odcitani(u) {
  let a, b;
  for (let i = 0; i < 400; i++) {
    a = cisloCifer(cislo(u.a)); b = cisloCifer(cislo(u.b));
    if (b >= a) [a, b] = [b, a];
    if (b === a) continue;
    if (prechodyOdcitani(a, b) >= (u.minPrechodu || 0)) break;
  }
  if (b >= a) [a, b] = [b + 1, a];
  return { a, b, vysledek: a - b };
}
function nasobeni(u) {
  let a, b;
  for (let i = 0; i < 400; i++) {
    a = cisloCifer(cislo(u.a), { bezNulyNaKonci: true });
    const cb = cislo(u.b);
    b = cb === 1 ? 2 + Math.floor(Math.random() * 8) : cisloCifer(cb, { bezNul: true });
    if (a * b <= 999999999) break;
  }
  return { a, b, vysledek: a * b };
}

// Písemné dělení po česku: kroky = [{ cast, cislice, zbytek, sloupec }], sloupec = index číslice dělence,
// pod kterou končí částečný dělenec. Zbytek se píše pod něj a připíše se k němu další číslice.
export function krokyDeleni(delenec, delitel) {
  const s = String(delenec);
  let p = 1;
  while (p < s.length && Number(s.slice(0, p)) < delitel) p++;
  let cast = Number(s.slice(0, p));
  const kroky = [];
  for (let i = p - 1; i < s.length; i++) {
    const q = Math.floor(cast / delitel), r = cast - q * delitel;
    kroky.push({ cast, cislice: q, zbytek: r, sloupec: i });
    if (i < s.length - 1) cast = r * 10 + Number(s[i + 1]);
  }
  return kroky;
}
function deleni(u) {
  let delenec, delitel;
  for (let i = 0; i < 400; i++) {
    const cd = cislo(u.delitel);
    delitel = cd === 1 ? 2 + Math.floor(Math.random() * 8) : cisloCifer(cd, { bezNulyNaKonci: true });
    const cifer = cislo(u.delenec);
    if (u.zbytek) delenec = cisloCifer(cifer);
    else {
      const min = 10 ** (cifer - 1), max = 10 ** cifer - 1;
      const qmin = Math.ceil(min / delitel), qmax = Math.floor(max / delitel);
      if (qmax < qmin) continue;
      delenec = delitel * (qmin + Math.floor(Math.random() * (qmax - qmin + 1)));
    }
    if (delenec < delitel * 2) continue;
    // ať v podílu není moc nul za sebou (nudné kroky)
    if (!/00/.test(String(Math.floor(delenec / delitel)))) break;
  }
  const podil = Math.floor(delenec / delitel), zbytek = delenec % delitel;
  return { delenec, delitel, podil, zbytek, kroky: krokyDeleni(delenec, delitel) };
}

// Vytvoří úlohu. op = '+', '-', '×', ':'; obtiznost = 1..5; data = obsah data/ukoly.json
export function vytvorUlohu(data, op, obtiznost) {
  const def = data.operace[op];
  const u = def.urovne[Math.max(0, Math.min(def.urovne.length - 1, obtiznost - 1))];
  if (op === ':') {
    const d = deleni(u);
    const zb = d.zbytek ? `, zbytek <b>${d.zbytek}</b>` : '';
    return {
      typ: 'deleni', op, obtiznost, pokyn: def.pokyn, ...d,
      popis: `${hezky(d.delenec)} : ${d.delitel}`,
      reseni: `${hezky(d.delenec)} : ${d.delitel} = <b>${hezky(d.podil)}</b>${zb}<br><small>${d.kroky.map((k) => `${k.cast} : ${d.delitel} = ${k.cislice}, zbude ${k.zbytek}`).join(' · ')}</small>`,
    };
  }
  const { a, b, vysledek } = op === '+' ? secitani(u) : op === '-' ? odcitani(u) : nasobeni(u);
  const pokyn = op === '×' && b >= 10 ? (def.pokynVicemistne || def.pokyn) : def.pokyn;
  return {
    typ: 'sloupec', op, operace: op, obtiznost, pokyn, a, b, vysledek,
    popis: `${hezky(a)} ${ZNAK[op]} ${hezky(b)}`,
    reseni: `${hezky(a)} ${ZNAK[op]} ${hezky(b)} = <b>${hezky(vysledek)}</b>`,
  };
}

// Kontrola dat (pro autory a testy): vrací seznam problémů.
export function zkontrolujData(data) {
  const chyby = [];
  for (const op of OPERACE) {
    const d = data.operace?.[op];
    if (!d) { chyby.push(`chybí operace ${op}`); continue; }
    if (!Array.isArray(d.urovne) || d.urovne.length !== 5) chyby.push(`${op}: má mít 5 úrovní`);
  }
  return chyby;
}
