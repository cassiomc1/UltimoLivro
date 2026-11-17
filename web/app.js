'use strict';
/* Lastbook front end. Plain JS, no external resources. Talks only to the local server. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fileUrl = p => '/' + String(p || '').split('/').map(encodeURIComponent).join('/');
const main = $('#main');
const IN_WINDOW = location.protocol === 'lastbook:' || location.hostname === 'lastbook.invalid';   // the desktop app, not a browser over the server

/* ---------------------------------------------------------------- icons -- */
const I = {
  water: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9 14a3 3 0 0 0 3 3"/>',
  hurt: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M12 10v7M8.5 13.5h7"/>',
  food: '<path d="M4 11h16a8 8 0 0 1-16 0zM8 7c0-1 1-1 1-2M12 7c0-1 1-1 1-2M16 7c0-1 1-1 1-2"/>',
  power: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  shelter: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0zM12 9v8"/>',
  sanitation: '<path d="M7 3h10v6H7zM5 9h14l-2 6H7zM9 15l-1 6h8l-1-6"/>',
  disaster: '<path d="M12 3 2 20h20zM12 10v4M12 17h.01"/>',
  comms: '<path d="M5 12a7 7 0 0 1 14 0M8 12a4 4 0 0 1 8 0"/><circle cx="12" cy="12" r="1.5"/><path d="M12 13.5V21M9 21h6"/>',
  grow: '<path d="M12 21v-9M12 12c0-4 3-7 8-7 0 5-3 7-8 7zM12 14c0-3-2-5-7-5 0 4 2 5 7 5z"/>',
  preserve: '<path d="M8 3h8v3H8zM7 6h10l1 3v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9z"/><path d="M6 12h12"/>',
  health: '<path d="M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11z"/><path d="M8 12h2l1-2 2 4 1-2h2"/>',
  energy: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  land: '<path d="M3 20 9 9l4 6 3-4 5 9z"/><circle cx="17" cy="6" r="2"/>',
  repair: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 6.3-6.3a4 4 0 0 0-5-5L9 9 6 6l2-2"/><path d="M4 20l5-5"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-1 .2"/><path d="M20 4v14h-7"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  wiki: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  page: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h7M9 17h7"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', back: '<path d="M15 18 9 12l6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  warn: '<path d="M12 3 2 20h20zM12 10v4M12 17h.01"/>', save: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>', prep: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
  shelf: '<path d="M4 4v16M9 4v16M14 5l4 15M3 20h18"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  play: '<path d="M7 4v16l13-8z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  insp: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M15 5v14"/>',
  ask: '<path d="M4 5h16v11H9l-5 4z"/><path d="M9 9.5h6M9 12.5h4"/>', spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  translate: '<path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/>',
  vault: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1.5"/>',
  check: '<path d="M12 2 3 6v6c0 5 3.8 9.3 9 10 5.2-.7 9-5 9-10V6z"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.9 17.9A10.9 10.9 0 0 1 12 19c-6.5 0-10-7-10-7a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2M2 2l20 20"/>',
  swap: '<path d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
};
const ico = (n, cls = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" class="${cls}">${I[n] || I.book}</svg>`;
const KIND_ICO = { pdf: 'page', html: 'page', video: 'video', transcript: 'video', pptx: 'page', zim: 'wiki' };
// One colour per guide, used for its tile, header and cards.
const TC = { hurt: '#c62828', water: '#1565c0', power: '#c77700', food: '#d4570f', shelter: '#7b3fa0', sanitation: '#7a5232', disaster: '#b23c17', comms: '#00796b',
  grow: '#2e7d32', preserve: '#a0661a', health: '#c2185b', repair: '#455a64', energy: '#e09400', land: '#5d7a2e' };
// Nomes curtos para os cards; o título completo aparece na página do guia.
const SHORT = { hurt: 'Ferimentos e doenças', water: 'Água potável', power: 'Sem energia', food: 'Comida e preparo', shelter: 'Frio ou calor extremo', sanitation: 'Banheiro e higiene',
  disaster: 'Desastres e riscos', comms: 'Comunicação e rotas', grow: 'Cultivar alimentos', preserve: 'Conservar alimentos', health: 'Cuidados de saúde', repair: 'Consertar e construir', energy: 'Sistemas de energia', land: 'Terra e recursos' };
const tcStyle = id => `style="--tc:${TC[id] || '#1a6b55'}"`;

/* ------------------------------------------------------------ storage -- */
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('sg.' + k)) ?? d } catch { return d } },
  set(k, v) { try { localStorage.setItem('sg.' + k, JSON.stringify(v)) } catch { } },
};
// A row as the lists show it: its title and the subtitle under it. Two rows that read the same are one row, whatever their keys.
const rowSub = x => x.sub && x.sub !== x.title ? x.sub : x.key[0] === 'w' ? 'Enciclopédia' : '';
const rowId = x => x.title + '|' + rowSub(x);
function remember(item) {  // {key,title,href,sub}
  const r = store.get('recent', []).filter(x => x.key !== item.key && rowId(x) !== rowId(item));
  r.unshift({ ...item, at: Date.now() });
  store.set('recent', r.slice(0, 40));
}
const isSaved = key => store.get('saved', []).some(x => x.key === key);
function savedCount() { const el = $('#savedN'); if (el) el.textContent = store.get('saved', []).length || '' }
function toggleSave(item, btn) {
  let s = store.get('saved', []);
  if (s.some(x => x.key === item.key)) { s = s.filter(x => x.key !== item.key); toast('Removido de Salvos') }
  else { s.unshift({ ...item, at: Date.now() }); toast('Salvo neste dispositivo') }
  store.set('saved', s);
  savedCount();
  if (btn) { btn.setAttribute('aria-pressed', isSaved(item.key)); const sp = $('span', btn); if (sp) sp.textContent = isSaved(item.key) ? 'Salvo' : 'Salvar' }
}
const saveButton = item => `<button class="btn plain" title="Salvar" data-save='${esc(JSON.stringify(item))}' aria-pressed="${isSaved(item.key)}">${ico('save')}<span>${isSaved(item.key) ? 'Salvo' : 'Salvar'}</span></button>`;
document.addEventListener('click', e => { const b = e.target.closest('[data-save]'); if (b) toggleSave(JSON.parse(b.dataset.save), b) });
let toastT;
function toast(msg) {
  let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t) }
  t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2200);
}
// Video watch progress: {id: {t, d, title, thumb, at}}
const vprog = () => store.get('vprog', {});
// This device's history is kept for every library opened on it (each download is its own library): show only what the open one holds
const HELD = {};
const held = ids => Promise.all(ids.map(id => HELD[id] ?? (HELD[id] = fetch('/api/doc/' + encodeURIComponent(id)).then(r => r.status !== 404 && r.status !== 400).catch(() => true)))).then(ok => ids.filter((_, i) => ok[i]));
async function resumable(n = 60) {
  const list = Object.entries(vprog()).filter(([, v]) => v.t > 10 && (!v.d || v.t < v.d - 15)).sort((a, b) => b[1].at - a[1].at).slice(0, n);
  const ok = new Set(await held(list.map(([id]) => id)));
  return list.filter(([id]) => ok.has(id));
}
async function recents() {   // documents and videos from another library leave the list; guides and articles stay
  const r = store.get('recent', []), ids = r.filter(x => /^[dv]:/.test(x.key)).map(x => x.key.slice(2));
  const ok = new Set(await held(ids)), seen = new Set();
  return r.filter(x => (!/^[dv]:/.test(x.key) || ok.has(x.key.slice(2))) && !seen.has(rowId(x)) && seen.add(rowId(x)));
}
function setVprog(id, data) { const p = vprog(); p[id] = { ...(p[id] || {}), ...data, at: Date.now() }; const keys = Object.keys(p).sort((a, b) => p[b].at - p[a].at).slice(0, 60); store.set('vprog', Object.fromEntries(keys.map(k => [k, p[k]]))) }

/* --------------------------------------------------------------- data -- */
async function api(u, opts) {
  const r = await fetch(u, opts);
  let d; try { d = await r.json() } catch { throw new Error('A biblioteca enviou uma resposta ilegível.') }
  if (!r.ok || (d && d.error && !Array.isArray(d))) throw new Error(d && d.error || ('Erro do servidor ' + r.status));
  return d;
}
let LIB = null;
const libInfo = () => LIB || (LIB = api('/api/library').catch(() => { LIB = null; return {} }));   // what this library holds; a failed ask is asked again. An older server leaves out zims, pins and sources: then everything stays offered.
let TOPICS = null;
async function topics() {
  if (TOPICS) return TOPICS;
  try { TOPICS = await api('/api/topics'); store.set('topicsCache', TOPICS) }
  catch (e) { TOPICS = store.get('topicsCache', null); if (!TOPICS) throw e }
  return TOPICS;
}
const topicById = id => (TOPICS || []).find(t => t.id === id);
const NOW_ORDER = ['hurt', 'water', 'power', 'food', 'shelter', 'sanitation', 'disaster', 'comms'];
const LEARN_ORDER = ['grow', 'preserve', 'health', 'repair', 'energy', 'land'];
const nowTopics = () => NOW_ORDER.map(topicById).filter(Boolean).concat((TOPICS || []).filter(t => t.mode === 'now' && !NOW_ORDER.includes(t.id)));
const learnTopics = () => LEARN_ORDER.map(topicById).filter(Boolean).concat((TOPICS || []).filter(t => t.mode === 'learn' && !LEARN_ORDER.includes(t.id)));

/* ------------------------------------------------------------ helpers -- */
const fmtDur = s => { if (!s) return ''; s = Math.round(s); const h = s / 3600 | 0, m = (s % 3600) / 60 | 0; return h ? `${h} h ${m} min` : m ? `${m} min` : `${s} s` };
const clock = s => { s = Math.max(0, Math.round(s || 0)); const h = s / 3600 | 0, m = (s % 3600) / 60 | 0, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0') };
const here = () => location.hash || '#/videos';
const fromQ = () => 'from=' + encodeURIComponent(here());
const pageImg = (id, p, w) => `/api/page/${encodeURIComponent(id)}/${p || 1}.png?w=${w}`;
const hostOf = u => { try { return new URL(u).host } catch { return u } };   // a web address shown as its site only
const askLink = (about, label = 'Perguntar sobre isto') => `<a class="btn plain" title="${esc(label)}" href="#/ask?about=${encodeURIComponent(about)}&${fromQ()}">${ico('ask')}<span>${label}</span></a>`;

function hrefFor(item, src) {
  src = src || item.src || item;
  if (item.zim) return '#/wiki/' + item.zim.replace(/^\/?zim\//, '') + '?' + fromQ();
  if (!src || !src.id) return '#/';
  if (src.kind === 'video') return `#/watch/${encodeURIComponent(src.id)}?${item.t ? 't=' + item.t + '&' : ''}${fromQ()}`;
  return `#/read/${encodeURIComponent(src.id)}?${item.page ? 'p=' + item.page + '&' : ''}${fromQ()}`;
}
function srcText(s, page) {
  if (!s) return 'Fonte não encontrada nesta cópia da biblioteca';
  const bits = [`<strong>${esc(s.publisher || s.collection || 'Publicação desconhecida')}</strong>`];
  if (s.year) bits.push(esc(s.year));
  if (page) bits.push('página ' + page + (s.pages ? ' de ' + s.pages : ''));
  else if (s.kind === 'pdf' && s.pages) bits.push(s.pages + ' páginas');
  if (s.duration) bits.push(fmtDur(s.duration) + (s.transcript ? ' · transcrição' : ''));
  return bits.join(' · ');
}
// A reading card shows a picture of what you'll open: the actual page, the video frame, or an encyclopedia mark.
function rcard(item) {
  const s = item.src;
  let pv;
  if (item.zim) pv = `<span class="pv w">${ico('wiki')}</span>`;
  else if (s && s.kind === 'video') pv = `<span class="pv v">${s.thumb ? `<img loading="lazy" alt="" src="${fileUrl(s.thumb)}">` : ''}<span class="play"><span>${ico('play')}</span></span>${s.duration ? `<span class="pg">${clock(s.duration)}</span>` : ''}</span>`;
  else if (s && s.kind === 'pdf') pv = `<span class="pv"><img loading="lazy" alt="" src="${pageImg(s.id, item.page, 360)}" onerror="this.remove()"><span class="pg">${item.page ? 'p. ' + item.page : 'PDF'}</span></span>`;
  else pv = `<span class="pv w">${ico('page')}</span>`;
  const label = item.label || item.title || (s && s.title);
  const src = item.zim ? `<strong>Enciclopédia</strong> · ${esc(item.title || '')} · colaborativo` : `${s ? 'De “' + esc(s.title) + '” · ' : ''}${srcText(s, item.page)}<br>${esc(s ? s.trust : '')}`;
  return `<a class="rcard" href="${hrefFor(item)}">${pv}<span><b>${esc(label)}</b>${item.note ? `<p>${esc(item.note)}</p>` : ''}<span class="src">${src}</span></span></a>`;
}
function rowItem(item) {
  const s = item.src || null;
  let k = ico(item.zim ? 'wiki' : s ? KIND_ICO[s.kind] : 'page');
  if (s && s.kind === 'video' && s.thumb) k = `<img loading="lazy" alt="" src="${fileUrl(s.thumb)}">`;
  else if (s && s.kind === 'pdf' && (item.page || item.preview)) k = `<img loading="lazy" alt="" src="${pageImg(s.id, item.page, 200)}" onerror="this.remove()">`;
  const sub = item.zim ? 'Artigo de enciclopédia · colaborativo' : srcText(s, item.page);
  return `<li><a class="row" href="${hrefFor(item)}"><span class="k">${k}</span><span><b>${esc(item.label || item.title || (s && s.title))}</b><small>${sub}</small></span></a></li>`;
}
function vcard(v, opts = {}) {
  const p = vprog()[v.id];
  const pct = p && p.t && (v.duration || p.d) ? Math.min(100, 100 * p.t / (v.duration || p.d)) : 0;
  return `<a class="vcard" href="#/watch/${encodeURIComponent(v.id)}?${fromQ()}" ${opts.style || ''}>
    <span class="vthumb">${v.thumb ? `<img loading="lazy" alt="" src="${fileUrl(v.thumb)}" onerror="this.remove()">` : `<span class="ph">${ico('video')}</span>`}
      ${v.transcript ? '<span class="cc" title="Tem transcrição">CC</span>' : ''}${v.duration ? `<span class="dur">${clock(v.duration)}</span>` : ''}${pct > 2 ? `<span class="prog" style="width:${pct}%"></span>` : ''}<span class="play">${ico('play')}</span></span>
    <b>${esc(v.title)}</b><span class="vm">${esc(opts.sub || v.publisher || '')}</span></a>`;
}
function rail(html, cls = '') {
  return `<div class="rail-wrap"><button class="rail-btn l" aria-label="Rolar para a esquerda" hidden>${ico('back')}</button><div class="rail ${cls}">${html}</div><button class="rail-btn r" aria-label="Rolar para a direita">${ico('right')}</button></div>`;
}
function wireRails(root = main) {
  $$('.rail-wrap', root).forEach(w => {
    const r = $('.rail', w), l = $('.rail-btn.l', w), rb = $('.rail-btn.r', w);
    const upd = () => { l.hidden = r.scrollLeft < 10; rb.hidden = r.scrollLeft + r.clientWidth > r.scrollWidth - 10 };
    l.onclick = () => r.scrollBy({ left: -r.clientWidth * .85, behavior: 'smooth' });
    rb.onclick = () => r.scrollBy({ left: r.clientWidth * .85, behavior: 'smooth' });
    r.addEventListener('scroll', upd, { passive: true }); upd();
  });
}
const secHead = (title, sub, link) => `<div class="sec-head"><div><h2>${title}</h2>${sub ? `<span class="sub">${sub}</span>` : ''}</div>${link || ''}</div>`;
function crumbs(list) {
  return `<nav class="crumbs" aria-label="Você está aqui">${list.map((c, i) => i < list.length - 1 ? `<a href="${c[1]}">${esc(c[0])}</a><span aria-hidden="true">›</span>` : `<span aria-current="page">${esc(c[0])}</span>`).join('')}</nav>`;
}
function backButton(from, fallback = 'Voltar') {
  let label = fallback, href = from || '#/';
  const m = /^#\/t\/([\w-]+)/.exec(href);
  if (m && topicById(m[1])) label = SHORT[m[1]] || topicById(m[1]).title;
  else if (href.startsWith('#/search')) label = 'Resultados da busca';
  else if (href.startsWith('#/ask')) label = 'Voltar ao chat';
  else if (href.startsWith('#/saved')) label = 'Salvos';
  else if (href.startsWith('#/map')) label = 'Mapa';
  else if (href.startsWith('#/videos')) label = 'Vídeos';
  else if (href.startsWith('#/watch')) label = 'Vídeo';
  else if (href.startsWith('#/read')) label = 'Voltar à página';
  else if (href.startsWith('#/library') || href.startsWith('#/shelf') || href.startsWith('#/collection') || href.startsWith('#/encyclopedias') || href.startsWith('#/prepare')) label = 'Biblioteca';
  else if (href === '#/' || href === '#') label = 'Vídeos';
  return `<a class="back" href="${esc(href)}" data-back>${ico('back')}<span>${esc(label)}</span></a>`;
}
// Links into readers carry where you came from; refresh it at click time (sections may have opened since render).
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#/read/"],a[href^="#/watch/"],a[href^="#/wiki/"],a[href^="#/collection"],a[href^="#/ask?about"]');
  if (!a || a.hasAttribute('data-back')) return;
  const h = a.getAttribute('href'), i = h.indexOf('from=');
  if (i > -1) a.setAttribute('href', h.slice(0, i) + 'from=' + encodeURIComponent(here()));
}, true);
// Prefer real history so scroll position and open sections come back exactly (not inside encyclopedia frames).
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-back]');
  if (a && !location.hash.startsWith('#/wiki/') && navAt > 0 && navStack[navAt - 1] === a.getAttribute('href')) { e.preventDefault(); history.back() }
});
function errorBox(e, what) {
  return `<div class="err" role="alert"><b>${esc(what || 'Algo deu errado.')}</b><br>${esc(e.message || e)}
  <br><span class="small">Se isso continuar acontecendo, feche o Último Livro e abra novamente.</span></div>`;
}
// The window title, and on reading pages the toolbar's title and the line under it.
// bar: what the toolbar shows when it is not the page's own title (an article names itself; the toolbar names the encyclopedia).
const setTitle = (t, sub, bar) => { document.title = t ? t + ' · Último Livro' : 'Último Livro'; const b = $('#tbTitle'); b.textContent = b.title = bar ?? t ?? ''; if (sub !== undefined) $('#tbSub').textContent = $('#tbSub').title = sub };

