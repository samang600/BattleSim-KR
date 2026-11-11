// 시나리오 대화의 감정 이모티콘 — pixelfx(MIT, src/vendor/pixelfx) 의 그리기 도구로 새로 만든 효과 8개.
// pixelfx 효과 모듈과 같은 모양({ meta, draw(p, t, o) })이라 createFx 로 돌림. 44×44 칸, 가운데가 원점, 반복 재생.
// 모양: 귀여운 말풍선(둥근 흰 상자 + 꼬리, 살짝 통통 튐) 안에 얼굴 윤곽 없이 눈·입만 있는 간단한 표정
import { hex, TAU } from './vendor/pixelfx/core/index.js';
export { createFrame, clearFrame, createFx, composite } from './vendor/pixelfx/core/index.js';

const INK = hex('#4a3040'), LINE = hex('#6a4a5a'), W = hex('#ffffff'), SHADE = hex('#ffe4ee');
const PINK = hex('#ff8ab0'), RED = hex('#f04a5a'), DRED = hex('#b82a3a'), BLUE = hex('#4aa8f0'), LBLUE = hex('#b8e0ff'), GOLD = hex('#ffc83a'), YEL = hex('#fff0a0');
const P = { '#': INK, r: RED, d: DRED, w: W, p: PINK, b: BLUE, l: LBLUE, g: GOLD, y: YEL };
const meta = (name, duration) => ({ name, size: [44, 44], origin: [22, 21], duration, loop: true, fps: 20, options: {} });
const wave = (t, period) => Math.sin((t / period) * TAU);
const spr = (p, rows, x, y, o) => p.sprite(rows, P, Math.round(x), Math.round(y), o);

/** 모서리를 계단으로 둥글린 상자 */
function box(p, x, y, w, h, c) {
	p.rect(x + 3, y, w - 6, h, c); p.rect(x + 1, y + 1, w - 2, h - 2, c); p.rect(x, y + 3, w, h - 6, c);
}
/** 말풍선: 윤곽 + 흰 면(아래쪽에 옅은 분홍 그늘) + 왼쪽 아래 꼬리. y 만큼 위아래로 움직임 → 안쪽 가운데 y 를 돌려줌 */
function bubble(p, y = 0, fill = W) {
	const x0 = -18, y0 = -19 + y, w = 36, h = 27;
	p.poly([[-12, y0 + h - 2], [-15, y0 + h + 7], [-5, y0 + h - 2]], LINE);
	box(p, x0, y0, w, h, LINE);
	box(p, x0 + 1, y0 + 1, w - 2, h - 2, fill);
	p.rect(x0 + 3, y0 + h - 3, w - 6, 2, SHADE);
	p.poly([[-11, y0 + h - 3], [-14, y0 + h + 4], [-7, y0 + h - 3]], fill);
	p.px(x0 + 3, y0 + 3, W); p.px(x0 + 4, y0 + 2, W);
	return y0 + 15;
}
const bob = (t, period, amp = 1) => Math.round(wave(t, period) * amp);
const blush = (p, cy, a = 1) => { for (const s of [-1, 1]) p.rect(s * 11 - 2, cy + 2, 4, 2, PINK, a); };

const E_HAPPY = ['.##.', '#..#'];
const E_DOT = ['##', '##'];
const E_BIG = ['.##.', '#ww#', '#w##', '.##.'];
const E_HALF = ['####', '.##.'];
const E_TIGHT = ['#..', '.#.', '#..'];
const E_DROOP = ['..#', '.#.', '##.'];
const E_HEART = ['r.r', 'rrr', '.r.'];
const BROW = ['##..', '..##'];
const M_SMILE = ['#...#', '.###.'];
const M_OPEN = ['#####', '#rrr#', '.###.'];
const M_FROWN = ['.###.', '#...#'];
const M_FLAT = ['####'];
const M_O = ['.#.', '#d#', '.#.'];
const M_WAVY = ['.#.#.', '#.#.#'];
const M_SMIRK = ['...#', '###.'];
const NOTE = ['.##', '.#.', '##.', '##.'];
const VEIN = ['r.r', '...', 'r.r'];
const HEART = ['r.r', 'rrr', '.r.'];
const BANG = ['r', 'r', 'r', '.', 'r'];
const STAR = ['.g.', 'gyg', '.g.'];
const DROP = ['.b.', 'blb', 'bbb'];

