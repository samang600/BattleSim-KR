앱 배경음악 (이 앱을 위해 새로 작곡, 비영리)

| 파일 | 쓰는 곳 |
|---|---|
| title.mp3 | 타이틀·메인 메뉴 (마을 테마, C장조 115 BPM) |
| battle.mp3 | 트레이너 배틀 (E단조 178 BPM) |
| tower.mp3 | 배틀 시설: 타워·팩토리·랭크 매치 (G단조 164 BPM) |
| boss.mp3 | 중요 배틀: 관장·사천왕·타이쿤 (F단조 180 BPM) |
| evil.mp3 | 악의 조직 간부·보스 (E 프리지아 150 BPM) |
| champion.mp3 | 챔피언 결전: 챔피언·주인공, PWT 결승, 랭크 마스터 (D단조 186 BPM, 피아노 오스티나토) |
| pwt.mp3 | PWT 토너먼트 (B단조 172 BPM, C 구간만 장조 팡파르) |
| victory.mp3 | 승리 (C장조 132 BPM, 팡파르 뒤 반복) |

loops.json: 곡마다 루프 지점(초). 앱이 인트로 뒤(start)부터 끝(end)까지 이음새 없이 반복한다.
곡 데이터·렌더링 스크립트: battle-kr/music/ (SoundCraft CLI 로 렌더).

악기 샘플은 모두 CC0 1.0 (퍼블릭 도메인):
- Versilian Studios, VSCO 2 Community Edition — https://github.com/sgossner/VSCO-2-CE
- Versilian Studios, Versilian Community Sample Library (VCSL) — https://github.com/sgossner/VCSL
신스 음색(리드·베이스·기타·킥)은 SoundCraft 내장 신스.
여기에 다른 이름의 mp3를 넣으면 합성 칩튠 대신 그 파일을 재생한다.

배틀 곡 5곡(battle·tower·boss·champion·pwt)은 music/songs3.py 의 배틀 작법판(단조·16분 페달·3-3-2 엇박)으로 교체됨.
