/** 시나리오 모드 (시안, 개발자 빌드): 관동 앞부분 — 스타팅 고르기 → 라이벌 → 상록숲 → 회색 체육관 → 달맞이산 로켓단
 *  - 월드 화면(듀얼 링크스식): 아래 탭으로 구역 이동, 구역 배경(scripts/gen-fields.py) 위에 선 인물을 눌러 대화·배틀
 *  - 스테이지: 구역의 미션(인물 격파)을 모두 하면 다음 구역이 열림
 *  - 포켓몬: 풀숲에서 3마리 중 하나 영입, 이기면 레벨 +2 (구역별 상한), 레벨이 되면 진화·레벨업 기술 (gen/levelup.json)
 *  - 초상화: 사용자가 준 상반신 그림(scripts/make-portraits.py → Pages /portraits/), 없으면 도트 그림
 *  저장: localStorage pkbkr:scenario-kanto */
import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { ask, Screen, Sprite, PokeIcon, TypeBadge, toast, confirmBox } from './ui/core';
import { battle, playerName, playerSprite, BACK } from './modes';
import { load, save, remove } from './store';
import { speciesData, speciesKo, moveKo, toID } from './data';
import { SPRITE_URL, trainerImgError } from './trainer-lines';
import type { PSet } from './sets';
import LEVELUP from './gen/levelup.json';

const LU = LEVELUP as unknown as { [id: string]: { e?: [string, number]; m: [number, string][] } };
const PORTRAIT_BASE = 'https://samang600.github.io/BattleSim-KR/portraits/';
const KEY = 'scenario-kanto';
const NO_GIMMICK = '_one.natdex.yes.yes';

// ───────── 포켓몬 ─────────
interface Mon { sp: string; lv: number; /** 기술은 이 레벨까지 배운 것만 (첫 라이벌전: 원작처럼 기본 기술만) */ mlv?: number }
const movesAt = (sp: string, lv: number) => { const all = (LU[sp]?.m || []).filter(m => m[0] <= lv).map(m => m[1]); return [...new Set(all)].slice(-4); };
function toSet(m: Mon): PSet {
	const s = speciesData(m.sp, 9)!;
	const moves = movesAt(m.sp, m.mlv ?? m.lv);
	return { name: '', species: (s as any).en || m.sp, item: '', ability: (s as any).ab?.[0] || '', moves: moves.length ? moves : ['tackle'], nature: 'serious',
		evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: m.lv };
}
/** 레벨을 올리고 진화시킴 → 바뀐 점 안내 줄 */
function gain(m: Mon, n: number, cap: number): string[] {
	const out: string[] = [];
	const before = m.lv, oldMoves = movesAt(m.sp, m.lv);
	m.lv = Math.min(cap, m.lv + n);
	if (m.lv > before) out.push(`${speciesKo(m.sp)} Lv${before} → Lv${m.lv}`);
	for (let e = LU[m.sp]?.e; e && m.lv >= e[1]; e = LU[m.sp]?.e) { out.push(`${speciesKo(m.sp)}${'은(는)'} ${speciesKo(e[0])}(으)로 진화했다!`); m.sp = e[0]; }
	const learned = movesAt(m.sp, m.lv).filter(x => !oldMoves.includes(x));
	if (learned.length) out.push(`${speciesKo(m.sp)}: 새 기술 ${learned.map(moveKo).join(' · ')}`);
	return out;
}

