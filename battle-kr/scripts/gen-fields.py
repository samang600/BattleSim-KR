#!/usr/bin/env python3
"""시나리오 모드 구역 배경(도트) 생성기 — 배틀 배경(gen-arenas.py)과 달리 인물이 서 있는 '무대'용.
위쪽은 풍경(하늘·건물·나무·동굴 벽), 아래쪽 40% 는 인물이 설 땅. 256×160, 앱에서 정수배 확대.
사용: python3 battle-kr/scripts/gen-fields.py  → src/ui-assets/field_<이름>.png"""
import math, os, random
from PIL import Image, ImageDraw

W, H, G = 256, 160, 96   # G = 땅이 시작하는 높이
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'ui-assets')

def bands(d, y0, y1, cols):
	n = len(cols)
	for i, c in enumerate(cols): d.rectangle([0, y0 + (y1 - y0) * i // n, W, y0 + (y1 - y0) * (i + 1) // n], fill=c)

def cloud(d, x, y, w):
	d.rectangle([x + 4, y, x + w - 4, y + 5], fill='#ffffff'); d.rectangle([x, y + 3, x + w, y + 7], fill='#ffffff'); d.rectangle([x + 2, y + 7, x + w - 2, y + 8], fill='#d8e8f8')

def tree(d, x, y, s=1, dark=False):
	c1, c2, c3 = ('#1e5a2e', '#174a26', '#103a1c') if dark else ('#3a9a4a', '#2e8a3e', '#237032')
	d.rectangle([x + 6 * s, y + 14 * s, x + 9 * s, y + 22 * s], fill='#6a4a2a')
	d.ellipse([x, y, x + 16 * s, y + 16 * s], fill=c2); d.ellipse([x + 2 * s, y + s, x + 11 * s, y + 9 * s], fill=c1); d.rectangle([x + 3 * s, y + 13 * s, x + 13 * s, y + 15 * s], fill=c3)

def house(d, x, y, w, h, roof, wall='#f0e8d8', door=True):
	d.rectangle([x, y + h // 3, x + w, y + h], fill=wall); d.rectangle([x, y + h - 3, x + w, y + h], fill='#c8bca8')
	d.polygon([(x - 3, y + h // 3), (x + w // 2, y), (x + w + 3, y + h // 3)], fill=roof)
	d.rectangle([x - 3, y + h // 3, x + w + 3, y + h // 3 + 2], fill='#00000030' if False else roof)
	for wx in range(x + 5, x + w - 8, 12): d.rectangle([wx, y + h // 3 + 6, wx + 6, y + h // 3 + 12], fill='#8ac8f0'); d.rectangle([wx, y + h // 3 + 6, wx + 6, y + h // 3 + 7], fill='#ffffff')
	if door: d.rectangle([x + w // 2 - 4, y + h - 12, x + w // 2 + 4, y + h], fill='#8a5a3a')

def ground(d, cols, speck, seed, path=None):
	bands(d, G, H, cols)
	r = random.Random(seed)
	for y in range(G + 2, H, 3):
		for x in range((y * 5) % 9, W, 9): d.point((x, y), fill=speck)
	if path:   # 가운데를 지나는 길
		d.rectangle([0, G + 22, W, G + 44], fill=path[0]); d.rectangle([0, G + 22, W, G + 23], fill=path[1]); d.rectangle([0, G + 43, W, G + 44], fill=path[2])
		for _ in range(40): d.point((r.randint(0, W - 1), r.randint(G + 25, G + 41)), fill=path[2])

def tallgrass(d, x0, x1, y0, y1):
	for y in range(y0, y1, 5):
		for x in range(x0 + (y // 5 % 2) * 3, x1, 6):
			d.polygon([(x, y + 5), (x + 2, y), (x + 4, y + 5)], fill='#2e8a3e'); d.point((x + 2, y + 1), fill='#6ad86a')

def pallet():
	"""태초마을: 맑은 하늘과 바다, 집 두 채와 연구소, 울타리, 흙길"""
	im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
	bands(d, 0, 70, ['#5aa8f0', '#6ab4f4', '#7cc0f6', '#90ccf8', '#a8d8fa'])
	cloud(d, 20, 12, 34); cloud(d, 120, 22, 28); cloud(d, 200, 10, 36)
	bands(d, 70, G, ['#3a8ad8', '#4a98e0', '#5aa4e6'])
	for x in range(0, W, 14): d.line([(x + (x // 14 % 2) * 4, 76), (x + 6 + (x // 14 % 2) * 4, 76)], fill='#a8d8fa')
	house(d, 14, 50, 48, 46, '#d84a3a'); house(d, 82, 54, 44, 42, '#3a7ad8'); house(d, 150, 40, 92, 56, '#b0b8c4', wall='#e8eef4')
	d.rectangle([186, 66, 206, 72], fill='#e84a4a'); d.rectangle([188, 68, 204, 70], fill='#ffffff')   # 연구소 간판
	ground(d, ['#7ac86a', '#72c062', '#6ab85a', '#62b052'], '#98e080', 1, ('#e0c890', '#f0dca8', '#c8ac70'))
	for x in range(4, W, 12): d.rectangle([x, G + 4, x + 1, G + 12], fill='#f4f4f4'); d.rectangle([x - 4, G + 6, x + 6, G + 7], fill='#f4f4f4')
	for x, y in [(30, 148), (90, 152), (170, 150), (230, 146)]: d.point((x, y), fill='#ff6a8a'); d.point((x + 1, y), fill='#ffe070')
	return im

def route():
	"""1번도로·상록시티: 구름 낀 하늘, 먼 산, 나무 줄, 풀숲과 흙길"""
	im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
	bands(d, 0, 76, ['#5aa8f0', '#6cb6f4', '#84c4f6', '#9cd0f8', '#b8dcfa'])
	cloud(d, 40, 14, 40); cloud(d, 150, 8, 30)
	for col, base, amp, per in [('#8ab8a0', 70, 14, 37), ('#6aa888', 78, 10, 23)]:
		d.polygon([(0, G)] + [(x, base - amp * abs(math.sin(x / per))) for x in range(0, W + 8, 8)] + [(W, G)], fill=col)
	for x in range(-6, W, 22): tree(d, x, 70, 1)
	ground(d, ['#7ac86a', '#72c062', '#6ab85a', '#62b052'], '#98e080', 2, ('#e0c890', '#f0dca8', '#c8ac70'))
	tallgrass(d, 6, 96, G + 3, G + 20); tallgrass(d, 150, 250, G + 48, H - 2)
	d.rectangle([118, G + 6, 136, G + 16], fill='#c8a070'); d.rectangle([120, G + 8, 134, G + 13], fill='#f4ecd8'); d.rectangle([126, G + 16, 128, G + 21], fill='#8a6a4a')   # 표지판
	return im

def forest():
	"""상록숲: 빽빽한 어두운 나무, 나뭇잎 사이 빛줄기, 풀숲"""
	im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
	bands(d, 0, G, ['#0e2e1a', '#123622', '#163e28', '#1a462e'])
	for row, (y, s) in enumerate([(8, 2), (34, 2), (62, 1)]):
		for x in range(-10 - row * 7, W, 30 if s == 2 else 17): tree(d, x, y, s, dark=row < 2)
	for x0 in (48, 150, 214):
		for y in range(0, G, 2): d.rectangle([x0 + y // 4, y, x0 + y // 4 + 5, y + 1], fill='#3a6a3a' if y % 4 else '#4a7a44')
	ground(d, ['#3a7a44', '#34703e', '#2e6638', '#285c32'], '#4a9a54', 3, ('#8a7a50', '#9a8a5c', '#6a5c3a'))
	tallgrass(d, 0, 110, G + 2, G + 20); tallgrass(d, 140, 256, G + 2, G + 20); tallgrass(d, 60, 200, G + 48, H - 2)
	return im

def pewter():
	"""회색시티: 바위산, 돌지붕 체육관(GYM 간판)과 박물관, 돌길"""
	im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
	bands(d, 0, 72, ['#6ab0ec', '#7ebcf0', '#94c8f4', '#acd4f6', '#c4e0f8'])
	cloud(d, 30, 10, 30); cloud(d, 180, 18, 36)
	for col, base, amp, per in [('#9a9aa4', 62, 26, 43), ('#82828e', 72, 16, 27)]:
		d.polygon([(0, G)] + [(x, base - amp * abs(math.sin(x / per + 1))) for x in range(0, W + 8, 8)] + [(W, G)], fill=col)
	house(d, 20, 44, 96, 52, '#6a6a78', wall='#d8d8e0')
	d.rectangle([48, 64, 88, 74], fill='#3a3a48'); 
	for i, ch in enumerate(['111.1.1.1.1', '1...1.1.111', '1.1..1..1.1', '111..1..1.1']):   # GYM
		for j, c in enumerate(ch):
			if c == '1': d.rectangle([52 + j * 3, 66 + i * 2, 53 + j * 3, 67 + i * 2], fill='#ffe070')
	house(d, 150, 52, 86, 44, '#c88a4a', wall='#f0e0c8')
	for x in range(158, 232, 14): d.rectangle([x, 76, x + 3, 96], fill='#e8d8c0')   # 박물관 기둥
	ground(d, ['#b8b8c0', '#b0b0b8', '#a8a8b0', '#a0a0a8'], '#d0d0d8', 4, ('#d8d0b8', '#e8e0c8', '#b8b098'))
	r = random.Random(9)
	for _ in range(10):
		x, y = r.randint(4, W - 12), r.choice([r.randint(G + 4, G + 16), r.randint(G + 50, H - 6)])
		d.ellipse([x, y, x + 8, y + 5], fill='#787884'); d.rectangle([x + 2, y, x + 5, y + 1], fill='#9a9aa6')
	return im

def mtmoon():
	"""달맞이산: 동굴 안, 천장 틈으로 비치는 달빛, 달의돌 빛, 바위"""
	im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
	bands(d, 0, G, ['#1a1830', '#22203c', '#2a2848', '#323054'])
	r = random.Random(12)
	for x in range(0, W, 16):   # 종유석
		h = r.randint(8, 26); d.polygon([(x, 0), (x + 8, h), (x + 16, 0)], fill='#141226')
	d.polygon([(110, 0), (146, 0), (170, G), (86, G)], fill='#3a3a66')   # 달빛 기둥
	d.polygon([(118, 0), (138, 0), (154, G), (102, G)], fill='#4a4a7c')
	d.ellipse([118, 4, 138, 24], fill='#f8f4d0')
	for x in range(0, W, 28): d.polygon([(x, G), (x + 10, G - r.randint(14, 30)), (x + 24, G)], fill='#26243e')
	ground(d, ['#4a4864', '#44425c', '#3e3c54', '#38364c'], '#5a5878', 5)
	for _ in range(12):
		x, y = r.randint(4, W - 14), r.choice([r.randint(G + 2, G + 14), r.randint(G + 50, H - 8)])
		d.ellipse([x, y, x + 10, y + 6], fill='#2a283e'); d.rectangle([x + 2, y, x + 6, y + 1], fill='#5a5878')
	for x, y in [(40, G + 8), (206, G + 12), (226, H - 10)]:   # 달의돌
		d.polygon([(x, y + 6), (x + 3, y), (x + 6, y + 6)], fill='#a8e8f8'); d.point((x + 3, y + 2), fill='#ffffff')
	return im

if __name__ == '__main__':
	for name, fn in [('pallet', pallet), ('route', route), ('forest', forest), ('pewter', pewter), ('mtmoon', mtmoon)]:
		fn().save(os.path.join(OUT, f'field_{name}.png'), optimize=True); print('field_' + name)
