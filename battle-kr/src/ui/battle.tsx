/** 배틀 화면 */
import { h, Fragment } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Session } from '../engine';
import { EMOTES, type RemoteSession } from '../online';
import { KoreanText, parseLine, effectInfo, type ParsedLine } from '../text';
import { moveData, moveKo, speciesData, speciesKo, toID, abilityKo, itemKo, natureKo, STAT_SHORT, STAT_KO, typeKo, abilityDesc,
	itemDesc, RAW, floats, type Gen } from '../data';
import { toSimTeam, conceptBall, type PSet } from '../sets';
import { loadSettings, updateRecords, saveReplay, newId } from '../store';
import { emitBattleEnd } from '../battle-hooks';
import { loadWallet, itemById } from '../rewards';
import { TeraFilters, Sprite, PokeIcon, preloadSprite, HPBar, StatusBadge, TypeBadge, TYPE_COLOR, Modal, toast, confirmBox, CatIcon, ItemIcon, canFullscreen, toggleFullscreen, useFullscreen } from './core';
import { MonSheet, type LiveInfo } from './screens';
import { estimateDamage, typeEffOf, moveEffOf, chooseAI } from '../ai';
import { State } from '../../../sim/state';
import * as FX from '../fx';
if (typeof window !== 'undefined') (window as any).__fx = FX;   // 연출 확인용(개발자 도구에서 직접 재생)
import { sfx, moveSound, playMusic, stopMusic, cry, preloadCries, pickBattleMusic, animSfxVolume, vibrate, setQuiet } from '../sound';
import { saveSettings, loadSettings as loadSettings2 } from '../store';
import { SPRITE_URL, trainerImgError } from '../trainer-lines';
import { preloadAnim, playAnim, animIdFor, cancelAnims } from '../anim-player';

export interface BattleSetup {
	gen: Gen;
	doubles: boolean;
	p1: { name: string; team: PSet[]; sprite?: string };
	p2: { name: string; title?: string; team: PSet[]; /** 고르기 화면에서 공개된 상대 엔트리 전체 (이 중 team 을 골라 나옴). 상대 현황 창에 씀 */ preview?: PSet[]; line?: string; sprite?: string; /** 멀티배틀 상대 둘째 트레이너 그림 */ sprite2?: string; lines?: { intro?: string; ace?: string; lose?: string; win?: string } };
	aiSkill: number;
	label?: string; // 예: '배틀타워 12번째'
	/** 전적에 넣지 않음 (프리·치트 배틀) */
	noRecord?: boolean;
	/** 승패가 정해진 순간(결과 화면을 넘기기 전)에 부름 — 결과 화면에서 앱을 꺼도 결과가 남아야 하는 모드용 */
	onDecided?: (win: boolean) => void;
	/** 시나리오: 내 팀의 시작 HP·PP(팀 순서대로) · 끝난 뒤 상태를 돌려받음 · 배틀 중 쓸 수 있는 가방 */
	story?: {
		state?: ({ hp?: number; pp?: { [move: string]: number } } | undefined)[];
		onFinal?: (st: { hp: number; pp: { [move: string]: number }; /** 이 배틀에 한 번이라도 나왔는가 */ used: boolean }[]) => void;
		/** 지금 가진 회복 도구 */
		bag?: () => { id: string; name: string; desc: string; n: number; fx: { heal?: number; revive?: boolean; pp?: number } }[];
		/** 하나 씀 */
		used?: (id: string) => void;
	};
	/** 야생 포켓몬과의 배틀: '기권' 대신 '도망' (시나리오) */
	runAway?: boolean;
	/** 치트 팀 허용: 능력 포인트 합계 제한 없음 */
	cheat?: boolean;
	/** 거꾸로 배틀 */
	inverse?: boolean;
	/** 난이도 (보상 BP: 쉬움은 절반) */
	diff?: string;
	/** 리플레이 재생: 저장된 시드·규칙·양쪽 선택으로 같은 배틀을 자동 진행 */
	replay?: { seed: [number, number, number, number]; ruleId: string; p1: string[]; p2: string[] };
	bg?: 'tower' | 'factory' | 'pwt' | 'field' | 'champion' | 'cave' | 'beach' | 'snow' | 'volcano' | 'gym';
	/** 배경음악 상황 (없으면 배경으로 정함): 악의 조직 간부·보스는 'evil', 관장·사천왕·챔피언은 'boss' */
	music?: 'battle' | 'tower' | 'pwt' | 'boss' | 'evil' | 'champion';
	/** 멀티배틀: p1.team 중 theirs[i] 가 true 인 포켓몬은 파트너(AI)의 것. 포켓몬 주인이 지시함 */
	partner?: { name: string; theirs: boolean[]; skill?: number; /** 파트너 트레이너 그림 (내 트레이너 옆에 나옴) */ sprite?: string };
	/** 배틀 규칙을 이 배틀만 바꿈 (배틀팰리스·스토리 등) */
	ruleId?: string;
	/** 내 선택·상대 선택을 대신 정함 (배틀팰리스: 포켓몬이 성격대로 스스로 싸움). null 이면 평소대로 */
	auto?: (battle: any, req: any) => string | null;
	p2Auto?: (battle: any, req: any) => string | null;
	/** 화면 위 안내 (예: '포켓몬이 스스로 싸우고 있다') */
	autoMsg?: string;
	/** 온라인 대전: 상대 선택을 서버에서 받는 세션 (src/online.ts). 있으면 AI 대신 상대를 기다림 */
	online?: RemoteSession;
	/** 미리 만든 세션 (온라인 대전 리플레이: online.ts replaySession) — replay 와 함께 씀 */
	session?: any;
}
export interface BattleResult { win: boolean; forfeit: boolean; turns: number; p1Left: number; p2Left: number; quit?: boolean }

interface Mon {
	ident: string; nick: string; species: string; level: number; gender: string; shiny: boolean;
	hp: number; maxhp: number; status: string; fainted: boolean; boosts: { [k: string]: number };
	vol: Set<string>; anim: string; ability?: string; item?: string; transformed?: string; hidden?: boolean; away?: boolean; awayBy?: string; tera?: string; seen: string[]; pendingSpecies?: string; itemSeen?: boolean;
}
interface SideScene { id: string; name: string; active: (Mon | null)[]; team: Mon[]; cond: { [id: string]: number }; teamSize: number }
interface Scene { p1: SideScene; p2: SideScene; weather: string; pseudo: Set<string>; turn: number;
	/** 특성·도구 발동 표시 (원작처럼 화면 옆에 '포켓몬의 / 특성' 띠) */
	popup?: { p1?: Popup; p2?: Popup } }
interface Popup { who: string; what: string; kind: 'ability' | 'item'; item?: string; key: number }

const VOLATILE_KO: { [id: string]: string } = {
	substitute: '대타', confusion: '혼란', leechseed: '씨뿌리기', taunt: '도발', encore: '앵콜', torment: '트집',
	attract: '헤롱헤롱', yawn: '하품', perish3: '멸망 3', perish2: '멸망 2', perish1: '멸망 1', perish0: '멸망',
	curse: '저주', nightmare: '악몽', ingrain: '뿌리박기', aquaring: '아쿠아링', magnetrise: '전자부유', embargo: '금제',
	healblock: '회복봉인', focusenergy: '기충전', disable: '사슬묶기', flashfire: '타오르는불꽃', slowstart: '슬로스타트',
	charge: '충전', stockpile1: '비축 1', stockpile2: '비축 2', stockpile3: '비축 3', typechange: '타입 변화', smackdown: '떨어뜨리기',
	telekinesis: '텔레키네시스', dynamax: '다이맥스', autotomize: '바디퍼지', imprison: '봉인', uproar: '소란', partiallytrapped: '조이기',
	trapped: '도망 불가', foresight: '꿰뚫어보기', miracleeye: '미라클아이', powertrick: '파워트릭', destinybond: '길동무',
};
const SIDE_KO: { [id: string]: string } = {
	stealthrock: '스텔스록', spikes: '압정뿌리기', toxicspikes: '독압정', reflect: '리플렉터', lightscreen: '빛의장막',
	tailwind: '순풍', safeguard: '신비의부적', mist: '흰안개', luckychant: '주술', wideguard: '와이드가드', quickguard: '패스트가드',
	auroraveil: '오로라베일', stickyweb: '끈적끈적네트', craftyshield: '트릭가드', matblock: '마룻바닥세워막기',
};
/** 진영 효과 이름: 표에 없으면 같은 이름의 기술 한글 이름(없으면 그대로) */
const sideKo = (id: string, table: { [id: string]: string }) => table[id] || (RAW.moves[id] ? moveKo(id) : id);
const WEATHER_KO: { [id: string]: string } = { raindance: '비', sunnyday: '쾌청', sandstorm: '모래바람', hail: '싸라기눈', snowscape: '설경', primordialsea: '강한 비', desolateland: '강한 햇살', deltastream: '난기류' };
/** 준비 턴에 모습이 사라지는 2턴 기술 */
const AWAY_MOVES = new Set(['fly', 'bounce', 'dig', 'dive', 'phantomforce', 'shadowforce', 'skydrop']);
/** 특성(스킨 계열)으로 타입이 바뀌지 않는 기술 */
const NO_SKIN = new Set(['judgment', 'multiattack', 'naturalgift', 'revelationdance', 'technoblast', 'terrainpulse', 'weatherball', 'hiddenpower', 'struggle']);
const PSEUDO_KO: { [id: string]: string } = { trickroom: '트릭룸', gravity: '중력', wonderroom: '원더룸', magicroom: '매직룸', mudsport: '흙놀이', watersport: '물놀이' };

function parseDetails(details: string) {
	const parts = details.split(', ');
	let level = 100, gender = '', shiny = false;
	for (const p of parts.slice(1)) {
		if (p.startsWith('L')) level = parseInt(p.slice(1), 10);
		else if (p === 'M' || p === 'F') gender = p;
		else if (p === 'shiny') shiny = true;
	}
	return { species: parts[0], level, gender, shiny };
}
function parseHP(cond: string) {
	const [hpPart, status] = (cond || '').split(' ');
	if (hpPart === '0' || status === 'fnt') return { hp: 0, maxhp: 0, status: 'fnt' };
	const [hp, maxhp] = hpPart.split('/').map(n => parseInt(n, 10));
	return { hp: hp || 0, maxhp: maxhp || 0, status: status || '' };
}
function slotOf(ident: string) {
	const c = ident.charAt(2);
	return c >= 'a' && c <= 'c' ? c.charCodeAt(0) - 97 : -1;
}

const SPEED_MS: { [k: number]: number } = { 1: 1350, 2: 850, 3: 420, 4: 200 };
const SPEED_LABEL: { [k: number]: string } = { 1: '▶ ×0.5', 2: '▶ ×1', 3: '▶▶ ×2', 4: '▶▶▶ ×4' };
/** 기술 애니메이션 재생 배속 */
const ANIM_SPEED: { [k: number]: number } = { 1: 0.7, 2: 1, 3: 2, 4: 3 };

/** 넓은 화면(PC 등): 쇼다운식 배치 — 필드 아래에 공격·교체를 함께, 오른쪽에 배틀 기록 */
const WIDE_Q = '(min-width: 960px) and (min-aspect-ratio: 5/4) and (min-height: 541px)';
/** 휴대폰 가로: 필드 왼쪽 + 오른쪽 한 칸에 메시지·기술·교체 (쇼다운식으로 함께, 챔피언스식 큰 버튼) */
const LAND_Q = '(orientation: landscape) and (max-height: 540px) and (min-aspect-ratio: 3/2)';
function useWide(q = WIDE_Q) {
	const [w, setW] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
	useEffect(() => {
		const m = matchMedia(q), f = () => setW(m.matches);
		m.addEventListener?.('change', f);
		return () => m.removeEventListener?.('change', f);
	}, []);
	return w;
}

