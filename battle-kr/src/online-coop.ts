/** 온라인 협력 타워 · 2vs2 멀티배틀 — 두 사람이 한 편(멀티배틀)이 되어 싸운다.
 *  협력 타워(coop): 방의 두 사람이 한 편, 상대는 AI 두 명 (서버는 2자리 방 그대로).
 *  2vs2 멀티배틀(multi): 4자리 방 — p1·p2 가 한 편, p3·p4 가 한 편 (서버의 seats 4). 아래 방식에서 F(=AI) 만 없고 C 를 네 사람이 보낸다.
 *
 *  서버는 지금의 '선택 중계' 그대로 쓴다(서버를 고치지 않음): 방의 두 자리(p1=방장, p2=손님)가 보내는 choose 문자열을 순서대로 양쪽에 돌려줄 뿐이라,
 *  그 문자열에 아래 꼬리표를 붙여 주고받고 두 앱이 같은 순서로 같은 엔진을 돌린다.
 *    T<i>/<n>|<조각>   방장: 상대(AI) 팀과 연승 수 (JSON 을 150자씩 나눔 — 서버가 200자에서 자름). 다 모이면 양쪽이 엔진을 만듦
 *    C<k>|<칸>=<선택>|…   사람: k번째 고르기에서 내 칸(들)의 선택 (칸 = 이번에 골라야 하는 자리 중 몇 번째)
 *    F<k>|<선택>          방장: k번째 고르기에서 상대(AI) 편 전체의 선택 (AI 는 방장 기기에서만 돌림 — 무작위가 들어가서)
 *  k번째 고르기에 필요한 것(골라야 하는 사람들의 C + 상대가 골라야 하면 F)이 모두 오면 한꺼번에 엔진에 넣는다.
 *  'forfeit…'(기권·연결 끊김)·'tod'(대전 시간 끝)는 서버가 넣는 그대로 받아 도전 실패로 끝낸다.
 *
 *  엔진의 우리 편(p1)은 [방장0, 손님0, 방장1, 손님1, …] 순서. 기기마다 '파트너' 표시(partnerFlags)만 반대로 줘서 화면은 언제나 '내 포켓몬 = 내 것'.
 */
import { Session } from './engine';
import { toSimTeam, type PSet } from './sets';
import { chooseAI } from './ai';
import type { OnlineRoom, StartInfo, Clock } from './online';
import { josa } from './josa';

type Side = 'p1' | 'p2';
/** 방의 자리 (서버가 선택에 붙여 주는 보낸 사람) */
type Seat = 'p1' | 'p2' | 'p3' | 'p4';
export interface CoopFoe { streak: number; name: string; title?: string; sprite?: string; sprite2?: string; skill: number; line?: string; team: PSet[] }

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const packSet = (s: PSet) => [s.species, s.item || '', s.ability || '', s.moves.join(','), s.nature || '', STATS.map(k => (s.evs as any)?.[k] || 0).join(','), s.teraType || '', s.level || 50, s.gender || '', s.shiny ? 1 : 0, s.gigantamax ? 1 : 0, s.name || ''];
const unpackSet = (a: any[]): PSet => ({ species: a[0], item: a[1], ability: a[2], moves: String(a[3]).split(',').filter(Boolean), nature: a[4] || 'serious',
	evs: Object.fromEntries(String(a[5]).split(',').map((v, i) => [STATS[i], +v || 0])) as any, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
	teraType: a[6] || undefined, level: a[7] || 50, ...(a[8] ? { gender: a[8] } : {}), ...(a[9] ? { shiny: true } : {}), ...(a[10] ? { gigantamax: true } : {}), name: a[11] || '' } as PSet);
const CHUNK = 150;
function foeChunks(f: CoopFoe): string[] {
	const json = JSON.stringify({ s: f.streak, n: f.name, tt: f.title || '', sp: f.sprite || '', sp2: f.sprite2 || '', sk: f.skill, l: (f.line || '').slice(0, 60), t: f.team.map(packSet) });
	const n = Math.ceil(json.length / CHUNK);
	return Array.from({ length: n }, (_, i) => `T${i}/${n}|${json.slice(i * CHUNK, (i + 1) * CHUNK)}`);
}

/** 내 팀과 파트너 팀을 한 편으로: [방장0, 손님0, 방장1, …] · guest[i] = 손님의 포켓몬인가 */
export function coopTeam(host: PSet[], guest: PSet[]) {
	const team: PSet[] = [], isGuest: boolean[] = [];
	for (let i = 0; i < Math.max(host.length, guest.length); i++) {
		if (host[i]) { team.push(host[i]); isGuest.push(false); }
		if (guest[i]) { team.push(guest[i]); isGuest.push(true); }
	}
	return { team, isGuest };
}

