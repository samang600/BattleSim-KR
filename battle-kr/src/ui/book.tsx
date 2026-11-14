/** 트레이너 수첩: 카드(심볼·시즌·클리어) · 업적 · 포켓몬별 통계 · 도감 */
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Screen, MiniSprite } from './core';
import { loadRecords, loadSettings } from '../store';
import { loadStats, ACHIEVEMENTS, achLevel, achTier, achDesc, TIER_NAME, SYMBOL_INFO, BOSS_LEN, symBest, symOf, CHAMP_ON, type AchCat, type SymbolKind } from '../stats';
import { speciesKo, RAW } from '../data';
import { REGIONS, regionLabel } from '../trainers';
import { SPRITE_URL, trainerImgError } from '../trainer-lines';
import { rankLabel, seasonOf, seasonLeft } from '../modes';
import { cardSkin, cardSkinClass, starGlyph, TitleChip, CardExtras, BpCoin, useWallet } from './shop';
import { sfx } from '../sound';
import { titleItem, achPending, claimAch, pendingAchTotal } from '../rewards';
import { loadWallet, bookCover } from '../rewards';

const TIER_COL = ['#5a6478', '#c07a3a', '#c8d0dc', '#f0c020', '#9ae8f0'];
/** 도트 메달 (단계 색) */
export function Medal({ tier, size = 20 }: { tier: number; size?: number }) {
	const c = TIER_COL[tier];
	const m = ['0011100', '0122210', '1223221', '1233321', '1223221', '0122210', '0011100'];
	const cols = ['', '#141a26', c, tier ? '#ffffff' : c];
	return <svg width={size} height={size} viewBox="0 0 7 7" shape-rendering="crispEdges" class="pix-medal">{m.flatMap((r, y) => [...r].map((ch, x) => ch !== '0' ? <rect x={x} y={y} width="1" height="1" fill={cols[+ch]} opacity={!tier && ch === '3' ? 0.4 : 1} /> : null))}</svg>;
}
export { SymbolIcon } from './pixel-icons';
import { SymbolIcon } from './pixel-icons';

