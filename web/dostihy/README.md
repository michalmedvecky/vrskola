# Dukáty a dostihy

Samostatná hra pro tablet a mobil (bez VR, bez serveru) na `/dostihy/`. Procvičuje **písemné sčítání, odčítání,
násobení a dělení až do 9 cifer**. Kostra (mapa, postavička, panely, nastavení pro rodiče) je převzatá ze
[Strážců klýčú](../strazcy/README.md).

Holčička jezdí na hobbyhorsovi po stylizované mapě Posázaví (Zruč nad Sázavou – Kounice – Ledeč nad Sázavou, 24 vesnic).
V každé vesnici je truhlička: nad ní je vidět, kolik dukátů skrývá (1–5 = obtížnost), po otevření i jaký příklad.
Správně spočítaný příklad = dukáty do měšce (měšec je pořád vidět vlevo nahoře). Při chybě se truhla na chvíli zamkne,
ukáže se správné řešení a holčička odjede do sousední vesnice. Prázdná truhla se po čase znovu naplní (jiná obtížnost a příklad).
Čím dál od Kounic, tím těžší truhly (s trochou náhody).

V **Kounicích** je stáj, obchod a závodiště. Na začátku má hráčka jen starou kobylu Herku: zablácenou, rozcuchanou,
vyhublou, s hlavou dole; na dostizích zakopává o překážky. Za dukáty ji vylepšuje, na dostizích vyhrává další dukáty.

Postup se ukládá jen v prohlížeči (`localStorage`, klíč `dostihy-v1`).

## Systém vylepšení koně

Čtyři vlastnosti, každá má 8 stupňů = 8 věcí v obchodě (kupují se popořadě, ceny rostou, všechno stojí 711 dukátů):

| vlastnost | co dělá v dostizích | jak se projeví na koni |
|---|---|---|
| ❤️ Zdraví | delší sprint, rychlejší oddech, rychlejší zvednutí po zakopnutí | přestane být vyhublá, kulhat a věšet hlavu |
| 💪 Síla | vyšší rychlost a rychlejší rozběh | silnější nohy a hrudník |
| 🦘 Obratnost | delší chvilka, kdy je skok platný (zelený pruh před překážkou je delší), menší šance zavadit | – |
| ✨ Krása | diváci po každém dostihu přihodí dukáty (½ dukátu za stupeň) | koupel (zmizí bláto), lesk, učesaná hříva, lesklá kopyta, mašle, čabraka, třpytivá a zlatá uzdečka |

Proč to není úplně snadné (herní teorie):
- **Rostoucí ceny** (4 → 54 dukátů): první vylepšení je hned (po 2–3 truhlách), další stojí víc, motivace vydrží dlouho.
- **Závislost**: od 3. věci potřebuje síla i obratnost zdravého koně (věc č. *n* chce zdraví aspoň *n* − 2), takže nejde
  „napumpovat“ jednu vlastnost. Krása nic nepotřebuje, ale do dostihů nepomáhá, jen vydělává po troškách → volba „teď hezčí, nebo rychlejší?“.
- **Odpočinek**: po dostihu musí kůň odpočívat, dokud hráčka neotevře 2 truhly (nastavitelné). Dostihy tak nenahradí počítání,
  ale jsou odměna za ně.
- **Tři ligy** s rostoucím startovným a výhrou: Vesnické dostihy (zdarma, 6/3/1), Posázavský pohár (3 → 15/8/3),
  Velká kounická (6 → 32/16/6). U každé hra ukazuje odhad šance (velká / střední / malá).

## Dostihy

Jednoduchá „lineární“ hra z boku: 4 koně (hráčka + 3 soupeři počítače), každý ve své dráze, 5–7 překážek.
- 🥕 **Pobídni** (držet) = sprint, dokud má kůň síly (ukazatel nad tlačítkem). Když síly dojdou úplně, kůň je chvíli
  vyčerpaný a běží pomaleji, dokud nenabere aspoň třetinu.
- ⤴ **Skoč!** (klepnout, nebo klepnout kamkoli na dráhu) = odraz. Zelený pruh před překážkou ukazuje, kdy je skok platný.
  Přesně uprostřed = „Perfektní skok!“ a malé zrychlení; brzo / pozdě / bez skoku = kůň zakopne a zpomalí.
