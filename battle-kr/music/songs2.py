#!/usr/bin/env python3
"""추가 배경음악 3곡: 승리 · PWT(토너먼트) · 챔피언 결전.
사용: python3 songs2.py [곡 이름 ...]   → out/<이름>.mp3, out/loops.json 에 루프 지점 추가"""
import os, sys, json, random, re
from songkit import Song, Sampled, Hit, Synth, per_bar, voicing, chord, midi, build, S16, TPQ
from songs import (P, FLUTE_SUS, GLOCK, HARP, DB_PIZZ, VLN_SUS, VLN_SPIC, VLN_TREM, VLA_SPIC, VC_SPIC, VC_SUS, TPT_SUS, TPT_STAC,
                   TBN_SUS, TBN_STAC, TUBA_STAC, SNARE_SOFT, SNARE, HAT, CRASH, TIMP, KICK, SBASS, GTR, PLATE, ROOM, HALL,
                   mel, drums, crash, bass, arp16, stabs, pad, roll, ROCK, ROCK16, OUT)

random.seed(23)
# 업라이트 피아노: 파일 번호 n → 건반 21+2n (MappingChart.txt)
PIANO = lambda: Sampled('piano', 'vsco', 'Keys/Upright Piano', r'Player_dyn2_rr1_\d+\.wav$', P(play_mode=0, attack=0.5, decay=2500, sustain=40, release=400, velocity=60),
                        pitch_of=lambda f: 21 + 2 * int(re.search(r'_(\d+)\.wav$', f).group(1)))


# ═════════════ 승리 — C장조 132 BPM: 2마디 팡파르 → 16마디 반복 ═════════════
def song_victory():
    s = Song('victory', 132, 18, intro_bars=2)
    s.use(TPT_SUS(), -21, 0.0, 0.2, [HALL(22, 1.8)])
    s.use(TPT_STAC(), -24, 0.1, 0.25, [HALL(20, 1.6)])
    s.use(FLUTE_SUS(), -22, 0.1, 0.3, [ROOM(22, 1.5)])
    s.use(VLN_SUS(), -25, -0.3, 0.35, [HALL(24, 2.0)])
    s.use(GLOCK(), -29, 0.35, 0.3, [PLATE(24, 2.0)])
    s.use(HARP(), -27, -0.25, 0.4, [ROOM(22, 1.6)])
    s.use(TBN_SUS(), -28, -0.15, 0.3, [HALL(22, 2.0)])
    s.use(DB_PIZZ(), -25, 0.0, 0.15)
    s.use(KICK(), -30, 0.0, 0.1, [ROOM(12, 0.9)])
    s.use(SNARE_SOFT(), -30, -0.05, 0.2, [ROOM(14, 0.9)])
    s.use(HAT(), -34, 0.25, 0.15, [ROOM(10, 0.8)])
    s.use(CRASH(), -32, -0.2, 0.3)
    s.use(TIMP(), -29, 0.0, 0.2, [HALL(18, 2.0)])
    # 팡파르: C→F | Bb→C (bVII–I 로 힘 있게 닫음)
    IN_CH = [['C', 'F'], ['Bb', 'C']]
    mel(s, 'tpt_stac', 0, ['~G4/2 ~C5/2 ~E5/2 ~G5/2 F5/4 A5/4', 'F5/4 D5/4 E5/8'], vel=104)
    mel(s, 'tpt_sus', 0, ['r/8 F5/4 A5/4', 'F5/4 D5/4 E5/8'], vel=98)
    pad(s, 'tbn_sus', 0, IN_CH, 48, 64, vel=92)
    for b in (0, 1): s.add('timp', s.t(b), S16 * 4, 48, 105)
    roll(s, 0, 40, 90, 0, 8); crash(s, 1, 95)
    A_CH = [['C'], ['G/B'], ['Am'], ['Em/G'], ['F'], ['C/E'], ['Dm7', 'G'], ['C']]
    B_CH = [['F'], ['G'], ['Em7'], ['Am'], ['Dm7'], ['E7'], ['F', 'G'], ['C']]
    A_MEL = ['G4/2 C5/2 E5/4 D5/2 C5/2 D5/4', 'D5/6 B4/2 G4/8', 'A4/2 C5/2 E5/4 D5/2 C5/2 E5/4', 'G5/6 E5/2 B4/8',
             'A4/4 C5/4 F5/6 E5/2', 'E5/4 C5/4 G4/8', 'F4/2 A4/2 C5/2 D5/2 B4/4 D5/4', 'C5/12 r/4']
    B_MEL = ['C5/4 F5/4 A5/6 G5/2', 'G5/4 D5/4 B4/8', 'B4/2 D5/2 E5/4 G5/4 E5/4', 'C5/6 B4/2 A4/8',
             'D5/4 F5/4 A5/6 G5/2', 'G#5/6 E5/2 B4/4 D5/4', 'C5/2 A4/2 F4/2 A4/2 B4/2 D5/2 G5/4', 'E5/4 D5/4 C5/8']
    mel(s, 'flute_sus', 2, A_MEL, vel=96); mel(s, 'vln_sus', 2, A_MEL, vel=78, transpose=-12)
    mel(s, 'tpt_sus', 10, B_MEL, vel=96); mel(s, 'vln_sus', 10, B_MEL, vel=84); mel(s, 'glock', 10, B_MEL, vel=80)
    crash(s, 2, 85); crash(s, 10, 90)
    allch = A_CH + B_CH
    arp16(s, 'harp', 2, allch, 55, 74, vel=72, pattern=(0, 1, 2, 3, 2, 1, 2, 3))
    bass(s, 'db_pizz', 2, allch, 'beats', low=36, vel=100)
    pad(s, 'tbn_sus', 10, B_CH, 48, 62, vel=72)
    stabs(s, 'tpt_stac', 2, A_CH, [6, 14], 60, 72, vel=74, ln=1)
    drums(s, 2, 16, {'K': 'x.......x.......', 'S': '....x.......x...', 'H': 'x.o.x.o.x.o.x.o.'})
    roll(s, 17, 40, 90, 12, 16)
    return s


