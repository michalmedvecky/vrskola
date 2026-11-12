// Vyjmenovaná slova for the games: per letter the hard-y words (vyjmenovaná + příbuzná) and soft-i traps.
// The letter in [brackets] is the gap the child fills; y/ý counts as "Y", i/í as "I". Every item must have exactly
// one right answer including length: where swapping y/ý/i/í gives another real word (pyl × pil, byt × bit × být,
// syrový × sirový, sýrový × sírový, pylový × pilový, lyže × líže, výt × vít, mýt × mít, výr × vír) the item is a short phrase that decides it.
export const SLOVA = {
  B: {
    y: ["b[ý]t doma", "b[y]dlet", "ob[y]vatel", "náš b[y]t", "příb[y]tek", "náb[y]tek", "dob[y]tek", "ob[y]čej", "b[y]strý",
      "b[y]lina", "kob[y]la", "b[ý]k", "Přib[y]slav", "b[y]dliště", "ob[y]tný", "zb[y]tek", "b[y]tost", "b[y]linkový",
      "kob[y]lka", "b[ý]čí", "b[y]střina", "ob[y]čejný", "zb[ý]vat", "ub[y]tovna"],
    i: ["b[í]lý", "b[i]č", "b[i]tva", "b[i]cykl", "ob[i]lí", "sb[í]rat", "b[í]da", "nab[í]dka", "bab[i]čka", "b[i]zon"],
  },
  L: {
    y: ["sl[y]šet", "ml[ý]n", "bl[ý]skat se", "pol[y]kat", "pl[y]nout", "pl[ý]tvat", "vzl[y]kat", "l[y]sý", "l[ý]tko",
      "l[ý]ko", "nové l[y]že", "pel[y]něk", "pl[y]š", "sl[y]šitelný", "ml[y]nář", "bl[ý]skavý", "spol[y]kat", "pl[y]nulý",
      "vzl[y]k", "l[y]žař", "l[y]žovat", "pl[y]šový", "l[y]sina", "ml[ý]nek"],
    i: ["l[í]ný", "l[í]pa", "kl[í]č", "l[i]st", "sl[i]b", "l[í]zat", "bl[í]zko", "pl[í]ce", "sl[i]mák", "l[i]ška",
      "kl[i]d", "l[i]stopad", "sl[i]vka"],
  },
  M: {
    y: ["m[y] jsme doma", "m[ý]t nádobí", "m[y]slet", "m[ý]lit se", "hm[y]z", "m[y]š", "hlem[ý]žď", "zam[y]kat",
      "sm[ý]kat", "dm[ý]chat", "chm[ý]ří", "Litom[y]šl", "m[y]slivec", "m[ý]dlo", "m[ý]lka", "hm[y]zí", "m[y]ška",
      "sm[y]k", "m[y]šlenka"],
    i: ["m[í]t hlad", "m[í]sa", "m[i]lý", "m[i]nuta", "sm[í]ch", "zm[i]zet", "m[i]nce", "m[í]ček", "m[i]lovat",
      "m[i]nulý", "m[í]stnost", "m[i]ska", "zm[i]je"],
  },
  P: {
    y: ["p[ý]cha", "p[y]tel", "p[y]sk", "netop[ý]r", "slep[ý]š", "včela sbírá p[y]l", "kop[y]to", "klop[ý]tat", "třp[y]tit se",
      "zp[y]tovat", "p[y]kat", "p[ý]r", "p[ý]řit se", "čep[ý]řit se", "p[y]šný", "p[y]tlík", "p[y]skatý", "kop[y]tník",
      "klop[ý]tnout", "třp[y]tivý", "p[y]lová zrnka"],
    i: ["p[i]la", "p[í]sek", "p[í]rko", "p[i]tí", "nap[í]t se", "p[i]štět", "p[í]seň", "p[i]rát", "šp[i]navý",
      "p[i]škot", "p[í]smeno"],
  },
  S: {
    y: ["s[y]n", "s[y]tý", "s[ý]r", "s[y]rové maso", "s[y]chravý", "us[y]chat", "s[ý]kora", "s[ý]ček", "s[y]sel", "s[y]čet",
      "s[y]pat", "s[y]novec", "nas[y]tit", "s[ý]rová pizza", "s[ý]korka", "vys[y]pat", "pos[y]pat", "s[y]rovátka"],
    i: ["s[í]la", "s[i]lnice", "s[í]tko", "s[i]rup", "s[í]dliště", "s[i]rotek", "s[i]lný", "s[í]ť", "s[i]vý", "s[i]rka",
      "s[í]pat"],
  },
  V: {
    y: ["v[y] jste doma", "v[y]soký", "vlk v[y]je", "v[ý]skat", "zv[y]kat", "žv[ý]kat", "v[y]dra", "v[ý]r houká", "v[y]žle",
      "pov[y]k", "v[ý]heň", "V[y]sočina", "v[y]jet", "zv[y]k", "žv[ý]kačka", "v[y]šplhat", "v[y]lézt", "v[ý]let",
      "v[ý]tah", "zv[y]klý"],
    i: ["v[í]la", "v[í]tr", "v[i]dlička", "v[i]dět", "v[i]set", "v[í]tat", "sv[í]čka", "v[í]r ve vodě", "v[i]šně",
      "v[i]deo"],
  },
  Z: {
    y: ["brz[y]", "jaz[y]k", "naz[ý]vat se", "oz[ý]vat se", "vyz[ý]vat", "jaz[y]kový", "jaz[ý]ček", "přiz[ý]vat"],
    i: ["z[i]ma", "z[í]tra", "z[i]p", "z[í]skat", "z[í]vat", "z[i]nek", "z[í]vnout", "z[i]mní", "vz[í]t"],
  },
};
export const PISMENA = Object.keys(SLOVA);

// "p[y]sk" -> { key, gap: "p_sk", full: "pysk", letter: "y", hard: true, before, after }
export function parse(raw, pismeno) {
  const m = raw.match(/^(.*)\[(.)\](.*)$/);
  return {
    key: raw, pismeno, gap: m[1] + "_" + m[3], full: m[1] + m[2] + m[3], letter: m[2],
    hard: m[2] === "y" || m[2] === "ý", before: m[1], after: m[3],
  };
}
