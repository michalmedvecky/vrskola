// Generátory úloh. Položka v JSONu tématu říká, který generátor použít ("gen") a s jakými parametry ("param").
// Úloha: { zadani: HTML, kresba?: spec, kroky: [krok…], vysvetleni: HTML }.
// Krok: { otazka: HTML, typ: 'zlomek'|'cislo'|'volba'|'vybarvi'|'serad', spravne, tvar?, pevne?, napoveda?, moznosti?, karty?, n? }.
// V tréninku se nejdřív počítá po krocích; kdo už to umí, píše jen výsledek (poslední krok). Po chybě se
// úloha projde po krocích, aby bylo vidět, kde se to pokazilo.
import { Z, F, H, T, nsd, nsn, zkrat, plus, minus, krat, deleno, prevracene, rovno, porovnej, hodnota, jeZakladni,
  naSmisene, nah, vyber, zamichej, des, slozeny, text, parsuj } from './zlomek.js';

// ---------- pomocníci ----------
const kZ = (otazka, spravne, tvar = 'zakladni', x = {}) => ({ otazka, typ: 'zlomek', spravne: zkratPodleTvaru(spravne, tvar), tvar, ...x });
const zkratPodleTvaru = (z, tvar) => (tvar === 'presny' || tvar === 'libovolny' ? z : zkrat(z));
// České názvy dílů: tina(6) = 'šestina', tin(6) = 'šestin'. dilu(4) = '4 díly'.
const TINY = { 2: 'polovin', 3: 'třetin', 4: 'čtvrtin', 5: 'pětin', 6: 'šestin', 7: 'sedmin', 8: 'osmin', 9: 'devítin', 10: 'desetin', 11: 'jedenáctin', 12: 'dvanáctin', 20: 'dvacetin', 100: 'setin' };
const tin = (j) => TINY[j] || `${j}-tin`;
const tina = (j) => (TINY[j] ? TINY[j] + 'a' : `${j}-tina`);
const dilu = (n) => `${n} ${n === 1 ? 'díl' : n >= 2 && n <= 4 ? 'díly' : 'dílů'}`;
// Řetěz „= neskrácený = zkrácený = smíšené číslo“ bez opakování stejného zápisu.
function retez(surovy, v) {
  let s = Fz(surovy);
  v = zkrat(v);
  if (v.c !== surovy.c || v.j !== surovy.j) s += ' = ' + H(v, false);
  if (v.c > v.j && v.j > 1) s += ' = ' + smis(v);
  return s;
}
const kC = (otazka, spravne, x = {}) => ({ otazka, typ: 'cislo', spravne: typeof spravne === 'number' ? parsuj(String(spravne)) : spravne, ...x });
const kV = (otazka, moznosti, spravne, x = {}) => ({ otazka, typ: 'volba', moznosti, spravne, ...x });
const ZNAKY = [{ id: '<', html: '&lt;' }, { id: '=', html: '=' }, { id: '>', html: '&gt;' }];
const znak = (a, b) => ['<', '=', '>'][porovnej(a, b) + 1];
const VYSL = 'Výsledek v základním tvaru:';

function vlastni(minJ, maxJ, zakladni = true) {
  for (;;) { const j = nah(minJ, maxJ), c = nah(1, j - 1); if (!zakladni || nsd(c, j) === 1) return Z(c, j); }
}
const opakuj = (fn, test, max = 200) => { for (let i = 0; i < max; i++) { const x = fn(); if (test(x)) return x; } throw new Error('generátor nenašel úlohu'); };
const Fz = (z) => F(z.c, z.j);
const smis = (z) => H(z, true);
const nejvyse = (z, mez) => Math.abs(z.c) <= mez && z.j <= mez;

// Rozšíření dvou zlomků na společný jmenovatel jako kroky.
function krokySpolecny(a, b) {
  const n = nsn(a.j, b.j);
  return {
    n,
    kroky: [
      kC(`Nejmenší společný jmenovatel čísel ${a.j} a ${b.j}:`, n, { napoveda: `Hledej nejmenší číslo, které je dělitelné ${a.j} i ${b.j} (projdi násobky většího).` }),
      kZ(`Rozšiř ${Fz(a)} na jmenovatel ${n}:`, Z(a.c * n / a.j, n), 'presny', { pevne: { j: n }, napoveda: `${n} : ${a.j} = ${n / a.j}, takže čitatel vynásob ${n / a.j}.` }),
      kZ(`Rozšiř ${Fz(b)} na jmenovatel ${n}:`, Z(b.c * n / b.j, n), 'presny', { pevne: { j: n }, napoveda: `${n} : ${b.j} = ${n / b.j}, takže čitatel vynásob ${n / b.j}.` }),
    ],
  };
}

// ---------- 1. Co je zlomek ----------
const G = {};

G['obrazek'] = (p = {}) => {
  const n = nah(2, p.maxJ || 12), k = nah(1, n - 1), typ = vyber(n > 8 ? ['kolac', 'cokolada'] : ['kolac', 'pruh', 'cokolada']);
  return {
    zadani: 'Jaká část obrázku je vybarvená? Zapiš ji zlomkem.',
    kresba: { typ, n, k },
    kroky: [
      kC('Na kolik stejných dílů je celek rozdělený?', n, { napoveda: 'Spočítej všechny díly, vybarvené i nevybarvené. To bude jmenovatel.' }),
      kZ('Jaká část je vybarvená?', Z(k, n), 'libovolny', { bezCelych: true, napoveda: `Čitatel = počet vybarvených dílů, jmenovatel = počet všech dílů (${n}).` }),
    ],
    vysvetleni: `Celek má ${n} stejných dílů (jmenovatel), vybarvených je ${k} (čitatel): ${F(k, n)}.`,
  };
};

G['vybarvi'] = (p = {}) => {
  const z = vlastni(2, p.maxJ || 6, false), m = vyber(z.j <= 4 ? [1, 2, 3] : [1, 2]), n = z.j * m;
  const typ = vyber(['kolac', 'cokolada']);
  return {
    zadani: `Vybarvi ${Fz(z)} obrázku.` + (m > 1 ? ' Pozor, obrázek má víc dílů, než je jmenovatel.' : ''),
    kresba: { typ, n, k: 0 },
    kroky: [{ otazka: 'Klepni na díly, které chceš vybarvit, a potvrď.', typ: 'vybarvi', spravne: z, n, napoveda: m > 1 ? `Obrázek má ${dilu(n)}, tedy ${m}× víc než ${z.j}. Každou ${tina(z.j).replace(/a$/, 'u')} tvoří ${dilu(m)}, vybarvi jich ${z.c * m}.` : `Vybarvi ${z.c} z ${n}.` }],
    vysvetleni: `${Fz(z)} z ${n} dílů je ${n} : ${z.j} · ${z.c} = ${dilu(z.c * m)}.`,
  };
};

