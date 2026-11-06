/** 최소한의 posix path 구현 */
function norm(parts: string[]) {
	const out: string[] = [];
	for (const part of parts) {
		if (!part || part === '.') continue;
		if (part === '..') out.pop();
		else out.push(part);
	}
	return '/' + out.join('/');
}
export function resolve(...segs: string[]) {
	let acc: string[] = [];
	for (const s of segs) {
		if (s.startsWith('/')) acc = [];
		acc.push(...s.split('/'));
	}
	return norm(acc);
}
export function join(...segs: string[]) { return norm(segs.join('/').split('/')); }
export function dirname(p: string) { return norm(p.split('/').slice(0, -1)); }
export function basename(p: string) { return p.split('/').pop() || ''; }
export const sep = '/';
export default { resolve, join, dirname, basename, sep };
