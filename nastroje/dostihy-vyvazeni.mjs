#!/usr/bin/env node
// Vyvážení dostihů: pustí tisíce závodů s „robotem“ místo hráče a vypíše, jak často vyhraje.
//   node nastroje/dostihy-vyvazeni.mjs            (tabulka šancí na výhru)
// Robot skáče s náhodnou chybou odrazu σ (dobrý hráč 0,07 s, průměrný 0,12 s, slabší 0,18 s)
// a pobízí rozumně (šetří síly na konec) nebo „pořád“ (drží pobídku celou dobu).
import { readFileSync } from 'node:fs';
import { Zavod, souperiLigy, IDEAL_SKOKU } from '../web/dostihy/dostihy.js';

const ligy = JSON.parse(readFileSync(new URL('../web/dostihy/data/dostihy.json', import.meta.url))).ligy;
function gauss() { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); }

export function zavodRobota(liga, stupen, sigma, styl = 'chytre') {
  const kun = { jmeno: 'robot', rychlost: stupen, kondice: stupen, skok: stupen };
  const z = new Zavod({ ...liga, souperi: souperiLigy(liga) }, kun);
  const h = z.hrac;
  let plan = null;
  const dt = 1 / 30;
  for (let t = 0; t < 400 && !z.konec; t += dt) {
    const i = z.dalsiPrekazka(h);
    let skok = false;
    if (i >= 0 && !z.vzduchem(h)) {
      if (plan?.i !== i) plan = { i, e: gauss() * sigma };
      const d = z.prekazky[i] - h.x;
      if (d <= Math.max(h.v, 3) * (IDEAL_SKOKU + plan.e)) skok = true;
    }
    const zbyva = z.delka - h.x;
    const sprint = styl === 'porad' ? true : !h.vycerpany && (zbyva < z.delka * 0.35 || h.sila / h.p.sila > 0.5);
    z.krok(dt, { skok, sprint });
  }
  return z.mistoHrace();
}

const N = Number(process.argv[2]) || 1500;
for (const liga of ligy) {
  console.log(`\n${liga.nazev}  (soupeři ${liga.souperi.map((x) => x.join('–')).join(', ')}, σ ${liga.presnost})   šance na 1. místo / na stupně vítězů`);
  console.log('stupeň koně'.padEnd(13) + ['dobrý 0,07', 'průměr 0,12', 'slabší 0,18', 'průměr, pořád pobízí'].map((s) => s.padStart(22)).join(''));
  for (const st of (process.argv[3] || '0,1,2,3,4,5,6,7,8').split(',').map(Number)) {
    const bunky = [[0.07, 'chytre'], [0.12, 'chytre'], [0.18, 'chytre'], [0.12, 'porad']].map(([s, styl]) => {
      let v = 0, p = 0;
      for (let i = 0; i < N; i++) { const m = zavodRobota(liga, st, s, styl); if (m === 1) v++; if (m <= 3) p++; }
      return `${Math.round((100 * v) / N)} % / ${Math.round((100 * p) / N)} %`.padStart(22);
    });
    console.log(String(st).padEnd(13) + bunky.join(''));
  }
}
