// Postup žáka v localStorage (klíč klavir-v1): série správných odpovědí u každé položky, hotové jednotky, zkouška.
import { JEDNOTKY, VSECHNY_POLOZKY, potrebnaSerie, jednotkaPolozky } from './kurz.js';

const KLIC = 'klavir-v1';
const novy = () => ({ verze: 1, polozky: {}, jednotky: {}, zkouska: { splnena: false, pokusy: 0 }, nast: { popisky: true, zvuk: true }, odpovedi: 0, chyby: [] });

export let P = nacti();
function nacti() {
  try { const s = JSON.parse(localStorage.getItem(KLIC)); if (s && s.verze === 1) return { ...novy(), ...s }; } catch { /* soukromé okno */ }
  return novy();
}
export function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(P)); } catch { /* nevadí */ } }
export function smaz() { P = novy(); uloz(); }

export const polozka = (id) => P.polozky[id] || (P.polozky[id] = { s: 0, z: false, ok: 0, ch: 0, t: 0 });
export const zvladnuta = (id) => !!P.polozky[id]?.z;
export const jednotka = (id) => P.jednotky[id] || (P.jednotky[id] = { lekce: false, hotovo: false });

// Zapíše odpověď. Vrací { zvladnuta, zapomenuta } pro hlášku.
export function zapis(id, spravne) {
  const p = polozka(id), bylo = p.z;
  p.t = Date.now(); P.odpovedi++;
  if (spravne) { p.ok++; p.s++; if (p.s >= potrebnaSerie(id)) p.z = true; }
  else {
    p.ch++; p.s = 0; p.z = false;
    P.chyby.unshift({ id, t: p.t }); P.chyby.length = Math.min(P.chyby.length, 30);
  }
  uloz();
  return { zvladnuta: !bylo && p.z, zapomenuta: bylo && !p.z };
}

export function stavJednotky(j) {
  const hotovych = j.polozky.filter(zvladnuta).length;
  return { hotovych, celkem: j.polozky.length, podil: hotovych / j.polozky.length };
}
export const celkovyPodil = () => VSECHNY_POLOZKY.filter(zvladnuta).length / VSECHNY_POLOZKY.length;
// Slabá místa: položky z už prošlých jednotek, které se zapomněly (chyba v opakování).
export function slabaMista() {
  return VSECHNY_POLOZKY.filter((id) => jednotka(jednotkaPolozky[id]).hotovo && !zvladnuta(id));
}
export const aktualniJednotka = () => JEDNOTKY.find((j) => !jednotka(j.id).hotovo) || null;
export const kurzHotov = () => !aktualniJednotka() && P.zkouska.splnena && slabaMista().length === 0;
