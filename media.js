import { spawn } from 'node:child_process';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
const key = randomBytes(32);
export const formats = {mp3:['libmp3lame','-b:a','320k'],wav:['pcm_s16le'],flac:['flac'],ogg:['libvorbis']};
export function trackUrl(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.port) throw Error('Ungültiger Link.');
  const host = u.hostname;
  if (['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be'].includes(host)) {
    const id = host === 'youtu.be' ? u.pathname.slice(1) : u.pathname === '/watch' ? u.searchParams.get('v') : /^\/(?:shorts|embed)\/([\w-]{11})\/?$/.exec(u.pathname)?.[1];
    if (!/^[\w-]{11}$/.test(id || '')) throw Error('Bitte einen einzelnen YouTube-Track verlinken.');
    return `https://www.youtube.com/watch?v=${id}`;
  }
  if (['soundcloud.com','www.soundcloud.com'].includes(host) && /^\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/?$/.test(u.pathname) && !/^\/(sets|discover|search)\//.test(u.pathname)) return `https://soundcloud.com${u.pathname.replace(/\/$/,'')}`;
  throw Error('Bitte einen YouTube- oder SoundCloud-Track verwenden. Playlists werden noch nicht unterstützt.');
}
export function searchTarget(query, source) {
  if (typeof query !== 'string' || !query.trim() || query.length > 250) throw Error('Bitte einen Namen oder Track-Link eingeben (max. 250 Zeichen).');
  if (!['youtube','soundcloud'].includes(source)) throw Error('Unbekannte Musikquelle.');
  query = query.trim();
  if (/^[a-z][\w+.-]*:/i.test(query) || /^(www\.|\w+\.)[^ ]*\//.test(query)) return trackUrl(query);
  return `${source === 'youtube' ? 'ytsearch5' : 'scsearch5'}:${query}`;
}
export function issueToken(url) {
  const data = Buffer.from(JSON.stringify({url:trackUrl(url),expires:Date.now()+30*60*1000})).toString('base64url');
  return data+'.'+createHmac('sha256',key).update(data).digest('base64url');
}
export function readToken(token) {
  if (typeof token !== 'string' || token.length > 2000) throw Error('Bitte erneut suchen und einen Track auswählen.');
  const [data,sig,...extra] = token.split('.');
  const expected = createHmac('sha256',key).update(data||'').digest();
  const provided = Buffer.from(sig||'','base64url');
  if (extra.length || provided.length!==expected.length || !timingSafeEqual(provided,expected)) throw Error('Bitte erneut suchen und einen Track auswählen.');
  const item=JSON.parse(Buffer.from(data,'base64url').toString());
  if (!(item.expires>Date.now())) throw Error('Die Auswahl ist abgelaufen. Bitte erneut suchen.');
  return trackUrl(item.url);
}
export function run(command,args,{signal,timeout=60000}={}) {
  return new Promise((resolve,reject)=>{
    let stdout='', stderr='', failure;
    const p=spawn(command,args,{signal,stdio:['ignore','pipe','pipe']});
    const timer=setTimeout(()=>{failure=Error('Zeitlimit erreicht. Bitte später oder mit einem kürzeren Track versuchen.');p.kill('SIGKILL');},timeout);
    p.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>4*1024*1024){failure=Error('Die Antwort ist zu groß.');p.kill('SIGKILL');}});
    p.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-8000)});
    p.on('error',error=>{clearTimeout(timer);reject(error)});
    p.on('close',code=>{clearTimeout(timer);if(failure)reject(failure);else if(code!==0){const error=Error('Die Musikquelle konnte nicht geladen werden.');error.details=stderr;reject(error);}else resolve(stdout);});
  });
}
export function ytdlp(args, options) {
  return run(process.env.YTDLP_PATH||'yt-dlp',['--ignore-config','--no-cache-dir','--no-playlist','--socket-timeout','12','--retries','1','--extractor-retries','1','--compat-options','no-certifi','--js-runtimes','node',...args],options);
}
export function sourceError(error) {
  if (error.code==='ENOENT') return 'Der Musik-Downloader ist auf diesem Server noch nicht installiert.';
  const details=error.details||'';
  if (/proxy|denied|407|blocked|tunnel/i.test(details)) return 'Der Server kann diese Musikquelle derzeit nicht erreichen.';
  if (/sign in|login|bot|cookies|403|429|restricted|private|not available/i.test(details)) return 'Die Plattform blockiert diesen Abruf oder der Track ist nicht öffentlich verfügbar. Bitte einen anderen Track versuchen.';
  return error.message;
}
