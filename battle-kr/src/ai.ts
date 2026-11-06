/**
 * 상대 트레이너 AI
 * 시뮬레이터 객체를 직접 보고(전지적) 기술 데미지를 대략 계산해 고른다.
 * skill(0~1) 이 낮을수록 실수(무작위 선택)가 잦다.
 */
import { State } from '../../sim/state';
import { PRNG } from '../../sim/prng';
type Battle = any;
type Pokemon = any;

const SLEEP = new Set(['spore', 'sleeppowder', 'hypnosis', 'lovelykiss', 'sing', 'grasswhistle', 'darkvoid', 'yawn']);
const PARA = new Set(['thunderwave', 'stunspore', 'glare']);
const SETUP: { [id: string]: string[] } = {
	swordsdance: ['atk'], nastyplot: ['spa'], dragondance: ['atk', 'spe'], calmmind: ['spa', 'spd'], bulkup: ['atk', 'def'],
	quiverdance: ['spa', 'spd', 'spe'], shellsmash: ['atk', 'spa', 'spe'], agility: ['spe'], rockpolish: ['spe'],
	coil: ['atk', 'def'], shiftgear: ['spe', 'atk'], workup: ['atk', 'spa'], growth: ['atk', 'spa'], honeclaws: ['atk'],
	irondefense: ['def'], amnesia: ['spd'], acidarmor: ['def'], barrier: ['def'], cosmicpower: ['def', 'spd'],
	tailglow: ['spa'], cottonguard: ['def'], autotomize: ['spe'], meditate: ['atk'], sharpen: ['atk'], howl: ['atk'],
	defendorder: ['def', 'spd'], charge: ['spd'], stockpile: ['def', 'spd'], minimize: ['evasion'], doubleteam: ['evasion'],
};
const RECOVER = new Set(['recover', 'roost', 'softboiled', 'slackoff', 'moonlight', 'morningsun', 'synthesis', 'milkdrink',
	'healorder', 'wish', 'rest']);
const HAZARDS: { [id: string]: number } = { stealthrock: 1, spikes: 3, toxicspikes: 2 };
const SCREENS = new Set(['reflect', 'lightscreen', 'safeguard', 'mist', 'luckychant']);
const BAD_DAMAGE = new Set(['focuspunch', 'dreameater', 'lastresort', 'synchronoise', 'snore', 'belch']);

function rand() { return Math.random(); }
/** 능력치 (능력 변화 반영, 특성·도구 이벤트는 실행하지 않음 — 이벤트를 밖에서 부르면 시뮬레이터가 깨짐) */
function st(p: Pokemon, stat: string): number {
	try { return p.getStat(stat, false, true); } catch { return p.storedStats?.[stat] || 100; }
}

/** 거꾸로 배틀(Inverse Mod) 중인지 */
export function isInverse(battle: Battle): boolean {
	try { return battle.ruleTable.has('inversemod'); } catch { return false; }
}
/** 타입 상성 배율 (거꾸로 배틀이면 뒤집음: 무효·반감 → 2배, 약점 → 반감) */
export function typeEffOf(battle: Battle, moveType: string, target: Pokemon | string[]): number {
	const inv = isInverse(battle);
	if (!battle.dex.getImmunity(moveType, target as any)) return inv ? 2 : 0;
	const e = battle.dex.getEffectiveness(moveType, target as any);
	return Math.pow(2, inv ? -e : e);
}
function typeEff(battle: Battle, moveType: string, target: Pokemon) { return typeEffOf(battle, moveType, target); }

function abilityImmune(move: any, moveType: string, target: Pokemon, gen: number): boolean {
	const ab = target.getAbility().id;
	if (target.volatiles['substitute'] && move.category === 'Status' && move.target !== 'self') return true;
	if (moveType === 'Ground' && (ab === 'levitate' || target.volatiles['magnetrise'] || target.hasItem?.('airballoon'))) {
		return move.id !== 'thousandarrows';
	}
	if (moveType === 'Water' && (ab === 'waterabsorb' || ab === 'dryskin' || (gen >= 5 && ab === 'stormdrain'))) return true;
	if (moveType === 'Electric' && (ab === 'voltabsorb' || ab === 'motordrive' || (gen >= 5 && ab === 'lightningrod'))) return true;
	if (moveType === 'Fire' && ab === 'flashfire') return true;
	if (moveType === 'Grass' && ab === 'sapsipper') return true;
	if (ab === 'soundproof' && move.flags?.sound) return true;
	return false;
}

function movePower(battle: Battle, move: any, user: Pokemon, target: Pokemon): number {
	let bp = move.basePower || 0;
	const id = move.id;
	const hpFrac = user.hp / user.maxhp;
	switch (id) {
	case 'lowkick': case 'grassknot': {
		const w = target.species.weighthg / 10;
		bp = w >= 200 ? 120 : w >= 100 ? 100 : w >= 50 ? 80 : w >= 25 ? 60 : w >= 10 ? 40 : 20;
		break;
	}
	case 'heavyslam': {
		const r = user.species.weighthg / Math.max(1, target.species.weighthg);
		bp = r >= 5 ? 120 : r >= 4 ? 100 : r >= 3 ? 80 : r >= 2 ? 60 : 40;
		break;
	}
	case 'gyroball':
		bp = Math.min(150, Math.floor(25 * st(target, 'spe') / Math.max(1, st(user, 'spe'))) + 1);
		break;
	case 'eruption': case 'waterspout': bp = Math.max(1, Math.floor(150 * hpFrac)); break;
	case 'flail': case 'reversal': bp = hpFrac < 0.05 ? 200 : hpFrac < 0.1 ? 150 : hpFrac < 0.2 ? 100 : hpFrac < 0.35 ? 80 : hpFrac < 0.7 ? 40 : 20; break;
	case 'return': bp = 102; break;
	case 'frustration': bp = 102; break;
	case 'facade': if (user.status) bp = 140; break;
	case 'hex': if (target.status) bp = 100; break;
	case 'venoshock': if (target.status === 'psn' || target.status === 'tox') bp = 130; break;
	case 'acrobatics': if (!user.item) bp = 110; break;
	case 'storedpower': bp = 20 + 20 * Object.values(user.boosts as { [k: string]: number }).reduce((a, b) => a + Math.max(0, b), 0); break;
	case 'electroball': {
		const r = st(user, 'spe') / Math.max(1, st(target, 'spe'));
		bp = r >= 4 ? 150 : r >= 3 ? 120 : r >= 2 ? 80 : r >= 1 ? 60 : 40;
		break;
	}
	case 'crushgrip': case 'wringout': bp = Math.max(1, Math.floor(120 * target.hp / target.maxhp)); break;
	case 'punishment': bp = 60; break;
	case 'trumpcard': bp = 50; break;
	case 'magnitude': bp = 71; break;
	case 'present': bp = 40; break;
	case 'naturalgift': bp = 60; break;
	case 'fling': bp = 40; break;
	case 'beatup': bp = 40; break;
	case 'hiddenpower': bp = battle.gen >= 6 ? 60 : 70; break;
	case 'brine': if (target.hp * 2 <= target.maxhp) bp = 130; break;
	case 'assurance': case 'payback': case 'avalanche': case 'revenge': bp = bp * 1.3; break;
	case 'pursuit': bp = 40; break;
	case 'solarbeam': if (battle.field.isWeather('sunnyday')) bp = 120; else bp = 60; break;
	case 'skyattack': case 'razorwind': case 'skullbash': bp /= 2; break;
	case 'hyperbeam': case 'gigaimpact': case 'blastburn': case 'hydrocannon': case 'frenzyplant': case 'roaroftime': case 'rockwrecker':
		bp *= 0.6; break;
	}
	if (move.multihit) {
		const hits = Array.isArray(move.multihit) ? (user.getAbility().id === 'skilllink' ? move.multihit[1] : 3) : move.multihit;
		bp *= hits;
	}
	return bp;
}

