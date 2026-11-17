// Postup v localStorage (klíč zlomky-v1): série správných odpovědí u každé položky, stav ostrovů, krystaly.
const KLIC = 'zlomky-v1';
const novy = () => ({
  verze: 1, polozky: {}, temata: {}, zaverecna: { splnena: false, pokusy: 0, nejlepsi: null },
  krystaly: 0, nejdelsiSerie: 0, odpovedi: 0, chyby: [], nast: { zvuk: true },
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

// Zapíše výsledek úlohy (správně = napoprvé a bez chyby v žádném kroku). Vrací { zvladnuta, zapomenuta }.
export function zapis(id, spravne, serie) {
  const p = polozka(id), bylo = p.z;
  p.t = Date.now(); P.odpovedi++;
  if (spravne) { p.ok++; p.s++; if (p.s >= serie) p.z = true; }
  else {
    p.ch++; p.s = 0; p.z = false;
    P.chyby.unshift({ id, t: p.t }); P.chyby.length = Math.min(P.chyby.length, 40);
  }
  uloz();
  return { zvladnuta: !bylo && p.z, zapomenuta: bylo && !p.z };
}
