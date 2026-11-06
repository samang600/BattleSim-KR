/** 게임 모드 진행 (배틀타워 · 배틀팩토리 · PWT · 네임드 트레이너 · 프리 배틀) */
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { ask, abortMode, gen5Icon, confirmBox, ArrowPicker } from './ui/core';
import { BattleView, type BattleSetup, type BattleResult } from './ui/battle';
import { PickScreen, InfoScreen, SwapScreen, ChoiceScreen, BracketView } from './ui/screens';
import { randomTeam, randomSetFor, cloneSet, dedupeItems, rng, factoryTeam, assignGimmicks, fitSetToMega, FACTORY_TIERS, type PSet } from './sets';
import { NAMED, CUPS, REGIONS, regionLabel, ROLE_KO, randomTrainer, namedById, namedSprite, namedLines, namedTitle, type NamedTrainer } from './trainers';
import { SPRITE_URL, trainerImgError } from './trainer-lines';
import { loadTeams, loadSettings, saveSettings, load, save, remove, updateRecords, loadRecords, type SavedTeam } from './store';
import { BGM_CHOICES, playMusic, stopMusic } from './sound';
import { ruleById } from './rules';
import { rosterForRule } from './legends';
import { aiPickEntry } from './smogon';
import { rankerTeam, rankerCount } from './pokedb';
import { speciesKo, spriteId, megaStonesFor, moveKo, typeKo, speciesData, toID, ALL_TYPES, type Gen } from './data';

type Fmt = 'singles' | 'doubles' | 'singles6' | 'doubles64' | 'doubles6' | 'multi';
const isDoubles = (f: Fmt) => f === 'doubles' || f === 'doubles64' || f === 'doubles6' || f === 'multi';
/** 팀(엔트리) 크기 / 배틀에 내보내는 수 (멀티: 나 2 + 파트너 2 vs 상대 2명 × 2) */
const teamSize = (f: Fmt) => f === 'multi' ? 2 : f === 'singles' ? 3 : f === 'doubles' ? 4 : 6;
const battleSize = (f: Fmt) => f === 'singles' ? 3 : f === 'doubles' ? 4 : f === 'doubles64' ? 4 : f === 'multi' ? 4 : 6;
const fmtLabel = (f: Fmt) => ({ singles: '싱글 3vs3', doubles: '더블 4vs4', singles6: '싱글 6vs6', doubles64: '더블 6→4', doubles6: '더블 6vs6', multi: '멀티 2+2' } as any)[f];
const BACK = Symbol('back');

/** 모드마다 고르는 추가 옵션 (체크박스) */
export interface BattleOpts { cheat: boolean; level100: boolean; inverse: boolean; mono?: boolean; /** 타워·팩토리 난이도 (없으면 보통) */ diff?: Diff }
export type Diff = 'easy' | 'normal' | 'hard';
const DIFF_LABEL: { [k in Diff]: string } = { easy: '쉬움', normal: '보통', hard: '어려움' };
/** 난이도만큼 세트(7연승)를 당기거나 미룸: 쉬움 -2세트, 어려움 +3세트 */
const diffShift = (o: BattleOpts) => o.diff === 'easy' ? -2 : o.diff === 'hard' ? 3 : 0;
type OptKey = Exclude<keyof BattleOpts, 'diff'>;
const defaultOpts = (): BattleOpts => ({ cheat: false, level100: false, inverse: false, mono: false });
const lvl = (o: BattleOpts) => o.level100 ? 100 : 50;
/** 치트·거꾸로 배틀은 전적·연승에 반영하지 않음 */
const noRec = (o: BattleOpts) => o.cheat || o.inverse;
const optsTag = (o: BattleOpts) => (o.cheat ? '-cheat' : '') + (o.level100 ? '-100' : '') + (o.inverse ? '-inv' : '') + (o.mono ? '-mono' : '') + (o.diff && o.diff !== 'normal' ? '-' + o.diff : '');
/** 전적(최고 연승) 이름표: 난이도마다 따로 */
const diffTag = (o: BattleOpts) => o.diff && o.diff !== 'normal' ? '-' + o.diff : '';
const optsLabel = (o: BattleOpts) => [o.diff && o.diff !== 'normal' && `난이도 ${DIFF_LABEL[o.diff]}`, o.cheat && '🃏 치트', o.level100 && '레벨 100', o.inverse && '🔄 거꾸로 배틀', o.mono && '🎨 타입 구애 도전'].filter(Boolean).join(' · ');
/** 안내 화면에 넣을 옵션 줄 (없으면 빈 배열) */
const optsLines = (o: BattleOpts) => optsLabel(o) ? [`※ ${optsLabel(o)}${noRec(o) ? ' — 전적·연승에 반영되지 않습니다' : ''}`] : [];
const OPT_INFO: { [k in OptKey]: { label: string; desc: string } } = {
	cheat: { label: '🃏 치트 팀 허용', desc: '치트 팀(기술·특성·능력 포인트 제한 없음)을 고를 수 있어요. 전적·연승에 반영되지 않습니다.' },
	level100: { label: '레벨 100', desc: '나와 상대 모두 레벨 100으로 싸웁니다.' },
	inverse: { label: '🔄 거꾸로 배틀', desc: '타입 상성이 반대로: 약점은 반감, 반감·무효는 2배. 전적·연승에 반영되지 않습니다.' },
	mono: { label: '🎨 타입 구애 도전', desc: '특별 상대(네임드·타이쿤·헤드)를 뺀 모든 상대가 한 타입으로만 짠 팀(타입 구애팟)으로 나옵니다.' },
};
function OptsBox({ opts, show, diff }: { opts: BattleOpts; show: OptKey[]; diff?: boolean }) {
	const [, force] = useState(0);
	return <div class="opts-box">
		{diff && <div class="set-row"><span>난이도</span><div class="seg">{(['easy', 'normal', 'hard'] as Diff[]).map(d =>
			<button class={(opts.diff || 'normal') === d ? 'on' : ''} onClick={() => { opts.diff = d; force(x => x + 1); }}>{DIFF_LABEL[d]}</button>)}</div></div>}
		{diff && <p class="muted small">{(opts.diff || 'normal') === 'easy' ? '쉬움: 일반 포켓몬 게임의 배틀시설 정도 난이도입니다.'
			: opts.diff === 'hard' ? '어려움: 처음부터 강한 상대가 나옵니다.' : '보통: 쉬움보다 강하고, 연승할수록 빠르게 강해집니다.'} 난이도마다 기록과 도전이 따로 저장됩니다.</p>}
		{show.map(k => <label class="check opt">
			<input type="checkbox" checked={!!opts[k]} onChange={() => { opts[k] = !opts[k]; force(x => x + 1); }} />
			<span><b>{OPT_INFO[k].label}</b><small>{OPT_INFO[k].desc}</small></span>
		</label>)}
	</div>;
}
const ALL_OPTS: OptKey[] = ['cheat', 'level100', 'inverse'];

/** '도전 그만두기'를 누르면 정말 끝낼지 한 번 더 묻는다 (취소하면 같은 화면으로) */
async function confirmQuit<T>(show: () => Promise<T>, quitValue: T, msg: string): Promise<T> {
	while (true) {
		const v = await show();
		if (v !== quitValue || await confirmBox('도전 그만두기', msg, '그만두기', '계속 도전')) return v;
	}
}

/** 배틀 배경 (설정 battleBg) — 'auto' 는 모드마다 정해진 배경 */
export const ARENA_CHOICES: [string, string][] = [['auto', '상황에 맞게'], ['random', '무작위'], ['field', '들판'], ['gym', '체육관'], ['cave', '동굴'], ['beach', '해변'],
	['snow', '설원'], ['volcano', '화산'], ['tower', '배틀타워'], ['factory', '배틀팩토리'], ['pwt', 'PWT 경기장'], ['champion', '챔피언 리그']];
/** 배틀 전 화면의 음악·배경 고르기 (◀ ▶ 로 넘김). 음악은 곡 이름이 바뀔 때마다 바로 들려주고, 배경은 장소를 미리 보여 줌 */
function BgmRow() {
	const [v, setV] = useState(loadSettings().battleBgm || 'random');
	const [bg, setBg] = useState(loadSettings().battleBg || 'auto');
	return <div class="prep-pickers">
		<ArrowPicker label="배틀 음악" icon="♪" items={BGM_CHOICES} value={v} onChange={k => {
			saveSettings({ ...loadSettings(), battleBgm: k }); setV(k);
			stopMusic();
			if (k === 'none') return;
			setTimeout(() => playMusic(k === 'random' || k === 'shuffle' ? 'lobby' : k), 0);
		}} />
		<ArrowPicker label="배틀 배경" items={ARENA_CHOICES} value={bg} onChange={k => { saveSettings({ ...loadSettings(), battleBg: k }); setBg(k); }}
			preview={k => <div class={'arena-thumb bg-' + (k === 'auto' || k === 'random' ? 'field' : k) + (k === 'auto' || k === 'random' ? ' unknown' : '')}>
				<div class="arena-bg" />{(k === 'auto' || k === 'random') && <span class="thumb-q">{k === 'auto' ? '모드마다 정해진 장소' : '배틀마다 무작위'}</span>}
			</div>} />
	</div>;
}

function battle(setup: BattleSetup): Promise<BattleResult> {
	return ask<BattleResult>(resolve => <BattleView key={Math.random()} setup={setup} onEnd={r => { if (r.quit) abortMode(); resolve(r); }} />);
}
function playerName() { return loadSettings().playerName || '플레이어'; }
function playerSprite() { return loadSettings().playerSprite || 'lucas'; }
function withLevel(team: PSet[], level: number) { return team.map(s => ({ ...cloneSet(s), level })); }

