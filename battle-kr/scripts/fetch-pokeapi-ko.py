#!/usr/bin/env python3
"""PokeAPI(게임 속 공식 문구 모음)에서 한국어 기술·도구·특성 이름과 설명을 받아,
쇼다운 데이터에 한국어 설명이 비어 있거나 '사용할 수 없는 기술' 안내문뿐인 항목을 채울 보충 데이터를 만든다.
출력: src/ps/ko-text-fallback.json  {moves|items|abilities: {id: {n?: 이름, d?: 설명}}}
gen-data.cjs 가 쇼다운 설명이 없을 때 이 값을 쓴다. 사용: python3 scripts/fetch-pokeapi-ko.py"""
import csv, io, json, os, re, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '../src/ps/ko-text-fallback.json')
BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
KO = '3'

def rows(name):
    data = urllib.request.urlopen(BASE + name + '.csv', timeout=120).read().decode('utf-8')
    return list(csv.DictReader(io.StringIO(data)))

def to_id(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())

def clean(t):
    t = re.sub(r'[\s­\u000c]+', ' ', t).strip()
    return t.replace(' .', '.')

order = {r['id']: int(r['order']) for r in rows('version_groups')}
out = {}
for kind, table, key, flav in (('moves', 'moves', 'move_id', 'move_flavor_text'), ('items', 'items', 'item_id', 'item_flavor_text'),
                               ('abilities', 'abilities', 'ability_id', 'ability_flavor_text')):
    ident = {r['id']: to_id(r['identifier']) for r in rows(table)}
    names = {}
    for r in rows(table[:-1] + '_names' if table != 'abilities' else 'ability_names'):
        if r['local_language_id'] == KO: names[r[key]] = r['name'].strip()
    best = {}
    for r in rows(flav):
        if r.get('language_id') != KO: continue
        t = clean(r['flavor_text'])
        if not t or '사용할 수 없는 기술' in t: continue          # 9세대의 '사용할 수 없는 기술입니다' 안내문은 쓰지 않음
        o = order.get(r['version_group_id'], 0)
        if r[key] not in best or o > best[r[key]][0]: best[r[key]] = (o, t)
    tab = {}
    for i, sid in ident.items():
        e = {}
        if i in names: e['n'] = names[i]
        if i in best: e['d'] = best[i][1]
        if e: tab[sid] = e
    out[kind] = tab
    print(kind, len(tab), '항목 (설명', sum(1 for v in tab.values() if 'd' in v), ')')
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('저장:', OUT, os.path.getsize(OUT) // 1024, 'KB')
