/**
 * 효과음·배경음악 — WebAudio 로 직접 합성하는 칩튠 (외부 음원 파일 없음, 모두 이 앱용으로 새로 만든 소리)
 */
import { RAW } from './data';
import { partBase } from './offline';
import { loadSettings } from './store';
import CHIP_RAW from './gen/chip-tracks.json';
import CHIP_GEN3 from './gen/chip-gen3.json';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
/** 기술 효과음 전용 버스 (sfxBus 아래) — 설정 '기술 효과음' */
let moveBus: GainNode | null = null;
let defBus: GainNode | null = null;
export const MOVE_SFX_GAIN = [0, 0.35, 0.6, 1];
function withMoveBus(fn: () => void) { defBus = moveBus; try { fn(); } finally { defBus = null; } }
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function ac(): AudioContext | null {
	if (ctx) return ctx;
	const C = (window as any).AudioContext || (window as any).webkitAudioContext;
	if (!C) return null;
	ctx = new C();
	master = ctx!.createGain(); master.gain.value = 0.6; master.connect(ctx!.destination);
	sfxBus = ctx!.createGain(); sfxBus.gain.value = [0.3, 0.55, 0.85][(loadSettings().sfxVolume || 1) - 1]; sfxBus.connect(master);
	moveBus = ctx!.createGain(); moveBus.gain.value = MOVE_SFX_GAIN[loadSettings().moveSfx ?? 1]; moveBus.connect(sfxBus);
	musicBus = ctx!.createGain(); musicBus.gain.value = [0.1, 0.22, 0.38][(loadSettings().musicVolume || 2) - 1]; musicBus.connect(master);
	noiseBuf = ctx!.createBuffer(1, ctx!.sampleRate, ctx!.sampleRate);
	const d = noiseBuf.getChannelData(0);
	for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
	return ctx;
}

/** 첫 터치 때 호출 (브라우저 자동재생 제한) */
export function unlockAudio() {
	const c = ac();
	if (c && c.state === 'suspended' && !hidden) c.resume();
}

// ── 앱이 뒤로 가면 소리 전부 멈춤 (안드로이드 홈 버튼·화면 끄기) ──
let hidden = false;
function setHidden(h: boolean) {
	hidden = h;
	const c = ctx;
	if (!c) return;
	// Web Audio 로 재생하는 배경음악도 컨텍스트를 멈추면 같이 멈춤
	if (h) { c.suspend(); bgmEl?.pause(); } else { c.resume(); if (bgmEl && current) bgmEl.play().catch(() => {}); }
}
if (typeof document !== 'undefined') {
	document.addEventListener('visibilitychange', () => setHidden(document.hidden));
	window.addEventListener('pagehide', () => setHidden(true));
	window.addEventListener('pageshow', () => setHidden(document.hidden));
	(window as any).onAndroidPause = () => setHidden(true);
	(window as any).onAndroidResume = () => setHidden(document.hidden);
}

const sfxOn = () => loadSettings().sound !== false;
const musicOn = () => loadSettings().music !== false;

// ── 울음소리 (포켓몬 그림과 같은 서버에서 실행 중에 받아 옴, <audio> 요소로 재생·보관) ──
const cryEls: { [id: string]: HTMLAudioElement } = {};
const cryBad: { [id: string]: boolean } = {};
declare const __LOCAL_CRIES__: string;
/** 앱 안에 들어 있는 울음소리 (오프라인에서도 재생) */
const LOCAL_CRIES = new Set((typeof __LOCAL_CRIES__ === 'string' ? __LOCAL_CRIES__ : '').split(',').filter(Boolean));
const CRY_URL = (id: string) => (partBase('cries') && LOCAL_CRIES.has(id)) ? `${partBase('cries')}${id}.mp3` : `https://play.pokemonshowdown.com/audio/cries/${id}.mp3`;
function cryIds(speciesId: string) {
	const id = speciesId.toLowerCase().replace(/[^a-z0-9]/g, '');
	const out = [id];
	const base = RAW.species[id]?.base;
	if (base) out.push(base);
	const stripped = id.replace(/(mega[xyz]?|gmax|primal|totem|alola|galar|hisui|paldea(combat|blaze|aqua)?|origin|therian|crowned|hero|zen|busted|noice|hangry|gorging|gulping|school|complete|10|resolute|pirouette|terastal|stellar|bloodmoon|eternamax|rapidstrike|wellspring|hearthflame|cornerstone|teal|tera|bond|ash)$/, '');
	if (!out.includes(stripped)) out.push(stripped);
	// 앱 안에 있는 것을 먼저 (없는 폼은 기본 모습 울음소리)
	const local = out.filter(x => LOCAL_CRIES.has(x));
	return (partBase('cries') && LOCAL_CRIES.size) ? (local.length ? [local[0]] : out) : out;
}
function cryEl(id: string): HTMLAudioElement | null {
	if (cryBad[id]) return null;
	if (!cryEls[id]) {
		const el = new Audio(CRY_URL(id));
		el.preload = 'auto';
		el.addEventListener('error', () => { cryBad[id] = true; });
		cryEls[id] = el;
	}
	return cryEls[id];
}
let cryQueue: Promise<void> = Promise.resolve();
export function cry(speciesId: string, opts: { faint?: boolean; delay?: number } = {}) {
	if (!sfxOn() || hidden) return;
	const vol = 0.32 * ([0.5, 1, 1.4][(loadSettings().sfxVolume || 1) - 1]);
	const play = () => new Promise<void>(done => {
		let started = false;
		for (const id of cryIds(speciesId)) {
			const el = cryEl(id);
			if (!el) continue;
			const inst = el.cloneNode() as HTMLAudioElement;
			inst.volume = Math.min(1, vol);
			(inst as any).preservesPitch = false; (inst as any).mozPreservesPitch = false;
			inst.playbackRate = 1;
			let finished = false;
			const finish = () => { if (!finished) { finished = true; done(); } };
			inst.addEventListener('error', () => { cryBad[id] = true; finish(); });
			inst.addEventListener('ended', finish);
			const go = () => { const p = inst.play(); if (p) p.catch(finish); };
			if (inst.readyState >= 3) go(); else { inst.addEventListener('canplay', go, { once: true }); inst.load(); }
			if (opts.faint) {
				let rate = 1;
				const iv = setInterval(() => { rate -= 0.07; if (rate <= 0.4 || inst.ended) { clearInterval(iv); inst.pause(); finish(); return; } inst.playbackRate = rate; inst.volume = Math.max(0.03, inst.volume - 0.04); }, 60);
			}
			setTimeout(finish, 1800); // 안전장치
			started = true;
			break;
		}
		if (!started) done();
	});
	// 두 마리가 동시에 나올 때 소리가 겹쳐 하나만 들리는 문제 → 순서대로 재생
	cryQueue = cryQueue.then(() => new Promise(r => setTimeout(r, opts.delay || 0))).then(play).catch(() => {});
}
/** 미리 받아 두기 (배틀 시작 때 양쪽 팀) */
export function preloadCries(ids: string[]) {
	for (const sid of ids) for (const id of cryIds(sid)) cryEl(id)?.load();
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; slide?: number; at?: number; bus?: GainNode | null; vib?: number } = {}) {
	const c = ac(); if (!c) return;
	const t = c.currentTime + (opts.at || 0);
	const o = c.createOscillator();
	const g = c.createGain();
	o.type = opts.type || 'square';
	o.frequency.setValueAtTime(freq, t);
	if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t + dur);
	if (opts.vib) {
		const lfo = c.createOscillator(); const lg = c.createGain();
		lfo.frequency.value = opts.vib; lg.gain.value = freq * 0.05;
		lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur);
	}
	const v = opts.vol ?? 0.3;
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(v, t + 0.008);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	o.connect(g); g.connect(opts.bus === undefined ? (defBus || sfxBus!) : opts.bus!);
	o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur: number, opts: { freq?: number; q?: number; vol?: number; at?: number; type?: BiquadFilterType; sweep?: number; bus?: GainNode | null } = {}) {
	const c = ac(); if (!c || !noiseBuf) return;
	const t = c.currentTime + (opts.at || 0);
	const src = c.createBufferSource(); src.buffer = noiseBuf;
	const f = c.createBiquadFilter(); f.type = opts.type || 'lowpass';
	f.frequency.setValueAtTime(opts.freq || 2000, t);
	if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, t + dur);
	f.Q.value = opts.q || 1;
	const g = c.createGain();
	const v = opts.vol ?? 0.3;
	g.gain.setValueAtTime(v, t);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	src.connect(f); f.connect(g); g.connect(opts.bus === undefined ? (defBus || sfxBus!) : opts.bus!);
	src.start(t); src.stop(t + dur + 0.02);
}