async function chooseFormat(title: string, desc?: string, extended = false, opts?: BattleOpts, show: OptKey[] = ALL_OPTS, multi = false, diff = false): Promise<Fmt | typeof BACK> {
	return ask<Fmt | typeof BACK>(r => <ChoiceScreen title={title} onBack={() => r(BACK)}
		intro={desc ? <p class="hint">{desc}</p> : undefined} footer={opts && <><OptsBox opts={opts} show={show} diff={diff} /><BgmRow /></>}
		options={[
			{ value: 'singles' as Fmt, label: extended ? '싱글 3vs3' : '싱글배틀', desc: '1대1로 싸웁니다 · 3마리', icon: '①' },
			{ value: 'doubles' as Fmt, label: extended ? '더블 4vs4' : '더블배틀', desc: '2마리씩 동시에 싸웁니다 · 4마리', icon: '②' },
			...(extended ? [
				{ value: 'singles6' as Fmt, label: '싱글 6vs6', desc: '6마리 전원으로 풀배틀', icon: '⑥' },
				{ value: 'doubles6' as Fmt, label: '더블 6vs6', desc: '6마리 전원으로 더블 풀배틀', icon: '⑥' },
			] : []),
			...(multi ? [{ value: 'multi' as Fmt, label: '멀티배틀', desc: '파트너 트레이너와 2마리씩 · 상대 2명과 더블배틀 (파트너 포켓몬은 파트너가 지시)', icon: '👥' }] : []),
		]} onPick={r} />);
}

/** 내 팀 고르기: 저장된 팀 또는 렌탈. 일반 팀·렌탈은 level 로 맞추고, 치트 팀(cheat 허용 시)은 만든 레벨 그대로 */
async function chooseTeam(gen: Gen, title: string, allowRental = true, cheat = false, level = 50): Promise<PSet[] | typeof BACK> {
	const lastId = load<string>('lastTeam', '');
	// 치트 팀은 '치트 팀 허용'을 켰을 때만
	const teams = loadTeams().filter(t => (cheat || !t.cheat) && t.sets.length >= (t.cheat ? 1 : 3)).sort((a, b) => (b.id === lastId ? 1 : 0) - (a.id === lastId ? 1 : 0));
	const opts: { value: SavedTeam | 'rental'; label: string; desc?: string; icon?: any; badge?: string }[] = teams.map(t => ({
		value: t, label: t.name, desc: t.sets.map(s => speciesKo(s.species)).join(' · '), badge: t.cheat ? '🃏 치트' : t.id === lastId ? '최근 사용' : undefined,
		icon: <span class="mini"><img class="sprite" src={gen5Icon(spriteId(t.sets[0].species))} /></span>,
	}));
	if (allowRental) opts.push({ value: 'rental', label: '추천 렌탈 팀', desc: '무작위로 6마리를 빌립니다', icon: '🎲' });
	const v = await ask<SavedTeam | 'rental' | typeof BACK>(r => <ChoiceScreen title={title} onBack={() => r(BACK)}
		intro={!teams.length ? <p class="hint">{cheat ? '저장된 팀이 없습니다. 메인 메뉴 → 팀 편집에서 만들 수 있어요.' : '저장된 팀(3마리 이상)이 없습니다. 메인 메뉴 → 팀 편집에서 만들 수 있어요. (치트 팀은 형식 선택 화면에서 ‘치트 팀 허용’을 켜면 쓸 수 있어요)'}</p> : undefined}
		options={opts} onPick={r} />);
	if (v === BACK) return BACK;
	if (v === 'rental') return withLevel(randomTeam({ gen, size: 6, minBst: 480 }), level);
	save('lastTeam', v.id);
	return v.cheat ? v.sets.map(cloneSet) : withLevel(v.sets, level);
}

/** 타입 구애 도전: 상대 팀의 타입 (트레이너 계열에 어울리는 타입이 있으면 그중에서) */
const MONO_TYPES = ALL_TYPES.filter(t => t !== 'Stellar');
const monoTypeFor = (pref?: string[]) => pref?.length ? rng.pick(pref) : rng.pick(MONO_TYPES);
const monoTag = (t?: string) => t ? ` (${typeKo(t)}타입 구애)` : '';

/** 멀티배틀 파트너 고르기: 주인공·라이벌·챔피언 중 6명 + 무작위 */
async function choosePartner(title: string): Promise<NamedTrainer | typeof BACK> {
	const all = NAMED.filter(t => ['hero', 'rival', 'champion'].includes(t.role));
	const pool = rng.shuffle(all).slice(0, 6);
	const v = await ask<NamedTrainer | 'random' | typeof BACK>(r => <ChoiceScreen title={title} onBack={() => r(BACK)}
		intro={<p class="hint">함께 싸울 파트너를 고르세요. 파트너는 자기 포켓몬 2마리를 직접 지시합니다.</p>}
		options={[...pool.map(t => ({ value: t, label: t.name, desc: t.title,
			icon: <img src={SPRITE_URL(namedSprite(t))} onError={trainerImgError} style="width:40px;height:40px;object-fit:contain;image-rendering:pixelated" alt="" /> })),
			{ value: 'random' as const, label: '무작위 파트너', desc: '누가 올지는 만나 보면 알아요', icon: '🎲' }]} onPick={r} />);
	return v === 'random' ? rng.pick(all) : v;
}
const whoOf = (o: { title?: string; name: string }) => `${o.title ? o.title + ' ' : ''}${o.name}`;
/** 멀티배틀 p1 팀: 나·파트너가 한 마리씩 선봉에 서도록 번갈아 놓음 (나, 파트너, 나, 파트너) */
function multiTeam(mine: PSet[], theirs: PSet[]) {
	const team: PSet[] = [], flags: boolean[] = [];
	for (let i = 0; i < Math.max(mine.length, theirs.length); i++) {
		if (mine[i]) { team.push(mine[i]); flags.push(false); }
		if (theirs[i]) { team.push(theirs[i]); flags.push(true); }
	}
	return { team, flags };
}

// ───────────── 배틀타워 ─────────────
const TOWER_KEY = (fmt: Fmt, o: BattleOpts) => `tower-${fmt}${optsTag(o)}`;
interface TowerState { fmt: Fmt; team: PSet[]; streak: number; opts?: BattleOpts; partner?: { id: string; team: PSet[] }; /** 다음 승부 상대 (쉬었다 와도 같게) */ next?: { streak: number; opp: any } }

function towerOpponent(streak: number, fmt: Fmt, playerTeam: PSet[] = [], mono = false, diff: Diff = 'normal') {
	const realTier = Math.floor(streak / 7);
	// 난이도: 쉬움은 두 세트 늦게(처음 두 세트는 진화 전·중간 진화), 어려움은 세 세트 앞서서 시작
	const tier = Math.max(0, realTier + (diff === 'easy' ? -2 : diff === 'hard' ? 3 : 0));
	const early = diff === 'easy' && realTier < 2;
	const n = teamSize(fmt);
	const battleNo = streak + 1;
	// 타이쿤: 21번째, 49번째
	if (fmt !== 'multi' && (battleNo === 21 || battleNo === 49)) {
		const gold = battleNo === 49;
		const species = gold ? ['heatran', 'cresselia', 'regigigas', 'metagross', 'garchomp', 'lucario'] : ['rhyperior', 'milotic', 'dragonite', 'togekiss', 'gliscor', 'tyranitar'];
		const team = species.slice(0, n).map(id => randomSetFor(id, 9, 50, isDoubles(fmt), 1));
		return { name: '타워 타이쿤', title: '', sprite: 'palmer', lines: { ace: '이 한 마리에 모든 걸 건다!', lose: '훌륭하다! 너야말로 진정한 강자다!', win: '정점의 벽은 높다. 다시 오너라!' }, team: dedupeItems(assignGimmicks(team, { mega: 1, z: 1 })), skill: 0.97, boss: gold ? '금' : '은',
			line: gold ? '여기까지 온 너에게 전력으로 답하겠다!' : '배틀타워의 정점, 타워 타이쿤이다. 승부다!' };
	}
	// 7의 배수 번째(세트 마지막): 네임드 트레이너가 등장 (세트가 오를수록 관장 → 사천왕 → 챔피언)
	if (battleNo % 7 === 0) {
		// 7연승마다: 초반엔 관장·간부, 중반엔 사천왕·라이벌, 후반엔 챔피언·보스·주인공
		const roles = tier <= 1 ? ['leader', 'admin'] : tier <= 3 ? ['elite', 'rival'] : ['champion', 'boss', 'hero'];
		const t = rng.pick(NAMED.filter(x => roles.includes(x.role)));
		const team = namedTeam(t, n);
		return { name: t.name, title: namedTitle(t), team, skill: 0.9 + tier * 0.02, boss: '', line: t.line, sprite: namedSprite(t), lines: namedLines(t), special: true, music: namedMusic(t) };
	}
	// 올라갈수록 강해짐: 종족값 범위 ↑, 능력 포인트 투자 ↑(세트 1: 55% → 세트 5+: 100%), AI 실력 ↑, 세트 4부터 준전설, 세트 2부터 기믹 소지율 ↑
	const ranges = [[400, 500], [450, 530], [480, 560], [500, 600], [520, 640], [540, 700], [560, 720]];
	const [minBst, maxBst] = ranges[Math.min(tier, ranges.length - 1)];
	const tr = randomTrainer();
	const ivs = Math.min(31, 17 + tier * 4); // 31이면 능력 포인트 전부, 그 아래면 비율만큼 줄어듦
	const quality = Math.min(1, 0.2 + tier * 0.15); // 7연승마다 Smogon 상위 세트·동료 조합에 가까워짐
	// 타입 구애 도전: 한 타입으로만 짠 팀 (그 타입에 종족값 범위 안 포켓몬이 모자라면 범위를 넓힘)
	const mt = mono ? monoTypeFor(tr.types) : undefined;
	// 쉬움 초반: 세트 1 은 진화 전·중간 진화만(종족값 250~420), 세트 2 는 중간 진화 위주(330~480)
	const nfe = early ? { stage: 'nfe' as const, minBst: realTier === 0 ? 250 : 330, maxBst: realTier === 0 ? 420 : 480 } : null;
	let team = nfe ? randomTeam({ gen: 9, size: n, ...nfe, ivs: realTier === 0 ? 8 : 13, doubles: isDoubles(fmt), types: mt ? [mt] : Math.random() < 0.6 ? tr.types : undefined, gimmicks: false, quality: 0.1 })
		: randomTeam({ gen: 9, size: n, minBst, maxBst, allowSubLegend: tier >= 3, ivs, doubles: isDoubles(fmt), types: mt ? [mt] : Math.random() < 0.6 ? tr.types : undefined, gimmicks: false, quality });
	if (nfe && team.length < n) team = randomTeam({ gen: 9, size: n, ...nfe, ivs: 10, doubles: isDoubles(fmt), gimmicks: false, quality: 0.1 });
	if (team.length < n) team = randomTeam({ gen: 9, size: n, ...(mt ? { minBst: minBst - 80 } : { minBst, maxBst }), allowSubLegend: tier >= 3, ivs, doubles: isDoubles(fmt), types: mt ? [mt] : undefined, gimmicks: false, quality });
	team = dedupeItems(assignGimmicks(team, early ? { mega: 0, z: 0 } : { mega: Math.min(1, 0.3 + tier * 0.15), z: Math.min(0.8, 0.2 + tier * 0.12) }));
	const skill = early ? 0.45 + realTier * 0.05 : Math.min(0.97, 0.55 + tier * 0.08);
	// 5세트(28연승)부터 가끔 실제 랭크배틀 상위 트레이너의 팀(PokéDB)이 나옴
	if (!mt && tier >= 4 && Math.random() < (tier >= 6 ? 0.5 : 0.3)) {
		const rk = rankerTeam(isDoubles(fmt), 50, Math.min(1, 0.6 + tier * 0.05));
		if (rk) {
			const t2 = n < 6 ? aiPickEntry(rk.team, playerTeam, n, isDoubles(fmt), skill) : rk.team;
			return { name: tr.name, title: '랭커', sprite: tr.sprite, lines: tr.lines, team: t2, skill, boss: '', line: tr.lines.intro, ranker: `시즌 ${rk.season} 상위 구축 · 레이트 ${rk.rating}` };
		}
	}
	return { name: tr.name, title: tr.className, sprite: tr.sprite, lines: tr.lines, team, skill, boss: '', line: tr.lines.intro, mono: mt };
}

