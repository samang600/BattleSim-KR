/** 도트 아이콘 (직접 그린 16×16 모드 아이콘 · 12×12 심볼) — 한 칸 = 2px 배수로 표시 */
import { h } from 'preact';

const PAL: { [c: string]: string } = { k: '#141a26', w: '#ffffff', y: '#f0c020', o: '#b07818', r: '#d83a3a', d: '#8a1c1c', g: '#d8dee8', s: '#7a8498', f: '#f0c8a0' };
/** 모드 아이콘 16×16 — 흰색 한 가지 색의 미니멀한 실루엣 (그림자는 CSS drop-shadow 2px) */
export const MODE_ICONS: { [id: string]: string[] } = {"tower": [".......ww.......", ".......ww.......", "......wwww......", ".....wwwwww.....", ".....w.ww.w.....", ".....wwwwww.....", ".....w.ww.w.....", "....wwwwwwww....", "....w.w..w.w....", "....wwwwwwww....", "....w.w..w.w....", "....wwwwwwww....", "...wwwwwwwwww...", "...wwww..wwww...", "...wwww..wwww...", "..wwwwwwwwwwww.."], "factory": ["......wwww......", "......wwww......", "..ww.wwwwww.ww..", "..wwwwwwwwwwww..", "...wwwwwwwwww...", "..wwwww..wwwww..", "wwwwww....wwwwww", "wwwww......wwwww", "wwwww......wwwww", "wwwwww....wwwwww", "..wwwww..wwwww..", "...wwwwwwwwww...", "..wwwwwwwwwwww..", "..ww.wwwwww.ww..", "......wwww......", "......wwww......"], "rank": ["..ww........ww..", "..www......www..", "...www....www...", "....www..www....", ".....wwwwww.....", "......wwww......", ".....wwwwww.....", "....wwwwwwww....", "...wwwwwwwwww...", "...wwww..wwww...", "...www....www...", "...wwww..wwww...", "...wwwwwwwwww...", "....wwwwwwww....", ".....wwwwww.....", "................"], "palace": [".......ww.......", "......wwww......", "..wwwwwwwwwwww..", ".wwwwwwwwwwwwww.", "ww............ww", "....wwwwwwww....", "....w.w..w.w....", "....wwwwwwww....", ".wwwwwwwwwwwwww.", "wwwwwwwwwwwwwwww", "ww............ww", "...wwwwwwwwww...", "...ww..ww..ww...", "...ww..ww..ww...", "...ww..ww..ww...", ".wwwwwwwwwwwwww."], "pwt": ["................", "...wwwwwwwwww...", ".wwwwwwwwwwwwww.", "ww.wwwwwwwwww.ww", "ww.wwwwwwwwww.ww", ".ww.wwwwwwww.ww.", "..wwwwwwwwwwww..", ".....wwwwww.....", "......wwww......", ".......ww.......", ".......ww.......", "......wwww......", ".....wwwwww.....", "....wwwwwwww....", "....wwwwwwww....", "................"], "boss": ["................", "................", ".....wwwwww.....", "...wwwwwwwwww...", "..wwwwwwwwwwww..", "..wwwwwwwwwwww..", "..ww...ww...ww..", "..ww...ww...ww..", "..wwwwwwwwwwww..", "...wwww..wwww...", "....wwwwwwww....", "....w.w..w.w....", "....wwwwwwww....", "................", "................", "................"], "named": [".......ww.......", ".......ww.......", "......wwww......", "......wwww......", ".....wwwwww.....", "wwwwwwwwwwwwwwww", ".wwwwwwwwwwwwww.", "..wwwwwwwwwwww..", "...wwwwwwwwww...", "....wwwwwwww....", "....wwwwwwww....", "...wwwwwwwwww...", "...wwww..wwww...", "..wwww....wwww..", "..www......www..", ".ww..........ww."], "free": ["ww............ww", "www..........www", ".www........www.", "..www......www..", "...www....www...", "....www..www....", ".....wwwwww.....", "......wwww......", "......wwww......", ".....wwwwww.....", "...wwww..wwww...", "..wwww....wwww..", "...ww......ww...", "..ww........ww..", ".ww..........ww.", "................"], "daily": ["................", "....ww....ww....", ".wwwwwwwwwwwwww.", ".wwwwwwwwwwwwww.", ".w............w.", ".w.ww..ww..ww.w.", ".w.ww..ww..ww.w.", ".w............w.", ".w.ww..ww..ww.w.", ".w.ww..ww..ww.w.", ".w............w.", ".w.ww..ww.....w.", ".w.ww..ww.....w.", ".w............w.", ".wwwwwwwwwwwwww.", "................"]};
function bitmap(rows: string[], pal: { [c: string]: string }, size: number, cls: string) {
	const n = rows.length;
	return <svg class={cls} width={size} height={size} viewBox={`0 0 ${n} ${n}`} shape-rendering="crispEdges" aria-hidden="true">
		{rows.flatMap((r, y) => [...r].map((ch, x) => ch !== '.' ? <rect x={x} y={y} width="1" height="1" fill={pal[ch]} /> : null))}
	</svg>;
}
export function ModeIcon({ id, size = 32 }: { id: string; size?: number }) {
	const rows = MODE_ICONS[id]; if (!rows) return null;
	return bitmap(rows, PAL, size, 'pix-mode-icon');
}

/** 심볼 12×12: 테두리는 검정 대신 채움색보다 어두운 색 한 칸 (가늘게 보이게) */
const SYMBOLS: { [k: string]: string[] } = {"tower": ["....oooo....", "....ohfo....", "...oooooo...", "...ohfffo...", "...offfdo...", "..oooooooo..", "..ohffffdo..", "..offffffo..", "..ofhffffo..", "..offoofdo..", "..offoofdo..", ".oooooooooo."], "factory": [".....oo.....", "..oo.ffo.oo.", "..ohoffofho.", "...offfffo..", ".oofhooofoo.", "ohffo..offfo", "offfo..ofdfo", ".ooffooofdo.", "...offfffo..", "..ofoffofdo.", "..oo.ofo.oo.", ".....oo....."], "rank": ["............", "o....oo....o", "oo..ohfo..oo", "ofo.offo.ofo", "ohfoffffoffo", "offffffffffo", "offhffffffdo", "offfffffffdo", "offoffoffodo", "oddddddddddo", ".oooooooooo.", "............"]};
const SYM_PAL = [
	{ o: '#2a3040', f: '#3a4256', h: '#4a5268', d: '#30384a' },   // 없음
	{ o: '#7a8498', f: '#d8dee8', h: '#ffffff', d: '#aab2c2' },   // 은
	{ o: '#a07010', f: '#f0c020', h: '#fff4b0', d: '#c89818' },   // 금
];
export function SymbolIcon({ kind, lv, size = 24 }: { kind: string; lv: number; size?: number }) {
	const rows = SYMBOLS[kind]; if (!rows) return null;
	return bitmap(rows, SYM_PAL[Math.max(0, Math.min(2, lv))] as any, size, 'pix-symbol');
}
