#!/usr/bin/env python3
"""배틀 배경(도트) 생성기 — 직접 그린 원본 픽셀 아트. 256x144, 앱에서 정수배로 확대해 사용.
사용법: python3 battle-kr/scripts/gen-arenas.py
"""
import math
import os
import random
from PIL import Image, ImageDraw

W, H = 256, 144
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'ui-assets')


def bands(d, y0, y1, colors, w=None):
    n = len(colors)
    for i, c in enumerate(colors):
        a = y0 + (y1 - y0) * i // n
        b = y0 + (y1 - y0) * (i + 1) // n
        d.rectangle([0, a, w or W, b], fill=c)


def dither_line(d, y, c1, c2):
    for x in range(0, W, 2):
        d.point((x + (y % 2), y), fill=c2)


def ellipse_platform(d, cx, cy, rx, ry, top, rim, shade):
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry + 3], fill=shade)
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=rim)
    d.ellipse([cx - rx + 3, cy - ry + 2, cx + rx - 3, cy + ry - 2], fill=top)


def field():
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 60, ['#5aa8e8', '#68b4ee', '#78c0f2', '#8ccaf4', '#a0d6f6', '#b8e2f8'])
    rnd = random.Random(3)
    for _ in range(5):  # 구름
        cx, cy = rnd.randint(0, W), rnd.randint(6, 40)
        for k in range(4):
            d.ellipse([cx + k * 9 - 12, cy - 5 + (k % 2) * 3, cx + k * 9 + 6, cy + 6], fill='#f4fbff')
        d.rectangle([cx - 12, cy + 3, cx + 36, cy + 6], fill='#dcefff')
    # 먼 산
    for i, (col, base, amp) in enumerate([('#7ab0c8', 62, 14), ('#5e9a8a', 66, 10)]):
        pts = [(0, H)]
        for x in range(0, W + 8, 8):
            pts.append((x, base - amp * abs(math.sin(x / (37 + i * 11))) - (x % 16 == 0) * 2))
        pts.append((W, H))
        d.polygon(pts, fill=col)
    # 숲 줄
    for x in range(-4, W, 7):
        h = 6 + (x * 7) % 5
        d.polygon([(x, 74), (x + 4, 74 - h), (x + 8, 74)], fill='#3f7a46')
    bands(d, 74, H, ['#79c25a', '#71ba52', '#69b24c', '#62aa46', '#5aa240', '#539a3a'])
    for y in range(74, H, 3):
        for x in range((y * 5) % 9, W, 9):
            d.point((x, y), fill='#8fd06a')
    ellipse_platform(d, 196, 82, 46, 9, '#a8d878', '#78b050', '#4f8a36')
    ellipse_platform(d, 62, 132, 62, 11, '#a8d878', '#78b050', '#4f8a36')
    return im


