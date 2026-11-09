#!/bin/bash
# 앱 화면 자동 업데이트(OtaCore) 시험: bash battle-kr/android/ota-test/run.sh  (먼저 node battle-kr/build.mjs)
set -e
HERE=$(cd "$(dirname "$0")" && pwd); APP=$(cd "$HERE/../.." && pwd)
W=$(mktemp -d); trap 'kill $SRV $SRV2 2>/dev/null; rm -rf "$W"' EXIT
cp -r "$APP/dist" "$W/cur"                                   # 지금 화면 (앱 안)
cp -r "$APP/dist" "$W/new"; echo "<!-- 새 버전 -->" >> "$W/new/index.html"   # 새 화면: index.html 만 바뀜
cp -r "$W/new" "$W/bad"
node -e "
const fs=require('fs'),c=require('crypto'),d=process.argv[1],m=JSON.parse(fs.readFileSync(d+'/version.json'));
const [a,b,c2]=m.version.split('.').map(Number); m.version=a+'.'+(b+1)+'.0';
for(const f of m.files){const x=fs.readFileSync(d+'/'+f.p); f.s=x.length; f.h=c.createHash('sha256').update(x).digest('hex');}
fs.writeFileSync(d+'/version.json',JSON.stringify(m)); fs.writeFileSync(process.argv[2]+'/version.json',JSON.stringify(m));" "$W/new" "$W/bad"
echo "<!-- 중간에 바뀐 내용 -->" >> "$W/bad/index.html"          # 목록과 다른 파일
(cd "$W/new" && exec python3 -m http.server 8765 --bind 127.0.0.1 >"$W/new.log" 2>&1) & SRV=$!
(cd "$W/bad" && exec python3 -m http.server 8766 --bind 127.0.0.1 >/dev/null 2>&1) & SRV2=$!
sleep 1
mkdir -p "$W/classes"
javac -encoding UTF-8 -d "$W/classes" "$APP/android/app/src/main/java/kr/battlesim/app/OtaCore.java" "$HERE/OtaTest.java"
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -cp "$W/classes" OtaTest "$W/cur" "$W/root/ota" http://127.0.0.1:8765/ http://127.0.0.1:8766/
echo "서버가 보낸 파일: $(grep -o 'GET /[^ ?]*' "$W/new.log" | sort | uniq -c | tr '\n' ' ')"
