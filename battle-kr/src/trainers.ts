/** 네임드 트레이너 · 일반 트레이너 · PWT 대회 데이터 */
import { rng } from './sets';
import { NAMED_SPRITE, NAMED_LINES, genericLines } from './trainer-lines';
import { NAMED_LORE, EXTRA_NAMED as EXTRA_LORE } from './trainer-lore';
import { ANIME_NAMED } from './anime-trainers';
import { MORE_ANIME, MORE_NAMED } from './more-trainers';
/** 추가 인물 + 애니메이션 오리지널 트레이너 (+ v2.54 에 더한 빠진 네임드·애니메이션 인물) */
const EXTRA_NAMED = [...EXTRA_LORE, ...MORE_NAMED, ...ANIME_NAMED, ...MORE_ANIME];

export interface NamedTrainer {
	id: string;
	name: string;
	title: string; // 예: '회색체육관 관장'
	region: '관동' | '성도' | '호연' | '신오' | '하나' | '칼로스' | '알로라' | '가라르' | '팔데아' | '미르시티' | '애니메이션';
	role: 'leader' | 'elite' | 'champion' | 'hero' | 'rival' | 'admin' | 'boss';
	team: string[]; // 종족 ID 6마리 (앞쪽이 에이스 순서 아님)
	ace: string; // 마지막에 나오는 에이스
	line?: string; // 승부 시작 대사
}

const T = (id: string, name: string, title: string, region: NamedTrainer['region'], role: NamedTrainer['role'],
	team: string[], line?: string): NamedTrainer => ({ id, name, title, region, role, team, ace: team[team.length - 1], line });

