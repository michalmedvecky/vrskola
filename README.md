# VR škola

VR hry pro Oculus Quest 2 na procvičování vyjmenovaných slov (WebXR, three.js 0.160 přibalené).
Přesunuto z repa `smartoped` (`web/vr/`), stav včetně pauzy a tlačítka Opustit VR.

## Režimy

- **Střelnice** – pravá (zelená) pistole střílí správně napsaná slova, levá (červená) špatně napsaná; max 42 slov ve 360°.
- **Meče** – slova letí po dráze proti hráči, zelený meč seká správná, červený špatná (`?rezim=mece`).
- **Doplňovačka** – karty s mezerou místo y/i, hráč vystřelí správné písmeno (`?rezim=karty`).

Hra trvá 5 minut (`?cas=30` zkrátí), tabulka 3 nejlepších se ukládá v prohlížeči headsetu. Pauza: B/Y (Esc na počítači).
Na počítači jde hrát myší (levé/pravé tlačítko, šipky otáčí).

## Soubory

| Cesta | Co to je |
|---|---|
| `web/index.html` | celá hra |
| `web/slova.js` | seznam vyjmenovaných slov (kopie `smartoped/web/slova.js`) |
| `web/three.module.min.js` | three.js 0.160 |
| `kustomization.yaml`, `deploy/` | nasazení do k3s |

Lokálně: `cd web && python3 -m http.server 8000` → http://localhost:8000/ (WebXR v headsetu potřebuje https).

## Nasazení do k3s

Žádný image ani CI: `kustomization.yaml` zabalí soubory z `web/` do ConfigMapy `vrskola-web` a servíruje je
neupravený `nginxinc/nginx-unprivileged:1.29-alpine` (pinnutý digest). Změna v `web/` změní hash ConfigMapy,
takže se Deployment při dalším nasazení sám přerolluje.

Co vznikne (namespace `vrskola`): Namespace, ConfigMapy `vrskola-web-<hash>` a `vrskola-nginx-<hash>`,
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

Kontrola: `kubectl -n vrskola rollout status deploy/vrskola`, pak `https://<host>/` v prohlížeči Questu.
