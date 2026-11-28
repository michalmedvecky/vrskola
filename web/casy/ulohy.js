// Hotel Kuriózum: anglické tvary sloves a generátory úloh. Všechny úlohy jsou volby (2–4 možnosti).
// Úloha: { typ: 'volba', klic, otazka, zadani, scena, moznosti: [{ id, html, proc }], spravne, vysvetleni, rada, host }
//   proc = proč je tahle (špatná) možnost špatně – ukáže se po první chybě, aniž by prozradila správnou odpověď,
//   vysvetleni = proč je správná odpověď správná (po vyřešení / po druhé chybě), rada = nápověda (mizí s úspěchy).

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const vyber = (a) => a[Math.floor(Math.random() * a.length)];
export function zamichej(a) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
const bezTagu = (s) => s.replace(/<[^>]+>/g, '');
const unik = (a) => [...new Set(a)];

let D = null;
export function pripravData({ jazyk, hoste, vety }) {
  const H = {};
  hoste.hoste.forEach((h) => { H[h.id] = h; });
  hoste.tajni.forEach((h) => { H[h.id] = { ...h, tajny: true }; });
  D = { J: jazyk, H, hoste: hoste.hoste, tajni: hoste.tajni, vety: vety.skupiny, zdvoj: new Set(jazyk.zdvoj), lina: new Set(jazyk.lina) };
  for (const sk of Object.values(D.vety)) sk.vety.forEach((v) => { v.p = rozeberVetu(v.v); });
  return D;
}

// ---------- tvary sloves ----------
export function tvarS(v) {
  if (D.J.vyjimky[v]) return D.J.vyjimky[v].s;
  if (/(s|x|z|ch|sh|o)$/.test(v)) return v + 'es';
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ies';
  return v + 's';
}
export function tvarIng(v) {
  if (D.J.vyjimky[v]) return D.J.vyjimky[v].ing;
  if (/ie$/.test(v)) return v.slice(0, -2) + 'ying';
  if (/(ee|ye|oe)$/.test(v)) return v + 'ing';
  if (/e$/.test(v)) return v.slice(0, -1) + 'ing';
  if (D.zdvoj.has(v)) return v + v.at(-1) + 'ing';
  return v + 'ing';
}
export function tridaS(v) {
  if (v === 'have') return 'has';
  if (/(s|x|z|ch|sh|o)$/.test(v)) return 'es';
  if (/[^aeiou]y$/.test(v)) return 'ies';
  if (/[aeiou]y$/.test(v)) return 'ys';
  return 'plain';
}
export function tridaIng(v) {
  if (/ie$/.test(v)) return 'ie';
  if (/(ee|ye|oe)$/.test(v)) return 'ee';
  if (/e$/.test(v)) return 'e';
  if (D.zdvoj.has(v)) return 'dvoj';
  return 'plain';
}
const PRAVIDLO_S = {
  has: 'have je nepravidelné: **he has**.',
  es: 'Sloveso končí na -s, -x, -z, -ch, -sh nebo -o → přidáme **-es**.',
  ies: 'Souhláska + y → y se mění na **-ies**.',
  ys: 'Samohláska + y → stačí **-s** (play → plays).',
  plain: 'Stačí přidat **-s**.',
};
const PRAVIDLO_ING = {
  ie: '-ie se mění na **-ying** (lie → lying).',
  ee: 'Dvojité -ee zůstává, jen přidáme -ing (see → seeing).',
  e: 'Tiché **-e** na konci odpadne (make → making).',
  dvoj: 'Krátká samohláska + jedna souhláska na konci → souhlásku **zdvojíme** (swim → swimming).',
  plain: 'Stačí přidat **-ing**.',
};

// ---------- osoby ----------
const TRETI = new Set(['he', 'she', 'it']);
const t3 = (os) => TRETI.has(os);
const BE = { I: 'am', he: 'is', she: 'is', it: 'is' };
const be = (os) => BE[os] || 'are';
const NEG_BE = { am: 'am not', is: "isn't", are: "aren't" };
const POS = { I: 'my', you: 'your', we: 'our', they: 'their', he: 'his', she: 'her', it: 'its' };
const ODPOVED_OS = { I: 'you', you: 'I', we: 'we', they: 'they', he: 'he', she: 'she', it: 'it' };
export const zajmeno = (os) => os;

function fraze(f, os) {
  const [v, ...r] = f.split(' ');
  return { v, zb: r.join(' ').replace(/\{pos\}/g, POS[os]) };
}
const pHost = (h) => ({ t: h.kratke, os: h.os, host: h.id });

