#!/usr/bin/env python3
"""교환소 꾸미기 CSS 생성: HP 창 테마(무늬·움직임) + BP 배경의 은은한 움직임.

도트 무늬는 작은 SVG 타일(crispEdges, 한 칸 = 2px)로 만들고, 움직임은 steps() 로 끊어서 도트 느낌을 살린다.
결과는 src/style.css 의 표시 사이(`/* ═════ FX:BEGIN` … `FX:END ═════ */`)를 바꾼다.
"""
import os, re, random
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))
CSS = os.path.join(os.path.dirname(HERE), 'src/style.css')


def tile(rows, pal):
	"""rows: 문자 그림, pal: 문자 → (색, 투명도) → (data URI, 가로 px, 세로 px)"""
	h, w = len(rows), len(rows[0])
	rects = []
	for y, r in enumerate(rows):
		for x, ch in enumerate(r):
			if ch in pal:
				c, a = pal[ch]
				rects.append(f"<rect x='{x}' y='{y}' width='1' height='1' fill='{c}' fill-opacity='{a}'/>")
	svg = f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {w} {h}' width='{w}' height='{h}' shape-rendering='crispEdges'>{''.join(rects)}</svg>"
	return 'url("data:image/svg+xml,' + quote(svg, safe="=:/' ") + '")', w * 2, h * 2


def scatter(w, h, n, shapes, seed):
	"""빈 타일에 모양(문자 그림 조각)을 n 개 흩뿌림 (가장자리는 감아서 이어지게)"""
	rnd = random.Random(seed)
	g = [['.'] * w for _ in range(h)]
	for i in range(n):
		sh = shapes[i % len(shapes)]
		ox, oy = rnd.randrange(w), rnd.randrange(h)
		for y, r in enumerate(sh):
			for x, ch in enumerate(r):
				if ch != '.':
					g[(oy + y) % h][(ox + x) % w] = ch
	return [''.join(r) for r in g]


W, D = '#ffffff', '#000000'
STAR = ['.a.', 'aba', '.a.']
DOT = ['a']
PETAL = ['ab', 'b.']
FLOWER = ['.a.', 'aba', '.a.']

# ───────── HP 창 테마 ─────────
# (키, 띠 색[위→아래], 무늬 타일, 움직임)
pat = {}
pat['ruby'] = tile([
	'a......b',
	'.a....b.',
	'..a..b..',
	'...ab...',
	'...ba...',
	'..b..a..',
	'.b....a.',
	'b......a'], {'a': (W, .16), 'b': (D, .18)})
pat['sapphire'] = tile([
	'..aa............',
	'.a..a..........a',
	'a....a........a.',
	'......a......a..',
	'.......a....a...',
	'........aaaa....',
	'................',
	'................'], {'a': (W, .14)})
pat['emerald'] = tile([
	'...a....',
	'..aba...',
	'.ab.ba..',
	'ab...ba.',
	'.ab.ba..',
	'..aba...',
	'...a....',
	'........'], {'a': (W, .14), 'b': (D, .14)})
pat['gold'] = tile([
	'aaaaaaaa',
	'bbbbbbbb',
	'........',
	'....c...',
	'aaaaaaaa',
	'bbbbbbbb',
	'........',
	'c.......'], {'a': (W, .12), 'b': (D, .16), 'c': (W, .35)})
pat['crystal'] = tile([
	'aa....bb',
	'.aa....b',
	'..aa....',
	'...aa...',
	'....aa..',
	'b....aa.',
	'bb....aa',
	'.bb....a'], {'a': (W, .16), 'b': (D, .12)})
pat['night'] = tile(scatter(32, 24, 9, [DOT, DOT, ['a'], ['c']], 7), {'a': (W, .55), 'c': ('#ffe890', .7)})
pat['lava'] = tile([
	'................',
	'..a.............',
	'...a.......aa...',
	'...a......a..a..',
	'....aa...a......',
	'......a.a.......',
	'.......a........',
	'.......a........',
	'......a.a.......',
	'.....a...aa.....',
	'....a......a....',
	'...........a....',
	'................',
	'..b.........b...',
	'................',
	'................'], {'a': (D, .3), 'b': ('#ffe070', .35)})
