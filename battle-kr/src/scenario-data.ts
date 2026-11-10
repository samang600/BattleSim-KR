/** 시나리오 모드 데이터 — 관동 편 (서북쪽: 태초마을 ~ 블루곶)
 *  지역·길거리 트레이너·야생 포켓몬·가게·선물·인물. 진행 로직과 화면은 scenario.tsx, 이슬 루트 대본은 scenario-misty.ts */

export const TIMES = ['아침', '낮', '저녁', '밤'] as const;
export const TIME_CLS = ['morning', 'day', 'evening', 'night'];

// ───────── 인물 (대화 초상) ─────────
export interface Who { name: string; title?: string; portrait: string; sprite: string }
export const WHO: { [id: string]: Who } = {
	oak: { name: '오박사', title: '포켓몬 박사', portrait: 'professoroak', sprite: 'oak' },
	rival: { name: '그린', title: '라이벌', portrait: 'blueoak', sprite: 'blue' },
	brock: { name: '웅', title: '회색 체육관 관장', portrait: 'brock', sprite: 'brock' },
	misty: { name: '이슬', title: '블루 체육관 관장', portrait: 'misty', sprite: 'misty' },
	bill: { name: '이수재', title: '포켓몬 매니아', portrait: '', sprite: 'bill' },
	grunt: { name: '로켓단 조무래기', title: '로켓단', portrait: 'd_rocketgrunt', sprite: 'rocketgrunt' },
	gruntf: { name: '로켓단 조무래기', title: '로켓단', portrait: 'd_rocketgruntf', sprite: 'rocketgruntf' },
	exec: { name: '로켓단 간부', title: '로켓단', portrait: 'teamrocketelite', sprite: 'ariana' },
	clerk: { name: '점원', title: '프렌들리숍', portrait: 'pokemartclerk', sprite: 'pokemartclerk' },
	joy: { name: '간호순', title: '포켓몬센터', portrait: 'nursejoy', sprite: 'nurse' },
	salesman: { name: '수상한 아저씨', portrait: 'd_gentleman-gen4', sprite: 'gentleman-gen4' },
	victim: { name: '집주인 아저씨', portrait: 'd_pokefan-gen4', sprite: 'pokefan-gen4' },
	clefairy: { name: '삐삐…?', portrait: '', sprite: '' },
};

// ───────── 지역 ─────────
export interface Loc {
	id: string; name: string; /** 들어설 때 뜨는 한 줄 (원작 표지판 문구에서) */ sub: string; bg: string;
	/** 월드맵 위 자리 (%) */ x: number; y: number; to: string[]; town?: boolean;
	/** 배틀 배경 */ arena: string; music: string; /** 쉴 수 있는 곳 이름 (집·포켓몬센터) */ rest?: string;
}
export const LOCS: Loc[] = [
	{ id: 'pallet', name: '태초마을', sub: '태초는 새하얀 시작의 색', bg: 'pallet', x: 15, y: 90, to: ['route1'], town: true, arena: 'field', music: 'lobby', rest: '우리 집' },
	{ id: 'route1', name: '1번도로', sub: '태초마을 ↔ 상록시티', bg: 'route', x: 15, y: 75, to: ['pallet', 'viridian'], arena: 'field', music: 'lobby' },
	{ id: 'viridian', name: '상록시티', sub: '상록은 영원한 초록빛', bg: 'viridian', x: 15, y: 60, to: ['route1', 'forest'], town: true, arena: 'field', music: 'lobby', rest: '포켓몬센터' },
	{ id: 'forest', name: '상록숲', sub: '나무가 빽빽한 천연의 미로', bg: 'forest', x: 17, y: 43, to: ['viridian', 'pewter'], arena: 'field', music: 'lobby' },
	{ id: 'pewter', name: '회색시티', sub: '회색은 바위의 색', bg: 'pewter', x: 15, y: 24, to: ['forest', 'mtmoon'], town: true, arena: 'gym', music: 'lobby', rest: '포켓몬센터' },
	{ id: 'mtmoon', name: '달맞이산', sub: '달의돌이 잠든 산', bg: 'mtmoon', x: 46, y: 19, to: ['pewter', 'cerulean'], arena: 'cave', music: 'g3star' },
	{ id: 'cerulean', name: '블루시티', sub: '블루는 물빛 신비의 색', bg: 'cerulean', x: 74, y: 27, to: ['mtmoon', 'bridge'], town: true, arena: 'beach', music: 'g3deepsea', rest: '포켓몬센터' },
	{ id: 'bridge', name: '골든볼브리지', sub: '24번도로 · 금빛 난간의 다리', bg: 'bridge', x: 78, y: 13, to: ['cerulean', 'cape'], arena: 'beach', music: 'g3deepsea' },
	{ id: 'cape', name: '블루곶', sub: '25번도로 끝 · 바다가 보이는 언덕', bg: 'cape', x: 92, y: 7, to: ['bridge'], arena: 'beach', music: 'g3sunset' },
];
export const locOf = (id: string) => LOCS.find(l => l.id === id)!;

