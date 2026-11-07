#!/usr/bin/env python3
"""랭커·대회 팀 데이터를 받아 src/gen/ranker-teams.json 으로 줄인다. (PokéDB 스칼렛·바이올렛 팀은 fetch-pokedb.cjs 가 따로)

  cd : 챔피언스 더블 실제 팀 — Limitless 대회 상위 입상 팀(https://play.limitlesstcg.com/api, 키 없이 5분에 50번)
       + VGCPastes 저장소(공개 구글 시트 → pokepast.es) 팀. 6마리 전부 도구·특성·기술·성격, VGCPastes 는 능력 포인트까지.
  cs : 챔피언스 싱글 — Smogon 통계(BSS Reg M-C·Champions OU)의 '같이 쓰는 포켓몬'으로 조립한 팀 (6마리 종류만, 세트는 앱이 통계로)
  us : 무제한 싱글 — Smogon Anything Goes·전국도감 Ubers·Ubers 통계로 조립
  ud : 무제한 더블 — Smogon Doubles Ubers 통계로 조립

팀 한 줄: [점수, 출처 이름, 날짜, 포켓몬들]. 포켓몬: [종 id, 도구 id, 특성 id, [기술 id], 성격, [HP,공,방,특공,특방,스피드 능력 포인트] 또는 0]
조립 팀의 포켓몬은 [종 id] 만.
사용: python3 scripts/fetch-ranker-teams.py [--tours N] [--pastes N] [--keep N]   (받은 응답은 ~/.cache/battle-kr-teams 에 저장해 다시 받지 않음)
"""
import csv, hashlib, io, json, math, os, random, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '../src/gen/ranker-teams.json')
DEX = os.path.join(HERE, '../src/gen/dex.json')
CACHE = os.path.expanduser('~/.cache/battle-kr-teams')
UA = {'User-Agent': 'BattleSim-KR team data (github.com/samang600/BattleSim-KR)'}
LIM = 'https://play.limitlesstcg.com/api'
SHEET = '1axlwmzPA49rYkqXh7zHvAtSP-TKbM0ijGYBPRflLSWw'
SHEET_TABS = {'M-C': '2001945654', 'M-B': '1458357160', 'M-A': '791705272'}
SMOGON = 'https://www.smogon.com/stats/'
STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
EVKEY = {'hp': 'hp', 'atk': 'atk', 'def': 'def', 'spa': 'spa', 'spd': 'spd', 'spe': 'spe'}

args = sys.argv[1:]
def arg(name, d):
	return int(args[args.index(name) + 1]) if name in args else d
N_TOURS = arg('--tours', 45)     # 포맷마다 참가자 많은 순으로 몇 개 대회
N_PASTES = arg('--pastes', 400)  # 포맷마다 VGCPastes 최근 몇 팀
N_KEEP = arg('--keep', 1200)    # 챔피언스 더블 팀을 점수 순으로 몇 개까지

dex = json.load(open(DEX))
SPECIES, ITEMS, MOVES = dex['species'], dex['items'], dex['moves']
ABIL = dex.get('abilities', {})


def to_id(s):
	return re.sub(r'[^a-z0-9]', '', str(s or '').lower())


last_lim = [0.0]
def get(url, limitless=False, ttl=None):
	os.makedirs(CACHE, exist_ok=True)
	f = os.path.join(CACHE, hashlib.md5(url.encode()).hexdigest())
	if os.path.exists(f) and (ttl is None or time.time() - os.path.getmtime(f) < ttl):
		return open(f, 'rb').read()
	if limitless:  # 5분에 50번 → 6.2초 간격
		wait = 6.2 - (time.time() - last_lim[0])
		if wait > 0:
			time.sleep(wait)
		last_lim[0] = time.time()
	for k in range(4):
		try:
			data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
			open(f, 'wb').write(data)
			return data
		except Exception as e:
			if k == 3:
				raise
			print('  다시', url, e)
			time.sleep(20 if limitless else 3)


def species_id(name):
	sid = to_id(name)
	if sid in SPECIES:
		return sid
	for alt in (sid.replace('mega', ''), re.sub(r'(f|m)$', '', sid)):
		if alt in SPECIES:
			return alt
	return None


def demega(sid):
	"""메가진화 모습 → 진화 전 모습 (메가스톤은 앱이 통계로 줌). 플라엣테 메가는 영원의 꽃 플라엣테에서"""
	if not sid or '-Mega' not in SPECIES[sid].get('en', ''):
		return sid
	base = species_id(SPECIES[sid]['en'].split('-Mega')[0])
	return 'floetteeternal' if base == 'floette' else base