export function TrainerBook({ onBack, initial = 'card' }: { onBack: () => void; initial?: string }) {
	const [tab, setTab] = useState(initial);
	const st = loadStats(), rec = loadRecords(), set = loadSettings();
	const TABS: [string, string][] = [['card', '카드'], ['ach', pendingAchTotal() > 0 ? '업적 •' : '업적'], ['mons', '포켓몬'], ['dex', '도감']];
	return <Screen title="트레이너 수첩" onBack={onBack} top cls={'book-scr' + (bookCover(st) ? ' cover-' + bookCover(st) : '')}>
		<div class="seg book-tabs">{TABS.map(([k, n]) => <button class={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{n}</button>)}</div>
		{tab === 'card' && <Card st={st} rec={rec} set={set} />}
		{tab === 'ach' && <Achievements st={st} />}
		{tab === 'mons' && <MonStats st={st} />}
		{tab === 'dex' && <Dex st={st} />}
	</Screen>;
}

function Card({ st, rec, set }: any) {
	const done = ACHIEVEMENTS.filter(a => (st.ach[a.id] || 0) > 0).length;
	const season = seasonOf();
	const w = loadWallet();
	const rp = (k: string) => Object.entries(rec.rp || {}).filter(([x]) => x.startsWith(k)).reduce((a, [, v]) => Math.max(a, v as number), 0);
	const stars = Math.min(5, (st.sym.tower ? 1 : 0) + (st.sym.factory ? 1 : 0) + (st.sym.rank ? 1 : 0) + (Object.keys(st.conquest).length >= 3 ? 1 : 0) + (rp('') >= 1200 ? 1 : 0));
	return <div class="book-card">
		<div class={'bk-tcard' + cardSkinClass(w)} style={cardSkin(w)}>
			<img class="bk-tcard-img" src={SPRITE_URL(set.playerSprite || 'lucas')} onError={trainerImgError} />
			<div class="bk-tcard-body">
				<b>{set.playerName || '플레이어'}<TitleChip it={titleItem(w)} /></b>
				<span class="bk-tcard-stars">{starGlyph(w).repeat(stars)}<i>{starGlyph(w).repeat(5 - stars)}</i></span>
				<small class="bk-bp"><BpCoin size={10} /> {w.bp} BP · 지금까지 {w.total} BP</small>
				<small>전적 {rec.wins}승 {rec.battles - rec.wins}패 · 업적 {done}/{ACHIEVEMENTS.length}</small>
				<small>쓴 포켓몬 {Object.keys(st.used).length}종 · 쓰러뜨린 포켓몬 {Object.keys(st.beaten).length}종</small>
			</div>
			<CardExtras />
		</div>
		<h3 class="sec">심볼</h3>
		<div class="sym-row">{((CHAMP_ON ? ['tower', 'factory', 'palace'] : ['tower', 'factory', 'palace', 'rank']) as SymbolKind[]).map(k => <div class="sym-cell"><SymbolIcon kind={k} lv={symBest(st, k).lv} diff={symBest(st, k).diff} size={48} /><b>{SYMBOL_INFO[k].name}</b><small>{SYMBOL_INFO[k].facility} · {symBest(st, k).lv === 2 ? '금' : symBest(st, k).lv ? '은' : '미획득'}</small>
			{(k === 'tower' || k === 'factory') && <span class="sym-diffs">{([['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']] as const).map(([d, l]) => <span class={symOf(st, k, d) ? 'got' : ''}><SymbolIcon kind={k} lv={symOf(st, k, d)} diff={d} size={24} /><i>{l}</i></span>)}</span>}<small class="sym-how">{k === 'rank' ? '은: 챔피언급 도달 · 금: 시즌을 챔피언급으로 마감' : k === 'palace' ? '은: 21번째 · 금: 49번째 팰리스 메이븐 격파' : '은: 21번째 · 금: 49번째 브레인 격파'}</small></div>)}</div>
		<h3 class="sec">랭크 시즌 <small class="muted">시즌 {season.no} · {seasonLeft()}</small></h3>
		<div class="kv"><span>싱글</span><b>{rankLabel(rp('singles'))} · {rp('singles')} RP</b></div>
		<div class="kv"><span>더블</span><b>{rankLabel(rp('doubles'))} · {rp('doubles')} RP</b></div>
		{st.seasons.length > 0 && <div class="season-list">{st.seasons.slice(-8).reverse().map((x: any) => <div class="kv small"><span>시즌 {x.id.slice(1)} · {x.fmt.startsWith('doubles') ? '더블' : '싱글'}</span><b>{x.tier} ({x.rp} RP)</b></div>)}</div>}
		<h3 class="sec">보스 러시 · 지방 클리어</h3>
		<div class="conq-grid">{REGIONS.filter(r => r !== '애니메이션').map(r => <span class={'conq' + (st.conquest[r] ? ' on' : '')}>{r}{st.conquest[r] === 2 ? ' ★★' : st.conquest[r] ? ' ★' : ''}</span>)}</div>
		<h3 class="sec">보스 러시 · 시나리오 / 오늘의 도전</h3>
		{Object.keys(BOSS_LEN).map(k => <div class="kv"><span>{k === 'villain' ? '악의 조직 보스' : k === 'admin' ? '악의 조직 간부' : '역대 챔피언'}</span><b>{st.boss[k] || 0} / {BOSS_LEN[k]}</b></div>)}
		<div class="kv"><span>오늘의 도전 연속 참가</span><b>{st.dailyStreak || 0}일 (최고 {st.c.dailyStreakMax || 0}일)</b></div>
		<div class="kv"><span>오늘의 도전 완주</span><b>{Object.values(st.daily).filter((v: any) => v >= 7).length}회</b></div>
	</div>;
}

function Achievements({ st: st0 }: any) {
	const cats: AchCat[] = ['배틀', '기믹', '타입', '시설', '네임드', '랭크', '도전', '수집', ...(CHAMP_ON ? ['챔피언스' as AchCat] : [])];
	const [cat, setCat] = useState<AchCat>('배틀');
	const w = useWallet();   // 보상을 받으면 다시 그림
	const st = loadStats();
	void st0;
	const list = ACHIEVEMENTS.filter(a => a.cat === cat);
	const total = pendingAchTotal(st, w);
	const catPending = (c: AchCat) => ACHIEVEMENTS.some(a => a.cat === c && achPending(a, st, w) > 0);
	return <div>
		{total > 0 && <div class="ach-claimall"><span><BpCoin size={16} /> 받을 수 있는 업적 보상 <b>{total} BP</b></span>
			<button class="btn small primary" onClick={() => { const n = claimAch(ACHIEVEMENTS.map(a => a.id)); if (n) sfx('select'); }}>모두 받기</button></div>}
		<div class="seg wrap ach-cats">{cats.map(c => { const n = ACHIEVEMENTS.filter(a => a.cat === c); const d = n.filter(a => (st.ach[a.id] || 0) >= a.steps.length).length;
			return <button class={(cat === c ? 'on' : '') + (catPending(c) ? ' has-claim' : '')} onClick={() => setCat(c)}>{c} <small>{d}/{n.length}</small></button>; })}</div>
		<div class="ach-list">{list.map(a => {
			const v = a.value(st), l = achLevel(a, v), next = a.steps[Math.min(l, a.steps.length - 1)], done = l >= a.steps.length;
			const p = achPending(a, st, w);
			return <div class={'ach-row' + (l ? ' got' : '') + (p ? ' claim' : '')}>
				<Medal tier={achTier(a, l)} size={28} />
				<div class="ach-body">
					<b>{a.name}{l > 0 && a.steps.length > 1 && <small class="ach-tier" style={{ color: TIER_COL[achTier(a, l)] }}> {TIER_NAME[achTier(a, l)]}</small>}</b>
					<small>{achDesc(a, done ? a.steps.length - 1 : l)}</small>
					<div class="ach-bar"><i style={{ width: Math.min(100, v / next * 100) + '%' }} /><span>{done ? '완료' : `${Math.min(v, next)} / ${next}`}</span></div>
				</div>
				{p > 0 ? <button class="ach-claim" onClick={() => { if (claimAch([a.id])) sfx('select'); }}><span><BpCoin size={12} /><b>+{p}</b></span><small>받기</small></button>
					: <span class="ach-pips">{a.steps.map((_, i) => <i class={i < l ? 'on' : ''} />)}</span>}
			</div>;
		})}</div>
	</div>;
}

function MonStats({ st }: any) {
	const [sort, setSort] = useState<'u' | 'w' | 'ko' | 'mvp'>('u');
	const rows = Object.entries(st.mons as { [k: string]: any }).sort((a, b) => b[1][sort] - a[1][sort]);
	if (!rows.length) return <p class="muted small">아직 기록이 없습니다. 배틀을 하면 포켓몬마다 출전·승리·쓰러뜨린 수·MVP가 쌓여요.</p>;
	return <div>
		<div class="seg">{([['u', '출전'], ['w', '승리'], ['ko', '쓰러뜨림'], ['mvp', 'MVP']] as const).map(([k, n]) => <button class={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{n}</button>)}</div>
		<p class="muted small">포켓몬별 업적(챔피언스 방식): 10승 ★ · 50승 ★★ · 100승 ★★★. MVP 는 이긴 배틀에서 가장 많이 쓰러뜨린 포켓몬.</p>
		<div class="mon-stats">{rows.slice(0, 80).map(([sid, m]) => <div class={'mon-stat' + (m.w >= 100 ? ' w100' : '')}>
			<MiniSprite species={sid} size={40} />
			<div class="ms-body"><b>{speciesKo(sid)} <span class="ms-star">{m.w >= 100 ? '★★★' : m.w >= 50 ? '★★' : m.w >= 10 ? '★' : ''}</span></b>
				<small>출전 {m.u} · 승리 {m.w} ({m.u ? Math.round(m.w / m.u * 100) : 0}%) · 쓰러뜨림 {m.ko} · 쓰러짐 {m.f} · MVP {m.mvp}</small></div>
		</div>)}</div>
	</div>;
}

function Dex({ st }: any) {
	const [k, setK] = useState<'used' | 'faced' | 'beaten'>('used');
	const total = new Set(Object.values(RAW.species as any).map((s: any) => s.num).filter((n: number) => n > 0)).size || 1025;
	const ids = Object.keys(st[k]);
	return <div>
		<div class="seg">{([['used', `써 본 ${Object.keys(st.used).length}`], ['faced', `만난 ${Object.keys(st.faced).length}`], ['beaten', `쓰러뜨린 ${Object.keys(st.beaten).length}`]] as const).map(([x, n]) => <button class={k === x ? 'on' : ''} onClick={() => setK(x)}>{n}</button>)}</div>
		<p class="muted small">전체 약 {total}종 중 {ids.length}종 ({Math.round(ids.length / total * 1000) / 10}%)</p>
		<div class="dex-grid">{ids.sort().map(id => <span class="dex-cell" title={speciesKo(id)}><MiniSprite species={id} size={40} /></span>)}</div>
	</div>;
}
void regionLabel;