// ---------- skládání vět ----------
const sigHtml = (sig) => `<span class="signal sig-${sig.cas}" data-cs="${esc(sig.cs)}">${esc(sig.t)}</span>`;
// Rozloží větu na část před slovesnou skupinou, slovesnou skupinu a část za ní.
// typ: pos (oznamovací), neg (zápor), q (otázka – slovesná skupina je jen pomocné sloveso na začátku)
function skladej({ pod, f, cas, typ = 'pos', sig = null }) {
  const { v, zb } = fraze(f, pod.os);
  const F = { v, s: tvarS(v), ing: tvarIng(v) };
  const lead = sig?.kde === 'zacatek' ? sigHtml(sig) + ' ' : '';
  const konec = sig?.kde === 'konec' ? ' ' + sigHtml(sig) : '';
  const adv = sig?.kde === 'pred' ? sigHtml(sig) + ' ' : '';
  const zbs = zb ? ' ' + zb : '';
  const S = pod.t;
  if (typ === 'q') {
    const aux = cas === 's' ? (t3(pod.os) ? 'does' : 'do') : be(pod.os);
    return { F, pred: lead, sl: cap(aux), za: ` ${S} ${adv}${cas === 's' ? v : F.ing}${zbs}${konec}?`, zb, lead, konec, adv };
  }
  let sl;
  if (typ === 'neg') sl = cas === 's' ? `${t3(pod.os) ? "doesn't" : "don't"} ${v}` : `${NEG_BE[be(pod.os)]} ${F.ing}`;
  else sl = cas === 's' ? (t3(pod.os) ? F.s : v) : `${be(pod.os)} ${F.ing}`;
  return { F, pred: `${lead}${cap(S)} ${typ === 'pos' ? adv : ''}`, sl, za: `${zbs}${konec}.`, zb, lead, konec, adv };
}
const mezera = (napoveda) => `<span class="mezera">&nbsp;?&nbsp;</span>${napoveda ? ` <span class="sl-napoveda">(${esc(napoveda)})</span>` : ''}`;
const veta = (p, sl) => `${p.pred}<b class="tvar">${esc(sl)}</b>${p.za}`;

// ---------- výběr podmětu, hosta, fráze, signálního slova ----------
function hostZKontextu(ctx) {
  const ted = ctx.hoste?.length ? ctx.hoste : D.hoste.slice(0, 4).map((h) => h.id);
  const st = ctx.starsi || [], chybi = ctx.chybi || [];
  // Přednost mají hosté, kteří ještě nedali kartičku (ať se album plní).
  const tedChybi = ted.filter((id) => chybi.includes(id)), stChybi = st.filter((id) => chybi.includes(id));
  if (st.length && Math.random() < 0.25) return D.H[vyber(stChybi.length && Math.random() < 0.7 ? stChybi : st)];
  return D.H[vyber(tedChybi.length && Math.random() < 0.7 ? tedChybi : ted)];
}
// Podmět: většinou host (he/she), někdy I/you/we/they nebo dvojice hostů.
function podmet(ctx, h, podilMnozne = 0.4) {
  if (Math.random() >= podilMnozne) return pHost(h);
  if (Math.random() < 0.3) {
    const druhy = vyber(D.hoste.filter((x) => x.id !== h.id && (ctx.hoste || []).concat(ctx.starsi || []).includes(x.id))) || vyber(D.hoste.filter((x) => x.id !== h.id));
    return { t: `${h.kratke} and ${druhy.kratke}`, os: 'they', host: h.id };
  }
  const m = vyber(D.J.mnozne);
  return { t: m.t, os: m.os, host: h.id };
}
const frazeHosta = (h, cas) => vyber(cas === 's' ? h.zvyky : h.ted).f;
function signal(cas, { jenKonec = false, bezZaporu = false } = {}) {
  let sez = D.J.signaly[cas].filter((s) => (!jenKonec || s.kde !== 'pred') && (!bezZaporu || !s.bezZaporu));
  return { ...vyber(sez), cas };
}
const nahodnyCas = () => (Math.random() < 0.5 ? 's' : 'c');
const casNazev = (c) => `${D.J.casy[c].ikona} ${D.J.casy[c].nazev}`;
const proSignal = (sig) => `„${sig.t}“ = ${sig.cs} → ${sig.cas === 's' ? '**zvyk** → present simple' : '**děje se to teď** → present continuous'}.`;

