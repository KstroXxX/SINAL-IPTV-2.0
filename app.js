(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { playlist: [], filter: 'all', group: '', query: '', visible: 120, hls: null };
  const DB_NAME = 'sinal-iptv-db';
  const DB_VERSION = 1;
  const STORE = 'playlists';

  const els = {
    playlistModal: $('#playlistModal'), playerModal: $('#playerModal'), fileInput: $('#fileInput'), fileName: $('#fileName'),
    dropzone: $('#dropzone'), grid: $('#grid'), catalog: $('#catalog'), search: $('#search'), groupSelect: $('#groupSelect'),
    catalogTitle: $('#catalogTitle'), resultStatus: $('#resultStatus'), video: $('#video'), playerTitle: $('#playerTitle'),
    playerMeta: $('#playerMeta'), playerNotice: $('#playerNotice'), toast: $('#toast'), nav: $('.nav'), loadMore: $('#loadMore')
  };

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => els.toast.classList.remove('show'), 3200);
  }

  function openModal(el) { el.classList.add('show'); el.setAttribute('aria-hidden', 'false'); }
  function closeModal(el) { el.classList.remove('show'); el.setAttribute('aria-hidden', 'true'); }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
  }

  function attr(value) { return esc(value).replace(/`/g, '&#096;'); }

  function attrValue(line, key) {
    const re = new RegExp('(?:^|\\s)' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '="([^"]*)"', 'i');
    const quoted = line.match(re);
    if (quoted) return quoted[1];
    const single = new RegExp("(?:^|\\s)" + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "='([^']*)'", 'i').exec(line);
    return single ? single[1] : '';
  }

  function guessType(title, group) {
    const s = `${group} ${title}`.toLowerCase();
    if (/(^|[\\s|._-])(filme|filmes|movie|movies|cinema)([\\s|._-]|$)/i.test(s)) return 'Filmes';
    if (/(s[eé]rie|series|season|temporada|epis[oó]dio|episode|s\d{1,2}e\d{1,2})/i.test(s)) return 'Séries';
    return 'Canais';
  }

  function cleanTitle(title) {
    return String(title || 'Sem título').replace(/^\s+|\s+$/g, '') || 'Sem título';
  }

  // Parser tolerante a playlists M3U/M3U8 com atributos comuns de provedores.
  function parseM3U(text) {
    const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
    const out = [];
    let meta = null;

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.toUpperCase().startsWith('#EXTINF:')) {
        const comma = line.indexOf(',');
        const info = comma >= 0 ? line.slice(0, comma) : line;
        const title = comma >= 0 ? cleanTitle(line.slice(comma + 1)) : 'Sem título';
        const group = attrValue(info, 'group-title') || attrValue(info, 'group') || '';
        const logo = attrValue(info, 'tvg-logo') || attrValue(info, 'logo') || '';
        const channelId = attrValue(info, 'tvg-id') || '';
        const language = attrValue(info, 'tvg-language') || '';
        meta = { title, group, logo, channelId, language, type: guessType(title, group) };
      } else if (!line.startsWith('#') && meta) {
        const url = line;
        if (/^(https?|rtmp|rtsp|udp|file):/i.test(url)) out.push({...meta, url});
        meta = null;
      }
    }
    return out;
  }

  async function openDB() {
    if (!('indexedDB' in window)) return null;
    return new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  async function savePlaylist(items) {
    try {
      const db = await openDB();
      if (db) await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(items, 'current');
        tx.oncomplete = resolve; tx.onerror = reject;
      });
      // Small fallback for browsers where IndexedDB is unavailable.
      try { localStorage.setItem('sinal_iptv_playlist_fallback', JSON.stringify(items)); } catch (_) {}
      return true;
    } catch (_) {
      try { localStorage.setItem('sinal_iptv_playlist_fallback', JSON.stringify(items)); return true; } catch (_) { return false; }
    }
  }

  async function loadPlaylist() {
    try {
      const db = await openDB();
      if (db) {
        const data = await new Promise((resolve) => {
          const req = db.transaction(STORE, 'readonly').objectStore(STORE).get('current');
          req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(null);
        });
        if (Array.isArray(data) && data.length) return data;
      }
    } catch (_) {}
    try {
      const data = JSON.parse(localStorage.getItem('sinal_iptv_playlist_fallback') || '[]');
      return Array.isArray(data) ? data : [];
    } catch (_) { return []; }
  }

  function stats() {
    const counts = { Canais: 0, Filmes: 0, 'Séries': 0 };
    const groups = new Set();
    state.playlist.forEach(item => { counts[item.type] = (counts[item.type] || 0) + 1; if (item.group) groups.add(item.group); });
    $('#channelsCount').textContent = counts.Canais.toLocaleString('pt-BR');
    $('#moviesCount').textContent = counts.Filmes.toLocaleString('pt-BR');
    $('#seriesCount').textContent = counts['Séries'].toLocaleString('pt-BR');
    $('#categoriesCount').textContent = groups.size.toLocaleString('pt-BR');
    $('#playlistStatus').textContent = state.playlist.length ? `${state.playlist.length.toLocaleString('pt-BR')} itens carregados` : 'Nenhuma playlist carregada';
  }

  function rebuildGroups() {
    const groups = [...new Set(state.playlist.map(x => x.group).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'pt-BR'));
    els.groupSelect.innerHTML = '<option value="">Todas as categorias</option>' + groups.map(g => `<option value="${attr(g)}">${esc(g)}</option>`).join('');
    els.groupSelect.value = state.group;
  }

  function showCatalog(filter = state.filter, scroll = true) {
    if (!state.playlist.length) { openModal(els.playlistModal); return; }
    state.filter = filter; state.visible = 120;
    els.catalog.hidden = false;
    els.catalogTitle.textContent = filter === 'all' ? 'Todo o conteúdo' : filter;
    $$('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.filter === filter));
    renderGrid();
    if (scroll) els.catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function filteredItems() {
    const q = state.query.toLocaleLowerCase('pt-BR');
    return state.playlist.filter(item => {
      const typeOk = state.filter === 'all' || item.type === state.filter;
      const groupOk = !state.group || item.group === state.group;
      const text = `${item.title} ${item.group} ${item.channelId}`.toLocaleLowerCase('pt-BR');
      return typeOk && groupOk && (!q || text.includes(q));
    });
  }

  function renderGrid() {
    const items = filteredItems();
    const shown = items.slice(0, state.visible);
    els.resultStatus.textContent = `${items.length.toLocaleString('pt-BR')} resultado${items.length === 1 ? '' : 's'}`;
    els.grid.innerHTML = shown.map((item, index) => {
      const realIndex = state.playlist.indexOf(item);
      const image = item.logo ? `<img loading="lazy" src="${attr(item.logo)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">` : '';
      return `<article class="item" data-index="${realIndex}" tabindex="0" role="button" aria-label="Abrir ${esc(item.title)}">
        <div class="thumb">${image}<div class="thumb-fallback" ${item.logo ? 'style="display:none"' : ''}>▶</div></div>
        <div class="item-body"><div class="item-title" title="${attr(item.title)}">${esc(item.title)}</div><div class="item-meta" title="${attr(item.group || item.type)}">${esc(item.group || item.type)}</div></div>
      </article>`;
    }).join('') || '<p class="muted">Nenhum conteúdo encontrado.</p>';

    $$('.item', els.grid).forEach(card => {
      const action = () => playItem(state.playlist[Number(card.dataset.index)]);
      card.addEventListener('click', action);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); action(); } });
    });
    els.loadMore.hidden = items.length <= state.visible;
  }

  function renderLibrary() {
    stats();
    if (!state.playlist.length) {
      $('#library').innerHTML = `<div class="empty"><div class="empty-icon">✦</div><h2>Sua biblioteca está esperando</h2><p>Carregue um arquivo M3U/M3U8 do seu aparelho. O Sinal IPTV organiza os itens por canais, filmes, séries e categorias.</p><button class="primary" id="addEmpty2">Adicionar playlist</button></div>`;
      $('#addEmpty2').onclick = () => openModal(els.playlistModal);
      return;
    }
    $('#library').innerHTML = `<div class="empty"><div class="empty-icon">✓</div><h2>Playlist carregada</h2><p>${state.playlist.length.toLocaleString('pt-BR')} itens prontos para explorar.</p><div class="hero-actions" style="justify-content:center"><button class="primary" id="openCatalog">Explorar conteúdo</button><button class="secondary" id="changePlaylist">Trocar playlist</button></div></div>`;
    $('#openCatalog').onclick = () => showCatalog('all');
    $('#changePlaylist').onclick = () => openModal(els.playlistModal);
    stats();
  }

  function destroyHls() {
    if (state.hls) { try { state.hls.destroy(); } catch (_) {} state.hls = null; }
  }

  async function playItem(item) {
    if (!item?.url) return;
    destroyHls();
    els.playerTitle.textContent = item.title;
    els.playerMeta.textContent = `${item.type}${item.group ? ` • ${item.group}` : ''}`;
    els.playerNotice.textContent = 'Preparando reprodução…';
    els.video.removeAttribute('src'); els.video.load();
    openModal(els.playerModal);

    const url = item.url;
    const isHls = /\.m3u8(?:$|\?)/i.test(url) || /application\/vnd\.apple\.mpegurl/i.test(item.mime || '');

    // Safari/iOS: prefer native HLS. Outros navegadores: hls.js quando disponível.
    if (isHls && window.Hls && Hls.isSupported()) {
      state.hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      state.hls.loadSource(url);
      state.hls.attachMedia(els.video);
      state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        els.playerNotice.textContent = 'HLS pronto. Pressione play se o navegador não iniciar automaticamente.';
        els.video.play().catch(() => {});
      });
      state.hls.on(Hls.Events.ERROR, (_, data) => {
        if (data?.fatal) els.playerNotice.textContent = 'O servidor recusou a reprodução ou não permite acesso pelo navegador (CORS/rede).';
      });
    } else {
      els.video.src = url;
      els.video.addEventListener('loadedmetadata', () => { els.playerNotice.textContent = 'Reprodução pronta.'; }, { once: true });
      els.video.addEventListener('error', () => { els.playerNotice.textContent = 'Não foi possível reproduzir este item neste navegador. O servidor pode bloquear CORS ou o formato pode não ser compatível.'; }, { once: true });
      els.video.play().catch(() => {});
    }
  }

  async function importFile(file) {
    if (!file) { toast('Selecione um arquivo M3U/M3U8 primeiro.'); return; }
    try {
      els.loadFile.disabled = true; els.loadFile.textContent = 'Lendo…';
      const text = await file.text();
      const parsed = parseM3U(text);
      if (!parsed.length) throw new Error('empty');
      state.playlist = parsed;
      state.filter = 'all'; state.group = ''; state.query = '';
      els.search.value = '';
      await savePlaylist(parsed);
      rebuildGroups(); renderLibrary(); showCatalog('all', false); closeModal(els.playlistModal);
      toast(`${parsed.length.toLocaleString('pt-BR')} itens carregados com sucesso.`);
    } catch (err) {
      toast(err.message === 'empty' ? 'Não encontrei entradas válidas nessa playlist M3U/M3U8.' : 'Não foi possível ler o arquivo.');
    } finally {
      els.loadFile.disabled = false; els.loadFile.textContent = 'Carregar arquivo';
    }
  }

  // Eventos
  $('#addTop').onclick = () => openModal(els.playlistModal);
  $('#addHero').onclick = () => openModal(els.playlistModal);
  $('#addEmpty').onclick = () => openModal(els.playlistModal);
  $('#explore').onclick = () => state.playlist.length ? showCatalog('all') : openModal(els.playlistModal);
  $('#fileInput').onchange = e => { const f = e.target.files[0]; els.fileName.textContent = f ? f.name : 'Nenhum arquivo selecionado'; };
  $('#loadFile').onclick = () => importFile(els.fileInput.files[0]);
  els.loadMore.onclick = () => { state.visible += 120; renderGrid(); };
  els.search.oninput = e => { state.query = e.target.value.trim(); state.visible = 120; renderGrid(); };
  els.groupSelect.onchange = e => { state.group = e.target.value; state.visible = 120; renderGrid(); };
  $$('.tab').forEach(tab => tab.onclick = () => showCatalog(tab.dataset.filter));
  $$('.stat').forEach(stat => stat.onclick = () => stat.dataset.stat === 'Categorias' ? showCatalog('all') : showCatalog(stat.dataset.stat));
  $$('[data-go]').forEach(btn => btn.onclick = () => { showCatalog(btn.dataset.go === 'inicio' ? 'all' : btn.dataset.go, btn.dataset.go !== 'inicio'); if (btn.dataset.go === 'inicio') window.scrollTo({top:0,behavior:'smooth'}); });
  $('#mobileMenu').onclick = () => els.nav.classList.toggle('open');
  $$('[data-close]').forEach(btn => btn.onclick = () => closeModal($('#' + btn.dataset.close)));
  [els.playlistModal, els.playerModal].forEach(modal => modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(els.playlistModal); closeModal(els.playerModal); } });
  els.playerModal.addEventListener('click', e => { if (e.target === els.playerModal) { destroyHls(); els.video.pause(); els.video.removeAttribute('src'); els.video.load(); } });
  $('#playerModal').querySelector('.close').addEventListener('click', () => { destroyHls(); els.video.pause(); els.video.removeAttribute('src'); els.video.load(); });

  ['dragenter','dragover'].forEach(type => els.dropzone.addEventListener(type, e => { e.preventDefault(); els.dropzone.classList.add('drag'); }));
  ['dragleave','drop'].forEach(type => els.dropzone.addEventListener(type, e => { e.preventDefault(); els.dropzone.classList.remove('drag'); }));
  els.dropzone.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) { els.fileInput.files = e.dataTransfer.files; els.fileName.textContent = f.name; importFile(f); } });

  (async () => {
    state.playlist = await loadPlaylist();
    rebuildGroups(); renderLibrary(); stats();
  })();
})();
