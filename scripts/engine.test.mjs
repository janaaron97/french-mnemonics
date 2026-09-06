import {test} from 'node:test';
import assert from 'node:assert/strict';
import words from '../src/words.json' with {type:'json'};
import {tokenize,schedule,scene,sentenceIds,formIndex,blank,card,check,queue,migrate,validate,levels,applyGrade,mastery,stage,seen,MASTERY,empty} from '../src/engine.js';
test('5,500 unique complete entries span A1 to C1',()=>{assert.equal(words.length,5500);assert.equal(new Set(words.map(w=>w.word)).size,5500);for(const w of words){for(const key of ['word','ipa','meaning','example','translation','level'])assert.ok(w[key],`${w.id} ${key}`);assert.ok(!['le','la','les'].includes(w.article))}assert.equal(new Set(words.map(w=>w.level)).size,5)});
test('every pronunciation has complete mnemonic coverage',()=>{for(const w of words)assert.ok(tokenize(w.ipa).every(s=>s.type!=='unknown'),w.word+' '+w.ipa)});
test('nasals and recurring chunks use longest matches',()=>{assert.deepEqual(tokenize('ʃɑ̃').map(s=>s.name),['Chef','Atrium']);assert.equal(tokenize('sjɔ̃')[0].name,'Transformation machine');assert.deepEqual(tokenize('ʼɥit').map(s=>s.ipa),['ɥ','i','t']);assert.equal(tokenize('sjɔ̃',false).length,3)});
test('review intervals grow, failure retries in a minute',()=>{const initial=schedule(null,'good',0);assert.equal(initial.due,86400000);const next=schedule(initial,'good',initial.due);assert.equal(next.interval,3);assert.equal(next.reviews,2);const failed=schedule(next,'again',500);assert.equal(failed.due,60500);assert.equal(failed.interval,0);assert.equal(schedule(next,'hard',0).interval,4);assert.equal(schedule(null,'easy',0).interval,4)});
test('gender cues follow supplied noun articles',()=>{assert.match(scene({ipa:'ʃa',meaning:'cat',article:'le chat'}),/golden key/);assert.match(scene({ipa:'ly n',meaning:'moon',article:'la lune'}),/silver ribbon/)});
test('inflected sentence words resolve back to their corpus entries',()=>{
 const say=(s)=>sentenceIds(s,words).map(id=>words[id-1].word);
 assert.deepEqual(say('Je suis étudiant.'),['être','étudiant']);
 assert.ok(say('Nous avons faim.').includes('avoir'));
 assert.ok(say('Il a couru rapidement pour attraper le bus.').includes('courir'));
 assert.ok(say('C’est la même chose.').includes('même'));
 assert.ok(say("L'homme mange des pommes vertes.").includes('vert'));
 assert.deepEqual(say('Zzzz qqqq.'),[]);
 const both=sentenceIds('Je suis étudiant. Je suis étudiant.',words);
 assert.equal(new Set(both).size,both.length);
});
test('canonical entries always win over generated inflections',()=>{
 const index=formIndex(words);
 for(const w of words)assert.equal(index.get(w.word.toLowerCase().normalize('NFC')),w.id,w.word);
 assert.equal(words[index.get('suis')-1].word,'être');
});
test('a cloze blanks the lemma where the sentence uses it verbatim',()=>{
 const cut=blank({word:'fardeau',example:'Ce travail est devenu un lourd fardeau pour lui.'});
 assert.equal(cut.answer,'fardeau');
 assert.equal(cut.before,'Ce travail est devenu un lourd ');
 assert.equal(cut.after,' pour lui.');
 assert.equal(blank({word:'être',example:'Je suis étudiant.'}),null);
 assert.equal(blank({word:'tout',example:'Tout le monde est là.'}).answer,'Tout');
 const covered=words.filter(w=>blank(w)).length;
 assert.ok(covered/words.length>.8,`only ${covered} of ${words.length} entries can be clozed`);
});
test('cards carry the answer they accept and its length',()=>{
 const gap=card(words.find(w=>w.word==='encore'));
 assert.equal(gap.kind,'cloze');
 assert.equal(gap.before+gap.answer+gap.after,gap.word.example);
 assert.deepEqual(gap.accepts,['encore']);
 assert.equal(gap.length,6);
 const spoken=card(words[0]);
 assert.equal(spoken.kind,'recall');
 assert.equal(spoken.answer,'être');
 const noun=card(words.find(w=>w.word==='fardeau'));
 assert.deepEqual(noun.accepts,['fardeau']);
 assert.deepEqual(card({...words[0],example:'x'}).accepts,['être']);
 assert.deepEqual(card({...words[0],article:'le être',example:'x'}).accepts,['être','le être']);
 for(const w of words){const c=card(w);assert.ok(c.length>0&&c.accepts.length,w.word)}
});
test('typed answers tolerate case and spacing, not missing accents',()=>{
 assert.equal(check('encore',['encore']),'exact');
 assert.equal(check('  Encore ',['encore']),'exact');
 assert.equal(check('',['encore']),'empty');
 assert.equal(check('   ',['encore']),'empty');
 assert.equal(check('ici',['encore']),'wrong');
 assert.equal(check('eleve',['élève']),'accent');
 assert.equal(check('élève',['élève']),'exact');
 assert.equal(check('francais',['français']),'accent');
 assert.equal(check('soeur',['sœur']),'accent');
 assert.equal(check('aujourd\u2019hui',["aujourd'hui"]),'exact');
 assert.equal(check('le fardeau',['fardeau','le fardeau']),'exact');
 assert.equal(check('etre',['être']),'accent');
});
test('sessions skip known words and honour the level range',()=>{
 const known={[words[0].id]:1,[words[1].id]:1};
 const discover=queue({words,mode:'discover',levels:['A1'],progress:{known},size:5});
 assert.equal(discover.length,5);
 assert.ok(discover.every(w=>w.level==='A1'&&!known[w.id]));
 const resumed=queue({words,mode:'discover',levels:['A1'],progress:{known,cursor:discover[4].id},size:3});
 assert.ok(resumed[0].id>discover[4].id);
 const lib={[words[9].id]:1,[words[0].id]:1};
 const mine=queue({words,mode:'library',levels:levels,progress:{lib,known},size:9});
 assert.deepEqual(mine.map(w=>w.id),[words[9].id]);
 const now=1e12;
 const cards={[words[4].id]:{due:now-1,interval:1,reviews:1},[words[5].id]:{due:now+1e9,interval:9,reviews:1}};
 assert.deepEqual(queue({words,mode:'review',progress:{cards,known},now,size:9}).map(w=>w.id),[words[4].id]);
 assert.deepEqual(queue({words,mode:'discover',levels:['A1'],progress:{known:Object.fromEntries(words.map(w=>[w.id,1]))}}),[]);
});
test('older backups migrate, malformed ones are refused',()=>{
 const old={version:1,cards:{'1':{due:5,interval:1,reviews:1}},notes:{'2':'mine'}};
 const moved=validate(old,words);
 assert.deepEqual(Object.keys(moved.lib),['1']);
 assert.equal(moved.version,2);
 assert.equal(moved.notes['2'],'mine');
 assert.equal(moved.xp,0);
 assert.ok(moved.sound);
 const round=validate(JSON.parse(JSON.stringify({...moved,known:{'3':7},xp:250})),words);
 assert.equal(round.known['3'],7);
 assert.equal(round.xp,250);
 assert.equal(validate({version:3,cards:{}},words),null);
 assert.equal(validate({version:2,cards:{'999999':{due:1,interval:1,reviews:1}}},words),null);
 assert.equal(validate({version:2,known:{'999999':1}},words),null);
 assert.equal(validate({version:2,notes:{'1':5}},words),null);
 assert.equal(validate(null,words),null);
 assert.equal(migrate(null).cursor,0);
});

