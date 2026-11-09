import './ps/registry';
import { recTag, ruleById as ruleByIdR } from './rules';
import { h, render, type VNode } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { bindView, Screen, Sprite, toast, confirmBox, QuitToMenu, resetAbort, ask, MiniSprite, FullscreenButton, Modal } from './ui/core';
import { BattleView } from './ui/battle';
import { TeamList, TeamEditor } from './ui/teambuilder';
import { CalcScreen } from './ui/calc';
import { runOnline } from './online-ui';
import { runTower, runFactory, runPWT, runNamed, runFree, runRank, rankTier, rankLabel, settleRankPending, settleSeason, seasonOf } from './modes';
import { runPalace, runIppitsu, runDaily, runBossRush, todayDaily } from './frontier';
import { loadStats, ACHIEVEMENTS, checkAchievements } from './stats';
import { TrainerBook, SymbolIcon } from './ui/book';
import { WhatsNew, pendingChanges } from './ui/whats-new';
import { APP_VERSION } from './changelog';
import { exportBackup, inspectBackup, importBackup, PREFIX as STORE_PREFIX } from './store';
import { loadRecords, loadSettings, saveSettings, load, remove, loadReplays, deleteReplay, type Settings, type SavedReplay } from './store';
import { GIMMICK_KINDS, GIMMICK_MODES, POOLS, LEGEND_MODES, ruleById, ruleId, gimmickId, parseGimmick, applyRuleData, poolSub, type LegendMode } from './rules';
import { packStatus, refreshPack, onPackProgress, startPackDownload, deletePack, hasNative, fmtBytes, BUNDLED, type PackProgress } from './offline';
import { CUPS, NAMED } from './trainers';
import { unlockAudio, playMusic, stopMusic, sfx, setMusicVolume, setSfxVolume, setMoveSfxVolume } from './sound';
import { PLAYER_SPRITES, SPRITE_URL, trainerImgError } from './trainer-lines';
import { UserSpritesModal } from './ui/user-sprites';
import { ShopScreen, BpCoin, cardSkin, cardSkinClass, TitleChip, useWallet } from './ui/shop';
import { titleItem, ownedVals, loadWallet, ITEMS, pendingAchTotal } from './rewards';
import { onUserSpritesChange } from './user-sprites';

const MODES = [
	{ id: 'tower', name: '배틀타워', sub: '7연승 세트 · 타워 타이쿤', run: runTower, color: '#2f6fe8', mon: 'garchomp' },
	{ id: 'factory', name: '배틀팩토리', sub: '렌탈 · 교환 · 팩토리 헤드', run: runFactory, color: '#e07a1c', mon: 'metagross' },
	{ id: 'rank', name: '랭크 매치', sub: '1주 시즌 · 6→3 · 6→4', run: runRank, color: '#c0283c', mon: 'incineroar' },
	{ id: 'palace', name: '배틀팰리스', sub: '성격대로 스스로', run: runPalace, color: '#23a05a', mon: 'blissey' },
	{ id: 'ippitsu', name: '일필도', sub: '한 마리로 1:1 연승', run: runIppitsu, color: '#b8402a', mon: 'eternatus' },
	{ id: 'pwt', name: 'PWT', sub: '월드 토너먼트', run: runPWT, color: '#c03aa8', mon: 'hydreigon' },
	{ id: 'boss', name: '보스 러시', sub: '지방 클리어 · 악의 조직 · 챔피언', run: runBossRush, color: '#6a30b8', mon: 'mewtwo' },
	{ id: 'named', name: '네임드', sub: '관장 · 챔피언 · 애니메이션', run: runNamed, color: '#14968c', mon: 'dragonite' },
	{ id: 'free', name: '프리 배틀', sub: '싱글 · 더블 바로 대전', run: () => runFree(), color: '#56708e', mon: 'lucario' },
	{ id: 'daily', name: '오늘의 도전', sub: '', run: runDaily, color: '#d8a018', mon: 'pikachu' },
	{ id: 'online', name: '온라인 대전', sub: '친구 · 랜덤 (테스트)', run: runOnline, color: '#2a8fb0', mon: 'rotom' },
];
const FEATURED = ['tower', 'factory', 'rank'];
const MORE = ['palace', 'ippitsu', 'pwt', 'boss', 'named', 'free', 'daily', 'online'];

function TitleScreen({ onStart }: { onStart: () => void }) {
	return <div class="title-screen" onClick={onStart}>
		<div class="title-glow" />
		<div class="title-fs"><FullscreenButton /></div>
		<div class="title-mons">
			<Sprite species="garchomp" gen={9} size={110} anim={false} cls="front" />
			<Sprite species="lucario" gen={9} size={90} anim={false} cls="front" />
		</div>
		<div class="title-logo-img" role="img" aria-label="배틀 시뮬레이터 — 타워 · 팩토리 · 토너먼트" />
		<div class="title-tap" aria-label="화면을 터치하세요">TAP ANYWHERE</div>
		<div class="title-foot">Pokémon Showdown 엔진 기반 · 팬 메이드</div>
	</div>;
}