/* ------------------------------------------------------------- router -- */
// Where this tab is in its history. Each entry carries its own index in history.state, so Back and Forward are known exactly:
// after going back several steps, after a page rewrote its address in place, and when a link leads to the page just left.
const navStack = JSON.parse(sessionStorage.getItem('sg.stack') || '[]');   // navStack[i]: the address at history index i
let navAt = +(sessionStorage.getItem('sg.at') || 0), navEnd = +(sessionStorage.getItem('sg.end') || 0), swapping = false;
const keepNav = () => { try { sessionStorage.setItem('sg.stack', JSON.stringify(navStack.slice(0, navEnd + 1))); sessionStorage.setItem('sg.at', navAt); sessionStorage.setItem('sg.end', navEnd) } catch { } };
const _replace = history.replaceState.bind(history);
// A page that rewrites its own address (the map, search as you type, an opened situation, a new chat) keeps its place.
history.replaceState = (state, title, url) => { _replace({ ...(state || {}), lb: navAt }, title, url); if (url != null) { navStack[navAt] = current = here(); keepNav() } };
const swap = h => { swapping = true; location.replace(h) };   // this entry becomes another page, in place
const _push = history.pushState.bind(history);
const pushHere = url => { navAt++; navEnd = navAt; navStack.length = navAt; _push({ lb: navAt }, '', url); navStack[navAt] = current = here(); keepNav(); barState() };   // a new entry, without loading the page again
const scrolls = JSON.parse(sessionStorage.getItem('sg.scroll') || '{}');
try { history.scrollRestoration = 'manual' } catch { }   // the page restores its own place (restoreScroll), once it is built
let current = null;
window.addEventListener('scroll', () => { if (current && !$('#wframe')) scrolls[current] = scrollY }, { passive: true });   // an article scrolls in its frame, which keeps its own place (wiki)
window.addEventListener('pagehide', () => sessionStorage.setItem('sg.scroll', JSON.stringify(scrolls)));
function parse() {
  const h = here().slice(1) || '/';
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(qs || '') };
}
// The sidebar row each page belongs to. Reading pages stay under Library, articles under Encyclopedias; search results select no row.
const NAV_OF = { '': 'videos', guides: 'guides', t: 'guides', prepare: 'guides', ask: 'ask', videos: 'videos', watch: 'videos', map: 'map', library: 'library', learn: 'library', browse: 'library', shelf: 'library', collection: 'library', read: 'library', wiki: 'encyclopedias', search: '', saved: 'saved', encyclopedias: 'encyclopedias', translate: 'translate', vault: 'vault', check: 'check', about: 'about' };
let leaving = null;  // cleanup hook for the current view (player, chat stream…)
async function route() {
  const cameFromSide = !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('.side,.tabbar'));
  const { parts, q } = parse();
  const h = here();
  const wf = $('#wframe'), wd = wf && wf.contentDocument;
  if (current) { if (!wf) scrolls[current] = scrollY; else if (wd && wd.readyState === 'complete') scrolls[current] = wf.contentWindow.scrollY }   // an article's place is its frame's
  const at = history.state && history.state.lb;
  if (typeof at === 'number') { navAt = at; navEnd = Math.max(navEnd, at) }   // back, forward, or a reload
  else {
    if (swapping) swapping = false;
    else if (current !== null || navStack.length) { navAt++; navEnd = navAt; navStack.length = navAt }   // a new page: what was ahead is gone
    else navAt = navEnd = 0;   // the first page of this tab
    _replace({ ...(history.state || {}), lb: navAt }, '');
  }
  navStack[navAt] = h; keepNav();
  sessionStorage.setItem('sg.scroll', JSON.stringify(scrolls));
  current = h;
  const y = typeof at === 'number' ? scrolls[h] : null;   // read now: while the page is rebuilt it scrolls (shorter, then taller), and those scrolls are recorded too
  const v = parts[0] || 'videos';
  document.body.className = v === 'guides' ? 'home v-guides' : v ? 'v-' + v : 'home';
  const nav = v === 'read' && (q.get('from') || '').startsWith('#/about') ? 'about' : NAV_OF[v] || '';   // Sources, opened from About, stays under About
  $$('[data-nav]').forEach(a => nav && (a.dataset.nav === nav || (a.dataset.also || '').split(' ').includes(nav)) ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  const rows = $$('.side a.row-s'); rows.forEach(a => a.tabIndex = a.hasAttribute('aria-current') || (!nav && a === rows[0]) ? 0 : -1);   // the sidebar is one Tab stop; arrows move inside it
  savedCount(); railTitles();
  html.classList.remove('side-open', 'h1-gone'); h1seen.disconnect();
  $('#tbActs').replaceChildren(); $('#tbTitle').textContent = $('#tbSub').textContent = ''; $('#tbTitle').title = $('#tbSub').title = ''; searchLive = null; main.classList.remove('own-title');
  if (leaving) { try { leaving() } catch { } leaving = null }
  window.onresize = null; main.onkeydown = null;
  try {
    if (v !== 'map') MapView.stop();
    await topics().catch(() => { });
    if (!v || v === 'guides') await home();
    else if (v === 't') await topicPage(parts[1], parts[2]);
    else if (v === 'ask') await Chat.page(main, parts.slice(1), q);
    else if (v === 'videos') await (parts[1] ? videoRow(parts[1], q) : videosHome());
    else if (v === 'watch') await watch(parts[1], +q.get('t') || 0, q.get('from'));
    else if (v === 'read') await reader(parts[1], +q.get('p') || 0, q.get('from'), q.get('view'));
    else if (v === 'wiki') await wiki(parts.slice(1).join('/'), q.get('from'), y);
    else if (v === 'search') await searchPage(q.get('q') || '', q.get('kind') || 'all');
    else if (v === 'library' || v === 'learn' || v === 'browse') await library();
    else if (v === 'prepare') await prepareHub();
    else if (v === 'encyclopedias') await encyclopedias(q.get('q') || '');
    else if (v === 'translate') await translatePage(q.get('q') || '');
    else if (v === 'vault') await vaultPage();
    else if (v === 'check') await checkPage();
    else if (v === 'map') await MapView.page(main, q);
    else if (v === 'saved') await savedPage();
    else if (v === 'shelf') await shelfPage(parts[1], q.get('kind') || 'all', q.get('q') || '');
    else if (v === 'collection') await collectionPage(q.get('name') || '', q.get('from'));
    else if (v === 'about') await about();
    else notFound();
  } catch (e) { setTitle(''); document.body.className = 'v-error'; main.innerHTML = emptyState('warn', 'Não foi possível abrir esta página', e.message || e) }   // v-error: not a reading page, so a phone keeps its tab bar
  wireRails(); dock(); barState();
  $('#topQ').value = '';
  const big = $('main h1'); if (big) h1seen.observe(big);
  if (v === 'ask') { bandState(); return }  // the chat manages its own scroll position
  if (y != null && v !== 'wiki') restoreScroll(h, y); else if (v !== 'wiki') requestAnimationFrame(() => { if (!$('.sit.open', main)) scrollTo(0, 0) });
  if (y == null) startHere(cameFromSide);
  bandState(); alignTitle();
}
// Back, Forward or a reload return to the place the page was left. A page still filling in (pictures, results) may not be tall enough yet,
// so this tries again each frame for a moment (at most 2.5 s), and stops as soon as the person scrolls or the page changes.
function restoreScroll(h, y, w = window) {
  const stop = new AbortController(), end = performance.now() + 2500, o = { passive: true, signal: stop.signal };
  for (const ev of ['wheel', 'touchstart', 'keydown', 'mousedown']) addEventListener(ev, () => stop.abort(), o);
  let sh = 0, still = 0, seen = null;   // done once the place is reached and the page has stopped growing for a moment (sections still arriving would move it)
  const tick = () => {
    if (stop.signal.aborted || (w === window ? current !== h : !(w.frameElement && w.frameElement.isConnected))) return;   // another page, or another article in the frame
    const h2 = w.document.scrollingElement.scrollHeight;
    if (seen !== null && w.scrollY !== seen && h2 === sh) return stop.abort();   // it moved while the page did not grow: the person scrolled (an article's own wheel and key events never arrive in the Mac app)
    if (Math.abs(w.scrollY - y) > 1) w.scrollTo(0, y);
    seen = w.scrollY; still = h2 === sh && Math.abs(seen - y) <= 1 ? still + 1 : 0; sh = h2;
    if (still < 12 && performance.now() < end) requestAnimationFrame(tick); else stop.abort();
  };
  requestAnimationFrame(tick);
}
// On Windows the toolbar's title starts where the page's column does, as in Fluent's reading apps. On the Mac it follows Back and Forward.
function alignTitle() {
  const t = $('.tb-title'); if (!t || MAC) return;
  t.style.marginLeft = '';
  if (!t.offsetWidth) return;
  const d = main.getBoundingClientRect().left + parseFloat(getComputedStyle(main).paddingLeft) - t.getBoundingClientRect().left;
  if (d > 0 && d < 240) t.style.marginLeft = parseFloat(getComputedStyle(t).marginLeft) + d + 'px';
}
addEventListener('resize', alignTitle);
// After a new page: a person moving through the sidebar stays there, as in Finder or Settings, and Tab goes on to the toolbar and the page.
// Otherwise the next Tab starts at the top of the window (skip link, sidebar, toolbar, page), as after a full load. The marker it starts from
// is not a control; it carries the page's name, which a screen reader reads when focus lands on it.
function startHere(fromSide) {
  if (fromSide && !(MAC && !wide.matches) && document.activeElement && document.activeElement.closest('.side,.tabbar')) return;
  const t = $('#pageTop'), h1 = $('h1', main);
  t.textContent = (h1 && h1.textContent.trim()) || document.title;
  t.focus({ preventScroll: true });
}
window.addEventListener('hashchange', route);
let searchLive = null;   // on the search page, where the pane's field is the page's own (Windows), typing there updates the results
$('#topSearch').addEventListener('submit', e => { e.preventDefault(); if (searchLive) { searchLive($('#topQ').value.trim(), true); $('#topQ').blur(); return } location.hash = '#/search?q=' + encodeURIComponent($('#topQ').value.trim()) });
$('#topQ').addEventListener('input', () => { if (searchLive) searchLive($('#topQ').value.trim(), false, true) });

/* --------------------------------------------------------- the window -- */
const html = document.documentElement, MAC = html.classList.contains('plat-mac');
const wide = matchMedia('(min-width:900px)');
// The toolbar names the page once its large title has scrolled up under the toolbar.
const h1seen = new IntersectionObserver(es => html.classList.toggle('h1-gone', !es[es.length - 1].isIntersecting), { rootMargin: `-${(parseInt(getComputedStyle(html).getPropertyValue('--top-h')) || 52) + (parseInt(getComputedStyle(html).getPropertyValue('--cap-h')) || 0)}px 0px 0px 0px` });
// Windows' folded pane shows icons only: each row then carries its name as a tooltip, which is also its name for a screen reader.
function railTitles() { const icons = html.classList.contains('compact') && !html.classList.contains('side-open'); $$('.side a.row-s').forEach(a => icons ? a.title = $('span', a).textContent : a.removeAttribute('title')) }
addEventListener('resize', railTitles);
// The toolbar's field says only 'Search' when it is too narrow for the whole hint, as Windows' and the Mac's own narrow fields do
new ResizeObserver(() => { const q = $('#topQ'); if (q.clientWidth) q.placeholder = q.clientWidth < 175 ? 'Buscar' : 'Buscar na biblioteca' }).observe($('#topQ'));
// At 900 and wider a page's .dock controls (view switch, Save, Ask) sit in the toolbar; narrower they stay in the page.
const docks = () => wide.matches || (!MAC && innerWidth >= 640);
function dock() {
  if (docks()) $$('.dock', main).forEach(el => { const mark = document.createElement('i'); mark.className = 'dock-home'; mark.hidden = true; el.before(mark); $('#tbActs').append(el) });
  else $$('#tbActs .dock').forEach(el => { const mark = $('.dock-home', main); if (mark) mark.replaceWith(el); else el.remove() });
}
wide.addEventListener('change', () => { html.classList.remove('side-open'); dock(); railTitles(); bandState() });
matchMedia('(min-width:640px)').addEventListener('change', () => { dock(); bandState() });   // an overlay sidebar left open does not come back open later
const pageBack = () => $('main a[data-back]');
function barState() { $('#tbBack').disabled = navAt < 1 && !pageBack(); $('#tbFwd').disabled = navAt >= navEnd }
function bandState() {
  if (MAC) return;
  const s = $('#topSearch'), searchInBand = html.classList.contains('compact') && getComputedStyle(s).visibility !== 'hidden' && getComputedStyle(s).display !== 'none';
  const was = html.classList.contains('no-bar'), now = !$('#tbActs').children.length && !searchInBand;
  html.classList.toggle('no-bar', now);
  if (was !== now && window.onresize) window.onresize();   // a page that measures itself (the map) measures again
}
addEventListener('resize', () => requestAnimationFrame(bandState));
$('#tbBack').onclick = () => { const a = pageBack(); if (navAt > 0) history.back(); else if (a) location.hash = a.getAttribute('href') };
$('#tbFwd').onclick = () => history.forward();
function toggleSide() {
  if (wide.matches) { html.classList.toggle('side-off'); try { localStorage.setItem('sg.side-off', html.classList.contains('side-off') ? '1' : '0') } catch { } window.LB_LAYOUT() }
  else html.classList.toggle('side-open');
  railTitles(); bandState();
}
$('#sideBtn').onclick = toggleSide;
if (!MAC) {
  $('#sideBtn').before($('#tbBack'));   // drawn first, top left, so reached first
  // the full pane holds its search field above the rows; the folded rail has it in the command bar
  const placeSearch = () => {
    const f = $('#topSearch'), side = $('#side'), inPane = innerWidth >= 640 && !html.classList.contains('compact');
    if (inPane && f.parentElement !== side) $('.side-nav', side).before(f);
    else if (!inPane && f.parentElement === side) $('.top-in').append(f);
  };
  placeSearch(); new MutationObserver(placeSearch).observe(html, { attributes: true, attributeFilter: ['class'] }); addEventListener('resize', placeSearch);
}
document.addEventListener('click', e => { if (html.classList.contains('side-open') && !e.target.closest('.side,#sideBtn')) { html.classList.remove('side-open'); railTitles() } });
function toggleInsp() { html.classList.toggle('insp-off'); const d = $('.about-src', main); if (d && !html.classList.contains('insp-off')) d.open = true; store.set('insp-off', html.classList.contains('insp-off')) }
if (store.get('insp-off', true)) html.classList.add('insp-off');   // off until asked for: the page keeps the width
document.addEventListener('click', e => { if (e.target.closest('[data-insp]')) toggleInsp() });
$('#side').addEventListener('keydown', e => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const rows = $$('.side a.row-s').filter(a => a.offsetParent), i = rows.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault(); rows[(i + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length].focus();
});
const SECTIONS = ['#/guides', '#/videos', '#/map', '#/ask', '#/encyclopedias', '#/translate', '#/vault', '#/check'];
const findBox = () => [$('#bigQ'), $('#searchQ'), $('#topQ')].find(x => x && x.offsetParent) || $('#chatIn');
document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName), cmd = MAC ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  const is = c => e.code === 'Key' + c || (!e.code && (e.key || '').toUpperCase() === c);   // some input (assistive and remote tools) sends no key code
  if (e.key === '/' && !typing) { e.preventDefault(); findBox().focus() }
  else if (cmd && !e.altKey && !e.shiftKey && /^[1-8]$/.test(e.key)) { e.preventDefault(); location.hash = SECTIONS[e.key - 1] }
  else if (cmd && !e.altKey && !e.shiftKey && (is('F') || (!MAC && is('E')))) { e.preventDefault(); const f = findBox(); f.focus(); if (f.select) f.select() }
  else if (MAC && e.metaKey && e.ctrlKey && is('S')) { e.preventDefault(); toggleSide() }   // Windows apps have no key for this: the ☰ button
  else if (MAC ? e.metaKey && e.altKey && is('I') : e.ctrlKey && e.shiftKey && is('I')) { e.preventDefault(); if ($('.about-src', main)) toggleInsp() }
  else if (e.key === 'Escape') {
    if (html.classList.contains('side-open')) { html.classList.remove('side-open'); railTitles() }
    else if (document.activeElement === $('#topQ')) { $('#topQ').value = ''; $('#topQ').blur() }
  }
});
function notFound() { setTitle('Não encontrado'); main.innerHTML = emptyState('search', 'Esta página não está aqui', 'O link pode ser de uma versão anterior do guia.') }
const emptyState = (icon, title, text) => `<div class="empty"><span class="e-ico">${ico(icon)}</span><b>${esc(title)}</b><p>${esc(text)}</p><p class="e-act"><a class="btn plain" href="#/">Ir para Vídeos</a></p></div>`;
function searchBox(id, value, placeholder, button = 'Buscar') {
  return `<form class="bigsearch" role="search" id="${id}F">${ico('search')}<label class="sr" for="${id}">Buscar</label><input id="${id}" type="search" autocomplete="off" value="${esc(value || '')}" placeholder="${esc(placeholder)}" enterkeyhint="search"><button>${button}</button></form>`;
}

