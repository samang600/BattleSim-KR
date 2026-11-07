/** 배틀 계산기 — 데미지 계산 · 스피드 비교 (9세대 계산식, 16난수) */
import { h, Fragment } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { TypeChart } from '../../../data/typechart';
import { speciesData, moveData, learnset, toID, abilityKo, itemKo, natureKo, natureData, calcStat, STAT_KO, STAT_SHORT, STATS, speciesKo,
	nickKo, allSpecies, typeKo, fixedTera, RAW, type Gen, type StatID } from '../data';
import { randomSetFor, evToSp, spToEv, type PSet } from '../sets';
import { loadTeams } from '../store';
import { Screen, Sprite, MiniSprite, TypeBadge, Modal, toast, CatIcon } from './core';
import { SetEditor, matches } from './teambuilder';

const GEN: Gen = 9;
type Boosts = { [k in StatID]?: number };
interface Side { set: PSet; boosts: Boosts; tera: boolean; status: string }
interface Field { weather: '' | 'sun' | 'rain' | 'sand' | 'snow'; terrain: '' | 'electric' | 'grassy' | 'psychic' | 'misty'; doubles: boolean; reflect: boolean; lightscreen: boolean; auroraveil: boolean; crit: boolean; helpinghand: boolean }

export function typeEff(moveType: string, defTypes: string[]) {
	let mult = 1;
	for (const t of defTypes) {
		const code = (TypeChart as any)[t.toLowerCase()]?.damageTaken?.[moveType];
		if (code === 1) mult *= 2; else if (code === 2) mult *= 0.5; else if (code === 3) mult *= 0;
	}
	return mult;
}
const boostMul = (b: number) => b >= 0 ? (2 + b) / 2 : 2 / (2 - b);
/** 메가스톤을 들고 있으면 메가진화 후 종족으로 계산 */
function effSpeciesId(set: PSet): string {
	const it = (RAW.items as any)[toID(set.item)];
	const sd = speciesData(toID(set.species), GEN);
	if (it?.mega && sd && it.megaFrom?.includes(sd.en)) { const mid = toID(it.mega); if (speciesData(mid, GEN)) return mid; }
	return toID(set.species);
}
function effAbility(set: PSet): string {
	const mid = effSpeciesId(set);
	return mid !== toID(set.species) ? speciesData(mid, GEN)!.ab[0] : toID(set.ability);
}
function stat(set: PSet, k: StatID) {
	const sd = speciesData(effSpeciesId(set), GEN)!;
	const nat = natureData(set.nature);
	const mul = nat?.p === k ? 1.1 : nat?.m === k ? 0.9 : 1;
	return calcStat(sd.bs[STATS.indexOf(k)], spToEv(evToSp(set.evs[k] || 0)), 31, set.level || 50, mul, k === 'hp');
}

