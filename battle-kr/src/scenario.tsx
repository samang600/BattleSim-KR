/** 시나리오 모드 (개발자 빌드) — 관동 편 · 이슬 루트
 *  틀: 「유희왕 태그 포스」식 — 시리즈(지방)를 고르고, 지도를 자유롭게 돌아다니며(이동하면 시간이 흐름: 아침·낮·저녁·밤) 길거리 트레이너와 배틀,
 *      인물을 찾아가 이야기·선물로 호감도(하트 4개)를 올리고, 태그를 맺어 멀티배틀. 하트가 찰 때마다 그 인물의 이야기(하트 이벤트)가 열림.
 *  본가에서 가져온 것: 처음 포켓몬·라이벌전, 풀숲의 야생 포켓몬과 볼로 잡기, 경험치·레벨업·진화·레벨업 기술, 배지와 레벨 상한,
 *      프렌들리숍·지닌 도구, 체육관(관문 트레이너 → 관장), 눈앞이 캄캄해짐(지면 가까운 포켓몬센터로), 밤에 달라지는 포켓몬.
 *  데이터: scenario-data.ts · 배경: scripts/gen-fields.py · 초상화: portraits-ai 브랜치(Pages /portraits/)
 *  저장: localStorage <접두사>scenario-kanto2 */
import { h, Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ask, Screen, Sprite, PokeIcon, TypeBadge, ItemIcon, toast, confirmBox } from './ui/core';
import { battle, playerName, playerSprite, BACK } from './modes';
import { load, save, remove } from './store';
import { speciesData, speciesKo, moveKo } from './data';
import { SPRITE_URL, trainerImgError } from './trainer-lines';
import { playMusic, sfx, cry } from './sound';
import type { PSet } from './sets';
import LEVELUP from './gen/levelup.json';
import { TIMES, TIME_CLS, WHO, LOCS, locOf, TRAINERS, WILDS, ITEMS, SHOPS, STARTERS, RIVAL_OF, LV_CAP, expNeed,
	MISTY_AT, MISTY_DOING, mistyTeam, MISTY_TALKS, FOLKS, type Who, type Trainer } from './scenario-data';
import { SCRIPTS, EV_TITLE } from './scenario-script';
import * as EM from './scenario-emotes.js';

const LU = LEVELUP as unknown as { [id: string]: { e?: [string, number]; m: [number, string][] } };
const PORTRAIT_BASE = 'https://samang600.github.io/BattleSim-KR/portraits/';
/** 외부 저장소에서 가져온 배경·아이콘 (scenario-assets 브랜치 → Pages /scn/). 없으면 직접 그린 그림으로 대신함 */
const SCN_BASE = 'https://samang600.github.io/BattleSim-KR/scn/';
const KEY = 'scenario-kanto2';
const NO_GIMMICK = '_one.natdex.yes.yes';
const won = (n: number) => n.toLocaleString('ko-KR') + '원';
let seq = 0;
/** 연달아 같은 종류의 화면을 띄워도 상태(글자 수·타이머)가 새로 시작하게 하는 key */
const K = () => 'k' + (++seq);
const josa = (w: string, a: string, b: string) => { const c = w.charCodeAt(w.length - 1); return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b); };

// ───────── 저장 ─────────
interface Mon { sp: string; lv: number; exp: number; item?: string; moves?: string[]; /** 기술은 이 레벨까지만 (첫 라이벌전) */ mlv?: number }
interface Run {
	v: 2; starter: string; party: Mon[]; box: Mon[]; money: number; bag: { [id: string]: number };
	loc: string; town: string; day: number; time: number; flags: { [k: string]: number }; beaten: { [id: string]: number };
	/** 이슬: 호감도 0~400 (하트 하나 = 100) · 끝낸 하트 이벤트 수 · 태그 중 · 마지막으로 이야기한 날 */
	heart: number; ev: number; tag: boolean; talked: number; badges: string[];
}
const newRun = (): Run => ({ v: 2, starter: '', party: [], box: [], money: 0, bag: {}, loc: 'pallet', town: 'pallet', day: 1, time: 0, flags: {}, beaten: {}, heart: 0, ev: 0, tag: false, talked: 0, badges: [] });
const persist = (r: Run) => save(KEY, r);
const has = (r: Run, f?: string) => !f || !!r.flags[f];
const lvCap = (r: Run) => LV_CAP[Math.min(r.badges.length, LV_CAP.length - 1)];
const heartCap = (r: Run) => !r.flags.badge2 ? 40 : Math.min(400, 100 * (r.ev + 1));
const give = (r: Run, id: string, n = 1) => { r.bag[id] = (r.bag[id] || 0) + n; if (r.bag[id] <= 0) delete r.bag[id]; };
const unlocked = (r: Run, id: string) => id === 'mtmoon' ? has(r, 'badge1') : id === 'cerulean' ? has(r, 'rocket1') : id === 'bridge' ? has(r, 'inv1') : id === 'cape' ? has(r, 'ev2') : true;
const LOCK_WHY: { [id: string]: string } = { mtmoon: '회색배지가 있어야 지나갈 수 있어요', cerulean: '달맞이산의 로켓단이 길을 막고 있어요', bridge: '아직 갈 일이 없는 곳이에요', cape: '아직 갈 일이 없는 곳이에요' };
/** 이슬이 지금 있는 곳 (태그 중이면 나와 함께) */
const mistyLoc = (r: Run) => { const l = MISTY_AT[r.time]; return unlocked(r, l) ? l : 'cerulean'; };
/** 다음 하트 이벤트를 시작할 수 있는가 (하트가 다 참) · 그 이벤트가 열리는 곳·시간 */
const EV_AT: [string, number | null][] = [['bridge', null], ['cerulean', null], ['cape', 2], ['cape', 2]];
const evReady = (r: Run) => !!r.flags.badge2 && r.ev < 4 && r.heart >= 100 * (r.ev + 1);

// ───────── 포켓몬 ─────────
const learned = (sp: string, lv: number) => [...new Set((LU[sp]?.m || []).filter(m => m[0] <= lv).map(m => m[1]))];
const movesOf = (m: Mon) => { const all = learned(m.sp, m.mlv ?? m.lv); const mine = (m.moves || []).filter(x => all.includes(x)); return mine.length ? mine : all.slice(-4); };
function toSet(m: Mon): PSet {
	const s = speciesData(m.sp, 9) as any, moves = movesOf(m);
	return { name: '', species: s?.en || m.sp, item: m.item ? ITEMS[m.item]?.held || '' : '', ability: s?.ab?.[0] || '', moves: moves.length ? moves : ['tackle'], nature: 'serious',
		evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: m.lv };
}
const mk = (t: [string, number][]): Mon[] => t.map(([sp, lv]) => ({ sp, lv, exp: 0 }));
/** 그 레벨이면 어디까지 진화했을지 (라이벌의 처음 포켓몬) */
const evoAt = (sp: string, lv: number) => { for (let e = LU[sp]?.e; e && lv >= e[1]; e = LU[sp]?.e) sp = e[0]; return sp; };
/** 경험치를 주고 레벨업·진화·새 기술을 처리 → 안내 줄 */
function addExp(m: Mon, xp: number, cap: number): string[] {
	const out: string[] = [], before = m.lv, old = learned(m.sp, m.lv);
	if (m.lv >= cap) { m.exp = 0; return out; }
	m.exp += xp;
	while (m.lv < cap && m.exp >= expNeed(m.lv)) { m.exp -= expNeed(m.lv); m.lv++; }
	if (m.lv >= cap) m.exp = 0;
	if (m.lv === before) return out;
	out.push(`${speciesKo(m.sp)} Lv${before} → Lv${m.lv}`);
	for (let e = LU[m.sp]?.e; e && m.lv >= e[1]; e = LU[m.sp]?.e) { out.push(`✨ ${josa(speciesKo(m.sp), '은', '는')} ${josa(speciesKo(e[0]), '으로', '로')} 진화했다!`); m.sp = e[0]; }
	const fresh = learned(m.sp, m.lv).filter(x => !old.includes(x));
	if (fresh.length) {
		if (m.moves) for (const f of fresh) { if (m.moves.length < 4) m.moves.push(f); }
		out.push(`${speciesKo(m.sp)}: 새 기술 ${fresh.map(moveKo).join(' · ')}${m.moves && m.moves.length >= 4 && !fresh.every(f => m.moves!.includes(f)) ? ' (파티 화면에서 바꿔 넣을 수 있어요)' : ''}`);
	}
	return out;
}

