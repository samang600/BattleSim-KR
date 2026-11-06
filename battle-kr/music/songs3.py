#!/usr/bin/env python3
"""배틀 곡 다시 쓰기 (긴장감·박진감): 트레이너 배틀 · 배틀 시설 · 중요 배틀 · 챔피언 결전 · PWT.
마을 곡 지침(밝은 장조·서정적 선율) 대신 배틀 작법을 따름:
  - 단조, 화성단음계 이끔음·감7·나폴리(bII) 화음, 반음 하행 베이스
  - 쉬지 않는 반주: 베이스 16분 페달, 현 16분 분산화음, 첼로 질주 리듬
  - 금관·킥의 3-3-2 엇박, 16분 하이햇, 단락 사이 팀파니·스네어 롤
  - 형식: 인트로 → A(주제) → B(조이는 구간: 긴 음·반음 하행) → C(리듬 돌파) → A′(총주, 상승 런)
사용: python3 songs3.py [곡 ...] → out/<이름>.mp3, out/loops.json"""
import os, sys, json, random
from songkit import Song, per_bar, voicing, chord, midi, build, S16, TPQ
from songs import (TPT_SUS, TPT_STAC, VLN_SUS, VLN_TREM, VLN_SPIC, VLA_SPIC, VC_SPIC, VC_SUS, TBN_SUS, TBN_STAC, TUBA_STAC,
                   SNARE, HAT, CRASH, TIMP, KICK, SBASS, LEAD, ROOM, HALL, mel, drums, crash, bass, arp16, stabs, pad, roll, OUT)
from songs2 import PIANO

random.seed(37)
K332 = 'x..x..x.x..x..x.'

def pedal16(song, key, bar0, chords, low, vel=100, pat=(0, 0, 12, 0)):
    """16분 페달: 화음 베이스음을 계속 두드리고 옥타브로 튕김"""
    for b, s0, ln, ch in per_bar(chords):
        _, bpc = chord(ch); r = low + ((bpc - low) % 12)
        for i in range(s0, s0 + ln):
            song.add(key, song.t(bar0 + b, i), S16 * 0.8, r + pat[i % len(pat)], vel - (0 if i % 4 == 0 else 14) + random.randint(-3, 3))

def section(s, kind, b0, ch, m, piano=False):
    """단락 종류별 배틀 반주"""
    n = len(ch)
    crash(s, b0); s.add('timp', s.t(b0), S16 * 4, 40 + (chord(ch[0][0])[1] - 40) % 12, 118)
    if kind in ('A', 'D'):
        mel(s, 'tpt_sus', b0, m, vel=104); mel(s, 'vln_sus', b0, m, vel=86)
        if kind == 'D': mel(s, 'tbn_sus', b0, m, vel=90, transpose=-12)
        pedal16(s, 'sbass', b0, ch, 28)
        bass(s, 'vc_spic', b0, ch, 'gallop', low=40)
        arp16(s, 'piano' if piano else 'vla_spic', b0, ch, 57, 76, vel=84, pattern=(3, 2, 0, 2) if piano else (0, 2, 1, 2, 0, 3, 1, 2))
        if piano: arp16(s, 'vla_spic', b0, ch, 55, 72, vel=70, pattern=(0, 1, 2, 1))
        stabs(s, 'tbn_stac', b0, ch, [0, 3, 6, 8, 11, 14], 46, 62, vel=92)
        drums(s, b0, n, {'K': K332, 'S': '....x.......x...', 'H': 'xoxoxoxoxoxoxoxo'})
    elif kind == 'B':
        mel(s, 'vln_sus', b0, m, vel=100); mel(s, 'vc_sus', b0, m, vel=80, transpose=-12)
        pad(s, 'tbn_sus', b0, ch, 43, 58, vel=84)
        pad(s, 'vln_trem', b0, ch, 60, 74, vel=72)
        pedal16(s, 'sbass', b0, ch, 28, vel=92, pat=(0, 0, 0, 12))
        arp16(s, 'piano' if piano else 'vla_spic', b0, ch, 57, 76, vel=80, pattern=(0, 1, 2, 3, 2, 1))
        for b in range(n): s.add('timp', s.t(b0 + b, 8), S16 * 2, 40 + (chord(ch[b][0])[1] - 40) % 12, 92)
        drums(s, b0, n - 1, {'K': 'x......xx.......', 'S': '........x.......', 'H': 'x.xxx.xxx.xxx.xx'})
        drums(s, b0 + n - 1, 1, {'K': 'x.......', 'H': 'x.x.x.x.'})
        roll(s, b0 + n - 1, 40, 118, 8, 16)
    else:   # C: 리듬 돌파
        mel(s, 'tpt_sus', b0, m, vel=100); mel(s, 'vln_spic', b0, m, vel=96)
        pad(s, 'tbn_sus', b0, ch, 43, 58, vel=86)
        bass(s, 'sbass', b0, ch, 'oct8', low=28)
        bass(s, 'vc_spic', b0, ch, 'gallop', low=40)
        stabs(s, 'tbn_stac', b0, ch, [0, 3, 6], 46, 62, vel=96)
        stabs(s, 'tpt_stac', b0, ch, [10, 12], 60, 72, vel=84, ln=1)
        drums(s, b0, n, {'K': K332, 'S': '....x..x....x.xx', 'H': 'x.x.x.x.x.x.x.x.'})
        for b in range(0, n, 2): s.add('timp', s.t(b0 + b, 12), S16 * 2, 40 + (chord(ch[b][0])[1] - 40) % 12, 100)

