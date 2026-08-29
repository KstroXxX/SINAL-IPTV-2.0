(() => {

  "use strict";


  /* =====================================================
     HELPERS
  ===================================================== */

  const $ = (
    selector,
    root = document
  ) => root.querySelector(selector);


  const $$ = (
    selector,
    root = document
  ) => [...root.querySelectorAll(selector)];


  const STORAGE_KEY =
    "sinal_iptv_v1";


  const FAVORITES_KEY =
    "sinal_iptv_favorites";


  /* =====================================================
     ESTADO
  ===================================================== */

  const state = {

    items: [],

    filtered: [],

    category: "all",

    favoritesOnly: false,

    playlistName: "",

    visible: 80,

    current: null

  };


  /* =====================================================
     ELEMENTOS
  ===================================================== */

  const setupView =
    $("#setupView");

  const homeView =
    $("#homeView");

  const setupStatus =
    $("#setupStatus");

  const mediaGrid =
    $("#mediaGrid");

  const emptyState =
    $("#emptyState");

  const resultCount =
    $("#resultCount");

  const sectionTitle =
    $("#sectionTitle");

  const categoryNav =
    $("#categoryNav");

  const playerModal =
    $("#playerModal");

  const video =
    $("#videoPlayer");

  const videoFallback =
    $("#videoFallback");

  const toast =
    $("#toast");


  /* =====================================================
     HTML SEGURO
  ===================================================== */

  function escapeHtml(value = "") {

    return String(value)
      .replace(/[&<>"']/g, char => ({

        "&": "&amp;",

        "<": "&lt;",

        ">": "&gt;",

        '"': "&quot;",

        "'": "&#039;"

      }[char]));

  }


  /* =====================================================
     TOAST
  ===================================================== */

  function showToast(message) {

    if (!toast) return;

    toast.textContent =
      message;

    toast.classList.add(
      "show"
    );

    clearTimeout(
      showToast.timer
    );

    showToast.timer =
      setTimeout(() => {

        toast.classList.remove(
          "show"
        );

      }, 2800);
  }


  /* =====================================================
     LOCAL STORAGE
  ===================================================== */

  function getSavedConfig() {

    try {

      return JSON.parse(
        localStorage.getItem(
          STORAGE_KEY
        ) || "null"
      );

    } catch {

      return null;

    }
  }


  function saveConfig(config) {

    try {

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(config)
      );

    } catch (error) {

      console.warn(
        "Não foi possível salvar a configuração.",
        error
      );

    }
  }


  function getFavorites() {

    try {

      return JSON.parse(
        localStorage.getItem(
          FAVORITES_KEY
        ) || "[]"
      );

    } catch {

      return [];

    }
  }


  function isFavorite(id) {

    return getFavorites()
      .includes(id);

  }


  function toggleFavorite(id) {

    const favorites =
      getFavorites();

    const index =
      favorites.indexOf(id);


    if (index >= 0) {

      favorites.splice(
        index,
        1
      );

    } else {

      favorites.push(id);

    }


    localStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify(favorites)
    );


    render();
  }


  /* =====================================================
     ID ÚNICO
  ===================================================== */

  function createId(
    item,
    index
  ) {

    const value = [
      item.title,
      item.url,
      item.group,
      index
    ].join("|");


    let hash = 0;


    for (
      let i = 0;
      i < value.length;
      i++
    ) {

      hash =
        ((hash << 5) -
          hash) +
        value.charCodeAt(i);

      hash |= 0;
    }


    return `sinal-${Math.abs(hash)}`;

  }


  /* =====================================================
     NORMALIZAR URL
  ===================================================== */

  function normalizeUrl(url) {

    return String(url || "")
      .trim()
      .replace(
        /^['"]|['"]$/g,
        ""
      );

  }


  /* =====================================================
     PARSE EXTINF
  ===================================================== */

  function parseExtInf(line) {

    const attributes = {};

    const regex =
      /([A-Za-z0-9_-]+)="([^"]*)"/g;

    let match;


    while (
      (match = regex.exec(line))
      !== null
    ) {

      attributes[
        match[1].toLowerCase()
      ] = match[2];

    }


    const comma =
      line.indexOf(",");


    const title =
      comma >= 0
        ? line
            .slice(comma + 1)
            .trim()
        : "Sem título";


    return {

      title:
        title || "Sem título",

      group:
        attributes["group-title"] ||
        attributes["group"] ||
        "Outros",

      logo:
        attributes["tvg-logo"] ||
        attributes["logo"] ||
        "",

      id:
        attributes["tvg-id"] ||
        "",

      country:
        attributes["tvg-country"] ||
        "",

      language:
        attributes["tvg-language"] ||
        ""

    };

  }


  /* =====================================================
     PARSER M3U
  ===================================================== */

  function parseM3U(text) {

    const lines =
      String(text || "")
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/);


    const items = [];

    let metadata = null;


    for (
      let i = 0;
      i < lines.length;
      i++
    ) {

      const line =
        lines[i].trim();


      if (!line) {
        continue;
      }


      if (
        line.startsWith(
          "#EXTINF"
        )
      ) {

        metadata =
          parseExtInf(line);

        continue;

      }


      if (
        !line.startsWith("#") &&
        metadata
      ) {

        const url =
          normalizeUrl(line);


        if (url) {

          const item = {

            ...metadata,

            url

          };


          item.uid =
            createId(
              item,
              items.length
            );


          items.push(item);

        }


        metadata = null;

      }

    }


    return items;

  }


  /* =====================================================
     CATEGORIAS
  ===================================================== */

  function getCategories() {

    const counts =
      new Map();


    state.items.forEach(
      item => {

        const category =
          item.group ||
          "Outros";


        counts.set(
          category,
          (counts.get(category) || 0) + 1
        );

      }
    );


    return [
      ...counts.entries()
    ]
      .sort(
        (a, b) =>
          b[1] - a[1]
      );

  }


  function categoryIcon(
    category
  ) {

    const name =
      String(category)
        .toLowerCase();


    if (
      name.includes("filme") ||
      name.includes("movie")
    ) {
      return "◈";
    }


    if (
      name.includes("série") ||
      name.includes("serie") ||
      name.includes("series")
    ) {
      return "▣";
    }


    if (
      name.includes("esporte") ||
      name.includes("sport")
    ) {
      return "◉";
    }


    if (
      name.includes("infantil") ||
      name.includes("kids")
    ) {
      return "✦";
    }


    if (
      name.includes("notícia") ||
      name.includes("noticia") ||
      name.includes("news")
    ) {
      return "◌";
    }


    return "•";

  }


  /* =====================================================
     NAVEGAÇÃO
  ===================================================== */

  function renderNavigation() {

    if (!categoryNav) {
      return;
    }


    const categories =
      getCategories();


    categoryNav.innerHTML = `

      <button
        class="${
          state.category === "all" &&
          !state.favoritesOnly
            ? "active"
            : ""
        }"
        data-category="all"
      >
        ⌂ &nbsp; Início
      </button>


      <button
        class="${
          state.favoritesOnly
            ? "active"
            : ""
        }"
        data-favorites="true"
      >
        ☆ &nbsp; Favoritos
      </button>


      ${categories
        .map(
          ([category, count]) => `

          <button
            class="${
              state.category === category &&
              !state.favoritesOnly
                ? "active"
                : ""
            }"
            data-category="${escapeHtml(
              category
            )}"
          >

            ${categoryIcon(
              category
            )}

            &nbsp;

            ${escapeHtml(
              category
            )}

            <span
              style="
                float:right;
                opacity:.45;
              "
            >
              ${count.toLocaleString(
                "pt-BR"
              )}
            </span>

          </button>

        `
        )
        .join("")}

    `;


    $$(
      "button",
      categoryNav
    ).forEach(button => {

      button.addEventListener(
        "click",
        () => {

          if (
            button.dataset.favorites
          ) {

            state.favoritesOnly =
              true;

            state.category =
              "all";

          } else {

            state.favoritesOnly =
              false;

            state.category =
              button.dataset.category ||
              "all";
          }


          state.visible = 80;


          renderNavigation();

          render();


          const sidebar =
            $("#sidebar");


          if (sidebar) {

            sidebar.classList.remove(
              "open"
            );

          }

        }
      );

    });

  }


  /* =====================================================
     FILTROS
  ===================================================== */

  function applyFilters() {

    const search =
      $("#searchInput");


    const query =
      search
        ? search.value
            .trim()
            .toLowerCase()
        : "";


    state.filtered =
      state.items.filter(
        item => {

          const categoryOK =
            state.category === "all" ||
            item.group ===
              state.category;


          const favoriteOK =
            !state.favoritesOnly ||
            isFavorite(
              item.uid
            );


          const text =
            [
              item.title,
              item.group,
              item.country,
              item.language
            ]
              .join(" ")
              .toLowerCase();


          const searchOK =
            !query ||
            text.includes(query);


          return (
            categoryOK &&
            favoriteOK &&
            searchOK
          );

        }
      );

  }


  /* =====================================================
     CARD
  ===================================================== */

  function createCard(item) {

    const favorite =
      isFavorite(
        item.uid
      );


    const poster =
      item.logo

        ? `
          <img
            loading="lazy"
            src="${escapeHtml(
              item.logo
            )}"
            alt=""
            onerror="
              this.style.display='none'
            "
          >
        `

        : `
          <div
            class="poster-placeholder"
          >
            ${categoryIcon(
              item.group
            )}
          </div>
        `;


    return `

      <button
        class="media-card"
        data-id="${escapeHtml(
          item.uid
        )}"
        type="button"
      >

        <div class="poster">

          ${poster}


          <div class="play-overlay">

            <div class="play-circle">
              ▶
            </div>

          </div>


          <span
            class="favorite-badge"
            data-id="${escapeHtml(
              item.uid
            )}"
            title="Favoritar"
          >
            ${
              favorite
                ? "★"
                : "☆"
            }
          </span>

        </div>


        <div class="card-info">

          <div class="card-title">
            ${escapeHtml(
              item.title
            )}
          </div>


          <div class="card-meta">
            ${escapeHtml(
              item.group
            )}
          </div>

        </div>

      </button>

    `;

  }


  /* =====================================================
     RENDER
  ===================================================== */

  function render() {

    applyFilters();


    const visible =
      state.filtered.slice(
        0,
        state.visible
      );


    if (resultCount) {

      resultCount.textContent =
        `${state.filtered.length.toLocaleString(
          "pt-BR"
        )} itens`;

    }


    if (sectionTitle) {

      sectionTitle.textContent =
        state.favoritesOnly

          ? "Seus favoritos"

          : state.category === "all"

            ? "Destaques"

            : state.category;

    }


    if (emptyState) {

      emptyState.classList.toggle(
        "hidden",
        state.filtered.length > 0
      );

    }


    if (mediaGrid) {

      mediaGrid.innerHTML =
        visible
          .map(createCard)
          .join("");

    }


    const loadMore =
      $("#loadMore");


    if (loadMore) {

      loadMore.classList.toggle(
        "hidden",
        state.visible >=
          state.filtered.length
      );

    }


    $$(".media-card")
      .forEach(card => {

        card.addEventListener(
          "click",
          event => {

            if (
              event.target.closest(
                ".favorite-badge"
              )
            ) {
              return;
            }


            const item =
              state.items.find(
                x =>
                  x.uid ===
                  card.dataset.id
              );


            if (item) {

              openPlayer(item);

            }

          }
        );

      });


    $$(".favorite-badge")
      .forEach(button => {

        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();


            toggleFavorite(
              button.dataset.id
            );

          }
        );

      });

  }


  /* =====================================================
     PLAYER
  ===================================================== */

  function openPlayer(item) {

    state.current =
      item;


    const playerTitle =
      $("#playerTitle");


    const favoriteButton =
      $("#playerFavorite");


    if (playerTitle) {

      playerTitle.textContent =
        item.title;

    }


    if (favoriteButton) {

      favoriteButton.textContent =
        isFavorite(
          item.uid
        )
          ? "★ Remover dos favoritos"
          : "☆ Favoritar";

    }


    if (videoFallback) {

      videoFallback.classList.add(
        "hidden"
      );

    }


    if (video) {

      video.classList.remove(
        "hidden"
      );


      video.pause();


      video.src =
        item.url;


      video.load();


      video.play()
        .catch(() => {});

    }


    if (playerModal) {

      playerModal.classList.remove(
        "hidden"
      );

    }

  }


  function closePlayer() {

    if (video) {

      video.pause();

      video.removeAttribute(
        "src"
      );

      video.load();

    }


    if (playerModal) {

      playerModal.classList.add(
        "hidden"
      );

    }


    state.current =
      null;

  }


  /* =====================================================
     CARREGAR ARQUIVO
  ===================================================== */

  async function loadFromFile(
    file,
    name
  ) {

    setupStatus.textContent =
      "Lendo sua playlist…";


    const text =
      await file.text();


    const items =
      parseM3U(text);


    if (!items.length) {

      throw new Error(
        "O arquivo não possui entradas M3U válidas."
      );

    }


    saveConfig({

      type: "file",

      name:
        name ||
        file.name

    });


    showHome(
      items,
      name ||
        file.name
    );

  }


  /* =====================================================
     CARREGAR URL
  ===================================================== */

  async function loadFromUrl(
    url,
    name
  ) {

    url =
      normalizeUrl(
        url
      );


    if (!url) {

      throw new Error(
        "Digite a URL da playlist."
      );

    }


    setupStatus.textContent =
      "Conectando à playlist…";


    let response;


    try {

      response =
        await fetch(
          url
        );

    } catch {

      throw new Error(
        "Não foi possível acessar a URL. O servidor pode bloquear conexões externas (CORS)."
      );

    }


    if (!response.ok) {

      throw new Error(
        `Não foi possível acessar a playlist (${response.status}).`
      );

    }


    const text =
      await response.text();


    const items =
      parseM3U(text);


    if (!items.length) {

      throw new Error(
        "Nenhum conteúdo M3U válido foi encontrado."
      );

    }


    saveConfig({

      type: "url",

      name:
        name ||
        "Minha playlist",

      url

    });


    showHome(
      items,
      name ||
        "Minha playlist"
    );

  }


  /* =====================================================
     XTREAM
  ===================================================== */

  async function loadXtream(
    server,
    username,
    password,
    name
  ) {

    server =
      normalizeUrl(
        server
      ).replace(
        /\/+$/,
        ""
      );


    username =
      String(
        username || ""
      ).trim();


    password =
      String(
        password || ""
      );


    if (!server) {

      throw new Error(
        "Digite o servidor."
      );

    }


    if (!username) {

      throw new Error(
        "Digite o usuário."
      );

    }


    if (!password) {

      throw new Error(
        "Digite a senha."
      );

    }


    const playlistUrl =
      `${server}/get.php` +
      `?username=${encodeURIComponent(
        username
      )}` +
      `&password=${encodeURIComponent(
        password
      )}` +
      `&type=m3u_plus` +
      `&output=ts`;


    await loadFromUrl(
      playlistUrl,
      name ||
        "Minha TV"
    );


    saveConfig({

      type: "xtream",

      name:
        name ||
        "Minha TV",

      server,

      username,

      password

    });

  }


  /* =====================================================
     MOSTRAR HOME
  ===================================================== */

  function showHome(
    items,
    playlistName
  ) {

    if (!items.length) {

      throw new Error(
        "Nenhum conteúdo foi encontrado."
      );

    }


    state.items =
      items;


    state.playlistName =
      playlistName ||
      "Minha playlist";


    state.category =
      "all";


    state.favoritesOnly =
      false;


    state.visible =
      80;


    setupView.classList.add(
      "hidden"
    );


    homeView.classList.remove(
      "hidden"
    );


    const heroTitle =
      $("#heroTitle");


    const heroText =
      $("#heroText");


    if (heroTitle) {

      heroTitle.textContent =
        state.playlistName;

    }


    if (heroText) {

      heroText.textContent =
        `${items.length.toLocaleString(
          "pt-BR"
        )} conteúdos disponíveis para você.`;

    }


    renderNavigation();

    render();

  }


  /* =====================================================
     ERRO
  ===================================================== */

  function handleError(
    error
  ) {

    console.error(
      error
    );


    const message =
      error?.message ||
      "Não foi possível carregar a playlist.";


    if (setupStatus) {

      setupStatus.textContent =
        message;

    }


    showToast(
      message
    );

  }


  /* =====================================================
     ABAS
  ===================================================== */

  $$(".source-tab")
    .forEach(tab => {

      tab.addEventListener(
        "click",
        () => {

          $$(".source-tab")
            .forEach(item =>
              item.classList.remove(
                "active"
              )
            );


          $$(".source-panel")
            .forEach(panel =>
              panel.classList.remove(
                "active"
              )
            );


          tab.classList.add(
            "active"
          );


          const panel =
            $(
              `#${tab.dataset.source}Form`
            );


          if (panel) {

            panel.classList.add(
              "active"
            );

          }


          if (setupStatus) {

            setupStatus.textContent =
              "";

          }

        }
      );

    });


  /* =====================================================
     ARQUIVO
  ===================================================== */

  const m3uFile =
    $("#m3uFile");


  if (m3uFile) {

    m3uFile.addEventListener(
      "change",
      event => {

        const file =
          event.target.files?.[0];


        const label =
          $("#fileLabel");


        if (label) {

          label.textContent =
            file
              ? file.name
              : "M3U ou M3U8";

        }

      }
    );

  }


  /* =====================================================
     URL FORM
  ===================================================== */

  const urlForm =
    $("#urlForm");


  if (urlForm) {

    urlForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        try {

          await loadFromUrl(

            $("#m3uUrl")?.value,

            $("#urlName")?.value

          );

        } catch (error) {

          handleError(
            error
          );

        }

      }
    );

  }


  /* =====================================================
     FILE FORM
  ===================================================== */

  const fileForm =
    $("#fileForm");


  if (fileForm) {

    fileForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        const file =
          $("#m3uFile")
            ?.files?.[0];


        if (!file) {

          handleError(
            new Error(
              "Selecione um arquivo M3U."
            )
          );

          return;

        }


        try {

          await loadFromFile(

            file,

            $("#fileName")?.value

          );

        } catch (error) {

          handleError(
            error
          );

        }

      }
    );

  }


  /* =====================================================
     XTREAM FORM
  ===================================================== */

  const xtreamForm =
    $("#xtreamForm");


  if (xtreamForm) {

    xtreamForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        try {

          await loadXtream(

            $("#xtServer")?.value,

            $("#xtUser")?.value,

            $("#xtPass")?.value,

            $("#xtName")?.value

          );

        } catch (error) {

          handleError(
            error
          );

        }

      }
    );

  }


  /* =====================================================
     BUSCA
  ===================================================== */

  const searchInput =
    $("#searchInput");


  if (searchInput) {

    searchInput.addEventListener(
      "input",
      () => {

        state.visible =
          80;

        render();

      }
    );

  }


  /* =====================================================
     LOAD MORE
  ===================================================== */

  const loadMore =
    $("#loadMore");


  if (loadMore) {

    loadMore.addEventListener(
      "click",
      () => {

        state.visible +=
          80;

        render();

      }
    );

  }


  /* =====================================================
     FAVORITOS
  ===================================================== */

  const favoritesButton =
    $("#favoritesBtn");


  if (favoritesButton) {

    favoritesButton.addEventListener(
      "click",
      () => {

        state.favoritesOnly =
          !state.favoritesOnly;


        state.category =
          "all";


        renderNavigation();

        render();

      }
    );

  }


  /* =====================================================
     MENU MOBILE
  ===================================================== */

  const mobileMenu =
    $("#mobileMenu");


  if (mobileMenu) {

    mobileMenu.addEventListener(
      "click",
      () => {

        const sidebar =
          $("#sidebar");


        if (sidebar) {

          sidebar.classList.toggle(
            "open"
          );

        }

      }
    );

  }


  /* =====================================================
     PLAYER
  ===================================================== */

  const closePlayerButton =
    $("#closePlayer");


  if (closePlayerButton) {

    closePlayerButton.addEventListener(
      "click",
      closePlayer
    );

  }


  if (playerModal) {

    playerModal.addEventListener(
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

  }


  /* =====================================================
     PLAYER FAVORITE
  ===================================================== */

  const playerFavorite =
    $("#playerFavorite");


  if (playerFavorite) {

    playerFavorite.addEventListener(
      "click",
      () => {

        if (!state.current) {
          return;
        }


        toggleFavorite(
          state.current.uid
        );


        playerFavorite.textContent =
          isFavorite(
            state.current.uid
          )
            ? "★ Remover dos favoritos"
            : "☆ Favoritar";

      }
    );

  }


  /* =====================================================
     TROCAR PLAYLIST
  ===================================================== */

  const changePlaylist =
    $("#changePlaylist");


  if (changePlaylist) {

    changePlaylist.addEventListener(
      "click",
      () => {

        homeView.classList.add(
          "hidden"
        );


        setupView.classList.remove(
          "hidden"
        );


        if (setupStatus) {

          setupStatus.textContent =
            "";

        }

      }
    );

  }


  /* =====================================================
     HERO
  ===================================================== */

  const heroPlay =
    $("#heroPlay");


  if (heroPlay) {

    heroPlay.addEventListener(
      "click",
      () => {

        const first =
          state.filtered[0] ||
          state.items[0];


        if (first) {

          openPlayer(
            first
          );

        }

      }
    );

  }


  /* =====================================================
     ERRO DE VÍDEO
  ===================================================== */

  if (video) {

    video.addEventListener(
      "error",
      () => {

        video.classList.add(
          "hidden"
        );


        if (videoFallback) {

          videoFallback.classList.remove(
            "hidden"
          );

        }

      }
    );

  }


  /* =====================================================
     ESC FECHA PLAYER
  ===================================================== */

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


  /* =====================================================
     RECUPERAR CONFIGURAÇÃO
  ===================================================== */

  const saved =
    getSavedConfig();


  if (saved) {

    if (
      saved.type ===
      "url"
    ) {

      const name =
        $("#urlName");

      const url =
        $("#m3uUrl");


      if (name) {

        name.value =
          saved.name || "";

      }


      if (url) {

        url.value =
          saved.url || "";

      }

    }


    if (
      saved.type ===
      "xtream"
    ) {

      const name =
        $("#xtName");

      const server =
        $("#xtServer");

      const user =
        $("#xtUser");

      const pass =
        $("#xtPass");


      if (name) {

        name.value =
          saved.name || "";

      }


      if (server) {

        server.value =
          saved.server || "";

      }


      if (user) {

        user.value =
          saved.username || "";

      }


      if (pass) {

        pass.value =
          saved.password || "";

      }

    }

  }

})();