export interface CalcResult { min: number; max: number; minPct: number; maxPct: number; rolls: number[]; eff: number; notes: string[]; hp: number }
export function calcDamage(atk: Side, def: Side, moveId: string, f: Field): CalcResult | null {
	const mv = moveData(moveId, GEN); if (!mv) return null;
	const as = speciesData(effSpeciesId(atk.set), GEN)!, ds = speciesData(effSpeciesId(def.set), GEN)!;
	const hp = stat(def.set, 'hp');
	const notes: string[] = [];
	if (mv.category === 'Status') return { min: 0, max: 0, minPct: 0, maxPct: 0, rolls: [], eff: 1, notes: ['변화 기술'], hp };
	let bp = mv.basePower;
	const id = mv.id;
	if (['lowkick', 'grassknot'].includes(id)) { const w = ds.wt; bp = w >= 200 ? 120 : w >= 100 ? 100 : w >= 50 ? 80 : w >= 25 ? 60 : w >= 10 ? 40 : 20; }
	if (id === 'heavyslam' || id === 'heatcrash') { const r = as.wt / Math.max(0.1, ds.wt); bp = r >= 5 ? 120 : r >= 4 ? 100 : r >= 3 ? 80 : r >= 2 ? 60 : 40; }
	if (id === 'gyroball') bp = Math.min(150, Math.floor(25 * stat(def.set, 'spe') * boostMul(def.boosts.spe || 0) / Math.max(1, stat(atk.set, 'spe') * boostMul(atk.boosts.spe || 0))) + 1);
	if (id === 'return' || id === 'frustration') bp = 102;
	if (id === 'facade' && atk.status) bp *= 2;
	if (id === 'hex' && def.status) bp *= 2;
	if (id === 'acrobatics' && !atk.set.item) bp *= 2;
	if (id === 'knockoff' && def.set.item) bp *= 1.5;
	if (id === 'weatherball' && f.weather) bp = 100;
	if (['seismictoss', 'nightshade'].includes(id)) { const d = atk.set.level || 50; return { min: d, max: d, minPct: d / hp * 100, maxPct: d / hp * 100, rolls: [d], eff: 1, notes: ['고정 데미지'], hp }; }
	if (id === 'dragonrage') return { min: 40, max: 40, minPct: 4000 / hp, maxPct: 4000 / hp, rolls: [40], eff: 1, notes: ['고정 데미지'], hp };
	if (!bp) return { min: 0, max: 0, minPct: 0, maxPct: 0, rolls: [], eff: 1, notes: ['위력이 상황에 따라 달라지는 기술'], hp };

	let moveType = mv.type;
	if (id.startsWith('hiddenpower')) moveType = mv.type;
	const aAb = effAbility(atk.set), dAb = effAbility(def.set), aItem = toID(atk.set.item), dItem = toID(def.set.item);
	if (effSpeciesId(atk.set) !== toID(atk.set.species)) notes.push(`공격측 메가진화(${speciesData(effSpeciesId(atk.set), GEN)!.n})`);
	if (effSpeciesId(def.set) !== toID(def.set.species)) notes.push(`방어측 메가진화(${speciesData(effSpeciesId(def.set), GEN)!.n})`);
	if (aAb === 'pixilate' && moveType === 'Normal') { moveType = 'Fairy'; bp *= 1.2; notes.push('페어리스킨'); }
	if (aAb === 'refrigerate' && moveType === 'Normal') { moveType = 'Ice'; bp *= 1.2; }
	if (aAb === 'aerilate' && moveType === 'Normal') { moveType = 'Flying'; bp *= 1.2; }
	if (aAb === 'galvanize' && moveType === 'Normal') { moveType = 'Electric'; bp *= 1.2; }
	if (aAb === 'normalize') moveType = 'Normal';
	if (aAb === 'technician' && bp <= 60) { bp *= 1.5; notes.push('테크니션'); }
	if (aAb === 'ironfist' && /punch|fist/.test(id)) bp *= 1.2;
	if (aAb === 'strongjaw' && /bite|crunch|fang/.test(id)) bp *= 1.5;
	if (aAb === 'sheerforce') { bp *= 1.3; notes.push('우격다짐(추가효과 있는 기술로 가정)'); }
	if (aAb === 'reckless' && /doubleedge|bravebird|flareblitz|woodhammer|headsmash|wildcharge|takedown|submission|volttackle|jumpkick|highjumpkick/.test(id)) bp *= 1.2;
	if (aAb === 'toughclaws' && mv.contact) bp *= 1.3;
	if (aAb === 'punkrock' && /boomburst|hypervoice|overdrive|snarl|bugbuzz|round/.test(id)) bp *= 1.3;
	if (aAb === 'sharpness' && /slash|cut|blade|sword|edge|cleave|scissor|psychocut|nightslash|aquacutter|leafblade|sacredsword|secretsword|kowtow|bitterblade|stoneaxe|ceaseless/.test(id)) bp *= 1.5;
	if (f.terrain === 'electric' && moveType === 'Electric') bp *= 1.3;
	if (f.terrain === 'grassy' && moveType === 'Grass') bp *= 1.3;
	if (f.terrain === 'psychic' && moveType === 'Psychic') bp *= 1.3;
	if (f.terrain === 'misty' && moveType === 'Dragon') bp *= 0.5;
	if (f.helpinghand) bp *= 1.5;
	if (aItem === 'lifeorb') notes.push('생명의구슬 ×1.3');
	const typeItems: { [k: string]: string } = { charcoal: 'Fire', mysticwater: 'Water', magnet: 'Electric', miracleseed: 'Grass', nevermeltice: 'Ice', blackbelt: 'Fighting', poisonbarb: 'Poison', softsand: 'Ground', sharpbeak: 'Flying', twistedspoon: 'Psychic', silverpowder: 'Bug', hardstone: 'Rock', spelltag: 'Ghost', dragonfang: 'Dragon', blackglasses: 'Dark', metalcoat: 'Steel', fairyfeather: 'Fairy', silkscarf: 'Normal' };
	if (typeItems[aItem] === moveType) bp *= 1.2;
	if (/plate$/.test(aItem) || /^(punchingglove)/.test(aItem)) bp *= 1.1;

	const physical = mv.category === 'Physical';
	const atkStat: StatID = id === 'bodypress' ? 'def' : physical ? 'atk' : 'spa';
	const defStat: StatID = (id === 'psyshock' || id === 'psystrike' || id === 'secretsword') ? 'def' : physical ? 'def' : 'spd';
	let A = stat(id === 'foulplay' ? def.set : atk.set, atkStat) * boostMul(f.crit ? Math.max(0, (id === 'foulplay' ? def : atk).boosts[atkStat] || 0) : ((id === 'foulplay' ? def : atk).boosts[atkStat] || 0));
	let D = stat(def.set, defStat) * boostMul(f.crit ? Math.min(0, def.boosts[defStat] || 0) : (def.boosts[defStat] || 0));
	if (physical && (aAb === 'hugepower' || aAb === 'purepower')) A *= 2;
	if (physical && aAb === 'hustle') A *= 1.5;
	if (physical && aAb === 'guts' && atk.status) A *= 1.5;
	if (!physical && aAb === 'solarpower' && f.weather === 'sun') A *= 1.5;
	if (aAb === 'flashfire' && moveType === 'Fire') notes.push('타오르는불꽃 발동 시 ×1.5 (미반영)');
	if (physical && aItem === 'choiceband') A *= 1.5;
	if (!physical && aItem === 'choicespecs') A *= 1.5;
	if (aItem === 'thickclub' && /marowak|cubone/.test(toID(atk.set.species)) && physical) A *= 2;
	if (aItem === 'lightball' && toID(atk.set.species) === 'pikachu') A *= 2;
	if (defStat === 'def' && dItem === 'eviolite' && !ds.fe) D *= 1.5;
	if (defStat === 'spd' && dItem === 'eviolite' && !ds.fe) D *= 1.5;
	if (defStat === 'spd' && dItem === 'assaultvest') D *= 1.5;
	if (defStat === 'spd' && f.weather === 'sand' && ds.t.includes('Rock')) D *= 1.5;
	if (defStat === 'def' && f.weather === 'snow' && ds.t.includes('Ice')) D *= 1.5;
	if (dAb === 'furcoat' && defStat === 'def') D *= 2;
	if (dAb === 'marvelscale' && def.status && defStat === 'def') D *= 1.5;
	if (defStat === 'def' && dItem === 'deepseascale') {}

	const L = atk.set.level || 50;
	let base = Math.floor(Math.floor(Math.floor(2 * L / 5 + 2) * Math.floor(bp) * Math.floor(A) / Math.max(1, Math.floor(D))) / 50) + 2;
	// 보정 순서: 범위 → 날씨 → 급소 → 난수 → 자속 → 상성 → 화상 → 기타
	if (f.doubles && ['allAdjacentFoes', 'allAdjacent'].includes(mv.target)) base = Math.floor(base * 0.75);
	if (f.weather === 'rain') base = Math.floor(base * (moveType === 'Water' ? 1.5 : moveType === 'Fire' ? 0.5 : 1));
	if (f.weather === 'sun') base = Math.floor(base * (moveType === 'Fire' ? 1.5 : moveType === 'Water' ? 0.5 : 1));
	if (f.crit) { base = Math.floor(base * 1.5); notes.push('급소'); }
	// 자속
	const aTypes = as.t;
	const teraType = atk.tera ? ((fixedTera(atk.set.species) || atk.set.teraType) || aTypes[0]) : '';
	let stab = 1;
	if (teraType && teraType !== 'Stellar') {
		if (moveType === teraType) stab = aTypes.includes(teraType) ? 2 : 1.5;
		else if (aTypes.includes(moveType)) stab = 1.5;
	} else if (aTypes.includes(moveType)) stab = 1.5;
	if (teraType === 'Stellar') stab = aTypes.includes(moveType) ? 2 : 1.2;
	if (aAb === 'adaptability' && stab === 1.5) stab = 2;
	// 상성
	let defTypes = def.tera ? [(fixedTera(def.set.species) || def.set.teraType) || ds.t[0]] : ds.t;
	if (def.tera && (fixedTera(def.set.species) || def.set.teraType) === 'Stellar') defTypes = ds.t;
	let eff = typeEff(moveType, defTypes);
	if (moveType === 'Ground' && (dAb === 'levitate' || dItem === 'airballoon')) eff = 0;
	if (dAb === 'wonderguard' && eff <= 1) eff = 0;
	if ((moveType === 'Water' && ['waterabsorb', 'dryskin', 'stormdrain'].includes(dAb)) || (moveType === 'Electric' && ['voltabsorb', 'motordrive', 'lightningrod'].includes(dAb)) ||
		(moveType === 'Fire' && dAb === 'flashfire') || (moveType === 'Grass' && dAb === 'sapsipper') || (moveType === 'Ground' && dAb === 'eartheater')) eff = 0;
	if (aAb === 'scrappy' && (moveType === 'Normal' || moveType === 'Fighting') && ds.t.includes('Ghost')) eff = typeEff(moveType, defTypes.filter(t => t !== 'Ghost'));
	if (id === 'freezedry' && defTypes.includes('Water')) eff = typeEff(moveType, defTypes.filter(t => t !== 'Water')) * 2;
	if (eff === 0) return { min: 0, max: 0, minPct: 0, maxPct: 0, rolls: [], eff: 0, notes: ['효과 없음'], hp };
	// 기타 보정
	let other = 1;
	if (physical && atk.status === 'brn' && aAb !== 'guts' && id !== 'facade') other *= 0.5;
	const screen = (physical && f.reflect) || (!physical && f.lightscreen) || f.auroraveil;
	if (screen && !f.crit && aAb !== 'infiltrator') other *= f.doubles ? 2 / 3 : 0.5;
	if (dAb === 'multiscale' || dAb === 'shadowshield') { other *= 0.5; notes.push('멀티스케일(HP 가득 가정)'); }
	if ((dAb === 'filter' || dAb === 'solidrock' || dAb === 'prismarmor') && eff > 1) other *= 0.75;
	if (dAb === 'thickfat' && (moveType === 'Fire' || moveType === 'Ice')) other *= 0.5;
	if (dAb === 'heatproof' && moveType === 'Fire') other *= 0.5;
	if (dAb === 'waterbubble' && moveType === 'Fire') other *= 0.5;
	if (dAb === 'fluffy') { if (mv.contact) other *= 0.5; if (moveType === 'Fire') other *= 2; }
	if (dAb === 'icescales' && !physical) other *= 0.5;
	if (dAb === 'punkrock' && /boomburst|hypervoice|overdrive|snarl|bugbuzz|round/.test(id)) other *= 0.5;
	if (aAb === 'tintedlens' && eff < 1) other *= 2;
	if (aAb === 'sniper' && f.crit) other *= 1.5;
	if (aItem === 'lifeorb') other *= 1.3;
	if (aItem === 'expertbelt' && eff > 1) other *= 1.2;
	if (aItem === 'muscleband' && physical) other *= 1.1;
	if (aItem === 'wiseglasses' && !physical) other *= 1.1;
	if (dItem && /berry$/.test(dItem) && eff > 1) notes.push('반감 열매는 미반영');
	const rolls: number[] = [];
	for (let r = 85; r <= 100; r++) {
		let d = Math.floor(base * r / 100);
		d = Math.floor(d * stab);
		d = Math.floor(d * eff);
		d = Math.floor(d * other);
		rolls.push(Math.max(1, d));
	}
	return { min: rolls[0], max: rolls[15], minPct: rolls[0] / hp * 100, maxPct: rolls[15] / hp * 100, rolls, eff, notes, hp };
}