function Home({ go }: { go: (v: string) => void }) {
	const rec = loadRecords();
	const settings = loadSettings();
	const st = loadStats();
	const t = recTag(settings.battleRule);   // 지금 규칙의 기록
	const best = (p: string) => Math.max(0, ...Object.entries(rec.best).filter(([k]) => k.startsWith(p) && (t ? k.endsWith(t) : !k.includes('@'))).map(([, v]) => v));
	const cupWins = Object.values(rec.cups).reduce((a, b) => a + b, 0);
	const namedWins = Object.keys(rec.named).length;
	const suspended = ['tower-singles', 'tower-doubles'].some(k => load(k + t, null)) || ['singles', 'doubles'].some(f => [50, 100].some(l => load(`factory-${f}-${l}${t}`, null))) || !!load('rush-run', null);
	const rp = Math.max(rec.rp?.['singles' + t] || 0, rec.rp?.['doubles' + t] || 0);
	const season = seasonOf();
	const daily = todayDaily();
	const today = st.daily[daily.date];
	const conq = Object.keys(st.conquest).length;
	const badge: { [id: string]: string } = {
		tower: best('tower-') ? `최고 ${best('tower-')}연승` : '', factory: best('factory-') ? `최고 ${best('factory-')}연승` : '', palace: best('palace-') ? `최고 ${best('palace-')}연승` : '',
		pwt: cupWins ? `우승 ${cupWins}회` : `${CUPS.length}개 대회`, named: `${namedWins}/${NAMED.length}`, free: '',
		boss: conq || Object.values(st.boss).some(Boolean) ? `클리어 ${conq}지방` : '',
		rank: `시즌 ${season.no} · ${rp ? rankLabel(rp) : '참가 전'}`,
		daily: `${daily.theme}${today !== undefined ? ` · ${today}/7` : ''}`, online: '',
	};
	const achDone = ACHIEVEMENTS.filter(a => (st.ach[a.id] || 0) > 0).length;
	const wallet = useWallet();
	const tile = (id: string, big: boolean) => { const m = MODES.find(x => x.id === id)!;
		return <button class={'mode-tile hm-tile' + (big ? ' hm-big' : '')} style={{ '--mc': m.color } as any} onClick={() => go('mode:' + m.id)}>
			<span class="hm-mon"><Sprite species={m.mon} gen={9} size={96} anim={false} /></span>
			<span class="hm-text"><b>{m.name}</b>{(big || id !== 'daily') && m.sub && <small>{m.sub}</small>}{badge[m.id] && <em>{badge[m.id]}</em>}</span>
		</button>; };
	return <div class="home hm">
		<div class="hm-top">
			<button class={'home-head hm-card' + cardSkinClass(wallet)} style={cardSkin(wallet)} onClick={() => go('book')} aria-label="트레이너 수첩">
				<img class="hm-face" src={SPRITE_URL(settings.playerSprite || 'lucas')} onError={trainerImgError} alt="" />
				<span class="hm-who">
					<b>{settings.playerName}<TitleChip it={titleItem(wallet)} /></b>
					<small>{rec.wins}승 {rec.battles - rec.wins}패{rec.battles ? ` · ${Math.round(rec.wins / rec.battles * 100)}%` : ''} · 업적 {achDone}/{ACHIEVEMENTS.length}</small>
					<span class="hm-syms">{(['tower', 'factory', 'rank'] as const).map(k => <SymbolIcon kind={k} lv={st.sym[k] || 0} size={24} />)}<i>{rp ? rankLabel(rp) : `시즌 ${season.no}`}</i></span>
				</span>
			</button>
			<div class="head-btns">
				<FullscreenButton />
				<button class="icon-btn pix-btn" onClick={() => go('settings')} aria-label="설정"><span class="pix-ico gear" aria-hidden="true" /></button>
			</div>
		</div>
		{suspended && <div class="notice hm-notice">쉬는 중인 도전이 있어요. 해당 모드에 들어가면 이어서 할 수 있습니다.</div>}
		<div class="hm-main">
			<div class="hm-featured">{FEATURED.map(id => tile(id, true))}</div>
			<div class="hm-more">{MORE.map(id => tile(id, false))}
				<button class="mode-tile hm-tile hm-shop" onClick={() => go('shop')}>
					<span class="hm-mon"><Sprite species="gimmighoul" gen={9} size={96} anim={false} /></span>
					<span class="hm-text"><b>BP 교환소</b><small>칭호 · 카드 · 연출 · 배경 · 음악</small><em>{wallet.bp} BP</em></span>
				</button>
			</div>
		</div>
		<div class="hm-nav">
			<button class="btn menu hm-teams" onClick={() => go('teams')}>📋 팀 편집</button>
			<button class="btn menu" onClick={() => go('book')}>🏅 수첩{pendingAchTotal() > 0 && <i class="claim-dot" aria-label="받을 업적 보상" />}</button>
			<button class="btn menu" onClick={() => go('records')}>📊 기록</button>
			<button class="btn menu" onClick={() => go('calc')}>🧮 계산기</button>
		</div>
	</div>;
}