G['cast-z-cisla'] = (p = {}) => {
  const z = vlastni(2, p.maxJ || 10), q = nah(2, p.maxQ || 12), N = z.j * q;
  return {
    zadani: `Kolik je ${Fz(z)} z ${N}?`,
    kroky: [
      kC(`Kolik je ${F(1, z.j)} z ${N}?`, q, { napoveda: `Jedna ${tina(z.j)}: vyděl ${N} : ${z.j}.` }),
      kC(`Kolik je ${Fz(z)} z ${N}?`, z.c * q, { napoveda: `Jedna ${tina(z.j)} je ${q}. Ty chceš ${z.c} takové díly: ${q} · ${z.c}.` }),
    ],
    vysvetleni: `${N} : ${z.j} = ${q} (to je ${F(1, z.j)}), ${q} · ${z.c} = ${z.c * q}.`,
  };
};

G['osa'] = (p = {}) => {
  const deleni = nah(3, p.maxJ || 8), dokud = vyber([1, 2]), max = dokud * deleni;
  const c = opakuj(() => nah(1, max - 1), (x) => x % deleni !== 0);
  const pozice = zamichej([c, ...zamichej([...Array(max).keys()].slice(1).filter((x) => x !== c)).slice(0, 3)]);
  const pismena = ['A', 'B', 'C', 'D'];
  const body = pozice.sort((a, b) => a - b).map((x, i) => ({ pismeno: pismena[i], c: x }));
  const spravne = body.find((b) => b.c === c).pismeno;
  const z = Z(c, deleni);
  return {
    zadani: `Který bod na číselné ose znázorňuje číslo ${smis(z)}?`,
    kresba: { typ: 'osa', do: dokud, deleni, body },
    kroky: [
      kC('Na kolik dílků je rozdělený úsek od 0 do 1?', deleni, { napoveda: 'Spočítej mezery (ne čárky) mezi 0 a 1.' }),
      kV('Který bod to je?', pismena.map((x) => ({ id: x, html: x })), spravne, { napoveda: `Jeden dílek je ${F(1, deleni)}. Od nuly odpočítej ${c} dílků.` }),
    ],
    vysvetleni: `Úsek 0–1 má ${deleni} dílků, jeden dílek je ${F(1, deleni)}. Číslo ${Fz(z)} je ${c}. dílek od nuly: bod ${spravne}.`,
  };
};

// ---------- 2. Rozšiřování a krácení ----------
G['rozsir'] = (p = {}) => {
  const z = vlastni(2, 10), k = nah(2, p.maxK || 9), n = z.j * k;
  return {
    zadani: `Rozšiř zlomek ${Fz(z)} tak, aby měl jmenovatel ${n}.`,
    kroky: [
      kC(`Kolikrát je ${n} větší než ${z.j}?`, k, { napoveda: `${n} : ${z.j}` }),
      kZ(`${Fz(z)} = ?`, Z(z.c * k, n), 'presny', { pevne: { j: n }, napoveda: `Čitatel i jmenovatel vynásob stejným číslem (${k}).` }),
    ],
    vysvetleni: `${n} : ${z.j} = ${k}, takže ${F(z.c + ' · ' + k, z.j + ' · ' + k)} = ${F(z.c * k, n)}.`,
  };
};

G['dopln'] = () => {
  const z = vlastni(2, 9), k = nah(2, 8), velky = Z(z.c * k, z.j * k);
  const druh = nah(0, 3);
  // druh: 0 chybí čitatel vpravo (rozšiřování), 1 chybí jmenovatel vpravo, 2 chybí čitatel vlevo (krácení), 3 chybí jmenovatel vlevo
  const vlevo = druh < 2 ? z : velky, vpravo = druh < 2 ? velky : z;
  const chybiC = druh % 2 === 0;
  return {
    zadani: `Doplň chybějící číslo, aby se zlomky rovnaly: ${Fz(vlevo)} = ${chybiC ? F('?', vpravo.j) : F(vpravo.c, '?')}`,
    kroky: [kZ('Doplň:', vpravo, 'presny', { pevne: chybiC ? { j: vpravo.j } : { c: vpravo.c }, napoveda: chybiC ? `Zjisti, kolikrát se změnil jmenovatel (${vlevo.j} → ${vpravo.j}), a stejně změň čitatel.` : `Zjisti, kolikrát se změnil čitatel (${vlevo.c} → ${vpravo.c}), a stejně změň jmenovatel.` })],
    vysvetleni: `Čitatel i jmenovatel se ${druh < 2 ? 'násobí' : 'dělí'} stejným číslem ${k}: ${Fz(vlevo)} = ${Fz(vpravo)}.`,
  };
};

G['zkrat'] = (p = {}) => {
  const z = opakuj(() => (Math.random() < 0.25 ? Z(nah(3, 12), nah(2, 9)) : vlastni(2, 12)), (x) => jeZakladni(x) && x.c !== x.j && x.j > 1);
  const k = opakuj(() => nah(2, p.maxK || 12), (x) => z.c * x <= (p.max || 150) && z.j * x <= (p.max || 150));
  const v = Z(z.c * k, z.j * k);
  return {
    zadani: `Zkrať zlomek ${Fz(v)} na základní tvar.`,
    kroky: [
      kC(`Největší společný dělitel čísel ${v.c} a ${v.j}:`, k, { napoveda: `Hledej největší číslo, kterým jde vydělit ${v.c} i ${v.j}. Zkus 2, 3, 5… a pak je spoj.` }),
      kZ(VYSL, z, 'zakladni', { napoveda: `Čitatel i jmenovatel vyděl ${k}.` }),
    ],
    vysvetleni: `D(${v.c}, ${v.j}) = ${k}. ${F(v.c + ' : ' + k, v.j + ' : ' + k)} = ${Fz(z)}.`,
  };
};

G['zakladni-tvar'] = () => {
  const ok = vlastni(3, 15);
  const spatne = [];
  while (spatne.length < 3) {
    const b = vlastni(2, 9), k = nah(2, 5), x = Z(b.c * k, b.j * k);
    if (x.j <= 40 && !spatne.some((s) => s.c === x.c && s.j === x.j)) spatne.push(x);
  }
  const mozn = zamichej([ok, ...spatne]).map((z, i) => ({ id: String(i), html: Fz(z), z }));
  const spravne = mozn.find((m) => m.z === ok).id;
  return {
    zadani: 'Který zlomek je v základním tvaru (už nejde zkrátit)?',
    kroky: [kV('Vyber:', mozn.map(({ id, html }) => ({ id, html })), spravne, { napoveda: 'U každého zlomku zkus, jestli mají čitatel a jmenovatel společného dělitele (2, 3, 5, 7…).' })],
    vysvetleni: spatne.map((s) => `${Fz(s)} = ${Fz(zkrat(s))}`).join(', ') + `. Jen ${Fz(ok)} už zkrátit nejde.`,
  };
};