pat['sakura'] = tile(scatter(24, 24, 6, [FLOWER, PETAL], 3), {'a': ('#fff0f6', .35), 'b': ('#ffd0e4', .5)})
pat['metal'] = tile([
	'aaaaaaaaaaaaaaaa',
	'................',
	'bbbbbbbb.bbbbbbb',
	'................',
	'aaaa.aaaaaaaaaaa',
	'................',
	'bbbbbbbbbbbb.bbb',
	'................'], {'a': (W, .1), 'b': (D, .12)})
pat['electric'] = tile([
	'....a...........',
	'...a............',
	'..aaaa..........',
	'....a...........',
	'...a............',
	'..a.............',
	'................',
	'..........b.....',
	'.........b......',
	'........bbbb....',
	'..........b.....',
	'.........b......',
	'........b.......',
	'................',
	'................',
	'................'], {'a': ('#fff8b0', .35), 'b': (D, .18)})
pat['yume'] = tile(scatter(24, 24, 4, [['.a.a.', 'aaaaa', '.aaa.', '..a..'], ['b']], 5), {'a': ('#ffe0f4', .3), 'b': ('#ffffff', .5)})
pat['yami'] = tile(scatter(24, 24, 3, [['.a.a.', 'aaaaa', '.aaa.', '..a..'], ['b']], 9), {'a': ('#ff4aa0', .3), 'b': ('#ff9ad0', .6)})
pat['menhera'] = tile(scatter(24, 24, 4, [['aabb'], ['.c.', 'ccc', '.c.']], 13), {'a': ('#ffd0e4', .45), 'b': ('#ffffff', .5), 'c': ('#ffffff', .35)})
pat['rainbow'] = tile([
	'a...',
	'....',
	'..a.',
	'....'], {'a': (W, .12)})

SPARK = tile(scatter(48, 20, 3, [['..a..', '..a..', 'aabaa', '..a..', '..a..']], 11), {'a': (W, .8), 'b': (W, 1)})
EMBER = tile(scatter(24, 32, 5, [['a'], ['b']], 5), {'a': ('#ffd040', .8), 'b': ('#ff8a20', .8)})
PETALS = tile(scatter(32, 32, 3, [['ab', 'b.']], 9), {'a': ('#ffe0ee', .9), 'b': ('#ff9ac4', .9)})
STARS = tile(scatter(40, 24, 4, [['.a.', 'aba', '.a.'], ['a']], 21), {'a': ('#ffffff', .8), 'b': ('#ffffff', 1)})
BOLT = tile([
	'......a.....',
	'.....a......',
	'....aaaa....',
	'......a.....',
	'.....a......',
	'....a.......'], {'a': ('#fffbd0', .9)})

HPHEART = tile(scatter(32, 24, 2, [['.a.a.', 'aaaaa', '.aaa.', '..a..']], 3), {'a': ('#ffffff', .7)})
HPPILL = tile(scatter(32, 24, 2, [['aabb'], ['.c.', 'ccc', '.c.']], 8), {'a': ('#ff9ac8', .9), 'b': ('#ffffff', .95), 'c': ('#ffffff', .8)})
PSTAR = tile(scatter(40, 20, 3, [['.a.', 'aba', '.a.']], 15), {'a': ('#ff8ac8', .8), 'b': ('#ffffff', 1)})

# 새 테마 3벌: 단풍 신사 · 우주 정거장 · 반딧불 숲
pat['momiji'] = tile([
	'....a.......',
	'..a.a.a.....',
	'...aaa......',
	'.aaaaaaa....',
	'...aaa......',
	'..a.b.a.....',
	'....b.......',
	'............'], {'a': ('#ffd060', .22), 'b': ('#3a1008', .25)})
