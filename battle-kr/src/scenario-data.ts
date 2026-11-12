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
	leaf: { name: '리프', title: '태초마을의 트레이너', portrait: 'leaf', sprite: 'leaf-gen3' },
	bill: { name: '이수재', title: '포켓몬 매니아', portrait: '', sprite: 'bill' },
	grunt: { name: '로켓단 조무래기', title: '로켓단', portrait: 'd_rocketgrunt', sprite: 'rocketgrunt' },
	gruntf: { name: '로켓단 조무래기', title: '로켓단', portrait: 'd_rocketgruntf', sprite: 'rocketgruntf' },
	exec: { name: '로켓단 간부', title: '로켓단', portrait: 'teamrocketelite', sprite: 'ariana' },
	clerk: { name: '점원', title: '프렌들리숍', portrait: 'd_clerk', sprite: 'clerk' },
	joy: { name: '간호순', title: '포켓몬센터', portrait: 'd_nurse', sprite: 'nurse' },
	bugboy: { name: '곤충채집소년 민수', portrait: 'd_bugcatcher', sprite: 'bugcatcher' },
	bugboy2: { name: '곤충채집소년 도윤', portrait: 'd_bugcatcher', sprite: 'bugcatcher' },
	hunter: { name: '밀렵꾼', title: '로켓단 하청', portrait: 'd_hiker', sprite: 'hiker' },
	curator: { name: '박물관 관장', title: '회색 박물관', portrait: 'd_scientist', sprite: 'scientist' },
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
	{ id: 'pallet', name: '태초마을', sub: '태초는 새하얀 시작의 색', bg: 'pallet', x: 15, y: 90, to: ['route1'], town: true, arena: 'field', music: 'sctown', rest: '우리 집' },
	{ id: 'route1', name: '1번도로', sub: '태초마을 ↔ 상록시티', bg: 'route', x: 15, y: 75, to: ['pallet', 'viridian'], arena: 'field', music: 'scroute' },
	{ id: 'viridian', name: '상록시티', sub: '상록은 영원한 초록빛', bg: 'viridian', x: 15, y: 60, to: ['route1', 'forest'], town: true, arena: 'field', music: 'sctown', rest: '포켓몬센터' },
	{ id: 'forest', name: '상록숲', sub: '나무가 빽빽한 천연의 미로', bg: 'forest', x: 17, y: 43, to: ['viridian', 'pewter'], arena: 'field', music: 'scroute' },
	{ id: 'pewter', name: '회색시티', sub: '회색은 바위의 색', bg: 'pewter', x: 15, y: 24, to: ['forest', 'mtmoon'], town: true, arena: 'gym', music: 'sctown', rest: '포켓몬센터' },
	{ id: 'mtmoon', name: '달맞이산', sub: '달의돌이 잠든 산', bg: 'mtmoon', x: 46, y: 19, to: ['pewter', 'cerulean'], arena: 'cave', music: 'sccave' },
	{ id: 'cerulean', name: '블루시티', sub: '블루는 물빛 신비의 색', bg: 'cerulean', x: 74, y: 27, to: ['mtmoon', 'bridge'], town: true, arena: 'beach', music: 'g3deepsea', rest: '포켓몬센터' },
	{ id: 'bridge', name: '골든볼브리지', sub: '24번도로 · 금빛 난간의 다리', bg: 'bridge', x: 78, y: 13, to: ['cerulean', 'cape'], arena: 'beach', music: 'scroute' },
	{ id: 'cape', name: '블루곶', sub: '25번도로 끝 · 바다가 보이는 언덕', bg: 'cape', x: 92, y: 7, to: ['bridge'], arena: 'beach', music: 'scheart' },
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

