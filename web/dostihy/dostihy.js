// Dostihy: simulace závodu bez DOM (jde pustit i v Node – nastroje/dostihy-test.mjs ladí vyvážení).
//
// Kůň má tři závodní vlastnosti 0..8 (tolik věcí z obchodu): rychlost (síla), kondice (zdraví), skok (obratnost).
// Výsledek závodu = vlastnosti koně + jak dobře hráč skáče a kdy pobízí + náhoda (zakopnutí). Soupeři jsou
// v každé lize jinak silní a mírně se přizpůsobují (když hráč hodně ztrácí, trochu zvolní, když vede, přidají).
// Proto jde vyhrát i se slabým koněm (ve vesnických dostizích, s dobrým skákáním) a prohrát i se silným.

export const MAX_STUPEN = 8;
export const DOBA_SKOKU = 0.56;   // s ve vzduchu
export const IDEAL_SKOKU = 0.28;  // s před překážkou je ideální chvíle odrazu

// Parametry koně z vlastností (stupně 0..8, mohou být i desetinné u soupeřů).
export function parametry({ rychlost = 0, kondice = 0, skok = 0 }) {
  const r = Math.min(1, rychlost / MAX_STUPEN), k = Math.min(1, kondice / MAX_STUPEN), s = Math.min(1, skok / MAX_STUPEN);
  const cestovni = 6.8 + 2.2 * r;
  return {
    cestovni,
    sprint: cestovni + 1.9 + 1.4 * r,
    unaveny: cestovni * (0.92 + 0.05 * k),
    zrychleni: 2.2 + 2.2 * r,
    sila: 2.4 + 4.6 * k,          // kolik sekund vydrží sprint
    obnova: 0.2 + 0.4 * k,        // za sekundu bez sprintu
    okno: 0.12 + 0.18 * s,        // ± s kolem ideálního odrazu, kdy je skok platný
    klopyt: 0.03 + 0.37 * (1 - s) ** 1.4, // základní šance zavadit i při platném skoku
    vzpamatovani: 0.75 * (1.35 - 0.55 * k), // s po zakopnutí bez zrychlování
    r, k, s,
  };
}

function rnd(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }

// liga = { delka, prekazky, souperi: [{ jmeno, rychlost, kondice, skok }], presnost (σ odrazu soupeřů v s) }
export class Zavod {
  constructor(liga, kun, { seed = Math.floor(Math.random() * 1e9), pomoc = 0 } = {}) {
    this.r = rnd(seed);
    this.delka = liga.delka;
    this.cas = 0;
    this.odpocet = 3; // s do startu
    // překážky: rozmístěné nepravidelně, první po rozběhu, poslední kus před cílem
    const n = liga.prekazky, od = 70, do_ = liga.delka - 60;
    this.prekazky = [];
    for (let i = 0; i < n; i++) {
      const zaklad = od + ((do_ - od) * (i + 0.5)) / n;
      this.prekazky.push(Math.round(zaklad + (this.r() - 0.5) * ((do_ - od) / n) * 0.5));
    }
    const novy = (jmeno, vlast, hrac, presnost) => ({
      jmeno, hrac, vlast, p: parametry(vlast), forma: 1 + gauss(this.r) * 0.045, x: 0, v: 0, sila: parametry(vlast).sila, sprint: false,
      skokOd: -9, prekazky: this.prekazky.map(() => null), zakopnuti: 0, uzamceno: 0, cil: null, presnost,
      planOdrazu: null, chuti: this.r(), udalosti: [], skoku: 0, cistych: 0, perfekt: 0,
    });
    this.kone = [novy(kun.jmeno, kun, true, 0), ...liga.souperi.map((s) => novy(s.jmeno, s, false, liga.presnost ?? 0.12))];
    this.hrac = this.kone[0];
    this.pomoc = pomoc + (liga.pomoc || 0); // 0..1 navíc přizpůsobení soupeřů (rodič může zapnout pro mladší děti)
    this.poradi = [];
    this.konec = false;
  }

