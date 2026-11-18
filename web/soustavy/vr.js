// VR režim pro Quest (WebXR, three.js z /three.module.min.js). Hráč stojí na horské louce pod Dvojvrchem, před sebou
// má velký panel s hrou a na pultu velkou klávesnici, do které se ťuká paličkami (nebo paprskem a spouští).
// Převzato ze Zlomkové výpravy (web/zlomky/vr.js): jiná krajina a klávesy pro čísla (minus, lomítko, další políčko).
// Panel je tatáž stránka jako na tabletu: #app se v režimu VR rozloží do pevného obdélníku, nakreslí se do
// obrázku (SVG foreignObject → canvas → textura) a klik paprskem jde přes document.elementFromPoint na skutečné
// prvky stránky. Ve VR tak funguje všechno, co na tabletu, a nic se nekreslí dvakrát.
// Při souboji stojí vedle panelu strážce jako 3D příšera: správná odpověď = dělová koule do příšery.
import * as THREE from '../three.module.min.js';
import { akce, poslouchej, stav, nastavVR } from './hra.js';
import { zvuk } from './zvuk.js';

let renderer, scene, camera, clock;
let panel, panelCtx, panelTex, PW = 1200, PH = 800, MER = 1;   // rozměr stránky v CSS px, měřítko canvasu
const PANEL_SIRKA = 1.7;                                          // šířka panelu v metrech
let css = '', obrazek = null, kreslim = false, znovu = false, hover = null;
let pult, klavesy = [], strazce = null, strazceSpec = null, efekty = [];
let posledni = '';

// ---------- start / konec ----------
export async function spustVR() {
  await priprav();
  const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
  renderer.xr.setReferenceSpaceType('local-floor');
  await renderer.xr.setSession(session);
  renderer.domElement.style.display = 'block';
  session.addEventListener('end', () => {
    renderer.setAnimationLoop(null); renderer.domElement.style.display = 'none';
    document.body.classList.remove('vr'); nastavVR(false);
  });
  renderer.setAnimationLoop(snimek);
}
export function ukonciVR() { renderer?.xr.getSession()?.end(); }

async function priprav() {
  if (!css) css = await (await fetch('styl.css')).text();
  // Stránka do pevného obdélníku v levém horním rohu okna (elementFromPoint funguje jen ve viewportu).
  PW = Math.min(800, window.innerWidth); PH = Math.min(window.innerHeight, Math.round(PW / 1.45));
  MER = Math.min(2, 2048 / PW);
  document.documentElement.style.setProperty('--vrw', PW + 'px');
  document.documentElement.style.setProperty('--vrh', PH + 'px');
  document.body.classList.add('vr');
  if (!renderer) postavScenu();
  nastavVR(true);
}

function postavScenu() {
  clock = new THREE.Clock();
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  // pointer-events: none, ať elementFromPoint najde stránku pod canvasem
  renderer.domElement.style.cssText = 'position:fixed;inset:0;display:none;z-index:10;pointer-events:none';
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fcfee);
  scene.fog = new THREE.Fog(0x9fcfee, 25, 80);
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4f7a45, 1.6));
  const slunce = new THREE.DirectionalLight(0xfff2d0, 1.6); slunce.position.set(3, 6, 2); scene.add(slunce);
  postavOstrov();
  postavPanel();
  postavPult();
  postavOvladace();
  poslouchej(zmenaHry);
  zmenaHry(stav());
}

