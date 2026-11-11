/**
 * 배틀 프로토콜 한 줄 → 한글 메시지
 * (Pokémon Showdown 클라이언트의 BattleTextParser 를 단순화해 한국어 전용으로 다시 구현)
 */
import { RAW, toID, moveKo, abilityKo, itemKo, speciesKo, typeKo, STAT_KO } from './data';
import { josa } from './josa';

export type KWArgs = { [k: string]: string };
export interface ParsedLine { cmd: string; args: string[]; kw: KWArgs }

export function parseLine(line: string): ParsedLine | null {
	if (!line.startsWith('|')) return null;
	const parts = line.slice(1).split('|');
	const cmd = parts[0];
	const args: string[] = [cmd];
	const kw: KWArgs = {};
	for (let i = 1; i < parts.length; i++) {
		const p = parts[i];
		const m = /^\[([a-z]+)\]\s*(.*)$/.exec(p);
		if (m && i > 1) kw[m[1]] = m[2] === '' ? '1' : m[2]; // [silent] 같은 플래그는 '1'
		else args.push(p);
	}
	return { cmd, args, kw };
}

/** 한글 번역이 비어 있는 기본 메시지 보충 */
const DEFAULT_OVERRIDE: { [k: string]: string } = {
	startBattle: '{TRAINER1:conjunctive} {TRAINER2}의 승부가 시작되었다!',
	winBattle: '{TRAINER}의 승리!',
	tieBattle: '{TRAINER1:conjunctive} {TRAINER2}의 승부는 무승부!',
	fullName: '{NICKNAME}',
	turn: '── {NUMBER}턴 ──',
	cantNoMove: '{POKEMON:topic} 움직일 수 없다!',
	typeChangeFromEffect: '  {POKEMON:topic} {EFFECT} 때문에 {TYPE}타입이 됐다!',
	start: '  ({POKEMON}에게 {EFFECT}의 효과가 나타났다!)',
	activate: '  ({EFFECT}의 효과가 발동했다!)',
	startTeamEffect: '  ({TEAM}에게 {EFFECT}의 효과가 나타났다!)',
	endTeamEffect: '  ({TEAM}의 {EFFECT} 효과가 끝났다!)',
	startFieldEffect: '  ({EFFECT}의 효과가 나타났다!)',
	endFieldEffect: '  ({EFFECT}의 효과가 끝났다!)',
	eatItem: '  {POKEMON:topic} {ITEM:object} 먹었다!',
	removeItem: '  {POKEMON}의 {ITEM:subject} 없어졌다!',
	activateItem: '  ({POKEMON:topic} {ITEM:object} 사용했다!)',
	damagePercentage: '  ({POKEMON:topic} HP를 {PERCENTAGE}% 잃었다!)',
	healFromEffect: '  {POKEMON:topic} {EFFECT}로 HP를 회복했다!',
	boostFromItem: '  {ITEM}로 {POKEMON}의 {STAT:subject} 올라갔다!',
	boost2FromItem: '  {ITEM}로 {POKEMON}의 {STAT:subject} 크게 올라갔다!',
	boost3FromItem: '  {ITEM}로 {POKEMON}의 {STAT:subject} 매우 크게 올라갔다!',
	unboostFromItem: '  {ITEM}로 {POKEMON}의 {STAT:subject} 떨어졌다!',
	unboost2FromItem: '  {ITEM}로 {POKEMON}의 {STAT:subject} 크게 떨어졌다!',
	unboost3FromItem: '  {ITEM}로 {POKEMON}의 {STAT:subject} 매우 크게 떨어졌다!',
	hitCount: '  {NUMBER}번 맞았다!',
	noTarget: '  그러나 상대가 없다...',
	ohko: '  일격필살!',
	immune: '  {POKEMON}에게는 효과가 없는 것 같다...',
	fail: '  그러나 실패하고 말았다!!',
	terastallize: '  {POKEMON:topic} 테라스탈해서 {TYPE}타입이 되었다!',
	ultraBurst: '  {POKEMON:subject} 빛을 발하며 울트라버스트했다!',
	setHpMax: '  {POKEMON}의 {STAT:subject} 최대로 올라갔다!',
	nothing: '  그러나 아무 일도 일어나지 않았다!',
};
const EFFECT_OVERRIDE: { [id: string]: { [k: string]: string } } = {
	brickbreak: { activate: '  {POKEMON:topic} {TEAM}의 벽을 깨뜨렸다!' },
	conversion: { typeChange: '  {SOURCE}{SOURCE:conjunctive} 같은 타입이 되었다!' },
	pursuit: { activate: '  ({TARGET:topic} 교체하려 하고 있다...)' },
	roost: { start: '' },
	protect: { start: '  {POKEMON:topic} 방어 태세에 들어갔다!', block: '  {POKEMON:topic} 공격으로부터 몸을 지켰다!' },
	maxguard: { activate: '  {POKEMON:topic} 공격으로부터 몸을 지켰다!' },
	healblock: { start: '  {POKEMON:topic} 회복 동작을 봉인당했다!' },
	mistyterrain: { block: '  {POKEMON:topic} 미스트필드가 지켜 주고 있다!' },
	electricterrain: { block: '  {POKEMON:topic} 일렉트릭필드가 지켜 주고 있다!' },
	wrap: { move: '{POKEMON}의 공격이 계속된다!' },
	naturalcure: { activate: '  ({POKEMON:topic} 자연회복으로 상태 이상이 나았다!)' },
	forewarn: { activateNoTarget: '  {POKEMON:topic} {MOVE:object} 간파했다!' },
	persistent: { activate: '  {POKEMON:topic} {MOVE}의 효과를 2턴 늘렸다!' },
	intimidate: {},
	dynamax: { start: '  {POKEMON:topic} 다이맥스했다!', end: '  {POKEMON:topic} 원래 모습으로 돌아왔다!' },
	partiallytrapped: {},
	sitrusberry: {},
};

