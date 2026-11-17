// VR režim pro Quest (WebXR, three.js z /three.module.min.js). Hráč stojí uprostřed zoo: před sebou má tabuli
// s hrou a kolem sebe deset výběhů se zvířaty – ohebné druhy (1–5) vlevo, neohebné (6–10) vpravo.
// Když má hráč krmit, objeví se před ním kartička se slovem. Chytí ji spouští (nebo bočním tlačítkem) a hodí
// do výběhu – nebo na výběh jen namíří paprskem a zmáčkne spoušť. Do košíku (vlevo dole) patří slova zvířat,
// která v zoo ještě nejsou.
// Tabule je tatáž stránka jako na tabletu (jako ve Zlomkové výpravě): #app se ve VR rozloží do pevného obdélníku,
// nakreslí se přes SVG foreignObject do canvasu a klik paprskem jde přes document.elementFromPoint na skutečné prvky.
import * as THREE from '../three.module.min.js';
import { akce, poslouchej, stav, nastavVR, krmeni, data } from './hra.js';
import * as postup from './postup.js';

let renderer, scene, camera, clock;
let panel, panelCtx, panelTex, PW = 1200, PH = 800, MER = 1;
const PANEL_SIRKA = 1.6;
let css = '', obrazek = null, kreslim = false, znovu = false, hover = null;
const vybehy = {};            // číslo druhu → { g, zvire, cedule, ctx, tex, stred, aktivni, skok, trepot }
let kos = null, karta = null, kartaCtx = null, kartaTex = null, kartaSlovo = '';
let strazce = null, strazceSpec = null, efekty = [];
let posledni = '', posledniKrm = null, posledniUroven = -1, posledniNauc = '';
const R = 2.4, DOMOV = new THREE.Vector3(0, 1.0, -0.5);

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
  PW = Math.min(820, window.innerWidth); PH = Math.min(window.innerHeight, Math.round(PW / 1.45));
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
  renderer.domElement.style.cssText = 'position:fixed;inset:0;display:none;z-index:10;pointer-events:none';
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8dcf5);
  scene.fog = new THREE.Fog(0xa8dcf5, 20, 60);
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4c7a3a, 1.7));
  const slunce = new THREE.DirectionalLight(0xfff2d0, 1.5); slunce.position.set(3, 6, 2); scene.add(slunce);
  postavZoo();
  postavPanel();
  for (let n = 1; n <= 10; n++) postavVybeh(n);
  postavKos();
  postavKartu();
  postavSkupiny();
  postavOvladace();
  poslouchej(zmenaHry);
  zmenaHry(stav());
}

// ---------- prostředí ----------
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...o });
function postavZoo() {
  const zem = new THREE.Mesh(new THREE.CircleGeometry(60, 64), mat(0x6abf4b));
  zem.rotation.x = -Math.PI / 2; scene.add(zem);
  const cesta = new THREE.Mesh(new THREE.RingGeometry(0.2, 1.4, 48), mat(0xe8d3a0));
  cesta.rotation.x = -Math.PI / 2; cesta.position.y = 0.005; scene.add(cesta);
  const stred = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), mat(0xe8d3a0));
  stred.rotation.x = -Math.PI / 2; stred.position.y = 0.005; scene.add(stred);
  const strom = (x, z, s) => {
    const g = new THREE.Group();
    const kmen = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 1.4 * s, 8), mat(0x8a5a2b));
    kmen.position.y = 0.7 * s; g.add(kmen);
    [[0, 1.8, 0, 0.8], [0.35, 1.5, 0.2, 0.55], [-0.3, 1.55, -0.15, 0.6]].forEach(([a, b, c, r]) => {
      const k = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 1), mat(0x3d9a40, { flatShading: true }));
      k.position.set(a * s, b * s, c * s); g.add(k);
    });
    g.position.set(x, 0, z); scene.add(g);
  };
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + 0.1, r = 5.5 + (i % 3) * 1.6; strom(Math.sin(a) * r, -Math.cos(a) * r, 0.8 + (i % 4) * 0.25); }
  // mraky
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random(), 10, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      b.position.set(k * 1.4, Math.random() * 0.5, Math.random()); m.add(b);
    }
    const a = (i / 9) * Math.PI * 2; m.position.set(Math.cos(a) * 40, 13 + Math.random() * 6, Math.sin(a) * 40); scene.add(m);
  }
}

