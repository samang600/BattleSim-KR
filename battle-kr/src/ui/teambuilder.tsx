/** 팀 편집 */
import { h } from 'preact';
import { useMemo, useState, useRef, useLayoutEffect } from 'preact/hooks';
import { allSpecies, allItems, allNatures, learnset, moveData, speciesData, toID, abilityKo, abilityDesc, itemKo, itemDesc,
	natureKo, STAT_KO, STAT_SHORT, STATS, RAW, speciesKo, nickKo, ALL_TYPES, typeKo, fixedTera, megaStonesFor, allBalls, type Gen, type StatID } from '../data';
import { typeEff } from './calc';
import { randomSetFor, applySpread, randomTeam, normalizeSP, fillSP, cheatSP, spOf, spToEv, evToSp, SP_MAX, SP_TOTAL, evDisplay, fmtSP, evsFor510, type PSet } from '../sets';
import { ruleById, teamRuleWarnings } from '../rules';
import { loadSettings } from '../store';
import { loadTeams, upsertTeam, deleteTeam, newId, load, save, type SavedTeam } from '../store';
import { Screen, Sprite, MiniSprite, TypeBadge, Modal, toast, confirmBox, ItemIcon, CatIcon } from './core';
import { SetCard } from './screens';

// 초성 검색
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
function chosung(s: string) {
	let out = '';
	for (const ch of s) {
		const c = ch.charCodeAt(0);
		out += c >= 0xAC00 && c <= 0xD7A3 ? CHO[Math.floor((c - 0xAC00) / 588)] : ch;
	}
	return out;
}
export function matches(query: string, ...names: string[]) {
	const q = query.trim().toLowerCase().replace(/\s/g, '');
	if (!q) return true;
	const isCho = /^[ㄱ-ㅎ]+$/.test(q);
	return names.some(n => {
		const nn = n.toLowerCase().replace(/\s/g, '');
		if (nn.includes(q) || toID(n).includes(toID(q) || '\u0000')) return true;
		return isCho && chosung(nn).includes(q);
	});
}

export function newSet(species: string, gen: Gen): PSet {
	return randomSetFor(species, gen, 50);
}

/** 팀 목록 */
export function TeamList({ onBack, onEdit }: { onBack: () => void; onEdit: (t: SavedTeam) => void }) {
	const [teams, setTeams] = useState(loadTeams());
	const create = (gen: Gen, random: boolean, cheat = false) => {
		const t: SavedTeam = { id: newId(), name: cheat ? `치트 팀 ${teams.filter(x => x.cheat).length + 1}` : `팀 ${teams.length + 1}`, gen,
			sets: random ? randomTeam({ gen, size: 6, minBst: 470 }) : [], updated: Date.now(), ...(cheat ? { cheat: true } : {}) };
		upsertTeam(t);
		onEdit(t);
	};
	return <Screen title="팀 편집" onBack={onBack}>
		<div class="row wrap">
			<button class="btn primary" onClick={() => create(9, false)}>+ 새 팀</button>
			<button class="btn ghost" onClick={() => create(9, true)}>🎲 추천 팀 받기</button>
			<button class="btn ghost" onClick={() => create(9, false, true)}>🃏 치트 팀</button>
		</div>
		<p class="muted small">치트 팀: 아무 기술·특성이나 넣고 능력 포인트 제한(합계 66) 없이 만들 수 있어요. 각 배틀 모드의 형식 선택 화면에서 ‘치트 팀 허용’을 켜면 쓸 수 있고, 전적에 남지 않습니다.</p>
		<ImportBox onImported={() => setTeams(loadTeams())} />
		{!teams.length && <p class="empty-msg">아직 팀이 없습니다. 새 팀을 만들거나 추천팀을 받아 보세요.</p>}
		<div class="card-list">
			{teams.map(t => <div class="team-row clickable" onClick={() => onEdit(t)}>
				<div class="team-row-head"><b>{t.name}</b>{t.cheat && <span class="cheat-tag">치트</span>}<span class="muted">{t.sets.length}/6</span>
					<button class="btn small" onClick={e => { e.stopPropagation(); upsertTeam({ ...JSON.parse(JSON.stringify(t)), id: newId(), name: t.name + ' 복사본' }); setTeams(loadTeams()); toast('팀을 복제했습니다'); }}>복제</button></div>
				<div class="preview-row">{t.sets.map(s => <MiniSprite species={s.species} gen={t.gen} size={40} shiny={s.shiny} />)}</div>
			</div>)}
		</div>
	</Screen>;
}

