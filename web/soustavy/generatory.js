// Generátory úloh na soustavy rovnic. Položka v JSONu tématu říká, který generátor použít ("gen") a s jakými
// parametry ("param"). Úloha: { zadani: HTML, kresba?: spec, kroky: [krok…], vysledek?: krok, vysvetleni: HTML }.
// Krok: { otazka: HTML, typ: 'cisla'|'volba', pole?, spravne, alt?, umer?, vzor?, napoveda?, moznosti? } (viz cisla.js).
// V tréninku se nejdřív počítá po krocích; kdo už to umí, píše jen výsledek (u soustav obvykle dvojici x, y).
// Po chybě se úloha projde po krocích, aby bylo vidět, kde se to pokazilo.
import { Z, zz, nsn, zkrat, plus, minus, krat, deleno, rovno, jeCele, nah, nz, vyber, zamichej,
  F, N, V, R, S2, SR, zavorka, text, cislo, poleZeVzoru } from './cisla.js';

// ---------- pomocníci ----------
const P = ['x', 'y'];
const kP = (otazka, pole, spravne, x = {}) => ({ otazka, typ: 'cisla', pole, spravne: spravne.map(zz), ...x });
const kC = (otazka, spravne, x = {}) => kP(otazka, [{ pred: x.pred || '', za: x.za || '' }], [spravne], x);
const kVz = (otazka, vzor, spravne, x = {}) => kP(otazka, poleZeVzoru(vzor), spravne, { vzor, ...x });
const kXY = (otazka, x0, y0, x = {}) => kP(otazka, [{ pred: 'x =' }, { pred: 'y =' }], [x0, y0], x);
// Volba z HTML možností: správná + špatné (duplicity a shody se správnou se vyhodí), zamíchané.
function kV(otazka, spravne, spatne, x = {}) {
  const jine = [...new Set(spatne.filter((s) => s !== spravne))].slice(0, 3);
  const moz = zamichej([spravne, ...jine]).map((html, i) => ({ id: String(i), html }));
  return { otazka, typ: 'volba', moznosti: moz, spravne: moz.find((m) => m.html === spravne).id, ...x };
}
// Volba s pevným pořadím možností (ano/ne, počet řešení).
const kVp = (otazka, moznosti, spravne, x = {}) => ({ otazka, typ: 'volba', moznosti: moznosti.map((html, i) => ({ id: String(i), html })), spravne: String(spravne), ...x });
const ANONE = ['Ano', 'Ne'];
const opakuj = (fn, test, max = 500) => { for (let i = 0; i < max; i++) { const x = fn(); if (test(x)) return x; } throw new Error('generátor nenašel úlohu'); };
// Další člen výrazu se znaménkem: „ + 3x“, „ − y“, „ − 4“.
const clen = (k, prom = '') => { const a = Math.abs(k); return `${k < 0 ? ' − ' : ' + '}${prom && a === 1 ? '' : a}${prom}`; };
const sKrat = (k, x) => `${N(k)} · ${typeof x === 'number' && x < 0 ? `(${N(x)})` : typeof x === 'number' ? N(x) : x}`;
// a − b se závorkou jen u záporného b
const minusZ = (a, b) => `${N(a)} − ${zz(b).c < 0 ? `(${N(b)})` : N(b)}`;
const plusZ = (a, b) => `${N(a)} + ${zz(b).c < 0 ? `(${N(b)})` : N(b)}`;
const lev = (e, x, y) => e[0] * x + e[1] * y;
const det = (e1, e2) => e1[0] * e2[1] - e1[1] * e2[0];
const ROV = (e) => R(e[0], e[1], e[2]);

// Rovnici s převahou minusů otočí (−5x + 4y = −29 → 5x − 4y = 29), ať zadání vypadají jako v učebnici.
const kladnyPrvni = (e) => (e.filter((x) => x < 0).length >= 2 || (e[0] < 0 && e[1] <= 0) ? e.map((x) => -x) : e);
// Soustava s celočíselným řešením: { e1: [a, b, c], e2, x0, y0 }. podm(a1, b1, a2, b2) omezuje koeficienty.
function soustava(o = {}) {
  const { koef = 6, max = 9, min = -5, kladne = 0.65, podm = () => true } = o;
  return opakuj(() => {
    const x0 = Math.random() < kladne ? nah(1, max) : nah(min, max), y0 = Math.random() < kladne ? nah(1, max) : nah(min, max);
    const kf = () => (Math.random() < 0.72 ? nah(1, koef) : -nah(1, koef));
    const a1 = kf(), b1 = kf(), a2 = kf(), b2 = kf();
    return { e1: kladnyPrvni([a1, b1, a1 * x0 + b1 * y0]), e2: kladnyPrvni([a2, b2, a2 * x0 + b2 * y0]), x0, y0 };
  }, (s) => det(s.e1, s.e2) !== 0 && Math.abs(s.e1[2]) <= 60 && Math.abs(s.e2[2]) <= 60 && podm(s.e1[0], s.e1[1], s.e2[0], s.e2[1]) && !(s.e1[0] === s.e2[0] && s.e1[1] === s.e2[1]));
}

// ---------- 1. Rovnice o jedné neznámé ----------
const G = {};

G['rce-jednoducha'] = () => {
  const x0 = nz(-8, 12), a = vyber([2, 3, 4, 5, 6, 7, 8, 9, -2, -3, -4, -5]), b = nz(-20, 20), c = a * x0 + b;
  return {
    zadani: `Vyřeš rovnici: ${V([[a, 'x'], [b, '']])} = ${N(c)}`,
    kroky: [
      kC(`Převeď ${b > 0 ? 'číslo' : 'člen'} ${N(b)} na pravou stranu:`, c - b, { pred: `${V([[a, 'x']])} =`, napoveda: b > 0 ? `Od obou stran odečti ${b}: ${N(c)} − ${b}` : `K oběma stranám přičti ${-b}: ${N(c)} + ${-b}` }),
      kC('Vyděl obě strany koeficientem u x:', x0, { pred: 'x =', napoveda: `${N(c - b)} : ${a < 0 ? `(${N(a)})` : a}` }),
    ],
    vysvetleni: `${V([[a, 'x'], [b, '']])} = ${N(c)} &nbsp;|&nbsp; ${b > 0 ? '−' + b : '+' + -b} → ${V([[a, 'x']])} = ${N(c - b)} &nbsp;|&nbsp; : ${N(a)} → x = ${N(x0)}`,
  };
};

G['rce-obe-strany'] = () => {
  const x0 = nz(-7, 10);
  const [a, c] = opakuj(() => [nz(-7, 9), nz(-7, 9)], ([a, c]) => a !== c);
  const b = nz(-15, 15), d = a * x0 + b - c * x0;
  const k = a - c, p = d - b;
  return {
    zadani: `Vyřeš rovnici: ${V([[a, 'x'], [b, '']])} = ${V([[c, 'x'], [d, '']])}`,
    kroky: [
      kVz('Členy s x převeď na jednu stranu, čísla na druhou:', { cleny: ['x'], prava: true }, [k, p], { alt: [[-k, -p]], napoveda: `Při převodu na druhou stranu se mění znaménko. Vlevo: ${V([[a, 'x']])}${clen(-c, 'x')}, vpravo: ${N(d)}${clen(-b)}.` }),
      kC('Vyděl koeficientem u x:', x0, { pred: 'x =', napoveda: `${N(p)} : ${k < 0 ? `(${N(k)})` : k}` }),
    ],
    vysvetleni: `${V([[a, 'x'], [-c, 'x']])} = ${V([[d, ''], [-b, '']])} → ${V([[k, 'x']])} = ${N(p)} → x = ${N(x0)}. Zkouška: obě strany vyjdou ${N(a * x0 + b)}.`,
  };
};

