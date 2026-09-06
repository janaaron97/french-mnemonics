import React,{useState,useMemo} from 'react';
import {Search,Check,X,Play,RotateCcw,Sparkles,ArrowRight,ChevronDown,Volume2} from 'lucide-react';
import {posOf,stage,mastery,seen,MASTERY} from './engine';
import {LevelChips,speak} from './ui';

const DAY=86400000;
const shelves=[['studying','Studying'],['known','Known'],['all','Everything']];
const orders=[['weakest','Weakest first'],['due','Due first'],['recent','Recently added'],['alpha','A → Z']];
const ago=ms=>{
 const d=Math.floor((Date.now()-ms)/DAY);
 return d<=0?'today':d===1?'yesterday':d<30?d+' days ago':Math.round(d/30)+' months ago';
};
const when=(card,now)=>{
 if(!card||!card.reviews)return 'Not yet reviewed';
 if(card.due<=now)return 'Due now';
 const days=Math.max(1,Math.round((card.due-now)/DAY));
 return `Due in ${days} day${days===1?'':'s'}`;
};

function Row({w,card,known,now,open,onToggle,actions}){
 const step=stage(card,known),done=mastery(card),total=seen(card);
 const clean=card?.clean||0,close=card?.close||0,missed=card?.missed||0;
 return <div className={'lib-row'+(open?' open':'')}>
  <button className="lib-open" onClick={onToggle} aria-expanded={open}>
   <div><strong lang="fr">{w.article||w.word}</strong><span>/{w.ipa}/ · {posOf(w)}</span></div>
   <div className="lib-meaning">{w.meaning}</div>
  </button>
  <div className="mastery" title={done+' of '+MASTERY+' clean answers'} aria-label={'Mastery '+done+' of '+MASTERY}>
   <div className="pips">{Array.from({length:MASTERY},(_,i)=><i key={i} className={i<done?'done':''}/>)}</div>
   <small>{known?'mastered':done+'/'+MASTERY}</small>
  </div>
  <span className={'chip '+step.key}>{step.label}</span>
  <div className="lib-actions">{actions}
   <button className="chev" aria-label={open?'Hide details':'Show details'} onClick={onToggle}><ChevronDown size={15}/></button></div>
  {open&&<div className="lib-detail">
   <div className="detail-grid">
    <article><strong>{total}</strong><span>times seen</span></article>
    <article><strong className="ok">{clean}</strong><span>clean</span></article>
    <article><strong className="warn">{close}</strong><span>close</span></article>
    <article><strong className="bad">{missed}</strong><span>missed</span></article>
    <article><strong>{total?Math.round(clean/total*100):0}%</strong><span>clean rate</span></article>
   </div>
   {!!total&&<div className="split" role="img" aria-label={`${clean} clean, ${close} close, ${missed} missed`}>
    {clean>0&&<i className="ok" style={{flex:clean}}/>}
    {close>0&&<i className="warn" style={{flex:close}}/>}
    {missed>0&&<i className="bad" style={{flex:missed}}/>}
   </div>}
   <p className="detail-line">
    {known?'Marked known — it no longer comes up in rounds.':when(card,now)}
    {card?.last?<> <i>·</i> last seen {ago(card.last)}</>:null}
    {card?.interval?<> <i>·</i> interval {card.interval} day{card.interval===1?'':'s'}</>:null}
    <> <i>·</i> </>{w.level} <i>·</i> #{String(w.id).padStart(4,'0')}
   </p>
   <p className="detail-line quiet" lang="fr">{w.example} <span>{w.translation}</span></p>
  </div>}
 </div>;
}