// ───────── 길거리 트레이너 ─────────
export interface Trainer {
	id: string; loc: string; name: string; sprite: string; team: [string, number][]; skill: number;
	/** 나오는 시간대 (없으면 하루 종일) */ at?: number[]; before: string; after: string; again: string;
	/** 한 번만 싸움 (체육관·이야기 상대). 아니면 날이 바뀌면 다시 도전 가능 */ once?: boolean;
	/** 이 표식이 있어야 나옴 */ need?: string; music?: string; arena?: string; title?: string;
}
export const TRAINERS: Trainer[] = [
	{ id: 'r1a', loc: 'route1', name: '반바지 꼬마 태윤', sprite: 'youngster', team: [['rattata', 3], ['pidgey', 4]], skill: 0.1,
		before: '반바지는 편하고 좋아! 너도 입어 볼래?', after: '반바지는 지지 않았어…!', again: '오늘도 반바지 날씨네!' },
	{ id: 'v1', loc: 'viridian', name: '짧은치마 서아', sprite: 'lass', team: [['nidoranf', 5], ['pidgey', 5]], skill: 0.15, at: [0, 1, 2],
		before: '트레이너끼리 눈이 마주치면 승부래!', after: '에잇, 다음엔 안 져!', again: '상록숲은 벌레 포켓몬 천지야. 조심해!' },
	{ id: 'v2', loc: 'viridian', name: '반바지 꼬마 준', sprite: 'schoolboy', team: [['spearow', 6]], skill: 0.2, at: [2, 3],
		before: '학원 끝나고 한판 어때?', after: '숙제나 하러 가야겠다…', again: '밤에는 나오는 포켓몬이 달라진대.' },
	{ id: 'f1', loc: 'forest', name: '곤충채집소년 민수', sprite: 'bugcatcher', team: [['weedle', 6], ['caterpie', 6]], skill: 0.15,
		before: '숲은 벌레 포켓몬의 천국이야! 내 벌레들을 보여 줄게!', after: '으앗, 내 벌레들이…!', again: '벌레도 키우면 강해진다고!' },
	{ id: 'f2', loc: 'forest', name: '곤충채집소년 도윤', sprite: 'bugcatcher', team: [['metapod', 7], ['kakuna', 7], ['caterpie', 8]], skill: 0.2,
		before: '단단해지기만 한다고 얕보지 마!', after: '회색 체육관은 바위 타입이야. 조심해!', again: '웅 관장님은 정말 단단하다니까.' },
	{ id: 'f3', loc: 'forest', name: '짧은치마 하린', sprite: 'lass', team: [['pikachu', 8], ['oddish', 8]], skill: 0.25, at: [1, 2],
		before: '길을 잃었는데… 일단 승부나 할까?', after: '출구가 어느 쪽이더라…', again: '이 숲에는 피카츄가 숨어 산대!' },
	{ id: 'p1', loc: 'pewter', name: '캠프보이 준호', sprite: 'camper', team: [['geodude', 10], ['sandshrew', 11]], skill: 0.3, once: true, arena: 'gym', music: 'boss',
		before: '잠깐! 웅 관장님께 도전하려면 나부터 이겨야지!', after: '빠르군… 관장님께는 10000광년 이르다고 하려 했는데!', again: '관장님은 저 안에 계셔.' },
	{ id: 'brock', loc: 'pewter', name: '웅', title: '회색 체육관 관장', sprite: 'brock', team: [['geodude', 12], ['onix', 14]], skill: 0.55, once: true, need: 'p1', arena: 'gym', music: 'boss',
		before: '', after: '', again: '세상에는 더 강한 트레이너가 많다. 계속 나아가라!' },
	{ id: 'p2', loc: 'pewter', name: '등산가 석진', sprite: 'hiker', team: [['geodude', 11], ['machop', 12]], skill: 0.3, at: [0, 1],
		before: '박물관 구경 가는 길인데, 몸이나 풀고 갈까!', after: '화석처럼 굳어 버렸군…', again: '박물관에는 고대 포켓몬의 화석이 있다네.' },
	{ id: 'm1', loc: 'mtmoon', name: '짧은치마 유나', sprite: 'lass', team: [['oddish', 11], ['bellsprout', 11]], skill: 0.3,
		before: '어머, 눈이 마주쳤네? 그럼 승부야!', after: '달맞이산 안쪽에 수상한 사람들이 있었어…', again: '검은 옷 입은 사람들 조심해!' },
	{ id: 'm2', loc: 'mtmoon', name: '등산가 대산', sprite: 'hiker', team: [['geodude', 10], ['geodude', 10], ['onix', 12]], skill: 0.3,
		before: '허허! 산에서 만난 것도 인연이지. 한판 하세!', after: '이 산에는 달의돌과 화석이 잠들어 있다네.', again: '산은 언제나 거기 있지!' },
	{ id: 'rocket1', loc: 'mtmoon', name: '로켓단 조무래기', title: '로켓단', sprite: 'rocketgrunt', team: [['rattata', 13], ['zubat', 13]], skill: 0.4, once: true, music: 'evil',
		before: '뭐야, 꼬마가 여긴 왜 왔어? 우리 로켓단은 화석을 찾느라 바쁘다고! 방해하면 혼쭐을 내 주지!', after: '으윽… 로켓단을 적으로 돌리면 후회할 거다!', again: '' },
	{ id: 'm3', loc: 'mtmoon', name: '이과계의 남자 준기', sprite: 'supernerd', team: [['grimer', 12], ['voltorb', 12], ['koffing', 12]], skill: 0.45, need: 'rocket1',
		before: '거기 서! 이 화석은 내가 찾은 거야!', after: '알았어, 구경만 해…', again: '화석을 되살리는 연구소가 어딘가 있다던데…' },
	{ id: 'c1', loc: 'cerulean', name: '수영팬티 소년 루이', sprite: 'swimmer-gen4', team: [['horsea', 16], ['shellder', 16]], skill: 0.4, once: true, need: 'met', arena: 'beach', music: 'boss',
		before: '첨벙! 관장님께 가려면 이 풀장부터 건너야지!', after: '어푸… 물 먹었다!', again: '관장님 수영 실력은 진짜 인어 같다니까.' },
	{ id: 'c2', loc: 'cerulean', name: '피크닉걸 다은', sprite: 'picnicker', team: [['goldeen', 19]], skill: 0.45, once: true, need: 'c1', arena: 'beach', music: 'boss',
		before: '이슬 언니한테 도전하러 왔구나? 2년은 이르다는 걸 알려 줄게!', after: '너… 제법인걸!', again: '언니는 지금 풀장 끝에 있어.' },
	{ id: 'c3', loc: 'cerulean', name: '미니스커트 소희', sprite: 'beauty', team: [['psyduck', 17], ['poliwag', 17]], skill: 0.4, at: [1, 2], need: 'badge2',
		before: '블루시티는 물이 맑아서 포켓몬도 예뻐!', after: '어머, 머리가 다 젖었잖아!', again: '블루곶은 데이트 명소로 유명하대. 후훗.' },
	{ id: 'c4', loc: 'cerulean', name: '낚시꾼 정호', sprite: 'fisherman-gen4', team: [['magikarp', 14], ['goldeen', 17], ['poliwag', 17]], skill: 0.35, at: [0, 3], need: 'badge2',
		before: '입질이 없어서 심심하던 참이야!', after: '놓친 고기가 더 크다니까…', again: '잉어킹도 끈기 있게 키우면 대단해진다네.' },
	{ id: 'b1', loc: 'bridge', name: '곤충채집소년 케일', sprite: 'bugcatcher', team: [['caterpie', 16], ['weedle', 16], ['metapod', 17], ['kakuna', 17]], skill: 0.35, need: 'ev1',
		before: '다리 위는 바람이 좋아서 벌레 포켓몬이 잘 날아!', after: '바람에 날아갔다…', again: '5명을 다 이기면 상품이 있었다던데.' },
	{ id: 'b2', loc: 'bridge', name: '짧은치마 아리', sprite: 'lass', team: [['pidgey', 17], ['oddish', 17], ['bellsprout', 17]], skill: 0.4, need: 'ev1',
		before: '다리를 건너고 싶으면 통행료 대신 승부!', after: '통행료는 내가 내야겠네…', again: '다리 아래 강물 소리가 좋지?' },
	{ id: 'b3', loc: 'bridge', name: '반바지 꼬마 티미', sprite: 'youngster', team: [['sandshrew', 17], ['ekans', 17]], skill: 0.4, need: 'ev1', at: [0, 1, 2],
		before: '여기까지 온 걸 보니 꽤 하나 본데?', after: '꽤 하는 게 아니라 엄청 하네!', again: '난 반바지 덕분에 다리가 튼튼해!' },
	{ id: 'b4', loc: 'bridge', name: '캠프보이 이든', sprite: 'camper', team: [['mankey', 18], ['geodude', 18]], skill: 0.45, need: 'ev1', at: [1, 2, 3],
		before: '캠프파이어 전에 몸 좀 풀까!', after: '불 피우러 가야겠다…', again: '밤의 다리는 별이 잘 보여.' },
	{ id: 'k1', loc: 'cape', name: '등산가 프랭클린', sprite: 'hiker', team: [['machop', 19], ['geodude', 19]], skill: 0.45, need: 'ev2', at: [0, 1],
		before: '곶 끝까지 걸어왔더니 몸이 달아올랐군!', after: '바닷바람에 식혀야겠어…', again: '저 끝 집에 포켓몬 매니아가 산다네.' },
	{ id: 'k2', loc: 'cape', name: '피크닉걸 켈시', sprite: 'picnicker', team: [['nidoranm', 19], ['nidoranf', 19], ['clefairy', 20]], skill: 0.45, need: 'ev2', at: [1, 2],
		before: '도시락 먹기 전에 한판!', after: '배고파서 진 거야!', again: '여기 노을이 그렇게 예쁘대.' },
	{ id: 'k3', loc: 'cape', name: '커플 민호와 지유', sprite: 'youngcouple', team: [['nidorino', 20], ['nidorina', 20]], skill: 0.5, need: 'ev2', at: [2, 3],
		before: '데이트 방해꾼이다! 둘이서 혼내 주자!', after: '우리 사랑은 지지 않았어!', again: '여기는 연인들의 명소라고. 너도 누구랑 왔어?' },
];

