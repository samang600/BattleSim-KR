/** 시나리오 모드용 레벨업 데이터: 포켓몬마다 진화(다음 모습·레벨)와 레벨업으로 배우는 기술
 *  → src/gen/levelup.json  { id: { e?: [다음 id, 레벨], m: [[레벨, 기술 id], ...] } }
 *  레벨업 기술은 그 포켓몬에게 레벨업 기록이 있는 가장 최근 세대 것. 지금은 1세대 도감(1~151)만 (시안)
 *  사용: node scripts/gen-levelup.cjs  (저장소 루트에서 `node build` 없이 esbuild 로 데이터만 읽음) */
const esbuild = require('esbuild'), path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const r = esbuild.buildSync({ stdin: { contents: `export { Pokedex } from './data/pokedex'; export { Learnsets } from './data/learnsets';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node', logLevel: 'error' });
const m = { exports: {} }; new Function('module', 'exports', 'require', r.outputFiles[0].text)(m, m.exports, require);
const { Pokedex, Learnsets } = m.exports;
const toID = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
/** 원작에서 통신교환으로 진화하는 포켓몬: 이 레벨에 진화 (교환 상대가 없으므로) */
const TRADE_LV = { alakazam: 36, machamp: 38, golem: 38, gengar: 38 };
const out = {};
for (const [id, p] of Object.entries(Pokedex)) {
	if (!(p.num >= 1 && p.num <= 151) || p.forme) continue;
	const ls = Learnsets[id]?.learnset || {};
	let best = 0; const byGen = {};
	for (const [mv, src] of Object.entries(ls)) for (const s of src) { const k = /^(\d)L(\d+)$/.exec(s); if (k) { (byGen[k[1]] ||= []).push([+k[2], mv]); best = Math.max(best, +k[1]); } }
	const moves = (byGen[best] || []).sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1));
	// 진화: 레벨업은 e: [다음, 레벨] · 도구(진화의 돌)는 s: [[다음, 도구 id], ...] · 통신교환은 레벨업으로 바꿈(TRADE_LV)
	const evos = (p.evos || []).map(toID).map(n => [n, Pokedex[n]]).filter(([, q]) => q && q.num <= 151 && !q.forme);
	const lv = evos.find(([, q]) => q.evoLevel) || evos.find(([, q]) => q.evoType === 'trade');
	const stones = evos.filter(([, q]) => q.evoType === 'useItem' && q.evoItem).map(([n, q]) => [n, toID(q.evoItem)]);
	const odd = evos.filter(([, q]) => !q.evoLevel && q.evoType !== 'trade' && !(q.evoType === 'useItem' && q.evoItem));
	if (odd.length) console.log('  확인 필요:', id, '→', odd.map(([n, q]) => n + ' ' + q.evoType + ' ' + (q.evoCondition || '')).join(', '));
	out[id] = { ...(lv ? { e: [lv[0], lv[1].evoLevel || TRADE_LV[lv[0]] || 36] } : {}), ...(stones.length ? { s: stones } : {}), m: moves };
}
fs.writeFileSync(path.join(__dirname, '..', 'src', 'gen', 'levelup.json'), JSON.stringify(out));
console.log('levelup', Object.keys(out).length, 'species', (JSON.stringify(out).length / 1024).toFixed(0) + 'KB');