/** 저장한 리플레이 목록: 보기 / 지우기 */
function ReplayList({ onPlay }: { onPlay: (rp: SavedReplay) => void }) {
	const [list, setList] = useState(loadReplays());
	const playIt = onPlay;
	if (!list.length) return <p class="muted small">저장한 리플레이가 없습니다. 배틀이 끝난 화면에서 ‘🎬 리플레이 저장’을 누르면 여기에 남습니다. (최근 30개)</p>;
	return <div class="replay-list">{list.map(rp => <div class="replay-row">
		<div class="replay-mons">{(rp.setup?.p1?.team || []).slice(0, 6).map((s: any) => <MiniSprite species={s.species} gen={9} size={28} shiny={s.shiny} />)}</div>
		<div class="replay-body">
			<b>{rp.label}</b>
			<small>{new Date(rp.date).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {rp.win ? '승리' : '패배'} · {rp.turns}턴 · vs {rp.setup?.p2?.name}{rp.setup?.doubles ? ' · 더블' : ''}</small>
		</div>
		<button class="btn small primary" onClick={() => playIt(rp)}>▶ 보기</button>
		<button class="icon-btn" aria-label="삭제" onClick={async () => { if (await confirmBox('리플레이 삭제', '이 리플레이를 지울까요?', '삭제', '취소')) { deleteReplay(rp.id); setList(loadReplays()); } }}>🗑</button>
	</div>)}</div>;
}

function Records({ onBack, onPlay }: { onBack: () => void; onPlay: (rp: SavedReplay) => void }) {
	const r = loadRecords();
	// 규칙마다 기록이 따로: 지금 규칙 + 기록이 있는 다른 규칙을 골라 봄 (기본 규칙은 표시 '')
	const cur = recTag(loadSettings().battleRule);
	const tags = [...new Set([cur, '', ...[...Object.keys(r.best), ...Object.keys(r.rp || {})].map(k => k.includes('@') ? k.slice(k.indexOf('@')) : '')])];
	const [t, setT] = useState(cur);
	const tagName = (x: string) => ruleByIdR(x ? x.slice(1) : '').name;
	const b = (k: string) => `${r.best[k + t] || 0}연승`;
	const rows: [string, string][] = [
		['배틀타워 싱글 3vs3', b('tower-singles')], ['배틀타워 더블 4vs4', b('tower-doubles')],
		['배틀타워 싱글 6vs6', b('tower-singles6')], ['배틀타워 더블 6vs6', b('tower-doubles6')],
		['배틀타워 멀티', b('tower-multi')], ['팩토리 멀티 Lv50', b('factory-multi-50')],
		['팩토리 싱글 Lv50', b('factory-singles-50')], ['팩토리 싱글 오픈', b('factory-singles-100')],
		['팩토리 더블 Lv50', b('factory-doubles-50')], ['팩토리 더블 오픈', b('factory-doubles-100')],
		['팩토리 싱글 6vs6 Lv50', b('factory-singles6-50')], ['팩토리 더블 6vs6 Lv50', b('factory-doubles6-50')],
	];
	return <Screen title="기록" onBack={onBack}>
		<div class="record-card"><b>총 전적</b><span>{r.wins}승 {r.battles - r.wins}패{r.battles ? ` · 승률 ${Math.round(r.wins / r.battles * 100)}%` : ''}</span></div>
		<h3 class="sec">🎬 리플레이</h3>
		<ReplayList onPlay={onPlay} />
		<h3 class="sec">규칙별 기록</h3>
		{tags.length > 1 && <div class="seg wrap">{tags.map(x => <button class={x === t ? 'on' : ''} onClick={() => setT(x)}>{tagName(x)}</button>)}</div>}
		<p class="muted small">{tagName(t)}{t === cur ? ' (지금 규칙)' : ''} — 연승·랭크 기록은 배틀 규칙마다 따로 남습니다.</p>
		<h3 class="sec">랭크 매치</h3>
		{(['singles', 'doubles'] as const).map(f => <div class="record-row"><span>{f === 'singles' ? '싱글 6→3' : '더블 6→4'}</span><b>{rankLabel(r.rp?.[f + t] || 0)} {r.rp?.[f + t] || 0}RP{r.rpBest?.[f + t] ? ` (최고 ${r.rpBest[f + t]})` : ''}</b></div>)}
		<h3 class="sec">최고 연승</h3>
		{rows.map(([k, v]) => <div class="record-row"><span>{k}</span><b>{v}</b></div>)}
		<h3 class="sec">PWT 우승</h3>
		{CUPS.map(c => <div class="record-row"><span>{c.name}</span><b>{r.cups[c.id] ? `🏆 ${r.cups[c.id]}회` : '—'}</b></div>)}
		<h3 class="sec">네임드 트레이너 격파</h3>
		<div class="named-grid">{NAMED.map(t => <span class={'named-chip' + (r.named[t.id] ? ' done' : '')}>{t.name}</span>)}</div>
	</Screen>;
}

/** 설정 → 오프라인 데이터: 그림·울음소리·애니메이션 묶음을 한 번에 받아 둠 (앱에서만) */
function OfflinePack() {
	const [st, setSt] = useState(packStatus());
	const [prog, setProg] = useState<PackProgress | null>(null);
	useEffect(() => onPackProgress(p => { setProg(p); if (p.state === 'done' && p.name === 'all') { setSt(refreshPack()); toast('오프라인 데이터를 모두 받았습니다'); } if (p.state.startsWith('error')) toast('받기 실패: ' + p.state.slice(6)); }), []);
	if (BUNDLED) return <p class="muted small">이 버전은 그림·울음소리·애니메이션이 앱 안에 들어 있습니다.</p>;
	if (!hasNative()) return <p class="muted small">브라우저에서는 그림·울음소리·애니메이션을 인터넷에서 그때그때 받습니다. 안드로이드 앱에서는 한 번에 받아 둘 수 있어요.</p>;
	const parts = st.parts ? st.parts.split(',') : [];
	const label = (n: string) => ({ sprites: '그림', cries: '울음소리', anims: '기술 애니메이션' } as any)[n] || n;
	const busy = st.downloading || (prog && prog.state === 'downloading');
	return <div class="pack-box">
		<p class="small">{st.installed ? `받아 둠: ${parts.map(label).join(' · ')} (${fmtBytes(st.bytes)})` : '아직 받지 않음 — 그림·울음소리·애니메이션을 인터넷에서 그때그때 받습니다.'}</p>
		{busy && prog && <div class="pack-prog"><div class="pack-bar" style={{ width: `${Math.round(prog.done / Math.max(1, prog.total) * 100)}%` }} /><span>{label(prog.name)} {prog.total > 1 ? `${fmtBytes(prog.done)} / ${fmtBytes(prog.total)}` : '…'}</span></div>}
		<div class="row wrap">
			{parts.length < 3 && <button class="btn primary" disabled={!!busy} onClick={() => { if (startPackDownload()) { setProg({ name: 'sprites', done: 0, total: 1, state: 'downloading' }); setSt(refreshPack()); } }}>{busy ? '받는 중…' : '한 번에 받기 (약 24MB)'}</button>}
			{st.installed && <button class="btn ghost" disabled={!!busy} onClick={async () => { if (await confirmBox('삭제', '받아 둔 오프라인 데이터를 지울까요?', '삭제')) { deletePack(); setSt(refreshPack()); } }}>삭제</button>}
		</div>
		<p class="muted small">받아 두면 인터넷 없이도 포켓몬·트레이너 그림, 울음소리, 기술 애니메이션이 나옵니다. (그림 6MB · 울음소리 7MB · 애니메이션 11MB, 풀면 약 60MB)</p>
	</div>;
}

// ── 데이터 백업: 안드로이드 앱은 시스템 파일 저장·열기 화면, 브라우저는 내려받기·파일 고르기 ──
const backupName = () => `battle-kr-backup-${new Date().toISOString().slice(0, 10)}.json`;
function backupSave() {
	const text = exportBackup();
	const nat = (window as any).BattleSimNative;
	if (nat?.saveBackup) {
		(window as any).__backupSaved = (r: string) => toast(r === 'ok' ? '백업 파일을 저장했습니다.' : r === 'cancel' ? '저장을 취소했습니다.' : '저장하지 못했습니다.');
		nat.saveBackup(backupName(), text);
		return;
	}
	try {
		const a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
		a.download = backupName();
		document.body.appendChild(a); a.click(); a.remove();
		setTimeout(() => URL.revokeObjectURL(a.href), 2000);
		toast('백업 파일을 내려받았습니다.');
	} catch { toast('저장하지 못했습니다.'); }
}
async function restoreFrom(text: string) {
	if (!text) return;
	const info = inspectBackup(text);
	if (!info) { toast('이 앱의 백업 파일이 아닙니다.'); return; }
	const when = info.at ? new Date(info.at).toLocaleString('ko-KR') : '알 수 없음';
	if (!(await confirmBox('백업 불러오기', `${when}에 만든 백업입니다 (팀 ${info.teams}개 · 리플레이 ${info.replays}개).\n지금 데이터는 모두 이 백업으로 바뀝니다. 불러올까요?`, '불러오기', '취소'))) return;
	if (!importBackup(text)) { toast('불러오지 못했습니다.'); return; }
	toast('불러왔습니다. 다시 시작합니다…');
	setTimeout(() => location.reload(), 600);
}
function backupLoad() {
	const nat = (window as any).BattleSimNative;
	if (nat?.openBackup) {
		(window as any).__backupLoaded = (text: string) => { void restoreFrom(text); };
		nat.openBackup();
		return;
	}
	const inp = document.createElement('input');
	inp.type = 'file'; inp.accept = '.json,application/json';
	inp.onchange = async () => { const f = inp.files?.[0]; if (f) void restoreFrom(await f.text()); };
	inp.click();
}

/** 주인공 모습: ◀ 그림·이름 ▶ 한 줄로 넘기며 고름 (이웃한 모습도 작게 보여 줌) */
/** 주인공 모습: 화살표로 넘기거나, 가운데를 누르면 전부 격자로 보기 (기본 주인공 + 교환소에서 얻은 모습, 묶음별) */
function avatarGroups(): [string, { id: string; name: string }[]][] {
	const w = loadWallet();
	const out: [string, { id: string; name: string }[]][] = [['기본 주인공', PLAYER_SPRITES]];
	for (const it of ITEMS) if (it.slot === 'trainer' && w.own[it.id]) {
		const g = it.grp || '교환소'; let row = out.find(r => r[0] === g);
		if (!row) { row = [g, []]; out.push(row); }
		row[1].push({ id: it.v!, name: it.name });
	}
	return out;
}
function AvatarPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
	const [grid, setGrid] = useState(false);
	const groups = avatarGroups();
	const list = groups.flatMap(g => g[1]);
	const n = list.length, i = Math.max(0, list.findIndex(p => p.id === value));
	const at = (d: number) => list[(i + d + n) % n];
	return <>{<div class="win pick-panel avatar-panel">
		<button class="pick-arrow" aria-label="주인공 모습 이전" onClick={() => onChange(at(-1).id)}><i class="tri l" /></button>
		<img class="av-side" src={SPRITE_URL(at(-1).id)} alt="" onClick={() => onChange(at(-1).id)} />
		<button class="av-mid" onClick={() => setGrid(true)} aria-label="주인공 모습 전부 보기"><img src={SPRITE_URL(at(0).id)} alt="" /><b class="ap-name">{at(0).name}</b><span class="av-count">{i + 1}/{n} ▦</span></button>
		<img class="av-side" src={SPRITE_URL(at(1).id)} alt="" onClick={() => onChange(at(1).id)} />
		<button class="pick-arrow" aria-label="주인공 모습 다음" onClick={() => onChange(at(1).id)}><i class="tri r" /></button>
	</div>}
		{grid && <Modal title="주인공 모습" onClose={() => setGrid(false)}>
			<div class="av-grid-wrap">
				{groups.map(([g, items]) => <section>
					<h4 class="shop-grp">{g} <small>{items.length}</small></h4>
					<div class="av-grid">{items.map(p => <button class={'av-cell' + (p.id === value ? ' on' : '')} onClick={() => { onChange(p.id); setGrid(false); }}>
						<img src={SPRITE_URL(p.id)} onError={trainerImgError} alt="" loading="lazy" /><span>{p.name}</span></button>)}</div>
				</section>)}
				<p class="muted small av-more">BP 교환소에서 트레이너·네임드 트레이너·여러 인물의 모습을 더 얻을 수 있어요.</p>
			</div>
		</Modal>}
	</>;
}