/* --------------------------------------------------------------- home -- */
async function home() {
  setTitle('');
  const tile = t => `<a class="need" href="#/t/${t.id}" ${tcStyle(t.id)}><span class="ico">${ico(t.id)}</span><b>${esc(SHORT[t.id] || t.title)}</b><small>${esc(t.short || '')}</small></a>`;
  const cont = await continueItems();
  const pins = (await libInfo()).pins !== false;
  main.innerHTML = `
  <section class="hero">
    <h1>O que você precisa?</h1>
    <p class="lead">Escolha o que está acontecendo, busque com suas próprias palavras ou faça uma pergunta à biblioteca.</p>
    ${searchBox('bigQ', '', innerWidth < 500 ? 'ex.: ferver água' : 'ex.: ferver água, corte fundo, sem energia')}
    <div class="chips examples" aria-label="Exemplos de busca">${['ferver água', 'corte não para de sangrar', 'geladeira após queda de energia', 'queimadura', 'vaso sanitário não funciona', 'cheiro de gás'].map(x => `<a class="chip" href="#/search?q=${encodeURIComponent(x)}">${esc(x)}</a>`).join('')}</div>
  </section>
  ${secHead('Precisa de ajuda agora')}
  <div class="needs">${nowTopics().map(tile).join('')}</div>
  <div class="banners"><a class="banner chatb" href="#/ask"><span class="ico">${ico('ask')}</span><span><b>Pergunte à biblioteca</b><small>Receba uma resposta feita a partir dos manuais, com as páginas e momentos de vídeo exatos</small></span><span class="go">${ico('right')}</span></a>
  <a class="banner map" href="#/map"><span class="ico">${ico('pin')}</span><span>${pins ? '<b>Encontrar ajuda por perto</b><small>Hospitais, farmácias, água potável e bombeiros no mapa offline</small>' : '<b>Encontrar um local</b><small>Rodovias principais, cidades e água no mapa offline</small>'}</span><span class="go">${ico('right')}</span></a></div>
  ${cont.length ? secHead('Continuar de onde parou') + rail(cont.join('')) : ''}
  <div id="homeVideos"></div>
  ${secHead('Aprender um ofício', 'Roteiros passo a passo para as próximas semanas e meses', '<a href="#/library">Todos os ofícios</a>')}
  ${rail(learnTopics().map(t => `<a class="skill" href="#/t/${t.id}" ${tcStyle(t.id)}><span class="ico">${ico(t.id)}</span><b>${esc(SHORT[t.id] || t.title)}</b><small>${esc(t.short || '')}</small><span class="steps">${(t.route || []).length} etapas</span></a>`).join(''), 'skills')}
  <a class="banner prep" href="#/prepare"><span class="ico">${ico('prep')}</span><span><b>Prepare-se antes que aconteça</b><small>Armazene água e alimentos, planeje faltas de energia e monte kits</small></span><span class="go">${ico('right')}</span></a>`;
  $('#bigQF').addEventListener('submit', e => { e.preventDefault(); location.hash = '#/search?q=' + encodeURIComponent($('#bigQ').value.trim()) });
  const ex = $('.examples', main), exEnd = () => { ex.classList.toggle('at-end', ex.scrollLeft + ex.clientWidth >= ex.scrollWidth - 4); ex.classList.toggle('at-start', ex.scrollLeft < 4) };
  ex.addEventListener('scroll', exEnd, { passive: true }); exEnd(); window.onresize = exEnd;
  try {
    const rows = await api('/api/videos');
    const g = rows.find(r => r.id === 'guides');
    if (g && $('#homeVideos')) { $('#homeVideos').innerHTML = secHead('Veja como fazer', 'Vídeos selecionados para os guias', '<a href="#/videos">Todos os vídeos</a>') + rail(g.items.slice(0, 14).map(v => vcard(v, { style: tcStyle(v.guide) })).join('')); wireRails($('#homeVideos')) }
  } catch { }
}
async function continueItems() {
  const out = [], rec = await recents();
  (await resumable(12)).slice(0, 6)
    .forEach(([id, v]) => out.push(vcard({ id, title: v.title, thumb: v.thumb, duration: v.d }, { sub: 'Retomar em ' + clock(v.t) })));
  rec.filter(r => !r.key.startsWith('v:')).slice(0, 8).forEach(r => out.push(`<a class="mini" href="${esc(r.href)}"><small>${esc(r.sub || '')}</small><b>${esc(r.title)}</b></a>`));
  return out;
}

