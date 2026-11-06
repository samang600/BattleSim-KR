/** 한국어 조사 처리 (받침 유무에 따라 은/는, 이/가, 을/를, 와/과, 으로/로) */

// 한글이 아닌 끝 글자의 받침 여부 (읽는 소리 기준)
const LATIN_FINAL: { [c: string]: boolean } = {
	a: false, b: false, c: false, d: false, e: false, f: false, g: false, h: false, i: false, j: false, k: false,
	l: true, m: true, n: true, o: false, p: false, q: false, r: false, s: false, t: false, u: false, v: false,
	w: false, x: false, y: false, z: false,
};
// 숫자 읽기: 영(o) 일(o) 이(x) 삼(o) 사(x) 오(x) 육(o) 칠(o) 팔(o) 구(x)
const DIGIT_FINAL = [true, true, false, true, false, false, true, true, true, false];
// 숫자 받침이 ㄹ 인지 (일, 칠, 팔)
const DIGIT_RIEUL = [false, true, false, false, false, false, false, true, true, false];

function lastInfo(word: string): { final: boolean; rieul: boolean } {
	// "켄타로스(팔데아)" → 괄호 앞 단어 기준
	const s = word.replace(/\s*[(（][^()（）]*[)）]\s*$/, '').replace(/[\s)\]）」』!?.·…'"*]+$/g, '');
	const ch = s.charAt(s.length - 1);
	if (!ch) return { final: false, rieul: false };
	const code = ch.charCodeAt(0);
	if (code >= 0xAC00 && code <= 0xD7A3) {
		const jong = (code - 0xAC00) % 28;
		return { final: jong !== 0, rieul: jong === 8 };
	}
	if (/[0-9]/.test(ch)) return { final: DIGIT_FINAL[+ch], rieul: DIGIT_RIEUL[+ch] };
	const lower = ch.toLowerCase();
	if (lower in LATIN_FINAL) return { final: LATIN_FINAL[lower], rieul: lower === 'l' };
	return { final: false, rieul: false };
}

export function josa(word: string, kind: string): string {
	const { final, rieul } = lastInfo(word);
	switch (kind) {
	case 'topic': return word + (final ? '은' : '는');
	case 'subject': return word + (final ? '이' : '가');
	case 'object': return word + (final ? '을' : '를');
	case 'conjunctive': return word + (final ? '과' : '와');
	case 'directional': return word + (final && !rieul ? '으로' : '로');
	case 'vocative': return word + (final ? '아' : '야');
	default: return word;
	}
}

/** "이상해씨(은)는" 같은 템플릿 대신 josa(word,'topic') 을 쓰기 쉽게 */
export const 은는 = (w: string) => josa(w, 'topic');
export const 이가 = (w: string) => josa(w, 'subject');
export const 을를 = (w: string) => josa(w, 'object');
export const 와과 = (w: string) => josa(w, 'conjunctive');
export const 으로 = (w: string) => josa(w, 'directional');
