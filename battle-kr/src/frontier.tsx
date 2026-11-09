/** 새 도전 모드: 배틀팰리스 · 일필도 · 오늘의 도전 · 지방 클리어 · 보스 러시 */
import { h } from 'preact';
import { ask } from './ui/core';
import { PickScreen, InfoScreen, ChoiceScreen } from './ui/screens';
import { randomTeam, randomSetFor, cloneSet, dedupeItems, rng, type PSet } from './sets';
import { NAMED, REGIONS, REGION_COLOR, regionLabel, randomTrainer, namedSprite, namedLines, namedTitle, type NamedTrainer } from './trainers';
import { SPRITE_URL, trainerImgError } from './trainer-lines';
import { loadSettings, load, save, remove, updateRecords, loadRecords } from './store';
import { ruleById, recTag } from './rules';
import { aiPickEntry } from './smogon';
import { chooseAI } from './ai';
import { Dex } from '../../sim/dex';
import { speciesKo, spriteId, toID, ALL_TYPES, typeKo } from './data';
import { BACK, battle, chooseTeam, withLevel, namedTeam, playerName, playerSprite, BgmRow, josa, confirmQuit, towerOpponent, ROLE_ORDER, namedMusic, isDoubles, type Fmt } from './modes';
import { updateStats, loadStats, setMax, BOSS_LEN } from './stats';
import { earnBP, setClearBP, BRAIN_BP } from './rewards';

const rt = () => recTag(loadSettings().battleRule);
/** 이 배틀만 기믹 없는 규칙 (팰리스: 포켓몬이 스스로 싸우므로) */
const noGimmickRule = () => { const parts = ruleById(loadSettings().battleRule).id.split('.'); parts[0] = '_one'; return parts.join('.'); };

// ═════════ 배틀팰리스: 포켓몬이 성격대로 스스로 기술을 고름 (에메랄드 배틀팰리스 방식) ═════════
/** 성격 → [공격, 방어, 보조] 확률 (HP 절반 초과 / 절반 이하). 에메랄드 배틀팰리스 표를 참고한 값 */
const PALACE: { [n: string]: [number, number, number, number, number, number] } = {
	Hardy: [61, 7, 32, 61, 7, 32], Lonely: [20, 25, 55, 84, 8, 8], Brave: [70, 15, 15, 32, 60, 8], Adamant: [38, 31, 31, 70, 15, 15], Naughty: [20, 70, 10, 70, 22, 8],
	Bold: [30, 20, 50, 32, 58, 10], Docile: [56, 22, 22, 75, 15, 10], Relaxed: [25, 15, 60, 75, 15, 10], Impish: [69, 6, 25, 28, 55, 17], Lax: [35, 10, 55, 29, 6, 65],
	Timid: [62, 10, 28, 30, 20, 50], Hasty: [58, 37, 5, 88, 6, 6], Serious: [34, 11, 55, 29, 11, 60], Jolly: [35, 5, 60, 35, 60, 5], Naive: [56, 22, 22, 29, 7, 64],
	Modest: [35, 45, 20, 86, 7, 7], Mild: [44, 50, 6, 34, 60, 6], Quiet: [56, 22, 22, 48, 32, 20], Bashful: [30, 58, 12, 41, 10, 49], Rash: [30, 13, 57, 76, 22, 2],
	Calm: [40, 50, 10, 81, 6, 13], Gentle: [18, 70, 12, 91, 6, 3], Sassy: [88, 6, 6, 87, 6, 7], Careful: [42, 50, 8, 89, 6, 5], Quirky: [56, 22, 22, 45, 15, 40],
};
const SELF_TARGETS = new Set(['self', 'allySide', 'allies', 'adjacentAllyOrSelf', 'allyTeam']);
export function palaceChoice(battle: any, req: any, sideId: 'p1' | 'p2'): string | null {
	if (!req || req.wait || req.teamPreview) return null;
	const pokes: any[] = req.side?.pokemon || [];
	const fnt = (p: any) => String(p?.condition || '').endsWith(' fnt');
	if (req.forceSwitch) {
		const used = new Set<number>();
		return req.forceSwitch.map((f: boolean) => {
			if (!f) return 'pass';
			const k = pokes.findIndex((p, i) => !p.active && !fnt(p) && !used.has(i));
			if (k < 0) return 'pass';
			used.add(k); return `switch ${k + 1}`;
		}).join(', ');
	}
	if (!req.active) return null;
	const side = battle[sideId], foe = battle[sideId === 'p1' ? 'p2' : 'p1'];
	const doubles = req.active.length > 1;
	return req.active.map((a: any, i: number) => {
		if (fnt(pokes[i]) || pokes[i]?.commanding) return 'pass';
		const mon = side.active[i];
		const nat = PALACE[mon?.set?.nature] || PALACE.Hardy;
		const low = mon && mon.hp * 2 <= mon.maxhp;
		const w = low ? nat.slice(3) : nat.slice(0, 3);
		const moves = (a.moves || []).map((m: any, j: number) => ({ m, j })).filter(({ m }: any) => !m.disabled && (m.pp === undefined || m.pp > 0) && m.target !== 'adjacentAlly');
		if (!moves.length) return 'move 1';
		const cat = (m: any) => { const d = battle.dex.moves.get(m.id); return d.category !== 'Status' ? 0 : SELF_TARGETS.has(d.target) || d.flags?.heal ? 1 : 2; };
		const groups = [0, 1, 2].map(c => moves.filter((x: any) => cat(x.m) === c));
		const tot = groups.reduce((s, g, c) => s + (g.length ? w[c] : 0), 0);
		let r = Math.random() * tot, c = 0;
		for (; c < 3; c++) { if (!groups[c].length) continue; r -= w[c]; if (r < 0) break; }
		const g = groups[Math.min(c, 2)].length ? groups[Math.min(c, 2)] : moves;
		const pick = rng.pick(g) as any;
		let ch = `move ${pick.j + 1}`;
		if (doubles && ['normal', 'any', 'adjacentFoe'].includes(pick.m.target)) {
			const foes = foe.active.map((p: any, k: number) => p && !p.fainted ? k + 1 : 0).filter(Boolean);
			if (foes.length) ch += ' ' + rng.pick(foes);
		}
		return ch;
	}).join(', ');
}

