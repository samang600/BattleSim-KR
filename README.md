# 배틀시뮬 KR

한국어 포켓몬 배틀 시뮬레이터 앱(안드로이드·웹). 배틀타워·배틀팩토리·네임드 트레이너·PWT·랭크 매치, 도트 UI, 3세대풍 칩튠 음악.

- 앱 소스와 자세한 설명: [`battle-kr/README.md`](battle-kr/README.md)
- 최신 APK: `battle-kr/release/`

## 폴더

| 폴더 | 내용 |
|---|---|
| `battle-kr/` | 앱 (Preact + esbuild, 안드로이드 래퍼 `battle-kr/android`) |
| `sim/` `data/` `lib/` `config/formats.ts` | 배틀 엔진 — [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) (MIT) 에서 가져와 일부 수정 |
| `build` `tools/build-utils.js` | 엔진을 `dist/` 로 컴파일 (데이터 생성 스크립트용) |

## 빌드

```bash
npm install
npm run build-engine        # 엔진 컴파일 (dist/) — 데이터 다시 만들 때만 필요
npm run gen-data            # battle-kr/src/gen/*.json 재생성 (선택)
npm run build               # → battle-kr/dist/index.html
npm run build:android       # 안드로이드 assets 에도 복사 → battle-kr/android 에서 ./gradlew assembleRelease
```

오프라인 그림 묶음·애니메이션은 이 저장소(GitHub)의 파일을 받아 씁니다. 저장소 주소는 `git remote` 의 origin 에서 자동으로 정하고, 다르게 하려면 `GH_REPO=아이디/저장소 npm run build`.

## 라이선스

배틀 엔진(`sim/`, `data/`, `lib/` 등)은 Pokémon Showdown 의 MIT 라이선스를 따릅니다 — [`LICENSE`](LICENSE). 포켓몬 이름·그림 등의 권리는 Nintendo·Creatures·GAME FREAK·The Pokémon Company 에 있으며, 이 프로젝트는 비공식 팬 프로젝트입니다.
