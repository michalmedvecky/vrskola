// Počítání se zlomky (koeficienty i řešení soustav můžou být zlomky), zápis rovnic do HTML a kontrola odpovědí.
// Bez DOMu, takže to jde testovat v Node (nastroje/soustavy-test.mjs). Zlomek je { c: čitatel, j: jmenovatel }, j > 0.

export const nsd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
export const nsn = (a, b) => Math.abs((a / nsd(a, b)) * b);
export const Z = (c, j = 1) => (j < 0 ? { c: -c, j: -j } : { c, j });
export const zz = (x) => (typeof x === 'number' ? Z(x) : x);
export const zkrat = (z) => { z = zz(z); const d = nsd(z.c, z.j); return Z(z.c / d, z.j / d); };
export const plus = (a, b) => { a = zz(a); b = zz(b); return zkrat(Z(a.c * b.j + b.c * a.j, a.j * b.j)); };
export const minus = (a, b) => { a = zz(a); b = zz(b); return zkrat(Z(a.c * b.j - b.c * a.j, a.j * b.j)); };
export const krat = (a, b) => { a = zz(a); b = zz(b); return zkrat(Z(a.c * b.c, a.j * b.j)); };
export const deleno = (a, b) => { a = zz(a); b = zz(b); return zkrat(Z(a.c * b.j, a.j * b.c)); };
export const rovno = (a, b) => { a = zz(a); b = zz(b); return a.c * b.j === b.c * a.j; };
export const jeCele = (z) => { z = zz(z); return z.c % z.j === 0; };
export const hodnota = (z) => { z = zz(z); return z.c / z.j; };

// ---------- náhoda ----------
export const nah = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const nz = (a, b) => { for (;;) { const x = nah(a, b); if (x !== 0) return x; } };
export const vyber = (pole) => pole[Math.floor(Math.random() * pole.length)];
export function zamichej(pole) {
  const a = [...pole];
  for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; }
  return a;
}

// ---------- zápis ----------
const M = '−';
// Zlomek v HTML (čitatel nad jmenovatelem).
export function F(c, j) {
  return `<span class="zl"><span class="zl-c">${c}</span><span class="zl-j">${j}</span></span>`;
}
// Číslo (celé nebo zlomek) do HTML, se skutečným minusem.
export function N(x) {
  const z = zkrat(x);
  if (z.j === 1) return String(z.c).replace('-', M);
  return (z.c < 0 ? M : '') + F(Math.abs(z.c), z.j);
}
export const T = (x) => { const z = zkrat(x); return z.j === 1 ? String(z.c) : `${z.c}/${z.j}`; }; // textově, pro testy
// Výraz ze členů [[koeficient, 'x'], [koeficient, 'y'], [konstanta, '']]: 2x − y + 3, nulové členy vynechá.
export function V(cleny) {
  let s = '';
  for (const [k0, prom] of cleny) {
    const k = zkrat(k0);
    if (k.c === 0) continue;
    const zap = k.c < 0, abs = Z(Math.abs(k.c), k.j);
    const telo = prom ? ((abs.c === 1 && abs.j === 1) ? prom : N(abs) + prom) : N(abs);
    s += s ? (zap ? ` ${M} ` : ' + ') + telo : (zap ? M : '') + telo;
  }
  return s || '0';
}
// Rovnice ax + by = c.
export const R = (a, b, c, px = 'x', py = 'y') => `${V([[a, px], [b, py]])} = ${N(c)}`;
// Soustava dvou rovnic se svorkou.
export const S2 = (r1, r2) => `<span class="soustava"><span>${r1}</span><span>${r2}</span></span>`;
export const SR = (e1, e2) => S2(R(...e1), R(...e2));
// Násobek závorky: k·(výraz) jako další člen výrazu („ + 3(x − 2)“, „ − (y + 1)“), nebo první člen.
export function zavorka(k, vnitrek, prvni = false) {
  const abs = Math.abs(k), tl = abs === 1 ? '' : abs;
  if (prvni) return `${k < 0 ? M : ''}${tl}(${vnitrek})`;
  return `${k < 0 ? ` ${M} ` : ' + '}${tl}(${vnitrek})`;
}