/* -------------------------------------------------------------- guide -- */
function topicVideos(t) {
  const all = [...(t.choices || []).flatMap(c => c.read || []), ...(t.route || []).flatMap(s => s.read || []), ...(t.learn || []), ...(t.prepare || [])];
  const seen = new Set();
  return all.filter(i => i.src && i.src.kind === 'video' && !seen.has(i.src.id) && seen.add(i.src.id)).map(i => i.src);
}
async function topicPage(id, open) {
  const t = topicById(id);
  if (!t) return notFound();
  setTitle(t.title);
  remember({ key: 't:' + id, title: t.title, href: '#/t/' + id, sub: t.mode === 'learn' ? 'Roteiro de aprendizado' : 'Guia' });
  const learn = t.mode === 'learn';
  const progress = store.get('progress', {});
  const sits = (t.choices || []).map(c => c.goto
    ? `<div class="sit"><a href="#/t/${esc(c.goto)}"><span class="dot"></span><span class="tx"><b>${esc(c.label)}</b>${c.hint ? `<span>${esc(c.hint)}</span>` : ''}</span><span class="chev">${ico('right')}</span></a></div>`
    : `<div class="sit${open === c.id ? ' open' : ''}" id="c-${esc(c.id)}">
      <button aria-expanded="${open === c.id}" aria-controls="cb-${esc(c.id)}" data-choice="${esc(c.id)}"><span class="dot"></span><span class="tx"><b>${esc(c.label)}</b>${c.hint ? `<span>${esc(c.hint)}</span>` : ''}</span><span class="chev">${ico('down')}</span></button>
      <div class="body" id="cb-${esc(c.id)}"><div class="rcards">${(c.read || []).map(rcard).join('') || '<p class="muted">Nada selecionado para isto ainda — tente buscar.</p>'}</div></div></div>`).join('');
  const limLi = l => `<li>${esc(l.text)}${l.src ? ` <span class="cite">— <a href="${hrefFor(l)}">${esc(l.src.publisher || l.src.title)}${l.page ? ', p. ' + l.page : ''}</a></span>` : l.zim ? ` <span class="cite">— <a href="${hrefFor(l)}">enciclopédia</a></span>` : ''}</li>`;
  const LIM = 4, lims = t.limits || [];
  const limits = lims.length ? `<section class="limits" aria-labelledby="lim"><h2 id="lim">${ico('warn')}Pare e procure ajuda quando…</h2><ul>${lims.slice(0, LIM).map(limLi).join('')}</ul>${lims.length > LIM ? `<details><summary>Mostrar todos os ${lims.length} avisos</summary><ul>${lims.slice(LIM).map(limLi).join('')}</ul></details>` : ''}</section>` : '';
  const disagree = (t.gaps?.disagree || []).length ? `<div class="disagree"><b>As fontes divergem</b><ul>${t.gaps.disagree.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  const route = (t.route || []).length ? `<h2>Seu roteiro de aprendizado</h2><p class="muted small">As marcações ficam apenas neste dispositivo. Ler ou assistir não substitui praticar com segurança.</p>
    <ol class="route">${t.route.map((s, i) => { const k = id + ':' + i, p = progress[k] || {}; return `<li class="step${p.practised ? ' done' : ''}"><h3>${esc(s.title.replace(/^(Step|Etapa)\s*\d+:\s*/i, ''))}</h3>${s.goal ? `<p class="goal">${esc(s.goal)}</p>` : ''}
      <div class="rcards">${(s.read || []).map(rcard).join('')}</div>
      <div class="mark"><label><input type="checkbox" data-prog="${k}" data-f="read" ${p.read ? 'checked' : ''}> Já li isto</label><label><input type="checkbox" data-prog="${k}" data-f="practised" ${p.practised ? 'checked' : ''}> Já pratiquei com alguém experiente</label></div></li>` }).join('')}</ol>` : '';
  const sec = (icon, title, items) => items && items.length ? `<details class="more"><summary>${ico(icon)}<span>${title} <span class="n">· ${items.length}</span></span></summary><div class="body"><ul class="list">${items.map(i => rowItem({ ...i, preview: true })).join('')}</ul></div></details>` : '';
  const vids = topicVideos(t);
  const related = (t.related || []).map(topicById).filter(Boolean);
  main.innerHTML = `<div class="ghero" ${tcStyle(id)}><div class="ghero-in">${crumbs([['Vídeos', '#/videos'], [learn ? 'Aprender um ofício' : 'Precisa de ajuda agora', learn ? '#/library' : '#/'], [SHORT[id] || t.title]])}
      <div class="row1"><span class="ico">${ico(t.id)}</span><h1>${esc(t.title)}</h1></div><p class="lead">${esc(t.intro || '')}</p>
      <div class="vactions" style="margin-bottom:0">${askLink('topic:' + id, 'Faça uma pergunta sobre isto')}</div></div></div>
    <div class="gcols" ${tcStyle(id)}><div>
      ${(t.choices || []).length ? `<p class="ask" id="askh">${learn ? 'Por onde quer começar?' : 'O que está acontecendo?'}</p><div class="situations" aria-labelledby="askh">${sits}</div>` : ''}
      <div class="gnarrow">${limits}${disagree}</div>
      ${route}
      ${vids.length ? secHead('Vídeos para isto', `${vids.length} vídeo${vids.length > 1 ? 's' : ''} selecionado${vids.length > 1 ? 's' : ''}`) + rail(vids.map(v => vcard(v)).join('')) : ''}
      ${sec('prep', 'Prepare-se antes que aconteça', t.prepare)}
      ${sec('book', 'Aprofundar: manuais completos e artigos', t.learn)}
      ${(t.gaps?.missing || []).length ? `<details class="more"><summary>${ico('warn')}<span>Não encontrado nesta biblioteca</span></summary><div class="body"><p class="muted small" style="margin-top:0">Procurado, mas não encontrado quando este guia foi montado (outubro de 2026):</p><ul>${t.gaps.missing.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></details>` : ''}
      ${related.length ? `<h2>Guias relacionados</h2><div class="related">${related.map(r => `<a class="chip" href="#/t/${r.id}" ${tcStyle(r.id)}><span style="color:var(--tc)">${ico(r.id)}</span>${esc(SHORT[r.id] || r.title)}</a>`).join('')}</div>` : ''}
    </div><aside class="gside" aria-label="Segurança"></aside></div>`;
  // On wide screens the safety box sits beside the choices so it stays visible.
  const side = $('.gside', main), nar = $('.gnarrow', main);
  const placeSide = () => { if (!side || !nar) return; if (innerWidth >= 1050) { if (!side.firstChild) side.append(...nar.childNodes) } else if (side.firstChild) nar.append(...side.childNodes) };
  placeSide(); window.onresize = placeSide;
  $$('[data-choice]', main).forEach(b => b.addEventListener('click', () => {
    const c = b.closest('.sit'), on = !c.classList.contains('open');
    $$('.sit.open', main).forEach(x => { x.classList.remove('open'); $('button', x).setAttribute('aria-expanded', 'false') });
    if (on) { c.classList.add('open'); b.setAttribute('aria-expanded', 'true') }
    history.replaceState(null, '', '#/t/' + id + (on ? '/' + b.dataset.choice : ''));
    if (on) setTimeout(() => c.scrollIntoView({ block: 'start', behavior: 'smooth' }), 30);
  }));
  $$('[data-prog]', main).forEach(cb => cb.addEventListener('change', () => {
    const p = store.get('progress', {}); p[cb.dataset.prog] = { ...(p[cb.dataset.prog] || {}), [cb.dataset.f]: cb.checked }; store.set('progress', p);
    cb.closest('.step').classList.toggle('done', !!p[cb.dataset.prog].practised);
  }));
  if (open) { const c = $('#c-' + CSS.escape(open)); if (c) setTimeout(() => c.scrollIntoView({ block: 'start' }), 0) }
}

/* ------------------------------------------------------------- videos -- */
async function videosHome() {
  setTitle('Vídeos');
  main.innerHTML = `<h1>Vídeos</h1><p class="lead">Veja como fazer — tutoriais práticos primeiro, depois canais e cursos.</p>
    <div class="vtools">${searchBox('vq', '', 'Buscar títulos de vídeos')}</div>
    <div class="chips" style="margin-top:8px">${[['short', 'Menos de 10 min'], ['medium', '10–30 min'], ['long', 'Mais de 30 min']].map(([k, l]) => `<a class="chip" href="#/videos/all?len=${k}">${ico('clock')}${l}</a>`).join('')}</div>
    <div id="vrows"><p class="loading">Carregando vídeos…</p></div>`;
  $('#vqF').addEventListener('submit', e => { e.preventDefault(); location.hash = '#/videos/all?q=' + encodeURIComponent($('#vq').value.trim()) });
  const rows = await api('/api/videos');
  const cont = (await resumable(20)).slice(0, 12);
  const GCOL = { health: 'hurt', water: 'water', food: 'food', power: 'power', outdoors: 'shelter', repair: 'repair', making: 'land' };
  $('#vrows').innerHTML =
    (cont.length ? secHead('Continuar assistindo') + rail(cont.map(([id, v]) => vcard({ id, title: v.title, thumb: v.thumb, duration: v.d }, { sub: 'Retomar em ' + clock(v.t) })).join('')) : '') +
    rows.map(r => secHead(esc(r.title), r.note ? esc(r.note) : '', `<a href="#/videos/${r.id}">Ver todos (${r.count})</a>`) +
      rail(r.items.map(v => vcard(v, { style: tcStyle(v.guide || GCOL[r.id]) })).join(''))).join('') +
    `<p class="small muted" style="margin-top:24px">Apenas vídeos já baixados são exibidos. Muitos não têm legendas, portanto a busca nas transcrições e o assistente não conseguem ler o que é dito neles.</p>`;
  wireRails();
}
async function videoRow(row, q) {
  const len = q.get('len') || '', sort = q.get('sort') || '', qq = q.get('q') || '';
  const base = `#/videos/${row}`;
  const qs = o => { const p = new URLSearchParams({ q: qq, len, sort, ...o }); for (const [k, v] of [...p]) if (!v) p.delete(k); const s = p.toString(); return base + (s ? '?' + s : '') };
  let off = 0;
  const first = await api(`/api/videos/${row}?q=${encodeURIComponent(qq)}&len=${len}&sort=${sort}&offset=0`);
  setTitle(first.title);
  main.innerHTML = `<div>${backButton('#/videos', 'Vídeos')}</div><h1 style="margin-top:12px">${esc(qq ? 'Vídeos: “' + qq + '”' : first.title)}</h1>${first.note ? `<p class="lead">${esc(first.note)}</p>` : ''}
    <div class="vtools">${searchBox('vq', qq, 'Buscar nestes vídeos', 'Ir')}
      <label class="sr" for="vsort">Ordenar</label><select id="vsort">${[['', 'Mais úteis primeiro'], ['short', 'Mais curtos primeiro'], ['new', 'Mais recentes primeiro'], ['az', 'A a Z']].map(([k, l]) => `<option value="${k}" ${k === sort ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="chips" style="margin:8px 0 16px">${[['', 'Qualquer duração'], ['short', 'Menos de 10 min'], ['medium', '10–30 min'], ['long', 'Mais de 30 min']].map(([k, l]) => `<a class="chip ${k === len ? 'on' : ''}" href="${qs({ len: k })}">${l}</a>`).join('')}</div>
    <p class="muted small">${first.total.toLocaleString()} vídeo${first.total === 1 ? '' : 's'}</p>
    <div class="vgrid" id="vg"></div><p id="vmore"></p>`;
  $('#vqF').addEventListener('submit', e => { e.preventDefault(); location.hash = qs({ q: $('#vq').value.trim() }) });
  $('#vsort').addEventListener('change', e => { location.hash = qs({ sort: e.target.value }) });
  const add = d => {
    $('#vg').insertAdjacentHTML('beforeend', d.items.map(v => vcard(v)).join('') || (off ? '' : '<div class="empty" style="grid-column:1/-1">Nenhum vídeo encontrado. Tente outra palavra ou duração.</div>'));
    $('#vmore').innerHTML = d.more ? '<button class="btn plain" id="vmb">Mostrar mais vídeos</button>' : '';
    if (d.more) $('#vmb').onclick = async () => { off += 48; add(await api(`/api/videos/${row}?q=${encodeURIComponent(qq)}&len=${len}&sort=${sort}&offset=${off}`)) };
  };
  add(first);
}

async function watch(id, t, from) {
  const d = await api('/api/doc/' + encodeURIComponent(id));
  setTitle(d.title);
  const selfHref = `#/watch/${encodeURIComponent(id)}`;
  remember({ key: 'v:' + id, title: d.title, href: selfHref, sub: 'Vídeo · ' + fmtDur(d.duration) });
  const p = vprog()[id];
  const resumeAt = !t && p && p.t > 15 && (!d.duration || p.t < d.duration - 20) ? p.t : 0;
  main.innerHTML = `<div class="rtop">${backButton(from, 'Vídeos')}</div>
  <div class="watch">
    <div>
      <div class="player"><video id="vid" controls preload="metadata" playsinline src="${fileUrl(d.path)}${t ? '#t=' + t : ''}"></video></div>
      ${d.remote ? `<p class="small muted" style="margin:6px 0 0">Armazenado na unidade remota “${esc(d.remote)}”. Só reproduz enquanto esse computador estiver acessível.</p>` : ''}
      <h1 class="vtitle">${esc(d.title)}</h1>
      <div class="vmeta"><b>${esc(d.publisher || '')}</b><span>${fmtDur(d.duration)}</span>${d.upload_date ? `<span>${esc(d.upload_date.replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3'))}</span>` : ''}<span>${esc(d.trust)}</span></div>
      ${resumeAt ? `<div class="resume" id="resume">Você parou em ${clock(resumeAt)}. <button class="btn" id="resYes">Retomar</button><button class="btn plain" id="resNo">Começar do zero</button></div>` : ''}
      <div class="vactions dock">${saveButton({ key: 'v:' + id, title: d.title, href: selfHref, sub: 'Vídeo · ' + fmtDur(d.duration) })}<a class="btn plain" title="Perguntar sobre este vídeo" href="#/ask?about=${encodeURIComponent('video:' + id)}&${fromQ()}" id="askv">${ico('ask')}<span>Perguntar sobre este vídeo</span></a></div>
      <div class="notice small">Um vídeo mostra como uma pessoa fez algo. Assistir não é prática e pode não corresponder às orientações atuais de segurança — confira um manual para qualquer tarefa arriscada.</div>
    </div>
    <section class="txpanel" id="tx" aria-label="Transcrição"><header><h2>Transcrição</h2><label class="sr" for="cueQ">Buscar na transcrição</label><input id="cueQ" type="search" placeholder="Buscar palavras na transcrição"></header>
      <div class="cues" id="cues"><p class="muted" style="padding:12px 14px">Carregando transcrição…</p></div><div class="txnote" id="txnote"></div></section>
  </div>
  <div id="morev"></div>
  <details class="about-src"><summary>Sobre este vídeo</summary><div class="in"><dl><dt>Canal</dt><dd>${esc(d.publisher || '—')}</dd><dt>Tipo</dt><dd>${esc(d.trust)}</dd><dt>Duração</dt><dd>${fmtDur(d.duration) || 'desconhecida'}</dd>${d.notes ? `<dt>Nota</dt><dd>${esc(d.notes)}</dd>` : ''}${d.source_url ? `<dt>Original online</dt><dd>${esc(hostOf(d.source_url))} <span class="muted">(online; não necessário aqui)</span></dd>` : ''}</dl></div></details>`;
  const vid = $('#vid');
  if (d.thumb) vid.poster = fileUrl(d.thumb);
  vid.addEventListener('error', () => vid.closest('.player').insertAdjacentHTML('afterend', `<div class="err">${d.remote ? `Este vídeo está na unidade remota “${esc(d.remote)}”, inacessível no momento. A transcrição abaixo continua funcionando.` : `Não foi possível reproduzir este arquivo de vídeo aqui. <a href="${fileUrl(d.path)}" target="_blank" rel="noopener">Abrir o arquivo diretamente</a>.`}</div>`), { once: true });
  if (resumeAt) {
    $('#resYes').onclick = () => { vid.currentTime = resumeAt; vid.play().catch(() => { }); $('#resume').remove() };
    $('#resNo').onclick = () => { vid.currentTime = 0; vid.play().catch(() => { }); $('#resume').remove() };
  }
  let lastSave = 0;
  const saveProg = () => { if (vid.currentTime > 3) setVprog(id, { t: vid.currentTime, d: d.duration || vid.duration, title: d.title, thumb: d.thumb }) };
  vid.addEventListener('timeupdate', () => { if (Date.now() - lastSave > 4000) { lastSave = Date.now(); saveProg() } });
  vid.addEventListener('pause', saveProg);
  leaving = () => { saveProg(); vid.pause() };
  // keep "Ask about this video" pointing at the current moment
  vid.addEventListener('pause', () => { const a = $('#askv'); if (a) a.href = `#/ask?about=${encodeURIComponent('video:' + id + ':' + Math.round(vid.currentTime))}&${fromQ()}` });
  let cues = [];
  try {
    const tx = await api('/api/transcript/' + encodeURIComponent(id)); cues = tx.cues || [];
    $('#txnote').textContent = cues.length ? `${tx.source === 'authored' ? 'Legendas fornecidas pelo autor' : /auto/.test(tx.source || '') ? 'Legendas automáticas' : 'Legendas'} — podem conter erros.` : '';
  } catch { }
  const box = $('#cues');
  const draw = q => {
    const rx = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig') : null;
    const list = cues.filter(c => !rx || c.text.match(rx));
    box.innerHTML = list.length ? list.map(c => `<button class="cue" data-t="${c.t ?? ''}"><time>${c.t != null ? clock(c.t) : ''}</time><span>${rx ? esc(c.text).replace(rx, m => `<mark>${m}</mark>`) : esc(c.text)}</span></button>`).join('')
      : `<p class="muted" style="padding:12px 14px">${cues.length ? 'Nenhuma palavra encontrada.' : 'Nenhuma transcrição foi salva para este vídeo, portanto a busca e o assistente não conseguem ler o que é dito nele.'}</p>`;
  };
  draw('');
  $('#cueQ').addEventListener('input', e => draw(e.target.value.trim()));
  box.addEventListener('click', e => { const b = e.target.closest('.cue'); if (b && b.dataset.t !== '') { vid.currentTime = +b.dataset.t; vid.play().catch(() => { }); if (innerWidth < 1000) scrollTo({ top: 0, behavior: 'smooth' }) } });
  let lastOn = null;
  vid.addEventListener('timeupdate', () => {
    const now = vid.currentTime; let on = null;
    for (const b of box.children) { if (b.dataset && b.dataset.t !== '' && +b.dataset.t <= now) on = b; else if (on) break }
    if (on !== lastOn) { lastOn && lastOn.classList.remove('on'); on && on.classList.add('on'); lastOn = on; if (on && !$('#cueQ').value && innerWidth >= 1000) on.scrollIntoView({ block: 'nearest' }) }
  });
  try {
    const rel = await api('/api/videos/related/' + encodeURIComponent(id));
    if (rel.length && $('#morev')) { $('#morev').innerHTML = secHead('Mais como este') + rail(rel.map(v => vcard(v)).join('')); wireRails($('#morev')) }
  } catch { }
}

/* ------------------------------------------------------------- reader -- */
async function reader(id, page, from, view) {
  const d = await api('/api/doc/' + encodeURIComponent(id));
  if (d.kind === 'video') { swap('#/watch/' + encodeURIComponent(id) + (from ? '?from=' + encodeURIComponent(from) : '')); return }
  if (d.kind === 'transcript' && d.videoId) { swap('#/watch/' + encodeURIComponent(d.videoId) + (from ? '?from=' + encodeURIComponent(from) : '')); return }
  setTitle(d.title, [d.publisher, d.year, d.trust].filter(Boolean).join(' · '));
  const isPdf = d.kind === 'pdf', total = d.pages || 1;
  const isWeb = d.kind === 'html' && /\.x?html?$/i.test(d.path);   // a plain text file, such as a lecture transcript, reads as text in the page itself
  page = Math.min(Math.max(page || 1, 1), total);
  view = isPdf ? view || 'page' : isWeb ? view || 'web' : 'text';
  const key = 'd:' + id + (isPdf ? ':' + page : '');
  const selfHref = `#/read/${encodeURIComponent(id)}?p=${page}`;
  remember({ key: 'd:' + id, title: d.title, href: selfHref, sub: (isPdf ? 'Página ' + page + ' · ' : '') + (d.publisher || '') });
  const go = (p, v = view) => `#/read/${encodeURIComponent(id)}?p=${p}&view=${v}${from ? '&from=' + encodeURIComponent(from) : ''}`;
  const views = isPdf ? [['page', 'Página'], ['text', 'Texto'], ['pt', 'Traduzir (PT)'], ['pdf', 'PDF completo']] : isWeb ? [['web', 'Página'], ['text', 'Somente texto'], ['pt', 'Traduzir (PT)']] : [];
  main.innerHTML = `
    <div class="rtop">${backButton(from)}</div>
    <h1 class="rtitle">${esc(d.title)}</h1>
    <div class="rsrc"><b>${esc(d.publisher || '')}</b>${d.year ? ' · ' + esc(d.year) : ''} · ${esc(d.trust)}</div>
    <div class="rmodes">${views.length ? `<div class="seg dock" role="group" aria-label="Como exibir">${views.map(([v, l]) => `<button data-view="${v}" aria-pressed="${v === view}">${l}</button>`).join('')}</div>` : ''}<span class="vactions dock">${askLink('doc:' + id + ':' + (isPdf ? page : 1), 'Perguntar')}${saveButton({ key, title: d.title + (isPdf ? ' — página ' + page : ''), href: selfHref, sub: d.publisher || d.kindLabel })}<button class="tb-btn insp-btn" data-insp aria-label="Mostrar ou ocultar os detalhes da fonte" title="Detalhes">${ico('insp')}</button></span></div>
    <div id="docbody"></div>
    ${d.imageOnly ? '<div class="notice">Este é um documento digitalizado sem texto pesquisável, portanto a busca e o assistente não conseguem lê-lo. Use a visualização Página.</div>' : ''}
    ${isPdf && view !== 'pdf' ? `<div class="rbar"><a class="btn plain nav" href="${go(page - 1)}" ${page <= 1 ? 'aria-disabled="true" style="opacity:.35;pointer-events:none"' : ''} aria-label="Página anterior">${ico('back')}<span>Anterior</span></a>
      <span class="pnum"><label class="sr" for="pg">Número da página</label>Página <input id="pg" inputmode="numeric" value="${page}"> de ${total}</span>
      <a class="btn nav" href="${go(page + 1)}" ${page >= total ? 'aria-disabled="true" style="opacity:.35;pointer-events:none"' : ''} aria-label="Próxima página"><span>Próxima</span>${ico('right')}</a></div>` : ''}
    <details class="about-src"><summary>Sobre esta fonte</summary><div class="in"><p class="insp-h">${esc(d.title)}</p>
      <dl><dt>Publicação</dt><dd>${esc(d.publisher || '—')}</dd><dt>Tipo</dt><dd>${esc(d.trust)} · ${esc(d.kindLabel)}</dd>
      ${d.edition ? `<dt>Edição</dt><dd>${esc(d.edition)}</dd>` : ''}${d.year ? `<dt>Ano</dt><dd>${esc(d.year)}</dd>` : ''}
      <dt>Salvo em</dt><dd>${esc((d.retrieved_at || '').slice(0, 10) || 'data desconhecida')} · ${esc(d.collection)}</dd>
      ${d.notes ? `<dt>Nota</dt><dd>${esc(d.notes)}</dd>` : ''}
      ${d.source_url ? `<dt>Original online</dt><dd>${esc(hostOf(d.source_url))} <span class="muted">(online; não necessário para ler esta cópia)</span></dd>` : ''}</dl>
      <p class="small muted">Cópia de referência, não substitui orientação avaliada para o seu caso. Confira a data; materiais antigos podem divergir das orientações atuais.</p>
      ${isPdf || isWeb || !IN_WINDOW ? `<p><a class="btn ghost" href="${fileUrl(d.path)}${isPdf ? '#page=' + page : ''}" target="_blank" rel="noopener">${ico('ext')}Abrir o arquivo original</a></p>` : ''}</div></details>`;
  $$('[data-view]', main).forEach(b => b.addEventListener('click', () => swap(go(page, b.dataset.view))));
  if (innerWidth >= 1060 && !html.classList.contains('insp-off')) $('.about-src', main).open = true;
  const pg = $('#pg'); if (pg) pg.addEventListener('change', () => { const n = parseInt(pg.value, 10); if (n >= 1 && n <= total) location.hash = go(n) });
  const body = $('#docbody');
  if (view === 'page') {
    const w = Math.min(1600, Math.round(Math.min(innerWidth, 1000) * Math.min(2, devicePixelRatio || 1)));
    body.innerHTML = `<div class="pagewrap"><img class="pageimg" alt="Página ${page} de ${esc(d.title)}" src="${pageImg(id, page, w)}"></div>`;
    const img = $('img', body);
    img.addEventListener('error', () => { body.innerHTML = `<div class="notice">Não foi possível gerar a imagem desta página. <a href="${go(page, 'text')}">Mostrar o texto em vez disso</a>.</div>` });
    if (page < total) { const n = new Image(); n.src = pageImg(id, page + 1, w) }
    let sx = null, sy = 0;
    const wrap = $('.pagewrap', body);
    wrap.addEventListener('touchstart', e => { if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY } }, { passive: true });
    wrap.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0 && page < total) location.hash = go(page + 1); if (dx > 0 && page > 1) location.hash = go(page - 1) } }, { passive: true });
  } else if (view === 'pdf') {
    body.innerHTML = `<iframe class="frame" title="${esc(d.title)}" src="${fileUrl(d.path)}#page=${page}"></iframe><p class="small muted">Se o PDF não aparecer aqui (alguns celulares não exibem), use a visualização Página ou abra o arquivo original.</p>`;
  } else if (view === 'web') {
    const own = /(^|\/)documents\/lastbook\//.test(d.path);   // Lastbook's own pages (Sources and permissions) take the window's look from the server (engine/saved_pages.py, OWN_LOOK); an older server's stays a white sheet
    body.innerHTML = `<iframe class="frame${own ? ' own' : ''}" title="${esc(d.title)}" src="${fileUrl(d.path)}"></iframe>`;
  } else if (view === 'pt') {
    body.innerHTML = '<p class="loading">Extraindo e traduzindo esta página para Português (Brasil)…</p>';
    try {
      const t = await api(`/api/page/${encodeURIComponent(id)}/${isPdf ? page : 1}`);
      const txt = (t.text || '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      if (!txt) {
        body.innerHTML = `<div class="notice">Não há texto extraível nesta página para traduzir (pode ser apenas imagem). Use a visualização Página.</div>`;
      } else {
        const tr = await api('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: txt, source: 'auto', target: 'pt-BR', doc_id: id, page: isPdf ? page : 1 }) });
        const badge = tr.mode === 'ai' ? `Traduzido offline via ${esc(tr.model || 'IA local')}${tr.cached ? ' (cache)' : ''} em ${tr.elapsed_s}s` : 'Modo glossário offline (sem IA local instalada)';
        body.innerHTML = `<div class="notice small">${badge} · Confira sempre números, doses e avisos críticos na visualização Página original.</div><div class="pagetext">${esc(tr.translated || '')}</div>`;
      }
    } catch (e) { body.innerHTML = errorBox(e, 'Não foi possível traduzir esta página.') }
  } else {
    body.innerHTML = '<p class="loading">Carregando texto…</p>';
    try {
      const t = await api(`/api/page/${encodeURIComponent(id)}/${isPdf ? page : 1}`);
      const txt = (t.text || '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      body.innerHTML = `${isPdf || isWeb ? '<div class="notice small">Texto extraído automaticamente do original — tabelas, diagramas e quadros de aviso podem se perder ou ficar fora de ordem. Confira a visualização Página para tudo que for importante.</div>' : ''}<div class="pagetext">${esc(txt) || '<span class="muted">Sem texto nesta página (pode ser uma imagem ou página em branco).</span>'}</div>`;
    } catch (e) { body.innerHTML = errorBox(e, 'Não foi possível carregar o texto.') }
  }
  main.onkeydown = e => { if (!isPdf || /INPUT/.test(e.target.tagName) || e.altKey || e.metaKey || e.ctrlKey) return; if (e.key === 'ArrowRight' && page < total) location.hash = go(page + 1); if (e.key === 'ArrowLeft' && page > 1) location.hash = go(page - 1) };
}

/* --------------------------------------------------------------- wiki -- */
const ZIMNAMES = {
  wikipedia_pt_medicine: 'WikiMed em Português (Enciclopédia Médica)',
  wikipedia_pt_top_mini: 'Wikipédia PT — Essenciais (Compacta)',
  wikipedia_pt_top_nopic: 'Wikipédia PT — Principais (Texto)',
  wikipedia_pt_top_maxi: 'Wikipédia PT — Principais (Imagens)',
  wikipedia_pt_all: 'Wikipédia PT — Completa',
  ifixit_pt: 'iFixit em Português (Reparos)',
  wikibooks_pt: 'Wikilivros (Wikibooks) em Português',
  wikivoyage_pt: 'Wikivoyage em Português',
  wiktionary_pt: 'Wikcionário em Português',
  phet_pt: 'Simulações PhET em Português',
  mdwiki: 'Enciclopédia médica (MDWiki)',
  wikipedia: 'Wikipédia (Inglês)',
  wikibooks: 'Wikibooks — manuais e livros didáticos',
  appropedia: 'Appropedia — tecnologia apropriada',
};
const zimLabel = name => { for (const k in ZIMNAMES) if (name.startsWith(k)) return ZIMNAMES[k]; return name };
async function wiki(path, from, y) {
  const [zim, ...rest] = path.split('/');
  const art = rest.join('/');
  const title = decodeURIComponent(art.split('/').pop() || '').replace(/_/g, ' ') || zimLabel(zim);
  setTitle(title, '', zimLabel(zim));
  const src = '/zim/' + encodeURIComponent(zim) + '/' + art.split('/').map(encodeURIComponent).join('/');
  const selfHref = '#/wiki/' + path;
  const mainPage = zimMain(zim);
  main.innerHTML = `<div class="rtop">${backButton(from || '#/encyclopedias')}<span id="wsave" class="dock">${saveButton({ key: 'w:' + path, title, href: selfHref, sub: zimLabel(zim) })}</span></div>
    <h1 class="rtitle" id="wtitle">${esc(title)}</h1><div class="rsrc"><span class="zn">${esc(zimLabel(zim))} · </span>Conteúdo colaborativo; confira passos críticos de segurança em um manual${IN_WINDOW ? '' : ` · <a id="wopen" href="${src}" target="_blank" rel="noopener">abrir em outra aba</a>`}</div>
    <iframe class="frame" id="wframe" title="${esc(title)}" src="${src}"></iframe>`;
  const f = $('#wframe');
  // The toolbar names the encyclopedia, and the article once the article's own title has scrolled up out of the frame, as a large title does
  const barName = () => { const n = f.lbName, b = $('#tbTitle'), t = n && f.contentWindow.scrollY > n.at - 4 ? n.nt : zimLabel(zim); if (b.textContent !== t) b.textContent = b.title = t };
  // One scroller: the frame fills the rest of the window, so the page around it never scrolls as well
  const fit = () => { if (!f.isConnected) return; f.style.height = Math.max(160, innerHeight - (f.getBoundingClientRect().top + scrollY) - parseFloat(getComputedStyle(document.body).paddingBottom || 0)) + 'px' };
  fit(); window.onresize = fit;
  // The frame's scrolling is read from here, every frame while it moves and ten times a second when it rests. The Mac app runs no script in
  // an article, and then no listener on it is ever called, its scroll events included. Once the text goes under the frame's top edge the
  // platform's separator shows there; the toolbar names the article; the reading place is kept for Back; a wide table fades at its edges.
  let lastY = -1, moved = 0;
  const watch = () => {
    if (!f.isConnected) return;
    const fw = f.contentWindow, t = f.lbTidy, now = performance.now();
    if (fw && fw.document.readyState === 'complete') {
      const y = fw.scrollY;
      if (y !== lastY) { lastY = y; moved = now; f.classList.toggle('scrolled', y > 2); scrolls[current] = y; barName() }
      if (t) for (const b of t.boxes) if (b.lbX !== b.scrollLeft) { b.lbX = b.scrollLeft; moved = now; t.edge(b) }
    }
    if (now - moved < 500) requestAnimationFrame(watch); else setTimeout(watch, 100);
  };
  watch();
  let shown = null;
  f.addEventListener('load', async () => {
    try {
      const fd = f.contentDocument;
      lookOf(fd);
      if (!fd.getElementById('lb-article') && !fd.getElementById('lb-host')) {   // an older server adds no look of its own: the window's colour shows through, as engine/saved_pages.py does it
        const st = fd.createElement('style'); st.id = 'lb-host';
        st.textContent = 'html{--background-color-base:transparent!important}html,body,.mw-page-container,.mw-page-container-inner{background:transparent!important}.hatnote,.dablink,.rellink{--background-color-interactive-subtle:transparent!important;background:none!important}';
        (fd.head || fd.documentElement).appendChild(st);
      }
      f.lbTidy = null; try { f.lbTidy = tidyArticle(fd) } catch { }   // the article still reads as it came if this fails
      const fw = f.contentWindow;
      f.lbName = null;
      if (y && shown === null) restoreScroll(current, y, fw);   // Back to this article: its place, once (a link followed inside the frame starts at its top)
      const loc = f.contentWindow.location.pathname, t = fd.title || '';
      const m = /^\/zim\/([^/]+)\/(.*)$/.exec(loc); if (!m) return;
      const p = decodeURIComponent(m[1]) + '/' + m[2].split('/').map(decodeURIComponent).join('/');
      const own = fd.querySelector('#firstHeading, h1'), raw = (own && own.textContent.trim()) || t;
      if (!m[2] && !raw) return;   // the bare address, on its way to the front page
      const front = decodeURIComponent(loc) === await mainPage;   // the front page is named by its file, such as App/IntroPage: the encyclopedia's name says it instead
      if (f.contentDocument !== fd) return;
      if (front && own) own.style.setProperty('display', 'none', 'important');   // the skin sets its own display, which the hidden attribute does not beat
      main.classList.toggle('own-title', front);   // then the app's heading names it
      const nt = front ? zimLabel(zim) : raw || p.split('/').pop().replace(/_/g, ' '), sub = front ? 'Enciclopédia' : zimLabel(zim);
      $('#wtitle').textContent = nt; if ($('#wopen')) $('#wopen').href = loc; setTitle(nt, '', zimLabel(zim));
      f.lbName = !front && own ? { nt, at: own.getBoundingClientRect().bottom + fw.scrollY } : null; barName();
      $('#wsave').innerHTML = saveButton({ key: 'w:' + p, title: nt, href: '#/wiki/' + p, sub });
      fit();
      if (p !== shown) { shown = p; history.replaceState(null, '', '#/wiki/' + p + (from ? '?from=' + encodeURIComponent(from) : '')); remember({ key: 'w:' + p, title: nt, href: '#/wiki/' + p, sub }) }
    } catch { }
  });
}
// The address an encyclopedia's bare address leads to (a redirect from the server, a refresh page in the Mac app), asked once
const ZMAIN = {};
const zimMain = zim => ZMAIN[zim] || (ZMAIN[zim] = fetch('/zim/' + encodeURIComponent(zim) + '/').then(async r => {
  let u = r.redirected ? r.url : '';
  if (!u) { const m = /http-equiv=["']?refresh["']?[^>]*url=([^"'>]+)/i.exec(await r.text()); if (m) u = new URL(m[1].replace(/&amp;/g, '&').trim(), r.url).href }
  return u ? decodeURIComponent(new URL(u).pathname) : '';
}).catch(() => ''));
// A table wider than the column scrolls sideways inside its own box (.lb-wide, styled by engine/saved_pages.py), so the article never does.
// The box goes around the table, which keeps its table layout: a table made a scrolling block itself turns its width into a fixed one.
// The box fades at an edge with more to scroll to. A list in a table cell is indented when its bullets would fall outside the cell's edge.
// Only with the server's article look, which carries the box's style; an older server's page stays as it came.
function tidyArticle(fd) {
  const fw = fd.defaultView, root = fd.querySelector('.mw-parser-output') || fd.body;
  if (!root || !fd.getElementById('lb-article') || fd.documentElement.dataset.lbTidy) return;
  fd.documentElement.dataset.lbTidy = '-';   // first, so the tables are measured as they will show (the look then undoes the skin's narrow-page blocks)
  const scrolls = e => { for (let a = e.parentElement; a && a !== root; a = a.parentElement) if (fw.getComputedStyle(a).overflowX !== 'visible') return true; return false };
  const boxes = [];
  // A box beside a float would shrink to the room left there (it scrolls, so nothing holds it open), where the table itself would go below
  // the float: the box is held at least as wide as the table can be made, up to the column. A float wider than the column would hang out on
  // the left, where a box cannot scroll to: in its box it is not floated.
  const wrap = (t, cs) => {
    const box = fd.createElement('div'); box.className = 'lb-wide';
    box.style.margin = `${cs.marginTop} 0 ${cs.marginBottom}`;   // the space above and below, which inside the box would no longer meet its neighbours'
    if (cs.clear !== 'none') box.style.clear = cs.clear;
    t.before(box); box.append(t);
    t.style.setProperty('margin-top', '0', 'important'); t.style.setProperty('margin-bottom', '0', 'important');
    if (cs.float !== 'none') { t.style.setProperty('float', 'none', 'important'); t.style.setProperty('margin-left', '0', 'important'); t.style.setProperty('margin-right', '0', 'important') }
    box.style.width = 'min-content'; const least = box.offsetWidth; box.style.width = '';
    box.style.minWidth = `min(100%, ${least}px)`;
    boxes.push(box); return box;
  };
  for (const t of root.querySelectorAll('table')) {
    if (t.parentElement.closest('table,.lb-wide') || scrolls(t)) continue;   // inside another table, or a box that scrolls already (a navbox)
    const cs = fw.getComputedStyle(t);
    if (cs.position === 'absolute' || cs.position === 'fixed' || (cs.float !== 'none' && t.offsetWidth <= root.clientWidth)) continue;   // a floated box that fits (an infobox) stays beside the text
    wrap(t, cs);
  }
  // Anything else still wider than the column (a bar chart, a box of fixed width, a group set inline) gets a box too, now and after a resize.
  const de = fd.documentElement;
  const rest = () => {
    if (de.scrollWidth <= de.clientWidth + 1) return;
    const cw = root.getBoundingClientRect(), out = e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > cw.right + 1 || r.left < cw.left - 1) };
    const found = [];
    for (const e of root.querySelectorAll('*')) {
      if (!out(e) || e.closest('.lb-wide') || found.some(f => f.contains(e))) continue;
      const p = e.parentElement; if (p !== root && out(p) && !scrolls(e)) continue;   // its parent is the one to box
      if (scrolls(e) || /^(TD|TH|TR|TBODY|THEAD|CAPTION|LI|SPAN|A|B|I|SUP|SUB)$/.test(e.tagName)) continue;
      const cs = fw.getComputedStyle(e); if (cs.position === 'absolute' || cs.position === 'fixed') continue;
      found.push(e);
    }
    found.forEach(e => { const b = wrap(e, fw.getComputedStyle(e)); edge(b); ro.observe(b) });
  };
  for (const li of root.querySelectorAll('table li')) {
    const s = fw.getComputedStyle(li), list = li.parentElement;
    if (s.display !== 'list-item' || s.listStyleType === 'none' || s.listStylePosition !== 'outside' || list.dataset.lbIn) continue;
    const r = li.getBoundingClientRect(), cell = li.closest('td,th'), c = cell ? cell.getBoundingClientRect() : r, m = parseFloat(s.fontSize) * 1.4;
    const rtl = s.direction === 'rtl', room = rtl ? c.right - r.right : r.left - c.left;
    if (room < m) { list.dataset.lbIn = 1; list.style.setProperty(rtl ? 'margin-right' : 'margin-left', `calc(${fw.getComputedStyle(list)[rtl ? 'marginRight' : 'marginLeft']} + ${Math.ceil(m - room)}px)`) }
  }
  const edge = b => {
    const more = b.scrollWidth - b.clientWidth, s = Math.abs(b.scrollLeft), rtl = fw.getComputedStyle(b).direction === 'rtl';
    b.classList.toggle(rtl ? 'lb-l' : 'lb-r', more > 1 && s < more - 1); b.classList.toggle(rtl ? 'lb-r' : 'lb-l', more > 1 && s > 1);
  };
  const ro = new fw.ResizeObserver(es => es.forEach(e => edge(e.target.closest('.lb-wide'))));
  boxes.forEach(b => { edge(b); ro.observe(b); ro.observe(b.firstElementChild) });   // as a box scrolls, wiki() calls edge (it reads the scroll, see there)
  // What is left of the web page's machinery, which reads as a broken page offline: editing links where the link itself was taken out
  // ('(edit it)', '[edit on Wikidata]'), a template's styles error, a chart's source where the chart would be, an empty paragraph
  // holding only a line break (a gap under the title), and a note's mark written out as its counter ('[lower-alpha 1]' for '[a]').
  const tw = fd.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => /edit|<graph|content model|-alpha|-roman/i.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP });
  const gone = [], ab = n => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(97 + (n - 1) % 26) + s; return s };
  for (let n; (n = tw.nextNode());) {
    const e = n.parentElement; if (!e || e === root) continue;
    const t = e.textContent.trim();
    if (/^[[(]\s*edit(\s+it|\s+on\s+wikidata)?\s*[\])]$/i.test(t) || (e.matches('.error') && /must have content model/.test(t))) gone.push(e);
    else if (/^<graph>[\s\S]*<\/graph>$/.test(t)) gone.push(e);
    else if (/<graph>[\s\S]*?<\/graph>/.test(n.data)) n.data = n.data.replace(/<graph>[\s\S]*?<\/graph>/g, '');
    else if (e.closest('sup.reference')) { const m = /^(lower|upper)-(alpha|roman) (\d+)$/.exec(n.data.trim()); if (m) { const k = +m[3], s = m[2] === 'alpha' ? ab(k - 1) : roman(k); n.data = m[1] === 'upper' ? s.toUpperCase() : s } }
  }
  for (const p of root.querySelectorAll('p')) if (!p.textContent.trim() && !p.querySelector('img,svg,video,audio,iframe,input,math,object')) gone.push(p);
  gone.forEach(e => e.style.setProperty('display', 'none', 'important'));
  rest(); let rt = 0; new fw.ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(rest, 200) }).observe(root);
  fd.documentElement.dataset.lbTidy = boxes.length;
  return { boxes, edge };   // boxes: also those rest() adds later
}
const roman = n => { let s = ''; for (const [v, r] of [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]) for (; n >= v; n -= v) s += r; return s };
// The article's stylesheet (engine/saved_pages.py) reads these: the window's text colours and its accent, which only this page knows
// (the system accent in the apps, Lastbook green in a browser).
function lookOf(fd) {
  const cs = getComputedStyle(html), r = fd.documentElement.style;
  const probe = document.createElement('i'); probe.style.color = 'var(--accent)'; probe.hidden = true; document.body.append(probe);
  r.setProperty('--lb-link', getComputedStyle(probe).color); probe.remove();
  for (const [k, v] of [['--lb-ink', '--ink'], ['--lb-ink2', '--ink2'], ['--lb-line', '--line2'], ['--lb-font', '--font'], ['--lb-display', '--display']]) { const x = cs.getPropertyValue(v).trim(); if (x) r.setProperty(k, x) }
}
const ZIMS = [['mdwiki_en_all_maxi_2025-11.zim', 'Enciclopédia médica', 'MDWiki: artigos em linguagem simples sobre doenças, medicamentos e primeiros socorros.', 'health'],
['wikibooks_en_all_maxi_2026-04.zim', 'Wikibooks', 'Livros didáticos abertos e manuais práticos, de culinária a eletrônica.', 'book'],
['appropedia_en_all_maxi_2026-02.zim', 'Appropedia', 'Tecnologia apropriada: água, saneamento, energia e projetos de construção.', 'repair'],
['wikipedia_en_all_nopic_2026-06.zim', 'Wikipédia', 'A enciclopédia completa, somente texto (sem imagens).', 'wiki']];
const zimsHere = async () => {
  const info = await libInfo(), here = info.zims, cat = info.zims_catalog || [];
  if (!here) return ZIMS;
  const out = [], seen = new Set();
  for (const name of here) {
    seen.add(name);
    const pt = cat.find(z => z.file === name);
    if (pt) { out.push([name, pt.title, pt.summary, pt.icon || 'wiki']); continue }
    const en = ZIMS.find(z => z[0] === name);
    if (en) { out.push(en); continue }
    out.push([name, zimLabel(name), 'Coleção offline Kiwix (.zim).', 'wiki']);
  }
  return out;
};
async function encyclopedias(q) {
  setTitle('Enciclopédias');
  const info = await libInfo(), zims = await zimsHere(), cat = info.zims_catalog || [], installed = new Set(info.zims || []);
  const avail = cat.filter(z => !installed.has(z.file));
  main.innerHTML = `<h1>Enciclopédias</h1><p class="lead">${zims.length ? `${zims.length} ${zims.length === 1 ? 'coleção offline instalada' : 'coleções offline instaladas'}. Conteúdo colaborativo: bom para referência geral — confira passos críticos de segurança em um manual.` : 'Baixe enciclopédias e manuais completos do Kiwix em Português (Brasil) para leitura e consulta pela IA mesmo sem internet.'}</p>
  ${zims.length ? `<div style="margin:16px 0">${searchBox('zq', q, 'ex.: queimadura, gerador, fermentação')}</div><div id="zres"></div>
  ${secHead('Instaladas neste computador')}<div class="cards2">${zims.map(z => `<a class="card" href="#/wiki/${encodeURIComponent(z[0])}/?from=${encodeURIComponent('#/encyclopedias')}"><span class="ico">${ico(z[3])}</span><b>${esc(z[1])}</b><small>${esc(z[2])}</small></a>`).join('')}</div>` : ''}
  ${avail.length ? `${secHead('Disponíveis em Português (Brasil) para baixar', 'Catálogo Kiwix integrado do Último Livro', IN_WINDOW ? '<a href="/ui/setup.html#manage">Gerenciar downloads</a>' : '')}<div class="cards2">${avail.map(z => `<a class="card" href="${IN_WINDOW ? '/ui/setup.html#manage' : '#/encyclopedias'}"><span class="ico">${ico(z.icon || 'wiki')}</span><b>${esc(z.title)}</b><small>${esc(z.group)} · ${(z.size / 1e6 >= 1000 ? (z.size / 1e9).toFixed(1) + ' GB' : Math.round(z.size / 1e6) + ' MB')}<br>${esc(z.summary)}</small></a>`).join('')}</div>` : ''}`;
  if (zims.length) {
    $('#zqF').addEventListener('submit', e => { e.preventDefault(); location.hash = '#/encyclopedias?q=' + encodeURIComponent($('#zq').value.trim()) });
    if (q) zimResults(q, $('#zres'), 40);
  }
}
// heading: part of a wider search, shown under that heading only when something matched. Answers whether anything did.
async function zimResults(q, el, max = 8, heading = '') {
  el.innerHTML = heading ? '' : '<p class="loading">Buscando nas enciclopédias…</p>';
  try {
    const hits = await api('/api/collection-search?q=' + encodeURIComponent(q));
    if (!hits.length) { el.innerHTML = heading ? '' : `<div class="empty"><span class="e-ico">${ico('wiki')}</span><b>Nenhum artigo encontrado</b><p>Tente outro termo para a mesma coisa.</p></div>`; return false }
    const ord = ['mdwiki', 'wikibooks', 'appropedia', 'wikipedia'];
    hits.sort((a, b) => ord.findIndex(k => a.collection.startsWith(k)) - ord.findIndex(k => b.collection.startsWith(k)));
    el.innerHTML = `${heading ? `<h2>${heading}</h2>` : ''}<ul class="list">${hits.slice(0, max).map(h => `<li><a class="row" href="#/wiki/${esc(h.path.replace(/^zim\//, ''))}?${fromQ()}"><span class="k">${ico('wiki')}</span><span><b>${esc(h.title)}</b><small>${esc(zimLabel(h.collection))}</small></span></a></li>`).join('')}</ul>`;
    return true;
  } catch (e) { el.innerHTML = heading ? '' : `<p class="muted">A busca nas enciclopédias não está disponível no momento (${esc(e.message)}).</p>`; return false }
}

