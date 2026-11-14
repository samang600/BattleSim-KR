# 배틀시뮬 KR — 작업 규칙

한국어 포켓몬 배틀 앱. 앱은 `battle-kr/`, 배틀 엔진은 루트의 `sim/` `data/` `lib/` (Pokémon Showdown, MIT).
사용자와는 **한국어**로 대화한다.

## 빌드·확인
- `npm install` → `node battle-kr/build.mjs` (웹: `battle-kr/dist/index.html`), `--android` 면 안드로이드 assets 에도 복사.
- 엔진 데이터(`battle-kr/src/gen/*.json`)를 다시 만들 때만 `node build` → `node battle-kr/scripts/gen-data.cjs`.
- 화면 변경은 Playwright 로 **Pixel 7(deviceScaleFactor 2)** 크기에서 직접 눌러 보고 스크린샷으로 확인한 뒤 사용자에게 보낸다. 콘솔 `pageerror` 가 없어야 한다.
- 저장 데이터는 localStorage `pkbkr:*` (settings, teams, tower-*, factory-*, records …).

## 릴리스 루틴 (공식 버전에 들어가는 작업 묶음이 끝날 때만)
- **개발자 빌드에서만 보이는 작업(챔피언스·시나리오·새 메뉴 디자인 등)은 버전을 올리지 않고 APK 도 만들지 않는다** — 커밋·푸시와 스크린샷 확인까지만. APK 는 공식(정식) 버전에 한해서만 빌드한다(정식 APK 버전이 꼬임).
1. `battle-kr/android/app/build.gradle` 의 `versionCode` +1, `versionName` 올림(`package.json`·`package-lock.json` 버전도), `battle-kr/README.md` 의 APK 파일명·버전 문구 갱신, 바뀐 기능을 README 에 적기, `battle-kr/src/changelog.ts` 맨 위에 짧은 업데이트 소식 추가(웹에서 새 버전 첫 실행 때 보여 줌 — 사용자가 알아야 할 새 기능·큰 변화만 한두 줄로. 칸 크기·간격·위치 조정, 문구 삭제 같은 작은 손질이나 같은 기능을 여러 번 다듬은 과정은 적지 않고, 이미 적은 항목이 있으면 그 항목을 고쳐 하나로 유지. 항목이 없으면 창이 뜨지 않음).
2. `node battle-kr/build.mjs --android`
3. 서명 빌드 (`battle-kr/android` 에서):
   `BATTLESIM_KEYSTORE=<키스토어 경로> BATTLESIM_KEY_PASSWORD=<비밀번호> ./gradlew assembleRelease`
4. `battle-kr/release/BattleSimKR-v<버전>.apk` 를 새 파일로 교체(이전 APK 삭제, 폴더 하나에 최신 하나만).
5. 커밋·푸시, APK 와 스크린샷을 사용자에게 보내고 바뀐 점을 한국어로 정리.

## 버전·공식 웹 (갈래를 나누지 않는다)
- 버전은 `main` 한 줄만 쓴다. 공식 웹(`web` 브랜치)은 **`main` 을 그대로 옮겨서만** 올린다: `git push origin origin/main:refs/heads/web` → pages.yml. `web` 에 따로 커밋하거나 일부만 골라 넣지 않는다(버전이 두 갈래가 됨).
- 버전 숫자를 낮추지 않는다 — 앱은 공식 웹의 버전이 자기보다 높을 때만 자동 갱신하므로, 이미 나간 APK 보다 낮아지면 갱신이 끊긴다.
- 챔피언스 모드도 개발 중이라 같은 조건으로 숨긴다 (타이틀의 모드 고르기 화면 자체가 개발자 빌드에서만 나옴 — `main.tsx` 의 `BIG_MODES`).
- 시나리오 모드는 개발 중이라 공개하지 않는다. 개발자 빌드(`DEV_BUILD=1`)에서만 켜지므로(`main.tsx` 의 `SCENARIO_ON`) `main` 을 공식 웹에 올려도 나오지 않는다. 이 조건을 풀지 말 것.
- 시뮬레이터 모드의 새 메뉴 디자인(`main.tsx` Home 의 `SCENARIO_ON` 갈래, `.h2-*`)도 지금은 개발자 빌드에서만 — 사용자가 확인하면 공식에도 켠다.
- 개발자 빌드에서는 시뮬레이터 모드를 **아케이드 모드**라 부르고, 랭크 매치·PWT 는 챔피언스 모드로 옮겼다(새 메뉴에서 빠지고 배틀팰리스가 큰 칸). 공식 빌드는 챔피언스가 숨겨져 있으므로 예전 메뉴에 랭크 매치·PWT 가 그대로 남는다 — 챔피언스를 공개할 때 함께 옮긴다.
- 공식 웹에 올리는 것은 사용자가 요청할 때만.

