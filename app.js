const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
let items=[], currentView="home", favorites=JSON.parse(localStorage.getItem("sinalFav")||"[]");

function openModal(){ $("#modal").classList.remove("hidden"); $("#status").textContent=""; }
function closeModal(){ $("#modal").classList.add("hidden"); }
$("#playlistBtn").onclick=$("#heroPlaylist").onclick=$("#emptyPlaylist").onclick=openModal;
$("#closeModal").onclick=closeModal;

$$(".tab").forEach(t=>t.onclick=()=>{$$(".tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");$("#urlTab").classList.toggle("hidden",t.dataset.tab!=="url");$("#fileTab").classList.toggle("hidden",t.dataset.tab!=="file")});

function parseM3U(text){
  const lines=text.replace(/\r/g,"").split("\n"), out=[]; let meta=null;
  for(const raw of lines){const line=raw.trim(); if(!line)continue;
    if(line.startsWith("#EXTINF:")){ const comma=line.indexOf(","); const title=comma>=0?line.slice(comma+1).trim():"Sem título";
      const attrs={}; const re=/([\\w-]+)="([^"]*)"/g; let m; while((m=re.exec(line)))attrs[m[1]]=m[2];
      meta={title, group:attrs["group-title"]||"Sem categoria", logo:attrs["tvg-logo"]||"", type:guessType(attrs["group-title"]||"",title), tvgId:attrs["tvg-id"]||""};
    } else if(!line.startsWith("#") && meta){out.push({...meta,url:line,id:crypto.randomUUID()});meta=null;}
  } return out;
}
function guessType(group,title){const s=(group+" "+title).toLowerCase(); if(/filme|movie|cinema/.test(s))return"Filmes"; if(/série|series|season|temporada/.test(s))return"Séries"; return"TV ao vivo";}
function save(){localStorage.setItem("sinalItems",JSON.stringify(items));}
function render(list=items){
  const grid=$("#grid"), empty=$("#empty"); grid.innerHTML="";
  const filtered=currentView==="home"?list: list.filter(x=>x.type.toLowerCase().includes(currentView==="live"?"tv":""));
  const data=currentView==="home"?list: list.filter(x=>x.type===({live:"TV ao vivo",movies:"Filmes",series:"Séries"}[currentView]));
  $("#sectionTitle").textContent=currentView==="home"?(items.length?"Sua biblioteca":"Comece adicionando sua playlist"):({live:"TV ao vivo",movies:"Filmes",series:"Séries"}[currentView]);
  $("#stats").textContent=items.length?`${items.length.toLocaleString("pt-BR")} itens`:"";
  empty.classList.toggle("hidden",items.length>0 && data.length===0?false:items.length>0);
  if(!items.length){empty.classList.remove("hidden");return}
  if(!data.length){empty.innerHTML="<div class='empty-icon'>⌁</div><h3>Nada por aqui ainda</h3><p>Essa categoria não apareceu na sua playlist.</p>";empty.classList.remove("hidden");return}
  empty.classList.add("hidden");
  data.slice(0,300).forEach(x=>{const c=document.createElement("article");c.className="card";c.innerHTML=`<div class="thumb">${x.logo?`<img loading="lazy" src="${esc(x.logo)}" onerror="this.remove()">`:"<span>▶</span>"}</div><div class="play-dot">▶</div><div class="card-body"><div class="card-title">${esc(x.title)}</div><div class="card-sub">${esc(x.group)}</div></div>`;c.onclick=()=>play(x);grid.appendChild(c)});
}
function esc(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function play(x){$("#playerTitle").textContent=x.title;$("#playerGroup").textContent=x.group;$("#player").classList.remove("hidden");const v=$("#video");v.src=x.url;$("#playerMsg").textContent="";v.play().catch(()=>$("#playerMsg").textContent="Toque no botão de reprodução para iniciar.");}
$("#closePlayer").onclick=()=>{$("#video").pause();$("#video").removeAttribute("src");$("#player").classList.add("hidden")};

async function loadText(text){
  const parsed=parseM3U(text); if(!parsed.length)throw Error("Nenhum item M3U válido foi encontrado.");
  items=parsed;save();closeModal();render();$("#hero").style.minHeight="480px";$("#hero").querySelector("h1").innerHTML="Tudo pronto.<br><span>Escolha o que assistir.</span>";$("#hero").querySelector("p").textContent=`Sua playlist foi carregada com ${items.length.toLocaleString("pt-BR")} itens.`;
}
$("#loadFile").onclick=async()=>{const f=$("#fileInput").files[0];if(!f){$("#status").textContent="Selecione um arquivo.";return}$("#status").textContent="Lendo playlist…";try{await loadText(await f.text())}catch(e){$("#status").textContent=e.message}};
$("#loadUrl").onclick=async()=>{const url=$("#urlInput").value.trim();if(!url){$("#status").textContent="Informe a URL da playlist.";return}$("#status").textContent="Carregando playlist…";try{const r=await fetch(url);if(!r.ok)throw Error("Não foi possível acessar a playlist.");await loadText(await r.text())}catch(e){$("#status").textContent="Não foi possível carregar essa URL no navegador. O servidor pode bloquear CORS; nesse caso, baixe o M3U e use a opção Arquivo."}};

$$(".nav-btn").forEach(b=>b.onclick=()=>{$$(".nav-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");currentView=b.dataset.view;render()});
$("#exploreBtn").onclick=()=>$("#content").scrollIntoView({behavior:"smooth"});
$("#searchBtn").onclick=()=>{$("#searchPanel").classList.remove("hidden");$("#searchInput").focus();};
$("#closeSearch").onclick=()=>$("#searchPanel").classList.add("hidden");
$("#searchInput").oninput=e=>{const q=e.target.value.toLowerCase();const r=items.filter(x=>(x.title+" "+x.group).toLowerCase().includes(q)).slice(0,100);const g=$("#searchResults");g.innerHTML="";r.forEach(x=>{const c=document.createElement("article");c.className="card";c.innerHTML=`<div class="thumb">${x.logo?`<img src="${esc(x.logo)}">`:"<span>▶</span>"}</div><div class="card-body"><div class="card-title">${esc(x.title)}</div><div class="card-sub">${esc(x.group)}</div></div>`;c.onclick=()=>play(x);g.appendChild(c)})};

try{items=JSON.parse(localStorage.getItem("sinalItems")||"[]")}catch{} render();