// ---------- 3. Porovnávání ----------
G['porovnej-snadne'] = () => {
  let a, b, rada;
  if (Math.random() < 0.5) {
    const j = nah(3, 15); const c1 = nah(1, j + 3), c2 = opakuj(() => nah(1, j + 3), (x) => x !== c1 || Math.random() < 0.1);
    a = Z(c1, j); b = Z(c2, j); rada = 'Stejné jmenovatele: větší je ten s větším čitatelem.';
  } else {
    const c = nah(1, 9); const j1 = nah(c + 1, 15), j2 = opakuj(() => nah(c + 1, 15), (x) => x !== j1);
    a = Z(c, j1); b = Z(c, j2); rada = 'Stejné čitatele: větší je ten s menším jmenovatelem (díly jsou větší).';
  }
  return {
    zadani: `Porovnej: ${Fz(a)} ☐ ${Fz(b)}`,
    kroky: [kV('Doplň znak:', ZNAKY, znak(a, b), { napoveda: rada })],
    vysvetleni: `${rada} ${Fz(a)} ${znak(a, b).replace('<', '&lt;').replace('>', '&gt;')} ${Fz(b)}.`,
  };
};

G['porovnej'] = (p = {}) => {
  const [a, b] = opakuj(() => {
    const a = Math.random() < 0.2 ? Z(nah(5, 14), nah(3, 9)) : vlastni(2, p.maxJ || 12);
    if (Math.random() < 0.12) { const k = nah(2, 4); return [a, Z(a.c * k, a.j * k)]; } // občas se rovnají
    return [a, vlastni(2, p.maxJ || 12)];
  }, ([a, b]) => a.j !== b.j && nsn(a.j, b.j) <= 72 && Math.abs(hodnota(a) - hodnota(b)) < 0.3);
  const s = krokySpolecny(a, b), A = a.c * s.n / a.j, B = b.c * s.n / b.j;
  return {
    zadani: `Porovnej: ${Fz(a)} ☐ ${Fz(b)}`,
    kroky: [...s.kroky, kV('Doplň znak:', ZNAKY, znak(a, b), { napoveda: `Porovnej čitatele: ${A} a ${B}.` })],
    vysvetleni: `Společný jmenovatel ${s.n}: ${Fz(a)} = ${F(A, s.n)}, ${Fz(b)} = ${F(B, s.n)}. Porovnáš čitatele ${A} a ${B}, proto ${Fz(a)} ${znak(a, b).replace('<', '&lt;').replace('>', '&gt;')} ${Fz(b)}.`,
  };
};

G['serad'] = (p = {}) => {
  const pocet = p.pocet || vyber([3, 4]);
  const zl = opakuj(() => Array.from({ length: pocet }, () => (Math.random() < 0.2 ? Z(nah(4, 13), nah(2, 9)) : vlastni(2, 12))),
    (a) => new Set(a.map((z) => z.c / z.j)).size === a.length && a.reduce((n, z) => nsn(n, z.j), 1) <= 120);
  const karty = zl.map((z, i) => ({ id: String(i), html: Fz(z), z }));
  const vzestupne = Math.random() < 0.6;
  const spravne = [...karty].sort((x, y) => (vzestupne ? 1 : -1) * porovnej(x.z, y.z)).map((k) => k.id);
  const n = zl.reduce((n, z) => nsn(n, z.j), 1);
  return {
    zadani: `Seřaď zlomky ${vzestupne ? 'od nejmenšího po největší' : 'od největšího po nejmenší'}.`,
    kroky: [
      kC(`Společný jmenovatel všech zlomků (nejmenší):`, n, { napoveda: `Nejmenší číslo dělitelné ${[...new Set(zl.map((z) => z.j))].join(', ')}.` }),
      { otazka: 'Klepej na zlomky ve správném pořadí:', typ: 'serad', karty: karty.map(({ id, html }) => ({ id, html })), spravne, napoveda: 'Převeď všechny na společný jmenovatel a porovnej čitatele: ' + zl.map((z) => `${Fz(z)} = ${F(z.c * n / z.j, n)}`).join(', ') },
    ],
    vysvetleni: zl.map((z) => `${Fz(z)} = ${F(z.c * n / z.j, n)}`).join(', ') + '. Pořadí: ' + spravne.map((id) => karty[id].html).join(vzestupne ? ' &lt; ' : ' &gt; ') + '.',
  };
};

G['mezi'] = () => {
  const [a, b] = opakuj(() => [vlastni(2, 9), vlastni(2, 9)], ([a, b]) => porovnej(a, b) < 0 && hodnota(b) - hodnota(a) >= 0.12 && hodnota(b) - hodnota(a) < 0.5);
  const n = nsn(a.j, b.j) * 2;
  const dobre = opakuj(() => vlastni(2, 24), (z) => porovnej(z, a) > 0 && porovnej(z, b) < 0 && z.j > 1);
  const spatne = [];
  for (let i = 0; spatne.length < 3 && i < 500; i++) {
    const z = vlastni(2, 20);
    if ((porovnej(z, a) <= 0 || porovnej(z, b) >= 0) && !spatne.some((s) => rovno(s, z))) spatne.push(z);
  }
  const mozn = zamichej([dobre, ...spatne]).map((z, i) => ({ id: String(i), html: Fz(z), z }));
  return {
    zadani: `Který zlomek leží mezi ${Fz(a)} a ${Fz(b)}?`,
    kroky: [kV('Vyber:', mozn.map(({ id, html }) => ({ id, html })), mozn.find((m) => m.z === dobre).id, { napoveda: `Převeď na desetinná čísla nebo na společný jmenovatel: ${Fz(a)} ≈ ${des(hodnota(a), 2)}, ${Fz(b)} ≈ ${des(hodnota(b), 2)}.` })],
    vysvetleni: `${Fz(a)} ≈ ${des(hodnota(a), 3)}, ${Fz(b)} ≈ ${des(hodnota(b), 3)} a ${Fz(dobre)} ≈ ${des(hodnota(dobre), 3)} leží mezi nimi. (Společný jmenovatel pomůže taky: ${n}.)`,
  };
};