// Emoji / text do textury (canvas).
function emojiTex(e, vel = 256) {
  const c = document.createElement('canvas'); c.width = c.height = vel;
  const g = c.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${vel * 0.8}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  g.fillText(e, vel / 2, vel * 0.55);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const uhel = (n) => THREE.MathUtils.degToRad(n <= 5 ? -(48 + (n - 1) * 22) : 48 + (n - 6) * 22);

function postavVybeh(n) {
  const d = data().D[n], a = uhel(n);
  const g = new THREE.Group();
  g.position.set(Math.sin(a) * R, 0, -Math.cos(a) * R);
  g.rotation.y = -a;                    // cedulí k hráči
  const barva = new THREE.Color(d.barva);
  const podlaha = new THREE.Mesh(new THREE.CircleGeometry(0.46, 32), mat(barva.clone().lerp(new THREE.Color(0xffffff), 0.55)));
  podlaha.rotation.x = -Math.PI / 2; podlaha.position.y = 0.01; g.add(podlaha);
  // plot: kolíky a dvě lišty
  const drevo = mat(0x9a6b3c);
  for (let i = 0; i < 14; i++) {
    const b = (i / 14) * Math.PI * 2;
    if (Math.abs(Math.sin(b / 2)) < 0.12) continue;      // branka směrem k hráči
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), drevo);
    k.position.set(Math.sin(b) * 0.5, 0.25, Math.cos(b) * 0.5); g.add(k);
  }
  [0.18, 0.42].forEach((y) => {
    const l = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.012, 6, 40, Math.PI * 1.75), drevo);
    l.rotation.x = Math.PI / 2; l.rotation.z = Math.PI / 2 + Math.PI * 0.125; l.position.y = y; g.add(l);
  });
  // zvíře (sprite s emoji)
  const zvire = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(d.ikona), transparent: true }));
  zvire.scale.set(0.62, 0.62, 1); zvire.position.set(0, 0.62, -0.05); g.add(zvire);
  const zamek = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex('🔒', 128), transparent: true, opacity: 0.8 }));
  zamek.scale.set(0.3, 0.3, 1); zamek.position.set(0, 0.45, 0); g.add(zamek);
  // cedule na sloupku
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const cedule = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  cedule.position.set(0, 1.32, -0.46); g.add(cedule);
  const sloup = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.15, 8), drevo);
  sloup.position.set(0, 0.575, -0.48); g.add(sloup);
  // neviditelný válec pro paprsek (celý výběh je cíl)
  const cil = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.6, 12), new THREE.MeshBasicMaterial({ visible: false }));
  cil.position.y = 0.8; cil.userData.druh = n; g.add(cil);
  scene.add(g);
  vybehy[n] = { g, zvire, zamek, cedule, ctx: c.getContext('2d'), tex, cil, n, stred: g.position.clone().setY(0.6), aktivni: false, nauceny: null, skok: 0, trepot: 0, zare: 0 };
}
function nakresliCeduli(v, nauceny, uroven) {
  const d = data().D[v.n], g = v.ctx, W = 512, H = 256;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#fff8e7'; g.strokeStyle = nauceny ? d.barva : '#9aa59a'; g.lineWidth = 16;
  g.beginPath(); g.roundRect(8, 8, W - 16, H - 16, 36); g.fill(); g.stroke();
  g.fillStyle = nauceny ? d.barva : '#9aa59a';
  g.beginPath(); g.arc(70, 72, 44, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = '900 54px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(v.n), 70, 75);
  g.fillStyle = '#4a2c14'; g.textAlign = 'left';
  g.font = `900 ${nauceny ? (d.nazev.length > 12 ? 44 : 54) : 60}px system-ui, sans-serif`;
  g.fillText(nauceny ? d.nazev : '???', 130, 74, W - 150);
  if (nauceny && uroven < 2) {
    g.globalAlpha = uroven === 1 ? 0.35 : 1;
    g.fillStyle = '#fff3c4'; g.beginPath(); g.roundRect(30, 136, W - 60, 92, 24); g.fill();
    g.fillStyle = '#4a2c14'; g.font = '800 40px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(d.otazka, W / 2, 184, W - 80);
    g.globalAlpha = 1;
  } else if (!nauceny) {
    g.font = '700 34px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#7a7a7a';
    g.fillText('zvíře ještě nepřijelo', W / 2, 180);
  }
  v.tex.needsUpdate = true;
}

// Nápisy nad levou a pravou půlkou zoo (ukážou se po lekci v Šatně).
const skupiny = [];
function postavSkupiny() {
  [['👕 OHEBNÉ 1–5', -92], ['🧥 NEOHEBNÉ 6–10', 92]].forEach(([t, u]) => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 160;
    const g = c.getContext('2d'); g.fillStyle = '#8a5a2b'; g.beginPath(); g.roundRect(4, 4, 1016, 152, 40); g.fill();
    g.fillStyle = '#fff8e7'; g.font = '900 96px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 512, 86, 990);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    const a = THREE.MathUtils.degToRad(u);
    m.position.set(Math.sin(a) * (R + 0.9), 2.35, -Math.cos(a) * (R + 0.9)); m.rotation.y = -a;
    m.visible = false; scene.add(m); skupiny.push(m);
  });
}

