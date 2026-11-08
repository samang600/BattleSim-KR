/** 스토리 모드 (테스트): 거점 화면에서 인물을 눌러 대화 → 배틀 → 결과 대화.
 *  화면 구성만 듀얼링크스 같은 '거점 맵 + 인물 아이콘 / 큰 초상 + 이름 띠 + 흰 대화창'을 참고하고, 그림은 쇼다운 트레이너 도트(80×80)를 가슴 위로 잘라 정수배로 키워 씀.
 *  진행 저장: localStorage pkbkr:story-test */
import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ask, abortMode } from './ui/core';
import { BattleView, type BattleResult } from './ui/battle';
import { SPRITE_URL, trainerImgError } from './trainer-lines';
import { randomTeam, type PSet } from './sets';
import { loadSettings, loadTeams, load, save } from './store';

type Line = { who: string; text: string; sprite?: string };
interface Npc { id: string; name: string; sprite: string; x: number; y: number; intro: Line[]; win: Line[]; lose: Line[]; minBst: number; maxBst: number; skill: number; bg: 'tower' | 'field' | 'gym' | 'champion' }

/** 1장: 배틀타워 앞 광장 (테스트용 인물 3명) */
const CHAPTER = {
	title: '1장 · 배틀타워 앞 광장', stage: 1,
	npcs: [
		{ id: 'guide', name: '안내원 소라', sprite: 'clerk', x: 22, y: 58, minBst: 380, maxBst: 470, skill: 0.5, bg: 'field',
			intro: [{ who: '안내원 소라', text: '어서 오세요! 여기는 배틀타워 앞 광장이에요.' }, { who: '안내원 소라', text: '타워에 도전하기 전에 몸 좀 풀어 볼까요?\n살살 할게요!' }],
			win: [{ who: '안내원 소라', text: '와, 제법인데요?\n타워에서도 그 기세로 가요!' }], lose: [{ who: '안내원 소라', text: '아직 긴장했나 봐요.\n천천히 다시 해 봐요!' }] },
		{ id: 'rival', name: '라이벌 준', sprite: 'barry', x: 66, y: 50, minBst: 450, maxBst: 540, skill: 0.75, bg: 'tower',
			intro: [{ who: '라이벌 준', text: '늦었잖아! 벌금 백만 원이다!' }, { who: '라이벌 준', text: '농담이고… 누가 먼저 타워 정상에 가는지 승부다!\n지금 여기서 실력부터 확인해 주지!' }],
			win: [{ who: '라이벌 준', text: '으윽… 이번엔 내가 졌다.\n다음엔 꼭 이긴다!' }], lose: [{ who: '라이벌 준', text: '봤냐! 이게 내 실력이야!\n타워 꼭대기에서 기다린다!' }] },
		{ id: 'master', name: '타워 마스터 렌', sprite: 'cynthia', x: 46, y: 30, minBst: 520, maxBst: 640, skill: 0.92, bg: 'champion',
			intro: [{ who: '타워 마스터 렌', text: '광장이 소란스럽다 싶더니… 네가 소문의 도전자구나.' }, { who: '타워 마스터 렌', text: '좋아. 타워에 오를 자격이 있는지\n직접 확인해 줄게.' }],
			win: [{ who: '타워 마스터 렌', text: '훌륭해. 타워의 문은 너에게 열려 있어.' }], lose: [{ who: '타워 마스터 렌', text: '아직 부족해.\n더 강해져서 다시 와.' }] },
	] as Npc[],
};

const KEY = 'story-test';
const progress = () => load<{ cleared: string[] }>(KEY, { cleared: [] });