export default function Library({words,state,setState,picked,setPicked,notice,openWord,onPlay}){
 const [shelf,setShelf]=useState('studying'),[query,setQuery]=useState(''),[range,setRange]=useState(false);
 const [order,setOrder]=useState('weakest'),[open,setOpen]=useState(null);
 const now=Date.now();

 const {studying,known,due}=useMemo(()=>({
  studying:words.filter(w=>state.lib[w.id]&&!state.known[w.id]),
  known:words.filter(w=>state.known[w.id]),
  due:words.filter(w=>state.lib[w.id]&&!state.known[w.id]&&state.cards[w.id]?.due<=now)
 }),[words,state.lib,state.known,state.cards]);

 const q=query.trim().toLowerCase();
 const rows=(shelf==='known'?known:shelf==='all'?words.filter(w=>state.lib[w.id]||state.known[w.id]):studying)
  .filter(w=>(!range||picked.includes(w.level))&&(!q||(w.word+' '+w.meaning+' '+(w.article||'')).toLowerCase().includes(q)))
  .sort((a,b)=>{
   const ca=state.cards[a.id],cb=state.cards[b.id];
   if(order==='alpha')return a.word.localeCompare(b.word,'fr');
   if(order==='recent')return (state.lib[b.id]||state.known[b.id]||0)-(state.lib[a.id]||state.known[a.id]||0);
   if(order==='due')return (ca?ca.due:Infinity)-(cb?cb.due:Infinity)||a.id-b.id;
   return mastery(ca)-mastery(cb)||(cb?.missed||0)-(ca?.missed||0)||a.id-b.id;
  });

 const setKnown=w=>setState(st=>{const lib={...st.lib};delete lib[w.id];return {...st,known:{...st.known,[w.id]:Date.now()},lib}});
 const restore=w=>setState(st=>{const known={...st.known};delete known[w.id];return {...st,known,lib:{...st.lib,[w.id]:Date.now()}}});
 const drop=w=>setState(st=>{const lib={...st.lib},known={...st.known},cards={...st.cards},notes={...st.notes};
  delete lib[w.id];delete known[w.id];delete cards[w.id];delete notes[w.id];return {...st,lib,known,cards,notes}});

 const totals=useMemo(()=>{
  let cleanSum=0,seenSum=0;
  for(const w of studying)cleanSum+=mastery(state.cards[w.id]),seenSum+=seen(state.cards[w.id]);
  return {cleanSum,seenSum,avg:studying.length?cleanSum/studying.length:0};
 },[studying,state.cards]);

 return <>
  <div className="page-title"><h1>Library</h1></div>

  <div className="lib-stats">
   <article className="lead"><strong>{studying.length.toLocaleString()}</strong><span>studying</span>
    <button className="primary" disabled={!studying.length} onClick={()=>onPlay('library')}><Play size={16}/> Play these</button></article>
   <article><strong>{due.length.toLocaleString()}</strong><span>due now</span></article>
   <article><strong>{known.length.toLocaleString()}</strong><span>known</span></article>
   <article><strong>{totals.avg.toFixed(1)}<em>/{MASTERY}</em></strong><span>average mastery</span></article>
  </div>

  <div className="shelf-tabs">{shelves.map(([k,label])=>
   <button key={k} className={shelf===k?'on':''} onClick={()=>{setShelf(k);setOpen(null)}}>{label}
    <i>{k==='known'?known.length:k==='all'?studying.length+known.length:studying.length}</i></button>)}</div>

  <div className="filters">
   <label className="search"><Search size={18}/><input placeholder="Search your words…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <select aria-label="Sort order" value={order} onChange={e=>setOrder(e.target.value)}>
    {orders.map(([k,label])=><option key={k} value={k}>{label}</option>)}</select>
   <button className={'range-toggle'+(range?' on':'')} onClick={()=>setRange(r=>!r)}>{range?'By level':'All levels'}</button>
  </div>
  {range&&<div className="setup-row"><LevelChips picked={picked} onChange={setPicked} compact/></div>}

  {rows.length?<>
   <div className="word-list">{rows.slice(0,300).map(w=>
    <Row key={w.id} w={w} card={state.cards[w.id]} known={!!state.known[w.id]} now={now}
     open={open===w.id} onToggle={()=>setOpen(o=>o===w.id?null:w.id)}
     actions={<>
      <button title="Hear it" aria-label={'Hear '+w.word} onClick={()=>speak(w.word,notice)}><Volume2 size={15}/></button>
      <button title="Open in Learn" aria-label={'Open '+w.word} onClick={()=>openWord(w)}><ArrowRight size={15}/></button>
      {state.known[w.id]
       ?<button title="Move back to studying" aria-label={'Study '+w.word+' again'} onClick={()=>restore(w)}><RotateCcw size={15}/></button>
       :<button title="Mark known" aria-label={'Mark '+w.word+' known'} onClick={()=>setKnown(w)}><Check size={15}/></button>}
      <button title="Remove from library" aria-label={'Remove '+w.word} onClick={()=>drop(w)}><X size={15}/></button>
     </>}/>)}</div>
   <p className="subtle">{rows.length>300?`Showing the first 300 of ${rows.length.toLocaleString()}. Narrow your search to see more.`
    :`${rows.length.toLocaleString()} word${rows.length===1?'':'s'} · ${totals.seenSum.toLocaleString()} answers recorded across your library.`}</p>
  </>:<div className="empty-state">
   <Sparkles size={26}/>
   <h3>{shelf==='known'?'Nothing marked known yet.':'Your library is empty.'}</h3>
   <p>{shelf==='known'?`Words land here when you swipe left while sorting, use “I know this” in a round, or spell one cleanly ${MASTERY} times.`
    :'Play a cloze round and every word in the sentence lands here, or sort a stack and swipe words right.'}</p>
   <button className="primary" onClick={()=>onPlay('discover')}>Start a round <ArrowRight size={17}/></button>
  </div>}
 </>;
}
