#!/usr/bin/env python3
"""움직이는 도트 그림 묶음 만들기 (개발자 빌드 시험용).

원본: Pokémon Essentials 용 「Animated Pokemon System」의 그림 묶음(가로로 이어 붙인 프레임 띠 PNG, 프레임 = 높이×높이)
      https://eeveeexpo.com/resources/1544/  — 만든 이·기여자는 출력 폴더의 CREDITS.md 참고
하는 일:
  1. 묶음의 Front/Back 그림 이름(SPECIES, SPECIES_폼번호, SPECIES_female)을 앱의 포켓몬 id 로 짝지음 (폼 이름은 Essentials PBS 의 FormName)
  2. 프레임 띠를 움직이는 WebP(무손실)로 바꿈 — 모든 프레임에서 그림이 있는 범위만 남기고 아래를 맞춰 자름(발이 그림 맨 아래 = 바닥 여백 0)
  3. <출력>/front/<그림id>.webp · back/<그림id>.webp 와 앱에 넣는 목록 src/gen/ani-index.json

사용: python3 make-ani-sprites.py <묶음.zip> <forms.json> <ids.json> <출력 폴더>
  forms.json: {"SPECIES_번호": "FormName"} (Essentials PBS pokemon_forms*.txt 에서 뽑음)
  ids.json:   [{"id","sid","base","forme"}] (앱 RAW.species + 쇼다운 Pokedex 의 이름)
"""
import collections, io, json, os, re, sys, zipfile
from multiprocessing import Pool
from PIL import Image

ZIP, FORMS, IDS, OUT = sys.argv[1:5]
P = 'Animated Pokemon Sprites/Graphics/Pokemon/'
FRAME_MS = 60
HERE = os.path.dirname(os.path.abspath(__file__))

SYN = {'alola': 'alolan', 'galar': 'galarian', 'hisui': 'hisuian', 'paldea': 'paldean', 'gmax': 'gigantamax', 'f': 'female',
       'rapidstrike': 'rapid strike', 'low': 'low key', 'lowkey': 'low key', 'dawnwings': 'dawn wings', 'duskmane': 'dusk mane',
       'pompom': 'pom-pom', 'pau': "pa'u", 'starter': None}
# 손으로 맞춘 것 (기본 모습이 서로 다르거나 이름으로 못 찾는 것)
MANUAL = {'nidoranf': 'NIDORANfE', 'nidoranm': 'NIDORANmA', 'greninjabond': 'GRENINJA', 'greninjamega': 'GRENINJA_3', 'meowsticfmega': 'MEOWSTIC_3',
          'pumpkaboosmall': 'PUMPKABOO', 'pumpkaboolarge': 'PUMPKABOO', 'pumpkaboosuper': 'PUMPKABOO', 'gourgeistsmall': 'GOURGEIST', 'gourgeistlarge': 'GOURGEIST', 'gourgeistsuper': 'GOURGEIST',
          'rockruffdusk': 'ROCKRUFF', 'minior': 'MINIOR_7', 'miniormeteor': 'MINIOR', 'sinisteaantique': 'SINISTEA', 'polteageistantique': 'POLTEAGEIST',
          'zarudedada': 'ZARUDE_1', 'maushold': 'MAUSHOLD_1', 'mausholdfour': 'MAUSHOLD'}


def match(ids, forms, front):
	key = lambda s: re.sub(r'[^A-Z0-9]', '', s.upper())
	by = collections.defaultdict(dict)
	for k, n in forms.items():
		sp, f = k.rsplit('_', 1); by[sp][int(f)] = n
	out, miss = {}, []
	for x in ids:
		sp, forme = key(x['base']), x['forme']
		if x['id'] in MANUAL:
			if MANUAL[x['id']] in front: out[x['id']] = MANUAL[x['id']]
			else: miss.append(x['id'])
			continue
		if not forme:
			if sp in front: out[x['id']] = sp
			else: miss.append(x['id'])
			continue
		toks = [t.lower() for t in re.split(r'[-\s]', forme) if t]
		if toks == ['f'] and sp + '_female' in front: out[x['id']] = sp + '_female'; continue
		best = None
		for fnum, name in by.get(sp, {}).items():
			nm, ok = name.lower(), True
			for t in toks:
				want = SYN.get(t, t)
				if want is None: ok = False; break
				if t in ('x', 'y', 'z'): ok = ok and bool(re.search(r'\b' + t + r'\b', nm))
				elif want not in nm and t not in nm: ok = False
			if ok and toks == ['mega'] and re.search(r'\b[xyz]\b', nm): ok = False
			if ok and 'gigantamax' in nm and 'gmax' not in toks: ok = False
			if ok and 'mega' in nm.split() and not any(t.startswith('mega') for t in toks): ok = False
			if ok and (best is None or len(nm) < len(by[sp][best])): best = fnum
		f = f'{sp}_{best}' if best is not None else None
		if f and f in front: out[x['id']] = f
		else: miss.append(x['id'])
	return out, miss


