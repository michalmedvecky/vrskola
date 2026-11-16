#!/usr/bin/env node
// Kontrola balíčků úloh hry Strážcy klýčú: každé téma vygeneruje spoustu úloh a zámků a ověří, že dávají smysl.
//   node nastroje/strazcy-test-ulohy.mjs
import { readFileSync } from 'node:fs';
import { vytvorUlohu, vytvorZamek, zkontrolujTema } from '../web/strazcy/ulohy.js';

const dir = new URL('../web/strazcy/data/', import.meta.url);
const index = JSON.parse(readFileSync(new URL('ukoly.json', dir)));
let chyb = 0;
const chyba = (m) => { chyb++; console.error('CHYBA', m); };
for (const balik of index.baliky) {
  for (const soubor of balik.temata) {
    const tema = JSON.parse(readFileSync(new URL(soubor, dir)));
    for (const c of zkontrolujTema(tema)) chyba(`${soubor}: ${c}`);
    for (let i = 0; i < 400; i++) {
      const u = vytvorUlohu(tema);
      if (u.typ === 'postupne') {
        for (const c of u.casti) if (typeof c !== 'string') {
          if (!c.moznosti.some((m) => m.hodnota === c.spravne)) chyba(`${soubor}: správná odpověď mezi možnostmi chybí ${JSON.stringify(c)}`);
          if (c.moznosti.length < 2) chyba(`${soubor}: jen jedna možnost ${u.popis}`);
        }
      } else if (u.typ === 'vyber') {
        if (u.spravna < 0 || new Set(u.moznosti).size !== u.moznosti.length || u.moznosti.length < 2) chyba(`${soubor}: výběr ${JSON.stringify(u.moznosti)}`);
      } else if (u.typ === 'sloupec') {
        const v = u.operace === '-' ? u.a - u.b : u.a * u.b;
        if (v !== u.vysledek || v < 0) chyba(`${soubor}: sloupec ${u.popis}`);
      } else if (u.typ === 'kroky') {
        const posl = u.kroky[u.kroky.length - 1];
        if (Number(posl.spravne) !== u.vysledek || !Number.isInteger(u.vysledek) || u.vysledek < 0) chyba(`${soubor}: kroky ${u.vyraz}`);
        if (u.kroky[0].moznosti && !u.kroky[0].moznosti.includes(u.kroky[0].spravne)) chyba(`${soubor}: kroky volba ${u.vyraz}`);
      } else if (u.typ === 'skladani') {
        for (const n of u.navic) if (u.tokeny.includes(n)) chyba(`${soubor}: kartička navíc je i ve větě ${u.popis}`);
      }
      const z = vytvorZamek(tema);
      if (z.spravna < 0 || z.moznosti.length < 2 || new Set(z.moznosti).size !== z.moznosti.length) chyba(`${soubor}: zámek ${JSON.stringify(z)}`);
    }
    console.log(`${soubor}: ok`);
  }
}
if (process.argv[2] === '-v') {
  for (const soubor of index.baliky[0].temata) {
    const tema = JSON.parse(readFileSync(new URL(soubor, dir)));
    for (let i = 0; i < 4; i++) { const u = vytvorUlohu(tema); console.log(u.podtyp, '|', u.popis); }
    for (let i = 0; i < 3; i++) { const z = vytvorZamek(tema); console.log('  zámek:', z.otazka, z.moznosti, z.spravna); }
  }
}
process.exit(chyb ? 1 : 0);
