#!/usr/bin/env bash
# 오프라인용 그림(public/sprites)과 울음소리(public/cries)를 받는다 (Pokémon Showdown 스프라이트 서버).
#  - 포켓몬: gen5 정지 그림 (앞/뒤 × 일반/색이 다른) — 오프라인일 때·정지 그림 설정일 때 사용
#  - 트레이너 그림, 도구 아이콘 시트
# 이미 받은 파일은 건너뛴다. 사용법: bash battle-kr/scripts/fetch-sprites.sh
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HERE/public/sprites"
HOST="https://play.pokemonshowdown.com/sprites"
mkdir -p "$HERE/public/cries"
mkdir -p "$OUT"/{gen5,gen5-back,gen5-shiny,gen5-back-shiny,trainers,substitutes/gen5,substitutes/gen5-back}

LIST="$(mktemp)"
npx --yes esbuild "$HERE/scripts/list-sprites.ts" --bundle --platform=node --log-level=error \
	--outfile="$LIST.cjs" && node "$LIST.cjs" "$HERE/src" > "$LIST"
rm -f "$LIST.cjs"

jobs_file="$(mktemp)"
while read -r kind id; do
	if [ "$kind" = poke ]; then
		for d in gen5 gen5-back gen5-shiny gen5-back-shiny; do echo "$d/$id.png"; done
	elif [ "$kind" = cry ]; then
		echo "../cries/$id.mp3"
	else
		echo "trainers/$id.png"
	fi
done < "$LIST" > "$jobs_file"
printf "itemicons-sheet.png\nsubstitutes/gen5/substitute.png\nsubstitutes/gen5-back/substitute.png\n" >> "$jobs_file"

fetch_one() {
	local rel="$1"
	[ -s "$OUT/$rel" ] && return 0
	local code
	local url="$HOST/$rel"
	case "$rel" in ../cries/*) url="https://play.pokemonshowdown.com/audio/cries/${rel#../cries/}";; esac
	code=$(curl -s -o "$OUT/$rel.part" -w '%{http_code}' "$url")
	if [ "$code" = 200 ]; then mv "$OUT/$rel.part" "$OUT/$rel"; else rm -f "$OUT/$rel.part"; echo "없음: $rel"; fi
}
export -f fetch_one
export OUT HOST
xargs -P 24 -I{} bash -c 'fetch_one "$@"' _ {} < "$jobs_file"
rm -f "$LIST" "$jobs_file"
python3 "$HERE/scripts/fetch-za-megas.py"
# 직접 만든 그림(src/sprites-custom/<id>.png, <id>-shiny.png)으로 서버 그림을 덮어씀
for f in "$HERE"/src/sprites-custom/*.png; do
  [ -e "$f" ] || continue; n=$(basename "$f" .png)
  case "$n" in *-shiny) cp "$f" "$OUT/gen5-shiny/${n%-shiny}.png" ;; *) cp "$f" "$OUT/gen5/$n.png" ;; esac
done
python3 "$HERE/scripts/make-offline-zips.py"
python3 "$HERE/scripts/sprite-pad.py" 2>/dev/null || echo "(PIL 없음: sprite-pad.json 생략)"
echo "완료: 그림 $(find "$OUT" -name '*.png' | wc -l)개 $(du -sh "$OUT" | cut -f1), 울음소리 $(find "$HERE/public/cries" -name '*.mp3' | wc -l)개 $(du -sh "$HERE/public/cries" | cut -f1)"
