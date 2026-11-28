// VR režim pro Quest (WebXR, three.js z /three.module.min.js). Hráč stojí v hotelové hale u recepce: před sebou má
// velký panel s hrou a na recepčním pultu čtyři velká tlačítka 1–4 (možnosti odpovědi) a zvonek (Další / Pokračovat).
// Do tlačítek a zvonku se ťuká paličkami, nebo se míří paprskem a mačká spoušť. Kolem stojí hosté, které už má
// hráč v albu. Převzato z Dvojvrchu (web/soustavy/vr.js): panel je tatáž stránka jako na tabletu (SVG foreignObject
// → canvas → textura), klik paprskem jde přes document.elementFromPoint na skutečné prvky stránky.
// Při kontrole stojí vedle panelu inspektor jako 3D příšera: správná odpověď = do příšery letí razítko.
import * as THREE from '../three.module.min.js';
import { akce, poslouchej, stav, nastavVR, data } from './hra.js';
import * as postup from './postup.js';
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
  scene.background = new THREE.Color(0x2b1020);
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 100);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a2030, 1.5));
  const lustr = new THREE.PointLight(0xffe2a8, 2.2, 14, 1.2); lustr.position.set(0, 3.2, -0.5); scene.add(lustr);
  const svetlo = new THREE.DirectionalLight(0xfff2d0, 0.8); svetlo.position.set(2, 5, 3); scene.add(svetlo);
  postavHalu();
  postavPanel();
  postavPult();
  postavHosty();
  postavOvladace();
  poslouchej(zmenaHry);
  zmenaHry(stav());
}

// ---------- prostředí: hotelová hala ----------
// Emoji (nebo text) na průhledné textuře – pro hosty, cedulky a čísla dveří.
function textura(text, { w = 256, h = 256, font = 200, barva = '#000', pozadi = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (pozadi) { g.fillStyle = pozadi; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 24); g.fill(); }
  g.fillStyle = barva; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${font}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", system-ui, sans-serif`;
  g.fillText(text, w / 2, h / 2 + font * 0.06);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function postavHalu() {
  // šachovnicová podlaha a červený koberec k recepci
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#e9dcc4' : '#3b2a22'; g.fillRect(x * 32, y * 32, 32, 32); }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(8, 8); tex.colorSpace = THREE.SRGBColorSpace;
  const podlaha = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
  podlaha.rotation.x = -Math.PI / 2; scene.add(podlaha);
  const koberec = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 8), new THREE.MeshStandardMaterial({ color: 0x9b1b30, roughness: 1 }));
  koberec.rotation.x = -Math.PI / 2; koberec.position.set(0, 0.005, 2); scene.add(koberec);
  // stěny s tapetou
  const tapeta = new THREE.MeshStandardMaterial({ color: 0x7b1e3a, roughness: 0.9, side: THREE.BackSide });
  const mistnost = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 16), tapeta);
  mistnost.position.y = 2.98; scene.add(mistnost);
  const lista = new THREE.MeshStandardMaterial({ color: 0xc9a66b, metalness: 0.4, roughness: 0.4 });
  // dveře pokojů po stranách a vzadu
  const dvere = (x, z, rotY, cislo) => {
    const grp = new THREE.Group();
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.08), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.7 }));
    d.position.y = 1.1; grp.add(d);
    const ram = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.35, 0.04), lista); ram.position.set(0, 1.15, -0.03); grp.add(ram);
    const kl = new THREE.Mesh(new THREE.SphereGeometry(0.05), lista); kl.position.set(0.4, 1.05, 0.06); grp.add(kl);
    const ced = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshBasicMaterial({ map: textura(String(cislo), { w: 256, h: 128, font: 90, barva: '#4a2c14', pozadi: '#ffc93c' }), transparent: true }));
    ced.position.set(0, 1.85, 0.05); grp.add(ced);
    grp.position.set(x, 0, z); grp.rotation.y = rotY; scene.add(grp);
  };
  [101, 102, 103, 104].forEach((n, i) => dvere(-7.95, -4.5 + i * 3, Math.PI / 2, n));
  [201, 202, 203, 204].forEach((n, i) => dvere(7.95, -4.5 + i * 3, -Math.PI / 2, n));
  // výtah vzadu za panelem
  const vytah = new THREE.Mesh(new THREE.BoxGeometry(2, 2.6, 0.1), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.25 }));
  vytah.position.set(0, 1.3, -7.9); scene.add(vytah);
  const stit = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.8), new THREE.MeshBasicMaterial({ map: textura('HOTEL KURIÓZUM', { w: 1024, h: 196, font: 110, barva: '#ffe9a8', pozadi: '#2b1020' }), transparent: true }));
  stit.position.set(0, 4.3, -7.85); scene.add(stit);
  // lustr
  const lustr = new THREE.Group();
  lustr.add(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 8, 32), lista));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
    b.position.set(Math.cos(a) * 0.6, 0.06, Math.sin(a) * 0.6); lustr.add(b);
  }
  lustr.rotation.x = Math.PI / 2; lustr.position.set(0, 4.2, -0.5); scene.add(lustr);
  // květiny v květináčích
  [[-2.6, -1.6], [2.6, -1.6], [-2.8, 1.8], [2.8, 1.8]].forEach(([x, z]) => {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0xc0703a }));
    k.position.set(x, 0.2, z); scene.add(k);
    const r = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2f7a3a, flatShading: true }));
    r.position.set(x, 0.72, z); scene.add(r);
  });
}

