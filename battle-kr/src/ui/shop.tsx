/** BP 교환소 · 트레이너 카드 꾸미기 · 지방 배지 · 승리 연출 (보상 시스템 화면, src/rewards.ts) */
import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Screen, Sprite, MiniSprite, ItemIcon, toast } from './core';
import { loadWallet, onWallet, ITEMS, SLOT_INFO, owns, buy, equip, itemById, weeklyStatus, WEEK_ALL_BP, regionBadges, partnerMon, setBuddy, buddyCandidates, type Item, type Slot, type Wallet } from '../rewards';
import { loadStats } from '../stats';
import { loadSettings, loadTeams } from '../store';
import { SPRITE_URL, trainerImgError } from '../trainer-lines';
import { REGION_COLOR, REGIONS } from '../trainers';
import { speciesKo } from '../data';
import { playMusic, stopMusic } from '../sound';

// ───────── 도트 그림 ─────────
/** BP 동전 (8×8 도트) */
export function BpCoin({ size = 16 }: { size?: number }) {
	const m = ['00111100', '01222210', '12233221', '12322321', '12322321', '12233221', '01222210', '00111100'];
	const c = ['', '#7a4a08', '#f0b828', '#fff0a0'];
	return <svg class="bp-coin-svg" width={size} height={size} viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">
		{m.flatMap((r, y) => [...r].map((ch, x) => ch !== '0' ? <rect x={x} y={y} width="1" height="1" fill={c[+ch]} /> : null))}</svg>;
}
/** 지방 배지 (9×9 모양 + 진한 외곽선, 위·왼쪽 한 칸 밝게). ★★ 는 금색 테두리 */
const BADGE_SHAPES: string[][] = [
	['....1....', '...111...', '..11111..', '.1111111.', '111111111', '.1111111.', '..11111..', '...111...', '....1....'],
	['..11111..', '.1111111.', '111111111', '111111111', '111111111', '111111111', '111111111', '.1111111.', '..11111..'],
	['111111111', '111111111', '111111111', '111111111', '.1111111.', '.1111111.', '..11111..', '...111...', '....1....'],
	['....1....', '....1....', '...111...', '111111111', '.1111111.', '..11111..', '..11.11..', '.11...11.', '.1.....1.'],
	['....111..', '...111...', '..111....', '.1111111.', '...111...', '..111....', '.111.....', '.11......', '.1.......'],
	['....1....', '...111...', '...111...', '..11111..', '.1111111.', '111111111', '111111111', '.1111111.', '..11111..'],
	['.....1111', '...111111', '..1111111', '.11111111', '.1111111.', '11111111.', '1111111..', '111111...', '1.11.....'],
	['1...1...1', '11.111.11', '111111111', '111111111', '111111111', '.1111111.', '.1111111.', '.........', '.........'],
	['...111...', '.1.111.1.', '.1111111.', '111...111', '111...111', '111...111', '.1111111.', '.1.111.1.', '...111...'],
	['.11...11.', '1111.1111', '111111111', '111111111', '.1111111.', '..11111..', '...111...', '....1....', '.........'],
];
const shade = (hex: string, k: number) => '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)))).map(v => v.toString(16).padStart(2, '0')).join('');
export function RegionBadge({ region, gold, size = 22 }: { region: string; gold?: boolean; size?: number }) {
	const idx = Math.max(0, REGIONS.indexOf(region as any)) % BADGE_SHAPES.length;
	const shape = BADGE_SHAPES[idx];
	const fill = REGION_COLOR[region] || '#888';
	const on = (x: number, y: number) => y >= 0 && y < 9 && x >= 0 && x < 9 && shape[y][x] === '1';
	const rects: h.JSX.Element[] = [];
	for (let y = -1; y <= 9; y++) for (let x = -1; x <= 9; x++) {
		if (on(x, y)) rects.push(<rect x={x + 1} y={y + 1} width="1" height="1" fill={!on(x, y - 1) || !on(x - 1, y) ? shade(fill, 1.45) : !on(x, y + 1) || !on(x + 1, y) ? shade(fill, .7) : fill} />);
		else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) rects.push(<rect x={x + 1} y={y + 1} width="1" height="1" fill={gold ? '#ffd84a' : '#141a26'} />);
	}
	return <svg class="region-badge" width={size} height={size} viewBox="0 0 11 11" shape-rendering="crispEdges" aria-label={region + ' 배지'}><title>{region}{gold ? ' (어려움)' : ''}</title>{rects}</svg>;
}

