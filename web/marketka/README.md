# Marketka a zamčený hrad

Samostatná hra pro tablet (bez VR, bez serveru) na `/marketka/`. Dítě si nastrojí postavičku, na hradě vidí
zámky (výchozí 10) a vydá se po mapě kraje hledat klíče. V každé vesnici je truhlička (Berounsko má 24 vesnic): nejdřív krátká hádanka
na zámku (2–3 možnosti), pak úloha. Za vyřešenou úlohu kousek klíče (výchozí jsou dvě truhly na jeden klíč, tedy 20 truhel na 10 zámků), za nevyřešenou se truhla zamkne
na 1 minutu (nastavitelné) a postavička odejde do sousední vesnice. Klíče se kdykoli vkládají do zámků na hradě; když povolí
všechny, dítě dostane nálepku do sbírky (36 druhů, pak zlaté verze) a hrad se zamkne znovu na další kolo.
Za počet odemčených hradů roste hodnost (Poutník → … → Legenda).

Postup se ukládá jen v prohlížeči tabletu (`localStorage`, klíč `marketka-v1`).

**Pro rodiče:** ozubené kolečko vpravo nahoře, podržet 2 s. Počet zámků, truhliček na jeden klíč, pauza po chybě, počet srdíček
v úloze (kolik chyb se odpustí), která témata se procvičují, zvuk, statistika po tématech a seznam posledních
chyb (co přesně dítě spletlo), úprava postavičky, smazání postupu.

Na tabletu jde stránku přidat na plochu (manifest, spustí se přes celou obrazovku na šířku).

## Soubory

| Soubor | Co dělá |
|---|---|
| `index.html`, `styl.css` | kostra stránky a vzhled |
| `hra.js` | obrazovky, pravidla hry, ukládání |
| `mapa.js` | kreslení mapy na canvas (paralaxa, naklánění domů a stromů, mraky), chůze po cestách, posun a přiblížení prsty |
| `postava.js` | vymyšlená postavička a její volby (kůže, vlasy, oblečení, pokrývka hlavy, brašnička) |
| `ulohy.js` | „motory“ úloh: z dat témat vyrábí konkrétní úlohy a otázky na zámky (bez DOM, testuje se v Node) |
| `ulohy-ui.js` | zobrazení úloh a kontrola každého kroku |
| `nalepky.js`, `zvuky.js` | nálepky a hodnosti, zvuky (WebAudio) a předčítání (speechSynthesis) |
| `data/` | **vyměnitelná data**: mapy a sady úkolů |

## Výměna úkolů (bez programování)

`data/ukoly.json` je seznam sad úkolů; každá sada je seznam témat (souborů). Když je sad víc, rodič je přepíná
v nastavení (nebo odkazem `?ukoly=<id>`). Nová látka = nový soubor tématu a jeho zápis do sady.

```json
{ "baliky": [ { "id": "4-trida", "nazev": "4. třída", "temata": ["ukoly-pravopis.json", "ukoly-pady.json"] } ] }
```

Téma:

```json
{
  "id": "pravopis",
  "nazev": "Vyjmenovaná slova po P a S",      // vidí jen rodič (nastavení, statistika)
  "kouzlo": "Kouzelný nápis",                  // vidí dítě nad úlohou
  "zamena": { "y": "i", "i": "y", "ý": "í", "í": "ý" },
  "ulohy": [ { "typ": "doplnovacka", "vaha": 3, ... }, { "typ": "diktat", "vaha": 1, ... } ],
  "zamky": { ... }
}
```

`vaha` určuje, jak často se daný druh úlohy objeví. Typy úloh:

| typ | data | co dítě dělá |
|---|---|---|
| `doplnovacka` | `vety: ["Kůň klop[ý]tl…"]`, `minMezer` | doplňuje písmena jedno po druhém; špatná možnost ze `zamena`, nebo výslovně `[ý\|í]` (první je správná) |
| `diktat` | `vety` jako výše, `moznosti` | hra větu přečte nahlas, dítě vybere správně napsanou ze 2–3 variant (bez českého hlasu v tabletu se vynechá) |
| `urcovani` | `vety: ["Babička dala [vnučce\|3] [jablko\|4]."]`, `moznosti: [{hodnota, popis, napoveda}]`, `minSlov` | u každého zvýrazněného slova vybere hodnotu (pády, ale klidně slovní druhy, rody…) |
| `vyber` | `polozky: [{otazka, moznosti: ["správně", "špatně", …]}]` | obecná otázka s výběrem |
| `pisemne` | `operace: "-"` nebo `"×"`, rozsahy `a`, `b`, u odčítání `minPrechodu` | počítá pod sebou zprava, každá číslice se kontroluje hned; u násobení dvojciferným nejdřív mezivýsledky, pak součet |
| `slozene` | `sablony: [{vyraz: "(a − b) × c", a: [40, 300], …}]`, `max` | nejdřív vybere, co se počítá první, pak zapisuje mezivýsledky; generátor hlídá celá nezáporná čísla |
| `skladani` | `polozky: [{pokyn, predloha, vysledek, navic}]` nebo `generator: "present-simple"` se `slovnik` | skládá větu z kartiček, kartičky navíc jsou chytáky (`Do`/`Does`, `plays`) |

Zámky truhel (`zamky`): `slova: ["p[y]tel", …]` (chybějící písmeno), `polozky: [{otazka, moznosti}]`,
`generator: "pocty-zpameti"` (násobilka, sčítání a odčítání zpaměti) nebo `generator: "z-uloh"` (otázka se
vyrobí z úloh tématu: jeden pád, jedno písmeno, správná věta ze dvou).

Kontrola po úpravě: `node nastroje/marketka-test-ulohy.mjs` (vygeneruje stovky úloh a zámků z každého tématu
a ověří je; `-v` vypíše ukázky).

## Výměna mapy

`data/mapy.json` je seznam map (víc map = výběr v nastavení, nebo `?mapa=<id>`). Mapa je JSON v pixelech:

```json
{
  "id": "berounsko", "nazev": "Berounsko", "sirka": 2680, "vyska": 2599,
  "start": "beroun",                                   // město s hradem
  "pozadi": { "barva": "#b7d98b", "obrazek": "data/moje-mapa.jpg" },   // obojí nepovinné
  "mesta": [ { "id": "beroun", "nazev": "Beroun", "x": 1474, "y": 957, "velikost": 3 } ],
  "cesty": [ ["beroun", "tetin"], ["tetin", "srbsko", [[1700, 1150]]] ],   // volitelně body, kudy cesta vede
  "reky": [ { "nazev": "Berounka", "sirka": 16, "body": [[0, 400], …] } ],
  "lesy": [ { "body": [[…], …] } ], "kopce": [ { "x": …, "y": …, "r": 120 } ], "popisky": [ { "text": "Brdy", "x": …, "y": … } ]
}
```

Nejjednodušší je psát mapu v GPS a převést ji: `nastroje/marketka-berounsko.gps.json` je zdroj Berounska
(souřadnice jsou přibližné, stačí z mapy.cz), převod:

```sh
node nastroje/marketka-mapa.mjs nastroje/marketka-berounsko.gps.json > web/marketka/data/mapa-berounsko.json
```

Nový soubor v `data/` je potřeba zapsat i do `kustomization.yaml` (ConfigMapa `vrskola-marketka-data`).

## Lokálně

```sh
cd web && python3 -m http.server 8000   # → http://localhost:8000/marketka/
```