let ruleNoticeShown = false;
/** 배틀 규칙: 포켓몬 풀(게임·레귤레이션) · 기믹(복수 선택) · 초전설 · 환상 을 따로 고름 */
function RuleRows({ s, up }: { s: Settings; up: (p: Partial<Settings>) => void }) {
	const cur = ruleById(s.battleRule);
	const gim = parseGimmick(cur.gimmick)!;
	const set = (p: { gimmick?: string; pool?: string; restricted?: LegendMode; mythical?: LegendMode; sub?: LegendMode }) => {
		const n = { gimmick: cur.gimmick, pool: cur.pool, restricted: cur.restricted, mythical: cur.mythical, sub: cur.sub, ...p };
		const id = ruleId(n.gimmick, n.pool, n.restricted, n.mythical, n.sub);
		if (id === cur.id) return;
		applyRuleData(ruleById(id));
		up({ battleRule: id });
		// 규칙을 바꾸면 기록이 규칙마다 따로라는 안내 (설정 화면에 들어올 때마다 처음 한 번)
		if (!ruleNoticeShown) {
			ruleNoticeShown = true;
			confirmBox('규칙별 기록 안내', '배틀 규칙을 바꾸면 연승·최고 기록·랭크 RP·쉬는 중인 도전이 규칙마다 따로 집계돼요.\n원래 규칙으로 돌아오면 그 규칙의 기록이 그대로 이어집니다.', '확인', '');
		}
	};
	const toggle = (k: typeof gim.kinds[number]) => set({ gimmick: gimmickId(gim.kinds.includes(k) ? gim.kinds.filter(x => x !== k) : [...gim.kinds, k], gim.mode) });
	const legRow = (label: string, v: LegendMode, key: 'restricted' | 'mythical' | 'sub') => <div class="set-row rule-row"><span>{label}</span><div class="seg">
		{LEGEND_MODES.map(m => <button class={v === m.id ? 'on' : ''} onClick={() => set({ [key]: m.id as LegendMode })}>{m.name}</button>)}</div></div>;
	return <>
		<div class="set-row rule-row"><span>포켓몬</span><div class="seg wrap">{POOLS.map(p => <button class={cur.pool === p.id ? 'on' : ''}
			onClick={() => { set({ pool: p.id, gimmick: p.gimmick, sub: poolSub(p.id), ...(p.legends ? { restricted: p.legends[0], mythical: p.legends[1] } : {}) }); }}>{p.name}</button>)}</div></div>
		<div class="set-row rule-row"><span>기믹</span><div class="seg wrap">{GIMMICK_KINDS.map(g => <button class={gim.kinds.includes(g.k) ? 'on' : ''} aria-pressed={gim.kinds.includes(g.k)} onClick={() => toggle(g.k)}>{g.name}</button>)}</div></div>
		{gim.kinds.length > 1 && <div class="set-row rule-row"><span>기믹 사용</span><div class="seg wrap">{GIMMICK_MODES.map(m => <button class={gim.mode === m.id ? 'on' : ''} onClick={() => set({ gimmick: gimmickId(gim.kinds, m.id) })}>{m.name}</button>)}</div></div>}
		{legRow('초전설', cur.restricted, 'restricted')}
		{legRow('환상', cur.mythical, 'mythical')}
		{legRow('준전설', cur.sub, 'sub')}
		<p class="muted small"><b>{cur.name}</b> — {cur.desc}</p>
		<p class="muted small">기믹은 여러 개를 함께 켤 수 있고, 하나도 안 켜면 기믹 없이 배틀합니다. 포켓몬을 고르면 그 게임의 기믹으로 맞춰지고 따로 바꿀 수 있어요. 준전설에는 패러독스·울트라비스트도 포함돼요. 초전설·환상·준전설은 포켓몬 풀과 상관없이 정하며, 가능이면 나도 쓰고 상대도 데려옵니다(포켓몬을 고르면 그 게임 기준으로 맞춰짐 — 챔피언스는 준전설 불가). 그 세대에 아직 없던 포켓몬(예: 소드·실드의 패러독스)은 가능이어도 나오지 않아요. 모든 모드의 나와 상대에게 적용됩니다.</p>
	</>;
}

