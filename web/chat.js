'use strict';
/* "Ask the library" — chat with the local model, grounded in the library. Conversations stay on this device only. */
const Chat = (() => {
  const STARTERS = [
    ['water', 'Faltou água da rua. Como torno a água segura para beber?'],
    ['hurt', 'Alguém sofreu um corte fundo que não para de sangrar. O que fazer?'],
    ['power', 'Como usar um gerador com segurança durante uma queda de energia?'],
    ['food', 'A geladeira ficou desligada por 6 horas. Quais alimentos ainda são seguros?'],
    ['sanitation', 'Os vasos sanitários não funcionam. Como fazer um banheiro de emergência?'],
    ['comms', 'A rede de celular caiu. Como nossa família pode manter contato?'],
    ['grow', 'Quais hortaliças posso plantar neste mês?'],
    ['repair', 'Como trocar o óleo de um gerador Honda EU2200i?'],
  ];
  const ABOUT_STARTERS = { doc: ['Explique esta página em palavras simples', 'Quais são os avisos desta página?', 'Existe algum vídeo que mostre isto?'],
    video: ['Resuma o que este vídeo mostra', 'Quais pontos de segurança este vídeo destaca?', 'Encontre uma página de manual que trate do mesmo assunto'],
    topic: ['O que devo fazer primeiro?', 'Quais são os avisos mais importantes?', 'Qual vídeo devo assistir primeiro?'] };
  const STATES = { starting: 'Iniciando a IA local…', thinking: 'Pensando…', searching: 'Buscando na biblioteca…', reading: 'Lendo as páginas encontradas…', writing: 'Escrevendo a resposta…' };
  let chats = load(), live = {};   // live[chatId] = {abort, state, steps}
  let status = null;

  function load() { try { return JSON.parse(localStorage.getItem('sg.chats')) || [] } catch { return [] } }
  const keep = () => { try { return localStorage.getItem('sg.chatKeep') !== 'no' } catch { return true } };
  const hideThought = () => { try { return localStorage.getItem('sg.hideThought') !== 'no' } catch { return true } };
  function persist() { if (!keep()) return; try { localStorage.setItem('sg.chats', JSON.stringify(chats.slice(0, 60))) } catch { } }
  const byId = id => chats.find(c => c.id === id);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const count = () => chats.length;

  async function getStatus() {
    try { status = await (await fetch('/api/assistant/status')).json() } catch { status = { online: false, error: 'server' } }
    return status;
  }

  /* ---------------------------------------------------------------- page -- */
  let root = null, cur = null, aboutCtx = null;
  async function page(main, parts, q) {
    root = main;
    const id = parts[0];
    cur = id ? byId(id) : null;
    if (id && !cur) { swap('#/ask'); return }
    const about = q.get('about');
    aboutCtx = !cur && about ? await describe(about) : (cur && cur.about ? cur.aboutInfo : null);
    document.title = (cur ? cur.title : 'Chat') + ' · Último Livro';
    $('#tbTitle').textContent = cur ? cur.title : 'Chat';
    main.innerHTML = `<div class="chat">
      <aside class="chat-side" id="chatSide" aria-label="Conversas">
        <div class="cs-head"><b>Conversas</b><button class="iconbtn" id="closeSide" aria-label="Fechar lista de conversas">${ico('back')}</button></div>
        <a class="btn plain" href="#/ask" id="newChat2">${ico('ask')}Nova conversa</a>
        <ul class="cs-list" id="csList"></ul>
        <div class="cs-privacy">
          <label><input type="checkbox" id="keepChats" ${keep() ? 'checked' : ''}> Manter histórico de conversas neste dispositivo</label>
          <p class="small muted">As conversas ficam neste dispositivo. Nada é enviado para fora além do assistente deste computador.</p>
          <button class="btn plain" id="clearChats">Apagar todas as conversas</button>
        </div>
      </aside>
      <section class="chat-main">
        <div class="chat-top">
          <button class="btn plain chat-histbtn" id="openSide" aria-label="Mostrar conversas">${ico("clock")}<span>Conversas</span></button>
          <div class="chat-status" id="chatStatus" aria-live="polite"></div>
          <button class="btn plain chat-thinkbtn" id="toggleThink" type="button" aria-pressed="${hideThought()}" title="${hideThought() ? 'Mostrando só a resposta final; clique para ver passos e pensamento' : 'Mostrando passos e pensamento; clique para ver só o resultado'}">${hideThought() ? 'Só resultado (mostrar pensamento)' : 'Não mostrar pensamento'}</button>
          <a class="btn plain" href="#/ask" id="newChat" aria-label="Nova conversa">${ico('ask')}<span>Nova</span></a>
        </div>
        ${q.get('from') && !cur ? `<div style="margin:2px 0 8px">${backButton(q.get('from'))}</div>` : ''}
        <div class="ai-setup" id="aiSetup" hidden></div>
        <div class="chat-log" id="chatLog" role="log" aria-live="polite" aria-label="Conversa"></div>
        <form class="composer" id="composer">
          <div class="ctxchip" id="ctxChip" hidden></div>
          <div class="comp-row">
            <label class="sr" for="chatIn">Sua pergunta</label>
            <textarea id="chatIn" rows="1" placeholder="Faça uma pergunta…" enterkeyhint="send"></textarea>
            <button class="sendbtn" id="sendBtn" aria-label="Enviar">${ico("up")}</button>
          </div>
          <p class="comp-note">As respostas vêm da biblioteca neste computador e podem conter erros. Confira as páginas citadas; busque ajuda treinada para qualquer caso grave.</p>
        </form>
      </section></div>`;
    renderSide(); renderCtx(); renderLog();
    const ta = $('#chatIn');
    ta.addEventListener('input', autosize);
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#composer').requestSubmit() }
      if (e.key === 'Escape') stop();
    });
    $('#composer').addEventListener('submit', e => { e.preventDefault(); if (busy()) return stop(); send(ta.value) });
    $('#openSide').onclick = () => $('#chatSide').classList.add('open');
    $('#closeSide').onclick = () => $('#chatSide').classList.remove('open');
    $('#toggleThink').onclick = () => {
      const next = !hideThought();
      try { localStorage.setItem('sg.hideThought', next ? 'yes' : 'no') } catch { }
      const bt = $('#toggleThink');
      if (bt) {
        bt.setAttribute('aria-pressed', String(next));
        bt.textContent = next ? 'Só resultado (mostrar pensamento)' : 'Não mostrar pensamento';
        bt.title = next ? 'Mostrando só a resposta final; clique para ver passos e pensamento' : 'Mostrando passos e pensamento; clique para ver só o resultado';
      }
      renderLog();
      toast(next ? 'Mostrando apenas o resultado' : 'Mostrando passos e pensamento');
    };
    $('#keepChats').onchange = e => {
      try { localStorage.setItem('sg.chatKeep', e.target.checked ? 'yes' : 'no') } catch { }
      if (!e.target.checked) { try { localStorage.removeItem('sg.chats') } catch { } toast('As conversas serão esquecidas ao fechar esta página') } else { persist(); toast('As conversas serão mantidas neste dispositivo') }
    };
    $('#clearChats').onclick = () => { if (!confirm('Apagar todas as conversas neste dispositivo?')) return; Object.values(live).forEach(l => l.abort && l.abort()); chats = []; try { localStorage.removeItem('sg.chats') } catch { } location.hash = '#/ask' };
    leaving = () => { document.removeEventListener('keydown', escStop) };
    document.addEventListener('keydown', escStop);
    statusLine();
    const initial = q.get('q');
    if (initial && !cur) { history.replaceState(null, '', '#/ask'); send(initial) }
    else if (matchMedia('(hover:hover)').matches) setTimeout(() => ta.focus({ preventScroll: true }), 60);
    const y = scrolls[here()];
    if (y != null) requestAnimationFrame(() => scrollTo(0, y)); else if (cur && cur.messages.length) scrollEnd(true); else scrollTo(0, 0);   // a new chat opens at its top
  }
  const escStop = e => { if (e.key === 'Escape' && busy()) stop() };
  function autosize() { const ta = $('#chatIn'); if (!ta) return; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 180) + 'px' }
  const busy = () => cur && live[cur.id] && live[cur.id].running;
  // The optional local AI (desktop app): [ready?, the line to show]. The server version has no s.local.
  function localLine(l) {
    const gb = n => (n / 1e9).toFixed(0) + ' GB';
    return ({
      ready: [true, 'IA local pronta'],
      stopped: [true, 'IA local pronta · inicia quando você perguntar'],
      loading: [true, `Iniciando a IA local${l.pct ? ' ' + l.pct + '%' : '…'}`],
      checking: [false, `Verificando o arquivo da IA local${l.pct != null ? ' ' + l.pct + '%' : '…'}`],
      measuring: [false, 'Verificando a memória deste computador…'],
      absent: [false, 'Nenhuma IA local adicionada'],
      wrong: [false, l.message || 'O arquivo da IA local não é o correto.'],
      too_big: [false, l.message || `A IA local precisa de cerca de ${gb(l.needs_bytes || 0)} de memória.`],
      off: [false, 'IA local desligada'],
      error: [false, l.message || 'A IA local não pôde iniciar.'],
    })[l.state] || [false, l.message || 'IA local indisponível'];
  }
  let polling = null;
  async function statusLine() {
    const s = await getStatus(), el = $('#chatStatus'); if (!el) return;
    const ix = s.index || {}, l = s.local;
    const still = ix.state === 'indexing' || ix.state === 'indexing (other process)' ? ` · <span class="muted">ainda indexando (${(ix.chunks || 0).toLocaleString()} trechos até agora)</span>` : '';
    const models = (l && l.installed_models) || [];
    const selHtml = models.length > 1
      ? ` <select id="chatModelSel" class="chat-model-sel" aria-label="Modelo de IA">${models.map(m => `<option value="${esc(m.id)}"${m.id === l.model_id ? ' selected' : ''}>${esc(m.title || m.name)}</option>`).join('')}</select>`
      : '';
    if (l && (/ready|stopped|loading/.test(l.state) || !s.online)) {
      const [ok, line] = localLine(l);
      el.innerHTML = `<span class="${ok ? 'dotok' : 'dotoff'}"></span><span>${esc(line)}${!models.length && l.title ? '' : models.length === 1 ? ' · ' + esc(l.title) : ''}${ok ? still : '<span class="long"> — a busca e a leitura continuam funcionando</span>'}</span>${selHtml}`;
    } else {
      el.innerHTML = s.online ? `<span class="dotok"></span>Assistente local pronto${still}${selHtml}`
        : `<span class="dotoff"></span><span>Assistente offline<span class="long"> — a busca e a navegação continuam funcionando</span></span>`;
    }
    const msel = $('#chatModelSel');
    if (msel) msel.onchange = async () => {
      msel.disabled = true;
      try {
        await fetch('/api/assistant/local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'select', model_id: msel.value }) });
        toast('Trocando modelo de IA local…');
      } catch { }
      setTimeout(statusLine, 500);
    };
    const sb = $('#sendBtn'); if (sb) sb.title = s.online ? 'Enviar' : 'O assistente está offline; você receberá as páginas correspondentes';
    setupCard(s);
    clearTimeout(polling);
    if (l && /checking|measuring|loading/.test(l.state) && $('#chatStatus')) polling = setTimeout(statusLine, 1000);
  }
  // How to add the local AI, on a new chat when it is missing, wrong or off. The file comes from the website, outside the app.
  function setupCard(s) {
    const box = $('#aiSetup'), l = s.local; if (!box) return;
    const show = !!l && !s.online && /absent|wrong|off|error/.test(l.state) && !(cur && cur.messages.length);
    box.hidden = !show;
    if (!show) return;
    box.innerHTML = l.state === 'off'
      ? `<p>A IA local está desligada.</p><div class="row"><button class="btn" data-ai="on">Ligar</button></div>`
      : l.state === 'error' ? `<p>${esc(l.message || 'A IA local não pôde iniciar.')}</p><div class="row"><button class="btn" data-ai="rescan">Verificar novamente</button></div>`
      : `<p><b>Adicione a IA local para receber respostas escritas.</b> Ela tem cerca de 17 GB e roda apenas neste computador.</p>
         <div class="row"><a class="btn" href="/ui/setup.html#manage">Adicionar IA local</a><button class="btn plain" data-ai="rescan">Verificar novamente</button></div>
         <p class="small">Já baixou <code>${esc(l.file)}</code>? Coloque na pasta <b>LastbookData</b> ou em Downloads e clique em Verificar novamente.</p>`;
    $$('[data-ai]', box).forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await fetch('/api/assistant/local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: b.dataset.ai }) }) } catch { }
      setTimeout(statusLine, 300);
    });
  }
  async function describe(about) {
    const [kind, id, n] = about.split(':');
    try {
      if (kind === 'topic') { const t = (await topics()).find(x => x.id === id); return { about, label: t ? (SHORT[id] || t.title) : id, sub: 'Guia', kind } }
      const d = await api('/api/doc/' + encodeURIComponent(id));
      return { about, kind, label: d.title, sub: kind === 'video' ? (n ? 'Vídeo em ' + clock(+n) : 'Vídeo') : 'Página ' + (n || 1), href: kind === 'video' ? `#/watch/${encodeURIComponent(id)}${n ? '?t=' + n : ''}` : `#/read/${encodeURIComponent(id)}?p=${n || 1}` };
    } catch { return null }
  }
  function renderCtx() {
    const el = $('#ctxChip'); if (!el) return;
    const a = aboutCtx;
    if (!a) { el.hidden = true; return }
    el.hidden = false;
    el.innerHTML = `${ico(a.kind === 'video' ? 'video' : a.kind === 'topic' ? 'book' : 'page')}<span>Perguntando sobre: <b>${esc(a.label)}</b> <span class="muted">${esc(a.sub || '')}</span></span>${cur && cur.messages.length ? '' : '<button type="button" aria-label="Não usar isto como contexto" id="ctxX">×</button>'}`;
    const x = $('#ctxX'); if (x) x.onclick = () => { aboutCtx = null; renderCtx(); renderLog() };
  }
  function renderSide() {
    const el = $('#csList'); if (!el) return;
    el.innerHTML = chats.length ? chats.map(c => `<li><a href="#/ask/${c.id}" ${cur && cur.id === c.id ? 'aria-current="page"' : ''}><b>${esc(c.title)}</b><small>${new Date(c.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${c.messages.filter(m => m.role === 'user').length} pergunta${c.messages.filter(m => m.role === 'user').length === 1 ? '' : 's'}</small></a><button class="iconbtn" data-del="${c.id}" aria-label="Excluir esta conversa">×</button></li>`).join('')
      : '<li class="muted small" style="padding:8px 4px">Nenhuma conversa ainda.</li>';
    const clr = $('#clearChats'); if (clr) clr.hidden = !chats.length;   // nothing to delete
    $$('[data-del]', el).forEach(b => b.onclick = () => { const id = b.dataset.del; live[id]?.abort?.(); chats = chats.filter(c => c.id !== id); persist(); if (cur && cur.id === id) location.hash = '#/ask'; else renderSide() });
    // the list fades at an edge with more chats past it, so a row cut off there reads as more to scroll to
    const edge = () => { const more = el.scrollHeight - el.clientHeight; el.classList.toggle('more-b', more > 1 && el.scrollTop < more - 1); el.classList.toggle('more-t', more > 1 && el.scrollTop > 1) };
    el.onscroll = edge; edge();
    if (!el.lbEdge) { el.lbEdge = new ResizeObserver(edge); el.lbEdge.observe(el) }
  }

  /* --------------------------------------------------------------- log --- */
  function renderLog() {
    const log = $('#chatLog'); if (!log) return;
    if (!cur || !cur.messages.length) {
      const st = aboutCtx ? ABOUT_STARTERS[aboutCtx.kind] || [] : null;
      log.innerHTML = `<div class="chat-empty">
        <div class="ce-mark">${ico('ask')}</div>
        <h1>Chat</h1>
        <p class="lead">As respostas são construídas apenas com os manuais, guias e transcrições de vídeos deste computador — com a página ou momento exato de cada informação.</p>
        <div class="starters">${(st ? st.map(t => ['ask', t]) : STARTERS).map(([i, t]) => `<button class="starter" ${tcStyle(i)} data-start="${esc(t)}"><span class="ico">${ico(i)}</span><span>${esc(t)}</span></button>`).join('')}</div>
        <p class="small muted" style="margin-top:18px">Lê apenas texto: não enxerga o conteúdo de vídeos sem legenda, páginas digitalizadas sem texto nem arquivos brutos de mapa. Avisa quando a biblioteca não tem nada sobre uma pergunta.</p></div>`;
      $$('[data-start]', log).forEach(b => b.onclick = () => send(b.dataset.start));
      fitEmpty();
      return;
    }
    log.innerHTML = cur.messages.map((m, i) => m.role === 'user' ? `<div class="msg user"><div class="bubble">${esc(m.content)}</div></div>` : `<div class="msg bot" id="m${i}">${botHtml(m, i)}</div>`).join('');
    wire(log);
  }
  // The page itself never scrolls while a chat is empty: in a window too short for every suggestion (or with lines wrapped narrow beside
  // the chats column), the last ones go, a row at a time down to one row, then the note under them, the introduction and the mark.
  function fitEmpty() {
    const e = $('.chat-empty'); if (!e) return;
    const all = $$('.starter', e), extra = ['p.small', '.lead', '.ce-mark'].map(s => $(s, e)).filter(Boolean);
    [...all, ...extra].forEach(x => x.style.removeProperty('display'));
    const over = () => document.scrollingElement.scrollHeight > innerHeight;
    if (!over()) return;
    const shown = all.filter(x => x.offsetWidth);
    for (let k = shown.length; k > 2 && over(); k -= 2) shown.slice(k - 2, k).forEach(x => x.style.display = 'none');
    for (const x of extra) if (over()) x.style.display = 'none';
  }
  addEventListener('resize', () => { if ($('.chat-empty')) fitEmpty() });
  function updateBot(i) {
    const el = $('#m' + i); if (!el || !cur) return renderLog();
    el.innerHTML = botHtml(cur.messages[i], i); wire(el);
  }
  function botHtml(m, i) {
    const l = live[cur.id], running = l && l.running && i === cur.messages.length - 1;
    const noThought = hideThought();
    const steps = (m.steps || []).map(s => `<li>${stepText(s)}</li>`).join('');
    const found = m.sources || [];
    const shownContent = m.content ? cleanThought(m.content, noThought, running) : '';
    const showState = running && noThought && m.state === 'writing' && !shownContent.trim() ? 'thinking' : m.state;
    let h = '';
    if (running) h += `<div class="working"><span class="pulse"></span><b>${esc(STATES[showState] || 'Processando…')}${m.state === 'starting' && m.pct ? ` ${m.pct}%` : ''}</b>${!noThought && steps ? `<ul class="steps">${steps}</ul>` : ''}</div>`;
    if (m.error) h += `<div class="ans-error">${ico('warn')}<div><b>${esc(m.error)}</b>${m.offline ? '<p>Você pode continuar navegando e pesquisando. Estas são as páginas mais próximas da sua pergunta:</p>' : ''}</div></div>`;
    if (shownContent.trim()) h += `<div class="answer">${md(shownContent, m)}</div>`;
    if (running && !noThought && found.length) h += `<div class="prefound"><p class="small muted">Páginas encontradas até agora — você pode abri-las enquanto a resposta é escrita:</p>${srcCards(found.slice(0, 6), true)}</div>`;
    if (m.fallback) h += srcCards(m.fallback, true);
    if (!running && m.content) {
      const cited = m.cited || [];
      if ((m.invalid || []).length) h += `<p class="small" style="color:var(--stop)">O modelo citou fontes inexistentes (${m.invalid.join(', ')}); essas marcações foram removidas.</p>`;
      h += `<div class="legend small"><span><span class="lg-c">1</span> vinculado a uma página ou vídeo</span><span><span class="lg-u">pontilhado</span> texto próprio do modelo, sem vínculo a uma fonte</span></div>`;
      if (cited.length) h += `<h3 class="srch">Fontes (${cited.length})</h3>${srcCards(cited, false)}`;
      else h += `<p class="notice small">Esta resposta não tem fontes vinculadas. Considere-a não verificada.</p>`;
      const other = (m.consulted || []).filter(s => s.kind !== 'place');
      if (!noThought && other.length) h += `<details class="also"><summary>Também consultado (${other.length}, não utilizado)</summary>${srcCards(other.slice(0, 10), true)}</details>`;
      if (!noThought && (m.steps || []).length) h += `<details class="also"><summary>Como buscou (${m.steps.length} ${m.steps.length === 1 ? 'passo' : 'passos'}${m.latency ? `, ${m.latency.total_s}s` : ''})</summary><ul class="steps">${steps}</ul></details>`;
      h += `<div class="ans-actions"><button class="btn plain" data-act="copy" data-i="${i}">Copiar</button><button class="btn plain" data-act="save" data-i="${i}">${ico('save')}Salvar resposta</button><button class="btn plain" data-act="export">Exportar conversa</button>${i === cur.messages.length - 1 ? `<button class="btn plain" data-act="retry">Perguntar novamente</button>` : ''}</div>`;
    }
    return h;
  }
  function stepText(s) {
    const a = s.args || {}, r = s.summary || {};
    if (s.name === 'search_library') return `Buscou “${esc(a.query || '')}”${a.kind && a.kind !== 'any' ? ' (' + (a.kind === 'manual' ? 'manuais' : a.kind === 'video' ? 'vídeos' : esc(a.kind)) + ')' : ''} — ${r.count ?? '…'} trecho${r.count === 1 ? '' : 's'}`;
    if (s.name === 'read_pages') return r.error ? 'Tentou ler um documento desconhecido' : `Leu ${esc(r.title || a.doc_id)}, página${(a.pages || []).length > 1 ? 's' : ''} ${(a.pages || []).join(', ')}`;
    if (s.name === 'view_page') return r.error ? 'Não foi possível ver essa página' : `Observou a imagem de ${esc(r.title || '')}, página ${esc(a.page)}`;
    if (s.name === 'get_timed_transcript') return r.error ? `Sem transcrição para ${esc(r.title || 'esse vídeo')}` : `Leu a transcrição de ${esc(r.title || '')}`;
    if (s.name === 'lookup_place') return `Buscou “${esc(a.query || '')}” no mapa offline`;
    if (s.name === 'found') return `Encontrou ${s.count} trecho${s.count === 1 ? '' : 's'} para sua pergunta`;
    return esc(s.name);
  }
  function srcHref(s) {
    if (s.kind === 'place') return `#/map?lat=${s.lat}&lon=${s.lon}&z=16&pin=${encodeURIComponent(s.title || s.name || 'Local da resposta')}`;
    if (s.kind === 'zim' || String(s.doc_id || '').startsWith('zim:')) return `#/wiki/${String(s.doc_id || '').replace(/^zim:/, '')}?from=${encodeURIComponent(here())}`;
    if (s.kind === 'video') return `#/watch/${encodeURIComponent(s.doc_id)}?${s.t != null ? 't=' + Math.floor(s.t) + '&' : ''}from=${encodeURIComponent(here())}`;
    return `#/read/${encodeURIComponent(s.doc_id)}?${s.page ? 'p=' + s.page + '&' : ''}from=${encodeURIComponent(here())}`;
  }
  function srcCards(list, compact) {
    return `<div class="srccards ${compact ? 'compact' : ''}">${list.map(s => {
      let pv;
      if (s.kind === 'video') pv = `<span class="pv v">${s.thumb ? `<img loading="lazy" alt="" src="${fileUrl(s.thumb)}">` : ''}<span class="pg">${s.t != null ? clock(s.t) : 'vídeo'}</span></span>`;
      else if (s.kind === 'pdf' && s.page) pv = `<span class="pv"><img loading="lazy" alt="" src="/api/page/${encodeURIComponent(s.doc_id)}/${s.page}.png?w=300" onerror="this.remove()"><span class="pg">p. ${s.page}</span></span>`;
      else pv = `<span class="pv w">${ico(s.kind === 'place' ? 'pin' : s.kind === 'zim' ? 'wiki' : 'page')}</span>`;
      const where = s.kind === 'video' ? (s.t != null ? 'em ' + clock(s.t) : '') : s.page ? `página ${s.page}${s.pages ? ' de ' + s.pages : ''}` : '';
      return `<a class="srccard" href="${srcHref(s)}" id="src-${esc(s.key || '')}">${pv}<span class="sc-body">${s.key ? `<span class="sc-key">${esc(s.key.replace(/^S/, ''))}</span>` : ''}<b>${esc(s.title)}</b>
        <small>${esc(s.publisher || '')}${s.year ? ' · ' + esc(s.year) : ''}${where ? ' · ' + where : ''}${s.trust ? ' · ' + esc(s.trust) : ''}</small>
        ${!compact && s.excerpt ? `<span class="sc-ex">“${esc(s.excerpt.slice(0, 220))}${s.excerpt.length > 220 ? '…' : ''}”</span>` : ''}
        ${s.image ? '<span class="sc-tag">diagrama visualizado</span>' : ''}</span></a>`;
    }).join('')}</div>`;
  }

  const META_SELF_RE = /(?:^\s*\**(?:o usu[áa]rio|a usu[áa]ria|a pergunta|o pedido|a solicita[çc][ãa]o)\b)|\b(?:o usu[áa]rio est[áa] perguntando|o usu[áa]rio quer saber|o usu[áa]rio pede)\b|\b(?:preciso (?:procurar|buscar|analisar|avaliar|verificar|encontrar|ler|consultar|responder|extrair|identificar|sintetizar|incluir|citar))\b|\b(?:vou (?:procurar|buscar|analisar|avaliar|verificar|estruturar|organizar|dividir|incluir|citar|responder|consultar|chamar))\b|\b(?:vamos (?:analisar|buscar|procurar|avaliar|verificar|olhar|examinar|estruturar))\b|\b(?:os resultados (?:iniciais|fornecidos|da busca)|os trechos fornecidos|as fontes fornecidas)\b|\b(?:search_library|read_pages|lookup_place|get_timed_transcript|view_page)\b|(?:^\s*\**(?:the user is asking|the user wants|let'?s analyze|i need to search|i should check)\b)/i;
  const META_STEP_RE = /^\s*(?:[-*•]|\d+[.)]|#{1,4})?\s*\**(?:analisar|an[áa]lise|buscar|busca|procurar|avaliar|avalia[çc][ãa]o|verificar|verifica[çc][ãa]o|identificar|identifica[çc][ãa]o|extrair|extra[çc][ãa]o|selecionar|sele[çc][ãa]o|consultar|consulta|sintetizar|s[íi]ntese|estruturar|estrutura[çc][ãa]o|estrutura da resposta|formular|formula[çc][ãa]o|planejar|planejamento|organizar|organiza[çc][ãa]o|revisar|revis[ãa]o|responder|objetivo|plano|racioc[íi]nio|pensamento)\b[^:\n]{0,60}\b(?:resultados?|pergunta|fontes?|documentos?|trechos?|informa[çc][õo]es|pedido|solicita[çc][ãa]o|busca|biblioteca|p[áa]ginas?|resposta|texto|relev[âa]ncia|dados|cita[çc][õo]es|contexto|usu[áa]rio|inicial|iniciais|relevantes?|espec[íi]ficas?)/i;
  const META_SOURCE_RE = /^\s*(?:[-*•]|\d+[.)])?\s*\**(?:(?:a fonte|as fontes|fonte|fontes)\s+[SM]\d+|[SM]\d+(?:\s*\([^)]*\))?\s*[:—-]|(?:a fonte|as fontes)\b[^.\n]{0,80}\b(?:menciona|mencionam|fala|falam|trata|tratam|aborda|abordam|indica|indicam|diz|dizem|fornece|fornecem|traz|trazem|destaca|destacam)\b)/i;
  const META_TRANS_RE = /^\s*(?:[-*•]|\d+[.)]|#{1,4})?\s*\**(?:resposta(?: final| direta| ao usu[áa]rio)?|responder(?: ao usu[áa]rio| [àa] pergunta)?|aqui est[áa] a resposta)\**\s*:?\**\s*$/i;
  const META_ANS_INLINE_RE = /^\s*(?:[-*•]|\d+[.)]|#{1,4})?\s*\**(?:resposta(?:\s+(?:final|direta|ao\s+usu[áa]rio))?|responder(?:\s+(?:ao\s+usu[áa]rio|[àa]\s+pergunta))?|aqui\s+est[áa]\s+a\s+resposta)\**\s*:\**\s+(.+)$/i;
  const META_START_RE = /^\s*(?:[-*•]|\d+[.)]|#{1,4})?\s*[#*\s]*(?:o\b|a\b|os\b|as\b|precis|vou\b|vam|analis|an[áa]lis|busc|procur|avali|verific|identific|extra|selecion|consult|sintetiz|estrutur|formul|planej|organiz|revis|respond|objetiv|plan|racioc|pensament|font|respost|aqui\b|the\b|let|i\b|thought|thinking)/i;

  function cleanThought(text, noThought, streaming) {
    let s = String(text || '')
      .replace(/<\|channel>[\s\S]*?<channel\|>/gi, '')
      .replace(/<\|channel>thought[\s\S]*$/gi, '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<think>[\s\S]*$/gi, '')
      .replace(/<\|tool_call>[\s\S]*$/gi, '');
    if (!noThought) return s;
    const raw = s.replace(/\r/g, '');
    const endsNl = raw.endsWith('\n');
    const lines = raw.split('\n');
    const kept = [];
    let hadMeta = false, started = false;
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i], t = ln.trim();
      if (started) { kept.push(ln); continue }
      if (!t) continue;
      const isMeta = META_SELF_RE.test(t) || META_STEP_RE.test(t) || META_SOURCE_RE.test(t) || (hadMeta && /^[-*•]\s+\**[SM]\d+\b/.test(t));
      if (streaming && i === lines.length - 1 && !endsNl) {
        if (isMeta || META_TRANS_RE.test(t)) { hadMeta = true; continue }
        if (!/\[[SM]\d+\]/.test(t) && (hadMeta || (META_START_RE.test(t) && t.length < 64) || t.length < 28)) continue;
      }
      if (META_TRANS_RE.test(t) || isMeta) { hadMeta = true; continue }
      const mAns = META_ANS_INLINE_RE.exec(ln);
      if (mAns) { kept.push(mAns[1]); started = true; continue }
      kept.push(ln);
      started = true;
    }
    return kept.join('\n');
  }

  /* markdown-lite with citation chips; sentences without a citation are marked as the model's own wording */
  function md(text, m) {
    const noThought = hideThought();
    text = cleanThought(text, noThought, !!m.running);
    const keys = new Set((m.cited || m.sources || []).map(s => s.key));
    const cite = k => keys.has(k) || !m.cited ? `<a class="cite" href="#src-${k}" data-key="${k}" title="Fonte ${k}">${k.replace(/^S/, '')}</a>` : '';
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|\W)\*(?!\s)(.+?)\*(?=\W|$)/g, '$1<em>$2</em>')
      .replace(/\[([SM]\d+)\]/g, (_, k) => cite(k));
    const lines = text.replace(/\r/g, '').split('\n');
    let out = '', list = null, section = 'main', inSec = false;
    const close = () => { if (list) { out += `</${list}>`; list = null } };
    const mark = raw => {  // wrap sentences that carry no citation (main sections only)
      if (section !== 'main' || m.running) return inline(raw);
      return raw.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý(“"])/).map(sn => /\[[SM]\d+\]/.test(sn) || sn.replace(/\*|_/g, '').trim().length < 28 || /:$/.test(sn.trim()) ? inline(sn) : `<span class="uncited" title="Não vinculado a uma fonte">${inline(sn)}</span>`).join(' ');
    };
    for (let ln of lines) {
      const t = ln.trim();
      if (!t) { close(); continue }
      const head = /^#{1,4}\s+(.*)$/.exec(t) || /^\*\*([^*]+:)\*\*$/.exec(t) || /^\*\*([^*]+)\*\*:?$/.exec(t);
      const hText = head ? head[1] : '';
      const sec = /não encontrado na biblioteca|not found in the library/i.test(t) ? 'missing' : /as fontes divergem|sources disagree/i.test(t) ? 'disagree' : /raciocínio próprio|own reasoning/i.test(t) ? 'reasoning' : null;
      if (sec || head) {
        close();
        if (inSec) { out += '</div>'; inSec = false }
        section = sec || (head ? 'main' : section);
        if (noThought && section === 'reasoning') continue;
        if (sec) { inSec = true; out += `<div class="sec-${sec}"><h4>${sec === 'missing' ? 'Não encontrado na biblioteca' : sec === 'disagree' ? 'As fontes divergem' : 'Raciocínio próprio do modelo — fora da biblioteca'}</h4>`; const rest = t.replace(/^[#*\s]*(não encontrado na biblioteca|not found in the library|as fontes divergem|sources disagree|raciocínio próprio \(fora da biblioteca\)|raciocínio próprio|my own reasoning \(not from the library\)|my own reasoning)[:*\s]*/i, ''); if (rest) out += `<p>${inline(rest)}</p>`; continue }
        out += `<h4>${inline(hText.replace(/:$/, ''))}</h4>`; continue;
      }
      if (noThought && section === 'reasoning') continue;
      const ul = /^[-*•]\s+(.*)$/.exec(t), ol = /^(\d+)[.)]\s+(.*)$/.exec(t);
      if (ul || ol) {
        const want = ul ? 'ul' : 'ol';
        if (list !== want) { close(); out += `<${want}>`; list = want }
        out += `<li>${mark(ul ? ul[1] : ol[2])}</li>`; continue;
      }
      close(); out += `<p>${mark(t)}</p>`;
    }
    close();
    if (inSec) out += '</div>';
    return out;
  }

  function wire(el) {
    $$('[data-act]', el).forEach(b => b.onclick = () => {
      const i = +b.dataset.i, m = cur.messages[i];
      if (b.dataset.act === 'copy') { navigator.clipboard?.writeText(plain(m)).then(() => toast('Copiado'), () => toast('Não foi possível copiar')) }
      if (b.dataset.act === 'save') {
        const q = cur.messages[i - 1]?.content || cur.title;
        toggleSave({ key: `a:${cur.id}:${i}`, title: 'Resposta: ' + q.slice(0, 80), href: '#/ask/' + cur.id, sub: `${(m.cited || []).length} fontes · ${new Date().toLocaleDateString()}` }, null);
      }
      if (b.dataset.act === 'export') exportChat(cur);
      if (b.dataset.act === 'retry') { const q = cur.messages[cur.messages.length - 2]?.content; cur.messages.splice(-2, 2); send(q) }
    });
    // citation chips scroll to their card instead of changing the route
    $$('a.cite', el).forEach(a => a.onclick = e => { e.preventDefault(); const c = $('#src-' + a.dataset.key, el.closest('.msg') || el); if (c) { c.scrollIntoView({ block: 'center', behavior: 'smooth' }); c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 1200) } });
  }
  function plain(m) {
    const map = Object.fromEntries((m.cited || []).map(s => [s.key, s]));
    let t = cleanThought(m.content, hideThought(), false).replace(/\[([SM]\d+)\]/g, (_, k) => map[k] ? `[${k.replace(/^S/, '')}]` : '');
    if ((m.cited || []).length) t += '\n\nFontes:\n' + m.cited.map(s => `[${s.key.replace(/^S/, '')}] ${s.title} — ${s.publisher || ''}${s.year ? ', ' + s.year : ''}${s.page ? ', página ' + s.page : ''}${s.t != null ? ', em ' + clock(s.t) : ''}  ${location.origin}/${srcHref(s).replace(/&?from=[^&]*/, '')}`).join('\n');
    return t;
  }
  function exportChat(c) {
    let md = `# ${c.title}\n\nExportado do Último Livro (biblioteca offline) em ${new Date().toLocaleString()}.\nAs respostas foram escritas por um modelo de IA local a partir dos documentos da biblioteca. Confira as páginas vinculadas; busque ajuda treinada para qualquer caso grave.\n`;
    for (const m of c.messages) md += m.role === 'user' ? `\n## Pergunta\n\n${m.content}\n` : `\n## Resposta\n\n${m.content ? plain(m) : '(sem resposta: ' + (m.error || 'interrompido') + ')'}\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    a.download = `conversa-sobrevivencia-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 500);
    toast('Salvo como arquivo neste dispositivo');
  }
  // Earlier answers' [S#] keys only mean something inside their own turn; give the model readable references instead.
  function history_(c) {
    return c.messages.filter(m => m.content).map(m => {
      if (m.role !== 'assistant') return { role: m.role, content: m.content };
      const map = Object.fromEntries((m.cited || []).map(s => [s.key, s]));
      return { role: 'assistant', content: m.content.replace(/\[([SM]\d+)\]/g, (_, k) => map[k] ? `(${map[k].title}${map[k].page ? ', p. ' + map[k].page : ''}${map[k].t != null ? ', ' + clock(map[k].t) : ''})` : '') };
    });
  }

  /* -------------------------------------------------------------- send --- */
  async function send(text) {
    text = (text || '').trim();
    if (!text) return;
    if (!cur) {
      cur = { id: newId(), title: text.slice(0, 70), created: Date.now(), updated: Date.now(), messages: [], about: aboutCtx ? aboutCtx.about : null, aboutInfo: aboutCtx };
      chats.unshift(cur);
      history.replaceState(null, '', '#/ask/' + cur.id);
    }
    const c = cur;
    c.messages.push({ role: 'user', content: text });
    const m = { role: 'assistant', content: '', state: 'thinking', steps: [], sources: [], running: true };
    c.messages.push(m);
    c.updated = Date.now(); persist();
    const ta = $('#chatIn'); if (ta) { ta.value = ''; autosize() }
    renderSide(); renderCtx(); renderLog(); setBusy(true); scrollEnd(true);
    const idx = c.messages.length - 1, ctl = new AbortController();
    live[c.id] = { running: true, abort: () => ctl.abort() };
    const redraw = throttle(() => { if (cur === c) { updateBot(idx); scrollEnd() } }, 80);
    try {
      const st = await getStatus();
      if (!st.online) throw Object.assign(new Error('offline'), { offline: true, why: st.local && localLine(st.local)[1] });
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history_(c).slice(0, -1).concat([{ role: 'user', content: text }]), about: c.about }), signal: ctl.signal });
      if (!r.ok || !r.body) throw new Error('O servidor recusou a pergunta (' + r.status + ').');
      const rd = r.body.getReader(), dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await rd.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let k;
        while ((k = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, k); buf = buf.slice(k + 2);
          if (!chunk.startsWith('data:')) continue;
          let ev; try { ev = JSON.parse(chunk.slice(5)) } catch { continue }
          onEvent(m, ev);
          redraw();
        }
      }
      if (m.running && !m.content && !m.error) m.error = 'A resposta parou inesperadamente.';
    } catch (e) {
      if (e.name === 'AbortError') { m.stopped = true; if (!m.content) m.error = 'Interrompido.' }
      else if (e.offline || /model_unavailable/.test(e.message)) { m.offline = true; m.error = e.why || 'O modelo assistente local não está em execução no momento.'; await fallback(m, text) }
      else m.error = e.message || 'Algo deu errado.';
    }
    m.running = false; delete m.state;
    if (m.stopped && m.content) m.content += '\n\n(Interrompido.)';
    live[c.id].running = false;
    c.updated = Date.now(); persist();
    if (cur === c) { updateBot(idx); setBusy(false); scrollEnd(); const t = $('#chatIn'); if (t && matchMedia('(hover:hover)').matches) t.focus({ preventScroll: true }) }
  }
  function onEvent(m, ev) {
    if (ev.type === 'state') { m.state = ev.state; m.pct = ev.pct }
    else if (ev.type === 'found') m.steps.push({ name: 'found', count: ev.count });
    else if (ev.type === 'tool') { if (ev.phase === 'start') m.steps.push({ name: ev.name, args: ev.args }); else { const s = [...m.steps].reverse().find(x => x.name === ev.name && !x.summary); if (s) s.summary = ev.summary } m.state = 'searching' }
    else if (ev.type === 'sources') m.sources = ev.sources;
    else if (ev.type === 'delta') m.content += ev.text;
    else if (ev.type === 'reset') m.content = '';
    else if (ev.type === 'done') { m.content = ev.answer; m.cited = ev.sources; m.consulted = ev.consulted; m.invalid = ev.invalid; m.latency = ev.latency; m.content = m.content.replace(/\[([SM]\d+)\]/g, (x, k) => (ev.invalid || []).includes(k) ? '' : x) }
    else if (ev.type === 'error') {
      if (ev.error === 'model_unavailable') { m.offline = true; m.error = ev.text; fallback(m, (cur.messages[cur.messages.length - 2] || {}).content || '') }
      else { m.error = ev.text; if (ev.sources) m.fallback = ev.sources.slice(0, 8) }
    }
    else if (ev.type === 'stopped') m.stopped = true;
  }
  async function fallback(m, q) {
    try { const d = await api('/api/retrieve?q=' + encodeURIComponent(q) + '&k=8'); m.fallback = d.results.map((r, i) => ({ ...r, key: '' })); if (!m.fallback.length) m.error += ' A busca na biblioteca também não encontrou nada para esta pergunta.' }
    catch { m.fallback = [] }
  }
  function stop() { if (cur && live[cur.id]) live[cur.id].abort() }
  function setBusy(on) {
    const b = $('#sendBtn'); if (!b) return;
    b.innerHTML = on ? '<span class="stopsq"></span>' : ico('up');
    b.setAttribute('aria-label', on ? 'Interromper a resposta' : 'Enviar');
    b.classList.toggle('stop', on);
  }
  function scrollEnd(force) {
    const near = innerHeight + scrollY > document.body.scrollHeight - 260;
    if (force || near) requestAnimationFrame(() => scrollTo(0, document.body.scrollHeight));
  }
  function throttle(f, ms) { let t = 0, p = null; return () => { const n = Date.now(); if (n - t > ms) { t = n; f() } else { clearTimeout(p); p = setTimeout(() => { t = Date.now(); f() }, ms) } } }

  return { page, count };
})();
