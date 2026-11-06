/**
 * 오프라인 데이터 묶음 (그림·울음소리·기술 애니메이션)
 *  - 앱(안드로이드)에서는 설정 → '오프라인 데이터 받기' 로 zip 세 개를 받아 앱 저장소(files/offline)에 풀어 둔다 (window.BattleSimNative)
 *  - 받아 두면 그림·소리·애니메이션을 그곳에서 읽고, 없으면 인터넷(쇼다운 서버·jsDelivr)에서 받는다
 *  - `node build.mjs --full` 로 만든 묶음판은 앱 안에 들어 있어 이 기능이 필요 없다
 */
declare const __PACK_URLS__: string; // "sprites=https://…;cries=…;anims=…"
declare const __BUNDLED__: boolean; // --full 빌드: 그림 등이 앱 안에 있음

export const BUNDLED = typeof __BUNDLED__ === 'boolean' ? __BUNDLED__ : false;
export const PACK_URLS = typeof __PACK_URLS__ === 'string' ? __PACK_URLS__ : '';
export interface PackStatus { installed: boolean; path: string; bytes: number; parts: string; downloading: boolean }
export interface PackProgress { name: string; done: number; total: number; state: string }

const native = (): any => (typeof window !== 'undefined' ? (window as any).BattleSimNative : null) || null;
export const hasNative = () => !!native();

let cached: PackStatus | null = null;
export function packStatus(): PackStatus {
	if (cached) return cached;
	try { const n = native(); if (n) cached = JSON.parse(n.packStatus()); } catch { cached = null; }
	return cached || { installed: false, path: '', bytes: 0, parts: '', downloading: false };
}
export function refreshPack() { cached = null; return packStatus(); }
export function hasPart(part: 'sprites' | 'cries' | 'anims') {
	if (BUNDLED) return true;
	const st = packStatus();
	return st.installed && st.parts.split(',').includes(part);
}
/** 자료가 있는 곳의 바닥 경로 ('sprites/' 처럼 뒤에 /) — 없으면 '' */
export function partBase(part: 'sprites' | 'cries' | 'anims'): string {
	if (BUNDLED) return `${part}/`;
	const st = packStatus();
	if (st.installed && st.parts.split(',').includes(part)) return `file://${st.path}/${part}/`;
	return '';
}

const listeners = new Set<(p: PackProgress) => void>();
if (typeof window !== 'undefined') {
	(window as any).onPackProgress = (p: PackProgress) => { if (p.state === 'done' || p.state.startsWith('error')) cached = null; for (const l of listeners) l(p); };
}
export function onPackProgress(fn: (p: PackProgress) => void) { listeners.add(fn); return () => listeners.delete(fn); }
export function startPackDownload(): boolean {
	const n = native(); if (!n || !PACK_URLS) return false;
	n.downloadPack(PACK_URLS); cached = null; return true;
}
export function deletePack() { const n = native(); if (n) { n.deletePack(); cached = null; } }
/** 대략 크기 표시 */
export function fmtBytes(b: number) { return b >= 1e6 ? `${(b / 1e6).toFixed(0)}MB` : `${(b / 1e3).toFixed(0)}KB`; }
