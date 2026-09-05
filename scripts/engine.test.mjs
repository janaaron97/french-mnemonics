import {test} from 'node:test';
import assert from 'node:assert/strict';
import words from '../src/words.json' with {type:'json'};
import {tokenize,schedule,scene} from '../src/engine.js';
test('5,500 unique complete entries span A1 to C1',()=>{assert.equal(words.length,5500);assert.equal(new Set(words.map(w=>w.word)).size,5500);for(const w of words){for(const key of ['word','ipa','meaning','example','translation','level'])assert.ok(w[key],`${w.id} ${key}`);assert.ok(!['le','la','les'].includes(w.article))}assert.equal(new Set(words.map(w=>w.level)).size,5)});
test('every pronunciation has complete mnemonic coverage',()=>{for(const w of words)assert.ok(tokenize(w.ipa).every(s=>s.type!=='unknown'),w.word+' '+w.ipa)});
test('nasals and recurring chunks use longest matches',()=>{assert.deepEqual(tokenize('ʃɑ̃').map(s=>s.name),['Chef','Atrium']);assert.equal(tokenize('sjɔ̃')[0].name,'Transformation machine');assert.deepEqual(tokenize('ʼɥit').map(s=>s.ipa),['ɥ','i','t']);assert.equal(tokenize('sjɔ̃',false).length,3)});
test('review intervals grow, failure retries in a minute',()=>{const initial=schedule(null,'good',0);assert.equal(initial.due,86400000);const next=schedule(initial,'good',initial.due);assert.equal(next.interval,3);assert.equal(next.reviews,2);const failed=schedule(next,'again',500);assert.equal(failed.due,60500);assert.equal(failed.interval,0);assert.equal(schedule(next,'hard',0).interval,4);assert.equal(schedule(null,'easy',0).interval,4)});
test('gender cues follow supplied noun articles',()=>{assert.match(scene({ipa:'ʃa',meaning:'cat',article:'le chat'}),/golden key/);assert.match(scene({ipa:'ly n',meaning:'moon',article:'la lune'}),/silver ribbon/)});
