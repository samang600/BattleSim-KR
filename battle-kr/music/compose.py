#!/usr/bin/env python3
"""JRPG 타운 테마 작곡: Standard MIDI File + SoundCraft CLI 스크립트를 만든다.
구조: A(8마디) → B(8마디) → A'(8마디) → 종지 1마디, 115 BPM, 4/4, C장조, 가벼운 스윙."""
import os, random, struct

random.seed(7)
HERE = os.path.dirname(os.path.abspath(__file__))
TPQ = 480
BAR = TPQ * 4
E8 = TPQ // 2
SWING = 40          # 뒷박 8분음표를 조금 늦춰 가벼운 셔플 느낌
BPM = 115
MEL_SHIFT = -12   # 멜로디 층(플룻·글로켄슈필·바이올린)을 한 옥타브 낮춤

NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def n(name):
    """'E6', 'Bb5', 'F#4' → MIDI 번호 (C4 = 60)"""
    pc = NOTE[name[0]]
    i = 1
    if name[1] == 'b': pc -= 1; i = 2
    elif name[1] == '#': pc += 1; i = 2
    return 12 * (int(name[i:]) + 1) + pc

def swing(pos8):
    return pos8 * E8 + (SWING if pos8 % 2 == 1 else 0)

tracks = {k: [] for k in ['Flute', 'Glockenspiel', 'Violin', 'Guitar Strum', 'Guitar Arp', 'Double Bass', 'Drums']}
def add(track, start, dur, pitch, vel, ch=0):
    tracks[track].append((max(0, int(start)), max(10, int(dur)), int(pitch), max(1, min(127, int(vel))), ch))

# ── 화성 (마디마다 [(8분 위치, 코드)]) ──
CH = {
    'C': ([0, 4, 7], 0), 'G/B': ([7, 11, 2], 11), 'Am': ([9, 0, 4], 9), 'Em/G': ([4, 7, 11], 7), 'F': ([5, 9, 0], 5),
    'C/E': ([0, 4, 7], 4), 'Dm7': ([2, 5, 9, 0], 2), 'G7': ([7, 11, 2, 5], 7), 'Fmaj7': ([5, 9, 0, 4], 5), 'G/F': ([7, 11, 2], 5),
    'Em7': ([4, 7, 11, 2], 4), 'Am7': ([9, 0, 4, 7], 9), 'C7': ([0, 4, 7, 10], 0), 'Fm6': ([5, 8, 0, 2], 5),
}
A_CH = [[(0, 'C')], [(0, 'G/B')], [(0, 'Am')], [(0, 'Em/G')], [(0, 'F')], [(0, 'C/E')], [(0, 'Dm7')], [(0, 'G7')]]
B_CH = [[(0, 'Fmaj7')], [(0, 'G/F')], [(0, 'Em7')], [(0, 'Am7')], [(0, 'Dm7')], [(0, 'G7')], [(0, 'C'), (4, 'C7')], [(0, 'F'), (4, 'Fm6')]]
A2_CH = A_CH[:6] + [[(0, 'Dm7'), (4, 'G7')], [(0, 'C')]]
END_CH = [[(0, 'C')]]