// ───────── 공용 화면 조각 ─────────
/** 지금 있는 곳의 풍경 (가방·파티·가게·결과 같은 안쪽 화면의 바탕으로 깔아 여행 중이라는 느낌이 끊기지 않게) */
const SCENE = { bg: 'pallet', tint: 0 };
const Back = () => <div class="sc-backdrop"><div class={'sc-bg fld-' + SCENE.bg} /><div class={'sc-tint ' + TIME_CLS[SCENE.tint]} /></div>;
/** 표정 그림(<초상 id>_<감정>.png)이 있는지 — 한 번만 알아봄. 있으면 그 그림, 없으면 기본 그림 */
const VARIANT: { [k: string]: boolean | undefined } = {};
function useVariant(id: string, emo?: string): string {
	const key = emo && id && !id.startsWith('d_') ? `${id}_${emo}` : '';
	const [, tick] = useState(0);
	useEffect(() => {
		if (!key || VARIANT[key] !== undefined) return;
		const im = new Image();
		im.onload = () => { VARIANT[key] = true; tick(x => x + 1); }; im.onerror = () => { VARIANT[key] = false; };
		im.src = `${PORTRAIT_BASE}${key}.png`;
	}, [key]);
	return key && VARIANT[key] ? key : id;
}
/** 초상화: 픽셀 상반신(없으면 쇼다운 도트). face = 동그란 아이콘용. emo = 표정(그림이 있으면 바뀜) */
function Portrait({ id, sprite, cls = '', emo }: { id: string; sprite: string; cls?: string; emo?: string }) {
	const [bad, setBad] = useState(false);
	const src = useVariant(id, emo);
	if (!id || bad) return sprite ? <img class={'sc-portrait dot ' + cls} src={SPRITE_URL(sprite)} onError={trainerImgError} alt="" /> : null;
	return <img class={'sc-portrait px ' + (id.startsWith('d_') ? 'dotp ' : '') + cls} src={`${PORTRAIT_BASE}${src}.png`} onError={() => setBad(true)} alt="" />;
}
/** 도구·배지 아이콘 (PokeAPI sprites). 못 불러오면 fb(직접 그린 것)로 */
function Ico({ name, size = 32, fb }: { name: string; size?: number; fb?: any }) {
	const [bad, setBad] = useState(false);
	if (bad) return fb || null;
	return <img class="sc-pico" style={{ width: size, height: size }} src={`${SCN_BASE}ico/${name}.png`} onError={() => setBad(true)} alt="" />;
}
const itemIco = (id: string, size: number) => { const it = ITEMS[id]; return <Ico name={it.icon} size={size} fb={it.held ? <ItemIcon item={it.held} size={Math.min(size, 32)} /> : <i class={'sc-ico2 ' + it.kind + ' ' + id} />} />; };
const BADGE_ICO: { [k: string]: string } = { 회색배지: 'badge1', 블루배지: 'badge2' };
const tWho = (t: Trainer): Who => ({ name: t.name, title: t.title, portrait: 'd_' + t.sprite, sprite: t.sprite });
const Hearts = ({ v, big }: { v: number; big?: boolean }) => <span class={'sc-hearts' + (big ? ' big' : '')}>{[0, 1, 2, 3].map(i => <i class="sc-heart"><b style={{ width: Math.max(0, Math.min(100, v - i * 100)) + '%' }} /></i>)}</span>;

type Line = [who: string | Who | null, text: string, emo?: string];
/** 지난 대사 (기록 보기) · 자동 넘김 설정 */
const LOG: { name: string; text: string }[] = [];
let autoOn = (() => { try { return localStorage.getItem('pkbkr-sc-auto') === '1'; } catch { return false; } })();
/** 감정 이모티콘: pixelfx 로 그린 움직이는 얼굴 (scenario-emotes.js) — 캔버스에 50ms 한 칸씩 */
function Emote({ kind }: { kind: string }) {
	const ref = useRef<HTMLCanvasElement>(null);
	const mod = EM.EMOTES[kind];
	useEffect(() => {
		const cv = ref.current, ctx = cv?.getContext('2d');
		if (!mod || !cv || !ctx) return;
		const [w, h] = mod.meta.size, [ox, oy] = mod.meta.origin;
		const fx = EM.createFx(mod, { x: ox, y: oy }), frame = EM.createFrame(w, h), img = ctx.createImageData(w, h);
		const tick = () => { fx.update(0.05); EM.clearFrame(frame); fx.draw(frame); EM.composite(frame, img.data, null); ctx.putImageData(img, 0, 0); };
		tick();
		const id = setInterval(tick, 50);
		return () => clearInterval(id);
	}, [kind]);
	if (!mod) return null;
	return <canvas ref={ref} class="sc-emo" width={mod.meta.size[0]} height={mod.meta.size[1]} />;
}
/** 대화 장면: 배경(시간대 색) + 큰 초상(감정 기호·움직임) + 이름 띠 + 대화창(한 글자씩). who 가 null 이면 해설
 *  위 단추: 기록(지난 대사) · 자동(다 나오면 알아서 넘김) · 건너뛰기 */
function Dialog({ lines, bg, tint, done, choice, mon }: { lines: Line[]; bg: string; tint: number; done: (i: number) => void; choice?: string[]; /** 장면에 서 있는 야생 포켓몬 */ mon?: string }) {
	const [i, setI] = useState(0), [n, setN] = useState(0), [log, setLog] = useState(false), [auto, setAuto] = useState(autoOn);
	const [who, text, emo] = lines[i], w = typeof who === 'string' ? WHO[who] : who, full = n >= text.length, last = i + 1 >= lines.length;
	useEffect(() => { setN(0); LOG.push({ name: w?.name || '', text }); if (LOG.length > 200) LOG.shift(); }, [i]);
	useEffect(() => { if (full) return; const t = setTimeout(() => setN(x => Math.min(text.length, x + 2)), 28); return () => clearTimeout(t); }, [n, i]);
	const next = () => { if (!full) { setN(text.length); return; } if (!last) { sfx('select'); setI(i + 1); } else if (!choice) done(0); };
	useEffect(() => { if (!auto || !full || log || (last && choice)) return; const t = setTimeout(next, 900 + text.length * 55); return () => clearTimeout(t); }, [auto, full, i, log]);
	const stop = (f: () => void) => (e: Event) => { e.stopPropagation(); f(); };
	useEffect(() => { if (mon) cry(mon); }, []);
	const dark = bg === 'black' || bg === 'space';
	return <div class={'story-talk sc-talk' + (w ? '' : ' narr') + (dark ? ' black' : '') + (mon ? ' wild' : '')} onClick={next}>
		<div class={'st-bg sc-bg fld-' + (dark ? 'black' : bg)} /><div class={'sc-tint ' + TIME_CLS[tint]} />
		{bg === 'space' && <><div class="sc-stars full" /><div class="sc-stars full far" /></>}
		{mon && <div class="sc-wildmon"><i class="sc-wildgrass" /><Sprite species={mon} gen={9} size={192} anim={false} /></div>}
		{w && <div class="st-portrait sc-stp" key={w.name}>
			<div class={'sc-act' + (emo ? ' mv-' + emo : '')} key={i}><Portrait id={w.portrait} sprite={w.sprite} cls="big" emo={emo} /></div>
			{emo && <Emote kind={emo} key={'e' + i} />}
		</div>}
		<div class="st-box">
			{w && <div class="st-name"><span>{w.name}{w.title && <small> {w.title}</small>}</span><i class="st-deco" /></div>}
			<div class="st-text">{text.slice(0, n)}{full && !(last && choice) && <span class="st-arrow">▼</span>}</div>
		</div>
		{last && full && choice && <div class="sc-choice" onClick={e => e.stopPropagation()}>{choice.map((c, k) => <button onClick={() => { sfx('select'); done(k); }}>{c}</button>)}</div>}
		<div class="sc-talkbtns">
			<button onClick={stop(() => setLog(true))}>기록</button>
			<button class={auto ? 'on' : ''} onClick={stop(() => { autoOn = !auto; try { localStorage.setItem('pkbkr-sc-auto', autoOn ? '1' : '0'); } catch {} setAuto(autoOn); })}>자동{auto ? ' ●' : ''}</button>
		</div>
		{!choice && <button class="st-skip" onClick={stop(() => done(0))}>건너뛰기 ▶▶</button>}
		{log && <div class="sc-log" onClick={stop(() => setLog(false))}>
			<h3>지난 대사 <small>화면을 누르면 닫힘</small></h3>
			<div class="sc-log-list" ref={(el: any) => { if (el) el.scrollTop = el.scrollHeight; }}>{LOG.map(l => <p class={l.name ? '' : 'narr'}>{l.name && <b>{l.name}</b>}{l.text}</p>)}</div>
		</div>}
	</div>;
}
/** 화면 전환·카드: fade(검게) · iris(동그랗게 닫힘) · blinds(가로 띠) · battle(번쩍 + 빗금) · card(제목 카드) */
function Fx({ kind, bg, tint, title, sub, small, ms, done }: { kind: string; bg: string; tint: number; title?: string; sub?: string; small?: string; ms: number; done: () => void }) {
	useEffect(() => { const t = setTimeout(done, ms); return () => clearTimeout(t); }, []);
	return <div class={'sc-fx sc-fx-' + kind} onClick={() => kind === 'card' && done()}>
		<div class={'sc-bg fld-' + bg} /><div class={'sc-tint ' + TIME_CLS[tint]} />
		<div class="sc-fx-ov">{kind === 'blinds' && [0, 1, 2, 3, 4, 5, 6, 7].map(i => <i style={{ animationDelay: i * 40 + 'ms' }} />)}{kind === 'battle' && [0, 1, 2, 3, 4, 5].map(i => <i style={{ animationDelay: 260 + i * 50 + 'ms' }} />)}</div>
		{title && <div class="sc-card"><small>{small}</small><b>{title}</b><em>{sub}</em></div>}
	</div>;
}

