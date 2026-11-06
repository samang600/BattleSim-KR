#!/usr/bin/env python3
"""public/sprites·cries·anims 를 offline/*.zip 으로 묶는다 (앱의 설정 → 오프라인 데이터 받기가 저장소에서 받아 감)."""
import os, zipfile
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.join(here, '..')
os.makedirs(os.path.join(root, 'offline'), exist_ok=True)
for name in ['sprites', 'cries', 'anims']:
    src = os.path.join(root, 'public', name); out = os.path.join(root, 'offline', name + '.zip')
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for d, _, files in os.walk(src):
            for f in files:
                p = os.path.join(d, f); z.write(p, os.path.relpath(p, src))
    print(name, os.path.getsize(out) // 1024 // 1024, 'MB')