/** 멀티배틀 상대: 트레이너 두 명 (각 2마리) */
function towerPair(streak: number, mono: boolean, diff: Diff = 'normal') {
	const a: any = towerOpponent(streak, 'multi', [], mono, diff);
	let b: any = towerOpponent(streak, 'multi', [], mono, diff);
	for (let i = 0; i < 5 && b.name === a.name; i++) b = towerOpponent(streak, 'multi', [], mono, diff);
	const monoTypes = [a.mono, b.mono].filter(Boolean);
	return { ...a, name: `${whoOf(a)} & ${whoOf(b)}`, title: '', sprite2: b.sprite, team: [...a.team, ...b.team], skill: Math.max(a.skill, b.skill), special: a.special || b.special,
		music: a.music || b.music, ranker: undefined, mono: monoTypes.length ? monoTypes.join('/') : undefined, monoLabel: monoTypes.length ? ` (${monoTypes.map(t => typeKo(t)).join('·')}타입 구애)` : '' };
}

export async function runTower() {
	const opts = defaultOpts();
	const fmt = await chooseFormat('배틀타워', '레벨 50 · 7연승마다 1세트 · 기믹은 설정의 배틀 규칙을 따름', true, opts, [...ALL_OPTS, 'mono'], true, true);
	if (fmt === BACK) return;
	let state = load<TowerState | null>(TOWER_KEY(fmt, opts), null);
	if (state) {
		const resume = await ask<'resume' | 'new' | typeof BACK>(r => <InfoScreen title="배틀타워" heading={`${state!.streak}연승 중인 도전이 있습니다`}
			sprites={state!.team.map(s => s.species)} sets={state!.team} gen={9}
			lines={['이어서 도전할까요? 새로 시작하면 지금 연승 기록은 사라집니다.']}
			actions={[{ label: '이어서 도전', onClick: () => r('resume') }, { label: '새로 시작', kind: 'ghost', onClick: () => r('new') },
				{ label: '돌아가기', kind: 'ghost', onClick: () => r(BACK) }]} />);
		if (resume === BACK) return;
		if (resume === 'new') state = null;
	}
	if (!state) {
		const team = await chooseTeam(9, '배틀타워 · 팀 선택', true, opts.cheat, lvl(opts));
		if (team === BACK) return;
		const n = teamSize(fmt);
		const picked = team.length > n || n === 6 ? await ask<PSet[] | typeof BACK>(r => <PickScreen title="참가 포켓몬" team={team} gen={9} count={Math.min(n, team.length)}
			onBack={() => r(BACK)} onDone={r} />) : team;
		if (picked === BACK) return;
		let partner: TowerState['partner'];
		if (fmt === 'multi') {
			const pt = await choosePartner('배틀타워 · 멀티 파트너');
			if (pt === BACK) return;
			partner = { id: pt.id, team: withLevel(namedTeam(pt, 2), lvl(opts)) };
		}
		state = { fmt, team: dedupeItems(picked.map(cloneSet)), streak: 0, opts, partner };
		save(TOWER_KEY(fmt, opts), state);
	}
	const key = `tower-${fmt}${diffTag(opts)}`;
	while (true) {
		// 같은 승부의 상대는 저장해 둠: 쉬었다 와도(앱을 껐다 켜도) 같은 트레이너·팀
		const opp: any = state.next?.streak === state.streak ? state.next.opp
			: fmt === 'multi' ? towerPair(state.streak, !!opts.mono, opts.diff) : towerOpponent(state.streak, fmt, state.team, !!opts.mono, opts.diff);
		if (state.next?.streak !== state.streak) { state.next = { streak: state.streak, opp }; save(TOWER_KEY(fmt, opts), state); }
		const partnerT = state.partner ? namedById(state.partner.id) : null;
		opp.team = withLevel(opp.team, lvl(opts));
		const go = await confirmQuit(() => ask<'go' | 'rest' | 'quit'>(r => <InfoScreen title={`배틀타워 · ${fmtLabel(fmt)}`}
			banner={`${state!.streak + 1}번째 승부`} children={<BgmRow />}
			heading={opp.boss ? `⚠ 타워 타이쿤 등장! (${opp.boss}의 심볼)` : (opp as any).special ? `★ 특별 트레이너! ${whoOf(opp)}${josa(opp.name)} 나타났다!` : `${whoOf(opp)}${josa(opp.name)} 승부를 걸어왔다!${opp.monoLabel ?? monoTag(opp.mono)}`} trainer={opp.sprite}
			lines={[`현재 ${state!.streak}연승 · 세트 ${Math.floor(state!.streak / 7) + 1} - ${state!.streak % 7 + 1}번째`, ...(partnerT ? [`파트너: ${partnerT.title} ${partnerT.name}`] : []), ...(opp.ranker ? [`★ 상위 랭커 (${opp.ranker})`] : []), ...optsLines(opts)]}
			sprites={state!.team.map(s => s.species)} sets={state!.team} gen={9}
			actions={[{ label: '승부한다', onClick: () => r('go') }, { label: '쉬기 (저장 후 나가기)', kind: 'ghost', onClick: () => r('rest') },
				{ label: '도전 그만두기', kind: 'danger', onClick: () => r('quit') }]} />), 'quit', `지금까지의 ${state!.streak}연승 도전이 끝나고 처음부터 다시 시작해야 합니다.\n정말 그만둘까요? (‘쉬기’를 고르면 저장하고 나중에 이어서 할 수 있어요)`);
		if (go === 'rest') { save(TOWER_KEY(fmt, opts), state); return; }
		if (go === 'quit') { remove(TOWER_KEY(fmt, opts)); return; }
		// 배틀타워 규칙(Pt/HGSS): 도전 시작 때 고른 포켓몬·순서로 7연전, 상대 엔트리는 볼 수 없음. 더블 6→4 는 배틀마다 4마리를 고름
		const myEntry = fmt === 'doubles64' ? await ask<PSet[]>(r => <PickScreen title="참가 포켓몬 4마리" team={state!.team} gen={9} count={4}
			hint="6마리 중 이번 배틀에 낼 4마리를 순서대로 고르세요. (상대 엔트리는 볼 수 없습니다)" onDone={r} />) : state.team;
		const oppEntry = fmt === 'doubles64' ? aiPickEntry(opp.team, state.team, 4, true, opp.skill, true) : opp.team;
		const res = await battle({
			gen: 9, doubles: isDoubles(fmt), aiSkill: opp.skill, bg: opp.boss || (opp as any).special ? 'champion' : 'tower',
			label: `배틀타워 ${state.streak + 1}번째`, noRecord: noRec(opts), cheat: opts.cheat, inverse: opts.inverse, music: opp.boss ? 'boss' : (opp as any).music,
			p1: { name: playerName(), team: state.partner ? multiTeam(myEntry, state.partner.team).team : myEntry, sprite: playerSprite() }, p2: { name: opp.name, title: opp.title, team: oppEntry, line: opp.line, sprite: opp.sprite, sprite2: opp.sprite2, lines: { intro: opp.line, ...opp.lines } },
			partner: partnerT && state.partner ? { name: partnerT.name, theirs: multiTeam(myEntry, state.partner.team).flags, skill: 0.9, sprite: namedSprite(partnerT) } : undefined,
		});
		state.next = undefined;
		if (res.win) {
			state.streak++;
			const s = state.streak;
			if (!noRec(opts)) updateRecords(r => { r.current[key] = s; r.best[key] = Math.max(r.best[key] || 0, s); });
			save(TOWER_KEY(fmt, opts), state);
			if (s % 7 === 0) {
				// 7연승(세트 클리어)마다 팀을 바꿀 수 있음 — 연승은 그대로 이어짐
				const next = await ask<'keep' | 'change' | 'rest'>(r => <InfoScreen title="배틀타워" banner="🏆 세트 클리어!" heading={`${s}연승 달성!`}
					lines={['포켓몬들의 체력이 회복되었다.', '다음 세트에 들어가기 전에 팀을 바꿀 수 있습니다. (연승은 그대로 이어집니다)']}
					sprites={state.team.map(x => x.species)} sets={state.team} gen={9}
					actions={[{ label: '이 팀으로 계속', onClick: () => r('keep') }, { label: '팀 바꾸기', kind: 'yellow', onClick: () => r('change') },
						{ label: '여기서 쉬기 (저장 후 나가기)', kind: 'ghost', onClick: () => r('rest') }]} />);
				// 쉬기: 연승·팀은 이미 저장됨 → 메뉴로 (도전 포기 아님, 다음에 이어서)
				if (next === 'rest') return;
				if (next === 'change') {
					const n = teamSize(fmt);
					const team = await chooseTeam(9, '배틀타워 · 다음 세트 팀', true, opts.cheat, lvl(opts));
					if (team !== BACK) {
						const picked = team.length > n || n === 6 ? await ask<PSet[] | typeof BACK>(r => <PickScreen title="참가 포켓몬" team={team} gen={9} count={Math.min(n, team.length)}
							onBack={() => r(BACK)} onDone={r} />) : team;
						if (picked !== BACK) { state.team = dedupeItems(picked.map(cloneSet)); save(TOWER_KEY(fmt, opts), state); }
					}
				}
			}
		} else {
			const s = state.streak;
			remove(TOWER_KEY(fmt, opts));
			if (!noRec(opts)) updateRecords(r => { r.current[key] = 0; });
			await ask<void>(r => <InfoScreen title="배틀타워" heading="도전 종료" banner={`${s}연승`}
				lines={[noRec(opts) ? '(치트·거꾸로 배틀은 전적에 남지 않습니다)' : `최고 기록: ${loadRecords().best[key] || 0}연승`, '다음에는 더 멀리 가 보자!']}
				actions={[{ label: '메뉴로', onClick: () => r() }]} />);
			return;
		}
	}
}

