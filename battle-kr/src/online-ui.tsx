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
import { chooseTeam, playerName, playerSprite, withLevel, BACK, BgmRow } from './modes';
import { OnlineRoom, RemoteSession, matchmake, newRoomCode, normCode, watchLobby, APP_VERSION, setActiveRoom, getActiveRoom, type ActiveRoom, type StartInfo, type RoomInfo, type PreviewInfo, type ChatMsg, type RoomCard } from './online';
import { josa } from './josa';
import { OnlinePick } from './ui/online-pick';
import { randomTeam, type PSet } from './sets';
import { loadSettings } from './store';
import { ruleById, ruleId as makeRuleId, POOLS, applyRuleData, teamRuleIssues } from './rules';

/** 랜덤 대전은 모두 같은 규칙 (전국도감 · 기믹 한 종류 1회) */
const RANDOM_RULE = 'mzdt_one.natdex.no.no';
const LEVEL = 50;

/** 형식: 싱글 6→3 · 더블 6→4 (서로 전체 엔트리를 보고 고름) · 6vs6 (순서만 정함) */
type Fmt = { doubles: boolean; pick: number };
const fmtKo = (d: boolean, pick = 6) => (d ? '더블' : '싱글') + (pick < 6 ? ` 6→${pick}` : ' 6vs6');
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
		const oppSide = pv.side === 'p1' ? 'p2' : 'p1';
		const mine = pv[pv.side], opp = pv[oppSide];
		let done = false, status: 'picking' | 'done' | 'away' = 'picking';
		let setStatus: ((s: typeof status) => void) | null = null;
		const finish = (r: WaitResult) => { if (done) return; done = true; room.handlers.room = undefined; resolve(r); };
		room.handlers.room = info => {
			if (info.lobby && info.ready && !(info.ready.p1 && info.ready.p2) && !info.picked?.[pv.side]) return finish({ back: true });   // 로비 방: 상대가 나가는 등 준비가 풀림
			status = !info.online[oppSide] ? 'away' : info.picked?.[oppSide] ? 'done' : 'picking';
			setStatus?.(status);
		};
		room.handlers.start = st => finish({ start: st });
		room.handlers.preview = p2 => finish({ preview: p2 });
		room.handlers.error = msg => finish({ error: msg });
		const Wrap = () => {
			const [st, ss] = useState(status); setStatus = ss;
			return <OnlinePick title={`${label} · ${fmtKo(pv.doubles, pv.pick)}`} mine={mine.team} myName={mine.name} oppName={opp.name} oppTitle={splitSprite((opp as any).sprite)[1]} oppTeam={opp.team}
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
	// 앱 데이터(종족값·타입·기술 수치와 설명)를 방 규칙에 맞춤 — 두 앱이 같은 데이터로 같은 배틀을 돌리게 (끝나면 내 설정으로 되돌림)
	applyRuleData(ruleById(start.ruleId));
	const rs = new RemoteSession(start, room);   // 먼저 만들어 둠: 이 뒤로 오는 선택은 화면이 뜰 때까지 모아 둠
	const oppSide = start.side === 'p1' ? 'p2' : 'p1';
	const me = start[start.side], opp = start[oppSide];
	setActiveRoom({ code: room.code, lobby, label, opp: opp.name, at: Date.now() });
	if (!resuming) await ask<void>(r => <VsScreen label={`${label} · ${fmtKo(start.doubles, me.team.length)}`} done={() => r()}
		me={{ name: me.name, sprite: playerSprite(), title: titleItem()?.id || '' }} opp={{ name: opp.name, sprite: splitSprite((opp as any).sprite)[0], title: splitSprite((opp as any).sprite)[1] }} />);
	resuming = false;
	// 상대 연결 상태 알림 (끊김 → 돌아옴)
	let away = false;
	room.handlers.room = info => {
		const gone = !info.online[oppSide] && info.status === 'battle';
		if (gone && !away) toast(`${josa(opp.name, 'conjunctive')}의 연결이 끊겼어요. 1분 안에 돌아오지 않으면 승리로 처리돼요`);
		else if (!gone && away && info.status === 'battle') toast(`${josa(opp.name, 'subject')} 다시 연결됐어요`);
		away = gone;
	};
	// 재접속이면 지난 선택들이 이어서 옴 (RemoteSession 이 받아서 엔진에 넣음)
	let res: BattleResult;
	try { res = await runBattle({
		gen: 9, doubles: start.doubles, aiSkill: 0, bg: 'pwt', music: 'pwt', label, noRecord: true, ruleId: start.ruleId, online: rs,
		p1: { name: me.name, team: me.team, sprite: playerSprite() },
		p2: { name: opp.name, title: '', team: opp.team, preview: lastPreview && lastPreview[oppSide].name === opp.name ? lastPreview[oppSide].team : undefined, sprite: splitSprite((opp as any).sprite)[0] },
	}); } finally { applyRuleData(ruleById(loadSettings().battleRule)); }
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

// ───────── 로비 ─────────
const statusKo = (c: RoomCard) => c.status === 'battle' ? '대전 중' : c.players >= 2 ? '꽉 참' : '대기 중';
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
			const vOk = c.version === APP_VERSION, can = vOk && c.status === 'waiting' && c.players < 2;
			return <button class={'lb-room' + (can ? '' : ' off')} onClick={() => can ? done({ room: c }) : toast(!vOk ? `앱 버전이 달라요 (방 v${c.version} · 나 v${APP_VERSION})` : c.status === 'battle' ? '대전 중인 방이에요' : '방이 꽉 찼어요')}>
				<TrainerImg sprite={c.sprite} />
				<span class="lb-body">
					<b>{c.locked && <i class="lb-lock" aria-label="비밀번호 방">🔒</i>}{c.title}</b>
					<span class="lb-host">{c.host}{splitSprite(c.sprite)[1] && <TitleChip it={itemById(splitSprite(c.sprite)[1])} />}</span>
					<span class="lb-tags"><em>{fmtKo(c.doubles, c.pick)}</em><em>{ruleName(c.ruleId)}</em>{!vOk && <em class="warn">v{c.version}</em>}</span>
				</span>
				<span class={'lb-status ' + (c.status === 'battle' ? 'inbattle' : c.players >= 2 ? 'full' : 'wait')}>{statusKo(c)}<small>{c.players}/2</small></span>
			</button>;
		})}</div>
	</Screen>;
}

