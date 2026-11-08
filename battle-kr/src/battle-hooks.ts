/** 배틀이 끝날 때 부르는 훅 (기록·통계·업적). 배틀 화면은 emitBattleEnd 만 부름 */
type Hook = (setup: any, battle: any, win: boolean) => void;
const hooks: Hook[] = [];
export function onBattleEnd(h: Hook) { hooks.push(h); }
export function emitBattleEnd(setup: any, battle: any, win: boolean) {
	for (const h of hooks) { try { h(setup, battle, win); } catch (e) { console.error('배틀 기록 오류', e); } }
}
