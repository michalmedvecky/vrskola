// Krátké zvuky ve Web Audio (žádné soubory): správně, chyba, krystal, zásah strážce, vítězství.
let ac = null;
export let ztlumeno = false;
export function nastavZtlumeni(v) { ztlumeno = v; }
function kontext() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export function odemkni() { kontext(); }
function ton(f, kdy, delka, typ = 'sine', hlas = 0.18) {
  const a = kontext(); if (!a || ztlumeno) return;
  const t0 = a.currentTime + kdy, o = a.createOscillator(), g = a.createGain();
  o.type = typ; o.frequency.setValueAtTime(f, t0);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(hlas, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + delka);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + delka + 0.05);
}
export const zvuk = {
  klik: () => ton(880, 0, 0.05, 'triangle', 0.06),
  dobre: () => { ton(660, 0, 0.15); ton(990, 0.09, 0.25); },
  krok: () => ton(740, 0, 0.12, 'triangle', 0.12),
  skoro: () => { ton(520, 0, 0.12, 'triangle'); ton(560, 0.1, 0.12, 'triangle'); },
  spatne: () => { ton(220, 0, 0.25, 'sawtooth', 0.08); ton(180, 0.12, 0.3, 'sawtooth', 0.08); },
  zasah: () => { ton(150, 0, 0.18, 'square', 0.1); ton(90, 0.05, 0.25, 'square', 0.08); },
  vyhra: () => [523, 659, 784, 1047, 1319].forEach((f, i) => ton(f, i * 0.11, 0.35, 'triangle', 0.15)),
  prohra: () => [392, 330, 262].forEach((f, i) => ton(f, i * 0.18, 0.4, 'triangle', 0.12)),
  hvezda: () => { ton(1200, 0, 0.1, 'sine', 0.1); ton(1600, 0.07, 0.2, 'sine', 0.1); },
};