/** 대화 장면: 배경 + 가운데 큰 초상(트레이너 도트 가슴 위) + 이름 띠 + 흰 대화창 (한 글자씩, 누르면 넘김) */
function Dialogue({ lines, bg, onDone }: { lines: Line[]; bg: string; onDone: () => void }) {
	const [i, setI] = useState(0);
	const [n, setN] = useState(0);
	const line = lines[i];
	const full = n >= line.text.length;
	useEffect(() => { setN(0); }, [i]);
	useEffect(() => {
		if (full) return;
		const t = setTimeout(() => setN(x => Math.min(line.text.length, x + 2)), 30);
		return () => clearTimeout(t);
	}, [n, i]);
	const next = () => { if (!full) { setN(line.text.length); return; } if (i + 1 < lines.length) setI(i + 1); else onDone(); };
	return <div class={'story-talk bg-' + bg} onClick={next}>
		<div class="arena-bg st-bg" />
		{line.sprite && <div class="st-portrait" key={line.sprite}><img src={SPRITE_URL(line.sprite)} alt="" onError={trainerImgError} /></div>}
		<div class="st-box">
			<div class="st-name"><span>{line.who}</span><i class="st-deco" /></div>
			<div class="st-text">{line.text.slice(0, n)}{full && <span class="st-arrow">▼</span>}</div>
		</div>
		<button class="st-skip" onClick={e => { e.stopPropagation(); onDone(); }}>건너뛰기 ▶▶</button>
	</div>;
}

/** 거점 화면: 배경 그림 위에 인물 아이콘(동그란 초상 + 떠 있는 표시), 오른쪽 아래 내 트레이너 */
function Hub({ onPick, onExit }: { onPick: (n: Npc) => void; onExit: () => void }) {
	const done = new Set(progress().cleared);
	const s = loadSettings();
	return <div class="story-hub">
		<div class="sh-bg" />
		<div class="sh-top">
			<button class="st-exit" onClick={onExit}>◀ 나가기</button>
			<div class="sh-stage"><small>스테이지</small><b>{CHAPTER.stage}</b></div>
			<div class="sh-title">{CHAPTER.title}<small> · 테스트</small></div>
		</div>
		{CHAPTER.npcs.map(n => <button class={'sh-npc' + (done.has(n.id) ? ' done' : '')} style={{ left: n.x + '%', top: n.y + '%' }} onClick={() => onPick(n)}>
			<span class="sh-face"><img src={SPRITE_URL(n.sprite)} alt="" onError={trainerImgError} /></span>
			<span class="sh-mark">{done.has(n.id) ? '✓' : '!'}</span>
			<span class="sh-label">{n.name}</span>
		</button>)}
		<div class="sh-me"><img src={SPRITE_URL(s.playerSprite || 'lucas')} alt="" onError={trainerImgError} /><div class="sh-me-bar"><b>{s.playerName || '플레이어'}</b><small>클리어 {done.size}/{CHAPTER.npcs.length}</small></div></div>
	</div>;
}

function myTeam(): PSet[] {
	const id = load<string>('lastTeam', '');
	const ts = loadTeams().filter(t => !t.cheat && t.sets.length >= 3);
	const t = ts.find(x => x.id === id) || ts[0];
	return t ? t.sets.slice(0, 3) : randomTeam({ gen: 9, size: 3, minBst: 450, maxBst: 540 });
}

export async function runStory() {
	while (true) {
		const npc = await ask<Npc | null>(r => <Hub onPick={r} onExit={() => r(null)} />);
		if (!npc) return;
		const me = loadSettings();
		const withSprite = (ls: Line[]) => ls.map(l => ({ ...l, sprite: l.sprite || (l.who === npc.name ? npc.sprite : me.playerSprite || 'lucas') }));
		await ask<void>(r => <Dialogue lines={withSprite(npc.intro)} bg={npc.bg} onDone={() => r()} />);
		const opp = randomTeam({ gen: 9, size: 3, minBst: npc.minBst, maxBst: npc.maxBst, quality: npc.skill });
		const res = await ask<BattleResult>(r => <BattleView key={Math.random()} onEnd={x => { if (x.quit) abortMode(); r(x); }} setup={{
			gen: 9, doubles: false, aiSkill: npc.skill, bg: npc.bg, label: CHAPTER.title, noRecord: true,
			p1: { name: me.playerName || '플레이어', team: myTeam(), sprite: me.playerSprite || 'lucas' },
			p2: { name: npc.name, team: opp, sprite: npc.sprite, lines: { intro: npc.intro[npc.intro.length - 1].text.replace(/\n/g, ' '), win: npc.lose[0].text.replace(/\n/g, ' '), lose: npc.win[0].text.replace(/\n/g, ' ') } },
		}} />);
		if (res.win) { const p = progress(); if (!p.cleared.includes(npc.id)) save(KEY, { cleared: [...p.cleared, npc.id] }); }
		await ask<void>(r => <Dialogue lines={withSprite(res.win ? npc.win : npc.lose)} bg={npc.bg} onDone={() => r()} />);
	}
}