const BASE_NAMED: NamedTrainer[] = [
	// ── 관동 ──
	T('brock', '웅', '관동 체육관 관장 · 바위', '관동', 'leader', ['kabutops', 'omastar', 'aerodactyl', 'golem', 'rhyperior', 'steelix'], '단단한 의지의 바위 포켓몬을 보여주지!'),
	T('misty', '이슬', '관동 체육관 관장 · 물', '관동', 'leader', ['golduck', 'quagsire', 'lapras', 'politoed', 'gyarados', 'starmie'], '내 물 포켓몬의 실력, 얕보지 마!'),
	T('ltsurge', '마티스', '관동 체육관 관장 · 전기', '관동', 'leader', ['electrode', 'lanturn', 'jolteon', 'magnezone', 'electivire', 'raichu'], '찌릿찌릿하게 해 주마!'),
	T('erika', '민화', '관동 체육관 관장 · 풀', '관동', 'leader', ['bellossom', 'jumpluff', 'victreebel', 'tangrowth', 'exeggutor', 'vileplume'], '꽃처럼 우아하게 상대해 드릴게요.'),
	T('koga', '독수', '관동 체육관 관장 · 독', '관동', 'leader', ['ariados', 'venomoth', 'tentacruel', 'muk', 'weezing', 'crobat'], '닌자의 독술을 맛보아라!'),
	T('sabrina', '초련', '관동 체육관 관장 · 에스퍼', '관동', 'leader', ['xatu', 'jynx', 'mrmime', 'slowbro', 'espeon', 'alakazam'], '네가 질 거라는 건 이미 보였어.'),
	T('blaine', '강연', '관동 체육관 관장 · 불꽃', '관동', 'leader', ['torkoal', 'ninetales', 'rapidash', 'houndoom', 'magmortar', 'arcanine'], '화상 치료제는 준비했겠지!'),
	T('giovanni', '비주기', '관동 체육관 관장 · 땅', '관동', 'leader', ['dugtrio', 'marowak', 'krookodile', 'nidoqueen', 'rhyperior', 'nidoking'], '진정한 강함을 가르쳐 주지.'),
	T('lorelei', '칸나', '관동 사천왕 · 얼음', '관동', 'elite', ['dewgong', 'cloyster', 'jynx', 'slowbro', 'mamoswine', 'lapras'], '얼음 포켓몬으로 얼려 주겠어!'),
	T('bruno', '시바', '관동 사천왕 · 격투', '관동', 'elite', ['hitmonlee', 'hitmonchan', 'hitmontop', 'poliwrath', 'steelix', 'machamp'], '우오오! 단련된 근육을 보여주마!'),
	T('agatha', '국화', '관동 사천왕 · 고스트', '관동', 'elite', ['arbok', 'weezing', 'crobat', 'dusknoir', 'mismagius', 'gengar'], '포켓몬은 싸우기 위해 있는 거란다!'),
	T('lance', '목호', '관동·성도 챔피언', '관동', 'champion', ['aerodactyl', 'gyarados', 'charizard', 'kingdra', 'salamence', 'dragonite'], '드래곤 포켓몬의 힘, 느껴 보아라!'),
	T('blue', '그린', '관동 챔피언', '관동', 'champion', ['pidgeot', 'exeggutor', 'rhyperior', 'gyarados', 'alakazam', 'arcanine'], '내가 세계에서 제일 강하다고!'),
	T('red', '레드', '전설의 트레이너', '관동', 'champion', ['espeon', 'snorlax', 'venusaur', 'blastoise', 'charizard', 'lapras'], '…………'),
	// ── 성도 ──
	T('falkner', '비상', '성도 체육관 관장 · 비행', '성도', 'leader', ['noctowl', 'swellow', 'honchkrow', 'skarmory', 'staraptor', 'pidgeot'], '비행 포켓몬의 진가를 보여주지!'),
	T('bugsy', '호일', '성도 체육관 관장 · 벌레', '성도', 'leader', ['shuckle', 'forretress', 'yanmega', 'pinsir', 'heracross', 'scizor'], '벌레 포켓몬 연구의 성과를 보여줄게!'),
	T('whitney', '꼭두', '성도 체육관 관장 · 노말', '성도', 'leader', ['farigiraf', 'ambipom', 'wigglytuff', 'clefable', 'blissey', 'miltank'], '귀엽다고 봐주면 안 돼~!'),
	T('morty', '유빈', '성도 체육관 관장 · 고스트', '성도', 'leader', ['sableye', 'banette', 'drifblim', 'dusknoir', 'mismagius', 'gengar'], '보이지 않는 것을 보는 힘이 있어.'),
	T('chuck', '사도', '성도 체육관 관장 · 격투', '성도', 'leader', ['annihilape', 'hitmontop', 'breloom', 'heracross', 'machamp', 'poliwrath'], '와하하! 수련의 성과다!'),
	T('jasmine', '규리', '성도 체육관 관장 · 강철', '성도', 'leader', ['forretress', 'skarmory', 'ampharos', 'magnezone', 'scizor', 'steelix'], '강철처럼 단단하게… 열심히 할게요.'),
	T('pryce', '류옹', '성도 체육관 관장 · 얼음', '성도', 'leader', ['glalie', 'dewgong', 'walrein', 'weavile', 'lapras', 'mamoswine'], '세월의 무게를 견뎌 온 얼음이다.'),
	T('clair', '이향', '성도 체육관 관장 · 드래곤', '성도', 'leader', ['altaria', 'flygon', 'gyarados', 'salamence', 'dragonite', 'kingdra'], '드래곤 사용자의 자존심을 걸고!'),
	T('will', '일목', '성도 사천왕 · 에스퍼', '성도', 'elite', ['exeggutor', 'jynx', 'slowbro', 'bronzong', 'gardevoir', 'xatu'], '에스퍼의 힘을 보여주지.'),
	T('karen', '카렌', '성도 사천왕 · 악', '성도', 'elite', ['honchkrow', 'weavile', 'spiritomb', 'houndoom', 'tyranitar', 'umbreon'], '강한 포켓몬, 약한 포켓몬… 그건 사람의 제멋대로야.'),
	// ── 호연 ──
	T('roxanne', '원규', '호연 체육관 관장 · 바위', '호연', 'leader', ['relicanth', 'armaldo', 'cradily', 'aerodactyl', 'golem', 'probopass'], '배운 것을 실전에서 확인할 때예요!'),
	T('brawly', '철구', '호연 체육관 관장 · 격투', '호연', 'leader', ['medicham', 'breloom', 'hitmontop', 'lucario', 'machamp', 'hariyama'], '거친 파도처럼 몰아쳐 주지!'),
	T('wattson', '암페어', '호연 체육관 관장 · 전기', '호연', 'leader', ['electrode', 'lanturn', 'raichu', 'ampharos', 'magnezone', 'manectric'], '우와하하! 짜릿한 승부를 해 보자!'),
	T('flannery', '민지', '호연 체육관 관장 · 불꽃', '호연', 'leader', ['magcargo', 'ninetales', 'houndoom', 'camerupt', 'magmortar', 'torkoal'], '뜨거운 승부를 보여줄게!'),
	T('norman', '종길', '호연 체육관 관장 · 노말', '호연', 'leader', ['ursaluna', 'swellow', 'kangaskhan', 'porygonz', 'snorlax', 'slaking'], '아버지로서, 관장으로서 전력을 다하겠다.'),
	T('winona', '은송', '호연 체육관 관장 · 비행', '호연', 'leader', ['pelipper', 'tropius', 'swellow', 'skarmory', 'staraptor', 'altaria'], '하늘을 나는 포켓몬의 우아함을 봐!'),
	T('tateliza', '풍&란', '호연 체육관 관장 · 에스퍼', '호연', 'leader', ['solrock', 'lunatone', 'xatu', 'claydol', 'gardevoir', 'metagross'], '우리 둘의 호흡을 깨뜨릴 수 있을까?'),
	T('juan', '아단', '호연 체육관 관장 · 물', '호연', 'leader', ['whiscash', 'crawdaunt', 'ludicolo', 'walrein', 'milotic', 'kingdra'], '물과 하나 된 아름다운 승부를!'),
	T('sidney', '혁진', '호연 사천왕 · 악', '호연', 'elite', ['mightyena', 'cacturne', 'shiftry', 'crawdaunt', 'sharpedo', 'absol'], '좋아, 신나게 붙어 보자고!'),
	T('phoebe', '회연', '호연 사천왕 · 고스트', '호연', 'elite', ['sableye', 'banette', 'spiritomb', 'mismagius', 'froslass', 'dusknoir'], '보이지 않는 세계의 포켓몬과 함께 수행했어.'),
	T('glacia', '미혜', '호연 사천왕 · 얼음', '호연', 'elite', ['glalie', 'froslass', 'abomasnow', 'cloyster', 'mamoswine', 'walrein'], '차가운 얼음의 기술을 맛보세요.'),
	T('drake', '권수', '호연 사천왕 · 드래곤', '호연', 'elite', ['altaria', 'flygon', 'kingdra', 'dragonite', 'garchomp', 'salamence'], '드래곤 포켓몬을 다루려면 필요한 것이 있다!'),
	T('steven', '성호', '호연 챔피언', '호연', 'champion', ['skarmory', 'claydol', 'cradily', 'armaldo', 'aggron', 'metagross'], '자, 전력으로 승부하자!'),
	T('wallace', '윤진', '호연 챔피언', '호연', 'champion', ['wailord', 'tentacruel', 'ludicolo', 'whiscash', 'gyarados', 'milotic'], '아름다움과 강함, 모두 보여주지.'),
	// ── 신오 ──
	T('roark', '강석', '신오 체육관 관장 · 바위', '신오', 'leader', ['bastiodon', 'probopass', 'golem', 'aerodactyl', 'rhyperior', 'rampardos'], '내 화석 포켓몬은 단단하다고!'),
	T('gardenia', '유채', '신오 체육관 관장 · 풀', '신오', 'leader', ['cherrim', 'carnivine', 'tangrowth', 'leafeon', 'torterra', 'roserade'], '풀 포켓몬의 매력, 알려줄게!'),
	T('maylene', '자두', '신오 체육관 관장 · 격투', '신오', 'leader', ['toxicroak', 'breloom', 'hitmontop', 'medicham', 'machamp', 'lucario'], '열심히 수행한 성과를 보여줄게요!'),
	T('crasherwake', '맥실러', '신오 체육관 관장 · 물', '신오', 'leader', ['quagsire', 'ludicolo', 'gastrodon', 'empoleon', 'gyarados', 'floatzel'], '물 포켓몬의 거친 파도를 받아라!'),
	T('fantina', '멜리사', '신오 체육관 관장 · 고스트', '신오', 'leader', ['rotom', 'froslass', 'drifblim', 'dusknoir', 'gengar', 'mismagius'], '나의 포켓몬, 아주 아름답죠?'),
	T('byron', '동관', '신오 체육관 관장 · 강철', '신오', 'leader', ['skarmory', 'magnezone', 'empoleon', 'bronzong', 'steelix', 'bastiodon'], '강철의 방어를 뚫을 수 있겠느냐!'),
	T('candice', '무청', '신오 체육관 관장 · 얼음', '신오', 'leader', ['glaceon', 'walrein', 'weavile', 'mamoswine', 'abomasnow', 'froslass'], '집중! 집중이야!'),
	T('volkner', '전진', '신오 체육관 관장 · 전기', '신오', 'leader', ['ambipom', 'octillery', 'raichu', 'jolteon', 'electivire', 'luxray'], '나를 감전시킬 승부를 보여줘.'),
	T('aaron', '충호', '신오 사천왕 · 벌레', '신오', 'elite', ['dustox', 'vespiquen', 'yanmega', 'heracross', 'scizor', 'drapion'], '벌레 포켓몬의 강인함을 보여주마!'),
	T('bertha', '들국화', '신오 사천왕 · 땅', '신오', 'elite', ['quagsire', 'whiscash', 'golem', 'gliscor', 'rhyperior', 'hippowdon'], '할머니라고 얕보면 큰코다친다.'),
	T('flint', '대엽', '신오 사천왕 · 불꽃', '신오', 'elite', ['rapidash', 'flareon', 'houndoom', 'magmortar', 'drifblim', 'infernape'], '불타오르는 승부를 하자고!'),
	T('lucian', '오엽', '신오 사천왕 · 에스퍼', '신오', 'elite', ['farigiraf', 'mrmime', 'espeon', 'gallade', 'alakazam', 'bronzong'], '책을 덮고, 승부에 집중하지.'),
	T('cynthia', '난천', '신오 챔피언', '신오', 'champion', ['spiritomb', 'roserade', 'gastrodon', 'lucario', 'milotic', 'garchomp'], '포켓몬 챔피언 난천. 승부를 받아들일게.'),
	// ── 하나 ──
	T('cheren', '체렌', '하나 체육관 관장 · 노말', '하나', 'leader', ['watchog', 'cinccino', 'bouffalant', 'unfezant', 'audino', 'stoutland'], '강함이란 무엇인지, 승부로 확인하자.'),
	T('lenora', '알로에', '하나 체육관 관장 · 노말', '하나', 'leader', ['watchog', 'cinccino', 'kangaskhan', 'bouffalant', 'miltank', 'stoutland'], '노말 포켓몬을 연구한 성과야!'),
	T('burgh', '아티', '하나 체육관 관장 · 벌레', '하나', 'leader', ['accelgor', 'crustle', 'galvantula', 'escavalier', 'scolipede', 'leavanny'], '나의 예술적인 벌레 포켓몬을 봐!'),
	T('elesa', '카밀레', '하나 체육관 관장 · 전기', '하나', 'leader', ['emolga', 'jolteon', 'ampharos', 'galvantula', 'eelektross', 'zebstrika'], '눈부시게 반짝이는 승부를!'),
	T('clay', '야콘', '하나 체육관 관장 · 땅', '하나', 'leader', ['gigalith', 'seismitoad', 'golurk', 'steelix', 'krookodile', 'excadrill'], '내 땅 포켓몬은 거칠다고!'),
	T('skyla', '풍란', '하나 체육관 관장 · 비행', '하나', 'leader', ['sigilyph', 'unfezant', 'archeops', 'skarmory', 'braviary', 'swanna'], '하늘을 날듯이 즐거운 승부를!'),
	T('brycen', '담죽', '하나 체육관 관장 · 얼음', '하나', 'leader', ['cryogonal', 'vanilluxe', 'weavile', 'abomasnow', 'mamoswine', 'beartic'], '얼음처럼 냉정하게 상대해 주지.'),
	T('drayden', '사간', '하나 체육관 관장 · 드래곤', '하나', 'leader', ['druddigon', 'altaria', 'flygon', 'dragonite', 'salamence', 'haxorus'], '드래곤의 긍지를 걸고!'),
	T('roxie', '보미카', '하나 체육관 관장 · 독', '하나', 'leader', ['crobat', 'leavanny', 'garbodor', 'scolipede', 'weezing', 'toxicroak'], '독한 라이브, 시작할게!'),
	T('marlon', '시즈', '하나 체육관 관장 · 물', '하나', 'leader', ['carracosta', 'wailord', 'mantine', 'jellicent', 'swanna', 'samurott'], '바다처럼 넓은 마음으로 승부!'),
	T('shauntal', '망초', '하나 사천왕 · 고스트', '하나', 'elite', ['cofagrigus', 'jellicent', 'golurk', 'drifblim', 'froslass', 'chandelure'], '당신의 이야기를 들려줘요.'),
	T('grimsley', '블래리', '하나 사천왕 · 악', '하나', 'elite', ['scrafty', 'krookodile', 'liepard', 'houndoom', 'tyranitar', 'kingambit'], '승부는 도박이지.'),
	T('caitlin', '카틀레야', '하나 사천왕 · 에스퍼', '하나', 'elite', ['musharna', 'sigilyph', 'gothitelle', 'bronzong', 'metagross', 'reuniclus'], '…우아하게 상대해 드릴게요.'),
	T('marshal', '연무', '하나 사천왕 · 격투', '하나', 'elite', ['throh', 'sawk', 'mienshao', 'breloom', 'lucario', 'conkeldurr'], '스승의 가르침을 보여주마!'),
	T('alder', '노간주', '하나 챔피언', '하나', 'champion', ['bouffalant', 'accelgor', 'vanilluxe', 'escavalier', 'druddigon', 'volcarona'], '포켓몬과의 승부, 즐겨 보자!'),
	T('iris', '아이리스', '하나 챔피언', '하나', 'champion', ['archeops', 'lapras', 'aggron', 'dragonite', 'hydreigon', 'haxorus'], '드래곤 포켓몬과 함께, 진심으로 갈게!'),
	// ── 칼로스 ──
	T('viola', '비올라', '칼로스 체육관 관장 · 벌레', '칼로스', 'leader', ['masquerain', 'vivillon', 'scizor', 'galvantula', 'volcarona', 'pinsir'], '렌즈 너머의 승부, 찰칵!'),
	T('grant', '자크로', '칼로스 체육관 관장 · 바위', '칼로스', 'leader', ['rhyperior', 'aerodactyl', 'barbaracle', 'aurorus', 'tyrantrum', 'lycanroc'], '벽을 오르듯 한 걸음씩!'),
	T('korrina', '코르니', '칼로스 체육관 관장 · 격투', '칼로스', 'leader', ['mienshao', 'hawlucha', 'machamp', 'medicham', 'hitmontop', 'lucario'], '롤러 타고 승부다!'),
	T('ramos', '후쿠지', '칼로스 체육관 관장 · 풀', '칼로스', 'leader', ['jumpluff', 'victreebel', 'gogoat', 'trevenant', 'amoonguss', 'venusaur'], '정원사의 끈기를 보여주지.'),
	T('clemont', '시트론', '칼로스 체육관 관장 · 전기', '칼로스', 'leader', ['emolga', 'magnezone', 'rotomwash', 'ampharos', 'luxray', 'heliolisk'], '과학의 힘으로 승부!'),
	T('valerie', '마슈', '칼로스 체육관 관장 · 페어리', '칼로스', 'leader', ['mawile', 'mrmime', 'azumarill', 'florges', 'togekiss', 'sylveon'], '요정의 꿈 같은 승부를.'),
	T('olympia', '고지카', '칼로스 체육관 관장 · 에스퍼', '칼로스', 'leader', ['sigilyph', 'slowking', 'gothitelle', 'malamar', 'gardevoir', 'meowstic'], '별이 알려준 운명을 따르겠다.'),
	T('wulfric', '우르프', '칼로스 체육관 관장 · 얼음', '칼로스', 'leader', ['abomasnow', 'cryogonal', 'walrein', 'glalie', 'mamoswine', 'avalugg'], '얼음처럼 우직하게 간다!'),
	T('malva', '파키라', '칼로스 사천왕 · 불꽃', '칼로스', 'elite', ['pyroar', 'torkoal', 'chandelure', 'houndoom', 'blaziken', 'talonflame'], '뜨겁게 태워 주지.'),
	T('siebold', '즈미', '칼로스 사천왕 · 물', '칼로스', 'elite', ['clawitzer', 'starmie', 'gyarados', 'milotic', 'kingdra', 'barbaracle'], '요리처럼 섬세한 승부를.'),
	T('wikstrom', '간피', '칼로스 사천왕 · 강철', '칼로스', 'elite', ['klefki', 'probopass', 'scizor', 'metagross', 'kingambit', 'aegislash'], '기사의 이름을 걸고!'),
	T('drasna', '드라세나', '칼로스 사천왕 · 드래곤', '칼로스', 'elite', ['dragalge', 'altaria', 'druddigon', 'kingdra', 'goodra', 'noivern'], '드래곤과 함께 춤추자.'),
	T('diantha', '카르네', '칼로스 챔피언', '칼로스', 'champion', ['hawlucha', 'tyrantrum', 'aurorus', 'gourgeist', 'goodra', 'gardevoir'], '멋진 승부를 기대할게요.'),
	// ── 알로라 ──
	T('hala', '할라', '알로라 섬의 왕 · 격투', '알로라', 'leader', ['hariyama', 'annihilape', 'bewear', 'poliwrath', 'crabominable', 'machamp'], '섬의 왕 하라, 받아 주마!'),
	T('olivia', '라이치', '알로라 섬의 여왕 · 바위', '알로라', 'leader', ['probopass', 'gigalith', 'relicanth', 'carbink', 'golem', 'lycanroc'], '바위처럼 단단한 마음으로!'),
	T('nanu', '나누', '알로라 섬의 왕 · 악', '알로라', 'leader', ['sableye', 'krookodile', 'honchkrow', 'absol', 'persianalola', 'incineroar'], '…귀찮지만 상대해 주지.'),
	T('hapu', '하푸우', '알로라 섬의 여왕 · 땅', '알로라', 'leader', ['dugtrioalola', 'gastrodon', 'flygon', 'hippowdon', 'palossand', 'mudsdale'], '땅의 힘을 보여줄게!'),
	T('molayne', '멀레인', '알로라 사천왕 · 강철', '알로라', 'elite', ['klefki', 'kingambit', 'magnezone', 'metagross', 'bronzong', 'dugtrioalola'], '강철의 수호자다.'),
	T('acerola', '아세로라', '알로라 사천왕 · 고스트', '알로라', 'elite', ['banette', 'drifblim', 'froslass', 'dhelmise', 'mimikyu', 'palossand'], '유령 친구들과 함께 놀자~!'),
	T('kahili', '카일리', '알로라 사천왕 · 비행', '알로라', 'elite', ['braviary', 'oricorio', 'mandibuzz', 'crobat', 'hawlucha', 'toucannon'], '바람을 타고 간다!'),
	T('kukui', '쿠쿠이', '알로라 챔피언 방어전', '알로라', 'champion', ['lycanroc', 'ninetalesalola', 'braviary', 'magnezone', 'snorlax', 'incineroar'], '승부의 열기, 느껴 보자고!'),
	T('hau', '하우', '알로라 챔피언', '알로라', 'champion', ['raichualola', 'tauros', 'crabominable', 'noivern', 'flareon', 'decidueye'], '즐겁게 승부하자!'),
	// ── 가라르 ──
	T('milo', '아킬', '가라르 체육관 관장 · 풀', '가라르', 'leader', ['meowscarada', 'eldegoss', 'tsareena', 'appletun', 'flapple', 'rillaboom'], '느긋하게, 하지만 확실하게!'),
	T('nessa', '야청', '가라르 체육관 관장 · 물', '가라르', 'leader', ['golisopod', 'pelipper', 'barraskewda', 'seaking', 'toxapex', 'drednaw'], '파도처럼 밀어붙일게!'),
	T('kabu', '순무', '가라르 체육관 관장 · 불꽃', '가라르', 'leader', ['ninetales', 'arcanine', 'torkoal', 'coalossal', 'salazzle', 'centiskorch'], '불타는 투지로!'),
	T('bea', '채두', '가라르 체육관 관장 · 격투', '가라르', 'leader', ['hitmontop', 'pangoro', 'sirfetchd', 'falinks', 'grapploct', 'machamp'], '흔들리지 않는 마음으로.'),
	T('allister', '어니언', '가라르 체육관 관장 · 고스트', '가라르', 'leader', ['mimikyu', 'cursola', 'polteageist', 'dusknoir', 'runerigus', 'gengar'], '…가면 뒤에서, 승부.'),
	T('opal', '포플러', '가라르 체육관 관장 · 페어리', '가라르', 'leader', ['weezinggalar', 'mawile', 'togekiss', 'hatterene', 'grimmsnarl', 'alcremie'], '핑크빛 승부의 시간이란다.'),
	T('gordie', '마쿠와', '가라르 체육관 관장 · 바위', '가라르', 'leader', ['barbaracle', 'shuckle', 'stonjourner', 'tyranitar', 'gigalith', 'coalossal'], '바위의 광채를 보여주지!'),
	T('melony', '멜론', '가라르 체육관 관장 · 얼음', '가라르', 'leader', ['frosmoth', 'darmanitangalar', 'eiscue', 'glaceon', 'froslass', 'lapras'], '차갑지만 따뜻한 승부를.'),
	T('piers', '두송', '가라르 체육관 관장 · 악', '가라르', 'leader', ['scrafty', 'malamar', 'skuntank', 'toxicroak', 'grimmsnarl', 'obstagoon'], '…락은 멈추지 않아.'),
	T('raihan', '금랑', '가라르 체육관 관장 · 드래곤', '가라르', 'leader', ['gigalith', 'flygon', 'sandaconda', 'turtonator', 'goodra', 'archaludon'], '날씨까지 내 편이다!'),
	T('leon', '단델', '가라르 챔피언', '가라르', 'champion', ['aegislash', 'dragapult', 'haxorus', 'seismitoad', 'rillaboom', 'charizard'], '챔피언 타임이다!'),
	// ── 팔데아 ──
	T('katy', '단풍', '팔데아 체육관 관장 · 벌레', '팔데아', 'leader', ['vivillon', 'heracross', 'scizor', 'lokix', 'spidops', 'ursaluna'], '달콤한 승부, 시작할게요!'),
	T('brassius', '콜사', '팔데아 체육관 관장 · 풀', '팔데아', 'leader', ['breloom', 'tsareena', 'arboliva', 'toedscruel', 'brambleghast', 'sudowoodo'], '예술은… 폭발이다!'),
	T('iono', '모야모', '팔데아 체육관 관장 · 전기', '팔데아', 'leader', ['eelektross', 'kilowattrel', 'luxray', 'electrode', 'mismagius', 'bellibolt'], '채널 구독, 좋아요 부탁해~!'),
	T('kofu', '곤포', '팔데아 체육관 관장 · 물', '팔데아', 'leader', ['veluza', 'wugtrio', 'clawitzer', 'pelipper', 'quaquaval', 'crabominable'], '신선한 승부 한 접시!'),
	T('larry', '청목', '팔데아 체육관 관장 · 노말', '팔데아', 'leader', ['komala', 'dudunsparce', 'oinkologne', 'braviary', 'altaria', 'staraptor'], '…평범하게 하겠습니다.'),
	T('ryme', '라임', '팔데아 체육관 관장 · 고스트', '팔데아', 'leader', ['banette', 'mimikyu', 'houndstone', 'annihilape', 'skeledirge', 'toxtricity'], '비트에 맞춰 승부다, 요!'),
	T('tulip', '리파', '팔데아 체육관 관장 · 에스퍼', '팔데아', 'leader', ['farigiraf', 'gardevoir', 'espathra', 'florges', 'armarouge', 'oranguru'], '아름다움은 힘이야.'),
	T('grusha', '그루샤', '팔데아 체육관 관장 · 얼음', '팔데아', 'leader', ['frosmoth', 'beartic', 'cetitan', 'weavile', 'glalie', 'altaria'], '…차갑게 끝내 주지.'),
	T('rika', '칠리', '팔데아 사천왕 · 땅', '팔데아', 'elite', ['whiscash', 'camerupt', 'donphan', 'dugtrio', 'hippowdon', 'clodsire'], '자, 면접 시작할까?'),
	T('poppy', '뽀삐', '팔데아 사천왕 · 강철', '팔데아', 'elite', ['copperajah', 'magnezone', 'bronzong', 'corviknight', 'kingambit', 'tinkaton'], '포피, 열심히 할게요!'),
	T('hassel', '팔자크', '팔데아 사천왕 · 드래곤', '팔데아', 'elite', ['noivern', 'dragalge', 'haxorus', 'flapple', 'garchomp', 'baxcalibur'], '드래곤의 예술을 보여주마!'),
	T('geeta', '테사', '팔데아 톱 챔피언', '팔데아', 'champion', ['espathra', 'avalugg', 'kingambit', 'veluza', 'gogoat', 'glimmora'], '전력으로, 승부하죠.'),
	T('crispin', '하솔', '블루베리 사천왕 · 불꽃', '팔데아', 'elite', ['talonflame', 'magmortar', 'camerupt', 'exeggutoralola', 'blaziken', 'arcanine'], '불타오르는 승부다!'),
	T('amarys', '네리네', '블루베리 사천왕 · 강철', '팔데아', 'elite', ['skarmory', 'empoleon', 'scizor', 'reuniclus', 'metagross', 'corviknight'], '…분석을 시작합니다.'),
	T('lacey', '타로', '블루베리 사천왕 · 페어리', '팔데아', 'elite', ['excadrill', 'primarina', 'whimsicott', 'alcremie', 'granbull', 'tinkaton'], '귀엽고 강하게, 가볼까?'),
	T('drayton', '제빈', '블루베리 사천왕 · 드래곤', '팔데아', 'elite', ['dragonite', 'haxorus', 'flygon', 'sceptile', 'kingdra', 'archaludon'], '드래곤 특기지. 가볍게 가자고.'),
	T('kieran', '카지', '블루베리 전 챔피언', '팔데아', 'champion', ['grimmsnarl', 'ursalunabloodmoon', 'incineroar', 'dragonite', 'porygonz', 'hydrapple'], '…이번엔 절대 안 져.'),
];

