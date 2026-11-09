/** 배틀시뮬 KR 온라인 대전 서버 (Cloudflare Workers + Durable Objects, 무료 요금제)
 *
 *  친구 대전·랜덤 대전은 '선택 중계' 방식: 두 앱이 같은 시드·팀으로 같은 배틀을 돌리고, 서버는 선택을 받은 순서대로 양쪽에 돌려준다.
 *  (판정은 앱 엔진이 하므로 앱 버전이 같아야 함 — 입장 때 확인. 서버 판정 방식은 src/match.ts, 랭크전용으로 남겨 둠)
 *
 *  GET /            상태 확인
 *  GET /ws?room=CODE   방 (Durable Object 하나)
 *    앱 → {t:'peek'}                      방 정보만 (입장 전)
 *         {t:'join', name, token, team, ruleId?, doubles?, pick?, version}   처음 들어온 사람(방장)이 규칙·형식·참가 수(pick)를 정함
 *         {t:'pick', idx:[...]}           엔트리 확인 후 참가 포켓몬·순서 (팀 안 번호, 0부터)
 *         {t:'choose', choice}            내 선택 ('forfeit' = 기권)
 *         {t:'leave'}                     배틀 전에 나감 (상대에게 알림)
 *    서버 → {t:'room', ...}  {t:'preview', side, pick, doubles, ruleId, p1:{name,team,sprite}, p2:{...}, picked}  (둘 다 들어오면: 서로 전체 엔트리)
 *           {t:'start', side, seed, ruleId, doubles, p1:{name,team}, p2:{name,team}}  (둘 다 고르면: 고른 포켓몬만, 고른 순서)
 *           연결이 끊긴 채 GRACE 가 지나면 그쪽의 'forfeit disconnect' 를 대신 넣음 (배틀 전이면 {t:'error'} 로 취소)
 *           {t:'input', side, choice, n}  (n = 몇 번째 선택, 1부터)   {t:'inputs', list}  (재접속 때 지금까지 전부)   {t:'error', msg}
 *  GET /queue       랜덤 대전 매칭 (Lobby)
 *    앱 → {t:'queue', doubles, pick, version, token}   서버 → {t:'matched', code}
 *
 *  로비식 방 (v2.67): 만든 방은 로비 목록에 올라가고(규칙이 달라도 보임), 공개 방 또는 비밀번호 방.
 *    입장: {t:'join', ..., create:{title, pw, ruleId, doubles, pick}} (방 만들기) · {t:'join', ..., pw} (들어가기, 팀 없이도 됨)
 *    방 안: {t:'team', team} 파티 바꾸기 · {t:'rules', ruleId, doubles, pick} 방장이 규칙·형식 바꾸기 · {t:'ready', on} 준비
 *           {t:'chat', text} 채팅 → {t:'chat', side, name, text, at} (처음 들어오면 {t:'chatlog', list})
 *           {t:'leave'} 손님이 나가면 자리가 비고, 방장이 나가면 방이 닫힘 · {t:'again'} 배틀이 끝난 뒤 방으로 돌아가기
 *    둘 다 준비하면 {t:'preview'} → 고르기 → {t:'start'} (그다음은 위와 같음)
 *  GET /lobby       로비 목록 (Lobby): 앱 → {t:'list'}  서버 → {t:'rooms', list:[{code,title,host,sprite,ruleId,doubles,pick,locked,players,status,version}]} (바뀔 때마다)
 */
import { DurableObject } from 'cloudflare:workers';

