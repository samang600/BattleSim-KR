#!/usr/bin/env python3
"""도트 계단식 둥근 테두리: 9분할 테두리 그림(SVG)과 같은 모양의 clip-path 를 만들어 CSS 로 출력.
테두리 = 진한 외곽선 1픽셀 + 안쪽 테두리 1픽셀, 모서리는 픽셀 계단(반지름 r)."""
import sys, urllib.parse

def profile(r):
    # 위에서부터 줄마다 왼쪽에서 비우는 픽셀 수 (원에 가까운 계단)
    return {6: [6, 4, 3, 2, 1, 1], 4: [4, 2, 1, 1], 3: [3, 1, 1], 2: [2, 1], 1: [1]}[r]

def ring_svg(r, outer, inner, K):
    n = 2 * K + 1
    prof = profile(r)
    def inside(x, y):
        if not (0 <= x < n and 0 <= y < n): return False
        dx = min(x, n - 1 - x); dy = min(y, n - 1 - y)
        return not (dy < len(prof) and dx < prof[dy])
    cells = [(x, y) for y in range(n) for x in range(n) if inside(x, y)]
    # 외곽선: 바깥과 맞닿은 칸 (상하좌우) / 안쪽 테두리: 외곽선과 맞닿은 칸 (대각선 포함)
    outl = {(x, y) for x, y in cells if any(not inside(a, b) for a, b in [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])}
    inn = {(x, y) for x, y in cells if (x, y) not in outl and any((a, b) in outl for a, b in [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])}
    rects = [f'<rect x="{x}" y="{y}" width="1" height="1" fill="{outer}"/>' for x, y in sorted(outl)]
    rects += [f'<rect x="{x}" y="{y}" width="1" height="1" fill="{inner}"/>' for x, y in sorted(inn)]
    svg = f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {n} {n}' width='{n}' height='{n}' shape-rendering='crispEdges'>{''.join(rects)}</svg>".replace('"', "'")
    return 'url("data:image/svg+xml,' + urllib.parse.quote(svg, safe=":/=' ,<>-.") + '")'

def clip(r, P):
    """바깥 모양(외곽선의 바깥 가장자리)을 따라가는 다각형"""
    prof = profile(r); L = len(prof)
    # 왼쪽 위 모서리 점들 (왼쪽 변에서 시작해 위 변까지, 시계 방향)
    tl = [(0, L)]
    for k in reversed(range(L)):
        tl += [(prof[k], k + 1), (prof[k], k)]
    def pt(dx, dy, right, bottom):
        X = f'calc(100% - {dx * P}px)' if right else f'{dx * P}px'
        Y = f'calc(100% - {dy * P}px)' if bottom else f'{dy * P}px'
        return f'{X} {Y}'
    out = [pt(dx, dy, False, False) for dx, dy in tl]                    # 왼쪽 위
    out += [pt(dx, dy, True, False) for dx, dy in reversed(tl)]           # 오른쪽 위
    out += [pt(dx, dy, True, True) for dx, dy in tl]                      # 오른쪽 아래
    out += [pt(dx, dy, False, True) for dx, dy in reversed(tl)]           # 왼쪽 아래
    return 'polygon(' + ', '.join(out) + ')'

def clip_side(r, P, round_right):
    """한쪽 변만 계단 모서리, 반대쪽(화면 가장자리에 붙는 쪽)은 직각으로 열린 다각형"""
    prof = profile(r); L = len(prof)
    tl = [(0, L)]
    for k in reversed(range(L)):
        tl += [(prof[k], k + 1), (prof[k], k)]
    def pt(dx, dy, right, bottom):
        X = f'calc(100% - {dx * P}px)' if right else f'{dx * P}px'
        Y = f'calc(100% - {dy * P}px)' if bottom else f'{dy * P}px'
        return f'{X} {Y}'
    if round_right:
        out = ['0px 0px'] + [pt(dx, dy, True, False) for dx, dy in reversed(tl)] + [pt(dx, dy, True, True) for dx, dy in tl] + ['0px 100%']
    else:
        out = [pt(dx, dy, False, False) for dx, dy in tl] + ['100% 0px', '100% 100%'] + [pt(dx, dy, False, True) for dx, dy in reversed(tl)]
    return 'polygon(' + ', '.join(out) + ')'