// Značky v textech z JSONu: {3/4} zlomek, **tučně**, [[2x + y = 7 ; x − y = 1]] soustava se svorkou.
export function text(s) {
  return String(s)
    .replace(/\[\[(.+?) ; (.+?)\]\]/g, (_, a, b) => S2(a, b))
    .replace(/\{(−?\d+|[a-z+−\d ]+)\/(\d+|[a-z+−\d ]+)\}/g, (_, c, j) => F(c, j))
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

// Číslo napsané žákem nebo v JSONu: "−3", "-3/4", "2,5", "0.5" → zlomek (nebo null). Vrací i to, jestli jde zkrátit.
export function parsuj(s) {
  s = String(s ?? '').trim().replace(/−/g, '-').replace(/\s/g, '');
  let m = s.match(/^(-?)(\d+)\/(\d+)$/);
  if (m) {
    const c = +m[2] * (m[1] ? -1 : 1), j = +m[3];
    if (j === 0) return { chyba: 'nula' };
    return { z: Z(c, j), nezkraceny: nsd(c, j) > 1 || j === 1 };
  }
  m = s.match(/^-?\d+(?:[,.](\d+))?$/);
  if (m) { const d = m[1] ? 10 ** m[1].length : 1; return { z: zkrat(Z(Math.round(parseFloat(s.replace(',', '.')) * d), d)) }; }
  return null;
}
export const cislo = (s) => { const p = parsuj(s); if (!p || !p.z) throw new Error('Nečitelné číslo: ' + s); return p.z; };

// ---------- kontrola kroku ----------
// Krok: { typ: 'cisla', pole: [{ pred?, za? }], spravne: [zlomek…], alt?: [[…]], umer?: true } nebo { typ: 'volba', moznosti, spravne }.
// Odpověď z UI: cisla { pole: ['−3', '1/2'] }, volba { id }.
// umer: stačí rovnice se stejným poměrem čísel (2x + 4y = 6 i x + 2y = 3 jsou správně), čísla nesmí být všechna nulová.
// Vrací { ok } / { ok: false, prazdne } / { ok: false, skoro: 'text' } (nečitelné nebo nezkrácené: bez trestu, oprav).
export function zkontroluj(krok, o) {
  if (krok.typ === 'volba') return { ok: o.id === krok.spravne };
  const hodnoty = [];
  for (const s of o.pole) {
    if (String(s ?? '').trim() === '' || s === '-' || s === '−') return { ok: false, prazdne: true, skoro: krok.pole.length > 1 ? 'Doplň všechna políčka.' : 'Nejdřív něco napiš.' };
    const p = parsuj(s);
    if (!p) return { ok: false, skoro: `„${s}“ není číslo. Zlomek piš s lomítkem, třeba 3/4.` };
    if (p.chyba) return { ok: false, skoro: 'Ve jmenovateli nesmí být nula.' };
    hodnoty.push(p);
  }
  const z = hodnoty.map((h) => h.z);
  const sedi = (cil) => z.every((x, i) => rovno(x, cil[i]));
  let ok = sedi(krok.spravne) || (krok.alt || []).some(sedi);
  if (!ok && krok.umer) {
    // stejný poměr: z = t · spravne pro nějaké t ≠ 0
    const i = krok.spravne.findIndex((x) => zz(x).c !== 0);
    if (i >= 0 && zz(z[i]).c !== 0) { const t = deleno(z[i], krok.spravne[i]); ok = z.every((x, k) => rovno(x, krat(t, krok.spravne[k]))); }
  }
  if (!ok) return { ok: false };
  if (hodnoty.some((h) => h.nezkraceny)) return { ok: false, skoro: 'Číslo sedí, ale zlomek jde zkrátit (nebo je to celé číslo). Zapiš ho v základním tvaru.' };
  return { ok: true };
}

// Správná odpověď ve formátu odpovědi z UI (pro testy).
export function spravnaOdpoved(krok) {
  if (krok.typ === 'volba') return { id: krok.spravne };
  return { pole: krok.spravne.map((x) => T(x).replace('-', '−')) };
}
// Správná odpověď jako HTML (do vysvětlení po chybě).
export function spravneHTML(krok) {
  if (krok.typ === 'volba') return krok.moznosti.find((m) => m.id === krok.spravne)?.html ?? krok.spravne;
  return odpovedHTML(krok, krok.spravne.map(zz));
}
// Odpověď (pole řetězců nebo zlomků) vložená do popisků políček: „x = 3, y = −1“. Krok se vzorem
// (vzor: { pred?, cleny: ['x', 'y'], prava? }) se zapíše jako výraz: „2x − 4y = 6“, „y = −2x + 7“.
export function odpovedHTML(krok, hodnoty) {
  if (krok.vzor) {
    const z = hodnoty.map((h) => (typeof h === 'object' ? h : parsuj(h)?.z));
    if (z.every(Boolean)) {
      const v = krok.vzor, n = v.cleny.length;
      return `${v.pred ? v.pred + ' ' : ''}${V(v.cleny.map((p, i) => [z[i], p]))}${v.prava ? ' = ' + N(z[n]) : ''}`;
    }
  }
  return krok.pole.map((p, i) => {
    let h = hodnoty[i] === '' || hodnoty[i] == null ? '?' : typeof hodnoty[i] === 'object' ? N(hodnoty[i]) : String(hodnoty[i]).replace(/^-/, M);
    if (/^[−-]?\d+\/\d+$/.test(h)) { const [c, j] = h.replace(M, '').split('/'); h = (h.startsWith(M) ? M : '') + F(c, j); }
    return `${p.pred ? p.pred + ' ' : ''}${h}${p.za ? ' ' + p.za : ''}`;
  }).join(krok.pole.length > 1 ? ', ' : '');
}
// Políčka podle vzoru: cleny ['x', ''] s pred 'y =' → „y = [ ] x + [ ]“; cleny ['x', 'y'] s prava → „[ ] x + [ ] y = [ ]“.
export function poleZeVzoru(v) {
  const pole = v.cleny.map((p, i) => ({ pred: i === 0 ? (v.pred || '') : '+', za: p }));
  if (v.prava) pole.push({ pred: '=' });
  return pole;
}