const N = (n: number) => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz

/** 효과음 */
export function sfx(name: string, type = 'Normal') {
	if (!sfxOn() || !ac()) return;
	if (/^hit|^move$|^crit$|^miss$/.test(name)) { withMoveBus(() => sfxRaw(name, type)); return; }
	sfxRaw(name, type);
}
function sfxRaw(name: string, type: string) {
	switch (name) {
	case 'select': tone(N(84), 0.05, { vol: 0.15 }); tone(N(91), 0.06, { vol: 0.15, at: 0.045 }); break;
	case 'back': tone(N(79), 0.06, { vol: 0.15 }); tone(N(72), 0.07, { vol: 0.13, at: 0.05 }); break;
	case 'ball': tone(300, 0.18, { type: 'square', slide: 1400, vol: 0.12 }); noise(0.12, { freq: 4000, vol: 0.18, at: 0.17 }); tone(N(88), 0.08, { at: 0.2, vol: 0.12 }); break;
	case 'hit': noise(0.16, { freq: 1800, sweep: 250, vol: 0.5 }); tone(170, 0.14, { type: 'square', slide: 50, vol: 0.3 }); tone(90, 0.1, { type: 'sine', slide: 40, vol: 0.4 }); break;
	case 'hitSuper': noise(0.26, { freq: 3500, sweep: 180, vol: 0.6 }); tone(240, 0.22, { type: 'square', slide: 40, vol: 0.35 }); tone(80, 0.18, { type: 'sine', slide: 30, vol: 0.5 }); noise(0.12, { freq: 6000, vol: 0.3, at: 0.1 }); break;
	case 'hitWeak': noise(0.1, { freq: 700, sweep: 200, vol: 0.3 }); tone(120, 0.08, { type: 'sine', slide: 60, vol: 0.2 }); break;
	case 'hitPunch': noise(0.08, { freq: 900, sweep: 300, vol: 0.5 }); tone(140, 0.1, { type: 'sine', slide: 50, vol: 0.5 }); break;
	case 'hitSlash': noise(0.14, { type: 'bandpass', freq: 2400, sweep: 5000, q: 2, vol: 0.4 }); noise(0.06, { freq: 1200, vol: 0.3, at: 0.1 }); break;
	case 'hitExplode': noise(0.6, { freq: 1200, sweep: 80, vol: 0.7 }); tone(60, 0.5, { type: 'sine', slide: 25, vol: 0.6 }); break;
	case 'shiny': [0, 4, 7, 12, 16, 19, 24].forEach((d, i) => tone(N(84 + d), 0.06, { type: 'square', vol: 0.06, at: i * 0.045 })); [0, 0.32].forEach(t => noise(0.12, { type: 'highpass', freq: 6000, vol: 0.08, at: t + 0.1 })); break;
	case 'ballOpen': tone(N(84), 0.05, { vol: 0.12 }); noise(0.18, { type: 'highpass', freq: 2500, vol: 0.22, at: 0.05 }); [0, 7, 12].forEach((d, i) => tone(N(88 + d), 0.08, { type: 'triangle', vol: 0.12, at: 0.1 + i * 0.04 })); break;
	case 'ballThrow': tone(400, 0.25, { type: 'sine', slide: 900, vol: 0.1 }); break;
	case 'crit': tone(N(96), 0.06, { vol: 0.18 }); tone(N(100), 0.08, { vol: 0.16, at: 0.05 }); break;
	case 'miss': noise(0.25, { type: 'bandpass', freq: 600, sweep: 3000, q: 4, vol: 0.25 }); break;
	case 'faint': tone(700, 0.7, { type: 'square', slide: 60, vol: 0.18 }); noise(0.5, { freq: 800, sweep: 100, vol: 0.12, at: 0.2 }); break;
	case 'statUp': [0, 4, 7, 12, 16].forEach((d, i) => tone(N(72 + d), 0.09, { type: 'triangle', vol: 0.22, at: i * 0.055 })); break;
	case 'statDown': [16, 12, 7, 4, 0].forEach((d, i) => tone(N(64 + d), 0.09, { type: 'triangle', vol: 0.22, at: i * 0.055 })); break;
	case 'heal': [0, 7, 12, 19, 24].forEach((d, i) => tone(N(76 + d), 0.14, { type: 'sine', vol: 0.18, at: i * 0.06 })); break;
	case 'status': tone(N(60), 0.35, { type: 'square', vol: 0.14, vib: 18 }); tone(N(55), 0.35, { type: 'square', vol: 0.1, vib: 12, at: 0.05 }); break;
	case 'mega': tone(200, 0.9, { type: 'sawtooth', slide: 1600, vol: 0.12 }); [0, 4, 7, 12].forEach((d, i) => tone(N(72 + d), 0.4, { type: 'triangle', vol: 0.15, at: 0.8 + i * 0.03 })); break;
	case 'tera': [0, 7, 12, 16, 19, 24].forEach((d, i) => tone(N(84 + d), 0.25, { type: 'sine', vol: 0.14, at: i * 0.05 })); noise(0.4, { type: 'highpass', freq: 6000, vol: 0.12 }); break;
	case 'zmove': tone(80, 1, { type: 'sawtooth', slide: 900, vol: 0.14 }); noise(0.9, { freq: 400, sweep: 5000, vol: 0.18 }); break;
	case 'dynamax': tone(60, 1.1, { type: 'square', slide: 30, vol: 0.2 }); tone(90, 1.1, { type: 'sawtooth', slide: 45, vol: 0.12 }); noise(1, { freq: 300, vol: 0.2 }); break;
	case 'weather': noise(0.8, { type: 'bandpass', freq: 1200, q: 0.7, vol: 0.15 }); break;
	case 'move': moveSound(type, 'Physical'); break;
	}
}

