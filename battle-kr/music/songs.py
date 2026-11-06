#!/usr/bin/env python3
"""앱 배경음악 5곡: 마을(타이틀) · 트레이너 배틀 · 배틀 시설 · 중요 배틀 · 악의 조직.
사용: python3 songs.py [곡 이름 ...]   → out/<이름>.mp3 와 out/loops.json"""
import os, sys, json, random
from songkit import Song, Sampled, Hit, Synth, per_bar, voicing, chord, near, midi, build, S16, TPQ

random.seed(11)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')

# ── 악기 (VSCO 2 CE · VCSL, CC0) ──
P = lambda **k: k
FLUTE_STAC = lambda: Sampled('flute_stac', 'vsco', 'Woodwinds/Flute/stac', r'_v2_rr1\.wav$', P(play_mode=1, attack=1, release=120, velocity=55))
FLUTE_SUS = lambda: Sampled('flute_sus', 'vsco', 'Woodwinds/Flute/susvib', r'_v1_1\.wav$', P(play_mode=0, attack=15, sustain=100, release=180, velocity=50))
GLOCK = lambda: Sampled('glock', 'vsco', 'Percussion/Glock', r'glock_medium', P(play_mode=1, attack=0.5, release=800, velocity=55))
VLN_SOLO = lambda: Sampled('vln_solo', 'vsco', 'Strings/Solo Violin/Arco Vib', r'_p\.wav$', P(play_mode=0, attack=25, sustain=100, release=260, velocity=45))
HARP = lambda: Sampled('harp', 'vsco', 'Strings/Harp', r'\.wav$', P(play_mode=0, attack=1, decay=1500, sustain=30, release=600, velocity=55))
DB_PIZZ = lambda: Sampled('db_pizz', 'vsco', 'Strings/Solo Contrabass/Pizz', r'_v1_rr1\.wav$', P(play_mode=0, attack=1, sustain=100, release=180, velocity=60))
VLN_SPIC = lambda: Sampled('vln_spic', 'vsco', 'Strings/Violin Section/Spic', r'_v2_rr1\.wav$', P(play_mode=1, attack=1, release=150, velocity=55))
VLN_SUS = lambda: Sampled('vln_sus', 'vsco', 'Strings/Violin Section/susVib', (r'_v2\.wav$', r'_v1\.wav$'), P(play_mode=0, attack=60, sustain=100, release=350, velocity=45))
VLN_TREM = lambda: Sampled('vln_trem', 'vsco', 'Strings/Violin Section/Trem', r'_v2\.wav$', P(play_mode=0, attack=30, sustain=100, release=300, velocity=45))
VLA_SPIC = lambda: Sampled('vla_spic', 'vsco', 'Strings/Viola Section/spic', r'_v2_rr1\.wav$', P(play_mode=1, attack=1, release=150, velocity=55))
VC_SPIC = lambda: Sampled('vc_spic', 'vsco', 'Strings/Cello Section/spic', r'_v2_RR1\.wav$', P(play_mode=1, attack=1, release=150, velocity=55))
VC_SUS = lambda: Sampled('vc_sus', 'vsco', 'Strings/Cello Section/susvib', r'_v3_1\.wav$', P(play_mode=0, attack=50, sustain=100, release=350, velocity=45))
TPT_SUS = lambda: Sampled('tpt_sus', 'vsco', 'Brass/Trumpet/sus', (r'_v3_rr1\.wav$', r'_v1_rr1\.wav$'), P(play_mode=0, attack=8, sustain=100, release=200, velocity=50))
TPT_STAC = lambda: Sampled('tpt_stac', 'vsco', 'Brass/Trumpet/stac', r'_v2_rr1\.wav$', P(play_mode=1, attack=1, release=150, velocity=55))
HN_SUS = lambda: Sampled('hn_sus', 'vsco', 'Brass/F Horn/sus', (r'_v2_1\.wav$', r'_v3_1\.wav$', r'_v1_1\.wav$'), P(play_mode=0, attack=20, sustain=100, release=300, velocity=50))
HN_STAC = lambda: Sampled('hn_stac', 'vsco', 'Brass/F Horn/stac', (r'_v2_rr1\.wav$', r'_v3_rr1\.wav$', r'_v1_rr1\.wav$'), P(play_mode=1, attack=1, release=150, velocity=55))
TBN_SUS = lambda: Sampled('tbn_sus', 'vsco', 'Brass/Tenor Trombone/sus', (r'_v2_1\.wav$', r'_v3_1\.wav$', r'_v1_1\.wav$'), P(play_mode=0, attack=20, sustain=100, release=300, velocity=50))
TBN_STAC = lambda: Sampled('tbn_stac', 'vsco', 'Brass/Tenor Trombone/stac', (r'_v3_rr1\.wav$', r'_v2_rr1\.wav$', r'_v1_rr1\.wav$'), P(play_mode=1, attack=1, release=150, velocity=55))
TUBA_STAC = lambda: Sampled('tuba_stac', 'vsco', 'Brass/Tuba/stac', r'_v2_rr1_Sum\.wav$', P(play_mode=1, attack=1, release=150, velocity=55))
CL_STAC = lambda: Sampled('cl_stac', 'vsco', 'Woodwinds/Clarinet/stac', r'_v2_rr1_sum\.wav$', P(play_mode=1, attack=1, release=120, velocity=55))
OB_STAC = lambda: Sampled('ob_stac', 'vsco', 'Woodwinds/Oboe/Stacc', r'_v2_rr1_Main\.wav$', P(play_mode=1, attack=1, release=120, velocity=55))
SNARE_SOFT = lambda: Hit('snare', 'vcsl', 'Membranophones/Struck Membranophones/Snare Drum, Modern 2/Snare3M_HitSN_v2_rr1_Mid.wav', P(attack=0.5, release=200, velocity=80))
SNARE = lambda: Hit('snare', 'vcsl', 'Membranophones/Struck Membranophones/Snare Drum, Modern 1/Snare2_HitSN_v6_rr1_Mid.wav', P(attack=0.5, release=200, velocity=70))
HAT = lambda: Hit('hat', 'vcsl', 'Idiophones/Struck Idiophones/Hi-Hat Cymbal/HiHat_HitC_v2_rr1_Mid.wav', P(attack=0.5, release=150, velocity=80))
CRASH = lambda: Hit('crash', 'vcsl', 'Idiophones/Struck Idiophones/Clash Cymbals 1/cymbal_crash1_mf1.wav', P(attack=0.5, release=1500, velocity=50))
TIMP = lambda: Hit('timp', 'vsco', 'Percussion/Timpani/Timpani3_Hit_v4_rr1_Sum.wav', P(attack=0.5, release=1200, velocity=60))
KICK = lambda: Synth('kick', 'drum_synth', dict(level=-6, kick_tune=-1, kick_decay=320))
LEAD = lambda: Synth('lead', 'subtractive_synth', dict(osc1_wave=1, osc2_wave=0, osc2_semitones=0, osc2_detune=9, osc_mix=35, cutoff=3200, resonance=10, filter_env_amount=20,
                                                       amp_attack=4, amp_decay=200, amp_sustain=80, amp_release=110, filter_decay=250, filter_sustain=60, velocity=40, level=-10))