// ---------- 4. Zlomky a desetinná čísla, procenta ----------
const DESETINNE_JM = [2, 4, 5, 10, 20, 25, 50, 8, 100];
const mocnina = (j) => [10, 100, 1000].find((m) => m % j === 0);

G['na-desetinne'] = () => {
  const j = vyber(DESETINNE_JM), c = opakuj(() => nah(1, Math.random() < 0.2 ? 2 * j : j - 1), (x) => x % j !== 0 && nsd(x, j) === 1);
  const m = mocnina(j), z = Z(c, j);
  return {
    zadani: `Převeď na desetinné číslo: ${Fz(z)}`,
    kroky: [
      kZ(`Rozšiř na jmenovatel ${m}:`, Z(c * m / j, m), 'presny', { pevne: { j: m }, napoveda: `${m} : ${j} = ${m / j}` }),
      kC('Desetinné číslo:', z, { desetinne: true, napoveda: `${F(c * m / j, m)}: jmenovatel ${m} má ${String(m).length - 1} nuly, posuň desetinnou čárku o ${String(m).length - 1} místa doleva.` }),
    ],
    vysvetleni: `${Fz(z)} = ${F(c * m / j, m)} = ${des(c / j)}.`,
  };
};

G['na-zlomek'] = () => {
  const j = vyber([10, 100, 100, 1000, 4, 5, 20, 25, 8, 50]), c = opakuj(() => nah(1, j * (Math.random() < 0.2 ? 2 : 1) - 1), (x) => x % j !== 0 && zkrat(Z(x, j)).j <= 200);
  const z = zkrat(Z(c, j)), m = mocnina(z.j), cit = z.c * m / z.j;
  return {
    zadani: `Zapiš desetinné číslo ${des(hodnota(z))} jako zlomek v základním tvaru.`,
    kroky: [
      kZ(`Zapiš jako zlomek se jmenovatelem ${m}:`, Z(cit, m), 'presny', { pevne: { j: m }, napoveda: `Počet desetinných míst = počet nul ve jmenovateli.` }),
      kZ(VYSL, z, 'zakladni', { napoveda: `Zkrať ${F(cit, m)}. Společný dělitel je ${nsd(cit, m)}.` }),
    ],
    vysvetleni: `${des(hodnota(z))} = ${F(cit, m)} = ${H(z, false)}${z.c > z.j ? ' = ' + smis(z) : ''}.`,
  };
};

G['procenta'] = () => {
  const j = vyber([2, 4, 5, 10, 20, 25, 50]), c = opakuj(() => nah(1, j - 1), (x) => nsd(x, j) === 1);
  const z = Z(c, j), pr = c * 100 / j;
  if (Math.random() < 0.5) {
    return {
      zadani: `Kolik procent je ${Fz(z)}?`,
      kroky: [
        kZ('Rozšiř na jmenovatel 100:', Z(pr, 100), 'presny', { pevne: { j: 100 }, napoveda: `100 : ${j} = ${100 / j}` }),
        kC('Kolik je to procent?', pr, { jednotka: '%', napoveda: `Procento = setina. ${F(pr, 100)} = ${pr} %.` }),
      ],
      vysvetleni: `${Fz(z)} = ${F(pr, 100)} = ${pr} %.`,
    };
  }
  return {
    zadani: `Zapiš ${pr} % jako zlomek v základním tvaru.`,
    kroky: [
      kZ('Zapiš jako zlomek se jmenovatelem 100:', Z(pr, 100), 'presny', { pevne: { j: 100 }, napoveda: 'Procento znamená setina.' }),
      kZ(VYSL, z, 'zakladni', { napoveda: `Zkrať ${F(pr, 100)}, společný dělitel je ${nsd(pr, 100)}.` }),
    ],
    vysvetleni: `${pr} % = ${F(pr, 100)} = ${Fz(z)}.`,
  };
};

// ---------- 5. Smíšená čísla ----------
G['na-smisene'] = () => {
  const j = nah(2, 10), w = nah(1, 9), r = nah(1, j - 1), k = Math.random() < 0.2 ? nah(2, 3) : 1;
  const z = Z((w * j + r) * k, j * k);
  return {
    zadani: `Převeď ${Fz(z)} na smíšené číslo.`,
    kroky: [
      kC(`Kolikrát se ${z.j} vejde do ${z.c}? (${z.c} : ${z.j} = ? celých)`, w, { napoveda: `Hledej největší násobek ${z.j}, který není větší než ${z.c}.` }),
      kC(`Kolik zbyde? (${z.c} − ${w} · ${z.j})`, r * k, { napoveda: `${z.c} − ${w * z.j}` }),
      kZ('Smíšené číslo:', z, 'smisene', { napoveda: `Celá část ${w}, zlomek ${F(r * k, z.j)}${nsd(r * k, z.j) > 1 ? ' – a ten ještě zkrať' : ''}.` }),
    ],
    vysvetleni: `${z.c} : ${z.j} = ${w}, zbytek ${r * k}. ${Fz(z)} = ${F(r * k, z.j, w)}${nsd(r * k, z.j) > 1 ? ' = ' + smis(z) : ''}.`,
  };
};

G['na-nepravy'] = () => {
  const j = nah(2, 12), w = nah(1, 9), r = opakuj(() => nah(1, j - 1), (x) => nsd(x, j) === 1), c = w * j + r;
  return {
    zadani: `Převeď smíšené číslo ${F(r, j, w)} na zlomek.`,
    kroky: [
      kC(`Kolik ${tin(j)} je v ${w} ${w === 1 ? "celku" : "celých"}? (${w} · ${j})`, w * j, { napoveda: `Každý celek má ${j} dílů.` }),
      kZ('Zlomek (bez celé části):', Z(c, j), 'nepravy', { bezCelych: true, napoveda: `K ${w * j} přičti ${r}, jmenovatel zůstává ${j}.` }),
    ],
    vysvetleni: `${F(r, j, w)} = ${F(`${w} · ${j} + ${r}`, j)} = ${F(c, j)}.`,
  };
};

