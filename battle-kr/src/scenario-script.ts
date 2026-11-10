/** 시나리오 대본 (데이터) — Ren'Py·Dialogic 처럼 이야기를 화면 코드와 떼어 둠. 읽는 쪽은 scenario.tsx 의 play()
 *
 *  한 줄 = 명령 하나:
 *   - 글:  '인물[감정]: 대사'  (인물 = scenario-data.ts 의 WHO id, 감정은 없어도 됨)  ·  ': 해설'  (인물 없음)
 *          감정: joy 기쁨 · angry 화남 · shy 부끄러움 · sad 시무룩 · surprise 놀람 · love 두근 · think 생각 · smug 자신만만
 *          (표정 그림 <초상 id>_<감정>.png 가 portraits 에 있으면 그 그림으로 바뀌고, 없으면 기본 그림 + 감정 기호·움직임)
 *          {me} = 주인공 이름 · {starter} = 처음 포켓몬 이름
 *   - { bg }      이 뒤의 대화 배경 (null = 지금 있는 곳)
 *   - { card }    제목 카드 [작은 글, 제목, 아랫줄, 배경]
 *   - { fight }   배틀. 지면 lose 대사를 하고 대본이 거기서 끝남(다음에 처음부터 다시). tag = 이슬과 멀티배틀
 *   - { got } 물건 얻기 · { pay } 돈 · { heart } 호감도 · { flag } 표식 · { badge } 배지 · { toast } 알림 · { music } 음악 */
export type Team = [string, number][];
export type Cmd = string
	| { bg: string | null }
	| { card: [small: string, title: string, sub: string, bg?: string] }
	| { fight: { name: string; title?: string; sprite: string; sprite2?: string; team: Team; skill: number; tag?: boolean; music?: string; arena?: string }; win: string; money: number; lose: string }
	| { got: string; n?: number } | { pay: number; sub: string } | { heart: number } | { flag: string } | { toast: string } | { music: string }
	| { badge: string; icon: string; flag: string; sub: string };

