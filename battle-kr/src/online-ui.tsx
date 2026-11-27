/** 온라인 대전 화면: 로비(방 목록·방 만들기·공개/비밀번호 방·방 안 채팅·규칙/파티 바꾸기) · 코드로 들어가기 · 랜덤 대전. 연결·진행은 online.ts */
import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { ask, Screen, toast, Modal, PokeIcon, abortMode, confirmBox } from './ui/core';
import { BattleView, type BattleSetup, type BattleResult } from './ui/battle';
import { speciesKo, itemKo } from './data';
import { sfx } from './sound';
import { titleItem, itemById, ITEMS, loadWallet } from './rewards';
import { TitleChip, cardSkin, cardSkinClass } from './ui/shop';
import { SPRITE_URL, trainerImgError } from './trainer-lines';
/** 온라인으로 보내는 모습 칸: '모습|칭호id' (서버는 40자까지 그대로 전달) */
const skinItems = (slot: 'cardBg' | 'frame') => ITEMS.filter(i => i.slot === slot);
const spriteWithTitle = () => {
	const t = titleItem()?.id, w = loadWallet();
	const base = (playerSprite() + (t ? '|' + t.slice(2) : '')).slice(0, 40);
	// 카드 배경·테두리: 상품 목록 안 순서(36진수)로 짧게 — '모습|칭호|배경.테두리' (앱 버전이 같아야 방에 들어오므로 순서가 같음)
	const ix = (slot: 'cardBg' | 'frame') => { const k = skinItems(slot).findIndex(i => i.id === w.eq[slot]); return k < 0 ? '' : (k + 1).toString(36); };
	const skin = ix('cardBg') + '.' + ix('frame');
	const full = base + (t ? '' : '|') + '|' + skin;
	return skin === '.' || full.length > 40 ? base : full;
};
/** 받은 모습 칸 → 상대가 장착한 트레이너 카드 배경·테두리 (CSS 변수와 클래스) */
export const splitSkin = (v?: string): { cls: string; style: any } => {
	const [b, f] = (String(v || '').split('|')[2] || '').split('.');
	const eq: any = { cardBg: skinItems('cardBg')[parseInt(b, 36) - 1]?.id, frame: skinItems('frame')[parseInt(f, 36) - 1]?.id };
	const w = { eq } as any;
	return { cls: cardSkinClass(w), style: cardSkin(w) };
};
/** 받은 모습 칸 → [모습, 칭호 이름] */
export const splitSprite = (v?: string): [string, string] => { const [sp, t] = String(v || '').split('|'); return [sp || 'acetrainer', t ? 't:' + t : '']; };
import { ChoiceScreen, InfoScreen } from './ui/screens';
import { chooseTeam, playerName, playerSprite, withLevel, BACK, BgmRow, towerOpponent } from './modes';
import { TeamSession, type CoopFoe } from './online-coop';
import { OnlineRoom, RemoteSession, matchmake, newRoomCode, normCode, watchLobby, APP_VERSION, setActiveRoom, getActiveRoom, roomRule, serverSeats4, type RoomMode, type ActiveRoom, type StartInfo, type RoomInfo, type PreviewInfo, type ChatMsg, type RoomCard } from './online';
import { josa } from './josa';
import { OnlinePick } from './ui/online-pick';
import { randomTeam, type PSet } from './sets';
import { loadSettings, loadRecords, updateRecords } from './store';
import { ruleById, ruleId as makeRuleId, POOLS, LEGEND_MODES, applyRuleData, teamRuleIssues, type LegendMode } from './rules';

/** 랜덤 대전은 모두 같은 규칙 (전국도감 · 기믹 한 종류 1회) */
const RANDOM_RULE = 'mzdt_one.natdex.no.no';
const LEVEL = 50;

/** 형식: 싱글 6→3 · 더블 6→4 (서로 전체 엔트리를 보고 고름) · 6vs6 (순서만 정함) */
type Fmt = { doubles: boolean; pick: number };
const fmtKo = (d: boolean, pick = 6) => (d ? '더블' : '싱글') + (pick < 6 ? ` 6→${pick}` : ' 6vs6');
/** 방의 형식 글: 협력 타워는 형식이 정해져 있음 (멀티배틀 · 각자 3마리) */
const roomFmt = (x: { mode?: RoomMode; doubles: boolean; pick?: number }) => x.mode === 'coop' ? '협력 타워 · 각자 3마리' : x.mode === 'multi' ? '2vs2 멀티배틀 · 각자 3마리' : fmtKo(x.doubles, x.pick || 6);
/** 방의 자리들: 보통 p1·p2, 2vs2 멀티배틀은 p1·p2(한 편) · p3·p4(한 편) */
type Seat = 'p1' | 'p2' | 'p3' | 'p4';
const seatsOf = (x: { seats?: number }): Seat[] => x.seats === 4 ? ['p1', 'p2', 'p3', 'p4'] : ['p1', 'p2'];
const mateOf = (sd: Seat): Seat => ({ p1: 'p2', p2: 'p1', p3: 'p4', p4: 'p3' } as const)[sd];
const COOP_FMT = { doubles: true, pick: 3 };
const labelOf = (mode?: RoomMode) => mode === 'coop' ? '협력 타워' : mode === 'multi' ? '2vs2 멀티배틀' : '친구 대전';
const ruleName = (id: string) => { try { return ruleById(id).name; } catch { return id; } };

async function chooseFmt(title: string): Promise<Fmt | typeof BACK> {
	return ask<Fmt | typeof BACK>(r => <ChoiceScreen title={title} onBack={() => r(BACK)} options={[
		{ value: { doubles: false, pick: 3 } as Fmt, label: '싱글 6→3', desc: '서로 6마리를 보고 3마리 선택 · 1대1', icon: '③' },
		{ value: { doubles: true, pick: 4 } as Fmt, label: '더블 6→4', desc: '서로 6마리를 보고 4마리 선택 · 2대2', icon: '④' },
		{ value: { doubles: false, pick: 6 } as Fmt, label: '싱글 6vs6', desc: '전원 참가 · 서로 엔트리를 보고 순서만 정함', icon: '⑥' },
		{ value: { doubles: true, pick: 6 } as Fmt, label: '더블 6vs6', desc: '전원 참가 · 서로 엔트리를 보고 순서만 정함', icon: '⑥' },
	]} onPick={r} />);
}

/** 방 코드 입력 */
function CodeEntry({ onDone, onBack }: { onDone: (code: string) => void; onBack: () => void }) {
	const [v, setV] = useState('');
	const ok = normCode(v).length === 6;
	return <Screen title="방 코드로 들어가기" onBack={onBack} cls="wide-scr">
		<p class="hint">친구가 알려 준 6자리 방 코드를 넣어 주세요.</p>
		<input class="code-input" value={v} maxLength={8} inputMode="text" autoCapitalize="characters" placeholder="ABC234"
			onInput={(e: any) => setV(normCode(e.currentTarget.value))} onKeyDown={(e: any) => { if (e.key === 'Enter' && ok) onDone(normCode(v)); }} />
		<button class="btn big" disabled={!ok} onClick={() => onDone(normCode(v))}>들어가기</button>
	</Screen>;
}