pat['orbit'] = tile([
	'a.......',
	'a.......',
	'a.......',
	'bbbbbbbb',
	'a.......',
	'a.......',
	'a.......',
	'a.......'], {'a': ('#5af0c8', .14), 'b': ('#5af0c8', .2)})
pat['firefly'] = tile([
	'..a.....b...',
	'.aaa........',
	'aaaaa.......',
	'.aaa....a...',
	'..a....aaa..',
	'......aaaaa.',
	'.......aaa..',
	'........a...'], {'a': ('#0a2a12', .22), 'b': ('#c8f070', .5)})
LEAF = tile(scatter(32, 32, 3, [['.a.', 'aba', '.a.'], ['ab']], 61), {'a': ('#ffb040', .95), 'b': ('#e0562a', .95)})
SCAN = tile(['aaaaaaaa'] + ['........'] * 11, {'a': ('#8affe0', .35)})
GLOW = tile(scatter(40, 24, 4, [['.a.', 'aba', '.a.'], ['b']], 77), {'a': ('#c8f070', .6), 'b': ('#f0ffb0', 1)})

HP = [
	# 키, 이름, 띠, 움직임
	('ruby', ['#e8506a', '#b8203e', '#8a1430', '#5a0a1e'], None),
	('sapphire', ['#5a8af0', '#2a58c8', '#1a3e98', '#0e2462'], None),
	('emerald', ['#5ad890', '#24a05a', '#167a42', '#0a4a26'], None),
	('gold', ['#ffe070', '#c8961e', '#a07014', '#64440a'], 'shine'),
	('crystal', ['#9af0ff', '#2aa0b8', '#1a7a92', '#0e4e62'], 'spark'),
	('rainbow', ['#d83a4a', '#e07a2a', '#b8a020', '#38984a', '#2a68c0', '#6a3aa8'], 'shine'),
	('night', ['#3a4a8a', '#1a2658', '#121a40', '#0a0e26'], 'stars'),
	('lava', ['#ff8a2a', '#d0441a', '#8a1e0e', '#4a0e08'], 'ember'),
	('sakura', ['#ffb0d0', '#d0689a', '#a84a7a', '#6e2a52'], 'petal'),
	('metal', ['#c8d0dc', '#6e7886', '#545e6c', '#343a46'], 'shine'),
	('electric', ['#ffe860', '#b89010', '#8a6a0a', '#4a3a06'], 'bolt'),
	('yume', ['#f0d8ff', '#b88ae0', '#9a6ad0', '#6a48a8'], 'hearts'),
	('yami', ['#ff6ab0', '#4a1450', '#341048', '#1a0a24'], 'pstars'),
	('menhera', ['#ffe0ee', '#e870a8', '#d05890', '#9a3a6a'], 'pills'),
	('momiji', ['#ffb050', '#d0481e', '#a02a14', '#5a140a'], 'leaf'),
	('orbit', ['#8ab8e8', '#28406e', '#1a2c52', '#0c1630'], 'scan'),
	('firefly', ['#8ad890', '#226a3a', '#184e2c', '#0c2e1a'], 'glow'),
]


def bands(cs):
	if len(cs) == 4:
		return f'linear-gradient(180deg, {cs[0]} 0 4px, {cs[1]} 4px 50%, {cs[2]} 50% 80%, {cs[3]} 80%)'
	n = len(cs)
	return 'linear-gradient(180deg, ' + ', '.join(f'{c} {i * 100 / n:.1f}% {(i + 1) * 100 / n:.1f}%' for i, c in enumerate(cs)) + ')'


out = ['/* ═════ FX:BEGIN — scripts/gen-fx-css.py 가 만든 부분 (손으로 고치지 말 것) ═════ */',
       '/* HP 창 테마: 띠 + 도트 무늬 + 은은한 움직임 (::before, 글자 아래) */',
       '[class*="hpt-"] .info { isolation: isolate; }',
       '[class*="hpt-"] .info::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; image-rendering: pixelated; }']
