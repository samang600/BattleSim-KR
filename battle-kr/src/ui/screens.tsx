/** 메뉴·선택 화면들 */
import { h, Fragment, type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { speciesData, toID, moveKo, itemKo, abilityKo, natureKo, typeKo, STAT_SHORT, STAT_KO, STATS, moveData, natureData, abilityDesc, itemDesc, calcStat, type Gen } from '../data';
import { evToSp, spToEv, evDisplay, fmtSP, type PSet } from '../sets';
import { SPRITE_URL, trainerImgError } from '../trainer-lines';
import { Screen, Sprite, MiniSprite, CropSprite, TypeBadge, Modal, HPBar, StatusBadge, TYPE_COLOR } from './core';

/** 세트 요약 카드 */
export function SetCard({ set, gen, selected, order, onClick, compact, children }: {
	set: PSet; gen: Gen; selected?: boolean; order?: number; onClick?: () => void; compact?: boolean; children?: ComponentChildren;
}) {
	const sd = speciesData(toID(set.species), gen);
	return <div class={'set-card' + (selected ? ' selected' : '') + (onClick ? ' clickable' : '')} onClick={onClick}>
		{order !== undefined && <span class="order">{order}</span>}
		<div class="set-sprite"><CropSprite species={set.species} gen={gen} size={64} shiny={set.shiny} /></div>
		<div class="set-body">
			<div class="set-title"><b>{set.name || sd?.n}</b>{sd?.t.map(t => <TypeBadge type={t} small />)}
				<span class="tera-tag" title="테라스탈 타입">테라<TypeBadge type={set.teraType || sd?.t[0] || 'Normal'} small /></span>
				{set.gigantamax && <span class="gmax-tag" title="거다이맥스">거다이</span>}</div>
			<div class="set-meta">{abilityKo(set.ability)} · {set.item ? itemKo(set.item) : '도구 없음'}{!compact && ` · ${natureKo(set.nature)}`}</div>
			<div class="set-moves">{set.moves.map(m => <span>{moveKo(m)}</span>)}</div>
		</div>
		{children}
	</div>;
}

/** N마리 고르기 (순서 = 선택 순서, 첫 번째가 선봉) */
export function PickScreen({ title, team, gen, count, opponent, hint, onDone, onBack }: {
	title: string; team: PSet[]; gen: Gen; count: number; opponent?: { name: string; team: PSet[] };
	hint?: string; onDone: (picked: PSet[]) => void; onBack?: () => void;
}) {
	const [picked, setPicked] = useState<number[]>([]);
	const [view, setView] = useState<number | null>(null);
	const toggle = (i: number) => {
		if (picked.includes(i)) setPicked(picked.filter(x => x !== i));
		else if (picked.length < count) setPicked([...picked, i]);
	};
	const need = Math.min(count, team.length);
	return <Screen title={title} onBack={onBack}>
		{opponent && <div class="preview">
			<div class="preview-title">상대: {opponent.name}</div>
			<div class="preview-row">{opponent.team.map(s => <MiniSprite species={s.species} gen={gen} size={44} shiny={s.shiny} />)}</div>
		</div>}
		<p class="hint">{hint || `${count}마리를 순서대로 고르세요. 처음 고른 포켓몬이 먼저 나갑니다.`} 카드를 누르면 능력치를 볼 수 있어요.</p>
		<div class="card-list">
			{team.map((s, i) => <SetCard set={s} gen={gen} selected={picked.includes(i)}
				order={picked.includes(i) ? picked.indexOf(i) + 1 : undefined} onClick={() => setView(i)} />)}
		</div>
		{view !== null && <MonSheet set={team[view]} gen={gen} onClose={() => setView(null)} actions={[
			picked.includes(view) ? { label: '선택 해제', kind: 'ghost', onClick: () => { toggle(view); setView(null); } }
				: { label: `선택 (${picked.length + 1}번째)`, disabled: picked.length >= need, onClick: () => { toggle(view); setView(null); } },
			{ label: '닫기', kind: 'ghost', onClick: () => setView(null) },
		]} />}
		<div class="sticky-bottom">
			{picked.length === 0 && <button class="btn ghost" onClick={() => onDone(team.slice(0, need))}>이 순서 그대로</button>}
			<button class="btn primary big" disabled={picked.length !== Math.min(count, team.length)}
				onClick={() => onDone(picked.map(i => team[i]))}>결정 ({picked.length}/{Math.min(count, team.length)})</button>
		</div>
	</Screen>;
}

/** 트레이너 등장 / 결과 같은 안내 화면 */
export function InfoScreen({ title, heading, lines, sprites, gen, actions, banner, children, trainer, sets }: {
	title: string; heading?: string; lines?: string[]; sprites?: string[]; gen?: Gen; banner?: string; children?: ComponentChildren; trainer?: string; sets?: PSet[];
	actions: { label: string; kind?: 'primary' | 'ghost' | 'danger' | 'yellow'; onClick: () => void }[];
}) {
	const [view, setView] = useState<number | null>(null);
	return <Screen title={title}>
		<div class="info-screen">
			{banner && <div class="banner">{banner}</div>}
			{trainer && <img class="trainer-big" src={SPRITE_URL(trainer)} alt="" onError={trainerImgError} />}
			{heading && <h2>{heading}</h2>}
			{sprites && <div class="preview-row big grid" style={{ gridTemplateColumns: `repeat(${sprites.length === 4 ? 2 : Math.min(3, sprites.length)}, auto)` }}>{sprites.map((s, i) => <span class={sets ? 'clickable' : ''} onClick={() => sets && setView(i)}><Sprite species={s} gen={gen || 5} size={64} shiny={sets?.[i]?.shiny} /></span>)}</div>}
			{sets && <p class="muted small">포켓몬을 누르면 능력치를 볼 수 있어요.</p>}
			{sets && view !== null && <MonSheet set={sets[view]} gen={gen || 9} onClose={() => setView(null)} actions={[{ label: '닫기', kind: 'ghost', onClick: () => setView(null) }]} />}
			{lines?.map(l => <p class="pre">{l}</p>)}
			{children}
		</div>
		<div class="sticky-bottom col">
			{actions.map(a => <button class={'btn big ' + (a.kind || 'primary')} onClick={a.onClick}>{a.label}</button>)}
		</div>
	</Screen>;
}

/** 팩토리 교환 */
export function SwapScreen({ mine, theirs, gen, onDone }: {
	mine: PSet[]; theirs: PSet[]; gen: Gen; onDone: (r: { give: number; take: number } | null) => void;
}) {
	const [give, setGive] = useState(-1);
	const [take, setTake] = useState(-1);
	const [view, setView] = useState<{ side: 'mine' | 'theirs'; i: number } | null>(null);
	return <Screen title="포켓몬 교환">
		<p class="hint">방금 이긴 상대의 포켓몬과 1마리를 교환할 수 있습니다.</p>
		<h3 class="sec">내보낼 포켓몬</h3>
		<div class="card-list">{mine.map((s, i) => <SetCard set={s} gen={gen} compact selected={give === i} onClick={() => setView({ side: 'mine', i })} />)}</div>
		<h3 class="sec">받을 포켓몬</h3>
		<div class="card-list">{theirs.map((s, i) => <SetCard set={s} gen={gen} compact selected={take === i} onClick={() => setView({ side: 'theirs', i })} />)}</div>
		{view && <MonSheet set={(view.side === 'mine' ? mine : theirs)[view.i]} gen={gen} onClose={() => setView(null)} actions={[
			view.side === 'mine' ? { label: give === view.i ? '선택됨 (내보냄)' : '이 포켓몬을 내보내기', onClick: () => { setGive(view.i); setView(null); } }
				: { label: take === view.i ? '선택됨 (받음)' : '이 포켓몬을 받기', onClick: () => { setTake(view.i); setView(null); } },
			{ label: '닫기', kind: 'ghost', onClick: () => setView(null) },
		]} />}
		<div class="sticky-bottom row">
			<button class="btn ghost big" onClick={() => onDone(null)}>교환 안 함</button>
			<button class="btn primary big" disabled={give < 0 || take < 0} onClick={() => onDone({ give, take })}>교환</button>
		</div>
	</Screen>;
}

/** 선택지 목록 */
export function ChoiceScreen<T>({ title, intro, footer, options, onPick, onBack }: {
	title: string; intro?: ComponentChildren; footer?: ComponentChildren; onBack?: () => void;
	options: { value: T; label: string; desc?: string; badge?: string; disabled?: boolean; icon?: ComponentChildren }[];
	onPick: (v: T) => void;
}) {
	return <Screen title={title} onBack={onBack}>
		{intro}
		<div class="option-list">
			{options.map(o => <button class="option" disabled={o.disabled} onClick={() => onPick(o.value)}>
				{o.icon && <span class="opt-icon">{o.icon}</span>}
				<span class="opt-body"><b>{o.label}</b>{o.desc && <small>{o.desc}</small>}</span>
				{o.badge && <span class="opt-badge">{o.badge}</span>}
			</button>)}
		</div>
		{footer}
	</Screen>;
}

/** 대진표 */
export function BracketView({ rounds, highlight }: { rounds: string[][]; highlight: string }) {
	const names = ['1회전', '준결승', '결승', '우승'];
	return <div class="bracket">
		{rounds.map((r, ri) => <div class="b-round">
			<div class="b-title">{names[ri]}</div>
			{r.map(n => <div class={'b-entry' + (n === highlight ? ' me' : '') + (!n ? ' tbd' : '')}>{n || '?'}</div>)}
		</div>)}
	</div>;
}

/** 포켓몬 상세 정보 시트 (선택·교체 전에 확인) */
export interface LiveInfo { hp: number; maxhp: number; status?: string; pp?: { [move: string]: [number, number] }; stats?: { [k: string]: number }; boosts?: { [k: string]: number } }
export function MonSheet({ set, gen, live, actions, onClose, note }: {
	set: PSet; gen: Gen; live?: LiveInfo; note?: string; onClose: () => void;
	actions?: { label: string; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; onClick: () => void }[];
}) {
	const sd = speciesData(toID(set.species), gen);
	const nat = natureData(set.nature);
	const level = set.level || 50;
	return <Modal title={`${set.name || sd?.n} Lv${level}`} onClose={onClose}>
		<div class="sheet">
			<div class="sheet-head">
				<div class="sheet-sprite"><Sprite species={set.species} gen={gen} size={96} shiny={set.shiny} /></div>
				<div class="sheet-info">
					<div class="types">{sd?.t.map(t => <TypeBadge type={t} />)}</div>
					{sd && sd.n !== set.name && <div class="muted small">{sd.n}</div>}
					{set.teraType && <div class="small">테라스탈 <TypeBadge type={set.teraType} small /></div>}
					{live && <div class="sheet-hp"><HPBar hp={live.hp} maxhp={live.maxhp || 1} /><span>{live.hp}/{live.maxhp}</span> <StatusBadge status={live.status} /></div>}
				</div>
			</div>
			{note && <p class="sheet-note">{note}</p>}
			<div class="sheet-row"><span class="lbl">특성</span><div><b>{abilityKo(set.ability)}</b><small class="muted block">{abilityDesc(set.ability)}</small></div></div>
			<div class="sheet-row"><span class="lbl">도구</span><div><b>{set.item ? itemKo(set.item) : '없음'}</b><small class="muted block">{set.item ? itemDesc(set.item) : ''}</small></div></div>
			<div class="sheet-row"><span class="lbl">성격</span><div><b>{natureKo(set.nature)}</b>{nat?.p && <small class="muted"> {STAT_KO[nat.p]}▲ {STAT_KO[nat.m]}▼</small>}</div></div>
			<div class="stat-bars">
				{STATS.map((k, i) => {
					const natMul = nat?.p === k ? 1.1 : nat?.m === k ? 0.9 : 1;
					const base = sd?.bs[i] || 0;
					const val = live?.stats?.[k] ?? (k === 'hp' && live ? live.maxhp : calcStat(base, spToEv(evToSp(set.evs[k] || 0)), 31, level, natMul, k === 'hp'));
					const boost = live?.boosts?.[k] || 0;
					return <div class="stat-bar">
						<span class={'sb-label' + (natMul > 1 ? ' up' : natMul < 1 ? ' down' : '')}>{STAT_SHORT[k]}</span>
						<span class="sb-track"><span class="sb-fill" style={{ width: Math.min(100, base / 180 * 100) + '%', background: base >= 120 ? '#40c8a0' : base >= 90 ? '#58d058' : base >= 60 ? '#e8c830' : '#e86030' }} /></span>
						<span class="sb-base">{base}</span>
						<b class="sb-val">{val}{boost ? <small class={boost > 0 ? 'up' : 'down'}> {boost > 0 ? '+' : ''}{boost}</small> : null}</b>
						<span class="sb-ev">{set.evs[k] ? (evDisplay() ? `노력치 ${spToEv(evToSp(set.evs[k]))}` : `SP ${evToSp(set.evs[k])}`) : ''}</span>
					</div>;
				})}
			</div>
			<div class="sheet-moves">
				{set.moves.map(m => {
					const md = moveData(m, gen);
					const pp = live?.pp?.[toID(m)];
					return <div class="sheet-move" style={{ '--tc': TYPE_COLOR[md?.type || 'Normal'] } as any}>
						<div class="sm-top"><b>{moveKo(m)}</b>{md && <TypeBadge type={md.type} small />}
							<span class="muted small">{md ? (md.category === 'Physical' ? '물리' : md.category === 'Special' ? '특수' : '변화') : ''}</span>
							<span class="sm-num">위력 {md?.basePower || '—'} · 명중 {md?.accuracy || '—'} · PP {pp ? `${pp[0]}/${pp[1]}` : md?.pp ? Math.floor(md.pp * 8 / 5) : '-'}</span></div>
						{md?.desc && <small class="muted block">{md.desc}</small>}
					</div>;
				})}
			</div>
			{actions && actions.length > 0 && <div class="sheet-actions">
				{actions.map(a => <button class={'btn ' + (a.kind || 'primary')} disabled={a.disabled} onClick={a.onClick}>{a.label}</button>)}
			</div>}
		</div>
	</Modal>;
}

export function SetDetailModal({ set, gen, onClose }: { set: PSet; gen: Gen; onClose: () => void }) {
	const sd = speciesData(toID(set.species), gen);
	return <Modal title={set.name} onClose={onClose}>
		<div class="detail">
			<div class="detail-head"><Sprite species={set.species} gen={gen} size={96} shiny={set.shiny} />
				<div>{sd?.t.map(t => <TypeBadge type={t} />)}<p class="muted">종족값 {sd?.bs.join('/')}</p></div></div>
			<p>{abilityKo(set.ability)} · {itemKo(set.item)} · {natureKo(set.nature)}</p>
			<p class="muted">{evDisplay() ? '노력치' : '능력 포인트'} {Object.entries(set.evs).filter(([, v]) => v).map(([k, v]) => `${STAT_SHORT[k]} ${fmtSP(evToSp(v))}`).join(' / ')}</p>
			<ul class="move-list">{set.moves.map(m => <li>{moveKo(m)}</li>)}</ul>
		</div>
	</Modal>;
}
void Fragment; void typeKo;
