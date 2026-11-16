// Proměny jednoho slova: jedno slovo (drak, kočka…) prochází sedmi scénkami příběhu a v každé se promění
// do jiného pádu. Dítě skládá jeho tvary z kartiček. Na konci slovo přibude do sbírky i s celou tabulkou.
// Úroveň 1: scénky jdou popořadě a otázka je v mezeře. 2: popořadě, otázka schovaná (💡).
// 3: scénky přeházené, dítě nejdřív vybere otázku a teprve pak tvar.
import { PADY, CISLA_PADU, el, esc, cekej, zamichej, vyberNeopakuj, velkym, odznak } from './spolecne.js';

const tvaryPadu = (slovo, pad) => slovo.tvary[pad - 1].split('|');

export const promeny = {
  id: 'promeny',
  nazev: 'Proměny jednoho slova',
  delka: () => 7,

  zacni(ctx) {
    const [slovo] = vyberNeopakuj(ctx.data.promeny, (s) => s.slovo, ctx.nedavne('promeny'), 1);
    ctx.pouzito('promeny', slovo.slovo);
    const poradi = ctx.uroven === 3 ? zamichej(CISLA_PADU) : [...CISLA_PADU];
    const karty = zamichej([...new Set(slovo.tvary.map((t) => t.split('|')[0]))]);
    return { slovo, poradi, karty, hotove: {} };
  },

  ukol(plocha, ctx, kolo, cislo) {
    return new Promise((hotovo) => {
      const { slovo, poradi, karty, hotove } = kolo;
      const pad = poradi[cislo];
      const sprava = tvaryPadu(slovo, pad);
      const uroven = ctx.uroven;
      let napoveda = false, chyb = 0, zaznamenano = false;

      const scena = el('div', `promeny-hra uroven-${uroven}`);
      // cestička se sedmi zastávkami (pády); hotové ukazují tvar
      const cesta = el('div', 'cesta');
      for (const c of CISLA_PADU) {
        const z = el('div', `zastavka${hotove[c] ? ' hotova' : ''}${c === pad ? ' tady' : ''}`, `
          <span class="z-cislo" style="--b:${PADY[c].barva}">${c}.</span>
          <span class="z-tvar">${hotove[c] ? esc(hotove[c]) : c === pad ? `<span class="postavicka">${slovo.obrazek}</span>` : '·'}</span>`);
        cesta.append(z);
      }
      const karta = el('div', 'karta-ukolu');
      const nadpis = el('div', 'scena-nadpis', `<span class="velky-obrazek">${slovo.obrazek}</span> <span>Proměna č. ${cislo + 1} ze 7</span>`);
      const veta = el('div', 'veta');
      const pokyn = el('div', 'pokyn');
      const volby = el('div', 'volby');
      const ovladani = el('div', 'ovladani');
      const zarovka = el('button', 'tl zarovka', '💡');
      zarovka.hidden = uroven !== 2;
      zarovka.onclick = () => { napoveda = true; zarovka.disabled = true; kreslVetu(); ctx.zvuk.klik(); };
      ovladani.append(zarovka);
      karta.append(nadpis, veta, pokyn, volby, ovladani);
      scena.append(cesta, karta);
      plocha.replaceChildren(scena);
      veta.style.setProperty('--b', PADY[pad].barva);

      let znamaOtazka = uroven === 1;
      const sablona = slovo.sceny[pad - 1];
      const naZacatku = /^\s*„?_/.test(sablona);
      function kreslVetu(vlozeno, trida = '') {
        const ukazOtazku = znamaOtazka || napoveda;
        const v = vlozeno ? (naZacatku ? velkym(vlozeno) : vlozeno) : null;
        const mezera = v
          ? `<span class="mezera ${trida}">${esc(v)}</span>`
          : `<span class="mezera">${ukazOtazku ? `<small class="otazka-v-mezere">${PADY[pad].otazka}</small>` : '&nbsp;?&nbsp;'}</span>`;
        veta.innerHTML = esc(sablona).replace('_', mezera);
      }
      kreslVetu();
      ctx.cteni(veta, () => sablona.replace('_', naZacatku ? velkym(sprava[0]) : sprava[0]));

      const zapis = (ok, chyba) => {
        if (zaznamenano) return {};
        zaznamenano = true;
        return ctx.zaznam({ pad, ok, napoveda, chyba });
      };

      if (uroven === 3) vyberOtazku(); else vyberTvar();

      function vyberOtazku() {
        pokyn.innerHTML = `Jakou otázkou se ve větě zeptáš na slovo <b>${esc(slovo.slovo)}</b>?`;
        volby.className = 'volby otazky sedm';
        volby.replaceChildren();
        for (const c of CISLA_PADU) {
          const b = el('button', 'tl volba', PADY[c].otazka);
          b.onclick = async () => {
            ctx.zvuk.klik();
            if (c === pad) {
              b.classList.add('spravne');
              volby.querySelectorAll('button').forEach((x) => { x.disabled = true; });
              znamaOtazka = true;
              kreslVetu();
              ctx.zvuk.dobre();
              await cekej(600);
              vyberTvar();
            } else {
              chyb++;
              b.classList.add('spatne', 'zatres');
              b.disabled = true;
              ctx.zvuk.spatne();
              zapis(false, { veta: sablona.replace('_', sprava[0]), slovo: sprava[0], spravne: pad, zvoleno: c, krok: 'otázka' });
              pokyn.innerHTML = c === 5 ? 'Volá tu někdo? Zkus jinou otázku.' : `Zkus to ve větě: <b>${PADY[c].otazka}</b> Sedí to? Zkus jinou.`;
            }
          };
          volby.append(b);
        }
      }

      function vyberTvar() {
        pokyn.innerHTML = `Jak se <b>${esc(slovo.slovo)}</b> promění?`;
        volby.className = 'volby tvary';
        volby.replaceChildren();
        for (const t of karty) {
          const b = el('button', 'tl volba', esc(t));
          b.onclick = async () => {
            ctx.zvuk.klik();
            if (sprava.includes(t)) {
              volby.querySelectorAll('button').forEach((x) => { x.disabled = true; });
              b.classList.add('spravne');
              kreslVetu(t, 'vyplneno');
              hotove[pad] = t;
              pokyn.innerHTML = `${odznak(pad, true)} Proměna se povedla!`;
              ctx.zvuk.kouzlo();
              const v = zapis(chyb === 0);
              await cekej(v.oslava ? 1900 : 1400);
              hotovo({ ok: chyb === 0 });
            } else {
              chyb++;
              b.classList.add('spatne', 'zatres');
              b.disabled = true;
              ctx.zvuk.spatne();
              kreslVetu(t, 'spatne');
              zapis(false, { veta: sablona.replace('_', sprava[0]), slovo: sprava[0], spravne: pad, zvoleno: t, krok: 'tvar' });
              znamaOtazka = true;
              pokyn.innerHTML = `Tohle kouzlo nefungovalo. Zeptej se: <b>${PADY[pad].otazka}</b>`;
              await cekej(900);
              if (!volby.querySelector('.spravne')) kreslVetu();
              if (chyb >= 2) volby.querySelectorAll('button').forEach((x) => { if (sprava.includes(x.textContent)) x.classList.add('blika'); });
            }
          };
          volby.append(b);
        }
      }
    });
  },

  // Po dokončení: slovo do sbírky a jeho celá tabulka.
  konec(ctx, kolo) {
    const { slovo } = kolo;
    ctx.stav.sbirka[slovo.slovo] = (ctx.stav.sbirka[slovo.slovo] || 0) + 1;
    return `<div class="tabulka-promen"><div class="tp-obrazek">${slovo.obrazek}</div>${tabulkaTvaru(slovo)}</div>`;
  },
};

export function tabulkaTvaru(slovo) {
  return `<table class="tvary-tab">${CISLA_PADU.map((c) => `<tr><td>${odznak(c)}</td><td class="tt-ot">${PADY[c].otazka}</td><td><b>${esc(slovo.tvary[c - 1].replace('|', ' / '))}</b></td></tr>`).join('')}</table>`;
}