/** 시작을 기다림: 방 연결의 이벤트가 화면을 끝냄 */
type WaitResult = { start: StartInfo } | { preview: PreviewInfo } | { error: string } | { cancel: true } | { back: true };
function waitStart(room: OnlineRoom, render: (cancel: () => void, info: RoomInfo | null) => any): Promise<WaitResult> {
	return new Promise(resolve => {
		let done = false, last: RoomInfo | null = null;
		let setInfo: ((i: RoomInfo | null) => void) | null = null;
		const finish = (r: WaitResult) => { if (done) return; done = true; room.handlers.room = undefined; resolve(r); };
		room.handlers.room = info => { last = info; setInfo?.(info); };
		room.handlers.start = s => finish({ start: s });
		room.handlers.preview = pv => finish({ preview: pv });
		room.handlers.error = msg => finish({ error: msg });
		const Wrap = () => { const [info, si] = useState<RoomInfo | null>(last); setInfo = si; return render(() => finish({ cancel: true }), info); };
		ask<void>(() => <Wrap />).catch(() => finish({ cancel: true }));   // 화면만 띄움 (끝은 연결 이벤트가 정함)
	});
}

/** 들어간 뒤: 서로 전체 엔트리 → 참가 포켓몬 고르기(같은 화면에서 상대 기다림) → 배틀 */
async function proceed(room: OnlineRoom, w: WaitResult, label: string) {
	let sent = false;
	while (true) {
		if ('cancel' in w) { room.send({ t: 'leave' }); room.close(); return; }
		if ('error' in w) { room.close(); toast(w.error); return; }
		if ('start' in w) return play(room, w.start, label);
		if ('back' in w) return;
		sent = sent || w.preview.picked; lastPreview = w.preview;
		w = await pickPhase(room, w.preview, label, sent, () => { sent = true; });
	}
}

/** 고르기 화면: 내가 고르면 보내고 그대로 기다림. 시작·오류·나가기·엔트리 다시 옴(재접속) 때 끝남 */
function pickPhase(room: OnlineRoom, pv: PreviewInfo, label: string, sent: boolean, onSent: () => void, _lobby = false): Promise<WaitResult> {
	return new Promise(resolve => {
		const P: any = pv, my = pv.side as Seat, four = pv.seats === 4;
		const oppSide = (four ? (my === 'p1' || my === 'p2' ? 'p3' : 'p1') : my === 'p1' ? 'p2' : 'p1') as Seat;
		// 2vs2: 상대 편 두 사람의 엔트리를 이어서 보여 줌 (이름은 'A & B')
		const mine = P[my], opp = four ? { name: `${P[oppSide].name} & ${P[mateOf(oppSide)].name}`, team: [...P[oppSide].team, ...P[mateOf(oppSide)].team], sprite: P[oppSide].sprite } : P[oppSide];
		const others = seatsOf(pv).filter(sd => sd !== my);
		let done = false, status: 'picking' | 'done' | 'away' = 'picking';
		let setStatus: ((s: typeof status) => void) | null = null;
		const finish = (r: WaitResult) => { if (done) return; done = true; room.handlers.room = undefined; resolve(r); };
		room.handlers.room = info => {
			const I: any = info;
			if (info.lobby && info.ready && !seatsOf(pv).every(sd => I.ready[sd]) && !I.picked?.[my]) return finish({ back: true });   // 로비 방: 상대가 나가는 등 준비가 풀림
			status = others.some(sd => !I.online[sd]) ? 'away' : others.every(sd => I.picked?.[sd]) ? 'done' : 'picking';
			setStatus?.(status);
		};
		room.handlers.start = st => finish({ start: st });
		room.handlers.preview = p2 => finish({ preview: p2 });
		room.handlers.error = msg => finish({ error: msg });
		const Wrap = () => {
			const [st, ss] = useState(status); setStatus = ss;
			return <OnlinePick title={pv.mode === 'coop' ? `${label} · 파트너 ${opp.name} · 각자 3마리` : four ? `${label} · 파트너 ${P[mateOf(my)].name} · 각자 3마리` : `${label} · ${fmtKo(pv.doubles, pv.pick)}`} mine={mine.team} myName={mine.name} oppName={opp.name} oppTitle={splitSprite((opp as any).sprite)[1]} oppTeam={opp.team} oppNames={four ? [P[oppSide].name, P[mateOf(oppSide)].name] : undefined}
				count={pv.pick} sent={sent} opp={st}
				onDone={idx => { room.send({ t: 'pick', idx }); onSent(); }}
				onLeave={() => finish({ cancel: true })} prep={<BgmRow />} />;
		};
		ask<void>(() => <Wrap />).catch(() => finish({ cancel: true }));
	});
}

/** 배틀 화면 (메뉴로 나가도 여기로 돌아옴 — 방 정리는 부른 쪽이). ext.end 로 밖에서 끝낼 수 있음 */
function runBattle(setup: BattleSetup, ext?: { end?: (r: BattleResult) => void }): Promise<BattleResult> {
	return ask<BattleResult>(resolve => { if (ext) ext.end = resolve; return <BattleView key={Math.random()} setup={setup} onEnd={resolve} />; });
}

/** 배틀 입장 연출: 양쪽 트레이너·이름·칭호가 맞붙는 VS 화면 (2초, 누르면 넘김) */
function VsScreen({ me, opp, label, done }: { me: { name: string; sprite: string; title: string }; opp: { name: string; sprite: string; title: string }; label: string; done: () => void }) {
	useEffect(() => { sfx('ballOpen'); const t = setTimeout(done, 2100); return () => clearTimeout(t); }, []);
	const half = (p: typeof me, cls: string) => <div class={'vs-half ' + cls}>
		<img src={SPRITE_URL(p.sprite)} onError={trainerImgError} alt="" />
		<span class="vs-name"><b>{p.name}</b>{p.title && itemById(p.title) && <TitleChip it={itemById(p.title)} />}</span>
	</div>;
	return <div class="vs-scr" onClick={done}>
		{half(opp, 'foe')}
		<div class="vs-mid"><i class="vs-line" /><b class="vs-mark">VS</b><i class="vs-line" /></div>
		{half(me, 'own')}
		<p class="vs-label">{label}</p>
	</div>;
}
/** 돌아가기(앱을 다시 켠 뒤 복귀)로 들어온 배틀은 VS 연출을 건너뜀 */
let resuming = false;