def setup(s, piano=False, lead_synth=False):
    if piano: s.use(PIANO(), -24, 0.2, 0.4, [HALL(20, 1.8)])
    s.use(TPT_SUS(), -21, -0.05, 0.2, [HALL(22, 1.8)])
    s.use(TPT_STAC(), -27, 0.25, 0.3, [HALL(20, 1.6)])
    s.use(VLN_SUS(), -24, -0.3, 0.35, [HALL(26, 2.2)])
    s.use(VLN_TREM(), -29, -0.35, 0.35, [HALL(26, 2.2)])
    s.use(VLN_SPIC(), -25, -0.35, 0.3, [HALL(20, 1.6)])
    s.use(VLA_SPIC(), -27, 0.3, 0.3, [HALL(18, 1.6)])
    s.use(VC_SUS(), -26, 0.15, 0.25, [HALL(24, 2.0)])
    s.use(VC_SPIC(), -26, 0.15, 0.25, [ROOM(15, 1.2)])
    s.use(TBN_SUS(), -26, -0.15, 0.3, [HALL(22, 2.0)])
    s.use(TBN_STAC(), -26, -0.2, 0.3, [HALL(20, 1.8)])
    s.use(TUBA_STAC(), -27, 0.0, 0.2, [HALL(18, 1.8)])
    s.use(SBASS(), -23, 0.0, 0.1)
    s.use(KICK(), -25, 0.0, 0.1)
    s.use(SNARE(), -26, -0.05, 0.2, [ROOM(16, 1.0)])
    s.use(HAT(), -30, 0.25, 0.15, [ROOM(10, 0.8)])
    s.use(CRASH(), -30, -0.2, 0.3)
    s.use(TIMP(), -26, 0.0, 0.2, [HALL(20, 2.2)])

def body(s, b0, secs, piano=False):
    for kind, ch, m in secs:
        section(s, kind, b0, ch, m, piano); b0 += len(ch)
    return b0

