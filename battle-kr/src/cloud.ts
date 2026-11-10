/** 세이브 클라우드 백업 (백업 코드 방식) — 계정 없이, 올리면 받는 12자리 코드로 다른 기기에서 불러옴.
 *  서버: server/src/index.ts 의 /backup. 리플레이(큼)와 기기에만 해당하는 값은 올리지 않고, 불러올 때도 이 기기 것을 그대로 둠 */
import { exportBackup, importBackup, inspectBackup, load, save, remove } from './store';
import { httpUrl } from './online';

/** 올리지 않는 키: 리플레이 · 이 기기의 백업 코드 · 이 기기에 받아 둔 그림 묶음 */
const LOCAL_ONLY = ['replays', 'cloud', 'ani-parts'];
export interface CloudInfo { code: string; at: number }
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
	const info = { code: j.code, at: j.at };
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
	if (!importBackup(text, LOCAL_ONLY)) return false;
	save('cloud', { code: cleanCode(code), at });
	return true;
}
export const cloudForget = () => remove('cloud');