- Na PC: mezerník nebo šipka nahoru = skok, šipka doprava nebo Shift = pobídka.

Výsledek = vlastnosti koně + jak dobře hráčka skáče a šetří síly + náhoda (forma dne, zavadit jde i při dobrém skoku).
Soupeři se mírně přizpůsobují (kdo hráčce hodně uteče, trochu zvolní), v rodičovském nastavení jde přizpůsobení zesílit.

Vyvážení je ověřené simulací (`node nastroje/dostihy-vyvazeni.mjs`): robot skáče s náhodnou chybou odrazu
(dobrý hráč σ 0,07 s, průměrný 0,12 s, slabší 0,18 s). Stupeň koně = stejný stupeň zdraví, síly i obratnosti.
Šance na 1. místo / na stupně vítězů, průměrný hráč (300 závodů na buňku):

| stupeň koně | Vesnické | Posázavský pohár | Velká kounická |
|---|---|---|---|
| 0 (stará Herka) | 6 % / 55 % | 0 % / 1 % | 0 % / 0 % |
| 2 | 67 % / 96 % | 0 % / 30 % | 0 % / 1 % |
| 4 | 99 % / 100 % | 8 % / 82 % | 0 % / 15 % |
| 6 | 100 % | 45 % / 100 % | 4 % / 69 % |
| 8 (vše koupeno) | 100 % | 95 % / 100 % | 50 % / 98 % |

Takže: se starou Herkou jde vyhrát vesnické dostihy (dobrý skokan asi každý 9. závod), a i s nejlepším koněm jde prohrát
Velkou kounickou. Kdo drží pobídku pořád a nehlídá síly, dopadne hůř (sloupec „pořád pobízí“ ve výpisu).
Síla soupeřů každé ligy je v `data/dostihy.json` (`souperi` = rozsah stupňů pro slabšího, středního a silného soupeře,
`presnost` = jak přesně skáčou, `pomoc` = jak moc čekají na slabšího hráče). Po úpravě znovu pustit simulaci.

## Úlohy

| operace | obtížnost 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| + sčítání | 3 + 2–3 cifry | 4 + 3–4 | 5–6 + 4–6 | 7 + 5–7 | 8–9 + 7–8 |
| − odčítání | 3 − 2–3 | 4 − 3–4 | 5–6 − 4–6 | 7 − 5–7 | 8–9 − 6–9 |
| × násobení | 2–3 × 1 cifra | 4 × 1 | 3–4 × 2 | 5–6 × 2 | 5–6 × 3 |
| : dělení | 2–3 : 1 cifra, beze zbytku | 4 : 1, beze zbytku | 5–6 : 1, se zbytkem | 4–5 : 2 | 7–9 : 2 |

Výsledek má vždy nejvýš 9 cifer. U sčítání a odčítání je zaručený minimální počet přechodů přes desítku (`minPrechodu`).
- **Pod sebou** (+, −, ×): píše se zprava, každá číslice se kontroluje hned. Nad sloupcem se po napsání číslice ukáže
  přenos („1 si pamatuj“, u odčítání česká metoda doplňováním); jde vypnout v nastavení. Násobení víceciferným: nejdřív
  mezivýsledky (každý o místo doleva), pak součet.
- **Dělení** po česku: „Kolikrát se 7 vejde do 45?“ → číslice podílu, „Kolik zbude?“ → zbytek se napíše pod číslo
  a připíše se k němu další číslice dělence. Poslední zbytek je zbytek dělení.
- Po chybě ubude srdíčko a objeví se nápověda přesně k tomu kroku (např. `7 + 5 + 1 = 13 → napiš 3, 1 si pamatuj`,
  `6 × 7 = 42 – to je víc než 40, zkus menší číslo`). Srdíček je podle nastavení (výchozí 2), u obtížnosti 3+ o jedno, u 5 o dvě víc.

### Psaní tužkou

Výchozí zápis čísel je **psaní tužkou nebo prstem** na psací plochu vedle příkladu (v nastavení jde přepnout na číselnou
klávesnici). Po zvednutí tužky a chvilce (0,9 s) se číslice přečte a zapíše do políčka.
- Čte ji malá konvoluční síť přímo v prohlížeči, bez internetu (`cislice.js`, váhy `cislice-model.json`, 140 kB, int8).
  Natrénovaná na MNIST + syntetických českých jedničkách s náběhem a sedmičkách s čárkou
  (`nastroje/dostihy-cislice-synt.py`, `nastroje/dostihy-cislice-trenink.py`), na testu MNIST 99,4 %.
