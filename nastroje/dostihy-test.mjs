#!/usr/bin/env node
// Kontrola hry Dukáty a dostihy: úlohy (všechny operace a obtížnosti), data obchodu, dostihů a mapy, rychlá simulace závodu.
//   node nastroje/dostihy-test.mjs        (-v vypíše ukázky úloh)
import { readFileSync } from 'node:fs';
import { vytvorUlohu, zkontrolujData, OPERACE, prenosy, krokyDeleni } from '../web/dostihy/ulohy.js';
import { Zavod, souperiLigy, parametry } from '../web/dostihy/dostihy.js';
import { stupne, dalsiVec, VYCHOZI_KUN } from '../web/dostihy/kun.js';

const cti = (s) => JSON.parse(readFileSync(new URL(`../web/dostihy/data/${s}`, import.meta.url)));
const ukoly = cti('ukoly.json'), obchod = cti('obchod.json'), dostihy = cti('dostihy.json');
const v = process.argv.includes('-v');
let chyb = 0;
const chyba = (t) => { chyb++; console.log('✗', t); };
const cifer = (n) => String(n).length;

for (const c of zkontrolujData(ukoly)) chyba(`ukoly.json: ${c}`);

// úlohy: rozsahy cifer, správné výsledky, nejvýš 9 cifer
for (const op of OPERACE) {
  for (let o = 1; o <= 5; o++) {
    const def = ukoly.operace[op].urovne[o - 1];
    const ukazky = [];
    for (let i = 0; i < 400; i++) {
      const u = vytvorUlohu(ukoly, op, o);
      if (op === ':') {
        if (u.podil * u.delitel + u.zbytek !== u.delenec) chyba(`${u.popis}: špatný podíl`);
        if (u.zbytek >= u.delitel) chyba(`${u.popis}: zbytek ≥ dělitel`);
        if (!def.zbytek && u.zbytek) chyba(`${u.popis}: má být beze zbytku`);
        if (cifer(u.delenec) < def.delenec[0] || cifer(u.delenec) > def.delenec[1]) chyba(`${u.popis}: dělenec má ${cifer(u.delenec)} cifer`);
        if (cifer(u.delitel) < def.delitel[0] || cifer(u.delitel) > def.delitel[1]) chyba(`${u.popis}: dělitel má ${cifer(u.delitel)} cifer`);
        // kroky dávají dohromady podíl i zbytek
        const k = krokyDeleni(u.delenec, u.delitel);
        if (Number(k.map((x) => x.cislice).join('')) !== u.podil || k[k.length - 1].zbytek !== u.zbytek) chyba(`${u.popis}: kroky nesedí`);
        if (k.some((x) => x.cislice > 9 || x.zbytek >= u.delitel)) chyba(`${u.popis}: krok s cifrou > 9`);
      } else {
        const ocek = op === '+' ? u.a + u.b : op === '-' ? u.a - u.b : u.a * u.b;
        if (u.vysledek !== ocek) chyba(`${u.popis}: špatný výsledek`);
        if (cifer(u.vysledek) > 9) chyba(`${u.popis}: výsledek má víc než 9 cifer`);
        if (op === '-' && u.vysledek <= 0) chyba(`${u.popis}: záporný nebo nulový rozdíl`);
        if (cifer(u.a) < def.a[0] || cifer(u.a) > def.a[1]) chyba(`${u.popis}: a má ${cifer(u.a)} cifer (čekám ${def.a})`);
        if (op !== '×' && (cifer(u.b) < def.b[0] || cifer(u.b) > def.b[1])) chyba(`${u.popis}: b má ${cifer(u.b)} cifer`);
        // přenosy: číslice výsledku = (číslice a ± číslice b ± přenos) mod 10
        if (op !== '×' || u.b < 10) {
          const p = prenosy(op, u.a, u.b);
          for (let k = 0; k < cifer(u.vysledek); k++) {
            const da = Math.floor(u.a / 10 ** k) % 10, db = Math.floor(u.b / 10 ** k) % 10, dv = Math.floor(u.vysledek / 10 ** k) % 10;
            const ok = op === '+' ? (da + db + p[k]) % 10 === dv : op === '-' ? ((da - db - p[k]) % 10 + 10) % 10 === dv : k < cifer(u.a) ? (da * u.b + p[k]) % 10 === dv : p[k] % 10 === dv;
            if (!ok) { chyba(`${u.popis}: přenos ve sloupci ${k}`); break; }
          }
        }
      }
      if (i < 3) ukazky.push(u.popis);
    }
    if (v) console.log(`${op} obtížnost ${o}: ${ukazky.join('   ')}`);
  }
}