const PALACE_KEY = (fmt: Fmt) => `palace-${fmt}${rt()}`;
interface PalaceState { fmt: Fmt; team: PSet[]; streak: number }
export async function runPalace() {
	const fmt = await ask<Fmt | typeof BACK>(r => <ChoiceScreen title="배틀팰리스" onBack={() => r(BACK)}
		intro={<p class="hint">포켓몬이 <b>성격</b>대로 스스로 기술을 고릅니다. 트레이너는 지켜볼 뿐! HP가 절반 이하가 되면 성격에 따라 싸우는 방식이 바뀝니다. 21·49번째에는 팰리스 메이븐이 나옵니다. (레벨 50 · 기믹 없음)</p>}
		options={[{ value: 'singles' as Fmt, label: '싱글 3vs3', desc: '1대1 · 3마리', icon: '①' }, { value: 'doubles' as Fmt, label: '더블 4vs4', desc: '2마리씩 · 4마리', icon: '②' }]} onPick={r} />);
	if (fmt === BACK) return;
	let state = load<PalaceState | null>(PALACE_KEY(fmt), null);
	if (state) {
		const v = await ask<'resume' | 'new' | typeof BACK>(r => <InfoScreen title="배틀팰리스" heading={`${state!.streak}연승 중인 도전이 있습니다`} sprites={state!.team.map(s => s.species)} sets={state!.team} gen={9}
			actions={[{ label: '이어서 도전', onClick: () => r('resume') }, { label: '새로 시작', kind: 'ghost', onClick: () => r('new') }, { label: '돌아가기', kind: 'ghost', onClick: () => r(BACK) }]} />);
		if (v === BACK) return;
		if (v === 'new') state = null;
	}
	if (!state) {
		const team = await chooseTeam(9, '배틀팰리스 · 팀 선택', true, false, 50);
		if (team === BACK) return;
		const n = fmt === 'doubles' ? 4 : 3;
		const picked = team.length > n ? await ask<PSet[] | typeof BACK>(r => <PickScreen title="참가 포켓몬" team={team} gen={9} count={n} hint="성격이 싸우는 방식을 정합니다. 공격형(고집·대담 등)과 방어형을 섞어 보세요." onBack={() => r(BACK)} onDone={r} />) : team;
		if (picked === BACK) return;
		state = { fmt, team: dedupeItems(picked.map(cloneSet)), streak: 0 };
		save(PALACE_KEY(fmt), state);
	}
	const key = PALACE_KEY(fmt);
	const ruleId = noGimmickRule();
	while (true) {
		const no = state.streak + 1;
		const maven = no === 21 || no === 49;
		const base: any = towerOpponent(state.streak, fmt, state.team, false, 'normal');
		const opp = maven ? { ...base, name: '팰리스 메이븐', title: '', sprite: 'spenser', line: no === 49 ? '포켓몬과 마음이 통했는가? 전력으로 확인하겠다!' : '포켓몬을 믿는 마음, 보여 주게!',
			lines: { ace: '내 포켓몬은 스스로 답을 찾는다!', lose: '훌륭하다… 그대와 포켓몬의 마음은 하나로군.', win: '포켓몬을 더 믿어 보게.' }, skill: 0.97 } : base;
		opp.team = withLevel(opp.team, 50);
		const go = await confirmQuit(() => ask<'go' | 'rest' | 'quit'>(r => <InfoScreen title={`배틀팰리스 · ${fmt === 'doubles' ? '더블' : '싱글'}`} banner={`${no}번째 승부`} prep={<BgmRow />}
			heading={maven ? '⚠ 팰리스 메이븐 등장!' : `${opp.title ? opp.title + ' ' : ''}${opp.name}${josa(opp.name)} 승부를 걸어왔다!`} trainer={opp.sprite}
			lines={[`현재 ${state!.streak}연승 · 포켓몬이 성격대로 스스로 싸웁니다`]} sprites={state!.team.map(s => s.species)} sets={state!.team} gen={9}
			actions={[{ label: '승부한다', onClick: () => r('go') }, { label: '쉬기 (저장 후 나가기)', kind: 'ghost', onClick: () => r('rest') }, { label: '도전 그만두기', kind: 'danger', onClick: () => r('quit') }]} />),
			'quit', `지금까지의 ${state!.streak}연승 도전이 끝납니다. 정말 그만둘까요?`);
		if (go === 'rest') return;
		if (go === 'quit') { remove(key); return; }
		const res = await battle({
			gen: 9, doubles: isDoubles(fmt), aiSkill: opp.skill, bg: (maven ? 'champion' : 'palace') as any, label: `배틀팰리스 ${no}번째`, ruleId, music: (maven ? 'boss' : 'palace') as any,
			auto: (b, req) => palaceChoice(b, req, 'p1'), p2Auto: (b, req) => palaceChoice(b, req, 'p2'), autoMsg: '포켓몬이 스스로 판단해서 싸우고 있다!',
			p1: { name: playerName(), team: state.team, sprite: playerSprite() }, p2: { name: opp.name, title: opp.title, team: opp.team, line: opp.line, sprite: opp.sprite, lines: { intro: opp.line, ...opp.lines } },
		});
		if (!res.win) {
			remove(key); updateRecords(r => { r.current[key] = 0; });
			await ask<void>(r => <InfoScreen title="배틀팰리스" heading="도전 종료" banner={`${state!.streak}연승`} lines={[`최고 기록: ${loadRecords().best[key] || 0}연승`]} actions={[{ label: '메뉴로', onClick: () => r() }]} />);
			return;
		}
		state.streak++;
		const s = state.streak;
		updateRecords(r => { r.current[key] = s; r.best[key] = Math.max(r.best[key] || 0, s); });
		save(key, state);
		if (maven) earnBP(no === 49 ? BRAIN_BP.gold : BRAIN_BP.silver, '팰리스 메이븐 격파');
		if (s % 7 === 0) earnBP(setClearBP(s), '세트 클리어');
		if (s % 7 === 0) {
			const v = await ask<'go' | 'rest'>(r => <InfoScreen title="배틀팰리스" banner="🏆 세트 클리어!" heading={`${s}연승 달성!`} lines={['포켓몬들의 체력이 회복되었다.']}
				actions={[{ label: '계속', onClick: () => r('go') }, { label: '여기서 쉬기', kind: 'ghost', onClick: () => r('rest') }]} />);
			if (v === 'rest') return;
		}
	}
}