/** 기술 사용음 (분류·타입별) */
export function moveSound(type: string, category: string) {
	if (!sfxOn() || !ac()) return;
	withMoveBus(() => moveSoundRaw(type, category));
}
function moveSoundRaw(type: string, category: string) {
	if (category === 'Status') {
		[0, 5, 9].forEach((d, i) => tone(N(81 + d), 0.1, { type: 'triangle', vol: 0.14, at: i * 0.06 }));
		return;
	}
	switch (type) {
	case 'Fire': noise(0.45, { freq: 900, sweep: 300, vol: 0.35 }); tone(120, 0.4, { type: 'sawtooth', slide: 70, vol: 0.08 }); break;
	case 'Water': for (let i = 0; i < 5; i++) tone(N(70 + i * 3), 0.07, { type: 'sine', vol: 0.18, at: i * 0.05, slide: N(77 + i * 3) }); break;
	case 'Electric': for (let i = 0; i < 8; i++) tone(N(88 + (i % 3) * 5), 0.03, { vol: 0.12, at: i * 0.035 }); noise(0.3, { type: 'highpass', freq: 3000, vol: 0.12 }); break;
	case 'Grass': noise(0.35, { type: 'bandpass', freq: 2500, q: 3, vol: 0.2 }); break;
	case 'Ice': [24, 19, 28, 24].forEach((d, i) => tone(N(72 + d), 0.08, { type: 'sine', vol: 0.14, at: i * 0.05 })); break;
	case 'Psychic': tone(N(72), 0.5, { type: 'sine', vol: 0.15, vib: 9 }); tone(N(79), 0.5, { type: 'sine', vol: 0.1, vib: 7 }); break;
	case 'Ghost': case 'Dark': tone(N(48), 0.5, { type: 'triangle', vol: 0.2, vib: 5, slide: N(40) }); break;
	case 'Dragon': tone(90, 0.5, { type: 'sawtooth', slide: 300, vol: 0.12 }); noise(0.4, { freq: 600, vol: 0.2 }); break;
	case 'Rock': case 'Ground': noise(0.4, { freq: 300, vol: 0.45 }); tone(70, 0.35, { vol: 0.2, slide: 40 }); break;
	case 'Flying': noise(0.4, { type: 'bandpass', freq: 800, sweep: 2500, q: 2, vol: 0.25 }); break;
	case 'Poison': for (let i = 0; i < 4; i++) tone(N(55 + i * 2), 0.09, { type: 'sine', vol: 0.15, at: i * 0.07, slide: N(50) }); break;
	case 'Steel': tone(N(86), 0.25, { type: 'square', vol: 0.1 }); tone(N(93), 0.2, { type: 'triangle', vol: 0.1, at: 0.02 }); break;
	case 'Fairy': [0, 4, 7, 11, 14].forEach((d, i) => tone(N(86 + d), 0.08, { type: 'sine', vol: 0.12, at: i * 0.04 })); break;
	case 'Fighting': case 'Bug': case 'Normal': default:
		noise(0.1, { type: 'bandpass', freq: 1200, q: 1, vol: 0.25 }); break;
	}
}

