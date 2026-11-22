// Obrazovka dostihu: koně běží zleva doprava každý ve své dráze, hráč ovládá svého koně dvěma tlačítky.
//   🥕 Pobídni (držet) = sprint, dokud má kůň síly (ukazatel nad tlačítkem)
//   ⤴ Skoč (klepnout) = odraz; zelený pruh před překážkou ukazuje, kdy je skok platný (lepší kůň = delší pruh)
// Na PC: mezerník / šipka nahoru = skok, šipka doprava nebo Shift (držet) = pobídka.
// spustDostih(liga, hrac) → Promise<{ misto, poradi: [{jmeno, hrac}], zavod }>
import { Zavod, souperiLigy, IDEAL_SKOKU } from './dostihy.js';
import { nakresliKone } from './kun.js';
import { zvuk } from './zvuky.js';

const TEXTY = {
  perfekt: ['Perfektní skok! ⭐', '#f5c518'], cisty: ['Hop! 👍', '#2ecc71'], brzy: ['Moc brzo!', '#e67e22'],
  pozde: ['Pozdě!', '#e67e22'], zavadil: ['Zavadila…', '#e67e22'], naraz: ['Bum! Zakopla!', '#e74c3c'],
};

// hrac = { jmeno, st: {kondice, rychlost, skok, krasa}, vzhled, jezdec: {kuze, vlasy, triko, helma, kalhoty}, pomoc }
export function spustDostih(liga, hrac) {
  return new Promise((hotovo) => {
    const souperi = souperiLigy(liga);
    const z = new Zavod({ ...liga, souperi }, { jmeno: hrac.jmeno, ...hrac.st }, { pomoc: hrac.pomoc || 0 });
    window.__dsZavod = z; // pro testy
    const el = document.createElement('div');
    el.className = 'dostih';
    el.innerHTML = `
      <canvas></canvas>
      <div class="dostih-horni">
        <div class="dostih-nazev">${liga.ikona || '🏇'} ${liga.nazev}</div>
        <div class="dostih-trat"><div class="dostih-cil">🏁</div></div>
        <div class="dostih-misto"></div>
      </div>
      <div class="dostih-odpocet"></div>
      <div class="dostih-otoc">📱↻ Na šířku uvidíš překážky dřív</div>
      <div class="dostih-ovladani">
        <button class="dostih-tl pobidni"><span class="sila"><i></i></span><b>🥕</b><small>Pobídni<br>(drž)</small></button>
        <button class="dostih-tl skoc"><b>⤴</b><small>Skoč!</small></button>
      </div>`;
    document.body.append(el);
    const cv = el.querySelector('canvas'), ctx = cv.getContext('2d');
    const trat = el.querySelector('.dostih-trat');
    const tecky = z.kone.map((k, i) => {
      const t = document.createElement('i');
      t.className = k.hrac ? 'ja' : '';
      t.style.background = k.hrac ? (hrac.jezdec?.triko || '#ff6fa8') : souperi[i - 1].dres;
      trat.append(t); return t;
    });
    const silaEl = el.querySelector('.sila i');
    const mistoEl = el.querySelector('.dostih-misto');
    const odpocetEl = el.querySelector('.dostih-odpocet');

    // ---------- vstup ----------
    let sprint = false, skok = false;
    const tlP = el.querySelector('.pobidni'), tlS = el.querySelector('.skoc');
    const drz = (v) => (e) => { e.preventDefault(); sprint = v; tlP.classList.toggle('drzim', v); };
    tlP.addEventListener('pointerdown', drz(true)); tlP.addEventListener('pointerup', drz(false));
    tlP.addEventListener('pointercancel', drz(false)); tlP.addEventListener('pointerleave', drz(false));
    tlS.addEventListener('pointerdown', (e) => { e.preventDefault(); skok = true; tlS.classList.add('drzim'); setTimeout(() => tlS.classList.remove('drzim'), 120); });
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); skok = true; }); // klepnutí kamkoli na dráhu = skok
    const kd = (e) => {
      if (e.repeat) return;
      if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); skok = true; }
      if (e.key === 'ArrowRight' || e.key === 'Shift') { sprint = true; tlP.classList.add('drzim'); }
    };
    const ku = (e) => { if (e.key === 'ArrowRight' || e.key === 'Shift') { sprint = false; tlP.classList.remove('drzim'); } };
    addEventListener('keydown', kd); addEventListener('keyup', ku);

    // ---------- kreslení ----------
    const fazeKone = z.kone.map(() => Math.random() * 6);
    const popisky = []; // létající texty
    const prach = [];
    let posledniUdalost = 0, posledniKopyto = 0, odpocetText = '';
    let W = 0, H = 0, dpr = 1;
    const velikost = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    };
    // dráhy: hráč nejblíž (dole), soupeři za ním
    const poradiDrah = [1, 2, 3, 0];
    const draha = (i) => {
      const r = poradiDrah.indexOf(i), n = z.kone.length;
      const horni = H * (W > H ? 0.44 : 0.4), dolni = H * (W > H ? 0.76 : 0.62);
      const y = horni + ((dolni - horni) * r) / (n - 1);
      return { y, m: 0.72 + (0.28 * r) / (n - 1) };
    };
    const ppm = () => (W > H ? Math.max(26, Math.min(W / 22, H / 9)) : Math.max(17, W / 20)); // pixelů na metr v nejbližší dráze
    let kamera = 0;

    function pozadi(t) {
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.4);
      g.addColorStop(0, '#7cc6e8'); g.addColorStop(1, '#d9f0fa');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const p = ppm();
      // vzdálené kopce
      ctx.fillStyle = '#9ccb7a';
      ctx.beginPath(); ctx.moveTo(0, H * 0.3);
      for (let x = 0; x <= W + 40; x += 40) { const wx = x + kamera * p * 0.05; ctx.lineTo(x, H * 0.26 - Math.sin(wx * 0.004) * H * 0.05 - Math.sin(wx * 0.011) * H * 0.02); }
      ctx.lineTo(W, H * 0.34); ctx.lineTo(0, H * 0.34); ctx.closePath(); ctx.fill();
      // Kounice v dálce: kostelík a domky
      const kx = ((W * 0.7 - kamera * p * 0.08) % (W * 2) + W * 2) % (W * 2) - W * 0.3;
      ctx.fillStyle = '#fff8ec'; ctx.fillRect(kx, H * 0.2, 14, H * 0.07); ctx.fillStyle = '#5d6d7e';
      ctx.beginPath(); ctx.moveTo(kx - 2, H * 0.2); ctx.lineTo(kx + 7, H * 0.13); ctx.lineTo(kx + 16, H * 0.2); ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.fillStyle = '#fdf2dc'; ctx.fillRect(kx + 22 + i * 24, H * 0.24, 18, H * 0.035); ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(kx + 20 + i * 24, H * 0.24); ctx.lineTo(kx + 31 + i * 24, H * 0.215); ctx.lineTo(kx + 42 + i * 24, H * 0.24); ctx.fill(); }
      // tribuna s diváky (opakuje se)
      ctx.fillStyle = '#7fb85a'; ctx.fillRect(0, H * 0.3, W, H * 0.06);
      const krok = 900, posun = (kamera * p * 0.55) % krok;
      for (let x0 = -posun - krok; x0 < W + krok; x0 += krok) {
        ctx.fillStyle = '#e8d8b8'; ctx.fillRect(x0 + 100, H * 0.24, 420, H * 0.08);
        ctx.fillStyle = '#5d6d7e'; ctx.fillRect(x0 + 90, H * 0.225, 440, H * 0.02);
        const barvy = ['#e74c3c', '#f1c40f', '#3498db', '#ff6fa8', '#2ecc71', '#9b59b6', '#fff'];
        for (let i = 0; i < 40; i++) {
          const x = x0 + 112 + i * 10, y = H * 0.27 + (i % 3) * H * 0.015 - Math.abs(Math.sin(t * 7 + i)) * 3;
          ctx.fillStyle = barvy[i % barvy.length]; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#f3d2b3'; ctx.beginPath(); ctx.arc(x, y - 5, 2.6, 0, Math.PI * 2); ctx.fill();
        }
        for (let i = 0; i < 6; i++) { ctx.fillStyle = barvy[i]; ctx.beginPath(); ctx.moveTo(x0 + 100 + i * 84, H * 0.225); ctx.lineTo(x0 + 110 + i * 84, H * 0.2 + Math.sin(t * 5 + i) * 2); ctx.lineTo(x0 + 120 + i * 84, H * 0.225); ctx.fill(); }
      }
    }

    function drahy() {
      const p = ppm();
      const serazene = z.kone.map((k, i) => i).sort((a, b) => draha(a).y - draha(b).y);
      const prvni = draha(serazene[0]), posl = draha(serazene[serazene.length - 1]);
      // tráva, písková dráha přes všechny dráhy, bílé zábradlí
      ctx.fillStyle = '#6fae4b'; ctx.fillRect(0, H * 0.33, W, H);
      const horni = prvni.y - 20 * prvni.m, dolni = posl.y + 16 * posl.m;
      const g = ctx.createLinearGradient(0, horni, 0, dolni);
      g.addColorStop(0, '#c9a06a'); g.addColorStop(1, '#d9b27a');
      ctx.fillStyle = g; ctx.fillRect(0, horni, W, dolni - horni);
      // stopy kopyt (posouvají se s kamerou)
      ctx.fillStyle = 'rgba(120,80,40,0.12)';
      for (let i = 0; i < 60; i++) {
        const y = horni + ((i * 37) % 100) / 100 * (dolni - horni);
        const m = 0.72 + 0.28 * (y - horni) / (dolni - horni);
        const x = (((i * 173) - kamera * p * m) % (W + 40) + W + 40) % (W + 40) - 20;
        ctx.beginPath(); ctx.ellipse(x, y, 5 * m, 2 * m, 0, 0, Math.PI * 2); ctx.fill();
      }
      const zabradli = (y, m) => {
        ctx.fillStyle = '#fff'; ctx.fillRect(0, y - 9 * m, W, 3 * m);
        for (let mtr = Math.floor(kamera / 4) * 4 - 8; mtr < kamera + W / (p * m); mtr += 4) { const x = sx(mtr, m); ctx.fillRect(x - 1.5 * m, y - 9 * m, 3 * m, 10 * m); }
      };
      zabradli(horni, prvni.m);
      for (let r = 1; r < serazene.length; r++) {
        const a = draha(serazene[r - 1]), b = draha(serazene[r]);
        const y = (a.y + b.y) / 2 + 4, m = (a.m + b.m) / 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2 * m; ctx.setLineDash([18 * m, 14 * m]);
        ctx.lineDashOffset = kamera * p * m;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]);
      }
      // ukazatele vzdálenosti po 100 m
      for (let mtr = Math.ceil((kamera - 20) / 100) * 100; mtr < kamera + W / (p * 0.72); mtr += 100) {
        if (mtr <= 0 || mtr >= z.delka) continue;
        const x = sx(mtr, prvni.m);
        ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, horni - 34, 4, 26);
        ctx.fillStyle = '#7b2d26'; ctx.beginPath(); ctx.roundRect(x - 20, horni - 50, 40, 18, 6); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '800 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`${z.delka - mtr} m`, x, horni - 37);
      }
      zabradli(dolni + 8 * posl.m, posl.m);
      return serazene;
    }
    const sx = (x, m) => W * (W > H ? 0.28 : 0.2) + (x - kamera) * ppm() * m;

    function prekazka(x, y, m, stav) {
      const p = ppm() * m, s = p / 30;
      ctx.save(); ctx.translate(x, y + 6 * m); ctx.scale(s, s);
      // keřík
      ctx.fillStyle = '#4c8a3a'; ctx.beginPath(); ctx.ellipse(0, -6, 16, 9, 0, Math.PI, Math.PI * 2); ctx.fill();
      // stojany
      ctx.fillStyle = '#fff'; ctx.fillRect(-15, -34, 4, 34); ctx.fillRect(11, -34, 4, 34);
      // bidlo (shozené, když do něj kůň narazil)
      ctx.save();
      if (stav === 'naraz' || stav === 'zavadil' || stav === 'pozde') { ctx.translate(0, -2); ctx.rotate(0.25); }
      else ctx.translate(0, -26);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#e74c3c'; ctx.fillRect(-15 + i * 5, -2.5, 5, 5); }
      ctx.restore();
      ctx.restore();
    }

    function kresli(t, dt) {
      velikost();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const h = z.hrac;
      kamera += (h.x + 2 - kamera) * Math.min(1, dt * 6);
      pozadi(t);
      const serazene = drahy();
      // cíl
      for (const i of serazene) {
        const { y, m } = draha(i), x = sx(z.delka, m);
        if (x < -40 || x > W + 40) continue;
        for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { ctx.fillStyle = (r + c) % 2 ? '#222' : '#fff'; ctx.fillRect(x - 6 * m + c * 6 * m, y - 12 * m + r * 5 * m, 6 * m, 5 * m); }
      }
      const cilX = sx(z.delka, 1);
      if (cilX > -60 && cilX < W + 60) {
        ctx.fillStyle = '#7b2d26'; ctx.fillRect(cilX - 4, H * 0.3, 8, H * 0.47);
        ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(H * 0.035)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('CÍL', cilX, H * 0.29);
      }
      for (const i of serazene) {
        const k = z.kone[i], { y, m } = draha(i);
        // pruh pro odraz (jen hráčova dráha): kde je skok platný při současné rychlosti
        if (k.hrac) {
          const v = Math.max(k.v, 3);
          z.prekazky.forEach((px, j) => {
            if (k.prekazky[j] !== null || px < k.x - 1) return;
            const a = sx(px - v * (IDEAL_SKOKU + k.p.okno), m), b = sx(px - v * (IDEAL_SKOKU - k.p.okno), m);
            const blizko = px - k.x < v * 1.6;
            ctx.fillStyle = blizko ? 'rgba(46,204,113,0.55)' : 'rgba(46,204,113,0.25)';
            ctx.beginPath(); ctx.roundRect(a, y - 10 * m, b - a, 20 * m, 8 * m); ctx.fill();
            if (blizko) { ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2.5; ctx.stroke(); }
          });
        }
        z.prekazky.forEach((px, j) => { const x = sx(px, m); if (x > -50 && x < W + 50) prekazka(x, y, m, k.prekazky[j]); });
        // kůň
        const x = sx(k.x, m);
        fazeKone[i] += k.v * dt * 1.05;
        const s = ppm() * m * 2.6 / 110; // kůň je dlouhý asi 2,6 m
        ctx.save(); ctx.translate(x, y + 6 * m); ctx.scale(s, s);
        const sv = k.hrac ? hrac : { barva: souperi[i - 1].barva, hrivaBarva: '#2b1d14', st: { krasa: 4, kondice: 6, rychlost: Math.round(k.vlast.rychlost) } };
        const jezdec = k.hrac ? hrac.jezdec : { triko: souperi[i - 1].dres, helma: souperi[i - 1].dres, vlasy: '#3b2618', kuze: '#f1c9a5', kalhoty: '#fff' };
        nakresliKone(ctx, { ...sv, st: k.hrac ? hrac.st : sv.st }, { t, faze: fazeKone[i], beh: Math.min(1, k.v / 6), vyska: z.vyskaSkoku(k), zakopnuti: k.zakopnuti > 0 ? Math.sin((k.zakopnuti / 0.9) * Math.PI) : 0, jezdec });
        ctx.restore();
        // jmenovka
        ctx.font = `800 ${Math.round(12 + 4 * m)}px system-ui`; ctx.textAlign = 'center';
        const jm = k.hrac ? `${k.jmeno} (ty)` : k.jmeno;
        const w = ctx.measureText(jm).width + 12;
        ctx.fillStyle = k.hrac ? 'rgba(255,111,168,0.92)' : 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.roundRect(x - w / 2, y - s * 140 - 12, w, 20, 10); ctx.fill();
        ctx.fillStyle = k.hrac ? '#fff' : '#4a3520'; ctx.fillText(jm, x, y - s * 140 + 3);
        // prach při zakopnutí
        if (k.zakopnuti > 0.85 && Math.random() < 0.6) for (let q = 0; q < 4; q++) prach.push({ x: x + 30 * s, y: y + 4, vx: (Math.random() - 0.3) * 60, vy: -Math.random() * 50, z: 0.8 });
      }
      for (const p of prach) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 80 * dt; p.z -= dt; ctx.fillStyle = `rgba(160,120,70,${Math.max(0, p.z) * 0.6})`; ctx.beginPath(); ctx.arc(p.x, p.y, 6 * (1.2 - p.z), 0, Math.PI * 2); ctx.fill(); }
      for (let i = prach.length - 1; i >= 0; i--) if (prach[i].z <= 0) prach.splice(i, 1);
      // létající texty u hráče
      const { y: hy } = draha(0);
      for (const p of popisky) {
        p.z -= dt;
        ctx.globalAlpha = Math.min(1, p.z * 2);
        ctx.font = `900 ${Math.round(H * 0.05)}px system-ui`; ctx.textAlign = 'center';
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.strokeText(p.text, sx(h.x, 1), hy - H * 0.2 - (1.4 - p.z) * 40);
        ctx.fillStyle = p.barva; ctx.fillText(p.text, sx(h.x, 1), hy - H * 0.2 - (1.4 - p.z) * 40);
        ctx.globalAlpha = 1;
      }
      for (let i = popisky.length - 1; i >= 0; i--) if (popisky[i].z <= 0) popisky.splice(i, 1);
    }

    // ---------- smyčka ----------
    let posledni = performance.now(), cas = 0, hotovoUz = false;
    const smycka = (ted) => {
      if (hotovoUz) return;
      const dt = Math.min(0.05, (ted - posledni) / 1000); posledni = ted; cas += dt;
      const pred = Math.ceil(z.odpocet);
      z.krok(dt, { sprint, skok });
      skok = false;
      const h = z.hrac;
      // odpočet
      if (z.odpocet > 0) { const n = Math.ceil(z.odpocet); if (n !== pred || !odpocetText) { odpocetText = String(n); odpocetEl.textContent = n; odpocetEl.classList.remove('bum'); void odpocetEl.offsetWidth; odpocetEl.classList.add('bum'); } }
      else if (odpocetText !== 'Start') { odpocetText = 'Start'; odpocetEl.textContent = 'Start! 🏁'; odpocetEl.classList.remove('bum'); void odpocetEl.offsetWidth; odpocetEl.classList.add('bum', 'pryc'); }
      // nové události hráče
      while (posledniUdalost < h.udalosti.length) {
        const u = h.udalosti[posledniUdalost++];
        if (TEXTY[u.co]) popisky.push({ text: TEXTY[u.co][0], barva: TEXTY[u.co][1], z: 1.4 });
        if (u.co === 'perfekt') zvuk.perfekt(); else if (u.co === 'cisty') zvuk.skok(); else if (u.co === 'naraz' || u.co === 'zavadil') zvuk.naraz(); else if (u.co !== 'naprazdno') zvuk.skok();
      }
      if (z.odpocet <= 0 && h.cil === null && cas - posledniKopyto > 3.2 / Math.max(3, h.v)) { posledniKopyto = cas; if (!z.vzduchem(h)) zvuk.kopyto(); }
      // ukazatele
      silaEl.style.width = `${(100 * h.sila) / h.p.sila}%`;
      silaEl.parentElement.classList.toggle('vycerpany', !!h.vycerpany);
      z.kone.forEach((k, i) => { tecky[i].style.left = `${Math.min(100, (100 * k.x) / z.delka)}%`; });
      const m = z.mistoHrace();
      mistoEl.innerHTML = `<b>${m}.</b> místo`;
      kresli(cas, dt);
      if (z.konec) { hotovoUz = true; setTimeout(konec, 900); return; }
      requestAnimationFrame(smycka);
    };
    setTimeout(() => zvuk.start(), 600);
    requestAnimationFrame(smycka);

    function konec() {
      removeEventListener('keydown', kd); removeEventListener('keyup', ku);
      const misto = z.mistoHrace();
      el.remove();
      hotovo({ misto, poradi: z.poradi.map((k) => ({ jmeno: k.jmeno, hrac: k.hrac, cas: k.cil })), zavod: z });
    }
  });
}