G['rce-zavorky'] = () => {
  return opakuj(() => {
    const x0 = nz(-6, 9), p = vyber([2, 3, 4, 5, -2, -3]), q = nz(-6, 6), r = nah(-8, 8);
    const s = opakuj(() => vyber([2, 3, 4, 5, -2, -3, -4]), (s) => s !== p), u = nz(-6, 6);
    const w = p * (x0 + q) + r - s * (x0 + u);
    const lev1 = [p, p * q + r], prav1 = [s, s * u + w];
    const zadani = `Vyřeš rovnici: ${zavorka(p, V([[1, 'x'], [q, '']]), true)}${r ? clen(r) : ''} = ${zavorka(s, V([[1, 'x'], [u, '']]), true)}${w ? clen(w) : ''}`;
    const k = p - s, d = prav1[1] - lev1[1];
    return {
      zadani,
      kroky: [
        kVz('Roznásob závorku na levé straně a sečti čísla:', { pred: 'levá strana:', cleny: ['x', ''] }, lev1, { napoveda: `Číslem ${N(p)} vynásob oba členy v závorce: ${sKrat(p, 'x')} a ${sKrat(p, q)}.` }),
        kVz('Roznásob závorku na pravé straně a sečti čísla:', { pred: 'pravá strana:', cleny: ['x', ''] }, prav1, { napoveda: `Číslem ${N(s)} vynásob oba členy v závorce: ${sKrat(s, 'x')} a ${sKrat(s, u)}.` }),
        kVz('Členy s x převeď doleva, čísla doprava:', { cleny: ['x'], prava: true }, [k, d], { alt: [[-k, -d]], napoveda: `${V([[p, 'x'], [lev1[1], '']])} = ${V([[s, 'x'], [prav1[1], '']])}` }),
        kC('x =', x0, { pred: 'x =', napoveda: `${N(d)} : ${k < 0 ? `(${N(k)})` : k}` }),
      ],
      vysvetleni: `${V([[p, 'x'], [lev1[1], '']])} = ${V([[s, 'x'], [prav1[1], '']])} → ${V([[k, 'x']])} = ${N(d)} → x = ${N(x0)}`,
    };
  }, () => true);
};

G['rce-zlomky'] = () => {
  const [m, n] = opakuj(() => [vyber([2, 3, 4, 5, 6]), vyber([2, 3, 4, 5, 6])], ([m, n]) => m !== n && nsn(m, n) <= 20);
  const L = nsn(m, n);
  if (Math.random() < 0.4) {
    const x0 = L * nz(-3, 4);
    const op = Math.random() < 0.5 ? 1 : -1, cc = x0 / m + op * x0 / n;
    const k = L / m + op * L / n;
    return {
      zadani: `Vyřeš rovnici: ${F('x', m)} ${op > 0 ? '+' : '−'} ${F('x', n)} = ${N(cc)}`,
      kroky: [
        kC('Čím celou rovnici vynásobíš, aby zmizely zlomky? (nejmenší společný jmenovatel)', L, { napoveda: `Nejmenší číslo dělitelné ${m} i ${n}.` }),
        kVz(`Po vynásobení číslem ${L} a sečtení:`, { cleny: ['x'], prava: true }, [k, cc * L], { umer: true, napoveda: `${F('x', m)} · ${L} = ${L / m}x, ${F('x', n)} · ${L} = ${L / n}x, pravá strana ${N(cc)} · ${L}.` }),
        kC('x =', x0, { pred: 'x =' }),
      ],
      vysvetleni: `· ${L}: ${V([[L / m, 'x'], [op * L / n, 'x']])} = ${N(cc * L)} → ${V([[k, 'x']])} = ${N(cc * L)} → x = ${N(x0)}`,
    };
  }
  return opakuj(() => {
    const x0 = nz(-8, 10), A = nah(-3, 5), B = nah(-3, 5);
    const p = m * A - x0, q = n * B - x0, c = A - B;
    const k = L / m - L / n, d = c * L - (L / m) * p + (L / n) * q;
    const zav = (kk, prom, sc, prvni) => (sc ? zavorka(kk, V([[1, prom], [sc, '']]), prvni) : (prvni ? V([[kk, prom]]) : clen(kk, prom)));
    const vzniklo = `${zav(L / m, 'x', p, true)}${zav(-L / n, 'x', q, false)} = ${N(c * L)}`;
    return {
      zadani: `Vyřeš rovnici: ${F(V([[1, 'x'], [p, '']]), m)} − ${F(V([[1, 'x'], [q, '']]), n)} = ${N(c)}`,
      kroky: [
        kC('Čím celou rovnici vynásobíš, aby zmizely zlomky? (nejmenší společný jmenovatel)', L, { napoveda: `Nejmenší číslo dělitelné ${m} i ${n}.` }),
        kVz(`Vynásob číslem ${L}, roznásob závorky a uprav na tvar ax = b:`, { cleny: ['x'], prava: true }, [k, d], { umer: true, napoveda: `Vznikne ${vzniklo}. Pozor na minus před druhou závorkou: mění znaménka v ní.` }),
        kC('x =', x0, { pred: 'x =' }),
      ],
      vysvetleni: `· ${L}: ${vzniklo} → ${V([[k, 'x']])} = ${N(d)} → x = ${N(x0)}`,
    };
  }, (u) => u.kroky[1].spravne[0].c !== 0 && Math.abs(p0(u)) <= 40);
};
const p0 = (u) => u.kroky[1].spravne[1].c;

// ---------- 2. Co je soustava ----------
G['je-reseni'] = () => {
  const s = soustava({ koef: 5, max: 7 });
  const ano = Math.random() < 0.45;
  let x = s.x0, y = s.y0;
  if (!ano) {
    // Záludná dvojice: často splní první rovnici, ale druhou ne.
    try {
      const t = opakuj(() => [nz(-3, 3), nz(-3, 3)], ([dx, dy]) => lev(s.e1, dx, dy) === 0 && lev(s.e2, dx, dy) !== 0 && Math.abs(s.x0 + dx) <= 12 && Math.abs(s.y0 + dy) <= 12, 50);
      x = s.x0 + t[0]; y = s.y0 + t[1];
    } catch { /* záludná nejde, vezme se prohozená */ }
    if (x === s.x0 && y === s.y0) { x = s.y0 !== s.x0 ? s.y0 : s.x0 + 1; y = s.y0 !== s.x0 ? s.x0 : s.y0; }
  }
  const l1 = lev(s.e1, x, y), l2 = lev(s.e2, x, y), plati = l1 === s.e1[2] && l2 === s.e2[2];
  const dosad = (e) => `${e[0] === 1 ? '' : e[0] === -1 ? '−' : e[0] + ' · '}${x < 0 ? `(${N(x)})` : x}${e[1] < 0 ? ' − ' : ' + '}${Math.abs(e[1]) === 1 ? '' : Math.abs(e[1]) + ' · '}${y < 0 ? `(${N(y)})` : y}`;
  return {
    zadani: `Je dvojice <b>x = ${N(x)}, y = ${N(y)}</b> řešením soustavy ${SR(s.e1, s.e2)} ?`,
    kroky: [
      kC('Dosaď do 1. rovnice. Kolik vyjde levá strana?', l1, { napoveda: `${dosad(s.e1)}` }),
      kC('Dosaď do 2. rovnice. Kolik vyjde levá strana?', l2, { napoveda: `${dosad(s.e2)}` }),
      kVp('Je dvojice řešením soustavy?', ['Ano, splňuje obě rovnice', 'Ne'], plati ? 0 : 1, { napoveda: 'Řešení soustavy musí splnit <b>obě</b> rovnice zároveň.' }),
    ],
    vysvetleni: `1. rovnice: ${dosad(s.e1)} = ${N(l1)} ${l1 === s.e1[2] ? '✔' : `≠ ${N(s.e1[2])}`}. 2. rovnice: ${dosad(s.e2)} = ${N(l2)} ${l2 === s.e2[2] ? '✔' : `≠ ${N(s.e2[2])}`}. ${plati ? 'Platí obě, dvojice je řešením.' : 'Nesplňuje obě rovnice, řešením není.'}`,
  };
};

