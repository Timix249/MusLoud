import test from 'node:test';
import assert from 'node:assert/strict';
import {trackUrl,searchTarget,issueToken,readToken,sourceError,sourceFailure} from '../media.js';
test('canonicalizes single tracks and strips extraneous parameters',()=>{
 assert.equal(trackUrl('https://www.soundcloud.com/artist/track/'),'https://soundcloud.com/artist/track');
 assert.equal(trackUrl('https://soundcloud.com/artist/track?secret=ignore'),'https://soundcloud.com/artist/track');
});
test('rejects arbitrary hosts, protocols, credentials, ports and playlists',()=>{
 for(const url of ['http://youtube.com/watch?v=abcdefghijk','https://youtube.com.evil.com/watch?v=abcdefghijk','https://127.0.0.1/a/b','file:///etc/passwd','https://evil@youtube.com/watch?v=abcdefghijk','https://youtube.com:123/watch?v=abcdefghijk','https://youtube.com/playlist?list=123','https://soundcloud.com/artist/sets/collection'])assert.throws(()=>trackUrl(url));
});
test('search terms cannot inject downloader options or extractor pseudo-URLs',()=>{
 assert.equal(searchTarget('--exec evil'),'scsearch5:--exec evil');
 assert.equal(searchTarget('nice music','soundcloud'),'scsearch5:nice music');
 for(const q of ['file:///etc/passwd','ytsearch100:test','https://example.org/audio'])assert.throws(()=>searchTarget(q,'soundcloud'));
 assert.throws(()=>searchTarget('music','arbitrary'));
 assert.throws(()=>searchTarget('music','youtube'));
 assert.throws(()=>trackUrl('https://youtu.be/abcdefghijk'));
 assert.throws(()=>trackUrl('https://www.youtube.com/watch?v=abcdefghijk'));
});
test('only signed server-issued selections can be downloaded',()=>{
 const token=issueToken('https://soundcloud.com/artist/track');assert.equal(readToken(token),'https://soundcloud.com/artist/track');
 assert.throws(()=>readToken(token+'x'));assert.throws(()=>readToken('fake.signature'));assert.throws(()=>readToken(null));
});
test('network and provider errors have distinct messages',()=>{
 const e=Error('failed');e.details='Tunnel connection failed: 403 Forbidden';assert.match(sourceError(e),/nicht erreichen/);
 e.details='Sign in to confirm you are not a bot';assert.match(sourceError(e),/Bot-Prüfung/);
});

test('provider failures have actionable codes without leaking extractor details',()=>{
 for(const [details,code] of [
  ['Sign in to confirm you are not a bot','BOT_CHECK',true],
  ['HTTP Error 403: Forbidden','SOURCE_FORBIDDEN',true],
  ['HTTP Error 429: Too Many Requests','RATE_LIMITED',true],
  ['This video is private','LOGIN_REQUIRED',false],
  ['This video is not available in your country','REGION_BLOCKED',true],
  ['Requested format is not available','NO_AUDIO_FORMAT',true],
  ['n challenge solving failed','EXTRACTOR_FAILED',false],
  ['This video is DRM protected','DRM_PROTECTED',false],
 ]){
  const e=Error('internal error');e.details=details+' https://example.com/?token=never-expose';
  const failure=sourceFailure(e);assert.equal(failure.code,code);assert.doesNotMatch(JSON.stringify(failure),/never-expose/);
 }
});
