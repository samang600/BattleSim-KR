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
export function deletePack() { const n = native(); if (n) { n.deletePack(); cached = null; forgetAni(); } }
// ── 움직이는 도트 그림 묶음 (앱에서 따로 받기) ──
// 앱의 downloadPack 은 이름마다 files/offline/<이름>/ 에 풀어 둔다. packStatus 는 그림·울음소리·애니메이션만 알려 주므로
// 받아 둔 묶음은 여기서 기억한다(localStorage) — 앱(APK)을 새로 깔지 않아도 화면 업데이트만으로 동작
export const ANI_PARTS = ['anifront', 'aniback', 'anifrontshiny', 'anibackshiny'] as const;
export type AniPart = typeof ANI_PARTS[number];
const ANI_ZIP = 'https://raw.githubusercontent.com/samang600/BattleSim-KR/sprites-ani/zip/';
const ANI_KEY = 'pkbkr:ani-parts';
let aniHave: Set<string> | null = null;
function aniSet(): Set<string> {
	if (!aniHave) { try { aniHave = new Set((localStorage.getItem(ANI_KEY) || '').split(',').filter(Boolean)); } catch { aniHave = new Set(); } }
	return aniHave;
}
function aniSave() { try { localStorage.setItem(ANI_KEY, [...aniSet()].join(',')); } catch {} }
export const aniInstalled = (): string[] => hasNative() ? ANI_PARTS.filter(p => aniSet().has(p)) : [];
/** 받아 둔 움직이는 도트 폴더 ('file://…/anifront/') — 없으면 '' */
export function aniLocalBase(back: boolean, shiny: boolean): string {
	if (!hasNative()) return '';
	const part = 'ani' + (back ? 'back' : 'front') + (shiny ? 'shiny' : '');
	if (!aniSet().has(part)) return '';
	const path = packStatus().path;
	return path ? `file://${path}/${part}/` : '';
}
/** 묶음 받기: shiny = 이로치 묶음 (앞·뒤 한 번에) */
export function startAniDownload(shiny: boolean): boolean {
	const n = native(); if (!n) return false;
	const parts = shiny ? ['anifrontshiny', 'anibackshiny'] : ['anifront', 'aniback'];
	n.downloadPack(parts.map(p => `${p}=${ANI_ZIP}${p}.zip`).join(';')); cached = null; return true;
}
if (typeof window !== 'undefined') {
	onPackProgress(p => { if (p.state === 'done' && (ANI_PARTS as readonly string[]).includes(p.name)) { aniSet().add(p.name); aniSave(); } });
	// 시작할 때 확인: 기억한 묶음의 그림이 실제로 열리는지 (오프라인 데이터 삭제·앱 데이터 지움 뒤에는 기억을 지움)
	try {
		for (const part of aniInstalled()) {
			const im = new Image();
			im.onerror = () => { aniSet().delete(part); aniSave(); };
			im.src = `file://${packStatus().path}/${part}/pikachu.webp`;
		}
	} catch {}
}
/** 오프라인 데이터를 지우면 움직이는 도트 묶음도 함께 지워짐 (앱이 폴더째 지움) */
export function forgetAni() { aniSet().clear(); aniSave(); }
/** 대략 크기 표시 */
export function fmtBytes(b: number) { return b >= 1e6 ? `${(b / 1e6).toFixed(0)}MB` : `${(b / 1e3).toFixed(0)}KB`; }
