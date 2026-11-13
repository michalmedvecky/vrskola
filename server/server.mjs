// Mini server pro online souboje třídy (TOP 5 pro každý režim). Bez závislostí, jen Node.js ≥ 22.
//
// Hra neposílá skóre, ale seznam odpovědí; body spočítá server sám podle seznamu slov (slova.js, stejný soubor jako hra).
// Každý souboj začíná podepsaným jednorázovým lístkem (POST /api/souboj/start), na konci (POST /api/souboj/konec)
// server ověří lístek, délku hry a tempo odpovědí. Cílem je, aby dítě skóre nepodvrhlo z konzole prohlížeče.
//
// Proměnné prostředí:
//   PORT=8081, DATA_DIR=/data (výsledky + tajný klíč pro podpis lístků), SOUBOJ_CAS=300 (délka souboje v s),
//   ADMIN_TOKEN (heslo učitele pro mazání; bez něj je mazání vypnuté), SLOVA=./slova.js,
//   STATIC_DIR (jen pro lokální zkoušení: servíruje i soubory hry, např. STATIC_DIR=../web)
import http from 'node:http';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, extname, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.PORT) || 8081;
const DATA_DIR = process.env.DATA_DIR || './data';
const CAS = Math.max(10, Number(process.env.SOUBOJ_CAS) || 300);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const STATIC_DIR = process.env.STATIC_DIR ? resolve(process.env.STATIC_DIR) : '';
const MODES = ['strelba', 'mece', 'karty', 'bludiste'];
const TOP_N = 5, KEEP_N = 100;              // ukazuje se 5, uchovává se 100 nejlepších jmen na režim
const MIN_GAP_MS = 60;                       // odpověď dřív než 60 ms po předchozí se nezapočítá (ani oběma rukama to rychleji nejde)
const MAX_RATE = 2.5;                        // víc správných odpovědí než 2,5 za sekundu se nezapočítá
const MAX_ANSWERS_RATE = 6;                  // ještě víc odpovědí = zjevný podvrh, výsledek se odmítne
const TICKET_TTL_MS = 45 * 60 * 1000;        // lístek platí 45 min (hra jde pauznout)

/* ---- slova: stejná logika jako ve hře (web/index.html) ---- */
const { SLOVA } = await import(pathToFileURL(resolve(process.env.SLOVA || './slova.js')).href);
const SWAP = { y:'i', i:'y', 'ý':'í', 'í':'ý', Y:'I', I:'Y', 'Ý':'Í', 'Í':'Ý' };
const BY_CORRECT = new Map(), BY_WRONG = new Map();
for (const { y, i } of Object.values(SLOVA)) for (const raw of [...y, ...i]){
  const m = raw.match(/^(.*)\[(.)\](.*)$/);
  if (!m || !SWAP[m[2]]) continue;
  const info = { correct: m[1]+m[2]+m[3], wrong: m[1]+SWAP[m[2]]+m[3], letter: m[2] };
  BY_CORRECT.set(info.correct, info); BY_WRONG.set(info.wrong, info);
}

/* ---- úložiště ---- */
mkdirSync(DATA_DIR, { recursive: true });
const SCORES_FILE = join(DATA_DIR, 'vysledky.json'), KEY_FILE = join(DATA_DIR, 'klic');
const SECRET = (() => {
  if (existsSync(KEY_FILE)) return readFileSync(KEY_FILE, 'utf8').trim();
  const k = randomBytes(32).toString('hex'); writeFileSync(KEY_FILE, k, { mode: 0o600 }); return k;
})();
let db = (() => { try { return JSON.parse(readFileSync(SCORES_FILE, 'utf8')); } catch { return {}; } })();
for (const m of MODES) if (!Array.isArray(db[m])) db[m] = [];
function save(){ const tmp = SCORES_FILE + '.tmp'; writeFileSync(tmp, JSON.stringify(db)); renameSync(tmp, SCORES_FILE); }
const top = (mode) => db[mode].slice(0, TOP_N).map(({ name, score, good, bad }) => ({ name, score, good, bad }));

