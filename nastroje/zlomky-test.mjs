// Kontrola aplikace Zlomková výprava (web/zlomky): každý generátor z každého tématu vyrobí stovky úloh a pro
// každý krok se ověří, že správná odpověď projde kontrolou, špatná ne, a že v textech není NaN/undefined.
// Spuštění: node nastroje/zlomky-test.mjs
import { readFileSync } from 'node:fs';
import { generuj, GENERATORY } from '../web/zlomky/generatory.js';
import { zkontroluj, spravnaOdpoved, spravneHTML, Z, rovno, zkrat } from '../web/zlomky/zlomek.js';

const dir = new URL('../web/zlomky/data/', import.meta.url);
const kurz = JSON.parse(readFileSync(new URL('kurz.json', dir)));
const temata = kurz.temata.map((id) => JSON.parse(readFileSync(new URL(id + '.json', dir))));
const data = { sablony: {}, pevne: {} };
for (const t of temata) { Object.assign(data.sablony, t.sablony || {}); Object.assign(data.pevne, t.pevne || {}); }

let chyb = 0, uloh = 0;
const ocekavej = (podm, zprava) => { if (!podm) { chyb++; if (chyb < 40) console.error('✗', zprava); } };
const spatne = (k) => {
  const o = spravnaOdpoved(k);
  if (k.typ === 'volba') return { id: k.moznosti.find((m) => m.id !== k.spravne).id };
  if (k.typ === 'serad') return { poradi: [...o.poradi].reverse() };
  if (k.typ === 'vybarvi') return { k: o.k + 1, n: o.n };
  if (k.typ === 'cislo') return { t: String(+o.t.replace(',', '.') + 1) };
  if (o.c !== '') return { ...o, c: String(+o.c + 1) };
  return { ...o, j: String(+o.j + 1) };
};
function zkontrolujKrok(k, kde) {
  ocekavej(k.otazka && !/undefined|NaN|null/.test(k.otazka), `${kde}: otázka ${k.otazka}`);
  if (k.typ === 'zlomek' || k.typ === 'cislo') ocekavej(Number.isInteger(k.spravne.c) && Number.isInteger(k.spravne.j) && k.spravne.j > 0, `${kde}: spravne ${JSON.stringify(k.spravne)}`);
  if (k.typ === 'volba') ocekavej(k.moznosti.some((m) => m.id === k.spravne) && new Set(k.moznosti.map((m) => m.html)).size === k.moznosti.length, `${kde}: volby ${JSON.stringify(k.moznosti)}`);
  const r = zkontroluj(k, spravnaOdpoved(k));
  ocekavej(r.ok, `${kde}: správná odpověď neprošla ${JSON.stringify(spravnaOdpoved(k))} ${JSON.stringify(r)} ${k.otazka}`);
  const s = zkontroluj(k, spatne(k));
  ocekavej(!s.ok, `${kde}: špatná odpověď prošla ${JSON.stringify(spatne(k))}`);
  ocekavej(!/undefined|NaN/.test(spravneHTML(k)), `${kde}: spravneHTML`);
}
const pouzite = new Set();
for (const t of temata) {
  for (const p of t.polozky) {
    pouzite.add(p.gen);
    for (let i = 0; i < 300; i++) {
      const u = generuj(p.gen, p.param, data, []);
      uloh++;
      const kde = `${t.id}:${p.id}`;
      ocekavej(u.zadani && !/undefined|NaN|null|\{\w+\}/.test(u.zadani), `${kde}: zadání ${u.zadani}`);
      ocekavej(!/undefined|NaN/.test(u.vysvetleni), `${kde}: vysvětlení ${u.vysvetleni}`);
      u.kroky.forEach((k, j) => zkontrolujKrok(k, `${kde} krok ${j + 1}`));
      zkontrolujKrok(u.vysledek, `${kde} výsledek`);
      const posl = u.kroky[u.kroky.length - 1];
      if (posl.typ === 'zlomek' || posl.typ === 'cislo') ocekavej(rovno(posl.spravne, u.vysledek.spravne), `${kde}: výsledek = poslední krok`);
      if (u.vysledek.typ === 'zlomek') ocekavej(u.vysledek.spravne.c <= 999 && u.vysledek.spravne.j <= 999, `${kde}: příliš velká čísla ${JSON.stringify(u.vysledek.spravne)}`);
    }
  }
  ocekavej(t.lekce?.length >= 3 && t.strazce?.jmeno, `${t.id}: lekce a strážce`);
}
// pevné úlohy projdi všechny
for (const u of data.pevne.cermat) {
  const x = generuj('pevne', {}, { ...data, pevne: { cermat: [u] } }, []);
  x.kroky.forEach((k, j) => zkontrolujKrok(k, `pevná „${u.zadani.slice(0, 30)}…“ krok ${j + 1}`));
}
// tvar: neskrácený výsledek je „skoro“, smíšené číslo jde zadat, nepravý zlomek u „smisene“ ne
const k = { typ: 'zlomek', spravne: Z(3, 2), tvar: 'zakladni' };
ocekavej(zkontroluj(k, { w: '', c: '6', j: '4' }).skoro, 'neskrácený = skoro');
ocekavej(zkontroluj(k, { w: '1', c: '1', j: '2' }).ok, 'smíšené číslo projde');
ocekavej(zkontroluj({ ...k, tvar: 'smisene' }, { w: '', c: '3', j: '2' }).skoro, 'smíšené vyžaduje celou část');
ocekavej(zkontroluj({ typ: 'zlomek', spravne: Z(2), tvar: 'zakladni' }, { w: '', c: '2', j: '' }).ok, 'celé číslo jen čitatelem');
ocekavej(zkontroluj({ typ: 'cislo', spravne: Z(3, 4) }, { t: '0,75' }).ok, 'desetinná čárka');
console.log(chyb ? `${chyb} chyb` : `OK: ${temata.length} témat, ${uloh} vygenerovaných úloh, ${data.pevne.cermat.length} pevných úloh, generátorů ${pouzite.size}/${GENERATORY.length}`);
process.exit(chyb ? 1 : 0);
