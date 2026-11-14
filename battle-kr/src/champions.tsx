/** 챔피언스 모드 (개발자 빌드) — 빈손으로 시작해 스카우트하고 키워서 챔피언급까지.
 *  값·이야기·규칙 순환은 champions-data.ts. 재화는 시뮬레이터 모드와 같은 BP (rewards.ts).
 *  화면은 '무엇을 눌렀는지'만 돌려주고, 진행은 아래의 흐름 함수(…Flow)가 맡는다. */
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { ask, Screen, Sprite, PokeIcon, ItemIcon, TypeBadge, toast, confirmBox } from './ui/core';
import { PickScreen, ChoiceScreen, MonDetail } from './ui/screens';
import { battle, playerName, playerSprite, towerOpponent, BACK } from './modes';
import { randomTeam, randomSetFor, speciesPool, factoryTeam, cloneSet, rng, spOf, spToEv, SP_MAX, SP_TOTAL, STAT_KEYS, FACTORY_TIERS, type PSet } from './sets';
import { randomTrainer } from './trainers';
import { SPRITE_URL, trainerImgError } from './trainer-lines';
import { load, save, loadSettings } from './store';
import { loadWallet, earnBP, spendBP, onWallet } from './rewards';
import { ruleById, applyRuleData, teamRuleIssues, speciesAllowed } from './rules';
import { speciesKo, speciesData, moveKo, abilityKo, itemKo, itemDesc, natureKo, typeKo, learnset, megaStonesFor, toID, ALL_TYPES } from './data';
import { playMusic, sfx } from './sound';
import { PRICE, EARN, TIERS, CHAPTERS, CWHO, RENTAL, FIRST_FIXED, START_ITEMS, SHOP, NATURES, rotationOf, hoursLeft, type BattleKind } from './champions-data';

// ───────── 저장 ─────────
interface CMon { id: number; set: PSet }
interface CSave {
	v: 1; /** 다음에 볼 장 (0 = 등록 전) */ ch: number; tier: number; pts: number;
	roster: CMon[]; /** 팀에 넣은 포켓몬 id (6마리까지) */ team: number[]; seq: number;
	items: { [id: string]: 1 }; tk: { regular: number; pick: number };
	/** 오늘의 소개 · 받은 날 · 다음 무료 스카우트 시각(ms) · 찜(3마리) · 찜이 안 나온 횟수 · 다음 소개에 많이 나올 타입 */
	lineup: PSet[]; lineDay: string; freeAt: number; wish: string[]; wishMiss: number; typeNext?: string;
	tower: number; factory: number;
	day: { id: string; win: number; scout: number; modes: { [k: string]: 1 }; got: { [k: string]: 1 } };
}
const KEY = 'champions';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const fresh = (): CSave => ({ v: 1, ch: 0, tier: 0, pts: 0, roster: [], team: [], seq: 1, items: Object.fromEntries(START_ITEMS.map(i => [i, 1])), tk: { regular: 0, pick: 0 },
	lineup: [], lineDay: '', freeAt: 0, wish: [], wishMiss: 0, tower: 0, factory: 0, day: { id: '', win: 0, scout: 0, modes: {}, got: {} } });
const persist = (S: CSave) => save(KEY, S);
const T = (S: CSave) => TIERS[Math.min(S.tier, TIERS.length - 1)];
const teamOf = (S: CSave) => S.team.map(id => S.roster.find(m => m.id === id)).filter(Boolean) as CMon[];
const dayOf = (S: CSave) => { if (S.day.id !== today()) S.day = { id: today(), win: 0, scout: 0, modes: {}, got: {} }; return S.day; };
/** 무료 스카우트: 12시간마다 한 마리 (일반 포켓몬). 남은 시간(시간 단위, 0 = 지금 가능) */
const FREE_MS = 12 * 36e5;
const freeLeft = (S: CSave) => Math.max(0, Math.ceil(((S.freeAt || 0) - Date.now()) / 36e5));
/** 그 규칙의 데이터 사양으로 잠깐 바꿔서 실행 (상대 팀·소개 포켓몬을 그 규칙에 맞게 만들기) */
function withRule<R>(rule: string, f: () => R): R { applyRuleData(ruleById(rule)); try { return f(); } finally { applyRuleData(ruleById(loadSettings().battleRule)); } }
const BASE_RULE = 'm_one.natdex.no.no.no';
/** 희귀도: 0 일반 · 1 준전설 · 2 초전설·환상 (스카우트 값 1·2·4배, 등급이 올라야 소개됨) */
const R_SUB = ruleById('m_one.natdex.no.no'), R_NONE = ruleById(BASE_RULE);
const rarity = (id: string) => speciesAllowed(R_NONE, id) ? 0 : speciesAllowed(R_SUB, id) ? 1 : 2;
const scoutCost = (id: string, pick = false) => (pick ? PRICE.pick : PRICE.scout) * [1, 2, 4][rarity(id)];
const RARE = ['', '준전설', '전설'];
const josa = (w: string, a: string, b: string) => { const c = w.charCodeAt(w.length - 1); return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b); };
const K = () => Math.random();
/** 전용 메뉴 음악 (music/gen3.py 의 champhub) */
const HUB_BGM = 'champhub';
/** 화면 전환: fade(검게 덮였다 열림) · blinds(가로 띠) · battle(번쩍 + 띠) — 시나리오 모드와 같은 도트 연출 */
function Fx({ kind, done }: { kind: string; done: () => void }) {
	useState(() => { setTimeout(done, kind === 'battle' ? 900 : 520); });
	return <div class={'sc-fx cp-fx sc-fx-' + kind}><div class="sc-fx-ov">{kind === 'blinds' && [0, 1, 2, 3, 4, 5, 6, 7].map(i => <i style={{ animationDelay: i * 40 + 'ms' }} />)}{kind === 'battle' && [0, 1, 2, 3, 4, 5].map(i => <i style={{ animationDelay: 260 + i * 50 + 'ms' }} />)}</div></div>;
}
const fx = (kind: 'fade' | 'blinds' | 'battle') => ask<void>(r => <Fx key={K()} kind={kind} done={r} />);
const pay = (n: number, why: string) => { if (!spendBP(n, why)) { toast(`BP 가 모자라요 (${n} BP 필요)`); return false; } return true; };

