/** 챔피언스 모드 데이터 (개발자 빌드) — 값·이야기·규칙 순환.
 *  구조는 포켓몬 챔피언스(스카우트: 소개 10마리·트라이얼/레귤러, 트레이닝, 도구 상점, 등급)를 참고했고,
 *  재화는 시뮬레이터 모드와 같은 BP(rewards.ts 지갑)를 쓴다. 인물·대사는 이 모드를 위해 새로 쓴 것. */

/** 값 (BP). 준전설은 스카우트 값이 2배, 초전설·환상은 4배 */
export const PRICE = {
	/** 레귤러 스카우트 · 지명 스카우트 · 소개 새로 받기 · 다음 소개에 타입 지정 */ scout: 8, pick: 20, refresh: 3, typeTicket: 3,
	/** 도구: 보통 · 강한 도구 · 열매 · 메가스톤 · Z크리스탈 */ item: 6, itemHi: 8, berry: 3, mega: 15, z: 6,
	/** 트레이닝: 기술 하나 · 능력 보정(성격) · 특성 · 능력 포인트 다시 나누기 · 테라스탈 타입 */ move: 1, nature: 2, ability: 3, sp: 1, tera: 2,
};
/** 얻는 BP: 1승 · 7연승 세트 · 승급전 */
export const EARN = { win: 2, set: 5, promo: 10 };

/** 등급: 승점을 채우면 승급전(스토리)이 열림. cap = 로스터 한도 */
export const TIERS = [
	{ name: '비기너', need: 2, cap: 30, bst: [380, 520], q: 0.35, skill: 0.45 },
	{ name: '몬스터볼급', need: 3, cap: 30, bst: [430, 540], q: 0.5, skill: 0.6 },
	{ name: '슈퍼볼급', need: 4, cap: 35, bst: [460, 580], q: 0.6, skill: 0.72 },
	{ name: '하이퍼볼급', need: 5, cap: 40, bst: [480, 600], q: 0.7, skill: 0.82 },
	{ name: '마스터볼급', need: 6, cap: 50, bst: [500, 640], q: 0.8, skill: 0.9 },
	{ name: '챔피언급', need: 0, cap: 60, bst: [520, 680], q: 0.9, skill: 0.95 },
];

/** 규칙 순환: 날마다 바뀜. 포켓몬 풀은 늘 전국도감(제한 없음)이고 기믹만 돌아감. 타워·팩토리·랭크는 서로 다른 칸을 씀 */
export const GIMMICKS: [string, string, string][] = [
	['m_one', '메가진화', '메가스톤을 지닌 포켓몬 한 마리가 메가진화'],
	['t_one', '테라스탈', '한 마리가 테라스탈'],
	['_one', '기믹 없음', '메가진화·Z기술·다이맥스·테라스탈 없이'],
	['z_one', 'Z기술', 'Z크리스탈을 지닌 포켓몬이 한 번 Z기술'],
	['d_one', '다이맥스', '한 마리가 3턴 동안 다이맥스'],
	['mzdt_one', '기믹 자유', '메가진화·Z기술·다이맥스·테라스탈 가운데 한 가지'],
];
/** 전설 허용 단계: 0 = 일반 포켓몬만 · 1 = 준전설까지 · 2 = 초전설·환상까지. 등급이 높을수록 높은 단계가 섞여 나옴 */
export const LEGEND_NAME = ['일반 룰', '준전설 룰', '전설 룰'];
const LEGEND_BY_TIER = [[0], [0], [0, 0, 1], [0, 1, 1], [1, 2, 1, 0, 2], [2, 1, 2, 1, 0]];
const EPOCH = new Date(2026, 0, 5).getTime();
export const dayNo = (now = new Date()) => Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - EPOCH) / 864e5);
/** 다음 규칙 변경(자정)까지 남은 시간 */
export const hoursLeft = (now = new Date()) => Math.max(1, Math.ceil((new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()) / 36e5));
export type BattleKind = 'rank' | 'tower' | 'factory';
/** 오늘 그 배틀의 규칙 (등급에 따라 전설 허용 단계가 달라짐). 싱글·더블은 플레이어가 고름 (champions.tsx rotOf) */
export function rotationOf(kind: BattleKind, tier: number, d = dayNo()) {
	const off = { rank: 0, tower: 2, factory: 4 }[kind], mod = (a: number, n: number) => ((a % n) + n) % n;
	const [g, name, gdesc] = GIMMICKS[mod(d + off, GIMMICKS.length)];
	const lv = LEGEND_BY_TIER[Math.min(tier, LEGEND_BY_TIER.length - 1)], legend = kind === 'factory' ? 0 : lv[mod(d + off, lv.length)];
	const doubles = false;
	// 전국도감은 준전설이 기본 허용이라, 일반 룰에서는 따로 막음 (끝의 .no)
	const rule = `${g}.natdex.${legend >= 2 ? 'yes.yes' : 'no.no'}${legend === 0 ? '.no' : ''}`;
	return { rule, name: legend ? `${name} · ${LEGEND_NAME[legend]}` : name, desc: `${gdesc}${legend === 2 ? ' · 초전설·환상의 포켓몬도 참가' : legend === 1 ? ' · 준전설까지 참가' : ''}`, doubles, pick: doubles ? 4 : 3, legend };
}