// ───────────── 배틀팩토리 ─────────────
interface FactoryState { fmt: Fmt; level: 50 | 100; team: PSet[]; streak: number; /** 다음 승부 상대 (쉬었다 와도 같게) */ next?: { streak: number; tr: any; mt?: string; oppTeam: PSet[]; hint: string } }
const FACTORY_KEY = (fmt: Fmt, lv: number, o: BattleOpts) => `factory-${fmt}-${lv}${optsTag(o)}`;

/** 세트(7연승)마다 렌탈 등급: PU → NU → RU → UU → OU → OU+Uber 절반 → Uber 위주 */
const FACTORY_GRADE = ['PU', 'NU', 'RU', 'UU', 'OU', 'OU·Uber', 'Uber'];
const factoryGrade = (streak: number) => FACTORY_GRADE[Math.min(Math.floor(streak / 7), FACTORY_GRADE.length - 1)];
function factoryPool(streak: number, level: number, size: number, exclude?: Set<string>, type?: string) {
	// 세트가 오를수록 높은 티어의 렌탈 (타입 구애면 그 타입만, 모자라면 다른 티어·무작위로 채움)
	const grade = factoryGrade(streak);
	let team: PSet[];
	if (grade.includes('Uber')) {
		const nUber = grade === 'Uber' ? Math.ceil(size * 0.7) : Math.ceil(size / 2);
		const ub = factoryTeam('Uber', nUber, level, exclude, type);
		team = [...ub, ...factoryTeam('OU', size - ub.length, level, new Set([...(exclude || []), ...ub.map(s => toID(s.species))]), type)];
	} else team = factoryTeam(grade, size, level, exclude, type);
	void FACTORY_TIERS;
	if (type && team.length < size) {
		const have = new Set([...(exclude || []), ...team.map(s => toID(s.species))]);
		for (const t2 of ['OU', 'UU', 'RU', 'NU', 'PU']) { if (team.length >= size) break; team = [...team, ...factoryTeam(t2, size - team.length, level, have, type)]; team.forEach(s => have.add(toID(s.species))); }
	}
	return team.length >= size ? team : [...team, ...randomTeam({ gen: 9, size: size - team.length, minBst: 450, level, types: type ? [type] : undefined })];
}

