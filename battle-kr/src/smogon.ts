/** Smogon 사용률 통계(src/gen/smogon.json, scripts/fetch-smogon.py)로
 *  - 실전형 세트(기술·도구·특성·성격·능력 포인트·테라)를 만들고
 *  - 팀을 짤 때 자주 같이 쓰는 포켓몬을 고르고
 *  - 6→3/6→4 참가 선택에서 상대 팀을 보고 유리한 포켓몬을 고른다. */
import SMOGON from './gen/smogon.json';
import { RAW, speciesData, learnset, moveData, toID, type Gen } from './data';
import { ruleById, megaStoneAllowed, type BattleRule } from './rules';
import { loadSettings } from './store';
import { evToSp, spToEv, fillSP, type PSet } from './sets';
import { Dex } from '../../sim/dex';

type Pair = [string, number];
interface Entry { u: number; m?: Pair[]; i?: Pair[]; a?: Pair[]; s?: Pair[]; t?: Pair[]; tm?: Pair[]; cc?: Pair[] }
const DB = SMOGON as any as { _month: string; s: { [id: string]: Entry }; d: { [id: string]: Entry }; cs: { [id: string]: Entry }; cd: { [id: string]: Entry } };
export const SMOGON_MONTH = DB._month;

const isChampions = (rule: BattleRule) => rule.id.startsWith('champ');
/** 통계 사용 여부 (자체 대전 비교용으로 끌 수 있음) */
export let smogonEnabled = true;
export function setSmogon(on: boolean) { smogonEnabled = on; }
/** 규칙·싱글/더블에 맞는 통계 (없으면 가까운 묶음으로) */
export function statsFor(speciesId: string, doubles: boolean, rule: BattleRule = ruleById(loadSettings().battleRule)): Entry | null {
	const id = toID(speciesId);
	const base = RAW.species[id]?.base ? toID(RAW.species[id].base) : '';
	const order: ('s' | 'd' | 'cs' | 'cd')[] = isChampions(rule)
		? (doubles ? ['cd', 'cs', 'd', 's'] : ['cs', 'cd', 's', 'd'])
		: (doubles ? ['d', 's', 'cd', 'cs'] : ['s', 'd', 'cs', 'cd']);
	for (const g of order) {
		const e = DB[g][id] || (base ? DB[g][base] : undefined);
		if (e && e.m && e.m.length >= 4) return e;
	}
	return null;
}