/** 쇼다운 텍스트 가져오기 (영문/한글 이름 모두) */
const KO_LOOKUP: { [ko: string]: string } = {};
function koLookup(name: string): string {
	if (!Object.keys(KO_LOOKUP).length) {
		for (const table of [RAW.species, RAW.moves, RAW.items, RAW.abilities, RAW.natures] as any[]) {
			for (const id in table) KO_LOOKUP[table[id].n.replace(/\s/g, '')] = id;
		}
	}
	const k = name.trim().replace(/\s/g, '');
	return KO_LOOKUP[k] || toID(name);
}
export function importText(text: string, gen: Gen): PSet[] {
	const sets: PSet[] = [];
	for (const block of text.split(/\n\s*\n/)) {
		const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
		if (!lines.length) continue;
		let [first, item] = lines[0].split('@').map(s => s.trim());
		first = first.replace(/\((M|F)\)\s*$/, '').trim();
		let species = first;
		let gender = '';
		const gm = /^(.*?)\s*\(([MF])\)$/.exec(first);
		if (gm) { first = gm[1].trim(); gender = gm[2]; }
		const paren = /^(.*)\(([^)]+)\)$/.exec(first);
		let nick = '';
		if (paren) { species = paren[2]; nick = paren[1].trim(); }
		const sid = koLookup(species);
		const sd = speciesData(sid, gen);
		if (!sd) continue;
		const set: PSet = {
			name: nick && toID(nick) !== sid && nick !== nickKo(sid) ? nick.slice(0, 12) : nickKo(sid), species: sd.en, item: item ? koLookup(item) : '', ability: sd.ab[0], moves: [], nature: 'serious',
			evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
		};
		if (gender) set.gender = gender;
		for (const l of lines.slice(1)) {
			if (/^(Ability|특성):/i.test(l)) set.ability = koLookup(l.split(':')[1]);
			else if (/^(EVs|노력치|SPs?|능력 ?포인트):/i.test(l) || /^(IVs|개체값):/i.test(l)) {
				const isSp = /^(SPs?|능력 ?포인트)/i.test(l);
				const target = /^(EVs|노력치)/i.test(l) || isSp ? set.evs : set.ivs;
				for (const part of l.split(':')[1].split('/')) {
					const m = /(\d+)\s*(.+)/.exec(part.trim());
					if (!m) continue;
					const key = { hp: 'hp', atk: 'atk', def: 'def', spa: 'spa', spd: 'spd', spe: 'spe', 공격: 'atk', 방어: 'def', 특공: 'spa', 특방: 'spd', 스피드: 'spe', 특수공격: 'spa', 특수방어: 'spd' }[toID(m[2]) || m[2].trim()] as StatID;
					if (key) target[key] = isSp ? spToEv(parseInt(m[1], 10)) : parseInt(m[1], 10);
				}
			} else if (/Nature$/i.test(l) || /성격$/.test(l)) set.nature = koLookup(l.replace(/\s*(Nature|성격)$/i, ''));
			else if (l.startsWith('-')) {
				const mid = koLookup(l.slice(1).replace(/\[.*\]/, ''));
				if (moveData(mid, gen)) set.moves.push(mid);
			} else if (/^Shiny: Yes/i.test(l) || /^색이 다른: 예/.test(l)) set.shiny = true;
			else if (/^Gigantamax: Yes/i.test(l) || /^거다이맥스: 예/.test(l)) set.gigantamax = true;
			else if (/^(Ball|볼):/i.test(l)) { const b = koLookup(l.split(':')[1]); if (RAW.items[b]?.ball) set.pokeball = b; }
			else if (/^(Tera ?Type|테라타입):/i.test(l)) { const t = l.split(':')[1].trim(); set.teraType = ALL_TYPES.find(x => x.toLowerCase() === t.toLowerCase() || typeKo(x) === t) || set.teraType; }
		}
		if (!set.moves.length) continue;
		// 본가 노력치(합계 510)를 꽉 채운 세트(예: 252/252/4 = 65포인트)는 챔피언스의 남는 1포인트를 4를 준 능력에 더함 (→ 32/32/2)
		const evSum = Object.values(set.evs).reduce((a, v) => a + (v || 0), 0);
		if (evSum >= 508 && evSum <= 510) { fillSP(set); sets.push(set); continue; }
		sets.push(normalizeSP(set));
	}
	return sets.slice(0, 6);
}
export function exportText(sets: PSet[]) {
	return sets.map(s => {
		const nick = s.name && s.name !== nickKo(toID(s.species)) ? `${s.name} (${speciesKo(s.species)})` : speciesKo(s.species);
		const lines = [`${nick}${s.gender ? ` (${s.gender})` : ''}${s.item ? ' @ ' + itemKo(s.item) : ''}`, `특성: ${abilityKo(s.ability)}`,
			evDisplay() ? `노력치: ${(() => { const e = evsFor510(spOf(s)); return STATS.filter(k => e[k]).map(k => `${e[k]} ${STAT_SHORT[k]}`).join(' / '); })()}`
				: `능력 포인트: ${(() => { const p = spOf(s); return STATS.filter(k => p[k]).map(k => `${p[k]} ${STAT_SHORT[k]}`).join(' / '); })()}`,
			`${natureKo(s.nature)} 성격`, `테라타입: ${typeKo(fixedTera(s.species) || s.teraType || speciesData(toID(s.species), 9)?.t[0] || 'Normal')}`,
			...(s.gigantamax ? ['거다이맥스: 예'] : []), ...(s.pokeball && s.pokeball !== 'pokeball' ? [`볼: ${itemKo(s.pokeball)}`] : []), ...(s.shiny ? ['색이 다른: 예'] : []), ...s.moves.map(m => `- ${moveData(m, 5)?.name || m}`)];
		return lines.join('\n');
	}).join('\n\n');
}

function ImportBox({ onImported }: { onImported: () => void }) {
	const [open, setOpen] = useState(false);
	const [text, setText] = useState('');
	const gen: Gen = 9;
	if (!open) return <button class="btn ghost small" onClick={() => setOpen(true)}>텍스트로 팀 가져오기</button>;
	return <Modal title="팀 가져오기" onClose={() => setOpen(false)}>
		<p class="muted">쇼다운 형식(영어/한글 이름) 텍스트를 붙여 넣으세요.</p>
		<textarea rows={10} value={text} onInput={e => setText((e.target as HTMLTextAreaElement).value)}
			placeholder={'한카리아스 @ 구애스카프\n특성: 모래숨기\n능력 포인트: 32 공격 / 2 HP / 32 스피드\n명랑 성격\n- 역린\n- 지진\n- 스톤에지\n- 불꽃엄니'} />
		<div class="row end">
			<button class="btn primary" onClick={() => {
				const sets = importText(text, gen);
				if (!sets.length) { toast('읽을 수 있는 포켓몬이 없습니다'); return; }
				upsertTeam({ id: newId(), name: '가져온 팀', gen, sets, updated: Date.now() });
				toast(`${sets.length}마리를 가져왔습니다`);
				setOpen(false); onImported();
			}}>가져오기</button>
		</div>
	</Modal>;
}

