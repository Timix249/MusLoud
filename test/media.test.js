import test from 'node:test';
import assert from 'node:assert/strict';
import {trackUrl,searchTarget,issueToken,readToken,sourceError} from '../media.js';
test('canonicalizes single tracks and strips extraneous parameters',()=>{
 assert.equal(trackUrl('https://youtu.be/abcdefghijk?list=ignore'),'https://www.youtube.com/watch?v=abcdefghijk');
 assert.equal(trackUrl('https://music.youtube.com/watch?v=abcdefghijk&list=ignore'),'https://www.youtube.com/watch?v=abcdefghijk');
 assert.equal(trackUrl('https://soundcloud.com/artist/track?secret=ignore'),'https://soundcloud.com/artist/track');
});
test('rejects arbitrary hosts, protocols, credentials, ports and playlists',()=>{
 for(const url of ['http://youtube.com/watch?v=abcdefghijk','https://youtube.com.evil.com/watch?v=abcdefghijk','https://127.0.0.1/a/b','file:///etc/passwd','https://evil@youtube.com/watch?v=abcdefghijk','https://youtube.com:123/watch?v=abcdefghijk','https://youtube.com/playlist?list=123','https://soundcloud.com/artist/sets/collection'])assert.throws(()=>trackUrl(url));
});
test('search terms cannot inject downloader options or extractor pseudo-URLs',()=>{
 assert.equal(searchTarget('--exec evil','youtube'),'ytsearch5:--exec evil');
 assert.equal(searchTarget('nice music','soundcloud'),'scsearch5:nice music');
 for(const q of ['file:///etc/passwd','ytsearch100:test','https://example.org/audio'])assert.throws(()=>searchTarget(q,'youtube'));
 assert.throws(()=>searchTarget('music','arbitrary'));
});
test('only signed server-issued selections can be downloaded',()=>{
 const token=issueToken('https://soundcloud.com/artist/track');assert.equal(readToken(token),'https://soundcloud.com/artist/track');
 assert.throws(()=>readToken(token+'x'));assert.throws(()=>readToken('fake.signature'));assert.throws(()=>readToken(null));
});
test('network and provider errors have distinct messages',()=>{
 const e=Error('failed');e.details='Tunnel connection failed: 403 Forbidden';assert.match(sourceError(e),/nicht erreichen/);
 e.details='Sign in to confirm you are not a bot';assert.match(sourceError(e),/Plattform blockiert/);
});