/* ------------------------------------------------------------- search -- */
const QSTOP = new Set('a an and are can do does for from get got have how i if in is it its me my need no not of on or our so that the this to was we what when where which who why will with without you your won don can t s de do da dos das em no na nos nas um uma uns umas por com sem mais mas ou se nao ja so ao aos pelo pela pelos pelas'.split(' '));
// Words are split, folded and matched by web/words.js (loaded first), so accents, Chinese and other scripts work.
function topicMatches(q) {
  return typeof SearchWords === 'undefined' ? [] : SearchWords.rankTopics(q, TOPICS, QSTOP);
}
let searchSeq = 0;
async function searchPage(q, kind) {
  setTitle(q ? 'Busca: ' + q : 'Buscar');
  const kinds = [['all', 'Tudo'], ['read', 'Manuais e páginas'], ['video', 'Vídeos'], ['wiki', 'Enciclopédias']];
  main.innerHTML = `<h1>${q ? 'Resultados' : 'Buscar'}</h1>
  ${searchBox('searchQ', q, 'Descreva com palavras do dia a dia')}
  <div class="chips" role="group" aria-label="Mostrar" style="margin-top:12px" id="kinds">${kinds.map(([k, l]) => `<a class="chip ${k === kind ? 'on' : ''}" aria-pressed="${k === kind}" data-kind="${k}" href="#/search?q=${encodeURIComponent(q)}&kind=${k}">${l}</a>`).join('')}</div>
  <div id="sask"></div><div id="sout"></div>`;
  const input = $('#searchQ');
  $('#searchQF').addEventListener('submit', e => { e.preventDefault(); input.blur(); go(input.value.trim(), true) });
  let tmr;
  input.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => go(input.value.trim(), false), 350) });
  // as-you-type: update results and the address; a new search is one new history entry, not one per keystroke
  let fresh = true;   // the next change starts a new entry
  function go(nq, commit) {
    const h = '#/search?q=' + encodeURIComponent(nq) + (kind !== 'all' ? '&kind=' + kind : '');
    if (nq === q) { if (commit) fresh = true; return }
    if (fresh) pushHere(h); else history.replaceState(null, '', h);
    fresh = !!commit; q = nq; if (input.value !== nq) input.value = nq;
    $$('#kinds a').forEach(a => a.href = `#/search?q=${encodeURIComponent(nq)}&kind=${a.dataset.kind}`);
    askOffer(nq); results(nq, kind);
  }
  searchLive = (nq, commit, typing) => { clearTimeout(tmr); if (typing) tmr = setTimeout(() => go(nq, false), 350); else go(nq, commit) };
  setTimeout(() => { $('#topQ').value = q }, 0);   // after the router clears it: on Windows the pane's field is this page's field
  askOffer(q); results(q, kind);
  if (!q) setTimeout(() => findBox().focus(), 50);
}
function askOffer(q) {
  const el = $('#sask'); if (!el) return;
  el.innerHTML = q && q.split(/\s+/).length >= 2 ? `<a class="ghit" href="#/ask?q=${encodeURIComponent(q)}" style="--tc:var(--accent)"><span class="ico">${ico('ask')}</span><span><b>Perguntar à biblioteca: “${esc(q)}”</b><small>Receba uma resposta escrita com as páginas exatas de onde veio</small></span></a>` : '';
}
async function results(q, kind) {
  const seq = ++searchSeq, out = $('#sout');
  if (!q) {
    out.innerHTML = `<p class="muted" style="margin-top:18px">Use as palavras que você usaria com um amigo. Por exemplo:</p><div class="chips wrapchips">${['limpar água para beber', 'perna quebrada', 'monóxido de carbono', 'conservar comida sem geladeira', 'licença de radioamador', 'plantar batata', 'afiar faca', 'diarreia em criança'].map(x => `<a class="chip" href="#/search?q=${encodeURIComponent(x)}">${esc(x)}</a>`).join('')}</div>`;
    return;
  }
  const g = kind === 'all' ? topicMatches(q) : [];
  out.innerHTML = `${g.length ? `<h2>Comece por um guia</h2>${g.map(({ t, c }) => `<a class="ghit" href="#/t/${t.id}${c ? '/' + c.id : ''}" ${tcStyle(t.id)}><span class="ico">${ico(t.id)}</span><span><b>${esc(SHORT[t.id] || t.title)}${c ? ' — ' + esc(c.label) : ''}</b><small>Páginas selecionadas com números exatos e limites de segurança</small></span></a>`).join('')}` : ''}
    <div id="spass"></div><div id="svid"></div><div id="sres"></div><div id="szim"></div>`;
  if (kind === 'wiki') return zimResults(q, $('#szim'), 40);
  // Each part answers whether it found anything; "nothing matched" shows once, only when none did.
  const parts = kind === 'all' || kind === 'read' ? [passages(q, seq)] : [];
  const reqs = [api('/api/find?q=' + encodeURIComponent(q) + '&kind=' + (kind === 'video' ? 'video' : 'read'))];
  if (kind === 'all') reqs.push(api('/api/find?q=' + encodeURIComponent(q) + '&kind=video').catch(() => null));
  $('#sres').innerHTML = '<p class="loading">Buscando…</p>';
  const found = (async () => {
    try {
      const [d, vd] = await Promise.all(reqs);
      if (seq !== searchSeq) return true;
      const vids = (kind === 'video' ? d : vd)?.results || [];
      if (kind === 'video') { $('#sres').innerHTML = vids.length ? `<div class="vgrid" style="margin-top:14px">${vids.map(r => vcard(r)).join('')}</div>` : ''; return vids.length > 0 }
      if (vids.length) { $('#svid').innerHTML = secHead('Vídeos', '', `<a href="#/search?q=${encodeURIComponent(q)}&kind=video">Ver todos</a>`) + rail(vids.slice(0, 10).map(r => vcard(r)).join('')); wireRails($('#svid')) }
      $('#sres').innerHTML = d.results.length ? `<h2>Nos manuais e páginas salvas</h2>
        ${d.expanded.length ? `<p class="small muted">Também buscou por: ${d.expanded.slice(0, 10).map(esc).join(', ')}${d.mode === 'some words' ? ' · exibindo páginas com parte das suas palavras' : ''}</p>` : ''}
        <div class="results">${d.results.map(resultCard).join('')}</div>` : '';
      return d.results.length + vids.length > 0;
    } catch (e) { if (seq === searchSeq) $('#sres').innerHTML = errorBox(e, 'A busca não está respondendo.') + '<p class="small muted">A biblioteca pode estar reconstruindo o índice. Tente novamente em um minuto.</p>'; return true }
  })();
  parts.push(found);
  if (kind === 'all') parts.push(found.then(() => seq === searchSeq && zimResults(q, $('#szim'), 6, 'Nas enciclopédias')));
  const any = (await Promise.all(parts)).some(Boolean);
  if (seq === searchSeq && !g.length && !any) $('#sres').innerHTML = emptySearch(q);
}
// Most relevant pages from the shared keyword + meaning-based retriever (the same one the assistant uses).
async function passages(q, seq) {
  try {
    const d = await api('/api/retrieve?q=' + encodeURIComponent(q) + '&k=6&kind=manual');
    if (seq !== searchSeq || !d.results.length || !$('#spass')) return false;
    $('#spass').innerHTML = secHead('Páginas mais relevantes', d.semantic && !d.semantic.chunks ? 'Encontrado pelas suas palavras' : 'Encontrado pelo sentido e pelas palavras') + `<div class="rcards">${d.results.map(r => rcard({ src: { id: r.doc_id, kind: r.kind, title: r.title, publisher: r.publisher, year: r.year, pages: r.pages, trust: r.trust }, page: r.page, label: r.title, note: (r.excerpt || '').slice(0, 220) + '…' })).join('')}</div>`;
    return true;
  } catch { return false }
}
const emptySearch = q => `<div class="empty"><span class="e-ico">${ico('search')}</span><b>Nenhum resultado para “${esc(q)}”</b><p>Tente menos palavras ou outro termo para a mesma coisa.</p></div>`;
function resultCard(r) {
  const base = { src: r };
  return `<article class="result"><h3><a href="${hrefFor({ ...base, page: r.hits[0] && r.hits[0].page })}">${esc(r.title)}</a></h3>
    <div class="rsrc">${srcText(r)} · ${esc(r.trust)}</div>
    ${r.hits.slice(0, 2).map(h => `<a class="hit" href="${hrefFor({ ...base, page: h.page })}">${h.page ? `<b>Página ${h.page}:</b> ` : ''}${h.snippet}</a>`).join('')}</article>`;
}

