/** PokéDB(sv.pokedb.tokyo) 공개 데이터: 스칼렛·바이올렛 랭크배틀 상위 트레이너가 실제로 쓴 6마리·도구·테라타입.
 *  기술·성격·능력 포인트는 Smogon 통계로 채워 고난도 상대(랭크 상위, 타워 후반, 프리 배틀 '상위 랭커 팀')에 쓴다.
 *  데이터: scripts/fetch-pokedb.cjs → src/gen/pokedb-teams.json */
import TEAMS from './gen/pokedb-teams.json';
import { RAW, speciesData, nickKo, type Gen } from './data';
import { ruleById, speciesAllowed, megaStoneAllowed } from './rules';
import { loadSettings } from './store';
import { smogonSet } from './smogon';
import { randomSetFor, dedupeItems, assignGimmicks, type PSet } from './sets';

type Mon = [string, string, string]; // [종족 id, 도구 id, 테라타입]
type Row = [number, number, Mon[]]; // [레이트, 시즌, 6마리]
const DB = TEAMS as any as { _seasons: number[]; s: Row[]; d: Row[] };

export interface RankerTeam { team: PSet[]; rating: number; season: number }

function itemOk(id: string): boolean {
	const it = RAW.items[id];
	if (!it) return false;
	if (it.mega) return megaStoneAllowed(ruleById(loadSettings().battleRule), id);
	return true;
}

/** 지금 규칙에서 쓸 수 있는 상위 팀 수 */
export function rankerCount(doubles: boolean): number {
	const rule = ruleById(loadSettings().battleRule);
	return (doubles ? DB.d : DB.s).filter(r => r[2].every(m => RAW.species[m[0]] && speciesAllowed(rule, m[0]))).length;
}

/** 상위 팀 하나를 실전 세트로. quality 가 높을수록 레이트가 높은 팀을 고르고 세트도 흔한 구성으로 */
export function rankerTeam(doubles: boolean, level = 50, quality = 0.8, gen: Gen = 9): RankerTeam | null {
	const rule = ruleById(loadSettings().battleRule);
	const rows = (doubles ? DB.d : DB.s).filter(r => r[2].every(m => RAW.species[m[0]] && speciesAllowed(rule, m[0])));
	if (!rows.length) return null;
	// 레이트 순위로 가중: quality 1 이면 상위권에 강하게 쏠림
	const sorted = rows.slice().sort((a, b) => b[0] - a[0]);
	const k = 0.5 + 2.5 * quality;
	const ws = sorted.map((_, i) => Math.pow(1 - i / sorted.length, k) + 0.02);
	let r = Math.random() * ws.reduce((a, b) => a + b, 0), row = sorted[0];
	for (let i = 0; i < sorted.length; i++) { r -= ws[i]; if (r <= 0) { row = sorted[i]; break; } }
	const team = row[2].map(([sid, item, tera]) => {
		const set = smogonSet(sid, gen, level, doubles, Math.max(0.7, quality)) || randomSetFor(sid, gen, level, doubles, quality);
		set.name = nickKo(sid);
		if (item && itemOk(item)) set.item = item; // 실제로 쓴 도구
		if (tera && tera !== 'Stellar' && speciesData(sid, gen)) set.teraType = tera;
		return set;
	});
	return { team: dedupeItems(assignGimmicks(team)), rating: row[0], season: row[1] };
}
export const POKEDB_SEASONS = DB._seasons;