SBASS = lambda: Synth('sbass', 'subtractive_synth', dict(osc1_wave=0, osc2_wave=1, osc2_semitones=-12, osc2_detune=0, osc_mix=40, cutoff=850, resonance=22, filter_env_amount=45,
                                                         filter_attack=0.5, filter_decay=160, filter_sustain=20, filter_release=80, amp_attack=2, amp_decay=220, amp_sustain=75, amp_release=60, velocity=45, level=-8))
GTR = lambda: Synth('gtr', 'subtractive_synth', dict(osc1_wave=0, osc2_wave=3, osc2_semitones=12, osc2_detune=4, osc_mix=30, cutoff=1400, resonance=10, filter_env_amount=60, filter_attack=0.5,
                                                    filter_decay=120, filter_sustain=0, filter_release=100, amp_attack=1, amp_decay=350, amp_sustain=0, amp_release=120, velocity=75, level=-13))
PLATE = lambda mix=22, decay=2.0: ('plate_reverb', {'mix': mix, 'decay': decay})
ROOM = lambda mix=15, decay=1.1: ('room_reverb', {'mix': mix, 'decay': decay})
HALL = lambda mix=25, decay=2.6: ('plate_reverb', {'mix': mix, 'decay': decay, 'pre_delay': 20})

# ── 작곡 헬퍼 ──
def mel(song, key, bar0, bars, vel=96, transpose=0, legato=0.92):
    for i, b in enumerate(bars):
        n = song.line(key, bar0 + i, b, vel=vel, transpose=transpose, legato=legato)
        assert n == 16, (song.name, key, bar0 + i, n, b)

def drums(song, bar0, nbars, pat, hum=4):
    """pat: {'K': '16칸', 'S': ..., 'H': ..., 'T': 팀파니, 'C': 크래시} — 'x' 강, 'o' 약"""
    keymap = {'K': ('kick', 36), 'S': ('snare', 38), 'H': ('hat', 42), 'T': ('timp', 47), 'C': ('crash', 49)}
    for b in range(nbars):
        for k, s in pat.items():
            key, note = keymap[k]
            for i, c in enumerate(s):
                if c in 'xo':
                    v = (100 if c == 'x' else 70) + random.randint(-hum, hum)
                    song.add(key, song.t(bar0 + b, i), S16 * 0.9, note, v)

def crash(song, bar, v=100):
    song.add('crash', song.t(bar), TPQ * 4, 49, v)

