import express from 'express';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { mkdtemp, rm, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { formats, searchTarget, trackUrl, issueToken, readToken, ytdlp, run, sourceFailure } from './media.js';
const app = express();
app.use(express.json({limit:'8kb'}));
let activeSearches=0, activeConversions=0;
function conversionSlot(req,res,next){
 if(activeConversions>=1)return res.status(429).json({error:'Der Server verarbeitet gerade einen Track. Bitte gleich erneut versuchen.'});
 activeConversions++;let released=false;const release=()=>{if(!released){released=true;activeConversions--;}};
 res.once('finish',release);res.once('close',release);next();
}
const upload = multer({dest: tmpdir(), limits:{fileSize:80*1024*1024,files:1}});
app.disable('x-powered-by');
app.use(express.static('public'));
const revision=/^[a-f0-9]{7,40}$/.test(process.env.RENDER_GIT_COMMIT||'')?process.env.RENDER_GIT_COMMIT.slice(0,7):'local';
app.get('/api/health', (_,res)=>res.json({status:'ok',revision}));
function reportSourceFailure(res,error,operation){
 const failure=sourceFailure(error);const requestId=randomUUID();
 console.error(JSON.stringify({event:'media_failure',operation,code:failure.code,requestId,revision}));
 if(!res.headersSent&&!res.destroyed)res.status(502).json({...failure,requestId});
}
app.post('/api/convert', conversionSlot, upload.single('audio'), async(req,res)=>{
 const format=req.body.format;
 if(!req.file) return res.status(400).json({error:'Bitte eine Audiodatei auswählen.'});
 let dir;
 try {
  if(!Object.hasOwn(formats,format)) return res.status(400).json({error:'Unbekanntes Format.'});
  dir=await mkdtemp(join(tmpdir(),'musloud-'));
  const output=join(dir,`audio.${format}`);
  await new Promise((resolve,reject)=>{
   const p=spawn('ffmpeg',['-nostdin','-v','error','-y','-i',req.file.path,'-vn','-map_metadata','-1','-c:a',...formats[format],output]);
   const timer=setTimeout(()=>{p.kill('SIGKILL');reject(new Error('Die Konvertierung dauert zu lange.'));},120000);
   p.on('error',e=>{clearTimeout(timer);reject(e)});
   p.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('Diese Datei konnte nicht als Audio gelesen werden.'))});
  });
  await new Promise(resolve=>res.download(output,`MusLoud.${format}`,()=>resolve()));
 } catch(e){if(!res.headersSent) res.status(422).json({error:e.message});}
 finally {await rm(req.file.path,{force:true});if(dir)await rm(dir,{recursive:true,force:true});}
});
app.get('/api/search', async(req,res)=>{
 let target;
 try {target=searchTarget(req.query.q,req.query.source||'youtube');}
 catch(e){return res.status(400).json({error:e.message});}
 if(activeSearches>=2)return res.status(429).json({error:'Die Suche ist gerade ausgelastet. Bitte gleich erneut versuchen.'});
 activeSearches++;
 const controller=new AbortController();res.once('close',()=>controller.abort());
 try{
  const raw=await ytdlp(['--flat-playlist','--dump-single-json','--skip-download','--',target],{signal:controller.signal});
  const data=JSON.parse(raw);
  const tracks=(data.entries||[data]).slice(0,5).flatMap(item=>{
   try {
    const url=trackUrl(item.webpage_url||item.url);
    if(item.is_live||item.duration>1200)return [];
    return [{title:String(item.title||'Unbekannter Track').slice(0,250),artist:String(item.uploader||item.channel||'').slice(0,150),duration:item.duration||null,source:url.includes('youtube.com')?'YouTube':'SoundCloud',url,token:issueToken(url)}];
   }catch{return [];}
  });
  res.json({tracks});
 }catch(e){reportSourceFailure(res,e,'search');}
 finally{activeSearches--;}
});
app.post('/api/download',conversionSlot,async(req,res)=>{
 let url;
 const format=req.body?.format;
 try{if(!Object.hasOwn(formats,format))throw Error('Unbekanntes Format.');url=readToken(req.body.token);}
 catch(e){return res.status(400).json({error:e.message});}
 let dir;
 const controller=new AbortController();res.once('close',()=>controller.abort());
 try{
  dir=await mkdtemp(join(tmpdir(),'musloud-online-'));
  const options={signal:controller.signal,timeout:120000};
  const meta=JSON.parse(await ytdlp(['--dump-single-json','--skip-download','--',url],options));
  if(meta.is_live||!Number.isFinite(meta.duration)||meta.duration<=0||meta.duration>1200)throw Error('Bitte einen Track bis 20 Minuten auswählen. Livestreams werden nicht unterstützt.');
  if(meta._type==='playlist')throw Error('Bitte einen einzelnen Track auswählen.');
  await ytdlp(['--format','bestaudio/best','--max-filesize','80M','--match-filter','!is_live & duration <= 1200','--concurrent-fragments','1','--fragment-retries','1','--no-progress','--output',join(dir,'source.%(ext)s'),'--',url],options);
  const files=(await readdir(dir)).filter(f=>/^source\.[a-zA-Z0-9]+$/.test(f));
  if(files.length!==1)throw Error('Keine herunterladbare Audiodatei gefunden.');
  const input=join(dir,files[0]);
  if((await stat(input)).size>80*1024*1024)throw Error('Dieser Track überschreitet das Größenlimit.');
  const output=join(dir,`audio.${format}`);
  await run('ffmpeg',['-nostdin','-v','error','-y','-i',input,'-vn','-t','1200','-map_metadata','-1','-c:a',...formats[format],'-fs','220000000',output],options);
  if((await stat(output)).size>=220000000)throw Error('Die Ausgabedatei ist zu groß. Bitte MP3 oder OGG wählen.');
  const name=String(meta.title||'MusLoud').replace(/[^\p{L}\p{N} _-]/gu,'').trim().slice(0,100)||'MusLoud';
  await new Promise(resolve=>res.download(output,`${name}.${format}`,()=>resolve()));
 }catch(e){reportSourceFailure(res,e,'download');}
 finally{if(dir)await rm(dir,{recursive:true,force:true});}
});
app.use((err,req,res,next)=>res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'Die Datei darf maximal 80 MB groß sein.':'Upload fehlgeschlagen.'}));
app.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('MusLoud listening on port '+(process.env.PORT||3000)));
