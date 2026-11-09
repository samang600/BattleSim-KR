// 서버 과금 시뮬레이터: node test/sim-harness.mjs src/index.ts <normal|sleep|tod|blip> check  (요청·쓴 줄을 Cloudflare 무료 한도 단위로 셈)
// 서버(Room·Lobby)를 가상 시계로 돌려 Cloudflare 과금 단위(요청·쓴 줄)를 셈
import { build } from 'esbuild';
import path from 'path';
const SRC = process.argv[2];   // server/src/index.ts
const SCEN = process.argv[3] || 'normal';
const CLIENT_CHECK = process.argv[4] === 'check';   // 새 클라이언트(20초마다 check)
await build({ entryPoints: [SRC], bundle: true, format: 'esm', platform: 'neutral', outfile: './out-server.mjs', alias: { 'cloudflare:workers': path.resolve('./cfmock.js') }, logLevel: 'error' });

let NOW = 1_700_000_000_000;
Date.now = () => NOW;
const C = { req: 0, msgIn: 0, rowsW: 0, alarms: 0, setAlarm: 0, puts: 0 };
class MockWS {
	constructor() { this.readyState = 1; this.att = null; this.peer = null; this.inbox = []; this.autoTs = null; }
	serializeAttachment(a) { this.att = JSON.parse(JSON.stringify(a)); }
	deserializeAttachment() { return this.att; }
	send(m) { if (this.readyState === 1 && this.peer) this.peer.inbox.push(JSON.parse(m)); }
	close() { if (this.readyState >= 2) return; this.readyState = 3; if (this.peer) { this.peer.readyState = 3; } }
}
globalThis.WebSocketPair = class { constructor() { const a = new MockWS(), b = new MockWS(); a.peer = b; b.peer = a; return [a, b]; } };
globalThis.WebSocketRequestResponsePair = class { constructor(req, res) { this.req = req; this.res = res; } };
const RealResponse = globalThis.Response;
globalThis.Response = class { constructor(body, init) { this.status = init?.status; this.webSocket = init?.webSocket; } };
const { Room } = await import('./out-server.mjs?' + Date.now());