def mon_full(name, item, ability, moves, nature, sp):
	sid = species_id(name)
	if not sid:
		return None
	mv = [to_id(m) for m in moves if to_id(m) in MOVES][:4]
	if len(mv) < 2:
		return None
	it = to_id(item)
	if sid == 'floette':   # 대회에서 쓰는 플라엣테는 영원의 꽃 (메가진화)
		sid = 'floetteeternal'
	# 성격이 비어 있으면 '' (앱이 통계로 채움)
	return [sid, it if it in ITEMS else '', to_id(ability), mv, to_id(nature), sp or 0]


def sig(mons):
	return '|'.join(sorted(m[0] + ':' + ','.join(sorted(m[3])) for m in mons))


# ── 1. 챔피언스 더블: Limitless ──
def limitless():
	tours = json.loads(get(f'{LIM}/tournaments?game=VGC&limit=5000', True, ttl=6 * 3600))
	rows = []
	for fmt in ('M-C', 'M-B', 'M-A'):
		ts = sorted([t for t in tours if t.get('format') == fmt and (t.get('players') or 0) >= 32], key=lambda t: -t['players'])[:N_TOURS]
		print('Limitless', fmt, len(ts), '대회')
		for i, t in enumerate(ts):
			try:
				st = json.loads(get(f"{LIM}/tournaments/{t['id']}/standings", True))
			except Exception as e:
				print('  실패', t['name'], e); continue
			n = t['players']
			cut = max(8, n // 8)   # 상위 1/8 (최소 8등)
			for p in st:
				pl, dl = p.get('placing'), p.get('decklist')
				if not pl or pl > cut or not isinstance(dl, list) or len(dl) < 4:
					continue
				mons = [mon_full(m.get('name') or m.get('id'), m.get('item'), m.get('ability'), m.get('attacks') or [], m.get('nature'), 0) for m in dl]
				if None in mons:
					continue
				score = round(40 + 6 * math.log2(n) - 8 * math.log2(pl), 1)   # 256명 우승 88 · 64명 8위 52 (VGCPastes 기본 55와 맞춤)
				rows.append([score, f"{t['name'][:40]} {pl}위", t['date'][:10], mons])
			if (i + 1) % 10 == 0:
				print(' ', fmt, i + 1, '/', len(ts), len(rows), '팀')
	return rows


# ── 2. 챔피언스 더블: VGCPastes ──
def parse_paste(text):
	mons = []
	for block in re.split(r'\n\s*\n', text.replace('\r', '').strip()):
		lines = [l.strip() for l in block.split('\n') if l.strip()]
		if not lines:
			continue
		head = lines[0]
		item = head.split(' @ ')[1] if ' @ ' in head else ''
		name = head.split(' @ ')[0]
		name = re.sub(r'\s*\((M|F)\)\s*$', '', name)
		m = re.search(r'\(([^()]+)\)\s*$', name)   # 별명 (종)
		if m and species_id(m.group(1)):
			name = m.group(1)
		ability, nature, moves, sp = '', '', [], None
		for l in lines[1:]:
			if l.startswith('Ability:'):
				ability = l[8:]
			elif l.endswith('Nature'):
				nature = l[:-6]
			elif l.startswith('- '):
				moves.append(l[2:].split(' / ')[0])
			elif l.startswith('EVs:'):
				raw = [0] * 6
				for part in l[4:].split('/'):
					mm = re.match(r'\s*(\d+)\s*(HP|Atk|Def|SpA|SpD|Spe)', part)
					if mm:
						raw[['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'].index(mm.group(2))] = int(mm.group(1))
				# 본가 노력치(합계 510·최대 252)로 적은 팀은 포인트로 바꿈
				sp = raw if sum(raw) <= 66 and max(raw) <= 32 else [0 if v < 4 else min(32, 1 + (v - 4) // 8) for v in raw]
		mon = mon_full(name, item, ability, moves, nature, sp)
		if mon:
			mons.append(mon)
	return mons


def vgcpastes():
	rows = []
	for fmt, gid in SHEET_TABS.items():
		raw = get(f'https://docs.google.com/spreadsheets/d/{SHEET}/export?format=csv&gid={gid}', ttl=6 * 3600).decode('utf-8', 'replace')
		r = list(csv.reader(io.StringIO(raw)))
		hdr = next(i for i, row in enumerate(r) if row and row[0] == 'Team ID')
		H = r[hdr]
		ip, ie, idt = H.index('Pokepaste'), H.index('EVs'), H.index('Date Shared')
		body = [row for row in r[hdr + 1:] if len(row) > ip and row[ip].startswith('https://pokepast.es/')][:N_PASTES]
		print('VGCPastes', fmt, len(body), '팀')
		for i, row in enumerate(body):
			try:
				js = json.loads(get(row[ip].rstrip('/') + '/json'))
			except Exception as e:
				print('  실패', row[ip], e); continue
			mons = parse_paste(js.get('paste', ''))
			if len(mons) < 6:
				continue
			desc = row[1]
			# 입상 기록이 적힌 팀일수록 점수 높게
			score = 55
			if re.search(r'champion|winner|1st', desc, re.I): score = 80
			elif re.search(r'finalist|2nd|top ?4|semi', desc, re.I): score = 72
			elif re.search(r'top ?8|top ?16|top ?cut|regional|international|worlds', desc, re.I): score = 64
			if row[ie] != 'Yes': score -= 5
			rows.append([score, desc[:50] or 'VGCPastes', row[idt], mons])
			if (i + 1) % 100 == 0:
				print(' ', fmt, i + 1, len(rows))
	return rows


# ── 3. 통계로 팀 조립 ──
def chaos(fmts):
	month = sorted(re.findall(r'href="(\d{4}-\d{2})/"', get(SMOGON, ttl=24 * 3600).decode()))[-1]
	acc = {}
	for fmt, w in fmts:
		try:
			data = json.loads(get(f'{SMOGON}{month}/chaos/{fmt}.json'))['data']
		except Exception as e:
			print('  없음', fmt, e); continue
		for name, d in data.items():
			sid = demega(species_id(name))
			if not sid:
				continue
			tot = sum(d.get('Abilities', {}).values())
			if tot < 1:
				continue
			a = acc.setdefault(sid, {'u': 0.0, 'tm': {}})
			a['u'] += w * d.get('usage', 0)
			for k, v in (d.get('Teammates') or {}).items():
				k2 = demega(species_id(k))
				if k2 and v > 0:
					a['tm'][k2] = a['tm'].get(k2, 0) + w * v / tot
	return month, acc


def assemble(acc, n, label, date, seed):
	rnd = random.Random(seed)
	pool = sorted(acc.items(), key=lambda kv: -kv[1]['u'])[:80]
	ids = [k for k, _ in pool]
	usage = {k: v['u'] for k, v in pool}
	rows, seen = [], set()
	for _ in range(n * 6):
		if len(rows) >= n:
			break
		# 첫 포켓몬: 사용률 비례
		first = rnd.choices(ids, [usage[k] for k in ids])[0]
		team = [first]
		while len(team) < 6:
			cand = [k for k in ids if k not in team and SPECIES[k].get('base', k) not in [SPECIES[t].get('base', t) for t in team]]
			# 이미 고른 포켓몬들과 같이 쓰인 정도의 곱(+작은 사용률 보정)
			ws = []
			for k in cand:
				s = 1.0
				for t in team:
					s *= 0.02 + acc[t]['tm'].get(k, 0) + acc[k]['tm'].get(t, 0)
				ws.append(s ** (1 / len(team)) * (0.3 + math.sqrt(usage[k] / usage[ids[0]])))
			if not cand or sum(ws) <= 0:
				break
			team.append(rnd.choices(cand, ws)[0])
		if len(team) < 6:
			continue
		key = '|'.join(sorted(team))
		if key in seen:
			continue
		seen.add(key)
		# 점수: 팀 안의 '같이 쓰인 정도' 평균
		syn = sum(acc[a]['tm'].get(b, 0) for a in team for b in team if a != b) / 30
		rows.append([round(40 + 200 * syn, 1), label, date, [[k] for k in team]])
	return rows


def main():
	out = {'_src': {'cd': 'Limitless (play.limitlesstcg.com) 대회 상위 입상 팀 + VGCPastes 저장소',
	                'cs': 'Smogon 사용률 통계로 조립 (BSS Reg M-C·Champions OU)',
	                'us': 'Smogon 사용률 통계로 조립 (Anything Goes·전국도감 Ubers·Ubers)',
	                'ud': 'Smogon 사용률 통계로 조립 (Doubles Ubers)'}}
	cd = vgcpastes() + limitless()
	uniq = {}
	for r in cd:
		k = sig(r[3])
		if k not in uniq or uniq[k][0] < r[0] or (uniq[k][0] == r[0] and not uniq[k][3][0][5] and r[3][0][5]):
			uniq[k] = r
	out['cd'] = sorted(uniq.values(), key=lambda r: -r[0])[:N_KEEP]   # 점수 높은 팀만 (앱 크기)
	m, acc = chaos([('gen9championsbssregmc-1630', 3), ('gen9championsou-1630', 1)])
	out['cs'] = assemble(acc, 200, f'Smogon 통계 조립 ({m})', m, 1)
	m, acc = chaos([('gen9anythinggoes-1630', 3), ('gen9nationaldexubers-1630', 2), ('gen9ubers-1630', 1)])
	out['us'] = assemble(acc, 200, f'Smogon 통계 조립 ({m})', m, 2)
	m, acc = chaos([('gen9doublesubers-1630', 3), ('gen9nationaldexdoublesubers-1630', 2)])
	out['ud'] = assemble(acc, 150, f'Smogon 통계 조립 ({m})', m, 3)
	json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
	print('ranker-teams.json', {k: len(v) for k, v in out.items() if k != '_src'}, os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
	main()