for key, cs, fx in HP:
	u, w, h = pat[key]
	out.append(f'.hpt-{key} .info {{ background: {u} 0 0 / {w}px {h}px repeat, {bands(cs)} !important; background-origin: border-box !important; }}')
	sel = f'.hpt-{key} .info::before'
	if fx == 'spark':
		u2, w2, h2 = SPARK
		out.append(f'{sel} {{ background: {u2} 0 0 / {w2}px {h2}px repeat; animation: hpSpark 2.8s steps(1) infinite; }}')
	elif fx == 'shine':
		out.append(f'{sel} {{ background: linear-gradient(105deg, transparent 0 40%, rgba(255,255,255,.32) 40% 45%, transparent 45% 48%, rgba(255,255,255,.2) 48% 50%, transparent 50%) 0 0 / 300% 100% no-repeat; animation: hpShine 3.6s steps(30) infinite; }}')
	elif fx == 'stars':
		u2, w2, h2 = STARS
		out.append(f'{sel} {{ background: {u2} 0 0 / {w2}px {h2}px repeat; animation: hpSpark 2.2s steps(1) infinite; }}')
	elif fx == 'ember':
		u2, w2, h2 = EMBER
		out.append(f'{sel} {{ background: {u2} 0 0 / {w2}px {h2}px repeat; animation: hpRise 2.4s steps(32) infinite; --rise: -{h2}px; }}')
	elif fx == 'petal':
		u2, w2, h2 = PETALS
		out.append(f'{sel} {{ background: {u2} 0 0 / {w2}px {h2}px repeat; animation: hpDrift 4s steps(32) infinite; --dx: {w2}px; --dy: {h2}px; }}')
	elif fx in ('hearts', 'pills'):
		u2, w2, h2 = (HPHEART if fx == 'hearts' else HPPILL)
		dy = f'-{h2}px' if fx == 'hearts' else f'{h2}px'
		out.append(f'{sel} {{ background: {u2} 0 0 / {w2}px {h2}px repeat; animation: hpDrift 3.6s steps(24) infinite; --dx: 0px; --dy: {dy}; }}')
	elif fx == 'pstars':
		u2, w2, h2 = PSTAR
		out.append(f'{sel} {{ background: {u2} 0 0 / {w2}px {h2}px repeat; animation: hpSpark 2.4s steps(1) infinite; }}')
	elif fx == 'leaf':
		u2, w2, h2 = LEAF
		out.append(f'{sel} {{ background: {u2} 0 0 / {w2}px {h2}px repeat; animation: hpDrift 5s steps(32) infinite; --dx: -{w2}px; --dy: {h2}px; }}')
	elif fx == 'scan':
		u2, w2, h2 = SCAN
		out.append(f'{sel} {{ background: {u2} 0 0 / {w2}px {h2}px repeat; animation: hpRise 1.8s steps(12) infinite; --rise: {h2}px; }}')
	elif fx == 'glow':
		u2, w2, h2 = GLOW
		out.append(f'{sel} {{ background: {u2} 0 0 / {w2}px {h2}px repeat; animation: hpSpark 3.2s steps(1) infinite; }}')
	elif fx == 'bolt':
		u2, w2, h2 = BOLT
		out.append(f'{sel} {{ background: {u2} 70% 50% / {w2}px {h2}px no-repeat, {u2} 20% 30% / {w2}px {h2}px no-repeat; animation: hpFlash 2.6s steps(1) infinite; }}')
out += [
	'@keyframes hpSpark { 0% { background-position: 0 0; opacity: .9; } 18% { opacity: 0; } 50% { background-position: 34px 12px; opacity: .9; } 68% { opacity: 0; } }',
	'@keyframes hpShine { 0% { background-position: 100% 0; } 55%, 100% { background-position: 0 0; } }',
	'@keyframes hpRise { to { background-position: 0 var(--rise); } }',
	'@keyframes hpDrift { to { background-position: var(--dx) var(--dy); } }',
	'@keyframes hpFlash { 0%, 100% { opacity: 0; } 8% { opacity: 1; } 12% { opacity: 0; } 16% { opacity: .8; } 22% { opacity: 0; } }',
]