/** 고르기 화면에서 본 상대 엔트리 (배틀 중 상대 현황 창에 씀) */
let lastPreview: PreviewInfo | null = null;
/** 시작 정보를 받으면 배틀 진행 */
async function play(room: OnlineRoom, start: StartInfo, label: string, lobby = false): Promise<'again' | 'leave'> {
	// 앱 데이터(종족값·타입·기술 수치와 설명)를 방 규칙에 맞춤 — 두 앱이 같은 데이터로 같은 배틀을 돌리게 (끝나면·오류가 나도 내 설정으로 되돌림)
	applyRuleData(ruleById(start.ruleId));
	try { return start.mode === 'coop' ? await playCoop(room, start, lobby) : start.mode === 'multi' ? await playMulti(room, start, lobby) : await playRoom(room, start, label, lobby); }
	finally { applyRuleData(ruleById(loadSettings().battleRule)); }
}
async function playRoom(room: OnlineRoom, start: StartInfo, label: string, lobby: boolean): Promise<'again' | 'leave'> {
	const rs = new RemoteSession(start, room);   // 먼저 만들어 둠: 이 뒤로 오는 선택은 화면이 뜰 때까지 모아 둠
	const oppSide = start.side === 'p1' ? 'p2' : 'p1';
	const me = start[start.side], opp = start[oppSide];
	setActiveRoom({ code: room.code, lobby, label, opp: opp.name, at: Date.now() });
	if (!resuming) await ask<void>(r => <VsScreen label={`${label} · ${fmtKo(start.doubles, me.team.length)}`} done={() => r()}
		me={{ name: me.name, sprite: playerSprite(), title: titleItem()?.id || '' }} opp={{ name: opp.name, sprite: splitSprite((opp as any).sprite)[0], title: splitSprite((opp as any).sprite)[1] }} />);
	resuming = false;
	// 상대 연결 상태 알림 (끊김 → 돌아옴)
	let away = false;
	const ext: { end?: (r: BattleResult) => void } = {};
	room.handlers.room = info => {
		// 내가 잠깐 끊긴 사이 상대가 결과를 보고 방으로 돌아갔거나 나감: 서버에 이 배틀이 더는 없으므로 여기서 끝냄 (안 그러면 끝나지 않는 배틀에 갇힘)
		if (info.status === 'waiting' && !rs.ended) { toast('상대가 먼저 방으로 돌아가 배틀이 끝났어요'); ext.end?.({ win: false, forfeit: true, turns: 0, p1Left: 0, p2Left: 0 }); return; }
		const gone = !info.online[oppSide] && info.status === 'battle';
		if (gone && !away) toast(`${josa(opp.name, 'conjunctive')}의 연결이 끊겼어요. 1분 안에 돌아오지 않으면 승리로 처리돼요`);
		else if (!gone && away && info.status === 'battle') toast(`${josa(opp.name, 'subject')} 다시 연결됐어요`);
		away = gone;
	};
	// 재접속이면 지난 선택들이 이어서 옴 (RemoteSession 이 받아서 엔진에 넣음)
	const res = await runBattle({
		gen: 9, doubles: start.doubles, aiSkill: 0, bg: 'pwt', music: 'pwt', label, noRecord: true, ruleId: start.ruleId, online: rs,
		p1: { name: me.name, team: me.team, sprite: playerSprite() },
		p2: { name: opp.name, title: '', team: opp.team, preview: lastPreview && lastPreview[oppSide].name === opp.name ? lastPreview[oppSide].team : undefined, sprite: splitSprite((opp as any).sprite)[0] },
	}, ext);
	setActiveRoom(null);
	room.handlers.input = undefined; room.handlers.inputs = undefined;   // 다음 판의 선택이 끝난 판으로 가지 않게
	if (res.quit) {   // 메뉴에서 '메인 메뉴로': 방을 나가고(끝나지 않았으면 기권은 이미 보냄) 메인 메뉴로
		if (lobby) room.send({ t: 'leave' });
		room.close();
		abortMode();
		return 'leave';
	}
	const draw = rs.ended && !rs.winner;
	if (!lobby) {
		room.close();
		await ask<void>(r => <InfoScreen title={label} heading={draw ? '무승부' : res.win ? '승리!' : '패배…'} lines={[`${opp.name}${draw ? '와(과) 비겼다' : res.win ? '에게 이겼다!' : '에게 졌다…'} (${res.turns}턴)`]}
			actions={[{ label: '확인', onClick: () => r() }]} />);
		return 'leave';
	}
	room.send({ t: 'ended' });
	return ask<'again' | 'leave'>(r => <InfoScreen title={label} heading={draw ? '무승부' : res.win ? '승리!' : '패배…'} lines={[`${opp.name}${draw ? '와(과) 비겼다' : res.win ? '에게 이겼다!' : '에게 졌다…'} (${res.turns}턴)`]}
		actions={[{ label: '방으로 돌아가기', onClick: () => r('again') }, { label: '나가기', kind: 'ghost', onClick: () => r('leave') }]} />);
}

// ───────── 협력 타워 (online-coop.ts) ─────────
/** 연승 수는 방장이 기억 (방 코드별). 손님은 배틀마다 방장이 보내 준 값을 봄 */
const coopStreak: { [code: string]: number } = {};
/** 상대: 배틀타워의 트레이너 두 명이 3마리씩 (연승이 오를수록 강해지고, 7의 배수 번째는 네임드·21·49번째는 타이쿤이 낌) */
function coopFoe(streak: number): CoopFoe {
	const a: any = towerOpponent(streak, 'doubles', [], false, 'normal');
	let b: any = towerOpponent(streak, 'doubles', [], false, 'normal');
	for (let i = 0; i < 5 && b.name === a.name; i++) b = towerOpponent(streak, 'doubles', [], false, 'normal');
	const ta: PSet[] = a.team.slice(0, 3), tb: PSet[] = b.team.slice(0, 3), team: PSet[] = [];
	for (let i = 0; i < 3; i++) { if (ta[i]) team.push(ta[i]); if (tb[i]) team.push(tb[i]); }
	return { streak, name: `${a.name} & ${b.name}`, sprite: a.sprite, sprite2: b.sprite, skill: Math.max(a.skill, b.skill), line: a.line, team: withLevel(team, LEVEL) };
}
async function playCoop(room: OnlineRoom, start: StartInfo, lobby: boolean): Promise<'again' | 'leave'> {
	const label = '협력 타워';
	const cs = new TeamSession(start, room, () => coopFoe(coopStreak[room.code] || 0));
	const partnerSide = start.side === 'p1' ? 'p2' : 'p1', partner = start[partnerSide];
	// 방장이 상대를 정해 보내올 때까지 잠깐 기다림
	const err = await ask<string>(r => { cs.ready.then(() => r(''), e => r(e?.message || '시작하지 못했어요')); return <Screen title={label} cls="wide-scr"><div class="online-wait"><p class="hint">다음 상대를 부르는 중…</p></div></Screen>; });
	if (err) { toast(err); room.handlers.input = undefined; room.handlers.inputs = undefined; if (!lobby) room.close(); return lobby ? 'again' : 'leave'; }
	const no = cs.foe.streak + 1;
	setActiveRoom({ code: room.code, lobby, label, opp: partner.name, at: Date.now() });
	resuming = false;
	let away = false;
	const ext: { end?: (r: BattleResult) => void } = {};
	room.handlers.room = info => {
		if (info.status === 'waiting' && !cs.ended) { toast('파트너가 먼저 방으로 돌아가 배틀이 끝났어요'); ext.end?.({ win: false, forfeit: true, turns: 0, p1Left: 0, p2Left: 0 }); return; }
		const gone = !info.online[partnerSide] && info.status === 'battle';
		if (gone && !away) toast(`${josa(partner.name, 'conjunctive')}의 연결이 끊겼어요. 1분 안에 돌아오지 않으면 도전이 끝나요`);
		else if (!gone && away && info.status === 'battle') toast(`${josa(partner.name, 'subject')} 다시 연결됐어요`);
		away = gone;
	};
	const pvSprite = lastPreview && lastPreview[partnerSide].name === partner.name ? splitSprite((lastPreview[partnerSide] as any).sprite)[0] : undefined;
	const res = await runBattle({
		gen: 9, doubles: true, aiSkill: 0, bg: 'tower', music: 'tower', label: `${label} ${no}번째`, noRecord: true, ruleId: start.ruleId, online: cs as any,
		partner: { name: partner.name, theirs: cs.flags, sprite: pvSprite, remote: true },
		p1: { name: cs.sideName, team: cs.team, sprite: playerSprite() },
		p2: { name: cs.foe.name, title: '', team: cs.foe.team, sprite: cs.foe.sprite, sprite2: cs.foe.sprite2, line: cs.foe.line } as any,
	}, ext);
	setActiveRoom(null);
	room.handlers.input = undefined; room.handlers.inputs = undefined;
	if (res.quit) { if (lobby) room.send({ t: 'leave' }); room.close(); abortMode(); return 'leave'; }
	const win = cs.ended && cs.winner === cs.sideName;
	const now = win ? no : 0;
	if (start.side === 'p1') coopStreak[room.code] = now;
	if (win) updateRecords(r => { r.best['tower-coop'] = Math.max(r.best['tower-coop'] || 0, now); });
	const best = loadRecords().best['tower-coop'] || 0;
	const lines = win ? [`${cs.foe.name}에게 이겼다! (${res.turns}턴)`, `${josa(partner.name, 'conjunctive')} 함께 ${now}연승 · 최고 ${best}연승`, lobby ? '방으로 돌아가 둘 다 준비하면 다음 승부로 이어집니다.' : '']
		: [cs.endReason || `${cs.foe.name}에게 졌다… (${res.turns}턴)`, `${no - 1}연승에서 도전이 끝났습니다 · 최고 ${best}연승`, lobby ? '방으로 돌아가면 처음부터 다시 도전할 수 있어요.' : ''];
	if (!lobby) { room.close(); await ask<void>(r => <InfoScreen title={label} heading={win ? `${now}연승!` : '도전 종료'} lines={lines.filter(Boolean)} actions={[{ label: '확인', onClick: () => r() }]} />); return 'leave'; }
	room.send({ t: 'ended' });
	return ask<'again' | 'leave'>(r => <InfoScreen title={label} heading={win ? `${now}연승!` : '도전 종료'} lines={lines.filter(Boolean)}
		actions={[{ label: win ? '방으로 돌아가기 (다음 승부)' : '방으로 돌아가기', onClick: () => r('again') }, { label: '나가기', kind: 'ghost', onClick: () => r('leave') }]} />);
}

