/** 시뮬레이터(Battle) 를 감싸 플레이어(p1) ↔ AI(p2) 대전을 진행 */
import { Battle } from '../../sim/battle';
import type { PokemonSet } from '../../sim/teams';
import { chooseAI } from './ai';
import { loadSettings } from './store';
import { ruleById, megaStoneAllowed, megaFormAllowed, type BattleRule, type GimmickKind } from './rules';

export interface SideConfig { name: string; team: PokemonSet[] }
export interface SessionConfig {
	gen: 4 | 5;
	doubles: boolean;
	p1: SideConfig;
	p2: SideConfig;
	aiSkill: number; // 0~1
	seed?: [number, number, number, number];
	/** 배틀 규칙 id (없으면 설정값) */
	ruleId?: string;
	/** 거꾸로 배틀 */
	inverse?: boolean;
	/** 리플레이 재생: 기록된 상대(AI) 선택을 순서대로 씀 */
	replayP2?: string[];
	/** 멀티배틀: p1 팀 중 파트너 포켓몬 표시 (팀 순서대로). 기믹 사용 횟수를 나와 파트너가 따로 셈 */
	partnerFlags?: boolean[];
	/** 상대 선택을 AI 대신 정함 (배틀팰리스: 성격대로). null 이면 평소 AI */
	p2Auto?: (battle: any, req: any) => string | null;
	/** 온라인 대전: 양쪽 선택을 모두 밖(서버가 중계한 순서)에서 넣음 (applyInput). AI 는 돌지 않음 */
	remote?: boolean;
	/** 시나리오: 내 팀의 시작 상태 (팀 순서대로). hp = 남은 체력 비율(0 = 기절), pp = 기술별 남은 PP. 없으면 가득 */
	p1State?: ({ hp?: number; pp?: { [move: string]: number } } | undefined)[];
}

export class Session {
	battle: Battle;
	private pending: string[] = [];
	p1Request: any = null;
	p2Request: any = null;
	private p2Answered: any = null;
	/** 각 진영이 이번 배틀에 쓴 기믹 종류 */
	gimmickUsed: { p1: Set<GimmickKind>; p2: Set<GimmickKind> } = { p1: new Set(), p2: new Set() };
	/** 멀티배틀: 내 쪽(p1)의 기믹 사용을 포켓몬 주인별로 (나 / 파트너) */
	private ownerUsed = { me: new Set<GimmickKind>(), partner: new Set<GimmickKind>() };
	private get multi() { return !!this.cfg.partnerFlags; }
	private ownerOf(p: any): 'me' | 'partner' { return p?.kPartner ? 'partner' : 'me'; }
	/** 포켓몬(시뮬레이터 객체)마다 쓴 기믹 — 한 포켓몬은 기믹을 하나만 (울트라버스트+Z기술은 예외) */
	private usedBy = new WeakMap<any, Set<GimmickKind>>();
	/** 규칙상 추가로 허용한 다이맥스 (시뮬레이터 요청에 넣어 줄 것) */
	private extraDmax: { [side: string]: { [i: number]: any } } = {};
	ended = false;
	winner = '';
	lastError = '';

	rule: BattleRule;
	/** 리플레이용 기록: 시드와 양쪽 선택 (같은 팀·시드·선택이면 같은 배틀이 재현됨) */
	seed: [number, number, number, number];
	record: { p1: string[]; p2: string[] } = { p1: [], p2: [] };
	private replayIdx = 0;

	constructor(public cfg: SessionConfig) {
		this.rule = ruleById(cfg.ruleId || loadSettings().battleRule);
		// 포켓몬 풀에 맞는 데이터 모드 (종족값·특성·기술 수치·챔피언스 사양)
		const formatid = `gen${cfg.gen}kr${cfg.doubles ? 'doubles' : 'singles'}${cfg.inverse ? 'inverse' : ''}${this.rule.mod === 'gen9' ? '' : this.rule.mod}`;
		this.seed = cfg.seed || [0, 0, 0, 0].map(() => Math.floor(Math.random() * 0x10000)) as [number, number, number, number];
		this.battle = new Battle({
			formatid: formatid as any,
			seed: 'gen5,' + this.seed.map(n => n.toString(16).padStart(4, '0')).join(''),
			send: (type: string, data: any) => this.receive(type, data),
		} as any);
	}