const STATUS_KO: { [id: string]: string } = {
	brn: '화상', par: '마비', slp: '잠듦', frz: '얼음', psn: '독', tox: '맹독',
	confusion: '혼란', partiallytrapped: '조이기', trapped: '도망칠 수 없음', mustrecharge: '반동',
	lockedmove: '난동', perish: '멸망의노래', stall: '방어', typechange: '타입 변화',
};

export function effectInfo(raw: string | undefined) {
	if (!raw) return { id: '', name: '', kind: '' };
	let kind = '';
	let name = raw;
	const m = /^(move|ability|item|pokemon):\s*(.*)$/.exec(raw);
	if (m) { kind = m[1]; name = m[2]; }
	const id = toID(name);
	let ko = '';
	if (kind === 'ability') ko = abilityKo(id);
	else if (kind === 'item') ko = itemKo(id);
	else if (kind === 'move') ko = moveKo(name);
	else if (STATUS_KO[id]) ko = STATUS_KO[id];
	else if (RAW.moves[id]) ko = moveKo(id);
	else if (RAW.abilities[id]) ko = abilityKo(id);
	else if (RAW.items[id]) ko = itemKo(id);
	else if (RAW.text[id]?.weatherName) ko = RAW.text[id].weatherName;
	else ko = name;
	if (!kind) kind = RAW.moves[id] ? 'move' : RAW.abilities[id] ? 'ability' : RAW.items[id] ? 'item' : '';
	return { id, name: ko, kind };
}

export interface TextContext {
	gen: number;
	ownSide: string; // 'p1'
	trainerName(side: string): string;
	doubles: boolean;
}

export class KoreanText {
	weather = '';
	justDynamaxed = '';
	constructor(public ctx: TextContext) {}

	private lookup(entry: any, type: string): string | null | undefined {
		if (!entry) return undefined;
		for (let g = this.ctx.gen; g <= 9; g++) {
			const sub = entry['gen' + g];
			if (sub && sub[type] !== undefined) return sub[type];
		}
		return entry[type];
	}

	/** 효과(namespace) 별 템플릿 → 없으면 기본 */
	template(type: string, ...namespaces: (string | undefined)[]): string {
		for (const ns of namespaces) {
			if (!ns) continue;
			const id = effectInfo(ns).id;
			const ov = EFFECT_OVERRIDE[id]?.[type];
			if (ov !== undefined) return ov;
			const t = this.lookup(RAW.text[id], type);
			if (typeof t === 'string') {
				if (t.startsWith('#')) return this.template(type, t.slice(1));
				return t;
			}
		}
		const d = RAW.defaultText[type];
		if (typeof d === 'string') return d;
		return DEFAULT_OVERRIDE[type] ?? '';
	}
	hasTemplate(type: string, ns: string) {
		const id = effectInfo(ns).id;
		return EFFECT_OVERRIDE[id]?.[type] !== undefined || typeof this.lookup(RAW.text[id], type) === 'string';
	}

	sideOf(ident: string) { return ident.slice(0, 2); }
	nickname(ident: string) {
		const i = ident.indexOf(': ');
		return i >= 0 ? ident.slice(i + 2) : ident;
	}
	pokemon(ident: string | undefined) {
		if (!ident) return '';
		const nick = this.nickname(ident);
		if (!/^p\d/.test(ident)) return nick;
		if (this.sideOf(ident) === this.ctx.ownSide) return nick;
		return (RAW.defaultText.opposingPokemon || '상대 {NICKNAME}').replace('{NICKNAME}', nick);
	}
	team(side: string) {
		return side.startsWith(this.ctx.ownSide) ? (RAW.defaultText.team || '우리 편') : (RAW.defaultText.opposingTeam || '상대');
	}