// Hosté z alba stojí kolem hráče (emoji na plochách otočených k hráči).
let hosteSkupina = null, hosteKlic = '';
function postavHosty() {
  const ids = [...postup.P.album, ...postup.P.tajni];
  const klic = ids.join(',');
  if (klic === hosteKlic) return;
  hosteKlic = klic;
  if (hosteSkupina) scene.remove(hosteSkupina);
  hosteSkupina = new THREE.Group();
  const D = data();
  ids.forEach((id, i) => {
    const h = D.H[id]; if (!h) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), new THREE.MeshBasicMaterial({ map: textura(h.ikona), transparent: true, alphaTest: 0.05 }));
    // dva oblouky: vlevo a vpravo od recepce
    const strana = i % 2 ? 1 : -1, k = Math.floor(i / 2);
    const a = 0.75 + k * 0.2, r = 3 + (k % 3) * 0.7;
    m.position.set(strana * Math.sin(a) * r, 0.5 + (k % 2) * 0.05, -Math.cos(a) * r + 0.4);
    m.userData = { faze: Math.random() * 6, y: m.position.y };
    hosteSkupina.add(m);
  });
  scene.add(hosteSkupina);
}
function animujHosty(t) {
  if (!hosteSkupina) return;
  hosteSkupina.children.forEach((m) => {
    m.lookAt(camera.position.x, m.position.y, camera.position.z);
    m.position.y = m.userData.y + Math.abs(Math.sin(t * 2 + m.userData.faze)) * 0.06 + (m.userData.skok || 0);
    if (m.userData.skok) m.userData.skok = Math.max(0, m.userData.skok - 0.02);
  });
}
function radostHostu() { hosteSkupina?.children.forEach((m) => { m.userData.skok = 0.3 + Math.random() * 0.2; }); }

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
  const ram = new THREE.Mesh(new THREE.BoxGeometry(PANEL_SIRKA + 0.1, vyska + 0.1, 0.05), new THREE.MeshStandardMaterial({ color: 0xc9a66b, metalness: 0.5, roughness: 0.4 }));
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

