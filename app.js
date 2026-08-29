(() => {

  "use strict";


  /* =====================================================
     SINAL IPTV
     Playlist M3U -> Parser -> Biblioteca -> Player
  ===================================================== */


  const $ = (selector, root = document) =>
    root.querySelector(selector);


  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];


  const STORAGE = {
    favorites: "sinal_favorites_v2",
    history: "sinal_history_v2",
    settings: "sinal_settings_v2"
  };


  const state = {

    items: [],

    categories: [],

    category: "all",

    search: "",

    favoritesOnly: false,

    current: null,

    hero: null,

    hls: null,

    visiblePerRow: 40,

    playlistName: "Minha playlist"

  };


  /* =====================================================
     ELEMENTOS
  ===================================================== */

  const splash =
    $("#splash");

  const setupScreen =
    $("#setupScreen");

  const loadingScreen =
    $("#loadingScreen");

  const homeScreen =
    $("#homeScreen");

  const loadingText =
    $("#loadingText");

  const loadingProgress =
    $("#loadingProgress");

  const setupMessage =
    $("#setupMessage");

  const library =
    $("#library");

  const navigation =
    $("#navigation");

  const search =
    $("#search");

  const toast =
    $("#toast");

  const playerModal =
    $("#playerModal");

  const video =
    $("#video");

  const playerLoading =
    $("#playerLoading");

  const playerError =
    $("#playerError");

  const playerErrorText =
    $("#playerErrorText");


  /* =====================================================
     UTILITÁRIOS
  ===================================================== */

  function sleep(ms) {

    return new Promise(
      resolve => setTimeout(
        resolve,
        ms
      )
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


  function normalizeURL(value) {

    return String(value ?? "")
      .trim()
      .replace(/^['"]|['"]$/g, "");

  }


  function slug(value) {

    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  }


  function hash(value) {

    let h = 2166136261;


    const text =
      String(value ?? "");


    for (
      let i = 0;
      i < text.length;
      i++
    ) {

      h ^= text.charCodeAt(i);

      h =
        Math.imul(
          h,
          16777619
        );

    }


    return (
      h >>> 0
    ).toString(36);

  }


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

      }, 3000);

  }


  function setSetupMessage(
    message
  ) {

    if (!setupMessage) {
      return;
    }


    setupMessage.textContent =
      message;

  }


  /* =====================================================
     STORAGE
  ===================================================== */

  function readJSON(
    key,
    fallback
  ) {

    try {

      const value =
        localStorage.getItem(
          key
        );


      return value
        ? JSON.parse(value)
        : fallback;

    } catch {

      return fallback;

    }

  }


  function writeJSON(
    key,
    value
  ) {

    try {

      localStorage.setItem(
        key,
        JSON.stringify(value)
      );

    } catch {

      // O site continua funcionando
      // mesmo se o storage estiver indisponível.

    }

  }


  function getFavorites() {

    return readJSON(
      STORAGE.favorites,
      []
    );

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


    writeJSON(
      STORAGE.favorites,
      favorites
    );


    renderLibrary();

    renderNavigation();


    if (
      state.current &&
      state.current.uid === id
    ) {

      updatePlayerFavorite();

    }

  }


  function addHistory(item) {

    const history =
      readJSON(
        STORAGE.history,
        []
      );


    const clean =
      history.filter(
        entry =>
          entry.uid !== item.uid
      );


    clean.unshift({

      uid: item.uid,

      title: item.title,

      group: item.group,

      logo: item.logo,

      url: item.url,

      timestamp:
        Date.now()

    });


    writeJSON(
      STORAGE.history,
      clean.slice(0, 50)
    );

  }


  function getHistory() {

    return readJSON(
      STORAGE.history,
      []
    );

  }


  /* =====================================================
     PARSER M3U
  ===================================================== */

  function parseAttributes(
    line
  ) {

    const attributes = {};

    const regex =
      /([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"/g;

    let match;


    while (
      (match = regex.exec(line))
    ) {

      attributes[
        match[1].toLowerCase()
      ] =
        match[2].trim();

    }


    return attributes;

  }


  function parseExtInf(
    line
  ) {

    const comma =
      line.indexOf(",");


    const metadata =
      comma >= 0
        ? line.slice(
            0,
            comma
          )
        : line;


    const title =
      comma >= 0
        ? line.slice(
            comma + 1
          ).trim()
        : "Sem título";


    const attributes =
      parseAttributes(
        metadata
      );


    return {

      title:
        title ||
        attributes["tvg-name"] ||
        "Sem título",

      group:
        attributes["group-title"] ||
        attributes["group"] ||
        "Outros",

      logo:
        attributes["tvg-logo"] ||
        attributes["logo"] ||
        "",

      tvgId:
        attributes["tvg-id"] ||
        "",

      country:
        attributes["tvg-country"] ||
        "",

      language:
        attributes["tvg-language"] ||
        "",

      radio:
        attributes["radio"] ||
        ""

    };

  }


  function parseM3U(
    text,
    progressCallback
  ) {

    const lines =
      String(text ?? "")
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/);


    const result = [];

    let metadata = null;

    let processed = 0;


    for (
      let i = 0;
      i < lines.length;
      i++
    ) {

      const raw =
        lines[i];


      const line =
        raw.trim();


      if (!line) {
        continue;
      }


      if (
        line.startsWith(
          "#EXTINF"
        )
      ) {

        metadata =
          parseExtInf(
            line
          );

        continue;

      }


      /*
       * Algumas playlists utilizam
       * #EXTGRP antes da URL.
       */

      if (
        line.startsWith(
          "#EXTGRP:"
        )
      ) {

        if (metadata) {

          metadata.group =
            line
              .slice(7)
              .trim() ||
            metadata.group;

        }

        continue;

      }


      /*
       * Linhas que não começam com #
       * podem representar URLs de stream.
       */

      if (
        !line.startsWith("#") &&
        metadata
      ) {

        const url =
          normalizeURL(
            line
          );


        if (url) {

          const base =
            metadata;


          const uid =
            hash(
              [
                base.title,
                base.group,
                base.logo,
                url,
                result.length
              ].join("|")
            );


          result.push({

            uid,

            title:
              base.title,

            group:
              base.group ||
              "Outros",

            logo:
              base.logo,

            tvgId:
              base.tvgId,

            country:
              base.country,

            language:
              base.language,

            url

          });

        }


        metadata = null;

      }


      processed++;


      if (
        progressCallback &&
        processed % 5000 === 0
      ) {

        progressCallback(
          processed,
          lines.length
        );

      }

    }


    return result;

  }


  /* =====================================================
     CATEGORIAS
  ===================================================== */

  function buildCategories() {

    const map =
      new Map();


    for (
      const item of state.items
    ) {

      const category =
        String(
          item.group ||
          "Outros"
        ).trim() ||
        "Outros";


      map.set(
        category,
        (map.get(category) || 0) + 1
      );

    }


    state.categories =
      [...map.entries()]
        .sort(
          (a, b) =>
            b[1] - a[1]
        );

  }


  function categoryIcon(
    name
  ) {

    const value =
      String(name)
        .toLowerCase();


    if (
      value.includes("filme") ||
      value.includes("movie")
    ) {
      return "◆";
    }


    if (
      value.includes("serie") ||
      value.includes("série")
    ) {
      return "▣";
    }


    if (
      value.includes("sport") ||
      value.includes("esporte") ||
      value.includes("futebol")
    ) {
      return "◉";
    }


    if (
      value.includes("kids") ||
      value.includes("infantil") ||
      value.includes("child")
    ) {
      return "✦";
    }


    if (
      value.includes("news") ||
      value.includes("noticia") ||
      value.includes("notícia")
    ) {
      return "◌";
    }


    if (
      value.includes("document")
    ) {
      return "◇";
    }


    return "•";

  }


  /* =====================================================
     NAVEGAÇÃO
  ===================================================== */

  function renderNavigation() {

    if (!navigation) {
      return;
    }


    const favoritesCount =
      state.items.filter(
        item =>
          isFavorite(
            item.uid
          )
      ).length;


    let html = `

      <button
        type="button"
        data-category="all"
        class="${
          state.category === "all" &&
          !state.favoritesOnly
            ? "active"
            : ""
        }"
      >

        <span>⌂</span>

        Início

      </button>


      <button
        type="button"
        data-favorites="true"
        class="${
          state.favoritesOnly
            ? "active"
            : ""
        }"
      >

        <span>☆</span>

        Favoritos

        <span class="count">
          ${favoritesCount}
        </span>

      </button>

    `;


    for (
      const [
        category,
        count
      ] of state.categories
    ) {

      html += `

        <button
          type="button"
          data-category="${escapeHTML(
            category
          )}"
          class="${
            state.category === category &&
            !state.favoritesOnly
              ? "active"
              : ""
          }"
        >

          <span>
            ${categoryIcon(
              category
            )}
          </span>

          ${escapeHTML(
            category
          )}

          <span class="count">
            ${count.toLocaleString(
              "pt-BR"
            )}
          </span>

        </button>

      `;

    }


    navigation.innerHTML =
      html;


    $$(
      "button",
      navigation
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


          renderNavigation();

          renderLibrary();


          $("#sidebar")
            ?.classList.remove(
              "open"
            );

        }
      );

    });

  }


  /* =====================================================
     DETECÇÃO DE TIPO
  ===================================================== */

  function detectType(item) {

    const url =
      String(
        item.url || ""
      ).toLowerCase();


    if (
      url.includes(".m3u8") ||
      url.includes("m3u8?")
    ) {

      return "hls";

    }


    if (
      url.includes(".mp4") ||
      url.includes(".webm") ||
      url.includes(".ogg")
    ) {

      return "video";

    }


    return "stream";

  }


  /* =====================================================
     FILTRO
  ===================================================== */

  function getFilteredItems() {

    let items =
      state.items;


    if (
      state.category !== "all"
    ) {

      items =
        items.filter(
          item =>
            item.group ===
            state.category
        );

    }


    if (
      state.favoritesOnly
    ) {

      items =
        items.filter(
          item =>
            isFavorite(
              item.uid
            )
        );

    }


    if (
      state.search
    ) {

      const query =
        state.search
          .toLowerCase()
          .trim();


      items =
        items.filter(
          item => {

            const text =
              [
                item.title,
                item.group,
                item.country,
                item.language,
                item.tvgId
              ]
                .join(" ")
                .toLowerCase();


            return text.includes(
              query
            );

          }
        );

    }


    return items;

  }


  /* =====================================================
     POSTER
  ===================================================== */

  function posterHTML(item) {

    const logo =
      normalizeURL(
        item.logo
      );


    const image =
      logo

        ? `

          <img
            src="${escapeHTML(
              logo
            )}"
            alt=""
            loading="lazy"
            referrerpolicy="no-referrer"
            onerror="
              this.style.display='none';
              this.nextElementSibling.classList.remove('hidden');
            "
          >

          <div
            class="poster-placeholder hidden"
          >
            ${categoryIcon(
              item.group
            )}
          </div>

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


    return image;

  }


  /* =====================================================
     CARD
  ===================================================== */

  function cardHTML(item) {

    const favorite =
      isFavorite(
        item.uid
      );


    return `

      <button
        class="media-card"
        type="button"
        data-id="${escapeHTML(
          item.uid
        )}"
      >

        <div class="card-poster">

          ${posterHTML(
            item
          )}


          <div class="card-overlay">

            <span class="play-circle">
              ▶
            </span>

          </div>


          <button
            class="card-favorite"
            type="button"
            data-favorite="${escapeHTML(
              item.uid
            )}"
            aria-label="Favorito"
          >
            ${
              favorite
                ? "★"
                : "☆"
            }
          </button>

        </div>


        <div class="card-title">
          ${escapeHTML(
            item.title
          )}
        </div>


        <div class="card-meta">
          ${escapeHTML(
            item.group
          )}
        </div>

      </button>

    `;

  }


  /* =====================================================
     CATEGORY ROW
  ===================================================== */

  function categoryRowHTML(
    title,
    items,
    delay
  ) {

    const list =
      items.slice(
        0,
        state.visiblePerRow
      );


    if (!list.length) {
      return "";
    }


    return `

      <section
        class="category-section"
        style="animation-delay:${delay}ms"
      >

        <div class="category-header">

          <h2>
            ${escapeHTML(
              title
            )}
          </h2>

          <span>
            ${items.length.toLocaleString(
              "pt-BR"
            )} conteúdos
          </span>

        </div>


        <div class="card-row">

          ${list
            .map(
              cardHTML
            )
            .join("")}

        </div>

      </section>

    `;

  }


  /* =====================================================
     HOME / ROWS
  ===================================================== */

  function renderLibrary() {

    if (!library) {
      return;
    }


    const filtered =
      getFilteredItems();


    /*
     * Pesquisa global:
     * mostra uma única grade horizontal.
     */

    if (
      state.search ||
      state.favoritesOnly ||
      state.category !== "all"
    ) {

      const title =
        state.search
          ? `Resultados para "${state.search}"`
          : state.favoritesOnly
            ? "Meus favoritos"
            : state.category;


      library.innerHTML =
        categoryRowHTML(
          title,
          filtered,
          0
        );


      if (!filtered.length) {

        library.innerHTML = "";

        $("#emptySearch")
          ?.classList.remove(
            "hidden"
          );

      } else {

        $("#emptySearch")
          ?.classList.add(
            "hidden"
          );

      }


      attachCardEvents();

      return;

    }


    $("#emptySearch")
      ?.classList.add(
        "hidden"
      );


    /*
     * HOME
     */

    const rows = [];


    /*
     * Continue assistindo
     */

    const history =
      getHistory();


    const historyItems =
      history
        .map(
          entry =>
            state.items.find(
              item =>
                item.uid ===
                entry.uid
            )
        )
        .filter(Boolean);


    if (historyItems.length) {

      rows.push({

        title:
          "Continue assistindo",

        items:
          historyItems

      });

    }


    /*
     * Favoritos
     */

    const favoriteItems =
      state.items.filter(
        item =>
          isFavorite(
            item.uid
          )
      );


    if (favoriteItems.length) {

      rows.push({

        title:
          "Minha lista",

        items:
          favoriteItems

      });

    }


    /*
     * Destaques
     */

    if (state.items.length) {

      const shuffled =
        [...state.items]
          .sort(
            () =>
              Math.random() - .5
          )
          .slice(0, 40);


      rows.push({

        title:
          "Em destaque",

        items:
          shuffled

      });

    }


    /*
     * Todas as categorias.
     */

    const used =
      new Set();


    for (
      const [
        category
      ] of state.categories
    ) {

      const items =
        state.items.filter(
          item =>
            item.group ===
            category
        );


      if (
        items.length &&
        !used.has(category)
      ) {

        rows.push({

          title:
            category,

          items

        });


        used.add(
          category
        );

      }

    }


    library.innerHTML =
      rows
        .map(
          (row, index) =>
            categoryRowHTML(
              row.title,
              row.items,
              index * 45
            )
        )
        .join("");


    attachCardEvents();

  }


  /* =====================================================
     CARD EVENTS
  ===================================================== */

  function attachCardEvents() {

    $$(".media-card")
      .forEach(card => {

        card.addEventListener(
          "click",
          event => {

            /*
             * O botão de favorito possui
             * seu próprio evento.
             */

            if (
              event.target.closest(
                "[data-favorite]"
              )
            ) {
              return;
            }


            const id =
              card.dataset.id;


            const item =
              state.items.find(
                x =>
                  x.uid === id
              );


            if (item) {

              openPlayer(
                item
              );

            }

          }
        );

      });


    $$(
      "[data-favorite]"
    )
      .forEach(button => {

        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();


            toggleFavorite(
              button.dataset.favorite
            );

          }
        );

      });

  }


  /* =====================================================
     HERO
  ===================================================== */

  function chooseHero() {

    if (!state.items.length) {
      return null;
    }


    const candidates =
      state.items.filter(
        item =>
          item.logo
      );


    const source =
      candidates.length
        ? candidates
        : state.items;


    return source[
      Math.floor(
        Math.random() *
        source.length
      )
    ];

  }


  function renderHero() {

    const hero =
      chooseHero();


    state.hero =
      hero;


    if (!hero) {
      return;
    }


    const heroImage =
      $("#heroImage");


    const heroTitle =
      $("#heroTitle");


    const heroDescription =
      $("#heroDescription");


    if (
      heroImage &&
      hero.logo
    ) {

      heroImage.style.backgroundImage =
        `
          url("${CSS.escape(
            hero.logo
          )}")
        `;

    }


    if (heroTitle) {

      heroTitle.textContent =
        hero.title;

    }


    if (heroDescription) {

      heroDescription.textContent =
        `${hero.group} · ${state.items.length.toLocaleString(
          "pt-BR"
        )} conteúdos disponíveis`;

    }

  }


  /* =====================================================
     PLAYER
  ===================================================== */

  function destroyHLS() {

    if (state.hls) {

      try {

        state.hls.destroy();

      } catch {

        // ignore

      }

      state.hls =
        null;

    }

  }


  function resetPlayer() {

    destroyHLS();


    if (!video) {
      return;
    }


    video.pause();


    video.removeAttribute(
      "src"
    );


    video.load();

  }


  function setPlayerLoading(
    visible
  ) {

    playerLoading
      ?.classList.toggle(
        "hidden",
        !visible
      );

  }


  function setPlayerError(
    visible,
    message = ""
  ) {

    playerError
      ?.classList.toggle(
        "hidden",
        !visible
      );


    if (
      message &&
      playerErrorText
    ) {

      playerErrorText.textContent =
        message;

    }

  }


  function updatePlayerFavorite() {

    const button =
      $("#playerFavorite");


    if (
      !button ||
      !state.current
    ) {
      return;
    }


    button.textContent =
      isFavorite(
        state.current.uid
      )
        ? "★"
        : "☆";

  }


  async function playNative(
    url
  ) {

    if (!video) {
      return;
    }


    video.src =
      url;


    video.load();


    try {

      await video.play();

    } catch {

      /*
       * Navegadores podem impedir
       * autoplay. O usuário ainda
       * pode apertar Play no player.
       */

    }

  }


  async function playStream(
    item
  ) {

    resetPlayer();


    setPlayerError(
      false
    );


    setPlayerLoading(
      true
    );


    const url =
      normalizeURL(
        item.url
      );


    if (!url) {

      setPlayerLoading(
        false
      );

      setPlayerError(
        true,
        "A playlist não forneceu uma URL válida para este conteúdo."
      );

      return;

    }


    const isHLS =
      /\.m3u8($|\?)/i.test(
        url
      );


    /*
     * Safari/iOS possui HLS nativo.
     */

    if (
      isHLS &&
      video.canPlayType(
        "application/vnd.apple.mpegurl"
      )
    ) {

      await playNative(
        url
      );


      setPlayerLoading(
        false
      );

      return;

    }


    /*
     * Chrome / Edge / Firefox:
     * HLS.js quando disponível.
     */

    if (
      isHLS &&
      window.Hls &&
      window.Hls.isSupported()
    ) {

      const hls =
        new window.Hls({

          enableWorker: true,

          lowLatencyMode: true,

          backBufferLength: 90,

          maxBufferLength: 30

        });


      state.hls =
        hls;


      hls.on(
        window.Hls.Events.MEDIA_ATTACHED,
        () => {

          hls.loadSource(
            url
          );

        }
      );


      hls.on(
        window.Hls.Events.MANIFEST_PARSED,
        async () => {

          setPlayerLoading(
            false
          );


          try {

            await video.play();

          } catch {

            // autoplay bloqueado

          }

        }
      );


      hls.on(
        window.Hls.Events.ERROR,
        (
          event,
          data
        ) => {

          if (
            data?.fatal
          ) {

            setPlayerLoading(
              false
            );


            setPlayerError(
              true,
              "O servidor ou formato deste stream não pode ser reproduzido diretamente neste navegador."
            );


            try {

              hls.destroy();

            } catch {}

          }

        }
      );


      hls.attachMedia(
        video
      );


      return;

    }


    /*
     * Outros formatos:
     * tenta reprodução nativa.
     */

    await playNative(
      url
    );


    setPlayerLoading(
      false
    );

  }


  function openPlayer(
    item
  ) {

    state.current =
      item;


    $("#playerTitle").textContent =
      item.title;


    $("#playerCategory").textContent =
      item.group;


    updatePlayerFavorite();


    playerModal
      ?.classList.remove(
        "hidden"
      );


    document.body.style.overflow =
      "hidden";


    addHistory(
      item
    );


    playStream(
      item
    );

  }


  function closePlayer() {

    resetPlayer();


    playerModal
      ?.classList.add(
        "hidden"
      );


    document.body.style.overflow =
      "";


    state.current =
      null;

  }


  /* =====================================================
     PROCESSAR PLAYLIST
  ===================================================== */

  async function processPlaylist(
    text,
    playlistName
  ) {

    if (
      !text ||
      !String(text).trim()
    ) {

      throw new Error(
        "A playlist está vazia."
      );

    }


    showLoading(
      "Lendo sua playlist...",
      5
    );


    /*
     * Damos uma pequena folga ao navegador
     * antes do parser de uma playlist enorme.
     */

    await sleep(
      50
    );


    const items =
      parseM3U(
        text,
        (
          current,
          total
        ) => {

          const percent =
            Math.min(
              65,
              5 +
              (
                current /
                total
              ) *
              60
            );


          updateLoading(
            `Processando conteúdo ${current.toLocaleString(
              "pt-BR"
            )}...`,
            percent
          );

        }
      );


    if (!items.length) {

      throw new Error(
        "Nenhum conteúdo M3U válido foi encontrado. Verifique se o arquivo possui entradas #EXTINF."
      );

    }


    updateLoading(
      "Organizando categorias...",
      72
    );


    await sleep(
      30
    );


    state.items =
      items;


    state.playlistName =
      playlistName ||
      "Minha playlist";


    state.category =
      "all";


    state.search =
      "";


    state.favoritesOnly =
      false;


    buildCategories();


    updateLoading(
      "Preparando interface...",
      90
    );


    await sleep(
      120
    );


    renderNavigation();

    renderHero();

    renderLibrary();


    updateLoading(
      "Tudo pronto.",
      100
    );


    await sleep(
      300
    );


    hideLoading();

    showHome();

  }


  /* =====================================================
     LOADING UI
  ===================================================== */

  function showLoading(
    message,
    percent
  ) {

    loadingScreen
      ?.classList.remove(
        "hidden"
      );


    updateLoading(
      message,
      percent
    );

  }


  function updateLoading(
    message,
    percent
  ) {

    if (loadingText) {

      loadingText.textContent =
        message;

    }


    if (loadingProgress) {

      loadingProgress.style.width =
        `${percent}%`;

    }

  }


  function hideLoading() {

    loadingScreen
      ?.classList.add(
        "hidden"
      );

  }


  function showHome() {

    setupScreen
      ?.classList.add(
        "hidden"
      );


    homeScreen
      ?.classList.remove(
        "hidden"
      );

  }


  function showSetup() {

    closePlayer();


    homeScreen
      ?.classList.add(
        "hidden"
      );


    setupScreen
      ?.classList.remove(
        "hidden"
      );

  }


  /* =====================================================
     FILE
  ===================================================== */

  async function handleFile(
    file,
    name
  ) {

    if (!file) {

      throw new Error(
        "Selecione um arquivo M3U."
      );

    }


    const valid =
      /\.(m3u8?|txt)$/i.test(
        file.name
      );


    if (!valid) {

      throw new Error(
        "Selecione um arquivo M3U ou M3U8."
      );

    }


    setSetupMessage(
      "Lendo arquivo..."
    );


    /*
     * text() é suportado pelos browsers
     * modernos e evita FileReader manual.
     */

    const text =
      await file.text();


    await processPlaylist(
      text,
      name ||
      file.name
    );

  }


  /* =====================================================
     URL M3U
  ===================================================== */

  async function handleURL(
    url,
    name
  ) {

    url =
      normalizeURL(
        url
      );


    if (!url) {

      throw new Error(
        "Informe a URL da playlist."
      );

    }


    showLoading(
      "Conectando à playlist...",
      10
    );


    let response;


    try {

      response =
        await fetch(
          url,
          {
            method: "GET",
            cache: "no-store"
          }
        );

    } catch {

      hideLoading();


      throw new Error(
        "Não foi possível acessar a playlist. O servidor pode bloquear requisições do navegador (CORS)."
      );

    }


    if (!response.ok) {

      hideLoading();


      throw new Error(
        `Servidor respondeu com HTTP ${response.status}.`
      );

    }


    const text =
      await response.text();


    await processPlaylist(
      text,
      name ||
      "Minha playlist"
    );

  }


  /* =====================================================
     XTREAM
  ===================================================== */

  async function handleXtream(
    server,
    username,
    password,
    name
  ) {

    server =
      normalizeURL(
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
        "Informe o servidor."
      );

    }


    if (!username) {

      throw new Error(
        "Informe o usuário."
      );

    }


    if (!password) {

      throw new Error(
        "Informe a senha."
      );

    }


    /*
     * Endpoint padrão Xtream Codes.
     */

    const url =
      `${server}/get.php` +
      `?username=${encodeURIComponent(
        username
      )}` +
      `&password=${encodeURIComponent(
        password
      )}` +
      `&type=m3u_plus` +
      `&output=ts`;


    await handleURL(
      url,
      name ||
      "Minha TV"
    );

  }


  /* =====================================================
     TABS
  ===================================================== */

  function setupTabs() {

    $$(".source-tab")
      .forEach(tab => {

        tab.addEventListener(
          "click",
          () => {

            $$(".source-tab")
              .forEach(
                button =>
                  button.classList.remove(
                    "active"
                  )
              );


            $$(".source-panel")
              .forEach(
                panel =>
                  panel.classList.remove(
                    "active"
                  )
              );


            tab.classList.add(
              "active"
            );


            const panel =
              $(
                `#${tab.dataset.tab}Panel`
              );


            panel
              ?.classList.add(
                "active"
              );


            setSetupMessage(
              ""
            );

          }
        );

      });

  }


  /* =====================================================
     FILE INPUT
  ===================================================== */

  function setupFileInput() {

    const input =
      $("#playlistFile");


    const zone =
      $("#uploadZone");


    const label =
      $("#selectedFile");


    if (!input) {
      return;
    }


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


    if (!zone) {
      return;
    }


    [
      "dragenter",
      "dragover"
    ]
      .forEach(
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
    ]
      .forEach(
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


        if (!file) {
          return;
        }


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

          /*
           * Alguns navegadores não permitem
           * alterar input.files programaticamente.
           */

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
                ?.value;


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
                ?.value,

              $("#xtreamUsername")
                ?.value,

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
     BUSCA
  ===================================================== */

  function setupSearch() {

    if (!search) {
      return;
    }


    search.addEventListener(
      "input",
      () => {

        state.search =
          search.value;


        state.category =
          "all";


        state.favoritesOnly =
          false;


        renderNavigation();

        renderLibrary();

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


          state.category =
            "all";


          if (!state.favoritesOnly) {

            state.search =
              "";


            if (search) {

              search.value =
                "";

            }

          }


          renderNavigation();

          renderLibrary();

        }
      );

  }


  /* =====================================================
     MOBILE MENU
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
     PLAYER CONTROLS
  ===================================================== */

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
        () => {

          setPlayerLoading(
            true
          );

        }
      );


    video
      ?.addEventListener(
        "playing",
        () => {

          setPlayerLoading(
            false
          );

          setPlayerError(
            false
          );

        }
      );


    video
      ?.addEventListener(
        "canplay",
        () => {

          setPlayerLoading(
            false
          );

        }
      );


    video
      ?.addEventListener(
        "error",
        () => {

          setPlayerLoading(
            false
          );


          setPlayerError(
            true,
            "Este stream não pôde ser reproduzido diretamente pelo navegador."
          );

        }
      );

  }


  /* =====================================================
     HERO BUTTONS
  ===================================================== */

  function setupHero() {

    $("#heroPlay")
      ?.addEventListener(
        "click",
        () => {

          if (
            state.hero
          ) {

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

          if (
            state.hero
          ) {

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


        setSetupMessage(
          ""
        );

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

    await sleep(
      900
    );


    splash
      ?.classList.add(
        "hide"
      );


    await sleep(
      500
    );


    splash
      ?.classList.add(
        "hidden"
      );


    setupScreen
      ?.classList.remove(
        "hidden"
      );

  }


  /* =====================================================
     INIT
  ===================================================== */

  function init() {

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


  /*
   * Espera o DOM.
   */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );

  } else {

    init();

  }

})();
