/** 스토리 모드 (시안): '모험가 이야기' 같은 글 진행 로그라이크
 *  - 한 판 = 여정. 진행도 0→100 (체육관·악의 조직·리그 고정 이벤트 + 랜덤 이벤트)
 *  - 트레이너 능력치 6종(체력·담력·민첩·지식·매력·교감), 체력·의지 구슬, d20 판정
 *  - 배틀은 앱의 실제 배틀 화면(싱글), 결과는 본문으로 이어서 적힘
 *  - 체력이나 의지가 0이 되면 여정 끝(로그라이크). 진행 저장: localStorage pkbkr:story-run
 *  지금은 관동 지방 도입부(태초마을 → 오박사 연구소 → 그린 → 1번도로 → 상록시티)만 있는 시안 */
import { h, Fragment } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ask, abortMode, Sprite } from './ui/core';
import { BattleView, type BattleResult } from './ui/battle';
import { SPRITE_URL, trainerImgError } from './trainer-lines';
import type { PSet } from './sets';
import { moveKo } from './data';
import { loadSettings, saveSettings, load, save, remove } from './store';

// ───────── 능력치·도트 아이콘 ─────────
export type Stat = 'con' | 'brv' | 'agi' | 'int' | 'cha' | 'bond';
/** [id, 이름, 색, 7×7 도트(1=색, 2=밝은 색, 3=진한 색)] */
const STATS: [Stat, string, string, string][] = [
	['con', '체력', '#d23a3a', '0110110 1221221 1222221 1222221 0122210 0012100 0001000'], // 하트
	['brv', '담력', '#e07a1a', '0001100 0012210 0122210 0122221 1222221 1222210 0111100'], // 불꽃
	['agi', '민첩', '#3a8ad8', '0000110 0001210 0012100 0121000 1222110 0012210 0001100'], // 번개
	['int', '지식', '#7a4ac8', '1111110 1222213 1211213 1222213 1211213 1222213 0333333'], // 책
	['cha', '매력', '#d8a81a', '0001000 0012100 1112111 0122210 0121210 1210121 1000001'], // 별
	['bond', '교감', '#3aa86a', '0111110 1222221 1221221 1211121 1221221 1222221 0111110'], // 볼
];
const STAT_NAME = Object.fromEntries(STATS.map(s => [s[0], s[1]])) as Record<Stat, string>;
function shade(hex: string, f: number) { const n = parseInt(hex.slice(1), 16); const c = (v: number) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)))); return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`; }
function PixIcon({ map, color, size = 14 }: { map: string; color: string; size?: number }) {
	const rows = map.split(' '); const cols = [, shade(color, -0.15), shade(color, 0.45), shade(color, -0.5)];
	return <svg class="sx-ico" width={size} height={size} viewBox="0 0 7 7" shape-rendering="crispEdges">
		{rows.flatMap((r, y) => [...r].map((ch, x) => ch !== '0' ? <rect x={x} y={y} width="1" height="1" fill={cols[+ch]} /> : null))}
	</svg>;
}
const ICON = {
	dex: ['1111111 1333331 1322231 1323231 1322231 1333331 1111111', '#c83a3a'],
	bag: ['0011100 0100010 1111111 1222221 1211121 1222221 1111111', '#b07a3a'],
	cup: ['1111111 1222221 0122210 0012100 0001000 0011100 0111110', '#d8a81a'],
	party: ['0011100 0122210 1222221 1111111 1333331 0133310 0011100', '#d23a3a'],
	coin: ['0011100 0122210 1221221 1212121 1221221 0122210 0011100', '#d8a81a'],
} as const;

/** 체력·의지 구슬 (8×8 도트) */
function Orb({ full, color }: { full: boolean; color: string }) {
	const m = ['00111100', '01222210', '12211221', '12222221', '11222211', '11122111', '01111110', '00111100'];
	const cols = full ? ['', shade(color, -0.35), shade(color, 0.05), shade(color, 0.6)] : ['', '#a99a80', '#cfc3aa', '#cfc3aa'];
	return <svg class="sx-orb" width="16" height="16" viewBox="0 0 8 8" shape-rendering="crispEdges">
		{m.flatMap((r, y) => [...r].map((ch, x) => ch !== '0' ? <rect x={x} y={y} width="1" height="1" fill={cols[(full && x === 2 && y === 2) ? 3 : +ch]} /> : null))}
	</svg>;
}

// ───────── 여정 상태 ─────────
interface Mon { species: string; nick?: string; level: number; moves: string[]; ability: string }
type Entry =
	| { k: 'text'; t: string }
	| { k: 'say'; who: string; t: string }
	| { k: 'img'; il: Illust }
	| { k: 'gain'; t: string } | { k: 'loss'; t: string }
	| { k: 'roll'; label: string; stat: Stat; need: number; got: number; ok: boolean }
	| { k: 'chose'; t: string };
interface Run {
	name: string; sprite: string; bg: string; trait: string;
	stats: Record<Stat, number>; hp: number; will: number; prog: number; lvl: number; money: number;
	items: { [k: string]: number }; party: Mon[]; badges: number; scene: string; step: number; log: Entry[]; flags: { [k: string]: any };
}
const KEY = 'story-run';
const maxHp = (r: Run) => 2 + Math.floor(r.stats.con / 3);
const maxWill = (r: Run) => 2 + Math.floor(r.stats.bond / 3);
const partyCap = (r: Run) => Math.min(6, 1 + Math.floor(r.stats.brv / 3));
/** 판정 성공 확률: d20 + 능력치 보정 ≥ 난이도. 20은 무조건 성공, 1은 실패. 지식 10 이상이면 보너스 */
function chance(r: Run, stat: Stat, dc: number) {
	const mod = Math.floor((r.stats[stat] - 4) / 2);
	const base = Math.max(1, Math.min(19, 21 - dc + mod)) / 20;
	const bonus = r.stats.int >= 10 ? (r.stats.int - 9) * 0.011 : 0;
	return { base, bonus, p: Math.min(0.95, base + bonus) };
}
/** 진행도 → 고정 이벤트 위치 (진행 막대 표시) */
const MILESTONES: [number, string][] = [[8, '회색'], [18, '블루'], [28, '갈색'], [38, '무지개'], [45, '로켓'], [50, '연분홍'], [62, '노랑'], [68, '로켓'], [74, '홍련'], [86, '상록'], [100, '리그']];

// ───────── 삽화: 배틀 배경 + 트레이너·포켓몬 도트, 가장자리는 픽셀로 너덜너덜 ─────────
interface Illust { bg: string; trainers?: string[]; mons?: string[]; caption?: string; seed?: number }
function raggedMask(seed: number) {
	const W = 64, H = 40; let s = seed * 9301 + 49297; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
	let rects = '';
	for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
		const d = Math.min(x, y, W - 1 - x, H - 1 - y);
		const keep = d >= 4 || rnd() < [0.05, 0.3, 0.6, 0.85][d];
		if (keep) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`;
	}
	return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" shape-rendering="crispEdges">${rects}</svg>`)}")`;
}
function IllustBox({ il }: { il: Illust }) {
	const mask = useMemo(() => raggedMask(il.seed ?? 7), [il.seed]);
	return <div class={'sx-ill bg-' + il.bg} style={{ WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' }}>
		<div class="arena-bg" />
		<div class="sx-ill-row">
			{(il.trainers || []).map(t => <img class="sx-ill-tr" src={SPRITE_URL(t)} alt="" onError={trainerImgError} />)}
			{(il.mons || []).map(m => <span class="sx-ill-mon"><Sprite species={m} anim={false} size={96} /></span>)}
		</div>
	</div>;
}

// ───────── 장면 데이터 (시안: 관동 도입부) ─────────
interface Choice {
	label: string; sub?: string; mon?: string;
	/** 조건: 능력치 최소값 / 아이템 / 진행 플래그 */
	req?: { stat?: [Stat, number]; item?: string; flag?: string }; reqLabel?: string;
	check?: { stat: Stat; dc: number };
	run: (r: Run, ok: boolean) => Promise<string | void> | string | void; // 다음 장면 id
}
interface Scene { place: string; enter: (r: Run) => Entry[]; choices: (r: Run) => Choice[] }

const STARTERS: { [id: string]: { name: string; species: string; ability: string; moves: string[]; rival: string } } = {
	bulbasaur: { name: '이상해씨', species: 'Bulbasaur', ability: 'Overgrow', moves: ['tackle', 'growl'], rival: 'charmander' },
	charmander: { name: '파이리', species: 'Charmander', ability: 'Blaze', moves: ['scratch', 'growl'], rival: 'squirtle' },
	squirtle: { name: '꼬부기', species: 'Squirtle', ability: 'Torrent', moves: ['tackle', 'tailwhip'], rival: 'bulbasaur' },
};
const KO: { [s: string]: string } = { bulbasaur: '이상해씨', charmander: '파이리', squirtle: '꼬부기', pidgey: '구구', rattata: '꼬렛' };
const add = (r: Run, ...e: Entry[]) => { r.log.push(...e); };
function gainProg(r: Run, n: number, why: string) {
	r.prog = Math.min(100, r.prog + n); add(r, { k: 'gain', t: `+ 진행도 ${n} (${why})` });
	const LV = [5, 10, 15, 20, 30, 40, 50, 60, 70, 80];
	while (r.lvl < LV.length && r.prog >= LV[r.lvl]) { r.lvl++; r.flags.statPts = (r.flags.statPts || 0) + 3; add(r, { k: 'gain', t: `★ 트레이너 레벨 ${r.lvl + 1}! 능력치 +3 을 올릴 수 있다` }); }
}
const monSet = (m: Mon): PSet => ({ name: m.nick || KO[m.species.toLowerCase()] || m.species, species: m.species, item: '', ability: m.ability, moves: m.moves, nature: 'Hardy',
	evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 }, level: m.level });

async function battle(r: Run, opp: { name: string; sprite?: string; team: PSet[]; line?: string; win?: string; lose?: string; wild?: boolean }): Promise<boolean> {
	const me = loadSettings();
	// 스토리 배틀은 기믹 없는 전국도감 규칙 (배틀 화면은 그대로 두고 설정의 규칙만 잠깐 바꿨다가 되돌림)
	const prevRule = me.battleRule; saveSettings({ ...me, battleRule: '_one.natdex.no.no' });
	const res = await ask<BattleResult>(done => <BattleView key={Math.random()} onEnd={x => { if (x.quit) abortMode(); done(x); }} setup={{
		gen: 9, doubles: false, aiSkill: opp.wild ? 0.2 : 0.5, bg: 'field', label: '스토리 · 관동', noRecord: true,
		p1: { name: r.name, team: r.party.slice(0, partyCap(r)).map(monSet), sprite: r.sprite },
		p2: { name: opp.name, team: opp.team, sprite: opp.sprite, lines: opp.line ? { intro: opp.line, win: opp.win, lose: opp.lose } : undefined },
	}} />).finally(() => saveSettings({ ...loadSettings(), battleRule: prevRule }));
	return res.win;
}

const SCENES: { [id: string]: Scene } = {
	home: {
		place: '태초마을',
		enter: r => [
			{ k: 'img', il: { bg: 'field', trainers: [r.sprite], seed: 3 } },
			{ k: 'text', t: '태초마을의 아침. 창밖으로 1번도로의 풀숲이 바람에 흔들린다.' },
			{ k: 'text', t: '오늘은 마을 연구소의 오박사님이 포켓몬을 한 마리 맡겨 주기로 한 날이다. 당신은 가방을 메고 현관문을 나섰다.' },
		],
		choices: () => [
			{ label: '곧장 연구소로 간다', run: () => 'lab' },
			{ label: '풀숲을 먼저 구경한다', sub: '포켓몬 없이 풀숲에 들어가는 건 위험하다…', check: { stat: 'agi', dc: 14 }, run: (r, ok) => {
				if (ok) { add(r, { k: 'text', t: '풀숲 사이로 꼬렛의 꼬리가 스쳐 지나갔다. 당신은 재빨리 몸을 빼서 연구소로 향했다.' }); gainProg(r, 1, '정찰'); }
				else { r.hp--; add(r, { k: 'text', t: '갑자기 튀어나온 꼬렛에게 발목을 물렸다! 절뚝이며 연구소로 향한다.' }, { k: 'loss', t: '- 체력 1' }); }
				return 'lab';
			} },
			{ label: '엄마에게 인사하고 간다', req: { stat: ['bond', 8] }, reqLabel: '교감 8', run: r => {
				r.items.potion = (r.items.potion || 0) + 2; add(r, { k: 'say', who: '엄마', t: '포켓몬은 소중한 친구란다. 이것도 챙겨 가렴.' }, { k: 'gain', t: '+ 상처약 2개' }); return 'lab';
			} },
		],
	},
	lab: {
		place: '오박사 연구소',
		enter: () => [
			{ k: 'img', il: { bg: 'gym', trainers: ['oak'], mons: ['bulbasaur', 'charmander', 'squirtle'], seed: 11 } },
			{ k: 'say', who: '오박사', t: '오오, 왔구나! 이 세상에는 포켓몬이라 불리는 생명체가 도처에 살고 있단다.' },
			{ k: 'say', who: '오박사', t: '책상 위의 몬스터볼 셋 중 하나를 고르거라. 네 여정의 첫 동료가 될 게다.' },
		],
		choices: () => Object.entries(STARTERS).map(([id, s]) => ({ label: s.name, mon: id, sub: id === 'bulbasaur' ? '풀·독 · 첫 체육관(바위)에 강하다' : id === 'charmander' ? '불꽃 · 초반이 험난하지만 크게 자란다' : '물 · 단단하고 다루기 쉽다',
			run: (r: Run) => { r.party = [{ species: s.species, level: 5, moves: s.moves, ability: s.ability }]; r.flags.starter = id; add(r, { k: 'gain', t: `+ ${s.name} (Lv.5) 이(가) 동료가 되었다!` }); return 'rival'; } })),
	},
	rival: {
		place: '오박사 연구소',
		enter: r => [
			{ k: 'img', il: { bg: 'gym', trainers: ['blue'], mons: [STARTERS[r.flags.starter].rival], seed: 21 } },
			{ k: 'text', t: '그때 연구소 문이 벌컥 열렸다. 오박사님의 손자, 그린이었다.' },
			{ k: 'say', who: '그린', t: `할아버지! 나도 포켓몬 줘! …흥, 그럼 난 이 ${KO[STARTERS[r.flags.starter].rival]}(으)로 할래.` },
			{ k: 'say', who: '그린', t: '모처럼 할아버지가 포켓몬을 줬는데, 한번 붙어 보자고!' },
		],
		choices: () => [
			{ label: '배틀한다', sub: '라이벌 그린 · 포켓몬 1마리 (Lv.5)', run: async r => {
				const rv = STARTERS[r.flags.starter].rival, s = STARTERS[rv];
				const win = await battle(r, { name: '라이벌 그린', sprite: 'blue', team: [monSet({ species: s.species, level: 5, moves: s.moves, ability: s.ability })], line: '모처럼 할아버지가 포켓몬을 줬는데, 한번 붙어 보자고!', lose: '뭐야! 내 포켓몬을 골랐어야 했나?', win: '앗싸! 역시 난 최강이야!' });
				if (win) { add(r, { k: 'say', who: '그린', t: '뭐야! 내 포켓몬을 골랐어야 했나? …두고 봐, 다음엔 안 진다!' }); r.money += 70; r.party[0].level = 6; add(r, { k: 'gain', t: '+ 소지금 70원 (승리 보상)' }, { k: 'gain', t: `+ ${STARTERS[r.flags.starter].name} 레벨 6` }); gainProg(r, 2, '라이벌전 승리'); }
				else { r.will--; add(r, { k: 'say', who: '그린', t: '앗싸! 역시 난 최강이야! 할아버지, 나 간다!' }, { k: 'loss', t: '- 의지 1 (패배)' }); gainProg(r, 1, '라이벌전'); }
				return 'route1';
			} },
			{ label: '"나중에 하자"며 말로 넘긴다', check: { stat: 'cha', dc: 13 }, run: (r, ok) => {
				if (ok) { add(r, { k: 'say', who: '그린', t: '쳇, 겁쟁이 같으니. 1번도로에서 기다린다!' }); r.flags.rivalSkipped = true; }
				else { r.will--; add(r, { k: 'say', who: '그린', t: '도망치는 거야? 할아버지도 다 봤어!' }, { k: 'loss', t: '- 의지 1 (창피함)' }); }
				return 'route1';
			} },
		],
	},
	route1: {
		place: '1번도로',
		enter: r => [
			{ k: 'img', il: { bg: 'field', mons: ['pidgey'], seed: 33 } },
			{ k: 'text', t: '오박사님께 몬스터볼 5개를 받고 1번도로로 나섰다. 키 큰 풀숲이 바스락거리더니, 구구 한 마리가 고개를 내밀었다.' },
			{ k: 'gain', t: '+ 몬스터볼 5개' },
		].map(e => { if (e.k === 'gain' && !r.flags.balls) { r.flags.balls = 1; r.items.ball = (r.items.ball || 0) + 5; } return e as Entry; }),
		choices: () => [
			{ label: '싸워서 잡는다', sub: '야생 구구 (Lv.3) · 이기면 볼 던지기', run: async r => {
				const win = await battle(r, { name: '야생 구구', team: [monSet({ species: 'Pidgey', level: 3, moves: ['tackle', 'sandattack'], ability: 'Keen Eye' })], wild: true });
				if (!win) { r.hp--; add(r, { k: 'text', t: '구구는 날아가 버렸다. 놀라서 넘어지며 무릎이 까졌다.' }, { k: 'loss', t: '- 체력 1' }); return 'viridian'; }
				add(r, { k: 'text', t: '구구가 비틀거리며 쓰러지기 직전이다. 지금이다!' });
				return 'catch';
			} },
			{ label: '살금살금 지나간다', check: { stat: 'agi', dc: 11 }, run: (r, ok) => {
				if (ok) { add(r, { k: 'text', t: '발소리를 죽이고 풀숲 가장자리를 따라 걸었다. 상록시티가 보인다.' }); gainProg(r, 2, '무사 통과'); }
				else { r.hp--; add(r, { k: 'text', t: '구구가 날개로 모래를 뿌려 댔다! 눈을 비비며 겨우 빠져나왔다.' }, { k: 'loss', t: '- 체력 1' }); gainProg(r, 1, '통과'); }
				return 'viridian';
			} },
			{ label: '열매를 내밀어 친해진다', req: { item: 'berry' }, reqLabel: '열매', run: () => 'viridian' },
		],
	},
	catch: {
		place: '1번도로',
		enter: () => [],
		choices: r => [
			{ label: `몬스터볼을 던진다 (남은 볼 ${r.items.ball || 0})`, check: { stat: 'bond', dc: 9 }, req: { item: 'ball' }, reqLabel: '몬스터볼', run: (r, ok) => {
				r.items.ball--;
				if (ok) { r.party.push({ species: 'Pidgey', level: 3, moves: ['tackle', 'sandattack'], ability: 'Keen Eye' }); add(r, { k: 'gain', t: '+ 구구 (Lv.3) 을(를) 잡았다!' }); gainProg(r, 2, '첫 포획'); }
				else add(r, { k: 'text', t: '볼이 흔들리다 열려 버렸다! 구구는 하늘 높이 날아가 버렸다.' });
				return 'viridian';
			} },
			{ label: '놓아준다', run: r => { r.will = Math.min(maxWill(r), r.will + 1); add(r, { k: 'text', t: '구구는 고개를 갸웃하더니 날아갔다. 어쩐지 마음이 가볍다.' }, { k: 'gain', t: '+ 의지 1' }); return 'viridian'; } },
		],
	},
	viridian: {
		place: '상록시티',
		enter: r => [
			{ k: 'img', il: { bg: 'tower', trainers: ['nurse'], seed: 41 } },
			{ k: 'text', t: '상록시티에 도착했다. 빨간 지붕의 포켓몬센터와 파란 지붕의 프렌들리숍이 보인다. 마을 끝 체육관은 문이 굳게 잠겨 있다.' },
			...(r.flags.rivalSkipped ? [{ k: 'say' as const, who: '그린', t: '여기서 만났네! 이번엔 도망 못 가!' }] : []),
		],
		choices: () => [
			{ label: '포켓몬센터에서 쉰다', sub: '포켓몬 회복 · 체력 +1', run: r => { r.hp = Math.min(maxHp(r), r.hp + 1); add(r, { k: 'say', who: '간호순', t: '맡겨 주신 포켓몬은 모두 건강해졌어요!' }, { k: 'gain', t: '+ 체력 1' }); return 'end'; } },
			{ label: '프렌들리숍에 들른다', sub: '몬스터볼 200원 · 상처약 300원', run: () => 'end' },
			{ label: '상록숲으로 바로 간다', sub: '다음 목표: 회색시티 체육관 (진행도 8)', run: r => { gainProg(r, 1, '강행군'); return 'end'; } },
		],
	},
	end: {
		place: '상록시티',
		enter: () => [{ k: 'text', t: '— 시안은 여기까지입니다. 다음은 상록숲 랜덤 이벤트와 회색체육관 관장 웅(꼬마돌 Lv.12 · 롱스톤 Lv.14)입니다. —' }],
		choices: () => [{ label: '처음부터 다시 (새 여정)', run: () => { remove(KEY); return '__restart'; } }],
	},
};

// ───────── 여정 준비: 배경·특성·능력치 분배 ─────────
const BACKGROUNDS = [
	{ id: 'rookie', name: '신인 트레이너', desc: '태초마을에서 첫 포켓몬을 받아 관동 체육관 8곳과 포켓몬리그에 도전한다.', open: true },
	{ id: 'rocket', name: '전직 로켓단원', desc: '조직을 빠져나온 과거. 로켓단 이벤트가 다르게 흘러간다.', open: false },
	{ id: 'breeder', name: '포켓몬 브리더', desc: '알 여러 개를 품고 출발. 배틀보다 육성에 강하다.', open: false },
	{ id: 'tree', name: '배틀트리 도전자', desc: '배틀 위주의 여정. 리그 이후 배틀트리 정상을 노린다.', open: false },
];
const TRAITS = [
	{ id: 'baller', name: '볼 장인', desc: '포획 판정 +10%' },
	{ id: 'lost', name: '길치', desc: '랜덤 이벤트가 잦아지고 보상도 늘어난다' },
	{ id: 'rich', name: '부잣집 아이', desc: '시작 소지금 3배, 매력 −2' },
	{ id: 'sprout', name: '꿈나무', desc: '포켓몬 경험치 +20%' },
];
function Setup({ onDone, onExit }: { onDone: (r: Run) => void; onExit: () => void }) {
	const s = loadSettings();
	const [bg, setBg] = useState('rookie'), [trait, setTrait] = useState('baller');
	const [st, setSt] = useState<Record<Stat, number>>({ con: 4, brv: 4, agi: 4, int: 4, cha: 4, bond: 4 });
	const left = 18 - (Object.values(st).reduce((a, b) => a + b, 0) - 24);
	const bump = (k: Stat, d: number) => { const v = st[k] + d; if (v < 4 || v > 12 || (d > 0 && left <= 0)) return; setSt({ ...st, [k]: v }); };
	const start = () => {
		const r: Run = { name: s.playerName || '플레이어', sprite: s.playerSprite || 'red', bg, trait, stats: { ...st, cha: st.cha - (trait === 'rich' ? 2 : 0) }, hp: 0, will: 0, prog: 0, lvl: 0, money: trait === 'rich' ? 9000 : 3000,
			items: {}, party: [], badges: 0, scene: 'home', step: 1, log: [], flags: {} };
		r.hp = maxHp(r); r.will = maxWill(r); onDone(r);
	};
	return <div class="sx sx-setup">
		<div class="sx-scroll">
			<div class="sx-head"><button class="sx-back" onClick={onExit}>◀</button><h2>새 여정</h2></div>
			<div class="sx-me"><img src={SPRITE_URL(s.playerSprite || 'red')} alt="" onError={trainerImgError} /><div><b>{s.playerName || '플레이어'}</b><small>관동 지방 · 로그라이크 (체력이나 의지가 0이 되면 여정 끝)</small></div></div>
			<h3 class="sx-h">배경</h3>
			<div class="sx-cards">{BACKGROUNDS.map(b => <button class={'sx-card' + (bg === b.id ? ' on' : '') + (b.open ? '' : ' locked')} disabled={!b.open} onClick={() => setBg(b.id)}>
				<b>{b.open ? b.name : '🔒 ' + b.name}</b><small>{b.open ? b.desc : '엔딩을 보면 열립니다'}</small></button>)}</div>
			<h3 class="sx-h">특성 <small>(하나만, 도중에 못 바꿈)</small></h3>
			<div class="sx-cards two">{TRAITS.map(t => <button class={'sx-card' + (trait === t.id ? ' on' : '')} onClick={() => setTrait(t.id)}><b>{t.name}</b><small>{t.desc}</small></button>)}</div>
			<h3 class="sx-h">능력치 <small>남은 점수 <b class={left ? 'sx-left' : ''}>{left}</b></small></h3>
			<div class="sx-alloc">{STATS.map(([k, n, c, m]) => <div class="sx-arow">
				<PixIcon map={m} color={c} size={18} /><span class="sx-aname">{n}</span>
				<button onClick={() => bump(k, -1)}>−</button><b>{st[k]}</b><button onClick={() => bump(k, 1)}>+</button>
				<small class="sx-ahint">{k === 'con' ? `체력 구슬 ${2 + Math.floor(st.con / 3)}` : k === 'bond' ? `의지 구슬 ${2 + Math.floor(st.bond / 3)}` : k === 'brv' ? `데리고 다니는 포켓몬 ${Math.min(6, 1 + Math.floor(st.brv / 3))}` : k === 'agi' ? '도망·추적·피하기' : k === 'int' ? '10 이상: 모든 판정 보너스' : '상점 가격·설득·교환'}</small>
			</div>)}</div>
		</div>
		<div class="sx-foot"><button class="sx-go" disabled={left !== 0} onClick={start}>{left ? `점수를 모두 나눠 주세요 (${left})` : '여정 시작 ▶'}</button></div>
	</div>;
}

// ───────── 본문 화면 ─────────
function TopBar({ r }: { r: Run }) {
	return <div class="sx-top">
		<div class="sx-top-row">
			<div class="sx-face"><img src={SPRITE_URL(r.sprite)} alt="" onError={trainerImgError} /></div>
			<div class="sx-mid">
				<div class="sx-name">{r.name}<small> Lv.{r.lvl + 1}</small></div>
				<div class="sx-orbs">{Array.from({ length: maxHp(r) }, (_, i) => <Orb full={i < r.hp} color="#d23a3a" />)}</div>
				<div class="sx-orbs">{Array.from({ length: maxWill(r) }, (_, i) => <Orb full={i < r.will} color="#3aa86a" />)}</div>
			</div>
			<div class="sx-stats">{STATS.map(([k, , c, m]) => <span class="sx-stat"><PixIcon map={m} color={c} size={16} /><b>{r.stats[k]}</b></span>)}</div>
		</div>
		<div class="sx-prog" title="여정 진행도">
			<i class="sx-prog-fill" style={{ width: r.prog + '%' }} />
			{MILESTONES.map(([p, n]) => <i class={'sx-ms' + (n === '로켓' ? ' evil' : n === '리그' ? ' league' : '') + (r.prog >= p ? ' done' : '')} style={{ left: p + '%' }} title={n} />)}
			<span class="sx-prog-num">{r.prog}</span>
		</div>
	</div>;
}

function Dice({ need, got, ok, onDone }: { need: number; got: number; ok: boolean; onDone: () => void }) {
	const [n, setN] = useState(1), [land, setLand] = useState(false);
	useEffect(() => {
		let i = 0; const t = setInterval(() => { i++; if (i < 14) setN(1 + Math.floor(Math.random() * 20)); else { clearInterval(t); setN(got); setLand(true); } }, 60);
		return () => clearInterval(t);
	}, []);
	return <div class="sx-dice-wrap" onClick={() => land && onDone()}>
		<div class={'sx-dice' + (land ? ' land' : '')}><b>{n}</b></div>
		<div class="sx-dice-need">목표 {need} 이상</div>
		{land && <div class={'sx-dice-res ' + (ok ? 'ok' : 'ng')}>{got === 20 ? '대성공!' : got === 1 ? '대실패…' : ok ? '성공' : '실패'}<small>눌러서 계속</small></div>}
	</div>;
}

function LogView({ log }: { log: Entry[] }) {
	return <>{log.map((e, i) => {
		switch (e.k) {
			case 'text': return <p class="sx-p">{e.t}</p>;
			case 'say': return <p class="sx-p sx-say"><b>{e.who}</b> "{e.t}"</p>;
			case 'img': return <IllustBox il={e.il} />;
			case 'gain': return <p class="sx-gain">{e.t}</p>;
			case 'loss': return <p class="sx-loss">{e.t}</p>;
			case 'chose': return <p class="sx-chose">▶ {e.t}</p>;
			case 'roll': return <p class={'sx-roll ' + (e.ok ? 'ok' : 'ng')}><PixIcon map={STATS.find(s => s[0] === e.stat)![3]} color={STATS.find(s => s[0] === e.stat)![2]} /> {STAT_NAME[e.stat]} 판정 · 주사위 {e.got} (목표 {e.need}) → <b>{e.ok ? '성공' : '실패'}</b></p>;
		}
	})}</>;
}

type Act = { c: Choice; ok: boolean; nr: Run } | null;
/** 본문 화면: 선택지를 고르고 판정(주사위)까지 한 뒤 onAct 로 넘김 — 결과 처리(배틀 포함)는 runStory 가 하고 화면을 다시 그림 */
function Story({ init: r, onAct }: { init: Run; onAct: (a: Act) => void }) {
	const [busy, setBusy] = useState(false);
	const [dice, setDice] = useState<{ need: number; got: number; ok: boolean; done: () => void } | null>(null);
	const [panel, setPanel] = useState<'' | 'party' | 'bag'>('');
	const scroller = useRef<HTMLDivElement>(null);
	const scene = SCENES[r.scene];
	useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, []);
	const choices = scene.choices(r);
	const can = (c: Choice) => {
		if (!c.req) return true;
		if (c.req.stat && r.stats[c.req.stat[0]] < c.req.stat[1]) return false;
		if (c.req.item && !(r.items[c.req.item] > 0)) return false;
		return true;
	};
	const pick = async (c: Choice) => {
		if (busy || !can(c)) return;
		setBusy(true);
		const nr: Run = { ...r, log: [...r.log], flags: { ...r.flags }, items: { ...r.items }, party: r.party.map(m => ({ ...m })), stats: { ...r.stats } };
		nr.log.push({ k: 'chose', t: c.label });
		let ok = true;
		if (c.check) {
			const { p } = chance(nr, c.check.stat, c.check.dc);
			const got = 1 + Math.floor(Math.random() * 20);
			ok = got === 20 || (got !== 1 && Math.random() < p); // 표시 확률과 맞춤 (주사위 눈은 연출)
			const need = Math.max(2, Math.min(20, Math.round(21 - p * 20)));
			const shown = ok ? Math.max(need, got === 20 ? 20 : Math.min(19, need + Math.floor(Math.random() * (21 - need)))) : (got === 1 ? 1 : Math.max(1, Math.floor(Math.random() * (need - 1)) + 1));
			await new Promise<void>(done => setDice({ need, got: shown, ok, done }));
			setDice(null);
			nr.log.push({ k: 'roll', label: c.label, stat: c.check.stat, need, got: shown, ok });
		}
		onAct({ c, ok, nr });
	};
	return <div class="sx sx-story">
		<TopBar r={r} />
		<div class="sx-scroll" ref={scroller}>
			<div class="sx-place">{scene.place}</div>
			<LogView log={r.log} />
			<div class="sx-sep"><span>{r.step}</span></div>
			<div class="sx-choices">{choices.map(c => {
				const ok = can(c), ch = c.check ? chance(r, c.check.stat, c.check.dc) : null;
				return <button class={'sx-choice' + (ok ? '' : ' no')} disabled={!ok || busy} onClick={() => pick(c)}>
					{c.req && <span class="sx-req">[{c.reqLabel}{ok ? '' : ' 필요'}]</span>}
					<span class="sx-cl">{c.mon ? <span class="sx-cmon"><Sprite species={c.mon} anim={false} size={64} /></span> : <i class="sx-diamond" />}{c.label}</span>
					{c.sub && <small class="sx-csub">{c.sub}</small>}
					{ch && <small class="sx-cp"><PixIcon map={STATS.find(s => s[0] === c.check!.stat)![3]} color={STATS.find(s => s[0] === c.check!.stat)![2]} /> {STAT_NAME[c.check.stat]} 판정 · 성공확률 : {(ch.p * 100).toFixed(1)} %{ch.bonus > 0 && <span class="sx-bonus"> (지식 보너스 +{(ch.bonus * 100).toFixed(1)} %)</span>}</small>}
				</button>;
			})}</div>
		</div>
		<div class="sx-dock">
			<button onClick={() => setPanel(panel === 'party' ? '' : 'party')}><PixIcon map={ICON.party[0]} color={ICON.party[1]} size={28} /><small>파티 {r.party.length}/{partyCap(r)}</small></button>
			<button onClick={() => setPanel(panel === 'bag' ? '' : 'bag')}><PixIcon map={ICON.bag[0]} color={ICON.bag[1]} size={28} /><small>가방</small></button>
			<button><PixIcon map={ICON.dex[0]} color={ICON.dex[1]} size={28} /><small>도감</small></button>
			<button><PixIcon map={ICON.cup[0]} color={ICON.cup[1]} size={28} /><small>배지 {r.badges}</small></button>
			<span class="sx-money"><PixIcon map={ICON.coin[0]} color={ICON.coin[1]} size={20} />{r.money.toLocaleString()}원</span>
			<button class="sx-exit" onClick={() => onAct(null)}>✕</button>
		</div>
		{panel && <div class="sx-panel" onClick={() => setPanel('')}>
			<div class="sx-panel-box" onClick={e => e.stopPropagation()}>
				{panel === 'party' ? <>
					<h3>파티 <small>데리고 다니는 칸 {partyCap(r)} (담력 3마다 +1)</small></h3>
					{r.party.length ? r.party.map(m => <div class="sx-pm"><Sprite species={m.species} anim={false} size={56} /><div><b>{m.nick || KO[m.species.toLowerCase()] || m.species}</b> <small>Lv.{m.level}</small><small class="sx-pmv">{m.moves.map(moveKo).join(' · ')}</small></div></div>) : <p class="sx-p">아직 포켓몬이 없다.</p>}
				</> : <>
					<h3>가방</h3>
					{Object.keys(r.items).length ? Object.entries(r.items).map(([k, n]) => <div class="sx-bi"><span>{({ ball: '몬스터볼', potion: '상처약', berry: '열매' } as any)[k] || k}</span><b>×{n}</b></div>) : <p class="sx-p">비어 있다.</p>}
				</>}
			</div>
		</div>}
		{dice && <Dice need={dice.need} got={dice.got} ok={dice.ok} onDone={dice.done} />}
	</div>;
}

export async function runStory() {
	while (true) {
		let run = load<Run | null>(KEY, null);
		if (!run || !SCENES[run.scene]) {
			const r = await ask<Run | null>(done => <Setup onDone={done} onExit={() => done(null)} />);
			if (!r) return;
			r.log = SCENES.home.enter(r); run = r; save(KEY, run);
		}
		while (true) {
			const cur: Run = run!;
			const act = await ask<Act>(done => <Story key={cur.log.length} init={cur} onAct={done} />);
			if (!act) return;
			const { c, ok, nr } = act;
			let next = await c.run(nr, ok);
			if (next === '__restart') break;
			if (nr.hp <= 0 || nr.will <= 0) { nr.log.push({ k: 'loss', t: nr.hp <= 0 ? '쓰러지고 말았다… 여정은 여기서 끝났다.' : '더는 나아갈 마음이 들지 않았다… 여정은 여기서 끝났다.' }); next = 'end'; }
			if (next && next !== nr.scene) { nr.scene = next; nr.step++; nr.log.push(...SCENES[next].enter(nr)); }
			run = nr; save(KEY, run);
		}
	}
}
