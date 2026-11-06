#!/usr/bin/env python3
"""나무위키 미러(namu.moe)에서 쇼다운·PokeAPI 에 한국어가 없는 기술·도구·특성의 공식 한국어 이름과 게임 속 설명을 모은다.
  기술: 개별 문서의 [include(틀:포켓몬 기술, 한칭=…, 효과=…)]
  특성: '포켓몬스터/특성/ㄱ'… 초성별 목록 (이름 | (일본어 / 영어) | 설명 | 첫 등장)
  도구: 개별 문서 정보 상자의 '설명'
  문서가 없는 메가스톤·Z크리스탈: 공식 문구 형식을 따라 만듦 (표시: gen)
출력: src/ps/ko-text-namu.json. 요청 사이 1초 대기. 사용: python3 scripts/fetch-namu-ko.py"""
import html, json, os, re, time, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DEX = os.path.join(HERE, '../src/gen/dex.json')
FB = os.path.join(HERE, '../src/ps/ko-text-fallback.json')
OUT = os.path.join(HERE, '../src/ps/ko-text-namu.json')
HANG = re.compile('[가-힣]')
UA = {'User-Agent': 'battle-kr build script (Korean names/descriptions, 1 req/s)'}

def to_id(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())

CACHE = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'namu-cache')
def page(title, raw=False):
    """받은 문서는 CACHE 에 저장해 두고 다시 쓰므로, 고쳐서 다시 돌려도 같은 문서를 또 요청하지 않음"""
    os.makedirs(CACHE, exist_ok=True)
    cp = os.path.join(CACHE, urllib.parse.quote(title, safe='') + '.html')
    if os.path.exists(cp):
        t = open(cp, encoding='utf-8').read()
        if t == '404': return None
    else:
        u = 'https://namu.moe/w/' + urllib.parse.quote(title)
        time.sleep(1.0)
        try:
            t = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read().decode('utf-8')
        except urllib.error.HTTPError:
            open(cp, 'w').write('404'); return None
        except Exception as ex:          # 시간 초과 등은 저장하지 않고 건너뜀 (다음 실행에서 다시 시도)
            print('  요청 실패', title, ex); return None
        open(cp, 'w', encoding='utf-8').write(t)
    if raw: return t
    t = re.sub(r'<script.*?</script>|<style.*?</style>', '', t, flags=re.S)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' | ', t)))

def clean(s):
    s = re.sub(r'\s*\|\s*', ' ', s); s = re.sub(r'\[\d+\]', '', s)
    return re.sub(r'^[★☆]\s*', '', re.sub(r'\s+', ' ', s).strip())

def usable(d):
    return bool(d) and bool(HANG.search(d)) and '사용할 수 없는 기술' not in d

dex = json.load(open(DEX)); fb = json.load(open(FB))
need = {}
for cat in ('moves', 'items', 'abilities'):
    need[cat] = []
    for k, v in dex[cat].items():
        if cat == 'moves' and (v.get('z') or v.get('x')): continue
        has_d = usable(v.get('d', '')) or usable(fb[cat].get(k, {}).get('d', ''))
        has_n = bool(HANG.search(v.get('n', ''))) or bool(HANG.search(fb[cat].get(k, {}).get('n', '')))
        if not has_d or not has_n: need[cat].append(k)
    print(cat, '찾을 항목', len(need[cat]))

out = {'moves': {}, 'items': {}, 'abilities': {}}
# 문서 제목을 알려 줌: 한국어 이름이 아직 없는 것, 쇼다운 한국어 이름이 공식과 다른 것(FIX: 이름도 바로잡음)
TITLE = {'nihillight': '니힐레이저', 'doodle': '베껴그리기', 'collisioncourse': '액셀브레이크'}
FIX = {'doodle', 'collisioncourse'}

# ── 기술 ──
for k in need['moves'] + [x for x in FIX if x not in need['moves']]:
    v = dex['moves'][k]
    title = TITLE.get(k) or v['n']
    t = None
    for suf in ('', '(기술)', '(포켓몬스터)'):
        p_ = page(title + suf)
        if p_ and ('틀:포켓몬 기술' in p_ or 'PP}}}' in p_): t = p_; break
    if not t: print('  기술 문서 없음', k, title); continue
    e = {}
    m = re.search(r'\[include\(틀:포켓몬 기술,(.*?)\)\]', t)
    if m:
        body = re.sub(r'\s*\|\s*', ' ', m.group(1))   # 태그를 펼치며 생긴 | 제거
        f = dict((a.strip(), b.strip()) for a, b in re.findall(r'([가-힣A-Za-z0-9]+)=([^=]*?)(?=,\s*[가-힣A-Za-z0-9]+=|$)', body))
        if f.get('한칭'): e['n'] = clean(f['한칭'])
        if usable(f.get('효과', '')): e['d'] = clean(f['효과'])
    else:   # 틀이 펼쳐진 채 저장된 문서: "PP}}}… N | ||<…>효과 | #!if 효과2"
        m = re.search(r'PP\}+ \d+ [|\s]+\|\|(?:<[^>]*>)*([^<>|]+?) [|\s]+#!if 효과2', t)
        if m and usable(clean(m.group(1))): e['d'] = clean(m.group(1))
        e['n'] = title
    if k in FIX and e.get('n'): e['fix'] = 1
    if e: out['moves'][k] = e
    print('  기술', k, e)