// ── 진영 뒤집기 (상대 편 자리에 앉은 사람의 화면용): 엔진의 p2 를 화면의 p1 로 (online.ts 와 같음) ──
const swapTok = (s: string) => s.replace(/\bp([12])([a-d]?)(?=[:|]|$)/g, (_m, d, slot) => `p${d === '1' ? '2' : '1'}${slot}`);
const swapReq = (req: any) => req && JSON.parse(swapTok(JSON.stringify(req)).replace(/"id":"p([12])"/g, (_m, d) => `"id":"p${d === '1' ? '2' : '1'}"`));
/** 2vs2 멀티배틀: 한 번 고르는 시간 (지나면 자동 선택) */
const TURN_MS = 60 * 1000;

/** 배틀 화면(BattleView)이 쓰는 세션과 같은 모양 (RemoteSession 과 같은 이름의 것들). 만든 뒤 ready 를 기다렸다가 화면에 넘긴다 */
export class TeamSession {
	local!: Session;
	/** 협력 타워의 상대(AI) — 멀티배틀에서는 없음 */
	foe!: CoopFoe;
	/** 엔진을 만들었을 때 (협력: 상대 팀이 다 옴 · 멀티: 바로) */
	ready: Promise<void>;
	onLines: ((lines: string[]) => void) | null = null;
	onDesync: ((msg: string) => void) | null = null;
	onCatchUp: ((lines: string[]) => void) | null = null;
	onEmote: ((who: 'p1' | 'p2', id: number) => void) | null = null;
	backlog: string[] = [];
	log: [Side, string][] = [];
	info: StartInfo;
	readonly multi: boolean;
	readonly host: boolean;
	readonly me: Seat;
	/** 내가 앉은 엔진 진영 · 화면을 뒤집는가 (엔진의 p2 편이면) */
	readonly mySide: Side;
	private flip: boolean;
	/** 2vs2: 고르는 시간을 잼 (배틀 화면의 시계) */
	readonly simpleClock = true;
	/** 화면 기준: 우리 편 전체(엔진 순서) · 파트너 표시 · 우리 편 이름 · 상대 편 전체와 이름 */
	team: PSet[]; flags: boolean[]; sideName: string; foeTeam: PSet[] = []; foeName = '';
	/** 엔진 진영별: 팀 순서대로의 자리 */
	private seats: { p1: Seat[]; p2: Seat[] } = { p1: [], p2: [] };
	private names: { p1: string; p2: string } = { p1: '', p2: '' };
	private teams: { p1: PSet[]; p2: PSet[] } = { p1: [], p2: [] };
	private applied = 0;
	private started = false;
	private bulk = false;
	private pre: [Seat, string][] = [];
	private chunks: string[] = [];
	private k = 0;
	private parts: { [seat: string]: Map<number, string> } = {};
	private foePart = '';
	private sentRound = -1;
	private mine = '';
	private aiRound = -1;
	private over = '';
	private clock: Clock | null = null; private clockAt = Date.now(); private turnStart = 0;
	private battleProxy: any;
	private okReady!: () => void;
	private noReady!: (e: Error) => void;
	constructor(start: StartInfo, public room: OnlineRoom, makeFoe?: () => CoopFoe) {
		this.info = start;
		const st: any = start;
		this.multi = !makeFoe;
		this.me = start.side as Seat;
		this.host = this.me === 'p1';
		const a = coopTeam(st.p1.team, st.p2.team);
		this.teams.p1 = a.team; this.seats.p1 = a.isGuest.map(g => g ? 'p2' : 'p1'); this.names.p1 = `${st.p1.name} & ${st.p2.name}`;
		if (this.multi) { const b = coopTeam(st.p3.team, st.p4.team); this.teams.p2 = b.team; this.seats.p2 = b.isGuest.map(g => g ? 'p4' : 'p3'); this.names.p2 = `${st.p3.name} & ${st.p4.name}`; }
		this.mySide = this.seats.p2.includes(this.me) ? 'p2' : 'p1';
		this.flip = this.mySide === 'p2';
		const other: Side = this.flip ? 'p1' : 'p2';
		this.team = this.teams[this.mySide]; this.flags = this.seats[this.mySide].map(x => x !== this.me);
		this.sideName = this.names[this.mySide]; this.foeTeam = this.teams[other]; this.foeName = this.names[other];
		if (start.clock) { this.clock = start.clock; this.clockAt = Date.now(); }
		this.ready = new Promise((ok, no) => { this.okReady = ok; this.noReady = no; });
		room.handlers.input = (side, choice, n, clock) => { if (clock) { this.clock = clock; this.clockAt = Date.now(); } this.receive(side as Seat, choice, n); };
		room.handlers.inputs = (list, clock) => {
			if (clock) { this.clock = clock; this.clockAt = Date.now(); }
			this.bulk = true;
			try { list.forEach((x, i) => this.receive(x[0] as Seat, x[1], i + 1)); } finally { this.bulk = false; }
			if (this.onCatchUp && this.backlog.length) this.onCatchUp(this.backlog.splice(0));
			// 끊긴 사이에 보낸 내 선택이 서버에 닿지 않았으면 다시 보냄
			if (this.started && !this.ended && this.mine && this.sentRound === this.k && !this.parts[this.me]?.size) this.room.send({ t: 'choose', choice: this.mine, ms: 0 });
			this.askAI();
		};
		room.handlers.emote = (side, id) => this.onEmote?.(this.sideOfSeat(side as Seat) === this.mySide ? 'p1' : 'p2', id);
		for (const m of (room.early || []).splice(0)) { if (m.t === 'inputs') room.handlers.inputs!(m.list, m.clock); else room.handlers.input!(m.side, m.choice, m.n, m.clock); }
		if (this.multi) this.build();
		else {
			// 방장: 잠깐 기다려도 상대 팀이 안 와 있으면(= 새 배틀) 지금 만들어 보냄. 다시 들어온 것이면 지난 기록에 이미 있음
			if (this.host) setTimeout(() => { if (this.chunks.some(Boolean) || this.local) return; try { for (const c of foeChunks(makeFoe!())) room.send({ t: 'choose', choice: c, ms: 0 }); } catch (e: any) { this.noReady(e); } }, 900);
			setTimeout(() => { if (!this.local) this.noReady(new Error('상대 팀 정보를 받지 못했어요. 방으로 돌아가 다시 시작해 주세요')); }, 30000);
		}
	}
	private view(lines: string[]) { return this.flip ? lines.map(swapTok) : lines; }
	get battle() { return this.battleProxy; }
	get p1Request() { return this.flip ? swapReq(this.local.p2Request) : this.local.p1Request; }
	get ended() { return !!this.local?.ended; }
	get winner() { return this.local.winner; }
	get lastError() { return this.local.lastError; }
	get seed() { return this.local.seed; }
	get rule() { return this.local.rule; }
	get record() { return this.local.record; }
	/** 왜 끝났는지 (기권·끊김·시간) — 결과 화면용 */
	get endReason() { return this.over; }
	start(): string[] {
		const lines = this.view(this.local.start());
		// 포켓몬마다 주인(자리)을 적어 둠 — 이 시점에는 팀 순서 그대로
		for (const sd of ['p1', 'p2'] as Side[]) (this.local.battle as any)[sd].pokemon.forEach((pk: any, i: number) => { pk.kSeat = this.seats[sd][i] || ''; });
		this.started = true;
		this.bulk = true;
		try { for (const [seat, choice] of this.pre.splice(0)) this.handle(seat, choice); } finally { this.bulk = false; }
		this.askAI();
		return lines;
	}
	// 시간: 협력 도전은 고르는 시간을 재지 않음. 2vs2 는 한 번 고르는 데 60초 (지나면 자동 선택). 서버의 대전 시간 20분은 둘 다 있음
	beginTurn() { if (this.multi && !this.turnStart && !this.ended && this.myPositions().length && this.sentRound !== this.k) this.turnStart = Date.now(); }
	timers() {
		const game = this.clock ? Math.max(0, this.clock.gameLeft - (Date.now() - this.clockAt)) : 0;
		return { game, mine: 0, opp: 0, turn: this.multi && this.turnStart ? Math.max(0, TURN_MS - (Date.now() - this.turnStart)) : null as number | null };
	}
	/** 고르는 시간이 다 됨: 내 자리는 자동 선택으로 */
	timeout(): boolean {
		if (!this.multi || this.ended || !this.turnStart || this.sentRound === this.k) return false;
		const pos = this.myPositions(); this.turnStart = 0;
		if (!pos.length) return false;
		this.sentRound = this.k;
		this.mine = `C${this.k}|` + pos.map(p => `${p}=default`).join('|');
		this.room.send({ t: 'choose', choice: this.mine, ms: 0 });
		return true;
	}
	sendEmote(id: number) { this.room.send({ t: 'emote', id }); }
	forfeit(): string[] { this.room.send({ t: 'choose', choice: 'forfeit', ms: 0 }); return []; }