function moznosti(spravna, spatne, max = 4) {
  const seen = new Set([bezTagu(spravna.html)]);
  const sp = [];
  for (const x of zamichej(spatne)) { const k = bezTagu(x.html); if (!seen.has(k)) { seen.add(k); sp.push(x); } }
  const vse = zamichej([{ ...spravna, ok: true }, ...sp.slice(0, max - 1)]).map((m, i) => ({ ...m, id: 'm' + i }));
  return { moznosti: vse, spravne: vse.find((m) => m.ok).id };
}
// Text s **tučně** a __zvýrazněním__ (pro vysvětlení a lekce).
export const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*]+?)\*/g, '$1<i>$2</i>').replace(/__(.+?)__/g, '<u>$1</u>').replace(/~~(.+?)~~/g, '<s>$1</s>');

// Vysvětlení správného tvaru v kladné větě.
function proc3(pod, F, cas, sig) {
  const kdo = `**${pod.t}**`;
  const uvod = sig ? proSignal(sig) + ' ' : '';
  if (cas === 's') return uvod + (t3(pod.os) ? `${kdo} = ${pod.os} → přidáme -s: **${F.s}**.` : `${kdo} není he/she/it → sloveso zůstane bez -s: **${F.v}**.`);
  return uvod + `Present continuous = am/is/are + -ing. ${kdo} → **${be(pod.os)} ${F.ing}**.`;
}

// ---------- generátory ----------
const G = {};

// Tvar slovesa do mezery (cas s / c / mix).
G.tvar = (param, ctx) => {
  const cas = param.cas === 'mix' ? nahodnyCas() : param.cas;
  const h = hostZKontextu(ctx), pod = podmet(ctx, h), f = frazeHosta(h, cas);
  const sig = param.cas === 'mix' || Math.random() < 0.6 ? signal(cas) : null;
  const p = skladej({ pod, f, cas, sig }), F = p.F, b = be(pod.os);
  const spatne = [];
  if (cas === 's') {
    spatne.push(t3(pod.os) ? { html: F.v, proc: `**${pod.t}** = ${pod.os} – nezapomněl jsi na něco na konci slovesa?` } : { html: F.s, proc: `**${pod.t}** není he/she/it. Patří sem -s?` });
    if (param.cas === 'mix') spatne.push({ html: `${b} ${F.ing}`, proc: proSignal(sig) });
  } else {
    ['am', 'is', 'are'].filter((x) => x !== b).forEach((x) => spatne.push({ html: `${x} ${F.ing}`, proc: `K podmětu **${pod.t}** se nehodí **${x}**. I → am, he/she/it → is, you/we/they → are.` }));
    spatne.push({ html: F.ing, proc: 'Present continuous má dvě části. Jedna tu chybí!' });
    if (param.cas === 'mix') spatne.push({ html: t3(pod.os) ? F.s : F.v, proc: proSignal(sig) });
  }
  const m = moznosti({ html: p.sl }, param.cas === 'c' ? zamichej(spatne).slice(0, 2) : spatne);
  return {
    typ: 'volba', klic: `tvar:${pod.t}:${f}`, host: h.id,
    otazka: 'Doplň správný tvar slovesa.',
    zadani: `${p.pred}${mezera(F.v)}${p.za}`, hotovo: veta(p, p.sl),
    ...m, vysvetleni: proc3(pod, F, cas, sig),
    rada: param.cas === 'mix' ? '📖 zvyk → present simple · 🔑 teď → present continuous' : cas === 's' ? '📖 he / she / it → sloveso + **-s**' : '🔑 I **am** · he/she/it **is** · you/we/they **are** + **-ing**',
  };
};

