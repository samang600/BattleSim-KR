/**
 * Pokémon Showdown 시뮬레이터는 Node 에서 `require(동적경로)` 로 데이터를 읽는다.
 * 브라우저에서는 그럴 수 없으므로, 필요한 데이터 모듈을 정적으로 묶어 두고
 * 전역 `require` 를 흉내 내 경로 → 모듈을 돌려준다.
 */
import * as base_abilities from '../../../data/abilities';
import * as base_aliases from '../../../data/aliases';
import * as base_conditions from '../../../data/conditions';
import * as base_formatsdata from '../../../data/formats-data';
import * as base_items from '../../../data/items';
import * as base_moves from '../../../data/moves';
import * as base_natures from '../../../data/natures';
import * as base_pokedex from '../../../data/pokedex';
import * as base_rulesets from '../../../data/rulesets';
import * as base_scripts from '../../../data/scripts';
import * as base_typechart from '../../../data/typechart';

import * as rb_gen9 from '../../../data/random-battles/gen9/teams';

import * as formats from './formats';
import CHAMP from './champions-moves.json';
import { Conditions as CHAMP_CONDITIONS } from '../../../data/mods/champions/conditions';
import { Moves as CHAMP_MOD_MOVES } from '../../../data/mods/champions/moves';
import { Abilities as CHAMP_MOD_ABILITIES } from '../../../data/mods/champions/abilities';

/** 포켓몬 챔피언스 PP: 5→8, 10→12, 15→16, 20 이상→20 (1 같은 특수값은 그대로) */
export function championsPP(pp: number) { return pp >= 20 ? 20 : pp >= 15 ? 16 : pp >= 10 ? 12 : pp >= 5 ? 8 : pp; }

/** Showdown 의 champions 모드 데이터(inherit 방식)를 기본 데이터에 덮어씀. isNonstandard(챔피언스에 없는 것 표시)는 내셔널 도감 규칙이라 무시,
 *  값이 undefined 인 키는 그 동작을 없앰(예: 트림의 '나무열매를 먹어야 함' 제한), condition 은 inherit 이면 합침 */
export function applyChampionsMod(table: { [id: string]: any }, mod: { [id: string]: any }) {
	for (const [id, patch] of Object.entries(mod)) {
		const t = table[id];
		if (!t) continue;
		for (const [k, v] of Object.entries(patch)) {
			if (k === 'inherit' || k === 'isNonstandard') continue;
			if (k === 'condition' && (v as any)?.inherit && t.condition) { const { inherit, ...rest } = v as any; t.condition = { ...t.condition, ...rest }; }
			else t[k] = v;
		}
	}
}

/** 포켓몬 챔피언스 기술 사양 적용 (basePower·accuracy·type·secondary·self·boosts·flags·target·critRatio·ignoreAbility) */
export function applyChampionsMoves(Moves: { [id: string]: any }) {
	// 1) Showdown champions 모드의 기술 변경 (위력·명중·PP·앙코르·사슬묶기·저주·배수의진·속이다 첫 턴 제한 등)
	applyChampionsMod(Moves, CHAMP_MOD_MOVES as any);
	// 2) 앱 자체 목록 (Serebii 'Updated Attacks' — 겹치는 기술은 값이 같음)
	for (const [id, patch] of Object.entries(CHAMP as { [id: string]: any })) {
		if (id.startsWith('_')) continue;
		const m = Moves[id];
		if (!m) continue;
		for (const [k, v] of Object.entries(patch)) {
			if (k === 'secondary') { const sec = { ...(m.secondary || {}) }; for (const [sk, sv] of Object.entries(v as any)) if (sv !== '__keep__') sec[sk] = sv; m.secondary = sec; }
			else if (k === 'flags') m.flags = { ...(m.flags || {}), ...(v as any) };
			else if (k === 'self') m.self = { ...(m.self || {}), ...(v as any) };
			else m[k] = v;
		}
	}
	// PP: 챔피언스는 PP업 없이 5→8, 10→12, 15→16, 20 이상→20 (Pokébase 자료)
	for (const m of Object.values(Moves)) {
		if (!m || typeof m.pp !== 'number') continue;
		m.pp = championsPP(m.pp);
		m.noPPBoosts = true;
	}
	// 은혜갚기·화풀이: 친밀도와 관계없이 항상 102 (시뮬레이터가 요청 문자열에 콜백 값을 붙이므로 콜백은 남겨 둠)
	for (const id of ['return', 'frustration']) if (Moves[id]) { Moves[id].basePower = 102; Moves[id].basePowerCallback = () => 102; }
	// 소금절이: 매 턴 1/16 (물·강철 타입은 1/8) — 본가는 1/8·1/4
	if (Moves.saltcure?.condition) {
		Moves.saltcure.condition.onResidual = function (this: any, pokemon: any) {
			this.damage(pokemon.baseMaxhp / (pokemon.hasType(['Water', 'Steel']) ? 8 : 16));
		};
	}
}
applyChampionsMoves((base_moves as any).Moves);