// ───────── 마을 사람 (말을 걸면 그곳 이야기·도움말, 처음 한 번은 선물) ─────────
export interface Folk { loc: string; who: Who; lines: string[]; need?: string; /** 처음 말을 걸면 주는 물건 */ gift?: string; n?: number; first?: string[] }
export const FOLKS: Folk[] = [
	{ loc: 'pallet', who: { name: '남나리', title: '그린의 누나', portrait: 'd_daisy', sprite: 'daisy' }, gift: 'pokeball', n: 3,
		first: ['어머, {me}! 드디어 여행을 떠나는구나.', '우리 그린이 벌써 뛰쳐나갔지? 성미가 급해서 걱정이야. 길에서 만나면 잘 부탁해.', '이건 작은 응원이야. 풀숲에서 마음에 드는 아이를 만나면 써 봐.'],
		lines: ['지도를 펼치면 갈 수 있는 곳이 보여. 한 번 이동할 때마다 시간이 흐른다는 것, 잊지 마.', '그린은 어릴 때부터 할아버지를 이기는 게 꿈이었어. …너한테 지는 건 계산에 없었을걸?', '포켓몬이 지치면 언제든 집에 들러. 엄마가 기다리고 계실 거야.'] },
	{ loc: 'route1', who: { name: '프렌들리숍 직원', title: '외근 중', portrait: 'd_clerk', sprite: 'clerk' }, gift: 'oranberry',
		first: ['안녕하세요! 상록시티 프렌들리숍에서 나왔어요.', '견본을 나눠 드리고 있답니다. 포켓몬에게 지니게 하면 위급할 때 스스로 먹어요!'],
		lines: ['상록시티 가게에서는 몬스터볼과 지닌 도구를 팔아요. 들러 주세요!', '야생 포켓몬은 한 번 쓰러뜨린 뒤에 볼을 던져야 해요. 좋은 볼일수록 잘 잡혀요.', '밤에는 풀숲에서 나오는 포켓몬이 달라진답니다.'] },
	{ loc: 'viridian', who: { name: '할아버지', title: '상록시티 토박이', portrait: 'd_gentleman-gen4', sprite: 'gentleman-gen4' },
		lines: ['허허, 젊은이. 포켓몬은 같이 싸운 만큼 강해진다네. 파티의 모두가 경험치를 나눠 받지.', '배지가 없으면 포켓몬이 어느 레벨 이상으로는 자라지 않는다네. 회색시티의 웅을 찾아가 보게.', '이 도시 체육관은 관장이 오래 자리를 비웠어. 무슨 일을 하고 다니는지, 원…', '상록숲은 길이 복잡해. 낮과 저녁에만 보이는 트레이너도 있다네.'] },
	{ loc: 'pewter', who: { name: '박물관 연구원', title: '회색 박물관', portrait: 'd_scientistf', sprite: 'scientistf' },
		lines: ['회색 박물관에 어서 오세요! …라고 하고 싶지만, 오늘은 화석 전시 준비로 휴관이에요.', '달맞이산에는 달의돌과 고대 포켓몬의 화석이 잠들어 있어요. 요즘 수상한 사람들이 파헤친다던데…', '웅 관장님의 롱스톤은 정말 단단해요. 풀이나 물 타입 기술이 잘 통한답니다.', '기념품 가게의 화석 모형, 선물로 인기가 많아요. 받는 사람 취향은 잘 살피시고요!'] },
	{ loc: 'cerulean', need: 'badge2', who: { name: '수영 코치', title: '블루 체육관', portrait: 'd_swimmerf-gen4', sprite: 'swimmerf-gen4' },
		lines: ['이슬 관장님? 아침엔 수로에서 수영, 낮엔 체육관, 저녁엔 다리 쪽으로 산책을 나가세요.', '관장님은 벌레 포켓몬을 무서워하세요. 선물로 곤충 표본 같은 걸 드렸다간… 아시죠?', '하루에 한 번은 관장님과 이야기해 보세요. 고르는 대답에 따라 표정이 달라져요.', '태그를 맺으면 길거리 승부가 2대2가 돼요. 같이 이길수록 사이도 가까워진답니다.'] },
];

