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

def viridian():
	"""상록시티: 늘푸른 나무에 둘러싸인 도시, 프렌들리숍(파란 지붕)과 포켓몬센터(빨간 지붕), 연못"""
	im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
	bands(d, 0, 76, ['#5aa8f0', '#6cb6f4', '#84c4f6', '#9cd0f8', '#b8dcfa'])
	cloud(d, 16, 10, 30); cloud(d, 96, 20, 36); cloud(d, 206, 12, 30)
	d.rectangle([0, 62, W, G], fill='#237032')
	for x in range(-8, W, 18): tree(d, x, 46, 2)
	house(d, 18, 52, 60, 44, '#3a7ad8'); house(d, 100, 48, 66, 48, '#d84a3a'); house(d, 190, 58, 50, 38, '#8a6ad8')
	d.rectangle([34, 70, 62, 77], fill='#2a5ab8'); d.rectangle([40, 72, 56, 75], fill='#ffffff')   # SHOP 간판
	d.ellipse([124, 54, 142, 66], fill='#ffffff'); d.rectangle([124, 59, 142, 61], fill='#d84a3a'); d.ellipse([130, 57, 136, 63], fill='#d84a3a'); d.ellipse([131, 58, 135, 62], fill='#ffffff')   # 볼 표시
	ground(d, ['#7ac86a', '#72c062', '#6ab85a', '#62b052'], '#98e080', 21, ('#e0c890', '#f0dca8', '#c8ac70'))
	d.ellipse([176, G + 46, 250, H + 10], fill='#4a98e0'); d.ellipse([184, G + 50, 240, H + 6], fill='#6ab4f4')
	for x in (196, 214, 228): d.line([(x, G + 54), (x + 6, G + 54)], fill='#c8e8fc')
	for x, y in [(20, 150), (60, 146), (110, 152), (150, 148)]: d.point((x, y), fill='#ffe070'); d.point((x + 1, y), fill='#ff8aa0')
	return im

