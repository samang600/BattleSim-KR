/** 포켓몬 그림 묶음: 원본 추출(한 마리·전체), 내 그림 내보내기, zip/여러 파일 일괄 적용
 *  zip 안 구조(오프라인 그림 묶음과 같음): gen5/<그림 id>.png · gen5-back/ · gen5-shiny/ · gen5-back-shiny/
 *  일괄 적용은 위 구조 또는 '<그림 id>[-back][-shiny].png' 파일 이름(폴더 없이)도 받음 */
import { readZip, writeZip, type ZipEntry } from './zip';
import { PACK_URLS } from './offline';
import { CUSTOM_SPRITES } from './ui/core';
import { RAW, spriteId } from './data';
import { listUserSprites, getUserSprite, makeUserSprite, putUserSprites, userSpriteKey, type UserSprite } from './user-sprites';

const DIRS: [string, boolean, boolean][] = [['gen5', false, false], ['gen5-back', true, false], ['gen5-shiny', false, true], ['gen5-back-shiny', true, true]];
const pathOf = (key: string) => { const back = key.includes('-back'), shiny = key.endsWith('-shiny'); const id = key.replace(/-back|-shiny/g, ''); return `${DIRS.find(d => d[1] === back && d[2] === shiny)![0]}/${id}.png`; };
/** zip 경로·파일 이름 → 그림 키 ('pikachu-back-shiny'), 모르는 형식이면 null */
export function keyOfPath(name: string): string | null {
	const base = name.split('/').pop()!.toLowerCase();
	if (!/\.(png|gif|webp)$/.test(base)) return null;
	const stem = base.replace(/\.(png|gif|webp)$/, '');
	const dir = name.split('/').slice(-2, -1)[0]?.toLowerCase() || '';
	const d = DIRS.find(x => x[0] === dir);
	if (d) return userSpriteKey(stem, d[1], d[2]);
	const m = /^(.+?)(-back)?(-shiny)?$/.exec(stem)!;
	return userSpriteKey(m[1], !!m[2], !!m[3]);
}
const known = (() => { let s: Set<string> | null = null; return () => (s ||= new Set(Object.keys(RAW.species).map(spriteId))); })();

function dataUrlBytes(u: string): Uint8Array {
	const b = atob(u.slice(u.indexOf(',') + 1)); const out = new Uint8Array(b.length);
	for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
	return out;
}

/** 원본 그림 묶음: 앱 오프라인 묶음(sprites.zip, GitHub) + 앱에 넣은 그림(9세대 뒷모습 등)을 덮음. 한 번 받으면 기억 */
let packP: Promise<Map<string, Uint8Array>> | null = null;
export function originalPack(onProgress?: (msg: string) => void): Promise<Map<string, Uint8Array>> {
	return packP ||= (async () => {
		const url = /(?:^|;)sprites=([^;]+)/.exec(PACK_URLS)?.[1];
		if (!url) throw new Error('원본 그림 묶음 주소가 없습니다');
		onProgress?.('원본 그림 묶음 받는 중… (약 6MB)');
		const r = await fetch(url); if (!r.ok) throw new Error('원본 그림 묶음을 받지 못했습니다 (' + r.status + ')');
		const files = await readZip(await r.arrayBuffer(), n => /^gen5(-back)?(-shiny)?\/[^/]+\.png$/.test(n));
		const m = new Map<string, Uint8Array>(files.map(f => [f.name, f.data]));
		for (const [k, u] of Object.entries(CUSTOM_SPRITES)) if (u.startsWith('data:image/png')) m.set(pathOf(k), dataUrlBytes(u));
		return m;
	})().catch(e => { packP = null; throw e; });
}

/** 파일로 저장: 안드로이드 앱은 저장 위치 고르기, 웹은 내려받기 */
export async function saveBlob(name: string, blob: Blob): Promise<void> {
	const nat = (window as any).BattleSimNative;
	if (nat?.saveFile) {
		const b64 = await new Promise<string>(ok => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1] || ''); fr.readAsDataURL(blob); });
		await new Promise<void>((ok, no) => { (window as any).__fileSaved = (st: string) => st === 'ok' ? ok() : st === 'cancel' ? ok() : no(new Error('저장하지 못했습니다')); nat.saveFile(name, blob.type || 'application/octet-stream', b64); });
		return;
	}
	const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
	document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

/** 한 마리 원본 (앞·뒤·색이 다른 모습) zip */
export async function exportOriginalOne(sid: string, onProgress?: (m: string) => void) {
	const m = await originalPack(onProgress);
	const files: ZipEntry[] = DIRS.map(([d]) => ({ name: `${d}/${sid}.png`, data: m.get(`${d}/${sid}.png`)! })).filter(f => f.data);
	if (!files.length) throw new Error('원본 그림이 없습니다');
	await saveBlob(`${sid}-원본.zip`, writeZip(files));
	return files.length;
}
/** 전체 원본 zip */
export async function exportOriginalAll(onProgress?: (m: string) => void) {
	const m = await originalPack(onProgress);
	onProgress?.(`zip 만드는 중… (${m.size}장)`);
	await saveBlob('배틀시뮬-포켓몬그림-원본.zip', writeZip([...m].sort(([a], [b]) => a.localeCompare(b)).map(([name, data]) => ({ name, data }))));
	return m.size;
}
/** 내가 바꾼 그림 zip (같은 구조 — 그대로 다시 적용할 수 있음) */
export async function exportMine() {
	const keys = listUserSprites();
	if (!keys.length) throw new Error('바꾼 그림이 없습니다');
	await saveBlob('배틀시뮬-내포켓몬그림.zip', writeZip(keys.sort().map(k => ({ name: pathOf(k), data: dataUrlBytes(getUserSprite(k)!.src) }))));
	return keys.length;
}

/** 일괄 적용: zip 이나 그림 파일 여러 장. 반환: [적용 수, 건너뛴 이름들] */
export async function importFiles(files: File[], onProgress?: (m: string) => void): Promise<[number, string[]]> {
	const items: { key: string; blob: Blob }[] = [], skipped: string[] = [];
	for (const f of files) {
		if (/\.zip$/i.test(f.name) || f.type.includes('zip')) {
			onProgress?.(`${f.name} 여는 중…`);
			for (const e of await readZip(await f.arrayBuffer(), n => !!keyOfPath(n))) items.push({ key: keyOfPath(e.name)!, blob: new Blob([e.data as BlobPart]) });
		} else { const k = keyOfPath(f.name); if (k) items.push({ key: k, blob: f }); else skipped.push(f.name); }
	}
	const out: { [k: string]: UserSprite } = {};
	let i = 0;
	for (const it of items) {
		if (!known().has(it.key.replace(/-back|-shiny/g, ''))) { skipped.push(it.key); continue; }
		if (++i % 40 === 0) onProgress?.(`적용 중… ${i}/${items.length}`);
		try { out[it.key] = await makeUserSprite(it.blob); } catch { skipped.push(it.key); }
	}
	if (Object.keys(out).length) await putUserSprites(out);
	return [Object.keys(out).length, skipped];
}