// ---------- prostředí ----------
function postavOstrov() {
  const louka = new THREE.Mesh(new THREE.CircleGeometry(70, 64), new THREE.MeshStandardMaterial({ color: 0x6fae5a, roughness: 1 }));
  louka.rotation.x = -Math.PI / 2; louka.position.y = -0.01; scene.add(louka);
  const cesta = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), new THREE.MeshStandardMaterial({ color: 0xc9b38a, roughness: 1 }));
  cesta.rotation.x = -Math.PI / 2; cesta.position.y = 0; scene.add(cesta);
  // hory dokola, dvě nejvyšší vpředu za panelem (Dvojvrch)
  const hora = (x, z, r, v, barva = 0x5f7f8f) => {
    const g = new THREE.Group();
    const h = new THREE.Mesh(new THREE.ConeGeometry(r, v, 7), new THREE.MeshStandardMaterial({ color: barva, flatShading: true, roughness: 1 }));
    h.position.y = v / 2; g.add(h);
    const snih = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, v * 0.32, 7), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }));
    snih.position.y = v - v * 0.16 + 0.02; g.add(snih);
    g.position.set(x, 0, z); scene.add(g);
  };
  hora(-9, -34, 11, 22); hora(9, -36, 12, 25, 0x587988);
  [[-30, -25, 9, 13], [28, -22, 10, 15], [-40, 0, 9, 12], [40, 6, 11, 14], [-28, 28, 9, 11], [24, 32, 10, 12], [0, 42, 12, 13], [-20, -40, 8, 14], [22, -42, 8, 12]]
    .forEach(([x, z, r, v]) => hora(x, z, r, v, 0x6b8c9a));
  const smrk = (x, z, s) => {
    const g = new THREE.Group();
    const kmen = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 0.5 * s, 6), new THREE.MeshStandardMaterial({ color: 0x6b4423 }));
    kmen.position.y = 0.25 * s; g.add(kmen);
    for (let i = 0; i < 3; i++) {
      const k = new THREE.Mesh(new THREE.ConeGeometry((0.7 - i * 0.18) * s, 0.9 * s, 7), new THREE.MeshStandardMaterial({ color: 0x2f6b3a, flatShading: true }));
      k.position.y = (0.75 + i * 0.45) * s; g.add(k);
    }
    g.position.set(x, 0, z); scene.add(g);
  };
  [[-3, -2, 1.3], [3.2, -1.2, 1.1], [-2.6, 2.6, 1.2], [3.4, 2.8, 1], [-5.5, -4, 1.6], [6, -5, 1.5], [-7, 3, 1.4], [7.5, 2, 1.7], [-4.5, 7, 1.3], [5, 7.5, 1.2]]
    .forEach(([x, z, s]) => smrk(x, z, s));
  // stan (tábor) vedle hráče
  const stan = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.1, 4), new THREE.MeshStandardMaterial({ color: 0xe8590c, flatShading: true }));
  stan.position.set(-2.4, 0.55, 0.6); stan.rotation.y = 0.6; scene.add(stan);
  // mraky
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random(), 10, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      b.position.set(k * 1.4, Math.random() * 0.5, Math.random()); m.add(b);
    }
    const a = (i / 9) * Math.PI * 2; m.position.set(Math.cos(a) * 45, 18 + Math.random() * 6, Math.sin(a) * 45); scene.add(m);
  }
}

// ---------- panel se stránkou ----------
function postavPanel() {
  const c = document.createElement('canvas'); c.width = Math.round(PW * MER); c.height = Math.round(PH * MER);
  panelCtx = c.getContext('2d');
  panelTex = new THREE.CanvasTexture(c);
  panelTex.colorSpace = THREE.SRGBColorSpace;
  panelTex.anisotropy = 4;
  const vyska = PANEL_SIRKA * PH / PW;
  panel = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_SIRKA, vyska), new THREE.MeshBasicMaterial({ map: panelTex }));
  panel.position.set(0, 1.0 + vyska / 2 + 0.12, -1.25);
  panel.rotation.x = -0.08;
  // dřevěný rám
  const ram = new THREE.Mesh(new THREE.BoxGeometry(PANEL_SIRKA + 0.1, vyska + 0.1, 0.05), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8 }));
  ram.position.z = -0.03; panel.add(ram);
  const noha = new THREE.Mesh(new THREE.BoxGeometry(0.08, panel.position.y, 0.08), ram.material);
  noha.position.set(0, -panel.position.y / 2, -0.06);
  [-0.6, 0.6].forEach((x) => { const n = noha.clone(); n.position.x = x * PANEL_SIRKA; panel.add(n); });
  scene.add(panel);
}