	private sideOfSeat(seat: Seat): Side { return this.seats.p2.includes(seat) ? 'p2' : 'p1'; }
	private nameOfSeat(seat: Seat) { return (this.info as any)[seat]?.name || '상대'; }
	/** 이번 고르기에서 정해야 하는 것: 엔진 진영별로 자리들(순서대로, 누구 것인지) · 협력 타워의 상대(AI)도 골라야 하는가 */
	private need(): { p1: Seat[]; p2: Seat[]; foe: boolean } {
		const of = (sd: Side): Seat[] => {
			const req: any = sd === 'p1' ? this.local.p1Request : this.local.p2Request, slots: Seat[] = [];
			if (!req || req.wait || this.ended) return slots;
			const act: any[] = (this.local.battle as any)[sd].active;
			const n = req.forceSwitch ? req.forceSwitch.length : req.active?.length || 1;
			for (let i = 0; i < n; i++) {
				if (req.forceSwitch) { if (req.forceSwitch[i]) slots.push(act[i]?.kSeat); continue; }
				const mon = req.side.pokemon[i];
				if (mon && !mon.condition.endsWith(' fnt') && mon.condition !== '0 fnt' && !req.active[i]?.commanding) slots.push(act[i]?.kSeat);
			}
			return slots;
		};
		if (this.multi) return { p1: of('p1'), p2: of('p2'), foe: false };
		const r2: any = this.local.p2Request;
		return { p1: of('p1'), p2: [], foe: !!r2 && !r2.wait && !this.ended };
	}
	/** 이번 고르기에서 내가 정해야 하는 칸 번호들 */
	private myPositions(): number[] { if (!this.started || this.ended) return []; return this.need()[this.mySide].map((s, pos) => s === this.me ? pos : -1).filter(p => p >= 0); }
	/** 내 선택. BattleView 가 이번에 골라야 하는 자리 순서대로 넘김 — 파트너 자리는 '?' */
	choose(choice: string): string[] | null {
		if (this.ended || this.sentRound === this.k) return [];
		const mine = (choice ? choice.split(', ') : []).map((p, pos) => [pos, p] as const).filter(x => x[1] && x[1] !== '?');
		this.sentRound = this.k; this.turnStart = 0;
		if (!mine.length) { this.mine = ''; return []; }
		this.mine = `C${this.k}|` + mine.map(([pos, p]) => `${pos}=${p}`).join('|');
		this.room.send({ t: 'choose', choice: this.mine, ms: 0 });
		return [];
	}
	/** 협력 타워의 방장: 상대(AI)가 골라야 하면 골라서 보냄 */
	private askAI() {
		if (this.multi || !this.host || !this.started || this.ended || this.bulk) return;
		const k = this.k;
		if (this.aiRound === k || !this.need().foe || this.foePart) return;
		this.aiRound = k;
		setTimeout(() => {
			if (this.ended || this.k !== k || this.foePart) return;
			let c = 'default';
			try { c = chooseAI(this.local.battle as any, this.local.p2Request, 'p2', this.foe.skill) || 'default'; } catch (e) { console.error('AI 오류', e); }
			if (c !== 'default' && !this.local.canChoose('p2', c)) c = 'default';
			this.room.send({ t: 'choose', choice: `F${k}|${c}`, ms: 0 });
		}, 40);
	}
	private receive(seat: Seat, choice: string, n: number) {
		if (n <= this.applied) return;
		this.applied = n;
		this.log.push([seat as any, choice]);
		if (!this.multi && choice.charAt(0) === 'T' && !this.local) {
			const m = /^T(\d+)\/(\d+)\|([\s\S]*)$/.exec(choice);
			if (!m || seat !== 'p1') return;
			this.chunks.length = +m[2]; this.chunks[+m[1]] = m[3];
			if ([...this.chunks].every(c => typeof c === 'string')) {
				try { const j = JSON.parse(this.chunks.join(''));
					this.foe = { streak: j.s | 0, name: String(j.n || '상대'), title: j.tt || '', sprite: j.sp || undefined, sprite2: j.sp2 || undefined, skill: +j.sk || 0.6, line: j.l || '', team: (j.t as any[]).map(unpackSet) };
					this.teams.p2 = this.foe.team; this.names.p2 = this.foe.name; this.foeTeam = this.foe.team; this.foeName = this.foe.name;
					this.build();
				} catch { this.noReady(new Error('상대 팀 정보를 읽지 못했어요')); }
			}
			return;
		}
		if (!this.started) { this.pre.push([seat, choice]); return; }
		this.handle(seat, choice);
	}
	private build() {
		try {
			const flagsOf = (sd: Side) => this.seats[sd].map(x => x !== (sd === this.mySide ? this.me : this.seats[sd][0]));
			this.local = new Session({
				gen: 9 as any, doubles: true, aiSkill: 0, remote: true, seed: this.info.seed, ruleId: this.info.ruleId,
				partnerFlags: flagsOf('p1'), ...(this.multi ? { partnerFlags2: flagsOf('p2') } : {}),
				p1: { name: this.names.p1, team: toSimTeam(this.teams.p1) as any },
				p2: { name: this.names.p2, team: toSimTeam(this.teams.p2) as any },
			} as any);
			const real = this.local.battle as any;
			this.battleProxy = !this.flip ? real : new Proxy(real, {
				get: (t, key) => key === 'p1' ? t.p2 : key === 'p2' ? t.p1 : key === 'sides' ? [t.p2, t.p1] : (typeof t[key] === 'function' ? t[key].bind(t) : t[key]),
			});
			this.okReady();
		} catch (e: any) { this.noReady(new Error('배틀을 시작하지 못했어요')); }
	}
	private emit(out: string[]) {
		if (!out.length) return;
		const v = this.view(out);
		if (this.bulk || !this.onLines) this.backlog.push(...v); else this.onLines(v);
	}
	private handle(seat: Seat, choice: string) {
		if (this.ended) return;
		if (choice === 'tod' || choice.startsWith('forfeit')) {
			this.turnStart = 0;
			if (this.multi && choice === 'tod') { this.over = '대전 시간(20분)이 다 되었다!'; this.emit(this.local.applyInput('p1', 'tod') || []); return; }
			const who = this.nameOfSeat(seat);
			this.over = choice === 'tod' ? '대전 시간(20분)이 다 되었다!' : choice === 'forfeit disconnect' ? `${josa(who, 'conjunctive')}의 연결이 끊어졌다!` : this.multi ? `${josa(who, 'subject')} 기권했다!` : `${who} — 도전을 그만두었다!`;
			const out = this.local.applyInput(this.multi ? this.sideOfSeat(seat) : 'p1', 'forfeit') || [];
			this.emit([`|-message|${this.over}`, ...out]);
			return;
		}
		const c = /^C(\d+)\|(.*)$/.exec(choice), f = /^F(\d+)\|(.*)$/.exec(choice);
		if (c && +c[1] === this.k) {
			const got = this.parts[seat] ||= new Map<number, string>();
			if (!got.size) for (const kv of c[2].split('|')) { const i = kv.indexOf('='); if (i > 0) got.set(+kv.slice(0, i), kv.slice(i + 1)); }
			if (seat === this.me) { this.sentRound = this.k; this.turnStart = 0; }
		} else if (f && +f[1] === this.k && seat === 'p1' && !this.multi) { if (!this.foePart) this.foePart = f[2]; }
		else return;
		this.advance();
	}
	/** 이번 고르기에 필요한 선택이 다 모였으면 엔진에 넣고 다음으로 */
	private advance() {
		const nd = this.need();
		const ok = (sd: Side) => nd[sd].every((seat, pos) => this.parts[seat]?.has(pos));
		if (!ok('p1') || !ok('p2') || (nd.foe && !this.foePart)) return;
		if (!nd.p1.length && !nd.p2.length && !nd.foe) return;
		const out: string[] = [];
		const put = (side: Side, choice: string) => {
			let r = this.local.applyInput(side, choice);
			if (r === null) r = this.local.applyInput(side, 'default');   // 넣을 수 없는 선택(모든 기기에서 똑같이 일어남)은 자동 선택으로
			if (r === null) { this.onDesync?.('배틀 진행이 어긋났어요 (앱 버전이 다를 수 있어요)'); return false; }
			out.push(...r); return true;
		};
		const compose = (sd: Side) => { const ps = nd[sd].map((seat, pos) => this.parts[seat]!.get(pos) || 'default'); return ps.includes('default') ? 'default' : ps.join(', '); };
		if (nd.p1.length && !put('p1', compose('p1'))) return;
		if (nd.p2.length && !this.ended && !put('p2', compose('p2'))) return;
		if (nd.foe && !this.ended && !put('p2', this.foePart)) return;
		this.k++; this.parts = {}; this.foePart = ''; this.mine = ''; this.turnStart = 0;
		this.emit(out);
		this.askAI();
	}
}