# ───────── BP 배경의 은은한 움직임 (배틀·미리보기 공통: .arena-bg 위에 겹침) ─────────
CLOUD = tile(scatter(128, 10, 3, [['..aaaaaa....', 'aaaaaaaaaaa.', '.bbbbbbbbbbb']], 4), {'a': ('#ffc8a0', .5), 'b': ('#c86a7a', .5)})
TWINK = tile(scatter(64, 40, 5, [['.a.', 'aba', '.a.'], ['b'], ['b']], 13), {'a': ('#ffffff', .7), 'b': ('#ffffff', .95)})
GLINT = tile(scatter(48, 6, 4, [['aaa'], ['aa']], 8), {'a': ('#e8f0ff', .7)})
FALL = tile(scatter(48, 48, 5, [['ab', 'b.'], ['a']], 31), {'a': ('#ffe0ee', .95), 'b': ('#ff9ac4', .95)})
DUST = tile(scatter(64, 24, 6, [['a'], ['aa'], ['b']], 17), {'a': ('#fff0c8', .55), 'b': ('#e0c088', .6)})
AUR = tile([
	'aaaa............................................................',
	'....aaaa..................................................bbbbbb',
	'........aaaa.........................................bbbbb......',
	'............aaaaaa...............................bbbb...........',
	'..................aaaaaa.....................bbbb...............',
	'........................aaaaaa..........bbbbb...................',
	'..............................aaaaaaaaaa........................',
], {'a': ('#7affc8', .35), 'b': ('#c88aff', .3)})
SNOW = tile(scatter(40, 40, 5, [['a'], ['a']], 2), {'a': ('#ffffff', .85)})

ar = []
def layer(name, which, u, w, h, top, bottom, anim):
	ar.append(f'.bg-{name} .arena-bg::{which} {{ content: ""; position: absolute; left: 0; right: 0; top: {top}; bottom: {bottom}; pointer-events: none; image-rendering: pixelated; background: {u} 0 0 / {w}px {h}px repeat; animation: {anim}; }}')