// ───────── 2vs2 멀티배틀 (online-coop.ts 의 TeamSession, 서버의 4자리 방) ─────────
async function playMulti(room: OnlineRoom, start: StartInfo, lobby: boolean): Promise<'again' | 'leave'> {
	const label = '2vs2 멀티배틀', S: any = start, my = start.side as Seat, mate = mateOf(my);
	const ts = new TeamSession(start, room);
	const err = await ts.ready.then(() => '', e => e?.message || '시작하지 못했어요');
	if (err) { toast(err); room.handlers.input = undefined; room.handlers.inputs = undefined; return 'again'; }
	const partner = S[mate];
	setActiveRoom({ code: room.code, lobby, label, opp: ts.foeName, at: Date.now() });
	resuming = false;
	const away: { [sd: string]: boolean } = {};
	const ext: { end?: (r: BattleResult) => void } = {};
	room.handlers.room = info => {
		const I: any = info;
		if (info.status === 'waiting' && !ts.ended) { toast('다른 사람이 먼저 방으로 돌아가 배틀이 끝났어요'); ext.end?.({ win: false, forfeit: true, turns: 0, p1Left: 0, p2Left: 0 }); return; }
		for (const sd of seatsOf(start)) { if (sd === my) continue;
			const gone = !I.online[sd] && info.status === 'battle';
			if (gone && !away[sd]) toast(`${josa(S[sd].name, 'conjunctive')}의 연결이 끊겼어요. 1분 안에 돌아오지 않으면 그 편의 패배로 처리돼요`);
			else if (!gone && away[sd] && info.status === 'battle') toast(`${josa(S[sd].name, 'subject')} 다시 연결됐어요`);
			away[sd] = gone; }
	};
	const spr = (sd: Seat) => lastPreview && (lastPreview as any)[sd]?.name === S[sd].name ? splitSprite((lastPreview as any)[sd].sprite)[0] : undefined;
	const foeA = (my === 'p1' || my === 'p2' ? 'p3' : 'p1') as Seat;
	const res = await runBattle({
		gen: 9, doubles: true, aiSkill: 0, bg: 'pwt', music: 'pwt', label, noRecord: true, ruleId: start.ruleId, online: ts as any,
		partner: { name: partner.name, theirs: ts.flags, sprite: spr(mate), remote: true, timed: true },
		p1: { name: ts.sideName, team: ts.team, sprite: playerSprite() },
		p2: { name: ts.foeName, title: '', team: ts.foeTeam, sprite: spr(foeA), sprite2: spr(mateOf(foeA)) } as any,
	}, ext);
	setActiveRoom(null);
	room.handlers.input = undefined; room.handlers.inputs = undefined;
	if (res.quit) { if (lobby) room.send({ t: 'leave' }); room.close(); abortMode(); return 'leave'; }
	const draw = ts.ended && !ts.winner, win = ts.ended && ts.winner === ts.sideName;
	room.send({ t: 'ended' });
	return ask<'again' | 'leave'>(r => <InfoScreen title={label} heading={draw ? '무승부' : win ? '승리!' : '패배…'}
		lines={[ts.endReason, `${josa(partner.name, 'conjunctive')} 함께 ${ts.foeName}${draw ? '와(과) 비겼다' : win ? '에게 이겼다!' : '에게 졌다…'} (${res.turns}턴)`].filter(Boolean)}
		actions={[{ label: '방으로 돌아가기', onClick: () => r('again') }, { label: '나가기', kind: 'ghost', onClick: () => r('leave') }]} />);
}

// ───────── 로비 ─────────
const statusKo = (c: RoomCard) => c.status === 'battle' ? '대전 중' : c.players >= (c.seats || 2) ? '꽉 참' : '대기 중';
function TrainerImg({ sprite, size = 40 }: { sprite: string; size?: number }) {
	return <img class="lb-tr" src={SPRITE_URL(splitSprite(sprite)[0])} onError={trainerImgError} alt="" style={{ width: size + 'px', height: size + 'px' }} />;
}
type LobbyAction = { create: true } | { room: RoomCard } | { code: true } | { random: true } | { resume: ActiveRoom } | typeof BACK;
function LobbyScreen({ done }: { done: (a: LobbyAction) => void }) {
	const [rooms, setRooms] = useState<RoomCard[] | null>(null);
	const [ok, setOk] = useState(true);
	const [rev, setRev] = useState(0);   // 새로 고침: 로비 연결을 다시 열어 목록을 새로 받음
	const [busy, setBusy] = useState(false);
	useEffect(() => watchLobby(l => { setRooms(l); setBusy(false); }, setOk), [rev]);
	const refresh = () => { if (busy) return; setBusy(true); setRooms(null); setRev(r => r + 1); setTimeout(() => setBusy(false), 4000); };
	const [active, setActive] = useState(getActiveRoom());   // 앱이 꺼지는 등으로 끝내지 못한 대전
	return <Screen title="온라인 로비" onBack={() => done(BACK)} cls="wide-scr lobby-scr" top>
		<div class="lb-actions">
			<button class="btn primary" onClick={() => done({ create: true })}>＋ 방 만들기</button>
			<button class="btn" onClick={() => done({ code: true })}>🔑 코드로 들어가기</button>
			<button class="btn" disabled={busy} onClick={refresh}>{busy ? '불러오는 중…' : '↻ 새로 고침'}</button>
		</div>
		{active && <div class="lb-resume">
			<span><b>진행 중이던 대전이 있어요</b><small>{active.label} · 상대 {active.opp}</small></span>
			<button class="btn small primary" onClick={() => done({ resume: active })}>돌아가기</button>
			<button class="btn small ghost" onClick={() => { setActiveRoom(null); setActive(null); }}>지우기</button>
		</div>}
		<details class="lb-rules"><summary>대전 안내 (v{APP_VERSION})</summary>
			<p class="hint">같은 앱 버전끼리 대전해요. 전적에는 남지 않아요(리플레이는 저장 가능). 시간: 고르기 90초 · 한 번 선택 45초 · 내 시간 7분 · 대전 20분 (끝나면 남은 포켓몬 수 → HP 비율로 판정). 끊겨도 1분 안에 돌아오면 이어서 해요 (앱이 꺼졌어도 로비의 「돌아가기」로).</p></details>
		<h3 class="sec">열린 방 <small class="muted">{rooms ? `${rooms.length}개` : ok ? '불러오는 중…' : '서버에 연결하는 중…'}</small></h3>
		{rooms && !rooms.length && <p class="muted lb-empty">아직 열린 방이 없어요. 방을 만들어 친구를 기다려 보세요!</p>}
		<div class="lb-list">{(rooms || []).map(c => {
			const vOk = c.version === APP_VERSION, can = vOk && c.status === 'waiting' && c.players < (c.seats || 2);
			return <button class={'lb-room' + (can ? '' : ' off')} onClick={() => can ? done({ room: c }) : toast(!vOk ? `앱 버전이 달라요 (방 v${c.version} · 나 v${APP_VERSION})` : c.status === 'battle' ? '대전 중인 방이에요' : '방이 꽉 찼어요')}>
				<TrainerImg sprite={c.sprite} />
				<span class="lb-body">
					<b>{c.locked && <i class="lb-lock" aria-label="비밀번호 방">🔒</i>}{c.title}</b>
					<span class="lb-host">{c.host}{splitSprite(c.sprite)[1] && <TitleChip it={itemById(splitSprite(c.sprite)[1])} />}</span>
					<span class="lb-tags"><em class={c.mode ? 'coop' : ''}>{roomFmt(c)}</em><em>{ruleName(c.ruleId)}</em>{!vOk && <em class="warn">v{c.version}</em>}</span>
				</span>
				<span class={'lb-status ' + (c.status === 'battle' ? 'inbattle' : c.players >= (c.seats || 2) ? 'full' : 'wait')}>{statusKo(c)}<small>{c.players}/{c.seats || 2}</small></span>
			</button>;
		})}</div>
	</Screen>;
}

