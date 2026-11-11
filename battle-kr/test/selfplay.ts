import '../src/ps/registry';
import { Battle } from '../../sim/battle';
import { chooseAI } from '../src/ai';
import { filterGimmicks, gimmickOfLine, Session } from '../src/engine';
import { loadSettings } from '../src/store';
import { ruleById, applyRuleData, speciesAllowed, POOLS } from '../src/rules';
import { randomTeam, toSimTeam, randomSetFor, factoryTeam, cloneSet } from '../src/sets';
import { factoryPool, FACTORY_GRADES } from '../src/modes';
import { setSmogon, aiPickEntry } from '../src/smogon';
import { rankerTeam, rankerCount, rankerSources } from '../src/pokedb';
import { teamPlan, planText } from '../src/plan';
import { KoreanText, parseLine } from '../src/text';
/** o.aSmogon/bSmogon: 각 팀을 Smogon 통계로 만들지 / o.quality: 통계 세트의 쏠림 / o.pick: 6마리 중 n마리 (A 는 aiPickEntry, B 는 무작위) */
(window as any).__Battle = Battle; (window as any).__toSimTeam = toSimTeam;
(window as any).__plan = { teamPlan, planText };
(window as any).__text = { KoreanText, parseLine };
(window as any).__moveData = moveData;
(window as any).__chooseAI = chooseAI;
(window as any).__sets = { factoryTeam, toSimTeam, randomTeam, factoryPool, FACTORY_GRADES, cloneSet, POOLS };
(window as any).__ranker = { rankerTeam, rankerCount, rankerSources, applyRuleData, ruleById, loadSettings, speciesAllowed };
(window as any).selfplay = (n: number, gen: 9, doubles: boolean, skillA: number, skillB: number, _unused = false, size = 0,
	o: { aSmogon?: boolean; bSmogon?: boolean; quality?: number; pick?: number; depthA?: number; depthB?: number; budget?: number; aRanker?: boolean; bRanker?: boolean; planA?: boolean; planB?: boolean; minBstB?: number; cfgA?: { budget?: number; seeds?: number }; cfgB?: { budget?: number; seeds?: number }; verA?: number; verB?: number; swap?: boolean; featA?: any; featB?: any } = {}) => {
	(globalThis as any).__noPlan = { p1: o.planA === false, p2: o.planB === false };
	(globalThis as any).__aiFeat = o.featA || o.featB ? { p1: o.featA, p2: o.featB } : null;
	(globalThis as any).__aiVer = o.verA || o.verB ? { p1: o.verA ?? 2, p2: o.verB ?? 2 } : null;
	let prevTeams: any = null;
	(globalThis as any).__searchCfg = o.cfgA || o.cfgB ? { p1: o.cfgA, p2: o.cfgB } : null;
	(globalThis as any).__searchDepth = o.depthA || o.depthB ? { p1: o.depthA || 1, p2: o.depthB || 1 } : null;
	(globalThis as any).__laBudget = o.budget;
	const think: any = { p1: [] as number[], p2: [] as number[] };
	const res = { switches: 0, faints: 0, gm: {} as any, aWins: 0, bWins: 0, ties: 0, errors: [] as string[], turns: 0, emptyText: {} as any, sample: [] as string[], think: {} as any };
	for (let k = 0; k < n; k++) {
		const reqs: any = {};
		const used: any = { p1: new Set(), p2: new Set() };
		const rule = ruleById(loadSettings().battleRule); applyRuleData(rule);
		const lines: string[] = [];
		const b = new Battle({ formatid: `gen${gen}kr${doubles ? 'doubles' : 'singles'}${rule.mod === 'gen9' ? '' : rule.mod}` as any, send: (t: string, d: any) => {
			if (t === 'sideupdate') { const s = String(d); const side = s.slice(0, 2); const r = s.slice(3); if (r.startsWith('|request|')) reqs[side] = JSON.parse(r.slice(9)); }
			if (t === 'update') { const ls = Array.isArray(d) ? d : String(d).split('\n'); lines.push(...ls); for (const l of ls) { const g = gimmickOfLine(l); if (g) used[g[0]].add(g[1]); } }
		} } as any);
		const sz = o.pick ? 6 : size || (doubles ? 4 : 3);
		setSmogon(o.aSmogon ?? true); let ta = randomTeam({ gen, size: sz, minBst: 450, doubles, quality: o.quality });
		setSmogon(o.bSmogon ?? true); let tb = randomTeam({ gen, size: sz, minBst: o.minBstB ?? 450, allowSubLegend: !!o.minBstB, doubles, quality: o.quality });
		if (o.aRanker) { setSmogon(true); const rk = rankerTeam(doubles, 50, 0.9); if (rk) ta = rk.team.slice(0, sz); }
		if (o.bRanker) { setSmogon(true); const rk = rankerTeam(doubles, 50, 0.9); if (rk) tb = rk.team.slice(0, sz); }
		// swap: 두 판씩 같은 두 팀을 진영만 바꿔서 (팀 운을 상쇄해 AI 버전끼리 공정하게 비교)
		if (o.swap) { if (k % 2 === 1 && prevTeams) { ta = prevTeams[1]; tb = prevTeams[0]; } else prevTeams = [ta, tb]; }
		if (o.pick) {
			setSmogon(true); const pa = aiPickEntry(ta, tb, o.pick, doubles, 1, false, o.planA !== false);
			setSmogon(true); const pb = aiPickEntry(tb, ta, o.pick, doubles, 1, false, o.planB !== false); // 양쪽 같은 방식으로 (예전엔 B 만 통계 없이 골라 A 가 약 58% 유리했음)
			ta = pa; tb = pb;
		}
		setSmogon(true);
		b.setPlayer('p1', { name: 'A', team: toSimTeam(ta) } as any);
		b.setPlayer('p2', { name: 'B', team: toSimTeam(tb) } as any);
		b.sendUpdates();
		let guard = 0;
		const done: any = {};
		while (!b.ended && guard++ < 600) {
			let acted = false;
			// 두 진영이 모두 고른 뒤에 한꺼번에 제출 (먼저 제출하면 나중에 고르는 AI 의 탐색 복제본에 상대의 실제 선택이 들어가 엿보게 됨)
			const decided: [('p1' | 'p2'), string][] = [];
			for (const side of ['p1', 'p2'] as const) {
				const r = reqs[side];
				if (!r || r.wait || done[side] === r) continue;
				done[side] = r;
				const extra = filterGimmicks(r, rule, used[side], (b as any)[side]);
				const ar = (b as any)[side].activeRequest; if (ar?.active) for (const i in extra) if (ar.active[i]) { ar.active[i].canDynamax = true; ar.active[i].maxMoves = extra[i]; }
				let c = 'default';
				const t0 = performance.now();
				try { c = chooseAI(b, r, side, side === 'p1' ? skillA : skillB); } catch (e: any) { res.errors.push('AI ' + e.message + e.stack.slice(0, 300)); }
				think[side].push(performance.now() - t0);
				decided.push([side, c]);
			}
			for (const [side, c] of decided) {
				try {
					if (!b.choose(side, c)) { res.errors.push(`bad choice ${side}: ${c} :: ${(b as any)[side].choice.error}`); b.choose(side, 'default'); }
				} catch (e: any) { res.errors.push('SIM ' + e.message + '\n' + b.log.slice(-25).join('\n')); guard = 9999; break; }
				b.sendUpdates();
				acted = true;
			}
			if (!acted) { res.errors.push('stall'); break; }
		}
		res.turns += b.turn;
		// 성향 관련 행동 횟수 (A=p1, B=p2 — swap 이어도 AI 쪽 기준은 진영 그대로)
		const ev = ((res as any).ev ||= {});
		for (const l of lines) {
			const m = /^\|move\|(p[12])[a-d]?: [^|]*\|(Trick Room|Tailwind|Rain Dance|Sunny Day|Sandstorm|Snowscape|Swords Dance|Dragon Dance|Nasty Plot|Calm Mind|Quiver Dance|Protect)\|/.exec(l);
			if (m) { const k = m[1] + ' ' + m[2]; ev[k] = (ev[k] || 0) + 1; }
		}
		if (b.winner === 'A') res.aWins++; else if (b.winner === 'B') res.bWins++; else res.ties++;
		const kt = new KoreanText({ gen, ownSide: 'p1', doubles, trainerName: s => s });
		for (let i = 0; i < lines.length; i++) {
			const l = lines[i];
			if (l.startsWith('|split|')) { i++; continue; }
			const p = parseLine(l);
			if (!p) continue;
			if (p.cmd === 'switch') res.switches++;
			if (p.cmd === 'faint') res.faints++;
			for (const k of ['-mega', '-zpower', '-terastallize']) if (p.cmd === k) res.gm[k] = (res.gm[k] || 0) + 1;
			if (p.cmd === '-start' && p.args[2] === 'Dynamax') res.gm.dynamax = (res.gm.dynamax || 0) + 1;
			if (p.cmd === 'bigerror' || p.cmd === 'error') res.errors.push(l);
			try {
				const t = kt.render(p, null);
				if (!t && !['', 't:', 'gametype', 'player', 'gen', 'tier', 'teamsize', 'upkeep', 'switch', 'request', '-damage', 'split', 'turn', 'move'].includes(p.cmd)) res.emptyText[p.cmd + ' ' + (p.args[2] || '') + ' ' + JSON.stringify(p.kw)] = 1;
				if (t && /[A-Za-z]{4,}/.test(t.replace(/Lv\d+/, ''))) res.sample.push(t + '  ⟸ ' + l);
				if (t && t.includes('{')) res.sample.push('BRACE ' + t);
			} catch (e: any) { res.errors.push('TEXT ' + e.message + ' ' + l); }
		}
	}
	for (const sd of ['p1', 'p2']) { const a = think[sd].sort((x: number, y: number) => x - y); res.think[sd] = { avg: Math.round(a.reduce((x: number, y: number) => x + y, 0) / (a.length || 1)), p95: Math.round(a[Math.floor(a.length * 0.95)] || 0), max: Math.round(a[a.length - 1] || 0) }; }
	res.emptyText = Object.keys(res.emptyText).slice(0, 60);
	res.sample = res.sample.slice(0, 40);
	return res;
};
(window as any).__Battle = Battle; // 테스트용: 상태이상 확률 측정 등
(window as any).__Session = Session; // 테스트용: 멀티배틀 기믹 등
(window as any).__rs = randomSetFor;
(window as any).__ard = () => applyRuleData(ruleById(loadSettings().battleRule));
import { learnset as __ls, moveData } from '../src/data';
(window as any).__ls = __ls;
import { speciesPool } from '../src/sets';
(window as any).__pool = speciesPool;
