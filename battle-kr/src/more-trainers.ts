/*
 * 추가 네임드 트레이너 후보 (ExtraTrainer 형식) — MORE_ANIME(애니메이션 오리지널) + MORE_NAMED(게임 인물)
 * 저장소에는 아직 넣지 않음. 붙일 때: anime-trainers.ts 의 ANIME_NAMED 에 MORE_ANIME, trainer-lore.ts 의 EXTRA_NAMED 에 MORE_NAMED 를 이어 붙이면 됨.
 *
 * 출처 (나무위키 미러 namu.moe, 2026-11-08 확인)
 *  - 오바람, 오바람/포켓몬 (W 배치: 거북왕·에레키블·마기라스·블래키·윈디·브리무음)
 *  - 로사&로이, 리코(포켓몬스터 애니메이션 시리즈)/포켓몬, 로드(포켓몬스터 애니메이션 시리즈)/포켓몬, 한지우(대회 전적), 철이(포켓몬스터 애니메이션 시리즈)
 *  - 배틀프런티어, 배틀돔·배틀팩토리·배틀튜브·배틀피라미드·배틀아레나·배틀팰리스·배틀타워,
 *    리라/하인즈/우근/나리/다슬/기선/다투라 (에메랄드 은·금 심볼 팀)
 *  - 도희, 덴트/팟/콘 (B2W2 PWT 월드 리더스 팀), 칠현인(포켓몬스터 시리즈), 비오, 로트,
 *    플레어단, 바라/모미지/아케비/코레아 (영문명 대조), 캡틴(포켓몬스터), 일리마, 수련, 키아웨, 마오, 마마네, 말리화,
 *    도정 (대사 그대로 인용), 세이버리, 소도&실디, 플라타느박사, 수호(포켓몬스터)(=Eusine),
 *    포켓몬스터/등장인물/히스이지방 (전목=Kamado, 찬석=Adaman, 주혜=Irida), 찬석, 주혜, 전목,
 *    포켓몬스터/등장인물/팔데아지방 (선생님 이름), 타임, 레포르, 운향, 미모사, 사구아로, 지니어
 *  - 트레이너 그림: https://play.pokemonshowdown.com/sprites/trainers/<sprite>.png — 아래 42개 모두 curl -sI 200 확인
 *
 * 불확실한 점 / 보충(pad)한 부분
 *  - 프런티어 브레인(에메랄드)은 3마리 × 은·금 2세트 → 두 세트를 합쳐 6마리. 겹쳐서 모자라면 애니 소유 포켓몬으로 보충:
 *    리라 에브이(애니), 하인즈 윈디(보충), 우근 다탱구(애니), 나리 하리뭉(애니), 다슬 아보크(보충).
 *    다투라는 렌탈 시설이라 고정 팀이 없음 → 애니 소유(프리져·쁘사이저·글라이거)+보충(글라이온·코뿌리·아쿠스타·메타그로스) — 창작.
 *    나리의 직함 '아레나타이쿤'은 나무위키 본문에서 직접 확인 못 함(일본판 직함 アリーナキャプテン 계열) → 확인 필요.
 *  - 비오: 게임 사용 포켓몬은 프리지오·포푸니라뿐 → 얼음·악 타입 4마리 보충.
 *  - 바라(Bryony): XY 사용은 레파르다스·절각참뿐 → 악 타입 4마리 보충.
 *    ★ 기존 trainer-lore.ts 의 id "mable" 은 이름이 "바라" 로 돼 있는데, 나무위키 기준 바라=Bryony, 모미지=Mable 이다.
 *      기존 항목을 이름 "모미지"(헬가·포푸니라 중심)로 고치고, 이 bryony 항목을 추가하는 것을 권장.
 *      아케비(Aliana)·코레아(Celosia)는 Showdown 그림이 없어 제외.
 *  - 캡틴: USUM 재대결 3마리(+마마네 4~5마리, 말리화 5~6마리) + 주인(토템) 포켓몬/애니 포켓몬으로 보충.
 *    마마네 목록의 '딱구리' 는 꼬마돌 진화형 딱구리(알로라의 모습) → golemalola. 이름 한 칸이 비어 있던 자리는 자포코일로 추정.
 *    ※ role 'leader' 로 두면 PWT '알로라 섬의 왕' 대회(byRegionLeaders('알로라'))에 캡틴도 섞인다 — 원치 않으면 cup 필터에서 title 에 '캡틴' 제외.
 *  - 도정·세이버리: 가라르 스타 토너먼트용으로 최종진화/가라르 폼 보충. 세이버리 마지막은 야도킹(가라르) 추정.
 *  - 소도·실디: 게임 4마리씩 → 검/방패 컨셉으로 2마리씩 보충.
 *  - 플라타느박사: 게임은 이상해꽃·리자몽·거북왕만 → 칼로스 스타팅 2마리 + 애니 에이스 한카리아스 보충.
 *  - 수호(Eusine, 기존에 '미나키'로 알려졌던 인물): 슬리프·고우스트·붐볼 → 진화형(슬리퍼·팬텀·붐볼) + 에스퍼/고스트 보충.
 *  - 찬석·주혜: 이브이 진화형 3마리 + 각 단의 상징 포켓몬 보충(히스이 폼). 전목: 연승가도 6마리 그대로(워글은 히스이 폼으로 둠).
 *  - 선생님(팔데아): 아카데미 에이스 토너먼트 팀(나무위키) 그대로. 운향의 켄타로스(팔데아)는 버전마다 다른 폼 → combat 폼 1마리만.
 *  - 애니: 지우(신오)는 영란대회 택트전 출전 포켓몬 기억 기반(헤라크로스·코터스·스왈로·나무킹·피카츄·초염몽; 딥상어동은 미진화라 뺌) — 확인 권장.
 *    지우(오렌지)는 위너즈컵 결승 vs 류지(Drake) 팀. 철이: 나무위키 문서에 팀 정리가 없어 기억 기반(대검귀·너트령·삼삼드래·스완나·루카리오) + 몰드류 보충.
 *    리코: 마스카나·브리무음·카디나르마 3마리만 확실 + 4.x 문단의 달콤아→달코퀸, 바다그다→바닥트리오 + 바우첼 보충.
 *    로드: 라우드본·찌리비크·루카리오·캡틴 피카츄(원래 프리드 소유) + 하랑우탄(5.x 문단) + 빠르모트 보충.
 *  - 초전설 규칙 충돌: 리코의 테라파고스(파고고), 로드의 레쿠쟈(검은 레쿠쟈), 오바람의 레지드래고(초전설 아님, 그래도 뺌)는 넣지 않음.
 *    기존 데이터 중 주인공·라이벌 팀에 초전설이 있는 항목(보고용): ethan(hooh), lyra(lugia), hilbertp(zekrom), hildap(reshiram),
 *    n(zekrom), elio(solgaleo), selene·victor·gloria·florian·juliana(각자 전설 마스코트) — trainer-lore.ts 확인 필요.
 *  - 제외(다음 후보, 이름만): 아케비·코레아(그림 없음), 로트(사용 포켓몬 2마리), 다크트리니티, 기모노 자매, 핸섬(그림 없음),
 *    울트라조사대(다리우스 등, 한국명 미확인), 히스이 캡틴(미도·억새·성화·동백·사비·단지·포화·라나·르푸), 코기토(고정 팀 없음),
 *    세이지(언어 선생님, 팀 미확인), 비케(대결 없음), 프리드박사(소유 3마리), 숀(한국명 미확인), 해리·드류 등(한국명 미확인).
 *  - 대사 src: 'mixed' = 나무위키 대사 일부 그대로/변형, 'written' = 인물에 맞춰 새로 씀.
 */