def convert(job):
	side, src, sid = job
	z = zipfile.ZipFile(ZIP)
	im = Image.open(io.BytesIO(z.read(f'{P}{"Front" if side == "front" else "Back"}/{src}.png'))).convert('RGBA')
	h = im.height; n = max(1, im.width // h)
	frames = [im.crop((i * h, 0, i * h + h, h)) for i in range(n)]
	bb = None
	for f in frames:
		b = f.getbbox()
		if b: bb = b if bb is None else (min(bb[0], b[0]), min(bb[1], b[1]), max(bb[2], b[2]), max(bb[3], b[3]))
	if bb is None: return side, sid, 0, 0
	# 가로는 프레임 가운데를 기준으로 좌우 같은 폭(가운데 맞춤 유지), 세로는 그림이 있는 범위만 (아래 = 발)
	half = max(h / 2 - bb[0], bb[2] - h / 2); x0, x1 = int(h / 2 - half), int(h / 2 + half + 0.5)
	frames = [f.crop((x0, bb[1], x1, bb[3])) for f in frames]
	# 이어지는 같은 프레임은 하나로 (길이만 늘림)
	out, dur = [frames[0]], [FRAME_MS]
	for f in frames[1:]:
		if f.tobytes() == out[-1].tobytes(): dur[-1] += FRAME_MS
		else: out.append(f); dur.append(FRAME_MS)
	path = os.path.join(OUT, side, sid + '.webp')
	out[0].save(path, save_all=True, append_images=out[1:], duration=dur, loop=0, lossless=True, method=6, minimize_size=True)
	return side, sid, len(out), os.path.getsize(path)


if __name__ == '__main__':
	ids, forms = json.load(open(IDS)), json.load(open(FORMS))
	names = zipfile.ZipFile(ZIP).namelist()
	have = {d: {os.path.basename(n)[:-4] for n in names if n.startswith(f'{P}{d}/') and n.lower().endswith('.png')} for d in ('Front', 'Back')}
	m, miss = match(ids, forms, have['Front'])
	sid = {x['id']: x['sid'] for x in ids}
	for d in ('front', 'back'): os.makedirs(os.path.join(OUT, d), exist_ok=True)
	jobs = [('front', src, sid[i]) for i, src in m.items()] + [('back', src, sid[i]) for i, src in m.items() if src in have['Back']]
	jobs = list({(a, c): (a, b, c) for a, b, c in jobs}.values())   # 같은 그림 id 는 한 번
	with Pool() as pool: res = pool.map(convert, jobs, chunksize=8)
	front = sorted(s for d, s, n, _ in res if d == 'front' and n)
	back = set(s for d, s, n, _ in res if d == 'back' and n)
	# 앱 목록: 앞모습이 있는 그림 id (뒷모습이 없는 것만 따로)
	idx = {'ms': FRAME_MS, 'ids': front, 'noBack': sorted(s for s in front if s not in back)}
	json.dump(idx, open(os.path.join(HERE, '..', 'src', 'gen', 'ani-index.json'), 'w'), separators=(',', ':'))
	json.dump(idx, open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'))
	tot = collections.Counter();
	for d, s, n, sz in res: tot[d] += sz
	print('짝지음', len(m), '/', len(ids), '· 못 찾음', miss)
	print('앞', len(front), '뒤', len(back), '· 크기(MB)', {k: round(v / 1e6, 1) for k, v in tot.items()}, '· 1프레임(정지)', sum(1 for d, s, n, _ in res if n == 1))
