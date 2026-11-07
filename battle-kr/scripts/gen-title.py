"""타이틀 화면 그림 (직접 그린 도트):
 - 배경 arena_title(_wide)(_day).png: 하늘에 솟은 배틀타워 정면(벽돌 탑·창·정문만 있는 미니멀), 낮·밤 × 세로 256x288·가로 512x288
 - 로고 title_logo.png: 갈무리 12px 글자를 2배로 키운 도트 글자 + 남색 판·붉은 탭(최소 장식)
사용법: pip install fonttools brotli && python3 battle-kr/scripts/gen-title.py
"""
import io, os, random, sys
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'ui-assets')

def _font():
    from fontTools.ttLib import TTFont   # woff2 → ttf (메모리)
    f = TTFont(os.path.join(HERE, '..', 'src', 'fonts', 'Galmuri11.woff2')); f.flavor = None
    b = io.BytesIO(); f.save(b); b.seek(0); return b.getvalue()
FONT_BYTES = None

# ───── 배경 ─────

PAL = {
 'day': dict(sky=['#4a9ae8', '#5ca6ec', '#70b2f0', '#86c0f4'], cloud='#ffffff', cloud2='#d4e8fc',
   brick=['#c86a52', '#bc604a', '#d27a60', '#b45a44'], mortar='#e6cdb4', brickhi='#e09078', brickdk='#8a3e2e',
   stone='#e8e0d0', stone2='#c4b8a4', stone3='#9a8e7c', glass='#7cc4f2', glass2='#5aa4e0', glasshi='#e4f6ff', frame='#f4f0e6', frame2='#b8ae9c',
   curtain='#e85a5a', plant='#4aa040', plant2='#2e7a2a', pot='#b0603a', door='#3a4a8a', door2='#24305e', doorhi='#6a7ac0', gold='#f0c040',
   step='#d8d4cc', step2='#a8a296', awning='#e04a3a', awning2='#ffffff', lamp='#fff2b0', pipe='#7a8494', pipe2='#5a6272', star=None, lit=0, K='#2a1c1c'),
 'night': dict(sky=['#0a0c24', '#0e122e', '#131838', '#181e42'], cloud='#3a4274', cloud2='#2c3260',
   brick=['#6a3a44', '#5e323c', '#764450', '#562c36'], mortar='#3a2c3c', brickhi='#86505a', brickdk='#3a1c26',
   stone='#7a7690', stone2='#5c5872', stone3='#423e58', glass='#1e2448', glass2='#161a38', glasshi='#ffe08a', frame='#8a86a0', frame2='#5c5872',
   curtain='#a03a4a', plant='#2a5a38', plant2='#1a3c26', pot='#6a3a2a', door='#2a3060', door2='#1a1e40', doorhi='#f0c050', gold='#f0c040',
   step='#6c6a84', step2='#4a4862', awning='#8a2a30', awning2='#c8c4d8', lamp='#ffd860', pipe='#3a3e54', pipe2='#2a2e40', star='#e8ecff', lit=.6, K='#0a0814'),
}



