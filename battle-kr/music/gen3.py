#!/usr/bin/env python3
"""3세대(GBA) 분위기의 새 배틀 곡 3곡 — 이 앱용으로 새로 쓴 선율·코드 진행. 칩튠 시퀀서 형식으로 바로 출력.
  g3battle   트레이너 배틀 (D단조 156): i-VI-VII-V 진행, 옥타브 8분 베이스, 반음계 상승 인트로
  g3gym      관장전 (C단조 168): 영웅적인 단조, B 구간 끝에 나폴리 화음(Db)
  g3frontier 배틀 프런티어풍 (F장조 160): 금관 팡파르 느낌의 장조, 믹솔리디안 Bb·C7
  pwthall    PWT 대진표 대기 (Bb장조 132): 경기장 행진풍 (NEW 의 song2 형식)
  g3palace 배틀팰리스 (D도리안 138) · g3factory 배틀팩토리 (E단조 158) · g3rank 랭크 매치 (B단조 170)
  g3rush 보스 러시 (F단조 182) · g3daily 오늘의 도전 (G장조 150) · g3sunset 노을 언덕 (D장조 152) · g3star 별빛 결전 (E단조 168) · g3sakura 벚꽃 정원 (F장조 132) · g3desert 사막 유적 (D단조 160) · g3aurora 오로라 (B단조 176) · g3deepsea 해저 신전 (A단조 144) · g3skypillar 구름 위 탑 (Eb장조 168) · g3neon 네온 시티 (G단조 172) · g3yume 솜사탕 꿈나라 (G장조 136) · g3yami 한밤의 하트 (C단조 148) · g3menhera 분홍 처방전 (A단조 164)
형식: 인트로 → A(8마디) → B(8마디) → A 로 반복 (intro 칸부터)
출력: <앱>/src/gen/chip-gen3.json (chip-tracks.json 과 같은 형식: 16분음표 한 칸에 한 글자, ' ' 쉼, '!' 지속, 그 밖 chr(MIDI+14))
사용: python3 gen3.py [출력 경로]"""
import os, sys, json

PC = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}

def midi(tok):
    """'c#5' / 'bb4' / 'e6' → MIDI"""
    n = PC[tok[0]]; i = 1
    while i < len(tok) and tok[i] in '#b' and not tok[i:].isdigit():
        n += 1 if tok[i] == '#' else -1; i += 1
    return n + 12 * (int(tok[i:]) + 1)

def melody(text):
    """'d5.2 f5.2 r.4' → 칸 배열 (음, -1 지속, None 쉼)"""
    out = []
    for t in text.split():
        p, ln = t.split('.'); ln = int(ln)
        if p == 'r': out += [None] * ln
        else: out += [midi(p)] + [-1] * (ln - 1)
    return out

def chord(name):
    """'Dm' 'Bb' 'A7' 'Gm7' 'C7' → (근음 음이름 번호, 구성음 반음 간격들)"""
    root = PC[name[0].lower()]; i = 1
    if i < len(name) and name[i] in '#b': root += 1 if name[i] == '#' else -1; i += 1
    q = name[i:]
    if q == 'maj7': iv = [0, 4, 7, 11]
    elif q == 'm7b5': iv = [0, 3, 6, 10]
    elif q == 'm': iv = [0, 3, 7]
    elif q == 'm7': iv = [0, 3, 7, 10]
    elif q == '7': iv = [0, 4, 7, 10]
    else: iv = [0, 4, 7]
    return root % 12, iv

def bass_bar(name, style):
    r, iv = chord(name); lo = 33 + (r - 9) % 12   # A1(33) ~ G#2(44)
    if style == 'oct8':      # 8분 옥타브 왕복 (3세대 배틀 베이스)
        seq = [lo, -1, lo + 12, -1] * 4
    elif style == 'drive':   # 16분 근음 연타 + 박마다 5도
        seq = []
        for b in range(4): seq += [lo, lo, lo + 12 if b % 2 else lo + iv[2], lo]
    elif style == 'quarter':  # 4분 워킹: 근음·3도·5도·(7도/옥타브) — 로비 곡
        top = lo + (iv[3] if len(iv) > 3 else 12)
        seq = [lo, -1, -1, -1, lo + iv[1], -1, -1, -1, lo + iv[2], -1, -1, -1, top, -1, -1, -1]
    else:                    # 'walk': 근음·5도·옥타브·5도
        seq = [lo, -1, lo + iv[2], -1, lo + 12, -1, lo + iv[2], -1] * 2
    return seq

def harm_bar(name):
    """화음 채널: 반 마디씩 3음 → 5음 (4옥타브)"""
    r, iv = chord(name); base = 60 + (r - 0) % 12
    if base > 66: base -= 12
    return [base + iv[1]] + [-1] * 7 + [base + iv[2]] + [-1] * 7

def arp_bar(name, on=True):
    if not on: return [None] * 16
    r, iv = chord(name); base = 72 + r % 12
    if base > 78: base -= 12
    pat = [base + iv[0], base + iv[1], base + iv[2], base + (iv[3] if len(iv) > 3 else 12)]
    return [pat[i % 4] for i in range(16)]

def song(bpm, lead_type, sections, bass_style, drums_main, drums_b, drums_intro, arp_in=('B',)):
    lead, harm, bass, arp, drums = [], [], [], [], ''
    intro_len = 0
    for kind, chords, mel in sections:
        m = melody(mel)
        assert len(m) == 16 * len(chords), (kind, len(m), len(chords))
        lead += m
        for ch in chords:
            harm += harm_bar(ch)
            bass += bass_bar(ch, bass_style if bass_style == 'quarter' else 'drive' if kind == 'intro' else bass_style)
            arp += arp_bar(ch, kind in arp_in)
            drums += drums_intro if kind == 'intro' else drums_b if kind == 'B' else drums_main
        if kind == 'intro': intro_len = len(lead)
    enc = lambda a: ''.join(' ' if x is None else '!' if x == -1 else chr(x + 14) for x in a)
    return {'bpm': bpm, 'intro': intro_len, 'leadType': lead_type, 'lead': enc(lead), 'harm': enc(harm), 'bass': enc(bass), 'arp': enc(arp), 'drums': drums}

SONGS = {
    'g3battle': song(156, 'pulse25', [
        ('intro', ['A', 'A'],
         'a4.1 bb4.1 b4.1 c5.1 c#5.1 d5.1 d#5.1 e5.1 f5.1 f#5.1 g5.1 g#5.1 a5.4  a5.2 r.2 a5.2 r.2 a5.2 r.2 a5.4'),
        ('A', ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'C', 'A'],
         'd5.2 f5.2 a5.4 g5.2 f5.2 e5.2 f5.2  d5.4 bb4.2 c5.2 d5.6 f5.2  e5.2 g5.2 c6.4 bb5.2 a5.2 g5.2 e5.2  a5.8 c#5.4 e5.4 '
         'f5.2 a5.2 d6.4 c6.2 a5.2 f5.2 a5.2  bb5.4 a5.2 g5.2 f5.4 d5.4  g5.2 e5.2 c5.2 e5.2 g5.4 bb5.4  a5.12 r.4'),
        ('B', ['Gm', 'Dm', 'Bb', 'C', 'Gm', 'A', 'Dm', 'A7'],
         'g5.6 a5.2 bb5.4 a5.4  f5.6 e5.2 d5.8  d5.2 f5.2 bb5.6 a5.2 g5.4  e5.2 g5.2 c6.6 bb5.2 a5.2 g5.2 '
         'bb5.4 a5.4 g5.4 f5.4  e5.4 c#5.4 e5.4 a5.4  d6.6 c6.2 a5.4 f5.4  e5.2 g5.2 a5.2 c#6.2 e6.8'),
    ], 'oct8', 'k.h.s.h.k.hks.h.', 'k.hhs.hhk.hhs.hs', 's...s...s...s.ss'),
    'g3gym': song(168, 'pulse25', [
        ('intro', ['Cm', 'Cm', 'Ab', 'G'],
         'c5.2 r.2 c5.2 r.2 c5.2 r.2 eb5.2 r.2  c5.2 r.2 c5.2 r.2 c5.2 r.2 g5.2 r.2  ab4.4 bb4.4 c5.4 d5.4  g5.16'),
        ('A', ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'F', 'G'],
         'c5.4 eb5.2 g5.2 c6.4 bb5.2 g5.2  ab5.6 g5.2 f5.4 eb5.4  d5.2 f5.2 bb5.4 ab5.2 g5.2 f5.2 d5.2  g5.8 b4.4 d5.4 '
         'eb5.2 g5.2 c6.4 d6.2 eb6.2 d6.2 c6.2  c6.4 ab5.4 eb5.4 c5.4  f5.2 ab5.2 c6.6 bb5.2 ab5.4  g5.12 r.4'),
        ('B', ['Ab', 'Bb', 'Gm', 'Cm', 'Ab', 'Bb', 'Db', 'G'],
         'eb6.6 c6.2 ab5.8  d6.6 bb5.2 f5.8  g5.4 bb5.4 d6.4 bb5.4  c6.8 g5.8 '
         'ab5.2 c6.2 eb6.4 db6.2 c6.2 bb5.4  bb5.2 d6.2 f6.4 eb6.2 d6.2 c6.4  db6.4 ab5.4 f5.4 db5.4  d5.2 g5.2 b5.2 d6.2 g6.8'),
    ], 'drive', 'k.hks.hkk.hks.hs', 'k.hhs.hkk.hhs.ss', 's.s.s.s.s.s.ssss'),
    'g3frontier': song(160, 'pulse25', [
        ('intro', ['C', 'C'],
         'c5.2 c5.2 c5.2 g5.4 e5.2 g5.4  c6.12 r.4'),
        ('A', ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C'],
         'a5.4 c6.4 f5.4 a5.4  g5.6 e5.2 c5.8  d5.2 f5.2 a5.4 g5.2 f5.2 e5.4  f5.8 d5.4 bb4.4 '
         'c6.4 a5.2 c6.2 f6.4 e6.4  d6.2 c6.2 bb5.4 g5.4 e5.4  f5.2 g5.2 a5.2 bb5.2 d6.8  c6.12 r.4'),
        ('B', ['Gm', 'C', 'Am', 'Dm', 'Bb', 'C', 'Gm7', 'C7'],
         'bb5.6 a5.2 g5.8  e5.4 g5.4 c6.8  c6.6 b5.2 a5.8  f5.4 a5.4 d6.8 '
         'd6.2 c6.2 bb5.4 a5.2 g5.2 f5.4  e5.2 f5.2 g5.4 a5.2 bb5.2 c6.4  d6.4 bb5.4 g5.4 bb5.4  c6.4 e6.4 g6.8'),
    ], 'walk', 'k.h.s.h.k.h.s.hs', 'k.h.s.hkk.h.s.ss', 'k...k...k...s.ss'),
}

