# VR škola

VR hry pro Oculus Quest 2 na procvičování vyjmenovaných slov (WebXR, three.js 0.160 přibalené).
Přesunuto z repa `smartoped` (`web/vr/`), stav včetně pauzy a tlačítka Opustit VR.

## Režimy

- **Střelnice** – pravá (zelená) pistole střílí správně napsaná slova, levá (červená) špatně napsaná; max 42 slov ve 360°.
- **Meče** – slova letí po dráze proti hráči, zelený meč seká správná, červený špatná (`?rezim=mece`).
- **Doplňovačka** – karty s mezerou místo y/i, hráč vystřelí správné písmeno (`?rezim=karty`).
- **Bludiště** – hráč chodí 3D bludištěm; na každé křižovatce jsou dvě šipky se slovem (jedno napsané správně,
  druhé špatně). Správná cesta vede dál, špatná do slepé uličky, kde čeká příšera a honí hráče. Příšeru jde
  rozseknout mečem, pak z ní vyletí správně napsané slovo; nebo se dá utéct zpátky ke křižovatce
  (`?rezim=bludiste`). Správná volba +1, špatná −1. Ovládání: ve VR levá páčka chůze, pravá páčka otáčení
  po 30° skocích, meče v rukou; na počítači W/S nebo ↑/↓ chůze, A/D nebo ←/→ otáčení (Q/E úkrok), klik nebo
  mezerník seká; na tabletu tlačítka ▲▼ a ◄►, seká ⚔ nebo klepnutí, rozhlížet se jde i tažením prstu.
  Meč se ukáže, až když příšera honí hráče. Chůze má zvuk kroků a jemné pohupování (ve VR jen náznak), držením
  páčky / klávesy se krok během ~2 s zrychlí (VR 2,8 → 4,6 m/s, počítač 3,6 → 6,5 m/s). Zdi jsou cihlové, podlaha
  kamenná (textury se kreslí v prohlížeči, žádné soubory). Proti nevolnosti: otáčení po skocích a při chůzi se zúží zorné pole.
  Po zdech náhodně visí portréty velikánů češtiny (Hus, Dobrovský, Jungmann, Šafařík, Palacký, Mácha, Němcová)
  v rámu s mosaznou jmenovkou; jsou to volná díla Jana Vilímka, zdroje v `web/portrety/ZDROJE.md`. V k3s jsou
  ve vlastní ConfigMapě `vrskola-portrety` (nginx je servíruje z `/portrety/`).

Každý režim jde hrát **na body**, nebo jako **Cvičení** (přepínač v menu, `?cviceni=1`): správně napsaná slova
jsou zelená, špatně napsaná červená (v Doplňovačce je zelené správné písmeno). Body se nepočítají ani nezapisují
do tabulky, na konci je jen statistika správně / nesprávně.

**Souboj třídy** (třetí přepínač v menu, `?souboj=1`): online tabulka TOP 5 pro každý režim, společná pro všechny děti.
Dítě zadá přezdívku (headset si ji pamatuje), všichni hrají stejně dlouho (`SOUBOJ_CAS`, výchozí 5 min) a výsledek se
pošle na mini server v `server/` (viz níže). V tabulce má každé jméno jen svůj nejlepší výsledek.

Hra trvá 5 minut (`?cas=30` zkrátí), tabulka 3 nejlepších se ukládá v prohlížeči headsetu. Pauza: B/Y (Esc na počítači).
Na počítači jde hrát myší (levé/pravé tlačítko, šipky otáčí).

## Soubory

| Cesta | Co to je |
|---|---|
| `web/index.html` | celá hra |
| `web/slova.js` | seznam vyjmenovaných slov (kopie `smartoped/web/slova.js`) |
| `web/three.module.min.js` | three.js 0.160 |
| `server/server.mjs` | mini server pro Souboj třídy (Node.js 22, bez závislostí) |
| `kustomization.yaml`, `deploy/` | nasazení do k3s |

