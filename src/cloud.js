import {createClient} from '@supabase/supabase-js';
import {empty,levels as LEVELS} from './engine.js';

export const config={
 url:import.meta.env?.VITE_SUPABASE_URL||'https://readnsbbkmvhguuiaxkv.supabase.co',
 key:import.meta.env?.VITE_SUPABASE_KEY||'sb_publishable_sFGKW5TGB3Mu9RjC2iJLhQ_TL1IJZMF'
};
export const supabase=createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true}});

const stamp=ms=>new Date(Number(ms)||0).toISOString();
const ms=iso=>iso?Date.parse(iso):0;

export function fromRows({library=[],reviews=[],state=null}){
 const out={...empty,cards:{},notes:{},lib:{},known:{}};
 for(const r of library){
  const id=String(r.word_id);
  if(r.known_at)out.known[id]=ms(r.known_at);else out.lib[id]=ms(r.added_at);
  if(r.note)out.notes[id]=r.note;
 }
 for(const r of reviews)out.cards[String(r.word_id)]={
  due:ms(r.due),interval:r.interval_days,reviews:r.reviews,last:ms(r.last_reviewed),
  clean:r.clean||0,close:r.close||0,missed:r.missed||0};
 if(state){
  out.xp=Number(state.xp)||0;out.rounds=state.rounds||0;out.best=state.best||0;
  out.cursor=state.cursor||0;out.sound=state.sound!==false;
 }
 const picked=Array.isArray(state?.levels)?state.levels.filter(l=>LEVELS.includes(l)):null;
 return {state:out,levels:picked?.length?LEVELS.filter(l=>picked.includes(l)):null};
}

export const libraryRow=(s,id)=>{
 const studying=s.lib[id]!==undefined,known=s.known[id]!==undefined;
 if(!studying&&!known)return null;
 return {word_id:Number(id),note:s.notes[id]||'',
  known_at:known?stamp(s.known[id]):null,
  added_at:stamp(known?s.known[id]:s.lib[id])};
};
export const reviewRow=(s,id)=>{
 const c=s.cards[id];
 if(!c)return null;
 const count=n=>Math.max(0,Math.round(n||0));
 return {word_id:Number(id),due:stamp(c.due),interval_days:count(c.interval),reviews:count(c.reviews),
  last_reviewed:c.last?stamp(c.last):null,clean:count(c.clean),close:count(c.close),missed:count(c.missed)};
};
export const stateRow=(s,picked)=>({
 xp:Math.max(0,Math.round(s.xp||0)),rounds:Math.max(0,s.rounds||0),best:Math.max(0,s.best||0),
 cursor:Math.max(0,s.cursor||0),sound:s.sound!==false,
 levels:picked?.length?picked:['A1'],updated_at:new Date().toISOString()});

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const keysOf=(...maps)=>new Set(maps.flatMap(m=>Object.keys(m||{})));

export function diff(prev,next,prevLevels,nextLevels){
 const upLibrary=[],delLibrary=[],upReviews=[],delReviews=[];
 for(const id of keysOf(prev.lib,prev.known,next.lib,next.known,prev.notes,next.notes)){
  const was=libraryRow(prev,id),now=libraryRow(next,id);
  if(!now){if(was)delLibrary.push(Number(id));continue}
  if(!same(was,now))upLibrary.push(now);
 }
 for(const id of keysOf(prev.cards,next.cards)){
  const was=reviewRow(prev,id),now=reviewRow(next,id);
  if(!now){if(was)delReviews.push(Number(id));continue}
  if(!same(was,now))upReviews.push(now);
 }
 const before=stateRow(prev,prevLevels),after=stateRow(next,nextLevels);
 delete before.updated_at;delete after.updated_at;
 return {upLibrary,delLibrary,upReviews,delReviews,state:same(before,after)?null:stateRow(next,nextLevels)};
}
export const isEmpty=d=>!d.upLibrary.length&&!d.delLibrary.length&&!d.upReviews.length&&!d.delReviews.length&&!d.state;
export const hasContent=s=>!!(Object.keys(s.lib).length||Object.keys(s.known).length||Object.keys(s.cards).length);

export async function load(userId){
 const [library,reviews,state]=await Promise.all([
  supabase.from('echo_library').select('word_id,note,known_at,added_at').eq('user_id',userId),
  supabase.from('echo_reviews').select('word_id,due,interval_days,reviews,last_reviewed,clean,close,missed').eq('user_id',userId),
  supabase.from('echo_state').select('xp,rounds,best,cursor,sound,levels').eq('user_id',userId).maybeSingle()
 ]);
 for(const r of [library,reviews,state])if(r.error)throw r.error;
 return {...fromRows({library:library.data,reviews:reviews.data,state:state.data}),fresh:!state.data&&!library.data.length};
}

export async function save(userId,changes){
 const own=rows=>rows.map(r=>({...r,user_id:userId}));
 const jobs=[];
 if(changes.upLibrary.length)jobs.push(supabase.from('echo_library').upsert(own(changes.upLibrary),{onConflict:'user_id,word_id'}));
 if(changes.upReviews.length)jobs.push(supabase.from('echo_reviews').upsert(own(changes.upReviews),{onConflict:'user_id,word_id'}));
 if(changes.delLibrary.length)jobs.push(supabase.from('echo_library').delete().eq('user_id',userId).in('word_id',changes.delLibrary));
 if(changes.delReviews.length)jobs.push(supabase.from('echo_reviews').delete().eq('user_id',userId).in('word_id',changes.delReviews));
 if(changes.state)jobs.push(supabase.from('echo_state').upsert({...changes.state,user_id:userId},{onConflict:'user_id'}));
 for(const r of await Promise.all(jobs))if(r.error)throw r.error;
}
