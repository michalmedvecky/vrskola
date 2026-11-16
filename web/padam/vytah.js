// Pádový výtah: věžák má 7 pater, v každém bydlí jeden pád. Slovo z věty je pasažér a dítě ho veze
// do patra jeho pádu. Ťuknutím na dveře si otázku patra „vyzkouší“ ve větě, druhým ťuknutím jede.
// Nápovědy: úroveň 1 otázky na dveřích svítí, 2 jsou bledé, 3 jsou schované (💡 je rozsvítí, ale pak se úkol nepočítá do postupu).
import { PADY, CISLA_PADU, el, esc, cekej, vetaSOtazkou, nahodny, vyberNeopakuj, odznak, vVe } from './spolecne.js';
import { pradnikSVG } from './pradnici.js';

const PASAZERI = ['🦊', '🐰', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🦔', '🦝', '🐹'];

export const vytah = {
  id: 'vytah',
  nazev: 'Pádový výtah',
  delka: () => 8,

  zacni(ctx) {
    const vety = vyberNeopakuj(ctx.data.vety, (v) => v.veta, ctx.nedavne('vety'), 8);
    return vety.map((v) => {
      const slova = v.kusy.map((k, i) => (k.slovo ? i : -1)).filter((i) => i >= 0);
      // Málo častým pádům (5., 3., 7.) dej přednost, ať se neprocvičuje pořád jen 1. a 4.
      const vahy = slova.map((i) => ({ i, w: { 1: 1, 2: 2, 3: 3, 4: 1.3, 5: 3, 6: 2, 7: 2.5 }[v.kusy[i].pad] }));
      let r = Math.random() * vahy.reduce((s, x) => s + x.w, 0);
      const index = (vahy.find((x) => (r -= x.w) < 0) || vahy[0]).i;
      ctx.pouzito('vety', v.veta);
      return { kusy: v.kusy, index, pasazer: nahodny(PASAZERI) };
    });
  },

  ukol(plocha, ctx, kolo, cislo) {
    return new Promise((hotovo) => {
      const { kusy, index, pasazer } = kolo[cislo];
      const spravne = kusy[index].pad;
      const uroven = ctx.uroven;
      let napoveda = false, chyb = 0, vybrane = null, jede = false;

      const scena = el('div', `vytah uroven-${uroven}`);
      const vez = el('div', 'vez');
      const sachta = el('div', 'sachta');
      const kabina = el('div', 'kabina', `<span class="v-kabine"></span>`);
      sachta.append(kabina);
      const patra = el('div', 'patra');
      const dvere = {};
      for (const c of [...CISLA_PADU].reverse()) {
        const p = PADY[c];
        const d = el('button', 'patro', `
          <span class="cislo" style="--b:${p.barva}">${c}</span>
          <span class="dvere" style="--b:${p.barva}"><span class="kridlo l"></span><span class="kridlo p"></span><span class="obyvatel">${pradnikSVG(c, ctx.bodyPadu(c), { velikost: 46 })}</span></span>
          <span class="otazka-patra">${p.otazka}</span>`);
        d.dataset.pad = c;
        d.onclick = () => klik(c);
        dvere[c] = d;
        patra.append(d);
      }
      const prizemi = el('div', 'prizemi', '<span>🚪 vrátnice</span>');
      vez.append(patra, sachta, prizemi);
      vez.append(el('div', 'strecha'));

      const karta = el('div', 'karta-ukolu');
      const veta = el('div', 'veta');
      const bublina = el('div', 'v-bublina');
      const ovladani = el('div', 'ovladani');
      const jed = el('button', 'tl hlavni jed', 'Jeď ▲');
      jed.disabled = true;
      jed.onclick = () => { if (vybrane) jet(vybrane); };
      const zarovka = el('button', 'tl zarovka', '💡');
      zarovka.title = 'Rozsvítit otázky';
      zarovka.onclick = () => { napoveda = true; scena.classList.add('rozsviceno'); zarovka.disabled = true; ctx.zvuk.klik(); };
      if (uroven === 1) zarovka.hidden = true;
      ovladani.append(zarovka, jed);
      const cekatel = el('div', 'cekatel', `<span class="pasazer">${pasazer}</span><span class="cedulka">${esc(kusy[index].slovo)}</span>`);
      karta.append(cekatel, veta, bublina, ovladani);
      scena.append(vez, karta);
      plocha.replaceChildren(scena);

      const kreslVetu = (otazka) => {
        veta.innerHTML = otazka !== undefined
          ? vetaSOtazkou(kusy, index, otazka)
          : kusy.map((k, i) => (k.text !== undefined ? esc(k.text) : i === index ? `<b class="hledane">${esc(k.slovo)}</b>` : esc(k.slovo))).join('');
      };
      kreslVetu();
      bublina.innerHTML = uroven === 3 ? 'Do kterého patra mě vezeš?' : 'Ťukni na dveře a zkus otázku patra ve větě.';
      ctx.cteni(veta);

      // pozice kabiny: patro 7 nahoře, přízemí dole
      const posun = (c) => {
        const cil = c ? dvere[c] : prizemi;
        kabina.style.transform = `translateY(${cil.offsetTop + cil.offsetHeight / 2 - kabina.offsetHeight / 2}px)`;
      };
      requestAnimationFrame(() => posun(0));
      let kde = 0;

      function klik(c) {
        if (jede) return;
        ctx.zvuk.klik();
        if (uroven === 3 && !napoveda) { jet(c); return; }
        if (vybrane === c) { jet(c); return; }
        vybrane = c;
        Object.values(dvere).forEach((d) => d.classList.toggle('vybrane', Number(d.dataset.pad) === c));
        kreslVetu(c === 5 ? '(📣 volám!)' : `(${PADY[c].otazka})`);
        veta.style.setProperty('--b', PADY[c].barva);
        bublina.innerHTML = c === 5 ? 'Volá někdo to slovo? Pak je to 5. patro.' : 'Dává ta otázka ve větě smysl? Ťukni znovu nebo <b>Jeď</b>.';
        jed.disabled = false;
        jed.textContent = `Jeď do ${c}. ▲`;
      }

      async function jet(c) {
        jede = true;
        jed.disabled = true;
        kabina.querySelector('.v-kabine').textContent = pasazer;
        cekatel.classList.add('nastoupil');
        const delka = 0.25 + Math.abs(c - kde) * 0.16;
        kabina.style.transitionDuration = `${delka}s`;
        posun(c); kde = c;
        await cekej(delka * 1000 + 80);
        ctx.zvuk.ding();
        const d = dvere[c];
        d.classList.add('otevreno');
        if (c === spravne) {
          d.classList.add('dobre');
          d.querySelector('.obyvatel').innerHTML = pradnikSVG(c, ctx.bodyPadu(c), { velikost: 46, radost: true });
          kreslVetu(c === 5 ? '(📣 volám!)' : `(${PADY[c].otazka})`);
          veta.style.setProperty('--b', PADY[c].barva);
          bublina.innerHTML = `${odznak(c)} Správně! <b>${esc(kusy[index].slovo)}</b> bydlí ${vVe(c)} ${c}. patře.`;
          kabina.querySelector('.v-kabine').textContent = '';
          ctx.zvuk.dobre();
          const vysledek = chyb === 0 ? ctx.zaznam({ pad: spravne, ok: true, napoveda }) : {};
          await cekej(vysledek.oslava ? 1900 : 1500);
          hotovo({ ok: chyb === 0 });
          return;
        }
        // špatné patro: obyvatel vykoukne a vyzkouší svou otázku ve větě
        chyb++;
        ctx.zvuk.spatne();
        d.classList.add('spatne');
        if (chyb === 1) ctx.zaznam({ pad: spravne, ok: false, napoveda, chyba: { veta: kusy.map((k) => k.text ?? k.slovo).join(''), slovo: kusy[index].slovo, spravne, zvoleno: c } });
        kreslVetu(c === 5 ? '(📣 volám!)' : `(${PADY[c].otazka})`);
        veta.style.setProperty('--b', PADY[c].barva);
        bublina.innerHTML = c === 5
          ? `${odznak(5)} V 5. patře bydlí jen ti, na které <b>voláme</b>. Tady nikdo nevolá.`
          : `${odznak(c)} Tady se ptáme <b>${PADY[c].otazka}</b> To ve větě nesedí.`;
        await cekej(1700);
        d.classList.remove('otevreno', 'spatne');
        vybrane = null;
        Object.values(dvere).forEach((x) => x.classList.remove('vybrane'));
        jede = false;
        napoveda = true;
        scena.classList.add('rozsviceno');
        zarovka.disabled = true;
        kreslVetu();
        if (chyb >= 2) {
          // podruhé už ukážeme cestu: svítí jen správné dveře
          Object.values(dvere).forEach((x) => { x.disabled = Number(x.dataset.pad) !== spravne; });
          dvere[spravne].classList.add('blika');
          bublina.innerHTML = `Zkus otázku <b>${PADY[spravne].otazka}</b> Svítí ti ${spravne}. patro.`;
        } else {
          bublina.innerHTML = 'Otázky teď svítí. Zkus jiné patro!';
        }
        jed.textContent = 'Jeď ▲';
      }
    });
  },
};