/** 기술이 대상에게 주는 데미지 ÷ 대상의 남은 HP (대략) */
export function estimateDamage(battle: Battle, user: Pokemon, target: Pokemon, moveOrId: any): number {
	const move = typeof moveOrId === 'string' ? battle.dex.moves.get(moveOrId) : moveOrId;
	if (!move || !target || target.fainted || !target.hp) return 0;
	if (move.category === 'Status') return 0;
	let moveType = move.type;
	if (move.id === 'hiddenpower') moveType = user.hpType || 'Dark';
	if (move.id === 'weatherball') {
		if (battle.field.isWeather('sunnyday')) moveType = 'Fire';
		else if (battle.field.isWeather('raindance')) moveType = 'Water';
		else if (battle.field.isWeather('sandstorm')) moveType = 'Rock';
		else if (battle.field.isWeather('hail')) moveType = 'Ice';
	}
	if (move.id === 'judgment' && user.species.name.startsWith('Arceus')) moveType = user.getTypes()[0];
	if (abilityImmune(move, moveType, target, battle.gen)) return 0;
	const eff = typeEff(battle, moveType, target);
	if (!eff) return 0;
	if (target.getAbility().id === 'wonderguard' && eff <= 1) return 0;

	// 고정 데미지
	const level = user.level;
	if (move.id === 'seismictoss' || move.id === 'nightshade') return level / target.hp;
	if (move.id === 'dragonrage') return 40 / target.hp;
	if (move.id === 'sonicboom') return 20 / target.hp;
	if (move.id === 'superfang') return 0.5;
	if (move.id === 'endeavor') return Math.max(0, target.hp - user.hp) / target.hp;
	if (move.ohko) return (move.accuracy || 30) / 100 * (target.level > user.level ? 0 : 1) * 1.0;
	if (move.damage === 'level') return level / target.hp;
	if (typeof move.damage === 'number') return move.damage / target.hp;

	const bp = movePower(battle, move, user, target);
	if (!bp) return 0;
	const physical = move.category === 'Physical';
	let atk = st(user, physical ? 'atk' : 'spa');
	let def = st(target, physical ? 'def' : 'spd');
	if (move.id === 'foulplay') atk = st(target, 'atk');
	if (move.id === 'psyshock' || move.id === 'psystrike') def = st(target, 'def');
	const ab = user.getAbility().id;
	if (physical && (ab === 'hugepower' || ab === 'purepower')) atk *= 2;
	if (physical && ab === 'hustle') atk *= 1.5;
	if (physical && user.status === 'brn' && ab !== 'guts') atk *= 0.5;
	if (physical && ab === 'guts' && user.status) atk *= 1.5;
	if (battle.field.isWeather('sandstorm') && !physical && target.hasType('Rock')) def *= 1.5;

	let dmg = Math.floor(Math.floor(Math.floor(2 * level / 5 + 2) * bp * atk / Math.max(1, def)) / 50) + 2;
	let mod = 0.925 * eff;
	if (user.hasType(moveType)) mod *= ab === 'adaptability' ? 2 : 1.5;
	if (ab === 'technician' && bp <= 60) mod *= 1.5;
	if (ab === 'tintedlens' && eff < 1) mod *= 2;
	const tab = target.getAbility().id;
	if ((tab === 'thickfat') && (moveType === 'Fire' || moveType === 'Ice')) mod *= 0.5;
	if ((tab === 'filter' || tab === 'solidrock') && eff > 1) mod *= 0.75;
	if (tab === 'heatproof' && moveType === 'Fire') mod *= 0.5;
	if (tab === 'multiscale' && target.hp === target.maxhp) mod *= 0.5;
	if (battle.field.isWeather('raindance')) mod *= moveType === 'Water' ? 1.5 : moveType === 'Fire' ? 0.5 : 1;
	if (battle.field.isWeather('sunnyday')) mod *= moveType === 'Fire' ? 1.5 : moveType === 'Water' ? 0.5 : 1;
	const item = user.getItem().id;
	if ((item === 'choiceband' && physical) || (item === 'choicespecs' && !physical)) mod *= 1.5;
	if (item === 'lifeorb') mod *= 1.3;
	if (item === 'expertbelt' && eff > 1) mod *= 1.2;
	const side = target.side;
	if (physical && side.sideConditions['reflect'] && !move.infiltrates) mod *= battle.gameType === 'doubles' ? 2 / 3 : 0.5;
	if (!physical && side.sideConditions['lightscreen']) mod *= battle.gameType === 'doubles' ? 2 / 3 : 0.5;
	if (target.volatiles['substitute'] && !move.flags?.bypasssub) mod *= 0.5;
	dmg *= mod;
	const acc = move.accuracy === true ? 1 : (move.accuracy || 100) / 100;
	return (dmg / target.hp) * (0.5 + acc / 2);
}

function foesOf(pokemon: Pokemon): Pokemon[] {
	return pokemon.side.foe.active.filter((p: Pokemon) => p && !p.fainted && p.hp);
}
function allyOf(pokemon: Pokemon): Pokemon | null {
	return pokemon.side.active.find((p: Pokemon) => p && p !== pokemon && !p.fainted && p.hp) || null;
}

/** pokemon 이 foe 상대로 낼 수 있는 최대 데미지 비율 */
function bestDamage(battle: Battle, pokemon: Pokemon, foe: Pokemon) {
	let best = 0;
	for (const slot of pokemon.moveSlots) {
		const d = estimateDamage(battle, pokemon, foe, slot.id);
		if (d > best) best = d;
	}
	return best;
}

/** 교체 후보의 상성 점수 (높을수록 좋음) */
function matchup(battle: Battle, mon: Pokemon, foes: Pokemon[]) {
	let score = 0;
	const hpFrac = mon.hp / mon.maxhp;
	for (const foe of foes) {
		const off = Math.min(1.5, bestDamage(battle, mon, foe));
		// 상대가 나에게 주는 데미지: 상대 기술로 (교체해 들어오는 쪽 HP 기준)
		let def = 0;
		for (const slot of foe.moveSlots) {
			const d = estimateDamage(battle, foe, mon, slot.id);
			if (d > def) def = d;
		}
		const faster = st(mon, 'spe') >= st(foe, 'spe');
		score += off * (faster ? 1.2 : 1) - Math.min(1.5, def) * 1.1;
	}
	return score + hpFrac * 0.3;
}

function statusScore(battle: Battle, user: Pokemon, move: any, target: Pokemon | null, foes: Pokemon[]): number {
	const id = move.id;
	const hpFrac = user.hp / user.maxhp;
	const threat = foes.reduce((m, f) => Math.max(m, bestDamage(battle, f, user)), 0);
	const t = target;
	const lastMove = user.lastMove?.id;
	if (t && t.volatiles['substitute'] && move.target !== 'self' && !move.flags?.bypasssub) return 0;
	if (SLEEP.has(id)) {
		if (!t || t.status || t.side.pokemon.some((p: Pokemon) => p.status === 'slp' && p !== t)) return 5;
		if (id === 'yawn' && t.volatiles['yawn']) return 0;
		if (t.getAbility().id === 'insomnia' || t.getAbility().id === 'vitalspirit') return 0;
		return 85 * ((move.accuracy === true ? 100 : move.accuracy) / 100);
	}
	if (PARA.has(id)) {
		if (!t || t.status) return 0;
		if (id === 'thunderwave' && (t.hasType('Ground') || typeEff(battle, 'Electric', t) === 0)) return 0;
		if (t.hasType('Electric') && battle.gen >= 6) return 0;
		if (t.getAbility().id === 'limber') return 0;
		return st(t, 'spe') > st(user, 'spe') ? 65 : 40;
	}
	if (id === 'willowisp') {
		if (!t || t.status || t.hasType('Fire') || t.getAbility().id === 'flashfire') return 0;
		return st(t, 'atk') > st(t, 'spa') ? 70 : 30;
	}
	if (id === 'toxic' || id === 'poisonpowder' || id === 'poisongas') {
		if (!t || t.status || t.hasType('Poison') || t.hasType('Steel') || t.getAbility().id === 'immunity') return 0;
		return 55;
	}
	if (['confuseray', 'supersonic', 'sweetkiss', 'teeterdance', 'swagger', 'flatter'].includes(id)) {
		if (!t || t.volatiles['confusion']) return 0;
		return 30;
	}
	if (id === 'leechseed') {
		if (!t || t.hasType('Grass') || t.volatiles['leechseed']) return 0;
		return 50;
	}
	if (SETUP[id]) {
		const stats = SETUP[id];
		const cur = Math.max(...stats.map(s => user.boosts[s] || 0));
		if (cur >= 4) return 0;
		if (hpFrac < 0.55 || threat > 0.6) return 10;
		return 75 - cur * 18 - threat * 30;
	}
	if (id === 'bellydrum') return hpFrac > 0.75 && threat < 0.4 && user.boosts.atk < 6 ? 70 : 0;
	if (id === 'curse' && !user.hasType('Ghost')) return hpFrac > 0.5 && user.boosts.atk < 4 ? 55 - threat * 30 : 5;
	if (RECOVER.has(id)) {
		if (id === 'rest') return hpFrac < 0.35 && user.status !== 'slp' ? 80 : (user.status && hpFrac < 0.6 ? 50 : 0);
		if (id === 'wish' && user.side.slotConditions?.[user.position]?.['wish']) return 0;
		if (hpFrac < 0.4) return 92;
		if (hpFrac < 0.6) return 60;
		if (hpFrac < 0.8) return 20;
		return 0;
	}
	if (id === 'protect' || id === 'detect') {
		if (lastMove === 'protect' || lastMove === 'detect') return 0;
		if (battle.gameType === 'doubles') return 25 + rand() * 25;
		const foeT = foes[0];
		if (foeT && (foeT.status === 'tox' || foeT.status === 'psn' || foeT.status === 'brn' || foeT.volatiles['leechseed'])) return 40;
		return 8;
	}
	if (HAZARDS[id] !== undefined) {
		const foeSide = user.side.foe;
		const layers = foeSide.sideConditions[id]?.layers ?? (foeSide.sideConditions[id] ? 1 : 0);
		if (layers >= HAZARDS[id]) return 0;
		const alive = foeSide.pokemon.filter((p: Pokemon) => !p.fainted).length;
		if (alive <= 1) return 0;
		return (id === 'stealthrock' ? 70 : 50) - layers * 15;
	}
	if (SCREENS.has(id)) {
		if (user.side.sideConditions[id]) return 0;
		return id === 'reflect' || id === 'lightscreen' ? 45 : 10;
	}
	if (id === 'substitute') return hpFrac > 0.5 && !user.volatiles['substitute'] ? 35 : 0;
	if (id === 'taunt') return t && !t.volatiles['taunt'] && t.moveSlots.some((m: any) => battle.dex.moves.get(m.id).category === 'Status') ? 40 : 5;
	if (id === 'encore' || id === 'disable' || id === 'torment') return t && t.lastMove && !t.volatiles[id] ? 30 : 0;
	if (id === 'batonpass') {
		const b = Object.values(user.boosts as { [k: string]: number }).reduce((a, x) => a + Math.max(0, x), 0);
		return b >= 2 ? 65 : 5;
	}
	if (id === 'trick' || id === 'switcheroo') return user.getItem().id.startsWith('choice') && !user.volatiles['choicelock'] ? 55 : (user.getItem().id.startsWith('choice') ? 40 : 5);
	if (id === 'haze' || id === 'clearsmog') {
		const b = foes.reduce((s, f) => s + Object.values(f.boosts as { [k: string]: number }).reduce((a, x) => a + Math.max(0, x), 0), 0);
		return b >= 2 ? 75 : 0;
	}
	if (id === 'roar' || id === 'whirlwind') {
		const b = t ? Object.values(t.boosts as { [k: string]: number }).reduce((a, x) => a + Math.max(0, x), 0) : 0;
		return b >= 2 ? 75 : (t?.side.sideConditions['stealthrock'] ? 30 : 12);
	}
	if (id === 'healbell' || id === 'aromatherapy') return user.side.pokemon.filter((p: Pokemon) => p.status && !p.fainted).length >= 1 ? 50 : 0;
	if (id === 'painsplit') return t && t.hp / t.maxhp > hpFrac + 0.2 ? 60 : 0;
	if (id === 'trickroom') {
		if (battle.field.pseudoWeather['trickroom']) return 0;
		const mySpe = user.side.pokemon.filter((p: Pokemon) => !p.fainted).reduce((a: number, p: Pokemon) => a + st(p, 'spe'), 0);
		const foeSpe = user.side.foe.pokemon.filter((p: Pokemon) => !p.fainted).reduce((a: number, p: Pokemon) => a + st(p, 'spe'), 0);
		return mySpe < foeSpe ? 70 : 5;
	}
	if (id === 'tailwind') return user.side.sideConditions['tailwind'] ? 0 : 50;
	if (id === 'helpinghand') return allyOf(user) ? 35 : 0;
	if (id === 'followme' || id === 'ragepowder') return allyOf(user) && hpFrac > 0.5 ? 30 : 0;
	if (['raindance', 'sunnyday', 'sandstorm', 'hail'].includes(id)) {
		return battle.field.isWeather(id) ? 0 : 30;
	}
	if (id === 'destinybond') return hpFrac < 0.3 && threat >= 1 ? 60 : 0;
	if (id === 'memento') return hpFrac < 0.25 ? 45 : 0;
	if (id === 'perishsong') return 15;
	if (id === 'spite' || id === 'grudge') return 10;
	if (id === 'sleeptalk') return user.status === 'slp' ? 90 : 0;
	if (id === 'refresh') return user.status ? 60 : 0;
	if (id === 'focusenergy' || id === 'laserfocus') return user.volatiles['focusenergy'] ? 0 : 15;
	if (move.boosts && move.target !== 'self' && t) {
		return 20; // 상대 능력 낮추기
	}
	return 12;
}

