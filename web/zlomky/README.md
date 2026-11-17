# Zlomková výprava

Samostatná hra na zlomky pro deváťáky, příprava na přijímačky z matematiky. Adresa po nasazení: `/zlomky/`.
Běží v prohlížeči na PC i tabletu (na telefonu taky, jen je těsnější) a na Questu v plném VR (tlačítko 🥽 Do VR).
Bez serveru, postup jen v `localStorage` (klíč `zlomky-v1`), takže v headsetu má hráč svůj vlastní postup.

## VR (Quest)

Tlačítko **🥽 Do VR** se ukáže jen v prohlížeči, který umí immersive-vr. Hráč stojí na písečném ostrově u moře,
před sebou má velkou tabuli s hrou a na pultu velkou klávesnici (číslice, čárka, celé, ▲ čitatel, ▼ jmenovatel,
⌫, OK). Do kláves se ťuká **paličkami** v rukou shora (vibrace při úderu), nebo se míří **paprskem** a mačká
spoušť. Paprskem se klepe i na tabuli (tlačítka, volby, dílky koláče u „vybarvi“, karty u řazení), **páčkou**
nahoru/dolů se posouvá obsah tabule (mapa, dlouhé zadání). Opustit VR jde tlačítkem v hlavičce tabule.

Při souboji stojí vedle tabule strážce jako 3D příšera: správná odpověď vystřelí dělovou kouli, příšera se
zatřese, po chybě se směje, poražená se svalí. Za správnou odpověď v tréninku vyletí jiskry a krystaly,
za poraženého strážce a zvládnutý ostrov padají konfety.

Jak to funguje: tabule je tatáž stránka jako na tabletu. Ve VR se `#app` rozloží do pevného obdélníku
(`body.vr`), `vr.js` ji po každé změně nakreslí přes SVG `foreignObject` do canvasu (data: URL, ať canvas
nezašpiní) a ten je texturou tabule. Klik paprskem se přepočítá na souřadnice stránky a přes
`document.elementFromPoint` jde na skutečný prvek. Ve VR tedy funguje všechno, co na tabletu, beze změn ve hře.
`?vrnahled=1` ukáže VR scénu na monitoru (myš = paprsek, kolečko = páčka) pro ladění. Na skutečném Questu
zatím nevyzkoušeno.

## Jak hra běží

Mapa s deseti ostrovy, každý ostrov je jedno téma. Na ostrově je **lekce** (pár snímků s obrázky), **trénink**
a **strážce** (vymyšlená příšerka). Další ostrov se otevře, až je strážce poražený.

- **Trénink** běží po kolech po 10 úlohách. Každé téma má několik dovedností (položek). Dovednost je zvládnutá
  po 2–3 úlohách vyřešených napoprvé bez chyby za sebou (kolik, určuje `serie` v JSONu).
- **Kontrola po krocích:** dokud dovednost ještě nemá ani jeden úspěch, počítá se po krocích (společný
  jmenovatel → rozšíření → součet → krácení…), každý krok se zkontroluje hned. Když už to jde, píše se jen
  výsledek. Špatný výsledek přepne úlohu do kroků, aby bylo vidět, kde se to pokazilo. Špatný krok: nápověda
  a druhý pokus, pak se ukáže správně a jde se dál. Úloha s chybou se za 3 úlohy vrátí.
- **Tvar výsledku:** neskrácený zlomek nebo nepravý zlomek tam, kde se chce smíšené číslo, není chyba,
  jen upozornění „ještě zkrať“ (bez trestu). Smíšené číslo jde zadat vždycky (klávesa „celé“).
- **Strážce:** 8 úloh ze všech dovedností ostrova, jen výsledky, 2 životy (smí se 1 chyba). Chyba vrátí
  dovednost do tréninku.
- **Opakování:** do tréninku se přimíchávají starší ostrovy. Co se tam pokazí, je **slabé místo** a musí se
  spravit (od 3 slabých míst je „Pokračovat“ pošle nejdřív tam).
- **Brána přijímaček:** závěrečná zkouška, 16 úloh (z každého ostrova aspoň jedna + 4 úlohy ve stylu přijímaček),
  jen výsledky, nejvýš 2 chyby. Hotovo je, až je Brána splněná a nezbývá žádné slabé místo. Pak udržovací trénink.
- Herní prvky: krystaly 💎 za úlohy napoprvé, série 🔥 násobí zisk (×2 od 3, ×3 od 6, ×4 od 10), hodnosti
  podle krystalů, hvězdy u ostrovů (lekce, zvládnutý trénink, poražený strážce).

