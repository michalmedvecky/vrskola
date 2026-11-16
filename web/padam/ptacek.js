// Ptáček se ptá: ve větě chybí slovo za předložkou („Jdu bez ___ (pes)“). Ptáček Pípa se zeptá
// předložkou a pádovou otázkou („bez koho? bez čeho?“) a dítě vybere správný tvar slova.
// Učí spojit předložku s otázkou, a tím s pádem (bez → 2., k → 3., pro → 4., o → 6., s → 7.).
// Úroveň 1: Pípa se zeptá sám. 2: dítě vybírá otázku ze 3 barevných. 3: ze 4 bez barev. 💡 jednu špatnou škrtne.
import { PADY, el, esc, cekej, zamichej, vyberNeopakuj, otazkaSPredlozkou, velkym, odznak } from './spolecne.js';

// Předložky, které jdou se dvěma pády: tady je ta druhá možnost nejlepší chyták.
const DRUHY_PAD = { na: [4, 6], o: [4, 6], v: [4, 6], po: [4, 6], za: [4, 7], před: [4, 7], pod: [4, 7], nad: [4, 7], mezi: [4, 7] };

export function ptacekSVG(nalada = '') {
  return `<svg class="pipa ${nalada}" viewBox="0 0 120 100" aria-label="Ptáček Pípa">
    <path d="M10 92 Q60 80 118 90" stroke="#7a5230" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M96 84 q8 -10 18 -8" stroke="#5c9b3a" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g class="telo">
      <path d="M30 56 L8 46 L14 62Z" fill="#2e86c1"/>
      <ellipse cx="56" cy="58" rx="30" ry="24" fill="#3fa9f5"/>
      <ellipse cx="62" cy="66" rx="17" ry="13" fill="#fdf2c4"/>
      <circle cx="78" cy="38" r="18" fill="#3fa9f5"/>
      <path class="zobak" d="M93 38 L108 42 L93 46Z" fill="#f5a623"/>
      <circle cx="83" cy="34" r="5" fill="#fff"/><circle cx="84.5" cy="34.5" r="2.8" fill="#1b2631"/>
      <circle cx="74" cy="44" r="3.5" fill="#ff8fa3" opacity=".7"/>
      <path class="kridlo" d="M40 54 Q54 40 66 58 Q54 70 40 54Z" fill="#2e86c1"/>
      <path d="M50 82 v8 M62 82 v8" stroke="#f5a623" stroke-width="3"/>
    </g>
  </svg>`;
}