/* ───────────────────────────────────────────────────────────────────────
 * 기술 선택 · 교체 판단
 *
 * Complete-Fire-Red-Upgrade(Skeli789) 의 Battle AI 구조를 참고해 옮김:
 *  - 모든 기술은 viability 100 에서 시작
 *  - AI_CheckBadMove(ai_negatives.c): 실패·무의미한 기술 감점
 *  - AI_TryToFaint: 쓰러뜨릴 수 있는 기술 / 가장 강한 기술 가점
 *  - AI_CheckViability(ai_positives.c): 상황에 맞는 변화 기술 가점
 *  - 더블배틀: "Doubles AI Strategy" 의 점수표(두 마리 공격·KO 수·같은 편 피해)
 *  - ShouldSwitch(ai_switching.c): 멸망의노래, 원더가드, 쓸 만한 기술 없음, 흡수 특성,
 *    자연회복+잠듦, 하품, 지속 피해, 죽음 회피, 능력 크게 떨어짐 등
 * 그리고 FredodaFred/pokemon-battle-ai 의 규칙 기반 점수(추가효과·반동 고려)를 반영.
 * ─────────────────────────────────────────────────────────────────────── */

interface Option { choice: string; score: number; moveId?: string; damaging?: boolean }

const ABSORB: { [type: string]: string[] } = {
	Electric: ['voltabsorb', 'motordrive', 'lightningrod'], Water: ['waterabsorb', 'dryskin', 'stormdrain'],
	Fire: ['flashfire'], Ground: ['levitate'], Grass: ['sapsipper'],
};

function speedOf(p: Pokemon) { return st(p, 'spe'); }
function outspeeds(battle: Battle, a: Pokemon, b: Pokemon) {
	const tr = !!battle.field.pseudoWeather['trickroom'];
	return tr ? speedOf(a) < speedOf(b) : speedOf(a) > speedOf(b);
}
/** 상대가 쓸 것으로 예상되는 기술 (가장 강한 공격) */
function predictedMove(battle: Battle, foe: Pokemon, target: Pokemon) {
	let best: any = null, bestD = -1;
	for (const slot of foe.moveSlots) {
		const m = battle.dex.moves.get(slot.id);
		const d = estimateDamage(battle, foe, target, m);
		if (d > bestD) { bestD = d; best = m; }
	}
	return { move: best, damage: Math.max(0, bestD) };
}
function canKO(battle: Battle, user: Pokemon, target: Pokemon) {
	return user.moveSlots.some((s: any) => estimateDamage(battle, user, target, s.id) >= 1);
}

/** 기술 하나·대상 하나의 viability */
function viability(battle: Battle, user: Pokemon, move: any, target: Pokemon | null, flags: AIFlags, ctx: { strongest: number; foes: Pokemon[]; firstTurn: boolean }): number {
	let v = 100;
	const doubles = battle.gameType === 'doubles';
	const hpFrac = user.hp / user.maxhp;
	if (move.category === 'Status') {
		const s = statusScore(battle, user, move, target, ctx.foes);
		// CheckBadMove: 의미 없는 변화 기술
		if (s <= 0) return v - 20;
		if (flags.viability) v += Math.round(s / 20); // 0~4
		else v += s >= 40 ? 1 : 0;
		// 상대가 나를 쓰러뜨릴 수 있고 내가 느리면 준비 기술은 손해
		if (flags.faint && SETUP[move.id] && ctx.foes.some(f => outspeeds(battle, f, user) && predictedMove(battle, f, user).damage >= 1)) v -= 6;
		if (doubles && (move.id === 'protect' || move.id === 'detect')) v += 1;
		return v;
	}
	if (!target) return v - 20;
	const d = estimateDamage(battle, user, target, move);
	if (d <= 0) return v - 20; // 효과 없음
	if (move.id === 'fakeout') return ctx.firstTurn ? v + (doubles ? 6 : 3) : v - 20;
	if (move.id === 'dreameater' && target.status !== 'slp') return v - 20;
	if (move.id === 'focuspunch') v -= 6;
	if ((move.id === 'explosion' || move.id === 'selfdestruct' || move.id === 'memento') && hpFrac > 0.35) v -= 10;
	if (move.flags?.charge && !user.hasItem('powerherb') && !(move.id === 'solarbeam' && battle.field.isWeather('sunnyday'))) v -= 4;
	if (['hyperbeam', 'gigaimpact', 'blastburn', 'hydrocannon', 'frenzyplant', 'roaroftime', 'rockwrecker'].includes(move.id) && d < 1) v -= 3;
	if (flags.faint) {
		if (d >= 1) {
			v += 4;
			if (move.priority > 0 || outspeeds(battle, user, target)) v += 2; // 먼저 쓰러뜨릴 수 있음
			if (move.recoil || move.mindBlownRecoil || move.self?.boosts) v -= 1;
		} else if (d >= ctx.strongest - 0.001) {
			v += 2; // 가장 강한 기술
		}
		// 내가 느리고 상대가 나를 쓰러뜨릴 수 있으면 선공기 우대
		if (move.priority > 0 && d >= target.hp / target.maxhp * 0 + 0.3 && !outspeeds(battle, user, target) &&
			predictedMove(battle, target, user).damage >= 1) v += 2;
	} else {
		v += Math.min(3, Math.floor(d * 3));
	}
	// FredodaFred RBES: 추가효과 가점, 자해 감점
	if (flags.viability) {
		const sec = move.secondary || move.secondaries?.[0];
		if (sec && (sec.chance || 0) >= 30 && !target.status && sec.status) v += 1;
		if (move.id === 'uturn' || move.id === 'voltswitch') v += 1;
		if (move.id === 'rapidspin' && Object.keys(user.side.sideConditions).some(k => HAZARDS[k] !== undefined)) v += 3;
		if (move.drain && hpFrac < 0.6) v += 1;
	}
	return v;
}

