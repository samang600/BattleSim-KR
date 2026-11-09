/** 온라인 대전 (친구 대전·랜덤 대전) — 두 기기가 같은 시드·팀으로 같은 배틀을 돌리고, 선택만 서버(battle-kr/server)가 중계한다.
 *
 *  - 서버는 방 코드·매칭·선택 순서·재접속 기록만 맡는다. 판정은 양쪽 앱의 엔진이 똑같이 하므로 앱 버전이 같아야 한다(서버가 확인).
 *  - 엔진은 서버가 정한 진영(p1=방장) 그대로 돌리고, 손님(p2) 화면에서는 진영을 뒤집어 보여 준다(swap*): 화면은 언제나 '내가 p1'.
 *  - 상대 팀 전체가 내 기기에 있으므로(엔진이 돌아야 해서) 친구·연습용. 랭크전은 서버 판정 방식으로 따로 만든다.
 */
import { Session } from './engine';
import { toSimTeam, type PSet } from './sets';

declare const __APP_VERSION__: string;
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
export const SERVER = 'battlesim-kr.samang600.workers.dev';
const wsUrl = (path: string) => `wss://${SERVER}${path}`;

type Side = 'p1' | 'p2';
export interface StartInfo { t: 'start'; side: Side; seed: [number, number, number, number]; ruleId: string; doubles: boolean;
	p1: { name: string; team: PSet[] }; p2: { name: string; team: PSet[] } }
export interface RoomInfo { t: 'room'; code: string; side: Side | null; ruleId: string; doubles: boolean; status: 'waiting' | 'battle' | 'ended';
	players: { p1: string | null; p2: string | null }; online: { p1: boolean; p2: boolean }; version?: string }

/** 기기마다 하나 (재접속 때 같은 진영으로 돌아오는 열쇠) */
export function deviceToken(): string {
	try {
		let t = localStorage.getItem('pkbkr:online-token');
		if (!t) { t = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('pkbkr:online-token', t); }
		return t;
	} catch { return 'anon-' + Math.random().toString(36).slice(2); }
}

/** 헷갈리는 글자(0·O·1·I) 뺀 방 코드 */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newRoomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
export const normCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

/** 방 연결: 서버 메시지를 처리기로 넘기고, 끊기면 몇 번 다시 붙음 */
export class OnlineRoom {
	ws: WebSocket | null = null;
	closed = false;
	handlers: { room?: (r: RoomInfo) => void; start?: (s: StartInfo) => void; input?: (side: Side, choice: string, n: number) => void;
		inputs?: (list: [Side, string][]) => void; error?: (msg: string) => void; status?: (connected: boolean) => void } = {};
	private join: any;
	private retries = 0;
	constructor(public code: string) {}
	connect(join: { name: string; team?: PSet[]; ruleId?: string; doubles?: boolean; peek?: boolean }) {
		this.join = join;
		this.open();
	}
	private open() {
		if (this.closed) return;
		const ws = new WebSocket(wsUrl(`/ws?room=${this.code}`));
		this.ws = ws;
		ws.onopen = () => {
			this.retries = 0; this.handlers.status?.(true);
			ws.send(JSON.stringify({ t: this.join.peek ? 'peek' : 'join', token: deviceToken(), version: APP_VERSION, ...this.join }));
		};
		ws.onmessage = ev => {
			let m: any; try { m = JSON.parse(String(ev.data)); } catch { return; }
			if (m.t === 'room') this.handlers.room?.(m);
			else if (m.t === 'start') this.handlers.start?.(m);
			else if (m.t === 'input') this.handlers.input?.(m.side, m.choice, m.n);
			else if (m.t === 'inputs') this.handlers.inputs?.(m.list);
			else if (m.t === 'error') this.handlers.error?.(m.msg);
		};
		ws.onclose = () => {
			this.handlers.status?.(false);
			if (this.closed || this.join.peek) return;
			// 끊기면 다시 (1·2·4·8초…, 최대 15초 간격)
			const d = Math.min(15000, 1000 * 2 ** this.retries++);
			setTimeout(() => this.open(), d);
		};
	}
	/** 피크(방 정보만 보기)였던 연결을 실제 입장으로 바꿈 */
	rejoin(join: { name: string; team: PSet[] }) { this.join = { ...join }; this.send({ t: 'join', token: deviceToken(), version: APP_VERSION, ...join }); }
	send(m: any) { try { this.ws?.send(JSON.stringify(m)); } catch {} }
	close() { this.closed = true; try { this.ws?.close(); } catch {} }
}