// ───────── 구역·인물 ─────────
interface Npc {
	id: string; name: string; /** 도트 그림(쇼다운 트레이너) · 초상화 id */ sprite: string; portrait: string; x: number;
	/** 이 인물들을 먼저 끝내야 나옴 */ need?: string[];
	kind: 'battle' | 'talk' | 'grass' | 'starter';
	team?: [string, number][]; skill?: number; music?: string; bg?: string; title?: string;
	before?: string[]; after?: string[]; again?: string[];
	/** 풀숲: 나오는 포켓몬 [id, 최저 레벨, 최고 레벨] · 영입 횟수 */ pool?: [string, number, number][]; times?: number;
	/** 이기면 오르는 레벨 (기본 2) */ exp?: number; badge?: string;
}
interface Area { id: string; name: string; bg: string; cap: number; mission: string; npcs: Npc[] }
const AREAS: Area[] = [
	{ id: 'pallet', name: '태초마을', bg: 'pallet', cap: 8, mission: '오박사에게 포켓몬을 받고 라이벌 그린과 승부', npcs: [
		{ id: 'oak', name: '오박사', sprite: 'oak', portrait: 'professoroak', x: 70, kind: 'starter',
			before: ['오오, 왔구나! 포켓몬의 세계에 잘 왔단다.', '여기 포켓몬이 세 마리 있지. 네가 함께 여행할 한 마리를 골라 보렴!'],
			again: ['포켓몬과 함께라면 어디든 갈 수 있단다. 도감도 잊지 말고 채워 주렴!'] },
		{ id: 'rival1', name: '그린', title: '라이벌', sprite: 'blue', portrait: 'blueoak', x: 30, kind: 'battle', need: ['oak'], skill: 0.2, music: 'g3rival', bg: 'field',
			before: ['이봐! 할아버지한테 포켓몬을 받았다며?', '나도 받았지. 누구 포켓몬이 더 센지 지금 바로 겨뤄 보자고!'],
			after: ['칫… 뭐, 처음이니까 봐준 거야!', '나는 먼저 간다. 포켓몬리그에서 기다리라고!'], again: ['아직도 여기 있어? 난 벌써 저만치 앞서 있다고!'] },
	] },
	{ id: 'route', name: '상록숲', bg: 'forest', cap: 11, mission: '풀숲에서 동료를 찾고 숲의 트레이너 2명 격파', npcs: [
		{ id: 'grass1', name: '풀숲', sprite: '', portrait: '', x: 18, kind: 'grass', times: 2, pool: [['pidgey', 3, 5], ['rattata', 3, 5], ['caterpie', 3, 5], ['weedle', 3, 5], ['pikachu', 4, 5], ['nidoranf', 4, 5], ['nidoranm', 4, 5], ['mankey', 4, 5]] },
		{ id: 'bug1', name: '곤충채집소년 민수', sprite: 'bugcatcher', portrait: 'bugcatcher', x: 46, kind: 'battle', skill: 0.15, bg: 'field',
			team: [['weedle', 6], ['caterpie', 6]], before: ['숲은 벌레 포켓몬의 천국이야! 내 벌레들을 보여 줄게!'], after: ['으앗, 내 벌레들이…!'], again: ['벌레도 키우면 강해진다고!'] },
		{ id: 'bug2', name: '곤충채집소년 도윤', sprite: 'bugcatcher', portrait: 'bugcatcher', x: 76, kind: 'battle', need: ['bug1'], skill: 0.2, bg: 'field',
			team: [['metapod', 7], ['kakuna', 7], ['caterpie', 8]], before: ['단단해지기만 한다고 얕보지 마!'], after: ['회색시티 체육관은 바위 타입이야. 조심해!'], again: ['웅 관장님은 정말 단단하다니까.'] },
	] },
	{ id: 'pewter', name: '회색시티', bg: 'pewter', cap: 14, mission: '회색 체육관 관장 웅을 이기고 회색배지 얻기', npcs: [
		{ id: 'camper', name: '캠핑보이 준호', sprite: 'camper', portrait: 'backpacker', x: 28, kind: 'battle', skill: 0.3, bg: 'gym', music: 'g3gym',
			team: [['geodude', 10], ['sandshrew', 11]], before: ['잠깐! 웅 관장님께 도전하려면 나부터 이겨야지!'], after: ['빠르군… 관장님께는 10000광년 이르다고 하려 했는데!'], again: ['관장님은 저 안에 계셔.'] },
		{ id: 'brock', name: '웅', title: '회색 체육관 관장', sprite: 'brock', portrait: 'brock', x: 62, kind: 'battle', need: ['camper'], skill: 0.55, bg: 'gym', music: 'g3gym', exp: 3, badge: '회색배지',
			team: [['geodude', 12], ['onix', 14]], before: ['나는 회색 체육관 관장 웅!', '내 바위처럼 단단한 의지는 포켓몬에게도 깃들어 있다. 바위 타입의 굳건함을 보여 주마!'],
			after: ['너를 얕봤던 것 같군. 내 패배다.', '포켓몬리그 공인 회색배지를 받아라!'], again: ['세상에는 더 강한 트레이너가 많다. 계속 나아가라!'] },
	] },
	{ id: 'mtmoon', name: '달맞이산', bg: 'mtmoon', cap: 18, mission: '달맞이산에서 화석을 노리는 로켓단 물리치기', npcs: [
		{ id: 'grass2', name: '동굴 그늘', sprite: '', portrait: '', x: 12, kind: 'grass', times: 2, pool: [['zubat', 8, 10], ['geodude', 8, 10], ['paras', 9, 10], ['clefairy', 9, 11], ['sandshrew', 9, 11]] },
		{ id: 'lass', name: '짧은치마 유나', sprite: 'lass', portrait: 'lass', x: 32, kind: 'battle', skill: 0.3, bg: 'cave',
			team: [['oddish', 11], ['bellsprout', 11]], before: ['어머, 눈이 마주쳤네? 그럼 승부야!'], after: ['달맞이산 안쪽에 수상한 사람들이 있었어…'], again: ['검은 옷 입은 사람들 조심해!'] },
		{ id: 'hiker', name: '등산가 대산', sprite: 'hiker', portrait: 'hiker', x: 52, kind: 'battle', skill: 0.3, bg: 'cave',
			team: [['geodude', 10], ['geodude', 10], ['onix', 12]], before: ['허허! 산에서 만난 것도 인연이지. 한판 하세!'], after: ['이 산에는 달의돌과 화석이 잠들어 있다네.'], again: ['산은 언제나 거기 있지!'] },
		{ id: 'rocket1', name: '로켓단 조무래기', title: '로켓단', sprite: 'rocketgrunt', portrait: 'teamrocketgrunt', x: 72, kind: 'battle', need: ['lass', 'hiker'], skill: 0.4, bg: 'cave', music: 'g3evil',
			team: [['rattata', 13], ['zubat', 13]], before: ['뭐야, 꼬마가 여긴 왜 왔어? 우리 로켓단은 화석을 찾느라 바쁘다고!', '방해할 거면 혼쭐을 내 주지!'],
			after: ['으윽… 로켓단을 적으로 돌리면 후회할 거다!'], again: ['보스께 다 이를 거야…!'] },
		{ id: 'nerd', name: '이과계의 남자 준기', sprite: 'supernerd', portrait: 'supernerd', x: 90, kind: 'battle', need: ['rocket1'], skill: 0.45, bg: 'cave', exp: 3,
			team: [['grimer', 12], ['voltorb', 12], ['koffing', 12]], before: ['거기 서! 이 화석은 내가 찾은 거야! 둘 다 내 거라고!'],
			after: ['알았어, 나눠 갖자… 화석 하나는 네가 가져가.', '(시안은 여기까지예요. 다음은 블루시티의 이슬!)'], again: ['화석을 되살리는 연구소가 어딘가 있다던데…'] },
	] },
];
const STARTERS: [string, string][] = [['bulbasaur', '풀 타입 · 처음 두 체육관에 유리해요'], ['charmander', '불꽃 타입 · 초반이 조금 험해요'], ['squirtle', '물 타입 · 바위 체육관에 강해요']];
const RIVAL_OF: { [k: string]: string } = { bulbasaur: 'charmander', charmander: 'squirtle', squirtle: 'bulbasaur' };

