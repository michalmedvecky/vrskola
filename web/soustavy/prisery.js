// Strážci ostrovů: vymyšlené příšerky kreslené z jednoduchých tvarů (žádné obrázky, žádné skutečné postavy).
// Vzhled určuje JSON tématu: { barva, oci (1–4), rohy (0–4) }.

const tmavsi = (hex, o = 40) => '#' + hex.slice(1).match(/../g).map((x) => Math.max(0, parseInt(x, 16) - o).toString(16).padStart(2, '0')).join('');

export function prisera(s, stav = '') {
  const b = s.barva || '#e17055', t = tmavsi(b), oci = Math.max(1, Math.min(4, s.oci || 2)), rohy = Math.max(0, Math.min(4, s.rohy || 0));
  let r = '';
  for (let i = 0; i < rohy; i++) {
    const x = rohy === 1 ? 100 : 55 + (i * 90) / (rohy - 1);
    const naklon = (x - 100) / 3;
    r += `<path d="M${x - 11},62 Q${x + naklon * 0.4},${20} ${x + naklon},14 Q${x + 6 + naklon * 0.2},40 ${x + 11},62 Z" fill="#fff4d6" stroke="${t}" stroke-width="3"/>`;
  }
  let o = '';
  const sirka = oci === 1 ? 0 : 74, zac = 100 - sirka / 2, vel = oci === 1 ? 24 : oci === 2 ? 17 : oci === 3 ? 14 : 12;
  for (let i = 0; i < oci; i++) {
    const x = oci === 1 ? 100 : zac + (i * sirka) / (oci - 1), y = 100 - (oci > 2 && (i === 0 || i === oci - 1) ? -4 : 0);
    const zavrene = stav === 'porazen';
    o += zavrene
      ? `<path d="M${x - vel * 0.8},${y} l${vel * 1.6},0 M${x - vel * 0.6},${y - vel * 0.6} l${vel * 1.2},${vel * 1.2} M${x + vel * 0.6},${y - vel * 0.6} l${-vel * 1.2},${vel * 1.2}" stroke="#2d1b0e" stroke-width="4" stroke-linecap="round"/>`
      : `<circle cx="${x}" cy="${y}" r="${vel}" fill="#fff" stroke="${t}" stroke-width="3"/><circle class="zornicka" cx="${x + 2}" cy="${y + 3}" r="${vel * 0.45}" fill="#2d1b0e"/><circle cx="${x + vel * 0.25}" cy="${y - vel * 0.1}" r="${vel * 0.15}" fill="#fff"/>`;
  }
  const pusa = stav === 'porazen'
    ? `<path d="M72,150 Q100,136 128,150" fill="none" stroke="#2d1b0e" stroke-width="5" stroke-linecap="round"/>`
    : `<path d="M66,138 Q100,170 134,138 Z" fill="#5a1a1a" stroke="${t}" stroke-width="3"/><path d="M78,140 l6,10 l6,-9 M110,141 l6,9 l6,-10" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`;
  return `<svg class="prisera ${stav}" viewBox="0 0 200 210" role="img" aria-label="${s.jmeno || 'strážce'}">
    <ellipse cx="100" cy="200" rx="62" ry="8" fill="#0003"/>
    ${r}
    <path d="M40,120 C30,60 70,48 100,48 C130,48 170,60 160,120 C168,170 140,196 100,196 C60,196 32,170 40,120 Z" fill="${b}" stroke="${t}" stroke-width="4"/>
    <path d="M62,186 l-6,12 M138,186 l6,12" stroke="${t}" stroke-width="8" stroke-linecap="round"/>
    <ellipse cx="70" cy="128" rx="10" ry="6" fill="#fff5" /><ellipse cx="130" cy="128" rx="10" ry="6" fill="#fff5"/>
    ${o}${pusa}
  </svg>`;
}