// ───────── 진행 도우미 (run 을 잡고 있는 묶음) ─────────
function engine(run: Run) {
	const L = () => locOf(run.loc);
	const say = (lines: Line[], bg = L().bg, mon?: string) => lines.length ? ask<number>(r => <Dialog key={K()} lines={lines} bg={bg} tint={bg === 'black' || bg === 'space' || bg === 'lab' || bg === 'pool' ? 1 : run.time} done={r} mon={mon} />) : Promise.resolve(0);
	const choose = (who: string | Who | null, text: string, opts: string[], bg = L().bg, mon?: string) => ask<number>(r => <Dialog key={K()} lines={[[who, text]]} bg={bg} tint={run.time} done={r} choice={opts} mon={mon} />);
	const fx = (kind: string, ms = 700, bg = L().bg) => ask<void>(r => <Fx key={K()} kind={kind} bg={bg} tint={run.time} ms={ms} done={r} />);
	const card = (title: string, sub: string, small = '', bg = 'black', ms = 2400) => ask<void>(r => <Fx key={K()} kind="card" bg={bg} tint={1} title={title} sub={sub} small={small} ms={ms} done={r} />);
	const got = async (id: string, n = 1) => { give(run, id, n); persist(run); sfx('select'); await ask<void>(r => <GetCard key={K()} icon={ITEMS[id].icon} title={`${ITEMS[id].name}${n > 1 ? ` ×${n}` : ''}`} sub={ITEMS[id].desc} done={r} />); };
	const pay = async (n: number) => { run.money += n; persist(run); await ask<void>(r => <GetCard key={K()} title={won(n)} sub="상금을 받았다!" coin done={r} />); };
	/** 호감도 올리기(상한까지) → 하트 연출 */
	const heart = async (n: number) => {
		const before = run.heart; run.heart = Math.max(0, Math.min(heartCap(run), run.heart + n)); persist(run);
		if (run.heart === before) return;
		await ask<void>(r => <HeartCard key={K()} from={before} to={run.heart} done={r} />);
	};
	/** 시간을 한 칸 보냄. 밤이 지나면 다음 날 아침 (날짜 카드) */
	const tick = async (toMorning = false) => {
		if (toMorning || run.time === 3) { run.day++; run.time = 0; persist(run); await card(`${run.day}일째`, '아침이 밝았다', '관동 편', 'black', 1500); }
		else { run.time++; persist(run); }
	};
	/** 배틀 (전환 연출 포함). tag = 이슬과 멀티배틀: 내 앞 3마리 + 이슬 3마리 */
	const fight = async (o: { name: string; title?: string; sprite: string; sprite2?: string; team: Mon[]; skill: number; arena?: string; music?: string; tag?: boolean; line?: string }): Promise<boolean> => {
		const mine = (o.tag ? run.party.slice(0, 3) : run.party).map(toSet);
		let team = mine, flags: boolean[] | null = null;
		if (o.tag) {
			const hers = mk(mistyTeam(run.ev)).map(toSet); team = []; flags = [];
			for (let i = 0; i < Math.max(mine.length, hers.length); i++) { if (mine[i]) { team.push(mine[i]); flags.push(false); } if (hers[i]) { team.push(hers[i]); flags.push(true); } }
		}
		await fx('battle', 900);
		const res = await battle({
			gen: 9, doubles: !!o.tag, aiSkill: o.skill, bg: (o.arena || L().arena) as any, music: (o.music || 'battle') as any, label: `시나리오 · ${L().name}`, noRecord: true, ruleId: NO_GIMMICK,
			p1: { name: playerName(), team, sprite: playerSprite() },
			p2: { name: o.name, title: o.title || '', team: o.team.map(toSet), sprite: o.sprite, sprite2: o.sprite2, line: o.line },
			partner: flags ? { name: '이슬', theirs: flags, skill: 0.75, sprite: 'misty' } : undefined,
		} as any);
		playMusic(L().music);
		return res.win;
	};
	/** 이긴 뒤: 경험치(파티 전원)·상금 → 결과 화면 */
	const reward = async (foes: Mon[], heading: string, money: number, wild = false) => {
		const xp = Math.round(foes.reduce((a, f) => a + f.lv, 0) * (wild ? 2.5 : 4)), cap = lvCap(run), notes: string[] = [];
		for (const m of run.party) notes.push(...addExp(m, xp, cap));
		run.money += money; persist(run);
		await ask<void>(r => <Result key={K()} heading={heading} xp={xp} money={money} notes={notes} party={run.party} cap={cap} done={r} />);
	};
	/** 눈앞이 캄캄해짐: 가까운 포켓몬센터(집)로, 돈 10% 잃음 */
	const blackout = async () => {
		const lost = Math.floor(run.money / 10); run.money -= lost; run.loc = run.town; run.tag = false;
		const t = locOf(run.town);
		await say([[null, `${playerName()}의 포켓몬은 모두 쓰러졌다…\n눈앞이 캄캄해졌다!`], [null, `${t.name}의 ${josa(t.rest || '포켓몬센터', '으로', '로')} 서둘러 돌아갔다.${lost ? `\n(허둥대다 ${josa(won(lost), '을', '를')} 떨어뜨렸다)` : ''}`]], 'black');
		await tick();
	};
	return { L, say, choose, fx, card, got, pay, heart, tick, fight, reward, blackout };
}
type Eng = ReturnType<typeof engine>;

/** 대본(scenario-script.ts)을 읽어 나감. 배틀에서 지면 거기서 멈추고 false */
const fill = (run: Run, t: string) => t.replace(/\{me\}/g, playerName()).replace(/\{starter\}/g, run.starter ? speciesKo(run.starter) : '');
const toLine = (run: Run, t: string): Line => { const m = /^([a-z]*)(?:\[(\w+)\])?: ([\s\S]*)$/.exec(t); return m ? [m[1] || null, fill(run, m[3]), m[2]] : [null, fill(run, t)]; };
async function play(run: Run, E: Eng, id: string): Promise<boolean> {
	let bg: string | null = null, buf: Line[] = [];
	const at = () => bg || E.L().bg;
	const flush = async () => { if (buf.length) { const b = buf; buf = []; await E.say(b, at()); } };
	for (const c of SCRIPTS[id] || []) {
		if (typeof c === 'string') { buf.push(toLine(run, c)); continue; }
		await flush();
		if ('bg' in c) bg = c.bg;
		else if ('card' in c) await E.card(c.card[1], c.card[2], c.card[0], c.card[3] || 'black');
		else if ('fight' in c) {
			const team = mk(c.fight.team.map(([sp, lv]) => [sp === '{rival}' ? evoAt(RIVAL_OF[run.starter] || 'eevee', lv) : sp, lv] as [string, number]));
			if (!(await E.fight({ ...c.fight, team }))) { await E.say([toLine(run, c.lose)], at()); return false; }
			await E.reward(team, c.win, c.money);
		}
		else if ('got' in c) await E.got(c.got, c.n || 1);
		else if ('pay' in c) { run.money += c.pay; persist(run); await ask<void>(r => <GetCard key={K()} title={won(c.pay)} sub={c.sub} coin done={r} />); }
		else if ('heart' in c) await E.heart(c.heart);
		else if ('badge' in c) { run.flags[c.flag] = 1; run.badges.push(c.badge); persist(run); await ask<void>(r => <GetCard key={K()} icon={c.icon} title={c.badge} sub={c.sub} done={r} />); }
		else if ('flag' in c) { run.flags[c.flag] = 1; persist(run); }
		else if ('toast' in c) toast(c.toast);
		else if ('music' in c) playMusic(c.music);
	}
	await flush();
	return true;
}
/** 지도 위 이동 연출 (웨스노스의 여정 지도처럼): 길을 따라 점선이 그어지고 내 트레이너가 한 곳씩 옮겨 감 */
function routeBetween(run: Run, a: string, b: string): string[] {
	const prev: { [id: string]: string } = { [a]: '' }, q = [a];
	while (q.length) { const x = q.shift()!; if (x === b) break; for (const y of locOf(x).to) if (!(y in prev) && unlocked(run, y)) { prev[y] = x; q.push(y); } }
	const out: string[] = []; for (let x = b; x; x = prev[x]) out.unshift(x);
	return out[0] === a ? out : [a, b];
}
function Travel({ run, to, done }: { run: Run; to: string; done: () => void }) {
	const path = routeBetween(run, run.loc, to).map(locOf);
	const [k, setK] = useState(0);
	useEffect(() => { const t = setTimeout(() => k + 1 < path.length ? setK(k + 1) : done(), k + 1 < path.length ? 430 : 420); return () => clearTimeout(t); }, [k]);
	return <div class="sc-mapscr sc-travel" onClick={done}>
		<div class="sh-top sc-top"><div class="sh-title">{locOf(run.loc).name} → {locOf(to).name}<em class="sc-mission">이동 중…</em></div>
			<div class="sc-clock"><small>{run.day}일째</small><b class={TIME_CLS[run.time]}>{TIMES[run.time]}</b></div></div>
		<div class="sc-mapwrap"><div class="sc-map">
			<svg class="sc-roads" viewBox="0 0 100 100" preserveAspectRatio="none">
				{LOCS.flatMap(a => a.to.filter(b => a.id < b).map(b => { const B = locOf(b); return <line x1={a.x} y1={a.y} x2={B.x} y2={B.y} class="off" />; }))}
				{path.slice(0, k).map((a, i) => <line x1={a.x} y1={a.y} x2={path[i + 1].x} y2={path[i + 1].y} class="go" />)}
			</svg>
			{LOCS.map(l => <span class={'sc-node' + (l.town ? ' town' : '') + (l.id === to ? ' sel' : '') + (unlocked(run, l.id) ? '' : ' lock')} style={{ left: l.x + '%', top: l.y + '%' }}><i />{l.id === to && <span>{l.name}</span>}</span>)}
			<img class="sc-travel-me" style={{ left: path[k].x + '%', top: path[k].y + '%' }} src={SPRITE_URL(playerSprite())} alt="" onError={trainerImgError} />
		</div></div>
	</div>;
}

