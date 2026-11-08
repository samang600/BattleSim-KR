/** 업데이트 소식 (웹: 새 버전으로 처음 열 때 한 번 보여 줌, ui/whats-new.tsx).
 *  버전마다 짧게 — 새 기능(new) · 개선(up) · 수정(fix). 위가 최신. 릴리스할 때 맨 위에 추가 */
export type ChangeTag = 'new' | 'up' | 'fix';
export interface Change { ver: string; date: string; title: string; items: [ChangeTag, string][] }
declare const __APP_VERSION__: string;
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0';

export const CHANGELOG: Change[] = [
	{ ver: '2.54.7', date: '2026-11-08', title: '테라버스트', items: [
		['up', '9세대에 나오지 않는 포켓몬도 테라버스트를 배울 수 있어요 (설정상 기술머신을 못 배우는 캐터피·뿔충이·안농 등은 제외)'],
	] },
	// v2.53.7 이후 바뀐 점을 한 번에 (버전별로 나누지 않음)
	{ ver: '2.54.6', date: '2026-11-08', title: '이번 업데이트', items: [
		['new', '배틀팰리스: 포켓몬이 성격대로 스스로 싸워요'],
		['new', '오늘의 도전: 날마다 모두 같은 렌탈·상대 7명, 쉬었다가 같은 날 이어서'],
		['new', '보스 러시: 지방 정복(관장→사천왕→챔피언) · 악의 조직 · 역대 챔피언 연전'],
		['new', '랭크 매치 1주 시즌, 챔피언 심볼 (타워·팩토리 심볼도)'],
		['new', '트레이너 수첩: 업적 · 포켓몬별 통계 · 도감 · 심볼'],
		['new', '네임드 트레이너 추가: 오박사, 프런티어 브레인, 캡틴, 애니메이션 지우·알랭·택트·진철·슈티 등'],
		['up', '메인 화면 개편: 타워·팩토리·랭크를 크게, 모드마다 다른 색'],
		['up', '모드별 새 배틀 배경과 배틀 음악'],
		['up', 'PWT 대회 그만두기, 참가 포켓몬 고르기에서 뒤로 가기'],
		['new', '업데이트 소식: 새 버전으로 처음 열면 이 창이 떠요 (설정 › 정보에서 다시 보기)'],
	] },
];
/** a < b ? (버전 비교 '2.54.0') */
export function verLess(a: string, b: string) {
	const x = a.split('.').map(Number), y = b.split('.').map(Number);
	for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0);
	return false;
}