// Pravopis -s / -ing.
G.pravopis = (param, ctx) => {
  const cas = param.cas;
  const v = vyber(cas === 's' ? D.J.pravopisS : D.J.pravopisC);
  const h = hostZKontextu(ctx);
  const spravne = cas === 's' ? tvarS(v) : tvarIng(v);
  let kand;
  if (cas === 's') kand = [v + 's', v + 'es', v.replace(/y$/, 'ies'), v.replace(/y$/, 'ys'), v === 'have' ? 'haves' : null, v.replace(/e$/, 'es')];
  else kand = [v + 'ing', v.replace(/e$/, '') + 'ing', /[^aeiouywx]$/.test(v) ? v + v.at(-1) + 'ing' : null, v.replace(/ie$/, 'ying'), v.replace(/ie$/, 'iing'), v.replace(/ee$/, 'e') + 'ing', /y$/.test(v) ? v.slice(0, -1) + 'ing' : null, /y$/.test(v) ? v.slice(0, -1) + 'iing' : null];
  const spatne = unik(kand.filter((x) => x && x !== spravne && x !== v)).map((x) => ({ html: x, proc: 'Takhle se to nepíše. Podívej se, jak sloveso končí.' }));
  const m = moznosti({ html: spravne }, spatne, 3);
  const tr = cas === 's' ? PRAVIDLO_S[tridaS(v)] : PRAVIDLO_ING[tridaIng(v)];
  const pod = cas === 's' ? `${h.kratke} ` : `${h.kratke} ${be(h.os)} `;
  return {
    typ: 'volba', klic: `prav:${cas}:${v}`, host: h.id,
    otazka: cas === 's' ? `Jak se píše tvar pro he/she/it od slovesa <b>${v}</b>?` : `Jak se píše <b>${v}</b> + -ing?`,
    zadani: `${esc(pod)}${mezera(v)} …`,
    ...m, vysvetleni: `${tr} ${v} → **${spravne}**.`,
    rada: cas === 's' ? '-s, -x, -z, -ch, -sh, -o → **-es** · souhláska + y → **-ies** · have → **has**' : 'tiché -e pryč · krátké swim → swi**mm**ing · lie → l**y**ing',
  };
};

// Kniha hostů: přepiš zvyk do věty (present simple).
G.kniha = (param, ctx) => {
  const h = hostZKontextu(ctx), z = vyber(h.zvyky), pod = pHost(h);
  const sig = signal('s');
  const p = skladej({ pod, f: z.f, cas: 's', sig }), F = p.F;
  const vety = (sl) => bezTagu(p.pred) + sl + bezTagu(p.za);
  const m = moznosti({ html: esc(vety(F.s)) }, [
    { html: esc(vety(F.v)), proc: `${h.kratke} je ${h.os}. Na co se u he/she/it nesmí zapomenout?` },
    { html: esc(vety(`is ${F.ing}`)), proc: 'Kniha hostů zapisuje **zvyky**, ne to, co se děje právě teď.' },
    { html: esc(vety(`is ${F.v}`)), proc: 'V present simple žádné is před slovesem není.' },
  ], 3);
  return {
    typ: 'volba', klic: `kniha:${h.id}:${z.f}`, host: h.id,
    otazka: 'Přepiš zápis z Knihy hostů do věty.',
    scena: `<div class="kniha-zapis"><div class="kniha-hlava">📖 Guest book · room ${h.pokoj}</div><div class="kniha-radek"><span class="kniha-ik">${h.ikona}</span><b>${esc(h.jmeno)}</b></div><div class="kniha-radek"><span class="kniha-ik">${z.ik}</span><i>${esc(fraze(z.f, h.os).v + (fraze(z.f, h.os).zb ? ' ' + fraze(z.f, h.os).zb : ''))}</i> — ${sigHtml(sig)}</div></div>`,
    zadani: '',
    ...m, vysvetleni: `Kniha hostů = zvyky → present simple. ${h.kratke} = ${h.os} → **${F.s}**.`,
    rada: '📖 Kniha hostů = zvyk → present simple, he/she/it + **-s**',
  };
};

// Klíčová dírka: co host dělá právě teď (present continuous).
G.dirka = (param, ctx) => {
  const h = hostZKontextu(ctx), a = vyber(h.ted);
  const { v, zb } = fraze(a.f, h.os), ing = tvarIng(v), zbs = zb ? ' ' + zb : '';
  const Z = cap(h.os), b = be(h.os);
  const m = moznosti({ html: `${Z} ${b} ${ing}${zbs}.` }, zamichej([
    { html: `${Z} ${tvarS(v)}${zbs}.`, proc: 'Tohle by byl **zvyk** z Knihy hostů. Dírkou ale vidíš, co dělá **právě teď**.' },
    { html: `${Z} ${ing}${zbs}.`, proc: 'Present continuous má dvě části. Jedna tu chybí.' },
    { html: `${Z} are ${ing}${zbs}.`, proc: `${h.kratke} je ${h.os}. Je to správný tvar slovesa be?` },
    { html: `${Z} ${b} ${v}${zbs}.`, proc: 'Po am/is/are musí sloveso dostat koncovku.' },
  ]).slice(0, 2), 3);
  return {
    typ: 'volba', klic: `dirka:${h.id}:${a.f}`, host: h.id,
    otazka: `Nakoukni klíčovou dírkou. <b>What is ${esc(h.kratke)} doing?</b>`,
    scena: `<div class="dirka-obal"><div class="dvere"><span class="cislo-dveri">${h.pokoj}</span></div><div class="dirka"><span class="dirka-host">${h.ikona}</span><span class="dirka-akce">${a.ik}</span></div><div class="dirka-popis">${esc(v)}${esc(zbs)}</div></div>`,
    zadani: '',
    ...m, vysvetleni: `Dírkou vidíš, co se děje teď → present continuous: ${h.os} **${b} ${ing}**.`,
    rada: '🔑 právě teď → **is** + -ing',
  };
};