/** 가지고 시작하는 도구 */
export const START_ITEMS = ['leftovers', 'choicescarf', 'focussash', 'focusband', 'kingsrock', 'quickclaw', 'whiteherb', 'brightpowder', 'lumberry', 'sitrusberry'];
/** 상점 진열: [묶음 이름, 값 종류, 도구 id …] */
export const SHOP: [string, keyof typeof PRICE, string[]][] = [
	['강한 도구', 'itemHi', ['lifeorb', 'rockyhelmet', 'expertbelt', 'airballoon', 'lightclay', 'mentalherb', 'redcard', 'scopelens', 'normalgem', 'ironball', 'lightball']],
	['지닌 도구', 'item', ['choiceband', 'choicespecs', 'assaultvest', 'eviolite', 'heavydutyboots', 'weaknesspolicy', 'safetygoggles', 'blacksludge', 'flameorb', 'toxicorb', 'powerherb', 'ejectbutton',
		'widelens', 'muscleband', 'wiseglasses', 'shellbell', 'bigroot', 'clearamulet', 'covertcloak', 'loadeddice', 'throatspray', 'protectivepads', 'mirrorherb', 'boosterenergy',
		'charcoal', 'mysticwater', 'miracleseed', 'magnet', 'nevermeltice', 'blackbelt', 'poisonbarb', 'softsand', 'sharpbeak', 'twistedspoon', 'silverpowder', 'hardstone', 'spelltag', 'dragonfang', 'blackglasses', 'metalcoat', 'silkscarf', 'fairyfeather']],
	['열매', 'berry', ['occaberry', 'passhoberry', 'wacanberry', 'rindoberry', 'yacheberry', 'chopleberry', 'kebiaberry', 'shucaberry', 'cobaberry', 'payapaberry', 'tangaberry', 'chartiberry', 'kasibberry', 'habanberry', 'colburberry', 'babiriberry', 'roseliberry', 'chilanberry',
		'salacberry', 'liechiberry', 'petayaberry', 'custapberry', 'figyberry', 'wikiberry', 'magoberry', 'aguavberry', 'iapapaberry']],
	['Z크리스탈', 'z', ['normaliumz', 'firiumz', 'wateriumz', 'electriumz', 'grassiumz', 'iciumz', 'fightiniumz', 'poisoniumz', 'groundiumz', 'flyiniumz', 'psychiumz', 'buginiumz', 'rockiumz', 'ghostiumz', 'dragoniumz', 'darkiniumz', 'steeliumz', 'fairiumz']],
];
/** 능력 보정(성격): [id, 오르는 능력, 내리는 능력] */
export const NATURES: [string, string, string][] = [['hardy', '', ''], ['adamant', '공격', '특공'], ['jolly', '스피드', '특공'], ['modest', '특공', '공격'], ['timid', '스피드', '공격'], ['bold', '방어', '공격'], ['impish', '방어', '특공'], ['calm', '특방', '공격'], ['careful', '특방', '특공'],
	['brave', '공격', '스피드'], ['quiet', '특공', '스피드'], ['relaxed', '방어', '스피드'], ['sassy', '특방', '스피드'], ['naive', '스피드', '특방'], ['hasty', '스피드', '방어'], ['lonely', '공격', '방어'], ['naughty', '공격', '특방'], ['mild', '특공', '방어'], ['rash', '특공', '특방'], ['lax', '방어', '특방'], ['gentle', '특방', '방어']];