	private receive(type: string, data: any) {
		if (type === 'update') {
			const lines: string[] = Array.isArray(data) ? data : String(data).split('\n');
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line.startsWith('|split|')) {
					// 다음 줄(비공개 = 정확한 HP)만 쓰고, 그다음 줄(공개)은 건너뜀
					this.pending.push(lines[i + 1]);
					i += 2;
					continue;
				}
				this.pending.push(line);
				const gm = gimmickOfLine(line);
				if (gm) {
					this.gimmickUsed[gm[0]].add(gm[1]);
					const ident = line.split('|')[2] || '';
					const pk = this.battle[gm[0]]?.active?.['abc'.indexOf(ident.charAt(2))];
					if (pk) { const set = this.usedBy.get(pk) || new Set<GimmickKind>(); set.add(gm[1]); this.usedBy.set(pk, set); }
					if (this.multi && gm[0] === 'p1' && pk) this.ownerUsed[this.ownerOf(pk)].add(gm[1]);
				}
				if (line.startsWith('|win|')) { this.ended = true; this.winner = line.slice(5); }
				if (line === '|tie') { this.ended = true; this.winner = ''; }
			}
		} else if (type === 'sideupdate') {
			const str = String(data);
			const nl = str.indexOf('\n');
			const side = str.slice(0, nl);
			const rest = str.slice(nl + 1);
			if (rest.startsWith('|request|')) {
				const req = JSON.parse(rest.slice(9));
				this.applyGimmickRule(req, side as 'p1' | 'p2');
				if (side === 'p1') this.p1Request = req;
				else if (side === 'p2') this.p2Request = req;
			} else if (rest.startsWith('|error|')) {
				if (side === 'p1' || this.cfg.remote) this.lastError = rest.slice(7);
			}
		} else if (type === 'end') {
			this.ended = true;
		}
	}

	/** 기믹 규칙 적용 (설정의 '기믹 규칙')
	 *  one: 한 배틀에 한 종류(처음 쓴 종류만, 1회) / free: 종류마다 1회 / mega·zmove·dynamax·tera: 그 기믹만 / none: 사용 불가 */
	private applyGimmickRule(req: any, side: 'p1' | 'p2') {
		if (this.multi && side === 'p1') {
			// 멀티배틀: 슬롯마다 그 포켓몬 주인의 사용 기록으로 판단, 상대 주인이 메가진화해도 내 메가진화는 다시 열어 줌
			const act = this.battle.p1.active;
			this.extraDmax[side] = filterGimmicks(req, this.rule, (i: number) => this.ownerUsed[this.ownerOf(act[i])], this.battle[side], this.usedBy, true);
			return;
		}
		this.extraDmax[side] = filterGimmicks(req, this.rule, this.gimmickUsed[side], this.battle[side], this.usedBy);
	}
	/** 규칙으로 추가 허용한 다이맥스를 시뮬레이터 쪽 요청에도 넣는다 (선택 직전) */
	private syncSimRequest(side: 'p1' | 'p2') {
		const extra = this.extraDmax[side];
		const ar = this.battle[side].activeRequest as any;
		if (!extra || !ar?.active) return;
		for (const i in extra) if (ar.active[i]) { ar.active[i].canDynamax = true; ar.active[i].maxMoves = extra[i]; }
	}

	private flush() {
		const out = this.pending;
		this.pending = [];
		return out;
	}

	private runAI() {
		if (this.cfg.remote) return;
		for (let guard = 0; guard < 8 && !this.ended; guard++) {
			const req = this.p2Request;
			if (!req || req.wait || req === this.p2Answered) return;
			this.p2Answered = req;
			let choice = 'default';
			if (this.cfg.replayP2 && this.replayIdx < this.cfg.replayP2.length) choice = this.cfg.replayP2[this.replayIdx++];
			else {
				try {
					choice = this.cfg.p2Auto?.(this.battle, req) || chooseAI(this.battle, req, 'p2', this.cfg.aiSkill);
				} catch (e) {
					console.error('AI 오류', e);
				}
			}
			this.syncSimRequest('p2');
			if (!this.battle.choose('p2', choice)) { choice = 'default'; this.battle.choose('p2', 'default'); }
			this.record.p2.push(choice);
			this.battle.sendUpdates();
		}
	}

	start(): string[] {
		this.battle.setPlayer('p1', { name: this.cfg.p1.name, team: this.cfg.p1.team } as any);
		// 시나리오: 지난 배틀에서 남은 HP·PP 로 시작 (상대가 들어와 배틀이 시작되기 전에 넣어야 등장 때의 HP 에 반영됨)
		this.p1Orig = [...(this.battle.p1 as any).pokemon];
		if (this.cfg.p1State) this.p1Orig.forEach((p: any, i: number) => {
			const st = this.cfg.p1State![i]; if (!st) return;
			if (st.hp !== undefined) {
				if (st.hp <= 0) { p.hp = 0; p.fainted = true; p.status = 'fnt'; }
				else p.hp = Math.max(1, Math.min(p.maxhp, Math.round(p.maxhp * st.hp)));
			}
			if (st.pp) for (const ms of p.baseMoveSlots) if (st.pp[ms.id] !== undefined) ms.pp = Math.max(0, Math.min(ms.maxpp, st.pp[ms.id]));
		});
		this.battle.setPlayer('p2', { name: this.cfg.p2.name, team: this.cfg.p2.team } as any);
		// 배틀이 시작되며 남은 포켓몬 수가 팀 전체로 다시 세어지므로, 기절한 채 시작한 포켓몬을 빼 둠 (안 그러면 전멸해도 배틀이 끝나지 않음)
		if (this.cfg.p1State) (this.battle.p1 as any).pokemonLeft = this.p1Orig.filter((p: any) => !p.fainted).length;
		if (this.cfg.partnerFlags) {
			const side: any = this.battle.p1;
			side.pokemon.forEach((p: any, i: number) => { p.kPartner = !!this.cfg.partnerFlags![i]; });
			// Z기술·다이맥스의 '편 단위 1회' 표시는 끄고, 주인별 판단(filterGimmicks)에 맡김
			for (const k of ['zMoveUsed', 'dynamaxUsed']) Object.defineProperty(side, k, { get: () => false, set: () => {}, configurable: true });
			// 메가진화·테라스탈은 시뮬레이터가 같은 편 전원을 막으므로, 다른 주인의 포켓몬은 원래대로 되돌림 (같은 턴에 둘 다 써도 되게)
			const acts: any = this.battle.actions;
			const keepOthers = (fn: string, keys: string[]) => {
				const orig = acts[fn].bind(acts);
				acts[fn] = (pk: any, ...rest: any[]) => {
					const others = pk?.side === side ? side.pokemon.filter((x: any) => x !== pk && this.ownerOf(x) !== this.ownerOf(pk)) : [];
					const saved = others.map((x: any) => keys.map(k => x[k]));
					const r = orig(pk, ...rest);
					others.forEach((x: any, j: number) => keys.forEach((k, n) => { x[k] = saved[j][n]; }));
					return r;
				};
			};
			keepOthers('runMegaEvo', ['canMegaEvo', 'canMegaEvoX', 'canMegaEvoY', 'canUltraBurst']);
			keepOthers('terastallize', ['canTerastallize']);
			// 선택 검사: 한 턴에 같은 편이 같은 기믹을 두 번 못 쓰게 하는 표시를 슬롯마다 지움 (나·파트너가 같은 턴에 각자 쓸 수 있게.
			// 같은 주인이 두 번 쓰는 것은 기믹 규칙(filterGimmicks)과 선택 화면·AI 가 막음)
			const origChoose = side.chooseMove.bind(side);
			side.chooseMove = (...a: any[]) => {
				for (const k of ['mega', 'ultra', 'zMove', 'dynamax', 'terastallize']) if (side.choice) side.choice[k] = false;
				return origChoose(...a);
			};
		}
		this.battle.sendUpdates();
		this.runAI();
		return this.flush();
	}

	/** 시나리오: 내 팀 포켓몬 (처음 팀 순서 그대로) */
	p1Orig: any[] = [];
	/** 시나리오: 배틀이 끝난 뒤의 내 팀 상태 (팀 순서대로) — 남은 체력 비율과 기술별 PP */
	p1Final(): { hp: number; pp: { [move: string]: number } }[] {
		return this.p1Orig.map((p: any) => ({ hp: p.fainted || p.hp <= 0 ? 0 : p.hp / p.maxhp, pp: Object.fromEntries(p.baseMoveSlots.map((ms: any) => [ms.id, ms.pp])) }));
	}
	/** 시나리오: 배틀 중 도구 사용 (회복·되살리기·PP 회복). 로그 줄만 쌓고, 턴은 choose('pass', true) 로 넘김. 쓸 수 없으면 false */
	useItem(i: number, fx: { heal?: number; revive?: boolean; pp?: number }, label: string): boolean {
		const p = this.p1Orig[i], side: any = this.battle.p1; if (!p) return false;
		if (fx.revive) {
			if (!p.fainted) return false;
			p.fainted = false; p.faintQueued = false; p.status = ''; p.hp = Math.max(1, Math.floor(p.maxhp / 2)); side.pokemonLeft++;
			this.battle.add('message', `${label}: ${p.name} 되살아났다!`);
			return true;
		}
		if (p.fainted) return false;
		if (fx.heal) {
			if (p.hp >= p.maxhp) return false;
			p.hp = Math.min(p.maxhp, p.hp + fx.heal);
			if (p.isActive) this.battle.add('-heal', p, p.getHealth, '[from] item: ' + label); else this.battle.add('message', `${label}: ${p.name}의 체력이 회복되었다!`);
			return true;
		}
		if (fx.pp) {
			if (p.baseMoveSlots.every((ms: any) => ms.pp >= ms.maxpp)) return false;
			for (const ms of p.baseMoveSlots) ms.pp = Math.min(ms.maxpp, ms.pp + fx.pp);
			this.battle.add('message', `${label}: ${p.name}의 PP가 회복되었다!`);
			return true;
		}
		return false;
	}

	/** 플레이어 선택. 잘못된 선택이면 null. allowPass = 도구를 써서 이번 턴 행동을 넘김 (시나리오) */
	choose(choice: string, allowPass = false): string[] | null {
		this.lastError = '';
		const prevReq = this.p1Request;
		this.syncSimRequest('p1');
		const sd: any = this.battle.p1, origPass = sd.choosePass;
		if (allowPass) sd.choosePass = function () { this.choice.actions.push({ choice: 'pass' }); return true; };
		let ok = false;
		try { ok = !!this.battle.choose('p1', choice); } finally { if (allowPass) sd.choosePass = origPass; }
		if (!ok) {
			this.p1Request = prevReq;
			return null;
		}
		this.record.p1.push(choice);
		this.battle.sendUpdates();
		this.runAI();
		return this.flush();
	}

	/** (온라인) 이 선택이 지금 가능한지 — 시뮬레이터에 넣어 보고 바로 지움 (턴은 진행하지 않음) */
	canChoose(side: 'p1' | 'p2', choice: string): boolean {
		if (choice === 'forfeit') return true;
		this.syncSimRequest(side);
		const sd: any = this.battle[side];
		let ok = false;
		try { ok = !!sd.choose(choice); } catch { ok = false; }
		if (!ok) this.lastError = sd.choice?.error || '';
		try { sd.clearChoice(); } catch {}
		return ok;
	}
	/** (온라인) 서버가 중계한 순서대로 한쪽 선택을 넣음. 두 쪽이 모이면 턴이 진행되고 그 줄을 돌려줌. 넣을 수 없으면 null */
	applyInput(side: 'p1' | 'p2', choice: string): string[] | null {
		if (this.ended) return [];
		if (choice === 'tod') {   // 대전 시간 끝 (서버가 넣음): 남은 포켓몬 수 → 남은 HP 비율 평균 → 남은 HP 합, 같으면 무승부
			const sc = (sd: 'p1' | 'p2') => { const ms: any[] = this.battle[sd].pokemon, al = ms.filter(p => p.hp > 0);
				return [al.length, al.reduce((a, p) => a + p.hp / p.maxhp, 0) / Math.max(1, ms.length), al.reduce((a, p) => a + p.hp, 0)]; };
			const a = sc('p1'), b = sc('p2');
			let w: 'p1' | 'p2' | null = null, by = '';
			for (let i = 0; i < 3 && !w; i++) if (Math.abs(a[i] - b[i]) > 1e-9) { w = a[i] > b[i] ? 'p1' : 'p2'; by = ['남은 포켓몬 수', '남은 HP 비율', '남은 HP 합계'][i]; }
			const n1 = this.battle.p1.name, n2 = this.battle.p2.name;
			this.battle.add('-message', '대전 시간이 다 되었다!');
			this.battle.add('-message', `남은 포켓몬 ${n1} ${a[0]}마리 · ${n2} ${b[0]}마리 (HP ${Math.round(a[1] * 100)}% · ${Math.round(b[1] * 100)}%)`);
			this.battle.add('-message', w ? `${by}(으)로 판정!` : '완전히 같아서 무승부!');
			this.record[side].push(choice);
			this.battle.forceWin(w as any);
			this.battle.sendUpdates();
			return this.flush();
		}
		if (choice.startsWith('forfeit')) {   // 'forfeit' 기권 · 'forfeit disconnect' 연결 끊김 · 'forfeit timeout' 내 시간 0 (서버가 넣음)
			this.record[side].push('forfeit');
			this.battle.forceWin(side === 'p1' ? 'p2' : 'p1');
			this.battle.sendUpdates();
			return this.flush();
		}
		this.syncSimRequest(side);
		if (!this.battle.choose(side, choice)) return null;
		this.record[side].push(choice);
		this.battle.sendUpdates();
		return this.flush();
	}

	forfeit(): string[] {
		this.record.p1.push('forfeit');
		this.battle.forceWin('p2');
		this.battle.sendUpdates();
		return this.flush();
	}
}