G['dopocitej'] = () => {
  const a = nz(-6, 7), b = vyber([2, 3, 4, 5, -2, -3, 1, -1]), x1 = nz(-5, 8), y1 = nz(-6, 9), c = a * x1 + b * y1;
  const prohod = Math.random() < 0.4; // dopočítat x ze zadaného y
  const [zn, hl, znH, hlH, kz, kh] = prohod ? ['y', 'x', y1, x1, b, a] : ['x', 'y', x1, y1, a, b];
  const zbyva = c - kz * znH;
  const kroky = [kC(`Dosaď ${zn} = ${N(znH)} a převeď číslo na pravou stranu:`, zbyva, { pred: `${V([[kh, hl]])} =`, napoveda: `${V([[kz, zn]])} = ${sKrat(kz, znH)} = ${N(kz * znH)}. Pak ${N(c)}${clen(-kz * znH)}.` })];
  if (Math.abs(kh) !== 1 || kh === -1) kroky.push(kC(`${hl} =`, hlH, { pred: `${hl} =`, napoveda: `${N(zbyva)} : ${kh < 0 ? `(${N(kh)})` : kh}` }));
  else kroky[0] = { ...kroky[0], pred: `${hl} =` };
  return {
    zadani: `V rovnici ${R(a, b, c)} je ${zn} = ${N(znH)}. Kolik je ${hl}?`,
    kroky,
    vysvetleni: `${V([[kz, zn]])} = ${N(kz * znH)}, takže ${V([[kh, hl]])} = ${N(c)}${clen(-kz * znH)} = ${N(zbyva)} a ${hl} = ${N(hlH)}.`,
  };
};

// Přímka y = kx + q zadaná jako ax + by = c s celými čísly.
function primka(x0, y0, k) {
  const kz = zkrat(k);
  const a = -kz.c, b = kz.j, c = a * x0 + b * y0;
  return kladnyPrvni([a, b, c]);
}
G['graf-prusecik'] = () => {
  const x0 = nah(-4, 4), y0 = nah(-4, 4);
  const SKL = [Z(1), Z(2), Z(3), Z(-1), Z(-2), Z(-3), Z(1, 2), Z(-1, 2), Z(0)];
  const [k1, k2] = opakuj(() => [vyber(SKL), vyber(SKL)], ([a, b]) => !rovno(a, b));
  const e1 = primka(x0, y0, k1), e2 = primka(x0, y0, k2);
  return {
    zadani: `Na obrázku jsou přímky obou rovnic soustavy ${SR(e1, e2)}. Odečti z obrázku řešení soustavy.`,
    kresba: { typ: 'graf', primky: [{ e: e1, popis: 'p' }, { e: e2, popis: 'q' }] },
    kroky: [kXY('Kde se přímky protínají?', x0, y0, { napoveda: 'Najdi průsečík. x čti na vodorovné ose, y na svislé ose. Pod osou x jsou záporná y, vlevo od osy y záporná x.' })],
    vysvetleni: `Přímky se protínají v bodě [${N(x0)}; ${N(y0)}]. Zkouška: ${lev(e1, x0, y0) === e1[2] && lev(e2, x0, y0) === e2[2] ? 'po dosazení platí obě rovnice ✔' : ''}`,
  };
};

// ---------- 3. Vyjádření neznámé ----------
G['vyjadri'] = (p = {}) => {
  const v = p.prom === 'x' ? 0 : p.prom === 'y' ? 1 : nah(0, 1), o = 1 - v;
  const kv = vyber(p.jenJedna ? [1, -1] : [1, -1, 1, 2, 3, -2]);
  const ko = nz(-6, 6) * (Math.abs(kv) > 1 ? kv : 1), c = nz(-8, 10) * (Math.abs(kv) > 1 ? kv : 1);
  const e = [0, 0, c]; e[v] = kv; e[o] = ko;
  const k = -ko / kv, q = c / kv;
  const kroky = [];
  if (kv !== 1) kroky.push(kVz(`Převeď člen s ${P[o]} na pravou stranu:`, { pred: `${V([[kv, P[v]]])} =`, cleny: [P[o], ''] }, [-ko, c], { napoveda: `Člen ${V([[ko, P[o]]])} se na druhé straně objeví s opačným znaménkem.` }));
  kroky.push(kVz(`Vyjádři ${P[v]}:`, { pred: `${P[v]} =`, cleny: [P[o], ''] }, [k, q], { napoveda: kv === 1 ? `Člen ${V([[ko, P[o]]])} převeď na druhou stranu (změní znaménko). Je-li před ${P[o]} jen minus, napiš −1.` : `Vyděl obě strany číslem ${N(kv)}. Děl každý člen.` }));
  return {
    zadani: `Z rovnice ${R(e[0], e[1], e[2])} vyjádři ${P[v]}.`,
    kroky,
    vysvetleni: `${V([[kv, P[v]]])} = ${V([[-ko, P[o]], [c, '']])}${kv !== 1 ? ` &nbsp;|&nbsp; : ${N(kv)} → ${P[v]} = ${V([[k, P[o]], [q, '']])}` : ''}`,
  };
};

G['co-vyjadrit'] = () => {
  const s = soustava({ koef: 7, podm: (a1, b1, a2, b2) => [a1, b1, a2, b2].filter((x) => Math.abs(x) === 1).length === 1 });
  const k = [s.e1[0], s.e1[1], s.e2[0], s.e2[1]], i = k.findIndex((x) => Math.abs(x) === 1);
  const MOZ = ['x z 1. rovnice', 'y z 1. rovnice', 'x z 2. rovnice', 'y z 2. rovnice'];
  return {
    zadani: `Chceš soustavu ${SR(s.e1, s.e2)} řešit dosazovací metodou. Kterou neznámou se nejvíc vyplatí vyjádřit?`,
    kroky: [kVp('Co vyjádříš?', MOZ, i, { napoveda: 'Hledej neznámou s koeficientem 1 nebo −1. Pak se nemusí dělit a nevzniknou zlomky.' })],
    vysvetleni: `${P[i % 2]} má ${i < 2 ? 'v 1.' : 've 2.'} rovnici koeficient ${N(k[i])}, takže se vyjádří bez dělení: ${P[i % 2]} = ${(() => { const e = i < 2 ? s.e1 : s.e2, v = i % 2, o = 1 - v; return V([[-e[o] / e[v], P[o]], [e[2] / e[v], '']]); })()}. U ostatních by vznikly zlomky.`,
  };
};