/** 팀 하나 편집 */
export function TeamEditor({ team: initial, onBack }: { team: SavedTeam; onBack: () => void }) {
	const [team, setTeam] = useState<SavedTeam>(JSON.parse(JSON.stringify(initial)));
	const [editing, setEditing] = useState<number | null>(null);
	const [adding, setAdding] = useState(false);
	const [exportOpen, setExportOpen] = useState(false);
	const [importOpen, setImportOpen] = useState(false);
	const [importText2, setImportText2] = useState('');
	const commit = (t: SavedTeam) => { setTeam(t); upsertTeam(t); };
	const g = team.gen;

	if (adding) {
		// 치트 팀은 같은 포켓몬을 여러 마리 넣을 수 있음 (배틀 때 이름에 번호가 붙음)
		return <SpeciesPicker gen={g} exclude={team.cheat ? [] : team.sets.map(s => toID(s.species))} onBack={() => setAdding(false)}
			onPick={sid => { const t = { ...team, sets: [...team.sets, newSet(sid, g)] }; commit(t); setAdding(false); setEditing(t.sets.length - 1); }} />;
	}
	if (editing !== null && team.sets[editing]) {
		return <SetEditor set={team.sets[editing]} gen={g} cheat={!!team.cheat} onBack={() => setEditing(null)}
			onChange={s => { const sets = team.sets.slice(); sets[editing] = s; commit({ ...team, sets }); }}
			onDelete={() => { commit({ ...team, sets: team.sets.filter((_, i) => i !== editing) }); setEditing(null); }} />;
	}
	return <Screen title={team.name} onBack={onBack} right={<button class="icon-btn" onClick={async () => {
		if (await confirmBox('팀 삭제', `"${team.name}" 팀을 삭제할까요?`, '삭제')) { deleteTeam(team.id); onBack(); }
	}} aria-label="삭제">🗑</button>}>
		<label class="field-label">팀 이름
			<input value={team.name} onInput={e => commit({ ...team, name: (e.target as HTMLInputElement).value })} />
		</label>
		{team.cheat ? <p class="cheat-note">🃏 치트 팀 — 같은 포켓몬 여러 마리 가능, 기술·특성 제한 없음, 능력 포인트 능력마다 최대 32(합계 제한 없음), 레벨 자유. 배틀 모드에서 ‘치트 팀 허용’을 켜야 쓸 수 있고 전적에 남지 않습니다.</p>
			: <><p class="muted">내셔널 도감 · 레벨 50 · 같은 포켓몬은 1마리씩 · 메가스톤·Z크리스탈 사용 가능</p><TeamWarnings sets={team.sets} /></>}
		<div class="card-list">
			{team.sets.map((s, i) => <SetCard set={s} gen={g} onClick={() => setEditing(i)}>
				<div class="reorder" onClick={e => e.stopPropagation()}>
					<button class="icon-btn" disabled={i === 0} onClick={() => { const sets = team.sets.slice(); [sets[i - 1], sets[i]] = [sets[i], sets[i - 1]]; commit({ ...team, sets }); }}>▲</button>
				</div>
			</SetCard>)}
		</div>
		{team.sets.length < 6 && <button class="btn primary big" onClick={() => setAdding(true)}>+ 포켓몬 추가</button>}
		<div class="row wrap">
			<button class="btn ghost" onClick={() => setExportOpen(true)}>텍스트로 내보내기</button>
			{team.sets.length < 6 && <button class="btn ghost" onClick={() => setImportOpen(true)}>텍스트로 추가</button>}
		</div>
		{importOpen && <Modal title="텍스트로 포켓몬 추가" onClose={() => setImportOpen(false)}>
			<p class="muted">쇼다운 형식 텍스트. 빈 줄로 구분하면 여러 마리를 한 번에 추가합니다 (최대 6마리까지).</p>
			<textarea rows={10} value={importText2} onInput={e => setImportText2((e.target as HTMLTextAreaElement).value)} />
			<div class="row end"><button class="btn primary" onClick={() => {
				const sets = importText(importText2, g);
				if (!sets.length) { toast('읽을 수 있는 포켓몬이 없습니다'); return; }
				const room = 6 - team.sets.length;
				const add = sets.slice(0, room);
				commit({ ...team, sets: [...team.sets, ...add] });
				toast(`${add.length}마리를 추가했습니다${sets.length > room ? ` (${sets.length - room}마리는 자리가 없어 제외)` : ''}`);
				setImportOpen(false); setImportText2('');
			}}>추가</button></div>
		</Modal>}
		{team.sets.length > 0 && <TeamAnalysis sets={team.sets} />}
		{exportOpen && <Modal title="내보내기" onClose={() => setExportOpen(false)}>
			<textarea rows={14} readOnly value={exportText(team.sets)} />
			<button class="btn primary" onClick={() => { navigator.clipboard?.writeText(exportText(team.sets)).then(() => toast('복사했습니다'), () => toast('복사 실패')); }}>복사</button>
		</Modal>}
	</Screen>;
}