// ───────── 저장 ─────────
interface Run { starter: string; party: Mon[]; box: Mon[]; done: { [id: string]: number }; area: number; badges: string[] }
const newRun = (): Run => ({ starter: '', party: [], box: [], done: {}, area: 0, badges: [] });
const stageOf = (r: Run) => { let s = 0; while (s < AREAS.length - 1 && AREAS[s].npcs.filter(n => n.kind !== 'grass').every(n => r.done[n.id])) s++; return s; };
const available = (r: Run, n: Npc) => (n.need || []).every(x => r.done[x]) && (n.kind === 'starter' || !!r.starter);

// ───────── 화면 ─────────
/** 초상화: 상반신 그림(없으면 도트 그림). face = 동그란 아이콘용(얼굴 쪽만 보이게) */
function Portrait({ id, sprite, cls = '' }: { id: string; sprite: string; cls?: string }) {
	const [bad, setBad] = useState(false);
	if (!id || bad) return <img class={'sc-portrait dot ' + cls} src={SPRITE_URL(sprite || 'unknown')} onError={trainerImgError} alt="" />;
	return <img class={'sc-portrait ' + cls} src={`${PORTRAIT_BASE}${id}.webp`} onError={() => setBad(true)} alt="" />;
}
/** 대화 장면 (story-mode-test 의 배치): 배경 + 가운데 큰 초상 + 이름 띠 + 흰 대화창 (한 글자씩, 누르면 넘김) + 건너뛰기 */
function talk(npc: { name: string; title?: string; portrait: string; sprite: string }, lines: string[], bg: string): Promise<void> {
	if (!lines.length) return Promise.resolve();
	return ask<void>(r => <Dialog npc={npc} lines={lines} bg={bg} done={r} />);
}
function Dialog({ npc, lines, bg, done }: { npc: { name: string; title?: string; portrait: string; sprite: string }; lines: string[]; bg: string; done: () => void }) {
	const [i, setI] = useState(0);
	const [n, setN] = useState(0);
	const line = lines[i];
	const full = n >= line.length;
	useEffect(() => { setN(0); }, [i]);
	useEffect(() => { if (full) return; const t = setTimeout(() => setN(x => Math.min(line.length, x + 2)), 30); return () => clearTimeout(t); }, [n, i]);
	const next = () => { if (!full) { setN(line.length); return; } if (i + 1 < lines.length) setI(i + 1); else done(); };
	return <div class="story-talk" onClick={next}>
		<div class={'st-bg sc-bg fld-' + bg} />
		<div class="st-portrait sc-stp"><Portrait id={npc.portrait} sprite={npc.sprite} cls="big" /></div>
		<div class="st-box">
			<div class="st-name"><span>{npc.name}{npc.title && <small> {npc.title}</small>}</span><i class="st-deco" /></div>
			<div class="st-text">{line.slice(0, n)}{full && <span class="st-arrow">▼</span>}</div>
		</div>
		<button class="st-skip" onClick={e => { e.stopPropagation(); done(); }}>건너뛰기 ▶▶</button>
	</div>;
}
type Act = { npc: Npc } | { area: number } | { party: true } | { reset: true } | typeof BACK;
const NPC_Y = [36, 50, 42, 56, 46];
/** 거점 화면 (story-mode-test 의 배치): 구역 배경 가득 + 동그란 인물 아이콘(이름표·마름모 표시) + 오른쪽 아래 내 트레이너 + 아래 구역 탭 */
function World({ run, done }: { run: Run; done: (a: Act) => void }) {
	const stage = stageOf(run);
	const area = AREAS[run.area];
	const todo = area.npcs.filter(n => n.kind !== 'grass');
	const cleared = todo.filter(n => run.done[n.id]).length;
	return <div class="story-hub sc-hub">
		<div class={'sh-bg sc-bg fld-' + area.bg} />
		<div class="sh-top">
			<button class="st-exit" onClick={() => done(BACK)}>◀ 나가기</button>
			<div class="sh-stage"><small>스테이지</small><b>{run.area + 1}</b></div>
			<div class="sh-title">관동 · {area.name}<small> · 시안</small><em class="sc-mission">{cleared < todo.length ? area.mission : '이 구역의 미션을 모두 끝냈어요!'}</em></div>
			{run.badges.length > 0 && <span class="sc-badges">🏅{run.badges.length}</span>}
		</div>
		{area.npcs.filter(n => available(run, n)).map((n, i) => {
			const used = run.done[n.id] || 0, isGrass = n.kind === 'grass';
			const over = isGrass ? used >= (n.times || 1) : !!used;
			return <button class={'sh-npc' + (over ? ' done' : '') + (isGrass ? ' grass' : '')} style={{ left: (12 + n.x * 0.76) + '%', top: NPC_Y[i % NPC_Y.length] + '%' }} onClick={() => done({ npc: n })}>
				<span class="sh-face">{isGrass ? <span class="sc-grass" /> : <Portrait id={n.portrait} sprite={n.sprite} cls="face" />}</span>
				<span class="sh-mark">{over ? '✓' : isGrass ? String((n.times || 1) - used) : n.kind === 'battle' ? '!' : '…'}</span>
				<span class="sh-label">{n.name}</span>
			</button>;
		})}
		<div class="sh-me sc-me2" role="button" onClick={() => done({ party: true })}>
			<img src={SPRITE_URL(playerSprite())} alt="" onError={trainerImgError} />
			<div class="sh-me-bar"><b>{playerName()}</b><small>클리어 {cleared}/{todo.length} · 상한 Lv{area.cap}</small>
				<span class="sc-party2">{run.party.length ? run.party.map(m => <span class="sc-pmon"><PokeIcon species={m.sp} /><small>Lv{m.lv}</small></span>) : <small>포켓몬 없음</small>}</span></div>
		</div>
		<div class="sc-tabs2">{AREAS.map((a, i) => <button class={(i === run.area ? 'on' : '') + (i > stage ? ' locked' : '')} disabled={i > stage} onClick={() => done({ area: i })}>{i > stage ? '🔒 ' : ''}{a.name}</button>)}
			<button class="sc-reset" onClick={() => done({ reset: true })}>처음부터</button></div>
	</div>;
}
function MonCard({ m, children }: { m: Mon; children?: any }) {
	const s = speciesData(m.sp, 9) as any;
	return <div class="sc-mon">
		<Sprite species={m.sp} gen={9} size={64} anim={false} />
		<div class="sc-mon-body"><b>{speciesKo(m.sp)} <small>Lv{m.lv}</small></b>
			<span class="sc-types">{(s?.t || []).map((t: string) => <TypeBadge type={t} />)}</span>
			<small>{movesAt(m.sp, m.lv).map(moveKo).join(' · ') || '몸통박치기'}</small></div>
		<div class="sc-mon-btns">{children}</div>
	</div>;
}
function PartyScreen({ run, done }: { run: Run; done: () => void }) {
	const [, tick] = useState(0);
	const re = () => { save(KEY, run); tick(x => x + 1); };
	return <Screen title="파티·박스" onBack={done} cls="sc-scr">
		<h3 class="sec">파티 <small class="muted">{run.party.length}/6 · 맨 위가 선두</small></h3>
		{run.party.map((m, i) => <MonCard m={m}>
			{i > 0 && <button class="btn small" onClick={() => { run.party.splice(i, 1); run.party.unshift(m); re(); }}>선두로</button>}
			{run.party.length > 1 && <button class="btn small ghost" onClick={() => { run.party.splice(i, 1); run.box.push(m); re(); }}>박스로</button>}
		</MonCard>)}
		{run.box.length > 0 && <h3 class="sec">박스 <small class="muted">{run.box.length}</small></h3>}
		{run.box.map((m, i) => <MonCard m={m}>
			<button class="btn small" disabled={run.party.length >= 6} onClick={() => { run.box.splice(i, 1); run.party.push(m); re(); }}>파티로</button>
		</MonCard>)}
		<button class="btn big" onClick={done}>돌아가기</button>
	</Screen>;
}
/** 3마리 중 하나 고르기 (스타팅·풀숲) */
function PickMon({ title, hint, opts, done, skip }: { title: string; hint: string; opts: { m: Mon; note?: string }[]; done: (i: number | null) => void; skip?: string }) {
	return <Screen title={title} onBack={() => done(null)} cls="sc-scr">
		<p class="hint">{hint}</p>
		<div class="sc-pick">{opts.map((o, i) => <button class="sc-pick-card" onClick={() => done(i)}>
			<Sprite species={o.m.sp} gen={9} size={96} anim={false} />
			<b>{speciesKo(o.m.sp)}</b><small>Lv{o.m.lv}</small>
			<span class="sc-types">{((speciesData(o.m.sp, 9) as any)?.t || []).map((t: string) => <TypeBadge type={t} />)}</span>
			{o.note && <em>{o.note}</em>}
		</button>)}</div>
		{skip && <button class="btn ghost" onClick={() => done(null)}>{skip}</button>}
	</Screen>;
}
function Lines({ title, heading, lines, done }: { title: string; heading: string; lines: string[]; done: () => void }) {
	return <Screen title={title} cls="sc-scr">
		<div class="sc-result"><h2>{heading}</h2>{lines.map(l => <p>{l}</p>)}</div>
		<button class="btn big primary" onClick={done}>확인</button>
	</Screen>;
}

