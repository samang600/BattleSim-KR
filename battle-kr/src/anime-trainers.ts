/*
 * 애니메이션 오리지널 네임드 트레이너 (EXTRA_NAMED 형식, region: "애니메이션")
 *
 * 출처 (나무위키 미러 namu.moe, 2026-11 확인)
 *  - https://namu.moe/w/한지우            (어록 "○○, 너로 정했다!", "포켓몬 마스터가 될 거야")
 *  - https://namu.moe/w/한지우/포켓몬
 *  - https://namu.moe/w/택트              (신오리그 4강 지우전 / 대사 "나한테 두 번째 포켓몬을 꺼내게 한 건 네가 처음이다." "다음 포켓몬은... 이거다!")
 *  - https://namu.moe/w/알랭(포켓몬스터 애니메이션 시리즈)  (+ /포켓몬, /작중 행적: "더 강해진다.", "리자몽! 전방 53도로 화염방사!")
 *  - https://namu.moe/w/진철              ("○○, 시합 스탠바이!", "한심한 녀석!", 입버릇 "무르군")
 *  - https://namu.moe/w/슈티              (최종 포켓몬 6마리, 대사 "기본이잖아?", "똑같은 결과는 다시 없어! …")
 *  - 트레이너 그림: https://play.pokemonshowdown.com/sprites/trainers/<sprite>.png (모두 200 확인)
 *
 * 팀 근거 / 불확실한 점
 *  - 지우(칼로스): 칼로스리그 결승 vs 알랭 — 피카츄·개굴닌자·파이어로·루차불·음번·미끄래곤.
 *    에이스는 개굴닌자(greninja, 일반 폼. 'greninjabond'/'greninjaash' 는 쓰지 않음). 피카츄는 팀 안에 있으므로 전기구슬 자동 적용.
 *  - 지우(알로라): 알로라리그 우승 — 피카츄·나몰빼미(미진화, 애니 그대로; 앱이 진화의휘석 부여)·루가루암(황혼, lycanrocdusk)·어흥염·멜메탈·아고용, 에이스 피카츄.
 *  - 지우(월드 챔피언): 마스터즈 에이트 결승 vs 단델 — 어래곤(dracovish)·창파나이트(sirfetchd)·루카리오·망나뇽·팬텀·피카츄, 에이스 피카츄.
 *  - 택트: 작중 공개는 다크라이·라티오스 2마리뿐. 나머지 4마리(앤테이·루카리오·크레세리아·쉐이미)는 나무위키에 적힌 팬 추정(DP 오프닝 장면/다크라이 연관)을 따름 → 창작.
 *    에이스는 상징인 다크라이. 규칙상 환상·전설이 막히면 rosterForRule 이 빼므로 루카리오가 남을 수 있음.
 *  - 알랭: 칼로스리그 — 켄호로우·포푸니라·절각참·마기라스·메타그로스·리자몽(메가 X). 앱의 fitSetToMega 가 X/Y 중 무작위로 고를 수 있음 → 알랭은 X 고정이 바람직(필요하면 별도 처리).
 *  - 진철: 신오리그 8강 풀배틀 vs 지우 — 아이스크·트리토돈·드래피온·눈여아·토대부기·에레키블(나무위키 본문에는 6마리 전부가 정리돼 있지 않아 기억 기반 + 소유 목록으로 대조). 에이스 에레키블.
 *  - 슈티: 나무위키 최종 6마리 = 샤로다·노보청·유토브·램프라·탱그릴·바닐프티 (유토브·램프라 중간진화, 탱그릴·바닐프티 미진화).
 *    아래 팀은 앱 밸런스를 위해 켄호로우·샹델라·탱탱겔·배바닐라로 최종진화시킴 → 애니 그대로 원하면
 *    ["tranquill", "lampent", "frillish", "vanillite", "conkeldurr", "serperior"] 로 바꾸면 됨.
 *  - 그림(Showdown 에 애니 전용 그림이 없는 인물은 비슷한 외형의 일반 트레이너로 대체):
 *    택트 → veteran (검은 코트 남성), 진철 → acetrainer-gen3 (보라 머리 남성), 슈티 → acetrainer-gen7 (밝은 머리 청년).
 *    tobias / paul / trip / sawyer 그림은 서버에 없음(404).
 *  - 숀(Sawyer)은 한국어 더빙명 확인 실패로 제외(나무위키 '철이'는 BW 의 Cameron). 프리드박사(2023)는 소유 포켓몬이 3마리뿐이라 제외.
 *  - 대사 src: 'mixed' = 나무위키 대사를 일부 그대로/변형, 'written' = 인물에 맞춰 새로 씀.
 */
