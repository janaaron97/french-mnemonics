import React,{useState,useMemo,useRef,useEffect} from 'react';
import {createPortal} from 'react-dom';
import {X,ArrowRight,Check,Flame,Volume2,Sparkles,Layers,Compass,History,Trophy,RotateCcw,Ear,HelpCircle,GraduationCap,Target,Clock,Loader2,BookOpen,ChevronRight,Languages,PenLine,Gift,TrendingUp,TrendingDown,Plus} from 'lucide-react';
import {queue,card,check,checkMeaning,sentenceIds,define,WORD_RE,stage,applyGrade,addDay,addStudy,mastery,spelledCount,standing,rankName,streak as dayStreak,MASTERY,posOf} from './engine';
import {Cues,speak,tone,buzz,useKeys,useVisualViewport,Counter} from './ui';
import {explainFor,composeFor} from './generate.js';

const ROUND=[7,12,20];
const ACCENTS=['é','è','ê','à','â','î','ï','ô','û','ù','ç','œ'];
const decks=[
 ['discover',Compass,'Discover','A1 → C1 in order, with due reviews woven in'],
 ['library',Layers,'My library','Words you have collected, due ones first'],
 ['review',History,'Due reviews','Everything the schedule has brought back'],
 ['english',Languages,'Meaning check','Your studying words — type the English'],
 ['compose',PenLine,'Write a sentence','Use a word you are studying; AI marks it']
];
// Each sentence costs a marking call, so a compose round is deliberately short.
const CAP={compose:5};
const BONUS=75;
// A clean answer pays more the longer the run; a miss costs a flat amount and
// resets the run, so the next clean one earns at the bottom of the scale again.
// That is what lets a level fall: a bad stretch outruns the earning.
const points=streak=>100+Math.min(streak,8)*25;
const MISS=-75;
const signed=n=>(n>0?'+':'')+n.toLocaleString();
// Every word in a French sentence is tappable: the corpus knows most of them and
// a small built-in glossary covers the grammar it leaves out. Punctuation and
// spacing stay outside the button, so the sentence still reads as a sentence.
function Tappable({text,words,onPick}){
 const src=String(text??'');
 const out=[];
 let at=0,k=0;
 for(const m of src.matchAll(WORD_RE)){
  if(m.index>at)out.push(src.slice(at,m.index));
  const found=define(m[0],words);
  out.push(found.length
   ?<button type="button" className="tok" key={k++} onClick={e=>{e.stopPropagation();onPick(found,m[0])}}>{m[0]}</button>
   :<span className="tok mute" key={k++}>{m[0]}</span>);
  at=m.index+m[0].length;
 }
 if(at<src.length)out.push(src.slice(at));
 return <>{out}</>;
}

// A sheet rather than a bubble anchored to the word: it never runs off the edge
// of a phone, and the arena is already a fixed full-screen layout.
function Gloss({found,token,onClose,notice,state,setState}){
 if(!found)return null;
 // Through a portal: inside the arena it would sit in that stacking context and
 // the answer bar would paint over it.
 return createPortal(<div className="gloss-wrap" onPointerDown={onClose}>
  <div className="gloss" onPointerDown={e=>e.stopPropagation()} role="dialog" aria-label={'What “'+token+'” means'}>
   {found.map((w,i)=>{
    const step=w.entry?stage(state.cards[w.id],state.known[w.id]):null;
    const held=w.entry&&(state.lib[w.id]||state.known[w.id]);
    return <div className="gloss-row" key={i}>
     <div className="gloss-head">
      <strong lang="fr">{w.article||w.word}</strong>
      {w.ipa&&<i>/{w.ipa}/</i>}
      <button type="button" className="say" onClick={()=>speak(w.word,notice)} aria-label="Hear it"><Volume2 size={16}/></button>
     </div>
     <p>{w.meaning}</p>
     <div className="gloss-tags">
      {w.entry
       ?<><span className="chip">{w.level}</span><span className="chip">{posOf(w)}</span>
         {step&&<span className="chip">{step.label}</span>}
         {!held&&<button type="button" className="chip add"
           onClick={()=>{setState(st=>({...st,lib:{...st.lib,[w.id]:Date.now()}}));notice(`“${w.word}” added to your library.`)}}>
           <Plus size={12}/> add</button>}</>
       :<span className="chip">grammar — not a study word</span>}
     </div>
    </div>;
   })}
   <button type="button" className="gloss-x" onClick={onClose} aria-label="Close"><X size={18}/></button>
  </div>
 </div>,document.body);
}
function Blank({c,draft,setDraft,field,result,tone3,teaching,submit}){
 // An English meaning can be a whole phrase, so it gets a field that wraps —
 // otherwise TEACH ME shows the first half of the answer and hides the rest.
 // A textarea does not submit on Enter by itself, so put that back by hand —
 // and stop the key there, or the window handler that advances a graded card
 // sees the same press and skips straight past the verdict.
 const shared={ref:field,value:result?c.answer:draft,onChange:e=>setDraft(e.target.value),
  readOnly:!!result,autoFocus:true,enterKeyHint:'go',autoComplete:'off',autoCorrect:'off',
  autoCapitalize:'off',spellCheck:false,placeholder:teaching?c.answer:''};
 if(c.kind==='meaning')return <textarea {...shared} rows={2} lang="en"
  className={'blank prose '+(result?tone3:'')} aria-label="Type the English meaning"
  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.stopPropagation();submit()}}}/>;
 return <input {...shared} lang="fr" style={{width:Math.max(c.length,draft.length,3)+1+'ch'}}
  className={'blank '+(result?tone3:'')} aria-label="Type the missing word"/>;
}
const grades={clean:'good',close:'hard',missed:'again'};
// Mastery only advances on a word you spelled exactly, with no letters uncovered.
const judge=(result,assisted)=>result==='wrong'?'missed':result==='accent'||result==='near'||assisted?'close':'clean';

