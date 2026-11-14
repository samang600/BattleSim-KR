/** 챔피언스 모드 (개발자 빌드) — 빈손으로 시작해 스카우트하고 키워서 챔피언급까지.
 *  값·이야기·규칙 순환은 champions-data.ts. 재화는 시뮬레이터 모드와 같은 BP (rewards.ts).
 *  화면은 '무엇을 눌렀는지'만 돌려주고, 진행은 아래의 흐름 함수(…Flow)가 맡는다. */
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { ask, Screen, Sprite, PokeIcon, ItemIcon, TypeBadge, Modal, toast, confirmBox } from './ui/core';
import { PickScreen, ChoiceScreen, MonDetail } from './ui/screens';
import { NatureTable, matches } from './ui/teambuilder';
import { battle, playerName, playerSprite, towerOpponent, BACK, runRank, runPWT, rankTier, rankLabel, CH_TAG, type ArenaCtx } from './modes';
import { loadRecords, updateRecords } from './store';
import { loadStats, ACHIEVEMENTS } from './stats';
import { SymbolIcon } from './ui/pixel-icons';
import { cardSkin, cardSkinClass, TitleChip } from './ui/shop';
import { titleItem } from './rewards';
import { recTag } from './rules';
import { randomTeam, randomSetFor, speciesPool, dedupeItems, cloneSet, rng, spOf, spToEv, SP_MAX, SP_TOTAL, STAT_KEYS, type PSet } from './sets';
import { aiPickEntry } from './smogon';
import { randomTrainer } from './trainers';
import { SPRITE_URL, trainerImgError } from './trainer-lines';
import { load, save, loadSettings } from './store';
import { loadWallet, earnBP, spendBP, onWallet } from './rewards';
import { ruleById, applyRuleData, teamRuleIssues, speciesAllowed } from './rules';
import { speciesKo, speciesData, moveData, moveKo, abilityDesc, abilityKo, itemKo, itemDesc, natureKo, typeKo, learnset, megaStonesFor, toID, ALL_TYPES, shownName, isNick, nickKo, allBalls } from './data';
import { playMusic, sfx } from './sound';
import { PRICE, EARN, TIERS, CHAPTERS, CWHO, RENTAL, START_ITEMS, SHOP, NATURES, EVENTS, TOWER_EVENTS, CSYM, REGION_CUPS, CUP_NEED } from './champions-data';

// ───────── 저장 ─────────
interface CMon { id: number; set: PSet }
interface CSave {
	v: 1; /** 다음에 볼 장 (0 = 등록 전) */ ch: number; tier: number; pts: number;
	roster: CMon[]; /** 지금 고른 팀에 넣은 포켓몬 id (6마리까지) — teams[cur] 과 같은 것 */ team: number[]; seq: number;
	/** 편성해 둔 팀들 (10개까지) · 지금 고른 팀 번호 */ teams?: number[][]; cur?: number;
	items: { [id: string]: 1 }; tk: { regular: number; pick: number };
	/** 오늘의 소개 · 받은 날 · 다음 무료 스카우트 시각(ms) · 찜(3마리) · 찜이 안 나온 횟수 · 다음 소개에 많이 나올 타입 */
	lineup: PSet[]; lineDay: string; freeAt: number; wish: string[]; wishMiss: number; typeNext?: string;
	/** PWT 대회별 우승 수 · 이미 본 컷씬 */ cups?: { [id: string]: number }; seen?: { [id: string]: 1 };
	/** 챔피언스 전용 심볼 (1 은 · 2 금) · 타워 최고 연승 */ sym?: { [id: string]: number }; towerBest?: number;
	tower: number; factory?: number; /** 첫 파티 후보 (고르기 전까지) */ starts?: PSet[][];
	day: { id: string; win: number; scout: number; modes: { [k: string]: 1 }; got: { [k: string]: 1 } };
}
const KEY = 'champions';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const fresh = (): CSave => ({ v: 1, ch: 0, tier: 0, pts: 0, roster: [], team: [], seq: 1, items: Object.fromEntries(START_ITEMS.map(i => [i, 1])), tk: { regular: 0, pick: 0 },
	lineup: [], lineDay: '', freeAt: 0, wish: [], wishMiss: 0, tower: 0, factory: 0, day: { id: '', win: 0, scout: 0, modes: {}, got: {} } });