/** 규칙 고르기: 내 설정의 규칙 · 포켓몬 풀별 기본 규칙 (+ 초전설·환상 가능/불가) */
function RulePicker({ cur, onPick, onClose }: { cur: string; onPick: (id: string) => void; onClose: () => void }) {
	const mine = loadSettings().battleRule;
	const [leg, setLeg] = useState<'no' | 'yes'>(ruleById(cur).restricted === 'yes' ? 'yes' : 'no');
	const opts = [{ id: mine, name: '내 설정의 규칙', desc: ruleName(mine) }, ...POOLS.map(p => {
		const l = p.legends ? p.legends[0] : leg;
		const id = makeRuleId(p.gimmick, p.id, l, l);
		return { id, name: p.name, desc: ruleName(id) };
	})];
	return <Modal title="방 규칙" onClose={onClose}>
		<div class="seg lr-leg"><span>초전설·환상</span>{(['no', 'yes'] as const).map(v => <button class={leg === v ? 'on' : ''} onClick={() => setLeg(v)}>{v === 'yes' ? '가능' : '불가'}</button>)}</div>
		<div class="lr-rules">{opts.map(o => <button class={'lr-rule-opt' + (ruleById(o.id).id === ruleById(cur).id ? ' on' : '')} onClick={() => onPick(o.id)}><b>{o.name}</b><small>{o.desc}</small></button>)}</div>
	</Modal>;
}
const FMTS: Fmt[] = [{ doubles: false, pick: 3 }, { doubles: true, pick: 4 }, { doubles: false, pick: 6 }, { doubles: true, pick: 6 }];
type CreateOpts = { title: string; pw: string; ruleId: string; doubles: boolean; pick: number };
function CreateRoom({ done }: { done: (o: CreateOpts | typeof BACK) => void }) {
	const [title, setTitle] = useState(`${playerName()}의 방`);
	const [locked, setLocked] = useState(false);
	const [pw, setPw] = useState('');
	const [fmt, setFmt] = useState(FMTS[0]);
	const [rid, setRid] = useState(loadSettings().battleRule);
	const [pick, setPick] = useState(false);
	const ok = title.trim() && (!locked || pw.length >= 2);
	return <Screen title="방 만들기" onBack={() => done(BACK)} cls="wide-scr lobby-scr">
		<div class="lc-form">
			<label class="lc-row"><span>방 제목</span><input value={title} maxLength={24} onInput={(e: any) => setTitle(e.currentTarget.value)} /></label>
			<div class="lc-row"><span>공개</span><div class="seg"><button class={!locked ? 'on' : ''} onClick={() => setLocked(false)}>공개 방</button><button class={locked ? 'on' : ''} onClick={() => setLocked(true)}>🔒 비밀번호 방</button></div></div>
			{locked && <label class="lc-row"><span>비밀번호</span><input value={pw} maxLength={16} placeholder="2자 이상" onInput={(e: any) => setPw(e.currentTarget.value)} /></label>}
			<div class="lc-row"><span>형식</span><div class="seg wrap">{FMTS.map(f => <button class={f === fmt ? 'on' : ''} onClick={() => setFmt(f)}>{fmtKo(f.doubles, f.pick)}</button>)}</div></div>
			<div class="lc-row"><span>규칙</span><button class="btn lc-rule" onClick={() => setPick(true)}>{ruleName(rid)} <small>바꾸기</small></button></div>
			<p class="hint">방은 로비 목록에 보여요. 규칙과 형식은 방에 들어간 뒤에도 바꿀 수 있어요.</p>
			<button class="btn big primary" disabled={!ok} onClick={() => done({ title: title.trim(), pw: locked ? pw : '', ruleId: rid, doubles: fmt.doubles, pick: fmt.pick })}>방 만들기</button>
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
		room.handlers.room = info => { box.info = info; box.emit(); };
		room.handlers.preview = pv => finish({ preview: pv });
		room.handlers.start = st => finish({ start: st });
		room.handlers.error = msg => finish({ error: msg });
		ask<void>(() => <RoomView box={box} act={finish} />).catch(() => finish({ leave: true }));
	});
}
function PlayerSlot({ info, sd, me }: { info: RoomInfo; sd: 'p1' | 'p2'; me: boolean }) {
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
	const me = info.side || 'p2', host = me === 'p1';
	const myReady = !!info.ready?.[me];
	const picking = !!(info.ready?.p1 && info.ready?.p2);
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
					<span><em>{fmtKo(info.doubles, info.pick)}</em> {ruleName(info.ruleId)}</span>
					{host && <button class="btn small" disabled={picking} onClick={() => setRules(true)}>규칙 바꾸기</button>}
				</div>
				<div class="lr-players"><PlayerSlot info={info} sd="p1" me={me === 'p1'} /><span class="lr-vs">VS</span><PlayerSlot info={info} sd="p2" me={me === 'p2'} /></div>
				<div class="lr-team">
					<span class="lr-team-l">내 파티</span>
					{box.team ? <span class="lr-icons">{box.team.map(p => <PokeIcon species={p.species} />)}</span> : <span class="muted small">아직 고르지 않았어요</span>}
					<button class={'btn small' + (box.team ? '' : ' primary')} disabled={picking} onClick={() => act({ team: true })}>{box.team ? '파티 바꾸기' : '파티 고르기'}</button>
				</div>
				{issues.length > 0 && <p class="lr-warn">이 방 규칙에서 쓸 수 없어요: {issues.join(' · ')}<small>파티를 바꾸거나 방장이 규칙을 바꿔야 준비할 수 있어요.</small></p>}
				{!info.players.p2 && box.team && !issues.length && <button class="btn lr-practice" onClick={() => act({ practice: true })}>기다리는 동안 AI와 연습<small>상대가 들어오면 알려 줘요</small></button>}
				<p class="hint lr-hint">팀은 방 규칙에 맞게 골라 주세요. 둘 다 「준비 완료」를 누르면 서로 엔트리를 보고 참가 포켓몬을 골라요.</p>
			</div>
			<div class="lr-chat">
				<div class="lr-log" ref={logRef}>{box.chat.map(c => c.side ? <p class={'lr-msg ' + (c.name === info.players[me] ? 'mine' : 'theirs')}><b>{c.name}</b>{c.text}</p> : <p class="lr-msg sys">{c.text}</p>)}
					{!box.chat.length && <p class="lr-msg sys">채팅으로 인사해 보세요!</p>}</div>
				<div class="lr-input"><input value={text} maxLength={120} placeholder="메시지 보내기" onInput={(e: any) => setText(e.currentTarget.value)} onKeyDown={(e: any) => { if (e.key === 'Enter') send(); }} />
					<button class="btn small" disabled={!text.trim()} onClick={send}>보내기</button></div>
			</div>
		</div>
		<div class="lr-bottom">
			<button class={'btn big ' + (myReady ? 'ghost' : 'primary')} disabled={!box.team || picking || issues.length > 0} onClick={() => box.room.send({ t: 'ready', on: !myReady })}>{myReady ? (picking ? '곧 시작해요…' : '준비 취소') : '준비 완료'}</button>
			<button class="btn big ghost" onClick={() => act({ leave: true })}>나가기</button>
		</div>
		{rules && <RuleAndFmt info={info} onDone={(rid, f) => { setRules(false); if (rid) box.room.send({ t: 'rules', ruleId: rid, doubles: f!.doubles, pick: f!.pick }); }} />}
	</Screen>;
}
function RuleAndFmt({ info, onDone }: { info: RoomInfo; onDone: (rid?: string, f?: Fmt) => void }) {
	const [fmt, setFmt] = useState(FMTS.find(f => f.doubles === info.doubles && f.pick === (info.pick || 6)) || FMTS[0]);
	const [rid, setRid] = useState(info.ruleId);
	const [pick, setPick] = useState(false);
	if (pick) return <RulePicker cur={rid} onPick={id => { setRid(id); setPick(false); }} onClose={() => setPick(false)} />;
	return <Modal title="규칙·형식 바꾸기" onClose={() => onDone()}>
		<div class="lc-form">
			<div class="lc-row"><span>형식</span><div class="seg wrap">{FMTS.map(f => <button class={f === fmt ? 'on' : ''} onClick={() => setFmt(f)}>{fmtKo(f.doubles, f.pick)}</button>)}</div></div>
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
		if ('error' in a) { room.close(); toast(a.error); return; }
		if ('team' in a) {
			if (box.info?.side && box.info.ready?.[box.info.side]) room.send({ t: 'ready', on: false });   // 고르는 동안 시작되지 않게
			const team = await chooseRoomTeam(box.info?.ruleId || loadSettings().battleRule);
			if (team !== BACK) { box.team = withLevel(team, LEVEL); room.send({ t: 'team', team: box.team }); }
			continue;
		}
		if ('rules' in a) continue;
		if ('practice' in a) { if (await practice(room, box) === 'closed') return; continue; }
		let w: WaitResult = 'start' in a ? { start: a.start } : { preview: a.preview };
		let sent = false;
		while ('preview' in w) { sent = sent || w.preview.picked; lastPreview = w.preview; w = await pickPhase(room, w.preview, '친구 대전', sent, () => { sent = true; }, true); }
		if ('error' in w) { room.close(); toast(w.error); return; }
		if ('cancel' in w) { room.send({ t: 'leave' }); room.close(); return; }
		if ('back' in w) continue;
		if ('start' in w) {
			const r = await play(room, w.start, '친구 대전', true);
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
	room.connect({ name: playerName(), sprite: spriteWithTitle(), pw, ...(create ? { create, ruleId: create.ruleId, doubles: create.doubles, pick: create.pick } : {}) } as any);
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
		lines={[`형식: ${fmtKo(info.doubles, info.pick || 6)}`, `규칙: ${ruleName(info.ruleId)}`, '이 규칙에 맞는 팀으로 들어가 주세요. 둘 다 들어오면 서로 전체 엔트리를 보고 참가 포켓몬을 골라요.']}
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
