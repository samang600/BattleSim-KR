/** 온라인 대전 화면: 친구 대전(방 만들기·코드로 들어가기) · 랜덤 대전(무작위 상대·무작위 팀). 연결·진행은 online.ts */
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { ask, Screen, toast } from './ui/core';
import { ChoiceScreen, InfoScreen } from './ui/screens';
import { battle, chooseTeam, playerName, playerSprite, withLevel, BACK } from './modes';
import { OnlineRoom, RemoteSession, matchmake, newRoomCode, normCode, APP_VERSION, type StartInfo, type RoomInfo } from './online';
import { randomTeam, type PSet } from './sets';
import { loadSettings } from './store';
import { ruleById } from './rules';

/** 랜덤 대전은 모두 같은 규칙 (전국도감 · 기믹 한 종류 1회) */
const RANDOM_RULE = 'mzdt_one.natdex.no.no';
const LEVEL = 50;

type Fmt = 'singles' | 'doubles';
const fmtKo = (d: boolean) => d ? '더블배틀' : '싱글배틀';
const ruleName = (id: string) => { try { return ruleById(id).name; } catch { return id; } };

async function chooseFmt(title: string): Promise<Fmt | typeof BACK> {
	return ask<Fmt | typeof BACK>(r => <ChoiceScreen title={title} onBack={() => r(BACK)} options={[
		{ value: 'singles' as Fmt, label: '싱글배틀', desc: '1대1 · 팀 전원 참가', icon: '①' },
		{ value: 'doubles' as Fmt, label: '더블배틀', desc: '2마리씩 · 팀 전원 참가', icon: '②' },
	]} onPick={r} />);
}

/** 방 코드 입력 */
function CodeEntry({ onDone, onBack }: { onDone: (code: string) => void; onBack: () => void }) {
	const [v, setV] = useState('');
	const ok = normCode(v).length === 6;
	return <Screen title="방 코드로 들어가기" onBack={onBack}>
		<p class="hint">친구가 알려 준 6자리 방 코드를 넣어 주세요.</p>
		<input class="code-input" value={v} maxLength={8} inputMode="text" autoCapitalize="characters" placeholder="ABC234"
			onInput={(e: any) => setV(normCode(e.currentTarget.value))} onKeyDown={(e: any) => { if (e.key === 'Enter' && ok) onDone(normCode(v)); }} />
		<button class="btn big" disabled={!ok} onClick={() => onDone(normCode(v))}>들어가기</button>
	</Screen>;
}

/** 시작을 기다림: 방 연결의 이벤트가 화면을 끝냄 */
type WaitResult = { start: StartInfo } | { error: string } | { cancel: true };
function waitStart(room: OnlineRoom, render: (cancel: () => void, info: RoomInfo | null) => any): Promise<WaitResult> {
	return new Promise(resolve => {
		let done = false, last: RoomInfo | null = null;
		let setInfo: ((i: RoomInfo | null) => void) | null = null;
		const finish = (r: WaitResult) => { if (done) return; done = true; room.handlers.room = undefined; resolve(r); };
		room.handlers.room = info => { last = info; setInfo?.(info); };
		room.handlers.start = s => finish({ start: s });
		room.handlers.error = msg => finish({ error: msg });
		const Wrap = () => { const [info, si] = useState<RoomInfo | null>(last); setInfo = si; return render(() => finish({ cancel: true }), info); };
		ask<void>(() => <Wrap />).catch(() => finish({ cancel: true }));   // 화면만 띄움 (끝은 연결 이벤트가 정함)
	});
}