function GetCard({ title, sub, icon, coin, done }: { title: string; sub: string; icon?: string; coin?: boolean; done: () => void }) {
	return <div class="sc-get" onClick={done}><div class="sc-get-box">
		<span class="sc-get-ico">{coin ? <Ico name="coin-case" size={56} fb={<i class="sc-coin" />} /> : icon ? <Ico name={icon} size={56} fb={<i class="sc-gift" />} /> : <i class="sc-gift" />}</span>
		<b>{josa(title, '을', '를')} 손에 넣었다!</b><small>{sub}</small><em>화면을 누르면 계속</em>
	</div></div>;
}
function HeartCard({ from, to, done }: { from: number; to: number; done: () => void }) {
	const [v, setV] = useState(from);
	useEffect(() => { const t = setTimeout(() => setV(to), 250); return () => clearTimeout(t); }, []);
	const up = Math.floor(to / 100) > Math.floor(from / 100), down = to < from;
	return <div class="sc-get sc-heartcard" onClick={done}><div class="sc-get-box">
		<span class="sc-hc-face"><Portrait id="misty" sprite="misty" cls="face" /></span>
		<Hearts v={v} big />
		<b>{down ? '이슬의 표정이 굳었다…' : up ? '이슬과의 사이가 깊어졌다!' : '이슬과 조금 더 가까워졌다'}</b>
		<small>{down ? `호감도 ${to - from}` : `호감도 +${to - from}`}{up && to < 400 ? ' · 이슬에게 말을 걸어 보자' : ''}</small>
		{!down && <i class="sc-hc-float">♥</i>}<em>화면을 누르면 계속</em>
	</div></div>;
}
function Result({ heading, xp, money, notes, party, cap, done }: { heading: string; xp: number; money: number; notes: string[]; party: Mon[]; cap: number; done: () => void }) {
	useEffect(() => { if (notes.some(l => / → Lv/.test(l))) { const t = setTimeout(() => sfx(notes.some(l => l.startsWith('✨')) ? 'heal' : 'statUp'), 250); return () => clearTimeout(t); } }, []);
	return <Screen title="배틀 결과" cls="sc-scr"><Back />
		<div class="sc-result"><h2>{heading}</h2>
			<p class="sc-res-row"><span>경험치</span><b>+{xp}</b>{money > 0 && <><span>상금</span><b>{won(money)}</b></>}</p>
			<div class="sc-res-party">{party.map(m => <div class="sc-res-mon"><PokeIcon species={m.sp} /><span>Lv{m.lv}</span><i class="sc-xp"><b style={{ width: (m.lv >= cap ? 100 : Math.round(100 * m.exp / expNeed(m.lv))) + '%' }} /></i></div>)}</div>
			{notes.map((l, i) => <p class={'sc-res-note ' + (l.startsWith('✨') ? 'evo' : / → Lv/.test(l) ? 'lv' : 'mv')} style={{ animationDelay: 200 + i * 140 + 'ms' }}>{/ → Lv/.test(l) && <i>LEVEL UP</i>}{l}</p>)}
			{party.some(m => m.lv >= cap) && <p class="muted small">레벨 상한 Lv{cap} — 다음 배지를 얻으면 더 올릴 수 있어요.</p>}
		</div>
		<button class="btn big primary" onClick={done}>확인</button>
	</Screen>;
}

