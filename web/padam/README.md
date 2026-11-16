# Padám padám

Hra na určování pádů podstatných jmen pro tablet (4. třída). Bez VR, bez serveru, postup jen v `localStorage`
(klíč `padam-v1`). Adresa po nasazení: `/padam/`.

Hlavní myšlenka: pád se nepozná podle koncovky, ale **podle pádové otázky**. Všechny minihry proto dítě vedou
k tomu, aby si otázku zkusilo ve větě, a nápovědy (otázky) se postupně schovávají.

## Co v ní je

Městečko se čtyřmi domy (minihrami) a sedmi **pádníky**: vymyšlení tvorečci, jeden pro každý pád, každý ve své barvě.
Barva pádu je stejná všude ve hře (patro výtahu, odznáček, pádník). Pádníci se líhnou z vajíček a rostou
(vajíčko → mládě → velký pádník → král) podle bodů za správně určený pád: napoprvé bez 💡 2 body, s nápovědou 1.

| minihra | co dítě dělá | úroveň 1 | úroveň 2 | úroveň 3 |
|---|---|---|---|---|
| **Pádový výtah** | slovo z věty je pasažér, veze ho do patra jeho pádu; ťuknutím na dveře si otázku patra „vyzkouší“ ve větě, druhým jede | otázky na dveřích svítí | otázky jsou bledé | otázky jsou schované, jede se hned |
| **Ptáček se ptá** | ve větě chybí slovo za předložkou; ptáček Pípa se zeptá předložkou a otázkou („bez koho? bez čeho?“), dítě vybere tvar | Pípa se zeptá sám | dítě vybírá otázku ze 3 barevných | ze 4 bez barev |
| **Proměny jednoho slova** | jedno slovo projde 7 scénkami (v každé jiný pád) a dítě skládá jeho tvary; slovo pak přibude do sbírky i s tabulkou | popořadě, otázka v mezeře | popořadě, otázka pod 💡 | přeházeně, nejdřív vybrat otázku, pak tvar |
| **Detektiv** | v zatykači je hledaný pád, dítě vyslýchá podezřelá slova ve větě; nevinná mají alibi (ukáže se jejich pád) | pád i otázka | jen pád, otázka pod 💡 | jen pád |

Kolo má 8 úkolů (Proměny 7), za kolo jsou 1–3 hvězdy. Při chybě hra ukáže, proč (otázka patra ve větě nesedí),
a nechá zkusit znovu; podruhé už ukáže správnou cestu. Do postupu se počítá jen odpověď napoprvé.

**Úrovně nápověd se mění samy:** po 8 správných odpovědích bez nápovědy za sebou se nápovědy v té minihře schovají
o stupeň, po 3 chybách z posledních 6 se zase ukážou. Hvězdičky ★☆☆ u domu ukazují aktuální úroveň.

**Sbírka (📒):** pádová věž (tahák s otázkami), Ptačí zpěvník (předložky podle pádů, rozsvítí se po dvou správných)
a sbírka proměněných slov.

**Pro rodiče:** podržet ⚙️ 2 vteřiny. Úspěšnost po pádech (celkem a posledních 20 bez nápovědy), pevné nastavení
úrovně nápověd pro každou minihru, zvuky, tlačítko 🔊 (předčítání věty, když tablet umí česky), výběr sady,
posledních 12 chyb a smazání postupu.

Odkazy: `?hra=vytah|ptacek|promeny|detektiv` otevře rovnou minihru, `?balik=<id>` vybere sadu.

## Soubory

| soubor | co dělá |
|---|---|
| `index.html`, `styl.css` | kostra a vzhled (na šířku i na výšku) |
| `hra.js` | městečko, průběh kola, ukládání postupu, úrovně nápověd, sbírka, nastavení pro rodiče |
| `spolecne.js` | pády a otázky, rozbor vět `[slovo|pád]`, otázka s předložkou (bez DOM, testuje se v Node) |
| `vytah.js`, `ptacek.js`, `promeny.js`, `detektiv.js` | čtyři minihry, každá má `zacni()` (vybere úkoly kola) a `ukol()` (jeden úkol) |
| `pradnici.js` | pádníci (SVG) a jejich růst |
| `zvuky.js` | zvuky ve WebAudio a předčítání (převzato ze Strážců klýčú) |
| `data/` | **vyměnitelná data** |

## Výměna obsahu (bez programování)

`data/obsah.json` je seznam sad; každá sada říká, ze kterých souborů se berou věty pro výtah a detektiva,
položky ptáčka a slova proměn. Víc sad = výběr v nastavení pro rodiče.

```json
{ "baliky": [ { "id": "4-trida", "nazev": "Podstatná jména – 4. třída",
  "vety": ["vety.json"], "ptacek": ["ptacek.json"], "promeny": ["promeny.json"] } ] }
```

**`vety.json`** (Pádový výtah a Detektiv): každé podstatné jméno ve větě v hranatých závorkách s číslem pádu.
Výtah z věty vybere jedno slovo, Detektiv hledá slovo v pádu, který je ve větě jen jednou. Označuj proto všechna
podstatná jména, ať má detektiv dost podezřelých.

```json
{ "vety": ["[Babička|1] dala [vnučce|3] [jablko|4].", "„[Maminko|5], pojď se podívat na [duhu|4]!“"] }
```

**`ptacek.json`**: věta s jedním `[správným tvarem]` hned za předložkou, `zaklad` je slovo v 1. pádě (ukáže se
v závorce), `pad` jeho pád, `spatne` chybné tvary na kartičkách. Předložka se pozná sama (se → s, ke → k…);
když ne, dá se zadat `"predlozka": "kvůli"`. U předložek se dvěma pády (na, o, v, po, za, před, pod, nad) hra
jako chyták nabídne otázku toho druhého pádu.

```json
{ "polozky": [ { "veta": "Šli jsme do [lesa] na houby.", "zaklad": "les", "pad": 2, "spatne": ["lese", "lesem"] } ] }
```

**`promeny.json`**: slovo, obrázek (emoji), 7 tvarů (1.–7. pád, víc správných odděl `|`) a 7 scének, `_` je místo
pro slovo; n-tá scénka je n-tý pád.

```json
{ "slova": [ { "slovo": "drak", "obrazek": "🐉",
  "tvary": ["drak", "draka", "drakovi|draku", "draka", "draku", "drakovi|draku", "drakem"],
  "sceny": ["Nad hradem letí _.", "Rytíř se vůbec nebojí _.", "…", "…", "„_, nefoukej oheň!“", "…", "…"] } ] }
```

Kontrola po úpravě: `node nastroje/padam-test-data.mjs` (`-v` vypíše otázky ptáčka a všechny proměny).
Nový soubor v `data/` je potřeba zapsat i do `kustomization.yaml` (ConfigMapa `vrskola-padam-data`).

## Lokálně

```sh
cd web && python3 -m http.server 8000   # → http://localhost:8000/padam/
```