// ---------- 6. Sčítání a odčítání ----------
function scitaniKroky(a, b, op, p = {}) {
  const v = op === '+' ? plus(a, b) : minus(a, b);
  if (a.j === b.j) {
    const surovy = Z(op === '+' ? a.c + b.c : a.c - b.c, a.j);
    return {
      v,
      kroky: [
        kZ(`${op === '+' ? 'Sečti' : 'Odečti'} čitatele, jmenovatel opiš:`, surovy, 'presny', { pevne: { j: a.j }, napoveda: `${a.c} ${op === '+' ? '+' : '−'} ${b.c}` }),
        kZ(VYSL, v, 'zakladni', { napoveda: `Zkrať ${Fz(surovy)}, případně převeď na smíšené číslo.`, preskoc: jeZakladni(surovy) && surovy.c < surovy.j }),
      ],
      postup: `${F(`${a.c} ${op === '+' ? '+' : '−'} ${b.c}`, a.j)} = ${Fz(surovy)}${rovno(surovy, v) && jeZakladni(surovy) ? '' : ' = ' + H(v, false)}`,
    };
  }
  const s = krokySpolecny(a, b), A = a.c * s.n / a.j, B = b.c * s.n / b.j;
  const surovy = Z(op === '+' ? A + B : A - B, s.n);
  return {
    v,
    kroky: [...s.kroky, kZ(op === '+' ? 'Sečti:' : 'Odečti:', surovy, 'presny', { pevne: { j: s.n }, napoveda: `${A} ${op === '+' ? '+' : '−'} ${B}` }),
      kZ(VYSL, v, 'zakladni', { napoveda: `Zkrať ${Fz(surovy)}${surovy.c > surovy.j ? ' a klidně převeď na smíšené číslo' : ''}.`, preskoc: jeZakladni(surovy) && surovy.c < surovy.j })],
    postup: `${F(A, s.n)} ${op === '+' ? '+' : '−'} ${F(B, s.n)} = ${Fz(surovy)}${jeZakladni(surovy) && surovy.c < surovy.j ? '' : ' = ' + H(v, false) + (v.c > v.j && v.j > 1 ? ' = ' + smis(v) : '')}`,
  };
}
// Když je součet po sečtení čitatelů už v základním tvaru a menší než 1, poslední krok by jen opakoval výsledek: vynech ho.
const pripravPreskoc = (u) => {
  const posl = u.kroky[u.kroky.length - 1];
  if (posl.preskoc && u.kroky.length > 1) { u.kroky.pop(); u.kroky[u.kroky.length - 1].otazka += ' (to je už výsledek)'; }
  return u;
};

G['scitani-stejny'] = (p = {}) => {
  const op = p.op || vyber(['+', '−']);
  const j = nah(3, 15);
  const [c1, c2] = opakuj(() => [nah(1, j + 2), nah(1, j - 1)], ([a, b]) => (op === '+' || a > b) && a % j !== 0);
  const a = Z(c1, j), b = Z(c2, j), s = scitaniKroky(a, b, op === '+' ? '+' : '-');
  return pripravPreskoc({ zadani: `Vypočítej: ${Fz(a)} ${op} ${Fz(b)}`, kroky: s.kroky, vysvetleni: s.postup + '.' });
};

G['scitani'] = (p = {}) => {
  const op = p.op || '+';
  const [a, b] = opakuj(() => [vlastni(2, p.maxJ || 12), vlastni(2, p.maxJ || 12)],
    ([a, b]) => a.j !== b.j && nsn(a.j, b.j) <= (p.maxN || 60) && (op === '+' || porovnej(a, b) > 0));
  const s = scitaniKroky(a, b, op === '+' ? '+' : '-');
  return pripravPreskoc({ zadani: `Vypočítej: ${Fz(a)} ${op} ${Fz(b)}`, kroky: s.kroky, vysvetleni: s.postup + '.' });
};

G['smisene-scitani'] = (p = {}) => {
  const op = p.op || vyber(['+', '−']);
  const [a, b] = opakuj(() => {
    const j1 = nah(2, 8), j2 = nah(2, 8);
    return [Z(nah(1, 5) * j1 + opakuj(() => nah(1, j1 - 1), (x) => nsd(x, j1) === 1), j1), Z(nah(0, 3) * j2 + opakuj(() => nah(1, j2 - 1), (x) => nsd(x, j2) === 1), j2)];
  }, ([a, b]) => nsn(a.j, b.j) <= 40 && (op === '+' || porovnej(a, b) > 0));
  const v = op === '+' ? plus(a, b) : minus(a, b);
  const n = nsn(a.j, b.j);
  return {
    zadani: `Vypočítej: ${smis(a)} ${op} ${smis(b)}`,
    kroky: [
      kZ(`Převeď ${smis(a)} na zlomek:`, a, 'nepravy', { bezCelych: true, napoveda: `${naSmisene(a).w} · ${a.j} + ${naSmisene(a).c}` }),
      ...(b.c > b.j ? [kZ(`Převeď ${smis(b)} na zlomek:`, b, 'nepravy', { bezCelych: true, napoveda: `${naSmisene(b).w} · ${b.j} + ${naSmisene(b).c}` })] : []),
      ...(a.j !== b.j ? [kC(`Společný jmenovatel ${a.j} a ${b.j}:`, n, { napoveda: `Nejmenší číslo dělitelné ${a.j} i ${b.j}.` })] : []),
      kZ('Výsledek (zlomek v základním tvaru nebo smíšené číslo):', v, 'zakladni', { napoveda: `${F(a.c * n / a.j, n)} ${op} ${F(b.c * n / b.j, n)}` }),
    ],
    vysvetleni: `${Fz(a)} ${op} ${Fz(b)} = ${F(a.c * n / a.j, n)} ${op} ${F(b.c * n / b.j, n)} = ${H(v, false)}${v.c > v.j && v.j > 1 ? ' = ' + smis(v) : ''}.`,
  };
};

