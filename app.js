const demoChannels = [
  {
    name:"Sinal Sports",
    group:"Esportes",
    now:"Futebol ao vivo",
    next:"Debate",
    logo:"",
    url:"",
    art:"a1"
  },
  {
    name:"Sinal News",
    group:"Notícias",
    now:"Plantão Brasil",
    next:"Jornal",
    logo:"",
    url:"",
    art:"a2"
  },
  {
    name:"Sinal Cinema",
    group:"Filmes",
    now:"Night Shift",
    next:"After Hours",
    logo:"",
    url:"",
    art:"a3"
  },
  {
    name:"Sinal Docs",
    group:"Documentários",
    now:"Ocean Planet",
    next:"Wild Earth",
    logo:"",
    url:"",
    art:"a4"
  },
  {
    name:"Sinal Action",
    group:"Filmes",
    now:"The North",
    next:"Black Water",
    logo:"",
    url:"",
    art:"a5"
  },
  {
    name:"Sinal Family",
    group:"Infantil",
    now:"Adventure Club",
    next:"Little Stars",
    logo:"",
    url:"",
    art:"a6"
  }
];

const movies = [
  "The Last Signal",
  "Beyond Earth",
  "Black Water",
  "After Hours",
  "The North",
  "Ocean Planet"
];

let channels = [];
let favorites = JSON.parse(
  localStorage.getItem("sinal_favorites") || "[]"
);

let searchTimer = null;

function load(){
  try{
    channels =
      JSON.parse(
        localStorage.getItem("sinal_channels") || "null"
      ) || demoChannels;
  }catch(e){
    channels = demoChannels;
  }
}

function save(){
  localStorage.setItem(
    "sinal_channels",
    JSON.stringify(channels)
  );
}

function setActive(id){
  document
    .querySelectorAll("nav button")
    .forEach(button => button.classList.remove("active"));

  if(id){
    document
      .getElementById(id)
      ?.classList.add("active");
  }
}

function showHome(){
  setActive("homeNav");
  app.innerHTML = homeHTML();
  scrollTo(0,0);
}

function showLive(){
  setActive("liveNav");
  app.innerHTML = liveHTML();
  scrollTo(0,0);
}

function showList(){
  setActive("listNav");
  app.innerHTML = listHTML();
  scrollTo(0,0);
}

function showManager(){
  setActive(null);
  app.innerHTML = managerHTML();
  scrollTo(0,0);
}

function homeHTML(){
  return `
  <main>

    <section class="hero">

      <div class="heroCopy">

        <div class="eyebrow">
          <span class="liveDot"></span>
          EXPERIÊNCIA PREMIUM
        </div>

        <h1>
          O entretenimento<br>
          <span>do seu jeito.</span>
        </h1>

        <p>
          TV ao vivo, filmes, séries e esportes em uma
          interface criada para parecer premium desde
          o primeiro toque.
        </p>

        <div class="actions">

          <button
            class="primary"
            onclick="playItem({
              name:'Night Shift',
              group:'Filme',
              url:''
            })"
          >
            ▶ Assistir agora
          </button>

          <button
            class="secondary"
            onclick="toggleFavorite('hero')"
          >
            ＋ Minha lista
          </button>

        </div>

        <div class="chips">
          <span>4K</span>
          <span>HDR</span>
          <span>16+</span>
          <span>2026</span>
        </div>

      </div>

      <div class="heroPoster">
        <div class="posterText">
          NIGHT<br>
          <b>SHIFT</b>
          <small>UMA NOITE. UM SINAL.</small>
        </div>
      </div>

    </section>

    <section class="section">

      <div class="sectionHead">

        <div>
          <small>AGORA</small>
          <h2>Ao vivo agora</h2>
        </div>

        <button
          class="textBtn"
          onclick="showLive()"
        >
          Ver todos →
        </button>

      </div>

      <div class="channelGrid">
        ${channels.slice(0,4).map(channelCard).join("")}
      </div>

    </section>

    <section class="section">

      <div class="sectionHead">

        <div>
          <small>PARA VOCÊ</small>
          <h2>Continue assistindo</h2>
        </div>

      </div>

      <div class="posterGrid">
        ${movies.map((x,i)=>movieCard(x,i)).join("")}
      </div>

    </section>

    <section class="section">

      <div class="sectionHead">

        <div>
          <small>SELEÇÃO SINAL</small>
          <h2>Porque você vai gostar</h2>
        </div>

      </div>

      <div class="featureGrid">

        ${[
          [
            "After Hours",
            "ORIGINAL",
            "Drama • Suspense",
            "f1"
          ],
          [
            "Beyond Earth",
            "4K • HDR",
            "Ficção • Aventura",
            "f2"
          ],
          [
            "The North",
            "ESTREIA",
            "Ação • Drama",
            "f3"
          ]
        ].map(x => `

          <button
            class="feature ${x[3]}"
            onclick="playItem({
              name:'${x[0]}',
              group:'${x[2]}',
              url:''
            })"
          >

            <span>${x[1]}</span>
            <b>${x[0]}</b>
            <small>${x[2]}</small>

          </button>

        `).join("")}

      </div>

    </section>

    <section class="section">

      <div class="sectionHead">

        <div>
          <small>GRADE</small>
          <h2>Programação de hoje</h2>
        </div>

        <button
          class="textBtn"
          onclick="showLive()"
        >
          Abrir EPG →
        </button>

      </div>

      ${epgHTML()}

    </section>

  </main>
  `;
}

