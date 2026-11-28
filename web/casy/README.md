# Hotel Kuriózum – anglické časy

Samostatná hra na **present simple × present continuous** (zhruba 5.–7. třída). Adresa po nasazení: `/casy/`.
Běží v prohlížeči na PC i tabletu a na Questu ve VR (tlačítko 🥽 Do VR). Bez serveru, postup jen v `localStorage`
(klíč `casy-v1`). Stavba je převzatá ze [Slovní zoo](../zoo/README.md) a [Dvojvrchu](../soustavy/README.md)
(lekce → trénink do zvládnutí → strážce, mizející nápovědy, chyba učí, VR panel = tatáž stránka).

## Nápad

Hráč je **poslíček** v bláznivém hotelu. Bydlí tu 20 vymyšlených hostů (upír, který zbožňuje česnek, robot, který
plete šálu, babička na skateboardu, žralok zubař, lenochod olympionik…). Každý host má:

- zápis v **Knize hostů** 📖 = co dělá pravidelně → **present simple**,
- **klíčovou dírku** 🔑 = co dělá právě teď → **present continuous**.

Každá úloha obsluhuje jednoho hosta (je vidět nahoře). Správně napoprvé = host je spokojenější ❤️; po 3 srdíčkách
dá hráči **kartičku do alba**. Kartička je zároveň čtení: „Every day… he drinks tomato juice. Right now he is counting
bats.“ Přednost dostávají hosté, kteří ještě kartičku nedali. Za správnou odpověď občas (4 %) přijede **tajný host**
(6 vzácných kartiček). Spropitné 🪙, série 🔥 a hodnosti (Poslíček → Majitel hotelu) jako ve Slovní zoo.
V hotelu na mapě se rozsvěcují okna hostů, které už má hráč v albu.

## Patra

| patro | téma | dovednosti (gen) | inspektor |
|---|---|---|---|
| Přízemí: Kniha hostů | present simple | `tvar` s, `pravopis` s, `kniha`, `zapor` s, `otazka` s | Inspektor Bezes (zapomíná -s) |
| 1. patro: Klíčová dírka | present continuous | `tvar` c, `pravopis` c, `dirka`, `zapor` c, `otazka` c | Inspektorka Ingrid (zapomíná am/is/are) |
| 2. patro: Teď, nebo vždycky? | rozlišení | `signal`, `cas`, `cas2`, `vety` kontext | Inspektor Teďvždycky |
| 3. patro: Otázky a zápory | do/does × am/is/are | `zapor` mix, `otazka` mix, `kratka`, `oprav` | Inspektor Otazník |
| 4. patro: Líná slovesa | stavová slovesa | `vety` lina, `vety` dvoji, `vety` docasne, `cas` vše | Inspektor Ingoš („I am knowing!“) |
| Střecha | Velká inspekce | 14 úloh ze všeho, nejvýš 2 chyby | Vrchní inspektor Časoplet |

Inspektoři jsou vymyšlené příšerky (kreslené z tvarů, `prisery.js`), každý dělá „svou“ typickou chybu.

## Jak hra učí

- **Lekce** před každým patrem (4–6 snímků s příklady, tabulkami a hosty).
- **Nápovědy mizí**: signální slova jsou nejdřív barevná s ikonou (📖 žlutá, 🔑 modrá) a pod větou svítí pravidlo,
  po prvním úspěchu blednou, pak zmizí. 💡 je ukáže, úloha se pak nepočítá do zvládnutí ani do srdíček.
- **Chyba učí**: špatná možnost řekne, *proč* je špatně (bez prozrazení správné), hráč to zkusí znovu. Po druhé chybě
  se ukáže vysvětlení a úloha se za 3 úlohy vrátí. Špatné možnosti jsou typické chyby (he play, she dancing,
  doesn't sleeps, Does he sleeping?, I am knowing, makeing, swiming).
- **Do zvládnutí** po kolech po 10 úlohách, dovednost = 3× (u některých 4×) za sebou napoprvé. Do služby se míchají
  starší patra; co se tam pokazí, je slabé místo.

### Typy úloh (`ulohy.js`)

| gen | co hráč dělá |
|---|---|
| `tvar` | doplní tvar slovesa (param `cas`: s / c / mix) |
| `pravopis` | vybere správně napsaný tvar -s / -ing |
| `kniha` | přepíše zápis z Knihy hostů do věty |
| `dirka` | podívá se klíčovou dírkou: What is X doing? |
| `zapor`, `otazka` | zápor / pomocné sloveso otázky (s / c / mix) |
| `kratka` | krátká odpověď (Yes, he does. / No, she isn't.) |
| `signal` | ke signálnímu slovu vybere čas |
| `cas` | doplní sloveso ve správném čase podle signálního slova |
| `cas2` | dvě slovesa v jedné větě (usually…, but today…) |
| `oprav` | inspektor napsal větu s chybou, vybere správnou opravu |
| `vety` | ručně psané věty ze skupiny ve `vety.json` (param `skupina`) |

Věty se skládají z frází hostů, podmětů (host, I/you/we/they, dvojice hostů) a signálních slov; tvary sloves počítají
pravidla v `ulohy.js` (`tvarS`, `tvarIng`, seznam `zdvoj` a `vyjimky` v `jazyk.json`).

## Data (`data/`)

| soubor | obsah |
|---|---|
| `kurz.json` | název, délka kola, kontrola, srdíček na kartičku, šance na tajného hosta, Velká inspekce, hodnosti |
| `patra.json` | patra v pořadí: hosté, lekce (`**tučně**`, `__zvýraznění__`, `*kurzíva*`), inspektor, dovednosti |
| `hoste.json` | hosté (`zvyky` = Kniha hostů, `ted` = klíčová dírka; fráze začíná slovesem, `{pos}` = his/her…) a tajní hosté |
| `jazyk.json` | časy, signální slova, zdvojování, výjimky, líná slovesa, podměty, slovesa pro pravopis |
| `vety.json` | ručně psané věty po skupinách: `pre[správně\|špatně]post` + `pozn` |

**Další časy** (past simple, going to, present perfect…) jdou přidat jako další patra: nová skupina vět ve `vety.json`
funguje hned (gen `vety`), pro generované úlohy stačí přidat čas do `skladej()` v `ulohy.js` a do `jazyk.json`.

Kontrola dat a generátorů: `node nastroje/casy-test.mjs`. Háček pro testy v prohlížeči: `window.__casy`
(`akce`, `S()`, `postup`, `DATA`, `generuj`).

## VR (Quest)

Hráč stojí v hotelové hale (šachovnicová podlaha, dveře pokojů, výtah, lustr) u recepčního pultu. Před ním je panel
s hrou (stránka jako na tabletu), na pultu **tlačítka 1–4** (možnosti odpovědi) a **zvonek** 🛎️ (Další / Pokračovat).
Ťuká se paličkami, nebo paprskem + spoušť. Kolem stojí hosté z alba a po správné odpovědi poskočí. Při kontrole stojí
vedle panelu inspektor jako 3D příšera a správná odpověď do něj hodí razítko. `?vrnahled=1` ukáže scénu na monitoru
(myš = paprsek, `__casyVR.tlacKlavesu('1')`). Na skutečném Questu zatím nevyzkoušeno.

V k3s jsou to ConfigMapy `vrskola-casy` a `vrskola-casy-data`, nginx je servíruje z `/casy/`. Nový datový soubor je
potřeba přidat do `kustomization.yaml`.