// ───────── 공용 조각 ─────────
/** 지금 가진 BP (바뀌면 다시 그림) */
function Bp() {
	const [bp, setBp] = useState(loadWallet().bp);
	useState(() => onWallet(w => setBp(w.bp)));
	return <span class="cp-chip">{bp} BP</span>;
}
function Top({ title, sub, S, onBack }: { title: string; sub?: string; S: CSave; onBack?: () => void }) {
	return <div class="cp-top">{onBack && <button class="cp-back" onClick={onBack} aria-label="뒤로">◀</button>}
		<b>{title}{sub && <small>{sub}</small>}</b>
		{S.tk.regular > 0 && <span class="cp-chip t">티켓 {S.tk.regular}</span>}{S.tk.pick > 0 && <span class="cp-chip t">지명 {S.tk.pick}</span>}<Bp /></div>;
}
const types = (sp: string) => ((speciesData(sp, 9) as any)?.t || []) as string[];
/** 포켓몬 카드 (소개·로스터) */
function MonCard({ set, cls = '', mark, sub, onClick }: { set: PSet; cls?: string; mark?: any; sub?: string; onClick?: () => void }) {
	return <button class={'cp-card ' + cls} onClick={onClick}>{mark}
		<span class="cp-card-spr"><Sprite species={set.species} gen={9} size={56} anim={false} cls="front" shiny={set.shiny} /></span>
		<span class="cp-card-body"><b>{speciesKo(set.species)}{rarity(toID(set.species)) > 0 && <i class="cp-rare">{RARE[rarity(toID(set.species))]}</i>}</b><span>{types(set.species).map(t => <TypeBadge type={t} small />)}</span>
			<small>{sub ?? `${natureKo(set.nature)} · ${abilityKo(set.ability)}`}</small></span></button>;
}
/** 대화 장면: 배틀 배경 그림 위에 트레이너 도트와 대화창. 누르면 다음 줄 */
function Talk({ lines, bg, card, done }: { lines: [string, string][]; bg: string; card?: [string, string]; done: () => void }) {
	const [i, setI] = useState(card ? -1 : 0);
	const next = () => { sfx('select'); if (i + 1 >= lines.length) done(); else setI(i + 1); };
	const [who, text] = i < 0 ? ['', ''] : lines[i], w = who ? CWHO[who] : null;
	return <div class={'cp-talk bg-' + bg} onClick={next}><div class="arena-bg" /><div class="cp-talk-dim" />
		<button class="cp-skip" onClick={e => { e.stopPropagation(); done(); }}>건너뛰기 ▶</button>
		{i < 0 ? <div class="cp-chapter"><small>{card![0]}</small><b>{card![1]}</b><em>화면을 누르면 시작</em></div> : <>
			{w && <img class="cp-talk-who" key={who} src={SPRITE_URL(w.sprite)} onError={trainerImgError} alt="" />}
			{w && <div class="cp-talk-name">{w.name} <small>{w.title}</small></div>}
			<div class={'cp-talk-box' + (w ? '' : ' narr')}>{text.replace(/\{me\}/g, playerName())}<i class="cp-talk-next">▼</i></div></>}
	</div>;
}
const talk = (lines: [string, string][], bg: string, card?: [string, string]) => ask<void>(r => <Talk key={K()} lines={lines} bg={bg} card={card} done={r} />);

// ───────── 배틀 ─────────
interface Opp { name: string; title?: string; sprite?: string; team: PSet[]; skill: number; line?: string; music?: string }
/** 엔트리를 고르고 한 판. 못 싸우면(규칙에 맞는 포켓몬 부족) null */
async function fight(S: CSave, mine: PSet[], opp: Opp, rot: { rule: string; doubles: boolean; pick: number; name: string }, label: string, bg: string): Promise<boolean | null> {
	const rule = ruleById(rot.rule);
	const bad = teamRuleIssues(rule, mine), ok = mine.filter(s => !bad.some(b => b.species === s.species));
	if (bad.length) toast(`이번 규칙(${rot.name})에 나갈 수 없음: ${[...new Set(bad.map(b => speciesKo(b.species) + (b.kind === 'item' ? `(${itemKo(b.item || '')})` : '')))].join(' · ')}`);
	if (ok.length < rot.pick) { toast(`규칙에 맞는 포켓몬이 ${rot.pick}마리 필요해요 (지금 ${ok.length}마리)`); return null; }
	let entry = ok;
	if (ok.length > rot.pick) {
		const p = await ask<PSet[] | null>(r => <PickScreen key={K()} title={label} team={ok} gen={9} count={rot.pick} opponent={{ name: opp.name, team: opp.team }}
			hint={`${rot.name} · ${rot.doubles ? '더블' : '싱글'} — ${rot.pick}마리를 골라 주세요`} onDone={r} onBack={() => r(null)} />);
		if (!p) return null;
		entry = p;
	}
	await fx('battle');
	const res = await battle({ gen: 9, doubles: rot.doubles, aiSkill: opp.skill, bg: bg as any, music: (opp.music || 'battle') as any, label, noRecord: true, ruleId: rot.rule,
		p1: { name: playerName(), team: entry.map(cloneSet), sprite: playerSprite() }, p2: { name: opp.name, title: opp.title || '', team: opp.team, sprite: opp.sprite, line: opp.line } } as any);
	playMusic(HUB_BGM);
	await fx('fade');
	return res.win;
}
/** 이긴 뒤의 공통 처리: BP · 오늘의 미션 진행 */
function won(S: CSave, kind: BattleKind) {
	const d = dayOf(S); d.win++; d.modes[kind] = 1;
	earnBP(EARN.win, '챔피언스 · 승리'); persist(S);
}
const result = (title: string, heading: string, lines: string[]) => ask<void>(r => <Screen key={K()} title={title} cls="cp-scr"><div class="cp-pn gold cp-result"><h2>{heading}</h2>{lines.map(l => <p>{l}</p>)}</div><button class="btn big primary" onClick={() => r()}>확인</button></Screen>);