  vzduchem(k) { return this.cas - k.skokOd < DOBA_SKOKU; }
  vyskaSkoku(k) { const t = (this.cas - k.skokOd) / DOBA_SKOKU; return t >= 0 && t < 1 ? Math.sin(t * Math.PI) : 0; }
  dalsiPrekazka(k) { return this.prekazky.findIndex((x, i) => x > k.x - 0.5 && k.prekazky[i] === null); }

  // odraz: vyhodnotí se proti nejbližší překážce před koněm
  skoc(k) {
    if (this.odpocet > 0 || k.cil !== null || this.vzduchem(k) || k.uzamceno > 0.25) return null;
    k.skokOd = this.cas;
    k.skoku++;
    const i = this.dalsiPrekazka(k);
    if (i < 0) return 'naprazdno';
    const d = this.prekazky[i] - k.x;
    const e = (d - Math.max(k.v, 3) * IDEAL_SKOKU) / Math.max(k.v, 3); // + = brzy, − = pozdě
    if (e > k.p.okno) return 'brzy'; // doskočí před překážkou, musí skočit znovu
    if (e < -k.p.okno) { k.prekazky[i] = 'pozde'; return 'pozde'; }
    const presne = Math.abs(e) / k.p.okno;
    const perfektni = presne < 0.35;
    const sance = k.p.klopyt * (0.35 + 0.65 * presne) * (perfektni ? 0.5 : 1);
    if (this.r() < sance) { k.prekazky[i] = 'zavadil'; return 'zavadil'; }
    k.prekazky[i] = perfektni ? 'perfekt' : 'cisty';
    k.cistych++;
    if (perfektni) k.perfekt++;
    return k.prekazky[i];
  }

  // vstup hráče: { sprint: bool, skok: bool (stisk v tomto snímku) }
  krok(dt, vstup = {}) {
    if (this.konec) return;
    if (this.odpocet > 0) { this.odpocet -= dt; return; }
    this.cas += dt;
    const h = this.hrac;
    if (vstup.skok) { const v = this.skoc(h); if (v) h.udalosti.push({ cas: this.cas, co: v }); }
    h.sprint = !!vstup.sprint;
    const vedouci = Math.max(...this.kone.filter((k) => !k.hrac).map((k) => k.x));
    for (const k of this.kone) {
      if (!k.hrac) this.ridSouper(k, vedouci);
      this.pohyb(k, dt);
    }
    if (this.kone.every((k) => k.cil !== null) || (h.cil !== null && this.cas - h.cil > 12)) this.dokonci();
  }

  ridSouper(k, vedouci) {
    if (k.cil !== null) return;
    // sprint: na začátku trochu, v poslední třetině naplno, jinak podle chuti a sil
    const zbyva = this.delka - k.x;
    const plna = k.sila / k.p.sila;
    if (zbyva < this.delka * 0.3) k.sprint = !k.vycerpany;
    else if (k.sprint) k.sprint = plna > 0.35 && !k.vycerpany;
    else k.sprint = plna > 0.9 && this.r() < 0.02 + k.chuti * 0.02;
    // odraz: soupeř si u každé překážky „naplánuje“ chybu odrazu podle své přesnosti
    const i = this.dalsiPrekazka(k);
    if (i >= 0 && !this.vzduchem(k)) {
      if (k.planOdrazu?.i !== i) k.planOdrazu = { i, e: gauss(this.r) * k.presnost, nezkusi: this.r() < 0.03 };
      const d = this.prekazky[i] - k.x;
      if (!k.planOdrazu.nezkusi && d <= Math.max(k.v, 3) * (IDEAL_SKOKU + k.planOdrazu.e)) this.skoc(k);
    }
  }

