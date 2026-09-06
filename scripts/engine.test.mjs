import {test} from 'node:test';
import assert from 'node:assert/strict';
import words from '../src/words.json' with {type:'json'};
import {tokenize,schedule,scene,sentenceIds,formIndex,blank,card,check,checkMeaning,meanings,queue,migrate,validate,levels,applyGrade,ladder,weave,mastery,stage,seen,MASTERY,empty,SCENES,alternates,streak,bestStreak,addDay,lastDays,dayKey} from '../src/engine.js';
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
test('discover walks A1 to C1 in order, skipping known words',()=>{
 const order=ladder(words,{});
 assert.equal(order.length,words.length);
 for(let i=1;i<order.length;i++){
  const a=levels.indexOf(order[i-1].level),b=levels.indexOf(order[i].level);
  assert.ok(a<=b,'ladder left level order at '+i);
  if(a===b)assert.ok(order[i-1].id<order[i].id,'ladder left frequency order at '+i);
 }
 assert.equal(order[0].level,'A1');
 assert.equal(order[order.length-1].level,'C1');
 const known={[words[0].id]:1};
 assert.ok(!ladder(words,known).some(w=>w.id===words[0].id));
});
test('discover resumes at the first word you have neither met nor retired',()=>{
 const order=ladder(words,{});
 const first=queue({words,mode:'discover',progress:{},size:5});
 assert.deepEqual(first.map(w=>w.id),order.slice(0,5).map(w=>w.id));
 // answering a word gives it a card, which is what moves the ladder on
 const cards=Object.fromEntries(first.map(w=>[w.id,{due:Date.now()+9e8,interval:1,reviews:1}]));
 const next=queue({words,mode:'discover',progress:{cards},size:5});
 assert.deepEqual(next.map(w=>w.id),order.slice(5,10).map(w=>w.id));
 // so does retiring one
 const known={[order[0].id]:1};
 assert.equal(queue({words,mode:'discover',progress:{known},size:1})[0].id,order[1].id);
 // a stale resume point from an older scheme cannot drag progress into B2
 assert.equal(queue({words,mode:'discover',progress:{cursor:402},size:1})[0].level,'A1');
 assert.deepEqual(queue({words,mode:'discover',progress:{known:Object.fromEntries(words.map(w=>[w.id,1]))}}),[]);
});
test('due reviews weave into discover without crowding out progress',()=>{
 const now=1e12;
 const late=words.slice(3000,3040);
 const cards=Object.fromEntries(late.map((w,i)=>[w.id,{due:now-1000-i,interval:2,reviews:1}]));
 const round=queue({words,mode:'discover',progress:{cards},now,size:10});
 assert.equal(round.length,10);
 const reviews=round.filter(w=>cards[w.id]).length;
 assert.equal(reviews,5,'reviews should take at most half the round');
 assert.ok(round.some(w=>!cards[w.id]),'a round must still make progress');
 assert.ok(round.every(w=>!cards[w.id]||cards[w.id].due<=now),'only due cards weave in');
 // a word already scheduled but not yet due stays out of the round entirely
 const later={[words[4000].id]:{due:now+1e9,interval:9,reviews:1}};
 assert.ok(!queue({words,mode:'discover',progress:{cards:later},now,size:10}).some(w=>w.id===words[4000].id));
 // with nothing due, the round is all progression
 assert.equal(queue({words,mode:'discover',progress:{},now,size:6}).length,6);
});
test('weave spreads the second list through the first',()=>{
 assert.deepEqual(weave([1,2,3,4,5,6],['a']),[1,2,3,'a',4,5,6]);
 assert.deepEqual(weave([1,2,3,4,5,6],['a','b']),[1,2,'a',3,4,5,'b',6]);
 assert.deepEqual(weave([],['a','b']),['a','b']);
 assert.deepEqual(weave([1,2],[]),[1,2]);
 for(const [m,e] of [[7,3],[1,9],[9,1],[0,0],[4,4]]){
  const out=weave(Array.from({length:m},(_,i)=>i),Array.from({length:e},(_,i)=>'x'+i));
  assert.equal(out.length,m+e,`weave lost items at ${m}+${e}`);
  assert.equal(new Set(out).size,m+e,`weave duplicated items at ${m}+${e}`);
 }
});
test('library and review decks ignore the level range',()=>{
 const now=1e12;
 const lib={[words[0].id]:1,[words[5400].id]:1};
 const mine=queue({words,mode:'library',progress:{lib,known:{}},now,size:9});
 assert.deepEqual(mine.map(w=>w.id).sort((a,b)=>a-b),[words[0].id,words[5400].id]);
 const known={[words[0].id]:1};
 assert.deepEqual(queue({words,mode:'library',progress:{lib,known},now,size:9}).map(w=>w.id),[words[5400].id]);
 const cards={[words[4].id]:{due:now-1,interval:1,reviews:1},[words[5].id]:{due:now+1e9,interval:9,reviews:1}};
 assert.deepEqual(queue({words,mode:'review',progress:{cards,known:{}},now,size:9}).map(w=>w.id),[words[4].id]);
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

test('every mnemonic variant names the whole cast in order and lands on the meaning',()=>{
 const w={ipa:'vaʃ',meaning:'cow',article:'la vache'};
 const texts=[];
 for(let v=0;v<SCENES;v++){
  const text=scene(w,v);
  assert.match(text,/silver ribbon/,'variant '+v+' lost the gender cue');
  const chain=text.match(/vampire → beach → chef/);
  assert.ok(chain,'variant '+v+' lost the ordered cast chain');
  assert.match(text,/“cow”/,'variant '+v+' dropped the meaning');
  texts.push(text);
 }
 assert.equal(new Set(texts).size,SCENES,'variants are not distinct');
 assert.equal(scene(w,0),scene(w),'default variant moved');
 assert.equal(scene(w,SCENES),scene(w,0),'variants do not wrap');
 assert.equal(scene(w,-1),scene(w,SCENES-1),'negative variants do not wrap');
 assert.match(scene({ipa:'a',meaning:'x',article:'le a'},3),/golden key/);
 for(const w of words.slice(0,400)){
  const text=scene(w,w.id%SCENES);
  assert.ok(!/ ,|,,|\.\./.test(text),'punctuation glitch in '+w.word+': '+text);
  assert.ok(!/(\bin the [a-z ]+) \1/.test(text),'repeated location in '+w.word+': '+text);
  assert.match(text,/“/,'no meaning in '+w.word);
 }
});
test('alternate sentences come from other entries, never the word itself',()=>{
 const vache=words.find(w=>w.word==='vache');
 const alt=alternates(vache,words);
 assert.ok(alt.length>0);
 assert.ok(alt.every(o=>o.id!==vache.id),'a word was offered its own sentence');
 assert.ok(alt.every(o=>o.example.toLowerCase().includes('vache')),'a sentence does not mention the word');
 assert.deepEqual(alternates(vache,words).map(o=>o.id),alt.map(o=>o.id),'the index is not stable');
 assert.ok(Array.isArray(alternates({id:999999,word:'zzz',example:'x'},words)));
});
test('a day streak counts back from today, or from yesterday if today is idle',()=>{
 const days=['2026-09-01','2026-09-02','2026-09-04','2026-09-05','2026-09-06'];
 assert.equal(streak(days,'2026-09-06'),3);
 assert.equal(streak(days,'2026-09-07'),3,'an idle today should not break the streak yet');
 assert.equal(streak(days,'2026-09-08'),0,'a missed day should break it');
 assert.equal(streak([],'2026-09-06'),0);
 assert.equal(streak(['2026-09-06'],'2026-09-06'),1);
 assert.equal(bestStreak(days),3);
 assert.equal(bestStreak([]),0);
 assert.equal(bestStreak(['2026-01-01','2026-03-01']),1);
 assert.equal(bestStreak(['2026-02-28','2026-03-01']),2,'month boundary');
 assert.equal(bestStreak(['2026-12-31','2027-01-01']),2,'year boundary');
});
test('recording a day is idempotent and stays sorted',()=>{
 let days=[];
 days=addDay(days,'2026-09-06');
 days=addDay(days,'2026-09-06');
 days=addDay(days,'2026-09-04');
 assert.deepEqual(days,['2026-09-04','2026-09-06']);
 assert.match(dayKey(new Date(2026,8,6)),/^2026-09-06$/);
 const grid=lastDays(days,4,'2026-09-06');
 assert.deepEqual(grid.map(d=>d.on),[false,true,false,true]);
 assert.equal(grid.length,4);
});

test('an English meaning accepts every alternative the corpus packs into it',()=>{
 const know=meanings({meaning:'to know (facts · how to do something)'});
 for(const right of ['know','to know','How To Do Something','  to know  '])
  assert.equal(checkMeaning(right,know),'exact',right);
 assert.equal(checkMeaning('to kno',know),'near','a dropped letter is a typo');
 assert.equal(checkMeaning('knwo',know),'near','a swapped pair is a typo');
 assert.equal(checkMeaning('to eat',know),'wrong');
 assert.equal(checkMeaning('   ',know),'empty');
 const spend=meanings({meaning:'to pass · to spend (time)'});
 for(const right of ['to pass','spend','to spend time'])assert.equal(checkMeaning(right,spend),'exact',right);
 assert.equal(checkMeaning('the house',meanings({meaning:'the house'})),'exact');
 assert.equal(checkMeaning('house',meanings({meaning:'the house'})),'exact','a leading article is optional');
 // every entry must yield at least one acceptable answer, or the mode is unplayable
 for(const w of words)assert.ok(meanings(w).length,'no answer for '+w.word+': '+w.meaning);
 for(const w of words.slice(0,800))assert.equal(checkMeaning(w.meaning,meanings(w)),'exact',w.word);
});
test('each mode builds the card it needs',()=>{
 const w=words.find(x=>x.word==='vache');
 const en=card(w,'english');
 assert.equal(en.kind,'meaning');
 assert.equal(en.answer,w.meaning);
 assert.ok(en.accepts.length);
 const comp=card(w,'compose');
 assert.equal(comp.kind,'compose');
 assert.equal(comp.answer,w.word);
 assert.ok(['cloze','recall'].includes(card(w).kind),'the default card is unchanged');
 assert.deepEqual(card(w,'discover'),card(w));
});
test('the studying modes all draw from the library, due first',()=>{
 const now=1e12;
 const progress={...empty,lib:{2:1,5:1,9:1},known:{5:1},
  cards:{9:{due:now-1000,interval:1,reviews:1},2:{due:now+9e6,interval:3,reviews:1}}};
 for(const mode of ['library','english','compose']){
  const list=queue({words,mode,progress,now,size:10});
  assert.deepEqual(list.map(w=>w.id),[9,2],mode+' should be due-first, and skip known words');
 }
 assert.deepEqual(queue({words,mode:'english',progress:{...empty},now,size:10}),[],'an empty library plays nothing');
});
