// Postup v localStorage (klíč casy-v1): série u každé dovednosti, stav pater, spropitné, spokojenost hostů a album.
const KLIC = 'casy-v1';
const novy = () => ({
  verze: 1, polozky: {}, temata: {}, zaverecna: { splnena: false, pokusy: 0, nejlepsi: null },
  mince: 0, nejdelsiSerie: 0, odpovedi: 0, chyby: [], srdce: {}, album: [], tajni: [], nast: { zvuk: true },
});
export let P = nacti();
function nacti() {
  try { const s = JSON.parse(localStorage.getItem(KLIC)); if (s && s.verze === 1) return { ...novy(), ...s }; } catch { /* soukromé okno */ }
  return novy();
}
export function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(P)); } catch { /* nevadí */ } }
export function smaz() { P = novy(); uloz(); }

export const polozka = (id) => P.polozky[id] || (P.polozky[id] = { s: 0, z: false, ok: 0, ch: 0, t: 0 });
export const zvladnuta = (id) => !!P.polozky[id]?.z;
export const tema = (id) => P.temata[id] || (P.temata[id] = { lekce: false, strazce: false, pokusy: 0 });
export const maKartu = (id) => P.album.includes(id) || P.tajni.includes(id);

// Zapíše výsledek úlohy: true = napoprvé bez chyby, false = s chybou, null = s nápovědou (série se nemění).
export function zapis(id, spravne, serie) {
  const p = polozka(id), bylo = p.z;
  p.t = Date.now(); P.odpovedi++;
  if (spravne === null) { uloz(); return { zvladnuta: false, zapomenuta: false }; }
  if (spravne) { p.ok++; p.s++; if (p.s >= serie) p.z = true; }
  else {
    p.ch++; p.s = 0; p.z = false;
    P.chyby.unshift({ id, t: p.t }); P.chyby.length = Math.min(P.chyby.length, 40);
  }
  uloz();
  return { zvladnuta: !bylo && p.z, zapomenuta: bylo && !p.z };
}
// Přidá hostovi srdíčko; vrátí true, když tím host získal kartičku do alba.
export function srdicko(host, potreba) {
  if (maKartu(host)) return false;
  P.srdce[host] = (P.srdce[host] || 0) + 1;
  if (P.srdce[host] >= potreba) { P.album.push(host); uloz(); return true; }
  uloz();
  return false;
}