export function BattleView({ setup, onEnd: onEnd0 }: { setup: BattleSetup; onEnd: (r: BattleResult) => void }) {
	// 시나리오: 끝날 때 내 팀의 남은 HP·PP 를 돌려줌
	const onEnd = (r: BattleResult) => { try { const s: any = sessionRef.current; if (setup.story?.onFinal && s?.p1Final) setup.story.onFinal(s.p1Final()); } catch { /* 상태를 못 읽어도 배틀은 끝냄 */ } onEnd0(r); };
	const settings = useRef(loadSettings()).current;
	const sessionRef = useRef<Session | null>(null);
	const textRef = useRef<KoreanText | null>(null);
	const sceneRef = useRef<Scene>({
		p1: { id: 'p1', name: setup.p1.name, active: [], team: [], cond: {}, teamSize: setup.p1.team.length },
		p2: { id: 'p2', name: setup.p2.name, active: [], team: [], cond: {}, teamSize: setup.p2.team.length },
		weather: '', pseudo: new Set(), turn: 0,
	});
	const [, setTick] = useState(0);
	const rerender = () => setTick(t => t + 1);
	const [message, setMessage] = useState('');
	const [log, setLog] = useState<string[]>([]);
	const [phase, setPhase] = useState<'playing' | 'input' | 'ended'>('playing');
	// 웹: 배틀 중에 탭·창을 닫거나 새로고침하면 브라우저의 '사이트에서 나가시겠습니까? 변경사항이 저장되지 않을 수 있습니다' 확인창
	// (안드로이드 앱·리플레이·배틀이 끝난 뒤에는 묻지 않음. 문구는 브라우저가 정함)
	useEffect(() => {
		if (setup.replay || phase === 'ended' || document.documentElement.classList.contains('native')) return;
		const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; return ''; };
		addEventListener('beforeunload', onLeave);
		return () => removeEventListener('beforeunload', onLeave);
	}, [phase === 'ended']);
	const [showLog, setShowLog] = useState(false);
	const [detail, setDetail] = useState<{ mon: Mon; own: boolean } | null>(null);
	const skipRef = useRef<(() => void) | null>(null);
	const wakeRelease = useRef<(() => void) | null>(null);
	const logRef = useRef<string[]>([]);
	const wide = useWide();
	const land = useWide(LAND_Q);
	/** 마우스를 올리면 뜨는 정보 상자 (넓은 화면) */
	const [tip, setTip] = useState<{ x: number; y: number; body: any } | null>(null);
	const hov = (body: () => any) => wide ? {
		onMouseEnter: (e: MouseEvent) => setTip({ x: e.clientX, y: e.clientY, body: body() }),
		onMouseMove: (e: MouseEvent) => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : t),
		onMouseLeave: () => setTip(null),
	} : {};
	const sideLogRef = useRef<HTMLDivElement>(null);
	useEffect(() => { const el = sideLogRef.current; if (el) el.scrollTop = el.scrollHeight; }, [log, wide]);

	// 입력 상태
	const [slotIdx, setSlotIdx] = useState(0);
	const [parts, setParts] = useState<string[]>([]);
	const [menu, setMenu] = useState<'main' | 'moves' | 'switch' | 'target'>('main');
	// 화면이 바뀌면(기술 → 대상, 차례 넘어감) 떠 있던 정보 상자는 닫음 (마우스가 나가기 전에 버튼이 사라지는 경우)
	useEffect(() => setTip(null), [menu, phase, slotIdx]);
	// 클릭(누름)하면 정보 상자를 닫음 — 다음에 마우스를 다시 올릴 때만 뜸
	useEffect(() => {
		if (!wide) return;
		const close = () => setTip(null);
		addEventListener('pointerdown', close, true);
		return () => removeEventListener('pointerdown', close, true);
	}, [wide]);
	const [pendingMove, setPendingMove] = useState<{ num: number; target: string; gm?: string } | null>(null);
	const [focus, setFocus] = useState(0);
	const [sheet, setSheet] = useState<{ idx: number; canSwitch: boolean } | null>(null);
	const fxRef = useRef<HTMLDivElement | null>(null);
	const [trainerVis, setTrainerVis] = useState<{ own: boolean; foe: boolean }>({ own: false, foe: false });
	const aceShownRef = useRef(false);
	const [gimmick, setGimmick] = useState('');
	const arenaRef = useRef<HTMLDivElement | null>(null);
	const [scale, setScale] = useState(1.5);
	// PC 키보드: 숫자 1~6 = 버튼 고르기(기술·교체·대상), Enter/Space = 싸운다·메시지 넘기기, Esc/Backspace = 뒤로·창 닫기
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
			const modal = document.querySelector('.modal-bg:not(.closing)') as HTMLElement | null;
			if (modal) { if (e.key === 'Escape') { modal.click(); e.preventDefault(); } return; }
			const ctl = document.querySelector('.battle .controls') as HTMLElement | null;
			const pick = (sel: string, n: number) => { const el = ctl?.querySelectorAll<HTMLButtonElement>(sel)[n]; if (el && !el.disabled) { el.click(); return true; } return false; };
			let done = false;
			if (/^[1-6]$/.test(e.key) && ctl) {
				const n = +e.key - 1;
				done = pick('.move-grid .mvb', n) || pick('.switch-list .switch-btn', n) || pick('.target-grid2 .tcard.on', n) || (n === 0 && pick('.cmd-fight', 0));
			} else if (e.key === 'Enter' || e.key === ' ') {
				done = pick('.cmd-fight', 0);
				if (!done && skipRef.current) { skipRef.current(); done = true; }
			} else if (e.key === 'Escape' || e.key === 'Backspace') {
				done = pick('.ctl-back', 0);
			}
			if (done) e.preventDefault();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);
	useEffect(() => {
		const el = arenaRef.current;
		if (!el) return;
		const update = () => setScale(el.clientWidth / 256);
		update();
		const ro = new ResizeObserver(update);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const gen = setup.gen;
	/** 배틀 중 배속 버튼: ×1 → ×2 → ×4 → ×0.5 → … (설정의 메시지 속도와 같음) */
	const syncFxSpeed = () => FX.setFxSpeed(ANIM_SPEED[settings.speed] || 1);
	const cycleSpeed = () => {
		const next = (settings.speed % 4 + 1) as 1 | 2 | 3 | 4;
		settings.speed = next;
		syncFxSpeed();
		const st = loadSettings2(); st.speed = next; saveSettings(st);
		skipRef.current?.();
		rerender();
	};

	/** 메시지 길이에 맞춘 읽기 시간 (짧은 문장은 빨리 넘어감) */
	const readMs = (m: string) => SPEED_MS[settings.speed] * (0.65 + Math.min(0.75, m.length / 45));
	/** 메시지 다음으로: 자동이면 읽기 시간만큼, 수동이면 화면을 누를 때까지 */
	const msgWait = (m: string) => settings.textManual && !setup.replay ? new Promise<void>(resolve => { if (deadRef.current) return; skipRef.current = () => { skipRef.current = null; resolve(); }; }) : wait(readMs(m));
	const toggleManual = () => {
		settings.textManual = !settings.textManual;
		const st = loadSettings2(); st.textManual = settings.textManual; saveSettings(st);
		skipRef.current?.();
		rerender();
	};
	/** 화면을 떠남(리플레이 그만 보기·뒤로): 진행 중인 재생 루프가 더는 효과음·연출을 내지 않게 */
	const deadRef = useRef(false);
	const wait = (ms: number) => deadRef.current ? new Promise<void>(() => {}) : new Promise<void>(resolve => {
		const t = setTimeout(() => { skipRef.current = null; resolve(); }, ms);
		skipRef.current = () => { clearTimeout(t); skipRef.current = null; resolve(); };
	});

	/** 소리 기술(하이퍼보이스·울음소리·폭음파 등 sound 플래그)은 쓰는 포켓몬의 울음소리를 함께 냄 (같은 줄에 한 번만) */
	const criedRef = useRef(new WeakSet<object>());
	function soundMoveCry(p: { cmd: string; args: string[] }, mon: Mon | null) {
		if (!mon || criedRef.current.has(p)) return;
		try {
			if (sessionRef.current?.battle.dex.moves.get(toID(p.args[2])).flags.sound) { criedRef.current.add(p); cry(toID(mon.species)); }
		} catch { /* 무시 */ }
	}
	function findMon(ident: string, details?: string): Mon {
		const scene = sceneRef.current;
		const side = scene[ident.slice(0, 2) as 'p1' | 'p2'];
		const nick = ident.slice(ident.indexOf(': ') + 2);
		// 같은 별명이 여럿이면(같은 종 2마리 등) 성별·색이 다른 포켓몬 여부가 맞고 아직 나와 있지 않은 쪽
		const cands = side.team.filter(m => m.nick === nick);
		const d0 = cands.length > 1 && details ? parseDetails(details) : null;
		let mon = d0 ? (cands.find(m => m.shiny === d0.shiny && m.gender === d0.gender && !side.active.includes(m)) || cands.find(m => !side.active.includes(m)) || cands[0]) : cands[0];
		// 유일한 후보가 이미 다른 자리에 나와 있으면(상대 쪽 같은 별명 2마리) 새 포켓몬
		if (mon && details && cands.length === 1 && side.active.includes(mon) && side.active[slotOf(ident)] !== mon) mon = undefined;
		if (!mon) {
			const d = details ? parseDetails(details) : { species: nick, level: 50, gender: '', shiny: false };
			mon = {
				ident: ident.slice(0, 2) + ': ' + nick, nick, species: d.species, level: d.level, gender: d.gender, shiny: d.shiny,
				hp: 100, maxhp: 100, status: '', fainted: false, boosts: {}, vol: new Set(), anim: '', seen: [],
			};
			side.team.push(mon);
		}
		return mon;
	}
	function activeMon(ident: string): Mon | null {
		const scene = sceneRef.current;
		const side = scene[ident.slice(0, 2) as 'p1' | 'p2'];
		const slot = slotOf(ident);
		if (slot >= 0 && side.active[slot]) return side.active[slot];
		const nick = ident.slice(ident.indexOf(': ') + 2);
		return side.team.find(m => m.nick === nick) || null;
	}
	/** 공중날기·섀도다이브 등으로 숨어 있던 포켓몬(과 프리폴로 붙잡힌 상대)을 다시 보이게 */
	function comeBack(ident: string) {
		const scene = sceneRef.current, by = ident.slice(0, 3);
		const me = activeMon(ident);
		if (me?.away) { me.away = false; me.awayBy = undefined; }
		for (const sd of [scene.p1, scene.p2]) for (const m of sd.active) if (m?.away && m.awayBy === by) { m.away = false; m.awayBy = undefined; }
	}
	function animate(mon: Mon | null, anim: string, ms = 500) {
		if (!mon) return;
		mon.anim = anim;
		setTimeout(() => { if (mon.anim === anim) { mon.anim = ''; rerender(); } }, ms / FX.fxSpeed());
	}

	/** 슬롯 위 포켓몬 몸통 중심 좌표 (arena 기준 px) */
	function slotPoint(ident: string): FX.Pt | null {
		const arena = arenaRef.current;
		if (!arena || !ident || !/^p\d[a-c]/.test(ident)) return null;
		const own = ident.startsWith('p1');
		const el = arena.querySelector(`.slot.${own ? 'own' : 'foe'}.s${slotOf(ident)}`) as HTMLElement | null;
		if (!el) return null;
		const a = arena.getBoundingClientRect(), r = el.getBoundingClientRect();
		return { x: r.left - a.left, y: r.top - a.top - (own ? 34 : 26) * scale * (setup.doubles ? 0.8 : 1) };
	}
	const pendingHitRef = useRef<{ at: number; sound: string } | null>(null);
	const frontRef = useRef<HTMLCanvasElement | null>(null);
	const backRef = useRef<HTMLCanvasElement | null>(null);
	const animBgRef = useRef<HTMLDivElement | null>(null);
	const animUsedRef = useRef<ParsedLine | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	/** 대화창은 높이가 고정: 두 줄에 안 들어가는 긴 글은 글자를 한두 단계 줄여 맞춤 */
	const msgRef = useRef<HTMLParagraphElement>(null);
	useLayoutEffect(() => {
		const el = msgRef.current; if (!el) return;
		el.classList.remove('fit1', 'fit2');
		const box = el.parentElement!;
		const over = () => el.scrollHeight > box.clientHeight + 1;
		if (over()) { el.classList.add('fit1'); if (over()) { el.classList.remove('fit1'); el.classList.add('fit2'); } }
	});
	/** 배틀 배경: 설정(battleBg)이 '기본'(auto)이면 모드가 정한 배경, '무작위'면 배틀마다 하나 (리플레이는 원래 배경) */
	const [arenaBg] = useState(() => {
		const pref = settings.battleBg || 'auto';
		if (setup.replay || pref === 'auto') return setup.bg || 'field';
		if (pref === 'random') { const all = ['field', 'gym', 'cave', 'beach', 'snow', 'volcano', 'tower', 'factory', 'pwt', 'champion']; return all[Math.floor(Math.random() * all.length)]; }
		return pref;
	});
	const fullscreen = useFullscreen();
	const [fieldOpen, setFieldOpen] = useState(false);
	/** 시나리오 가방: null = 닫힘, '' = 도구 고르기, 도구 id = 누구에게 쓸지 고르기 */
	const [bagOpen, setBagOpen] = useState<string | null>(null);
	const [foeOpen, setFoeOpen] = useState(false);   // 상대 파티 현황 창 (좁은 화면: 양옆 패널 대신)
	// 보상 꾸미기 (rewards.ts): 승리 연출·HP 창 테마·볼 연출
	const [wallet] = useState(() => loadWallet());
	const hpTheme = wallet.eq.hp ? itemById(wallet.eq.hp)?.v : '';
	useEffect(() => {
		const el = arenaRef.current; if (!el) return;
		const fit = () => {
			const dpr = window.devicePixelRatio || 1;
			for (const c of [frontRef.current, backRef.current]) {
				if (!c) continue;
				c.width = el.clientWidth * dpr; c.height = el.clientHeight * dpr;
				c.style.width = el.clientWidth + 'px'; c.style.height = el.clientHeight + 'px';
				c.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
			}
		};
		fit();
		const ro = new ResizeObserver(fit); ro.observe(el);
		return () => ro.disconnect();
	}, []);
	function slotEl(ident: string): HTMLElement | null {
		const arena = arenaRef.current;
		if (!arena || !/^p\d[a-c]/.test(ident)) return null;
		return arena.querySelector(`.slot.${ident.startsWith('p1') ? 'own' : 'foe'}.s${slotOf(ident)}`) as HTMLElement | null;
	}
	/** 효과 그림을 그 타입 색으로 칠하는 CSS 필터 (세피아로 색을 없앤 뒤 타입 색의 색상각으로 돌림) */
function typeTint(type: string) {
	const hex = (TYPE_COLOR[type] || '#888888').replace('#', '');
	const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
	const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
	let h = 0;
	if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
	h = Math.round(h * 60 + 360) % 360;
	return `sepia(1) saturate(4) hue-rotate(${h - 38}deg) brightness(1.05)`;
}

	/** PokéRogue(Pokémon Reborn) 애니메이션 재생. 없으면 false */
	async function tryRebornAnim(p: ParsedLine): Promise<boolean> {
		if (settings.effects === false || p.kw.still || p.kw.notarget) return false;
		const [, user, moveName, target] = p.args;
		const id = animIdFor(toID(moveName));
		// 직접 그린 전용 연출이 있는 것: 다이월, 고스트 타입이 아닌 포켓몬의 저주(대상이 자기 자신)
		if (id === 'maxguard' || (id === 'curse' && (!target || target.slice(0, 2) === user.slice(0, 2)))) return false;
		const anim = await preloadAnim(id);
		if (!anim || !frontRef.current || !backRef.current || !animBgRef.current) return false;
		const userPt = slotPoint(user); if (!userPt) return false;
		let tgt = target && /^p\d[a-c]/.test(target) ? target : '';
		// 용의춤·칼춤처럼 자신·우리 편에게 쓰는 기술은 애니메이션도 자신에게 (PokéRogue 와 같음)
		const mvTarget = sessionRef.current?.battle.dex.moves.get(toID(moveName))?.target || '';
		const selfMove = ['self', 'allySide', 'allyTeam', 'adjacentAllyOrSelf', 'allies'].includes(mvTarget);
		if (selfMove && (!tgt || tgt.slice(0, 2) === user.slice(0, 2))) tgt = tgt && tgt.slice(0, 3) !== user.slice(0, 3) ? tgt : user;
		else if (!tgt || tgt.slice(0, 3) === user.slice(0, 3)) {
			// 대상 없음(스텔스록·날씨 등): 반대편 첫 포켓몬을 가상 대상으로
			const foe = user.startsWith('p1') ? 'p2' : 'p1';
			const idx = sceneRef.current[foe].active.findIndex(m => m && !m.fainted);
			tgt = `${foe}${'ab'[Math.max(0, idx)]}: x`;
		}
		const targetPt = slotPoint(tgt) || userPt;
		animUsedRef.current = p;
		// 빌려 쓰는 그림을 타입 색으로: 테라버스트 = 테라스탈 타입, 비밀의힘·자연의힘 = 필드(일렉트릭·그래스·미스트·사이코)
		const mid = toID(moveName);
		const b = sessionRef.current?.battle;
		const simUser: any = b?.[user.slice(0, 2) as 'p1' | 'p2']?.active[slotOf(user)];
		const terrainType = ({ electricterrain: 'Electric', grassyterrain: 'Grass', mistyterrain: 'Fairy', psychicterrain: 'Psychic' } as any)[b?.field.terrain || ''] || 'Normal';
		const tintType = mid === 'terablast' ? (simUser?.terastallized || 'Normal') : (mid === 'secretpower' || mid === 'naturepower') ? terrainType : '';
		await playAnim(anim, {
			filter: tintType && tintType !== 'Normal' ? typeTint(tintType) : '',
			front: frontRef.current, back: backRef.current, bgLayer: animBgRef.current,
			userPt, targetPt, userEl: slotEl(user), targetEl: slotEl(tgt), k: scale * 0.85, userIsFoe: user.startsWith('p2'),
			sfxVolume: animSfxVolume(), speed: FX.fxSpeed(),
		});
		return true;
	}
	function moveFx(p: ParsedLine): number {
		const layer = fxRef.current, arena = arenaRef.current;
		const [, user, moveName, target] = p.args;
		const mid = toID(moveName);
		const simMove = sessionRef.current?.battle.dex.moves.get(mid);
		const md = moveData(mid, gen);
		const type = simMove?.type || md?.type || 'Normal', cat = simMove?.category || md?.category || 'Physical';
		moveSound(type, cat);
		if (!layer || !arena || p.kw.still || settings.effects === false) return 0;
		const from = slotPoint(user);
		if (!from) return 0;
		if (p.kw.miss || p.kw.notarget) return 0;
		const tt = simMove?.target || md?.target || 'normal';
		let hits: FX.Pt[] = [];
		const foeSide = user.startsWith('p1') ? 'p2' : 'p1';
		if (['allAdjacentFoes', 'allAdjacent', 'all', 'foeSide'].includes(tt)) {
			sceneRef.current[foeSide].active.forEach((m, i) => { if (m && !m.fainted) { const pt = slotPoint(`${foeSide}${'ab'[i]}: x`); if (pt) hits.push(pt); } });
		}
		const to = slotPoint(target || '') || hits[0] || from;
		if (!hits.length) hits = [to];
		// Z기술(전용 Z기술 포함, 변화 Z기술 제외): 전용 대형 연출
		if (simMove?.isZ && cat !== 'Status') {
			const impact = (1 / FX.fxSpeed()) * FX.zMove(layer, arena, type, cat, from, hits, scale);
			pendingHitRef.current = { at: impact, sound: 'hitExplode' };
			return impact;
		}
		// 다이월: 붉은 육각 벽 (공격 연출과 따로)
		if (mid === 'maxguard') return (1 / FX.fxSpeed()) * FX.maxGuard(layer, from, scale);
		if (mid === 'curse' && (!target || target.slice(0, 2) === user.slice(0, 2))) return (1 / FX.fxSpeed()) * FX.curseBody(layer, from, scale);
		// 다이맥스 기술(맥스·거다이맥스): 전용 대형 연출
		if (simMove?.isMax || /^(max|gmax)[a-z]/.test(mid)) {
			const impact = (1 / FX.fxSpeed()) * FX.maxMove(layer, arena, type, from, hits, scale);
			pendingHitRef.current = { at: impact, sound: 'hitExplode' };
			return impact;
		}
		const impact = (1 / FX.fxSpeed()) * FX.playMove(layer, arena, { id: mid, type, category: cat, flags: simMove?.flags || {}, target: tt, basePower: simMove?.basePower }, from, to, scale, hits);
		const hitSound = RXp(/explosion|selfdestruct|boomburst|eruption|mindblown/, mid) ? 'hitExplode' : RXp(/punch|fist|kick|slam|smash|hammer|tackle|headbutt|rush|charge|press|chop/, mid) ? 'hitPunch' : RXp(/slash|cut|claw|blade|sword|edge|scissor|wing|razor|fang|bite|crunch/, mid) ? 'hitSlash' : 'hit';
		pendingHitRef.current = { at: impact, sound: hitSound };
		return impact;
	}

	/** 줄 하나를 화면 상태에 반영. 연출 대기시간(ms) 반환 */
	/** 특성·도구가 발동한 줄이면 그 포켓몬 쪽에 띠를 띄운다 */
	const popupTimer = useRef<{ [side: string]: any }>({});
	function showPopup(p: ParsedLine) {
		const { cmd, args, kw } = p;
		if (kw.silent) return;
		const isMon = (x?: string) => !!x && /^p[12][a-d]?: /.test(x);
		let kind: 'ability' | 'item' | null = null, name = '', owner = '';
		const from = kw.from || '';
		if (/^ability: /.test(from)) {
			kind = 'ability'; name = from.slice(9);
			// [of] 는 보통 특성 주인이지만, 특성을 베끼거나(트레이스·리시버·화학의힘) 도구를 가져오는(매지션·나쁜손버릇) 특성은 [of] 가 당한 쪽 → 주인은 줄의 주어
			const selfOwned = cmd === '-ability' || (cmd === '-item' && /^(magician|pickpocket)$/.test(toID(name)));
			owner = !selfOwned && isMon(kw.of) ? kw.of! : args[1];
		}
		else if (/^item: /.test(from)) { kind = 'item'; name = from.slice(6); owner = isMon(kw.of) && cmd === '-damage' ? kw.of! : args[1]; }
		else if (cmd === '-ability' && args[2]) { kind = 'ability'; name = args[2]; owner = args[1]; }
		else if (cmd === '-activate' && /^(ability|item): /.test(args[2] || '')) { kind = args[2].startsWith('ability') ? 'ability' : 'item'; name = args[2].replace(/^(ability|item): /, ''); owner = args[1]; }
		else if (cmd === '-enditem' && args[2] && !/^move: /.test(from) && !kw.stealeat && from !== 'stealeat') { kind = 'item'; name = args[2]; owner = args[1]; }
		if (!kind || !isMon(owner)) return;
		const mon = activeMon(owner) || findMon(owner);
		if (!mon) return;
		const side = owner.slice(0, 2) as 'p1' | 'p2';
		const scene = sceneRef.current;
		const id = toID(name);
		scene.popup = { ...(scene.popup || {}), [side]: { who: mon.nick, what: kind === 'ability' ? abilityKo(id) : itemKo(id), kind, item: kind === 'item' ? id : undefined, key: Math.random() } };
		clearTimeout(popupTimer.current[side]);
		popupTimer.current[side] = setTimeout(() => { if (scene.popup) { scene.popup = { ...scene.popup, [side]: undefined }; rerender(); } }, 1700 / FX.fxSpeed());
	}

	function apply(p: ParsedLine): number {
		const scene = sceneRef.current;
		const { cmd, args, kw } = p;
		try { showPopup(p); } catch { /* 표시용이라 무시 */ }
		if (cmd === 'cant') comeBack(args[1]);   // 잠듦·마비 등으로 2턴째를 못 쓰면 모습이 돌아옴
		switch (cmd) {
		case 'switch': case 'drag': case 'replace': {
			const ident = args[1];
			const side = scene[ident.slice(0, 2) as 'p1' | 'p2'];
			const slot = slotOf(ident);
			const prev = side.active[slot];
			const prevSnap = prev ? { hp: prev.hp, maxhp: prev.maxhp, status: prev.status, boosts: { ...prev.boosts }, vol: new Set(prev.vol), tera: prev.tera, item: prev.item, seen: prev.seen } : null;
			if (prev && cmd !== 'replace') { comeBack(ident); prev.boosts = {}; prev.vol = new Set(); prev.transformed = undefined; }
			const mon = findMon(ident, args[2]);
			const d = parseDetails(args[2]);
			mon.species = d.species; mon.level = d.level; mon.gender = d.gender; mon.shiny = d.shiny; mon.pendingSpecies = undefined;
			if (cmd === 'replace' && !args[3] && prevSnap) {
				// 일루전 해제: HP 정보가 없는 줄 — 지금 보이던 HP·상태·랭크를 그대로 이어받음 (정체만 드러남)
				mon.hp = prevSnap.hp; mon.maxhp = prevSnap.maxhp; mon.status = prevSnap.status; mon.boosts = prevSnap.boosts; mon.vol = prevSnap.vol;
				mon.fainted = false; mon.item = prevSnap.item; mon.seen = [...new Set([...prevSnap.seen, ...mon.seen])];
				// 흉내 내던 포켓몬(prev)은 나오기 전 모습으로 되돌림: 변장한 동안의 테라스탈·HP·상태는 진짜(mon)의 것
				const pre = (prev as any)?.pre;
				if (prev && prev !== mon && pre) {
					mon.tera = prevSnap.tera !== pre.tera ? prevSnap.tera : undefined;
					prev.hp = pre.hp; prev.maxhp = pre.maxhp; prev.status = pre.status; prev.tera = pre.tera; prev.fainted = pre.fainted; prev.item = pre.item;
					prev.boosts = {}; prev.vol = new Set(); (prev as any).pre = undefined;
				} else mon.tera = prevSnap.tera;
				side.active[slot] = mon;
				return 0;
			}
			const hp = parseHP(args[3]);
			(mon as any).pre = { hp: mon.hp, maxhp: mon.maxhp, status: mon.status, tera: mon.tera, fainted: mon.fainted, item: mon.item };   // 일루전이었다면 풀릴 때 이 모습으로 되돌림
			mon.hp = hp.hp; mon.maxhp = hp.maxhp || mon.maxhp; mon.status = hp.status === 'fnt' ? '' : hp.status;
			mon.fainted = false; mon.boosts = {}; mon.vol = new Set();
			side.active[slot] = mon;
			const own = ident.startsWith('p1');
			const layer = fxRef.current;
			const to = slotPoint(ident);
			if (layer && to && cmd !== 'replace') {
				const from = { x: own ? -10 : layer.clientWidth + 10, y: to.y - 30 * scale };
				mon.hidden = true;
				sfx('ballThrow');
				const bteam = own ? setup.p1.team : setup.p2.team;
				const bi = bteam.findIndex(x => toID(x.species) === toID(d.species) || toID(x.species) === toID(mon.nick));
				let ball = bteam[bi]?.pokeball || 'pokeball';
				// 상대·멀티 파트너가 볼을 정하지 않은 포켓몬(기본 몬스터볼)은 컨셉에 맞거나 무작위인 볼로 (트레이너·포켓몬마다 늘 같은 볼)
				const partnerMon = own && !!setup.partner?.theirs?.[bi];
				if ((!own || partnerMon) && ball === 'pokeball') ball = conceptBall(d.species, own ? setup.partner?.name || 'partner' : setup.p2.name || '');
				const t = FX.ballOut(layer, from, to, scale, ball) / FX.fxSpeed();
				setTimeout(() => { mon.hidden = false; mon.anim = 'enter'; rerender(); sfx('ballOpen'); cry(toID(mon.species)); setTimeout(() => { if (mon.anim === 'enter') { mon.anim = ''; rerender(); } }, 500);
					// 이로치: 나온 직후 도트 별이 반짝임
					if (mon.shiny && settings.effects !== false) setTimeout(() => { if (!layer.isConnected) return; FX.shinyStars(layer, { x: to.x, y: to.y - 18 * scale }, scale); sfx('shiny'); }, 380 / FX.fxSpeed());
				}, t);
				return t + (mon.shiny ? 1100 : 450) / FX.fxSpeed();
			}
			animate(mon, 'enter', 600);
			cry(toID(mon.species));
			return 350;
		}
		case 'faint': {
			const mon = activeMon(args[1]);
			comeBack(args[1]);
			// 다이맥스한 채 쓰러지면 거대한 몸이 터지며 사라짐
			const big = !!mon?.vol.has('dynamax'), bpt = big ? slotPoint(args[1]) : null;
			if (big && bpt && fxRef.current && arenaRef.current && settings.effects !== false) { FX.dmaxBurst(fxRef.current, arenaRef.current, bpt, scale); sfx('hitExplode'); setTimeout(() => sfx('hitExplode'), 700 / FX.fxSpeed()); }
			if (mon) { mon.fainted = true; mon.hp = 0; animate(mon, 'faint', big ? 1300 : 900); cry(toID(mon.species), { faint: true }); }
			sfx('faint');
			vibrate(120);
			return big ? 1250 : 700;
		}
		case 'move': {
			const mon = activeMon(args[1]);
			if (!kw.still) comeBack(args[1]);          // 숨어 있던 포켓몬이 모습을 드러내며 공격
			noteSeen(mon, p);
			// 소리 기술(하이퍼보이스·울음소리·폭음파 등 sound 플래그)은 쓰는 포켓몬의 울음소리를 함께 냄
			soundMoveCry(p, mon);
			animate(mon, args[1].startsWith('p1') ? 'attack-own' : 'attack-foe', 450);
			if (animUsedRef.current === p) { animUsedRef.current = null; pendingHitRef.current = { at: 0, sound: '' }; return 150; }
			if (kw.noanim || kw.still) return 400;   // 빗나감·막힘, 2턴 기술의 준비 턴([still])은 기술 연출 없음
			const impact = settings.effects === false ? (moveSound(moveData(toID(args[2]), gen)?.type || 'Normal', moveData(toID(args[2]), gen)?.category || 'Physical'), 0) : moveFx(p);
			return Math.max(500, impact + 300);
		}
		case '-damage': case '-heal': case '-sethp': {
			const mon = activeMon(args[1]);
			if (!mon) return 0;
			const hp = parseHP(args[2]);
			const before = mon.hp;
			mon.hp = hp.hp;
			if (hp.maxhp) mon.maxhp = hp.maxhp;
			if (hp.status === 'fnt') { mon.hp = 0; }
			else mon.status = hp.status;
			if (cmd === '-damage' && !kw.from) { animate(mon, 'hit', 450); if (pendingHitRef.current?.sound !== '') sfx(pendingHitRef.current?.sound || 'hit'); }
			if (cmd === '-heal' && !('silent' in kw) && fxRef.current) { const pt = slotPoint(args[1]); if (pt) FX.sparkle(fxRef.current, pt, 'Grass', scale); sfx('heal'); }
			return before !== mon.hp ? 550 : 0;
		}
		case '-status': { const m = activeMon(args[1]); if (m) m.status = args[2]; sfx('status'); return 0; }
		case '-supereffective': { sfx('hitSuper'); vibrate(40); if (arenaRef.current) FX.shake(arenaRef.current, true); return 0; }
		case '-crit': { sfx('crit'); vibrate([30, 40, 30]); if (fxRef.current) FX.flash(fxRef.current); return 0; }
		case '-miss': { sfx('miss'); return 0; }
		case '-anim': {
			// 쾌청 솔라빔·파워풀허브 2턴 기술·드래곤애로우 두 번째 등: 실제 기술 연출
			if (settings.effects === false) return 300;
			return Math.max(500, moveFx(p) + 300);
		}
		case '-singleturn': {
			// 힘껏펀치·부리캐논·트랩셸: 턴 처음에 기운을 모으는 연출
			const kind = /Focus Punch/.test(args[2]) ? 'focus' : /Beak Blast/.test(args[2]) ? 'beak' : /Shell Trap/.test(args[2]) ? 'shell' : '';
			if (!kind || settings.effects === false) return 0;
			const pt = slotPoint(args[1]); if (!pt || !fxRef.current) return 0;
			sfx('status');
			return FX.charge(fxRef.current, pt, kind === 'focus' ? 'Fighting' : 'Fire', scale, kind as any);
		}
		case '-prepare': {
			// 2턴 기술(솔라빔·공중날기·메테오빔 등)의 준비 턴: 기술 타입 색으로 기운을 모음
			// 공중날기·구멍파기·다이빙·섀도다이브 등: 준비 턴 동안 모습이 사라짐 (프리폴은 붙잡힌 상대도)
			if (AWAY_MOVES.has(toID(args[2]))) {
				const who = [activeMon(args[1]), toID(args[2]) === 'skydrop' && args[3] ? activeMon(args[3]) : null];
				for (const m of who) if (m) { m.away = true; m.awayBy = args[1].slice(0, 3); }
			}
			if (settings.effects === false) return 0;
			const pt = slotPoint(args[1]); if (!pt || !fxRef.current) return 0;
			sfx('status');
			return FX.charge(fxRef.current, pt, moveData(toID(args[2]), gen)?.type || 'Normal', scale, 'prepare');
		}
		case '-zpower': { sfx('zmove'); const pt = slotPoint(args[1]); if (pt && fxRef.current) FX.pillar(fxRef.current, pt, '#ffe040', scale); return 700; }
		case '-curestatus': {
			const side = scene[args[1].slice(0, 2) as 'p1' | 'p2'];
			const nick = args[1].slice(args[1].indexOf(': ') + 2);
			const m = side.team.find(x => x.nick === nick);
			if (m) m.status = '';
			return 0;
		}
		case '-cureteam': {
			const side = scene[args[1].slice(0, 2) as 'p1' | 'p2'];
			for (const m of side.team) m.status = '';
			return 0;
		}
		case '-boost': case '-unboost': {
			const m = activeMon(args[1]);
			if (m) {
				const n = parseInt(args[3], 10) * (cmd === '-boost' ? 1 : -1);
				m.boosts[args[2]] = Math.max(-6, Math.min(6, (m.boosts[args[2]] || 0) + n));
				animate(m, n > 0 ? 'boost' : 'unboost', 500);
				sfx(n > 0 ? 'statUp' : 'statDown');
				const pt = slotPoint(args[1]);
				if (pt && fxRef.current && settings.effects !== false && !('silent' in kw)) FX.statChange(fxRef.current, pt, scale, args[2], n);
			}
			return 0;
		}
		case '-setboost': { const m = activeMon(args[1]); if (m) m.boosts[args[2]] = parseInt(args[3], 10); return 0; }
		case '-clearboost': { const m = activeMon(args[1]); if (m) m.boosts = {}; return 0; }
		case '-clearnegativeboost': {
			const m = activeMon(args[1]);
			if (m) for (const k in m.boosts) if (m.boosts[k] < 0) m.boosts[k] = 0;
			return 0;
		}
		case '-clearallboost':
			for (const s of [scene.p1, scene.p2]) for (const m of s.active) if (m) m.boosts = {};
			return 0;
		case '-invertboost': { const m = activeMon(args[1]); if (m) for (const k in m.boosts) m.boosts[k] = -m.boosts[k]; return 0; }
		case '-copyboost': {
			const m = activeMon(args[1]); const t = activeMon(args[2]);
			if (m && t) m.boosts = { ...t.boosts };
			return 0;
		}
		case '-swapboost': {
			const m = activeMon(args[1]); const t = activeMon(args[2]);
			if (m && t) {
				const stats = args[3] ? args[3].split(', ') : ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
				for (const s of stats) { const tmp = m.boosts[s] || 0; m.boosts[s] = t.boosts[s] || 0; t.boosts[s] = tmp; }
			}
			return 0;
		}
		case '-weather':
			if (!kw.upkeep && args[1] !== 'none') sfx('weather');
			if (!kw.upkeep) scene.weather = args[1] === 'none' ? '' : toID(args[1]);
			return 0;
		case '-fieldstart': {
			const id = effectInfo(args[1]).id;
			// 필드(테라인)는 하나만: 새 필드가 깔리면 이전 필드를 지움
			if (id.endsWith('terrain')) for (const k of [...scene.pseudo]) if (k.endsWith('terrain')) scene.pseudo.delete(k);
			scene.pseudo.add(id); return 0;
		}
		case '-fieldend': scene.pseudo.delete(effectInfo(args[1]).id); return 0;
		case '-sidestart': {
			const side = scene[args[1].slice(0, 2) as 'p1' | 'p2'];
			const id = effectInfo(args[2]).id;
			side.cond[id] = (side.cond[id] || 0) + 1;
			return 0;
		}
		case '-sideend': {
			const side = scene[args[1].slice(0, 2) as 'p1' | 'p2'];
			delete side.cond[effectInfo(args[2]).id];
			return 0;
		}
		case '-start': {
			const m = activeMon(args[1]);
			if (!m) return 0;
			const id = effectInfo(args[2]).id;
			if (id.startsWith('perish')) { for (const k of [...m.vol]) if (k.startsWith('perish')) m.vol.delete(k); }
			if (id.startsWith('stockpile')) { for (const k of [...m.vol]) if (k.startsWith('stockpile')) m.vol.delete(k); }
			m.vol.add(id);
			if (id === 'substitute') animate(m, 'enter', 400);
			if (id === 'dynamax') {
				// 거다이맥스: 시뮬레이터는 모습을 바꾸지 않고 '|-start|…|Dynamax|Gmax' 만 보내므로 그림을 직접 바꾼다
				if (args[3] === 'Gmax' && !/-Gmax$/.test(m.species)) m.transformed = m.species.replace(/-.*$/, '') + '-Gmax';
				sfx('dynamax'); if (fxRef.current) FX.flash(fxRef.current, '#ff2040', 500); return 700;
			}
			return 0;
		}
		case '-end': {
			const m = activeMon(args[1]);
			if (m && toID(args[2]) === 'dynamax' && /-Gmax$/.test(m.transformed || '')) m.transformed = undefined;
			if (!m) return 0;
			const id = effectInfo(args[2]).id;
			if (id === 'substitute' && m.vol.has('substitute') && !m.fainted) {
				// 대타 인형이 흔들리다 하얗게 번쩍이며 아래로 사라지고, 본래 포켓몬이 나타남
				const sp = FX.fxSpeed();
				m.anim = 'subbreak'; rerender();
				setTimeout(() => { m.vol.delete('substitute'); if (m.anim === 'subbreak') animate(m, 'enter', 450); rerender(); }, 520 / sp);
				return 760;
			}
			m.vol.delete(id);
			if (id === 'stockpile') for (const k of [...m.vol]) if (k.startsWith('stockpile')) m.vol.delete(k);
			return 0;
		}
		case '-transform': {
			const m = activeMon(args[1]); const t = activeMon(args[2]);
			if (m && t) { m.transformed = t.species; m.boosts = { ...t.boosts }; }
			return 300;
		}
		case 'detailschange': case '-formechange': {
			const m = activeMon(args[1]);
			if (!m) return 0;
			const d = parseDetails(args[2]);
			// 기절 직후 원래 모습으로 돌아가는 줄([silent]) — 쓰러지는 연출은 메가진화 모습 그대로
			if (cmd === 'detailschange' && m.fainted) { m.pendingSpecies = d.species; return 0; }
			if (cmd === 'detailschange' && /-(Mega|Primal|Ultra)\b/.test(d.species) && !/-(Mega|Primal|Ultra)\b/.test(m.species)) {
				// 메가진화·원시회귀·울트라버스트: 빛기둥 연출을 먼저, 그 뒤 그림 교체
				sfx('mega'); const pt = slotPoint(args[1]); if (pt && fxRef.current) { FX.pillar(fxRef.current, pt, /Primal/.test(d.species) ? '#ffb040' : '#ff80ff', scale); if (/-Mega\b/.test(d.species)) FX.megaIcon(fxRef.current, pt, scale); }
				m.anim = 'evolve'; rerender();
				setTimeout(() => { m.species = d.species; m.anim = 'enter'; rerender(); cry(toID(d.species)); setTimeout(() => { if (m.anim === 'enter') { m.anim = ''; rerender(); } }, 600 / FX.fxSpeed()); }, 750 / FX.fxSpeed());
				return 1300;
			}
			if (cmd === 'detailschange') m.species = d.species; else m.transformed = d.species;
			return 300;
		}
		case '-terastallize': {
			const m = activeMon(args[1]);
			if (m) { m.tera = args[2]; animate(m, 'enter', 600); }
			sfx('tera'); const pt = slotPoint(args[1]); if (pt && fxRef.current) FX.pillar(fxRef.current, pt, TYPE_COLOR[args[2]] || '#fff', scale);
			return 800;
		}
		case '-mega': case '-primal': case '-burst':
			// 연출은 모습이 바뀌는 detailschange 에서 이미 함 (빛기둥 → 그림 교체)
			return 0;
		case '-item': { const m = activeMon(args[1]); if (m) { m.item = args[2]; m.itemSeen = true; } return 0; }
		case '-enditem': { const m = activeMon(args[1]); if (m) { m.item = ''; m.itemSeen = true; } return 0; }
		case '-ability': { const m = activeMon(args[1]); if (m) m.ability = args[2]; return 0; }
		case 'turn': scene.turn = parseInt(args[1], 10); return 0;
		case 'teamsize': {
			const side = scene[args[1] as 'p1' | 'p2'];
			if (side) side.teamSize = parseInt(args[2], 10);
			return 0;
		}
		}
		return 0;
	}

	/** 온라인 대전 복귀: 지난 턴들의 줄을 연출·소리 없이 화면 상태에만 반영 */
	function fastApply(lines: string[]) {
		const kt = textRef.current!;
		setQuiet(true);
		try {
			for (const line of lines) {
				const p = parseLine(line);
				if (!p) continue;
				let prev: { ident: string; fainted: boolean } | null = null;
				if (p.cmd === 'switch' || p.cmd === 'drag') {
					const cur = sceneRef.current[p.args[1].slice(0, 2) as 'p1' | 'p2'].active[slotOf(p.args[1])];
					if (cur) prev = { ident: cur.ident, fainted: cur.fainted };
				}
				let text = '';
				try { text = kt.render(p, prev); } catch { /* 표시용 */ }
				if (p.cmd === 'move') noteSeen(activeMon(p.args[1]), p);
				try { apply(p); } catch (e) { console.error(e, line); }
				for (const m of text ? text.split('\n').filter(Boolean) : []) pushLog(m);
			}
		} finally { setTimeout(() => setQuiet(false), 1500); }   // 나오기 연출의 늦은 울음소리까지 지난 뒤
		pendingHitRef.current = { at: 0, sound: '' };
		rerender();
	}
	/** 온라인: 재생 중에 새 줄이 오면 끝난 뒤 이어서 재생 */
	const playQ = useRef<{ busy: boolean; q: string[][] }>({ busy: false, q: [] });
	async function playQueued(lines: string[]) {
		const Q = playQ.current;
		Q.q.push(lines);
		if (Q.busy) return;
		Q.busy = true;
		try { while (Q.q.length && !deadRef.current) await play(Q.q.shift()!); } finally { Q.busy = false; }
	}
	/** 온라인: 한꺼번에 받은 지난 줄 — 재생 중인 것이 끝난 뒤 빠르게 따라잡고 이어서 진행 */
	async function catchUpQueued(lines: string[]) {
		const Q = playQ.current;
		while (Q.busy && !deadRef.current) await wait(100);
		if (deadRef.current) return;
		Q.busy = true;
		try { fastApply(lines); await wait(300); await play([]); } finally { Q.busy = false; }
		if (Q.q.length) void playQueued([]);
	}
	async function play(lines: string[]) {
		setPhase('playing');
		// 메가진화: "키스톤이 반응했다" 메시지를 먼저 보여 주고, 그다음 빛기둥 → 모습 교체
		lines = lines.slice();
		for (let i = 0; i + 1 < lines.length; i++) {
			if (/^\|detailschange\|[^|]+\|[^|,]*-(Mega|Primal|Ultra)/.test(lines[i]) && /^\|-(mega|primal|burst)\|/.test(lines[i + 1]) &&
				lines[i].split('|')[2] === lines[i + 1].split('|')[2]) { [lines[i], lines[i + 1]] = [lines[i + 1], lines[i]]; i++; }
		}
		// 본가처럼 HP 바가 먼저 줄고 나서 '효과가 굉장했다/별로인 듯하다', '급소에 맞았다' 메시지가 뜨게:
		// 쇼다운은 -crit·-supereffective·-resisted 를 -damage 앞에 보내므로, 같은 대상의 다음 -damage 바로 뒤로 옮김 (다음 기술·턴 전까지만 찾음)
		for (let i = 0; i < lines.length; i++) {
			const m = /^\|-(crit|supereffective|resisted)\|([^|]+)/.exec(lines[i]);
			if (!m) continue;
			const target = m[2];
			let j = i + 1;
			for (; j < lines.length && !/^\|(move|turn|switch|drag|upkeep|cant)\|/.test(lines[j]) && lines[j] !== '|'; j++) {
				if (lines[j].startsWith('|-damage|' + target + '|') || (lines[j].startsWith('|-activate|' + target + '|') && /Substitute\|\[damage\]/.test(lines[j]))) break;
			}
			if (j >= lines.length || !(lines[j].startsWith('|-damage|') || lines[j].startsWith('|-activate|'))) continue;
			const [eff] = lines.splice(i, 1);
			// 그 -damage(이제 j-1) 바로 뒤, 이미 옮겨 둔 메시지들 다음 (급소 → 효과 순서 유지)
			let k = j;
			while (k < lines.length && /^\|-(crit|supereffective|resisted)\|/.test(lines[k])) k++;
			lines.splice(k, 0, eff);
			i--;                       // 이 자리에 온 다음 줄을 다시 봄
		}
		// 연속기(트리플악셀·록블라스트·부모유대 등): 본가처럼 상성 메시지는 다 맞고 나서 한 번만, 그다음 'N번 맞았다!', 쓰러짐은 그 뒤
		for (let i = 0; i < lines.length; i++) {
			const m = /^\|-hitcount\|([^|]+)\|/.exec(lines[i]);
			if (!m) continue;
			const target = m[1];
			let start = i - 1;
			while (start >= 0 && !lines[start].startsWith('|move|') && lines[start] !== '|') start--;
			if (start < 0 || !lines[start].startsWith('|move|')) continue;
			const blk = lines.slice(start + 1, i);
			// -hitcount 는 'p2: 이름'(자리 글자 없음)으로 오므로 진영+이름으로 맞춤
			const key = (id = '') => id.slice(0, 2) + id.slice(id.indexOf(':'));
			const mine = (l: string) => key(l.split('|')[2]) === key(target);
			const isEff = (l: string) => /^\|-(supereffective|resisted)\|/.test(l) && mine(l);
			const effs = blk.filter(isEff);
			const rest = blk.filter(l => !isEff(l));
			let at = rest.findIndex(l => l.startsWith('|faint|') && mine(l));
			if (at < 0) at = rest.length;
			rest.splice(at, 0, ...effs.slice(-1), lines[i]);
			lines.splice(start + 1, i - start, ...rest);
			i = start + rest.length;
		}
		// 빗나가거나 막힌(방어·무효·실패) 기술: 실제로 맞은 대상이 없으면 기술 연출 생략 ([noanim] 표시)
		const BLOCK = /^\|-activate\|[^|]*\|(move: )?(Protect|Detect|King's Shield|Spiky Shield|Baneful Bunker|Silk Trap|Obstruct|Burning Bulwark|Max Guard|Wide Guard|Quick Guard|Mat Block|Crafty Shield)/;
		for (let i = 0; i < lines.length; i++) {
			if (!lines[i].startsWith('|move|')) continue;
			if (/\[(miss|notarget)\]/.test(lines[i])) { lines[i] += '|[noanim]'; continue; }
			let failed = false, hit = false;
			const user = lines[i].split('|')[2]?.slice(0, 3) || '';
			for (let j = i + 1; j < lines.length && !/^\|(move|turn|switch|drag|upkeep|cant)\|/.test(lines[j]) && lines[j] !== '|'; j++) {
				const l = lines[j];
				if (/^\|-(miss|immune|fail)\|/.test(l) || BLOCK.test(l)) failed = true;
				// 킹실드·니들가드·토치카 등: 막힌 쪽(기술을 쓴 포켓몬)의 능력 하락·상태이상은 맞은 것이 아님
				else if (failed && /^\|-(unboost|boost|status)\|/.test(l) && l.split('|')[2]?.startsWith(user)) continue;
				else if (/^\|-(damage|status|boost|unboost|heal|start|sidestart|fieldstart|weather|clearallboost|transform|setboost|swapboost|activate|singleturn|singlemove|item|enditem)\|/.test(l) && !/\[from\]/.test(l)) hit = true;
			}
			if (failed && !hit) lines[i] += '|[noanim]';
		}
		const kt = textRef.current!;
		for (const line of lines) {
			if (deadRef.current) return;
			const p = parseLine(line);
			if (!p) continue;
			let prev: { ident: string; fainted: boolean } | null = null;
			if (p.cmd === 'switch' || p.cmd === 'drag') {
				const side = sceneRef.current[p.args[1].slice(0, 2) as 'p1' | 'p2'];
				const cur = side.active[slotOf(p.args[1])];
				if (cur) prev = { ident: cur.ident, fainted: cur.fainted };
			}
			let text = '';
			try { text = kt.render(p, prev); } catch (e) { console.error(e, line); }
			const msgs = text ? text.split('\n').filter(Boolean) : [];
			// 상대 마지막 포켓몬: 트레이너 등장 + 대사
			if ((p.cmd === 'switch' || p.cmd === 'drag') && p.args[1].startsWith('p2') && !aceShownRef.current && setup.p2.lines?.ace) {
				const sc = sceneRef.current.p2;
				const fainted = sc.team.filter(m => m.fainted).length;
				const alive = sc.teamSize - fainted;
				const isNew = !sc.team.some(m => m.nick === p.args[1].slice(p.args[1].indexOf(': ') + 2));
				if (alive === 1 && (isNew || sc.teamSize === sc.team.length) && sc.teamSize > 1) {
					aceShownRef.current = true;
					setTrainerVis({ own: false, foe: true });
					showMsg(`${setup.p2.title ? setup.p2.title + ' ' : ''}${setup.p2.name}: “${setup.p2.lines.ace}”`);
					await wait(SPEED_MS[settings.speed] * 1.5);
					setTrainerVis({ own: false, foe: false });
					await wait(300);
				}
			}
			// 교체 메시지는 들어가기 전에
			if (msgs.length && (p.cmd === 'switch' || p.cmd === 'drag') && prev && !prev.fainted && msgs.length > 1) {
				showMsg(msgs.shift()!);
				const side = sceneRef.current[p.args[1].slice(0, 2) as 'p1' | 'p2'];
				const cur = side.active[slotOf(p.args[1])];
				if (cur) { animate(cur, 'leave', 500); const pt = slotPoint(p.args[1]); if (pt && fxRef.current) FX.ballIn(fxRef.current, pt, scale); }
				rerender();
				await wait(SPEED_MS[settings.speed] * 0.7);
			}
			if (p.cmd === 'move' && msgs.length) {
				// 기술 이름 메시지를 먼저 보여주고 애니메이션
				showMsg(msgs.shift()!);
				const mon = activeMon(p.args[1]);
				noteSeen(mon, p);
				soundMoveCry(p, mon);
				rerender();
				const used = p.kw.noanim || p.kw.still ? false : await tryRebornAnim(p);
				if (!used) {
					const d = apply(p) / FX.fxSpeed(); rerender();
					await wait(Math.max(d, SPEED_MS[settings.speed] * 0.6));
				} else { pendingHitRef.current = { at: 0, sound: '' }; await wait(120); }
				for (const m of msgs) { showMsg(m); await msgWait(m); }
				continue;
			}
			const delay = apply(p) / FX.fxSpeed();
			rerender();
			if (p.cmd === 'turn') { pushLog(text); continue; }
			for (const m of msgs) {
				showMsg(m);
				await msgWait(m);
			}
			if (!msgs.length && delay) await wait(Math.min(delay, SPEED_MS[settings.speed]));
		}
		const s = sessionRef.current!;
		if (s.ended) {
			setPhase('ended');
			const win = s.winner === setup.p1.name;
			if (!setup.noRecord) updateRecords(r => { r.battles++; if (win) r.wins++; });
			emitBattleEnd(setup, s.battle, win);
			try { setup.onDecided?.(win); } catch {}
			if (win) playMusic('victory'); else stopMusic();
			const left = s.battle.p1.pokemon.filter((x: any) => !x.fainted).length;
			showMsg(win ? `${setup.p2.title ? setup.p2.title + ' ' : ''}${setup.p2.name}에게 이겼다! (${s.battle.turn}턴 · 남은 포켓몬 ${left}마리)` : `눈앞이 깜깜해졌다… (${s.battle.turn}턴)`);
			const endLine = win ? setup.p2.lines?.lose : setup.p2.lines?.win;
			if (endLine) {
				await wait(SPEED_MS[settings.speed] * 1.2);
				setTrainerVis({ own: false, foe: true });
				showMsg(`${setup.p2.title ? setup.p2.title + ' ' : ''}${setup.p2.name}: “${endLine}”`);
			}
		} else {
			beginInput();
		}
	}

	function showMsg(m: string) {
		setMessage(m);
		pushLog(m);
	}
	function pushLog(m: string) {
		logRef.current = [...logRef.current, m];
		setLog(logRef.current);
	}

	const replayIdx = useRef(0);
	/** 리플레이: 기록된 내 선택을 순서대로 자동 입력 */
	async function replayStep() {
		const s = sessionRef.current!;
		const rp = setup.replay!;
		setPhase('playing');
		if (replayIdx.current >= rp.p1.length) { setPhase('ended'); setMessage('리플레이가 끝났습니다.'); stopMusic(); return; }
		if ((s as any).replayDone?.()) { setPhase('ended'); setMessage('리플레이가 끝났습니다.'); stopMusic(); return; }
		const choice = rp.p1[replayIdx.current++];
		setMessage(`▶ 리플레이 ${s.battle.turn}턴`);
		await wait(Math.max(250, SPEED_MS[settings.speed] * 0.8));
		if (choice === 'forfeit') { await play(s.forfeit()); return; }
		const lines = s.choose(choice);
		if (!lines) { setPhase('ended'); setMessage('리플레이를 재현할 수 없습니다 (선택 불일치).'); stopMusic(); return; }
		await play(lines);
	}

	function beginInput() {
		setParts([]);
		setGimmick('');
		setPendingMove(null);
		const req = sessionRef.current!.p1Request;
		if (setup.replay && setup.session) { void replayStep(); return; }   // 온라인 리플레이: 내 차례가 아니어도(상대만 교체 등) 다음 선택을 넣음
		if (!req || req.wait) { setPhase('playing'); if (setup.online && !sessionRef.current!.ended) setMessage(`${setup.p2.name}${josaSubject(setup.p2.name)} 고르기를 기다리는 중…`); return; }
		if (setup.replay) { void replayStep(); return; }
		const autoC = setup.auto?.(sessionRef.current!.battle, req);
		if (autoC) {   // 배틀팰리스: 포켓몬이 스스로 고름
			setPhase('playing'); if (setup.autoMsg) setMessage(setup.autoMsg);
			void (async () => { await wait(Math.max(300, SPEED_MS[settings.speed] * 0.7)); const lines = sessionRef.current!.choose(autoC); if (lines) await play(lines); })();
			return;
		}
		const first = firstSlot(req, 0);
		if (first < 0 && setup.partner) { void submit([]); return; }
		setSlotIdx(first);
		setMenu(req.forceSwitch ? 'switch' : 'main');
		setPhase('input');
		setup.online?.beginTurn();   // 온라인: 선택 시간·내 시간 재기 시작
		const scene = sceneRef.current;
		const mon = scene.p1.active[first];
		if (req.forceSwitch) setMessage(req.side?.pokemon?.some((x: any) => x.reviving) ? '되살릴 포켓몬을 골라 주세요.' : '다음 포켓몬을 골라 주세요.');
		else if (mon) setMessage(`${mon.nick}${josaTopic(mon.nick)} 무엇을 할까?`);
	}

	// ── 멀티배틀: 파트너(AI)가 지시하는 슬롯 ──
	const partnerOf = (p: any) => !!p?.kPartner;
	function benchAlive(partner: boolean) {
		return sessionRef.current!.battle.p1.pokemon.some((p: any) => !p.fainted && !p.isActive && partnerOf(p) === partner);
	}
	/** 이 슬롯을 파트너가 고르는가: 싸우는 중이면 그 포켓몬의 주인, 비었으면 0번은 나(내 포켓몬이 남았을 때)·1번은 파트너(파트너 포켓몬이 남았을 때) */
	function aiSlot(req: any, i: number): boolean {
		if (!setup.partner || setup.replay) return false;
		if (req.forceSwitch) return i === 0 ? !benchAlive(false) : benchAlive(true);
		return partnerOf(sessionRef.current!.battle.p1.active[i]);
	}
	/** 파트너의 선택: 내 대기 포켓몬은 잠시 기절한 것으로 가려서 파트너가 자기 포켓몬만 내보내게 함 */
	function partnerParts(req: any): string[] {
		const b = sessionRef.current!.battle;
		const mask: any[] = [];
		if (benchAlive(true)) for (const p of b.p1.pokemon as any[]) if (!partnerOf(p) && !p.fainted && !p.isActive) { p.fainted = true; mask.push(p); }
		try {
			const c = chooseAI(b, req, 'p1', setup.partner?.skill ?? 0.85);
			return c && c !== 'default' ? c.split(', ') : [];
		} finally { for (const p of mask) p.fainted = false; }
	}
	/** 내 선택에 파트너의 선택을 슬롯 순서대로 끼워 넣음 */
	function mergePartner(req: any, mine: string[]): string[] {
		if (!setup.partner || setup.replay) return mine;
		const n = req.forceSwitch ? req.forceSwitch.length : req.active?.length || 1;
		const needed: number[] = [];
		for (let i = 0; i < n; i++) {
			if (req.forceSwitch) { if (req.forceSwitch[i]) needed.push(i); continue; }
			const mon = req.side.pokemon[i];
			if (mon && !mon.condition.endsWith(' fnt') && mon.condition !== '0 fnt' && !req.active[i]?.commanding) needed.push(i);
		}
		if (!needed.some(i => aiSlot(req, i))) return mine;
		const ai = req.forceSwitch ? partnerParts({ ...req, forceSwitch: req.forceSwitch.map((f: boolean, i: number) => f && aiSlot(req, i)) }) : partnerParts(req);
		const out: string[] = [];
		let mi = 0, ai2 = 0;
		needed.forEach((slot, k) => {
			if (aiSlot(req, slot)) out.push((req.forceSwitch ? ai[ai2++] : ai[k]) || (req.forceSwitch ? 'pass' : 'move 1'));
			else out.push(mine[mi++] || (req.forceSwitch ? 'pass' : 'move 1'));
		});
		return out;
	}

	/** 강제 교체 때 아직 내보낼 수 있는 (내) 포켓몬 수 */
	function switchesLeft(req: any, chosen: string[]) {
		const reviving = req.side?.pokemon?.some((x: any) => x.reviving);
		const sim = sessionRef.current!.battle.p1.pokemon as any[];
		const avail = (req.side?.pokemon || []).filter((p: any, i: number) => {
			const fnt = p.condition.endsWith(' fnt') || p.condition === '0 fnt';
			if (setup.partner && partnerOf(sim[i])) return false;
			return reviving ? fnt : (!p.active && !fnt);
		}).length;
		return avail - chosen.filter(c => c.startsWith('switch')).length;
	}
	/** 강제 교체에서 내가 고르지 못한(대기 포켓몬이 없는) 칸은 'pass' 로 채움 */
	function padPasses(req: any, mine: string[]): string[] {
		if (!req.forceSwitch || setup.partner) return mine;
		const need = req.forceSwitch.filter(Boolean).length;
		return mine.length >= need ? mine : [...mine, ...Array(need - mine.length).fill('pass')];
	}

	/** 이번에 선택해야 하는 슬롯 */
	function firstSlot(req: any, from: number, chosen: string[] = []): number {
		const n = req.forceSwitch ? req.forceSwitch.length : req.active?.length || 1;
		// 강제 교체: 내보낼 수 있는 포켓몬을 다 골랐으면 남은 칸은 넘김 (더블에서 두 마리가 한꺼번에 쓰러졌는데 대기가 한 마리뿐일 때)
		if (req.forceSwitch && from > 0 && switchesLeft(req, chosen) <= 0) return -1;
		for (let i = from; i < n; i++) {
			if (aiSlot(req, i)) continue;
			if (req.forceSwitch) { if (req.forceSwitch[i]) return i; continue; }
			const mon = req.side.pokemon[i];
			if (mon && !mon.condition.endsWith(' fnt') && mon.condition !== '0 fnt' && !req.active[i]?.commanding) return i;
		}
		return -1;
	}

	function pushChoice(choice: string) {
		const req = sessionRef.current!.p1Request;
		const next = [...parts, choice];
		const nextSlot = firstSlot(req, slotIdx + 1, next);
		if (nextSlot < 0) {
			submit(next);
		} else {
			setParts(next);
			setSlotIdx(nextSlot);
			setMenu(req.forceSwitch ? 'switch' : 'main');
			const mon = sceneRef.current.p1.active[nextSlot];
			if (!req.forceSwitch && mon) setMessage(`${mon.nick}${josaTopic(mon.nick)} 무엇을 할까?`);
		}
	}

	async function submit(choiceParts: string[]) {
		const s = sessionRef.current!;
		// 강한 AI 는 최대 5초까지 숙고하므로, 그동안 화면이 멈춘 것처럼 보이지 않게 먼저 안내를 그려 둠
		if (setup.aiSkill >= 0.9 && !setup.replay) {
			setPhase('playing');
			setMessage(`${setup.p2.title ? setup.p2.title + ' ' : ''}${setup.p2.name}${josaSubject(setup.p2.name)} 생각하고 있다…`);
			await new Promise(r => setTimeout(r, 50));
		}
		const lines = s.choose(mergePartner(s.p1Request, padPasses(s.p1Request, choiceParts)).join(', '));
		if (!lines) {
			toast('선택할 수 없습니다: ' + (s.lastError.replace(/^\[.*?\]\s*/, '') || '다시 골라 주세요'));
			beginInput();
			return;
		}
		if (setup.online) { setPhase('playing'); setMessage(`${setup.p2.name}${josaSubject(setup.p2.name)} 고르기를 기다리는 중…`); return; }
		play(lines);
	}

	/** 온라인: 이번 선택 시간이 다 됨 → 자동 선택(내 시간이 0이면 시간 초과 패배) */
	function onlineTimeout() {
		if (!setup.online?.timeout()) return;
		setSheet(null); setParts([]); setPhase('playing');
		setMessage(setup.online.timers().mine <= 0 ? '남은 시간이 0이 되었다…' : '시간이 다 되어 자동으로 골랐다!');
	}

	function cancelChoice() {
		if (!parts.length) { setMenu(sessionRef.current!.p1Request.forceSwitch ? 'switch' : 'main'); return; }
		const req = sessionRef.current!.p1Request;
		setParts([]);
		const first = firstSlot(req, 0);
		setSlotIdx(first);
		setMenu(req.forceSwitch ? 'switch' : 'main');
	}

	/** 배틀을 그만두고 메인 메뉴로 (끝나지 않은 배틀은 패배로 기록) */
	async function quitToMenu() {
		setMenuOpen(false);
		const s = sessionRef.current!;
		const ended = s.ended || !!setup.replay;
		if (!ended && !(await confirmBox('메인 메뉴로', setup.noRecord ? '배틀을 그만두고 메인 메뉴로 돌아갈까요?' :
			'배틀을 그만두고 메인 메뉴로 돌아갈까요?\n이 배틀은 패배로 기록되고, 진행 중인 연승 도전은 끝납니다.', '메인 메뉴로', '계속 싸운다'))) return;
		deadRef.current = true;   // 진행 중인 재생 루프를 멈춤 (메뉴에서 승리 음악·기록이 남지 않게)
		skipRef.current?.();
		cancelAnims();
		stopMusic();
		if (!ended && !setup.noRecord) updateRecords(r => { r.battles++; });
		if (!ended && setup.online) s.forfeit();   // 온라인: 나가면 기권 (상대 화면도 끝남)
		const alive = (side: 'p1' | 'p2') => s.battle[side].pokemon.filter((p: any) => !p.fainted).length;
		const win = ended && s.winner === setup.p1.name;
		onEnd({ win, forfeit: !win, turns: s.battle.turn, p1Left: alive('p1'), p2Left: alive('p2'), quit: true });
	}

	async function forfeit() {
		if (!(await confirmBox(setup.runAway ? '도망' : '기권', setup.runAway ? '야생 포켓몬에게서 도망칠까요?' : '정말 기권할까요? 이 승부는 패배로 기록됩니다.', setup.runAway ? '도망친다' : '기권', '취소'))) return;
		// 야생 포켓몬에게서 도망: 승패 문구 없이 바로 끝냄
		if (setup.runAway) { const b = sessionRef.current!.battle; onEnd({ win: false, forfeit: true, turns: b.turn, p1Left: b.p1.pokemon.filter((p: any) => !p.fainted).length, p2Left: b.p2.pokemon.filter((p: any) => !p.fainted).length }); return; }
		const lines = sessionRef.current!.forfeit();
		if (setup.online) { setPhase('playing'); setMessage('기권했습니다…'); return; }   // 서버가 중계해 돌려주면 끝남
		await play(lines);
	}

	useEffect(() => {
		const s: any = setup.online ?? setup.session ?? new Session({
			gen: setup.gen, doubles: setup.doubles, aiSkill: setup.aiSkill, inverse: !!setup.inverse,
			...(setup.ruleId ? { ruleId: setup.ruleId } : {}), p2Auto: setup.p2Auto,
			...(setup.replay ? { seed: setup.replay.seed, ruleId: setup.replay.ruleId, replayP2: setup.replay.p2 } : {}),
			partnerFlags: setup.partner?.theirs, p1State: setup.story?.state,
			p1: { name: setup.p1.name, team: toSimTeam(setup.p1.team, !!setup.cheat) as any },
			p2: { name: setup.p2.name, team: toSimTeam(setup.p2.team, !!setup.cheat) as any },
		});
		sessionRef.current = s;
		if (setup.online) {
			// 상대 선택이 와서 턴이 진행되면 그 줄을 차례로 재생
			setup.online.onLines = lines => { void playQueued(lines); };
			setup.online.onDesync = msg => { toast(msg); setPhase('ended'); setMessage(msg); stopMusic(); };
			setup.online.onCatchUp = lines => { void catchUpQueued(lines); };
			setup.online.onEmote = (who, id) => { const key = Date.now(); setEmote(e => ({ ...e, [who]: { id, key } })); setTimeout(() => setEmote(e => e[who]?.key === key ? { ...e, [who]: undefined } : e), 3200); if (who === 'p2') sfx('select'); };
		}
		syncFxSpeed();
		textRef.current = new KoreanText({
			gen: setup.gen, ownSide: 'p1', doubles: setup.doubles,
			trainerName: side => side === 'p1' ? setup.p1.name : (setup.p2.title ? `${setup.p2.title} ${setup.p2.name}` : setup.p2.name),
		});
		// 내 팀은 미리 등록 (교체 화면용)
		const lines = s.start();
		let wake: any = null;
		(navigator as any).wakeLock?.request?.('screen').then((w: any) => { wake = w; }).catch(() => {});
		wakeRelease.current = () => { try { wake?.release(); } catch {} };
		playMusic(pickBattleMusic(setup.music ?? (setup.bg === 'champion' ? 'boss' : setup.bg === 'tower' || setup.bg === 'factory' ? 'tower' : setup.bg === 'pwt' ? 'pwt' : 'battle')));
		preloadCries([...setup.p1.team, ...setup.p2.team].map(x => toID(x.species)));
		for (const x of setup.p1.team) { preloadSprite(x.species, true, x.shiny); for (const st of megaFormsOf(x)) preloadSprite(st, true, x.shiny); }
		for (const x of setup.p2.team) { preloadSprite(x.species, false, x.shiny); for (const st of megaFormsOf(x)) preloadSprite(st, false, x.shiny); }
		if (settings.effects !== false) for (const set of [...setup.p1.team, ...setup.p2.team]) for (const m of set.moves) preloadAnim(animIdFor(toID(m)));
		(async () => {
			// 온라인 대전 복귀(앱을 다시 켬): 등장 연출 없이 지금 상황까지 바로 따라잡음
			const back: string[] = setup.online?.backlog.splice(0) || [];
			if (back.length) { fastApply([...lines, ...back]); showMsg('대전으로 돌아왔다!'); await wait(600); await play([]); return; }
			// 트레이너 등장 (양쪽 트레이너가 발판에 나타난 뒤 포켓몬을 내보냄)
			setTrainerVis({ own: true, foe: true });
			const who = `${setup.p2.title ? setup.p2.title + ' ' : ''}${setup.p2.name}`;
			setMessage(`${who}${josaSubject(setup.p2.name)} 승부를 걸어왔다!`);
			pushLog(`${who}${josaSubject(setup.p2.name)} 승부를 걸어왔다!`);
			await wait(SPEED_MS[settings.speed] * 1.3);
			if (setup.partner) { showMsg(`${setup.partner.name}${josaWith(setup.partner.name)} 함께 싸운다!`); await wait(SPEED_MS[settings.speed] * 1.1); }
			const intro = setup.p2.lines?.intro || setup.p2.line;
			if (intro) {
				showMsg(`${who}: “${intro}”`);
				await wait(SPEED_MS[settings.speed] * 1.6);
			}
			setTrainerVis({ own: false, foe: false });
			await wait(350);
			await play(lines);
		})();
		return () => { deadRef.current = true; skipRef.current?.(); stopMusic(); wakeRelease.current?.(); cancelAnims(); };
	}, []);

	const scene = sceneRef.current;
	const req = sessionRef.current?.p1Request;

	const [replaySaved, setReplaySaved] = useState(false);
	// 온라인 대전의 한마디 (정해진 문구만): 말풍선 · 고르는 창
	const [emote, setEmote] = useState<{ p1?: { id: number; key: number }; p2?: { id: number; key: number } }>({});
	const [emoteOpen, setEmoteOpen] = useState(false);
	const emoteAt = useRef(0);
	/** 지금 배틀을 리플레이로 저장 (시드 + 양쪽 선택) */
	function saveThisReplay() {
		const s = sessionRef.current!;
		const { replay: _r, online: rs, session: _s, ...rest } = setup;
		const win = s.winner === setup.p1.name;
		saveReplay({ id: newId(), date: Date.now(), label: (setup.label || `${setup.p2.title ? setup.p2.title + ' ' : ''}${setup.p2.name}`) + (rs ? ` · ${setup.p2.name}` : ''), win, turns: s.battle.turn,
			setup: rest, seed: s.seed, ruleId: s.rule.id, p1: rs ? [] : s.record.p1.slice(), p2: rs ? [] : s.record.p2.slice(),
			...(rs ? { online: { start: rs.info, inputs: rs.log.slice() } } : {}) });
		setReplaySaved(true);
		toast('리플레이를 저장했습니다 (기록 → 리플레이)');
	}
	function finish() {
		const s = sessionRef.current!;
		stopMusic();
		const win = s.winner === setup.p1.name;
		const alive = (side: 'p1' | 'p2') => s.battle[side].pokemon.filter((p: any) => !p.fainted).length;
		onEnd({ win, forfeit: !win && s.battle.turn > 0 && alive('p1') > 0, turns: s.battle.turn, p1Left: alive('p1'), p2Left: alive('p2') });
	}

	// ── 렌더링 ──
	const reqMon = req?.side?.pokemon;
	const activeReq = req?.active?.[slotIdx];
	const curMon = scene.p1.active[slotIdx];

	/** 화면에 보이는 대로의 상대: 일루전(조로아크)으로 둔갑한 포켓몬은 둔갑한 모습으로 상성·데미지를 계산 (진짜 타입이 새지 않게) */
	/** 상대가 쓴 기술 기록: 잠꼬대·손가락흔들기로 나온 기술, 매직미러로 튕긴 기술, Z기술·다이맥스 기술은 그 포켓몬의 기술이 아니라서 뺌
	 *  (넣으면 배틀팩토리에서 교환으로 받은 포켓몬의 기술이 '바뀐' 것처럼 보임) */
	function noteSeen(mon: Mon | null | undefined, p: any) {
		if (!mon || p.kw?.from || p.kw?.zeffect) return;
		const md = sessionRef.current?.battle.dex.moves.get(p.args[2]);
		if (md && (md.isZ || md.isMax)) return;
		if (!mon.seen.includes(p.args[2])) mon.seen.push(p.args[2]);
	}
	const seen = (p: any): any => {
		if (!p?.illusion) return p;
		return p.terastallized ? [p.terastallized] : p.illusion.species.types;
	};
	/** 정확한 예상 데미지: 배틀을 복제해 고른 기믹(메가진화·테라스탈·다이맥스·Z기술)을 적용한 뒤 엔진의 데미지 계산(날씨·필드·특성·도구·벽·랭크 모두 반영)으로 최소~최대.
	 *  원래 배틀의 난수는 건드리지 않음. 같은 턴·기믹이면 결과를 기억해 둠 */
	const dmgCacheRef = useRef<{ key: string; ser: any; res: Map<string, string> }>({ key: '', ser: null, res: new Map() });
	const exactDamage = (b: any, moveId: string, moveIdx: number, targetSide: 'p1' | 'p2', tslot: number, nTargets: number): string | null => {
		const key = `${b.turn}|${b.p1.activeRequest?.rqid ?? ''}|${slotIdx}|${gimmick}`;
		const cache = dmgCacheRef.current;
		if (cache.key !== key) { cache.key = key; cache.res = new Map(); try { cache.ser = State.serializeBattle(b); } catch { cache.ser = null; } }
		const k2 = `${moveId}|${targetSide}|${tslot}|${nTargets}`;
		if (cache.res.has(k2)) return cache.res.get(k2)!;
		if (!cache.ser) return null;
		let out: string | null = null;
		try {
			const c: any = State.deserializeBattle(cache.ser);
			c.send = () => {}; c.add = () => {}; c.hint = () => {};
			const cu = c.p1.active[slotIdx], ct = c[targetSide].active[tslot];
			if (!cu || !ct || ct.fainted) return null;
			if (gimmick === 'megax' && cu.canMegaEvoX) cu.canMegaEvo = cu.canMegaEvoX;
			if (gimmick === 'megay' && cu.canMegaEvoY) cu.canMegaEvo = cu.canMegaEvoY;
			if (['mega', 'megax', 'megay', 'ultra'].includes(gimmick) && (cu.canMegaEvo || cu.canUltraBurst)) c.actions.runMegaEvo(cu);
			if (gimmick === 'terastallize' && cu.canTerastallize) c.actions.terastallize(cu);
			if (gimmick === 'dynamax' && !cu.volatiles['dynamax']) cu.addVolatile('dynamax');
			let am: any = c.dex.getActiveMove(moveId);
			if (cu.volatiles['dynamax']) am = c.actions.getActiveMaxMove(am, cu);
			else if (gimmick === 'zmove' && activeReq?.canZMove?.[moveIdx]) am = c.actions.getActiveZMove(am, cu) || am;
			am.willCrit = false;
			c.activeMove = am; c.activePokemon = cu; c.activeTarget = ct;
			c.singleEvent('ModifyType', am, null, cu, ct, am, am);
			c.singleEvent('ModifyMove', am, null, cu, ct, am, am);
			am = c.runEvent('ModifyType', cu, ct, am, am) || am;
			am = c.runEvent('ModifyMove', cu, ct, am, am) || am;
			if (am.category === 'Status') { cache.res.set(k2, ''); return ''; }
			if (nTargets > 1 && ['allAdjacent', 'allAdjacentFoes'].includes(am.target)) am.spreadHit = true;
			c.randomizer = (d: number) => d;   // 난수 없이 최대값 (최소값은 85%)
			const r = c.actions.getDamage(cu, ct, am, true);
			let max = typeof r === 'number' ? r : 0;
			if (!max) { cache.res.set(k2, ''); return ''; }
			let min = Math.floor(max * 0.85);
			const mh = am.multihit; if (mh) { const [a, z] = Array.isArray(mh) ? mh : [mh, mh]; min *= a; max *= z; }
			const hp = ct.hp, mhp = ct.maxhp || 1;
			const p0 = Math.max(1, Math.floor(min / mhp * 100)), p1 = Math.max(1, Math.floor(max / mhp * 100));
			out = min >= hp ? 'KO 확정' : max >= hp ? `${p0}%~KO` : p0 === p1 ? `약 ${p0}%` : `${p0}~${p1}%`;
		} catch (e) { out = null; }
		cache.res.set(k2, out ?? '');
		return out;
	};
	/** 예상 데미지 비율 문자열 (설정 켜짐 때) */
	const dmgPreview = (m: any, targetSide: 'p1' | 'p2' = 'p2', slot?: number): string => {
		if (!settings.damagePreview) return '';
		const b = sessionRef.current?.battle; if (!b) return '';
		const user = b.p1.active[slotIdx]; if (!user) return '';
		const targets = slot !== undefined ? [b[targetSide].active[slot]] : b.p2.active.filter((x: any) => x && !x.fainted);
		const mv = b.dex.moves.get(m.id);
		if (!mv || (mv.category === 'Status' && gimmick !== 'zmove' && gimmick !== 'dynamax') || !targets.length || !targets[0]) return '';
		// 일루전으로 둔갑한 상대는 정체가 드러나지 않게 예전 방식(보이는 모습 기준)으로
		if (!targets[0].illusion) {
			const tslot = slot !== undefined ? slot : b.p2.active.indexOf(targets[0]);
			const idx = (activeReq?.moves || []).findIndex((x: any) => x.id === m.id);
			const ex = exactDamage(b, m.id, idx, targetSide, tslot, b[targetSide].active.filter((x: any) => x && !x.fainted).length);
			if (ex !== null) return ex;
		}
		try {
			const d = estimateDamage(b, user, targets[0].illusion && !targets[0].terastallized ? targets[0].illusion : targets[0], mv);
			if (d <= 0) return '';
			const pct = Math.round(d * targets[0].hp / targets[0].maxhp * 100);
			return pct >= 100 ? 'KO 가능' : `약 ${Math.max(1, pct)}%`;
		} catch { return ''; }
	};

	const moveInfo = (m: any, i = -1) => {
		const md = moveData(m.id, gen);
		let type = md?.type || 'Normal';
		let name = moveKo(m.move);
		if (i >= 0 && gimmick === 'zmove') {
			const z = activeReq?.canZMove?.[i];
			if (z) name = moveKo(z.move);
		}
		const dmaxed = activeReq?.maxMoves && !activeReq?.canDynamax;
		if (i >= 0 && (gimmick === 'dynamax' || dmaxed) && activeReq?.maxMoves?.maxMoves?.[i]) {
			name = moveKo(activeReq.maxMoves.maxMoves[i].move);
		}
		if (m.id === 'hiddenpower') {
			const t = /Hidden Power (\w+)/.exec(m.move)?.[1];
			if (t) { type = t; name = `잠재파워(${typeKo(t)})`; }
		}
		// 상황에 따라 타입이 바뀌는 기술: 실제 타입으로 표시
		type = dynamicType(m.id, type, gimmick === 'terastallize' ? activeReq?.canTerastallize : undefined);
		let eff = '';
		if (md && md.category !== 'Status' && !setup.doubles) {
			const s = sessionRef.current!.battle;
			const target = s.p2.active.find((p: any) => p && !p.fainted);
			if (target) {
				const e = moveEffOf(s, m.id, type, seen(target));
				eff = e === 0 ? '효과 없음' : e >= 4 ? '효과 매우 굉장' : e >= 2 ? '효과 굉장' : e <= 0.25 ? '매우 별로' : e < 1 ? '효과 별로' : '보통';
			}
		}
		return { md, type, name, eff };
	};

	const pressRef = useRef<{ t: any; long: boolean }>({ t: 0, long: false });
	const [infoMove, setInfoMove] = useState<number | null>(null);
	/** 테라버스트·웨더볼·심판의힘 등 상황에 따라 바뀌는 기술 타입 (사용자의 현재 상태 기준) */
	const dynamicType = (id: string, base: string, teraSoon?: string): string => {
		const b = sessionRef.current?.battle; const u = b?.p1.active[slotIdx];
		if (!b || !u) return base;
		const tera = u.terastallized || teraSoon;
		const weather = b.field.effectiveWeather?.() || b.field.weather;
		const special = dynamicBase(id, base, b, u, tera, weather);
		// 특성으로 바뀌는 타입: 스킨 계열(노말 기술 → 페어리·얼음·비행·전기), 노말스킨, 촉촉보이스. 타입이 스스로 바뀌는 기술은 제외
		if (special !== base || NO_SKIN.has(id) || (id === 'terablast' && tera)) return special;
		const megaTo = gimmick.startsWith('mega') && (gimmick === 'megax' ? u.canMegaEvoX : gimmick === 'megay' ? u.canMegaEvoY : u.canMegaEvo);
		const ab = megaTo ? toID(b.dex.species.get(megaTo).abilities['0']) : u.hasAbility ? ['pixilate', 'refrigerate', 'aerilate', 'galvanize', 'normalize', 'liquidvoice'].find(a => u.hasAbility(a)) || '' : '';
		const skin = ({ pixilate: 'Fairy', refrigerate: 'Ice', aerilate: 'Flying', galvanize: 'Electric' } as any)[ab];
		if (skin && base === 'Normal') return skin;
		if (ab === 'normalize') return 'Normal';
		if (ab === 'liquidvoice' && b.dex.moves.get(id).flags?.sound) return 'Water';
		return base;
	};
	const dynamicBase = (id: string, base: string, b: any, u: any, tera: string | undefined, weather: string): string => {
		switch (id) {
		case 'terablast': return tera || base;
		case 'weatherball': return ({ sunnyday: 'Fire', desolateland: 'Fire', raindance: 'Water', primordialsea: 'Water', sandstorm: 'Rock', hail: 'Ice', snowscape: 'Ice' } as any)[weather] || base;
		case 'terrainpulse': return ({ electricterrain: 'Electric', grassyterrain: 'Grass', mistyterrain: 'Fairy', psychicterrain: 'Psychic' } as any)[b.field.terrain] || base;
		case 'judgment': case 'multiattack': case 'revelationdance': case 'ragingbull': case 'ivycudgel': return tera || u.getTypes()[0] || base;
		case 'technoblast': return ({ dousedrive: 'Water', shockdrive: 'Electric', burndrive: 'Fire', chilldrive: 'Ice' } as any)[u.item] || base;
		case 'aurawheel': return u.species.id === 'morpekohangry' ? 'Dark' : base;
		case 'naturalgift': return b.dex.items.get(u.item)?.naturalGift?.type || base;
		default: return base;
		}
	};
	const renderMoves = () => {
		if (!activeReq) return null;
		return <div class="move-panel">
			<div class="move-grid">
				{activeReq.moves.map((m: any, i: number) => {
					const { md, type, name, eff } = moveInfo(m, i);
					const disabled = m.disabled || (m.pp === 0 && m.id !== 'struggle') || (gimmick === 'zmove' && !activeReq.canZMove?.[i]);
					const low = m.maxpp && m.pp <= Math.max(1, Math.floor(m.maxpp / 4));
					const dp = settings.damagePreview && !setup.doubles ? dmgPreview(m) : '';
					return <button key={i} class={'mvb' + (disabled ? ' off' : '')} disabled={disabled && !m.maxpp}
						style={{ '--tc': TYPE_COLOR[type] } as any}
						onPointerDown={() => { pressRef.current.long = false; clearTimeout(pressRef.current.t); pressRef.current.t = setTimeout(() => { pressRef.current.long = true; setInfoMove(i); }, 450); }}
						onPointerUp={() => clearTimeout(pressRef.current.t)} onPointerLeave={() => clearTimeout(pressRef.current.t)}
						onContextMenu={e => e.preventDefault()}
						{...hov(() => md ? <div><b>{name}</b> <span class="tip-types"><TypeBadge type={type} small /><CatIcon cat={md.category} /></span>
							<div>위력 <b>{md.basePower || '-'}</b> · 명중 <b>{md.accuracy || '필중'}</b>{md.priority ? ` · 우선도 ${md.priority > 0 ? '+' : ''}${md.priority}` : ''}{md.contact ? ' · 접촉' : ''}</div>
							{eff && <div>{eff}</div>}
							<div class="muted">{md.desc}</div></div> : null)}
						onClick={() => { if (pressRef.current.long) { pressRef.current.long = false; return; } if (disabled) { setInfoMove(i); return; } onMove(i + 1, m); }}>
						<span class="mvb-top"><TypeBadge type={type} small />{md && <CatIcon cat={md.category} />}
							<span class={'mvb-pp' + (low ? ' low' : '')}>{m.maxpp ? <><i class="pp-l">PP </i><b>{m.pp}</b>/{m.maxpp}</> : ''}</span></span>
						<span class={'mvb-name' + (name.length >= 9 ? ' xl' : name.length >= 7 ? ' l' : '')}>{name}</span>
						<span class="mvb-bottom">
							{eff && eff !== '보통' ? <span class={'mvb-eff ' + (eff.includes('굉장') ? 'good' : eff === '효과 없음' ? 'none' : 'bad')}>{eff}</span> : <span />}
							{dp && <span class="mvb-dmg">{dp}</span>}
						</span>
					</button>;
				})}
			</div>
			<div class="mv-hint">기술을 길게 누르면 설명을 볼 수 있어요</div>
			{infoMove !== null && activeReq.moves[infoMove] && (() => {
				const m = activeReq.moves[infoMove];
				const fi = moveInfo(m, infoMove);
				const md = fi.md;
				// Z기술·다이맥스 기술: 변환된 기술의 위력(원래 기술 위력에서 계산)·명중(필중)·효과
				const simBase = sessionRef.current?.battle.dex.moves.get(m.id);
				const dmaxed = activeReq?.maxMoves && !activeReq?.canDynamax;
				let gmInfo: { kind: string; power: string; acc: string; desc: string; cat: string } | null = null;
				if (gimmick === 'zmove' && activeReq.canZMove?.[infoMove]) {
					const z = activeReq.canZMove[infoMove];
					const zd = moveData(toID(z.move), gen);
					const zmv = simBase?.zMove || {};
					const eff = zmv.boost ? `Z파워 효과: ${Object.entries(zmv.boost).map(([k, v]) => `${STAT_KO[k] || k} +${v}`).join(', ')}` :
						zmv.effect ? `Z파워 효과: ${({ heal: 'HP 모두 회복', healreplacement: '교체해 나오는 포켓몬 HP 회복', clearnegativeboost: '내려간 능력 원래대로', redirect: '상대 기술을 자신에게', crit2: '급소율 2단계 상승', curse: '저주 중이면 HP 모두 회복' } as any)[zmv.effect] || zmv.effect}` : '';
					const zId = toID(z.move);
					const zDesc = Z_SIG_KO[zId] || (zd?.desc && !/사용할 수 없는 기술/.test(zd.desc) ? zd.desc :
						(simBase?.category === 'Status' ? `${md?.name}의 Z파워 버전. 원래 효과에 더해 Z파워 효과가 발동한다.` : `${md?.name}을(를) Z파워로 강화한 기술. 반드시 명중하고 방어·판별을 뚫고 1/4 데미지.`));
					gmInfo = { kind: 'Z기술', power: simBase?.category === 'Status' ? '—' : String(zmv.basePower || zd?.basePower || '—'), acc: '필중',
						desc: [zDesc, eff, md?.desc ? `원래 기술(${md.name}): ${md.desc}` : ''].filter(Boolean).join('\n'), cat: simBase?.category || md?.category || 'Physical' };
				} else if ((gimmick === 'dynamax' || dmaxed) && activeReq.maxMoves?.maxMoves?.[infoMove]) {
					const mx = activeReq.maxMoves.maxMoves[infoMove];
					const xd = moveData(toID(mx.move), gen);
					const isGuard = toID(mx.move) === 'maxguard';
					gmInfo = { kind: isGuard ? '다이맥스 기술' : '다이맥스 기술', power: isGuard ? '—' : String(simBase?.maxMove?.basePower || xd?.basePower || '—'), acc: '필중',
						desc: [xd?.desc, md?.desc && !isGuard ? `원래 기술(${md.name}): ${md.desc}` : ''].filter(Boolean).join('\n'), cat: isGuard ? 'Status' : (simBase?.category || md?.category || 'Physical') };
				}
				return <Modal title={fi.name} onClose={() => setInfoMove(null)}>
					<div class="mi-head"><TypeBadge type={fi.type} />{(gmInfo || md) && <CatIcon cat={gmInfo ? gmInfo.cat : md!.category} />}{gmInfo && <span class="tag">{gmInfo.kind}</span>}</div>
					<div class="mi-table">
						<div><span>위력</span><b>{gmInfo ? gmInfo.power : md?.category === 'Status' ? '—' : md?.basePower || '—'}</b></div>
						<div><span>명중</span><b>{gmInfo ? gmInfo.acc : md?.accuracy || '—'}</b></div>
						<div><span>PP</span><b>{m.maxpp ? `${m.pp}/${m.maxpp}` : '—'}</b></div>
						<div><span>우선도</span><b>{md?.priority ? (md.priority > 0 ? '+' : '') + md.priority : '0'}</b></div>
						<div><span>접촉</span><b>{md?.contact ? '함' : '안 함'}</b></div>
						<div><span>상성</span><b>{fi.eff || '—'}</b></div>
					</div>
					{gmInfo ? <p class="mi-desc pre">{gmInfo.desc}</p> : md?.desc && <p class="mi-desc">{md.desc}</p>}
					{m.disabled && <p class="sheet-note">지금은 쓸 수 없는 기술입니다.</p>}
					<button class="btn primary big" disabled={!!m.disabled || m.pp === 0} onClick={() => { setInfoMove(null); onMove(infoMove + 1, m); }}>이 기술을 쓴다</button>
				</Modal>;
			})()}
		</div>;
	};

	function onMove(num: number, m: any) {
		const locked = m.pp === undefined && m.maxpp === undefined;
		const dmaxed = activeReq?.maxMoves && !activeReq?.canDynamax;
		let target = locked ? 'self' : m.target || moveData(m.id, gen)?.target || 'normal';
		if (dmaxed || gimmick === 'dynamax') target = activeReq.maxMoves?.maxMoves?.[num - 1]?.target || 'adjacentFoe';
		if (gimmick === 'zmove') target = activeReq.canZMove?.[num - 1]?.target || target;
		const gm = gimmick ? ' ' + gimmick : '';
		setGimmick('');
		// 더블·멀티: 모든 기술에서 대상(범위) 확인 화면 — 하나를 고르는 기술은 대상을, 광역기는 맞는 포켓몬을 표시하고 눌러서 확정
		if (setup.doubles) {
			setPendingMove({ num, target, gm });
			setMenu('target');
			return;
		}
		pushChoice(`move ${num}${gm}`);
	}

	/** 기술 범위: 'pick' 하나를 고름, 'all' 표시된 포켓몬 모두에게 (확인만) */
	function targetPlan(t: string): { mode: 'pick' | 'all'; foes: boolean; ally: boolean; self: boolean } {
		switch (t) {
		case 'normal': case 'any': return { mode: 'pick', foes: true, ally: true, self: false };
		case 'adjacentFoe': return { mode: 'pick', foes: true, ally: false, self: false };
		case 'adjacentAlly': return { mode: 'pick', foes: false, ally: true, self: false };
		case 'adjacentAllyOrSelf': return { mode: 'pick', foes: false, ally: true, self: true };
		case 'allAdjacentFoes': case 'foeSide': case 'randomNormal': case 'scripted': return { mode: 'all', foes: true, ally: false, self: false };
		case 'allAdjacent': return { mode: 'all', foes: true, ally: true, self: false };
		case 'all': return { mode: 'all', foes: true, ally: true, self: true };
		case 'allySide': case 'allyTeam': case 'allies': return { mode: 'all', foes: false, ally: true, self: true };
		default: return { mode: 'all', foes: false, ally: false, self: true }; // self 등
		}
	}

	/** 대상 확인 화면 (포켓몬 챔피언스처럼 위: 상대, 아래: 내 편 · 상성 표시) */
	const renderTargets = () => {
		if (!pendingMove) return null;
		const plan = targetPlan(pendingMove.target);
		const mv = activeReq?.moves[pendingMove.num - 1];
		const b = sessionRef.current?.battle;
		const md = mv ? b?.dex.moves.get(mv.id) : null;
		const effOf = (side: 'p1' | 'p2', i: number) => {
			const tg = b?.[side].active[i];
			if (!md || !tg || md.category === 'Status') return '';
			const e = moveEffOf(b, md.id, dynamicType(md.id, md.type, pendingMove.gm?.includes('terastallize') ? activeReq?.canTerastallize : undefined), seen(tg));
			return e === 0 ? '효과가 없음' : e >= 4 ? '효과가 매우 굉장함' : e >= 2 ? '효과가 굉장함' : e <= 0.25 ? '효과가 매우 별로' : e < 1 ? '효과가 별로' : '';
		};
		const go = (suffix: string) => pushChoice(`move ${pendingMove.num}${suffix}${pendingMove.gm || ''}`);
		const card = (side: 'p1' | 'p2', i: number, m: Mon | null) => {
			if (!m || m.fainted) return <div class="tcard empty" />;
			const self = side === 'p1' && i === slotIdx;
			const on = side === 'p2' ? plan.foes : self ? plan.self : plan.ally;
			const eff = on ? effOf(side, i) : '';
			const dp = on && side === 'p2' && mv && plan.mode === 'pick' ? dmgPreview(mv, 'p2', i) : '';
			const pct = m.maxhp ? Math.round(m.hp / m.maxhp * 100) : 0;
			const click = !on ? undefined : plan.mode === 'all' ? () => go('') : () => go(side === 'p2' ? ` ${i + 1}` : ` -${i + 1}`);
			const effCls = 'teff ' + (eff.includes('굉장') ? 'up' : 'down');
			// 세로로 긴 카드: 효과 표시는 맨 위 가운데(teff), 가로로 짧은 카드: 이름 줄 안(teff-in) — CSS 컨테이너 쿼리로 하나만 보임
			return <button class={'tcard ' + (side === 'p2' ? 'foe' : 'ally') + (on ? ' on' : ' off')} disabled={!on} onClick={click}>
				{eff && <span class={effCls}>{eff}</span>}
				<span class="tbody">
					<span class="trow"><span class="tname">{self ? '자신 · ' : ''}{m.nick}</span>{monTags(m)}{eff && <span class={effCls + ' teff-in'}>{eff}</span>}</span>
					<HPBar hp={pct} maxhp={100} />
					<small>{side === 'p2' ? `${pct}%` : `${m.hp}/${m.maxhp}`}{dp && ` · ${dp}`}</small>
				</span>
			</button>;
		};
		// 여러 대상 기술: 맞는 포켓몬끼리 선으로 이어 보임 (위: 상대 0·1, 아래: 내 편 0·1)
		const hit = (side: 'p1' | 'p2', i: number) => {
			const m = (side === 'p2' ? scene.p2 : scene.p1).active[i];
			if (!m || m.fainted) return false;
			return side === 'p2' ? plan.foes : (side === 'p1' && i === slotIdx) ? plan.self : plan.ally;
		};
		const spread = plan.mode === 'all';
		/** 이 칸에서 오른쪽(r)·아래(d) 이웃으로 이어지는 선 */
		const linkOf = (side: 'p1' | 'p2', i: number) => !spread || !hit(side, i) ? null : <>
			{i === 0 && hit(side, 1) && <i class="tlink r" aria-hidden="true" />}
			{side === 'p2' && hit('p1', i) && <i class="tlink d" aria-hidden="true" />}
		</>;
		return <div class="target-pane">
			<div class="thint">{plan.mode === 'pick' ? '기술을 쓸 대상을 고르세요' : `${md ? moveKo(md.id) : '기술'}: 이어진 포켓몬 모두에게 — 눌러서 확정`}</div>
			<div class={'target-grid2' + (spread ? ' spread' : '')}>
				{[0, 1].map(i => <div class="tcell">{linkOf('p2', i)}{card('p2', i, scene.p2.active[i])}</div>)}
				{[0, 1].map(i => <div class="tcell">{linkOf('p1', i)}{card('p1', i, scene.p1.active[i])}</div>)}
			</div>
		</div>;
	};

	const renderSwitch = () => {
		if (!reqMon) return null;
		const trapped = activeReq?.trapped && !req.forceSwitch;
		const chosen = new Set(parts.filter(p => p.startsWith('switch')).map(p => parseInt(p.slice(7), 10)));
		return <div class="switch-list">
			{trapped && <div class="hint">도망칠 수 없어서 교체할 수 없다!</div>}
			{reqMon.map((p: any, i: number) => {
				const hp = parseHP(p.condition);
				const nick = p.ident.slice(4);
				const species = p.details.split(',')[0];
				const isActive = p.active;
				const fainted = hp.status === 'fnt';
				// 부활의기원(Revival Blessing): 쓰러진 포켓몬만 고를 수 있음
				const reviving = reqMon.some((x: any) => x.reviving);
				const theirs = !!setup.partner && partnerOf(sessionRef.current!.battle.p1.pokemon[i]);
				const disabled = theirs || (reviving ? (!fainted || chosen.has(i + 1)) : (isActive || fainted || trapped || chosen.has(i + 1)));
				return <button key={i} class={'switch-btn' + (isActive ? ' active' : '') + (disabled ? ' off' : '')}
					{...hov(() => ownTip(i))} onClick={() => setSheet({ idx: i, canSwitch: !disabled })}>
					<span class="sw-info">
						<span class="sw-top"><PokeIcon species={species} /><b>{nick}</b></span>
						<HPBar hp={hp.hp} maxhp={hp.maxhp || 1} />
						<small>{fainted ? '기절' : `${hp.hp}/${hp.maxhp}`} {hp.status && hp.status !== 'fnt' && <StatusBadge status={hp.status} />}{isActive && !fainted && ' · 배틀 중'}{theirs && ` · ${setup.partner!.name}의 포켓몬`}</small>
					</span>
				</button>;
			})}
		</div>;
	};

	const controls = () => {
		if (phase === 'ended') {
			return <div class="controls end">
				<button class="btn primary big" onClick={finish}>계속</button>
				<button class="btn ghost" onClick={() => setShowLog(true)}>배틀 기록</button>
				{!setup.replay && !replaySaved && <button class="btn ghost" onClick={saveThisReplay}>리플레이 저장</button>}
			</div>;
		}
		if (phase !== 'input' || !req) {
			return <div class="controls waiting">
				<button class="btn small" onClick={() => cycleSpeed()}>배속 {SPEED_LABEL[settings.speed]}</button>
				{!setup.replay && <button class={'btn small text-toggle' + (settings.textManual ? ' manual' : '')} onClick={() => toggleManual()}>메시지 {settings.textManual ? '▶ 수동' : '▶ 자동'}</button>}
				{setup.replay && <button class="btn small ghost" onClick={() => { deadRef.current = true; skipRef.current?.(); cancelAnims(); stopMusic(); onEnd({ win: false, forfeit: false, turns: 0, p1Left: 0, p2Left: 0, quit: true }); }}>■ 그만 보기</button>}
				<p class="muted small">{setup.replay ? '🎬 리플레이 재생 중 · 화면을 누르면 메시지를 넘깁니다' : settings.textManual ? '수동 진행 · 화면을 누르면 다음 메시지' : '화면을 누르면 메시지를 넘깁니다'}</p>
			</div>;
		}
		const back = (parts.length || menu !== 'main') && !(req.forceSwitch && !parts.length) ?
			<button class="btn small ctl-back" onClick={() => {
				if (menu === 'target') setMenu('moves');
				else if (menu !== 'main' && !req.forceSwitch) setMenu('main');
				else cancelChoice();
			}}>◀ 뒤로</button> : null;
		const usedG = parts.join(' ');
		const g: [string, string, string][] = [];
		// 넓은 화면: 처음부터 공격·교체를 함께 보여 줌 (쇼다운식)
		const combined = (wide || land) && menu === 'main' && !req.forceSwitch;
		if (activeReq && (menu === 'moves' || combined)) {
			if (!/ mega| ultra/.test(usedG)) {
				if (activeReq.canMegaEvo) g.push(['mega', '메가진화', '#e070e0']);
				if (activeReq.canMegaEvoX) g.push(['megax', '메가진화 X', '#e070e0']);
				if (activeReq.canMegaEvoY) g.push(['megay', '메가진화 Y', '#e070e0']);
				if (activeReq.canUltraBurst) g.push(['ultra', '울트라버스트', '#f0d040']);
			}
			if (activeReq.canZMove && !/ zmove/.test(usedG)) g.push(['zmove', 'Z파워', '#f0c020']);
			if (activeReq.canDynamax && !/ dynamax/.test(usedG)) g.push(['dynamax', '다이맥스', '#e83050']);
			if (activeReq.canTerastallize && !/ terastallize/.test(usedG)) g.push(['terastallize', `테라 · ${typeKo(activeReq.canTerastallize)}`, TYPE_COLOR[activeReq.canTerastallize] || '#60c0e0']);
		}
		const title = req.forceSwitch ? '교체할 포켓몬을 고르세요' : menu === 'target' ? '누구에게 쓸까요?' : curMon ? `${curMon.nick}${setup.doubles ? ` (${slotIdx + 1}번째)` : ''}` : '';
		return <div class="controls">
			<div class="ctl-head">
				<span class="ctl-title">{title}</span>
				{!wide && <button class="btn small ctl-foe" onClick={() => setFoeOpen(true)}>상대</button>}
				<button class="btn small ctl-log" onClick={() => setShowLog(true)}>기록</button>
				{back}
			</div>
			{combined && <div class="sd-panel">
				{renderMoves()}
				{land ? <div class="sd-cmds">
					{/* 휴대폰 가로: 교체는 '포켓몬' 버튼으로 오른쪽 칸 전체를 써서 */}
					<button class="cmd-sub green" onClick={() => setMenu('switch')}>포켓몬</button>
					{setup.story?.bag && <button class="cmd-sub yellow" onClick={() => setBagOpen('')}>가방</button>}
					<button class="cmd-sub blue" onClick={forfeit}>{setup.runAway ? '도망' : '기권'}</button>
					{!wide && <button class="cmd-sub red sd-foe" onClick={() => setFoeOpen(true)}>상대</button>}
					<button class="cmd-sub yellow" onClick={() => setShowLog(true)}>기록</button>
				</div> : <>
					<div class="sd-label">교체 {setup.story?.bag && <button class="btn small sd-forfeit" onClick={() => setBagOpen('')}>가방</button>}<button class="btn small sd-forfeit" onClick={forfeit}>{setup.runAway ? '도망' : '기권'}</button>{!wide && <button class="btn small sd-foe2" onClick={() => setFoeOpen(true)}>상대</button>}<button class="btn small sd-log" onClick={() => setShowLog(true)}>기록</button></div>
					{renderSwitch()}
				</>}
			</div>}
			{menu === 'main' && !combined && <div class="cmd-menu">
				<button class="cmd-fight" onClick={() => { setFocus(0); setMenu('moves'); }}><span>싸운다</span></button>
				<div class="cmd-row">
					{setup.story?.bag ? <button class="cmd-sub yellow" onClick={() => setBagOpen('')}>가방</button> : <button class="cmd-sub yellow" onClick={() => setFieldOpen(true)}>필드</button>}
					<button class="cmd-sub blue" onClick={forfeit}>{setup.runAway ? '도망' : '기권'}</button>
					<button class="cmd-sub green" onClick={() => setMenu('switch')}>포켓몬</button>
				</div>
			</div>}
			{g.length > 0 && <div class="gm-bar">{g.map(([k, label, col]) => <button class={'gmb' + (gimmick === k ? ' on' : '')} style={{ '--gc': col } as any}
				onClick={() => setGimmick(gimmick === k ? '' : k)}><span class="gmb-dot" />{label}</button>)}</div>}
			{menu === 'moves' && renderMoves()}
			{menu === 'target' && renderTargets()}
			{menu === 'switch' && renderSwitch()}
		</div>;
	};

	/** 작은 상태 표시: 상태이상 → 테라스탈 타입(다이맥스) → 능력 변화. 싱글은 HP 창 이름 아래 줄, 더블·멀티는 이름 옆, 대상 카드에도.
	 *  한 줄에 다 안 들어가면 끝에 [+] (HP 창을 누르면 필드 상황 — 거기서 전부 보임). 넘침 판정은 아래 useLayoutEffect */
	const BOOST_ORD = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
	const BOOST_LB: { [k: string]: string } = { atk: '공격', def: '방어', spa: '특공', spd: '특방', spe: '스피드', accuracy: '명중', evasion: '회피' };
	const monTags = (mon: Mon, cls = '', boosts = true) => {
		const bs = boosts ? BOOST_ORD.filter(k => mon.boosts[k]) : [];
		if (!(mon.status || mon.tera || mon.vol.has('dynamax') || bs.length)) return null;
		return <span class={'mon-tags info-tags' + (cls ? ' ' + cls : '')}>
			{mon.status && <StatusBadge status={mon.status} />}
			{mon.tera && <span class="mtag tera" style={{ background: TYPE_COLOR[mon.tera] }}>{typeKo(mon.tera)}</span>}
			{mon.vol.has('dynamax') && <span class="mtag dmax">다이맥스</span>}
			{bs.map(k => <span class={'mtag boost ' + (mon.boosts[k] > 0 ? 'up' : 'down')}>{BOOST_LB[k]}{mon.boosts[k] > 0 ? '+' : ''}{mon.boosts[k]}</span>)}
			<span class="mtag more" aria-label="더 보기 (필드 상황)">+</span>
		</span>;
	};
	// 상태 줄이 넘치면: 다 안 들어가는 칸은 통째로 숨기고, 보이는 마지막 칸 뒤에 [+] (그릴 때마다 다시 잼)
	useLayoutEffect(() => {
		document.querySelectorAll<HTMLElement>('.battle .info-tags').forEach(el => {
			const chips = [...el.children].filter(c => !c.classList.contains('more')) as HTMLElement[];
			chips.forEach(c => { c.style.display = ''; });
			el.classList.remove('over');
			if (el.scrollWidth <= el.clientWidth + 1) return;
			el.classList.add('over');
			for (let i = chips.length - 1; i > 0 && el.scrollWidth > el.clientWidth + 1; i--) chips[i].style.display = 'none';
		});
	});
	const infoBox = (mon: Mon | null, own: boolean, i: number) => {
		if (!mon || (mon.fainted && !mon.anim)) return <div class="info empty" key={i} />;
		// 포켓몬마다 새 상자 (교체 때 HP 바가 이전 포켓몬 값에서 늘거나 주는 것처럼 보이지 않게)
		const ownIdx = own ? (sessionRef.current?.battle.p1.pokemon || []).findIndex((p: any) => p.name === mon.nick) : -1;
		return <div class={'info ' + (own ? 'own' : 'foe') + ' i' + i} key={mon.ident + ':' + i}
			onClick={e => (e.currentTarget as HTMLElement).querySelector('.info-tags.over') ? setFieldOpen(true) : setDetail({ mon, own })}
			{...hov(() => own && ownIdx >= 0 ? ownTip(ownIdx) : foeTip(mon))}>
			<div class="info-top">
				<b class="info-name">{mon.nick}</b>
				{mon.gender && <span class={'gender ' + mon.gender}>{mon.gender === 'M' ? '♂' : '♀'}</span>}
				<span class="lv">Lv{mon.level}</span>
				{setup.doubles && monTags(mon, 'inline')}
			</div>
			{!setup.doubles && monTags(mon, 'row')}
			<HPBar hp={mon.hp} maxhp={mon.maxhp} />
			<div class="info-bottom">
				<span />
				{own ? <span class="hp-num">{mon.hp}/{mon.maxhp}</span> : <span class="hp-num">{mon.maxhp ? Math.ceil(mon.hp / mon.maxhp * 100) : 0}%</span>}
			</div>
			{/* 혼란 등 기타 상태는 '필드' 메뉴에서 */}
		</div>;
	};

	const spriteSlot = (mon: Mon | null, own: boolean, i: number) => {
		const pos = (own ? 'own' : 'foe') + ' s' + i;
		if (!mon || (mon.fainted && !mon.anim) || mon.hidden) return <div class={'slot ' + pos} key={i} />;
		const fl = !mon.vol.has('substitute') && floats(toID(mon.transformed || mon.species));
		return <div class={'slot ' + pos + ' ' + (mon.anim || '') + (mon.away ? ' away' : '') + (mon.vol.has('dynamax') ? ' dmax' : '') + (mon.tera ? ' tera' : '') + (fl ? ' float' : '')} key={i}
			style={mon.tera ? { '--tera': TYPE_COLOR[mon.tera] } as any : undefined} onClick={() => setDetail({ mon, own })}>
			{mon.vol.has('substitute') ? <Sprite species="substitute" back={own} gen={gen} size={400} cls={own ? 'back' : 'front'} /> :
				<Sprite species={mon.transformed || mon.species} back={own} shiny={mon.shiny} gen={gen} size={400} cls={own ? 'back' : 'front'} tera={mon.tera || undefined} />}
		</div>;
	};

	const sideChips = (side: SideScene) => Object.entries(side.cond).map(([id, n]) =>
		<span class="chip side">{sideKo(id, SIDE_KO)}{n > 1 ? `×${n}` : ''}</span>);
	const teamDots = (side: SideScene, own: boolean) => {
		const total = side.teamSize;
		const dots = [];
		for (let i = 0; i < total; i++) {
			const m = own ? side.team[i] : side.team[i];
			const cls = !m ? 'unk' : m.fainted ? 'fnt' : m.status ? 'sts' : 'ok';
			dots.push(<span class={'ball ' + cls} />);
		}
		return <div class={'balls ' + (own ? 'own' : 'foe')}>{dots}</div>;
	};

	/** 시뮬레이터의 내 포켓몬 → 상세 시트용 데이터 */
	function liveOf(idx: number): { set: PSet; live: LiveInfo } | null {
		const sm = sessionRef.current?.battle.p1.pokemon[idx];
		if (!sm) return null;
		const pp: LiveInfo['pp'] = {};
		const moves = sm.baseMoveSlots.map((m: any) => {
			const id = m.id === 'hiddenpower' && sm.hpType ? 'hiddenpower' + sm.hpType.toLowerCase() : m.id;
			pp[toID(id)] = [m.pp, m.maxpp];
			return id;
		});
		return {
			set: { name: sm.name, species: sm.species.name, item: sm.item, ability: sm.ability, moves, nature: sm.set.nature || 'serious',
				evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...sm.set.evs }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31, ...sm.set.ivs },
				level: sm.level, shiny: sm.set.shiny, teraType: sm.terastallized || sm.teraType },
			live: { hp: sm.hp, maxhp: sm.maxhp, status: sm.status, pp, stats: { hp: sm.maxhp, ...sm.storedStats }, boosts: sm.isActive ? sm.boosts : undefined },
		};
	}

	/** 정보 상자: 내 포켓몬 (실제 세트), 상대 포켓몬 (드러난 정보만) */
	const statLine = (bs: number[]) => bs.join(' / ');
	function ownTip(idx: number) {
		const d = liveOf(idx);
		if (!d) return null;
		const sd = speciesData(toID(d.set.species), gen);
		return <div>
			<b>{nickOf(d.set)}</b> <span class="muted">Lv{d.set.level}</span>
			<div class="tip-types">{sd?.t.map(t => <TypeBadge type={t} small />)}</div>
			<div>HP {d.live.hp}/{d.live.maxhp} ({Math.round(100 * d.live.hp / Math.max(1, d.live.maxhp))}%){d.live.status && <> · <StatusBadge status={d.live.status} /></>}</div>
			<div>특성 <b>{abilityKo(d.set.ability)}</b> · 도구 <b>{d.set.item ? itemKo(d.set.item) : '없음'}</b></div>
			{d.live.stats && <div class="muted">능력치 {['atk', 'def', 'spa', 'spd', 'spe'].map(k => `${STAT_SHORT[k]} ${d.live.stats![k]}`).join(' · ')}</div>}
			<ul class="tip-moves">{d.set.moves.map(m => <li>{moveKo(m)} <span class="muted">{d.live.pp?.[toID(m)] ? `${d.live.pp[toID(m)][0]}/${d.live.pp[toID(m)][1]}` : ''}</span></li>)}</ul>
		</div>;
	}
	function foeTip(mon: Mon) {
		const sd = speciesData(toID(mon.species), gen);
		return <div>
			<b>{mon.nick}</b> <span class="muted">Lv{mon.level}</span>
			<div class="tip-types">{sd?.t.map(t => <TypeBadge type={t} small />)}</div>
			<div>HP {mon.fainted ? 0 : Math.round(100 * mon.hp / Math.max(1, mon.maxhp))}%{mon.status && <> · <StatusBadge status={mon.status} /></>}</div>
			<div>특성 <b>{mon.ability ? abilityKo(mon.ability) : '미확인'}</b>{!mon.ability && sd && <span class="muted"> (후보: {sd.ab.map(abilityKo).join(' / ')})</span>}</div>
			<div>도구 <b>{mon.item ? itemKo(mon.item) : mon.itemSeen ? '없음' : '미확인'}</b></div>
			{sd && <div class="muted">종족값 {statLine(sd.bs)}</div>}
			{mon.seen.length > 0 && <ul class="tip-moves">{mon.seen.map(m => <li>{moveKo(m)}</li>)}</ul>}
		</div>;
	}
	const nickOf = (set: PSet) => set.name || speciesKo(set.species);
	/** 필드 양옆: 트레이너 그림·이름과 파티 현황 (쇼다운처럼) — 넓은 화면에서만 */
	const sidePanel = (own: boolean) => {
		const sd = own ? scene.p1 : scene.p2;
		const sprite = own ? setup.p1.sprite : setup.p2.sprite;
		const name = own ? setup.p1.name : setup.p2.name;
		const cells: any[] = [];
		if (own) {
			const all = sessionRef.current?.battle.p1.pokemon || [];
			all.forEach((pm: any, i: number) => {
				const d = liveOf(i);
				if (!d) return;
				const fnt = d.live.hp <= 0;
				cells.push(<div class={'sp-mon' + (fnt ? ' fnt' : '') + (pm.isActive ? ' act' : '')} {...hov(() => ownTip(i))} onClick={() => setSheet({ idx: i, canSwitch: false })}>
					<PokeIcon species={d.set.species} cls="sp-pic" />
					<HPBar hp={d.live.hp} maxhp={d.live.maxhp || 1} />
				</div>);
			});
		} else {
			for (let i = 0; i < sd.teamSize; i++) {
				const m = sd.team[i];
				cells.push(m ? <div class={'sp-mon' + (m.fainted ? ' fnt' : '') + (sd.active.includes(m) ? ' act' : '')} {...hov(() => foeTip(m))} onClick={() => setDetail({ mon: m, own: false })}>
					<PokeIcon species={m.species} cls="sp-pic" />
					<HPBar hp={m.fainted ? 0 : m.hp} maxhp={m.maxhp || 1} />
				</div> : <div class="sp-mon unk"><span class="ball unk" /></div>);
			}
		}
		return <div class={'side-info ' + (own ? 'own' : 'foe')}>
			<div class="si-name">{own ? (setup.partner ? `${name} & ${setup.partner.name}` : name) : name}</div>
			<div class="si-trainers">
				{sprite && <img class="si-tr" src={SPRITE_URL(sprite)} alt="" onError={trainerImgError} />}
				{own && setup.partner?.sprite && <img class="si-tr" src={SPRITE_URL(setup.partner.sprite)} alt="" onError={trainerImgError} />}
				{!own && setup.p2.sprite2 && <img class="si-tr" src={SPRITE_URL(setup.p2.sprite2)} alt="" onError={trainerImgError} />}
			</div>
			<div class="si-party">{cells}</div>
		</div>;
	};

	// 내 팀 순서대로 미리 채우기
	if (reqMon && scene.p1.team.length < reqMon.length) {
		for (const p of reqMon) {
			const nick = p.ident.slice(4);
			// 같은 별명이 여럿이면(같은 종 2마리 등) 그 수만큼 채움
			if (scene.p1.team.filter(m => m.nick === nick).length < reqMon.filter(q => q.ident.slice(4) === nick).length) {
				const d = parseDetails(p.details);
				const hp = parseHP(p.condition);
				scene.p1.team.push({ ident: 'p1: ' + nick, nick, species: d.species, level: d.level, gender: d.gender, shiny: d.shiny,
					hp: hp.hp, maxhp: hp.maxhp, status: hp.status === 'fnt' ? '' : hp.status, fainted: hp.status === 'fnt', boosts: {}, vol: new Set(), anim: '', seen: [] });
			}
		}
	}

	const slots = setup.doubles ? [0, 1] : [0];
	// 메시지가 나오는 동안(입력 차례가 아닐 때)은 화면 어디를 눌러도 다음 메시지로 (버튼·창은 제외) — 수동 진행에서 아래 빈 곳을 눌러도 넘어가게
	const tapAnywhere = (e: any) => { if (phase === 'input') return; if ((e.target as HTMLElement)?.closest?.('button, a, input, .modal, .modal-bg')) return; skipRef.current?.(); };
	return <div class={'battle bg-' + arenaBg + (setup.doubles ? ' doubles' : ' singles') + (hpTheme ? ' hpt-' + hpTheme : '')} style={{ '--spd': FX.fxSpeed() } as any} onClick={tapAnywhere}>
		<div class="hud-top">
			{setup.online ? <OnlineClock rs={setup.online} onTimeout={onlineTimeout} /> : <span class="badge">{setup.label || ''}</span>}
			<span class="badge">{scene.turn ? `${scene.turn}턴` : ''}</span>
			<button class="badge speed-btn" onClick={e => { e.stopPropagation(); cycleSpeed(); }}>{SPEED_LABEL[settings.speed]}</button>
			<button class={'badge text-btn' + (settings.textManual ? ' manual' : '')} onClick={e => { e.stopPropagation(); toggleManual(); }} aria-label="메시지 진행">{settings.textManual ? '▶ 수동' : '▶ 자동'}</button>
			<button class="badge field-btn" onClick={e => { e.stopPropagation(); setFieldOpen(true); }}>필드 ▸</button>
			<button class="badge menu-btn" onClick={e => { e.stopPropagation(); setMenuOpen(true); }} aria-label="메뉴">☰ 메뉴</button>
		</div>
		<div class="arena-wings" aria-hidden="true" />
		<div class={'arena' + (trainerVis.foe ? ' t-foe' : '')} ref={arenaRef} style={{ '--s': scale } as any} onClick={e => { e.stopPropagation(); skipRef.current?.(); }}>
			<div class="arena-bg" />
			<TeraFilters />
			{/* 날씨와 필드(테라인)는 다른 레이어: 한 요소에 두면 필드의 '입자 없음' 규칙이 비·모래 줄기(가상 요소)까지 지움 */}
			<div class={'weather-ov ' + (scene.weather || '')} />
			<div class={'weather-ov terrain-ov ' + [...scene.pseudo].join(' ')} />
			<div class="anim-bg-layer" ref={animBgRef} />
			{setup.online && phase !== 'ended' && <button class="emote-btn" onClick={e => { e.stopPropagation(); setEmoteOpen(o => !o); }} aria-label="한마디">
				<svg viewBox="0 0 14 12" width="28" height="24" shape-rendering="crispEdges"><path d="M1 0h12v1h1v7h-1v1H6v1H5v1H4v1H3V9H1V8H0V1h1z" fill="#10182a" /><path d="M1 1h12v7H5v1H4v1V8H1z" fill="#fff" /><path d="M3 4h2v2H3zM6 4h2v2H6zM9 4h2v2H9z" fill="#10182a" /></svg>
			</button>}
			{(['p2', 'p1'] as const).map(w => emote[w] ? <div class={'emote-bub ' + (w === 'p1' ? 'own' : 'foe')} key={emote[w]!.key}><small>{w === 'p1' ? setup.p1.name : setup.p2.name}</small>{EMOTES[emote[w]!.id] || '…'}</div> : null)}
			<div class="ab-clip">{(['p1', 'p2'] as const).map(sd => { const pp = scene.popup?.[sd]; return pp ? <div class={'ab-pop ' + (sd === 'p1' ? 'own' : 'foe') + ' ' + pp.kind} key={pp.key}>
				{pp.item && <ItemIcon item={pp.item} />}<span><small>{pp.who}의</small><b>{pp.what}</b></span></div> : null; })}</div>
			<canvas class="anim-canvas back" ref={backRef} />
			{setup.p2.sprite2 && <img class={'trainer-spr foe second' + (trainerVis.foe ? ' in' : '')} src={SPRITE_URL(setup.p2.sprite2)} alt="" onError={trainerImgError} />}
			{setup.p2.sprite && <img class={'trainer-spr foe' + (trainerVis.foe ? ' in' : '')} src={SPRITE_URL(setup.p2.sprite)} alt="" onError={trainerImgError} />}
			{setup.partner?.sprite && <img class={'trainer-spr own partner' + (trainerVis.own ? ' in' : '')} src={SPRITE_URL(setup.partner.sprite)} alt="" onError={trainerImgError} />}
			{setup.p1.sprite && <img class={'trainer-spr own' + (trainerVis.own ? ' in' : '')} src={SPRITE_URL(setup.p1.sprite)} alt="" onError={trainerImgError} />}
			{slots.map(i => spriteSlot(scene.p2.active[i] || null, false, i))}
			{slots.map(i => spriteSlot(scene.p1.active[i] || null, true, i))}
			<canvas class="anim-canvas front" ref={frontRef} />
			<div class="fx-layer" ref={fxRef} />
			<div class="hud-cond">
				{scene.weather && WEATHER_KO[scene.weather] && <span class="chip weather">{WEATHER_KO[scene.weather]}</span>}
				{[...scene.pseudo].map(id => <span class="chip field">{PSEUDO_KO[id] || TERRAIN_KO[id] || id}</span>)}
			</div>
			<div class="panels foe">
				<div class="side-row">{teamDots(scene.p2, false)}{sideChips(scene.p2)}</div>
				{slots.map(i => infoBox(scene.p2.active[i] || null, false, i))}
			</div>
			<div class="panels own">
				{slots.map(i => infoBox(scene.p1.active[i] || null, true, i))}
				<div class="side-row">{sideChips(scene.p1)}{teamDots(scene.p1, true)}</div>
			</div>
		</div>
		<div class="bottom">
			<div class="msgbox win-dark" onClick={e => { e.stopPropagation(); skipRef.current?.(); }}>
				<p ref={msgRef}>{/급소에 맞았다/.test(message) ? <span class="msg-crit">{message}</span> : message}</p>
				{phase === 'playing' && <span class="msg-arrow">▼</span>}
			</div>
			{controls()}
		</div>
		{wide && sidePanel(true)}
		{wide && sidePanel(false)}
		{tip && !sheet && !detail && !menuOpen && !showLog && !fieldOpen && <div class="hover-tip" style={{ left: Math.min(tip.x + 16, innerWidth - 300) + 'px', top: Math.min(tip.y + 16, innerHeight - 260) + 'px' }}>{tip.body}</div>}
		{wide && <div class="side-log" ref={sideLogRef}>
			<div class="side-log-title">배틀 기록</div>
			{log.map((l, i) => <div key={i} class={l.startsWith('──') ? 'log-turn' : 'log-line'}>{l}</div>)}
		</div>}
		{emoteOpen && setup.online && <div class="emote-pick" onClick={e => e.stopPropagation()}>
			{EMOTES.map((t, i) => <button class="btn small" disabled={Date.now() - emoteAt.current < 2000} onClick={() => { emoteAt.current = Date.now(); setup.online!.sendEmote(i); setEmoteOpen(false); }}>{t}</button>)}
		</div>}
		{menuOpen && <Modal title="메뉴" onClose={() => setMenuOpen(false)}>
			<div class="battle-menu">
				<button class="btn big" onClick={() => setMenuOpen(false)}>배틀로 돌아가기</button>
				<button class="btn big" onClick={() => { setMenuOpen(false); setShowLog(true); }}>배틀 기록</button>
				<button class="btn big" onClick={() => { setMenuOpen(false); setFieldOpen(true); }}>필드 상황</button>
				{!wide && <button class="btn big" onClick={() => { setMenuOpen(false); setFoeOpen(true); }}>상대 포켓몬 현황</button>}
				<button class="btn big" onClick={() => cycleSpeed()}>배속 {SPEED_LABEL[settings.speed]}</button>
				<button class="btn big" onClick={() => toggleManual()}>메시지 진행: {settings.textManual ? '수동 (화면을 눌러 넘김)' : '자동'}</button>
				{canFullscreen() && <button class="btn big" onClick={() => { setMenuOpen(false); toggleFullscreen(); }}>{fullscreen ? '전체화면 끄기' : '전체화면'}</button>}
				{phase === 'input' && <button class="btn big" onClick={() => { setMenuOpen(false); forfeit(); }}>{setup.runAway ? '도망친다' : '기권'}</button>}
				<button class="btn big danger" onClick={quitToMenu}>메인 메뉴로</button>
			</div>
		</Modal>}
		{foeOpen && !detail && <Modal title={`${setup.p2.name}의 포켓몬`} onClose={() => setFoeOpen(false)}>
			{(() => {
				// 3마리씩 2줄: 아이콘 + HP 만. 배틀에 나온 포켓몬만 밝게(누르면 자세히), 확인 안 된 포켓몬은 어둡게
				const sp2 = scene.p2, pv = setup.p2.preview;
				const cell = (m: Mon) => <button class={'foe-cell' + (m.fainted ? ' fnt' : '') + (sp2.active.includes(m) ? ' act' : '')} onClick={() => setDetail({ mon: m, own: false })} aria-label={m.nick}>
					<PokeIcon species={m.species} cls="foe-pic" />
					<HPBar hp={m.fainted ? 0 : m.hp} maxhp={m.maxhp || 1} />
				</button>;
				if (!pv || pv.length < sp2.teamSize) return <div class="foe-grid">
					{Array.from({ length: sp2.teamSize }, (_, i) => sp2.team[i] ? cell(sp2.team[i]) : <div class="foe-cell dim"><span class="ball unk" /><i class="foe-nohp" /></div>)}
				</div>;
				const baseOf = (x: string) => { const d = speciesData(toID(x), gen) as any; return toID(d?.base || x); };
				const hit: (Mon | undefined)[] = pv.map(() => undefined);
				for (const exact of [true, false]) for (const m of sp2.team) {
					if (hit.includes(m)) continue;
					const k = pv.findIndex((x, i) => !hit[i] && (exact ? toID(x.species) === toID(m.species) : baseOf(x.species) === baseOf(m.species)));
					if (k >= 0) hit[k] = m;
				}
				return <div class="foe-grid">{pv.map((x, i) => hit[i] ? cell(hit[i]!) : <div class="foe-cell dim" aria-label={speciesKo(x.species)}><PokeIcon species={x.species} cls="foe-pic" /><i class="foe-nohp" /></div>)}</div>;
			})()}
		</Modal>}
		{bagOpen !== null && setup.story?.bag && (() => {
			const s: any = sessionRef.current, items = setup.story!.bag!(), it = items.find(x => x.id === bagOpen);
			const useOn = async (i: number) => {
				if (!it || !s.useItem(i, it.fx, it.name)) { toast('지금은 쓸 수 없어요'); return; }
				setup.story!.used?.(it.id); setBagOpen(null); sfx('heal');
				// 도구를 쓰면 이번 턴의 내 행동은 지나감 (파트너는 평소대로 움직임)
				const req = s.p1Request, mine: string[] = [];
				for (let k = 0; k < (req.active?.length || 1); k++) { const mon = req.side.pokemon[k]; if (mon && !mon.condition.endsWith(' fnt') && !aiSlot(req, k)) mine.push('pass'); }
				const lines = s.choose(mergePartner(req, mine).join(', '), true);
				if (!lines) { toast('선택할 수 없습니다'); beginInput(); return; }
				setMenu('main'); await play(lines);
			};
			return <Modal title={it ? `${it.name} — 누구에게 쓸까요?` : '가방'} onClose={() => setBagOpen(it ? '' : null)}>
				<div class="battle-menu">
					{!it && !items.length && <p class="muted">쓸 수 있는 도구가 없어요. (프렌들리숍에서 상처약을 살 수 있어요)</p>}
					{!it && items.map(x => <button class="btn big" onClick={() => setBagOpen(x.id)}>{x.name} ×{x.n}<small style={{ display: 'block', fontSize: '12px', opacity: .8 }}>{x.desc}</small></button>)}
					{it && s.p1Orig.map((p: any, i: number) => p.kPartner ? null : <button class="btn big" disabled={it.fx.revive ? !p.fainted : p.fainted || (it.fx.heal ? p.hp >= p.maxhp : false)} onClick={() => useOn(i)}>
						{speciesKo(p.species.id)} Lv{p.level} · {p.fainted ? '기절' : `HP ${p.hp}/${p.maxhp}`}</button>)}
					<button class="btn big ghost" onClick={() => setBagOpen(it ? '' : null)}>{it ? '다른 도구' : '닫기'}</button>
				</div>
			</Modal>;
		})()}
		{fieldOpen && <FieldModal session={sessionRef.current!} scene={sceneRef.current} onClose={() => setFieldOpen(false)} />}
		{showLog && <Modal title="배틀 기록" onClose={() => setShowLog(false)}>
			<button class="btn small" onClick={() => { navigator.clipboard?.writeText(log.join('\n')).then(() => toast('배틀 기록을 복사했습니다'), () => toast('복사하지 못했습니다')); }}>기록 복사</button>
			{/* 최근 턴이 위로 (턴 안의 순서는 그대로) */}
			<div class="log">{(() => { const blocks: string[][] = []; for (const l of log) { if (l.startsWith('──') || !blocks.length) blocks.push([]); blocks[blocks.length - 1].push(l); } return blocks.reverse().flat(); })()
				.map((l, i) => <div key={i} class={l.startsWith('──') ? 'log-turn' : ''}>{l}</div>)}</div>
		</Modal>}
		{sheet && (() => {
			const d = liveOf(sheet.idx);
			if (!d) return null;
			const reason = !sheet.canSwitch ? (d.live.hp <= 0 ? '쓰러져서 낼 수 없다.' : reqMon?.[sheet.idx]?.active ? '지금 배틀에 나와 있다.' : activeReq?.trapped ? '도망칠 수 없어서 교체할 수 없다!' : '') : '';
			return <MonSheet set={d.set} gen={gen} live={d.live} note={reason} onClose={() => setSheet(null)} actions={phase === 'input' && (menu === 'switch' || ((wide || land) && menu === 'main')) ? [
				{ label: req?.forceSwitch ? '내보낸다' : '교체한다', disabled: !sheet.canSwitch, onClick: () => { const i = sheet.idx; setSheet(null); pushChoice(`switch ${i + 1}`); } },
				{ label: '닫기', kind: 'ghost', onClick: () => setSheet(null) },
			] : [{ label: '닫기', kind: 'ghost', onClick: () => setSheet(null) }]} />;
		})()}
		{detail && (detail.own ? (() => {
			const idx = sessionRef.current!.battle.p1.pokemon.findIndex((p: any) => p.name === detail.mon.nick);
			const d = idx >= 0 ? liveOf(idx) : null;
			return d ? <MonSheet set={d.set} gen={gen} live={d.live} onClose={() => setDetail(null)} actions={[{ label: '닫기', kind: 'ghost', onClick: () => setDetail(null) }]} /> : null;
		})() : <MonDetail mon={detail.mon} own={detail.own} gen={gen} session={sessionRef.current!} onClose={() => setDetail(null)} />)}
	</div>;
}

