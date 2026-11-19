'use strict';
/* Lastbook setup: choose a library and the local AI, then download, check, unpack and switch. The contract is docs/SETUP-API.md.
   Works on its own page in setup mode (no library, so none of /api/topics and the rest) and inside the app (Library → Library and local AI).
   Views: manage (what is here now), choose (what to get), job (progress, pause, errors), done. Plain fetch: in the app the bridge adds the key. */
(() => {
  const $ = s => document.querySelector(s);
  const main = $('#main'), live = $('#live');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const WIN = document.documentElement.classList.contains('plat-win');
  const UNIT = WIN ? 1024 : 1000;   // each system's own way of counting a gigabyte, so the numbers match Finder or Explorer
  const CAN = { removeAi: true, repair: true };   // one switch each, should a build of the engine be without remove-ai or repair
  const MANAGE_ASKED = /manage/.test(location.hash);   // #manage: the bridge allows no ?query on the top page

  const ICO = {
    disk: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 15h.01M11 15h6"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    gpu: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="9" cy="12" r="3"/><path d="M15 10h3M15 14h3"/>',
    book: '<path d="M4 4v16M9 4v16M14 5l4 15M3 20h18"/>',
    ai: '<path d="M4 5h16v11H9l-5 4z"/><path d="M9 9.5h6M9 12.5h4"/>',
    ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    pause: '<path d="M9 6v12M15 6v12"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    back: '<path d="M15 18 9 12l6-6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    retry: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    repair: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  };
  const ico = (k, cls) => `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${ICO[k] || ''}</svg>`;

  /* ------------------------------------------------------------ numbers */
  function size(b) {
    if (b == null || !isFinite(b)) return '';
    const g = b / UNIT ** 3;
    if (g >= 100) return Math.round(g).toLocaleString() + ' GB';
    if (g >= 1) return g.toFixed(1) + ' GB';
    const m = b / UNIT ** 2;
    return (m >= 10 ? Math.round(m) : m.toFixed(1)) + ' MB';
  }
  const ram = b => Math.round(b / 1024 ** 3) + ' GB';   // memory is counted in binary by both systems
  const rate = bps => bps > 0 ? (bps / UNIT ** 2 >= 10 ? Math.round(bps / UNIT ** 2) : (bps / UNIT ** 2).toFixed(1)) + ' MB/s' : '';
  function eta(s) {
    if (s == null || !isFinite(s) || s < 0) return '';
    if (s < 60) return 'menos de um minuto restante';
    const m = Math.round(s / 60);
    if (m < 60) return `cerca de ${m} min restante${m === 1 ? '' : 's'}`;
    const h = Math.floor(m / 60), r = m % 60;
    return `cerca de ${h} h${r ? ` ${r} min` : ''} restante${h === 1 && !r ? '' : 's'}`;
  }
  const home = p => String(p || '').replace(/^\/Users\/[^/]+/, '~').replace(/^[A-Z]:\\Users\\[^\\]+\\/i, '');   // ~/… on a Mac; Documents\… on Windows, as Explorer names it

  /* ------------------------------------------------------------ the engine */
  async function call(path, body) {
    const opts = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    let r; try { r = await fetch('/api/setup/' + path, opts) } catch { throw Object.assign(new Error('O Último Livro não respondeu. Feche e abra novamente.'), { status: 0 }) }
    let d = null; try { d = await r.json() } catch { }
    if (!r.ok && !(d && (d.error || d.need_bytes))) throw Object.assign(new Error(r.status === 404 ? 'Indisponível.' : 'O Último Livro enviou uma resposta ilegível.'), { status: r.status });
    return d;
  }
  const errCode = e => e && (typeof e === 'object' ? e.code : null);
  const errText = e => e && (typeof e === 'object' ? e.message || e.error : e);

  /* ------------------------------------------------------------ state */
  let S = null;           // GET state
  let view = 'choose';
  let choice = { pack: null, ai: false, model: null, map: null };   // map: the selected state code
  let folder = '';
  let shortfall = null;   // the answer to a start that had no room: {need_bytes, free_bytes}
  let pollT = 0;
  let confirmCancel = false, confirmRemove = false, confirmOld = false, confirmZim = '';
  let note = '', noteOk = false;
  let repair = null;      // a repair under way: {fixed} turns true once it had to download something

  const packs = () => (S.manifest && S.manifest.packs) || [];
  const models = () => ((S.manifest && S.manifest.models) || []).filter(m => m.available !== false);
  const modelById = id => models().find(m => m.id === id);
  const MODEL_NOTE = {
    'gemma-4-26b-a4b': 'Maior precisão e capacidade de síntese. Recomendado para computadores com 24 GB ou mais de memória.',
    'gemma-4-e4b': 'Alternativa compacta de 4B com ótimo domínio de português. Recomendada para computadores de 12 GB a 16 GB.',
    'gemma-4-e2b': 'Alternativa ultra-leve de 2B com suporte a português. Feita para computadores com 8 GB de memória.',
    'qwen-3.5-0.8b': 'Alternativa super compacta de 0.8B (~508 MB, inspirada no refugiOS). Feita para computadores antigos com 4 GB de memória.',
  };
  const aiFitFor = m => (S.hardware && S.hardware.ai_models && m && S.hardware.ai_models[m.id]) || (S.hardware && S.hardware.ai) || { fits: false };
  const aiFits = m => {
    const list = m ? [m] : models();
    return list.some(x => !!aiFitFor(x).fits);
  };
  const selectedModel = () => (choice.ai ? (modelById(choice.model) || models().find(m => aiFits(m)) || models()[0] || null) : null);
  const model = () => selectedModel() || models()[0] || null;
  const cur = () => S.current || null;
  const curModels = () => { const c = cur(); return c ? (c.models || (c.model ? [c.model] : [])) : [] };
  const packById = id => packs().find(p => p.id === id);
  function packNeedsInstall(pack) {
    if (!pack) return false;
    const current = cur();
    if (!current || pack.id !== current.pack) return true;
    return Boolean(pack.revision && pack.revision !== current.content_revision);
  }

  /* state maps (docs/SETUP-API.md, State maps). The person picks the state; Lastbook never looks for where it is */
  const BR_STATES = [
    ['AC', 'Acre'], ['AL', 'Alagoas'], ['AP', 'Amapá'], ['AM', 'Amazonas'], ['BA', 'Bahia'], ['CE', 'Ceará'],
    ['DF', 'Distrito Federal'], ['ES', 'Espírito Santo'], ['GO', 'Goiás'], ['MA', 'Maranhão'], ['MT', 'Mato Grosso'],
    ['MS', 'Mato Grosso do Sul'], ['MG', 'Minas Gerais'], ['PA', 'Pará'], ['PB', 'Paraíba'], ['PR', 'Paraná'],
    ['PE', 'Pernambuco'], ['PI', 'Piauí'], ['RJ', 'Rio de Janeiro'], ['RN', 'Rio Grande do Norte'],
    ['RS', 'Rio Grande do Sul'], ['RO', 'Rondônia'], ['RR', 'Roraima'], ['SC', 'Santa Catarina'],
    ['SP', 'São Paulo'], ['SE', 'Sergipe'], ['TO', 'Tocantins']
  ];
  const BR_BY_ID = Object.fromEntries(BR_STATES);
  const normUF = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const isBrEntry = (entry, id) => {
    const name = BR_BY_ID[id];
    if (!name || !entry) return false;
    const t = normUF(entry.title).replace(/\s*\([a-z]{2}\)\s*$/, '').trim();
    return t === normUF(name);
  };
  const savedUF = () => { try { const u = localStorage.getItem('ultimolivro_uf'); return u && BR_BY_ID[u] ? u : '' } catch { return '' } };
  const saveUF = id => { try { if (id && BR_BY_ID[id]) localStorage.setItem('ultimolivro_uf', id) } catch { } };
  const maps = () => {
    const remote = new Map(((S.manifest && S.manifest.maps) || []).filter(m => isBrEntry(m, m.id)).map(m => [m.id, m]));
    return BR_STATES.map(([id, name]) => {
      const rm = remote.get(id);
      if (rm) return { ...rm, title: `${name} (${id})` };
      return { id, title: `${name} (${id})`, kind: 'state', osm_br: true, available: true, installed_bytes: 16000000, download_bytes: 8000000, files: [], includes: 'OpenStreetMap (ruas, locais de emergência, municípios e CEP)' };
    }).sort((a, b) => String(a.title).localeCompare(String(b.title), 'pt-BR'));   // by name, as people look for theirs
  };
  const mapById = id => maps().find(m => m.id === id);
  const mapName = id => (id === 'us' || id === 'br') ? 'todo o Brasil' : (mapById(id) || {}).title || id;
  /* the detailed map the library will have once the chosen pack is in: the person's state map, or the one the pack carries */
  const PACK_MAP = { medium: 'CA', all: 'us' };   // what the packs carry today; a manifest packs[].map, when there, wins
  const packMap = id => { const p = packById(id) || {}; return 'map' in p ? p.map || null : PACK_MAP[id] || null };
  const mapNow = () => { const c = cur() || {}; return choice.pack && choice.pack !== c.pack ? packMap(choice.pack) : (c.map && c.map !== 'base' ? c.map : packMap(c.pack)) };
  const selectedState = () => {
    const mn = mapNow();
    const curAddr = ((cur() || {}).address_indexes || []).find(id => BR_BY_ID[id]);
    return (choice.map && BR_BY_ID[choice.map] ? choice.map : '') || (mn && BR_BY_ID[mn] ? mn : '') || curAddr || savedUF() || '';
  };
  const addresses = () => ((S.manifest && S.manifest.address_indexes) || []).filter(a => isBrEntry(a, a.id));
  const addressById = id => addresses().find(a => a.id === id);
  const addressAdds = () => { const a = addressById(selectedState()); return a && a.available !== false && !((cur() || {}).address_indexes || []).includes(a.id) ? a : null };
  const mapMissing = () => !selectedState();
  const mapAdds = () => {
    const id = choice.map || selectedState();
    const curMap = (cur() || {}).map;
    const m = id && id !== curMap ? mapById(id) : null;
    if (!m || m.baseOnly) return null;
    if (!choice.map && (mapNow() === 'us' || mapNow() === 'br')) return null;
    return m;
  };
  const packDl = p => p.download_bytes || (p.files || []).reduce((n, f) => n + (f.size || 0), 0);
  const SEP = WIN ? '\\' : '/', DATA = 'LastbookData';
  const asData = p => /[\\/]LastbookData[\\/]?$/i.test(p) ? p.replace(/[\\/]$/, '') : String(p).replace(/[\\/]$/, '') + SEP + DATA;
  /* a file already on this computer, of the right size, for a pack or the model: setup uses it instead of downloading */
  const foundFor = (kind, id) => (S.found || []).find(f => f.kind === kind && (f.size_ok !== false) && (id ? (f.id === id || f.pack === id) : kind === 'model'));

  function diskFor(path) {
    const ds = (S.hardware && S.hardware.disks) || [];
    const norm = s => WIN ? String(s).toLowerCase().replace(/\//g, '\\') : String(s);
    const p = norm(path);
    let best = null;
    for (const d of ds) if (p.startsWith(norm(d.path)) && (!best || d.path.length > best.path.length)) best = d;
    return best || (path ? null : ds[0] || null);   // a folder on a disk the engine did not report: its free space is not known here
  }
  const diskName = d => !d ? 'este disco' : d.name || (WIN ? (String(d.path).match(/^[A-Z]:/i) || ['este disco'])[0].toUpperCase()   // C:, D:
    : /^\/Volumes\/[^/]+/.test(d.path) ? d.path.split('/')[2] : /Linux/.test(navigator.platform || '') ? 'este computador' : 'este Mac');

  function plan() {   // what the current choice adds: bytes to download, space it needs (download + unpacked + 2 GB, as the engine counts)
    const c = cur() || {};
    let dl = 0, need = 0;
    const p = packById(choice.pack);
    if (packNeedsInstall(p)) {
      const got = foundFor('pack', p.id);
      if (!got) dl += packDl(p);
      need += (got ? 0 : packDl(p)) + (p.installed_bytes || 0);
      if (p.id === c.pack) need += c.map_bytes || 0;
    }
    const m = selectedModel();
    if (choice.ai && m && !curModels().includes(m.id) && aiFits(m)) { const got = foundFor('model', m.id); if (!got) dl += m.size || 0; need += m.size || 0 }
    const mp = mapAdds();
    if (mp) { const got = foundFor('map', mp.id); if (!got) dl += packDl(mp); need += (got ? 0 : packDl(mp)) + (mp.installed_bytes || 0) }
    const a = addressAdds();
    if (a) { dl += packDl(a); need += packDl(a) + (a.installed_bytes || 0) }
    if (need) need += 2 * 1000 ** 3;
    return { dl, need };
  }

  async function load() {
    try { S = await call('state') }
    catch (e) { main.innerHTML = `<div class="s-err" role="alert">${ico('warn')}<div><b>A configuração não pôde iniciar.</b><p>${esc(e.message)}</p><p><button class="btn" id="again">Tentar novamente</button></p></div></div>`; $('#again').onclick = load; return }
    const rf = (S.recommend || {}).folder;
    folder = folder || (cur() && cur().folder) || S.default_folder || (rf ? asData(rf) : '');
    if (!choice.pack) {
      const rec = S.recommend || {};
      const small = packById('small');
      choice.pack = small && small.available !== false ? 'small' : null;
      const defModel = (rec.ai_model && modelById(rec.ai_model)) || models().find(m => aiFits(m)) || models()[0] || null;
      choice.model = (cur() && cur().model) || (defModel && defModel.id) || null;
      choice.ai = cur() ? !!cur().model : (!!rec.ai && !!(defModel && aiFits(defModel)));
      if (cur()) choice.pack = cur().pack;
    }
    const j = S.job;
    if (j && j.state && j.state !== 'done' && !(j.state === 'failed' && errCode(j.error) === 'cancelled')) view = 'job';
    else if (j && j.state === 'done') view = 'done';
    else if (cur() || S.mode === 'manage' || MANAGE_ASKED) view = cur() ? 'manage' : 'choose';
    $('#sBack').hidden = !cur();
    render(true);
  }

  /* ------------------------------------------------------------ views */
  function render(focus) {
    clearTimeout(pollT);
    shapeKey = '';
    if (view === 'manage') manageView();
    else if (view === 'choose') chooseView();
    else if (view === 'job') jobView(S.job);
    else if (view === 'done') doneView();
    if (focus) { const h = main.querySelector('h1'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }) } scrollTo(0, 0) }
  }
  function go(v) { view = v; confirmCancel = confirmRemove = confirmOld = false; confirmZim = ''; note = ''; render(true) }

  /* ---- this computer */
  function computer() {
    const h = S.hardware || {}, d = diskFor(folder), tiles = [];
    if (d) tiles.push([ico('disk'), size(d.free_bytes), `livres em ${esc(diskName(d))}`]);
    if (h.ram_bytes) tiles.push([ico('chip'), ram(h.ram_bytes), h.unified_memory ? 'memória compartilhada com gráficos' : 'memória']);
    if (!h.unified_memory) {
      const g = (h.gpus || []).slice().sort((a, b) => (b.vram_bytes || 0) - (a.vram_bytes || 0))[0];
      tiles.push(g ? [ico('gpu'), g.vram_bytes ? ram(g.vram_bytes) : '—', `gráficos: ${esc(g.name)}`] : [ico('gpu'), 'Nenhuma', 'placa de vídeo para a IA']);
    }
    return `<section class="s-pc" aria-label="Este computador">${tiles.map(t => `<div class="s-tile">${t[0]}<b>${t[1]}</b><small>${t[2]}</small></div>`).join('')}</section>`;
  }
  function recommendLine() {
    const r = S.recommend || {}, p = packById(r.pack), recModel = r.ai_model ? modelById(r.ai_model) : models().find(m => aiFits(m));
    if (!p) return r.why ? `<p class="s-rec bad">${ico('warn')}<span>${esc(r.why)}</span></p>` : '';
    const what = `${esc(p.title)}${r.ai && recModel && aiFits(recModel) ? ` com ${esc(recModel.title || 'IA local')}` : ''}`;
    return `<p class="s-rec">${ico('ok')}<span><b>Sugerido: ${what}.</b> ${esc(r.why || '')}</span></p>`;
  }

  /* ---- choose */
  function chooseView() {
    const c = cur(), ms = models(), curMs = curModels();
    const packCards = packs().map(p => {
      const update = c && c.pack === p.id && packNeedsInstall(p);
      const off = p.available === false, here = c && c.pack === p.id && !update, rec = (S.recommend || {}).pack === p.id && !c;
      const badge = off ? '<span class="s-badge later">Em breve</span>' : update ? '<span class="s-badge rec">Atualização disponível</span>' : here ? '<span class="s-badge here">Instalado</span>' : rec ? '<span class="s-badge rec">Sugerido</span>' : '';
      return `<label class="s-opt${off ? ' off' : ''}">
        <input type="radio" name="pack" value="${esc(p.id)}"${choice.pack === p.id ? ' checked' : ''}${off ? ' disabled' : ''}>
        <span class="s-opt-in"><span class="s-opt-h"><b>${esc(p.title)}</b>${badge}</span>
        <small>${esc(p.summary || '')}</small>
        <span class="s-sizes">${off ? 'Ainda não disponível para download' : here ? 'Neste computador' : `<span>${foundFor('pack', p.id) ? 'Já baixado' : size(packDl(p)) + ' de download'}</span><span>${size(p.installed_bytes)} no disco</span>`}</span></span></label>`;
    }).join('');
    let ai = '';
    if (ms.length) {
      const selM = selectedModel(), recId = (S.recommend || {}).ai_model || (ms.find(x => aiFits(x)) || {}).id;
      const aiCards = ms.map(m => {
        const has = curMs.includes(m.id), fits = aiFits(m), rec = !c && (S.recommend || {}).ai && recId === m.id;
        const off = !fits && !has, checked = choice.ai && selM && selM.id === m.id;
        const altBadge = m.id === 'gemma-4-e4b' ? 'Alternativa 4B' : m.id === 'gemma-4-e2b' ? 'Para 8 GB RAM' : m.id === 'qwen-3.5-0.8b' ? 'Para 4 GB RAM' : 'Opcional';
        const badge = has ? '<span class="s-badge here">Instalado</span>' : rec ? '<span class="s-badge rec">Sugerido</span>' : off ? '<span class="s-badge later">Não cabe neste computador</span>' : `<span class="s-badge">${altBadge}</span>`;
        const desc = MODEL_NOTE[m.id] || (fits ? 'Responde a perguntas a partir da biblioteca, em português e offline.' : (aiFitFor(m).why || 'Este computador não tem memória suficiente para este modelo.'));
        return `<label class="s-opt s-ai${off ? ' off' : ''}">
          <input type="radio" name="aiModel" value="${esc(m.id)}"${checked ? ' checked' : ''}${off ? ' disabled' : ''}>
          <span class="s-opt-in"><span class="s-opt-h"><b>${esc(m.title || m.name || 'IA local')}</b>${badge}</span>
          <small>${esc(off ? (aiFitFor(m).why || desc) : desc)}</small>
          <span class="s-sizes">${has ? 'Neste computador' : off ? '' : foundFor('model', m.id) ? '<span>Já baixado</span>' : `<span>Cerca de ${size(m.size)} de download</span>`}</span></span></label>`;
      }).join('');
      const noneChecked = !choice.ai;
      ai = `<div class="s-opts" role="radiogroup" aria-label="Modelo de IA local">
        ${aiCards}
        <label class="s-opt s-ai">
          <input type="radio" name="aiModel" value=""${noneChecked ? ' checked' : ''}>
          <span class="s-opt-in"><span class="s-opt-h"><b>Sem IA local</b></span>
          <small>${c && curMs.length ? 'Mantém apenas o que já está instalado sem baixar outro modelo.' : 'A biblioteca, os guias, vídeos, busca por palavras e mapas continuam funcionando offline.'}</small></span>
        </label>
      </div>`;
    }
    const found = (S.found || []).map((f, i) => f.rejected ? `<div class="s-found off">${ico('file')}<span><b>${esc(f.name || f.path.split(/[\\/]/).pop())}</b><small>${esc(home(f.path))} · não corresponde ao arquivo publicado e não será usado</small></span></div>`
      : f.size_ok === false ? '' : `<div class="s-found">${ico(f.kind === 'library' ? 'folder' : 'file')}<span><b>${esc(f.kind === 'library' ? 'Uma biblioteca do Último Livro' : f.kind === 'model' ? ((modelById(f.id) || {}).title || 'O arquivo da IA local') : (packById(f.id) ? 'Biblioteca ' + packById(f.id).title : f.title || f.name))}</b><small>${esc(home(f.path))}${f.size ? ' · ' + size(f.size) : ''}</small></span>
        <button class="btn plain" data-use="${i}">Usar o arquivo que você já tem</button></div>`).join('');

    main.innerHTML = `${c ? `<button class="s-link" id="toManage">${ico('back')}<span>Biblioteca e IA local</span></button>` : ''}
      <h1>${c ? 'Trocar a biblioteca' : 'Configurar o Último Livro'}</h1>
      ${c ? '' : '<p class="lead">Escolha seu estado (UF) e a biblioteca. O Último Livro faz o download para uso offline.</p>'}
      ${computer()}
      ${c ? '' : recommendLine()}
      ${found ? `<h2>Encontrado neste computador</h2><div class="s-founds">${found}</div>` : ''}
      <section id="mapBox" class="s-map-panel" aria-label="Seu mapa local"></section>
      <h2 id="packH">Biblioteca</h2>
      <div class="s-opts" role="radiogroup" aria-labelledby="packH">${packCards}</div>
      ${ai ? `<h2>IA local (opcional)</h2>${ai}` : ''}
      <section class="s-sum" id="sum" aria-live="polite"></section>
      <div class="s-go">
        <button class="btn big" id="start"></button>
        ${c ? '' : '<button class="s-link" id="haveLib">Escolher uma pasta de biblioteca existente</button>'}
        <button class="s-link" id="haveFile">Escolher um zip da biblioteca ou arquivo do modelo de IA</button>
      </div>
      <p class="s-note" id="haveNote" hidden></p>`;
    main.querySelectorAll('input[name=pack]').forEach(r => r.onchange = () => { choice.pack = r.value; shortfall = null; mapSection(); summary() });
    main.querySelectorAll('input[name=aiModel]').forEach(r => r.onchange = () => { choice.ai = !!r.value; if (r.value) choice.model = r.value; shortfall = null; summary() });
    main.querySelectorAll('[data-use]').forEach(b => b.onclick = () => useFile((S.found || [])[+b.dataset.use].path, b));
    $('#start').onclick = start;
    if ($('#toManage')) $('#toManage').onclick = () => go('manage');
    if ($('#haveLib')) $('#haveLib').onclick = () => haveLibrary(false);
    $('#haveFile').onclick = () => haveLibrary(true);
    mapSection();
    summary();
  }
  /* Map geometry and address indexes are separate downloads, chosen by state. */
  function mapSection() {
    const box = $('#mapBox'), now = mapNow();
    if (!box) return;
    const selected = selectedState();
    const opts = maps().map(m => {
      const a = addressById(m.id), included = m.baseOnly || (!choice.map && (now === 'us' || now === 'br')) || m.id === ((cur() || {}).map);
      const addressIncluded = ((cur() || {}).address_indexes || []).includes(m.id);
      const off = !included && m.available === false;
      const bytes = (included ? 0 : packDl(m)) + (a && a.available !== false && !addressIncluded ? packDl(a) : 0);
      const details = off ? 'em breve' : bytes ? (m.osm_br ? `baixar via OpenStreetMap (~${size(bytes)})` : size(bytes) + ' de download') : m.baseOnly ? 'mapa base incluído' : 'incluído';
      return `<option value="${esc(m.id)}"${selected === m.id ? ' selected' : ''}${off ? ' disabled' : ''}>${esc(m.title)} — ${details}</option>`;
    }).join('');
    const sel = mapById(selected), a = addressAdds();
    const mapIncluded = !sel || sel.baseOnly || sel.id === ((cur() || {}).map) || (!choice.map && (now === 'us' || now === 'br'));
    const bytes = (sel && !mapIncluded ? packDl(sel) : 0) + (a ? packDl(a) : 0);
    const disk = (sel && !mapIncluded ? sel.installed_bytes || 0 : 0) + (a ? a.installed_bytes || 0 : 0);
    const unavailable = selected && !sel?.osm_br && addresses().length && (!addressById(selected) || addressById(selected).available === false);
    let hint = !sel
      ? 'Selecione seu estado (UF) para continuar.'
      : sel.osm_br && bytes
        ? `${size(bytes)} de download via OpenStreetMap (openstreetmap.org) · ${size(disk)} no disco · inclui ruas, locais de apoio e busca por CEP/endereço.`
        : sel.baseOnly && !a
          ? `Estado selecionado: ${esc(sel.title)}. O mapa base do Brasil já está incluído no pacote.`
          : bytes
            ? `${size(bytes)} de download · ${size(disk)} no disco${mapIncluded && a ? '. Seu mapa já está incluído; apenas o índice de endereços será baixado.' : ''}`
            : 'O mapa do seu estado e o índice de endereços disponível já estão incluídos.';
    if (unavailable) hint = (bytes ? `${size(bytes)} de download · ${size(disk)} no disco.` : 'O mapa do seu estado já está incluído.') + ' A busca de endereços por rua ainda não está disponível para este estado.';
    box.innerHTML = `<h2>${ico('map')}Seu mapa local</h2>
      <p class="s-mapnote">Ruas locais, construções, água e pontos de apoio. Disponível offline.</p>
      ${now === 'us' || now === 'br' ? '<p class="s-mapnote">O pacote completo inclui todos os mapas estaduais. Escolha seu estado (UF) para busca de endereços offline.</p>' : ''}
      <label class="s-maplabel" for="mapSel">Escolha seu estado (UF)</label>
      <select id="mapSel" class="s-select" required aria-describedby="mapHint"><option value="" disabled${selected ? '' : ' selected'}>Selecione um estado (UF)</option>${opts}</select>
      <p class="s-hint" id="mapHint">${hint}</p>`;
    $('#mapSel').onchange = e => { choice.map = e.target.value; saveUF(choice.map); shortfall = null; mapSection(); summary(); $('#mapSel').focus() };
  }
  function summary() {
    const { dl, need } = plan(), d = diskFor(folder), free = d ? d.free_bytes : null;
    const short = shortfall || (need && free != null && free < need ? { need_bytes: need, free_bytes: free } : null);
    const pct = need && free ? Math.min(100, need / free * 100) : short ? 100 : 0;
    const c = cur();
    $('#sum').innerHTML = need ? `
      <div class="s-nums"><span><small>Download</small><b>${dl ? size(dl) : 'Nenhum'}</b></span><span><small>Espaço necessário</small><b>${size(short ? short.need_bytes : need)}</b></span><span><small>Livre em ${esc(diskName(d))}</small><b>${short ? size(short.free_bytes) : free != null ? size(free) : 'Verificado ao iniciar'}</b></span></div>
      ${free == null && !short ? '' : `<div class="s-meter${short ? ' bad' : ''}" role="img" aria-label="Usa ${Math.round(pct)} por cento do espaço livre"><i style="width:${pct}%"></i></div>`}
      ${short ? `<p class="s-short">${ico('warn')}<span>Espaço insuficiente: isto precisa de ${size(short.need_bytes)}, e ${esc(diskName(d))} tem ${size(short.free_bytes)} livres. Escolha uma biblioteca menor ou outra pasta.</span></p>` : ''}
      ${folderRow()}`
      : `<p class="s-nothing">${c ? 'Isto é o que você tem agora.' : 'Escolha uma biblioteca.'}</p>${c ? '' : folderRow()}`;
    const b = $('#start');
    b.disabled = !need || !!short || mapMissing();
    const mSel = selectedModel();
    const newPack = c && packNeedsInstall(packById(choice.pack)), newAi = c && choice.ai && mSel && !curModels().includes(mSel.id) && aiFits(mSel), newMap = c && mapAdds(), newAddresses = c && addressAdds();
    const parts = [newPack && packById(choice.pack).title, newAi && (mSel.title || 'a IA local'), newMap && `o mapa ${newMap.title}`, newAddresses && !newMap && 'busca de endereços offline'].filter(Boolean);
    b.textContent = mapMissing() ? 'Escolha seu estado (UF) para continuar' : !c ? 'Baixar e instalar' : parts.length ? 'Obter ' + parts.join(parts.length > 2 ? ', ' : ' e ').replace(/, ([^,]*)$/, ' e $1') : 'Nada a adicionar';
    if (newPack && choice.pack === c.pack && !mapMissing()) b.textContent = 'Baixar e instalar atualização';
    const ch = $('#chFolder'); if (ch) ch.onclick = pickFolder;
  }
  const folderRow = () => `<div class="s-folder">${ico('folder')}<span><small>Salva em</small><b title="${esc(folder)}">${esc(home(folder))}</b></span>${cur() ? '' : '<button class="btn plain" id="chFolder">Alterar…</button>'}</div>`;

  async function pickFolder() {
    const b = $('#chFolder'); b.disabled = true;
    try {
      const r = await call('pick', {});
      if (r && r.path) {
        folder = asData(r.path);
        if (r.free_bytes != null) (S.hardware.disks = S.hardware.disks || []).push({ path: r.path, name: r.disk, free_bytes: r.free_bytes });   // the chosen place's own disk
        shortfall = null;
        const pc = main.querySelector('.s-pc'); if (pc) pc.outerHTML = computer();
      }
      summary();
    } catch { b.disabled = false; b.textContent = 'Não foi possível alterar aqui' }
  }
  async function haveLibrary(files) {
    const n = $('#haveNote');
    try {
      const r = await call('pick', { files });
      if (r && r.path) return useFile(r.path, $(files ? '#haveFile' : '#haveLib'));
      if (r && (r.cancelled || r.path === null)) return;
      throw 0;
    } catch {
      n.hidden = false;
      n.textContent = 'Não foi possível abrir o seletor. Tente escolher o arquivo ou pasta novamente.';
    }
  }
  async function useFile(path, btn) {
    if (btn) btn.disabled = true;
    try {
      const r = await call('use', { path });
      if (r && r.error) throw new Error(r.error);
      if (r && r.noted) { S = await call('state').catch(() => S); choice.ai = true; if (r.model) choice.model = r.model; chooseView(); const n = $('#haveNote'); n.hidden = false; n.textContent = 'O arquivo da IA local será usado. Não é necessário baixá-lo.'; return }
      S.job = r; go(r.state === 'done' ? 'done' : 'job'); poll();
    } catch (e) {
      if (btn) btn.disabled = false;
      const n = $('#haveNote'); n.hidden = false; n.textContent = e.message;
    }
  }
  async function start() {
    if (mapMissing()) { $('#mapSel')?.focus(); return }
    const b = $('#start'); b.disabled = true;
    const mSel = selectedModel();
    const wantAi = !!choice.ai && !!mSel && aiFits(mSel) && !curModels().includes(mSel.id);
    const mapSel = mapAdds();
    const r = await call('start', { pack: packNeedsInstall(packById(choice.pack)) ? choice.pack : null, ai: wantAi, model: wantAi ? mSel.id : null, map: mapSel ? mapSel.id : null, address_id: addressById(selectedState())?.available !== false && addressById(selectedState()) ? selectedState() : null, folder }).catch(e => ({ error: e.message }));
    if (r && r.need_bytes) { shortfall = r; summary(); return }
    if (!r || r.error) { b.disabled = false; const n = $('#haveNote'); n.hidden = false; n.textContent = (r && r.error) || 'A configuração não pôde iniciar.'; return }
    S.job = r; go('job'); poll();
  }

  /* ---- manage */
  function manageView() {
    const c = cur(), p = packById(c.pack), curMs = curModels();
    const installedM = c.model ? (modelById(c.model) || model()) : null;
    const fittingMs = models().filter(x => aiFits(x));
    const bestM = fittingMs[0] || model();
    const m = installedM || bestM;
    const altModels = c.model ? fittingMs.filter(x => x.id !== c.model && !curMs.includes(x.id)) : [];
    const libraryUpdate = p && p.available !== false && packNeedsInstall(p);
    const o = [].concat(c.old || [])[0], old = o ? (typeof o === 'string' ? { path: o } : o) : null;   // the engine lists the paths it moved aside
    const larger = packs().filter(x => (x.installed_bytes || 0) > ((p && p.installed_bytes) || 0));
    const bigger = larger.filter(x => x.available !== false), later = larger.find(x => x.available === false);
    const curZims = c.zims || [];
    const hasZim = z => curZims.some(x => (typeof x === 'string' ? x === z.id || x === z.file : x.id === z.id || x.file === z.file));
    const zimsList = (S.zims || []).map(z => {
      const got = hasZim(z);
      return `<div class="s-row">${ico('book', 's-ri')}<span><b>${esc(z.title)}</b>${got ? ' <span class="s-badge here">Instalada</span>' : ''}<small>${esc(z.group)} · ${size(z.size)} · ${esc(z.summary)}</small></span>
        ${got ? (confirmZim === z.id
          ? `<span class="s-confirm"><button class="btn danger" data-rmzim-yes="${esc(z.id)}">Remover</button><button class="btn plain" data-rmzim-no="${esc(z.id)}">Manter</button></span>`
          : `<button class="btn plain" data-rmzim="${esc(z.id)}">Remover</button>`)
        : `<button class="btn plain" data-getzim="${esc(z.id)}">${ico('down')}Baixar</button>`}</div>`;
    }).join('');
    const activeSel = curMs.length > 1 ? `<div class="s-row">${ico('ai', 's-ri')}<span><b>Modelo ativo no Chat</b><small>Vários modelos instalados — alterne quando quiser:</small></span><select id="mgModelSel" class="s-select" style="width:auto;max-width:260px">${curMs.map(id => { const mm = modelById(id) || { id, title: id }; return `<option value="${esc(id)}"${id === c.model ? ' selected' : ''}>${esc(mm.title || id)}</option>` }).join('')}</select></div>` : '';
    main.innerHTML = `<h1>Biblioteca e IA local</h1>
      <div class="s-have">
        <div class="s-row">${ico('book', 's-ri')}<span><b>Biblioteca ${esc(p ? p.title : c.pack || '')}</b><small>${libraryUpdate ? 'Edição atualizada disponível · ' : p ? size(p.installed_bytes) + ' · ' : ''}${esc(home(c.folder))}</small></span>
          ${libraryUpdate ? `<button class="btn" id="libraryUpdate">Atualizar ${esc(p.title)}</button>` : bigger.length ? `<button class="btn" id="upgrade">${ico('up')}Obter ${esc(bigger[0].title)}</button>` : later ? `<span class="s-badge later">${esc(later.title)} em breve</span>` : '<span class="s-badge here">A maior</span>'}</div>
        ${m && m.available !== false ? `<div class="s-row">${ico('ai', 's-ri')}<span><b>IA local</b><small>${installedM ? `${installedM.title ? esc(installedM.title) + ' · ' : ''}Neste computador · ${size(installedM.size)}` : fittingMs.length ? `Não instalada · ${fittingMs.map(x => `${esc(x.title || 'IA local')} (${size(x.size)})`).join(' ou ')}` : esc((aiFitFor(m).why) || (S.hardware.ai && S.hardware.ai.why) || 'Não compatível com este computador.')}</small></span>
          ${installedM ? `<span class="s-confirm">${altModels.length && !confirmRemove ? '<button class="btn plain" id="chgAi">Adicionar outro modelo</button>' : ''}${!CAN.removeAi ? '' : confirmRemove ? '<button class="btn danger" id="rmYes">Remover</button><button class="btn plain" id="rmNo">Manter</button>' : '<button class="btn plain" id="rmAi">Remover</button>'}</span>` : fittingMs.length ? `<button class="btn" id="addAi">Adicionar</button>` : ''}</div>` : ''}
        ${activeSel}
        ${maps().length ? (() => { const mNow = c.map && c.map !== 'base' ? c.map : packMap(c.pack);
          return `<div class="s-row">${ico('map', 's-ri')}<span><b>${mNow ? 'Mapa detalhado: ' + esc(mapName(mNow)) : 'Mapa detalhado'}</b><small>${mNow ? (mNow === 'us' || mNow === 'br' ? 'Ruas locais e relevo em todo o país' : 'Ruas locais, construções e relevo') : 'Nenhum ainda. Adicione o do seu estado (UF).'}</small></span>
          <button class="btn plain" id="mapCh">${(c.address_indexes || []).length ? 'Escolher estado (UF)' : 'Adicionar busca de endereços'}</button></div>` })() : ''}
      </div>
      ${old ? `<div class="s-row s-old">${ico('folder', 's-ri')}<span><b>A biblioteca antiga ainda está aqui</b><small>${esc(home(old.path))}${old.bytes ? ' · ' + size(old.bytes) : ''}</small></span>${confirmOld ? `<span class="s-confirm"><span>Excluir permanentemente?</span><button class="btn danger" id="oldYes">Excluir</button><button class="btn plain" id="oldNo">Manter</button></span>` : `<button class="btn plain" id="rmOld">${ico('trash')}Excluir</button>`}</div>` : ''}
      ${zimsList ? `<h2>Enciclopédias e Manuais em Português (Kiwix)</h2><p class="s-note">Conteúdo offline do Kiwix usado pelo refugiOS em Português (Brasil) — pesquisável na aba Enciclopédias e pelo Chat da IA.</p><div class="s-have">${zimsList}</div>` : ''}
      ${computer()}
      ${CAN.repair ? `<div class="s-go left"><button class="btn plain" id="repair">${ico('repair')}Verificar e reparar</button></div>` : ''}
      <p class="s-note${noteOk ? ' ok' : ''}" id="haveNote"${note ? '' : ' hidden'}>${esc(note)}</p>`;
    if ($('#libraryUpdate')) $('#libraryUpdate').onclick = () => { choice.pack = c.pack; choice.ai = !!c.model; if (c.model) choice.model = c.model; go('choose') };
    if ($('#upgrade')) $('#upgrade').onclick = () => { choice.pack = bigger[0].id; choice.ai = !!c.model; if (c.model) choice.model = c.model; go('choose') };
    if ($('#mapCh')) $('#mapCh').onclick = () => { choice.pack = c.pack; choice.ai = !!c.model; if (c.model) choice.model = c.model; choice.map = null; go('choose'); const m = $('#mapSel'); if (m) m.focus() };
    if ($('#addAi')) $('#addAi').onclick = () => { choice.pack = c.pack; choice.ai = true; choice.model = bestM ? bestM.id : null; go('choose') };
    if ($('#chgAi')) $('#chgAi').onclick = () => { choice.pack = c.pack; choice.ai = true; choice.model = altModels[0].id; go('choose') };
    if ($('#mgModelSel')) $('#mgModelSel').onchange = async () => {
      const sel = $('#mgModelSel'), mid = sel.value;
      sel.disabled = true;
      try {
        const res = await fetch('/api/assistant/local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'select', model_id: mid }) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || d.error) { noteOk = false; note = d.error || 'Não foi possível trocar o modelo de IA.' }
        else { noteOk = true; note = 'Modelo de IA ativo alterado.'; S = await call('state').catch(() => S) }
      } catch { noteOk = false; note = 'Não foi possível trocar o modelo de IA.' }
      manageView();
    };
    main.querySelectorAll('[data-getzim]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      const r = await call('start', { zim: b.dataset.getzim }).catch(e => ({ error: e.message }));
      if (!r || r.error) { noteOk = false; note = (r && r.error) || 'Não foi possível iniciar o download da enciclopédia.'; manageView(); return }
      S.job = r; go('job'); poll();
    });
    main.querySelectorAll('[data-rmzim]').forEach(b => b.onclick = () => { confirmZim = b.dataset.rmzim; manageView(); const no = main.querySelector(`[data-rmzim-no="${CSS.escape(confirmZim)}"]`); if (no) no.focus() });
    main.querySelectorAll('[data-rmzim-no]').forEach(b => b.onclick = () => { const zid = b.dataset.rmzimNo; confirmZim = ''; manageView(); const rb = main.querySelector(`[data-rmzim="${CSS.escape(zid)}"]`); if (rb) rb.focus() });
    main.querySelectorAll('[data-rmzim-yes]').forEach(b => b.onclick = () => { confirmZim = ''; act('remove-zim', 'Enciclopédia removida deste computador.', { zim: b.dataset.rmzimYes }) });
    if ($('#rmAi')) $('#rmAi').onclick = () => { confirmRemove = true; manageView(); $('#rmNo').focus() };
    if ($('#rmNo')) $('#rmNo').onclick = () => { confirmRemove = false; manageView(); $('#rmAi').focus() };
    if ($('#rmYes')) $('#rmYes').onclick = () => act('remove-ai', 'A IA local foi removida.');   // the engine stops the AI first
    if ($('#rmOld')) $('#rmOld').onclick = () => { confirmOld = true; manageView(); $('#oldNo').focus() };
    if ($('#oldNo')) $('#oldNo').onclick = () => { confirmOld = false; manageView(); $('#rmOld').focus() };
    if ($('#oldYes')) $('#oldYes').onclick = () => act('delete-old', 'A biblioteca antiga está sendo excluída.', { path: old.path });
    if ($('#repair')) $('#repair').onclick = async () => {
      const r = await call('start', { repair: true, ai: !!c.model, model: c.model || null }).catch(e => ({ error: e.message }));
      if (!r || r.error) { note = (r && r.error) || 'Não foi possível iniciar o reparo.'; manageView(); return }
      repair = { fixed: false }; S.job = r; go('job'); poll();
    };
  }
  async function act(path, done, body) {
    const r = await call(path, body || {}).catch(e => ({ error: e.status === 404 ? 'Esta versão do Último Livro ainda não faz isso.' : e.message }));
    confirmRemove = confirmOld = false; confirmZim = '';
    noteOk = !(r && r.error);
    if (r && r.error) note = r.error;
    else { note = done; S = await call('state').catch(() => S) }
    manageView();
    const n = $('#haveNote'); if (n) { n.tabIndex = -1; n.focus() }
  }

  /* ---- job */
  const STEPS = { pack: [['downloading', 'Baixar'], ['verifying', 'Verificar'], ['unpacking', 'Descompactar'], ['activating', 'Concluir']],
                  model: [['downloading', 'Baixar'], ['verifying', 'Verificar'], ['activating', 'Concluir']] };
  STEPS.map = [['downloading', 'Baixar'], ['unpacking', 'Descompactar']];   // the engine's map item: waiting, downloading, unpacking, done
  STEPS.addresses = STEPS.map;
  STEPS.zim = STEPS.model;
  const WORD = { waiting: 'Aguardando', downloading: 'Baixando', paused: 'Pausado', verifying: 'Verificando', unpacking: 'Descompactando', activating: 'Concluindo', done: 'Concluído', failed: 'Parado' };
  const ACTIVE = new Set(['waiting', 'downloading', 'verifying', 'unpacking', 'activating']);
  let shapeKey = '', lastAct = null;   // lastAct: the button just pressed, so focus lands on what replaced it

  function errorBox(j) {
    const e = j.error, code = errCode(e) || j.code, c = cur();
    const safe = c ? 'Sua biblioteca está intacta e continua funcionando.' : 'Nada mais neste computador foi alterado.';
    const d = diskFor(j.folder || folder);
    const T = {
      found_mismatch: (() => {   // a file of the person's own that did not match: nothing was downloaded, and their file is left alone
        const f = String((e && e.file) || ''), name = f.split(/[\\/]/).pop() || 'arquivo', at = f.split(/[\\/]/).slice(-2, -1)[0];
        return [`O arquivo ${esc(name)}${at ? ' em ' + esc(at) : ''} não corresponde ao arquivo publicado e não foi usado.`, 'Ele foi mantido como está. Deseja baixá-lo em vez disso?', 'download'];
      })(),
      no_space: [`Espaço insuficiente em ${esc(diskName(d))}${e && e.need_bytes ? `: isto precisa de ${size(e.need_bytes)}, e há ${size(e.free_bytes)} livres` : ''}.`, 'Libere espaço e tente novamente, ou volte e escolha menos itens.', 'retry'],
      network: ['A conexão com a internet caiu.', 'O que já foi baixado foi mantido. Tente novamente quando estiver online.', 'retry'],
      checksum: ['O download veio corrompido duas vezes e não foi usado.', 'Tente baixar mais uma vez.', 'retry'],
      unpack: ['A descompactação não terminou.', 'Verifique se há espaço no disco e tente novamente.', 'retry'],
      activate: ['A nova biblioteca está pronta, mas não pôde ser ativada.', 'Tente novamente, ou feche o Último Livro e abra de novo.', 'retry'],
      cancelled: ['O download foi cancelado.', 'Recomece quando estiver pronto.', 'back'],
    }[code] || [esc(errText(e) || 'Algo deu errado.'), 'Tente novamente, ou volte e escolha de novo.', 'retry'];
    return `<div class="s-err" role="alert">${ico('warn')}<div><b>${T[0]}</b><p>${T[1]}${code === 'found_mismatch' && !c ? '' : ' ' + safe}</p>
      <p class="s-acts">${T[2] === 'retry' ? `<button class="btn" data-act="retry">${ico('retry')}Tentar novamente</button>` : T[2] === 'download' ? `<button class="btn" data-act="retry">${ico('down')}Baixar</button>` : ''}<button class="btn ${T[2] === 'back' ? '' : 'plain'}" data-act="back">Escolher novamente</button></p></div></div>`;
  }
  function itemHTML(it, j) {
    const FAILED_AT = { checksum: 'verifying', found_mismatch: 'verifying', unpack: 'unpacking', activate: 'activating' };
    const steps = STEPS[it.kind] || STEPS.pack;
    const st = it.state === 'paused' && noDownload(it) ? (it.paused_from && it.paused_from !== 'downloading' ? it.paused_from : 'verifying')
      : it.state === 'paused' || it.state === 'waiting' ? 'downloading' : it.state === 'failed' ? FAILED_AT[errCode(it.error) || errCode(j.error)] || 'downloading' : it.state;
    const at = it.state === 'done' ? steps.length : (it.state === 'waiting' || it.state === 'paused') && !it.bytes_done && !noDownload(it) ? -1 : Math.max(0, steps.findIndex(s => s[0] === st));
    const busy = ['verifying', 'activating'].includes(it.state) || (it.state === 'unpacking' && !it.bytes_total);
    return `<div class="s-item${it.state === 'failed' ? ' bad' : ''}${it.state === 'done' ? ' ok' : ''}" data-item="${esc(it.id)}" data-kind="${esc(it.kind)}">
      <div class="s-item-h">${ico(it.kind === 'model' ? 'ai' : it.kind === 'map' ? 'map' : 'book', 's-ri')}<b>${esc(itemTitle(it))}</b><span class="s-state" data-f="word">${it.state === 'done' ? ico('ok') : ''}${Object.hasOwn(WORD, it.state) ? WORD[it.state] : ''}</span></div>
      <div class="s-bar new${busy && j.state !== 'paused' ? ' busy' : ''}" role="progressbar" aria-label="${esc(it.title)}" aria-valuemin="0" aria-valuemax="100" data-f="bar"><i></i></div>
      <p class="s-line" data-f="line"></p>
      <ol class="s-steps" aria-label="Etapas">${steps.map((s, i) => `<li class="${i < at ? 'done' : i === at && it.state !== 'failed' ? 'now' : i === at ? 'stop' : ''}">${s[1]}</li>`).join('')}</ol>
    </div>`;
  }
  const itemTitle = it => it.kind === 'model' ? ((modelById(it.id) || {}).title ? 'IA local (' + modelById(it.id).title + ')' : 'IA local') : it.kind === 'map' ? `Mapa ${(mapById(it.id) || it).title || it.id}` : (it.kind === 'addresses' || it.kind === 'zim') ? it.title : it.id === 'library' || it.id === 'repair' || /library|biblioteca/i.test(it.title) ? it.title : 'Biblioteca ' + it.title;
  /* an item that needs nothing from the internet: the person's own file, or one stopped after its download was complete.
     source and paused_from come from the engine (docs/SETUP-API.md); without them, a complete download still counts */
  const noDownload = it => it.source === 'found' || (!!it.paused_from && it.paused_from !== 'downloading') || (it.bytes_total > 0 && it.bytes_done >= it.bytes_total);
  const STOPPED = { verifying: 'Verificação interrompida', unpacking: 'Descompactação interrompida', activating: 'Finalização interrompida' };
  const behind = it => { const items = (S.job && S.job.items) || [], i = items.findIndex(x => x.id === it.id && x.kind === it.kind); return items.slice(0, i).some(x => x.state !== 'done' && !noDownload(x)) };
  function fillItem(el, it) {
    const pct = it.bytes_total ? Math.min(100, it.bytes_done / it.bytes_total * 100) : it.state === 'done' ? 100 : 0;
    const bar = el.querySelector('[data-f=bar]'), line = el.querySelector('[data-f=line]');
    const showPct = !bar.classList.contains('busy');
    bar.firstChild.style.width = (showPct ? pct : 100) + '%';
    if (showPct) bar.setAttribute('aria-valuenow', Math.round(pct)); else bar.removeAttribute('aria-valuenow');
    let t = '';
    if (it.state === 'done') t = it.bytes_total ? size(it.bytes_total) : '';
    else if (it.state === 'downloading') t = [`${size(it.bytes_done)} de ${size(it.bytes_total)}`, rate(it.rate_bps), eta(it.eta_s)].filter(Boolean).join(' · ');
    else if (it.state === 'paused' && noDownload(it)) t = `${STOPPED[it.paused_from] || 'Parado'}${it.paused_from === 'unpacking' && it.bytes_done && it.bytes_total ? ` em ${size(it.bytes_done)} de ${size(it.bytes_total)}` : ''}. Nada a baixar.`;
    else if ((it.state === 'waiting' || it.state === 'paused') && !it.bytes_done) t = it.bytes_total ? `${size(it.bytes_total)} para baixar${behind(it) ? ', após o item acima' : ''}` : '';
 else if (it.state === 'paused' || it.state === 'waiting' || it.state === 'failed') t = it.bytes_total && it.bytes_done ? `${size(it.bytes_done)} de ${size(it.bytes_total)}` : '';
    else if (it.state === 'verifying') t = 'Conferindo cada byte';
    else if (it.state === 'unpacking') t = it.bytes_total ? `Descompactando: ${size(it.bytes_done)} de ${size(it.bytes_total)}${it.eta_s != null ? ' · ' + eta(it.eta_s) : ''}` : 'Extraindo os arquivos na pasta da biblioteca';
    else if (it.state === 'activating') t = it.kind === 'map' ? 'Ativando o novo mapa' : it.kind === 'zim' ? 'Instalando enciclopédia na biblioteca' : 'Ativando a nova biblioteca';
    line.textContent = t;
  }
  function jobView(j) {
    if (!j) { go(cur() ? 'manage' : 'choose'); return }
    if (j.state === 'done') { go('done'); return }
    const key = j.state + '|' + errCode(j.error) + '|' + confirmCancel + '|' + j.items.map(i => i.kind + ':' + i.id + ':' + i.state).join(',');
    const head = { paused: 'Pausado', failed: errCode(j.error) === 'cancelled' ? 'Cancelado' : 'Parado' }[j.state] || (repair && !repair.fixed ? 'Verificando a biblioteca' : repair ? 'Reparando' : 'Instalando');
    if (key !== shapeKey) {
      const had = lastAct || (document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.act : null);
      lastAct = null;
      const first = !shapeKey;
      shapeKey = key;
      const quiet = j.state === 'paused' && j.items.filter(i => i.state === 'paused').every(noDownload);
      const lead = quiet ? 'Interrompido ao fechar o Último Livro. Retome para concluir; nada precisa ser baixado.'
        : j.state === 'paused' ? 'O que já foi baixado foi mantido. Retome quando quiser, mesmo após fechar o Último Livro.'
        : j.state === 'failed' ? '' : 'Você pode continuar usando este computador. Fechar o Último Livro pausa a instalação.';
      main.innerHTML = `<h1>${head}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}
        ${j.state === 'failed' ? errorBox(j) : ''}
        <div class="s-items">${j.items.map(it => itemHTML(it, j)).join('')}</div>
        ${j.state === 'failed' ? '' : `<div class="s-go left">${confirmCancel
          ? `<span class="s-confirm"><span>Parar e descartar o download?</span><button class="btn danger" data-act="cancel-yes">Parar</button><button class="btn plain" data-act="cancel-no">Continuar</button></span>`
          : `${j.state === 'paused' ? `<button class="btn" data-act="resume">${ico('play')}Retomar</button>` : j.state === 'downloading' || j.state === 'waiting' ? `<button class="btn plain" data-act="pause">${ico('pause')}Pausar</button>` : ''}
             <button class="btn plain" data-act="cancel">${ico('x')}Cancelar</button>`}</div>`}`;
      main.querySelectorAll('[data-act]').forEach(b => b.onclick = () => jobAct(b.dataset.act, b));
      const again = had && main.querySelector(`[data-act="${had}"]`) || (had && main.querySelector('[data-act]'));
      if (again) again.focus();
      else if (first) { const h = main.querySelector('h1'); h.tabIndex = -1; h.focus({ preventScroll: true }) }
      const s = j.state === 'failed' ? '' : head + (j.items.find(i => ACTIVE.has(i.state)) ? ': ' + WORD[j.items.find(i => ACTIVE.has(i.state)).state] + ' ' + j.items.find(i => ACTIVE.has(i.state)).title : '');
      if (s && live.textContent !== s) live.textContent = s;
    }
    const fresh = main.querySelectorAll('.s-bar.new');
    j.items.forEach(it => { const el = main.querySelector(`[data-item="${CSS.escape(it.id)}"][data-kind="${CSS.escape(it.kind)}"]`); if (el) fillItem(el, it) });
    if (fresh.length) { void main.offsetWidth; fresh.forEach(b => b.classList.remove('new')) }   // a new screen shows the bar where it is, without growing from nothing
  }
  async function jobAct(a, b) {
    if (a === 'back') { S = await call('state').catch(() => S); S.job = null; shortfall = null; go('choose'); return }   // fresh: found[] may now mark a file as not matching
    if (a === 'cancel') { confirmCancel = true; jobView(S.job); main.querySelector('[data-act="cancel-no"]').focus(); return }
    if (a === 'cancel-no') { confirmCancel = false; jobView(S.job); return }
    if (a === 'cancel-yes') { confirmCancel = false; a = 'cancel' }
    b.disabled = true; lastAct = a;
    try { const j = await call(a, {}); if (j && j.items) S.job = j } catch { }
    if (a === 'cancel') { S = await call('state').catch(() => S); S.job = null; go(cur() ? 'manage' : 'choose'); live.textContent = 'O download foi cancelado.'; return }
    jobView(S.job);
    poll();
  }
  function poll() {
    clearTimeout(pollT);
    if (!S.job || !ACTIVE.has(S.job.state)) return;
    pollT = setTimeout(async () => {
      try { const j = await call('job'); if (j) S.job = j } catch { pollT = setTimeout(poll, 3000); return }
      if (repair && S.job && S.job.items.some(i => i.state === 'downloading' || i.state === 'unpacking')) repair.fixed = true;
      if (view !== 'job') return;
      if (S.job && S.job.state === 'done') { go('done'); return }
      jobView(S.job);
      poll();
    }, 1000);
  }

  /* ---- done */
  function doneView() {
    const j = S.job || { items: [] }, fixed = repair && repair.fixed, checked = repair && !fixed;
    const got = j.items.filter(i => i.id !== 'repair' && i.id !== 'library').map(i => esc(itemTitle(i))).join(', ').replace(/, ([^,]*)$/, ' e $1');
    main.innerHTML = `<div class="s-done">${ico('ok', 's-big')}<h1>${checked ? 'Tudo certo' : fixed ? 'Reparado' : 'Pronto'}</h1>
      <p class="lead">${checked ? 'A biblioteca foi verificada e está completa.' : fixed ? 'Uma parte danificada foi baixada novamente. A cópia danificada foi separada; você pode excluí-la em Biblioteca e IA local.' : got ? `Instalado: ${got}.` : 'A biblioteca está instalada.'}</p>
      <button class="btn big" id="open">Abrir a biblioteca</button><p class="s-note" id="openNote" hidden></p></div>`;
    live.textContent = checked ? 'A biblioteca foi verificada.' : 'Instalado. Pronto para abrir.';
    $('#open').onclick = async () => {
      const b = $('#open'); b.disabled = true; b.textContent = 'Abrindo sua biblioteca…';
      const r = await call('finish', {}).catch(e => ({ error: e.message }));   // on {ok} the app relaunches itself into the library
      if (!r || r.error) { b.disabled = false; b.textContent = 'Abrir a biblioteca'; const n = $('#openNote'); n.hidden = false; n.textContent = (r && r.error) || 'A biblioteca não abriu. Tente novamente.' }
      else live.textContent = 'Abrindo sua biblioteca…';
    };
  }

  /* keyboard: Escape closes a question that is open */
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (confirmCancel) { confirmCancel = false; jobView(S.job); const b = main.querySelector('[data-act="cancel"]'); if (b) b.focus() }
    else if (confirmRemove || confirmOld) { const f = confirmRemove ? '#rmAi' : '#rmOld'; confirmRemove = confirmOld = false; manageView(); $(f).focus() }
    else if (confirmZim) { const zid = confirmZim; confirmZim = ''; manageView(); const b = main.querySelector(`[data-rmzim="${CSS.escape(zid)}"]`); if (b) b.focus() }
  });
  /* the window comes back to the front: the job may have moved on, or a restart paused it */
  addEventListener('focus', () => { if (view === 'job') call('job').then(j => { if (j) { S.job = j; jobView(j); poll() } }).catch(() => { }) });

  load().then(() => { if (view === 'job') poll() });
})();
