// Krátké zvuky syntetizované ve WebAudio (žádné soubory), převzato ze Strážců klýčú a doplněno.
let ac = null;
export let ztlumeno = false;
export function nastavZtlumeni(v) { ztlumeno = v; }
function kontext() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function ton(f, start, delka, { typ = 'sine', hlasitost = 0.15, kf = f } = {}) {
  const a = kontext(); if (!a || ztlumeno) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = typ; o.frequency.setValueAtTime(f, a.currentTime + start);
  o.frequency.exponentialRampToValueAtTime(kf, a.currentTime + start + delka);
  g.gain.setValueAtTime(0.0001, a.currentTime + start);
  g.gain.exponentialRampToValueAtTime(hlasitost, a.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + delka);
  o.connect(g).connect(a.destination); o.start(a.currentTime + start); o.stop(a.currentTime + start + delka + 0.05);
}
export const zvuk = {
  klik: () => ton(660, 0, 0.08, { typ: 'triangle', hlasitost: 0.08 }),
  dobre: () => { ton(660, 0, 0.12, { typ: 'triangle' }); ton(990, 0.08, 0.16, { typ: 'triangle' }); },
  spatne: () => ton(220, 0, 0.3, { typ: 'sawtooth', hlasitost: 0.07, kf: 140 }),
  ding: () => { ton(1318, 0, 0.5, { hlasitost: 0.12 }); ton(1046, 0.18, 0.7, { hlasitost: 0.12 }); },
  zpev: () => [1568, 1760, 2093, 1760, 2349].forEach((f, i) => ton(f, i * 0.07, 0.09, { hlasitost: 0.07, kf: f * 1.08 })),
  kouzlo: () => [523, 784, 1047, 1568, 2093].forEach((f, i) => ton(f, i * 0.06, 0.3, { typ: 'sine', hlasitost: 0.08 })),
  zatceni: () => { ton(1200, 0, 0.05, { typ: 'square', hlasitost: 0.05 }); ton(800, 0.07, 0.08, { typ: 'square', hlasitost: 0.05 }); ton(660, 0.2, 0.2, { typ: 'triangle' }); ton(990, 0.3, 0.3, { typ: 'triangle' }); },
  rust: () => [392, 523, 659, 784, 1047].forEach((f, i) => ton(f, i * 0.1, 0.35, { typ: 'triangle', hlasitost: 0.12 })),
  fanfara: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => ton(f, i * 0.14, i === 5 ? 0.7 : 0.2, { typ: 'triangle', hlasitost: 0.14 })),
};
// Předčítání (diktát, anglické věty). Vrací false, když zařízení neumí daný jazyk.
export function umimMluvit(jazyk) {
  if (!('speechSynthesis' in window)) return false;
  const hlasy = speechSynthesis.getVoices();
  if (!hlasy.length) return true; // hlasy se načítají pozdě; zkusíme to
  return hlasy.some((h) => h.lang.replace('_', '-').toLowerCase().startsWith(jazyk.slice(0, 2).toLowerCase()));
}
export function rekni(text, jazyk = 'cs-CZ', rychlost = 0.85) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = jazyk; u.rate = rychlost;
  const hlas = speechSynthesis.getVoices().find((h) => h.lang.replace('_', '-').toLowerCase().startsWith(jazyk.slice(0, 2).toLowerCase()));
  if (hlas) u.voice = hlas;
  speechSynthesis.speak(u);
}