/** n타 확정/난수 확률 */
export function koChance(rolls: number[], hp: number): string {
	if (!rolls.length) return '';
	for (let n = 1; n <= 6; n++) {
		if (rolls[0] * n >= hp) return `확정 ${n}타`;
		if (rolls[15] * n >= hp) {
			// 난수 확률(간단 근사: 독립 n회)
			let p = 0;
			if (n === 1) p = rolls.filter(r => r >= hp).length / 16;
			else {
				let count = 0, total = 0;
				const rec = (sum: number, depth: number) => { if (depth === n) { total++; if (sum >= hp) count++; return; } for (const r of rolls) rec(sum + r, depth + 1); };
				if (n <= 3) { rec(0, 0); p = count / total; } else { const avg = rolls.reduce((a, b) => a + b, 0) / 16; p = avg * n >= hp ? 0.5 : 0.25; }
			}
			return `난수 ${n}타 (${Math.round(p * 100)}%)`;
		}
	}
	return '7타 이상';
}

function defaultSide(species: string): Side {
	return { set: randomSetFor(species, GEN, 50), boosts: {}, tera: false, status: '' };
}

export function CalcScreen({ onBack }: { onBack: () => void }) {
	const [atk, setAtk] = useState<Side>(() => defaultSide('garchomp'));
	const [def, setDef] = useState<Side>(() => defaultSide('corviknight'));
	const [move, setMove] = useState<string>(() => atk.set.moves[0] || 'tackle');
	const [field, setField] = useState<Field>({ weather: '', terrain: '', doubles: false, reflect: false, lightscreen: false, auroraveil: false, crit: false, helpinghand: false });
	const [picker, setPicker] = useState<'atk' | 'def' | null>(null);
	const [editor, setEditor] = useState<'atk' | 'def' | null>(null);
	const [movePick, setMovePick] = useState(false);
	const [tab, setTab] = useState<'damage' | 'speed'>('damage');

	const res = useMemo(() => calcDamage(atk, def, move, field), [atk, def, move, field]);
	const swap = () => { setAtk(def); setDef(atk); setMove(def.set.moves[0] || 'tackle'); };

	if (picker) {
		return <SetPicker title={picker === 'atk' ? '공격 포켓몬' : '방어 포켓몬'} onBack={() => setPicker(null)} onPick={set => {
			const side: Side = { set, boosts: {}, tera: false, status: '' };
			if (picker === 'atk') { setAtk(side); setMove(set.moves[0] || 'tackle'); } else setDef(side);
			setPicker(null);
		}} />;
	}
	if (editor) {
		const side = editor === 'atk' ? atk : def;
		return <SetEditor set={side.set} gen={GEN} onBack={() => setEditor(null)} onDelete={() => setEditor(null)}
			onChange={s => { const ns = { ...side, set: s }; if (editor === 'atk') { setAtk(ns); if (!s.moves.includes(move)) setMove(s.moves[0] || 'tackle'); } else setDef(ns); }} />;
	}
	const boostRow = (side: Side, setSide: (s: Side) => void, keys: StatID[]) => <div class="boost-row">
		{keys.map(k => <div class="boost-cell"><span class="bc-label">{STAT_SHORT[k]} 랭크</span><span class="bc-ctl">
			<button onClick={() => setSide({ ...side, boosts: { ...side.boosts, [k]: Math.max(-6, (side.boosts[k] || 0) - 1) } })}>−</button>
			<b class={(side.boosts[k] || 0) > 0 ? 'up' : (side.boosts[k] || 0) < 0 ? 'down' : ''}>{(side.boosts[k] || 0) > 0 ? '+' : ''}{side.boosts[k] || 0}</b>
			<button onClick={() => setSide({ ...side, boosts: { ...side.boosts, [k]: Math.min(6, (side.boosts[k] || 0) + 1) } })}>+</button>
		</span></div>)}
	</div>;
	const sideCard = (label: string, side: Side, setSide: (s: Side) => void, which: 'atk' | 'def') => {
		const sd = speciesData(effSpeciesId(side.set), GEN)!;
		return <div class="calc-side">
			<div class="calc-head"><b class={'calc-role ' + which}>{which === 'atk' ? '⚔' : '🛡'} {label}</b>
				<button class="btn small" onClick={() => setPicker(which)}>포켓몬</button>
				<button class="btn small" onClick={() => setEditor(which)}>세트</button></div>
			<div class="calc-mon" onClick={() => setEditor(which)}>
				<MiniSprite species={side.set.species} gen={GEN} size={56} shiny={side.set.shiny} />
				<div class="calc-mon-info">
					<div class="cm-name"><b>{side.set.name || sd.n}</b><span class="muted small">Lv{side.set.level}</span>
						<span class="types">{sd.t.map(t => <TypeBadge type={t} small />)}{side.tera && (fixedTera(side.set.species) || side.set.teraType) && <><span class="small">→</span><TypeBadge type={(fixedTera(side.set.species) || side.set.teraType)} small /></>}</span></div>
					<div class="cm-meta"><span>{abilityKo(side.set.ability)}</span><span>{side.set.item ? itemKo(side.set.item) : '도구 없음'}</span><span>{natureKo(side.set.nature)}</span></div>
				</div>
			</div>
			<div class="stat-strip">{STATS.map(k => <div class={'ss ' + ((which === 'atk' ? (k === 'atk' || k === 'spa' || k === 'spe') : (k === 'hp' || k === 'def' || k === 'spd' || k === 'spe')) ? 'key' : '')}><span>{STAT_SHORT[k]}</span><b>{stat(side.set, k)}</b></div>)}</div>
			<div class="chips-row">
				<button class={'chipbtn' + (side.tera ? ' on' : '')} onClick={() => setSide({ ...side, tera: !side.tera })}>테라스탈 {typeKo((fixedTera(side.set.species) || side.set.teraType) || sd.t[0])}</button>
				{(which === 'atk' ? ['brn', 'par', 'psn'] : ['brn', 'par', 'psn', 'slp']).map(st => <button class={'chipbtn' + (side.status === st ? ' on' : '')} onClick={() => setSide({ ...side, status: side.status === st ? '' : st })}>{{ brn: '화상', par: '마비', psn: '독', slp: '잠듦' }[st]}</button>)}
			</div>
			{boostRow(side, setSide, which === 'atk' ? ['atk', 'spa', 'spe'] : ['def', 'spd', 'spe'])}
		</div>;
	};
	const md = moveData(move, GEN);
	const spdA = stat(atk.set, 'spe') * boostMul(atk.boosts.spe || 0) * (atk.status === 'par' ? 0.5 : 1) * (toID(atk.set.item) === 'choicescarf' ? 1.5 : 1);
	const spdD = stat(def.set, 'spe') * boostMul(def.boosts.spe || 0) * (def.status === 'par' ? 0.5 : 1) * (toID(def.set.item) === 'choicescarf' ? 1.5 : 1);
	return <Screen title="배틀 계산기" onBack={onBack} right={<button class="btn small" onClick={swap}>⇅ 교대</button>}>
		<div class="seg"><button class={tab === 'damage' ? 'on' : ''} onClick={() => setTab('damage')}>데미지</button><button class={tab === 'speed' ? 'on' : ''} onClick={() => setTab('speed')}>스피드</button></div>
		{sideCard('공격', atk, setAtk, 'atk')}
		{tab === 'damage' && <>
			<div class="calc-arrow">▼ 기술</div>
			<button class="option calc-move" onClick={() => setMovePick(true)}>
				{md && <span class="pm-icons"><TypeBadge type={md.type} small /><CatIcon cat={md.category} /></span>}
				<span class="opt-body"><b>{md?.name || move}</b><small>{md ? `위력 ${md.basePower || '—'} · 명중 ${md.accuracy || '—'}` : ''}</small></span>
				<span class="opt-badge">바꾸기 ▸</span>
			</button>
			<div class="calc-arrow">▼</div>
			{movePick && <Modal title="기술" onClose={() => setMovePick(false)}>
				<MoveList species={toID(atk.set.species)} current={atk.set.moves} onPick={m => { setMove(m); setMovePick(false); }} />
			</Modal>}
		</>}
		{sideCard('방어', def, setDef, 'def')}
		{tab === 'damage' && <>
			<h3 class="sec">필드</h3>
			<div class="chips-row">
				{([['', '날씨 없음'], ['sun', '쾌청'], ['rain', '비'], ['sand', '모래바람'], ['snow', '설경']] as const).map(([k, l]) => <button class={'chipbtn' + (field.weather === k ? ' on' : '')} onClick={() => setField({ ...field, weather: k })}>{l}</button>)}
			</div>
			<div class="chips-row">
				{([['', '필드 없음'], ['electric', '일렉트릭'], ['grassy', '그래스'], ['psychic', '사이코'], ['misty', '미스트']] as const).map(([k, l]) => <button class={'chipbtn' + (field.terrain === k ? ' on' : '')} onClick={() => setField({ ...field, terrain: k })}>{l}</button>)}
			</div>
			<div class="chips-row">
				{([['doubles', '더블(범위기 0.75)'], ['reflect', '리플렉터'], ['lightscreen', '빛의장막'], ['auroraveil', '오로라베일'], ['crit', '급소'], ['helpinghand', '도우미']] as const).map(([k, l]) =>
					<button class={'chipbtn' + ((field as any)[k] ? ' on' : '')} onClick={() => setField({ ...field, [k]: !(field as any)[k] })}>{l}</button>)}
			</div>
			<div class="calc-result">
				{res ? <>
					<div class="cr-main">{res.rolls.length ? `${res.min} ~ ${res.max}` : '—'}</div>
					<div class="cr-pct">{res.rolls.length ? `${res.minPct.toFixed(1)}% ~ ${res.maxPct.toFixed(1)}%  (HP ${res.hp})` : res.notes.join(', ')}</div>
					{res.rolls.length > 0 && <div class="cr-ko">{koChance(res.rolls, res.hp)}{res.eff !== 1 && ` · 상성 ×${res.eff}`}</div>}
					{res.notes.length > 0 && res.rolls.length > 0 && <div class="muted small">{res.notes.join(' · ')}</div>}
					<div class="muted small">난수 16개: {res.rolls.join(', ')}</div>
				</> : <div class="muted">기술을 고르세요</div>}
			</div>
			<p class="muted small">9세대 공식과 같은 순서로 계산합니다(범위→날씨→급소→난수→자속→상성→화상→기타). 일부 특성·도구는 미반영이며 결과에 표시합니다.</p>
		</>}
		{tab === 'speed' && <div class="calc-result">
			<div class="cr-main">{Math.floor(spdA)} <span class="muted small">vs</span> {Math.floor(spdD)}</div>
			<div class="cr-ko">{spdA === spdD ? '동속 (50%)' : spdA > spdD ? `${atk.set.name} 선공` : `${def.set.name} 선공`}</div>
			<div class="muted small">랭크·마비·구애스카프 반영. 트릭룸이면 반대.</div>
		</div>}
	</Screen>;
}