  pohyb(k, dt) {
    const h = this.hrac;
    if (k.cil !== null) { k.v = Math.max(3, k.v - dt * 2); k.x += k.v * dt; return; }
    k.uzamceno = Math.max(0, k.uzamceno - dt);
    k.zakopnuti = Math.max(0, k.zakopnuti - dt);
    // vyčerpaný kůň (síly došly během sprintu) může znovu sprintovat, až nabere aspoň třetinu sil
    if (k.vycerpany && k.sila >= k.p.sila * 0.33) k.vycerpany = false;
    const sprintuje = k.sprint && !k.vycerpany && k.uzamceno <= 0;
    if (sprintuje) { k.sila = Math.max(0, k.sila - dt); if (k.sila <= 0) k.vycerpany = true; }
    else k.sila = Math.min(k.p.sila, k.sila + dt * k.p.obnova * (k.sprint ? 0.5 : 1));
    let cil = (sprintuje ? k.p.sprint : k.vycerpany && k.sprint ? k.p.unaveny : k.p.cestovni) * k.forma;
    if (!k.hrac) {
      // přizpůsobení: soupeř, který hráči hodně utekl, trochu zvolní; kdo hodně ztrácí, přidá
      const rozdil = k.x - h.x;
      const mira = 1 + this.pomoc;
      if (rozdil > 8) cil *= 1 - Math.min(0.12, (rozdil - 8) * 0.006) * mira;
      else if (rozdil < -12) cil *= 1 + Math.min(0.05, (-12 - rozdil) * 0.003);
    }
    if (k.uzamceno > 0) cil = Math.min(cil, k.v);
    const a = k.v < cil ? k.p.zrychleni : -3;
    k.v = k.v < cil ? Math.min(cil, k.v + a * dt) : Math.max(cil, k.v + a * dt);
    const pred = k.x;
    k.x += k.v * dt;
    // průchod překážkou
    this.prekazky.forEach((px, i) => {
      if (pred < px && k.x >= px) {
        const st = k.prekazky[i];
        if (st === 'cisty' || st === 'perfekt') {
          if (st === 'perfekt') k.v += 0.7;
          return;
        }
        // nevyskočil, pozdě, nebo zavadil
        const tvrde = st === null || st === 'pozde';
        if (st === null) k.prekazky[i] = 'naraz';
        k.v *= tvrde ? 0.4 : 0.65;
        k.uzamceno = k.p.vzpamatovani * (tvrde ? 1.25 : 0.7);
        k.zakopnuti = 0.9;
        k.udalosti.push({ cas: this.cas, co: tvrde ? 'naraz' : 'zavadil', i });
      }
    });
    if (k.x >= this.delka && k.cil === null) { k.cil = this.cas; this.poradi.push(k); }
  }

  dokonci() {
    this.konec = true;
    const zbytek = this.kone.filter((k) => k.cil === null).sort((a, b) => b.x - a.x);
    this.poradi.push(...zbytek);
  }

  // pořadí právě teď (pro ukazatel během závodu)
  prubezne() {
    return this.kone.slice().sort((a, b) => (a.cil ?? Infinity) - (b.cil ?? Infinity) || b.x - a.x);
  }
  mistoHrace() { return (this.konec ? this.poradi : this.prubezne()).indexOf(this.hrac) + 1; }
}

// Jména a barvy soupeřů (vymyšlení koně).
export const SOUPERI = [
  { jmeno: 'Šiška', barva: '#8d5524', dres: '#2980b9' },
  { jmeno: 'Kometa', barva: '#e8dcc8', dres: '#27ae60' },
  { jmeno: 'Bouřka', barva: '#3b2618', dres: '#f39c12' },
  { jmeno: 'Ořech', barva: '#c68642', dres: '#8e44ad' },
  { jmeno: 'Fanynka', barva: '#9e9e9e', dres: '#16a085' },
  { jmeno: 'Vichr', barva: '#5d4037', dres: '#c0392b' },
  { jmeno: 'Hvězdička', barva: '#d9b26a', dres: '#e84393' },
  { jmeno: 'Blesk', barva: '#2b2b2b', dres: '#f1c40f' },
];

// Vyrobí soupeře pro ligu: každý má svůj rozsah síly (slabší, střední, silný), vlastnosti kolem ní kolísají.
export function souperiLigy(liga, r = Math.random) {
  const rozsahy = liga.souperi || [liga.sila, liga.sila, liga.sila];
  const jmena = SOUPERI.slice().sort(() => r() - 0.5).slice(0, rozsahy.length);
  return jmena.map((s, i) => {
    const [od, do_] = rozsahy[i];
    const zaklad = od + (do_ - od) * r();
    const v = () => Math.max(0, Math.min(MAX_STUPEN, zaklad + (r() - 0.5) * 1.5));
    return { ...s, rychlost: v(), kondice: v(), skok: v() };
  });
}