/* ---- lístky ---- */
const sign = (s) => createHmac('sha256', SECRET).update(s).digest('base64url');
function makeTicket(mode){
  const body = `${randomBytes(9).toString('base64url')}.${mode}.${Date.now()}.${CAS}`;
  return `${body}.${sign(body)}`;
}
const used = new Map();   // id → expirace (jednorázovost lístků)
function checkTicket(ticket, mode){
  const p = String(ticket || '').split('.');
  if (p.length !== 5) return 'neplatný lístek';
  const body = p.slice(0, 4).join('.'), sig = Buffer.from(p[4]), want = Buffer.from(sign(body));
  if (sig.length !== want.length || !timingSafeEqual(sig, want)) return 'neplatný lístek';
  const [id, m, start, cas] = [p[0], p[1], Number(p[2]), Number(p[3])];
  if (m !== mode) return 'lístek je pro jiný režim';
  const age = Date.now() - start;
  if (age > TICKET_TTL_MS) return 'lístek vypršel';
  if (age < cas * 1000 - 3000) return 'hra skončila moc brzy';
  if (used.has(id)) return 'lístek už byl použit';
  const now = Date.now(); for (const [k, exp] of used) if (exp < now) used.delete(k);
  used.set(id, start + TICKET_TTL_MS);
  return { cas };
}

/* ---- výpočet skóre z odpovědí ---- */
// odpověď = [čas ve hře v ms, text, akce]; Střelnice/Meče: text = zobrazené slovo, akce 'R' (pravá = správně) / 'L';
// Doplňovačka: text = správný tvar slova, akce = vystřelené písmeno.
// Bludiště: text = slovo u cesty, kterou hráč na křižovatce zvolil, akce vždy 'R' (= „tohle je správně“).
function evaluate(mode, answers, cas){
  if (!Array.isArray(answers)) return 'chybí odpovědi';
  if (answers.length > cas * MAX_ANSWERS_RATE + 5) return 'příliš mnoho odpovědí';
  let good = 0, bad = 0, last = -Infinity;
  for (const a of answers){
    if (!Array.isArray(a) || a.length !== 3) return 'špatný formát odpovědi';
    const [t, text, act] = a;
    if (typeof t !== 'number' || t < 0 || t > cas * 1000 + 2000 || t < last) return 'špatný čas odpovědi';
    if (t - last < MIN_GAP_MS) continue;   // nepočítá se, ale celý výsledek kvůli tomu nezahodíme (dva bloky jedním švihem)
    last = t;
    let right;
    if (mode === 'karty'){
      const info = BY_CORRECT.get(text);
      if (!info || typeof act !== 'string' || act.toLowerCase() !== info.letter.toLowerCase() && act.toLowerCase() !== SWAP[info.letter].toLowerCase()) return 'neznámé slovo';
      right = act === info.letter;
    } else {
      const shownCorrect = BY_CORRECT.has(text), shownWrong = BY_WRONG.has(text);
      if ((!shownCorrect && !shownWrong) || (act !== 'R' && act !== 'L')) return 'neznámé slovo';
      right = (act === 'R') === shownCorrect;
    }
    right ? good++ : bad++;
  }
  good = Math.min(good, Math.floor(cas * MAX_RATE));
  return { good, bad, score: good - bad };
}

function cleanName(n){
  const s = String(n || '').normalize('NFC').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 12);
  return s || null;
}
function record(mode, name, res){
  const list = db[mode], key = name.toLocaleLowerCase('cs');
  const old = list.findIndex(e => e.name.toLocaleLowerCase('cs') === key);
  const entry = { name, ...res, t: Date.now() };
  if (old >= 0){ if (list[old].score >= res.score) return rank(mode, list[old]); list.splice(old, 1); }
  list.push(entry); list.sort((a, b) => b.score - a.score || a.t - b.t); list.length = Math.min(list.length, KEEP_N);
  save();
  return rank(mode, entry);
}
const rank = (mode, e) => { const i = db[mode].indexOf(e); return i < 0 ? null : i + 1; };

/* ---- jednoduchý limit požadavků (celá třída bývá za jednou IP, proto velkoryse) ---- */
const hits = new Map();
function limited(ip){
  const now = Date.now(), h = hits.get(ip) || { n: 0, t: now };
  if (now - h.t > 60000){ h.n = 0; h.t = now; }
  h.n++; hits.set(ip, h);
  if (hits.size > 5000) hits.clear();
  return h.n > 300;
}

