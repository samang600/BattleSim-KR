#!/usr/bin/env node
/**
 * 포켓몬 배틀 시뮬레이터(한글) 빌드
 *
 *   node battle-kr/build.mjs          → battle-kr/dist/ (index.html 한 파일에 모두 포함)
 *   node battle-kr/build.mjs --android → 안드로이드 assets 에도 복사
 *
 * 먼저 저장소 루트에서 `npm install` · `node build` · `node battle-kr/scripts/gen-data.cjs` 필요.
 */
import { execSync } from 'child_process';
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'dist');
const args = new Set(process.argv.slice(2));
const dev = args.has('--dev');

const shimPlugin = {
	name: 'ps-browser-shims',
	setup(build) {
		build.onResolve({ filter: /^(fs|node:fs)$/ }, () => ({ path: path.join(HERE, 'src/ps/shims.ts') }));
		build.onResolve({ filter: /^(path|node:path)$/ }, () => ({ path: path.join(HERE, 'src/ps/path.ts') }));
		build.onResolve({ filter: /^(util|node:util)$/ }, () => ({ path: path.join(HERE, 'src/ps/util.ts') }));
		build.onResolve({ filter: /^(node:crypto|crypto)$/ }, () => ({ path: 'crypto', namespace: 'empty' }));
		build.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: 'module.exports = globalThis.crypto;', loader: 'js' }));
		// lib/index 는 서버용 모듈(fs·sql 등)까지 끌어오므로 utils 만 쓰도록
		build.onResolve({ filter: /^(\.\.\/)+lib$/ }, () => ({ path: path.join(HERE, 'src/ps/lib-slim.ts') }));
		// 시뮬레이터의 동적 require 는 런타임 레지스트리(__psRequire)로 돌린다
		build.onLoad({ filter: /[\\/]sim[\\/](dex|dex-formats|dex-text|teams|prng)\.ts$/ }, async args => {
			const src = await fs.promises.readFile(args.path, 'utf8');
			return { contents: src.replace(/\brequire(\.resolve)?\(/g, (m, r) => `__psRequire${r || ''}(`), loader: 'ts' };
		});
	},
};

