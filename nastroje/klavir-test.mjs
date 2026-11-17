// Kontrola aplikace Stupnice a sluch (web/klavir): pravopis všech stupnic, předznamenání, paralelní tóniny
// a že každé cvičení v kurzu má mezi možnostmi správnou odpověď. Spuštění: node nastroje/klavir-test.mjs
import * as h from '../web/klavir/hudba.js';
import { vytvor } from '../web/klavir/cviceni.js';
import { VSECHNY_POLOZKY, JEDNOTKY } from '../web/klavir/kurz.js';

let chyb = 0;
const ocekavej = (podminka, zprava) => { if (!podminka) { chyb++; console.error('✗', zprava); } };

for (const [rod, seznam] of [['dur', h.DUR], ['moll', h.MOLL]]) {
  seznam.forEach((t, i) => {
    const id = `${t}-${rod}`;
    for (const druh of rod === 'dur' ? ['dur'] : ['aiolska', 'harmonicka', 'melodicka']) {
      const s = h.stupnice(id, druh);
      ocekavej(new Set(s.slice(0, 7).map((x) => x.l)).size === 7, `${id} ${druh}: každé písmeno jednou`);
      const iv = s.map((x) => h.midi(x) - h.midi(s[0]));
      ocekavej(JSON.stringify(iv) === JSON.stringify(h.DRUHY[druh].intervaly), `${id} ${druh}: intervaly ${iv}`);
      ocekavej(s.every((x) => h.midi(x) >= 60 && h.midi(x) <= 84), `${id} ${druh}: v rozsahu klaviatury`);
    }
    const p = h.predznamenani(id);
    const ocek = i < 8 ? { pocet: i, znak: i ? '♯' : '' } : { pocet: i - 7, znak: '♭' };
    ocekavej(p.pocet === ocek.pocet && p.znak === ocek.znak, `${id}: předznamenání ${p.pocet}${p.znak}`);
    const par = h.paralelni(id);
    ocekavej(h.paralelni(par) === id, `${id}: paralelní ${par} tam a zpět`);
    ocekavej(h.popisPredznamenani(h.predznamenani(par)) === h.popisPredznamenani(p), `${id}: paralelní má stejné předznamenání`);
  });
}
ocekavej(h.jmeno(h.zJmena('b')) === 'b' && h.jmeno({ l: 4, a: 2 }) === 'gisis', 'názvy tónů');

for (const id of VSECHNY_POLOZKY) {
  for (let k = 0; k < 40; k++) {
    const c = vytvor(id);
    if (c.typ === 'volba') {
      ocekavej(c.moznosti.some((m) => m.id === c.spravne), `${id}: správná odpověď mezi možnostmi`);
      ocekavej(new Set(c.moznosti.map((m) => m.id)).size === c.moznosti.length && c.moznosti.length >= 2, `${id}: možnosti bez duplicit`);
    } else ocekavej(c.ocekavane.length === c.jmena.length && c.ocekavane.length > 0, `${id}: očekávané tóny`);
    ocekavej(c.vysvetleni && c.ukaz?.sled?.length, `${id}: vysvětlení a ukázka po chybě`);
  }
}
ocekavej(new Set(VSECHNY_POLOZKY).size === VSECHNY_POLOZKY.length, 'položky kurzu jsou unikátní');
console.log(chyb ? `${chyb} chyb` : `OK: ${JEDNOTKY.length} jednotek, ${VSECHNY_POLOZKY.length} položek, 30 stupnic`);
process.exit(chyb ? 1 : 0);
