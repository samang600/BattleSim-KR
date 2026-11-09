/** 배틀시뮬 KR 온라인 배틀 서버 (Cloudflare Workers + Durable Objects)
 *
 *  GET  /                 → 상태 확인
 *  POST /room             → 친구 배틀 방 만들기 {code}
 *  GET  /ws?room=CODE     → WebSocket (방 = Durable Object 하나)
 *
 *  메시지 (JSON)
 *   앱 → 서버  {t:'join', name, token, team, ruleId?, doubles?}   // 처음 들어온 사람이 방 규칙을 정함
 *              {t:'choose', choice}  ·  {t:'forfeit'}
 *   서버 → 앱  {t:'room', code, side, players, ruleId, doubles, status}
 *              {t:'lines', lines}  ·  {t:'request', req}  ·  {t:'end', winner}  ·  {t:'error', msg}
 *              {t:'opp', online}   // 상대 접속 상태
 *  잠든 뒤 깨어나면(hibernation) 저장한 시드·팀·선택 기록으로 배틀을 다시 만든다.
 */
import '../../src/ps/registry';
import { DurableObject } from 'cloudflare:workers';
import { Match, type MatchSetup, type Out, type Side } from './match';

interface Env { ROOMS: DurableObjectNamespace<Room> }
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
/** 헷갈리는 글자(0·O·1·I) 뺀 방 코드 6자리 */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => CODE_CHARS[b % CODE_CHARS.length]).join('');

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);
		if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
		if (url.pathname === '/') return json({ ok: true, service: 'battlesim-kr', time: Date.now() });
		if (url.pathname === '/room' && req.method === 'POST') return json({ code: newCode() });
		if (url.pathname === '/ws') {
			const code = (url.searchParams.get('room') || '').toUpperCase();
			if (!/^[A-Z0-9]{4,8}$/.test(code)) return json({ error: '방 코드가 올바르지 않아요' }, 400);
			if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'WebSocket 으로 연결해 주세요' }, 426);
			return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(req);
		}
		return json({ error: 'not found' }, 404);
	},
};

interface Player { name: string; token: string; team: any[] }
interface RoomState { code: string; ruleId: string; doubles: boolean; players: { p1?: Player; p2?: Player }; seed?: [number, number, number, number]; inputs: [Side, string][]; ended?: boolean; winner?: string; created: number }

export class Room extends DurableObject<Env> {
	private st: RoomState | null = null;
	private match: Match | null = null;

	private async load(code?: string): Promise<RoomState> {
		if (!this.st) this.st = (await this.ctx.storage.get<RoomState>('room')) || { code: code || '', ruleId: 'mzdt_one.natdex.no.no', doubles: false, players: {}, inputs: [], created: Date.now() };
		return this.st;
	}
	private async save() { await this.ctx.storage.put('room', this.st!); }

	/** 메모리의 배틀이 없으면(잠들었다 깸) 기록으로 다시 만듦 */
	private ensureMatch(): { p1: string[]; p2: string[] } | null {
		const s = this.st!;
		if (!s.seed || !s.players.p1 || !s.players.p2) return null;
		if (this.match) return null;
		const r = Match.rebuild(this.setupOf(s), s.inputs);
		this.match = r.match;
		return r.log;
	}
	private setupOf(s: RoomState): MatchSetup {
		return { ruleId: s.ruleId, doubles: s.doubles, seed: s.seed!, p1: { name: s.players.p1!.name, team: s.players.p1!.team }, p2: { name: s.players.p2!.name, team: s.players.p2!.team } };
	}
	/** 진영별 소켓 (진영은 join 때 소켓에 붙여 둠 — 잠들었다 깨도 유지) */
	private sockets(side?: Side) { return this.ctx.getWebSockets().filter(ws => !side || (ws.deserializeAttachment() as any)?.side === side); }
	private send(side: Side, msg: any) { const s = JSON.stringify(msg); for (const ws of this.sockets(side)) try { ws.send(s); } catch {} }
	private roomInfo(side: Side | null) {
		const s = this.st!;
		return { t: 'room', code: s.code, side, ruleId: s.ruleId, doubles: s.doubles, status: s.ended ? 'ended' : s.seed ? 'battle' : 'waiting',
			players: { p1: s.players.p1?.name || null, p2: s.players.p2?.name || null },
			online: { p1: this.sockets('p1').length > 0, p2: this.sockets('p2').length > 0 } };
	}
	private deliver(o: Out) {
		for (const side of ['p1', 'p2'] as Side[]) {
			if (o[side].length) this.send(side, { t: 'lines', lines: o[side] });
			if (o.req[side]) this.send(side, { t: 'request', req: o.req[side] });
		}
		if (o.ended) for (const side of ['p1', 'p2'] as Side[]) this.send(side, { t: 'end', winner: o.winner });
	}

