// Kontrola hry Slovní zoo (web/zoo): data (slova, věty, šatna, lekce) a generátory úloh.
// Každý generátor v každém výběhu vyrobí stovky úloh a ověří se, že správná odpověď je mezi možnostmi,
// že v textech není undefined a že lekce odkazují na existující věty.
// Spuštění: node nastroje/zoo-test.mjs
import { readFileSync } from 'node:fs';
import { generuj, pripravData, vysvetli } from '../web/zoo/ulohy.js';

const dir = new URL('../web/zoo/data/', import.meta.url);
const nacti = (n) => JSON.parse(readFileSync(new URL(n + '.json', dir)));
const json = Object.fromEntries(['kurz', 'druhy', 'slova', 'vety', 'promeny', 'vybehy'].map((n) => [n, nacti(n)]));
const data = pripravData(json);
let chyb = 0, uloh = 0;
const ocekavej = (podm, zprava) => { if (!podm) { chyb++; if (chyb < 40) console.error('✗', zprava); } };
const cisto = (s) => typeof s === 'string' && !/undefined|NaN|null|\{slovo\}/.test(s);

// data
ocekavej(Object.keys(data.D).length === 10, 'deset druhů');
for (let d = 1; d <= 10; d++) ocekavej(data.S[d]?.length >= 10, `druh ${d}: málo slov (${data.S[d]?.length})`);
const vsechnaSlova = Object.values(data.S).flat();
const dvojita = vsechnaSlova.filter((w, i) => vsechnaSlova.indexOf(w) !== i);
ocekavej(!dvojita.length, `slovo ve dvou druzích (dej ho do nejednoznacna): ${[...new Set(dvojita)].join(', ')}`);
for (const v of json.vety.vety) {
  const t = data.vety.find((x) => x.v === v.v)?.tok || [];
  const zbytek = v.v.replace(/\S+?\/\d+[^\s]*/g, '').trim();
  ocekavej(!zbytek, `věta bez označení slova: ${v.v} (${zbytek})`);
  ocekavej(t.every((x) => x.d >= 1 && x.d <= 10), `věta s neplatným druhem: ${v.v}`);
  for (const k of Object.keys(v.pozn || {})) ocekavej(t.some((x) => x.t === k), `poznámka ke slovu, které ve větě není: ${k} / ${v.v}`);
  ocekavej(!t.some((x) => /^(se|si)$/i.test(x.t) && x.d !== 7), `zvratné se/si ve větě: ${v.v}`);
}
for (let d = 1; d <= 10; d++) ocekavej(data.vety.filter((v) => v.tok.some((x) => x.d === d)).length >= 6, `druh ${d}: málo vět`);
for (const e of json.promeny.ohebna) {
  ocekavej(new Set(e.tvary.map((x) => x.toLowerCase())).size >= 3, `šatna ${e.slovo}: málo tvarů`);
  for (const [v, sp] of e.zkus) ocekavej(v.includes('___') && e.tvary.some((x) => x.toLowerCase() === sp.toLowerCase()), `šatna ${e.slovo}: ${v} / ${sp}`);
}
const vybehy = json.vybehy.vybehy;
const druhyVybehu = vybehy.map((t) => t.druh).filter(Boolean);
ocekavej(new Set(druhyVybehu).size === 10, 'každý druh má právě jeden výběh');
for (const t of vybehy) {
  ocekavej(t.lekce.length >= 3 && t.strazce?.jmeno, `${t.id}: lekce a strážce`);
  for (const sn of t.lekce) {
    if (sn.veta) ocekavej(data.vety.some((v) => v.v === sn.veta), `${t.id}: věta v lekci není ve vety.json: ${sn.veta}`);
    for (const p of sn.text) for (const m of p.matchAll(/\[([^|\]]+)\|(\d+)\]/g)) ocekavej(+m[2] >= 1 && +m[2] <= 10, `${t.id}: štítek ${m[0]}`);
  }
}

// generátory
const naucDo = (i) => vybehy.slice(0, i + 1).map((t) => t.druh).filter(Boolean);
function zkontroluj(u, kde) {
  uloh++;
  ocekavej(u.klic != null, `${kde}: klíč`);
  if (u.typ === 'druh') {
    ocekavej(cisto(u.slovo), `${kde}: slovo ${u.slovo}`);
    ocekavej(u.spravne === 0 ? u.kos && !u.moznosti.includes(u.skutecny) : u.moznosti.includes(u.spravne), `${kde}: správná odpověď ${u.spravne} mimo možnosti ${u.moznosti} (${u.slovo})`);
    const spatna = [...u.moznosti, ...(u.kos ? [0] : [])].find((x) => x !== u.spravne);
    if (spatna != null) ocekavej(cisto(vysvetli(data, { ...u, zvoleny: spatna })), `${kde}: vysvětlení`);
  } else if (u.typ === 'najdi') {
    ocekavej(u.spravne.length >= 1 && u.spravne.every((i) => u.veta[i].d === u.cil), `${kde}: najdi`);
  } else if (u.typ === 'vlacek') {
    ocekavej(u.poradi.length >= 3 && u.poradi.every((i) => u.moznosti.includes(u.veta[i].d)), `${kde}: vláček ${u.klic}`);
  } else if (u.typ === 'volba') {
    ocekavej(cisto(u.otazka) && cisto(u.vysvetleni), `${kde}: texty volby`);
    ocekavej(u.moznosti.some((m) => m.id === u.spravne) && new Set(u.moznosti.map((m) => m.id)).size === u.moznosti.length && u.moznosti.length >= 2, `${kde}: možnosti ${JSON.stringify(u.moznosti)}`);
  } else ocekavej(false, `${kde}: neznámý typ ${u.typ}`);
}
vybehy.forEach((t, i) => {
  for (const p of t.polozky) {
    const posl = [];
    for (let k = 0; k < 300; k++) {
      const u = generuj(p.gen, p.param, data, { cil: t.druh, naucene: naucDo(i), posl });
      posl.unshift(u.klic); posl.length = Math.min(posl.length, 14);
      zkontroluj(u, `${t.id}:${p.id}`);
    }
  }
});
// Velká zkouška: všechny druhy, bez cíle
for (const g of ['krmeni', 'veta', 'najdi', 'vlacek', 'cislo', 'zkus', 'satna', 'skupina'])
  for (let k = 0; k < 200; k++) zkontroluj(generuj(g, {}, data, { cil: null, naucene: naucDo(vybehy.length - 1), posl: [] }), `zkouška:${g}`);

console.log(chyb ? `✗ ${chyb} chyb (${uloh} úloh)` : `✓ v pořádku (${uloh} úloh, ${data.vety.length} vět, ${vsechnaSlova.length} slov)`);
process.exit(chyb ? 1 : 0);