/* ------------------------------------------------------------ library -- */
async function library() {
  setTitle('Biblioteca');
  const saved = store.get('saved', []).length, chats = (window.Chat ? Chat.count() : 0);
  const zims = await zimsHere();
  main.innerHTML = `<h1>Biblioteca</h1><p class="lead">Seus itens salvos, roteiros de aprendizado, enciclopédias e todos os manuais da coleção.</p>
  <div class="cards2 three" style="margin-top:16px">
    <a class="card" href="#/saved"><span class="ico">${ico('save')}</span><b>Salvos</b><small>${saved ? saved + (saved > 1 ? ' itens salvos' : ' item salvo') : 'Páginas, vídeos e respostas que você guarda'} neste dispositivo</small></a>
    <a class="card" href="#/ask"><span class="ico">${ico('ask')}</span><b>Conversas</b><small>${chats ? chats + (chats > 1 ? ' conversas salvas' : ' conversa salva') : 'Faça uma pergunta à biblioteca'}</small></a>
    <a class="card" href="#/prepare"><span class="ico">${ico('prep')}</span><b>Prepare sua casa</b><small>Leituras de preparo de cada guia</small></a>
  </div>
  ${secHead('Aprender um ofício', 'Roteiros passo a passo que começam do básico')}
  <div class="needs">${learnTopics().map(t => `<a class="need" href="#/t/${t.id}" ${tcStyle(t.id)}><span class="ico">${ico(t.id)}</span><b>${esc(SHORT[t.id] || t.title)}</b><small>${esc(t.short || '')} · ${(t.route || []).length} etapas</small></a>`).join('')}</div>
  ${zims.length ? secHead('Enciclopédias', 'Cópias offline completas', '<a href="#/encyclopedias">Pesquisar</a>') + `<div class="cards2">${zims.map(z => `<a class="card" href="#/wiki/${z[0]}/?from=${encodeURIComponent('#/library')}"><span class="ico">${ico(z[3])}</span><b>${esc(z[1])}</b><small>${esc(z[2])}</small></a>`).join('')}</div>` : ''}
  ${secHead('Explorar por assunto', 'Todos os manuais, páginas da web salvas e vídeos')}<div id="shelves"><p class="loading">Carregando…</p></div>
  <p style="margin-top:20px"><a href="#/about">Sobre esta biblioteca e suas fontes</a>${IN_WINDOW ? ' · <a href="/ui/setup.html#manage">Biblioteca e IA local</a>' : ''}</p>`;
  try {
    const sh = await api('/api/shelves');
    $('#shelves').innerHTML = sh.filter(s => s.read + s.video).map(s => `<a class="shelfrow" href="#/shelf/${s.id}"><span><b>${esc(s.title)}</b><small>${s.read ? s.read.toLocaleString() + ' para ler' : ''}${s.read && s.video ? ' · ' : ''}${s.video ? s.video.toLocaleString() + ' vídeos' : ''}</small></span>${ico('right')}</a>`).join('');
  } catch (e) { $('#shelves').innerHTML = errorBox(e) }
}
async function prepareHub() {
  setTitle('Prepare sua casa');
  const list = nowTopics().filter(t => (t.prepare || []).length);
  main.innerHTML = `<h1>Prepare sua casa</h1>
  <p class="lead">Leituras para se preparar antes que falte água, energia ou serviços — reunidas de cada guia. Uma área de cada vez.</p>
  <div class="notice">Uma lista de compras não substitui suprimentos já estocados, e ler não substitui um plano praticado.</div>
  ${list.map(t => `<details class="more" ${tcStyle(t.id)}><summary><span class="prep-ico">${ico(t.id)}</span><span>${esc(SHORT[t.id] || t.title)} <span class="n">· ${t.prepare.length}</span></span></summary><div class="body"><ul class="list">${t.prepare.map(i => rowItem({ ...i, preview: true })).join('')}</ul><p><a href="#/t/${t.id}">Abrir o guia completo</a></p></div></details>`).join('')}`;
}
async function shelfPage(id, kind, q) {
  const sh = (await api('/api/shelves')).find(s => s.id === id);
  if (!sh) return notFound();
  setTitle(sh.title);
  main.innerHTML = `${backButton('#/library', 'Biblioteca')}${crumbs([['Biblioteca', '#/library'], [sh.title]])}<h1>${esc(sh.title)}</h1>
  <div style="margin:14px 0 10px">${searchBox('shq', q, 'Filtrar por título ou fonte', 'Filtrar')}</div>
  <div class="chips">${[['all', 'Tudo'], ['read', 'Para ler'], ['video', 'Vídeos']].map(([k, l]) => `<a class="chip ${k === kind ? 'on' : ''}" href="#/shelf/${id}?kind=${k}&q=${encodeURIComponent(q)}">${l}</a>`).join('')}</div><div id="shres"><p class="loading">Carregando…</p></div>`;
  $('#shqF').addEventListener('submit', e => { e.preventDefault(); location.hash = `#/shelf/${id}?kind=${kind}&q=` + encodeURIComponent($('#shq').value.trim()) });
  let off = 0;
  const load = async () => {
    const d = await api(`/api/shelf/${id}?kind=${kind}&q=${encodeURIComponent(q)}&offset=${off}`);
    const html = d.collections.map(c => `<section class="collection"><h3>${esc(c.collection)}</h3><div class="small muted">${esc(c.trust)} · ${c.count} ${c.count > 1 ? 'itens' : 'item'}</div><ul class="list">${c.items.map(r => rowItem({ src: r })).join('')}</ul>${c.count > c.items.length ? `<a class="btn ghost" href="#/collection?name=${encodeURIComponent(c.collection)}&${fromQ()}">Ver todos (${c.count})</a>` : ''}</section>`).join('');
    if (!off) $('#shres').innerHTML = d.collections.length ? '' : '<div class="empty">Nada aqui corresponde. Tente outra palavra.</div>';
    $('#shres').insertAdjacentHTML('beforeend', html);
    $('#moreb')?.remove();
    if (d.more) { $('#shres').insertAdjacentHTML('beforeend', '<p><button class="btn plain" id="moreb">Mostrar mais</button></p>'); $('#moreb').onclick = () => { off += 40; load() } }
  };
  await load();
}
async function collectionPage(name, from) {
  setTitle(name);
  main.innerHTML = `<div>${backButton(from, 'Biblioteca')}</div><h1 style="margin-top:12px">${esc(name)}</h1><ul class="list collection" id="cl"></ul><div id="cm"></div>`;
  let off = 0;
  const load = async () => {
    const d = await api('/api/collection?name=' + encodeURIComponent(name) + '&offset=' + off);
    $('#cl').insertAdjacentHTML('beforeend', d.items.map(r => rowItem({ src: r })).join(''));
    $('#cm').innerHTML = d.more ? '<button class="btn plain" id="cmb">Mostrar mais</button>' : '';
    if (d.more) $('#cmb').onclick = () => { off += 60; load() };
  };
  await load();
}