if (!args.has('--test')) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const lite = !args.has('--full'); // 기본은 저용량판(그림·울음소리·애니메이션은 인터넷 또는 설정에서 받은 오프라인 묶음), --full 이면 앱에 포함
// 저용량판: 그림·울음소리·애니메이션을 앱에 넣지 않고 인터넷에서 받음 (애니메이션은 jsDelivr 의 저장소 파일)
// 저장소 주소: GH_REPO 환경변수(예: myname/battlesim-kr) → git origin 주소 → 기본값 순서로 정함 (새 저장소로 옮겨도 그대로 동작)
const git = (cmd, fb) => { try { return execSync(cmd, { cwd: path.join(HERE, '..'), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fb; } catch { return fb; } };
const REPO = process.env.GH_REPO || (git('git remote get-url origin', '').match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/) || [])[1] || 'samang600/BattleSim-KR';
const APP_DIR = fs.existsSync(path.join(HERE, '..', 'sim')) && path.basename(HERE) === 'battle-kr' ? 'battle-kr/' : '';
const animCommit = git(`git log -1 --format=%H -- ${APP_DIR}public/anims`, 'main');
const ANIM_BASE = `https://cdn.jsdelivr.net/gh/${REPO}@${animCommit}/${APP_DIR}public/anims/`;
// 오프라인 묶음 zip (battle-kr/offline/*.zip, 저장소의 현재 브랜치에서 받음)
const branch = process.env.PACK_BRANCH || git('git rev-parse --abbrev-ref HEAD', 'main');
const PACK_URLS = ['sprites', 'cries', 'anims'].map(n => `${n}=https://raw.githubusercontent.com/${REPO}/${branch}/${APP_DIR}offline/${n}.zip`).join(';');
console.log('저장소', REPO, '·', branch);
// 직접 만든 그림 (src/sprites-custom/<id>[-shiny].png) — 서버 그림 대신 항상 이것을 씀
const customDir = path.join(HERE, 'src/sprites-custom');
const CUSTOM_SPRITES = Object.fromEntries(fs.existsSync(customDir) ? fs.readdirSync(customDir).filter(f => f.endsWith('.png')).map(f => [f.slice(0, -4), 'data:image/png;base64,' + fs.readFileSync(path.join(customDir, f)).toString('base64')]) : []);
const result = await esbuild.build({
	entryPoints: [path.join(HERE, args.has('--test') ? 'test/selfplay.ts' : 'src/main.tsx')],
	bundle: true,
	write: false,
	format: 'iife',
	platform: 'browser',
	target: ['es2020', 'chrome80', 'safari14'],
	minify: !dev,
	keepNames: true, // 상태 복제(sim/state)가 클래스 이름을 씀
	sourcemap: false,
	define: { '__dirname': '"/ps/sim"', 'process.env.NODE_ENV': '"production"',
		// 앱 안에 들어 있는 울음소리 목록 (public/cries, scripts/fetch-sprites.sh)
		'__LITE__': String(lite), '__BUNDLED__': String(!lite), '__ANIM_BASE__': JSON.stringify(ANIM_BASE), '__PACK_URLS__': JSON.stringify(PACK_URLS), '__CUSTOM_SPRITES__': JSON.stringify(CUSTOM_SPRITES), '__BGM_LOOPS__': '{}',
		'__LOCAL_CRIES__': JSON.stringify(fs.existsSync(path.join(HERE, 'public/cries')) ? fs.readdirSync(path.join(HERE, 'public/cries')).filter(f => f.endsWith('.mp3')).map(f => f.slice(0, -4)).join(',') : '') },
	jsx: 'automatic',
	jsxImportSource: 'preact',
	loader: { '.json': 'json' },
	plugins: [shimPlugin],
	logLevel: 'warning',
	legalComments: 'none',
	charset: 'utf8',
});

const js = result.outputFiles[0].text;
const css = fs.readFileSync(path.join(HERE, 'src/style.css'), 'utf8')
	.replace(/__IMG_(\w+)__/g, (_m, name) => 'data:image/png;base64,' + fs.readFileSync(path.join(HERE, 'src/ui-assets', name + '.png')).toString('base64'))
	.replace(/__FONT_(\w+)__/g, (_m, name) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(HERE, 'src/fonts', name + '.woff2')).toString('base64'));
const template = fs.readFileSync(path.join(HERE, 'src/index.html'), 'utf8');
const html = template
	.replace('/*__CSS__*/', () => css)
	.replace('/*__JS__*/', () => js.replace(/<\/script/gi, '<\\/script'));
if (args.has('--test')) { fs.writeFileSync(path.join(HERE, 'test/selfplay.html'), html); console.log('test/selfplay.html'); process.exit(0); }
fs.writeFileSync(path.join(OUT, 'index.html'), html);
if (!fs.existsSync(path.join(HERE, 'public/sprites/gen5'))) console.warn('⚠ public/sprites 가 없습니다 — 오프라인 그림을 넣으려면 먼저 `bash battle-kr/scripts/fetch-sprites.sh`');
// 관현악 배경음악(public/bgm mp3)은 빼고 칩튠판만 씀 → 앱에 넣지 않음
fs.cpSync(path.join(HERE, 'public'), OUT, { recursive: true, filter: src => !/[\\/]public[\\/]bgm(?:[\\/]|$)/.test(src) && (!lite || !/[\\/]public[\\/](sprites|cries|anims)(?:[\\/]|$)/.test(src)) });
console.log(`battle-kr/dist/index.html ${(html.length / 1024 / 1024).toFixed(2)} MB`);

if (args.has('--android')) {
	const assets = path.join(HERE, 'android/app/src/main/assets/www');
	fs.rmSync(assets, { recursive: true, force: true });
	fs.mkdirSync(assets, { recursive: true });
	fs.cpSync(OUT, assets, { recursive: true });
	console.log(`→ ${path.relative(HERE, assets)} 에 복사`);
}