	fill(template: string, vals: { [k: string]: string | number | undefined }): string {
		if (!template) return '';
		let out = template.replace(/\{([A-Z0-9]+)((?::[a-z]+)*)\}/g, (_m, key: string, mods: string) => {
			if (key === 'INFLECT') return '';
			let v = vals[key];
			if (v === undefined) v = '';
			let s = String(v);
			for (const mod of mods.split(':').filter(Boolean)) s = josa(s, mod);
			return s;
		});
		out = out.replace(/\*\*/g, '');
		return out;
	}

	/** 줄 맨 앞 공백 2칸은 '이어지는 메시지' 표시 → 제거 */
	private clean(s: string) {
		return s.split('\n').map(l => l.replace(/^\s+/, '')).filter(Boolean).join('\n');
	}

	abilityLine(ident: string | undefined, ability: string) {
		if (!ident) return '';
		return this.fill(this.template('abilityActivation'), { POKEMON: this.pokemon(ident), ABILITY: effectInfo(ability).name });
	}

	/** kw.from 이 특성이면 "[X의 특성]" 한 줄 */
	private fromAbility(kw: KWArgs, ident?: string) {
		const from = effectInfo(kw.from);
		if (from.kind !== 'ability') return '';
		return this.abilityLine(kw.of || ident, kw.from) + '\n';
	}