interface AIFlags { faint: boolean; viability: boolean; switching: boolean; doubles: boolean; lookahead: boolean }
function flagsFor(skill: number): AIFlags {
	return { faint: skill >= 0.45, viability: skill >= 0.6, switching: skill >= 0.7, doubles: skill >= 0.6, lookahead: skill >= 0.8 && lookaheadEnabled && !(globalThis as any).__noLA };
}

function moveOptions(battle: Battle, user: Pokemon, reqActive: any, flags: AIFlags): Option[] {
	const opts: Option[] = [];
	const foes = foesOf(user);
	const ally = allyOf(user);
	const doubles = battle.gameType === 'doubles';
	const firstTurn = !user.activeMoveActions;
	let strongest = 0;
	for (const m of reqActive.moves) for (const f of foes) strongest = Math.max(strongest, estimateDamage(battle, user, f, m.id));
	const ctx = { strongest, foes, firstTurn };
	reqActive.moves.forEach((m: any, i: number) => {
		if (m.disabled || (m.pp !== undefined && m.pp <= 0 && m.id !== 'struggle')) return;
		const move = battle.dex.moves.get(m.id);
		const num = i + 1;
		const locked = m.pp === undefined && m.maxpp === undefined; // 모으기·난동 등으로 고정된 기술 (대상 지정 불가)
		const tt = locked ? 'self' : user.volatiles['dynamax'] ? (reqActive.maxMoves?.maxMoves?.[i]?.target || 'adjacentFoe') : (m.target || move.target);
		const damaging = move.category !== 'Status';
		const add = (choice: string, score: number) => opts.push({ choice, score, moveId: move.id, damaging });
		if (!doubles) {
			add(`move ${num}`, viability(battle, user, move, foes[0] || null, flags, ctx));
			return;
		}
		// ── 더블 (CFRU Doubles AI Strategy 점수표 단순화) ──
		if (['normal', 'any', 'adjacentFoe'].includes(tt)) {
			for (const foe of foes) add(`move ${num} ${foe.position + 1}`, viability(battle, user, move, foe, flags, ctx));
		} else if (tt === 'allAdjacentFoes' || tt === 'allAdjacent') {
			let v = 100, hit = 0, ko = 0;
			for (const foe of foes) {
				const d = estimateDamage(battle, user, foe, move) * 0.75;
				if (d > 0) hit++;
				if (d >= 1) ko++;
			}
			if (!hit) v -= 20;
			if (flags.doubles) {
				v += hit >= 2 ? 3 : hit ? 1 : 0;
				v += ko * 4;
				if (hit >= 2 && ko === 0 && strongest > 0) v += 1;
			}
			if (tt === 'allAdjacent' && ally) {
				const hurt = estimateDamage(battle, user, ally, move);
				if (hurt >= 1) v -= 20; else if (hurt > 0) v -= flags.doubles ? 4 : 2;
				// 같은 편이 면역(부유·비행)이면 감점 없음
			}
			add(`move ${num}`, v);
		} else if (tt === 'adjacentAlly') {
			if (ally) add(`move ${num} -${ally.position + 1}`, 100 + Math.round(statusScore(battle, user, move, ally, foes) / 25) - (statusScore(battle, user, move, ally, foes) <= 0 ? 20 : 0));
		} else {
			add(`move ${num}`, viability(battle, user, move, damaging ? foes[0] || null : foes[0] || null, flags, ctx));
		}
	});
	return opts;
}

/** 가장 적합한 교체 대상 (GetMostSuitableMonToSwitchInto) */
function bestSwitchIn(battle: Battle, side: any, foes: Pokemon[], exclude: Set<number>) {
	let best: { p: Pokemon; i: number } | null = null, bestScore = -Infinity;
	side.pokemon.forEach((p: Pokemon, i: number) => {
		if (i < side.active.length || p.fainted || exclude.has(i)) return;
		let s = matchup(battle, p, foes);
		for (const f of foes) {
			const pred = predictedMove(battle, f, p);
			const myBest = bestDamage(battle, p, f);
			if (myBest >= 1 && pred.damage < 1) s += 2; // 상대를 쓰러뜨리고 버틸 수 있음
			if (pred.damage < 0.35) s += 0.8; // 예상 기술을 잘 받아냄
			if (pred.damage >= 1) s -= 2;
		}
		if (s > bestScore) { bestScore = s; best = { p, i }; }
	});
	return best ? { ...(best as any), score: bestScore } as { p: Pokemon; i: number; score: number } : null;
}

/** ShouldSwitch: 교체해야 하는 이유가 있으면 교체 대상 반환 */
function shouldSwitch(battle: Battle, user: Pokemon, side: any, opts: Option[], exclude: Set<number>): number | null {
	const foes = foesOf(user);
	if (!foes.length) return null;
	const cand = bestSwitchIn(battle, side, foes, exclude);
	if (!cand) return null;
	const hpFrac = user.hp / user.maxhp;
	const bestOpt = opts.reduce((m, o) => Math.max(m, o.score), 0);
	const cur = matchup(battle, user, foes);
	// 1. 멸망의노래 카운트 1
	if (user.volatiles['perishsong']?.duration === 1) return cand.i;
	// 2. 원더가드 상대에게 효과 있는 기술 없음
	if (foes.every(f => f.getAbility().id === 'wonderguard') && !opts.some(o => o.damaging && o.score >= 100)) {
		if (foes.some(f => bestDamage(battle, cand.p, f) > 0)) return cand.i;
	}
	// 3. 쓸 만한 기술이 없음
	if (bestOpt < 95 && cand.score > cur) return cand.i;
	// 4. 상대 예상 기술을 흡수하는 특성의 동료가 있음
	for (const f of foes) {
		const pred = predictedMove(battle, f, user);
		if (!pred.move) continue;
		const absorbers = ABSORB[pred.move.type] || [];
		if (pred.damage >= 0.5) {
			const idx = side.pokemon.findIndex((p: Pokemon, i: number) => i >= side.active.length && !p.fainted && !exclude.has(i) &&
				absorbers.includes(p.getAbility().id));
			if (idx >= 0 && Math.random() < 0.6) return idx;
		}
	}
	// 5. 잠듦 + 자연회복
	if (user.status === 'slp' && user.getAbility().id === 'naturalcure' && hpFrac > 0.4) return cand.i;
	// 6. 하품에 걸림 (쓰러뜨릴 수 없을 때)
	if (user.volatiles['yawn'] && !user.status && !foes.some(f => canKO(battle, user, f))) return cand.i;
	// 7. 지속 피해 (맹독 누적·씨뿌리기·저주)
	const toxTurns = user.statusState?.stage || 0;
	if (((user.status === 'tox' && toxTurns >= 3) || user.volatiles['leechseed'] || user.volatiles['curse']) && hpFrac < 0.6 && hpFrac > 0.25 &&
		cand.score > cur - 0.3) return cand.i;
	// 8. 죽음 회피: 상대가 빠르고 나를 쓰러뜨리며, 나는 상대를 못 쓰러뜨림 → 버틸 수 있는 동료로
	for (const f of foes) {
		if (outspeeds(battle, f, user) && predictedMove(battle, f, user).damage >= 1 && !canKO(battle, user, f)) {
			const surv = predictedMove(battle, f, cand.p).damage < 0.7;
			if (surv && Math.random() < 0.5) return cand.i;
		}
	}
	// 9. 공격 능력이 크게 떨어짐
	const main = user.getStat('atk', true, true) >= user.getStat('spa', true, true) ? 'atk' : 'spa';
	if ((user.boosts[main] || 0) <= -3 && hpFrac > 0.3) return cand.i;

	// ── 능동적인 교체 (실전 플레이어처럼) ──
	// 방금 나온 포켓몬은 다시 바로 바꾸지 않음 (서로 계속 바꾸기만 하는 것 방지)
	if ((user.activeTurns || 0) < 1) return null;
	const myKO = foes.some(f => canKO(battle, user, f) && outspeeds(battle, user, f));
	// 10. 구애 계열로 묶였는데 그 기술이 상대에게 안 듣거나 별로임
	// 더블은 교체 한 번의 손해가 커서 능동 교체를 하지 않음 (자체 대전: 더블에서는 오히려 승률이 떨어짐)
	if (battle.gameType === 'doubles') return null;
	const locked = user.volatiles['choicelock']?.move;
	if (locked && foes.every(f => estimateDamage(battle, user, f, locked) < 0.25) && cand.score > cur) return cand.i;
	// 11. 재생력: 체력이 줄었고 지금 할 일이 별로 없으면 빠져서 회복
	if (user.getAbility().id === 'regenerator' && hpFrac < 0.55 && hpFrac > 0.15 && bestOpt < 110 && cand.score > cur - 0.2 && Math.random() < 0.6) return cand.i;
	// 더블에서는 교체 한 번의 손해가 커서 아래 능동 교체는 싱글에서만 (자체 대전 결과 반영)
	if (battle.gameType === 'doubles') return null;
	// 12. 상대 예상 기술을 무효·반감으로 받아낼 동료가 있으면 그쪽으로 (받아내고 반격)
	for (const f of foes) {
		const pred = predictedMove(battle, f, user);
		if (!pred.move || pred.damage < 0.45 || myKO) continue;
		let best: { i: number; v: number } | null = null;
		side.pokemon.forEach((p: Pokemon, i: number) => {
			if (i < side.active.length || p.fainted || exclude.has(i)) return;
			const taken = estimateDamage(battle, f, p, pred.move);
			const back = bestDamage(battle, p, f);
			if (taken <= 0.2 && back >= 0.3) {
				const v = back - taken + (taken === 0 ? 0.5 : 0);
				if (!best || v > best.v) best = { i, v };
			}
		});
		if (best && Math.random() < 0.75) return (best as { i: number }).i;
	}
	// 13. 상대가 능력을 크게 올렸는데 나는 못 쓰러뜨림 → 더 잘 맞서는 동료로
	for (const f of foes) {
		const boosts = Object.values(f.boosts as any).reduce((a: number, b: any) => a + Math.max(0, b), 0) as number;
		if (boosts >= 2 && !canKO(battle, user, f) && cand.score > cur + 0.5 && Math.random() < 0.7) return cand.i;
	}
	return null;
}

