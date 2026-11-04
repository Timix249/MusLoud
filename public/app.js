let format='mp3',mode='search',source='youtube',selected=null,searchController=null;
const status=document.querySelector('#status');
const download=document.querySelector('#download');
const result=document.querySelector('#searchResult');
function setMode(next){
 mode=next;
 document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
 document.querySelector('#searchForm').hidden=mode!=='search';
 document.querySelector('#uploadForm').hidden=mode!=='upload';
 result.hidden=mode!=='search'||!result.childElementCount;
 download.textContent=mode==='upload'?'↓ DATEI KONVERTIEREN':'↓ TRACK HERUNTERLADEN';
 status.textContent=mode==='upload'?'Deine Datei wird nach der Konvertierung gelöscht.':selected?'Gewählt: '+selected.title:'Suche einen Song und wähle deinen Treffer aus.';
}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
document.querySelectorAll('.source').forEach(b=>b.onclick=()=>{
 source=b.dataset.source;searchController?.abort();selected=null;result.replaceChildren();result.hidden=true;
 document.querySelectorAll('.source').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});
 status.textContent='Suche auf '+(source==='youtube'?'YouTube':'SoundCloud')+'.';
});
document.querySelectorAll('.format').forEach(b=>{b.setAttribute('aria-pressed',String(b.classList.contains('selected')));b.onclick=()=>{
 format=b.dataset.format;document.querySelectorAll('.format').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});
};});
document.querySelector('#audio').onchange=e=>document.querySelector('#fileLabel').textContent=e.target.files[0]?.name||'Track hier auswählen';
function showTracks(tracks){
 result.replaceChildren();result.hidden=false;
 if(!tracks.length){result.textContent='Keine passenden Tracks gefunden. Versuche einen anderen Namen oder einen direkten Track-Link.';return;}
 const group=document.createElement('div');group.className='track-list';group.setAttribute('role','group');group.setAttribute('aria-label','Suchergebnisse');
 tracks.forEach(track=>{
  const button=document.createElement('button');button.type='button';button.className='track';button.setAttribute('aria-pressed','false');
  const icon=document.createElement('span');icon.className='track-icon';icon.textContent=track.source==='YouTube'?'▶':'☁';
  const info=document.createElement('span');info.className='track-info';
  const title=document.createElement('strong');title.textContent=track.title;
  const detail=document.createElement('small');const seconds=Math.floor(track.duration||0);detail.textContent=[track.artist,track.source,seconds?Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):null].filter(Boolean).join(' · ');
  info.append(title,detail);const check=document.createElement('span');check.className='track-check';check.textContent='○';button.append(icon,info,check);
  button.onclick=()=>{
   selected=track;group.querySelectorAll('.track').forEach(b=>{b.classList.toggle('chosen',b===button);b.setAttribute('aria-pressed',String(b===button));b.querySelector('.track-check').textContent=b===button?'●':'○';});
   status.textContent='Gewählt: '+track.title+'. Wähle dein Format und lade den Track herunter.';
  };group.append(button);
 });result.append(group);
}
document.querySelector('#searchForm').onsubmit=async e=>{
 e.preventDefault();const query=document.querySelector('#query').value.trim();if(!query)return;
 searchController?.abort();const controller=new AbortController();searchController=controller;
 const button=document.querySelector('.go');button.disabled=true;selected=null;result.replaceChildren();result.hidden=true;status.textContent='◌ Suche läuft …';
 try{
  const response=await fetch('/api/search?'+new URLSearchParams({q:query,source}),{signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error);
  showTracks(data.tracks);status.textContent=data.tracks.length?'Wähle einen Treffer aus.':'Keine Treffer gefunden.';
 }catch(e){if(e.name!=='AbortError')status.textContent=e.message||'Die Suche ist fehlgeschlagen.';}
 finally{if(searchController===controller){button.disabled=false;searchController=null;}}
};
download.onclick=async()=>{
 let body,headers={},endpoint,name;
 if(mode==='upload'){
  const file=document.querySelector('#audio').files[0];if(!file){status.textContent='Bitte zuerst eine Audiodatei auswählen.';return;}
  if(file.size>80*1024*1024){status.textContent='Die Datei darf maximal 80 MB groß sein.';return;}
  body=new FormData();body.append('audio',file);body.append('format',format);endpoint='/api/convert';name=file.name.replace(/\.[^.]+$/,'');
 }else{
  if(!selected){status.textContent='Bitte zuerst suchen und einen Track auswählen.';document.querySelector('#query').focus();return;}
  body=JSON.stringify({token:selected.token,format});headers={'Content-Type':'application/json'};endpoint='/api/download';name=selected.title;
 }
 const outputFormat=format;download.disabled=true;download.textContent='◌ DOWNLOAD WIRD VORBEREITET …';status.textContent='Dein Track wird geladen und konvertiert. Das kann etwas dauern.';
 try{
  const response=await fetch(endpoint,{method:'POST',headers,body});if(!response.ok){const error=await response.json();throw Error(error.error);}
  const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=(name.replace(/[\\/:*?"<>|]/g,'').slice(0,100)||'MusLoud')+'.'+outputFormat;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);status.textContent='✓ Fertig! Dein Download wurde gestartet.';
 }catch(e){status.textContent=e.message||'Download fehlgeschlagen. Bitte erneut versuchen.';}
 finally{download.disabled=false;download.textContent=mode==='upload'?'↓ DATEI KONVERTIEREN':'↓ TRACK HERUNTERLADEN';}
};
