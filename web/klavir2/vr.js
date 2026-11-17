// VR režim pro Quest 2 (WebXR): 3D klaviatura před hráčem a panel s obsahem (kreslený do canvasu z téhož vm
// jako běžná stránka). Na klávesy se hraje PRSTY (sledování rukou, špička ukazováčku ťuká shora), paličkami
// v rukou, nebo paprskem a spouští. S rukama bez ovladačů funguje paprsek z dlaně a „klik“ sepnutím palce s ukazováčkem.
import * as THREE from '../three.module.min.js';
import { akce, klavesa, poslouchej, render } from './hra.js';
import { ROZSAH } from './cviceni.js';
import { jeCerna, jmenaKlavesy } from './hudba.js';

let renderer, scene, camera, panel, panelCtx, panelTex, kbd;
const klavesy = {};      // midi → { mesh, mat, cerna, label… }
let vm = null, hover = null, oblasti = [], prekreslit = true;
const PW = 1280, PH = 840;          // canvas panelu v px
const PANEL_M = [1.28, 0.84];       // rozměr panelu v metrech
const KLAV_Y = 0.86, KLAV_Z = -0.42;

const BARVY = { zvyr: 0x8fd8ff, ok: 0x5df0a0, chyba: 0xff6b6b, hraje: 0xffd166 };
const BARVY_C = { zvyr: 0x2d7fb0, ok: 0x1f9e58, chyba: 0xb83030, hraje: 0xb08a20 };

export async function spustVR() {
  if (!renderer) postavScenu();
  const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'hand-tracking'] });
  renderer.xr.setReferenceSpaceType('local-floor');
  await renderer.xr.setSession(session);
  renderer.domElement.style.display = 'block';
  session.addEventListener('end', () => { renderer.setAnimationLoop(null); renderer.domElement.style.display = 'none'; });
  renderer.setAnimationLoop(snimek);
  prekreslit = true; render();
}

function postavScenu() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.domElement.style.cssText = 'position:fixed;inset:0;display:none;z-index:10';
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15132a);
  scene.fog = new THREE.Fog(0x15132a, 6, 18);
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 50);
  scene.add(new THREE.HemisphereLight(0xc9c2ff, 0x2a2140, 1.1));
  const sv = new THREE.DirectionalLight(0xffffff, 1.4); sv.position.set(1, 3, 1); scene.add(sv);

  // podlaha s kruhy a „hvězdy“
  const podlaha = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.MeshStandardMaterial({ color: 0x24204a, roughness: 1 }));
  podlaha.rotation.x = -Math.PI / 2; scene.add(podlaha);
  for (let r = 1; r < 12; r += 1.5) {
    const k = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.02, 96), new THREE.MeshBasicMaterial({ color: 0x3b3570 }));
    k.rotation.x = -Math.PI / 2; k.position.y = 0.002; scene.add(k);
  }
  const hv = new THREE.BufferGeometry(), poz = [];
  for (let i = 0; i < 600; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(14 + Math.random() * 4); if (v.y > 0) poz.push(v.x, v.y, v.z); }
  hv.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3));
  scene.add(new THREE.Points(hv, new THREE.PointsMaterial({ color: 0xffffff, size: 0.05 })));

  postavKlaviaturu();
  postavPanel();
  postavOvladace();
  poslouchej((m) => { vm = m; prekreslit = true; });
}