# ── 3세대 곡에 더 가까운 편곡용 확장 (song2) ──
# 3세대 배틀 곡에서 흔한 장치(장르 공통 기법)를 넣음 — 선율·진행은 모두 이 앱용 새 작곡:
#  · 둘째 펄스가 리드를 3도/6도 아래로 따라가는 대선율 ('third')  · 반 박 엇박 화음 찌르기 ('stab')
#  · 구간 마지막 마디의 드럼 필인  · 갤럽(8분+16분 둘) 베이스  · 브리지에서 관계조/나란한조로 조바꿈
def bars(text, bar=16):
    """'|' 로 마디를 나눈 선율 — 마디마다 bar 칸(4/4 = 16, 3/4 = 12)인지 확인"""
    out = []
    for i, b in enumerate(text.split('|')):
        m = melody(b); assert len(m) == bar, (i, len(m), b); out += m
    return out

def third_below(lead, chords, bar=16):
    """리드 음마다 같은 마디 화음의 구성음 중 3~9반음 아래(3도·6도 우선)를 고름 — 지속도 그대로"""
    out = []; cur = None
    for s, n in enumerate(lead):
        if n is None: out.append(None); cur = None; continue
        if n == -1: out.append(-1 if cur is not None else None); continue
        r, iv = chord(chords[s // bar]); pcs = {(r + x) % 12 for x in iv}
        cand = [n - d for d in range(3, 10) if (n - d) % 12 in pcs]
        cur = min(cand, key=lambda x: abs((n - x) - 4)) if cand else None
        out.append(cur)
    return out

def stab_bar(name):
    """반 박 엇박으로 화음 찌르기 (3음·5음 번갈아)"""
    r, iv = chord(name); base = 60 + r % 12
    if base > 66: base -= 12
    a, b = base + iv[1], base + iv[2]; z = None
    return [z, z, a, z, z, z, b, z, z, z, a, z, z, z, b, z]

def harm_style(name, style, lead_bar):
    """화음 채널 반주 (16칸 기준, 3/4 는 앞 12칸만 씀)"""
    r, iv = chord(name); base = 60 + r % 12
    if base > 66: base -= 12
    z = None; t3, t5 = base + iv[1], base + iv[2]; top = base + (iv[3] if len(iv) > 3 else 12)
    if style == 'pad': return harm_bar(name)
    if style == 'stab': return stab_bar(name)
    if style == 'offbeat':   # 뒤박마다 짧게 (레게·컨트리 기타처럼)
        return [z, z, t3, z, z, z, t5, z, z, z, t3, z, z, z, t5, z]
    if style == 'chordarp':  # 8분으로 펼친 화음 1-3-5-3
        return [base, -1, t3, -1, t5, -1, t3, -1, base, -1, t3, -1, t5, -1, top, -1]
    if style == 'waltz':     # 3/4: 둘째·셋째 박에 화음
        return [z, z, z, z, t3, -1, z, z, t5, -1, z, z, z, z, z, z]
    if style == 'drone':     # 근음을 길게 깔기
        return [base] + [-1] * 15
    if style == 'oct':       # 리드를 한 옥타브 아래로 겹침 (금관·파워 코드 느낌)
        return [x - 12 if x not in (None, -1) else x for x in lead_bar]
    return [None] * 16

def bass2(name, style):
    r, iv = chord(name); lo = 33 + (r - 9) % 12; f = lo + iv[2]; t = lo + iv[1]
    if style == 'gallop':  # 박마다 근음 8분 + 16분 둘 (근음·옥타브)
        return [lo, -1, lo, lo + 12] * 4
    if style == 'synco':   # 엇박 옥타브
        return [lo, -1, lo + 12, lo, -1, lo, lo + 12, -1, lo, -1, lo + 12, lo, f, -1, lo + 12, -1]
    if style == 'menace':  # 옥타브 왕복 3박 + 반음씩 내려가는 넷째 박
        return [lo, -1, lo + 12, -1] * 3 + [lo + 12, lo + 11, lo + 10, lo + 7]
    if style == 'half':    # 브리지: 2분 근음·5도
        return [lo] + [-1] * 7 + [f] + [-1] * 7
    if style == 'sustain':  # 온음표 근음
        return [lo] + [-1] * 15
    if style == 'boogie':  # 부기: 근음·3도·5도·6도·b7·6도·5도·3도 (8분)
        return [lo, -1, t, -1, f, -1, lo + 9, -1, lo + 10, -1, lo + 9, -1, f, -1, t, -1]
    if style == 'pedal':   # 근음을 쉬엄쉬엄 두드림 (드론)
        return [lo, -1, lo, -1, None, None, lo, -1, lo, -1, lo, -1, None, None, lo, lo + 12]
    if style == 'octfunk':  # 펑크: 엇박 옥타브 16분
        return [lo, -1, None, lo + 12, None, lo, None, lo + 12, lo, -1, None, lo + 12, None, lo, lo + 12, None]
    if style == 'march':   # 행진: 근음·5도 4분
        return [lo, -1, None, None, f - 12 if f - 12 >= 28 else f, -1, None, None] * 2
    if style == 'waltz':   # 3/4: 첫 박 근음만
        return [lo, -1, -1, -1] + [None] * 12
    return bass_bar(name, style)

def arp2(name, style):
    if style in (True, 'up'): return arp_bar(name, True)
    if not style or style == 'none': return [None] * 16
    r, iv = chord(name); base = 72 + r % 12
    if base > 78: base -= 12
    p = [base + iv[0], base + iv[1], base + iv[2], base + (iv[3] if len(iv) > 3 else 12)]
    if style == 'updown':  # 오르내리는 16분 (반짝임)
        seq = [p[0], p[1], p[2], p[3], p[2] + 12, p[3], p[2], p[1]]
        return seq * 2
    if style == 'bell':    # 1·3박에만 높은 종소리
        return [p[2] + 12, -1, -1, -1, None, None, None, None, p[1] + 12, -1, -1, -1, None, None, None, None]
    return arp_bar(name, True)

def song2(bpm, sections, drums, fill, voice=None, bar=16):
    """sections: (이름, 화음들, 선율, {'harm': third|pad|stab|offbeat|chordarp|waltz|drone|oct|none,
    'bass': 스타일, 'arp': up|updown|bell|none, 'drum': 키}). bar: 한 마디 칸 수 (16 = 4/4, 12 = 3/4).
    drums: {키: bar 칸 패턴}, fill: 구간 마지막 마디 드럼 (인트로 제외), voice: 곡 음색(앱 시퀀서의 v)"""
    lead, harm, bass, arp, dr = [], [], [], [], ''
    intro_len = 0
    for kind, chords, mel, o in sections:
        m = bars(mel, bar); assert len(m) == bar * len(chords), (kind, len(m) // bar, len(chords))
        lead += m
        h = o.get('harm', 'third')
        if h == 'third': harm += third_below(m, chords, bar)
        for j, ch in enumerate(chords):
            lb = m[j * bar:(j + 1) * bar] + [None] * (16 - bar)
            if h != 'third': harm += harm_style(ch, h, lb)[:bar]
            bass += bass2(ch, o.get('bass', 'oct8'))[:bar]
            arp += arp2(ch, o.get('arp', False))[:bar]
            last = j == len(chords) - 1 and kind != 'intro'
            pat = fill if last else drums[o.get('drum', 'main')]
            assert len(pat) == bar, (kind, pat)
            dr += pat
        if kind == 'intro': intro_len = len(lead)
    enc = lambda a: ''.join(' ' if x is None else '!' if x == -1 else chr(x + 14) for x in a)
    out = {'bpm': bpm, 'intro': intro_len, 'leadType': 'pulse25', 'lead': enc(lead), 'harm': enc(harm), 'bass': enc(bass), 'arp': enc(arp), 'drums': dr}
    if voice: out['v'] = voice
    return out

def consonance(name, sections, bar=16):
    """점검: 박 머리(4/4 는 1·3박, 3/4 는 1박)에 오는 리드 음이 화음 구성음이 아닌 곳 — 비율이 높으면 선율 손보기"""
    bad = tot = 0
    for kind, chords, mel, _ in sections:
        m = bars(mel, bar)
        for s in range(0, len(m), 8 if bar == 16 else bar):
            n = m[s]
            if n is None or n == -1: continue
            r, iv = chord(chords[s // bar]); tot += 1
            if n % 12 not in {(r + x) % 12 for x in iv}: bad += 1
    return f'{name}: 강박 비화음 {bad}/{tot}'

DR = {'main': 'k.h.s.hkk.hks.h.', 'b': 'k.hhs.hkk.hhs.hs', 'half': 'k.......s.......', 'intro': 's.s.s.s.s.s.ssss'}
DR_FILL = 'k.s.k.s.s.ssssss'
NEW = {
    # 로비(타이틀·메인 화면): 처음 마을처럼 밝고 경쾌한 D장조 112 — 순차 진행 위주 선율, 3도 아래 대선율, 통통 튀는 워킹 베이스, 가벼운 드럼
    'lobby': (112, [
        ('intro', ['D', 'A'],
         'a5.2 f#5.2 d5.2 f#5.2 a5.4 d6.4|c#6.4 b5.2 a5.2 e5.4 r.4', {'harm': 'third', 'bass': 'walk', 'drum': 'intro'}),
        ('A', ['D', 'G', 'D', 'A', 'D', 'G', 'A', 'D'],
         'f#5.4 a5.2 c#6.2 d6.4 a5.4|b5.3 a5.1 g5.4 b5.4 d6.4|a5.6 f#5.2 d5.4 f#5.4|e5.2 f#5.2 g5.2 a5.2 c#6.4 e6.4|'
         'd6.4 f#6.2 e6.2 d6.4 a5.4|b5.4 d6.2 c#6.2 b5.4 g5.4|a5.2 b5.2 c#6.2 e6.2 a5.4 c#6.4|d6.8 r.4 a5.4', {'harm': 'third', 'bass': 'walk'}),
        ('B', ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'A7'],
         'g5.4 b5.4 d6.6 b5.2|c#6.4 e6.4 a6.6 e6.2|f#6.6 e6.2 c#6.4 a5.4|b5.4 d6.2 c#6.2 b5.8|'
         'd6.4 b5.2 g5.2 b5.4 d6.4|e6.4 c#6.2 a5.2 c#6.4 e6.4|f#6.4 e6.2 d6.2 a5.4 f#5.4|g5.2 a5.2 b5.2 c#6.2 e6.8', {'harm': 'pad', 'bass': 'walk', 'arp': True}),
    ], {'main': 'k...h.h.s...h.h.', 'intro': 'k.......s...s.s.'}, 'k...h.h.s.h.s.ss'),
    # 라이벌·강한 트레이너 (A단조 164): 반음 찌르기 인트로, A 뒤 Bb(나폴리) 로 긴장, C장조 브리지
    'g3rival': (164, [
        ('intro', ['Am', 'Am', 'F', 'E7'],
         'a5.1 r.1 a5.1 r.1 a5.1 r.1 a5.2 g5.2 e5.2 c5.2 a4.2|a4.1 r.1 a4.1 r.1 a4.1 r.1 c5.2 e5.2 a5.2 c6.2 e6.2|'
         'f6.4 e6.2 c6.2 a5.4 f5.4|e5.2 g#5.2 b5.2 d6.2 e6.8', {'harm': 'none', 'bass': 'drive', 'drum': 'intro'}),
        ('A', ['Am', 'F', 'G', 'C', 'Dm', 'Am', 'F', 'E7'],
         'a5.3 b5.1 c6.4 b5.2 a5.2 e5.4|f5.6 a5.2 c6.4 a5.4|b5.3 a5.1 g5.4 d5.4 g5.4|e5.8 g5.4 c6.4|'
         'd6.3 c6.1 a5.4 f5.2 a5.2 d6.4|c6.6 b5.2 a5.4 e5.4|f5.2 a5.2 c6.2 f6.2 e6.4 d6.4|e6.4 d6.2 b5.2 g#5.8', {'bass': 'gallop'}),
        ('B', ['F', 'G', 'Em', 'Am', 'Dm', 'Bb', 'E7', 'E7'],
         'c6.4 a5.4 f5.2 g5.2 a5.4|b5.4 g5.4 d5.2 e5.2 f5.2 g5.2|b5.6 c6.2 b5.4 g5.4|a5.8 c6.4 e6.4|'
         'f6.6 e6.2 d6.4 a5.4|bb5.6 a5.2 f5.4 d5.4|e5.2 f5.2 g#5.2 a5.2 b5.2 c6.2 d6.2 e6.2|e6.2 r.2 e6.2 r.2 e6.2 d6.2 b5.2 g#5.2',
         {'harm': 'stab', 'bass': 'oct8', 'arp': True, 'drum': 'b'}),
        ('A', ['Am', 'F', 'G', 'C', 'Dm', 'Am', 'F', 'E7'],
         'a5.3 b5.1 c6.4 b5.2 a5.2 e5.4|f5.6 a5.2 c6.4 a5.4|b5.3 a5.1 g5.4 d5.4 g5.4|e5.8 g5.4 c6.4|'
         'd6.3 c6.1 a5.4 f5.2 a5.2 d6.4|c6.6 b5.2 a5.4 e5.4|f5.2 a5.2 c6.2 f6.2 e6.4 d6.4|e6.4 d6.2 b5.2 g#5.8', {'bass': 'gallop'}),
        ('C', ['C', 'G', 'Am', 'Em', 'F', 'C', 'Dm', 'E7'],
         'e6.8 d6.4 c6.4|d6.8 b5.8|c6.8 a5.4 b5.4|g5.8 e5.8|a5.8 c6.4 f6.4|e6.8 g6.4 e6.4|f6.4 e6.4 d6.4 c6.4|b5.8 g#5.4 e5.4',
         {'harm': 'pad', 'bass': 'half', 'arp': True, 'drum': 'half'}),
    ]),
    # 악의 조직 (E단조 148): 엇박 연타 리드, 반음 하강 베이스, 나폴리 F 화음
    'g3evil': (148, [
        ('intro', ['Em', 'Em'],
         'e4.1 e4.1 r.2 e4.1 e4.1 r.2 bb4.2 r.2 b4.4|e5.1 e5.1 r.2 e5.1 e5.1 r.2 f5.2 r.2 f#5.2 g5.2', {'harm': 'none', 'bass': 'menace', 'drum': 'intro'}),
        ('A', ['Em', 'Em', 'C', 'B7', 'Em', 'Em', 'Am', 'B7'],
         'e5.2 r.1 e5.1 g5.2 r.1 g5.1 b5.4 a#5.2 b5.2|c6.4 b5.4 g5.2 f#5.2 e5.4|e5.2 r.1 e5.1 g5.2 r.1 g5.1 c6.4 b5.2 c6.2|d#6.6 c6.2 b5.4 a5.4|'
         'g5.2 a5.2 b5.4 e6.4 d6.2 b5.2|c6.2 b5.2 a5.2 g5.2 f#5.2 g5.2 a#5.4|c6.4 a5.4 e5.4 c6.4|b5.8 f#5.4 d#5.4', {'bass': 'menace'}),
        ('B', ['C', 'D', 'Bm', 'Em', 'C', 'D', 'F', 'B7'],
         'g5.6 e5.2 c5.8|a5.6 f#5.2 d5.8|b5.4 d6.4 f#6.4 d6.4|e6.12 r.4|c6.4 e6.4 g6.4 e6.4|d6.4 f#6.4 a6.4 f#6.4|f6.6 c6.2 a5.4 f5.4|f#5.2 a5.2 b5.2 d#6.2 f#6.8',
         {'harm': 'pad', 'bass': 'oct8', 'arp': True, 'drum': 'b'}),
    ]),
    # 챔피언 결전 (G단조 176): 팡파르 인트로 → Bb장조 B → A단조로 조바꿈한 C, D7 로 돌아옴
    'g3champion': (176, [
        ('intro', ['Gm', 'Eb', 'F', 'D'],
         'g4.2 bb4.2 d5.2 g5.2 bb5.4 a5.2 g5.2|g5.4 eb5.4 bb4.4 eb5.4|f5.2 a5.2 c6.2 f6.2 eb6.4 c6.4|d6.2 r.2 d6.2 r.2 d6.2 c6.2 a5.2 f#5.2',
         {'harm': 'third', 'bass': 'drive', 'drum': 'intro'}),
        ('A', ['Gm', 'F', 'Eb', 'D', 'Gm', 'Bb', 'Cm', 'D7'],
         'd6.4 bb5.2 g5.2 d5.4 g5.2 a5.2|c6.6 a5.2 f5.4 c5.4|bb5.3 c6.1 bb5.2 g5.2 eb5.4 g5.4|a5.8 f#5.4 d5.4|'
         'g5.2 a5.2 bb5.2 d6.2 g6.4 f6.2 d6.2|f6.4 d6.4 bb5.4 d6.4|eb6.2 d6.2 c6.2 bb5.2 c6.2 eb6.2 g6.4|f#6.8 c6.4 a5.4', {'bass': 'gallop'}),
        ('B', ['Eb', 'F', 'Dm', 'Gm', 'Eb', 'F', 'Bb', 'D7'],
         'g5.6 bb5.2 eb6.8|f6.6 eb6.2 c6.8|d6.4 f6.4 a6.4 f6.4|g6.12 d6.4|eb6.4 d6.4 c6.4 bb5.4|a5.4 c6.4 f6.4 eb6.4|d6.6 c6.2 bb5.8|a5.2 c6.2 d6.2 f#6.2 a6.8',
         {'harm': 'stab', 'bass': 'synco', 'arp': True, 'drum': 'b'}),
        ('A', ['Gm', 'F', 'Eb', 'D', 'Gm', 'Bb', 'Cm', 'D7'],
         'd6.4 bb5.2 g5.2 d5.4 g5.2 a5.2|c6.6 a5.2 f5.4 c5.4|bb5.3 c6.1 bb5.2 g5.2 eb5.4 g5.4|a5.8 f#5.4 d5.4|'
         'g5.2 a5.2 bb5.2 d6.2 g6.4 f6.2 d6.2|f6.4 d6.4 bb5.4 d6.4|eb6.2 d6.2 c6.2 bb5.2 c6.2 eb6.2 g6.4|f#6.8 c6.4 a5.4', {'bass': 'gallop'}),
        ('C', ['Am', 'F', 'G', 'E7', 'Am', 'F', 'Bm7b5', 'D7'],
         'e6.4 a6.4 g6.2 e6.2 c6.4|f6.6 e6.2 c6.8|d6.4 g6.4 f6.2 d6.2 b5.4|g#5.8 b5.4 e6.4|a6.6 g6.2 e6.4 c6.4|c6.4 f6.4 a6.4 f6.4|f6.4 d6.4 b5.4 a5.4|f#5.2 a5.2 c6.2 d6.2 f#6.2 a6.2 c7.4',
         {'harm': 'third', 'bass': 'oct8', 'arp': True, 'drum': 'b'}),
    ]),
    # 프런티어 브레인 (D장조 172): 믹솔리디안 C 화음, B 끝 Bb(♭VI)→A7 로 크게 끌어올림
    'g3brain': (172, [
        ('intro', ['D', 'C', 'G', 'A'],
         'd5.2 f#5.2 a5.2 d6.2 a5.2 d6.2 f#6.4|e6.2 c6.2 g5.2 e5.2 g5.2 c6.2 e6.4|d6.4 b5.4 g5.4 b5.4|a5.2 r.2 a5.2 r.2 c#6.2 e6.2 a6.4',
         {'harm': 'third', 'bass': 'drive', 'drum': 'intro'}),
        ('A', ['D', 'A', 'Bm', 'G', 'D', 'C', 'G', 'A'],
         'f#6.6 e6.2 d6.4 a5.4|e6.6 c#6.2 a5.8|d6.3 c#6.1 b5.4 f#5.4 b5.4|g5.2 a5.2 b5.4 d6.8|'
         'a6.4 f#6.2 d6.2 a5.4 d6.4|g6.4 e6.2 c6.2 g5.4 c6.4|b5.2 c6.2 d6.4 g6.4 f#6.4|e6.12 r.4', {'bass': 'synco'}),
        ('B', ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'Bb', 'A7'],
         'b5.4 d6.4 g6.6 f#6.2|e6.4 c#6.4 a5.8|c#6.6 a5.2 f#5.8|d6.4 f#6.4 b6.8|g6.4 f#6.2 e6.2 d6.4 b5.4|c#6.4 e6.4 a6.8|bb6.6 f6.2 d6.8|c#6.2 e6.2 g6.2 a6.2 c#7.8',
         {'harm': 'stab', 'bass': 'gallop', 'arp': True, 'drum': 'b'}),
    ]),
    # PWT 대진표·토너먼트 대기 (Bb장조 132): 경기장 행진풍 — 셋잇단 같은 연타 팡파르 인트로, 워킹 베이스, B 에서 Eb·Dm 으로 펼쳐지고 F7 로 돌아옴
    'pwthall': (132, [
        ('intro', ['Bb', 'F'],
         'bb4.2 bb4.2 bb4.2 f5.6 r.4|a5.2 a5.2 a5.2 c6.6 r.4', {'harm': 'third', 'bass': 'drive', 'drum': 'intro'}),
        ('A', ['Bb', 'F', 'Gm', 'Eb', 'Bb', 'Eb', 'C7', 'F7'],
         'd6.4 bb5.2 f5.2 bb5.4 d6.4|c6.6 a5.2 f5.4 a5.4|bb5.3 a5.1 g5.4 d6.4 bb5.4|g5.2 a5.2 bb5.2 c6.2 eb6.8|'
         'f6.4 d6.2 bb5.2 f5.4 bb5.4|g6.4 eb6.2 bb5.2 g5.4 eb6.4|e6.2 d6.2 c6.2 bb5.2 g5.4 c6.4|a5.8 c6.4 eb6.4', {'harm': 'third', 'bass': 'walk'}),
        ('B', ['Eb', 'F', 'Dm', 'Gm', 'Cm', 'F', 'Bb', 'F7'],
         'g5.4 bb5.4 eb6.6 d6.2|c6.4 a5.4 f5.8|f5.4 a5.4 d6.6 c6.2|bb5.8 g5.4 d5.4|'
         'eb6.4 c6.4 g5.4 c6.4|a5.2 bb5.2 c6.2 d6.2 f6.8|d6.6 c6.2 bb5.4 f5.4|a5.2 c6.2 eb6.2 f6.2 a6.8', {'harm': 'pad', 'bass': 'oct8', 'arp': True, 'drum': 'b'}),
    ], {'main': 'k...s...k.k.s...', 'b': 'k...s.k.k.k.s.ss', 'intro': 's.s.s.s.s.s.ssss'}, 'k.s.k.s.s.ssssss'),
    # 배틀팰리스 (D도리안 138): 조용하지만 팽팽한 — 5음계 느낌의 리드, Dm→G(도리안 IV) 진행, 가벼운 드럼, B 에서 Bb·C 로 열렸다가 A7 로 돌아옴
    'g3palace': (138, [
        ('intro', ['Dm', 'Dm'],
         'd5.2 a4.2 d5.2 f5.2 a5.4 g5.4|d6.2 c6.2 a5.2 g5.2 a5.8', {'harm': 'none', 'bass': 'half', 'drum': 'intro'}),
        ('A', ['Dm', 'G', 'Dm', 'C', 'F', 'G', 'Am', 'Am'],
         'a5.4 g5.2 a5.2 d6.4 c6.2 a5.2|g5.6 a5.2 b5.4 d6.4|f5.4 d5.2 f5.2 a5.4 g5.2 f5.2|e5.6 g5.2 c6.8|'
         'c6.4 a5.2 c6.2 f6.4 d6.2 c6.2|d6.6 c6.2 b5.4 g5.4|a5.2 c6.2 d6.4 e6.2 d6.2 c6.4|a5.12 r.4', {'harm': 'third', 'bass': 'walk'}),
        ('B', ['Bb', 'C', 'Am', 'Dm', 'Bb', 'C', 'Em', 'A7'],
         'd6.4 f6.4 d6.2 c6.2 bb5.4|c6.6 d6.2 e6.4 g6.4|e6.4 c6.4 a5.4 c6.4|d6.8 a5.4 f5.4|'
         'f5.4 bb5.4 d6.4 f6.4|g6.6 f6.2 e6.4 c6.4|b5.4 g5.2 a5.2 b5.4 d6.4|c#6.2 e6.2 a6.4 g6.2 e6.2 c#6.4', {'harm': 'pad', 'bass': 'half', 'arp': True, 'drum': 'b'}),
    ], {'main': 'k.......s...h.h.', 'b': 'k...h...s...h.h.', 'intro': 'h...h...h...h...'}, 'k...s...s.s.s.ss'),
    # 배틀팩토리 (E단조 158): 기계가 도는 듯한 16분 반복 리드, 엇박 옥타브 베이스, B 는 16분 연타 베이스와 화음 찌르기
    'g3factory': (158, [
        ('intro', ['Em', 'Em'],
         'e5.1 e5.1 r.1 e5.1 r.1 e5.1 b4.1 r.1 e5.1 e5.1 r.1 e5.1 g5.2 f#5.2|e5.1 e5.1 r.1 e5.1 r.1 e5.1 b4.1 r.1 b5.2 a5.2 g5.2 f#5.2',
         {'harm': 'none', 'bass': 'drive', 'drum': 'intro'}),
        ('A', ['Em', 'C', 'D', 'B', 'Em', 'C', 'Am', 'B7'],
         'e5.2 g5.1 e5.1 b5.2 e5.2 g5.2 b5.2 e6.4|e6.2 d6.1 c6.1 g5.2 c6.2 e6.2 g5.2 c6.4|d6.2 c6.1 a5.1 f#5.2 a5.2 d6.2 a5.2 f#5.4|d#6.4 b5.2 f#5.2 b5.8|'
         'g5.2 b5.1 g5.1 e5.2 g5.2 b5.2 e6.2 g6.4|g6.2 e6.1 c6.1 g5.2 e6.2 c6.4 g5.4|a5.2 c6.1 a5.1 e6.2 c6.2 a5.2 c6.2 e6.4|f#6.4 d#6.4 b5.4 a5.4', {'harm': 'third', 'bass': 'synco'}),
        ('B', ['Am', 'D', 'G', 'C', 'Am', 'B7', 'Em', 'B7'],
         'c6.6 b5.2 a5.4 e5.4|f#5.6 a5.2 d6.8|b5.4 d6.4 g6.4 d6.4|e6.8 c6.4 g5.4|'
         'a5.2 b5.2 c6.2 e6.2 a6.4 e6.4|f#6.4 d#6.2 b5.2 a5.4 f#5.4|g5.2 f#5.2 e5.2 g5.2 b5.4 e6.4|d#6.2 r.2 d#6.2 r.2 f#6.2 r.2 b5.4',
         {'harm': 'stab', 'bass': 'drive', 'arp': True, 'drum': 'b'}),
    ], {'main': 'k.hhs.hhk.hhs.hh', 'b': 'k.hks.hkk.hks.hs', 'intro': 'k.h.k.h.k.h.k.hs'}, 'k.s.k.s.k.s.ssss'),
    # 랭크 매치 (B단조 170): 현대적인 경기장 — 분산화음 인트로, 엇박 화음 찌르기, B 는 갤럽 베이스로 G-A-F#m 을 밀어 올림
    'g3rank': (170, [
        ('intro', ['Bm', 'G', 'D', 'F#7'],
         'b4.2 d5.2 f#5.2 b5.2 d6.2 b5.2 f#5.4|g5.2 b5.2 d6.2 g6.2 d6.2 b5.2 g5.4|a5.2 d6.2 f#6.4 a6.2 f#6.2 d6.4|f#6.2 r.2 f#6.2 r.2 e6.2 c#6.2 a#5.4',
         {'harm': 'stab', 'bass': 'drive', 'drum': 'intro'}),
        ('A', ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'F#7'],
         'f#5.3 b5.1 d6.4 f#6.2 e6.2 d6.4|b5.6 a5.2 g5.4 d5.4|a5.3 d6.1 f#6.4 a6.4 f#6.4|e6.6 c#6.2 a5.8|'
         'd6.2 c#6.2 b5.2 d6.2 f#6.4 b6.4|g6.4 f#6.2 d6.2 b5.4 d6.4|e6.2 f#6.2 g6.2 b6.2 g6.4 e6.4|f#6.8 c#6.4 a#5.4', {'harm': 'stab', 'bass': 'synco'}),
        ('B', ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'F#7'],
         'd6.4 g6.4 b6.6 a6.2|a6.4 e6.4 c#6.8|c#6.4 f#6.4 a6.6 g#6.2|f#6.8 d6.4 b5.4|'
         'b5.2 d6.2 g6.2 d6.2 b6.4 a6.4|a6.2 e6.2 c#6.2 e6.2 a6.4 c#7.4|d7.6 c#7.2 a6.4 f#6.4|e6.2 f#6.2 a#6.2 c#7.2 e7.8',
         {'harm': 'third', 'bass': 'gallop', 'arp': True, 'drum': 'b'}),
    ], {'main': 'k.h.s.hkk.hks.hk', 'b': 'k.hhs.hkkkhhs.hs', 'intro': 'k...s...k.k.s.ss'}, 'k.s.k.s.s.ssssss'),
    # 보스 러시 (F단조 182): 끊어 치는 옥타브 인트로, 반음 하강 베이스, ♭II(Gb) 로 조이는 A, Db·Eb 로 치솟는 B
    'g3rush': (182, [
        ('intro', ['Fm', 'Fm', 'Db', 'C7'],
         'f4.1 f4.1 r.2 f5.1 f5.1 r.2 ab5.2 r.2 c6.4|f4.1 f4.1 r.2 f5.1 f5.1 r.2 c6.2 db6.2 c6.4|db6.4 ab5.4 f5.4 db5.4|c5.2 e5.2 g5.2 bb5.2 c6.8',
         {'harm': 'none', 'bass': 'menace', 'drum': 'intro'}),
        ('A', ['Fm', 'Fm', 'Db', 'C7', 'Fm', 'Bbm', 'Gb', 'C7'],
         'f5.2 r.1 f5.1 ab5.2 c6.2 f6.4 e6.2 f6.2|ab6.4 g6.2 f6.2 c6.4 ab5.4|f5.2 r.1 f5.1 ab5.2 db6.2 f6.4 eb6.2 db6.2|e6.6 db6.2 c6.4 g5.4|'
         'c6.2 db6.2 c6.2 ab5.2 f5.4 c6.4|db6.2 eb6.2 f6.2 db6.2 bb5.4 f5.4|gb5.2 bb5.2 db6.2 f6.2 gb6.4 db6.4|c6.2 bb5.2 g5.2 e5.2 c5.8', {'harm': 'third', 'bass': 'menace'}),
        ('B', ['Db', 'Eb', 'Cm', 'Fm', 'Db', 'Eb', 'Bbm', 'C7'],
         'ab5.6 db6.2 f6.8|g6.6 f6.2 eb6.4 bb5.4|c6.4 eb6.4 g6.4 eb6.4|f6.12 c6.4|'
         'db6.2 f6.2 ab6.2 f6.2 db7.4 ab6.4|bb6.2 g6.2 eb6.2 g6.2 bb6.4 g6.4|f6.4 db6.4 bb5.4 db6.4|e6.2 r.2 e6.2 r.2 g6.2 bb6.2 c7.4',
         {'harm': 'stab', 'bass': 'gallop', 'arp': True, 'drum': 'b'}),
    ], {'main': 'kkh.s.hkk.hks.hs', 'b': 'k.k.s.kkk.k.s.ss', 'intro': 'k.k.k.k.s.s.ssss'}, 'k.s.k.s.ssssssss'),
    # 오늘의 도전 (G장조 150): 밝고 경쾌한 축제풍 — 도약하는 분산화음 선율, 워킹 베이스, B 는 C-D-Bm-Em 으로 펼쳐지고 D7 로 돌아옴
    'g3daily': (150, [
        ('intro', ['G', 'D'],
         'd5.2 g5.2 b5.2 d6.2 g6.4 d6.4|f#6.2 e6.2 d6.2 a5.2 f#5.4 a5.4', {'harm': 'third', 'bass': 'walk', 'drum': 'intro'}),
        ('A', ['G', 'C', 'G', 'D', 'Em', 'C', 'Am', 'D7'],
         'b5.4 d6.2 b5.2 g5.4 b5.4|c6.4 e6.2 c6.2 g5.4 e5.4|d5.2 g5.2 b5.2 d6.2 g6.6 f#6.2|f#6.4 e6.2 d6.2 a5.8|'
         'g6.4 e6.2 g6.2 b6.4 g6.4|e6.2 f#6.2 g6.2 e6.2 c6.4 g5.4|a5.2 b5.2 c6.2 e6.2 a6.4 g6.2 f#6.2|f#6.8 d6.4 c6.4', {'harm': 'third', 'bass': 'walk'}),
        ('B', ['C', 'D', 'Bm', 'Em', 'Am', 'D', 'G', 'D7'],
         'e6.6 d6.2 c6.4 g5.4|f#6.6 e6.2 d6.4 a5.4|b5.4 d6.4 f#6.4 d6.4|e6.8 b5.4 g5.4|'
         'c6.2 b5.2 a5.2 c6.2 e6.4 a6.4|a6.2 g6.2 f#6.2 e6.2 d6.4 f#6.4|g6.6 f#6.2 g6.4 b6.4|a6.2 r.2 a6.2 r.2 f#6.2 d6.2 c6.4',
         {'harm': 'pad', 'bass': 'oct8', 'arp': True, 'drum': 'b'}),
    ], {'main': 'k.h.s.hhk.h.s.h.', 'b': 'k.hhs.h.k.hhs.hs', 'intro': 'k...s...k.k.s.ss'}, 'k.s.k.s.s.ssssss'),
    # ── 교환소 곡: 곡마다 음색·박자·리듬·드럼·음계를 다르게 (v = 앱 시퀀서 음색) ──
    # 노을 언덕 (D믹솔리디안 132, 셔플): 서부 휘파람 — 포르타멘토 50% 펄스, 부기 베이스, 뒤박 기타, 느긋한 셔플
    'g3sunset': (132, [
        ('intro', ['D', 'A7'], 'a5.4 f#5.2 a5.2 d6.8|e6.4 c#6.2 e6.2 a6.8', {'harm': 'none', 'bass': 'boogie', 'drum': 'intro'}),
        ('A', ['D', 'G', 'D', 'A7', 'D', 'C', 'G', 'A7'],
         'f#6.6 e6.2 d6.4 a5.4|b5.6 d6.2 g6.8|a6.4 f#6.2 a6.2 d7.6 c7.2|c#7.4 a6.2 g6.2 e6.8|'
         'd6.2 e6.2 f#6.2 a6.2 d7.8|c7.6 g6.2 e6.8|d7.4 b6.4 g6.4 b6.4|a6.12 r.4', {'harm': 'offbeat', 'bass': 'boogie'}),
        ('B', ['G', 'D', 'Em', 'A', 'G', 'D', 'C', 'A7'],
         'g6.8 b6.4 d7.4|f#7.8 d7.4 a6.4|e7.6 d7.2 b6.8|c#7.8 e7.8|'
         'd7.4 b6.4 g6.4 a6.4|f#6.6 g6.2 a6.8|g6.4 e6.4 c6.4 e6.4|g6.2 r.2 g6.2 r.2 e6.2 c#6.2 a5.4', {'harm': 'pad', 'bass': 'boogie', 'drum': 'b'}),
    ], {'main': 'k..hs..hk.hhs..h', 'b': 'k..hs..hk..hs.hh', 'intro': 'k...s...k...s...'}, 'k..hs.s.s.ssssss',
     {'lead': 'p50', 'vib': 1.4, 'slide': 1, 'swing': 0.6, 'echo': [0.18, 0.3, 0.25], 'harm': 'p25', 'bassv': 'wave'}),
    # 별빛 결전 (E단조 184, 록): 톱니파 리드 + 한 옥타브 아래 겹침, 3+3+2 리프, 탐 필인, 반음계로 치솟는 B
    'g3star': (184, [
        ('intro', ['Em', 'Em', 'C', 'D'],
         'e5.1 e5.1 e6.2 e5.1 e5.1 d6.2 e5.1 e5.1 b5.2 e5.1 e5.1 g5.2|e5.1 e5.1 e6.2 e5.1 e5.1 d6.2 e5.1 e5.1 b5.2 e5.1 e5.1 g5.2|'
         'c6.2 e6.2 g6.2 c7.2 e7.2 g7.2 c7.4|d7.2 a6.2 f#6.2 d6.2 a5.2 f#5.2 d5.4', {'harm': 'none', 'bass': 'drive', 'drum': 'intro'}),
        ('A', ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'Am', 'B7'],
         'b5.3 g5.3 e5.2 b5.3 g6.3 f#6.2|e6.3 d6.3 b5.2 g5.8|c6.3 e6.3 g6.2 c7.3 b6.3 g6.2|a6.3 f#6.3 d6.2 a6.8|'
         'b6.3 g6.3 e6.2 b6.3 e7.3 d7.2|e7.6 d7.2 b6.8|c7.3 a6.3 e6.2 a6.3 c7.3 e7.2|d#7.4 f#7.4 a7.4 b7.4', {'harm': 'oct', 'bass': 'drive'}),
        ('B', ['C', 'D', 'Em', 'Em', 'C', 'D', 'B7', 'B7'],
         'g6.1 g#6.1 a6.2 b6.4 c7.8|a6.1 a#6.1 b6.2 c#7.4 d7.8|e7.4 d7.2 b6.2 g6.4 b6.4|e7.16|'
         'e7.2 d7.2 c7.2 g6.2 e6.4 g6.4|f#6.2 a6.2 d7.2 f#7.2 a7.8|b6.2 d#7.2 f#7.2 a7.2 b7.8|a7.2 f#7.2 d#7.2 b6.2 a6.2 f#6.2 d#6.4',
         {'harm': 'stab', 'bass': 'gallop', 'drum': 'b'}),
    ], {'main': 'k.hks.hkk.hks.hk', 'b': 'k.k.s.k.kks.s.k.', 'intro': 'k.k.k.k.t.t.l.l.'}, 't.t.l.l.s.s.ssss',
     {'lead': 'saw', 'vib': 0.6, 'vibRate': 7, 'echo': [0.09, 0.2, 0.15], 'harm': 'p25', 'bassv': 'p50'}),
    # 벚꽃 정원 (요 음계 104): 코토처럼 튕기는 12.5% 펄스, 다섯 음(파·솔·시b·도·레)만, 긴 메아리, 림샷만 가볍게
    'g3sakura': (104, [
        ('intro', ['Bb', 'F'], 'd6.2 bb5.2 f5.4 f6.2 d6.2 bb5.4|c6.8 f6.4 c6.4', {'harm': 'pad', 'bass': 'sustain', 'drum': 'intro'}),
        ('A', ['F', 'Dm', 'Bb', 'C', 'F', 'Gm', 'Bb', 'C'],
         'f6.4 g6.2 f6.2 c6.8|d6.6 c6.2 d6.8|f6.4 d6.4 bb5.4 d6.4|c6.6 d6.2 g6.8|'
         'f6.2 g6.2 bb6.2 c7.2 f6.8|g6.6 f6.2 d6.8|d6.2 f6.2 bb6.4 f6.4 d6.4|c6.12 r.4', {'harm': 'pad', 'bass': 'sustain', 'arp': 'bell'}),
        ('B', ['Dm', 'Bb', 'F', 'C', 'Dm', 'Gm', 'C', 'F'],
         'd7.6 c7.2 d7.8|f7.6 d7.2 bb6.8|c7.4 bb6.2 g6.2 f6.8|g6.6 bb6.2 c7.8|'
         'f6.2 g6.2 f6.2 d6.2 f6.8|g6.4 bb6.4 d7.4 bb6.4|c7.6 bb6.2 g6.8|f6.8 c6.4 f5.4', {'harm': 'third', 'bass': 'half', 'arp': 'bell', 'drum': 'b'}),
    ], {'main': 'r...h...r.r.h...', 'b': 'k...h.r.k.r.h...', 'intro': '................'}, 'r.r.r.rrk.......',
     {'lead': 'p12', 'env': 'pluck', 'vib': 0, 'echo': [0.24, 0.35, 0.3], 'harm': 'tri', 'arp': 0.125, 'bassv': 'tri'}),
    # 사막 유적 (D 프리지안 도미넌트 112): 피리처럼 깊게 떠는 리드와 미끄러짐, 근음 드론 베이스, 탐으로 친 타블라 리듬
    'g3desert': (112, [
        ('intro', ['D', 'D'], 'd6.1 eb6.1 f#6.2 g6.2 eb6.2 d6.8|a6.1 bb6.1 a6.2 g6.2 f#6.2 a6.4 d6.4', {'harm': 'none', 'bass': 'pedal', 'drum': 'intro'}),
        ('A', ['D', 'Eb', 'D', 'Cm', 'Gm', 'Eb', 'D', 'D7'],
         'a6.4 bb6.2 a6.2 f#6.4 d6.4|g6.4 f#6.2 eb6.2 bb5.8|f#6.2 g6.2 a6.4 d7.6 c7.2|c7.4 bb6.2 a6.2 g6.8|'
         'bb6.2 a6.2 g6.4 d6.4 g6.4|eb7.6 d7.2 bb6.8|a6.2 bb6.2 a6.2 g6.2 f#6.8|c7.2 bb6.2 a6.2 f#6.2 d6.8', {'harm': 'drone', 'bass': 'pedal'}),
        ('B', ['Gm', 'D', 'Cm', 'D', 'Eb', 'D', 'Cm', 'D'],
         'g6.8 bb6.4 d7.4|d7.2 eb7.2 d7.2 c7.2 a6.8|eb7.6 d7.2 c7.8|a6.2 bb6.2 a6.2 g6.2 f#6.4 a6.4|'
         'g7.6 f#7.2 eb7.8|d7.4 c7.2 bb6.2 a6.8|g6.4 eb6.4 c6.4 eb6.4|d6.16', {'harm': 'none', 'bass': 'pedal', 'drum': 'b'}),
    ], {'main': 't..tl.t.t.tll.t.', 'b': 'k..tl.t.k.tlt.tt', 'intro': 't...l...t...l.tl'}, 'tttlltl.tltltltl',
     {'lead': 'p25', 'vib': 2.5, 'vibRate': 7, 'slide': 1, 'echo': [0.2, 0.4, 0.3], 'harm': 'p50', 'bassv': 'wave'}),
    # 오로라 (B단조 140, 하프타임): 천천히 부푸는 긴 음, 반짝이며 오르내리는 16분 아르페지오, 넓은 메아리, 3박에 스네어
    'g3aurora': (140, [
        ('intro', ['Bm', 'G', 'D', 'A'], 'f#6.16|d6.16|f#6.8 a6.8|c#7.16', {'harm': 'pad', 'bass': 'sustain', 'arp': 'updown', 'drum': 'intro'}),
        ('A', ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'F#'],
         'b6.8 d7.4 c#7.4|b6.12 g6.4|a6.8 f#6.4 a6.4|e6.12 r.4|d7.8 f#7.4 e7.4|d7.8 b6.4 g6.4|g6.8 b6.4 e7.4|f#6.4 a#6.4 c#7.8',
         {'harm': 'pad', 'bass': 'half', 'arp': 'updown'}),
        ('B', ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'F#', 'F#'],
         'g7.6 f#7.2 d7.8|e7.6 c#7.2 a6.8|c#7.8 a6.4 f#6.4|b6.16|b6.4 d7.4 g7.4 d7.4|c#7.4 e7.4 a7.4 e7.4|a#7.8 f#7.4 c#7.4|f#7.16',
         {'harm': 'third', 'bass': 'oct8', 'arp': 'updown', 'drum': 'b'}),
    ], {'main': 'k...h...s...h.h.', 'b': 'k.h.k.h.s.h.h.hk', 'intro': 'k...............'}, 'k...s...s.s.ssss',
     {'lead': 'p25', 'env': 'swell', 'vib': 1, 'echo': [0.27, 0.45, 0.35], 'harm': 'p50', 'arp': 0.125, 'arpVol': 1.5, 'bassv': 'wave'}),
    # 해저 신전 (D도리안 88): 삼각파 리드가 천천히 부풀고, 펼친 화음이 물결처럼, 드럼은 거의 없이 아주 긴 메아리
    'g3deepsea': (88, [
        ('intro', ['Dm7', 'G'], 'a5.8 c6.8|b5.8 d6.8', {'harm': 'chordarp', 'bass': 'sustain', 'drum': 'intro'}),
        ('A', ['Dm', 'G', 'Dm', 'G', 'Fmaj7', 'C', 'Em7', 'Am7'],
         'd6.4 f6.4 a6.8|b6.6 a6.2 g6.8|f6.4 e6.4 d6.8|d6.12 r.4|e6.4 f6.4 a6.4 c7.4|e7.8 c7.4 g6.4|d7.6 b6.2 g6.8|a6.12 r.4',
         {'harm': 'chordarp', 'bass': 'sustain'}),
        ('B', ['G', 'Am7', 'Dm', 'C', 'G', 'Am7', 'Em7', 'A'],
         'g6.8 b6.8|c7.8 e7.8|f7.8 d7.4 a6.4|g6.12 e6.4|b6.4 a6.4 g6.4 d6.4|e6.4 g6.4 a6.4 c7.4|b6.8 g6.8|c#7.8 e7.8',
         {'harm': 'chordarp', 'bass': 'half', 'arp': 'bell', 'drum': 'b'}),
    ], {'main': 'k.......h.....h.', 'b': 'k.....h.k...h.h.', 'intro': '................'}, 'k...h...h.h.hhhh',
     {'lead': 'tri', 'env': 'swell', 'vib': 0.8, 'vibRate': 4, 'echo': [0.33, 0.5, 0.4], 'harm': 'wave', 'arp': 0.25, 'bassv': 'tri'}),
    # 구름 위 탑 (Bb장조 116, 행진): 점음표 팡파르, 50% 펄스 + 한 옥타브 위 겹침(금관), 근음·5도 행진 베이스, 스네어 연타
    'g3skypillar': (116, [
        ('intro', ['Bb', 'F'], 'f5.3 f5.1 bb5.3 bb5.1 d6.4 f6.4|f6.3 eb6.1 d6.3 c6.1 c6.8', {'harm': 'oct', 'bass': 'march', 'drum': 'intro'}),
        ('A', ['Bb', 'Eb', 'Bb', 'F', 'Gm', 'Eb', 'F', 'F7'],
         'd6.3 d6.1 f6.3 d6.1 bb6.8|g6.3 f6.1 eb6.3 g6.1 bb6.8|f6.3 d6.1 bb5.3 d6.1 f6.4 bb6.4|a6.3 g6.1 f6.3 a6.1 c7.8|'
         'bb6.3 a6.1 g6.3 bb6.1 d7.8|eb7.3 d7.1 c7.3 bb6.1 g6.8|f6.3 g6.1 a6.3 bb6.1 c7.4 a6.4|eb7.4 c7.4 a6.4 f6.4', {'harm': 'third', 'bass': 'march'}),
        ('B', ['Eb', 'F', 'Dm', 'Gm', 'Cm', 'F', 'Bb', 'Bb'],
         'bb6.8 g6.8|a6.8 c7.8|d7.8 a6.8|bb6.12 d7.4|c7.8 eb7.8|f7.8 c7.4 a6.4|bb6.3 bb6.1 d7.3 d7.1 f7.8|bb7.12 r.4',
         {'harm': 'pad', 'bass': 'half', 'arp': 'up', 'drum': 'b'}),
    ], {'main': 'k.s.ss.sk.s.s.ss', 'b': 'k...s...k...s.s.', 'intro': 'k.ssssssk.ssssss'}, 'k.ssk.sss.ssssss',
     {'lead': 'p50', 'vib': 0.5, 'oct': 1, 'echo': [0.12, 0.25, 0.2], 'harm': 'p50', 'bassv': 'p50'}),
    # 네온 시티 (A단조 118, 신스펑크): 12.5% 펄스 리드가 미끄러지고, 펑크 옥타브 베이스, 네 박 킥·박수·열린 하이햇, 가벼운 스윙
    'g3neon': (118, [
        ('intro', ['Am', 'F', 'C', 'G'],
         'a5.2 r.2 a5.1 a5.1 c6.2 r.2 e6.2 g6.2 e6.2|f5.2 r.2 f5.1 f5.1 a5.2 r.2 c6.2 e6.2 c6.2|'
         'c6.2 r.2 c6.1 c6.1 e6.2 r.2 g6.2 b6.2 g6.2|g5.2 r.2 g5.1 g5.1 b5.2 r.2 d6.2 f6.2 d6.2', {'harm': 'none', 'bass': 'octfunk', 'drum': 'intro'}),
        ('A', ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'],
         'e6.3 e6.3 a6.2 r.2 g6.2 e6.4|f6.3 f6.3 c7.2 r.2 a6.2 f6.4|g6.3 g6.3 e7.2 r.2 d7.2 c7.4|b6.3 b6.3 d7.2 r.2 b6.2 g6.4|'
         'c7.2 b6.2 a6.2 e6.2 a6.4 c7.2 e7.2|f7.6 e7.2 c7.8|d7.2 f7.2 a7.4 f7.2 d7.2 a6.4|g#6.4 b6.4 e7.8', {'harm': 'offbeat', 'bass': 'octfunk'}),
        ('B', ['Dm', 'Am', 'F', 'E', 'Dm', 'Am', 'F', 'E7'],
         'a6.12 f6.4|e7.12 c7.4|c7.6 a6.2 f6.8|b6.6 g#6.2 e6.8|'
         'd7.2 r.2 d7.2 r.2 f7.2 a7.2 f7.4|e7.2 r.2 e7.2 r.2 c7.2 e7.2 a7.4|a7.4 g7.2 f7.2 c7.8|b6.2 d7.2 g#7.4 e7.8',
         {'harm': 'pad', 'bass': 'octfunk', 'arp': 'up', 'drum': 'b'}),
    ], {'main': 'k.o.c.o.k.o.c.ok', 'b': 'k.okc.o.k.okc.oo', 'intro': 'k...k...k...k.k.'}, 'k.c.k.c.cccccccc',
     {'lead': 'p12', 'vib': 0, 'slide': 1, 'swing': 0.35, 'echo': [0.17, 0.25, 0.2], 'harm': 'p25', 'bassv': 'p50'}),
    # 솜사탕 꿈나라 (G리디안 168, 3/4 왈츠): 오르골처럼 튕기는 높은 리드, 첫 박 베이스 + 둘째·셋째 박 화음, 긴 메아리
    'g3yume': (168, [
        ('intro', ['Gmaj7', 'A'], 'd7.2 b6.2 g6.2 b6.2 d7.4|c#7.2 a6.2 e6.2 a6.2 c#7.4', {'harm': 'none', 'bass': 'waltz', 'drum': 'intro'}),
        ('A', ['G', 'A', 'G', 'A', 'Em', 'A', 'D', 'D'],
         'b6.4 d7.4 g7.4|a6.4 c#7.4 e7.4|g7.2 f#7.2 d7.4 b6.4|c#7.8 a6.4|b6.4 e7.2 d7.2 b6.4|c#7.4 e7.2 c#7.2 a6.4|f#7.4 e7.2 d7.2 a6.4|d7.12',
         {'harm': 'waltz', 'bass': 'waltz'}),
        ('B', ['Cmaj7', 'Bm', 'Am7', 'D', 'Cmaj7', 'Bm', 'A', 'D'],
         'e7.4 g7.4 b7.4|d7.8 f#7.4|c7.4 e7.4 g7.4|f#7.8 a6.4|g7.2 e7.2 c7.4 e7.4|f#7.2 d7.2 b6.4 d7.4|e7.4 c#7.4 a6.4|d7.8 r.4',
         {'harm': 'waltz', 'bass': 'waltz', 'arp': 'bell', 'drum': 'b'}),
    ], {'main': 'k...h...h...', 'b': 'k...h.h.h...', 'intro': 'k...........'}, 'k...h.h.hhhh',
     {'lead': 'p12', 'env': 'pluck', 'vib': 0, 'echo': [0.22, 0.45, 0.4], 'harm': 'tri', 'arp': 0.125, 'bassv': 'tri'}, 12),
    # 한밤의 하트 (C단조 106, 스윙): 장난감 피아노처럼 튕기며 느리게 떠는 리드, 반음씩 내려가는 선율, 부기 베이스, 나폴리 화음(Db)
    'g3yami': (106, [
        ('intro', ['Cm', 'G7'], 'c6.3 eb6.1 g6.3 f#6.1 g6.8|f6.3 d6.1 b5.3 d6.1 g5.8', {'harm': 'none', 'bass': 'boogie', 'drum': 'intro'}),
        ('A', ['Cm', 'Ab', 'Cm', 'G7', 'Fm', 'Cm', 'Ab', 'G7'],
         'g6.3 f#6.1 g6.3 eb6.1 c6.8|c7.3 b6.1 c7.3 ab6.1 eb6.8|eb6.2 d6.2 eb6.2 g6.2 c7.4 b6.4|b6.3 bb6.1 a6.3 ab6.1 g6.8|'
         'ab6.3 g6.1 f6.3 c6.1 f6.8|g6.3 eb6.1 c6.3 eb6.1 g6.8|ab6.2 c7.2 eb7.4 c7.4 ab6.4|g6.2 r.2 f6.2 r.2 d6.2 b5.2 g5.4',
         {'harm': 'chordarp', 'bass': 'boogie'}),
        ('B', ['Ab', 'Db', 'Cm', 'G', 'Ab', 'Db', 'G7', 'G7'],
         'eb7.8 c7.8|db7.8 f7.8|g7.6 eb7.2 c7.8|b6.6 d7.2 g7.8|c7.3 b6.1 c7.3 eb7.1 ab7.8|f7.3 e7.1 f7.3 ab7.1 db7.8|f7.4 d7.4 b6.4 g6.4|b6.2 c7.2 d7.2 f7.2 g7.8',
         {'harm': 'pad', 'bass': 'half', 'arp': 'bell', 'drum': 'b'}),
    ], {'main': 'k..hs..hk..hs..h', 'b': 'k..hs.hhk..hs.sh', 'intro': 'k.......s.......'}, 'k..hs..hs.s.ssss',
     {'lead': 'p25', 'env': 'pluck', 'vib': 3, 'vibRate': 3, 'swing': 0.66, 'echo': [0.2, 0.35, 0.3], 'harm': 'p12', 'bassv': 'tri'}),
    # 분홍 처방전 (A장조 186, 전파 팝): IV-V-iii-vi 진행, 같은 음 연타 선율, 옥타브 겹친 밝은 리드, 박수 낀 빠른 비트
    'g3menhera': (186, [
        ('intro', ['D', 'E', 'C#m', 'F#m'],
         'f#6.2 a6.2 d7.2 a6.2 f#6.2 a6.2 d7.4|g#6.2 b6.2 e7.2 b6.2 g#6.2 b6.2 e7.4|e6.2 g#6.2 c#7.2 g#6.2 e6.2 g#6.2 c#7.4|f#6.2 a6.2 c#7.2 a6.2 f#6.4 r.4',
         {'harm': 'none', 'bass': 'oct8', 'arp': 'up', 'drum': 'intro'}),
        ('A', ['D', 'E', 'C#m', 'F#m', 'D', 'E', 'A', 'A'],
         'a6.2 a6.2 a6.2 b6.2 a6.4 f#6.4|g#6.2 g#6.2 g#6.2 a6.2 b6.8|c#7.2 c#7.2 c#7.2 b6.2 g#6.4 e6.4|a6.6 g#6.2 f#6.8|'
         'f#6.2 a6.2 d7.2 e7.2 f#7.4 e7.4|e7.2 d7.2 b6.2 g#6.2 b6.4 e7.4|c#7.4 e7.4 a7.4 e7.4|a7.12 r.4', {'harm': 'stab', 'bass': 'oct8', 'arp': 'up'}),
        ('B', ['Bm', 'C#m', 'D', 'E', 'Bm', 'C#m', 'D', 'E7'],
         'd7.6 c#7.2 b6.8|e7.6 d7.2 c#7.8|f#7.4 e7.4 d7.4 a6.4|b6.12 g#6.4|'
         'b6.2 c#7.2 d7.2 f#7.2 b7.4 a7.4|g#7.4 e7.4 c#7.4 e7.4|f#7.2 r.2 f#7.2 r.2 a7.2 f#7.2 d7.4|g#7.2 r.2 g#7.2 r.2 e7.2 d7.2 b6.4',
         {'harm': 'oct', 'bass': 'drive', 'arp': 'up', 'drum': 'b'}),
    ], {'main': 'k.hhkchhk.hhkchh', 'b': 'kkhhkchhk.hhkchc', 'intro': 'k.k.k.k.k.k.kkkk'}, 'c.c.c.c.cccccccc',
     {'lead': 'p50', 'vib': 0.4, 'oct': 1, 'echo': [0.1, 0.2, 0.15], 'harm': 'p25', 'arp': 0.125, 'bassv': 'p50'}),
}
# ── 시나리오 모드 전용 (새로 쓴 선율): 마을 · 길 · 동굴 · 인연 ──
NEW.update({
    # 마을 (G장조 104): 느긋한 순차 진행, 3도 아래 대선율, 걷는 베이스
    'sctown': (104, [
        ('intro', ['G', 'D'], 'd5.4 g5.4 b5.4 d6.4|c6.4 a5.4 f#5.4 d5.4', {'harm': 'third', 'bass': 'walk', 'drum': 'intro'}),
        ('A', ['G', 'C', 'G', 'D', 'Em', 'C', 'D', 'G'],
         'b5.6 a5.2 g5.4 d5.4|e5.4 g5.4 c6.6 b5.2|b5.4 d6.4 g6.6 d6.2|a5.4 f#5.4 a5.8|'
         'g5.4 b5.4 e6.6 d6.2|c6.4 e6.2 d6.2 c6.4 g5.4|a5.2 b5.2 c6.2 d6.2 f#6.4 a5.4|g5.12 r.4', {'harm': 'third', 'bass': 'walk'}),
        ('B', ['C', 'G', 'Am', 'D', 'C', 'G', 'D', 'G'],
         'e6.6 c6.2 g5.8|d6.6 b5.2 g5.8|c6.4 e6.4 a6.6 g6.2|f#6.8 d6.4 a5.4|'
         'e6.4 g6.4 e6.4 c6.4|d6.4 g6.4 d6.4 b5.4|a5.2 d6.2 f#6.2 a6.2 f#6.4 d6.4|g6.8 r.4 d5.4', {'harm': 'pad', 'bass': 'walk', 'arp': True}),
    ], {'main': 'k...h.h.s...h.h.', 'intro': 'k.......s...s.s.'}, 'k...h.h.s.h.s.ss',
     {'lead': 'p50', 'vib': 0.5, 'echo': [0.16, 0.3, 0.25], 'harm': 'tri', 'bassv': 'tri'}),
    # 길 (C장조 140): 발걸음이 가벼운 행진, 도약하는 선율
    'scroute': (140, [
        ('intro', ['C', 'G'], 'g5.2 g5.2 c6.4 e6.4 g6.4|f6.2 e6.2 d6.4 g5.4 b5.4', {'harm': 'none', 'bass': 'march', 'drum': 'intro'}),
        ('A', ['C', 'F', 'C', 'G', 'Am', 'F', 'G', 'C'],
         'e6.3 d6.1 c6.4 g5.4 c6.4|a5.4 c6.4 f6.6 e6.2|e6.2 g6.2 c7.4 g6.4 e6.4|d6.6 b5.2 g5.8|'
         'c6.4 e6.4 a6.6 g6.2|f6.4 a6.2 g6.2 f6.4 c6.4|d6.2 e6.2 f6.2 g6.2 b6.4 d7.4|c7.8 r.4 g5.4', {'harm': 'third', 'bass': 'march'}),
        ('B', ['F', 'C', 'Dm', 'G', 'F', 'Em', 'Dm', 'G7'],
         'a6.6 f6.2 c6.8|g6.6 e6.2 c6.8|f6.4 d6.4 a5.4 d6.4|g6.2 r.2 g6.2 r.2 b6.4 d7.4|'
         'c7.4 a6.4 f6.4 a6.4|b6.4 g6.4 e6.4 g6.4|a6.2 g6.2 f6.2 e6.2 d6.4 f6.4|g6.4 b6.4 d7.4 g6.4', {'harm': 'offbeat', 'bass': 'march', 'drum': 'b'}),
    ], {'main': 'k.h.s.h.k.h.s.hh', 'b': 'k.hhs.h.k.hhs.hs', 'intro': 's...s...s.s.s.ss'}, 'k.s.k.s.s.ssssss',
     {'lead': 'p25', 'vib': 0.6, 'echo': [0.12, 0.25, 0.2], 'harm': 'p25'}),
    # 동굴 (E단조 92): 느린 단조, 길게 끄는 음과 종소리 아르페지오
    'sccave': (92, [
        ('intro', ['Em', 'Em'], 'e5.8 b5.8|g5.8 e5.8', {'harm': 'none', 'bass': 'sustain', 'drum': 'intro'}),
        ('A', ['Em', 'C', 'Am', 'B7', 'Em', 'C', 'D', 'Em'],
         'e5.4 g5.4 b5.8|c6.6 b5.2 g5.8|a5.4 c6.4 e6.8|d#6.6 b5.2 f#5.8|'
         'e6.4 b5.4 g5.4 b5.4|c6.4 e6.4 g6.8|f#6.6 d6.2 a5.8|e5.12 r.4', {'harm': 'pad', 'bass': 'sustain', 'arp': 'bell'}),
        ('B', ['C', 'G', 'Am', 'Em', 'C', 'D', 'B7', 'B7'],
         'e6.8 c6.4 g5.4|d6.8 b5.4 g5.4|c6.6 a5.2 e5.8|b5.8 g5.4 e5.4|'
         'e6.4 g6.4 c7.8|a6.6 f#6.2 d6.8|b6.8 f#6.4 d#6.4|b5.12 r.4', {'harm': 'pad', 'bass': 'pedal', 'arp': 'bell'}),
    ], {'main': 'k.......s.....h.', 'intro': 'k...............'}, 'k.......s...s.s.',
     {'lead': 'tri', 'env': 'swell', 'vib': 1, 'echo': [0.26, 0.42, 0.3], 'harm': 'wave', 'bassv': 'tri'}),
    # 인연 (F장조 96): 인물과 가까워지는 장면 — 길게 노래하는 선율
    'scheart': (96, [
        ('intro', ['F', 'C'], 'c6.4 a5.4 f5.8|e5.4 g5.4 c6.8', {'harm': 'none', 'bass': 'sustain', 'drum': 'intro'}),
        ('A', ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Gm', 'C7'],
         'a5.6 c6.2 f6.8|f6.4 d6.4 a5.8|d6.4 f6.4 bb6.6 a6.2|g6.8 e6.4 c6.4|'
         'a6.6 g6.2 f6.4 c6.4|d6.4 f6.4 a6.8|bb6.4 g6.4 d6.4 g6.4|e6.8 c6.4 bb5.4', {'harm': 'pad', 'bass': 'sustain', 'arp': 'updown'}),
        ('B', ['Bb', 'F', 'Gm', 'C', 'Bb', 'Am', 'Gm', 'C7'],
         'd6.6 f6.2 bb6.8|a6.6 f6.2 c6.8|bb6.4 g6.4 d6.8|c6.4 e6.4 g6.8|'
         'f6.4 d6.4 bb5.4 d6.4|e6.4 c6.4 a5.4 c6.4|d6.2 e6.2 f6.2 g6.2 bb6.8|g6.8 e6.8', {'harm': 'third', 'bass': 'sustain', 'arp': 'updown'}),
    ], {'main': 'k.....h.s.....h.', 'intro': '................'}, 'k.....h.s...s.s.',
     {'lead': 'p50', 'env': 'swell', 'vib': 1.2, 'echo': [0.22, 0.38, 0.3], 'harm': 'tri', 'bassv': 'tri'}),
})
for k, (bpm, secs, *dr) in NEW.items():
    bar = dr[3] if len(dr) > 3 else 16
    print(consonance(k, secs, bar))
    SONGS[k] = song2(bpm, secs, dr[0] if dr else DR, dr[1] if dr else DR_FILL, dr[2] if len(dr) > 2 else None, bar)

