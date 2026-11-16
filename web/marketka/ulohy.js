// Úlohy: z dat témat (data/ukoly-*.json) vyrábí konkrétní úlohy a otázky na zámky truhliček.
// Žádné DOM: modul jde použít i v Node (testy v nastroje/marketka-test-ulohy.mjs).
//
// Téma = JSON soubor: { id, nazev, kouzlo, zamena?, ulohy: [ {typ, vaha, ...} ], zamky: {...} }
// Typy úloh (obecné „motory“, obsah dodává JSON):
//   doplnovacka – věty s mezerami `p[y]tel`, dítě doplňuje písmena jedno po druhém
//   diktat      – hra větu přečte nahlas, dítě vybere správně napsanou variantu
//   urcovani    – věty se značkami `[slovo|hodnota]`, dítě ke každému slovu vybere hodnotu (pády, slovní druhy…)
//   vyber       – obecné otázky s výběrem z možností (první možnost je správná)
//   pisemne     – písemné odčítání / násobení pod sebou, kontrola každé číslice
//   slozene     – složené příklady počítané po krocích (šablony s proměnnými)
//   skladani    – skládání věty z kartiček (pevné položky nebo generátor present-simple)

export const nahodne = (pole) => pole[Math.floor(Math.random() * pole.length)];
export const cislo = ([min, max]) => min + Math.floor(Math.random() * (max - min + 1));
export function zamichej(pole) {
  const p = pole.slice();
  for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  return p;
}
const velke = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// `Kůň klop[ý]tl` → ['Kůň klop', {moznosti:['ý']}, 'tl']; `[a|b|c]` → {moznosti:['a','b','c']}
export function rozeber(veta) {
  const casti = [];
  const re = /\[([^\]]*)\]/g;
  let m, posledni = 0;
  while ((m = re.exec(veta))) {
    if (m.index > posledni) casti.push(veta.slice(posledni, m.index));
    casti.push({ moznosti: m[1].split('|') });
    posledni = re.lastIndex;
  }
  if (posledni < veta.length) casti.push(veta.slice(posledni));
  return casti;
}
const textVety = (casti) => casti.map((c) => (typeof c === 'string' ? c : c.moznosti[0])).join('');

function spatneVarianty(spravne, explicitni, zamena) {
  if (explicitni.length) return explicitni;
  if (zamena && zamena[spravne] !== undefined) return [zamena[spravne]];
  return [];
}

// ---------- jednotlivé typy úloh ----------

function doplnovacka(def, tema) {
  const min = def.minMezer || 1;
  const vety = zamichej(def.vety);
  const vybrane = [];
  let mezer = 0;
  for (const v of vety) {
    vybrane.push(v);
    mezer += rozeber(v).filter((c) => typeof c !== 'string').length;
    if (mezer >= min) break;
  }
  const casti = [];
  vybrane.forEach((v, i) => {
    if (i) casti.push(' ');
    for (const c of rozeber(v)) {
      if (typeof c === 'string') { casti.push(c); continue; }
      const [spravne, ...expl] = c.moznosti;
      const moznosti = [spravne, ...spatneVarianty(spravne, expl, tema.zamena)];
      // ypsilon vždy vlevo, ať tlačítka nepřeskakují
      moznosti.sort((a, b) => (/[yý]/i.test(b) ? 1 : 0) - (/[yý]/i.test(a) ? 1 : 0) || a.localeCompare(b, 'cs'));
      casti.push({ zobraz: '_', moznosti: moznosti.map((h) => ({ hodnota: h, popis: h })), spravne, odhal: spravne });
    }
  });
  const reseni = vybrane.map((v) => rozeber(v).map((c) => (typeof c === 'string' ? esc(c) : `<b>${esc(c.moznosti[0])}</b>`)).join('')).join(' ');
  return { typ: 'postupne', pokyn: def.pokyn, casti, reseni, popis: vybrane.map((v) => textVety(rozeber(v))).join(' ') };
}