async function rankBattle(S: CSave, doubles: boolean) {
	const rot = rotOf(S, 'rank', doubles), t = T(S), mine = teamOf(S);
	const tr = randomTrainer(S.tier >= 3 ? 'expert' : 'grown');
	const team = withRule(rot.rule, () => randomTeam({ gen: 9, size: rot.pick, minBst: t.bst[0], maxBst: t.bst[1] + rot.legend * 60, allowSubLegend: rot.legend >= 1, allowLegend: rot.legend >= 2, doubles: rot.doubles, quality: t.q, gimmicks: true }));
	const win = await fight(S, mine.map(m => m.set), { name: tr.name, title: tr.className, sprite: tr.sprite, team, skill: t.skill, line: tr.lines.intro }, rot, `챔피언스 랭크 · ${t.name}`, 'pwt');
	if (win === null) return;
	dayOf(S).modes.rank = 1;
	if (win) { won(S, 'rank'); if (t.need) S.pts = Math.min(t.need, S.pts + 1); }
	else if (S.tier >= 3) S.pts = Math.max(0, S.pts - 1);
	persist(S);
	await result('랭크 배틀', win ? '승리!' : '패배…', [win ? `+${EARN.win} BP` : S.tier >= 3 ? '승점 -1' : '이 등급에서는 져도 승점이 깎이지 않아요',
		t.need ? `${t.name} · 승점 ${S.pts} / ${t.need}${S.pts >= t.need ? ' — 승급전에 도전할 수 있어요! (스토리)' : ''}` : '챔피언급 — 가장 높은 등급입니다']);
}
async function towerBattle(S: CSave, doubles: boolean) {
	const rot = rotOf(S, 'tower', doubles), mine = teamOf(S);
	const o = withRule(rot.rule, () => towerOpponent(S.tower, doubles ? 'doubles' : 'singles', mine.map(m => m.set)));
	const win = await fight(S, mine.map(m => m.set), { name: o.name, title: (o as any).title, sprite: (o as any).sprite, team: o.team, skill: o.skill, line: (o as any).line, music: (o as any).music || 'tower' }, rot, `챔피언스 타워 ${S.tower + 1}번째`, 'tower');
	if (win === null) return;
	dayOf(S).modes.tower = 1;
	const lines: string[] = [];
	if (win) {
		won(S, 'tower'); S.tower++; lines.push(`+${EARN.win} BP · ${S.tower}연승`);
		if (S.tower % 7 === 0) { earnBP(EARN.set, '챔피언스 타워 7연승'); S.tk.pick++; lines.push(`7연승 세트 클리어! +${EARN.set} BP · 지명 티켓 1장`); }
	} else { lines.push(`${S.tower}연승에서 끝났습니다`); S.tower = 0; }
	persist(S);
	await result('배틀타워', win ? '승리!' : '패배…', lines);
}
async function factoryBattle(S: CSave, doubles: boolean) {
	const rot = rotOf(S, 'factory', doubles), tier = FACTORY_TIERS[Math.min(FACTORY_TIERS.length - 1, 1 + Math.floor(S.factory / 7))];
	const [rental, foe] = withRule(rot.rule, () => { const mine = factoryTeam(tier, 6, 50); return [mine, factoryTeam(tier, rot.pick, 50, new Set(mine.map(s => toID(s.species))))]; });
	const tr = randomTrainer('grown');
	const win = await fight(S, rental, { name: tr.name, title: tr.className, sprite: tr.sprite, team: foe, skill: Math.min(0.9, 0.55 + S.factory * 0.02), line: tr.lines.intro, music: 'factory' }, rot, `챔피언스 팩토리 ${S.factory + 1}번째`, 'factory');
	if (win === null) return;
	dayOf(S).modes.factory = 1;
	const lines: string[] = [];
	if (win) {
		won(S, 'factory'); S.factory++; lines.push(`+${EARN.win} BP · ${S.factory}연승`);
		if (S.factory % 7 === 0) { earnBP(EARN.set, '챔피언스 팩토리 7연승'); S.tk.regular++; lines.push(`7연승 세트 클리어! +${EARN.set} BP · 스카우트 티켓 1장`); }
	} else { lines.push(`${S.factory}연승에서 끝났습니다`); S.factory = 0; }
	persist(S);
	await result('배틀팩토리', win ? '승리!' : '패배…', lines);
}
type Pick = { k: BattleKind; doubles: boolean };
/** 오늘의 규칙에 고른 형식(싱글 3마리·더블 4마리)을 입힘 */
const rotOf = (S: CSave, k: BattleKind, doubles: boolean) => ({ ...rotationOf(k, S.tier), doubles, pick: doubles ? 4 : 3 });
function BattleMenu({ S, done }: { S: CSave; done: (k: Pick | null) => void }) {
	const row = (k: BattleKind, name: string, desc: string, state: string) => { const r = rotationOf(k, S.tier); return <div class="cp-pn cp-battle">
		<b>{name}<em>{r.name}</em></b><small>{desc}</small><small class="cp-dim">{r.desc}</small><small class="cp-y">{state}</small>
		<div class="cp-fmt"><button class="btn primary" onClick={() => done({ k, doubles: false })}>싱글 <small>3마리</small></button><button class="btn" onClick={() => done({ k, doubles: true })}>더블 <small>4마리</small></button></div></div>; };
	const t = T(S);
	return <Screen title="배틀" onBack={() => done(null)} cls="cp-scr"><Top title="배틀" sub={`오늘의 규칙 · ${hoursLeft()}시간 뒤에 바뀝니다`} S={S} onBack={() => done(null)} />
		{row('rank', '랭크 배틀', '이기면 승점. 승점을 채우면 승급전(스토리)', t.need ? `${t.name} · 승점 ${S.pts} / ${t.need}` : '챔피언급')}
		{row('tower', '배틀타워', '내 팀으로 연승. 7연승마다 지명 티켓', `${S.tower}연승 중 · 이번 세트 ${S.tower % 7} / 7`)}
		{row('factory', '배틀팩토리', '빌린 6마리 중 3마리로 연승. 7연승마다 스카우트 티켓', `${S.factory}연승 중 · 이번 세트 ${S.factory % 7} / 7`)}
		<p class="cp-note">1승마다 +{EARN.win} BP. 규칙·기믹은 날마다 바뀌고, 배틀마다 다른 규칙이 걸립니다. 포켓몬은 전국도감 전체가 대상이고, 등급이 오르면 준전설·전설이 나오는 날이 생깁니다.</p>
	</Screen>;
}

