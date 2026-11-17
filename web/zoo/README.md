# Slovní zoo

Samostatná hra na slovní druhy (1. stupeň, hlavně 4.–5. třída). Adresa po nasazení: `/zoo/`.
Běží v prohlížeči na PC i tabletu a na Questu v plném VR (tlačítko 🥽 Do VR). Bez serveru, postup jen
v `localStorage` (klíč `zoo-v1`).

## Nápad

Deset slovních druhů = deset zvířat v zoo. Každé zvíře se ptá **svou otázkou** a sní jen slova, která na ni
odpovídají (slon „Kdo? Co?“, opice „Co dělá?“, páv „Jaký? Který? Čí?“, šnek „Jak? Kde? Kdy? Proč?“, kachna chodí
vždycky *před* jménem, pavouk spojuje…). Hra druhy **učí**, ne jen zkouší:

- **Lekce** před každým výběhem: zvíře, jeho otázka, příklady a věta jako vláček se zvýrazněným druhem.
  Od druhého výběhu i rozdíly mezi podobnými druhy (rychlý × rychle, kolem rybníka × jezdí kolem, ale × ale).
- **Nápovědy mizí**: u nové dovednosti mají tlačítka zvířat pod sebou otázku, po prvním úspěchu je bledá,
  pak zmizí. 💡 ji ukáže, jen se úloha pak nepočítá do zvládnutí (ale ani neruší sérii).
- **Chyba učí**: zvolené zvíře řekne svou otázku a proč na ni slovo nesedí, správné zvíře řekne, jak slovo poznat
  (+ poznámka k těžkému slovu z dat). Hráč pak musí slovo dát správnému zvířeti **sám**. Úloha s chybou se za 3 úlohy
  vrátí a dovednost začne sérii znovu.
- **Košík**: dokud v zoo nejsou všechna zvířata, patří slova cizích druhů do košíku. Hned od prvního výběhu tak
  hráč rozlišuje „je to podstatné jméno, nebo ne?“.
- **Do zvládnutí**: každý výběh = lekce → krmení po kolech po 10 úlohách, dokud nejsou zvládnuté všechny dovednosti
  (2–3× za sebou napoprvé) → souboj se **Zmatkářem** (vymyšlená příšerka, 8 úloh bez nápověd, smí se 1 chyba) →
  další výběh. Dovednosti výběhu přicházejí postupně, nová až po prvním úspěchu v předchozích.
  Do krmení se míchají starší výběhy; co se tam pokazí, je slabé místo a musí se spravit.
- **Velká zkouška** na konci: 14 úloh ze všeho (slova, věty, hledání, vláčky, šatna), bez nápověd, nejvýš 2 chyby.

Pořadí výběhů: podstatná jména (1) → slovesa (5) → přídavná jména (2) → zájmena (3) → číslovky (4) →
**Šatna** (ohebné × neohebné: zvířata 1–5 se dají převléknout, ostatní ne; hráč slovo sám „převlékne“ do věty)
→ příslovce (6) → předložky (7) → spojky (8) → citoslovce (10) → částice (9). Čísla druhů jsou vidět všude
a jedna dovednost v každém výběhu je „číslo druhu“.

### Typy úloh

| gen | co hráč dělá |
|---|---|
| `krmeni` | samotné slovo dá zvířeti (nebo do košíku); na tabletu ho jde i přetáhnout |
| `dvojice` | totéž, jen se dvěma zvířaty a seznamem záludných dvojic (`vybehy.json` → `seznamy`) |
| `veta` | zvýrazněné slovo ve větě – druh podle role ve větě |
| `najdi` | ve větě klepne na všechna slova jednoho druhu |
| `vlacek` | věta jako vláček, každému vagonu (slovu) přiřadí zvíře; slova neznámých druhů jsou šedá ❔ |
| `cislo` | kolikátý druh je … / druh číslo N jsou … |
| `satna` | dá se slovo převléknout? Po odpovědi ukáže tvary (nebo věty, kde je slovo pořád stejné) |
| `zkus` | převlékne slovo do správného tvaru ve větě |
| `skupina` | je slovní druh ohebný? |

Herní vrstva: banány 🍌 za úlohy napoprvé, série 🔥 násobí zisk, hodnosti (Návštěvník → Ředitel zoo), hvězdy
u výběhů, 📖 **Tahák** v hlavičce se všemi zvířaty, která už hráč zná (otázka, poznávačka). Nastavení (⚙️):
zvuk, odemknout všechny výběhy, smazat postup. Na počítači: číslice = zvíře podle čísla druhu (0 = 10), K = košík.

## VR (Quest)

Hráč stojí uprostřed zoo. Před ním je tabule s hrou (tatáž stránka jako na tabletu, jako ve Zlomkové výpravě:
`body.vr` → SVG `foreignObject` → canvas → textura, klik paprskem přes `document.elementFromPoint`), kolem něj
deset výběhů se zvířaty a cedulemi (číslo, druh, otázka – mizí stejně jako na tabletu). **Ohebné druhy 1–5 jsou
vlevo, neohebné 6–10 vpravo** (po lekci v Šatně nad nimi visí nápis). Zavřené výběhy mají zámek.

Když má hráč krmit, objeví se před ním kartička se slovem. Chytí ji spouští nebo bočním tlačítkem (zblízka, nebo
paprskem) a **hodí** do výběhu; hod má pomoc – stačí mířit zhruba (do 28°). Jde i jen namířit paprskem na výběh
a zmáčknout spoušť. Košík stojí vlevo u nohou. Zvíře po správném krmení poskočí a vyletí srdíčka, po chybě
zavrtí hlavou a kartička se vrátí. Při souboji stojí vedle tabule Zmatkář jako 3D příšera a správná odpověď
po něm hodí banán. `?vrnahled=1` ukáže VR scénu na monitoru (myš = paprsek, šipky otáčí pohled,
`__zooVR.hod(druh)` simuluje hod). Na skutečném Questu zatím nevyzkoušeno.

## Data (`data/`)

| soubor | obsah |
|---|---|
| `kurz.json` | název, délka kola, souboj, Velká zkouška, hodnosti |
| `druhy.json` | deset druhů: zvíře, emoji, barva, otázka, poznávačka, věta po chybě (`{slovo}`), ohebnost |
| `vybehy.json` | výběhy v pořadí: lekce (`**tučně**`, `[slovo\|N]` = štítek), Zmatkář, dovednosti; `seznamy` pro `dvojice` |
| `slova.json` | samostatná slova podle druhu (jen jednoznačná), `nejednoznacna` se v krmení nepoužijí, `pozn` = vysvětlení k slovu |
| `vety.json` | věty, každé slovo s číslem druhu: `Malý/2 pes/1 běží/5.`; `pozn` k jednotlivým slovům věty |
| `promeny.json` | Šatna: ohebná slova s tvary a větami s mezerou, neohebná slova s větami |

Kontrola dat a generátorů: `node nastroje/zoo-test.mjs`. Háček pro testy v prohlížeči: `window.__zoo`
(`akce`, `S()`, `postup`, `DATA`).

V k3s jsou to ConfigMapy `vrskola-zoo` a `vrskola-zoo-data`, nginx je servíruje z `/zoo/`. Nový datový soubor
je potřeba přidat do `kustomization.yaml`.