// ───────── 야생 포켓몬 (풀숲) ─────────
export interface Wild { loc: string; name: string; pool: [string, number, number][]; /** 밤에 나오는 포켓몬 */ night?: [string, number, number][]; /** 이 필드에 처음 올 때의 배지 수 — 배지를 더 얻으면 그만큼 레벨이 오름 */ tier: number }
/** 필드의 야생 포켓몬 레벨 보정: 그 필드에 처음 올 때보다 배지가 하나 늘 때마다 +3 (다시 찾아와도 상대가 됨) */
export const wildBonus = (w: Wild, badges: number) => Math.max(0, badges - w.tier) * 3;
export const WILDS: Wild[] = [
	{ tier: 0, loc: 'route1', name: '풀숲', pool: [['pidgey', 2, 4], ['rattata', 2, 4]], night: [['rattata', 3, 4], ['oddish', 3, 5]] },
	{ tier: 0, loc: 'forest', name: '풀숲', pool: [['caterpie', 3, 5], ['weedle', 3, 5], ['pidgey', 4, 6], ['pikachu', 4, 6], ['nidoranf', 4, 6], ['nidoranm', 4, 6]], night: [['oddish', 4, 6], ['weedle', 4, 6], ['pikachu', 5, 6], ['kakuna', 5, 6]] },
	{ tier: 1, loc: 'mtmoon', name: '동굴 그늘', pool: [['zubat', 8, 10], ['geodude', 8, 10], ['paras', 9, 10], ['sandshrew', 9, 11]], night: [['zubat', 9, 11], ['clefairy', 9, 11], ['paras', 9, 11], ['geodude', 9, 11]] },
	{ tier: 2, loc: 'bridge', name: '강가 풀숲', pool: [['oddish', 13, 15], ['bellsprout', 13, 15], ['abra', 12, 14], ['pidgey', 13, 15]], night: [['oddish', 14, 16], ['venonat', 13, 15], ['abra', 13, 15], ['psyduck', 14, 16]] },
	{ tier: 2, loc: 'cape', name: '언덕 풀숲', pool: [['pidgeotto', 16, 18], ['poliwag', 15, 17], ['slowpoke', 15, 17], ['krabby', 15, 17]], night: [['staryu', 15, 17], ['krabby', 15, 17], ['tentacool', 15, 17], ['slowpoke', 16, 18]] },
];