// ───────── 스카우트 ─────────
/** 새 소개 10마리 (등급에 맞는 포켓몬, 가진 포켓몬은 빼고). 찜은 세 번 안에 꼭 나오고, 타입 지정이 있으면 절반이 그 타입 */
function newLineup(S: CSave, first = false) {
	const t = T(S), have = new Set(S.roster.map(m => toID(m.set.species)));
	S.lineup = withRule(BASE_RULE, () => {
		const pool = rng.shuffle(speciesPool({ gen: 9, minBst: first ? 440 : t.bst[0], maxBst: first ? 560 : t.bst[1] + 40, allowSubLegend: false })).filter(id => !have.has(id));
		// 등급이 오르면 준전설(슈퍼볼급~)·초전설·환상(마스터볼급~)이 한 마리씩 섞여 나옴 (값은 2배·4배)
		const special = (lv: number) => withRule(lv === 2 ? 'm_one.natdex.yes.yes' : 'm_one.natdex.no.no', () => rng.shuffle(speciesPool({ gen: 9, minBst: 500, allowSubLegend: true, allowLegend: lv === 2 }))).find(id => rarity(id) === lv && !have.has(id));
		const pickN: string[] = first ? [FIRST_FIXED] : [];
		const wants = S.wish.filter(w => !have.has(w));
		if (wants.length && (S.wishMiss >= 2 || Math.random() < 0.34)) { pickN.push(rng.pick(wants)); S.wishMiss = 0; } else if (wants.length) S.wishMiss++;
		if (S.typeNext) { for (const id of pool) { if (pickN.length >= 6) break; if (!pickN.includes(id) && types(id).some(x => x === S.typeNext)) pickN.push(id); } S.typeNext = undefined; }
		if (!first && S.tier >= 2) { const x = special(1); if (x) pickN.push(x); }
		if (!first && S.tier >= 4) { const x = special(2); if (x) pickN.push(x); }
		for (const id of pool) { if (pickN.length >= 10) break; if (!pickN.includes(id)) pickN.push(id); }
		// 지닌 도구는 가진 것만 (없는 도구는 빼고 옴 — 도구는 상점에서)
		return pickN.map(id => { const st = randomSetFor(id, 9, 50, false, 0.65); if (!S.items[toID(st.item)]) st.item = ''; return st; });
	});
	S.lineDay = today(); persist(S);
}
const addMon = (S: CSave, set: PSet) => { const m: CMon = { id: S.seq++, set: cloneSet(set) }; dayOf(S).scout++; S.roster.push(m); if (S.team.length < 6) S.team.push(m.id); persist(S); return m; };
type ScoutAct = { k: 'back' } | { k: 'mon'; i: number } | { k: 'refresh' } | { k: 'type' } | { k: 'pick' } | { k: 'wish' };
function ScoutScreen({ S, done }: { S: CSave; done: (a: ScoutAct) => void }) {
	const fl = freeLeft(S);
	return <Screen title="스카우트" onBack={() => done({ k: 'back' })} cls="cp-scr"><Top title="스카우트" sub={`오늘의 소개 ${S.lineup.length}마리 · 내일 새로 옵니다`} S={S} onBack={() => done({ k: 'back' })} />
		<div class="cp-grid">{S.lineup.map((s, i) => <MonCard set={s} cls={S.wish.includes(toID(s.species)) ? 'rare' : ''} mark={S.wish.includes(toID(s.species)) ? <i class="cp-wish">♥ 찜</i> : null} onClick={() => done({ k: 'mon', i })} />)}</div>
		{!S.lineup.length && <p class="cp-note">오늘 소개받은 포켓몬을 모두 데려갔어요.</p>}
		<div class="cp-pn"><div class="cp-line"><div><b>스카우트</b><small>소개받은 포켓몬을 눌러 영입 · 기한 없이 함께하고 트레이닝도 가능</small></div><span class="cp-cost">{PRICE.scout} BP<small>준전설 ×2 · 전설 ×4</small></span></div>
			<div class="cp-line"><div><b>무료 스카우트</b><small>12시간마다 일반 포켓몬 한 마리를 무료로</small></div><span class="cp-cost">{fl ? `${fl}시간 뒤` : '지금 가능!'}<small>{S.tk.regular > 0 ? `스카우트 티켓 ${S.tk.regular}장` : ''}</small></span></div></div>
		<div class="cp-pn pink"><h3>원하는 포켓몬을 데려오는 방법</h3>
			<button class="cp-line" onClick={() => done({ k: 'pick' })}><div><b>지명 스카우트</b><small>도감에서 직접 골라 영입</small></div><span class="cp-cost">지명 티켓 1<small>또는 {PRICE.pick} BP</small></span></button>
			<button class="cp-line" onClick={() => done({ k: 'wish' })}><div><b>찜 ♥ ({S.wish.length} / 3)</b><small>{S.wish.length ? S.wish.map(speciesKo).join(' · ') : '찜한 포켓몬은 소개 3번 안에 반드시 등장'}</small></div><span class="cp-cost">무료</span></button>
			<button class="cp-line" onClick={() => done({ k: 'type' })}><div><b>타입 지정{S.typeNext ? ` — 다음 소개: ${typeKo(S.typeNext)}` : ''}</b><small>다음 소개의 절반이 그 타입</small></div><span class="cp-cost">{PRICE.typeTicket} BP</span></button>
			<button class="cp-line" onClick={() => done({ k: 'refresh' })}><div><b>지금 새 소개 받기</b><small>내일을 기다리지 않고 10마리를 새로</small></div><span class="cp-cost">{PRICE.refresh} BP</span></button></div>
	</Screen>;
}
/** 도감에서 포켓몬 고르기 (지명·찜) */
function SpeciesPick({ title, pool, hint, done }: { title: string; pool: string[]; hint: string; done: (id: string | null) => void }) {
	const [q, setQ] = useState('');
	const list = pool.filter(id => !q || speciesKo(id).includes(q) || id.includes(q.toLowerCase())).slice(0, 60);
	return <Screen title={title} onBack={() => done(null)} cls="cp-scr" top>
		<p class="cp-note">{hint}</p>
		<input class="cp-search" placeholder="이름으로 찾기" value={q} onInput={e => setQ((e.target as HTMLInputElement).value.trim())} />
		<div class="cp-list">{list.map(id => <button class="cp-row" onClick={() => done(id)}><PokeIcon species={id} /><b>{speciesKo(id)}</b><span>{types(id).map(t => <TypeBadge type={t} small />)}</span></button>)}</div>
		{list.length >= 60 && <p class="cp-note">이름을 입력하면 더 좁혀집니다.</p>}
	</Screen>;
}
const pickable = (S: CSave) => withRule(S.tier >= 4 ? 'm_one.natdex.yes.yes' : S.tier >= 2 ? 'm_one.natdex.no.no' : BASE_RULE, () => speciesPool({ gen: 9, minBst: 300, allowSubLegend: S.tier >= 2, allowLegend: S.tier >= 4 })).filter(id => !S.roster.some(m => toID(m.set.species) === id)).sort((a, b) => speciesKo(a).localeCompare(speciesKo(b), 'ko'));
const full = (S: CSave) => { if (S.roster.length >= T(S).cap) { toast(`로스터가 가득 찼어요 (${T(S).cap}마리). 로스터에서 내보내거나 등급을 올리세요`); return true; } return false; };
/** 스카우트 값 치르기: 일반 포켓몬은 무료(12시간마다) → 티켓 → BP 순서. 준전설·전설은 BP 로만. 지명은 지명 티켓 → BP */
function payScout(S: CSave, kind: 'regular' | 'pick', name: string, id = '') {
	if (!rarity(id)) {
		if (kind === 'regular' && !freeLeft(S)) { S.freeAt = Date.now() + FREE_MS; persist(S); return true; }
		if (S.tk[kind] > 0) { S.tk[kind]--; persist(S); return true; }
	}
	return pay(scoutCost(id, kind === 'pick'), `챔피언스 · ${name} 스카우트`);
}
/** 그 포켓몬을 지금 스카우트하면 드는 값 (표시용) */
const scoutLabel = (S: CSave, id: string) => rarity(id) ? scoutCost(id) + ' BP' : !freeLeft(S) ? '무료' : S.tk.regular > 0 ? '티켓' : PRICE.scout + ' BP';
async function scoutFlow(S: CSave, first = false) {
	if (S.lineDay !== today() && !first) newLineup(S);
	while (true) {
		if (first && S.tk.regular <= 0) return;
		const a = await ask<ScoutAct>(r => first ? <FirstScout key={K()} S={S} done={r} /> : <ScoutScreen key={K()} S={S} done={r} />);
		if (a.k === 'back') { if (first) continue; return; }
		if (a.k === 'mon') {
			const s = S.lineup[a.i], name = speciesKo(s.species);
			const c = await ask<string>(r => <Screen key={K()} title={name} onBack={() => r('')} cls="cp-scr"><MonDetail set={s} gen={9} />
				<div class="cp-btns one"><button class="btn big primary" onClick={() => r('regular')}>스카우트 ({first ? '티켓' : scoutLabel(S, toID(s.species))})</button></div></Screen>);
			if (!c || full(S)) continue;
			if (first) { S.tk.regular--; } else if (!payScout(S, 'regular', name, toID(s.species))) continue;
			addMon(S, s); S.lineup.splice(a.i, 1); persist(S); sfx('heal');
			toast(`${josa(name, '을', '를')} 영입했습니다!`);
		}
		if (a.k === 'refresh') { if (pay(PRICE.refresh, '챔피언스 · 새 소개')) { newLineup(S); sfx('select'); } }
		if (a.k === 'type') {
			const t = await ask<string | null>(r => <ChoiceScreen key={K()} title="타입 지정" intro={<p class="cp-note">다음에 받는 소개의 절반이 고른 타입으로 나옵니다 ({PRICE.typeTicket} BP).</p>} onBack={() => r(null)}
				options={ALL_TYPES.map(x => ({ value: x, label: typeKo(x) }))} onPick={r} />);
			if (t && pay(PRICE.typeTicket, '챔피언스 · 타입 지정')) { S.typeNext = t; persist(S); toast(`다음 소개에 ${typeKo(t)} 타입이 많이 나옵니다`); }
		}
		if (a.k === 'pick') {
			const id = await ask<string | null>(r => <SpeciesPick key={K()} title="지명 스카우트" pool={pickable(S)} hint={`도감에서 골라 바로 영입합니다 — ${S.tk.pick > 0 ? `지명 티켓 1장 (가진 수 ${S.tk.pick})` : `${PRICE.pick} BP`}${S.tier >= 2 ? ` · 준전설 ${PRICE.pick * 2} BP${S.tier >= 4 ? ` · 전설 ${PRICE.pick * 4} BP` : ''}` : ''}`} done={r} />);
			if (!id || full(S)) continue;
			const set = withRule(BASE_RULE, () => randomSetFor(id, 9, 50, false, 0.7)), name = speciesKo(id);
			if (!S.items[toID(set.item)]) set.item = '';
			if (!(await confirmBox('지명 스카우트', `${josa(name, '을', '를')} 영입할까요?\n${natureKo(set.nature)} · ${abilityKo(set.ability)}\n${set.moves.map(moveKo).join(' · ')}`, '영입한다', '그만두기'))) continue;
			if (!payScout(S, 'pick', name, id)) continue;
			addMon(S, set); S.wish = S.wish.filter(w => w !== id); persist(S); sfx('heal'); toast(`${josa(name, '을', '를')} 영입했습니다!`);
		}
		if (a.k === 'wish') {
			if (S.wish.length >= 3) { const i = await ask<number | null>(r => <ChoiceScreen key={K()} title="찜 목록" intro={<p class="cp-note">찜은 3마리까지예요. 뺄 포켓몬을 고르세요.</p>} onBack={() => r(null)} options={S.wish.map((w, k) => ({ value: k, label: speciesKo(w) + ' 빼기' }))} onPick={r} />); if (i !== null) { S.wish.splice(i, 1); persist(S); } continue; }
			const id = await ask<string | null>(r => <SpeciesPick key={K()} title="찜하기" pool={pickable(S).filter(x => !S.wish.includes(x))} hint="찜한 포켓몬은 소개 3번 안에 반드시 한 마리가 나옵니다. (값은 보통 스카우트와 같아요)" done={r} />);
			if (id) { S.wish.push(id); persist(S); toast(`${josa(speciesKo(id), '을', '를')} 찜했습니다 ♥`); }
		}
	}
}
/** 첫 스카우트: 열 마리 중 세 마리를 티켓으로 */
function FirstScout({ S, done }: { S: CSave; done: (a: ScoutAct) => void }) {
	return <Screen title="첫 스카우트" cls="cp-scr"><Top title="첫 스카우트" sub={`스카우트 티켓으로 ${S.tk.regular}마리 더 데려갈 수 있어요`} S={S} />
		<p class="cp-note">소개받은 열 마리 가운데 마음에 드는 포켓몬을 눌러 영입하세요. 포켓몬을 누르면 기술·능력을 볼 수 있습니다.</p>
		<div class="cp-grid">{S.lineup.map((s, i) => <MonCard set={s} cls={toID(s.species) === FIRST_FIXED ? 'rare' : ''} mark={toID(s.species) === FIRST_FIXED ? <i class="cp-wish y">늘 나옴</i> : null} onClick={() => done({ k: 'mon', i })} />)}</div>
	</Screen>;
}

