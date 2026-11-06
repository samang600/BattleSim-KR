/** node:util 의 isDeepStrictEqual 대체 (단순 구조 비교) */
export function isDeepStrictEqual(a: any, b: any): boolean {
	if (a === b) return true;
	if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return Number.isNaN(a) && Number.isNaN(b);
	if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
	if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => isDeepStrictEqual(v, b[i]));
	const ka = Object.keys(a), kb = Object.keys(b);
	if (ka.length !== kb.length) return false;
	return ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && isDeepStrictEqual(a[k], b[k]));
}