def run_intro(s, key, bar, notes, vel=96):
    """16분 하행/상행 런 (음 이름 목록)"""
    for i, nm in enumerate(notes):
        s.add(key, s.t(bar + i // 16, i % 16), S16 * 0.9, midi(nm), vel + (8 if i % 4 == 0 else 0))

def tutti_hits(s, bar, at, ch, low=45, high=64):
    for i in at:
        for p in voicing(ch, low, high, 4): s.add('tbn_stac', s.t(bar, i), S16 * 2, p, 112)
        _, bpc = chord(ch); s.add('sbass', s.t(bar, i), S16 * 1.5, 28 + (bpc - 28) % 12, 110)
        s.add('timp', s.t(bar, i), S16 * 2, 40 + (bpc - 40) % 12, 105)

CHROM = 'C C# D D# E F F# G G# A A# B'.split()
def chrom_down(top, n):
    m = midi(top); return [CHROM[(m - i) % 12] + str((m - i) // 12 - 1) for i in range(n)]


# ═════════════ 트레이너 배틀 — E단조 178 ═════════════
def song_battle():
    s = Song('battle', 178, 36, intro_bars=4); setup(s)
    # 인트로: 2마디 반음계 하행(바이올린·비올라 옥타브) + 팀파니 롤 → Em 3-3-2 강타 → 금관 상행으로 본문에
    run_intro(s, 'vln_spic', 0, chrom_down('B5', 32)); run_intro(s, 'vla_spic', 0, chrom_down('B4', 32), 90)
    for b in (0, 1):
        for i in range(0, 16, 2): s.add('timp', s.t(b, i), S16 * 2, 40, 70 + b * 20 + i * 2)
    tutti_hits(s, 2, [0, 3, 6, 8, 11, 14], 'Em'); drums(s, 2, 1, {'K': K332, 'H': 'xoxoxoxoxoxoxoxo'})
    tutti_hits(s, 3, [0, 3, 6], 'B7')
    mel(s, 'tpt_sus', 3, ['r/8 E4/1 F#4/1 G4/1 A4/1 B4/1 C5/1 D5/1 D#5/1'], vel=104)
    roll(s, 3, 50, 118, 8, 16)
    A_CH = [['Em'], ['C'], ['Am'], ['B7'], ['Em'], ['C'], ['F#m7b5'], ['B7']]
    B_CH = [['Em'], ['Em/D'], ['C#m7b5'], ['C'], ['Am'], ['F'], ['B'], ['B7']]
    C_CH = [['Am'], ['Em'], ['Am'], ['Em'], ['F'], ['C'], ['B'], ['B']]
    A_MEL = ['B4/3 E5/3 G5/4 F#5/2 E5/2 D#5/2', 'E5/12 B4/2 C5/2', 'C5/3 E5/3 A5/4 G5/2 F#5/2 E5/2', 'D#5/12 F#5/2 A5/2',
             'G5/3 F#5/3 E5/4 B4/4 E5/2', 'G5/6 E5/2 C5/4 G4/4', 'A5/4 F#5/4 C5/4 E5/4', 'D#5/2 F#5/2 A5/2 B5/2 A5/2 F#5/2 D#5/2 B4/2']
    B_MEL = ['E5/12 F#5/2 G5/2', 'B5/8 A5/4 G5/4', 'G5/12 E5/4', 'E5/8 C5/4 G4/4',
             'A4/4 C5/4 E5/4 A5/4', 'A5/6 G5/2 F5/8', 'F#5/6 D#5/2 B4/8', 'A4/4 B4/4 C5/4 D#5/4']
    C_MEL = ['~A4/3 ~C5/3 ~E5/2 ~A5/3 ~G5/3 ~E5/2', '~B4/3 ~E5/3 ~G5/2 ~B5/3 ~A5/3 ~G5/2', '~C5/3 ~E5/3 ~A5/2 ~C6/3 ~B5/3 ~A5/2', 'G5/4 F#5/4 E5/4 D#5/4',
             '~A4/3 ~C5/3 ~F5/2 ~A5/3 ~G5/3 ~F5/2', '~G4/3 ~C5/3 ~E5/2 ~G5/3 ~F5/3 ~E5/2', 'D#5/8 F#5/8', 'B5/12 r/4']
    D_MEL = A_MEL[:7] + ['B4/2 C5/2 D#5/2 E5/2 F#5/2 G5/2 A5/2 B5/2']
    body(s, 4, [('A', A_CH, A_MEL), ('B', B_CH, B_MEL), ('C', C_CH, C_MEL), ('D', A_CH, D_MEL)])
    roll(s, 35, 50, 118, 8, 16)
    return s


# ═════════════ 배틀 시설 — G단조 164 ═════════════
def song_tower():
    s = Song('tower', 164, 34, intro_bars=2); setup(s)
    # 인트로: G 페달 16분 현 오스티나토 → 딸림(D) 금관 크레셴도와 스네어 롤
    pedal16(s, 'sbass', 0, [['Gm'], ['D']], 28)
    arp16(s, 'vla_spic', 0, [['Gm'], ['D']], 55, 74, vel=88, pattern=(0, 2, 1, 2))
    drums(s, 0, 1, {'H': 'xoxoxoxoxoxoxoxo', 'K': 'x.......x.......'})
    mel(s, 'tbn_sus', 1, ['D3/16'], vel=90); mel(s, 'tpt_sus', 1, ['A4/8 C5/4 F#5/4'], vel=96)
    roll(s, 1, 40, 118)
    A_CH = [['Gm'], ['Eb'], ['F'], ['D'], ['Gm'], ['Eb'], ['Cm'], ['D7']]
    B_CH = [['Cm'], ['D'], ['Gm'], ['Eb'], ['Cm'], ['Am7b5'], ['D'], ['D7']]
    C_CH = [['Eb'], ['F'], ['Gm'], ['Gm'], ['Eb'], ['F'], ['D'], ['D']]
    A_MEL = ['D5/6 Bb4/2 G4/4 A4/2 Bb4/2', 'Eb5/6 D5/2 Bb4/8', 'C5/6 A4/2 F4/4 G4/2 A4/2', 'D5/12 C5/2 A4/2',
             'G5/6 F5/2 D5/4 Bb4/4', 'G5/4 Bb5/4 G5/4 Eb5/4', 'Eb5/4 C5/4 G4/4 C5/4', 'C5/4 D5/4 F#5/4 A5/4']
    B_MEL = ['G5/8 Eb5/8', 'F#5/6 A5/2 D5/8', 'Bb5/8 G5/4 D5/4', 'Eb5/12 G5/4',
             'C5/4 Eb5/4 G5/6 F5/2', 'Eb5/8 C5/4 A4/4', 'D5/4 F#5/4 A5/8', 'C6/4 A5/4 F#5/4 D5/4']
    C_MEL = ['~Bb4/3 ~Eb5/3 ~G5/2 ~Bb5/3 ~G5/3 ~Eb5/2', '~C5/3 ~F5/3 ~A5/2 ~C6/3 ~A5/3 ~F5/2', 'D5/4 G5/4 Bb5/8', 'A5/4 G5/4 F#5/4 G5/4',
             '~G4/3 ~Bb4/3 ~Eb5/2 ~G5/3 ~F5/3 ~Eb5/2', '~A4/3 ~C5/3 ~F5/2 ~A5/3 ~G5/3 ~F5/2', 'F#5/8 A5/8', 'D5/2 Eb5/2 F#5/2 G5/2 A5/2 Bb5/2 C6/2 D6/2']
    D_MEL = A_MEL[:7] + ['D5/2 Eb5/2 F#5/2 G5/2 A5/2 Bb5/2 C6/2 A5/2']
    body(s, 2, [('A', A_CH, A_MEL), ('B', B_CH, B_MEL), ('C', C_CH, C_MEL), ('D', A_CH, D_MEL)])
    roll(s, 33, 50, 118, 8, 16)
    return s


# ═════════════ 중요 배틀 (관장·사천왕) — F단조 180 ═════════════
def song_boss():
    s = Song('boss', 180, 36, intro_bars=4); setup(s)
    # 인트로: 저음 금관 동기 F-Ab-G-C (반음 엇갈림) ×2 + 팀파니 → C7(b9) 트레몰로 크레셴도와 3-3-2 강타
    motif = ['~F2/2 r/2 ~Ab2/2 r/2 ~G2/2 r/2 ~C2/4', '~F2/2 r/2 ~Ab2/2 r/2 ~Db3/2 r/2 ~C3/4']
    mel(s, 'tbn_stac', 0, motif, vel=110, transpose=12); mel(s, 'tuba_stac', 0, motif, vel=105)
    for b in (0, 1): s.add('timp', s.t(b), S16 * 4, 41, 112); s.add('timp', s.t(b, 12), S16 * 4, 36, 100)
    pad(s, 'vln_trem', 2, [['C7'], ['C7']], 64, 79, vel=86)
    mel(s, 'vln_sus', 2, ['Db5/16', 'Db5/8 C5/8'], vel=90)
    tutti_hits(s, 3, [0, 3, 6, 8, 11], 'C7')
    pedal16(s, 'sbass', 2, [['C7']], 28, vel=95)
    roll(s, 3, 50, 120, 12, 16)
    A_CH = [['Fm'], ['Db'], ['Eb'], ['C'], ['Fm'], ['Db'], ['Bbm'], ['C7']]
    B_CH = [['Fm'], ['Fm/E'], ['Fm/Eb'], ['Dm7b5'], ['Db'], ['Bbm'], ['Gdim7'], ['C']]
    C_CH = [['Db'], ['Eb'], ['Fm'], ['Fm'], ['Db'], ['Eb'], ['C'], ['C7']]
    A_MEL = ['C5/6 Ab4/2 F4/4 G4/2 Ab4/2', 'F5/6 Eb5/2 Db5/8', 'Eb5/6 Bb4/2 G4/4 Ab4/2 Bb4/2', 'E5/12 G4/2 C5/2',
             'F5/6 G5/2 Ab5/4 C5/4', 'Db5/4 F5/4 Ab5/8', 'Bb5/6 Ab5/2 F5/4 Db5/4', 'C5/4 E5/4 G5/4 Bb5/4']
    B_MEL = ['Ab5/12 G5/2 F5/2', 'C5/16', 'F5/8 Ab5/8', 'Ab5/12 F5/4', 'F5/6 Eb5/2 Db5/8', 'Db5/6 F5/2 Bb5/8', 'Bb5/4 G5/4 E5/4 Db5/4', 'C5/4 E5/4 G5/8']
    C_MEL = ['~F4/3 ~Ab4/3 ~Db5/2 ~F5/3 ~Eb5/3 ~Db5/2', '~G4/3 ~Bb4/3 ~Eb5/2 ~G5/3 ~F5/3 ~Eb5/2', 'F5/6 Ab5/2 C6/8', 'Bb5/4 Ab5/4 G5/4 F5/4',
             '~Ab4/3 ~Db5/3 ~F5/2 ~Ab5/3 ~F5/3 ~Db5/2', '~Bb4/3 ~Eb5/3 ~G5/2 ~Bb5/3 ~G5/3 ~Eb5/2', 'E5/8 G5/8', 'Bb5/4 G5/4 E5/4 C5/4']
    D_MEL = A_MEL[:7] + ['C5/2 Db5/2 E5/2 F5/2 G5/2 Ab5/2 Bb5/2 C6/2']
    body(s, 4, [('A', A_CH, A_MEL), ('B', B_CH, B_MEL), ('C', C_CH, C_MEL), ('D', A_CH, D_MEL)])
    bass(s, 'tuba_stac', 4, A_CH + B_CH + C_CH + A_CH, 'beats', low=29, vel=95)
    roll(s, 35, 50, 120, 8, 16)
    return s


# ═════════════ 챔피언 결전 — D단조 186, 피아노 오스티나토 ═════════════
def song_champion():
    s = Song('champion', 186, 36, intro_bars=4); setup(s, piano=True)
    # 인트로: 피아노 16분 오스티나토(Dm → Dm/C → Bbmaj7 → A7), 베이스 반음 하행, 4마디째 3-3-2 금관 강타
    osti = ['D5 A4 F4 A4', 'C5 A4 F4 A4', 'Bb4 F4 D4 F4', 'A4 E4 C#4 G4']
    for b, notes in enumerate(osti):
        ns = notes.split()
        for i in range(16): s.add('piano', s.t(b, i), S16 * 0.95, midi(ns[i % 4]), 98 + (12 if i % 4 == 0 else 0) + random.randint(-3, 3))
        s.add('sbass', s.t(b), S16 * 15, [26, 24, 22, 21][b] + 12, 100); s.add('vc_sus', s.t(b), S16 * 15, [50, 48, 46, 45][b], 95)
    pad(s, 'vln_trem', 0, [['Dm'], ['Dm/C'], ['Bb'], ['A7']], 62, 77, vel=76)
    for b in range(3): s.add('timp', s.t(b), S16 * 4, 38, 100)
    tutti_hits(s, 3, [0, 3, 6, 8, 11, 14], 'A7')
    roll(s, 3, 60, 120, 12, 16)
    A_CH = [['Dm'], ['Dm/C'], ['Bb'], ['A'], ['Dm'], ['Dm/C'], ['Gm'], ['A7']]
    B_CH = [['Dm'], ['Dm/C#'], ['Dm/C'], ['Bm7b5'], ['Bb'], ['Gm'], ['Edim7'], ['A7']]
    C_CH = [['Eb'], ['Eb'], ['Dm'], ['Dm'], ['Eb'], ['Eb'], ['Gm'], ['A']]      # 나폴리 화음(Eb)으로 조이는 구간
    A_MEL = ['A4/4 D5/4 F5/6 E5/2', 'D5/4 C5/4 A4/8', 'Bb4/4 D5/4 F5/4 G5/4', 'C#5/4 E5/4 A5/8',
             'A5/6 G5/2 F5/4 E5/4', 'F5/6 E5/2 D5/4 A4/4', 'Bb4/4 D5/4 G5/4 Bb5/4', 'A5/4 G5/4 E5/4 C#5/4']
    B_MEL = ['F5/12 E5/2 D5/2', 'A5/16', 'A5/8 F5/8', 'F5/12 D5/4', 'D5/6 F5/2 Bb5/8', 'Bb5/6 A5/2 G5/8', 'G5/4 E5/4 C#5/4 Bb4/4', 'A4/4 C#5/4 E5/4 G5/4']
    C_MEL = ['~G4/3 ~Bb4/3 ~Eb5/2 ~G5/3 ~F5/3 ~Eb5/2', 'Eb5/12 D5/4', '~F4/3 ~A4/3 ~D5/2 ~F5/3 ~E5/3 ~D5/2', 'F5/12 r/4',
             '~Bb4/3 ~Eb5/3 ~G5/2 ~Bb5/3 ~G5/3 ~Eb5/2', 'F5/6 Eb5/2 Bb4/8', 'D5/4 G5/4 Bb5/8', 'A5/16']
    D_MEL = A_MEL[:7] + ['A4/2 Bb4/2 C#5/2 D5/2 E5/2 F5/2 G5/2 A5/2']
    body(s, 4, [('A', A_CH, A_MEL), ('B', B_CH, B_MEL), ('C', C_CH, C_MEL), ('D', A_CH, D_MEL)], piano=True)
    bass(s, 'tuba_stac', 4, A_CH + B_CH + C_CH + A_CH, 'beats', low=26, vel=95)
    roll(s, 35, 50, 120, 8, 16)
    return s


# ═════════════ PWT 토너먼트 — B단조 172 (C 구간만 영웅적 장조 팡파르) ═════════════
def song_pwt():
    s = Song('pwt', 172, 34, intro_bars=2); setup(s)
    # 인트로: 단조 팡파르(B-F#-B-D 셋잇단 느낌) → F#7 에서 3-3-2 강타, 행진 스네어
    mel(s, 'tpt_stac', 0, ['~B4/2 ~B4/1 ~B4/1 ~B4/2 ~D5/2 ~F#5/2 ~F#5/1 ~F#5/1 ~F#5/2 ~B5/2'], vel=106)
    mel(s, 'tpt_sus', 1, ['A#5/8 r/8'], vel=100)
    pad(s, 'tbn_sus', 0, [['Bm']], 47, 62, vel=95)
    tutti_hits(s, 1, [8, 11, 14], 'F#7')
    pedal16(s, 'sbass', 0, [['Bm'], ['F#']], 28, vel=92)
    drums(s, 0, 1, {'S': 'x.xxx.xxx.xxx.xx', 'K': 'x.......x.......'}); roll(s, 1, 50, 118, 0, 8)
    A_CH = [['Bm'], ['G'], ['A'], ['F#'], ['Bm'], ['G'], ['Em'], ['F#7']]
    B_CH = [['G'], ['A'], ['F#m'], ['Bm'], ['Em'], ['C'], ['F#'], ['F#7']]
    C_CH = [['D'], ['A/C#'], ['Bm'], ['F#m'], ['G'], ['D/F#'], ['Em'], ['F#']]
    A_MEL = ['F#4/2 B4/2 D5/6 C#5/2 B4/4', 'D5/6 B4/2 G4/8', 'C#5/2 E5/2 A5/6 G5/2 E5/4', 'A#4/4 C#5/4 F#5/8',
             'B5/6 A5/2 F#5/4 D5/4', 'D5/4 G5/4 B5/8', 'E5/6 G5/2 B4/8', 'A#4/4 C#5/4 E5/4 F#5/4']
    B_MEL = ['B4/6 D5/2 G5/8', 'A5/6 E5/2 C#5/8', 'C#5/8 A4/8', 'F#5/12 B4/4', 'G5/6 F#5/2 E5/8', 'E5/6 G5/2 C6/8', 'A#5/8 F#5/8', 'E5/4 C#5/4 A#4/4 F#4/4']
    C_MEL = ['~A4/3 ~D5/3 ~F#5/2 ~A5/3 ~F#5/3 ~D5/2', '~E5/3 ~C#5/3 ~A4/2 ~E5/3 ~A5/3 ~E5/2', 'F#5/8 D5/8', 'C#5/12 r/4',
             '~B4/3 ~D5/3 ~G5/2 ~B5/3 ~G5/3 ~D5/2', '~A4/3 ~D5/3 ~F#5/2 ~A5/3 ~F#5/3 ~D5/2', 'G5/4 F#5/4 E5/4 D5/4', 'A#4/4 C#5/4 F#5/8']
    D_MEL = A_MEL[:7] + ['F#4/2 G4/2 A#4/2 B4/2 C#5/2 D5/2 E5/2 F#5/2']
    body(s, 2, [('A', A_CH, A_MEL), ('B', B_CH, B_MEL), ('C', C_CH, C_MEL), ('D', A_CH, D_MEL)])
    roll(s, 33, 50, 118, 8, 16)
    return s


SONGS = {'battle': song_battle, 'tower': song_tower, 'boss': song_boss, 'champion': song_champion, 'pwt': song_pwt}

if __name__ == '__main__':
    names = sys.argv[1:] or list(SONGS)
    loops_path = os.path.join(OUT, 'loops.json')
    loops = json.load(open(loops_path)) if os.path.exists(loops_path) else {}
    for n in names:
        song = SONGS[n]()
        info = build(song, OUT, rounds=1)
        loops[n] = {'start': info['loopStart'], 'end': info['loopEnd']}
        json.dump(loops, open(loops_path, 'w'), indent=1)
        print(n, f'{song.length_sec():.1f}s', info, flush=True)
