#!/usr/bin/env python3
"""
PokéRogue 의 기술 애니메이션(Pokémon Reborn 팀 제작, CC BY-NC-SA 4.0)을 이 앱 형식으로 변환한다.

입력: pokerogue-assets 저장소 (battle-anims/*.json, images/battle_anims/*.png, audio/battle_anims/*.m4a)
출력: battle-kr/public/anims/<쇼다운 기술 id>.js, anims/img/*.png, anims/se/*.m4a, anims/CREDITS.md

사용법: python3 battle-kr/scripts/import-anims.py <pokerogue-assets 경로>
RPG Maker 기본 소재(RTP)로 보이는 그림(NNN-이름.png)과 소리(PRSFX- 접두가 없는 것)는 제외한다.
"""
import json
import os
import re
import shutil
import subprocess
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else '/home/user/pagefaultgames/pokerogue/pagefaultgames/pokerogue-assets'
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'anims')
os.makedirs(os.path.join(OUT, 'img'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'se'), exist_ok=True)

RTP_IMG = re.compile(r'^\d{3}-')


def compact_anim(a):
    frames = []
    for fr in a.get('frames', []):
        cels = []
        for c in fr:
            cels.append([
                c.get('target', 2), round(c.get('x', 0), 1), round(c.get('y', 0), 1),
                c.get('zoomX', 100), c.get('zoomY', 100), c.get('graphicFrame', 0),
                c.get('opacity', 255), c.get('priority', 1), c.get('focus', 1),
                c.get('blendType', 0), 1 if c.get('mirror') else 0, c.get('angle', 0),
                0 if c.get('visible') is False else 1,
            ])
        frames.append(cels)
    events = {}
    for k, evs in (a.get('frameTimedEvents') or {}).items():
        out = []
        for e in evs:
            t = e.get('eventType')
            if t == 'AnimTimedSoundEvent':
                n = e.get('resourceName') or ''
                out.append({'t': 'se', 'n': n, 'v': e.get('volume', 100), 'p': e.get('pitch', 100)})
            elif t == 'AnimTimedAddBgEvent':
                out.append({'t': 'bg', 'n': e.get('resourceName') or '', 'x': e.get('bgX', 0), 'y': e.get('bgY', 0), 'o': e.get('opacity', 0), 'd': e.get('duration', 0)})
            elif t == 'AnimTimedUpdateBgEvent':
                out.append({'t': 'bgu', 'x': e.get('bgX'), 'y': e.get('bgY'), 'o': e.get('opacity'), 'd': e.get('duration', 0)})
        if out:
            events[k] = out
    g = a.get('graphic') or ''
    if RTP_IMG.match(g):
        g = ''
    return {'g': g, 'f': frames, 'e': events}


used_img, used_se = set(), set()
count = 0
for fn in sorted(os.listdir(os.path.join(SRC, 'battle-anims'))):
    if not fn.endswith('.json'):
        continue
    sid = re.sub(r'[^a-z0-9]', '', fn[:-5].lower())
    data = json.load(open(os.path.join(SRC, 'battle-anims', fn)))
    variants = data if isinstance(data, list) else [data]
    variants = [v for v in variants if v and v.get('frames')]
    if not variants:
        continue
    comp = [compact_anim(v) for v in variants[:2]]
    for c in comp:
        if c['g']:
            used_img.add(c['g'])
        for evs in c['e'].values():
            for e in evs:
                if e['t'] == 'se' and e['n'].startswith('PRSFX'):
                    used_se.add(e['n'])
                if e['t'] == 'bg' and e['n']:
                    used_img.add(e['n'])
    js = 'window.__anims=window.__anims||{};window.__anims[%s]=%s;' % (json.dumps(sid), json.dumps(comp, separators=(',', ':')))
    open(os.path.join(OUT, sid + '.js'), 'w').write(js)
    count += 1

# 그림
missing = []
for g in sorted(used_img):
    src = os.path.join(SRC, 'images', 'battle_anims', g + '.png')
    if os.path.exists(src):
        shutil.copyfile(src, os.path.join(OUT, 'img', g + '.png'))
    else:
        missing.append(g)
# 소리 (AAC 48kbps 모노로 다시 인코딩해 용량 절감)
se_count = 0
for n in sorted(used_se):
    base = os.path.splitext(n)[0]
    src = os.path.join(SRC, 'audio', 'battle_anims', n)
    if not os.path.exists(src):
        src = os.path.join(SRC, 'audio', 'battle_anims', base + '.m4a')
    if not os.path.exists(src):
        continue
    dst = os.path.join(OUT, 'se', base + '.m4a')
    if not os.path.exists(dst):
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-ac', '1', '-b:a', '48k', '-movflags', '+faststart', dst], check=False)
    se_count += 1

open(os.path.join(OUT, 'CREDITS.md'), 'w').write(
    '# 기술 애니메이션·효과음 출처\n\n'
    '이 폴더의 애니메이션 데이터·그림·효과음은 **Pokémon Reborn** 팀이 만든 배틀 애니메이션으로, '
    '[PokéRogue](https://github.com/pagefaultgames/pokerogue) 의 에셋 저장소(pokerogue-assets)에서 가져와 변환했습니다.\n'
    '라이선스: CC BY-NC-SA 4.0 (비영리·동일조건변경허락). 이 앱은 비영리로만 배포됩니다.\n'
    'RPG Maker 기본 소재로 보이는 파일은 제외했습니다.\n')
print(f'anims {count}, images {len(used_img) - len(missing)} (missing {len(missing)}), sounds {se_count}')
if missing:
    print('missing images:', missing[:20])
