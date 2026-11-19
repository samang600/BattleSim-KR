#!/usr/bin/env python3
"""움직이는 도트 묶음에서 잘못 짝지어진 그림을 원본 프레임 띠에서 다시 만들어 src/sprites-custom/ani/ 에 넣는다 (앱에 함께 묶여 묶음의 그림 대신 쓰임).
  python3 scripts/fix-ani.py <프레임 띠 PNG 폴더>     # 파일 이름: Front__XERNEAS_1.png · Back__… · Front_shiny__… · Back_shiny__…
make-ani-sprites.py 의 convert 와 같은 방식(그림이 있는 범위만, 가로 가운데 유지, 아래 = 발).
묶음(Animated Pokemon System)의 폼 번호가 이름으로 안 맞던 것: 가라르 불비달마 = _2(묶음에는 _3 달마모드가 들어감), 제르네아스 = _1 액티브 모드(기본은 정지 그림 1장),
비비용 = _8 화원의 모양(쇼다운의 기본 모습), 메테노 코어(빨강) = _7."""
import os, sys
from PIL import Image
SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'sprites-custom', 'ani')
FIX = {'darmanitan-galar': 'DARMANITAN_2', 'xerneas': 'XERNEAS_1', 'vivillon': 'VIVILLON_8', 'minior': 'MINIOR_7'}
SIDES = {'': 'Front', '-back': 'Back', '-shiny': 'Front_shiny', '-back-shiny': 'Back_shiny'}
MS = 60
for sid, src in FIX.items():
	for sfx, d in SIDES.items():
		p = os.path.join(SRC, f'{d}__{src}.png')
		if not os.path.exists(p): print('없음', p); continue
		im = Image.open(p).convert('RGBA'); h = im.height; n = max(1, im.width // h)
		frames = [im.crop((i * h, 0, i * h + h, h)) for i in range(n)]
		bb = None
		for f in frames:
			b = f.getbbox()
			if b: bb = b if bb is None else (min(bb[0], b[0]), min(bb[1], b[1]), max(bb[2], b[2]), max(bb[3], b[3]))
		half = max(h / 2 - bb[0], bb[2] - h / 2); x0, x1 = int(h / 2 - half), int(h / 2 + half + 0.5)
		frames = [f.crop((x0, bb[1], x1, bb[3])) for f in frames]
		out, dur = [frames[0]], [MS]
		for f in frames[1:]:
			if f.tobytes() == out[-1].tobytes(): dur[-1] += MS
			else: out.append(f); dur.append(MS)
		dst = os.path.join(OUT, f'{sid}{sfx}.webp')
		out[0].save(dst, save_all=True, append_images=out[1:], duration=dur, loop=0, lossless=True, method=6, minimize_size=True)
		print(f'{sid}{sfx}', out[0].size, len(out), '장', os.path.getsize(dst))