/** 관장·사천왕·챔피언 + 주인공·라이벌·악의 조직 (대사는 trainer-lore.ts 의 로어 대사 우선) */
export const NAMED: NamedTrainer[] = [
	...BASE_NAMED.map(t => ({ ...t, line: NAMED_LORE[t.id]?.line || t.line })),
	...EXTRA_NAMED.map(e => ({ id: e.id, name: e.name, title: e.title, region: e.region as NamedTrainer['region'], role: e.role,
		team: e.team, ace: e.team[e.team.length - 1], line: e.line })),
];
const EXTRA_SPRITE: { [id: string]: string } = Object.fromEntries(EXTRA_NAMED.map(e => [e.id, e.sprite]));
/** 배틀 메시지에 붙는 호칭 (관장·사천왕·챔피언, 그 밖은 '로켓단 보스' 같은 직함) */
export function namedTitle(t: NamedTrainer) {
	// 레전즈 Z-A 인물·추가 인물은 직함 그대로 (예: 'ZA로열 F랭크 승급전')
	if (t.region === '미르시티') return t.title.split(' · ')[0];
	if (EXTRA_SPRITE[t.id] !== undefined) return t.title;
	return ['leader', 'elite', 'champion'].includes(t.role) ? ROLE_KO[t.role] : t.title;
}
export const REGIONS: NamedTrainer['region'][] = ['관동', '성도', '호연', '신오', '하나', '칼로스', '알로라', '가라르', '팔데아', '미르시티', '애니메이션'];
/** 지방별 색 (선택 화면 왼쪽 띠) */
export const REGION_COLOR: { [r: string]: string } = { 관동: '#d04a3a', 성도: '#c89a2a', 호연: '#2a8ad0', 신오: '#6a5ac8', 하나: '#5a6a7a', 칼로스: '#2a7ab8', 알로라: '#e07a2a', 가라르: '#a83a6a', 팔데아: '#c84a8a', 미르시티: '#3aa88a', 애니메이션: '#e8b020' };
/** 지역 이름 표시 ('미르시티'는 레전즈 Z-A 의 도시라 '지방'을 붙이지 않음) */
export const regionLabel = (r: string) => r === '미르시티' ? '미르시티 (레전즈 Z-A)' : r === '애니메이션' ? '애니메이션 오리지널' : `${r} 지방`;
export const ROLE_KO: { [role: string]: string } = { leader: '체육관 관장', elite: '사천왕', champion: '챔피언', hero: '주인공', rival: '라이벌', admin: '간부', boss: '보스' };