export const ptacek = {
  id: 'ptacek',
  nazev: 'Ptáček se ptá',
  delka: () => 8,

  zacni(ctx) {
    const polozky = vyberNeopakuj(ctx.data.ptacek, (p) => p.veta, ctx.nedavne('ptacek'), 8);
    polozky.forEach((p) => ctx.pouzito('ptacek', p.veta));
    return polozky;
  },

  ukol(plocha, ctx, kolo, cislo) {
    return new Promise((hotovo) => {
      const p = kolo[cislo];
      const uroven = ctx.uroven;
      const prep = p.predlozka.zaklad;
      const spravnaOtazka = otazkaSPredlozkou(prep, p.pad);
      let napoveda = false, chyb = 0, zaznamenano = false;

      const scena = el('div', `ptacek-hra uroven-${uroven}`);
      const strom = el('div', 'pipa-misto', ptacekSVG());
      const bublina = el('div', 'p-bublina', '…');
      strom.prepend(bublina);
      const karta = el('div', 'karta-ukolu');
      const veta = el('div', 'veta');
      const pokyn = el('div', 'pokyn');
      const volby = el('div', 'volby');
      const ovladani = el('div', 'ovladani');
      const zarovka = el('button', 'tl zarovka', '💡');
      zarovka.hidden = true;
      ovladani.append(zarovka);
      karta.append(veta, pokyn, volby, ovladani);
      scena.append(strom, karta);
      plocha.replaceChildren(scena);

      const [pred, , po] = p.kusy;
      const kreslVetu = (vlozeno, trida = '') => {
        veta.innerHTML = `${esc(pred.text)}<span class="mezera ${trida}">${vlozeno ? esc(vlozeno) : '&nbsp;?&nbsp;'}</span>${vlozeno ? '' : ` <span class="zaklad">(${esc(p.zaklad)})</span>`}${esc(po?.text || '')}`;
      };
      kreslVetu();
      ctx.cteni(veta, () => p.veta.replace(/\[([^\]]+)\]/, p.zaklad));
      const zapis = (ok, chyba) => {
        if (zaznamenano) return {};
        zaznamenano = true;
        return ctx.zaznam({ pad: p.pad, ok, napoveda, chyba, predlozka: prep });
      };
      const rekni = (html, nalada = '') => {
        bublina.innerHTML = html;
        bublina.classList.remove('vyskoc'); void bublina.offsetWidth; bublina.classList.add('vyskoc');
        strom.querySelector('.pipa').setAttribute('class', `pipa ${nalada}`);
      };

      if (uroven === 1) {
        rekni(`<b>${velkym(spravnaOtazka)}</b>`, 'mluvi');
        vyberTvar();
      } else {
        vyberOtazku();
      }

      function vyberOtazku() {
        rekni(`Jak se mám zeptat? <b>${esc(p.predlozka.psana)} …?</b>`, 'premysli');
        pokyn.innerHTML = 'Vyber Pípovi otázku:';
        const pocet = uroven === 2 ? 3 : 4;
        const jine = zamichej([2, 3, 4, 6, 7].filter((c) => c !== p.pad));
        const druhy = (DRUHY_PAD[prep] || []).filter((c) => c !== p.pad);
        const chytaky = [...druhy, ...jine.filter((c) => !druhy.includes(c))].slice(0, pocet - 1);
        const moznosti = zamichej([p.pad, ...chytaky]);
        volby.replaceChildren();
        volby.className = 'volby otazky';
        for (const c of moznosti) {
          const b = el('button', 'tl volba', esc(velkym(otazkaSPredlozkou(prep, c))));
          if (uroven === 2) b.style.setProperty('--b', PADY[c].barva), b.classList.add('barevna');
          b.dataset.pad = c;
          b.onclick = async () => {
            ctx.zvuk.klik();
            if (c === p.pad) {
              b.classList.add('spravne');
              volby.querySelectorAll('button').forEach((x) => { x.disabled = true; });
              rekni(`<b>${velkym(spravnaOtazka)}</b>`, 'mluvi');
              ctx.zvuk.dobre();
              await cekej(700);
              vyberTvar();
            } else {
              chyb++;
              b.classList.add('spatne', 'zatres');
              b.disabled = true;
              ctx.zvuk.spatne();
              rekni(`${velkym(otazkaSPredlozkou(prep, c))} Tak se s předložkou <b>${esc(p.predlozka.psana)}</b> neptáme.`, 'zmateny');
              zapis(false, { veta: p.veta.replace(/\[|\]/g, ''), slovo: p.veta.match(/\[([^\]]+)\]/)[1], spravne: p.pad, zvoleno: c, krok: 'otázka' });
            }
          };
          volby.append(b);
        }
        zarovka.hidden = false;
        zarovka.disabled = false;
        zarovka.onclick = () => {
          const spatna = [...volby.querySelectorAll('button:not(:disabled)')].filter((x) => Number(x.dataset.pad) !== p.pad);
          if (!spatna.length) return;
          napoveda = true;
          spatna[0].disabled = true;
          spatna[0].classList.add('skrtnuto');
          zarovka.disabled = true;
          ctx.zvuk.klik();
        };
      }

      function vyberTvar() {
        zarovka.hidden = true;
        pokyn.innerHTML = `Odpověz Pípovi. Které slovo patří do mezery?`;
        volby.replaceChildren();
        volby.className = 'volby tvary';
        const spravne = p.veta.match(/\[([^\]]+)\]/)[1];
        for (const t of zamichej([spravne, ...p.spatne])) {
          const b = el('button', 'tl volba', esc(t));
          b.onclick = async () => {
            ctx.zvuk.klik();
            if (t === spravne) {
              volby.querySelectorAll('button').forEach((x) => { x.disabled = true; });
              b.classList.add('spravne');
              kreslVetu(t, 'vyplneno');
              veta.style.setProperty('--b', PADY[p.pad].barva);
              rekni(`${odznak(p.pad)} ${velkym(spravnaOtazka.split('?')[0])}? <b>${esc(t)}</b>! Pípí!`, 'zpiva');
              ctx.zvuk.zpev();
              const v = zapis(chyb === 0);
              await cekej(v.oslava ? 2000 : 1600);
              hotovo({ ok: chyb === 0 });
            } else {
              chyb++;
              b.classList.add('spatne', 'zatres');
              b.disabled = true;
              ctx.zvuk.spatne();
              kreslVetu(t, 'spatne');
              rekni(`${velkym(p.predlozka.psana)} ${esc(t)}? To nezní dobře. Ptám se <b>${spravnaOtazka}</b>`, 'zmateny');
              zapis(false, { veta: p.veta.replace(/\[|\]/g, ''), slovo: spravne, spravne: p.pad, zvoleno: t, krok: 'tvar' });
              await cekej(900);
              if (!volby.querySelector('button.spravne')) kreslVetu();
            }
          };
          volby.append(b);
        }
      }
    });
  },
};
