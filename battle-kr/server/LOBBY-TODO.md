# 온라인 로비 — 이어서 할 일

> **v2.67.0 에서 정식 반영** (main 에 합침, 정식 서버 배포). 아래 '배포 전에 할 일' 중 1·2·3 은 반영함 — 채팅 2초에 1줄·저장 10초 간격, 같은 카드 다시 안 보냄(cardKey), 로비 ping 자동 응답. 4·5·6 은 남음.

이 브랜치는 로비식 온라인 대전을 담고 있다. 로컬 서버(`wrangler dev`)에서 두 브라우저로 끝까지 시험했고, **Cloudflare 에는 아직 배포하지 않았다.** 앱 버전도 올리지 않았다(main 은 v2.66.0).

## 들어간 것
- 서버 `server/src/index.ts`
  - 로비 방: `join` 의 `create:{title,pw,ruleId,doubles,pick}` 로 만들기, 비밀번호 SHA-256, `team`·`rules`(방장)·`ready`·`chat`·`leave`·`again`
  - Room → Lobby `POST /update` 로 목록 갱신, `GET /lobby` WebSocket(`{t:'list'}` → `{t:'rooms', list}`)
  - 손님이 나가면 자리 비움, 방장이 나가거나 끊긴 채 1분 지나면 방 닫고 목록에서 뺌
  - 예전 흐름(코드로 친구 대전·랜덤 대전)은 그대로 (`test/sim-harness.mjs` 결과 같음)
- 앱 `src/online.ts`(`watchLobby`, 채팅 처리, `localStorage['pkbkr-server']` 로 시험 서버 지정), `src/online-ui.tsx`(로비·방 만들기·방 안·채팅·규칙/파티 바꾸기·재대전), `src/style.css`(v2.67 블록)

## 로컬 시험
```
cd battle-kr/server && npm install --legacy-peer-deps && node build.mjs
npx wrangler dev --local --port 8787 --ip 127.0.0.1
# 앱(dist/index.html)을 열고 개발자 도구에서: localStorage.setItem('pkbkr-server', '127.0.0.1:8787')
```

## 가능성 검토 (무료 요금제, Cloudflare 문서 기준)
- 하루 한도: 요청 10만 · 쓴 줄 10만(가장 먼저 닿음) · 읽은 줄 500만 · 저장 5GB. 넘으면 UTC 0시까지 실패.
- 배틀 1판(6분) 추정: 지금 약 38줄·9요청 → 로비 방(채팅 20줄) 약 75줄·20요청 → 하루 약 1,300판까지.
- 새 DO 클래스 없음(Lobby 이미 있음) → 마이그레이션 없이 코드만 배포, `wrangler rollback` 가능.

## 배포 전에 할 일 (사용자와 합의한 개선안)
1. 채팅: 한 사람당 2초에 1줄, 저장은 최근 30줄
2. Lobby: 같은 카드가 다시 오면 저장하지 않기 (Room 은 잠들었다 깨면 lastCard 가 비어 다시 보냄)
3. Lobby 의 ping 을 `setWebSocketAutoResponse` 로 (지금은 25초마다 깨움) — 앱 `watchLobby` 의 ping 문자열과 맞출 것
4. 기기(token)당 열린 방 1개, 로비 목록 최대 300개
5. 방에 「채팅 끄기」(상대 채팅 가리기). 금지어 필터는 사용자에게 물어볼 것
6. 공개 정보: 이름·모습·칭호·방 제목이 로비에 보임(안내 문구 검토)

## 배포 순서
1. 개발 서버: `CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npm run deploy:dev` (토큰은 저장소에 넣지 않음)
2. main 에 합치고 푸시 → 개발용 웹 /dev/ (개발 서버 사용) 에서 두 기기로 시험
3. 정식 서버 `npm run deploy` → 릴리스 루틴으로 v2.67.0 (versionCode 187)