| # | ostrov | dovednosti |
|---|---|---|
| 1 | Co je zlomek | zlomek z obrázku, vybarvi zlomek, zlomek z čísla, zlomek na ose |
| 2 | Rozšiřování a krácení | rozšiř na jmenovatel, doplň do rovnosti, zkrať (NSD), poznej základní tvar |
| 3 | Porovnávání | stejné části, přes společný jmenovatel, seřaď, zlomek mezi dvěma |
| 4 | Desetinná čísla, procenta | zlomek ↔ desetinné číslo, zlomek ↔ procenta |
| 5 | Smíšená čísla | zlomek ↔ smíšené číslo |
| 6 | Sčítání a odčítání | stejné jmenovatele, různé jmenovatele (+ i −), smíšená čísla |
| 7 | Násobení | krát celé číslo, krát zlomek (krácení do kříže), smíšené číslo |
| 8 | Dělení | převrácené číslo, děleno zlomkem, děleno celým číslem |
| 9 | Složené zlomky | pořadí operací, složený zlomek, složený zlomek s výrazy |
| 10 | Slovní úlohy | část z celku, celek z části, kolik zbývá, část ze zbytku, úlohy jako u přijímaček |

## Ovládání

- **Tablet:** ťukat na klávesnici na obrazovce. Políčka zlomku jde vybrat klepnutím, „celé“ přidá celou část.
- **PC:** číslice, `/` nebo `↓` skočí do jmenovatele, `↑` do čitatele, `←` do celé části, `Enter` potvrdí,
  `1–4` vybere možnost, `Enter` po vyhodnocení = další úloha.
- ⚙️ Nastavení: přehled, zvuk, odemčení všech ostrovů (pro toho, kdo už něco umí, nebo pro rodiče), smazání postupu.

Odkaz `?lekce=<id tématu>` otevře rovnou lekci.

## Data (vyměnitelná bez programování)

Všechno v `data/`:

- `kurz.json` – název, pořadí ostrovů (`temata`), délka kola, nastavení strážců a závěrečné zkoušky, hodnosti.
- `<téma>.json` – jeden ostrov:
  - `id`, `nazev`, `ikona`, `ostrov`, `strazce` `{ jmeno, barva, oci, rohy, hlaska, rod? }` (příšerka se kreslí z těchto čísel),
  - `lekce`: snímky `{ nadpis, text: [odstavce], kresba? }`. V textu `{3/4}` = zlomek, `{2 1/3}` = smíšené
    číslo, `**tučně**`. Kresba: `{ typ: "kolac"|"pruh"|"cokolada", n, k }`, `{ typ: "osa", do, deleni, body: [{ pismeno, c }] }`,
    `{ typ: "vedle", kresby: [...] }`, `{ typ: "vice", pocet, k, vzor }`.
  - `polozky`: dovednosti `{ id, gen, nazev, serie, param? }`. `gen` je generátor úloh v `generatory.js`
    (čísla se pokaždé losují).
- `slovni.json` navíc:
  - `sablony` – texty slovních úloh pro generátory `slovni-cast` (`{N}`, `{z}`), `slovni-celek` (`{X}`, `{z}`),
    `slovni-zbytek` a `slovni-zbytku` (`{z1}`, `{z2}`, volitelně `otazkaN` s `{N}`), `jednotka`, `rozsah`.
  - `pevne.cermat` – hotové úlohy ve stylu přijímaček (vymyšlené, ne převzaté):
    `{ zadani, kroky: [{ otazka, typ: "zlomek"|"cislo"|"volba", spravne: "5/12" | "2 1/3" | "24" | "0,75" | index volby,
    tvar?: "zakladni"|"libovolny"|"smisene", moznosti?, napoveda?, jednotka? }], vysvetleni }`.
    Poslední krok je výsledek (v souboji a v Bráně se ptá jen na něj).

Novou pevnou úlohu stačí připsat do `pevne.cermat`, nový ostrov = nový JSON + id do `kurz.json` + soubor
do `kustomization.yaml`.

## Soubory

| soubor | co dělá |
|---|---|
| `zlomek.js` | počítání se zlomky, zápis do HTML, kontrola odpovědi (hodnota i tvar) |
| `generatory.js` | generátory úloh s kroky, nápovědami a řešením; pevné úlohy z JSONu |
| `kresby.js` | SVG koláč, čokoláda, číselná osa |
| `prisery.js` | strážci ostrovů (SVG z barvy, počtu očí a rohů) |
| `postup.js` | postup v localStorage, zvládnutí položek |
| `hra.js` | obrazovky, průběh kurzu, klávesnice |
| `zvuk.js` | krátké zvuky ve Web Audio |
| `vr.js` | VR scéna (three.js z `/three.module.min.js`): ostrov, tabule se stránkou, 3D klávesnice, paličky, strážce, efekty |

Kontrola generátorů a dat: `node nastroje/zlomky-test.mjs` (vyrobí 10 500 úloh a ověří, že správná odpověď projde
a špatná ne). Testovací háček v prohlížeči: `window.__zlomky`.
Nasazení: ConfigMapy `vrskola-zlomky` a `vrskola-zlomky-data` v `kustomization.yaml`, nginx `location /zlomky/`.