// ---------- 7. Násobení ----------
function nasobKroky(a, b) {
  const surovy = Z(a.c * b.c, a.j * b.j), v = zkrat(surovy);
  return [
    kZ('Čitatel krát čitatel, jmenovatel krát jmenovatel (můžeš i krátit předem):', surovy, 'libovolny', { napoveda: `${F(`${a.c} · ${b.c}`, `${a.j} · ${b.j}`)}. Dřív než násobíš, můžeš krátit čitatele s jmenovatelem „do kříže“.`, preskocDalsi: true }),
    kZ(VYSL, v, 'zakladni', { napoveda: `Zkrať ${Fz(surovy)}.` }),
  ];
}
G['nasob-cele'] = () => {
  const a = vlastni(2, 12), n = nah(2, 12), b = Z(n, 1), v = krat(a, b);
  const vlevo = Math.random() < 0.5;
  return {
    zadani: `Vypočítej: ${vlevo ? `${n} · ${Fz(a)}` : `${Fz(a)} · ${n}`}`,
    kroky: [
      kZ('Vynásob čitatel celým číslem, jmenovatel opiš:', Z(a.c * n, a.j), 'libovolny', { napoveda: `Celé číslo ${n} = ${F(n, 1)}. ${F(`${a.c} · ${n}`, a.j)}`, preskocDalsi: true }),
      kZ(VYSL, v, 'zakladni', { napoveda: `Zkrať ${F(a.c * n, a.j)}.` }),
    ],
    vysvetleni: `${F(`${a.c} · ${n}`, a.j)} = ${retez(Z(a.c * n, a.j), v)}.`,
  };
};
G['nasob'] = () => {
  const [a, b] = opakuj(() => [Math.random() < 0.2 ? Z(nah(3, 11), nah(2, 7)) : vlastni(2, 12), vlastni(2, 12)], ([a, b]) => a.c * b.c <= 200 && a.j * b.j <= 200 && jeZakladni(a));
  const v = krat(a, b);
  return {
    zadani: `Vypočítej: ${Fz(a)} · ${Fz(b)}`,
    kroky: nasobKroky(a, b),
    vysvetleni: `${F(`${a.c} · ${b.c}`, `${a.j} · ${b.j}`)} = ${retez(Z(a.c * b.c, a.j * b.j), v)}.`,
  };
};
G['nasob-smisene'] = () => {
  const j1 = nah(2, 6), a = Z(nah(1, 3) * j1 + opakuj(() => nah(1, j1 - 1), (x) => nsd(x, j1) === 1), j1);
  const b = opakuj(() => vlastni(2, 10), (b) => a.c * b.c <= 150);
  const v = krat(a, b);
  return {
    zadani: `Vypočítej: ${smis(a)} · ${Fz(b)}`,
    kroky: [
      kZ(`Převeď ${smis(a)} na zlomek:`, a, 'nepravy', { bezCelych: true, napoveda: 'Smíšené číslo se násobit nedá „po částech“. Převeď ho na zlomek: celé · jmenovatel + čitatel.' }),
      ...nasobKroky(a, b),
    ],
    vysvetleni: `${smis(a)} = ${Fz(a)}; ${F(`${a.c} · ${b.c}`, `${a.j} · ${b.j}`)} = ${retez(Z(a.c * b.c, a.j * b.j), v)}.`,
  };
};

// ---------- 8. Dělení ----------
G['prevracene'] = () => {
  const druh = nah(0, 2);
  const z = druh === 0 ? vlastni(2, 12) : druh === 1 ? Z(nah(2, 15), 1) : (() => { const j = nah(2, 7); return Z(nah(1, 3) * j + opakuj(() => nah(1, j - 1), (x) => nsd(x, j) === 1), j); })();
  const html = druh === 2 ? smis(z) : H(z);
  return {
    zadani: `Jaké je převrácené číslo k ${html}?`,
    kroky: [
      ...(druh === 2 ? [kZ(`Převeď ${html} na zlomek:`, z, 'nepravy', { bezCelych: true, napoveda: 'celé · jmenovatel + čitatel' })] : []),
      kZ('Převrácené číslo:', prevracene(z), 'libovolny', { napoveda: druh === 1 ? `${z.c} = ${F(z.c, 1)}. Prohoď čitatel a jmenovatel.` : 'Prohoď čitatel a jmenovatel.' }),
    ],
    vysvetleni: `${druh === 2 ? `${html} = ${Fz(z)}, ` : druh === 1 ? `${z.c} = ${F(z.c, 1)}, ` : ''}převrácené číslo je ${H(prevracene(z), false)} (jejich součin je 1).`,
  };
};
G['del'] = () => {
  const [a, b] = opakuj(() => [vlastni(2, 12), Math.random() < 0.25 ? Z(nah(3, 9), nah(2, 5)) : vlastni(2, 12)], ([a, b]) => a.c * b.j <= 200 && a.j * b.c <= 200 && jeZakladni(b));
  const v = deleno(a, b), pb = prevracene(b);
  return {
    zadani: `Vypočítej: ${Fz(a)} : ${Fz(b)}`,
    kroky: [
      kZ(`Dělit zlomkem = násobit převráceným číslem. Převrácené číslo k ${Fz(b)}:`, pb, 'libovolny', { napoveda: 'Prohoď čitatel a jmenovatel dělitele.' }),
      ...nasobKroky(a, pb).map((k, i) => (i === 0 ? { ...k, otazka: `${Fz(a)} · ${Fz(pb)} = ? (můžeš krátit předem)` } : k)),
    ],
    vysvetleni: `${Fz(a)} : ${Fz(b)} = ${Fz(a)} · ${Fz(pb)} = ${retez(Z(a.c * pb.c, a.j * pb.j), v)}.`,
  };
};
G['del-cele'] = () => {
  const a = vlastni(2, 12), n = nah(2, 9), vlevo = Math.random() < 0.6;
  const A = vlevo ? a : Z(n, 1), B = vlevo ? Z(n, 1) : a, v = deleno(A, B), pb = prevracene(B);
  return {
    zadani: `Vypočítej: ${H(A)} : ${H(B)}`,
    kroky: [
      kZ(`Převrácené číslo k ${H(B)}:`, pb, 'libovolny', { napoveda: vlevo ? `${n} = ${F(n, 1)}, převrácené je ${F(1, '?')}` : 'Prohoď čitatel a jmenovatel.' }),
      ...nasobKroky(A, pb).map((k, i) => (i === 0 ? { ...k, otazka: `${H(A)} · ${Fz(pb)} = ?` } : k)),
    ],
    vysvetleni: `${H(A)} : ${H(B)} = ${H(A)} · ${Fz(pb)} = ${retez(Z(A.c * pb.c, A.j * pb.j), v)}.`,
  };
};