function postavKos() {
  kos = new THREE.Group();
  const telo = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.28, 20, 1, true), mat(0xb07a45, { side: THREE.DoubleSide }));
  telo.position.y = 0.14; kos.add(telo);
  const dno = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), mat(0x8a5a2b)); dno.rotation.x = -Math.PI / 2; dno.position.y = 0.01; kos.add(dno);
  const ucho = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.014, 6, 24, Math.PI), mat(0x8a5a2b)); ucho.position.y = 0.28; kos.add(ucho);
  const st = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex('🧺', 128), transparent: true })); st.scale.set(0.16, 0.16, 1); st.position.y = 0.48; kos.add(st);
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = '#fff8e7'; g.beginPath(); g.roundRect(4, 4, 504, 120, 30); g.fill();
  g.fillStyle = '#4a2c14'; g.font = '800 44px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('košík: zvíře tu ještě není', 256, 66, 490);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const nap = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.11), new THREE.MeshBasicMaterial({ map: t, transparent: true })); nap.position.set(0, 0.62, 0); kos.add(nap);
  const cil = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.8, 10), new THREE.MeshBasicMaterial({ visible: false }));
  cil.position.y = 0.35; cil.userData.druh = 0; kos.add(cil);
  kos.userData = { cil, stred: new THREE.Vector3(), skok: 0, trepot: 0 };
  kos.position.set(-0.75, 0, -0.75); kos.rotation.y = 0.75;
  kos.userData.stred.copy(kos.position).setY(0.2);
  scene.add(kos);
}

// Kartička se slovem, kterou hráč hází.
function postavKartu() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  kartaCtx = c.getContext('2d');
  kartaTex = new THREE.CanvasTexture(c); kartaTex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: kartaTex });
  karta = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.02), [mat(0xffc93c), mat(0xffc93c), mat(0xffc93c), mat(0xffc93c), m, m]);
  karta.position.copy(DOMOV);
  karta.userData = { stav: 'doma', v: new THREE.Vector3() };
  karta.visible = false;
  scene.add(karta);
}
function nakresliKartu(slovo) {
  const g = kartaCtx;
  g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 160);
  g.strokeStyle = '#ffc93c'; g.lineWidth = 18; g.strokeRect(9, 9, 494, 142);
  g.fillStyle = '#1b4f8a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const vel = slovo.length > 9 ? 70 : 92;
  g.font = `900 ${vel}px system-ui, sans-serif`; g.fillText(slovo, 256, 86, 480);
  kartaTex.needsUpdate = true;
}
function kartuDomu() {
  const u = karta.userData;
  u.stav = 'doma'; u.drzi = null; u.cil = null;
  karta.position.copy(DOMOV); karta.rotation.set(0, 0, 0);
  karta.scale.setScalar(1);
}