const RXp = (re: RegExp, id: string) => re.test(id);
/** 전용 Z기술 설명 (쇼다운 한글 데이터에 설명이 없음) */
const Z_SIG_KO: { [id: string]: string } = {
	lightthatburnsthesky: '공격과 특수공격 중 높은 쪽으로 데미지를 준다. 상대의 특성을 무시한다.',
	searingsunrazesmash: '상대의 특성을 무시하고 공격한다.', menacingmoonrazemaelstrom: '상대의 특성을 무시하고 공격한다.',
	catastropika: '피카츄 전용. 전력을 다한 전기타입 공격.', tenmillionvoltthunderbolt: '급소에 맞을 확률이 높다.',
	stokedsparksurfer: '상대를 마비 상태로 만든다.', extremeevoboost: '모든 능력이 2단계 올라간다.',
	pulverizingpancake: '괴력의 노말타입 공격.', genesissupernova: '사이코필드를 깐다.', sinisterarrowraid: '그림자 화살의 집중 공격.',
	maliciousmoonsault: '필살의 악타입 공격.', oceanicoperetta: '강력한 물타입 공격.', splinteredstormshards: '필드를 없앤다.',
	letssnuggleforever: '필살의 페어리타입 공격.', clangoroussoulblaze: '모든 능력이 1단계 올라간다.', guardianofalola: '상대 HP의 3/4 데미지.',
	soulstealing7starstrike: '7개의 별의 힘으로 공격.',
};
/** 지닌 메가스톤으로 바뀔 수 있는 모습 */
function megaFormsOf(set: PSet): string[] {
	const it = RAW.items[toID(set.item)];
	return it?.mega ? [it.mega] : [];
}