/** 규칙 고르기: 내 설정의 규칙 · 포켓몬 풀별 기본 규칙 (+ 초전설·환상 가능/불가) */
function RulePicker({ cur, onPick, onClose }: { cur: string; onPick: (id: string) => void; onClose: () => void }) {
	const mine = loadSettings().battleRule;
	// 초전설·환상: 금지 · 1마리까지 · 2마리까지 · 제한 없음 을 따로 고름 (화살표). 무제한처럼 풀이 정해 둔 것이 있으면 그 풀은 그대로
	const [leg, setLeg] = useState<LegendMode>(ruleById(cur).restricted), [myth, setMyth] = useState<LegendMode>(ruleById(cur).mythical);
	const step = (label: string, v: LegendMode, set: (x: LegendMode) => void) => { const i = Math.max(0, LEGEND_MODES.findIndex(m => m.id === v)), n = LEGEND_MODES.length, go = (d: number) => set(LEGEND_MODES[(i + d + n) % n].id as LegendMode);
		return <div class="lr-leg"><span>{label}</span><div class="rule-step"><button class="pick-arrow" aria-label={`${label} 이전`} onClick={() => go(-1)}><i class="tri l" /></button><b class={v === 'no' ? 'off' : ''}>{LEGEND_MODES[i].name}</b><button class="pick-arrow" aria-label={`${label} 다음`} onClick={() => go(1)}><i class="tri r" /></button></div></div>; };
	const opts = [{ id: mine, name: '내 설정의 규칙', desc: ruleName(mine) }, ...POOLS.map(p => {
		const id = makeRuleId(p.gimmick, p.id, p.legends ? p.legends[0] : leg, p.legends ? p.legends[1] : myth);
		return { id, name: p.name, desc: ruleName(id) };
	})];
	return <Modal title="방 규칙" onClose={onClose}>
		{step('초전설', leg, setLeg)}{step('환상', myth, setMyth)}
		<div class="lr-rules">{opts.map(o => <button class={'lr-rule-opt' + (ruleById(o.id).id === ruleById(cur).id ? ' on' : '')} onClick={() => onPick(o.id)}><b>{o.name}</b><small>{o.desc}</small></button>)}</div>
	</Modal>;
}
const FMTS: Fmt[] = [{ doubles: false, pick: 3 }, { doubles: true, pick: 4 }, { doubles: false, pick: 6 }, { doubles: true, pick: 6 }];
type CreateOpts = { title: string; pw: string; ruleId: string; doubles: boolean; pick: number; mode?: RoomMode; seats?: number };
function CreateRoom({ done }: { done: (o: CreateOpts | typeof BACK) => void }) {
	const [title, setTitle] = useState(`${playerName()}의 방`);
	const [locked, setLocked] = useState(false);
	const [pw, setPw] = useState('');
	const [fmt, setFmt] = useState(FMTS[0]);
	const [rid, setRid] = useState(loadSettings().battleRule);
	const [pick, setPick] = useState(false);
	const [mode, setMode] = useState<RoomMode>(undefined);
	// 2vs2 멀티배틀은 서버가 4자리 방을 지원할 때만 (서버가 예전 것이면 단추를 숨김)
	const [s4, setS4] = useState(false);
	useEffect(() => { void serverSeats4().then(setS4); }, []);
	const ok = title.trim() && (!locked || pw.length >= 2);
	return <Screen title="방 만들기" onBack={() => done(BACK)} cls="wide-scr lobby-scr">
		<div class="lc-form">
			<label class="lc-row"><span>방 제목</span><input value={title} maxLength={24} onInput={(e: any) => setTitle(e.currentTarget.value)} /></label>
			<div class="lc-row"><span>공개</span><div class="seg"><button class={!locked ? 'on' : ''} onClick={() => setLocked(false)}>공개 방</button><button class={locked ? 'on' : ''} onClick={() => setLocked(true)}>🔒 비밀번호 방</button></div></div>
			{locked && <label class="lc-row"><span>비밀번호</span><input value={pw} maxLength={16} placeholder="2자 이상" onInput={(e: any) => setPw(e.currentTarget.value)} /></label>}
			<div class="lc-row"><span>모드</span><div class="seg"><button class={!mode ? 'on' : ''} onClick={() => setMode(undefined)}>대전</button><button class={mode === 'coop' ? 'on' : ''} onClick={() => setMode('coop')}>협력 타워</button>{s4 && <button class={mode === 'multi' ? 'on' : ''} onClick={() => setMode('multi')}>2vs2 멀티</button>}</div></div>
			{!mode && <div class="lc-row"><span>형식</span><div class="seg wrap">{FMTS.map(f => <button class={f === fmt ? 'on' : ''} onClick={() => setFmt(f)}>{fmtKo(f.doubles, f.pick)}</button>)}</div></div>}
			<div class="lc-row"><span>규칙</span><button class="btn lc-rule" onClick={() => setPick(true)}>{ruleName(rid)} <small>바꾸기</small></button></div>
			{mode === 'coop' ? <p class="hint"><b>협력 타워</b>: 들어온 사람과 한 편(멀티배틀)이 되어 배틀타워의 트레이너 두 명과 싸웁니다. 각자 6마리 중 3마리를 골라 나가고, 이길 때마다 방으로 돌아와 다음 승부로 연승을 이어 갑니다. 상대는 연승이 오를수록 강해져요.</p>
				: mode === 'multi' ? <p class="hint"><b>2vs2 멀티배틀</b>: 네 사람이 두 편으로 나뉘어 싸웁니다. 들어온 순서대로 1·2번째가 한 편, 3·4번째가 한 편이 되고, 각자 6마리 중 3마리를 골라 자기 포켓몬만 지시합니다. 넷이 모두 준비하면 시작해요. (한 번 고르는 시간 60초)</p>
				: <p class="hint">방은 로비 목록에 보여요. 규칙과 형식은 방에 들어간 뒤에도 바꿀 수 있어요.</p>}
			<button class="btn big primary" disabled={!ok} onClick={() => done({ title: title.trim(), pw: locked ? pw : '', ruleId: rid, mode, ...(mode ? COOP_FMT : { doubles: fmt.doubles, pick: fmt.pick }), ...(mode === 'multi' ? { seats: 4 } : {}) })}>방 만들기</button>
		</div>
		{pick && <RulePicker cur={rid} onPick={id => { setRid(id); setPick(false); }} onClose={() => setPick(false)} />}
	</Screen>;
}
function PwEntry({ title, done }: { title: string; done: (pw: string | typeof BACK) => void }) {
	const [v, setV] = useState('');
	return <Screen title={title} onBack={() => done(BACK)} cls="wide-scr">
		<p class="hint">🔒 비밀번호가 걸린 방이에요.</p>
		<input class="code-input" type="password" value={v} maxLength={16} placeholder="비밀번호" onInput={(e: any) => setV(e.currentTarget.value)} onKeyDown={(e: any) => { if (e.key === 'Enter' && v) done(v); }} />
		<button class="btn big" disabled={!v} onClick={() => done(v)}>들어가기</button>
	</Screen>;
}

