/**
 * 트레이너 스프라이트(쇼다운 스프라이트 서버, 실행 중에 불러옴)와 대사.
 * 대사는 이 앱을 위해 새로 쓴 것.
 *  ace: 마지막 포켓몬을 낼 때 / lose: 플레이어가 이겼을 때 / win: 트레이너가 이겼을 때
 */
export interface Lines { ace: string; lose: string; win: string }

export const NAMED_SPRITE: { [id: string]: string } = {
	kukui: 'kukui', hau: 'hau', kieran: 'kieran', cheren: 'cheren-gen5bw2',
	lorelei: 'lorelei-gen3', agatha: 'agatha-gen3', tateliza: 'tateandliza-gen3', phoebe: 'phoebe-gen3', drake: 'drake-gen3',
};

export const NAMED_LINES: { [id: string]: Lines } = {
	brock: { ace: '마지막까지 단단하게 버텨라!', lose: '너의 공격, 바위도 깨뜨리는구나.', win: '단단함은 끈기에서 나오는 법이지.' },
	misty: { ace: '이제부터가 진짜야, 내 에이스!', lose: '흥, 이번만 봐준 거야!', win: '물의 흐름은 막을 수 없다고!' },
	ltsurge: { ace: '이 녀석의 전기로 끝내 주마!', lose: '오우… 감전된 건 나였군!', win: '전쟁터에서 배운 승부 감각이다!' },
	erika: { ace: '꽃은 마지막에 가장 아름답게 피어요.', lose: '어머… 정말 멋진 승부였어요.', win: '조금 졸렸지만… 제가 이겼네요.' },
	koga: { ace: '닌자의 비기를 보여주마!', lose: '훌륭하다. 내 독술을 꿰뚫어 보다니.', win: '보이지 않는 독이 가장 무서운 법이다.' },
	sabrina: { ace: '이 결말도 이미 보였어.', lose: '내 예지를 넘어섰구나.', win: '처음부터 정해진 결과였어.' },
	blaine: { ace: '활활 타올라라!', lose: '불이 꺼져 버렸군! 화상 치료제가 필요하겠어!', win: '내 불꽃은 쉽게 꺼지지 않는다고!' },
	giovanni: { ace: '진정한 힘이 무엇인지 보여주지.', lose: '…훌륭하군. 인정하지.', win: '힘이 없는 자는 아무것도 지킬 수 없다.' },
	lorelei: { ace: '얼어붙을 준비는 됐니?', lose: '내 얼음이 녹아 버렸네.', win: '차가운 승부의 맛은 어땠니?' },
	bruno: { ace: '우오오! 마지막 일격이다!', lose: '단련이 부족했다… 다시 수행이다!', win: '근육은 배신하지 않는다!' },
	agatha: { ace: '진짜 공포는 지금부터란다.', lose: '흐흥, 젊은이치고 제법이구나.', win: '포켓몬은 싸우라고 있는 거란다!' },
	lance: { ace: '드래곤의 진정한 힘을 보아라!', lose: '내 드래곤들이 지다니… 너는 진짜다.', win: '드래곤 사용자의 긍지는 꺾이지 않는다.' },
	blue: { ace: '여기서부터 내 진짜 실력이다!', lose: '말도 안 돼! 내가 지다니!', win: '역시 내가 세계 최강이라고!' },
	red: { ace: '……!', lose: '……', win: '……' },
	falkner: { ace: '하늘 높이 날아올라라!', lose: '아버지께 배운 비행 포켓몬이…!', win: '비행 포켓몬을 얕보지 마!' },
	bugsy: { ace: '연구의 결정체를 보여줄게!', lose: '와, 새로운 걸 배웠어!', win: '벌레 포켓몬은 정말 대단하지?' },
	whitney: { ace: '이 아이는 진짜 세다고~!', lose: '으앙~! 너무해~!', win: '헤헤, 귀엽고 강하지?' },
	morty: { ace: '보이지 않는 힘이 너를 감싼다.', lose: '네 앞날이 조금 보이는 것 같아.', win: '안개 너머가 보이지 않았나 보군.' },
	chuck: { ace: '와하하! 이게 수행의 성과다!', lose: '크윽! 폭포 수행을 다시 해야겠군!', win: '단련된 몸과 마음의 승리다!' },
	jasmine: { ace: '…강철처럼, 꺾이지 않을게요.', lose: '정말… 강하시네요.', win: '죄송해요… 제가 이겨 버렸어요.' },
	pryce: { ace: '얼음은 세월과 함께 단단해진다.', lose: '젊음의 열기에 얼음이 녹았구나.', win: '긴 세월을 견딘 얼음은 쉽게 깨지지 않지.' },
	clair: { ace: '드래곤 사용자의 자존심을 걸겠어!', lose: '…인정할 수밖에 없겠네.', win: '드래곤의 힘을 이제 알겠어?' },
	will: { ace: '이 공격, 예측할 수 있겠나?', lose: '내 수행이 아직 부족했나.', win: '정신력의 차이였다.' },
	karen: { ace: '좋아하는 포켓몬으로 끝까지 싸울 거야.', lose: '좋은 트레이너는 좋아하는 포켓몬으로 이기려 하지.', win: '강함과 약함은 사람이 정하는 거야.' },
	roxanne: { ace: '교과서에 없는 한 수예요!', lose: '실전은 역시 공부와 다르네요.', win: '복습을 잘하고 오세요!' },
	brawly: { ace: '큰 파도처럼 덮쳐 주마!', lose: '파도에 휩쓸린 건 나였군!', win: '근성의 파도를 넘을 수 없었지?' },
	wattson: { ace: '우와하하! 찌릿찌릿 간다!', lose: '우와하하! 기분 좋게 졌구먼!', win: '전기가 짜릿했지? 우와하하!' },
	flannery: { ace: '뜨겁게, 더 뜨겁게!', lose: '아직 열정이 부족했나 봐…!', win: '이게 바로 내 열정이야!' },
	norman: { ace: '아버지로서, 전력을 다하겠다.', lose: '훌륭하다. 자랑스러운 승부였다.', win: '강해지는 길은 아직 멀다.' },
	winona: { ace: '하늘의 여왕이 날아오른다!', lose: '우아하게 졌네요.', win: '하늘과 하나가 되면 이렇게 돼요.' },
	tateliza: { ace: '우리 마음은 하나야!', lose: '둘이 함께인데도 졌어…!', win: '역시 우리 호흡이 최고야!' },
	juan: { ace: '물의 예술, 그 정점을 보여주지.', lose: '아름다운 승부였어요, 브라보!', win: '물 위의 무대는 제 차지군요.' },
	sidney: { ace: '자, 클라이맥스다!', lose: '이야, 기분 좋게 졌다!', win: '이런 승부가 제일 짜릿하지!' },
	phoebe: { ace: '저쪽 세계의 힘을 빌릴게.', lose: '네 기운, 정말 강하구나.', win: '보이지 않는 것까지 보아야 이길 수 있어.' },
	glacia: { ace: '차갑게 얼려 드릴게요.', lose: '뜨거운 마음에 녹아 버렸네요.', win: '조금 아쉬운 열기였어요.' },
	drake: { ace: '드래곤을 다룰 자격, 시험해 보마!', lose: '네게는 드래곤을 다룰 자격이 있다.', win: '아직 드래곤을 상대하기엔 이르다.' },
	steven: { ace: '내 가장 믿음직한 파트너다.', lose: '훌륭해. 너와 포켓몬의 유대가 느껴져.', win: '돌처럼 단단한 의지는 쉽게 부서지지 않아.' },
	wallace: { ace: '마지막은 가장 아름다운 포켓몬으로!', lose: '정말 아름다운 승부였어.', win: '아름다움은 강함이기도 하지.' },
	roark: { ace: '화석의 힘을 보여주마!', lose: '탄광에서 다시 단련해야겠어!', win: '단단한 바위는 깨지지 않는다고!' },
	gardenia: { ace: '이 아이가 제일 예쁘고 강해!', lose: '꽃이 시들어 버렸어…', win: '풀 포켓몬 최고지?' },
	maylene: { ace: '맨발로 끝까지 버틸게요!', lose: '더 수행해야겠어요…!', win: '열심히 한 보람이 있네요!' },
	crasherwake: { ace: '거친 파도의 마스크맨이다!', lose: '파도가 잠잠해졌군!', win: '파도에 휩쓸렸지? 와하하!' },
	fantina: { ace: '마지막 무대, 아름답게!', lose: '당신, 정말 강하네요!', win: '제 포켓몬, 아름답죠?' },
	byron: { ace: '강철의 방어를 뚫어 보아라!', lose: '내 강철이 뚫리다니!', win: '강철은 쉽게 뚫리지 않는다!' },
	candice: { ace: '집중! 마지막까지 집중!', lose: '집중력이 흐트러졌나 봐!', win: '집중의 승리야!' },
	volkner: { ace: '이제야 좀 짜릿해지는군.', lose: '오랜만에 감전된 기분이야. 고마워.', win: '…좀 더 강한 상대를 기다리고 있어.' },
	aaron: { ace: '벌레 포켓몬의 진짜 힘이다!', lose: '벌레 포켓몬은 아직 강해질 수 있어.', win: '벌레라고 얕보면 안 되지!' },
	bertha: { ace: '할머니의 비장의 수란다.', lose: '오호호, 기분 좋은 패배구나.', win: '땅은 흔들리지 않는 법이란다.' },
	flint: { ace: '불타올라라, 내 영혼!', lose: '내 불꽃보다 뜨거웠어!', win: '이게 바로 타오르는 승부다!' },
	lucian: { ace: '이야기의 클라이맥스다.', lose: '좋은 결말이었다.', win: '이 이야기의 결말은 내가 정했다.' },
	cynthia: { ace: '내 마지막 포켓몬, 나의 에이스야.', lose: '…훌륭해. 너와 포켓몬, 정말 강하구나.', win: '아직 너에겐 보지 못한 세계가 있어.' },
	cheren: { ace: '강함의 의미, 이걸로 확인하자!', lose: '이게 네가 찾은 강함이구나.', win: '강함에는 이유가 있어.' },
	lenora: { ace: '연구 성과의 결정판이야!', lose: '흥미로운 결과야, 기록해 둬야겠어.', win: '데이터대로야!' },
	burgh: { ace: '나의 걸작을 감상해 줘!', lose: '영감이 떠올랐어! 고마워!', win: '예술은 승리로 완성되지!' },
	elesa: { ace: '가장 눈부신 순간이야!', lose: '오늘은 당신이 더 빛났어.', win: '반짝반짝, 내가 주인공이야!' },
	clay: { ace: '땅 속 깊은 힘을 보여주지!', lose: '이거 한 방 먹었구먼!', win: '광부의 근성이다!' },
	skyla: { ace: '하늘 끝까지 날아가자!', lose: '추락해 버렸네! 그래도 즐거웠어!', win: '하늘을 나는 기분 최고지?' },
	brycen: { ace: '얼음처럼 냉정한 일격을!', lose: '뜨거운 열정이구나… 훌륭하다.', win: '냉정함을 잃은 쪽이 지는 법.' },
	drayden: { ace: '용의 긍지, 마지막까지!', lose: '너의 강함, 확실히 보았다.', win: '수행이 더 필요하겠군.' },
	alder: { ace: '이 녀석과 함께라면 질 수 없지!', lose: '하하! 즐거운 승부였어!', win: '포켓몬과 함께하는 시간을 즐겨!' },
	iris: { ace: '드래곤 포켓몬, 힘을 빌려줘!', lose: '우와~ 너 정말 강하다!', win: '헤헤, 내가 챔피언이라고!' },
	viola: { ace: '결정적 순간을 찍어 줄게!', lose: '최고의 한 장이 나왔어!', win: '초점이 흐릿했나 보네!' },
	grant: { ace: '정상은 바로 저기다!', lose: '네가 먼저 정상에 올랐구나.', win: '더 단련하고 다시 오르렴.' },
	korrina: { ace: '파동의 힘, 지금이야!', lose: '아, 분해! 하지만 멋졌어!', win: '내 롤러를 따라올 순 없지!' },
	ramos: { ace: '마지막 씨앗을 심어 볼까.', lose: '허허, 잘 자랐구나.', win: '아직 덜 자랐군.' },
	clemont: { ace: '마지막 발명품 가동!', lose: '계산이 틀렸군! 흥미로워!', win: '과학의 승리다!' },
	valerie: { ace: '요정의 마지막 춤이에요.', lose: '꿈에서 깬 기분이에요.', win: '요정의 숲에서는 길을 잃기 쉽죠.' },
	olympia: { ace: '별이 가리키는 마지막 수.', lose: '별은 너의 편이었구나.', win: '운명은 바꿀 수 없다.' },
	wulfric: { ace: '빙산의 일각이었다!', lose: '내 얼음이 녹았군! 좋은 승부였다!', win: '얼음의 두께를 알겠나!' },
	malva: { ace: '뉴스거리를 만들어 주지!', lose: '…특종이군. 내가 지다니.', win: '불꽃은 꺼지지 않았어.' },
	siebold: { ace: '마지막 요리, 서빙하지.', lose: '풍미가 훌륭한 승부였어.', win: '간이 덜 되었군.' },
	wikstrom: { ace: '기사의 긍지, 마지막까지!', lose: '그대의 검, 인정하겠노라.', win: '갑옷은 뚫리지 않는다!' },
	drasna: { ace: '드래곤의 춤, 피날레!', lose: '어머, 멋진 춤이었어요.', win: '드래곤의 숨결이 닿았네요.' },
	diantha: { ace: '마지막 장면, 시작할게요.', lose: '컷! 완벽한 연기였어요.', win: '주연은 양보 못 하죠.' },
	hala: { ace: '섬의 왕의 마지막 주먹!', lose: '하하! 훌륭하다, 젊은이!', win: '멜레멜레의 바람은 강하다!' },
	olivia: { ace: '보석 같은 마지막 한 수!', lose: '빛나는 승부였어!', win: '바위는 흔들리지 않아.' },
	nanu: { ace: '…어쩔 수 없군. 전력이다.', lose: '…흠. 수고했다.', win: '…이제 좀 쉬어도 되나.' },
	hapu: { ace: '포니섬의 힘을 모아서!', lose: '훌륭한 트레이너입니다!', win: '땅의 축복이 함께했습니다.' },
	molayne: { ace: '강철처럼 마지막까지.', lose: '…데이터를 갱신해야겠군.', win: '강철의 벽이었지.' },
	acerola: { ace: '유령 친구들, 마지막이야~!', lose: '으와, 졌다~ 하지만 재밌었어!', win: '유령은 지지 않아~!' },
	kahili: { ace: '마지막 샷, 홀인원!', lose: '…버디였군. 축하해.', win: '바람을 읽는 법을 배워 봐.' },
	kukui: { ace: '마지막까지 열기를 보여줘!', lose: '예~! 최고의 승부였어!', win: '아직 열기가 식지 않았어!' },
	hau: { ace: '말라사다 먹고 힘내자!', lose: '와~ 졌다! 그래도 즐거웠어!', win: '헤헤, 내가 이겼다!' },
	milo: { ace: '마지막까지 느긋하게!', lose: '잘 자란 승부였어!', win: '수확은 내 몫이야!' },
	nessa: { ace: '마지막 파도다!', lose: '…완패네. 인정할게.', win: '파도에 휩쓸렸지?' },
	kabu: { ace: '투지를 불태워라!', lose: '패배도 단련의 일부다.', win: '아직 불길은 꺼지지 않았다.' },
	bea: { ace: '…흔들리지 않는다.', lose: '…완벽한 승리였다.', win: '마음이 흔들렸군.' },
	allister: { ace: '…마지막, 유령.', lose: '…졌어… 하지만 즐거웠어.', win: '…가면은 벗지 않아.' },
	opal: { ace: '마지막 핑크, 가볼까!', lose: '호호, 합격이란다.', win: '아직 핑크가 부족하구나.' },
	gordie: { ace: '보석의 마지막 광채!', lose: '…빛나는 승부였다.', win: '바위의 광채에 눈이 멀었나?' },
	melony: { ace: '얼음의 마지막 결정!', lose: '따뜻한 승부였어요.', win: '차가웠나요?' },
	piers: { ace: '마지막 곡, 간다!', lose: '…앙코르는 없어.', win: '락은 죽지 않아.' },
	raihan: { ace: '셀카 찍을 시간이다!', lose: '…이건 SNS에 못 올리겠군.', win: '좋아요 폭발이다!' },
	leon: { ace: '챔피언 타임, 마지막!', lose: '…완벽한 승부였어! 네가 새 챔피언이야!', win: '챔피언 타임은 끝나지 않아!' },
	katy: { ace: '마지막 디저트예요!', lose: '달콤한 패배네요.', win: '달콤했나요?' },
	brassius: { ace: '마지막 작품, 완성!', lose: '…걸작이었다.', win: '예술은 폭발했다!' },
	iono: { ace: '마지막 생방송이야~!', lose: '으앙~ 졌어! 하지만 시청률 대박!', win: '구독과 좋아요~!' },
	kofu: { ace: '마지막 한 접시!', lose: '신선한 승부였어!', win: '맛있게 먹었지?' },
	larry: { ace: '…야근이군요.', lose: '…퇴근하겠습니다.', win: '…평범함의 승리입니다.' },
	ryme: { ace: '마지막 랩, 요!', lose: '…비트가 멈췄어, 요.', win: '리듬을 못 탔군, 요!' },
	tulip: { ace: '마지막 메이크업!', lose: '…아름다운 승부였어.', win: '아름다움의 승리야.' },
	grusha: { ace: '…차갑게, 마지막.', lose: '…녹아 버렸군.', win: '…얼어붙었나.' },
	rika: { ace: '마지막 면접 질문이야.', lose: '…합격. 축하해.', win: '불합격. 다시 와.' },
	poppy: { ace: '포피의 마지막!', lose: '우와~ 포피가 졌다!', win: '포피가 이겼다!' },
	hassel: { ace: '드래곤의 마지막 춤!', lose: '…감동이다!', win: '예술적인 승리였다!' },
	geeta: { ace: '마지막까지 전력으로.', lose: '…훌륭한 승부였습니다.', win: '톱 챔피언의 자리는 무겁습니다.' },
	roxie: { ace: '마지막 곡, 풀 볼륨으로!', lose: '…앙코르 없음! 너의 승리야!', win: '독한 맛 좀 봤지?' },
	marlon: { ace: '깊은 바다의 힘을!', lose: '바다처럼 넓은 승부였어!', win: '파도 타기 실력이 부족했군!' },
	shauntal: { ace: '이야기의 마지막 장이에요.', lose: '…소설 소재로 쓰고 싶어요!', win: '결말은 제 승리로.' },
	grimsley: { ace: '마지막 베팅이다.', lose: '…오늘은 운이 없었군.', win: '도박의 승리다.' },
	caitlin: { ace: '마지막까지 우아하게.', lose: '…훌륭한 승부였어요.', win: '잠이 오네요… 제 승리네요.' },
	marshal: { ace: '마지막 일격, 받아라!', lose: '내 수행이 부족했다!', win: '단련된 몸은 거짓말하지 않는다!' },
	crispin: { ace: '불꽃 최고조다!', lose: '…완전히 타 버렸어! 대단해!', win: '불꽃의 승리다!' },
	amarys: { ace: '…최종 단계입니다.', lose: '…예측 실패. 훌륭합니다.', win: '…예측대로입니다.' },
	lacey: { ace: '마지막은 제일 귀여운 아이로!', lose: '우와~ 졌다! 재밌었어!', win: '귀여움의 승리~!' },
	drayton: { ace: '…어쩔 수 없지, 진심이다.', lose: '…귀찮게 됐네. 네가 더 강해.', win: '편하게 이겼군.' },
	kieran: { ace: '…절대 안 져. 마지막이야.', lose: '…또 졌어. 하지만… 고마워.', win: '…이번엔 내가 이겼어.' },
};

