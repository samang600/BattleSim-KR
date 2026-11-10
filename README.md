# 트레이너 초상화 (시나리오 모드 시안용, 임시)

`battle-kr/scripts/make-portraits.py` 로 만든 픽셀 아트 초상화 (두 가지를 섞어 씀).

- `<id>.png` (332장): 저장소 주인이 AI 로 만든 상반신 그림을 인물 분할 모델(rembg isnet-anime)로 배경을 지우고(팔·머리카락 사이에 갇힌 흰 배경 포함) 120×176 · 32색 픽셀 아트로 바꾼 것. id = 영어 이름의 소문자·숫자만 (예: `professoroak`).
- `d_<쇼다운 그림 id>.png` (150장): 일반 트레이너용. Pokémon Showdown 트레이너 도트의 상반신을 Scale2x 로 4배 키운 것.

GitHub Pages 배포 때 `portraits/` 가 사이트의 `/portraits/` 로 복사된다. 임시 그림이므로 바뀔 수 있다.