function diktat(def, tema) {
  const veta = nahodne(def.vety);
  const casti = rozeber(veta);
  const mezery = casti.map((c, i) => (typeof c === 'string' ? -1 : i)).filter((i) => i >= 0);
  const spravne = textVety(casti);
  const varianty = new Set([spravne]);
  const pocet = def.moznosti || 3;
  for (let pokus = 0; pokus < 40 && varianty.size < pocet; pokus++) {
    const prohodit = new Set(zamichej(mezery).slice(0, 1 + (pokus > 10 && mezery.length > 1 ? 1 : 0)));
    const v = casti.map((c, i) => {
      if (typeof c === 'string') return c;
      if (!prohodit.has(i)) return c.moznosti[0];
      const spatne = spatneVarianty(c.moznosti[0], c.moznosti.slice(1), tema.zamena);
      return spatne.length ? nahodne(spatne) : c.moznosti[0];
    }).join('');
    varianty.add(v);
  }
  const moznosti = zamichej([...varianty]);
  return {
    typ: 'vyber', pokyn: def.pokyn, mluvit: spravne, jazyk: 'cs-CZ', otazka: '', moznosti,
    spravna: moznosti.indexOf(spravne), reseni: esc(spravne), popis: spravne, zivoty: 1,
  };
}

function urcovani(def) {
  const min = def.minSlov || 1;
  const vety = zamichej(def.vety);
  const vybrane = [];
  let slov = 0;
  for (const v of vety) {
    vybrane.push(v);
    slov += rozeber(v).filter((c) => typeof c !== 'string').length;
    if (slov >= min) break;
  }
  const casti = [];
  const reseni = [];
  vybrane.forEach((v, i) => {
    if (i) casti.push(' ');
    for (const c of rozeber(v)) {
      if (typeof c === 'string') { casti.push(c); continue; }
      const [slovo, hodnota] = c.moznosti;
      const m = def.moznosti.find((x) => x.hodnota === hodnota);
      casti.push({ zobraz: slovo, moznosti: def.moznosti, spravne: hodnota, odhal: slovo, stitek: m ? m.popis : hodnota });
      reseni.push(`<b>${esc(slovo)}</b> = ${esc(m ? m.popis : hodnota)}${m && m.napoveda ? ` (${esc(m.napoveda)})` : ''}`);
    }
  });
  return {
    typ: 'postupne', pokyn: def.pokyn, casti, tlacitkaVelka: true, reseni: reseni.join('<br>'),
    popis: vybrane.map((v) => textVety(rozeber(v))).join(' '),
  };
}

function vyber(def) {
  const p = nahodne(def.polozky);
  const moznosti = zamichej(p.moznosti);
  return {
    typ: 'vyber', pokyn: p.pokyn || def.pokyn, otazka: p.otazka, mluvit: p.mluvit, jazyk: p.jazyk,
    moznosti, spravna: moznosti.indexOf(p.moznosti[0]), reseni: esc(p.moznosti[0]), popis: p.otazka, zivoty: 1,
  };
}

function pocetPrechodu(a, b) {
  let prechodu = 0, vypujcka = 0;
  while (a > 0 || b > 0) {
    const da = a % 10, db = (b % 10) + vypujcka;
    vypujcka = da < db ? 1 : 0;
    prechodu += vypujcka;
    a = Math.floor(a / 10); b = Math.floor(b / 10);
  }
  return prechodu;
}

function pisemne(def) {
  let a, b;
  if (def.operace === '-') {
    for (let i = 0; i < 300; i++) {
      a = cislo(def.a); b = cislo(def.b);
      if (b >= a) continue;
      if (pocetPrechodu(a, b) >= (def.minPrechodu || 0)) break;
    }
    if (b >= a) [a, b] = [b + 1, a];
  } else {
    for (let i = 0; i < 300; i++) {
      a = cislo(def.a); b = cislo(def.b);
      if (!String(b).includes('0') && a % 10 !== 0 && a * b <= (def.max || 999999)) break;
    }
  }
  const vysledek = def.operace === '-' ? a - b : a * b;
  const znak = def.operace === '-' ? '−' : '×';
  return {
    typ: 'sloupec', pokyn: def.pokyn, operace: def.operace, a, b, vysledek,
    reseni: `${a} ${znak} ${b} = <b>${vysledek}</b>`, popis: `${a} ${znak} ${b}`,
  };
}