function shuffle<T>(a: T[]): T[] { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** 가중치 뽑기. quality 가 높을수록 자주 쓰는 선택지로 쏠림 (0: 비율 그대로, 1: 거의 1위) */
function weightedPick<T extends Pair>(list: T[], quality: number, skip?: (k: string) => boolean): T | null {
	const xs = list.filter(p => !skip?.(p[0]));
	if (!xs.length) return null;
	const k = 0.7 + 2.6 * quality;
	const ws = xs.map(p => Math.pow(Math.max(1, p[1]), k));
	let r = Math.random() * ws.reduce((a, b) => a + b, 0);
	for (let i = 0; i < xs.length; i++) { r -= ws[i]; if (r <= 0) return xs[i]; }
	return xs[xs.length - 1];
}

function itemOk(itemId: string, speciesId: string, rule: BattleRule): boolean {
	const it = RAW.items[itemId];
	if (!it) return false;
	if (it.mega) return megaStoneAllowed(rule, itemId) && (it.megaFrom || []).map(toID).includes(toID(RAW.species[toID(speciesId)]?.base || speciesId));
	if (it.zt || it.zu) return rule.kinds.includes('zmove');
	return true;
}

/** 통계로 세트를 만든다. 통계가 없으면 null (호출한 쪽이 기존 방식으로) */
export function smogonSet(speciesId: string, gen: Gen, level: number, doubles: boolean, quality = 0.5, rule: BattleRule = ruleById(loadSettings().battleRule)): PSet | null {
	const id = toID(speciesId);
	if (!smogonEnabled) return null;
	const e = statsFor(id, doubles, rule);
	const sd = speciesData(id, gen);
	if (!e || !sd) return null;
	// 기술: 배울 수 있는 것만, 4개 (공격 기술 최소 1개)
	const legal = new Set(learnset(id, gen));
	const okMove = (m: string) => legal.has(m) && !!moveData(m, gen);
	const moves: string[] = [];
	const pool = (e.m || []).filter(p => okMove(p[0]));
	while (moves.length < 4) {
		const p = weightedPick(pool, quality, k => moves.includes(k));
		if (!p) break;
		moves.push(p[0]);
	}
	if (moves.length < 2) return null;
	if (!moves.some(m => moveData(m, gen)!.category !== 'Status')) {
		const atk = pool.find(p => moveData(p[0], gen)!.category !== 'Status');
		if (atk) moves[moves.length - 1] = atk[0];
	}
	const item = weightedPick(e.i || [], quality, k => !itemOk(k, id, rule))?.[0] || 'leftovers';
	const abil = sd.ab.map(toID);
	const ability = weightedPick(e.a || [], quality, k => !abil.includes(k))?.[0] || abil[0];
	// 성격·능력 포인트: "Jolly:0/252/0/0/4/252" (EV) 또는 챔피언스 "Jolly:2/32/0/0/0/32" (SP)
	const sp = weightedPick(e.s || [], quality)?.[0] || '';
	const [nat, nums] = sp.split(':');
	const vals = (nums || '').split('/').map(n => parseInt(n, 10) || 0);
	const isSP = vals.length === 6 && Math.max(...vals) <= 32;
	const keys = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
	const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
	if (vals.length === 6) keys.forEach((k, i) => { evs[k] = isSP ? spToEv(vals[i]) : spToEv(evToSp(vals[i])); });
	const tera = weightedPick(e.t || [], quality)?.[0];
	const teraType = tera ? tera.charAt(0).toUpperCase() + tera.slice(1) : sd.t[0];
	const set: PSet = {
		name: '', species: sd.en, item, ability, moves, nature: toID(nat) || 'serious', evs,
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level, teraType: teraType === 'Stellar' ? sd.t[0] : teraType,
	};
	return fillSP(set);
}

/** 이미 고른 포켓몬과 자주 같이 쓰이는 포켓몬을 후보 중에서 고른다 (없으면 null) */
export function synergyPick(picked: string[], candidates: Set<string>, doubles: boolean, quality: number): string | null {
	if (!smogonEnabled) return null;
	const score: { [id: string]: number } = {};
	for (const p of picked) {
		for (const [mate, pct] of statsFor(p, doubles)?.tm || []) {
			if (candidates.has(mate)) score[mate] = (score[mate] || 0) + pct;
		}
	}
	const list = Object.entries(score) as Pair[];
	if (!list.length) return null;
	return weightedPick(list, quality)?.[0] || null;
}

// ── 6→3 / 6→4 참가 선택 ──
/** 타입 상성 배율 (시뮬레이터 Dex 를 씀) */
function eff(dex: any, atkType: string, defTypes: string[]): number {
	try { return dex.getImmunity(atkType, defTypes) ? Math.pow(2, dex.getEffectiveness(atkType, defTypes)) : 0; } catch { return 1; }
}
/** 공개된 정보만으로 보는 공격 타입: 내 세트는 실제 기술, 상대는 자속 + 통계상 자주 쓰는 공격 기술 */
function attackTypes(set: PSet, own: boolean, doubles: boolean): { type: string; pow: number }[] {
	const sd = speciesData(set.species, 9);
	const out: { type: string; pow: number }[] = [];
	const moves = own ? set.moves : (statsFor(set.species, doubles)?.m || []).filter(p => p[1] >= 20).map(p => p[0]);
	for (const m of moves) {
		const md = moveData(m, 9);
		if (!md || md.category === 'Status' || md.basePower < 40) continue;
		out.push({ type: md.type, pow: Math.min(150, md.basePower) * (sd?.t.includes(md.type) ? 1.5 : 1) / 100 });
	}
	if (!out.length && sd) for (const t of sd.t) out.push({ type: t, pow: 1.2 });
	return out;
}

/** AI 쪽 참가 포켓몬 고르기: 상대 팀(종족만 보임)에 대한 상성·체크/카운터 점수로 n마리, 에이스(keepLast)는 항상 포함.
 *  skill 이 낮으면 무작위를 섞는다. 반환은 순서대로(선봉 먼저) */
export function aiPickEntry(mine: PSet[], foes: PSet[], n: number, doubles: boolean, skill: number, keepLast = false): PSet[] {
	if (mine.length <= n) return mine;
	if (!smogonEnabled) return [...shuffle(mine.slice(0, keepLast ? -1 : undefined)).slice(0, n - (keepLast ? 1 : 0)), ...(keepLast ? [mine[mine.length - 1]] : [])];
	const dex = Dex.mod('gen9');
	const foeTypes = foes.map(f => speciesData(f.species, 9)?.t || ['Normal']);
	const myTypes = mine.map(s => speciesData(s.species, 9)?.t || ['Normal']);
	const score = mine.map((s, i) => {
		let sc = 0;
		const myAtk = attackTypes(s, true, doubles);
		const myStats = statsFor(s.species, doubles);
		foes.forEach((f, j) => {
			const off = Math.max(...myAtk.map(a => a.pow * eff(dex, a.type, foeTypes[j])), 0);
			const def = Math.max(...attackTypes(f, false, doubles).map(a => a.pow * eff(dex, a.type, myTypes[i])), 0);
			sc += off - def * 0.9;
			// Smogon 체크·카운터: 내가 상대를 잡는 포켓몬이면 +, 상대가 나를 잡으면 −
			const fid = toID(f.species), sid = toID(s.species);
			const iCheck = statsFor(f.species, doubles)?.cc?.find(p => p[0] === sid);
			const theyCheck = myStats?.cc?.find(p => p[0] === fid);
			if (iCheck) sc += iCheck[1] / 40;
			if (theyCheck) sc -= theyCheck[1] / 40;
		});
		// 실력이 낮으면 판단이 흐려짐
		sc += (Math.random() - 0.5) * 6 * (1 - skill);
		return { s, i, sc };
	});
	const last = keepLast ? score[score.length - 1] : null;
	const ranked = score.filter(x => x !== last).sort((a, b) => b.sc - a.sc);
	const chosen = ranked.slice(0, n - (last ? 1 : 0));
	if (last) chosen.push(last);
	// 선봉: 상대 전체에 가장 유리한 포켓몬 (에이스는 맨 뒤 유지)
	return chosen.map(x => x.s);
}