export async function runFactory() {
	const opts = defaultOpts();
	const fmt = await chooseFormat('배틀팩토리', '빌린 포켓몬으로 싸우는 시설 · 이길 때마다 상대 포켓몬과 교환 가능 · 세트가 오를수록 강한 렌탈', true, opts, ['inverse', 'mono'], false, true);
	/** 난이도에 따라 렌탈·상대의 세트 수준을 당기거나 미룸 */
	const es = (s: number) => Math.max(0, s + diffShift(opts) * 7);
	if (fmt === BACK) return;
	const level = await ask<50 | 100 | typeof BACK>(r => <ChoiceScreen title="배틀팩토리 · 레벨" onBack={() => r(BACK)} options={[
		{ value: 50 as const, label: '레벨 50', desc: '모든 포켓몬 레벨 50', icon: '50' },
		{ value: 100 as const, label: '오픈 레벨', desc: '모든 포켓몬 레벨 100', icon: '100' },
	]} onPick={r} />);
	if (level === BACK) return;
	const n = teamSize(fmt);
	const key = `factory-${fmt}-${level}${diffTag(opts)}`;
	let state = load<FactoryState | null>(FACTORY_KEY(fmt, level, opts), null);
	if (state) {
		const v = await ask<'resume' | 'new'>(r => <InfoScreen title="배틀팩토리" heading={`${state!.streak}연승 중인 도전이 있습니다`}
			sprites={state!.team.map(s => s.species)} sets={state!.team} gen={9}
			actions={[{ label: '이어서 도전', onClick: () => r('resume') }, { label: '새로 시작', kind: 'ghost', onClick: () => r('new') }]} />);
		if (v === 'new') state = null;
	}
	const rentalRound = async (streak: number) => {
		const rentals = factoryPool(es(streak), level, n === 6 ? 8 : 6);
		return ask<PSet[]>(r => <PickScreen title={`렌탈 포켓몬 선택 · ${factoryGrade(es(streak))} 등급`} team={rentals} gen={9} count={n}
			hint={`빌릴 포켓몬 ${n}마리를 고르세요. 처음 고른 포켓몬이 먼저 나갑니다. (세트가 오를수록 더 강한 등급에서 빌려 줍니다)`} onDone={r} />);
	};
	if (!state) {
		const team = await rentalRound(0);
		state = { fmt, level, team, streak: 0 };
		save(FACTORY_KEY(fmt, level, opts), state);
	}
	const head = (no: number) => no === 21 || no === 49;
	/** 직원이 알려주는 상대 정보 (Pt/HGSS 방식: 0~6연승 전부 → 7~ 2마리 → 14~ 1마리+기술 → 21~ 선봉의 기술 → 28~ 주로 쓰는 타입) */
	const staffHint = (streak: number, team: PSet[]): string => {
		const names = team.map(s => speciesKo(s.species));
		if (streak < 7) return `직원: 상대의 포켓몬은 ${names.join(', ')}입니다.`;
		if (streak < 14) return `직원: 상대의 포켓몬 중 ${rng.shuffle(names).slice(0, 2).join('와(과) ')}이(가) 있습니다.`;
		if (streak < 21) { const s = rng.pick(team); return `직원: 상대에게는 ${speciesKo(s.species)}이(가) 있고, ${moveKo(rng.pick(s.moves))}을(를) 씁니다.`; }
		if (streak < 28) return `직원: 상대의 선봉 포켓몬은 ${moveKo(rng.pick(team[0].moves))}을(를) 씁니다.`;
		const count: { [t: string]: number } = {};
		for (const s of team) for (const t of speciesData(toID(s.species), 9)?.t || []) count[t] = (count[t] || 0) + 1;
		const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
		return top && top[1] >= 2 ? `직원: 상대는 주로 ${typeKo(top[0])}타입을 씁니다.` : '직원: 상대는 타입에 연연하지 않는 것 같습니다.';
	};
	while (true) {
		const no = state.streak + 1;
		const isHead = head(no);
		// 같은 승부의 상대는 저장해 둠: 쉬었다 와도 같은 트레이너·팀·직원 힌트
		const saved = state.next?.streak === state.streak ? state.next : null;
		const tr = saved ? saved.tr : randomTrainer();
		// 타입 구애 도전: 일반 상대는 한 타입 팀
		const mt = saved ? saved.mt : opts.mono && !isHead ? monoTypeFor(tr.types) : undefined;
		const oppTeam: PSet[] = saved ? saved.oppTeam : isHead ? factoryTeam(no === 49 ? 'Uber' : 'OU', n, level) : factoryPool(es(state.streak), level, n, undefined, mt);
		const hint: string = saved ? saved.hint : staffHint(state.streak, oppTeam);
		if (!saved) { state.next = { streak: state.streak, tr, mt, oppTeam, hint }; save(FACTORY_KEY(fmt, level, opts), state); }
		const skill = Math.min(0.92, 0.5 + Math.floor(es(state.streak) / 7) * 0.1);
		const opp = isHead ? { name: '팩토리 헤드', title: '', skill: 0.97, line: '지식과 운, 둘 다 시험해 보자고!', sprite: 'thorton', lines: { ace: '계산대로라면 여기서 역전이야!', lose: '내 계산이 틀렸다니… 대단한데!', win: '데이터는 거짓말을 안 하거든.' } } :
			{ name: tr.name, title: tr.className, skill, line: tr.lines.intro, sprite: tr.sprite, lines: tr.lines };
		const monoLabel = monoTag(mt);
		const go = await confirmQuit(() => ask<'go' | 'rest' | 'quit'>(r => <InfoScreen title="배틀팩토리" banner={`${no}번째 승부`} children={<BgmRow />}
			heading={isHead ? '⚠ 팩토리 헤드 등장!' : `${whoOf(opp)}${josa(opp.name)} 승부를 걸어왔다!${monoLabel}`} trainer={opp.sprite}
			lines={[`현재 ${state!.streak}연승 · 레벨 ${level === 50 ? '50' : '오픈'}`, hint, ...optsLines(opts)]}
			sprites={state!.team.map(s => s.species)} sets={state!.team} gen={9}
			actions={[{ label: '승부한다', onClick: () => r('go') }, { label: '쉬기 (저장 후 나가기)', kind: 'ghost', onClick: () => r('rest') },
				{ label: '도전 그만두기', kind: 'danger', onClick: () => r('quit') }]} />), 'quit', `지금까지의 ${state!.streak}연승 도전과 빌린 포켓몬이 사라집니다.\n정말 그만둘까요? (‘쉬기’를 고르면 저장하고 나중에 이어서 할 수 있어요)`);
		if (go === 'rest') { save(FACTORY_KEY(fmt, level, opts), state); return; }
		if (go === 'quit') { remove(FACTORY_KEY(fmt, level, opts)); return; }
		// 배틀팩토리 규칙: 빌린 순서대로 싸움 (교환으로만 바뀜), 직원 힌트만 제공. 더블 6→4 는 배틀마다 4마리를 고름
		const myEntry = fmt === 'doubles64' ? await ask<PSet[]>(r => <PickScreen title="참가 포켓몬 4마리" team={state!.team} gen={9} count={4}
			hint={`${hint} 6마리 중 이번 배틀에 낼 4마리를 순서대로 고르세요.`} onDone={r} />) : state.team;
		const oppEntry = fmt === 'doubles64' ? aiPickEntry(oppTeam, state.team, 4, true, opp.skill) : oppTeam;
		const res = await battle({
			gen: 9, doubles: isDoubles(fmt), aiSkill: opp.skill, bg: isHead ? 'champion' : 'factory', label: `배틀팩토리 ${no}번째`, noRecord: noRec(opts), inverse: opts.inverse,
			p1: { name: playerName(), team: myEntry, sprite: playerSprite() }, p2: { name: opp.name, title: opp.title, team: oppEntry, line: opp.line, sprite: opp.sprite, sprite2: opp.sprite2, lines: { intro: opp.line, ...opp.lines } },
		});
		state.next = undefined;
		if (!res.win) {
			const s = state.streak;
			remove(FACTORY_KEY(fmt, level, opts));
			if (!noRec(opts)) updateRecords(r => { r.current[key] = 0; });
			await ask<void>(r => <InfoScreen title="배틀팩토리" heading="도전 종료" banner={`${s}연승`}
				lines={[noRec(opts) ? '(거꾸로 배틀은 전적에 남지 않습니다)' : `최고 기록: ${loadRecords().best[key] || 0}연승`]} actions={[{ label: '메뉴로', onClick: () => r() }]} />);
			return;
		}
		state.streak++;
		const s = state.streak;
		if (!noRec(opts)) updateRecords(r => { r.current[key] = s; r.best[key] = Math.max(r.best[key] || 0, s); });
		if (s % 7 === 0) {
			await ask<void>(r => <InfoScreen title="배틀팩토리" banner="🏆 세트 클리어!" heading={`${s}연승 달성!`}
				lines={['빌린 포켓몬을 모두 반납하고, 새 렌탈 포켓몬을 처음부터 다시 고릅니다.', `다음 세트 렌탈 등급: ${factoryGrade(es(s))}${factoryGrade(es(s)) !== factoryGrade(es(s - 1)) ? ' (등급 상승!)' : ''}`]} actions={[{ label: '새로 빌리기', onClick: () => r() }]} />);
			state.team = await rentalRound(s);
		} else {
			const swap = await ask<{ give: number; take: number } | null>(r => <SwapScreen mine={state!.team} theirs={oppTeam} gen={9} onDone={r} />);
			if (swap) {
				const got = cloneSet(oppTeam[swap.take]);
				got.level = level;
				state.team[swap.give] = got;
			}
		}
		save(FACTORY_KEY(fmt, level, opts), state);
	}
}

// ───────────── PWT ─────────────
/** 팀의 주력 타입에 어울리는 배틀 배경 (물 → 바닷가, 얼음 → 설원, 불꽃 → 화산, 땅·바위·강철 → 동굴, 그 밖 → 체육관) */
function bgForTeam(team: PSet[]): 'beach' | 'snow' | 'volcano' | 'cave' | 'gym' {
	const c: { [t: string]: number } = {};
	for (const s of team) for (const t of speciesData(toID(s.species), 9)?.t || []) c[t] = (c[t] || 0) + 1;
	const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
	return top === 'Water' ? 'beach' : top === 'Ice' ? 'snow' : top === 'Fire' ? 'volcano' : ['Ground', 'Rock', 'Steel'].includes(top) ? 'cave' : 'gym';
}
/** 프리 배틀 등: 바깥 배경 중 무작위 */
const OUTDOOR_BGS = ['field', 'beach', 'snow', 'cave', 'volcano', 'gym'] as const;

function namedTeam(t: NamedTrainer, size: number, gen: Gen = 9): PSet[] {
	// 배틀 규칙에 맞춘 엔트리(전설·환상 허용이면 설정상 어울리는 전설을 넣어 강하게). 에이스는 항상 포함, 나머지 무작위
	const roster = rosterForRule(t, ruleById(loadSettings().battleRule));
	const aceId = roster[roster.length - 1];
	const others = rng.shuffle(roster.slice(0, -1)).slice(0, size - 1);
	const species = [...others, aceId];
	const quality = ['champion', 'boss', 'hero'].includes(t.role) ? 0.9 : ['elite', 'rival'].includes(t.role) ? 0.75 : 0.6;
	const team = species.map(id => {
		const set = randomSetFor(id, gen, 50, false, quality);
		if (id === 'pikachu') set.item = 'lightball';
		return set;
	});
	// 에이스에게 메가스톤이 있으면 우선 메가진화 담당
	const ace = team[team.length - 1];
	const stones = megaStonesFor(ace.species);
	if (stones.length) fitSetToMega(ace, rng.pick(stones), gen);
	return dedupeItems(assignGimmicks(team, { mega: ['leader', 'admin'].includes(t.role) ? 0.5 : 0.9, z: 0.6 }));
}