function makeCtx() {
	const store = new Map(); let alarm = null; const sockets = []; let auto = null;
	return {
		storage: {
			async get(k) { return store.has(k) ? JSON.parse(JSON.stringify(store.get(k))) : undefined; },
			async put(k, v) { store.set(k, JSON.parse(JSON.stringify(v))); C.rowsW++; C.puts++; },
			async getAlarm() { return alarm; },
			async setAlarm(t) { alarm = t; C.rowsW++; C.setAlarm++; },
			async deleteAll() { C.rowsW += store.size; store.clear(); alarm = null; },
		},
		acceptWebSocket(ws) { sockets.push(ws); },
		getWebSockets() { return sockets.filter(w => w.readyState < 2); },
		setWebSocketAutoResponse(p) { auto = p; },
		getWebSocketAutoResponseTimestamp(ws) { return ws.autoTs ? new Date(ws.autoTs) : null; },
		_alarm: () => alarm, _clear: () => { alarm = null; }, _auto: () => auto,
	};
}
const ctx = makeCtx();
const room = new Room(ctx, {});
const log = [];
// 클라이언트
async function connect(name) {
	C.req++;   // Worker 거쳐 DO fetch (WS 연결 1회)
	const res = await room.fetch({ url: 'https://x/ws?room=ABCDEF', headers: { get: () => 'websocket' } });
	const cws = res.webSocket;
	return { name, ws: cws, srv: cws.peer, asleep: false, side: null, preview: null, inputs: [], ended: false };
}
async function sendMsg(cl, m) {
	if (cl.asleep || cl.ws.readyState !== 1) return;
	const raw = JSON.stringify(m);
	const auto = ctx._auto();
	if (auto && raw === auto.req) { cl.srv.autoTs = NOW; cl.ws.inbox.push(JSON.parse(auto.res)); C.msgIn++; return; }   // 자동 응답 (깨우지 않음, 보수적으로 메시지 1건으로 셈)
	C.msgIn++;
	await room.webSocketMessage(cl.srv, raw);
}
function drain(cl) {
	const out = cl.ws.inbox.splice(0);
	for (const m of out) {
		if (m.t === 'preview') cl.preview = m;
		if (m.t === 'start') cl.started = true;
		if (m.t === 'inputs') cl.inputs = m.list.slice();
		if (m.t === 'input') { cl.inputs.push([m.side, m.choice]); if (/^forfeit|^tod/.test(m.choice)) { cl.ended = true; log.push(`${(NOW - T0) / 1000}s ${cl.name} 받음: ${m.side} ${m.choice}`); } }
		if (m.t === 'room' && m.away && Object.keys(m.away).length) cl.sawAway = true;
	}
}
const T0 = NOW;
async function tick(ms, clients) {
	// ms 동안 1초씩: 알람 처리, 핑(10초), check(20초)
	for (let t = 0; t < ms; t += 1000) {
		NOW += 1000;
		const a = ctx._alarm();
		if (a && a <= NOW) { ctx._clear(); C.alarms++; C.req++; if (process.env.DBG) console.log('alarm', (NOW - T0) / 1000, 'set for', (a - T0) / 1000); await room.alarm(); }
		for (const cl of clients) {
			if (cl.asleep || cl.ws.readyState !== 1 || cl.ended) continue;
			if ((NOW - T0) / 1000 % 10 === 0) await sendMsg(cl, { t: 'ping' });
			if (CLIENT_CHECK && (NOW - T0) / 1000 % 20 === 0 && cl.started) await sendMsg(cl, { t: 'check' });
			drain(cl);
		}
	}
}
const A = await connect('A'), B = await connect('B');
await sendMsg(A, { t: 'join', name: 'A', token: 'ta', version: '1', team: [1, 2, 3, 4, 5, 6], pick: 3 });
await tick(5000, [A, B]);
await sendMsg(B, { t: 'join', name: 'B', token: 'tb', version: '1', team: [1, 2, 3, 4, 5, 6] });
drain(A); drain(B);
await tick(30000, [A, B]);
await sendMsg(A, { t: 'pick', idx: [0, 1, 2] }); await tick(10000, [A, B]); await sendMsg(B, { t: 'pick', idx: [3, 4, 5] });
drain(A); drain(B);
if (!A.started || !B.started) { console.log('시작 안 됨'); process.exit(1); }
const TURNS = SCEN === 'tod' ? 80 : 15;
for (let turn = 0; turn < TURNS && !A.ended; turn++) {
	if (SCEN === 'blip' && turn === 5) {
		log.push(`${(NOW - T0) / 1000}s B 연결 끊김 (진짜로 닫힘)`);
		B.srv.readyState = 3; B.ws.readyState = 3; await room.webSocketClose(B.srv);
		drain(A);
		await tick(20000, [A]);
		const nb = await connect('B'); nb.started = true; nb.inputs = B.inputs;
		await sendMsg(nb, { t: 'join', name: 'B', token: 'tb', version: '1', team: [] });
		drain(nb); Object.assign(B, { ws: nb.ws, srv: nb.srv });
		log.push(`${(NOW - T0) / 1000}s B 다시 들어옴 · 재접속 때 받은 선택 ${nb.inputs.length}개`);
	}
	if (SCEN === 'sleep' && turn === 5) { B.asleep = true; log.push(`${(NOW - T0) / 1000}s B 잠듦 (소켓은 열린 채)`); }
	await tick(8000, [A, B]);                 // 연출
	await tick(12000, [A, B]);                // 고르는 시간
	await sendMsg(A, { t: 'choose', choice: 'move 1', ms: SCEN === 'tod' ? 4000 : 12000 });
	await sendMsg(B, { t: 'choose', choice: 'move 1', ms: SCEN === 'tod' ? 4000 : 12000 });
	drain(A); drain(B);
	if (SCEN === 'sleep' && B.asleep) { await tick(150000, [A, B]); break; }
}
if ((SCEN === 'normal' || SCEN === 'blip') && !A.ended) { await sendMsg(B, { t: 'choose', choice: 'forfeit', ms: 1000 }); drain(A); }
await tick(5000, [A, B]);
// 끝난 뒤 남은 알람 (방 TTL 등)은 하루 안에 한 번 더
const req = C.req + C.msgIn / 20;
console.log(JSON.stringify({ scen: SCEN, client: CLIENT_CHECK ? 'check' : 'old', 분: Math.round((NOW - T0) / 60000), 요청: +req.toFixed(1), 알람: C.alarms, 쓴줄: C.rowsW, 'put': C.puts, setAlarm: C.setAlarm, 메시지: C.msgIn, A끝: A.ended, A가상대끊김봄: !!A.sawAway }));
for (const l of log) console.log('  ', l);