const TEAM_MAX = 10;
/** 팀 목록을 맞춤: 지금 팀(S.team)을 teams[cur] 에 되적음 */
const syncTeams = (S: CSave) => { S.teams ||= [S.team]; S.cur = Math.min(S.cur || 0, S.teams.length - 1); S.teams[S.cur] = S.team; };
const persist = (S: CSave) => { syncTeams(S); save(KEY, S); };
/** 다른 팀으로 바꿈 (없는 번호면 빈 팀을 새로) */
const useTeam = (S: CSave, i: number) => { syncTeams(S); while (S.teams!.length <= i && S.teams!.length < TEAM_MAX) S.teams!.push([]); S.cur = Math.max(0, Math.min(i, S.teams!.length - 1)); S.team = S.teams![S.cur]; persist(S); };
const T = (S: CSave) => TIERS[Math.min(S.tier, TIERS.length - 1)];
const teamOf = (S: CSave) => S.team.map(id => S.roster.find(m => m.id === id)).filter(Boolean) as CMon[];
const dayOf = (S: CSave) => { if (S.day.id !== today()) S.day = { id: today(), win: 0, scout: 0, modes: {}, got: {} }; return S.day; };
/** 무료 스카우트: 12시간마다 한 마리 (일반 포켓몬). 남은 시간(시간 단위, 0 = 지금 가능) */
const FREE_MS = 12 * 36e5;
const freeLeft = (S: CSave) => Math.max(0, Math.ceil(((S.freeAt || 0) - Date.now()) / 36e5));
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
function Top({ title, sub, S, onBack, extra, noTk }: { title: string; sub?: string; S: CSave; onBack?: () => void; /** 오른쪽 표시들 가운데 맨 왼쪽에 붙는 작은 단추 (메인 화면의 스토리) */ extra?: any; /** 티켓 표시를 뺌 (메인 화면: 자리가 좁아 스카우트 단추에 대신 표시) */ noTk?: boolean }) {
	return <div class="cp-top">{onBack && <button class="cp-back" onClick={onBack} aria-label="뒤로" />}
		<b>{title}{sub && <small>{sub}</small>}</b>
		{extra}{!noTk && S.tk.regular > 0 && <span class="cp-chip t">티켓 {S.tk.regular}</span>}{!noTk && S.tk.pick > 0 && <span class="cp-chip t">지명 {S.tk.pick}</span>}<Bp /></div>;
}
/** 보여 줄 이름: 닉네임이 있으면 그것, 없으면 종 이름 (모습 이름은 붙이지 않음: 워시로토무 → 로토무) */
const monKo = (set: PSet) => shownName(set);
/** 담긴 볼 (없으면 몬스터볼) */
const ballOf = (set: PSet) => set.pokeball || 'pokeball';
const randomBall = () => rng.pick(allBalls()).id;
const types = (sp: string) => ((speciesData(sp, 9) as any)?.t || []) as string[];
/** 포켓몬 카드 (소개·로스터) */
function MonCard({ set, cls = '', mark, sub, onClick }: { set: PSet; cls?: string; mark?: any; sub?: string; onClick?: () => void }) {
	return <button class={'cp-card ' + cls} onClick={onClick}>{mark}
		<span class="cp-card-spr"><Sprite species={set.species} gen={9} size={56} anim={false} cls="front" shiny={set.shiny} /></span>
		<span class="cp-card-body"><b>{monKo(set)}{rarity(toID(set.species)) > 0 && <i class="cp-rare">{RARE[rarity(toID(set.species))]}</i>}</b><span>{types(set.species).map(t => <TypeBadge type={t} small />)}</span>
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

// ───────── 규칙 · 배틀 ─────────
type BattleKind = 'tower';
/** 규칙은 시뮬레이터 모드와 같이 설정에서 고른 것을 그대로 씀 */
const CR = () => loadSettings().battleRule;
const rotOf = (doubles: boolean) => ({ rule: CR(), doubles, pick: doubles ? 4 : 3, name: ruleById(CR()).name });
/** 상대 팀·소개에 준전설·전설이 섞이는 조건: 규칙이 허용하고 등급이 충분할 때 */
const legendOf = (S: CSave) => { const r = ruleById(CR()); return { allowSubLegend: r.sub === 'yes' && S.tier >= 2, allowLegend: r.restricted === 'yes' && S.tier >= 4 }; };
/** 같은 도구를 둘이 지녔으면 그 도구 id (챔피언스 모드는 모든 규칙에서 도구 중복 불가) */
const dupItem = (team: PSet[]) => { const seen = new Set<string>(); for (const s of team) { const i = toID(s.item); if (!i) continue; if (seen.has(i)) return i; seen.add(i); } return ''; };
const noItems = (team: PSet[]) => team.map(s => { s.item = ''; return s; });

/** 챔피언스 랭크 매치의 RP (싱글·더블 중 높은 쪽) · 그 등급 · 이야기 등급으로 친 단계(0 비기너 … 5 챔피언급) */
const RANK_CLS = ['비기너', '몬스터볼급', '슈퍼볼급', '하이퍼볼급', '마스터볼급', '챔피언급'];
const champRp = () => { const r = loadRecords().rp || {}, t = recTag(CR()) + CH_TAG; return Math.max(r['singles' + t] || 0, r['doubles' + t] || 0); };
const rankStep = () => Math.max(0, RANK_CLS.indexOf(rankTier(champRp(), new Date(), true).cls));
/** 다음 승급전에 도전할 수 있는가: 랭크 매치 등급이 지금 이야기 등급보다 높을 때 */
const promoReady = (S: CSave) => S.ch > 0 && S.ch < CHAPTERS.length && rankStep() > S.tier;
/** 배틀타워는 랭크 매치 하이퍼볼급부터 · PWT 는 마스터볼급부터 */
const towerOpen = () => rankStep() >= 3;
const pwtOpen = () => rankStep() >= 4;
/** PWT 대회가 잠긴 이유 (없으면 열림) */
const cupLock = (S: CSave, id: string) => { const c = S.cups || {}, left = REGION_CUPS.filter(x => !c[x]).length;
	if (REGION_CUPS.includes(id)) return c.open ? undefined : '오픈 대회에서 먼저 우승';
	return id === 'world' ? (left ? `지방 리더스를 모두 우승하면 열림 (남은 ${left}곳)` : undefined)
		: id === 'elite' ? ((c.world || 0) < CUP_NEED ? `월드 리더스 ${CUP_NEED}회 우승 (${c.world || 0} / ${CUP_NEED})` : undefined)
		: id === 'champions' ? ((c.elite || 0) < CUP_NEED ? `사천왕 대회 ${CUP_NEED}회 우승 (${c.elite || 0} / ${CUP_NEED})` : undefined) : undefined; };
/** 조건을 처음 채운 컷씬을 차례로 보여 주고, 새로 얻은 챔피언스 심볼을 알림 */
async function events(S: CSave, only?: string) {
	const c = S.cups || {}, tier = rankTier(champRp(), new Date(), true), tb = S.towerBest || 0;
	const cond: { [id: string]: boolean } = { tower0: only === 'tower', ...Object.fromEntries(TOWER_EVENTS.filter(e => e.at > 0).map(e => [e.id, tb >= e.at])), pwt: only === 'pwt', world: !cupLock(S, 'world'), elite: !cupLock(S, 'elite'), champs: !cupLock(S, 'champions'), pwtchamp: !!c.champions, rank1: tier.rank === 1 };
	for (const e of [...EVENTS, ...TOWER_EVENTS]) { if (!cond[e.id] || S.seen?.[e.id]) continue;
		S.seen = { ...(S.seen || {}), [e.id]: 1 }; persist(S);
		await fx('blinds'); await talk(e.lines, e.bg, ['EVENT', e.title]); await fx('fade'); }
	// 심볼: 은 → 금
	const lv: { [id: string]: number } = { rank: tier.rank === 1 ? 2 : tier.cls === '챔피언급' ? 1 : 0, pwt: c.champions ? 2 : c.world ? 1 : 0, tower: tb >= 49 ? 2 : tb >= 21 ? 1 : 0 };
	for (const y of CSYM) { if ((S.sym?.[y.id] || 0) >= lv[y.id]) continue;
		S.sym = { ...(S.sym || {}), [y.id]: lv[y.id] }; persist(S); sfx('heal');
		await ask<void>(r => <Screen key={K()} title="심볼 획득" cls="cp-scr" top><div class="cp-pn gold cp-result cp-symget"><SymbolIcon kind={y.icon} lv={lv[y.id]} size={96} /><h2>{y.name} ({lv[y.id] === 2 ? '금' : '은'})</h2><p>{lv[y.id] === 2 ? y.gold : y.silver}</p></div><button class="btn big primary" onClick={() => r()}>확인</button></Screen>); }
}
/** 랭크 매치·PWT 에 넘기는 연결: 지금 팀 · 어려운 척도 · 대회 해금 */
const arena = (S: CSave): ArenaCtx => ({ team: teamOf(S).map(m => cloneSet(m.set)), hard: true, cups: S.cups || {}, lock: id => cupLock(S, id),
	onCup: id => { S.cups = { ...(S.cups || {}), [id]: (S.cups?.[id] || 0) + 1 }; earnBP(EARN.set, 'PWT 우승'); persist(S); },
	onWin: () => { const d = dayOf(S); d.win++; persist(S); } });
/** 규칙·도구 중복 확인 (랭크 매치·PWT 입장 전) */
function teamOk(S: CSave) {
	const mine = teamOf(S).map(m => m.set), bad = teamRuleIssues(ruleById(CR()), mine);
	if (bad.length) { toast(`지금 규칙에 나갈 수 없는 포켓몬이 팀에 있어요: ${[...new Set(bad.map(b => speciesKo(b.species)))].join(' · ')}`); return false; }
	const dup = dupItem(mine); if (dup) { toast(`같은 도구(${itemKo(dup)})를 두 마리가 지닐 수 없어요 — 로스터에서 바꿔 주세요`); return false; }
	if (mine.length < 3) { toast('팀에 포켓몬이 3마리는 있어야 해요'); return false; }
	return true;
}
interface Opp { name: string; title?: string; sprite?: string; team: PSet[]; skill: number; line?: string; music?: string }
/** 엔트리를 고르고 한 판 (상대도 6마리 중에서 골라 나옴). 못 싸우면 null */
async function fight(S: CSave, mine: PSet[], opp: Opp, rot: { rule: string; doubles: boolean; pick: number; name: string }, label: string, bg: string): Promise<boolean | null> {
	const rule = ruleById(rot.rule);
	const bad = teamRuleIssues(rule, mine), ok = mine.filter(s => !bad.some(b => b.species === s.species));
	if (bad.length) toast(`지금 규칙(${rot.name})에 나갈 수 없음: ${[...new Set(bad.map(b => speciesKo(b.species) + (b.kind === 'item' ? `(${itemKo(b.item || '')})` : '')))].join(' · ')}`);
	if (ok.length < rot.pick) { toast(`규칙에 맞는 포켓몬이 ${rot.pick}마리 필요해요 (지금 ${ok.length}마리)`); return null; }
	const dup = dupItem(ok);
	if (dup) { toast(`같은 도구(${itemKo(dup)})를 두 마리가 지닐 수 없어요 — 로스터에서 바꿔 주세요`); return null; }
	let entry = ok;
	if (ok.length > rot.pick) {
		const p = await ask<PSet[] | null>(r => <PickScreen key={K()} title={label} team={ok} gen={9} count={rot.pick} opponent={{ name: opp.name, team: opp.team }}
			hint={`${rot.doubles ? '더블' : '싱글'} — ${rot.pick}마리를 골라 주세요`} onDone={r} onBack={() => r(null)} />);
		if (!p) return null;
		entry = p;
	}
	const foe = opp.team.length > rot.pick ? aiPickEntry(opp.team, entry, rot.pick, rot.doubles, opp.skill) : opp.team;
	await fx('battle');
	const res = await battle({ gen: 9, doubles: rot.doubles, aiSkill: opp.skill, bg: bg as any, music: (opp.music || 'battle') as any, label, noRecord: true, ruleId: rot.rule,
		p1: { name: playerName(), team: entry.map(cloneSet), sprite: playerSprite() }, p2: { name: opp.name, title: opp.title || '', team: foe, preview: opp.team.length > foe.length ? opp.team : undefined, sprite: opp.sprite, line: opp.line } } as any);
	// 배틀 화면이 닫히면서 음악을 멈추므로, 화면이 바뀐 뒤에 메인 음악을 다시 켬
	await fx('fade');
	playMusic(HUB_BGM);
	return res.win;
}
/** 이긴 뒤의 공통 처리: BP · 오늘의 미션 진행 */
function won(S: CSave, kind: BattleKind) {
	const d = dayOf(S); d.win++; d.modes[kind] = 1;
	earnBP(EARN.win, '챔피언스 · 승리'); persist(S);
}
const result = (title: string, heading: string, lines: string[]) => ask<void>(r => <Screen key={K()} title={title} cls="cp-scr" top><div class="cp-pn gold cp-result"><h2>{heading}</h2>{lines.map(l => <p>{l}</p>)}</div><button class="btn big primary" onClick={() => r()}>확인</button></Screen>);
/** 등급에 맞는 상대 6마리 (도구 중복 없음) */
const foeTeam = (S: CSave, t: typeof TIERS[number], doubles: boolean, extra: any = {}) => { const lg = legendOf(S);
	return dedupeItems(randomTeam({ gen: 9, size: 6, minBst: t.bst[0], maxBst: t.bst[1] + (lg.allowLegend ? 120 : lg.allowSubLegend ? 60 : 0), ...lg, doubles, quality: t.q, gimmicks: true, itemClause: true, ...extra })); };

async function towerBattle(S: CSave, doubles: boolean) {
	const rot = rotOf(doubles), mine = teamOf(S), t = T(S);
	const o = towerOpponent(S.tower, doubles ? 'doubles' : 'singles', mine.map(m => m.set));
	// 타워 상대도 6마리: 정해진 엔트리 뒤에 등급에 맞는 포켓몬을 채움
	const have = new Set(o.team.map(s => toID(s.species)));
	const team = dedupeItems([...o.team, ...randomTeam({ gen: 9, size: 6, minBst: t.bst[0], maxBst: t.bst[1], allowSubLegend: false, doubles, quality: t.q, exclude: have, itemClause: true }).slice(0, Math.max(0, 6 - o.team.length))]);
	const win = await fight(S, mine.map(m => m.set), { name: o.name, title: (o as any).title, sprite: (o as any).sprite, team, skill: o.skill, line: (o as any).line, music: (o as any).music || 'tower' }, rot, `챔피언스 타워 ${S.tower + 1}번째`, 'tower');
	if (win === null) return;
	dayOf(S).modes.tower = 1;
	const lines: string[] = [];
	if (win) {
		won(S, 'tower'); S.tower++; S.towerBest = Math.max(S.towerBest || 0, S.tower); lines.push(`+${EARN.win} BP · ${S.tower}연승`);
		if (S.tower % 7 === 0) { earnBP(EARN.set, '챔피언스 타워 7연승'); S.tk.pick++; lines.push(`7연승 세트 클리어! +${EARN.set} BP · 지명 티켓 1장`); }
	} else { lines.push(`${S.tower}연승에서 끝났습니다`); S.tower = 0; }
	persist(S);
	await result('배틀타워', win ? '승리!' : '패배…', lines);
	await events(S);
}

// ───────── 첫 파티 ─────────
/** 처음 받는 파티 후보 세 팀 (6마리씩, 서로 겹치지 않게, 저마다 어울리는 도구를 하나씩 — 팀 안에서 겹치지 않음) */
function makeStarts(): PSet[][] {
	const used = new Set<string>();
	return [0, 1, 2].map(() => { const t = dedupeItems(randomTeam({ gen: 9, size: 6, minBst: 420, maxBst: 540, allowSubLegend: false, quality: 0.5, exclude: used, itemClause: true })); t.forEach(s => used.add(toID(s.species))); return t; });
}
function StartPick({ S, done }: { S: CSave; done: (i: number) => void }) {
	const [view, setView] = useState<number | null>(null), ps = S.starts || [];
	return <Screen title="첫 파티" cls="cp-scr" top><Top title="첫 파티 고르기" sub="여섯 마리가 한 팀으로 들어옵니다" S={S} />
		{ps.map((p, i) => <div class="cp-pn cp-start"><h3>파티 {'ABC'[i]}<small>{[...new Set(p.flatMap(s => types(s.species)))].slice(0, 6).map(typeKo).join(' · ')}</small></h3>
			<div class="cp-start-mons">{p.map(s => <span><PokeIcon species={s.species} />{s.item && <span class="cp-held"><ItemIcon item={s.item} size={16} /></span>}<small class={slotCls(monKo(s))}>{monKo(s)}</small></span>)}</div>
			<div class="cp-fmt"><button class="btn" onClick={() => setView(i)}>살펴보기</button><button class="btn primary" onClick={() => done(i)}>이 파티로 시작</button></div></div>)}
		<p class="cp-note">여섯 마리 모두 어울리는 도구를 지니고 옵니다. 기술·성격·능력 포인트는 로스터에서 다듬을 수 있어요. 다른 포켓몬은 스카우트로 데려옵니다.</p>
		{view !== null && <Modal title={`파티 ${'ABC'[view]}`} onClose={() => setView(null)}>
			<div class="cp-opts">{ps[view].map(s => <div class="cp-opt"><PokeIcon species={s.species} /><div><b>{speciesKo(s.species)} {types(s.species).map(t => <TypeBadge type={t} small />)}</b>
				<small>{abilityKo(s.ability)} · {natureKo(s.nature)}{s.item ? ` · ${itemKo(s.item)}` : ''}</small><small>{s.moves.map(moveKo).join(' · ')}</small></div>{s.item && <ItemIcon item={s.item} size={24} />}</div>)}</div>
			<button class="btn big primary" onClick={() => done(view)}>이 파티로 시작</button></Modal>}
	</Screen>;
}
async function startFlow(S: CSave) {
	if (!S.starts?.length) { S.starts = makeStarts(); persist(S); }
	while (true) {
		const i = await ask<number>(r => <StartPick key={K()} S={S} done={r} />), p = S.starts![i];
		if (!(await confirmBox(`파티 ${'ABC'[i]}`, `이 여섯 마리와 시작할까요?\n${p.map(s => speciesKo(s.species)).join(' · ')}`, '시작한다', '다시 고르기'))) continue;
		for (const s of p) { addMon(S, s); if (s.item) S.items[toID(s.item)] = 1; }   // 들고 온 도구도 내 것이 됨
		dayOf(S).scout = 0; S.starts = undefined; persist(S); sfx('heal');
		toast('여섯 마리가 팀에 들어왔습니다!');
		return;
	}
}

// ───────── 스카우트 ─────────
/** 새 소개 10마리 (지금 규칙·등급에 맞는 포켓몬, 가진 포켓몬은 빼고, 도구 없이). 찜은 세 번 안에 꼭 나오고, 타입 지정이 있으면 절반이 그 타입 */
function newLineup(S: CSave) {
	const t = T(S), have = new Set(S.roster.map(m => toID(m.set.species))), rule = ruleById(CR()), lg = legendOf(S);
	const pool = rng.shuffle(speciesPool({ gen: 9, minBst: t.bst[0], maxBst: t.bst[1] + 40, allowSubLegend: false })).filter(id => !have.has(id));
	// 규칙이 허용하고 등급이 오르면 준전설(슈퍼볼급~)·초전설·환상(마스터볼급~)이 한 마리씩 섞여 나옴 (값은 2배·4배)
	const special = (lv: number) => rng.shuffle(speciesPool({ gen: 9, minBst: 500, allowSubLegend: true, allowLegend: lv === 2 } as any)).find(id => rarity(id) === lv && !have.has(id) && speciesAllowed(rule, id));
	const pickN: string[] = [];
	const wants = S.wish.filter(w => !have.has(w));
	if (wants.length && (S.wishMiss >= 2 || Math.random() < 0.34)) { pickN.push(rng.pick(wants)); S.wishMiss = 0; } else if (wants.length) S.wishMiss++;
	if (S.typeNext) { for (const id of pool) { if (pickN.length >= 6) break; if (!pickN.includes(id) && types(id).some(x => x === S.typeNext)) pickN.push(id); } S.typeNext = undefined; }
	if (lg.allowSubLegend) { const x = special(1); if (x) pickN.push(x); }
	if (lg.allowLegend) { const x = special(2); if (x) pickN.push(x); }
	for (const id of pool) { if (pickN.length >= 10) break; if (!pickN.includes(id)) pickN.push(id); }
	S.lineup = noItems(pickN.map(id => randomSetFor(id, 9, 50, false, 0.65)));
	for (const x of S.lineup) x.pokeball = randomBall();   // 담긴 볼은 무작위
	S.lineDay = today(); persist(S);
}
const addMon = (S: CSave, set: PSet) => { const m: CMon = { id: S.seq++, set: cloneSet(set) }; if (!m.set.pokeball) m.set.pokeball = randomBall(); dayOf(S).scout++; S.roster.push(m); if (S.team.length < 6) S.team.push(m.id); persist(S); return m; };
type ScoutAct = { k: 'back' } | { k: 'mon'; i: number } | { k: 'refresh' } | { k: 'type' } | { k: 'pick' } | { k: 'wish' };
function ScoutScreen({ S, top, done }: { S: CSave; top?: boolean; done: (a: ScoutAct) => void }) {
	const fl = freeLeft(S), [view, setView] = useState<number | null>(null), v = view !== null ? S.lineup[view] : null;
	return <Screen title="스카우트" onBack={() => done({ k: 'back' })} cls="cp-scr" top={top}><Top title="스카우트" sub={`오늘의 소개 ${S.lineup.length}마리 · 내일 새로 옵니다`} S={S} onBack={() => done({ k: 'back' })} />
		<div class={'cp-free' + (fl ? '' : ' on')}><b>무료 스카우트</b><span>{fl ? `${fl}시간 뒤에 다시` : '지금 1마리 무료!'}</span>{S.tk.regular > 0 && <em>티켓 {S.tk.regular}장</em>}</div>
		<div class="cp-grid">{S.lineup.map((s, i) => <MonCard set={s} cls={S.wish.includes(toID(s.species)) ? 'rare' : ''} mark={<i class="cp-price">{scoutLabel(S, toID(s.species))}</i>} onClick={() => setView(i)} />)}</div>
		{!S.lineup.length && <p class="cp-note">오늘 소개받은 포켓몬을 모두 데려갔어요.</p>}
		<div class="cp-pn"><h3>원하는 포켓몬을 데려오려면</h3>
			<button class="cp-line" onClick={() => done({ k: 'pick' })}><div><b>지명 스카우트</b><small>도감에서 직접 골라 영입</small></div><span class="cp-cost">{S.tk.pick > 0 ? `지명 티켓 ${S.tk.pick}` : `${PRICE.pick} BP`}</span></button>
			<button class="cp-line" onClick={() => done({ k: 'wish' })}><div><b>찜 ({S.wish.length} / 3)</b><small>{S.wish.length ? S.wish.map(speciesKo).join(' · ') : '찜한 포켓몬은 소개 3번 안에 반드시 등장'}</small></div><span class="cp-cost">무료</span></button>
			<button class="cp-line" onClick={() => done({ k: 'type' })}><div><b>타입 지정{S.typeNext ? ` — 다음 소개: ${typeKo(S.typeNext)}` : ''}</b><small>다음 소개의 절반이 그 타입</small></div><span class="cp-cost">{PRICE.typeTicket} BP</span></button>
			<button class="cp-line" onClick={() => done({ k: 'refresh' })}><div><b>지금 새 소개 받기</b><small>내일을 기다리지 않고 10마리를 새로</small></div><span class="cp-cost">{PRICE.refresh} BP</span></button></div>
		<p class="cp-note">스카우트한 포켓몬은 도구 없이 옵니다 (도구는 상점). 값은 {PRICE.scout} BP, 준전설 ×2 · 전설 ×4. 일반 포켓몬은 12시간마다 한 마리 무료.</p>
		{v && <Modal title={speciesKo(v.species)} onClose={() => setView(null)}><p class="cp-ballline"><ItemIcon item={ballOf(v)} size={16} />{itemKo(ballOf(v))}에 담겨 있음</p><MonDetail set={v} gen={9} />
			<button class="btn big primary" onClick={() => done({ k: 'mon', i: view! })}>스카우트 ({scoutLabel(S, toID(v.species))})</button></Modal>}
	</Screen>;
}
/** 도감에서 포켓몬 고르기 (지명·찜) */
function SpeciesPick({ title, pool, hint, done }: { title: string; pool: string[]; hint: string; done: (id: string | null) => void }) {
	const [q, setQ] = useState('');
	const list = pool.filter(id => matches(q, speciesKo(id), id)).slice(0, 60);
	return <Screen title={title} onBack={() => done(null)} cls="cp-scr" top>
		<p class="cp-note">{hint}</p>
		<input class="cp-search" placeholder="이름으로 찾기 (초성 가능: ㄹㅌㅁ)" value={q} onInput={e => setQ((e.target as HTMLInputElement).value.trim())} />
		<div class="cp-list">{list.map(id => <button class="cp-row" onClick={() => done(id)}><PokeIcon species={id} /><b>{speciesKo(id)}</b><span>{types(id).map(t => <TypeBadge type={t} small />)}</span></button>)}</div>
		{list.length >= 60 && <p class="cp-note">이름을 입력하면 더 좁혀집니다.</p>}
	</Screen>;
}
const pickable = (S: CSave) => { const lg = legendOf(S), rule = ruleById(CR()); return speciesPool({ gen: 9, minBst: 300, ...lg } as any).filter(id => speciesAllowed(rule, id) && !S.roster.some(m => toID(m.set.species) === id)).sort((a, b) => speciesKo(a).localeCompare(speciesKo(b), 'ko')); };
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
async function scoutFlow(S: CSave) {
	if (S.lineDay !== today()) newLineup(S);
	let first = true;
	while (true) {
		const a = await ask<ScoutAct>(r => <ScoutScreen key={K()} S={S} top={first} done={r} />);
		first = false;
		if (a.k === 'back') return;
		if (a.k === 'mon') {
			const s = S.lineup[a.i], name = speciesKo(s.species);
			if (full(S) || !payScout(S, 'regular', name, toID(s.species))) continue;
			addMon(S, s); S.lineup.splice(a.i, 1); persist(S); sfx('heal');
			toast(`${josa(name, '을', '를')} 영입했습니다!`);
		}
		if (a.k === 'refresh') { if (pay(PRICE.refresh, '챔피언스 · 새 소개')) { newLineup(S); } }
		if (a.k === 'type') {
			const t = await ask<string | null>(r => <ChoiceScreen key={K()} top title="타입 지정" intro={<p class="cp-note">다음에 받는 소개의 절반이 고른 타입으로 나옵니다 ({PRICE.typeTicket} BP).</p>} onBack={() => r(null)}
				options={ALL_TYPES.map(x => ({ value: x, label: typeKo(x) }))} onPick={r} />);
			if (t && pay(PRICE.typeTicket, '챔피언스 · 타입 지정')) { S.typeNext = t; persist(S); toast(`다음 소개에 ${typeKo(t)} 타입이 많이 나옵니다`); }
		}
		if (a.k === 'pick') {
			const lg = legendOf(S);
			const id = await ask<string | null>(r => <SpeciesPick key={K()} title="지명 스카우트" pool={pickable(S)} hint={`도감에서 골라 바로 영입합니다 — ${S.tk.pick > 0 ? `지명 티켓 1장 (가진 수 ${S.tk.pick})` : `${PRICE.pick} BP`}${lg.allowSubLegend ? ` · 준전설 ${PRICE.pick * 2} BP${lg.allowLegend ? ` · 전설 ${PRICE.pick * 4} BP` : ''}` : ''}`} done={r} />);
			if (!id || full(S)) continue;
			const set = randomSetFor(id, 9, 50, false, 0.7), name = speciesKo(id);
			set.item = '';
			if (!(await confirmBox('지명 스카우트', `${josa(name, '을', '를')} 영입할까요?\n${natureKo(set.nature)} · ${abilityKo(set.ability)}\n${set.moves.map(moveKo).join(' · ')}`, '영입한다', '그만두기'))) continue;
			if (!payScout(S, 'pick', name, id)) continue;
			addMon(S, set); S.wish = S.wish.filter(w => w !== id); persist(S); sfx('heal'); toast(`${josa(name, '을', '를')} 영입했습니다!`);
		}
		if (a.k === 'wish') {
			if (S.wish.length >= 3) { const i = await ask<number | null>(r => <ChoiceScreen key={K()} top title="찜 목록" intro={<p class="cp-note">찜은 3마리까지예요. 뺄 포켓몬을 고르세요.</p>} onBack={() => r(null)} options={S.wish.map((w, k) => ({ value: k, label: speciesKo(w) + ' 빼기' }))} onPick={r} />); if (i !== null) { S.wish.splice(i, 1); persist(S); } continue; }
			const id = await ask<string | null>(r => <SpeciesPick key={K()} title="찜하기" pool={pickable(S).filter(x => !S.wish.includes(x))} hint="찜한 포켓몬은 소개 3번 안에 반드시 한 마리가 나옵니다. (값은 보통 스카우트와 같아요)" done={r} />);
			if (id) { S.wish.push(id); persist(S); toast(`${josa(speciesKo(id), '을', '를')} 찜했습니다`); }
		}
	}
}

// ───────── 로스터 · 트레이닝 (팝업 창) ─────────
const STAT_NAME = ['HP', '공격', '방어', '특공', '특방', '스피드'];
const CAT_KO: { [k: string]: string } = { Physical: '물리', Special: '특수', Status: '변화' };
const BOX = 30;
/** 팀 칸의 이름: 길면 글자를 줄여서 잘리지 않게 */
const slotCls = (n: string) => n.length >= 6 ? 'n6' : n.length === 5 ? 'n5' : n.length === 4 ? 'n4' : '';
/** 상점에서 파는 보통 도구 (이 밖의 가진 도구는 메가스톤 — 그 포켓몬 것만 보여 줌) */
const PLAIN_ITEMS = new Set([...START_ITEMS, ...SHOP.flatMap(c => c[2])]);
type Sub = null | 'nick' | 'item' | 'nature' | 'ability' | 'sp' | 'tera' | 'detail' | { move: number };
function RosterScreen({ S, done }: { S: CSave; done: () => void }) {
	const [page, setPage] = useState(0), [sel, setSel0] = useState<CMon | null>(null), [sub, setSub] = useState<Sub>(null), [, tick] = useState(0);
	/** 고치는 중인 사본: 저장을 눌러야 값을 치르고 반영됨 */
	const [draft, setDraft] = useState<PSet | null>(null);
	const setSel = (m: CMon | null) => { setSel0(m); setDraft(m ? cloneSet(m.set) : null); setSub(null); };
	const re = () => { persist(S); tick(x => x + 1); };
	const pages = Math.max(1, Math.ceil(T(S).cap / BOX)), team = teamOf(S);
	const box = S.roster.slice(page * BOX, page * BOX + BOX), cap = Math.min(BOX, T(S).cap - page * BOX);
	const cell = (m: CMon | undefined, k: number) => <button class={'cp-cell' + (m ? '' : ' empty') + (m && S.team.includes(m.id) ? ' in' : '')} disabled={!m} onClick={() => m && setSel(m)} key={k}>
		{m && <PokeIcon species={m.set.species} />}{m && m.set.item && <span class="cp-held"><ItemIcon item={m.set.item} size={16} /></span>}{m && S.team.includes(m.id) && <i>{S.team.indexOf(m.id) + 1}</i>}</button>;
	return <Screen title="로스터" onBack={done} cls="cp-scr" top><Top title="로스터" sub={`${S.roster.length} / ${T(S).cap}마리 · 팀 ${S.team.length} / 6`} S={S} onBack={done} />
		<div class="cp-pc"><div class="cp-party"><b class="cp-teamsel"><button class="cp-arw prev" disabled={(S.cur || 0) <= 0} onClick={() => { useTeam(S, (S.cur || 0) - 1); tick(x => x + 1); }} aria-label="앞 팀" />
			<span>팀 {(S.cur || 0) + 1}<small>{S.team.length} / 6 · 팀 {S.teams?.length || 1} / {TEAM_MAX}</small></span>
			<button class="cp-arw" disabled={(S.cur || 0) >= TEAM_MAX - 1} onClick={() => { useTeam(S, (S.cur || 0) + 1); tick(x => x + 1); }} aria-label="다음 팀" /></b><div>{[0, 1, 2, 3, 4, 5].map(k => <button class={'cp-slot' + (team[k] ? '' : ' empty')} disabled={!team[k]} onClick={() => team[k] && setSel(team[k])}>
			{team[k] ? <><PokeIcon species={team[k].set.species} />{team[k].set.item && <span class="cp-held"><ItemIcon item={team[k].set.item} size={16} /></span>}<small class={slotCls(monKo(team[k].set))}>{monKo(team[k].set)}</small></> : null}</button>)}</div></div>
		<div class="cp-box">
			<div class="cp-box-head"><button disabled={page <= 0} onClick={() => setPage(page - 1)} aria-label="앞 박스" class="prev" /><b>박스 {page + 1}{pages > 1 && <small>/ {pages}</small>}</b><button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="다음 박스" /></div>
			<div class="cp-box-grid">{Array.from({ length: cap }, (_, k) => cell(box[k], k))}</div>
		</div></div>
		<p class="cp-note">포켓몬을 누르면 팀에 넣고 빼기·도구·트레이닝 창이 열립니다. 숫자가 붙은 포켓몬이 지금 팀입니다. 팀은 화살표로 넘겨 {TEAM_MAX}개까지 따로 짤 수 있고, 지금 보이는 팀으로 배틀에 나갑니다.</p>
		{sel && draft && !sub && <MonPop S={S} m={sel} d={draft} open={setSub} close={() => setSel(null)} re={re} />}
		{sel && draft && sub && <SubPop S={S} m={sel} d={draft} sub={sub} back={() => { setSub(null); tick(x => x + 1); }} />}
	</Screen>;
}
/** 트레이닝 값: 원래 세트와 고친 사본을 견주어 바뀐 항목만 (특성·성격·테라·능력 포인트 + 바뀐 기술 칸마다) */
function trainCost(o: PSet, d: PSet) {
	const tera = (x: PSet) => x.teraType || types(x.species)[0];
	const parts: [string, number][] = [];
	if (toID(o.ability) !== toID(d.ability)) parts.push(['특성', PRICE.ability]);
	if (toID(o.nature) !== toID(d.nature)) parts.push(['성격', PRICE.nature]);
	if (tera(o) !== tera(d)) parts.push(['테라 타입', PRICE.tera]);
	if (STAT_KEYS.some(k => (o.evs[k] || 0) !== (d.evs[k] || 0))) parts.push(['능력 포인트', PRICE.sp]);
	const mv = [0, 1, 2, 3].filter(k => (o.moves[k] || '') !== (d.moves[k] || '')).length;
	if (mv) parts.push([`기술 ${mv}개`, mv * PRICE.move]);
	return { parts, total: parts.reduce((a, x) => a + x[1], 0), dirty: parts.length > 0 || toID(o.item) !== toID(d.item) || shownName(o) !== shownName(d) };
}
/** 포켓몬 창: 줄을 누르면 그 항목을 고르는 창이 열림. 고친 것은 「저장」을 눌러야 한 번에 값을 치르고 반영됨 */
function MonPop({ S, m, d, open, close, re }: { S: CSave; m: CMon; d: PSet; open: (s: Sub) => void; close: () => void; re: () => void }) {
	const o = m.set, inTeam = S.team.includes(m.id), sp = spOf(d), name = monKo(d), nat = NATURES.find(n => n[0] === toID(d.nature));
	const c = trainCost(o, d), ch = (label: string) => c.parts.some(x => x[0] === label);
	const row = (k: Sub, label: string, val: any, cost?: number, changed = false) => <button class={'cp-mrow' + (changed ? ' ch' : '')} onClick={() => open(k)}><small>{label}</small><b>{val}</b><em class={cost === undefined ? 'free' : ''}>{cost === undefined ? '무료' : (changed ? '+' : '') + cost + ' BP'}</em></button>;
	const toggle = () => { if (inTeam) S.team = S.team.filter(i => i !== m.id); else if (S.team.length >= 6) { toast('팀은 6마리까지예요. 먼저 한 마리를 빼 주세요'); return; } else S.team.push(m.id); re(); };
	const release = async () => { if (await confirmBox('내보내기', `${josa(name, '을', '를')} 내보낼까요? 되돌릴 수 없어요.`, '내보낸다', '그만두기')) { S.roster = S.roster.filter(x => x !== m); S.team = S.team.filter(i => i !== m.id); syncTeams(S); S.teams = S.teams!.map(t => t.filter(i => i !== m.id)); S.team = S.teams[S.cur!]; re(); close(); } };
	const saveAll = () => {
		if (c.total && !pay(c.total, `챔피언스 · ${name} 트레이닝 (${c.parts.map(x => x[0]).join('·')})`)) return;
		if (d.item) for (const x of S.roster) if (x !== m && toID(x.set.item) === toID(d.item)) x.set.item = '';   // 같은 도구는 한 마리만: 가져옴
		m.set = cloneSet(d); if (c.total) sfx('statUp'); re(); toast(c.total ? `저장했습니다 (−${c.total} BP)` : '저장했습니다'); close();
	};
	const tryClose = async () => { if (!c.dirty || await confirmBox('저장하지 않음', '고친 내용을 저장하지 않고 닫을까요?', '닫는다', '계속 고치기')) close(); };
	const spText = STAT_KEYS.map((k, i) => sp[k] ? `${STAT_NAME[i]} ${sp[k]}` : '').filter(Boolean).join(' · ') || '나누지 않음';
	return <Modal title={name} onClose={tryClose}><div class="cp-mp">
		<div class="cp-mp-head"><span class="cp-mp-spr"><Sprite species={o.species} gen={9} size={64} anim={false} cls="front" shiny={o.shiny} /></span>
			<div><span>{types(o.species).map(t => <TypeBadge type={t} small />)}{rarity(toID(o.species)) > 0 && <i class="cp-rare">{RARE[rarity(toID(o.species))]}</i>}</span><small class="cp-ball"><ItemIcon item={ballOf(o)} size={16} />{itemKo(ballOf(o))}</small><small>{speciesKo(o.species)} · {inTeam ? `팀 ${S.team.indexOf(m.id) + 1}번째` : '박스에 있음'}</small></div>
			<button class={'btn small' + (inTeam ? '' : ' primary')} onClick={toggle}>{inTeam ? '팀에서 빼기' : '팀에 넣기'}</button></div>
		<div class="cp-mrows">
			{row('nick', '닉네임', isNick(d.name, d.species) ? d.name : <small>없음 ({nickKo(d.species)})</small>, undefined, (isNick(o.name, o.species) ? o.name : '') !== (isNick(d.name, d.species) ? d.name : ''))}
			{row('item', '도구', d.item ? <><ItemIcon item={d.item} size={24} />{itemKo(d.item)}</> : '없음', undefined, toID(o.item) !== toID(d.item))}
			{row('ability', '특성', abilityKo(d.ability), PRICE.ability, ch('특성'))}
			<p class="cp-mdesc">{abilityDesc(d.ability)}</p>
			{row('nature', '성격', <>{natureKo(d.nature)}{nat?.[1] ? <small> {nat[1]}↑ {nat[2]}↓</small> : null}</>, PRICE.nature, ch('성격'))}
			{row('tera', '테라 타입', <TypeBadge type={d.teraType || types(d.species)[0]} small />, PRICE.tera, ch('테라 타입'))}
			{row('sp', '능력 포인트', <small>{spText}</small>, PRICE.sp, ch('능력 포인트'))}
		</div>
		<div class="cp-mmoves">{[0, 1, 2, 3].map(k => { const md = d.moves[k] ? moveData(d.moves[k], 9) : null, changed = (o.moves[k] || '') !== (d.moves[k] || ''); return <button class={changed ? 'ch' : ''} onClick={() => open({ move: k })}>
			{md && <TypeBadge type={md.type} small />}<b>{d.moves[k] ? moveKo(d.moves[k]) : '(빈 칸)'}</b><em>{changed ? '+' : ''}{PRICE.move} BP</em></button>; })}</div>
		<div class="cp-msave"><span>{c.parts.length ? c.parts.map(x => `${x[0]} ${x[1]}`).join(' · ') : c.dirty ? '도구·닉네임만 바꿈 (무료)' : '고친 항목이 없습니다'}</span>
			<button class="btn primary" disabled={!c.dirty} onClick={saveAll}>저장{c.total ? ` (총 ${c.total} BP)` : ''}</button></div>
		<div class="cp-mfoot"><button class="btn small" onClick={() => open('detail')}>능력치 자세히</button><button class="btn small ghost" onClick={release}>내보내기</button></div>
	</div></Modal>;
}
/** 능력 포인트 나누기 (한 능력 32, 합계 66) */
function SpBody({ set, done }: { set: PSet; done: (sp: { [k: string]: number }) => void }) {
	const [sp, setSp] = useState<{ [k: string]: number }>(() => ({ ...spOf(set) }));
	const sum = STAT_KEYS.reduce((a, k) => a + sp[k], 0);
	const ch = (k: string, d: number) => { const v = Math.max(0, Math.min(SP_MAX, sp[k] + d)); if (d > 0 && sum - sp[k] + v > SP_TOTAL) return; setSp({ ...sp, [k]: v }); };
	return <div class="cp-spb"><p class="cp-note">한 능력에 {SP_MAX}까지 · 남은 포인트 <b class="cp-y">{SP_TOTAL - sum}</b> / {SP_TOTAL}</p>
		{STAT_KEYS.map((k, i) => <div class="cp-sp"><b>{STAT_NAME[i]}</b><button class="btn small" onClick={() => ch(k, -4)}>−4</button><button class="btn small" onClick={() => ch(k, -1)}>−</button>
			<i><span style={{ width: sp[k] / SP_MAX * 100 + '%' }} /></i><em>{sp[k]}</em><button class="btn small" onClick={() => ch(k, 1)}>＋</button><button class="btn small" onClick={() => ch(k, 4)}>＋4</button></div>)}
		<button class="btn big primary" onClick={() => done(sp)}>이대로 정하기</button></div>;
}
interface Opt { icon?: any; label: string; desc?: string; note?: string; off?: boolean; run: () => void }
type Grid = '' | 'grid' | 'grid two';
/** 항목을 고르는 창: 고친 사본(d)에만 적고 포켓몬 창으로 돌아감 — 값은 포켓몬 창의 「저장」에서 한 번에 */
function SubPop({ S, m, d, sub, back }: { S: CSave; m: CMon; d: PSet; sub: Exclude<Sub, null>; back: () => void }) {
	const s = d, name = monKo(s), [q, setQ] = useState(''), [nick, setNick] = useState(isNick(d.name, d.species) ? d.name : '');
	const apply = (_cost: number, _why: string, f: () => void) => { f(); back(); };
	if (sub === 'nick') return <Modal title="닉네임" onClose={back}><div class="cp-nick">
		<input class="cp-search" maxLength={12} placeholder={nickKo(s.species)} value={nick} onInput={e => setNick((e.target as HTMLInputElement).value.replace(/[,|[\]]/g, ''))} />
		<p class="cp-note">12자까지. 비워 두면 종 이름({nickKo(s.species)})으로 나옵니다. 닉네임은 무료예요.</p>
		<div class="cp-fmt"><button class="btn" onClick={() => { s.name = nickKo(s.species); back(); }}>지우기</button><button class="btn primary" onClick={() => { s.name = nick.trim() || nickKo(s.species); back(); }}>확인</button></div></div></Modal>;
	if (sub === 'detail') return <Modal title={name} onClose={back}><MonDetail set={s} gen={9} /></Modal>;
	void S; void m;
	if (sub === 'sp') return <Modal title={`${name} · 능력 포인트`} onClose={back}><SpBody set={s} done={sp => apply(PRICE.sp, '능력 포인트', () => { for (const k of STAT_KEYS) s.evs[k] = spToEv(sp[k]); })} /></Modal>;
	if (sub === 'nature') return <Modal title={`성격 · ${PRICE.nature} BP`} onClose={back}><NatureTable value={s.nature} onPick={id => { apply(PRICE.nature, '성격', () => { s.nature = id; }); }} /></Modal>;
	let title = '', cost = 0, why = '', search = false, opts: Opt[] = [], grid: Grid = '';
	if (sub === 'item') {
		title = '지닌 도구'; why = '도구'; search = true;
		const stones = megaStonesFor(s.species), own = Object.keys(S.items).filter(id => PLAIN_ITEMS.has(id) || stones.includes(id));
		opts = [{ label: '없음', off: !s.item, run: () => { s.item = ''; } }, ...own.map(id => { const holder = S.roster.find(x => x !== m && toID(x.set.item) === id), cur = toID(s.item) === id;
			return { icon: <ItemIcon item={id} size={24} />, label: itemKo(id), desc: itemDesc(id), note: cur ? '지금' : holder ? `${monKo(holder.set)}에게서 가져옴 (저장할 때)` : '', off: cur, run: () => { s.item = id; } }; })];
	} else if (sub === 'ability') {
		title = '특성'; cost = PRICE.ability; why = '특성';
		opts = (((speciesData(s.species, 9) as any)?.ab || []) as string[]).map(x => ({ label: abilityKo(x), desc: abilityDesc(x), note: toID(x) === toID(s.ability) ? '지금' : '', off: toID(x) === toID(s.ability), run: () => { s.ability = x; } }));
	} else if (sub === 'tera') {
		title = '테라스탈 타입'; cost = PRICE.tera; why = '테라스탈 타입'; grid = 'grid';
		opts = ALL_TYPES.map(x => ({ icon: <TypeBadge type={x} small />, label: typeKo(x), off: s.teraType === x, run: () => { s.teraType = x; } }));
	} else {
		const i = sub.move; title = `${s.moves[i] ? moveKo(s.moves[i]) : '빈 칸'} 바꾸기`; cost = PRICE.move; why = '기술'; search = true;
		opts = learnset(s.species, 9).filter(x => !s.moves.includes(x)).sort((x, y) => moveKo(x).localeCompare(moveKo(y), 'ko')).map(x => { const md = moveData(x, 9);
			return { icon: md ? <TypeBadge type={md.type} small /> : null, label: moveKo(x), desc: md ? `${CAT_KO[md.category] || ''}${md.basePower ? ` · 위력 ${md.basePower}` : ''}${typeof md.accuracy === 'number' && md.accuracy > 0 && md.accuracy <= 100 ? ` · 명중 ${md.accuracy}` : ''}` : '', run: () => { s.moves[i] = x; } }; });
	}
	const list = opts.filter(o => matches(q, o.label));
	return <Modal title={`${title}${cost ? ` · ${cost} BP` : ''}`} onClose={back}>
		{search && <input class="cp-search" placeholder="이름으로 찾기 (초성 가능)" value={q} onInput={e => setQ((e.target as HTMLInputElement).value.trim())} />}
		<div class={'cp-opts ' + grid}>{list.slice(0, 120).map(o => <button class={'cp-opt' + (grid && o.off ? ' cur' : '')} disabled={o.off} onClick={() => apply(cost, why, o.run)}>{o.icon}<div><b>{o.label}{o.note === '지금' && <em>지금</em>}</b>{o.note && o.note !== '지금' && <em class="ln">{o.note}</em>}{o.desc && <small>{o.desc}</small>}</div></button>)}
			{!list.length && <p class="cp-note">맞는 항목이 없어요.</p>}</div>
		{sub === 'item' && <p class="cp-note">같은 도구는 한 마리만 지닐 수 있어요. 새 도구는 상점에서 삽니다.</p>}
	</Modal>;
}

// ───────── 상점 · 미션 ─────────
function ShopScreen({ S, done }: { S: CSave; done: (cosmetic?: boolean) => void }) {
	const stones = [...new Set(S.roster.flatMap(m => megaStonesFor(m.set.species)))];
	const cats: [string, number, string[]][] = [...SHOP.map(([name, kind, ids]) => [name, PRICE[kind], ids] as [string, number, string[]]), ['메가스톤', PRICE.mega, stones]];
	const [tab, setTab] = useState(0), [q, setQ] = useState(''), [, tick] = useState(0);
	const buy = (id: string, cost: number) => { if (S.items[id]) return; if (!pay(cost, `챔피언스 · ${itemKo(id)}`)) return; S.items[id] = 1; persist(S); tick(x => x + 1); };
	const rows: [string, number][] = q ? cats.flatMap(([, c, ids]) => ids.filter(id => matches(q, itemKo(id))).map(id => [id, c] as [string, number])) : cats[tab][2].map(id => [id, cats[tab][1]] as [string, number]);
	return <Screen title="상점" onBack={() => done()} cls="cp-scr" top><Top title="상점" sub="도구는 한 번 사면 계속 씁니다" S={S} onBack={() => done()} />
		<input class="cp-search" placeholder="도구 이름으로 찾기 (초성 가능)" value={q} onInput={e => setQ((e.target as HTMLInputElement).value.trim())} />
		<div class="cp-tabs">{cats.map(([n, , ids], i) => <button class={!q && i === tab ? 'on' : ''} onClick={() => { setQ(''); setTab(i); }}>{n} <small>{ids.filter(id => S.items[id]).length}/{ids.length}</small></button>)}
			<button class="cos" onClick={() => done(true)}>꾸미기</button></div>
		<div class="cp-pn cp-shoplist">
			{!rows.length && <p class="cp-note">{q ? '맞는 도구가 없어요.' : '내 로스터의 포켓몬이 쓸 수 있는 메가스톤이 여기에 진열됩니다.'}</p>}
			{rows.map(([id, cost]) => <div class="cp-line"><ItemIcon item={id} size={24} /><div><b>{itemKo(id)}</b><small>{itemDesc(id)}</small></div>
				{S.items[id] ? <span class="cp-own">가짐</span> : <button class="btn small yellow" onClick={() => buy(id, cost)}>{cost} BP</button>}</div>)}</div>
		<p class="cp-note">산 도구는 로스터에서 포켓몬을 눌러 지니게 합니다. 「꾸미기」는 아케이드 모드와 같은 BP 교환소입니다.</p>
	</Screen>;
}
const MISSIONS: { id: string; name: string; bp: number; prog: (d: CSave['day']) => [number, number] }[] = [
	{ id: 'w3', name: '배틀에서 3승', bp: 3, prog: d => [d.win, 3] },
	{ id: 'sc', name: '포켓몬을 1마리 스카우트', bp: 2, prog: d => [d.scout || 0, 1] },
	{ id: 'all', name: '랭크 매치 · PWT · 배틀타워에 한 번씩 참가', bp: 4, prog: d => [['rank', 'pwt', 'tower'].filter(k => d.modes[k]).length, 3] },
];
const missionReady = (S: CSave) => MISSIONS.filter(m => { const [a, b] = m.prog(dayOf(S)); return a >= b && !S.day.got[m.id]; }).length;
function MissionScreen({ S, done }: { S: CSave; done: () => void }) {
	const [, tick] = useState(0), d = dayOf(S);
	return <Screen title="미션" onBack={done} cls="cp-scr" top><Top title="오늘의 미션" sub="날마다 새로 시작" S={S} onBack={done} />
		<div class="cp-pn">{MISSIONS.map(m => { const [a, b] = m.prog(d), ok = a >= b; return <div class="cp-line"><div><b>{m.name}</b><i class="cp-bar"><span style={{ width: Math.min(100, a / b * 100) + '%' }} /></i></div>
			{d.got[m.id] ? <span class="cp-own">받음</span> : <button class="btn small yellow" disabled={!ok} onClick={() => { d.got[m.id] = 1; persist(S); earnBP(m.bp, '챔피언스 미션'); tick(x => x + 1); }}>{ok ? `+${m.bp} BP` : `${Math.min(a, b)} / ${b}`}</button>}</div>; })}</div>
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
		const rot = { ...rotOf(false), name: '연습 승부' };
		const mine = noItems(RENTAL.map(id => randomSetFor(id, 9, 50, false, 0.7))), foe = noItems(randomTeam({ gen: 9, size: 3, minBst: 380, maxBst: 480, allowSubLegend: false, quality: 0.3 }));
		win = await fight(S, mine, { name: w.name, title: w.title, sprite: w.sprite, team: foe, skill: 0.3, line: '자, 편하게 와!' }, rot, '연습 승부', c.bg);
	} else {
		const dbl = teamOf(S).length >= 4 && await ask<boolean>(r => <ChoiceScreen key={K()} top title="승급전 형식" intro={<p class="cp-note">어느 형식으로 겨룰까요?</p>} options={[{ value: false, label: '싱글', desc: '3마리' }, { value: true, label: '더블', desc: '4마리' }]} onPick={r} />);
		const rot = rotOf(dbl);
		const foe = foeTeam(S, next, dbl, { quality: Math.min(0.95, next.q + 0.1), must: c.ace && speciesAllowed(ruleById(CR()), c.ace) ? [c.ace] : [] });
		win = await fight(S, teamOf(S).map(m => m.set), { name: w.name, title: w.title, sprite: w.sprite, team: foe, skill: Math.min(0.97, next.skill + 0.05), line: c.before[c.before.length - 1][1], music: S.ch >= 4 ? 'champion' : 'boss' }, rot, `승급전 · ${c.title}`, c.bg);
	}
	if (win === null) return;
	// 연습 승부는 져도 이야기가 이어짐 (등록 첫날에 막히지 않게)
	if (!win) { await talk([[c.who, c.lose]], c.bg); if (S.ch > 0) return; }
	await talk(S.ch === 0 && !win ? c.after.slice(1) : c.after, c.bg);
	await fx('fade');
	if (S.ch === 0) { S.ch = 1; persist(S); await startFlow(S); newLineup(S); return; }
	S.ch++; S.tier = Math.min(TIERS.length - 1, S.tier + 1); S.pts = 0; persist(S); earnBP(EARN.promo, '챔피언스 승급');
	await result('승급!', `${T(S).name}으로 올라갔다!`, [`+${EARN.promo} BP`, `로스터 한도 ${T(S).cap}마리`, S.tier >= TIERS.length - 1 ? '챔피언스 아레나의 정점입니다. 축하합니다!' : '스카우트에 더 강한 포켓몬이 소개됩니다']);
}
type Replay = { title: string; bg: string; lines: [string, string][] };
/** 스토리: 장(승급전)과 이벤트(PWT·배틀타워). 이미 본 것은 누르면 다시 볼 수 있음 */
function StoryScreen({ S, done }: { S: CSave; done: (a: boolean | Replay) => void }) {
	const ready = S.ch === 0 || promoReady(S);
	const evs = (list: typeof EVENTS, name: string) => <><h3 class="cp-h">{name}</h3>{list.map(e => { const seen = !!S.seen?.[e.id], who = e.lines.find(l => l[0])?.[0] || 'manager';
		return <button class={'cp-ch ev ' + (seen ? 'done' : 'lock')} disabled={!seen} onClick={() => done({ title: e.title, bg: e.bg, lines: e.lines })}><img src={SPRITE_URL(CWHO[who].sprite)} onError={trainerImgError} alt="" />
			<div><b>{seen ? e.title : '？？？'}</b><small>{seen ? '눌러서 다시 보기' : '아직 보지 못한 이야기'}</small></div><em>{seen ? '다시 보기' : ''}</em></button>; })}</>;
	return <Screen title="스토리" onBack={() => done(false)} cls="cp-scr" top><Top title="스토리" sub="본 이야기는 누르면 다시 볼 수 있어요" S={S} onBack={() => done(false)} />
		<h3 class="cp-h">승급전</h3>
		{CHAPTERS.map((c, i) => { const st = i < S.ch ? 'done' : i === S.ch ? 'now' : 'lock'; return <button class={'cp-ch ' + st} disabled={st !== 'done'} onClick={() => done({ title: c.title, bg: c.bg, lines: [...c.before, ...c.after] })}><img src={SPRITE_URL(CWHO[c.who].sprite)} onError={trainerImgError} alt="" />
			<div><b>{i + 1} · {st === 'lock' ? '？？？' : c.title}</b><small>{st === 'lock' ? `랭크 매치에서 ${RANK_CLS[Math.min(i, 5)]}에 오르면` : c.sub}</small></div>
			<em>{st === 'done' ? '다시 보기' : st === 'now' ? (i === 0 ? '시작' : ready ? '도전!' : `${RANK_CLS[Math.min(i, 5)]} 필요`) : ''}</em></button>; })}
		{S.ch < CHAPTERS.length && <button class="btn big primary" disabled={!ready} onClick={() => done(true)}>{ready ? `CHAPTER ${S.ch + 1} 시작` : `랭크 매치에서 ${RANK_CLS[Math.min(S.ch, 5)]}에 오르세요`}</button>}
		{evs(TOWER_EVENTS, '배틀타워')}
		{evs(EVENTS, 'PWT · 랭크 매치')}
	</Screen>;
}

