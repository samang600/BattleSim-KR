#!/usr/bin/env python3
"""트레이너 초상화 묶음 만들기 — 시나리오 모드 시안용 (픽셀 아트, 두 가지를 섞어 씀).

1) 네임드 인물: 사용자가 준 상반신 그림(832×1216 PNG, 흰 배경, 파일 이름 = 영어 이름)을 픽셀 아트로
   - 배경 지우기: 애니메이션 그림용 분할 모델(rembg 의 isnet-anime)로 인물 영역을 찾음
     → 팔과 허리 사이·머리카락 사이처럼 안쪽에 갇힌 흰 배경도 지워지고, 흰 옷은 남음
   - 120×176 으로 줄이고 색을 32색으로, 투명도는 켜짐/꺼짐만, 어두운 외곽선 1px → <id>.png (id = 영어 이름의 소문자·숫자)
2) 일반 트레이너(직업): 그림과 원작의 성별·모습이 안 맞는 경우가 많아 쇼다운 도트(80×80)를 그대로 키움
   - 머리~허리(위 62%)를 잘라 도트 전용 확대(Scale2x 두 번 = 4배, 색을 섞지 않음) → d_<쇼다운 그림 id>.png

출력: <출력>/*.png, <출력>/index.json
사용: python3 make-portraits.py <그림 폴더> <출력 폴더>      (pip install "rembg[cpu]" 필요, 처음에 모델 176MB 를 받음)
"""
import io, json, os, re, sys, urllib.request
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1:3]
HERE = os.path.dirname(os.path.abspath(__file__))
W, H, COLORS = 120, 176, 32
pid = lambda name: re.sub(r'[^a-z0-9]', '', name.lower())


def pixelize(im, mask):
	"""상반신 그림 + 인물 마스크 → 픽셀 아트"""
	im = im.convert('RGB'); im.putalpha(mask)
	# 투명한 곳의 색이 줄일 때 번지지 않게: 알파를 곱해 줄인 뒤 되돌림
	a = np.asarray(im).astype(np.float64); a[..., :3] *= a[..., 3:4] / 255
	sm = np.asarray(Image.fromarray(a.astype(np.uint8), 'RGBA').resize((W, H), Image.BOX)).astype(np.float64)
	al = sm[..., 3]
	rgb = np.where(al[..., None] > 0, sm[..., :3] * 255 / np.maximum(al[..., None], 1), 0).clip(0, 255).astype(np.uint8)
	solid = al > 128
	q = np.asarray(Image.fromarray(rgb, 'RGB').quantize(COLORS, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')).copy()
	pad = np.pad(solid, 1)
	edge = solid & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
	edge[-1, :] = False   # 아래는 잘린 곳이라 외곽선 없음
	q[edge] = (q[edge] * 0.35).astype(np.uint8)
	return Image.fromarray(np.dstack([q, np.where(solid, 255, 0).astype(np.uint8)]), 'RGBA')


def epx(a):
	"""Scale2x(EPX): 도트 그림 2배 확대 — 색을 섞지 않고 대각선 계단만 다듬음"""
	p = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode='edge')
	A, B, C, D = p[:-2, 1:-1], p[1:-1, 2:], p[1:-1, :-2], p[2:, 1:-1]
	eq = lambda x, y: (x == y).all(-1)
	o = np.repeat(np.repeat(a, 2, 0), 2, 1)
	m1 = eq(C, A) & ~eq(C, D) & ~eq(A, B); m2 = eq(A, B) & ~eq(A, C) & ~eq(B, D); m3 = eq(D, C) & ~eq(D, B) & ~eq(C, A); m4 = eq(B, D) & ~eq(B, A) & ~eq(D, C)
	o[0::2, 0::2][m1] = A[m1]; o[0::2, 1::2][m2] = B[m2]; o[1::2, 0::2][m3] = C[m3]; o[1::2, 1::2][m4] = D[m4]
	return o


def dot_portrait(sprite):
	"""쇼다운 트레이너 도트 → 상반신 4배"""
	try:
		with urllib.request.urlopen(urllib.request.Request(f'https://play.pokemonshowdown.com/sprites/trainers/{sprite}.png', headers={'User-Agent': 'battlesim-kr-build'}), timeout=20) as r: raw = r.read()
	except Exception: return None
	im = Image.open(io.BytesIO(raw)).convert('RGBA'); bb = im.getbbox()
	if not bb: return None
	im = im.crop(bb); im = im.crop((0, 0, im.width, max(8, int(im.height * 0.62))))
	a = np.asarray(im).copy(); a[a[..., 3] < 128] = 0
	return Image.fromarray(epx(epx(a)), 'RGBA')


if __name__ == '__main__':
	from rembg import new_session, remove
	os.makedirs(OUT, exist_ok=True)
	sess = new_session('isnet-anime')
	ids = []
	for f in sorted(os.listdir(SRC)):
		if not f.lower().endswith('.png'): continue
		im = Image.open(os.path.join(SRC, f)).convert('RGBA')
		mask = remove(im, session=sess, only_mask=True)
		i = pid(f[:-4]); pixelize(im, mask).save(os.path.join(OUT, i + '.png'), optimize=True); ids.append(i)
	print('픽셀 초상화', len(ids))
	# 일반 트레이너: 직업 목록(gen/trainer-classes.json)의 그림 + 시나리오에 나오는 것
	tc = json.load(open(os.path.join(HERE, '..', 'src', 'gen', 'trainer-classes.json')))
	sprites = sorted({s for c in tc['classes'] for s in (c.get('sprites_m') or [])[:1] + (c.get('sprites_f') or [])[:1]} | {'rocketgrunt', 'rocketgruntf', 'camper', 'youngster', 'supernerd', 'bugcatcher', 'hiker', 'lass', 'picnicker'})
	dots = []
	for sp in sprites:
		im = dot_portrait(sp)
		if im: im.save(os.path.join(OUT, f'd_{sp}.png'), optimize=True); dots.append('d_' + sp)
	print('도트 초상화', len(dots), '/', len(sprites))
	json.dump(sorted(ids + dots), open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'))