function channelCard(c,i){

  const cls =
    c.art ||
    ("a" + ((i || 0) % 6 + 1));

  return `
    <button
      class="channel"
      onclick='playItem(${safeJSON(c)})'
    >

      <div class="channelArt ${cls}">

        <span>
          ${c.url ? "● AO VIVO" : "● DEMO"}
        </span>

        <b>
          ${esc(c.name).toUpperCase()}
        </b>

        <small>
          ${esc(c.now || c.group || "Canal ao vivo")}
        </small>

      </div>

      <div class="channelInfo">

        <em>
          ${String(i+1).padStart(2,"0")}
        </em>

        <div>

          <b>
            ${esc(c.name)}
          </b>

          <small>
            ${esc(c.group || "Outros")}
            ${
              c.next
                ? "• próximo: " + esc(c.next)
                : ""
            }
          </small>

        </div>

        <span>▶</span>

      </div>

    </button>
  `;
}

function movieCard(name,i){

  return `
    <article class="contentCard">

      <button
        class="cover c${i%6+1}"
        onclick="playItem({
          name:${JSON.stringify(name)},
          group:'Filme',
          url:''
        })"
      >

        <span>
          ${[78,42,64,31,88,55][i]}%
        </span>

        <b>
          ${esc(name).toUpperCase()}
        </b>

      </button>

      <div class="meta">

        <div>

          <b>
            ${esc(name)}
          </b>

          <small>
            ${i%2 ? "Série" : "Filme"}
            •
            ${i%2 ? "T2:E4" : "1h 42min"}
          </small>

        </div>

        <button
          class="fav"
          onclick="
            event.stopPropagation();
            toggleFavorite(${JSON.stringify(name)})
          "
        >
          ${favorites.includes(name) ? "✓" : "＋"}
        </button>

      </div>

    </article>
  `;
}

function epgHTML(){

  return `
    <div class="epg">

      ${channels.slice(0,4).map(c => `

        <div class="epgRow">

          <b>${esc(c.name)}</b>

          <span>18:00</span>

          <span class="epgNow">
            18:30&nbsp;
            ${esc(c.now || "Programação")}
          </span>

          <span>
            20:00&nbsp;
            ${esc(c.next || "Próximo programa")}
          </span>

        </div>

      `).join("")}

    </div>
  `;
}

function liveHTML(){

  return `
    <main class="page">

      <div class="pageHead">

        <small>TELEVISÃO AO VIVO</small>

        <h1>Ao vivo</h1>

        <p>
          Seus canais organizados em uma experiência
          simples, rápida e premium.
        </p>

      </div>

      <div class="pageGrid">

        <div class="videoBox">

          <div class="videoPlaceholder">

            <strong>
              Selecione um canal
            </strong>

            <span>
              O player abrirá a fonte configurada
              na playlist.
            </span>

          </div>

        </div>

        <div class="sideList">

          ${channels
            .map((c,i)=>channelCard(c,i))
            .join("")}

        </div>

      </div>

      <section
        class="section"
        style="padding-left:0;padding-right:0;margin-top:25px"
      >

        <div class="sectionHead">

          <div>

            <small>PROGRAMAÇÃO</small>

            <h2>EPG</h2>

          </div>

        </div>

        ${epgHTML()}

      </section>

    </main>
  `;
}

