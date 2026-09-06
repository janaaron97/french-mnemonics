import React,{useState,useMemo,useEffect} from 'react';
import {Volume2,ArrowRight,Check,Plus,X,RotateCcw,Shuffle,Pencil,Trash2,Sparkles,Loader2} from 'lucide-react';
import {scene,SCENES,alternates,tokenize,schedule,stage,mastery,seen,posOf,MASTERY} from './engine';
import {Cues,speak} from './ui';
import {mnemonicFor,sentenceFor,explainFor} from './generate.js';

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
 const [busy,setBusy]=useState(''),[failed,setFailed]=useState('');
 const card=state.cards[w.id],known=!!state.known[w.id],now=Date.now();
 const step=stage(card,known),done=mastery(card),total=seen(card);
 const note=state.notes[w.id]||'',ai=!!state.aiNotes[w.id];
 const others=useMemo(()=>alternates(w,words),[w.id,words]);
 const mine=state.phrases[w.id],broke=state.notesOn[w.id];
 const sentences=useMemo(()=>[
  ...(mine?[{example:mine.fr,translation:mine.en,from:null,made:true}]:[]),
  {example:w.example,translation:w.translation,from:null},
  ...others.map(o=>({example:o.example,translation:o.translation,from:o}))],[w.id,others,mine?.fr]);
 const shown=sentences[alt%sentences.length];
 useEffect(()=>{setVariant(0);setAlt(0);setEditing(false);setBusy('');setFailed('')},[w.id]);

 const save=(text,byAI=false)=>setState(s=>{
  const notes={...s.notes},aiNotes={...s.aiNotes};
  if(text.trim()){notes[w.id]=text.trim();if(byAI)aiNotes[w.id]=1;else delete aiNotes[w.id]}
  else{delete notes[w.id];delete aiNotes[w.id]}
  return {...s,notes,aiNotes,lib:s.known[w.id]?s.lib:{...s.lib,[w.id]:s.lib[w.id]||Date.now()}};
 });
 // Generation is always an explicit choice: nothing here runs on render.
 const run=async(what,job)=>{
  setBusy(what);setFailed('');
  try{await job()}catch(err){setFailed(err?.message||'Generation failed.')}
  setBusy('');
 };
 const writeMnemonic=()=>run('mnemonic',async()=>{
  const {scene:text,incomplete}=await mnemonicFor(w);
  save(text,true);
  if(incomplete?.length)notice(`Generated, but it left out: ${incomplete.join(', ')}. Generate again for a cleaner one.`);
 });
 const writeSentence=()=>run('sentence',async()=>{
  const {french,english}=await sentenceFor(w);
  setState(s=>({...s,phrases:{...s.phrases,[w.id]:{fr:french,en:english}},
   lib:s.known[w.id]?s.lib:{...s.lib,[w.id]:s.lib[w.id]||Date.now()}}));
  setAlt(0);
 });
 const dropSentence=()=>setState(s=>{const phrases={...s.phrases};delete phrases[w.id];return {...s,phrases}});
 const writeBreakdown=()=>run('explain',async()=>{
  const {explain,sentence}=await explainFor(w,shown.example);
  setState(s=>({...s,notesOn:{...s.notesOn,[w.id]:{text:explain,of:sentence}},
   lib:s.known[w.id]?s.lib:{...s.lib,[w.id]:s.lib[w.id]||Date.now()}}));
 });
 const dropBreakdown=()=>setState(s=>{const notesOn={...s.notesOn};delete notesOn[w.id];return {...s,notesOn}});
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
   <article><strong>{done}<em>/{MASTERY}</em></strong><span>written cleanly</span>
    <div className="pips">{Array.from({length:MASTERY},(_,i)=><i key={i} className={i<done?'done':''}/>)}</div></article>
   <article><strong>{total}</strong><span>times seen</span></article>
   <article><strong className="ok">{card?.clean||0}</strong><span>right</span></article>
   <article><strong className="warn">{card?.close||0}</strong><span>close</span></article>
   <article><strong className="bad">{card?.missed||0}</strong><span>missed</span></article>
   <article><strong>{total?Math.round((card.clean||0)/total*100):0}%</strong><span>right first time</span></article>
  </div>
  <p className="subtle">Every round counts towards the answer log. Only rounds that ask you to write
   the French move mastery, so a meaning check is recorded here without filling a pip.</p>
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
     <button onClick={writeMnemonic} disabled={!!busy} className="ai">
      {busy==='mnemonic'?<Loader2 size={14} className="spin"/>:<Sparkles size={14}/>} Write one with AI</button>
     <button onClick={()=>setVariant(v=>v+1)}><Shuffle size={14}/> Another template</button>
     {!editing&&<button onClick={()=>setEditing(true)}><Pencil size={14}/> {note?'Edit':'Write my own'}</button>}
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
      <p className="panel-foot">
       {note?(ai?'Written by AI from the sound cast, saved to this word.':'Your scene.')
        :`Template · variant ${variant%SCENES+1} of ${SCENES}`}
       {note&&<button className="link" onClick={()=>save('')}><Trash2 size={13}/> drop it</button>}
       {!note&&<button className="link" onClick={()=>save(scene(w,variant))}>keep this one</button>}</p>
     </>}
  </section>

  <section className="panel">
   <div className="panel-head"><h2>In a sentence</h2>
    <div className="panel-actions">
     <button onClick={writeSentence} disabled={!!busy} className="ai">
      {busy==='sentence'?<Loader2 size={14} className="spin"/>:<Sparkles size={14}/>} {mine?'Write another':'Write one with AI'}</button>
     <button onClick={()=>setAlt(a=>a+1)} disabled={sentences.length<2}>
      <RotateCcw size={14}/> {sentences.length<2?'only one in the corpus':'Next sentence'}</button>
     <button onClick={broke?dropBreakdown:writeBreakdown} disabled={!!busy} className={broke?'':'ai'}>
      {busy==='explain'?<Loader2 size={14} className="spin"/>:broke?<Trash2 size={14}/>:<Sparkles size={14}/>}
      {broke?'Drop breakdown':'Explain it'}</button>
    </div></div>
   {failed&&<p className="gen-error" role="alert">{failed}</p>}
   <div className="sentence-row">
    <button className="say" onClick={()=>speak(shown.example,notice)} aria-label="Hear it"><Volume2 size={17}/></button>
    <div><p lang="fr">{shown.example}</p><span>{shown.translation}</span></div>
   </div>
   {broke&&<div className="breakdown">{broke.text}</div>}
   {broke&&broke.of!==shown.example&&<p className="panel-foot warn-foot">This breakdown was written for “{broke.of}”.</p>}
   <p className="panel-foot">
    {`${alt%sentences.length+1} of ${sentences.length} · `}
    {shown.made?'written by AI for this word':shown.from?`borrowed from “${shown.from.word}”`:'the corpus sentence for this word'}
    {shown.made&&<button className="link" onClick={dropSentence}><Trash2 size={13}/> drop it</button>}</p>
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