function SpeciesPicker({ gen, exclude, onPick, onBack }: { gen: Gen; exclude: string[]; onPick: (id: string) => void; onBack: () => void }) {
	const [q, setQ] = useState('');
	const list = useMemo(() => allSpecies(gen).filter(s => s && !s.bo && s.ls !== undefined || (s && s.base && !s.bo)), [gen]);
	const [type, setType] = useState('');
	const [sort, setSort] = useState<'num' | 'bst' | 'name' | 'spe' | 'atk'>('num');
	const tot = (x: any) => x.bs.reduce((p: number, c: number) => p + c, 0);
	let shown = list.filter(s => s && matches(q, s.n, s.en) && (!type || s.t.includes(type)));
	if (sort !== 'num') shown = shown.slice().sort((a, b) => sort === 'bst' ? tot(b) - tot(a) : sort === 'spe' ? b!.bs[5] - a!.bs[5] :
		sort === 'atk' ? Math.max(b!.bs[1], b!.bs[3]) - Math.max(a!.bs[1], a!.bs[3]) : a!.n.localeCompare(b!.n, 'ko'));
	shown = shown.slice(0, 150);
	return <Screen top title="포켓몬 고르기" onBack={onBack}>
		<input class="search" placeholder="이름 검색 (초성 가능: ㅎㅋㄹ)" value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} autoFocus />
		<div class="sort-bar"><span>정렬</span>{([['num', '도감'], ['name', '가나다'], ['bst', '종족값'], ['atk', '공격력'], ['spe', '스피드']] as const).map(([k, l]) =>
			<button class={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{l}</button>)}</div>
		<div class="type-filter"><button class={!type ? 'on' : ''} onClick={() => setType('')}>전체</button>
			{ALL_TYPES.filter(t => t !== 'Stellar').map(t => <button class={type === t ? 'on' : ''} onClick={() => setType(type === t ? '' : t)}><TypeBadge type={t} small /></button>)}</div>
		<div class="pick-list">
			{shown.map(s => s && <button class="pick-row" disabled={exclude.includes(s.id)} onClick={() => onPick(s.id)}>
				<MiniSprite species={s.id} gen={gen} size={40} />
				<span class="pick-name">{s.n}<small class="muted"> #{s.num}</small></span>
				<span class="pick-types">{s.t.map(t => <TypeBadge type={t} small />)}</span>
				<small class="muted bst">{sort === 'spe' ? `스피드 ${s.bs[5]}` : sort === 'atk' ? `공 ${s.bs[1]}/특 ${s.bs[3]}` : `합계 ${tot(s)}`}</small>
			</button>)}
		</div>
	</Screen>;
}

function statValue(base: number, ev: number, iv: number, level: number, nat: number, hp: boolean) {
	if (hp) return base === 1 ? 1 : Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + level + 10;
	return Math.floor((Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5) * nat);
}