// Zápor (cas s / c / mix).
G.zapor = (param, ctx) => {
  const cas = param.cas === 'mix' ? nahodnyCas() : param.cas;
  const h = hostZKontextu(ctx), pod = podmet(ctx, h), f = frazeHosta(h, cas);
  const sig = param.cas === 'mix' || Math.random() < 0.5 ? signal(cas, { jenKonec: true, bezZaporu: true }) : null;
  const p = skladej({ pod, f, cas, typ: 'neg', sig }), F = p.F, T = t3(pod.os), b = be(pod.os);
  const spatne = [];
  if (cas === 's') {
    spatne.push({ html: `${T ? "don't" : "doesn't"} ${F.v}`, proc: T ? `**${pod.t}** = ${pod.os}. Hodí se sem don't?` : `**${pod.t}** není he/she/it. Hodí se sem doesn't?` });
    if (T) spatne.push({ html: `doesn't ${F.s}`, proc: 'Po doesn\'t už sloveso -s nemá – esíčko si vzalo does.' });
    spatne.push({ html: `${NEG_BE[b]} ${F.v}`, proc: 'Zápor v present simple se nedělá pomocí am/is/are.' });
    if (param.cas === 'mix') spatne.push({ html: `${NEG_BE[b]} ${F.ing}`, proc: proSignal(sig) });
  } else {
    ['am not', "isn't", "aren't"].filter((x) => x !== NEG_BE[b]).forEach((x) => spatne.push({ html: `${x} ${F.ing}`, proc: `K podmětu **${pod.t}** se tohle nehodí. I → am not, he/she/it → isn't, you/we/they → aren't.` }));
    spatne.push({ html: `${T ? "doesn't" : "don't"} ${F.ing}`, proc: 'Do/does k -ing nepatří. Present continuous si zápor udělá s am/is/are.' });
    if (param.cas === 'mix') spatne.push({ html: `${T ? "doesn't" : "don't"} ${F.v}`, proc: proSignal(sig) });
  }
  const m = moznosti({ html: p.sl }, spatne, param.cas === 'mix' ? 4 : 3);
  return {
    typ: 'volba', klic: `zapor:${pod.t}:${f}`, host: h.id,
    otazka: 'Doplň zápor.', zadani: `${p.pred}${mezera(`not / ${F.v}`)}${p.za}`, hotovo: veta(p, p.sl),
    ...m,
    vysvetleni: (sig && param.cas === 'mix' ? proSignal(sig) + ' ' : '') + (cas === 's'
      ? `Zápor v present simple: **don't / doesn't** + sloveso bez -s. ${pod.t} → **${p.sl}**.`
      : `Zápor v present continuous: **am not / isn't / aren't** + -ing. ${pod.t} → **${p.sl}**.`),
    rada: param.cas === 'mix' ? '📖 don\'t / doesn\'t + sloveso · 🔑 am not / isn\'t / aren\'t + -ing' : cas === 's' ? '📖 I/you/we/they **don\'t** · he/she/it **doesn\'t** + sloveso bez -s' : '🔑 I **am not** · he/she/it **isn\'t** · you/we/they **aren\'t** + -ing',
  };
};