function MoveList({ species, current, onPick }: { species: string; current: string[]; onPick: (m: string) => void }) {
	const [q, setQ] = useState('');
	const moves = useMemo(() => learnset(species, GEN).map(id => moveData(id, GEN)!).filter(Boolean).sort((a, b) => b.basePower - a.basePower), [species]);
	const curSet = new Set(current);
	const shown = moves.filter(m => matches(q, m.name, m.id));
	return <div class="pick-list">
		<input class="search" placeholder="기술 검색" value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} />
		{current.map(id => moveData(id, GEN)).filter(Boolean).map(m => <button class="pick-row" onClick={() => onPick(m!.id)}><TypeBadge type={m!.type} small /><span class="pick-name">{m!.name} <small class="muted">(세트)</small></span><small class="mv-stats">{m!.category === 'Status' ? '변화' : m!.basePower}</small></button>)}
		{shown.filter(m => !curSet.has(m.id)).slice(0, 60).map(m => <button class="pick-row" onClick={() => onPick(m.id)}><TypeBadge type={m.type} small /><span class="pick-name">{m.name}</span><small class="mv-stats">{m.category === 'Status' ? '변화' : m.basePower}</small></button>)}
	</div>;
}

/** 저장된 팀의 세트 또는 종족으로 새 세트 */
function SetPicker({ title, onPick, onBack }: { title: string; onPick: (s: PSet) => void; onBack: () => void }) {
	const [q, setQ] = useState('');
	const teams = loadTeams();
	const list = useMemo(() => allSpecies(GEN).filter(s => s && !s.bo), []);
	const shown = q ? list.filter(s => s && matches(q, s.n, s.en)).slice(0, 40) : [];
	return <Screen top title={title} onBack={onBack}>
		<input class="search" placeholder="종족 검색 (초성 가능)" value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} autoFocus />
		{shown.length > 0 && <div class="pick-list">{shown.map(s => s && <button class="pick-row" onClick={() => onPick(randomSetFor(s.id, GEN, 50))}>
			<MiniSprite species={s.id} gen={GEN} size={40} /><span class="pick-name">{s.n}</span><span class="pick-types">{s.t.map(t => <TypeBadge type={t} small />)}</span></button>)}</div>}
		{!q && teams.map(t => <Fragment key={t.id}>
			<h3 class="sec">{t.name}</h3>
			<div class="pick-list">{t.sets.map(s => <button class="pick-row" onClick={() => onPick(JSON.parse(JSON.stringify(s)))}>
				<MiniSprite species={s.species} gen={GEN} size={40} shiny={s.shiny} /><span class="pick-name">{s.name || nickKo(s.species)}<small class="muted block">{abilityKo(s.ability)} · {itemKo(s.item)} · {natureKo(s.nature)}</small></span></button>)}</div>
		</Fragment>)}
		{!q && !teams.length && <p class="hint">저장된 팀이 없습니다. 위에서 종족을 검색하면 추천 세트로 시작합니다.</p>}
	</Screen>;
}
void speciesKo; void STAT_KO; void Sprite; void toast;