export async function runPWT() {
	const cup = await ask<typeof CUPS[number] | typeof BACK>(r => <ChoiceScreen title="PWT 월드 토너먼트" onBack={() => r(BACK)}
		intro={<p class="hint">레벨 50 · 8명 토너먼트 3연승으로 우승!</p>}
		options={CUPS.map(c => ({ value: c, label: c.name, desc: c.desc, badge: loadRecords().cups[c.id] ? `🏆×${loadRecords().cups[c.id]}` : undefined, icon: '🏟' }))}
		onPick={r} />);
	if (cup === BACK) return;
	const opts = defaultOpts();
	const fmt = await chooseFormat(cup.name, undefined, false, opts, cup.rental ? ['level100', 'inverse'] : ALL_OPTS);
	if (fmt === BACK) return;
	const n = isDoubles(fmt) ? 4 : 3;
	let myTeam: PSet[];
	if (cup.rental) {
		myTeam = withLevel(randomTeam({ gen: 9, size: 6, minBst: 470, maxBst: 600, doubles: isDoubles(fmt) }), lvl(opts));
	} else {
		const t = await chooseTeam(9, `${cup.name} · 팀 선택`, true, opts.cheat, lvl(opts));
		if (t === BACK) return;
		myTeam = t;
	}
	// 참가자 구성
	const me = playerName();
	let entrants: { name: string; title: string; team: () => PSet[]; skill: number; line?: string; named?: NamedTrainer; sprite?: string; lines?: any }[];
	const named = cup.trainers().slice(0, 7).map(id => namedById(id));
	if (named.length) {
		entrants = named.map(t => ({ name: t.name, title: t.role === 'champion' ? '챔피언' : t.role === 'elite' ? '사천왕' : t.role === 'leader' ? '관장' : namedTitle(t), team: () => namedTeam(t, 6), skill: ['champion', 'boss', 'hero'].includes(t.role) ? 0.95 : ['elite', 'rival'].includes(t.role) ? 0.88 : 0.8, line: t.line, named: t, sprite: namedSprite(t), lines: namedLines(t) }));
	} else {
		entrants = Array.from({ length: 7 }, () => {
			const tr = randomTrainer();
			return { name: tr.name, title: tr.className, team: () => randomTeam({ gen: 9, size: 6, minBst: cup.rental ? 460 : 490, maxBst: cup.rental ? 600 : 680, allowSubLegend: !cup.rental, doubles: isDoubles(fmt), quality: cup.rental ? 0.45 : 0.7 }), skill: cup.rental ? 0.7 : 0.85, line: tr.lines.intro, sprite: tr.sprite, lines: tr.lines };
		});
	}
	const usedNames = new Set(entrants.map(e => e.name));
	usedNames.add(me);
	while (entrants.length < 7) {
		const tr = randomTrainer();
		if (usedNames.has(tr.name)) continue;
		usedNames.add(tr.name);
		entrants.push({ name: tr.name, title: tr.className, team: () => randomTeam({ gen: 9, size: 6, minBst: 480, maxBst: 640, doubles: isDoubles(fmt), quality: 0.6 }), skill: 0.8, line: tr.lines.intro, sprite: tr.sprite, lines: tr.lines });
	}
	// 같은 이름이 둘이면 대진표가 꼬이므로 바꿈
	for (let i = 0; i < entrants.length; i++) for (let j = 0; j < i; j++) if (entrants[i].name === entrants[j].name) entrants[i] = { ...entrants[i], name: entrants[i].name + ' 2' };
	const order = rng.shuffle([...entrants.keys()]);
	const slots = [me, ...order.map(i => entrants[i].name)];
	const rounds: string[][] = [slots, ['', '', '', ''], ['', ''], ['']];
	let pool = order.map(i => entrants[i]);
	if (cup.rental) {
		await ask<void>(r => <InfoScreen title={cup.name} heading="렌탈 포켓몬을 받았다!" sprites={myTeam.map(s => s.species)} sets={myTeam} gen={9}
			actions={[{ label: '확인', onClick: () => r() }]} />);
	}
	// 대진표 초상 (이름 → 트레이너 그림)
	const faces: { [name: string]: string | undefined } = { [me]: playerSprite(), ...Object.fromEntries(entrants.map(e => [e.name, e.sprite])) };
	const fmtKo = ({ singles: '싱글배틀', doubles: '더블배틀' } as any)[fmt] || fmtLabel(fmt);
	// 토너먼트 진입: 대진표 전용 곡
	playMusic('pwthall');
	// 1회전 상대 = slots[1], 다른 경기는 무작위 진행
	let oppIdx = 0;
	for (let round = 0; round < 3; round++) {
		const opp = pool[oppIdx];
		playMusic('pwthall');
		await ask<void>(r => <InfoScreen title={cup.name} banner={['1회전', '준결승', '결승'][round]} lines={optsLines(opts)}
			actions={[{ label: '승부한다', onClick: () => r() }]}>
			<BracketView rounds={rounds} highlight={me} sprites={faces} message={`${['1회전', '준결승', '결승'][round]} 상대는 ${opp.title} ${opp.name}!\n${cup.name} · ${fmtKo}`} />
		</InfoScreen>);
		const oppTeam = withLevel(opp.team(), lvl(opts));
		// PWT(BW2): 배틀 전 상대 엔트리를 보고 6마리 중 n마리를 고름
		const picked = await ask<PSet[]>(r => <PickScreen title="참가 포켓몬 선택" team={myTeam} gen={9} count={n}
			opponent={{ name: `${opp.title} ${opp.name}`, team: oppTeam }} onDone={r} />);
		// 상대도 내 엔트리를 보고 n마리 선택 (네임드는 에이스 포함)
		const oppPick = aiPickEntry(oppTeam, myTeam, n, isDoubles(fmt), Math.min(0.97, opp.skill + round * 0.04), !!opp.named);
		const res = await battle({
			gen: 9, doubles: isDoubles(fmt), aiSkill: Math.min(0.97, opp.skill + round * 0.04), bg: round === 2 ? 'champion' : 'pwt',
			label: `${cup.name} ${['1회전', '준결승', '결승'][round]}`, noRecord: noRec(opts), cheat: opts.cheat, inverse: opts.inverse, music: opp.named ? namedMusic(opp.named) : round === 2 ? 'champion' : undefined,
			p1: { name: me, team: picked, sprite: playerSprite() }, p2: { name: opp.name, title: opp.title, team: oppPick, line: opp.line, sprite: opp.sprite, lines: opp.lines },
		});
		// 대진표 갱신 (다른 경기는 무작위)
		const winners: string[] = [];
		const cur = rounds[round];
		for (let i = 0; i < cur.length; i += 2) {
			if (i === 0) winners.push(res.win ? me : opp.name);
			else winners.push(rng.pick([cur[i], cur[i + 1]]));
		}
		rounds[round + 1] = winners;
		if (!res.win) {
			await ask<void>(r => <InfoScreen title={cup.name} heading="아쉽게 탈락!" lines={[`${['1회전', '준결승', '결승'][round]}에서 ${opp.name}에게 졌다.`]}
				actions={[{ label: '메뉴로', onClick: () => r() }]} />);
			return;
		}
		if (round < 2) {
			// 다음 상대: 옆 경기 승자
			const nextName = winners[1];
			oppIdx = pool.findIndex(e => e.name === nextName);
			if (oppIdx < 0) oppIdx = 0;
			playMusic('pwthall');
			await ask<void>(r => <InfoScreen title={cup.name} banner="승리!" actions={[{ label: '다음 경기로', onClick: () => r() }]}>
				<BracketView rounds={rounds} highlight={me} sprites={faces} message={`${['1회전', '준결승'][round]} 승리! 다음은 ${round === 0 ? '준결승' : '결승'}이다.`} />
			</InfoScreen>);
		}
	}
	if (!noRec(opts)) updateRecords(r => { r.cups[cup.id] = (r.cups[cup.id] || 0) + 1; });
	playMusic('pwthall');
	await ask<void>(r => <InfoScreen title={cup.name} banner="🏆 우승!" heading={`${cup.name} 우승을 축하합니다!`} lines={noRec(opts) ? ['(치트·거꾸로 배틀은 전적에 남지 않습니다)'] : undefined}
		sprites={myTeam.map(s => s.species)} sets={myTeam} gen={9} actions={[{ label: '메뉴로', onClick: () => r() }]}>
		<BracketView rounds={rounds} highlight={me} sprites={faces} />
	</InfoScreen>);
	void pool; pool = [];
}

/** 네임드 트레이너와의 배경음악: 악의 조직 간부·보스 → 악의 조직 테마, 관장·사천왕·챔피언·주인공 → 중요 배틀 테마 */
export const namedMusic = (t: NamedTrainer) => ['admin', 'boss'].includes(t.role) ? 'evil' as const : ['champion', 'hero'].includes(t.role) ? 'champion' as const : ['leader', 'elite'].includes(t.role) ? 'boss' as const : 'battle' as const;

// ───────────── 네임드 트레이너 ─────────────
const ROLE_ORDER = ['leader', 'elite', 'champion', 'hero', 'rival', 'admin', 'boss'];
function regionSummary(reg: string) {
	const list = NAMED.filter(t => t.region === reg);
	const n = (roles: string[]) => list.filter(t => roles.includes(t.role)).length;
	if (reg === '미르시티') return [`ZA로열 랭크전·보상 배틀 ${n(['leader', 'elite', 'champion', 'boss'])}`, `라이벌·주요 인물 ${n(['hero', 'rival', 'admin'])}`].join(' · ');
	return [`관장·사천왕·챔피언 ${n(['leader', 'elite', 'champion'])}`, n(['hero', 'rival']) ? `주인공·라이벌·주요 인물 ${n(['hero', 'rival'])}` : '',
		n(['admin', 'boss']) ? `악의 조직·보스 ${n(['admin', 'boss'])}` : ''].filter(Boolean).join(' · ');
}
export async function runNamed() {
	while (true) {
		const region = await ask<NamedTrainer['region'] | typeof BACK>(r => <ChoiceScreen title="네임드 트레이너" onBack={() => r(BACK)}
			intro={<p class="hint">역대 체육관 관장·사천왕·챔피언, 주인공·라이벌·주요 인물, 악의 조직 간부·보스, 레전즈 Z-A(미르시티) 인물과 대전합니다. (레벨 50)</p>}
			options={REGIONS.map(reg => ({ value: reg, label: regionLabel(reg), desc: regionSummary(reg), icon: '🗺' }))}
			onPick={r} />);
		if (region === BACK) return;
		while (true) {
			const t = await ask<NamedTrainer | typeof BACK>(r => <ChoiceScreen title={regionLabel(region)} onBack={() => r(BACK)}
				options={NAMED.filter(x => x.region === region).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)).map(x => ({
					value: x, label: x.name, desc: x.title, badge: loadRecords().named[x.id] ? `✓${loadRecords().named[x.id]}` : undefined,
					icon: <img class="trainer-icon" src={SPRITE_URL(namedSprite(x))} onError={trainerImgError} />,
				}))} onPick={r} />);
			if (t === BACK) break;
			const opts = defaultOpts();
			const mode = await ask<'s3' | 's6' | 'd4' | 'd6' | typeof BACK>(r => <ChoiceScreen title={`${t.name} · 규칙`} onBack={() => r(BACK)}
				intro={<p class="hint">“{t.line}”</p>} footer={<><OptsBox opts={opts} show={ALL_OPTS} /><BgmRow /></>}
				options={[
					{ value: 's3' as const, label: '싱글 3vs3', desc: '6마리 중 3마리 선택', icon: '①' },
					{ value: 's6' as const, label: '싱글 6vs6 (풀배틀)', desc: '전원 참가', icon: '⑥' },
					{ value: 'd4' as const, label: '더블 4vs4', desc: '6마리 중 4마리 선택', icon: '②' },
					{ value: 'd6' as const, label: '더블 6vs6', desc: '전원 참가', icon: '⑥' },
				]} onPick={r} />);
			if (mode === BACK) continue;
			const team = await chooseTeam(9, `${t.name} 전 · 팀 선택`, true, opts.cheat, lvl(opts));
			if (team === BACK) continue;
			const doubles = mode.startsWith('d');
			const size = mode === 's3' ? 3 : mode === 'd4' ? 4 : 6;
			const oppTeam = withLevel(namedTeam(t, 6), lvl(opts));
			const myTeam = team;
			const picked = await ask<PSet[]>(r => <PickScreen title={myTeam.length > size ? '참가 포켓몬' : '선봉·순서 정하기'} team={myTeam} gen={9} count={Math.min(size, myTeam.length)}
				opponent={{ name: t.name, team: oppTeam }} onDone={r} />);
			const oppPick = size < 6 ? aiPickEntry(oppTeam, myTeam, size, doubles, ['champion', 'boss', 'hero'].includes(t.role) ? 0.95 : 0.85, true) : oppTeam;
			const res = await battle({
				gen: 9, doubles, aiSkill: ['champion', 'boss', 'hero'].includes(t.role) ? 0.95 : 0.85, bg: ['champion', 'boss', 'hero'].includes(t.role) ? 'champion' : bgForTeam(oppTeam),
				label: `${t.title}`, noRecord: noRec(opts), cheat: opts.cheat, inverse: opts.inverse, music: namedMusic(t), p1: { name: playerName(), team: picked, sprite: playerSprite() }, p2: { name: t.name, title: namedTitle(t), team: oppPick, line: t.line, sprite: namedSprite(t), lines: namedLines(t) },
			});
			if (res.win && !noRec(opts)) updateRecords(r => { r.named[t.id] = (r.named[t.id] || 0) + 1; });
			await ask<void>(r => <InfoScreen title={t.name} trainer={namedSprite(t)} heading={res.win ? `${t.name}에게 승리했다!` : `${t.name}에게 졌다…`}
				lines={[`“${res.win ? namedLines(t).lose : namedLines(t).win}”`, ...(noRec(opts) ? ['(치트·거꾸로 배틀은 전적에 남지 않습니다)'] : [])]} actions={[{ label: '확인', onClick: () => r() }]} />);
		}
	}
}

