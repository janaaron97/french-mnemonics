import React,{useState,useMemo} from 'react';
import {Search,Check,X,Play,RotateCcw,Sparkles,ArrowRight} from 'lucide-react';
import {posOf} from './engine';
import {LevelChips,speak} from './ui';

const DAY=86400000;
const shelves=[['studying','Studying'],['known','Known'],['all','Everything']];
const when=(card,now)=>{
 if(!card)return {tone:'new',text:'Not yet reviewed'};
 if(card.due<=now)return {tone:'due',text:'Due now'};
 const days=Math.max(1,Math.round((card.due-now)/DAY));
 return {tone:'set',text:`Due in ${days} day${days===1?'':'s'}`};
};

export default function Library({words,state,setState,picked,setPicked,notice,openWord,onPlay}){
 const [shelf,setShelf]=useState('studying'),[query,setQuery]=useState(''),[range,setRange]=useState(false);
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
   return (ca?ca.due:Infinity)-(cb?cb.due:Infinity)||a.id-b.id;
  });

 const setKnown=w=>setState(st=>{const lib={...st.lib};delete lib[w.id];return {...st,known:{...st.known,[w.id]:Date.now()},lib}});
 const restore=w=>setState(st=>{const known={...st.known};delete known[w.id];return {...st,known,lib:{...st.lib,[w.id]:Date.now()}}});
 const drop=w=>setState(st=>{const lib={...st.lib},known={...st.known},cards={...st.cards};
  delete lib[w.id];delete known[w.id];delete cards[w.id];return {...st,lib,known,cards}});

 return <>
  <div className="page-title"><div className="eyebrow">YOUR WORDS</div><h1>The library.</h1>
   <p>Everything you have collected — from played sentences, sorted cards, and words you opened by hand.</p></div>

  <div className="lib-stats">
   <article className="lead"><strong>{studying.length.toLocaleString()}</strong><span>studying</span>
    <button className="primary" disabled={!studying.length} onClick={()=>onPlay('library')}><Play size={16}/> Play these</button></article>
   <article><strong>{due.length.toLocaleString()}</strong><span>due now</span></article>
   <article><strong>{known.length.toLocaleString()}</strong><span>marked known</span></article>
   <article><strong>{Object.values(state.cards).filter(c=>c.interval>=21).length.toLocaleString()}</strong><span>on 21+ day intervals</span></article>
  </div>

  <div className="shelf-tabs">{shelves.map(([k,label])=>
   <button key={k} className={shelf===k?'on':''} onClick={()=>setShelf(k)}>{label}
    <i>{k==='known'?known.length:k==='all'?studying.length+known.length:studying.length}</i></button>)}</div>

  <div className="filters">
   <label className="search"><Search size={18}/><input placeholder="Search your words…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <button className={'range-toggle'+(range?' on':'')} onClick={()=>setRange(r=>!r)}>{range?'Filtering by level':'All levels'}</button>
  </div>
  {range&&<div className="setup-row"><LevelChips picked={picked} onChange={setPicked} compact/></div>}

  {rows.length?<>
   <div className="word-list">{rows.slice(0,300).map(w=>{
    const stamp=state.known[w.id]?{tone:'known',text:'Known'}:when(state.cards[w.id],now);
    return <div key={w.id} className="lib-row">
     <button className="lib-open" onClick={()=>openWord(w)}>
      <div><strong lang="fr">{w.article||w.word}</strong><span>/{w.ipa}/ · {posOf(w)}</span></div>
      <div className="lib-meaning">{w.meaning}</div>
     </button>
     <span className={'tag '+stamp.tone}>{stamp.text}</span>
     <span className="tag">{w.level}</span>
     <div className="lib-actions">
      <button title="Hear it" aria-label={'Hear '+w.word} onClick={()=>speak(w.word,notice)}><Sparkles size={15}/></button>
      {state.known[w.id]
       ?<button title="Move back to studying" aria-label={'Study '+w.word+' again'} onClick={()=>restore(w)}><RotateCcw size={15}/></button>
       :<button title="Mark known" aria-label={'Mark '+w.word+' known'} onClick={()=>setKnown(w)}><Check size={15}/></button>}
      <button title="Remove from library" aria-label={'Remove '+w.word} onClick={()=>drop(w)}><X size={15}/></button>
     </div>
    </div>;
   })}</div>
   <p className="subtle">{rows.length>300?`Showing the first 300 of ${rows.length.toLocaleString()}. Narrow your search to see more.`:`${rows.length.toLocaleString()} word${rows.length===1?'':'s'}.`}</p>
  </>:<div className="empty-state">
   <Sparkles size={26}/>
   <h3>{shelf==='known'?'Nothing marked known yet.':'Your library is empty.'}</h3>
   <p>{shelf==='known'?'Swipe left while sorting, or use “I know this” during a round, to file words here.'
    :'Play a cloze round and every word in the sentence lands here, or sort a stack and swipe words right.'}</p>
   <button className="primary" onClick={()=>onPlay('discover')}>Start a round <ArrowRight size={17}/></button>
  </div>}
 </>;
}