# ── 멜로디 (마디마다 [(8분 위치, 길이(8분), 음)]) ──
A_MEL = [
    [(0, 1, 'G5'), (1, 1, 'C6'), (2, 2, 'E6'), (4, 1, 'D6'), (5, 1, 'C6'), (6, 2, 'G5')],
    [(0, 1, 'D6'), (1, 1, 'B5'), (2, 2, 'G5'), (4, 1, 'A5'), (5, 1, 'B5'), (6, 2, 'D6')],
    [(0, 2, 'C6'), (2, 1, 'A5'), (3, 1, 'C6'), (4, 3, 'E6'), (7, 1, 'D6')],
    [(0, 2, 'B5'), (2, 1, 'G5'), (3, 1, 'E5'), (4, 4, 'G5')],
    [(0, 1, 'A5'), (1, 1, 'C6'), (2, 2, 'F6'), (4, 1, 'E6'), (5, 1, 'D6'), (6, 2, 'C6')],
    [(0, 1, 'G5'), (1, 1, 'C6'), (2, 2, 'E6'), (4, 2, 'G6'), (6, 2, 'E6')],
    [(0, 1, 'F6'), (1, 1, 'E6'), (2, 1, 'D6'), (3, 1, 'C6'), (4, 2, 'A5'), (6, 1, 'F5'), (7, 1, 'A5')],
    [(0, 2, 'B5'), (2, 1, 'D6'), (3, 1, 'G5'), (4, 4, 'G5')],
]
B_MEL = [
    [(0, 3, 'E6'), (3, 1, 'F6'), (4, 2, 'E6'), (6, 2, 'C6')],
    [(0, 3, 'D6'), (3, 1, 'E6'), (4, 2, 'D6'), (6, 2, 'B5')],
    [(0, 2, 'B5'), (2, 2, 'D6'), (4, 3, 'G6'), (7, 1, 'F6')],
    [(0, 4, 'E6'), (4, 2, 'C6'), (6, 2, 'A5')],
    [(0, 1, 'A5'), (1, 1, 'C6'), (2, 2, 'F6'), (4, 2, 'E6'), (6, 2, 'D6')],
    [(0, 2, 'D6'), (2, 2, 'B5'), (4, 2, 'G5'), (6, 2, 'F6')],
    [(0, 3, 'E6'), (3, 1, 'G6'), (4, 2, 'E6'), (6, 2, 'Bb5')],
    [(0, 2, 'A5'), (2, 2, 'C6'), (4, 4, 'Ab5')],
]
A2_MEL = A_MEL[:6] + [
    [(0, 1, 'F6'), (1, 1, 'E6'), (2, 1, 'D6'), (3, 1, 'C6'), (4, 1, 'B5'), (5, 1, 'D6'), (6, 1, 'F6'), (7, 1, 'D6')],
    [(0, 2, 'E6'), (2, 1, 'G5'), (3, 1, 'E5'), (4, 4, 'C6')],
]

SCALE = [0, 2, 4, 5, 7, 9, 11]
def third_below(p):
    """C장조 안에서 3도 아래 (바이올린 화음). 음계 밖의 음(Bb, Ab)은 단3도 아래"""
    pc = p % 12
    if pc not in SCALE: return p - 3
    i = SCALE.index(pc)
    j = (i - 2) % 7
    down = (pc - SCALE[j]) % 12
    return p - down

def voicing(chord):
    pcs, bass = CH[chord]
    low = 40 + ((bass - 40) % 12)          # E2(40) ~ D#3
    if low > 50: low -= 12
    notes = [low + 12]                      # 기타 최저음은 한 옥타브 위 (E3 부근)
    p = notes[0]
    for pc in pcs + pcs[:1]:
        p += 1
        while p % 12 != pc: p += 1
        if p > 64: break   # 멜로디와 겹치지 않게 기타 음역을 E4 아래로
        notes.append(p)
    return sorted(set(notes))[:5]