import type { ExtraTrainer } from './trainer-lore'; // battle-kr/src 에 넣을 때 기준 경로

export const MORE_ANIME: ExtraTrainer[] = [
	{ id: "ash-sinnoh", name: "지우", title: "신오리그 영란대회 4강", region: "애니메이션", role: "hero", team: ["heracross", "torkoal", "swellow", "sceptile", "pikachu", "infernape"], sprite: "ash-sinnoh",
		line: "신오리그에서 여기까지 왔어! 이번엔 꼭 이길 거야!", ace: "초염몽, 너로 정했다! 맹화로 단숨에 뒤집자!", lose: "졌다… 그래도 끝까지 싸워 준 모두가 자랑스러워!", win: "해냈다! 우리 팀워크가 최고야!", src: "written" },
	{ id: "ash-orange", name: "지우", title: "오렌지리그 위너즈컵 우승", region: "애니메이션", role: "hero", team: ["venusaur", "blastoise", "tauros", "lapras", "charizard", "pikachu"], sprite: "ash-capbackward",
		line: "오렌지리그 우승자 태초마을의 지우다! 승부하자!", ace: "피카츄, 너로 정했다! 10만볼트!", lose: "으윽… 다음엔 꼭 이길 거야!", win: "해냈다, 피카츄! 우리가 이겼어!", src: "mixed" },
	{ id: "gary", name: "오바람", title: "지우의 라이벌", region: "애니메이션", role: "rival", team: ["electivire", "tyranitar", "umbreon", "arcanine", "hatterene", "blastoise"], sprite: "blue-gen2",
		line: "오랜만이다, 지우. 아니, 네가 상대였나? 실망시키지 마라.", ace: "거북왕, 나와라! 진짜 실력을 보여 줄 때다!", lose: "…흥, 인정하지. 너 꽤 강해졌구나.", win: "역시 아직 내가 한 수 위로군. 바이바이~", src: "written" },
	{ id: "jessie", name: "로사", title: "로켓단", region: "애니메이션", role: "admin", team: ["arbok", "seviper", "yanmega", "gourgeist", "mimikyu", "wobbuffet"], sprite: "teamrocket",
		line: "뭐가 어쩌고 어째? 대답해 주는 게 인지상정! 로켓단 로사가 상대해 주지!", ace: "마자용, 가랏! …어머, 넌 부르지도 않았는데?!", lose: "로켓단은 이번에도 당했구나~!", win: "오호호! 이 몸의 미모와 실력을 알아봤니?", src: "mixed" },
	{ id: "james", name: "로이", title: "로켓단", region: "애니메이션", role: "admin", team: ["victreebel", "cacturne", "carnivine", "malamar", "amoonguss", "weezing"], sprite: "teamrocket",
		line: "세계의 파괴를 막기 위해! 로켓단 로이, 등장이다!", ace: "또도가스, 부탁한다! 연막으로 뒤덮어 버려!", lose: "로켓단은 이번에도 당했구나~!", win: "해냈다! 오늘 저녁은 진수성찬이야!", src: "mixed" },
	{ id: "liko", name: "리코", title: "라이징볼트태클러즈", region: "애니메이션", role: "hero", team: ["dachsbun", "wugtrio", "tsareena", "armarouge", "hatterene", "meowscarada"], sprite: "liko",
		line: "아직 서툴지만… 나도 내 힘으로 승부해 보고 싶어!", ace: "마스카나, 부탁해! 우리 같이 여기까지 왔잖아!", lose: "졌다… 그래도 오늘 배운 거, 꼭 기억할게.", win: "해냈어! 고마워, 다들!", src: "written" },
	{ id: "roy", name: "로드", title: "라이징볼트태클러즈", region: "애니메이션", role: "hero", team: ["oranguru", "pawmot", "kilowattrel", "lucario", "pikachu", "skeledirge"], sprite: "roy",
		line: "배틀이다! 전설의 모험가처럼 신나게 가 보자고!", ace: "라우드본, 가자! 뜨겁게 불태워 버려!", lose: "으아, 졌다! 그래도 엄청 재밌었어!", win: "이겼다! 이게 우리 모험의 힘이야!", src: "written" },
	{ id: "cameron", name: "철이", title: "하나리그 반다레대회 4강", region: "애니메이션", role: "rival", team: ["swanna", "ferrothorn", "excadrill", "hydreigon", "samurott", "lucario"], sprite: "acetrainer",
		line: "어라? 배지가 몇 개였더라… 아무튼 승부하자!", ace: "루카리오, 너로 정했다! 우리 특훈의 성과를 보여 줘!", lose: "와, 너 정말 세다! 나도 더 특훈해야겠어!", win: "해냈다! 특훈한 보람이 있네!", src: "written" },
];

