/** 도트 아이콘 (직접 그린 16×16 모드 아이콘 · 12×12 심볼) — 한 칸 = 2px 배수로 표시 */
import { h } from 'preact';

const PAL: { [c: string]: string } = { k: '#141a26', w: '#ffffff', y: '#f0c020', o: '#b07818', r: '#d83a3a', d: '#8a1c1c', g: '#d8dee8', s: '#7a8498', f: '#f0c8a0' };
/** 모드 아이콘 16×16 */
export const MODE_ICONS: { [id: string]: string[] } = {"tower": ["......kkkk......", "......kyyk......", "....kkkkkkkk....", "....kgggggsk....", "....kgyygysk....", "....kgggggsk....", "....kgyygysk....", "...kkkkkkkkkk...", "...kgggggggsk...", "...kgyygyygsk...", "...kgggggggsk...", "...kgyygyygsk...", "...kgggggggsk...", "...kgggkkggsk...", "...kgggkkggsk...", "..kkkkkkkkkkkk.."], "factory": ["......kkkk......", "...kk.kggk.kk...", "..kggkkggkkggk..", "..kgggggggggsk..", "...kggssssggk...", ".kkkgsk..ksgkkk.", "kgggsk....ksgggk", "kgggs......sgsgk", "kgggs......sgssk", "kgggsk....ksgssk", ".kkkgsk..ksgkkk.", "...kggssssgsk...", "..kgggggggsssk..", "..kgskkgskksgk..", "...kk.kgsk.kk...", "......kkkk......"], "rank": ["..kddk....kddk..", "..krrdk..krrdk..", "...krrdkkrrdk...", "....krrrrrrk....", ".....krrrrk.....", "......kkkk......", ".....kyyyyk.....", "....kyywyyok....", "...kyywyyyyok...", "...kyyyyoyyok...", "...kyyyoooyok...", "...kyyyyoyyok...", "...kyyyyyyyok...", "....kyyyyyok....", ".....kooook.....", "......kkkk......"], "palace": [".......kk.......", "......kyyk......", ".....krrrrk.....", "...kkrrrrrrkk...", "..krrrrrrrrrrk..", ".kddddddddddddk.", "..kkwwkwwkwwkk..", "...kwwkwwkwwk...", "..kkrrrrrrrrkk..", ".krrrrrrrrrrrrk.", "kddddddddddddddk", ".kkwwkwwwwkwwkk.", "..kwwkwyywkwwk..", "..kwwkwyywkwwk..", "..kwwkwyywkwwk..", ".kkkkkkkkkkkkkk."], "pwt": ["................", "..kkkkkkkkkkkk..", ".kyykyyyyyykyyk.", "kyk.kywyyyyk.kyk", "kyk.kywyyyok.kyk", ".kyykyyyyyokyyk.", "..kkkyyyyyokkk..", "....kyyyyyok....", ".....kyyyok.....", "......kyok......", "......kyok......", ".....kyyook.....", "....kkkkkkkk....", "....kddddddk....", "....krrrrrrk....", "....kkkkkkkk...."], "boss": ["....kkkkkkkk....", "...kwwwwwwwsk...", "..kwwwwwwwwwsk..", ".kwwwwwwwwwwwsk.", ".kwwkkwwwwkkwsk.", ".kwkrrkwwkrrksk.", ".kwkrrkwwkrrksk.", ".kwwkkwwwwkkwsk.", "..kwwwwkkwwwsk..", "...kwwwkkwwsk...", "...kswwwwwwsk...", "....kwkwkwksk...", "....kwkwkwkk....", ".....kkkkkk.....", "................", "................"], "named": ["................", ".....kkkkkk.....", "...kkrrrrrrkk...", "..krrrrwwrrrrk..", "..krrrwkkwrrrk..", "..krrrwkkwrrrk..", ".krrrrrwwrrrrdk.", ".kddddddddddddk.", "kwwwwwwwwwkkkkk.", "kkkkkkkkkkk.....", "...kffffffk.....", "..kfkffffkfk....", "..kffffffffk....", "...kffkkffk.....", "....kffffk......", ".....kkkk......."], "free": ["kkk..........kkk", "kggk........kggk", "ksggk......kggsk", ".ksggk....kggsk.", "..ksggk..kggsk..", "...ksggkkggsk...", "....ksggggsk....", ".....ksggsk.....", "....kgsggsgk....", "...kgsk..ksgk...", ".kkkok....kokkk.", "koook......koook", ".kook......kook.", "kook........kook", "kok..........kok", ".k............k."], "daily": ["...kk......kk...", "..kkkkkkkkkkkk..", ".krkgkrrrrkgkrk.", ".krrkrrrrrrkrrk.", ".kddddddddddddk.", ".kwwwwwwwwwwwwk.", ".kwwwwkkkkwwwwk.", ".kwwwkkwwkkwwwk.", ".kwwwwwwwkkwwwk.", ".kwwwwwwkkwwwwk.", ".kwwwwwkkwwwwwk.", ".kwwwwkkwwwwwwk.", ".kwwwkkkkkkwwwk.", ".kwwwwwwwwwwwsk.", ".ksssssssssssk..", "..kkkkkkkkkkk..."]};
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