export const EMOTES = {
	// 기쁨: 말풍선이 통통, 웃는 눈과 벌린 입, 음표가 까딱
	joy: { meta: meta('joy', 1.2), draw(p, t) {
		const c = bubble(p, -Math.round(Math.abs(wave(t, 1.2)) * 2));
		spr(p, E_HAPPY, -9, c - 5); spr(p, E_HAPPY, 3, c - 5);
		spr(p, M_OPEN, -3, c);
		blush(p, c - 3);
		spr(p, NOTE, 11, c - 11 + bob(t, 0.6));
	} },
	// 화남: 부르르 떨고, 치켜뜬 눈썹과 꾹 다문 입, 핏대가 불끈
	angry: { meta: meta('angry', 0.8), draw(p, t) {
		const c = bubble(p, 0, hex('#fff0ec')), x = bob(t, 0.14);
		spr(p, BROW, x - 10, c - 7); spr(p, BROW, x + 4, c - 7, { flip: true });
		spr(p, E_DOT, x - 7, c - 4); spr(p, E_DOT, x + 4, c - 4);
		spr(p, M_FROWN, x - 3, c + 1);
		const big = wave(t, 0.4) > 0;
		p.sprite(VEIN, P, big ? 8 : 10, c - (big ? 13 : 11), { scale: big ? 2 : 1 });
	} },
	// 부끄러움: 질끈 감은 눈, 물결 입, 볼이 달아올랐다 식었다
	shy: { meta: meta('shy', 1.6), draw(p, t) {
		const c = bubble(p, 0, hex('#fff4f8')), x = bob(t, 1.6);
		spr(p, E_TIGHT, x - 8, c - 5); spr(p, E_TIGHT, x + 5, c - 5, { flip: true });
		spr(p, M_WAVY, x - 3, c + 1);
		const a = 0.65 + 0.35 * wave(t, 0.8);
		for (const s of [-1, 1]) for (let i = 0; i < 3; i++) p.line(x + s * 12 + i * 2 - 3, c, x + s * 12 + i * 2 - 2, c - 2, PINK, a);
	} },
	// 시무룩: 살짝 처지고, 축 늘어진 눈에서 눈물이 뚝
	sad: { meta: meta('sad', 1.6), draw(p, t) {
		const c = bubble(p, 1 + Math.round(Math.abs(wave(t, 3.2))), hex('#f2f8ff'));
		spr(p, E_DROOP, -9, c - 5); spr(p, E_DROOP, 5, c - 5, { flip: true });
		spr(p, M_FROWN, -3, c + 1);
		const u = (t % 1.6) / 1.6;
		if (u < 0.7) spr(p, DROP, 6, c - 2 + u * 8, { a: u > 0.5 ? (0.7 - u) * 5 : 1 });
	} },
	// 놀람: 말풍선이 펄쩍, 동그란 눈과 작은 입, 느낌표
	surprise: { meta: meta('surprise', 1.2), draw(p, t) {
		const u = t / 1.2, c = bubble(p, -Math.round(Math.max(0, Math.sin(Math.min(1, u * 4) * Math.PI)) * 3));
		spr(p, E_BIG, -10, c - 6); spr(p, E_BIG, 2, c - 6);
		spr(p, M_O, -2, c);
		p.sprite(BANG, P, 12, c - 11 + bob(t, 0.6), { scale: 2 });
	} },
	// 두근: 하트 눈이 두근두근, 작은 하트가 떠오름
	love: { meta: meta('love', 1.6), draw(p, t) {
		const bz = ((t % 0.8) - 0.08) / 0.09, beat = Math.exp(-(bz * bz)) > 0.4, c = bubble(p, beat ? -1 : 0, hex('#fff0f6'));
		p.sprite(E_HEART, P, -10, c - 6, { scale: 2 }); p.sprite(E_HEART, P, 2, c - 6, { scale: 2 });
		spr(p, M_SMILE, -3, c + 2);
		const u = (t % 1.6) / 1.6;
		spr(p, HEART, 12 + Math.sin(u * TAU) * 1.5, c - 3 - u * 9, { a: u < 0.7 ? 1 : (1 - u) * 3.3 });
	} },
	// 생각: 눈을 위로 굴리고, 점이 하나씩
	think: { meta: meta('think', 2), draw(p, t) {
		const c = bubble(p, 0), look = t < 1 ? -1 : 1;
		spr(p, E_DOT, -7 + look, c - 6); spr(p, E_DOT, 4 + look, c - 6);
		spr(p, M_FLAT, -2, c);
		const n = Math.floor((t / 2) * 4);
		for (let i = 0; i < 3; i++) if (i < n) p.rect(-5 + i * 4, c + 4, 2, 2, LINE);
	} },
	// 자신만만: 반쯤 감은 눈에 씩, 별이 반짝
	smug: { meta: meta('smug', 1.6), draw(p, t) {
		const c = bubble(p, 0, hex('#fffbe8'));
		spr(p, E_HALF, -9, c - 5); spr(p, E_HALF, 3, c - 5);
		spr(p, M_SMIRK, -1, c + 1);
		const u = (t % 0.8) / 0.8, a = Math.sin(u * Math.PI);
		p.sprite(STAR, P, a > 0.7 ? 9 : 11, c - (a > 0.7 ? 13 : 11), { a, scale: a > 0.7 ? 2 : 1 });
	} },
};
