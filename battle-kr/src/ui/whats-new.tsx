/** 업데이트 소식 창 (웹): 지난번에 본 버전보다 새 항목만, 최신 3개까지 간결하게 */
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
	const list = CHANGELOG.filter(c => verLess(seen, c.ver) && !verLess(APP_VERSION, c.ver)).slice(0, 3);
	return list.length ? list : (save(KEY, APP_VERSION), null);
}
export function markSeen() { save(KEY, APP_VERSION); }

export function WhatsNew({ onClose }: { onClose: () => void }) {
	const list = CHANGELOG.filter(c => verLess(load<string>(KEY, ''), c.ver) && !verLess(APP_VERSION, c.ver)).slice(0, 3);
	const close = () => { markSeen(); onClose(); };
	return <Modal title={`업데이트 소식 · v${APP_VERSION}`} onClose={close}>
		<div class="wn">{list.map(c => <section class="wn-ver">
			<h3 class="wn-h"><b>v{c.ver}</b> {c.title}<small>{c.date}</small></h3>
			<ul class="wn-list">{c.items.map(([t, s]) => <li><span class="wn-tag" style={{ '--tc': TAG[t][1] } as any}>{TAG[t][0]}</span><span>{s}</span></li>)}</ul>
		</section>)}</div>
		<button class="btn primary big wn-ok" onClick={close}>확인</button>
	</Modal>;
}
