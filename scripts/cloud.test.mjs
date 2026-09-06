import {test} from 'node:test';
import assert from 'node:assert/strict';
import {empty} from '../src/engine.js';
import {fromRows,diff,isEmpty,hasContent,libraryRow,reviewRow,stateRow} from '../src/cloud.js';

const blank=()=>({...empty,cards:{},notes:{},lib:{},known:{}});
const iso=ms=>new Date(ms).toISOString();

test('outcome counters survive the round trip and drive writes',()=>{
 const s={...blank(),lib:{'7':1},cards:{'7':{due:9,interval:3,reviews:12,last:8,clean:5,close:3,missed:4}}};
 const row=reviewRow(s,'7');
 assert.equal(row.clean,5);assert.equal(row.close,3);assert.equal(row.missed,4);assert.equal(row.reviews,12);
 assert.deepEqual(fromRows({reviews:[row]}).state.cards['7'],{due:9,interval:3,reviews:12,last:8,clean:5,close:3,missed:4});
 const bumped={...s,cards:{'7':{...s.cards['7'],clean:6}}};
 assert.deepEqual(diff(s,bumped,['A1'],['A1']).upReviews.map(r=>r.clean),[6]);
 assert.ok(isEmpty(diff(s,s,['A1'],['A1'])));
 const old=fromRows({reviews:[{word_id:1,due:null,interval_days:0,reviews:0,last_reviewed:null}]});
 assert.deepEqual([old.state.cards['1'].clean,old.state.cards['1'].close,old.state.cards['1'].missed],[0,0,0]);
});
test('a studying word, a known word and a note round-trip through rows',()=>{
 const s={...blank(),lib:{'7':1000},known:{'9':2000},notes:{'7':'my scene'},
  cards:{'7':{due:5000,interval:3,reviews:2,last:4000}}};
 assert.deepEqual(libraryRow(s,'7'),{word_id:7,note:'my scene',known_at:null,added_at:iso(1000)});
 assert.deepEqual(libraryRow(s,'9'),{word_id:9,note:'',known_at:iso(2000),added_at:iso(2000)});
 assert.equal(libraryRow(s,'11'),null);
 assert.deepEqual(reviewRow(s,'7'),{word_id:7,due:iso(5000),interval_days:3,reviews:2,last_reviewed:iso(4000),clean:0,close:0,missed:0});
 assert.equal(reviewRow(s,'9'),null);
 const back=fromRows({library:[libraryRow(s,'7'),libraryRow(s,'9')],reviews:[reviewRow(s,'7')],
  state:{...stateRow(s,['A1','B1'])}});
 assert.deepEqual(back.state.lib,{'7':1000});
 assert.deepEqual(back.state.known,{'9':2000});
 assert.deepEqual(back.state.notes,{'7':'my scene'});
 assert.deepEqual(back.state.cards,{'7':{due:5000,interval:3,reviews:2,last:4000,clean:0,close:0,missed:0}});
 assert.deepEqual(back.levels,['A1','B1']);
});
test('an unchanged state produces no writes',()=>{
 const s={...blank(),lib:{'1':1},cards:{'1':{due:2,interval:1,reviews:1,last:1}}};
 assert.ok(isEmpty(diff(s,s,['A1'],['A1'])));
 assert.ok(isEmpty(diff(s,{...s,lib:{...s.lib}},['A1'],['A1'])));
});
test('marking known moves the row rather than deleting it',()=>{
 const before={...blank(),lib:{'1':100}};
 const after={...blank(),known:{'1':200}};
 const d=diff(before,after,['A1'],['A1']);
 assert.deepEqual(d.delLibrary,[]);
 assert.equal(d.upLibrary.length,1);
 assert.equal(d.upLibrary[0].known_at,iso(200));
});
test('removing a word deletes both its rows',()=>{
 const before={...blank(),lib:{'4':1},notes:{'4':'x'},cards:{'4':{due:1,interval:1,reviews:1,last:1}}};
 const d=diff(before,blank(),['A1'],['A1']);
 assert.deepEqual(d.delLibrary,[4]);
 assert.deepEqual(d.delReviews,[4]);
 assert.deepEqual(d.upLibrary,[]);
});
test('only genuinely changed rows are written',()=>{
 const before={...blank(),lib:{'1':1,'2':2},cards:{'1':{due:1,interval:1,reviews:1,last:1}}};
 const after={...before,lib:{...before.lib},cards:{...before.cards,'1':{due:9,interval:2,reviews:2,last:5}}};
 const d=diff(before,after,['A1'],['A1']);
 assert.deepEqual(d.upLibrary,[]);
 assert.deepEqual(d.upReviews.map(r=>r.word_id),[1]);
 assert.equal(d.upReviews[0].interval_days,2);
});
test('counters and the level range travel in the state row',()=>{
 const s=blank();
 assert.equal(diff(s,s,['A1'],['A1']).state,null);
 assert.ok(diff(s,{...s,xp:120},['A1'],['A1']).state.xp===120);
 assert.deepEqual(diff(s,s,['A1'],['A1','B2']).state.levels,['A1','B2']);
 const row=stateRow({...s,xp:-5,rounds:3,cursor:12,sound:false},[]);
 assert.equal(row.xp,0);
 assert.equal(row.sound,false);
 assert.deepEqual(row.levels,['A1']);
});
test('a level range from the cloud is filtered and ordered',()=>{
 assert.deepEqual(fromRows({state:{levels:['C1','bogus','A1']}}).levels,['A1','C1']);
 assert.equal(fromRows({state:{levels:[]}}).levels,null);
 assert.equal(fromRows({}).levels,null);
});
test('hasContent distinguishes a used account from a fresh one',()=>{
 assert.equal(hasContent(blank()),false);
 assert.equal(hasContent({...blank(),known:{'3':1}}),true);
 assert.equal(hasContent({...blank(),notes:{'3':'x'}}),false);
});
