/** 설정 → 포켓몬 그림 바꾸기: 포켓몬마다 앞·뒤 × 일반·색이 다른 모습 그림을 내 그림 파일로 */
import { h } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { Modal, Sprite, toast } from './core';
import { RAW, spriteId, speciesKo } from '../data';
import { getUserSprite, listUserSprites, removeUserSprite, setUserSprite, userSpriteKey, clearUserSprites } from '../user-sprites';
import { exportOriginalOne, exportOriginalAll, exportMine, importFiles } from '../sprite-pack';
import { confirmBox } from './core';

/** 파일 고르기 (여러 장 가능) — 문서에 잠깐 붙였다가 뗌 (안드로이드 WebView 대응) */
function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
	return new Promise(ok => {
		const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept; inp.multiple = multiple;
		inp.style.cssText = 'position:fixed;left:-9999px;opacity:0';
		document.body.appendChild(inp);
		inp.onchange = () => { const fs = [...(inp.files || [])]; inp.remove(); ok(fs); };
		inp.click();
	});
}

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
	const [busy, setBusy] = useState('');
	/** 오래 걸리는 작업: 진행 문구를 보이고 끝나면 알림 */
	const run = async (f: (p: (m: string) => void) => Promise<string>) => { if (busy) return; setBusy('준비 중…'); try { toast(await f(setBusy)); } catch (e: any) { toast(e?.message || '실패했습니다'); } finally { setBusy(''); force(x => x + 1); } };
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
			// 안드로이드 WebView 에서도 열리도록 문서에 잠깐 붙였다가 뗌 (앱은 MainActivity.onShowFileChooser 가 파일 고르기를 엶)
			const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
			inp.style.cssText = 'position:fixed;left:-9999px;opacity:0';
			document.body.appendChild(inp);
			inp.onchange = async () => {
				const f = inp.files?.[0]; inp.remove(); if (!f) return;
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
						{mine && <button onClick={async () => { await removeUserSprite(key); force(x => x + 1); }}>원래대로</button>}
					</div>
				</div>;
			})}</div>
			<div class="seg"><button disabled={!!busy} onClick={() => run(async p => `원본 ${await exportOriginalOne(sid, p)}장을 zip 으로 저장했습니다`)}>⬇ 이 포켓몬 원본 추출</button></div>
			{busy && <p class="muted small">{busy}</p>}
			<button class="btn" onClick={() => setSel(null)}>◀ 다른 포켓몬</button>
		</Modal>;
	}
	return <Modal title="포켓몬 그림 바꾸기" onClose={onClose}>
		<div class="us-tools">
			<button disabled={!!busy} onClick={() => run(async p => `원본 ${await exportOriginalAll(p)}장을 zip 으로 저장했습니다`)}>⬇ 원본 전체 추출</button>
			<button disabled={!!busy} onClick={() => run(async () => `내 그림 ${await exportMine()}장을 zip 으로 저장했습니다`)}>⬇ 내 그림 내보내기</button>
			<button disabled={!!busy} onClick={() => run(async p => {
				const fs = await pickFiles('.zip,application/zip,image/*', true); if (!fs.length) return '취소했습니다';
				const [n, sk] = await importFiles(fs, p);
				return `${n}장을 적용했습니다` + (sk.length ? ` (건너뜀 ${sk.length}: ${sk.slice(0, 3).join(', ')}${sk.length > 3 ? ' …' : ''})` : '');
			})}>⬆ 일괄 적용 (zip·여러 장)</button>
			{changed.length > 0 && <button class="danger" disabled={!!busy} onClick={() => run(async () => { if (!(await confirmBox('내 그림 모두 지우기', `바꾼 그림 ${listUserSprites().length}장을 모두 원래대로 돌릴까요?`, '모두 지우기', '취소'))) return '취소했습니다'; await clearUserSprites(); return '모두 원래대로 돌렸습니다'; })}>모두 원래대로</button>}
		</div>
		{busy ? <p class="muted small">{busy}</p> : <p class="muted small">zip 구조: gen5/(앞) · gen5-back/(뒤) · gen5-shiny/ · gen5-back-shiny/ 폴더 안에 '그림이름.png'. 원본 전체를 추출해 그림을 고친 뒤 그 zip 을 그대로 일괄 적용하면 돼요. 폴더 없이 'pikachu-back.png' 같은 이름의 그림 여러 장도 됩니다.</p>}
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