// ── 일반 트레이너 ──
// 트레이너 종류 117가지: 나무위키(namu.moe) 의 한국어판 공식 명칭, Showdown 트레이너 그림, 종류마다 다른 대사 (src/gen/trainer-classes.json)
import TC from './gen/trainer-classes.json';
export interface TrainerClass { name: string; types: string[]; gender: 'm' | 'f' | 'both'; sprites_m: string[]; sprites_f: string[]; pair?: boolean;
	lines: { intro: string[]; ace: string[]; lose: string[]; win: string[] } }
export const CLASSES: TrainerClass[] = (TC as any).classes;
const NAMES_M: string[] = (TC as any).names_m;
const NAMES_F: string[] = (TC as any).names_f;

/** 랭크 매치 등급에 어울리는 트레이너군: 슈퍼볼급부터 어린이 트레이너군은 빠지고, 마스터볼급·챔피언급은 실력자 트레이너군만 */
const KID_CLASSES = new Set(['반바지 꼬마', '짧은 치마', '보육원아', '아기씨', '도련님', '학원 끝난 아이', '튜브보이', '튜브걸', '포켓몬놀이', '닌자놀이',
	'곤충채집소년', '캠프보이', '피크닉걸', '스쿨보이', '스쿨걸', '메르헨소녀']);