// ───────── 전용 메뉴 ─────────
type HubAct = 'exit' | 'story' | 'scout' | 'roster' | 'shop' | 'mission' | 'settings' | 'calc' | 'book' | 'rank' | 'pwt' | { k: BattleKind; doubles: boolean };
function Hub({ S, done }: { S: CSave; done: (a: HubAct) => void }) {
	useEffect(() => { playMusic(HUB_BGM); }, []);
	const t = T(S), c = CHAPTERS[S.ch], ready = promoReady(S), mr = missionReady(S), newLine = S.lineDay !== today(), team = teamOf(S);
	const wal = loadWallet();   // 카드 배경·테두리·칭호 꾸미기 (수첩의 카드와 같은 것)
	const rp = champRp(), st = loadStats(), achDone = ACHIEVEMENTS.filter(a => (st.ach[a.id] || 0) > 0).length, cups = S.cups || {};
	const pwtNext = !pwtOpen() ? '랭크 매치 마스터볼급부터 참가' : !cups.open ? '먼저 오픈 대회 우승' : cupLock(S, 'world') ? `지방 리더스 ${REGION_CUPS.filter(x => cups[x]).length} / ${REGION_CUPS.length}` : cupLock(S, 'elite') ? `월드 리더스 ${cups.world || 0} / ${CUP_NEED}` : cupLock(S, 'champions') ? `사천왕 대회 ${cups.elite || 0} / ${CUP_NEED}` : `챔피언스 우승 ${cups.champions || 0}회`;
	const tile = (a: HubAct, name: string, cls: string, mon: string, badge?: string) => <button class={'cp-tile ' + cls} onClick={() => done(a)}>{badge && <i>{badge}</i>}<PokeIcon species={mon} /><span>{name}</span></button>;
	const brow = (k: BattleKind, name: string, state: string) => <div class="cp-brow"><div><b>{name}</b><small>{state}</small></div>
		<button class="btn primary" onClick={() => done({ k, doubles: false })}>싱글<small>3마리</small></button><button class="btn blue" onClick={() => done({ k, doubles: true })}>더블<small>4마리</small></button></div>;
	const erow = (a: HubAct, name: string, state: string, locked = false) => <div class={'cp-brow one' + (locked ? ' locked' : '')}><div><b>{name}</b><small>{state}</small></div><button class={'btn' + (locked ? '' : ' primary')} onClick={() => done(a)}>{locked ? '잠김' : '입장'}</button></div>;
	return <div class="cp-hub"><Top title="챔피언스 모드" sub={`${t.name}${S.tk.regular + S.tk.pick > 0 ? ` · 티켓 ${S.tk.regular} · 지명 ${S.tk.pick}` : ''}`} S={S} noTk onBack={() => done('exit')}
			extra={<button class={'cp-storybtn' + (ready ? ' ready' : '')} onClick={() => done('story')} aria-label={ready ? '스토리 — 승급전에 도전할 수 있어요' : '스토리'}>스토리</button>} />
		<button class={'cp-me bk-tcard' + cardSkinClass(wal)} style={cardSkin(wal)} onClick={() => done('book')}>
			<img class="bk-tcard-img" src={SPRITE_URL(playerSprite())} onError={trainerImgError} alt="" />
			<div class="bk-tcard-body"><b>{playerName()}<TitleChip it={titleItem(wal)} /></b><small>{rankLabel(rp, true)} · {rp} RP</small>
				<span class="cp-me-syms">{CSYM.map(y => <span title={y.name}><SymbolIcon kind={y.icon} lv={S.sym?.[y.id] || 0} size={24} /></span>)}<i>도전과제 {achDone} / {ACHIEVEMENTS.length}</i></span></div>
		</button>
		<div class="cp-pn cp-arena"><h3>배틀<button class="cp-rule" onClick={() => done('settings')}>규칙 바꾸기</button></h3>
			<p class="cp-rulename">{ruleById(CR()).name}</p>
			{erow('rank', '랭크 매치', `${rankLabel(rp, true)} · ${rp} RP`)}
			{towerOpen() ? brow('tower', '배틀타워', `${S.tower}연승 · 7연승마다 지명 티켓 (${S.tower % 7} / 7)`) : erow({ k: 'tower', doubles: false }, '배틀타워', '랭크 매치 하이퍼볼급부터 도전', true)}
			{erow('pwt', 'PWT', pwtOpen() ? `8명 토너먼트 · ${pwtNext}` : pwtNext, !pwtOpen())}</div>
		<button class="cp-pn cp-myteam" onClick={() => done('roster')}><h3>내 팀 {(S.cur || 0) + 1}<small>{S.team.length} / 6 · 로스터 {S.roster.length} / {t.cap}</small></h3>
			<div class="cp-team">{[0, 1, 2, 3, 4, 5].map(i => <span class={team[i] ? '' : 'empty'}>{team[i] && <PokeIcon species={team[i].set.species} />}{team[i]?.set.item && <span class="cp-held"><ItemIcon item={team[i].set.item} size={16} /></span>}</span>)}</div></button>
		<div class="cp-tiles four">{tile('scout', '스카우트', 'c2', 'pikachu', !freeLeft(S) ? '무료' : newLine ? '새 소개' : undefined)}{tile('roster', '로스터', 'c3', 'gardevoir')}
			{tile('shop', '상점', 'c5', 'rotomwash')}{tile('mission', '미션', 'c6', 'togekiss', mr ? String(mr) : undefined)}</div>
		<div class="cp-nav"><button onClick={() => done('book')}>수첩</button><button onClick={() => done('calc')}>계산기</button><button onClick={() => done('settings')}>설정</button><button onClick={() => done('exit')}>타이틀</button></div>
	</div>;
}

