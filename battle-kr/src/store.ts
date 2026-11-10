/** 저장 (localStorage, 실패하면 메모리에만) */
import type { PSet } from './sets';

const mem: { [k: string]: string } = {};
declare const __DEV_BUILD__: boolean;
/** 개발자 빌드(웹 /dev/)는 정식 웹과 같은 주소(도메인)라 저장 칸을 따로 씀 */
export const PREFIX = typeof __DEV_BUILD__ !== 'undefined' && __DEV_BUILD__ ? 'pkbkr-dev:' : 'pkbkr:';

function get(key: string): string | null {
	try {
		const v = localStorage.getItem(PREFIX + key);
		if (v !== null) return v;
	} catch {}
	return mem[key] ?? null;
}
function set(key: string, value: string) {
	mem[key] = value;
	try { localStorage.setItem(PREFIX + key, value); } catch {}
}
function del(key: string) {
	delete mem[key];
	try { localStorage.removeItem(PREFIX + key); } catch {}
}

export function load<T>(key: string, fallback: T): T {
	const raw = get(key);
	if (!raw) return fallback;
	try { return JSON.parse(raw) as T; } catch { return fallback; }
}
export function save(key: string, value: any) { set(key, JSON.stringify(value)); }
export function remove(key: string) { del(key); }

// ── 팀 ──
export interface SavedTeam { id: string; name: string; gen: 4 | 5; sets: PSet[]; updated: number; /** 치트 팀: 치트 배틀에서만 사용 */ cheat?: boolean }
export function loadTeams(): SavedTeam[] { return load<SavedTeam[]>('teams', []); }
export function saveTeams(teams: SavedTeam[]) { save('teams', teams); }
export function upsertTeam(team: SavedTeam) {
	const teams = loadTeams();
	const i = teams.findIndex(t => t.id === team.id);
	team.updated = Date.now();
	if (i >= 0) teams[i] = team; else teams.unshift(team);
	saveTeams(teams);
}
export function deleteTeam(id: string) { saveTeams(loadTeams().filter(t => t.id !== id)); }
export function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── 설정 ──
export interface Settings { speed: 1 | 2 | 3 | 4; animatedSprites: boolean; playerName: string; showLog: boolean; sound: boolean; music: boolean; playerSprite: string; effects: boolean; damagePreview: boolean; musicVolume: 1 | 2 | 3; sfxVolume: 1 | 2 | 3; frame: 'stone' | 'silver' | 'dark'; homeBg: string; battleBgm: string; /** 배틀 배경: 'auto'(상황에 맞게) / 'random' / 배경 id */ battleBg?: string; fastForward: boolean; vibrate: boolean; ver: number; moveSfx: 0 | 1 | 2 | 3; /** 배틀 규칙 id (rules.ts) */ battleRule: string; /** 배경음악 스타일: 관현악(mp3) / 칩튠 */ bgmStyle?: 'orch' | 'chip'; /** 능력 포인트 표시: 'sp' = 32(66) 포인트, 'ev' = 252(510) 노력치 */ evDisplay?: 'sp' | 'ev'; /** 시간대 테마: 밤(기본) / 낮 / 시간에 따라(6~18시 낮) */ tod?: 'night' | 'day' | 'auto'; /** 배틀 메시지 수동 진행(화면을 눌러야 다음 메시지) */ textManual?: boolean }
export function loadSettings(): Settings {
	const saved = load<Partial<Settings>>('settings', {});
	// 설정 v2: 효과음·울음소리 기본값을 '작게'로 (이전 버전에서 저장된 값도 한 번 낮춤)
	if ((saved.ver || 0) < 2) { saved.sfxVolume = 1; saved.ver = 2; save('settings', saved); }
	if ((saved.ver || 0) < 3) { saved.moveSfx = 1; saved.ver = 3; save('settings', saved); }
	if ((saved.ver || 0) < 4) {
		// 설정 v4: 기믹 규칙 → 배틀 규칙
		const old = (saved as any).gimmickRule as string | undefined;
		saved.battleRule = { one: 'natdex', free: 'natdexfree', mega: 'gen6', zmove: 'gen7', dynamax: 'gen8', tera: 'gen9', none: 'none' }[old || 'one'] || 'natdex';
		delete (saved as any).gimmickRule; saved.ver = 4; save('settings', saved);
	}
	// 설정 v5: 기본 그림을 정지 도트 그림으로 (한 번만)
	if ((saved.ver || 0) < 5) { saved.animatedSprites = false; saved.ver = 5; save('settings', saved); }
	// 설정 v6: 기본 규칙을 플랫(초전설·환상 제외)으로
	if ((saved.ver || 0) < 6) { if (!saved.battleRule || saved.battleRule === 'natdex') saved.battleRule = 'natdexflat'; saved.ver = 6; save('settings', saved); }
	return { speed: 2, animatedSprites: false, playerName: '플레이어', showLog: false, sound: true, music: true, playerSprite: 'lucas', effects: true,
		damagePreview: false, musicVolume: 2, sfxVolume: 1, frame: 'stone', homeBg: 'title', battleBgm: 'random', fastForward: false, vibrate: true, ver: 6, moveSfx: 1, battleRule: 'mzdt_one.natdex.no.no', bgmStyle: 'chip', ...saved };
}
export function saveSettings(s: Settings) { save('settings', s); }

