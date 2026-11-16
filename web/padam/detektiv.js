// Detektiv: ve větě se schovává zločinec – slovo v hledaném pádu. Dítě vyslýchá podezřelé (podstatná jména ve větě)
// pádovou otázkou: kdo na ni neodpovídá, má alibi. Je to obrácený úkol než výtah: k pádu najít slovo.
// Úroveň 1: v zatykači je pád i otázka. 2: jen pád, otázka pod 💡. 3: jen pád, bez nápovědy.
import { PADY, el, esc, cekej, zamichej, vyberNeopakuj, odznak, vVe } from './spolecne.js';

export const HODNOSTI = [
  { od: 0, nazev: 'čekatel' },
  { od: 8, nazev: 'detektiv' },
  { od: 24, nazev: 'inspektor' },
  { od: 50, nazev: 'vrchní inspektor' },
  { od: 100, nazev: 'slavný detektiv' },
];
export const hodnost = (pripadu) => [...HODNOSTI].reverse().find((h) => pripadu >= h.od).nazev;

export const detektiv = {
  id: 'detektiv',
  nazev: 'Detektiv',
  delka: () => 8,

  zacni(ctx) {
    const vhodne = ctx.data.vety.filter((v) => {
      const pady = v.kusy.filter((k) => k.slovo).map((k) => k.pad);
      return pady.length >= 2 && pady.some((p) => pady.indexOf(p) === pady.lastIndexOf(p));
    });
    const vety = vyberNeopakuj(vhodne, (v) => v.veta, ctx.nedavne('detektiv'), 8);
    return vety.map((v) => {
      ctx.pouzito('detektiv', v.veta);
      const pady = v.kusy.filter((k) => k.slovo).map((k) => k.pad);
      const jedinecne = pady.filter((p) => pady.indexOf(p) === pady.lastIndexOf(p));
      // 1. pád hledej méně často, je nejsnazší
      const kandidati = jedinecne.length > 1 ? jedinecne.filter((p) => p !== 1 || Math.random() < 0.3) : jedinecne;
      return { kusy: v.kusy, hledany: zamichej(kandidati.length ? kandidati : jedinecne)[0] };
    });
  },

  ukol(plocha, ctx, kolo, cislo) {
    return new Promise((hotovo) => {
      const { kusy, hledany } = kolo[cislo];
      const uroven = ctx.uroven;
      let napoveda = false, chyb = 0, hotovoUz = false;

      const scena = el('div', `detektiv-hra uroven-${uroven}`);
      const zatykac = el('div', 'zatykac');
      const kreslZatykac = () => {
        const ukaz = uroven === 1 || napoveda;
        zatykac.innerHTML = `<div class="z-hlava">HLEDÁ SE</div>
          <div class="z-silueta">🦹</div>
          <div class="z-text">slovo ${vVe(hledany)}</div>
          <div class="z-pad" style="--b:${PADY[hledany].barva}">${hledany}. pádě</div>
          <div class="z-otazka">${ukaz ? PADY[hledany].otazka : '<span class="otaznicky">? ? ?</span>'}</div>`;
      };
      kreslZatykac();
      const karta = el('div', 'karta-ukolu');
      const pokyn = el('div', 'pokyn', 'Ťukni na podezřelé slovo a vyslýchej ho otázkou ze zatykače.');
      const veta = el('div', 'veta podezreli');
      const bublina = el('div', 'v-bublina');
      const ovladani = el('div', 'ovladani');
      const zarovka = el('button', 'tl zarovka', '💡');
      zarovka.hidden = uroven !== 2;
      zarovka.onclick = () => { napoveda = true; zarovka.disabled = true; kreslZatykac(); ctx.zvuk.klik(); };
      ovladani.append(zarovka);
      karta.append(pokyn, veta, bublina, ovladani);
      scena.append(zatykac, karta);
      plocha.replaceChildren(scena);
      ctx.cteni(veta);

      kusy.forEach((k, i) => {
        if (k.text !== undefined) { veta.append(document.createTextNode(k.text)); return; }
        const b = el('button', 'podezrely', esc(k.slovo));
        b.onclick = () => vyslech(b, k, i);
        veta.append(b);
      });

      async function vyslech(b, k) {
        if (hotovoUz || b.classList.contains('alibi')) return;
        ctx.zvuk.klik();
        b.classList.add('lupa');
        await cekej(450);
        b.classList.remove('lupa');
        if (k.pad === hledany) {
          hotovoUz = true;
          b.classList.add('dopaden');
          b.innerHTML = `🔒 ${esc(k.slovo)}`;
          bublina.innerHTML = `${odznak(hledany)} Dopaden! <b>${esc(k.slovo)}</b> odpovídá na otázku <b>${PADY[hledany].otazka}</b>`;
          ctx.zvuk.zatceni();
          const v = chyb === 0 ? ctx.zaznam({ pad: hledany, ok: true, napoveda }) : {};
          if (chyb === 0) ctx.stav.pripady = (ctx.stav.pripady || 0) + 1;
          await cekej(v.oslava ? 2000 : 1600);
          hotovo({ ok: chyb === 0 });
          return;
        }
        chyb++;
        ctx.zvuk.spatne();
        b.classList.add('alibi');
        b.style.setProperty('--b', PADY[k.pad].barva);
        b.insertAdjacentHTML('beforeend', `<sup>${k.pad}.</sup>`);
        bublina.innerHTML = k.pad === 5
          ? `Alibi! Na <b>${esc(k.slovo)}</b> někdo volá, to je ${odznak(5)} pád.`
          : `Alibi! Na <b>${esc(k.slovo)}</b> se ptáme <b>${PADY[k.pad].otazka}</b> Je ${vVe(k.pad)} ${odznak(k.pad)} pádě.`;
        if (chyb === 1) {
          ctx.zaznam({ pad: hledany, ok: false, napoveda, chyba: { veta: kusy.map((x) => x.text ?? x.slovo).join(''), slovo: kusy.find((x) => x.pad === hledany).slovo, spravne: hledany, zvoleno: k.pad, krok: 'detektiv' } });
          if (!napoveda) { napoveda = true; zarovka.disabled = true; kreslZatykac(); }
        }
        if (chyb >= 2) veta.querySelectorAll('.podezrely').forEach((x, j) => { if (kusy.filter((y) => y.slovo)[j].pad === hledany) x.classList.add('blika'); });
      }
    });
  },
};