interface Env { ROOMS: DurableObjectNamespace<Room>; LOBBY: DurableObjectNamespace<Lobby> }
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
const ROOM_TTL = 6 * 3600 * 1000;   // 방은 6시간 뒤 지움
const GRACE = 60 * 1000;            // 연결이 끊기고 이만큼 돌아오지 않으면 기권 처리
/** 시간 규칙 (포켓몬 챔피언스 랭크배틀과 같게): 한 번 고르는 시간 45초 · 내 시간(持ち時間) 7분 · 대전 시간 20분 */
const TURN = 45 * 1000, OWN = 7 * 60 * 1000, GAME = 20 * 60 * 1000;
/** 하트비트: 앱이 10초마다 ping(서버를 깨우지 않는 자동 응답). 이만큼 소식이 없으면(휴대폰 잠자기 등 소켓만 남은 경우) 끊긴 것으로 봄.
 *  확인은 주기 알람 대신 배틀 중인 앱이 20초마다 보내는 {t:'check'} 로 함 — 받은 메시지는 요청 1/20 로 세고 저장소에 쓰지 않아서
 *  (알람은 1번마다 요청 1 + 쓴 줄 1) 무료 한도(하루 쓴 줄 10만)를 훨씬 덜 씀. 알람은 끊김 기한·대전 시간 끝·방 수명에만 */
const STALE = 30 * 1000;

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
		if (url.pathname === '/queue' || url.pathname === '/lobby') {
			if (!ws) return json({ error: 'WebSocket 으로 연결해 주세요' }, 426);
			return env.LOBBY.get(env.LOBBY.idFromName('lobby')).fetch(req);
		}
		return json({ error: 'not found' }, 404);
	},
};

type Side = 'p1' | 'p2';
interface Player { name: string; token: string; team: any[]; version: string; sprite?: string; picked?: number[]; ready?: boolean }
interface ChatMsg { side: Side | ''; name: string; text: string; at: number }
interface RoomState { code: string; ruleId: string; doubles: boolean; pick: number; players: { p1?: Player; p2?: Player };
	seed?: number[]; inputs: [Side, string][]; ended?: boolean; created: number; away?: { p1?: number; p2?: number };
	startedAt?: number; spent?: { p1: number; p2: number };
	/** 로비식 방: 제목 · 비밀번호(SHA-256) · 채팅 · 닫힘 */ lobby?: boolean; title?: string; pw?: string; chat?: ChatMsg[]; closed?: boolean }
