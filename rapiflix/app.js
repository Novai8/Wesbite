/* Rapiflix: independent frontend inspired by the public-domain catalog approach in FreeReel and MovieTube. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const byId = (id) => catalog.find(m => m.id === id);
  const archive = 'https://archive.org';
  const catalog = [];
  const featuredIds = [];
  const genres = ['All','Comedy','Thriller','Adventure','Noir','Sci-Fi','Horror','Animation','Drama','Family','Mystery','Action'];
  let activeGenre = 'all', query = '', sortNewest = false, showingSaved = false, extraPage = 1, selected = catalog[0], heroIndex = 0;
  const tmdbKeyName = 'rapiflix-tmdb-key';
  let tmdbGenreMap = {};
  function tmdbKey(){try{return localStorage.getItem(tmdbKeyName)||'';}catch(_){return '';}}
  function isLocalPreview(){return ['localhost','127.0.0.1'].includes(location.hostname);}
  async function tmdbRequest(path,params={}){
    let url;
    if(isLocalPreview()){
      const key=tmdbKey();
      if(!key)throw new Error('For local testing, click Connect TMDB and add a temporary key. The deployed site uses a server-side secret.');
      url=new URL('https://api.themoviedb.org/3/'+path);
      url.searchParams.set('api_key',key);
    }else{
      url=new URL('/api/tmdb/'+path.split('/').map(encodeURIComponent).join('/'),location.origin);
    }
    Object.entries(params).forEach(([key,value])=>{if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value));});
    return fetch(url);
  }
  function setTmdbStatus(message){const el=$('#tmdbStatus');if(el)el.textContent=message;}
  function connectTmdb(){const value=window.prompt('Paste your temporary TMDB v3 API key. It is saved in this browser only, not in GitHub.',tmdbKey());if(value===null)return false;const key=value.trim();try{if(key)localStorage.setItem(tmdbKeyName,key);else localStorage.removeItem(tmdbKeyName);}catch(_){setTmdbStatus('Browser storage is unavailable.');return false;}if(!key){setTmdbStatus('TMDB key cleared from this browser.');return false;}return true;}
  async function loadTmdb(endpoint,label){
    if(isLocalPreview()&&!tmdbKey()){if(!connectTmdb())return;}
    setTmdbStatus('Loading current movie data…');
    try{
      try{const genreResponse=await tmdbRequest('genre/movie/list',{language:'en-US'});if(genreResponse.ok){const genreData=await genreResponse.json();(genreData.genres||[]).forEach(g=>tmdbGenreMap[g.id]=g.name);}}catch(_){}
      document.querySelectorAll('[data-tmdb]').forEach(b=>b.classList.toggle('active',b.dataset.tmdb===endpoint));
      const response=await tmdbRequest(endpoint,{language:'en-US',page:'1',region:'PK'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.status_message||data.error||'Movie catalogue request failed');
      const fresh=(data.results||[]).filter(m=>m&&m.id&&m.title).map(m=>({id:'tmdb-'+m.id,tmdbId:m.id,title:m.title,year:Number((m.release_date||'').slice(0,4))||0,runtime:'Runtime varies',genres:(m.genre_ids||[]).map(g=>tmdbGenreMap[g]).filter(Boolean).slice(0,3),desc:m.overview||'No synopsis is available yet.',poster:m.poster_path?'https://image.tmdb.org/t/p/w500'+m.poster_path:'',source:'https://www.themoviedb.org/movie/'+m.id,sourceName:'TMDB',kind:'tmdb',tag:(label||'TMDB').toUpperCase()}));
      for(let i=catalog.length-1;i>=0;i--)if(catalog[i].kind==='tmdb')catalog.splice(i,1);
      catalog.unshift(...fresh);if(fresh.length){featuredIds.splice(0,featuredIds.length,...fresh.slice(0,4).map(m=>m.id));heroIndex=0;updateHero(0);}activeGenre='all';showingSaved=false;query='';$('#searchInput').value='';$('#genreFilter').value='all';renderChips();render();
      setTmdbStatus('Loaded '+fresh.length+' '+String(label||'catalogue').toLowerCase()+' titles. Watchable films open in Rapiflix; commercial titles use licensed watch options.');
    }catch(error){
      setTmdbStatus('Movie catalogue unavailable: '+error.message+'. Check the TMDB server secret and redeploy if this is the live site.');
      console.error(error);
    }
  }
  async function searchTmdb(text){
    if(!text.trim())return;
    try{
      const response=await tmdbRequest('search/movie',{query:text.trim(),language:'en-US',region:'PK'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.status_message||data.error||'Search failed');
      if(query.trim()!==text.trim())return;
      const fresh=(data.results||[]).filter(m=>m&&m.id&&m.title).map(m=>({id:'tmdb-'+m.id,tmdbId:m.id,title:m.title,year:Number((m.release_date||'').slice(0,4))||0,runtime:'Runtime varies',genres:(m.genre_ids||[]).map(g=>tmdbGenreMap[g]).filter(Boolean).slice(0,3),desc:m.overview||'No synopsis is available yet.',poster:m.poster_path?'https://image.tmdb.org/t/p/w500'+m.poster_path:'',source:'https://www.themoviedb.org/movie/'+m.id,sourceName:'TMDB',kind:'tmdb',tag:'SEARCH RESULT'}));
      for(let i=catalog.length-1;i>=0;i--)if(catalog[i].kind==='tmdb')catalog.splice(i,1);
      catalog.unshift(...fresh);render();setTmdbStatus('Movie search results loaded. Commercial titles are not falsely labelled as playable.');
    }catch(error){
      setTmdbStatus('Movie search unavailable: '+error.message);
      console.error(error);
    }
  }
  let saved = new Set();
  try { saved = new Set(JSON.parse(localStorage.getItem('rapiflix-saved') || '[]')); } catch (_) {}
  const heroArt = $('#heroArt');
  const fallbackGradients = ['linear-gradient(130deg,#6b3c39,#201823 58%,#0a0a0f)','linear-gradient(130deg,#3b4e4d,#1a2026 58%,#09090d)','linear-gradient(130deg,#826b47,#33242c 58%,#0b0b10)','linear-gradient(130deg,#39445c,#241c2b 58%,#09090d)'];
  function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function imageUrl(m){return m.poster || (m.kind==='tmdb'?'':`${archive}/services/img/${m.id}`);}
  function updateHero(index=heroIndex){if(!featuredIds.length||!catalog.length){selected=null;heroIndex=0;$('#heroTitle').textContent='Find your next favourite film.';$('#heroKicker').textContent='CURRENT MOVIES & SERIES';$('#heroCopy').textContent='Load trending releases or search for a title. Available watch options depend on your region.';$('#heroYear').textContent='NEW';$('#heroGenre').textContent='Trending · Popular · Upcoming';$('.quality-pill').textContent='DISCOVERY';heroArt.style.backgroundImage='linear-gradient(130deg,#28203c,#09090d)';$('.index-current').textContent='01';$('.hero-index>span:last-child').textContent='01';$('#heroPlay').disabled=true;$('#heroPlay').innerHTML='<span>⌕</span> Find movies';return;}heroIndex=(index+featuredIds.length)%featuredIds.length;selected=byId(featuredIds[heroIndex])||catalog[0];heroIndex=featuredIds.indexOf(selected.id);$('#heroPlay').disabled=false;$('#heroTitle').innerHTML=escapeHtml(selected.title).replace(/ (.+)/,'<br><em>$1</em>');if(!$('#heroTitle').innerHTML.includes('<em>'))$('#heroTitle').innerHTML=escapeHtml(selected.title)+'<br><em>forever.</em>';$('#heroKicker').textContent=(selected.tag||'FEATURED FILM')+' · RAPIFLIX SELECTION';$('#heroCopy').textContent=selected.desc;$('#heroYear').textContent=selected.year||'—';$('#heroGenre').textContent=selected.genres.join(' · ');$('.quality-pill').textContent=selected.kind==='tmdb'?'WATCH OPTIONS':'IN-PLAYER';heroArt.style.backgroundImage=`linear-gradient(90deg,#09090d70,transparent),url("${imageUrl(selected)}")`;heroArt.onerror=null;heroArt.style.backgroundColor='#1b1721';$('.index-current').textContent=String(heroIndex+1).padStart(2,'0');$('.hero-index>span:last-child').textContent=String(featuredIds.length).padStart(2,'0');}
  function posterMarkup(m){return `<div class="poster-wrap" style="background:${fallbackGradients[Math.abs(m.title.length)%fallbackGradients.length]}"><div class="poster-fallback"><div><span>RAPIFLIX ARCHIVE</span>${escapeHtml(m.title)}</div></div><img loading="lazy" src="${escapeHtml(imageUrl(m))}" alt="Poster for ${escapeHtml(m.title)}" onerror="this.style.display='none'" onload="this.previousElementSibling.style.display='none'"><div class="poster-overlay"></div><span class="poster-badge">${escapeHtml(m.tag||'ARCHIVE PICK')}</span><button class="save-card ${saved.has(m.id)?'saved':''}" data-save="${escapeHtml(m.id)}" aria-label="${saved.has(m.id)?'Remove from':'Save to'} my list">${saved.has(m.id)?'♥':'♡'}</button><button class="card-play" data-details="${escapeHtml(m.id)}" aria-label="View ${escapeHtml(m.title)}">▶</button></div>`;}
  function render(){
    const needle=query.trim().toLowerCase();
    const matches=catalog.filter(m=>(activeGenre==='all'||m.genres.some(g=>g.toLowerCase()===activeGenre.toLowerCase()))&&(!needle||`${m.title} ${m.year} ${m.genres.join(' ')} ${m.desc}`.toLowerCase().includes(needle))&&(!showingSaved||saved.has(m.id)));
    let discovery=matches.filter(m=>m.kind==='tmdb');
    let freeFilms=matches.filter(m=>m.kind!=='tmdb');
    if(sortNewest){discovery=discovery.slice().sort((a,b)=>b.year-a.year);freeFilms=freeFilms.slice().sort((a,b)=>b.year-a.year);}
    const cardMarkup=(m,i)=>`<article class="movie-card" data-card="${escapeHtml(m.id)}" style="animation-delay:${Math.min(i%10,8)*35}ms">${posterMarkup(m)}<div class="card-info"><div class="card-title-row"><h3 class="card-title" title="${escapeHtml(m.title)}">${escapeHtml(m.title)}</h3><span class="card-year">${m.year||'—'}</span></div><div class="card-sub"><span>${escapeHtml(m.genres.slice(0,2).join(' · '))} · ${escapeHtml(m.runtime)}</span><span class="card-free">${m.kind==='tmdb'?'DISCOVER':'FREE FILM'}</span></div></div></article>`;
    const empty=(message)=>`<div class="empty-state"><strong>${message}</strong><p>${needle?'Try another title or clear your search.':'Load the catalogue or search for a title.'}</p></div>`;
    $('#movieGrid').innerHTML=discovery.length?discovery.map(cardMarkup).join(''):empty(needle?'No commercial titles found.':'Current movie discovery is loading.');
    $('#freeMovieGrid').innerHTML=freeFilms.length?freeFilms.map(cardMarkup).join(''):empty(showingSaved?'No saved free films yet.':'No rights-checked free films in this view yet.');
    $('#resultsCount').textContent=`${discovery.length} TITLE${discovery.length===1?'':'S'}`;
    $('#freeResultsCount').textContent=`${freeFilms.length} FILM${freeFilms.length===1?'':'S'}`;
    $('#resultsLabel').textContent=showingSaved?'YOUR SAVED LIST':needle?'COMMERCIAL SEARCH RESULTS':'CURRENT MOVIE DISCOVERY';
    $('#freeResultsLabel').textContent=showingSaved?'SAVED FREE FILMS':needle?'FREE-FILM SEARCH RESULTS':'RIGHTS-CHECKED FREE FILMS';
    $('#savedCount').textContent=saved.size;
    $('#loadMore').style.display=(!needle&&activeGenre==='all'&&!showingSaved)?'inline-flex':'none';
  }
  function renderChips(){const host=$('#genreChips');host.innerHTML=genres.map(g=>`<button class="chip ${(activeGenre===g.toLowerCase())?'selected':''}" data-genre="${g.toLowerCase()}">${g==='All'?'✳ All films':g}</button>`).join('');$('#genreFilter').innerHTML='<option value="all">All genres</option>'+genres.slice(1).map(g=>`<option value="${g.toLowerCase()}">${g}</option>`).join('');}
  function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2100);}
  function toggleSave(id){if(saved.has(id)){saved.delete(id);toast('Removed from your list');}else{saved.add(id);toast('Saved to your list');}try{localStorage.setItem('rapiflix-saved',JSON.stringify([...saved]));}catch(_){}render();if(selected?.id===id)$('#modalSave').textContent=saved.has(id)?'♥ Saved to my list':'♡ Save to my list';}
  function openDetails(id){const m=byId(id)||catalog.find(x=>x.id===id);if(!m)return;selected=m;$('#providerOptions').innerHTML='';if(m.kind==='tmdb')loadWatchProviders(m);else checkArchiveRights(m);$('#modalPoster').style.backgroundImage=`url("${imageUrl(m)}")`;$('#modalTitle').textContent=m.title;$('#modalKicker').textContent=m.tag||'RAPIFLIX SELECTION';$('#modalMeta').innerHTML=`<span>${m.year}</span><span>•</span><span>${escapeHtml(m.runtime||'Runtime varies')}</span><span>•</span><span>${escapeHtml(m.genres.join(' · '))}</span>`;$('#modalDescription').textContent=m.desc||'Explore this film from its original collection.';$('#modalSave').textContent=saved.has(m.id)?'♥ Saved to my list':'♡ Save to my list';$('#sourceNote').textContent=m.kind==='tmdb'?'Movie data from TMDB. View official watch options to check legitimate services in your region.':`Source: ${m.sourceName||'Internet Archive'}. Verify rights and availability for your intended use.`;$('#modalPlay').innerHTML=m.kind==='tmdb'?'↗ View watch options':'▶ Watch film';$('#modalBackdrop').hidden=false;document.body.classList.add('modal-open');$('#modalClose').focus();}
  const watchRegionKey='rapiflix-watch-region';
  function watchRegion(){return localStorage.getItem(watchRegionKey)||'PK';}
  async function loadWatchProviders(m){const host=$('#providerOptions');host.innerHTML='<p class="source-note">Checking streaming services for your region…</p>';const region=watchRegion();try{const r=await tmdbRequest('movie/'+encodeURIComponent(m.tmdbId)+'/watch/providers',{});const d=await r.json();if(!r.ok)throw new Error(d.status_message||'Provider lookup failed');const data=d.results?.[region];const providers=[...(data?.flatrate||[]).map(p=>({...p,kind:'Subscription'})),...(data?.free||[]).map(p=>({...p,kind:'Free'})),...(data?.ads||[]).map(p=>({...p,kind:'Ad-supported'})),...(data?.rent||[]).map(p=>({...p,kind:'Rent'})),...(data?.buy||[]).map(p=>({...p,kind:'Buy'}))];host.innerHTML='<div class="provider-head"><strong>Where to watch</strong><label>Region <select id="watchRegion"><option value="PK">Pakistan</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="IN">India</option><option value="CA">Canada</option><option value="AU">Australia</option></select></label></div>';$('#watchRegion').value=region;$('#watchRegion').addEventListener('change',e=>{localStorage.setItem(watchRegionKey,e.target.value);loadWatchProviders(m);});if(!providers.length){host.insertAdjacentHTML('beforeend','<p class="source-note">No provider listings were returned for '+region+'. Availability varies by country and can change.</p>');}else{const groups={};providers.forEach(p=>(groups[p.kind]??=[]).push(p));Object.entries(groups).forEach(([kind,items])=>{const row=document.createElement('div');row.className='provider-group';const title=document.createElement('span');title.className='provider-kind';title.textContent=kind;row.append(title);items.forEach(p=>{const item=document.createElement('span');item.className='provider-pill';if(p.logo_path){const img=document.createElement('img');img.src='https://image.tmdb.org/t/p/w92'+p.logo_path;img.alt='';item.append(img);}const name=document.createElement('span');name.textContent=p.provider_name;item.append(name);row.append(item);});host.append(row);});}if(data?.link){const link=document.createElement('a');link.href=data.link;link.target='_blank';link.rel='noreferrer';link.className='provider-source-link';link.textContent='Open official availability links ↗';host.append(link);}const credit=document.createElement('p');credit.className='source-note';credit.textContent='Availability data powered by JustWatch via TMDB. Check the service itself for current access and pricing.';host.append(credit);}catch(e){host.innerHTML='<p class="source-note">'+escapeHtml(e.message||'Provider data unavailable.')+'</p>';}}
  function hasExplicitStreamRights(metadata={}){
    const text=[metadata.licenseurl,metadata.license,metadata.rights].filter(Boolean).map(String).join(' ').toLowerCase();
    const statement=String(metadata.rights||'').toLowerCase();
    if(/all rights reserved|not for distribution|no permission to redistribute|copyrighted material/.test(text))return false;
    // Conflicting studio copyright claims take priority over a generic rights URL.
    if(/copyright\s*(?:©|&copy;)?\s*\d{4}\s+by\b/.test(statement))return false;
    return /public[\s-]?domain|creativecommons\.org\/(?:licenses|publicdomain)|creative commons|\bcc0\b/.test(text);
  }
  const archiveMetadataCache=new Map();
  async function fetchArchiveMetadata(id){
    if(archiveMetadataCache.has(id))return archiveMetadataCache.get(id);
    const request=fetch(archive+'/metadata/'+encodeURIComponent(id),{cache:'no-store'}).then(async response=>{
      if(!response.ok)throw new Error('Source metadata unavailable');
      return response.json();
    });
    archiveMetadataCache.set(id,request);
    try{return await request;}catch(error){archiveMetadataCache.delete(id);throw error;}
  }
  async function licensedPlayableArchiveDocs(docs,tag){
    const accepted=[];
    for(let start=0;start<docs.length;start+=6){
      const batch=await Promise.all(docs.slice(start,start+6).map(async d=>{
        try{
          const id=String(d.identifier||'');
          const title=Array.isArray(d.title)?d.title[0]:d.title;
          if(!id||!title||byId(id))return null;
          const metadata=await fetchArchiveMetadata(id);
          if(!hasExplicitStreamRights(metadata.metadata||{})||!archiveVideoFiles(metadata).length)return null;
          const yearValue=Array.isArray(d.year)?d.year[0]:d.year;
          const descValue=Array.isArray(d.description)?d.description[0]:d.description;
          return {id,title:String(title).slice(0,140),year:Number(yearValue)||0,runtime:'Runtime varies',genres:['Archive'],desc:String(descValue||'A film with a public-domain or Creative Commons rights statement.').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,500),poster:archive+'/services/img/'+encodeURIComponent(id),video:'',source:archive+'/details/'+encodeURIComponent(id),sourceName:'Internet Archive',kind:'archive-search',tag};
        }catch(_){return null;}
      }));
      accepted.push(...batch.filter(Boolean));
    }
    return accepted;
  }
  async function checkArchiveRights(m){const host=$('#providerOptions');if(!host)return;host.innerHTML='<p class="source-note">Checking source metadata and playable files…</p>';try{const d=await fetchArchiveMetadata(m.id);const md=d.metadata||{};const files=(d.files||[]).filter(f=>/\.(mp4|m4v|webm|ogv)$/i.test(f.name||'')&&!/(thumb|sample|trailer|preview|poster|torrent|storyboard)/i.test(f.name||''));const rights=md.licenseurl||md.rights||md.license||'';const explicit=hasExplicitStreamRights(md);host.innerHTML='<strong>Free-film source check</strong><p class="source-note">'+(files.length?'Compatible video file(s) found: '+files.length+'.':'No compatible video file was found in metadata.')+'</p><p class="source-note">'+(explicit?'Public-domain/Creative Commons wording is present in source metadata. Review its exact terms.':'No clear, non-conflicting public-domain or Creative Commons statement was found. Rapiflix will not play this item in-site.')+'</p>'+(rights?'<p class="source-note">Declared rights: '+escapeHtml(String(rights).slice(0,320))+'</p>':'')+'<a class="provider-source-link" href="'+escapeHtml(m.source||'https://archive.org/details/'+encodeURIComponent(m.id))+'" target="_blank" rel="noreferrer">Review original item and rights ↗</a>';}catch(e){host.innerHTML='<strong>Source check unavailable</strong><p class="source-note">Could not verify playable files or rights metadata. Open the original item page before relying on this source.</p>';}}
  const progressKey='rapiflix-watch-progress';
  function readProgress(id){try{return Number((JSON.parse(localStorage.getItem(progressKey)||'{}'))[id]||0);}catch(_){return 0;}}
  function writeProgress(id,time,duration){try{const all=JSON.parse(localStorage.getItem(progressKey)||'{}');if(duration>0&&time/duration>.96)delete all[id];else if(time>5)all[id]=Math.floor(time);localStorage.setItem(progressKey,JSON.stringify(all));}catch(_){}}
  function archiveVideoFiles(data){return (data.files||[]).filter(f=>/\.(mp4|m4v|webm|ogv)$/i.test(f.name||'')&&!/(thumb|sample|trailer|preview|poster|torrent|storyboard|\.ia\.)/i.test(f.name||'')&&!/^(metadata|__ia_thumb)/i.test(f.name||'')).map(f=>{const name=String(f.name||'');const ext=(name.split('.').pop()||'').toLowerCase();const height=Number(f.height)||0;const size=Number(f.size)||0;let score=ext==='mp4'||ext==='m4v'?300:ext==='webm'?220:160;if(height>=360&&height<=1080)score+=25;if(height>1080)score-=20;if(size>1500*1024*1024)score-=25;if(size>0&&size<4*1024*1024)score-=60;if(/512kb|lowres|tiny/i.test(name))score-=40;return {name,ext,size,height,score,url:archive+'/download/'+encodeURIComponent(data.metadata?.identifier||'')+'/'+name.split('/').map(encodeURIComponent).join('/')}}).sort((a,b)=>b.score-a.score||(a.size||Number.MAX_SAFE_INTEGER)-(b.size||Number.MAX_SAFE_INTEGER));}
  async function playFilm(m){
    if(!m)return;
    if(m.kind==='tmdb'){
      const watchUrl='https://www.themoviedb.org/movie/'+encodeURIComponent(m.tmdbId)+'/watch';
      window.open(watchUrl,'_blank','noopener,noreferrer');
      closeModal('#modalBackdrop');
      toast('Opened official watch options for this title');
      return;
    }
    $('#modalBackdrop').hidden=true;$('#playerBackdrop').hidden=false;document.body.classList.add('modal-open');
    $('#playerTitle').textContent=m.title;
    const frame=$('#playerFrame'), controls=$('#playerControls');
    frame.innerHTML='<div class="player-placeholder"><div class="live-dot"></div><strong>Preparing your film…</strong><p>Checking source rights, video files, and playback tracks.</p></div>';
    controls.innerHTML='<label>Source <select id="playerSource" disabled><option>Finding authorized sources…</option></select></label><label>Quality <select id="playerQuality" disabled><option>Auto</option></select></label><label>Subtitles <select id="playerSubtitles" disabled><option value="off">Off</option></select></label><label>Audio <select id="playerAudio" disabled><option value="default">Source default</option></select></label>';
    try{
      let metadata;
      try{metadata=await fetchArchiveMetadata(m.id);}catch(e){if(!m.video)throw e;}
      if(metadata&&!hasExplicitStreamRights(metadata.metadata||{}))throw new Error('This item has no clear, non-conflicting public-domain or Creative Commons rights statement. Rapiflix will not play it in-site.');
      let candidates=metadata?archiveVideoFiles(metadata).map(f=>({...f,provider:'Internet Archive',url:archive+'/download/'+encodeURIComponent(m.id)+'/'+f.name.split('/').map(encodeURIComponent).join('/')})):[];
      if(m.video&&!candidates.some(c=>c.url===m.video))candidates.push({name:'Authorized source stream',ext:'mp4',height:0,score:-10,provider:m.sourceName||'Authorized source',url:m.video});
      if(Array.isArray(m.authorizedSources)){
        for(const source of m.authorizedSources){
          if(source&&source.authorized===true&&typeof source.url==='string'&&/^https:\/\//i.test(source.url)){
            candidates.push({name:source.label||source.provider||'Authorized provider',provider:source.provider||'Authorized provider',height:Number(source.height)||0,ext:source.type||'mp4',score:Number(source.score)||0,url:source.url,subtitles:Array.isArray(source.subtitles)?source.subtitles:[],audioTracks:Array.isArray(source.audioTracks)?source.audioTracks:[]});
          }
        }
      }
      const unique=new Map();candidates.forEach(c=>{if(c.url&&!unique.has(c.url))unique.set(c.url,c);});candidates=[...unique.values()];
      if(!candidates.length)throw new Error('No compatible video file was found for this rights-checked free-film item.');
      let sourceIndex=0,lastSaved=0,restored=false,trackList=[],externalAudio=null;
      const video=document.createElement('video');
      video.controls=true;video.autoplay=true;video.playsInline=true;video.preload='metadata';video.setAttribute('aria-label','Now playing: '+m.title);
      frame.replaceChildren(video);
      const sourceSelect=$('#playerSource'),qualitySelect=$('#playerQuality'),subtitleSelect=$('#playerSubtitles'),audioSelect=$('#playerAudio');
      const heightLabel=h=>h?({2160:'2160p / 4K',1440:'1440p',1080:'1080p',720:'720p',576:'576p',480:'480p',360:'360p'}[h]||h+'p'):'Auto / source default';
      function setSourceOptions(){sourceSelect.innerHTML=candidates.map((c,i)=>'<option value="'+i+'">'+escapeHtml((c.provider||'Authorized source')+' · '+(c.name||'Video file'))+'</option>').join('');sourceSelect.disabled=candidates.length<2;}
      function setQualityOptions(){const heights=[...new Set(candidates.map(c=>Number(c.height)||0).filter(Boolean))].sort((a,b)=>b-a);qualitySelect.innerHTML='<option value="auto">Auto (best available)</option>'+heights.map(h=>'<option value="'+h+'">'+heightLabel(h)+'</option>').join('');qualitySelect.disabled=heights.length<2;}
      function attachSubtitles(candidate){
        video.querySelectorAll('track').forEach(t=>t.remove());
        const subtitles=[...(candidate.subtitles||[])];
        if(metadata)(metadata.files||[]).filter(f=>/\.vtt$/i.test(f.name||'')&&!/(sample|preview|thumb)/i.test(f.name||'')).forEach(f=>subtitles.push({label:String(f.name).split('/').pop().replace(/\.vtt$/i,'').replace(/[_-]+/g,' '),language:'und',src:archive+'/download/'+encodeURIComponent(m.id)+'/'+String(f.name).split('/').map(encodeURIComponent).join('/')}));
        subtitles.forEach((track,i)=>{if(!track||typeof track.src!=='string'||!/^https:\/\//i.test(track.src))return;const el=document.createElement('track');el.kind='subtitles';el.label=track.label||track.language||('Subtitle '+(i+1));el.srclang=track.language||'und';el.src=track.src;el.default=i===0;video.append(el);});
        trackList=[...video.querySelectorAll('track')];subtitleSelect.innerHTML='<option value="off">Off</option>'+trackList.map((t,i)=>'<option value="'+i+'">'+escapeHtml(t.label||('Subtitle '+(i+1)))+'</option>').join('');subtitleSelect.disabled=trackList.length===0;trackList.forEach(t=>{t.track.mode='disabled';});
      }
      function updateAudioOptions(){
        const tracks=video.audioTracks,items=[];
        if(tracks&&tracks.length){for(let i=0;i<tracks.length;i++)items.push({value:String(i),label:tracks[i].label||tracks[i].language||('Audio '+(i+1))});}
        (candidates[sourceIndex].audioTracks||[]).forEach((t,i)=>{if(t&&typeof t.src==='string'&&/^https:\/\//i.test(t.src))items.push({value:'external-'+i,label:t.label||t.language||('Audio '+(i+1))});});
        audioSelect.innerHTML='<option value="default">Source default</option>'+items.map(t=>'<option value="'+t.value+'">'+escapeHtml(t.label)+'</option>').join('');audioSelect.disabled=items.length===0;
      }
      function stopExternalAudio(){if(externalAudio){externalAudio.pause();externalAudio.removeAttribute('src');externalAudio.load();externalAudio=null;}video.muted=false;}
      function loadCandidate(index,manual=false){
        stopExternalAudio();sourceIndex=Math.max(0,Math.min(index,candidates.length-1));sourceSelect.value=String(sourceIndex);video.src=candidates[sourceIndex].url;video.load();attachSubtitles(candidates[sourceIndex]);updateAudioOptions();if(manual)video.play().catch(()=>{});
      }
      const showFailure=()=>{frame.innerHTML='<div class="player-placeholder"><strong>None of the available video sources played.</strong><p>Try another source or open the original film page.</p><a href="'+escapeHtml(m.source||archive+'/details/'+encodeURIComponent(m.id))+'" target="_blank" rel="noreferrer">Open original film page ↗</a></div>';};
      video.addEventListener('loadedmetadata',()=>{if(!restored){restored=true;const savedAt=readProgress(m.id);if(savedAt>10&&savedAt<video.duration-10){video.currentTime=savedAt;toast('Resumed where you left off');}}updateAudioOptions();});
      video.addEventListener('timeupdate',()=>{if(video.currentTime-lastSaved>=8){lastSaved=video.currentTime;writeProgress(m.id,video.currentTime,video.duration);}if(externalAudio&&!externalAudio.paused&&Math.abs(externalAudio.currentTime-video.currentTime)>.35)externalAudio.currentTime=video.currentTime;});
      video.addEventListener('play',()=>{if(externalAudio)externalAudio.play().catch(()=>{});});
      video.addEventListener('pause',()=>{if(externalAudio)externalAudio.pause();if(video.duration>0)writeProgress(m.id,video.currentTime,video.duration);});
      video.addEventListener('ended',()=>{if(externalAudio)externalAudio.pause();writeProgress(m.id,video.duration||video.currentTime,video.duration);});
      video.addEventListener('error',()=>{const next=candidates.findIndex((c,i)=>i>sourceIndex);if(next>=0){sourceIndex=next;sourceSelect.value=String(next);loadCandidate(next,true);}else showFailure();});
      setSourceOptions();setQualityOptions();
      sourceSelect.addEventListener('change',()=>loadCandidate(Number(sourceSelect.value),true));
      qualitySelect.addEventListener('change',()=>{const wanted=qualitySelect.value;if(wanted==='auto'){loadCandidate(0,true);return;}const match=candidates.findIndex(c=>String(Number(c.height)||0)===wanted);if(match>=0)loadCandidate(match,true);});
      subtitleSelect.addEventListener('change',()=>trackList.forEach((t,i)=>{t.track.mode=subtitleSelect.value===String(i)?'showing':'disabled';}));
      audioSelect.addEventListener('change',()=>{
        const tracks=video.audioTracks;
        if(tracks&&tracks.length&&audioSelect.value!=='default'&&!audioSelect.value.startsWith('external-')){for(let i=0;i<tracks.length;i++)tracks[i].enabled=audioSelect.value===String(i);stopExternalAudio();}
        else if(audioSelect.value.startsWith('external-')){
          const t=candidates[sourceIndex].audioTracks[Number(audioSelect.value.slice(9))];if(!t||!t.src)return;
          stopExternalAudio();externalAudio=new Audio(t.src);externalAudio.preload='auto';externalAudio.volume=video.volume;video.muted=true;
          externalAudio.addEventListener('loadedmetadata',()=>{externalAudio.currentTime=Math.min(video.currentTime,Math.max(0,externalAudio.duration-.1));if(!video.paused)externalAudio.play().catch(()=>{});});
          externalAudio.playbackRate=video.playbackRate;
        }else{stopExternalAudio();if(tracks)for(let i=0;i<tracks.length;i++)tracks[i].enabled=true;}
      });
      video.addEventListener('volumechange',()=>{if(externalAudio)externalAudio.volume=video.volume;});
      loadCandidate(0);
    }catch(e){frame.innerHTML='<div class="player-placeholder"><strong>Film unavailable in the embedded player.</strong><p>'+escapeHtml(e.message||'The original source did not respond.')+'</p><a href="'+escapeHtml(m.source||archive+'/details/'+encodeURIComponent(m.id))+'" target="_blank" rel="noreferrer">Open original film page ↗</a></div>';}
  }
  function closeModal(el){$(el).hidden=true;if($('#modalBackdrop').hidden&&$('#playerBackdrop').hidden)document.body.classList.remove('modal-open');}
  const archiveSearchCache=new Map();
  async function searchArchive(text){
    const term=String(text||'').trim();
    if(term.length<2)return;
    const cacheKey=term.toLowerCase();
    if(archiveSearchCache.has(cacheKey)){
      const cached=archiveSearchCache.get(cacheKey);
      for(const m of cached)if(!byId(m.id))catalog.unshift(m);
      render();return;
    }
    setTmdbStatus('Searching for full films with declared rights and playable files…');
    try{
      const safeTerm=term.replace(/["\\]/g,' ').replace(/\s+/g,' ').trim();
      const url=new URL(archive+'/advancedsearch.php');
      url.searchParams.set('q','title:("'+safeTerm+'") AND mediatype:movies');
      ['identifier','title','year','description'].forEach(field=>url.searchParams.append('fl[]',field));
      url.searchParams.set('rows','12');url.searchParams.set('page','1');
      url.searchParams.append('sort[]','downloads desc');url.searchParams.set('output','json');
      const response=await fetch(url);
      if(!response.ok)throw new Error('Internet Archive search did not respond');
      const data=await response.json();
      if(query.trim().toLowerCase()!==cacheKey)return;
      const found=await licensedPlayableArchiveDocs(data.response?.docs||[],'ARCHIVE SEARCH');
      if(query.trim().toLowerCase()!==cacheKey)return;
      archiveSearchCache.set(cacheKey,found);
      for(const m of found)if(!byId(m.id))catalog.unshift(m);
      render();
      setTmdbStatus(found.length?'Found '+found.length+' Archive title(s) with a compatible file and declared rights.':'No matching Archive titles passed the rights and playback check. Try a shorter title or another film.');
    }catch(error){
      setTmdbStatus('Archive search error: '+(error.message||'Could not search the source collection.'));
    }
  }
  async function verifyCuratedCatalog(){
    const originals=catalog.filter(m=>m.kind==='curated');
    const checked=await Promise.all(originals.map(async m=>{
      try{
        const data=await fetchArchiveMetadata(m.id);
        const rightsOk=hasExplicitStreamRights(data.metadata||{});
        const filesOk=archiveVideoFiles(data).length>0;
        return {id:m.id,ok:rightsOk&&filesOk};
      }catch(_){return {id:m.id,ok:false};}
    }));
    const rejected=new Set(checked.filter(x=>!x.ok).map(x=>x.id));
    if(rejected.size){
      for(let i=catalog.length-1;i>=0;i--)if(rejected.has(catalog[i].id))catalog.splice(i,1);
      const retained=featuredIds.filter(id=>byId(id));
      if(retained.length){featuredIds.splice(0,featuredIds.length,...retained);heroIndex=0;updateHero(0);}
      renderChips();render();
    }
    const retainedCount=originals.length-rejected.size;
    const liveTitles=catalog.filter(m=>m.kind==='tmdb').length;
    setTmdbStatus((liveTitles?'Current movie discovery is available. ':'')+'Search trending, popular, upcoming and now-playing releases. Movie cards are discovery unless a verified playable source is available.');
  }
  async function loadMore(){
    const btn=$('#loadMore');btn.disabled=true;btn.textContent='Checking more films…';
    try{
      const q='collection:feature_films AND mediatype:movies';
      const url=archive+'/advancedsearch.php?q='+encodeURIComponent(q)+'&fl[]=identifier&fl[]=title&fl[]=year&fl[]=description&rows=24&page='+extraPage+'&sort[]=downloads desc&output=json';
      const response=await fetch(url);
      if(!response.ok)throw new Error('Archive search did not respond');
      const data=await response.json();
      const found=await licensedPlayableArchiveDocs(data.response?.docs||[],'ARCHIVE DISCOVERY');
      let added=0;
      for(const m of found){if(byId(m.id))continue;catalog.push(m);added++;}
      extraPage++;activeGenre='all';$('#genreFilter').value='all';renderChips();render();
      toast(added?'Added '+added+' playable, rights-labelled films':'No new films on this page passed the rights and playback check');
    }catch(error){toast('Archive discovery is temporarily unavailable');console.error(error);}
    finally{btn.disabled=false;btn.innerHTML='Explore more classics <span>↗</span>';}
  }
  renderChips();updateHero(0);render();
  tmdbRequest('genre/movie/list',{language:'en-US'}).catch(()=>null).then(r=>r&&r.ok?r.json():null).then(d=>{(d&&d.genres||[]).forEach(g=>tmdbGenreMap[g.id]=g.name);}).catch(()=>{});
  if(!isLocalPreview())$('#tmdbConnect').textContent='Refresh catalogue';
  $('#tmdbConnect').addEventListener('click',()=>{if(isLocalPreview()){if(connectTmdb())loadTmdb('trending/movie/week','Trending');}else loadTmdb('trending/movie/week','Trending');});
  if(!isLocalPreview()||tmdbKey())loadTmdb('trending/movie/week','Trending');
  document.querySelector('.tmdb-actions').addEventListener('click',e=>{const b=e.target.closest('[data-tmdb]');if(b)loadTmdb(b.dataset.tmdb,b.textContent.trim());});
  let tmdbSearchTimer,archiveSearchTimer;
  $('#searchInput').addEventListener('input',e=>{query=e.target.value;render();clearTimeout(tmdbSearchTimer);clearTimeout(archiveSearchTimer);if(query.trim().length>=2){if(!isLocalPreview()||tmdbKey())tmdbSearchTimer=setTimeout(()=>searchTmdb(query),450);archiveSearchTimer=setTimeout(()=>searchArchive(query),650);}});
  $('#heroPlay').addEventListener('click',()=>{if(selected)playFilm(selected);else loadTmdb('trending/movie/week','Trending');});$('#heroDetails').addEventListener('click',()=>{if(selected)openDetails(selected.id);else loadTmdb('trending/movie/week','Trending');});$('#genreFilter').addEventListener('change',e=>{activeGenre=e.target.value;renderChips();render();});$('#genreChips').addEventListener('click',e=>{const b=e.target.closest('[data-genre]');if(!b)return;activeGenre=b.dataset.genre;$('#genreFilter').value=activeGenre;renderChips();render();});$('#sortButton').addEventListener('click',()=>{sortNewest=!sortNewest;$('#sortButton').innerHTML=`↕ <span>${sortNewest?'Newest first':'Featured'}</span>`;render();});$('#movieGrid').addEventListener('click',e=>{const saveBtn=e.target.closest('[data-save]');if(saveBtn){e.stopPropagation();toggleSave(saveBtn.dataset.save);return;}const details=e.target.closest('[data-details]');if(details){openDetails(details.dataset.details);return;}const card=e.target.closest('[data-card]');if(card)openDetails(card.dataset.card);});$('#savedToggle').addEventListener('click',()=>{showingSaved=!showingSaved;$('#savedToggle').style.borderColor=showingSaved?'var(--accent)':'';$('#savedToggle').innerHTML=`${showingSaved?'♥':'♡'} <span class="saved-count" id="savedCount">${saved.size}</span>`;document.querySelector('#library').scrollIntoView({behavior:'smooth'});render();});$('#loadMore').addEventListener('click',loadMore);$('#modalClose').addEventListener('click',()=>closeModal('#modalBackdrop'));$('#modalBackdrop').addEventListener('click',e=>{if(e.target===$('#modalBackdrop'))closeModal('#modalBackdrop');});$('#modalPlay').addEventListener('click',()=>playFilm(selected));$('#modalSave').addEventListener('click',()=>toggleSave(selected.id));$('#playerClose').addEventListener('click',()=>{const v=$('#playerFrame video');if(v)v.pause();$('#playerFrame').replaceChildren();closeModal('#playerBackdrop');});$('#playerBackdrop').addEventListener('click',e=>{if(e.target===$('#playerBackdrop')){$('#playerClose').click();}});$('#menuButton').addEventListener('click',()=>$('.nav-links').classList.toggle('open'));$('.nav-links').addEventListener('click',e=>{if(e.target.closest('a'))$('.nav-links').classList.remove('open');});document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#playerBackdrop').hidden)$('#playerClose').click();else closeModal('#modalBackdrop');}if(e.key==='/'&&!/input|textarea/i.test(document.activeElement.tagName)){e.preventDefault();$('#searchInput').focus();}});
  verifyCuratedCatalog().catch(error=>console.error('Rapiflix preflight failed',error));
  // Gentle hero rotation, paused when the visitor is interacting with the hero or has reduced motion enabled.
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){setInterval(()=>{if(featuredIds.length&&!document.hidden&&!document.body.classList.contains('modal-open')&&!$('#searchInput').value)updateHero((heroIndex+1)%featuredIds.length);},12000);}
})();