// ---------- recepční pult: tlačítka 1–4 a zvonek ----------
const ROZLOZENI = ['1', '2', '3', '4', 'zvonek'];
function postavPult() {
  pult = new THREE.Group();
  pult.position.set(0, 0.92, -0.62);
  pult.rotation.x = 0.35;
  scene.add(pult);
  const deska = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.04, 0.42), new THREE.MeshStandardMaterial({ color: 0x5b2a1a, roughness: 0.5 }));
  deska.position.y = -0.03; pult.add(deska);
  const lem = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.46), new THREE.MeshStandardMaterial({ color: 0xc9a66b, metalness: 0.5, roughness: 0.4 }));
  lem.position.y = -0.055; pult.add(lem);
  const noha = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.3), new THREE.MeshStandardMaterial({ color: 0x6b3420, roughness: 0.6 }));
  noha.position.set(0, -0.5, 0.12); noha.rotation.x = -0.35; pult.add(noha);
  ROZLOZENI.forEach((id, s) => {
    const zvonek = id === 'zvonek';
    const sirka = zvonek ? 0.3 : 0.17, hloubka = zvonek ? 0.13 : 0.14;
    const x = zvonek ? 0 : -0.285 + s * 0.19, z = zvonek ? 0.12 : -0.07;
    let mesh, mat, barva;
    if (zvonek) {
      barva = 0xffc93c;
      mat = new THREE.MeshStandardMaterial({ color: barva, metalness: 0.3, roughness: 0.35, emissive: 0x3a2a00 });
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      const podstava = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.015, 24), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
      podstava.position.y = -0.005; mesh.add(podstava);
      const knoflik = new THREE.Mesh(new THREE.SphereGeometry(0.015), mat); knoflik.position.y = 0.075; mesh.add(knoflik);
    } else {
      barva = 0xfff7e6;
      mat = new THREE.MeshStandardMaterial({ color: barva, roughness: 0.6 });
      mesh = new THREE.Mesh(new THREE.BoxGeometry(sirka, 0.035, hloubka), mat);
      const stitek = new THREE.Mesh(new THREE.PlaneGeometry(sirka * 0.8, hloubka * 0.8), new THREE.MeshBasicMaterial({ map: textura(id, { font: 170, barva: '#4a2c14' }), transparent: true }));
      stitek.rotation.x = -Math.PI / 2; stitek.position.y = 0.0181; mesh.add(stitek);
    }
    mesh.position.set(x, 0, z);
    pult.add(mesh);
    const k = { id, mesh, mat, barva, x, z, sirka, hloubka, aktivni: true, dole: 0 };
    mesh.userData.klavesa = k;
    klavesy.push(k);
  });
}
function nastavKlavesnici(S) {
  const n = S.obr === 'uloha' && S.stav === 'ceka' ? S.u.moznosti.length : 0;
  for (const kl of klavesy) {
    let a;
    if (kl.id === 'zvonek') a = !(S.obr === 'uloha' && S.stav === 'ceka');
    else { const m = n ? S.u.moznosti[+kl.id - 1] : null; a = !!m && !S.spatne.includes(m.id); }
    kl.aktivni = a;
    kl.mat.color.setHex(a ? kl.barva : 0x8a8f99);
    kl.mat.opacity = a ? 1 : 0.5; kl.mat.transparent = !a;
  }
}
function stiskniKlavesu(kl, i) {
  if (!kl.aktivni) return;
  kl.dole = 0.12;
  vibruj(i, 0.6, 30);
  const S = stav();
  if (kl.id === 'zvonek') {
    zvuk.hvezda();
    if (S.obr === 'uloha') akce('dalsi');
    else if (S.obr === 'lekce') akce('snimek:1');
    else document.querySelector('#app .tl.hlavni')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return;
  }
  const m = S.u?.moznosti[+kl.id - 1];
  if (m) akce('volba:' + m.id);
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
  const k = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.4 }));
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
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 16), new THREE.MeshStandardMaterial({ color: 0xffc93c, emissive: 0x6b4a00, metalness: 0.8, roughness: 0.3 }));
    m.rotation.x = Math.PI / 2;
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
  postavHosty();
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
    else { vybuch(new THREE.Vector3(0, 1.3, -0.9), 0x7ee787, 20); krystaly(1); radostHostu(); }
  }
  if (S.obr === 'uloha' && S.zprava?.typ === 'chyba' && souboj && strazce) strazce.userData.smich = 1;
  if (S.obr === 'souhrn') {
    if (S.souboj && S.vyhra) { if (strazce) strazce.userData.porazen = true; konfety(); }
    else if (S.patroZvladnuto) konfety();
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
  animujHosty(t);
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
  window.__casyVR = { tlacKlavesu: (id) => stiskniKlavesu(klavesy.find((k) => k.id === id), 0), scene, camera };
  const smycka = () => {
    const dt = Math.min(0.05, clock.getDelta());
    klavesy.forEach((k) => { if (k.dole > 0) k.dole = Math.max(0, k.dole - dt); k.mesh.position.y = -(k.dole > 0 ? 0.012 : 0); });
    animujStrazce(dt, clock.elapsedTime); animujHosty(clock.elapsedTime); animujEfekty(dt);
    renderer.render(scene, camera); requestAnimationFrame(smycka);
  };
  smycka();
}