const sha = async (t: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bskr:' + t))), b => b.toString(16).padStart(2, '0')).join('');
const CHAT_KEEP = 30;
/** 로비 목록 한 줄 */
interface RoomCard { code: string; title: string; host: string; sprite: string; ruleId: string; doubles: boolean; pick: number; locked: boolean; players: number; status: 'waiting' | 'battle'; version: string; at: number }

export class Room extends DurableObject<Env> {
	private st: RoomState | null = null;
	/** 지금 걸려 있는 알람 시각 (같으면 다시 쓰지 않음 — setAlarm 도 1줄 쓰기) */
	private alarmAt: number | null | undefined = undefined;
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		// ping 은 깨우지 않고 자동 응답 (마지막 응답 시각으로 살아 있는지 봄)
		ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
	}
	private lastSeen(ws: WebSocket) {
		const a = (ws.deserializeAttachment() as any)?.at || 0;
		const r = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() || 0;
		return Math.max(a, r);
	}
	private alive(side: Side, now = Date.now()) { return this.sockets(side).filter(w => w.readyState === 1 && now - this.lastSeen(w) < STALE); }
	private clock() {
		const s = this.st!, sp = s.spent || { p1: 0, p2: 0 };
		return { turn: TURN, own: OWN, game: GAME, left: { p1: Math.max(0, OWN - sp.p1), p2: Math.max(0, OWN - sp.p2) },
			gameLeft: s.startedAt ? Math.max(0, s.startedAt + GAME - Date.now()) : GAME };
	}
	private async load(code = ''): Promise<RoomState> {
		if (!this.st) this.st = (await this.ctx.storage.get<RoomState>('room')) || { code, ruleId: 'mzdt_one.natdex.no.no', doubles: false, pick: 6, players: {}, inputs: [], created: Date.now() };
		if (!this.st.code && code) this.st.code = code;
		return this.st;
	}
	private async save() { await this.ctx.storage.put('room', this.st!); }
	private sideOf(ws: WebSocket): Side | null { return (ws.deserializeAttachment() as any)?.side ?? null; }
	private sockets(side?: Side) { return this.ctx.getWebSockets().filter(ws => !side || this.sideOf(ws) === side); }
	private send(ws: WebSocket, m: any) { try { ws.send(JSON.stringify(m)); } catch {} }
	private roomInfo(side: Side | null) {
		const s = this.st!;
		return { t: 'room', code: s.code, side, ruleId: s.ruleId, doubles: s.doubles, pick: s.pick || 6,
			picked: { p1: !!s.players.p1?.picked, p2: !!s.players.p2?.picked }, status: s.ended ? 'ended' : s.seed ? 'battle' : 'waiting',
			players: { p1: s.players.p1?.name || null, p2: s.players.p2?.name || null }, version: s.players.p1?.version,
			online: { p1: this.alive('p1').length > 0, p2: this.alive('p2').length > 0 }, away: s.away || {},
			lobby: !!s.lobby, title: s.title || '', locked: !!s.pw, closed: !!s.closed,
			ready: { p1: !!s.players.p1?.ready, p2: !!s.players.p2?.ready }, hasTeam: { p1: !!s.players.p1?.team?.length, p2: !!s.players.p2?.team?.length },
			sprites: { p1: s.players.p1?.sprite || '', p2: s.players.p2?.sprite || '' } };
	}
	/** 로비 목록에 알림 (바뀐 경우만). 닫혔거나 끝났거나 로비 방이 아니면 목록에서 뺌 */
	private lastCard = '';
	private async notifyLobby() {
		const s = this.st!;
		if (!s.lobby) return;
		const p1 = s.players.p1;
		const card: RoomCard | null = !p1 || s.closed ? null : { code: s.code, title: s.title || `${p1.name}의 방`, host: p1.name, sprite: p1.sprite || '', ruleId: s.ruleId, doubles: s.doubles,
			pick: s.pick || 6, locked: !!s.pw, players: s.players.p2 ? 2 : 1, status: s.seed && !s.ended ? 'battle' : 'waiting', version: p1.version, at: s.created };
		const key = JSON.stringify(card);
		if (key === this.lastCard) return;
		this.lastCard = key;
		try { await this.env.LOBBY.get(this.env.LOBBY.idFromName('lobby')).fetch('https://lobby/update', { method: 'POST', body: JSON.stringify({ code: s.code, card }) }); } catch {}
	}
	private sendPreviews() { for (const sd of ['p1', 'p2'] as Side[]) for (const w of this.sockets(sd)) this.send(w, this.previewMsg(sd)); }
	private broadcastRoom() { for (const ws of this.ctx.getWebSockets()) this.send(ws, this.roomInfo(this.sideOf(ws))); void this.notifyLobby(); }
	private startMsg(side: Side) {
		const s = this.st!;
		return { t: 'start', side, seed: s.seed, ruleId: s.ruleId, doubles: s.doubles, clock: this.clock(),
			p1: this.pub('p1', true), p2: this.pub('p2', true) };
	}
	private pub(sd: Side, picked: boolean) {
		const p = this.st!.players[sd]!;
		return { name: p.name, sprite: p.sprite, team: picked && p.picked ? p.picked.map(i => p.team[i]) : p.team };
	}
	private previewMsg(side: Side) {
		const s = this.st!;
		return { t: 'preview', side, pick: s.pick || 6, doubles: s.doubles, ruleId: s.ruleId, p1: this.pub('p1', false), p2: this.pub('p2', false), picked: !!s.players[side]?.picked };
	}
	/** 둘 다 골랐으면 시드를 정하고 시작 */
	private async maybeStart() {
		const s = this.st!;
		if (s.seed || !s.players.p1?.picked || !s.players.p2?.picked) return false;
		s.seed = Array.from(crypto.getRandomValues(new Uint16Array(4)));
		s.startedAt = Date.now(); s.spent = { p1: 0, p2: 0 };
		await this.save(); await this.schedule();
		this.broadcastRoom();
		for (const sd of ['p1', 'p2'] as Side[]) for (const w of this.sockets(sd)) this.send(w, this.startMsg(sd));
		return true;
	}
	/** 알람: 방 수명(TTL) · 끊긴 쪽 기한 · 대전 시간 끝 중 빠른 것. 이미 그 시각이면 쓰지 않음 */
	private async schedule() {
		const s = this.st!;
		const live = !s.ended && !!s.players.p1 && !!s.players.p2;
		const ts = [s.created + ROOM_TTL, s.away?.p1, s.away?.p2, live && s.seed && s.startedAt ? s.startedAt + GAME : 0].filter((x): x is number => !!x);
		const want = Math.min(...ts);
		if (this.alarmAt === undefined) this.alarmAt = await this.ctx.storage.getAlarm();
		if (this.alarmAt === want) return;
		this.alarmAt = want;
		await this.ctx.storage.setAlarm(want);
	}
	/** 소식 없는 쪽(잠자기 등)을 끊긴 것으로: 소켓을 닫고 마지막 소식 + STALE + GRACE 까지 기다림. 바뀌었으면 true */
	private markStale(now: number): boolean {
		const s = this.st!;
		if (s.ended || !s.players.p1 || !s.players.p2) return false;
		let changed = false;
		for (const sd of ['p1', 'p2'] as Side[]) {
			if (s.away?.[sd] || this.alive(sd, now).length) continue;
			const socks = this.sockets(sd);
			const last = Math.max(0, ...socks.map(w => this.lastSeen(w)));
			for (const w of socks) try { w.close(4000, 'stale'); } catch {}
			s.away = { ...(s.away || {}), [sd]: (last || now) + STALE + GRACE };
			changed = true;
		}
		if (changed) this.broadcastRoom();
		return changed;
	}
	private pushChat(msg: ChatMsg) { const s = this.st!; s.chat = [...(s.chat || []), msg].slice(-CHAT_KEEP); }
	private sendChatTail() { const c = this.st!.chat || []; const last = c[c.length - 1]; if (last) for (const w of this.ctx.getWebSockets()) this.send(w, { t: 'chat', ...last }); }
	/** 로비 방에서 손님 자리를 비움 (나감·끊김). 방장 자리면 방을 닫음 */
	private dropPlayer(sd: Side, note: string) {
		const s = this.st!;
		if (sd === 'p1') { s.closed = true; s.ended = true; for (const w of this.ctx.getWebSockets()) this.send(w, { t: 'error', msg: '방장의 연결이 끊어져 방이 닫혔어요' }); void this.notifyLobby(); return; }
		for (const w of this.sockets('p2')) { try { w.serializeAttachment({ at: Date.now() }); } catch {} }
		delete s.players.p2; delete s.away?.p2;
		if (s.players.p1) { s.players.p1.ready = false; s.players.p1.picked = undefined; }
		this.pushChat({ side: '', name: '', text: note, at: Date.now() });
		this.broadcastRoom(); this.sendChatTail();
	}
	private relay(side: Side, choice: string) {
		const s = this.st!;
		s.inputs.push([side, choice]);
		if (choice.startsWith('forfeit') || choice === 'tod') s.ended = true;   // 끝 (안 그러면 대전 시간 알람이 계속 다시 울림)
		const msg = { t: 'input', side, choice, n: s.inputs.length, clock: this.clock() };
		for (const w of this.ctx.getWebSockets()) if (this.sideOf(w)) this.send(w, msg);
	}

	async fetch(req: Request): Promise<Response> {
		await this.load((new URL(req.url).searchParams.get('room') || '').toUpperCase());
		const pair = new WebSocketPair();
		this.ctx.acceptWebSocket(pair[1]);   // 잠들어도 연결 유지 (hibernation)
		if (this.alarmAt === undefined) this.alarmAt = await this.ctx.storage.getAlarm();
		if (!this.alarmAt) { this.alarmAt = Date.now() + ROOM_TTL; await this.ctx.storage.setAlarm(this.alarmAt); }
		return new Response(null, { status: 101, webSocket: pair[0] });
	}
	async alarm() {
		this.alarmAt = null;   // 방금 울림
		const s = await this.load();
		const now = Date.now();
		let dirty = false;
		if (!s.code || now >= s.created + ROOM_TTL) { s.closed = true; await this.notifyLobby(); for (const ws of this.ctx.getWebSockets()) try { ws.close(1000, '방이 닫혔어요'); } catch {} await this.ctx.storage.deleteAll(); this.st = null; return; }
		// 대전 시간 끝: 양쪽 앱이 같은 판정(남은 포켓몬 수 → 남은 HP 비율 → HP 합)으로 끝냄
		if (s.seed && !s.ended && s.startedAt && now >= s.startedAt + GAME) { this.relay('p1', 'tod'); dirty = true; }
		if (this.markStale(now)) dirty = true;
		for (const sd of ['p1', 'p2'] as Side[]) {
			const t = s.away?.[sd];
			if (!t || t > now) continue;
			delete s.away![sd]; dirty = true;
			if (this.alive(sd, now).length) continue;   // 그새 돌아옴
			if (s.seed && !s.ended) this.relay(sd, 'forfeit disconnect');
			else if (s.lobby && !s.closed) this.dropPlayer(sd, `${s.players[sd]?.name || '상대'}의 연결이 끊어졌어요`);   // 로비 방: 손님 자리 비움 · 방장이면 방 닫음
			else if (!s.ended) { s.ended = true; for (const w of this.ctx.getWebSockets()) this.send(w, { t: 'error', msg: `${s.players[sd]?.name || '상대'}의 연결이 끊어져 대전이 취소됐어요` }); }
		}
		if (dirty) { await this.save(); await this.notifyLobby(); }
		await this.schedule();
	}

	async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
		const s = await this.load();
		let m: any;
		try { m = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); } catch { return; }
		const err = (msg: string) => this.send(ws, { t: 'error', msg });
		const att = ws.deserializeAttachment() as any;
		if (att?.side) ws.serializeAttachment({ ...att, at: Date.now() });

		if (m.t === 'peek') return this.send(ws, this.roomInfo(null));
		if (m.t === 'join') {
			const token = String(m.token || '').slice(0, 64), version = String(m.version || '');
			if (!token) return err('token 이 필요해요');
			if (s.closed) return err('닫힌 방이에요');
			let side: Side | null = s.players.p1?.token === token ? 'p1' : s.players.p2?.token === token ? 'p2' : null;
			const fresh = !side;
			if (!side) {
				if (s.players.p1 && s.players.p2) return err('방이 꽉 찼어요');
				if (s.players.p1 && s.players.p1.version !== version) return err(`앱 버전이 달라서 함께 대전할 수 없어요 (방장 v${s.players.p1.version} · 나 v${version}). 둘 다 최신 버전으로 맞춰 주세요.`);
				if (s.players.p1 && s.pw && (await sha(String(m.pw || ''))) !== s.pw) return err('비밀번호가 맞지 않아요');
				if (!s.players.p1 && s.ended) return err('이미 끝난 방이에요');
				const team = Array.isArray(m.team) ? m.team.slice(0, 6) : [];
				const lobbyJoin = !!m.create || (!!s.lobby && !!s.players.p1);
				if (!team.length && !lobbyJoin) return err('팀이 비어 있어요');
				side = s.players.p1 ? 'p2' : 'p1';
				let name = String(m.name || '트레이너').slice(0, 16);
				if (side === 'p2' && name === s.players.p1!.name) name += ' (2)';   // 승자 판정이 이름으로 되므로 겹치지 않게
				if (side === 'p1') {
					if (m.ruleId) s.ruleId = String(m.ruleId).slice(0, 80); s.doubles = !!m.doubles; s.pick = [3, 4, 6].includes(m.pick) ? m.pick : 6;
					if (m.create) {   // 로비식 방 만들기
						const c = m.create;
						s.lobby = true; s.title = String(c.title || '').slice(0, 24); s.pw = c.pw ? await sha(String(c.pw).slice(0, 16)) : undefined;
						if (c.ruleId) s.ruleId = String(c.ruleId).slice(0, 80); s.doubles = !!c.doubles; s.pick = [3, 4, 6].includes(c.pick) ? c.pick : 6;
						s.chat = [];
					}
				}
				s.players[side] = { name, token, team, version, sprite: String(m.sprite || '').slice(0, 40) };
				if (s.lobby) this.pushChat({ side: '', name: '', text: `${name} 님이 ${side === 'p1' ? '방을 만들었어요' : '들어왔어요'}`, at: Date.now() });
				await this.save();
			}
			ws.serializeAttachment({ side, at: Date.now() });
			if (s.away?.[side]) { delete s.away[side]; await this.save(); await this.schedule(); }
			if (s.ended && !s.seed && !s.lobby) return err('이미 끝난 방이에요');
			this.broadcastRoom();
			if (s.lobby) {
				this.send(ws, { t: 'chatlog', list: s.chat || [] });
				const last = (s.chat || [])[(s.chat || []).length - 1];   // 들어왔다는 알림은 다른 사람에게도
				if (fresh && last) for (const w of this.ctx.getWebSockets()) if (w !== ws) this.send(w, { t: 'chat', ...last });
			}
			if (s.seed) {   // 재접속: 시작 정보와 지금까지의 선택
				this.send(ws, this.startMsg(side));
				this.send(ws, { t: 'inputs', list: s.inputs, clock: this.clock() });
			} else if (s.players.p1 && s.players.p2 && (!s.lobby || (s.players.p1.ready && s.players.p2.ready))) {   // 둘 다 들어옴(로비 방은 둘 다 준비): 서로 전체 엔트리 → 고르기
				for (const sd of ['p1', 'p2'] as Side[]) for (const w of this.sockets(sd)) if (w === ws || sd !== side) this.send(w, this.previewMsg(sd));
			}
			return;
		}
		const side = this.sideOf(ws);
		if (!side) return err('먼저 입장해 주세요');
		if (m.t === 'pick') {
			const p = s.players[side]!, need = Math.min(s.pick || 6, p.team.length);
			const idx = Array.isArray(m.idx) ? m.idx.map(Number) : [];
			if (s.seed || p.picked || s.ended) return;
			if (idx.length !== need || new Set(idx).size !== need || idx.some((i: number) => !Number.isInteger(i) || i < 0 || i >= p.team.length)) return err('참가 포켓몬을 다시 골라 주세요');
			p.picked = idx;
			await this.save();
			if (!(await this.maybeStart())) this.broadcastRoom();
			return;
		}
		if (m.t === 'chat') {
			if (!s.lobby) return;
			const text = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
			if (!text) return;
			const msg = { side, name: s.players[side]!.name, text, at: Date.now() };
			this.pushChat(msg); await this.save();
			for (const w of this.ctx.getWebSockets()) this.send(w, { t: 'chat', ...msg });
			return;
		}
		const resetBattle = () => {   // 배틀이 끝난 로비 방을 대기실 상태로
			s.seed = undefined; s.inputs = []; s.ended = false; s.startedAt = undefined; s.spent = undefined; s.away = {};
			for (const sd of ['p1', 'p2'] as Side[]) if (s.players[sd]) { s.players[sd]!.ready = false; s.players[sd]!.picked = undefined; }
		};
		// 배틀 결과 화면에서 바로 나감: 아무도 'again' 을 안 눌렀어도 대기실로 돌린 뒤 나가기 처리 (안 그러면 1분 동안 자리가 안 빔)
		if (m.t === 'leave' && s.lobby && s.seed && s.ended && !s.closed) resetBattle();
		if (s.lobby && !s.seed) {   // 로비 방 대기 중: 파티·규칙·준비·나가기
			const p = s.players[side]!;
			const picking = !!(s.players.p1?.ready && s.players.p2?.ready);   // 둘 다 준비 → 고르는 중에는 파티·규칙을 바꾸지 않음
			if ((m.t === 'team' || m.t === 'rules') && picking) return err('참가 포켓몬을 고르는 중이에요');
			if (m.t === 'team') {
				const team = Array.isArray(m.team) ? m.team.slice(0, 6) : [];
				if (!team.length) return err('팀이 비어 있어요');
				p.team = team; p.ready = false; p.picked = undefined;
				await this.save(); this.broadcastRoom(); return;
			}
			if (m.t === 'rules') {
				if (side !== 'p1') return err('방장만 규칙을 바꿀 수 있어요');
				if (m.ruleId) s.ruleId = String(m.ruleId).slice(0, 80);
				s.doubles = !!m.doubles; s.pick = [3, 4, 6].includes(m.pick) ? m.pick : 6;
				for (const sd of ['p1', 'p2'] as Side[]) if (s.players[sd]) { s.players[sd]!.ready = false; s.players[sd]!.picked = undefined; }
				this.pushChat({ side: '', name: '', text: '방장이 규칙을 바꿨어요', at: Date.now() });
				await this.save(); this.broadcastRoom(); this.sendChatTail(); return;
			}
			if (m.t === 'ready') {
				if (m.on && !p.team?.length) return err('먼저 파티를 골라 주세요');
				p.ready = !!m.on;
				await this.save(); this.broadcastRoom();
				if (s.players.p1?.ready && s.players.p2?.ready) this.sendPreviews();
				return;
			}
			if (m.t === 'leave') {
				if (side === 'p1') {   // 방장이 나가면 방을 닫음
					s.closed = true; s.ended = true; await this.save();
					for (const w of this.ctx.getWebSockets()) if (w !== ws) this.send(w, { t: 'error', msg: '방장이 나가서 방이 닫혔어요' });
					await this.notifyLobby();
				} else this.dropPlayer('p2', `${p.name} 님이 나갔어요`);
				await this.save();
				return;
			}
		}
		if (m.t === 'again') {   // 배틀이 끝난 로비 방: 다시 대기실로
			if (!s.lobby || s.closed) return;
			// 이미 대기실로 돌아가 있으면(상대가 먼저 돌아갔거나 나감) 지금 방 상태만 다시 보냄 — 결과 화면에 있는 동안 온 방 정보를 앱이 놓쳤을 수 있음
			if (!s.ended) { if (!s.seed) this.send(ws, this.roomInfo(side)); return; }
			resetBattle();
			await this.save(); await this.schedule(); this.broadcastRoom();
			return;
		}
		if (m.t === 'leave') {   // 배틀 전에 나감
			if (s.seed || s.ended) return;
			s.ended = true; await this.save();
			for (const w of this.ctx.getWebSockets()) if (w !== ws) this.send(w, { t: 'error', msg: `${s.players[side]?.name || '상대'} 님이 나가서 대전이 취소됐어요` });
			return;
		}
		if (m.t === 'choose') {
			if (!s.seed) return err('아직 상대가 없어요');
			if (s.ended) return err('끝난 배틀이에요');
			const choice = String(m.choice || '').slice(0, 200);
			if (!choice) return;
			if (choice === 'tod' || choice === 'forfeit disconnect') return;   // 서버만 넣음
			// 고르는 데 쓴 시간(앱이 잰 값, 연출 시간 제외)을 내 시간에서 뺌
			const sp = s.spent || (s.spent = { p1: 0, p2: 0 });
			sp[side] += Math.max(0, Math.min(TURN + 5000, Number(m.ms) || 0));
			this.relay(side, choice.startsWith('forfeit') ? (choice === 'forfeit timeout' ? choice : 'forfeit') : choice);
			if (!s.ended && sp[side] >= OWN) this.relay(side, 'forfeit timeout');   // 내 시간 0
			await this.save();
			return;
		}
		if (m.t === 'ended') { s.ended = true; await this.save(); void this.notifyLobby(); return; }
		if (m.t === 'ping') this.send(ws, { t: 'pong' });
		// 배틀 중인 앱이 20초마다: 상대가 잠들었는지(소식 없음) 확인
		if (m.t === 'check') { if (this.markStale(Date.now())) { await this.save(); await this.schedule(); } return; }
	}
	async webSocketClose(ws: WebSocket) { try { ws.close(); } catch {} await this.gone(ws); }
	async webSocketError(ws: WebSocket) { await this.gone(ws); }
	/** 한쪽 연결이 모두 끊기면 GRACE 동안 기다림 (돌아오지 않으면 alarm 에서 기권 처리) */
	private async gone(ws: WebSocket) {
		const s = await this.load(), side = this.sideOf(ws);
		const watch = s.lobby ? !s.closed && !!s.players[side!] : !s.ended && !!s.players.p1 && !!s.players.p2;   // 로비 방은 대기실·배틀 뒤에도 (방장이 떠나면 방을 닫으려고)
		if (side && watch && !s.away?.[side] && !this.sockets(side).some(w => w !== ws && w.readyState === 1)) {
			s.away = { ...(s.away || {}), [side]: Date.now() + GRACE };
			await this.save(); await this.schedule();
		}
		this.broadcastRoom();
	}
}

