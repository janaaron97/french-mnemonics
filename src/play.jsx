import React,{useState,useMemo,useRef,useEffect} from 'react';
import {X,ArrowRight,Check,Zap,Flame,Volume2,Sparkles,Layers,Compass,History,Trophy,RotateCcw,Ear,HelpCircle,GraduationCap,Target,Clock,Loader2,BookOpen} from 'lucide-react';
import {queue,card,check,sentenceIds,applyGrade,addDay,mastery,streak as dayStreak,MASTERY,posOf} from './engine';
import {LevelChips,Cues,speak,tone,buzz,useKeys,useVisualViewport,Counter} from './ui';
import {explainFor} from './generate.js';

const ROUND=[7,12,20];
const ACCENTS=['é','è','ê','à','â','î','ï','ô','û','ù','ç','œ'];
const decks=[
 ['discover',Compass,'Discover','Walk the corpus from A1 to C1 in frequency order, picking up where you left off. Known words are skipped.'],
 ['library',Layers,'My library','Only the words you have collected — from sentences, swipes, or added by hand.'],
 ['review',History,'Due reviews','Words whose spaced-repetition interval has come around again.']
];
const points=streak=>100+Math.min(streak,8)*25;
const words_=text=>String(text).split(/(\s+)/).map((part,i)=>
 /^\s+$/.test(part)||!part?part:<span className="tok" key={i}>{part}</span>);
function Blank({c,draft,setDraft,field,result,tone3,teaching}){
 const wide=Math.max(c.length,draft.length,3)+1;
 return <input ref={field} className={'blank '+(result?tone3:'')} style={{width:wide+'ch'}}
  value={result?c.answer:draft} onChange={e=>setDraft(e.target.value)} readOnly={!!result} autoFocus
  lang="fr" enterKeyHint="go" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
  placeholder={teaching?c.answer:''} aria-label="Type the missing word"/>;
}
const grades={clean:'good',close:'hard',missed:'again'};
// Mastery only advances on a word you spelled exactly, with no letters uncovered.
const judge=(result,assisted)=>result==='wrong'?'missed':result==='accent'||assisted?'close':'clean';