// ───────── 야생 포켓몬 (풀숲) ─────────
export interface Wild { loc: string; name: string; pool: [string, number, number][]; /** 밤에 나오는 포켓몬 */ night?: [string, number, number][] }
export const WILDS: Wild[] = [
	{ loc: 'route1', name: '풀숲', pool: [['pidgey', 2, 4], ['rattata', 2, 4]], night: [['rattata', 3, 4], ['oddish', 3, 5]] },
	{ loc: 'forest', name: '풀숲', pool: [['caterpie', 3, 5], ['weedle', 3, 5], ['pidgey', 4, 6], ['pikachu', 4, 6], ['nidoranf', 4, 6], ['nidoranm', 4, 6]], night: [['oddish', 4, 6], ['weedle', 4, 6], ['pikachu', 5, 6], ['kakuna', 5, 6]] },
	{ loc: 'mtmoon', name: '동굴 그늘', pool: [['zubat', 8, 10], ['geodude', 8, 10], ['paras', 9, 10], ['sandshrew', 9, 11]], night: [['zubat', 9, 11], ['clefairy', 9, 11], ['paras', 9, 11], ['geodude', 9, 11]] },
	{ loc: 'bridge', name: '강가 풀숲', pool: [['oddish', 13, 15], ['bellsprout', 13, 15], ['abra', 12, 14], ['pidgey', 13, 15]], night: [['oddish', 14, 16], ['venonat', 13, 15], ['abra', 13, 15], ['psyduck', 14, 16]] },
	{ loc: 'cape', name: '언덕 풀숲', pool: [['pidgeotto', 16, 18], ['poliwag', 15, 17], ['slowpoke', 15, 17], ['krabby', 15, 17]], night: [['staryu', 15, 17], ['krabby', 15, 17], ['tentacool', 15, 17], ['slowpoke', 16, 18]] },
];