def cerulean():
	"""블루시티: 물가의 도시, 물빛 지붕 체육관(GYM)과 자전거 가게, 수로와 다리, 꽃밭"""
	im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
	bands(d, 0, 74, ['#4aa0ec', '#5eaef0', '#76bcf4', '#90ccf8', '#acdcfa'])
	cloud(d, 24, 8, 38); cloud(d, 130, 16, 30); cloud(d, 196, 6, 40)
	for col, base, amp, per in [('#7ab0c8', 66, 12, 41), ('#5a98b8', 74, 8, 29)]:
		d.polygon([(0, G)] + [(x, base - amp * abs(math.sin(x / per + 2))) for x in range(0, W + 8, 8)] + [(W, G)], fill=col)
	house(d, 12, 42, 104, 54, '#2a8ad8', wall='#e4f0f8')
	d.polygon([(9, 60), (64, 42), (119, 60)], fill='#4aa8ec'); d.rectangle([9, 60, 119, 62], fill='#1a6ab8')
	d.rectangle([44, 66, 84, 76], fill='#1a3a68')
	for i, ch in enumerate(['111.1.1.1.1', '1...1.1.111', '1.1..1..1.1', '111..1..1.1']):
		for j, c in enumerate(ch):
			if c == '1': d.rectangle([48 + j * 3, 68 + i * 2, 49 + j * 3, 69 + i * 2], fill='#8ae8fc')
	house(d, 150, 56, 44, 40, '#e8a030', wall='#f4ecd8'); house(d, 204, 60, 40, 36, '#d84a6a')
	d.ellipse([160, 72, 168, 80], outline='#3a3a48'); d.ellipse([172, 72, 180, 80], outline='#3a3a48'); d.line([(164, 76), (170, 70), (176, 76)], fill='#d84a3a')   # 자전거 간판
	ground(d, ['#8ad078', '#82c870', '#7ac068', '#72b860'], '#a8e890', 22, ('#d8d8e4', '#ececf4', '#b0b0c0'))
	bands(d, G + 46, H, ['#3a8ad8', '#4a98e0', '#5aa6e8'])   # 수로
	for x in range(0, W, 16): d.line([(x + (x // 16 % 2) * 6, G + 52), (x + 7 + (x // 16 % 2) * 6, G + 52)], fill='#b8e0fc'); d.line([(x + 8, G + 60), (x + 13, G + 60)], fill='#8ac8f4')
	d.rectangle([0, G + 44, W, G + 46], fill='#f4f4f8'); d.rectangle([0, G + 46, W, G + 47], fill='#9a9aa8')
	for x in range(6, W, 10):
		c = ['#ff7a9a', '#ffe070', '#ffffff', '#8ab8ff'][x // 10 % 4]
		d.rectangle([x, G + 5, x + 1, G + 6], fill=c); d.point((x, G + 7), fill='#2e8a3e'); d.rectangle([x + 4, G + 11, x + 5, G + 12], fill=c)
	return im

def bridge():
	"""골든볼브리지(24번도로): 강 위로 길게 뻗은 금빛 난간 다리, 강 건너 풀숲"""
	im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
	bands(d, 0, 60, ['#5aa8f0', '#6cb6f4', '#84c4f6', '#9cd0f8', '#b8dcfa'])
	cloud(d, 50, 10, 36); cloud(d, 170, 20, 30)
	for col, base, amp, per in [('#8ab8a0', 52, 12, 33), ('#6aa888', 58, 8, 21)]:
		d.polygon([(0, 70)] + [(x, base - amp * abs(math.sin(x / per))) for x in range(0, W + 8, 8)] + [(W, 70)], fill=col)
	bands(d, 60, H, ['#3a88d8', '#4494de', '#4ea0e4', '#58ace8', '#4a9ae0', '#3e8cd8'])
	for y in range(64, H, 7):
		for x in range((y * 3) % 19, W, 19): d.line([(x, y), (x + 6, y)], fill='#a8d8fa' if y % 2 else '#7cc0f4')
	for x in range(-10, W, 26): tree(d, x, 44, 1)
	d.rectangle([0, G + 12, W, G + 46], fill='#e8c868'); d.rectangle([0, G + 12, W, G + 13], fill='#fff0a8'); d.rectangle([0, G + 45, W, G + 46], fill='#a88428')
	for x in range(0, W, 16): d.line([(x, G + 14), (x, G + 44)], fill='#d0ac48')
	for y in (G + 4, G + 48):   # 금빛 난간
		d.rectangle([0, y, W, y + 2], fill='#f8d848'); d.rectangle([0, y + 2, W, y + 3], fill='#b08820')
		for x in range(6, W, 20): d.rectangle([x, y - 4, x + 3, y + 8], fill='#f8d848'); d.rectangle([x, y - 5, x + 3, y - 4], fill='#fff8c0'); d.ellipse([x - 1, y - 9, x + 4, y - 4], fill='#ffe870')
	return im

def cape():
	"""블루곶(25번도로): 바다로 튀어나온 풀밭 절벽, 수평선과 등대 같은 이수재의 집, 들꽃"""
	im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
	bands(d, 0, 58, ['#4a9cec', '#60acf0', '#7abcf4', '#96ccf8', '#b4dcfa', '#d0ecfc'])
	cloud(d, 10, 14, 44); cloud(d, 110, 6, 30); cloud(d, 186, 22, 42)
	bands(d, 58, G, ['#2a78d0', '#3484d8', '#3e90de', '#489ae4'])
	d.rectangle([0, 58, W, 58], fill='#e8f8ff')
	for y in range(62, G, 5):
		for x in range((y * 7) % 23, W, 23): d.line([(x, y), (x + 8, y)], fill='#b8e0fc')
	d.polygon([(150, G), (166, 70), (256, 62), (256, G)], fill='#8a7a5a'); d.polygon([(166, 70), (256, 62), (256, 68), (170, 76)], fill='#7ac86a')
	house(d, 196, 34, 44, 34, '#d84a3a', wall='#f8f4e8'); d.rectangle([214, 22, 222, 36], fill='#f8f4e8'); d.rectangle([212, 18, 224, 22], fill='#d84a3a'); d.rectangle([216, 26, 220, 30], fill='#ffe070')
	ground(d, ['#84d072', '#7cc86a', '#74c062', '#6cb85a'], '#a8e890', 24)
	d.polygon([(0, H), (0, G + 40), (40, G + 34), (90, G + 44), (120, H)], fill='#8a7a5a'); d.polygon([(0, G + 40), (40, G + 34), (90, G + 44), (84, G + 48), (40, G + 39), (0, G + 45)], fill='#a89a78')
	r = random.Random(31)
	for _ in range(46):
		x, y = r.randint(2, W - 3), r.randint(G + 3, H - 3)
		if x < 124 and y > G + 32: continue
		c = r.choice(['#ffffff', '#ffe070', '#ff8aa0', '#b8a0ff'])
		d.point((x, y), fill=c); d.point((x + 1, y), fill=c); d.point((x, y + 1), fill='#2e8a3e')
	for x in (132, 150, 168):   # 나무 울타리
		d.rectangle([x, G + 2, x + 2, G + 12], fill='#a87848'); d.rectangle([x - 8, G + 5, x + 10, G + 6], fill='#c89860')
	return im

def pool():
	"""블루 체육관 안: 타일 벽과 조명, 큰 수영장과 레인, 다이빙대"""
	im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
	bands(d, 0, 66, ['#1a4a78', '#1e5486', '#225e94', '#2668a2'])
	for x in range(0, W, 16): d.line([(x, 0), (x, 66)], fill='#16406a')
	for y in range(0, 66, 16): d.line([(0, y), (W, y)], fill='#16406a')
	for x in (40, 128, 216): d.rectangle([x - 14, 6, x + 14, 12], fill='#e8f8ff'); d.polygon([(x - 14, 12), (x + 14, 12), (x + 30, 66), (x - 30, 66)], fill='#2e74ae')
	d.rectangle([0, 66, W, 72], fill='#e8eef4'); d.rectangle([0, 72, W, 74], fill='#9aa8b8')
	bands(d, 74, G + 26, ['#2aa0e0', '#34aae6', '#3eb4ea', '#48beee'])
	for i, x in enumerate(range(0, W, 42)):
		d.line([(x, 74), (x - 16, G + 26)], fill='#f4f4f8')
		for y in range(76, G + 26, 6): d.point((x - (y - 74) * 16 // (G + 26 - 74), y), fill='#f04848')
	for y in range(80, G + 24, 8):
		for x in range((y * 5) % 31, W, 31): d.line([(x, y), (x + 9, y)], fill='#b8ecfc')
	d.rectangle([20, 54, 26, 74], fill='#c8d0d8'); d.rectangle([14, 52, 50, 55], fill='#f4f4f8')   # 다이빙대
	bands(d, G + 26, H, ['#d8e4ee', '#ccd8e4', '#c0ccda', '#b4c0d0'])
	for x in range(0, W, 16): d.line([(x, G + 26), (x, H)], fill='#a8b4c4')
	for y in range(G + 26, H, 12): d.line([(0, y), (W, y)], fill='#a8b4c4')
	d.rectangle([0, G + 26, W, G + 28], fill='#f8fcff')
	return im

def lab():
	"""오박사 연구소 안: 책장과 기계, 창밖 하늘, 가운데 탁자 위 몬스터볼 세 개"""
	im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
	bands(d, 0, G, ['#e8e0d0', '#e4dccc', '#e0d8c8', '#dcd4c4'])
	d.rectangle([0, G - 6, W, G], fill='#b8a888')
	for x0 in (8, 60, 196):   # 책장
		d.rectangle([x0, 22, x0 + 44, G - 6], fill='#8a6a48'); d.rectangle([x0 + 2, 24, x0 + 42, G - 8], fill='#6a4e34')
		for sy in range(26, G - 14, 16):
			d.rectangle([x0 + 2, sy + 12, x0 + 42, sy + 13], fill='#8a6a48')
			for k, bx in enumerate(range(x0 + 4, x0 + 40, 5)): d.rectangle([bx, sy + (k * 7) % 3, bx + 3, sy + 11], fill=['#d84a3a', '#3a7ad8', '#3a9a4a', '#e8b830', '#8a5ad8', '#e8e8e8'][(k + sy) % 6])
	d.rectangle([112, 18, 184, 62], fill='#8a9aa8'); d.rectangle([116, 22, 180, 58], fill='#7cc0f6'); cloud(d, 124, 30, 26); d.line([(148, 22), (148, 58)], fill='#8a9aa8'); d.line([(116, 40), (180, 40)], fill='#8a9aa8')
	d.rectangle([116, 66, 180, G - 6], fill='#5a6878'); d.rectangle([120, 70, 150, 84], fill='#1a2a3a')
	for i in range(5): d.rectangle([122 + i * 5, 80 - (i * 3) % 8, 124 + i * 5, 82], fill='#5af08a')
	for i, c in enumerate(['#f04848', '#48f070', '#f0d848']): d.rectangle([158 + i * 7, 72, 161 + i * 7, 75], fill=c)
	bands(d, G, H, ['#c8b898', '#c0b090', '#b8a888', '#b0a080'])
	for x in range(0, W, 24): d.line([(x, G), (x - 12, H)], fill='#a09070')
	d.rectangle([84, G + 20, 172, G + 30], fill='#a87848'); d.rectangle([84, G + 20, 172, G + 21], fill='#c89860'); d.rectangle([90, G + 30, 94, G + 46], fill='#7a5430'); d.rectangle([162, G + 30, 166, G + 46], fill='#7a5430')
	for x in (104, 128, 152):
		d.ellipse([x - 6, G + 9, x + 6, G + 21], fill='#f4f4f4'); d.pieslice([x - 6, G + 9, x + 6, G + 21], 180, 360, fill='#e83a3a'); d.rectangle([x - 6, G + 14, x + 6, G + 15], fill='#2a2a32'); d.ellipse([x - 2, G + 13, x + 2, G + 17], fill='#f4f4f4', outline='#2a2a32')
	return im

def kantomap():
	"""관동 서북쪽 지도 (월드 화면): 바다·육지·산줄기·숲·강. 마을과 길은 화면(CSS)에서 그림. 240×240"""
	S = 240
	im = Image.new('RGB', (S, S)); d = ImageDraw.Draw(im)
	for y in range(0, S, 4): d.rectangle([0, y, S, y + 3], fill=['#2a78d0', '#2e7cd4'][y // 4 % 2])
	for y in range(6, S, 12):
		for x in range((y * 7) % 29, S, 29): d.line([(x, y), (x + 5, y)], fill='#6ab0f0')
	land = [(8, 232), (8, 30), (20, 12), (120, 6), (150, 12), (196, 4), (232, 10), (232, 60), (214, 84), (188, 92), (150, 86), (120, 100), (96, 120), (80, 150), (70, 190), (60, 232)]
	d.polygon([(x + 2, y + 3) for x, y in land], fill='#1a5aa8'); d.polygon(land, fill='#6ab85a')
	r = random.Random(77)
	for _ in range(260):
		x, y = r.randint(10, 230), r.randint(8, 230)
		if im.getpixel((x, y)) == (106, 184, 90): d.point((x, y), fill='#84d072')
	for cx, cy, n in [(46, 96, 16), (30, 110, 8)]:   # 상록숲
		for _ in range(n * 3):
			x, y = cx + r.randint(-18, 18), cy + r.randint(-14, 14); d.ellipse([x - 4, y - 4, x + 4, y + 4], fill='#2e7a3a'); d.point((x - 1, y - 2), fill='#4a9a54')
	for x in range(86, 150, 9):   # 달맞이산 줄기
		h = r.randint(12, 22); y = 44 + r.randint(-6, 8)
		d.polygon([(x - 10, y + 12), (x, y - h), (x + 10, y + 12)], fill='#8a8a96'); d.polygon([(x - 3, y - h + 6), (x, y - h), (x + 3, y - h + 6)], fill='#f0f0f4'); d.polygon([(x, y - h), (x + 10, y + 12), (x + 3, y + 12)], fill='#6e6e7c')
	d.line([(196, 4), (190, 40), (198, 70), (188, 92)], fill='#4a98e0', width=4); d.line([(196, 4), (190, 40), (198, 70), (188, 92)], fill='#7cc0f6', width=1)   # 블루시티 강
	d.polygon([(206, 10), (232, 10), (232, 26), (212, 22)], fill='#84d072')
	return im

if __name__ == '__main__':
	for name, fn in [('pallet', pallet), ('route', route), ('forest', forest), ('pewter', pewter), ('mtmoon', mtmoon), ('viridian', viridian), ('cerulean', cerulean), ('bridge', bridge), ('cape', cape), ('pool', pool), ('lab', lab), ('kantomap', kantomap)]:
		fn().save(os.path.join(OUT, f'field_{name}.png'), optimize=True); print('field_' + name)
