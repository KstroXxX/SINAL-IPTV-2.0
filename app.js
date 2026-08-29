"use strict";

/* =========================================================
   SINAL IPTV
   FLUXO:
   CONEXÃO -> VALIDAR -> CARREGAR -> PAINEL
   ========================================================= */

(() => {

  const STORAGE = {
    PLAYLISTS: "sinal_iptv_playlists_v3",
    ACTIVE: "sinal_iptv_active_playlist_v3",
    FAVORITES: "sinal_iptv_favorites_v3"
  };

  let playlists = read(STORAGE.PLAYLISTS, []);
  let activePlaylistId = read(STORAGE.ACTIVE, null);
  let favorites = read(STORAGE.FAVORITES, []);

  let channels = [];
  let currentCategory = "Todos";
  let currentView = "home";


  /* =====================================================
     UTILITÁRIOS
     ===================================================== */

  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return [...document.querySelectorAll(selector)];
  }

  function read(key, fallback) {

    try {

      const value =
        localStorage.getItem(key);

      return value
        ? JSON.parse(value)
        : fallback;

    } catch {

      return fallback;

    }
  }

  function write(key, value) {

    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  }

  function id() {

    return (
      Date.now().toString(36) +
      Math.random()
        .toString(36)
        .slice(2)
    );
  }

  function escapeHTML(value) {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toast(message, type = "info") {

    const container =
      $("#toastContainer");

    const element =
      document.createElement("div");

    element.className =
      `toast toast-${type}`;

    element.textContent =
      message;

    container.appendChild(
      element
    );

    setTimeout(() => {

      element.classList.add(
        "toast-hide"
      );

      setTimeout(
        () => element.remove(),
        300
      );

    }, 3500);
  }


  /* =====================================================
     TELA DE CONEXÃO
     ===================================================== */

  function showConnectionScreen() {

    $("#connectionScreen")
      ?.classList.remove("hidden");

    $("#appShell")
      ?.classList.add("hidden");
  }

  function showApp() {

    $("#connectionScreen")
      ?.classList.add("hidden");

    $("#appShell")
      ?.classList.remove("hidden");
  }


  /* =====================================================
     ABAS
     ===================================================== */

  function setupTabs() {

    $$(".source-tab")
      .forEach(tab => {

        tab.addEventListener(
          "click",
          () => {

            const source =
              tab.dataset.source;

            $$(".source-tab")
              .forEach(item =>
                item.classList.toggle(
                  "active",
                  item === tab
                )
              );

            $$(".source-panel")
              .forEach(panel => {

                panel.classList.toggle(
                  "active",
                  panel.dataset.sourcePanel === source
                );

              });

          }
        );

      });
  }


  /* =====================================================
     M3U
     ===================================================== */

  function parseM3U(text) {

    const lines =
      text
        .replace(/\r/g, "")
        .split("\n")
        .map(line => line.trim());

    const result = [];

    for (
      let i = 0;
      i < lines.length;
      i++
    ) {

      const line =
        lines[i];

      if (
        !line ||
        !line.startsWith("#EXTINF")
      ) {
        continue;
      }

      const metadata =
        parseEXTINF(line);

      let streamUrl = "";

      for (
        let j = i + 1;
        j < lines.length;
        j++
      ) {

        const candidate =
          lines[j];

        if (
          !candidate ||
          candidate.startsWith("#")
        ) {
          continue;
        }

        streamUrl =
          candidate;

        i = j;

        break;
      }

      if (!streamUrl) {
        continue;
      }

      result.push({

        id:
          id(),

        name:
          metadata.name ||
          "Canal",

        url:
          streamUrl,

        logo:
          metadata.logo,

        category:
          metadata.group ||
          "Outros",

        tvgId:
          metadata.tvgId,

        tvgName:
          metadata.tvgName

      });

    }

    return result;
  }


  function parseEXTINF(line) {

    const comma =
      line.indexOf(",");

    let attributes =
      comma >= 0
        ? line.slice(0, comma)
        : line;

    let name =
      comma >= 0
        ? line.slice(comma + 1).trim()
        : "Canal";

    function attr(key) {

      const regex =
        new RegExp(
          `${key}\\s*=\\s*["']([^"']*)["']`,
          "i"
        );

      const match =
        attributes.match(regex);

      return match
        ? match[1]
        : "";
    }

    return {

      name,

      tvgId:
        attr("tvg-id"),

      tvgName:
        attr("tvg-name"),

      logo:
        attr("tvg-logo"),

      group:
        attr("group-title")

    };
  }


  /* =====================================================
     URL M3U
     ===================================================== */

  async function loadURLPlaylist() {

    const name =
      $("#playlistName")
        ?.value.trim();

    const url =
      $("#playlistUrl")
        ?.value.trim();

    if (!name) {

      toast(
        "Digite o nome da playlist.",
        "error"
      );

      return;
    }

    if (!url) {

      toast(
        "Digite a URL da playlist.",
        "error"
      );

      return;
    }

    try {
      new URL(url);
    } catch {

      toast(
        "A URL informada não é válida.",
        "error"
      );

      return;
    }

    setLoading(
      "#loadURLPlaylist",
      true,
      "Carregando..."
    );

    try {

      const response =
        await fetch(
          url,
          {
            method: "GET",
            cache: "no-store"
          }
        );

      if (!response.ok) {

        throw new Error(
          `Servidor respondeu ${response.status}`
        );
      }

      const text =
        await response.text();

      if (
        !text.includes("#EXTINF") &&
        !text.includes("#EXTM3U")
      ) {

        throw new Error(
          "A URL não parece ser uma playlist M3U."
        );
      }

      const parsed =
        parseM3U(text);

      if (!parsed.length) {

        throw new Error(
          "A playlist não contém canais reconhecíveis."
        );
      }

      const playlist = {

        id:
          id(),

        name,

        type:
          "m3u-url",

        url,

        channels:
          parsed,

        createdAt:
          Date.now()

      };

      savePlaylist(
        playlist
      );

      toast(
        `${parsed.length} canais carregados.`,
        "success"
      );

      enterPlaylist(
        playlist
      );

    } catch (error) {

      console.error(error);

      toast(
        "Não foi possível carregar a playlist. Verifique a URL e se o servidor permite acesso pelo navegador (CORS).",
        "error"
      );

    } finally {

      setLoading(
        "#loadURLPlaylist",
        false,
        "Carregar playlist"
      );

    }
  }


  /* =====================================================
     ARQUIVO
     ===================================================== */

  async function loadFilePlaylist() {

    const file =
      $("#playlistFile")
        ?.files?.[0];

    if (!file) {

      toast(
        "Selecione um arquivo M3U.",
        "error"
      );

      return;
    }

    const name =
      $("#filePlaylistName")
        ?.value.trim() ||
      file.name.replace(
        /\.(m3u8?|txt)$/i,
        ""
      );

    setLoading(
      "#loadFilePlaylist",
      true,
      "Lendo arquivo..."
    );

    try {

      const text =
        await file.text();

      const parsed =
        parseM3U(text);

      if (!parsed.length) {

        throw new Error(
          "Nenhum canal encontrado."
        );
      }

      const playlist = {

        id:
          id(),

        name,

        type:
          "file",

        fileName:
          file.name,

        channels:
          parsed,

        createdAt:
          Date.now()

      };

      savePlaylist(
        playlist
      );

      toast(
        `${parsed.length} canais carregados.`,
        "success"
      );

      enterPlaylist(
        playlist
      );

    } catch (error) {

      console.error(error);

      toast(
        "Não foi possível ler esse arquivo M3U.",
        "error"
      );

    } finally {

      setLoading(
        "#loadFilePlaylist",
        false,
        "Carregar playlist"
      );

    }
  }


  /* =====================================================
     XTREAM
     ===================================================== */

  async function loadXtreamPlaylist() {

    const name =
      $("#xtreamName")
        ?.value.trim();

    const server =
      $("#xtreamServer")
        ?.value.trim()
        .replace(/\/+$/, "");

    const username =
      $("#xtreamUsername")
        ?.value.trim();

    const password =
      $("#xtreamPassword")
        ?.value.trim();

    if (
      !name ||
      !server ||
      !username ||
      !password
    ) {

      toast(
        "Preencha todos os campos do Xtream Codes.",
        "error"
      );

      return;
    }

    setLoading(
      "#loadXtreamPlaylist",
      true,
      "Conectando..."
    );

    try {

      const apiUrl =
        `${server}/player_api.php` +
        `?username=${encodeURIComponent(username)}` +
        `&password=${encodeURIComponent(password)}` +
        `&action=get_live_streams`;

      const response =
        await fetch(
          apiUrl,
          {
            cache: "no-store"
          }
        );

      if (!response.ok) {

        throw new Error(
          `Servidor respondeu ${response.status}`
        );
      }

      const data =
        await response.json();

      if (!Array.isArray(data)) {

        throw new Error(
          "Resposta inválida do servidor Xtream."
        );
      }

      const parsed =
        data.map(item => {

          const streamId =
            item.stream_id;

          const extension =
            item.container_extension ||
            "ts";

          const streamUrl =
            `${server}/live/` +
            `${encodeURIComponent(username)}/` +
            `${encodeURIComponent(password)}/` +
            `${streamId}.${extension}`;

          return {

            id:
              String(
                streamId ||
                id()
              ),

            name:
              item.name ||
              "Canal",

            url:
              streamUrl,

            logo:
              item.stream_icon ||
              "",

            category:
              item.category_name ||
              "TV",

            tvgId:
              item.epg_channel_id ||
              ""

          };

        });

      if (!parsed.length) {

        throw new Error(
          "Nenhum canal foi retornado pelo servidor."
        );
      }

      const playlist = {

        id:
          id(),

        name,

        type:
          "xtream",

        server,

        username,

        password,

        channels:
          parsed,

        createdAt:
          Date.now()

      };

      savePlaylist(
        playlist
      );

      toast(
        `${parsed.length} canais carregados.`,
        "success"
      );

      enterPlaylist(
        playlist
      );

    } catch (error) {

      console.error(error);

      toast(
        "Não foi possível conectar ao Xtream. Confira servidor, usuário, senha e CORS.",
        "error"
      );

    } finally {

      setLoading(
        "#loadXtreamPlaylist",
        false,
        "Conectar e carregar"
      );

    }
  }


  /* =====================================================
     PLAYLIST STORAGE
     ===================================================== */

  function savePlaylist(
    playlist
  ) {

    const existing =
      playlists.findIndex(
        item =>
          item.id ===
          playlist.id
      );

    if (existing >= 0) {

      playlists[existing] =
        playlist;

    } else {

      playlists.push(
        playlist
      );

    }

    write(
      STORAGE.PLAYLISTS,
      playlists
    );

    activePlaylistId =
      playlist.id;

    write(
      STORAGE.ACTIVE,
      activePlaylistId
    );
  }


  function enterPlaylist(
    playlist
  ) {

    activePlaylistId =
      playlist.id;

    write(
      STORAGE.ACTIVE,
      activePlaylistId
    );

    channels =
      Array.isArray(
        playlist.channels
      )
        ? playlist.channels
        : [];

    $("#currentPlaylistName")
      .textContent =
      playlist.name;

    showApp();

    renderAll();

    navigate(
      "home"
    );
  }


  /* =====================================================
     RECUPERAR PLAYLIST
     ===================================================== */

  function restoreSession() {

    if (!activePlaylistId) {

      showConnectionScreen();

      return;
    }

    const playlist =
      playlists.find(
        item =>
          item.id ===
          activePlaylistId
      );

    if (!playlist) {

      showConnectionScreen();

      return;
    }

    if (
      !Array.isArray(
        playlist.channels
      ) ||
      !playlist.channels.length
    ) {

      showConnectionScreen();

      return;
    }

    channels =
      playlist.channels;

    $("#currentPlaylistName")
      .textContent =
      playlist.name;

    showApp();

    renderAll();

    navigate(
      "home"
    );
  }


  /* =====================================================
     LOADING
     ===================================================== */

  function setLoading(
    selector,
    loading,
    label
  ) {

    const button =
      $(selector);

    if (!button) return;

    button.disabled =
      loading;

    button.innerHTML =
      loading
        ? `<span>${label}</span><span>...</span>`
        : `<span>${label}</span><span>→</span>`;
  }


  /* =====================================================
     NAVEGAÇÃO
     ===================================================== */

  function navigate(
    view
  ) {

    currentView =
      view;

    $$(".view")
      .forEach(section => {

        section.classList.toggle(
          "active",
          section.id ===
          `${view}View`
        );

      });

    $$(".nav-item[data-view]")
      .forEach(button => {

        button.classList.toggle(
          "active",
          button.dataset.view === view
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

    $("#pageTitle")
      .textContent =
      titles[view] ||
      "Sinal IPTV";

    if (view === "channels") {
      renderChannels();
    }

    if (view === "favorites") {
      renderFavorites();
    }

    if (view === "playlists") {
      renderPlaylists();
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }


  /* =====================================================
     CATEGORIAS
     ===================================================== */

  function categories() {

    const list =
      channels
        .map(
          channel =>
            channel.category ||
            "Outros"
        )
        .filter(Boolean);

    return [
      "Todos",
      ...new Set(list)
    ];
  }


  function renderCategories() {

    const container =
      $("#categoryBar");

    if (!container) return;

    const list =
      categories();

    if (
      !list.includes(
        currentCategory
      )
    ) {

      currentCategory =
        "Todos";

    }

    container.innerHTML =
      list.map(
        category => `

          <button
            class="category-button ${
              category === currentCategory
                ? "active"
                : ""
            }"
            data-category="${escapeHTML(category)}"
          >
            ${escapeHTML(category)}
          </button>

        `
      ).join("");

    $$(".category-button")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            currentCategory =
              button.dataset.category;

            renderCategories();
            renderChannels();

          }
        );

      });
  }


  /* =====================================================
     BUSCA
     ===================================================== */

  function filteredChannels() {

    const search =
      $("#searchInput")
        ?.value
        .trim()
        .toLowerCase() ||
      "";

    return channels.filter(
      channel => {

        const category =
          channel.category ||
          "Outros";

        const categoryOK =
          currentCategory === "Todos" ||
          category === currentCategory;

        const searchOK =
          !search ||
          String(
            channel.name
          )
            .toLowerCase()
            .includes(search);

        return (
          categoryOK &&
          searchOK
        );

      }
    );
  }


  /* =====================================================
     FAVORITOS
     ===================================================== */

  function channelKey(
    channel
  ) {

    return (
      channel.id ||
      `${channel.name}|${channel.url}`
    );

  }

  function favorite(
    channel
  ) {

    const key =
      channelKey(channel);

    if (
      favorites.includes(key)
    ) {

      favorites =
        favorites.filter(
          item =>
            item !== key
        );

    } else {

      favorites.push(key);

    }

    write(
      STORAGE.FAVORITES,
      favorites
    );

    renderChannels();
    renderFavorites();
  }

  function isFavorite(
    channel
  ) {

    return favorites.includes(
      channelKey(channel)
    );

  }


  /* =====================================================
     CARD DE CANAL
     ===================================================== */

  function channelCard(
    channel
  ) {

    const fav =
      isFavorite(channel);

    const logo =
      channel.logo;

    return `

      <article
        class="channel-card"
        data-channel="${escapeHTML(
          channelKey(channel)
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
              : `<span>
                  ${escapeHTML(
                    String(
                      channel.name ||
                      "TV"
                    )
                      .slice(0,2)
                      .toUpperCase()
                  )}
                </span>`
          }

          <button
            class="favorite-button ${
              fav
                ? "is-favorite"
                : ""
            }"
            data-action="favorite"
          >
            ${
              fav
                ? "♥"
                : "♡"
            }
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


  /* =====================================================
     RENDER CANAIS
     ===================================================== */

  function renderChannels() {

    const grid =
      $("#channelGrid");

    const empty =
      $("#channelsEmpty");

    if (!grid) return;

    const list =
      filteredChannels();

    grid.innerHTML =
      list
        .map(channelCard)
        .join("");

    grid.classList.toggle(
      "hidden",
      list.length === 0
    );

    empty.classList.toggle(
      "hidden",
      list.length > 0
    );

    $("#channelCounter")
      .textContent =
      `${channels.length} ${
        channels.length === 1
          ? "canal"
          : "canais"
      } disponíveis`;

    bindChannelEvents();
  }


  /* =====================================================
     FAVORITOS
     ===================================================== */

  function renderFavorites() {

    const grid =
      $("#favoriteGrid");

    const empty =
      $("#favoritesEmpty");

    if (!grid) return;

    const list =
      channels.filter(
        isFavorite
      );

    grid.innerHTML =
      list
        .map(channelCard)
        .join("");

    grid.classList.toggle(
      "hidden",
      list.length === 0
    );

    empty.classList.toggle(
      "hidden",
      list.length > 0
    );

    bindChannelEvents();
  }


  /* =====================================================
     EVENTOS DOS CANAIS
     ===================================================== */

  function bindChannelEvents() {

    $$(".channel-card")
      .forEach(card => {

        card.addEventListener(
          "click",
          event => {

            const action =
              event.target
                .closest(
                  "[data-action]"
                )
                ?.dataset.action;

            const key =
              card.dataset.channel;

            const channel =
              channels.find(
                item =>
                  channelKey(item) === key
              );

            if (!channel) return;

            if (
              action ===
              "favorite"
            ) {

              event.stopPropagation();

              favorite(
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


  /* =====================================================
     PLAYLISTS
     ===================================================== */

  function playlistCard(
    playlist
  ) {

    const active =
      playlist.id ===
      activePlaylistId;

    const count =
      Array.isArray(
        playlist.channels
      )
        ? playlist.channels.length
        : 0;

    return `

      <article
        class="playlist-card ${
          active
            ? "selected"
            : ""
        }"
      >

        <div class="playlist-cover">

          <div class="playlist-logo">
            S
          </div>

          <span>
            ${
              playlist.type === "xtream"
                ? "XTREAM"
                : playlist.type === "file"
                  ? "M3U • ARQUIVO"
                  : "M3U • URL"
            }
          </span>

        </div>

        <div class="playlist-details">

          <h3>
            ${escapeHTML(
              playlist.name
            )}
          </h3>

          <p>
            ${count} ${
              count === 1
                ? "canal"
                : "canais"
            }
          </p>

        </div>

        <div class="playlist-actions">

          <button
            class="secondary-button"
            data-playlist-select="${escapeHTML(
              playlist.id
            )}"
          >
            ${
              active
                ? "Ativa"
                : "Selecionar"
            }
          </button>

          <button
            class="danger-button"
            data-playlist-delete="${escapeHTML(
              playlist.id
            )}"
          >
            ×
          </button>

        </div>

      </article>

    `;
  }


  function renderPlaylists() {

    const grid =
      $("#playlistGrid");

    if (!grid) return;

    grid.innerHTML =
      playlists
        .map(
          playlistCard
        )
        .join("");

    grid
      .querySelectorAll(
        "[data-playlist-select]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            const playlist =
              playlists.find(
                item =>
                  item.id ===
                  button.dataset.playlistSelect
              );

            if (!playlist) return;

            activePlaylistId =
              playlist.id;

            channels =
              playlist.channels ||
              [];

            write(
              STORAGE.ACTIVE,
              activePlaylistId
            );

            $("#currentPlaylistName")
              .textContent =
              playlist.name;

            renderAll();

            navigate(
              "home"
            );

          }
        );

      });

    grid
      .querySelectorAll(
        "[data-playlist-delete]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            deletePlaylist(
              button.dataset.playlistDelete
            );

          }
        );

      });
  }


  function deletePlaylist(
    playlistId
  ) {

    const playlist =
      playlists.find(
        item =>
          item.id ===
          playlistId
      );

    if (!playlist) return;

    const confirmed =
      confirm(
        `Deseja remover "${playlist.name}"?`
      );

    if (!confirmed) return;

    playlists =
      playlists.filter(
        item =>
          item.id !==
          playlistId
      );

    write(
      STORAGE.PLAYLISTS,
      playlists
    );

    if (
      activePlaylistId ===
      playlistId
    ) {

      activePlaylistId =
        null;

      channels = [];

      write(
        STORAGE.ACTIVE,
        null
      );

      showConnectionScreen();

    }

    renderAll();

    toast(
      "Playlist removida.",
      "success"
    );
  }


  /* =====================================================
     HOME
     ===================================================== */

  function renderHome() {

    const stats =
      $("#homeStats");

    if (!stats) return;

    const categoriesCount =
      new Set(
        channels.map(
          channel =>
            channel.category ||
            "Outros"
        )
      ).size;

    stats.innerHTML = `

      <div class="stat-card">
        <span>CANAIS</span>
        <strong>
          ${channels.length}
        </strong>
      </div>

      <div class="stat-card">
        <span>CATEGORIAS</span>
        <strong>
          ${categoriesCount}
        </strong>
      </div>

      <div class="stat-card">
        <span>FAVORITOS</span>
        <strong>
          ${
            channels.filter(
              isFavorite
            ).length
          }
        </strong>
      </div>

    `;
  }


  /* =====================================================
     RENDER GERAL
     ===================================================== */

  function renderAll() {

    renderHome();

    renderCategories();

    renderChannels();

    renderFavorites();

    renderPlaylists();

  }


  /* =====================================================
     PLAYER
     ===================================================== */

  function openPlayer(
    channel
  ) {

    const modal =
      $("#playerModal");

    const video =
      $("#videoPlayer");

    const title =
      $("#playerTitle");

    const status =
      $("#playerStatus");

    if (!channel?.url) {

      toast(
        "Esse canal não possui uma URL de transmissão.",
        "error"
      );

      return;
    }

    modal.classList.remove(
      "hidden"
    );

    title.textContent =
      channel.name;

    status.textContent =
      "Conectando...";

    video.src =
      channel.url;

    video.load();

    video.play()
      .then(() => {

        status.textContent =
          "Reproduzindo";

      })
      .catch(() => {

        status.textContent =
          "A transmissão foi carregada. Pressione play se necessário.";

      });

  }


  function closePlayer() {

    const modal =
      $("#playerModal");

    const video =
      $("#videoPlayer");

    video.pause();

    video.removeAttribute(
      "src"
    );

    video.load();

    modal.classList.add(
      "hidden"
    );
  }


  /* =====================================================
     PESQUISA
     ===================================================== */

  function setupSearch() {

    $("#searchToggle")
      ?.addEventListener(
        "click",
        () => {

          const wrapper =
            $("#searchWrapper");

          wrapper.classList.toggle(
            "hidden"
          );

          if (
            !wrapper.classList.contains(
              "hidden"
            )
          ) {

            $("#searchInput")
              .focus();

          }

        }
      );

    $("#searchInput")
      ?.addEventListener(
        "input",
        () => {

          if (
            currentView !==
            "channels"
          ) {

            navigate(
              "channels"
            );

          } else {

            renderChannels();

          }

        }
      );
  }


  /* =====================================================
     EVENTOS PRINCIPAIS
     ===================================================== */

  function setupEvents() {

    setupTabs();

    setupSearch();


    /* Carregar URL */

    $("#loadURLPlaylist")
      ?.addEventListener(
        "click",
        loadURLPlaylist
      );


    /* Carregar arquivo */

    $("#loadFilePlaylist")
      ?.addEventListener(
        "click",
        loadFilePlaylist
      );


    /* Xtream */

    $("#loadXtreamPlaylist")
      ?.addEventListener(
        "click",
        loadXtreamPlaylist
      );


    /* Arquivo escolhido */

    $("#playlistFile")
      ?.addEventListener(
        "change",
        event => {

          const file =
            event.target.files?.[0];

          $("#selectedFileName")
            .textContent =
            file
              ? file.name
              : "M3U ou M3U8";

        }
      );


    /* Navegação */

    $$(".nav-item[data-view]")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            navigate(
              button.dataset.view
            );

          }
        );

      });


    /* Trocar playlist */

    $("#changePlaylist")
      ?.addEventListener(
        "click",
        () => {

          showConnectionScreen();

        }
      );


    /* Adicionar outra */

    $("#addAnotherPlaylist")
      ?.addEventListener(
        "click",
        () => {

          showConnectionScreen();

        }
      );


    /* Home */

    $("#goChannels")
      ?.addEventListener(
        "click",
        () => {

          navigate(
            "channels"
          );

        }
      );


    $("#goPlaylists")
      ?.addEventListener(
        "click",
        () => {

          navigate(
            "playlists"
          );

        }
      );


    /* Player */

    $("#closePlayer")
      ?.addEventListener(
        "click",
        closePlayer
      );


    $("#playerModal")
      ?.addEventListener(
        "click",
        event => {

          if (
            event.target.id ===
            "playerModal"
          ) {

            closePlayer();

          }

        }
      );


    /* Mobile */

    $("#mobileMenuBtn")
      ?.addEventListener(
        "click",
        () => {

          $(".sidebar")
            ?.classList.toggle(
              "mobile-open"
            );

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

          closePlayer();

        }

      }
    );

  }


  /* =====================================================
     INICIALIZAÇÃO
     ===================================================== */

  function init() {

    setupEvents();

    restoreSession();

  }


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
