/** 앱에 넣을 그림 목록 출력 (scripts/fetch-sprites.sh 가 사용)
 *  출력 형식: 한 줄에 하나씩 `종류 id` (poke = 포켓몬, trainer = 트레이너) */
import * as fs from 'fs';
import * as path from 'path';
import { RAW, spriteId } from '../src/data';
import { CLASS_SPRITES, PLAYER_SPRITES, NAMED_SPRITE } from '../src/trainer-lines';
import { EXTRA_NAMED } from '../src/trainer-lore';

const out = new Set<string>();
for (const id in RAW.species) {
	out.add('poke ' + spriteId(id));
	if (RAW.species[id].gx) out.add('poke ' + spriteId(id) + '-gmax');
	out.add('cry ' + id);
	const base = RAW.species[id].base;
	if (base) out.add('cry ' + base);
}
// 네임드 트레이너 id (trainers.ts 는 시뮬레이터를 불러오므로 글자로 읽음)
// (관장·사천왕·챔피언 목록 BASE_NAMED 는 'export const NAMED' 보다 앞에 있으므로 파일 전체에서 찾음)
const src = fs.readFileSync(path.join(process.argv[2], 'trainers.ts'), 'utf8');
for (const m of src.matchAll(/\bT\('([a-z0-9-]+)'/g)) out.add('trainer ' + (NAMED_SPRITE[m[1]] || m[1]));
for (const e of EXTRA_NAMED) if (e.sprite) out.add('trainer ' + e.sprite);
for (const list of Object.values(CLASS_SPRITES)) for (const s of list) out.add('trainer ' + s);
// 일반 트레이너 종류 117가지 (남/여·세대별 그림)
const TC = JSON.parse(fs.readFileSync(path.join(process.argv[2], 'gen/trainer-classes.json'), 'utf8'));
for (const c of TC.classes) for (const s of [...c.sprites_m, ...c.sprites_f]) out.add('trainer ' + s);
for (const p of PLAYER_SPRITES) out.add('trainer ' + p.id);
for (const s of ['palmer', 'thorton']) out.add('trainer ' + s);
console.log([...out].join('\n'));
