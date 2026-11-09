/** 온라인 대전 · 참가 포켓몬 고르기 (서로 전체 엔트리). 챔피언스 랭크배틀 선택 화면처럼:
 *  왼쪽 내 6마리(이름·도구, 고른 순서 번호) · 오른쪽 상대 6마리(그림·타입·성별만) · 남은 시간 · 'N/3 선택 완료'.
 *  다 고르면 같은 화면에서 상대를 기다림. 시간이 다 되면 고른 것 + 위에서부터 채워 자동 완료 */
import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { CropSprite, TypeBadge, ItemIcon } from './core';
import { MonSheet, MonDetail } from './screens';
import { speciesData, itemKo, toID } from '../data';
import type { PSet } from '../sets';
import { josa } from '../josa';

export const PICK_SECONDS = 90;

/** 도트 정보 아이콘 (9×9 칸, 한 칸 2px): 계단 모서리 상자 + 'i' */
function InfoIcon() {
	const px = (x: number, y: number, w = 1, h = 1, c = 'currentColor') => <rect x={x} y={y} width={w} height={h} fill={c} />;
	return <svg class="opk-ico" viewBox="0 0 9 9" width="18" height="18" shape-rendering="crispEdges" aria-hidden="true">
		{px(1, 0, 7, 1, 'var(--ib)')}{px(1, 8, 7, 1, 'var(--ib)')}{px(0, 1, 1, 7, 'var(--ib)')}{px(8, 1, 1, 7, 'var(--ib)')}
		{px(1, 1, 7, 7, 'var(--if)')}{px(1, 1, 7, 1, 'var(--ih)')}{px(1, 2, 1, 6, 'var(--ih)')}
		{px(4, 2, 1, 1, 'var(--ig)')}{px(3, 4, 2, 1, 'var(--ig)')}{px(4, 5, 1, 1, 'var(--ig)')}{px(3, 6, 3, 1, 'var(--ig)')}
	</svg>;
}

/** 넓은 화면(PC)이면 상세를 오른쪽 칸에 */
function useWide() {
	const q = '(min-width: 900px)';
	const [w, setW] = useState(() => { try { return matchMedia(q).matches; } catch { return false; } });
	useEffect(() => { try { const m = matchMedia(q), f = () => setW(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); } catch { return; } }, []);
	return w;
}

export interface OnlinePickProps {
	title: string;
	mine: PSet[]; oppName: string; oppTeam: PSet[]; myName: string;
	count: number;
	/** 이미 골라 보낸 상태 (재접속 등) */
	sent?: boolean;
	/** 상대 상태: 고르는 중 · 골랐음 · 연결 끊김 */
	opp: 'picking' | 'done' | 'away';
	onDone: (idx: number[]) => void;
	onLeave: () => void;
}

const sexMark = (s: PSet) => s.gender === 'M' ? <i class="op-sex m">♂</i> : s.gender === 'F' ? <i class="op-sex f">♀</i> : null;