/** 시작 정보를 받으면 배틀 진행 */
async function play(room: OnlineRoom, start: StartInfo, label: string) {
	const rs = new RemoteSession(start, room);
	const me = start[start.side], opp = start[start.side === 'p1' ? 'p2' : 'p1'];
	// 재접속이면 지난 선택들이 이어서 옴 (RemoteSession 이 받아서 엔진에 넣음)
	const res = await battle({
		gen: 9, doubles: start.doubles, aiSkill: 0, bg: 'pwt', music: 'pwt', label, noRecord: true, ruleId: start.ruleId, online: rs,
		p1: { name: me.name, team: me.team, sprite: playerSprite() },
		p2: { name: opp.name, title: '', team: opp.team, sprite: (opp as any).sprite || 'acetrainer' },
	});
	room.close();
	await ask<void>(r => <InfoScreen title={label} heading={res.win ? '승리!' : '패배…'} lines={[`${opp.name}${res.win ? '에게 이겼다!' : '에게 졌다…'} (${res.turns}턴)`]}
		actions={[{ label: '확인', onClick: () => r() }]} />);
}

export async function runOnline() {
	while (true) {
		const pick = await ask<'host' | 'join' | 'random' | typeof BACK>(r => <ChoiceScreen title="온라인 대전 (테스트)" onBack={() => r(BACK)}
			intro={<p class="hint">같은 앱 버전(v{APP_VERSION})끼리 대전해요. 기록에는 남지 않아요. 배틀 도중 끊겨도 다시 들어오면 이어서 할 수 있어요.</p>}
			options={[
				{ value: 'host' as const, label: '친구 대전 · 방 만들기', desc: '방 코드를 만들어 친구에게 알려 줌 · 지금 설정의 배틀 규칙', icon: '🏠' },
				{ value: 'join' as const, label: '친구 대전 · 코드로 들어가기', desc: '친구가 알려 준 방 코드로 입장', icon: '🔑' },
				{ value: 'random' as const, label: '랜덤 대전', desc: '같은 시간에 기다리는 누군가와 · 양쪽 모두 무작위 팀', icon: '🎲' },
			]} onPick={r} />);
		if (pick === BACK) return;
		try {
			if (pick === 'host') await host();
			else if (pick === 'join') await join();
			else await random();
		} catch (e: any) {
			if (e?.name === 'QuitToMenu' || e?.constructor?.name === 'QuitToMenu') throw e;
			toast('온라인 대전 오류: ' + (e?.message || e));
		}
	}
}

async function host() {
	const fmt = await chooseFmt('방 만들기');
	if (fmt === BACK) return;
	const team = await chooseTeam(9, '내 팀', true, false, LEVEL);
	if (team === BACK) return;
	const ruleId = loadSettings().battleRule;
	const code = newRoomCode();
	const room = new OnlineRoom(code);
	room.connect({ name: playerName(), team: withLevel(team, LEVEL), ruleId, doubles: fmt === 'doubles', sprite: playerSprite() } as any);
	const w = await waitStart(room, (cancel, info) => <Screen title="친구 대전 · 방 만들기" onBack={cancel}>
		<div class="online-wait">
			<p class="hint">친구에게 이 방 코드를 알려 주세요. 친구가 들어오면 바로 시작해요.</p>
			<div class="room-code">{code}</div>
			<button class="btn" onClick={() => navigator.clipboard?.writeText(code).then(() => toast('방 코드를 복사했어요'), () => toast('복사하지 못했어요'))}>코드 복사</button>
			<p class="muted">{fmtKo(fmt === 'doubles')} · {ruleName(ruleId)}</p>
			<p class="muted">{info ? '친구를 기다리는 중…' : '서버에 연결하는 중…'}</p>
			<button class="btn ghost" onClick={cancel}>방 닫기</button>
		</div>
	</Screen>);
	if ('cancel' in w) { room.close(); return; }
	if ('error' in w) { room.close(); toast(w.error); return; }
	await play(room, w.start, '친구 대전');
}

