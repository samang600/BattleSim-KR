/** BP 교환소 · 트레이너 카드 꾸미기 · 지방 배지 · 승리 연출 (보상 시스템 화면, src/rewards.ts) */
import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Screen, MiniSprite, toast, Modal, HPBar, TYPE_COLOR } from './core';
import { loadWallet, onWallet, titleItem, DEFAULT_TITLE, ITEMS, SLOT_INFO, owns, buy, equip, itemById, dailyStatus, DAY_ALL_BP, regionBadges, partnerMon, type Item, type Slot, type Wallet } from '../rewards';
import { loadStats } from '../stats';
import { loadSettings } from '../store';
import { SPRITE_URL, trainerImgError } from '../trainer-lines';
import { REGION_COLOR, REGIONS } from '../trainers';
import { speciesKo } from '../data';
import { playMusic, stopMusic, currentMusic } from '../sound';

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
export const equippedTitle = (w: Wallet = loadWallet()) => titleItem(w)?.name || '';
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

// ───────── 칭호 띠 ─────────
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * .299 + (n >> 8 & 255) * .587 + (n & 255) * .114) / 255; };
/** 칭호 색: '#hex' · 'type:Water'(타입 색) · 'reg:관동'(지방 색) */
export function titleColor(v = '#f0c040') { return v.startsWith('type:') ? TYPE_COLOR[v.slice(5)] || '#888888' : v.startsWith('reg:') ? REGION_COLOR[v.slice(4)] || '#888888' : v; }
export function titleStyle(it?: Item): any {
	const c = titleColor(it?.v);
	const dark = lum(c) > .6;
	return { '--tc1': shade(c, 1.3), '--tc2': c, '--tc3': shade(c, .78), '--tco': shade(c, .3), '--tct': dark ? '#1a1a1a' : '#ffffff', '--tcs': dark ? 'transparent' : shade(c, .35) };
}
export function TitleChip({ it, cls = '' }: { it?: Item; cls?: string }) {
	if (!it) return null;
	return <i class={'hm-title tchip ' + cls} style={titleStyle(it)}>{it.name}</i>;
}

