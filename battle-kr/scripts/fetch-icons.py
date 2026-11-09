#!/usr/bin/env python3
"""쇼다운 포켓몬 작은 아이콘(박스 아이콘, 40×30 도트) 묶음을 받아 앱에 넣는다.

- 그림: play.pokemonshowdown.com/sprites/pokemonicons-sheet.png (12열 × 30px 줄, 1~9세대·모습 전부)
  → battle-kr/public/pokeicons.png (원본 그대로, 배경색은 PNG 투명 지정)
- 번호표: 쇼다운 클라이언트 battle-dex-data.ts 의 BattlePokemonIconIndexes (모습별 번호)
  → battle-kr/src/gen/icon-index.json  (없는 포켓몬은 도감 번호 = 아이콘 번호)

PokeAPI 의 아이콘은 8세대(소드·실드)까지만 있어 9세대·모습이 빠지므로 쇼다운 것을 쓴다.
"""
import io, json, os, re, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SHEET = 'https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png'
DATA = 'https://raw.githubusercontent.com/smogon/pokemon-showdown-client/master/play.pokemonshowdown.com/src/battle-dex-data.ts'

def get(url):
	with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'battlesim-kr-build'})) as r:
		return r.read()

def block(src, name):
	m = re.search(r'export const ' + name + r'[^=]*=\s*\{(.*?)\n\};', src, re.S)
	out = {}
	for k, v in re.findall(r'^\s*([a-z0-9]+):\s*([0-9 +]+),', m.group(1), re.M):
		out[k] = eval(v)  # "1032 + 2" 같은 덧셈만
	return out

raw = get(SHEET)
img = Image.open(io.BytesIO(raw))
assert 'transparency' in img.info  # 원본이 이미 배경색 투명 지정(tRNS)이라 그대로 씀 (RGBA 로 바꾸면 두 배 커짐)
open(os.path.join(APP, 'public/pokeicons.png'), 'wb').write(raw)

src = get(DATA).decode()
idx = block(src, 'BattlePokemonIconIndexes')
json.dump({'w': 40, 'h': 30, 'cols': 12, 'rows': img.height // 30, 'idx': idx}, open(os.path.join(APP, 'src/gen/icon-index.json'), 'w'), separators=(',', ':'))
print('icons', img.size, 'forms', len(idx))