// Stránku (#app) převede na obrázek: SVG s foreignObject a přibaleným CSS jako data: URL (blob by canvas „zašpinil“).
function prekresliStranku() {
  if (kreslim) { znovu = true; return; }
  const app = document.getElementById('app'); if (!app) return;
  kreslim = true;
  const posunute = [app, ...app.querySelectorAll('.zadani-karta')].filter((e) => e.scrollTop > 0);
  posunute.forEach((e) => e.setAttribute('data-vrposun', e.scrollTop));
  const klon = app.cloneNode(true);
  posunute.forEach((e) => e.removeAttribute('data-vrposun'));
  klon.querySelectorAll('[data-vrposun]').forEach(posun);
  if (klon.hasAttribute('data-vrposun')) posun(klon);
  const html = new XMLSerializer().serializeToString(klon);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PW * MER}" height="${PH * MER}" viewBox="0 0 ${PW} ${PH}"><foreignObject width="${PW}" height="${PH}"><div xmlns="http://www.w3.org/1999/xhtml" class="vr-koren"><style>${css}</style>${html}</div></foreignObject></svg>`;
  const img = new Image();
  img.onload = () => { obrazek = img; kreslim = false; slozPanel(); if (znovu) { znovu = false; prekresliStranku(); } };
  img.onerror = () => { kreslim = false; };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function posun(el) {
  const o = +el.getAttribute('data-vrposun'); el.removeAttribute('data-vrposun');
  const obal = document.createElement('div');
  obal.style.cssText = `transform:translateY(-${o}px);display:flex;flex-direction:column;gap:inherit;flex:1`;
  while (el.firstChild) obal.appendChild(el.firstChild);
  el.appendChild(obal); el.style.overflow = 'hidden';
}
// Obrázek stránky + zvýraznění prvku pod paprskem.
function slozPanel() {
  const g = panelCtx; if (!obrazek) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  g.drawImage(obrazek, 0, 0, g.canvas.width, g.canvas.height);
  if (hover) {
    const r = hover.getBoundingClientRect();
    g.setTransform(MER, 0, 0, MER, 0, 0);
    g.strokeStyle = '#2d7dd2'; g.lineWidth = 4; g.shadowColor = '#fff'; g.shadowBlur = 8;
    g.beginPath(); g.roundRect(r.left - 3, r.top - 3, r.width + 6, r.height + 6, 14); g.stroke();
    g.shadowBlur = 0;
  }
  panelTex.needsUpdate = true;
}
const prvekNaPanelu = (uv) => {
  const el = document.elementFromPoint(uv.x * PW, (1 - uv.y) * PH);
  return el && document.getElementById('app').contains(el) ? el : null;
};

