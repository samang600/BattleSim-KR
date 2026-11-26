/** 온라인 협력 타워 — 두 사람이 한 편(멀티배틀)이 되어 AI 두 명과 싸운다.
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
import type { OnlineRoom, StartInfo } from './online';

type Side = 'p1' | 'p2';
type Owner = 'host' | 'guest';
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

/** 배틀 화면(BattleView)이 쓰는 세션과 같은 모양 (RemoteSession 과 같은 이름의 것들). 만든 뒤 ready 를 기다렸다가 화면에 넘긴다 */
export class CoopSession {
	local!: Session;
	foe!: CoopFoe;
	/** 상대 팀이 다 와서 엔진을 만들었을 때 */
	ready: Promise<void>;
	onLines: ((lines: string[]) => void) | null = null;
	onDesync: ((msg: string) => void) | null = null;
	onCatchUp: ((lines: string[]) => void) | null = null;
	onEmote: ((who: 'p1' | 'p2', id: number) => void) | null = null;
	backlog: string[] = [];
	log: [Side, string][] = [];
	/** 리플레이 저장은 하지 않음 (선택 기록의 모양이 달라 다시 보기가 안 됨) */
	info: StartInfo;
	readonly host: boolean;
	readonly me: Owner;
	/** 우리 편 전체(엔진 순서) · 이 기기에서의 파트너 표시 · 편 이름 */
	team: PSet[]; flags: boolean[]; sideName: string;
	private applied = 0;
	private started = false;
	private bulk = false;
	private pre: [Side, string][] = [];
	private chunks: string[] = [];
	private k = 0;
	private parts: { host: Map<number, string>; guest: Map<number, string>; foe: string } = { host: new Map(), guest: new Map(), foe: '' };
	private sentRound = -1;
	private mine = '';
	private aiRound = -1;
	private over = '';
	private okReady!: () => void;
	private noReady!: (e: Error) => void;
	constructor(start: StartInfo, public room: OnlineRoom, makeFoe: () => CoopFoe) {
		this.info = start;
		this.host = start.side === 'p1';
		this.me = this.host ? 'host' : 'guest';
		const t = coopTeam(start.p1.team, start.p2.team);
		this.team = t.team; this.flags = t.isGuest.map(g => g === this.host);   // 방장에게는 손님의 것이 파트너, 손님에게는 방장의 것이 파트너
		this.sideName = `${start.p1.name} & ${start.p2.name}`;
		this.ready = new Promise((ok, no) => { this.okReady = ok; this.noReady = no; });
		room.handlers.input = (side, choice, n) => this.receive(side, choice, n);
		room.handlers.inputs = list => {
			this.bulk = true;
			try { list.forEach((x, i) => this.receive(x[0], x[1], i + 1)); } finally { this.bulk = false; }
			if (this.onCatchUp && this.backlog.length) this.onCatchUp(this.backlog.splice(0));
			// 끊긴 사이에 보낸 내 선택이 서버에 닿지 않았으면 다시 보냄
			if (this.started && !this.ended && this.mine && this.sentRound === this.k && !this.parts[this.me].size) this.room.send({ t: 'choose', choice: this.mine, ms: 0 });
			this.askAI();
		};
		room.handlers.emote = (_side, id) => this.onEmote?.('p1', id);
		for (const m of (room.early || []).splice(0)) { if (m.t === 'inputs') room.handlers.inputs!(m.list); else room.handlers.input!(m.side, m.choice, m.n); }
		// 방장: 잠깐 기다려도 상대 팀이 안 와 있으면(= 새 배틀) 지금 만들어 보냄. 다시 들어온 것이면 지난 기록에 이미 있음
		if (this.host) setTimeout(() => { if (this.chunks.some(Boolean) || this.local) return; try { for (const c of foeChunks(makeFoe())) room.send({ t: 'choose', choice: c, ms: 0 }); } catch (e: any) { this.noReady(e); } }, 900);
		setTimeout(() => { if (!this.local) this.noReady(new Error('상대 팀 정보를 받지 못했어요. 방으로 돌아가 다시 시작해 주세요')); }, 30000);
	}
	get battle() { return this.local.battle as any; }
	get p1Request() { return this.local.p1Request; }
	get ended() { return !!this.local?.ended; }
	get winner() { return this.local.winner; }
	get lastError() { return this.local.lastError; }
	get seed() { return this.local.seed; }
	get rule() { return this.local.rule; }
	get record() { return this.local.record; }
	/** 왜 끝났는지 (기권·끊김·시간) — 결과 화면용 */
	get endReason() { return this.over; }
	start(): string[] {
		const lines = this.local.start();
		this.started = true;
		this.bulk = true;
		try { for (const [side, choice] of this.pre.splice(0)) this.handle(side, choice); } finally { this.bulk = false; }
		this.askAI();
		return lines;
	}
	// 시간: 협력 도전은 고르는 시간을 재지 않음 (서버의 대전 시간 20분만 남음)
	beginTurn() {}
	timers() { return { game: 0, mine: 0, opp: 0, turn: null as number | null }; }
	timeout() { return false; }
	sendEmote(id: number) { this.room.send({ t: 'emote', id }); }
	forfeit(): string[] { this.room.send({ t: 'choose', choice: 'forfeit', ms: 0 }); return []; }