// ---------- klaviatura ----------
function postavKlaviaturu() {
  kbd = new THREE.Group();
  let vyska = KLAV_Y;
  try { vyska = parseFloat(localStorage.getItem('klavir2-vyska')) || KLAV_Y; } catch { /* nevadí */ }
  kbd.position.set(0, vyska, KLAV_Z);
  scene.add(kbd);
  const bile = [];
  for (let m = ROZSAH[0]; m <= ROZSAH[1]; m++) if (!jeCerna(m)) bile.push(m);
  const W = 0.068, D = 0.3 /* klávesy větší než skutečné (23 mm), ať se prstem trefí i při nepřesném sledování rukou */, sirka = bile.length * W;
  // tělo klavíru
  const telo = new THREE.Mesh(new THREE.BoxGeometry(sirka + 0.12, 0.08, D + 0.14), new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.35, metalness: 0.2 }));
  telo.position.set(0, -0.055, -0.03); kbd.add(telo);
  const nohy = new THREE.Mesh(new THREE.BoxGeometry(sirka + 0.1, KLAV_Y - 0.1, 0.06), telo.material);
  nohy.position.set(0, -(KLAV_Y) / 2 - 0.04, -0.12); kbd.add(nohy);
  kbd.userData.nohy = nohy; upravNohy();
  for (let m = ROZSAH[0]; m <= ROZSAH[1]; m++) {
    const c = jeCerna(m);
    let x, geo;
    if (c) { const i = bile.indexOf(m - 1); x = -sirka / 2 + (i + 1) * W; geo = new THREE.BoxGeometry(W * 0.58, 0.03, D * 0.62); }
    else { x = -sirka / 2 + bile.indexOf(m) * W + W / 2; geo = new THREE.BoxGeometry(W - 0.003, 0.022, D); }
    const mat = new THREE.MeshStandardMaterial({ color: c ? 0x111111 : 0xffffff, roughness: 0.4, emissive: c ? 0x000000 : 0x2a2a2a });
    const mesh = new THREE.Mesh(geo, mat);
    const z = c ? -D * 0.19 : 0, y = c ? 0.018 : 0;
    mesh.position.set(x, y, z);
    mesh.userData.m = m;
    kbd.add(mesh);
    // popisek (malý canvas na přední části klávesy)
    const lc = document.createElement('canvas'); lc.width = 128; lc.height = 96;
    const lt = new THREE.CanvasTexture(lc);
    const lp = new THREE.Mesh(new THREE.PlaneGeometry(c ? W * 0.56 : W * 0.9, c ? W * 0.42 : W * 0.68), new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false }));
    lp.rotation.x = -Math.PI / 2;
    lp.position.set(0, (c ? 0.015 : 0.011) + 0.001, c ? D * 0.62 / 2 - W * 0.3 : D / 2 - W * 0.42);
    mesh.add(lp);
    klavesy[m] = { mesh, mat, cerna: c, lc, lt, text: null, zakl: y, pul: c ? 0.015 : 0.011, x, z, hloubka: c ? D * 0.62 : D, sirka: c ? W * 0.58 : W };
  }
}
function kresliKlaviaturu() {
  const kv = vm?.klaviatura; if (!kv) return;
  for (const [mm, k] of Object.entries(klavesy)) {
    const m = +mm, z = kv.znacky[m];
    let barva = k.cerna ? 0x111111 : 0xffffff;
    const stav = kv.hraje.includes(m) || kv.stisknute.includes(m) ? 'hraje' : z?.barva;
    if (stav) barva = (k.cerna ? BARVY_C : BARVY)[stav];
    k.mat.color.setHex(barva);
    k.mesh.position.y = k.zakl - (kv.stisknute.includes(m) ? 0.008 : 0);
    let text = z?.text ?? '';
    if (!text && kv.popisky && !k.cerna) text = jmenaKlavesy(m)[0];
    if (text !== k.text) {
      k.text = text;
      const g = k.lc.getContext('2d'); g.clearRect(0, 0, 128, 96);
      g.fillStyle = k.cerna ? '#fff' : '#222'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `bold ${text.length > 3 ? 44 : 64}px system-ui, sans-serif`; g.fillText(text, 64, 50);
      k.lt.needsUpdate = true;
    }
  }
}

// ---------- panel ----------
function postavPanel() {
  const c = document.createElement('canvas'); c.width = PW; c.height = PH;
  panelCtx = c.getContext('2d');
  panelTex = new THREE.CanvasTexture(c);
  panelTex.colorSpace = THREE.SRGBColorSpace;
  panel = new THREE.Mesh(new THREE.PlaneGeometry(...PANEL_M), new THREE.MeshBasicMaterial({ map: panelTex }));
  panel.position.set(0, 1.42, -0.95);
  panel.rotation.x = -0.12;
  scene.add(panel);
}