// ───────────── 모의 랭크 매치 (포켓몬 챔피언스 방식) ─────────────
export const RANK_TIERS = [
	{ name: '비기너', min: 0, ball: 'pokeball' }, { name: '몬스터볼급', min: 100, ball: 'pokeball' }, { name: '슈퍼볼급', min: 300, ball: 'greatball' },
	{ name: '하이퍼볼급', min: 600, ball: 'ultraball' }, { name: '마스터볼급', min: 1000, ball: 'masterball' },
];
/** 기본 획득 RP · 상위 매칭(확률·실력 차이·승리 보너스) */
const RANK_BASE = 30, UPPER_RATE = 0.2, UPPER_GAP = 400, UPPER_BONUS = 30;
export function rankTier(rp: number) { let t = RANK_TIERS[0]; for (const x of RANK_TIERS) if (rp >= x.min) t = x; return t; }
type RankFmt = 'singles' | 'doubles';
/** RP 에 따라 강해지는 상대: AI 실력 0.5→0.97, 종족값 하한 420→560, 300 RP 부터 준전설, (전설 허용 규칙이면) 600 RP 부터 전설 1마리·1000 RP 부터 2마리,
 *  초반엔 능력 포인트도 덜 찍음. 마스터볼급에서는 가끔 챔피언·주인공급 네임드 트레이너가 나옴 */
function rankOpponent(rp: number, fmt: RankFmt, level: number) {
	const rule = ruleById(loadSettings().battleRule);
	const s = Math.min(1, rp / 1200);
	const skill = Math.min(0.97, 0.5 + 0.5 * s);
	const doubles = fmt === 'doubles';
	if (rp >= 1000 && Math.random() < 0.35) {
		const pool = NAMED.filter(t => ['champion', 'hero', 'boss'].includes(t.role));
		const t = rng.pick(pool);
		return { name: t.name, title: namedTitle(t), sprite: namedSprite(t), lines: namedLines(t), line: t.line, skill: 0.97, team: withLevel(namedTeam(t, 6), level), named: true, ranker: '', music: namedMusic(t) };
	}
	// 하이퍼볼급부터 실제 랭크배틀 상위 트레이너의 팀(PokéDB)과 자주 붙음
	if (rp >= 600 && Math.random() < (rp >= 1000 ? 0.5 : 0.3)) {
		const rk = rankerTeam(doubles, level, 0.6 + 0.4 * s);
		if (rk) { const tr = randomTrainer(); return { name: tr.name, title: '랭커', sprite: tr.sprite, lines: tr.lines, line: tr.lines.intro, skill, team: withLevel(rk.team, level), named: false, ranker: `시즌 ${rk.season} 상위 구축 · 레이트 ${rk.rating}` }; }
	}
	const nLeg = rule.legend === 'all' ? (rp >= 1000 ? 2 : rp >= 600 ? 1 : 0) : 0;
	const ivs = rp < 100 ? 18 : rp < 300 ? 26 : 31;
	const quality = 0.2 + 0.8 * s; // RP 가 오를수록 Smogon 상위 세트·동료 조합
	const base = randomTeam({ gen: 9, size: 6 - nLeg, minBst: 420 + Math.round(140 * s), maxBst: rp < 300 ? 580 : undefined, allowSubLegend: rp >= 300, doubles, ivs, gimmicks: false, quality });
	const legends = nLeg ? randomTeam({ gen: 9, size: nLeg, legendOnly: true, doubles, ivs, gimmicks: false, quality, exclude: new Set(base.map(x => toID(x.species))) }) : [];
	const team = dedupeItems(assignGimmicks([...base, ...legends]));
	const tr = randomTrainer();
	return { name: tr.name, title: tr.className, sprite: tr.sprite, lines: tr.lines, line: tr.lines.intro, skill, team: withLevel(team, level), named: false, ranker: '' };
}
export async function runRank() {
	const opts = defaultOpts();
	const fmt = await ask<RankFmt | typeof BACK>(r => <ChoiceScreen title="모의 랭크 매치" onBack={() => r(BACK)}
		intro={<p class="hint">포켓몬 챔피언스 방식: 6마리를 등록하고 상대 엔트리를 본 뒤 참가 포켓몬을 고릅니다. 이기면 RP가 올라 등급이 오르고, 올라갈수록 상대 포켓몬과 AI가 강해집니다.</p>}
		options={[
			{ value: 'singles' as RankFmt, label: '싱글 6→3', desc: '6마리 중 3마리 선택 · 1대1', icon: '③', badge: `${rankTier(loadRecords().rp?.singles || 0).name} ${loadRecords().rp?.singles || 0}RP` },
			{ value: 'doubles' as RankFmt, label: '더블 6→4', desc: '6마리 중 4마리 선택 · 2대2', icon: '④', badge: `${rankTier(loadRecords().rp?.doubles || 0).name} ${loadRecords().rp?.doubles || 0}RP` },
		]} footer={<OptsBox opts={opts} show={ALL_OPTS} />} onPick={r} />);
	if (fmt === BACK) return;
	const team = await chooseTeam(9, '랭크 매치 · 팀 등록', true, opts.cheat, lvl(opts));
	if (team === BACK) return;
	const n = fmt === 'doubles' ? 4 : 3;
	const key = fmt;
	while (true) {
		const rec = loadRecords();
		const rp = rec.rp?.[key] || 0;
		const tier = rankTier(rp);
		// 상위 매칭: 가끔(20%) 지금보다 400 RP 높은 실력의 상대와 붙음. 이기면 보너스, 져도 연승은 유지
		const upper = (globalThis as any).__rankUpper ?? Math.random() < UPPER_RATE; // __rankUpper: 테스트용 강제
		const oppRp = upper ? rp + UPPER_GAP : rp;
		const opp = rankOpponent(oppRp, fmt, lvl(opts));
		// 연승할수록 더 많이 오름: 30 → 35 → 40 → 45 → 50 (+마스터볼급 5). 연승 수는 기록에 남아 나갔다 와도 이어짐
		const streak = rec.rankStreak?.[key] || 0;
		const gain = RANK_BASE + 5 * Math.min(streak, 4) + (tier.min >= 1000 ? 5 : 0) + (upper ? UPPER_BONUS : 0), loss = rp < 100 ? 0 : 12;
		const go = await ask<'go' | 'quit'>(r => <InfoScreen title={`랭크 매치 · ${fmt === 'doubles' ? '더블 6→4' : '싱글 6→3'}`} banner={`${tier.name} · ${rp} RP`}
			heading={`${upper ? '⬆ 상위 매칭! ' : ''}${opp.title ? opp.title + ' ' : ''}${opp.name}${josa(opp.name)} 매칭되었다!`} trainer={opp.sprite}
			lines={[`${streak ? `🔥 ${streak}연승 중 · ` : ''}승리 +${gain} RP${upper ? ` (상위 매칭 보너스 +${UPPER_BONUS} 포함)` : ''} · 패배 -${loss} RP`,
				...(upper ? [`${rankTier(oppRp).name}(약 ${oppRp} RP) 실력의 상대입니다. 져도 연승은 끊기지 않아요.`] : []),
				...(streak < 4 ? [`연승할수록 획득 RP 증가 (최대 +${RANK_BASE + 20 + (tier.min >= 1000 ? 5 : 0)})`] : []), ...(opp.named ? ['★ 강적 등장!'] : []), ...(opp.ranker ? [`★ 상위 랭커 (${opp.ranker})`] : []), ...optsLines(opts)]}
			sprites={team.map(s => s.species)} sets={team} gen={9}
			actions={[{ label: '승부한다', onClick: () => r('go') }, { label: '그만두기', kind: 'ghost', onClick: () => r('quit') }]} />);
		if (go === 'quit') return;
		// 챔피언스 방식: 상대 엔트리를 보고 참가 포켓몬 선택 (상대도 에이스 포함 n마리)
		const picked = await ask<PSet[]>(r => <PickScreen title={`참가 포켓몬 ${n}마리`} team={team} gen={9} count={Math.min(n, team.length)}
			opponent={{ name: `${opp.title ? opp.title + ' ' : ''}${opp.name}`, team: opp.team }} onDone={r} />);
		const oppPick = aiPickEntry(opp.team, team, n, fmt === 'doubles', opp.skill, opp.named);
		const res = await battle({
			gen: 9, doubles: fmt === 'doubles', aiSkill: opp.skill, bg: oppRp >= 1000 ? 'champion' : 'pwt', label: `랭크 매치 · ${tier.name}${upper ? ' · 상위 매칭' : ''}`, music: (opp as any).music ?? (oppRp >= 1000 ? 'champion' : 'tower'),
			noRecord: noRec(opts), cheat: opts.cheat, inverse: opts.inverse,
			p1: { name: playerName(), team: picked, sprite: playerSprite() }, p2: { name: opp.name, title: opp.title, team: oppPick, line: opp.line, sprite: opp.sprite, lines: opp.lines },
		});
		let newRp = rp, msg = '';
		if (!noRec(opts)) {
			newRp = Math.max(0, rp + (res.win ? gain : -loss));
			updateRecords(r => { r.rp = { ...(r.rp || {}), [key]: newRp }; r.rpBest = { ...(r.rpBest || {}), [key]: Math.max(r.rpBest?.[key] || 0, newRp) };
				r.rankStreak = { ...(r.rankStreak || {}), [key]: res.win ? streak + 1 : upper ? streak : 0 }; });
			const nt = rankTier(newRp);
			if (nt.min > tier.min) msg = `🎉 ${nt.name}(으)로 승급!`;
			else if (nt.min < tier.min) msg = `${nt.name}(으)로 강등…`;
		}
		const again = await ask<'next' | 'quit'>(r => <InfoScreen title="랭크 매치" banner={res.win ? '승리!' : '패배…'}
			heading={noRec(opts) ? '(전적·RP에 반영되지 않습니다)' : `${rp} → ${newRp} RP${msg ? ' · ' + msg : ''}`}
			lines={[`현재 등급: ${rankTier(newRp).name}${res.win && !noRec(opts) ? ` · ${streak + 1}연승` : ''}`,
				...(upper && res.win && !noRec(opts) ? [`⬆ 상위 매칭 승리! 보너스 +${UPPER_BONUS} RP`] : []),
				...(upper && !res.win && !noRec(opts) && streak ? [`상위 매칭이라 ${streak}연승은 그대로 이어집니다.`] : []),
				// 상위 매칭에서 진 경우엔 '연승은 여기까지' 같은 상대 대사가 안내와 어긋나므로 생략
				...(res.win && opp.lines?.lose ? [`“${opp.lines.lose}”`] : !res.win && !upper && opp.lines?.win ? [`“${opp.lines.win}”`] : [])]}
			actions={[{ label: '다음 매치', onClick: () => r('next') }, { label: '메뉴로', kind: 'ghost', onClick: () => r('quit') }]} />);
		if (again === 'quit') return;
	}
}