export default function Play({words,state,setState,picked,setPicked,notice,openWord,launch,onLaunched}){
 const [stage,setStage]=useState('setup'),[size,setSize]=useState(12),[mode,setMode]=useState('discover');
 const [s,setS]=useState(null),[hint,setHint]=useState(false),[draft,setDraft]=useState(''),[shown,setShown]=useState(0),[teaching,setTeaching]=useState(false);
 const timer=useRef(0),live=useRef(null),field=useRef(null);
 live.current=s;

 const counts=useMemo(()=>Object.fromEntries(decks.map(([m])=>
  [m,queue({words,mode:m,levels:picked,progress:state,size:1e5}).length])),[words,state,picked]);

 const start=(m=mode)=>{
  const list=queue({words,mode:m,levels:picked,progress:state,size});
  if(!list.length)return notice(m==='review'?'Nothing is due yet. Play a discover round to start your schedule.'
   :m==='library'?'Your library is empty in these levels. Sort some words, or play a discover round to collect some.'
   :'Every word in these levels is marked known. Widen the level range to keep going.');
  clearTimeout(timer.current);setMode(m);setHint(false);setDraft('');setShown(0);setTeaching(false);
  setS({deck:list.map(card),i:0,score:0,streak:0,best:0,right:0,answered:0,collected:0,gain:0,missed:[],done:[],taughtCount:0,startedAt:Date.now(),result:null,typed:'',mode:m});
  setStage('play');
 };

 const finish=v=>{
  clearTimeout(timer.current);
  setState(st=>({...st,rounds:st.rounds+1,best:Math.max(st.best,v.best)}));
  tone([[523,0,.12],[659,.1,.12],[784,.2,.24]],state.sound);
  setStage('done');
 };
 const next=()=>{
  clearTimeout(timer.current);setHint(false);setDraft('');setShown(0);setTeaching(false);
  const v=live.current;
  if(!v)return;
  if(v.i+1>=v.deck.length)return finish(v);
  setS({...v,i:v.i+1,result:null,typed:''});
 };

 const settle=(result,typed)=>{
  const v=live.current;
  if(!v||v.result)return;
  const c=v.deck[v.i],now=Date.now();
  const outcome=teaching?'missed':judge(result,shown>0),ok=outcome!=='missed';
  const gain=outcome==='clean'?points(v.streak):outcome==='close'?Math.round(points(v.streak)/2):0;
  const climbed=outcome==='clean'&&!state.known[c.id]&&(state.cards[c.id]?.clean||0)+1>=MASTERY;
  const ids=[...new Set([c.id,...sentenceIds(c.word.example,words)])];
  const fresh=ids.filter(id=>!state.lib[id]&&!state.known[id]).length;
  setState(st=>{
   const lib={...st.lib};
   for(const id of ids)if(!st.known[id]&&!lib[id])lib[id]=now;
   const {next}=applyGrade({...st,lib,days:addDay(st.days)},c.id,grades[outcome],now);
   return {...next,xp:next.xp+gain,cursor:v.mode==='discover'?Math.max(next.cursor,c.id):next.cursor};
  });
  const streak=ok?v.streak+1:0;
  setS({...v,result,outcome,typed,gain,taught:teaching,mastered:climbed,score:v.score+gain,streak,best:Math.max(v.best,streak),
   answered:v.answered+1,right:v.right+(outcome==='clean'?1:0),collected:v.collected+fresh,
   taughtCount:v.taughtCount+(teaching?1:0),done:[...v.done,{card:c,outcome}],
   missed:ok?v.missed:[...v.missed,c.word]});
  tone(outcome==='clean'?[[660,0,.09],[880,.08,.14]]:outcome==='close'?[[620,0,.1],[700,.09,.12]]:[[190,0,.18,'sawtooth']],state.sound);
  buzz(ok?18:[28,40,28]);
  if(outcome==='clean')timer.current=setTimeout(next,climbed?1600:950);
 };
 const submit=e=>{
  e?.preventDefault?.();
  const v=live.current;
  if(!v||v.result)return;
  const verdict=check(draft,v.deck[v.i].accepts);
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
   return {...st,known:{...st.known,[c.id]:Date.now()},lib,cursor:Math.max(st.cursor,c.id)}});
  notice(`“${c.word.word}” filed under known words. It will not come up again.`);
  if(v.i>=deck.length)return finish({...v,deck});
  setS({...v,deck,result:null,typed:''});
 };
 const quit=()=>{clearTimeout(timer.current);setStage(s&&s.answered?'done':'setup')};

 useKeys(e=>{
  if(stage!=='play')return;
  if(e.key==='Escape')return quit();
  if(e.key==='Enter'&&live.current?.result){e.preventDefault();next()}
 });
 useEffect(()=>{if(launch){onLaunched();start(launch)}},[launch]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useVisualViewport();

 if(stage==='setup')return <Setup {...{counts,size,setSize,start,picked,setPicked,state}}/>;
 if(stage==='done')return <Summary {...{s,setStage,start,setState,state,openWord,notice,explain,explaining}}/>;

 const c=s.deck[s.i],result=s.result,ok=result&&s.outcome!=='missed';
 const cleanSoFar=mastery(state.cards[c.id]);
 const filled=result?c.answer:draft;
 const tone3=result?(s.outcome==='clean'?'right':s.outcome==='close'?'close':'wrong'):'gap';
 return <div className={'arena'+(result?ok?' win':' fail':'')}>
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
    ? <p className="prompt" lang="fr">{words_(c.before)}<Blank {...{c,draft,setDraft,field,result,tone3,teaching}}/>{words_(c.after)}</p>
    : <div className="prompt-recall">
       <span className="arena-eyebrow">WRITE THE FRENCH FOR</span>
       <p className="prompt">“{c.word.meaning}”<Blank {...{c,draft,setDraft,field,result,tone3,teaching}}/></p>
      </div>}
   <p className="prompt-gloss">{c.kind==='cloze'?c.word.translation:result?c.word.example:''}</p>

   {!result&&<div className="accents">{ACCENTS.map(ch=><button key={ch} type="button" tabIndex={-1} onClick={()=>accent(ch)}>{ch}</button>)}</div>}
   <div className="mastery-dots" aria-label={'Mastery '+cleanSoFar+' of '+MASTERY}>
    {Array.from({length:MASTERY},(_,i)=><i key={i} className={i<cleanSoFar?'on':''}/>)}</div>
   {shown>0&&!result&&<div className="letters" aria-label={'First '+shown+' letters'}>
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

   {result&&<div className="verdict">
    <div className="verdict-head">
     <strong>{s.outcome==='clean'?`+${s.gain}`:s.outcome==='close'?`Almost · +${s.gain}`:s.taught?'Typed it out':'Not this time'}</strong>
     <button type="button" className="say" onClick={()=>speak(c.word.example,notice)} aria-label="Hear the sentence"><Volume2 size={17}/></button>
     <span lang="fr">{c.word.article||c.word.word} <i>/{c.word.ipa}/</i> — {c.word.meaning}</span>
    </div>
    {result==='accent'&&<span className="slip">You wrote “{s.typed.trim()}” — accents are part of the spelling.</span>}
    {result==='exact'&&s.outcome==='close'&&!s.taught&&<span className="slip">Right, but with letters uncovered — mastery holds at {cleanSoFar}/{MASTERY}.</span>}
    {result==='wrong'&&!s.taught&&!!s.typed.trim()&&<span className="slip">You wrote “{s.typed.trim()}”.</span>}
    {s.mastered
     ?<span className="mastered"><Trophy size={14}/> Mastered — {MASTERY} clean answers. Moved to your known words.</span>
     :s.outcome==='clean'&&<span className="collected"><Sparkles size={13}/> mastery {cleanSoFar}/{MASTERY}</span>}
    {!!s.collected&&<span className="collected"><Sparkles size={13}/> {s.collected} sentence word{s.collected===1?'':'s'} saved to your library</span>}
   </div>}

   {result&&state.notesOn[c.id]&&<div className="breakdown">{state.notesOn[c.id].text}</div>}

   </div>

   <div className="arena-bar">
    <div className="tools" hidden={!!result}>
     <button type="button" className="tool" onClick={()=>setShown(n=>n+1)} disabled={!!result||shown>=c.length-1}
      title="Reveal a letter" aria-label="Reveal a letter"><HelpCircle size={20}/></button>
     <button type="button" className={'tool'+(hint?' on':'')} onClick={()=>setHint(h=>!h)} disabled={!!result}
      title="Sound hint" aria-label="Sound hint"><Ear size={20}/></button>
     <button type="button" className="tool" onClick={markKnown} disabled={!!result}
      title="I know this word" aria-label="I know this word"><Check size={20}/></button>
    </div>
    {result
     ?<div className="go-stack">
       {!state.notesOn[c.id]&&<button type="button" className="go outline" disabled={!!explaining}
        onClick={()=>explain(c.word)}>{explaining?<Loader2 size={16} className="spin"/>:null}EXPLAIN</button>}
       <button type="button" className="go" onClick={next}>NEXT</button>
      </div>
     :draft.trim()||teaching
       ?<button type="submit" className="go">CHECK</button>
       :<button type="button" className="go teach" onClick={teach}><GraduationCap size={18}/> TEACH ME</button>}
   </div>
  </form>
 </div>;
}

