#!/usr/bin/env python3
"""public/sprites/gen5*/ 정지 그림의 아래 투명 여백을 재서 src/gen/sprite-pad.json 에 저장 ([앞, 뒤, 앞그림 x, y, 너비, 높이] px — 뒤 4개는 목록 썸네일에서 그림 영역만 잘라 1:1로 보이기 위한 값). fetch-sprites.sh 가 호출."""
import os, json, sys
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
base = os.path.join(here, '../public/sprites')
out = {}
def pad(path):
    im = Image.open(path).convert('RGBA'); w, h = im.size; px = im.load()
    for y in range(h - 1, -1, -1):
        for x in range(w):
            if px[x, y][3] > 20: return h - 1 - y
    return 0
for d, idx in (('gen5', 0), ('gen5-back', 1)):
    p = os.path.join(base, d)
    if not os.path.isdir(p): continue
    for f in os.listdir(p):
        if f.endswith('.png'):
            e = out.setdefault(f[:-4], [0, 0, 0, 0, 96, 96]); e[idx] = pad(os.path.join(p, f))
            if idx == 0:
                bb = Image.open(os.path.join(p, f)).convert('RGBA').getbbox()
                if bb: e[2:6] = [bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]]
# 직접 넣은 그림(src/sprites-custom/<id>[-back].png, 예: PokéAPI 도트 그림)이 있으면 서버 그림 대신 그 값을 씀
custom = os.path.join(here, '../src/sprites-custom')
if os.path.isdir(custom):
    for f in os.listdir(custom):
        if not f.endswith('.png') or '-shiny' in f: continue
        sid, back = (f[:-9], True) if f.endswith('-back.png') else (f[:-4], False)
        e = out.setdefault(sid, [0, 0, 0, 0, 96, 96]); e[1 if back else 0] = pad(os.path.join(custom, f))
        if not back:
            bb = Image.open(os.path.join(custom, f)).convert('RGBA').getbbox()
            if bb: e[2:6] = [bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]]
json.dump(out, open(os.path.join(here, '../src/gen/sprite-pad.json'), 'w'), separators=(',', ':'))
print('sprite-pad.json:', len(out))
