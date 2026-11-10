#!/usr/bin/env python3
"""트레이너 초상화(상반신 그림) 묶음 만들기 — 시나리오 모드 시안용.

원본: 사용자가 준 그림 묶음(832×1216 PNG, 흰 배경, 파일 이름 = 영어 이름)
하는 일: 가장자리에서 이어진 흰 배경을 투명하게 → 416×608 로 줄여 WebP 로 저장, 파일 이름은 소문자·숫자만(id)
출력: <출력>/<id>.webp, <출력>/index.json (id 목록)
사용: python3 make-portraits.py <그림 폴더> <출력 폴더>
"""
import json, os, re, sys
from multiprocessing import Pool
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC, OUT = sys.argv[1:3]
pid = lambda name: re.sub(r'[^a-z0-9]', '', name.lower())

def conv(f):
	im = Image.open(os.path.join(SRC, f)).convert('RGBA')
	a = np.asarray(im).astype(np.int16)
	white = (a[..., :3].min(axis=2) >= 238) & (a[..., 3] > 200)
	lab, _ = ndimage.label(white)
	edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
	bg = np.isin(lab, list(edge))
	bg = ndimage.binary_dilation(bg, iterations=1)   # 가장자리 흰 테 1px 깎기
	alpha = np.where(bg, 0, a[..., 3]).astype(np.uint8)
	out = np.dstack([a[..., :3].astype(np.uint8), alpha])
	im2 = Image.fromarray(out, 'RGBA')
	im2.putalpha(im2.getchannel('A').filter(ImageFilter.GaussianBlur(0.8)))
	im2 = im2.resize((416, 608), Image.LANCZOS)
	i = pid(f[:-4]); im2.save(os.path.join(OUT, i + '.webp'), quality=84, method=6)
	return i, float(bg.mean())

if __name__ == '__main__':
	os.makedirs(OUT, exist_ok=True)
	fs = sorted(f for f in os.listdir(SRC) if f.lower().endswith('.png'))
	with Pool() as p: res = p.map(conv, fs)
	json.dump(sorted(i for i, _ in res), open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'))
	print(len(res), '장 · 배경이 거의 안 지워진 것(확인 필요):', [i for i, r in res if r < 0.08])