/** 요청(request)을 배틀 규칙에 맞춘다. 규칙상 안 되는 기믹은 지우고, 쇼다운이 막아 둔 것(메가스톤 소지 포켓몬의 테라스탈·다이맥스 등)은 열어 준다.
 *  반환: 추가로 허용한 다이맥스 {슬롯: maxMoves} (시뮬레이터 요청에 넣어 줄 것) */
export function filterGimmicks(req: any, rule: BattleRule, usedArg: Set<GimmickKind> | ((slot: number) => Set<GimmickKind>), simSide: any, usedBy?: WeakMap<any, Set<GimmickKind>>,
	reopenMega = false): { [i: number]: any } {
	const extra: { [i: number]: any } = {};
	if (!req?.active) return extra;
	const dmaxNow = simSide?.active?.some((p: any) => p?.volatiles['dynamax']);
	req.active.forEach((a: any, i: number) => {
		if (!a) return;
		// 사용 기록: 보통은 진영 전체, 멀티배틀은 슬롯의 포켓몬 주인별
		const used = typeof usedArg === 'function' ? usedArg(i) : usedArg;
		// 울트라버스트('ultra')는 메가진화 계열로 취급하되, 원작처럼 그 뒤 Z기술은 쓸 수 있게 '한 종류' 계산에서 뺌
		const counted = new Set([...used].filter(k => k !== 'ultra'));
		const allow = (k: GimmickKind) => rule.kinds.includes(k) && !used.has(k) && !(rule.oneKind && counted.size > 0 && !(k === 'zmove' && used.has('ultra')));
		const p = simSide?.active?.[i];
		// 멀티배틀: 다른 주인이 메가진화하면 시뮬레이터가 같은 편 전원의 메가진화를 막으므로, 아직 안 쓴 주인의 포켓몬은 다시 열어 줌
		if (reopenMega && p && allow('mega') && !a.canMegaEvo && !p.species.isMega && p.canMegaEvo === false) {
			const sp = p.battle.actions.canMegaEvo(p);
			if (sp) { p.canMegaEvo = sp; a.canMegaEvo = true; }
		}
		// 메가진화: 규칙·허용 메가 목록
		// 메가스톤이 없는 메가진화(레쿠쟈: 화룡점정)는 메가 모습으로 판단
		const stoneOk = !p ? allow('mega') : p.getItem?.()?.megaStone ? megaStoneAllowed(rule, p.item) : megaFormAllowed(rule, p.canMegaEvo || 'rayquazamega');
		if (!allow('mega') || !stoneOk) { delete a.canMegaEvo; delete a.canMegaEvoX; delete a.canMegaEvoY; }
		if (!allow('mega') || used.has('ultra')) delete a.canUltraBurst;
		if (!allow('zmove')) delete a.canZMove;
		// 테라스탈: 쇼다운은 메가스톤 소지 포켓몬의 테라스탈을 막아 두므로 규칙상 되면 열어 준다
		if (!allow('tera')) delete a.canTerastallize;
		// 메가진화·원시회귀·울트라버스트한 포켓몬은 테라스탈 불가 (쇼다운이 막아 둔 '메가스톤 소지' 경우만 열어 줌)
		else if (p && !a.canTerastallize && !p.terastallized && p.canTerastallize === null && !['Ogerpon', 'Terapagos'].includes(p.species.baseSpecies) &&
			!p.species.isMega && !p.species.isPrimal && p.species.forme !== 'Ultra') {
			p.canTerastallize = p.teraType; a.canTerastallize = p.teraType;
		}
		// 다이맥스
		if (!allow('dynamax')) { delete a.canDynamax; if (!dmaxNow) delete a.maxMoves; }
		// 한 포켓몬은 기믹을 하나만: 이미 쓴 포켓몬(또는 다이맥스 중)은 다른 기믹 불가 (울트라버스트 뒤 Z기술만 예외)
		// '무제한' 규칙(stack)은 겹쳐 쓰기 허용 — 단 메가진화·원시회귀·울트라버스트한 포켓몬의 테라스탈은 위에서 이미 막음
		let blocked = false;
		if (p && !rule.stack) {
			const mine = usedBy?.get(p);
			const onlyUltra = mine && mine.size === 1 && mine.has('ultra');
			if ((mine && mine.size) || p.volatiles['dynamax'] || p.terastallized || p.species.isMega || p.species.isPrimal) {
				blocked = true;
				delete a.canMegaEvo; delete a.canMegaEvoX; delete a.canMegaEvoY; delete a.canUltraBurst; delete a.canTerastallize; delete a.canDynamax;
				if (!onlyUltra) delete a.canZMove;
				if (!p.volatiles['dynamax']) { delete a.maxMoves; delete extra[i]; }
				if (p.canTerastallize && !p.terastallized) p.canTerastallize = null;
			}
		}
		// 쇼다운이 막아 둔 다이맥스(메가스톤·Z크리스탈 외 도구 소지 등)를 규칙상 되면 열어 줌
		if (!blocked && allow('dynamax') && p && !a.canDynamax && !p.volatiles['dynamax'] && simSide.canDynamaxNow?.() && !p.species.isMega && !p.species.isPrimal &&
			p.species.forme !== 'Ultra' && !p.species.cannotDynamax && !p.getItem().zMove) {
			const mm = p.getDynamaxRequest(true);
			if (mm) { a.canDynamax = true; a.maxMoves = mm; extra[i] = mm; }
		}
	});
	return extra;
}
/** 로그 한 줄이 기믹 사용이면 [진영, 종류] */
export function gimmickOfLine(line: string): ['p1' | 'p2', GimmickKind] | null {
	const gm = /^\|(-mega|-primal|-burst|-zpower|-terastallize)\|(p[12])/.exec(line) || /^\|-start\|(p[12])[a-c]: [^|]*\|Dynamax/.exec(line);
	if (!gm) return null;
	if (line.startsWith('|-primal')) return null; // 원시회귀는 자동
	const side = (gm[2] || gm[1]) as 'p1' | 'p2';
	return [side, line.includes('-zpower') ? 'zmove' : line.includes('-terastallize') ? 'tera' : line.includes('Dynamax') ? 'dynamax' : line.startsWith('|-burst') ? 'ultra' : 'mega'];
}