// ═════════ 일필도: 포켓몬 한 마리로 1:1 연승 도전. 49번째는 무한다이맥스 무한다이노(내 포켓몬에게 불리한 타입으로 테라스탈) ═════════
const IPPITSU_KEY = () => `ippitsu${rt()}`;
interface IppitsuState { mon: PSet; streak: number }
/** 무한다이노가 테라스탈할 타입: 플레이어에게 불리한 타입 (예: 물 포켓몬 → 풀).
 *  1) 내 공격 기술(없으면 내 타입)이 가장 안 듣는 타입 2) 그 타입 기술(테라버스트)이 내 포켓몬에게 잘 듣는 타입 */
export function weakTeraAgainst(mon: PSet): string {
	const myTypes = Dex.species.get(mon.species).types;
	const atk = mon.moves.map(m => Dex.moves.get(m)).filter(m => m.exists && m.category !== 'Status').map(m => m.type);
	const types = atk.length ? [...new Set(atk)] : myTypes;
	const eff = (mt: string, def: string[]) => Dex.getImmunity(mt, def) ? Dex.getEffectiveness(mt, def) : -3;
	let best = 'Normal', bestScore = -999;
	for (const t of ALL_TYPES.filter(x => x !== 'Stellar')) {
		const taken = Math.max(...types.map(mt => eff(mt, [t])));   // 내가 주는 최대 효과 (낮을수록 나에게 불리)
		const dealt = eff(t, myTypes);                               // 테라 타입 기술이 나에게 주는 효과
		const score = -taken * 10 + dealt * 3;
		if (score > bestScore) { bestScore = score; best = t; }
	}
	return best;
}
export async function runIppitsu() {
	const key = IPPITSU_KEY();
	let state = load<IppitsuState | null>(key, null);
	if (state) {
		const v = await ask<'resume' | 'new' | typeof BACK>(r => <InfoScreen title="일필도" heading={`${state!.streak}연승 중인 도전이 있습니다`} sprites={[state!.mon.species]} sets={[state!.mon]} gen={9}
			actions={[{ label: '이어서 도전', onClick: () => r('resume') }, { label: '새로 시작', kind: 'ghost', onClick: () => r('new') }, { label: '돌아가기', kind: 'ghost', onClick: () => r(BACK) }]} />);
		if (v === BACK) return;
		if (v === 'new') state = null;
	}
	if (!state) {
		const team = await chooseTeam(9, '일필도 · 팀 선택', true, false, 50);
		if (team === BACK) return;
		const picked = team.length > 1 ? await ask<PSet[] | typeof BACK>(r => <PickScreen title="일필도 · 포켓몬 한 마리" team={team} gen={9} count={1}
			hint="한 마리로 끝까지 싸웁니다. 배틀마다 HP·PP는 회복돼요. 21번째에 타워 타이쿤, 49번째에는 무한다이노가 기다립니다." onBack={() => r(BACK)} onDone={r} />) : team;
		if (picked === BACK || !picked.length) return;
		state = { mon: cloneSet(picked[0]), streak: 0 };
		save(key, state);
	}
	while (true) {
		const no = state.streak + 1;
		const final = no === 49;
		const base: any = towerOpponent(state.streak, 'singles', [state.mon], false, 'normal');
		let opp: any;
		if (final) {
			const tera = weakTeraAgainst(state.mon);
			const bs = randomSetFor('eternatuseternamax', 9, 50, false, 1);
			// 테라 타입으로 공격하도록 마지막 기술은 테라버스트
			const boss = { ...bs, species: 'Eternatus-Eternamax', teraType: tera, moves: [...bs.moves.filter(m => m !== 'terablast').slice(0, 3), 'terablast'] };
			opp = { name: '무한다이노', title: '', sprite: '', team: [boss], skill: 0.97, line: '하늘을 뒤덮은 붉은 빛… 무한다이맥스의 힘이 덮쳐 온다!',
				lines: { ace: '무한의 힘이 소용돌이친다!', lose: '무한다이노가 힘을 잃고 쓰러졌다!', win: '거대한 힘 앞에 쓰러지고 말았다…' }, tera };
		} else {
			// 상대도 한 마리: 네임드·타이쿤은 에이스(마지막), 일반 트레이너는 첫 번째
			const pick = base.special || base.boss ? base.team[base.team.length - 1] : base.team[0];
			opp = { ...base, team: [pick] };
		}
		opp.team = withLevel(opp.team, 50);
		const go = await confirmQuit(() => ask<'go' | 'rest' | 'quit'>(r => <InfoScreen title="일필도 · 1:1" banner={`${no}번째 승부`} prep={<BgmRow />}
			heading={final ? '⚠ 무한다이노가 나타났다!' : `${opp.title ? opp.title + ' ' : ''}${opp.name}${josa(opp.name)} 승부를 걸어왔다!`} trainer={final ? undefined : opp.sprite}
			lines={[final ? `${typeKo(opp.tera)} 타입으로 테라스탈하는\n무한다이맥스 무한다이노 — 마지막 승부!` : `현재 ${state!.streak}연승 · 다음 상대: ${speciesKo(toID(opp.team[0].species))}`]}
			sprites={final ? opp.team.map((s: PSet) => s.species) : [state!.mon.species]} sets={final ? opp.team : [state!.mon]} gen={9}
			actions={[{ label: '승부한다', onClick: () => r('go') }, { label: '쉬기 (저장 후 나가기)', kind: 'ghost', onClick: () => r('rest') }, { label: '도전 그만두기', kind: 'danger', onClick: () => r('quit') }]} />),
			'quit', `지금까지의 ${state!.streak}연승 도전이 끝납니다. 정말 그만둘까요?`);
		if (go === 'rest') return;
		if (go === 'quit') { remove(key); return; }
		// 마지막 승부: 무한다이노가 첫 턴에 테라스탈 (테라스탈이 없는 규칙이어도 이 배틀만 허용)
		let teraDone = false;
		const ruleParts = ruleById(loadSettings().battleRule).id.split('.');
		if (final && !ruleParts[0].split('_')[0].includes('t')) ruleParts[0] = ruleParts[0].replace(/^([a-z]*)/, '$1t');
		const res = await battle({
			gen: 9, doubles: false, aiSkill: opp.skill, bg: (final ? 'champion' : 'tower') as any, label: `일필도 ${no}번째`, music: (final ? 'boss' : opp.music) as any,
			...(final ? { ruleId: ruleParts.join('.'), p2Auto: (b: any, req: any) => {
				if (teraDone || !req?.active?.[0]?.canTerastallize) return null;
				teraDone = true;
				const c = chooseAI(b, req, 'p2', opp.skill);
				return /^move \d+/.test(c) ? c.match(/^move \d+( -?\d+)?/)![0] + ' terastallize' : c;
			} } : {}),
			p1: { name: playerName(), team: [state.mon], sprite: playerSprite() },
			p2: { name: opp.name, title: opp.title, team: opp.team, line: opp.line, sprite: opp.sprite, lines: { intro: opp.line, ...opp.lines } },
		});
		if (!res.win) {
			remove(key); updateRecords(r => { r.current[key] = 0; });
			await ask<void>(r => <InfoScreen title="일필도" heading="도전 종료" banner={`${state!.streak}연승`} lines={[`최고 기록: ${loadRecords().best[key] || 0}연승`]} actions={[{ label: '메뉴로', onClick: () => r() }]} />);
			return;
		}
		state.streak++;
		const s = state.streak;
		updateRecords(r => { r.current[key] = s; r.best[key] = Math.max(r.best[key] || 0, s); });
		save(key, state);
		if (final) earnBP(30, '무한다이노 격파');
		else if (s % 7 === 0) earnBP(setClearBP(s), '세트 클리어');
		if (final) {
			await ask<void>(r => <InfoScreen title="일필도" banner="🏆 일필도 달성!" heading="무한다이노를 쓰러뜨렸다!" sprites={[state!.mon.species]} sets={[state!.mon]} gen={9}
				lines={[`${speciesKo(toID(state!.mon.species))} 한 마리로 49연승!`, '이후로도 계속 도전할 수 있어요.']} actions={[{ label: '계속', onClick: () => r() }]} />);
		} else if (s % 7 === 0) {
			const v = await ask<'go' | 'rest'>(r => <InfoScreen title="일필도" banner="🏆 세트 클리어!" heading={`${s}연승 달성!`} lines={['다음 세트로!']}
				actions={[{ label: '계속', onClick: () => r('go') }, { label: '여기서 쉬기', kind: 'ghost', onClick: () => r('rest') }]} />);
			if (v === 'rest') return;
		}
	}
}