// ───────── 로스터 · 트레이닝 ─────────
const STAT_NAME = ['HP', '공격', '방어', '특공', '특방', '스피드'];
const BOX = 30;
function RosterScreen({ S, done }: { S: CSave; done: (m: CMon | null) => void }) {
	const [page, setPage] = useState(0), pages = Math.max(1, Math.ceil(T(S).cap / BOX)), team = teamOf(S);
	const box = S.roster.slice(page * BOX, page * BOX + BOX), cap = Math.min(BOX, T(S).cap - page * BOX);
	const cell = (m: CMon | undefined, k: number) => <button class={'cp-cell' + (m ? '' : ' empty') + (m && S.team.includes(m.id) ? ' in' : '')} disabled={!m} onClick={() => m && done(m)} key={k}>
		{m && <PokeIcon species={m.set.species} />}{m && S.team.includes(m.id) && <i>{S.team.indexOf(m.id) + 1}</i>}</button>;
	return <Screen title="로스터" onBack={() => done(null)} cls="cp-scr"><Top title="로스터" sub={`${S.roster.length} / ${T(S).cap}마리 · 팀 ${S.team.length} / 6`} S={S} onBack={() => done(null)} />
		<div class="cp-pc"><div class="cp-party"><b>팀<small>{S.team.length} / 6</small></b><div>{[0, 1, 2, 3, 4, 5].map(k => <button class={'cp-slot' + (team[k] ? '' : ' empty')} disabled={!team[k]} onClick={() => team[k] && done(team[k])}>
			{team[k] ? <><PokeIcon species={team[k].set.species} /><small>{speciesKo(team[k].set.species)}</small></> : null}</button>)}</div></div>
		<div class="cp-box">
			<div class="cp-box-head"><button disabled={page <= 0} onClick={() => setPage(page - 1)} aria-label="앞 박스">◀◀</button><b>박스 {page + 1}{pages > 1 && <small>/ {pages}</small>}</b><button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="다음 박스">▶▶</button></div>
			<div class="cp-box-grid">{Array.from({ length: cap }, (_, k) => cell(box[k], k))}</div>
		</div></div>
		<p class="cp-note">포켓몬을 누르면 능력을 보고, 팀에 넣고 빼기·트레이닝·도구 바꾸기를 할 수 있어요. 숫자가 붙은 포켓몬이 지금 팀입니다.</p>
	</Screen>;
}
type MonAct = '' | 'team' | 'item' | 'move' | 'nature' | 'ability' | 'sp' | 'tera' | 'release';
function MonScreen({ S, m, done }: { S: CSave; m: CMon; done: (a: MonAct) => void }) {
	const inTeam = S.team.includes(m.id), tr = false;
	const b = (a: MonAct, label: string, cost?: number, dis?: boolean) => <button class="btn" disabled={dis} onClick={() => done(a)}>{label}{cost !== undefined && <small class="cp-y"> {cost} BP</small>}</button>;
	return <Screen title={speciesKo(m.set.species)} onBack={() => done('')} cls="cp-scr"><Top title={speciesKo(m.set.species)} sub={inTeam ? `팀 ${S.team.indexOf(m.id) + 1}번째` : '박스'} S={S} onBack={() => done('')} />
		<MonDetail set={m.set} gen={9} />
		<div class="cp-btns">{b('team', inTeam ? '팀에서 빼기' : '팀에 넣기')}{b('item', '지닌 도구 바꾸기')}</div>
		<h3 class="cp-h">트레이닝</h3>
		<div class="cp-btns">{b('move', '기술 바꾸기', PRICE.move, tr)}{b('sp', '능력 포인트', PRICE.sp, tr)}{b('nature', '능력 보정(성격)', PRICE.nature, tr)}{b('ability', '특성', PRICE.ability, tr)}{b('tera', '테라스탈 타입', PRICE.tera, tr)}</div>
		<div class="cp-btns one"><button class="btn ghost" onClick={() => done('release')}>내보내기</button></div>
	</Screen>;
}
/** 능력 포인트 나누기 (한 능력 32, 합계 66) */
function SpEdit({ set, done }: { set: PSet; done: (sp: { [k: string]: number } | null) => void }) {
	const [sp, setSp] = useState<{ [k: string]: number }>(() => ({ ...spOf(set) }));
	const sum = STAT_KEYS.reduce((a, k) => a + sp[k], 0);
	const ch = (k: string, d: number) => { const v = Math.max(0, Math.min(SP_MAX, sp[k] + d)); if (d > 0 && sum - sp[k] + v > SP_TOTAL) return; setSp({ ...sp, [k]: v }); };
	return <Screen title="능력 포인트" onBack={() => done(null)} cls="cp-scr">
		<p class="cp-note">한 능력에 {SP_MAX}까지, 모두 합쳐 {SP_TOTAL}포인트. 남은 포인트 <b class="cp-y">{SP_TOTAL - sum}</b></p>
		<div class="cp-pn">{STAT_KEYS.map((k, i) => <div class="cp-sp"><b>{STAT_NAME[i]}</b><button class="btn small" onClick={() => ch(k, -4)}>−4</button><button class="btn small" onClick={() => ch(k, -1)}>−</button>
			<i><span style={{ width: sp[k] / SP_MAX * 100 + '%' }} /></i><em>{sp[k]}</em><button class="btn small" onClick={() => ch(k, 1)}>＋</button><button class="btn small" onClick={() => ch(k, 4)}>＋4</button></div>)}</div>
		<button class="btn big primary" onClick={() => done(sp)}>이대로 정하기 ({PRICE.sp} BP)</button>
	</Screen>;
}
async function rosterFlow(S: CSave) {
	while (true) {
		const m = await ask<CMon | null>(r => <RosterScreen key={K()} S={S} done={r} />);
		if (!m) return;
		while (S.roster.includes(m)) {
			const a = await ask<MonAct>(r => <MonScreen key={K()} S={S} m={m} done={r} />), s = m.set, name = speciesKo(s.species);
			if (!a) break;
			if (a === 'team') { if (S.team.includes(m.id)) S.team = S.team.filter(i => i !== m.id); else if (S.team.length >= 6) toast('팀은 6마리까지예요. 먼저 한 마리를 빼 주세요'); else S.team.push(m.id); persist(S); }
			if (a === 'item') {
				const own = Object.keys(S.items).filter(id => !megaStonesFor(s.species).length ? !/ite$|itex$|itey$/.test(id) || megaStonesFor(s.species).includes(id) : true);
				const it = await ask<string | null>(r => <ChoiceScreen key={K()} title="지닌 도구" onBack={() => r(null)} intro={<p class="cp-note">가진 도구 가운데 고릅니다. 새 도구는 상점에서 살 수 있어요.</p>}
					options={[{ value: '', label: '없음' }, ...own.map(id => ({ value: id, label: itemKo(id), desc: itemDesc(id), icon: <ItemIcon item={id} size={24} /> }))]} onPick={r} />);
				if (it !== null) { s.item = it; persist(S); }
			}
			if (a === 'move') {
				const i = await ask<number | null>(r => <ChoiceScreen key={K()} title="바꿀 기술" onBack={() => r(null)} options={[0, 1, 2, 3].map(k => ({ value: k, label: s.moves[k] ? moveKo(s.moves[k]) : '(빈 칸)' }))} onPick={r} />);
				if (i === null) continue;
				const ls = withRule(BASE_RULE, () => learnset(s.species, 9)).filter(x => !s.moves.includes(x)).sort((x, y) => moveKo(x).localeCompare(moveKo(y), 'ko'));
				const mv = await ask<string | null>(r => <ChoiceScreen key={K()} title={`${s.moves[i] ? moveKo(s.moves[i]) : '빈 칸'} → ?`} onBack={() => r(null)} options={ls.map(x => ({ value: x, label: moveKo(x) }))} onPick={r} />);
				if (mv && pay(PRICE.move, `챔피언스 · ${name} 기술`)) { s.moves[i] = mv; persist(S); sfx('statUp'); }
			}
			if (a === 'nature') {
				const n = await ask<string | null>(r => <ChoiceScreen key={K()} title="능력 보정" onBack={() => r(null)} options={NATURES.map(([id, up, dn]) => ({ value: id, label: natureKo(id), desc: up ? `${up} ↑ · ${dn} ↓` : '보정 없음', disabled: toID(s.nature) === id }))} onPick={r} />);
				if (n && pay(PRICE.nature, `챔피언스 · ${name} 능력 보정`)) { s.nature = n; persist(S); sfx('statUp'); }
			}
			if (a === 'ability') {
				const abs = ((speciesData(s.species, 9) as any)?.ab || []) as string[];
				const ab = await ask<string | null>(r => <ChoiceScreen key={K()} title="특성" onBack={() => r(null)} options={abs.map(x => ({ value: x, label: abilityKo(x), disabled: toID(x) === toID(s.ability) }))} onPick={r} />);
				if (ab && pay(PRICE.ability, `챔피언스 · ${name} 특성`)) { s.ability = ab; persist(S); sfx('statUp'); }
			}
			if (a === 'sp') {
				const sp = await ask<{ [k: string]: number } | null>(r => <SpEdit key={K()} set={s} done={r} />);
				if (sp && pay(PRICE.sp, `챔피언스 · ${name} 능력 포인트`)) { for (const k of STAT_KEYS) s.evs[k] = spToEv(sp[k]); persist(S); sfx('statUp'); }
			}
			if (a === 'tera') {
				const t = await ask<string | null>(r => <ChoiceScreen key={K()} title="테라스탈 타입" onBack={() => r(null)} options={ALL_TYPES.map(x => ({ value: x, label: typeKo(x), disabled: s.teraType === x }))} onPick={r} />);
				if (t && pay(PRICE.tera, `챔피언스 · ${name} 테라스탈 타입`)) { s.teraType = t; persist(S); sfx('statUp'); }
			}
			if (a === 'release' && await confirmBox('내보내기', `${josa(name, '을', '를')} 내보낼까요? 되돌릴 수 없어요.`, '내보낸다', '그만두기')) { S.roster = S.roster.filter(x => x !== m); S.team = S.team.filter(i => i !== m.id); persist(S); }
		}
	}
}

