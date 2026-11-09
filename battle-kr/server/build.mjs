// 서버 묶기: 앱(build.mjs)과 같은 쇼다운 shim 으로 엔진을 묶어 dist/worker.js 하나로 (wrangler 는 no_bundle)
import * as esbuild from 'esbuild';
import fs from 'fs'; import path from 'path'; import zlib from 'zlib'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), APP = path.join(HERE, '..');
const shim = { name: 'ps-shims', setup(b) {
	b.onResolve({ filter: /^(fs|node:fs)$/ }, () => ({ path: path.join(APP, 'src/ps/shims.ts') }));
	b.onResolve({ filter: /^(path|node:path)$/ }, () => ({ path: path.join(APP, 'src/ps/path.ts') }));
	b.onResolve({ filter: /^(util|node:util)$/ }, () => ({ path: path.join(APP, 'src/ps/util.ts') }));
	b.onResolve({ filter: /^(node:crypto|crypto)$/ }, () => ({ path: 'crypto', namespace: 'empty' }));
	b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: 'module.exports = globalThis.crypto;', loader: 'js' }));
	b.onResolve({ filter: /^(\.\.\/)+lib$/ }, () => ({ path: path.join(APP, 'src/ps/lib-slim.ts') }));
	b.onLoad({ filter: /[\\/]sim[\\/](dex|dex-formats|dex-text|teams|prng)\.ts$/ }, async a => ({ contents: (await fs.promises.readFile(a.path, 'utf8')).replace(/\brequire(\.resolve)?\(/g, (m, r) => `__psRequire${r || ''}(`), loader: 'ts' }));
} };
const r = await esbuild.build({
	entryPoints: [path.join(HERE, 'src/index.ts')], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
	minify: true, keepNames: true, external: ['cloudflare:workers'], conditions: ['workerd', 'worker', 'browser'],
	define: { '__dirname': '"/ps/sim"', 'process.env.NODE_ENV': '"production"', '__APP_VERSION__': '"server"' },
	loader: { '.json': 'json' }, plugins: [shim], logLevel: 'warning', legalComments: 'none', charset: 'utf8',
});
fs.mkdirSync(path.join(HERE, 'dist'), { recursive: true });
const code = r.outputFiles[0].contents;
fs.writeFileSync(path.join(HERE, 'dist/worker.js'), code);
console.log('dist/worker.js', (code.length / 1e6).toFixed(2), 'MB · gzip', (zlib.gzipSync(code).length / 1e6).toFixed(2), 'MB');
