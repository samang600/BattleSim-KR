// 시나리오 대화의 감정 이모티콘 — pixelfx(MIT, src/vendor/pixelfx) 의 그리기 도구로 새로 만든 효과 8개.
// pixelfx 효과 모듈과 같은 모양({ meta, draw(p, t, o) })이라 createFx 로 돌림. 44×44 칸, 가운데가 원점, 반복 재생.
// 얼굴: 노란 동그라미(윤곽·그늘·광택) 위에 감정별 눈·입을 도트로 그리고, 감정에 맞게 움직임(통통·부르르·눈물·하트…)
import { hex, mix, TAU } from './vendor/pixelfx/core/index.js';
export { createFrame, clearFrame, createFx, composite } from './vendor/pixelfx/core/index.js';

const INK = hex('#3a2408'), Y0 = hex('#fff0a0'), Y1 = hex('#ffd23a'), Y2 = hex('#eaa018'), W = hex('#ffffff');
const PINK = hex('#ff7aa8'), RED = hex('#e8262a'), DRED = hex('#a01018'), BLUE = hex('#3a9af0'), LBLUE = hex('#a8dcff'), GOLD = hex('#ffe070');
const P = { '#': INK, r: RED, d: DRED, w: W, p: PINK, b: BLUE, l: LBLUE, g: GOLD, y: Y0 };
const meta = (name, duration) => ({ name, size: [44, 44], origin: [22, 24], duration, loop: true, fps: 20, options: {} });
const wave = (t, period) => Math.sin((t / period) * TAU);

/** 얼굴 바탕: 윤곽 + 노란 면(오른쪽 아래 그늘) + 왼쪽 위 광택. tint 로 얼굴빛을 물들임 */
function face(p, x, y, tint, k = 0) {
	const base = tint ? mix(Y1, tint, k) : Y1, dark = tint ? mix(Y2, tint, k) : Y2;
	p.circle(x, y, 12.4, INK);
	p.circle(x, y, 11.2, (d, a) => (d > 0.72 && a > -0.5 && a < 2.2 ? dark : base));
	p.circle(x - 4.5, y - 5.5, 2.2, Y0);
	p.px(x - 6, y - 3, Y0);
}
const spr = (p, rows, x, y, o) => p.sprite(rows, P, Math.round(x), Math.round(y), o);

const EYE_HAPPY = ['.##.', '#..#'];
const EYE_DOT = ['##', '##', '##'];
const EYE_BIG = ['.##.', '#ww#', '#w##', '.##.'];
const EYE_HALF = ['####', '.##.'];
const EYE_SAD = ['#...', '.##.', '..##'];
const EYE_HEART = ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'];
const BROW = ['##...', '..##.', '....#'];
const M_SMILE = ['#.....#', '#rrrrr#', '.#rdr#.', '..###..'];
const M_GRIN = ['#.....#', '.#####.'];
const M_FROWN = ['.#####.', '#.....#'];
const M_FLAT = ['#####'];
const M_O = ['.##.', '#dd#', '#dd#', '.##.'];
const M_WAVY = ['.#..#..', '#.##.##'];
const M_SMIRK = ['.....#', '#####.'];
const NOTE = ['..##', '..#.', '..#.', '###.', '###.'];
const VEIN = ['r.r', '...', 'r.r'];
const HEART = ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'];
const BANG = ['rr', 'rr', 'rr', 'rr', '..', 'rr'];
const STAR = ['..g..', '.gyg.', 'gywyg', '.gyg.', '..g..'];
const DROP = ['.l.', 'lbl', 'bbb', '.b.'];

