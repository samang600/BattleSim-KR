"""작곡 → SoundCraft 렌더링 도구.
악기(샘플 구역 자동 구성 · 실제 음높이 측정), 음표 입력 헬퍼, 코드·패턴 생성, MIDI·SoundCraft 스크립트 작성,
악기별 라우드니스 자동 균형, 루프 이음새 처리(꼬리를 루프 시작에 겹침)까지."""
import os, re, json, math, struct, shutil, subprocess, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SCRATCH = os.path.dirname(HERE)
REPO = {'vsco': os.path.join(SCRATCH, 'vsco_meta'), 'vcsl': os.path.join(SCRATCH, 'vcsl_meta')}
SAMPLES = os.path.join(HERE, 'samples')
CLI = '/home/user/sc-target/release/soundcraft-cli'
TPQ = 480
S16 = TPQ // 4
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def midi(name):
    """'E5', 'Bb4', 'F#3', 'A#0' → MIDI (C4=60)"""
    m = re.fullmatch(r'([A-G])([#b]?)(-?\d)', name)
    pc = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[m.group(1)] + {'#': 1, 'b': -1, '': 0}[m.group(2)]
    return 12 * (int(m.group(3)) + 1) + pc

# ── 오디오 분석 ──
def load_wav(path):
    w = wave.open(path); n = w.getnframes(); ch = w.getnchannels(); sw = w.getsampwidth(); sr = w.getframerate(); raw = w.readframes(n)
    if sw == 3:
        a = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
        x = (a[:, 0].astype(np.int32) | (a[:, 1].astype(np.int32) << 8) | (a[:, 2].astype(np.int32) << 16))
        x = np.where(x >= 1 << 23, x - (1 << 24), x) / float(1 << 23)
    elif sw == 4:
        x = np.frombuffer(raw, dtype=np.int32) / float(1 << 31)
    else:
        x = np.frombuffer(raw, dtype=np.int16) / 32768.0
    return x.reshape(-1, ch), sr

def measure_pitch(path):
    """기음(MIDI 실수). 가장 센 부분음을 찾고, 그보다 1/2·1/3·1/4 위치에 충분히 센 봉우리가 있으면 그쪽을 기음으로 본다
    (자기상관은 주기 2배를, HPS 는 2배음을 고르는 옥타브 오류가 있어서)."""
    x, sr = load_wav(path); x = x.mean(axis=1)
    pk = int(np.argmax(np.abs(x))); seg = x[pk + int(0.08 * sr): pk + int(0.08 * sr) + 32768]
    if len(seg) < 8192: seg = x[pk:pk + 32768]
    seg = (seg - seg.mean()) * np.hanning(len(seg))
    N = 131072
    sp = np.abs(np.fft.rfft(seg, N)); fr = np.fft.rfftfreq(N, 1 / sr); df = fr[1]
    band = (fr > 25) & (fr < 6000)
    fp = fr[int(np.argmax(np.where(band, sp, 0)))]
    amp = lambda f: float(sp[max(0, int(f / df) - 4):int(f / df) + 5].max())
    top = amp(fp); f0 = fp
    for k in (4, 3, 2):
        c = fp / k
        if c > 25 and amp(c) > 0.12 * top:
            f0 = c; break
    return 69 + 12 * math.log2(f0 / 440)

def lead_silence_pct(path):
    x, sr = load_wav(path); a = np.abs(x).max(axis=1)
    i = int(np.argmax(a > a.max() * 0.03)); i = max(0, i - int(0.004 * sr))
    return round(100.0 * i / len(a), 3)

def git_files(repo, folder):
    out = subprocess.run(['git', '-C', REPO[repo], 'ls-tree', '--name-only', 'HEAD', folder.rstrip('/') + '/'], capture_output=True, text=True).stdout
    return [l for l in out.splitlines() if l.lower().endswith('.wav')]

def fetch(repo, rel):
    dst = os.path.join(SAMPLES, repo + '_' + os.path.basename(rel))
    if not os.path.exists(dst):
        os.makedirs(SAMPLES, exist_ok=True)
        subprocess.run(['git', '-C', REPO[repo], 'checkout', 'HEAD', '--', rel], check=True, capture_output=True)
        shutil.copyfile(os.path.join(REPO[repo], rel), dst)
    return dst

