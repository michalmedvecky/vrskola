// Počítání se zlomky, zápis do HTML a kontrola odpovědí. Bez DOMu, takže to jde testovat v Node
// (nastroje/zlomky-test.mjs). Zlomek je { c: čitatel, j: jmenovatel }, jmenovatel vždy kladný.

export const nsd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
export const nsn = (a, b) => (a / nsd(a, b)) * b;
export const Z = (c, j = 1) => (j < 0 ? { c: -c, j: -j } : { c, j });
export const zkrat = (z) => { const d = nsd(z.c, z.j); return Z(z.c / d, z.j / d); };
export const plus = (a, b) => zkrat(Z(a.c * b.j + b.c * a.j, a.j * b.j));
export const minus = (a, b) => zkrat(Z(a.c * b.j - b.c * a.j, a.j * b.j));
export const krat = (a, b) => zkrat(Z(a.c * b.c, a.j * b.j));
export const deleno = (a, b) => zkrat(Z(a.c * b.j, a.j * b.c));
export const prevracene = (a) => Z(a.j, a.c);
export const rovno = (a, b) => a.c * b.j === b.c * a.j;
export const porovnej = (a, b) => Math.sign(a.c * b.j - b.c * a.j);
export const hodnota = (z) => z.c / z.j;
export const jeZakladni = (z) => nsd(z.c, z.j) === 1;
export const jeCele = (z) => z.c % z.j === 0;
// Smíšené číslo: { w: celé, c, j } s vlastním zlomkem (jen pro kladná čísla).
export const naSmisene = (z) => ({ w: Math.floor(z.c / z.j), c: z.c % z.j, j: z.j });

// ---------- náhoda ----------
export const nah = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const vyber = (pole) => pole[Math.floor(Math.random() * pole.length)];
export function zamichej(pole) {
  const a = [...pole];
  for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; }
  return a;
}

// ---------- zápis ----------
export const des = (x, mist = 6) => String(+x.toFixed(mist)).replace('.', ',').replace('-', '−');
// Zlomek v HTML (čitatel nad jmenovatelem). Volitelně celá část a „cvicny“ tvar pro malé zlomky v textu.
export function F(c, j, w) {
  if (typeof c === 'object') { const z = c; return F(z.c, z.j); }
  const cela = w ? `<span class="zl-cele">${w}</span>` : '';
  return `<span class="zl-cislo">${cela}<span class="zl"><span class="zl-c">${c}</span><span class="zl-j">${j}</span></span></span>`;
}
// Výsledek v nejhezčím tvaru: celé číslo, zlomek, nebo smíšené číslo.
export function H(z, smisene = true) {
  z = zkrat(z);
  if (z.j === 1) return String(z.c).replace('-', '−');
  if (smisene && z.c > z.j) { const m = naSmisene(z); return F(m.c, m.j, m.w); }
  return F(z.c, z.j);
}
export const T = (z) => (z.j === 1 ? String(z.c) : `${z.c}/${z.j}`); // textově, do logu a testů
// Složený zlomek: dva výrazy (HTML) nad sebou s dlouhou čarou.
export const slozeny = (horni, dolni) => `<span class="zl zl-slozeny"><span class="zl-c">${horni}</span><span class="zl-j">${dolni}</span></span>`;