// ───────── 트레이너 카드 꾸미기 ─────────
/** 장착한 카드 배경·테두리를 CSS 변수로 */
export function cardSkin(w: Wallet = loadWallet()): any {
	const out: any = {};
	const bg = w.eq.cardBg ? itemById(w.eq.cardBg)?.v : '';
	if (bg) { const c = bg.split(','); out['--cb1'] = c[0]; out['--cb2'] = c[1]; out['--cb3'] = c[2]; out['--cb4'] = c[3]; }
	const fr = w.eq.frame ? itemById(w.eq.frame)?.v : '';
	if (fr) { const c = fr.split(','); out['--fr1'] = c[0]; out['--fr2'] = c[1]; }
	return out;
}
export const cardSkinClass = (w: Wallet = loadWallet()) => (w.eq.cardBg ? ' skin-bg' : '') + (w.eq.frame ? ' skin-fr' : '');
export const starGlyph = (w: Wallet = loadWallet()) => (w.eq.star ? itemById(w.eq.star)?.v : '') || '★';
export const equippedTitle = (w: Wallet = loadWallet()) => (w.eq.title ? itemById(w.eq.title)?.name : '') || '';
export function useWallet() { const [w, setW] = useState(loadWallet()); useEffect(() => onWallet(setW), []); return w; }

/** 수첩 카드 아래 줄: 지방 배지 + 단짝 */
export function CardExtras() {
	const st = loadStats();
	const badges = regionBadges(st);
	const pal = partnerMon(st);
	if (!badges.length && !pal) return null;
	return <div class="card-extras">
		{badges.length > 0 && <span class="badge-row">{badges.map(b => <RegionBadge region={b.region} gold={b.gold} />)}</span>}
		{pal && <span class="partner-mon"><MiniSprite species={pal} gen={9} size={32} /><small>단짝 {speciesKo(pal)}</small></span>}
	</div>;
}

// ───────── 승리 연출 ─────────
export function WinFx({ kind }: { kind: string }) {
	if (kind === 'win:confetti') {
		const cols = ['#ff5a5a', '#ffd84a', '#5ad8ff', '#7aff7a', '#ff8ae0', '#ffffff'];
		return <div class="win-fx confetti" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i style={{ left: `${(i * 37) % 100}%`, background: cols[i % cols.length], animationDelay: `${(i % 9) * 0.12}s`, animationDuration: `${1.6 + (i % 5) * 0.2}s` }} />)}</div>;
	}
	if (kind === 'win:stars') {
		return <div class="win-fx stars" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <i style={{ left: `${(i * 41 + 7) % 96}%`, top: `${(i * 23 + 5) % 90}%`, animationDelay: `${(i % 7) * 0.15}s` }} />)}</div>;
	}
	if (kind === 'win:flag') return <div class="win-fx flag" aria-hidden="true"><div class="win-flag"><span>WIN!</span></div></div>;
	return null;
}

