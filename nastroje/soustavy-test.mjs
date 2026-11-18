// Kontrola hry Dvojvrch (web/soustavy): každý generátor z každého tématu vyrobí stovky úloh a pro každý krok se
// ověří, že správná odpověď projde kontrolou, špatná ne, a že v textech není NaN/undefined. Projde i pevné úlohy.
// Spuštění: node nastroje/soustavy-test.mjs
import { readFileSync } from 'node:fs';
import { generuj, GENERATORY } from '../web/soustavy/generatory.js';
import { zkontroluj, spravnaOdpoved, spravneHTML, odpovedHTML, Z, T, rovno, text } from '../web/soustavy/cisla.js';

const dir = new URL('../web/soustavy/data/', import.meta.url);
const kurz = JSON.parse(readFileSync(new URL('kurz.json', dir)));
const temata = kurz.temata.map((id) => JSON.parse(readFileSync(new URL(id + '.json', dir))));
const data = { sablony: {}, pevne: {} };
for (const t of temata) { Object.assign(data.sablony, t.sablony || {}); Object.assign(data.pevne, t.pevne || {}); }

let chyb = 0, uloh = 0;
const ocekavej = (podm, zprava) => { if (!podm) { chyb++; if (chyb < 40) console.error('✗', zprava); } };
const ZLE = /undefined|NaN|null|\{\w+\}|\[object/;
const spatne = (k) => {
  if (k.typ === 'volba') return { id: k.moznosti.find((m) => m.id !== k.spravne).id };
  const o = spravnaOdpoved(k);
  return { pole: o.pole.map((x, i) => (i === o.pole.length - 1 ? T(Z(+x.replace('−', '-').split('/')[0] + 1, +(x.split('/')[1] || 1))) : x)) };
};
function zkontrolujKrok(k, kde) {
  ocekavej(k.otazka && !ZLE.test(k.otazka), `${kde}: otázka ${k.otazka}`);
  ocekavej(!ZLE.test(k.napoveda || ''), `${kde}: nápověda ${k.napoveda}`);
  if (k.typ === 'cisla') {
    ocekavej(k.pole.length === k.spravne.length, `${kde}: počet polí`);
    ocekavej(k.spravne.every((z) => Number.isInteger(z.c) && Number.isInteger(z.j) && z.j > 0 && Math.abs(z.c) < 10000), `${kde}: spravne ${JSON.stringify(k.spravne)}`);
    if (k.umer) ocekavej(k.spravne.some((z) => z.c !== 0), `${kde}: umer s nulami`);
  }
  if (k.typ === 'volba') ocekavej(k.moznosti.some((m) => m.id === k.spravne) && new Set(k.moznosti.map((m) => m.html)).size === k.moznosti.length && k.moznosti.length >= 2, `${kde}: volby ${JSON.stringify(k.moznosti)}`);
  const r = zkontroluj(k, spravnaOdpoved(k));
  ocekavej(r.ok, `${kde}: správná odpověď neprošla ${JSON.stringify(spravnaOdpoved(k))} ${JSON.stringify(r)} ${k.otazka}`);
  const s = zkontroluj(k, spatne(k));
  ocekavej(!s.ok, `${kde}: špatná odpověď prošla ${JSON.stringify(spatne(k))} ${k.otazka}`);
  ocekavej(!ZLE.test(spravneHTML(k)), `${kde}: spravneHTML ${spravneHTML(k)}`);
}
const pouzite = new Set();
for (const t of temata) {
  for (const p of t.polozky) {
    pouzite.add(p.gen);
    for (let i = 0; i < 400; i++) {
      const u = generuj(p.gen, p.param, data, []);
      uloh++;
      const kde = `${t.id}:${p.id}`;
      ocekavej(u.zadani && !ZLE.test(u.zadani), `${kde}: zadání ${u.zadani}`);
      ocekavej(!ZLE.test(u.vysvetleni), `${kde}: vysvětlení ${u.vysvetleni}`);
      u.kroky.forEach((k, j) => zkontrolujKrok(k, `${kde} krok ${j + 1}`));
      zkontrolujKrok(u.vysledek, `${kde} výsledek`);
    }
  }
  ocekavej(t.lekce?.length >= 3 && t.strazce?.jmeno && t.misto, `${t.id}: lekce, strážce, místo`);
  for (const sn of t.lekce) ocekavej(!/\{[^}]*\}|\[\[/.test(text(sn.text.join(' '))), `${t.id}: neznámá značka v lekci „${sn.nadpis}“`);
}
for (const u of data.pevne.cermat) {
  const x = generuj('pevne', {}, { ...data, pevne: { cermat: [u] } }, []);
  ocekavej(!ZLE.test(x.zadani) && !/\[\[/.test(x.zadani), `pevná zadání ${x.zadani}`);
  x.kroky.forEach((k, j) => zkontrolujKrok(k, `pevná „${u.zadani.slice(0, 30)}…“ krok ${j + 1}`));
}
// tvar odpovědí
const k1 = { typ: 'cisla', pole: [{ pred: 'x =' }], spravne: [Z(3, 2)] };
ocekavej(zkontroluj(k1, { pole: ['6/4'] }).skoro, 'nezkrácený zlomek = skoro');
ocekavej(zkontroluj(k1, { pole: ['1,5'] }).ok, 'desetinné číslo projde');
ocekavej(zkontroluj(k1, { pole: ['3/2'] }).ok, 'zlomek projde');
ocekavej(zkontroluj({ ...k1, spravne: [Z(-4)] }, { pole: ['−4'] }).ok, 'záporné číslo');
ocekavej(zkontroluj({ ...k1, spravne: [Z(4)] }, { pole: ['8/2'] }).skoro, 'celé číslo zlomkem = skoro');
const rce = { typ: 'cisla', pole: [{}, {}, {}], spravne: [Z(1), Z(2), Z(3)], umer: true };
ocekavej(zkontroluj(rce, { pole: ['2', '4', '6'] }).ok && zkontroluj(rce, { pole: ['−1', '−2', '−3'] }).ok && !zkontroluj(rce, { pole: ['2', '4', '5'] }).ok && !zkontroluj(rce, { pole: ['0', '0', '0'] }).ok, 'úměrná rovnice');
ocekavej(odpovedHTML({ pole: [{}, {}, {}], vzor: { cleny: ['x', 'y'], prava: true } }, ['2', '-1', '0']) === '2x − y = 0', 'zápis rovnice ' + odpovedHTML({ pole: [{}, {}, {}], vzor: { cleny: ['x', 'y'], prava: true } }, ['2', '-1', '0']));
ocekavej(rovno(Z(1, 2), Z(2, 4)), 'rovno');
console.log(chyb ? `${chyb} chyb` : `OK: ${temata.length} témat, ${uloh} vygenerovaných úloh, ${data.pevne.cermat.length} pevných úloh, generátorů ${pouzite.size}/${GENERATORY.length}`);
process.exit(chyb ? 1 : 0);