# ── 특성: 초성별 목록 ──
ab = {}
for c in 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ':
    t = page('포켓몬스터/특성/' + c)
    if not t: continue
    for m in re.finditer(r'\| ([가-힣A-Za-z0-9·]+) [|\s]+\(([^/)]+?)\s*/\s*([^)]+?)\s*\) [|\s★☆]+(.+?) [|\s]+첫 등장', t):
        ko, en, desc = m.group(1), m.group(3), clean(m.group(4))
        if len(desc) < 300: ab[to_id(en)] = (ko, desc)
print('특성 목록에서', len(ab), '개')
# 오거폰의 초상투영: 가면마다 오르는 능력이 다름 (게임 속 문구 형식)
for mk, (mask, stat) in {'teal': ('벽록의가면', '스피드를'), 'hearthflame': ('화덕의가면', '공격을'),
                         'wellspring': ('우물의가면', '특방을'), 'cornerstone': ('주춧돌의가면', '방어를')}.items():
    ab['embodyaspect' + mk] = (dex['abilities'].get('embodyaspect' + mk, {}).get('n', '초상투영'),
                               f'마음속에 깃든 추억의 힘으로 {mask}을 빛나게 하여 자신의 {stat} 올린다.')
for k in need['abilities']:
    if k in ab:
        ko, desc = ab[k]; e = {'n': ko}
        if usable(desc): e['d'] = desc
        out['abilities'][k] = e
    else: print('  특성 없음', k, dex['abilities'][k]['n'])

# ── 도구 ──
species_ko = {k: v['n'] for k, v in dex['species'].items()}
TYPE_KO = dex.get('types', {})
MASK = {'tealmask': ('벽록', 0), 'hearthflamemask': ('화덕', 1), 'wellspringmask': ('우물', 1), 'cornerstonemask': ('주춧돌', 1)}
# 분류별 도구 목록 문서: "이름 | 일본어 / English | 설명 | … | 가격·도입…" (개별 문서가 없는 9세대 도구가 여기 있음)
itm = {}
for title in ('포켓몬스터/도구/배틀', '포켓몬스터/도구/배틀/기술 강화', '포켓몬스터/도구/배틀/능력치 강화', '포켓몬스터/도구/배틀/전용 도구',
              '포켓몬스터/도구/육성', '포켓몬스터/도구/진화', '포켓몬스터/배틀 도구', '나무열매(포켓몬스터)'):
    t = page(title)
    if not t: continue
    t = re.sub(r'(\| )+', '| ', t)
    for m in re.finditer(r'\| ([^|]{1,20}?) \| [^|/]{1,40}/ ?([A-Za-z][A-Za-z\' .-]{1,30}?) \| 설명 \| (.+?) \| (?:가격|도입|입수|분류|되팔기)', t):
        d = clean(m.group(3))
        if usable(d) and len(d) < 300: itm.setdefault(to_id(m.group(2)), d)
print('도구 목록에서', len(itm), '개')
for k in need['items']:
    v = dex['items'][k]; name = v['n']
    if k in itm:
        out['items'][k] = {'d': itm[k]}; print('  도구(목록)', k, itm[k]); continue
    t = page(name)
    m = re.search(r'\| 설명 [|\s]+(.+?) [|\s]+(?:가격|도입|입수|분류)', t) if t else None
    if m and usable(clean(m.group(1))):
        out['items'][k] = {'d': clean(m.group(1))}; print('  도구', k, out['items'][k]); continue
    # 문서가 없으면 공식 문구 형식으로
    if v.get('mega') and v.get('megaFrom'):
        base = to_id(v['megaFrom'][0]) if isinstance(v['megaFrom'], list) else to_id(v['megaFrom'])
        pk = species_ko.get(base, '').split('(')[0].strip() or name.replace('나이트', '')
        out['items'][k] = {'d': f'{pk}에게 지니게 하면 배틀할 때 메가진화할 수 있는 신비한 메가스톤의 일종.', 'gen': 1}
    elif k in MASK:
        form, boost = MASK[k]
        out['items'][k] = {'d': f'오거폰에게 지니게 하면 {form}의 모습이 되는 가면.' + (' 기술의 위력이 조금 올라간다.' if boost else ''), 'gen': 1}
    elif v.get('zt'):
        tko = TYPE_KO.get(v['zt'], v['zt'])
        out['items'][k] = {'d': f'{tko}타입 기술을 Z기술로 업그레이드하는 Z크리스탈. 지니게 하면 Z기술을 쓸 수 있다.', 'gen': 1}
    elif v.get('zf') and k.endswith('z'):
        out['items'][k] = {'d': '특정 포켓몬의 전용 기술을 Z기술로 업그레이드하는 Z크리스탈. 지니게 하면 그 포켓몬이 Z기술을 쓸 수 있다.', 'gen': 1}
    else:
        print('  도구 없음', k, name); continue
    print('  도구(형식)', k, out['items'][k])

# dex.json 이 이미 이 파일로 채워져 있으면 '찾을 항목'이 줄어드므로, 예전 결과는 지우지 않고 합침
try: prev = json.load(open(OUT, encoding='utf-8'))
except Exception: prev = {}
for c in out:
    out[c] = {**prev.get(c, {}), **out[c]}
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('저장', OUT, {c: len(v) for c, v in out.items()})