	async fetch(req: Request): Promise<Response> {
		const code = (new URL(req.url).searchParams.get('room') || '').toUpperCase();
		await this.load(code);
		const pair = new WebSocketPair();
		// 잠들어도 연결은 유지 (hibernation)
		this.ctx.acceptWebSocket(pair[1]);
		return new Response(null, { status: 101, webSocket: pair[0] });
	}

	async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
		const s = await this.load();
		let m: any;
		try { m = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); } catch { return; }
		const err = (msg: string) => ws.send(JSON.stringify({ t: 'error', msg }));

		if (m.t === 'join') {
			const token = String(m.token || '').slice(0, 64), name = String(m.name || '트레이너').slice(0, 16);
			if (!token) return err('token 이 필요해요');
			// 같은 토큰이면 재접속 (진영 유지)
			let side: Side | null = s.players.p1?.token === token ? 'p1' : s.players.p2?.token === token ? 'p2' : null;
			if (!side) {
				if (s.players.p1 && s.players.p2) return err('방이 꽉 찼어요');
				const team = Array.isArray(m.team) ? m.team.slice(0, 6) : [];
				if (!team.length) return err('팀이 비어 있어요');
				side = s.players.p1 ? 'p2' : 'p1';
				if (side === 'p1') { if (m.ruleId) s.ruleId = String(m.ruleId); s.doubles = !!m.doubles; }
				s.players[side] = { name, token, team };
				await this.save();
			}
			ws.serializeAttachment({ side });   // 이 소켓의 진영 (잠들었다 깨도 남음)
			// 두 명이 모이면 배틀 시작
			if (!s.seed && s.players.p1 && s.players.p2) {
				s.seed = Array.from(crypto.getRandomValues(new Uint16Array(4))) as any;
				await this.save();
				this.match = new Match(this.setupOf(s));
				const o = this.match.start();
				this.broadcastRoom();
				this.deliver(o);
				return;
			}
			this.broadcastRoom();
			if (s.seed) {
				// 재접속: 지금까지의 줄과 마지막 요청을 다시 보냄
				const log = this.ensureMatch();
				const full = log ? log[side] : Match.rebuild(this.setupOf(s), s.inputs).log[side];
				ws.send(JSON.stringify({ t: 'lines', lines: full, replay: true }));
				const r = this.match?.lastReq[side];
				if (r && !s.ended) ws.send(JSON.stringify({ t: 'request', req: r }));
				if (s.ended) ws.send(JSON.stringify({ t: 'end', winner: s.winner || '' }));
			}
			return;
		}

		const side = (ws.deserializeAttachment() as any)?.side as Side | undefined;
		if (!side) return err('먼저 join 해 주세요');
		if (m.t === 'choose' || m.t === 'forfeit') {
			if (!s.seed || s.ended) return err('배틀 중이 아니에요');
			this.ensureMatch();
			const o = this.match!.choose(side, m.t === 'forfeit' ? 'forfeit' : String(m.choice || ''));
			if (!o) return err(this.match!.lastError || '선택할 수 없는 행동이에요');
			s.inputs = this.match!.inputs;
			if (o.ended) { s.ended = true; s.winner = o.winner; }
			await this.save();
			this.deliver(o);
			return;
		}
		if (m.t === 'ping') ws.send(JSON.stringify({ t: 'pong' }));
	}

	private broadcastRoom() {
		for (const ws of this.ctx.getWebSockets()) {
			const side = (ws.deserializeAttachment() as any)?.side ?? null;
			try { ws.send(JSON.stringify(this.roomInfo(side))); } catch {}
		}
	}

	async webSocketClose(ws: WebSocket) { try { ws.close(); } catch {} this.broadcastRoom(); }
	async webSocketError(ws: WebSocket) { this.broadcastRoom(); }
}