export function SetEditor({ set, gen, onChange, onDelete, onBack, cheat }: { set: PSet; gen: Gen; onChange: (s: PSet) => void; onDelete: () => void; onBack: () => void; cheat?: boolean }) {
	const [s, setS] = useState<PSet>(() => (cheat ? cheatSP : normalizeSP)(JSON.parse(JSON.stringify(set))));
	// 고르기는 화면을 바꾸지 않고 팝업 창에서 (챔피언스 모드의 포켓몬 창과 같은 방식)
	const [picker, setPicker] = useState<null | { kind: 'move'; idx: number } | { kind: 'item' } | { kind: 'nature' } | { kind: 'ability' } | { kind: 'tera' } | { kind: 'sp' } | { kind: 'etc' }>(null);
	const openPicker = (p: NonNullable<typeof picker>) => setPicker(p), close = () => setPicker(null);
	const up = (patch: Partial<PSet>) => { const n = { ...s, ...patch }; setS(n); onChange(n); };
	const sd = speciesData(toID(s.species), gen)!;
	// 같은 포켓몬의 다른 모습 (메가·원시·거다이맥스처럼 배틀 중 바뀌는 모습과 배틀 전용 모습 제외)
	const baseId = RAW.species[toID(s.species)]?.base || toID(s.species);
	const formes = useMemo(() => Object.keys(RAW.species).filter(id => (id === baseId || RAW.species[id].base === baseId)).map(id => speciesData(id, gen)!)
		.filter(f => f && (cheat ? true : (!f.bo && !f.req))), [baseId, gen, cheat]);
	const nat = RAW.natures[s.nature];
	const sp = cheat ? Object.fromEntries(STATS.map(k => [k, evToSp(s.evs[k] || 0)])) as { [k in StatID]: number } : spOf(s);
	const spTotal = STATS.reduce((a, k) => a + sp[k], 0);
	const setSp = (n: { [k in StatID]: number }) => {
		const evs = { ...s.evs };
		for (const k of STATS) evs[k] = spToEv(n[k]);
		up({ evs, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } });
	};
	const natMulOf = (k: StatID) => nat?.p === k ? 1.1 : nat?.m === k ? 0.9 : 1;
	const statOf = (k: StatID, i: number) => statValue(sd.bs[i], s.evs[k], 31, s.level, natMulOf(k), k === 'hp');
	const row = (kind: NonNullable<typeof picker>['kind'], label: string, val: any, dis = false) => <button class="cp-mrow" disabled={dis} onClick={() => openPicker({ kind } as any)}><small>{label}</small><b>{val}</b><em>{dis ? '' : '바꾸기'}</em></button>;
	const tera = fixedTera(s.species) || s.teraType || sd.t[0];
	const spText = STATS.map(k => sp[k] ? `${STAT_SHORT[k]} ${fmtSP(sp[k])}` : '').filter(Boolean).join(' · ') || '나누지 않음';
	const mvIdx = picker?.kind === 'move' ? picker.idx : -1, swap = (a: number, b: number) => { const mv = s.moves.slice(); [mv[a], mv[b]] = [mv[b], mv[a]]; up({ moves: mv }); setPicker({ kind: 'move', idx: b }); };

	return <Screen title={sd.n} onBack={onBack} right={<button class="icon-btn" onClick={onDelete} aria-label="삭제">🗑</button>}>
		<div class="cp-mp set-mp">
			<div class="cp-mp-head"><span class="cp-mp-spr big"><Sprite species={s.species} gen={gen} size={96} shiny={s.shiny} /></span>
				<div><span>{sd.t.map(t => <TypeBadge type={t} />)}</span>
					<label class="sel-row nick-row"><span>닉네임</span>
						<input maxLength={12} placeholder={nickKo(toID(s.species))} value={s.name && s.name !== nickKo(toID(s.species)) ? s.name : ''}
							onInput={e => { const v = (e.target as HTMLInputElement).value.replace(/[,|[\]]/g, ''); up({ name: v.trim() ? v : nickKo(toID(s.species)) }); }} /></label>
					<div class="set-headbtns"><button class="btn small" onClick={() => openPicker({ kind: 'etc' })}>모습·성별·볼</button>
						<button class="btn ghost small" onClick={() => { const n = randomSetFor(toID(s.species), gen, 50); n.shiny = s.shiny; setS(n); onChange(n); toast('추천 세트로 바꿨습니다'); }}>추천 세트</button></div>
				</div></div>
			<div class="cp-pn set-pn"><div class="cp-mrows">
				{row('item', '도구', s.item ? <><ItemIcon item={s.item} size={24} />{itemKo(s.item)}</> : '없음')}
				{row('ability', '특성', abilityKo(s.ability), !cheat && sd.ab.length < 2)}
				{row('nature', '성격', <>{nat?.n || s.nature}{nat?.p ? <small> {STAT_SHORT[nat.p]}▲ {STAT_SHORT[nat.m]}▼</small> : null}</>)}
				{row('tera', '테라 타입', <><TypeBadge type={tera} small />{fixedTera(s.species) ? <small> 고정</small> : null}</>, !!fixedTera(s.species))}
				{row('sp', evDisplay() ? '노력치' : '능력 포인트', <small class={spTotal > SP_TOTAL ? 'bad' : ''}>{spText} ({cheat ? spTotal : `${spTotal}/${SP_TOTAL}`})</small>)}
			</div></div>
			<p class="muted small set-abdesc">{abilityDesc(s.ability)}</p>
			<div class="cp-mmoves set-moves">{[0, 1, 2, 3].map(i => { const m = s.moves[i], md = m ? moveData(m, gen) : null;
				return <button onClick={() => openPicker({ kind: 'move', idx: Math.min(i, s.moves.length) })}>
					{md ? <><span class="pm-icons"><TypeBadge type={md.type} small /><CatIcon cat={md.category} /></span><b>{md.name}</b>
						<em>{md.category === 'Status' ? '변화' : `위력 ${md.basePower || '-'}`} · 명중 {md.accuracy || '-'} · PP {md.pp}</em></> : <b class="muted">+ 기술 선택</b>}</button>; })}</div>
			<div class="set-stats">{STATS.map((k, i) => <span class={natMulOf(k) > 1 ? 'up' : natMulOf(k) < 1 ? 'down' : ''}><small>{STAT_SHORT[k]}</small><b>{statOf(k, i)}</b></span>)}</div>
			{cheat ? <div class="set-row"><span>레벨 {s.level}</span><input type="range" min={1} max={100} value={s.level} onInput={e => up({ level: parseInt((e.target as HTMLInputElement).value, 10) })} /></div>
				: <p class="muted small">레벨 {s.level} (모드에 따라 50/100으로 맞춰짐) · 줄이나 기술을 누르면 바꾸는 창이 열립니다</p>}
		</div>
		{picker?.kind === 'move' && <Modal title={s.moves[mvIdx] ? `${moveData(s.moves[mvIdx], gen)?.name || ''} 바꾸기` : '기술 고르기'} onClose={close}>
			{s.moves[mvIdx] && <div class="set-mvacts"><button class="btn small" disabled={mvIdx === 0} onClick={() => swap(mvIdx, mvIdx - 1)}>앞으로</button>
				<button class="btn small" disabled={mvIdx >= s.moves.length - 1} onClick={() => swap(mvIdx, mvIdx + 1)}>뒤로</button>
				<button class="btn small ghost" disabled={s.moves.length <= 1} onClick={() => { up({ moves: s.moves.filter((_, k) => k !== mvIdx) }); close(); }}>빼기</button></div>}
			<MovePicker gen={gen} species={toID(s.species)} current={s.moves} all={cheat}
				onPick={mid => { const moves = s.moves.slice(); if (mvIdx < moves.length) moves[mvIdx] = mid; else moves.push(mid); up({ moves: moves.filter(Boolean) }); close(); }} /></Modal>}
		{picker?.kind === 'item' && <Modal title="도구 고르기" onClose={close}><ItemPicker gen={gen} onPick={id => { up({ item: id }); close(); }} /></Modal>}
		{picker?.kind === 'ability' && <Modal title="특성" onClose={close}>
			<div class="cp-opts">{sd.ab.map(a => <button class="cp-opt" disabled={s.ability === a} onClick={() => { up({ ability: a }); close(); }}><div><b>{abilityKo(a)}</b><small>{abilityDesc(a)}</small></div>{s.ability === a && <em>지금</em>}</button>)}</div>
			{cheat && <><h3 class="sec">🃏 다른 특성 (치트)</h3><AbilityPicker onPick={a => { up({ ability: a }); close(); }} /></>}</Modal>}
		{picker?.kind === 'nature' && <Modal title="성격" onClose={close}>
			<div class="cp-opts grid">{allNatures().map(n => <button class={'cp-opt' + (s.nature === n.id ? ' cur' : '')} disabled={s.nature === n.id} onClick={() => { up({ nature: n.id }); close(); }}>
				<div><b>{n.n}</b><small>{n.p ? `${STAT_SHORT[n.p]}▲ ${STAT_SHORT[n.m]}▼` : '변화 없음'}</small></div></button>)}</div></Modal>}
		{picker?.kind === 'tera' && <Modal title="테라스탈 타입" onClose={close}>
			<div class="cp-opts grid">{ALL_TYPES.map(t => <button class={'cp-opt' + (tera === t ? ' cur' : '')} disabled={tera === t} onClick={() => { up({ teraType: t }); close(); }}><TypeBadge type={t} small /><div><b>{typeKo(t)}</b></div></button>)}</div></Modal>}
		{picker?.kind === 'etc' && <Modal title="모습 · 성별 · 볼" onClose={close}><div class="set-etc">
			<label class="check"><input type="checkbox" checked={!!s.shiny} onChange={e => up({ shiny: (e.target as HTMLInputElement).checked })} /> 색이 다른 포켓몬</label>
			{formes.length > 1 && <label class="sel-row"><span>모습</span>
				<select value={toID(s.species)} onChange={e => {
					const f = speciesData((e.target as HTMLSelectElement).value, gen)!;
					// 바꾼 모습이 배울 수 없는 기술은 뺌 (치트 팀은 그대로)
					const legal = new Set(learnset(f.id, gen));
					const moves = cheat ? s.moves : s.moves.filter(m => !m || legal.has(toID(m)));
					const dropped = s.moves.filter(m => m && !moves.includes(m));
					up({ species: f.en, name: !s.name || s.name === nickKo(toID(s.species)) ? nickKo(toID(f.en)) : s.name, ability: f.ab.includes(s.ability) ? s.ability : f.ab[0], teraType: s.teraType && (sd.t.includes(s.teraType) ? f.t[0] : s.teraType), moves });
					if (dropped.length) toast(`${f.n} 모습이 배울 수 없는 기술을 뺐어요: ${dropped.map(m => moveData(toID(m), gen)?.name || m).join(', ')}`);
				}}>{formes.map(f => <option value={f.id}>{f.n}{cheat && (f.req || f.bo) ? ' (배틀 중 모습)' : ''}</option>)}</select></label>}
			<label class="sel-row"><span>성별</span>
				{sd.gr ? <b class="muted">{sd.gr === 'M' ? '♂ 수컷' : sd.gr === 'F' ? '♀ 암컷' : '성별 없음'}</b> :
				<select value={s.gender || ''} onChange={e => up({ gender: (e.target as HTMLSelectElement).value })}>
					<option value="">무작위</option><option value="M">♂ 수컷</option><option value="F">♀ 암컷</option></select>}</label>
			{sd.gx && <label class="check"><input type="checkbox" checked={!!s.gigantamax} onChange={e => up({ gigantamax: (e.target as HTMLInputElement).checked })} /> 거다이맥스 <small class="muted">(다이맥스할 때 거다이맥스 모습·기술)</small></label>}
			<h3 class="sec">볼 <small class="muted">나올 때 볼의 색과 빛이 달라집니다</small></h3>
			<div class="ball-grid">{allBalls().map(b => <button class={'ball-cell' + ((s.pokeball || 'pokeball') === b.id ? ' on' : '')} onClick={() => up({ pokeball: b.id })}>
				<ItemIcon item={b.id} size={30} /><span>{b.n}</span></button>)}</div>
		</div></Modal>}
		{picker?.kind === 'sp' && <Modal title={`${evDisplay() ? '노력치' : '능력 포인트'} · ${cheat ? `${spTotal} (제한 없음)` : `${spTotal} / ${SP_TOTAL}`}`} onClose={close}>
			<div class="chips-row">{SP_PRESETS.map(([label, sp]) => <button class="chipbtn" onClick={() => setSp({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...sp })}>{label}</button>)}
				<button class="chipbtn" onClick={() => { const n = applySpread({ ...s, evs: { ...s.evs } }, gen); up({ evs: fillSP({ ...s, evs: n.evs, ivs: { ...s.ivs } }).evs, nature: n.nature }); }}>자동 배분</button>
				<button class="chipbtn" onClick={() => setSp({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 })}>초기화</button></div>
			<div class="ev-table">
				{STATS.map((k, i) => {
					const natMul = natMulOf(k);
					const change = (v: number) => {
						v = Math.max(0, Math.min(SP_MAX, v, cheat ? SP_MAX : SP_TOTAL - (spTotal - sp[k])));
						setSp({ ...sp, [k]: v });
					};
					return <div class="ev-row">
						<span class={'ev-label' + (natMul > 1 ? ' up' : natMul < 1 ? ' down' : '')}>{STAT_SHORT[k]}{natMul > 1 ? '▲' : natMul < 1 ? '▼' : ''}</span>
						<span class="ev-base">{sd.bs[i]}</span>
						<button class="sp-step" onClick={() => change(sp[k] - 1)} aria-label="빼기">−</button>
						<input type="range" min={0} max={SP_MAX} step={1} value={sp[k]} onInput={e => change(parseInt((e.target as HTMLInputElement).value, 10))} />
						<button class="sp-step" onClick={() => change(sp[k] + 1)} aria-label="더하기">+</button>
						<span class="ev-val">{fmtSP(sp[k])}</span>
						<b class="ev-stat">{statOf(k, i)}</b>
					</div>;
				})}
			</div>
			<p class="muted small">{evDisplay()
				? '노력치로 표시(설정에서 바꿈): 4 다음부터 8씩, 능력마다 최대 252 · 레벨 50에서 능력치 +1. 규칙은 챔피언스 방식 합계 66포인트라 본가 510보다 1포인트(노력치 8) 더 쓸 수 있습니다(예: 252/252/12). 개체값은 모두 최대.'
				: '포켓몬 챔피언스 방식: 능력마다 0~32포인트, 합계 66포인트. 개체값은 없고(모두 최대), 레벨 50에서 1포인트 = 능력치 +1.'}</p>
			<button class="btn big primary" onClick={close}>확인</button></Modal>}
	</Screen>;
}

