#!/usr/bin/env node
/* 포켓몬 배틀 데이터베이스(PokéDB, sv.pokedb.tokyo)가 공개하는 스칼렛·바이올렛 랭크배틀 상위 구축 데이터를 받아
 * src/gen/pokedb-teams.json 으로 줄인다. (상위 트레이너가 실제로 쓴 6마리 · 도구 · 테라타입. 기술·노력치는 없어서 Smogon 통계로 채움)
 * PokéDB 안내에 따라 앱 사용자 기기에서 직접 받지 않고, 빌드 때 한 번 받아 앱에 넣는다.
 * 전설(금지급·환상) 포함 규칙 시즌과 제외 규칙 시즌을 나눠, 최근 것부터 시즌마다 상위 몇 팀씩 고르고 같은 팀은 하나만 남긴다.
 * 사용: node battle-kr/scripts/fetch-pokedb.cjs   (저장소 루트에서 `node build` 로 dist 가 있어야 함) */
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const OUT = path.join(HERE, '../src/gen/pokedb-teams.json');
const { Dex } = require(path.join(HERE, '../../dist/sim'));
const UA = { 'User-Agent': 'battle-kr build script (offline bundle)' };
// 시즌마다 상위 몇 팀 / 전체 상한 (전설 포함 팀·제외 팀 따로)
const PER_SEASON = { s: 60, d: 30 };
const CAP = { s: { leg: 240, noleg: 480 }, d: { leg: 100, noleg: 200 } };

const toID = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const TERA = { ノーマル: 'Normal', ほのお: 'Fire', みず: 'Water', でんき: 'Electric', くさ: 'Grass', こおり: 'Ice', かくとう: 'Fighting', どく: 'Poison',
	じめん: 'Ground', ひこう: 'Flying', エスパー: 'Psychic', むし: 'Bug', いわ: 'Rock', ゴースト: 'Ghost', ドラゴン: 'Dragon', あく: 'Dark', はがね: 'Steel',
	フェアリー: 'Fairy', ステラ: 'Stellar' };

async function get(url) {
	const r = await fetch(url, { headers: UA });
	if (!r.ok) throw new Error(url + ' ' + r.status);
	return r.text();
}
function csv(text) {
	const rows = text.trim().split(/\r?\n/).map(l => l.split(','));
	const head = rows.shift();
	return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

(async () => {
	// 1) 일본어 도구 이름 → 쇼다운 id (PokeAPI 이름표: 언어 1=ja-Hrkt, 11=ja)
	const base = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';
	const items = Object.fromEntries(csv(await get(base + 'items.csv')).map(r => [r.id, toID(r.identifier)]));
	const itemJa = {};
	for (const r of csv(await get(base + 'item_names.csv'))) {
		if ((r.local_language_id === '1' || r.local_language_id === '11') && items[r.item_id]) itemJa[r.name] = items[r.item_id];
	}
	const dex = Dex.mod('gen9');
	const itemId = ja => {
		if (!ja) return '';
		const id = itemJa[ja];
		return id && dex.items.get(id).exists ? dex.items.get(id).id : '';
	};
	// 2) "0479-02" → 'rotomwash' (쇼다운 formeOrder 가 공식 폼 번호 순서)
	const byNum = {};
	for (const s of dex.species.all()) if (s.num > 0 && !s.forme) byNum[s.num] = s;
	const speciesId = (code) => {
		const [n, f] = code.split('-').map(x => parseInt(x, 10));
		const b = byNum[n];
		if (!b) return '';
		const name = (b.formeOrder || [b.name])[f || 0] || b.name;
		const sp = dex.species.get(name);
		return sp.exists ? sp.id : b.id;
	};
	// 3) 공개 시즌 목록
	const html = await get('https://sv.pokedb.tokyo/guide/opendata');
	const seasons = [...new Set([...html.matchAll(/s(\d+)_single_ranked_teams\.json/g)].map(m => +m[1]))].sort((a, b) => b - a);
	const out = { _source: 'PokéDB (sv.pokedb.tokyo) 上位構築データ', _seasons: seasons, s: [], d: [] };
	let miss = { item: new Set(), species: new Set() };
	const isLeg = id => { const t = dex.species.get(id).tags || []; return t.includes('Restricted Legendary') || t.includes('Mythical'); };
	const seen = new Set();
	const count = { s: { leg: 0, noleg: 0 }, d: { leg: 0, noleg: 0 } };
	for (const season of seasons) {
		for (const [rule, key] of [['single', 's'], ['double', 'd']]) {
			let data;
			try { data = JSON.parse(await get(`https://sv.pokedb.tokyo/opendata/s${season}_${rule}_ranked_teams.json`)); } catch (e) { console.log('없음', season, rule, e.message); continue; }
			let taken = 0;
			for (const t of (data.teams || []).sort((a, b) => a.rank - b.rank)) {
				if (taken >= PER_SEASON[key]) break;
				const team = (t.team || []).map(m => {
					const sid = speciesId(m.id);
					const it = itemId(m.item);
					if (!sid) miss.species.add(m.id + m.pokemon);
					if (m.item && !it) miss.item.add(m.item);
					return [sid, it, TERA[m.terastal] || ''];
				}).filter(x => x[0]);
				if (team.length !== 6) continue;
				const sig = key + team.map(m => m[0] + '@' + m[1]).sort().join('|');
				if (seen.has(sig)) continue; // 같은 트레이너가 같은 팀으로 여러 번 오른 경우
				const kind = team.some(m => isLeg(m[0])) ? 'leg' : 'noleg';
				if (count[key][kind] >= CAP[key][kind]) continue;
				seen.add(sig); count[key][kind]++; taken++;
				out[key].push([Math.round(t.rating_value), season, team]);
			}
			await new Promise(r => setTimeout(r, 400)); // 서버 부담을 줄이려고 천천히
		}
	}
	fs.writeFileSync(OUT, JSON.stringify(out));
	console.log('pokedb-teams.json: 시즌', seasons.length, '개 · 싱글', out.s.length, JSON.stringify(count.s), '더블', out.d.length, JSON.stringify(count.d), (fs.statSync(OUT).size / 1024).toFixed(0), 'KB');
	if (miss.species.size) console.log('종 못 찾음:', [...miss.species].slice(0, 20).join(' '));
	if (miss.item.size) console.log('도구 못 찾음:', [...miss.item].slice(0, 30).join(' '));
})();