// ───────── 거점 화면 ─────────
type Node = { k: string; label: string; mark: string; face?: Who; kind?: string; done?: boolean; data?: any };
type Act = Node | { k: 'map' | 'party' | 'bag' | 'route' } | typeof BACK;
/** 그린이 기다리는 곳: [대본 id, 장소, 필요한 표식] */
const RIVAL_AT: [string, string, string][] = [['rival2', 'viridian', 'intro'], ['rival3', 'cerulean', 'met'], ['rival4', 'cape', 'ev4']];
const SLOTS: [number, number][] = [[24, 30], [72, 28], [48, 38], [20, 46], [76, 46], [48, 54], [22, 62], [70, 62], [48, 22], [80, 76]];
/** 휴대폰 가로: 높이가 낮아 두 줄로 (오른쪽은 내 트레이너 자리) */
const SLOTS_LAND: [number, number][] = [[9, 36], [25, 36], [41, 36], [57, 36], [9, 68], [25, 68], [41, 68], [57, 68], [17, 52], [49, 52]];
const isLand = () => innerWidth > innerHeight && innerHeight < 541;
function nodesAt(run: Run): Node[] {
	const loc = locOf(run.loc), out: Node[] = [];
	// 이야기 (하트 이벤트 · 체육관)
	if (run.loc === 'pewter' && has(run, 'p1') && !has(run, 'badge1')) out.push({ k: 'brock', label: '웅', mark: '!', face: WHO.brock, kind: 'story' });
	if (run.loc === 'cerulean' && has(run, 'c2') && !has(run, 'badge2')) out.push({ k: 'gym', label: '이슬', mark: '!', face: WHO.misty, kind: 'story' });
	const inv = run.flags['inv' + (run.ev + 1)], at = EV_AT[run.ev];
	if (inv && at && at[0] === run.loc && (at[1] === null || at[1] === run.time)) out.push({ k: 'event', label: '이슬', mark: '♥', face: WHO.misty, kind: 'story' });
	else if (has(run, 'met') && (run.tag || mistyLoc(run) === run.loc) && !(run.loc === 'cerulean' && !has(run, 'badge2') && has(run, 'c2')))
		out.push({ k: 'misty', label: '이슬', mark: evReady(run) && !inv ? '!' : '♥', face: WHO.misty, kind: 'friend' });
	// 라이벌 그린: 상록시티(여행 초반) · 블루시티(이슬을 만난 뒤) · 블루곶(이슬 루트를 끝낸 뒤)
	const rv = RIVAL_AT.find(([id, at, need]) => at === run.loc && has(run, need) && !has(run, id));
	if (rv) out.push({ k: 'script', label: '그린', mark: '!', face: WHO.rival, kind: 'story', data: rv[0] });
	for (const t of TRAINERS) {
		if (t.loc !== run.loc || t.id === 'brock' || !has(run, t.need) || (t.at && !t.at.includes(run.time))) continue;
		const done = t.once ? !!run.flags[t.id] : run.beaten[t.id] === run.day;
		if (t.once && done && !t.again) continue;
		out.push({ k: 'trainer', label: t.name, mark: done ? '✓' : '!', face: tWho(t), done, data: t });
	}
	if (WILDS.some(w => w.loc === run.loc)) { const w = WILDS.find(x => x.loc === run.loc)!; out.push({ k: 'wild', label: w.name, mark: '?', kind: 'grass', data: (run.time === 3 && w.night ? w.night : w.pool)[0][0] }); }
	if (run.loc === 'pallet') out.push({ k: 'oak', label: '오박사 연구소', mark: '…', face: WHO.oak });
	if (run.loc === 'mtmoon' && !has(run, 'karp')) out.push({ k: 'karp', label: '수상한 아저씨', mark: '₩', face: WHO.salesman });
	if (run.loc === 'cerulean') out.push({ k: 'bike', label: '자전거 가게', mark: '…', kind: 'bike' });
	if (SHOPS[run.loc]) out.push({ k: 'shop', label: SHOPS[run.loc].name.split(' · ')[0], mark: '₩', face: WHO.clerk });
	const fk = FOLKS.find(f => f.loc === run.loc && has(run, f.need));
	if (fk) out.push({ k: 'folk', label: fk.who.name, mark: fk.gift && !has(run, 'folk-' + fk.loc) ? '!' : '…', face: fk.who, data: fk });
	if (loc.rest) out.push({ k: 'rest', label: loc.rest, mark: 'z', face: run.loc === 'pallet' ? undefined : WHO.joy, kind: run.loc === 'pallet' ? 'house' : '' });   // ('home' 은 메인 화면이 쓰는 클래스라 단추가 화면 밖으로 밀려났음)
	return out;
}
function Hub({ run, banner, done }: { run: Run; banner: boolean; done: (a: Act) => void }) {
	const loc = locOf(run.loc), nodes = nodesAt(run);
	SCENE.bg = loc.bg; SCENE.tint = run.time;
	const [land, setLand] = useState(isLand());
	useEffect(() => { playMusic(loc.music); const f = () => setLand(isLand()); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
	const SL = land ? SLOTS_LAND : SLOTS;
	return <div class="story-hub sc-hub sc-open">
		<div class={'sh-bg sc-bg fld-' + loc.bg} /><div class={'sc-tint ' + TIME_CLS[run.time]} />
		{run.time === 3 && <div class="sc-stars" />}
		<div class="sh-top sc-top">
			<button class="st-exit" onClick={() => done(BACK)}>◀</button>
			<div class="sc-clock"><small>{run.day}일째</small><b class={TIME_CLS[run.time]}>{TIMES[run.time]}</b></div>
			<div class="sh-title">관동 · {loc.name}<em class="sc-mission">{goalText(run)}</em></div>
			<div class="sc-wallet"><span>{won(run.money)}</span>{has(run, 'met') && <Hearts v={run.heart} />}</div>
		</div>
		{banner && <div class="sc-banner"><b>{loc.name}</b><span>{loc.sub}</span></div>}
		{nodes.slice(0, SLOTS.length).map((n, i) => <button class={'sh-npc' + (n.done ? ' done' : '') + (n.kind ? ' ' + n.kind : '')} style={{ left: SL[i][0] + '%', top: SL[i][1] + '%' }} onClick={() => { sfx('select'); done(n); }}>
			<span class="sh-face">{n.face ? <Portrait id={n.face.portrait} sprite={n.face.sprite} cls="face" /> : n.kind === 'grass' ? <span class="sc-wildico"><PokeIcon species={n.data} /></span> : <Ico name={n.kind === 'bike' ? 'bicycle' : 'poke-doll'} size={52} fb={<span class={'sc-ico ' + (n.kind || '')} />} />}</span>
			<span class="sh-mark">{n.mark}</span><span class="sh-label">{n.label}</span>
		</button>)}
		<div class="sh-me sc-me2" role="button" onClick={() => done({ k: 'party' })}>
			{run.tag && <img class="sc-partner" src={SPRITE_URL('misty')} alt="" onError={trainerImgError} />}
			<img src={SPRITE_URL(playerSprite())} alt="" onError={trainerImgError} />
			<div class="sh-me-bar"><b>{playerName()}{run.tag && <small class="sc-tagchip"> ＆ 이슬</small>}</b><small class="sc-badgerow">{run.badges.map(b => <Ico name={BADGE_ICO[b]} size={18} fb={<span>🏅</span>} />)}{!run.badges.length && '배지 0'} · 상한 Lv{lvCap(run)}</small>
				<span class="sc-party2">{run.party.map(m => <span class="sc-pmon"><PokeIcon species={m.sp} /><small>Lv{m.lv}</small></span>)}</span></div>
		</div>
		<div class="sc-tabs2 sc-menu">
			<button class="on" onClick={() => done({ k: 'map' })}><Ico name="town-map" size={26} fb={<i class="sc-mi map" />} />지도</button>
			<button onClick={() => done({ k: 'party' })}><Ico name="poke-ball" size={26} fb={<i class="sc-mi ball" />} />포켓몬</button>
			<button onClick={() => done({ k: 'bag' })}><Ico name="travel-trunk" size={26} fb={<i class="sc-mi bag" />} />가방</button>
			<button onClick={() => done({ k: 'route' })}><Ico name="heart-mail" size={26} fb={<i class="sc-mi heart" />} />루트</button>
		</div>
	</div>;
}
/** 지금 할 일 한 줄 */
function goalText(run: Run): string {
	if (!has(run, 'badge1')) return has(run, 'p1') ? '회색 체육관 관장 웅에게 도전하자' : '북쪽 회색시티의 체육관을 목표로';
	if (!has(run, 'rocket1')) return '달맞이산을 넘어 블루시티로';
	if (!has(run, 'met')) return '블루시티로 가 보자';
	if (!has(run, 'badge2')) return '블루 체육관 관장 이슬에게 도전하자';
	if (run.ev >= 4) return '이슬 루트 클리어 — 자유롭게 돌아다녀요';
	const at = EV_AT[run.ev];
	if (run.flags['inv' + (run.ev + 1)]) return `${at[1] === 2 ? '저녁에 ' : ''}${locOf(at[0]).name}에서 이슬이 기다리고 있다`;
	if (evReady(run)) return '하트가 가득 찼다 — 이슬에게 말을 걸자';
	return `이슬과 가까워지자 (${TIMES[run.time]}: ${locOf(mistyLoc(run)).name})`;
}

/** 월드맵: 갈 곳 고르기 (이동하면 시간이 한 칸 흐름) */
function WorldMap({ run, done }: { run: Run; done: (id: string | null) => void }) {
	const mL = has(run, 'met') ? (run.tag ? run.loc : mistyLoc(run)) : '';
	const [sel, setSel] = useState(run.loc);
	const s = locOf(sel), open = unlocked(run, sel);
	return <div class="sc-mapscr sc-open">
		<div class="sh-top sc-top"><button class="st-exit" onClick={() => done(null)}>◀</button><div class="sh-title">관동 지방<em class="sc-mission">갈 곳을 고르세요 · 이동하면 시간이 흐릅니다</em></div>
			<div class="sc-clock"><small>{run.day}일째</small><b class={TIME_CLS[run.time]}>{TIMES[run.time]}</b></div></div>
		<div class="sc-mapwrap"><div class="sc-map">
			<svg class="sc-roads" viewBox="0 0 100 100" preserveAspectRatio="none">{LOCS.flatMap(a => a.to.filter(b => a.id < b).map(b => { const B = locOf(b); return <line x1={a.x} y1={a.y} x2={B.x} y2={B.y} class={unlocked(run, a.id) && unlocked(run, b) ? '' : 'off'} />; }))}</svg>
			{LOCS.map(l => <button class={'sc-node' + (l.town ? ' town' : '') + (l.id === run.loc ? ' here' : '') + (l.id === sel ? ' sel' : '') + (unlocked(run, l.id) ? '' : ' lock')} style={{ left: l.x + '%', top: l.y + '%' }} onClick={() => { sfx('select'); setSel(l.id); }}>
				<i />{l.id === run.loc && <img class="sc-node-me" src={SPRITE_URL(playerSprite())} alt="" onError={trainerImgError} />}
				{l.id === mL && <span class="sc-node-friend"><Portrait id="misty" sprite="misty" cls="face" /></span>}
				<span>{unlocked(run, l.id) ? l.name : '？？？'}</span>
			</button>)}
		</div></div>
		<div class="sc-mapinfo">
			<div class={'sc-mapthumb sc-bg fld-' + (open ? s.bg : 'black')}><div class={'sc-tint ' + TIME_CLS[run.time]} /></div>
			<div class="sc-mapdesc"><b>{open ? s.name : '？？？'}</b><small>{open ? s.sub : LOCK_WHY[sel]}</small>
				{open && <small class="sc-maptags">{WILDS.some(w => w.loc === sel) && <span>풀숲</span>}{SHOPS[sel] && <span>가게</span>}{s.rest && <span>쉼터</span>}{sel === mL && <span class="h">♥ 이슬</span>}</small>}</div>
			<button class="btn primary" disabled={!open || sel === run.loc} onClick={() => done(sel)}>{sel === run.loc ? '지금 있는 곳' : '이동'}</button>
		</div>
	</div>;
}

// ───────── 파티·가방·가게·루트 ─────────
function MonEdit({ run, m, done }: { run: Run; m: Mon; done: () => void }) {
	const [, tick] = useState(0), re = () => { persist(run); tick(x => x + 1); };
	const all = learned(m.sp, m.lv), cur = movesOf(m), s = speciesData(m.sp, 9) as any;
	const held = Object.keys(run.bag).filter(id => ITEMS[id]?.kind === 'held');
	const toggle = (mv: string) => { const c = [...cur]; const i = c.indexOf(mv); if (i >= 0) { if (c.length > 1) c.splice(i, 1); } else if (c.length < 4) c.push(mv); else { toast('기술은 4개까지예요. 먼저 하나를 빼 주세요'); return; } m.moves = c; re(); };
	return <Screen title={speciesKo(m.sp)} onBack={done} cls="sc-scr"><Back />
		<div class="sc-mon big"><Sprite species={m.sp} gen={9} size={96} anim={false} />
			<div class="sc-mon-body"><b>{speciesKo(m.sp)} <small>Lv{m.lv}</small></b><span class="sc-types">{(s?.t || []).map((t: string) => <TypeBadge type={t} />)}</span>
				<i class="sc-xp wide"><b style={{ width: (m.lv >= lvCap(run) ? 100 : Math.round(100 * m.exp / expNeed(m.lv))) + '%' }} /></i>
				<small>{m.lv >= lvCap(run) ? `레벨 상한 (Lv${lvCap(run)})` : `다음 레벨까지 ${expNeed(m.lv) - m.exp}`}{LU[m.sp]?.e ? ` · Lv${LU[m.sp].e![1]}에 ${josa(speciesKo(LU[m.sp].e![0]), '으로', '로')} 진화` : ''}</small></div></div>
		<h3 class="sec">기술 <small class="muted">{cur.length}/4 · 눌러서 넣고 빼기</small></h3>
		<div class="sc-moves">{all.map(mv => <button class={cur.includes(mv) ? 'on' : ''} onClick={() => toggle(mv)}>{moveKo(mv)}</button>)}</div>
		<h3 class="sec">지닌 도구</h3>
		<div class="sc-moves">
			<button class={!m.item ? 'on' : ''} onClick={() => { if (m.item) { give(run, m.item); m.item = undefined; re(); } }}>없음</button>
			{m.item && <button class="on"><ItemIcon item={ITEMS[m.item].held!} size={20} /> {ITEMS[m.item].name}</button>}
			{held.map(id => <button onClick={() => { if (m.item) give(run, m.item); m.item = id; give(run, id, -1); re(); }}><ItemIcon item={ITEMS[id].held!} size={20} /> {ITEMS[id].name} ×{run.bag[id]}</button>)}
		</div>
		{!held.length && !m.item && <p class="muted small">지닐 수 있는 도구는 프렌들리숍에서 살 수 있어요.</p>}
		<button class="btn big" onClick={done}>돌아가기</button>
	</Screen>;
}
function MonCard({ m, children, onClick }: { m: Mon; children?: any; onClick?: () => void }) {
	const s = speciesData(m.sp, 9) as any;
	return <div class="sc-mon">
		<span onClick={onClick}><Sprite species={m.sp} gen={9} size={64} anim={false} /></span>
		<div class="sc-mon-body" onClick={onClick}><b>{speciesKo(m.sp)} <small>Lv{m.lv}</small>{m.item && <ItemIcon item={ITEMS[m.item].held!} size={18} />}</b>
			<span class="sc-types">{(s?.t || []).map((t: string) => <TypeBadge type={t} />)}</span>
			<small>{movesOf(m).map(moveKo).join(' · ')}</small></div>
		<div class="sc-mon-btns">{children}</div>
	</div>;
}
function PartyScreen({ run, done }: { run: Run; done: () => void }) {
	const [, tick] = useState(0), [edit, setEdit] = useState<Mon | null>(null);
	const re = () => { persist(run); tick(x => x + 1); };
	if (edit) return <MonEdit run={run} m={edit} done={() => setEdit(null)} />;
	return <Screen title="포켓몬" onBack={done} cls="sc-scr"><Back />
		<h3 class="sec">파티 <small class="muted">{run.party.length}/6 · 맨 위가 선두{run.tag ? ' · 태그 배틀은 위 3마리가 나가요' : ''}</small></h3>
		{run.party.map((m, i) => <MonCard m={m} onClick={() => setEdit(m)}>
			<button class="btn small" onClick={() => setEdit(m)}>기술·도구</button>
			{i > 0 && <button class="btn small" onClick={() => { run.party.splice(i, 1); run.party.splice(i - 1, 0, m); re(); }}>▲</button>}
			{run.party.length > 1 && <button class="btn small ghost" onClick={() => { run.party.splice(i, 1); run.box.push(m); re(); }}>박스로</button>}
		</MonCard>)}
		{run.box.length > 0 && <h3 class="sec">박스 <small class="muted">{run.box.length} · 박스의 포켓몬은 경험치를 받지 않아요</small></h3>}
		{run.box.map((m, i) => <MonCard m={m} onClick={() => setEdit(m)}>
			<button class="btn small" disabled={run.party.length >= 6} onClick={() => { run.box.splice(i, 1); run.party.push(m); re(); }}>파티로</button>
		</MonCard>)}
		<button class="btn big" onClick={done}>돌아가기</button>
	</Screen>;
}
const KIND_KO: { [k: string]: string } = { ball: '볼', held: '지닌 도구', gift: '선물', sell: '귀중품' };
function ItemRow({ id, right, sub }: { id: string; right: any; sub?: string }) {
	const it = ITEMS[id];
	return <div class="sc-item"><span class="sc-item-ico">{itemIco(id, 36)}</span>
		<div class="sc-item-body"><b>{it.name} <small class="sc-kind">{KIND_KO[it.kind]}</small></b><small>{sub || it.desc}</small></div>{right}</div>;
}
function BagScreen({ run, done }: { run: Run; done: () => void }) {
	const ids = Object.keys(run.bag).sort((a, b) => Object.keys(ITEMS).indexOf(a) - Object.keys(ITEMS).indexOf(b));
	return <Screen title="가방" onBack={done} cls="sc-scr"><Back />
		<p class="sc-purse">가진 돈 <b>{won(run.money)}</b></p>
		{!ids.length && <p class="hint">가방이 비어 있어요.</p>}
		{ids.map(id => <ItemRow id={id} right={<b class="sc-count">×{run.bag[id]}</b>} />)}
		<p class="muted small">볼은 야생 포켓몬을 이긴 뒤에, 지닌 도구는 「포켓몬」 화면에서, 선물은 상대에게 말을 걸어 건넵니다. 귀중품은 가게에서 팔 수 있어요.</p>
		<button class="btn big" onClick={done}>돌아가기</button>
	</Screen>;
}
function ShopScreen({ run, done }: { run: Run; done: () => void }) {
	const [, tick] = useState(0), shop = SHOPS[run.loc];
	const buy = (id: string) => { const it = ITEMS[id]; if (run.money < it.price) { toast('돈이 모자라요'); return; } run.money -= it.price; give(run, id); persist(run); sfx('select'); tick(x => x + 1); };
	const sells = Object.keys(run.bag).filter(id => ITEMS[id]?.sell);
	return <Screen title={shop.name} onBack={done} cls="sc-scr"><Back />
		<p class="sc-purse">가진 돈 <b>{won(run.money)}</b></p>
		{shop.items.filter(([, need]) => has(run, need)).map(([id]) => <ItemRow id={id} sub={`${ITEMS[id].desc}${run.bag[id] ? ` (가진 수 ${run.bag[id]})` : ''}`}
			right={<button class="btn small" disabled={run.money < ITEMS[id].price} onClick={() => buy(id)}>{won(ITEMS[id].price)}</button>} />)}
		{sells.length > 0 && <h3 class="sec">팔기</h3>}
		{sells.map(id => <ItemRow id={id} sub={`가진 수 ${run.bag[id]}`} right={<button class="btn small yellow" onClick={() => { run.money += ITEMS[id].sell!; give(run, id, -1); persist(run); sfx('select'); tick(x => x + 1); }}>{won(ITEMS[id].sell!)}에 팔기</button>} />)}
		<button class="btn big" onClick={done}>나가기</button>
	</Screen>;
}
const CHAPTERS = ['만남 — 블루 체육관의 말괄량이 인어', '♥1 골든볼브리지의 태그 승부', '♥2 블루시티 도둑 사건', '♥3 블루곶의 노을', '♥4 진심 승부'];
function RouteScreen({ run, done }: { run: Run; done: () => void }) {
	const met = has(run, 'met'), stage = !has(run, 'badge2') ? 0 : run.ev + 1;
	return <Screen title="인물 루트 · 관동 편" onBack={done} cls="sc-scr"><Back />
		<div class={'sc-route' + (met ? '' : ' unk')}>
			<span class="sc-route-face"><Portrait id="misty" sprite="misty" cls="face" /></span>
			<div class="sc-route-body"><b>{met ? '이슬' : '？？？'} <small>{met ? '블루 체육관 관장 · 말괄량이 인어' : '블루시티에서 만날 수 있다'}</small></b>
				{met && <><Hearts v={run.heart} big /><small>호감도 {run.heart} / {heartCap(run)}{run.heart >= heartCap(run) && run.ev < 4 ? ' (다음 이야기를 보면 더 오름)' : ''}</small>
					<small>{run.tag ? '지금 태그 중 — 함께 다니고 있어요' : `지금(${TIMES[run.time]}): ${locOf(mistyLoc(run)).name} — ${MISTY_DOING[run.time]}`}</small></>}</div>
		</div>
		{met && <div class="sc-chapters">{CHAPTERS.map((c, i) => <div class={i < stage ? 'done' : i === stage ? 'now' : 'lock'}><i>{i < stage ? '✓' : i === stage ? '▶' : '🔒'}</i>{i <= stage ? c : '？？？'}</div>)}
			{run.ev >= 4 && <div class="done clear"><i>★</i>이슬 루트 클리어!</div>}</div>}
		{met && <p class="muted small">호감도: 함께 이긴 태그 배틀 +10 · 하루 한 번 이야기 · 선물(취향에 따라). 하트가 가득 차면 이슬에게 말을 걸어 다음 이야기를 열 수 있어요.</p>}
		{['웅', '그린', '블루'].map(n => <div class="sc-route unk"><span class="sc-route-face" /><div class="sc-route-body"><b>{n} <small>준비 중</small></b></div></div>)}
		<button class="btn big" onClick={done}>돌아가기</button>
	</Screen>;
}
/** 처음 포켓몬 고르기: 연구소 탁자 위 몬스터볼 셋. 볼을 누르면 안의 포켓몬이 나와 보이고, 마음을 정하면 아래 단추로 확정 */
function StarterPick({ done }: { done: (i: number) => void }) {
	const [sel, setSel] = useState(-1);
	const sp = sel >= 0 ? STARTERS[sel][0] : '';
	return <div class="sc-starter">
		<div class="sc-bg fld-lab" /><div class="sc-starter-shade" />
		<div class="sc-starter-head"><small>오박사 연구소</small><b>함께 여행할 포켓몬을 한 마리 고르자</b></div>
		<div class="sc-starter-table">{STARTERS.map(([id], i) => <button class={'sc-starter-ball' + (sel === i ? ' on' : sel >= 0 ? ' off' : '')} onClick={() => { sfx('ballOpen'); cry(id); setSel(i); }}>
			<span class="sc-starter-mon" key={sel === i ? 'on' : 'off'}><Sprite species={id} gen={9} size={192} anim={false} /></span>
			<i class="sc-ball" /><b>{speciesKo(id)}</b>
		</button>)}</div>
		<div class="sc-starter-info">{sel < 0 ? <p class="sc-starter-hint">몬스터볼을 눌러 안을 들여다보자 ▼</p> : <>
			<p><b>{speciesKo(sp)}</b> <small>Lv5</small> <span class="sc-types">{((speciesData(sp, 9) as any)?.t || []).map((t: string) => <TypeBadge type={t} />)}</span></p>
			<p class="sc-starter-note">{STARTERS[sel][1]}</p>
			<button class="btn big primary" onClick={() => { sfx('select'); done(sel); }}>{josa(speciesKo(sp), '과', '와')} 함께 간다!</button>
		</>}</div>
	</div>;
}
/** 볼 던지기 연출 (그 자리 풍경 위에서): 볼이 날아감 → 포켓몬이 빛이 되어 빨려 들어감 → 떨어져 세 번 흔들림 → 딸깍·별(성공) / 튀어나옴(실패) */
function Catch({ sp, ok, bg, tint, done }: { sp: string; ok: boolean; bg: string; tint: number; done: () => void }) {
	const [st, setSt] = useState(0);   // 0 던짐 · 1 빨려 듦 · 2 흔들림 · 3 결과
	useEffect(() => {
		sfx('ballThrow');
		const ts = [setTimeout(() => { setSt(1); sfx('ballOpen'); }, 620), setTimeout(() => setSt(2), 1150),
			...[1750, 2450, 3150].map(t => setTimeout(() => sfx('select'), t)),
			setTimeout(() => { setSt(3); if (ok) sfx('heal'); else { sfx('ballOpen'); cry(sp); } }, 3850)];
		return () => ts.forEach(clearTimeout);
	}, []);
	return <div class={'story-talk sc-talk narr wild sc-catch2 st' + st + (ok ? ' ok' : ' no')} onClick={() => st === 3 && done()}>
		<div class={'st-bg sc-bg fld-' + bg} /><div class={'sc-tint ' + TIME_CLS[tint]} />
		<div class="sc-wildmon"><i class="sc-wildgrass" /><Sprite species={sp} gen={9} size={192} anim={false} /></div>
		<i class="sc-cball" />{st === 3 && ok && <span class="sc-cstars"><i /><i /><i /></span>}
		<div class="st-box"><div class="st-text">{st < 3 ? '…' : ok ? `신난다! ${josa(speciesKo(sp), '을', '를')} 잡았다!` : `앗! ${josa(speciesKo(sp), '이', '가')} 볼에서 나와 달아났다…`}{st === 3 && <span class="st-arrow">▼</span>}</div></div>
	</div>;
}
function Credits({ run, done }: { run: Run; done: () => void }) {
	useEffect(() => { playMusic('g3sunset'); const t = setTimeout(done, 21000); return () => clearTimeout(t); }, []);
	return <div class="sc-credits" onClick={done}><div class="sc-bg fld-cape" /><div class="sc-tint evening" />
		<div class="sc-roll">
			<h1>관동 편</h1><h2>이슬 루트</h2><p>— 물빛 신비의 색 —</p>
			<h3>함께한 날</h3><p>{run.day}일</p>
			<h3>함께한 포켓몬</h3><p class="sc-roll-mons">{run.party.map(m => <PokeIcon species={m.sp} />)}</p>
			<h3>배지</h3><p>{run.badges.join(' · ')}</p>
			<h3>나온 사람들</h3><p>이슬 · 오박사 · 그린 · 웅 · 이수재</p><p>블루시티와 관동의 트레이너들</p>
			<h3>바탕</h3><p>포켓몬스터 레드·그린 / 하트골드·소울실버의 관동</p><p>유희왕 태그 포스의 파트너 시스템</p>
			<h2 class="sc-fin">이슬 루트 · 클리어</h2><p>여행은 계속된다</p>
		</div>
	</div>;
}
function SeriesSelect({ saved, done }: { saved: Run | null; done: (a: 'go' | 'new' | null) => void }) {
	return <Screen title="시나리오" onBack={() => done(null)} cls="sc-scr sc-series">
		<p class="hint">지방을 고르면 그 지방을 자유롭게 돌아다니며, 만나는 인물과 태그를 맺고 그 인물의 이야기를 따라갑니다.</p>
		<div class="sc-series-card on">
			<div class="sc-bg fld-cerulean" />
			<div class="sc-series-body"><small>SERIES 1</small><b>관동 편</b><span>레드·그린의 무대 — 태초마을에서 블루곶까지</span>
				<span class="sc-series-ch"><span class="sc-route-face"><Portrait id="misty" sprite="misty" cls="face" /></span>이슬 루트{saved?.flags.ev4 ? ' ★클리어' : ''}</span>
				{saved?.flags.intro ? <small class="sc-series-save">{saved.day}일째 · {locOf(saved.loc).name} · 배지 {saved.badges.length}개</small> : null}
				<div class="sc-series-btns">{saved?.flags.intro ? <><button class="btn primary" onClick={() => done('go')}>이어서 하기</button><button class="btn ghost" onClick={() => done('new')}>처음부터</button></> : <button class="btn primary" onClick={() => done('new')}>시작하기</button>}</div>
			</div>
		</div>
		{[['성도 편', '금·은'], ['호연 편', '루비·사파이어'], ['신오 편', '다이아몬드·펄']].map(([n, g], i) => <div class="sc-series-card lock"><div class="sc-series-body"><small>SERIES {i + 2}</small><b>{n}</b><span>{g}의 무대 · 준비 중</span></div></div>)}
	</Screen>;
}

// ───────── 이야기 (대사는 scenario-script.ts) ─────────
async function prologue(run: Run, E: Eng) {
	await play(run, E, 'pro1');
	const i = await ask<number>(r => <StarterPick key={K()} done={r} />);
	run.starter = STARTERS[i][0]; run.party = [{ sp: run.starter, lv: 5, exp: 0 }]; run.loc = 'pallet'; persist(run);
	await play(run, E, 'pro2');
	const rv = RIVAL_OF[run.starter];
	const win = await E.fight({ name: '그린', title: '라이벌', sprite: 'blue', team: [{ sp: rv, lv: 5, exp: 0, mlv: 1 }], skill: 0.2, arena: 'field', music: 'battle' });
	if (win) await E.reward([{ sp: rv, lv: 5, exp: 0 }], '그린에게 이겼다!', 0);
	await play(run, E, win ? 'proWin' : 'proLose');
	await play(run, E, 'pro3');
	await E.fx('iris', 700, 'lab');
}
const mistyMeet = (run: Run, E: Eng) => play(run, E, 'meet');
const mistyGym = (run: Run, E: Eng) => play(run, E, 'gym');
/** 이슬에게 말 걸기: 이야기 · 선물 · 태그 · (하트가 차면) 초대 */
async function mistyMenu(run: Run, E: Eng) {
	if (!has(run, 'badge2')) { await E.say([['misty', has(run, 'c2') ? '풀장 끝에서 기다릴게. 어서 와!' : '체육관 도전은 제자들부터! 물빛 지붕 건물이야.']]); return; }
	if (evReady(run) && !run.flags['inv' + (run.ev + 1)]) { await invite(run, E); return; }
	const gifts = Object.keys(run.bag).filter(id => ITEMS[id]?.kind === 'gift');
	const opts = [run.talked === run.day ? '이야기하기 (오늘은 이미 했다)' : '이야기하기', `선물하기${gifts.length ? '' : ' (선물 없음)'}`, run.tag ? '태그를 푼다' : '태그를 신청한다', '그만두기'];
	const hello = run.ev >= 4 ? '왔구나! 오늘은 어디로 갈까?' : run.heart >= 300 ? '아, 너구나. …기다린 건 아니거든?' : run.heart >= 200 ? '어서 와! 오늘은 뭐 할 거야?' : run.heart >= 100 ? '또 왔네? 뭐, 반갑긴 해.' : '도전자… 아니, 너였구나. 무슨 일이야?';
	const c = await E.choose('misty', hello, opts);
	if (c === 0) {
		if (run.talked === run.day) { await E.say([['misty', '아까 실컷 떠들었잖아. 내일 또 얘기하자!']]); return; }
		const [q, ans] = MISTY_TALKS[(run.day + run.ev) % MISTY_TALKS.length];
		const a = await E.choose('misty', q, ans.map(x => x[0]));
		run.talked = run.day; persist(run);
		await E.say([['misty', ans[a][2], ans[a][1] >= 8 ? 'shy' : ans[a][1] >= 5 ? 'joy' : ans[a][1] <= 1 ? 'angry' : undefined]]);
		await E.heart(ans[a][1]);
	} else if (c === 1) {
		if (!gifts.length) { await E.say([['misty', '선물? 빈손이잖아! …기대하게 만들지 마.']]); return; }
		const g = await E.choose('misty', '어? 나한테 줄 게 있어?', [...gifts.map(id => `${ITEMS[id].name} ×${run.bag[id]}`), '그만두기']);
		if (g >= gifts.length) return;
		const id = gifts[g], like = ITEMS[id].misty!; give(run, id, -1); persist(run);
		await E.say([['misty', like === 2 ? `${ITEMS[id].name}?! 이거 갖고 싶었는데… 고, 고마워. 소중히 할게!` : like === 1 ? `${ITEMS[id].name}구나. 고마워, 잘 받을게.` : `꺄악! 버, 벌레?! 이런 걸 왜 주는 거야! 당장 치워!!`, like === 2 ? 'love' : like === 1 ? 'joy' : 'angry']]);
		await E.heart(like === 2 ? 25 : like === 1 ? 10 : -15);
	} else if (c === 2) {
		run.tag = !run.tag; persist(run);
		await E.say([['misty', run.tag ? '태그? 좋아, 오늘은 네 파트너가 되어 줄게. 내 물 포켓몬들 실력, 옆에서 똑똑히 봐 둬!' : '벌써 끝이야? 뭐, 나도 체육관 일이 있으니까. …또 불러.', run.tag ? 'joy' : 'sad']]);
		if (run.tag) toast('이슬과 태그를 맺었다 — 길거리 트레이너와의 배틀이 멀티배틀이 돼요');
	}
}
/** 하트가 가득 찼을 때: 다음 이야기로의 초대 */
async function invite(run: Run, E: Eng) {
	await play(run, E, 'inv' + (run.ev + 1));
	run.tag = false; persist(run);
}
/** 하트 이벤트 (지면 다음에 처음부터 다시) */
async function mistyEvent(run: Run, E: Eng) {
	const k = run.ev + 1;
	if (!(await play(run, E, 'ev' + k))) { await E.tick(); return; }
	run.ev = k; run.flags['ev' + k] = 1; if (k === 4) run.tag = true; persist(run);
	if (k < 4) { await E.card(EV_TITLE[k - 1], '하트 이벤트 클리어', `♥ ${k} / 4`, E.L().bg, 2200); return; }
	await E.fx('fade', 900);
	await ask<void>(r => <Credits key={K()} run={run} done={r} />);
	await E.card('이슬 루트 · 클리어', '이슬과 언제든 태그를 맺을 수 있어요', 'CONGRATULATIONS', 'cape', 3200);
}

// ───────── 진행 ─────────
export async function runScenario() {
	let saved = load<Run | null>(KEY, null);
	if (saved && saved.v !== 2) saved = null;
	const pick = await ask<'go' | 'new' | null>(r => <SeriesSelect saved={saved} done={r} />);
	if (!pick) return;
	if (pick === 'new' && saved?.flags.intro && !(await confirmBox('처음부터', '지금까지의 진행(포켓몬·배지·호감도)을 모두 지우고 처음부터 할까요?', '지우기'))) return runScenario();
	const run: Run = pick === 'go' && saved ? { ...newRun(), ...saved } : newRun();
	if (pick === 'new') remove(KEY);
	const E = engine(run);
	if (!run.flags.intro) await prologue(run, E);
	let banner = true;
	while (true) {
		const a = await ask<Act>(r => <Hub run={run} banner={banner} done={r} />);
		banner = false;
		if (a === BACK) { persist(run); return; }
		const loc = locOf(run.loc);
		if (a.k === 'party') { await ask<void>(r => <PartyScreen run={run} done={r} />); continue; }
		if (a.k === 'bag') { await ask<void>(r => <BagScreen run={run} done={r} />); continue; }
		if (a.k === 'route') { await ask<void>(r => <RouteScreen run={run} done={r} />); continue; }
		if (a.k === 'map') {
			const to = await ask<string | null>(r => <WorldMap run={run} done={r} />);
			if (!to) continue;
			await ask<void>(r => <Travel key={K()} run={run} to={to} done={r} />);
			run.loc = to; if (locOf(to).rest) run.town = to;
			await E.tick();
			banner = true;
			if (to === 'cerulean' && !has(run, 'met')) await mistyMeet(run, E);
			continue;
		}
		const n = a as Node;
		if (n.k === 'shop') { await E.say([['clerk', '어서 오세요! 무엇을 찾으세요?']]); await ask<void>(r => <ShopScreen run={run} done={r} />); continue; }
		if (n.k === 'rest') {
			const home = run.loc === 'pallet';
			const c = await E.choose(home ? { name: '엄마', portrait: '', sprite: '' } : 'joy', home ? '어머, 왔니? 얼굴이 피곤해 보이는구나. 한숨 자고 가렴.' : '포켓몬센터입니다. 내일 아침까지 쉬었다 가시겠어요?', ['쉰다 (다음 날 아침으로)', '그만두기']);
			if (c === 0) { await E.fx('fade', 800); await E.tick(true); banner = true; }
			continue;
		}
		if (n.k === 'oak') {
			const kinds = new Set([...run.party, ...run.box].map(m => m.sp)).size;
			await E.say([['oak', `오오, ${playerName()}! 도감은 잘 채우고 있니?`], ['oak', `지금까지 함께한 포켓몬은 ${kinds}종류구나. ${kinds >= 10 ? '훌륭하구나! 그 기세란다.' : kinds >= 5 ? '순조롭구나. 풀숲을 더 뒤져 보렴.' : '풀숲에 들어가면 새 친구를 만날 수 있단다.'}`],
				['oak', has(run, 'met') ? '블루시티의 이슬과 친해졌다지? 그 아이는 시간마다 있는 곳이 다르단다. 「루트」 화면을 보렴.' : '달맞이산 너머 블루시티에는 이슬이라는 관장이 있단다. 물 포켓몬의 달인이지.']], 'lab');
			continue;
		}
		if (n.k === 'karp') {
			const c = await E.choose('salesman', '어이, 거기 학생! 비밀인데 말이지… 이 귀한 잉어킹을 단돈 500원에 주지. 어때?', ['산다 (500원)', '안 산다']);
			if (c !== 0) { await E.say([['salesman', '쳇, 나중에 후회하지나 말라고.']]); continue; }
			if (run.money < 500) { await E.say([['salesman', '돈이 없잖아! 장난치지 말라고.']]); continue; }
			run.money -= 500; run.flags.karp = 1; (run.party.length < 6 ? run.party : run.box).push({ sp: 'magikarp', lv: 5, exp: 0 }); persist(run);
			await E.say([['salesman', '좋은 거래였어! 아, 환불은 안 돼!'], [null, '잉어킹을 손에 넣었다! (튀어오르기밖에 못 하지만, Lv20까지 키우면…)']]);
			continue;
		}
		if (n.k === 'bike') { await E.say([[{ name: '자전거 가게 주인', portrait: '', sprite: 'cyclist' }, '어서 와요! 최신형 자전거가 단돈 1,000,000원!'], [null, `…가진 돈은 ${won(run.money)}. 도저히 살 수 없다.`]]); continue; }
		if (n.k === 'script') { if (await play(run, E, n.data)) { run.flags[n.data] = 1; persist(run); } else await E.tick(); continue; }
		if (n.k === 'folk') {
			const f = n.data as typeof FOLKS[number], first = f.gift && !has(run, 'folk-' + f.loc);
			await E.say((first ? f.first! : [f.lines[(run.day + run.time) % f.lines.length]]).map(t => [f.who, fill(run, t)] as Line));
			if (first) { run.flags['folk-' + f.loc] = 1; await E.got(f.gift!, f.n || 1); }
			continue;
		}
		if (n.k === 'gym') { await mistyGym(run, E); continue; }
		if (n.k === 'misty') { await mistyMenu(run, E); continue; }
		if (n.k === 'event') { await mistyEvent(run, E); banner = true; continue; }
		if (n.k === 'brock') { if (!(await play(run, E, 'brock'))) await E.tick(); continue; }
		if (n.k === 'wild') {
			const w = WILDS.find(x => x.loc === run.loc)!, pool = run.time === 3 && w.night ? w.night : w.pool;
			const [sp, lo, hi] = pool[Math.floor(Math.random() * pool.length)], foe: Mon = { sp, lv: lo + Math.floor(Math.random() * (hi - lo + 1)), exp: 0 };
			await E.say([[null, '바스락…!']]);
			await E.say([[null, `야생 ${josa(speciesKo(sp), '이', '가')} 튀어나왔다! (Lv${foe.lv})`]], undefined, sp);
			if (!(await E.fight({ name: `야생 ${speciesKo(sp)}`, sprite: '', team: [foe], skill: 0.1, music: 'battle' }))) { await E.blackout(); banner = true; continue; }
			await E.reward([foe], `야생 ${josa(speciesKo(sp), '을', '를')} 쓰러뜨렸다!`, 0, true);
			const balls = Object.keys(run.bag).filter(id => ITEMS[id]?.kind === 'ball');
			if (!balls.length) { toast('볼이 없어서 잡을 수 없었다 — 프렌들리숍에서 살 수 있어요'); continue; }
			const c = await E.choose(null, `${josa(speciesKo(sp), '은', '는')} 지쳐서 움직이지 못한다.\n볼을 던질까?`, [...balls.map(id => `${ITEMS[id].name} ×${run.bag[id]} (${Math.round(ITEMS[id].rate! * 100)}%)`), '그냥 보내 준다'], undefined, sp);
			if (c >= balls.length) continue;
			give(run, balls[c], -1);
			const ok = Math.random() < ITEMS[balls[c]].rate!;
			if (ok) (run.party.length < 6 ? run.party : run.box).push(foe);
			persist(run);
			await ask<void>(r => <Catch key={K()} sp={sp} ok={ok} bg={E.L().bg} tint={run.time} done={r} />);
			if (ok && !run.party.includes(foe)) toast(`파티가 가득 차서 ${josa(speciesKo(sp), '을', '를')} 박스로 보냈다`);
			continue;
		}
		if (n.k === 'trainer') {
			const t = n.data as Trainer, who = tWho(t);
			if (n.done) { await E.say([[who, t.again]]); continue; }
			await E.say([[who, t.before]]);
			// 태그 중이면 그 자리의 다른 트레이너와 한 팀이 되어 멀티배틀
			const mate = run.tag ? TRAINERS.find(x => x !== t && x.loc === t.loc && !x.once && has(run, x.need) && (!x.at || x.at.includes(run.time)) && run.beaten[x.id] !== run.day) : undefined;
			const tag = run.tag && !t.once;
			if (tag && mate) await E.say([[tWho(mate), '태그라고? 그럼 나도 끼워 줘! 2대2다!'], ['misty', '좋아, 한꺼번에 덤벼! 가자, 파트너!']]);
			else if (tag) await E.say([['misty', '내 차례도 있는 거지? 아쿠스타, 준비!']]);
			const team = mk(mate && tag ? (() => { const o: [string, number][] = []; for (let i = 0; i < 3; i++) { if (t.team[i]) o.push(t.team[i]); if (mate.team[i]) o.push(mate.team[i]); } return o; })() : t.team);
			const win = await E.fight({ name: mate && tag ? `${t.name} & ${mate.name}` : t.name, title: t.title, sprite: t.sprite, sprite2: mate && tag ? mate.sprite : undefined, team, skill: t.skill, arena: t.arena, music: t.music || 'battle', tag, line: t.before });
			if (!win) { await E.blackout(); banner = true; continue; }
			if (t.once) run.flags[t.id] = 1; run.beaten[t.id] = run.day; if (mate && tag) run.beaten[mate.id] = run.day;
			await E.reward(team, `${mate && tag ? `${t.name} 팀` : t.name}에게 이겼다!`, Math.max(...team.map(m => m.lv)) * (mate && tag ? 60 : 30) * (t.title ? 2 : 1));
			await E.say([[who, t.after]]);
			if (tag) { await E.say([['misty', ['나이스! 방금 연계, 완벽했어!', '후훗, 우리 꽤 잘 맞는데?', '봤지? 내 아쿠스타의 스피드!', '좋아, 이 기세로 다음도 가자!'][Math.floor(Math.random() * 4)], 'joy']]); await E.heart(10); }
			continue;
		}
		void loc;
	}
}
void Fragment;