// Dosazovací metoda po krocích: ri = rovnice s koeficientem ±1, v = neznámá, která se vyjádří.
function dosazovaci(s, ri, v, o = {}) {
  const E = [s.e1, s.e2], e = E[ri], d = E[1 - ri], ov = 1 - v, sol = [s.x0, s.y0];
  const k = -e[ov] / e[v], q = e[2] / e[v];
  const vyr = V([[q, ''], [k, P[ov]]]); // „7 − 2x“
  const dosadText = (koefV, koefO, prava, vyraz) => (v === 1
    ? `${V([[koefO, 'x']])}${zavorka(koefV, vyraz)} = ${N(prava)}`
    : `${zavorka(koefV, vyraz, true)}${clen(koefO, 'y')} = ${N(prava)}`);
  const spravne = dosadText(d[v], d[ov], d[2], vyr);
  const spatne = [
    dosadText(d[v], d[ov], d[2], V([[q, ''], [-k, P[ov]]])),                                   // znaménko ve výrazu
    v === 1 ? `${V([[d[ov], 'x']])}${clen(d[v] * q)}${clen(k, P[ov])} = ${N(d[2])}`            // bez závorky
      : `${V([[d[v] * q, '']])}${clen(k, 'y')}${clen(d[ov], 'y')} = ${N(d[2])}`,
    dosadText(e[v], e[ov], e[2], vyr),                                                         // do stejné rovnice
    dosadText(d[v], d[ov], d[2], V([[q, ''], [k, P[v]]])),                                     // špatná neznámá ve výrazu
  ];
  const A = d[ov] + d[v] * k, B = d[2] - d[v] * q;
  const kroky = [];
  if (!o.uzVyjadreno) kroky.push(kVz(`Vyjádři ${P[v]} z ${ri + 1}. rovnice:`, { pred: `${P[v]} =`, cleny: [P[ov], ''] }, [k, q], { napoveda: `V ${ri + 1}. rovnici má ${P[v]} koeficient ${N(e[v])}. ${e[v] === 1 ? 'Ostatní členy převeď na druhou stranu.' : 'Převeď ostatní členy na druhou stranu a změň všechna znaménka (vyděl −1).'} Je-li před ${P[ov]} jen minus, napiš −1.` }));
  kroky.push(kV(`Dosaď ${P[v]} = ${vyr} do ${2 - ri}. rovnice. Co vznikne?`, spravne, spatne, { napoveda: `Místo ${P[v]} napiš celý výraz ${vyr} <b>v závorce</b>. Druhou neznámou nech, jak je.` }));
  kroky.push(kVz('Roznásob závorku a uprav na tvar a·' + P[ov] + ' = b:', { cleny: [P[ov]], prava: true }, [A, B], { umer: true, napoveda: `${N(d[v])} · ${vyr.includes(' ') ? `(${vyr})` : vyr} = ${V([[d[v] * q, ''], [d[v] * k, P[ov]]])}. Pak sečti členy s ${P[ov]} a čísla převeď doprava.` }));
  kroky.push(kC(`${P[ov]} =`, sol[ov], { pred: `${P[ov]} =`, napoveda: `${N(B)} : ${A < 0 ? `(${N(A)})` : A}` }));
  kroky.push(kC(`Dosaď ${P[ov]} = ${N(sol[ov])} do vyjádření ${P[v]} = ${vyr}:`, sol[v], { pred: `${P[v]} =`, napoveda: `${N(q)}${clen(k)} · ${sol[ov] < 0 ? `(${N(sol[ov])})` : sol[ov]}`.replace(' + 1 · ', ' + ').replace(' − 1 · ', ' − ') }));
  if (o.zkouska) {
    const z = lev(d, s.x0, s.y0);
    kroky.push(kC(`Zkouška: dosaď x = ${N(s.x0)}, y = ${N(s.y0)} do ${2 - ri}. rovnice. Kolik vyjde levá strana?`, z, { napoveda: `${N(d[0])} · ${s.x0 < 0 ? `(${N(s.x0)})` : s.x0} + ${N(d[1])} · ${s.y0 < 0 ? `(${N(s.y0)})` : s.y0}. Mělo by vyjít ${N(d[2])}.` }));
  }
  return {
    kroky,
    vysvetleni: `${P[v]} = ${vyr}; dosazením: ${spravne} → ${V([[A, P[ov]]])} = ${N(B)} → ${P[ov]} = ${N(sol[ov])}; ${P[v]} = ${N(sol[v])}. Řešení: x = ${N(s.x0)}, y = ${N(s.y0)}.`,
  };
}
// Soustava, kde má právě vybraná neznámá v jedné rovnici koeficient ±1 (a jinde ne, ať je jasné, co vyjádřit).
function soustavaSJednickou(v, ri, o = {}) {
  return soustava({ koef: o.koef || 6, podm: (a1, b1, a2, b2) => {
    const k = [[a1, b1], [a2, b2]];
    return Math.abs(k[ri][v]) === 1 && [a1, b1, a2, b2].filter((x) => Math.abs(x) === 1).length === 1;
  } });
}

G['dosad-vyraz'] = () => {
  const v = nah(0, 1), ri = nah(0, 1), s = soustavaSJednickou(v, ri);
  const u = dosazovaci(s, ri, v);
  const E = [s.e1, s.e2], e = E[ri], ov = 1 - v;
  const vyr = V([[e[2] / e[v], ''], [-e[ov] / e[v], P[ov]]]);
  return {
    zadani: `Soustavu ${SR(s.e1, s.e2)} řešíme dosazovací metodou. Z ${ri + 1}. rovnice už máme ${P[v]} = ${vyr}. Dopočítej ${P[ov]}.`,
    kroky: u.kroky.slice(1, 4),
    vysvetleni: u.vysvetleni.split(';').slice(0, 2).join(';') + '.',
  };
};

// ---------- 4. Dosazovací metoda ----------
G['dosazovaci'] = (p = {}) => {
  const v = p.prom === 'x' ? 0 : p.prom === 'y' ? 1 : nah(0, 1), ri = nah(0, 1), s = soustavaSJednickou(v, ri);
  const u = dosazovaci(s, ri, v, { zkouska: p.zkouska });
  return { zadani: `Vyřeš dosazovací metodou: ${SR(s.e1, s.e2)}`, kroky: u.kroky, vysledek: kXY('Řešení soustavy:', s.x0, s.y0), vysvetleni: u.vysvetleni };
};

G['dosazovaci-vyjadreno'] = () => {
  // Jedna rovnice už je ve tvaru y = kx + q (nebo x = …).
  const v = nah(0, 1), ri = nah(0, 1), s = soustavaSJednickou(v, ri);
  const E = [s.e1, s.e2], e = E[ri], ov = 1 - v;
  const vyr = V([[-e[ov] / e[v], P[ov]], [e[2] / e[v], '']]);
  const rce = [`${P[v]} = ${vyr}`, ROV(E[1 - ri])];
  if (ri === 1) rce.reverse();
  const u = dosazovaci(s, ri, v, { uzVyjadreno: true });
  return { zadani: `Vyřeš soustavu: ${S2(rce[0], rce[1])}`, kroky: u.kroky, vysledek: kXY('Řešení soustavy:', s.x0, s.y0), vysvetleni: `${ri + 1}. rovnice už říká, čemu se rovná ${P[v]}. Stačí dosadit. ` + u.vysvetleni };
};

