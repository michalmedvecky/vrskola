// Klavír syntetizovaný ve Web Audio (žádné nahrávky): několik alikvótních tónů s lehkou inharmonicitou,
// úderem kladívka a doznívajícím filtrem. Na Questu hraje do sluchátek headsetu, na tabletu do reproduktoru.
import { frekvence } from './hudba.js';

let ac = null, hlavni = null, dozvuk = null;
export let ztlumeno = false;
export function nastavZtlumeni(v) { ztlumeno = v; }

function kontext() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    hlavni = ac.createDynamicsCompressor();
    hlavni.threshold.value = -14; hlavni.ratio.value = 4;
    const g = ac.createGain(); g.gain.value = 0.9;
    hlavni.connect(g).connect(ac.destination);
    // Jednoduchý dozvuk (krátká zpožděná ozvěna), ať tón není „suchý“.
    dozvuk = ac.createDelay(0.2); dozvuk.delayTime.value = 0.045;
    const zp = ac.createGain(); zp.gain.value = 0.22;
    const filtr = ac.createBiquadFilter(); filtr.type = 'lowpass'; filtr.frequency.value = 2500;
    dozvuk.connect(filtr).connect(zp).connect(hlavni); zp.connect(dozvuk);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
// Zavolat při prvním doteku (iOS a Quest pustí zvuk až po gestu).
export function odemkni() {
  const a = kontext(); if (!a) return;
  const b = a.createBuffer(1, 1, 22050), s = a.createBufferSource();
  s.buffer = b; s.connect(a.destination); s.start(0);
}

const ALIKVOTY = [1, 0.55, 0.32, 0.2, 0.12, 0.08, 0.05];
export function hrajTon(m, kdy = 0, delka = 1.6, sila = 0.8) {
  const a = kontext(); if (!a || ztlumeno) return;
  const t0 = a.currentTime + kdy + 0.01;
  const f = frekvence(m);
  const vys = Math.min(1, Math.max(0, (m - 48) / 48));
  const doznivani = 2.2 - vys * 1.4; // vysoké tóny doznívají rychleji
  const out = a.createGain();
  const filtr = a.createBiquadFilter(); filtr.type = 'lowpass';
  filtr.frequency.setValueAtTime(Math.min(16000, f * 9), t0);
  filtr.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2.2), t0 + 0.6);
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(0.32 * sila, t0 + 0.006);
  out.gain.exponentialRampToValueAtTime(0.14 * sila, t0 + 0.25);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.min(delka, doznivani) + 0.35);
  filtr.connect(out); out.connect(hlavni); out.connect(dozvuk);
  const konec = t0 + Math.min(delka, doznivani) + 0.45;
  ALIKVOTY.forEach((amp, i) => {
    const n = i + 1, fn = f * n * Math.sqrt(1 + 0.0004 * n * n);
    if (fn > 18000) return;
    const o = a.createOscillator(), g = a.createGain();
    o.frequency.value = fn; o.detune.value = (i % 2 ? 2 : -2);
    g.gain.setValueAtTime(amp * (1 - vys * 0.5 * (i > 2)), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + doznivani / (1 + i * 0.6) + 0.1);
    o.connect(g).connect(filtr); o.start(t0); o.stop(konec);
  });
  // úder kladívka: krátký šum přes pásmový filtr
  const delkaSumu = 0.03, buf = a.createBuffer(1, Math.ceil(a.sampleRate * delkaSumu), a.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const sum = a.createBufferSource(); sum.buffer = buf;
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(6000, f * 4); bp.Q.value = 1.2;
  const gs = a.createGain(); gs.gain.value = 0.05 * sila;
  sum.connect(bp).connect(gs).connect(hlavni); sum.start(t0);
}

// Přehrávání sledu tónů / akordů. Každá položka: číslo (MIDI) nebo pole (akord). Vrací délku v sekundách.
let plan = [];
export function zastav() { plan.forEach(clearTimeout); plan = []; }
export function hrajSled(sled, { tempo = 0.42, delka = 1.0, priTonu } = {}) {
  zastav();
  let t = 0;
  sled.forEach((polozka, i) => {
    const tony = Array.isArray(polozka) ? polozka : [polozka];
    const posledni = i === sled.length - 1;
    tony.forEach((m) => hrajTon(m, t, posledni ? 1.8 : delka, tony.length > 1 ? 0.6 : 0.8));
    if (priTonu) plan.push(setTimeout(() => priTonu(tony, i), t * 1000));
    t += Array.isArray(polozka) ? tempo * 2.2 : tempo;
  });
  if (priTonu) plan.push(setTimeout(() => priTonu([], -1), (t + 0.3) * 1000));
  return t;
}

// Krátké znělky
function pip(f, kdy, delka, typ = 'triangle', hl = 0.08) {
  const a = kontext(); if (!a || ztlumeno) return;
  const t0 = a.currentTime + kdy, o = a.createOscillator(), g = a.createGain();
  o.type = typ; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(hl, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + delka);
  o.connect(g).connect(hlavni); o.start(t0); o.stop(t0 + delka + 0.05);
}
export const znelka = {
  dobre: () => { pip(880, 0, 0.12); pip(1320, 0.07, 0.18); },
  spatne: () => { pip(200, 0, 0.25, 'sawtooth', 0.05); },
  hotovo: () => [72, 76, 79, 84].forEach((m, i) => hrajTon(m, i * 0.12, 1.2, 0.6)),
};