// Otázka: pomocné sloveso na začátek.
G.otazka = (param, ctx) => {
  const cas = param.cas === 'mix' ? nahodnyCas() : param.cas;
  const h = hostZKontextu(ctx), pod = podmet(ctx, h, 0.35), f = frazeHosta(h, cas);
  const sig = param.cas === 'mix' || Math.random() < 0.5 ? signal(cas, { jenKonec: true, bezZaporu: true }) : null;
  const p = skladej({ pod, f, cas, typ: 'q', sig });
  const vse = param.cas === 'mix' ? ['Do', 'Does', 'Is', 'Are', 'Am'] : cas === 's' ? ['Do', 'Does', 'Is'] : ['Am', 'Is', 'Are', 'Does'];
  const spatne = vse.filter((x) => x !== p.sl).map((x) => ({
    html: x,
    proc: ['Do', 'Does'].includes(x) && cas === 'c' ? 'Ve větě je sloveso s -ing. Patří k němu do/does?'
      : ['Am', 'Is', 'Are'].includes(x) && cas === 's' ? 'Sloveso ve větě nemá -ing. Hodí se k němu am/is/are?'
        : `K podmětu **${pod.t}** se ${x.toLowerCase()} nehodí.`,
  }));
  const m = moznosti({ html: p.sl }, spatne, param.cas === 'mix' ? 4 : 3);
  return {
    typ: 'volba', klic: `otazka:${pod.t}:${f}`, host: h.id,
    otazka: 'Čím začne otázka?', zadani: `${p.pred}${mezera('')}${p.za}`, hotovo: `${p.pred}<b class="tvar">${p.sl}</b>${p.za}`,
    ...m,
    vysvetleni: cas === 's'
      ? `Sloveso nemá -ing → present simple → otázka s **do / does**. ${pod.t} → **${p.sl}**.`
      : `Sloveso má -ing → present continuous → am/is/are před podmět. ${pod.t} → **${p.sl}**.`,
    rada: '📖 **Do / Does** + sloveso · 🔑 **Am / Is / Are** + -ing',
  };
};

// Krátké odpovědi: Yes, he does. / No, she isn't.
G.kratka = (param, ctx) => {
  const cas = nahodnyCas(), ano = Math.random() < 0.5;
  const h = hostZKontextu(ctx);
  const pod = Math.random() < 0.25 ? { t: 'you', os: 'you', host: h.id } : podmet(ctx, h, 0.25);
  const f = frazeHosta(h, cas);
  const p = skladej({ pod, f, cas, typ: 'q' });
  const odpOs = ODPOVED_OS[pod.os] || pod.os;
  const pom = cas === 's' ? (t3(odpOs) ? 'does' : 'do') : be(odpOs);
  const spravne = ano ? pom : cas === 's' ? `${pom === 'does' ? "doesn't" : "don't"}` : NEG_BE[pom];
  const kand = cas === 's'
    ? (ano ? ['do', 'does', 'is', 'are'] : ["don't", "doesn't", "isn't", "aren't"])
    : (ano ? ['am', 'is', 'are', 'does'] : ['am not', "isn't", "aren't", "doesn't"]);
  const spatne = kand.filter((x) => x !== spravne).map((x) => ({ html: x, proc: `Otázka začíná slovem **${p.sl}**. Krátká odpověď používá to samé pomocné sloveso – ve správném tvaru.` }));
  const m = moznosti({ html: spravne }, spatne, 3);
  const zac = `${ano ? 'Yes' : 'No'}, ${odpOs}`;
  return {
    typ: 'volba', klic: `kratka:${pod.t}:${f}:${ano}`, host: h.id,
    otazka: 'Doplň krátkou odpověď.',
    zadani: `${p.sl}${p.za}<br>– ${esc(zac)} ${mezera('')}.`, hotovo: `${p.sl}${p.za}<br>– ${esc(zac)} <b class="tvar">${spravne}</b>.`,
    ...m, vysvetleni: `Ptali se **${p.sl}**, tak odpovídáš taky ${cas === 's' ? 'do/does' : 'am/is/are'}: **${zac} ${spravne}.**`,
    rada: 'Odpovídej **tím slovem, kterým se ptali**: Does…? → does · Is…? → is',
  };
};

// Signální slovo → čas.
G.signal = (param, ctx) => {
  const cas = nahodnyCas(), sig = signal(cas), h = hostZKontextu(ctx);
  const m = moznosti({ html: casNazev(cas) + ` <small>(${D.J.casy[cas].kdy})</small>` }, [{ html: casNazev(cas === 's' ? 'c' : 's') + ` <small>(${D.J.casy[cas === 's' ? 'c' : 's'].kdy})</small>`, proc: `„${sig.t}“ – co to znamená česky?` }]);
  return {
    typ: 'volba', klic: `signal:${sig.t}`, host: h.id,
    otazka: 'Který čas ti napoví tohle signální slovo?',
    zadani: `<div class="signal-velke"><span class="signal sig-${cas}">${esc(sig.t)}</span></div>`,
    ...m, vysvetleni: proSignal(sig),
    rada: '📖 pravidelně, vždycky · 🔑 teď, dočasně, Look!, Listen!',
  };
};