const EXPERT_CLASSES = new Set(['엘리트 트레이너', '베테랑 트레이너', '드래곤 조련사', '포켓몬 레인저', '배틀걸', '태권왕', '초능력자', '포켓몬 브리더', '스카이 트레이너',
	'마스터', '달인', '수행자', '연구원', '신사', '마담', '아가씨', '맹수 조련사', '트라이애슬리트', '무서운 아저씨', '무서운 아가씨', '주술사', '무당', '파일럿', '모델']);
export type TrainerLevel = 'any' | 'grown' | 'expert';
export function randomTrainer(level: TrainerLevel = 'any') {
	const pool = level === 'expert' ? CLASSES.filter(c => EXPERT_CLASSES.has(c.name)) : level === 'grown' ? CLASSES.filter(c => !KID_CLASSES.has(c.name)) : CLASSES;
	const c = rng.pick(pool.length ? pool : CLASSES);
	const female = c.gender === 'f' || (c.gender === 'both' && Math.random() < 0.5);
	const sprites = (female ? c.sprites_f : c.sprites_m).length ? (female ? c.sprites_f : c.sprites_m) : [...c.sprites_m, ...c.sprites_f];
	// 그림의 첫 번째(4세대풍)가 자주 나오고, 다른 세대 그림도 가끔
	const sprite = Math.random() < 0.6 ? sprites[0] : rng.pick(sprites);
	const name = c.pair ? `${rng.pick(NAMES_M)}·${rng.pick(NAMES_F)}` : rng.pick(female ? NAMES_F : NAMES_M);
	const lines = { intro: rng.pick(c.lines.intro), ace: rng.pick(c.lines.ace), lose: rng.pick(c.lines.lose), win: rng.pick(c.lines.win) };
	return { className: c.name, name, female, types: c.types.length ? c.types : undefined, sprite, lines };
}

