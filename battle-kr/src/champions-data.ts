/** 챔피언스 모드 데이터 (개발자 빌드) — 값·이야기·규칙 순환.
 *  구조는 포켓몬 챔피언스(스카우트: 소개 10마리, 트레이닝, 도구 상점, 등급)를 참고했고,
 *  재화는 시뮬레이터 모드와 같은 BP(rewards.ts 지갑)를 쓴다. 인물·대사는 이 모드를 위해 새로 쓴 것. */

/** 값 (BP). 준전설은 스카우트 값이 2배, 초전설·환상은 4배 */
export const PRICE = {
	/** 레귤러 스카우트 · 지명 스카우트 · 소개 새로 받기 · 다음 소개에 타입 지정 */ scout: 8, pick: 20, refresh: 3, typeTicket: 3,
	/** 도구 · 열매 · 메가스톤 · Z크리스탈 */ item: 6, berry: 3, mega: 15, z: 6,
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

/** 가지고 시작하는 도구 */
export const START_ITEMS = ['leftovers', 'choicescarf', 'focussash', 'focusband', 'kingsrock', 'quickclaw', 'whiteherb', 'brightpowder', 'lumberry', 'sitrusberry'];
/** 상점 진열: [묶음 이름, 값 종류, 도구 id …] */
export const SHOP: [string, keyof typeof PRICE, string[]][] = [
	['도구', 'item', ['lifeorb', 'rockyhelmet', 'expertbelt', 'airballoon', 'lightclay', 'mentalherb', 'redcard', 'scopelens', 'normalgem', 'ironball', 'lightball', 'choiceband', 'choicespecs', 'assaultvest', 'eviolite', 'heavydutyboots', 'weaknesspolicy', 'safetygoggles', 'blacksludge', 'flameorb', 'toxicorb', 'powerherb', 'ejectbutton',
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
	mc: { name: '소라', title: 'PWT 진행자', sprite: 'reporter' },
};
/** 장: 등급 t 의 승점을 다 채우면 열리는 승급전 (0장은 등록·연습 승부). lines: [말하는 사람 id('' = 해설), 대사] */
export interface Chapter { title: string; sub: string; who: string; bg: string; before: [string, string][]; after: [string, string][]; lose: string; /** 상대 팀의 에이스(있으면 꼭 넣음) */ ace?: string }
export const CHAPTERS: Chapter[] = [
	{ title: '챔피언스 아레나에 어서 와', sub: '빌린 팀으로 연습 승부 · 첫 파티 고르기', who: 'manager', bg: 'pwt',
		before: [['', '관동 외곽에 새로 문을 연 배틀 시설, 챔피언스 아레나. 오늘이 등록 첫날이다.'], ['manager', '어서 와! 네가 오늘 등록한 신입이지? 나는 여기 매니저 하늘이야.'], ['manager', '여긴 이긴 만큼 BP 가 쌓이고, 그 BP 로 동료를 스카우트해서 팀을 꾸리는 곳이야.'], ['manager', '아직 포켓몬이 없지? 내 포켓몬을 빌려줄 테니까, 우선 한 판 해 보자!']],
		after: [['manager', '좋아, 감은 잡았네! 빌려준 아이들은 돌려받을게.'], ['manager', '이제부터는 네 팀으로 싸워야 해. 신입에게 맡길 파티를 세 팀 준비해 뒀어.'], ['manager', '등록 선물로 여섯 마리 파티를 통째로 줄게. 세 파티 중에 마음에 드는 걸 골라!']],
		lose: '괜찮아, 처음엔 다 그래! 남의 포켓몬으로 이기긴 어렵지. 빌려준 아이들은 돌려받을게.' },
	{ title: '같은 날 등록한 녀석', sub: '몬스터볼급 승급전 — 도윤', who: 'rival', bg: 'pwt', ace: 'arcanine',
		before: [['rival', '어, 너! 등록 창구에서 내 뒤에 서 있던 애 맞지?'], ['rival', '난 도윤. 나도 오늘 시작했어. 받은 파티에 벌써 한 마리 더 스카우트했다고!'], ['rival', '몬스터볼급 승급전 상대가 서로라니 재밌네. 누가 먼저 올라가나 보자!']],
		after: [['rival', '크으… 한 끗 차이였는데!'], ['rival', '좋아, 인정. 근데 다음 등급에선 내가 먼저 올라가 있을 거야. 두고 봐!']],
		lose: '봤지? 내가 한발 앞이야! 팀 다듬고 다시 와.' },
	{ title: '쫓아오는 발소리', sub: '슈퍼볼급 승급전 — 도윤', who: 'rival', bg: 'pwt', ace: 'garchomp',
		before: [['rival', '또 너야? …아니, 솔직히 기다렸어.'], ['rival', '트레이닝이란 걸 해 봤거든. 능력 포인트를 다시 나눴더니 완전히 다른 포켓몬이 되더라.'], ['rival', '이번엔 안 져. 진짜로!']],
		after: [['rival', '하아… 또 졌네. 너, 스카우트 눈이 좋은 거야 아니면 키우는 게 좋은 거야?'], ['manager', '둘 다지. 그리고 도윤 군도 충분히 잘하고 있어. 다음 벽은 꽤 단단하니까 둘 다 각오해.']],
		lose: '해냈다! …아니 근데 너, 봐준 거 아니지? 다시 한번 해!' },
	{ title: '단단한 벽', sub: '하이퍼볼급 승급전 — 강철', who: 'senior', bg: 'gym', ace: 'metagross',
		before: [['senior', '네가 하늘 매니저가 말하던 신입인가.'], ['senior', '나는 강철. 삼 년째 하이퍼볼급 입구를 지키고 있지. 여길 못 넘고 돌아간 녀석이 백은 넘는다.'], ['senior', '상대를 보고 팀을 고쳐 짜는 놈만 위로 간다. 네 팀은 어떤지 보자.']],
		after: [['senior', '…허. 오랜만에 문이 열렸군.'], ['senior', '위에 가면 매니저에게 한 판 청해 봐라. 그 사람, 웃는 얼굴로 여기 있지만 원래는—'], ['senior', '아니다. 직접 보는 게 빠르겠지.']],
		lose: '벽은 그대로다. 팀을 다시 다듬고 와라.' },
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

/** 컷씬: 조건을 처음 채웠을 때 한 번 보여 줌 (champions.tsx 의 events). 랭크 매치·PWT 의 고비마다 */
export interface CEvent { id: string; title: string; bg: string; lines: [string, string][] }
export const EVENTS: CEvent[] = [
	{ id: 'pwt', title: 'PWT 에 어서 오세요', bg: 'pwt', lines: [['mc', '포켓몬 월드 토너먼트, PWT 에 오신 걸 환영합니다! 저는 진행을 맡은 소라예요.'], ['mc', '여덟 명이 겨루는 토너먼트, 세 번 이기면 우승입니다. 마스터볼급 선수만 설 수 있는 무대예요.'], ['mc', '먼저 오픈 대회에서 우승해 실력을 보여 주세요. 그러면 각 지방의 관장들이 모이는 리더스 대회에 나갈 수 있습니다.'], ['manager', '아홉 지방의 리더스를 모두 우승하면 월드 리더스에 나갈 자격이 생겨. 우리 아레나의 이름을 걸고 다녀와!']] },
	{ id: 'world', title: '월드 리더스의 문', bg: 'pwt', lines: [['mc', '속보입니다! 아홉 지방의 리더스를 모두 제패한 선수가 나왔습니다!'], ['mc', '{me} 선수에게 월드 리더스 초청장이 도착했어요. 전 세계의 관장들이 무작위로 맞붙는 대회랍니다.'], ['rival', '아홉 군데를 다 돌았다고? …나는 아직 다섯 군데인데. 월드 리더스에서 기다려, 금방 갈 테니까!'], ['mc', '월드 리더스를 다섯 번 우승하면, 그 위의 무대가 열립니다. 건투를 빌어요!']] },
	{ id: 'elite', title: '사천왕이 움직인다', bg: 'champion', lines: [['mc', '월드 리더스 다섯 번째 우승! 이쯤 되면 관장들 사이에서는 적수가 없다는 얘기죠.'], ['senior', '소문은 들었다. 관장들을 그렇게 몰아붙였으니, 그 위에서 가만있을 리가 없지.'], ['mc', '맞아요. 각 지방 사천왕들이 직접 참가 신청을 해 왔습니다 — 사천왕 대회, 지금부터 열립니다!'], ['senior', '사천왕은 타입 하나를 끝까지 판 사람들이다. 약점을 찌른다고 쉽게 무너지지 않아. 팀을 여러 개 짜 둬라.']] },
	{ id: 'champs', title: '챔피언들의 초대', bg: 'champion', lines: [['mc', '사천왕 대회 다섯 번 우승… 솔직히 저도 믿기지 않아요.'], ['champ', '믿어도 되네. 내 눈으로 다 지켜봤으니.'], ['champ', '역대 챔피언들이 한자리에 모이는 대회가 있네. 이름은 그냥 「챔피언스」. 우리 아레나의 이름도 거기서 따온 거지.'], ['champ', '초대장에 자네 이름을 적어 뒀네. 정점이 어떤 곳인지, 가서 보고 오게.']] },
	{ id: 'pwtchamp', title: '세계의 정점', bg: 'champion', lines: [['mc', '우승! 「챔피언스」 우승입니다! 역대 챔피언들을 모두 꺾었습니다!'], ['champ', '허허… 내가 현역일 때도 못 해 본 일을.'], ['manager', '해냈구나! 등록 첫날 내 포켓몬을 빌려 쓰던 애가 세계 대회 우승이라니… 나 지금 울어도 돼?'], ['rival', '쳇, 또 먼저 갔어. …축하해. 진심으로. 다음엔 결승에서 보자!']] },
	{ id: 'rank1', title: '1위', bg: 'champion', lines: [['', '랭크 매치 순위표의 맨 윗줄에 낯익은 이름이 올라갔다.'], ['manager', '1위야, 1위! 순위표 봤어? 맨 위에 네 이름이 있어!'], ['champ', '오르는 것보다 지키는 게 어렵다네. 아래에서는 날마다 누군가 올라오고 있으니.'], ['champ', '그래도 오늘만큼은 마음껏 기뻐하게. 자네가 가장 강하네.']] },
];
/** 지방 리더스 대회 (모두 우승하면 월드 리더스) */
export const REGION_CUPS = ['kanto', 'johto', 'hoenn', 'sinnoh', 'unova', 'kalos', 'alola', 'galar', 'paldea'];
export const CUP_NEED = 5;
