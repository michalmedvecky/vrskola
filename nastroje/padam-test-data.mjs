// Kontrola dat hry Padám padám (web/padam/data). Spuštění: node nastroje/padam-test-data.mjs [-v]
// Ověří formát vět, položek Ptáčka a slov Proměn a vypíše, kolik je čeho po pádech.
import { readFileSync } from 'node:fs';
import { rozeberVetu, predlozkaPred, otazkaSPredlozkou } from '../web/padam/spolecne.js';

const DIR = new URL('../web/padam/data/', import.meta.url);
const nacti = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const podrobne = process.argv.includes('-v');
let chyb = 0;
const chyba = (kde, co) => { chyb++; console.log(`✗ ${kde}: ${co}`); };

for (const b of nacti('obsah.json').baliky) {
  console.log(`\n== balík ${b.id}: ${b.nazev}`);
  const poPadech = (pole) => [1, 2, 3, 4, 5, 6, 7].map((c) => `${c}.:${pole.filter((x) => x === c).length}`).join(' ');

  // věty (výtah, detektiv)
  const vety = (b.vety || []).flatMap((f) => nacti(f).vety);
  const pady = [];
  let detektivnich = 0;
  for (const v of vety) {
    if ((v.match(/\[/g) || []).length !== (v.match(/\]/g) || []).length) chyba(v, 'nesedí závorky');
    const slova = rozeberVetu(v).filter((k) => k.slovo);
    if (!slova.length) chyba(v, 'žádné slovo v [ ]');
    for (const s of slova) {
      if (!(s.pad >= 1 && s.pad <= 7)) chyba(v, `slovo „${s.slovo}“ nemá pád 1–7`);
      pady.push(s.pad);
    }
    const p = slova.map((s) => s.pad);
    if (p.length >= 2 && p.some((x) => p.indexOf(x) === p.lastIndexOf(x))) detektivnich++;
  }
  console.log(`věty: ${vety.length} (pro detektiva ${detektivnich}), slova po pádech ${poPadech(pady)}`);
  if (new Set(vety).size !== vety.length) chyba('věty', 'některá věta je tam dvakrát');

  // ptáček
  const polozky = (b.ptacek || []).flatMap((f) => nacti(f).polozky);
  const pp = [];
  for (const p of polozky) {
    const kusy = rozeberVetu(p.veta);
    const slova = kusy.filter((k) => k.slovo);
    if (slova.length !== 1) { chyba(p.veta, 'má mít právě jedno [slovo]'); continue; }
    const i = kusy.findIndex((k) => k.slovo);
    const pr = p.predlozka ? predlozkaPred(p.predlozka) : predlozkaPred(kusy[i - 1]?.text);
    if (!pr) chyba(p.veta, 'před [slovem] chybí předložka');
    if (![2, 3, 4, 6, 7].includes(p.pad)) chyba(p.veta, 'pád musí být 2, 3, 4, 6 nebo 7');
    if (!p.zaklad) chyba(p.veta, 'chybí zaklad');
    if (!Array.isArray(p.spatne) || p.spatne.length < 1) chyba(p.veta, 'chybí spatne');
    else if (p.spatne.includes(slova[0].slovo)) chyba(p.veta, 'špatný tvar je stejný jako správný');
    pp.push(p.pad);
    if (podrobne && pr) console.log(`  ${otazkaSPredlozkou(pr.zaklad, p.pad).padEnd(28)} ${p.veta}`);
  }
  console.log(`ptáček: ${polozky.length} vět, po pádech ${poPadech(pp)}`);

  // proměny
  const slova = (b.promeny || []).flatMap((f) => nacti(f).slova);
  for (const s of slova) {
    if (s.tvary?.length !== 7) chyba(s.slovo, 'tvary musí mít 7 položek (1.–7. pád)');
    if (s.sceny?.length !== 7) chyba(s.slovo, 'sceny musí mít 7 vět');
    (s.sceny || []).forEach((sc, i) => { if ((sc.match(/_/g) || []).length !== 1) chyba(`${s.slovo} scéna ${i + 1}`, 'má mít právě jedno _'); });
    if (podrobne) s.sceny?.forEach((sc, i) => console.log(`  ${i + 1}. ${sc.replace('_', s.tvary[i].split('|')[0])}`));
  }
  console.log(`proměny: ${slova.length} slov (${slova.map((s) => s.slovo).join(', ')})`);
}
console.log(chyb ? `\n${chyb} chyb` : '\nvše v pořádku');
process.exit(chyb ? 1 : 0);
