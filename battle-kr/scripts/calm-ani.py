#!/usr/bin/env python3
"""움직이는 도트 그림의 위아래 움직임을 줄인다 (묶음 원본이 짧은 구간만 되풀이해 통통 튀어 보이는 그림 손질).
  python3 scripts/calm-ani.py <원본.webp> <출력.webp> [진폭px=4] [프레임ms]
프레임마다 그림을 위로 붙인 뒤, 원래 높낮이를 진폭 비율로 줄여 다시 놓는다 (발 = 그림 맨 아래 규칙 유지)."""
import sys
from PIL import Image

def main(src, dst, amp=4, ms=0):
	im = Image.open(src); frs = []; durs = []
	for i in range(im.n_frames):
		im.seek(i); durs.append(ms or im.info.get('duration', 60)); frs.append(im.convert('RGBA'))
	bbs = [f.getbbox() for f in frs]
	t0 = min(b[1] for b in bbs); rng = max(b[1] for b in bbs) - t0 or 1
	hmax = max(b[3] - b[1] for b in bbs); W = frs[0].width; H = hmax + amp
	out = []
	for f, b in zip(frs, bbs):
		off = round((b[1] - t0) * amp / rng)
		c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
		# 아래(발)를 기준으로: 가장 낮은 위치일 때 그림 맨 아래에 닿음
		c.alpha_composite(f.crop((0, b[1], W, b[3])), (0, H - amp - (b[3] - b[1]) + off))
		out.append(c)
	out[0].save(dst, save_all=True, append_images=out[1:], duration=durs, loop=0, lossless=True, method=6)

if __name__ == '__main__': main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 4, int(sys.argv[4]) if len(sys.argv) > 4 else 0)