// ───────── 물건 ─────────
export interface Item {
	name: string; price: number; kind: 'ball' | 'held' | 'gift' | 'sell'; desc: string;
	/** 아이콘: PokeAPI sprites 의 도구 그림 이름 (scenario-assets 브랜치 /scn/ico/) */ icon: string;
	/** 볼: 잡힐 확률 */ rate?: number; /** 지닌 도구: 쇼다운 도구 id */ held?: string; /** 선물: 이슬의 취향 (2 좋아함 · 1 보통 · 0 싫어함) */ misty?: number; /** 다른 인물의 취향 (없으면 보통) */ like?: { [who: string]: number }; /** 팔 때 값 */ sell?: number;
}
export const ITEMS: { [id: string]: Item } = {
	pokeball: { icon: 'poke-ball', name: '몬스터볼', price: 200, kind: 'ball', rate: 0.55, desc: '약해진 야생 포켓몬에게 던져서 잡는 볼' },
	greatball: { icon: 'great-ball', name: '수퍼볼', price: 600, kind: 'ball', rate: 0.8, desc: '몬스터볼보다 잘 잡히는 볼' },
	oranberry: { icon: 'oran-berry', name: '오랭열매', price: 150, kind: 'held', held: 'oranberry', desc: '지니게 하면 위급할 때 HP 를 조금 회복' },
	sitrusberry: { icon: 'sitrus-berry', name: '자뭉열매', price: 400, kind: 'held', held: 'sitrusberry', desc: '지니게 하면 위급할 때 HP 를 꽤 회복' },
	hardstone: { icon: 'hard-stone', name: '딱딱한돌', price: 1000, kind: 'held', held: 'hardstone', desc: '지니게 하면 바위 타입 기술이 강해짐' },
	softsand: { icon: 'soft-sand', name: '부드러운모래', price: 1000, kind: 'held', held: 'softsand', desc: '지니게 하면 땅 타입 기술이 강해짐' },
	miracleseed: { icon: 'miracle-seed', name: '기적의씨', price: 1000, kind: 'held', held: 'miracleseed', desc: '지니게 하면 풀 타입 기술이 강해짐' },
	charcoal: { icon: 'charcoal', name: '목탄', price: 1000, kind: 'held', held: 'charcoal', desc: '지니게 하면 불꽃 타입 기술이 강해짐' },
	mysticwater: { icon: 'mystic-water', name: '신비의물방울', price: 1000, kind: 'held', held: 'mysticwater', desc: '지니게 하면 물 타입 기술이 강해짐' },
	magnet: { icon: 'magnet', name: '자석', price: 1000, kind: 'held', held: 'magnet', desc: '지니게 하면 전기 타입 기술이 강해짐' },
	quickclaw: { icon: 'quick-claw', name: '선제공격손톱', price: 2000, kind: 'held', held: 'quickclaw', desc: '지니게 하면 가끔 먼저 공격' },
	leftovers: { icon: 'leftovers', name: '먹다남은음식', price: 4000, kind: 'held', held: 'leftovers', desc: '지니게 하면 매 턴 HP 를 조금씩 회복' },
	freshwater: { icon: 'fresh-water', name: '맛있는물', price: 200, kind: 'gift', misty: 1, like: { brock: 1, leaf: 1 }, desc: '미네랄이 풍부한 물. 가볍게 건네기 좋은 선물' },
	flowers: { icon: 'small-bouquet', name: '들꽃 다발', price: 300, kind: 'gift', misty: 1, like: { brock: 1, leaf: 2 }, desc: '상록시티 꽃밭에서 엮은 꽃다발' },
	fossilmodel: { icon: 'helix-fossil', name: '화석 모형', price: 500, kind: 'gift', misty: 1, like: { brock: 2, leaf: 1 }, desc: '회색 박물관 기념품. 조개 화석 모양' },
	bugspecimen: { icon: 'shed-shell', name: '곤충 표본', price: 400, kind: 'gift', misty: 0, like: { brock: 1, leaf: 0 }, desc: '회색 박물관 기념품. 벌레 포켓몬 허물 표본… 받는 사람을 가림' },
	postcard: { icon: 'wave-mail', name: '인어 그림엽서', price: 250, kind: 'gift', misty: 2, like: { brock: 0, leaf: 2 }, desc: '블루시티 기념품. 달빛 아래 헤엄치는 인어 그림' },
	moomoo: { icon: 'moomoo-milk', name: '후르츠밀크', price: 350, kind: 'gift', misty: 2, like: { brock: 2, leaf: 2 }, desc: '수영 뒤에 마시면 최고라는 과일 우유' },
	shellnecklace: { icon: 'shell-bell', name: '조개 목걸이', price: 900, kind: 'gift', misty: 2, like: { brock: 0, leaf: 2 }, desc: '블루곶 조개껍데기로 만든 목걸이' },
	pearl: { icon: 'lone-earring', name: '진주 귀걸이', price: 1800, kind: 'gift', misty: 2, like: { brock: 0, leaf: 1 }, desc: '진주몽의 진주처럼 빛나는 귀걸이. 아주 특별한 선물' },
	ricecake: { icon: 'lava-cookie', name: '돌솥 누룽지', price: 300, kind: 'gift', misty: 1, like: { brock: 2, leaf: 1 }, desc: '회색시티 명물. 바삭하고 든든해서 동생 많은 집에 인기' },
	brush: { icon: 'poke-doll', name: '포켓몬 손질 솔', price: 800, kind: 'gift', misty: 1, like: { brock: 2, leaf: 1 }, desc: '털과 바위 틈을 손질하는 솔. 포켓몬을 돌보는 사람에게' },
	sketchbook: { icon: 'wave-mail', name: '스케치북', price: 350, kind: 'gift', misty: 1, like: { brock: 1, leaf: 2 }, desc: '만난 포켓몬을 그려 두는 공책. 관찰을 좋아하는 사람에게' },
	nugget: { icon: 'nugget', name: '금구슬', price: 0, kind: 'sell', sell: 5000, desc: '순금으로 된 구슬. 가게에 비싸게 팔 수 있다' },
};
/** 가게 진열 (지역별). need: 이 표식이 있어야 진열 */
export const SHOPS: { [loc: string]: { name: string; who: string; items: [string, string?][] } } = {
	viridian: { name: '프렌들리숍', who: 'clerk', items: [['pokeball'], ['oranberry'], ['miracleseed'], ['charcoal'], ['freshwater'], ['flowers'], ['sketchbook']] },
	pewter: { name: '프렌들리숍 · 박물관 매점', who: 'clerk', items: [['pokeball'], ['greatball', 'badge1'], ['oranberry'], ['hardstone'], ['softsand'], ['magnet'], ['fossilmodel'], ['bugspecimen'], ['ricecake'], ['brush']] },
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
/** 매일 한 번 나누는 이야기: [물음, [대답, 호감, 반응] × 3] */
export const MISTY_TALKS: [string, [string, number, string][]][] = [
	['있잖아, 넌 물 포켓몬의 어디가 좋다고 생각해?', [['유연하고 강인한 점', 8, '맞아! 부드럽지만 절대 꺾이지 않지. 뭘 좀 아는데?'], ['귀여운 점', 4, '귀엽기만 한 게 아니거든? …뭐, 귀엽긴 하지만.'], ['잘 모르겠어', 1, '에이, 같이 다니다 보면 알게 될 거야.']]],
	['체육관 관장은 도전자를 기다리는 게 일이야. 가끔은… 나도 어디론가 떠나고 싶어져.', [['같이 가자', 8, '뭐, 뭐야 갑자기! …그래도 그 말, 기억해 둘게.'], ['관장도 멋진 일이야', 5, '후후, 고마워. 그렇게 말해 주니 힘이 나네.'], ['일이 힘들구나', 2, '힘든 건 아니야! 그냥… 해 본 말이야.']]],
	['아까 풀숲에서 캐터피가 튀어나와서 소리 지를 뻔했어. 벌레는 정말 딱 질색이야!', [['내가 쫓아 줄게', 8, '저, 정말? 그럼 벌레가 나오면 네 뒤에 숨을 테니까!'], ['캐터피도 귀여운데', 0, '귀엽다고?! 그 꿈틀거리는 게?! 너랑은 취향이 안 맞나 봐…'], ['의외로 겁이 많네', 3, '겁이 많은 게 아니라 벌레만 싫은 거야! 벌레만!']]],
	['내 아쿠스타 어때? 중심의 코어가 보석처럼 빛나지?', [['트레이너를 닮아 예뻐', 8, '…! 그, 그런 말을 아무렇지 않게 하지 마! …고마워.'], ['정말 강해 보여', 6, '그치? 내 자랑이야. 스피드도 화력도 일품이거든.'], ['조금 무서워', 1, '무섭다니! 얼마나 상냥한 애인데.']]],
	['수영은 할 줄 알아? 난 물속에 있으면 머리가 맑아지거든.', [['가르쳐 줘', 8, '좋아! 각오해, 난 꽤 엄한 선생이니까. 후훗.'], ['조금은 해', 5, '그럼 언제 블루곶에서 시합할까? 물론 내가 이기겠지만!'], ['맥주병이야', 3, '푸핫, 솔직하네. 튜브라도 빌려 줄까?']]],
	['말괄량이 인어… 사람들이 날 그렇게 부르는 거 알아? 어떻게 생각해?', [['잘 어울려', 6, '칭찬이지? 칭찬으로 들을게!'], ['인어 쪽이 더 어울려', 8, '무, 뭐야… 그렇게 말하면 얼굴이 뜨거워지잖아.'], ['말괄량이 쪽이 맞아', 2, '뭐라고?! 너 이리 와 봐!']]],
];

// ───────── 인물 루트 (이슬 · 웅 · 리프) ─────────
export interface Char {
	id: string; name: string; who: string; sprite: string; /** 만난 표식 (있어야 나옴) · 루트가 열리는 표식 (없으면 호감도 상한 40) */ met: string; gate: string;
	/** 시간대별로 있는 곳 · 하는 일 · 못 가는 곳일 때 있는 곳 */ at: string[]; doing: string[]; home: string;
	/** 태그 파트너일 때의 팀 (이야기가 나아갈수록 강해짐, 레벨에 맞게 진화) */ team: (step: number, third: string) => [string, number][];
	talks: [string, [string, number, string][]][];
	/** 하트 이벤트가 열리는 [곳, 시간대(null = 아무 때나)] · 그 이벤트에 필요한 표식 */ evAt: [string, number | null][]; evNeed?: (string | undefined)[];
	evTitle: string[]; chapters: string[]; tagline: string; subtitle: string;
	/** 인사 (호감도 낮음 → 높음 5단계) */ hello: string[]; tagOn: string; tagOff: string; cheers: string[]; mateLine: string; soloLine: string;
	/** 선물 반응: 좋아함 · 보통 · 싫어함 ({item} = 물건 이름) */ gift: [string, string, string]; noGift: string; talkedLine: string; notYet: string;
}
export const likeOf = (it: Item, who: string) => who === 'misty' ? it.misty ?? 1 : it.like?.[who] ?? 1;
export const CHARS: Char[] = [
	{ id: 'misty', name: '이슬', who: 'misty', sprite: 'misty', met: 'met', gate: 'badge2', at: MISTY_AT, doing: MISTY_DOING, home: 'cerulean', team: mistyTeam, talks: MISTY_TALKS,
		evAt: [['bridge', null], ['cerulean', null], ['cape', 2], ['cape', 2]], evTitle: ['골든볼브리지의 태그 승부', '블루시티 도둑 사건', '블루곶의 노을', '진심 승부'],
		chapters: ['만남 — 블루 체육관의 말괄량이 인어', '♥1 골든볼브리지의 태그 승부', '♥2 블루시티 도둑 사건', '♥3 블루곶의 노을', '♥4 진심 승부'], tagline: '블루 체육관 관장 · 말괄량이 인어', subtitle: '물빛 신비의 색',
		hello: ['도전자… 아니, 너였구나. 무슨 일이야?', '또 왔네? 뭐, 반갑긴 해.', '어서 와! 오늘은 뭐 할 거야?', '아, 너구나. …기다린 건 아니거든?', '왔구나! 오늘은 어디로 갈까?'],
		tagOn: '태그? 좋아, 오늘은 네 파트너가 되어 줄게. 내 물 포켓몬들 실력, 옆에서 똑똑히 봐 둬!', tagOff: '벌써 끝이야? 뭐, 나도 체육관 일이 있으니까. …또 불러.',
		cheers: ['나이스! 방금 연계, 완벽했어!', '후훗, 우리 꽤 잘 맞는데?', '봤지? 내 아쿠스타의 스피드!', '좋아, 이 기세로 다음도 가자!'], mateLine: '좋아, 한꺼번에 덤벼! 가자, 파트너!', soloLine: '내 차례도 있는 거지? 아쿠스타, 준비!',
		gift: ['{item}?! 이거 갖고 싶었는데… 고, 고마워. 소중히 할게!', '{item}구나. 고마워, 잘 받을게.', '꺄악! 버, 벌레?! 이런 걸 왜 주는 거야! 당장 치워!!'], noGift: '선물? 빈손이잖아! …기대하게 만들지 마.', talkedLine: '아까 실컷 떠들었잖아. 내일 또 얘기하자!', notYet: '체육관 도전은 제자들부터! 물빛 지붕 건물이야.' },
	{ id: 'brock', name: '웅', who: 'brock', sprite: 'brock', met: 'badge1', gate: 'badge1', home: 'pewter',
		at: ['mtmoon', 'pewter', 'forest', 'pewter'], doing: ['달맞이산에서 화석 찾기', '체육관에서 도전자 맞이', '상록숲에서 포켓몬 돌보기', '회색시티 집에서 동생들 저녁 차리기'],
		team: step => [['onix', 15 + step * 3], ['geodude', 14 + step * 3], ['rhyhorn', 14 + step * 3]],
		talks: [
			['바위 포켓몬은 무뚝뚝해 보여도 정이 깊다. 너는 어떻게 보이나?', [['듬직해서 좋아', 8, '그렇지! 한번 믿으면 끝까지 버텨 주는 녀석들이다.'], ['조금 무서워', 2, '허허, 겉만 그렇다. 쓰다듬어 보면 안다.'], ['잘 모르겠어', 3, '같이 다니다 보면 알게 될 거다.']]],
			['우리 집엔 동생이 아홉이다. 밥때가 되면 전쟁이지.', [['대단한 형이네', 8, '…그런 말은 처음 듣는군. 고맙다.'], ['힘들겠다', 4, '힘들지. 하지만 싫지는 않다.'], ['시끄럽겠다', 1, '시끄럽지. 그게 사는 맛이다.']]],
			['관장 일을 하다 보면, 이기는 것보다 포켓몬이 다치지 않는 게 먼저가 된다.', [['그게 진짜 강함 같아', 8, '…너는 가끔 나보다 어른 같은 소리를 하는군.'], ['관장은 이겨야지', 2, '물론이다. 다만 그게 전부는 아니라는 거다.'], ['둘 다 중요해', 5, '욕심쟁이군. 나쁘지 않다.']]],
			['롱스톤을 닦아 주면 눈을 가늘게 뜨고 좋아한다. 본 적 있나?', [['보고 싶어', 8, '다음에 손질할 때 불러 주마. 솔질은 네가 해라.'], ['롱스톤이 웃어?', 5, '웃는다. 익숙해지면 보인다.'], ['상상이 안 가', 2, '허허, 직접 봐야 믿겠군.']]],
			['솔직히 말하면, 나는 싸우는 것보다 키우는 쪽이 좋다. 관장답지 않은 소리인가.', [['웅답다고 생각해', 8, '…그런가. 그 말, 오래 기억하겠다.'], ['관장도 잘 어울려', 5, '고맙다. 둘 다 해내 보이마.'], ['의외네', 3, '다들 그렇게 말한다.']]],
			['요즘 달맞이산에 수상한 놈들이 드나든다. 화석을 캐 가는 모양이다.', [['같이 지키자', 8, '든든하군. 그럼 아침에 산에서 보자.'], ['위험하지 않아?', 4, '위험하니까 가는 거다. 내 도시 옆 산이니까.'], ['경찰에 맡기자', 2, '그것도 방법이지. 하지만 가만있는 건 내 성미가 아니다.']]],
		],
		evAt: [['mtmoon', 0], ['pewter', null], ['forest', 2], ['pewter', 3]], evTitle: ['달맞이산의 화석 도둑', '박물관의 밤손님', '숲의 작은 진료소', '바위처럼, 물처럼'],
		chapters: ['만남 — 회색 체육관의 단단한 사나이', '♥1 달맞이산의 화석 도둑', '♥2 박물관의 밤손님', '♥3 숲의 작은 진료소', '♥4 바위처럼, 물처럼'], tagline: '회색 체육관 관장 · 단단한 사나이', subtitle: '회색은 바위의 색',
		hello: ['도전자였던 너로군. 무슨 일이지?', '왔나. 마침 쉬던 참이다.', '어서 와라. 차라도 한잔 하겠나.', '기다렸다. …아니, 그냥 그렇다는 거다.', '왔구나, 파트너. 오늘은 어디로 가지?'],
		tagOn: '태그라. 좋다, 내 바위 포켓몬들이 네 앞을 막아 주마. 뒤는 맡겨라.', tagOff: '알겠다. 체육관도 비울 수 없으니. 또 불러라.',
		cheers: ['좋은 호흡이었다.', '네가 치고 내가 버틴다. 나쁘지 않군.', '롱스톤도 만족한 얼굴이다.', '이 기세로 가자.'], mateLine: '둘이 오든 셋이 오든 같다. 간다, 파트너!', soloLine: '내 차례도 남겨 둬라. 롱스톤, 나가라!',
		gift: ['{item}인가…! 마침 필요했다. 고맙다, 잘 쓰마.', '{item}이군. 고맙게 받겠다.', '…{item}? 마음은 고맙다만, 이건 내 취향이 아니군.'], noGift: '빈손이군. 마음만 받겠다.', talkedLine: '아까 많이 얘기했다. 내일 또 하자.', notYet: '' },
	{ id: 'leaf', name: '리프', who: 'leaf', sprite: 'leaf-gen3', met: 'leafmet', gate: 'leafmet', home: 'viridian',
		at: ['forest', 'viridian', 'route1', 'pallet'], doing: ['상록숲에서 포켓몬 관찰', '상록시티에서 도감 정리', '1번도로에서 저녁 산책', '태초마을 집 앞에서 별 보기'],
		team: (step, third) => [[third, 7 + step * 4], ['pidgey', 6 + step * 4], ['clefairy', 6 + step * 4]],
		talks: [
			['나, 만난 포켓몬은 전부 공책에 그려 둬. 한번 볼래?', [['보여 줘', 8, '에헤헤, 좀 못 그렸지만… 이건 네 포켓몬이야!'], ['그림 잘 그려?', 5, '잘은 아니고… 좋아서 그리는 거야.'], ['귀찮지 않아?', 1, '귀찮다니! 이게 제일 재밌는걸.']]],
			['그린은 맨날 앞서가고, 너도 자꾸 강해지고… 나만 제자리인 것 같아.', [['넌 네 속도로 가면 돼', 8, '…응. 그 말 들으니까 좀 편해졌어. 고마워.'], ['같이 가자', 7, '정말? 그럼 나 느려도 기다려 줘야 해!'], ['더 노력해야지', 2, '으, 맞는 말인데 좀 아프다…']]],
			['오박사님이 그러셨어. 도감은 숫자가 아니라 만남의 기록이래.', [['멋진 말이네', 6, '그치? 그래서 난 한 마리 한 마리 천천히 볼 거야.'], ['네 도감이 궁금해', 8, '보여 줄게! 대신 웃으면 안 돼?'], ['난 빨리 채우고 싶어', 3, '후후, 그것도 너답다.']]],
			['숲에서 길을 잃으면 무섭지 않아? 난 사실 아직도 좀 무서워.', [['내가 같이 가 줄게', 8, '진짜지? 약속했다!'], ['금방 익숙해져', 4, '그럴까… 그럼 더 다녀 봐야겠다.'], ['겁쟁이네', 0, '너, 너무해! 조금 무섭다는 거지!']]],
			['언젠가 관동 말고 다른 지방에도 가 보고 싶어. 넌 어디 가 보고 싶어?', [['너랑 가면 어디든', 8, '에엣?! …그, 그런 말은 반칙이야.'], ['성도 지방', 5, '금빛 도시가 있대! 나도 가 보고 싶다.'], ['아직 생각 안 해 봤어', 3, '그럼 같이 생각해 보자.']]],
			['내 첫 포켓몬 있잖아, 요즘 나보다 씩씩해. 나도 닮아야 하는데.', [['이미 닮았어', 8, '…정말? 헤헤, 그럼 조금 자신 가져도 되려나.'], ['트레이너가 좋아서 그래', 7, '그렇게 말해 주면 쑥스럽잖아!'], ['포켓몬이 더 낫네', 1, '으으, 인정하긴 싫은데…']]],
		],
		evAt: [['forest', null], ['viridian', null], ['route1', 3], ['pallet', 3]], evNeed: [undefined, undefined, 'badge1', 'badge1'], evTitle: ['숲에서 길을 잃다', '도감을 노리는 손', '별이 지는 길', '출발선에서'],
		chapters: ['만남 — 같은 날 여행을 떠난 아이', '♥1 숲에서 길을 잃다', '♥2 도감을 노리는 손', '♥3 별이 지는 길', '♥4 출발선에서'], tagline: '태초마을의 트레이너 · 도감 그리는 아이', subtitle: '새하얀 시작의 색',
		hello: ['아, {me}! 여기서 다 만나네.', '또 만났다! 오늘은 뭐 봤어?', '어서 와! 마침 보여 주고 싶은 게 있었어.', '{me}다! …아, 아니, 그냥 반가워서.', '기다렸어! 오늘은 어디로 갈까?'],
		tagOn: '태그? 나, 나도 괜찮을까? …응, 해 볼게! 발목 잡지 않도록 열심히 할게!', tagOff: '벌써? 아쉽다… 다음에 또 같이 가자!',
		cheers: ['해냈다! 봤어? 봤지?', '우리 꽤 잘 맞는 것 같아!', '방금 건 공책에 그려 둬야지!', '다음도 이 기세로!'], mateLine: '두, 둘이나? …괜찮아, 우리도 둘이니까!', soloLine: '나도 나갈게! 지켜봐 줘!',
		gift: ['와아, {item}! 나 이거 정말 좋아해! 고마워, 아껴 쓸게!', '{item}이네. 고마워!', '으… {item}? 미안, 이건 조금 무서워…'], noGift: '어? 아무것도 없는데? 놀리는 거지!', talkedLine: '오늘은 많이 얘기했잖아. 내일 또 하자!', notYet: '' },
];
export const charOf = (id: string) => CHARS.find(c => c.id === id)!;