function pickBest(opts: Option[], skill: number): Option | undefined {
	if (!opts.length) return undefined;
	// 실수: 실력이 낮을수록 가끔 무작위 (그래도 무의미한 기술은 피함)
	if (Math.random() > skill * 0.9 + 0.1) {
		const ok = opts.filter(o => o.score >= 100);
		if (ok.length) return ok[Math.floor(Math.random() * ok.length)];
	}
	const max = Math.max(...opts.map(o => o.score));
	const top = opts.filter(o => o.score === max);
	return top[Math.floor(Math.random() * top.length)];
}

/**
 * 메가진화 · Z기술 · 테라스탈 · 다이맥스 사용 판단
 * (CFRU 의 ShouldAIDynamax / Z-move 판단을 참고: "결과가 바뀔 때"만 쓴다)
 *  - 쓰면 이번 턴에 쓰러뜨릴 수 있게 되는가 (없으면 못 쓰러뜨림)
 *  - 쓰면 상대의 예상 공격을 버티게 되는가 (안 쓰면 쓰러짐)
 *  - 남은 포켓몬이 적고 이 포켓몬이 팀에서 가장 강한 공격수인가
 * 한 배틀에 한 종류만 쓸 수 있으므로, 더 좋은 기회(에이스)를 위해 아껴 두기도 한다.
 */
function gimmickFor(battle: Battle, user: Pokemon, reqActive: any, best: Option, skill: number, used: { [k: string]: boolean }): string {
	const r = (k: string, v: string) => { used[k] = true; return v; };
	const m = /^move (\d+)/.exec(best.choice);
	if (!m) return '';
	const idx = parseInt(m[1], 10) - 1;
	const moveId = reqActive.moves[idx]?.id;
	const move = moveId ? battle.dex.moves.get(moveId) : null;
	if (!move) return '';
	const foes = foesOf(user);
	const target = foes[0];
	if (!target) return '';
	const hpFrac = user.hp / user.maxhp;
	const side = user.side;
	const alive = side.pokemon.filter((p: Pokemon) => !p.fainted);
	const isLast = alive.length <= 1;
	const myDmg = estimateDamage(battle, user, target, move);
	const pred = predictedMove(battle, target, user);
	const foeKOsMe = pred.damage >= 1 && outspeeds(battle, target, user);
	const foeKOsMeAny = pred.damage >= 1;
	// 팀에서 가장 강한 공격수인가 (상대 전원 상대로 최대 데미지 합)
	const power = (p: Pokemon) => foes.reduce((a, f) => a + bestDamage(battle, p, f), 0) * (p.hp / p.maxhp);
	const myPower = power(user);
	const isAce = alive.every((p: Pokemon) => p === user || power(p) <= myPower + 0.05);
	const careless = Math.random() > skill; // 실력이 낮으면 가끔 아무렇게나

	// 메가진화: 손해가 없으므로 바로 (울트라버스트 포함)
	if (!used.mega) {
		if (reqActive.canMegaEvo) return r('mega', ' mega');
		if (reqActive.canMegaEvoX) return r('mega', ' megax');
		if (reqActive.canMegaEvoY) return r('mega', ' megay');
		if (reqActive.canUltraBurst) return r('mega', ' ultra');
	}

	type Cand = { k: string; v: string; score: number };
	const cands: Cand[] = [];

	// Z기술: 이번 턴 KO 가능해지는가
	const z = reqActive.canZMove?.[idx];
	if (z && !used.z && move.category !== 'Status') {
		const zbp = move.zMove?.basePower || 100;
		const zd = estimateDamage(battle, user, target, { ...move, basePower: zbp, multihit: undefined, flags: { ...move.flags, charge: 0 } });
		let sc = 0;
		if (zd >= 1 && myDmg < 1) sc += 3;           // 못 쓰러뜨리던 걸 쓰러뜨림
		if (zd >= 1 && foeKOsMe) sc += 1;            // 어차피 당하기 전 마지막 한 방
		if (zd >= 0.6 && myDmg < 0.4) sc += 1;
		if (isLast && zd > myDmg) sc += 1;
		if (zd <= myDmg + 0.05) sc = -1;
		if (careless) sc += 1;
		cands.push({ k: 'z', v: ' zmove', score: sc });
	}

	// 테라스탈
	if (reqActive.canTerastallize && !used.tera) {
		const tera: string = reqActive.canTerastallize;
		let sc = 0;
		// 공격: 기술 타입이 테라 타입이면 자속 보정 상승
		if (move.category !== 'Status' && move.type === tera) {
			const mult = user.hasType(tera) ? 2 / 1.5 : 1.5;
			const td = myDmg * mult;
			if (td >= 1 && myDmg < 1) sc += 3;
			else if (td >= 0.5 && myDmg < 0.35) sc += 1;
		}
		// 방어: 상대 예상 기술의 상성이 좋아지는가
		if (pred.move) {
			const before = typeEff(battle, pred.move.type, user);
			const afterImmune = typeEffOf(battle, pred.move.type, tera);
			if (foeKOsMeAny && pred.damage * (afterImmune / Math.max(0.25, before)) < 0.9) sc += 3; // 쓰러질 걸 버팀
			else if (before > 1 && afterImmune < 1) sc += 1;
			// 테라 후 약점이 생기면 감점 (상대가 그 타입 기술을 가짐)
			const foeTypes = new Set<string>(target.moveSlots.map((ms: any) => battle.dex.moves.get(ms.id)).filter((mv: any) => mv.category !== 'Status').map((mv: any) => mv.type));
			for (const t of foeTypes) if (typeEffOf(battle, t, tera) > 1 && typeEff(battle, t, user) <= 1) sc -= 1;
		}
		if (isAce && alive.length <= 2 && sc >= 0 && move.category !== 'Status' && move.type === tera) sc += 1;
		if (careless) sc += 1;
		cands.push({ k: 'tera', v: ' terastallize', score: sc });
	}

	// 다이맥스: HP 2배 + 다이맥스 기술. 가장 강한 포켓몬에게, 체력이 넉넉할 때
	if (reqActive.canDynamax && !used.dmax && move.category !== 'Status') {
		let sc = 0;
		const maxBp = reqActive.maxMoves?.maxMoves?.[idx] ? Math.max(90, Math.min(150, (move.basePower || 60) + 40)) : move.basePower;
		const dd = estimateDamage(battle, user, target, { ...move, basePower: maxBp, multihit: undefined, accuracy: true, flags: { ...move.flags, charge: 0 } });
		if (dd >= 1 && myDmg < 1) sc += 2;
		if (pred.damage >= 1 && pred.damage < 1.9 && hpFrac > 0.5) sc += 2; // 2배 HP 로 버팀
		if (isAce) sc += 1;
		if (hpFrac >= 0.75) sc += 1;
		if (hpFrac < 0.4) sc -= 2;
		if (alive.length >= 3 && !isAce) sc -= 2;   // 아직 더 좋은 기회가 있을 수 있음
		if (pred.damage >= 2.2 && !outspeeds(battle, user, target)) sc -= 3; // 다이맥스해도 한 방에 쓰러짐
		if (target.volatiles['dynamax'] && hpFrac > 0.5) sc += 1; // 상대 다이맥스 맞대응
		if (careless) sc += 2;
		cands.push({ k: 'dmax', v: ' dynamax', score: sc });
	}

	if (!cands.length) return '';
	cands.sort((a, b) => b.score - a.score);
	const top = cands[0];
	const threshold = isLast ? 1 : 2;
	if (top.score >= threshold) return r(top.k, top.v);
	return '';
}