export function OnlinePick({ title, mine, oppName, oppTeam, myName, count, sent, opp, onDone, onLeave }: OnlinePickProps) {
	const need = Math.min(count, mine.length);
	const [picked, setPicked] = useState<number[]>([]);
	const [done, setDone] = useState(!!sent);
	const [left, setLeft] = useState(PICK_SECONDS);
	const [view, setView] = useState<number | null>(null);
	const wide = useWide();
	const [hover, setHover] = useState<number | null>(null);
	const finish = (idx: number[]) => { if (done) return; setDone(true); setView(null); onDone(idx); };
	useEffect(() => {
		if (done) return;
		const t = setInterval(() => setLeft(x => x - 1), 1000);
		return () => clearInterval(t);
	}, [done]);
	useEffect(() => {   // 시간 끝: 고른 것 + 위에서부터 채움
		if (done || left > 0) return;
		const idx = [...picked];
		for (let i = 0; idx.length < need && i < mine.length; i++) if (!idx.includes(i)) idx.push(i);
		finish(idx);
	}, [left]);
	const toggle = (i: number) => {
		if (done) return;
		if (picked.includes(i)) setPicked(picked.filter(x => x !== i));
		else if (picked.length < need) setPicked([...picked, i]);
	};
	const shown = hover ?? view ?? (picked.length ? picked[picked.length - 1] : 0);   // PC 오른쪽 칸에 보이는 포켓몬
	const mm = String(Math.max(0, Math.floor(left / 60))).padStart(2, '0'), ss = String(Math.max(0, left % 60)).padStart(2, '0');
	const msg = done ? (opp === 'away' ? `${josa(oppName, 'conjunctive')}의 연결이 끊겼어요. 돌아오기를 기다리는 중…` : opp === 'done' ? '곧 배틀이 시작됩니다!' : `${josa(oppName, 'subject')} 고르는 중… 잠시 기다려 주세요.`)
		: need < mine.length ? `싸울 포켓몬을 ${need}마리 선택해 주십시오.` : '나갈 순서대로 포켓몬을 선택해 주십시오.';
	return <div class="opk">
		<div class="opk-top">
			<button class="opk-back" onClick={onLeave} aria-label="나가기">‹</button>
			<span class={'opk-timer' + (!done && left <= 10 ? ' low' : '')}>⏱ {done ? '--:--' : `${mm}:${ss}`}</span>
			<b class="opk-title">{title}</b>
		</div>
		<div class="opk-msg">{msg}{!done && <small>{wide ? '카드를 누르면 선택 · 오른쪽에 능력치' : '카드를 누르면 선택 · 오른쪽 위 i 는 능력치'}</small>}</div>
		<div class={'opk-cols' + (wide ? ' wide' : '')}>
			<div class="opk-col mine">
				<div class="opk-name me">{myName}</div>
				{mine.map((s, i) => {
					const o = picked.indexOf(i);
					return <div role="button" class={'opk-card' + (o >= 0 ? ' on' : '') + (done && o < 0 ? ' out' : '')} onClick={() => { toggle(i); if (wide) setView(i); }} onMouseEnter={() => wide && setHover(i)} onMouseLeave={() => setHover(null)}>
						<span class="opk-no">{o >= 0 ? o + 1 : ''}</span>
						<span class="opk-txt">
							<b>{s.name || speciesData(toID(s.species), 9)?.n || s.species}{sexMark(s)}</b>
							<small>{s.item ? <><ItemIcon item={s.item} size={16} />{itemKo(s.item)}</> : '도구 없음'}</small>
						</span>
						<span class="opk-spr"><CropSprite species={s.species} gen={9} size={56} shiny={s.shiny} /></span>
						<span class="opk-info" role="button" aria-label="능력치" onClick={e => { e.stopPropagation(); setView(i); }}><InfoIcon /></span>
					</div>;
				})}
			</div>
			<div class="opk-col foe">
				<div class={'opk-name foe' + (opp === 'away' ? ' away' : '')}>{oppName}<small>{opp === 'done' ? '선택 완료' : opp === 'away' ? '연결 끊김' : '고르는 중'}</small></div>
				{oppTeam.map(s => {
					const sd = speciesData(toID(s.species), 9);
					return <div class="opk-foe">
						<span class="opk-spr"><CropSprite species={s.species} gen={9} size={52} shiny={s.shiny} /></span>
						<span class="opk-types">{sd?.t.map(t => <TypeBadge type={t} small />)}{sexMark(s)}</span>
					</div>;
				})}
			</div>
			{wide && <div class="opk-detail">
				<div class="opk-name me">{mine[shown].name || speciesData(toID(mine[shown].species), 9)?.n} Lv{mine[shown].level || 50}{picked.includes(shown) && <small>{picked.indexOf(shown) + 1}번째</small>}</div>
				<MonDetail set={mine[shown]} gen={9} />
			</div>}
		</div>
		<div class="opk-bottom">
			{done ? <button class="opk-go" disabled>상대를 기다리는 중…</button>
				: <button class="opk-go" disabled={picked.length !== need} onClick={() => finish(picked)}><i>◎ {picked.length}/{need}</i>선택 완료</button>}
		</div>
		{view !== null && !wide && <MonSheet set={mine[view]} gen={9} onClose={() => setView(null)} actions={done ? [{ label: '닫기', kind: 'ghost', onClick: () => setView(null) }] : [
			picked.includes(view) ? { label: '선택 해제', kind: 'ghost', onClick: () => { toggle(view); setView(null); } }
				: { label: `선택 (${picked.length + 1}번째)`, disabled: picked.length >= need, onClick: () => { toggle(view); setView(null); } },
			{ label: '닫기', kind: 'ghost', onClick: () => setView(null) },
		]} />}
	</div>;
}