type MoveSort = 'name' | 'power' | 'type' | 'acc' | 'pp';
const ko = (a: string, b: string) => a.localeCompare(b, 'ko');
/** 검색어와 가까운 이름을 먼저 (완전히 같음 → 앞부분이 같음 → 포함 → 나머지) */
const qRank = (q: string, n: string) => { q = q.trim().replace(/\s/g, ''); n = n.replace(/\s/g, ''); return !q ? 0 : n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : 3; };
function MovePicker({ gen, species, current, onPick, all }: { gen: Gen; species: string; current: string[]; onPick: (id: string) => void; all?: boolean }) {
	const [q, setQ] = useState('');
	const [sort, setSort] = useState<MoveSort>(() => (load<MoveSort>('moveSort', 'name')));
	const [cat, setCat] = useState<'' | 'Physical' | 'Special' | 'Status'>('');
	const [type, setType] = useState('');
	const moves = useMemo(() => (all ? Object.keys(RAW.moves).filter(id => !(RAW.moves as any)[id].z && !(RAW.moves as any)[id].x) : learnset(species, gen)).map(id => moveData(id, gen)!).filter(Boolean), [species, gen, all]);
	const pow = (m: any) => m.category === 'Status' ? -1 : (m.basePower || 0);
	const shown = moves.filter(m => matches(q, m.name, m.id) && (!cat || m.category === cat) && (!type || m.type === type)).sort((a, b) => qRank(q, a.name) - qRank(q, b.name) ||
		sort === 'power' ? pow(b) - pow(a) || ko(a.name, b.name) :
		sort === 'type' ? ALL_TYPES.indexOf(a.type) - ALL_TYPES.indexOf(b.type) || pow(b) - pow(a) :
		sort === 'acc' ? (b.accuracy || 101) - (a.accuracy || 101) || ko(a.name, b.name) :
		sort === 'pp' ? b.pp - a.pp || ko(a.name, b.name) : ko(a.name, b.name));
	const types = ALL_TYPES.filter(t => moves.some(m => m.type === t));
	const setS = (v: MoveSort) => { setSort(v); save('moveSort', v); };
	return <>
		<input class="search" placeholder="기술 검색" value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} />
		<div class="sort-bar"><span>정렬</span>{([['name', '가나다'], ['power', '위력'], ['type', '타입'], ['acc', '명중'], ['pp', 'PP']] as const).map(([k, l]) =>
			<button class={sort === k ? 'on' : ''} onClick={() => setS(k)}>{l}</button>)}</div>
		<div class="sort-bar"><span>분류</span>{([['', '전체'], ['Physical', '물리'], ['Special', '특수'], ['Status', '변화']] as const).map(([k, l]) =>
			<button class={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{l}</button>)}</div>
		<div class="type-filter"><button class={!type ? 'on' : ''} onClick={() => setType('')}>전체</button>
			{types.map(t => <button class={type === t ? 'on' : ''} onClick={() => setType(type === t ? '' : t)}><TypeBadge type={t} small /></button>)}</div>
		<p class="muted small">{shown.length}개</p>
		<div class="pick-list">
			{shown.map(m => <button class="pick-row move" disabled={current.includes(m.id)} onClick={() => onPick(m.id)}>
				<span class="pm-icons"><TypeBadge type={m.type} small /><CatIcon cat={m.category} /></span>
				<span class="pick-name">{m.name}<small class="muted block">{m.desc}</small></span>
				<span class="mv-stats"><span><i>위력</i>{m.category === 'Status' ? '—' : m.basePower || '—'}</span><span><i>명중</i>{m.accuracy || '—'}</span><span><i>PP</i>{m.pp}</span></span>
			</button>)}
		</div>
	</>;
}