Lokálně: `cd web && python3 -m http.server 8000` → http://localhost:8000/ (WebXR v headsetu potřebuje https).
Se soubojem: `cd server && SLOVA=../web/slova.js STATIC_DIR=../web SOUBOJ_CAS=20 node server.mjs` → http://localhost:8081/.

## Server pro Souboj třídy

`server/server.mjs` běží na stejné doméně jako hra pod `/api` (Ingress posílá `/api` na Service `vrskola-api`).
Výsledky ukládá do `/data/vysledky.json` na PVC `vrskola-api-data`, takže přežijí restart.

- `GET /api/top?rezim=strelba|mece|karty|bludiste` – TOP 5 a délka souboje
- `POST /api/souboj/start` `{rezim}` – podepsaný jednorázový lístek
- `POST /api/souboj/konec` `{rezim, listek, jmeno, odpovedi}` – vyhodnocení, vrací skóre, pořadí a TOP 5

Proti podvádění: hra neposílá skóre, ale seznam odpovědí (čas, slovo, co dítě zvolilo) a body spočítá server podle
`slova.js`. Lístek je podepsaný (HMAC, klíč se vygeneruje do `/data/klic`), jde použít jen jednou a jen když od startu
uběhla celá délka souboje. Moc rychlé odpovědi (méně než 60 ms po sobě, víc než 2,5 správných za sekundu) se nezapočítají.
Zkušený programátor by to obejít uměl, dítě s vývojářskými nástroji v prohlížeči ne.

**Učitel** (mazání tabulky) potřebuje heslo v Secretu, bez něj je mazání vypnuté:

```sh
kubectl -n vrskola create secret generic vrskola-api-admin --from-literal=token=$(openssl rand -hex 16)
kubectl -n vrskola rollout restart deploy/vrskola-api
H="Authorization: Bearer <token>"
curl -H "$H" https://<host>/api/admin/top                                  # všechny výsledky
curl -H "$H" -X DELETE "https://<host>/api/admin/top?rezim=strelba"        # smazat tabulku Střelnice (bez rezim = všechny)
curl -H "$H" -X DELETE "https://<host>/api/admin/top?jmeno=Pepa"           # odebrat jedno jméno ze všech režimů
```

Délka souboje: `SOUBOJ_CAS` v `deploy/api-deployment.yaml` (sekundy).

## Nasazení do k3s

Žádný image ani CI: `kustomization.yaml` zabalí soubory z `web/` do ConfigMapy `vrskola-web` a servíruje je
neupravený `nginxinc/nginx-unprivileged:1.29-alpine` (pinnutý digest). Změna v `web/` změní hash ConfigMapy,
takže se Deployment při dalším nasazení sám přerolluje.

Co vznikne (namespace `vrskola`): Namespace, ConfigMapy `vrskola-web-<hash>`, `vrskola-nginx-<hash>` a `vrskola-api-<hash>`,
Deployment `vrskola-api` + Service + PVC `vrskola-api-data` (64 Mi, k3s `local-path`),
Deployment `vrskola` (1 replika, port 8080, `/healthz`), Service `vrskola` (port 80), Ingress `vrskola` (Traefik, TLS).

Před nasazením:

1. V `deploy/ingress.yaml` nastavit hostname (místo `vrskola.example.com`, 2×) a DNS záznam na k3s.
2. Tamtéž nastavit `cert-manager.io/cluster-issuer` na ClusterIssuer, který v clusteru existuje
   (WebXR bez https v Questu nepoběží). Bez cert-manageru anotaci smazat a dodat Secret `vrskola-tls` jinak.

Nasazení:

```sh
kubectl apply --server-side -k .
```

`--server-side` je nutné: ConfigMapa má ~750 kB a klasický `kubectl apply` by ji nevložil do anotace
last-applied (limit 256 kB). Flux (GitRepository na toto repo + Kustomization s `path: ./`) používá server-side apply sám.

Kontrola: `kubectl -n vrskola rollout status deploy/vrskola deploy/vrskola-api`, `curl https://<host>/api/top?rezim=strelba`, pak `https://<host>/` v prohlížeči Questu.