const fresh=()=>({...empty,cards:{},notes:{},lib:{},known:{}});

test('every graded answer lands in exactly one outcome bucket',()=>{
 const counts=g=>{const c=schedule(null,g,0);return [c.clean,c.close,c.missed,c.reviews]};
 assert.deepEqual(counts('good'),[1,0,0,1]);
 assert.deepEqual(counts('easy'),[1,0,0,1]);
 assert.deepEqual(counts('hard'),[0,1,0,1]);
 assert.deepEqual(counts('again'),[0,0,1,1]);
 let card=null;
 for(const g of ['good','again','hard','good','easy'])card=schedule(card,g,0);
 assert.deepEqual([card.clean,card.close,card.missed],[3,1,1]);
 assert.equal(card.reviews,5);
 assert.equal(seen(card),5);
});
test('ten clean answers retire a word to known, and only clean ones count',()=>{
 let state={...fresh(),lib:{'42':1}};
 for(let i=0;i<9;i++){
  const {next,mastered}=applyGrade(state,'42','good',i);
  state=next;
  assert.equal(mastered,false,'mastered early at '+(i+1));
  assert.equal(mastery(state.cards['42']),i+1);
  assert.ok(state.lib['42'],'left the library at '+(i+1));
 }
 for(const g of ['hard','again','hard']){
  const {next,mastered}=applyGrade(state,'42',g,50);
  state=next;
  assert.equal(mastered,false,g+' should not master');
  assert.equal(mastery(state.cards['42']),9,g+' moved mastery');
 }
 const {next,mastered}=applyGrade(state,'42','good',99);
 assert.equal(mastered,true);
 assert.equal(next.known['42'],99);
 assert.equal(next.lib['42'],undefined);
 assert.equal(mastery(next.cards['42']),MASTERY);
 assert.equal(applyGrade(next,'42','good',100).mastered,false,'re-mastering an already known word');
});
test('a graded word joins the library, unless it is already known',()=>{
 const joined=applyGrade(fresh(),'3','good',7).next;
 assert.equal(joined.lib['3'],7);
 const wasKnown={...fresh(),known:{'3':1}};
 assert.equal(applyGrade(wasKnown,'3','good',7).next.lib['3'],undefined);
});
test('review stages follow the interval, and known outranks them all',()=>{
 assert.equal(stage(null,false).label,'New');
 assert.equal(stage({reviews:0},false).label,'New');
 assert.equal(stage({reviews:1,interval:0},false).label,'Learning');
 assert.equal(stage({reviews:1,interval:1},false).label,'Familiar');
 assert.equal(stage({reviews:1,interval:6},false).label,'Familiar');
 assert.equal(stage({reviews:1,interval:7},false).label,'Strong');
 assert.equal(stage({reviews:1,interval:20},false).label,'Strong');
 assert.equal(stage({reviews:1,interval:21},false).label,'Locked in');
 assert.equal(stage({reviews:1,interval:0},true).label,'Known');
 assert.equal(stage(null,true).label,'Known');
});
test('mastery is clamped and safe on an unseen word',()=>{
 assert.equal(mastery(undefined),0);
 assert.equal(mastery({clean:99}),MASTERY);
 assert.equal(seen(undefined),0);
});