function AbilityPicker({ onPick }: { onPick: (id: string) => void }) {
	const [q, setQ] = useState('');
	const list = useMemo(() => Object.entries(RAW.abilities).map(([id, a]: [string, any]) => ({ id, n: a.n as string })).sort((a, b) => ko(a.n, b.n)), []);
	return <>
		<input class="search" placeholder="특성 검색" value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} />
		<div class="pick-list">{list.filter(a => matches(q, a.n, a.id)).sort((a, b) => qRank(q, a.n) - qRank(q, b.n)).map(a => <button class="pick-row" onClick={() => onPick(a.id)}>
			<span class="pick-name">{a.n}<small class="muted block">{abilityDesc(a.id)}</small></span></button>)}</div>
	</>;
}

type ItemSort = 'name' | 'popular';
function ItemPicker({ gen, onPick }: { gen: Gen; onPick: (id: string) => void }) {
	const [q, setQ] = useState('');
	const [filter, setFilter] = useState<'all' | 'battle' | 'berry' | 'mega' | 'z'>('all');
	const [sort, setSort] = useState<ItemSort>(() => load<ItemSort>('itemSort', 'popular'));
	const items = useMemo(() => allItems(gen).filter(i => !/mail$|^tr\d|^tm\d|fossil|shard/.test(i.id))
		.filter(i => filter === 'all' ? true : filter === 'mega' ? !!(i as any).mega : filter === 'z' ? !!(i as any).zt :
			filter === 'berry' ? i.id.endsWith('berry') : !(i as any).mega && !(i as any).zt && !i.id.endsWith('berry')), [gen, filter]);
	const popular = ['leftovers', 'lifeorb', 'choicescarf', 'choiceband', 'choicespecs', 'focussash', 'assaultvest', 'sitrusberry', 'lumberry', 'expertbelt', 'heavydutyboots', 'boosterenergy', 'blacksludge', 'eviolite', 'rockyhelmet', 'airballoon', 'lightclay', 'covertcloak', 'clearamulet', 'loadeddice', 'mirrorherb', 'weaknesspolicy', 'safetygoggles', 'quickclaw'];
	const shown = items.filter(i => matches(q, i.n, i.id)).sort((a, b) => {
		const r = qRank(q, a.n) - qRank(q, b.n);
		if (r) return r;
		if (sort === 'popular') {
			const pa = popular.indexOf(a.id), pb = popular.indexOf(b.id);
			const d = (pa < 0 ? 999 : pa) - (pb < 0 ? 999 : pb);
			if (d) return d;
		}
		return ko(a.n, b.n);
	});
	const setS = (v: ItemSort) => { setSort(v); save('itemSort', v); };
	return <>
		<input class="search" placeholder="도구 검색" value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} />
		<div class="sort-bar"><span>정렬</span>{([['popular', '자주 쓰는 순'], ['name', '가나다']] as const).map(([k, l]) =>
			<button class={sort === k ? 'on' : ''} onClick={() => setS(k)}>{l}</button>)}</div>
		<div class="sort-bar"><span>분류</span>{([['all', '전체'], ['battle', '지닌 도구'], ['berry', '열매'], ['mega', '메가스톤'], ['z', 'Z']] as const).map(([k, l]) =>
			<button class={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}</div>
		<div class="pick-list">
			<button class="pick-row" onClick={() => onPick('')}><span class="item-icon none" /><span class="pick-name">없음</span></button>
			{shown.map(i => <button class="pick-row" onClick={() => onPick(i.id)}>
				<ItemIcon item={i.id} />
				<span class="pick-name">{i.n}<small class="muted block">{itemDesc(i.id)}</small></span>
			</button>)}
		</div>
	</>;
}

const SP_PRESETS: [string, Partial<{ [k in StatID]: number }>][] = [
	['공격·스피드', { atk: 32, spe: 32, hp: 2 }], ['특공·스피드', { spa: 32, spe: 32, hp: 2 }],
	['HP·공격', { hp: 32, atk: 32, def: 2 }], ['HP·특공', { hp: 32, spa: 32, spd: 2 }],
	['HP·방어', { hp: 32, def: 32, spd: 2 }], ['HP·특방', { hp: 32, spd: 32, def: 2 }],
	['균형', { hp: 11, atk: 11, def: 11, spa: 11, spd: 11, spe: 11 }],
];

/** 팀 규칙 경고 (배틀타워 규칙 기준) */
function TeamWarnings({ sets }: { sets: PSet[] }) {
	const w: string[] = [];
	const items = sets.map(s => s.item).filter(Boolean);
	const dupItems = [...new Set(items.filter((it, i) => items.indexOf(it) !== i))];
	if (dupItems.length) w.push(`같은 도구가 여러 마리에게 있어요: ${dupItems.map(itemKo).join(', ')} (배틀타워 규칙에서는 금지 — 자동으로 다른 도구로 바뀝니다)`);
	const nums = sets.map(s => speciesData(toID(s.species), 9)?.num);
	if (nums.some((n, i) => nums.indexOf(n) !== i)) w.push('같은 종류의 포켓몬이 2마리 이상 있어요.');
	w.push(...teamRuleWarnings(ruleById(loadSettings().battleRule), sets));
	const noMoves = sets.filter(s => !s.moves.length).map(s => s.name);
	if (noMoves.length) w.push(`기술이 없는 포켓몬: ${noMoves.join(', ')}`);
	const megas = sets.filter(s => RAW.items[s.item]?.mega);
	if (megas.length > 1) w.push(`메가스톤이 ${megas.length}개예요. 한 배틀에 메가진화는 1번만 할 수 있어요.`);
	const wrongMega = sets.filter(s => RAW.items[s.item]?.mega && !megaStonesFor(s.species).includes(s.item));
	if (wrongMega.length) w.push(`맞지 않는 메가스톤: ${wrongMega.map(s => `${s.name}(${itemKo(s.item)})`).join(', ')}`);
	const zs = sets.filter(s => RAW.items[s.item]?.zt);
	if (zs.length > 1) w.push(`Z크리스탈이 ${zs.length}개예요. Z기술은 한 배틀에 1번만 쓸 수 있어요.`);
	const choiceStatus = sets.filter(s => /^choice/.test(s.item) && s.moves.some(m => moveData(m, 9)?.category === 'Status'));
	if (choiceStatus.length) w.push(`구애 도구 + 변화 기술: ${choiceStatus.map(s => s.name).join(', ')} (변화 기술에 묶이면 곤란해요)`);
	const av = sets.filter(s => s.item === 'assaultvest' && s.moves.some(m => moveData(m, 9)?.category === 'Status'));
	if (av.length) w.push(`돌격조끼를 들면 변화 기술을 쓸 수 없어요: ${av.map(s => s.name).join(', ')}`);
	if (sets.length && sets.length < 3) w.push('3마리 이상이어야 배틀에 쓸 수 있어요.');
	if (!w.length) return null;
	return <div class="notice">{w.map(x => <div>⚠ {x}</div>)}</div>;
}

/** 팀 상성 분석: 타입별로 약점인 포켓몬 수 / 반감 이하인 포켓몬 수 */
function TeamAnalysis({ sets }: { sets: PSet[] }) {
	const types = ALL_TYPES.filter(t => t !== 'Stellar');
	const rows = types.map(t => {
		let weak = 0, resist = 0;
		for (const s of sets) {
			const sd = speciesData(toID(s.species), 9);
			if (!sd) continue;
			let e = typeEff(t, sd.t);
			const ab = toID(s.ability);
			if ((t === 'Ground' && (ab === 'levitate' || s.item === 'airballoon')) || (t === 'Water' && ['waterabsorb', 'stormdrain', 'dryskin'].includes(ab)) ||
				(t === 'Electric' && ['voltabsorb', 'motordrive', 'lightningrod'].includes(ab)) || (t === 'Fire' && ['flashfire', 'wellbakedbody'].includes(ab)) ||
				(t === 'Grass' && ab === 'sapsipper')) e = 0;
			if (e > 1) weak++; else if (e < 1) resist++;
		}
		return { t, weak, resist };
	});
	const danger = rows.filter(r => r.weak >= 3 || (r.weak >= 2 && r.resist === 0));
	const cover = new Set<string>();
	for (const s of sets) for (const m of s.moves) { const md = moveData(m, 9); if (md && md.category !== 'Status') cover.add(md.type); }
	const unhit = types.filter(def => ![...cover].some(atk => typeEff(atk, [def]) > 1));
	return <div class="team-analysis">
		<h3 class="sec">팀 상성 분석</h3>
		<div class="ta-grid">{rows.map(r => <div class={'ta-cell' + (r.weak >= 3 ? ' bad' : r.weak >= 2 && r.resist === 0 ? ' warn' : '')}>
			<TypeBadge type={r.t} small /><span class="ta-w">약 {r.weak}</span><span class="ta-r">반 {r.resist}</span></div>)}</div>
		{danger.length > 0 && <p class="small">⚠ 주의할 약점: {danger.map(r => typeKo(r.t)).join(', ')}</p>}
		<p class="small muted">공격 기술 타입 {cover.size}종 · 효과 굉장으로 찌를 수 없는 타입: {unhit.length ? unhit.map(typeKo).join(', ') : '없음'}</p>
	</div>;
}