function Setup({counts,size,setSize,start,picked,setPicked,state}){
 return <>
  <div className="play-hero">
   <div>
    <h1>Play</h1>
    <p>Every sentence you play drops all of its words into your library.</p>
   </div>
   <div className="xp-badge"><Zap size={18}/><Counter value={state.xp}/><span>XP · {state.rounds} rounds</span></div>
  </div>
  <div className="setup-row"><span className="setup-label">LEVEL RANGE</span><LevelChips picked={picked} onChange={setPicked}/></div>
  <div className="deck-grid">{decks.map(([m,Icon,title,blurb])=>
   <button key={m} className="deck" disabled={!counts[m]} onClick={()=>start(m)}>
    <Icon size={20}/><strong>{title}</strong><p>{blurb}</p>
    <span className="deck-count">{counts[m].toLocaleString()} ready <ArrowRight size={15}/></span>
   </button>)}</div>
  <div className="setup-row"><span className="setup-label">ROUND LENGTH</span>
   <div className="level-chips compact">{ROUND.map(n=><button key={n} className={size===n?'on':''} onClick={()=>setSize(n)}>{n} cards</button>)}</div>
  </div>
  <p className="subtle">Clean answer = Good, accent slip or hint = Hard, miss = Again. {MASTERY} clean answers retires a word.</p>
 </>;
}