// ---------- 5. Sčítací metoda ----------
// Kroky sčítací metody pro soustavu s, v = neznámá, která se má odečíst (0 = x, 1 = y). Funguje i s necelým řešením.
function scitaci(s, v) {
  const E = [s.e1, s.e2], ov = 1 - v, sol = [zz(s.x0), zz(s.y0)];
  const a1 = E[0][v], a2 = E[1][v];
  let k1 = 1, k2 = 1, druh;
  if (a1 === -a2) druh = 'hned';
  else if (a1 % a2 === 0) { druh = 'druhou'; k2 = -a1 / a2; }
  else if (a2 % a1 === 0) { druh = 'prvni'; k1 = -a2 / a1; }
  else { druh = 'obe'; const L = nsn(a1, a2); k1 = L / a1; k2 = -L / a2; }
  const kroky = [];
  const nas = (e, k) => e.map((x) => k * x);
  const n1 = nas(E[0], k1), n2 = nas(E[1], k2);
  const vzor = { cleny: ['x', 'y'], prava: true };
  if (druh === 'druhou' || druh === 'prvni') {
    const i = druh === 'druhou' ? 1 : 0, k = i ? k2 : k1, ja = E[i][v], on = E[1 - i][v];
    kroky.push(kC(`Čím vynásobíš ${i + 1}. rovnici, aby se po sečtení ${P[v]} odečetlo?`, k, { napoveda: `V ${2 - i}. rovnici je ${V([[on, P[v]]])}, v ${i + 1}. ${V([[ja, P[v]]])}. Po vynásobení musí být v ${i + 1}. rovnici ${V([[-on, P[v]]])} (opačné číslo). ${N(-on)} : ${ja < 0 ? `(${N(ja)})` : ja} = ?` }));
    kroky.push(kVz(`${i + 1}. rovnice po vynásobení číslem ${N(k)}:`, vzor, i ? n2 : n1, { napoveda: `Vynásob <b>každý</b> člen, i pravou stranu. Pozor na znaménka.` }));
  }
  if (druh === 'obe') {
    const L = Math.abs(nsn(a1, a2));
    kroky.push(kC(`U ${P[v]} jsou čísla ${N(a1)} a ${N(a2)}. Jaký je jejich nejmenší společný násobek (kladný)?`, L, { napoveda: `Nejmenší číslo dělitelné ${Math.abs(a1)} i ${Math.abs(a2)}.` }));
    kroky.push(kC(`Čím vynásobíš 1. rovnici, aby u ${P[v]} bylo ${L}?`, k1, { napoveda: `${L} : ${a1 < 0 ? `(${N(a1)})` : a1}` }));
    kroky.push(kC(`Čím vynásobíš 2. rovnici, aby u ${P[v]} bylo −${L}?`, k2, { napoveda: `−${L} : ${a2 < 0 ? `(${N(a2)})` : a2}. Záporné číslo zařídí, že se ${P[v]} po sečtení odečte.` }));
  }
  const sum = [n1[0] + n2[0], n1[1] + n2[1], n1[2] + n2[2]];
  kroky.push(kVz(druh === 'hned' ? `Koeficienty u ${P[v]} jsou opačná čísla. Sečti rovnice:` : 'Sečti rovnice:', { cleny: [P[ov]], prava: true }, [sum[ov], sum[2]], { umer: true, napoveda: `Sečti zvlášť členy s ${P[ov]} a zvlášť pravé strany: ${V([[n1[ov], P[ov]]])}${clen(n2[ov], P[ov])} a ${N(n1[2])}${clen(n2[2])}.` }));
  kroky.push(kC(`${P[ov]} =`, sol[ov], { pred: `${P[ov]} =`, napoveda: `${N(sum[2])} : ${sum[ov] < 0 ? `(${N(sum[ov])})` : sum[ov]}${jeCele(sol[ov]) ? '' : '. Nevyjde celé číslo, napiš zlomek (lomítko /) v základním tvaru.'}` }));
  const zbytek = minus(E[0][2], krat(E[0][ov], sol[ov]));
  kroky.push(kC(`Dosaď ${P[ov]} = ${N(sol[ov])} do 1. rovnice a dopočítej ${P[v]}:`, sol[v], { pred: `${P[v]} =`, napoveda: `${ROV(E[0])}, tedy ${V([[E[0][v], P[v]]])} = ${minusZ(E[0][2], krat(E[0][ov], sol[ov]))} = ${N(zbytek)}.` }));
  const popis = druh === 'hned' ? 'Rovnice sečteme' : druh === 'obe' ? `1. rovnici vynásobíme ${N(k1)}, 2. rovnici ${N(k2)} a sečteme` : `${druh === 'druhou' ? 2 : 1}. rovnici vynásobíme ${N(druh === 'druhou' ? k2 : k1)} a sečteme`;
  return { kroky, druh, vysvetleni: `${popis}: ${V([[sum[ov], P[ov]]])} = ${N(sum[2])}, ${P[ov]} = ${N(sol[ov])}. Dosazením do 1. rovnice ${P[v]} = ${N(sol[v])}. Řešení: x = ${N(sol[0])}, y = ${N(sol[1])}.` };
}

G['scitaci'] = (p = {}) => {
  const druh = p.druh || 'hned', v = nah(0, 1);
  const s = soustava({ koef: druh === 'obe' ? 7 : 6, podm: (a1, b1, a2, b2) => {
    const k = [[a1, b1], [a2, b2]], x = k[0][v], y = k[1][v];
    const nic1 = [a1, b1, a2, b2].filter((q) => Math.abs(q) === 1).length <= 1;
    if (druh === 'hned') return x === -y && k[0][1 - v] !== -k[1][1 - v] && nic1;
    if (druh === 'jedna') return x !== -y && (x % y === 0 || y % x === 0) && Math.abs(x) !== Math.abs(y) && k[0][1 - v] % k[1][1 - v] !== 0 && nic1;
    return x % y !== 0 && y % x !== 0 && nsn(x, y) <= 30 && nic1 && k[0][1 - v] % k[1][1 - v] !== 0 && k[1][1 - v] % k[0][1 - v] !== 0;
  } });
  const u = scitaci(s, v);
  return { zadani: `Vyřeš sčítací metodou (odečti ${P[v]}): ${SR(s.e1, s.e2)}`, kroky: u.kroky, vysledek: kXY('Řešení soustavy:', s.x0, s.y0), vysvetleni: u.vysvetleni };
};

