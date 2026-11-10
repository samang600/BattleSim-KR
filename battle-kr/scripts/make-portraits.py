#!/usr/bin/env python3
"""트레이너 초상화 묶음 만들기 — 시나리오 모드 시안용 (픽셀 아트, 두 가지를 섞어 씀).

1) 네임드 인물: 사용자가 준 상반신 그림(832×1216 PNG, 흰 배경, 파일 이름 = 영어 이름)을 픽셀 아트로
   - 배경 지우기: 애니메이션 그림용 분할 모델(rembg 의 isnet-anime)로 인물 영역을 찾음
     → 팔과 허리 사이·머리카락 사이처럼 안쪽에 갇힌 흰 배경도 지워지고, 흰 옷은 남음
   - 면을 평평하게(mean shift) → 4픽셀을 1칸으로(208×304, 칸의 가운데값) → 24색 → 외톨이 점 지우기 → 선은 1칸, 검정이 아니라 그 자리 색을 어둡게 한 색
     → 바깥에 진한 선 1칸 + 흰 선 1칸 → <id>.png (id = 영어 이름의 소문자·숫자)
2) 일반 트레이너(직업): 그림과 원작의 성별·모습이 안 맞는 경우가 많아 쇼다운 도트(80×80)를 그대로 키움
   - 머리~허리(위 62%)를 잘라 도트 전용 확대(Scale2x 두 번 = 4배, 색을 섞지 않음) → d_<쇼다운 그림 id>.png

출력: <출력>/*.png, <출력>/index.json
사용: python3 make-portraits.py <그림 폴더> <출력 폴더>      (pip install "rembg[cpu]" opencv-python-headless scikit-learn 필요, 처음에 모델 176MB 를 받음)
"""
import io, json, os, re, sys, urllib.request
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1:3]
HERE = os.path.dirname(os.path.abspath(__file__))
S, COLORS = 4, 24   # 원본 4픽셀 = 1칸 (832×1216 → 208×304), 24색
pid = lambda name: re.sub(r'[^a-z0-9]', '', name.lower())


def mode3(idx):
	"""외톨이 점 지우기: 같은 색 이웃이 1칸 이하면 주변 3×3 에서 가장 많은 색으로"""
	h, w = idx.shape; p = np.pad(idx, 1, mode='edge'); nb = np.stack([p[i:i + h, j:j + w] for i in range(3) for j in range(3)], -1)
	cnt = (nb[..., :, None] == nb[..., None, :]).sum(-1); best = np.take_along_axis(nb, cnt.argmax(-1)[..., None], -1)[..., 0]
	return np.where((nb == idx[..., None]).sum(-1) <= 2, best, idx)


def darker(rgb, v):
	"""선 색: 검정이 아니라 그 자리 면 색을 어둡고 조금 진하게"""
	import cv2
	hsv = cv2.cvtColor(rgb[None].astype(np.uint8), cv2.COLOR_RGB2HSV).astype(float)[0]
	hsv[:, 2] *= v; hsv[:, 1] = np.minimum(255, hsv[:, 1] * 1.2 + 25 * (hsv[:, 1] > 20)); hsv[:, 0] = (hsv[:, 0] + 4) % 180
	return cv2.cvtColor(hsv[None].astype(np.uint8), cv2.COLOR_HSV2RGB)[0]


def pixelize(im, mask):
	"""상반신 그림 + 인물 마스크 → 깔끔한 픽셀 아트 (평평한 면 + 색 맞춘 1칸 선 + 외곽선)"""
	import cv2
	from sklearn.cluster import KMeans
	mask = np.asarray(mask); a = cv2.cvtColor(np.asarray(im.convert('RGB')), cv2.COLOR_RGB2BGR)
	g = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY)
	# 선: 주변보다 뚜렷이 어두운 가는 곳
	line = cv2.morphologyEx(g, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))).astype(int) - g > 34
	# 면: 선 자리를 주변 색으로 메운 뒤 평평하게 → 선 색이 면에 번지지 않아 얼굴·눈이 또렷함
	fill = cv2.inpaint(a, cv2.dilate(line.astype(np.uint8), np.ones((3, 3), np.uint8)) * 255, 3, cv2.INPAINT_TELEA)
	sm = cv2.pyrMeanShiftFiltering(fill, 6, 22)
	h, w = g.shape[0] // S, g.shape[1] // S
	blk = lambda x: x[:h * S, :w * S].reshape(h, S, w, S, *x.shape[2:]).swapaxes(1, 2).reshape(h, w, S * S, *x.shape[2:])
	solid = blk(mask).mean(2) > 128
	face = np.median(blk(sm).astype(float), axis=2).astype(np.uint8)   # 칸의 색 = 가운데값 (섞인 색이 안 생김)
	km = KMeans(COLORS, n_init=2, random_state=0).fit(cv2.cvtColor(face, cv2.COLOR_BGR2LAB).astype(float)[solid])
	idx = np.zeros((h, w), int); idx[solid] = km.labels_; idx = mode3(mode3(idx))
	pal = cv2.cvtColor(km.cluster_centers_.clip(0, 255).astype(np.uint8)[None], cv2.COLOR_LAB2BGR)[0][:, ::-1]
	out = pal[idx].astype(np.uint8)
	lr = blk(line).mean(2); ln = (lr > 0.34) & solid; out[ln] = darker(pal, 0.45)[idx[ln]]
	vd = ln & (np.min(blk(g), axis=2) < 40) & (lr > 0.6); out[vd] = darker(pal, 0.28)[idx[vd]]   # 눈동자·속눈썹처럼 원래 아주 검은 곳은 더 진하게
	# 바깥: 진한 선 1칸(그 자리 색을 어둡게) + 흰 선 1칸
	sp = np.pad(solid, 2); res = np.zeros((h + 4, w + 4, 4), np.uint8); res[2:-2, 2:-2, :3] = out; res[..., 3] = sp * 255
	inner = sp & ~(np.roll(sp, 1, 0) & np.roll(sp, -1, 0) & np.roll(sp, 1, 1) & np.roll(sp, -1, 1))
	res[inner, :3] = darker(pal, 0.36)[np.pad(idx, 2)[inner]]
	wh = (np.roll(sp, 1, 0) | np.roll(sp, -1, 0) | np.roll(sp, 1, 1) | np.roll(sp, -1, 1)) & ~sp; res[wh] = (255, 255, 255, 255)
	return Image.fromarray(res[:-2], 'RGBA')   # 아래는 잘린 곳이라 외곽선 없음


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
		i = pid(f[:-4]); ids.append(i); dst = os.path.join(OUT, i + '.png')
		if os.path.exists(dst): continue   # 끊겼다 다시 돌릴 때 이어서
		im = Image.open(os.path.join(SRC, f)).convert('RGBA')
		pixelize(im, remove(im, session=sess, only_mask=True)).save(dst, optimize=True)
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
