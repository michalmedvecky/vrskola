#!/usr/bin/env node
// Převede mapu zadanou GPS souřadnicemi na mapu pro hru Marketka (souřadnice v pixelech).
//   node nastroje/marketka-mapa.mjs nastroje/marketka-berounsko.gps.json > web/marketka/data/mapa-berounsko.json
// Ve zdroji: "gps": [šířka, délka] u bodů, "gps": [[š, d], ...] u čar a ploch, "okraj" = výřez mapy, "pxNaKm" = měřítko.
import { readFileSync } from 'node:fs';

const zdroj = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { sever, jih, zapad, vychod } = zdroj.okraj;
const pxNaKm = zdroj.pxNaKm || 80;
const latStred = (sever + jih) / 2;
const kmNaStupenSirky = 111.2;
const kmNaStupenDelky = 111.32 * Math.cos(latStred * Math.PI / 180);
const bod = ([lat, lon]) => [
  Math.round((lon - zapad) * kmNaStupenDelky * pxNaKm),
  Math.round((sever - lat) * kmNaStupenSirky * pxNaKm),
];
const [sirka, vyska] = bod([jih, vychod]);

const mapa = {
  id: zdroj.id,
  nazev: zdroj.nazev,
  sirka, vyska,
  start: zdroj.start,
  ...(zdroj.pozadi ? { pozadi: zdroj.pozadi } : {}),
  mesta: zdroj.mesta.map(({ gps, ...m }) => { const [x, y] = bod(gps); return { ...m, x, y }; }),
  cesty: zdroj.cesty,
  reky: (zdroj.reky || []).map(({ gps, ...r }) => ({ ...r, body: gps.map(bod) })),
  lesy: (zdroj.lesy || []).map(({ gps, ...l }) => ({ ...l, body: gps.map(bod) })),
  kopce: (zdroj.kopce || []).map(({ gps, ...k }) => { const [x, y] = bod(gps); return { ...k, x, y }; }),
  popisky: (zdroj.popisky || []).map(({ gps, ...p }) => { const [x, y] = bod(gps); return { ...p, x, y }; }),
};

// Kompaktní výpis: pole čísel na jeden řádek.
const json = JSON.stringify(mapa, null, 2).replace(/\[\s+(-?\d+),\s+(-?\d+)\s+\]/g, '[$1, $2]');
process.stdout.write(json + '\n');
