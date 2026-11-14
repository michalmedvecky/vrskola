#!/usr/bin/env bash
# Přegeneruje přibalené písmo pro sadu se znaky (čínština): podmnožina Noto Sans SC Bold jen se znaky,
# které sada opravdu používá (~150 znaků ≈ 60 kB místo 10 MB celého písma).
# Headset Quest nemusí mít čínské písmo, proto ho hra stáhne a načte sama (pole "pismo" v sadě).
#
# Použití:  nastroje/pismo-podmnozina.sh [sada]      (výchozí sada: cinstina)
# Potřebuje: python3, pip install fonttools brotli, curl, tar
set -euo pipefail
cd "$(dirname "$0")/.."
SADA="${1:-cinstina}"
JSON="web/sady/$SADA.json"
VYSTUP="web/$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['pismo'])" "$JSON")"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
# Noto Sans SC (SIL OFL 1.1) – celé TTF jsou v npm balíčku @expo-google-fonts/noto-sans-sc
curl -sSfL https://registry.npmjs.org/@expo-google-fonts/noto-sans-sc/-/noto-sans-sc-0.4.4.tgz | tar xz -C "$TMP"
FONT="$TMP/package/700Bold/NotoSansSC_700Bold.ttf"

# všechny znaky CJK (U+2E80 a výš) ze sady + čínská interpunkce
python3 - "$JSON" > "$TMP/znaky.txt" <<'PY'
import json, sys
d = json.load(open(sys.argv[1], encoding='utf-8'))
z = {c for g in d['skupiny'] for p in g['polozky'] for c in p if ord(c) >= 0x2E80}
z |= set('，。？！、：；（）')
print(''.join(sorted(z)), end='')
PY
pyftsubset "$FONT" --text-file="$TMP/znaky.txt" --flavor=woff2 --layout-features='*' \
  --no-hinting --desubroutinize --output-file="$VYSTUP"
echo "$VYSTUP: $(wc -c < "$VYSTUP") B, $(LC_ALL=C.UTF-8 wc -m < "$TMP/znaky.txt") znaků"
