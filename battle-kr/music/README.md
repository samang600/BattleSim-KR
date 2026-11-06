# 배경음악 작곡·렌더링

- `songs.py`: 다섯 곡의 작곡 데이터 (멜로디·코드 진행·반주 패턴·드럼). `python3 songs.py [title battle tower boss evil]`
- `songs2.py`: 추가 3곡 — 승리·PWT 토너먼트·챔피언 결전. `python3 songs2.py [victory pwt champion]`
- `songs3.py`: 배틀 곡 5곡 다시 쓰기 (단조·16분 페달 베이스·현 분산화음·3-3-2 금관/킥 엇박·감7·나폴리 화음) — songs.py·songs2.py 의 같은 이름 곡을 대체
- `to_chip.py`: 작곡 데이터를 앱 칩튠 시퀀서용 5채널로 자동 편곡 → `src/gen/chip-tracks.json` (`python3 to_chip.py ../src/gen/chip-tracks.json`)
- `gen3.py`: 3세대(GBA)풍 배틀 곡 3곡을 칩튠 형식으로 바로 작곡 → `src/gen/chip-gen3.json` (`python3 gen3.py`)
- `chip_preview.py`: 칩튠판을 앱과 같은 방식(GBA 풍 음원, `--old` 면 예전 음색)으로 렌더해 미리듣기 mp3 (`python3 chip_preview.py ../src/gen/chip-tracks.json,../src/gen/chip-gen3.json 출력폴더 [곡]`)
- `compose.py`: 마을(타이틀) 테마 원본 (songs.py 가 불러 씀)
- `songkit.py`: 샘플 구역 자동 구성(실제 음높이를 재서 옥타브 보정), MIDI·SoundCraft 스크립트 작성, 악기별 라우드니스 자동 균형, 루프 이음새 처리, mp3
- `inst_cache.json`: 측정한 옥타브 보정값

필요한 것: SoundCraft CLI(`cargo build --release -p soundcraft-cli`, https://github.com/storytold/soundcraft), ffmpeg, numpy,
VSCO-2-CE·VCSL 저장소를 이 폴더의 상위(`../vsco_meta`, `../vcsl_meta`)에 blob 없이 clone(`git clone --filter=blob:none --no-checkout`) — 필요한 샘플만 받아 씀.
결과(`out/*.mp3`, `out/loops.json`)를 `public/bgm/` 로 복사.