// ---------- panel se stránkou (stejně jako ve Zlomkové výpravě) ----------
function postavPanel() {
  const c = document.createElement('canvas'); c.width = Math.round(PW * MER); c.height = Math.round(PH * MER);
  panelCtx = c.getContext('2d');
  panelTex = new THREE.CanvasTexture(c);
  panelTex.colorSpace = THREE.SRGBColorSpace;
  panelTex.anisotropy = 4;
  const vyska = PANEL_SIRKA * PH / PW;
  panel = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_SIRKA, vyska), new THREE.MeshBasicMaterial({ map: panelTex }));
  panel.position.set(0, 1.12 + vyska / 2, -1.35);
  panel.rotation.x = -0.06;
  const ram = new THREE.Mesh(new THREE.BoxGeometry(PANEL_SIRKA + 0.1, vyska + 0.1, 0.05), mat(0x8a5a2b));
  ram.position.z = -0.03; panel.add(ram);
  const noha = new THREE.Mesh(new THREE.BoxGeometry(0.08, panel.position.y, 0.08), ram.material);
  noha.position.set(0, -panel.position.y / 2, -0.06);
  [-0.6, 0.6].forEach((x) => { const n = noha.clone(); n.position.x = x * PANEL_SIRKA; panel.add(n); });
  scene.add(panel);
}
function prekresliStranku() {
  if (kreslim) { znovu = true; return; }
  const app = document.getElementById('app'); if (!app) return;
  kreslim = true;
  const posunute = [app, ...app.querySelectorAll('.zadani-karta, .tahak')].filter((e) => e.scrollTop > 0);
  posunute.forEach((e) => e.setAttribute('data-vrposun', e.scrollTop));
  const klon = app.cloneNode(true);
  posunute.forEach((e) => e.removeAttribute('data-vrposun'));
  klon.querySelectorAll('[data-vrposun]').forEach(posun);
  if (klon.hasAttribute('data-vrposun')) posun(klon);
  const html = new XMLSerializer().serializeToString(klon);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PW * MER}" height="${PH * MER}" viewBox="0 0 ${PW} ${PH}"><foreignObject width="${PW}" height="${PH}"><div xmlns="http://www.w3.org/1999/xhtml" class="vr-koren" style="--vrw:${PW}px;--vrh:${PH}px"><style>${css}</style>${html}</div></foreignObject></svg>`;
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

// ---------- Zmatkář (3D příšera při souboji) ----------
function postavStrazce(s) {
  if (strazce) scene.remove(strazce);
  strazceSpec = s;
  const g = new THREE.Group(), barva = new THREE.Color(s.barva || '#e17055');
  const telo = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 24), new THREE.MeshStandardMaterial({ color: barva, roughness: 0.6 }));
  telo.scale.set(1, 1.15, 0.9); telo.position.y = 0.5; g.add(telo);
  const tmava = barva.clone().multiplyScalar(0.7);
  [-0.17, 0.17].forEach((x) => { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.22), new THREE.MeshStandardMaterial({ color: tmava })); n.position.set(x, 0.11, 0); g.add(n); });
  const oci = Math.max(1, Math.min(4, s.oci || 2)), rohy = Math.max(0, Math.min(4, s.rohy || 0));
  for (let i = 0; i < oci; i++) {
    const x = oci === 1 ? 0 : -0.17 + (i * 0.34) / (oci - 1), vel = oci === 1 ? 0.11 : 0.08;
    const oko = new THREE.Mesh(new THREE.SphereGeometry(vel, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    oko.position.set(x, 0.65, 0.29); g.add(oko);
    const zor = new THREE.Mesh(new THREE.SphereGeometry(vel * 0.5, 12, 8), new THREE.MeshStandardMaterial({ color: 0x2d1b0e }));
    zor.position.set(x, 0.64, 0.29 + vel * 0.7); g.add(zor);
  }
  for (let i = 0; i < rohy; i++) {
    const x = rohy === 1 ? 0 : -0.21 + (i * 0.42) / (rohy - 1);
    const roh = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 12), new THREE.MeshStandardMaterial({ color: 0xfff4d6 }));
    roh.position.set(x, 0.94, 0); roh.rotation.z = -x * 0.8; g.add(roh);
  }
  const pusa = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x5a1a1a }));
  pusa.position.set(0, 0.45, 0.31); pusa.rotation.z = Math.PI; g.add(pusa);
  g.position.set(1.15, 0, -1.45); g.rotation.y = -0.6;
  g.userData = { zasah: 0, smich: 0, porazen: false, telo };
  scene.add(g);
  strazce = g;
}