def draw(WW, HH, mode):
    """미니멀 타워: 하늘 + 가운데 높은 벽돌 탑(층층이 좁아지는 꼭대기·첨탑) + 창 격자 + 정문·계단, 아래 먼 건물 실루엣"""
    P = PAL[mode]; rnd = random.Random(2); K = P['K']
    im = Image.new('RGB', (WW, HH)); d = ImageDraw.Draw(im)
    n = len(P['sky'])
    for i, c in enumerate(P['sky']): d.rectangle([0, HH * i // n, WW, HH * (i + 1) // n], fill=c)
    if P['star']:
        for _ in range(WW // 8): d.point((rnd.randrange(WW), rnd.randrange(int(HH * .7))), fill=P['star'])
    # 먼 건물 실루엣 (한 톤)
    far = P['sky'][-1] if mode == 'night' else '#a8c8ec'
    far = '#2a2e58' if mode == 'night' else '#9cc0e8'
    x = 0
    while x < WW:
        w = rnd.randint(14, 30); h = rnd.randint(18, 54)
        d.rectangle([x, HH - h, x + w, HH], fill=far); x += w + rnd.randint(0, 4)
    cx = WW // 2
    hw = 52 if WW < 400 else 60
    def block(x0, x1, y0, y1):
        d.rectangle([x0, y0, x1, y1], fill=P['brick'][0])
        for r, y in enumerate(range(y0 + 6, y1, 6)):
            d.line([(x0, y), (x1, y)], fill=P['brick'][1])
            for xx in range(x0 + (r % 2) * 8, x1, 16): d.line([(xx, y - 5), (xx, y - 1)], fill=P['brick'][1])
        d.rectangle([x1 - (x1 - x0) // 4, y0, x1, y1], fill=P['brick'][3])             # 오른쪽 그늘
        d.rectangle([x0 - 2, y0 - 4, x1 + 2, y0], fill=P['stone'])                     # 처마
        d.rectangle([x0 - 2, y0, x1 + 2, y0 + 1], fill=P['stone2'])
    tiers = [(hw, 70), (hw - 14, 44), (hw - 26, 24)]
    # 첨탑
    d.rectangle([cx - 2, 6, cx + 1, 24], fill=P['stone2']); d.rectangle([cx - 2, 6, cx - 1, 24], fill=P['stone'])
    d.rectangle([cx - 1, 2, cx, 5], fill=P['lamp'])
    for i, (w, y0) in enumerate(reversed(tiers)):
        y1 = tiers[::-1][i - 1][1] if False else None
    block(cx - (hw - 26), cx + (hw - 26), 24, 44)
    block(cx - (hw - 14), cx + (hw - 14), 44, 70)
    block(cx - hw, cx + hw, 70, HH)
    # 창 격자
    def wins(x0, x1, y0, y1, step=14, rowh=20):
        cols = list(range(x0 + 6, x1 - 8, step))
        off = (x1 - x0 - (cols[-1] + 6 - x0) - 6) // 2 if cols else 0
        for y in range(y0, y1, rowh):
            for x in cols:
                x += off
                lit = rnd.random() < P['lit']
                shade = x > x1 - (x1 - x0) // 4 - 4
                d.rectangle([x - 1, y - 1, x + 6, y + 11], fill=P['stone'] if not shade else P['stone2'])
                d.rectangle([x, y, x + 5, y + 10], fill=P['glasshi'] if lit else (P['glass2'] if shade else P['glass']))
                if not lit and not shade: d.rectangle([x + 3, y, x + 5, y + 10], fill=P['glass2'])
    wins(cx - (hw - 26), cx + (hw - 26), 30, 40, rowh=20)
    wins(cx - (hw - 14), cx + (hw - 14), 50, 64, rowh=20)
    wins(cx - hw, cx + hw, 78, HH - 58)
    # 정문 + 계단
    dw = 28; dx0 = cx - dw // 2; dtop = HH - 40
    d.rectangle([dx0 - 4, dtop - 4, dx0 + dw + 4, HH], fill=P['stone']); d.rectangle([dx0 + dw + 1, dtop - 4, dx0 + dw + 4, HH], fill=P['stone2'])
    d.rectangle([dx0, dtop, dx0 + dw, HH], fill=P['door'])
    d.rectangle([dx0, dtop, dx0 + dw, dtop + 8], fill=P['glasshi'] if mode == 'night' else P['glass'])
    d.line([(cx, dtop + 9), (cx, HH)], fill=P['door2'])
    for i in range(3):
        y = HH - 9 + i * 3; ext = 6 + i * 6
        d.rectangle([dx0 - ext, y, dx0 + dw + ext, y + 3], fill=P['step']); d.line([(dx0 - ext, y + 2), (dx0 + dw + ext, y + 2)], fill=P['step2'])
    return im

# ───── 로고 ─────

K = '#140c1c'

def text_mask(s, size=12, scale=2, bold=1):
    global FONT_BYTES
    FONT_BYTES = FONT_BYTES or _font()
    ft = ImageFont.truetype(io.BytesIO(FONT_BYTES), size)
    im = Image.new('L', (len(s) * size + 8, size + 6)); d = ImageDraw.Draw(im); d.fontmode = '1'
    d.text((2, 1), s, font=ft, fill=255)
    im = im.crop(im.getbbox())
    im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    if bold:
        b = Image.new('L', (im.width + bold, im.height)); b.paste(im, (0, 0)); b2 = Image.new('L', b.size); b2.paste(im, (bold, 0))
        im = ImageChops.lighter(b, b2)
    return im

def dilate(m, r):
    return m.filter(ImageFilter.MaxFilter(r * 2 + 1))

def put_text(base, s, x, y, scale, top, bot, outline=2, shadow=None, size=12):
    m = text_mask(s, size, scale, bold=0)
    pad = outline + 3
    M = Image.new('L', (m.width + pad * 2, m.height + pad * 2)); M.paste(m, (pad, pad))
    O = dilate(M, outline) if outline else M
    layer = Image.new('RGBA', M.size, (0, 0, 0, 0))
    if shadow:
        sh = Image.new('RGBA', M.size, shadow); layer.paste(sh, (0, 2), O)
    layer.paste(Image.new('RGBA', M.size, K), (0, 0), O)
    h = M.height
    fill = Image.new('RGBA', M.size, bot); ImageDraw.Draw(fill).rectangle([0, 0, M.width, pad + m.height * .5], fill=top)
    layer.paste(fill, (0, 0), M)
    # 글자 윗줄 하이라이트
    if scale > 1:
        hl = ImageChops.subtract(M, M.transform(M.size, Image.AFFINE, (1, 0, 0, 0, 1, -1)))
        layer.paste(Image.new('RGBA', M.size, '#ffffff'), (0, 0), hl)
    base.alpha_composite(layer, (x - pad, y - pad))
    return m.width, m.height



def _plate(d, x0, y0, x1, y1, c, hi, lo, st=2):
    """계단 모서리 판: 검은 테두리 + 윗줄 밝게·아랫줄 어둡게"""
    def rr(a, cc):
        d.polygon([(x0 + a + st, y0 + a), (x1 - a - st, y0 + a), (x1 - a, y0 + a + st), (x1 - a, y1 - a - st), (x1 - a - st, y1 - a),
                   (x0 + a + st, y1 - a), (x0 + a, y1 - a - st), (x0 + a, y0 + a + st)], fill=cc)
    rr(0, K); rr(1, lo)
    d.rectangle([x0 + 2 + st // 2, y0 + 2, x1 - 2 - st // 2, y1 - 4], fill=c)
    d.rectangle([x0 + 2, y0 + 2 + st // 2, x1 - 2, y1 - 4 - st // 2], fill=c)
    d.line([(x0 + 2 + st, y0 + 2), (x1 - 2 - st, y0 + 2)], fill=hi)


def logo():
    """로고: 남색 판 위 큰 한글(흰·노랑 두 톤) + 위쪽 붉은 탭의 영문 — 최소한의 장식"""
    big = text_mask('배틀 시뮬레이터', 12, 2, 0); small = text_mask('BATTLE SIMULATOR', 12, 1, 0)
    W = big.width + 24; tabH = small.height + 7; H = tabH + big.height + 20
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    _plate(d, 0, tabH - 2, W - 1, H - 1, '#1e2c64', '#5a74c8', '#0c1436', st=4)
    tw = small.width + 14; tx = (W - tw) // 2
    _plate(d, tx, 0, tx + tw, tabH + 1, '#d23a2c', '#ff7a5a', '#7a1410')
    put_text(im, 'BATTLE SIMULATOR', (W - small.width) // 2, 3, 1, '#ffffff', '#ffffff', outline=0)
    put_text(im, '배틀 시뮬레이터', (W - big.width) // 2, tabH + 7, 2, '#ffffff', '#ffd84a', outline=2, shadow='#000000')
    return im

if __name__ == '__main__':
    for mode, sfx in (('night', ''), ('day', '_day')):
        draw(256, 288, mode).save(os.path.join(OUT, f'arena_title{sfx}.png'), optimize=True)
        draw(512, 288, mode).save(os.path.join(OUT, f'arena_title_wide{sfx}.png'), optimize=True)
    logo().save(os.path.join(OUT, 'title_logo.png'), optimize=True)
    print('arena_title*, title_logo')
