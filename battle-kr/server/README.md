# 배틀시뮬 KR 온라인 배틀 서버

Cloudflare Workers + Durable Objects(무료 요금제). 방 하나 = Durable Object 하나가 배틀을 들고 있고, 앱과 같은 쇼다운 엔진·규칙(`../src/ps`, `../src/engine.ts` 의 기믹 규칙)으로 서버가 판정한다.

- 주소: https://battlesim-kr.samang600.workers.dev
- `POST /room` → `{code}` (친구 배틀 방 코드 6자리) · `GET /ws?room=CODE` → WebSocket
- `GET /lobby` → WebSocket: 로비 방 목록 (`{t:'list'}` → `{t:'rooms', list}` 바뀔 때마다). 로비 방은 Room 이 Lobby 에 `POST /update` 로 알림
- 로비 방: 공개/비밀번호(SHA-256), 방 안 채팅(최근 30줄 저장), 방장이 규칙·형식 변경, 파티 변경, 둘 다 준비하면 고르기, 배틀 뒤 `again` 으로 대기실 복귀. 방장이 나가거나 끊긴 채 1분이 지나면 방을 닫고 목록에서 뺌
- 로컬 시험: `node build.mjs && npx wrangler dev --local --port 8787` 후 앱의 localStorage `pkbkr-server` 에 `127.0.0.1:8787`
- 메시지: `src/index.ts` 맨 위 설명 참고 (join · choose · forfeit / room · lines · request · end · error)
- 정보 공개: 상대 포켓몬 HP 는 % 로만, 정확한 HP·자기 팀 정보는 자기 진영에게만 (`src/match.ts`, 앱 규칙의 debug 를 끔)
- 잠들었다 깨면(hibernation) 저장한 시드·팀·선택 기록으로 배틀을 다시 만들고, 같은 token 으로 다시 들어오면 지난 줄과 마지막 요청을 다시 보냄

## 배포
```
cd battle-kr/server
npm install --legacy-peer-deps
export CLOUDFLARE_API_TOKEN=...  CLOUDFLARE_ACCOUNT_ID=...   # 저장소에 넣지 않음
npm run deploy    # build.mjs 로 엔진을 묶고(압축 약 0.9MB) wrangler deploy
```
