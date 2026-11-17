# Stupnice a sluch

Samostatná aplikace na hudební teorii pro klavír, příprava na talentové přijímačky. Adresa po nasazení: `/klavir/`.
Běží v prohlížeči na PC, tabletu i telefonu, na Questu 2 buď jako stránka v prohlížeči, nebo v plném VR (tlačítko
🥽 Do VR). Zvuk klavíru se syntetizuje ve Web Audio (žádné nahrávky), na Questu hraje do sluchátek headsetu.
Bez serveru, postup jen v `localStorage` (klíč `klavir-v1`).

## Jak kurz běží

Kurz má 13 jednotek. Každá má **lekci** (krátké snímky s ukázkou na klaviatuře) a **trénink**. Trénink běží po kolech
po 12 otázkách a jednotka je hotová, až když je zvládnutá **každá** její položka: položka je zvládnutá po 2 správných
odpovědích napoprvé za sebou (sluchová cvičení 3–5). Chyba vynuluje sérii, ukáže vysvětlení a správné řešení
na klaviatuře, přehraje ho a za 3 otázky se položka vrátí. Pak se otevře další lekce: lekce, trénink, lekce, trénink…

Do tréninku se přimíchává opakování starších jednotek. Když se tam něco zapomene, stane se z toho **slabé místo**
a musí se znovu zvládnout. Na konci je **závěrečná zkouška** (25 otázek ze všech jednotek, nejvýš 2 chyby).
Kurz je hotový, až je zkouška splněná a nezbývá žádné slabé místo. Pak zbývá udržovací trénink.

| # | jednotka | co se cvičí |
|---|---|---|
| 1 | Klaviatura a bílé klávesy | najdi / pojmenuj c d e f g a h |
| 2 | Půltóny, křížky a béčka | černé klávesy oběma jmény, půltón × celý tón |
| 3 | Sluch: bílé tóny | zazní c¹ a hledaný tón, odpověď na klaviatuře |
| 4 | Stavba durové stupnice | C dur, G dur, kde jsou půltóny |
| 5–8 | Křížkové a béčkové dur | každá stupnice: zahrát, předznamenání, doplnit chybějící tón (pravopis) |
| 9 | Molové stupnice | a moll přirozená, harmonická, melodická (nahoru i dolů), paralelní tóniny |
| 10 | Sluch: dur, nebo moll? | kvintakord i stupnice, k tomu černé tóny podle sluchu |
| 11, 13 | Molové s křížky / s béčky | harmonická i melodická zahrát, pravopis harmonické, paralelní dur a předznamenání |
| 12 | Sluch: druhy moll | přirozená / harmonická / melodická podle sluchu |

Všech 15 durových a 15 molových stupnic, české názvy tónů (h, b, es, as, eis, his, fisis…).
Hraní stupnice se kontroluje podle kláves (oktáva nevadí), pravopis se zkouší zvlášť doplňováním tónů.

## Ovládání

- **Tablet / telefon:** ťukat na klávesy a tlačítka. Víc prstů = akord.
- **PC:** myš, nebo klávesnice počítače jako klavír: `a w s e d f t g z h u j k` = c¹ až c², Enter = hlavní tlačítko,
  1–4 = možnosti.
- **Quest 2 VR:** v každé ruce palička, do kláves se ťuká shora (vibrace při úderu). Nebo paprsek z ovladače
  a spoušť, i na tlačítka panelu. „Opustit VR“ v rohu panelu.
- ⚙️ Nastavení: názvy tónů na klávesách, zvuk, poslední chyby, smazání postupu. 🎹 Volné hraní: přehraje
  libovolnou stupnici.

Odkazy: `?lekce=<id jednotky>` otevře lekci, `?vrnahled=1` ukáže VR scénu na monitoru (klikání myší) pro ladění.

## Soubory

| soubor | co dělá |
|---|---|
| `hudba.js` | teorie: názvy tónů, stavba stupnic, předznamenání, paralelní tóniny |
| `kurz.js` | osnova: jednotky, texty lekcí, položky k zvládnutí, potřebné série |
| `cviceni.js` | z položky (`hraj:D-dur`, `sluch:fis`, `paral:e-moll`…) vyrobí konkrétní otázku |
| `postup.js` | postup v localStorage, zvládnutí, slabá místa |
| `hra.js` | obrazovky, výběr otázek, vyhodnocení; skládá model obrazovky pro obě vykreslovadla |
| `ui.js` | vykreslení na stránku, klaviatura v HTML |
| `vr.js` | WebXR scéna (three.js z `/three.module.min.js`): 3D klaviatura, panel z canvasu, paličky |
| `zvuk.js` | syntéza klavíru ve Web Audio |

Kontrola teorie a cvičení: `node nastroje/klavir-test.mjs`.
Nasazení: ConfigMapa `vrskola-klavir` v `kustomization.yaml`, nginx `location /klavir/`. Nový soubor = přidat
do ConfigMapy.