// ---------- efekty ----------
function banan(cil) {
  const b = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.022, 8, 16, Math.PI * 0.9), mat(0xffd93b, { emissive: 0x332200 }));
  const start = new THREE.Vector3(0, 1.2, -0.4), konec = cil.clone();
  b.position.copy(start); scene.add(b);
  efekty.push({ typ: 'let', mesh: b, t: 0, delka: 0.6, start, konec, vyska: 0.5, rot: 14, hotovo: () => { if (strazce) strazce.userData.zasah = 0.6; vybuch(konec, 0xffd93b); } });
}
function vybuch(kde, barva, pocet = 26) {
  for (let i = 0; i < pocet; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.016 + Math.random() * 0.02, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(barva).offsetHSL(Math.random() * 0.2 - 0.1, 0, 0) }));
    m.position.copy(kde); scene.add(m);
    efekty.push({ typ: 'jiskra', mesh: m, t: 0, delka: 0.9 + Math.random() * 0.4, v: new THREE.Vector3().randomDirection().multiplyScalar(1 + Math.random() * 1.2).add(new THREE.Vector3(0, 1.2, 0)) });
  }
}
const srdceTex = { t: null };
function srdicka(kde) {
  srdceTex.t = srdceTex.t || emojiTex('❤️', 128);
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: srdceTex.t, transparent: true }));
    s.scale.set(0.12, 0.12, 1); s.position.copy(kde).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.2)); scene.add(s);
    efekty.push({ typ: 'srdce', mesh: s, t: -i * 0.08, delka: 1.4, v: new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.5 + Math.random() * 0.3, 0) });
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
    if (e.typ === 'let') {
      e.mesh.position.lerpVectors(e.start, e.konec, Math.min(1, p)); e.mesh.position.y += Math.sin(Math.min(1, p) * Math.PI) * e.vyska;
      e.mesh.rotation.z += e.rot * dt;
      if (p >= 1) { scene.remove(e.mesh); e.hotovo(); return false; }
      return true;
    }
    e.mesh.position.addScaledVector(e.v, dt);
    if (e.typ === 'jiskra') e.v.y -= 2.5 * dt;
    if (e.typ === 'konfeta') { e.mesh.rotation.x += e.rot * dt; e.mesh.rotation.y += e.rot * dt * 0.7; }
    e.mesh.material.transparent = true;
    e.mesh.material.opacity = Math.max(0, 1 - p * p);
    if (p >= 1) { scene.remove(e.mesh); return false; }
    return true;
  });
}

// ---------- reakce na hru ----------
function zmenaHry(S) {
  prekresliStranku();
  const kr = krmeni();
  const zna = new Set(znamDruhy());
  const uroven = kr ? kr.uroven : 2;
  const klicNauc = [...zna].join(',');
  if (uroven !== posledniUroven || klicNauc !== posledniNauc) {
    posledniUroven = uroven; posledniNauc = klicNauc;
    for (const v of Object.values(vybehy)) nakresliCeduli(v, zna.has(v.n), uroven);
  }
  for (const v of Object.values(vybehy)) {
    const n = zna.has(v.n);
    v.zvire.visible = n; v.zamek.visible = !n;
    v.aktivni = !!kr && kr.moznosti.includes(v.n) && !kr.spatne.includes(v.n);
  }
  const satna = !!(postup.tema('satna').lekce || postup.P.vseOdemceno);
  skupiny.forEach((m) => { m.visible = satna; });
  kos.visible = !!kr?.kos;
  kos.userData.aktivni = !!kr?.kos && !kr.spatne.includes(0);
  // kartička se slovem
  if (kr) {
    if (kr.slovo !== kartaSlovo || !karta.visible) { kartaSlovo = kr.slovo; nakresliKartu(kr.slovo); if (karta.userData.stav !== 'drzi') kartuDomu(); }
    else if (karta.userData.stav === 'leti' && !karta.userData.cil) { /* letí mimo, vrátí se sama */ }
    karta.visible = true;
  } else { karta.visible = false; kartaSlovo = ''; }

  const souboj = (S.obr === 'uloha' && (S.druh === 'strazce' || S.druh === 'zaverecna')) || (S.obr === 'souhrn' && S.souboj);
  const spec = S.obr === 'souhrn' ? S.prev?.strazce : S.strazce;
  if (souboj && spec) { if (spec !== strazceSpec || !strazce) postavStrazce(spec); strazce.visible = true; }
  else if (strazce) strazce.visible = false;

  const klic = `${S.obr}|${S.poradi}|${S.vagon}|${S.stav}|${S.zprava?.typ}|${S.zprava?.text?.length}|${S.zivoty}`;
  if (klic === posledni) return;
  posledni = klic;
  const typ = S.zprava?.typ;
  // reakce zvířete, kterému hráč právě dal slovo
  if (posledniKrm != null && (typ === 'ok' || typ === 'ok-krok' || typ === 'dokonceno' || typ === 'chyba1' || typ === 'chyba')) {
    const v = posledniKrm === 0 ? kos.userData : vybehy[posledniKrm];
    if (v) { if (typ === 'chyba1' || typ === 'chyba') v.trepot = 0.8; else { v.skok = 0.7; srdicka(v.stred || kos.userData.stred); } }
    posledniKrm = null;
    if (typ === 'chyba1' || typ === 'chyba') kartuDomu();
  }
  if (S.obr === 'uloha' && S.stav === 'vyhodnoceno' && typ === 'ok') {
    if (souboj && strazce) banan(new THREE.Vector3().setFromMatrixPosition(strazce.matrixWorld).add(new THREE.Vector3(0, 0.55, 0)));
    else vybuch(new THREE.Vector3(0, 1.4, -1.0), 0x7ee787, 18);
  }
  if (S.obr === 'uloha' && typ === 'chyba' && souboj && strazce) strazce.userData.smich = 1;
  if (S.obr === 'souhrn') {
    if (S.souboj && S.vyhra) { if (strazce) strazce.userData.porazen = true; konfety(); }
    else if (S.vybehZvladnut) konfety();
  } else if (strazce) strazce.userData.porazen = false;
}
// Druhy, které hráč zná (zvířata v otevřených výbězích) – podle postupu, ať jsou výběhy vidět i mimo úlohu.
function znamDruhy() {
  const K = window.__zoo?.K; if (!K) return [];
  const kr = krmeni();
  if (kr) return [...kr.moznosti];
  let i = K.temata.findIndex((t) => !postup.tema(t.id).strazce);
  if (i < 0 || postup.P.vseOdemceno) i = K.temata.length - 1;
  return K.temata.slice(0, i + 1).map((t) => t.druh).filter(Boolean);
}