**서명 키스토어·비밀번호는 절대 저장소에 커밋하지 않는다.** 환경변수로만 넘긴다.
키스토어가 없으면 사용자에게 받는다 — 다른 키로 서명하면 기존 설치본 위에 업데이트가 안 된다.

## 디자인
- UI 를 고칠 때는 `.claude/skills/pokemon-pixel-ui` 규칙(도트 계단 모서리 `scripts/pixring.py`, 흐림 없는 그림자, 2px 격자, 갈무리 글꼴)을 따른다.
- 디자인을 크게 바꿀 때는 먼저 시안 스크린샷을 보여 주고 확인받는다.
- **버튼 안의 글자·그림은 반드시 가운데 정렬**(가로·세로)인지 스크린샷으로 확인한다 — 사용자가 중요하게 보는 요소. 고정 폭 버튼은 `display: flex; align-items: center; justify-content: center` 로, 화살표 같은 기호는 글자 대신 도트 그림(clip-path)으로 그린다. 글자 중심과 버튼 중심의 차이를 Range 로 재서 2px 안인지 본다.
- 실제 게임 그래픽·음악 파일은 쓰지 않는다. 트레이너·포켓몬 스프라이트는 Showdown 스프라이트 서버 것을 쓰며 `scripts/fetch-sprites.sh` 로 오프라인 묶음을 만든다.

## 음악
- 칩튠 곡은 `battle-kr/music/gen3.py` 가 만든 `src/gen/chip-gen3.json` (새로 작곡한 선율). 재생은 `src/sound.ts` 의 GBA 풍 음원(gbaTone·gbaDrum·gbaEcho).
- 기존 게임 곡을 그대로 쓰거나 알아볼 수 있게 어레인지하지 않는다(저작권). 분위기·장르 기법만 참고해 새로 쓴다.

## 주요 파일
| 파일 | 내용 |
|---|---|
| `src/main.tsx` | 라우팅·타이틀·설정 화면 |
| `src/modes.tsx` | 배틀타워·팩토리·네임드·PWT·랭크·프리 배틀 흐름, 난이도(`opts.diff`), 다음 상대 저장(`state.next`), `BgmRow` |
| `src/ui/battle.tsx` | 배틀 화면·연출·리플레이 재생 |
| `src/ui/teambuilder.tsx` `src/ui/screens.tsx` `src/ui/core.tsx` | 팀 편집·공용 화면·공용 컴포넌트 |
| `src/ai.ts` | AI (aiVer 3: 필드 평가 + 플레이어 습관 예측. 상대 선택을 미리 보는 기능은 사용자가 불합리하다고 해서 뺐음) |
| `src/sets.ts` | 무작위 세트·메가 맞춤(`fitSetToMega`)·볼 컨셉·노력치 표시 |
| `src/trainers.ts` `src/trainer-lore.ts` `src/trainer-lines.ts` | 네임드/일반 트레이너, 대사(나무위키 기준, 없으면 인물에 맞춰 보충) |
| `src/sound.ts` | 효과음·배경음악, `BGM_CHOICES`, `pickBattleMusic` |
| `src/rewards.ts` `src/ui/shop.tsx` | 보상: BP 지갑·얻는 규칙·교환소 상품·주간 과제 / 교환소 화면·카드 꾸미기·승리 연출 (꾸미기 전용, 배틀 능력 영향 없음) |
| `src/champions.tsx` `src/champions-data.ts` | 챔피언스 모드(개발자 빌드): 6마리 파티로 시작·스카우트(일반·지명, 12시간마다 무료 1회, 도구 없이 옴)·로스터(박스형, 포켓몬·트레이닝은 팝업 창)·상점(검색)·미션·랭크 매치와 PWT(`modes.tsx` 의 `runRank`/`runPWT` 에 `ArenaCtx` 로 내 팀을 넘김 — 랭크는 더 어려운 척도·RP 는 `-ch` 로 따로, PWT 는 지방 리더스 전부 → 월드 리더스 5회 → 사천왕 대회 5회 → 챔피언스 순으로 열림)·타워(싱글·더블, 상대도 6마리)·도구 중복 불가·규칙은 설정의 배틀 규칙·승급전 스토리(랭크 매치 등급이 오르면 열림)와 컷씬(`EVENTS`). 초기화는 설정 화면 맨 아래. 값(BP)·등급·대사는 data 쪽. 저장 `champions`, 재화는 `rewards.ts` 의 BP(`spendBP`) |
| `src/scenario.tsx` `src/scenario-data.ts` `src/scenario-script.ts` | 시나리오 모드(개발자 빌드): 관동 편 |
| `src/style.css` | 전체 스타일(도트 테두리 변수 포함) |
| `scripts/gen-arenas.py` | 배틀 배경 그림 생성 |