// ───────── 교환소 화면 ─────────
const TABS: { id: string; name: string; slots: Slot[] }[] = [
	{ id: 'title', name: '칭호', slots: ['title'] },
	{ id: 'card', name: '카드', slots: ['cardBg', 'frame', 'star'] },
	{ id: 'trainer', name: '트레이너', slots: ['trainer'] },
	{ id: 'fx', name: '연출', slots: ['ball', 'win', 'hp'] },
	{ id: 'av', name: '배경·음악', slots: ['bg', 'bgm'] },
	{ id: 'home', name: '메인', slots: ['home', 'buddy'] },
];
function Preview({ it }: { it: Item }) {
	switch (it.slot) {
		case 'title': return <span class="pv-title">{it.name}</span>;
		case 'cardBg': { const c = it.v!.split(','); return <span class="pv-swatch" style={{ '--cb1': c[0], '--cb2': c[1], '--cb3': c[2], '--cb4': c[3] } as any} />; }
		case 'frame': { const c = it.v!.split(','); return <span class="pv-frame" style={{ '--fr1': c[0], '--fr2': c[1] } as any} />; }
		case 'star': return <span class="pv-star">{it.v}{it.v}{it.v}</span>;
		case 'trainer': return <img class="pv-trainer" src={SPRITE_URL(it.v!)} onError={trainerImgError} alt="" loading="lazy" />;
		case 'ball': return <span class="pv-ball"><ItemIcon item={it.v!} /></span>;
		case 'win': return <span class={'pv-win ' + it.id.slice(4)}><i /><i /><i /><i /><i /></span>;
		case 'hp': { const c = it.v!.split(','); return <span class="pv-hp" style={{ '--h1': c[0], '--h2': c[1] } as any}><b /><i /></span>; }
		case 'bg': return <span class={'arena-thumb pv-bg bg-' + it.v}><span class="arena-bg" /></span>;
		case 'bgm': return <span class="pv-bgm">♪</span>;
		case 'home': return <span class={'arena-thumb pv-bg pv-home bg-' + it.v}><span class="arena-bg" /></span>;
		case 'buddy': { const b = loadWallet().buddy; return <span class="pv-buddy"><Sprite species={b?.sp || 'pikachu'} gen={9} size={56} anim={false} shiny={b?.shiny} /></span>; }
	}
}
/** 대표 포켓몬 고르기: 써 본 포켓몬·저장한 팀의 포켓몬 중에서 (이로치로도) */
function BuddyPicker({ w }: { w: Wallet }) {
	const list = buddyCandidates(loadTeams());
	const cur = w.buddy;
	return <div class="buddy-pick">
		<div class="bp-head"><b>대표 포켓몬 고르기</b>
			<label class="bp-shiny"><input type="checkbox" checked={!!cur?.shiny} disabled={!cur} onChange={e => cur && setBuddy(cur.sp, (e.target as HTMLInputElement).checked)} /> 이로치</label>
			{cur && <button class="btn small ghost" onClick={() => setBuddy(null)}>내리기</button>}</div>
		{list.length ? <div class="bp-grid">{list.map(sp => <button class={'bp-cell' + (cur?.sp === sp ? ' on' : '')} onClick={() => setBuddy(sp, cur?.sp === sp ? cur.shiny : false)} title={speciesKo(sp)}>
			<MiniSprite species={sp} gen={9} size={40} shiny={cur?.sp === sp && cur.shiny} /></button>)}</div>
			: <p class="muted small">배틀에서 써 본 포켓몬이나 저장한 팀이 있으면 여기에 나와요.</p>}
	</div>;
}
export function ShopScreen({ onBack }: { onBack: () => void }) {
	const w = useWallet();
	const st = loadStats();
	const [tab, setTab] = useState('title');
	const [, force] = useState(0);
	const settings = loadSettings();
	const isOn = (it: Item) => it.slot === 'trainer' ? settings.playerSprite === it.v : it.slot === 'bg' ? settings.battleBg === it.v : it.slot === 'bgm' ? settings.battleBgm === it.v : it.slot === 'home' ? settings.homeBg === it.v : w.eq[it.slot] === it.id;
	const act = (it: Item) => {
		if (!owns(it, w, st)) {
			const r = buy(it);
			if (r === 'poor') { toast(`BP 가 ${it.price! - w.bp} 모자라요`); return; }
			if (r === 'locked') { toast(`${it.condText} 달성 시 열려요`); return; }
			toast(`「${it.name}」을(를) 교환했어요!`);
		}
		if (isOn(it) && !['trainer', 'bg', 'bgm'].includes(it.slot)) { equip(null, it.slot); toast(it.slot === 'home' ? '기본 배경으로 돌렸어요' : '장착을 풀었어요'); }
		else { equip(it, it.slot); if (it.slot === 'bgm') { playMusic(it.v!); setTimeout(stopMusic, 6000); } }
		force(x => x + 1);
	};
	const weekly = weeklyStatus();
	const tabDef = TABS.find(t => t.id === tab)!;
	return <Screen title="BP 교환소" onBack={onBack} cls="shop-scr" top>
		<div class="shop-head">
			<div class="shop-wallet">
				<BpCoin size={32} />
				<span><small>가진 BP</small><b>{w.bp}</b></span>
				<em>지금까지 {w.total} BP</em>
			</div>
			<div class="shop-week">
				<div class="wk-title">이번 주 과제 <small>모두 하면 +{WEEK_ALL_BP}</small></div>
				{weekly.map(m => <div class={'wk-row' + (m.done ? ' done' : '')}>
					<span class="wk-text">{m.text}</span>
					<span class="wk-bar"><i style={{ width: `${m.prog / m.goal * 100}%` }} /></span>
					<span class="wk-num">{m.done ? '완료' : `${m.prog}/${m.goal}`}</span>
					<span class="wk-bp"><BpCoin size={10} />{m.bp}</span>
				</div>)}
			</div>
		</div>
		<p class="hint shop-hint">배틀에서 이기고 연승·업적·과제를 달성하면 BP 가 쌓여요. 교환한 것은 모두 꾸미기용이라 배틀 능력에는 영향이 없어요.</p>
		<div class="seg shop-tabs">{TABS.map(t => <button class={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.name}</button>)}</div>
		{tabDef.slots.map(slot => <section class="shop-sec">
			{tabDef.slots.length > 1 && <h3 class="sec">{SLOT_INFO[slot].name} <small class="muted">{SLOT_INFO[slot].desc}</small></h3>}
			{tabDef.slots.length === 1 && <p class="muted small">{SLOT_INFO[slot].desc}</p>}
			<div class={'shop-grid slot-' + slot}>{ITEMS.filter(i => i.slot === slot).map(it => {
				const have = owns(it, w, st), on = have && isOn(it);
				return <button class={'shop-item' + (have ? ' have' : '') + (on ? ' on' : '') + (it.cond && !have ? ' locked' : '')} onClick={() => act(it)}>
					<span class="sx-pv"><Preview it={it} /></span>
					<span class="sx-name">{it.name}</span>
					{it.desc && <small class="sx-desc">{it.desc}</small>}
					<span class="sx-foot">{on ? <em class="sx-on">장착 중</em> : have ? <em class="sx-own">장착하기</em> : it.cond ? <em class="sx-lock">🔒 {it.condText}</em>
						: <em class={'sx-price' + (w.bp < it.price! ? ' poor' : '')}><BpCoin size={12} />{it.price}</em>}</span>
				</button>;
			})}</div>
			{slot === 'buddy' && owns(ITEMS.find(i => i.slot === 'buddy')!, w, st) && <BuddyPicker w={w} />}
		</section>)}
	</Screen>;
}
void Sprite;