// ───────── 교환소 화면 ─────────
const TABS: { id: string; name: string; slots: Slot[] }[] = [
	{ id: 'title', name: '칭호', slots: ['title'] },
	{ id: 'card', name: '카드', slots: ['cardBg', 'frame', 'star'] },
	{ id: 'trainer', name: '트레이너', slots: ['trainer'] },
	{ id: 'av', name: '배틀', slots: ['hp', 'bg', 'bgm'] },
];
function Preview({ it }: { it: Item }) {
	switch (it.slot) {
		case 'title': return <TitleChip it={it} cls="pv-title" />;
		case 'cardBg': { const c = it.v!.split(','); return <span class="pv-swatch" style={{ '--cb1': c[0], '--cb2': c[1], '--cb3': c[2], '--cb4': c[3] } as any} />; }
		case 'frame': { const c = it.v!.split(','); return <span class="pv-frame" style={{ '--fr1': c[0], '--fr2': c[1] } as any} />; }
		case 'star': return <span class="pv-star">{it.v}{it.v}{it.v}</span>;
		case 'trainer': return <img class="pv-trainer" src={SPRITE_URL(it.v!)} onError={trainerImgError} alt="" loading="lazy" />;
		case 'hp': return <span class={'pv-hpbox mini hpt-' + it.v}><HpMock name="피카츄" hp={78} /></span>;
		case 'bg': return <span class={'arena-thumb pv-bg bg-' + it.v}><span class="arena-bg" /></span>;
		case 'bgm': return <span class="pv-bgm">♪</span>;
		default: return null;
	}
}
/** HP 창 모양 (배틀과 같은 .info 틀) */
function HpMock({ name, hp, own = true, lv = 50 }: { name: string; hp: number; own?: boolean; lv?: number }) {
	return <div class={'info ' + (own ? 'own' : 'foe')}>
		<div class="info-top"><b class="info-name">{name}</b><span class="lv">Lv{lv}</span></div>
		<HPBar hp={hp} maxhp={100} />
		<div class="info-bottom"><span />{own ? <span class="hp-num">{hp * 2}/200</span> : <span class="hp-num">{hp}%</span>}</div>
	</div>;
}
/** 트레이너 카드 모양: 고른 상품을 씌워서 */
function CardMock({ it, w }: { it: Item; w: Wallet }) {
	const settings = loadSettings();
	const v = it.v?.split(',') || [];
	const style = { ...cardSkin(w), ...(it.slot === 'cardBg' ? { '--cb1': v[0], '--cb2': v[1], '--cb3': v[2], '--cb4': v[3] } : {}), ...(it.slot === 'frame' ? { '--fr1': v[0], '--fr2': v[1] } : {}) };
	const cls = (it.slot === 'cardBg' || w.eq.cardBg ? ' skin-bg' : '') + (it.slot === 'frame' || w.eq.frame ? ' skin-fr' : '');
	const star = it.slot === 'star' ? it.v! : starGlyph(w);
	const title = it.slot === 'title' ? it : titleItem(w);
	return <div class={'pv-card' + cls} style={style}>
		<img class="pv-card-tr" src={SPRITE_URL(it.slot === 'trainer' ? it.v! : settings.playerSprite)} onError={trainerImgError} alt="" />
		<div class="pv-card-txt">
			<b>{settings.playerName || '플레이어'}</b>
			<TitleChip it={title} />
			<span class="pv-card-star">{star}{star}{star}</span>
			<small>지금까지 {w.total} BP</small>
		</div>
	</div>;
}
/** 크게 미리보기 (구매 확인 창) */
function BigPreview({ it, w }: { it: Item; w: Wallet }) {
	switch (it.slot) {
		case 'title': case 'cardBg': case 'frame': case 'star': case 'trainer': return <CardMock it={it} w={w} />;
		case 'hp': return <div class={'pv-stage arena-thumb bg-field hpt-' + it.v}><span class="arena-bg" />
			<div class="pv-hp-foe"><HpMock name="리자몽" hp={64} own={false} /></div><div class="pv-hp-own"><HpMock name="피카츄" hp={88} /></div></div>;
		case 'bg': return <div class={'pv-stage arena-thumb bg-' + it.v}><span class="arena-bg" /></div>;
		case 'bgm': return <div class="pv-stage pv-music"><div class="pv-eq">{Array.from({ length: 9 }, (_, i) => <i style={{ animationDelay: `${(i * 0.13) % 0.6}s` }} />)}</div><b>♪ {it.name}</b><small>{it.desc}</small><em>창을 닫으면 음악이 멈춰요</em></div>;
		default: return <Preview it={it} />;
	}
}
function ItemModal({ it, w, onClose }: { it: Item; w: Wallet; onClose: () => void }) {
	const st = loadStats();
	const have = owns(it, w, st);
	const settings = loadSettings();
	const on = have && isOnItem(it, w, settings);
	// 음악은 창이 열려 있는 동안 들려줌, 닫으면 원래 음악으로
	useEffect(() => {
		if (it.slot !== 'bgm') return;
		const prev = currentMusic();
		playMusic(it.v!);
		return () => { stopMusic(); if (prev) playMusic(prev); };
	}, [it.id]);
	const doBuy = () => {
		const r = buy(it);
		if (r === 'poor') { toast(`BP 가 ${it.price! - w.bp} 모자라요`); return; }
		if (r === 'locked') { toast(`${it.condText} 달성 시 열려요`); return; }
		equip(it, it.slot);
		toast(`「${it.name}」을(를) 교환하고 장착했어요!`);
		onClose();
	};
	const toggle = () => {
		if (on) { equip(null, it.slot); toast(it.slot === 'title' && it.id !== DEFAULT_TITLE ? '기본 칭호로 돌렸어요' : '장착을 풀었어요'); }
		else { equip(it, it.slot); toast(`「${it.name}」을(를) 장착했어요`); }
		onClose();
	};
	const fixed = ['trainer', 'bg', 'bgm'].includes(it.slot);   // 설정에서 고르는 것: 풀기 없음
	return <Modal onClose={onClose} title={SLOT_INFO[it.slot].name}>
		<div class="pv-modal">
			<div class="pv-big">{h(BigPreview, { it, w })}</div>
			<div class="pv-info">
				<b class="pv-name">{it.name}</b>
				{it.desc && <small>{it.desc}</small>}
				{it.cond && <small class={'pv-cond' + (have ? ' ok' : '')}>{have ? '✓ ' : '🔒 '}{it.condText}</small>}
				{!it.cond && !have && <span class={'pv-price' + (w.bp < it.price! ? ' poor' : '')}><BpCoin size={14} />{it.price} BP <small>(가진 BP {w.bp})</small></span>}
			</div>
			<div class="pv-btns">
				{!have ? (it.cond ? <button class="btn" disabled>아직 잠겨 있어요</button>
					: <button class="btn primary" disabled={w.bp < it.price!} onClick={doBuy}>{w.bp < it.price! ? `BP 가 ${it.price! - w.bp} 모자라요` : `교환하기 (${it.price} BP)`}</button>)
					: on ? (fixed ? <button class="btn" disabled>사용 중</button> : <button class="btn" onClick={toggle}>장착 풀기</button>)
						: <button class="btn primary" onClick={toggle}>장착하기</button>}
				<button class="btn ghost" onClick={onClose}>닫기</button>
			</div>
		</div>
	</Modal>;
}
const isOnItem = (it: Item, w: Wallet, settings = loadSettings()) => it.slot === 'trainer' ? settings.playerSprite === it.v : it.slot === 'bg' ? settings.battleBg === it.v : it.slot === 'bgm' ? settings.battleBgm === it.v
	: it.slot === 'title' ? titleItem(w)?.id === it.id : w.eq[it.slot] === it.id;