	/** 반환: 화면에 보여줄 메시지 (없으면 '') */
	render(p: ParsedLine, prevActive?: { ident: string; fainted: boolean } | null): string {
		const { cmd, args, kw } = p;
		const T = (type: string, ...ns: (string | undefined)[]) => this.template(type, ...ns);
		const F = (t: string, v: { [k: string]: any }) => this.clean(this.fill(t, v));
		const pk = (x?: string) => this.pokemon(x);
		switch (cmd) {
		case 'start': {
			return F(T('startBattle'), { TRAINER1: this.ctx.trainerName('p1'), TRAINER2: this.ctx.trainerName('p2') });
		}
		case 'turn':
			return F(T('turn'), { NUMBER: args[1] });
		case 'win':
			return F(T('winBattle'), { TRAINER: args[1] });
		case 'tie':
			return F(T('tieBattle'), { TRAINER1: this.ctx.trainerName('p1'), TRAINER2: this.ctx.trainerName('p2') });
		case 'switch': case 'drag': case 'replace': {
			if (cmd === 'replace') return '';
			const ident = args[1];
			const side = this.sideOf(ident);
			const species = speciesKo(args[2].split(',')[0]);
			const nick = this.nickname(ident);
			const fullname = nick === species || species.startsWith(nick) || species.includes(nick) ? nick : `${nick}(${species})`;
			let out = '';
			if (prevActive && !prevActive.fainted && cmd === 'switch') {
				const fromEffect = kw.from ? '' : '';
				out += (side === this.ctx.ownSide ?
					F(T('switchOutOwn'), { NICKNAME: this.nickname(prevActive.ident) }) :
					F(T('switchOut'), { TRAINER: this.ctx.trainerName(side), NICKNAME: this.nickname(prevActive.ident) })) + fromEffect + '\n';
			}
			if (cmd === 'drag') return out + F(T('drag'), { FULLNAME: fullname });
			if (side === this.ctx.ownSide) return out + F(T('switchInOwn'), { FULLNAME: fullname });
			return out + F(T('switchIn'), { TRAINER: this.ctx.trainerName(side), FULLNAME: fullname });
		}
		case 'faint':
			return F(T('faint'), { POKEMON: pk(args[1]) });
		case 'swap':
			if (!args[2] || /^\d+$/.test(args[2])) return F(T('swapCenter'), { POKEMON: pk(args[1]) });
			return F(T('swap'), { POKEMON: pk(args[1]), TARGET: pk(args[2]) });
		case 'move': {
			const [, user, move, target] = args;
			let out = this.fromAbility(kw, user);
			if (kw.zeffect) out += F(T('zEffect'), { POKEMON: pk(user) }) + '\n';
			const from = effectInfo(kw.from);
			let tpl = T('move');
			if (from.id === 'magiccoat' || from.id === 'magicbounce') tpl = T('move', 'magiccoat');
			out += F(tpl, { POKEMON: pk(user), MOVE: moveKo(move), TARGET: pk(target) });
			if (kw.notarget && this.ctx.gen <= 5) out += '\n' + F(T('noTarget'), {});
			return out;
		}
		case 'cant': {
			const [, ident, reason, move] = args;
			const tpl = (reason && this.hasTemplate('cant', reason)) ? T('cant', reason) : (move ? T('cant') : T('cantNoMove'));
			return this.fromAbility(kw, ident) + F(tpl, { POKEMON: pk(ident), MOVE: move ? moveKo(move) : '' });
		}
		case '-fail': {
			const [, ident, effect, stat] = args;
			const eff = effectInfo(effect);
			let pre = this.fromAbility(kw, ident);
			if (['brn', 'par', 'psn', 'tox', 'slp', 'frz', 'confusion', 'substitute'].includes(eff.id)) {
				return pre + F(T('alreadyStarted', eff.id), { POKEMON: pk(ident) });
			}
			if (eff.id === 'unboost') {
				return pre + F(stat ? T('fail', 'unboost') : T('failNoStat', 'unboost'), { POKEMON: pk(ident), STAT: STAT_KO[stat] || stat });
			}
			if (kw.from && effectInfo(kw.from).kind === 'ability') pre = this.fromAbility(kw, kw.of || ident);
			return pre + F(T('fail', eff.id), { POKEMON: pk(ident) });
		}
		case '-notarget':
			return F(T('noTarget'), {});
		case '-miss':
			if (args[2]) return F(T('miss'), { POKEMON: pk(args[2]) });
			return F(T('missNoPokemon'), { SOURCE: pk(args[1]) });
		case '-damage': {
			const [, ident] = args;
			if (!kw.from) return '';
			const from = effectInfo(kw.from);
			if (kw.partiallytrapped) return F(T('damageFromPartialTrapping'), { POKEMON: pk(ident), MOVE: from.name });
			if (from.kind === 'item' && kw.of && this.hasTemplate('damage', from.id) === false) {
				return F(T('damageFromPokemon'), { POKEMON: pk(ident), ITEM: from.name, SOURCE: pk(kw.of) });
			}
			if (this.hasTemplate('damage', from.id)) {
				return this.fromAbility(kw, kw.of || ident) + F(T('damage', from.id), { POKEMON: pk(ident), SOURCE: pk(kw.of), ITEM: from.name });
			}
			if (from.kind === 'item') return F(T('damageFromItem'), { POKEMON: pk(ident), ITEM: from.name });
			if (from.kind === 'ability') return this.fromAbility(kw, kw.of || ident) + F(T('damage'), { POKEMON: pk(ident) });
			return F(T('damage'), { POKEMON: pk(ident) });
		}
		case '-heal': {
			const [, ident] = args;
			if ('silent' in kw || this.justDynamaxed === ident) { this.justDynamaxed = ''; return ''; }
			const from = effectInfo(kw.from);
			if (kw.wisher) return F(T('heal', 'wish'), { POKEMON: pk(ident), NICKNAME: kw.wisher });
			if (from.id && this.hasTemplate('heal', from.id)) {
				return this.fromAbility(kw, ident) + F(T('heal', from.id), { POKEMON: pk(ident), SOURCE: pk(kw.of), ITEM: from.name });
			}
			if (from.kind === 'item') return F(T('healFromEffect'), { POKEMON: pk(ident), EFFECT: from.name });
			if (from.kind === 'ability') return this.fromAbility(kw, ident) + F(T('heal'), { POKEMON: pk(ident) });
			return F(T('heal'), { POKEMON: pk(ident) });
		}
		case '-sethp': {
			const from = effectInfo(kw.from);
			if (from.id === 'painsplit') return F(T('activate', 'painsplit'), {});
			return '';
		}
		case '-boost': case '-unboost': {
			const [, ident, stat, numStr] = args;
			if ('silent' in kw) return '';
			const n = parseInt(numStr, 10);
			let id = cmd === '-boost' ? 'boost' : 'unboost';
			if (!n) id += '0';
			else if (n >= 3) id += '3';
			else if (n === 2) id += '2';
			const from = effectInfo(kw.from);
			const vals = { POKEMON: pk(ident), STAT: STAT_KO[stat] || stat, ITEM: from.name };
			if (from.kind === 'item') return F(T(id + 'FromItem'), vals);
			if (kw.zeffect) return F(T(id + 'FromZEffect'), vals);
			const pre = from.kind === 'ability' ? this.abilityLine(kw.of || ident, kw.from) + '\n' : '';
			if (from.id && this.hasTemplate(id, from.id)) return pre + F(T(id, from.id), vals);
			return pre + F(T(id), vals);
		}
		case '-setboost': {
			const [, ident, stat] = args;
			const from = effectInfo(kw.from);
			if (from.id && this.hasTemplate('boost', from.id)) return F(T('boost', from.id), { POKEMON: pk(ident), STAT: STAT_KO[stat] });
			return this.fromAbility(kw, ident) + F(DEFAULT_OVERRIDE.setHpMax, { POKEMON: pk(ident), STAT: STAT_KO[stat] || stat });
		}
		case '-swapboost': {
			const from = effectInfo(kw.from);
			let tpl = T('swapBoost');
			if (from.id === 'powerswap') tpl = T('swapOffensiveBoost');
			if (from.id === 'guardswap') tpl = T('swapDefensiveBoost');
			if (from.id && this.hasTemplate('activate', from.id)) tpl = T('activate', from.id);
			return F(tpl, { POKEMON: pk(args[1]), TARGET: pk(args[2]) });
		}
		case '-copyboost':
			return F(T('copyBoost'), { POKEMON: pk(args[1]), TARGET: pk(args[2]) });
		case '-clearboost': case '-clearpositiveboost': case '-clearnegativeboost':
			return F(T('clearBoost'), { POKEMON: pk(args[1]) });
		case '-clearallboost':
			return F(T('clearAllBoost'), {});
		case '-invertboost':
			return F(T('invertBoost'), { POKEMON: pk(args[1]) });
		case '-crit':
			return F(this.ctx.doubles && args[1] ? T('critSpread') : T('crit'), { POKEMON: pk(args[1]) });
		// 세 번째 칸 = 상성 단계(2 이상이면 4배 약점 / 4분의 1)
		case '-supereffective': {
			const t = this.ctx.doubles && args[1] ? T('superEffectiveSpread') : T('superEffective');
			return F(+args[2] >= 2 ? t.replace('굉장했다!', '매우 굉장했다!!') : t, { POKEMON: pk(args[1]) });
		}
		case '-resisted': {
			const t = this.ctx.doubles && args[1] ? T('resistedSpread') : T('resisted');
			return F(+args[2] >= 2 ? t.replace('별로인', '매우 별로인') : t, { POKEMON: pk(args[1]) });
		}
		case '-immune': {
			const [, ident] = args;
			const from = effectInfo(kw.from);
			if (kw.ohko) return F(T('immuneOHKO'), { POKEMON: pk(ident) });
			if (from.kind === 'ability') {
				const pre = this.abilityLine(kw.of || ident, kw.from) + '\n';
				if (this.hasTemplate('block', from.id)) return pre + F(T('block', from.id), { POKEMON: pk(ident), SOURCE: pk(kw.of) });
				return pre + F(T('immune'), { POKEMON: pk(ident) });
			}
			return F(T('immune'), { POKEMON: pk(ident) });
		}
		case '-item': {
			const [, ident, item] = args;
			const it = effectInfo('item: ' + item);
			const from = effectInfo(kw.from);
			if (from.id === 'frisk') {
				return this.abilityLine(kw.of, 'ability: Frisk') + '\n' +
					F(kw.of ? T('activate', 'frisk') : T('activateNoTarget', 'frisk'), { POKEMON: pk(kw.of), TARGET: pk(ident), ITEM: it.name });
			}
			if (from.id === 'trick' || from.id === 'switcheroo') return F(T('addItem'), { POKEMON: pk(ident), ITEM: it.name });
			if (from.id) return this.fromAbility(kw, ident) + F(T('takeItem'), { POKEMON: pk(ident), ITEM: it.name, SOURCE: pk(kw.of) });
			if (this.hasTemplate('start', it.id)) return F(T('start', it.id), { POKEMON: pk(ident), ITEM: it.name });
			return F(T('addItem'), { POKEMON: pk(ident), ITEM: it.name });
		}
		case '-enditem': {
			const [, ident, item] = args;
			if ('silent' in kw) return '';
			const it = effectInfo('item: ' + item);
			const from = effectInfo(kw.from);
			if (kw.eat || (it.id.endsWith('berry') && !from.id)) return F(T('eatItem', it.id), { POKEMON: pk(ident), ITEM: it.name });
			if (kw.weaken) return F(T('activateWeaken'), { POKEMON: pk(ident), ITEM: it.name });
			if (from.id === 'stealeat' || from.id === 'bugbite' || from.id === 'pluck') {
				return F(T('removeItem', 'bugbite'), { SOURCE: pk(kw.of), ITEM: it.name, POKEMON: pk(ident) });
			}
			if (from.id && this.hasTemplate('removeItem', from.id)) {
				return F(T('removeItem', from.id), { POKEMON: pk(ident), ITEM: it.name, SOURCE: pk(kw.of) });
			}
			if (from.id === 'gem' || it.id.endsWith('gem')) return F(T('useGem'), { POKEMON: pk(ident), ITEM: it.name, MOVE: moveKo(kw.move || '') });
			if (this.hasTemplate('end', it.id)) return F(T('end', it.id), { POKEMON: pk(ident), ITEM: it.name });
			if (from.id) return F(T('removeItem'), { POKEMON: pk(ident), ITEM: it.name });
			return F(T('activateItem'), { POKEMON: pk(ident), ITEM: it.name });
		}
		case '-ability': {
			const [, ident, ability, extra] = args;
			const ab = effectInfo('ability: ' + ability);
			const from = effectInfo(kw.from);
			if ('silent' in kw) return '';
			if (from.id === 'trace' || from.id === 'roleplay' || from.id === 'skillswap' || from.id === 'entrainment') {
				if (from.id === 'trace') return this.abilityLine(ident, 'ability: Trace') + '\n' + F(T('changeAbility', 'trace'), { POKEMON: pk(ident), SOURCE: pk(kw.of), ABILITY: ab.name });
				return F(T('changeAbility'), { POKEMON: pk(ident), ABILITY: ab.name });
			}
			if (from.id && from.kind !== 'ability') return F(T('changeAbility'), { POKEMON: pk(ident), ABILITY: ab.name });
			let out = this.abilityLine(ident, 'ability: ' + ability);
			if (extra === 'boost') return out;
			if (this.hasTemplate('start', ab.id)) out += '\n' + F(T('start', ab.id), { POKEMON: pk(ident), TEAM: this.team(this.sideOf(ident) === 'p1' ? 'p2' : 'p1') });
			return out;
		}
		case '-endability':
			return '';
		case '-transform':
			return F(T('transform', 'transform'), { POKEMON: pk(args[1]), SPECIES: speciesKo(this.nickname(args[2])) });
		case '-mega': {
			const [, ident, , item] = args;
			if (!item) return F('{POKEMON:topic} 강한 바람에 휩싸였다!', { POKEMON: pk(ident) }); // 레쿠쟈(화룡점정): 메가스톤 없음
			return F(T('mega'), { POKEMON: pk(ident), ITEM: itemKo(item || ''), TRAINER: this.ctx.trainerName(this.sideOf(ident)) });
		}
		case '-primal':
			return F(T('primal'), { POKEMON: pk(args[1]) });
		case '-burst':
			return F(DEFAULT_OVERRIDE.ultraBurst, { POKEMON: pk(args[1]) });
		case '-zpower':
			return F(T('zPower'), { POKEMON: pk(args[1]) });
		case '-zbroken':
			return F(T('zBroken'), { POKEMON: pk(args[1]) });
		case '-terastallize':
			return F(DEFAULT_OVERRIDE.terastallize, { POKEMON: pk(args[1]), TYPE: typeKo(args[2]) });
		case '-formechange': case 'detailschange': {
			const sp = (args[2] || '').split(',')[0];
			if (cmd === 'detailschange' && /-Mega/.test(sp)) {
				return F(T('transformMega'), { POKEMON: pk(args[1]), SPECIES: speciesKo(sp).replace(/^메가/, '').replace(/\(([^)]*)\)$/, '') || speciesKo(sp.replace(/-Mega.*$/, '')) });
			}
			if (!kw.msg) return '';
			const from = effectInfo(kw.from);
			if (from.id && this.hasTemplate('transform', from.id)) return F(T('transform', from.id), { POKEMON: pk(args[1]) });
			return F(T('transform'), { POKEMON: pk(args[1]) });
		}
		case '-start': {
			const [, ident, effect, arg3] = args;
			if ('silent' in kw) return '';
			const eff = effectInfo(effect);
			if (eff.id === 'dynamax') { this.justDynamaxed = ident; if (arg3 === 'Gmax') return F('{POKEMON:topic} 거다이맥스했다!', { POKEMON: pk(ident) }); }
			const from = effectInfo(kw.from);
			const vals: any = { POKEMON: pk(ident), EFFECT: eff.name, SOURCE: pk(kw.of), MOVE: '', NUMBER: '', TYPE: '' };
			if (eff.id === 'typechange') {
				vals.TYPE = arg3 ? arg3.split('/').map(typeKo).join('·') : '';
				if (from.id === 'conversion' || from.id === 'reflecttype') return F(T('typeChange'), vals);
				if (from.kind === 'ability') return this.fromAbility(kw, ident) + F(T('typeChange'), vals);
				return F(T('typeChange'), vals);
			}
			if (eff.id === 'typeadd') { vals.TYPE = typeKo(arg3); return F(T('typeAdd'), vals); }
			const qd = /^(quarkdrive|protosynthesis)(atk|def|spa|spd|spe)$/.exec(eff.id);
			if (qd) return this.abilityLine(ident, 'ability: ' + (qd[1] === 'quarkdrive' ? 'Quark Drive' : 'Protosynthesis')) + '\n' + F('  {POKEMON}의 {STAT:subject} 강화되었다!', { POKEMON: pk(ident), STAT: STAT_KO[qd[2]] });
			if (/^perish\d$/.test(eff.id)) return F(T('activate', 'perishsong'), { POKEMON: pk(ident), NUMBER: eff.id.slice(6) });
			if (/^stockpile\d$/.test(eff.id)) return F(T('start', 'stockpile'), { POKEMON: pk(ident), NUMBER: eff.id.slice(9) });
			if (/^stockpile\d$/.test(effectInfo(eff.name).id)) return '';
			if (arg3) {
				if (/^p\d[a-c]?:/.test(arg3)) vals.TARGET = pk(arg3);
				else vals.MOVE = moveKo(arg3);
			}
			let id = 'start';
			if (kw.already) id = 'alreadyStarted';
			if (kw.fatigue) id = 'startFromFatigue';
			if (kw.upkeep) id = 'upkeep';
			if (kw.zeffect) id = 'startFromZEffect';
			if (from.kind === 'item' && this.hasTemplate('startFromItem', eff.id)) { id = 'startFromItem'; vals.ITEM = from.name; }
			const pre = from.kind === 'ability' ? this.fromAbility(kw, kw.of || ident) : '';
			if (this.hasTemplate(id, eff.id)) return pre + F(T(id, eff.id), vals);
			if (eff.id === 'flashfire' || from.id === 'flashfire') return pre + F(T('start', 'flashfire'), vals);
			return pre + F(T(id === 'start' ? 'start' : id), vals);
		}
		case '-end': {
			const [, ident, effect] = args;
			if ('silent' in kw) return '';
			const eff = effectInfo(effect);
			const from = effectInfo(kw.from);
			const vals: any = { POKEMON: pk(ident), EFFECT: eff.name, SOURCE: pk(kw.of), MOVE: eff.name, ITEM: from.name };
			if (/^stockpile/.test(eff.id)) return F(T('end', 'stockpile'), vals);
			if (/^perish/.test(eff.id)) return '';
			if (from.kind === 'item' && this.hasTemplate('endFromItem', eff.id)) return F(T('endFromItem', eff.id), vals);
			if (kw.partiallytrapped) return F(T('end'), vals);
			if (this.hasTemplate('end', eff.id)) return F(T('end', eff.id), vals);
			return F(T('end'), vals);
		}
		case '-activate': {
			const [, ident, effect, a3, a4] = args;
			const eff = effectInfo(effect);
			const vals: any = { POKEMON: pk(ident), EFFECT: eff.name, SOURCE: pk(kw.of), TARGET: pk(kw.of), MOVE: '', NUMBER: a4 || '', ITEM: '' };
			if (a3) {
				if (/^p\d[a-c]?:/.test(a3)) vals.TARGET = pk(a3);
				else if (eff.id === 'trick' || eff.id === 'switcheroo' || eff.id === 'poltergeist') vals.ITEM = itemKo(a3);   // 폴터가이스트: 상대 도구 이름
				else vals.MOVE = moveKo(a3);
			}
			if (eff.id === 'spite') { vals.TARGET = pk(ident); }
			if (eff.id === 'lockon' || eff.id === 'mindreader') return F(T('start', eff.id), { POKEMON: pk(ident), SOURCE: pk(kw.of) });
			let id = 'activate';
			// 막아 냄: [block] 표시가 없어도 막는 메시지만 있는 효과(방어 계열, 필드가 선공기·상태이상을 막을 때 "~는 사이코필드가 지켜 주고 있다!")
			if (kw.block || (!this.hasTemplate('activate', eff.id) && this.hasTemplate('block', eff.id))) id = 'block';
			if (kw.upkeep) id = 'upkeep';
			if (kw.damage && eff.id !== 'substitute') id = 'damage';
			const pre = eff.kind === 'ability' ? this.abilityLine(ident, effect) + '\n' : '';
			if (this.hasTemplate(id, eff.id)) return pre + F(T(id, eff.id), vals);
			// 조이기 계열: activate 대신 start 메시지
			if (this.hasTemplate('start', eff.id) && eff.kind === 'move') return pre + F(T('start', eff.id), vals);
			if (eff.kind === 'ability') return pre.trim();
			if (eff.kind === 'item') return F(T('activateItem'), { POKEMON: pk(ident), ITEM: eff.name });
			return '';
		}
		case '-sidestart': case '-sideend': {
			const [, side, effect] = args;
			const eff = effectInfo(effect);
			const type = cmd === '-sidestart' ? 'start' : 'end';
			const vals = { TEAM: this.team(side), EFFECT: eff.name, POKEMON: pk(kw.of) };
			if (this.hasTemplate(type, eff.id)) return F(T(type, eff.id), vals);
			return F(T(type === 'start' ? 'startTeamEffect' : 'endTeamEffect'), vals);
		}
		case '-weather': {
			const [, weather] = args;
			if (!weather || weather === 'none') {
				const prev = this.weather;
				this.weather = '';
				return prev ? F(T('end', prev), {}) : '';
			}
			const w = effectInfo(weather);
			if (kw.upkeep) return F(T('upkeep', w.id), {});
			this.weather = w.id;
			const pre = this.fromAbility(kw, kw.of);
			return pre + F(T('start', w.id), {});
		}
		case '-fieldstart': case '-fieldend': {
			const eff = effectInfo(args[1]);
			const type = cmd === '-fieldstart' ? 'start' : 'end';
			const vals = { POKEMON: pk(kw.of), EFFECT: eff.name };
			if (this.hasTemplate(type, eff.id)) return this.fromAbility(kw, kw.of) + F(T(type, eff.id), vals);
			return F(T(type === 'start' ? 'startFieldEffect' : 'endFieldEffect'), vals);
		}
		case '-fieldactivate': {
			const eff = effectInfo(args[1]);
			if (eff.id === 'perishsong') return F(T('start', 'perishsong'), {});
			if (this.hasTemplate('activate', eff.id)) return F(T('activate', eff.id), {});
			return F(T('activate'), { EFFECT: eff.name });
		}
		case '-singleturn': case '-singlemove': {
			const [, ident, effect] = args;
			const eff = effectInfo(effect);
			const vals = { POKEMON: pk(ident), SOURCE: pk(kw.of), EFFECT: eff.name };
			if (this.hasTemplate('start', eff.id)) return F(T('start', eff.id), vals);
			return '';
		}
		case '-prepare': {
			const [, ident, move, target] = args;
			const id = toID(move);
			if (this.hasTemplate('prepare', id)) return F(T('prepare', id), { POKEMON: pk(ident), TARGET: pk(target) });
			return '';
		}
		case '-hitcount':
			return F(T('hitCount'), { NUMBER: args[2] });
		case '-ohko':
			return F(T('ohko'), {});
		case '-center':
			return F(T('center'), {});
		case '-combine':
			return F(T('combine'), {});
		case '-nothing':
			return F(DEFAULT_OVERRIDE.nothing, {});
		case '-cureteam': {
			const from = effectInfo(kw.from);
			if (from.id && this.hasTemplate('activate', from.id)) return F(T('activate', from.id), { POKEMON: pk(args[1]) });
			return '';
		}
		case '-status': {
			const [, ident, status] = args;
			const from = effectInfo(kw.from);
			const vals = { POKEMON: pk(ident), ITEM: from.name };
			if (from.id === 'rest') return F(T('startFromRest', status), vals);
			if (from.kind === 'item' && this.hasTemplate('startFromItem', status)) return F(T('startFromItem', status), vals);
			return this.fromAbility(kw, kw.of || ident) + F(T('start', status), vals);
		}
		case '-curestatus': {
			const [, ident, status] = args;
			const from = effectInfo(kw.from);
			if ('silent' in kw) return '';
			if (from.id === 'naturalcure') return F(T('activate', 'naturalcure'), { POKEMON: pk(ident) });
			if (from.kind === 'item' && this.hasTemplate('endFromItem', status)) return F(T('endFromItem', status), { POKEMON: pk(ident), ITEM: from.name });
			if (kw.thaw && this.hasTemplate('endFromMove', status)) return F(T('endFromMove', status), { POKEMON: pk(ident), MOVE: from.name });
			if (from.kind === 'ability') return this.fromAbility(kw, ident) + F(T('end', status), { POKEMON: pk(ident) });
			if (status === 'frz' || status === 'slp') return F(T('end', status), { POKEMON: pk(ident) });
			if (!kw.msg && from.id) return '';
			return F(T('end', status), { POKEMON: pk(ident) });
		}
		case '-message':
			return args[1] || '';
		case '-mustrecharge': case '-hint': case 'upkeep': case 'player': case 'gen': case 'tier': case 'rule':
		case 'teamsize': case 'gametype': case 't:': case 'split': case '': case 'poke': case 'clearpoke':
		case 'teampreview': case 'request': case 'seed': case '-anim': case 'debug': case 'error': case 'sentchoice': case '-waiting':
			return '';
		default:
			return '';
		}
	}
}
