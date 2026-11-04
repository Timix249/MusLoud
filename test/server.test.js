import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
test('HTTP search, signed selection, real four-format conversion, and failures', {timeout:30000}, async()=>{
 const dir=await mkdtemp(join(tmpdir(),'musloud-test-'));
 const fixture=join(dir,'fixture.wav');
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=1',fixture]);
 const stub=join(dir,'downloader');
 await writeFile(stub,`#!${process.execPath}\nimport {copyFileSync} from 'node:fs';\nconst args=process.argv.slice(2);\nif(args.includes('--dump-single-json'))console.log(JSON.stringify({title:'Test track',uploader:'Fixture',duration:1,webpage_url:'https://www.youtube.com/watch?v=abcdefghijk'}));\nelse{const p=args[args.indexOf('--output')+1].replace('%(ext)s','wav');copyFileSync(process.env.TEST_AUDIO,p);}\n`,{mode:0o755});
 // Standalone executable uses .mjs syntax through Node's module detection.
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),YTDLP_PATH:stub,TEST_AUDIO:fixture},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',()=>reject(Error('Server exited')));});
  const base=`http://127.0.0.1:${port}`;
  assert.equal((await fetch(base+'/api/health')).status,200);
  assert.match(await(await fetch(base)).text(),/SoundCloud/);
  let r=await fetch(base+'/api/search?source=youtube&q=test');assert.equal(r.status,200);const {tracks}=await r.json();assert.equal(tracks.length,1);assert.equal(tracks[0].title,'Test track');
  const post=(body)=>fetch(base+'/api/download',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({token:'forged',format:'mp3'})).status,400);
  assert.equal((await post({token:tracks[0].token,format:'__proto__'})).status,400);
  assert.equal((await fetch(base+'/api/search?source=youtube&q=https://127.0.0.1/private')).status,400);
  for(const [format,codec] of [['mp3','mp3'],['wav','pcm_s16le'],['flac','flac'],['ogg','vorbis']]){
   r=await post({token:tracks[0].token,format});assert.equal(r.status,200);
   assert.match(r.headers.get('content-disposition'),/attachment/);
   const output=join(dir,'result.'+format);await writeFile(output,Buffer.from(await r.arrayBuffer()));
   const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_name','-of','json',output]));assert.equal(probe.streams[0].codec_name,codec);
  }
  const invalid=new FormData();invalid.append('audio',new Blob(['not audio']),'bad.wav');invalid.append('format','mp3');
  assert.equal((await fetch(base+'/api/convert',{method:'POST',body:invalid})).status,422);
 }finally{server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));await rm(dir,{recursive:true,force:true});}
});