export default function Play({words,state,setState,picked,setPicked,notice,openWord,launch,onLaunched}){
 const [stage,setStage]=useState('setup'),[size,setSize]=useState(12),[mode,setMode]=useState('discover');
 const [s,setS]=useState(null),[hint,setHint]=useState(false),[draft,setDraft]=useState(''),[shown,setShown]=useState(0),[teaching,setTeaching]=useState(false);
 const timer=useRef(0),live=useRef(null),field=useRef(null);
 live.current=s;

 const counts=useMemo(()=>Object.fromEntries(decks.map(([m])=>
  [m,queue({words,mode:m,progress:state,size:1e5}).length])),[words,state]);

 const start=(m=mode)=>{
  const list=queue({words,mode:m,progress:state,size:Math.min(size,CAP[m]||size)});
  if(!list.length)return notice(m==='review'?'Nothing is due yet. Play a discover round to start your schedule.'
   :m==='discover'?'Every word in the corpus is marked known.'
   :'Your library is empty. Sort some words, or play a discover round to collect some.');
  // The bonus word is the next card in the round, so it is always something you
  // are studying and something you will meet again in a moment.
  const deck=list.map(w=>card(w,m));
  if(m==='compose')deck.forEach((c,i)=>{c.bonus=deck.length>1?deck[(i+1)%deck.length].word:null});
  clearTimeout(timer.current);setMode(m);setHint(false);setDraft('');setShown(0);setTeaching(false);
  setS({deck,i:0,score:0,streak:0,best:0,right:0,answered:0,collected:0,gain:0,bonuses:0,missed:[],done:[],taughtCount:0,startedAt:Date.now(),result:null,typed:'',mode:m,levelAtStart:standing(state.points).level});
  setStage('play');
 };

 const finish=v=>{
  clearTimeout(timer.current);
  setState(st=>({...st,rounds:st.rounds+1,best:Math.max(st.best,v.best)}));
  tone([[523,0,.12],[659,.1,.12],[784,.2,.24]],state.sound);
  setStage('done');
 };
 const next=()=>{
  clearTimeout(timer.current);setHint(false);setDraft('');setShown(0);setTeaching(false);setGloss(null);
  const v=live.current;
  if(!v)return;
  if(v.i+1>=v.deck.length)return finish(v);
  setS({...v,i:v.i+1,result:null,typed:''});
 };

 const settle=(result,typed,review=null)=>{
  const v=live.current;
  if(!v||v.result)return;
  const c=v.deck[v.i],now=Date.now();
  const outcome=review?review.outcome:teaching?'missed':judge(result,shown>0),ok=outcome!=='missed';
  const earned=outcome==='clean'?points(v.streak):outcome==='close'?Math.round(points(v.streak)/2):MISS;
  const gain=earned+(review?.usedBonus?BONUS:0);
  // Recognising the English is worth logging but is not the same skill as
  // producing the French, so it never moves mastery.
  const spells=c.kind!=='meaning';
  const climbed=outcome==='clean'&&spells&&!state.known[c.id]&&spelledCount(state.cards[c.id])+1>=MASTERY;
  // a miss in a round that asked you to write it gives a mastery point back
  const dropped=outcome==='missed'&&spells&&spelledCount(state.cards[c.id])>0;
  // Only the sentence rounds put a sentence in front of you, so only they have
  // words worth harvesting out of it.
  const ids=c.kind==='cloze'||c.kind==='recall'
   ?[...new Set([c.id,...sentenceIds(c.word.example,words)])]:[c.id];
  const fresh=ids.filter(id=>!state.lib[id]&&!state.known[id]).length;
  setState(st=>{
   const lib={...st.lib};
   for(const id of ids)if(!st.known[id]&&!lib[id])lib[id]=now;
   const daily=addStudy(st.daily,st.cards[c.id],now);
   const {next}=applyGrade({...st,lib,days:addDay(st.days),daily},c.id,grades[outcome],now,spells);
   return {...next,points:Math.max(0,next.points+gain)};
  });
  const streak=ok?v.streak+1:0;
  setS({...v,result,outcome,typed,gain,review,taught:teaching,mastered:climbed,dropped,score:v.score+gain,streak,best:Math.max(v.best,streak),
   answered:v.answered+1,right:v.right+(outcome==='clean'?1:0),collected:v.collected+fresh,
   bonuses:v.bonuses+(review?.usedBonus?1:0),
   taughtCount:v.taughtCount+(teaching?1:0),done:[...v.done,{card:c,outcome,typed,review}],
   missed:ok?v.missed:[...v.missed,c.word]});
  tone(outcome==='clean'?[[660,0,.09],[880,.08,.14]]:outcome==='close'?[[620,0,.1],[700,.09,.12]]:[[190,0,.18,'sawtooth']],state.sound);
  buzz(ok?18:[28,40,28]);
  // Hearing it is half of learning it, so say the word the moment the answer
  // lands, in every mode. Spoken here rather than on a timer: iOS only lets
  // speech start from inside the gesture that asked for it.
  if(state.sound)speak(c.kind==='cloze'?c.answer:c.word.word,notice);
 };
 const [grading,setGrading]=useState(false);
 // The sentence round is marked by the model, but whether the two words are
 // actually there is decided here first, off the inflection index, and only
 // upgraded by the model — it can see conjugations the index does not carry.
 const mark=async()=>{
  const v=live.current;
  if(!v||v.result||grading)return;
  const c=v.deck[v.i],text=draft.trim();
  if(!text)return field.current?.focus();
  setGrading(true);
  try{
   const seen=sentenceIds(text,words);
   const said=await composeFor(c.word,text,c.bonus);
   const usedWord=seen.includes(c.id)||said.used===true;
   const usedBonus=!!c.bonus&&(seen.includes(c.bonus.id)||said.bonus===true);
   const outcome=!usedWord?'missed':said.score>=4?'clean':said.score>=3?'close':'missed';
   settle('marked',text,{...said,usedWord,usedBonus,outcome});
  }catch(err){notice(err?.message||'Could not mark that sentence.')}
  setGrading(false);
 };
 const submit=e=>{
  e?.preventDefault?.();
  const v=live.current;
  if(!v||v.result)return;
  const c=v.deck[v.i];
  if(c.kind==='compose')return mark();
  const verdict=c.kind==='meaning'?checkMeaning(draft,c.accepts):check(draft,c.accepts);
  if(verdict==='empty')return field.current?.focus();
  settle(verdict,draft);
 };
 const teach=()=>{setTeaching(true);field.current?.focus()};
 useEffect(()=>{
  if(stage!=='play')return;
  const id=setTimeout(()=>field.current?.scrollIntoView({block:'center',behavior:'smooth'}),350);
  return()=>clearTimeout(id);
 },[stage,s?.i]);
 const [explaining,setExplaining]=useState(0);
 const [gloss,setGloss]=useState(null);
 const explain=async word=>{
  if(explaining)return;
  setExplaining(word.id);
  try{
   const {explain:text,sentence}=await explainFor(word,word.example);
   setState(st=>({...st,notesOn:{...st.notesOn,[word.id]:{text,of:sentence}},
    lib:st.known[word.id]?st.lib:{...st.lib,[word.id]:st.lib[word.id]||Date.now()}}));
  }catch(err){notice(err?.message||'Could not write the breakdown.')}
  setExplaining(0);
 };

 const accent=ch=>{
  const el=field.current;
  if(!el)return setDraft(d=>d+ch);
  const at=el.selectionStart??draft.length,to=el.selectionEnd??draft.length;
  setDraft(draft.slice(0,at)+ch+draft.slice(to));
  requestAnimationFrame(()=>{el.focus();el.setSelectionRange(at+ch.length,at+ch.length)});
 };

 const markKnown=()=>{
  const v=live.current;
  if(!v)return;
  const c=v.deck[v.i],deck=v.deck.filter((_,i)=>i!==v.i);
  clearTimeout(timer.current);setHint(false);setDraft('');setShown(0);setTeaching(false);
  setState(st=>{const lib={...st.lib};delete lib[c.id];
   return {...st,known:{...st.known,[c.id]:Date.now()},lib}});
  notice(`“${c.word.word}” filed under known words. It will not come up again.`);
  if(v.i>=deck.length)return finish({...v,deck});
  setS({...v,deck,result:null,typed:''});
 };
 const quit=()=>{clearTimeout(timer.current);setStage(s&&s.answered?'done':'setup')};

 useKeys(e=>{
  if(stage!=='play')return;
  if(e.key==='Escape')return gloss?setGloss(null):quit();
  if(e.key==='Enter'&&live.current?.result){e.preventDefault();next()}
 });
 useEffect(()=>{if(launch){onLaunched();start(launch)}},[launch]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useVisualViewport();

 if(stage==='setup')return <Setup {...{counts,size,setSize,start,state}}/>;
 if(stage==='done')return <Summary {...{s,setStage,start,setState,state,words,openWord,notice,explain,explaining}}/>;

 const c=s.deck[s.i],result=s.result,ok=result&&s.outcome!=='missed';
 const spellable=c.kind==='cloze'||c.kind==='recall';
 const cleanSoFar=mastery(state.cards[c.id]);
 const filled=result?c.answer:draft;
 const tone3=result?(s.outcome==='clean'?'right':s.outcome==='close'?'close':'wrong'):'gap';
 return <div className={'arena'+(result?ok?' win':' fail':'')}>
  <Gloss found={gloss?.found} token={gloss?.token} onClose={()=>setGloss(null)} {...{notice,state,setState}}/>
  <div className="arena-hud">
   <button className="hud-quit" onClick={quit} aria-label="Leave this round"><X size={20}/></button>
   <div className="pips">{s.deck.map((_,i)=><i key={i} className={i<s.i?'done':i===s.i?'now':''}/>)}</div>
   <div className="hud-score">
    <span className={'combo'+(s.streak>1?' hot':'')}><Flame size={13}/>{s.streak}</span>
    <Counter value={s.score}/>
   </div>
  </div>

  <form className="arena-body" onSubmit={submit} key={c.id}>
   <div className="arena-stage">
   {c.kind==='cloze'
    ? <p className="prompt" lang="fr">
       <Tappable text={c.before} words={words} onPick={(f,t)=>setGloss({found:f,token:t})}/>
       <Blank {...{c,draft,setDraft,field,result,tone3,teaching}}/>
       <Tappable text={c.after} words={words} onPick={(f,t)=>setGloss({found:f,token:t})}/></p>
    : c.kind==='meaning'
    ? <div className="prompt-recall">
       <span className="arena-eyebrow">WHAT DOES THIS MEAN</span>
       <p className="prompt"><span lang="fr">{c.word.article||c.word.word}</span>
        <button type="button" className="say" onClick={()=>speak(c.word.word,notice)} aria-label="Hear it"><Volume2 size={17}/></button></p>
       <Blank {...{c,draft,setDraft,field,result,tone3,teaching,submit}}/>
      </div>
    : c.kind==='compose'
    ? <div className="prompt-recall">
       <span className="arena-eyebrow">WRITE A SENTENCE USING</span>
       <p className="prompt"><span lang="fr">{c.word.article||c.word.word}</span>
        <button type="button" className="say" onClick={()=>speak(c.word.word,notice)} aria-label="Hear it"><Volume2 size={17}/></button></p>
       <p className="prompt-gloss">{c.word.level} · {posOf(c.word)}</p>
       {c.bonus&&<div className="bonus-chip"><Gift size={14}/> bonus <b lang="fr">{c.bonus.article||c.bonus.word}</b>
        <em>{c.bonus.meaning}</em><span>+{BONUS}</span></div>}
       <textarea ref={field} className={'compose-field '+(result?tone3:'')} lang="fr" rows={3}
        value={result?s.typed:draft} onChange={e=>setDraft(e.target.value)} readOnly={!!result} autoFocus
        autoComplete="off" autoCorrect="off" autoCapitalize="sentences" spellCheck={false}
        placeholder="Une phrase en français…" aria-label="Write your sentence in French"/>
      </div>
    : <div className="prompt-recall">
       <span className="arena-eyebrow">WRITE THE FRENCH FOR</span>
       <p className="prompt">“{c.word.meaning}”<Blank {...{c,draft,setDraft,field,result,tone3,teaching}}/></p>
      </div>}
   <p className="prompt-gloss">{c.kind==='cloze'?c.word.translation:c.kind==='recall'&&result?c.word.example:''}</p>

   {!result&&<div className="accents">{ACCENTS.map(ch=><button key={ch} type="button" tabIndex={-1} onClick={()=>accent(ch)}>{ch}</button>)}</div>}
   <div className={'mastery-dots'+(c.kind==='meaning'?' idle':'')}
    aria-label={'Mastery '+cleanSoFar+' of '+MASTERY+(c.kind==='meaning'?', not advanced by this round':'')}>
    {Array.from({length:MASTERY},(_,i)=><i key={i} className={i<cleanSoFar?'on':''}/>)}</div>
   {shown>0&&!result&&spellable&&<div className="letters" aria-label={'First '+shown+' letters'}>
    {[...c.answer].map((ch,i)=><span key={i} className={i<shown?'on':''}>{i<shown?ch:'·'}</span>)}</div>}
   {hint&&!result&&<div className="arena-hint"><Cues ipa={c.word.ipa} size="sm"/><small>/{c.word.ipa}/</small></div>}
   {teaching&&!result&&<p className="assist-note">Copy it out. This one counts as a miss either way — that is what brings it back soon.</p>}
   {!!shown&&!result&&!teaching&&<p className="assist-note">Uncovered letters count as close, not clean.</p>}

   {result&&<div className="answered-tools">
    <button type="button" onClick={()=>speak(c.word.example,notice)} aria-label="Hear it"><Volume2 size={18}/></button>
    <button type="button" onClick={()=>speak(c.word.example,notice,.5)} aria-label="Hear it slowly"><span className="slow">.5x</span></button>
    <span className="rule"/>
    <button type="button" onClick={markKnown}><Check size={16}/> mark as known</button>
   </div>}

   {result&&c.kind==='compose'&&s.review&&<div className="mark">
    <div className="mark-head">
     <strong className={'mark-score s'+s.review.score}>{s.review.score}<i>/5</i></strong>
     <div><b>{s.review.verdict||(s.review.score>=4?'Correct.':'Needs work.')}</b>
      <span>{!s.review.usedWord?`“${c.word.word}” never appeared, so this counts as a miss — ${signed(s.gain)}.`
       :s.review.usedBonus?`${signed(s.gain)}, including ${BONUS} for working in “${c.bonus.word}”.`
       :c.bonus?`${signed(s.gain)}. No bonus — “${c.bonus.word}” went unused.`:`${signed(s.gain)}.`}</span></div>
    </div>
    <div className="verdict-head">
     <button type="button" className="say" onClick={()=>speak(c.word.word,notice)} aria-label="Hear the word"><Volume2 size={17}/></button>
     <span lang="fr">{c.word.article||c.word.word} <i>/{c.word.ipa}/</i> — {c.word.meaning} <i>· {c.word.level}</i></span>
    </div>
    {s.review.notes&&<div className="breakdown">{s.review.notes}</div>}
    {s.review.corrected&&<div className="mark-fix">
     <span className="arena-eyebrow">{s.review.corrected.trim()===s.typed.trim()?'AS YOU WROTE IT':'CORRECTED'}</span>
     <p lang="fr"><Tappable text={s.review.corrected} words={words} onPick={(f,t)=>setGloss({found:f,token:t})}/>
      <button type="button" className="say" onClick={()=>speak(s.review.corrected,notice)} aria-label="Hear it"><Volume2 size={16}/></button></p>
     {s.review.english&&<em>{s.review.english}</em>}</div>}
    {!!s.review.better?.length&&<div className="mark-fix">
     <span className="arena-eyebrow">OTHER WAYS TO SAY IT</span>
     {s.review.better.map((b,i)=><p key={i} lang="fr"><Tappable text={b} words={words} onPick={(f,t)=>setGloss({found:f,token:t})}/>
      <button type="button" className="say" onClick={()=>speak(b,notice)} aria-label="Hear it"><Volume2 size={16}/></button></p>)}</div>}
    {s.mastered
     ?<span className="mastered"><Trophy size={14}/> Mastered — {MASTERY} clean answers. Moved to your known words.</span>
     :s.outcome==='clean'
      ?<span className="collected"><Sparkles size={13}/> sound French — mastery {cleanSoFar}/{MASTERY}</span>
      :s.dropped
       ?<span className="mark-drop"><TrendingDown size={13}/> mastery back to {cleanSoFar}/{MASTERY}</span>
       :<span className="slip">Mastery holds at {cleanSoFar}/{MASTERY} — it moves on a sentence the grader calls sound.</span>}
   </div>}

   {result&&c.kind!=='compose'&&<div className="verdict">
    <div className="verdict-head">
     <strong>{s.outcome==='clean'?signed(s.gain):s.outcome==='close'?`Almost · ${signed(s.gain)}`
      :`${s.taught?'Typed it out':'Not this time'} · ${signed(s.gain)}`}</strong>
     <button type="button" className="say" onClick={()=>speak(c.word.example,notice)} aria-label="Hear the sentence"><Volume2 size={17}/></button>
     <span lang="fr">{c.word.article||c.word.word} <i>/{c.word.ipa}/</i> — {c.word.meaning} <i>· {c.word.level}</i></span>
    </div>
    {result==='accent'&&<span className="slip">You wrote “{s.typed.trim()}” — accents are part of the spelling.</span>}
    {result==='near'&&<span className="slip">You wrote “{s.typed.trim()}” — close enough to count, not close enough to be clean.</span>}
    {result==='exact'&&s.outcome==='close'&&!s.taught&&<span className="slip">Right, but with letters uncovered — mastery holds at {cleanSoFar}/{MASTERY}.</span>}
    {result==='wrong'&&!s.taught&&!!s.typed.trim()&&<span className="slip">You wrote “{s.typed.trim()}”.</span>}
    {s.mastered
     ?<span className="mastered"><Trophy size={14}/> Mastered — {MASTERY} clean answers. Moved to your known words.</span>
     :c.kind==='meaning'
      ?<span className="slip">Logged against the word. Mastery holds at {cleanSoFar}/{MASTERY} — only writing the French moves it.</span>
      :s.dropped
       ?<span className="mark-drop"><TrendingDown size={13}/> mastery back to {cleanSoFar}/{MASTERY}</span>
       :s.outcome==='clean'&&<span className="collected"><Sparkles size={13}/> mastery {cleanSoFar}/{MASTERY}</span>}
    {!!s.collected&&<span className="collected"><Sparkles size={13}/> {s.collected} sentence word{s.collected===1?'':'s'} saved to your library</span>}
   </div>}

   {result&&state.notesOn[c.id]&&<div className="breakdown">{state.notesOn[c.id].text}</div>}

   </div>

   <div className="arena-bar">
    <div className="tools" hidden={!!result}>
     {spellable&&<button type="button" className="tool" onClick={()=>setShown(n=>n+1)} disabled={!!result||shown>=c.length-1}
      title="Reveal a letter" aria-label="Reveal a letter"><HelpCircle size={20}/></button>}
     <button type="button" className={'tool'+(hint?' on':'')} onClick={()=>setHint(h=>!h)} disabled={!!result}
      title="Sound hint" aria-label="Sound hint"><Ear size={20}/></button>
     <button type="button" className="tool" onClick={markKnown} disabled={!!result}
      title="I know this word" aria-label="I know this word"><Check size={20}/></button>
    </div>
    {result
     ?<div className="go-stack">
       {c.kind!=='compose'&&!state.notesOn[c.id]&&<button type="button" className="go outline" disabled={!!explaining}
        onClick={()=>explain(c.word)}>{explaining?<Loader2 size={16} className="spin"/>:null}EXPLAIN</button>}
       <button type="button" className="go" onClick={next}>NEXT</button>
      </div>
     :c.kind==='compose'
       ?<button type="submit" className="go" disabled={grading||!draft.trim()}>
         {grading?<><Loader2 size={17} className="spin"/> MARKING</>:'HAND IT IN'}</button>
     :draft.trim()||teaching
       ?<button type="submit" className="go">CHECK</button>
       :<button type="button" className="go teach" onClick={teach}><GraduationCap size={18}/> TEACH ME</button>}
   </div>
  </form>
 </div>;
}

function Setup({counts,size,setSize,start,state}){
 const run=dayStreak(state.days),rank=standing(state.points);
 return <div className="lobby">
  <div className="lobby-top">
   <h1>Play</h1>
   <div className="level-badge">
    <div className="level-n"><small>LEVEL</small><strong>{rank.level}</strong></div>
    <div className="level-bar">
     <b className="rank-name">{rankName(rank.level)}</b>
     <div className="progress-track"><i style={{width:rank.pct+'%'}}/></div>
     <small>{rank.into.toLocaleString()} / {rank.need.toLocaleString()} to {rankName(rank.level+1)}</small>
    </div>
   </div>
   <div className="pills">
    <span><Flame size={14}/><b>{run}</b> day{run===1?'':'s'}</span>
    <span><Trophy size={14}/><b>{state.rounds}</b> rounds</span>
   </div>
  </div>

  <div className="seg-row">
   <span className="seg-label">Round length</span>
   <div className="seg">{ROUND.map(n=>
    <button key={n} className={size===n?'on':''} onClick={()=>setSize(n)}>{n}</button>)}</div>
  </div>

  <div className="deck-list">{decks.map(([m,Icon,title,blurb])=>
   <button key={m} className="deck-row" disabled={!counts[m]} onClick={()=>start(m)}>
    <span className="deck-icon"><Icon size={19}/></span>
    <span className="deck-body"><b>{title}</b><small>{blurb}</small></span>
    <span className="deck-n">{counts[m].toLocaleString()}</span>
    <ChevronRight size={18}/>
   </button>)}</div>
 </div>;
}

function Summary({s,setStage,start,setState,state,words,openWord,notice,explain,explaining}){
 const acc=s.answered?Math.round(s.right/s.answered*100):0;
 const secs=Math.max(1,Math.round((Date.now()-(s.startedAt||Date.now()))/1000));
 const clock=`${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
 const run=dayStreak(state.days);
 const fresh=s.done.filter(d=>!d.card.word.seenBefore).length;
 const [open,setOpen]=useState(null),[gloss,setGloss]=useState(null);
 const mastered=s.done.filter(d=>state.known[d.card.id]).length;
 const rank=standing(state.points),moved=rank.level-(s.levelAtStart??rank.level);
 return <div className="done-screen">
  <Gloss found={gloss?.found} token={gloss?.token} onClose={()=>setGloss(null)} {...{notice,state,setState}}/>
  <div className="done-head">
   <button className="hud-quit" onClick={()=>setStage('setup')} aria-label="Close"><X size={20}/></button>
   <h1><Trophy size={24}/> ROUND COMPLETE</h1>
  </div>
  <div className="done-body">

  <div className="cheer">
   <div className={moved<0?'down':''}>
    {moved<0?<TrendingDown size={22}/>:moved>0?<TrendingUp size={22}/>:<Trophy size={22}/>}
    <div><strong>Level {rank.level}{moved?` · ${signed(moved)}`:''}</strong>
     <span>{moved>0?'Up this round.':moved<0?'Down this round — misses cost points.'
      :`${rank.toNext.toLocaleString()} points to level ${rank.level+1}.`}</span></div></div>
   <div><Flame size={22}/><div><strong>{run} day{run===1?'':'s'} streak</strong><span>{run>1?'Still going.':'Back on it.'}</span></div></div>
   <div><Sparkles size={22}/><div><strong>+{s.collected} words collected</strong><span>Pulled out of the sentences you played.</span></div></div>
   {!!mastered&&<div><Target size={22}/><div><strong>{mastered} mastered</strong><span>Retired to your known words.</span></div></div>}
  </div>

  <h2>Stats</h2>
  <div className="stat-grid">
   <article><strong className={s.score<0?'bad':''}>{signed(s.score)}</strong><span>Points this round</span></article>
   <article><strong><Clock size={15}/> {clock}</strong><span>Time spent</span></article>
   <article><strong className="ok">{s.right}</strong><span><Check size={13}/> Clean</span></article>
   <article><strong className="bad">{s.answered-s.right}</strong><span><X size={13}/> Not clean</span></article>
   <article><strong>{s.taughtCount}</strong><span><GraduationCap size={13}/> Teach me</span></article>
   <article><strong>{acc}%</strong><span><Target size={13}/> Accuracy</span></article>
   {!!s.bonuses&&<article><strong className="ok">{s.bonuses}</strong><span><Gift size={13}/> Bonus words</span></article>}
  </div>

  <h2>{s.mode==='compose'?'Your sentences':s.mode==='english'?'Words':'Sentences'}</h2>
  <div className="sentence-list">{s.done.map(({card:c,outcome,typed,review},i)=>{
   const w=c.word,isOpen=open===i;
   return <div key={i} className={'sent'+(isOpen?' open':'')}>
    <button className="sent-head" onClick={()=>setOpen(o=>o===i?null:i)} aria-expanded={isOpen}>
     <span className={'mark mark-'+outcome}>{outcome==='missed'?<X size={16}/>:<Check size={16}/>}</span>
     <span className="sent-text">
      <span lang="fr">{c.kind==='cloze'?<>{c.before}<b>{c.answer}</b>{c.after}</>
       :c.kind==='compose'?(typed||<i>nothing written</i>):<b>{w.word}</b>}</span>
      <em>{c.kind==='compose'?<><b lang="fr">{w.word}</b> — {w.meaning}{review?` · ${review.score}/5`:''}</>
       :c.kind==='cloze'?w.translation:w.meaning}</em></span>
     <ArrowRight size={16} className="chev"/>
    </button>
    {isOpen&&(c.kind==='cloze'||c.kind==='compose')&&<p className="sent-full" lang="fr">
     <Tappable text={c.kind==='compose'?(typed||''):c.before+c.answer+c.after} words={words}
      onPick={(f,t)=>setGloss({found:f,token:t})}/></p>}
    {isOpen&&c.kind==='compose'&&review&&<div className="mark-recap">
     {review.notes&&<div className="breakdown">{review.notes}</div>}
     {review.corrected&&<p lang="fr"><b>{review.corrected}</b>
      <button className="say" onClick={()=>speak(review.corrected,notice)} aria-label="Hear it"><Volume2 size={15}/></button></p>}
     {review.english&&<em>{review.english}</em>}
     {review.better?.map((b,k)=><p key={k} lang="fr">{b}
      <button className="say" onClick={()=>speak(b,notice)} aria-label="Hear it"><Volume2 size={15}/></button></p>)}
    </div>}
    {isOpen&&<div className="sent-tools">
     <button onClick={()=>speak(w.example,notice)} aria-label="Hear it"><Volume2 size={17}/></button>
     <button onClick={()=>speak(w.example,notice,.5)} aria-label="Hear it slowly"><span className="slow">.5x</span></button>
     <span className="rule"/>
     {!state.known[w.id]&&<button onClick={()=>{setState(st=>{const lib={...st.lib};delete lib[w.id];
      return {...st,known:{...st.known,[w.id]:Date.now()},lib}});notice(`“${w.word}” marked known.`)}}><Check size={16}/></button>}
     <button onClick={()=>openWord(w)} aria-label="Open the word"><BookOpen size={16}/></button>
     <span className="rule"/>
     {state.notesOn[w.id]
      ?<span className="done-tag">explained</span>
      :<button className="explain-btn" disabled={!!explaining} onClick={()=>explain(w)}>
        {explaining===w.id?<Loader2 size={14} className="spin"/>:null}EXPLAIN</button>}
    </div>}
    {isOpen&&state.notesOn[w.id]&&<div className="breakdown">{state.notesOn[w.id].text}</div>}
   </div>;
  })}</div>

  </div>
  <div className="keep-bar">
   <button className="go" onClick={()=>start(s.mode)}>KEEP PLAYING</button>
  </div>
 </div>;
}