// --- složené příklady: malý parser výrazů ---
const ZNAKY = { '+': '+', '-': '−', '−': '−', '*': '×', '×': '×', '·': '×', ':': ':', '/': ':' };
function tokeny(s) { return s.replace(/\s+/g, '').match(/\d+|[a-z]|[-+−*×·:/()]/g); }
function parsuj(tok) {
  let i = 0;
  const vyraz = () => {
    let l = clen();
    while (tok[i] === '+' || ZNAKY[tok[i]] === '−') { const op = ZNAKY[tok[i++]]; l = { op, l, r: clen() }; }
    return l;
  };
  const clen = () => {
    let l = faktor();
    while (ZNAKY[tok[i]] === '×' || ZNAKY[tok[i]] === ':') { const op = ZNAKY[tok[i++]]; l = { op, l, r: faktor() }; }
    return l;
  };
  const faktor = () => {
    if (tok[i] === '(') { i++; const v = vyraz(); i++; v.zavorka = true; return v; }
    const t = tok[i++];
    return /\d/.test(t) ? { n: Number(t) } : { prom: t };
  };
  return vyraz();
}
const spocti = (op, a, b) => (op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b);
function dosad(u, hodnoty) {
  if (u.prom) return { n: hodnoty[u.prom] };
  if (u.n !== undefined) return { n: u.n };
  return { op: u.op, l: dosad(u.l, hodnoty), r: dosad(u.r, hodnoty), zavorka: u.zavorka };
}
function napis(u, horni = true) {
  if (u.n !== undefined) return String(u.n);
  const s = `${napis(u.l, false)} ${u.op} ${napis(u.r, false)}`;
  return u.zavorka && !horni ? `(${s})` : s;
}
function hodnota(u) { return u.n !== undefined ? u.n : spocti(u.op, hodnota(u.l), hodnota(u.r)); }
function vsechnyMezivysledkyOk(u, max) {
  if (u.n !== undefined) return true;
  if (!vsechnyMezivysledkyOk(u.l, max) || !vsechnyMezivysledkyOk(u.r, max)) return false;
  const v = hodnota(u);
  return Number.isInteger(v) && v >= 0 && v <= max;
}
// Připravené operace (obě strany už jsou čísla), zleva doprava.
function pripravene(u, out = []) {
  if (u.n !== undefined) return out;
  if (u.l.n !== undefined && u.r.n !== undefined) out.push(u);
  else { pripravene(u.l, out); pripravene(u.r, out); }
  return out;
}
function nahrad(u, cil, n) {
  if (u === cil) return { n };
  if (u.n !== undefined) return u;
  return { op: u.op, l: nahrad(u.l, cil, n), r: nahrad(u.r, cil, n), zavorka: u.zavorka };
}
// Chybný krok „zleva doprava bez ohledu na přednost a závorky“, pro otázku „co nejdřív?“
function chybnyKrok(u, spravne) {
  const ploche = napis(u).split(' ').filter((t) => t !== '(' && t !== ')').map((t) => t.replace(/[()]/g, ''));
  for (let i = 0; i + 2 < ploche.length; i += 2) {
    const s = `${ploche[i]} ${ploche[i + 1]} ${ploche[i + 2]}`;
    if (!spravne.includes(s)) return s;
  }
  return null;
}

function slozene(def) {
  let strom, sablona;
  for (let pokus = 0; pokus < 500; pokus++) {
    sablona = nahodne(def.sablony);
    const hodnoty = {};
    for (const k of Object.keys(sablona)) if (k.length === 1) hodnoty[k] = cislo(sablona[k]);
    // dělení vždy beze zbytku: upravíme první proměnnou za dělítkem
    strom = dosad(parsuj(tokeny(sablona.vyraz)), hodnoty);
    if (vsechnyMezivysledkyOk(strom, def.max || 99999)) break;
    strom = null;
  }
  if (!strom) strom = dosad(parsuj(tokeny('a + b × c')), { a: 120, b: 4, c: 7 });
  const vyraz = napis(strom);
  const kroky = [];
  let u = strom;
  let prvni = true;
  while (u.n === undefined) {
    const pr = pripravene(u);
    const cil = pr[0];
    const text = napis({ op: cil.op, l: cil.l, r: cil.r });
    const vysl = hodnota(cil);
    if (prvni) {
      const spatne = chybnyKrok(u, pr.map((p) => napis({ op: p.op, l: p.l, r: p.r })));
      if (spatne) {
        kroky.push({ otazka: `Co spočítáš nejdřív? <span class="vyraz">${esc(vyraz)}</span>`, moznosti: zamichej([text, spatne]), spravne: text });
      }
      prvni = false;
    }
    kroky.push({ otazka: `${esc(text)} =`, spravne: String(vysl), vyrazPred: napis(u) });
    u = nahrad(u, cil, vysl);
  }
  const reseni = kroky.filter((k) => !k.moznosti).map((k) => `${k.otazka} <b>${k.spravne}</b>`).join('<br>');
  return { typ: 'kroky', pokyn: def.pokyn, vyraz, kroky, vysledek: hodnota(strom), reseni, popis: vyraz };
}