// ---------- 3D klávesnice na pultu ----------
const ROZLOZENI = [['7', '8', '9', '⌫'], ['4', '5', '6', '−'], ['1', '2', '3', '/'], ['0', ',', 'dalsi', 'ok']];
const POPISKY = { dalsi: 'další ▸', ok: 'OK', '⌫': '⌫' };
function postavPult() {
  pult = new THREE.Group();
  pult.position.set(0, 0.92, -0.62);
  pult.rotation.x = 0.35;
  scene.add(pult);
  const deska = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.04, 0.5), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8 }));
  deska.position.y = -0.03; pult.add(deska);
  const noha = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), deska.material);
  noha.position.set(0, -0.45, 0.05); noha.rotation.x = -0.35; pult.add(noha);
  const K = 0.16, M = 0.018;
  ROZLOZENI.forEach((rada, r) => rada.forEach((id, s) => {
    const sirka = K, x = -0.36 + s * (K + M) + K / 2 - 0.006, z = -0.2 + r * (0.095 + 0.012) + 0.0475 - 0.002;
    const c = document.createElement('canvas'); c.width = 256; c.height = 150;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const barva = id === 'ok' ? 0xffc93c : /\d/.test(id) ? 0xffffff : 0xe8eef8;
    const mat = new THREE.MeshStandardMaterial({ color: barva, roughness: 0.6 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sirka, 0.035, 0.095), mat);
    mesh.position.set(x, 0, z);
    const stitek = new THREE.Mesh(new THREE.PlaneGeometry(sirka * 0.9, 0.08), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    stitek.rotation.x = -Math.PI / 2; stitek.position.y = 0.0181; mesh.add(stitek);
    pult.add(mesh);
    const g = c.getContext('2d');
    g.fillStyle = '#4a2c14'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const t = POPISKY[id] || id; g.font = `900 ${t.length > 2 ? 54 : 96}px system-ui, sans-serif`; g.fillText(t, 128, 80);
    tex.needsUpdate = true;
    const k = { id, mesh, mat, barva, x, z, sirka, hloubka: 0.095, aktivni: true, dole: 0 };
    mesh.userData.klavesa = k;
    klavesy.push(k);
  }));
}
function nastavKlavesnici(S) {
  const k = S.obr === 'uloha' && S.stav === 'ceka' ? (S.rezim === 'vysledek' ? S.u.vysledek : S.u.kroky[S.krok]) : null;
  const cisla = k?.typ === 'cisla';
  for (const kl of klavesy) {
    let a = cisla;
    if (kl.id === 'dalsi') a = cisla && k.pole.length > 1;
    kl.aktivni = a;
    kl.mat.color.setHex(a ? kl.barva : 0x8a8f99);
    kl.mat.opacity = a ? 1 : 0.5; kl.mat.transparent = !a;
  }
}
function stiskniKlavesu(kl, i) {
  if (!kl.aktivni) return;
  kl.dole = 0.12;
  vibruj(i, 0.6, 30);
  akce(kl.id === 'ok' ? 'ok' : 'k:' + kl.id);
}

// ---------- strážce (3D příšera) ----------
function postavStrazce(s) {
  if (strazce) scene.remove(strazce);
  strazceSpec = s;
  const g = new THREE.Group(), barva = new THREE.Color(s.barva || '#e17055');
  const telo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), new THREE.MeshStandardMaterial({ color: barva, roughness: 0.6 }));
  telo.scale.set(1, 1.15, 0.9); telo.position.y = 0.55; g.add(telo);
  const tmava = barva.clone().multiplyScalar(0.7);
  [-0.2, 0.2].forEach((x) => { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.25), new THREE.MeshStandardMaterial({ color: tmava })); n.position.set(x, 0.12, 0); g.add(n); });
  const oci = Math.max(1, Math.min(4, s.oci || 2)), rohy = Math.max(0, Math.min(4, s.rohy || 0));
  for (let i = 0; i < oci; i++) {
    const x = oci === 1 ? 0 : -0.2 + (i * 0.4) / (oci - 1), vel = oci === 1 ? 0.13 : 0.09;
    const oko = new THREE.Mesh(new THREE.SphereGeometry(vel, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    oko.position.set(x, 0.72, 0.34); g.add(oko);
    const zor = new THREE.Mesh(new THREE.SphereGeometry(vel * 0.5, 12, 8), new THREE.MeshStandardMaterial({ color: 0x2d1b0e }));
    zor.position.set(x, 0.71, 0.34 + vel * 0.7); zor.name = 'zornicka'; g.add(zor);
  }
  for (let i = 0; i < rohy; i++) {
    const x = rohy === 1 ? 0 : -0.25 + (i * 0.5) / (rohy - 1);
    const roh = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 12), new THREE.MeshStandardMaterial({ color: 0xfff4d6 }));
    roh.position.set(x, 1.05, 0); roh.rotation.z = -x * 0.8; g.add(roh);
  }
  const pusa = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x5a1a1a }));
  pusa.position.set(0, 0.5, 0.37); pusa.rotation.z = Math.PI; g.add(pusa);
  g.position.set(PANEL_SIRKA / 2 + 0.85, 0, -1.6); g.rotation.y = -0.5;
  g.userData = { zasah: 0, smich: 0, porazen: false, telo };
  scene.add(g);
  strazce = g;
}