/* -------------------------------------------------------------- saved -- */
async function savedPage() {
  setTitle('Salvos');
  const s = store.get('saved', []), r = await recents();
  const li = x => `<li><a class="row" href="${esc(x.href)}"><span class="k">${ico(x.key[0] === 'v' ? 'video' : x.key[0] === 'w' ? 'wiki' : x.key[0] === 't' ? 'book' : x.key[0] === 'a' ? 'ask' : 'page')}</span><span><b>${esc(x.title)}</b><small>${esc(rowSub(x))}</small></span></a></li>`;
  const cont = await resumable();
  main.innerHTML = `<h1>Salvos</h1><p class="lead">Mantido apenas neste dispositivo.</p>
  ${s.length ? `<div class="collection" style="margin-top:18px"><ul class="list">${s.map(li).join('')}</ul></div>` : `<div class="empty"><span class="e-ico">${ico('save')}</span><b>Nada salvo ainda</b><p>Escolha Salvar em qualquer página, vídeo, artigo ou resposta para guardar aqui.</p></div>`}
  ${cont.length ? secHead('Continuar assistindo') + rail(cont.map(([id, v]) => vcard({ id, title: v.title, thumb: v.thumb, duration: v.d }, { sub: 'Retomar em ' + clock(v.t) })).join('')) : ''}
  ${secHead('Abertos recentemente')}${r.length ? `<div class="collection"><ul class="list">${r.map(li).join('')}</ul></div><p><button class="btn plain" id="clr">Limpar lista recente</button></p>` : '<div class="empty"><p>As páginas que você abrir aparecerão aqui.</p></div>'}`;
  const c = $('#clr'); if (c) c.onclick = () => { store.set('recent', []); savedPage() };
}

const copyClip = (text, okMsg = 'Copiado') => navigator.clipboard?.writeText(text).then(() => toast(okMsg), () => toast('Não foi possível copiar'));
const pwField = (attrs, ph) => `<div class="pw-wrap"><input class="ctl-input" type="password" ${attrs} placeholder="${esc(ph)}"><button type="button" class="pw-eye" aria-label="Mostrar senha" title="Mostrar ou ocultar senha">${ico('eye')}</button></div>`;
function wirePwEyes(root = main) {
  $$('.pw-eye', root).forEach(btn => btn.onclick = () => {
    const inp = btn.previousElementSibling; if (!inp) return;
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    btn.innerHTML = ico(show ? 'eyeOff' : 'eye');
    btn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
  });
}

async function translatePage(prefill) {
  setTitle('Tradutor offline');
  main.innerHTML = `<h1>Tradutor offline</h1>
    <p class="lead">Traduza trechos de manuais em inglês/espanhol com a IA local instalada ou consulte o guia de frases de emergência (funciona mesmo sem IA).</p>
    <div class="tool-card">
      <div class="tool-bar">
        <label class="small">Origem: <select id="trSrc" class="ctl-select"><option value="auto" selected>Detectar automaticamente</option><option value="en">Inglês</option><option value="es">Espanhol</option><option value="pt-BR">Português (Brasil)</option></select></label>
        <button class="btn plain" id="trSwap" type="button" title="Inverter idiomas" aria-label="Inverter idiomas de origem e destino">${ico('swap')}</button>
        <label class="small">Destino: <select id="trTgt" class="ctl-select"><option value="pt-BR" selected>Português (Brasil)</option><option value="en">Inglês</option><option value="es">Espanhol</option></select></label>
        <span style="display:flex;gap:8px;margin-left:auto">
          <button class="btn plain" id="trClear" type="button">Limpar</button>
          <button class="btn" id="trGo" type="button">${ico('translate')}<span>Traduzir</span></button>
        </span>
      </div>
      <textarea id="trIn" class="ctl-textarea" rows="5" placeholder="Cole ou digite aqui um trecho em inglês, espanhol ou português… (Ctrl+Enter / Cmd+Enter para traduzir)">${esc(prefill || '')}</textarea>
      <div id="trOut"></div>
    </div>
    ${secHead('Guia rápido de frases de emergência', 'Inglês · Espanhol · Português (Brasil)')}
    <div style="margin:10px 0">${searchBox('glQ', '', 'Filtrar frases (ex.: water, BLEEDING, gerador, 192)', 'Filtrar')}</div>
    <div id="glList"><p class="loading">Carregando guia de frases…</p></div>`;
  const runTr = async () => {
    const text = $('#trIn').value.trim(), out = $('#trOut');
    if (!text) { out.innerHTML = '<p class="muted small">Digite ou cole um texto acima para traduzir.</p>'; return }
    const b = $('#trGo'); b.disabled = true;
    out.innerHTML = '<p class="loading">Traduzindo offline…</p>';
    try {
      const r = await api('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, source: $('#trSrc').value, target: $('#trTgt').value }) });
      const info = r.mode === 'ai' ? `Traduzido com ${esc(r.model || 'IA local')} em ${r.elapsed_s}s${r.cached ? ' (cache)' : ''}` : 'Modo glossário offline';
      out.innerHTML = `<div class="tool-bar" style="justify-content:space-between;margin-top:4px"><span class="notice small" style="margin:0;flex:1">${info}</span><button class="btn plain" id="trCopy" type="button">${ico('copy')}<span>Copiar tradução</span></button></div>
        <div class="pagetext" style="background:var(--bg);padding:14px;border-radius:12px;border:1px solid var(--line2)">${esc(r.translated)}</div>`;
      $('#trCopy').onclick = () => copyClip(r.translated || '', 'Tradução copiada');
    } catch (e) { out.innerHTML = errorBox(e, 'Não foi possível traduzir.') }
    b.disabled = false;
  };
  $('#trGo').onclick = runTr;
  $('#trSwap').onclick = () => {
    const src = $('#trSrc'), tgt = $('#trTgt'), sv = src.value, tv = tgt.value;
    if (sv === 'auto') { src.value = tv; tgt.value = tv === 'pt-BR' ? 'en' : 'pt-BR' }
    else { src.value = tv; tgt.value = sv }
  };
  $('#trClear').onclick = () => { $('#trIn').value = ''; $('#trOut').innerHTML = ''; $('#trIn').focus() };
  $('#trIn').addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); runTr() } });
  if (prefill) runTr();
  let cats = [], flatItems = [];
  const drawGl = q => {
    const nq = q.trim().toLowerCase();
    flatItems = [];
    const html = cats.map(c => {
      const rows = c.items.filter(it => !nq || (it.en + ' ' + it.es + ' ' + it.pt).toLowerCase().includes(nq));
      if (!rows.length) return '';
      return `<section class="collection"><h3>${esc(c.category)}</h3><ul class="list">${rows.map(it => {
        const idx = flatItems.push(it) - 1;
        return `<li class="gl-item"><span class="gl-text"><b>${esc(it.pt)}</b><small>EN: ${esc(it.en)}</small><small>ES: ${esc(it.es)}</small></span><button class="btn plain gl-copy" type="button" data-glcopy="${idx}">${ico('copy')}<span>Copiar</span></button></li>`;
      }).join('')}</ul></section>`;
    }).join('');
    const listEl = $('#glList');
    listEl.innerHTML = html || '<div class="empty"><p>Nenhuma frase correspondente no guia rápido.</p></div>';
    $$('[data-glcopy]', listEl).forEach(btn => btn.onclick = () => {
      const it = flatItems[+btn.dataset.glcopy];
      if (it) copyClip(it.pt, 'Frase copiada');
    });
  };
  try { cats = (await api('/api/translate/glossary')).glossary || []; drawGl('') } catch (e) { $('#glList').innerHTML = errorBox(e) }
  $('#glQF').addEventListener('submit', e => { e.preventDefault(); drawGl($('#glQ').value) });
  $('#glQ').addEventListener('input', () => drawGl($('#glQ').value));
}

