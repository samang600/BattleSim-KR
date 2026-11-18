/**
 * 포켓몬 챔피언스 레귤레이션 M-D (2026.12.2 점검) 배틀 밸런스 조정 — 공식 공지 기준.
 * 적용: 전국도감·무제한·챔피언스 M-D 룰 (M-A/B/C 룰은 조정 전 사양 그대로 — 엔진 모드 krchampc).
 * 엔진(ps/registry.ts)과 화면 표시(data.ts)가 같은 표를 씀.
 */
/** 명중률 조정 (싫은소리 85→100, 스톤샤워 90→95, 강철날개 90→100, 금속음 85→100, 얼어붙은바람 →100) */
export const MD_ACC: { [move: string]: number } = { screech: 100, rockslide: 95, steelwing: 100, metalsound: 100, icywind: 100 };
/** 추가 효과 확률 조정 (스톤샤워 풀죽음 30→20%) — 무제한(너프 없음)에는 적용하지 않음 */
export const MD_CHANCE: { [move: string]: number } = { rockslide: 20 };
/** 새로 배우는 기술: 기술 → 포켓몬 */
export const MD_LEARN: { [move: string]: string[] } = {
	psychup: ['alakazam', 'starmie', 'mrmime', 'mawile', 'altaria', 'castform', 'absol', 'roserade', 'weavile', 'rotom', 'rotomheat', 'rotomwash', 'rotomfrost', 'rotomfan', 'rotommow',
		'liepard', 'musharna', 'audino', 'cofagrigus', 'slurpuff', 'drampa', 'annihilape'],
	slackoff: ['emboar'],
	roost: ['beedrill', 'hydreigon'],
	tailwind: ['emolga'],
	wonderroom: ['umbreon'],
	playrough: ['vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon', 'leafeon', 'glaceon'],
};
/** 포켓몬 → 새로 배우는 기술 */
export const MD_LEARN_BY: { [species: string]: string[] } = {};
for (const [mv, list] of Object.entries(MD_LEARN)) for (const s of list) (MD_LEARN_BY[s] ||= []).push(mv);
/** 조정된 특성 설명 */
export const MD_ABIL_DESC: { [id: string]: string } = {
	flashfire: '불꽃타입의 기술을 받으면 데미지를 받지 않고 불꽃위력업 상태가 되어 자신의 불꽃타입 기술이 강해진다. 불꽃위력업 상태는 메가진화해도 유지된다.',
	stalwart: '상대의 기술을 끌어모으는 특성이나 기술의 영향을 받지 않는다. 상대의 대타출동을 무시하고 기술을 쓸 수 있다.',
};
/** 조정된 특성의 배틀 동작 (기본 데이터 위에 덮어씀) */
export const MD_ABILITIES: { [id: string]: any } = {
	// 타오르는불꽃: 불꽃위력업은 특성이 아니라 상태 — 특성이 바뀌어도(메가진화) 교체할 때까지 남음
	flashfire: {
		onEnd: undefined,
		condition: {
			noCopy: true,
			onStart(this: any, target: any) { this.add('-start', target, 'ability: Flash Fire'); },
			onModifyAtkPriority: 5,
			onModifyAtk(this: any, atk: number, attacker: any, defender: any, move: any) { if (move.type === 'Fire') return this.chainModify(1.5); },
			onModifySpAPriority: 5,
			onModifySpA(this: any, atk: number, attacker: any, defender: any, move: any) { if (move.type === 'Fire') return this.chainModify(1.5); },
			onEnd(this: any, target: any) { this.add('-end', target, 'ability: Flash Fire', '[silent]'); },
		},
	},
	// 굳건한신념: 상대의 대타출동을 무시
	stalwart: {
		onModifyMovePriority: 1,
		onModifyMove(this: any, move: any) {
			move.tracksTarget = move.target !== 'scripted';
			move.flags = { ...move.flags, bypasssub: 1 };
		},
	},
};