// ───────── 진행 ─────────
export async function runScenario() {
	const run: Run = { ...newRun(), ...load<Partial<Run>>(KEY, {}) };
	const persist = () => save(KEY, run);
	run.area = Math.min(run.area, stageOf(run));
	while (true) {
		const a = await ask<Act>(r => <World run={run} done={r} />);
		if (a === BACK) return;
		if ('area' in a) { run.area = a.area; persist(); continue; }
		if ('party' in a) { if (run.party.length) await ask<void>(r => <PartyScreen run={run} done={r} />); continue; }
		if ('reset' in a) { if (await confirmBox('처음부터', '이 시나리오의 진행(포켓몬·배지)을 모두 지우고 처음부터 할까요?', '지우기')) { remove(KEY); Object.assign(run, newRun()); } continue; }
		const n = a.npc, area = AREAS[run.area];
		if (n.kind === 'starter') {
			if (run.done[n.id]) { await talk(n, n.again || [], area.bg); continue; }
			await talk(n, n.before || [], area.bg);
			const i = await ask<number | null>(r => <PickMon title="처음 포켓몬" hint="함께 여행할 포켓몬을 한 마리 골라 주세요." opts={STARTERS.map(([sp, note]) => ({ m: { sp, lv: 5 }, note }))} done={r} />);
			if (i === null) continue;
			run.starter = STARTERS[i][0]; run.party = [{ sp: run.starter, lv: 5 }]; run.done[n.id] = 1; persist();
			await talk(n, [`${speciesKo(run.starter)}(이)구나! 아주 좋은 선택이란다.`, '저기 내 손자 그린이 기다리고 있구나. 한번 겨뤄 보렴!'], area.bg);
			continue;
		}
		if (n.kind === 'grass') {
			if ((run.done[n.id] || 0) >= (n.times || 1)) { toast('여기서는 더 찾을 포켓몬이 없어요'); continue; }
			const pool = [...(n.pool || [])].sort(() => Math.random() - 0.5).slice(0, 3);
			const opts = pool.map(([sp, lo, hi]) => ({ m: { sp, lv: lo + Math.floor(Math.random() * (hi - lo + 1)) } }));
			const i = await ask<number | null>(r => <PickMon title={n.name} hint="야생 포켓몬이 나타났어요! 동료로 맞이할 한 마리를 골라 주세요." opts={opts} done={r} skip="그냥 지나가기" />);
			if (i === null) continue;
			const m = opts[i].m;
			(run.party.length < 6 ? run.party : run.box).push(m); run.done[n.id] = (run.done[n.id] || 0) + 1; persist();
			toast(`${speciesKo(m.sp)}${run.party.includes(m) ? '(이)가 동료가 되었다!' : '(을)를 박스로 보냈다'}`);
			continue;
		}
		// 배틀
		if (run.done[n.id]) { await talk(n, n.again || ['…'], area.bg); continue; }
		await talk(n, n.before || [], area.bg);
		const team: Mon[] = n.id === 'rival1' ? [{ sp: RIVAL_OF[run.starter] || 'squirtle', lv: 5, mlv: 1 }] : (n.team || []).map(([sp, lv]) => ({ sp, lv }));
		const res = await battle({
			gen: 9, doubles: false, aiSkill: n.skill ?? 0.3, bg: n.bg || 'field', music: n.music || 'battle', label: `시나리오 · ${area.name}`, noRecord: true, ruleId: NO_GIMMICK,
			p1: { name: playerName(), team: run.party.map(toSet), sprite: playerSprite() },
			p2: { name: n.name, title: n.title || '', team: team.map(toSet), sprite: n.sprite, line: (n.before || [])[0] },
		} as any);
		if (!res.win) { await talk(n, ['한 번 더 단련하고 다시 오라고!'], area.bg); continue; }
		run.done[n.id] = 1;
		const notes: string[] = [];
		for (const m of run.party) notes.push(...gain(m, n.exp ?? 2, area.cap));
		if (n.badge) { run.badges.push(n.badge); notes.unshift(`🏅 ${n.badge}를 손에 넣었다!`); }
		const before = run.area;
		persist();
		await talk(n, n.after || [], area.bg);
		const st = stageOf(run);
		if (st > before && AREAS[before].npcs.filter(x => x.kind !== 'grass').every(x => run.done[x.id])) notes.push(`▶ 새 구역 「${AREAS[st].name}」이 열렸다!`);
		await ask<void>(r => <Lines title={area.name} heading={`${n.name}에게 이겼다!`} lines={notes.length ? notes : ['파티의 레벨이 이 구역의 상한에 닿았어요.']} done={r} />);
	}
}
void toID;