# 그 밖의 곡도 음색을 조금씩 다르게 (같은 소리로 들리지 않게)
VOICES = {
    'lobby': {'lead': 'p50', 'vib': 0.5, 'echo': [0.15, 0.3, 0.25], 'harm': 'tri', 'bassv': 'tri'},
    'g3gym': {'lead': 'p50', 'vib': 1},
    'g3frontier': {'lead': 'p50', 'oct': 1, 'harm': 'p25'},
    'g3rival': {'lead': 'p12', 'slide': 1, 'vib': 0.8},
    'g3evil': {'lead': 'saw', 'vib': 0.5, 'bassv': 'p50', 'echo': [0.14, 0.35, 0.25]},
    'g3champion': {'lead': 'p25', 'oct': 1, 'vib': 1.2},
    'g3brain': {'lead': 'p12', 'vib': 0.6, 'harm': 'p25'},
    'pwthall': {'lead': 'p50', 'vib': 0.4, 'harm': 'p25'},
    'g3palace': {'lead': 'tri', 'env': 'swell', 'vib': 1, 'echo': [0.24, 0.4, 0.3], 'harm': 'wave'},
    'g3factory': {'lead': 'p12', 'vib': 0, 'echo': [0.09, 0.15, 0.1], 'bassv': 'p50'},
    'g3rank': {'lead': 'saw', 'vib': 0.8},
    'g3rush': {'lead': 'p50', 'oct': 1, 'vib': 1.5, 'vibRate': 6.5},
    'g3daily': {'lead': 'p50', 'env': 'pluck', 'vib': 0, 'echo': [0.18, 0.3, 0.25]},
}
for k, v in VOICES.items():
    if k in SONGS: SONGS[k].setdefault('v', v)

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '../src/gen/chip-gen3.json')
    for k, v in SONGS.items():
        n = len(v['lead']); assert all(len(v[c]) == n for c in ('harm', 'bass', 'arp', 'drums')), k
        print(k, f"{v['bpm']}bpm", f"{n // (12 if k == 'g3yume' else 16)}마디", f"{n * 60 / v['bpm'] / 4:.0f}초", 'intro', v['intro'])
    json.dump(SONGS, open(out, 'w'), ensure_ascii=False)
    print('→', out)
