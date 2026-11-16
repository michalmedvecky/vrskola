import { startUI } from './ui.js';
import { start } from './hra.js';

startUI();
start();

// VR (Quest): tlačítko se ukáže jen tam, kde prohlížeč umí immersive-vr. Three.js se načte až po kliknutí.
const tlVR = document.getElementById('vr');
if (navigator.xr?.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => { tlVR.hidden = !ok; }).catch(() => {});
}
tlVR.addEventListener('click', async () => {
  const { spustVR } = await import('./vr.js');
  spustVR();
});
if (new URLSearchParams(location.search).has('vrnahled')) import('./vr.js').then((m) => m.nahledVR());