export function chooseAI(battle: Battle, request: any, sideid: 'p1' | 'p2', skill: number): string {
	const side = battle[sideid];
	const flags = flagsFor(skill);
	if (request.teamPreview) return 'default';

	if (request.forceSwitch) {
		const chosen = new Set<number>();
		const parts: string[] = [];
		// 부활의기원: 쓰러진 포켓몬 중 가장 강한 쪽을 되살림
		if (request.side?.pokemon?.some((x: any) => x.reviving)) {
			const fainted = side.pokemon.map((p: Pokemon, i: number) => ({ p, i })).filter(({ p }: any) => p.fainted);
			fainted.sort((a: any, b: any) => (b.p.baseMaxhp + b.p.storedStats.atk + b.p.storedStats.spa) - (a.p.baseMaxhp + a.p.storedStats.atk + a.p.storedStats.spa));
			return fainted.length ? `switch ${fainted[0].i + 1}` : 'pass';
		}
		request.forceSwitch.forEach((must: boolean) => {
			if (!must) return;
			const foes = side.foe.active.filter((p: Pokemon) => p && !p.fainted);
			let pickIdx = -1;
			if (flags.switching || Math.random() < skill) {
				const c = bestSwitchIn(battle, side, foes, chosen);
				if (c) pickIdx = c.i;
			}
			if (pickIdx < 0) {
				const left = side.pokemon.map((p: Pokemon, i: number) => ({ p, i })).filter(({ p, i }: any) => i >= side.active.length && !p.fainted && !chosen.has(i));
				if (left.length) pickIdx = left[Math.floor(Math.random() * left.length)].i;
			}
			if (pickIdx < 0) { parts.push('pass'); return; }
			chosen.add(pickIdx);
			parts.push(`switch ${pickIdx + 1}`);
		});
		return parts.join(', ');
	}

	if (request.active) {
		const parts: string[] = [];
		/** 더블 내다보기용: 슬롯마다 [휴리스틱 선택, 차선] */
		const slotCands: string[][] = [];
		const chosenSwitch = new Set<number>();
		const used: { [k: string]: boolean } = {};
		request.active.forEach((reqActive: any, slot: number) => {
			const user = side.active[slot];
			if (!user || user.fainted) return;
			// 사령탑(Commander)으로 입 속에 들어간 싸리용은 시뮬레이터가 자동으로 넘김
			if (user.volatiles['commanding'] || reqActive.commanding) return;
			const opts = moveOptions(battle, user, reqActive, flags);
			const canSwitch = !reqActive.trapped && !reqActive.maybeTrapped;
			if (canSwitch && flags.switching) {
				const idx = shouldSwitch(battle, user, side, opts, chosenSwitch);
				if (idx !== null && idx >= side.active.length) {
					chosenSwitch.add(idx);
					parts.push(`switch ${idx + 1}`);
					slotCands.push([`switch ${idx + 1}`]);
					return;
				}
			}
			let best = pickBest(opts, skill) || { choice: 'move 1', score: 0 };
			// 싱글: 실제 시뮬레이터로 한 턴 앞을 내다보고 고름 (내 선택 × 상대 선택)
			if (flags.lookahead && battle.gameType === 'singles' && !inLookahead && Math.random() < skill) {
				const la = lookahead(battle, side, user, opts, reqActive, used, skill);
				if (la) { parts.push(la); return; }
			}
			let gm = gimmickFor(battle, user, reqActive, best, skill, used);
			let choice = best.choice;
			// 더블: Z기술·다이맥스기술은 단일 대상이 되므로 대상 번호가 필요
			const mIdx = parseInt(/^move (\d+)/.exec(choice)?.[1] || '0', 10) - 1;
			const maxT = reqActive.maxMoves?.maxMoves?.[mIdx]?.target;
			const needT = gm === ' zmove' || ((gm === ' dynamax' || user.volatiles['dynamax']) && (!maxT || ['normal', 'adjacentFoe', 'any'].includes(maxT)));
			if (battle.gameType === 'doubles' && needT && /^move \d+$/.test(choice)) {
				const foe = foesOf(user)[0];
				if (foe) choice += ` ${foe.position + 1}`;
				else gm = '';
			}
			// 더블 안전장치: 대상이 필요한 기술인데 대상 번호가 빠졌으면 채운다
			if (battle.gameType === 'doubles' && /^move \d+$/.test(choice)) {
				const rm = reqActive.moves[mIdx];
				const locked = rm && rm.pp === undefined && rm.maxpp === undefined;
				const tt = (gm === ' dynamax' || user.volatiles['dynamax']) ? maxT : rm?.target;
				if (!locked && ['normal', 'any', 'adjacentFoe'].includes(tt)) {
					const foe = foesOf(user)[0];
					if (foe) choice += ` ${foe.position + 1}`;
				} else if (!locked && tt === 'adjacentAllyOrSelf') choice += ` -${user.position + 1}`;
				else if (!locked && tt === 'adjacentAlly') {
					const ally = side.active.find((a: any) => a && a !== user && !a.fainted);
					if (ally) choice += ` -${ally.position + 1}`;
				}
			}
			parts.push(choice + gm);
			// 차선: 휴리스틱 2위 기술 (대상 포함)
			const alts = opts.filter(o => o.choice !== best.choice).sort((a, b) => b.score - a.score).slice(0, 2).map(o => o.choice);
			slotCands.push([choice + gm, ...alts]);
		});
		if (flags.lookahead && battle.gameType === 'doubles' && !inLookahead && parts.length && Math.random() < skill) {
			const la = lookaheadDoubles(battle, side, parts, slotCands);
			if (la) return la;
		}
		return parts.join(', ') || 'default';
	}
	return 'default';
}

// ───────── 1턴 앞 내다보기 (싱글) ─────────
// 배틀 상태를 복제해 내 선택 × 상대 선택을 실제로 한 턴 돌려 보고, 상대가 가장 잘 받아쳤을 때와 평균을 섞어 평가한다.
let lookaheadEnabled = true;
let inLookahead = false;
export function setLookahead(on: boolean) { lookaheadEnabled = on; }

/** 탐색 중 형제 가지를 같은 난수로 비교하기 위한 시드 (공통 난수: 운에 따른 차이를 줄임) */
let searchSeed: any = null;
/** 복제본에서 한 턴 돌려 보고 평가. keep 이면 끝난 복제본도 돌려줌 (다음 턴을 더 내다볼 때) */
function simulateTurn(ser: any, battle: Battle, me: 'p1' | 'p2', myChoice: string, foeChoice: string): number | null;
function simulateTurn(ser: any, battle: Battle, me: 'p1' | 'p2', myChoice: string, foeChoice: string, keep: true): { v: number; c: any } | null;
function simulateTurn(ser: any, battle: Battle, me: 'p1' | 'p2', myChoice: string, foeChoice: string, keep = false): any {
	const foeSide = me === 'p1' ? 'p2' : 'p1';
	try {
		const c: any = State.deserializeBattle(ser);
		c.send = () => {};
		c.prng = searchSeed ? new PRNG(searchSeed) : new PRNG();
		// 복제본의 로그는 원본과 같은 배열을 가리키므로 떼어 낸다 (원본 로그 오염·'Infinite loop' 방지)
		c.log = []; c.sentLogPos = 0; c.inputLog = [];
		const startTurn = c.turn;
		// 상대가 이미 골랐으면(플레이어가 먼저 고른 실제 선택) 내 수만 넣으면 그 턴이 진행됨 — 상대 쪽은 건드리지 않음
		const foeDone = !!c[foeSide].isChoiceDone?.();
		if (!c.choose(me, myChoice)) return null;
		if (!foeDone && !c.choose(foeSide, foeChoice)) c.choose(foeSide, 'default');
		let guard = 0;
		while (!c.ended && c.turn === startTurn && guard++ < 3) { c.choose(me, 'default'); c.choose(foeSide, 'default'); }
		const v = evalState(c, me);
		return keep ? { v, c } : v;
	} catch (e: any) {
		const dbg = ((globalThis as any).__la ||= { calls: 0, serFail: 0, simFail: 0, err: '' });
		dbg.simFail++; dbg.err = String(e?.stack || e).slice(0, 400);
		return null;
	}
}

/** 더블: 내 후보 조합(슬롯별 1·2순위) × 상대 예상 선택(같은 AI로 2번 뽑음) */
function lookaheadDoubles(battle: Battle, side: any, parts: string[], slotCands: string[][]): string | null {
	const me = side.id as 'p1' | 'p2';
	const foeSide = battle[me === 'p1' ? 'p2' : 'p1'];
	let ser: any;
	try { ser = State.serializeBattle(battle); } catch { return null; }
	// 상대 예상 선택
	const foeReq = { active: foeSide.active.map((p: Pokemon) => p && !p.fainted ? p.getMoveRequestData() : null), side: foeSide.getRequestData() };
	const foeChoices: { choice: string; w: number }[] = [];
	if (foeSide.isChoiceDone?.()) foeChoices.push({ choice: 'default', w: 1 }); // 상대가 이미 고름 → 그대로
	else { inLookahead = true;
	try {
		for (let k = 0; k < 3; k++) {
			const c = chooseAI(battle, foeReq, foeSide.id, 0.9);
			const f = foeChoices.find(x => x.choice === c);
			if (f) f.w += 1 / 3; else foeChoices.push({ choice: c, w: 1 / 3 });
		}
	} catch { foeChoices.push({ choice: 'default', w: 1 }); } finally { inLookahead = false; } }
	if (!foeChoices.length) return null;
	// 내 후보 조합
	const combos: string[] = [];
	const rec = (i: number, acc: string[]) => {
		if (i === slotCands.length) { combos.push(acc.join(', ')); return; }
		for (const c of slotCands[i]) rec(i + 1, [...acc, c]);
	};
	rec(0, []);
	const heur = parts.join(', ');
	if (!combos.includes(heur)) combos.unshift(heur);
	if (combos.length <= 1) return null;
	let best: { choice: string; v: number } | null = null;
	for (const mc of combos) {
		let v = 0, ok = true;
		for (const fc of foeChoices) {
			const r = simulateTurn(ser, battle, me, mc, fc.choice);
			if (r === null) { ok = false; break; }
			v += r * fc.w;
		}
		if (!ok) continue;
		if (mc === heur) v += 0.02; // 같으면 휴리스틱 선택 유지
		if (!best || v > best.v) best = { choice: mc, v };
	}
	return best?.choice || null;
}