// ---------- 6. Úpravy před řešením ----------
// Rovnici ax + by = c napíše „přeházeně“ se závorkou: p(x + s) + B·y = d·x + w·y + K (nebo obráceně s y v závorce).
function sZavorkou(e) {
  return opakuj(() => {
    const v = nah(0, 1), ov = 1 - v; // v závorce bude P[v]
    const d = nz(-3, 3), w = nah(-3, 3), s = nz(-5, 5);
    const pz = e[v] + d, B = e[ov] + w, K = e[2] + pz * s;
    if (pz === 0 || Math.abs(pz) === 1 || Math.abs(K) > 60) return null;
    const lev1 = `${zavorka(pz, V([[1, P[v]], [s, '']]), true)}${B ? clen(B, P[ov]) : ''}`;
    const prav1 = V([[d, P[v]], [w, P[ov]], [K, '']]);
    return `${lev1} = ${prav1}`;
  }, Boolean);
}
// Rovnici napíše se zlomky: (x + s)/m + (y + t)/n = r, po vynásobení L dá (L/m)x + (L/n)y = c. Vrací { html, e, L }.
function seZlomky(x0, y0) {
  return opakuj(() => {
    const [m, n] = [vyber([2, 3, 4, 5, 6]), vyber([2, 3, 4, 5, 6])];
    if (m === n) return null;
    const L = nsn(m, n);
    if (L > 20) return null;
    const A = nah(-2, 4), B = nah(-2, 4), sx = m * A - x0, sy = n * B - y0, zn = Math.random() < 0.5 ? 1 : -1;
    const rr = A + zn * B;
    const e = [L / m, zn * L / n, rr * L - (L / m) * sx - zn * (L / n) * sy];
    const cit = (prom, s) => (s ? V([[1, prom], [s, '']]) : prom);
    return { html: `${F(cit('x', sx), m)} ${zn > 0 ? '+' : '−'} ${F(cit('y', sy), n)} = ${N(rr)}`, e, L, m, n };
  }, Boolean);
}
G['upravy'] = (p = {}) => {
  const druh = p.druh || 'zavorky';
  return opakuj(() => {
    const s = soustava({ koef: 5, max: 7 });
    let r1, r2, kroky = [], E;
    if (druh === 'zavorky') {
      r1 = sZavorkou(s.e1); r2 = Math.random() < 0.6 ? sZavorkou(s.e2) : ROV(s.e2);
      E = [s.e1, s.e2];
      kroky.push(kVz('Uprav 1. rovnici na tvar ax + by = c:', { cleny: ['x', 'y'], prava: true }, s.e1, { umer: true, napoveda: 'Roznásob závorku, členy s x a y převeď doleva, čísla doprava (se změnou znaménka) a sečti.' }));
      if (r2 !== ROV(s.e2)) kroky.push(kVz('Uprav 2. rovnici na tvar ax + by = c:', { cleny: ['x', 'y'], prava: true }, s.e2, { umer: true, napoveda: 'Roznásob závorku, neznámé doleva, čísla doprava.' }));
    } else {
      const z = seZlomky(s.x0, s.y0);
      E = [z.e, s.e2];
      if (det(E[0], E[1]) === 0) return null;
      r1 = z.html; r2 = Math.random() < 0.5 ? sZavorkou(s.e2) : ROV(s.e2);
      kroky.push(kC('Čím vynásobíš 1. rovnici, aby zmizely zlomky?', z.L, { napoveda: `Nejmenší společný násobek jmenovatelů ${z.m} a ${z.n}.` }));
      kroky.push(kVz(`Po vynásobení číslem ${z.L} a úpravě na tvar ax + by = c:`, { cleny: ['x', 'y'], prava: true }, z.e, { umer: true, napoveda: `Každý zlomek vynásob ${z.L}: jmenovatel se zkrátí a čitatel (celý, v závorce!) se vynásobí ${z.L} : jmenovatel. Pak čísla převeď doprava.` }));
      if (r2 !== ROV(s.e2)) kroky.push(kVz('Uprav 2. rovnici na tvar ax + by = c:', { cleny: ['x', 'y'], prava: true }, s.e2, { umer: true, napoveda: 'Roznásob závorku, neznámé doleva, čísla doprava.' }));
    }
    kroky.push(kXY('Teď vyřeš upravenou soustavu (jakoukoli metodou):', s.x0, s.y0, { napoveda: `Upravená soustava: ${SR(E[0], E[1])}` }));
    return {
      zadani: `Vyřeš soustavu: ${S2(r1, r2)}`,
      kroky, vysledek: kXY('Řešení soustavy:', s.x0, s.y0),
      vysvetleni: `Po úpravě: ${SR(E[0], E[1])} Řešení: x = ${N(s.x0)}, y = ${N(s.y0)}.`,
    };
  }, Boolean);
};

// ---------- 7. Kolik má soustava řešení ----------
const POCET = ['Žádné řešení', 'Právě jedno řešení', 'Nekonečně mnoho řešení'];
G['pocet-reseni'] = () => {
  const druh = vyber(['zadne', 'zadne', 'nekonecne', 'nekonecne', 'jedno']);
  const a = nz(-5, 6), b = nz(-5, 6), c = nz(-12, 12), k = vyber([2, 3, -2, -1, 4, -3]);
  let e2;
  if (druh === 'nekonecne') e2 = [k * a, k * b, k * c];
  else if (druh === 'zadne') e2 = [k * a, k * b, k * c + nz(-5, 5)];
  else e2 = opakuj(() => (Math.random() < 0.6 ? [k * a, k * b + nz(-2, 2), nz(-15, 15)] : [nz(-6, 6), nz(-6, 6), nz(-15, 15)]), (e) => det([a, b], e) !== 0);
  const e1 = [a, b, c], nasobek = druh !== 'jedno', vysl = druh === 'zadne' ? 0 : druh === 'jedno' ? 1 : 2;
  const kroky = [kVp('Je levá strana 2. rovnice násobkem levé strany 1. rovnice (oba koeficienty stejným číslem)?', ANONE, nasobek ? 0 : 1, { napoveda: `Porovnej: ${N(e2[0])} : ${N(a)} a ${N(e2[1])} : ${N(b)}. Vychází stejné číslo?` })];
  if (nasobek) {
    kroky.push(kC('Kolikrát? (Čím vynásobíš 1. rovnici, abys dostal levou stranu 2. rovnice?)', k, { napoveda: `${N(e2[0])} : ${a < 0 ? `(${N(a)})` : a}` }));
    kroky.push(kVp(`Je i pravá strana ${N(e2[2])} rovna ${N(k)} · ${c < 0 ? `(${N(c)})` : c}?`, ANONE, druh === 'nekonecne' ? 0 : 1, { napoveda: `${N(k)} · ${c < 0 ? `(${N(c)})` : c} = ${N(k * c)}` }));
  }
  kroky.push(kVp('Kolik řešení má soustava?', POCET, vysl, { napoveda: nasobek ? 'Levé strany jsou násobky: když pravé strany odpovídají, jde o stejnou rovnici (nekonečně mnoho řešení). Když ne, rovnice si odporují (žádné řešení).' : 'Levé strany nejsou násobky, přímky jsou různoběžné: právě jedno řešení.' }));
  return {
    zadani: `Kolik řešení má soustava ${SR(e1, e2)} ?`,
    kroky,
    vysvetleni: druh === 'jedno' ? `Levé strany nejsou násobky (${N(e2[0])} : ${N(a)} ≠ ${N(e2[1])} : ${N(b)}). Přímky jsou různoběžné, řešení je právě jedno.`
      : druh === 'nekonecne' ? `2. rovnice je ${N(k)}násobek 1. rovnice i s pravou stranou. Je to tatáž rovnice (totožné přímky), řešení je nekonečně mnoho.`
        : `Levá strana 2. rovnice je ${N(k)}násobek, ale pravá strana ne (${N(k)} · ${c < 0 ? `(${N(c)})` : c} = ${N(k * c)} ≠ ${N(e2[2])}). Sčítací metodou by vyšlo 0 = ${N(e2[2] - k * c)}, což neplatí. Rovnoběžné přímky, žádné řešení.`,
  };
};