/** 방 안 상태: 연결 이벤트를 모아 두고 화면이 구독 */
class RoomBox {
	info: RoomInfo | null = null; chat: ChatMsg[] = []; team: PSet[] | null = null;
	subs = new Set<() => void>();
	constructor(public room: OnlineRoom) {
		room.handlers.chat = m => { this.chat = [...this.chat, m].slice(-60); this.emit(); };
		room.handlers.chatlog = l => { this.chat = l; this.emit(); };
	}
	emit() { this.subs.forEach(f => f()); }
}
type RoomAct = { preview: PreviewInfo } | { start: StartInfo } | { error: string } | { leave: true } | { team: true } | { rules: true } | { practice: true };
/** 파티에서 방 규칙에 안 맞는 것들을 글로 */
const issueText = (ruleIdIn: string, team: PSet[]) => teamRuleIssues(ruleById(ruleIdIn), team).map(x => x.kind === 'species' ? speciesKo(x.species) : `${speciesKo(x.species)}의 ${itemKo(x.item!)}`);
function roomPhase(box: RoomBox): Promise<RoomAct> {
	const room = box.room;
	return new Promise(resolve => {
		let done = false;
		const finish = (r: RoomAct) => { if (done) return; done = true; room.handlers.room = undefined; resolve(r); };
		let resent = false;
		room.handlers.room = info => {
			box.info = info; box.emit();
			// 오래 끊겼다 돌아와 자리를 새로 받으면 서버에는 내 파티가 없음 → 다시 보냄 (안 그러면 준비를 누르는 순간 방에서 튕김)
			if (!resent && info.side && box.team && !info.hasTeam?.[info.side]) { resent = true; room.send({ t: 'team', team: box.team }); }
		};
		room.handlers.preview = pv => finish({ preview: pv });
		room.handlers.start = st => finish({ start: st });
		room.handlers.error = msg => finish({ error: msg });
		ask<void>(() => <RoomView box={box} act={finish} />).catch(() => finish({ leave: true }));
	});
}
function PlayerSlot({ info: info0, sd, me }: { info: RoomInfo; sd: Seat; me: boolean }) {
	const info: any = info0;
	const name = info.players[sd];
	if (!name) return <div class="lr-slot empty"><span class="lr-wait">빈 자리</span><small>상대를 기다리는 중…</small></div>;
	const [sp, tid] = splitSprite(info.sprites?.[sd]);
	const ready = info.ready?.[sd], team = info.hasTeam?.[sd], on = info.online[sd];
	const skin = splitSkin(info.sprites?.[sd]);
	return <div class={'lr-slot' + (ready ? ' ready' : '') + (me ? ' me' : '') + skin.cls} style={skin.style}>
		<img class="lb-tr" src={SPRITE_URL(sp)} onError={trainerImgError} alt="" />
		<span class="lr-who"><b>{name}{sd === 'p1' && <i class="lr-host">방장</i>}{me && <i class="lr-me">나</i>}</b>{tid && <TitleChip it={itemById(tid)} />}</span>
		<span class={'lr-state' + (ready ? ' ok' : !on ? ' off' : '')}>{!on ? '연결 끊김' : ready ? '준비 완료' : team ? '준비 중' : '파티 고르는 중'}</span>
	</div>;
}
function RoomView({ box, act }: { box: RoomBox; act: (a: RoomAct) => void }) {
	const [, tick] = useState(0);
	const [rules, setRules] = useState(false);
	const [text, setText] = useState('');
	const logRef = useRef<HTMLDivElement>(null);
	// 구독 직후 한 번 다시 그림: 화면이 뜬 뒤 구독하기 전에 온 방 정보(배틀 뒤 'again' 응답 등)를 놓치지 않게
	useEffect(() => { const f = () => tick(x => x + 1); box.subs.add(f); f(); return () => { box.subs.delete(f); }; }, []);
	useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [box.chat.length]);
	const info = box.info;
	if (!info) return <Screen title="방" onBack={() => act({ leave: true })} cls="wide-scr"><div class="online-wait"><p class="hint">방에 들어가는 중…</p></div></Screen>;
	const I: any = info, me = (info.side || 'p2') as Seat, host = me === 'p1', four = info.seats === 4;
	const myReady = !!I.ready?.[me];
	const picking = seatsOf(info).every(sd => I.players[sd] && I.ready?.[sd]);
	const issues = box.team ? issueText(info.ruleId, box.team) : [];
	useEffect(() => { if (issues.length && myReady && !picking) box.room.send({ t: 'ready', on: false }); }, [issues.length, myReady]);   // 규칙이 바뀌어 안 맞게 되면 준비를 풂
	const send = () => { const t = text.trim(); if (!t) return; box.room.send({ t: 'chat', text: t }); setText(''); };
	return <Screen title={info.title || '방'} onBack={() => act({ leave: true })} cls="wide-scr lobby-scr room-scr">
		<div class="lr-wrap">
			<div class="lr-main">
				<div class="lr-head">
					<span class="lr-code">{info.locked && '🔒 '}방 코드 <b>{info.code}</b></span>
					<button class="btn small ghost" onClick={() => navigator.clipboard?.writeText(info.code).then(() => toast('방 코드를 복사했어요'), () => toast('복사하지 못했어요'))}>복사</button>
				</div>
				<div class="lr-rule">
					<span><em>{roomFmt(info)}</em> {ruleName(info.ruleId)}</span>
					{host && <button class="btn small" disabled={picking} onClick={() => setRules(true)}>규칙 바꾸기</button>}
				</div>
				{four ? <div class="lr-teams">{([['p1', 'p2'], ['p3', 'p4']] as Seat[][]).map((pair, k) => [k ? <span class="lr-vs big">VS</span> : null,
					<div class="lr-players"><PlayerSlot info={info} sd={pair[0]} me={me === pair[0]} /><span class="lr-vs">＆</span><PlayerSlot info={info} sd={pair[1]} me={me === pair[1]} /></div>])}</div>
				: <div class="lr-players"><PlayerSlot info={info} sd="p1" me={me === 'p1'} /><span class="lr-vs">{info.mode === 'coop' ? '＆' : 'VS'}</span><PlayerSlot info={info} sd="p2" me={me === 'p2'} /></div>}
				<div class="lr-team">
					<span class="lr-team-l">내 파티</span>
					{box.team ? <span class="lr-icons">{box.team.map(p => <PokeIcon species={p.species} />)}</span> : <span class="muted small">아직 고르지 않았어요</span>}
					<button class={'btn small' + (box.team ? '' : ' primary')} disabled={picking} onClick={() => act({ team: true })}>{box.team ? '파티 바꾸기' : '파티 고르기'}</button>
				</div>
				{issues.length > 0 && <p class="lr-warn">이 방 규칙에서 쓸 수 없어요: {issues.join(' · ')}<small>파티를 바꾸거나 방장이 규칙을 바꿔야 준비할 수 있어요.</small></p>}
				{!info.players.p2 && !four && box.team && !issues.length && <button class="btn lr-practice" onClick={() => act({ practice: true })}>기다리는 동안 AI와 연습<small>상대가 들어오면 알려 줘요</small></button>}
				<p class="hint lr-hint">{four ? '2vs2 멀티배틀: 위의 두 사람이 한 편, 아래 두 사람이 한 편이에요(들어온 순서). 넷이 모두 「준비 완료」를 누르면 상대 편의 파티를 보고 각자 3마리를 골라요.' : info.mode === 'coop' ? `협력 타워: 둘 다 「준비 완료」를 누르면 서로의 파티를 보고 각자 3마리를 골라 함께 싸워요.${info.side === 'p1' && coopStreak[info.code] ? ` 지금 ${coopStreak[info.code]}연승 중!` : ''}` : '팀은 방 규칙에 맞게 골라 주세요. 둘 다 「준비 완료」를 누르면 서로 엔트리를 보고 참가 포켓몬을 골라요.'}</p>
			</div>
			<div class="lr-chat">
				<div class="lr-log" ref={logRef}>{box.chat.map(c => c.side ? <p class={'lr-msg ' + (c.name === I.players[me] ? 'mine' : 'theirs')}><b>{c.name}</b>{c.text}</p> : <p class="lr-msg sys">{c.text}</p>)}
					{!box.chat.length && <p class="lr-msg sys">채팅으로 인사해 보세요!</p>}</div>
				<div class="lr-input"><input value={text} maxLength={120} placeholder="메시지 보내기" onInput={(e: any) => setText(e.currentTarget.value)} onKeyDown={(e: any) => { if (e.key === 'Enter') send(); }} />
					<button class="btn small" disabled={!text.trim()} onClick={send}>보내기</button></div>
			</div>
		</div>
		<div class="lr-bottom">
			<button class={'btn big ' + (myReady ? 'ghost' : 'primary')} disabled={!box.team || picking || issues.length > 0} onClick={() => box.room.send({ t: 'ready', on: !myReady })}>{myReady ? (picking ? '곧 시작해요…' : '준비 취소') : '준비 완료'}</button>
			<button class="btn big ghost" onClick={() => act({ leave: true })}>나가기</button>
		</div>
		{rules && <RuleAndFmt info={info} onDone={(rid, f) => { setRules(false); if (rid) box.room.send({ t: 'rules', ruleId: roomRule(rid, info.mode), ...(info.mode ? COOP_FMT : { doubles: f!.doubles, pick: f!.pick }) }); }} />}
	</Screen>;
}
function RuleAndFmt({ info, onDone }: { info: RoomInfo; onDone: (rid?: string, f?: Fmt) => void }) {
	const [fmt, setFmt] = useState(FMTS.find(f => f.doubles === info.doubles && f.pick === (info.pick || 6)) || FMTS[0]);
	const [rid, setRid] = useState(info.ruleId);
	const [pick, setPick] = useState(false);
	if (pick) return <RulePicker cur={rid} onPick={id => { setRid(id); setPick(false); }} onClose={() => setPick(false)} />;
	return <Modal title="규칙·형식 바꾸기" onClose={() => onDone()}>
		<div class="lc-form">
			{!info.mode && <div class="lc-row"><span>형식</span><div class="seg wrap">{FMTS.map(f => <button class={f === fmt ? 'on' : ''} onClick={() => setFmt(f)}>{fmtKo(f.doubles, f.pick)}</button>)}</div></div>}
			<div class="lc-row"><span>규칙</span><button class="btn lc-rule" onClick={() => setPick(true)}>{ruleName(rid)} <small>바꾸기</small></button></div>
			<p class="hint">바꾸면 두 사람의 준비가 풀려요.</p>
			<div class="pv-btns"><button class="btn primary" onClick={() => onDone(rid, fmt)}>바꾸기</button><button class="btn ghost" onClick={() => onDone()}>닫기</button></div>
		</div>
	</Modal>;
}
/** 방 규칙의 데이터로 팀 고르기 (추천 렌탈 팀도 방 규칙 풀에서) */
async function chooseRoomTeam(ruleIdIn: string) {
	applyRuleData(ruleById(ruleIdIn));
	try { return await chooseTeam(9, '방에서 쓸 파티', true, false, LEVEL, ruleIdIn); }
	finally { applyRuleData(ruleById(loadSettings().battleRule)); }
}
/** 로비 방 안: 대기실 → (둘 다 준비) 고르기 → 배틀 → 다시 대기실 */
async function lobbyRoom(room: OnlineRoom, box: RoomBox) {
	while (true) {
		const a = await roomPhase(box);
		if ('leave' in a) { room.send({ t: 'leave' }); room.close(); return; }
		if ('error' in a) { room.send({ t: 'leave' }); room.close(); toast(a.error); return; }
		if ('team' in a) {
			if (box.info?.side && box.info.ready?.[box.info.side]) room.send({ t: 'ready', on: false });   // 고르는 동안 시작되지 않게
			const team = await chooseRoomTeam(box.info?.ruleId || loadSettings().battleRule);
			if (team !== BACK) { box.team = withLevel(team, LEVEL); room.send({ t: 'team', team: box.team }); }
			else room.send({ t: 'again' });   // 고르는 동안 놓친 방 정보를 다시 받음
			continue;
		}
		if ('rules' in a) continue;
		if ('practice' in a) { if (await practice(room, box) === 'closed') return; continue; }
		let w: WaitResult = 'start' in a ? { start: a.start } : { preview: a.preview };
		let sent = false;
		while ('preview' in w) { sent = sent || w.preview.picked; lastPreview = w.preview; w = await pickPhase(room, w.preview, labelOf(w.preview.mode), sent, () => { sent = true; }, true); }
		if ('error' in w) { room.send({ t: 'leave' }); room.close(); toast(w.error); return; }
		if ('cancel' in w) { room.send({ t: 'leave' }); room.close(); return; }
		if ('back' in w) { room.send({ t: 'again' }); continue; }   // 상대가 빠져 돌아옴: 지금 방 상태를 다시 받음 (안 그러면 예전 상태로 버튼이 잠긴 채 보임)
		if ('start' in w) {
			const r = await play(room, w.start, labelOf(w.start.mode), true);
			if (r === 'leave') { room.send({ t: 'leave' }); room.close(); return; }
			room.send({ t: 'again' });
		}
	}
}
/** 빈 방에서 상대를 기다리는 동안 AI 와 연습 (전적·보상 없음). 상대가 들어오면 알리고, 원하면 바로 방으로 */
async function practice(room: OnlineRoom, box: RoomBox): Promise<'ok' | 'closed'> {
	const info = box.info!, mine = box.team!;
	if (info.side && info.ready?.[info.side]) room.send({ t: 'ready', on: false });   // 연습 중에 시작되지 않게
	const n = Math.min(info.pick || 6, mine.length);
	applyRuleData(ruleById(info.ruleId));
	let foe: PSet[];
	try { foe = withLevel(randomTeam({ gen: 9, size: n, minBst: 470, maxBst: 600, doubles: info.doubles, quality: 0.7 }), LEVEL); }
	finally { applyRuleData(ruleById(loadSettings().battleRule)); }
	const ext: { end?: (r: BattleResult) => void } = {};
	let told = false, error = '';
	const stop = () => ext.end?.({ win: false, forfeit: true, turns: 0, p1Left: 0, p2Left: 0 });
	room.handlers.room = i => {
		box.info = i;
		if (!i.players.p2) { told = false; return; }
		if (told) return;
		told = true; sfx('select');
		void confirmBox('상대가 들어왔어요', `${i.players.p2} 님이 방에 들어왔어요.\n연습을 끝내고 방으로 갈까요?`, '방으로', '계속 연습').then(ok => { if (ok) stop(); });
	};
	room.handlers.error = msg => { error = msg; stop(); };
	room.handlers.preview = undefined; room.handlers.start = undefined;
	const res = await runBattle({
		gen: 9, doubles: info.doubles, aiSkill: 0.75, bg: 'pwt', music: 'pwt', label: '연습 (상대 기다리는 중)', noRecord: true, ruleId: info.ruleId,
		p1: { name: playerName(), team: mine.slice(0, n), sprite: playerSprite() },
		p2: { name: '연습 상대', title: '', team: foe, sprite: 'acetrainer' },
	}, ext);
	if (error) { room.close(); toast(error); return 'closed'; }
	if (res.quit && !box.info?.players.p2) toast('방으로 돌아왔어요');
	return 'ok';
}
async function enterRoom(code: string, pw: string | undefined, create?: CreateOpts) {
	const room = new OnlineRoom(code);
	const box = new RoomBox(room);
	room.connect({ name: playerName(), sprite: spriteWithTitle(), pw, ...(create ? { create: { ...create, ruleId: roomRule(create.ruleId, create.mode), mode: undefined, seats: create.seats }, ruleId: roomRule(create.ruleId, create.mode), doubles: create.doubles, pick: create.pick } : {}) } as any);
	await lobbyRoom(room, box);
}