// --- skládání vět ---
function presentSimple(def) {
  const sl = def.slovnik;
  const druh = nahodne(def.druhy || ['otazka', 'zapor']);
  let podmet;
  do { podmet = nahodne(sl.podmety); } while (druh === 'otazka' && podmet.osoba === '1');
  const sloveso = nahodne(sl.slovesa);
  const predmet = nahodne(sloveso.predmety);
  const treti = podmet.osoba === '3';
  const tvar = treti ? sloveso.tvar3 : sloveso.zaklad;
  const predloha = `${velke(podmet.slovo)} ${tvar} ${predmet}.`;
  const zajmeno = /^(he|she|it|we|they|you|my |our |the )/.test(podmet.slovo);
  let tokenyVety, navic, konec;
  if (druh === 'otazka') {
    tokenyVety = [treti ? 'Does' : 'Do', podmet.slovo, sloveso.zaklad, predmet];
    navic = [treti ? 'Do' : 'Does', sloveso.tvar3];
    konec = '?';
  } else {
    tokenyVety = [zajmeno ? velke(podmet.slovo) : podmet.slovo, treti ? "doesn't" : "don't", sloveso.zaklad, predmet];
    navic = [treti ? "don't" : "doesn't", sloveso.tvar3];
    konec = '.';
  }
  if (podmet.slovo === 'I' && druh === 'zapor') tokenyVety[0] = 'I';
  return { pokyn: def.pokyny?.[druh] || def.pokyn, predloha, tokeny: tokenyVety, navic, konec };
}
function rozdelVysledek(p) {
  const konec = /[?.!]$/.test(p.vysledek) ? p.vysledek.slice(-1) : '';
  const telo = konec ? p.vysledek.slice(0, -1) : p.vysledek;
  return { pokyn: p.pokyn, predloha: p.predloha, tokeny: p.tokeny || telo.split(' '), navic: p.navic || [], konec };
}
function skladaniPolozka(def) {
  if (def.generator === 'present-simple') return presentSimple(def);
  return rozdelVysledek(nahodne(def.polozky));
}
function skladani(def, tema) {
  const p = skladaniPolozka(def);
  const veta = p.tokeny.join(' ') + p.konec;
  return {
    typ: 'skladani', pokyn: p.pokyn || def.pokyn, predloha: p.predloha, tokeny: p.tokeny, navic: p.navic,
    konec: p.konec, jazyk: tema.jazykRec || 'en-GB', reseni: esc(veta), popis: `${p.predloha} → ${veta}`,
  };
}

const TYPY = { doplnovacka, diktat, urcovani, vyber, pisemne, slozene, skladani };
export const znameTypy = Object.keys(TYPY);

function vazenyVyber(polozky) {
  const celkem = polozky.reduce((s, p) => s + (p.vaha ?? 1), 0);
  let r = Math.random() * celkem;
  for (const p of polozky) { r -= p.vaha ?? 1; if (r < 0) return p; }
  return polozky[polozky.length - 1];
}

// moznosti.diktat === false → typ diktat se přeskočí (zařízení neumí česky mluvit)
export function vytvorUlohu(tema, moznosti = {}) {
  let defy = tema.ulohy.filter((u) => TYPY[u.typ]);
  if (moznosti.diktat === false) defy = defy.filter((u) => u.typ !== 'diktat');
  const def = vazenyVyber(defy);
  const u = TYPY[def.typ](def, tema);
  u.tema = tema.id;
  u.podtyp = def.typ + (def.operace ? def.operace : '');
  u.zivoty = u.zivoty ?? def.zivoty;
  return u;
}

// ---------- zámky truhliček: krátká otázka se 2–3 možnostmi ----------

function zamekZeSlova(slovo, tema, pokyn) {
  const casti = rozeber(slovo);
  const mezera = casti.find((c) => typeof c !== 'string');
  const spravne = mezera.moznosti[0];
  const spatne = spatneVarianty(spravne, mezera.moznosti.slice(1), tema.zamena);
  const zobraz = casti.map((c) => (typeof c === 'string' ? esc(c) : '<span class="mezera">_</span>')).join('');
  const moznosti = [spravne, ...spatne].sort((a, b) => (/[yý]/i.test(b) ? 1 : 0) - (/[yý]/i.test(a) ? 1 : 0));
  return { pokyn, otazka: zobraz, moznosti, spravna: moznosti.indexOf(spravne) };
}

