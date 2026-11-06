#!/usr/bin/env python3
"""chip-tracks.json 을 앱의 startSynth 와 같은 방식(파형·음량·엔벨로프·드럼)으로 렌더해 미리듣기 mp3 를 만든다.
앱은 작곡한 곡을 GBA 풍 음원(펄스 12.5/25/50%·파형 메모리 베이스·LFSR 드럼·메아리)으로 재생하므로 기본도 GBA 풍(--old 면 예전 음색).
사용: python3 chip_preview.py chip-tracks.json[,chip-gen3.json] 출력폴더 [곡 ...] [--old]"""
import sys, os, json, subprocess, numpy as np

SR = 44100
rng = np.random.default_rng(1)

def osc(kind, f, n):
    ph = (np.arange(n) * f / SR) % 1.0
    if kind == 'square': return np.where(ph < 0.5, 1.0, -1.0)
    if kind == 'triangle': return 4 * np.abs(ph - 0.5) - 1
    if kind == 'sawtooth': return 2 * ph - 1
    return np.sin(2 * np.pi * ph)

def env(n, v):
    t = np.arange(n) / SR; dur = n / SR
    a = np.minimum(t / 0.008, 1.0)
    up = 0.0001 * (v / 0.0001) ** a
    k = np.clip((t - 0.008) / max(1e-4, dur - 0.008), 0, 1)
    down = v * (0.0001 / v) ** k
    return np.where(t < 0.008, up, down)

def add(buf, at, sig):
    i = int(at * SR); j = min(len(buf), i + len(sig))
    if i < len(buf): buf[i:j] += sig[:j - i]

def tone(buf, at, f, dur, kind, vol, slide=None):
    n = int(dur * SR)
    if slide:
        fr = f * (slide / f) ** (np.arange(n) / n); ph = np.cumsum(fr / SR) % 1.0
        sig = np.sin(2 * np.pi * ph)
    else: sig = osc(kind, f, n)
    add(buf, at, sig * env(n, vol))

def noise(buf, at, dur, cutoff, vol):
    n = int(dur * SR); x = rng.uniform(-1, 1, n)
    a = np.exp(-2 * np.pi * cutoff / SR)   # 1차 고역 통과
    y = np.empty(n); prev_x = prev_y = 0.0
    for i in range(n):
        prev_y = a * (prev_y + x[i] - prev_x); prev_x = x[i]; y[i] = prev_y
    t = np.arange(n) / n
    add(buf, at, y * vol * (0.0001 / vol) ** t)

N = lambda m: 440 * 2 ** ((m - 69) / 12)
dec = lambda s: [None if c == ' ' else -1 if c == '!' else ord(c) - 14 for c in s]


# ── GBA 풍 (앱 sound.ts 의 gbaTone·gbaDrum·gbaEcho 와 같은 설정) ──
def pulse(f, n, duty, vib=None):
    t = np.arange(n) / SR
    fr = np.full(n, f)
    if vib is not None:
        depth = np.clip((t - 0.18) / 0.14, 0, 1) * f * 0.012
        fr = f + depth * np.sin(2 * np.pi * 5.5 * t)
    ph = np.cumsum(fr / SR) % 1.0
    return np.where(ph < duty, 1.0, -1.0) * 0.7
WRAM = np.array([(i if i < 16 else 31 - i) / 7.5 - 1 for i in range(32)])
def wram(f, n):
    ph = (np.arange(n) * f / SR) % 1.0
    return WRAM[(ph * 32).astype(int) % 32]
def genv(n, vol, sus):
    t = np.arange(n) / SR; dur = n / SR
    e = np.where(t < 0.004, vol * t / 0.004, vol + (vol * sus - vol) * np.clip((t - 0.004) / max(1e-3, min(dur, 0.08) - 0.004), 0, 1))
    rel = np.clip((dur - t) / 0.012, 0, 1)
    return e * rel
def lfsr(short, n, clock):
    r = 0x7fff; out = np.empty(n); acc = 0.0; step = clock / SR
    for i in range(n):
        acc += step
        while acc >= 1:
            acc -= 1; bit = (r ^ (r >> 1)) & 1; r = (r >> 1) | (bit << 14)
            if short: r = (r & ~0x40) | (bit << 6)
        out[i] = -1.0 if r & 1 else 1.0
    return out