const groupBy = (list: Item[]) => { const out: [string, Item[]][] = []; for (const it of list) { const g = it.grp || ''; const last = out[out.length - 1]; if (last && last[0] === g) last[1].push(it); else out.push([g, [it]]); } return out; };
export function ShopScreen({ onBack }: { onBack: () => void }) {
	const w = useWallet();
	const st = loadStats();
	const [tab, setTab] = useState('title');
	const [sel, setSel] = useState<Item | null>(null);
	const [q, setQ] = useState('');
	const settings = loadSettings();
	const daily = dailyStatus();
	const tabDef = TABS.find(t => t.id === tab)!;
	const card = (it: Item) => {
		const have = owns(it, w, st), on = have && isOnItem(it, w, settings);
		return <button class={'shop-item' + (have ? ' have' : '') + (on ? ' on' : '') + (it.cond && !have ? ' locked' : '')} onClick={() => setSel(it)}>
			<span class="sx-pv"><Preview it={it} /></span>
			<span class="sx-name">{it.name}</span>
			{it.desc && <small class="sx-desc">{it.desc}</small>}
			<span class="sx-foot">{on ? <em class="sx-on">장착 중</em> : have ? <em class="sx-own">장착하기</em> : it.cond ? <em class="sx-lock">🔒 {it.condText}</em>
				: <em class={'sx-price' + (w.bp < it.price! ? ' poor' : '')}><BpCoin size={12} />{it.price}</em>}</span>
		</button>;
	};
	return <Screen title="BP 교환소" onBack={onBack} cls="shop-scr" top>
		<div class="shop-head">
			<div class="shop-wallet">
				<BpCoin size={32} />
				<span><small>가진 BP</small><b>{w.bp}</b></span>
				<em>지금까지 {w.total} BP</em>
			</div>
			<div class="shop-week">
				<div class="wk-title">일일 미션 <small>모두 하면 +{DAY_ALL_BP} · 자정에 바뀌어요</small></div>
				{daily.map(m => <div class={'wk-row' + (m.done ? ' done' : '')}>
					<span class="wk-text">{m.text}</span>
					<span class="wk-bar"><i style={{ width: `${m.prog / m.goal * 100}%` }} /></span>
					<span class="wk-num">{m.done ? '완료' : `${m.prog}/${m.goal}`}</span>
					<span class="wk-bp"><BpCoin size={10} />{m.bp}</span>
				</div>)}
			</div>
		</div>
		<p class="hint shop-hint">배틀에서 이기고 연승·업적·일일 미션을 달성하면 BP 가 쌓여요. 상품을 누르면 크게 미리 볼 수 있어요. 모두 꾸미기용이라 배틀 능력에는 영향이 없어요.</p>
		<div class="seg shop-tabs">{TABS.map(t => <button class={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.name}</button>)}</div>
		{tabDef.slots.map(slot => {
			const qq = q.trim().replace(/\s+/g, '');
			const hit = (i: Item) => !qq || [i.name, i.desc || '', i.grp || ''].some(t => t.replace(/\s+/g, '').includes(qq));
			const list = ITEMS.filter(i => i.slot === slot && (slot !== 'trainer' || hit(i)));
			const groups = list.some(i => i.grp) ? groupBy(list) : [['', list] as [string, Item[]]];
			return <section class="shop-sec">
				{tabDef.slots.length > 1 && <h3 class="sec">{SLOT_INFO[slot].name} <small class="muted">{SLOT_INFO[slot].desc}</small></h3>}
				{tabDef.slots.length === 1 && <p class="muted small">{SLOT_INFO[slot].desc}</p>}
				{slot === 'trainer' && <div class="shop-search"><input type="search" value={q} placeholder="이름·직함·지방으로 찾기 (예: 난천, 관장, 호연)" onInput={e => setQ((e.target as HTMLInputElement).value)} /></div>}
				{slot === 'trainer' && !list.length && <p class="muted small shop-empty">「{q}」에 맞는 모습이 없어요.</p>}
				{groups.map(([g, items]) => <div>
					{g && <h4 class="shop-grp">{g} <small>{items.filter(i => owns(i, w, st)).length}/{items.length}</small></h4>}
					<div class={'shop-grid slot-' + slot}>{items.map(card)}</div>
				</div>)}
			</section>;
		})}
		{sel && <ItemModal it={sel} w={w} onClose={() => setSel(null)} />}
	</Screen>;
}