// obchod: unikátní id, rostoucí ceny, závislost na zdraví
const ids = new Set();
for (const vl of obchod.vlastnosti) {
  if (vl.veci.length !== 8) chyba(`obchod ${vl.id}: má mít 8 věcí (MAX_STUPEN)`);
  vl.veci.forEach((x, i) => { if (ids.has(x.id)) chyba(`obchod: duplicitní id ${x.id}`); ids.add(x.id); if (i && x.cena < vl.veci[i - 1].cena) chyba(`obchod ${x.id}: cena neroste`); });
}
const kun = { ...VYCHOZI_KUN, koupeno: [] };
const sila = obchod.vlastnosti.find((x) => x.id === 'rychlost');
kun.koupeno.push('oves', 'mrkve');
if (!dalsiVec(kun, obchod, sila).chybiZdravi) chyba('obchod: 3. věc síly má chtít zdraví');
kun.koupeno.push('veterinar');
if (dalsiVec(kun, obchod, sila).chybiZdravi) chyba('obchod: se zdravím 1 má jít koupit 3. věc síly');
if (stupne(kun, obchod).rychlost !== 2) chyba('obchod: stupně se špatně počítají');
const celkem = obchod.vlastnosti.reduce((s, x) => s + x.veci.reduce((a, b) => a + b.cena, 0), 0);
console.log(`Obchod: ${ids.size} věcí, všechno dohromady za ${celkem} dukátů.`);

// mapa: všechny vesnice jsou dosažitelné z Kounic
const mapa = cti('mapa-posazavi.json');
const sous = new Map(mapa.mesta.map((m) => [m.id, []]));
for (const [a, b] of mapa.cesty) { if (!sous.has(a) || !sous.has(b)) chyba(`mapa: cesta ${a}–${b} vede neznámo kam`); else { sous.get(a).push(b); sous.get(b).push(a); } }
const videno = new Set([mapa.start]), fronta = [mapa.start];
while (fronta.length) for (const x of sous.get(fronta.shift())) if (!videno.has(x)) { videno.add(x); fronta.push(x); }
for (const m of mapa.mesta) if (!videno.has(m.id)) chyba(`mapa: ${m.nazev} není spojená s Kounicemi`);
console.log(`Mapa: ${mapa.mesta.length - 1} vesnic s truhlou.`);

// dostihy: závod doběhne, pořadí obsahuje všechny
for (const liga of dostihy.ligy) {
  for (let i = 0; i < 30; i++) {
    const z = new Zavod({ ...liga, souperi: souperiLigy(liga) }, { jmeno: 'test', rychlost: 3, kondice: 3, skok: 3 });
    for (let t = 0; t < 300 && !z.konec; t += 1 / 30) z.krok(1 / 30, { sprint: true, skok: Math.random() < 0.05 });
    if (!z.konec || z.poradi.length !== liga.souperi.length + 1) { chyba(`${liga.nazev}: závod nedoběhl`); break; }
  }
}
if (parametry({ rychlost: 8, kondice: 8, skok: 8 }).okno <= parametry({}).okno) chyba('lepší kůň musí mít delší okno pro skok');

// rozpoznávání psaných číslic: model se načte a jednoduché tvary přečte správně
{
  const { nastavModel, predikuj } = await import('../web/dostihy/cislice.js');
  const j = JSON.parse(readFileSync(new URL('../web/dostihy/cislice-model.json', import.meta.url)));
  nastavModel(j);
  const tvar = (fn) => { const o = new Float32Array(784); for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) if (fn(x, y)) o[y * 28 + x] = 1; return o; };
  const vzory = {
    1: tvar((x, y) => y >= 4 && y <= 23 && x >= 13 && x <= 15),
    0: tvar((x, y) => { const d = Math.hypot((x - 13.5) / 6.5, (y - 13.5) / 9.5); return d > 0.75 && d < 1.05; }),
    7: tvar((x, y) => (y >= 4 && y <= 6 && x >= 7 && x <= 21) || (y > 6 && y <= 23 && Math.abs(x - (21 - (y - 6) * 0.55)) <= 1.3)),
  };
  for (const [c, o] of Object.entries(vzory)) {
    const { p } = predikuj(o);
    const nej = p.indexOf(Math.max(...p));
    if (String(nej) !== c) chyba(`rozpoznávání: ${c} přečteno jako ${nej}`);
    else if (v) console.log(`  číslice ${c}: ${(p[nej] * 100).toFixed(0)} %`);
  }
}

console.log(chyb ? `\n${chyb} chyb` : 'Vše v pořádku ✓');
process.exit(chyb ? 1 : 0);
