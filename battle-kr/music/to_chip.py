#!/usr/bin/env python3
"""작곡 데이터(songs.py·songs2.py)를 앱의 칩튠 시퀀서용 5채널(리드·화음·베이스·아르페지오·드럼)로 자동 편곡.
마디마다 선율 악기를 우선순위로 골라 리드에, 리드와 다른 움직임의 화음 파트를 화음 채널에, 가장 낮은 음을 베이스에,
분산화음·스피카토를 아르페지오에 둔다. 출력: <앱>/src/gen/chip-tracks.json
  채널 문자열: 16분음표 한 칸에 한 글자 — ' ' 쉼, '!' 앞 음 지속, 그 밖 chr(MIDI+14)
  drums: 'k' 킥, 's' 스네어, 'h' 하이햇, '.' 없음
사용: python3 to_chip.py [출력 경로]"""
import os, sys, json
from songkit import S16
import songs, songs2, songs3

LEAD = ['tpt_sus', 'flute_sus', 'flute_stac', 'cl_stac', 'vln_solo', 'vln_sus', 'vc_sus', 'vln_spic', 'tbn_sus', 'tpt_stac']
HARM = ['vln_sus', 'tbn_sus', 'vln_trem', 'vc_sus', 'glock', 'ob_stac', 'tpt_sus', 'vln_solo', 'gtr', 'flute_sus']
BASS = ['sbass', 'db_pizz', 'tuba_stac', 'vc_spic']
HARM2 = ['tbn_stac', 'tpt_stac', 'gtr', 'tbn_sus', 'vc_sus', 'harp']   # 화음 대체: 화음 가운데 음
ARP = ['harp', 'piano', 'vla_spic', 'vln_spic', 'gtr', 'tpt_stac', 'tbn_stac', 'vc_spic']
LEAD_TYPE = {'title': 'square', 'victory': 'square', 'evil': 'sawtooth', 'boss': 'sawtooth', 'champion': 'sawtooth', 'battle': 'sawtooth'}

def grid(notes, n, pick):
    """notes → 칸마다 (onset 음 또는 지속) 단선율. pick: 같은 칸 화음 중 고를 음 (max/min)"""
    on = {}
    for st, du, p, v in notes:
        i = int(round(st / S16))
        if 0 <= i < n: on.setdefault(i, []).append((p, max(1, int(round(du / S16)))))
    out = [None] * n
    for i in sorted(on):
        p, ln = pick(on[i], key=lambda x: x[0])
        out[i] = p
        for j in range(i + 1, min(n, i + ln)):
            if j in on: break
            out[j] = -1
    return out

def bar_has(g, b):
    return any(x is not None for x in g[b * 16:(b + 1) * 16])

def same_motion(a, b, bar):
    """두 파트가 같은 리듬·같은 음이름(옥타브 겹침)이면 True"""
    for i in range(bar * 16, bar * 16 + 16):
        x, y = a[i], b[i]
        if (x is None or x == -1) != (y is None or y == -1): return False
        if x not in (None, -1) and (x - y) % 12: return False
    return True

def convert(song):
    n = song.bars * 16
    top = {k: grid(v, n, max) for k, v in song.notes.items() if v}
    low = {k: grid(v, n, min) for k, v in song.notes.items() if v}
    mid = {k: grid(v, n, lambda c, key: sorted(c, key=key)[len(c) // 2]) for k, v in song.notes.items() if v}
    ch = {c: [None] * n for c in ('lead', 'harm', 'bass', 'arp')}
    for b in range(song.bars):
        sl = slice(b * 16, b * 16 + 16)
        lk = next((k for k in LEAD if k in top and bar_has(top[k], b)), None)
        if lk: ch['lead'][sl] = top[lk][sl]
        hk = next((k for k in HARM if k in top and k != lk and bar_has(top[k], b) and not (lk and same_motion(top[k], top[lk], b))), None)
        if hk: ch['harm'][sl] = top[hk][sl]
        bk = next((k for k in BASS if k in low and bar_has(low[k], b)), None)
        if bk: ch['bass'][sl] = low[bk][sl]
        if not hk:
            hk = next((k for k in HARM2 if k in mid and k not in (lk, bk) and bar_has(mid[k], b) and not (lk and same_motion(mid[k], top[lk], b))), None)
            if hk: ch['harm'][sl] = mid[hk][sl]
        ak = next((k for k in ARP if k in top and k not in (lk, hk, bk) and bar_has(top[k], b)), None)
        if ak: ch['arp'][sl] = top[ak][sl]
    # 휴대폰 스피커에서 들리게: C2(36) 아래 베이스는 한 옥타브 올림
    ch['bass'] = [x + 12 if x not in (None, -1) and x < 36 else x for x in ch['bass']]
    # 첫 칸이 '지속'이면 쉼으로
    for c in ch.values():
        for i in range(n):
            if c[i] == -1 and (i == 0 or c[i - 1] is None): c[i] = None
    drums = ['.'] * n
    for key, sym in (('hat', 'h'), ('kick', 'k'), ('snare', 's')):
        for st, du, p, v in song.notes.get(key, []):
            i = int(round(st / S16))
            if 0 <= i < n and (sym != 'h' or v >= 60 or drums[i] == '.'): drums[i] = sym
    enc = lambda a: ''.join(' ' if x is None else '!' if x == -1 else chr(x + 14) for x in a)
    return {'bpm': song.bpm, 'intro': song.intro * 16, 'leadType': LEAD_TYPE.get(song.name, 'square'),
            **{c: enc(v) for c, v in ch.items()}, 'drums': ''.join(drums)}

if __name__ == '__main__':
    out_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), 'out', 'chip-tracks.json')
    res = {}
    for name, fn in {**songs.SONGS, **songs2.SONGS, **songs3.SONGS}.items():
        res[name] = convert(fn())
        r = res[name]; print(name, len(r['lead']), '칸', {c: sum(ch not in ' !' for ch in r[c]) for c in ('lead', 'harm', 'bass', 'arp')})
    json.dump(res, open(out_path, 'w', encoding='utf-8'), ensure_ascii=True, separators=(',', ':'))
    print('저장', out_path, os.path.getsize(out_path), 'bytes')