u, w, h = CLOUD; layer('sunset', 'before', u, w, h, '36%', '52%', f'arDrift 60s steps(256) infinite; --dx: {w}px; --dy: 0px')
u, w, h = TWINK; layer('sunset', 'after', u, w, h, '0', '68%', 'arTwinkle 3.2s steps(1) infinite')
u, w, h = TWINK; layer('starry', 'before', u, w, h, '0', '50%', 'arTwinkle 2.6s steps(1) infinite')
u, w, h = GLINT; layer('starry', 'after', u, w, h, '57%', '35%', f'arDrift 6s steps(24) infinite; --dx: {w}px; --dy: 0px')
u, w, h = FALL; layer('sakura', 'before', u, w, h, '0', '0', f'arDrift 9s steps(72) infinite; --dx: -{w}px; --dy: {h * 2}px')
u, w, h = DUST; layer('desert', 'before', u, w, h, '52%', '0', f'arDrift 7s steps(64) infinite; --dx: -{w}px; --dy: 0px')
ar.append('.bg-desert .arena-bg::after { content: ""; position: absolute; left: 0; right: 0; top: 0; bottom: 48%; pointer-events: none; background: repeating-linear-gradient(180deg, rgba(255,240,200,.08) 0 2px, transparent 2px 8px); animation: arHeat 1.6s steps(4) infinite; }')
u, w, h = AUR; layer('aurora', 'before', u, w, h, '27%', '58%', f'arDrift 24s steps(128) infinite; --dx: {w}px; --dy: 0px')
u, w, h = SNOW; layer('aurora', 'after', u, w, h, '0', '0', f'arDrift 10s steps(80) infinite; --dx: 8px; --dy: {h * 2}px')
BUBBLE = tile(scatter(48, 64, 4, [['.a.', 'a.a', '.a.'], ['a'], ['a']], 41), {'a': ('#c8f0ff', .8)})
RAYS = tile(['a.......' * 2] * 1 + ['........' * 2] * 3, {'a': ('#8ad8ff', .25)})
SKYCLOUD = tile(scatter(160, 12, 3, [['..aaaaaaaa..', 'aaaaaaaaaaaa', '.bbbbbbbbbb.']], 12), {'a': ('#ffffff', .75), 'b': ('#dce8fa', .75)})
WIN = tile(scatter(40, 30, 6, [['a', 'a'], ['b', 'b'], ['c', 'c']], 27), {'a': ('#ffe08a', .9), 'b': ('#8ae0ff', .9), 'c': ('#ffb0e0', .9)})
RAIN = tile(scatter(32, 32, 4, [['a', 'a', 'a']], 51), {'a': ('#b8c8ff', .4)})
u, w, h = BUBBLE; layer('deepsea', 'before', u, w, h, '0', '40%', f'arDrift 6s steps(48) infinite; --dx: 0px; --dy: -{h}px')
ar.append('.bg-deepsea .arena-bg::after { content: ""; position: absolute; left: 0; right: 0; top: 0; bottom: 45%; pointer-events: none; background: repeating-linear-gradient(105deg, transparent 0 22px, rgba(140,216,255,.10) 22px 30px, transparent 30px 64px) 0 0 / 200% 100%; animation: arRay 8s steps(32) infinite; }')
u, w, h = SKYCLOUD; layer('skypillar', 'before', u, w, h, '40%', '48%', f'arDrift 40s steps(160) infinite; --dx: -{w}px; --dy: 0px')
u, w, h = SKYCLOUD; layer('skypillar', 'after', u, w, h, '8%', '76%', f'arDrift 70s steps(160) infinite; --dx: {w}px; --dy: 0px; opacity: .5')
u, w, h = WIN; layer('neon', 'before', u, w, h, '10%', '62%', 'arTwinkle 2.4s steps(1) infinite')
u, w, h = RAIN; layer('neon', 'after', u, w, h, '0', '0', f'arDrift 1.2s steps(16) infinite; --dx: -8px; --dy: {h}px')
ar.append('@keyframes arRay { 0%, 100% { background-position: 0 0; } 50% { background-position: 24px 0; } }')
HEARTS = tile(scatter(64, 64, 3, [['.a.a.', 'aaaaa', '.aaa.', '..a..'], ['.b.b.', 'bbbbb', '.bbb.', '..b..'], ['c']], 71), {'a': ('#ff9ac8', .85), 'b': ('#c8a8ff', .85), 'c': ('#ffffff', .9)})
PUFF = tile(scatter(192, 14, 2, [['...aaaa......', '.aaaaaaaaaa..', 'aaaaaaaaaaaaa', '.bbbbbbbbbbb.']], 33), {'a': ('#ffffff', .8), 'b': ('#f0dcf4', .8)})
DARKH = tile(scatter(56, 56, 3, [['.a.a.', 'aaaaa', '.aaa.', '..a..'], ['b']], 19), {'a': ('#ff4aa0', .7), 'b': ('#ff9ad0', .9)})
PINKSTAR = tile(scatter(48, 32, 4, [['.a.', 'aba', '.a.'], ['b']], 23), {'a': ('#ff8ac8', .7), 'b': ('#ffffff', .95)})
PILLS = tile(scatter(64, 64, 4, [['aabb', 'aabb'], ['.c.', 'ccc', '.c.']], 47), {'a': ('#ff8ac0', .85), 'b': ('#ffffff', .95), 'c': ('#8ad0f0', .85)})
u, w, h = HEARTS; layer('yume', 'before', u, w, h, '0', '30%', f'arDrift 9s steps(64) infinite; --dx: 16px; --dy: -{h}px')
u, w, h = PUFF; layer('yume', 'after', u, w, h, '10%', '62%', f'arDrift 50s steps(192) infinite; --dx: {w}px; --dy: 0px')
u, w, h = PINKSTAR; layer('yami', 'before', u, w, h, '0', '50%', 'arTwinkle 2.8s steps(1) infinite')
u, w, h = DARKH; layer('yami', 'after', u, w, h, '20%', '0', f'arDrift 12s steps(56) infinite; --dx: 0px; --dy: -{h}px; opacity: .6')
u, w, h = PILLS; layer('menhera', 'before', u, w, h, '0', '40%', f'arDrift 14s steps(64) infinite; --dx: -16px; --dy: {h}px')
u, w, h = PINKSTAR; layer('menhera', 'after', u, w, h, '0', '0', 'arTwinkle 3.4s steps(1) infinite; opacity: .7')
# 새 테마 3벌의 배경 움직임
MFALL = tile(scatter(48, 48, 5, [['.a.', 'aba', '.a.'], ['ab'], ['a']], 91), {'a': ('#f08a30', .95), 'b': ('#c83a22', .95)})
SHOOT = tile(scatter(96, 48, 2, [['aab.....', '...bbcc.', '.......c']], 37), {'a': ('#ffffff', .9), 'b': ('#c8d8ff', .6), 'c': ('#8aa0d8', .3)})
FLY = tile(scatter(64, 48, 6, [['.a.', 'aba', '.a.'], ['b'], ['b']], 113), {'a': ('#c8f070', .55), 'b': ('#f0ffb0', 1)})
FLY2 = tile(scatter(72, 40, 4, [['b'], ['.a.', 'aba', '.a.']], 127), {'a': ('#8ad8ff', .5), 'b': ('#e8ffff', .95)})
u, w, h = MFALL; layer('momiji', 'before', u, w, h, '0', '0', f'arDrift 11s steps(88) infinite; --dx: -{w}px; --dy: {h * 2}px')
u, w, h = TWINK; layer('momiji', 'after', u, w, h, '0', '70%', 'arTwinkle 3.6s steps(1) infinite; opacity: .6')
u, w, h = TWINK; layer('orbit', 'before', u, w, h, '5%', '50%', 'arTwinkle 2.4s steps(1) infinite')
u, w, h = SHOOT; layer('orbit', 'after', u, w, h, '6%', '52%', f'arDrift 5s steps(48) infinite; --dx: {w}px; --dy: {h}px; opacity: .8')
u, w, h = FLY; layer('firefly', 'before', u, w, h, '25%', '0', 'arTwinkle 2.8s steps(1) infinite')
u, w, h = FLY2; layer('firefly', 'after', u, w, h, '30%', '8%', f'arDrift 16s steps(72) infinite; --dx: {w}px; --dy: -{h}px')
ar += [
	'.arena-bg { overflow: hidden; }',
	'@keyframes arDrift { to { background-position: var(--dx) var(--dy); } }',
	'@keyframes arTwinkle { 0% { background-position: 0 0; opacity: 1; } 25% { opacity: .3; } 50% { background-position: 22px 14px; opacity: 1; } 75% { opacity: .3; } }',
	'@keyframes arHeat { 0% { transform: translateY(0); } 50% { transform: translateY(2px); } }',
	'@media (prefers-reduced-motion: reduce) { [class*="hpt-"] .info::before, .arena-bg::before, .arena-bg::after { animation: none !important; } }',
	'/* ═════ FX:END ═════ */',
]
block = '\n'.join(out + ['/* BP 배경 움직임 */'] + ar)
src = open(CSS).read()
if 'FX:BEGIN' in src:
	src = re.sub(r'/\* ═════ FX:BEGIN.*?FX:END ═════ \*/', lambda m: block, src, flags=re.S)
else:
	src = src.rstrip('\n') + '\n\n' + block + '\n'
open(CSS, 'w').write(src)
print('fx css', len(block), 'bytes')
