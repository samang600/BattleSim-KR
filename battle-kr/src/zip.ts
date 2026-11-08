/** 아주 작은 zip 읽기·쓰기 (그림 묶음 추출·적용용)
 *  읽기: 저장(0)·deflate(8) 방식 (deflate 는 브라우저 DecompressionStream('deflate-raw'))
 *  쓰기: 압축 없이 저장 (PNG 는 이미 압축돼 있어 크기 차이가 거의 없음) */

export interface ZipEntry { name: string; data: Uint8Array }

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
	const DS = (globalThis as any).DecompressionStream;
	if (!DS) throw new Error('이 브라우저는 압축된 zip 을 풀 수 없습니다 (압축 없이 저장한 zip 을 써 주세요)');
	const s = new Blob([data]).stream().pipeThrough(new DS('deflate-raw'));
	return new Uint8Array(await new Response(s).arrayBuffer());
}

/** zip 안의 파일들 (filter 로 고른 것만 풂) */
export async function readZip(buf: ArrayBuffer, filter: (name: string) => boolean = () => true): Promise<ZipEntry[]> {
	const b = new Uint8Array(buf);
	// 끝에서 중앙 디렉터리 끝 표시(0x06054b50) 찾기
	let eocd = -1;
	for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
	if (eocd < 0) throw new Error('zip 파일이 아닙니다');
	const count = u16(b, eocd + 10);
	let p = u32(b, eocd + 16);
	const out: ZipEntry[] = [];
	const dec = new TextDecoder();
	for (let k = 0; k < count; k++) {
		if (u32(b, p) !== 0x02014b50) break;
		const method = u16(b, p + 10), csize = u32(b, p + 20), nlen = u16(b, p + 28), elen = u16(b, p + 30), clen = u16(b, p + 32), lho = u32(b, p + 42);
		const name = dec.decode(b.subarray(p + 46, p + 46 + nlen));
		p += 46 + nlen + elen + clen;
		if (name.endsWith('/') || !filter(name)) continue;
		const start = lho + 30 + u16(b, lho + 26) + u16(b, lho + 28);
		const raw = b.subarray(start, start + csize);
		if (method === 0) out.push({ name, data: raw.slice() });
		else if (method === 8) out.push({ name, data: await inflateRaw(raw) });
	}
	return out;
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(d: Uint8Array) { let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/** 압축 없는 zip 만들기 */
export function writeZip(files: ZipEntry[]): Blob {
	const enc = new TextEncoder();
	const parts: Uint8Array[] = [], central: Uint8Array[] = [];
	let off = 0;
	for (const f of files) {
		const nm = enc.encode(f.name), crc = crc32(f.data), n = f.data.length;
		const lh = new Uint8Array(30 + nm.length), lv = new DataView(lh.buffer);
		lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint32(14, crc, true); lv.setUint32(18, n, true); lv.setUint32(22, n, true); lv.setUint16(26, nm.length, true);
		lh.set(nm, 30);
		const ch = new Uint8Array(46 + nm.length), cv = new DataView(ch.buffer);
		cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint32(16, crc, true); cv.setUint32(20, n, true); cv.setUint32(24, n, true); cv.setUint16(28, nm.length, true); cv.setUint32(42, off, true);
		ch.set(nm, 46);
		parts.push(lh, f.data); central.push(ch);
		off += lh.length + n;
	}
	const csize = central.reduce((a, c) => a + c.length, 0);
	const end = new Uint8Array(22), ev = new DataView(end.buffer);
	ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, csize, true); ev.setUint32(16, off, true);
	return new Blob([...parts, ...central, end] as BlobPart[], { type: 'application/zip' });
}