function listHTML(){

  const items =
    movies.filter(x => favorites.includes(x));

  return `
    <main class="page">

      <div class="pageHead">

        <small>PERSONALIZADO</small>

        <h1>Minha lista</h1>

        <p>
          Conteúdos salvos para assistir depois.
        </p>

      </div>

      ${
        items.length

        ? `
          <div class="posterGrid">
            ${items.map((x,i)=>movieCard(x,i)).join("")}
          </div>
        `

        : `
          <div
            class="panel"
            style="text-align:center;padding:60px;color:#666"
          >
            Sua lista ainda está vazia.
            <br>
            <small>
              Use o ＋ nos conteúdos para salvar.
            </small>
          </div>
        `
      }

    </main>
  `;
}

function managerHTML(){

  return `
    <main class="page admin">

      <div class="pageHead">

        <small>CONFIGURAÇÃO</small>

        <h1>Sua playlist</h1>

        <p>
          Adicione a playlist que você recebeu do seu
          provedor. Ela fica armazenada localmente
          neste navegador.
        </p>

      </div>

      <div class="panel">

        <div class="drop">

          Selecione um arquivo
          <b>M3U/M3U8</b>
          do seu dispositivo.

          <br>

          <label>
            Selecionar playlist

            <input
              type="file"
              accept=".m3u,.m3u8,.txt"
              onchange="importFile(this.files[0])"
            >

          </label>

          <p
            id="fileStatus"
            class="hint"
          ></p>

        </div>

        <div
          style="
            text-align:center;
            color:#555;
            margin:18px 0;
            font-size:9px
          "
        >
          ou
        </div>

        <div class="sourceRow">

          <input
            id="playlistUrl"
            placeholder="URL da playlist M3U/M3U8"
          >

          <button onclick="importURL()">
            Adicionar URL
          </button>

        </div>

        <p class="hint">
          Algumas URLs podem ser bloqueadas pelo navegador
          por CORS. Nesse caso, prefira o arquivo M3U/M3U8
          ou use um backend/proxy autorizado.
        </p>

        <div class="playlistInfo">

          <span>
            <b id="count">${channels.length}</b>
            canais carregados
          </span>

          <button
            class="danger"
            onclick="clearPlaylist()"
          >
            Limpar playlist
          </button>

        </div>

      </div>

    </main>
  `;
}

function importFile(file){

  if(!file){
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {

    const parsed = parseM3U(reader.result);

    if(!parsed.length){

      toast(
        "Nenhum canal válido encontrado."
      );

      return;
    }

    channels = parsed;

    save();

    const status =
      document.getElementById("fileStatus");

    if(status){
      status.textContent =
        `✓ ${parsed.length} canais importados.`;
    }

    toast(
      `${parsed.length} canais carregados`
    );

    setTimeout(showHome,400);
  };

  reader.onerror = () => {
    toast(
      "Não foi possível ler o arquivo."
    );
  };

  reader.readAsText(file);
}

async function importURL(){

  const input =
    document.getElementById("playlistUrl");

  const url =
    input.value.trim();

  if(!url){
    toast("Cole a URL da playlist.");
    return;
  }

  try{

    const res = await fetch(url);

    if(!res.ok){
      throw new Error("HTTP " + res.status);
    }

    const text =
      await res.text();

    const parsed =
      parseM3U(text);

    if(!parsed.length){
      throw new Error("Lista vazia");
    }

    channels = parsed;

    save();

    toast(
      `${parsed.length} canais carregados`
    );

    showHome();

  }catch(e){

    toast(
      "A URL foi bloqueada ou não retornou uma M3U válida."
    );

  }
}

function parseM3U(text){

  const lines =
    text
      .replace(/^\uFEFF/,"")
      .split(/\r?\n/);

  const out = [];

  for(let i=0;i<lines.length;i++){

    let line =
      lines[i].trim();

    if(!line.startsWith("#EXTINF")){
      continue;
    }

    let url = "";

    for(
      let j=i+1;
      j<lines.length;
      j++
    ){

      if(
        lines[j].trim() &&
        !lines[j].trim().startsWith("#")
      ){

        url =
          lines[j].trim();

        i=j;

        break;
      }
    }

    if(!url){
      continue;
    }

    const name =
      line.includes(",")
        ? line
            .slice(line.indexOf(",")+1)
            .trim()
        : "Canal";

    const group =
      (line.match(
        /group-title="([^"]*)"/i
      ) || [])[1] ||
      "Outros";

    const logo =
      (line.match(
        /tvg-logo="([^"]*)"/i
      ) || [])[1] ||
      "";

    out.push({
      name,
      group,
      logo,
      url,
      now:"Programação",
      next:"Próximo programa",
      art:"a" + ((out.length)%6+1)
    });
  }

  return out;
}