/** AI 버전: 1 = 이전, 2 = + 장 상황 평가, 3 = + 상대 습관·교체 예상 (v3 vs v2 싱글 6마리 53.8%(800판), 3마리 50.4%(1200판)). 자체 대전 비교용으로 globalThis.__aiVer = { p1: 1, p2: 3 } 처럼 진영별 지정 */
/** 장 상황 평가 항목별 가중. 자체 대전(진영 바꿔 두 판씩, 깊이 1·숙고 200ms): v2 vs v1 싱글 6마리 54.9%(1200판), 3마리 49.2%(1200판) */
const AI_FEAT = { haz: 1, scr: 1, sub: 1, item: 1 };
function aiVer(me: 'p1' | 'p2'): number { return (globalThis as any).__aiVer?.[me] ?? 3; }

/** (v2) 한 진영의 장 상황 점수: 설치기(내 쪽에 깔리면 손해) · 벽 · 순풍 · 대타출동 · 기합의띠/풍선 */
function fieldScore(b: Battle, sideId: 'p1' | 'p2', F: { haz?: number; scr?: number; sub?: number; item?: number } = {}): number {
	const side = b[sideId];
	const H = F.haz ?? 1, S = F.scr ?? 1, U = F.sub ?? 1, I = F.item ?? 1;
	const sc = side.sideConditions || {};
	let v = 0;
	const bench = side.pokemon.filter((p: any) => p && !p.fainted && p.hp && !p.isActive);
	const grounded = (p: any) => { try { return p.isGrounded(); } catch { return true; } };
	// 설치기: 앞으로 나올 포켓몬이 입을 데미지(HP 비율)의 약 70%
	if (sc.stealthrock) for (const p of bench) { let m = 1; try { m = Math.pow(2, b.dex.getEffectiveness('Rock', p)); } catch {} if (p.getItem?.()?.id !== 'heavydutyboots') v -= (m / 8) * 0.7 * H; }
	if (sc.spikes) { const f = [0, 1 / 8, 1 / 6, 1 / 4][Math.min(3, sc.spikes.layers || 1)]; for (const p of bench) if (grounded(p) && p.getItem?.()?.id !== 'heavydutyboots') v -= f * 0.7 * H; }
	if (sc.toxicspikes) for (const p of bench) if (grounded(p) && !p.hasType?.('Poison') && !p.hasType?.('Steel')) v -= 0.05 * (sc.toxicspikes.layers || 1) * H;
	if (sc.stickyweb) v -= 0.04 * bench.length * H;
	// 벽·순풍: 남은 턴만큼
	const turns = (k: string, cap: number) => Math.min(cap, sc[k]?.duration ?? (sc[k] ? cap : 0));
	v += (0.035 * turns('reflect', 5) + 0.035 * turns('lightscreen', 5) + 0.05 * turns('auroraveil', 5) + 0.05 * turns('tailwind', 4)) * S;
	for (const p of side.active) {
		if (!p || p.fainted || !p.hp) continue;
		if (p.volatiles?.substitute) v += 0.12 * U;
		const item = p.getItem?.()?.id;
		if (item === 'focussash' && p.hp === p.maxhp) v += 0.1 * I;
		if (item === 'airballoon') v += 0.03 * I;
	}
	return v;
}

/** 진영 평가: HP 비율 합 + 살아 있는 수 (내 쪽 − 상대 쪽), v2 는 장 상황도 */
function evalState(b: Battle, mySide: 'p1' | 'p2'): number {
	const score = (side: any) => {
		let v = 0;
		for (const p of side.pokemon) {
			if (p.fainted || !p.hp) continue;
			v += p.hp / p.maxhp + 0.35;
			if (p.status === 'tox' || p.status === 'brn') v -= 0.08;
			else if (p.status === 'slp' || p.status === 'frz') v -= 0.12;
			else if (p.status) v -= 0.05;
			if (p.isActive) {
				const bs = Object.values(p.boosts as any).reduce((a: number, x: any) => a + x, 0) as number;
				v += Math.max(-3, Math.min(3, bs)) * 0.04;
			}
		}
		return v;
	};
	const foe = mySide === 'p1' ? 'p2' : 'p1';
	if (b.ended) return b.winner === b[mySide].name ? 100 : b.winner ? -100 : 0;
	let v = score(b[mySide]) - score(b[foe]);
	if (aiVer(mySide) >= 2) {
		// 항목별 가중(테스트에서 __aiFeat[진영] 으로 조절)
		const F = (globalThis as any).__aiFeat?.[mySide] || AI_FEAT;
		try { v += fieldScore(b, mySide, F) - fieldScore(b, foe, F); } catch {}
	}
	// 턴이 끝난 뒤의 대면 상황: 내가 상대를 위협하는가 / 상대가 나를 위협하는가
	const mine = b[mySide].active.filter((p: any) => p && !p.fainted && p.hp), theirs = b[foe].active.filter((p: any) => p && !p.fainted && p.hp);
	if (mine.length && theirs.length) {
		try {
			let t = 0;
			for (const a of mine) t += Math.max(...theirs.map((f: any) => Math.min(1, bestDamage(b, a, f)))) * 0.4 + (theirs.every((f: any) => outspeeds(b, a, f)) ? 0.1 : 0);
			for (const f of theirs) t -= Math.max(...mine.map((a: any) => Math.min(1, bestDamage(b, f, a)))) * 0.4 + (mine.every((a: any) => outspeeds(b, f, a)) ? 0.1 : 0);
			v += t / Math.max(mine.length, theirs.length);
		} catch {}
	}
	return v;
}

