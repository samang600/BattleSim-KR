#!/usr/bin/env python3
"""메가진화·원시회귀 그림 크기 보정표 src/gen/sprite-scale.json 을 만든다.
그림마다 실제로 칠해진 픽셀 수(=눈에 보이는 덩치)를 재서, 바뀐 모습이 기본 모습보다 작아 보이면
(예: 대여르 → 메가대여르, 길게 늘어선 무리가 한 덩어리로 뭉쳐 작아 보임) 기본 모습의 1.3배 덩치가 되게 키우는 배율을 적는다.
값: { 그림 id: [정지 도트 그림 배율, 움직이는 3D 그림 배율] } (1 이면 생략)
사용법: python3 battle-kr/scripts/sprite-scale.py  (쇼다운 스프라이트 서버·PokeAPI 에서 그림을 받아 잼)
"""
import io, json, os, re, sys, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'src')
HOST = 'https://play.pokemonshowdown.com/sprites'
sys.path.insert(0, HERE)
ZA = {}
exec(re.search(r'IDS = \{.*?\n\}', open(os.path.join(HERE, 'fetch-za-megas.py')).read(), re.S).group(0), {}, ZA)
ZA = ZA['IDS']
POKEAPI = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/'


def ids():
    pad = json.load(open(os.path.join(SRC, 'gen', 'sprite-pad.json')))
    return sorted(k for k in pad if re.search(r'-(mega[xyz]?|primal)$', k) and k != 'yanmega')


def get(url):
    try:
        return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (BattleSimKR sprite tool)'}), timeout=30).read()
    except Exception:
        return None


def mass(data):
    """칠해진 픽셀 수 (움직이는 그림은 첫 장)"""
    im = Image.open(io.BytesIO(data))
    im.seek(0)
    a = im.convert('RGBA').split()[3]
    return sum(1 for v in a.tobytes() if v > 20)


def static(i):
    if i in ZA:
        d = get(POKEAPI + '%d.png' % ZA[i])
        if d: return d
    return get(f'{HOST}/gen5/{i}.png')


def ani(i):
    return get(f'{HOST}/ani/{i}.gif')


def main():
    out = {}
    for i in ids():
        base = re.sub(r'-(mega[xyz]?|primal)$', '', i)
        row = []
        for fetch in (static, ani):
            m, b = fetch(i), fetch(base)
            if not m or not b:
                row.append(1); continue
            mm, mb = mass(m), mass(b)
            k = max(1.0, min(1.6, (1.3 * mb / mm) ** 0.5)) if mm else 1.0
            row.append(round(k, 2))
        if row != [1, 1]:
            out[i] = row
            print(i, row)
    json.dump(out, open(os.path.join(SRC, 'gen', 'sprite-scale.json'), 'w'), separators=(',', ':'), sort_keys=True)
    print('sprite-scale.json:', len(out))


if __name__ == '__main__':
    main()