async function vaultPage() {
  setTitle('Cofre de Emergência');
  let opened = null, dirty = false;   // opened: {id, name, password, payload}
  const SEC_META = [
    ['documents', 'Documentos pessoais', 'CPF, RG, CNH, passaporte, certidões, apólices de seguro…'],
    ['medical', 'Ficha médica e alergias', 'Tipo sanguíneo, alergias graves, remédios contínuos, contatos médicos, cartão SUS…'],
    ['contacts', 'Contatos de emergência e ponto de encontro', 'Telefones da família, ponto de encontro caso a rede caia, vizinhos de confiança…'],
    ['notes', 'Senhas, bancos e anotações seguras', 'Chaves de recuperação, informações bancárias, instruções para a família…'],
  ];
  const syncSections = () => {
    if (!opened) return;
    opened.payload.sections = opened.payload.sections || {};
    $$('[data-sec]', main).forEach(ta => opened.payload.sections[ta.dataset.sec] = ta.value);
  };
  const saveCurrent = async () => {
    if (!opened) return;
    syncSections();
    try {
      const r = await api('/api/vault', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', id: opened.id, password: opened.password, payload: opened.payload }) });
      opened.payload = r.payload;
      dirty = false;
      draw('', 'Cofre salvo e criptografado com sucesso.');
    } catch (e) { draw(e.message, '', dirty) }
  };
  const onVaultKey = e => {
    if (opened && (e.metaKey || e.ctrlKey) && (e.key || '').toLowerCase() === 's') { e.preventDefault(); saveCurrent() }
  };
  addEventListener('keydown', onVaultKey);
  leaving = () => removeEventListener('keydown', onVaultKey);

  const draw = async (err = '', msg = '', keepDirty = false) => {
    dirty = !!keepDirty;
    let list = [];
    try { list = (await api('/api/vault/list')).vaults || [] }
    catch (e) { main.innerHTML = `<h1>Cofre criptografado</h1>${errorBox(e, 'Cofre indisponível neste acesso')}`; return }
    if (opened) {
      const p = opened.payload, atts = p.attachments || [];
      main.innerHTML = `<div class="vault-head"><h1>${ico('vault')}<span>${esc(opened.name)}</span></h1><span class="dirty-badge" id="vDirty" ${dirty ? '' : 'hidden'}>Alterações não salvas</span><button class="btn plain" id="vLock" type="button" style="margin-left:auto">Trancar cofre</button></div>
        <p class="lead">Desbloqueado apenas na memória desta janela. Ao sair ou trancar, os dados voltam a ficar criptografados no disco.</p>
        ${err ? `<div class="err">${esc(err)}</div>` : msg ? `<div class="notice">${esc(msg)}</div>` : ''}
        <div class="tool-card">
          <div class="vault-grid">
            ${SEC_META.map(([k, lbl, ph]) => `<label class="vault-sec"><b>${esc(lbl)}</b><textarea class="ctl-textarea" data-sec="${k}" rows="5" placeholder="${esc(ph)}">${esc((p.sections || {})[k] || '')}</textarea></label>`).join('')}
          </div>
          <div>
            <b>Anexos cifrados dentro do cofre</b> <small class="muted">(até 120 KB por arquivo; ex.: foto compacta de documento, receita, TXT/PDF pequeno)</small>
            <ul class="list" id="vAtts" style="margin-top:8px">${atts.length ? atts.map((a, idx) => `<li class="row" style="display:flex;align-items:center;gap:10px"><span><b>${esc(a.name)}</b><small>${Math.max(1, Math.round((a.size || 0) / 1024))} KB</small></span><button class="btn plain" type="button" data-dl="${idx}" style="margin-left:auto">Baixar</button><button class="btn plain" type="button" data-rmatt="${idx}">Remover</button></li>`).join('') : '<li class="muted small">Nenhum anexo adicionado.</li>'}</ul>
            <p style="margin-top:8px"><input type="file" id="vFile"></p>
          </div>
          <div class="tool-bar">
            <button class="btn" id="vSave" type="button">${ico('save')}<span>Salvar alterações no cofre</span></button>
            <span class="small muted">Atalho: ${MAC ? '⌘S' : 'Ctrl+S'}</span>
            <button class="btn plain" id="vDel" type="button" style="margin-left:auto;color:var(--stop)">Excluir cofre</button>
          </div>
        </div>`;
      const markDirty = () => { dirty = true; const b = $('#vDirty'); if (b) b.hidden = false };
      $$('[data-sec]', main).forEach(ta => ta.addEventListener('input', markDirty));
      $('#vLock').onclick = () => {
        if (dirty && !confirm('Há alterações não salvas neste cofre. Descartar alterações e trancar?')) return;
        opened = null; draw('', 'Cofre trancado.');
      };
      $('#vFile').onchange = ev => {
        const f = ev.target.files && ev.target.files[0]; if (!f) return;
        if (f.size > 120 * 1024) { syncSections(); draw('Arquivo maior que 120 KB para manter o cofre leve.', '', dirty); return }
        const rd = new FileReader();
        rd.onload = () => {
          syncSections();
          const b64 = String(rd.result || '').split(',')[1] || '';
          p.attachments = (p.attachments || []).concat([{ id: Date.now().toString(36), name: f.name, mime: f.type || 'application/octet-stream', size: f.size, data_b64: b64 }]);
          draw('', `Anexo “${f.name}” adicionado — clique em Salvar alterações.`, true);
        };
        rd.readAsDataURL(f);
      };
      $$('[data-dl]', main).forEach(b => b.onclick = () => {
        const a = atts[+b.dataset.dl]; if (!a) return;
        const bin = Uint8Array.from(atob(a.data_b64), c => c.charCodeAt(0));
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([bin], { type: a.mime || 'application/octet-stream' }));
        link.download = a.name; document.body.append(link); link.click();
        setTimeout(() => { URL.revokeObjectURL(link.href); link.remove() }, 500);
      });
      $$('[data-rmatt]', main).forEach(b => b.onclick = () => { syncSections(); p.attachments.splice(+b.dataset.rmatt, 1); draw('', 'Anexo removido — clique em Salvar alterações.', true) });
      $('#vSave').onclick = saveCurrent;
      $('#vDel').onclick = async () => {
        if (!confirm(`Excluir permanentemente o cofre “${opened.name}”? Não há como desfazer.`)) return;
        try {
          await api('/api/vault', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: opened.id, password: opened.password }) });
          opened = null;
          draw('', 'Cofre excluído.');
        } catch (e) { draw(e.message, '', dirty) }
      };
      return;
    }
    main.innerHTML = `<h1>Cofre criptografado de emergência</h1>
      <p class="lead">Guarde documentos, ficha médica, telefones da família e senhas cifrados localmente com senha forte (PBKDF2 + HMAC-SHA256) dentro da biblioteca.</p>
      ${err ? `<div class="err">${esc(err)}</div>` : msg ? `<div class="notice">${esc(msg)}</div>` : ''}
      ${list.length ? `${secHead('Cofres neste dispositivo')}<div class="cards2">${list.map(v => `<div class="card" style="display:grid;gap:8px"><b>${esc(v.name)}</b><small>Atualizado em ${esc(v.updated.slice(0, 16).replace('T', ' '))} · ${(v.bytes / 1024).toFixed(1)} KB</small><div style="display:flex;gap:8px;align-items:center">${pwField(`data-pw="${esc(v.id)}"`, 'Senha do cofre')}<button class="btn" type="button" data-open="${esc(v.id)}">Abrir</button></div></div>`).join('')}</div>` : ''}
      ${secHead('Criar novo cofre')}
      <form id="vNew" class="tool-card" style="max-width:520px">
        <div class="ctl-field"><label for="vName">Nome do cofre</label><input id="vName" class="ctl-input" required placeholder="ex.: Documentos da Família"></div>
        <div class="ctl-field"><label for="vPass">Senha (mínimo 4 caracteres — guarde bem, não há recuperação!)</label>${pwField('id="vPass" required minlength="4"', 'Escolha uma senha forte')}</div>
        <button class="btn" type="submit">${ico('vault')}<span>Criar cofre criptografado</span></button>
      </form>`;
    wirePwEyes(main);
    const tryOpen = async id => {
      const pw = ($(`[data-pw="${id}"]`, main) || {}).value || '';
      if (!pw) { draw('Digite a senha para abrir o cofre.'); return }
      try {
        const r = await api('/api/vault', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open', id, password: pw }) });
        opened = { id: r.id, name: r.name, password: pw, payload: r.payload };
        draw();
      } catch (e) { draw(e.message) }
    };
    $$('[data-open]', main).forEach(b => b.onclick = () => tryOpen(b.dataset.open));
    $$('[data-pw]', main).forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); tryOpen(inp.dataset.pw) } }));
    $('#vNew').onsubmit = async e => {
      e.preventDefault();
      const name = $('#vName').value.trim(), pw = $('#vPass').value;
      try {
        const r = await api('/api/vault', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', name, password: pw }) });
        opened = { id: r.id, name: r.name, password: pw, payload: r.payload };
        draw('', 'Cofre criado! Preencha as informações abaixo e clique em Salvar.');
      } catch (e) { draw(e.message) }
    };
  };
  await draw();
}

async function checkPage() {
  setTitle('Diagnóstico offline');
  main.innerHTML = `<h1>Diagnóstico do Último Livro</h1>
    <p class="lead">Confere offline se a biblioteca, mapas estaduais, enciclopédias (.zim), modelos de IA e cofres estão íntegros e compatíveis com este computador.</p>
    <div class="tool-bar" style="margin:14px 0">
      <button class="btn" id="chkFast">${ico('check')}<span>Verificação rápida</span></button>
      <button class="btn plain" id="chkFull">Verificação completa (com SHA-256)</button>
      ${IN_WINDOW ? '<a class="btn plain" href="/ui/setup.html#manage" style="margin-left:auto">Biblioteca e IA local</a>' : ''}
    </div>
    <div id="chkOut"></div>`;
  const run = async full => {
    const out = $('#chkOut');
    out.innerHTML = `<p class="loading">${full ? 'Calculando SHA-256 de todos os arquivos — pode levar alguns minutos…' : 'Executando diagnóstico rápido…'}</p>`;
    try {
      const r = await api('/api/check' + (full ? '?full=1' : ''));
      const badgeFor = st => `<span class="chk-badge ${esc(st)}">${ico(st === 'ok' ? 'ok' : st === 'warn' ? 'warn' : 'x')}</span>`;
      out.innerHTML = `<div class="${r.ok ? 'notice' : 'err'}"><b>${r.ok ? 'Tudo em ordem nos itens críticos' : 'Há problemas que precisam de atenção'}</b> · ${r.full ? 'Verificação completa (SHA-256)' : 'Verificação rápida'}</div>
        <div class="chk-summary">
          <div class="chk-stat ok"><b>${r.summary.ok}</b><small>Itens OK</small></div>
          <div class="chk-stat warn"><b>${r.summary.warn}</b><small>Avisos</small></div>
          <div class="chk-stat error"><b>${r.summary.error}</b><small>Erros</small></div>
          <div class="chk-stat"><b>${r.elapsed_s}s</b><small>Duração</small></div>
        </div>
        ${r.sections.map(s => `<section class="collection"><h3>${esc(s.title)}</h3><ul class="list">${s.items.map(it => `<li class="chk-row">${badgeFor(it.status)}<span><b>${esc(it.label)}</b><small>${esc(it.detail)}</small></span></li>`).join('')}</ul></section>`).join('')}
        <div class="tool-bar" style="margin-top:16px">
          <button class="btn plain" id="chkCopy">${ico('copy')}<span>Copiar relatório</span></button>
          <button class="btn plain" id="chkSave">Baixar relatório (.txt)</button>
          ${IN_WINDOW && (r.summary.warn > 0 || r.summary.error > 0) ? '<a class="btn" href="/ui/setup.html#manage" style="margin-left:auto">Gerenciar ou reparar na Biblioteca e IA</a>' : ''}
        </div>`;
      $('#chkCopy').onclick = () => copyClip(r.report_text || '', 'Relatório copiado');
      $('#chkSave').onclick = () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([r.report_text], { type: 'text/plain;charset=utf-8' }));
        a.download = r.report_name || 'relatorio-verificacao.txt';
        document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 500);
      };
    } catch (e) { out.innerHTML = errorBox(e, 'Falha no diagnóstico.') }
  };
  $('#chkFast').onclick = () => run(false);
  $('#chkFull').onclick = () => run(true);
  await run(false);
}

/* ------------------------------------------------------------ about -- */
// What the assistant cannot read, as a sentence: counts of none are left out, and one is one
const many = (n, one, more) => `${n.toLocaleString()} ${n === 1 ? one : more}`;
function blind(c) {
  if (!c) return '';
  const nv = c.videos - c.videos_with_text, parts = [];
  if (nv) parts.push(`${nv.toLocaleString()} de ${many(c.videos, 'vídeo', 'vídeos')} ${nv === 1 ? 'não tem' : 'não têm'} legendas nem transcrição`);
  if (c.pdfs_image_only) parts.push(`${many(c.pdfs_image_only, 'PDF é digitalizado', 'PDFs são digitalizados')} sem texto`);
  if (c.docs_without_text) parts.push(`${many(c.docs_without_text, 'documento não produziu', 'documentos não produziram')} texto legível na indexação`);
  if (!parts.length) return '';
  const t = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1] : parts[0];
  return t[0].toUpperCase() + t.slice(1) + '. ';
}
// The optional local AI in the desktop app: what it is, where it runs, and its controls. '' in the server version.
function localAbout(st) {
  const l = st.local; if (!l) return '';
  const gb = n => (n / 1e9).toFixed(1) + ' GB';
  const where = (l.placement || []).filter(p => p.bytes > 2e8).map(p => `${gb(p.bytes)} em ${esc(p.device)}`).join(', ');
  const line = { ready: 'em execução agora', stopped: 'pronta; inicia quando você pergunta e para após 15 minutos sem uso', loading: 'iniciando' }[l.state];
  const btn = (a, t) => `<button class="btn plain" onclick="localAI('${a}')">${t}</button>`;
  return line ? `IA local: ${esc(l.name)}, ${line}.${where ? ` Usa ${where}.` : ''} Lê apenas texto.
      <span class="row">${l.state === 'ready' ? btn('stop', 'Parar agora') : ''}${btn('off', 'Desligar')}</span>`
    : l.state === 'off' ? `A IA local está desligada. ${btn('on', 'Ligar')}`
    : `IA local: ${esc(l.message || { absent: 'não adicionada. Adicione em Biblioteca e IA local (cerca de 17 GB).', checking: 'verificando o arquivo…', measuring: 'verificando a memória deste computador…' }[l.state] || l.state)} ${l.state === 'absent' ? '<a class="btn plain" href="/ui/setup.html#manage">Adicionar IA local</a>' : ''}${btn('rescan', 'Verificar novamente')}`;
}
async function localAI(action) {
  try { await fetch('/api/assistant/local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }) } catch { }
  setTimeout(() => { if (location.hash.startsWith('#/about')) route() }, 400);
}
async function about() {
  setTitle('Sobre esta biblioteca');
  let dl = {}, st = {};
  LIB = null;   // About shows the counts as they are now
  const s = await libInfo();
  const oldServer = s.zims === undefined;   // it still serves the reports; this code does not
  try { dl = await api('/api/download-status') } catch { }
  try { st = await fetch('/api/assistant/status').then(r => r.json()) } catch { }   // not api(): this answer names an error when no model is running, and still holds what is wanted
  const ch = dl.channels && dl.channels.counts, ix = st.index || {};
  main.innerHTML = `<h1>Sobre esta biblioteca</h1>
  <p class="lead">Manuais públicos, guias de saúde, cursos, vídeos e enciclopédias mantidos neste computador para funcionar quando a internet e os telefones falharem.</p>
  <div class="cards2" style="margin-top:16px">
   <div class="card"><b>O que há nela</b><small>${(s.pdfs || 0).toLocaleString()} manuais em PDF (${(s.pdf_pages || 0).toLocaleString()} páginas), ${(s.web_pages || 0).toLocaleString()} páginas salvas, ${(s.videos || 0).toLocaleString()} vídeos baixados e ${s.collections || 0} enciclopédias completas.</small></div>
   ${ch ? `<div class="card"><b>Ainda chegando</b><small>${ch.pending.toLocaleString()} vídeos na fila e ${ch.downloading} baixando. Vídeos na fila ainda não estão na biblioteca — aparecem após o término do download.</small></div>` : ''}
   <div class="card"><b>Assistente</b><small>${localAbout(st) || (st.online ? `Modelo local ${esc(st.model)} — disponível.` : 'Nenhum modelo local está em execução, portanto o Chat não pode escrever respostas agora. Guias, busca, vídeos e o mapa funcionam sem ele.')} ${ix.chunks ? `Índice semântico: ${ix.chunks.toLocaleString()} trechos de ${ix.docs.toLocaleString()} documentos${ix.pending ? `, ${ix.pending.toLocaleString()} ainda por indexar` : ''}.` : ''}</small></div>
   <div class="card"><b>O que o assistente não enxerga</b><small>${blind(st.coverage)}Ele também não vê imagens em vídeos nem dados brutos de mapa. Lê apenas texto${st.vision === false ? '' : ' (e imagens de páginas quando solicita)'} e avisa quando não encontra nada.${st.coverage && st.coverage.remote_videos ? ` ${st.coverage.remote_videos} vídeos estão em unidade remota e reproduzem apenas quando esse computador está acessível.` : ''}</small></div>
   ${IN_WINDOW && window.LBUpdate ? LBUpdate.card() : ''}
  </div>
  <h2>Como as fontes são classificadas</h2><ul>
   <li><b>Orientação internacional de saúde e humanitária</b> — OMS (WHO), Cruz Vermelha / Crescente Vermelho, MSF, UNICEF, Esfera (Sphere), St John Ambulance.</li>
   <li><b>Guia comunitário Hesperian</b> — “Onde Não Há Médico” e livros relacionados.</li>
   <li><b>Orientação governamental</b> — Ministério da Saúde, SUS, SAMU 192, Anvisa, Fiocruz, Defesa Civil, Corpo de Bombeiros, Embrapa, ANA, CPRM/SGB, IBGE e órgãos equivalentes internacionais (FEMA, CDC, EPA, USDA, NOAA).</li>
   <li><b>Universidade / extensão rural</b> — ex.: EMATER, universidades públicas brasileiras, National Center for Home Food Preservation, UC extension.</li>
   <li><b>Manual do fabricante</b> — válido apenas para o modelo exato informado.</li>
   <li><b>Enciclopédia colaborativa</b> e <b>vídeo de criadores</b> — referência complementar; confira qualquer procedimento de risco em um manual técnico.</li></ul>
  <h2>O que este guia não faz</h2><ul>
   <li>Ele aponta para as páginas originais; os guias não criam instruções médicas, químicas ou elétricas próprias. As respostas do assistente destacam quais frases vêm de uma página citada e quais são raciocínio próprio do modelo.</li>
   <li>Nada aqui substitui atendimento profissional. Cada guia exibe os próprios limites das fontes.</li>
   <li>Ler e assistir não substituem a prática supervisionada. Suas marcações permanecem apenas neste dispositivo.</li>
   ${s.pack ? '' : '<li>Listas de compras e suprimentos em relatórios antigos são planejamentos, não garantia de estoque disponível.</li>'}</ul>
  ${s.sources ? `<h2>Fontes e créditos</h2><p><a href="#/read/${encodeURIComponent(s.sources)}?${fromQ()}">Fontes e permissões</a>: todas as instituições desta biblioteca, de onde vieram e como solicitar remoção.</p>` : ''}
  ${IN_WINDOW ? '' : '<h2>Como usar no celular</h2><p>Celulares na mesma rede Wi-Fi (sem precisar de internet) podem acessar o guia quando este computador iniciá-lo com <code>server.py --lan</code>. Os celulares precisam do link de acesso exibido no terminal na primeira vez.</p>'}
  ${oldServer ? '<h2>Outros acessos</h2><p><a href="/reports/gap-closure-status.html" target="_blank">Relatório de lacunas</a> · <a href="/reports/learning-pathways.html" target="_blank">Roteiros de aprendizado</a> · <a href="/reports/survival-tools-cart.html" target="_blank">Planejamento de suprimentos</a></p>' : ''}`;
  if (IN_WINDOW && window.LBUpdate) LBUpdate.mount(main);   // Check for updates (web/update.js): only when the person asks
}

route();
if ('serviceWorker' in navigator && /^(127\.0\.0\.1|localhost)$/.test(location.hostname)) navigator.serviceWorker.register('/sw.js').catch(() => { });