G['graf-pocet'] = () => {
  const druh = vyber(['zadne', 'jedno', 'nekonecne']);
  const x0 = nah(-3, 3), y0 = nah(-3, 3);
  const SKL = [Z(1), Z(2), Z(-1), Z(-2), Z(1, 2), Z(-1, 2), Z(0), Z(3)];
  const k1 = vyber(SKL), e1 = primka(x0, y0, k1);
  let e2;
  if (druh === 'jedno') e2 = primka(x0, y0, opakuj(() => vyber(SKL), (k) => !rovno(k, k1)));
  else if (druh === 'zadne') e2 = primka(x0, y0 + vyber([-3, -2, 2, 3]), k1);
  else { const m = vyber([2, 3, -1, -2]); e2 = e1.map((x) => x * m); }
  return {
    zadani: `Obrázek ukazuje přímky obou rovnic soustavy ${SR(e1, e2)}. Kolik má soustava řešení?`,
    kresba: { typ: 'graf', primky: [{ e: e1, popis: 'p' }, { e: e2, popis: 'q', carkovane: druh === 'nekonecne' }] },
    kroky: [kVp('Kolik řešení má soustava?', POCET, { zadne: 0, jedno: 1, nekonecne: 2 }[druh], { napoveda: 'Každý společný bod přímek je řešení. Různoběžky mají 1 společný bod, rovnoběžky žádný, splývající přímky všechny.' })],
    vysvetleni: { zadne: 'Přímky jsou rovnoběžné, nemají společný bod. Soustava nemá řešení.', jedno: `Přímky se protínají v jednom bodě [${N(x0)}; ${N(y0)}], to je jediné řešení.`, nekonecne: 'Obě rovnice popisují stejnou přímku (druhá je násobkem první). Každý bod přímky je řešením: nekonečně mnoho řešení.' }[druh],
  };
};

G['parametr'] = () => {
  const a = nz(-5, 6), b = nz(-5, 6), c = nz(-10, 12), k = vyber([2, 3, -2, 4, -3]);
  const nek = Math.random() < 0.35;
  if (nek) {
    return {
      zadani: `Pro které číslo c má soustava ${S2(R(a, b, c), `${V([[k * a, 'x'], [k * b, 'y']])} = c`)} nekonečně mnoho řešení?`,
      kroky: [
        kC('Kolikrát je levá strana 2. rovnice větší než levá strana 1. rovnice?', k, { napoveda: `${N(k * a)} : ${a < 0 ? `(${N(a)})` : a}` }),
        kC('c =', k * c, { pred: 'c =', napoveda: `Celá 2. rovnice musí být ${N(k)}násobkem 1. rovnice, i pravá strana: ${N(k)} · ${c < 0 ? `(${N(c)})` : c}.` }),
      ],
      vysvetleni: `Levá strana 2. rovnice je ${N(k)}násobek levé strany 1. rovnice. Nekonečně mnoho řešení je, když je to tatáž rovnice: c = ${N(k)} · ${c < 0 ? `(${N(c)})` : c} = ${N(k * c)}.`,
    };
  }
  const c2 = opakuj(() => nz(-20, 20), (x) => x !== k * c);
  return {
    zadani: `Pro které číslo a nemá soustava ${S2(R(a, b, c), `${V([[k * a, 'x']])} + a·y = ${N(c2)}`)} žádné řešení?`,
    kroky: [
      kC('Kolikrát je koeficient u x ve 2. rovnici větší než v 1. rovnici?', k, { napoveda: `${N(k * a)} : ${a < 0 ? `(${N(a)})` : a}` }),
      kC('a =', k * b, { pred: 'a =', napoveda: `Žádné řešení je, když jsou levé strany násobky (stejným číslem ${N(k)}) a pravé ne. a = ${N(k)} · ${b < 0 ? `(${N(b)})` : b}.` }),
      kVp(`Pravá strana: je ${N(c2)} rovno ${N(k)} · ${c < 0 ? `(${N(c)})` : c}?`, ANONE, 1, { napoveda: `${N(k)} · ${c < 0 ? `(${N(c)})` : c} = ${N(k * c)}` }),
    ],
    vysledek: kC('a =', k * b, { pred: 'a =' }),
    vysvetleni: `Pro a = ${N(k * b)} je levá strana 2. rovnice ${N(k)}násobkem levé strany 1. rovnice, ale pravá strana ne (${N(k * c)} ≠ ${N(c2)}). Rovnice si odporují: rovnoběžky, žádné řešení.`,
  };
};

// ---------- 8. Mistr metod: necelá řešení, mix ----------
G['zlomkove-reseni'] = () => {
  const s = opakuj(() => {
    const a1 = nz(-5, 6), b1 = nz(-5, 6), a2 = nz(-5, 6), b2 = nz(-5, 6), D = a1 * b2 - a2 * b1;
    if (!D || Math.abs(D) > 12) return null;
    const c1 = nz(-12, 12), c2 = nz(-12, 12);
    const x = zkrat(Z(c1 * b2 - b1 * c2, D)), y = zkrat(Z(a1 * c2 - a2 * c1, D));
    if (jeCele(x) && jeCele(y)) return null;
    if (x.j > 6 || y.j > 6 || Math.abs(x.c) > 30 || Math.abs(y.c) > 30) return null;
    return { e1: [a1, b1, c1], e2: [a2, b2, c2], x0: x, y0: y };
  }, Boolean);
  const v = Math.abs(s.e1[1]) === Math.abs(s.e2[1]) || Math.random() < 0.5 ? 1 : 0;
  const u = scitaci(s, v);
  return { zadani: `Vyřeš soustavu (řešení nemusí být celá čísla): ${SR(s.e1, s.e2)}`, kroky: u.kroky, vysledek: kXY('Řešení soustavy (zlomky piš s lomítkem):', s.x0, s.y0), vysvetleni: u.vysvetleni };
};

G['mix'] = (p, data, posl) => {
  const g = vyber([['scitaci', { druh: 'jedna' }], ['scitaci', { druh: 'obe' }], ['dosazovaci', {}], ['upravy', { druh: 'zavorky' }], ['upravy', { druh: 'zlomky' }], ['dosazovaci-vyjadreno', {}]]);
  return G[g[0]](g[1], data, posl);
};