export const EMOTES = {
	// 기쁨: 통통 뛰며 웃고, 음표가 떠오름
	joy: { meta: meta('joy', 1.6), draw(p, t) {
		const y = -Math.round(Math.abs(wave(t, 0.8)) * 3);
		face(p, 0, y);
		spr(p, EYE_HAPPY, -7, y - 4); spr(p, EYE_HAPPY, 3, y - 4);
		spr(p, M_SMILE, -3.5, y + 2);
		p.px(-8, y + 1, PINK); p.px(-7, y + 1, PINK); p.px(7, y + 1, PINK); p.px(8, y + 1, PINK);
		for (const [ph, x0] of [[0, 13], [0.8, -17]]) { const u = ((t + ph) % 1.6) / 1.6; spr(p, NOTE, x0 + Math.sin(u * TAU) * 2, 2 - u * 20, { a: u < 0.8 ? 1 : (1 - u) * 5 }); }
	} },
	// 화남: 빨개져서 부르르 떨고, 핏대가 불끈
	angry: { meta: meta('angry', 1.2), draw(p, t) {
		const x = Math.round(wave(t, 0.12) * 1.2), heat = 0.45 + 0.2 * wave(t, 0.6);
		face(p, x, 0, RED, heat);
		spr(p, BROW, x - 8, -7); spr(p, BROW, x + 3, -7, { flip: true });
		spr(p, EYE_DOT, x - 5, -3); spr(p, EYE_DOT, x + 3, -3);
		spr(p, M_FROWN, x - 3.5, 4);
		const k = Math.round(1 + Math.abs(wave(t, 0.6)));
		p.sprite(VEIN, P, 9, -18, { scale: k + 1 });
	} },
	// 부끄러움: 볼이 달아오르고, 눈을 피하며 갸웃
	shy: { meta: meta('shy', 2), draw(p, t) {
		const x = Math.round(wave(t, 2) * 1.5), look = wave(t, 2) > 0 ? 1 : -1, glow = 0.6 + 0.3 * wave(t, 1);
		face(p, x, 0, PINK, 0.18);
		spr(p, EYE_DOT, x - 5 + look, -3); spr(p, EYE_DOT, x + 3 + look, -3);
		for (const s of [-1, 1]) { p.ellipse(x + s * 7, 2.5, 3.2, 2, PINK, glow); for (let i = -1; i <= 1; i++) p.line(x + s * 7 + i * 2 - 1, 4, x + s * 7 + i * 2, 1, RED, 0.8); }
		spr(p, M_WAVY, x - 3.5, 5);
		const u = (t % 1) / 1; p.circle(12, -12 - u * 6, 1.6, W, 0.8 * (1 - u)); p.circle(15, -9 - u * 7, 1.1, W, 0.7 * (1 - u));
	} },
	// 시무룩: 축 처지고, 눈물이 뚝뚝
	sad: { meta: meta('sad', 1.8), draw(p, t) {
		const y = 1 + Math.round(Math.abs(wave(t, 3.6)) * 1.5);
		face(p, 0, y, LBLUE, 0.22);
		spr(p, EYE_SAD, -7, y - 4, { flip: true }); spr(p, EYE_SAD, 3, y - 4);
		spr(p, M_FROWN, -3.5, y + 5);
		for (const [s, ph] of [[-1, 0], [1, 0.9]]) { const u = ((t + ph) % 1.8) / 1.8; if (u < 0.75) spr(p, DROP, s * 6 - 1, y - 1 + u * 20, { a: u > 0.55 ? (0.75 - u) * 5 : 1 }); }
		p.line(-16, -14, -16, -8, BLUE, 0.6); p.line(-13, -16, -13, -11, BLUE, 0.6);
	} },
	// 놀람: 펄쩍 뛰고 눈이 휘둥그레, 느낌표가 튀어나옴
	surprise: { meta: meta('surprise', 1.4), draw(p, t) {
		const u = t / 1.4, y = -Math.round(Math.max(0, Math.sin(Math.min(1, u * 3.5) * Math.PI)) * 5);
		face(p, 0, y);
		spr(p, EYE_BIG, -7, y - 5); spr(p, EYE_BIG, 3, y - 5);
		spr(p, M_O, -2, y + 3);
		const k = Math.min(1, u * 6), by = -20 - Math.round(Math.abs(wave(t, 0.7)) * 2);
		p.sprite(BANG, P, 11, by + Math.round((1 - k) * 8), { scale: 2, a: k });
		for (const [ax, ay] of [[-15, -8], [-17, -2]]) p.line(ax, ay, ax + 3, ay + 1, INK, u < 0.4 ? 1 : 0);
	} },
	// 두근: 눈이 하트가 되어 뛰고, 작은 하트가 떠오름
	love: { meta: meta('love', 1.6), draw(p, t) {
		const bz = ((t % 0.8) - 0.08) / 0.09, beat = Math.exp(-(bz * bz)), y = -Math.round(beat * 1.5);
		face(p, 0, y, PINK, 0.12);
		const k = beat > 0.5 ? 1 : 0;
		spr(p, EYE_HEART, -8 - k, y - 5 - k); spr(p, EYE_HEART, 3 + k, y - 5 - k);
		spr(p, M_SMILE, -3.5, y + 3);
		for (const [ph, x0] of [[0, 14], [0.55, -18], [1.1, 10]]) { const u = ((t + ph) % 1.6) / 1.6; spr(p, HEART, x0 + Math.sin(u * TAU) * 2, 4 - u * 22, { a: u < 0.75 ? 1 : (1 - u) * 4 }); }
		p.glow(0, y, 18, PINK, 0.15 + 0.25 * beat);
	} },
	// 생각: 눈을 굴리고, 점이 하나씩 떠오름
	think: { meta: meta('think', 2.4), draw(p, t) {
		const look = t < 1.2 ? -1 : 1;
		face(p, 0, 0);
		spr(p, EYE_DOT, -5 + look, -4); spr(p, EYE_DOT, 3 + look, -4);
		p.line(-7, -7, -3, -8, INK); p.line(3, -8, 7, -6, INK);
		spr(p, M_FLAT, -1, 5);
		const n = Math.floor((t / 2.4) * 4);
		for (let i = 0; i < 3; i++) if (i < n) { const r = 1.4 + i * 0.7; p.circle(10 + i * 4, -11 - i * 4, r + 1, INK); p.circle(10 + i * 4, -11 - i * 4, r, W); }
	} },
	// 자신만만: 반쯤 감은 눈에 씩 웃고, 별이 반짝
	smug: { meta: meta('smug', 1.8), draw(p, t) {
		const tilt = Math.round(wave(t, 1.8));
		face(p, tilt, 0);
		spr(p, EYE_HALF, tilt - 7, -4); spr(p, EYE_HALF, tilt + 3, -4);
		p.line(tilt - 8, -7, tilt - 3, -6, INK); p.line(tilt + 3, -8, tilt + 8, -9, INK);
		spr(p, M_SMIRK, tilt - 2, 4);
		for (const [ph, sx, sy] of [[0, 12, -15], [0.9, -17, -12]]) {
			const u = ((t + ph) % 1.8) / 1.8, a = Math.sin(Math.min(1, u * 2.5) * Math.PI);
			if (a > 0.05) { p.sprite(STAR, P, sx, sy, { a }); p.glow(sx + 2, sy + 2, 7, GOLD, 0.5 * a); }
		}
	} },
};