// ───────── 상점 · 미션 ─────────
function ShopScreen({ S, done }: { S: CSave; done: (cosmetic?: boolean) => void }) {
	const stones = [...new Set(S.roster.flatMap(m => megaStonesFor(m.set.species)))];
	const cats: [string, number, string[]][] = [['메가스톤', PRICE.mega, stones], ...SHOP.map(([name, kind, ids]) => [name, PRICE[kind], ids] as [string, number, string[]])];
	const [tab, setTab] = useState(stones.length ? 0 : 1), [, tick] = useState(0);
	const buy = (id: string, cost: number) => { if (S.items[id]) return; if (!pay(cost, `챔피언스 · ${itemKo(id)}`)) return; S.items[id] = 1; persist(S); sfx('select'); tick(x => x + 1); };
	const [name, cost, ids] = cats[tab];
	return <Screen title="상점" onBack={() => done()} cls="cp-scr"><Top title="상점" sub="도구는 한 번 사면 계속 씁니다" S={S} onBack={() => done()} />
		<div class="cp-tabs">{cats.map(([n], i) => <button class={i === tab ? 'on' : ''} onClick={() => { sfx('select'); setTab(i); }}>{n}</button>)}
			<button class="cos" onClick={() => done(true)}>꾸미기 ▸</button></div>
		<div class="cp-pn"><h3>{name} <small class="cp-y">{cost} BP</small> <small>{ids.filter(id => S.items[id]).length} / {ids.length} 보유</small></h3>
			{!ids.length && <p class="cp-note">내 로스터의 포켓몬이 쓸 수 있는 메가스톤이 여기에 진열됩니다. 메가진화하는 포켓몬을 스카우트해 보세요.</p>}
			{ids.map(id => <div class="cp-line"><ItemIcon item={id} size={24} /><div><b>{itemKo(id)}</b><small>{itemDesc(id)}</small></div>
				{S.items[id] ? <span class="cp-own">가짐</span> : <button class="btn small yellow" onClick={() => buy(id, cost)}>산다</button>}</div>)}</div>
		<p class="cp-note">도구는 로스터 › 포켓몬 › 「지닌 도구 바꾸기」에서 지니게 합니다. 「꾸미기」는 시뮬레이터 모드와 같은 BP 교환소(칭호·카드·배경·음악)입니다.</p>
	</Screen>;
}
const MISSIONS: { id: string; name: string; bp: number; prog: (d: CSave['day']) => [number, number] }[] = [
	{ id: 'w3', name: '배틀에서 3승', bp: 3, prog: d => [d.win, 3] },
	{ id: 'sc', name: '포켓몬을 1마리 스카우트', bp: 2, prog: d => [d.scout || 0, 1] },
	{ id: 'all', name: '랭크 · 타워 · 팩토리를 한 번씩', bp: 4, prog: d => [Object.keys(d.modes).length, 3] },
];
const missionReady = (S: CSave) => MISSIONS.filter(m => { const [a, b] = m.prog(dayOf(S)); return a >= b && !S.day.got[m.id]; }).length;
function MissionScreen({ S, done }: { S: CSave; done: () => void }) {
	const [, tick] = useState(0), d = dayOf(S);
	return <Screen title="미션" onBack={done} cls="cp-scr"><Top title="오늘의 미션" sub="날마다 새로 시작" S={S} onBack={done} />
		<div class="cp-pn">{MISSIONS.map(m => { const [a, b] = m.prog(d), ok = a >= b; return <div class="cp-line"><div><b>{m.name}</b><small>{Math.min(a, b)} / {b}</small></div>
			{d.got[m.id] ? <span class="cp-own">받음</span> : <button class="btn small yellow" disabled={!ok} onClick={() => { d.got[m.id] = 1; persist(S); earnBP(m.bp, '챔피언스 미션'); tick(x => x + 1); }}>+{m.bp} BP</button>}</div>; })}</div>
	</Screen>;
}