const TERRAIN_KO: { [id: string]: string } = { electricterrain: '일렉트릭필드', grassyterrain: '그래스필드', mistyterrain: '미스트필드', psychicterrain: '사이코필드' };
const SIDE_COND_KO: { [id: string]: string } = { ...SIDE_KO, auroraveil: '오로라베일', craftyshield: '트릭가드', matblock: '마룻바닥세워막기', luckychant: '행운의주술', stickyweb: '끈적끈적네트' };
/** 필드 상황: 날씨·필드·방·양쪽 설치기와 남은 턴 */
/** 필드 상황: 날씨·필드·벽은 엔진, 포켓몬 상태(랭크·혼란 등)는 화면에 보인 그대로(연출보다 앞서 보이거나 상대의 숨은 정보가 드러나지 않게) */
function FieldModal({ session, scene, onClose }: { session: Session; scene: any; onClose: () => void }) {
	const b = session.battle;
	const turns = (st: any) => st?.duration ? `${st.duration}턴 남음` : st?.id ? '지속' : '';
	// 상대가 연장 도구(뜨거운바위·젖은바위·빛의점토·그라운드코트 등)로 늘린 날씨·필드·벽: 도구가 드러나기 전까지는 보통(5턴) 기준으로 보여 줌
	const EXT: { [id: string]: string } = { sunnyday: 'heatrock', desolateland: '', raindance: 'damprock', sandstorm: 'smoothrock', hail: 'icyrock', snowscape: 'icyrock', snow: 'icyrock',
		electricterrain: 'terrainextender', grassyterrain: 'terrainextender', mistyterrain: 'terrainextender', psychicterrain: 'terrainextender', reflect: 'lightclay', lightscreen: 'lightclay', auroraveil: 'lightclay' };
	const shown = (id: string, st: any) => {
		const src = st?.source, ext = EXT[id];
		if (!st?.duration || !ext || src?.side?.id !== 'p2' || src.getItem?.()?.id !== ext) return turns(st);
		const revealed = (scene?.p2?.team || []).some((m: any) => m.nick === src.name && toID(m.item || '') === ext);
		if (revealed) return turns(st);
		const d = st.duration - 3;   // 연장 8턴 → 보통 5턴처럼
		return d > 0 ? `${d}턴 남음` : '지속';
	};
	const w = b.field.weatherState, t = b.field.terrainState;
	const pw = Object.entries(b.field.pseudoWeather || {}) as [string, any][];
	const sideInfo = (side: any, label: string) => {
		const sid: 'p1' | 'p2' = side === b.p1 ? 'p1' : 'p2';   // 화면 쪽 진영 (온라인 손님은 엔진 진영과 반대)
		const conds = Object.entries(side.sideConditions || {}) as [string, any][];
		return <div class="field-side">
			<b>{label}</b>
			{!conds.length && <span class="muted"> 없음</span>}
			{conds.map(([id, st]) => <div class="field-row"><span>{sideKo(id, SIDE_COND_KO)}{st.layers > 1 ? ` ×${st.layers}` : ''}</span><span class="muted">{shown(id, st)}</span></div>)}
			{(scene?.[sid]?.active || []).filter((m: any) => m && !m.fainted && !m.hidden).map((m: any) => {
				const own = sid === 'p1';
				// 남은 턴 수는 내 편만 (엔진에서 같은 포켓몬을 찾아서). 다이맥스 남은 턴은 상대 것도 보임(본가에서도 보이는 정보)
				const ep = side.active.find((p: any) => p && p.name === m.nick);
				const vols = [...(m.vol || [])].filter((id: string) => VOLATILE_KO[id]).map((id: string) => `${VOLATILE_KO[id]}${(own || id === 'dynamax') && ep?.volatiles?.[id]?.duration ? `(${ep.volatiles[id].duration}턴 남음)` : ''}`);
				const st = m.status && m.status !== 'fnt' ? STATUS_LABEL_KO[m.status] || m.status : '';
				const tera = m.tera ? `테라 ${typeKo(m.tera)}` : '';
				const bs = Object.entries(m.boosts || {}).filter(([, v]) => v).map(([k, v]: any) => `${STAT_SHORT[k] || STAT_KO[k] || k}${v > 0 ? '+' : ''}${v}`);
				return (vols.length || st || bs.length || tera) ? <div class="field-row"><span>{m.nick}</span><span class="muted">{[tera, st, ...bs, ...vols].filter(Boolean).join(' · ')}</span></div> : null;
			})}
		</div>;
	};
	return <Modal title={`필드 상황 · ${b.turn}턴`} onClose={onClose}>
		<div class="field-info">
			<div class="field-row"><span>날씨</span><b>{w?.id ? `${WEATHER_KO[w.id] || w.id} · ${shown(w.id, w)}` : '없음'}</b></div>
			<div class="field-row"><span>필드</span><b>{t?.id ? `${TERRAIN_KO[t.id] || t.id} · ${shown(t.id, t)}` : '없음'}</b></div>
			{pw.map(([id, st]) => <div class="field-row"><span>{PSEUDO_KO[id] || TERRAIN_KO[id] || id}</span><b>{turns(st)}</b></div>)}
			{sideInfo(b.p1, '우리 편')}
			{sideInfo(b.p2, '상대 편')}
		</div>
	</Modal>;
}
const STATUS_LABEL_KO: { [s: string]: string } = { brn: '화상', par: '마비', slp: '잠듦', frz: '얼음', psn: '독', tox: '맹독' };