function SettingsScreen({ onBack }: { onBack: () => void }) {
	useEffect(() => { ruleNoticeShown = false; }, []);
	const [newsAll, setNewsAll] = useState(false);
	const [s, setS] = useState<Settings>(loadSettings());
	const [userSpr, setUserSpr] = useState(false);
	const up = (p: Partial<Settings>) => { const n = { ...s, ...p }; setS(n); saveSettings(n); };
	return <Screen title="설정" onBack={onBack}>
		<label class="field-label">트레이너 이름
			<input value={s.playerName} maxLength={10} onInput={e => up({ playerName: (e.target as HTMLInputElement).value || '플레이어' })} />
		</label>
		<h3 class="sec">메시지 속도</h3>
		<div class="seg">{([1, 2, 3, 4] as const).map(v => <button class={s.speed === v ? 'on' : ''} onClick={() => up({ speed: v })}>{['느림', '보통', '빠름', '매우 빠름'][v - 1]}</button>)}</div>
		<h3 class="sec">주인공 모습</h3>
		<AvatarPicker value={s.playerSprite} onChange={id => up({ playerSprite: id })} />
		<h3 class="sec">소리</h3>
		<div class="seg">
			<button class={s.sound ? 'on' : ''} onClick={() => { up({ sound: !s.sound }); }}>효과음 {s.sound ? '켜짐' : '꺼짐'}</button>
			<button class={s.music ? 'on' : ''} onClick={() => { const m = !s.music; up({ music: m }); if (m) setTimeout(() => playMusic('lobby'), 0); else stopMusic(); }}>배경음악 {s.music ? '켜짐' : '꺼짐'}</button>
		</div>
		<div class="set-row"><span>배경음악</span><div class="seg">{([1, 2, 3] as const).map(v => <button class={s.musicVolume === v ? 'on' : ''} onClick={() => { up({ musicVolume: v }); setMusicVolume(v); }}>{['작게', '보통', '크게'][v - 1]}</button>)}</div></div>
		<div class="set-row"><span>울음·효과음</span><div class="seg">{([1, 2, 3] as const).map(v => <button class={s.sfxVolume === v ? 'on' : ''} onClick={() => { up({ sfxVolume: v }); setSfxVolume(v); }}>{['작게', '보통', '크게'][v - 1]}</button>)}</div></div>
		<div class="set-row"><span>기술 효과음</span><div class="seg">{([0, 1, 2, 3] as const).map(v => <button class={s.moveSfx === v ? 'on' : ''} onClick={() => { up({ moveSfx: v }); setMoveSfxVolume(v); }}>{['끔', '작게', '보통', '크게'][v]}</button>)}</div></div>
		<h3 class="sec">기록</h3>
		<div class="seg"><button class="danger" onClick={async () => {
			if (!(await confirmBox('전적 초기화', '연승 기록·대회 우승·네임드 승리·랭크 포인트·승패 기록을 모두 지웁니다.\n(팀·리플레이·설정은 그대로입니다) 정말 지울까요?', '모두 지우기', '취소'))) return;
			remove('records'); toast('전적을 초기화했습니다.');
		}}>전적 초기화</button></div>
		<h3 class="sec">데이터 백업</h3>
		<div class="seg">
			<button onClick={() => backupSave()}>파일로 내보내기</button>
			<button onClick={() => backupLoad()}>파일에서 불러오기</button>
		</div>
		<p class="muted small">팀·전적·리플레이·설정·진행 중인 연승 도전을 파일 하나로 저장합니다. 앱을 지우거나 폰을 바꿀 때 내보내 두었다가 불러오세요. (오프라인 그림 데이터는 다시 받으면 됩니다)</p>
		<h3 class="sec">창틀 디자인</h3>
		<div class="seg">{([['stone', '블루'], ['silver', '레드'], ['dark', '블랙']] as const).map(([k, l]) => <button class={s.frame === k ? 'on' : ''} onClick={() => { up({ frame: k }); applyTheme({ ...s, frame: k }); }}>{l}</button>)}</div>
		<h3 class="sec">시간대</h3>
		<div class="seg">{([['night', '밤'], ['day', '낮'], ['auto', '시간에 따라']] as const).map(([k, l]) => <button class={(s.tod || 'night') === k ? 'on' : ''} onClick={() => { up({ tod: k }); applyTheme({ ...s, tod: k }); }}>{l}</button>)}</div>
		<p class="muted small">타이틀·메뉴 배경과 배틀타워·팩토리·경기장 배경이 낮·밤으로 바뀝니다. '시간에 따라'는 6시~18시에 낮입니다.</p>
		<h3 class="sec">메뉴 배경</h3>
		<div class="seg wrap">{([['title', '하늘'], ['field', '초원'], ['tower', '타워'], ['factory', '팩토리'], ['pwt', '경기장'], ['champion', '챔피언']] as [string, string][]).map(([k, l]) => <button class={s.homeBg === k ? 'on' : ''} onClick={() => { up({ homeBg: k }); applyTheme({ ...s, homeBg: k }); }}>{l}</button>)}</div>
		<p class="muted small">효과음·배경음악은 이 앱에서 합성한 칩튠, 기술 효과음은 Pokémon Reborn 제작. 울음소리는 인터넷에서 받아 옵니다.</p>
		<h3 class="sec">배틀 규칙</h3>
		<RuleRows s={s} up={up} />
		<div class="set-row"><span>노력치 표시</span><div class="seg">{([['sp', '32 (66)'], ['ev', '252 (510)']] as const).map(([k, l]) => <button class={(s.evDisplay || 'sp') === k ? 'on' : ''} onClick={() => up({ evDisplay: k })}>{l}</button>)}</div></div>
		<p class="muted small">팀 편집·포켓몬 정보에서 능력 포인트(능력마다 32, 합계 66)로 볼지, 본가 노력치(252, 합계 510)로 볼지 고릅니다. 규칙은 그대로 66포인트라 노력치로 보면 본가보다 1포인트(노력치 8) 더 쓸 수 있습니다. 노력치 방식으로 내보낸 텍스트는 합계 510에 맞춰집니다.</p>
		<h3 class="sec">포켓몬 그림</h3>
		<div class="seg"><button onClick={() => setUserSpr(true)}>🖼 포켓몬 그림 바꾸기</button></div>
		<p class="muted small">포켓몬마다 앞·뒤·색이 다른 모습 그림을 내 그림 파일로 바꿀 수 있어요(정지 도트 그림 설정, 오프라인의 이름 카드 대신). 원본 그림 추출(한 마리·전체 zip), 내 그림 zip 내보내기·일괄 적용도 여기서 합니다. 내 그림은 데이터 백업 파일에는 들어가지 않으니 '내 그림 내보내기' zip 으로 보관하세요.</p>
		{userSpr && <UserSpritesModal onClose={() => setUserSpr(false)} />}
		<h3 class="sec">배틀 화면</h3>
		<div class="seg">
			<button class={s.effects ? 'on' : ''} onClick={() => up({ effects: !s.effects })}>기술 이펙트 {s.effects ? '켜짐' : '꺼짐'}</button>
			<button class={s.damagePreview ? 'on' : ''} onClick={() => up({ damagePreview: !s.damagePreview })}>데미지 예상 {s.damagePreview ? '켜짐' : '꺼짐'}</button>
		</div>
		<div class="seg">
			<button class={s.vibrate ? 'on' : ''} onClick={() => up({ vibrate: !s.vibrate })}>진동 {s.vibrate ? '켜짐' : '꺼짐'}</button>

		</div>
		<p class="muted small">데미지 예상: 기술 버튼에 상대에게 줄 데미지의 대략적인 비율을 표시합니다 (연습용).</p>
		<h3 class="sec">오프라인 데이터</h3>
		<OfflinePack />
		<h3 class="sec">포켓몬 그림</h3>
		<div class="seg">
			<button class={s.animatedSprites ? 'on' : ''} onClick={() => up({ animatedSprites: true })}>움직이는 그림</button>
			<button class={!s.animatedSprites ? 'on' : ''} onClick={() => up({ animatedSprites: false })}>정지 도트 그림 (기본)</button>
		</div>
		<p class="muted small">포켓몬 그림은 인터넷에 연결되어 있을 때 표시됩니다. (오프라인이면 이름 카드로 표시)</p>
		<h3 class="sec">정보</h3>
		<button class="btn" onClick={() => setNewsAll(true)}>📰 업데이트 소식 (v{APP_VERSION})</button>
		{newsAll && <WhatsNew all onClose={() => setNewsAll(false)} />}
		<p class="muted small">배틀 계산은 Pokémon Showdown 시뮬레이터(MIT)를 그대로 사용합니다. 비공식 팬 메이드 앱이며, 포켓몬 관련 명칭의 권리는 Nintendo·Creatures·GAME FREAK·The Pokémon Company에 있습니다.</p>
		<p class="muted small">포켓몬 도트 그림: Pokémon Showdown·Smogon Sprite Project. 9세대 퍼퓨돈(암컷)·빠모트·스태솔트·찌리비·육파리·구르데·베라카스·키키링·차데스·오거폰·무쇠감투(테라스탈 모습 포함)은 PokéAPI sprites 저장소의 도트 그림(앞모습 KingOfThe-X-Roads, 뒷모습 DoveKyle).</p>
		<button class="btn danger" onClick={() => { if (confirm('모든 기록과 팀을 지울까요?')) { try { Object.keys(localStorage).filter(k => k.startsWith(STORE_PREFIX)).forEach(k => localStorage.removeItem(k)); } catch {} toast('초기화했습니다'); } }}>데이터 초기화</button>
	</Screen>;
}

