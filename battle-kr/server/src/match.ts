/** 서버의 사람 대 사람 배틀: 앱의 Session(사람 대 AI)과 같은 엔진·규칙을 쓰되 양쪽 모두 사람이 고른다.
 *  - 같은 시드·팀·선택 기록이면 같은 배틀이 재현되므로, 저장은 그것만 하고 필요할 때 다시 만든다(rebuild).
 *  - 배틀 줄은 진영마다 나눠 준다: |split| 의 비공개 줄(정확한 HP)은 그 진영에게만, 상대에게는 공개 줄. */
import { Battle } from '../../../sim/battle';
import { filterGimmicks, gimmickOfLine } from '../../src/engine';
import { ruleById, type BattleRule, type GimmickKind } from '../../src/rules';

export type Side = 'p1' | 'p2';
export interface MatchSetup {
	ruleId: string;
	doubles: boolean;
	seed: [number, number, number, number];
	p1: { name: string; team: any[] };
	p2: { name: string; team: any[] };
}
/** 진영마다 보낼 것 */
export interface Out { p1: string[]; p2: string[]; req: { p1?: any; p2?: any }; ended: boolean; winner: string }

export class Match {
	battle: Battle;
	rule: BattleRule;
	/** 선택 기록 (재현용) — 순서대로 [진영, 선택] */
	inputs: [Side, string][] = [];
	ended = false;
	winner = '';
	private out: Out = { p1: [], p2: [], req: {}, ended: false, winner: '' };
	private gimmickUsed: { p1: Set<GimmickKind>; p2: Set<GimmickKind> } = { p1: new Set(), p2: new Set() };
	private usedBy = new WeakMap<any, Set<GimmickKind>>();
	private extraDmax: { [side: string]: { [i: number]: any } } = {};
	/** 진영별 마지막 요청 (재접속 때 다시 보냄) */
	lastReq: { p1?: any; p2?: any } = {};

	constructor(public setup: MatchSetup) {
		this.rule = ruleById(setup.ruleId);
		const formatid = `gen9kr${setup.doubles ? 'doubles' : 'singles'}${this.rule.mod === 'gen9' ? '' : this.rule.mod}`;
		this.battle = new Battle({
			formatid: formatid as any,
			seed: 'gen5,' + setup.seed.map(n => n.toString(16).padStart(4, '0')).join(''),
			send: (type: string, data: any) => this.receive(type, data),
		} as any);
		// 앱 규칙은 AI 대전용이라 debug(정확한 HP 공개·디버그 줄)가 켜져 있음 → 사람끼리는 끔: 상대 HP 는 % 로만, 디버그 줄 없음
		(this.battle as any).debugMode = false;
		(this.battle as any).reportExactHP = false;
	}

	private receive(type: string, data: any) {
		if (type === 'update') {
			const lines: string[] = Array.isArray(data) ? data : String(data).split('\n');
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line.startsWith('|split|')) {
					// |split|pN 다음 줄 = 비공개(그 진영), 그다음 = 공개(상대)
					const owner = line.slice(7) as Side, other: Side = owner === 'p1' ? 'p2' : 'p1';
					this.out[owner].push(lines[i + 1]);
					this.out[other].push(lines[i + 2]);
					i += 2;
					continue;
				}
				if (line.startsWith('|debug|')) continue;
				this.out.p1.push(line); this.out.p2.push(line);
				const gm = gimmickOfLine(line);
				if (gm) {
					this.gimmickUsed[gm[0]].add(gm[1]);
					const ident = line.split('|')[2] || '';
					const pk = (this.battle as any)[gm[0]]?.active?.['abc'.indexOf(ident.charAt(2))];
					if (pk) { const set = this.usedBy.get(pk) || new Set<GimmickKind>(); set.add(gm[1]); this.usedBy.set(pk, set); }
				}
				if (line.startsWith('|win|')) { this.ended = true; this.winner = line.slice(5); }
				if (line === '|tie') { this.ended = true; this.winner = ''; }
			}
		} else if (type === 'sideupdate') {
			const str = String(data), nl = str.indexOf('\n');
			const side = str.slice(0, nl) as Side, rest = str.slice(nl + 1);
			if (rest.startsWith('|request|')) {
				const req = JSON.parse(rest.slice(9));
				this.extraDmax[side] = filterGimmicks(req, this.rule, this.gimmickUsed[side], (this.battle as any)[side], this.usedBy);
				this.out.req[side] = req; this.lastReq[side] = req;
			}
		} else if (type === 'end') this.ended = true;
	}

	private flush(): Out {
		const o = this.out; o.ended = this.ended; o.winner = this.winner;
		this.out = { p1: [], p2: [], req: {}, ended: false, winner: '' };
		return o;
	}
	private syncSimRequest(side: Side) {
		const extra = this.extraDmax[side], ar = (this.battle as any)[side].activeRequest;
		if (!extra || !ar?.active) return;
		for (const i in extra) if (ar.active[i]) { ar.active[i].canDynamax = true; ar.active[i].maxMoves = extra[i]; }
	}

	start(): Out {
		this.battle.setPlayer('p1', { name: this.setup.p1.name, team: this.setup.p1.team } as any);
		this.battle.setPlayer('p2', { name: this.setup.p2.name, team: this.setup.p2.team } as any);
		this.battle.sendUpdates();
		return this.flush();
	}

	/** 선택. 잘못된 선택이면 null (오류 문구는 lastError) */
	lastError = '';
	choose(side: Side, choice: string): Out | null {
		if (this.ended) return null;
		this.lastError = '';
		this.syncSimRequest(side);
		if (choice === 'forfeit') { this.inputs.push([side, choice]); this.battle.forceWin(side === 'p1' ? 'p2' : 'p1'); this.battle.sendUpdates(); return this.flush(); }
		const ok = this.battle.choose(side, choice);
		if (!ok) { this.lastError = '선택할 수 없는 행동이에요'; return null; }
		this.inputs.push([side, choice]);
		this.battle.sendUpdates();
		return this.flush();
	}

	/** 저장한 시드·팀·선택 기록으로 다시 만들기. 진영별 지금까지의 전체 줄도 돌려줌 (재접속 화면 복원용) */
	static rebuild(setup: MatchSetup, inputs: [Side, string][]): { match: Match; log: { p1: string[]; p2: string[] } } {
		const m = new Match(setup);
		const log = { p1: [] as string[], p2: [] as string[] };
		const add = (o: Out) => { log.p1.push(...o.p1); log.p2.push(...o.p2); };
		add(m.start());
		for (const [side, choice] of inputs) { const o = m.choose(side, choice); if (o) add(o); }
		return { match: m, log };
	}
}
