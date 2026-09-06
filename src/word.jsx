import React,{useState,useMemo,useEffect} from 'react';
import {Volume2,ArrowRight,Check,Plus,X,RotateCcw,Shuffle,Pencil,Trash2} from 'lucide-react';
import {scene,SCENES,alternates,tokenize,schedule,stage,mastery,seen,posOf,MASTERY} from './engine';
import {Cues,speak} from './ui';

const DAY=86400000;
const ago=ms=>{const d=Math.floor((Date.now()-ms)/DAY);return d<=0?'today':d===1?'yesterday':d<30?d+' days ago':Math.round(d/30)+' months ago'};
const dueIn=(card,now)=>{
 if(!card||!card.reviews)return 'not reviewed yet';
 if(card.due<=now)return 'due now';
 const d=Math.max(1,Math.round((card.due-now)/DAY));
 return `due in ${d} day${d===1?'':'s'}`;
};

export default function Word({w,words,state,setState,notice,review,revealed,setRevealed,onRate,onExplore,onClose}){
 const [variant,setVariant]=useState(0),[editing,setEditing]=useState(false),[alt,setAlt]=useState(0);
 const card=state.cards[w.id],known=!!state.known[w.id],now=Date.now();
 const step=stage(card,known),done=mastery(card),total=seen(card);
 const note=state.notes[w.id]||'';
 const others=useMemo(()=>alternates(w,words),[w.id,words]);
 const sentences=useMemo(()=>[{example:w.example,translation:w.translation,from:null},
  ...others.map(o=>({example:o.example,translation:o.translation,from:o}))],[w.id,others]);
 const shown=sentences[alt%sentences.length];
 useEffect(()=>{setVariant(0);setAlt(0);setEditing(false)},[w.id]);

 const save=text=>setState(s=>{
  const notes={...s.notes};
  if(text.trim())notes[w.id]=text.trim();else delete notes[w.id];
  return {...s,notes,lib:s.known[w.id]?s.lib:{...s.lib,[w.id]:s.lib[w.id]||Date.now()}};
 });
 const collect=()=>setState(s=>({...s,lib:{...s.lib,[w.id]:Date.now()}}));
 const fileKnown=()=>{setState(s=>{const lib={...s.lib};delete lib[w.id];
  return {...s,known:{...s.known,[w.id]:Date.now()},lib}});notice(`“${w.word}” marked known.`)};
 const restore=()=>setState(s=>{const known={...s.known};delete known[w.id];return {...s,known,lib:{...s.lib,[w.id]:Date.now()}}});

 return <div className="word-page">
  <div className="word-head">
   <div>
    <h1 lang="fr">{w.article||w.word}</h1>
    <button className="ipa-line" onClick={()=>speak(w.word,notice)}>/{w.ipa}/ <Volume2 size={16}/></button>
   </div>
   <button className="icon-btn" onClick={onClose} aria-label="Back"><X size={18}/></button>
  </div>
  <p className="word-meaning">{review&&!revealed?'— hidden until you recall it —':w.meaning}</p>
  <div className="word-tags">
   <span className={'chip '+step.key}>{step.label}</span>
   <span className="chip">{w.level}</span>
   <span className="chip">{posOf(w)}</span>
   <span className="dim">#{String(w.id).padStart(4,'0')}</span>
  </div>

  <div className="word-stats">
   <article><strong>{done}<em>/{MASTERY}</em></strong><span>mastery</span>
    <div className="pips">{Array.from({length:MASTERY},(_,i)=><i key={i} className={i<done?'done':''}/>)}</div></article>
   <article><strong>{total}</strong><span>times seen</span></article>
   <article><strong className="ok">{card?.clean||0}</strong><span>clean</span></article>
   <article><strong className="warn">{card?.close||0}</strong><span>close</span></article>
   <article><strong className="bad">{card?.missed||0}</strong><span>missed</span></article>
   <article><strong>{total?Math.round((card.clean||0)/total*100):0}%</strong><span>clean rate</span></article>
  </div>
  <p className="word-line">{known?'Known — out of rotation.':dueIn(card,now)}
   {card?.interval?<> <i>·</i> interval {card.interval}d</>:null}
   {card?.last?<> <i>·</i> last seen {ago(card.last)}</>:null}
   {state.lib[w.id]?<> <i>·</i> in your library</>:null}</p>

  <section className="panel">
   <div className="panel-head"><h2>Sound cast</h2><small>read left to right</small></div>
   <Cues ipa={w.ipa} onPick={onExplore}/>
  </section>

  <section className="panel">
   <div className="panel-head"><h2>Mnemonic</h2>
    <div className="panel-actions">
     <button onClick={()=>setVariant(v=>v+1)}><Shuffle size={14}/> Generate another</button>
     {!editing&&<button onClick={()=>setEditing(true)}><Pencil size={14}/> {note?'Edit mine':'Write my own'}</button>}
    </div></div>
   {editing
    ?<div className="note-edit">
      <textarea autoFocus aria-label="Your mnemonic" defaultValue={note||scene(w,variant)}
       onBlur={e=>{save(e.target.value);setEditing(false)}}
       placeholder="Make the meaning concrete, exaggerated, and personal…"/>
      <small>Saves when you click away. Empty it to fall back to the generated one.</small>
     </div>
    :<>
      <p className="scene-text">{note||scene(w,variant)}</p>
      <p className="panel-foot">{note?'Your scene.':`Generated from the sounds above · variant ${variant%SCENES+1} of ${SCENES}`}
       {note&&<button className="link" onClick={()=>save('')}><Trash2 size={13}/> drop mine</button>}
       {!note&&<button className="link" onClick={()=>save(scene(w,variant))}>keep this one</button>}</p>
     </>}
  </section>

  <section className="panel">
   <div className="panel-head"><h2>In a sentence</h2>
    <div className="panel-actions">
     <button onClick={()=>setAlt(a=>a+1)} disabled={sentences.length<2}>
      <RotateCcw size={14}/> {sentences.length<2?'no others in the corpus':'Another sentence'}</button>
    </div></div>
   <div className="sentence-row">
    <button className="say" onClick={()=>speak(shown.example,notice)} aria-label="Hear it"><Volume2 size={17}/></button>
    <div><p lang="fr">{shown.example}</p><span>{shown.translation}</span></div>
   </div>
   <p className="panel-foot">{sentences.length<2?'The corpus only carries one sentence for this word.'
    :`${alt%sentences.length+1} of ${sentences.length} · ${shown.from?`borrowed from “${shown.from.word}”`:'this word’s own sentence'}`}</p>
  </section>

  <div className="word-actions">
   {review
    ?revealed
      ?<div className="rating">{['again','hard','good','easy'].map(g=>
        <button key={g} onClick={()=>onRate(g)}>{g}<small>{g==='again'?'1 min':schedule(card,g).interval+' days'}</small></button>)}</div>
      :<button className="primary" onClick={()=>setRevealed(true)}>Reveal <ArrowRight size={17}/></button>
    :<button className="primary" onClick={()=>onRate('good')}>Got it <ArrowRight size={17}/></button>}
   {!state.lib[w.id]&&!known&&<button className="ghost" onClick={collect}><Plus size={14}/> Add to library</button>}
   {known
    ?<button className="ghost" onClick={restore}><RotateCcw size={14}/> Study again</button>
    :<button className="ghost" onClick={fileKnown}><Check size={14}/> I know this</button>}
  </div>
 </div>;
}