// ───────── 스토리 ─────────
/** 승급전(또는 등록 장). 이기면 다음 등급으로 */
async function chapterFlow(S: CSave) {
	const c = CHAPTERS[S.ch], w = CWHO[c.who];
	await fx('blinds');
	await talk(c.before, c.bg, [`CHAPTER ${S.ch + 1}`, c.title]);
	const next = TIERS[Math.min(S.ch, TIERS.length - 1)];
	let win: boolean | null;
	if (S.ch === 0) {
		const rot = { rule: BASE_RULE, doubles: false, pick: 3, name: '연습 승부' };
		const [mine, foe] = withRule(BASE_RULE, () => [RENTAL.map(id => randomSetFor(id, 9, 50, false, 0.7)), randomTeam({ gen: 9, size: 3, minBst: 380, maxBst: 480, allowSubLegend: false, quality: 0.3 })]);
		win = await fight(S, mine, { name: w.name, title: w.title, sprite: w.sprite, team: foe, skill: 0.3, line: '자, 편하게 와!' }, rot, '연습 승부', c.bg);
	} else {
		const dbl = teamOf(S).length >= 4 && await ask<boolean>(r => <ChoiceScreen key={K()} title="승급전 형식" intro={<p class="cp-note">어느 형식으로 겨룰까요?</p>} options={[{ value: false, label: '싱글', desc: '3마리' }, { value: true, label: '더블', desc: '4마리' }]} onPick={r} />);
		const rot = rotOf(S, 'rank', dbl);
		const foe = withRule(rot.rule, () => randomTeam({ gen: 9, size: rot.pick, minBst: next.bst[0], maxBst: next.bst[1] + rot.legend * 60, allowSubLegend: rot.legend >= 1, allowLegend: rot.legend >= 2, doubles: rot.doubles, quality: Math.min(0.95, next.q + 0.1), gimmicks: true, must: c.ace ? [c.ace] : [] }));
		win = await fight(S, teamOf(S).map(m => m.set), { name: w.name, title: w.title, sprite: w.sprite, team: foe, skill: Math.min(0.97, next.skill + 0.05), line: c.before[c.before.length - 1][1], music: S.ch >= 4 ? 'champion' : 'boss' }, rot, `승급전 · ${c.title}`, c.bg);
	}
	if (win === null) return;
	// 연습 승부는 져도 이야기가 이어짐 (등록 첫날에 막히지 않게)
	if (!win) { await talk([[c.who, c.lose]], c.bg); if (S.ch > 0) { S.pts = Math.max(0, S.pts - 1); persist(S); return; } }
	await talk(S.ch === 0 && !win ? c.after.slice(1) : c.after, c.bg);
	await fx('fade');
	if (S.ch === 0) { S.ch = 1; S.tk.regular = 3; newLineup(S, true); persist(S); await scoutFlow(S, true); newLineup(S); return; }
	S.ch++; S.tier = Math.min(TIERS.length - 1, S.tier + 1); S.pts = 0; persist(S); earnBP(EARN.promo, '챔피언스 승급');
	await result('승급!', `${T(S).name}으로 올라갔다!`, [`+${EARN.promo} BP`, `로스터 한도 ${T(S).cap}마리`, S.tier >= TIERS.length - 1 ? '챔피언스 아레나의 정점입니다. 축하합니다!' : '스카우트에 더 강한 포켓몬이 소개됩니다']);
}
function StoryScreen({ S, done }: { S: CSave; done: (go: boolean) => void }) {
	const ready = S.ch < CHAPTERS.length && (S.ch === 0 || S.pts >= T(S).need);
	return <Screen title="스토리" onBack={() => done(false)} cls="cp-scr"><Top title="스토리" sub="등급이 오를 때마다 다음 이야기가 열립니다" S={S} onBack={() => done(false)} />
		{CHAPTERS.map((c, i) => { const st = i < S.ch ? 'done' : i === S.ch ? 'now' : 'lock'; return <div class={'cp-ch ' + st}><img src={SPRITE_URL(CWHO[c.who].sprite)} onError={trainerImgError} alt="" />
			<div><b>{i + 1} · {st === 'lock' ? '？？？' : c.title}</b><small>{st === 'lock' ? `${TIERS[Math.max(0, i - 1)].name}의 승점을 채우면` : c.sub}</small></div>
			<em>{st === 'done' ? '완료' : st === 'now' ? (i === 0 ? '시작' : `승점 ${S.pts} / ${T(S).need}`) : ''}</em></div>; })}
		{S.ch < CHAPTERS.length && <button class="btn big primary" disabled={!ready} onClick={() => done(true)}>{ready ? `CHAPTER ${S.ch + 1} 시작` : '랭크 배틀에서 승점을 채우세요'}</button>}
	</Screen>;
}

