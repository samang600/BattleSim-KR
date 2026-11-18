/** 세이브 클라우드 백업 (백업 코드 방식) — 계정 없이, 올리면 받는 12자리 코드로 다른 기기에서 불러옴.
 *  서버: server/src/index.ts 의 /backup. 리플레이(큼)와 기기에만 해당하는 값은 올리지 않고, 불러올 때도 이 기기 것을 그대로 둠 */
import { exportBackup, importBackup, inspectBackup, load, save } from './store';
import { httpUrl } from './online';

/** 올리지 않는 키: 리플레이 · 이 기기의 백업 코드 · 이 기기에 받아 둔 그림 묶음 · 온라인 대전용 기기 표식 */
/** 기기에만 해당하는 값: 파일 백업에도 넣지 않고, 불러올 때도 이 기기 것을 둠 (리플레이는 파일 백업에는 들어감) */
export const DEVICE_ONLY = ['cloud', 'ani-parts', 'online-token', 'online-active'];
const LOCAL_ONLY = ['replays', ...DEVICE_ONLY];   // online-token: 기기마다 달라야 함 (같으면 두 기기가 온라인에서 같은 사람으로 보임)
/** auto: 자동 저장 켬 · sig: 마지막으로 올리거나 불러온 세이브의 지문(그 뒤로 바뀌었는지 보는 데 씀) · skipAt: '이 기기 것 유지'를 고른 서버 세이브의 시각(같은 것을 또 묻지 않게) */
export interface CloudInfo { code: string; at: number; auto?: boolean; sig?: string; skipAt?: number }
export const cloudInfo = (): CloudInfo | null => load<CloudInfo | null>('cloud', null);
export const fmtCode = (c: string) => c.replace(/[^A-Za-z0-9]/g, '').toUpperCase().replace(/(.{4})(?=.)/g, '$1-');
export const cleanCode = (c: string) => c.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