function App() {
	const [modeView, setModeView] = useState<VNode | null>(null);
	const [route, setRoute] = useState<string>('title');
	const [editTeam, setEditTeam] = useState<any>(null);
	useEffect(() => { bindView(setModeView); applyTheme(loadSettings()); }, []);
	// 웹: 새 버전으로 처음 열면 업데이트 소식 (메인 화면에 처음 왔을 때 한 번)
	const [news, setNews] = useState(false);
	useEffect(() => { if (route === 'home' && !(window as any).BattleSimNative && pendingChanges()) setNews(true); }, [route === 'home']);
	// 내 포켓몬 그림을 다 읽었거나 바뀌면 다시 그림
	const [, setSprRev] = useState(0);
	useEffect(() => onUserSpritesChange(() => setSprRev(x => x + 1)) as any, []);

	const go = async (r: string) => {
		if (r.startsWith('mode:')) {
			const m = MODES.find(x => x.id === r.slice(5))!;
			setRoute('mode');
			resetAbort();
			try { await m.run(); } catch (e: any) { if (!(e instanceof QuitToMenu)) { console.error(e); toast('오류: ' + (e?.message || e)); } }
			resetAbort();
			setModeView(null);
			setRoute('home');
			playMusic('lobby');
			return;
		}
		setRoute(r);
	};

	/** 저장한 리플레이 재생: 배틀 화면(모드 뷰)으로 들어갔다가 기록 화면으로 돌아옴 */
	const playReplay = async (rp: SavedReplay) => {
		setRoute('mode');
		resetAbort();
		try {
			await ask<void>(r => <BattleView key={Math.random()} setup={{ ...rp.setup, noRecord: true, replay: { seed: rp.seed, ruleId: rp.ruleId, p1: rp.p1, p2: rp.p2 } }} onEnd={() => r()} />);
		} catch (e: any) { if (!(e instanceof QuitToMenu)) { console.error(e); toast('리플레이 오류: ' + (e?.message || e)); } }
		resetAbort();
		setModeView(null);
		setRoute('records');
		playMusic('lobby');
	};

	// 안드로이드 뒤로가기
	useEffect(() => {
		(window as any).onAndroidBack = () => {
			const backBtn = document.querySelector('.bar .icon-btn[aria-label="뒤로"]') as HTMLButtonElement | null;
			if (document.querySelector('.modal-bg')) { (document.querySelector('.modal-bg') as HTMLElement).click(); return true; }
			if (backBtn) { backBtn.click(); return true; }
			const ctlBack = document.querySelector('.ctl-head .ctl-back') as HTMLButtonElement | null; // 배틀 명령창의 ◀ 뒤로
			if (ctlBack) { ctlBack.click(); return true; }
			const menu = document.querySelector('.hud-top .menu-btn') as HTMLButtonElement | null;
			if (menu) { menu.click(); return true; } // 배틀 메뉴 (메인 메뉴로·기권)
			if (document.querySelector('.battle')) return true; // 연출 중엔 무시
			if (route !== 'home' && route !== 'title') { setRoute('home'); return true; }
			if (route === 'home') { setRoute('title'); return true; }
			return false;
		};
	});

	if (route === 'title') return <TitleScreen onStart={() => { unlockAudio(); playMusic('lobby'); sfx('select'); setRoute('home'); }} />;
	if (route === 'mode') return modeView || <div class="loading">불러오는 중…</div>;
	if (route === 'teams') {
		if (editTeam) return <TeamEditor team={editTeam} onBack={() => setEditTeam(null)} />;
		return <TeamList onBack={() => setRoute('home')} onEdit={t => setEditTeam(t)} />;
	}
	if (route === 'records') return <Records onBack={() => setRoute('home')} onPlay={playReplay} />;
	if (route === 'calc') return <CalcScreen onBack={() => setRoute('home')} />;
	if (route === 'book') return <TrainerBook onBack={() => setRoute('home')} />;
	if (route === 'shop') return <ShopScreen onBack={() => setRoute('home')} />;
	if (route === 'settings') return <SettingsScreen onBack={() => setRoute('home')} />;
	return <>{<Home go={go} />}{news && <WhatsNew onClose={() => setNews(false)} />}</>;
}