// ───────── 물건 ─────────
export interface Item {
	name: string; price: number; kind: 'ball' | 'held' | 'gift' | 'sell'; desc: string;
	/** 볼: 잡힐 확률 */ rate?: number; /** 지닌 도구: 쇼다운 도구 id */ held?: string; /** 선물: 이슬의 취향 (2 좋아함 · 1 보통 · 0 싫어함) */ misty?: number; /** 팔 때 값 */ sell?: number;
}
export const ITEMS: { [id: string]: Item } = {
	pokeball: { name: '몬스터볼', price: 200, kind: 'ball', rate: 0.55, desc: '약해진 야생 포켓몬에게 던져서 잡는 볼' },
	greatball: { name: '수퍼볼', price: 600, kind: 'ball', rate: 0.8, desc: '몬스터볼보다 잘 잡히는 볼' },
	oranberry: { name: '오랭열매', price: 150, kind: 'held', held: 'oranberry', desc: '지니게 하면 위급할 때 HP 를 조금 회복' },
	sitrusberry: { name: '자뭉열매', price: 400, kind: 'held', held: 'sitrusberry', desc: '지니게 하면 위급할 때 HP 를 꽤 회복' },
	hardstone: { name: '딱딱한돌', price: 1000, kind: 'held', held: 'hardstone', desc: '지니게 하면 바위 타입 기술이 강해짐' },
	softsand: { name: '부드러운모래', price: 1000, kind: 'held', held: 'softsand', desc: '지니게 하면 땅 타입 기술이 강해짐' },
	miracleseed: { name: '기적의씨', price: 1000, kind: 'held', held: 'miracleseed', desc: '지니게 하면 풀 타입 기술이 강해짐' },
	charcoal: { name: '목탄', price: 1000, kind: 'held', held: 'charcoal', desc: '지니게 하면 불꽃 타입 기술이 강해짐' },
	mysticwater: { name: '신비의물방울', price: 1000, kind: 'held', held: 'mysticwater', desc: '지니게 하면 물 타입 기술이 강해짐' },
	magnet: { name: '자석', price: 1000, kind: 'held', held: 'magnet', desc: '지니게 하면 전기 타입 기술이 강해짐' },
	quickclaw: { name: '선제공격손톱', price: 2000, kind: 'held', held: 'quickclaw', desc: '지니게 하면 가끔 먼저 공격' },
	leftovers: { name: '먹다남은음식', price: 4000, kind: 'held', held: 'leftovers', desc: '지니게 하면 매 턴 HP 를 조금씩 회복' },
	freshwater: { name: '맛있는물', price: 200, kind: 'gift', misty: 1, desc: '미네랄이 풍부한 물. 가볍게 건네기 좋은 선물' },
	flowers: { name: '들꽃 다발', price: 300, kind: 'gift', misty: 1, desc: '상록시티 꽃밭에서 엮은 꽃다발' },
	fossilmodel: { name: '화석 모형', price: 500, kind: 'gift', misty: 1, desc: '회색 박물관 기념품. 조개 화석 모양' },
	bugspecimen: { name: '곤충 표본', price: 400, kind: 'gift', misty: 0, desc: '회색 박물관 기념품. 벌레 포켓몬 허물 표본… 받는 사람을 가림' },
	postcard: { name: '인어 그림엽서', price: 250, kind: 'gift', misty: 2, desc: '블루시티 기념품. 달빛 아래 헤엄치는 인어 그림' },
	moomoo: { name: '후르츠밀크', price: 350, kind: 'gift', misty: 2, desc: '수영 뒤에 마시면 최고라는 과일 우유' },
	shellnecklace: { name: '조개 목걸이', price: 900, kind: 'gift', misty: 2, desc: '블루곶 조개껍데기로 만든 목걸이' },
	pearl: { name: '진주 귀걸이', price: 1800, kind: 'gift', misty: 2, desc: '진주몽의 진주처럼 빛나는 귀걸이. 아주 특별한 선물' },
	nugget: { name: '금구슬', price: 0, kind: 'sell', sell: 5000, desc: '순금으로 된 구슬. 가게에 비싸게 팔 수 있다' },
};
/** 가게 진열 (지역별). need: 이 표식이 있어야 진열 */
export const SHOPS: { [loc: string]: { name: string; who: string; items: [string, string?][] } } = {
	viridian: { name: '프렌들리숍', who: 'clerk', items: [['pokeball'], ['oranberry'], ['miracleseed'], ['charcoal'], ['freshwater'], ['flowers']] },
	pewter: { name: '프렌들리숍 · 박물관 매점', who: 'clerk', items: [['pokeball'], ['greatball', 'badge1'], ['oranberry'], ['hardstone'], ['softsand'], ['magnet'], ['fossilmodel'], ['bugspecimen']] },
	cerulean: { name: '프렌들리숍 · 기념품', who: 'clerk', items: [['pokeball'], ['greatball'], ['sitrusberry'], ['mysticwater'], ['quickclaw'], ['leftovers', 'badge2'], ['freshwater'], ['postcard'], ['moomoo'], ['shellnecklace'], ['pearl', 'badge2']] },
};