// ---------- efekty ----------
function koule(cil) {
  const k = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.3 }));
  const start = new THREE.Vector3(0, 1.05, -0.55), konec = cil.clone();
  k.position.copy(start); scene.add(k);
  efekty.push({ typ: 'koule', mesh: k, t: 0, delka: 0.55, start, konec, hotovo: () => { if (strazce) strazce.userData.zasah = 0.6; vybuch(konec, 0xffa94d); } });
}
function vybuch(kde, barva, pocet = 28) {
  for (let i = 0; i < pocet; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.018 + Math.random() * 0.02, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(barva).offsetHSL(Math.random() * 0.2 - 0.1, 0, 0) }));
    m.position.copy(kde); scene.add(m);
    efekty.push({ typ: 'jiskra', mesh: m, t: 0, delka: 0.9 + Math.random() * 0.4, v: new THREE.Vector3().randomDirection().multiplyScalar(1 + Math.random() * 1.5).add(new THREE.Vector3(0, 1.2, 0)) });
  }
}
function krystaly(pocet) {
  for (let i = 0; i < Math.min(12, pocet * 3); i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.03), new THREE.MeshStandardMaterial({ color: 0x7fe3ff, emissive: 0x1b6f8a, metalness: 0.3 }));
    m.position.set((Math.random() - 0.5) * 0.5, 1.0, -0.6); scene.add(m);
    efekty.push({ typ: 'krystal', mesh: m, t: -i * 0.05, delka: 1.2, v: new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3) });
  }
}
function konfety() {
  for (let i = 0; i < 80; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.85, 0.6), side: THREE.DoubleSide }));
    m.position.set((Math.random() - 0.5) * 3, 2.6 + Math.random() * 1.5, -1 + (Math.random() - 0.5) * 2); scene.add(m);
    efekty.push({ typ: 'konfeta', mesh: m, t: 0, delka: 4, v: new THREE.Vector3((Math.random() - 0.5) * 0.3, -0.5 - Math.random() * 0.4, 0), rot: Math.random() * 6 });
  }
}
function animujEfekty(dt) {
  efekty = efekty.filter((e) => {
    e.t += dt;
    if (e.t < 0) return true;
    const p = e.t / e.delka;
    if (e.typ === 'koule') {
      e.mesh.position.lerpVectors(e.start, e.konec, p); e.mesh.position.y += Math.sin(p * Math.PI) * 0.5;
      if (p >= 1) { scene.remove(e.mesh); e.hotovo(); return false; }
      return true;
    }
    e.mesh.position.addScaledVector(e.v, dt);
    if (e.typ !== 'konfeta') e.v.y -= 2.5 * dt;
    else { e.mesh.rotation.x += e.rot * dt; e.mesh.rotation.y += e.rot * dt * 0.7; }
    if (e.typ === 'krystal') e.mesh.rotation.y += dt * 6;
    if (e.mesh.material.transparent !== true) { e.mesh.material.transparent = true; }
    e.mesh.material.opacity = Math.max(0, 1 - p * p);
    if (p >= 1) { scene.remove(e.mesh); return false; }
    return true;
  });
}

// ---------- reakce na hru ----------
function zmenaHry(S) {
  prekresliStranku();
  nastavKlavesnici(S);
  const souboj = (S.obr === 'uloha' && (S.druh === 'strazce' || S.druh === 'zaverecna')) || (S.obr === 'souhrn' && S.souboj);
  const spec = S.obr === 'souhrn' ? S.prev?.strazce : S.strazce;
  if (souboj && spec) { if (spec !== strazceSpec || !strazce) postavStrazce(spec); strazce.visible = true; }
  else if (strazce) strazce.visible = false;
  const klic = `${S.obr}|${S.poradi}|${S.stav}|${S.zprava?.typ}|${S.zivoty}`;
  if (klic === posledni) return;
  posledni = klic;
  if (S.obr === 'uloha' && S.stav === 'vyhodnoceno' && S.zprava?.typ === 'ok') {
    if (souboj && strazce) koule(new THREE.Vector3().setFromMatrixPosition(strazce.matrixWorld).add(new THREE.Vector3(0, 0.6, 0)));
    else { vybuch(new THREE.Vector3(0, 1.3, -0.9), 0x7ee787, 20); krystaly(1); }
  }
  if (S.obr === 'uloha' && S.zprava?.typ === 'chyba' && souboj && strazce) strazce.userData.smich = 1;
  if (S.obr === 'souhrn') {
    if (S.souboj && S.vyhra) { if (strazce) strazce.userData.porazen = true; konfety(); }
    else if (S.ostrovZvladnut) konfety();
  } else if (strazce) strazce.userData.porazen = false;
}