async function call(path: string, init?: RequestInit): Promise<any> {
	let r: Response;
	try { r = await fetch(httpUrl(path), init); } catch { throw new Error('서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요'); }
	let j: any = null;
	try { j = await r.json(); } catch {}
	if (!r.ok) throw Object.assign(new Error(j?.error || `서버 오류 (${r.status})`), { status: r.status });
	return j;
}
/** 지금 세이브를 올림. 이 기기에 코드가 있으면 그 코드에 덮어쓰고, 없으면 새 코드를 받음 */
export async function cloudUpload(): Promise<CloudInfo> {
	const cur = cloudInfo(), data = exportBackup(LOCAL_ONLY);
	const post = (code?: string) => call('/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, code }) });
	let j: any;
	try { j = await post(cur?.code); }
	catch (e: any) { if (cur && e.status === 404) j = await post(); else throw e; }   // 서버에서 지워진 코드면 새로 받음
	const info: CloudInfo = { code: j.code, at: j.at, auto: cur?.auto, sig: sigOf(data) };
	save('cloud', info);
	return info;
}
/** 코드의 백업을 받아 옴 (아직 적용하지 않음) */
export async function cloudFetch(code: string): Promise<{ text: string; at: number; teams: number }> {
	const c = cleanCode(code);
	if (c.length !== 12) throw new Error('백업 코드는 12자리예요');
	const j = await call('/backup?code=' + c);
	const info = inspectBackup(j.data);
	if (!info) throw new Error('백업 내용을 읽지 못했어요');
	return { text: j.data, at: j.at, teams: info.teams };
}
/** 받아 온 백업으로 바꿈 (리플레이 등 이 기기 값은 그대로) 그리고 이 코드를 이 기기의 코드로 기억 */
export function cloudApply(code: string, text: string, at: number): boolean {
	const auto = cloudInfo()?.auto;
	if (!importBackup(text, LOCAL_ONLY)) return false;
	save('cloud', { code: cleanCode(code), at, auto, sig: sigOf(exportBackup(LOCAL_ONLY)) } as CloudInfo);
	return true;
}

// ───────── 자동 저장 ─────────
// 켜 두면: ① 앱을 켤 때(그리고 오래 쉬었다 돌아올 때) 클라우드의 세이브가 이 기기에서 마지막으로 올린 것보다 새것이면 불러올지 묻고(늘 물음 — 알아서 덮어쓰지 않음),
// ② 배틀이 끝난 뒤·몇 분마다·앱을 내릴 때, 세이브가 바뀌었으면 알아서 올림. ①의 확인이 끝나기 전에는 올리지 않음(다른 기기의 새 세이브를 모르고 덮어쓰지 않게).
/** 세이브의 지문: 올린 시각처럼 매번 달라지는 값은 빼고 내용만 */
function sigOf(backupText: string): string {
	try {
		const d = JSON.parse(backupText).data as { [k: string]: string };
		const s = Object.keys(d).sort().map(k => k + '=' + d[k]).join('\n');
		let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
		return h.toString(36) + ':' + s.length;
	} catch { return ''; }
}
/** 마지막으로 올리거나 불러온 뒤로 세이브가 바뀌었는가 */
export function cloudDirty(): boolean { const i = cloudInfo(); return !!i && sigOf(exportBackup(LOCAL_ONLY)) !== i.sig; }
export function setCloudAuto(on: boolean) { const i = cloudInfo(); if (i) save('cloud', { ...i, auto: on }); if (on) { checked = false; void cloudAutoCheck(); } }
export interface CloudUi { ask: (title: string, msg: string, ok: string, cancel: string) => Promise<boolean>; toast: (msg: string) => void; /** 지금 물어봐도 되는가 (배틀 중에는 묻지 않음) */ idle: () => boolean }
const AUTO_GAP = 5 * 60_000, CHECK_GAP = 10 * 60_000;
let ui: CloudUi | null = null, checked = false, checking = false, saving = false, lastSave = 0, lastCheck = 0;
/** 지금 자동 저장이 어떤 상태인지 (설정 화면 표시용) */
export const cloudAutoState = () => ({ checked, saving });
/** 클라우드의 세이브가 더 새것인지 확인하고, 그렇다면 불러올지 물음 */
export async function cloudAutoCheck(): Promise<void> {
	const info = cloudInfo();
	if (!info?.auto || !ui || checking) return;
	if (!ui.idle()) return;
	checking = true; lastCheck = Date.now();
	try {
		const j = await call('/backup?code=' + info.code);
		if (j.at > info.at && j.at !== info.skipAt && inspectBackup(j.data)) {
			const mine = cloudDirty();
			const yes = await ui.ask('클라우드에 더 새로운 세이브가 있어요',
				`${new Date(j.at).toLocaleString('ko-KR')}에 다른 기기에서 올린 세이브입니다.\n${mine ? '이 기기에도 아직 올리지 않은 진행이 있어요 — 불러오면 그 진행은 사라집니다.\n' : ''}불러올까요?\n(「이 기기 것 유지」를 고르면 다음 자동 저장 때 이 기기의 세이브가 클라우드를 덮어씁니다.)`, '불러오기', '이 기기 것 유지');
			if (yes) { if (cloudApply(info.code, j.data, j.at)) { ui.toast('불러왔습니다. 다시 시작합니다…'); setTimeout(() => location.reload(), 600); return; } ui.toast('불러오지 못했습니다.'); }
			else save('cloud', { ...cloudInfo()!, skipAt: j.at });
		}
		checked = true;
	} catch (e: any) {
		if (e?.status === 404) checked = true;   // 서버에서 지워진 코드: 다음에 올릴 때 새 코드를 받음
		// 그 밖(오프라인 등)은 확인 못 함 → 이번에는 올리지 않고 다음 기회에 다시 확인
	} finally { checking = false; }
}
/** 바뀐 세이브를 올림 (자동 저장이 켜져 있고, 새 세이브 확인이 끝났고, 마지막으로 올린 지 5분이 지났을 때). force: 앱을 내릴 때처럼 간격을 보지 않음 */
export async function cloudAutoSave(force = false): Promise<void> {
	const info = cloudInfo();
	if (!info?.auto || saving) return;
	if (!checked) { void cloudAutoCheck(); return; }
	if (!force && Date.now() - lastSave < AUTO_GAP) return;
	if (!cloudDirty()) return;
	saving = true; lastSave = Date.now();
	try { const before = info.code; const r = await cloudUpload(); if (r.code !== before) ui?.toast(`클라우드 백업 코드가 새로 바뀌었어요: ${fmtCode(r.code)}`); } catch { /* 다음 기회에 다시 */ } finally { saving = false; }
}
/** 앱을 켤 때 한 번: 화면 쪽 함수(묻기·알림)를 받아 두고, 확인·주기 저장·앱을 내릴 때 저장을 걸어 둠 */
export function cloudAutoInit(u: CloudUi) {
	if (ui) { ui = u; return; }
	ui = u;
	setTimeout(() => void cloudAutoCheck(), 1500);
	setInterval(() => { void cloudAutoSave(); }, 60_000);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') void cloudAutoSave(true);
		else if (Date.now() - lastCheck > CHECK_GAP) { checked = false; void cloudAutoCheck(); }
	});
}
