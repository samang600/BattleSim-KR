/** 앱에서 쓰는 배틀 규칙 — 9세대 내셔널 도감 (메가진화·Z기술·다이맥스·테라스탈 모두 사용 가능) */
const common = {
	searchShow: false,
	debug: true,
	battle: { trunc: Math.trunc },
	ruleset: ['NatDex Mod', 'Max Team Size = 24', 'Max Move Count = 24', 'Max Level = 9999', 'Default Level = 50'],
	onBegin(this: any) {
		// 9세대에서는 기본적으로 다이맥스를 막아 두므로 다시 허용 (팀당 1회)
		for (const side of this.sides) {
			side.dynamaxUsed = false;
			side.canDynamaxNow = function (this: any) { return !this.dynamaxUsed; };
		}
	},
};

export const Formats = [
	{ name: "[Gen 9] KR Singles", mod: 'gen9', gameType: 'singles', ...common },
	{ name: "[Gen 9] KR Doubles", mod: 'gen9', gameType: 'doubles', ...common },
	// 거꾸로 배틀: 약점은 반감, 반감·무효는 약점
	{ name: "[Gen 9] KR Singles Inverse", mod: 'gen9', gameType: 'singles', ...common, ruleset: [...common.ruleset, 'Inverse Mod'] },
	{ name: "[Gen 9] KR Doubles Inverse", mod: 'gen9', gameType: 'doubles', ...common, ruleset: [...common.ruleset, 'Inverse Mod'] },
	{ name: "[Gen 9] Random Battle", mod: 'gen9', team: 'random', ...common },
	{ name: "[Gen 9] Random Doubles Battle", mod: 'gen9', gameType: 'doubles', team: 'random', ...common },
];
