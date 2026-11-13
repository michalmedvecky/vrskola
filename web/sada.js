// Sady zadání (vyměnitelný obsah her). Sdílí ho hra (index.html) i server souboje (server/server.mjs),
// aby obě strany rozuměly stejné položce stejně. Popis formátu je v sady/README.md.
//
// Položka je řetězec „před[odpověď|špatně1|špatně2]po“, např. "b[y]dlet", "狗 = [pes|kočka]".
//   - správný tvar = před + odpověď + po ("bydlet"), špatný tvar = před + špatná možnost + po ("bidlet")
//   - bez výslovných špatných možností se vezmou ze záměny sady ("zamena": y → i …),
//   - a když ani ta nic nedá, poslouží odpovědi ostatních položek ze stejné skupiny (slovíčka: "狗 = [pes]").
// Špatný tvar, který je zároveň správným tvarem jiné položky, se zahodí (jinak by šlo o dvě správné odpovědi).

export const ID_RE = /^[a-z0-9-]{1,40}$/;

export function parsePolozka(raw){
  const m = String(raw).match(/^([^[\]]*)\[([^[\]]+)\]([^[\]]*)$/);
  if (!m) return null;
  const moznosti = m[2].split('|').map(s => s.trim()).filter(Boolean);
  if (!moznosti.length) return null;
  return { pre: m[1], post: m[3], answer: moznosti[0], explicit: moznosti.slice(1) };
}

// json (obsah souboru sady) → sada připravená pro hru i server.
export function pripravSadu(json){
  if (!json || !ID_RE.test(json.id || '')) throw new Error('sada nemá platné "id" (malá písmena, číslice, pomlčky)');
  const zamena = json.zamena || {};
  const items = [], chyby = [];
  (json.skupiny || []).forEach((sk, gi) => {
    for (const raw of sk.polozky || []){
      const p = parsePolozka(raw);
      if (!p){ chyby.push(`nerozumím položce "${raw}"`); continue; }
      items.push({ ...p, raw, group: gi, skupina: sk.nazev || '', correct: p.pre + p.answer + p.post });
    }
  });
  const correctSet = new Set(items.map(it => it.correct));
  const byCorrect = new Map(), byWrong = new Map();
  for (const it of items){
    let opts = it.explicit.length ? it.explicit : [].concat(zamena[it.answer] || []);
    if (!opts.length){   // slovíčka: špatné možnosti = odpovědi ostatních položek ze skupiny (málo-li jich je, z celé sady)
      let pool = items.filter(o => o.group === it.group);
      if (pool.length < 3) pool = items;
      opts = [...new Set(pool.map(o => o.answer))];
    }
    it.wrongOptions = [...new Set(opts)].filter(o => o !== it.answer && !correctSet.has(it.pre + o + it.post));
    it.wrongs = it.wrongOptions.map(o => it.pre + o + it.post);
    if (!it.wrongs.length) chyby.push(`položka "${it.raw}" nemá žádnou špatnou možnost`);
    if (byCorrect.has(it.correct)) chyby.push(`položka "${it.correct}" je v sadě dvakrát`);
    byCorrect.set(it.correct, it);
    for (const w of it.wrongs) if (!byWrong.has(w)) byWrong.set(w, it);
  }
  const usable = items.filter(it => it.wrongs.length);
  if (!usable.length) throw new Error(`sada ${json.id} nemá žádnou použitelnou položku`);
  return {
    id: json.id, nazev: json.nazev || json.id, jazyk: json.jazyk || 'cs',
    pocetMoznosti: Math.min(4, Math.max(2, Number(json.pocetMoznosti) || 3)),
    poradiMoznosti: Array.isArray(json.poradiMoznosti) ? json.poradiMoznosti : null,
    texty: json.texty || {}, portrety: Array.isArray(json.portrety) ? json.portrety : [],
    items: usable, byCorrect, byWrong, chyby,
  };
}

// Vyhodnocení jedné odpovědi (stejně ve hře i na serveru). Vrací true/false, nebo null, když odpověď do sady nepatří.
//   Střelnice / Meče / Bludiště: text = zobrazený tvar, act 'R' (= „je správně“) nebo 'L' (= „je špatně“)
//   Doplňovačka ('karty'): text = správný tvar položky, act = vybraná možnost
export function vyhodnot(sada, mode, text, act){
  if (mode === 'karty'){
    const it = sada.byCorrect.get(text);
    if (!it || typeof act !== 'string' || (act !== it.answer && !it.wrongOptions.includes(act))) return null;
    return act === it.answer;
  }
  const isCorrect = sada.byCorrect.has(text), isWrong = sada.byWrong.has(text);
  if ((!isCorrect && !isWrong) || (act !== 'R' && act !== 'L')) return null;
  return (act === 'R') === isCorrect;
}
