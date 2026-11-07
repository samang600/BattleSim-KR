#!/usr/bin/env python3
"""Smogon 사용률 통계(chaos JSON)를 받아 src/gen/smogon.json 으로 줄인다.
AI 팀(세트·동료 구성)과 6→3/6→4 참가 선택에 쓰임.

묶음: s=내셔널 도감 싱글(무제한 AG 포함), d=내셔널 도감 더블, cs=챔피언스 싱글(BSS Reg M-C), cd=챔피언스 더블(VGC Reg M-C)
포켓몬마다: m 기술 / i 도구 / a 특성 / s 성격·노력치 / t 테라 / tm 같이 쓰는 포켓몬 / cc 이 포켓몬을 잘 잡는 포켓몬 / u 사용 비중
비율은 0~100 정수. 사용: python3 scripts/fetch-smogon.py [YYYY-MM]  (기본: 가장 최근 달)
"""
import json, os, re, sys, tempfile, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '../src/gen/smogon.json')
BASE = 'https://www.smogon.com/stats/'
UA = {'User-Agent': 'battle-kr stats fetcher'}

# 묶음별 (포맷, 가중치). 앞에 있을수록 이 앱 규칙에 가까워 가중치를 높게
GROUPS = {
	's': [('gen9nationaldex-1630', 3), ('gen9nationaldexubers-1630', 3), ('gen9nationaldexuu-1630', 2), ('gen9ou-1695', 1),
		('gen9ubers-1630', 1), ('gen9anythinggoes-1630', 1), ('gen9uu-1630', 1), ('gen9ru-1630', 1), ('gen9nu-1630', 1)],
	'd': [('gen9nationaldexdoubles-1630', 3), ('gen9doublesou-1695', 2), ('gen9doublesubers-1630', 2), ('gen9vgc2024regg-1630', 1)],
	'cs': [('gen9championsbssregmc-1630', 3), ('gen9championsou-1630', 1)],
	'cd': [('gen9championsvgc2026regmc-1630', 3)],
}
TOP = {'m': 12, 'i': 6, 'a': 3, 's': 4, 't': 4, 'tm': 10, 'cc': 8}


def get(url):
	return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()


def to_id(s):
	return re.sub(r'[^a-z0-9]', '', str(s).lower())


def latest_month():
	html = get(BASE).decode('utf-8', 'replace')
	return sorted(re.findall(r'href="(\d{4}-\d{2})/"', html))[-1]


def top(d, n, total):
	items = sorted(((k, v) for k, v in d.items() if v > 0), key=lambda kv: -kv[1])[:n]
	return [[k, max(1, round(100 * v / total))] for k, v in items if total > 0 and 100 * v / total >= 0.5]


def main():
	month = sys.argv[1] if len(sys.argv) > 1 else latest_month()
	out = {'_month': month}
	tmp = tempfile.mkdtemp(prefix='smogon-')
	for g, fmts in GROUPS.items():
		acc = {}
		for fmt, w in fmts:
			try:
				raw = get(f'{BASE}{month}/chaos/{fmt}.json')
			except Exception as e:
				print('없음:', fmt, e); continue
			data = json.loads(raw)['data']
			print(g, fmt, len(data), '종')
			for name, d in data.items():
				sid = to_id(name)
				total = sum(d.get('Abilities', {}).values()) or 0
				if total < 1:
					continue
				a = acc.setdefault(sid, {k: {} for k in ('m', 'i', 'a', 's', 't', 'tm', 'cc')} | {'u': 0.0})
				a['u'] += w * total
				for key, src in (('m', 'Moves'), ('i', 'Items'), ('a', 'Abilities'), ('s', 'Spreads'), ('t', 'Tera Types')):
					for k, v in (d.get(src) or {}).items():
						if key != 's':
							k = to_id(k)
						if not k or k == 'nothing':
							continue
						a[key][k] = a[key].get(k, 0) + w * v
				# 동료: 값은 '같이 쓰인 정도'(가중 횟수). 양수만
				for k, v in (d.get('Teammates') or {}).items():
					if v > 0:
						a['tm'][to_id(k)] = a['tm'].get(to_id(k), 0) + w * v
				# 체크·카운터: [횟수, 이 포켓몬이 쓰러지거나 교체된 비율, 표준편차] → 비율 - 4σ 가 Smogon 의 점수
				for k, v in (d.get('Checks and Counters') or {}).items():
					if isinstance(v, list) and len(v) >= 3 and v[0] >= 20:
						score = v[1] - 4 * v[2]
						if score > 0.3:
							a['cc'][to_id(k)] = max(a['cc'].get(to_id(k), 0), score)
		grp = {}
		for sid, a in acc.items():
			tot = a['u']
			e = {'u': round(tot)}
			for key in ('m', 'i', 'a', 's', 't'):
				t = top(a[key], TOP[key], tot)  # 기술도 '이 기술을 가진 비율'이라 총합으로 나눔
				if t:
					e[key] = t
			if a['tm']:
				e['tm'] = top(a['tm'], TOP['tm'], tot)
			if a['cc']:
				e['cc'] = [[k, round(v * 100)] for k, v in sorted(a['cc'].items(), key=lambda kv: -kv[1])[:TOP['cc']]]
			grp[sid] = e
		out[g] = grp
	json.dump(out, open(OUT, 'w'), separators=(',', ':'))
	print('smogon.json:', month, {g: len(out[g]) for g in GROUPS}, os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
	main()