def bass(song, key, bar0, chords, style, low=33, vel=100):
    """style: 'oct8' 8분 옥타브 펄스, 'root8' 8분 근음, 'gallop' 16분 x.xx, 'beats' 1·3박, 'phryg' 근음-근음-반음위-근음"""
    for b, s0, ln, ch in per_bar(chords):
        pcs, bpc = chord(ch); r = low + ((bpc - low) % 12)
        for i in range(s0, s0 + ln):
            t = song.t(bar0 + b, i)
            if style == 'oct8' and i % 2 == 0: song.add(key, t, S16 * 1.7, r + (12 if (i // 2) % 2 else 0), vel - (8 if (i // 2) % 2 else 0))
            elif style == 'root8' and i % 2 == 0: song.add(key, t, S16 * 1.8, r, vel - (0 if i % 4 == 0 else 10))
            elif style == 'gallop' and i % 4 in (0, 2, 3): song.add(key, t, S16 * 0.9, r + (12 if i % 8 == 4 else 0), vel - (0 if i % 4 == 0 else 14))
            elif style == 'beats' and i % 8 == 0: song.add(key, t, S16 * 6, r if i == s0 else r + 7 - (12 if r + 7 > low + 14 else 0), vel)
            elif style == 'phryg' and i % 2 == 0:
                step = (i // 2) % 4
                song.add(key, t, S16 * 1.7, r + (1 if step == 2 else 0), vel - (0 if step == 0 else 12))

def arp16(song, key, bar0, chords, low, high, vel=78, pattern=(0, 1, 2, 3, 2, 1)):
    for b, s0, ln, ch in per_bar(chords):
        v = voicing(ch, low, high, 4)
        for i in range(s0, s0 + ln):
            p = v[pattern[i % len(pattern)] % len(v)]
            song.add(key, song.t(bar0 + b, i), S16 * 0.9, p, vel + (10 if i % 4 == 0 else 0) + random.randint(-3, 3))

def stabs(song, key, bar0, chords, at, low, high, vel=92, ln=2):
    for b, s0, l, ch in per_bar(chords):
        for i in at:
            if s0 <= i < s0 + l:
                for p in voicing(ch, low, high, 3): song.add(key, song.t(bar0 + b, i), S16 * ln, p, vel + random.randint(-3, 3))

def pad(song, key, bar0, chords, low, high, vel=70, n=3):
    for b, s0, ln, ch in per_bar(chords):
        for p in voicing(ch, low, high, n): song.add(key, song.t(bar0 + b, s0), S16 * ln * 0.97, p, vel)

def roll(song, bar, vel0=50, vel1=110, s0=0, s1=16):
    for i in range(s0, s1):
        song.add('snare', song.t(bar, i), S16 * 0.8, 38, int(vel0 + (vel1 - vel0) * (i - s0) / max(1, s1 - s0 - 1)))

ROCK = {'K': 'x.....x.x.......', 'S': '....x.......x...', 'H': 'x.o.x.o.x.o.x.o.'}
ROCK16 = {'K': 'x.....x.x.....o.', 'S': '....x.......x...', 'H': 'xooxxooxxooxxoox'}

# ═════════════ 1. 마을 (타이틀) — compose.py 의 곡, 멜로디 한 옥타브 낮춤 ═════════════
def song_title():
    g = {'__file__': os.path.join(os.path.dirname(__file__), 'compose.py'), '__name__': 'compose'}
    exec(open(g['__file__']).read(), g)
    tr = g['tracks']; B = g['BAR']
    s = Song('title', g['BPM'], 24)  # 루프는 24마디 (종지 마디는 루프에서 뺌)
    s.use(FLUTE_STAC(), -20.5, 0.05, 0.3, [ROOM(20, 1.4)])
    s.use(FLUTE_SUS(), -23, 0.05, 0.3, [ROOM(24, 1.6)])
    s.use(GLOCK(), -29, 0.35, 0.3, [PLATE(26, 2.2)])
    s.use(VLN_SOLO(), -26, -0.3, 0.35, [PLATE(26, 2.0)])
    s.use(HARP(), -27, 0.25, 0.4, [ROOM(22, 1.8)])
    s.use(DB_PIZZ(), -26, 0.0, 0.15)
    s.use(GTR(), -29, -0.25, 0.35, [ROOM(15, 1.0)])
    s.use(KICK(), -31, 0.0, 0.1, [ROOM(12, 0.9)])
    s.use(SNARE_SOFT(), -32, -0.05, 0.2, [ROOM(14, 0.9)])
    s.use(HAT(), -35, 0.25, 0.15, [ROOM(10, 0.8)])
    keep = lambda e: e[0] < 24 * B
    for e in filter(keep, tr['Flute']):
        s.add('flute_sus' if 8 * B <= e[0] < 16 * B else 'flute_stac', *e[:4])
    for e in filter(keep, tr['Glockenspiel']): s.add('glock', *e[:4])
    for e in filter(keep, tr['Violin']): s.add('vln_solo', *e[:4])
    for e in filter(keep, tr['Guitar Arp']): s.add('harp', *e[:4])
    for e in filter(keep, tr['Double Bass']): s.add('db_pizz', *e[:4])
    for e in filter(keep, tr['Guitar Strum']): s.add('gtr', *e[:4])
    for e in filter(keep, tr['Drums']):
        s.add({36: 'kick', 38: 'snare', 42: 'hat'}.get(e[2], 'kick'), *e[:4]) if e[2] in (36, 38, 42) else None
    return s

# ═════════════ 2. 트레이너 배틀 — A단조 168 BPM ═════════════
def song_battle():
    s = Song('battle', 168, 36, intro_bars=4)
    s.use(TPT_SUS(), -21, 0.0, 0.2, [HALL(20, 1.8)])
    s.use(LEAD(), -27, 0.0, 0.3, [ROOM(15, 1.0)])
    s.use(VLN_SUS(), -25, -0.3, 0.35, [HALL(26, 2.2)])
    s.use(VLN_SPIC(), -26, -0.35, 0.3, [HALL(20, 1.6)])
    s.use(VLA_SPIC(), -28, 0.3, 0.3, [HALL(18, 1.6)])
    s.use(VC_SPIC(), -27, 0.15, 0.25, [ROOM(15, 1.2)])
    s.use(TBN_STAC(), -27, 0.25, 0.3, [HALL(20, 1.8)])
    s.use(TBN_SUS(), -28, -0.15, 0.3, [HALL(22, 2.0)])
    s.use(SBASS(), -23, 0.0, 0.1)
    s.use(KICK(), -26, 0.0, 0.1)
    s.use(SNARE(), -27, -0.05, 0.2, [ROOM(16, 1.0)])
    s.use(HAT(), -31, 0.25, 0.15, [ROOM(10, 0.8)])
    s.use(CRASH(), -31, -0.2, 0.3)
    s.use(TIMP(), -30, 0.0, 0.2, [HALL(18, 2.0)])
    # 인트로: 반음계 하행(바이올린 스피카토 + 트럼펫) → 2마디 동안 A 음 리듬 강타
    run = 'A5 G#5 G5 F#5 F5 E5 D#5 D5 C#5 C5 B4 A#4 A4 G#4 G4 F#4'.split()
    for i, nm in enumerate(run):
        s.add('vln_spic', s.t(0, i), S16 * 0.9, midi(nm), 92 + (8 if i % 4 == 0 else 0))
        s.add('vln_spic', s.t(1, i), S16 * 0.9, midi(nm) - 12, 92 + (8 if i % 4 == 0 else 0))
    for b in (0, 1): s.add('timp', s.t(b), S16 * 4, 47, 100)
    hits = [0, 3, 6, 8, 10, 12, 14]
    for b in (2, 3):
        for i in hits:
            for p in (45, 52, 57): s.add('tbn_stac', s.t(b, i), S16 * 2, p, 100)
            s.add('sbass', s.t(b, i), S16 * 1.5, 33, 105)
    roll(s, 3, 40, 110, 8, 16)
    drums(s, 2, 1, {'K': 'x..x..x.x.x.x.x.', 'H': 'x.x.x.x.x.x.x.x.'})
    # 본문 32마디 (4~35)
    A_CH = [['Am'], ['F'], ['G'], ['Am'], ['Am'], ['F'], ['Dm'], ['E']]
    B_CH = [['Dm'], ['Am'], ['Bb'], ['F'], ['Dm'], ['Am'], ['Bb'], ['E']]
    C_CH = [['F'], ['G'], ['Em'], ['Am'], ['F'], ['G'], ['Am'], ['Am']]
    D_CH = A_CH[:7] + [['E7']]
    A_MEL = ['E4/3 A4/3 E4/2 C5/4 B4/2 A4/2', 'A4/3 F4/3 C4/2 F4/4 G4/2 A4/2', 'B4/3 G4/3 D4/2 G4/4 A4/2 B4/2', 'C5/6 B4/2 A4/4 E4/4',
             'E4/3 A4/3 E4/2 C5/4 B4/2 A4/2', 'A4/3 F4/3 C4/2 F5/4 E5/2 D5/2', 'D5/3 C5/3 A4/2 F4/4 D4/4', 'E4/2 G#4/2 B4/2 E5/2 D5/2 B4/2 G#4/2 E4/2']
    B_MEL = ['F4/6 E4/2 D4/4 A4/4', 'E4/6 C4/2 A3/8', 'D4/4 F4/4 Bb4/6 A4/2', 'A4/6 G4/2 F4/4 C4/4',
             'F4/6 E4/2 D4/4 A4/4', 'C5/6 B4/2 A4/4 E4/4', 'F4/2 Bb4/2 D5/2 F5/2 E5/4 D5/4', 'G#4/4 B4/4 E5/8']
    C_MEL = ['C5/8 A4/4 F4/4', 'D5/8 B4/4 G4/4', 'B4/6 G4/2 E4/8', 'A4/6 C5/2 E5/8', 'F5/6 E5/2 C5/4 A4/4', 'G5/6 F5/2 D5/4 B4/4', 'E5/4 C5/4 A4/4 E4/4', 'A4/4 r/12']
    D_MEL = A_MEL[:7] + ['E4/2 F4/2 G#4/2 A4/2 B4/2 C5/2 D5/2 E5/2']
    secs = [(4, A_CH, A_MEL), (12, B_CH, B_MEL), (20, C_CH, C_MEL), (28, D_CH, D_MEL)]
    for b0, ch, m in secs:
        mel(s, 'tpt_sus', b0, m, vel=100)
        mel(s, 'lead', b0, m, vel=90)
        crash(s, b0)
        s.add('timp', s.t(b0), S16 * 4, 45, 110)
    for b0, ch, m in secs[1:3]: mel(s, 'vln_sus', b0, m, vel=88)   # B·C 는 바이올린이 같은 높이로 겹침
    bass(s, 'sbass', 4, A_CH + B_CH + C_CH + D_CH, 'oct8', low=33)
    bass(s, 'vc_spic', 4, A_CH, 'gallop', low=45); bass(s, 'vc_spic', 28, D_CH, 'gallop', low=45)
    arp16(s, 'vla_spic', 12, B_CH + C_CH, 57, 76)
    stabs(s, 'tbn_stac', 4, A_CH, [2, 6, 10, 14], 50, 65, vel=88); stabs(s, 'tbn_stac', 28, D_CH, [2, 6, 10, 14], 50, 65, vel=88)
    pad(s, 'tbn_sus', 20, C_CH, 48, 64, vel=80)
    drums(s, 4, 16, ROCK16); drums(s, 20, 8, ROCK); drums(s, 28, 8, ROCK16)
    roll(s, 35, 50, 110, 8, 16)
    return s

# ═════════════ 3. 배틀 시설 — D장조 152 BPM ═════════════
def song_tower():
    s = Song('tower', 152, 34, intro_bars=2)
    s.use(TPT_SUS(), -21, -0.05, 0.2, [HALL(22, 1.8)])
    s.use(VLN_SUS(), -24, -0.3, 0.35, [HALL(26, 2.2)])
    s.use(VLN_SPIC(), -25, -0.35, 0.3, [HALL(20, 1.6)])
    s.use(VLA_SPIC(), -28, 0.3, 0.3, [HALL(18, 1.6)])
    s.use(VC_SPIC(), -27, 0.15, 0.25, [ROOM(15, 1.2)])
    s.use(TPT_STAC(), -27, 0.2, 0.3, [HALL(20, 1.6)])
    s.use(TBN_SUS(), -28, -0.15, 0.3, [HALL(22, 2.0)])
    s.use(SBASS(), -23, 0.0, 0.1)
    s.use(GTR(), -30, -0.3, 0.3, [ROOM(15, 1.0)])
    s.use(KICK(), -26, 0.0, 0.1)
    s.use(SNARE(), -27, -0.05, 0.2, [ROOM(16, 1.0)])
    s.use(HAT(), -31, 0.25, 0.15, [ROOM(10, 0.8)])
    s.use(CRASH(), -31, -0.2, 0.3)
    # 인트로 2마디: 금관 팡파르 D-F#-A-D → A 길게, 스네어 롤
    mel(s, 'tpt_stac', 0, ['~D4/2 ~F#4/2 ~A4/2 ~D5/2 ~F#4/2 ~A4/2 ~D5/2 ~F#5/2', 'A4/16'], vel=100)
    mel(s, 'tbn_sus', 0, ['D3/8 F#3/8', 'E3/16'], vel=95)
    roll(s, 1, 40, 115)
    s.add('sbass', s.t(0), S16 * 8, 38, 100); s.add('sbass', s.t(1), S16 * 15, 33, 100)
    A_CH = [['D'], ['A/C#'], ['Bm'], ['G'], ['Em7'], ['A'], ['D'], ['A7']]
    B_CH = [['G'], ['A'], ['F#m'], ['Bm'], ['Em'], ['A'], ['Bb'], ['C']]
    C_CH = [['Bm'], ['G'], ['D'], ['A'], ['Bm'], ['G'], ['Em'], ['A7']]
    A_MEL = ['F#4/4 A4/4 D5/6 E5/2', 'E5/4 C#5/4 A4/8', 'D5/4 B4/4 F#4/6 A4/2', 'G4/4 B4/4 D5/8',
             'E5/4 G5/4 F#5/2 E5/2 D5/4', 'C#5/6 D5/2 E5/8', 'F#5/4 E5/2 D5/2 A4/4 D5/4', 'E5/12 r/4']
    B_MEL = ['B4/4 D5/4 G5/8', 'A5/6 G5/2 E5/8', 'F#5/4 E5/4 C#5/4 A4/4', 'B4/6 C#5/2 D5/8',
             'G5/4 F#5/4 E5/4 B4/4', 'C#5/4 E5/4 A5/8', 'F5/4 D5/4 Bb4/4 F5/4', 'G5/4 E5/4 C5/4 G5/4']
    C_MEL = ['B4/2 D5/2 F#5/2 B5/2 A5/2 F#5/2 D5/2 F#5/2', 'G5/2 D5/2 B4/2 D5/2 G5/4 F#5/4', 'F#5/2 A5/2 D5/2 F#5/2 A4/4 D5/4', 'E5/2 C#5/2 A4/2 C#5/2 E5/8',
             'B4/2 D5/2 F#5/2 B5/2 A5/2 F#5/2 D5/2 F#5/2', 'G5/2 B5/2 G5/2 D5/2 B4/4 D5/4', 'E5/2 G5/2 B5/2 G5/2 E5/4 B4/4', 'C#5/2 E5/2 G5/2 A5/2 G5/2 E5/2 C#5/2 A4/2']
    secs = [(2, A_CH), (10, B_CH), (18, C_CH), (26, A_CH)]
    mel(s, 'tpt_sus', 2, A_MEL, vel=100); mel(s, 'vln_sus', 2, A_MEL, vel=86); mel(s, 'tbn_sus', 2, A_MEL, vel=84, transpose=-12)
    mel(s, 'tpt_sus', 10, B_MEL, vel=100); mel(s, 'vln_sus', 10, B_MEL, vel=88)
    mel(s, 'vln_spic', 18, C_MEL, vel=96)
    mel(s, 'tpt_sus', 26, A_MEL, vel=100); mel(s, 'tbn_sus', 26, A_MEL, vel=90, transpose=-12); mel(s, 'vln_sus', 26, A_MEL, vel=86)
    for b0, ch in secs: crash(s, b0)
    allch = A_CH + B_CH + C_CH + A_CH
    bass(s, 'sbass', 2, allch, 'root8', low=38)
    bass(s, 'vc_spic', 2, A_CH + B_CH, 'root8', low=50); bass(s, 'vc_spic', 18, C_CH + A_CH, 'gallop', low=50)
    arp16(s, 'vla_spic', 18, C_CH, 59, 78)
    stabs(s, 'tpt_stac', 18, C_CH, [0, 3, 6, 10], 62, 74, vel=86)
    pad(s, 'tbn_sus', 10, B_CH, 45, 60, vel=74)
    for b, s0, ln, ch in per_bar(A_CH + B_CH):   # A·B 는 기타 8분 커팅으로 경쾌하게
        for i in range(s0, s0 + ln, 2):
            for j, p in enumerate(voicing(ch, 52, 67, 4)): s.add('gtr', s.t(2 + b, i) + j * 10, S16 * 1.4, p, 80 if i % 4 == 0 else 64)
    drums(s, 2, 32, ROCK16)
    roll(s, 33, 50, 110, 8, 16)
    return s

# ═════════════ 4. 중요 배틀 (관장·챔피언·보스) — C단조 176 BPM ═════════════
def song_boss():
    s = Song('boss', 176, 36, intro_bars=4)
    s.use(VC_SUS(), -24, 0.15, 0.25, [HALL(24, 2.2)])
    s.use(TPT_SUS(), -21, -0.05, 0.2, [HALL(22, 2.0)])
    s.use(VLN_SUS(), -24, -0.3, 0.35, [HALL(28, 2.4)])
    s.use(VLN_TREM(), -28, -0.35, 0.35, [HALL(26, 2.2)])
    s.use(VLA_SPIC(), -27, 0.3, 0.3, [HALL(18, 1.6)])
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
    # 인트로 4마디: 저음 금관 동기(C-Eb-C | Ab-G-F-G) 두 번 + 팀파니, 그 뒤 Cm 강타와 스네어 롤
    motif = ['~C3/2 r/2 ~C3/2 r/2 ~Eb3/2 r/2 ~C3/2 r/2', '~Ab2/2 r/2 ~G2/2 r/2 ~F2/2 r/2 ~G2/2 r/2']
    mel(s, 'tbn_stac', 0, motif * 2, vel=105); mel(s, 'tuba_stac', 0, motif * 2, vel=100, transpose=-12)
    for b in range(4): s.add('timp', s.t(b), S16 * 4, 47, 110); s.add('timp', s.t(b, 8), S16 * 4, 47, 90)
    pad(s, 'vln_trem', 0, [['Cm'], ['Fm'], ['Cm'], ['G']], 67, 79, vel=80)
    for p in (48, 55, 60, 63): s.add('tbn_stac', s.t(3, 0), S16 * 3, p, 110)
    roll(s, 3, 40, 115, 4, 16)
    A_CH = [['Cm'], ['Ab'], ['Bb'], ['Cm'], ['Cm'], ['Ab'], ['Fm'], ['G']]
    B_CH = [['Ab'], ['Bb'], ['Gm'], ['Cm'], ['Ab'], ['Bb'], ['Bdim7'], ['G']]
    C_CH = [['Eb'], ['Bb/D'], ['Cm'], ['Ab'], ['Eb'], ['Bb'], ['Ab'], ['G']]
    A_MEL = ['C4/4 Eb4/4 G4/6 F4/2', 'Eb4/4 C4/4 Ab3/8', 'Bb3/4 D4/4 F4/6 Eb4/2', 'G4/12 r/4',
             'C4/4 Eb4/4 G4/4 C5/4', 'Bb4/4 Ab4/4 Eb4/8', 'F4/4 Ab4/4 C5/4 Ab4/4', 'G4/4 B3/4 D4/4 G4/4']
    B_MEL = ['C4/6 Eb4/2 Ab4/8', 'D4/6 F4/2 Bb4/8', 'G4/4 F4/4 D4/4 Bb3/4', 'C4/12 r/4',
             'Eb4/4 Ab4/4 C5/8', 'D5/6 C5/2 Bb4/8', 'B3/4 D4/4 F4/4 Ab4/4', 'G4/16']
    C_MEL = ['G4/8 Bb4/8', 'F4/8 D4/8', 'Eb4/8 G4/8', 'C5/8 Ab4/8', 'Bb4/6 G4/2 Eb4/8', 'D4/6 F4/2 Bb4/8', 'C5/6 Bb4/2 Ab4/8', 'B4/8 G4/8']
    D_MEL = A_MEL[:7] + ['G3/2 A3/2 B3/2 C4/2 D4/2 Eb4/2 F4/2 G4/2']
    secs = [(4, A_CH, A_MEL), (12, B_CH, B_MEL), (20, C_CH, C_MEL), (28, A_CH[:7] + [['G']], D_MEL)]
    for b0, ch, m in secs:
        crash(s, b0); s.add('timp', s.t(b0), S16 * 4, 47, 120)
    mel(s, 'vc_sus', 4, A_MEL, vel=100); mel(s, 'tpt_sus', 4, A_MEL, vel=90, transpose=12)
    mel(s, 'tpt_sus', 12, B_MEL, vel=100, transpose=12); mel(s, 'vc_sus', 12, B_MEL, vel=92)
    mel(s, 'vln_sus', 20, C_MEL, vel=96, transpose=12); mel(s, 'vc_sus', 20, ['Eb4/16', 'D4/16', 'C4/16', 'C4/16', 'Bb3/16', 'Bb3/16', 'C4/16', 'B3/16'], vel=84)
    mel(s, 'tpt_sus', 28, D_MEL, vel=104, transpose=12); mel(s, 'vc_sus', 28, D_MEL, vel=96); mel(s, 'vln_sus', 28, D_MEL, vel=86, transpose=12)
    allch = A_CH + B_CH + C_CH + secs[3][1]
    bass(s, 'sbass', 4, allch, 'oct8', low=36)
    bass(s, 'vc_spic', 4, allch, 'gallop', low=48)
    bass(s, 'tuba_stac', 4, allch, 'beats', low=36, vel=95)
    arp16(s, 'vla_spic', 12, B_CH + C_CH, 60, 79)
    stabs(s, 'tbn_stac', 4, A_CH, [2, 6, 10, 14], 50, 64, vel=90); stabs(s, 'tbn_stac', 28, secs[3][1], [0, 6, 12], 48, 62, vel=100)
    pad(s, 'tbn_sus', 20, C_CH, 48, 63, vel=84)
    pad(s, 'vln_trem', 12, B_CH, 67, 80, vel=70)
    for b in range(4, 36, 2): s.add('timp', s.t(b, 8), S16 * 3, 47, 95)
    drums(s, 4, 32, {'K': 'x.....x.x.x.....', 'S': '....x.......x.xx', 'H': 'x.x.x.x.x.x.x.x.'})
    roll(s, 35, 50, 115, 8, 16)
    return s

# ═════════════ 5. 악의 조직 — E 프리지아 150 BPM ═════════════
def song_evil():
    s = Song('evil', 150, 34, intro_bars=2)
    s.use(CL_STAC(), -22, 0.1, 0.25, [ROOM(16, 1.2)])
    s.use(OB_STAC(), -25, -0.2, 0.25, [ROOM(16, 1.2)])
    s.use(TBN_SUS(), -22, -0.15, 0.25, [HALL(22, 2.0)])
    s.use(VC_SUS(), -24, 0.2, 0.25, [HALL(24, 2.0)])
    s.use(TPT_SUS(), -23, 0.0, 0.2, [HALL(22, 1.8)])
    s.use(VC_SPIC(), -24, 0.1, 0.25, [ROOM(15, 1.2)])
    s.use(VLN_SPIC(), -27, -0.35, 0.3, [HALL(20, 1.6)])
    s.use(TPT_STAC(), -28, 0.3, 0.3, [HALL(18, 1.6)])
    s.use(TBN_STAC(), -27, -0.3, 0.3, [HALL(18, 1.6)])
    s.use(SBASS(), -24, 0.0, 0.1)
    s.use(LEAD(), -29, 0.0, 0.3, [ROOM(15, 1.0)])
    s.use(KICK(), -26, 0.0, 0.1)
    s.use(SNARE(), -27, -0.05, 0.2, [ROOM(14, 0.9)])
    s.use(HAT(), -30, 0.25, 0.15, [ROOM(10, 0.8)])
    s.use(CRASH(), -32, -0.2, 0.3)
    A_CH = [['Em'], ['F'], ['Em'], ['F'], ['Em'], ['F'], ['D'], ['B7']]
    B_CH = [['Am'], ['Bb'], ['Em'], ['F'], ['Am'], ['Bb'], ['C'], ['B7']]
    D_CH = [['C'], ['B7'], ['Em'], ['Em'], ['C'], ['B7'], ['Em'], ['B7']]
    # 인트로 2마디: 첼로 스피카토 반음 오스티나토만, 하이햇
    bass(s, 'vc_spic', 0, [['Em'], ['Em']], 'phryg', low=40)
    drums(s, 0, 2, {'H': 'x.oox.oox.oox.oo'})
    A_MEL = ['~E4/2 r/2 ~G4/2 ~F#4/2 ~E4/2 r/2 ~B3/4', '~C4/2 r/2 ~F4/2 ~E4/2 ~C4/2 r/2 ~A3/4', '~E4/2 r/2 ~G4/2 ~B4/2 ~A#4/2 ~B4/2 r/4', '~A4/2 ~G4/2 ~F4/2 ~E4/2 ~D4/2 ~C4/2 ~B3/4',
             '~E4/2 r/2 ~G4/2 ~F#4/2 ~E4/2 r/2 ~B3/4', '~C4/2 r/2 ~F4/2 ~A4/2 ~C5/4 ~B4/4', '~A4/2 ~F#4/2 ~D4/2 ~F#4/2 ~A4/4 ~F#4/4', '~D#4/2 ~F#4/2 ~A4/2 ~B4/2 ~A4/2 ~F#4/2 ~D#4/4']
    B_MEL = ['A2/8 C3/4 E3/4', 'F3/8 D3/4 Bb2/4', 'E3/8 G3/4 B3/4', 'A3/8 G3/4 F3/4', 'A3/8 C4/4 E4/4', 'D4/8 C4/4 Bb3/4', 'G3/4 C4/4 E4/4 G4/4', 'F#4/8 D#4/4 B3/4']
    D_MEL = ['G4/4 C5/4 E5/8', 'D#5/4 F#5/4 B4/8', 'E5/6 G5/2 B4/8', 'B4/4 A4/4 G4/4 F#4/4', 'E4/4 G4/4 C5/8', 'B4/4 A4/4 F#4/4 D#4/4', 'E4/16', 'r/16']
    mel(s, 'cl_stac', 2, A_MEL, vel=100); mel(s, 'ob_stac', 2, A_MEL, vel=86, transpose=12)
    mel(s, 'tbn_sus', 10, B_MEL, vel=100); mel(s, 'vc_sus', 10, B_MEL, vel=92, transpose=12)
    mel(s, 'cl_stac', 18, A_MEL, vel=100); mel(s, 'vln_spic', 18, A_MEL, vel=90, transpose=12); mel(s, 'lead', 18, A_MEL, vel=80)
    mel(s, 'tpt_sus', 26, D_MEL, vel=102); mel(s, 'tbn_sus', 26, D_MEL, vel=90, transpose=-12)
    for b0 in (2, 10, 18, 26): crash(s, b0, 90)
    bass(s, 'vc_spic', 2, A_CH + B_CH + A_CH + D_CH, 'phryg', low=40)
    bass(s, 'sbass', 2, A_CH + B_CH + A_CH + D_CH, 'root8', low=28, vel=92)
    stabs(s, 'tpt_stac', 2, A_CH, [4, 12], 59, 71, vel=86, ln=1); stabs(s, 'tpt_stac', 18, A_CH, [4, 12], 59, 71, vel=86, ln=1)
    stabs(s, 'tbn_stac', 10, B_CH, [0, 3, 6], 45, 57, vel=96); stabs(s, 'tbn_stac', 26, D_CH, [0, 3, 6, 10], 45, 57, vel=96)
    drums(s, 2, 31, {'K': 'x..x....x..x....', 'S': '....x.......x...', 'H': 'x.oox.oox.oox.oo'})
    drums(s, 33, 1, {'K': 'x...............', 'S': '........x.x.xxxx'})
    return s

SONGS = {'title': song_title, 'battle': song_battle, 'tower': song_tower, 'boss': song_boss, 'evil': song_evil}

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