// ═════════ 오늘의 도전: 날짜 시드로 모두 같은 렌탈·상대 7명 ═════════
function seeded(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function withSeed<T>(seed: number, f: () => T): T { const orig = Math.random; Math.random = seeded(seed); try { return f(); } finally { Math.random = orig; } }
const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
interface Daily { date: string; theme: string; desc: string; doubles: boolean; rental: PSet[]; opps: { name: string; title: string; sprite: string; lines: any; team: PSet[]; skill: number }[] }
const THEMES: { name: string; desc: string; doubles?: boolean; opt: (r: () => number) => any }[] = [
	{ name: '렌탈 싱글', desc: '렌탈 6마리 중 3마리로 7연전', opt: () => ({ minBst: 470 }) },
	{ name: '렌탈 더블', desc: '렌탈 6마리 중 4마리로 더블 7연전', doubles: true, opt: () => ({ minBst: 470 }) },
	{ name: '타입 축제', desc: '렌탈과 상대가 모두 한 타입', opt: r => ({ types: [ALL_TYPES.filter(t => t !== 'Stellar')[Math.floor(r() * 18)]], minBst: 400 }) },
	{ name: '언더독', desc: '종족값 500 이하 포켓몬만', opt: () => ({ maxBst: 500, minBst: 380 }) },
	{ name: '강자의 날', desc: '종족값 540 이상 강한 포켓몬끼리', opt: () => ({ minBst: 540, allowSubLegend: true }) },
	{ name: '진화 전 대결', desc: '진화 전·중간 진화 포켓몬만 (진화의휘석 허용)', opt: () => ({ stage: 'nfe' }) },
];
function makeDaily(date: string): Daily {
	const seed = [...date].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
	return withSeed(seed, () => {
		const r = Math.random;
		const th = THEMES[Math.floor(r() * THEMES.length)];
		const o = th.opt(r);
		const label = th.name === '타입 축제' ? `${typeKo(o.types[0])} 타입 축제` : th.name;
		const rental = withLevel(randomTeam({ gen: 9, size: 6, doubles: th.doubles, quality: 0.6, ...o }), 50);
		const opps = Array.from({ length: 7 }, (_, i) => {
			const tr = randomTrainer(i < 3 ? 'any' : i < 6 ? 'grown' : 'expert');
			const team = withLevel(randomTeam({ gen: 9, size: 6, doubles: th.doubles, quality: 0.4 + i * 0.08, ...o, exclude: new Set(rental.map(x => toID(x.species))) }), 50);
			return { name: tr.name, title: i === 6 ? '오늘의 강자' : tr.className, sprite: tr.sprite, lines: tr.lines, team, skill: Math.min(0.95, 0.6 + i * 0.06) };
		});
		return { date, theme: label, desc: th.desc, doubles: !!th.doubles, rental, opps };
	});
}
let dailyCache: Daily | null = null;
/** 오늘의 도전 (날짜가 바뀌기 전까지 한 번만 만듦 — 메인 화면이 그릴 때마다 팀 8개를 뽑지 않게) */
export const todayDaily = () => { const k = dateKey(); if (dailyCache?.date !== k) dailyCache = makeDaily(k); return dailyCache; };
/** 오늘의 도전 진행 저장 (같은 날이면 쉬었다가 이어서) */
interface DailyRun { date: string; idx: number }
const DAILY_KEY = 'daily-run';
export async function runDaily() {
	const d = todayDaily();
	const best = (load<any>('stats', {}).daily || {})[d.date] || 0;
	const n = d.doubles ? 4 : 3;
	let run = load<DailyRun | null>(DAILY_KEY, null);
	if (run && run.date !== d.date) { remove(DAILY_KEY); run = null; }   // 지난 날 진행은 버림
	const start = await ask<'new' | 'resume' | 'back'>(r => <InfoScreen title="오늘의 도전" banner={`📅 ${d.date}`} heading={`오늘의 테마: ${d.theme}`}
		lines={[d.desc, '오늘은 누구나 같은 렌탈 6마리와 같은 상대 7명을 만납니다. 배틀마다 상대 엔트리를 보고 참가 포켓몬을 고르세요.', `오늘 최고 기록: ${best}승 / 7`,
			...(run ? [`쉬는 중인 도전: ${run.idx}승 (${run.idx + 1}번째 승부부터)`] : []), '여러 번 도전할 수 있고, 가장 좋은 기록이 남습니다. 도중에 쉬었다가 같은 날 이어서 할 수 있어요.']}
		sprites={d.rental.map(s => s.species)} sets={d.rental} gen={9}
		actions={[...(run ? [{ label: `이어서 (${run.idx + 1}번째 승부)`, onClick: () => r('resume') }, { label: '처음부터', kind: 'ghost' as const, onClick: () => r('new') }] : [{ label: '도전한다', onClick: () => r('new') }]),
			{ label: '돌아가기', kind: 'ghost', onClick: () => r('back') }]} />);
	if (start === 'back') return;
	if (start === 'new' || !run) { run = { date: d.date, idx: 0 }; save(DAILY_KEY, run); }
	// 참가 기록 (연속 참가)
	updateStats(s => {
		if (s.dailyLast !== d.date) {
			const y = new Date(); y.setDate(y.getDate() - 1);
			s.dailyStreak = s.dailyLast === dateKey(y) ? s.dailyStreak + 1 : 1; s.dailyLast = d.date;
			setMax(s, 'dailyStreakMax', s.dailyStreak);
			if (s.dailyStreak % 7 === 0) setTimeout(() => earnBP(10, `오늘의 도전 ${s.dailyStreak}일 연속`), 0);
		}
		s.daily[d.date] = s.daily[d.date] || 0;
	});
	const r0 = run;
	let ended: 'lose' | 'clear' | 'quit' = 'clear';
	while (r0.idx < d.opps.length) {
		const i = r0.idx, opp = d.opps[i];
		// 승부 전 화면: 승부한다 / 쉬기(저장 후 나가기) / 그만두기
		const go = await confirmQuit(() => ask<'go' | 'rest' | 'quit'>(r => <InfoScreen title={`오늘의 도전 · ${d.theme}`} banner={`${i + 1} / 7번째 승부`} prep={<BgmRow />}
			heading={`${opp.title} ${opp.name}${josa(opp.name)} 승부를 걸어왔다!`} trainer={opp.sprite}
			lines={[`현재 ${i}승`, `“${opp.lines.intro}”`]} sprites={opp.team.map(s => s.species)} sets={opp.team} gen={9}
			actions={[{ label: '승부한다', onClick: () => r('go') }, { label: '쉬기 (저장 후 나가기)', kind: 'ghost', onClick: () => r('rest') }, { label: '그만두기', kind: 'danger', onClick: () => r('quit') }]} />),
			'quit', `오늘의 도전을 ${i}승에서 끝낼까요? (최고 기록은 남고, 오늘 다시 처음부터 도전할 수 있어요)`);
		if (go === 'rest') { save(DAILY_KEY, r0); return; }
		if (go === 'quit') { ended = 'quit'; break; }
		const picked = await ask<PSet[] | typeof BACK>(r => <PickScreen title={`${i + 1}번째 · 참가 포켓몬 ${n}마리`} team={d.rental} gen={9} count={n}
			opponent={{ name: `${opp.title} ${opp.name}`, team: opp.team }} onBack={() => r(BACK)} onDone={r} />);
		if (picked === BACK) continue;   // 승부 전 화면으로
		const oppPick = aiPickEntry(opp.team, d.rental, n, d.doubles, opp.skill, false);
		const res = await battle({ gen: 9, doubles: d.doubles, aiSkill: opp.skill, bg: 'daily' as any, music: (i === 6 ? 'boss' : 'daily') as any, label: `오늘의 도전 ${i + 1}번째`,
			p1: { name: playerName(), team: picked.map(cloneSet), sprite: playerSprite() }, p2: { name: opp.name, title: opp.title, team: oppPick, sprite: opp.sprite, line: opp.lines.intro, lines: opp.lines } });
		if (!res.win) { ended = 'lose'; break; }
		r0.idx++; save(DAILY_KEY, r0);
		const w = r0.idx;
		updateStats(s => { s.daily[d.date] = Math.max(s.daily[d.date] || 0, w); });
	}
	remove(DAILY_KEY);
	const wins = r0.idx;
	if (wins >= 7 && !load<any>('stats', {}).flags?.['dailyDone:' + d.date]) { updateStats(s => { s.flags['dailyDone:' + d.date] = 1; }, false); earnBP(5, '오늘의 도전 완주'); }
	await ask<void>(r => <InfoScreen title="오늘의 도전" banner={wins >= 7 ? '🏆 완주!' : `${wins}승`} heading={wins >= 7 ? '오늘의 도전을 완주했다!' : ended === 'quit' ? '오늘의 도전을 그만뒀다' : '오늘의 도전 종료'}
		lines={[`오늘 최고 기록: ${Math.max(best, wins)}승 / 7`, `연속 참가 ${load<any>('stats', {}).dailyStreak || 1}일째`]} actions={[{ label: '확인', onClick: () => r() }]} />);
}

// ═════════ 보스 러시: 지방 클리어(관장 → 사천왕 → 챔피언) + 시나리오 코스(악의 조직 보스·간부, 역대 챔피언) ═════════
const conquestList = (region: string) => region === '애니메이션' ? [] : NAMED.filter(t => t.region === region && ['leader', 'elite', 'champion'].includes(t.role)).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
const COURSES: { id: string; name: string; desc: string; color: string; list: () => NamedTrainer[] }[] = [
	{ id: 'villain', name: '악의 조직 보스', desc: '역대 악의 조직 보스 전원', color: '#6a1a2a', list: () => NAMED.filter(t => t.role === 'boss' && t.region !== '애니메이션').sort((a, b) => a.id.localeCompare(b.id)) },
	{ id: 'admin', name: '악의 조직 간부', desc: '역대 악의 조직 간부 전원', color: '#4a2a5a', list: () => NAMED.filter(t => t.role === 'admin' && t.region !== '애니메이션').sort((a, b) => a.id.localeCompare(b.id)) },
	{ id: 'champion', name: '역대 챔피언', desc: '모든 지방 챔피언 전원', color: '#9a7a1a', list: () => NAMED.filter(t => t.role === 'champion' && t.region !== '애니메이션').sort((a, b) => a.id.localeCompare(b.id)) },
];
for (const c of COURSES) BOSS_LEN[c.id] = c.list().length;
type RushKind = { kind: 'region' | 'course'; id: string };
interface RushRun extends RushKind { hard: boolean; team: PSet[]; idx: number }
const RUSH_KEY = 'rush-run';
const rushList = (k: RushKind) => k.kind === 'region' ? conquestList(k.id) : COURSES.find(c => c.id === k.id)!.list();
const rushName = (k: RushKind) => k.kind === 'region' ? `${regionLabel(k.id as any)} 클리어` : `${COURSES.find(c => c.id === k.id)!.name} 러시`;
type GauntletEnd = 'clear' | 'rest' | 'quit' | 'lose';
async function gauntlet(title: string, list: NamedTrainer[], run: RushRun): Promise<GauntletEnd> {
	while (run.idx < list.length) {
		const t = list[run.idx];
		const oppTeam = withLevel(namedTeam(t, 6), 50);
		if (run.hard) oppTeam.forEach(s => { s.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }; });
		const last = run.idx === list.length - 1;
		const go = await confirmQuit(() => ask<'go' | 'rest' | 'quit'>(r => <InfoScreen title={title} banner={`${run.idx + 1} / ${list.length}${last ? ' · 마지막!' : ''}`} prep={<BgmRow />}
			heading={`${namedTitle(t)} ${t.name}${josa(t.name)} 기다리고 있다!`} trainer={namedSprite(t)}
			lines={[`“${t.line}”`, `남은 상대: ${list.slice(run.idx).map(x => x.name).join(' → ')}`, ...(run.hard ? ['🔥 어려움: 상대 개체값 최대 · AI 최고 실력'] : [])]}
			sprites={run.team.map(s => s.species)} sets={run.team} gen={9}
			actions={[{ label: '승부한다', onClick: () => r('go') }, { label: '쉬기 (저장 후 나가기)', kind: 'ghost', onClick: () => r('rest') }, { label: '그만두기', kind: 'danger', onClick: () => r('quit') }]} />),
			'quit', '지금까지의 진행이 사라집니다. 정말 그만둘까요?');
		if (go === 'rest') return 'rest';
		if (go === 'quit') { remove(RUSH_KEY); return 'quit'; }
		const picked = await ask<PSet[] | typeof BACK>(r => <PickScreen title="참가 포켓몬 3마리" team={run.team} gen={9} count={Math.min(3, run.team.length)} opponent={{ name: t.name, team: oppTeam }} onBack={() => r(BACK)} onDone={r} />);
		if (picked === BACK) continue;   // 승부 전 화면으로 (쉬기·그만두기 가능)
		const strong = ['champion', 'boss', 'hero'].includes(t.role);
		const skill = run.hard ? 0.97 : strong ? 0.92 : t.role === 'elite' ? 0.88 : 0.8;
		const res = await battle({ gen: 9, doubles: false, aiSkill: skill, bg: (last || t.role === 'champion' ? 'champion' : 'rush') as any, label: `${title} ${run.idx + 1}/${list.length}`,
			music: (last ? namedMusic(t) : 'rush') as any,
			p1: { name: playerName(), team: picked, sprite: playerSprite() }, p2: { name: t.name, title: namedTitle(t), team: aiPickEntry(oppTeam, run.team, 3, false, skill, true), line: t.line, sprite: namedSprite(t), lines: namedLines(t) } });
		if (!res.win) {
			remove(RUSH_KEY);
			await ask<void>(r => <InfoScreen title={title} heading={`${t.name}에게 졌다…`} banner={`${run.idx}명 격파`} trainer={namedSprite(t)} lines={[`“${namedLines(t).win}”`, '처음부터 다시 도전할 수 있어요.']} actions={[{ label: '확인', onClick: () => r() }]} />);
			return 'lose';
		}
		updateRecords(r => { r.named[t.id] = (r.named[t.id] || 0) + 1; });
		run.idx++; save(RUSH_KEY, run);
	}
	remove(RUSH_KEY);
	return 'clear';
}
export async function runBossRush() {
	const saved = load<RushRun | null>(RUSH_KEY, null);
	const st = loadStats();
	const savedTag = (k: RushKind) => saved && saved.kind === k.kind && saved.id === k.id ? `진행 중 ${saved.idx}/${rushList(saved).length}` : undefined;
	const options = [
		...REGIONS.filter(reg => conquestList(reg).length >= 4).map(reg => ({ value: { kind: 'region', id: reg } as RushKind, group: '지방 클리어 · 관장 → 사천왕 → 챔피언', color: REGION_COLOR[reg],
			label: regionLabel(reg), desc: `${conquestList(reg).length}연전`, icon: <img class="trainer-icon" src={SPRITE_URL(namedSprite(conquestList(reg)[conquestList(reg).length - 1]))} onError={trainerImgError} />,
			badge: savedTag({ kind: 'region', id: reg }) || (st.conquest[reg] === 2 ? '★★ 어려움 클리어' : st.conquest[reg] ? '★ 클리어' : undefined) })),
		...COURSES.map(c => ({ value: { kind: 'course', id: c.id } as RushKind, group: '시나리오 러시', color: c.color, label: c.name, desc: `${c.desc} · ${BOSS_LEN[c.id]}연전`,
			icon: <img class="trainer-icon" src={SPRITE_URL(namedSprite(c.list()[0]))} onError={trainerImgError} />,
			badge: savedTag({ kind: 'course', id: c.id }) || (st.boss[c.id] ? `최고 ${st.boss[c.id]}/${BOSS_LEN[c.id]}` : undefined) })),
	];
	const pick = await ask<RushKind | typeof BACK>(r => <ChoiceScreen title="보스 러시" onBack={() => r(BACK)}
		intro={<p class="hint">강적들과 <b>같은 6마리</b>로 연전합니다. 배틀마다 상대 엔트리를 보고 3마리를 고르며, 한 번이라도 지면 처음부터예요. 쉬었다가 이어서 할 수 있어요 (진행은 한 코스만 저장).</p>}
		options={options} onPick={r} />);
	if (pick === BACK) return;
	let run = saved && saved.kind === pick.kind && saved.id === pick.id ? saved : null;
	if (!run) {
		if (saved && !(await ask<boolean>(r => <InfoScreen title="보스 러시" heading="진행 중인 다른 코스가 있습니다" lines={[`${rushName(saved)} ${saved.idx}/${rushList(saved).length}`, '새 코스를 시작하면 그 진행은 사라집니다.']}
			actions={[{ label: '새로 시작', kind: 'danger', onClick: () => r(true) }, { label: '돌아가기', kind: 'ghost', onClick: () => r(false) }]} />))) return;
		const hard = await ask<boolean | typeof BACK>(r => <ChoiceScreen title={rushName(pick)} onBack={() => r(BACK)}
			options={[{ value: false, label: '보통', desc: '역할에 맞는 AI 실력', icon: '⭐' }, { value: true, label: '어려움', desc: '모든 상대 개체값 최대 · AI 최고 실력', icon: '🔥' }]} onPick={r} />);
		if (hard === BACK) return;
		const team = await chooseTeam(9, `${rushName(pick)} · 팀 등록 (6마리 권장)`, true, false, 50);
		if (team === BACK) return;
		run = { ...pick, hard, team: team.map(cloneSet), idx: 0 };
		save(RUSH_KEY, run);
	}
	const r0 = run, list = rushList(r0);
	const end = await gauntlet(rushName(r0), list, r0);
	updateStats(s => {
		if (r0.kind === 'course') s.boss[r0.id] = Math.max(s.boss[r0.id] || 0, r0.idx);
		if (end === 'clear' && r0.kind === 'region') s.conquest[r0.id] = Math.max(s.conquest[r0.id] || 0, r0.hard ? 2 : 1) as 1 | 2;
	});
	if (end === 'clear') earnBP(r0.kind === 'region' ? (r0.hard ? 25 : 15) : 15, r0.kind === 'region' ? '지방 클리어' : '보스 러시 완주');
	if (end === 'clear') await ask<void>(r => <InfoScreen title="보스 러시" banner="🏆 완주!" heading={r0.kind === 'region' ? `${regionLabel(r0.id as any)}의 정점에 섰다!` : `${rushName(r0)}를 돌파했다!`}
		sprites={r0.team.map(s => s.species)} sets={r0.team} gen={9} lines={[`${list.length}연전 완주${r0.hard ? ' (어려움)' : ''}`]} actions={[{ label: '확인', onClick: () => r() }]} />);
}