export const SCRIPTS: { [id: string]: Cmd[] } = {
	// ───────── 프롤로그 ─────────
	pro1: [
		{ music: 'g3star' }, { bg: 'black' },
		': 포켓몬스터— 줄여서 포켓몬.',
		': 이 세계 곳곳에는 포켓몬이라 불리는 신비한 생명체가 살고 있다.',
		': 사람은 포켓몬과 함께 놀고, 함께 일하고, 때로는 힘을 합쳐 승부를 겨루며 살아간다.',
		': 그리고 오늘—\n태초마을의 {me}, 여행을 떠나는 날.',
		{ card: ['PROLOGUE', '관동 편', '새하얀 시작의 색'] },
		{ music: 'lobby' }, { bg: 'lab' },
		'oak[joy]: 오오, {me}! 기다리고 있었단다.',
		'oak: 나는 오박사. 사람들은 나를 포켓몬 박사라고 부르지.',
		'oak: 오늘부터 너도 포켓몬 트레이너란다. 저 탁자 위 몬스터볼 가운데 함께 여행할 한 마리를 고르렴!',
	],
	pro2: [
		{ bg: 'lab' },
		'oak[joy]: {starter}(이)구나! 아주 씩씩한 녀석이란다. 잘 돌봐 주렴.',
		'rival[angry]: 할아버지! 나는?! 기다리다 지쳤다고!',
		'oak: 그린이냐. 서두르지 말고 너도 하나 고르렴.',
		'rival[smug]: 그럼 난 이 녀석! …이봐 {me}, 모처럼 받았는데 그냥 갈 순 없지. 누구 포켓몬이 더 센지 지금 겨뤄 보자고!',
	],
	proWin: [{ bg: 'lab' }, 'rival[angry]: 칫…! 뭐, 처음이니까 봐준 거야!'],
	proLose: [{ bg: 'lab' }, 'rival[smug]: 하핫! 역시 내가 고른 포켓몬이 최고라니까!'],
	pro3: [
		{ bg: 'lab' },
		'rival[smug]: 난 먼저 간다. 관동의 체육관 배지, 내가 전부 먼저 모을 테니까! 스멜 유 레이터!',
		'oak: 허허, 성미도 급하지. 자, 이건 내 선물이란다.',
		{ got: 'pokeball', n: 5 },
		{ pay: 3000, sub: '엄마가 챙겨 주신 용돈' },
		'oak: 풀숲에서 야생 포켓몬을 이긴 뒤 그 볼을 던지면 동료로 맞이할 수 있단다.',
		'oak: 관동에는 여덟 개의 체육관이 있지. 가까운 곳은 북쪽 회색시티의 웅, 그리고 달맞이산 너머 블루시티의 이슬이란다.',
		'oak[joy]: 어디로 가든 네 마음이란다. 포켓몬과 함께 너만의 이야기를 만들어 보렴!',
		{ flag: 'intro' },
	],

	// ───────── 웅 (회색 체육관) ─────────
	brock: [
		'brock: 나는 회색 체육관 관장 웅!',
		'brock[smug]: 내 바위처럼 단단한 의지는 포켓몬에게도 깃들어 있다. 바위 타입의 굳건함을 보여 주마!',
		{ fight: { name: '웅', title: '회색 체육관 관장', sprite: 'brock', team: [['geodude', 12], ['onix', 14]], skill: 0.55, arena: 'gym', music: 'boss' }, win: '관장 웅에게 이겼다!', money: 1400,
			lose: 'brock: 바위는 쉽게 부서지지 않는다. 더 단련하고 다시 오너라!' },
		'brock[surprise]: 너를 얕봤던 것 같군. 내 패배다. 포켓몬리그 공인 회색배지를 받아라!',
		{ badge: '회색배지', icon: 'badge1', flag: 'badge1', sub: '레벨 상한이 올랐다 · 달맞이산을 지날 수 있다' },
		{ got: 'hardstone' },
		'brock: 동쪽 달맞이산을 넘으면 블루시티다. 그곳 관장 이슬은… 성격은 불같지만 실력은 진짜지. 조심해라.',
	],

	// ───────── 이슬: 만남 · 체육관 ─────────
	meet: [
		{ card: ['CHAPTER · 만남', '블루시티', '물빛 신비의 색', 'cerulean'] },
		': 수로를 따라 걷는데, 물속에서 무언가가 솟구쳐 올랐다.',
		'misty[joy]: 푸핫—! 역시 아침 수영은 최고야!',
		'misty[surprise]: …어? 거기 너. 처음 보는 얼굴인데. 혹시 체육관 도전자야?',
		'misty[smug]: 난 이슬. 이 블루 체육관의 관장이야. 물 포켓몬이라면 누구에게도 지지 않아!',
		'misty[angry]: 말괄량이 인어라고 들어 봤지? …안 들어 봤다고? 흥, 그럼 오늘 똑똑히 기억하고 가!',
		'misty: 체육관은 저기 물빛 지붕 건물이야. 내 제자들을 이기고 풀장 끝까지 오면, 내가 직접 상대해 줄게!',
		{ flag: 'met' },
	],
	gym: [
		{ bg: 'pool' },
		'misty[joy]: 여기까지 왔구나! 제자들을 둘이나 이기다니, 제법인데?',
		'misty: 넌 포켓몬을 키울 때 어떤 방침이 있어? 내 방침은— 물 타입으로 밀고, 밀고, 또 미는 거야!',
		'misty[smug]: 자, 간다! 블루 체육관 관장 이슬, 진심으로 상대할게!',
		{ fight: { name: '이슬', title: '블루 체육관 관장', sprite: 'misty', team: [['staryu', 18], ['starmie', 21]], skill: 0.6, arena: 'beach', music: 'boss' }, win: '관장 이슬에게 이겼다!', money: 2100,
			lose: 'misty[smug]: 후훗, 물의 흐름을 못 읽었네! 더 단련하고 다시 와. 기다릴게!' },
		'misty[surprise]: 와… 졌다. 완패야. 너, 정말 강하구나!',
		'misty: 약속대로 이걸 줄게. 포켓몬리그 공인 블루배지야!',
		{ badge: '블루배지', icon: 'badge2', flag: 'badge2', sub: '레벨 상한이 올랐다 · 가게 물건이 늘었다' },
		'misty: 있잖아. 요즘 관동에선 둘이 한 팀으로 싸우는 태그 배틀이 유행이야.',
		'misty[shy]: 너 정도 실력이면… 가끔 내 파트너로 삼아 줘도 좋아. 가, 가끔이야!',
		'misty: 난 시간마다 있는 곳이 달라. 아침엔 수영, 낮엔 체육관, 저녁엔 산책… 찾아와서 말 걸어 줘.',
		{ card: ['ROUTE OPEN', '이슬 루트', '인물 루트가 열렸다', 'cerulean'] },
		{ heart: 40 },
	],

	// ───────── 이슬: 초대 (하트가 가득 찼을 때) ─────────
	inv1: [
		'misty[joy]: 마침 잘 왔어! 부탁이 하나 있는데.',
		'misty: 블루시티 북쪽 골든볼브리지 알아? 트레이너 다섯을 연달아 이기면 상품을 준다는 다리야.',
		'misty[shy]: 올해는 둘이 한 팀으로 도전하는 태그전이래. 그러니까… 나랑 나가 줘! 골든볼브리지에서 기다릴게!',
		{ flag: 'inv1' }, { toast: '골든볼브리지에 갈 수 있게 되었다!' },
	],
	inv2: [
		'misty[think]: 있잖아, 요즘 블루시티에 수상한 사람들이 돌아다닌대.',
		'misty[angry]: 검은 옷에 빨간 R… 다리에서 본 그 녀석들 같아. 관장으로서 가만둘 수 없어.',
		'misty: 블루시티에서 같이 순찰 좀 돌아 줄래? 준비되면 시내에서 나를 찾아와!',
		{ flag: 'inv2' },
	],
	inv3: [
		'misty[shy]: 저, 저기 말이야.',
		'misty: 블루곶 알지? 25번도로 끝, 바다가 보이는 언덕. 노을이 정말 예쁘거든.',
		'misty[shy]: 저녁에… 거기로 와 줄래? 따, 딱히 별 뜻은 없어! 그냥 보여 주고 싶어서 그래!',
		{ flag: 'inv3' },
	],
	inv4: [
		'misty: …와 줬구나.',
		'misty[think]: 요즘 계속 생각했어. 너랑 다니면서 내가 뭘 하고 싶은지.',
		'misty[love]: 저녁에 블루곶으로 와. 관장이 아니라 트레이너 이슬로서— 너한테 전하고 싶은 게 있어.',
		{ flag: 'inv4' },
	],

	// ───────── 이슬: 하트 이벤트 ─────────
	ev1: [
		{ card: ['♥ 1', '골든볼브리지의 태그 승부', '이슬 루트', 'bridge'] },
		'misty[joy]: 왔구나! 봐, 다리 위에 벌써 도전자들이 줄을 섰어.',
		'misty: 규칙은 간단해. 둘이서 한 팀, 상대도 둘. 내 아쿠스타랑 네 포켓몬이 나란히 싸우는 거야.',
		'misty[smug]: 호흡이 안 맞으면 바로 물에 빠뜨릴 거니까 각오해! 가자, 파트너!',
		{ fight: { name: '곤충채집소년 케일 & 짧은치마 아리', sprite: 'bugcatcher', sprite2: 'lass', team: [['metapod', 17], ['pidgey', 17], ['kakuna', 17], ['oddish', 17]], skill: 0.4, tag: true }, win: '케일 & 아리 팀에게 이겼다!', money: 600,
			lose: 'misty[sad]: 아이참! 아직 호흡이 안 맞네. 다시 준비해서 와, 여기서 기다릴게!' },
		'misty[sad]: 으으, 벌레 포켓몬…! 내, 내 뒤로 오게 하지 마! …그래도 이겼으니 됐어. 다음!',
		{ fight: { name: '반바지 꼬마 티미 & 캠프보이 이든', sprite: 'youngster', sprite2: 'camper', team: [['sandshrew', 18], ['mankey', 18], ['ekans', 18], ['geodude', 18]], skill: 0.4, tag: true }, win: '티미 & 이든 팀에게 이겼다!', money: 600,
			lose: 'misty[sad]: 아이참! 아직 호흡이 안 맞네. 다시 준비해서 와, 여기서 기다릴게!' },
		': 다리 끝에서 정장 차림의 남자 둘이 박수를 치며 다가왔다.',
		'grunt: 축하한다! 골든볼브리지를 돌파한 너희에게 상품으로 금구슬을 주지!',
		'grunt[smug]: 그런데 말이지… 그 실력, 썩히긴 아깝군. 우리 로켓단에 들어오지 않겠나?',
		'misty[surprise]: 로켓단?! 달맞이산에서 소란 피웠다는 그 녀석들이잖아!',
		'gruntf[angry]: 거절이야? 그럼 금구슬은 못 주지. 대신 혼쭐을 내 주마!',
		{ fight: { name: '조무래기들', title: '로켓단', sprite: 'rocketgrunt', sprite2: 'rocketgruntf', team: [['ekans', 19], ['rattata', 19], ['zubat', 19], ['raticate', 20]], skill: 0.5, tag: true, music: 'evil' }, win: '로켓단을 쫓아냈다!', money: 800,
			lose: 'misty[angry]: 분해…! 저 녀석들, 그냥 둘 수 없어. 다시 도전하자!' },
		'grunt[sad]: 으윽…! 기억해 둬라! 금구슬은… 가져가!',
		'misty[smug]: 흥, 꼴좋다! 내 도시 근처에서 얼쩡거리지 말라고!',
		{ got: 'nugget' },
		'misty[think]: …있잖아. 솔직히 놀랐어. 내가 치고 나갈 때 네가 딱 받쳐 주더라.',
		'misty: 누구랑 이렇게 호흡이 맞은 건 처음이야. 관장은 늘 혼자 싸우니까.',
		'misty[shy]: 또 같이 싸워 줄 거지? …대답은 "응" 하나만 받을 거야!',
	],
	ev2: [
		{ card: ['♥ 2', '블루시티 도둑 사건', '이슬 루트', 'cerulean'] },
		'misty: 와 줬구나. 그럼 순찰을—',
		': "도, 도둑이야—!!"',
		'misty[surprise]: 방금 들었어?! 저쪽 집이야, 가자!',
		'victim[sad]: 아이고, 이슬 관장님! 누가 우리 집 벽에 구멍을 뚫고 들어와서 아끼던 기술머신을 훔쳐 갔어요!',
		'victim: 「구멍파기」 기술머신이었는데… 검은 옷 입은 놈들이 뒷마당으로 달아났어요!',
		'misty[angry]: 벽에 구멍을… 내 도시에서 감히! {me}, 뒷마당이야!',
		'grunt[surprise]: 헉, 벌써 쫓아왔어? 이 기술머신만 있으면 어디든 구멍을 파고 들어갈 수 있다고!',
		'gruntf[smug]: 관장이 직접 납셨네. 둘 다 여기서 발을 묶어 주지!',
		{ fight: { name: '조무래기들', title: '로켓단', sprite: 'rocketgrunt', sprite2: 'rocketgruntf', team: [['machop', 21], ['drowzee', 21], ['ekans', 21], ['koffing', 21]], skill: 0.55, tag: true, music: 'evil' }, win: '도둑을 붙잡았다!', money: 1000,
			lose: 'misty[angry]: 놓쳤어…! 아직 멀리 못 갔을 거야. 준비해서 다시 쫓자!' },
		'grunt[sad]: 크윽… 기술머신은 돌려주마! 도망쳐!',
		'victim[joy]: 고맙습니다, 고맙습니다! 이건 변변찮지만 사례예요.',
		{ got: 'quickclaw' },
		': 소동이 가라앉고, 둘은 수로 옆 난간에 나란히 기댔다.',
		'misty[think]: …관장이라는 건 말이야, 이 도시를 지키는 사람이기도 해.',
		'misty[sad]: 그래서 난 블루시티를 떠날 수가 없어. 도전자를 기다리고, 도시를 지키고.',
		'misty[think]: 그런데 가끔은… 너처럼 여기저기 돌아다니는 트레이너가 부러워. 세상에는 내가 못 본 물 포켓몬이 얼마나 많을까.',
		'misty[shy]: …아, 방금 건 잊어! 그보다 다음엔 블루곶에 가 보자. 길은 내가 알려 줄게.',
		{ toast: '블루곶에 갈 수 있게 되었다!' },
	],
	ev3: [
		{ card: ['♥ 3', '블루곶의 노을', '이슬 루트', 'cape'] },
		': 수평선으로 해가 내려앉고 있었다. 바다도 풀밭도 온통 주황빛이다.',
		'misty[joy]: 어때, 예쁘지? 여기가 내 비밀 장소야. …사실 연인들의 명소로 더 유명하지만.',
		'misty[shy]: 그, 그런 뜻으로 부른 건 아니야! 정말이야!',
		': 그때, 언덕 위 집에서 삐삐 한 마리가 허둥지둥 뛰어나왔다.',
		'clefairy: 거기 자네들! 마침 잘 왔네! 난 포켓몬이 아니야, 이수재라고!',
		'misty[surprise]: 삐삐가 말을 했어?!',
		'clefairy: 전송 장치 실험을 하다 포켓몬이랑 붙어 버렸지 뭔가. 내가 장치에 들어갈 테니 컴퓨터의 분리 프로그램을 눌러 주게!',
		': …시키는 대로 단추를 누르자, 장치에서 청년이 걸어 나왔다.',
		'bill[joy]: 후우, 살았네! 난 이수재. 포켓몬 맡기기 시스템을 만든 사람이지. 정말 고맙—',
		'exec[smug]: 거기까지다, 이수재. 그 맡기기 시스템의 자료, 우리 로켓단이 가져가겠다.',
		'misty[angry]: 또 너희야?! 이번엔 간부까지 납셨네!',
		'exec: 조무래기들이 신세를 졌다더군. 블루시티 관장과 꼬마 트레이너… 한꺼번에 치워 주지.',
		{ fight: { name: '간부 & 조무래기', title: '로켓단', sprite: 'ariana', sprite2: 'rocketgrunt', team: [['raticate', 24], ['machop', 23], ['golbat', 24], ['drowzee', 23], ['koffing', 24]], skill: 0.65, tag: true, music: 'evil' }, win: '로켓단 간부를 물리쳤다!', money: 1500,
			lose: 'misty[angry]: 강해…! 하지만 여기서 물러설 순 없어. 저녁에 다시 오자, 이번엔 꼭 이겨!' },
		'exec: …흥. 관장과 꼬마 주제에 제법이군. 오늘은 물러나 주지.',
		'bill[joy]: 덕분에 시스템을 지켰네! 이건 내 감사의 표시일세. 포켓몬에게 지니게 해 보게.',
		{ got: 'leftovers' },
		': 이수재가 집으로 돌아가고, 곶에는 다시 파도 소리만 남았다.',
		'misty[sad]: 정말이지, 조용히 노을 좀 보려고 했는데.',
		'misty[shy]: …그래도 네가 옆에 있어서 든든했어. 간부 앞에서도 하나도 안 무섭더라.',
		'misty[think]: 저기, {me}. 나 말이야, 꿈이 있어. 세계 제일의 물 포켓몬 트레이너가 되는 거.',
		'misty[think]: 관장 자리에 앉아서 기다리기만 해선 닿을 수 없는 꿈인데… 너를 보고 있으면 자꾸 욕심이 나.',
		'misty[shy]: …아, 해가 다 졌네. 오늘은 여기까지! 다음에… 진짜 하고 싶은 얘기를 할게.',
	],
	ev4: [
		{ card: ['♥ 4', '진심 승부', '이슬 루트 · 마지막 이야기', 'cape'] },
		': 노을 진 블루곶. 이슬은 바다를 등지고 서 있었다. 평소와는 다른, 승부에 나설 때의 눈빛으로.',
		'misty: 와 줘서 고마워, {me}.',
		'misty[think]: 체육관에서 너랑 싸웠을 때, 난 관장으로서 도전자를 시험한 거였어.',
		'misty: 하지만 지금은 달라. 너랑 같이 다리를 건너고, 도둑을 쫓고, 간부랑 맞서면서… 난 다시 도전하는 쪽이 되고 싶어졌어.',
		'misty[smug]: 그러니까 부탁이야. 관장 이슬이 아니라 트레이너 이슬로서— 내 전부를 받아 줘!',
		{ fight: { name: '이슬', title: '말괄량이 인어', sprite: 'misty', team: [['golduck', 27], ['seadra', 27], ['lapras', 28], ['starmie', 30]], skill: 0.85, music: 'champion' }, win: '이슬과의 진심 승부에서 이겼다!', money: 3000,
			lose: 'misty: …내가 이겼네. 하지만 이건 네 진심이 아니지? 다시 와. 몇 번이든 기다릴게.' },
		{ music: 'g3sunset' },
		'misty[surprise]: 하아… 하아… 졌다! 전부 쏟아부었는데, 그래도 졌어!',
		'misty[joy]: 그런데 이상하지? 하나도 분하지 않아. 오히려 가슴이 뻥 뚫린 것 같아.',
		'misty: 결심했어. 체육관은 제자들에게 잠깐 맡기고, 나도 여행을 떠날 거야. 더 넓은 바다를 보러.',
		'misty[love]: 그리고 그 여행에… 네가 있었으면 좋겠어.',
		'misty[shy]: 파, 파트너로서 말이야! 태그 파트너! …지금은, 일단은 그 뜻으로 해 둘게.',
		'misty: 이건 내 보물이야. 네가 가졌으면 해.',
		{ got: 'mysticwater' },
		'misty[joy]: 자, 가자 {me}! 다음 바다는 어디야? 어디든 좋아— 너랑이라면!',
	],
};
/** 하트 이벤트를 끝냈을 때 뜨는 제목 */
export const EV_TITLE = ['골든볼브리지의 태그 승부', '블루시티 도둑 사건', '블루곶의 노을', '진심 승부'];