export function namedSprite(t: NamedTrainer) { return EXTRA_SPRITE[t.id] || NAMED_SPRITE[t.id] || t.id; }
export function namedLines(t: NamedTrainer) {
	const l = NAMED_LORE[t.id] || EXTRA_NAMED.find(e => e.id === t.id);
	if (l) return { intro: l.line || t.line || '', ace: l.ace, lose: l.lose, win: l.win };
	return { intro: t.line || '', ...(NAMED_LINES[t.id] || genericLines()) };
}

// ── PWT 대회 ──
export interface Cup { id: string; name: string; desc: string; trainers: () => string[]; rental?: boolean; open?: boolean }
const byRegionLeaders = (r: NamedTrainer['region']) => NAMED.filter(t => t.region === r && t.role === 'leader' && !t.title.includes('캡틴')).map(t => t.id);   // 알로라 캡틴은 '섬의 왕' 대회에서 뺌
export const CUPS: Cup[] = [
	{ id: 'rental', name: '렌탈 대회', desc: '대회에서 빌려주는 포켓몬으로 참가합니다. 상대는 일반 트레이너.', trainers: () => [], rental: true },
	{ id: 'open', name: '오픈 대회', desc: '내 팀으로 참가. 상대는 실력 있는 일반 트레이너.', trainers: () => [], open: true },
	{ id: 'kanto', name: '관동 리더스', desc: '관동 지방 체육관 관장들이 참가합니다.', trainers: () => byRegionLeaders('관동') },
	{ id: 'johto', name: '성도 리더스', desc: '성도 지방 체육관 관장들이 참가합니다.', trainers: () => byRegionLeaders('성도') },
	{ id: 'hoenn', name: '호연 리더스', desc: '호연 지방 체육관 관장들이 참가합니다.', trainers: () => byRegionLeaders('호연') },
	{ id: 'sinnoh', name: '신오 리더스', desc: '신오 지방 체육관 관장들이 참가합니다.', trainers: () => byRegionLeaders('신오') },
	{ id: 'unova', name: '하나 리더스', desc: '하나 지방 체육관 관장들이 참가합니다.', trainers: () => byRegionLeaders('하나') },
	{ id: 'kalos', name: '칼로스 리더스', desc: '칼로스 지방 체육관 관장들이 참가합니다.', trainers: () => byRegionLeaders('칼로스') },
	{ id: 'alola', name: '알로라 섬의 왕', desc: '알로라의 섬의 왕·여왕이 참가합니다.', trainers: () => byRegionLeaders('알로라') },
	{ id: 'galar', name: '가라르 리더스', desc: '가라르 지방 체육관 관장들이 참가합니다.', trainers: () => byRegionLeaders('가라르') },
	{ id: 'paldea', name: '팔데아 리더스', desc: '팔데아 지방 체육관 관장들이 참가합니다.', trainers: () => byRegionLeaders('팔데아') },
	{ id: 'world', name: '월드 리더스', desc: '모든 지방의 관장들 중 무작위로 참가합니다.', trainers: () => rng.shuffle(NAMED.filter(t => t.role === 'leader').map(t => t.id)) },
	{ id: 'elite', name: '사천왕 대회', desc: '각 지방의 사천왕이 모였습니다.', trainers: () => rng.shuffle(NAMED.filter(t => t.role === 'elite').map(t => t.id)) },
	{ id: 'champions', name: '챔피언스', desc: '역대 챔피언들이 모인 최강의 대회.', trainers: () => rng.shuffle(NAMED.filter(t => t.role === 'champion').map(t => t.id)) },
];

export function namedById(id: string) { return NAMED.find(t => t.id === id)!; }