async function join() {
	const code = await ask<string | typeof BACK>(r => <CodeEntry onDone={r} onBack={() => r(BACK)} />);
	if (code === BACK) return;
	// 방 정보 먼저 (형식·규칙·방장)
	const peek = new OnlineRoom(code);
	const info = await new Promise<RoomInfo | string>(res => {
		peek.handlers.room = res; peek.handlers.error = res;
		peek.connect({ name: playerName(), peek: true });
		setTimeout(() => res('서버에서 답이 없어요'), 10000);
	});
	if (typeof info === 'string') { peek.close(); toast(info); return; }
	if (!info.players.p1) { peek.close(); toast('그런 방이 없어요. 코드를 다시 확인해 주세요'); return; }
	if (info.players.p2 && info.status !== 'waiting') { peek.close(); toast('이미 대전 중인 방이에요'); return; }
	if (info.version && info.version !== APP_VERSION) { peek.close(); toast(`앱 버전이 달라요 (방장 v${info.version} · 나 v${APP_VERSION})`); return; }
	const ok = await ask<boolean>(r => <InfoScreen title="친구 대전 · 들어가기" heading={`${info.players.p1}의 방`}
		lines={[`형식: ${fmtKo(info.doubles)}`, `규칙: ${ruleName(info.ruleId)}`, '이 규칙에 맞는 팀으로 들어가 주세요.']}
		actions={[{ label: '팀 고르기', onClick: () => r(true) }, { label: '취소', kind: 'ghost', onClick: () => r(false) }]} />);
	if (!ok) { peek.close(); return; }
	const team = await chooseTeam(9, '내 팀', true, false, LEVEL);
	if (team === BACK) { peek.close(); return; }
	const room = new OnlineRoom(code);
	peek.close();
	room.connect({ name: playerName(), team: withLevel(team, LEVEL), sprite: playerSprite() } as any);
	const w = await waitStart(room, (cancel) => <Screen title="친구 대전" onBack={cancel}>
		<div class="online-wait"><p class="hint">들어가는 중…</p><button class="btn ghost" onClick={cancel}>취소</button></div>
	</Screen>);
	if ('cancel' in w) { room.close(); return; }
	if ('error' in w) { room.close(); toast(w.error); return; }
	await play(room, w.start, '친구 대전');
}

async function random() {
	const fmt = await chooseFmt('랜덤 대전');
	if (fmt === BACK) return;
	const doubles = fmt === 'doubles';
	const team: PSet[] = withLevel(randomTeam({ gen: 9, size: 6, minBst: 470, maxBst: 600, doubles, quality: 0.7 }), LEVEL);
	// 매칭
	let stop: () => void = () => {};
	const code = await new Promise<string | null>(res => {
		stop = matchmake(doubles, c => res(c), msg => { toast(msg); res(null); });
		void ask<void>(r => <Screen title="랜덤 대전" onBack={() => { stop(); res(null); r(); }}>
			<div class="online-wait">
				<p class="hint">상대를 찾는 중… ({fmtKo(doubles)} · 무작위 팀)</p>
				<div class="room-code searching">···</div>
				<p class="muted">같은 앱 버전(v{APP_VERSION})으로 같은 형식을 고른 사람과 연결돼요.</p>
				<button class="btn ghost" onClick={() => { stop(); res(null); r(); }}>그만 찾기</button>
			</div>
		</Screen>).catch(() => res(null));
	});
	if (!code) return;
	const room = new OnlineRoom(code);
	room.connect({ name: playerName(), team, ruleId: RANDOM_RULE, doubles, sprite: playerSprite() } as any);
	const w = await waitStart(room, (cancel) => <Screen title="랜덤 대전" onBack={cancel}>
		<div class="online-wait"><p class="hint">상대를 찾았어요! 배틀을 준비하는 중…</p><button class="btn ghost" onClick={cancel}>취소</button></div>
	</Screen>);
	if ('cancel' in w) { room.close(); return; }
	if ('error' in w) { room.close(); toast(w.error); return; }
	await play(room, w.start, '랜덤 대전');
}