export const MORE_NAMED: ExtraTrainer[] = [
	// 오박사: 1세대 데이터에 남아 있는 '오박사와의 배틀' 팀(켄타로스·나시·윈디·갸라도스 + 스타터) 기준, 6번째(망나뇽)는 보충. 그림은 쇼다운 'oak'
	{ id: "oak", name: "오박사", title: "오박사 포켓몬 연구소", region: "관동", role: "hero", team: ["tauros", "exeggutor", "arcanine", "gyarados", "dragonite", "venusaur"], sprite: "oak",
		line: "포켓몬의 세계에 온 것을 환영한다! 자, 그 실력을 한번 보여 주겠니?", ace: "연구를 시작할 때부터 함께한 파트너란다. 가거라!", lose: "훌륭하구나! 포켓몬과 마음이 잘 통하고 있어.", win: "아직이구나. 포켓몬을 더 이해해 주거라.", src: "written" },
	// ── 관동 / 성도 ──
	{ id: "janine", name: "도희", title: "관동 체육관 관장", region: "관동", role: "leader", team: ["venomoth", "weezing", "tentacruel", "roserade", "nidoqueen", "crobat"], sprite: "janine",
		line: "아버지의 뒤를 이은 닌자 도희! 독술의 무서움을 알려 주마!", ace: "크로뱃, 나가라! 닌자의 비술이다!", lose: "윽… 아직 수행이 부족한가 봐.", win: "후후, 닌자를 얕봤구나!", src: "written" },
	{ id: "eusine", name: "수호", title: "스이쿤을 쫓는 신비 연구가", region: "성도", role: "rival", team: ["electrode", "hypno", "xatu", "jynx", "mismagius", "gengar"], sprite: "eusine",
		line: "나는 수호. 스이쿤을 쫓고 있지. 네 실력, 확인해 보겠다!", ace: "팬텀, 가라! 스이쿤에게 인정받을 실력을 보여라!", lose: "…스이쿤이 너를 택한 이유를 알겠군.", win: "이래서야 스이쿤을 만날 수 없겠는걸?", src: "written" },
	// ── 호연 배틀프런티어 (에메랄드) ──
	{ id: "anabel", name: "리라", title: "타워타이쿤", region: "호연", role: "rival", team: ["entei", "raikou", "snorlax", "latios", "espeon", "alakazam"], sprite: "anabel",
		line: "당신이 여기까지 온 도전자군요. 트레이너로서의 재능, 시험해 보겠어요.", ace: "후딘, 부탁해. 이제부터는 전력이에요.", lose: "이렇게 즐거운 배틀은 처음이에요… 고마워요.", win: "재능은 있지만… 아직 제 상대는 아니네요.", src: "written" },
	{ id: "tucker", name: "하인즈", title: "돔슈퍼스타", region: "호연", role: "rival", team: ["charizard", "salamence", "latias", "metagross", "arcanine", "swampert"], sprite: "tucker",
		line: "관객 여러분, 기다리셨죠~! 완전무적의 슈퍼스타, 하인즈 등장!", ace: "대짱이, 무대의 주인공은 바로 너야!", lose: "말도 안 돼… 슈퍼스타인 내가?!", win: "역시 무대의 주인공은 이 몸이었지~!", src: "written" },
	{ id: "spenser", name: "우근", title: "팰리스 가디언", region: "호연", role: "rival", team: ["crobat", "lapras", "arcanine", "shiftry", "suicune", "slaking"], sprite: "spenser",
		line: "와하하! 포켓몬과 마음이 통하는지 이 늙은이가 봐 주마!", ace: "게을킹, 네 마음대로 날뛰어 보거라!", lose: "와하하! 훌륭하다! 마음이 완전히 통했구먼!", win: "아직 포켓몬의 마음을 다 읽지 못했구나.", src: "written" },
	{ id: "greta", name: "나리", title: "아레나타이쿤", region: "호연", role: "rival", team: ["heracross", "shedinja", "breloom", "gengar", "hariyama", "umbreon"], sprite: "greta",
		line: "좋아, 기합 충분한 도전자네! 정면 승부로 가자!", ace: "블래키, 끝까지 버텨! 승부는 지금부터야!", lose: "졌다! 시원하게 졌으니 깔끔하게 인정할게!", win: "기합이 부족했어! 다시 단련하고 와!", src: "written" },
	{ id: "lucy", name: "다슬", title: "튜브퀸", region: "호연", role: "rival", team: ["shuckle", "steelix", "milotic", "gyarados", "arbok", "seviper"], sprite: "lucy",
		line: "……시간 끌지 마. 빨리 시작해.", ace: "세비퍼… 물어뜯어.", lose: "빌어먹을…! 프런티어 패스 내놔…", win: "……운도 실력이야.", src: "mixed" },
	{ id: "brandon", name: "기선", title: "피라미드킹", region: "호연", role: "rival", team: ["articuno", "zapdos", "moltres", "registeel", "regice", "regirock"], sprite: "brandon",
		line: "피라미드의 정상은 이미 내가 정복했다! 왕의 자리를 원한다면 나를 넘어라!", ace: "레지락, 가라! 고대의 힘을 보여 줘라!", lose: "훌륭하다! 오늘부터 네가 피라미드의 왕이다!", win: "모험의 각오가 아직 부족하군!", src: "written" },
	{ id: "noland", name: "다투라", title: "팩토리 헤드", region: "호연", role: "rival", team: ["pinsir", "gliscor", "starmie", "metagross", "rhyperior", "articuno"], sprite: "noland",
		line: "빌린 포켓몬으로 여기까지 오다니, 지식 하나는 제대로군! 나랑도 해 보자!", ace: "프리져, 간다! 지식만으론 못 이기는 것도 있다고!", lose: "하하, 졌다 졌어! 포켓몬을 보는 눈이 대단한데!", win: "지식이 아직 몸에 안 붙었군!", src: "written" },
	// ── 하나 ──
	{ id: "cilan", name: "덴트", title: "하나 체육관 관장", region: "하나", role: "leader", team: ["ferrothorn", "serperior", "jumpluff", "whimsicott", "lilligant", "simisage"], sprite: "cilan",
		line: "당신과 포켓몬의 궁합, 테이스팅해 보겠습니다!", ace: "야나키, 마무리를 부탁해! 최고의 맛을 보여 주자!", lose: "훌륭한 맛이었어요… 당신들의 궁합은 최상급이군요!", win: "아직 숙성이 덜 됐나 봐요.", src: "written" },
	{ id: "chili", name: "팟", title: "하나 체육관 관장", region: "하나", role: "leader", team: ["heatmor", "darmanitan", "arcanine", "camerupt", "emboar", "simisear"], sprite: "chili",
		line: "뜨겁게 불타오르는 승부, 지금 바로 시작이다!", ace: "바오키, 활활 태워 버려!", lose: "으아, 내가 불타 버렸잖아!", win: "어때, 뜨거웠지?!", src: "written" },
	{ id: "cress", name: "콘", title: "하나 체육관 관장", region: "하나", role: "leader", team: ["crawdaunt", "samurott", "azumarill", "slowking", "seismitoad", "simipour"], sprite: "cress",
		line: "물처럼 맑고 우아한 승부를 대접해 드리죠.", ace: "앗차키, 냉정하게 흘려보내렴.", lose: "…제 계산이 빗나가다니, 놀랍군요.", win: "역시 물의 흐름은 거스를 수 없죠.", src: "written" },
	{ id: "zinzolin", name: "비오", title: "플라스마단 칠현인", region: "하나", role: "admin", team: ["cryogonal", "froslass", "beartic", "bisharp", "abomasnow", "weavile"], sprite: "zinzolin",
		line: "추위에 떨고 있나? 플라스마단 칠현인 비오가 얼려 주마!", ace: "포푸니라, 얼려 버려라! 얼음 속에 가둬라!", lose: "크윽… 몸이 더 차가워지는군.", win: "추위 앞에선 누구나 무력한 법이지.", src: "written" },
	// ── 칼로스 ──
	{ id: "bryony", name: "바라", title: "플레어단 과학자", region: "칼로스", role: "admin", team: ["krookodile", "scrafty", "pangoro", "malamar", "liepard", "bisharp"], sprite: "bryony",
		line: "플레어단의 아름다운 세계에 방해꾼은 필요 없어.", ace: "절각참, 끝장내 줘. 우아하게.", lose: "…계산이 틀렸어. 다시 해야겠군.", win: "역시 아름다운 승리였어.", src: "written" },
	{ id: "sycamore", name: "플라타느박사", title: "칼로스 포켓몬 연구가", region: "칼로스", role: "rival", team: ["venusaur", "blastoise", "delphox", "chesnaught", "charizard", "garchomp"], sprite: "sycamore",
		line: "메가진화를 연구하는 사람으로서, 너와 포켓몬의 유대를 직접 확인하고 싶어!", ace: "한카리아스, 부탁해! 우리 유대의 힘이야!", lose: "멋져! 이게 바로 트레이너와 포켓몬의 유대구나!", win: "좋은 데이터를 얻었어. 고마워!", src: "written" },
	// ── 알로라 캡틴 ──
	{ id: "ilima", name: "일리마", title: "알로라 캡틴", region: "알로라", role: "leader", team: ["bewear", "porygonz", "oranguru", "smeargle", "gumshoos", "komala"], sprite: "ilima",
		line: "캡틴 일리마입니다. 당신의 실력, 제 눈으로 확인해 보죠.", ace: "자말라, 마무리를 부탁해. Z기술로 보여 주자!", lose: "훌륭해요. 당신은 정말 빛나는 트레이너군요.", win: "아직 시련이 더 필요해 보이네요.", src: "written" },
	{ id: "lana", name: "수련", title: "알로라 캡틴", region: "알로라", role: "leader", team: ["wishiwashi", "toxapex", "primarina", "lanturn", "cloyster", "araquanid"], sprite: "lana",
		line: "…낚시하듯이, 천천히 끌어당겨 줄게요.", ace: "깨비물거미, 꽉 붙잡아. 놓치지 마.", lose: "놓쳐 버렸네요… 대어였는데.", win: "월척이에요. 후후.", src: "written" },
	{ id: "kiawe", name: "키아웨", title: "알로라 캡틴", region: "알로라", role: "leader", team: ["salazzle", "turtonator", "charizard", "arcanine", "talonflame", "marowakalola"], sprite: "kiawe",
		line: "불꽃의 춤으로 너를 시험하겠다!", ace: "텅구리, 춤춰라! 다이나믹풀플레임!", lose: "…훌륭했다. 네 불꽃이 더 뜨거웠군.", win: "불꽃의 춤은 아직 끝나지 않았다!", src: "written" },
	{ id: "mallow", name: "마오", title: "알로라 캡틴", region: "알로라", role: "leader", team: ["lurantis", "comfey", "decidueye", "trevenant", "shiinotic", "tsareena"], sprite: "mallow",
		line: "아이나식당의 마오야! 오늘의 메뉴는 나랑 승부!", ace: "달코퀸, 가자! 상큼하게 마무리해 줘!", lose: "와, 맛있게 당했다~! 다음엔 요리로 이길 거야!", win: "이겼다! 승리의 맛은 역시 최고야!", src: "written" },
	{ id: "sophocles", name: "마마네", title: "알로라 캡틴", region: "알로라", role: "leader", team: ["golemalola", "magnezone", "electivire", "vikavolt", "rotomwash", "togedemaru"], sprite: "sophocles",
		line: "계산대로라면 이길 확률은 충분해! 실험 시작!", ace: "토게데마루, 가자! 마지막 회로를 연결할 차례야!", lose: "계산이 틀렸어… 데이터를 다시 모아야겠다.", win: "봐, 내 계산이 맞았지!", src: "written" },
	{ id: "mina", name: "말리화", title: "알로라 캡틴", region: "알로라", role: "leader", team: ["mawile", "klefki", "shiinotic", "granbull", "wigglytuff", "ribombee"], sprite: "mina",
		line: "음~ 너, 그림 소재로 딱 좋은 색이야. 승부하면서 좀 볼게.", ace: "에리본, 반짝반짝하게 칠해 줘.", lose: "와~ 좋은 색 나왔다. 이 그림, 너한테 줄게.", win: "응, 오늘은 내 색이 더 진했네.", src: "written" },
	// ── 가라르 ──
	{ id: "klara", name: "도정", title: "마스터 도장 제자", region: "가라르", role: "rival", team: ["skuntank", "drapion", "scolipede", "tentacruel", "weezinggalar", "slowbrogalar"], sprite: "klara",
		line: "내 전력을 보여주겠어! 정정당당하게 승부하는 거다!!", ace: "절대 지지 않아! 마지막까지 물고 늘어지겠어!", lose: "적당히 하지 않았는데! 모든 힘을 쏟았는데...", win: "역시 나야! 귀여운 데다가 기술에도 해박하다니까~!", src: "mixed" },
	{ id: "avery", name: "세이버리", title: "마스터 도장 제자", region: "가라르", role: "rival", team: ["swoobat", "rapidashgalar", "bronzong", "gallade", "alakazam", "slowkinggalar"], sprite: "avery",
		line: "후후후… 명문가 출신인 이 몸의 에스퍼 파워를 보여드리죠!", ace: "야도킹, 가세요! 이것이 엘리트의 힘입니다!", lose: "말도 안 돼…! 이 몸이 또 지다니!", win: "보셨습니까? 이것이 엘리트와 서민의 차이죠!", src: "written" },
	{ id: "sordward", name: "소도", title: "가라르 왕가의 후손", region: "가라르", role: "boss", team: ["escavalier", "gallade", "doublade", "bisharp", "golisopod", "sirfetchd"], sprite: "sordward",
		line: "영웅의 후손인 이 소도가 평민을 상대해 주지!", ace: "창파나이트, 왕가의 검을 받아라!", lose: "말도 안 돼… 고귀한 혈통이 평민에게 지다니!", win: "역시 왕의 피가 흐르는 자는 다르지!", src: "written" },
	{ id: "shielbert", name: "실디", title: "가라르 왕가의 후손", region: "가라르", role: "boss", team: ["sirfetchd", "bastiodon", "avalugg", "bronzong", "crustle", "klinklang"], sprite: "shielbert",
		line: "형님의 검에 이 실디의 방패! 우리를 뚫을 수 있겠습니까?", ace: "기기기어르, 철벽의 방패가 되어라!", lose: "방패가… 깨지다니요…!", win: "고귀한 방패 앞에 무릎 꿇으십시오!", src: "written" },
	// ── 히스이 (레전즈 아르세우스, 지역은 신오로 둠) ──
	{ id: "kamado", name: "전목", title: "은하단 단장", region: "신오", role: "rival", team: ["braviaryhisui", "clefable", "golem", "heracross", "ursaluna", "snorlax"], sprite: "kamado",
		line: "은하단 단장 전목이다. 이 마을을 지킬 힘이 있는지 직접 확인하겠다!", ace: "잠만보, 나가라! 은하단의 무게를 보여 줘라!", lose: "…훌륭하다. 너를 믿어 보겠다.", win: "그 정도로는 이 마을을 맡길 수 없다!", src: "written" },
	{ id: "adaman", name: "찬석", title: "금강단 두령", region: "신오", role: "rival", team: ["kleavor", "electrodehisui", "ursaluna", "vaporeon", "umbreon", "leafeon"], sprite: "adaman",
		line: "금강단 두령 찬석이다! 시간의 신을 모시는 우리 실력, 보여 주마!", ace: "리피아, 가자! 금강단의 긍지다!", lose: "하하! 대단하군! 진주단 녀석들한테도 자랑해야겠어!", win: "아직 금강단을 넘기엔 이르다!", src: "written" },
	{ id: "irida", name: "주혜", title: "진주단 두령", region: "신오", role: "rival", team: ["avalugghisui", "froslass", "sneasler", "espeon", "flareon", "glaceon"], sprite: "irida",
		line: "진주단 두령 주혜야! 공간의 신께 부끄럽지 않은 승부를 하자!", ace: "글레이시아, 얼려 버려! 진주단의 힘이야!", lose: "졌다~! 그래도 정말 멋진 승부였어!", win: "후훗, 진주단을 얕보면 안 되지!", src: "written" },
	// ── 팔데아 아카데미 선생님 (에이스 토너먼트) ──
	{ id: "jacq", name: "지니어", title: "아카데미 생물 선생님", region: "팔데아", role: "rival", team: ["arcanine", "lurantis", "swalot", "mudsdale", "slowbro", "farigiraf"], sprite: "jacq",
		line: "자, 수업 시간이에요! 선생님도 오늘은 진심으로 갈게요~!", ace: "키키링, 부탁해! 생물 수업의 성과를 보여 주자!", lose: "훌륭해요! 선생님이 배울 게 많네요~", win: "후후, 복습 숙제를 내 줄게요!", src: "written" },
	{ id: "tyme", name: "타임", title: "아카데미 수학 선생님", region: "팔데아", role: "rival", team: ["kleavor", "lycanroc", "drednaw", "stonjourner", "coalossal", "garganacl"], sprite: "tyme",
		line: "자, 계산해 볼까요? 이 승부의 답은 하나뿐이에요!", ace: "콜로솔트, 마지막 수식을 풀어 줘요!", lose: "어머, 계산이 틀렸네요. 정답은 당신이었어요!", win: "정답! 계산대로예요.", src: "written" },
	{ id: "raifort", name: "레포르", title: "아카데미 역사 선생님", region: "팔데아", role: "rival", team: ["zoroark", "seviper", "grumpig", "malamar", "scizor", "gengar"], sprite: "raifort",
		line: "역사에 남을 승부를 해 볼까요? 기록은 제가 할게요.", ace: "팬텀, 역사의 그림자에서 나와요!", lose: "오늘의 승부, 교과서에 실어도 되겠네요.", win: "역사는 반복된다… 오늘도 제 승리로요.", src: "written" },
	{ id: "dendra", name: "운향", title: "아카데미 배틀 선생님", region: "팔데아", role: "rival", team: ["falinks", "hitmontop", "taurospaldeacombat", "medicham", "hawlucha", "hariyama"], sprite: "dendra",
		line: "자자, 몸 풀었지? 배틀 수업, 실전으로 간다! 하나, 둘!", ace: "하리뭉, 힘껏 밀어붙여! 마지막 세트야!", lose: "좋았어! 너 완전 근육질 배틀러다!", win: "아직 단련이 부족해! 운동장 열 바퀴!", src: "written" },
	{ id: "miriam", name: "미모사", title: "아카데미 보건 선생님", region: "팔데아", role: "rival", team: ["hypno", "pincurchin", "sawsbuck", "glalie", "eelektross", "toxapex"], sprite: "miriam",
		line: "아파도 보건실은 바로 옆이니까… 마음 놓고 다쳐도 돼요. 후후.", ace: "더시마사리, 천천히… 꼼꼼하게.", lose: "다친 데는 없죠? 이리 와요, 치료해 줄게요.", win: "무리하면 안 돼요. 오늘은 푹 쉬어요.", src: "written" },
	{ id: "saguaro", name: "사구아로", title: "아카데미 가정 선생님", region: "팔데아", role: "rival", team: ["pachirisu", "froslass", "alomomola", "vespiquen", "goodra", "hatterene"], sprite: "saguaro",
		line: "릴랙스~ 승부도 마음이 편해야 잘 풀린다구.", ace: "브리무음, 우리만의 리듬으로 가자~", lose: "좋은 기운이었어~ 오늘은 너의 날이네.", win: "봐, 마음이 편하면 이렇게 된다구~", src: "written" },
];
