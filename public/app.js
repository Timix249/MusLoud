let format='mp3', mode='search', selected=null, searchController=null, prepared=null;
const status=document.querySelector('#status');
const download=document.querySelector('#download');
const result=document.querySelector('#searchResult');
const saveActions=document.querySelector('#saveActions');
const saveFile=document.querySelector('#saveFile');
const shareFile=document.querySelector('#shareFile');
const listen=document.querySelector('#listen');
const listeningPanel=document.querySelector('#listeningPanel');
const localPlayer=document.querySelector('#localPlayer');
let listeningUrl=null;
localPlayer.onerror=()=>{if(localPlayer.getAttribute('src'))status.textContent='Dein Browser kann diese Datei nicht abspielen. Konvertiere sie zuerst in MP3.';};
function stopListening(){
  localPlayer.pause();localPlayer.removeAttribute('src');localPlayer.load();localPlayer.hidden=true;
  document.querySelector('#soundcloudPlayer').replaceChildren();
  if(listeningUrl)URL.revokeObjectURL(listeningUrl);
  listeningUrl=null;listeningPanel.hidden=true;listen.setAttribute('aria-expanded','false');
}
document.querySelector('#closePlayer').onclick=stopListening;
listen.onclick=()=>{
  stopListening();
  if(mode==='search'){
    if(!selected)return;
    const url=new URL(selected.url);
    if(url.protocol!=='https:'||url.hostname!=='soundcloud.com'){status.textContent='Dieser Track kann nicht eingebettet werden.';return;}
    const iframe=document.createElement('iframe');
    iframe.title='SoundCloud: '+selected.title;
    iframe.src='https://w.soundcloud.com/player/?'+new URLSearchParams({url:url.href,auto_play:'false',hide_related:'true',show_comments:'false',show_user:'true',show_reposts:'false',visual:'false',color:'#ca74f5'});
    iframe.allow='autoplay';iframe.height='166';iframe.referrerPolicy='strict-origin-when-cross-origin';
    document.querySelector('#soundcloudPlayer').append(iframe);
    document.querySelector('#playingTitle').textContent=selected.title;
    document.querySelector('.player-hint').hidden=false;
  }else{
    const file=document.querySelector('#audio').files[0];if(!file)return;
    listeningUrl=URL.createObjectURL(file);localPlayer.src=listeningUrl;localPlayer.hidden=false;
    document.querySelector('#playingTitle').textContent=file.name;
    document.querySelector('.player-hint').hidden=true;
  }
  listeningPanel.hidden=false;listen.setAttribute('aria-expanded','true');
  listeningPanel.scrollIntoView({behavior:'smooth',block:'nearest'});
};