// ───────── 이야기 ─────────
export interface CWho { name: string; title: string; sprite: string }
export const CWHO: { [id: string]: CWho } = {
	manager: { name: '하늘', title: '아레나 매니저', sprite: 'acetrainerf-gen4' },
	rival: { name: '도윤', title: '같은 날 등록한 트레이너', sprite: 'acetrainer-gen4' },
	senior: { name: '강철', title: '하이퍼볼급의 문지기', sprite: 'blackbelt' },
	champ: { name: '백야', title: '전 챔피언', sprite: 'veteran' },
};
/** 장: 등급 t 의 승점을 다 채우면 열리는 승급전 (0장은 등록·연습 승부). lines: [말하는 사람 id('' = 해설), 대사] */
export interface Chapter { title: string; sub: string; who: string; bg: string; before: [string, string][]; after: [string, string][]; lose: string; /** 상대 팀의 에이스(있으면 꼭 넣음) */ ace?: string }
export const CHAPTERS: Chapter[] = [
	{ title: '챔피언스 아레나에 어서 와', sub: '빌린 팀으로 연습 승부 · 첫 스카우트', who: 'manager', bg: 'pwt',
		before: [['', '관동 외곽에 새로 문을 연 배틀 시설, 챔피언스 아레나. 오늘이 등록 첫날이다.'], ['manager', '어서 와! 네가 오늘 등록한 신입이지? 나는 여기 매니저 하늘이야.'], ['manager', '여긴 이긴 만큼 BP 가 쌓이고, 그 BP 로 동료를 스카우트해서 팀을 꾸리는 곳이야.'], ['manager', '아직 포켓몬이 없지? 내 포켓몬을 빌려줄 테니까, 우선 한 판 해 보자!']],
		after: [['manager', '좋아, 감은 잡았네! 빌려준 아이들은 돌려받을게.'], ['manager', '이제부터는 네 팀으로 싸워야 해. 스카우트 사무실에 오늘 소개받을 포켓몬이 열 마리 와 있어.'], ['manager', '등록 선물로 레귤러 티켓 세 장을 줄게. 마음에 드는 세 마리를 데려가!']],
		lose: '괜찮아, 처음엔 다 그래! 남의 포켓몬으로 이기긴 어렵지. 빌려준 아이들은 돌려받을게.' },
	{ title: '같은 날 등록한 녀석', sub: '몬스터볼급 승급전 — 도윤', who: 'rival', bg: 'pwt', ace: 'arcanine',
		before: [['rival', '어, 너! 등록 창구에서 내 뒤에 서 있던 애 맞지?'], ['rival', '난 도윤. 나도 오늘 시작했어. 벌써 세 마리나 스카우트했다고!'], ['rival', '몬스터볼급 승급전 상대가 서로라니 재밌네. 누가 먼저 올라가나 보자!']],
		after: [['rival', '크으… 한 끗 차이였는데!'], ['rival', '좋아, 인정. 근데 다음 등급에선 내가 먼저 올라가 있을 거야. 두고 봐!']],
		lose: '봤지? 내가 한발 앞이야! 팀 다듬고 다시 와.' },
	{ title: '쫓아오는 발소리', sub: '슈퍼볼급 승급전 — 도윤', who: 'rival', bg: 'pwt', ace: 'garchomp',
		before: [['rival', '또 너야? …아니, 솔직히 기다렸어.'], ['rival', '트레이닝이란 걸 해 봤거든. 능력 포인트를 다시 나눴더니 완전히 다른 포켓몬이 되더라.'], ['rival', '이번엔 안 져. 진짜로!']],
		after: [['rival', '하아… 또 졌네. 너, 스카우트 눈이 좋은 거야 아니면 키우는 게 좋은 거야?'], ['manager', '둘 다지. 그리고 도윤 군도 충분히 잘하고 있어. 다음 벽은 꽤 단단하니까 둘 다 각오해.']],
		lose: '해냈다! …아니 근데 너, 봐준 거 아니지? 다시 한번 해!' },
	{ title: '단단한 벽', sub: '하이퍼볼급 승급전 — 강철', who: 'senior', bg: 'gym', ace: 'metagross',
		before: [['senior', '네가 하늘 매니저가 말하던 신입인가.'], ['senior', '나는 강철. 삼 년째 하이퍼볼급 입구를 지키고 있지. 여길 못 넘고 돌아간 녀석이 백은 넘는다.'], ['senior', '규칙이 바뀔 때마다 팀을 고쳐 짜는 놈만 위로 간다. 네 팀은 어떤지 보자.']],
		after: [['senior', '…허. 오랜만에 문이 열렸군.'], ['senior', '위에 가면 매니저에게 한 판 청해 봐라. 그 사람, 웃는 얼굴로 여기 있지만 원래는—'], ['senior', '아니다. 직접 보는 게 빠르겠지.']],
		lose: '벽은 그대로다. 이번 주 규칙을 다시 읽고 와라.' },
	{ title: '매니저의 진짜 얼굴', sub: '마스터볼급 승급전 — 하늘', who: 'manager', bg: 'champion', ace: 'dragonite',
		before: [['manager', '여기까지 올라왔구나! 등록 첫날 내 포켓몬을 빌려 쓰던 애가 말이야.'], ['manager', '강철 씨가 뭐라고 했어? …후후, 숨긴 건 아닌데. 나, 예전엔 마스터볼급에서 뛰었거든.'], ['manager', '매니저가 아니라 선수 하늘로서 상대할게. 봐주지 않을 거야!']],
		after: [['manager', '졌다~! 아, 이 느낌 오랜만이야. 분한데 기분 좋아.'], ['manager', '마스터볼급에 온 걸 환영해. 이 위에는 딱 한 자리, 챔피언급밖에 없어.'], ['manager', '그 자리를 오래 지키던 분이 은퇴하고 가끔 구경을 오셔. 눈에 띄면… 각오해 둬.']],
		lose: '아직은 내가 선배네! 스카우트 사무실에 좋은 애들 많으니까 팀을 더 채워 봐.' },
	{ title: '전 챔피언', sub: '챔피언급 도전 — 백야', who: 'champ', bg: 'champion', ace: 'tyranitar',
		before: [['champ', '자네로군. 요즘 아레나가 떠들썩한 이유가.'], ['champ', '나는 백야. 이 아레나가 생기기 전부터 챔피언 자리에 앉아 있던 늙은이일세.'], ['champ', '자리는 내려놓았지만 눈은 아직 쓸 만하지. 챔피언급에 설 그릇인지, 직접 재 보겠네.']],
		after: [['champ', '허허… 훌륭하군. 스카우트한 포켓몬 하나하나가 자네를 믿고 있어.'], ['champ', '강한 포켓몬을 모으는 건 누구나 하네. 모은 포켓몬과 같은 곳을 보는 건 아무나 못 하지.'], ['manager', '축하해! 오늘부터 네가 챔피언스 아레나의 챔피언급이야!'], ['rival', '쳇, 먼저 갔네. …금방 따라갈 거니까 자리 데워 놔!']],
		lose: '아직은 이르군. 서두르지 말게. 팀은 하루아침에 익지 않아.' },
];
/** 빌려주는 팀 (연습 승부) */
export const RENTAL = ['charizard', 'meganium', 'pidgeot', 'gyarados', 'jolteon', 'machamp'];
/** 첫 스카우트에 늘 나오는 한 마리 */
export const FIRST_FIXED = 'pikachu';