/** (v2) 배틀 기록에서 한 진영의 습관: 자진 교체 비율(쓰러져서 바꾼 것 제외), 방어 계열 기술 비율 */
function playerHabits(battle: Battle, sideId: 'p1' | 'p2'): { switchRate: number; protectRate: number } {
	let moves = 0, protects = 0, sw = 0, faintPending = 0;
	const PROTECT = /\|(Protect|Detect|Spiky Shield|King's Shield|Baneful Bunker|Silk Trap|Obstruct|Burning Bulwark)\|/;
	for (const l of (battle.log || []) as string[]) {
		if (l.startsWith(`|faint|${sideId}`)) faintPending++;
		else if (l.startsWith(`|move|${sideId}`)) { moves++; if (PROTECT.test(l)) protects++; }
		else if (l.startsWith(`|switch|${sideId}`) || l.startsWith(`|drag|${sideId}`)) { if (faintPending > 0) faintPending--; else if (moves + sw > 0 && l.startsWith('|switch|')) sw++; }
	}
	const acts = moves + sw;
	// 행동이 적을 때는 보통 사람 기준(교체 15%, 방어 0)으로 당김
	return { switchRate: (sw + 0.15 * 4) / (acts + 4), protectRate: acts ? protects / (moves + 2) : 0 };
}

function lookahead(battle: Battle, side: any, user: Pokemon, opts: Option[], reqActive: any, used: { [k: string]: boolean }, skill: number): string | null {
	const me = side.id as 'p1' | 'p2';
	const foeSide = me === 'p1' ? 'p2' : 'p1';
	const foe = foesOf(user)[0];
	if (!foe) return null;
	// 내 후보: 쓸 수 있는 기술(기믹 포함) + 가장 좋은 교체 1개
	const myOpts: { choice: string; base: number }[] = [];
	const bestOpt = pickBest(opts, 1) || opts[0];
	for (const o of opts) {
		if (!/^move \d+$/.test(o.choice)) continue;
		myOpts.push({ choice: o.choice, base: o.score });
	}
	if (!myOpts.length) return null;
	const gmUsed = { ...used };
	const gm = bestOpt ? gimmickFor(battle, user, reqActive, bestOpt, skill, gmUsed) : '';
	if (gm) myOpts.push({ choice: bestOpt.choice + gm, base: bestOpt.score + 1 });
	if (!reqActive.trapped && !reqActive.maybeTrapped && !(globalThis as any).__laNoSwitch) {
		const sw = bestSwitchIn(battle, side, [foe], new Set());
		if (sw) myOpts.push({ choice: `switch ${sw.i + 1}`, base: 100 });
	}
	// 상대 후보: 상대도 같은 휴리스틱으로 고른다고 보고 상위 2개(가중 0.65/0.35), 나머지는 최악값으로만 반영
	const foeReq = { moves: foe.moveSlots.map((m: any) => ({ id: m.id, move: m.move, pp: m.pp, maxpp: m.maxpp, disabled: m.disabled || m.pp <= 0, target: m.target })) };
	let foeMoves: { choice: string; w: number }[] = [];
	try {
		const fo = moveOptions(battle, foe, foeReq, flagsFor(0.9)).filter(o => /^move \d+$/.test(o.choice)).sort((a, b) => b.score - a.score);
		foeMoves = fo.slice(0, 2).map((o, i) => ({ choice: o.choice, w: i === 0 ? 0.65 : 0.35 }));
		if (foeMoves.length === 1) foeMoves[0].w = 1;
		for (const o of fo.slice(2)) foeMoves.push({ choice: o.choice, w: 0 });
	} catch {}
	if (!foeMoves.length) foeMoves.push({ choice: 'default', w: 1 });
	// 상대(플레이어)가 이미 골랐으면 복제본에 그 선택이 들어 있어 내 수만 넣으면 실제 대결 그대로 → 상대 후보를 하나로
	const foePicked = (() => { try { return !!battle[foeSide].isChoiceDone(); } catch { return false; } })();
	if (foePicked) foeMoves = [{ choice: 'default', w: 1 }];
	const depth = searchDepth(me, skill);
	const v2 = aiVer(me) >= 3;
	// (v3) 이 배틀에서 상대가 실제로 한 행동(자진 교체·방어 빈도)으로 예상 가중을 맞춤
	const habit = v2 && !foePicked ? playerHabits(battle, foeSide) : null;
	if (habit && habit.protectRate > 0 && !['protect', 'detect', 'spikyshield', 'kingsshield', 'banefulbunker', 'silktrap', 'obstruct', 'burningbulwark'].includes(foe.lastMove?.id)) {
		const pi = foe.moveSlots.findIndex((m: any) => ['protect', 'detect', 'spikyshield', 'kingsshield', 'banefulbunker', 'silktrap', 'obstruct', 'burningbulwark'].includes(m.id) && m.pp > 0);
		if (pi >= 0) {
			const w = Math.min(0.35, habit.protectRate * 1.2);
			for (const f of foeMoves) f.w *= (1 - w);
			const ex = foeMoves.find(f => f.choice === `move ${pi + 1}`);
			if (ex) ex.w += w; else foeMoves.push({ choice: `move ${pi + 1}`, w });
		}
	}
	// 상대가 교체할 가능성: v1 은 깊은 탐색에서만, v2 는 늘 (대면이 불리할수록 + 상대가 자주 바꿀수록 가중 ↑)
	if ((depth >= 2 || v2) && !foePicked) {
		try {
			const fs = battle[foeSide];
			const fsw = bestSwitchIn(battle, fs, [user], new Set());
			if (fsw && !foe.volatiles['partiallytrapped'] && !(foe as any).trapped) {
				const threat = bestDamage(battle, user, foe), back = bestDamage(battle, foe, user);
				let w = threat >= 0.9 && back < 0.6 ? 0.35 : threat >= 0.6 ? 0.2 : 0.08;
				if (habit) w = Math.max(0.04, Math.min(0.5, w * (0.6 + habit.switchRate * 2.5)));
				for (const f of foeMoves) f.w *= (1 - w);
				foeMoves.push({ choice: `switch ${fsw.i + 1}`, w });
			}
		} catch {}
	}
	const dbg = ((globalThis as any).__la ||= { calls: 0, serFail: 0, simFail: 0, err: '' });
	dbg.calls++;
	let ser: any;
	try { ser = State.serializeBattle(battle); } catch (e: any) { dbg.serFail++; dbg.err = String(e?.stack || e).slice(0, 400); return null; }
	const results: { choice: string; v: number }[] = [];
	const t0 = now();
	const cfg = searchCfg(me, skill);
	const over = () => now() - t0 > cfg.budget;
	const score1 = (cells: { fo: { w: number }; v: number }[]) => {
		const tw = cells.reduce((a, c) => a + c.fo.w, 0) || 1;
		const exp = cells.reduce((a, c) => a + c.v * c.fo.w, 0) / tw;
		return exp * 0.75 + Math.min(...cells.map(c => c.v)) * 0.25;
	};
	/** 한 번의 난수(시드)로 후보들을 평가: 1턴 → (강한 AI) 좋은 가지부터 2턴 */
	const evalWithSeed = (opts: typeof myOpts) => {
		searchSeed = PRNG.generateSeed();
		const grid = opts.map(mo => ({ mo, cells: foeMoves.map(fo => ({ fo, r: simulateTurn(ser, battle, me, mo.choice, fo.choice, true) })) }));
		const rows = grid.filter(g => g.cells.every(c => c.r)).map(g => ({ mo: g.mo, cells: g.cells.map(c => ({ fo: c.fo, v: c.r!.v, c: c.r!.c })) }));
		if (depth >= 2) {
			const order = rows.slice().sort((a, b) => score1(b.cells) - score1(a.cells));
			for (const row of order) {
				if (over()) break;
				for (const cell of row.cells) {
					if (cell.fo.w <= 0 || over()) continue;
					const v2 = secondTurn(cell.c, battle, me, skill, over);
					if (v2 !== null) cell.v = cell.v * 0.35 + v2 * 0.65;
				}
			}
		}
		return rows.map(r => ({ choice: r.mo.choice, v: score1(r.cells) }));
	};
	try {
		// 1회차: 모든 후보. 그 뒤 시간이 남으면 상위 후보만 다른 난수(급소·명중·데미지 난수)로 다시 돌려 평균 → 운 때문에 잘못 고르는 일을 줄임
		const sum: { [c: string]: { v: number; n: number } } = {};
		const add = (rs: { choice: string; v: number }[]) => { for (const r of rs) { const e = sum[r.choice] ||= { v: 0, n: 0 }; e.v += r.v; e.n++; } };
		add(evalWithSeed(myOpts));
		for (let k = 1; k < cfg.seeds && !over(); k++) {
			const top = Object.entries(sum).sort((a, b) => b[1].v / b[1].n - a[1].v / a[1].n).slice(0, 3).map(([c]) => c);
			add(evalWithSeed(myOpts.filter(o => top.includes(o.choice))));
		}
		for (const mo of myOpts) { const e = sum[mo.choice]; if (e) results.push({ choice: mo.choice, v: e.v / e.n + (mo.base - 100) * 0.01 }); }
	} finally { searchSeed = null; }
	if (!results.length) return null;
	results.sort((a, b) => b.v - a.v);
	return results[0].choice;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
/** 탐색 깊이: 실력 0.9 이상이면 2턴 (테스트에서는 __searchDepth 로 진영별 지정) */
function searchDepth(me: 'p1' | 'p2', skill: number): number {
	const o = (globalThis as any).__searchDepth;
	if (o && o[me]) return o[me];
	return skill >= 0.9 ? 2 : 1;
}
/** 숙고 시간·난수 반복 횟수: 실력 0.9 이상은 최대 5초 (테스트에서는 __searchCfg 로 진영별 지정).
 *  같은 수를 다른 난수로 여러 번 돌려 평균 내는 것(seeds>1)은 자체 대전 360판에서 51.1%로 효과가 없어 기본은 1번 */
function searchCfg(me: 'p1' | 'p2', skill: number): { budget: number; seeds: number } {
	const o = (globalThis as any).__searchCfg?.[me];
	if (o) return { budget: o.budget ?? 5000, seeds: o.seeds ?? 8 };
	const b = (globalThis as any).__laBudget;
	return skill >= 0.9 ? { budget: b ?? 5000, seeds: 1 } : { budget: b ?? 700, seeds: 1 };
}
/** 한 턴 뒤 상태(c)에서 양쪽이 한 턴 더 두었을 때의 평가: 내 상위 후보 3개 중 최선 (상대는 상위 2개 가중 + 최악 25%) */
function secondTurn(c: any, battle: Battle, me: 'p1' | 'p2', skill: number, over: () => boolean = () => false): number | null {
	if (c.ended) return evalState(c, me);
	const foeId = me === 'p1' ? 'p2' : 'p1';
	const u = c[me].active[0], f = c[foeId].active[0];
	if (!u || !f || u.fainted || f.fainted) return null;
	const cands = (p: any, n: number) => {
		const req = p.getMoveRequestData();
		return moveOptions(c, p, req, flagsFor(Math.max(0.9, skill))).filter(o => /^move \d+$/.test(o.choice)).sort((a, b) => b.score - a.score).slice(0, n).map(o => o.choice);
	};
	let mine: string[], theirs: string[];
	try { mine = cands(u, 3); theirs = cands(f, 2); } catch { return null; }
	if (!mine.length || !theirs.length) return null;
	let ser1: any;
	try { ser1 = State.serializeBattle(c); } catch { return null; }
	let best = -Infinity;
	for (const a of mine) {
		if (over() && best > -Infinity) break;
		const vs: number[] = [];
		for (const t of theirs) { const v = simulateTurn(ser1, battle, me, a, t); if (v !== null) vs.push(v); }
		if (!vs.length) continue;
		const exp = vs.length === 2 ? vs[0] * 0.65 + vs[1] * 0.35 : vs[0];
		best = Math.max(best, exp * 0.75 + Math.min(...vs) * 0.25);
	}
	return best === -Infinity ? null : best;
}