function clearPlaylist(){

  channels = demoChannels;

  localStorage.removeItem(
    "sinal_channels"
  );

  toast("Playlist removida");

  showHome();
}

function playItem(item){

  const title =
    document.getElementById("modalTitle");

  const desc =
    document.getElementById("modalDesc");

  const video =
    document.getElementById("modalVideo");

  const fallback =
    document.getElementById("playerFallback");

  title.textContent =
    item.name || "Sinal IPTV";

  desc.textContent =
    (item.group || "Conteúdo") +
    " • " +
    (
      item.url
        ? "Fonte carregada da playlist"
        : "Demonstração"
    );

  fallback.classList.add("hidden");
  video.classList.remove("hidden");

  video.pause();
  video.removeAttribute("src");
  video.load();

  if(!item.url){

    video.classList.add("hidden");

    fallback.classList.remove("hidden");

    fallback.innerHTML = `
      <strong>
        Conteúdo de demonstração
      </strong>

      <span>
        Adicione sua playlist M3U para
        reproduzir seus canais.
      </span>
    `;

  }else{

    video.src = item.url;

    video.play().catch(() => {});
  }

  document
    .getElementById("playerModal")
    .classList.add("open");
}

function closePlayer(){

  const video =
    document.getElementById("modalVideo");

  video.pause();

  video.removeAttribute("src");

  video.load();

  document
    .getElementById("playerModal")
    .classList.remove("open");
}

function toggleFavorite(id){

  if(favorites.includes(id)){

    favorites =
      favorites.filter(
        x => x !== id
      );

  }else{

    favorites.push(id);
  }

  localStorage.setItem(
    "sinal_favorites",
    JSON.stringify(favorites)
  );

  toast(
    favorites.includes(id)
      ? "Adicionado à sua lista ✓"
      : "Removido da sua lista"
  );

  if(
    document
      .getElementById("listNav")
      ?.classList.contains("active")
  ){
    showList();
  }
}

function doSearch(q){

  clearTimeout(searchTimer);

  searchTimer =
    setTimeout(() => {

      q =
        q.trim().toLowerCase();

      if(!q){

        showHome();

        return;
      }

      const found = [

        ...channels.map(c => ({
          ...c,
          title:c.name
        })),

        ...movies.map((x,i) => ({
          name:x,
          title:x,
          group:i%2 ? "Série" : "Filme",
          url:"",
          art:"c" + (i%6+1)
        }))

      ].filter(x =>
        (x.title || x.name)
          .toLowerCase()
          .includes(q)
      );

      setActive(null);

      app.innerHTML = `

        <main class="searchPage">

          <div class="sectionHead">

            <div>

              <small>RESULTADOS</small>

              <h2>Busca</h2>

            </div>

            <span
              style="
                font-size:9px;
                color:#666
              "
            >
              ${found.length}
              encontrados
            </span>

          </div>

          <div class="results">

            ${found.map(x => `

              <button
                class="result"
                onclick='playItem(${safeJSON(x)})'
              >

                <div
                  class="resultArt ${x.art || "a1"}"
                ></div>

                <small>
                  ${esc(x.group || "Conteúdo")}
                </small>

                <b>
                  ${esc(x.title || x.name)}
                </b>

              </button>

            `).join("")}

          </div>

        </main>
      `;

    },100);
}

function toast(msg){

  const t =
    document.getElementById("toast");

  t.textContent = msg;

  t.classList.add("show");

  setTimeout(() => {
    t.classList.remove("show");
  },1900);
}

function esc(s){

  return String(s ?? "")
    .replace(
      /[&<>"']/g,
      m => ({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#39;"
      }[m])
    );
}

function safeJSON(o){

  return JSON
    .stringify(o)
    .replace(/</g,"\\u003c");
}

document
  .getElementById("searchInput")
  .addEventListener(
    "input",
    e => doSearch(e.target.value)
  );

document
  .getElementById("playerModal")
  .addEventListener(
    "click",
    e => {

      if(e.target.id === "playerModal"){
        closePlayer();
      }

    }
  );

load();
showHome();
