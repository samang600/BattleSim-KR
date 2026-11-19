#!/usr/bin/env node
/**
 * 배틀타워 상대 포켓몬 표 (docs/tower-sheet.html) 만들기.
 * 타워 상대는 고정 목록이 아니라 연승 구간마다 종족값 범위·통계 세트에서 뽑으므로, 실제 생성 함수(modes.tsx towerOpponent)를
 * 구간마다 여러 번 돌려 나온 포켓몬·세트를 집계한다 (기본 규칙: 전국도감 · 초전설/환상 불가 · 난이도 보통).
 *   node build.mjs --test && node scripts/gen-tower-sheet.cjs [구간당 팀 수=4000]
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const HERE = path.join(__dirname, '..');
const N = +(process.argv[2] || 4000);
const D = require(path.join(HERE, 'src/gen/dex.json'));
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// 구간: [이름, 설명, 연승 수(그 구간의 일반 트레이너 승부)]
const STAGES = [
	['1~6번째', '세트 1 · 약한 최종 진화, 능력 포인트 절반', [0, 1, 2, 3, 4, 5]],
	['8~13번째', '세트 2 · 종족값 450~519(10연승 뒤 ~530) · Z기술은 11번째부터', [7, 8, 9, 10, 11, 12]],
	['15~20번째', '세트 3 · 종족값 480~539 · 메가진화 없음', [14, 15, 16, 17, 18, 19]],
	['22~27번째', '세트 4 · 종족값 500~569 · 메가진화·준전설 등장', [21, 22, 23, 24, 25, 26]],
	['29~34번째', '세트 5 · 종족값 520~569 + 강한 포켓몬 한 마리(~640) · 랭커 팀 가끔', [28, 29, 30, 31, 32, 33]],
	['36~41번째', '세트 6 · 종족값 529~569 + 강한 포켓몬 한 마리(~700)', [35, 36, 37, 38, 39, 40]],
	['43~48번째', '세트 7 · 종족값 529~569 + 강한 포켓몬 한 마리(~720) · 랭커 팀 자주', [42, 43, 44, 45, 46, 47]],
	['51번째~', '세트 8 이후 · 종족값 560~720 제한 없음 · 랭커 팀 자주', [50, 51, 52, 53, 54, 57, 58, 59, 60, 64, 65, 71]],
];
(async () => {
	const b = await chromium.launch(); const p = await b.newPage();
	await p.goto('file://' + path.join(HERE, 'test/selfplay.html')); await p.waitForTimeout(1500);
	const raw = await p.evaluate(([STAGES, N]) => {
		const R = window.__ranker; R.applyRuleData(R.ruleById('mzdt_one.natdex.no.no'));
		const out = {};
		for (const fmt of ['singles', 'doubles']) out[fmt] = STAGES.map(([, , streaks]) => {
			const sp = {}; let teams = 0, ranker = 0;
			for (let k = 0; k < N; k++) {
				const o = window.__tower(streaks[k % streaks.length], fmt, [], false, 'normal'); teams++; if (o.ranker) ranker++;
				for (const s of o.team) {
					const e = sp[s.species] ||= { n: 0, item: {}, abil: {}, spread: {}, move: {}, tera: {} };
					e.n++; const inc = (t, key) => { t[key] = (t[key] || 0) + 1; };
					inc(e.item, s.item || ''); inc(e.abil, s.ability || ''); for (const m of s.moves) inc(e.move, m); if (s.teraType) inc(e.tera, s.teraType);
					inc(e.spread, s.nature + '|' + ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(x => s.evs[x] || 0).join('/') + '|' + ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(x => s.ivs?.[x] ?? 31).join('/'));
				}
			}
			return { teams, ranker, sp };
		});
		return out;
	}, [STAGES, N]);
	await b.close();
	// 집계 → 표 데이터
	const stat = (base, ev, iv, nat, hp) => hp ? (base === 1 ? 1 : Math.floor((2 * base + iv + Math.floor(ev / 4)) * 50 / 100) + 60) : Math.floor((Math.floor((2 * base + iv + Math.floor(ev / 4)) * 50 / 100) + 5) * nat);
	const KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
	const top = (t, k, tot) => Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, k).map(([id, c]) => [id, Math.round(c / tot * 100)]);
	const data = {};
	for (const fmt of ['singles', 'doubles']) data[fmt] = raw[fmt].map((st, si) => {
		const rows = [];
		for (const [name, e] of Object.entries(st.sp)) {
			const id = toID(name), s = D.species[id]; if (!s) continue;
			const g = s.g[9], bs = g.bs;
			const spreads = Object.entries(e.spread).sort((a, b) => b[1] - a[1]);
			const calc = key => { const [nat, ev, iv] = key.split('|'); const n = D.natures[toID(nat)] || {}; const E = ev.split('/').map(Number), I = iv.split('/').map(Number);
				return KEYS.map((k, i) => stat(bs[i], E[i], I[i], n.p === k && n.m !== k ? 1.1 : n.m === k && n.p !== k ? 0.9 : 1, i === 0)); };
			const all = spreads.map(([k]) => calc(k));
			const [nat, ev] = spreads[0][0].split('|');
			const en = s.en, dash = en.indexOf('-');
			const sid = dash < 0 || ['Ho-Oh', 'Porygon-Z', 'Jangmo-o', 'Hakamo-o', 'Kommo-o', 'Chien-Pao', 'Chi-Yu', 'Ting-Lu', 'Wo-Chien'].includes(en) ? toID(en) : toID(en.slice(0, dash)) + '-' + toID(en.slice(dash + 1));
			rows.push({ id, sid, n: s.n, num: s.num, t: g.t, bs, bst: bs.reduce((a, x) => a + x, 0), pct: +(e.n / st.teams * 100).toFixed(2),
				nat: D.natures[toID(nat)]?.n || nat, ev, up: D.natures[toID(nat)]?.p !== D.natures[toID(nat)]?.m ? KEYS.indexOf(D.natures[toID(nat)]?.p) : -1, dn: D.natures[toID(nat)]?.p !== D.natures[toID(nat)]?.m ? KEYS.indexOf(D.natures[toID(nat)]?.m) : -1, natPct: Math.round(spreads[0][1] / e.n * 100), st: all[0],
				lo: KEYS.map((_, i) => Math.min(...all.map(a => a[i]))), hi: KEYS.map((_, i) => Math.max(...all.map(a => a[i]))),
				item: top(e.item, 4, e.n).map(([i, c]) => [i ? D.items[toID(i)]?.n || i : '없음', c]), abil: top(e.abil, 3, e.n).map(([i, c]) => [D.abilities[toID(i)]?.n || i, c]),
				move: top(e.move, 8, e.n).map(([i, c]) => { const m = D.moves[toID(i)] || D.moves[toID(i).replace(/^hiddenpower.+/, 'hiddenpower')]; return [m?.n || i, c, m?.g?.[9]?.[0] || '']; }) });
		}
		rows.sort((a, b) => b.pct - a.pct);
		return { name: STAGES[si][0], desc: STAGES[si][1], teams: st.teams, ranker: Math.round(st.ranker / st.teams * 100), rows };
	});
	const html = fs.readFileSync(path.join(__dirname, 'tower-sheet.tpl.html'), 'utf8')
		.replace('/*__DATA__*/', () => JSON.stringify({ types: D.types, made: new Date().toISOString().slice(0, 10), ver: require(path.join(HERE, '..', 'package.json')).version, n: N, data }));
	fs.mkdirSync(path.join(HERE, 'docs'), { recursive: true });
	fs.writeFileSync(path.join(HERE, 'docs/tower-sheet.html'), html);
	for (const fmt of ['singles', 'doubles']) console.log(fmt, data[fmt].map(s => `${s.name}: ${s.rows.length}종 랭커 ${s.ranker}%`).join(' | '));
	console.log('docs/tower-sheet.html', (html.length / 1e6).toFixed(2), 'MB');
})();
