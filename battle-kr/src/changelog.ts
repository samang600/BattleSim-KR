/** 업데이트 소식 (웹: 새 버전으로 처음 열 때 한 번 보여 줌, ui/whats-new.tsx).
 *  버전마다 짧게 — 새 기능(new) · 개선(up) · 수정(fix). 위가 최신. 릴리스할 때 맨 위에 추가 */
export type ChangeTag = 'new' | 'up' | 'fix';
export interface Change { ver: string; date: string; title: string; items: [ChangeTag, string][] }
declare const __APP_VERSION__: string;
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0';

export const CHANGELOG: Change[] = [
	{ ver: '2.54.5', date: '2026-11-08', title: '업데이트 소식', items: [
		['new', '웹에서 새 버전으로 처음 열면 이렇게 바뀐 점을 간단히 알려 줘요'],
	] },
	{ ver: '2.54.4', date: '2026-11-08', title: '중간에 그만두기', items: [
		['new', '오늘의 도전: 배틀마다 쉬기(저장)·그만두기, 같은 날 이어서 도전'],
		['up', 'PWT 대회 그만두기, 참가 포켓몬 고르기에서 뒤로 가기'],
	] },
	{ ver: '2.54.0', date: '2026-11-08', title: '새 모드와 트레이너 수첩', items: [
		['new', '배틀팰리스: 포켓몬이 성격대로 스스로 싸워요'],
		['new', '오늘의 도전: 날마다 모두 같은 렌탈·상대 7명'],
		['new', '보스 러시: 지방 정복 · 악의 조직 · 역대 챔피언 연전'],
		['new', '랭크 매치 1주 시즌, 챔피언 심볼'],
		['new', '트레이너 수첩: 업적 · 포켓몬별 통계 · 도감 · 심볼'],
		['new', '네임드 트레이너 추가: 오박사, 프런티어 브레인, 애니메이션 지우·알랭·택트 등'],
		['up', '메인 화면 개편, 모드별 새 배경과 배틀 음악'],
	] },
	{ ver: '2.53.7', date: '2026-11-08', title: '포켓몬 그림 꾸미기', items: [
		['new', '포켓몬 그림 원본 추출·내 그림 내보내기·zip 일괄 적용'],
	] },
];
/** a < b ? (버전 비교 '2.54.0') */
export function verLess(a: string, b: string) {
	const x = a.split('.').map(Number), y = b.split('.').map(Number);
	for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0);
	return false;
}