# ── 악기 ──
_cache_path = os.path.join(HERE, 'inst_cache.json')
_cache = json.load(open(_cache_path)) if os.path.exists(_cache_path) else {}

class Sampled:
    """음높이 악기: 폴더에서 `pick` 정규식에 맞는 파일만 골라 음 이름으로 구역을 만든다.
    음 이름과 실제 소리가 옥타브 다를 수 있어 한 파일을 측정해 보정한다."""
    def __init__(self, key, repo, folder, pick, play, step=1, pitch_of=None):
        self.key, self.repo, self.folder, self.play = key, repo, folder, play
        # pick: 정규식 하나 또는 우선순위 목록. 앞의 것으로 먼저 채우고, 빈 음은 뒤의 것으로 채움
        picks = [pick] if isinstance(pick, str) else list(pick)
        allf = git_files(repo, folder)
        zones = {}
        for pk in picks:
            for f in allf:
                if not re.search(pk, os.path.basename(f)): continue
                if pitch_of:   # 파일 이름이 번호인 샘플: 음 높이를 함수로
                    p = pitch_of(os.path.basename(f))
                    if p is not None: zones.setdefault(p, f)
                    continue
                m = re.search(r'(?<![A-Za-z])([A-G](?:#|b)?)(-?\d)(?=[_\.])', os.path.basename(f))
                if not m: continue
                zones.setdefault(midi(m.group(1) + m.group(2)), f)
        assert zones, (key, folder, pick)
        ks = sorted(zones)
        if key in _cache: off = _cache[key]
        else:
            # 낮은·가운데·높은 녹음 셋을 재서 옥타브 보정값을 다수결로 (하나가 튀어도 틀리지 않게)
            votes = []
            for ref in {ks[0], ks[len(ks) // 2], ks[-1]}:
                meas = measure_pitch(fetch(repo, zones[ref]))
                votes.append(int(round((meas - ref) / 12.0)) * 12)
            off = max(set(votes), key=votes.count)
            _cache[key] = off; json.dump(_cache, open(_cache_path, 'w'))
        self.zones = {k + off: v for k, v in zones.items()}
        if step > 1:   # 너무 촘촘하면 솎아냄
            keep = sorted(self.zones)[::step]; self.zones = {k: self.zones[k] for k in keep}
    def zone_for(self, p):
        return min(self.zones, key=lambda z: (abs(z - p), -z))

class Hit:
    """타악기 한 방(음높이 고정, 건반 추적 끔)"""
    def __init__(self, key, repo, rel, play):
        self.key, self.repo, self.rel, self.play = key, repo, rel, {**play, 'key_track': 0, 'play_mode': 1}

class Synth:
    def __init__(self, key, plugin, params):
        self.key, self.plugin, self.params = key, plugin, params

# ── 곡 ──
CHORD_Q = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'maj7': [0, 4, 7, 11], 'dim': [0, 3, 6], 'dim7': [0, 3, 6, 9],
           'sus4': [0, 5, 7], 'aug': [0, 4, 8], 'm6': [0, 3, 7, 9], '6': [0, 4, 7, 9], 'add9': [0, 4, 7, 14], 'm7b5': [0, 3, 6, 10], '5': [0, 7]}
def chord(name):
    """'Am', 'F#m7', 'C/E', 'Bbmaj7' → (구성음 pitch-class 목록, 베이스 pitch-class)"""
    body, _, bass = name.partition('/')
    m = re.fullmatch(r'([A-G][#b]?)(.*)', body)
    root = midi(m.group(1) + '4') % 12
    pcs = [(root + i) % 12 for i in CHORD_Q[m.group(2)]]
    return pcs, (midi(bass + '4') % 12 if bass else root)

def near(pc, around):
    """pitch-class 를 around 근처 옥타브로"""
    p = around - ((around - pc) % 12)
    return p if around - p <= 6 else p + 12

class Song:
    def __init__(self, name, bpm, bars, intro_bars=0):
        self.name, self.bpm, self.bars, self.intro = name, bpm, bars, intro_bars
        self.BAR = TPQ * 4
        self.notes = {}       # 악기 key → [(start, dur, pitch, vel)]
        self.inst = {}        # key → 악기
        self.mix = {}         # key → dict(target LUFS, pan, width, inserts)
    def use(self, inst, target, pan=0.0, width=0.3, inserts=()):
        self.inst[inst.key] = inst; self.mix[inst.key] = dict(target=target, pan=pan, width=width, inserts=list(inserts))
        self.notes.setdefault(inst.key, [])
    def add(self, key, start, dur, pitch, vel):
        self.notes[key].append((int(start), max(10, int(dur)), int(pitch), max(1, min(127, int(vel)))))
    def t(self, bar, s16=0):
        return bar * self.BAR + s16 * S16
    # 음표 문자열: "E5/4 G5/2 r/2 C6/8" (길이는 16분음표 단위), '~' 접두어 = 스타카토(길이의 55%)
    def line(self, key, bar, text, vel=96, legato=0.92, transpose=0, accent=10):
        pos = 0
        for tok in text.split():
            name, _, ln = tok.partition('/')
            ln = int(ln or 1)
            if name != 'r':
                stac = name.startswith('~'); name = name.lstrip('~')
                v = vel + (accent if (pos % 4 == 0) else 0)
                self.add(key, self.t(bar, pos), ln * S16 * (0.55 if stac else legato), midi(name) + transpose, v)
            pos += ln
        return pos
    def length_sec(self):
        return self.bars * 4 * 60 / self.bpm

# ── 반주 패턴 ──
def voicing(ch, low, high, n=4):
    pcs, bass = chord(ch)
    out, p = [], low
    tones = pcs[:]
    while len(out) < n and p <= high:
        if p % 12 in tones and (not out or p - out[-1] >= 3): out.append(p)
        p += 1
    return out

def per_bar(chords):
    """[['Am'], ['F','G'], ...] → [(bar, s16_start, s16_len, chord)]"""
    out = []
    for b, cs in enumerate(chords):
        n = len(cs); step = 16 // n
        for i, c in enumerate(cs): out.append((b, i * step, step, c))
    return out

def write_midi(song, path):
    def vlq(x):
        o = [x & 0x7F]; x >>= 7
        while x: o.append(0x80 | (x & 0x7F)); x >>= 7
        return bytes(reversed(o))
    def chunk(evs, name, ch=0):
        d = bytearray(b'\x00\xff\x03' + vlq(len(name.encode())) + name.encode()); E = []
        for s, du, p, v in evs: E.append((s, 1, bytes([0x90 | ch, p, v]))); E.append((s + du, 0, bytes([0x80 | ch, p, 0])))
        E.sort(key=lambda e: (e[0], e[1])); last = 0
        for t, _, m in E: d += vlq(t - last) + m; last = t
        d += b'\x00\xff\x2f\x00'
        return b'MTrk' + struct.pack('>I', len(d)) + bytes(d)
    cond = b'\x00\xff\x51\x03' + int(60_000_000 / song.bpm).to_bytes(3, 'big') + b'\x00\xff\x58\x04\x04\x02\x18\x08\x00\xff\x2f\x00'
    chunks, tracks = [], []
    for key, inst in song.inst.items():
        evs = song.notes[key]
        if not evs: continue
        if isinstance(inst, Sampled):
            by = {}
            for e in evs: by.setdefault(inst.zone_for(e[2]), []).append(e)
            for z, es in sorted(by.items()):
                tn = f'{key} {z}'; chunks.append(chunk(es, tn)); tracks.append((tn, key, z))
        else:
            chunks.append(chunk(evs, key, 9 if isinstance(inst, Hit) else 0)); tracks.append((key, key, None))
    open(path, 'wb').write(b'MThd' + struct.pack('>IHHH', 6, 1, len(chunks) + 1, TPQ) + b'MTrk' + struct.pack('>I', len(cond)) + cond + b''.join(chunks))
    return tracks

def script(song, tracks, gains, mid_path):
    L = [f'file.import_midi {json.dumps({"path": mid_path})}']
    for tn, key, z in tracks:
        inst, mx = song.inst[key], song.mix[key]
        g = gains.get(key, 0.0)
        level = max(-48.0, min(12.0, g)); vol = max(-60.0, min(12.0, g - level))
        if isinstance(inst, Synth):
            p = dict(inst.params); p['level'] = round(max(-48.0, min(6.0, p.get('level', -6) + g)), 2)
            vol = round(max(-60.0, min(12.0, g - (p['level'] - inst.params.get('level', -6)))), 2)
            L.append('mix.instrument ' + json.dumps({'track': tn, 'plugin': inst.plugin, 'params': p}))
        else:
            path = fetch(inst.repo, inst.zones[z] if isinstance(inst, Sampled) else inst.rel)
            params = {**inst.play, 'level': round(level + inst.play.get('level', 0), 2)}
            if isinstance(inst, Sampled): params['root_note'] = z
            st = lead_silence_pct(path)
            if st > 0: params['start'] = st
            L.append('mix.sampler_load ' + json.dumps({'track': tn, 'path': path, 'params': params}))
        for k, (plug, pp) in enumerate(mx['inserts']):
            L.append('mix.insert ' + json.dumps({'track': tn, 'slot': k, 'plugin': plug, 'params': pp}))
        for idx, pv in ((0, mx['pan'] - mx['width']), (1, mx['pan'] + mx['width'])):
            L.append('mix.pan ' + json.dumps({'tracks': [tn], 'pan': round(max(-1, min(1, pv)), 2), 'index': idx}))
        L.append('mix.volume ' + json.dumps({'tracks': [tn], 'db': round(vol, 2)}))
    return L

def render(lines, out, end, solo_keys=None, tracks=None):
    body = list(lines)
    if solo_keys is not None:
        for tn, key, z in tracks:
            if key not in solo_keys: body.append('mix.volume ' + json.dumps({'tracks': [tn], 'db': -144}))
    sp = os.path.join(HERE, '_tmp_steps.txt'); open(sp, 'w').write('\n'.join(body) + '\n')
    r = subprocess.run([CLI, 'script', sp, '--bounce', out, '--end', str(end)], capture_output=True, text=True)
    m = re.search(r'"lufs":(-?[0-9.]+|null)', r.stdout)
    if not m: raise RuntimeError(r.stdout[-800:] + r.stderr[-800:])
    return float(m.group(1)) if m.group(1) != 'null' else -120.0

def build(song, outdir, tail=3.0, rounds=2, final_lufs=-16.0):
    """균형 맞춰 렌더 → 루프 이음새 처리 → mp3. 반환: 루프 정보"""
    os.makedirs(outdir, exist_ok=True)
    mid = os.path.join(outdir, song.name + '.mid')
    tracks = write_midi(song, mid)
    L = song.length_sec(); end = L + tail
    gains = {k: 0.0 for k in song.inst}
    tmp = os.path.join(HERE, '_solo.wav')
    for _ in range(rounds):
        lines = script(song, tracks, gains, mid)
        for key in song.inst:
            if not song.notes[key]: continue
            lu = render(lines, tmp, end, {key}, tracks)
            gains[key] += max(-30, min(30, song.mix[key]['target'] - lu))
    lines = script(song, tracks, gains, mid)
    open(os.path.join(outdir, song.name + '_steps.txt'), 'w').write('\n'.join(lines) + '\n')
    raw = os.path.join(outdir, song.name + '_raw.wav')
    lufs = render(lines, raw, end)
    # 루프: 본문(인트로 뒤 ~ 끝) 뒤의 잔향 꼬리를 루프 시작 지점에 겹쳐서 이음새를 자연스럽게
    x, sr = load_wav(raw)
    n_end = int(round(L * sr)); n_intro = int(round(song.intro * 4 * 60 / song.bpm * sr))
    tailx = x[n_end:]
    y = x[:n_end].copy()
    k = min(len(tailx), n_end - n_intro)
    y[n_intro:n_intro + k] += tailx[:k]
    gain = 10 ** ((final_lufs - lufs) / 20)
    y = y * gain
    peak = np.abs(y).max()
    if peak > 0.89: y = y * (0.89 / peak)      # 약 -1 dBFS 를 넘지 않게
    wav = os.path.join(outdir, song.name + '.wav')
    w = wave.open(wav, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()); w.close()
    mp3 = os.path.join(outdir, song.name + '.mp3')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '128k', mp3], check=True)
    for f in (raw, tmp, os.path.join(HERE, '_tmp_steps.txt')):
        if os.path.exists(f): os.remove(f)
    return {'loopStart': round(song.intro * 4 * 60 / song.bpm, 4), 'loopEnd': round(L, 4), 'gains': {k: round(v, 1) for k, v in gains.items()}}
