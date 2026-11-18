# Dvojvrch – soustavy rovnic

Samostatná hra na soustavy dvou lineárních rovnic o dvou neznámých pro deváťáky, příprava na přijímačky z matematiky.
Adresa po nasazení: `/soustavy/`. Běží v prohlížeči na PC i tabletu a na Questu v plném VR (tlačítko 🥽 Do VR).
Bez serveru, postup jen v `localStorage` (klíč `soustavy-v1`).

Stavba je převzatá ze [Zlomkové výpravy](../zlomky/README.md) (mapa, lekce → trénink → strážce, závěrečná zkouška,
krystaly, série, VR panel = tatáž stránka). Liší se odpovědi: místo zlomku se píšou **čísla do políček**
(x = □, y = □; □x + □y = □; y = □x + □), čísla můžou být záporná, desetinná i zlomky (3/4).

## Jak hra učí

- **Lekce** v každém táboře: pár snímků s řešenými příklady, soustavy se svorkou, grafy přímek.
- **Trénink** po kolech po 8 úlohách, dokud nejsou zvládnuté všechny dovednosti tábora (2–3× za sebou napoprvé bez chyby).
- **Mizející nápovědy:** dokud dovednost nemá ani jeden úspěch, počítá se **po krocích** (vyjádři → dosaď → uprav →
  x → y, nebo: čím vynásobit → vynásobená rovnice → sečti → …). U kroku je 💡, po první chybě v kroku se nápověda
  ukáže sama. Jakmile to jde, píše se **jen výsledek**.
- **Chyby:** špatný výsledek přepne úlohu do kroků, aby bylo vidět, kde se to pokazilo. Po chybě se ukáže řešení
  a úloha se za 3 úlohy vrátí. Volby u „dosaď výraz“ a u slovních úloh mají jako špatné možnosti typické chyby
  (chybějící závorka, otočené znaménko, prohozené x a y, „3x = y“ místo „x = 3y“).
- **Tvar:** nezkrácený zlomek (6/4) nebo celé číslo zapsané zlomkem není chyba, jen upozornění „zkrať“. Rovnice
  ve tvaru ax + by = c se uznává v libovolném násobku (2x + 4y = 6 i x + 2y = 3).
- **Strážce:** 6 úloh, jen výsledky, smí se 1 chyba. **Vrchol Dvojvrchu:** 12 úloh ze všech táborů + 3 úlohy ve
  stylu přijímaček, nejvýš 2 chyby. Opakování a slabá místa jako ve Zlomkové výpravě.

| # | tábor | dovednosti |
|---|---|---|
| 1 | Rovnice o jedné neznámé | ax + b = c, neznámá na obou stranách, závorky, zlomky |
| 2 | Co je soustava | je to řešení (zkouška), dopočítej druhou neznámou, řešení z grafu |
| 3 | Vyjádření neznámé | vyjádři (±1), vyjádři s dělením, co se vyplatí vyjádřit, dosaď výraz |
| 4 | Dosazovací metoda | vyjádři y, vyjádři x, už vyjádřená rovnice, celé řešení se zkouškou |
| 5 | Sčítací metoda | opačné koeficienty, vynásob jednu rovnici, vynásob obě |
| 6 | Závorky a zlomky | uprav na ax + by = c a vyřeš (závorky, zlomky) |
| 7 | Kolik řešení | z rovnic (žádné / jedno / nekonečně mnoho), z grafu, parametr |
| 8 | Slovní úlohy | kusy a ceny, hlavy a nohy, součet a rozdíl, kolikrát víc, věk |
| 9 | Jako u přijímaček | pevné úlohy ve stylu přijímaček, řešení ve zlomcích, smíšené soustavy |

## Ovládání

- **Tablet:** klávesnice na obrazovce: číslice, `−` (přepne znaménko), `,`, `/` (zlomek), `další ▸` (další políčko), OK.
  Na políčko jde i klepnout. OK s prázdným dalším políčkem skočí do něj.