	private ownerOf(pk: any): Owner { return (!!pk?.kPartner) === this.host ? 'guest' : 'host'; }
	/** 이번 고르기에서 정해야 하는 것: 우리 편의 자리들(순서대로, 누구 것인지) · 상대(AI)도 골라야 하는가 */
	private need(): { slots: Owner[]; foe: boolean } {
		const req: any = this.local.p1Request, slots: Owner[] = [];
		if (req && !req.wait && !this.ended) {
			const act: any[] = this.battle.p1.active;
			const n = req.forceSwitch ? req.forceSwitch.length : req.active?.length || 1;
			for (let i = 0; i < n; i++) {
				if (req.forceSwitch) { if (req.forceSwitch[i]) slots.push(this.ownerOf(act[i])); continue; }
				const mon = req.side.pokemon[i];
				if (mon && !mon.condition.endsWith(' fnt') && mon.condition !== '0 fnt' && !req.active[i]?.commanding) slots.push(this.ownerOf(act[i]));
			}
		}
		const r2: any = this.local.p2Request;
		return { slots, foe: !!r2 && !r2.wait && !this.ended };
	}
	/** 내 선택. BattleView 가 이번에 골라야 하는 자리 순서대로 넘김 — 파트너 자리는 '?' */
	choose(choice: string): string[] | null {
		if (this.ended || this.sentRound === this.k) return [];
		const mine = (choice ? choice.split(', ') : []).map((p, pos) => [pos, p] as const).filter(x => x[1] && x[1] !== '?');
		this.sentRound = this.k;
		if (!mine.length) { this.mine = ''; return []; }
		this.mine = `C${this.k}|` + mine.map(([pos, p]) => `${pos}=${p}`).join('|');
		this.room.send({ t: 'choose', choice: this.mine, ms: 0 });
		return [];
	}
	/** 방장: 상대(AI)가 골라야 하면 골라서 보냄 */
	private askAI() {
		if (!this.host || !this.started || this.ended || this.bulk) return;
		const k = this.k;
		if (this.aiRound === k || !this.need().foe || this.parts.foe) return;
		this.aiRound = k;
		setTimeout(() => {
			if (this.ended || this.k !== k || this.parts.foe) return;
			let c = 'default';
			try { c = chooseAI(this.local.battle as any, this.local.p2Request, 'p2', this.foe.skill) || 'default'; } catch (e) { console.error('AI 오류', e); }
			if (c !== 'default' && !this.local.canChoose('p2', c)) c = 'default';
			this.room.send({ t: 'choose', choice: `F${k}|${c}`, ms: 0 });
		}, 40);
	}
	private receive(side: Side, choice: string, n: number) {
		if (n <= this.applied) return;
		this.applied = n;
		this.log.push([side, choice]);
		if (choice.charAt(0) === 'T' && !this.local) {
			const m = /^T(\d+)\/(\d+)\|([\s\S]*)$/.exec(choice);
			if (!m || side !== 'p1') return;
			this.chunks.length = +m[2]; this.chunks[+m[1]] = m[3];
			if ([...this.chunks].every(c => typeof c === 'string')) this.build();
			return;
		}
		if (!this.started) { this.pre.push([side, choice]); return; }
		this.handle(side, choice);
	}
	private build() {
		try {
			const j = JSON.parse(this.chunks.join(''));
			this.foe = { streak: j.s | 0, name: String(j.n || '상대'), title: j.tt || '', sprite: j.sp || undefined, sprite2: j.sp2 || undefined, skill: +j.sk || 0.6, line: j.l || '', team: (j.t as any[]).map(unpackSet) };
			this.local = new Session({
				gen: 9 as any, doubles: true, aiSkill: 0, remote: true, seed: this.info.seed, ruleId: this.info.ruleId, partnerFlags: this.flags,
				p1: { name: this.sideName, team: toSimTeam(this.team) as any },
				p2: { name: this.foe.name, team: toSimTeam(this.foe.team) as any },
			} as any);
			this.okReady();
		} catch (e: any) { this.noReady(new Error('상대 팀 정보를 읽지 못했어요')); }
	}
	private emit(out: string[]) {
		if (!out.length) return;
		if (this.bulk || !this.onLines) this.backlog.push(...out); else this.onLines(out);
	}
	private handle(side: Side, choice: string) {
		if (this.ended) return;
		if (choice === 'tod' || choice.startsWith('forfeit')) {
			const who = side === 'p1' ? this.info.p1.name : this.info.p2.name;
			this.over = choice === 'tod' ? '대전 시간(20분)이 다 되었다!' : choice === 'forfeit disconnect' ? `${who}의 연결이 끊어졌다!` : `${who} — 도전을 그만두었다!`;
			const out = this.local.applyInput('p1', 'forfeit') || [];
			this.emit([`|-message|${this.over}`, ...out]);
			return;
		}
		const c = /^C(\d+)\|(.*)$/.exec(choice), f = /^F(\d+)\|(.*)$/.exec(choice);
		if (c && +c[1] === this.k) {
			const who: Owner = side === 'p1' ? 'host' : 'guest';
			if (!this.parts[who].size) for (const kv of c[2].split('|')) { const i = kv.indexOf('='); if (i > 0) this.parts[who].set(+kv.slice(0, i), kv.slice(i + 1)); }
			if (who === this.me) this.sentRound = this.k;
		} else if (f && +f[1] === this.k && side === 'p1') { if (!this.parts.foe) this.parts.foe = f[2]; }
		else return;
		this.advance();
	}
	/** 이번 고르기에 필요한 선택이 다 모였으면 엔진에 넣고 다음으로 */
	private advance() {
		const nd = this.need();
		const got = (o: Owner) => !nd.slots.includes(o) || nd.slots.every((own, pos) => own !== o || this.parts[o].has(pos));
		if (!got('host') || !got('guest') || (nd.foe && !this.parts.foe)) return;
		if (!nd.slots.length && !nd.foe) return;
		const out: string[] = [];
		const put = (side: Side, choice: string) => {
			let r = this.local.applyInput(side, choice);
			if (r === null) r = this.local.applyInput(side, 'default');   // 넣을 수 없는 선택(양쪽 기기에서 똑같이 일어남)은 자동 선택으로
			if (r === null) { this.onDesync?.('배틀 진행이 어긋났어요 (앱 버전이 다를 수 있어요)'); return false; }
			out.push(...r); return true;
		};
		if (nd.slots.length && !put('p1', nd.slots.map((o, pos) => this.parts[o].get(pos) || 'default').join(', '))) return;
		if (nd.foe && !this.ended && !put('p2', this.parts.foe)) return;
		this.k++; this.parts = { host: new Map(), guest: new Map(), foe: '' }; this.mine = '';
		this.emit(out);
		this.askAI();
	}
}