// ───────── 전용 메뉴 ─────────
type HubAct = 'exit' | 'story' | 'battle' | 'scout' | 'roster' | 'shop' | 'mission' | 'reset' | 'settings' | 'calc' | 'book';
function Hub({ S, done }: { S: CSave; done: (a: HubAct) => void }) {
	const t = T(S), c = CHAPTERS[S.ch], ready = !!c && S.pts >= t.need, mr = missionReady(S), newLine = S.lineDay !== today();
	const tile = (a: HubAct, name: string, cls: string, mon: string, badge?: string) => <button class={'cp-tile ' + cls} onClick={() => { sfx('select'); done(a); }}>{badge && <i>{badge}</i>}<PokeIcon species={mon} /><span>{name}</span></button>;
	return <div class="cp-hub"><Top title="챔피언스 모드" sub={t.need ? `${t.name} · 승점 ${S.pts} / ${t.need}` : `${t.name} — 정점`} S={S} onBack={() => done('exit')} />
		<button class="cp-pn gold cp-story" onClick={() => done('story')}>
			{c ? <><img src={SPRITE_URL(CWHO[c.who].sprite)} onError={trainerImgError} alt="" /><div><small>스토리 — CHAPTER {S.ch + 1}</small><b>{c.title}</b>
				<span>{ready ? '승급전에 도전할 수 있어요!' : c.sub}</span><i class="cp-bar"><span style={{ width: (t.need ? S.pts / t.need * 100 : 100) + '%' }} /></i></div>{ready && <em>도전!</em>}</>
				: <div><small>스토리</small><b>챔피언급 — 이야기를 모두 봤습니다</b><span>규칙이 바뀔 때마다 팀을 고쳐 짜며 정점을 지켜 보세요</span></div>}
		</button>
		<div class="cp-tiles">{tile('battle', '배틀', 'c1', 'garchomp')}{tile('scout', '스카우트', 'c2', 'pikachu', !freeLeft(S) ? '무료' : newLine ? '새 소개' : undefined)}{tile('roster', '로스터', 'c3', 'gardevoir')}
			{tile('shop', '상점', 'c5', 'rotomwash')}{tile('mission', '미션', 'c6', 'togekiss', mr ? String(mr) : undefined)}{tile('story', '스토리', 'c4', 'machamp', ready ? '!' : undefined)}</div>
		<div class="cp-pn"><h3>내 팀 <small>{S.team.length} / 6 · 로스터 {S.roster.length} / {t.cap}</small></h3>
			<div class="cp-team">{[0, 1, 2, 3, 4, 5].map(i => { const m = teamOf(S)[i]; return <span class={m ? '' : 'empty'}>{m ? <Sprite species={m.set.species} gen={9} size={48} anim={false} cls="front" shiny={m.set.shiny} /> : '＋'}</span>; })}</div></div>
		<div class="cp-rules">{(['rank', 'tower', 'factory'] as BattleKind[]).map(k => { const r = rotationOf(k, S.tier); return <span><small>{{ rank: '랭크', tower: '타워', factory: '팩토리' }[k]}</small>{r.name}</span>; })}<em>{hoursLeft()}시간 뒤 변경</em></div>
		<div class="cp-nav"><button onClick={() => done('book')}>수첩</button><button onClick={() => done('calc')}>계산기</button><button onClick={() => done('settings')}>설정</button><button onClick={() => done('exit')}>타이틀</button></div>
		<button class="cp-reset" onClick={() => done('reset')}>챔피언스 모드를 처음부터 다시</button>
	</div>;
}

export interface Tools { settings: (onBack: () => void, onTitle?: () => void) => any; calc: (onBack: () => void) => any; book: (onBack: () => void) => any; shop: (onBack: () => void) => any }
export async function runChampions(tools?: Tools) {
	let S: CSave = { ...fresh(), ...load<Partial<CSave>>(KEY, {}) } as CSave;
	for (const m of S.roster) delete (m as any).trial;   // 예전 저장의 트라이얼 포켓몬은 그대로 남김 (기한 없음)
	playMusic(HUB_BGM);
	await fx('fade');
	if (S.ch === 0) await chapterFlow(S);
	while (true) {
		const a = await ask<HubAct>(r => <Hub key={K()} S={S} done={r} />);
		if (a === 'exit') { persist(S); return; }
		if (a === 'reset') { if (await confirmBox('처음부터', '챔피언스 모드의 진행(등급·로스터·도구·티켓)을 모두 지울까요?\nBP 는 그대로 남습니다.', '지운다', '그만두기')) { S = fresh(); persist(S); await chapterFlow(S); } continue; }
		if (S.ch === 0) { await chapterFlow(S); continue; }
		if (a === 'story') { if (await ask<boolean>(r => <StoryScreen key={K()} S={S} done={r} />)) { if (S.ch > 0 && teamOf(S).length < 3) { toast('팀에 포켓몬이 3마리는 있어야 해요'); continue; } await chapterFlow(S); } }
		if (a === 'battle') {
			const b = await ask<Pick | null>(r => <BattleMenu key={K()} S={S} done={r} />);
			if (!b) continue;
			if (b.k !== 'factory' && teamOf(S).length < (b.doubles ? 4 : 3)) { toast(`팀에 포켓몬이 ${b.doubles ? 4 : 3}마리는 있어야 해요 — 스카우트에서 데려오세요`); continue; }
			await (b.k === 'rank' ? rankBattle : b.k === 'tower' ? towerBattle : factoryBattle)(S, b.doubles);
		}
		if (a === 'scout') await scoutFlow(S);
		if (a === 'roster') await rosterFlow(S);
		if (a === 'shop') { while (await ask<boolean | undefined>(r => <ShopScreen key={K()} S={S} done={r} />)) { if (tools) await ask<void>(r => tools.shop(r)); } }
		if (a === 'settings' && tools) { await ask<void>(r => tools.settings(() => r())); playMusic(HUB_BGM); }
		if (a === 'calc' && tools) await ask<void>(r => tools.calc(r));
		if (a === 'book' && tools) await ask<void>(r => tools.book(r));
		if (a === 'mission') await ask<void>(r => <MissionScreen key={K()} S={S} done={r} />);
	}
}
void Fragment; void BACK;