function nakrm(druh) {
  const kr = krmeni(); if (!kr) return;
  if (druh === 0 ? !kr.kos : !kr.moznosti.includes(druh)) return;
  posledniKrm = druh;
  akce('volba:' + druh);
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
    c.addEventListener('selectstart', () => stisk(i));
    c.addEventListener('selectend', () => pust(i));
    c.addEventListener('squeezestart', () => chyt(i, true));
    c.addEventListener('squeezeend', () => pust(i));
    c.addEventListener('connected', (e) => { ovladace[i].zdroj = e.data; });
    scene.add(c);
    const grip = renderer.xr.getControllerGrip(i);
    const ruka = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), mat(i ? 0x5cc8ff : 0xff9f43, { emissive: i ? 0x103a50 : 0x502a10 }));
    grip.add(ruka); scene.add(grip);
    ovladace.push({ c, grip, paprsek, tecka, zdroj: null, cil: null, stopa: [] });
  }
}
function vibruj(i, sila = 0.4, ms = 25) { ovladace[i]?.zdroj?.gamepad?.hapticActuators?.[0]?.pulse?.(sila, ms); }
const pozice = (o, v = new THREE.Vector3()) => v.setFromMatrixPosition(o.grip.matrixWorld);

// Spoušť: kartu v dosahu (nebo pod paprskem) chytí, na výběh pod paprskem rovnou nakrmí, na tabuli klikne.
function stisk(i) {
  if (chyt(i, false)) return;
  const cil = ovladace[i].cil; if (!cil) return;
  if (cil.typ === 'vybeh') { vibruj(i, 0.5, 30); nakrm(cil.druh); }
  else if (cil.typ === 'panel' && cil.el) {
    vibruj(i, 0.25, 15);
    (cil.el.closest('[data-a]') || cil.el).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
}
function chyt(i, jenBlizko) {
  if (!karta.visible || karta.userData.stav === 'leti') return false;
  const o = ovladace[i], p = pozice(o);
  const blizko = p.distanceTo(karta.position) < 0.22;
  const paprskem = !jenBlizko && o.cil?.typ === 'karta';
  if (!blizko && !paprskem) return false;
  karta.userData.stav = 'drzi'; karta.userData.drzi = i; o.stopa = [];
  vibruj(i, 0.4, 25);
  return true;
}
function pust(i) {
  const u = karta.userData;
  if (u.stav !== 'drzi' || u.drzi !== i) return;
  const st = ovladace[i].stopa;
  const v = new THREE.Vector3();
  if (st.length >= 2) { const a = st[0], b = st[st.length - 1]; v.subVectors(b.p, a.p).divideScalar(Math.max(0.016, b.t - a.t)); }
  hod(v);
}
// Hod: najdi výběh, kterým směrem kartička letí (s pomocí – stačí mířit zhruba), a dolet tam obloukem.
function hod(v) {
  const u = karta.userData, rychlost = v.length();
  u.drzi = null;
  if (rychlost < 0.8) { kartuDomu(); return; }
  const smer = new THREE.Vector2(v.x, v.z).normalize();
  let nej = null, nejUhel = THREE.MathUtils.degToRad(28);
  const kandidati = [...Object.values(vybehy).filter((x) => x.aktivni).map((x) => ({ druh: x.n, stred: x.stred })), ...(kos.visible && kos.userData.aktivni ? [{ druh: 0, stred: kos.userData.stred }] : [])];
  for (const k of kandidati) {
    const d = new THREE.Vector2(k.stred.x - karta.position.x, k.stred.z - karta.position.z).normalize();
    const a = Math.acos(THREE.MathUtils.clamp(d.dot(smer), -1, 1));
    if (a < nejUhel) { nejUhel = a; nej = k; }
  }
  u.stav = 'leti'; u.cil = nej; u.v.copy(v);
  if (nej) {
    const start = karta.position.clone(), konec = nej.stred.clone();
    const delka = THREE.MathUtils.clamp(start.distanceTo(konec) / Math.max(3, rychlost), 0.35, 1.1);
    efekty.push({ typ: 'let', mesh: karta, t: 0, delka, start, konec, vyska: 0.4, rot: 0, hotovo: () => { scene.add(karta); karta.scale.setScalar(1); u.stav = 'doma'; karta.visible = false; nakrm(nej.druh); if (krmeni()) { karta.visible = true; kartuDomu(); } } });
    // efekty 'let' po doletu mesh ze scény odebírají – kartu tam vracíme v hotovo()
  }
}
function posunObsah(el, dy) {
  let s = el; while (s && s.id !== 'app' && !(s.scrollHeight > s.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
  if (!s) return;
  const pred = s.scrollTop; s.scrollTop += dy;
  if (s.scrollTop !== pred) prekresliStranku();
}

const ray = new THREE.Raycaster(), mat4 = new THREE.Matrix4(), v3 = new THREE.Vector3();
function zamer(o) {
  const cile = [panel, ...(karta.visible ? [karta] : []), ...Object.values(vybehy).filter((x) => x.aktivni).map((x) => x.cil), ...(kos.visible ? [kos.userData.cil] : [])];
  const hit = ray.intersectObjects(cile, false)[0];
  o.cil = null; o.tecka.visible = false; o.paprsek.scale.z = 3;
  if (!hit) return null;
  o.paprsek.scale.z = hit.distance; o.tecka.visible = true; o.tecka.position.copy(hit.point);
  if (hit.object === panel) { const el = prvekNaPanelu(hit.uv); o.cil = { typ: 'panel', el }; return el?.closest('[data-a]') || null; }
  if (hit.object === karta) { o.cil = { typ: 'karta' }; return null; }
  o.cil = { typ: 'vybeh', druh: hit.object.userData.druh };
  return null;
}
function snimek() {
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  let noveHover = null;
  const miri = new Set();
  ovladace.forEach((o, i) => {
    mat4.identity().extractRotation(o.c.matrixWorld);
    ray.ray.origin.setFromMatrixPosition(o.c.matrixWorld);
    ray.ray.direction.set(0, 0, -1).applyMatrix4(mat4);
    noveHover = zamer(o) || noveHover;
    if (o.cil?.typ === 'vybeh') miri.add(o.cil.druh);
    const osy = o.zdroj?.gamepad?.axes;
    if (osy && o.cil?.typ === 'panel' && o.cil.el && Math.abs(osy[3] || 0) > 0.3) posunObsah(o.cil.el, (osy[3] || 0) * 14);
    // držená kartička jde s rukou, pamatujeme si stopu pro rychlost hodu
    if (karta.userData.stav === 'drzi' && karta.userData.drzi === i) {
      pozice(o, karta.position); karta.quaternion.setFromRotationMatrix(mat4);
      o.stopa.push({ p: karta.position.clone(), t }); while (o.stopa.length > 6) o.stopa.shift();
    }
  });
  if (noveHover !== hover) { hover = noveHover; slozPanel(); }
  animujZoo(dt, t, miri);
  animujStrazce(dt, t);
  animujEfekty(dt);
  renderer.render(scene, camera);
}
function animujZoo(dt, t, miri = new Set()) {
  for (const v of Object.values(vybehy)) {
    v.skok = Math.max(0, v.skok - dt); v.trepot = Math.max(0, v.trepot - dt);
    const zv = v.zvire;
    zv.position.y = 0.62 + Math.sin(t * 2 + v.n) * 0.025 + Math.abs(Math.sin(v.skok * 12)) * v.skok * 0.5;
    zv.material.rotation = Math.sin(v.trepot * 30) * v.trepot * 0.5;
    const s = v.aktivni ? (miri.has(v.n) ? 0.78 : 0.68) : 0.6;
    zv.scale.x += (s - zv.scale.x) * 0.2; zv.scale.y = zv.scale.x;
    v.cedule.material.opacity = v.aktivni || !karta.visible ? 1 : 0.55;
  }
  const k = kos.userData; k.skok = Math.max(0, k.skok - dt); k.trepot = Math.max(0, k.trepot - dt);
  kos.position.y = Math.abs(Math.sin(k.skok * 12)) * k.skok * 0.2; kos.rotation.z = Math.sin(k.trepot * 30) * k.trepot * 0.3;
  const u = karta.userData;
  if (karta.visible && u.stav === 'doma') { karta.position.y = DOMOV.y + Math.sin(t * 2.2) * 0.02; karta.rotation.y = Math.sin(t * 1.3) * 0.25; }
  if (u.stav === 'leti' && !u.cil) {
    karta.position.addScaledVector(u.v, dt); u.v.y -= 6 * dt; karta.rotation.x += dt * 8;
    if (karta.position.y < 0.05) kartuDomu();
  }
}
function animujStrazce(dt, t) {
  if (!strazce?.visible) return;
  const u = strazce.userData;
  u.zasah = Math.max(0, u.zasah - dt); u.smich = Math.max(0, u.smich - dt);
  if (u.porazen) { strazce.rotation.z = Math.max(-1.3, strazce.rotation.z - dt * 2); strazce.position.y = Math.max(-0.2, strazce.position.y - dt * 0.2); return; }
  strazce.rotation.z = Math.sin(u.zasah * 30) * u.zasah * 0.4;
  strazce.position.y = Math.abs(Math.sin(u.smich * 18)) * u.smich * 0.25;
  u.telo.scale.y = 1.15 + Math.sin(t * 2.5) * 0.03;
  u.telo.material.emissive.setRGB(u.zasah * 1.5, u.zasah * 0.6, 0);
}

// Náhled VR scény bez headsetu (?vrnahled=1): myš = paprsek (klik = spoušť, kolečko = páčka), šipky otáčí pohled.
export async function nahledVR() {
  await priprav();
  renderer.domElement.style.display = 'block';
  let otoceni = 0;
  const nastavKameru = () => { camera.position.set(0, 1.55, 0.6); camera.rotation.set(-0.12, otoceni, 0, 'YXZ'); };
  nastavKameru();
  const mys = new THREE.Vector2(), o = ovladace[0];
  const miri = (e) => {
    mys.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(mys, camera);
    const h = zamer(o);
    if (h !== hover) { hover = h; slozPanel(); }
  };
  addEventListener('click', (e) => { if (e.isTrusted) { e.stopPropagation(); e.preventDefault(); } }, true);
  addEventListener('pointermove', miri);
  addEventListener('pointerdown', (e) => { miri(e); const c = o.cil; if (c?.typ === 'vybeh') nakrm(c.druh); else if (c?.typ === 'panel' && c.el) (c.el.closest('[data-a]') || c.el).dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  addEventListener('wheel', (e) => { miri(e); if (o.cil?.typ === 'panel' && o.cil.el) posunObsah(o.cil.el, e.deltaY); }, { passive: true });
  addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') otoceni += 0.3; if (e.key === 'ArrowRight') otoceni -= 0.3; nastavKameru(); });
  // Testovací háček: hod kartičky do výběhu (simuluje rychlost ruky směrem k výběhu).
  window.__zooVR = {
    scene, camera, vybehy, karta,
    hod: (druh) => {
      const cil = druh === 0 ? kos.userData.stred : vybehy[druh].stred;
      kartuDomu(); karta.userData.stav = 'drzi';
      hod(new THREE.Vector3().subVectors(cil, karta.position).setY(0).normalize().multiplyScalar(4).setY(1.5));
    },
    otoc: (a) => { otoceni = a; nastavKameru(); },
  };
  const smycka = () => {
    const dt = Math.min(0.05, clock.getDelta());
    animujZoo(dt, clock.elapsedTime); animujStrazce(dt, clock.elapsedTime); animujEfekty(dt);
    renderer.render(scene, camera); requestAnimationFrame(smycka);
  };
  smycka();
}