// ---------- 9. Složené zlomky a pořadí operací ----------
G['slozeny'] = () => {
  const [a, b] = opakuj(() => [vlastni(2, 10), vlastni(2, 10)], ([a, b]) => !rovno(a, b) && a.c * b.j <= 150 && a.j * b.c <= 150);
  const v = deleno(a, b), pb = prevracene(b);
  return {
    zadani: `Vypočítej složený zlomek: ${slozeny(Fz(a), Fz(b))}`,
    kroky: [
      kV('Složený zlomek znamená…', [{ id: 'd', html: `${Fz(a)} : ${Fz(b)}` }, { id: 'n', html: `${Fz(a)} · ${Fz(b)}` }, { id: 'm', html: `${Fz(a)} − ${Fz(b)}` }], 'd', { napoveda: 'Hlavní zlomková čára je dělení: horní část děleno dolní částí.' }),
      kZ(`${Fz(a)} · ${Fz(pb)} = ?`, Z(a.c * pb.c, a.j * pb.j), 'libovolny', { napoveda: 'Dělit = násobit převráceným číslem.', preskocDalsi: true }),
      kZ(VYSL, v, 'zakladni', { napoveda: 'Zkrať.' }),
    ],
    vysvetleni: `${Fz(a)} : ${Fz(b)} = ${Fz(a)} · ${Fz(pb)} = ${retez(Z(a.c * pb.c, a.j * pb.j), v)}. Vnější čísla se násobí spolu (${a.c} · ${b.j}) a vnitřní spolu (${a.j} · ${b.c}).`,
  };
};
const vyraz = (a, op, b) => `${H(a)} ${op} ${H(b)}`;
const spocti = (a, op, b) => ({ '+': plus, '−': minus, '·': krat, ':': deleno })[op](a, b);
function jednoduchyVyraz(maxJ = 8) {
  const op = vyber(['+', '−', '+', '·']);
  return opakuj(() => {
    const a = Math.random() < 0.3 ? Z(nah(1, 3), 1) : vlastni(2, maxJ), b = vlastni(2, maxJ);
    return { a, op, b, v: spocti(a, op, b) };
  }, (x) => x.v.c > 0 && nejvyse(x.v, 40) && (x.op !== '+' && x.op !== '−' || nsn(x.a.j, x.b.j) <= 24));
}
G['slozeny-vyraz'] = () => {
  const { h, d, v } = opakuj(() => {
    const h = jednoduchyVyraz(), d = jednoduchyVyraz();
    return { h, d, v: deleno(h.v, d.v) };
  }, (x) => !rovno(x.h.v, x.d.v) && nejvyse(x.v, 60));
  return {
    zadani: `Vypočítej: ${slozeny(vyraz(h.a, h.op, h.b), vyraz(d.a, d.op, d.b))}`,
    kroky: [
      kZ('Nejdřív horní část (čitatel):', h.v, 'libovolny', { napoveda: h.op === '·' ? 'Násob čitatel čitatelem a jmenovatel jmenovatelem.' : 'Převeď na společný jmenovatel.' }),
      kZ('Pak dolní část (jmenovatel):', d.v, 'libovolny', { napoveda: d.op === '·' ? 'Násob čitatel čitatelem a jmenovatel jmenovatelem.' : 'Převeď na společný jmenovatel.' }),
      kZ(VYSL, v, 'zakladni', { napoveda: `Teď ${H(h.v, false)} : ${H(d.v, false)} – děl jako násobení převráceným číslem.` }),
    ],
    vysvetleni: `Nahoře ${vyraz(h.a, h.op, h.b)} = ${H(h.v, false)}, dole ${vyraz(d.a, d.op, d.b)} = ${H(d.v, false)}. ${H(h.v, false)} : ${H(d.v, false)} = ${H(v, false)}${v.c > v.j && v.j > 1 ? ' = ' + smis(v) : ''}.`,
  };
};
G['poradi'] = () => {
  const x = opakuj(() => {
    const a = vlastni(2, 9), b = vlastni(2, 9), c = Math.random() < 0.3 ? Z(nah(2, 6), 1) : vlastni(2, 9);
    const op1 = vyber(['+', '−']), op2 = vyber(['·', ':']);
    const m = spocti(b, op2, c), v = spocti(a, op1, m);
    return { a, b, c, op1, op2, m, v };
  }, (x) => x.v.c > 0 && nejvyse(x.m, 40) && nejvyse(x.v, 60) && nsn(x.a.j, x.m.j) <= 36);
  return {
    zadani: `Vypočítej: ${H(x.a)} ${x.op1} ${H(x.b)} ${x.op2} ${H(x.c)}`,
    kroky: [
      kV('Co se počítá jako první?', [{ id: '1', html: `${H(x.a)} ${x.op1} ${H(x.b)}` }, { id: '2', html: `${H(x.b)} ${x.op2} ${H(x.c)}` }], '2', { napoveda: 'Násobení a dělení má přednost před sčítáním a odčítáním.' }),
      kZ(`${H(x.b)} ${x.op2} ${H(x.c)} = ?`, x.m, 'libovolny', { napoveda: x.op2 === ':' ? 'Dělit = násobit převráceným číslem.' : 'Čitatel krát čitatel, jmenovatel krát jmenovatel.' }),
      kZ(VYSL, x.v, 'zakladni', { napoveda: `${H(x.a)} ${x.op1} ${H(x.m, false)}: převeď na společný jmenovatel.` }),
    ],
    vysvetleni: `Nejdřív ${H(x.b)} ${x.op2} ${H(x.c)} = ${H(x.m, false)}, pak ${H(x.a)} ${x.op1} ${H(x.m, false)} = ${H(x.v, false)}${x.v.c > x.v.j && x.v.j > 1 ? ' = ' + smis(x.v) : ''}.`,
  };
};

// ---------- 10. Slovní úlohy (texty jsou v JSONu tématu, počítání tady) ----------
// Šablona: { text: "... {N} ... {z} ...", jednotka, rozsah: [min q, max q], maxJ }. {z} = zlomek, {N} = celek, {X} = část.
const dosad = (s, h) => text(s).replace(/\{(\w+)\}/g, (_, k) => (k in h ? h[k] : `{${k}}`));