function pocetZpameti(pocet) {
  const druh = nahodne(['x', 'x', '-', '+']);
  let otazka, v;
  let blizko;
  if (druh === 'x') { const a = cislo([3, 9]), b = cislo([3, 9]); otazka = `${a} × ${b}`; v = a * b; blizko = [v + a, v - a, v + b, v - b, v + 1, v - 1]; }
  else if (druh === '-') { const a = cislo([40, 99]), b = cislo([11, a - 10]); otazka = `${a} − ${b}`; v = a - b; }
  else { const a = cislo([25, 75]), b = cislo([16, 49]); otazka = `${a} + ${b}`; v = a + b; }
  const kandidati = zamichej([...new Set(blizko || [v + 1, v - 1, v + 10, v - 10, v + 2])].filter((x) => x >= 0 && x !== v));
  const moznosti = zamichej([v, ...kandidati.slice(0, pocet - 1)]);
  return { otazka: `${otazka} = ?`, moznosti: moznosti.map(String), spravna: moznosti.indexOf(v) };
}

function zamekZUloh(tema, z) {
  const defy = tema.ulohy.filter((u) => ['doplnovacka', 'diktat', 'urcovani', 'skladani', 'vyber'].includes(u.typ));
  const def = nahodne(defy);
  const pocet = z.moznosti || 3;
  if (def.typ === 'urcovani') {
    const veta = rozeber(nahodne(def.vety));
    const znacky = veta.filter((c) => typeof c !== 'string');
    const cil = nahodne(znacky);
    const zobraz = veta.map((c) => (typeof c === 'string' ? esc(c) : c === cil ? `<span class="svit">${esc(c.moznosti[0])}</span>` : esc(c.moznosti[0]))).join('');
    const spravne = def.moznosti.find((m) => m.hodnota === cil.moznosti[1]);
    const moznosti = [spravne, ...zamichej(def.moznosti.filter((m) => m !== spravne)).slice(0, pocet - 1)]
      .sort((a, b) => a.hodnota.localeCompare(b.hodnota));
    return { otazka: zobraz, moznosti: moznosti.map((m) => m.popis), spravna: moznosti.indexOf(spravne) };
  }
  if (def.typ === 'skladani') {
    const p = skladaniPolozka(def);
    const spravne = p.tokeny.join(' ') + p.konec;
    const varianty = new Set([spravne]);
    for (const spatny of zamichej(p.navic)) {
      if (varianty.size >= pocet) break;
      // nahradíme slovo, které se spletenému slovu nejvíc podobá (Do ↔ Does, play ↔ plays)
      const t = p.tokeny.slice();
      const i = t.findIndex((x) => x.toLowerCase().slice(0, 2) === spatny.toLowerCase().slice(0, 2));
      t[i >= 0 ? i : 0] = spatny;
      varianty.add(t.join(' ') + p.konec);
    }
    const moznosti = zamichej([...varianty]);
    return { otazka: '', moznosti, spravna: moznosti.indexOf(spravne), maleMoznosti: true };
  }
  if (def.typ === 'vyber') {
    const u = vyber(def);
    return { otazka: u.otazka, moznosti: u.moznosti.slice(0, pocet), spravna: u.spravna };
  }
  // doplňovačka / diktát: jedno slovo s mezerou
  const veta = rozeber(nahodne(def.vety));
  const iMezery = nahodne(veta.map((c, i) => (typeof c === 'string' ? -1 : i)).filter((i) => i >= 0));
  const pred = (veta[iMezery - 1] || '').split(/\s/).pop();
  const po = (veta[iMezery + 1] || '').split(/[\s,.!?]/)[0];
  return zamekZeSlova(`${pred}[${veta[iMezery].moznosti.join('|')}]${po}`, tema);
}

export function vytvorZamek(tema) {
  const z = tema.zamky || { generator: 'z-uloh' };
  let q;
  if (z.slova) q = zamekZeSlova(nahodne(z.slova), tema);
  else if (z.polozky) {
    const p = nahodne(z.polozky);
    const moznosti = zamichej(p.moznosti);
    q = { otazka: p.otazka, moznosti, spravna: moznosti.indexOf(p.moznosti[0]) };
  } else if (z.generator === 'pocty-zpameti') q = pocetZpameti(z.moznosti || 3);
  else q = zamekZUloh(tema, z);
  q.pokyn = q.pokyn || z.pokyn || 'Odemkni truhlu:';
  q.tema = tema.id;
  return q;
}

// Kontrola tématu (pro autory sad a testy): vrací seznam problémů.
export function zkontrolujTema(tema) {
  const chyby = [];
  if (!tema.id) chyby.push('chybí id');
  if (!Array.isArray(tema.ulohy) || !tema.ulohy.length) chyby.push('chybí ulohy');
  for (const u of tema.ulohy || []) if (!TYPY[u.typ]) chyby.push(`neznámý typ úlohy: ${u.typ}`);
  return chyby;
}