def section(bar0, chords, mel, kind, drums_from=None):
    for b, (bar_ch, bar_mel) in enumerate(zip(chords, mel)):
        t0 = (bar0 + b) * BAR
        # 플룻
        for pos, ln, nm in bar_mel:
            p = n(nm) + MEL_SHIFT
            on = t0 + swing(pos)
            legato = 0.92 if kind == 'B' else (0.85 if ln >= 2 else 0.55)   # A: 스타카토로 통통 튀게
            vel = (96 if pos % 2 == 0 else 82) + random.randint(-4, 4) + (6 if pos == 0 else 0)
            add('Flute', on, ln * E8 * legato, p, vel)
            if kind == 'B':
                add('Glockenspiel', on, E8 * 0.9, p + 12, 72 + random.randint(-3, 3))     # 반짝이는 옥타브 더블링
                vp = p if b < 4 else third_below(p)                                         # 1~4 유니즌, 5~8 3도 아래 화음
                add('Violin', on, ln * E8 * 0.98, vp, 78 if b < 4 else 74)
        # 코드 구간
        segs = [(pos, ch) for pos, ch in bar_ch]
        for si, (pos, ch) in enumerate(segs):
            end = segs[si + 1][0] if si + 1 < len(segs) else 8
            v = voicing(ch)
            if kind == 'B':
                order = [0, 2, 1, 3, 2, 4, 3, 2]
                for k in range(pos, end):
                    idx = order[k] if order[k] < len(v) else len(v) - 1
                    add('Guitar Arp', t0 + swing(k), 560, v[idx], 72 + (8 if k % 2 == 0 else 0) + random.randint(-3, 3))
            else:
                # 8분 스트로크: D . (chuck) U D U (chuck) U — 2·4박은 퍼커시브 커팅
                pattern = {0: ('D', 92, 210), 2: ('X', 58, 45), 3: ('U', 64, 150), 4: ('D', 84, 210), 5: ('U', 60, 140), 6: ('X', 58, 45), 7: ('U', 64, 150)}
                for k in range(pos, end):
                    if k not in pattern: continue
                    d, vel, ln = pattern[k]
                    notes = v if d in 'DX' else v[-3:][::-1]
                    for j, p in enumerate(notes):
                        add('Guitar Strum', t0 + swing(k) + j * 11, ln, p, vel - j * 2 + random.randint(-3, 3))
            # 콘트라베이스 피치카토: 1박 근음(슬래시는 베이스음), 3박 5도 (코드가 바뀌면 새 근음)
            pcs, bass = CH[ch]
            root = 36 + ((bass - 36) % 12)
            if root > 47: root -= 12
            add('Double Bass', t0 + pos * E8, 330, root, 98 + random.randint(-3, 3))
            if end - pos >= 8:
                fifth = 36 + ((pcs[0] + 7 - 36) % 12)
                if abs(fifth - root) > 7: fifth -= 12 if fifth > root else -12
                add('Double Bass', t0 + 4 * E8, 330, fifth, 86 + random.randint(-3, 3))
        # 드럼 (A·A' 는 5마디째부터, B 는 계속)
        if drums_from is not None and b >= drums_from:
            for k in range(8):
                add('Drums', t0 + swing(k), 60, 42, (52 if k % 2 == 0 else 34) + random.randint(-3, 3), 9)   # 가벼운 하이햇
            for k in (0, 4):
                add('Drums', t0 + k * E8, 120, 36, 92 if k == 0 else 80, 9)                                   # 정갈한 킥
            for k in (2, 6):
                add('Drums', t0 + k * E8, 120, 38, 56 + random.randint(-3, 3), 9)                             # 브러시 느낌 스네어
            if kind == 'B' and b == 0:
                add('Drums', t0, 400, 49, 58, 9)                                                               # B 시작 살짝 크래시
            if kind == 'A' and b == 7:
                add('Drums', t0 + 7 * E8, 60, 38, 42, 9); add('Drums', t0 + 7 * E8 + 120, 60, 38, 52, 9)  # B 로 넘어가는 아주 짧은 픽업

section(0, A_CH, A_MEL, 'A', drums_from=4)
section(8, B_CH, B_MEL, 'B', drums_from=0)
section(16, A2_CH, A2_MEL, 'A2', drums_from=4)
# 종지: 1박에 모두 함께 C
t0 = 24 * BAR
add('Flute', t0, E8 * 2, n('C6') + MEL_SHIFT, 92)
for j, p in enumerate(voicing('C')): add('Guitar Strum', t0 + j * 14, 900, p, 88 - j * 2)
add('Double Bass', t0, 700, 36, 100)
add('Drums', t0, 200, 36, 96, 9); add('Drums', t0, 1500, 49, 70, 9)

# ── SMF 쓰기 ──
def vlq(x):
    out = [x & 0x7F]; x >>= 7
    while x: out.append(0x80 | (x & 0x7F)); x >>= 7
    return bytes(reversed(out))
def chunk(events, name):
    data = bytearray(b'\x00\xff\x03' + vlq(len(name.encode())) + name.encode())
    evs = []
    for s, d, p, v, ch in events:
        evs.append((s, 1, bytes([0x90 | ch, p, v])))
        evs.append((s + d, 0, bytes([0x80 | ch, p, 0])))
    evs.sort(key=lambda e: (e[0], e[1]))
    last = 0
    for t, _, msg in evs:
        data += vlq(t - last) + msg; last = t
    data += b'\x00\xff\x2f\x00'
    return b'MTrk' + struct.pack('>I', len(data)) + bytes(data)
tempo = int(60_000_000 / BPM)
cond =b'\x00\xff\x51\x03' + tempo.to_bytes(3, 'big') + b'\x00\xff\x58\x04\x04\x02\x18\x08' + b'\x00\xff\x2f\x00'
order = ['Flute', 'Glockenspiel', 'Violin', 'Guitar Strum', 'Guitar Arp', 'Double Bass', 'Drums']
smf = b'MThd' + struct.pack('>IHHH', 6, 1, len(order) + 1, TPQ) + b'MTrk' + struct.pack('>I', len(cond)) + cond
for name in order: smf += chunk(tracks[name], name)
mid = os.path.join(HERE, 'town_theme.mid')
open(mid, 'wb').write(smf)
print('notes:', {k: len(v) for k, v in tracks.items()}, 'bars: 25', f'{25 * 4 * 60 / BPM:.1f}s')
