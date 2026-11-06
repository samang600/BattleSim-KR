#!/usr/bin/env python3
"""레전즈 Z-A 메가진화 도트 그림을 PokeAPI/sprites 저장소에서 받아 public/sprites 에 넣는다.
(그림: kyledovey(x.com/DoveKyle) 제작 팬 아트, PokeAPI/sprites 에 제공 — 쇼다운 서버에는 뒷모습이 없거나 흐릿한 렌더라 이것으로 대체)
fetch-sprites.sh 뒤에 실행."""
import os, sys, urllib.request
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '../public/sprites')
RAW = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/'
# 쇼다운 그림 id → PokeAPI id (mgibbie/CardPackOpener tools/data/mega_sprites.json 의 대응표)
IDS = {
    'raichu-megax': 10304, 'raichu-megay': 10305, 'clefable-mega': 10278, 'victreebel-mega': 10279, 'starmie-mega': 10280, 'dragonite-mega': 10281,
    'meganium-mega': 10282, 'feraligatr-mega': 10283, 'skarmory-mega': 10284, 'chimecho-mega': 10306, 'absol-megaz': 10307, 'staraptor-mega': 10308,
    'garchomp-megaz': 10309, 'lucario-megaz': 10310, 'froslass-mega': 10285, 'heatran-mega': 10311, 'darkrai-mega': 10312, 'emboar-mega': 10286,
    'excadrill-mega': 10287, 'scolipede-mega': 10288, 'scrafty-mega': 10289, 'eelektross-mega': 10290, 'chandelure-mega': 10291, 'golurk-mega': 10313,
    'chesnaught-mega': 10292, 'delphox-mega': 10293, 'greninja-mega': 10294, 'pyroar-mega': 10295, 'floette-mega': 10296, 'meowstic-mmega': 10314,
    'meowstic-fmega': 10326, 'malamar-mega': 10297, 'barbaracle-mega': 10298, 'dragalge-mega': 10299, 'hawlucha-mega': 10300,
    'crabominable-mega': 10315, 'golisopod-mega': 10316, 'drampa-mega': 10302, 'magearna-mega': 10317, 'magearna-originalmega': 10318,
    'zeraora-mega': 10319, 'falinks-mega': 10303, 'scovillain-mega': 10320, 'glimmora-mega': 10321, 'tatsugiri-curlymega': 10322,
    'tatsugiri-droopymega': 10323, 'tatsugiri-stretchymega': 10324, 'baxcalibur-mega': 10325,
}
VARIANTS = [('gen5', ''), ('gen5-back', 'back/'), ('gen5-shiny', 'shiny/'), ('gen5-back-shiny', 'back/shiny/')]
got = miss = 0
for sid, pid in IDS.items():
    for folder, sub in VARIANTS:
        dst = os.path.join(out, folder, sid + '.png')
        try:
            data = urllib.request.urlopen(RAW + sub + '%d.png' % pid, timeout=30).read()
            if len(data) < 100: raise ValueError('empty')
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            open(dst, 'wb').write(data); got += 1
        except Exception as e:
            miss += 1; print('없음:', folder, sid, e)
print('Z-A 메가 그림: 받음', got, '없음', miss)