/* ---- HTTP ---- */
function send(res, code, obj){
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function readJson(req){
  return new Promise((ok, fail) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 64 * 1024){ fail(new Error('moc velké')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { fail(new Error('špatný JSON')); } });
    req.on('error', fail);
  });
}
function isAdmin(req){
  if (!ADMIN_TOKEN) return false;
  const got = Buffer.from(String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')), want = Buffer.from(ADMIN_TOKEN);
  return got.length === want.length && timingSafeEqual(got, want);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), path = url.pathname.replace(/\/+$/, '');
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  try {
    if (path === '/healthz') return send(res, 200, { ok: true });
    if (limited(ip)) return send(res, 429, { chyba: 'moc požadavků, zkus to za chvíli' });

    if (req.method === 'GET' && path === '/api/top'){
      const mode = url.searchParams.get('rezim');
      if (!MODES.includes(mode)) return send(res, 400, { chyba: 'neznámý režim' });
      return send(res, 200, { rezim: mode, cas: CAS, top: top(mode) });
    }
    if (req.method === 'POST' && path === '/api/souboj/start'){
      const { rezim } = await readJson(req);
      if (!MODES.includes(rezim)) return send(res, 400, { chyba: 'neznámý režim' });
      return send(res, 200, { listek: makeTicket(rezim), cas: CAS });
    }
    if (req.method === 'POST' && path === '/api/souboj/konec'){
      const { rezim, listek, jmeno, odpovedi } = await readJson(req);
      if (!MODES.includes(rezim)) return send(res, 400, { chyba: 'neznámý režim' });
      const name = cleanName(jmeno);
      if (!name) return send(res, 400, { chyba: 'chybí jméno' });
      const t = checkTicket(listek, rezim);
      if (typeof t === 'string') return send(res, 400, { chyba: t });
      const r = evaluate(rezim, odpovedi, t.cas);
      if (typeof r === 'string') return send(res, 400, { chyba: r });
      const poradi = record(rezim, name, r);
      return send(res, 200, { ...r, jmeno: name, poradi, top: top(rezim) });
    }
    // učitel: DELETE /api/admin/top?rezim=strelba[&jmeno=Pepa]  (bez rezim = všechny režimy), hlavička Authorization: Bearer <ADMIN_TOKEN>
    if (path === '/api/admin/top'){
      if (!isAdmin(req)) return send(res, 403, { chyba: 'chybí nebo nesedí heslo učitele' });
      const mode = url.searchParams.get('rezim'), jm = url.searchParams.get('jmeno');
      if (mode && !MODES.includes(mode)) return send(res, 400, { chyba: 'neznámý režim' });
      if (req.method === 'GET') return send(res, 200, Object.fromEntries((mode ? [mode] : MODES).map(m => [m, db[m]])));
      if (req.method !== 'DELETE') return send(res, 405, { chyba: 'použij GET nebo DELETE' });
      let smazano = 0;
      for (const m of mode ? [mode] : MODES){
        const before = db[m].length;
        db[m] = jm ? db[m].filter(e => e.name.toLocaleLowerCase('cs') !== jm.toLocaleLowerCase('cs')) : [];
        smazano += before - db[m].length;
      }
      save();
      return send(res, 200, { smazano });
    }
    if (STATIC_DIR && req.method === 'GET' && !path.startsWith('/api')){
      const file = normalize(join(STATIC_DIR, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
      if (file.startsWith(STATIC_DIR) && existsSync(file)){
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg' };
        res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        return res.end(readFileSync(file));
      }
    }
    send(res, 404, { chyba: 'nenalezeno' });
  } catch (e) {
    send(res, 400, { chyba: e.message || 'chyba' });
  }
});
server.listen(PORT, () => console.log(`vrskola-api na :${PORT}, souboj ${CAS} s, ${BY_CORRECT.size} slov, mazání ${ADMIN_TOKEN ? 'zapnuté' : 'vypnuté'}`));
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => server.close(() => process.exit(0)));
