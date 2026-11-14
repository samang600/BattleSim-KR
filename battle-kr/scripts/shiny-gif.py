#!/usr/bin/env python3
"""움직이는 메가 지가르데 그림(GIF)에 정지 이로치 그림의 색을 옮겨 이로치 GIF 를 만든다.
  python3 scripts/shiny-gif.py <보통.gif> <이로치.gif>
색 규칙(정지 그림의 보통→이로치 대응에서 뽑음):
  몸통(짙은 갈회색 계열) → 흰색~연보라 회색, 흰 무늬 → 연노랑,
  몸통 위의 가는 초록 무늬(꼬리 줄·등껍질 렌즈) → 청록. 다리·손의 초록, 빨강·파랑·보라 줄은 그대로."""
import sys
from PIL import Image

# 몸통 밝기 → 이로치 색 (정지 그림: 86→252, 56→233·225·233, 43→183·175·183, 36→91·82·91)
RAMP = [(12, None), (20, (91, 82, 91)), (31, (150, 141, 150)), (46, (204, 196, 204)), (71, (240, 234, 240)), (104, (255, 255, 255))]
TEAL = {'hi': (166, 226, 209), 'mid': (80, 199, 165), 'lo': (23, 142, 108), 'dk': (16, 100, 80)}

def lum(c): return (c[0] * 299 + c[1] * 587 + c[2] * 114) // 1000
def is_body(c): return max(c[:3]) - min(c[:3]) <= 32 and 12 < lum(c) < 128
def is_green(c): return c[1] > c[0] + 20 and c[1] > c[2] + 40
def is_white(c): return min(c[:3]) >= 185 and max(c[:3]) - min(c[:3]) <= 40

def body(c):
	l = lum(c)
	for (l0, c0), (l1, c1) in zip(RAMP, RAMP[1:]):
		if l <= l1:
			t = (l - l0) / (l1 - l0)
			a = c0 or c[:3]
			return tuple(round(a[i] + (c1[i] - a[i]) * t) for i in range(3))
	return RAMP[-1][1]

def teal(c):
	l = lum(c)
	return TEAL['hi'] if l > 200 else TEAL['mid'] if l > 150 else TEAL['lo'] if l > 95 else TEAL['dk']

DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)]

def marks(px, w, h, keep):
	"""초록 점 가운데 '몸통 위의 무늬'인 것. 여덟 방향으로 초록이 끝나는 곳을 보고, 그 끝이 몸통색인 방향이 많으면 무늬
	(다리·손의 초록은 검은 외곽선으로 둘러싸여 있어 걸러진다). 그림 위쪽(등껍질)에서는 굵은 덩어리(렌즈)만 —
	등껍질의 줄·띠는 색이 돌아가며 바뀌는 빛이라 그대로 둔다 (keep: 거의 모든 프레임에서 초록인 자리 = 렌즈)."""
	out = set()
	for y in range(h):
		for x in range(w):
			c = px[x, y]
			if c[3] == 0 or not is_green(c): continue
			ends = 0; run = []
			for dx, dy in DIRS:
				nx, ny, n = x + dx, y + dy, 0
				while 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] and is_green(px[nx, ny]): nx += dx; ny += dy; n += 1
				run.append(n)
				if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] and is_body(px[nx, ny]): ends += 1
			if y < h * UPPER:
				if ends >= 3 and (x, y) in keep: out.add((x, y))
			elif ends >= ENDS: out.add((x, y))
	# 렌즈는 덩어리째로: 위쪽의 '늘 초록' 자리에서 이미 무늬로 잡힌 점과 이어진 초록도 함께
	st = [p for p in out if p[1] < h * UPPER]
	while st:
		x, y = st.pop()
		for dx, dy in DIRS:
			q = (x + dx, y + dy)
			if q in keep and q not in out and 0 <= q[0] < w and 0 <= q[1] < h * UPPER and px[q][3] and is_green(px[q]): out.add(q); st.append(q)
	return out

UPPER = 0.55
ENDS = 4

def recolor(fr, keep):
	px = fr.load(); w, h = fr.size
	mk = marks(px, w, h, keep)
	for y in range(h):
		for x in range(w):
			c = px[x, y]
			if c[3] == 0: continue
			if (x, y) in mk: n = teal(c)
			elif is_body(c): n = body(c)
			elif is_white(c): n = (255, 255, 153) if lum(c) > 235 else (210, 193, 108)
			else: continue
			px[x, y] = (*n, 255)
	return fr

def main(src, dst):
	im = Image.open(src); frames = []; durs = []
	for i in range(im.n_frames):
		im.seek(i); durs.append(im.info.get('duration', 80)); frames.append(im.convert('RGBA'))
	# 절반 넘는 프레임에서 초록인 자리(둘레 4칸까지)
	w, h = frames[0].size; cnt = {}
	for fr in frames:
		px = fr.load()
		for y in range(h):
			for x in range(w):
				if px[x, y][3] and is_green(px[x, y]): cnt[(x, y)] = cnt.get((x, y), 0) + 1
	keep = set()
	for (x, y), n in cnt.items():
		if n >= len(frames) * 0.5: keep.update((x + dx, y + dy) for dx in range(-4, 5) for dy in range(-4, 5))
	out = []
	for fr in frames:
		fr = recolor(fr, keep); a = fr.getchannel('A')
		p = fr.convert('RGB').quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
		p.paste(255, mask=a.point(lambda v: 255 if v == 0 else 0))
		out.append(p)
	out[0].save(dst, save_all=True, append_images=out[1:], duration=durs, loop=0, transparency=255, disposal=2, optimize=False)

if __name__ == '__main__': main(sys.argv[1], sys.argv[2])
