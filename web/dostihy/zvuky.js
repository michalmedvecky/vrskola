// Krátké zvuky syntetizované ve WebAudio (žádné soubory). Převzato ze Strážců klýčú, přidané mince a dostihy.
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
  krok: () => ton(120 + Math.random() * 40, 0, 0.05, { typ: 'triangle', hlasitost: 0.04, kf: 80 }),
  dobre: () => { ton(660, 0, 0.12, { typ: 'triangle' }); ton(990, 0.08, 0.16, { typ: 'triangle' }); },
  spatne: () => ton(220, 0, 0.3, { typ: 'sawtooth', hlasitost: 0.07, kf: 140 }),
  zamek: () => { ton(1200, 0, 0.05, { typ: 'square', hlasitost: 0.05 }); ton(800, 0.06, 0.08, { typ: 'square', hlasitost: 0.05 }); },
  klic: () => [784, 988, 1175, 1568].forEach((f, i) => ton(f, i * 0.09, 0.25, { typ: 'triangle', hlasitost: 0.12 })),
  fanfara: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => ton(f, i * 0.14, i === 5 ? 0.7 : 0.2, { typ: 'triangle', hlasitost: 0.14 })),
  mince: (n = 1) => { for (let i = 0; i < Math.min(n, 8); i++) { ton(1320, i * 0.11, 0.09, { typ: 'square', hlasitost: 0.04 }); ton(1760, i * 0.11 + 0.05, 0.16, { typ: 'triangle', hlasitost: 0.08 }); } },
  kopyto: () => ton(180 + Math.random() * 60, 0, 0.04, { typ: 'triangle', hlasitost: 0.05, kf: 90 }),
  skok: () => ton(300, 0, 0.25, { typ: 'sine', hlasitost: 0.08, kf: 700 }),
  naraz: () => { ton(110, 0, 0.25, { typ: 'sawtooth', hlasitost: 0.09, kf: 60 }); ton(520, 0.02, 0.08, { typ: 'square', hlasitost: 0.04, kf: 300 }); },
  perfekt: () => [880, 1320].forEach((f, i) => ton(f, i * 0.06, 0.12, { typ: 'triangle', hlasitost: 0.08 })),
  start: () => { [0, 0.6, 1.2].forEach((t) => ton(660, t, 0.18, { typ: 'square', hlasitost: 0.06 })); ton(1320, 1.8, 0.5, { typ: 'square', hlasitost: 0.07 }); },
  nakup: () => [523, 784, 1047].forEach((f, i) => ton(f, i * 0.08, 0.2, { typ: 'triangle', hlasitost: 0.12 })),
  smutne: () => [392, 349, 311].forEach((f, i) => ton(f, i * 0.18, 0.3, { typ: 'triangle', hlasitost: 0.1 })),
};
