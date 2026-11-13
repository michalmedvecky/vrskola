# Sady zadání

Hry (Střelnice, Meče, Doplňovačka, Bludiště) samy nevědí, co se procvičuje. Obsah je v sadách: jeden soubor
`<id>.json` = jedna sada. Které sady se nabízejí a v jakém pořadí, určuje `index.json` (první je výchozí).
Když je sad víc, v menu hry jdou přepínat šipkami vedle nadpisu (nebo odkazem `?sada=<id>`).
Stejné soubory čte i server Souboje třídy, takže body počítá podle stejné sady; každá sada má vlastní TOP 5.

## Sady v repu

| Soubor | Co procvičuje |
|---|---|
| `vyjmenovana.json` | vyjmenovaná slova (y/i po obojetných souhláskách) |
| `vybrane-slova.json` | slovenské vybrané slová |
| `shoda.json` | shoda přísudku s podmětem: koncovka -i/-y (`psi štěkal[i]`, `děti si hrál[y]`, `kluci a holky běhal[i]`); rod střední (-a) vynechán |
| `nasobilka.json` | malá násobilka 1–10 (`7 · 8 = [56\|48\|64\|63\|49]`, špatné výsledky = sousední násobky a ±1), vygenerovaná |

## Formát

```json
{
  "id": "cinstina-zvirata",
  "nazev": "Čínská slovíčka: zvířata",
  "jazyk": "cs",
  "pocetMoznosti": 3,
  "texty": { "karty": ["Co znamená čínské slovo?", "Vystřel správný překlad pod kartou."] },
  "skupiny": [
    { "nazev": "Zvířata", "polozky": ["狗 gǒu = [pes]", "猫 māo = [kočka]", "马 mǎ = [kůň]", "鱼 yú = [ryba]"] },
    { "nazev": "Čísla", "polozky": ["一 = [jedna|dva|tři]", "二 = [dva|jedna]"] }
  ]
}
```

| Pole | Povinné | Význam |
|---|---|---|
| `id` | ano | malá písmena, číslice a pomlčky; musí sedět s názvem souboru a být v `index.json` |
| `nazev` | ano | nadpis v menu a v názvu stránky |
| `jazyk` | ne | jazyk rozhraní hry i `lang` stránky: `cs` (výchozí) nebo `sk`; nápisy jsou ve slovníku `UI` v `index.html`, další jazyk = další větev slovníku |
| `skupiny` | ano | seznam skupin `{ nazev, polozky }`; skupina je jen pro pořádek a pro losování špatných možností |
| `zamena` | ne | automatické špatné možnosti, např. `{ "y": "i", "ý": "í" }` (hodnota může být i pole) |
| `pocetMoznosti` | ne | kolik tlačítek má karta v Doplňovačce, 2–4 (výchozí 3) |
| `poradiMoznosti` | ne | pevné pořadí tlačítek, např. `["y", "ý", "i", "í"]` (jinak náhodně) |
| `texty` | ne | vlastní řádky návodu v menu: `strelba`, `mece`, `karty`, `bludiste`, `cviceni`, `cviceniKarty`, `cviceniBludiste` (pole 1–2 řádků) |
| `portrety` | ne | obrazy na zdech Bludiště: `{ "obrazek": "portrety/hus.jpg", "jmeno": "…", "roky": "…", "popis": "…" }` |

## Položka

Položka je text s jednou částí v hranatých závorkách: `před[odpověď|špatně1|špatně2]po`.

- **správný tvar** = před + odpověď + po (`b[y]dlet` → „bydlet“), ten se ukazuje jako správný ve Střelnici, Mečích a Bludišti;
- **špatný tvar** = před + špatná možnost + po („bidlet“);
- **Doplňovačka** ukáže „před ▢ po“ a pod tím odpověď a špatné možnosti jako tlačítka.

Odkud se berou špatné možnosti (první, co platí):

1. vypsané v závorce za `|`: `一 = [jedna|dva|tři]`;
2. ze `zamena` sady (vyjmenovaná slova: `b[y]dlet` → `i`);
3. odpovědi ostatních položek ze stejné skupiny (slovíčka: `狗 gǒu = [pes]` → kočka, kůň, ryba…).

Špatný tvar, který je zároveň správným tvarem jiné položky, se vynechá. Každá položka musí mít jedinou správnou
odpověď: kde by záměna dala jiné skutečné slovo (pyl × pil), dejte do položky krátké spojení („včela sbírá p[y]l“).

Po úpravě sady stačí znovu nasadit (`kubectl apply --server-side -k .`), změní se ConfigMapa `vrskola-sady`
a přerollují se hra i server. Nová sada se musí přidat do `index.json` a do `kustomization.yaml` (ConfigMapa `vrskola-sady`).
Chyby v sadě (nesrozumitelná položka, položka bez špatné možnosti) hra vypíše do konzole prohlížeče a server do logu.
