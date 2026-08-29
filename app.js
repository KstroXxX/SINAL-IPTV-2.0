/* =========================================================
   SINAL IPTV — APP.JS
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     CONFIGURAÇÃO
     ========================================================= */

  const STORAGE_KEYS = {
    playlists: "sinal_iptv_playlists",
    favorites: "sinal_iptv_favorites"
  };

  let playlists = loadJSON(STORAGE_KEYS.playlists, []);
  let favorites = loadJSON(STORAGE_KEYS.favorites, []);

  let channels = [];
  let activeCategory = "Todos";
  let currentPlaylistId = null;
  let currentView = "home";


  /* =========================================================
     HELPERS
     ========================================================= */

  function $(selector) {
    return document.querySelector(selector);
  }

  function $all(selector) {
    return [...document.querySelectorAll(selector)];
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function loadJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function generateId() {
    return (
      Date.now().toString(36) +
      Math.random().toString(36).substring(2, 10)
    );
  }

  function getInitials(name) {
    return String(name || "S")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(word => word[0])
      .join("")
      .toUpperCase();
  }

  function getChannelKey(channel) {
    return (
      channel.id ||
      `${channel.name}-${channel.url}`
    );
  }

  function isFavorite(channel) {
    return favorites.includes(getChannelKey(channel));
  }


  /* =========================================================
     TOAST
     ========================================================= */

  function showToast(message, type = "info") {
    let container = $("#toastContainer");

    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");

    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${escapeHTML(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("toast-hide");

      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }


  /* =========================================================
     MODAL
     ========================================================= */

  function openPlaylistModal() {
    const modal = $("#playlistModal");

    if (!modal) return;

    modal.classList.remove("hidden");

    document.body.classList.add("modal-open");

    resetPlaylistForm();
  }

  function closePlaylistModal() {
    const modal = $("#playlistModal");

    if (!modal) return;

    modal.classList.add("hidden");

    document.body.classList.remove("modal-open");
  }


  function resetPlaylistForm() {
    const name = $("#playlistName");
    const url = $("#playlistUrl");
    const file = $("#playlistFile");

    if (name) name.value = "";
    if (url) url.value = "";
    if (file) file.value = "";

    const xtreamServer = $("#xtreamServer");
    const xtreamUsername = $("#xtreamUsername");
    const xtreamPassword = $("#xtreamPassword");

    if (xtreamServer) xtreamServer.value = "";
    if (xtreamUsername) xtreamUsername.value = "";
    if (xtreamPassword) xtreamPassword.value = "";

    switchSource("url");
  }


  /* =========================================================
     SOURCE TABS
     ========================================================= */

  function switchSource(source) {
    $all(".source-tab").forEach(tab => {
      tab.classList.toggle(
        "active",
        tab.dataset.source === source
      );
    });

    $all(".source-panel").forEach(panel => {
      panel.classList.toggle(
        "active",
        panel.dataset.sourcePanel === source
      );
    });
  }


  /* =========================================================
     PLAYLIST STORAGE
     ========================================================= */

  function addPlaylist(playlist) {
    playlists.push(playlist);

    saveJSON(
      STORAGE_KEYS.playlists,
      playlists
    );

    currentPlaylistId = playlist.id;

    loadPlaylistChannels(playlist);

    renderEverything();

    showToast(
      "Playlist adicionada com sucesso!",
      "success"
    );

    closePlaylistModal();
  }


  function removePlaylist(id) {
    const playlist = playlists.find(
      item => item.id === id
    );

    if (!playlist) return;

    const confirmed = confirm(
      `Remover a playlist "${playlist.name}"?`
    );

    if (!confirmed) return;

    playlists = playlists.filter(
      item => item.id !== id
    );

    saveJSON(
      STORAGE_KEYS.playlists,
      playlists
    );

    if (currentPlaylistId === id) {
      currentPlaylistId =
        playlists.length > 0
          ? playlists[0].id
          : null;

      channels = [];

      if (currentPlaylistId) {
        const nextPlaylist = playlists.find(
          item => item.id === currentPlaylistId
        );

        loadPlaylistChannels(nextPlaylist);
      }
    }

    renderEverything();

    showToast(
      "Playlist removida.",
      "success"
    );
  }


  function selectPlaylist(id) {
    const playlist = playlists.find(
      item => item.id === id
    );

    if (!playlist) return;

    currentPlaylistId = id;

    loadPlaylistChannels(playlist);

    renderEverything();

    showToast(
      `${playlist.name} selecionada.`,
      "success"
    );
  }


  /* =========================================================
     M3U PARSER
     ========================================================= */

  function parseM3U(content) {
    const lines = content
      .replace(/\r/g, "")
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    const result = [];

    for (let i = 0; i < lines.length; i++) {

      const line = lines[i];

      if (!line.startsWith("#EXTINF")) {
        continue;
      }

      const info = line;

      let url = "";

      for (
        let j = i + 1;
        j < lines.length;
        j++
      ) {
        if (
          lines[j] &&
          !lines[j].startsWith("#")
        ) {
          url = lines[j];
          break;
        }
      }

      if (!url) continue;

      const namePart = info.includes(",")
        ? info.substring(
            info.indexOf(",") + 1
          ).trim()
        : "Canal";

      const name = namePart || "Canal";

      const tvgId =
        getAttribute(info, "tvg-id");

      const tvgName =
        getAttribute(info, "tvg-name");

      const logo =
        getAttribute(info, "tvg-logo");

      const group =
        getAttribute(info, "group-title") ||
        "Outros";

      const channel = {
        id: generateId(),
        name:
          tvgName ||
          name,

        url,

        logo: logo || "",

        category:
          group || "Outros",

        tvgId:
          tvgId || "",

        raw:
          info
      };

      result.push(channel);
    }

    return result;
  }


  function getAttribute(line, attribute) {
    const regex = new RegExp(
      `${attribute}="([^"]*)"`,
      "i"
    );

    const match = line.match(regex);

    return match
      ? match[1]
      : "";
  }


  /* =========================================================
     LOAD PLAYLIST
     ========================================================= */

  async function loadPlaylistChannels(playlist) {
    if (!playlist) {
      channels = [];
      return;
    }

    currentPlaylistId = playlist.id;

    if (
      Array.isArray(playlist.channels) &&
      playlist.channels.length
    ) {
      channels = playlist.channels;

      renderEverything();

      return;
    }

    if (playlist.type === "file") {
      channels = [];

      renderEverything();

      return;
    }

    if (playlist.type === "m3u-url") {

      showToast(
        "Carregando playlist...",
        "info"
      );

      try {
        const response = await fetch(
          playlist.url
        );

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        const text =
          await response.text();

        channels = parseM3U(text);

        playlist.channels = channels;

        saveJSON(
          STORAGE_KEYS.playlists,
          playlists
        );

        renderEverything();

        showToast(
          `${channels.length} canais carregados.`,
          "success"
        );

      } catch (error) {

        console.error(error);

        channels = [];

        renderEverything();

        showToast(
          "Não foi possível carregar a URL. O servidor pode bloquear CORS.",
          "error"
        );
      }

      return;
    }

    if (playlist.type === "xtream") {

      await loadXtreamPlaylist(
        playlist
      );
    }
  }


  /* =========================================================
     XTREAM CODES
     ========================================================= */

  async function loadXtreamPlaylist(playlist) {

    showToast(
      "Conectando ao servidor...",
      "info"
    );

    let server =
      String(playlist.server || "")
        .trim();

    server =
      server.replace(/\/+$/, "");

    const username =
      encodeURIComponent(
        playlist.username || ""
      );

    const password =
      encodeURIComponent(
        playlist.password || ""
      );

    const url =
      `${server}/player_api.php` +
      `?username=${username}` +
      `&password=${password}`;

    try {

      const response =
        await fetch(url);

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      if (
        !data ||
        !data.user_info
      ) {
        throw new Error(
          "Credenciais inválidas."
        );
      }

      const streams =
        data.available_channels ||
        data.live_streams ||
        [];

      /*
       * Alguns servidores retornam os dados
       * diretamente pela API. Outros exigem
       * chamadas específicas para live streams.
       */

      let liveStreams = streams;

      if (
        !Array.isArray(liveStreams) ||
        liveStreams.length === 0
      ) {

        const liveUrl =
          `${server}/player_api.php` +
          `?username=${username}` +
          `&password=${password}` +
          `&action=get_live_streams`;

        const liveResponse =
          await fetch(liveUrl);

        if (!liveResponse.ok) {
          throw new Error(
            `HTTP ${liveResponse.status}`
          );
        }

        liveStreams =
          await liveResponse.json();
      }

      if (!Array.isArray(liveStreams)) {
        liveStreams = [];
      }

      channels =
        liveStreams.map(stream => {

          const streamId =
            stream.stream_id;

          const extension =
            stream.container_extension ||
            "ts";

          const streamUrl =
            `${server}/live/` +
            `${playlist.username}/` +
            `${playlist.password}/` +
            `${streamId}.${extension}`;

          return {
            id:
              String(
                streamId ||
                generateId()
              ),

            name:
              stream.name ||
              "Canal",

            url:
              streamUrl,

            logo:
              stream.stream_icon ||
              "",

            category:
              stream.category_name ||
              "TV",

            tvgId:
              stream.epg_channel_id ||
              ""
          };
        });

      playlist.channels =
        channels;

      saveJSON(
        STORAGE_KEYS.playlists,
        playlists
      );

      renderEverything();

      showToast(
        `${channels.length} canais carregados.`,
        "success"
      );

    } catch (error) {

      console.error(
        "Erro Xtream:",
        error
      );

      channels = [];

      renderEverything();

      showToast(
        "Não foi possível conectar ao servidor Xtream. Verifique os dados e o CORS.",
        "error"
      );
    }
  }


  /* =========================================================
     FILE M3U
     ========================================================= */

  async function handleM3UFile(file) {

    if (!file) return;

    const isM3U =
      /\.(m3u|m3u8)$/i.test(
        file.name
      ) ||
      file.type === "audio/x-mpegurl" ||
      file.type === "application/x-mpegURL";

    if (!isM3U) {

      showToast(
        "Selecione um arquivo M3U ou M3U8.",
        "error"
      );

      return;
    }

    try {

      const content =
        await file.text();

      const parsed =
        parseM3U(content);

      if (!parsed.length) {

        showToast(
          "Nenhum canal foi encontrado nesse arquivo.",
          "error"
        );

        return;
      }

      const name =
        $("#playlistName")?.value.trim() ||
        file.name
          .replace(
            /\.(m3u|m3u8)$/i,
            ""
          );

      const playlist = {

        id:
          generateId(),

        name,

        type:
          "file",

        fileName:
          file.name,

        channels:
          parsed,

        createdAt:
          new Date().toISOString()

      };

      addPlaylist(
        playlist
      );

    } catch (error) {

      console.error(error);

      showToast(
        "Erro ao ler o arquivo M3U.",
        "error"
      );
    }
  }


  /* =========================================================
     ADD URL PLAYLIST
     ========================================================= */

  function handleURLPlaylist() {

    const name =
      $("#playlistName")?.value.trim();

    const url =
      $("#playlistUrl")?.value.trim();

    if (!name) {

      showToast(
        "Digite um nome para a playlist.",
        "error"
      );

      return;
    }

    if (!url) {

      showToast(
        "Digite a URL da playlist.",
        "error"
      );

      return;
    }

    try {
      new URL(url);
    } catch {

      showToast(
        "Digite uma URL válida.",
        "error"
      );

      return;
    }

    const playlist = {

      id:
        generateId(),

      name,

      type:
        "m3u-url",

      url,

      channels:
        [],

      createdAt:
        new Date().toISOString()

    };

    addPlaylist(
      playlist
    );
  }


  /* =========================================================
     ADD XTREAM
     ========================================================= */

  function handleXtreamPlaylist() {

    const name =
      $("#playlistName")?.value.trim();

    const server =
      $("#xtreamServer")?.value.trim();

    const username =
      $("#xtreamUsername")?.value.trim();

    const password =
      $("#xtreamPassword")?.value.trim();

    if (!name) {

      showToast(
        "Digite um nome para a playlist.",
        "error"
      );

      return;
    }

    if (
      !server ||
      !username ||
      !password
    ) {

      showToast(
        "Preencha servidor, usuário e senha.",
        "error"
      );

      return;
    }

    const playlist = {

      id:
        generateId(),

      name,

      type:
        "xtream",

      server:
        server.replace(/\/+$/, ""),

      username,

      password,

      channels:
        [],

      createdAt:
        new Date().toISOString()

    };

    addPlaylist(
      playlist
    );
  }


  /* =========================================================
     FAVORITES
     ========================================================= */

  function toggleFavorite(channel) {

    const key =
      getChannelKey(channel);

    if (
      favorites.includes(key)
    ) {

      favorites =
        favorites.filter(
          id => id !== key
        );

      showToast(
        "Removido dos favoritos.",
        "info"
      );

    } else {

      favorites.push(key);

      showToast(
        "Adicionado aos favoritos.",
        "success"
      );
    }

    saveJSON(
      STORAGE_KEYS.favorites,
      favorites
    );

    renderChannels();
    renderFavorites();
  }


  /* =========================================================
     PLAYER
     ========================================================= */

  function openPlayer(channel) {

    if (!channel?.url) {

      showToast(
        "Este canal não possui uma URL de transmissão.",
        "error"
      );

      return;
    }

    let modal =
      $("#playerModal");

    if (!modal) {

      modal =
        document.createElement("div");

      modal.id =
        "playerModal";

      modal.className =
        "modal-overlay";

      modal.innerHTML = `

        <div class="player-modal">

          <button
            class="modal-close"
            id="closePlayerModal"
          >
            ×
          </button>

          <div class="player-title">
            <span id="playerChannelName">
              Canal
            </span>
          </div>

          <div class="video-container">

            <video
              id="videoPlayer"
              controls
              autoplay
              playsinline
              preload="metadata"
            ></video>

          </div>

          <div
            class="player-status"
            id="playerStatus"
          >
            Conectando...
          </div>

        </div>
      `;

      document.body.appendChild(
        modal
      );

      $("#closePlayerModal")
        ?.addEventListener(
          "click",
          closePlayer
        );

    } else {

      modal.classList.remove(
        "hidden"
      );
    }

    modal.classList.remove(
      "hidden"
    );

    document.body.classList.add(
      "modal-open"
    );

    const title =
      $("#playerChannelName");

    const video =
      $("#videoPlayer");

    const status =
      $("#playerStatus");

    if (title) {
      title.textContent =
        channel.name;
    }

    if (status) {
      status.textContent =
        "Conectando...";
    }

    if (video) {

      video.pause();

      video.removeAttribute(
        "src"
      );

      video.load();

      video.src =
        channel.url;

      video.play()
        .then(() => {

          if (status) {
            status.textContent =
              "Reproduzindo";
          }

        })
        .catch(() => {

          if (status) {
            status.textContent =
              "O navegador não conseguiu iniciar esta transmissão.";
          }

        });
    }
  }


  function closePlayer() {

    const modal =
      $("#playerModal");

    const video =
      $("#videoPlayer");

    if (video) {

      video.pause();

      video.removeAttribute(
        "src"
      );

      video.load();
    }

    if (modal) {
      modal.classList.add(
        "hidden"
      );
    }

    document.body.classList.remove(
      "modal-open"
    );
  }


  /* =========================================================
     NAVIGATION
     ========================================================= */

  function switchView(view) {

    currentView = view;

    $all(".view").forEach(section => {

      section.classList.toggle(
        "active",
        section.id === `${view}View`
      );

    });

    $all(".nav-item").forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.view === view
      );

    });

    const titles = {
      home:
        "Início",

      channels:
        "Canais",

      favorites:
        "Favoritos",

      playlists:
        "Playlists"
    };

    const pageTitle =
      $("#pageTitle");

    if (pageTitle) {
      pageTitle.textContent =
        titles[view] ||
        "Sinal IPTV";
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    renderEverything();
  }


  /* =========================================================
     CATEGORIES
     ========================================================= */

  function getCategories() {

    const categories =
      channels
        .map(channel =>
          channel.category ||
          "Outros"
        )
        .filter(Boolean);

    return [
      "Todos",
      ...new Set(categories)
    ];
  }


  function renderCategories() {

    const bar =
      $("#categoryBar");

    if (!bar) return;

    const categories =
      getCategories();

    if (
      !categories.includes(
        activeCategory
      )
    ) {
      activeCategory = "Todos";
    }

    bar.innerHTML =
      categories
        .map(category => `

          <button
            class="category-button ${
              category === activeCategory
                ? "active"
                : ""
            }"
            data-category="${escapeHTML(category)}"
          >
            ${escapeHTML(category)}
          </button>

        `)
        .join("");

    $all(
      ".category-button"
    ).forEach(button => {

      button.addEventListener(
        "click",
        () => {

          activeCategory =
            button.dataset.category;

          renderChannels();
          renderCategories();

        }
      );
    });
  }


  /* =========================================================
     SEARCH
     ========================================================= */

  function getFilteredChannels() {

    const search =
      $("#searchInput")
        ?.value
        .trim()
        .toLowerCase() || "";

    return channels.filter(
      channel => {

        const matchesCategory =
          activeCategory === "Todos" ||
          (
            channel.category ||
            "Outros"
          ) === activeCategory;

        const matchesSearch =
          !search ||
          String(
            channel.name || ""
          )
            .toLowerCase()
            .includes(search);

        return (
          matchesCategory &&
          matchesSearch
        );
      }
    );
  }


  /* =========================================================
     CHANNEL CARD
     ========================================================= */

  function channelCard(channel) {

    const favorite =
      isFavorite(channel);

    const logo =
      channel.logo;

    return `

      <article
        class="channel-card"
        data-channel-id="${escapeHTML(
          getChannelKey(channel)
        )}"
      >

        <div
          class="channel-logo"
          ${
            logo
              ? `style="background-image:url('${escapeHTML(
                  logo
                )}')"`
              : ""
          }
        >

          ${
            logo
              ? ""
              : `<span>${escapeHTML(
                  getInitials(
                    channel.name
                  )
                )}</span>`
          }

          <button
            class="favorite-button ${
              favorite ? "is-favorite" : ""
            }"
            data-action="favorite"
            title="${
              favorite
                ? "Remover favorito"
                : "Adicionar favorito"
            }"
          >
            ${favorite ? "♥" : "♡"}
          </button>

        </div>

        <div class="channel-info">

          <h3>
            ${escapeHTML(
              channel.name
            )}
          </h3>

          <span>
            ${escapeHTML(
              channel.category ||
              "TV"
            )}
          </span>

        </div>

        <button
          class="watch-button"
          data-action="play"
        >
          Assistir
        </button>

      </article>

    `;
  }


  /* =========================================================
     RENDER CHANNELS
     ========================================================= */

  function renderChannels() {

    const grid =
      $("#channelGrid");

    const empty =
      $("#channelsEmpty");

    const counter =
      $("#channelCounter");

    if (!grid) return;

    const filtered =
      getFilteredChannels();

    grid.innerHTML =
      filtered
        .map(channelCard)
        .join("");

    if (counter) {

      counter.textContent =
        channels.length
          ? `${channels.length} canais disponíveis`
          : "Nenhum canal carregado.";
    }

    if (empty) {

      empty.classList.toggle(
        "hidden",
        channels.length > 0
      );
    }

    grid.classList.toggle(
      "hidden",
      filtered.length === 0
    );

    bindChannelActions(
      grid
    );
  }


  /* =========================================================
     FAVORITES RENDER
     ========================================================= */

  function renderFavorites() {

    const grid =
      $("#favoriteGrid");

    const empty =
      $("#favoritesEmpty");

    if (!grid) return;

    const favoriteChannels =
      channels.filter(
        channel =>
          isFavorite(channel)
      );

    grid.innerHTML =
      favoriteChannels
        .map(channelCard)
        .join("");

    if (empty) {

      empty.classList.toggle(
        "hidden",
        favoriteChannels.length > 0
      );
    }

    grid.classList.toggle(
      "hidden",
      favoriteChannels.length === 0
    );

    bindChannelActions(
      grid
    );
  }


  /* =========================================================
     CHANNEL ACTIONS
     ========================================================= */

  function bindChannelActions(
    container
  ) {

    if (!container) return;

    container
      .querySelectorAll(
        ".channel-card"
      )
      .forEach(card => {

        const key =
          card.dataset.channelId;

        const channel =
          channels.find(
            item =>
              getChannelKey(item) === key
          );

        if (!channel) return;

        card.addEventListener(
          "click",
          event => {

            const action =
              event.target.closest(
                "[data-action]"
              )?.dataset.action;

            if (action === "favorite") {

              event.stopPropagation();

              toggleFavorite(
                channel
              );

              return;
            }

            if (action === "play") {

              event.stopPropagation();

              openPlayer(
                channel
              );

              return;
            }

            openPlayer(
              channel
            );
          }
        );
      });
  }


  /* =========================================================
     PLAYLIST CARD
     ========================================================= */

  function playlistCard(
    playlist
  ) {

    const count =
      Array.isArray(
        playlist.channels
      )
        ? playlist.channels.length
        : 0;

    let typeLabel =
      "Playlist";

    if (
      playlist.type ===
      "m3u-url"
    ) {
      typeLabel =
        "M3U • URL";
    }

    if (
      playlist.type ===
      "file"
    ) {
      typeLabel =
        "M3U • Arquivo";
    }

    if (
      playlist.type ===
      "xtream"
    ) {
      typeLabel =
        "Xtream Codes";
    }

    const active =
      playlist.id ===
      currentPlaylistId;

    return `

      <article
        class="playlist-card ${
          active ? "selected" : ""
        }"
      >

        <div class="playlist-cover">

          <div class="playlist-logo">
            S
          </div>

          <span>
            ${escapeHTML(
              typeLabel
            )}
          </span>

        </div>

        <div class="playlist-details">

          <h3>
            ${escapeHTML(
              playlist.name
            )}
          </h3>

          <p>
            ${
              count
                ? `${count} canais`
                : "Ainda não carregada"
            }
          </p>

        </div>

        <div class="playlist-actions">

          <button
            class="secondary-button playlist-select"
            data-id="${escapeHTML(
              playlist.id
            )}"
          >
            ${
              active
                ? "Selecionada"
                : "Selecionar"
            }
          </button>

          <button
            class="danger-button playlist-delete"
            data-id="${escapeHTML(
              playlist.id
            )}"
            title="Excluir playlist"
          >
            ×
          </button>

        </div>

      </article>

    `;
  }


  /* =========================================================
     RENDER PLAYLISTS
     ========================================================= */

  function renderPlaylists() {

    const grid =
      $("#playlistGrid");

    const homeGrid =
      $("#homePlaylists");

    const empty =
      $("#playlistsEmpty");

    const homeEmpty =
      $("#homeEmpty");

    if (grid) {

      grid.innerHTML =
        playlists
          .map(playlistCard)
          .join("");

      grid.classList.toggle(
        "hidden",
        playlists.length === 0
      );
    }

    if (homeGrid) {

      homeGrid.innerHTML =
        playlists
          .slice(0, 4)
          .map(playlistCard)
          .join("");
    }

    if (empty) {

      empty.classList.toggle(
        "hidden",
        playlists.length > 0
      );
    }

    if (homeEmpty) {

      homeEmpty.classList.toggle(
        "hidden",
        playlists.length > 0
      );
    }

    bindPlaylistActions(
      grid
    );

    bindPlaylistActions(
      homeGrid
    );
  }


  function bindPlaylistActions(
    container
  ) {

    if (!container) return;

    container
      .querySelectorAll(
        ".playlist-select"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();

            selectPlaylist(
              button.dataset.id
            );
          }
        );
      });

    container
      .querySelectorAll(
        ".playlist-delete"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();

            removePlaylist(
              button.dataset.id
            );
          }
        );
      });
  }


  /* =========================================================
     SEARCH UI
     ========================================================= */

  function toggleSearch() {

    const wrapper =
      $("#searchWrapper");

    if (!wrapper) return;

    wrapper.classList.toggle(
      "hidden"
    );

    if (
      !wrapper.classList.contains(
        "hidden"
      )
    ) {

      $("#searchInput")
        ?.focus();
    }
  }


  /* =========================================================
     MOBILE MENU
     ========================================================= */

  function toggleMobileMenu() {

    const sidebar =
      $(".sidebar");

    if (!sidebar) return;

    sidebar.classList.toggle(
      "mobile-open"
    );
  }


  /* =========================================================
     EVENT LISTENERS
     ========================================================= */

  function setupEvents() {

    /* Navegação */

    $all(
      ".nav-item[data-view]"
    ).forEach(button => {

      button.addEventListener(
        "click",
        () => {

          switchView(
            button.dataset.view
          );

          $(".sidebar")
            ?.classList.remove(
              "mobile-open"
            );
        }
      );
    });


    /* Abrir modal */

    [
      "#openPlaylistBtn",
      "#heroAddPlaylist",
      "#emptyAddPlaylist",
      "#channelsAddPlaylist",
      "#channelsEmptyAdd",
      "#playlistsAdd",
      "#playlistsEmptyAdd"
    ].forEach(selector => {

      $(selector)
        ?.addEventListener(
          "click",
          openPlaylistModal
        );
    });


    $("#homeViewPlaylists")
      ?.addEventListener(
        "click",
        () => switchView(
          "playlists"
        )
      );


    $("#heroChannels")
      ?.addEventListener(
        "click",
        () => switchView(
          "channels"
        )
      );


    /* Fechar modal */

    $("#closePlaylistModal")
      ?.addEventListener(
        "click",
        closePlaylistModal
      );


    /* Tabs */

    $all(
      ".source-tab"
    ).forEach(tab => {

      tab.addEventListener(
        "click",
        () => {

          switchSource(
            tab.dataset.source
          );
        }
      );
    });


    /* URL */

    $("#saveURLPlaylist")
      ?.addEventListener(
        "click",
        handleURLPlaylist
      );


    /* Arquivo */

    $("#saveFilePlaylist")
      ?.addEventListener(
        "click",
        () => {

          const file =
            $("#playlistFile")
              ?.files?.[0];

          handleM3UFile(
            file
          );
        }
      );


    /* Xtream */

    $("#saveXtreamPlaylist")
      ?.addEventListener(
        "click",
        handleXtreamPlaylist
      );


    /* File input */

    $("#playlistFile")
      ?.addEventListener(
        "change",
        event => {

          const file =
            event.target.files?.[0];

          const fileName =
            $("#selectedFileName");

          if (fileName) {

            fileName.textContent =
              file
                ? file.name
                : "Nenhum arquivo selecionado";
          }
        }
      );


    /* Busca */

    $("#searchToggle")
      ?.addEventListener(
        "click",
        toggleSearch
      );


    $("#searchInput")
      ?.addEventListener(
        "input",
        () => {

          if (
            currentView !==
            "channels"
          ) {
            switchView(
              "channels"
            );
          } else {
            renderChannels();
          }
        }
      );


    /* Menu mobile */

    $("#mobileMenuBtn")
      ?.addEventListener(
        "click",
        toggleMobileMenu
      );


    /* Fechar modal clicando fora */

    $("#playlistModal")
      ?.addEventListener(
        "click",
        event => {

          if (
            event.target.id ===
            "playlistModal"
          ) {
            closePlaylistModal();
          }
        }
      );


    /* ESC */

    document.addEventListener(
      "keydown",
      event => {

        if (
          event.key ===
          "Escape"
        ) {

          closePlaylistModal();
          closePlayer();
        }
      }
    );
  }


  /* =========================================================
     DEMO / PRIMEIRA EXECUÇÃO
     ========================================================= */

  function ensureCurrentPlaylist() {

    if (!playlists.length) {

      currentPlaylistId =
        null;

      channels = [];

      return;
    }

    if (
      !currentPlaylistId ||
      !playlists.some(
        playlist =>
          playlist.id ===
          currentPlaylistId
      )
    ) {

      currentPlaylistId =
        playlists[0].id;
    }

    const playlist =
      playlists.find(
        item =>
          item.id ===
          currentPlaylistId
      );

    if (
      playlist &&
      Array.isArray(
        playlist.channels
      )
    ) {

      channels =
        playlist.channels;
    }
  }


  /* =========================================================
     GLOBAL RENDER
     ========================================================= */

  function renderEverything() {

    ensureCurrentPlaylist();

    renderPlaylists();

    renderCategories();

    renderChannels();

    renderFavorites();
  }


  /* =========================================================
     INIT
     ========================================================= */

  async function init() {

    setupEvents();

    ensureCurrentPlaylist();

    renderEverything();

    if (currentPlaylistId) {

      const playlist =
        playlists.find(
          item =>
            item.id ===
            currentPlaylistId
        );

      /*
       * URLs são recarregadas automaticamente.
       * Arquivos M3U permanecem armazenados
       * diretamente no navegador.
       */

      if (
        playlist &&
        (
          playlist.type ===
          "m3u-url" ||
          playlist.type ===
          "xtream"
        )
      ) {

        await loadPlaylistChannels(
          playlist
        );
      }
    }
  }


  /* =========================================================
     START
     ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init
    );

  } else {

    init();
  }

})();
