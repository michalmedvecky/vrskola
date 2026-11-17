// Úlohy Slovní zoo: z dat (slova, věty, šatna) vyrábí zadání. Čisté funkce bez DOMu, ať jdou testovat v Node.
// Typy úloh:
//   druh   – komu patří slovo (samotné nebo zvýrazněné ve větě); odpověď = číslo druhu, 0 = košík (zvíře, které v zoo ještě není)
//   najdi  – ve větě označ všechna slova jednoho druhu
//   vlacek – každému slovu věty (vagonu) přiřaď zvíře, postupně zleva
//   volba  – obyčejná volba z možností (číslo druhu, ohebné/neohebné, správný tvar slova)

export const vyber = (a) => a[Math.floor(Math.random() * a.length)];
export function zamichej(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// „Malý/2 pes/1 rychle/6 běží/5.“ → [{ t: 'Malý', d: 2, p: '' }, …, { t: 'běží', d: 5, p: '.' }]
export function rozloz(v) {
  const out = [];
  const re = /(\S+?)\/(\d+)([^\s]*)/g;
  let m;
  while ((m = re.exec(v))) out.push({ t: m[1], d: +m[2], p: m[3] || '' });
  return out;
}

// Připraví data z JSONů do podoby, se kterou pracují generátory.
export function pripravData({ druhy, slova, vety, promeny, vybehy }) {
  const D = {};
  druhy.druhy.forEach((d) => { D[d.cislo] = d; });
  const vyhodit = new Set(slova.nejednoznacna?.slova || []);
  const S = {};
  for (const [k, sez] of Object.entries(slova.slova)) S[k] = [...new Set(sez)].filter((w) => !vyhodit.has(w));
  return {
    D, S, pozn: slova.pozn || {},
    vety: vety.vety.filter((v) => !v.vynechat).map((v) => ({ ...v, tok: rozloz(v.v) })),
    ohebna: promeny.ohebna, neohebna: promeny.neohebna,
    seznamy: vybehy.seznamy || {},
  };
}

const neopakuj = (sez, posl, klic = (x) => x) => { const f = sez.filter((x) => !posl.includes(klic(x))); return f.length ? f : sez; };
export const vsechnyDruhy = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// ctx: { cil: číslo druhu (nebo null), naucene: [čísla druhů], posl: [nedávná slova/věty], souboj: bool }
export function generuj(gen, param, data, ctx) {
  const f = GEN[gen];
  if (!f) throw new Error('Neznámý typ úlohy ' + gen);
  return f(data, ctx, param || {});
}

function moznostiDruhu(ctx) {
  const m = [...ctx.naucene].sort((a, b) => a - b);
  return { moznosti: m, kos: m.length < 10 };
}

const GEN = {
  // Samotné slovo: komu ho dáš?
  krmeni(data, ctx) {
    const { moznosti, kos } = moznostiDruhu(ctx);
    const cil = ctx.cil ?? vyber(moznosti);
    const ostatni = moznosti.filter((d) => d !== cil), nenaucene = vsechnyDruhy.filter((d) => !moznosti.includes(d));
    const r = Math.random();
    let druh;
    if (r < 0.5 || (!ostatni.length && !nenaucene.length)) druh = cil;
    else if (nenaucene.length && (r < 0.68 || !ostatni.length)) druh = vyber(nenaucene);
    else druh = vyber(ostatni);
    const slovo = vyber(neopakuj(data.S[druh], ctx.posl));
    return { typ: 'druh', klic: slovo, slovo, spravne: moznosti.includes(druh) ? druh : 0, skutecny: druh, moznosti, kos, pozn: data.pozn[slovo] || '' };
  },
  // Dvojice podobných slov (rychlý × rychle): jen dvě zvířata.
  dvojice(data, ctx, param) {
    const sez = data.seznamy[param.seznam];
    const [slovo, druh] = vyber(neopakuj(sez, ctx.posl, (x) => x[0]));
    const moznosti = [...new Set(sez.map((x) => x[1]))].sort((a, b) => a - b);
    return { typ: 'druh', klic: slovo, slovo, spravne: druh, skutecny: druh, moznosti, kos: false, pozn: data.pozn[slovo] || '' };
  },
  // Zvýrazněné slovo ve větě: komu patří tady?
  veta(data, ctx) {
    const { moznosti, kos } = moznostiDruhu(ctx);
    const cil = ctx.cil ?? vyber(moznosti);
    const r = Math.random();
    const chciDruh = r < 0.55 ? cil : (kos && r > 0.9 ? 0 : vyber(moznosti.filter((d) => d !== cil).length ? moznosti.filter((d) => d !== cil) : moznosti));
    const sedi = (tok) => (chciDruh === 0 ? !moznosti.includes(tok.d) : tok.d === chciDruh);
    let vety = data.vety.filter((v) => v.tok.some(sedi));
    if (!vety.length) vety = data.vety.filter((v) => v.tok.some((t) => t.d === cil));
    const v = vyber(neopakuj(vety, ctx.posl, (x) => x.v));
    const kandidati = v.tok.map((t, i) => i).filter((i) => sedi(v.tok[i]));
    const idx = kandidati.length ? vyber(kandidati) : v.tok.findIndex((t) => t.d === cil);
    const tok = v.tok[idx];
    return { typ: 'druh', klic: v.v, slovo: tok.t, veta: v.tok, idx, spravne: moznosti.includes(tok.d) ? tok.d : 0, skutecny: tok.d, moznosti, kos, pozn: v.pozn?.[tok.t] || data.pozn[tok.t.toLowerCase()] || '' };
  },
  // Najdi všechna slova druhu cil.
  najdi(data, ctx) {
    const cil = ctx.cil ?? vyber(ctx.naucene);
    const vety = data.vety.filter((v) => v.tok.some((t) => t.d === cil) && v.tok.length >= 3);
    const v = vyber(neopakuj(vety, ctx.posl, (x) => x.v));
    return { typ: 'najdi', klic: v.v, veta: v.tok, cil, spravne: v.tok.map((t, i) => (t.d === cil ? i : -1)).filter((i) => i >= 0), pozn: v.pozn || {} };
  },
  // Vláček: přiřaď zvíře každému slovu (jen druhy, které už zná; ostatní vagony jsou šedé).
  vlacek(data, ctx) {
    const { moznosti } = moznostiDruhu(ctx);
    const hodnot = (v) => {
      const zna = v.tok.filter((t) => moznosti.includes(t.d));
      return { v, zna: zna.length, druhu: new Set(zna.map((t) => t.d)).size, podil: zna.length / v.tok.length };
    };
    let vety = data.vety.map(hodnot).filter((h) => h.zna >= 3 && h.druhu >= 2 && h.v.tok.length <= 9);
    const dobre = vety.filter((h) => h.podil >= 0.6);
    if (dobre.length >= 4) vety = dobre;
    if (ctx.cil && vety.some((h) => h.v.tok.some((t) => t.d === ctx.cil))) vety = vety.filter((h) => h.v.tok.some((t) => t.d === ctx.cil));
    const v = vyber(neopakuj(vety.map((h) => h.v), ctx.posl, (x) => x.v));
    const poradi = v.tok.map((t, i) => (moznosti.includes(t.d) ? i : -1)).filter((i) => i >= 0);
    return { typ: 'vlacek', klic: v.v, veta: v.tok, poradi, moznosti, kos: false, pozn: v.pozn || {} };
  },
  // Číslo slovního druhu.
  cislo(data, ctx) {
    const cil = ctx.cil ?? vyber(ctx.naucene);
    const d = data.D[cil];
    if (Math.random() < 0.5) {
      const cisla = zamichej([cil, ...zamichej(vsechnyDruhy.filter((x) => x !== cil)).slice(0, 3)]);
      return { typ: 'volba', klic: 'cislo' + cil, otazka: `Kolikátý slovní druh jsou <b>${d.nazev}</b>? ${d.ikona}`, moznosti: cisla.map((c) => ({ id: String(c), html: `${c}.` })), spravne: String(cil), vysvetleni: `${d.ikona} ${cap(d.nazev)} jsou slovní druh číslo ${cil}.` };
    }
    const jine = zamichej(vsechnyDruhy.filter((x) => x !== cil)).slice(0, 3);
    return { typ: 'volba', klic: 'cislo' + cil, otazka: `Slovní druh <b>číslo ${cil}</b> jsou…`, moznosti: zamichej([cil, ...jine]).map((c) => ({ id: String(c), html: data.D[c].nazev })), spravne: String(cil), vysvetleni: `Číslo ${cil} jsou ${d.nazev} ${d.ikona}.` };
  },
  // Šatna: dá se slovo převléknout?
  satna(data, ctx) {
    const oh = Math.random() < 0.55;
    const e = vyber(neopakuj(oh ? data.ohebna : data.neohebna, ctx.posl, (x) => x.slovo));
    const d = data.D[e.druh];
    const ukazka = oh
      ? `👕 <b>${esc(e.slovo)}</b> se převléká: ${e.tvary.map((t) => `<span class="tvar">${esc(t)}</span>`).join(' ')} → <b>ohebné</b> (${d.nazev}, ${e.druh}. druh)`
      : `🧥 <b>${esc(e.slovo)}</b> zůstává pořád stejné: ${e.vety.map((v) => `<span class="tvar">${zvyrazniSlovo(v, e.slovo)}</span>`).join(' ')} → <b>neohebné</b> (${d.nazev}, ${e.druh}. druh)`;
    return { typ: 'volba', klic: e.slovo, otazka: `Dá se slovo <b class="slovo-velke">${esc(e.slovo)}</b> převléknout (změnit jeho tvar)?`, moznosti: [{ id: 'ohebne', html: '👕 Ano – je ohebné' }, { id: 'neohebne', html: '🧥 Ne – je neohebné' }], spravne: oh ? 'ohebne' : 'neohebne', ukazka, vysvetleni: ukazka };
  },
  // Převlékni slovo do správného tvaru.
  zkus(data, ctx) {
    const e = vyber(neopakuj(data.ohebna, ctx.posl, (x) => x.slovo));
    const [veta, spravne] = vyber(e.zkus);
    const sp = spravne.toLowerCase();
    const spatne = zamichej([...new Set(e.tvary.map((t) => t.toLowerCase()))].filter((t) => t !== sp)).slice(0, 2);
    const moznosti = zamichej([sp, ...spatne]).map((t) => ({ id: t, html: t }));
    const doplnena = veta.replace('___', `<u>${esc(spravne)}</u>`);
    return { typ: 'volba', klic: e.slovo + veta, otazka: `Převlékni slovo <b>${esc(e.slovo)}</b>, aby pasovalo do věty:<div class="ramec">${esc(veta).replace('___', '<span class="mezera">?</span>')}</div>`, moznosti, spravne: sp, ukazka: `${doplnena} – slovo <b>${esc(e.slovo)}</b> se převléklo na <b>${esc(spravne)}</b>. Proto je ohebné (${data.D[e.druh].nazev}).`, vysvetleni: `Správně: ${doplnena}` };
  },
  // Je slovní druh ohebný?
  skupina(data, ctx) {
    const c = vyber(neopakuj(vsechnyDruhy, ctx.posl.map(Number)));
    const d = data.D[c];
    return { typ: 'volba', klic: String(c), otazka: `${d.ikona} <b>${cap(d.nazev)}</b> (${c}. druh) – jsou ohebné, nebo neohebné?`, moznosti: [{ id: 'ohebne', html: '👕 Ohebné' }, { id: 'neohebne', html: '🧥 Neohebné' }], spravne: d.ohebny ? 'ohebne' : 'neohebne', vysvetleni: `Ohebné jsou druhy 1–5, neohebné 6–10. ${cap(d.nazev)} jsou ${c}. druh, takže jsou ${d.ohebny ? 'ohebné' : 'neohebné'}.` };
  },
};

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function zvyrazniSlovo(veta, slovo) {
  return esc(veta).replace(new RegExp(`(^|[^\\p{L}])(${slovo})(?=[^\\p{L}]|$)`, 'iu'), '$1<b>$2</b>');
}

// Proč slovo patří jinam: co se ptá zvolené zvíře a co správné. Vrací HTML.
export function vysvetli(data, { slovo, spravne, skutecny, zvoleny, pozn }) {
  const D = data.D, s = `<b>${esc(slovo)}</b>`;
  const casti = [];
  if (zvoleny > 0) {
    const z = D[zvoleny];
    casti.push(`${z.ikona} ${z.zvire} se ptá: „${z.otazka}“ – na slovo ${s} to nesedí.`);
  } else if (zvoleny === 0 && spravne > 0) {
    casti.push(`Slovo ${s} do košíku nepatří – jeho zvíře už v zoo máš!`);
  }
  const k = D[skutecny];
  if (spravne === 0) {
    casti.push(`Slovo ${s} patří zvířeti, které v zoo ještě nemáme: ${k.ikona} ${k.zvire} (${k.nazev}). Zatím ho dej do košíku 🧺.`);
  } else {
    casti.push(`${k.ikona} ${k.zvire}: ${k.vysvetli.replace(/\{slovo\}/g, s)} Proto je to <b>${k.jedn}</b>.`);
  }
  if (pozn) casti.push(`💡 ${pozn}`);
  return casti.join(' ');
}