// Značky v textech z JSONu: {3/4} zlomek, {2 1/3} smíšené číslo, **tučně**.
export function text(s) {
  return String(s)
    .replace(/\{(\d+) (\d+)\/(\d+)\}/g, (_, w, c, j) => F(+c, +j, +w))
    .replace(/\{(\d+)\/(\d+)\}/g, (_, c, j) => F(+c, +j))
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

// Odpověď zapsaná v JSONu: "5/12", "2 1/3", "15", "0,75" → zlomek.
export function parsuj(s) {
  s = String(s).trim().replace('−', '-');
  let m = s.match(/^(-?\d+) (\d+)\/(\d+)$/);
  if (m) return Z(+m[1] * +m[3] + +m[2], +m[3]);
  m = s.match(/^(-?\d+)\/(\d+)$/);
  if (m) return Z(+m[1], +m[2]);
  m = s.match(/^(-?\d+)(?:[,.](\d+))?$/);
  if (m) { const d = m[2] ? 10 ** m[2].length : 1; return zkrat(Z(Math.round(parseFloat(s.replace(',', '.')) * d), d)); }
  throw new Error('Nečitelná odpověď: ' + s);
}

// ---------- kontrola kroku ----------
// Krok úlohy: { typ: 'zlomek'|'cislo'|'volba'|'vybarvi'|'serad', spravne, tvar?, pevne? }.
// Odpověď z UI: zlomek { w, c, j } (řetězce z políček), cislo { t }, volba { id }, vybarvi { k, n }, serad { poradi: [...] }.
// Vrací { ok: true } / { ok: false } / { ok: false, skoro: 'text' } (hodnota sedí, ale tvar ne: bez trestu, oprav).
export function zkontroluj(krok, o) {
  if (krok.typ === 'volba') return { ok: o.id === krok.spravne };
  if (krok.typ === 'serad') return { ok: o.poradi.join() === krok.spravne.join() };
  if (krok.typ === 'vybarvi') return { ok: o.k * krok.spravne.j === krok.spravne.c * o.n };
  if (krok.typ === 'cislo') {
    const t = String(o.t ?? '').replace(',', '.').replace('−', '-');
    if (!/^-?\d+(\.\d+)?$/.test(t)) return { ok: false, prazdne: true };
    const z = parsuj(t);
    return { ok: rovno(z, krok.spravne) };
  }
  // zlomek
  const cislo = (x) => (x === '' || x == null ? null : +x);
  let w = cislo(o.w), c = cislo(o.c), j = cislo(o.j);
  if (krok.pevne?.c != null) c = krok.pevne.c;
  if (krok.pevne?.j != null) j = krok.pevne.j;
  if (c == null && j == null && w == null) return { ok: false, prazdne: true };
  if (c != null && j == null && w == null) j = 1;              // jen čitatel = celé číslo
  if (c == null && j == null) { c = 0; j = 1; }                  // jen celá část
  if (c == null || j == null) return { ok: false, prazdne: true, skoro: 'Doplň čitatel i jmenovatel.' };
  if (j === 0) return { ok: false, skoro: 'Jmenovatel nesmí být nula.' };
  const z = Z((w || 0) * j + c, j);
  if (!rovno(z, krok.spravne)) return { ok: false };
  const tvar = krok.tvar || 'libovolny';
  const zl = Z(c, j);
  if (tvar === 'presny') return { ok: c === krok.spravne.c && j === krok.spravne.j, skoro: c === krok.spravne.c ? undefined : 'Hodnota sedí, ale potřebujeme přesně ten jmenovatel, který je zadaný.' };
  if (tvar === 'zakladni' || tvar === 'smisene') {
    if (!jeZakladni(zl) && !(c === 0)) return { ok: false, skoro: 'Hodnota sedí, ale zlomek jde ještě zkrátit. Zkrať ho na základní tvar.' };
    if (w && c >= j && c !== 0) return { ok: false, skoro: 'U smíšeného čísla musí být zlomek menší než 1. Přesuň celky do celé části.' };
  }
  if (tvar === 'smisene' && !jeCele(krok.spravne) && krok.spravne.c > krok.spravne.j && !w) {
    return { ok: false, skoro: 'Hodnota sedí. Zapiš ji ale jako smíšené číslo (celá část a zlomek).' };
  }
  if (tvar === 'nepravy' && w) return { ok: false, skoro: 'Hodnota sedí. Zapiš ji ale jako zlomek bez celé části.' };
  return { ok: true };
}

// Správná odpověď ve formátu odpovědi z UI (pro testy a pro tlačítko „ukaž řešení“).
export function spravnaOdpoved(krok) {
  if (krok.typ === 'volba') return { id: krok.spravne };
  if (krok.typ === 'serad') return { poradi: krok.spravne };
  if (krok.typ === 'vybarvi') return { k: (krok.spravne.c * krok.n) / krok.spravne.j, n: krok.n };
  if (krok.typ === 'cislo') return { t: des(hodnota(krok.spravne)) };
  const s = krok.spravne;
  if (krok.tvar === 'presny') return { w: '', c: krok.pevne?.c != null ? '' : String(s.c), j: krok.pevne?.j != null ? '' : String(s.j) };
  const z = krok.tvar === 'libovolny' ? s : zkrat(s);
  if (krok.tvar === 'smisene' && z.c > z.j && !jeCele(z)) { const m = naSmisene(z); return { w: String(m.w), c: String(m.c), j: String(m.j) }; }
  return { w: '', c: String(z.c), j: String(z.j) };
}
// Správná odpověď jako HTML (do vysvětlení po chybě).
export function spravneHTML(krok) {
  if (krok.typ === 'volba') return krok.moznosti.find((m) => m.id === krok.spravne)?.html ?? krok.spravne;
  if (krok.typ === 'serad') return krok.spravne.map((id) => krok.karty.find((k) => k.id === id).html).join(' ; ');
  if (krok.typ === 'vybarvi') return `vybarvit ${(krok.spravne.c * krok.n) / krok.spravne.j} z ${krok.n} dílů`;
  if (krok.typ === 'cislo') return des(hodnota(krok.spravne)) + (krok.jednotka ? ' ' + krok.jednotka : '');
  if (krok.tvar === 'presny') return F(krok.spravne.c, krok.spravne.j);
  if (krok.tvar === 'libovolny') return krok.spravne.j === 1 ? String(krok.spravne.c) : F(krok.spravne.c, krok.spravne.j);
  const z = zkrat(krok.spravne);
  if (krok.tvar === 'smisene') return H(z, true);
  if (z.j !== 1 && z.c > z.j && krok.tvar !== 'nepravy') return `${F(z.c, z.j)} = ${H(z, true)}`;
  return H(z, false);
}