export interface Tools { settings: (onBack: () => void, onTitle?: () => void, extra?: { label: string; note?: string; run: () => void }) => any; calc: (onBack: () => void) => any; book: (onBack: () => void, mode?: string) => any; shop: (onBack: () => void) => any }
export async function runChampions(tools?: Tools) {
	let S: CSave = { ...fresh(), ...load<Partial<CSave>>(KEY, {}) } as CSave;
	if (S.teams) S.team = S.teams[Math.min(S.cur || 0, S.teams.length - 1)] || S.team;
	syncTeams(S);
	for (const m of S.roster) delete (m as any).trial;   // 예전 저장의 트라이얼 포켓몬은 그대로 남김 (기한 없음)
	playMusic(HUB_BGM);
	await fx('fade');
	if (S.ch === 0) await chapterFlow(S); else await events(S);   // 밀린 컷씬·심볼
	while (true) {
		// 등록은 했는데 첫 파티를 아직 안 받았으면 (고르다 나간 경우) 이어서
		if (S.ch >= 1 && !S.roster.length && S.seq === 1) { await startFlow(S); if (!S.lineup.length) newLineup(S); }
		const a = await ask<HubAct>(r => <Hub key={K()} S={S} done={r} />);
		if (a === 'exit') { persist(S); if (await confirmBox('타이틀로', '타이틀로 돌아가나요?\n지금까지의 진행은 저장돼 있어요.', '돌아간다', '계속하기')) return; continue; }
		if (S.ch === 0) { await chapterFlow(S); continue; }
		if (a === 'story') {
			while (true) {
				const x = await ask<boolean | Replay>(r => <StoryScreen key={K()} S={S} done={r} />);
				if (x === false) break;
				if (x === true) { if (S.ch > 0 && teamOf(S).length < 3) { toast('팀에 포켓몬이 3마리는 있어야 해요'); break; } await chapterFlow(S); break; }
				await fx('blinds'); await talk(x.lines, x.bg, ['다시 보기', x.title]); await fx('fade');   // 다시 보기: 대사만 (보상·진행은 그대로)
			}
		}
		if (typeof a === 'object') {
			if (!towerOpen()) { toast('배틀타워는 랭크 매치에서 하이퍼볼급에 오르면 도전할 수 있어요'); continue; }
			if (teamOf(S).length < (a.doubles ? 4 : 3)) { toast(`팀에 포켓몬이 ${a.doubles ? 4 : 3}마리는 있어야 해요 — 스카우트에서 데려오세요`); continue; }
			await events(S, 'tower');
			await towerBattle(S, a.doubles);
		}
		if (a === 'rank' || a === 'pwt') {
			if (a === 'pwt' && !pwtOpen()) { toast('PWT 는 랭크 매치에서 마스터볼급에 오르면 참가할 수 있어요'); continue; }
			if (!teamOk(S)) continue;
			if (a === 'pwt') await events(S, 'pwt');
			dayOf(S).modes[a] = 1; persist(S);
			// 화면 전환 연출 없이 바로 넘어감 (기다리는 시간을 없앰)
			await (a === 'rank' ? runRank : runPWT)(arena(S));
			playMusic(HUB_BGM);
			await events(S);
			if (promoReady(S)) toast('승급전에 도전할 수 있어요! (스토리)');
		}
		if (a === 'scout') await scoutFlow(S);
		if (a === 'roster') await ask<void>(r => <RosterScreen key={K()} S={S} done={() => r()} />);
		if (a === 'shop') { while (await ask<boolean | undefined>(r => <ShopScreen key={K()} S={S} done={r} />)) { if (tools) await ask<void>(r => tools.shop(r)); } }
		if (a === 'settings' && tools) {
			const reset = await ask<boolean>(r => tools.settings(() => r(false), undefined, { label: '챔피언스 모드 초기화', note: '등급·로스터·도구·티켓을 모두 지우고 처음부터 다시 시작합니다. BP 는 그대로 남습니다.',
				run: async () => { if (await confirmBox('챔피언스 모드 초기화', '챔피언스 모드의 진행(등급·로스터·도구·티켓)을 모두 지울까요?\nBP 는 그대로 남습니다.', '지운다', '그만두기')) r(true); } }));
			playMusic(HUB_BGM);
			if (reset) { S = fresh(); persist(S); updateRecords(r => { for (const k of Object.keys(r.rp || {})) if (k.includes(CH_TAG)) { delete r.rp![k]; if (r.rankStreak) delete r.rankStreak[k]; } }); await chapterFlow(S); }
		}
		if (a === 'calc' && tools) await ask<void>(r => tools.calc(r));
		if (a === 'book' && tools) await ask<void>(r => tools.book(r, 'champions'));
		if (a === 'mission') await ask<void>(r => <MissionScreen key={K()} S={S} done={r} />);
	}
}
void Fragment; void BACK;