- **PC:** číslice, `-`, `,`, `/`, `Tab` / šipky / mezerník přepínají políčka, `Enter` potvrdí, `1–4` vybere možnost.
- **VR:** 3D klávesnice na pultu (paličky nebo paprsek + spoušť), páčka posouvá tabuli. `?vrnahled=1` ukáže VR scénu
  na monitoru (myš = paprsek). Na skutečném Questu zatím nevyzkoušeno.

## Data (vyměnitelná bez programování)

Všechno v `data/`:

- `kurz.json` – název, pořadí táborů (`temata`), délka kola, strážci, závěrečná zkouška (`pevnaPolozka` = odkud
  brát úlohy ve stylu přijímaček), hodnosti.
- `<tábor>.json` – `id`, `nazev`, `ikona`, `misto`, `strazce` `{ jmeno, barva, oci, rohy, hlaska, rod? }`,
  `lekce` (snímky `{ nadpis, text: [odstavce], kresba? }`), `polozky` (`{ id, gen, nazev, serie, param? }`, `gen` =
  generátor v `generatory.js`, čísla se pokaždé losují).
  - Značky v textu: `{3/4}` nebo `{x + 1/2}` zlomek, `**tučně**`, `[[2x + y = 7 ; x − y = 1]]` soustava se svorkou.
  - Kresba: `{ typ: "graf", primky: [{ e: [a, b, c], popis }], body: [{ x, y, popis }] }` (přímky ax + by = c).
- `slovni.json` navíc `sablony` slovních úloh pro generátory `slovni-sv` (x + y = S, px + qy = T), `slovni-rozdil`,
  `slovni-nasobek` (x = ky), `slovni-vek` (x − y = D, x + n = k(y + n)). Šablona: `text` s `{S}`, `{T}`, `{p}`,
  `{q}`, `{D}`, `{k}`, `{n}`, popis neznámých `x`, `y`, rozsahy, `ptaSe` (`x`/`y`), `otazka`, `odpoved`, `jednotka`,
  `udaj1`/`udaj2` (co která rovnice zapisuje), volitelně `napoveda1`/`napoveda2`.
- `prijimacky.json` navíc `pevne.cermat`: hotové úlohy ve stylu přijímaček (vymyšlené, ne převzaté):
  `{ zadani, kroky: [{ typ: "cislo"|"xy"|"rce"|"volba", otazka?, spravne, pred?, jednotka?, moznosti?, napoveda? }], vysvetleni }`.
  `cislo`: `"spravne": "−3"` nebo `"5/2"`, `xy`: `["2", "3"]`, `rce` (ax + by = c, uzná se i násobek): `["1", "−2", "1"]`,
  `volba`: index správné možnosti. Poslední krok je výsledek (v souboji a na Vrcholu se ptá jen na něj).

Nový tábor = nový JSON + id do `kurz.json` + soubor do `kustomization.yaml`.

## Soubory

| soubor | co dělá |
|---|---|
| `cisla.js` | zlomky, zápis rovnic do HTML, čtení čísel od žáka, kontrola odpovědí |
| `generatory.js` | generátory úloh s kroky, nápovědami a řešením; slovní úlohy ze šablon; pevné úlohy z JSONu |
| `kresby.js` | SVG graf s přímkami |
| `prisery.js` | strážci (SVG z barvy, počtu očí a rohů) |
| `postup.js` | postup v localStorage, zvládnutí položek |
| `hra.js` | obrazovky, průběh kurzu, klávesnice |
| `zvuk.js` | krátké zvuky ve Web Audio |
| `vr.js` | VR scéna: horská louka, tabule se stránkou, 3D klávesnice, paličky, strážce, efekty |

Kontrola generátorů a dat: `node nastroje/soustavy-test.mjs` (vyrobí 12 000 úloh, ověří, že správná odpověď projde
a špatná ne, projde pevné úlohy a značky v lekcích). Testovací háček v prohlížeči: `window.__soustavy`, ve VR náhledu
`window.__soustavyVR.tlacKlavesu('7')`.
Nasazení: ConfigMapy `vrskola-soustavy` a `vrskola-soustavy-data` v `kustomization.yaml`, nginx `location /soustavy/`.
