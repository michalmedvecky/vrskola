// Kontrola hry Hotel Kuriózum (web/casy): data (hosté, věty, patra) a generátory úloh.
// Každý generátor vyrobí stovky úloh a ověří se, že je přesně jedna správná možnost, možnosti se neopakují,
// v textech není undefined a tvary sloves sedí s kontrolní tabulkou.
// Spuštění: node nastroje/casy-test.mjs
import { readFileSync } from 'node:fs';
import { generuj, pripravData, tvarS, tvarIng, kartaHosta } from '../web/casy/ulohy.js';

const dir = new URL('../web/casy/data/', import.meta.url);
const nacti = (n) => JSON.parse(readFileSync(new URL(n + '.json', dir)));
const json = Object.fromEntries(['kurz', 'patra', 'hoste', 'jazyk', 'vety'].map((n) => [n, nacti(n)]));
const data = pripravData(json);
let chyb = 0, uloh = 0;
const ocekavej = (podm, zprava) => { if (!podm) { chyb++; if (chyb < 40) console.error('✗', zprava); } };
const cisto = (s) => typeof s === 'string' && !/undefined|NaN|null|\{pos\}|\[object/.test(s);
const bez = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

// tvary sloves: kontrolní tabulka pro záludné případy
const TAB = {
  watch: ['watches', 'watching'], fix: ['fixes', 'fixing'], go: ['goes', 'going'], do: ['does', 'doing'], buzz: ['buzzes', 'buzzing'],
  fly: ['flies', 'flying'], carry: ['carries', 'carrying'], play: ['plays', 'playing'], have: ['has', 'having'], make: ['makes', 'making'],
  swim: ['swims', 'swimming'], run: ['runs', 'running'], lie: ['lies', 'lying'], tie: ['ties', 'tying'], see: ['sees', 'seeing'],
  argue: ['argues', 'arguing'], knit: ['knits', 'knitting'], visit: ['visits', 'visiting'], open: ['opens', 'opening'], wait: ['waits', 'waiting'],
  sunbathe: ['sunbathes', 'sunbathing'], agree: ['agrees', 'agreeing'], hug: ['hugs', 'hugging'], relax: ['relaxes', 'relaxing'], obey: ['obeys', 'obeying'],
};
for (const [v, [s, ing]] of Object.entries(TAB)) {
  ocekavej(tvarS(v) === s, `tvar -s: ${v} → ${tvarS(v)} (má být ${s})`);
  ocekavej(tvarIng(v) === ing, `tvar -ing: ${v} → ${tvarIng(v)} (má být ${ing})`);
}

// hosté
const hoste = json.hoste.hoste, ids = new Set();
for (const h of [...hoste, ...json.hoste.tajni]) {
  ocekavej(!ids.has(h.id), `host dvakrát: ${h.id}`); ids.add(h.id);
  ocekavej(['he', 'she', 'it'].includes(h.os), `${h.id}: os musí být he/she/it`);
  ocekavej(h.ikona && h.jmeno && h.kratke && h.popis, `${h.id}: chybí ikona/jméno/popis`);
  for (const z of [...h.zvyky, ...h.ted]) {
    const v = z.f.split(' ')[0];
    ocekavej(!data.lina.has(v), `${h.id}: líné sloveso ve frázi „${z.f}“ (nejde do -ing)`);
    ocekavej(/^[a-z]+$/.test(v), `${h.id}: fráze musí začínat slovesem: „${z.f}“`);
    ocekavej(z.ik, `${h.id}: fráze bez ikony „${z.f}“`);
    ocekavej(!/\b(every|always|usually|now|today)\b/.test(z.f), `${h.id}: signální slovo ve frázi „${z.f}“`);
  }
  if (!json.hoste.tajni.includes(h)) ocekavej(h.zvyky.length >= 4 && h.ted.length >= 4, `${h.id}: aspoň 4 zvyky a 4 činnosti`);
  const k = kartaHosta(data.H[h.id]);
  ocekavej(cisto(k.ted.html) && k.zvyky.every((z) => cisto(z.html)), `${h.id}: kartička`);
}

// věty
for (const [id, sk] of Object.entries(json.vety.skupiny)) {
  ocekavej(sk.vety.length >= 10, `skupina ${id}: málo vět`);
  for (const v of sk.vety) {
    const p = data.vety[id].vety.find((x) => x.v === v.v).p;
    ocekavej(p && p.spatne.length >= 1, `věta bez [správně|špatně]: ${v.v}`);
    ocekavej(v.pozn, `věta bez poznámky: ${v.v}`);
  }
}

// patra
const pouzite = new Set();
for (const t of json.patra.patra) {
  ocekavej(t.lekce.length >= 3 && t.inspektor?.jmeno && t.inspektor.porazen, `${t.id}: lekce a inspektor`);
  for (const h of t.hoste) { ocekavej(data.H[h] && !data.H[h].tajny, `${t.id}: neznámý host ${h}`); ocekavej(!pouzite.has(h), `host ve dvou patrech: ${h}`); pouzite.add(h); }
  for (const sn of t.lekce) {
    if (sn.host) ocekavej(data.H[sn.host], `${t.id}: lekce s neznámým hostem ${sn.host}`);
    if (sn.dirka) ocekavej(data.H[sn.dirka], `${t.id}: lekce s neznámým hostem ${sn.dirka}`);
  }
}
ocekavej(pouzite.size === hoste.length, 'každý host patří do jednoho patra');

// generátory
const zkus = (gen, param, ctx, kde) => {
  for (let i = 0; i < 300; i++) {
    let u;
    try { u = generuj(gen, param, ctx); } catch (e) { ocekavej(false, `${kde}: ${gen} spadl: ${e.message}`); return; }
    uloh++;
    const sp = u.moznosti.filter((m) => m.id === u.spravne);
    ocekavej(sp.length === 1, `${kde}/${gen}: správná možnost ${sp.length}×`);
    ocekavej(u.moznosti.length >= 2 && u.moznosti.length <= 4, `${kde}/${gen}: ${u.moznosti.length} možností`);
    const texty = u.moznosti.map((m) => bez(m.html));
    ocekavej(new Set(texty).size === texty.length, `${kde}/${gen}: stejné možnosti ${texty.join(' / ')}`);
    ocekavej([u.otazka, u.zadani || '', u.scena || '', u.vysvetleni, u.rada, ...texty, ...u.moznosti.map((m) => m.proc || '')].every(cisto), `${kde}/${gen}: undefined v textu ${bez(u.zadani || u.scena || '')}`);
    ocekavej(u.host && data.H[u.host], `${kde}/${gen}: úloha bez hosta`);
    ocekavej(u.klic, `${kde}/${gen}: bez klíče`);
    ocekavej(!/\s{2,}|\s[.?,]/.test(bez(u.hotovo || '').replace(/ – /g, ' ')), `${kde}/${gen}: mezery ve větě „${bez(u.hotovo || '')}“`);
  }
};
const vsichni = json.patra.patra.flatMap((t) => t.hoste);
json.patra.patra.forEach((t, i) => {
  const ctx = { hoste: t.hoste, starsi: json.patra.patra.slice(0, i).flatMap((x) => x.hoste), chybi: vsichni, posl: [] };
  for (const p of t.polozky) zkus(p.gen, p.param, ctx, t.id);
});
const gens = new Set(json.patra.patra.flatMap((t) => t.polozky.map((p) => p.gen)));
for (const g of ['tvar', 'pravopis', 'kniha', 'dirka', 'zapor', 'otazka', 'kratka', 'signal', 'cas', 'cas2', 'oprav', 'vety']) ocekavej(gens.has(g), `generátor ${g} není v žádném patře`);
ocekavej(json.kurz.zaverecna.plan.length >= json.kurz.zaverecna.otazek, 'Velká inspekce: plán je kratší než počet otázek');

console.log(chyb ? `✗ ${chyb} chyb (${uloh} úloh)` : `✓ Hotel Kuriózum v pořádku (${uloh} úloh, ${hoste.length} hostů + ${json.hoste.tajni.length} tajných)`);
process.exit(chyb ? 1 : 0);
