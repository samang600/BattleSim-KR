#!/usr/bin/env python3
"""9세대 포켓몬의 진짜 뒷모습 도트 그림을 PokeAPI/sprites 에서 받아 src/sprites-custom/<그림 id>-back[-shiny].png 로 넣는다.
쇼다운 서버의 gen5-back 9세대 그림은 앞모습을 좌우로 뒤집은 것이라(뒷모습이 아님) 대신 씀. 뒷모습 그림: DoveKyle (PokeAPI/sprites 제공).
이미 직접 넣은 뒷모습이 있으면 건너뜀. 받은 그림이 앞모습 반전과 거의 같으면(뒷모습이 아니면) 넣지 않음.
사용법: python3 battle-kr/scripts/fetch-gen9-backs.py   (끝나면 src/gen/sprite-pad.json 의 뒷모습 바닥 여백도 갱신)"""
import csv, io, json, os, re, urllib.request
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'sprites-custom')
RAW = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/'
SD = 'https://play.pokemonshowdown.com/sprites/gen5/'
UA = {'User-Agent': 'Mozilla/5.0 (BattleSimKR sprite tool)'}
# 쇼다운 그림 id → PokeAPI 이름 (번호로 못 찾는 모습)
FORMS = {
	'oinkologne-f': 'oinkologne-female', 'maushold': 'maushold-family-of-three', 'maushold-four': 'maushold-family-of-four',
	'squawkabilly': 'squawkabilly-green-plumage', 'squawkabilly-blue': 'squawkabilly-blue-plumage', 'squawkabilly-yellow': 'squawkabilly-yellow-plumage',
	'squawkabilly-white': 'squawkabilly-white-plumage', 'palafin': 'palafin-zero', 'palafin-hero': 'palafin-hero', 'tatsugiri': 'tatsugiri-curly',
	'tatsugiri-droopy': 'tatsugiri-droopy', 'tatsugiri-stretchy': 'tatsugiri-stretchy', 'dudunsparce': 'dudunsparce-two-segment',
	'dudunsparce-threesegment': 'dudunsparce-three-segment', 'gimmighoul-roaming': 'gimmighoul-roaming', 'ogerpon-wellspring': 'ogerpon-wellspring-mask',
	'ogerpon-hearthflame': 'ogerpon-hearthflame-mask', 'ogerpon-cornerstone': 'ogerpon-cornerstone-mask', 'terapagos-terastal': 'terapagos-terastal',
	'terapagos-stellar': 'terapagos-stellar', 'tauros-paldeacombat': 'tauros-paldea-combat-breed', 'tauros-paldeablaze': 'tauros-paldea-blaze-breed',
	'tauros-paldeaaqua': 'tauros-paldea-aqua-breed', 'wooper-paldea': 'wooper-paldea', 'oinkologne': 'oinkologne-male',
	'wochien': 'wo-chien', 'chienpao': 'chien-pao', 'tinglu': 'ting-lu', 'chiyu': 'chi-yu',
}

def get(url):
	try: return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()
	except Exception: return None

def sprite_id(en):
	if en in ('Chien-Pao', 'Chi-Yu', 'Ting-Lu', 'Wo-Chien'): return re.sub(r'[^a-z0-9]', '', en.lower())   # 앱 spriteId 와 같게 붙여 씀
	parts = en.split('-', 1)
	base = re.sub(r'[^a-z0-9]', '', parts[0].lower())
	return base + ('-' + re.sub(r'[^a-z0-9]', '', parts[1].lower()) if len(parts) > 1 else '')

def pad(im):
	a = im.split()[3]; w, h = im.size
	for y in range(h - 1, -1, -1):
		if any(a.getpixel((x, y)) > 20 for x in range(w)): return h - 1 - y
	return 0

def main():
	dex = json.load(open(os.path.join(HERE, '..', 'src', 'gen', 'dex.json')))['species']
	pk = {r['identifier']: int(r['id']) for r in csv.DictReader(io.StringIO(get('https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv').decode()))}
	ids = {}
	for k, s in dex.items():
		if not s['g'].get('9') or not (s.get('num', 0) >= 906 or k in ('taurospaldeacombat', 'taurospaldeablaze', 'taurospaldeaaqua', 'wooperpaldea')): continue
		sid = sprite_id(s['en'])
		if sid.endswith('mega') or '-mega' in sid: continue          # 레전즈 Z-A 메가는 fetch-za-megas.py
		name = FORMS.get(sid) or FORMS.get(sid.replace('-', '')) or sid
		num = pk.get(name) or (s['num'] if '-' not in sid else None)
		if num: ids[sid] = num
	padf = os.path.join(HERE, '..', 'src', 'gen', 'sprite-pad.json'); pads = json.load(open(padf))
	got = skip = bad = 0
	for sid, num in sorted(ids.items()):
		if os.path.exists(os.path.join(OUT, sid + '-back.png')): skip += 1; continue
		back = get(f'{RAW}back/{num}.png')
		if not back: bad += 1; print('없음:', sid, num); continue
		b = Image.open(io.BytesIO(back)).convert('RGBA')
		front = get(f'{SD}{sid}.png')
		if front:   # 받은 뒷모습이 앞모습 반전이면 넣지 않음
			f = ImageOps.mirror(Image.open(io.BytesIO(front)).convert('RGBA'))
			if f.size == b.size and sum(1 for p, q in zip(f.getdata(), b.getdata()) if p == q and p[3] > 20) > 0.8 * max(1, sum(1 for p in b.getdata() if p[3] > 20)):
				bad += 1; print('반전 그림:', sid); continue
		b.save(os.path.join(OUT, sid + '-back.png'), optimize=True)
		sh = get(f'{RAW}back/shiny/{num}.png')
		if sh: Image.open(io.BytesIO(sh)).convert('RGBA').save(os.path.join(OUT, sid + '-back-shiny.png'), optimize=True)
		e = pads.setdefault(sid, [0, 0, 0, 0, 96, 96]); e[1] = pad(b)
		got += 1
	json.dump(pads, open(padf, 'w'), separators=(',', ':'))
	print(f'9세대 뒷모습: 받음 {got}, 이미 있음 {skip}, 못 넣음 {bad}')

if __name__ == '__main__':
	main()