import type { ExtraTrainer } from './trainer-lore';
export const ANIME_NAMED: ExtraTrainer[] = [
	{ id: "ash-kalos", name: "지우", title: "칼로스리그 준우승", region: "애니메이션", role: "hero", team: ["pikachu", "talonflame", "hawlucha", "goodra", "noivern", "greninja"], sprite: "ash-kalos",
		line: "태초마을의 지우다! 포켓몬 마스터가 될 때까지 절대 안 져!", ace: "개굴닌자, 너로 정했다! 우리 마음을 하나로!", lose: "졌다… 하지만 다음엔 반드시 이길 거야!", win: "해냈다! 고마워, 다들 정말 최고였어!", src: "mixed" },
	{ id: "ash-alola", name: "지우", title: "알로라리그 초대 우승", region: "애니메이션", role: "champion", team: ["rowlet", "lycanrocdusk", "incineroar", "melmetal", "naganadel", "pikachu"], sprite: "ash-alola",
		line: "알로라~! 알로라리그 우승자 지우랑 승부하자!", ace: "피카츄, 너로 정했다! Z기술까지 전력으로 간다!", lose: "와, 너 정말 강하다! 다음에 또 승부하자!", win: "해냈다, 피카츄! 이게 우리 알로라의 힘이야!", src: "mixed" },
	{ id: "ash-world", name: "지우", title: "월드 챔피언", region: "애니메이션", role: "champion", team: ["dracovish", "sirfetchd", "lucario", "dragonite", "gengar", "pikachu"], sprite: "ash",
		line: "월드 챔피언이 돼도 포켓몬 마스터를 향한 여행은 계속이야!", ace: "피카츄, 너로 정했다! 우리가 함께라면 어떤 상대도 이길 수 있어!", lose: "졌다…! 그래도 너랑 싸워서 진짜 즐거웠어!", win: "이겼다! 그래도 포켓몬 마스터는 아직 멀었다고!", src: "mixed" },
	{ id: "tobias", name: "택트", title: "신오리그 우승", region: "애니메이션", role: "champion", team: ["latios", "entei", "lucario", "cresselia", "shaymin", "darkrai"], sprite: "veteran",
		line: "지금까지 다크라이 한 마리로 충분했다. 너는 어떨까.", ace: "다음 포켓몬은… 이거다! 다크라이!", lose: "나한테 이만큼 꺼내게 한 건 네가 처음이다. …대단한데.", win: "어제도 지켜봤지만, 좋은 승부였다.", src: "mixed" },
	{ id: "alain", name: "알랭", title: "칼로스리그 우승", region: "애니메이션", role: "champion", team: ["unfezant", "weavile", "bisharp", "tyranitar", "metagross", "charizard"], sprite: "alain",
		line: "모든 메가진화를 쓰러뜨리고 정점에 선다. …더 강해진다.", ace: "리자몽, 메가진화! 전방 53도로 화염방사!", lose: "…리자몽, 우리는 아직 더 강해질 수 있어.", win: "리자몽이 아니면 강해지는 의미가 없다.", src: "mixed" },
	{ id: "paul", name: "진철", title: "신오 라이벌", region: "애니메이션", role: "rival", team: ["ninjask", "gastrodon", "drapion", "froslass", "torterra", "electivire"], sprite: "acetrainer-gen3",
		line: "흥, 또 너냐. 시간 끌지 마라.", ace: "에레키블, 시합 스탠바이!", lose: "…무르군. 하지만 인정하지. 이번엔 네가 이겼다.", win: "한심한 녀석! 그 정도로 날 이기겠다고?", src: "mixed" },
	{ id: "trip", name: "슈티", title: "하나 라이벌", region: "애니메이션", role: "rival", team: ["unfezant", "chandelure", "jellicent", "vanilluxe", "conkeldurr", "serperior"], sprite: "acetrainer-gen7",
		line: "아직도 그 피카츄야? 촌스럽게. 상성 정도는 기본이잖아?", ace: "샤로다, 마무리해! 똑같은 결과는 다시 없어!", lose: "…인정할게. 너, 많이 강해졌구나.", win: "봤지? 우린 레벨이 높아졌고, 넌 그대로야.", src: "mixed" },
];