export async function runOnline() {
	while (true) {
		const a = await ask<LobbyAction>(r => <LobbyScreen done={r} />);
		if (a === BACK) return;
		try {
			if ('create' in a) {
				const o = await ask<CreateOpts | typeof BACK>(r => <CreateRoom done={r} />);
				if (o === BACK) continue;
				await enterRoom(newRoomCode(), undefined, o);
			} else if ('room' in a) {
				let pw: string | undefined;
				if (a.room.locked) { const v = await ask<string | typeof BACK>(r => <PwEntry title={a.room.title} done={r} />); if (v === BACK) continue; pw = v; }
				await enterRoom(a.room.code, pw);
			} else if ('resume' in a) {
				resuming = true;
				if (a.resume.lobby) await enterRoom(a.resume.code, undefined);
				else {
					const room = new OnlineRoom(a.resume.code);
					room.connect({ name: playerName(), sprite: spriteWithTitle() } as any);
					const w = await waitStart(room, cancel => <Screen title={a.resume.label} onBack={cancel} cls="wide-scr">
						<div class="online-wait"><p class="hint">대전으로 돌아가는 중…</p><button class="btn ghost" onClick={cancel}>취소</button></div></Screen>);
					if ('cancel' in w) room.close(); else await proceed(room, w, a.resume.label);
				}
				resuming = false; setActiveRoom(null);
			} else if ('code' in a) await join();
			else await random();
		} catch (e: any) {
			if (e?.name === 'QuitToMenu' || e?.constructor?.name === 'QuitToMenu') throw e;
			toast('온라인 대전 오류: ' + (e?.message || e));
		}
	}
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
	peek.close();
	if (typeof info === 'string') { toast(info); return; }
	if (!info.players.p1) { toast('그런 방이 없어요. 코드를 다시 확인해 주세요'); return; }
	if (info.players.p2 && info.status !== 'waiting') { toast('이미 대전 중인 방이에요'); return; }
	if (info.version && info.version !== APP_VERSION) { toast(`앱 버전이 달라요 (방장 v${info.version} · 나 v${APP_VERSION})`); return; }
	if (info.lobby) {   // 로비 방: 비밀번호 → 방 안으로
		let pw: string | undefined;
		if (info.locked) { const v = await ask<string | typeof BACK>(r => <PwEntry title={info.title || '방'} done={r} />); if (v === BACK) return; pw = v; }
		return enterRoom(code, pw);
	}
	const ok = await ask<boolean>(r => <InfoScreen title="친구 대전 · 들어가기" heading={`${info.players.p1}의 방`}
		lines={[`형식: ${roomFmt(info)}`, `규칙: ${ruleName(info.ruleId)}`, '이 규칙에 맞는 팀으로 들어가 주세요. 둘 다 들어오면 서로 전체 엔트리를 보고 참가 포켓몬을 골라요.']}
		actions={[{ label: '팀 고르기', onClick: () => r(true) }, { label: '취소', kind: 'ghost', onClick: () => r(false) }]} />);
	if (!ok) return;
	const team = await chooseRoomTeam(info.ruleId);   // 방 규칙에 맞는 팀만 (내 설정의 규칙이 아니라)
	if (team === BACK) return;
	const room = new OnlineRoom(code);
	room.connect({ name: playerName(), team: withLevel(team, LEVEL), sprite: spriteWithTitle() } as any);
	const w = await waitStart(room, (cancel) => <Screen title="친구 대전" onBack={cancel} cls="wide-scr">
		<div class="online-wait"><p class="hint">들어가는 중…</p><button class="btn ghost" onClick={cancel}>취소</button></div>
	</Screen>);
	await proceed(room, w, '친구 대전');
}

