(() => {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  const state = {
    playlist: [],
    search: "",
    category: "all",
    section: "all",
    favoritesOnly: false,
    favorites: new Set(),
    current: null,
    hero: null,
    hls: null
  };

  const splash = $("#splash");
  const setupScreen = $("#setupScreen");
  const loadingScreen = $("#loadingScreen");
  const homeScreen = $("#homeScreen");
  const search = $("#search");
  const video = $("#videoPlayer");
  const playerModal = $("#playerModal");

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function uid(item) {
    return [
      item.title,
      item.url,
      item.group,
      item.type
    ]
      .map(normalize)
      .join("|");
  }

  function showSetup() {
    loadingScreen?.classList.add("hidden");
    homeScreen?.classList.add("hidden");
    setupScreen?.classList.remove("hidden");
  }

  function showLoading(text = "Lendo playlist...") {
    setupScreen?.classList.add("hidden");
    homeScreen?.classList.add("hidden");
    loadingScreen?.classList.remove("hidden");

    const loadingText = $("#loadingText");
    if (loadingText) loadingText.textContent = text;

    const progress = $("#loadingProgress");
    if (progress) progress.style.width = "20%";
  }

  function hideLoading() {
    loadingScreen?.classList.add("hidden");
  }

  function setSetupMessage(message, type = "error") {
    const el = $("#setupMessage");

    if (!el) return;

    el.textContent = message || "";
    el.className =
      `setup-message ${message ? type : ""}`;
  }

  function showToast(message) {
    let toast = $("#sinalToast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "sinalToast";
      toast.className = "sinal-toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toast._timer);

    toast._timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  /* =====================================================
     PLAYLIST M3U
  ===================================================== */

  function parseM3U(text) {
    const lines = String(text || "")
      .replace(/\r/g, "")
      .split("\n")
      .map(line => line.trim());

    const items = [];

    let metadata = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line) continue;

      if (line.startsWith("#EXTINF")) {
        metadata = parseExtInf(line);
        continue;
      }

      if (
        metadata &&
        !line.startsWith("#")
      ) {
        metadata.url = line;

        metadata.uid = uid(metadata);

        items.push(metadata);

        metadata = null;
      }
    }

    return items;
  }

  function parseExtInf(line) {
    const attrs = {};

    const attributeRegex =
      /([\w-]+)="([^"]*)"/g;

    let match;

    while (
      (match = attributeRegex.exec(line))
    ) {
      attrs[match[1].toLowerCase()] =
        match[2];
    }

    const comma =
      line.indexOf(",");

    let title =
      comma >= 0
        ? line.slice(comma + 1).trim()
        : "Sem título";

    title =
      title.replace(/^["']|["']$/g, "");

    const group =
      attrs["group-title"] ||
      attrs["group"] ||
      "Outros";

    const logo =
      attrs["tvg-logo"] ||
      attrs["logo"] ||
      "";

    const tvgName =
      attrs["tvg-name"] ||
      "";

    const tvgId =
      attrs["tvg-id"] ||
      "";

    return {
      title:
        tvgName ||
        title ||
        "Sem título",

      group,
      logo,
      tvgId,

      type:
        detectType(
          group,
          title,
          attrs
        ),

      url: ""
    };
  }

  function detectType(group, title, attrs = {}) {
    const text =
      normalize(
        `${group} ${title} ${attrs["content-type"] || ""}`
      );

    if (
      text.includes("serie") ||
      text.includes("series") ||
      text.includes("season") ||
      text.includes("temporada") ||
      text.includes("s01") ||
      text.includes("s02")
    ) {
      return "series";
    }

    if (
      text.includes("filme") ||
      text.includes("filmes") ||
      text.includes("movie") ||
      text.includes("movies") ||
      text.includes("cinema")
    ) {
      return "movies";
    }

    return "channels";
  }

  /* =====================================================
     CAPA
  ===================================================== */

  function getPlaceholder(item) {
    const letter =
      escapeHTML(
        String(item.title || "S")
          .charAt(0)
          .toUpperCase()
      );

    return `
      <div class="card-placeholder">
        <span>${letter}</span>
      </div>
    `;
  }

  function cardHTML(item) {
    const favorite =
      state.favorites.has(item.uid);

    const logo =
      item.logo
        ? `
          <img
            src="${escapeHTML(item.logo)}"
            alt=""
            loading="lazy"
            onerror="this.style.display='none'"
          >
        `
        : getPlaceholder(item);

    return `
      <article
        class="media-card"
        data-uid="${escapeHTML(item.uid)}"
      >

        <button
          class="card-favorite ${favorite ? "active" : ""}"
          data-action="favorite"
          data-uid="${escapeHTML(item.uid)}"
          type="button"
          aria-label="Favorito"
        >
          ${favorite ? "★" : "☆"}
        </button>

        <button
          class="card-body"
          data-action="play"
          data-uid="${escapeHTML(item.uid)}"
          type="button"
        >

          <div class="card-poster">
            ${logo}
          </div>

          <div class="card-info">

            <strong>
              ${escapeHTML(item.title)}
            </strong>

            <span>
              ${escapeHTML(item.group || "Outros")}
            </span>

          </div>

        </button>

      </article>
    `;
  }

  /* =====================================================
     FILTROS
  ===================================================== */

  function getFilteredItems() {
    let items = [...state.playlist];

    if (state.section !== "all") {
      items =
        items.filter(
          item =>
            item.type === state.section
        );
    }

    if (
      state.category !== "all"
    ) {
      items =
        items.filter(
          item =>
            normalize(item.group) ===
            normalize(state.category)
        );
    }

    if (state.favoritesOnly) {
      items =
        items.filter(
          item =>
            state.favorites.has(item.uid)
        );
    }

    const query =
      normalize(state.search);

    if (query) {
      items =
        items.filter(item => {
          const haystack =
            normalize(
              `${item.title} ${item.group} ${item.tvgId}`
            );

          return haystack.includes(query);
        });
    }

    return items;
  }

  function getCategories(type) {
    const groups = new Map();

    state.playlist
      .filter(item =>
        item.type === type
      )
      .forEach(item => {
        const key =
          item.group ||
          "Outros";

        const normalized =
          normalize(key);

        if (!groups.has(normalized)) {
          groups.set(
            normalized,
            {
              name: key,
              items: []
            }
          );
        }

        groups
          .get(normalized)
          .items
          .push(item);
      });

    return [...groups.values()];
  }

  /* =====================================================
     FILEIRAS HORIZONTAIS
  ===================================================== */

  function renderRow(title, items) {
    if (!items.length) {
      return "";
    }

    return `
      <section class="content-row">

        <div class="row-heading">

          <h2>
            ${escapeHTML(title)}
          </h2>

          <span>
            ${items.length}
          </span>

        </div>

        <div class="media-row">

          ${items
            .map(cardHTML)
            .join("")}

        </div>

      </section>
    `;
  }

  function renderSectionRows(type, title) {
    const categories =
      getCategories(type);

    let html = "";

    categories.forEach(category => {
      const items =
        category.items.filter(item =>
          matchesSearch(item)
        );

      if (items.length) {
        html +=
          renderRow(
            category.name,
            items
          );
      }
    });

    if (!html) {
      const items =
        getFilteredItems();

      if (items.length) {
        html =
          renderRow(
            title,
            items
          );
      }
    }

    return html;
  }

  function matchesSearch(item) {
    const query =
      normalize(state.search);

    if (!query) return true;

    return normalize(
      `${item.title} ${item.group} ${item.tvgId}`
    ).includes(query);
  }

  function renderLibrary() {
    const container =
      $("#library");

    if (!container) return;

    const query =
      normalize(state.search);

    let html = "";

    /*
     * Quando o usuário está pesquisando,
     * mostramos os resultados em uma única
     * fileira organizada.
     */

    if (query || state.favoritesOnly) {
      const items =
        getFilteredItems();

      html =
        items.length
          ? renderRow(
              state.favoritesOnly
                ? "Meus favoritos"
                : "Resultados da busca",
              items
            )
          : `
            <div class="empty-state">
              <div>⌕</div>
              <h3>Nada encontrado</h3>
              <p>
                Tente outro nome, categoria ou título.
              </p>
            </div>
          `;

      container.innerHTML = html;
      bindCards();
      return;
    }

    /*
     * Tela inicial:
     * primeiro os três grandes grupos.
     */

    if (state.section === "all") {

      html +=
        renderFeaturedType(
          "movies",
          "Filmes"
        );

      html +=
        renderFeaturedType(
          "series",
          "Séries"
        );

      html +=
        renderFeaturedType(
          "channels",
          "Canais"
        );

    } else if (
      state.section === "movies"
    ) {

      html =
        renderSectionRows(
          "movies",
          "Filmes"
        );

    } else if (
      state.section === "series"
    ) {

      html =
        renderSectionRows(
          "series",
          "Séries"
        );

    } else if (
      state.section === "channels"
    ) {

      html =
        renderSectionRows(
          "channels",
          "Canais"
        );

    }

    if (!html) {
      html = `
        <div class="empty-state">
          <div>✦</div>
          <h3>Sua biblioteca está vazia</h3>
          <p>
            Adicione uma playlist para começar.
          </p>
        </div>
      `;
    }

    container.innerHTML = html;

    bindCards();
  }

  function renderFeaturedType(type, title) {
    const items =
      state.playlist.filter(
        item =>
          item.type === type
      );

    if (!items.length) {
      return "";
    }

    /*
     * Na home mostramos uma seleção
     * representativa do grupo.
     * Ao entrar no grupo, todas as
     * categorias aparecem.
     */

    const limit =
      Math.min(items.length, 20);

    return renderRow(
      title,
      items.slice(0, limit)
    );
  }

  /* =====================================================
     NAVEGAÇÃO
     ===================================================== */

  function renderNavigation() {
    const nav =
      $("#navigation");

    if (!nav) return;

    const counts = {
      movies:
        state.playlist.filter(
          i => i.type === "movies"
        ).length,

      series:
        state.playlist.filter(
          i => i.type === "series"
        ).length,

      channels:
        state.playlist.filter(
          i => i.type === "channels"
        ).length
    };

    nav.innerHTML = `
      <button
        class="nav-item ${state.section === "all" ? "active" : ""}"
        data-section="all"
        type="button"
      >
        <span>⌂</span>
        <b>Início</b>
      </button>

      <button
        class="nav-item ${state.section === "movies" ? "active" : ""}"
        data-section="movies"
        type="button"
      >
        <span>▣</span>
        <b>Filmes</b>
        <small>${counts.movies}</small>
      </button>

      <button
        class="nav-item ${state.section === "series" ? "active" : ""}"
        data-section="series"
        type="button"
      >
        <span>▤</span>
        <b>Séries</b>
        <small>${counts.series}</small>
      </button>

      <button
        class="nav-item ${state.section === "channels" ? "active" : ""}"
        data-section="channels"
        type="button"
      >
        <span>◉</span>
        <b>Canais</b>
        <small>${counts.channels}</small>
      </button>

      <button
        class="nav-item ${state.favoritesOnly ? "active" : ""}"
        data-favorites="true"
        type="button"
      >
        <span>☆</span>
        <b>Favoritos</b>
      </button>
    `;

    $$(".nav-item", nav)
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            if (
              button.dataset.favorites
            ) {

              state.favoritesOnly =
                !state.favoritesOnly;

              state.section =
                "all";

              state.category =
                "all";

            } else {

              state.section =
                button.dataset.section ||
                "all";

              state.category =
                "all";

              state.favoritesOnly =
                false;

            }

            renderNavigation();
            renderLibrary();

            $("#sidebar")
              ?.classList.remove("open");
          }
        );

      });
  }

  /* =====================================================
     CARDS
  ===================================================== */

  function bindCards() {
    $$(".media-card")
      .forEach(card => {

        const uidValue =
          card.dataset.uid;

        card
          .querySelector(
            '[data-action="play"]'
          )
          ?.addEventListener(
            "click",
            () => {

              const item =
                state.playlist.find(
                  x =>
                    x.uid === uidValue
                );

              if (item) {
                openPlayer(item);
              }

            }
          );

        card
          .querySelector(
            '[data-action="favorite"]'
          )
          ?.addEventListener(
            "click",
            event => {

              event.stopPropagation();

              toggleFavorite(
                uidValue
              );

            }
          );

      });
  }

  function toggleFavorite(uidValue) {
    if (
      state.favorites.has(uidValue)
    ) {

      state.favorites.delete(
        uidValue
      );

    } else {

      state.favorites.add(
        uidValue
      );

    }

    saveFavorites();

    renderLibrary();
  }

  function saveFavorites() {
    try {
      localStorage.setItem(
        "sinal_favorites",
        JSON.stringify(
          [...state.favorites]
        )
      );
    } catch {}
  }

  function loadFavorites() {
    try {
      const saved =
        JSON.parse(
          localStorage.getItem(
            "sinal_favorites"
          ) || "[]"
        );

      state.favorites =
        new Set(saved);

    } catch {
      state.favorites =
        new Set();
    }
  }

  /* =====================================================
     PLAYLIST
  ===================================================== */

  async function handleFile(file, name) {
    if (!file) {
      throw new Error(
        "Selecione um arquivo M3U ou M3U8."
      );
    }

    showLoading(
      "Lendo sua playlist..."
    );

    const text =
      await file.text();

    const playlist =
      parseM3U(text);

    if (!playlist.length) {
      throw new Error(
        "Não encontrei conteúdos válidos nessa playlist."
      );
    }

    const progress =
      $("#loadingProgress");

    if (progress) {
      progress.style.width = "75%";
    }

    await sleep(250);

    state.playlist =
      playlist;

    state.section =
      "all";

    state.category =
      "all";

    state.search =
      "";

    state.favoritesOnly =
      false;

    if (search) {
      search.value = "";
    }

    if (name) {
      try {
        localStorage.setItem(
          "sinal_playlist_name",
          name
        );
      } catch {}
    }

    if (progress) {
      progress.style.width = "100%";
    }

    await sleep(300);

    showHome();
  }

  async function handleURL(url, name) {
    if (!url) {
      throw new Error(
        "Digite a URL da playlist."
      );
    }

    showLoading(
      "Baixando playlist..."
    );

    let response;

    try {

      response =
        await fetch(url);

    } catch {

      throw new Error(
        "Não foi possível acessar essa URL. O servidor pode bloquear acesso externo (CORS)."
      );

    }

    if (!response.ok) {
      throw new Error(
        `Servidor respondeu com erro ${response.status}.`
      );
    }

    const text =
      await response.text();

    await handlePlaylistText(
      text,
      name
    );
  }

  async function handlePlaylistText(text, name) {
    const playlist =
      parseM3U(text);

    if (!playlist.length) {
      throw new Error(
        "A playlist não contém itens reconhecíveis."
      );
    }

    state.playlist =
      playlist;

    state.section =
      "all";

    state.category =
      "all";

    state.search =
      "";

    state.favoritesOnly =
      false;

    if (search) {
      search.value = "";
    }

    if (name) {
      try {
        localStorage.setItem(
          "sinal_playlist_name",
          name
        );
      } catch {}
    }

    await sleep(200);

    showHome();
  }

  async function handleXtream(
    server,
    username,
    password,
    name
  ) {

    if (
      !server ||
      !username ||
      !password
    ) {
      throw new Error(
        "Preencha servidor, usuário e senha."
      );
    }

    showLoading(
      "Conectando ao servidor..."
    );

    const base =
      server
        .trim()
        .replace(/\/+$/, "");

    const url =
      `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    let response;

    try {
      response =
        await fetch(url);

    } catch {

      throw new Error(
        "Não foi possível conectar ao servidor Xtream. Verifique o endereço e o acesso do servidor."
      );

    }

    if (!response.ok) {
      throw new Error(
        "O servidor Xtream não respondeu corretamente."
      );
    }

    const data =
      await response.json();

    const items = [];

    /*
     * Canais ao vivo
     */

    if (
      Array.isArray(
        data.live_streams
      )
    ) {

      data.live_streams
        .forEach(item => {

          items.push({
            title:
              item.name ||
              "Canal",

            group:
              item.category_name ||
              "Canais",

            logo:
              item.stream_icon ||
              "",

            type:
              "channels",

            url:
              `${base}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${item.stream_id}.m3u8`,

            uid: ""
          });

        });

    }

    /*
     * Filmes
     */

    if (
      Array.isArray(
        data.movies
      )
    ) {

      data.movies
        .forEach(item => {

          items.push({
            title:
              item.name ||
              "Filme",

            group:
              item.category_name ||
              "Filmes",

            logo:
              item.stream_icon ||
              "",

            type:
              "movies",

            url:
              `${base}/movie/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${item.stream_id}.${item.container_extension || "mp4"}`,

            uid: ""
          });

        });

    }

    /*
     * Séries
     */

    if (
      Array.isArray(
        data.series
      )
    ) {

      data.series
        .forEach(item => {

          items.push({
            title:
              item.name ||
              "Série",

            group:
              item.category_name ||
              "Séries",

            logo:
              item.cover ||
              "",

            type:
              "series",

            url:
              "",

            uid: ""
          });

        });

    }

    items.forEach(
      item =>
        item.uid =
          uid(item)
    );

    if (!items.length) {
      throw new Error(
        "O servidor não retornou conteúdos."
      );
    }

    state.playlist =
      items;

    if (name) {
      try {
        localStorage.setItem(
          "sinal_playlist_name",
          name
        );
      } catch {}
    }

    showHome();
  }

  /* =====================================================
     HOME
  ===================================================== */

  function showHome() {
    hideLoading();

    setupScreen?.classList.add(
      "hidden"
    );

    homeScreen?.classList.remove(
      "hidden"
    );

    renderNavigation();
    renderLibrary();

    setupHeroContent();
  }

  function setupHeroContent() {
    if (!state.playlist.length) {
      return;
    }

    const candidates =
      state.playlist.filter(
        item =>
          item.type === "movies" ||
          item.type === "series"
      );

    state.hero =
      candidates[0] ||
      state.playlist[0];

    const title =
      $("#heroTitle");

    const description =
      $("#heroDescription");

    const backdrop =
      $("#heroBackdrop");

    if (title) {
      title.textContent =
        state.hero.title;
    }

    if (description) {
      description.textContent =
        state.hero.group ||
        "Disponível na sua biblioteca";
    }

    if (
      backdrop &&
      state.hero.logo
    ) {
      backdrop.style.backgroundImage =
        `url("${state.hero.logo}")`;
    }
  }

  /* =====================================================
     TABS
  ===================================================== */

  function setupTabs() {
    const tabs =
      $$(".source-tab");

    const panels = {
      file: $("#filePanel"),
      url: $("#urlPanel"),
      xtream: $("#xtreamPanel")
    };

    tabs.forEach(tab => {

      tab.addEventListener(
        "click",
        () => {

          const target =
            tab.dataset.tab;

          tabs.forEach(t =>
            t.classList.remove(
              "active"
            )
          );

          tab.classList.add(
            "active"
          );

          Object.values(panels)
            .forEach(panel =>
              panel?.classList.remove(
                "active"
              )
            );

          panels[target]
            ?.classList.add(
              "active"
            );

          setSetupMessage("");
        }
      );

    });
  }

  /* =====================================================
     UPLOAD
  ===================================================== */

  function setupFileInput() {
    const input =
      $("#playlistFile");

    const zone =
      $("#uploadZone");

    const label =
      $("#selectedFile");

    if (!input) return;

    input.addEventListener(
      "change",
      () => {

        const file =
          input.files?.[0];

        if (label) {
          label.textContent =
            file
              ? file.name
              : "M3U / M3U8";
        }

      }
    );

    if (!zone) return;

    [
      "dragenter",
      "dragover"
    ].forEach(
      eventName => {

        zone.addEventListener(
          eventName,
          event => {

            event.preventDefault();

            zone.classList.add(
              "dragover"
            );

          }
        );

      }
    );

    [
      "dragleave",
      "drop"
    ].forEach(
      eventName => {

        zone.addEventListener(
          eventName,
          event => {

            event.preventDefault();

            zone.classList.remove(
              "dragover"
            );

          }
        );

      }
    );

    zone.addEventListener(
      "drop",
      event => {

        const file =
          event.dataTransfer
            ?.files?.[0];

        if (!file) return;

        try {

          const transfer =
            new DataTransfer();

          transfer.items.add(
            file
          );

          input.files =
            transfer.files;

          if (label) {
            label.textContent =
              file.name;
          }

        } catch {

          showToast(
            "Clique na área e selecione o arquivo manualmente."
          );

        }

      }
    );
  }

  /* =====================================================
     FORMULÁRIOS
  ===================================================== */

  function setupForms() {

    $("#filePanel")
      ?.addEventListener(
        "submit",
        async event => {

          event.preventDefault();

          try {

            const file =
              $("#playlistFile")
                ?.files?.[0];

            const name =
              $("#playlistName")
                ?.value
                .trim();

            await handleFile(
              file,
              name
            );

          } catch (error) {

            hideLoading();

            setSetupMessage(
              error.message
            );

            showToast(
              error.message
            );

          }

        }
      );

    $("#urlPanel")
      ?.addEventListener(
        "submit",
        async event => {

          event.preventDefault();

          try {

            const url =
              $("#playlistUrl")
                ?.value
                .trim();

            const name =
              $("#urlPlaylistName")
                ?.value
                .trim();

            await handleURL(
              url,
              name
            );

          } catch (error) {

            hideLoading();

            setSetupMessage(
              error.message
            );

            showToast(
              error.message
            );

          }

        }
      );

    $("#xtreamPanel")
      ?.addEventListener(
        "submit",
        async event => {

          event.preventDefault();

          try {

            await handleXtream(

              $("#xtreamServer")
                ?.value
                .trim(),

              $("#xtreamUsername")
                ?.value
                .trim(),

              $("#xtreamPassword")
                ?.value,

              $("#xtreamName")
                ?.value
                .trim()

            );

          } catch (error) {

            hideLoading();

            setSetupMessage(
              error.message
            );

            showToast(
              error.message
            );

          }

        }
      );
  }

  /* =====================================================
     PESQUISA
     ===================================================== */

  function setupSearch() {
    if (!search) return;

    search.addEventListener(
      "input",
      event => {

        state.search =
          event.target.value;

        /*
         * A pesquisa não muda o visual
         * nem a página. Apenas filtra.
         */

        renderLibrary();

      }
    );

    search.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Escape"
        ) {

          search.value = "";
          state.search = "";

          renderLibrary();

        }

      }
    );
  }

  /* =====================================================
     FAVORITOS
     ===================================================== */

  function setupFavorites() {

    $("#favoritesToggle")
      ?.addEventListener(
        "click",
        () => {

          state.favoritesOnly =
            !state.favoritesOnly;

          state.search = "";

          if (search) {
            search.value = "";
          }

          renderNavigation();
          renderLibrary();

        }
      );
  }

  /* =====================================================
     MOBILE
     ===================================================== */

  function setupMobileMenu() {

    $("#mobileMenu")
      ?.addEventListener(
        "click",
        () => {

          $("#sidebar")
            ?.classList.toggle(
              "open"
            );

        }
      );
  }

  /* =====================================================
     PLAYER
     ===================================================== */

  function openPlayer(item) {
    state.current = item;

    if (!playerModal) {
      playStream(item);
      return;
    }

    playerModal.classList.remove(
      "hidden"
    );

    const title =
      $("#playerTitle");

    if (title) {
      title.textContent =
        item.title;
    }

    const favorite =
      $("#playerFavorite");

    if (favorite) {
      favorite.textContent =
        state.favorites.has(item.uid)
          ? "★"
          : "☆";
    }

    playStream(item);
  }

  function closePlayer() {
    try {
      if (state.hls) {
        state.hls.destroy();
        state.hls = null;
      }
    } catch {}

    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }

    playerModal?.classList.add(
      "hidden"
    );

    state.current = null;
  }

  function setPlayerLoading(value) {
    const loader =
      $("#playerLoading");

    loader?.classList.toggle(
      "hidden",
      !value
    );
  }

  function setPlayerError(
    value,
    message = ""
  ) {
    const error =
      $("#playerError");

    if (!error) return;

    error.classList.toggle(
      "hidden",
      !value
    );

    if (message) {
      error.textContent =
        message;
    }
  }

  function playStream(item) {
    if (!item?.url) {
      setPlayerError(
        true,
        "Este conteúdo não possui uma URL de reprodução disponível."
      );
      return;
    }

    if (!video) {
      window.open(
        item.url,
        "_blank",
        "noopener"
      );
      return;
    }

    setPlayerLoading(true);
    setPlayerError(false);

    try {
      if (state.hls) {
        state.hls.destroy();
        state.hls = null;
      }
    } catch {}

    const isHLS =
      /\.m3u8($|\?)/i.test(
        item.url
      );

    if (
      isHLS &&
      window.Hls &&
      Hls.isSupported()
    ) {

      state.hls =
        new Hls();

      state.hls.loadSource(
        item.url
      );

      state.hls.attachMedia(
        video
      );

      state.hls.on(
        Hls.Events.MANIFEST_PARSED,
        () => {

          video.play()
            .catch(() => {});

        }
      );

      state.hls.on(
        Hls.Events.ERROR,
        (_, data) => {

          if (
            data?.fatal
          ) {

            setPlayerError(
              true,
              "Não foi possível reproduzir este stream."
            );

          }

        }
      );

      return;
    }

    video.src =
      item.url;

    video.play()
      .catch(() => {});
  }

  function setupPlayer() {

    $("#closePlayer")
      ?.addEventListener(
        "click",
        closePlayer
      );

    playerModal
      ?.addEventListener(
        "click",
        event => {

          if (
            event.target ===
            playerModal
          ) {
            closePlayer();
          }

        }
      );

    $("#playerFavorite")
      ?.addEventListener(
        "click",
        () => {

          if (
            state.current
          ) {

            toggleFavorite(
              state.current.uid
            );

            const button =
              $("#playerFavorite");

            if (button) {
              button.textContent =
                state.favorites.has(
                  state.current.uid
                )
                  ? "★"
                  : "☆";
            }

          }

        }
      );

    $("#retryPlayer")
      ?.addEventListener(
        "click",
        () => {

          if (
            state.current
          ) {
            playStream(
              state.current
            );
          }

        }
      );

    video
      ?.addEventListener(
        "waiting",
        () =>
          setPlayerLoading(true)
      );

    video
      ?.addEventListener(
        "playing",
        () => {

          setPlayerLoading(false);
          setPlayerError(false);

        }
      );

    video
      ?.addEventListener(
        "canplay",
        () =>
          setPlayerLoading(false)
      );

    video
      ?.addEventListener(
        "error",
        () => {

          setPlayerLoading(false);

          setPlayerError(
            true,
            "Este stream não pôde ser reproduzido diretamente pelo navegador."
          );

        }
      );
  }

  /* =====================================================
     HERO
     ===================================================== */

  function setupHero() {

    $("#heroPlay")
      ?.addEventListener(
        "click",
        () => {

          if (state.hero) {
            openPlayer(
              state.hero
            );
          }

        }
      );

    $("#heroInfo")
      ?.addEventListener(
        "click",
        () => {

          if (state.hero) {

            showToast(
              `${state.hero.title} · ${state.hero.group}`
            );

          }

        }
      );
  }

  /* =====================================================
     TROCAR PLAYLIST
     ===================================================== */

  function setupChangePlaylist() {

    const handler =
      () => {

        showSetup();

        setSetupMessage("");

      };

    $("#changePlaylist")
      ?.addEventListener(
        "click",
        handler
      );

    $("#sidebarChange")
      ?.addEventListener(
        "click",
        handler
      );
  }

  /* =====================================================
     TECLADO
     ===================================================== */

  function setupKeyboard() {

    document.addEventListener(
      "keydown",
      event => {

        if (
          event.key ===
          "Escape"
        ) {

          closePlayer();

          $("#sidebar")
            ?.classList.remove(
              "open"
            );

        }

      }
    );
  }

  /* =====================================================
     SPLASH
     ===================================================== */

  async function startSplash() {

    await sleep(900);

    splash?.classList.add(
      "hide"
    );

    await sleep(500);

    splash?.classList.add(
      "hidden"
    );

    setupScreen?.classList.remove(
      "hidden"
    );
  }

  /* =====================================================
     INIT
     ===================================================== */

  function init() {

    loadFavorites();

    setupTabs();
    setupFileInput();
    setupForms();
    setupSearch();
    setupFavorites();
    setupMobileMenu();
    setupPlayer();
    setupHero();
    setupChangePlaylist();
    setupKeyboard();

    startSplash();
  }

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );

  } else {

    init();

  }

})();
