import express from 'express';
import multer from 'multer';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const app = express();
const upload = multer({dest: tmpdir(), limits:{fileSize:80*1024*1024,files:1}});
app.disable('x-powered-by');
app.use(express.static('public'));
app.get('/api/health', (_,res)=>res.json({status:'ok'}));
app.post('/api/convert', upload.single('audio'), async(req,res)=>{
 const formats={mp3:['libmp3lame','-b:a','320k'],wav:['pcm_s16le'],flac:['flac'],ogg:['libvorbis']};
 const format=req.body.format;
 if(!req.file) return res.status(400).json({error:'Bitte eine Audiodatei auswählen.'});
 let dir;
 try {
  if(!formats[format]) return res.status(400).json({error:'Unbekanntes Format.'});
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
app.use((err,req,res,next)=>res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'Die Datei darf maximal 80 MB groß sein.':'Upload fehlgeschlagen.'}));
app.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('MusLoud listening on port '+(process.env.PORT||3000)));