P = 2  # 도트 한 칸 = 2px
css = []
css.append('/* ═════ 도트 계단식 둥근 테두리 (scripts/pixring.py 로 생성): 진한 외곽선 1칸 + 흰 테두리 1칸, 모서리는 픽셀 계단 ═════ */')
rings = {
    'w': ('#0a0f18', '#ffffff'), 'f': ('#3a0804', '#ffffff'), 'sw': ('#0a0f18', '#d8ecdc'), 'sb': ('#0a0f18', '#d8e8fc'),
    't': ('#0a0f18', '#e8e8f0'), 'ty': ('#3a4a08', '#f8ff70'), 'tb': ('#08203a', '#f8ff70'), 'i': ('#0a0d12', '#f4f6fa'),
}
K4, K2 = 7, 3
css.append(':root {')
for k, (o, i) in rings.items():
    css.append(f'\t--ring-{k}: {ring_svg(6, o, i, K4)};')
css.append(f'\t--ring-s: {ring_svg(2, "#000000", "#9aa6bc", K2)};')
css.append(f'\t--ring-i2: {ring_svg(2, "#0a0d12", "#f4f6fa", K2)};')
css.append(f'\t--ring-i4: {ring_svg(4, "#0a0d12", "#f4f6fa", 5)};')  # HP 상자: 반지름 4칸
# 메뉴 창·버튼용 (반지름 4칸): 창틀 테마별 패널 테두리, 선택 강조, 빨간·회색 버튼, 작은 버튼(반지름 2칸)
for k, (o, i) in {'p-stone': ('#0d1830', '#eef4ff'), 'p-silver': ('#2a0a0e', '#fff1f1'), 'p-dark': ('#0a0b0d', '#d8dce4'),
                  'hi': ('#0d1830', '#ffd84a'), 'red': ('#3a0a04', '#ffffff'), 'grey': ('#121a2a', '#f4f6fa'),
                  # 시나리오: 하늘색 창·분홍(이야기)·초록(풀숲)
                  'sky': ('#0a0f18', '#7fe0ff'), 'pink': ('#3a0a1e', '#ff9ac0'), 'leaf': ('#0a2a12', '#a8e890')}.items():
    css.append(f'\t--ring4-{k}: {ring_svg(4, o, i, 5)};')
css.append(f'\t--ring2-red: {ring_svg(2, "#3a0a04", "#ffffff", K2)};')
css.append(f'\t--ring2-hi: {ring_svg(2, "#0d1830", "#ffd84a", K2)};')
css.append(f'\t--ring2-input: {ring_svg(2, "#0d1830", "#8aa0c8", K2)};')
css.append(f'\t--ring2-grey: {ring_svg(2, "#121a2a", "#f4f6fa", K2)};')
css.append(f'\t--ring2-sky: {ring_svg(2, "#0a0f18", "#7fe0ff", K2)};')
css.append(f'\t--ring-hp: {ring_svg(1, "#0a0d12", "#f4f6fa", 2)};')  # HP 바 틀: 모서리 한 칸 깎음
css.append(f'\t--clip4: {clip(6, P)};')
css.append(f'\t--clip2: {clip(2, P)};')
css.append("\t--clip1: polygon(2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px), 0 2px);")  # 작은 표: 모서리 한 칸
css.append(f'\t--clip3: {clip(4, P)};')
css.append(f'\t--clip3r: {clip_side(4, P, True)};')   # 오른쪽만 둥근 (왼쪽 가장자리에 붙는 띠)
css.append(f'\t--clip3l: {clip_side(4, P, False)};')  # 왼쪽만 둥근
css.append('}')
print('\n'.join(css))
