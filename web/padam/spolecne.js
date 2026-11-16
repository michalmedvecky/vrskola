// Společné věci všech miniher: pády a jejich otázky, rozbor vět z dat, pomocníci pro DOM.
// Bez závislostí na stavu hry, takže se dá testovat i v Node (nastroje/padam-test-data.mjs).

export const PADY = [
  null,
  { c: 1, slova: ['kdo', 'co'], otazka: 'kdo? co?', barva: '#e8505b', jmeno: 'Kdočko' },
  { c: 2, slova: ['koho', 'čeho'], otazka: 'koho? čeho?', barva: '#f08a24', jmeno: 'Čehoun' },
  { c: 3, slova: ['komu', 'čemu'], otazka: 'komu? čemu?', barva: '#e9b40c', jmeno: 'Komuška' },
  { c: 4, slova: ['koho', 'co'], otazka: 'koho? co?', barva: '#3fae5a', jmeno: 'Cožák' },
  { c: 5, slova: null, otazka: 'oslovujeme, voláme', barva: '#1fa9a6', jmeno: 'Halóček' },
  { c: 6, slova: ['kom', 'čem'], otazka: 'o kom? o čem?', barva: '#4a7fd6', jmeno: 'Okomínek' },
  { c: 7, slova: ['kým', 'čím'], otazka: 's kým? s čím?', barva: '#9b5de5', jmeno: 'Skýmka' },
];
export const CISLA_PADU = [1, 2, 3, 4, 5, 6, 7];

// Rozbor věty „[Babička|1] dala [vnučce|3] [jablko|4].“ na kousky textu a slov s pádem.
// Bez čísla („Jdu bez [psa].“) je pád null. Víc správných tvarů lze oddělit „|“ jen v Proměnách, tady ne.
export function rozeberVetu(veta) {
  const kusy = [];
  const re = /\[([^\]|]+)(?:\|(\d))?\]/g;
  let posledni = 0, m;
  while ((m = re.exec(veta))) {
    if (m.index > posledni) kusy.push({ text: veta.slice(posledni, m.index) });
    kusy.push({ slovo: m[1], pad: m[2] ? Number(m[2]) : null });
    posledni = re.lastIndex;
  }
  if (posledni < veta.length) kusy.push({ text: veta.slice(posledni) });
  return kusy;
}
export const slovaVety = (kusy) => kusy.filter((k) => k.slovo);

// Předložka těsně před slovem (pro Ptáčka): poslední slovo textu před mezerou.
const VOKALIZACE = { se: 's', ve: 'v', ze: 'z', ke: 'k', ku: 'k', ode: 'od', nade: 'nad', pode: 'pod', přede: 'před', beze: 'bez' };
export function predlozkaPred(text) {
  const m = /([A-Za-zÁ-žá-ž]+)\s*$/.exec(text || '');
  if (!m) return null;
  const p = m[1].toLowerCase();
  return { psana: m[1], zaklad: VOKALIZACE[p] || p };
}

// Pádová otázka s předložkou: „bez koho? bez čeho?“, „ke komu? k čemu?“, „se kým?“ → „s kým? s čím?“.
export function otazkaSPredlozkou(predlozka, pad) {
  if (!PADY[pad].slova) return PADY[pad].otazka;
  const [a, b] = PADY[pad].slova;
  if (predlozka === 'k') return pad === 3 ? 'ke komu? k čemu?' : `k ${a}? k ${b}?`;
  return `${predlozka} ${a}? ${predlozka} ${b}?`;
}

export function zamichej(pole) {
  const a = [...pole];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const nahodny = (pole) => pole[Math.floor(Math.random() * pole.length)];
export const velkym = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Výběr bez brzkého opakování: pamatuje si posledních N použitých klíčů (sdílené přes localStorage stavem hry).
export function vyberNeopakuj(pole, klic, nedavne, kolik = 1) {
  const nepouzite = pole.filter((x) => !nedavne.includes(klic(x)));
  const zdroj = nepouzite.length >= kolik ? nepouzite : [...pole].sort((a, b) => nedavne.indexOf(klic(a)) - nedavne.indexOf(klic(b)));
  const vyber = nepouzite.length >= kolik ? zamichej(zdroj).slice(0, kolik) : zdroj.slice(0, kolik);
  return vyber;
}

// ---------- DOM ----------
export const $ = (s, el = document) => el.querySelector(s);
export function el(tag, trida, obsah) {
  const e = document.createElement(tag);
  if (trida) e.className = trida;
  if (obsah !== undefined) { if (typeof obsah === 'string') e.innerHTML = obsah; else e.append(...[].concat(obsah)); }
  return e;
}
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const cekej = (ms) => new Promise((r) => setTimeout(r, ms));

// Odznáček pádu v jeho barvě: „3.“ nebo „3. pád“.
export function odznak(pad, sOtazkou = false) {
  const p = PADY[pad];
  return `<span class="odznak" style="--b:${p.barva}">${pad}.${sOtazkou ? ` <small>${p.otazka}</small>` : ''}</span>`;
}

// Věta, ve které je místo slova otázka: „Babička dala (komu? čemu?) vnučce jablko.“ – takhle se pád hledá.
export function vetaSOtazkou(kusy, index, otazka) {
  return kusy.map((k, i) => {
    if (k.text !== undefined) return esc(k.text);
    if (i === index) return `<span class="ptam-se">${esc(otazka)}</span> <b class="hledane">${esc(k.slovo)}</b>`;
    return esc(k.slovo);
  }).join('');
}

// Tlačítko, které po podržení (2 s) teprve zareaguje – vstup pro rodiče.
export function podrzeni(tlacitko, akce, ms = 2000) {
  let t = null;
  const pust = () => { clearTimeout(t); tlacitko.classList.remove('drzim'); };
  tlacitko.addEventListener('pointerdown', () => { tlacitko.classList.add('drzim'); t = setTimeout(() => { pust(); akce(); }, ms); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => tlacitko.addEventListener(e, pust));
}

// „v 1. patře“, ale „ve 2./3./4. patře“ (ve druhém, ve třetím, ve čtvrtém).
export const vVe = (c) => (c >= 2 && c <= 4 ? 've' : 'v');