function Summary({s,setStage,start,setState,state,openWord,notice,explain,explaining}){
 const acc=s.answered?Math.round(s.right/s.answered*100):0;
 const secs=Math.max(1,Math.round((Date.now()-(s.startedAt||Date.now()))/1000));
 const clock=`${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
 const run=dayStreak(state.days);
 const fresh=s.done.filter(d=>!d.card.word.seenBefore).length;
 const [open,setOpen]=useState(null);
 const mastered=s.done.filter(d=>state.known[d.card.id]).length;
 return <div className="done-screen">
  <h1><Trophy size={26}/> ROUND COMPLETE</h1>

  <div className="cheer">
   <div><Flame size={22}/><div><strong>{run} day{run===1?'':'s'} streak</strong><span>{run>1?'Still going.':'Back on it.'}</span></div></div>
   <div><Sparkles size={22}/><div><strong>+{s.collected} words collected</strong><span>Pulled out of the sentences you played.</span></div></div>
   {!!mastered&&<div><Target size={22}/><div><strong>{mastered} mastered</strong><span>Retired to your known words.</span></div></div>}
  </div>

  <h2>Stats</h2>
  <div className="stat-grid">
   <article><strong>+{s.score.toLocaleString()}</strong><span>Points earned</span></article>
   <article><strong><Clock size={15}/> {clock}</strong><span>Time spent</span></article>
   <article><strong className="ok">{s.right}</strong><span><Check size={13}/> Clean</span></article>
   <article><strong className="bad">{s.answered-s.right}</strong><span><X size={13}/> Not clean</span></article>
   <article><strong>{s.taughtCount}</strong><span><GraduationCap size={13}/> Teach me</span></article>
   <article><strong>{acc}%</strong><span><Target size={13}/> Accuracy</span></article>
  </div>

  <h2>Sentences</h2>
  <div className="sentence-list">{s.done.map(({card:c,outcome},i)=>{
   const w=c.word,isOpen=open===i;
   return <div key={i} className={'sent'+(isOpen?' open':'')}>
    <button className="sent-head" onClick={()=>setOpen(o=>o===i?null:i)} aria-expanded={isOpen}>
     <span className={'mark mark-'+outcome}>{outcome==='missed'?<X size={16}/>:<Check size={16}/>}</span>
     <span className="sent-text">
      <span lang="fr">{c.kind==='cloze'?<>{c.before}<b>{c.answer}</b>{c.after}</>:<b>{w.word}</b>}</span>
      <em>{c.kind==='cloze'?w.translation:w.meaning}</em></span>
     <ArrowRight size={16} className="chev"/>
    </button>
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

  <div className="keep-bar">
   <button className="go" onClick={()=>start(s.mode)}>KEEP PLAYING</button>
   <button className="go outline slim" onClick={()=>setStage('setup')}>CHANGE DECK</button>
  </div>
 </div>;
}