/** 창틀·배경 설정 적용 (CSS 변수) */
export function applyTheme(s: Settings) {
	const root = document.documentElement;
	root.setAttribute('data-frame', s.frame || 'stone');
	root.setAttribute('data-bg', s.homeBg || 'title');
	root.setAttribute('data-tod', resolveTod(s.tod));
}
/** 시간대: 'auto' 면 지금 시각으로 (6시~18시 낮) */
export function resolveTod(t?: string): 'day' | 'night' {
	if (t === 'day' || t === 'night') return t;
	if (t === 'auto') { const h = new Date().getHours(); return h >= 6 && h < 18 ? 'day' : 'night'; }
	return 'night';
}
setInterval(() => { const s = loadSettings(); if (s.tod === 'auto') document.documentElement.setAttribute('data-tod', resolveTod('auto')); }, 60000);

// 버튼 누를 때 효과음
document.addEventListener('pointerdown', e => {
	const b = (e.target as HTMLElement).closest('button');
	if (!b || (b as HTMLButtonElement).disabled) return;
	unlockAudio();
	sfx(b.getAttribute('aria-label') === '뒤로' || b.textContent?.includes('뒤로') ? 'back' : 'select');
}, true);

// 안드로이드 앱: 상태 표시줄·내비게이션 바 여백은 앱(네이티브)이 이미 비워 둠 → 웹에서 safe-area 를 또 비우면 위아래가 검게 남음
if ((window as any).BattleSimNative) document.documentElement.classList.add('native');
// 웹: 브라우저 뒤로가기 — 앱 안에서는 안드로이드 뒤로 버튼처럼(창 닫기·이전 화면·배틀 메뉴), 메인·타이틀에서는 떠날지 확인
else {
	let leaving = false, asking = false;
	history.pushState({ pkb: 1 }, '');
	window.addEventListener('popstate', async () => {
		if (leaving) return;
		history.pushState({ pkb: 1 }, '');
		if (asking) return;
		const atTop = !document.querySelector('.modal-bg') && !!document.querySelector('.hm, .title-screen');
		if (!atTop && (window as any).onAndroidBack?.()) return;
		asking = true;
		try {
			if (await confirmBox('나가기', '배틀 시뮬레이터를 떠날까요?\n진행 중인 연승 도전은 저장되어 있어요.', '나가기', '머무르기')) { leaving = true; history.go(-2); }
		} finally { asking = false; }
	});
}
// 규칙의 포켓몬 풀 사양으로 데이터(종족값·특성·기술·도구) 맞추기
applyRuleData(ruleById(loadSettings().battleRule));
settleRankPending();   // 랭크 매치 도중 앱이 꺼졌으면 패배로
settleSeason();        // 1주 시즌이 바뀌었으면 마감
checkAchievements(true);
render(<App />, document.getElementById('app')!);
// 줄바꿈: 'A · B' 의 가운뎃점이 줄 맨 앞에 오지 않게 (앞 공백을 줄바꿈 없는 공백으로), 'Z-A' 같은 하이픈 낱말은 끊지 않게(WJ). 화면에 새로 붙는 글자도 계속 고침
{
	const fix = (n: Node) => {
		if (n.nodeType === 3) { const t = (n as Text).data; if (/ · |[A-Za-z0-9]-[A-Za-z0-9]/.test(t)) (n as Text).data = t.replace(/ · /g, '\u00a0· ').replace(/([A-Za-z0-9])-([A-Za-z0-9])/g, '$1\u2060-\u2060$2'); return; }
		if (n.nodeType === 1 && !/^(INPUT|TEXTAREA|SCRIPT|STYLE)$/.test((n as Element).tagName)) n.childNodes.forEach(fix);
	};
	const root = document.getElementById('app')!;
	fix(root);
	new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') fix(m.target); else m.addedNodes.forEach(fix); } })
		.observe(root, { childList: true, subtree: true, characterData: true });
}
// 개발자 빌드 표시 (웹 /dev/ — main 브랜치 최신 코드, 저장 데이터는 정식 웹과 따로)
declare const __DEV_BUILD__: boolean, __BUILD_REV__: string;
if (typeof __DEV_BUILD__ !== 'undefined' && __DEV_BUILD__) {
	document.title = '[DEV] ' + document.title;
	const tag = document.createElement('div');
	tag.className = 'dev-tag';
	tag.textContent = `DEV v${APP_VERSION} · ${__BUILD_REV__}`;
	document.body.appendChild(tag);
}