def tower():
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 76, ['#141838', '#181e44', '#1c2450', '#222a5c', '#283268', '#2e3a76'])
    # 창문 + 별
    rnd = random.Random(7)
    for wx in range(14, W, 58):
        d.rectangle([wx, 10, wx + 30, 58], fill='#0a0e26')
        d.rectangle([wx + 2, 12, wx + 28, 56], fill='#1a2a6a')
        for _ in range(8):
            d.point((wx + rnd.randint(3, 27), rnd.randint(13, 55)), fill='#e8f0ff')
        d.rectangle([wx + 14, 12, wx + 15, 56], fill='#0a0e26')
        d.rectangle([wx + 2, 33, wx + 28, 34], fill='#0a0e26')
    # 기둥
    for px in range(0, W, 58):
        d.rectangle([px - 6, 0, px + 4, 78], fill='#3a4688')
        d.rectangle([px - 6, 0, px - 4, 78], fill='#5462a8')
        d.rectangle([px + 2, 0, px + 4, 78], fill='#262e60')
    # 바닥 타일
    bands(d, 76, H, ['#4a5aa8', '#4454a0', '#3e4e98', '#384890', '#334288', '#2e3c80'])
    for y in range(78, H, 8):
        d.line([(0, y), (W, y)], fill='#56669e')
    for i in range(-12, 14):
        x0 = W // 2 + i * 22
        d.line([(W // 2 + i * 6, 76), (x0, H)], fill='#56669e')
    ellipse_platform(d, 196, 82, 46, 9, '#9aa8e8', '#6a78c0', '#3c4888')
    ellipse_platform(d, 62, 132, 62, 11, '#9aa8e8', '#6a78c0', '#3c4888')
    return im


def factory():
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 76, ['#25282f', '#2b2f37', '#31353e', '#383c46', '#3e434e', '#454a56'])
    # 파이프
    for y, c in [(14, '#7a6a52'), (30, '#5b6b7a')]:
        d.rectangle([0, y, W, y + 6], fill=c)
        d.rectangle([0, y, W, y + 1], fill='#b0a080' if c == '#7a6a52' else '#8aa0b4')
        for x in range(10, W, 40):
            d.rectangle([x, y - 1, x + 4, y + 7], fill='#2a2a2a')
    # 컨베이어 + 경고 줄무늬
    d.rectangle([0, 58, W, 72], fill='#2a2d33')
    for x in range(-14, W, 14):
        d.polygon([(x, 72), (x + 7, 72), (x + 14, 66), (x + 7, 66)], fill='#e0b030')
    d.rectangle([0, 64, W, 66], fill='#1c1e22')
    for x in range(20, W, 64):  # 상자
        d.rectangle([x, 44, x + 18, 58], fill='#8a6a3a')
        d.rectangle([x, 44, x + 18, 45], fill='#b08a50')
        d.line([(x, 44), (x + 18, 58)], fill='#6a4e28')
    bands(d, 76, H, ['#6c7280', '#666c79', '#606672', '#5a606b', '#545a64', '#4e535d'])
    for y in range(76, H, 10):
        for x in range((y // 10 % 2) * 10, W, 20):
            d.rectangle([x, y, x + 9, y + 9], outline='#777d8a')
    ellipse_platform(d, 196, 82, 46, 9, '#b8bcc6', '#8a8f9a', '#4e535d')
    ellipse_platform(d, 62, 132, 62, 11, '#b8bcc6', '#8a8f9a', '#4e535d')
    return im


def stadium():
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 30, ['#1a0c2c', '#24103a', '#2e1448'])
    # 관중석
    rnd = random.Random(11)
    for row in range(6):
        y = 30 + row * 6
        d.rectangle([0, y, W, y + 5], fill=['#4a1e5a', '#55246a', '#4a1e5a', '#55246a', '#4a1e5a', '#55246a'][row])
        for x in range((row % 2) * 2, W, 4):
            d.rectangle([x, y + 1, x + 1, y + 3], fill=rnd.choice(['#e86a8a', '#f2c25a', '#7ac0f0', '#c8a0f0', '#f0f0f0', '#5a2a6a']))
    # 조명
    for lx in [30, 128, 226]:
        d.polygon([(lx - 4, 0), (lx + 4, 0), (lx + 26, 66), (lx - 26, 66)], fill=None)
        d.rectangle([lx - 6, 2, lx + 6, 7], fill='#fff4c0')
    d.rectangle([0, 66, W, 76], fill='#2a0c34')
    for x in range(0, W, 32):
        d.rectangle([x + 4, 68, x + 26, 73], fill='#e86a8a' if (x // 32) % 2 else '#f2c25a')
    bands(d, 76, H, ['#b04a7a', '#a84474', '#a03e6e', '#983868', '#903262', '#882c5c'])
    d.ellipse([60, 88, 196, 140], outline='#e8a0c0')
    d.line([(0, 110), (W, 110)], fill='#c86a98')
    ellipse_platform(d, 196, 82, 46, 9, '#f0b8d4', '#d080a8', '#80305a')
    ellipse_platform(d, 62, 132, 62, 11, '#f0b8d4', '#d080a8', '#80305a')
    return im


def champion():
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 76, ['#2a0606', '#360a0a', '#420e0e', '#501414', '#5e1a1a', '#6c2020'])
    # 휘장과 금 장식
    for x in range(0, W, 32):
        d.polygon([(x, 0), (x + 32, 0), (x + 26, 50), (x + 16, 56), (x + 6, 50)], fill='#8a1c1c')
        d.line([(x + 16, 0), (x + 16, 54)], fill='#6a1010')
        d.rectangle([x + 13, 44, x + 19, 50], fill='#f0c040')
    d.rectangle([0, 0, W, 4], fill='#f0c040')
    d.rectangle([0, 4, W, 5], fill='#a07018')
    bands(d, 76, H, ['#c8902e', '#c08828', '#b88022', '#ae781e', '#a4701a', '#9a6816'])
    for y in range(78, H, 6):
        dither_line(d, y, None, '#d8a840')
    d.rectangle([W // 2 - 40, 76, W // 2 + 40, H], fill='#8a1c1c')
    d.rectangle([W // 2 - 40, 76, W // 2 - 38, H], fill='#f0c040')
    d.rectangle([W // 2 + 38, 76, W // 2 + 40, H], fill='#f0c040')
    ellipse_platform(d, 196, 82, 46, 9, '#f8dc90', '#d8a848', '#7a4e10')
    ellipse_platform(d, 62, 132, 62, 11, '#f8dc90', '#d8a848', '#7a4e10')
    return im






def cave():
    """동굴: 바위 벽·종유석·빛나는 결정, 자갈 바닥"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 74, ['#221c18', '#2a231e', '#322a24', '#3a3129', '#42382e', '#4a3f33'])
    rnd = random.Random(21)
    for _ in range(40):  # 벽 결
        x, y = rnd.randint(0, W), rnd.randint(4, 66)
        d.line([(x, y), (x + rnd.randint(4, 12), y + rnd.randint(-2, 2))], fill='#1c1714')
    for x in range(-6, W, 14):  # 종유석
        h = 8 + (x * 13) % 16
        d.polygon([(x, 0), (x + 10, 0), (x + 5, h)], fill='#1a1512')
        d.line([(x + 3, 0), (x + 5, h - 2)], fill='#4e4236')
    for _ in range(9):  # 결정
        x, y = rnd.randint(8, W - 8), rnd.randint(20, 62)
        c = rnd.choice(['#7ad8f0', '#b890f0', '#90f0c0'])
        d.polygon([(x, y - 4), (x + 3, y), (x, y + 4), (x - 3, y)], fill=c)
        d.point((x - 1, y - 2), fill='#ffffff')
    pts = [(0, 74)]
    for x in range(0, W + 8, 8):
        pts.append((x, 62 + 6 * abs(math.sin(x / 23)) + (x % 24 == 0) * 2))
    pts.append((W, 74))
    d.polygon(pts, fill='#54473a')
    bands(d, 74, H, ['#6a5844', '#64523e', '#5e4c38', '#584632', '#52402c', '#4c3a26'])
    for y in range(76, H, 4):
        for x in range((y * 7) % 11, W, 11):
            d.point((x, y), fill='#7c6850' if (x + y) % 3 else '#3e3020')
    ellipse_platform(d, 196, 82, 46, 9, '#8a7458', '#6a5640', '#3e3020')
    ellipse_platform(d, 62, 132, 62, 11, '#8a7458', '#6a5640', '#3e3020')
    return im


def beach():
    """바닷가: 맑은 하늘·수평선의 섬·파도, 모래사장"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 48, ['#3e9ae8', '#4ea6ec', '#60b2f0', '#74bef2', '#8acaf4', '#a2d6f6'])
    rnd = random.Random(8)
    for _ in range(3):
        cx, cy = rnd.randint(0, W), rnd.randint(8, 30)
        for k in range(3):
            d.ellipse([cx + k * 8 - 10, cy - 4 + (k % 2) * 2, cx + k * 8 + 6, cy + 5], fill='#f8fcff')
    d.ellipse([214, 8, 230, 24], fill='#fff2a8'); d.ellipse([217, 11, 227, 21], fill='#fffbe0')
    d.polygon([(30, 48), (44, 40), (58, 42), (70, 48)], fill='#4a8a6a')  # 먼 섬
    bands(d, 48, 74, ['#2a78c8', '#3082cc', '#368cd2', '#3e98d8', '#46a2dc', '#4eaee2'])
    for y in range(50, 74, 4):
        for x in range((y * 9) % 13, W, 13):
            d.line([(x, y), (x + 3, y)], fill='#a8dcf8')
    d.rectangle([0, 72, W, 75], fill='#e8f6ff')
    for x in range(0, W, 6):
        d.point((x + 2, 76), fill='#e8f6ff')
    bands(d, 76, H, ['#f0d890', '#ead088', '#e4c880', '#dec078', '#d8b870', '#d2b068'])
    for y in range(80, H, 5):
        for x in range((y * 5) % 9, W, 9):
            d.point((x, y), fill='#c4a060')
    for _ in range(6):  # 조개
        x, y = rnd.randint(4, W - 4), rnd.randint(92, H - 6)
        d.rectangle([x, y, x + 2, y + 1], fill=rnd.choice(['#f8b8c8', '#ffffff', '#f0a070']))
    ellipse_platform(d, 196, 82, 46, 9, '#f8e8b0', '#e0c880', '#b89858')
    ellipse_platform(d, 62, 132, 62, 11, '#f8e8b0', '#e0c880', '#b89858')
    return im


def snow():
    """설원: 흐린 하늘·눈 덮인 산·전나무, 눈밭과 얼음 발판"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 62, ['#9ab6d6', '#a6c0dc', '#b2cae2', '#bed4e8', '#cadeee', '#d6e8f4'])
    for i, (col, base, amp, per) in enumerate([('#8aa0c0', 58, 26, 29), ('#7890b4', 64, 16, 19)]):
        pts = [(0, H)]
        for x in range(0, W + 8, 8):
            pts.append((x, base - amp * abs(math.sin(x / per + i))))
        pts.append((W, H))
        d.polygon(pts, fill=col)
        for x in range(0, W, 8):  # 눈 덮인 봉우리
            y = base - amp * abs(math.sin(x / per + i))
            if y < base - amp * 0.6:
                d.polygon([(x - 6, y + 6), (x, y), (x + 6, y + 6)], fill='#f4f8ff')
    for x in range(-4, W, 9):  # 전나무
        h = 10 + (x * 5) % 6
        d.polygon([(x, 76), (x + 4, 76 - h), (x + 8, 76)], fill='#2e5a50')
        d.point((x + 4, 76 - h), fill='#ffffff'); d.line([(x + 2, 76 - h // 2), (x + 6, 76 - h // 2)], fill='#e8f0f8')
    bands(d, 76, H, ['#f4f8ff', '#eef4fc', '#e8f0fa', '#e2ecf8', '#dce8f6', '#d6e4f4'])
    for y in range(80, H, 4):
        for x in range((y * 7) % 13, W, 13):
            d.point((x, y), fill='#b8cce4')
    rnd = random.Random(4)
    for _ in range(50):  # 눈송이
        d.point((rnd.randint(0, W - 1), rnd.randint(0, 70)), fill='#ffffff')
    ellipse_platform(d, 196, 82, 46, 9, '#ffffff', '#c8dcf0', '#90acd0')
    ellipse_platform(d, 62, 132, 62, 11, '#ffffff', '#c8dcf0', '#90acd0')
    return im


def volcano():
    """화산: 붉은 하늘·용암이 흐르는 화산, 갈라진 현무암 바닥"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 66, ['#24080a', '#320c0c', '#40120e', '#4e1810', '#5c1e12', '#6c2614'])
    rnd = random.Random(13)
    d.polygon([(70, 74), (112, 22), (144, 22), (190, 74)], fill='#2a1612')  # 화산
    d.polygon([(112, 22), (144, 22), (138, 28), (118, 28)], fill='#ff8a2a')
    for (x0, x1) in [(122, 104), (132, 150), (128, 120)]:  # 용암 줄기
        d.line([(x0, 26), (x1, 72)], fill='#f05a1a', width=2)
        d.line([(x0, 26), (x1, 72)], fill='#ffb040', width=1)
    for _ in range(4):  # 연기
        cx, cy = 128 + rnd.randint(-10, 10), rnd.randint(4, 16)
        d.ellipse([cx - 8, cy - 5, cx + 8, cy + 5], fill='#4a2a26')
    for _ in range(40):  # 불티
        d.point((rnd.randint(0, W - 1), rnd.randint(0, 66)), fill=rnd.choice(['#ffb040', '#f06a1a', '#ffe080']))
    bands(d, 74, H, ['#3a2420', '#34201c', '#2e1c18', '#281814', '#221410', '#1c100c'])
    for _ in range(12):  # 용암 틈
        x, y = rnd.randint(0, W - 20), rnd.randint(86, H - 4)
        pts = [(x, y)]
        for k in range(4):
            x += rnd.randint(4, 8); y += rnd.randint(-2, 2); pts.append((x, y))
        d.line(pts, fill='#f06a1a'); d.line([(p[0], p[1] - 1) for p in pts], fill='#ffb030')
    ellipse_platform(d, 196, 82, 46, 9, '#6a4438', '#4a2c24', '#1a0c08')
    ellipse_platform(d, 62, 132, 62, 11, '#6a4438', '#4a2c24', '#1a0c08')
    return im


def gym():
    """체육관 안: 휘장이 걸린 벽·조명, 반들반들한 경기장 바닥"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 70, ['#26304a', '#2c3854', '#32405e', '#384868', '#3e5072', '#44587c'])
    for x in range(0, W, 64):  # 기둥
        d.rectangle([x, 0, x + 6, 70], fill='#1e2840'); d.rectangle([x + 1, 0, x + 2, 70], fill='#56688c')
    for x in range(20, W, 64):  # 휘장과 문장
        d.polygon([(x, 6), (x + 24, 6), (x + 24, 44), (x + 12, 52), (x, 44)], fill='#b02a3a')
        d.rectangle([x, 6, x + 24, 8], fill='#f0c040')
        d.ellipse([x + 6, 18, x + 18, 30], fill='#f0c040'); d.ellipse([x + 9, 21, x + 15, 27], fill='#b02a3a')
    for x in range(0, W, 16):  # 위쪽 조명
        d.rectangle([x + 6, 0, x + 10, 2], fill='#fff4c0')
    d.rectangle([0, 66, W, 72], fill='#1a2238')
    bands(d, 72, H, ['#d8c8a0', '#d2c298', '#ccbc90', '#c6b688', '#c0b080', '#baaa78'])
    for y in range(76, H, 10):  # 마루 이음매
        d.line([(0, y), (W, y)], fill='#a8986a')
    for x in range(0, W, 24):
        for y in range(76, H, 20):
            d.line([(x + (y // 10 % 2) * 12, y), (x + (y // 10 % 2) * 12, y + 10)], fill='#a8986a')
    d.line([(0, 104), (W, 104)], fill='#f8f4e8')  # 경기장 선
    d.ellipse([98, 94, 158, 114], outline='#f8f4e8')
    ellipse_platform(d, 196, 82, 46, 9, '#f0e6cc', '#c0b088', '#7a6a48')
    ellipse_platform(d, 62, 132, 62, 11, '#f0e6cc', '#c0b088', '#7a6a48')
    return im


# ───────── 낮 버전 (v2.44): 배틀시설 3종 + 타이틀 ─────────
def clouds(d, rnd, n, y0, y1, w=None, c1='#f4fbff', c2='#dcefff'):
    for _ in range(n):
        cx, cy = rnd.randint(0, w or W), rnd.randint(y0, y1)
        for k in range(4):
            d.ellipse([cx + k * 9 - 12, cy - 5 + (k % 2) * 3, cx + k * 9 + 6, cy + 6], fill=c1)
        d.rectangle([cx - 12, cy + 3, cx + 36, cy + 6], fill=c2)


def tower_day():
    """배틀타워 낮: 밝은 벽, 창밖 파란 하늘과 구름, 햇빛 비치는 타일"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 76, ['#9aa8d0', '#a4b2d8', '#aebcde', '#b8c4e4', '#c2ceea', '#ccd6ee'])
    rnd = random.Random(7)
    for wx in range(14, W, 58):
        d.rectangle([wx, 10, wx + 30, 58], fill='#4a5890')
        sky = Image.new('RGB', (27, 45)); sd = ImageDraw.Draw(sky)
        for i, c in enumerate(['#5ab0f0', '#68b8f2', '#78c2f4', '#8ccdf6', '#a2d8f8']):
            sd.rectangle([0, i * 9, 27, i * 9 + 9], fill=c)
        cy = rnd.randint(8, 30); cx = rnd.randint(-6, 14)
        sd.ellipse([cx, cy, cx + 14, cy + 7], fill='#f4fbff'); sd.ellipse([cx + 8, cy - 3, cx + 20, cy + 6], fill='#f4fbff')
        im.paste(sky, (wx + 2, 12))
        d.rectangle([wx + 14, 12, wx + 15, 56], fill='#4a5890')
        d.rectangle([wx + 2, 33, wx + 28, 34], fill='#4a5890')
        d.line([(wx + 4, 14), (wx + 10, 14)], fill='#ffffff')  # 유리 반사
    for px in range(0, W, 58):
        d.rectangle([px - 6, 0, px + 4, 78], fill='#e4eaf6')
        d.rectangle([px - 6, 0, px - 4, 78], fill='#ffffff')
        d.rectangle([px + 2, 0, px + 4, 78], fill='#a8b4d4')
    bands(d, 76, H, ['#c0cef0', '#b6c6ec', '#acbce6', '#a2b2e0', '#98a8d8', '#8e9ed0'])
    for y in range(78, H, 8):
        d.line([(0, y), (W, y)], fill='#d6e0f8')
    for i in range(-12, 14):
        d.line([(W // 2 + i * 6, 76), (W // 2 + i * 22, H)], fill='#d6e0f8')
    for wx in range(14, W, 58):  # 창으로 드는 햇빛 (바닥에 밝은 사다리꼴)
        d.polygon([(wx + 4, 78), (wx + 28, 78), (wx + 40, 92), (wx + 12, 92)], fill='#d8e4fa')
    ellipse_platform(d, 196, 82, 46, 9, '#eef2fc', '#b4c0e4', '#7884b4')
    ellipse_platform(d, 62, 132, 62, 11, '#eef2fc', '#b4c0e4', '#7884b4')
    return im


def factory_day():
    """배틀팩토리 낮: 천장 채광창으로 빛이 드는 밝은 공장"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 76, ['#7c8494', '#868e9e', '#9098a8', '#9aa2b0', '#a4acb8', '#aeb5c0'])
    for x in range(8, W, 48):  # 채광창
        d.rectangle([x, 0, x + 32, 10], fill='#3c4250')
        for i, c in enumerate(['#6ab8f0', '#80c6f4', '#98d4f6']):
            d.rectangle([x + 2, i * 3, x + 30, i * 3 + 3], fill=c)
        d.rectangle([x + 15, 0, x + 16, 10], fill='#3c4250')
    for y, c, hi in [(16, '#c08a3a', '#e8b860'), (32, '#4a8ac0', '#7ab4e0')]:  # 파이프
        d.rectangle([0, y, W, y + 6], fill=c)
        d.rectangle([0, y, W, y + 1], fill=hi)
        for x in range(10, W, 40):
            d.rectangle([x, y - 1, x + 4, y + 7], fill='#50545c')
    d.rectangle([0, 58, W, 72], fill='#4a4e58')
    for x in range(-14, W, 14):
        d.polygon([(x, 72), (x + 7, 72), (x + 14, 66), (x + 7, 66)], fill='#f0c030')
    d.rectangle([0, 64, W, 66], fill='#34373e')
    for x in range(20, W, 64):
        d.rectangle([x, 44, x + 18, 58], fill='#b08850')
        d.rectangle([x, 44, x + 18, 45], fill='#d8b070')
        d.line([(x, 44), (x + 18, 58)], fill='#8a6838')
    bands(d, 76, H, ['#c4c9d2', '#bcc1cb', '#b4b9c3', '#acb1bb', '#a4a9b3', '#9ca1ab'])
    for y in range(76, H, 10):
        for x in range((y // 10 % 2) * 10, W, 20):
            d.rectangle([x, y, x + 9, y + 9], outline='#d4d8e0')
    for x in range(8, W, 48):  # 채광창 빛
        d.polygon([(x + 4, 76), (x + 30, 76), (x + 38, 96), (x + 10, 96)], fill='#d0d6e0')
    ellipse_platform(d, 196, 82, 46, 9, '#eef0f4', '#c0c4cc', '#80848e')
    ellipse_platform(d, 62, 132, 62, 11, '#eef0f4', '#c0c4cc', '#80848e')
    return im


def stadium_day():
    """경기장(PWT) 낮: 파란 하늘 아래 관중석·깃발"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 30, ['#4ea6ec', '#64b4f0', '#7cc2f4'])
    clouds(d, random.Random(12), 3, 4, 18)
    rnd = random.Random(11)
    for x in range(10, W, 40):  # 깃발
        d.rectangle([x, 12, x, 30], fill='#f0f0f0')
        d.polygon([(x + 1, 12), (x + 10, 15), (x + 1, 18)], fill=['#f04a6a', '#f2c25a', '#4a9ae8'][(x // 40) % 3])
    for row in range(6):
        y = 30 + row * 6
        d.rectangle([0, y, W, y + 5], fill=['#c86a9a', '#d478a6', '#c86a9a', '#d478a6', '#c86a9a', '#d478a6'][row])
        for x in range((row % 2) * 2, W, 4):
            d.rectangle([x, y + 1, x + 1, y + 3], fill=rnd.choice(['#e83a5a', '#f2b23a', '#3a90e0', '#9a60d8', '#ffffff', '#8a3a6a']))
    d.rectangle([0, 66, W, 76], fill='#7a2a5a')
    for x in range(0, W, 32):
        d.rectangle([x + 4, 68, x + 26, 73], fill='#ffffff' if (x // 32) % 2 else '#f2c25a')
    bands(d, 76, H, ['#e07aa8', '#d874a2', '#d06e9c', '#c86896', '#c06290', '#b85c8a'])
    d.ellipse([60, 88, 196, 140], outline='#fcd8e8')
    d.line([(0, 110), (W, 110)], fill='#f0a0c8')
    ellipse_platform(d, 196, 82, 46, 9, '#fde0ee', '#eca8cc', '#a04a78')
    ellipse_platform(d, 62, 132, 62, 11, '#fde0ee', '#eca8cc', '#a04a78')
    return im


# ───────── 시설·모드 배경 (팰리스·랭크·보스 러시·오늘의 도전) ─────────
def palace():
    """배틀팰리스: 정원 속 사당 — 비취색 벽·격자 창호·처마 등롱, 비취 돌바닥과 가운데 참배길"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 76, ['#0e2420', '#122c26', '#16342c', '#1a3c32', '#1e4438', '#224c3e'])
    # 격자 창호 (안쪽에서 은은히 빛나는 종이)
    for wx in range(12, W, 64):
        d.rectangle([wx, 14, wx + 40, 58], fill='#3a2a1c')
        d.rectangle([wx + 2, 16, wx + 38, 56], fill='#cfe8c8')
        for i, c in enumerate(['#b8dcb0', '#c4e2bc', '#cfe8c8']):
            d.rectangle([wx + 2, 16 + i * 2, wx + 38, 17 + i * 2], fill=c)
        for gx in range(wx + 2, wx + 39, 6):
            d.line([(gx, 16), (gx, 56)], fill='#5a3e26')
        for gy in range(16, 57, 8):
            d.line([(wx + 2, gy), (wx + 38, gy)], fill='#5a3e26')
        d.rectangle([wx + 19, 16, wx + 21, 56], fill='#3a2a1c')
    # 붉은 옻칠 기둥
    for px in range(4, W, 64):
        d.rectangle([px - 4, 0, px + 3, 76], fill='#8a2a20')
        d.rectangle([px - 4, 0, px - 3, 76], fill='#b84a34')
        d.rectangle([px + 2, 0, px + 3, 76], fill='#5a1810')
        d.rectangle([px - 6, 70, px + 5, 76], fill='#2a1c12')
    # 처마: 기와 줄 + 서까래 끝
    d.rectangle([0, 0, W, 9], fill='#1a3a30')
    for x in range(0, W, 8):
        d.rectangle([x, 0, x + 5, 7], fill='#2e6a54'); d.rectangle([x, 0, x + 5, 1], fill='#5aa888')
    d.rectangle([0, 9, W, 11], fill='#3a2a1c')
    for x in range(2, W, 6):
        d.rectangle([x, 9, x + 2, 11], fill='#d8b050')
    # 처마 등롱
    for lx in range(36, W, 64):
        d.line([(lx, 11), (lx, 17)], fill='#2a1c12')
        d.rectangle([lx - 4, 17, lx + 4, 18], fill='#d8b050')
        d.ellipse([lx - 6, 18, lx + 6, 32], fill='#d84a2a')
        d.ellipse([lx - 4, 20, lx + 4, 30], fill='#f08a3a')
        d.rectangle([lx - 1, 20, lx + 1, 30], fill='#ffd070')
        for yy in (22, 25, 28):
            d.line([(lx - 5, yy), (lx + 5, yy)], fill='#a8301c')
        d.rectangle([lx - 4, 32, lx + 4, 33], fill='#d8b050')
        d.line([(lx, 34), (lx, 38)], fill='#d8b050')
    # 난간과 정원 수풀
    d.rectangle([0, 60, W, 76], fill='#1a2c1e')
    rnd = random.Random(31)
    for x in range(-4, W, 10):
        h = 4 + rnd.randint(0, 5)
        d.ellipse([x, 66 - h, x + 14, 72], fill='#2a5a36')
        d.ellipse([x + 3, 66 - h, x + 9, 68 - h + 3], fill='#3e7a48')
    d.rectangle([0, 64, W, 65], fill='#6a2018')
    for x in range(0, W, 12):
        d.rectangle([x, 64, x + 1, 74], fill='#6a2018')
    d.rectangle([0, 73, W, 75], fill='#8a2a20')
    # 비취 돌바닥 + 이음매, 가운데 참배길
    bands(d, 76, H, ['#6aa888', '#62a080', '#5a9878', '#529070', '#4a8868', '#428060'])
    for y in range(80, H, 8):
        d.line([(0, y), (W, y)], fill='#3a7056')
        off = (y // 8 % 2) * 12
        for x in range(off, W, 24):
            d.line([(x, y), (x, y + 7)], fill='#3a7056')
    for y in range(76, H, 2):
        k = (y - 76) / (H - 76)
        hw = int(14 + 26 * k)
        c = '#d8ccb0' if (y // 6) % 2 else '#cfc2a4'
        d.line([(W // 2 - hw, y), (W // 2 + hw, y)], fill=c)
    for y in range(80, H, 5):
        for x in range((y * 7) % 13, W, 13):
            d.point((x, y), fill='#8ac8a4')
    ellipse_platform(d, 196, 82, 46, 9, '#b8e0c8', '#78b494', '#2e6a50')
    ellipse_platform(d, 62, 132, 62, 11, '#b8e0c8', '#78b494', '#2e6a50')
    return im


def rank():
    """랭크 매치: e스포츠 경기장 — 대형 전광판·좌우 화면·네온 LED 띠, 네온 격자 바닥"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 76, ['#06080e', '#080c16', '#0a101c', '#0c1424', '#0e182c', '#101c34'])
    # 천장 트러스와 조명
    d.rectangle([0, 0, W, 5], fill='#1a2030')
    for x in range(0, W, 8):
        d.line([(x, 0), (x + 4, 5)], fill='#2c3448'); d.line([(x + 8, 0), (x + 4, 5)], fill='#2c3448')
    for x in range(12, W, 24):
        d.rectangle([x, 5, x + 4, 7], fill='#e8f4ff')
    # 관중 (어두운 실루엣 + 응원봉)
    rnd = random.Random(41)
    for row in range(3):
        y = 50 + row * 4
        d.rectangle([0, y, W, y + 3], fill=['#121a2a', '#161f32', '#1a243a'][row])
        for x in range((row % 2) * 3, W, 6):
            d.rectangle([x, y, x + 2, y + 1], fill='#0a0e18')
            if rnd.random() < 0.18:
                d.point((x + 1, y - 1), fill=rnd.choice(['#30f0ff', '#ff3ad0', '#f8f060']))
    # 가운데 대형 전광판
    d.rectangle([84, 10, 172, 46], fill='#1c2434')
    d.rectangle([86, 12, 170, 44], fill='#0a1838')
    for y in range(12, 45, 2):
        d.line([(86, y), (170, y)], fill='#0c1e44')
    d.rectangle([90, 16, 124, 26], fill='#1e9ad8'); d.rectangle([90, 16, 124, 17], fill='#7ad8ff')
    d.rectangle([132, 16, 166, 26], fill='#d8306a'); d.rectangle([132, 16, 166, 17], fill='#ff8ab0')
    d.polygon([(124, 16), (132, 16), (132, 26), (124, 26)], fill='#f8f060')
    for i in range(6):  # 점수 막대
        d.rectangle([92 + i * 5, 32, 95 + i * 5, 40], fill='#30f0ff' if i < 4 else '#18405a')
        d.rectangle([161 - i * 5, 32, 164 - i * 5, 40], fill='#ff3ad0' if i < 3 else '#5a1840')
    d.rectangle([122, 30, 134, 42], fill='#f8f060'); d.rectangle([124, 32, 132, 40], fill='#0a1838')
    d.rectangle([127, 33, 129, 39], fill='#f8f060')
    d.rectangle([126, 46, 130, 50], fill='#2a3244')
    # 좌우 세로 화면
    for sx, c, hi in [(14, '#1e9ad8', '#7ad8ff'), (214, '#d8306a', '#ff8ab0')]:
        d.rectangle([sx, 14, sx + 28, 42], fill='#1c2434')
        d.rectangle([sx + 2, 16, sx + 26, 40], fill='#0a1430')
        for k in range(4):
            d.rectangle([sx + 5, 19 + k * 5, sx + 5 + 16 - k * 3, 21 + k * 5], fill=c if k else hi)
    # 네온 LED 띠
    d.rectangle([0, 62, W, 76], fill='#0a0c14')
    for x in range(0, W, 2):
        t = (x // 16) % 3
        d.point((x, 64), fill=['#30f0ff', '#ff3ad0', '#f8f060'][t])
    for x in range(0, W, 32):
        d.rectangle([x + 2, 67, x + 29, 72], fill='#102a48' if (x // 32) % 2 else '#3a1240')
        d.rectangle([x + 4, 69, x + 4 + 6 + (x * 3) % 16, 70], fill='#30f0ff' if (x // 32) % 2 else '#ff3ad0')
    d.line([(0, 75), (W, 75)], fill='#30f0ff')
    # 바닥: 짙은 남색 + 네온 원근 격자
    bands(d, 76, H, ['#141a34', '#12182e', '#101628', '#0e1424', '#0c1220', '#0a101c'])
    for y in [78, 81, 85, 90, 96, 103, 111, 120, 130, 141]:
        d.line([(0, y), (W, y)], fill='#1a4a78')
    for i in range(-12, 14):
        d.line([(W // 2 + i * 8, 76), (W // 2 + i * 28, H)], fill='#1a4a78')
    # 가운데 육각 로고
    cx, cy = 128, 108
    hexp = [(cx - 30, cy), (cx - 16, cy - 10), (cx + 16, cy - 10), (cx + 30, cy), (cx + 16, cy + 10), (cx - 16, cy + 10)]
    d.polygon(hexp, outline='#30f0ff')
    d.polygon([(x + (2 if x < cx else -2), y) for x, y in [(cx - 22, cy), (cx - 12, cy - 6), (cx + 12, cy - 6), (cx + 22, cy), (cx + 12, cy + 6), (cx - 12, cy + 6)]], outline='#ff3ad0')
    ellipse_platform(d, 196, 82, 46, 9, '#3a4a78', '#30c0e8', '#103050')
    ellipse_platform(d, 62, 132, 62, 11, '#3a4a78', '#30c0e8', '#103050')
    return im


def rush():
    """보스 러시: 어둠의 대전당 — 붉은 문장 깃발·화톳불·가시 기둥, 붉게 갈라진 보라 석판 바닥"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 76, ['#0a0610', '#100818', '#160a20', '#1c0c28', '#220e30', '#281038'])
    # 벽돌 결
    for y in range(8, 70, 8):
        d.line([(0, y), (W, y)], fill='#1a0a22')
        for x in range((y // 8 % 2) * 10, W, 20):
            d.line([(x, y), (x, y + 7)], fill='#1a0a22')
    # 가운데 큰 문장 깃발
    d.polygon([(100, 4), (156, 4), (156, 52), (128, 64), (100, 52)], fill='#5a0a14')
    d.polygon([(102, 6), (154, 6), (154, 51), (128, 62), (102, 51)], fill='#8a1020')
    d.rectangle([98, 2, 158, 5], fill='#3a2a3a'); d.rectangle([98, 2, 158, 2], fill='#8a7a90')
    # 문장: 뿔 달린 눈
    d.polygon([(112, 18), (118, 26), (114, 26)], fill='#1a0408'); d.polygon([(144, 18), (138, 26), (142, 26)], fill='#1a0408')
    d.ellipse([110, 24, 146, 44], fill='#1a0408')
    d.ellipse([114, 27, 142, 41], fill='#e02a2a')
    d.ellipse([122, 28, 134, 40], fill='#ffb030')
    d.rectangle([127, 28, 129, 40], fill='#1a0408')
    d.polygon([(128, 46), (122, 54), (134, 54)], fill='#1a0408')
    # 옆 깃발 (보라)
    for bx in (26, 206):
        d.polygon([(bx, 6), (bx + 24, 6), (bx + 24, 44), (bx + 12, 38), (bx, 44)], fill='#3a1450')
        d.polygon([(bx + 2, 8), (bx + 22, 8), (bx + 22, 41), (bx + 12, 36), (bx + 2, 41)], fill='#5a1e7a')
        d.polygon([(bx + 12, 14), (bx + 18, 24), (bx + 12, 32), (bx + 6, 24)], fill='#c03050')
        d.rectangle([bx - 2, 4, bx + 26, 6], fill='#3a2a3a')
    # 가시 기둥
    for px in (70, 186):
        d.rectangle([px - 6, 0, px + 6, 76], fill='#1e1426')
        d.rectangle([px - 6, 0, px - 5, 76], fill='#4a3458')
        d.rectangle([px + 5, 0, px + 6, 76], fill='#0c0810')
        for yy in range(10, 70, 14):
            d.polygon([(px - 6, yy), (px - 12, yy + 3), (px - 6, yy + 6)], fill='#3a2a46')
            d.polygon([(px + 6, yy), (px + 12, yy + 3), (px + 6, yy + 6)], fill='#3a2a46')
        d.rectangle([px - 4, 30, px + 4, 32], fill='#c02030')
    # 화톳불
    for fx in (10, 88, 168, 246):
        d.rectangle([fx - 5, 56, fx + 5, 60], fill='#3a2a3a'); d.rectangle([fx - 2, 60, fx + 2, 72], fill='#2a1e2e')
        d.polygon([(fx - 5, 56), (fx - 3, 46), (fx, 50), (fx + 2, 42), (fx + 5, 56)], fill='#e0401a')
        d.polygon([(fx - 3, 56), (fx - 1, 49), (fx + 1, 52), (fx + 2, 47), (fx + 3, 56)], fill='#ffa030')
        d.rectangle([fx - 1, 53, fx + 1, 56], fill='#fff0a0')
    rnd = random.Random(51)
    for _ in range(28):  # 불티
        d.point((rnd.randint(0, W - 1), rnd.randint(4, 60)), fill=rnd.choice(['#ff6a30', '#c02a40', '#ffb040']))
    d.rectangle([0, 72, W, 76], fill='#140a1a'); d.line([(0, 72), (W, 72)], fill='#6a1a2a')
    # 바닥: 보라 석판 + 붉은 균열 + 마법진
    bands(d, 76, H, ['#2a1a34', '#26162e', '#22142a', '#1e1226', '#1a1022', '#160e1e'])
    for y in range(80, H, 10):
        d.line([(0, y), (W, y)], fill='#120a18')
        for x in range((y // 10 % 2) * 16, W, 32):
            d.line([(x, y), (x, y + 9)], fill='#120a18')
    for _ in range(9):
        x, y = rnd.randint(0, W - 20), rnd.randint(84, H - 4)
        pts = [(x, y)]
        for k in range(4):
            x += rnd.randint(3, 7); y += rnd.randint(-2, 2); pts.append((x, y))
        d.line(pts, fill='#a01828')
    d.ellipse([70, 92, 186, 130], outline='#8a1830')
    d.ellipse([84, 97, 172, 125], outline='#5a1450')
    for k in range(12):  # 룬 눈금
        a = k * math.pi / 6
        d.line([(128 + 50 * math.cos(a), 111 + 16 * math.sin(a)), (128 + 56 * math.cos(a), 111 + 18 * math.sin(a))], fill='#a01828')
    d.polygon([(128, 100), (160, 111), (128, 122), (96, 111)], outline='#7a1430')  # 마름모 문양
    d.polygon([(128, 105), (144, 111), (128, 117), (112, 111)], fill='#3a0e22', outline='#a01828')
    ellipse_platform(d, 196, 82, 46, 9, '#4a3058', '#7a2038', '#1a0a14')
    ellipse_platform(d, 62, 132, 62, 11, '#4a3058', '#7a2038', '#1a0a14')
    return im


def daily():
    """오늘의 도전: 노을 진 축제 광장 — 삼각 깃발 줄·줄무늬 차양 노점·등불, 따뜻한 벽돌 광장"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 60, ['#f08a5a', '#f49a5e', '#f6aa62', '#f8ba68', '#f8ca72', '#f8d880'])
    d.ellipse([110, 34, 146, 70], fill='#ffe8a0'); d.ellipse([116, 40, 140, 64], fill='#fff6d0')
    clouds(d, random.Random(61), 4, 6, 26, c1='#ffd2b0', c2='#f8b090')
    # 먼 지붕 실루엣
    pts = [(0, 76)]
    for x in range(0, W + 16, 16):
        hh = 48 + (x * 7) % 9
        pts += [(x, hh + 4), (x + 8, hh), (x + 16, hh + 4)]
    pts.append((W, 76))
    d.polygon(pts, fill='#b8604a')
    d.rectangle([60, 36, 70, 60], fill='#a8503e'); d.polygon([(58, 36), (65, 28), (72, 36)], fill='#a8503e')  # 시계탑
    d.ellipse([62, 40, 68, 46], fill='#ffe8a0')
    # 노점 차양
    for i, sx in enumerate(range(4, W, 52)):
        c = ['#e83a4a', '#3a8ae0', '#2aa86a', '#9a5ad8', '#f0a020'][i % 5]
        d.rectangle([sx, 54, sx + 40, 72], fill='#7a4a32')
        d.rectangle([sx + 4, 60, sx + 36, 70], fill='#4a2a1c')
        d.rectangle([sx + 6, 64, sx + 34, 66], fill='#f8d880')
        for k in range(5):
            d.rectangle([sx + k * 8, 48, sx + k * 8 + 7, 56], fill=c if k % 2 == 0 else '#fff4e8')
        for k in range(5):
            d.pieslice([sx + k * 8, 53, sx + k * 8 + 7, 60], 0, 180, fill=c if k % 2 == 0 else '#fff4e8')
    # 깃발 줄 (두 줄로 늘어진 삼각기)
    cols = ['#e83a4a', '#f8d040', '#3a8ae0', '#2aa86a', '#ffffff', '#9a5ad8']
    for row, (y0, sag) in enumerate([(6, 10), (20, 8)]):
        prev = None
        for x in range(0, W + 1, 4):
            y = y0 + sag * math.sin(math.pi * (x % 128) / 128)
            if prev: d.line([prev, (x, y)], fill='#5a3a2a')
            prev = (x, y)
        for j, x in enumerate(range(4 + row * 5, W, 10)):
            y = int(y0 + sag * math.sin(math.pi * (x % 128) / 128))
            d.polygon([(x - 3, y), (x + 3, y), (x, y + 6)], fill=cols[(j + row * 2) % len(cols)])
    # 등불
    for lx in range(30, W, 52):
        d.ellipse([lx - 3, 40, lx + 3, 47], fill='#f86a2a'); d.rectangle([lx - 1, 42, lx + 1, 45], fill='#ffe080')
    d.rectangle([0, 72, W, 76], fill='#a8604a'); d.line([(0, 72), (W, 72)], fill='#d88a68')
    # 벽돌 광장 (노을빛)
    bands(d, 76, H, ['#e8b088', '#e2a880', '#dca078', '#d69870', '#d09068', '#ca8860'])
    for y in range(80, H, 6):
        d.line([(0, y), (W, y)], fill='#b87050')
        for x in range((y // 6 % 2) * 6, W, 12):
            d.line([(x, y), (x, y + 5)], fill='#b87050')
    for y in range(78, H, 6):
        for x in range((y * 5) % 12 + 2, W, 24):
            d.rectangle([x, y + 1, x + 2, y + 2], fill='#f0c49c')
    rnd = random.Random(62)
    for _ in range(14):  # 꽃종이
        x, y = rnd.randint(2, W - 3), rnd.randint(84, H - 3)
        d.rectangle([x, y, x + 1, y], fill=rnd.choice(cols))
    ellipse_platform(d, 196, 82, 46, 9, '#f8dcc0', '#e0a078', '#8a4a30')
    ellipse_platform(d, 62, 132, 62, 11, '#f8dcc0', '#e0a078', '#8a4a30')
    return im


def sunset():
    """노을 언덕 (교환소): 주황·분홍 노을, 지는 해, 겹친 언덕의 실루엣, 갈대 풀밭"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 62, ['#3a2a5a', '#5a3a6a', '#8a4a6a', '#c05a5a', '#e07a4a', '#f0a050', '#f8c868'])
    d.ellipse([150, 36, 186, 72], fill='#ffd878'); d.ellipse([156, 42, 180, 66], fill='#fff0b0')
    for y in range(46, 62, 4):   # 해를 가로지르는 구름 줄
        d.rectangle([140 - y % 7, y, 200 + y % 5, y + 1], fill='#e88a5a')
    rnd = random.Random(21)
    for _ in range(4):
        cx, cy = rnd.randint(0, W), rnd.randint(8, 30)
        d.rectangle([cx - 14, cy, cx + 18, cy + 2], fill='#b85a6a'); d.rectangle([cx - 8, cy - 2, cx + 10, cy], fill='#d8786a')
    for i, (col, base, amp, per) in enumerate([('#7a3a5a', 64, 12, 31), ('#5a2a4a', 70, 9, 23)]):
        pts = [(0, H)]
        for x in range(0, W + 8, 8):
            pts.append((x, base - amp * abs(math.sin(x / per + i))))
        pts.append((W, H))
        d.polygon(pts, fill=col)
    bands(d, 76, H, ['#c87a3a', '#b86e34', '#a8622e', '#985828', '#884e24', '#784420'])
    for y in range(80, H, 4):   # 풀 결 (점)
        for x in range((y * 5) % 9, W, 9):
            d.point((x, y), fill='#d88a44')
    rr = random.Random(5)
    for _ in range(26):   # 갈대 무더기: 짧은 줄기 2~3개 + 이삭
        x, y = rr.randint(2, W - 6), rr.randint(84, H - 4)
        for k in range(rr.randint(2, 3)):
            hgt = rr.randint(4, 7)
            d.line([(x + k * 2, y), (x + k * 2, y - hgt)], fill='#6a3a1a')
            d.point((x + k * 2, y - hgt - 1), fill='#f8c070')
    ellipse_platform(d, 196, 82, 46, 9, '#e8b070', '#c88a48', '#8a5428')
    ellipse_platform(d, 62, 132, 62, 11, '#e8b070', '#c88a48', '#8a5428')
    return im


def starry():
    """별빛 호수 (교환소): 깊은 밤하늘의 별·은하수 띠, 달, 별을 비추는 호수, 물가의 풀밭"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 64, ['#0a0e2a', '#10163a', '#161e4a', '#1c2858', '#243266', '#2c3c72'])
    rnd = random.Random(42)
    for x in range(0, W, 2):   # 은하수 (사선 띠, 2px 점)
        yc = 52 - x * 0.18
        for _ in range(2):
            y = int(yc + rnd.randint(-6, 6))
            if 0 <= y < 60: d.point((x, y), fill=rnd.choice(['#5a6aa8', '#7a8ac8', '#4a5a98']))
    for _ in range(60):
        x, y = rnd.randint(0, W - 1), rnd.randint(0, 58)
        d.point((x, y), fill=rnd.choice(['#ffffff', '#c8d8ff', '#fff0b0']))
    for _ in range(6):   # 큰 별 (십자)
        x, y = rnd.randint(4, W - 5), rnd.randint(4, 40)
        d.point((x, y), fill='#ffffff'); d.point((x - 1, y), fill='#a8b8f8'); d.point((x + 1, y), fill='#a8b8f8'); d.point((x, y - 1), fill='#a8b8f8'); d.point((x, y + 1), fill='#a8b8f8')
    d.ellipse([200, 10, 220, 30], fill='#f8f4d8'); d.ellipse([206, 8, 226, 28], fill='#10163a')   # 초승달
    pts = [(0, 64)] + [(x, 60 - 6 * abs(math.sin(x / 29))) for x in range(0, W + 8, 8)] + [(W, 64)]
    d.polygon(pts, fill='#141c3a')   # 먼 산 실루엣
    bands(d, 64, 84, ['#1a2a5a', '#1e3064', '#22366e', '#263c78'])
    for y in range(66, 84, 3):   # 호수에 비친 별·달
        for x in range((y * 11) % 17, W, 17):
            d.line([(x, y), (x + 2, y)], fill='#4a5aa0')
    d.rectangle([210, 66, 216, 67], fill='#c8c8a8'); d.rectangle([208, 70, 218, 71], fill='#a8a890'); d.rectangle([211, 74, 215, 75], fill='#888878')
    bands(d, 84, H, ['#1e4a3a', '#1a4234', '#163a2e', '#123228', '#0e2a22', '#0a221c'])
    for y in range(86, H, 3):
        for x in range((y * 5) % 9, W, 9):
            d.point((x, y), fill='#2e6a4e')
    for _ in range(10):   # 반딧불
        x, y = rnd.randint(4, W - 4), rnd.randint(86, H - 6)
        d.point((x, y), fill='#e8f870')
    ellipse_platform(d, 196, 90, 46, 9, '#3a7a5a', '#2a5a44', '#163a2c')
    ellipse_platform(d, 62, 132, 62, 11, '#3a7a5a', '#2a5a44', '#163a2c')
    return im


def sakura():
    """벚꽃 정원 (교환소): 연분홍 하늘, 벚나무 줄과 흩날리는 꽃잎, 돌길이 지나는 잔디"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 60, ['#8ac8f0', '#a0d0f0', '#b8d8f0', '#d0e0f0', '#e8e0f0', '#f8e0e8'])
    bands(d, 60, 74, ['#6aa858', '#5a9a4c', '#4e8c42'])   # 나무 뒤 낮은 덤불
    rnd = random.Random(31)
    for i in range(7):   # 벚나무: 줄기 + 둥근 꽃 덩어리(3단 분홍)
        x = 10 + i * 38 + rnd.randint(-6, 6)
        d.rectangle([x + 10, 50, x + 13, 74], fill='#6a3a3a')
        for k, (dx, dy, r) in enumerate([(0, 40, 14), (14, 34, 15), (26, 42, 12), (12, 46, 12)]):
            d.ellipse([x + dx - r + 6, dy - r + 4, x + dx + r + 6, dy + r + 4], fill=['#f0a0c0', '#f8b8d0', '#f8c8d8', '#e890b0'][k])
    for _ in range(160):
        x, y = rnd.randint(0, W - 1), rnd.randint(22, 56)
        d.point((x, y), fill=rnd.choice(['#ffe0ec', '#e080a8', '#ffffff']))
    bands(d, 74, H, ['#88c870', '#80c068', '#78b860', '#70b058', '#68a850', '#60a048'])
    for y in range(76, H, 3):
        for x in range((y * 5) % 9, W, 9):
            d.point((x, y), fill='#98d880')
    for _ in range(40):   # 땅에 떨어진 꽃잎
        x, y = rnd.randint(0, W - 3), rnd.randint(78, H - 2)
        d.rectangle([x, y, x + 1, y], fill=rnd.choice(['#f8b8d0', '#ffe0ec']))
    for _ in range(18):   # 흩날리는 꽃잎 (하늘)
        x, y = rnd.randint(0, W - 3), rnd.randint(4, 70)
        d.rectangle([x, y, x + 1, y], fill='#ffd0e0'); d.point((x + 1, y + 1), fill='#e890b0')
    ellipse_platform(d, 196, 82, 46, 9, '#d8c8b0', '#b8a888', '#887858')
    ellipse_platform(d, 62, 132, 62, 11, '#d8c8b0', '#b8a888', '#887858')
    return im


def desert():
    """사막 유적 (교환소): 뜨거운 하늘, 모래 언덕 너머 무너진 기둥과 신전, 물결무늬 모래"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 58, ['#4aa0d8', '#62b0e0', '#7cc0e6', '#98ceea', '#b8dcec', '#d8e6e8'])
    d.ellipse([36, 10, 58, 32], fill='#fff4b0'); d.ellipse([40, 14, 54, 28], fill='#fffce8')
    for i, (col, base, amp, per) in enumerate([('#e0b878', 62, 10, 41), ('#d0a060', 68, 8, 27)]):
        pts = [(0, H)] + [(x, base - amp * abs(math.sin(x / per + i * 2))) for x in range(0, W + 8, 8)] + [(W, H)]
        d.polygon(pts, fill=col)
    # 무너진 신전: 받침·기둥 4개(하나는 부러짐)·지붕 조각
    d.rectangle([150, 54, 222, 58], fill='#c89858'); d.rectangle([148, 58, 224, 62], fill='#a87840')
    for k, hgt in enumerate([26, 26, 14, 26]):
        x = 154 + k * 18
        d.rectangle([x, 54 - hgt, x + 7, 54], fill='#e8d0a0'); d.rectangle([x + 5, 54 - hgt, x + 7, 54], fill='#c8a878')
        d.rectangle([x - 1, 54 - hgt - 2, x + 8, 54 - hgt], fill='#d8b888')
    d.polygon([(150, 26), (186, 16), (196, 26)], fill='#d8b888')
    for x in range(16, 120, 34):   # 반쯤 묻힌 돌
        d.rectangle([x, 60, x + 10, 64], fill='#b88850')
    bands(d, 72, H, ['#f0c880', '#e8c078', '#e0b870', '#d8b068', '#d0a860', '#c8a058'])
    for y in range(76, H, 5):   # 모래 물결
        for x in range((y * 7) % 13, W, 13):
            d.line([(x, y), (x + 4, y)], fill='#c89858')
    ellipse_platform(d, 196, 82, 46, 9, '#f8e0a8', '#e0c080', '#b08848')
    ellipse_platform(d, 62, 132, 62, 11, '#f8e0a8', '#e0c080', '#b08848')
    return im


def aurora():
    """오로라 설원 (교환소): 밤하늘에 초록·보라 오로라 띠, 눈 덮인 침엽수, 빛을 받은 설원"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 66, ['#06101e', '#0a1628', '#0e1e34', '#122640', '#162e4a', '#1a3654'])
    rnd = random.Random(77)
    for _ in range(50):
        d.point((rnd.randint(0, W - 1), rnd.randint(0, 60)), fill=rnd.choice(['#ffffff', '#c8e0ff']))
    for k, (col, y0, amp, per) in enumerate([('#3ae8a0', 18, 8, 23), ('#2ab888', 24, 7, 31), ('#9a6ae8', 12, 6, 19)]):   # 오로라 띠 (세로 2px 결)
        for x in range(0, W, 2):
            yc = int(y0 + amp * math.sin(x / per + k))
            for yy in range(yc, yc + 10 - k * 2, 2):
                if (x // 2 + yy // 2) % 3 != 0: d.rectangle([x, yy, x + 1, yy + 1], fill=col)
    for i, (col, base) in enumerate([('#1e3a54', 62), ('#16304a', 68)]):
        pts = [(0, H)] + [(x, base - 8 * abs(math.sin(x / (21 + i * 9)))) for x in range(0, W + 8, 8)] + [(W, H)]
        d.polygon(pts, fill=col)
    for x in range(-4, W, 13):   # 눈 덮인 침엽수
        h = 14 + (x * 7) % 6
        d.polygon([(x, 76), (x + 6, 76 - h), (x + 12, 76)], fill='#0e2a34')
        d.polygon([(x + 3, 76 - h // 2), (x + 6, 76 - h), (x + 9, 76 - h // 2)], fill='#e8f4ff')
    bands(d, 76, H, ['#c8dcf0', '#bcd4ec', '#b0cce8', '#a4c4e2', '#98bcdc', '#8cb4d6'])
    for y in range(78, H, 3):
        for x in range((y * 5) % 9, W, 9):
            d.point((x, y), fill='#a8f0d0' if (x + y) % 4 == 0 else '#e8f4ff')
    ellipse_platform(d, 196, 82, 46, 9, '#f0f8ff', '#c8dcf0', '#88a8c8')
    ellipse_platform(d, 62, 132, 62, 11, '#f0f8ff', '#c8dcf0', '#88a8c8')
    return im


def deepsea():
    """해저 신전 (교환소): 위에서 내리쬐는 빛줄기, 깊어지는 푸른 물, 무너진 신전 기둥, 산호·해초, 모래 바닥"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 76, ['#2a8ac0', '#2278b0', '#1c68a0', '#185a90', '#144c80', '#104070', '#0c3462'])
    for k, x0 in enumerate([30, 92, 150, 214]):   # 빛줄기 (사선, 2px 계단)
        for y in range(0, 70, 2):
            x = x0 + y // 3
            d.rectangle([x, y, x + 5 - y // 20, y + 1], fill=['#3a9ad0', '#3496c8', '#3a9ad0', '#2e8ac0'][k])
    rnd = random.Random(63)
    for _ in range(30):   # 떠다니는 알갱이
        d.point((rnd.randint(0, W - 1), rnd.randint(0, 70)), fill=rnd.choice(['#6ac0e8', '#4aa8d8']))
    # 신전: 계단 받침 + 기둥 5개(둘은 부러짐) + 지붕 조각
    d.rectangle([132, 66, 236, 70], fill='#4a7a9a'); d.rectangle([128, 70, 240, 74], fill='#3a6a8a')
    for k, hgt in enumerate([34, 20, 34, 34, 12]):
        x = 138 + k * 20
        d.rectangle([x, 66 - hgt, x + 8, 66], fill='#7aa8c0'); d.rectangle([x + 6, 66 - hgt, x + 8, 66], fill='#5a88a0')
        d.rectangle([x - 1, 66 - hgt - 2, x + 9, 66 - hgt], fill='#8ab8d0')
    d.rectangle([136, 28, 214, 32], fill='#8ab8d0'); d.rectangle([136, 32, 214, 34], fill='#5a88a0')
    for x in range(6, 120, 22):   # 해초 (흔들리는 줄기 모양)
        for y in range(48, 76, 2):
            dx = 1 if (y // 4) % 2 else 0
            d.rectangle([x + dx, y, x + dx + 1, y + 1], fill='#2a8a5a' if y % 4 else '#3aa86a')
    bands(d, 76, H, ['#d8c890', '#d0c088', '#c8b880', '#c0b078', '#b8a870', '#b0a068'])
    for y in range(78, H, 4):
        for x in range((y * 7) % 11, W, 11):
            d.line([(x, y), (x + 3, y)], fill='#c0b070')
    for x, col in [(20, '#e86a7a'), (98, '#f0a050'), (120, '#c86ae0'), (240, '#e86a7a')]:   # 산호
        d.rectangle([x, 70, x + 2, 80], fill=col); d.rectangle([x - 4, 72, x - 2, 76], fill=col); d.rectangle([x + 4, 68, x + 6, 74], fill=col)
        d.rectangle([x - 4, 76, x + 2, 77], fill=col); d.rectangle([x + 2, 74, x + 6, 75], fill=col)
    for _ in range(16):   # 조개·돌
        x, y = rnd.randint(0, W - 4), rnd.randint(84, H - 3)
        d.rectangle([x, y, x + 2, y + 1], fill=rnd.choice(['#f0e8d0', '#a89868']))
    ellipse_platform(d, 196, 86, 46, 9, '#a8d0e0', '#78a8c0', '#4a7890')
    ellipse_platform(d, 62, 132, 62, 11, '#a8d0e0', '#78a8c0', '#4a7890')
    return im


def skypillar():
    """구름 위 탑 (교환소): 맑고 높은 하늘, 구름 바다 위로 솟은 먼 탑, 구름 위에 떠 있는 돌 발판"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 80, ['#2a6ad8', '#3a7ae0', '#4a8ae6', '#5c9aec', '#70aaf0', '#88baf4', '#a0caf6', '#bcdaf8'])
    d.ellipse([28, 10, 48, 30], fill='#fff8d0'); d.ellipse([32, 14, 44, 26], fill='#ffffff')
    # 먼 탑: 층마다 넓어지는 원통 + 꼭대기 첨탑
    for k, (y, w) in enumerate([(10, 8), (18, 10), (28, 12), (40, 14), (54, 16), (68, 18)]):
        x = 176 - w // 2
        d.rectangle([x, y, x + w, y + 12], fill='#8a7ab0'); d.rectangle([x + w - 3, y, x + w, y + 12], fill='#6a5a90')
        d.rectangle([x - 1, y, x + w + 1, y + 1], fill='#b0a0d0')
        if k % 2: d.rectangle([x + w // 2 - 1, y + 4, x + w // 2 + 1, y + 7], fill='#ffe080')
    d.polygon([(172, 10), (176, 0), (180, 10)], fill='#b0a0d0')
    rnd = random.Random(88)
    def cloud_row(y0, c_top, c_mid, c_low, step, seed):
        r = random.Random(seed)
        x = -10
        while x < W + 10:
            w = r.randint(18, 34); h = r.randint(6, 10)
            d.ellipse([x, y0 - h, x + w, y0 + h], fill=c_mid)
            d.ellipse([x + 3, y0 - h, x + w - 6, y0], fill=c_top)
            x += step + r.randint(-4, 6)
        d.rectangle([0, y0, W, y0 + 6], fill=c_mid); d.rectangle([0, y0 + 6, W, y0 + 10], fill=c_low)
    cloud_row(70, '#ffffff', '#e8f0fc', '#d0dcf4', 22, 1)
    bands(d, 80, H, ['#e8f0fc', '#e0eaf8', '#d8e4f6', '#d0dcf4', '#c8d6f0', '#c0d0ee'])
    for y in range(82, H, 4):   # 구름 결
        for x in range((y * 7) % 15, W, 15):
            d.line([(x, y), (x + 5, y)], fill='#ffffff' if y % 8 else '#b8c8e8')
    for _ in range(5):   # 작은 새
        x, y = rnd.randint(60, 150), rnd.randint(14, 44)
        d.point((x, y), fill='#3a4a7a'); d.point((x - 1, y - 1), fill='#3a4a7a'); d.point((x + 1, y - 1), fill='#3a4a7a')
    ellipse_platform(d, 196, 86, 46, 9, '#c8c0d8', '#a098b8', '#706890')
    ellipse_platform(d, 62, 132, 62, 11, '#c8c0d8', '#a098b8', '#706890')
    return im


def neon():
    """네온 시티 (교환소): 밤 도시의 빌딩 숲과 불 켜진 창, 네온 간판, 비에 젖어 빛을 비추는 광장"""
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 74, ['#120a2a', '#1a0e36', '#220f42', '#2a124c', '#341456', '#40185e', '#4e1c66'])
    rnd = random.Random(19)
    x = -4
    while x < W:   # 빌딩 (높이·폭 제각각) + 창
        w = rnd.randint(16, 30); top = rnd.randint(14, 46)
        col = rnd.choice(['#1a1430', '#221a3c', '#16122a'])
        d.rectangle([x, top, x + w, 76], fill=col); d.rectangle([x, top, x + w, top + 1], fill='#3a2e5a')
        for wy in range(top + 4, 72, 5):
            for wx in range(x + 3, x + w - 2, 4):
                if rnd.random() < 0.45: d.rectangle([wx, wy, wx + 1, wy + 2], fill=rnd.choice(['#ffe08a', '#8ae0ff', '#ffb0e0']))
        x += w + rnd.randint(0, 4)
    for x0, y0, w, col in [(24, 40, 22, '#ff4ab8'), (110, 30, 26, '#4af0ff'), (200, 44, 20, '#ffe04a')]:   # 네온 간판 (테두리 + 글자 줄)
        d.rectangle([x0, y0, x0 + w, y0 + 10], fill='#0e0a1e'); d.rectangle([x0, y0, x0 + w, y0 + 10], outline=col)
        for k in range(x0 + 3, x0 + w - 2, 4): d.rectangle([k, y0 + 4, k + 1, y0 + 6], fill=col)
    bands(d, 76, H, ['#2a2440', '#26203a', '#221c34', '#1e182e', '#1a1428', '#161022'])
    for y in range(80, H, 6):   # 젖은 바닥에 비친 불빛 (세로 짧은 줄)
        for x in range((y * 9) % 23, W, 23):
            d.line([(x, y), (x, y + 2)], fill=rnd.choice(['#ff4ab8', '#4af0ff', '#ffe04a', '#5a4a8a']))
    for y in range(78, H, 3):
        for x in range((y * 5) % 13, W, 13):
            d.point((x, y), fill='#3a3256')
    ellipse_platform(d, 196, 86, 46, 9, '#5a5080', '#40386a', '#241e40')
    ellipse_platform(d, 62, 132, 62, 11, '#5a5080', '#40386a', '#241e40')
    return im


def extend_top(im, extra, stars=True):
    w, h = im.size
    out = Image.new('RGB', (w, h + extra))
    out.paste(im, (0, extra))
    d = ImageDraw.Draw(out)
    top = im.getpixel((w // 2, 0))
    for y in range(extra):
        k = 0.55 + 0.45 * (y // 6 * 6) / extra  # 6px 단위 계단식 그라데이션
        d.line([(0, y), (w, y)], fill=tuple(int(c * k) for c in top))
    rnd = random.Random(1)
    if stars and sum(top) < 200:  # 어두운 하늘엔 별 (동굴 천장·체육관 벽은 빼고)
        for _ in range(25):
            d.point((rnd.randint(0, w - 1), rnd.randint(0, extra - 1)), fill='#c8d0ff')
    return out


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in [('field', field), ('tower', tower), ('factory', factory), ('pwt', stadium), ('champion', champion),
                     ('cave', cave), ('beach', beach), ('snow', snow), ('volcano', volcano), ('gym', gym),
                     ('palace', palace), ('rank', rank), ('rush', rush), ('daily', daily), ('sunset', sunset), ('starry', starry), ('sakura', sakura), ('desert', desert), ('aurora', aurora), ('deepsea', deepsea), ('skypillar', skypillar), ('neon', neon)]:
        im = fn()
        if name != 'title':
            im = extend_top(im, 48, stars=name not in ('cave', 'gym', 'palace', 'rush'))  # 4:3 (256x192) — 세로 화면용으로 위쪽 하늘/벽을 늘림
        im.save(os.path.join(OUT, f'arena_{name}.png'), optimize=True)
        print('arena_' + name)
    # 타이틀·메뉴 배경(arena_title*) 은 scripts/gen-title.py 가 만든다
    for name, fn in [('tower_day', tower_day), ('factory_day', factory_day), ('pwt_day', stadium_day)]:
        extend_top(fn(), 48, stars=False).save(os.path.join(OUT, f'arena_{name}.png'), optimize=True)
        print('arena_' + name)