G['slovni-cast'] = (p, data) => {
  const s = vyber(data.sablony['slovni-cast']);
  const z = vlastni(2, s.maxJ || 10), q = nah(...(s.rozsah || [2, 12])), N = z.j * q;
  return {
    zadani: dosad(s.text, { z: Fz(z), N }),
    kroky: [
      kC(`Kolik je ${F(1, z.j)} z ${N}?`, q, { jednotka: s.jednotka, napoveda: `${N} : ${z.j}` }),
      kC('Odpověď:', z.c * q, { jednotka: s.jednotka, napoveda: `${q} · ${z.c}` }),
    ],
    vysvetleni: `${F(1, z.j)} z ${N} je ${N} : ${z.j} = ${q}; ${Fz(z)} je ${q} · ${z.c} = ${z.c * q} ${s.jednotka || ''}.`,
  };
};
G['slovni-celek'] = (p, data) => {
  const s = vyber(data.sablony['slovni-celek']);
  const z = vlastni(2, s.maxJ || 10), q = nah(...(s.rozsah || [2, 12])), N = z.j * q, X = z.c * q;
  return {
    zadani: dosad(s.text, { z: Fz(z), X }),
    kroky: [
      ...(z.c > 1 ? [kC(`Kolik je ${F(1, z.j)} celku? (${Fz(z)} je ${X})`, q, { jednotka: s.jednotka, napoveda: `${dilu(z.c)} = ${X}, jeden díl je ${X} : ${z.c}.` })] : []),
      kC('Kolik je celek?', N, { jednotka: s.jednotka, napoveda: `Celek má ${dilu(z.j)}: ${q} · ${z.j}.` }),
    ],
    vysvetleni: `${Fz(z)} je ${X}${z.c > 1 ? `, takže ${F(1, z.j)} je ${X} : ${z.c} = ${q}` : ''} a celek (${F(z.j, z.j)}) je ${q} · ${z.j} = ${N} ${s.jednotka || ''}.`,
  };
};
G['slovni-zbytek'] = (p, data) => {
  const s = vyber(data.sablony['slovni-zbytek']);
  const [a, b] = opakuj(() => [vlastni(2, 8), vlastni(2, 8)], ([a, b]) => a.j !== b.j && hodnota(a) + hodnota(b) < 0.95 && nsn(a.j, b.j) <= 40);
  const soucet = plus(a, b), zb = minus(Z(1), soucet);
  const N = nsn(a.j, b.j) * nah(...(s.rozsah || [1, 6]));
  const kroky = [
    kZ('Jaká část už je hotová (dohromady)?', soucet, 'zakladni', { napoveda: `${Fz(a)} + ${Fz(b)}: převeď na společný jmenovatel ${nsn(a.j, b.j)}.` }),
    kZ('Jaká část zbývá?', zb, 'zakladni', { napoveda: `Celek je 1 = ${F(soucet.j, soucet.j)}. Odečti ${Fz(soucet)}.` }),
  ];
  if (s.otazkaN) kroky.push(kC(dosad(s.otazkaN, { N }), zb.c * N / zb.j, { jednotka: s.jednotka, napoveda: `${Fz(zb)} z ${N}: ${N} : ${zb.j} · ${zb.c}` }));
  return {
    zadani: dosad(s.text, { z1: Fz(a), z2: Fz(b), N }) + (s.otazkaN ? '' : ' Jaká část zbývá?'),
    kroky,
    vysvetleni: `${Fz(a)} + ${Fz(b)} = ${Fz(soucet)}, zbývá 1 − ${Fz(soucet)} = ${Fz(zb)}${s.otazkaN ? `, tj. ${N} : ${zb.j} · ${zb.c} = ${zb.c * N / zb.j} ${s.jednotka || ''}` : ''}.`,
  };
};
G['slovni-zbytku'] = (p, data) => {
  const s = vyber(data.sablony['slovni-zbytku']);
  const a = vlastni(2, 6), b = vlastni(2, 6);
  const zb1 = minus(Z(1), a), druhy = krat(b, zb1), zust = minus(zb1, druhy);
  const N = [a.j, b.j, zb1.j, druhy.j, zust.j].reduce(nsn, 1) * nah(...(s.rozsah || [1, 5]));
  return {
    zadani: dosad(s.text, { z1: Fz(a), z2: Fz(b), N }),
    kroky: [
      kZ('Jaká část zbyla po prvním kroku?', zb1, 'zakladni', { napoveda: `1 − ${Fz(a)}` }),
      kZ(`Kolik je ${Fz(b)} ze zbytku (jaká část celku)?`, druhy, 'zakladni', { napoveda: `„${Fz(b)} ze zbytku“ = ${Fz(b)} · ${Fz(zb1)}` }),
      ...(s.otazkaN
        ? [kZ('Jaká část celku zůstala?', zust, 'zakladni', { napoveda: `${Fz(zb1)} − ${Fz(druhy)}` }), kC(dosad(s.otazkaN, { N }), zust.c * N / zust.j, { jednotka: s.jednotka, napoveda: `${Fz(zust)} z ${N}` })]
        : [kZ('Jaká část celku zůstala?', zust, 'zakladni', { napoveda: `${Fz(zb1)} − ${Fz(druhy)}` })]),
    ],
    vysvetleni: `Po prvním kroku zbylo 1 − ${Fz(a)} = ${Fz(zb1)}. ${Fz(b)} ze zbytku je ${Fz(b)} · ${Fz(zb1)} = ${Fz(druhy)} celku. Zůstalo ${Fz(zb1)} − ${Fz(druhy)} = ${Fz(zust)}${s.otazkaN ? `, tedy ${zust.c * N / zust.j} ${s.jednotka || ''} z ${N}` : ''}.`,
  };
};

// Pevné úlohy přímo z JSONu (typ úloh z přijímaček). Viz README: { zadani, kresba?, kroky: [{ otazka, typ, spravne, tvar?, moznosti?, napoveda? }], vysvetleni }.
export function pevnaUloha(u) {
  return {
    zadani: text(u.zadani),
    kresba: u.kresba,
    kroky: u.kroky.map((k) => {
      const typ = k.typ || 'zlomek';
      if (typ === 'volba') return kV(text(k.otazka || 'Vyber:'), k.moznosti.map((m, i) => ({ id: String(i), html: text(m) })), String(k.spravne), { napoveda: k.napoveda && text(k.napoveda) });
      if (typ === 'cislo') return kC(text(k.otazka || 'Výsledek:'), parsuj(k.spravne), { jednotka: k.jednotka, desetinne: /[,.]/.test(String(k.spravne)), napoveda: k.napoveda && text(k.napoveda) });
      return kZ(text(k.otazka || VYSL), parsuj(k.spravne), k.tvar || 'zakladni', { napoveda: k.napoveda && text(k.napoveda) });
    }),
    vysvetleni: text(u.vysvetleni || ''),
  };
}
G['pevne'] = (p, data, posledni = []) => {
  const seznam = data.pevne[p.sada || 'cermat'];
  const volne = seznam.filter((u) => !posledni.includes(u.zadani));
  return { ...pevnaUloha(vyber(volne.length ? volne : seznam)) };
};

export function generuj(gen, param, data, posledni) {
  const fn = G[gen];
  if (!fn) throw new Error('Neznámý generátor: ' + gen);
  const u = fn(param || {}, data, posledni);
  u.kroky.forEach((k, i) => { if (!k.napoveda) k.napoveda = ''; k.i = i; });
  // Krok pro režim „jen výsledek“: poslední krok, ale bez předvyplněného jmenovatele (ten by prozradil postup).
  if (!u.vysledek) {
    const posl = u.kroky[u.kroky.length - 1];
    u.vysledek = posl.pevne ? { ...posl, pevne: undefined, tvar: 'zakladni', spravne: zkrat(posl.spravne), otazka: VYSL } : { ...posl };
    if (u.kroky.length > 1 && !posl.pevne && posl.typ !== 'volba' && posl.typ !== 'serad') u.vysledek.otazka = posl.otazka.replace(/^Odpověď:$/, 'Odpověď:');
  }
  return u;
}
export const GENERATORY = Object.keys(G);