- Když si čtení není jisté, zeptá se „Co jsi napsala? 1 / 7 / ✏️ Znovu“ – nejistota se nikdy nepočítá jako chyba
  a nabídka se ukazuje bez ohledu na to, jestli je odpověď správně (neprozradí výsledek).
- Vybraná podoba se uloží jako vzorek rukopisu. V nastavení je **„Naučit hru můj rukopis“**: každá číslice dvakrát;
  hra pak čte podle vnitřních rysů sítě i vlastní vzorky (localStorage `dostihy-rukopis`, nejvýš 12 na číslici).
- Jakmile tablet ohlásí stylus (Apple Pencil, S Pen), dotyky prstem a dlaní se na ploše ignorují.
- Klávesnice počítače funguje pořád (číslice, Enter, Backspace).

Rozsahy jsou v `data/ukoly.json` (počty cifer `[od, do]` pro každou obtížnost), takže jdou měnit bez programování.

## Pro rodiče

Ozubené kolečko vpravo nahoře, podržet 2 s: které operace se počítají, nejnižší a nejvyšší obtížnost truhel, srdíčka,
pauza po chybě, za jak dlouho se prázdná truhla naplní (výchozí 15 min), odpočinek koně po dostihu, jak moc soupeři čekají,
přenos nad sloupcem, psaní tužkou / klávesnice a učení rukopisu, zvuk, statistika (podle operací a obtížností), poslední chyby, úprava postavičky, smazání postupu.
Tajný kód: napsat na klávesnici `HOPHOP` = 20 dukátů (na zkoušení obchodu a dostihů).

## Soubory

| Soubor | Co dělá |
|---|---|
| `index.html`, `styl.css` | kostra stránky a vzhled |
| `hra.js` | obrazovky, truhly, dukáty, Kounice (stáj, obchod, výběr dostihu), nastavení, ukládání |
| `mapa.js` | mapa na canvasu (ze Strážců: paralaxa, cesty, posun a přiblížení prsty), závodiště a stáj v Kounicích, truhly s dukáty |
| `postava.js` | holčička (ze Strážců, přidaná jezdecká helma) a hobbyhorse s volbami (barva, hříva, uzdička, ozdoba, tyč) |
| `kun.js` | závodní kůň: vlastnosti z koupených věcí, kreslení z boku podle zdraví, síly a krásy, jezdkyně |
| `ulohy.js` | generátory příkladů podle obtížnosti, přenosy, kroky písemného dělení (bez DOM, testuje se v Node) |
| `ulohy-ui.js` | počítání pod sebou a písemné dělení s kontrolou každého kroku a nápovědou; psací plocha a klávesnice |
| `cislice.js`, `cislice-model.json` | rozpoznávání psaných číslic (síť v čistém JS) a vzorky rukopisu |
| `dostihy.js` | simulace dostihu (bez DOM, testuje a vyvažuje se v Node) |
| `dostihy-ui.js` | obrazovka dostihu: kreslení, tlačítka, klávesnice |
| `zvuky.js` | zvuky (WebAudio, ze Strážců + mince, kopyta, skok) |
| `data/` | **vyměnitelná data**: mapa, rozsahy příkladů, obchod, dostihové ligy |

Mapa se píše v GPS a převádí stejným nástrojem jako Berounsko:

```sh
node nastroje/strazcy-mapa.mjs nastroje/dostihy-posazavi.gps.json > web/dostihy/data/mapa-posazavi.json
```

Souřadnice jsou přibližné a mapa je stylizovaná; Kounice jsou herní centrum mezi Zručí a Ledčí na Sázavě.

Kontrola po úpravě dat: `node nastroje/dostihy-test.mjs` (stovky příkladů ze všech operací a obtížností, obchod, mapa,
dostihy; `-v` vypíše ukázky). Nový soubor v `data/` je potřeba zapsat i do `kustomization.yaml` (ConfigMapa `vrskola-dostihy-data`).

## Lokálně

```sh
cd web && python3 -m http.server 8000   # → http://localhost:8000/dostihy/
```
