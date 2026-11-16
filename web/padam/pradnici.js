// Pádníci: sedm vymyšlených tvorečků, každý bydlí v jednom pádu (patře výtahu) a má jeho barvu.
// Rostou z vajíčka, když dítě správně určuje jejich pád. Kreslí se jako SVG, žádné obrázky.
import { PADY } from './spolecne.js';

export const STADIA = [
  { od: 0, nazev: 'vajíčko' },
  { od: 6, nazev: 'mládě' },
  { od: 24, nazev: 'velký pádník' },
  { od: 60, nazev: 'král pádníků' },
];
export function stadium(body) {
  let s = 0;
  STADIA.forEach((x, i) => { if (body >= x.od) s = i; });
  return s;
}
export function doDalsiho(body) {
  const s = stadium(body);
  return s >= STADIA.length - 1 ? null : STADIA[s + 1].od - body;
}

// Co má který pádník na hlavě, ať se dají rozeznat i bez barvy.
const OZDOBY = {
  1: '<path d="M50 22 L50 6" stroke="#5a3a2a" stroke-width="3"/><circle cx="50" cy="6" r="5" fill="#ffd34d"/>',
  2: '<path d="M30 30 Q24 8 38 20Z M70 30 Q76 8 62 20Z" fill="currentColor" stroke="#0003" stroke-width="2"/>',
  3: '<path d="M34 26 L30 8 L42 22Z M66 26 L70 8 L58 22Z" fill="#fff6d0" stroke="#0003" stroke-width="2"/>',
  4: '<path d="M50 22 Q62 4 74 12 Q62 18 50 22Z" fill="#7bd36b" stroke="#2c7a3a" stroke-width="2"/>',
  5: '<path d="M70 44 L90 34 L90 64 L70 54Z" fill="#fff" stroke="#0004" stroke-width="2"/><path d="M93 40 q6 9 0 18" stroke="#fff" stroke-width="3" fill="none"/>',
  6: '<circle cx="40" cy="47" r="10" fill="none" stroke="#2b2b4a" stroke-width="3"/><circle cx="62" cy="47" r="10" fill="none" stroke="#2b2b4a" stroke-width="3"/><path d="M50 47h2" stroke="#2b2b4a" stroke-width="3"/>',
  7: '<path d="M14 66 Q4 60 8 50" stroke="currentColor" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="8" cy="48" r="6" fill="currentColor"/><path d="M86 66 Q96 60 92 50" stroke="currentColor" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="92" cy="48" r="6" fill="currentColor"/>',
};

export function pradnikSVG(pad, body = 60, { velikost = 80, radost = false } = {}) {
  const p = PADY[pad];
  const s = stadium(body);
  if (s === 0) {
    return `<svg class="pradnik" viewBox="0 0 100 100" width="${velikost}" height="${velikost}" style="color:${p.barva}" aria-label="${p.jmeno} – vajíčko">
      <ellipse cx="50" cy="94" rx="26" ry="5" fill="#0002"/>
      <ellipse cx="50" cy="58" rx="28" ry="36" fill="#fffaf0" stroke="${p.barva}" stroke-width="4"/>
      <circle cx="40" cy="48" r="6" fill="${p.barva}" opacity=".55"/><circle cx="60" cy="68" r="8" fill="${p.barva}" opacity=".55"/><circle cx="58" cy="38" r="4" fill="${p.barva}" opacity=".55"/>
      <text x="50" y="66" text-anchor="middle" font-size="22" font-weight="900" fill="${p.barva}">${pad}.</text>
      ${body > 2 ? '<path d="M30 52 l8 6 l6 -7 l7 7" stroke="#8a6d4b" stroke-width="2" fill="none"/>' : ''}
    </svg>`;
  }
  const maly = s === 1;
  const sc = maly ? 0.78 : 1;
  const oci = radost
    ? '<path d="M36 50 q6 -7 12 0 M54 50 q6 -7 12 0" stroke="#2b2b4a" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
    : `<circle cx="42" cy="48" r="${maly ? 6 : 5}" fill="#fff"/><circle cx="60" cy="48" r="${maly ? 6 : 5}" fill="#fff"/><circle cx="43" cy="49" r="${maly ? 3.5 : 3}" fill="#2b2b4a"/><circle cx="61" cy="49" r="${maly ? 3.5 : 3}" fill="#2b2b4a"/>`;
  return `<svg class="pradnik" viewBox="0 0 100 100" width="${velikost}" height="${velikost}" style="color:${p.barva}" aria-label="${p.jmeno}">
    <ellipse cx="50" cy="95" rx="${30 * sc}" ry="5" fill="#0002"/>
    <g transform="translate(50 95) scale(${sc}) translate(-50 -95)">
      ${s >= 2 ? OZDOBY[pad] : ''}
      <path d="M50 22 C80 22 86 52 84 72 C82 90 70 94 50 94 C30 94 18 90 16 72 C14 52 20 22 50 22Z" fill="currentColor" stroke="#0003" stroke-width="2"/>
      <ellipse cx="50" cy="74" rx="20" ry="14" fill="#fff" opacity=".35"/>
      ${oci}
      <path d="M44 62 q7 ${radost ? 9 : 6} 14 0" stroke="#2b2b4a" stroke-width="3" fill="${radost ? '#c0392b' : 'none'}" stroke-linecap="round"/>
      <circle cx="33" cy="60" r="4" fill="#ff8fa3" opacity=".6"/><circle cx="69" cy="60" r="4" fill="#ff8fa3" opacity=".6"/>
      <text x="50" y="88" text-anchor="middle" font-size="13" font-weight="900" fill="#fff" opacity=".9">${pad}.</text>
      ${s >= 3 ? '<path d="M36 22 L38 8 L45 16 L50 4 L55 16 L62 8 L64 22Z" fill="#ffd34d" stroke="#c89b00" stroke-width="2"/>' : ''}
    </g>
  </svg>`;
}

// Kartička pádníka (v městečku po ťuknutí): čemu se v jeho pádu říká a jak se na něj ptát.
export const POVIDANI = {
  1: 'Bydlím v 1. patře. Já jsem ten, <b>kdo</b> nebo <b>co</b> něco dělá: <i>Pes běží.</i> Předložky nemám rád.',
  2: 'Bydlím ve 2. patře a ptám se <b>koho? čeho?</b> Kamarádím s předložkami <b>bez, do, od, z, u, kolem, vedle</b>.',
  3: 'Bydlím ve 3. patře a ptám se <b>komu? čemu?</b> Pořád něco rozdávám. Mám rád předložky <b>k, proti, kvůli, díky</b>.',
  4: 'Bydlím ve 4. patře a ptám se <b>koho? co?</b> (vidím koho? co?). Chodím s předložkami <b>pro, přes, na, za</b>.',
  5: 'Bydlím v 5. patře a nikdy se neptám, já <b>volám</b>: <i>Maminko! Pejsku!</i> Za mnou bývá čárka.',
  6: 'Bydlím v 6. patře a ptám se <b>o kom? o čem?</b> Beze předložky nevyjdu: <b>o, v, na, po, při</b>.',
  7: 'Bydlím v 7. patře a ptám se <b>s kým? s čím?</b> Rád chodím ve dvou. Předložky <b>s, před, pod, nad, za, mezi</b>.',
};