// ───────────── 프리 배틀 ─────────────
export async function runFree() {
	const modeName = '프리 배틀';
	const opts = defaultOpts();
	const fmt = await chooseFormat(modeName, '내 팀으로, 내가 만든 다른 팀이나 무작위 팀과 바로 대전합니다. 기록에는 남지 않아요.', false, opts);
	if (fmt === BACK) return;
	const cheat = opts.cheat;
	const my = await chooseTeam(9, '내 팀', true, cheat, lvl(opts));
	if (my === BACK) return;
	// 상대 팀: 저장된 팀 / 무작위 (치트 팀은 '치트 팀 허용'일 때만)
	const teams = loadTeams().filter(t => t.sets.length >= 1 && (cheat || !t.cheat));
	const oppPick = await ask<SavedTeam | 'random' | 'strong' | 'ranker' | typeof BACK>(r => <ChoiceScreen title="상대 팀" onBack={() => r(BACK)}
		options={[
			{ value: 'random' as const, label: '무작위 팀', desc: '일반 트레이너의 무작위 6마리', icon: '🎲' },
			{ value: 'strong' as const, label: '강한 무작위 팀', desc: '준전설 포함 · 메가·Z 소지', icon: '🔥' },
			{ value: 'ranker' as const, label: '상위 랭커 팀', desc: `실제 랭크배틀 상위 구축(PokéDB) · 지금 룰에서 ${rankerCount(isDoubles(fmt))}팀`, icon: '🏆', disabled: !rankerCount(isDoubles(fmt)) },
			...teams.map(t => ({ value: t, label: t.name, desc: t.sets.map(s => speciesKo(s.species)).join(' · '),
				icon: <span class="mini"><img class="sprite" src={gen5Icon(spriteId(t.sets[0].species))} /></span> })),
		]} onPick={r} />);
	if (oppPick === BACK) return;
	const level = await ask<'s' | 'n' | 'h' | typeof BACK>(r => <ChoiceScreen title="상대 AI 실력" onBack={() => r(BACK)} options={[
		{ value: 'n' as const, label: '보통', desc: '체육관 관장 수준', icon: '●' },
		{ value: 'h' as const, label: '강함', desc: '챔피언 수준 — 기믹과 교체를 가장 잘 씀', icon: '◆' },
		{ value: 's' as const, label: '약함', desc: '실수가 잦음', icon: '○' },
	]} onPick={r} />);
	if (level === BACK) return;
	const skill = level === 'h' ? 0.97 : level === 'n' ? 0.85 : 0.5;
	const n = isDoubles(fmt) ? 4 : 3;
	let rematch: { oppTeam: PSet[]; oppName: string; oppTitle: string; oppSprite: string; oppLines: any } | null = null;
	while (true) {
		const tr = randomTrainer();
		let oppTeam: PSet[];
		let oppName = tr.name, oppTitle = tr.className, oppSprite = tr.sprite, oppLines: any = tr.lines;
		if (rematch) ({ oppTeam, oppName, oppTitle, oppSprite, oppLines } = rematch);
		else if (oppPick === 'random') oppTeam = withLevel(randomTeam({ gen: 9, size: 6, minBst: 470, maxBst: 600, doubles: isDoubles(fmt), quality: 0.5 }), lvl(opts));
		else if (oppPick === 'strong') oppTeam = withLevel(randomTeam({ gen: 9, size: 6, minBst: 520, allowSubLegend: true, doubles: isDoubles(fmt), quality: 0.9 }), lvl(opts));
		else if (oppPick === 'ranker') { const rk = rankerTeam(isDoubles(fmt), lvl(opts), 0.9)!; oppTeam = withLevel(rk.team, lvl(opts)); oppTitle = `랭커`; oppName = `${tr.name} (시즌 ${rk.season} · ${rk.rating})`; }
		else { oppTeam = oppPick.cheat ? oppPick.sets.map(cloneSet) : withLevel(oppPick.sets.map(cloneSet), lvl(opts)); oppName = oppPick.name; oppTitle = '팀'; oppSprite = rng.pick(['acetrainer-gen4', 'acetrainerf-gen4', 'veteran-gen4']); }
		const myTeam = my;
		const size = await ask<number>(r => <ChoiceScreen title="참가 마릿수" options={[
			{ value: n, label: `${n}마리 (${isDoubles(fmt) ? '더블' : '싱글'} 표준)`, desc: '상대 팀을 보고 고릅니다', icon: String(n) },
			{ value: 6, label: '풀배틀 6마리', desc: '전원 참가', icon: '6' },
		]} onPick={r} />);
		const picked = await ask<PSet[]>(r => <PickScreen title={myTeam.length > size ? '참가 포켓몬' : '선봉·순서 정하기'} team={myTeam} gen={9} count={Math.min(size, myTeam.length)}
			opponent={{ name: oppName, team: oppTeam }} onDone={r} />);
		const oppSel = size < oppTeam.length ? aiPickEntry(oppTeam, myTeam, size, isDoubles(fmt), skill) : oppTeam;
		const res = await battle({
			gen: 9, doubles: isDoubles(fmt), aiSkill: skill, bg: rng.pick([...OUTDOOR_BGS]), label: modeName, noRecord: true, cheat, inverse: opts.inverse,
			p1: { name: playerName(), team: picked, sprite: playerSprite() }, p2: { name: oppName, title: oppTitle, team: oppSel, sprite: oppSprite, lines: oppLines },
		});
		const again = await ask<'same' | 'new' | 'quit'>(r => <InfoScreen title={modeName} heading={res.win ? '승리!' : '패배…'}
			actions={[{ label: '같은 상대와 다시', onClick: () => r('same') }, { label: '다른 상대와', kind: 'ghost', onClick: () => r('new') }, { label: '메뉴로', kind: 'ghost', onClick: () => r('quit') }]} />);
		if (again === 'quit') return;
		if (again === 'same') { rematch = { oppTeam, oppName, oppTitle, oppSprite, oppLines }; } else rematch = null;
	}
}

function josa(name: string) {
	const ch = name.charCodeAt(name.length - 1);
	return ch >= 0xAC00 && ch <= 0xD7A3 && (ch - 0xAC00) % 28 ? '이' : '가';
}