// Kniha, nebo dírka? Čas podle signálního slova.
G.cas = (param, ctx) => {
  const cas = nahodnyCas();
  const h = hostZKontextu(ctx), pod = podmet(ctx, h, param.osoby === 'vse' ? 0.45 : 0.25), f = frazeHosta(h, Math.random() < 0.7 ? cas : (cas === 's' ? 'c' : 's'));
  const sig = signal(cas);
  const p = skladej({ pod, f, cas, sig }), F = p.F, T = t3(pod.os), b = be(pod.os);
  const s = T ? F.s : F.v, c = `${b} ${F.ing}`;
  const spatne = cas === 's'
    ? [{ html: c, proc: `Najdi signální slovo. Je to zvyk, nebo teď?` }, { html: T ? F.v : F.s, proc: T ? `${pod.t} = ${pod.os}. Nezapomněl jsi na -s?` : `${pod.t} není he/she/it – bez -s.` }]
    : [{ html: s, proc: 'Najdi signální slovo. Je to zvyk, nebo teď?' }, { html: F.ing, proc: 'Present continuous má dvě části: am/is/are + -ing.' }];
  const m = moznosti({ html: cas === 's' ? s : c }, spatne, 3);
  return {
    typ: 'volba', klic: `cas:${pod.t}:${f}:${sig.t}`, host: h.id,
    otazka: 'Kniha 📖, nebo dírka 🔑? Doplň sloveso ve správném čase.',
    zadani: `${p.pred}${mezera(F.v)}${p.za}`, hotovo: veta(p, cas === 's' ? s : c),
    ...m, vysvetleni: proc3(pod, F, cas, sig),
    rada: 'Najdi **signální slovo**: 📖 zvyk → simple · 🔑 teď → continuous',
  };
};

// Obvykle…, ale dnes… (dva časy v jedné větě).
G.cas2 = (param, ctx) => {
  const h = hostZKontextu(ctx), z = vyber(h.zvyky), a = vyber(h.ted);
  const A = fraze(z.f, h.os), B = fraze(a.f, h.os);
  const s = tvarS(A.v), c = `${be(h.os)} ${tvarIng(B.v)}`, sWrong = `${be(h.os)} ${tvarIng(A.v)}`, cWrong = tvarS(B.v);
  const zA = A.zb ? ' ' + A.zb : '', zB = B.zb ? ' ' + B.zb : '';
  const sg = (t, cas) => sigHtml({ t, cas, cs: '' });
  const sablony = [
    { html: `${esc(h.kratke)} ${sg('usually', 's')} ${mezera(A.v)}${zA}, but ${sg('today', 'c')} ${h.os} ${mezera(B.v)}${zB}.`, poradi: 'sc' },
    { html: `${sg('Right now', 'c')} ${esc(h.kratke)} ${mezera(B.v)}${zB}, but ${h.os} ${sg('usually', 's')} ${mezera(A.v)}${zA}.`, poradi: 'cs' },
    { html: `${esc(h.kratke)} ${mezera(A.v)}${zA} ${sg('every day', 's')}, but ${sg('this week', 'c')} ${h.os} ${mezera(B.v)}${zB}.`, poradi: 'sc' },
  ];
  const sab = vyber(sablony);
  const par = (x, y) => (sab.poradi === 'sc' ? `${x} … ${y}` : `${y} … ${x}`);
  const m = moznosti({ html: par(s, c) }, [
    { html: par(sWrong, cWrong), proc: 'Časy jsou prohozené. Co se děje obvykle a co dnes / teď?' },
    { html: par(s, cWrong), proc: 'První půlka sedí. Co ta druhá – děje se to obvykle, nebo teď?' },
    { html: par(sWrong, c), proc: 'Jedna půlka sedí. Podívej se na signální slova u každé mezery.' },
  ]);
  return {
    typ: 'volba', klic: `cas2:${h.id}:${z.f}:${a.f}`, host: h.id,
    otazka: 'Doplň obě slovesa. Co dělá obvykle a co teď?',
    zadani: sab.html,
    ...m, vysvetleni: `usually / every day → zvyk → **${s}**; today / right now / this week → teď → **${c}**.`,
    rada: '📖 usually, every day → simple · 🔑 today, right now, this week → continuous',
  };
};