function zalom(g, text, max) {
  const slova = String(text).split(' '), radky = []; let r = '';
  for (const s of slova) { const t = r ? r + ' ' + s : s; if (g.measureText(t).width > max && r) { radky.push(r); r = s; } else r = t; }
  if (r) radky.push(r);
  return radky;
}
function obdelnik(g, x, y, w, h, r, barva) { g.fillStyle = barva; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
function tlacitko(g, id, text, x, y, w, h, styl = '', velikost = 30) {
  const hl = hover === id;
  const barvy = { hlavni: '#ffd166', ok: '#3ddc84', chyba: '#ff5c5c', nebezpecne: '#5a2a3a', tlumeno: '#2c2950', '': '#3b3766' };
  const zakl = styl.split(' ').find((s) => barvy[s]) || '';
  obdelnik(g, x, y, w, h, 16, barvy[zakl]);
  if (hl && zakl !== 'tlumeno') { g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.roundRect(x, y, w, h, 16); g.stroke(); }
  g.fillStyle = zakl === 'hlavni' || zakl === 'ok' ? '#1d1600' : zakl === 'tlumeno' ? '#77729a' : '#fff';
  g.font = `bold ${velikost}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  let t = text; while (g.measureText(t).width > w - 16 && t.length > 3) t = t.slice(0, -2);
  g.fillText(t === text ? t : t + '…', x + w / 2, y + h / 2 + 2);
  if (zakl !== 'tlumeno') oblasti.push({ id, x, y, w, h });
}
function radaTlacitek(g, tl, y, h = 70) {
  g.font = 'bold 30px system-ui, sans-serif';
  const sirky = tl.map((t) => Math.max(90, g.measureText(t.text).width + 50));
  let x = (PW - sirky.reduce((a, b) => a + b, 0) - (tl.length - 1) * 18) / 2;
  tl.forEach((t, i) => { tlacitko(g, t.id, t.text, x, y, sirky[i], h, t.styl || ''); x += sirky[i] + 18; });
  return y + h + 18;
}

function kresliPanel() {
  const g = panelCtx; oblasti = [];
  g.textBaseline = 'alphabetic';
  const grad = g.createLinearGradient(0, 0, 0, PH); grad.addColorStop(0, '#2f2b5c'); grad.addColorStop(1, '#1d1b33');
  g.fillStyle = grad; g.fillRect(0, 0, PW, PH);
  if (!vm) { panelTex.needsUpdate = true; return; }
  const L = 50, MAXW = PW - 2 * L;
  g.textAlign = 'left'; g.fillStyle = '#f4f1ff'; g.font = 'bold 40px system-ui, sans-serif';
  g.fillText(zalom(g, vm.nadpis || '', MAXW - 360)[0] || '', L, 62);
  g.textAlign = 'right'; g.fillStyle = '#b7b1d9'; g.font = 'bold 26px system-ui, sans-serif';
  g.fillText(vm.stitek || '', PW - L - 200, 60);
  tlacitko(g, 'vr-konec', 'Opustit VR', PW - L - 180, 22, 180, 52, '', 24);
  // výška klaviatury (každý stojí/sedí jinak a prsty musí na klávesy dosáhnout pohodlně)
  tlacitko(g, 'vr-niz', '▼', PW - L - 180, PH - 70, 80, 52, '', 26);
  tlacitko(g, 'vr-vys', '▲', PW - L - 80, PH - 70, 80, 52, '', 26);
  g.fillStyle = '#b7b1d9'; g.font = 'bold 20px system-ui, sans-serif'; g.textAlign = 'right'; g.fillText('výška klaviatury', PW - L - 190, PH - 36);
  if (vm.pokrok) { obdelnik(g, L, 88, MAXW, 10, 5, '#ffffff22'); obdelnik(g, L, 88, Math.max(10, MAXW * vm.pokrok.hodnota), 10, 5, '#3ddc84'); }
  let y = 130;
  const text = (t, vel, barva = '#f4f1ff', tucne = false, rozestup = 1.3) => {
    g.font = `${tucne ? 'bold ' : ''}${vel}px system-ui, sans-serif`; g.fillStyle = barva; g.textAlign = 'left';
    for (const r of zalom(g, t, MAXW)) { y += vel * rozestup; g.fillText(r, L, y - vel * 0.25); }
    y += 6;
  };
  if (vm.pokrok?.text) text(vm.pokrok.text, 26, '#b7b1d9', true);
  if (vm.zadani) text(vm.zadani, 42, '#fff', true);
  if (vm.napoveda) text(vm.napoveda, 28, '#b7b1d9');
  (vm.odstavce || []).forEach((o) => text(o, vm.seznam ? 28 : 34));
  if (vm.radek) {
    y += 10;
    g.font = 'bold 32px system-ui, sans-serif';
    const w = Math.min(130, (MAXW - (vm.radek.length - 1) * 10) / vm.radek.length);
    let x = (PW - (vm.radek.length * w + (vm.radek.length - 1) * 10)) / 2;
    const barvy = { aktivni: '#5a4a10', ok: '#1f6b45', chyba: '#7a2a2a', oprava: '#1f4f6b', '': '#ffffff18' };
    for (const r of vm.radek) {
      obdelnik(g, x, y, w, 58, 12, barvy[r.stav || '']);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(r.text, x + w / 2, y + 41); x += w + 10;
    }
    y += 76;
  }
  if (vm.moznosti) {
    y += 6;
    const n = vm.moznosti.length, sloupce = n <= 3 ? n : 2, w = (MAXW - (sloupce - 1) * 20) / sloupce;
    vm.moznosti.forEach((m, i) => {
      const sx = L + (i % sloupce) * (w + 20), sy = y + Math.floor(i / sloupce) * 92;
      tlacitko(g, m.stav ? '_' + i : 'odp:' + m.id, m.text, sx, sy, w, 76, m.stav || '', 36);
    });
    y += Math.ceil(n / sloupce) * 92 + 4;
  }
  if (vm.ceka) text('⬇ Odpověz na klaviatuře (prstem, paličkou nebo paprskem)', 28, '#ffd166', true);
  if (vm.zprava) {
    g.font = 'bold 30px system-ui, sans-serif';
    const radky = zalom(g, vm.zprava.text, MAXW - 40);
    obdelnik(g, L, y, MAXW, radky.length * 40 + 26, 14, vm.zprava.typ === 'ok' ? '#3ddc8433' : '#ff5c5c33');
    g.fillStyle = vm.zprava.typ === 'ok' ? '#b6ffd5' : '#ffd0d0'; g.textAlign = 'left';
    radky.forEach((r, i) => g.fillText(r, L + 20, y + 44 + i * 40));
    y += radky.length * 40 + 42;
  }
  if (vm.tlacitka) y = radaTlacitek(g, vm.tlacitka, y + 4);
  if (vm.seznam) {
    const w = (MAXW - 20) / 2, h = 58;
    vm.seznam.forEach((j, i) => {
      const sx = L + (i % 2) * (w + 20), sy = y + Math.floor(i / 2) * (h + 8);
      obdelnik(g, sx, sy, w, h, 12, j.stav === 'aktualni' ? '#4a4170' : '#2a2748');
      g.globalAlpha = j.odemcena ? 1 : 0.45;
      g.fillStyle = '#fff'; g.font = 'bold 22px system-ui, sans-serif'; g.textAlign = 'left';
      let t = `${j.ikona} ${i + 1}. ${j.nazev}`; while (g.measureText(t).width > w - 150) t = t.slice(0, -1);
      g.fillText(t, sx + 12, sy + 28);
      obdelnik(g, sx + 12, sy + 40, w - 160, 8, 4, '#ffffff22');
      obdelnik(g, sx + 12, sy + 40, Math.max(4, (w - 160) * j.hodnota), 8, 4, j.stav === 'slabe' ? '#ffd166' : '#3ddc84');
      g.globalAlpha = 1;
      if (j.odemcena) { tlacitko(g, 'lekce:' + j.id, '📖', sx + w - 136, sy + 6, 60, h - 12, '', 26); tlacitko(g, 'trenink:' + j.id, '🎹', sx + w - 68, sy + 6, 60, h - 12, '', 26); }
    });
    y += Math.ceil(vm.seznam.length / 2) * (h + 8) + 8;
  }
  if (vm.vyber) {
    const sk = {}; vm.vyber.forEach((v) => (sk[v.skupina] ||= []).push(v));
    for (const [n, vv] of Object.entries(sk)) {
      g.fillStyle = '#b7b1d9'; g.font = 'bold 22px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText(n, L, y + 20); y += 28;
      const w = (MAXW - 14 * 6) / 15;
      vv.forEach((v, i) => tlacitko(g, v.id, v.text.replace(' dur', '').replace(' moll', ''), L + i * (w + 6), y, w, 44, '', 22));
      y += 54;
    }
  }
  if (vm.dole) radaTlacitek(g, vm.dole, Math.max(y, PH - 90), 60);
  panelTex.needsUpdate = true;
}

// ---------- ovladače ----------
const ovladace = [];
function postavOvladace() {
  for (let i = 0; i < 2; i++) {
    const c = renderer.xr.getController(i);
    const paprsek = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xffd166 }));
    paprsek.scale.z = 3; c.add(paprsek);
    const tecka = new THREE.Mesh(new THREE.SphereGeometry(0.008), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    tecka.visible = false; scene.add(tecka);
    c.addEventListener('selectstart', () => stiskSpouste(i));
    c.addEventListener('connected', (e) => { ovladace[i].zdroj = e.data; });
    c.addEventListener('disconnected', () => { ovladace[i].zdroj = null; });
    scene.add(c);
    // palička v ruce: násada + kulička, kterou se ťuká do kláves
    const grip = renderer.xr.getControllerGrip(i);
    const palicka = new THREE.Group();
    const nasada = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.16), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
    nasada.rotation.x = -Math.PI / 2 - 0.5; nasada.position.set(0, -0.035, -0.07);
    const kulicka = new THREE.Mesh(new THREE.SphereGeometry(0.016), new THREE.MeshStandardMaterial({ color: i ? 0x5cc8ff : 0xff7eb6, emissive: i ? 0x103a50 : 0x501030 }));
    kulicka.position.set(0, -0.072, -0.14);
    palicka.add(nasada, kulicka); grip.add(palicka); scene.add(grip);
    // ruka (sledování rukou): kuličky na kloubech, špička ukazováčku zvýrazněná – ta hraje
    const ruka = renderer.xr.getHand(i);
    scene.add(ruka);
    const klouby = [];
    const matKloub = new THREE.MeshStandardMaterial({ color: 0xe8e2ff, roughness: 0.6, transparent: true, opacity: 0.85 });
    for (let j = 0; j < 25; j++) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.0055), matKloub); k.visible = false; scene.add(k); klouby.push(k); }
    const spicka = new THREE.Mesh(new THREE.SphereGeometry(0.009), new THREE.MeshStandardMaterial({ color: i ? 0x5cc8ff : 0xff7eb6, emissive: i ? 0x103a50 : 0x501030 }));
    spicka.visible = false; scene.add(spicka);
    ovladace.push({ c, grip, palicka, paprsek, tecka, kulicka, ruka, klouby, spicka, zdroj: null, cil: null, hroty: { prst: { drzi: null, predY: null }, palicka: { drzi: null, predY: null } } });
  }
}
function vibruj(i, sila = 0.4, ms = 25) {
  const h = ovladace[i].zdroj?.gamepad?.hapticActuators?.[0];
  if (h?.pulse) h.pulse(sila, ms);
}
function stiskSpouste(i) {
  const cil = ovladace[i].cil; if (!cil) return;
  if (cil.typ === 'klavesa') { klavesa(cil.m); vibruj(i); }
  else if (cil.typ === 'panel') {
    const o = oblasti.find((r) => cil.x >= r.x && cil.x <= r.x + r.w && cil.y >= r.y && cil.y <= r.y + r.h);
    if (!o) return;
    vibruj(i, 0.25, 15);
    if (o.id === 'vr-konec') renderer.xr.getSession()?.end();
    else if (o.id === 'vr-niz' || o.id === 'vr-vys') posunKlaviaturu(o.id === 'vr-vys' ? 0.03 : -0.03);
    else akce(o.id);
  }
}

const KLOUBY = ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'];
const prstPoz = new THREE.Vector3();
// Rozmístí kuličky na klouby ruky; vrátí světovou polohu špičky ukazováčku, nebo null (ruka se nesleduje).
function poziceRuky(o) {
  const j = o.ruka.joints, spickaJ = j?.['index-finger-tip'];
  const sleduje = !!(spickaJ && spickaJ.visible && o.zdroj?.hand);
  KLOUBY.forEach((n, k) => {
    const kl = j?.[n], mesh = o.klouby[k];
    mesh.visible = sleduje && !!kl?.visible && n !== 'index-finger-tip';
    if (mesh.visible) kl.getWorldPosition(mesh.position);
  });
  o.spicka.visible = sleduje;
  if (!sleduje) return null;
  spickaJ.getWorldPosition(prstPoz);
  o.spicka.position.copy(prstPoz);
  return prstPoz;
}
// Ťuknutí hrotem (prst / palička) shora do klávesy. Hystereze: klávesa se znovu zahraje, až hrot vyjede nad ni.
function tukni(h, svet, polomer, i, haptika) {
  kbd.worldToLocal(lok.copy(svet));
  let zasah = null;
  for (const [m, k] of Object.entries(klavesy)) {
    if (Math.abs(lok.x - k.x) < k.sirka / 2 && Math.abs(lok.z - k.z) < k.hloubka / 2) {
      if (k.cerna) { zasah = { m: +m, k }; break; } // černé leží nad bílými, mají přednost
      if (!zasah) zasah = { m: +m, k };
    }
  }
  const povrch = zasah ? zasah.k.zakl + zasah.k.pul + polomer : null;
  if (h.drzi !== null && (!zasah || zasah.m !== h.drzi || lok.y > povrch + 0.015)) h.drzi = null;
  if (zasah && h.drzi === null && lok.y <= povrch && h.predY !== null && h.predY > povrch - 0.004) {
    h.drzi = zasah.m; klavesa(zasah.m); if (haptika) vibruj(i, 0.6, 30);
  }
  h.predY = zasah ? lok.y : null;
}
// nohy klavíru sahají vždy až na zem
function upravNohy() {
  const n = kbd.userData.nohy, h = kbd.position.y - 0.1;
  n.scale.y = h / (KLAV_Y - 0.1); n.position.y = -h / 2 - 0.04;
}
function posunKlaviaturu(d) {
  kbd.position.y = Math.min(1.3, Math.max(0.55, kbd.position.y + d)); upravNohy();
  try { localStorage.setItem('klavir2-vyska', kbd.position.y.toFixed(2)); } catch { /* nevadí */ }
}

const ray = new THREE.Raycaster(), mat4 = new THREE.Matrix4(), v = new THREE.Vector3(), lok = new THREE.Vector3();
function snimek() {
  const cile = [panel, ...Object.values(klavesy).map((k) => k.mesh)];
  let noveHover = null;
  ovladace.forEach((o, i) => {
    // paprsek
    mat4.identity().extractRotation(o.c.matrixWorld);
    ray.ray.origin.setFromMatrixPosition(o.c.matrixWorld);
    ray.ray.direction.set(0, 0, -1).applyMatrix4(mat4);
    const hit = ray.intersectObjects(cile, false)[0];
    o.cil = null; o.tecka.visible = false; o.paprsek.scale.z = 3;
    if (hit) {
      o.paprsek.scale.z = hit.distance; o.tecka.visible = true; o.tecka.position.copy(hit.point);
      if (hit.object === panel) {
        o.cil = { typ: 'panel', x: hit.uv.x * PW, y: (1 - hit.uv.y) * PH };
        const r = oblasti.find((q) => o.cil.x >= q.x && o.cil.x <= q.x + q.w && o.cil.y >= q.y && o.cil.y <= q.y + q.h);
        if (r) noveHover = r.id;
      } else o.cil = { typ: 'klavesa', m: hit.object.userData.m };
    }
    // ruka: rozmístit klouby, špička ukazováčku hraje
    const prst = poziceRuky(o);
    if (prst) tukni(o.hroty.prst, prst, 0.008, i, false); else o.hroty.prst.predY = null;
    // palička: ťuknutí shora do klávesy (jen když je ovladač v ruce)
    o.palicka.visible = !o.zdroj?.hand; // s rukama bez ovladače palička není
    if (o.grip.visible && !o.zdroj?.hand) { o.kulicka.getWorldPosition(v); tukni(o.hroty.palicka, v, 0.012, i, true); } else o.hroty.palicka.predY = null;
  });
  if (noveHover !== hover) { hover = noveHover; prekreslit = true; }
  if (prekreslit) { prekreslit = false; kresliPanel(); kresliKlaviaturu(); }
  renderer.render(scene, camera);
}

// Náhled VR scény bez headsetu (?vrnahled=1): kamera ve výšce očí, klikání myší jako paprskem. Pro ladění a testy.
export function nahledVR() {
  if (!renderer) postavScenu();
  renderer.domElement.style.display = 'block';
  camera.position.set(0, 1.5, 0.35); camera.lookAt(0, 1.2, -0.8);
  const mys = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', (e) => {
    mys.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(mys, camera);
    const hit = ray.intersectObjects([panel, ...Object.values(klavesy).map((k) => k.mesh)], false)[0];
    if (!hit) return;
    ovladace[0].cil = hit.object === panel ? { typ: 'panel', x: hit.uv.x * PW, y: (1 - hit.uv.y) * PH } : { typ: 'klavesa', m: hit.object.userData.m };
    const puvodni = ovladace[0].cil;
    stiskSpouste(0); ovladace[0].cil = puvodni;
  });
  const smycka = () => { if (prekreslit) { prekreslit = false; kresliPanel(); kresliKlaviaturu(); } renderer.render(scene, camera); requestAnimationFrame(smycka); };
  render(); smycka();
  window.__vr2 = { tukni, kbd, klavesy, THREE }; // pro testy hraní prstem
}