/** 포켓몬 챔피언스 상태이상 (Showdown 의 champions 모드와 같음):
 *  마비 — 행동 불능 1/8 (본가 1/4) / 잠듦 — 2~3턴 (2턴째에 깰 확률 1/3, 본가 1~3턴) / 얼음 — 최대 3턴, 매 턴 1/4 로 녹음 (본가 1/5, 상한 없음)
 *  화상·독·맹독 등 지속 데미지는 본가와 같아 그대로 */
export function applyChampionsConditions(Conditions: { [id: string]: any }) {
	for (const [id, patch] of Object.entries(CHAMP_CONDITIONS as { [id: string]: any })) {
		if (!Conditions[id]) continue;
		const { inherit, ...rest } = patch;
		Object.assign(Conditions[id], rest);
	}
}
applyChampionsConditions((base_conditions as any).Conditions);
/** 포켓몬 챔피언스 특성 (재생력·자연회복·치유의마음·보이지않는주먹·도주·분노의껍질·발끈·위기회피·도망태세) */
applyChampionsMod((base_abilities as any).Abilities, CHAMP_MOD_ABILITIES as any);

export const MODS: string[] = [];

const REGISTRY: { [path: string]: any } = {
	'/ps/data/abilities': base_abilities,
	'/ps/data/aliases': base_aliases,
	'/ps/data/conditions': base_conditions,
	'/ps/data/formats-data': base_formatsdata,
	'/ps/data/items': base_items,
	'/ps/data/moves': base_moves,
	'/ps/data/natures': base_natures,
	'/ps/data/pokedex': base_pokedex,
	'/ps/data/rulesets': base_rulesets,
	'/ps/data/scripts': base_scripts,
	'/ps/data/typechart': base_typechart,

	'/ps/data/random-battles/gen9/teams': rb_gen9,

	'/ps/config/formats': formats,
};

function normalize(p: string, from = '/ps/sim') {
	const parts = (p.startsWith('/') ? p : from + '/' + p).split('/');
	const out: string[] = [];
	for (const part of parts) {
		if (!part || part === '.') continue;
		if (part === '..') out.pop();
		else out.push(part);
	}
	return '/' + out.join('/').replace(/\.(ts|js)$/, '');
}

function notFound(p: string) {
	const e: any = new Error(`Cannot find module '${p}'`);
	e.code = 'MODULE_NOT_FOUND';
	return e;
}

const fakeRequire: any = (p: string) => {
	if (p === 'node:crypto' || p === 'crypto') return globalThis.crypto;
	const key = normalize(p);
	const mod = REGISTRY[key];
	if (!mod) throw notFound(p);
	return mod;
};
fakeRequire.resolve = (p: string) => {
	const key = normalize(p);
	if (!REGISTRY[key]) throw notFound(p);
	return key;
};

(globalThis as any).__psRequire = fakeRequire;