// ---------- ovladače ----------
const ovladace = [];
function postavOvladace() {
  for (let i = 0; i < 2; i++) {
    const c = renderer.xr.getController(i);
    const paprsek = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xffc93c }));
    paprsek.scale.z = 3; c.add(paprsek);
    const tecka = new THREE.Mesh(new THREE.SphereGeometry(0.01), new THREE.MeshBasicMaterial({ color: 0xffc93c }));
    tecka.visible = false; scene.add(tecka);
    c.addEventListener('selectstart', () => stiskSpouste(i));
    c.addEventListener('connected', (e) => { ovladace[i].zdroj = e.data; });
    scene.add(c);
    // palička: násada a kulička, kterou se ťuká do kláves shora
    const grip = renderer.xr.getControllerGrip(i);
    const palicka = new THREE.Group();
    const nasada = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.2), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
    nasada.rotation.x = -Math.PI / 2 - 0.5; nasada.position.set(0, -0.045, -0.09);
    const kulicka = new THREE.Mesh(new THREE.SphereGeometry(0.022), new THREE.MeshStandardMaterial({ color: i ? 0x5cc8ff : 0xff9f43, emissive: i ? 0x103a50 : 0x502a10 }));
    kulicka.position.set(0, -0.09, -0.175);
    palicka.add(nasada, kulicka); grip.add(palicka); scene.add(grip);
    ovladace.push({ c, paprsek, tecka, kulicka, zdroj: null, cil: null, drzi: null, predY: null });
  }
}
function vibruj(i, sila = 0.4, ms = 25) { ovladace[i]?.zdroj?.gamepad?.hapticActuators?.[0]?.pulse?.(sila, ms); }
function stiskSpouste(i) {
  const cil = ovladace[i].cil; if (!cil) return;
  if (cil.typ === 'klavesa') stiskniKlavesu(cil.k, i);
  else if (cil.typ === 'panel' && cil.el) {
    vibruj(i, 0.25, 15);
    const cilovy = cil.el.closest('[data-a]') || cil.el;
    cilovy.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
}
function posunObsah(el, dy) {
  let s = el; while (s && s.id !== 'app' && !(s.scrollHeight > s.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
  if (!s) return;
  const pred = s.scrollTop; s.scrollTop += dy;
  if (s.scrollTop !== pred) prekresliStranku();
}

const ray = new THREE.Raycaster(), mat4 = new THREE.Matrix4(), v = new THREE.Vector3(), lok = new THREE.Vector3();
function zamer(o) {
  const cile = [panel, ...klavesy.map((k) => k.mesh)];
  const hit = ray.intersectObjects(cile, false)[0];
  o.cil = null; o.tecka.visible = false; o.paprsek.scale.z = 3;
  if (!hit) return null;
  o.paprsek.scale.z = hit.distance; o.tecka.visible = true; o.tecka.position.copy(hit.point);
  if (hit.object === panel) { const el = prvekNaPanelu(hit.uv); o.cil = { typ: 'panel', el }; return el?.closest('[data-a]') || null; }
  o.cil = { typ: 'klavesa', k: hit.object.userData.klavesa };
  return null;
}
function snimek() {
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  let noveHover = null;
  ovladace.forEach((o, i) => {
    mat4.identity().extractRotation(o.c.matrixWorld);
    ray.ray.origin.setFromMatrixPosition(o.c.matrixWorld);
    ray.ray.direction.set(0, 0, -1).applyMatrix4(mat4);
    noveHover = zamer(o) || noveHover;
    // páčka nahoru/dolů posouvá obsah panelu (mapa, dlouhé zadání)
    const osy = o.zdroj?.gamepad?.axes;
    if (osy && o.cil?.typ === 'panel' && o.cil.el && Math.abs(osy[3] || 0) > 0.3) posunObsah(o.cil.el, (osy[3] || 0) * 14);
    // palička: ťuknutí shora do klávesy
    o.kulicka.getWorldPosition(v);
    pult.worldToLocal(lok.copy(v));
    const zasah = klavesy.find((k) => Math.abs(lok.x - k.x) < k.sirka / 2 && Math.abs(lok.z - k.z) < k.hloubka / 2);
    const povrch = 0.0175 + 0.02;
    if (o.drzi && (!zasah || zasah !== o.drzi || lok.y > povrch + 0.02)) o.drzi = null;
    if (zasah && !o.drzi && lok.y <= povrch && o.predY !== null && o.predY > povrch - 0.006) { o.drzi = zasah; stiskniKlavesu(zasah, i); }
    o.predY = zasah ? lok.y : null;
  });
  if (noveHover !== hover) { hover = noveHover; slozPanel(); }
  klavesy.forEach((k) => { if (k.dole > 0) k.dole = Math.max(0, k.dole - dt); k.mesh.position.y = -(k.dole > 0 ? 0.012 : 0); });
  animujStrazce(dt, t);
  animujEfekty(dt);
  renderer.render(scene, camera);
}
function animujStrazce(dt, t) {
  if (!strazce?.visible) return;
  const u = strazce.userData;
  u.zasah = Math.max(0, u.zasah - dt); u.smich = Math.max(0, u.smich - dt);
  const telo = u.telo;
  if (u.porazen) { strazce.rotation.z = Math.max(-1.3, strazce.rotation.z - dt * 2); strazce.position.y = Math.max(-0.2, strazce.position.y - dt * 0.2); return; }
  strazce.rotation.z = Math.sin(u.zasah * 30) * u.zasah * 0.4;
  strazce.position.y = Math.abs(Math.sin(u.smich * 18)) * u.smich * 0.25;
  telo.scale.y = 1.15 + Math.sin(t * 2.5) * 0.03;
  telo.material.emissive.setRGB(u.zasah * 1.5, u.zasah * 0.6, 0);
}

// Náhled VR scény bez headsetu (?vrnahled=1): kamera ve výšce očí, myš = paprsek (klik = spoušť, kolečko = páčka).
export async function nahledVR() {
  await priprav();
  renderer.domElement.style.display = 'block';
  camera.position.set(0, 1.55, 0.75); camera.lookAt(0, 1.3, -1.1);
  const mys = new THREE.Vector2(), o = ovladace[0];
  const miri = (e) => {
    mys.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(mys, camera);
    const h = zamer(o);
    if (h !== hover) { hover = h; slozPanel(); }
  };
  // skutečná kliknutí myší na stránku pod scénou zahodit, klikat smí jen „paprsek“ (syntetické události)
  addEventListener('click', (e) => { if (e.isTrusted) { e.stopPropagation(); e.preventDefault(); } }, true);
  addEventListener('pointermove', miri);
  addEventListener('pointerdown', (e) => { miri(e); stiskSpouste(0); });
  addEventListener('wheel', (e) => { miri(e); if (o.cil?.typ === 'panel' && o.cil.el) posunObsah(o.cil.el, e.deltaY); }, { passive: true });
  window.__soustavyVR = { tlacKlavesu: (id) => stiskniKlavesu(klavesy.find((k) => k.id === id), 0), scene, camera };
  const smycka = () => {
    const dt = Math.min(0.05, clock.getDelta());
    klavesy.forEach((k) => { if (k.dole > 0) k.dole = Math.max(0, k.dole - dt); k.mesh.position.y = -(k.dole > 0 ? 0.012 : 0); });
    animujStrazce(dt, clock.elapsedTime); animujEfekty(dt);
    renderer.render(scene, camera); requestAnimationFrame(smycka);
  };
  smycka();
}
