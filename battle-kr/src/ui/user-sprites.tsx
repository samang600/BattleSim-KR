/** 설정 → 포켓몬 그림 바꾸기: 포켓몬마다 앞·뒤 × 일반·색이 다른 모습 그림을 내 그림 파일로 */
import { h } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { Modal, Sprite, toast } from './core';
import { RAW, spriteId, speciesKo } from '../data';
import { getUserSprite, listUserSprites, removeUserSprite, setUserSprite, userSpriteKey } from '../user-sprites';

const SLOTS: [string, boolean, boolean][] = [['앞모습', false, false], ['뒷모습', true, false], ['색이 다른 앞모습', false, true], ['색이 다른 뒷모습', true, true]];

/** 그림 id(sprite id) → 대표 포켓몬 id (목록에 이름 표시용) */
function speciesOfSprite(sid: string) {
	for (const id in RAW.species) if (spriteId(id) === sid) return id;
	return sid;
}

export function UserSpritesModal({ onClose }: { onClose: () => void }) {
	const [q, setQ] = useState('');
	const [sel, setSel] = useState<string | null>(null);
	const [, force] = useState(0);
	const changed = [...new Set(listUserSprites().map(k => k.replace(/-back|-shiny/g, '')))];
	const results = useMemo(() => {
		const t = q.trim(); if (!t) return [];
		const out: { id: string; n: string; num: number }[] = [];
		for (const [id, s] of Object.entries(RAW.species as any) as [string, any][]) {
			if (!s.g?.['9'] && !s.g?.[9]) continue;
			if (s.n?.includes(t) || id.includes(t.toLowerCase())) out.push({ id, n: s.n, num: s.num });
			if (out.length >= 40) break;
		}
		return out;
	}, [q]);

	if (sel) {
		const sid = spriteId(sel);
		const pick = (back: boolean, shiny: boolean) => {
			const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/gif,image/webp,image/*';
			inp.onchange = async () => {
				const f = inp.files?.[0]; if (!f) return;
				try { await setUserSprite(userSpriteKey(sid, back, shiny), f); toast('그림을 바꿨습니다'); force(x => x + 1); }
				catch (e: any) { toast(e?.message || '그림을 읽지 못했습니다'); }
			};
			inp.click();
		};
		return <Modal title={`${speciesKo(sel)} 그림`} onClose={onClose}>
			<p class="muted small">정지 도트 그림 설정에서는 이 그림이 먼저 나오고, 3D 그림 설정에서는 그림을 받을 수 없을 때(오프라인 등) 이름 카드 대신 나옵니다. 정수배로 키운 도트 그림은 원래 크기로, 큰 그림은 96×96 칸에 맞춰 넣습니다.</p>
			<div class="us-grid">{SLOTS.map(([label, back, shiny]) => {
				const key = userSpriteKey(sid, back, shiny), mine = !!getUserSprite(key);
				return <div class="us-slot" key={key + mine}>
					<div class="us-pic"><Sprite species={sel} back={back} shiny={shiny} anim={false} size={96} /></div>
					<b>{label}</b>{mine && <small class="tag">내 그림</small>}
					<div class="seg">
						<button onClick={() => pick(back, shiny)}>바꾸기</button>
						{mine && <button onClick={() => { removeUserSprite(key); force(x => x + 1); }}>원래대로</button>}
					</div>
				</div>;
			})}</div>
			<button class="btn" onClick={() => setSel(null)}>◀ 다른 포켓몬</button>
		</Modal>;
	}
	return <Modal title="포켓몬 그림 바꾸기" onClose={onClose}>
		<input placeholder="포켓몬 이름으로 찾기 (예: 페로코체)" value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} />
		<div class="us-list">{results.map(r => <button class="pick-row" onClick={() => setSel(r.id)}>
			<span class="us-thumb"><Sprite species={r.id} anim={false} size={40} /></span><span class="pick-name">{r.n}<small class="muted"> #{r.num}</small></span></button>)}</div>
		{!q && changed.length > 0 && <>
			<h3 class="sec">바꾼 그림</h3>
			<div class="us-list">{changed.map(sid => { const id = speciesOfSprite(sid); return <button class="pick-row" onClick={() => setSel(id)}>
				<span class="us-thumb"><Sprite species={id} anim={false} size={40} /></span><span class="pick-name">{speciesKo(id)}<small class="muted"> {listUserSprites().filter(k => k.replace(/-back|-shiny/g, '') === sid).length}장</small></span></button>; })}</div>
		</>}
		{!q && !changed.length && <p class="muted small">이름을 입력해 포켓몬을 고르면 앞·뒤·색이 다른 모습 그림을 내 그림 파일로 바꿀 수 있어요.</p>}
	</Modal>;
}