/** 랜덤 대전 매칭: 같은 형식·같은 앱 버전끼리 짝지어 방 코드를 받음 */
export function matchmake(doubles: boolean, onCode: (code: string) => void, onError: (msg: string) => void): () => void {
	const ws = new WebSocket(wsUrl('/queue'));
	let done = false;
	ws.onopen = () => ws.send(JSON.stringify({ t: 'queue', doubles, version: APP_VERSION, token: deviceToken() }));
	ws.onmessage = ev => {
		let m: any; try { m = JSON.parse(String(ev.data)); } catch { return; }
		if (m.t === 'matched') { done = true; onCode(m.code); try { ws.close(); } catch {} }
		else if (m.t === 'error') onError(m.msg);
	};
	ws.onerror = () => { if (!done) onError('서버에 연결하지 못했어요'); };
	return () => { done = true; try { ws.close(); } catch {} };
}

// ── 진영 뒤집기 (손님 화면용): 엔진의 p2 를 화면의 p1 로 ──
const swapTok = (s: string) => s.replace(/\bp([12])([a-d]?)(?=[:|]|$)/g, (_m, d, slot) => `p${d === '1' ? '2' : '1'}${slot}`);
const swapReq = (req: any) => req && JSON.parse(swapTok(JSON.stringify(req)).replace(/"id":"p([12])"/g, (_m, d) => `"id":"p${d === '1' ? '2' : '1'}"`));

/** 배틀 화면(BattleView)이 쓰는 Session 과 같은 모양. 내 선택은 서버로 보내고, 서버가 중계한 순서대로 양쪽 선택을 엔진에 넣는다 */
export class RemoteSession {
	local: Session;
	mySide: Side;
	/** 화면 쪽에서 받는 새 배틀 줄 (상대 선택이 와서 턴이 진행될 때 등) */
	onLines: ((lines: string[]) => void) | null = null;
	onDesync: ((msg: string) => void) | null = null;
	private applied = 0;
	private flip: boolean;
	private battleProxy: any;
	constructor(public info: StartInfo, public room: OnlineRoom) {
		const start = info;
		this.mySide = start.side;
		this.flip = start.side === 'p2';
		this.local = new Session({
			gen: 9 as any, doubles: start.doubles, aiSkill: 0, remote: true, seed: start.seed, ruleId: start.ruleId,
			p1: { name: start.p1.name, team: toSimTeam(start.p1.team) as any },
			p2: { name: start.p2.name, team: toSimTeam(start.p2.team) as any },
		});
		const real = this.local.battle as any;
		this.battleProxy = !this.flip ? real : new Proxy(real, {
			get: (t, k) => k === 'p1' ? t.p2 : k === 'p2' ? t.p1 : k === 'sides' ? [t.p2, t.p1] : (typeof t[k] === 'function' ? t[k].bind(t) : t[k]),
		});
		room.handlers.input = (side, choice, n) => this.receive(side, choice, n);
		room.handlers.inputs = list => list.forEach((x, i) => this.receive(x[0], x[1], i + 1));
	}
	private view(lines: string[] | null) { return !lines ? lines : this.flip ? lines.map(swapTok) : lines; }
	get battle() { return this.battleProxy; }
	get p1Request() { return this.flip ? swapReq(this.local.p2Request) : this.local.p1Request; }
	get ended() { return this.local.ended; }
	get winner() { return this.local.winner; }
	get lastError() { return this.local.lastError; }
	get seed() { return this.local.seed; }
	get rule() { return this.local.rule; }
	get record() { return this.flip ? { p1: this.local.record.p2, p2: this.local.record.p1 } : this.local.record; }
	start(): string[] { return this.view(this.local.start())!; }
	/** 내 선택: 먼저 내 엔진에서 가능한지 보고 서버로 보냄 (실제 적용은 서버가 중계해 돌려줄 때). 안 되면 null */
	choose(choice: string): string[] | null {
		if (!this.local.canChoose(this.mySide, choice)) return null;
		this.room.send({ t: 'choose', choice });
		return [];
	}
	forfeit(): string[] { this.room.send({ t: 'choose', choice: 'forfeit' }); return []; }
	private receive(side: Side, choice: string, n: number) {
		if (n <= this.applied) return;             // 이미 넣은 것 (재접속 때 다시 온 기록)
		this.applied = n;
		const out = this.local.applyInput(side, choice);
		if (out === null) { this.onDesync?.('상대와 배틀 진행이 어긋났어요 (앱 버전이 다를 수 있어요)'); return; }
		if (out.length) this.onLines?.(this.view(out)!);
	}
}