async function random() {
	const fmt = await chooseFmt('랜덤 대전');
	if (fmt === BACK) return;
	const doubles = fmt.doubles;
	// 무작위 팀은 내 설정의 규칙이 아니라 랜덤 대전 규칙의 포켓몬 풀·데이터로 (설정이 서로 달라도 같은 조건)
	applyRuleData(ruleById(RANDOM_RULE));
	let team: PSet[];
	try { team = withLevel(randomTeam({ gen: 9, size: 6, minBst: 470, maxBst: 600, doubles, quality: 0.7 }), LEVEL); }
	finally { applyRuleData(ruleById(loadSettings().battleRule)); }
	// 매칭
	let stop: () => void = () => {};
	const code = await new Promise<string | null>(res => {
		stop = matchmake(doubles, fmt.pick, c => res(c), msg => { toast(msg); res(null); });
		void ask<void>(r => <Screen title="랜덤 대전" cls="wide-scr" onBack={() => { stop(); res(null); r(); }}>
			<div class="online-wait">
				<p class="hint">상대를 찾는 중… ({fmtKo(doubles, fmt.pick)} · 무작위 팀)</p>
				<div class="room-code searching">···</div>
				<p class="muted">같은 앱 버전(v{APP_VERSION})으로 같은 형식을 고른 사람과 연결돼요.</p>
				<button class="btn ghost" onClick={() => { stop(); res(null); r(); }}>그만 찾기</button>
			</div>
		</Screen>).catch(() => res(null));
	});
	if (!code) return;
	const room = new OnlineRoom(code);
	room.connect({ name: playerName(), team, ruleId: RANDOM_RULE, doubles, pick: fmt.pick, sprite: spriteWithTitle() } as any);
	const w = await waitStart(room, (cancel) => <Screen title="랜덤 대전" onBack={cancel} cls="wide-scr">
		<div class="online-wait"><p class="hint">상대를 찾았어요! 배틀을 준비하는 중…</p><button class="btn ghost" onClick={cancel}>취소</button></div>
	</Screen>);
	await proceed(room, w, '랜덤 대전');
}