NOISE_S = None; NOISE_L = None
def render_gba(tr):
    global NOISE_S, NOISE_L
    if NOISE_S is None: NOISE_S = lfsr(True, SR // 2, 32768); NOISE_L = lfsr(False, SR // 2, 65536)
    sd = 60 / tr['bpm'] / 4
    ch = {k: dec(tr[k]) for k in ('lead', 'harm', 'bass', 'arp')}
    L = len(ch['lead']); buf = np.zeros(int((L * sd + 1.5) * SR))
    def ln(a, i):
        n = 1
        while i + n < len(a) and a[i + n] == -1 and n < 16: n += 1
        return n
    for i in range(L):
        at = i * sd
        x = ch['lead'][i]
        if x not in (None, -1):
            n = int(sd * ln(ch['lead'], i) * 0.92 * SR); add(buf, at, pulse(N(x), n, 0.25, vib=True) * genv(n, 0.12, 0.7))
        x = ch['harm'][i]
        if x not in (None, -1):
            n = int(sd * ln(ch['harm'], i) * 0.95 * SR); add(buf, at, pulse(N(x), n, 0.5) * genv(n, 0.055, 0.7))
        x = ch['bass'][i]
        if x not in (None, -1):
            n = int(sd * max(1, ln(ch['bass'], i)) * 0.9 * SR); add(buf, at, wram(N(x), n) * genv(n, 0.26, 0.85))
        x = ch['arp'][i]
        if x not in (None, -1):
            n = int(sd * 0.6 * SR); add(buf, at, pulse(N(x), n, 0.125) * genv(n, 0.04, 0.4))
        d = tr['drums'][i]
        if d == 'k':
            n = int(0.11 * SR); t = np.arange(n) / SR; fr = 180 * (45 / 180) ** np.clip(t / 0.09, 0, 1)
            ph = np.cumsum(fr / SR) % 1.0; add(buf, at, np.where(ph < 0.5, 1.0, -1.0) * 0.32 * (0.0001 / 0.32) ** (t / 0.11))
        elif d in 'sh' and d != '.':
            short = d == 'h'; dur = 0.035 if short else 0.12; v = 0.07 if short else 0.2; n = int(dur * SR)
            src = NOISE_S if short else NOISE_L; o = rng.integers(0, len(src) - n)
            t = np.arange(n) / n; add(buf, at, src[o:o + n] * v * (0.0001 / v) ** t)
    # 메아리: 0.11초, 되먹임 0.3, 3200Hz 저역 통과, 섞는 양 0.22
    dly = int(0.11 * SR); wet = np.zeros_like(buf); a = np.exp(-2 * np.pi * 3200 / SR)
    x = buf.copy()
    for k in range(1, 6):
        if dly * k >= len(buf): break
        seg = np.zeros_like(buf); seg[dly * k:] = x[:-dly * k] * (0.3 ** (k - 1))
        try:
            from scipy.signal import lfilter; y = lfilter([1 - a], [1, -a], seg)
        except ImportError:
            y = seg
        wet += y
    return (buf + wet * 0.22) * 0.22 * 4 * 2.2

def render(tr):
    sd = 60 / tr['bpm'] / 4
    ch = {k: dec(tr[k]) for k in ('lead', 'harm', 'bass', 'arp')}
    L = len(ch['lead']); buf = np.zeros(int((L * sd + 1) * SR))
    def ln(a, i):
        n = 1
        while i + n < len(a) and a[i + n] == -1 and n < 16: n += 1
        return n
    for i in range(L):
        at = i * sd
        x = ch['lead'][i]
        if x not in (None, -1): tone(buf, at, N(x), sd * ln(ch['lead'], i) * 0.9, tr['leadType'], 0.13)
        x = ch['harm'][i]
        if x not in (None, -1): tone(buf, at, N(x), sd * ln(ch['harm'], i) * 0.95, 'triangle', 0.08)
        x = ch['bass'][i]
        if x not in (None, -1): tone(buf, at, N(x), sd * 0.9, 'triangle', 0.3)
        x = ch['arp'][i]
        if x not in (None, -1): tone(buf, at, N(x), sd * 0.5, 'square', 0.045)
        d = tr['drums'][i]
        if d == 'k': tone(buf, at, 150, 0.1, 'sine', 0.5, slide=40)
        elif d == 's': noise(buf, at, 0.09, 1500, 0.22)
        elif d == 'h': noise(buf, at, 0.03, 7000, 0.1)
    return buf * 0.22 * 2.2   # 앱 음악 버스(보통) 0.22, 미리듣기용으로 키움

if __name__ == '__main__':
    old = '--old' in sys.argv; args = [a for a in sys.argv[1:] if a != '--old']
    tracks = {}
    for f in args[0].split(','): tracks.update(json.load(open(f)))
    out = args[1]; os.makedirs(out, exist_ok=True)
    for name in args[2:] or tracks:
        tr = dict(tracks[name]); it = tr.get('intro') or 0
        for k in ('lead', 'harm', 'bass', 'arp', 'drums'): tr[k] = tr[k] + tr[k][it:]
        y = render(tr) if old else render_gba(tr); pk = np.abs(y).max(); y = y * min(1.0, 0.89 / pk)
        raw = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
        mp3 = os.path.join(out, f'chip-{name}.mp3')
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', 'loudnorm=I=-16:TP=-1.5', '-ar', '44100', '-b:a', '96k', mp3], input=raw, check=True)
        print(name, f'{len(y) / SR:.1f}s peak {pk:.2f}', mp3, flush=True)