// Opravář vět: Inspektor napsal větu s chybou, vyber správnou opravu.
G.oprav = (param, ctx) => {
  const cas = nahodnyCas();
  const h = hostZKontextu(ctx), pod = podmet(ctx, h, 0.35), f = frazeHosta(h, cas);
  const sig = signal(cas);
  const p = skladej({ pod, f, cas, sig }), F = p.F, T = t3(pod.os), b = be(pod.os);
  const cela = (sl) => bezTagu(p.pred) + sl + bezTagu(p.za);
  const ok = cas === 's' ? (T ? F.s : F.v) : `${b} ${F.ing}`;
  const chyby = cas === 's'
    ? [T ? F.v : F.s, `${b} ${F.ing}`, `${b} ${F.v}`]
    : [F.ing, `${['am', 'is', 'are'].find((x) => x !== b)} ${F.ing}`, `${b} ${F.v}`, T ? F.s : F.v];
  const [ukaz, ...dalsi] = zamichej(unik(chyby));
  const m = moznosti({ html: esc(cela(ok)) }, dalsi.map((x) => ({ html: esc(cela(x)), proc: 'I v téhle opravě je chyba. Zkontroluj čas i tvar slovesa.' })), 3);
  return {
    typ: 'volba', klic: `oprav:${pod.t}:${f}`, host: h.id,
    otazka: 'Inspektor napsal do knihy větu s chybou. Která oprava je správná?',
    zadani: `<div class="chybna-veta">✏️ ${p.lead}${esc(cap(pod.t))} ${cas === 's' ? p.adv : ''}<s>${esc(ukaz)}</s>${p.za}</div>`,
    ...m, vysvetleni: proc3(pod, F, cas, sig),
    rada: 'Zkontroluj **čas** (signální slovo) i **tvar** (-s, am/is/are, -ing)',
  };
};

// Ručně psané věty po skupinách (vety.json).
function rozeberVetu(s) {
  const m = s.match(/^(.*?)\[([^\]]+)\](.*)$/);
  if (!m) return null;
  const moz = m[2].split('|');
  return { pred: m[1], za: m[3], spravne: moz[0], spatne: moz.slice(1) };
}
G.vety = (param, ctx) => {
  const sk = D.vety[param.skupina];
  const pos = ctx.posl || [];
  const kand = sk.vety.filter((v) => !pos.includes(`vety:${v.v}`));
  const v = vyber(kand.length ? kand : sk.vety), p = v.p;
  const jmenovany = D.hoste.find((h) => v.v.includes(h.kratke));
  const h = jmenovany && (ctx.hoste || []).concat(ctx.starsi || []).includes(jmenovany.id) ? jmenovany : hostZKontextu(ctx);
  const m = moznosti({ html: esc(p.spravne) }, p.spatne.map((x) => ({ html: esc(x), proc: `Tohle ne. ${sk.rada.replace(/\*\*/g, '')}` })));
  return {
    typ: 'volba', klic: `vety:${v.v}`, host: h.id,
    otazka: sk.nazev === 'Bez signálních slov' ? 'Doplň sloveso. Děje se to teď, nebo pořád?' : 'Doplň správný tvar.',
    zadani: `${esc(p.pred)}${mezera('')}${esc(p.za)}`, hotovo: `${esc(p.pred)}<b class="tvar">${esc(p.spravne)}</b>${esc(p.za)}`,
    ...m, vysvetleni: v.pozn || '', rada: sk.rada,
  };
};

export const GENERATORY = Object.keys(G);
export function generuj(gen, param, ctx) {
  const u = G[gen](param || {}, ctx || {});
  u.rada = u.rada ? md(u.rada) : '';
  u.vysvetleni = md(u.vysvetleni || '');
  u.moznosti.forEach((m) => { if (m.proc) m.proc = md(m.proc); });
  return u;
}

// Věty na kartičku hosta: zvyky v present simple, jedna činnost v present continuous.
export function kartaHosta(h, n = 4) {
  const pod = pHost(h);
  const zv = h.zvyky.slice(0, n).map((z) => {
    const p = skladej({ pod, f: z.f, cas: 's' });
    return { ik: z.ik, html: `${p.pred}<b>${esc(p.sl)}</b>${p.za}` };
  });
  const a = vyber(h.ted), pt = skladej({ pod: { t: h.os, os: h.os }, f: a.f, cas: 'c', sig: { t: 'Right now', kde: 'zacatek', cas: 'c', cs: 'právě teď' } });
  return { zvyky: zv, ted: { ik: a.ik, html: `${pt.pred.replace(/<[^>]+>/g, '').replace('Right now He', 'Right now he').replace('Right now She', 'Right now she').replace('Right now It', 'Right now it')}<b>${esc(pt.sl)}</b>${pt.za}` } };
}