// ───────── 처음 포켓몬 ─────────
export const STARTERS: [string, string][] = [['bulbasaur', '풀 타입 · 웅과 이슬 모두에게 유리해요'], ['charmander', '불꽃 타입 · 초반 체육관이 험난해요'], ['squirtle', '물 타입 · 바위 체육관에 강해요']];
export const RIVAL_OF: { [k: string]: string } = { bulbasaur: 'charmander', charmander: 'squirtle', squirtle: 'bulbasaur' };

/** 레벨 상한 (배지 수) — 원작의 '배지가 없으면 말을 안 듣는 레벨'처럼 */
export const LV_CAP = [15, 22, 30];
export const expNeed = (lv: number) => 12 + lv * 6;

// ───────── 이슬 ─────────
/** 시간대별로 있는 곳 (열리지 않은 곳이면 블루시티) */
export const MISTY_AT = ['cape', 'cerulean', 'bridge', 'cerulean'];
export const MISTY_DOING = ['블루곶에서 아침 수영', '체육관에서 도전자 맞이', '골든볼브리지에서 저녁 산책', '블루시티 물가에서 별 구경'];
/** 태그 파트너일 때 이슬의 팀 (이야기가 나아갈수록 강해짐) */
export const mistyTeam = (step: number): [string, number][] => [['starmie', 21 + step * 2], ['psyduck', 18 + step * 2], ['horsea', 18 + step * 2]];
/** 마지막 진심 승부 */
export const MISTY_FINAL: [string, number][] = [['golduck', 27], ['seadra', 27], ['lapras', 28], ['starmie', 30]];
/** 매일 한 번 나누는 이야기: [물음, [대답, 호감, 반응] × 3] */
export const MISTY_TALKS: [string, [string, number, string][]][] = [
	['있잖아, 넌 물 포켓몬의 어디가 좋다고 생각해?', [['유연하고 강인한 점', 8, '맞아! 부드럽지만 절대 꺾이지 않지. 뭘 좀 아는데?'], ['귀여운 점', 4, '귀엽기만 한 게 아니거든? …뭐, 귀엽긴 하지만.'], ['잘 모르겠어', 1, '에이, 같이 다니다 보면 알게 될 거야.']]],
	['체육관 관장은 도전자를 기다리는 게 일이야. 가끔은… 나도 어디론가 떠나고 싶어져.', [['같이 가자', 8, '뭐, 뭐야 갑자기! …그래도 그 말, 기억해 둘게.'], ['관장도 멋진 일이야', 5, '후후, 고마워. 그렇게 말해 주니 힘이 나네.'], ['일이 힘들구나', 2, '힘든 건 아니야! 그냥… 해 본 말이야.']]],
	['아까 풀숲에서 캐터피가 튀어나와서 소리 지를 뻔했어. 벌레는 정말 딱 질색이야!', [['내가 쫓아 줄게', 8, '저, 정말? 그럼 벌레가 나오면 네 뒤에 숨을 테니까!'], ['캐터피도 귀여운데', 0, '귀엽다고?! 그 꿈틀거리는 게?! 너랑은 취향이 안 맞나 봐…'], ['의외로 겁이 많네', 3, '겁이 많은 게 아니라 벌레만 싫은 거야! 벌레만!']]],
	['내 아쿠스타 어때? 중심의 코어가 보석처럼 빛나지?', [['트레이너를 닮아 예뻐', 8, '…! 그, 그런 말을 아무렇지 않게 하지 마! …고마워.'], ['정말 강해 보여', 6, '그치? 내 자랑이야. 스피드도 화력도 일품이거든.'], ['조금 무서워', 1, '무섭다니! 얼마나 상냥한 애인데.']]],
	['수영은 할 줄 알아? 난 물속에 있으면 머리가 맑아지거든.', [['가르쳐 줘', 8, '좋아! 각오해, 난 꽤 엄한 선생이니까. 후훗.'], ['조금은 해', 5, '그럼 언제 블루곶에서 시합할까? 물론 내가 이기겠지만!'], ['맥주병이야', 3, '푸핫, 솔직하네. 튜브라도 빌려 줄까?']]],
	['말괄량이 인어… 사람들이 날 그렇게 부르는 거 알아? 어떻게 생각해?', [['잘 어울려', 6, '칭찬이지? 칭찬으로 들을게!'], ['인어 쪽이 더 어울려', 8, '무, 뭐야… 그렇게 말하면 얼굴이 뜨거워지잖아.'], ['말괄량이 쪽이 맞아', 2, '뭐라고?! 너 이리 와 봐!']]],
];