// ── 기록 ──
export interface Records {
	best: { [mode: string]: number }; // 최고 연승
	current: { [mode: string]: number };
	cups: { [cup: string]: number }; // 우승 횟수
	named: { [id: string]: number }; // 승리 횟수
	bp: number;
	/** 모의 랭크 매치 RP (형식별) 와 최고 RP */
	rp?: { [fmt: string]: number };
	rpBest?: { [fmt: string]: number };
	/** 랭크 매치 현재 연승 (획득 RP 보너스) */
	rankStreak?: { [fmt: string]: number };
	/** 랭크 RP 척도 버전: 2 = v2.53 등급 개편(승급 기준 1.2배)에 맞춰 예전 RP 를 1.2배로 바꿈 */
	rankV?: number;
	/** 진행 중인 랭크 매치: 지면 이렇게 됨 (배틀 도중 앱이 꺼지면 다음에 이대로 처리) */
	rankPending?: { key: string; rp: number; streak: number };
	/** 랭크 시즌 id (S번호, 1주 단위) */
	season?: string;
	/** 위 처리 결과를 랭크 매치 화면에서 한 번 알림 */
	rankNotice?: boolean;
	battles: number;
	wins: number;
}
/** 저장한 리플레이 (시드 + 양쪽 선택으로 같은 배틀을 다시 돌림) */
export interface SavedReplay {
	id: string; date: number; label: string; win: boolean; turns: number;
	setup: any; // BattleSetup (팀·이름·그림·배경·옵션)
	seed: [number, number, number, number]; ruleId: string; p1: string[]; p2: string[];
	/** 온라인 대전: 시작 정보(양쪽 팀·시드·내 진영)와 양쪽 선택을 받은 순서대로 (online.ts replaySession 으로 재생) */
	online?: { start: any; inputs: [string, string][] };
}
const REPLAY_MAX = 30;
export function loadReplays(): SavedReplay[] { return load<SavedReplay[]>('replays', []); }
export function saveReplay(r: SavedReplay) { save('replays', [r, ...loadReplays().filter(x => x.id !== r.id)].slice(0, REPLAY_MAX)); }
export function deleteReplay(id: string) { save('replays', loadReplays().filter(x => x.id !== id)); }

export function loadRecords(): Records {
	const r: Records = { best: {}, current: {}, cups: {}, named: {}, bp: 0, battles: 0, wins: 0, ...load<Partial<Records>>('records', {}) };
	// v2.53 랭크 등급 개편: 승급 기준이 1.2배가 되어 예전 RP 도 1.2배로 (등급은 그대로 유지) — 한 번만
	if ((r.rankV || 0) < 2) {
		const up = (o?: { [k: string]: number }) => o && Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 1.2)]));
		r.rp = up(r.rp); r.rpBest = up(r.rpBest); r.rankV = 2;
		save('records', r);
	}
	return r;
}
export function saveRecords(r: Records) { save('records', r); }
export function updateRecords(fn: (r: Records) => void) {
	const r = loadRecords();
	fn(r);
	saveRecords(r);
	return r;
}

// ── 데이터 백업·복원: 이 앱이 저장한 모든 값(팀·전적·리플레이·설정·진행 중 도전)을 한 JSON 으로 ──
const BACKUP_TAG = 'battle-kr-backup';
export function exportBackup(): string {
	const data: { [k: string]: string } = {};
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i)!;
			if (k.startsWith(PREFIX)) data[k.slice(PREFIX.length)] = localStorage.getItem(k)!;
		}
	} catch {}
	for (const k in mem) if (!(k in data)) data[k] = mem[k];
	return JSON.stringify({ app: BACKUP_TAG, v: 1, at: new Date().toISOString(), data });
}
/** 백업 내용 확인 (덮어쓰기 전에 보여 줄 요약). 올바른 백업이 아니면 null */
export function inspectBackup(text: string): { at: string; teams: number; replays: number; keys: number } | null {
	try {
		const b = JSON.parse(text);
		if (b?.app !== BACKUP_TAG || typeof b.data !== 'object') return null;
		const arr = (k: string) => { try { const v = JSON.parse(b.data[k] || '[]'); return Array.isArray(v) ? v.length : 0; } catch { return 0; } };
		return { at: b.at || '', teams: arr('teams'), replays: arr('replays'), keys: Object.keys(b.data).length };
	} catch { return null; }
}
/** 백업으로 지금 데이터를 모두 바꿈 (백업에 없는 값은 지워짐) */
export function importBackup(text: string): boolean {
	if (!inspectBackup(text)) return false;
	const data: { [k: string]: string } = JSON.parse(text).data;
	try {
		const old: string[] = [];
		for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.startsWith(PREFIX)) old.push(k); }
		for (const k of old) localStorage.removeItem(k);
	} catch {}
	for (const k of Object.keys(mem)) delete mem[k];
	for (const [k, v] of Object.entries(data)) if (typeof v === 'string') set(k, v);
	return true;
}
