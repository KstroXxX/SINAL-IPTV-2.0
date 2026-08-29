const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
let items=[], currentView="home", currentGroup=null;

const DB="SinalIPTV", STORE="playlist", KEY="current";
function dbOpen(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function persist(data){const db=await dbOpen();await new Promise((res,rej)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(data,KEY);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});db.close()}
async function restore(){const db=await dbOpen();const d=await new Promise((res,rej)=>{const q=db.transaction(STORE,"readonly").objectStore(STORE).get(KEY);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});db.close();return d?.items||[]}

function openModal(){$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden")}
$("#playlistBtn").onclick=$("#heroPlaylist").onclick=$("#emptyPlaylist").onclick=openModal;
$("#closeModal").onclick=closeModal;

$$(".tab").forEach(t=>t.onclick=()=>{$$(".tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");$("#fileTab").classList.toggle("hidden",t.dataset.tab!=="file");$("#urlTab").classList.toggle("hidden",t.dataset.tab!=="url")});

function guessType(group,title){
 const s=(group+" "+title).toLowerCase();
 if(/filme|filmes|movie|movies|cinema|vod/.test(s))return"movies";
 if(/série|series|series |season|temporada|epis[oó]dio/.test(s))return"series";
 return"live";
}
function parseM3U(text){
 const lines=text.replace(/^\uFEFF/,"").replace(/\r/g,"").split("\n"),out=[];let meta=null;
 for(const raw of lines){const line=raw.trim();if(!line)continue;
  if(line.startsWith("#EXTINF:")){
   const comma=line.indexOf(","),title=comma>=0?line.slice(comma+1).trim():"Sem título",attrs={};let m,re=/([\\w-]+)="([^"]*)"/g;
   while((m=re.exec(line)))attrs[m[1]]=m[2];
   meta={title,group:attrs["group-title"]||"Sem categoria",logo:attrs["tvg-logo"]||"",type:guessType(attrs["group-title"]||"",title),tvgId:attrs["tvg-id"]||""};
  }else if(!line.startsWith("#")&&meta){out.push({...meta,url:line,id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random())});meta=null}
 }
 return out;
}
function esc(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function typeLabel(t){return t==="movies"?"Filmes":t==="series"?"Séries":"Canais"}

function setNav(view){currentView=view;$$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===view));render()}
function dataForView(){
 if(currentView==="home")return items;
 if(currentView==="groups")return currentGroup?items.filter(x=>x.group===currentGroup):items;
 return items.filter(x=>x.type===currentView);
}
function render(){
 const grid=$("#grid"),empty=$("#empty"),cats=$("#categoryHome"),bar=$("#groupBar");
 grid.innerHTML="";bar.innerHTML="";currentGroup=currentView==="groups"?currentGroup:null;
 $("#stats").textContent=items.length?`${items.length.toLocaleString("pt-BR")} itens`:"";
 $("#liveCount").textContent=`${items.filter(x=>x.type==="live").length.toLocaleString("pt-BR")} canais`;
 $("#movieCount").textContent=`${items.filter(x=>x.type==="movies").length.toLocaleString("pt-BR")} filmes`;
 $("#seriesCount").textContent=`${items.filter(x=>x.type==="series").length.toLocaleString("pt-BR")} séries`;
 $("#groupCount").textContent=`${new Set(items.map(x=>x.group)).size.toLocaleString("pt-BR")} categorias`;

 if(!items.length){cats.classList.add("hidden");bar.classList.add("hidden");empty.classList.remove("hidden");$("#sectionTitle").textContent="Comece adicionando sua playlist";return}
 empty.classList.add("hidden");
 cats.classList.toggle("hidden",currentView!=="home");
 $("#sectionTitle").textContent=currentView==="home"?"Escolha o que assistir":currentView==="groups"?"Categorias":typeLabel(currentView);

 if(currentView==="groups"){
  bar.classList.remove("hidden");
  const groups=[...new Set(items.map(x=>x.group))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const all=document.createElement("button");all.textContent="Todas";all.className=!currentGroup?"active":"";all.onclick=()=>{currentGroup=null;render()};bar.appendChild(all);
  groups.forEach(g=>{const b=document.createElement("button");b.textContent=g;b.className=currentGroup===g?"active":"";b.onclick=()=>{currentGroup=g;render()};bar.appendChild(b)});
 }else bar.classList.add("hidden");

 const data=dataForView();
 if(!data.length){empty.innerHTML="<div class='empty-icon'>⌁</div><h3>Nada encontrado</h3><p>Essa categoria não apareceu na playlist.</p>";empty.classList.remove("hidden");return}
 data.slice(0,1000).forEach(addCard);
}
function addCard(x,container=$("#grid")){
 const c=document.createElement("article");c.className="card";
 c.innerHTML=`<div class="thumb">${x.logo?`<img loading="lazy" src="${esc(x.logo)}" onerror="this.style.display='none'">`:"<span>▶</span>"}</div><div class="play-dot">▶</div><div class="card-body"><div class="card-title">${esc(x.title)}</div><div class="card-sub">${esc(x.group)}</div></div>`;
 c.onclick=()=>play(x);container.appendChild(c)
}

async function loadPlaylistText(text,name="playlist"){
 $("#status").textContent="Lendo e organizando sua playlist…";
 const parsed=parseM3U(text);
 if(!parsed.length)throw Error("Nenhum item M3U válido foi encontrado.");
 // Render first: storage errors must never prevent the user from seeing the imported library.
 items=parsed; currentView="home"; currentGroup=null; render(); closeModal();
 $("#heroText").textContent=`${items.length.toLocaleString("pt-BR")} itens organizados em Canais, Filmes, Séries e categorias.`;
 $("#hero").style.minHeight="420px";
 try{await persist({name,items,updatedAt:Date.now()});}
 catch(e){console.warn("Persistência indisponível:",e)}
}
$("#loadFile").onclick=async()=>{
 const f=$("#fileInput").files[0];if(!f){$("#status").textContent="Selecione um arquivo.";return}
 try{await loadPlaylistText(await f.text(),f.name)}catch(e){$("#status").textContent="Não consegui ler esse arquivo M3U. Verifique se ele é uma playlist válida."}
};
$("#loadUrl").onclick=async()=>{
 const u=$("#urlInput").value.trim();if(!u){$("#status").textContent="Informe a URL.";return}
 try{const api=localStorage.getItem("sinalApiUrl"),target=api?api.replace(/\/$/,"")+"/api/playlist":u,r=await fetch(target,{cache:"no-store"});if(!r.ok)throw Error();await loadPlaylistText(await r.text(),"URL")}
 catch(e){$("#status").textContent="Não foi possível acessar a URL. O servidor pode bloquear CORS; use Arquivo M3U ou configure uma API."}
};

function play(x){$("#playerTitle").textContent=x.title;$("#playerGroup").textContent=x.group;$("#player").classList.remove("hidden");const v=$("#video");v.src=x.url;$("#playerMsg").textContent="";v.play().catch(()=>$("#playerMsg").textContent="Toque em ▶ no player para iniciar.")}
$("#closePlayer").onclick=()=>{$("#video").pause();$("#video").removeAttribute("src");$("#player").classList.add("hidden")};

$$(".nav-btn").forEach(b=>b.onclick=()=>setNav(b.dataset.view));
$$(".category-card").forEach(b=>b.onclick=()=>setNav(b.dataset.view));
$("#homeBtn").onclick=()=>setNav("home");
$("#exploreBtn").onclick=()=>$("#content").scrollIntoView({behavior:"smooth"});
$("#searchBtn").onclick=()=>{$("#searchPanel").classList.remove("hidden");$("#searchInput").focus()};
$("#closeSearch").onclick=()=>$("#searchPanel").classList.add("hidden");
$("#searchInput").oninput=e=>{const q=e.target.value.toLowerCase(),g=$("#searchResults");g.innerHTML="";items.filter(x=>(x.title+" "+x.group).toLowerCase().includes(q)).slice(0,300).forEach(x=>addCard(x,g))};

(async()=>{try{items=await restore()}catch(e){items=[]}render()})();
