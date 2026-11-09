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
def bars(text):
    """'|' 로 마디를 나눈 선율 — 마디마다 16칸인지 확인"""
    out = []
    for i, b in enumerate(text.split('|')):
        m = melody(b); assert len(m) == 16, (i, len(m), b); out += m
    return out

def third_below(lead, chords):
    """리드 음마다 같은 마디 화음의 구성음 중 3~9반음 아래(3도·6도 우선)를 고름 — 지속도 그대로"""
    out = []; cur = None
    for s, n in enumerate(lead):
        if n is None: out.append(None); cur = None; continue
        if n == -1: out.append(-1 if cur is not None else None); continue
        r, iv = chord(chords[s // 16]); pcs = {(r + x) % 12 for x in iv}
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

def bass2(name, style):
    r, iv = chord(name); lo = 33 + (r - 9) % 12; f = lo + iv[2]
    if style == 'gallop':  # 박마다 근음 8분 + 16분 둘 (근음·옥타브)
        return [lo, -1, lo, lo + 12] * 4
    if style == 'synco':   # 엇박 옥타브
        return [lo, -1, lo + 12, lo, -1, lo, lo + 12, -1, lo, -1, lo + 12, lo, f, -1, lo + 12, -1]
    if style == 'menace':  # 옥타브 왕복 3박 + 반음씩 내려가는 넷째 박
        return [lo, -1, lo + 12, -1] * 3 + [lo + 12, lo + 11, lo + 10, lo + 7]
    if style == 'half':    # 브리지: 2분 근음·5도
        return [lo] + [-1] * 7 + [f] + [-1] * 7
    return bass_bar(name, style)

def song2(bpm, sections, drums, fill):
    """sections: (이름, 화음들, 선율, {'harm': third|pad|stab|none, 'bass': 스타일, 'arp': bool, 'drum': 키})
    drums: {키: 16칸 패턴}, fill: 구간 마지막 마디 드럼 (인트로 제외)"""
    lead, harm, bass, arp, dr = [], [], [], [], ''
    intro_len = 0
    for kind, chords, mel, o in sections:
        m = bars(mel); assert len(m) == 16 * len(chords), (kind, len(m) // 16, len(chords))
        lead += m
        h = o.get('harm', 'third')
        if h == 'third': harm += third_below(m, chords)
        for j, ch in enumerate(chords):
            if h == 'pad': harm += harm_bar(ch)
            elif h == 'stab': harm += stab_bar(ch)
            elif h == 'none': harm += [None] * 16
            bass += bass2(ch, o.get('bass', 'oct8'))
            arp += arp_bar(ch, o.get('arp', False))
            last = j == len(chords) - 1 and kind != 'intro'
            dr += fill if last else drums[o.get('drum', 'main')]
        if kind == 'intro': intro_len = len(lead)
    enc = lambda a: ''.join(' ' if x is None else '!' if x == -1 else chr(x + 14) for x in a)
    return {'bpm': bpm, 'intro': intro_len, 'leadType': 'pulse25', 'lead': enc(lead), 'harm': enc(harm), 'bass': enc(bass), 'arp': enc(arp), 'drums': dr}

def consonance(name, sections):
    """점검: 박 머리(1·3박)에 오는 리드 음이 화음 구성음이 아닌 곳 — 비율이 높으면 선율 손보기"""
    bad = tot = 0
    for kind, chords, mel, _ in sections:
        m = bars(mel)
        for s in range(0, len(m), 8):
            n = m[s]
            if n is None or n == -1: continue
            r, iv = chord(chords[s // 16]); tot += 1
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
    # 노을 언덕 (D장조 152, 교환소): 탁 트인 들판을 달리는 느낌 — 펼친 화음으로 솟는 인트로, 5도·옥타브로 뛰어오르는 선율, B 는 F#m 으로 살짝 그늘졌다가 A7 로 돌아옴
    'g3sunset': (152, [
        ('intro', ['D', 'A'],
         'd5.2 f#5.2 a5.2 d6.2 f#6.4 e6.4|c#6.2 a5.2 e5.2 a5.2 c#6.4 e6.4', {'harm': 'third', 'bass': 'walk', 'drum': 'intro'}),
        ('A', ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'Em', 'A7'],
         'f#6.4 e6.2 d6.2 a5.4 d6.4|d6.6 c#6.2 b5.4 f#5.4|g5.2 b5.2 d6.2 g6.2 b6.4 a6.4|a6.6 g6.2 e6.4 c#6.4|'
         'd6.2 e6.2 f#6.2 a6.2 d7.4 a6.4|b6.4 a6.2 f#6.2 d6.4 b5.4|g6.2 f#6.2 e6.2 g6.2 b6.4 g6.4|e6.2 f#6.2 g6.2 e6.2 c#6.4 a5.4', {'harm': 'third', 'bass': 'synco'}),
        ('B', ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'A7'],
         'b5.4 d6.4 g6.6 f#6.2|e6.4 c#6.4 a5.6 b5.2|c#6.4 f#6.4 a6.6 g#6.2|f#6.8 d6.4 b5.4|'
         'g5.2 a5.2 b5.2 d6.2 g6.4 d6.4|a5.2 b5.2 c#6.2 e6.2 a6.4 e6.4|f#6.6 e6.2 d6.4 a5.4|g6.2 r.2 g6.2 r.2 e6.2 c#6.2 a5.4',
         {'harm': 'pad', 'bass': 'oct8', 'arp': True, 'drum': 'b'}),
    ], {'main': 'k.h.s.hkk.h.s.hh', 'b': 'k.hhs.hkk.hks.hs', 'intro': 'k...s...k.k.s.ss'}, 'k.s.k.s.s.ssssss'),
    # 별빛 결전 (E단조 168, 교환소): 밤하늘 아래 몰아치는 승부 — 끊어 치는 옥타브 인트로, 높이 치솟는 A, B 는 C·D 로 열렸다가 B7 반복 찌르기로 조임
    'g3star': (168, [
        ('intro', ['Em', 'Em', 'C', 'B7'],
         'e5.1 e5.1 r.2 b5.1 b5.1 r.2 e6.2 r.2 g6.4|e5.1 e5.1 r.2 b5.1 b5.1 r.2 g6.2 f#6.2 e6.4|c6.4 g5.4 e5.4 g5.4|b5.2 d#6.2 f#6.2 a6.2 b6.8',
         {'harm': 'none', 'bass': 'drive', 'drum': 'intro'}),
        ('A', ['Em', 'C', 'D', 'B7', 'Em', 'Am', 'C', 'B7'],
         'e6.2 r.1 e6.1 g6.2 b6.2 e7.4 d7.2 b6.2|c7.4 b6.2 g6.2 e6.4 c6.4|d6.2 r.1 d6.1 f#6.2 a6.2 d7.4 c7.2 a6.2|b6.6 a6.2 f#6.4 d#6.4|'
         'g6.2 f#6.2 e6.2 b5.2 e6.4 g6.4|a6.2 g6.2 e6.2 c6.2 a5.4 e6.4|g6.2 e6.2 c6.2 e6.2 g6.4 c7.4|b6.2 a6.2 f#6.2 d#6.2 b5.8', {'harm': 'third', 'bass': 'gallop'}),
        ('B', ['C', 'D', 'Bm', 'Em', 'Am', 'B7', 'Em', 'B7'],
         'e6.6 g6.2 c7.8|f#6.6 a6.2 d7.8|d7.4 b6.4 f#6.4 b6.4|g6.12 e6.4|'
         'c7.2 b6.2 a6.2 e6.2 c7.4 a6.4|d#7.2 b6.2 f#6.2 b6.2 a6.4 f#6.4|g6.2 a6.2 b6.2 e7.2 g7.4 e7.4|f#7.2 r.2 f#7.2 r.2 d#7.2 b6.2 a6.4',
         {'harm': 'stab', 'bass': 'drive', 'arp': True, 'drum': 'b'}),
    ], {'main': 'k.hks.hkk.hks.hk', 'b': 'kkhks.hkk.hks.ss', 'intro': 'k.k.k.k.s.s.ssss'}, 'k.s.k.s.ssssssss'),
    # 벚꽃 정원 (F장조 132, 교환소): 꽃잎이 흩날리는 산책 — 3도 대선율과 워킹 베이스, B 는 Dm·Gm 으로 살짝 아련해졌다가 C7 로 돌아옴
    'g3sakura': (132, [
        ('intro', ['F', 'C'],
         'c6.2 a5.2 f5.2 a5.2 c6.4 f6.4|e6.2 c6.2 g5.2 c6.2 e6.4 g6.4', {'harm': 'third', 'bass': 'walk', 'drum': 'intro'}),
        ('A', ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C7'],
         'a5.4 c6.2 d6.2 c6.4 a5.4|d6.6 e6.2 f6.4 a5.4|bb5.2 c6.2 d6.2 f6.2 bb6.4 a6.4|g6.6 f6.2 e6.4 c6.4|'
         'f6.4 a6.2 g6.2 f6.4 c6.4|e6.6 d6.2 c6.4 a5.4|d6.2 c6.2 bb5.2 d6.2 f6.4 d6.4|e6.8 g5.4 bb5.4', {'harm': 'third', 'bass': 'walk'}),
        ('B', ['Dm', 'Am', 'Bb', 'F', 'Gm', 'C', 'F', 'C7'],
         'f6.6 e6.2 d6.4 a5.4|c6.6 b5.2 a5.4 e5.4|d6.4 f6.4 bb6.6 a6.2|a6.8 f6.4 c6.4|'
         'g5.2 a5.2 bb5.2 d6.2 g6.4 d6.4|e6.2 f6.2 g6.2 e6.2 c6.4 e6.4|f6.6 g6.2 a6.4 c7.4|bb6.2 r.2 bb6.2 r.2 g6.2 e6.2 c6.4',
         {'harm': 'pad', 'bass': 'half', 'arp': True, 'drum': 'b'}),
    ], {'main': 'k...h.h.s...h.h.', 'b': 'k.h.s.h.k.h.s.hh', 'intro': 'k.......s...s.s.'}, 'k...h.h.s.h.s.ss'),
    # 사막 유적 (D단조 160, 교환소): 뜨거운 바람의 유적 — 증2도(Bb-C#) 느낌의 선율, 엇박 베이스, B 는 Gm·C·F 로 열렸다가 A7 로 조임
    'g3desert': (160, [
        ('intro', ['Dm', 'A7'],
         'd5.2 f5.2 a5.2 d6.2 f6.4 e6.2 d6.2|a5.2 c#6.2 e6.2 g6.2 a6.4 bb6.2 a6.2', {'harm': 'none', 'bass': 'half', 'drum': 'intro'}),
        ('A', ['Dm', 'Bb', 'A', 'Dm', 'Gm', 'Bb', 'A', 'A7'],
         'd6.4 e6.2 f6.2 a6.4 f6.4|f6.2 e6.2 d6.2 bb5.2 d6.4 f6.4|e6.6 f6.2 e6.2 c#6.2 a5.4|d6.12 r.4|'
         'bb5.4 d6.2 g6.2 bb6.4 a6.2 g6.2|f6.6 d6.2 bb5.4 f5.4|a5.2 bb5.2 c#6.2 e6.2 a6.4 g6.2 e6.2|c#6.2 e6.2 g6.2 bb6.2 a6.8', {'harm': 'third', 'bass': 'synco'}),
        ('B', ['Gm', 'A', 'Dm', 'Bb', 'Gm', 'C', 'F', 'A7'],
         'g6.6 a6.2 bb6.4 g6.4|a6.6 g6.2 e6.4 c#6.4|d6.4 f6.4 a6.4 d7.4|d7.6 c7.2 bb6.8|'
         'bb6.2 a6.2 g6.2 d6.2 g6.4 bb6.4|c7.2 bb6.2 g6.2 e6.2 c6.4 e6.4|f6.6 e6.2 f6.4 a6.4|a6.2 r.2 a6.2 r.2 g6.2 e6.2 c#6.4',
         {'harm': 'stab', 'bass': 'drive', 'arp': True, 'drum': 'b'}),
    ], {'main': 'k..hs.h.k.hhs.h.', 'b': 'k.hks.hkk.hks.hs', 'intro': 'k..h..h.k..h..hs'}, 'k.s.k.s.s.ssssss'),
    # 오로라 (B단조 176, 교환소): 극지의 밤하늘 아래 큰 승부 — 펼친 화음 인트로, 높이 솟는 A, B 는 F#m·Em 을 지나 F# 장화음으로 끝맺음
    'g3aurora': (176, [
        ('intro', ['Bm', 'G', 'A', 'F#'],
         'b4.2 f#5.2 b5.2 d6.2 f#6.4 b6.4|g6.2 d6.2 b5.2 d6.2 g6.4 b6.4|a6.2 e6.2 c#6.2 e6.2 a6.4 c#7.4|a#6.4 f#6.4 c#7.8',
         {'harm': 'none', 'bass': 'drive', 'drum': 'intro'}),
        ('A', ['Bm', 'G', 'D', 'A', 'Bm', 'Em', 'G', 'F#'],
         'f#6.2 r.1 f#6.1 b6.2 d7.2 f#7.4 e7.2 d7.2|d7.6 b6.2 g6.4 d6.4|a6.2 r.1 a6.1 d7.2 f#7.2 a7.4 f#7.2 d7.2|e7.6 c#7.2 a6.8|'
         'b6.2 c#7.2 d7.2 f#7.2 d7.4 c#7.2 b6.2|g6.6 f#6.2 e6.4 b5.4|d6.2 g6.2 b6.2 d7.2 g7.4 d7.4|f#7.2 e7.2 c#7.2 a#6.2 f#6.8', {'harm': 'third', 'bass': 'gallop'}),
        ('B', ['G', 'A', 'F#m', 'Bm', 'Em', 'A', 'D', 'F#'],
         'b6.6 a6.2 g6.8|c#7.6 b6.2 a6.8|a6.4 c#7.4 f#7.4 c#7.4|d7.12 b6.4|'
         'e7.2 d7.2 b6.2 g6.2 e6.4 g6.4|a6.2 b6.2 c#7.2 e7.2 a7.4 e7.4|f#7.6 e7.2 d7.4 a6.4|c#7.2 r.2 c#7.2 r.2 a#6.2 c#7.2 f#7.4',
         {'harm': 'pad', 'bass': 'oct8', 'arp': True, 'drum': 'b'}),
    ], {'main': 'k.hks.hkk.hks.hk', 'b': 'k.hhs.hkkkhhs.hs', 'intro': 'k.k.k.k.s.s.ssss'}, 'k.s.k.s.ssssssss'),
    # 해저 신전 (A단조 144, 교환소): 물빛이 일렁이는 깊은 바다의 신전 — 펼친 화음 인트로, 3도 대선율과 워킹 베이스, B 는 F·G 로 올라갔다가 E7 로 돌아옴
    'g3deepsea': (144, [
        ('intro', ['Am', 'F'],
         'e5.2 a5.2 c6.2 e6.2 a6.4 g6.2 e6.2|f6.2 c6.2 a5.2 c6.2 f6.4 e6.4', {'harm': 'pad', 'bass': 'half', 'drum': 'intro'}),
        ('A', ['Am', 'Dm', 'G', 'C', 'F', 'Dm', 'E', 'E7'],
         'a5.4 c6.2 e6.2 a6.6 g6.2|f6.4 e6.2 d6.2 a5.8|b5.2 d6.2 g6.4 d6.2 b5.2 g5.4|c6.6 e6.2 g6.8|'
         'a6.4 g6.2 f6.2 c6.4 f6.4|d6.2 e6.2 f6.2 a6.2 d7.4 c7.2 a6.2|b6.6 g#6.2 e6.4 b5.4|d6.2 e6.2 g#6.2 b6.2 e7.8', {'harm': 'third', 'bass': 'walk'}),
        ('B', ['F', 'G', 'Em', 'Am', 'Dm', 'E', 'Am', 'E7'],
         'c7.6 a6.2 f6.8|d7.6 b6.2 g6.8|g6.4 b6.4 e7.4 b6.4|a6.12 e6.4|'
         'f6.2 e6.2 d6.2 a5.2 d6.4 f6.4|g#6.2 a6.2 b6.2 e7.2 g#7.4 e7.4|a6.6 b6.2 c7.4 e7.4|d7.2 r.2 d7.2 r.2 b6.2 g#6.2 e6.4',
         {'harm': 'pad', 'bass': 'oct8', 'arp': True, 'drum': 'b'}),
    ], {'main': 'k...h.h.s..kh.h.', 'b': 'k.h.s.h.k.hhs.hs', 'intro': 'k.......s.......'}, 'k.s.k.s.s.ssssss'),
    # 구름 위 탑 (Eb장조 168, 교환소): 구름 바다 위 높은 탑의 결전 — 솟구치는 영웅적 장조, 갤럽 베이스, B 는 Fm·Bb7 로 조였다가 다시 Eb 로
    'g3skypillar': (168, [
        ('intro', ['Eb', 'Bb'],
         'eb5.2 g5.2 bb5.2 eb6.2 g6.4 bb6.4|bb5.2 d6.2 f6.2 bb6.2 d7.8', {'harm': 'none', 'bass': 'drive', 'drum': 'intro'}),
        ('A', ['Eb', 'Cm', 'Ab', 'Bb', 'Eb', 'Gm', 'Ab', 'Bb7'],
         'g6.4 bb6.2 g6.2 eb6.4 bb5.4|c6.2 d6.2 eb6.2 g6.2 c7.8|c7.6 bb6.2 ab6.4 eb6.4|f6.6 g6.2 f6.4 d6.4|'
         'eb6.2 f6.2 g6.2 bb6.2 eb7.4 d7.2 bb6.2|d7.6 bb6.2 g6.4 d6.4|eb6.2 f6.2 ab6.2 c7.2 eb7.4 c7.4|d7.2 c7.2 bb6.2 ab6.2 f6.8', {'harm': 'third', 'bass': 'gallop'}),
        ('B', ['Ab', 'Bb', 'Gm', 'Cm', 'Fm', 'Bb', 'Eb', 'Bb7'],
         'ab6.6 bb6.2 c7.8|bb6.6 c7.2 d7.8|d7.4 bb6.4 g6.4 bb6.4|c7.12 g6.4|'
         'ab6.2 g6.2 f6.2 c6.2 f6.4 ab6.4|bb6.2 c7.2 d7.2 f7.2 bb7.4 f7.4|g7.6 f7.2 eb7.4 bb6.4|ab6.2 r.2 ab6.2 r.2 f6.2 d6.2 bb5.4',
         {'harm': 'stab', 'bass': 'drive', 'arp': True, 'drum': 'b'}),
    ], {'main': 'k.hks.hkk.hks.hk', 'b': 'kkhks.hkk.hks.ss', 'intro': 'k.k.k.k.s.s.ssss'}, 'k.s.k.s.ssssssss'),
    # 네온 시티 (G단조 172, 교환소): 밤거리 네온 아래 승부 — 끊어 치는 리듬 인트로, 엇박 베이스, B 는 Eb·F 로 열렸다가 D7 반복 찌르기
    'g3neon': (172, [
        ('intro', ['Gm', 'Gm', 'Eb', 'D7'],
         'g5.1 r.1 g5.1 r.1 bb5.2 d6.2 r.2 g6.2 f6.2 d6.2|g5.1 r.1 g5.1 r.1 bb5.2 d6.2 r.2 bb6.2 a6.2 g6.2|eb6.4 g6.4 bb6.4 g6.4|f#6.2 a6.2 c7.2 d7.2 f#7.8',
         {'harm': 'none', 'bass': 'synco', 'drum': 'intro'}),
        ('A', ['Gm', 'Eb', 'Cm', 'D', 'Gm', 'Bb', 'Cm', 'D7'],
         'g6.2 r.1 g6.1 bb6.2 d7.2 g7.4 f7.2 d7.2|eb7.4 d7.2 bb6.2 g6.4 eb6.4|c6.2 r.1 c6.1 eb6.2 g6.2 c7.4 bb6.2 g6.2|a6.6 f#6.2 d6.4 a5.4|'
         'bb6.2 a6.2 g6.2 d6.2 g6.4 bb6.4|d7.6 c7.2 bb6.4 f6.4|eb6.2 g6.2 c7.2 eb7.2 g7.4 eb7.4|f#7.2 e7.2 d7.2 c7.2 a6.8', {'harm': 'third', 'bass': 'synco'}),
        ('B', ['Eb', 'F', 'Dm', 'Gm', 'Cm', 'D', 'Gm', 'D7'],
         'g6.6 bb6.2 eb7.8|a6.6 c7.2 f7.8|f7.4 d7.4 a6.4 d7.4|bb6.12 g6.4|'
         'eb7.2 d7.2 c7.2 g6.2 c7.4 eb7.4|f#7.2 e7.2 d7.2 a6.2 d7.4 f#7.4|g7.6 f7.2 d7.4 bb6.4|c7.2 r.2 c7.2 r.2 a6.2 f#6.2 d6.4',
         {'harm': 'stab', 'bass': 'drive', 'arp': True, 'drum': 'b'}),
    ], {'main': 'k.hks.hk.khks.hk', 'b': 'kkhks.hkk.hks.ss', 'intro': 'k..hs..hk..hs.ss'}, 'k.s.k.s.ssssssss'),
    # 솜사탕 꿈나라 (G장조 136, 교환소): 몽글몽글 꿈속 산책 — 장7화음 인트로, 3도 대선율·워킹 베이스, B 는 Em·Am7 로 살짝 아련하게
    'g3yume': (136, [
        ('intro', ['Gmaj7', 'Cmaj7'],
         'd6.2 b5.2 g5.2 b5.2 d6.4 f#6.4|e6.2 c6.2 g5.2 c6.2 e6.4 b6.4', {'harm': 'pad', 'bass': 'half', 'drum': 'intro'}),
        ('A', ['G', 'Em7', 'Cmaj7', 'D', 'G', 'Bm', 'C', 'D7'],
         'b5.4 d6.2 g6.2 b6.6 a6.2|g6.4 f#6.2 e6.2 b5.8|c6.2 e6.2 g6.4 b6.2 a6.2 g6.4|f#6.6 e6.2 d6.4 a5.4|'
         'g6.2 a6.2 b6.2 d7.2 g7.4 f#7.2 d7.2|f#7.6 d7.2 b6.4 f#6.4|e6.2 g6.2 c7.2 e7.2 g7.4 e7.4|f#7.2 e7.2 d7.2 c7.2 a6.8', {'harm': 'third', 'bass': 'walk'}),
        ('B', ['Em', 'Cmaj7', 'G', 'D', 'Am7', 'D', 'G', 'D7'],
         'b6.6 g6.2 e6.8|e7.6 c7.2 g6.8|g6.4 b6.4 d7.4 b6.4|a6.12 f#6.4|'
         'c7.2 b6.2 a6.2 e6.2 a6.4 c7.4|d7.2 e7.2 f#7.2 a7.2 d7.4 a6.4|b6.6 c7.2 d7.4 g7.4|c7.2 r.2 c7.2 r.2 a6.2 f#6.2 d6.4',
         {'harm': 'pad', 'bass': 'half', 'arp': True, 'drum': 'b'}),
    ], {'main': 'k...h.h.s...h.h.', 'b': 'k.h.s.h.k.h.s.hh', 'intro': 'k.......s...s.s.'}, 'k...h.h.s.h.s.ss'),
    # 한밤의 하트 (C단조 148, 교환소): 귀엽고도 어두운 오르골 — 반음 끌림(Ab→G), 옥타브 베이스, B 는 Ab·Bb 로 열렸다가 G7 로 조임
    'g3yami': (148, [
        ('intro', ['Cm', 'G7'],
         'c6.2 eb6.2 g6.2 c7.2 eb7.4 d7.2 c7.2|b6.2 d7.2 f7.2 g7.2 b6.8', {'harm': 'none', 'bass': 'half', 'drum': 'intro'}),
        ('A', ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Eb', 'Fm', 'G7'],
         'g6.4 eb6.2 g6.2 c7.6 b6.2|c7.4 bb6.2 ab6.2 eb6.8|f6.2 ab6.2 c7.4 ab6.2 g6.2 f6.4|g6.6 ab6.2 g6.4 d6.4|'
         'eb6.2 d6.2 c6.2 g5.2 c6.4 eb6.4|g6.6 f6.2 eb6.4 bb5.4|ab6.2 g6.2 f6.2 c6.2 f6.4 ab6.4|b6.2 c7.2 d7.2 f7.2 g7.8', {'harm': 'third', 'bass': 'oct8'}),
        ('B', ['Ab', 'Bb', 'Gm', 'Cm', 'Fm', 'G', 'Cm', 'G7'],
         'eb7.6 c7.2 ab6.8|d7.6 bb6.2 f6.8|g6.4 bb6.4 d7.4 bb6.4|c7.12 g6.4|'
         'c7.2 bb6.2 ab6.2 f6.2 c7.4 ab6.4|b6.2 c7.2 d7.2 g7.2 b7.4 g7.4|eb7.6 d7.2 c7.4 g6.4|f7.2 r.2 f7.2 r.2 d7.2 b6.2 g6.4',
         {'harm': 'stab', 'bass': 'drive', 'arp': True, 'drum': 'b'}),
    ], {'main': 'k..hs.h.k..hs.h.', 'b': 'k.hhs.hkk.hhs.hs', 'intro': 'k.......k...s...'}, 'k.s.k.s.s.ssssss'),
    # 분홍 처방전 (A단조 164, 교환소): 달콤씁쓸한 분홍 팝 — C 장조로 밝게 시작해 Am·Em 으로 기우는 A, B 는 F·G 로 솟았다가 E7 로
    'g3menhera': (164, [
        ('intro', ['Am', 'E7'],
         'a5.2 c6.2 e6.2 a6.2 c7.4 b6.2 a6.2|g#6.2 b6.2 d7.2 e7.2 g#6.8', {'harm': 'pad', 'bass': 'drive', 'drum': 'intro'}),
        ('A', ['C', 'G', 'Am', 'Em', 'F', 'C', 'Dm', 'E7'],
         'e6.4 g6.2 e6.2 c6.6 d6.2|d6.4 b5.2 d6.2 g6.8|a6.2 g6.2 e6.2 c6.2 e6.4 a6.4|g6.6 f#6.2 e6.4 b5.4|'
         'a6.2 c7.2 f7.4 c7.2 a6.2 f6.4|g6.6 e6.2 c6.4 g5.4|f6.2 e6.2 d6.2 a5.2 d6.4 f6.4|g#6.2 a6.2 b6.2 d7.2 e7.8', {'harm': 'third', 'bass': 'synco'}),
        ('B', ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'E7'],
         'c7.6 a6.2 f6.8|d7.6 b6.2 g6.8|b6.4 g6.4 e6.4 g6.4|a6.12 e6.4|'
         'd7.2 c7.2 a6.2 f6.2 a6.4 d7.4|b6.2 c7.2 d7.2 g7.2 b7.4 g7.4|g7.6 e7.2 c7.4 g6.4|d7.2 r.2 d7.2 r.2 b6.2 g#6.2 e6.4',
         {'harm': 'stab', 'bass': 'oct8', 'arp': True, 'drum': 'b'}),
    ], {'main': 'k.hks.hkk.hks.h.', 'b': 'kkhks.hkk.hks.ss', 'intro': 'k.k.k.k.s.s.ssss'}, 'k.s.k.s.ssssssss'),
}
for k, (bpm, secs, *dr) in NEW.items():
    print(consonance(k, secs))
    SONGS[k] = song2(bpm, secs, dr[0] if dr else DR, dr[1] if dr else DR_FILL)

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '../src/gen/chip-gen3.json')
    for k, v in SONGS.items():
        n = len(v['lead']); assert all(len(v[c]) == n for c in ('harm', 'bass', 'arp', 'drums')), k
        print(k, f"{v['bpm']}bpm", f"{n // 16}마디", f"{n * 60 / v['bpm'] / 4:.0f}초", 'intro', v['intro'])
    json.dump(SONGS, open(out, 'w'), ensure_ascii=False)
    print('→', out)