# ═════════════ PWT 토너먼트 — Bb장조 160 BPM: 축제 행진 ═════════════
def song_pwt():
    s = Song('pwt', 160, 34, intro_bars=2)
    s.use(TPT_SUS(), -21, -0.05, 0.2, [HALL(22, 1.8)])
    s.use(TPT_STAC(), -26, 0.25, 0.3, [HALL(20, 1.6)])
    s.use(VLN_SUS(), -24, -0.3, 0.35, [HALL(26, 2.2)])
    s.use(VLN_SPIC(), -24, -0.35, 0.3, [HALL(20, 1.6)])
    s.use(VLA_SPIC(), -28, 0.3, 0.3, [HALL(18, 1.6)])
    s.use(VC_SPIC(), -27, 0.15, 0.25, [ROOM(15, 1.2)])
    s.use(TBN_SUS(), -27, -0.15, 0.3, [HALL(22, 2.0)])
    s.use(TBN_STAC(), -27, 0.2, 0.3, [HALL(20, 1.8)])
    s.use(GLOCK(), -30, 0.35, 0.3, [PLATE(24, 2.0)])
    s.use(SBASS(), -23, 0.0, 0.1)
    s.use(GTR(), -30, -0.3, 0.3, [ROOM(15, 1.0)])
    s.use(KICK(), -26, 0.0, 0.1)
    s.use(SNARE(), -26, -0.05, 0.2, [ROOM(16, 1.0)])
    s.use(HAT(), -31, 0.25, 0.15, [ROOM(10, 0.8)])
    s.use(CRASH(), -30, -0.2, 0.3)
    s.use(TIMP(), -29, 0.0, 0.2, [HALL(18, 2.0)])
    # 인트로: 금관 셋잇단 느낌 반복음 → F7 (딸림화음)에서 멈춤, 행진 스네어
    mel(s, 'tpt_stac', 0, ['~Bb4/2 ~Bb4/1 ~Bb4/1 ~Bb4/2 ~D5/2 ~F5/2 ~F5/1 ~F5/1 ~F5/2 ~Bb5/2', 'A5/8 ~F5/2 ~Eb5/2 ~C5/2 ~A4/2'], vel=104)
    pad(s, 'tbn_sus', 0, [['Bb'], ['F7']], 46, 62, vel=95)
    s.add('sbass', s.t(0), S16 * 15, 34, 100); s.add('sbass', s.t(1), S16 * 15, 29, 100)
    drums(s, 0, 2, {'S': 'x.xxx.xxx.xxx.xx', 'K': 'x.......x.......'})
    A_CH = [['Bb'], ['F/A'], ['Gm'], ['Eb'], ['Cm7'], ['F'], ['Bb', 'Eb'], ['F']]
    B_CH = [['Gm'], ['Eb'], ['Bb'], ['F'], ['Gm'], ['Eb'], ['C'], ['F']]
    C_CH = [['Eb'], ['F'], ['Dm'], ['Gm'], ['Cm7'], ['F'], ['Eb', 'F'], ['F7']]
    A_MEL = ['F4/2 Bb4/2 D5/6 C5/2 Bb4/4', 'C5/6 A4/2 F4/8', 'G4/2 Bb4/2 D5/6 F5/2 D5/4', 'Eb5/6 D5/2 Bb4/8',
             'C5/2 Eb5/2 G5/6 F5/2 Eb5/4', 'F5/6 C5/2 A4/8', 'Bb4/4 D5/4 Eb5/4 G5/4', 'F5/12 r/4']
    B_MEL = ['D5/6 Bb4/2 G4/8', 'G4/2 Bb4/2 Eb5/4 D5/4 Bb4/4', 'F4/6 Bb4/2 D5/8', 'C5/4 A4/4 F4/8',
             'G5/6 F5/2 D5/8', 'Eb5/4 G5/4 Bb5/8', 'E5/4 G5/4 C5/4 E5/4', 'F5/8 E5/4 C5/4']
    C_MEL = ['Eb5/2 G5/2 Bb5/2 G5/2 Eb5/2 Bb4/2 G4/2 Bb4/2', 'F5/2 A5/2 C6/2 A5/2 F5/2 C5/2 A4/2 C5/2',
             'D5/2 F5/2 A5/2 F5/2 D5/2 A4/2 F4/2 A4/2', 'G4/2 Bb4/2 D5/2 G5/2 Bb5/4 G5/4',
             'C5/2 Eb5/2 G5/2 Bb5/2 G5/2 Eb5/2 C5/2 Eb5/2', 'F5/2 A5/2 C6/2 A5/2 F5/4 C5/4',
             'G5/2 Eb5/2 Bb4/2 Eb5/2 A5/2 F5/2 C5/2 F5/2', 'Eb5/2 C5/2 A4/2 F4/2 A4/2 C5/2 Eb5/2 F5/2']
    secs = [(2, A_CH), (10, B_CH), (18, C_CH), (26, A_CH)]
    mel(s, 'tpt_sus', 2, A_MEL, vel=100); mel(s, 'tbn_sus', 2, A_MEL, vel=82, transpose=-12)
    mel(s, 'vln_sus', 10, B_MEL, vel=94); mel(s, 'glock', 10, B_MEL, vel=78)
    mel(s, 'vln_spic', 18, C_MEL, vel=96)
    mel(s, 'tpt_sus', 26, A_MEL, vel=104); mel(s, 'vln_sus', 26, A_MEL, vel=88); mel(s, 'tbn_sus', 26, A_MEL, vel=90, transpose=-12)
    for b0, ch in secs: crash(s, b0); s.add('timp', s.t(b0), S16 * 4, 46, 105)
    allch = A_CH + B_CH + C_CH + A_CH
    bass(s, 'sbass', 2, allch, 'root8', low=34)
    bass(s, 'vc_spic', 2, allch, 'oct8', low=46, vel=92)
    stabs(s, 'tpt_stac', 10, B_CH, [2, 6, 10, 14], 60, 72, vel=84, ln=1)   # B 는 바이올린 선율에 금관이 뒷박으로 대답
    pad(s, 'tbn_sus', 18, C_CH, 46, 62, vel=84)
    arp16(s, 'vla_spic', 26, A_CH, 58, 77)
    stabs(s, 'tbn_stac', 2, A_CH, [0, 6, 12], 46, 60, vel=86)
    for b, s0, ln, ch in per_bar(A_CH + B_CH):   # 기타 8분 뒷박 커팅
        for i in range(s0 + 2, s0 + ln, 4):
            for j, p in enumerate(voicing(ch, 53, 68, 4)): s.add('gtr', s.t(2 + b, i) + j * 8, S16 * 1.2, p, 78)
    MARCH = {'K': 'x.......x.......', 'S': '....x..x....x.xx', 'H': 'x.x.x.x.x.x.x.x.'}
    drums(s, 2, 16, MARCH); drums(s, 18, 8, ROCK16); drums(s, 26, 8, MARCH)
    roll(s, 33, 50, 110, 8, 16)
    return s