const GENERIC: { intro: string[]; ace: string[]; lose: string[]; win: string[] } = {
	intro: ['내 포켓몬의 실력을 보여줄게!', '눈이 마주쳤으니 승부다!', '여기까지 온 걸 보니 강하겠군. 승부다!', '좋은 승부를 하자!',
		'이번엔 지지 않을 거야!', '준비는 됐어? 간다!', '연승은 여기서 끝이야!', '내 전략을 깰 수 있을까?'],
	ace: ['마지막 남은 내 비장의 카드다!', '아직 끝나지 않았어!', '여기서부터 역전이야!', '이 녀석만은 질 수 없어!'],
	lose: ['졌다… 너 정말 강하구나.', '으윽, 분하다!', '좋은 승부였어. 다음엔 이길 거야.', '내 전략이 통하지 않다니!', '역시 대단해!'],
	win: ['내 승리야!', '이번엔 내가 한 수 위였네.', '다음에 다시 도전해!', '연승 기록은 여기까지야!'],
};
export function genericLines() {
	const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
	return { intro: pick(GENERIC.intro), ace: pick(GENERIC.ace), lose: pick(GENERIC.lose), win: pick(GENERIC.win) };
}

/** 트레이너 그림: 앱 안에 들어 있음 (scripts/fetch-sprites.sh) */
import { partBase } from './offline';
export const SPRITE_URL = (id: string) => partBase('sprites') ? `${partBase('sprites')}trainers/${id}.png` : `https://play.pokemonshowdown.com/sprites/trainers/${id}.png`;
/** 앱 안에 그림이 없으면 서버에서, 그래도 없으면 숨김 */
export function trainerImgError(e: Event) {
	const img = e.target as HTMLImageElement;
	const m = /sprites\/trainers\/([^/]+\.png)$/.exec(img.getAttribute('src') || '');
	if (m && !img.src.startsWith('https:')) img.src = `https://play.pokemonshowdown.com/sprites/trainers/${m[1]}`;
	else img.style.display = 'none';
}
export const PLAYER_SPRITES = [
	{ id: 'red', name: '레드' }, { id: 'leaf-gen3', name: '리프' }, { id: 'ethan', name: '심향' }, { id: 'lyra', name: '금선' }, { id: 'kris', name: '크리스' },
	{ id: 'brendan', name: '휘웅' }, { id: 'may', name: '봄이' }, { id: 'lucas', name: '광휘' }, { id: 'dawn', name: '빛나' },
	{ id: 'hilbert', name: '투지' }, { id: 'hilda', name: '투희' }, { id: 'nate', name: '공명' }, { id: 'rosa', name: '명희' },
	{ id: 'calem', name: '칼름' }, { id: 'serena', name: '세레나' }, { id: 'elio', name: '영태' }, { id: 'selene', name: '미월' },
	{ id: 'victor', name: '승재' }, { id: 'gloria', name: '우리' }, { id: 'florian-s', name: '보민' }, { id: 'juliana-s', name: '푸름' },
];