// ── 배경음악: 4채널 시퀀서 (이 앱용으로 새로 작곡한 루프) ──
// 트랙 파일이 있으면 그걸 씀: bgm/<이름>.mp3 (battle, boss, title, victory, tower, pwt) — 직접 음악 파일을 넣어 바꿀 수 있음
interface Track { bpm: number; /** 반복할 때 돌아갈 칸 (인트로 길이) */ intro?: number; lead: (number | null)[]; harm?: (number | null)[]; bass: (number | null)[]; arp?: (number | null)[]; drums: string; loop: boolean; leadType?: OscillatorType; swing?: number }
const R = null;
// 간단 표기: 문자열 → 음 배열. "a4 r b4 ..." 식, 각 토큰 = 16분음표, 숫자 접미는 길이(이어짐), '-'는 지속
const NOTE: { [k: string]: number } = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
function seq(str: string): (number | null)[] {
	const out: (number | null)[] = [];
	for (const tok of str.trim().split(/\s+/)) {
		if (tok === 'r' || tok === '-') { out.push(tok === '-' ? -1 : null); continue; }
		const m = /^([a-g])([#b]?)(\d)(?:x(\d+))?$/.exec(tok);
		if (!m) continue;
		const n = 12 * (parseInt(m[3], 10) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
		const len = m[4] ? parseInt(m[4], 10) : 1;
		out.push(n); for (let i = 1; i < len; i++) out.push(-1);
	}
	return out;
}
// 작곡한 곡의 칩튠판 (music/to_chip.py 가 작곡 데이터에서 자동 편곡): 칸마다 ' ' 쉼, '!' 지속, 그 밖 chr(MIDI+14)
const decodeCh = (s: string) => Array.from(s, ch => ch === ' ' ? null : ch === '!' ? -1 : ch.charCodeAt(0) - 14);
const CHIP: { [k: string]: Track } = Object.fromEntries(Object.entries({ ...(CHIP_RAW as { [k: string]: any }), ...(CHIP_GEN3 as { [k: string]: any }) }).map(([k, r]) =>
	[k, { bpm: r.bpm, intro: r.intro, loop: true, leadType: r.leadType, lead: decodeCh(r.lead), harm: decodeCh(r.harm), bass: decodeCh(r.bass), arp: decodeCh(r.arp), drums: r.drums }]));
const chipStyle = () => bgmStyle() === 'chip';
const TRACKS: { [k: string]: Track } = {
	// 일반 배틀: d단조, 빠른 베이스 8분 + 긴장감 있는 반음 진행
	battle: {
		bpm: 160, loop: true, leadType: 'square',
		lead: seq(`d5x2 r f5 d5x2 r a5 g5 f5 e5 f5 g5x2 r r a4x2 r c5 a4x2 r e5 d5 c5 bb4 c5 d5x2 r r
			f5x2 r g5 a5x2 r bb5 a5 g5 f5 e5 d5x2 r r e5x2 r f5 g5x2 r a5 g5 f5 e5 c#5 d5x4 r r r r`),
		harm: seq(`a4x4 r r r r f4x4 r r r r g4x4 r r r r e4x4 r r r r d4x4 r r r r bb4x4 r r r r a4x4 r r r r a4x2 c#5x2 e5x4`),
		bass: seq(`d2 d2 d3 d2 d2 d3 d2 d3 bb1 bb1 bb2 bb1 bb1 bb2 bb1 bb2 c2 c2 c3 c2 c2 c3 c2 c3 a1 a1 a2 a1 a1 a2 a1 a2
			d2 d2 d3 d2 d2 d3 d2 d3 bb1 bb1 bb2 bb1 bb1 bb2 bb1 bb2 g1 g1 g2 g1 g1 g2 g1 g2 a1 a1 a2 a1 c#2 c#2 e2 e2`),
		arp: seq(`d4 f4 a4 d5 d4 f4 a4 d5 bb3 d4 f4 bb4 bb3 d4 f4 bb4 c4 e4 g4 c5 c4 e4 g4 c5 a3 c#4 e4 a4 a3 c#4 e4 a4
			d4 f4 a4 d5 d4 f4 a4 d5 bb3 d4 f4 bb4 bb3 d4 f4 bb4 g3 bb3 d4 g4 g3 bb3 d4 g4 a3 c#4 e4 a4 a3 c#4 e4 g4`),
		drums: 'k.hhs.hhk.hhs.hhk.hhs.hhk.hhs.hhk.hhs.hhk.hhs.hhk.hhs.hhkkhhsshs',
	},
	// 보스(챔피언·타이쿤): e단조, 더 빠르고 옥타브 점프
	boss: {
		bpm: 176, loop: true, leadType: 'sawtooth',
		lead: seq(`e5 r e5 r e6 r e5 d#5 e5 r b4 r g5 r f#5 e5 d5 r d5 r d6 r d5 c#5 d5 r a4 r f#5 r e5 d5
			c5 r c5 r c6 r b5 c6 b5 r g5 r e5 r d5 c5 b4 r b4 r b5 r a5 b5 d#5 r f#5 r b5 r a5 g5
			e5 g5 b5 e6 d#6 b5 g5 e5 c5 e5 g5 c6 b5 g5 e5 c5 a4 c5 e5 a5 g5 e5 c5 a4 b4 r d#5 r f#5 r b5x4`),
		harm: seq(`e4x8 r r r r r r r r d4x8 r r r r r r r r c4x8 r r r r r r r r b3x8 r r r r r r r r e4x8 r r r r r r r r c4x8 r r r r r r r r a3x8 r r r r r r r r b3x8 r r r r r r r r`),
		bass: seq(`e2 e2 e3 e2 e2 e3 e2 e3 d2 d2 d3 d2 d2 d3 d2 d3 c2 c2 c3 c2 c2 c3 c2 c3 b1 b1 b2 b1 b1 b2 b1 b2
			e2 e2 e3 e2 e2 e3 e2 e3 c2 c2 c3 c2 c2 c3 c2 c3 a1 a1 a2 a1 a1 a2 a1 a2 b1 b1 b2 b1 b2 b2 d#2 d#2`),
		arp: seq(`e4 g4 b4 e5 e4 g4 b4 e5 d4 f#4 a4 d5 d4 f#4 a4 d5 c4 e4 g4 c5 c4 e4 g4 c5 b3 d#4 f#4 b4 b3 d#4 f#4 b4
			e4 g4 b4 e5 e4 g4 b4 e5 c4 e4 g4 c5 c4 e4 g4 c5 a3 c4 e4 a4 a3 c4 e4 a4 b3 d#4 f#4 b4 b3 d#4 f#4 a4`),
		drums: 'k.hsk.hsk.hsk.hskkhsk.hsk.hsk.hsk.hsk.hsk.hskkhsk.hsk.hsksssskhsk.hsk.hsk.hskkhsk.hsk.hsk.hsk.hsk.hsk.hskkhsk.hskshsksss',
	},
	// 시설(타워·팩토리): 전자음 느낌, 당김음
	tower: {
		bpm: 150, loop: true, leadType: 'square',
		lead: seq(`a4 r c5 r e5 r r d5 c5 r a4 r r r g4 a4 f4 r a4 r c5 r r d5 c5 r a4 r r r e4 f4
			g4 r b4 r d5 r r e5 d5 r b4 r r r a4 g4 e4 r g#4 r b4 r r c5 b4 r g#4 r e5 r d5 c5`),
		harm: seq(`a3x8 r r r r r r r r f3x8 r r r r r r r r g3x8 r r r r r r r r e3x8 r r r r r r r r`),
		bass: seq(`a1 r a2 a1 r a2 r a1 f1 r f2 f1 r f2 r f1 g1 r g2 g1 r g2 r g1 e1 r e2 e1 r e2 e2 g#1`),
		arp: seq(`a3 c4 e4 a4 e4 c4 a3 c4 f3 a3 c4 f4 c4 a3 f3 a3 g3 b3 d4 g4 d4 b3 g3 b3 e3 g#3 b3 e4 b3 g#3 e3 g#3`),
		drums: 'k.h.s.hhk.h.s.h.k.h.s.hhk.hks.hs',
	},
	// PWT: 축제 느낌, 메이저 → 마이너 전환
	pwt: {
		bpm: 168, loop: true, leadType: 'square',
		lead: seq(`g5 r g5 r a5 r g5 r e5 r r r c5 d5 e5 r f5 r f5 r g5 r f5 r d5 r r r b4 c5 d5 r
			e5 r g5 r c6 r b5 r a5 g5 a5 r g5 r e5 r d5 r e5 r d5 r b4 r g4 r a4 r b4 c5 d5 r
			eb5 r eb5 r f5 r eb5 r c5 r r r ab4 bb4 c5 r db5 r db5 r eb5 r db5 r bb4 r r r g4 ab4 bb4 r
			c5 r eb5 r ab5 r g5 r f5 eb5 f5 r eb5 r c5 r bb4 r c5 r bb4 r g4 r eb4 r g4 r bb4 r d5 r`),
		bass: seq(`c2 c2 c3 c2 e2 e2 e3 e2 f2 f2 f3 f2 g2 g2 g3 g2 c2 c2 c3 c2 e2 e2 e3 e2 f2 f2 f3 f2 g2 g2 b2 b2
			c2 c2 c3 c2 e2 e2 e3 e2 a1 a1 a2 a1 f2 f2 f3 f2 g2 g2 g3 g2 g2 g2 g3 g2 c2 c2 c3 c2 g2 g2 b2 d3
			c2 c2 c3 c2 eb2 eb2 eb3 eb2 ab1 ab1 ab2 ab1 bb1 bb1 bb2 bb1 c2 c2 c3 c2 eb2 eb2 eb3 eb2 ab1 ab1 ab2 ab1 bb1 bb1 bb2 bb1
			c2 c2 c3 c2 eb2 eb2 eb3 eb2 ab1 ab1 ab2 ab1 bb1 bb1 bb2 bb1 c2 c2 c3 c2 eb2 eb2 eb3 eb2 ab1 ab1 ab2 ab1 g1 g1 g2 b1`),
		arp: seq(`c4 e4 g4 c5 e4 g4 c5 e5 f4 a4 c5 f5 g4 b4 d5 g5 c4 e4 g4 c5 e4 g4 c5 e5 f4 a4 c5 f5 g4 b4 d5 g5
			c4 e4 g4 c5 e4 g4 c5 e5 a3 c4 e4 a4 f4 a4 c5 f5 g4 b4 d5 g5 g4 b4 d5 g5 c4 e4 g4 c5 g4 b4 d5 f5
			c4 eb4 g4 c5 eb4 g4 c5 eb5 ab3 c4 eb4 ab4 bb3 d4 f4 bb4 c4 eb4 g4 c5 eb4 g4 c5 eb5 ab3 c4 eb4 ab4 bb3 d4 f4 bb4
			c4 eb4 g4 c5 eb4 g4 c5 eb5 ab3 c4 eb4 ab4 bb3 d4 f4 bb4 c4 eb4 g4 c5 eb4 g4 c5 eb5 ab3 c4 eb4 ab4 g3 b3 d4 g4`),
		drums: 'k.h.s.h.k.h.s.hhk.h.s.h.k.hks.hs',
	},
	title: {
		bpm: 112, loop: true, leadType: 'triangle',
		lead: seq(`c5 r r e5 g5 r f5 r e5 r d5 r c5 r r r d5 r r f5 a5 r g5 r f5 r e5 r d5 r r r
			e5 r r g5 c6 r b5 r a5 r g5 r f5 r e5 r d5 r e5 r f5 r d5 r c5 r r r r r r r`),
		bass: seq(`c3 r g3 r e3 r g3 r f3 r a3 r f3 r a3 r d3 r a3 r f3 r a3 r g3 r b3 r g3 r b3 r
			e3 r g3 r b3 r g3 r a2 r e3 r a3 r e3 r d3 r f3 r a3 r g3 r b3 r c3 r e3 r g3 r`),
		arp: seq(`c4 e4 g4 e4 c4 e4 g4 e4 f4 a4 c5 a4 f4 a4 c5 a4 d4 f4 a4 f4 d4 f4 a4 f4 g4 b4 d5 b4 g4 b4 d5 b4
			e4 g4 b4 g4 e4 g4 b4 g4 a3 c4 e4 c4 a3 c4 e4 c4 d4 f4 a4 f4 d4 f4 a4 f4 g4 b4 d5 b4 c4 e4 g4 c5`),
		drums: 'k.......h.......k.......h.......k.......h.......k.......h.h.h.h.',
	},
	// 배틀 2: g단조 172, 셔플 느낌의 당김음, 상승 베이스
	battle2: {
		bpm: 172, loop: true, leadType: 'square',
		lead: seq(`g5 r bb5 r d6 r c6 bb5 a5 r g5 r f5 r g5 r a5 r a5 r c6 r bb5 a5 g5 r f5 r d5 r r r
			eb5 r g5 r bb5 r a5 g5 f5 r eb5 r d5 r eb5 r d5 r d5 r f#5 r a5 g5 f#5 r d5 r a4 r r r
			g5 r g5 r bb5 r d6 r g6 r f6 r d6 r bb5 r a5 r a5 r c6 r eb6 r d6 r bb5 r g5 r r r
			eb5 r eb5 r g5 r bb5 r eb6 r d6 r bb5 r g5 r d5 r f#5 r a5 r d6 r c6 r a5 r f#5 r d5 r`),
		harm: seq(`d5x8 r r r r r r r r c5x8 r r r r r r r r bb4x8 r r r r r r r r a4x8 r r r r r r r r bb4x8 r r r r r r r r d5x8 r r r r r r r r bb4x8 r r r r r r r r a4x8 r r r r r r r r`),
		bass: seq(`g2 g2 g3 r g2 g3 g2 g3 f2 f2 f3 r f2 f3 f2 f3 eb2 eb2 eb3 r eb2 eb3 eb2 eb3 d2 d2 d3 r d2 d3 d2 d3
			eb2 eb2 eb3 r eb2 eb3 eb2 eb3 c2 c2 c3 r c2 c3 c2 c3 d2 d2 d3 r d2 d3 d2 d3 d2 d2 d3 r f#2 f#2 a2 a2
			g2 g2 g3 r g2 g3 g2 g3 f2 f2 f3 r f2 f3 f2 f3 eb2 eb2 eb3 r eb2 eb3 eb2 eb3 d2 d2 d3 r d2 d3 d2 d3
			eb2 eb2 eb3 r eb2 eb3 eb2 eb3 c2 c2 c3 r c2 c3 c2 c3 d2 d2 d3 r d2 d3 d2 d3 d2 d2 d3 r d2 d3 d2 d3`),
		arp: seq(`g4 bb4 d5 g5 g4 bb4 d5 g5 f4 a4 c5 f5 f4 a4 c5 f5 eb4 g4 bb4 eb5 eb4 g4 bb4 eb5 d4 f#4 a4 d5 d4 f#4 a4 d5
			eb4 g4 bb4 eb5 eb4 g4 bb4 eb5 c4 eb4 g4 c5 c4 eb4 g4 c5 d4 f#4 a4 d5 d4 f#4 a4 d5 d4 f#4 a4 c5 d4 f#4 a4 c5`),
		drums: 'k.h.s.h.k.h.s.hhk.h.s.h.k.hks.hsk.h.s.h.k.h.s.hhk.h.s.h.k.hkssss',
	},
	// 배틀 3: a단조 184, 빠른 16분 리드, 긴박
	battle3: {
		bpm: 184, loop: true, leadType: 'sawtooth',
		lead: seq(`a5 g#5 a5 b5 c6 r a5 r e5 r a5 r c6 b5 c6 d6 e6 r c6 r a5 r e5 r f5 e5 f5 g5 a5 r e5 r
			f5 e5 f5 g5 a5 r f5 r d5 r f5 r a5 g5 a5 b5 c6 r a5 r e5 r c5 r g#5 r b5 r e6 r d6 c6
			a5 g#5 a5 b5 c6 r a5 r e5 r a5 r c6 b5 c6 d6 e6 r c6 r a5 r e5 r f5 e5 f5 g5 a5 r e5 r
			f5 e5 f5 g5 a5 r f5 r d5 r f5 r a5 g5 a5 b5 c6 r b5 r a5 r g#5 r e5 r g#5 r b5 r e6x4`),
		harm: seq(`a4x8 r r r r r r r r e4x8 r r r r r r r r f4x8 r r r r r r r r g4x8 r r r r r r r r f4x8 r r r r r r r r d4x8 r r r r r r r r a4x8 r r r r r r r r e4x8 r r r r r r r r`),
		bass: seq(`a1 a2 a1 a2 a1 a2 a1 a2 e1 e2 e1 e2 e1 e2 e1 e2 f1 f2 f1 f2 f1 f2 f1 f2 g1 g2 g1 g2 g1 g2 g1 g2
			f1 f2 f1 f2 f1 f2 f1 f2 d1 d2 d1 d2 d1 d2 d1 d2 a1 a2 a1 a2 a1 a2 a1 a2 e1 e2 e1 e2 g#1 g#2 g#1 g#2`),
		arp: seq(`a3 c4 e4 a4 e4 c4 a3 c4 e3 g#3 b3 e4 b3 g#3 e3 g#3 f3 a3 c4 f4 c4 a3 f3 a3 g3 b3 d4 g4 d4 b3 g3 b3
			f3 a3 c4 f4 c4 a3 f3 a3 d3 f3 a3 d4 a3 f3 d3 f3 a3 c4 e4 a4 e4 c4 a3 c4 e3 g#3 b3 e4 g#3 b3 e4 g#4`),
		drums: 'kkhsk.hsk.hsk.hskkhsk.hsk.hsksss',
	},
	victory: {
		bpm: 160, loop: false, leadType: 'square',
		lead: seq(`c5 r c5 r c5 r c5 r ab4 r r r bb4 r r r c5 r r bb4 c5 r r r r r r r r r r r`),
		harm: seq(`e4 r e4 r e4 r e4 r c4 r r r d4 r r r e4 r r d4 e4 r r r r r r r r r r r`),
		bass: seq(`c3 r c3 r c3 r c3 r ab2 r r r bb2 r r r c3 r r r c3 r r r r r r r r r r r`),
		drums: 'k.k.k.k.s...s...k..sk...........',
	},
};

let timer: any = null;
let current = '';
/** 작곡한 배경음악(public/bgm/*.mp3)의 루프 지점(초): 인트로 뒤 ~ 곡 끝. 빌드가 public/bgm/loops.json 에서 넣음 */
declare const __BGM_LOOPS__: { [name: string]: { start: number; end: number } };
const BGM_LOOPS: { [name: string]: { start: number; end: number } } = typeof __BGM_LOOPS__ === 'object' ? __BGM_LOOPS__ : {};
export type BgmStyle = 'orch' | 'chip';
/** 음악 스타일: 관현악(mp3)판은 빼고 항상 칩튠판 (예전에 관현악을 고른 설정도 칩튠으로) */
const bgmStyle = (): BgmStyle => 'chip';
const BGM_VOL = [0.25, 0.5, 0.8];
let bgmSrc: AudioBufferSourceNode | null = null;
let bgmGain: GainNode | null = null;
let bgmToken = 0;
const bgmBufs: { [name: string]: Promise<AudioBuffer | null> } = {};
/** mp3 를 받아 디코딩 (file:// 에서도 되도록 XHR) — 실패하면 null */
function loadBgm(name: string, c: AudioContext, url = `bgm/${name}.mp3`): Promise<AudioBuffer | null> {
	return bgmBufs[url] ||= new Promise(resolve => {
		try {
			const x = new XMLHttpRequest();
			x.open('GET', url); x.responseType = 'arraybuffer';
			x.onload = () => {
				const ok = (x.status === 200 || x.status === 0) && x.response && (x.response as ArrayBuffer).byteLength > 1000;
				if (!ok) { resolve(null); return; }
				c.decodeAudioData(x.response as ArrayBuffer, b => resolve(b), () => resolve(null));
			};
			x.onerror = () => resolve(null);
			x.send();
		} catch { resolve(null); }
	});
}
let step = 0;
let nextTime = 0;
let bgmEl: HTMLAudioElement | null = null;
const bgmFileMissing: { [k: string]: boolean } = {};

export const BGM_CHOICES: [string, string][] = [['random', '기본'], ['shuffle', '무작위'], ['none', '없음'], ['battle', '트레이너 배틀'], ['tower', '배틀 시설'], ['boss', '중요 배틀'], ['champion', '챔피언 결전'], ['pwt', 'PWT 토너먼트'], ['evil', '악의 조직'],
	['g3battle', '트레이너 배틀 2'], ['g3gym', '관장전'], ['g3frontier', '배틀 프런티어'],
	['g3rival', '라이벌 배틀'], ['g3evil', '악의 조직 2'], ['g3brain', '프런티어 브레인'], ['g3champion', '챔피언 결전 2'],
	['g3palace', '배틀팰리스'], ['g3factory', '배틀팩토리'], ['g3rank', '랭크 매치'], ['g3rush', '보스 러시'], ['g3daily', '오늘의 도전'],
	['battle2', '옛 칩튠 1'], ['battle3', '옛 칩튠 2']];
/** 배틀 음악 선택: 설정이 '기본'(random)이면 상황별 곡 (작곡한 곡 우선) */
export function pickBattleMusic(situation: 'battle' | 'tower' | 'pwt' | 'boss' | 'evil' | 'champion' | 'palace' | 'factory' | 'rank' | 'rush' | 'daily') {
	const pref = loadSettings().battleBgm || 'random';
	if (pref === 'none') return '';
	const real = (n: string) => !!(TRACKS[n] || BGM_LOOPS[n] || CHIP[n]);
	if (pref === 'shuffle') { const all = BGM_CHOICES.map(c => c[0]).filter(real); return all[Math.floor(Math.random() * all.length)]; }
	if (pref !== 'random' && real(pref)) return pref;
	const has = (n: string) => !!(BGM_LOOPS[n] || CHIP[n]);   // 작곡한 곡(칩튠판 포함)이 없으면 비슷한 곡으로
	const MODE_POOL: { [k: string]: string[] } = { palace: ['g3palace'], factory: ['g3factory', 'tower'], rank: ['g3rank'], rush: ['g3rush', 'g3evil'], daily: ['g3daily', 'g3battle'] };
	const pool = MODE_POOL[situation] ? MODE_POOL[situation] : situation === 'champion' ? [has('champion') ? 'champion' : 'boss', 'g3champion'] : situation === 'boss' ? ['boss', 'g3gym', 'g3brain'] : situation === 'evil' ? ['evil', 'g3evil'] : situation === 'tower' ? ['tower', 'g3frontier']
		: situation === 'pwt' ? (has('pwt') ? ['pwt'] : ['battle', 'tower']) : ['battle', 'g3battle', 'g3rival'];
	return pool[Math.floor(Math.random() * pool.length)];
}

export function playMusic(name: string) {
	if (!name) { stopMusic(); return; }   // 배틀 음악 '없음'
	if (current === name) return;
	stopMusic();
	if (!musicOn()) return;
	const c = ac(); if (!c) return;
	current = name;
	// 0) 음악 스타일이 칩튠이면 작곡한 곡의 칩튠판
	if (chipStyle() && CHIP[name]) { startSynth(name, c, CHIP[name]); return; }
	// 1) 작곡한 곡(루프 지점이 있는 mp3): Web Audio 로 디코딩해 인트로 뒤부터 이음새 없이 반복
	if (BGM_LOOPS[name] && !bgmFileMissing[name]) {
		const token = ++bgmToken;
		loadBgm(name, c).then(buf => {
			if (token !== bgmToken || current !== name) return;
			if (!buf) { bgmFileMissing[name] = true; current = ''; playMusic(name); return; }
			const L = BGM_LOOPS[name];
			const src = c.createBufferSource();
			src.buffer = buf;
			src.loop = L.end - L.start > 1;   // 작곡한 곡은 승리 곡도 팡파르(인트로) 뒤 구간을 반복
			src.loopStart = Math.min(L.start, buf.duration);
			src.loopEnd = Math.min(L.end, buf.duration);
			bgmGain = c.createGain(); bgmGain.gain.value = BGM_VOL[(loadSettings().musicVolume || 2) - 1];
			src.connect(bgmGain); bgmGain.connect(c.destination);
			src.start();
			bgmSrc = src;
		});
		return;
	}
	// 2) 그 밖의 음악 파일이 있으면 그것을 (bgm/<name>.mp3)
	if (!bgmFileMissing[name]) {
		const el = new Audio(`bgm/${name}.mp3`);
		el.loop = name !== 'victory';
		el.volume = [0.25, 0.5, 0.8][(loadSettings().musicVolume || 2) - 1];
		el.addEventListener('error', () => { bgmFileMissing[name] = true; if (current === name && bgmEl === el) { bgmEl = null; startSynth(name, c); } });
		el.addEventListener('canplay', () => { if (current === name && !hidden) el.play().catch(() => {}); });
		bgmEl = el;
		el.load();
		return;
	}
	startSynth(name, c);
}

/* ───── GBA 풍 음원 (작곡한 곡의 칩튠판에 사용) ─────
 * 사각파 채널은 듀티 12.5·25·50% 펄스, 베이스는 4비트 32칸 파형 메모리 채널, 드럼은 LFSR 노이즈(긴 15비트 = 스네어, 짧은 7비트 = 금속성 하이햇)와
 * 음높이가 떨어지는 킥, 그리고 GBA 사운드 엔진(m4a)의 잔향처럼 짧은 메아리. 실제 게임 음원 파일은 쓰지 않고 파형을 계산해 만든다. */
const gbaWaves = new Map<string, PeriodicWave>();
function pulseWave(c: AudioContext, duty: number): PeriodicWave {
	const key = 'p' + duty;
	let w = gbaWaves.get(key);
	if (!w) {
		const H = 48, re = new Float32Array(H), im = new Float32Array(H);
		for (let n = 1; n < H; n++) { re[n] = Math.sin(2 * Math.PI * n * duty) / (n * Math.PI); im[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (n * Math.PI); }
		w = c.createPeriodicWave(re, im); gbaWaves.set(key, w);
	}
	return w;
}
/** 파형 메모리 베이스: 4비트(16단계)로 깎은 삼각파 32칸 */
function waveRamBass(c: AudioContext): PeriodicWave {
	let w = gbaWaves.get('wram');
	if (!w) {
		const L = 32, smp = Array.from({ length: L }, (_, i) => Math.round((i < 16 ? i : 31 - i) * 15 / 15) / 7.5 - 1);
		const H = 16, re = new Float32Array(H), im = new Float32Array(H);
		for (let n = 1; n < H; n++) for (let k = 0; k < L; k++) { const a = 2 * Math.PI * n * k / L; re[n] += smp[k] * Math.cos(a) * 2 / L; im[n] += smp[k] * Math.sin(a) * 2 / L; }
		w = c.createPeriodicWave(re, im); gbaWaves.set('wram', w);
	}
	return w;
}
/** LFSR 노이즈: short=7비트(금속성), 아니면 15비트 */
const lfsrBufs = new Map<string, AudioBuffer>();
function lfsrNoise(c: AudioContext, short: boolean): AudioBuffer {
	const key = short ? 's' : 'l';
	let b = lfsrBufs.get(key);
	if (!b) {
		b = c.createBuffer(1, c.sampleRate, c.sampleRate);
		const d = b.getChannelData(0), clock = short ? 32768 : 131072; // 노이즈 레지스터가 바뀌는 빠르기(Hz)
		let r = 0x7fff, acc = 0;
		for (let i = 0; i < d.length; i++) {
			acc += clock / c.sampleRate;
			while (acc >= 1) { acc -= 1; const bit = (r ^ (r >> 1)) & 1; r = (r >> 1) | (bit << 14); if (short) r = (r & ~0x40) | (bit << 6); }
			d[i] = (r & 1) ? -1 : 1;
		}
		lfsrBufs.set(key, b);
	}
	return b;
}
type GbaVoice = 'lead' | 'harm' | 'arp' | 'bass';
function gbaTone(c: AudioContext, freq: number, dur: number, voice: GbaVoice, vol: number, at: number, bus: GainNode) {
	const t = c.currentTime + at;
	const o = c.createOscillator();
	o.setPeriodicWave(voice === 'bass' ? waveRamBass(c) : pulseWave(c, voice === 'lead' ? 0.25 : voice === 'arp' ? 0.125 : 0.5));
	o.frequency.setValueAtTime(freq, t);
	// 리드는 조금 뒤에 비브라토 (3세대 곡의 긴 음처럼)
	if (voice === 'lead' && dur > 0.25) {
		const lfo = c.createOscillator(), lg = c.createGain();
		lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + 0.18); lg.gain.linearRampToValueAtTime(freq * 0.012, t + 0.32);
		lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.03);
	}
	const g = c.createGain();
	// 엔벨로프: 빠른 시작 → 조금 줄어 유지 → 끝에서 끊김 (GB 채널의 계단식 엔벨로프 느낌)
	const sus = voice === 'bass' ? 0.85 : voice === 'arp' ? 0.4 : 0.7;
	g.gain.setValueAtTime(0.0001, t);
	g.gain.linearRampToValueAtTime(vol, t + 0.004);
	g.gain.linearRampToValueAtTime(vol * sus, t + Math.min(dur, 0.08));
	g.gain.setValueAtTime(vol * sus, t + Math.max(0.005, dur - 0.012));
	g.gain.linearRampToValueAtTime(0.0001, t + dur);
	o.connect(g); g.connect(bus);
	o.start(t); o.stop(t + dur + 0.02);
}
function gbaDrum(c: AudioContext, kind: string, at: number, bus: GainNode) {
	const t = c.currentTime + at;
	if (kind === 'k') {        // 킥: 펄스 음높이가 뚝 떨어짐
		const o = c.createOscillator(), g = c.createGain();
		o.setPeriodicWave(pulseWave(c, 0.5)); o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
		g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
		o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.13);
		return;
	}
	const src = c.createBufferSource(); src.buffer = lfsrNoise(c, kind === 'h');
	src.playbackRate.value = kind === 'h' ? 1 : 0.5;
	const g = c.createGain(), d = kind === 'h' ? 0.035 : 0.12, v = kind === 'h' ? 0.07 : 0.2;
	g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
	src.connect(g); g.connect(bus); src.start(t, Math.random() * 0.5); src.stop(t + d + 0.02);
}
/** GBA 사운드 엔진의 잔향처럼 짧은 메아리 (곡마다 하나) */
function gbaEcho(c: AudioContext, into: GainNode): GainNode {
	const inp = c.createGain(), dl = c.createDelay(0.5), fb = c.createGain(), lp = c.createBiquadFilter(), wet = c.createGain();
	dl.delayTime.value = 0.11; fb.gain.value = 0.3; lp.type = 'lowpass'; lp.frequency.value = 3200; wet.gain.value = 0.22;
	inp.connect(into); inp.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(into);
	return inp;
}

let synthBus: GainNode | null = null;
function startSynth(name: string, c: AudioContext, track?: Track) {
	const tr = track || TRACKS[name] || CHIP[name] || (name === 'evil' || name === 'champion' ? TRACKS.boss : null); if (!tr) return;
	// 작곡한 곡의 칩튠판은 관현악 mp3 와 비슷한 크기로 들리게 키움 (측정 약 18dB 작음 → 12dB 키움, 크게 설정에서도 1을 넘지 않게)
	synthBus = c.createGain(); synthBus.gain.value = Object.values(CHIP).includes(tr) ? 4 : 1; synthBus.connect(musicBus!);
	const gba = Object.values(CHIP).includes(tr);
	const bus = gba ? gbaEcho(c, synthBus) : synthBus;
	step = 0; nextTime = c.currentTime + 0.05;
	const stepDur = 60 / tr.bpm / 4;
	const len = tr.lead.length;
	const noteLen = (arr: (number | null)[], i: number) => { let n = 1; while (arr[(i + n) % arr.length] === -1 && n < 16) n++; return n; };
	timer = setInterval(() => {
		if (hidden) return;
		while (nextTime < c.currentTime + 0.3) {
			if (!tr.loop && step >= len) { stopMusic(); return; }
			const intro = tr.intro && tr.intro < len ? tr.intro : 0;
			const i = step < len ? step : intro + (step - intro) % (len - intro);
			const at = nextTime - c.currentTime;
			const l = tr.lead[i];
			if (gba) {
				// GBA 풍: 리드 25% 펄스(비브라토) · 화음 50% 펄스 · 베이스 파형 메모리 · 아르페지오 12.5% 펄스 · LFSR 드럼
				if (l !== null && l !== -1) gbaTone(c, N(l), stepDur * noteLen(tr.lead, i) * 0.92, 'lead', 0.12, at, bus);
				const hh = tr.harm?.[i % (tr.harm.length || 1)];
				if (hh !== null && hh !== undefined && hh !== -1) gbaTone(c, N(hh), stepDur * noteLen(tr.harm!, i % tr.harm!.length) * 0.95, 'harm', 0.055, at, bus);
				const bb = tr.bass[i % tr.bass.length];
				if (bb !== null && bb !== -1) gbaTone(c, N(bb), stepDur * Math.max(1, noteLen(tr.bass, i % tr.bass.length)) * 0.9, 'bass', 0.26, at, bus);
				const aa = tr.arp?.[i % (tr.arp.length || 1)];
				if (aa !== null && aa !== undefined && aa !== -1) gbaTone(c, N(aa), stepDur * 0.6, 'arp', 0.04, at, bus);
				const dd = tr.drums[i % tr.drums.length];
				if (dd === 'k' || dd === 's' || dd === 'h') gbaDrum(c, dd, at, bus);
				nextTime += stepDur; step++;
				continue;
			}
			if (l !== null && l !== -1) tone(N(l), stepDur * noteLen(tr.lead, i) * 0.9, { type: tr.leadType || 'square', vol: 0.13, at, bus });
			const h = tr.harm?.[i % (tr.harm.length || 1)];
			if (h !== null && h !== undefined && h !== -1) tone(N(h), stepDur * noteLen(tr.harm!, i % tr.harm!.length) * 0.95, { type: 'triangle', vol: 0.08, at, bus });
			const b = tr.bass[i % tr.bass.length];
			if (b !== null && b !== -1) tone(N(b), stepDur * 0.9, { type: 'triangle', vol: 0.3, at, bus });
			const ar = tr.arp?.[i % (tr.arp.length || 1)];
			if (ar !== null && ar !== undefined && ar !== -1) tone(N(ar), stepDur * 0.5, { type: 'square', vol: 0.045, at, bus });
			const d = tr.drums[i % tr.drums.length];
			if (d === 'k') tone(150, 0.1, { type: 'sine', slide: 40, vol: 0.5, at, bus });
			if (d === 's') noise(0.09, { type: 'highpass', freq: 1500, vol: 0.22, at, bus });
			if (d === 'h') noise(0.03, { type: 'highpass', freq: 7000, vol: 0.1, at, bus });
			nextTime += stepDur; step++;
		}
	}, 60);
}
export function setMoveSfxVolume(v: number) { if (moveBus) moveBus.gain.value = MOVE_SFX_GAIN[v] ?? 0.35; }
export function setSfxVolume(v: 1 | 2 | 3) { if (sfxBus) sfxBus.gain.value = [0.3, 0.55, 0.85][v - 1]; }
export function setMusicVolume(v: 1 | 2 | 3) {
	if (musicBus) musicBus.gain.value = [0.1, 0.22, 0.38][v - 1];
	if (bgmEl) bgmEl.volume = [0.25, 0.5, 0.8][v - 1];
	if (bgmGain) bgmGain.gain.value = BGM_VOL[v - 1];
}
/** 음악 스타일을 바꿨을 때 지금 곡을 새 스타일로 다시 */
export const currentMusic = () => current;
export function restartMusic() { const n = current; if (!n) return; stopMusic(); playMusic(n); }

export function stopMusic() {
	if (timer) clearInterval(timer);
	timer = null; current = ''; bgmToken++;
	if (synthBus) { const sb = synthBus; synthBus = null; setTimeout(() => sb.disconnect(), 400); }
	if (bgmEl) { bgmEl.pause(); bgmEl.src = ''; bgmEl = null; }
	if (bgmSrc) { try { bgmSrc.stop(); } catch { /* 이미 멈춤 */ } bgmSrc.disconnect(); bgmSrc = null; }
	if (bgmGain) { bgmGain.disconnect(); bgmGain = null; }
}

/** 기술 애니메이션 효과음 음량 (효과음 설정 반영) */
export function animSfxVolume() {
	const st = loadSettings();
	if (st.sound === false) return 0;
	return [0.3, 0.6, 0.9][(st.sfxVolume || 1) - 1] * MOVE_SFX_GAIN[st.moveSfx ?? 1];
}
/** 진동 (설정에서 끌 수 있음) */
export function vibrate(ms: number | number[]) {
	if (loadSettings().vibrate === false || hidden) return;
	try { navigator.vibrate?.(ms); } catch {}
}