# ═════════════ 챔피언 결전 — D단조 184 BPM: 피아노 오스티나토 + 관현악 ═════════════
def song_champion():
    s = Song('champion', 184, 36, intro_bars=4)
    s.use(PIANO(), -24, 0.2, 0.4, [HALL(20, 1.8)])
    s.use(TPT_SUS(), -21, -0.05, 0.2, [HALL(22, 2.0)])
    s.use(VLN_SUS(), -24, -0.3, 0.35, [HALL(28, 2.4)])
    s.use(VLN_TREM(), -28, -0.35, 0.35, [HALL(26, 2.2)])
    s.use(VLN_SPIC(), -26, -0.35, 0.3, [HALL(20, 1.6)])
    s.use(VC_SUS(), -24, 0.15, 0.25, [HALL(24, 2.2)])
    s.use(VC_SPIC(), -26, 0.15, 0.25, [ROOM(15, 1.2)])
    s.use(TBN_SUS(), -26, -0.15, 0.3, [HALL(22, 2.0)])
    s.use(TBN_STAC(), -26, -0.2, 0.3, [HALL(20, 1.8)])
    s.use(TUBA_STAC(), -27, 0.0, 0.2, [HALL(18, 1.8)])
    s.use(SBASS(), -24, 0.0, 0.1)
    s.use(KICK(), -25, 0.0, 0.1)
    s.use(SNARE(), -26, -0.05, 0.2, [ROOM(16, 1.0)])
    s.use(HAT(), -31, 0.25, 0.15, [ROOM(10, 0.8)])
    s.use(CRASH(), -30, -0.2, 0.3)
    s.use(TIMP(), -27, 0.0, 0.2, [HALL(20, 2.2)])
    # 인트로 4마디: 피아노 16분 오스티나토 위로 베이스가 D-C-Bb-A 로 내려가고, 4마디째 금관 강타
    IN_CH = [['Dm'], ['C'], ['Bb'], ['A']]
    osti = ['D5 A4 F4 A4', 'C5 G4 E4 G4', 'Bb4 F4 D4 F4', 'A4 E4 C#4 E4']
    for b, notes in enumerate(osti):
        ns = notes.split()
        for i in range(16):
            s.add('piano', s.t(b, i), S16 * 0.95, midi(ns[i % 4]), 96 + (12 if i % 4 == 0 else 0) + random.randint(-3, 3))
        s.add('sbass', s.t(b), S16 * 15, [38, 36, 34, 33][b], 100)
        s.add('vc_sus', s.t(b), S16 * 15, [50, 48, 46, 45][b], 95)
    pad(s, 'vln_trem', 0, IN_CH, 62, 77, vel=72)
    for b in range(3): s.add('timp', s.t(b), S16 * 4, 50, 100)
    for i in (0, 3, 6, 8, 10, 12):
        for p in (45, 52, 57, 61): s.add('tbn_stac', s.t(3, i), S16 * 2, p, 108)
        s.add('timp', s.t(3, i), S16 * 2, 45, 110)
    roll(s, 3, 60, 120, 12, 16)
    A_CH = [['Dm'], ['Bb'], ['C'], ['Dm'], ['Dm'], ['Bb'], ['Gm'], ['A']]
    B_CH = [['Gm'], ['C'], ['F'], ['Bb'], ['Gm'], ['A/C#'], ['Dm'], ['A7']]
    C_CH = [['Bb'], ['C'], ['Am'], ['Dm'], ['Bb'], ['C'], ['Eb'], ['A']]          # 7마디째 Eb = 나폴리 화음(bII)
    D_CH = [['Dm'], ['Bb'], ['C'], ['Dm'], ['Gm'], ['Bb'], ['Eb'], ['A7']]
    A_MEL = ['D5/4 A4/4 F5/6 E5/2', 'D5/4 Bb4/4 F4/8', 'E4/2 G4/2 C5/4 E5/4 G5/4', 'F5/6 E5/2 D5/8',
             'D5/4 A4/4 F5/6 G5/2', 'A5/4 G5/4 F5/4 D5/4', 'Bb4/4 D5/4 G5/4 F5/4', 'E5/6 C#5/2 A4/8']
    B_MEL = ['G4/6 Bb4/2 D5/8', 'E5/6 D5/2 C5/8', 'A4/6 C5/2 F5/8', 'F5/6 Eb5/2 D5/8',
             'D5/4 G5/4 Bb5/8', 'A5/6 G5/2 E5/8', 'F5/4 E5/4 D5/4 A4/4', 'C#5/4 E5/4 G5/4 A5/4']
    C_MEL = ['D4/8 F4/8', 'E4/8 G4/8', 'A4/8 E4/8', 'F4/12 r/4', 'D4/4 F4/4 Bb4/8', 'C5/4 G4/4 E4/8', 'Eb4/4 G4/4 Bb4/8', 'A4/16']
    D_MEL = A_MEL[:4] + ['D5/4 Bb4/4 G5/6 A5/2', 'Bb5/4 A5/4 F5/4 D5/4', 'Eb5/4 G5/4 Bb5/4 G5/4', 'A4/2 Bb4/2 C#5/2 D5/2 E5/2 F5/2 G5/2 A5/2']
    secs = [(4, A_CH), (12, B_CH), (20, C_CH), (28, D_CH)]
    for b0, ch in secs: crash(s, b0); s.add('timp', s.t(b0), S16 * 4, 50, 120)
    mel(s, 'tpt_sus', 4, A_MEL, vel=102); mel(s, 'vln_sus', 4, A_MEL, vel=84)
    mel(s, 'vln_sus', 12, B_MEL, vel=98); mel(s, 'tpt_sus', 12, B_MEL, vel=90, transpose=-12)
    mel(s, 'vc_sus', 20, C_MEL, vel=100); mel(s, 'tpt_sus', 20, C_MEL, vel=84, transpose=12)
    mel(s, 'tpt_sus', 28, D_MEL, vel=106); mel(s, 'vln_sus', 28, D_MEL, vel=90); mel(s, 'tbn_sus', 28, D_MEL, vel=90, transpose=-12)
    allch = A_CH + B_CH + C_CH + D_CH
    # 피아노: A·D 는 16분 오스티나토, B 는 8분 화음, C 는 쉼 (현이 대신 움직임)
    for b0, ch in ((4, A_CH), (28, D_CH)): arp16(s, 'piano', b0, ch, 57, 77, vel=84, pattern=(3, 2, 0, 2))
    stabs(s, 'piano', 12, B_CH, [0, 2, 4, 6, 8, 10, 12, 14], 55, 72, vel=80, ln=1)
    arp16(s, 'vln_spic', 20, C_CH, 62, 84, vel=84)
    bass(s, 'sbass', 4, allch, 'oct8', low=38)
    bass(s, 'vc_spic', 4, A_CH + B_CH, 'gallop', low=50); bass(s, 'vc_spic', 28, D_CH, 'gallop', low=50)
    bass(s, 'tuba_stac', 4, allch, 'beats', low=34, vel=95)
    stabs(s, 'tbn_stac', 4, A_CH, [2, 6, 10, 14], 50, 65, vel=90); stabs(s, 'tbn_stac', 28, D_CH, [0, 3, 6, 10, 12], 50, 65, vel=100)
    pad(s, 'tbn_sus', 20, C_CH, 46, 62, vel=86)
    pad(s, 'vln_trem', 12, B_CH, 65, 79, vel=70)
    drums(s, 4, 16, {'K': 'x.....x.x.x.....', 'S': '....x.......x.xx', 'H': 'x.x.x.x.x.x.x.x.'})
    drums(s, 20, 8, {'K': 'x.......x.......', 'S': '....x.......x...', 'H': 'x.x.x.x.x.x.x.x.'})
    drums(s, 28, 8, {'K': 'x.x...x.x.x...x.', 'S': '....x.......x.xx', 'H': 'xoxoxoxoxoxoxoxo'})
    for b in range(4, 36, 2): s.add('timp', s.t(b, 8), S16 * 3, 50, 95)
    roll(s, 35, 50, 120, 8, 16)
    return s


SONGS = {'victory': song_victory, 'pwt': song_pwt, 'champion': song_champion}

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