// ---------- 9. Slovní úlohy (šablony v slovni.json) ----------
const dosad = (s, h) => text(s).replace(/\{(\w+)\}/g, (_, k) => (k in h ? h[k] : `{${k}}`));
const udaj = (u, h, nahr) => { if (!u) return nahr; const t = dosad(u, h); return /^(že|kolik|co|jak)\b/.test(t) ? ', ' + t : ' ' + t; };
const hodnotaParam = (x) => (Array.isArray(x) ? (x.length === 3 ? x[0] + x[2] * nah(0, Math.floor((x[1] - x[0]) / x[2])) : nah(x[0], x[1])) : x);
function slovniKroky(s, rce1, rce2, x0, y0, h) {
  const odp = s.ptaSe === 'y' ? y0 : s.ptaSe === 'soucin' ? x0 * y0 : x0;
  return [
    kV(`Označ <b>x</b> = ${s.x}, <b>y</b> = ${s.y}. Která rovnice zapisuje${udaj(s.udaj1, h, ' první údaj')}?`, rce1[0], rce1.slice(1), { napoveda: s.napoveda1 ? dosad(s.napoveda1, h) : 'Přečti větu znovu a přepiš ji do řeči x a y.' }),
    kV(`Která rovnice zapisuje${udaj(s.udaj2, h, ' druhý údaj')}?`, rce2[0], rce2.slice(1), { napoveda: s.napoveda2 ? dosad(s.napoveda2, h) : 'Přečti větu znovu a přepiš ji do řeči x a y.' }),
    kXY(`Vyřeš soustavu ${S2(rce1[0], rce2[0])}`, x0, y0, { napoveda: 'Hodí se sčítací metoda, nebo vyjádři neznámou s koeficientem 1.' }),
    kC(dosad(s.otazka, h), odp, { pred: s.odpoved || '', za: s.jednotka || '', napoveda: `Podívej se, na co se úloha ptá: ${s.ptaSe === 'y' ? s.y : s.ptaSe === 'soucin' ? 'součin x · y' : s.x}.` }),
  ];
}
// Součet a vážený součet: x + y = S, px + qy = T (lístky, nohy zvířat, mince, pokoje…).
G['slovni-sv'] = (p, data) => {
  const s = vyber(data.sablony['slovni-sv']);
  return opakuj(() => {
    const pp = hodnotaParam(s.p), q = hodnotaParam(s.q);
    if (pp === q) return null;
    const x0 = nah(...s.rozsah), y0 = nah(...(s.rozsahY || s.rozsah)), S = x0 + y0, Tt = pp * x0 + q * y0, h = { S, T: Tt, p: pp, q };
    const r1 = [`x + y = ${S}`, `x − y = ${S}`, `${V([[pp, 'x'], [q, 'y']])} = ${S}`, `x + y = ${Tt}`];
    const r2 = [`${V([[pp, 'x'], [q, 'y']])} = ${Tt}`, `${V([[q, 'x'], [pp, 'y']])} = ${Tt}`, `${V([[pp, 'x'], [q, 'y']])} = ${S}`, `${V([[pp + q, 'x']])} = ${Tt}`];
    return {
      zadani: dosad(s.text, h),
      kroky: slovniKroky(s, r1, r2, x0, y0, h),
      vysvetleni: `x + y = ${S}, ${r2[0]}. Například ze 1. rovnice y = ${S} − x a dosadit, nebo 1. rovnici vynásobit ${N(-q)} a sečíst: ${V([[pp - q, 'x']])} = ${N(Tt - q * S)}, x = ${x0}, y = ${y0}.`,
    };
  }, Boolean);
};
// Součet a rozdíl (nebo „o kolik víc“): x + y = S, x − y = D.
G['slovni-rozdil'] = (p, data) => {
  const s = vyber(data.sablony['slovni-rozdil']);
  const y0 = nah(...s.rozsah), D = nah(...(s.rozsahD || [2, 20])), x0 = y0 + D, S = x0 + y0, h = { S, D };
  const r1 = [`x + y = ${S}`, `x − y = ${S}`, `x + y = ${D}`, `x = ${S}y`];
  const r2 = [`x − y = ${D}`, `y − x = ${D}`, `x + y = ${D}`, `x = ${D}y`];
  return {
    zadani: dosad(s.text, h), kroky: slovniKroky(s, r1, r2, x0, y0, h),
    vysvetleni: `x + y = ${S}, x − y = ${D}. Sečtením 2x = ${S + D}, x = ${x0}, y = ${y0}.`,
  };
};
// Násobek: x = k·y a x + y = S (nebo x − y = D).
G['slovni-nasobek'] = (p, data) => {
  const s = vyber(data.sablony['slovni-nasobek']);
  const k = hodnotaParam(s.k || [2, 5]), y0 = nah(...s.rozsah), x0 = k * y0;
  const rozdil = s.druh === 'rozdil', S = rozdil ? x0 - y0 : x0 + y0, h = { S, D: S, k };
  const r1 = [`x = ${k}y`, `y = ${k}x`, `x = y + ${k}`, `${k}x = y`];
  const r2 = rozdil ? [`x − y = ${S}`, `y − x = ${S}`, `x + y = ${S}`, `x · y = ${S}`] : [`x + y = ${S}`, `x − y = ${S}`, `${k}x + y = ${S}`, `x = ${S} + y`];
  return {
    zadani: dosad(s.text, h), kroky: slovniKroky(s, r1, r2, x0, y0, h),
    vysvetleni: `x = ${k}y dosadíme: ${rozdil ? `${k}y − y = ${S}, ${k - 1}y = ${S}` : `${k}y + y = ${S}, ${k + 1}y = ${S}`}, y = ${y0}, x = ${x0}.`,
  };
};
// Věk: x − y = D (o kolik je starší), za n let bude k-krát starší: x + n = k(y + n).
G['slovni-vek'] = (p, data) => {
  const s = vyber(data.sablony['slovni-vek']);
  return opakuj(() => {
    const k = vyber(s.k || [2, 3]), n = hodnotaParam(s.za || [2, 10]), y0 = nah(...s.rozsah), x0 = k * (y0 + n) - n, D = x0 - y0, h = { D, n, k };
    if (x0 > (s.maxX || 70) || D < 15) return null;
    const r1 = [`x − y = ${D}`, `y − x = ${D}`, `x + y = ${D}`, `x = ${D}y`];
    const r2 = [`x + ${n} = ${k}(y + ${n})`, `x + ${n} = ${k}y + ${n}`, `${k}(x + ${n}) = y + ${n}`, `x + ${n} = ${k}(y − ${n})`];
    return {
      zadani: dosad(s.text, h), kroky: slovniKroky(s, r1, r2, x0, y0, h),
      vysvetleni: `x = y + ${D} dosadíme do x + ${n} = ${k}(y + ${n}): y + ${D + n} = ${k}y + ${k * n}, tedy ${k - 1}y = ${D + n - k * n}, y = ${y0}, x = ${x0}.`,
    };
  }, Boolean);
};

// Pevné úlohy přímo z JSONu (úlohy ve stylu přijímaček). Viz README.
export function pevnaUloha(u) {
  const krok = (k) => {
    const typ = k.typ || 'cislo', o = { napoveda: k.napoveda ? text(k.napoveda) : '' };
    if (typ === 'volba') return kVp(text(k.otazka || 'Vyber:'), k.moznosti.map(text), k.spravne, o);
    if (typ === 'xy') return kXY(text(k.otazka || 'Řešení soustavy:'), cislo(k.spravne[0]), cislo(k.spravne[1]), o);
    if (typ === 'rce') return kVz(text(k.otazka || 'Rovnice ve tvaru ax + by = c:'), { cleny: ['x', 'y'], prava: true }, k.spravne.map(cislo), { ...o, umer: true });
    return kC(text(k.otazka || 'Výsledek:'), cislo(k.spravne), { ...o, pred: k.pred || '', za: k.jednotka || '' });
  };
  return { zadani: text(u.zadani), kresba: u.kresba, kroky: u.kroky.map(krok), vysvetleni: text(u.vysvetleni || '') };
}
G['pevne'] = (p, data, posledni = []) => {
  const seznam = data.pevne[p.sada || 'cermat'];
  const volne = seznam.filter((u) => !posledni.includes(u.zadani));
  return pevnaUloha(vyber(volne.length ? volne : seznam));
};

export function generuj(gen, param, data, posledni) {
  const fn = G[gen];
  if (!fn) throw new Error('Neznámý generátor: ' + gen);
  const u = fn(param || {}, data, posledni);
  u.kroky.forEach((k, i) => { if (!k.napoveda) k.napoveda = ''; k.i = i; });
  if (!u.vysledek) u.vysledek = { ...u.kroky[u.kroky.length - 1] };
  if (!u.vysledek.napoveda) u.vysledek.napoveda = '';
  return u;
}
export const GENERATORY = Object.keys(G);