/** 랜덤 대전 매칭 + 로비 방 목록 */
export class Lobby extends DurableObject<Env> {
	private rooms: Map<string, RoomCard> | null = null;
	private async loadRooms() {
		if (!this.rooms) this.rooms = new Map(Object.entries((await this.ctx.storage.get<{ [code: string]: RoomCard }>('rooms')) || {}));
		const now = Date.now();
		for (const [k, v] of this.rooms) if (now - v.at > ROOM_TTL) this.rooms.delete(k);
		return this.rooms;
	}
	private listMsg() { return JSON.stringify({ t: 'rooms', list: [...this.rooms!.values()].sort((a, b) => b.at - a.at).slice(0, 100) }); }
	async fetch(req: Request): Promise<Response> {
		const url = new URL(req.url);
		if (url.pathname === '/update' && req.method === 'POST') {   // 방이 알려 옴
			const { code, card } = await req.json() as { code: string; card: RoomCard | null };
			const rooms = await this.loadRooms();
			if (card) rooms.set(code, card); else rooms.delete(code);
			await this.ctx.storage.put('rooms', Object.fromEntries(rooms));
			const msg = this.listMsg();
			for (const w of this.ctx.getWebSockets()) if ((w.deserializeAttachment() as any)?.watch) try { w.send(msg); } catch {}
			return new Response('ok');
		}
		const pair = new WebSocketPair();
		this.ctx.acceptWebSocket(pair[1]);
		return new Response(null, { status: 101, webSocket: pair[0] });
	}
	async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
		let m: any;
		try { m = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); } catch { return; }
		if (m.t === 'list') { await this.loadRooms(); ws.serializeAttachment({ watch: true }); ws.send(this.listMsg()); return; }
		if (m.t === 'ping') { try { ws.send('{"t":"pong"}'); } catch {} return; }
		if (m.t !== 'queue') return;
		const me = { doubles: !!m.doubles, pick: [3, 4, 6].includes(m.pick) ? m.pick : 6, version: String(m.version || ''), token: String(m.token || ''), at: Date.now() };
		const other = this.ctx.getWebSockets().find(w => {
			if (w === ws) return false;
			const a = w.deserializeAttachment() as any;
			return a && !a.watch && a.doubles === me.doubles && (a.pick || 6) === me.pick && a.version === me.version && a.token !== me.token;
		});
		if (!other) { ws.serializeAttachment(me); ws.send(JSON.stringify({ t: 'waiting' })); return; }
		const code = newCode();
		other.serializeAttachment(null);
		for (const w of [other, ws]) { try { w.send(JSON.stringify({ t: 'matched', code })); w.close(1000, 'matched'); } catch {} }
	}
	async webSocketClose(ws: WebSocket) { try { ws.close(); } catch {} }
}
