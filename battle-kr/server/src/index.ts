/** 배틀시뮬 KR 온라인 대전 서버 (Cloudflare Workers + Durable Objects, 무료 요금제)
 *
 *  친구 대전·랜덤 대전은 '선택 중계' 방식: 두 앱이 같은 시드·팀으로 같은 배틀을 돌리고, 서버는 선택을 받은 순서대로 양쪽에 돌려준다.
 *  (판정은 앱 엔진이 하므로 앱 버전이 같아야 함 — 입장 때 확인. 서버 판정 방식은 src/match.ts, 랭크전용으로 남겨 둠)
 *
 *  GET /            상태 확인
 *  GET /ws?room=CODE   방 (Durable Object 하나)
 *    앱 → {t:'peek'}                      방 정보만 (입장 전)
 *         {t:'join', name, token, team, ruleId?, doubles?, version}   처음 들어온 사람(방장)이 규칙·형식을 정함
 *         {t:'choose', choice}            내 선택 ('forfeit' = 기권)
 *    서버 → {t:'room', ...}  {t:'start', side, seed, ruleId, doubles, p1:{name,team}, p2:{name,team}}
 *           {t:'input', side, choice, n}  (n = 몇 번째 선택, 1부터)   {t:'inputs', list}  (재접속 때 지금까지 전부)   {t:'error', msg}
 *  GET /queue       랜덤 대전 매칭 (Lobby)
 *    앱 → {t:'queue', doubles, version, token}   서버 → {t:'matched', code}
 */
import { DurableObject } from 'cloudflare:workers';

interface Env { ROOMS: DurableObjectNamespace<Room>; LOBBY: DurableObjectNamespace<Lobby> }
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
const ROOM_TTL = 6 * 3600 * 1000;   // 방은 6시간 뒤 지움

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);
		if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
		if (url.pathname === '/') return json({ ok: true, service: 'battlesim-kr', time: Date.now() });
		if (url.pathname === '/room' && req.method === 'POST') return json({ code: newCode() });
		const ws = req.headers.get('Upgrade') === 'websocket';
		if (url.pathname === '/ws') {
			const code = (url.searchParams.get('room') || '').toUpperCase();
			if (!/^[A-Z0-9]{4,8}$/.test(code)) return json({ error: '방 코드가 올바르지 않아요' }, 400);
			if (!ws) return json({ error: 'WebSocket 으로 연결해 주세요' }, 426);
			return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(req);
		}
		if (url.pathname === '/queue') {
			if (!ws) return json({ error: 'WebSocket 으로 연결해 주세요' }, 426);
			return env.LOBBY.get(env.LOBBY.idFromName('lobby')).fetch(req);
		}
		return json({ error: 'not found' }, 404);
	},
};

type Side = 'p1' | 'p2';
interface Player { name: string; token: string; team: any[]; version: string; sprite?: string }
interface RoomState { code: string; ruleId: string; doubles: boolean; players: { p1?: Player; p2?: Player };
	seed?: number[]; inputs: [Side, string][]; ended?: boolean; created: number }

export class Room extends DurableObject<Env> {
	private st: RoomState | null = null;
	private async load(code = ''): Promise<RoomState> {
		if (!this.st) this.st = (await this.ctx.storage.get<RoomState>('room')) || { code, ruleId: 'mzdt_one.natdex.no.no', doubles: false, players: {}, inputs: [], created: Date.now() };
		if (!this.st.code && code) this.st.code = code;
		return this.st;
	}
	private async save() { await this.ctx.storage.put('room', this.st!); }
	private sideOf(ws: WebSocket): Side | null { return (ws.deserializeAttachment() as any)?.side ?? null; }
	private sockets(side?: Side) { return this.ctx.getWebSockets().filter(ws => !side || this.sideOf(ws) === side); }
	private send(ws: WebSocket, m: any) { try { ws.send(JSON.stringify(m)); } catch {} }
	private roomInfo(side: Side | null) {
		const s = this.st!;
		return { t: 'room', code: s.code, side, ruleId: s.ruleId, doubles: s.doubles, status: s.ended ? 'ended' : s.seed ? 'battle' : 'waiting',
			players: { p1: s.players.p1?.name || null, p2: s.players.p2?.name || null }, version: s.players.p1?.version,
			online: { p1: this.sockets('p1').length > 0, p2: this.sockets('p2').length > 0 } };
	}
	private broadcastRoom() { for (const ws of this.ctx.getWebSockets()) this.send(ws, this.roomInfo(this.sideOf(ws))); }
	private startMsg(side: Side) {
		const s = this.st!;
		return { t: 'start', side, seed: s.seed, ruleId: s.ruleId, doubles: s.doubles,
			p1: { name: s.players.p1!.name, team: s.players.p1!.team, sprite: s.players.p1!.sprite }, p2: { name: s.players.p2!.name, team: s.players.p2!.team, sprite: s.players.p2!.sprite } };
	}