function josaSubject(word: string) {
	const ch = word.charCodeAt(word.length - 1);
	if (ch >= 0xAC00 && ch <= 0xD7A3) return (ch - 0xAC00) % 28 ? '이' : '가';
	return '가';
}

function josaWith(word: string) {
	const ch = word.charCodeAt(word.length - 1);
	if (ch >= 0xAC00 && ch <= 0xD7A3) return (ch - 0xAC00) % 28 ? '과' : '와';
	return '와';
}

function josaTopic(word: string) {
	const ch = word.charCodeAt(word.length - 1);
	if (ch >= 0xAC00 && ch <= 0xD7A3) return (ch - 0xAC00) % 28 ? '은' : '는';
	return '는';
}

function MonDetail({ mon, own, gen, session, onClose }: { mon: Mon; own: boolean; gen: Gen; session: Session; onClose: () => void }) {
	const sd = speciesData(toID(mon.transformed || mon.species), gen);
	const simMon = session.battle[own ? 'p1' : 'p2'].pokemon.find((p: any) => p.name === mon.nick);
	const boosts = Object.entries(mon.boosts).filter(([, v]) => v);
	return <Modal title={`${mon.nick} Lv${mon.level}`} onClose={onClose}>
		<div class="detail">
			<div class="detail-head">
				<Sprite species={mon.transformed || mon.species} gen={gen} size={96} shiny={mon.shiny} />
				<div>
					<div class="types">{sd?.t.map(t => <TypeBadge type={t} />)}</div>
					<div>{speciesKo(mon.species)} {mon.gender === 'M' ? '♂' : mon.gender === 'F' ? '♀' : ''}</div>
					<div>HP {own ? `${mon.hp}/${mon.maxhp}` : `${mon.maxhp ? Math.ceil(mon.hp / mon.maxhp * 100) : 0}%`} <StatusBadge status={mon.status} /></div>
				</div>
			</div>
			{boosts.length > 0 && <p>능력 변화: {boosts.map(([k, v]) => `${STAT_KO[k]} ${v > 0 ? '+' : ''}${v}`).join(', ')}</p>}
			{!own && <>
				<p><b>특성</b> {mon.ability ? <>{abilityKo(mon.ability)} <small class="muted">{abilityDesc(mon.ability)}</small></> :
					<span class="muted">미확인 <small>(후보: {(sd?.ab || []).map(abilityKo).join(' / ')})</small></span>}</p>
				<p><b>도구</b> {mon.item === '' && mon.itemSeen ? '없음' : mon.item ? <>{itemKo(mon.item)} <small class="muted">{itemDesc(mon.item)}</small></> : <span class="muted">미확인</span>}</p>
			</>}
			{own && simMon ? <>
				<p><b>특성</b> {abilityKo(simMon.baseAbility)} <small class="muted">{abilityDesc(simMon.baseAbility)}</small></p>
				<p><b>도구</b> {simMon.item ? itemKo(simMon.item) : '없음'} <small class="muted">{simMon.item ? itemDesc(simMon.item) : ''}</small></p>
				<p><b>성격</b> {natureKo(simMon.set.nature || 'serious')}</p>
				<table class="stat-table"><tbody>
					{(['atk', 'def', 'spa', 'spd', 'spe'] as const).map(k => <tr><th>{STAT_KO[k]}</th><td>{simMon.storedStats[k]}</td></tr>)}
				</tbody></table>
				<ul class="move-list">{simMon.moveSlots.map((m: any) => <li>{moveKo(m.id === 'hiddenpower' ? 'hiddenpower' + (simMon.hpType || '').toLowerCase() : m.id)} <small>{m.pp}/{m.maxpp}</small></li>)}</ul>
			</> : <>
				{sd && <p class="muted">종족값 {sd.bs.join(' / ')}</p>}
				{sd && (() => {
					const b = session.battle;
					const types = mon.tera ? [mon.tera] : sd.t;
					const eff = (t: string) => { try { return typeEffOf(b, t, types); } catch { return 1; } };
					const all = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
					const weak = all.filter(t => eff(t) >= 2), resist = all.filter(t => eff(t) < 1);
					return <>
						<p><b>약점</b> {weak.length ? weak.map(t => <TypeBadge type={t} small />) : '없음'}</p>
						<p><b>반감·무효</b> {resist.length ? resist.map(t => <TypeBadge type={t} small />) : '없음'}</p>
					</>;
				})()}
				{mon.seen.length > 0 && <p><b>사용한 기술</b> {mon.seen.map(m => moveKo(m)).join(', ')}</p>}
				{sd && (() => {
					// 상대 스피드 실수치 범위 (무보정 0노력 ~ 보정 252노력) 와 내 활성 포켓몬 비교
					const base = sd.bs[5], L = mon.level;
					const lo = Math.floor((Math.floor((2 * base) * L / 100) + 5) * 0.9), hi = Math.floor((Math.floor((2 * base + 31 + 63) * L / 100) + 5) * 1.1);
					const mine = session.battle.p1.active.filter((p: any) => p && !p.fainted);
					return <p><b>스피드</b> {lo}~{hi} <small class="muted">(랭크 제외)</small>
						{mine.map((p: any) => { const v = p.storedStats.spe; return <small class="block">{p.name} {v}: {v > hi ? '항상 먼저' : v < lo ? '항상 나중' : '능력 포인트에 따라 다름'}</small>; })}</p>;
				})()}
				{mon.ability && <p><b>특성</b> {abilityKo(mon.ability)}</p>}
				{mon.item !== undefined && <p><b>도구</b> {mon.item ? itemKo(mon.item) : '없음'}</p>}
				{sd && <p class="muted">가능한 특성: {sd.ab.map(a => abilityKo(a)).join(', ')}</p>}
			</>}
		</div>
	</Modal>;
}
void Fragment;

/** 온라인 대전 시계: 남은 대전 시간 · 내 시간 · 상대 시간, 고르는 중이면 이번 선택 남은 초 (0 이 되면 onTimeout) */
function OnlineClock({ rs, onTimeout }: { rs: RemoteSession; onTimeout: () => void }) {
	const [, tick] = useState(0);
	useEffect(() => { const t = setInterval(() => tick(x => x + 1), 250); return () => clearInterval(t); }, []);
	const t = rs.timers();
	useEffect(() => { if (t.turn !== null && t.turn <= 0) onTimeout(); });
	const mmss = (ms: number) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
	return <>
		<span class={'badge oclock' + (t.game < 60000 ? ' low' : '')} title="남은 대전 시간 · 내 시간 · 상대 시간">⏱{mmss(t.game)} · 나 {mmss(t.mine)} · 상대 {mmss(t.opp)}</span>
		{t.turn !== null && <span class={'badge oturn' + (t.turn <= 10000 ? ' low' : '')}>선택 {Math.ceil(t.turn / 1000)}</span>}
	</>;
}
