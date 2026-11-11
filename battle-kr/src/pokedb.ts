/** 상위 랭커·대회 팀: 고난도 상대(랭크 상위, 타워 후반, 프리 배틀 '상위 랭커 팀')에 쓴다. 지금 규칙(포켓몬 풀·초전설 등)에 맞는 팀만 고름.
 *  - PokéDB(sv.pokedb.tokyo) 공개 데이터: 스칼렛·바이올렛 랭크배틀 상위 트레이너의 6마리·도구·테라타입 (scripts/fetch-pokedb.cjs → gen/pokedb-teams.json)
 *  - 챔피언스 더블: Limitless 대회 상위 입상 팀 + VGCPastes 저장소 팀, 6마리 세트 전부 (scripts/fetch-ranker-teams.py → gen/ranker-teams.json 'cd')
 *  - 챔피언스 싱글·무제한 싱글/더블: Smogon 통계의 '같이 쓰는 포켓몬'으로 조립한 팀 ('cs' 'us' 'ud')
 *  비어 있는 기술·성격·능력 포인트는 Smogon 통계로 채운다. */
import TEAMS from './gen/pokedb-teams.json';
import RT from './gen/ranker-teams.json';
import { RAW, megaStoneFits, speciesData, nickKo, moveData, type Gen } from './data';
import { speciesAllowed, itemAllowed, megaStoneAllowed, type BattleRule, dataRuleOr } from './rules';
import { loadSettings } from './store';
import { smogonSet } from './smogon';
import { randomSetFor, dedupeItems, assignGimmicks, conformSet, spToEv, type PSet } from './sets';

type Mon = [string, string, string]; // [종족 id, 도구 id, 테라타입]
type Row = [number, number, Mon[]]; // [레이트, 시즌, 6마리]
const DB = TEAMS as any as { _seasons: number[]; s: Row[]; d: Row[] };
/** [종 id, 도구, 특성, 기술, 성격, 능력 포인트 6개 또는 0] — 조립 팀은 [종 id] 만 */
type FullMon = [string, string?, string?, string[]?, string?, (number[] | 0)?];
type TRow = [number, string, string, FullMon[]]; // [점수, 출처, 날짜, 포켓몬들]
const RTD = RT as any as { _src: { [k: string]: string }; cd: TRow[]; cs: TRow[]; us: TRow[]; ud: TRow[] };

export interface RankerTeam { team: PSet[]; label: string; source: string }

interface Cand { score: number; w: number; mons: FullMon[]; label: string; source: string; tera?: string[] }
const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;

function itemOk(id: string, sid: string, rule: BattleRule): boolean {
	const it = RAW.items[id];
	if (!it) return false;
	if (it.mega) return megaStoneAllowed(rule, id) && megaStoneFits(id, sid);
	if (it.zt || it.zu) return rule.kinds.includes('zmove');
	return itemAllowed(rule, id);   // 포켓몬 풀(게임)에 있는 도구
}

const allowed = (rule: BattleRule, mons: { 0: string }[]) => mons.every(m => RAW.species[m[0]] && speciesAllowed(rule, m[0]));
/** 출처마다 점수 순위를 0~1 로 (1 이 가장 높음) */
function ranked<T>(rows: T[], score: (r: T) => number, mk: (r: T, p: number) => Cand): Cand[] {
	const s = rows.slice().sort((a, b) => score(b) - score(a));
	return s.map((r, i) => mk(r, s.length > 1 ? 1 - i / (s.length - 1) : 1));
}

/** 지금 규칙에서 쓸 수 있는 팀 후보 */
function candidates(doubles: boolean): Cand[] {
	const rule = dataRuleOr(loadSettings().battleRule);
	const out: Cand[] = [];
	const pk = (doubles ? DB.d : DB.s).filter(r => allowed(rule, r[2].map(m => [m[0]])));
	out.push(...ranked(pk, r => r[0], (r, p) => ({ score: p, w: 1, mons: r[2].map(m => [m[0], m[1]] as FullMon), tera: r[2].map(m => m[2]),
		label: `시즌 ${r[1]} 상위 구축 · 레이트 ${r[0]}`, source: 'PokéDB 스칼렛·바이올렛 랭크배틀' })));
	const groups: [keyof typeof RTD, number][] = doubles ? [['cd', 1.3], ['ud', 0.6]] : [['cs', 0.6], ['us', 0.6]];
	for (const [g, w] of groups) {
		const rows = (RTD[g] as TRow[]).filter(r => allowed(rule, r[3]));
		out.push(...ranked(rows, r => r[0], (r, p) => ({ score: p, w, mons: r[3], label: g === 'cd' ? `${r[1]} · ${r[2]}` : r[1], source: RTD._src[g] })));
	}
	return out;
}

/** 지금 규칙에서 쓸 수 있는 상위 팀 수 */
export function rankerCount(doubles: boolean): number { return candidates(doubles).length; }

/** 지금 규칙에서 쓰이는 출처 이름 (설명 문구용) */
export function rankerSources(doubles: boolean): string[] {
	const n: { [s: string]: number } = {};
	for (const c of candidates(doubles)) { const s = /^Limitless/.test(c.source) ? 'Limitless·VGCPastes 대회' : /^PokéDB/.test(c.source) ? 'PokéDB 랭크' : 'Smogon 통계 조립'; n[s] = (n[s] || 0) + 1; }
	return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([s, k]) => `${s} ${k}`);
}

/** 상위 팀 하나를 실전 세트로. quality 가 높을수록 순위가 높은 팀을 고르고 세트도 흔한 구성으로 */
export function rankerTeam(doubles: boolean, level = 50, quality = 0.8, gen: Gen = 9): RankerTeam | null {
	const rule = dataRuleOr(loadSettings().battleRule);
	const cs = candidates(doubles);
	if (!cs.length) return null;
	const k = 0.5 + 2.5 * quality;
	const ws = cs.map(c => c.w * (Math.pow(c.score, k) + 0.02));
	let r = Math.random() * ws.reduce((a, b) => a + b, 0), c = cs[0];
	for (let i = 0; i < cs.length; i++) { r -= ws[i]; if (r <= 0) { c = cs[i]; break; } }
	const team = c.mons.map(([sid, item, ability, moves, nature, sp], i) => {
		const set = smogonSet(sid, gen, level, doubles, Math.max(0.7, quality), rule) || randomSetFor(sid, gen, level, doubles, quality);
		set.name = nickKo(sid);
		if (item && itemOk(item, sid, rule)) set.item = item;   // 실제로 쓴 도구
		if (ability && speciesData(sid, gen)?.ab.includes(ability)) set.ability = ability;
		if (moves?.length) {
			const mv = moves.filter(m => moveData(m, gen));
			if (mv.length >= 2) set.moves = [...mv, ...set.moves.filter(m => !mv.includes(m))].slice(0, 4);   // 모자라면 통계 기술로 채움
		}
		if (nature) set.nature = nature;
		if (sp && sp.some(v => v > 0)) STAT_KEYS.forEach((s, j) => set.evs[s] = spToEv(sp[j] || 0));   // 능력 포인트 그대로 (다른 세트와 같은 합계 66 방식)
		const tera = c.tera?.[i];
		if (tera && tera !== 'Stellar' && speciesData(sid, gen)) set.teraType = tera;
		return conformSet(set, gen);
	});
	return { team: dedupeItems(assignGimmicks(team)), label: c.label, source: c.source };
}