	async fetch(req: Request): Promise<Response> {
		await this.load((new URL(req.url).searchParams.get('room') || '').toUpperCase());
		const pair = new WebSocketPair();
		this.ctx.acceptWebSocket(pair[1]);   // 잠들어도 연결 유지 (hibernation)
		if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL);
		return new Response(null, { status: 101, webSocket: pair[0] });
	}
	async alarm() { for (const ws of this.ctx.getWebSockets()) try { ws.close(1000, '방이 닫혔어요'); } catch {} await this.ctx.storage.deleteAll(); this.st = null; }

	async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
		const s = await this.load();
		let m: any;
		try { m = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); } catch { return; }
		const err = (msg: string) => this.send(ws, { t: 'error', msg });

		if (m.t === 'peek') return this.send(ws, this.roomInfo(null));
		if (m.t === 'join') {
			const token = String(m.token || '').slice(0, 64), version = String(m.version || '');
			if (!token) return err('token 이 필요해요');
			let side: Side | null = s.players.p1?.token === token ? 'p1' : s.players.p2?.token === token ? 'p2' : null;
			if (!side) {
				if (s.players.p1 && s.players.p2) return err('방이 꽉 찼어요');
				if (s.players.p1 && s.players.p1.version !== version) return err(`앱 버전이 달라서 함께 대전할 수 없어요 (방장 v${s.players.p1.version} · 나 v${version}). 둘 다 최신 버전으로 맞춰 주세요.`);
				const team = Array.isArray(m.team) ? m.team.slice(0, 6) : [];
				if (!team.length) return err('팀이 비어 있어요');
				side = s.players.p1 ? 'p2' : 'p1';
				let name = String(m.name || '트레이너').slice(0, 16);
				if (side === 'p2' && name === s.players.p1!.name) name += ' (2)';   // 승자 판정이 이름으로 되므로 겹치지 않게
				if (side === 'p1') { if (m.ruleId) s.ruleId = String(m.ruleId).slice(0, 80); s.doubles = !!m.doubles; }
				s.players[side] = { name, token, team, version, sprite: String(m.sprite || '').slice(0, 40) };
				await this.save();
			}
			ws.serializeAttachment({ side });
			if (!s.seed && s.players.p1 && s.players.p2) {
				s.seed = Array.from(crypto.getRandomValues(new Uint16Array(4)));
				await this.save();
				this.broadcastRoom();
				for (const sd of ['p1', 'p2'] as Side[]) for (const w of this.sockets(sd)) this.send(w, this.startMsg(sd));
				return;
			}
			this.broadcastRoom();
			if (s.seed) {   // 재접속: 시작 정보와 지금까지의 선택
				this.send(ws, this.startMsg(side));
				this.send(ws, { t: 'inputs', list: s.inputs });
			}
			return;
		}
		const side = this.sideOf(ws);
		if (!side) return err('먼저 입장해 주세요');
		if (m.t === 'choose') {
			if (!s.seed) return err('아직 상대가 없어요');
			if (s.ended) return err('끝난 배틀이에요');
			const choice = String(m.choice || '').slice(0, 200);
			if (!choice) return;
			s.inputs.push([side, choice]);
			if (choice === 'forfeit') s.ended = true;
			await this.save();
			const msg = { t: 'input', side, choice, n: s.inputs.length };
			for (const w of this.ctx.getWebSockets()) if (this.sideOf(w)) this.send(w, msg);
			return;
		}
		if (m.t === 'ended') { s.ended = true; await this.save(); return; }
		if (m.t === 'ping') this.send(ws, { t: 'pong' });
	}
	async webSocketClose(ws: WebSocket) { try { ws.close(); } catch {} this.broadcastRoom(); }
	async webSocketError() { this.broadcastRoom(); }
}

/** 랜덤 대전 매칭: 같은 형식(싱글·더블)·같은 앱 버전끼리 먼저 온 순서로 짝지음 */
export class Lobby extends DurableObject<Env> {
	async fetch(req: Request): Promise<Response> {
		const pair = new WebSocketPair();
		this.ctx.acceptWebSocket(pair[1]);
		return new Response(null, { status: 101, webSocket: pair[0] });
	}
	async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
		let m: any;
		try { m = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); } catch { return; }
		if (m.t !== 'queue') return;
		const me = { doubles: !!m.doubles, version: String(m.version || ''), token: String(m.token || ''), at: Date.now() };
		const other = this.ctx.getWebSockets().find(w => {
			if (w === ws) return false;
			const a = w.deserializeAttachment() as any;
			return a && a.doubles === me.doubles && a.version === me.version && a.token !== me.token;
		});
		if (!other) { ws.serializeAttachment(me); ws.send(JSON.stringify({ t: 'waiting' })); return; }
		const code = newCode();
		other.serializeAttachment(null);
		for (const w of [other, ws]) { try { w.send(JSON.stringify({ t: 'matched', code })); w.close(1000, 'matched'); } catch {} }
	}
	async webSocketClose(ws: WebSocket) { try { ws.close(); } catch {} }
}
