# 배틀시뮬 KR — 작업 규칙

한국어 포켓몬 배틀 앱. 앱은 `battle-kr/`, 배틀 엔진은 루트의 `sim/` `data/` `lib/` (Pokémon Showdown, MIT).
사용자와는 **한국어**로 대화한다.

## 빌드·확인
- `npm install` → `node battle-kr/build.mjs` (웹: `battle-kr/dist/index.html`), `--android` 면 안드로이드 assets 에도 복사.
- 엔진 데이터(`battle-kr/src/gen/*.json`)를 다시 만들 때만 `node build` → `node battle-kr/scripts/gen-data.cjs`.
- 화면 변경은 Playwright 로 **Pixel 7(deviceScaleFactor 2)** 크기에서 직접 눌러 보고 스크린샷으로 확인한 뒤 사용자에게 보낸다. 콘솔 `pageerror` 가 없어야 한다.
- 저장 데이터는 localStorage `pkbkr:*` (settings, teams, tower-*, factory-*, records …).

## 릴리스 루틴 (작업 묶음 하나 끝날 때마다)
1. `battle-kr/android/app/build.gradle` 의 `versionCode` +1, `versionName` 올림(`package.json`·`package-lock.json` 버전도), `battle-kr/README.md` 의 APK 파일명·버전 문구 갱신, 바뀐 기능을 README 에 적기, `battle-kr/src/changelog.ts` 맨 위에 짧은 업데이트 소식 추가(웹에서 새 버전 첫 실행 때 보여 줌 — 사용자가 알아야 할 새 기능·큰 변화만 한두 줄로. 칸 크기·간격·위치 조정, 문구 삭제 같은 작은 손질이나 같은 기능을 여러 번 다듬은 과정은 적지 않고, 이미 적은 항목이 있으면 그 항목을 고쳐 하나로 유지. 항목이 없으면 창이 뜨지 않음).
2. `node battle-kr/build.mjs --android`
3. 서명 빌드 (`battle-kr/android` 에서):
   `BATTLESIM_KEYSTORE=<키스토어 경로> BATTLESIM_KEY_PASSWORD=<비밀번호> ./gradlew assembleRelease`
4. `battle-kr/release/BattleSimKR-v<버전>.apk` 를 새 파일로 교체(이전 APK 삭제, 폴더 하나에 최신 하나만).
5. 커밋·푸시, APK 와 스크린샷을 사용자에게 보내고 바뀐 점을 한국어로 정리.

**서명 키스토어·비밀번호는 절대 저장소에 커밋하지 않는다.** 환경변수로만 넘긴다.
키스토어가 없으면 사용자에게 받는다 — 다른 키로 서명하면 기존 설치본 위에 업데이트가 안 된다.

## 디자인
- UI 를 고칠 때는 `.claude/skills/pokemon-pixel-ui` 규칙(도트 계단 모서리 `scripts/pixring.py`, 흐림 없는 그림자, 2px 격자, 갈무리 글꼴)을 따른다.
- 디자인을 크게 바꿀 때는 먼저 시안 스크린샷을 보여 주고 확인받는다.
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
| `src/style.css` | 전체 스타일(도트 테두리 변수 포함) |
| `scripts/gen-arenas.py` | 배틀 배경 그림 생성 |
