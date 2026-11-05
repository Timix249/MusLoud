import { spawn } from 'node:child_process';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
const key = randomBytes(32);
export const formats = {mp3:['libmp3lame','-b:a','320k'],wav:['pcm_s16le'],flac:['flac'],ogg:['libvorbis']};
export function trackUrl(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.port) throw Error('Ungültiger Link.');
  const host = u.hostname;
  if (['soundcloud.com','www.soundcloud.com'].includes(host) && /^\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/?$/.test(u.pathname) && !/^\/(sets|discover|search)\//.test(u.pathname)) return `https://soundcloud.com${u.pathname.replace(/\/$/,'')}`;
  throw Error('Bitte einen öffentlichen SoundCloud-Track verwenden. Playlists werden noch nicht unterstützt.');
}
export function searchTarget(query, source='soundcloud') {
  if (typeof query !== 'string' || !query.trim() || query.length > 250) throw Error('Bitte einen Namen oder Track-Link eingeben (max. 250 Zeichen).');
  if (source !== 'soundcloud') throw Error('Unbekannte Musikquelle.');
  query = query.trim();
  if (/^[a-z][\w+.-]*:/i.test(query) || /^(www\.|\w+\.)[^ ]*\//.test(query)) return trackUrl(query);
  return `scsearch5:${query}`;
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
  return run(process.env.YTDLP_PATH||'yt-dlp',['--ignore-config','--no-cache-dir','--no-playlist','--socket-timeout','12','--retries','1','--extractor-retries','1','--compat-options','no-certifi',...args],options);
}
export function sourceFailure(error) {
  const details=error.details||'';
  let code='PROCESSING_FAILED',message=error.message||'Der Download ist fehlgeschlagen.';
  if(error.code==='ENOENT') {code='TOOL_MISSING';message='Ein benötigtes Programm fehlt auf dem Server. Bitte den Betreiber informieren.';}
  else if(/proxy|407|tunnel/i.test(details)){code='NETWORK_DENIED';message='Der Server kann diese Musikquelle derzeit nicht erreichen.';}
  else if(/confirm.*(?:bot|human)|not a bot|automated requests/i.test(details)){code='BOT_CHECK';message='Die Plattform verlangt eine Bot-Prüfung und verweigert diesem Server den Download. Versuche einen anderen SoundCloud-Track.';}
  else if(/429|too many requests/i.test(details)){code='RATE_LIMITED';message='Die Plattform begrenzt gerade die Abrufe. Bitte später erneut versuchen.';}
  else if(/DRM protected|DRM-protected|protected with DRM/i.test(details)){code='DRM_PROTECTED';message='Dieser Inhalt ist geschützt und kann nicht heruntergeladen werden.';}
  else if(/private|members.only|sign in|login|age.restricted|authentication/i.test(details)){code='LOGIN_REQUIRED';message='Dieser Track erfordert eine Anmeldung oder ist nicht öffentlich verfügbar.';}
  else if(/not available in your country|geo.restricted|not available in your region/i.test(details)){code='REGION_BLOCKED';message='Der Track ist am Serverstandort nicht verfügbar. Versuche einen anderen SoundCloud-Track.';}
  else if(/challenge solving failed|n challenge|signature extraction|no supported javascript runtime|nsig extraction/i.test(details)){code='EXTRACTOR_FAILED';message='Die Plattform konnte technisch nicht ausgelesen werden. Bitte den Betreiber informieren.';}
  else if(/403|forbidden|access denied|blocked/i.test(details)){code='SOURCE_FORBIDDEN';message='Die Plattform verweigert dem Server den Download (HTTP 403). Versuche einen anderen SoundCloud-Track.';}
  else if(/requested format is not available|no video formats|no formats found/i.test(details)){code='NO_AUDIO_FORMAT';message='Für diesen Track stellt die Plattform keine abrufbare Audiodatei bereit.';}
  else if(/unavailable|not available|removed|copyright|404/i.test(details)){code='TRACK_UNAVAILABLE';message='Dieser Track wurde entfernt oder ist nicht verfügbar.';}
  return {code,error:message};
}
export function sourceError(error) {return sourceFailure(error).error;}