function clearPrepared(){
  if(prepared) URL.revokeObjectURL(prepared.url);
  prepared=null;
  saveActions.hidden=true;
  saveFile.removeAttribute('href');
  shareFile.hidden=true;
}
async function apiError(response){
  let data;
  try {data=await response.json();}
  catch {return Error('Der Server antwortet nicht korrekt (HTTP '+response.status+'). Bitte später erneut versuchen.');}
  return Error((data.error||'Die Anfrage ist fehlgeschlagen.')+(data.code?' ['+data.code+']':''));
}
function setMode(next){
  mode=next;
  stopListening();
  listen.disabled=mode==='search'?!selected:!document.querySelector('#audio').files[0];
  clearPrepared();
  document.querySelectorAll('.tab').forEach(button=>{
    const active=button.dataset.mode===mode;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  document.querySelector('#searchForm').hidden=mode!=='search';
  document.querySelector('#uploadForm').hidden=mode!=='upload';
  result.hidden=mode!=='search'||!result.childElementCount;
  download.textContent=mode==='upload'?'↓ DATEI KONVERTIEREN':'↓ TRACK HERUNTERLADEN';
  status.textContent=mode==='upload'?'Deine Datei wird nach der Konvertierung gelöscht.':selected?'Gewählt: '+selected.title:'Suche einen Song und wähle deinen Treffer aus.';
}
document.querySelectorAll('.tab').forEach(button=>button.onclick=()=>setMode(button.dataset.mode));
document.querySelectorAll('.format').forEach(button=>button.onclick=()=>{
  clearPrepared();
  format=button.dataset.format;
  document.querySelectorAll('.format').forEach(other=>{
    other.classList.toggle('selected',other===button);
    other.setAttribute('aria-pressed',String(other===button));
  });
});
document.querySelector('#audio').onchange=event=>{
  stopListening();listen.disabled=!event.target.files[0];
  clearPrepared();
  document.querySelector('#fileLabel').textContent=event.target.files[0]?.name||'Eigene Audiodatei auswählen';
};
function showTracks(tracks){
  result.replaceChildren();result.hidden=false;
  if(!tracks.length){result.textContent='Keine passenden Tracks gefunden. Versuche einen anderen Namen oder einen direkten SoundCloud-Link.';return;}
  const group=document.createElement('div');group.className='track-list';
  group.setAttribute('role','group');group.setAttribute('aria-label','Suchergebnisse');
  tracks.forEach(track=>{
    const button=document.createElement('button');button.type='button';button.className='track';button.setAttribute('aria-pressed','false');
    const icon=document.createElement('span');icon.className='track-icon';icon.textContent='☁';icon.setAttribute('aria-hidden','true');
    const info=document.createElement('span');info.className='track-info';
    const title=document.createElement('strong');title.textContent=track.title;
    const detail=document.createElement('small');const seconds=Math.floor(track.duration||0);
    detail.textContent=[track.artist,'SoundCloud',seconds?Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):null].filter(Boolean).join(' · ');
    info.append(title,detail);
    const check=document.createElement('span');check.className='track-check';check.textContent='○';check.setAttribute('aria-hidden','true');
    button.append(icon,info,check);
    button.onclick=()=>{
      stopListening();listen.disabled=false;
      clearPrepared();selected=track;
      group.querySelectorAll('.track').forEach(other=>{
        other.classList.toggle('chosen',other===button);other.setAttribute('aria-pressed',String(other===button));
        other.querySelector('.track-check').textContent=other===button?'●':'○';
      });
      status.textContent='Gewählt: '+track.title+'. Wähle dein Format und lade den Track herunter.';
    };
    group.append(button);
  });
  result.append(group);
}
document.querySelector('#searchForm').onsubmit=async event=>{
  event.preventDefault();
  const query=document.querySelector('#query').value.trim();if(!query)return;
  stopListening();listen.disabled=true;
  clearPrepared();searchController?.abort();
  const controller=new AbortController();searchController=controller;
  const button=document.querySelector('.go');button.disabled=true;selected=null;
  result.replaceChildren();result.hidden=true;status.textContent='◌ Suche auf SoundCloud läuft …';
  try{
    const response=await fetch('/api/search?'+new URLSearchParams({q:query}),{signal:controller.signal});
    if(!response.ok)throw await apiError(response);
    const data=await response.json();
    showTracks(data.tracks);status.textContent=data.tracks.length?'Wähle einen Treffer aus.':'Keine Treffer gefunden.';
  }catch(error){if(error.name!=='AbortError')status.textContent=error.message||'Die Suche ist fehlgeschlagen.';}
  finally{if(searchController===controller){button.disabled=false;searchController=null;}}
};
shareFile.onclick=async()=>{
  if(!prepared?.file)return;
  try {await navigator.share({files:[prepared.file]});}
  catch(error){if(error.name!=='AbortError')status.textContent='Teilen ist nicht verfügbar. Tippe stattdessen auf „Datei speichern“.';}
};
saveFile.onclick=()=>{status.textContent='Falls sich die Datei öffnet: Im Teilen-Menü „In Dateien sichern“ wählen.';};
download.onclick=async()=>{
  let body,headers={},endpoint,name;
  if(mode==='upload'){
    const file=document.querySelector('#audio').files[0];
    if(!file){status.textContent='Bitte zuerst eine Audiodatei auswählen.';return;}
    if(file.size>80*1024*1024){status.textContent='Die Datei darf maximal 80 MB groß sein.';return;}
    body=new FormData();body.append('audio',file);body.append('format',format);
    endpoint='/api/convert';name=file.name.replace(/\.[^.]+$/,'');
  }else{
    if(!selected){status.textContent='Bitte zuerst suchen und einen Track auswählen.';document.querySelector('#query').focus();return;}
    body=JSON.stringify({token:selected.token,format});headers={'Content-Type':'application/json'};
    endpoint='/api/download';name=selected.title;
  }
  clearPrepared();
  const outputFormat=format;
  download.disabled=true;download.textContent='◌ TRACK WIRD VORBEREITET …';
  status.textContent='Dein Track wird geladen und konvertiert. Lass diese Seite kurz geöffnet.';
  document.querySelector('#studio').setAttribute('aria-busy','true');
  // Keep the selected mode and format stable until the prepared file is ready.
  const controls=document.querySelectorAll('.tab,.format,.go,.track,#query,#audio');
  controls.forEach(control=>control.disabled=true);
  try{
    const response=await fetch(endpoint,{method:'POST',headers,body});
    if(!response.ok)throw await apiError(response);
    const blob=await response.blob();
    if(!blob.size)throw Error('Die heruntergeladene Datei ist leer. Bitte erneut versuchen.');
    const filename=(name.replace(/[\\/:*?"<>|]/g,'').slice(0,100)||'MusLoud')+'.'+outputFormat;
    const url=URL.createObjectURL(blob);
    prepared={url,file:new File([blob],filename,{type:blob.type||'application/octet-stream'})};
    saveFile.href=url;saveFile.download=filename;
    document.querySelector('#saveName').textContent=filename;
    saveActions.hidden=false;
    shareFile.hidden=!(navigator.share&&navigator.canShare?.({files:[prepared.file]}));
    status.textContent='✓ Fertig! Tippe auf „Datei speichern“.';
    if(window.matchMedia('(pointer: fine)').matches)saveFile.click();
    else saveActions.scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(error){status.textContent=error.message||'Download fehlgeschlagen. Bitte erneut versuchen.';}
  finally{
    download.disabled=false;controls.forEach(control=>control.disabled=false);
    download.textContent=mode==='upload'?'↓ DATEI KONVERTIEREN':'↓ TRACK HERUNTERLADEN';
    document.querySelector('#studio').removeAttribute('aria-busy');
  }
};
window.addEventListener('pagehide',()=>{clearPrepared();stopListening();});
