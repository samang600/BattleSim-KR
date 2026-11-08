/** 업데이트 소식 창 (웹): 지난번에 본 버전 이후의 모든 항목 (설정 › 정보에서는 전체) */
import { h } from 'preact';
import { Modal } from './core';
import { CHANGELOG, APP_VERSION, verLess, type ChangeTag } from '../changelog';
import { load, save } from '../store';

const TAG: { [k in ChangeTag]: [string, string] } = { new: ['새 기능', '#23a05a'], up: ['개선', '#2f6fe8'], fix: ['수정', '#c0283c'] };
const KEY = 'seenVersion';

/** 보여 줄 항목 (없으면 null). 처음 온 사람은 보여 주지 않고 지금 버전만 기록 */
export function pendingChanges() {
	const seen = load<string>(KEY, '');
	if (!seen) { save(KEY, APP_VERSION); return null; }
	if (!verLess(seen, APP_VERSION)) return null;
	const list = CHANGELOG.filter(c => verLess(seen, c.ver) && !verLess(APP_VERSION, c.ver));
	return list.length ? list : (save(KEY, APP_VERSION), null);
}
export function markSeen() { save(KEY, APP_VERSION); }

/** all: 설정에서 열 때 — 지금까지의 모든 소식 */
export function WhatsNew({ onClose, all }: { onClose: () => void; all?: boolean }) {
	const seen = load<string>(KEY, '');
	const list = all ? CHANGELOG.filter(c => !verLess(APP_VERSION, c.ver)) : CHANGELOG.filter(c => verLess(seen, c.ver) && !verLess(APP_VERSION, c.ver));
	const close = () => { markSeen(); onClose(); };
	return <Modal title={all ? `업데이트 소식 (지금 v${APP_VERSION})` : `업데이트 소식 · v${APP_VERSION}`} onClose={close}>
		{!all && seen && <p class="wn-since">v{seen} 이후 바뀐 점</p>}
		<div class="wn">{list.map(c => <section class="wn-ver">
			<h3 class="wn-h"><b>v{c.ver}</b> {c.title}<small>{c.date}</small></h3>
			<ul class="wn-list">{c.items.map(([t, s]) => <li><span class="wn-tag" style={{ '--tc': TAG[t][1] } as any}>{TAG[t][0]}</span><span>{s}</span></li>)}</ul>
		</section>)}</div>
		<button class="btn primary big wn-ok" onClick={close}>확인</button>
	</Modal>;
}
