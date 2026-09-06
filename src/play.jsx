import React,{useState,useMemo,useRef,useEffect} from 'react';
import {X,ArrowRight,Check,Zap,Flame,Volume2,Sparkles,Layers,Compass,History,Trophy,RotateCcw,Ear,CornerDownLeft} from 'lucide-react';
import {queue,card,check,sentenceIds,schedule,posOf} from './engine';
import {LevelChips,Cues,speak,tone,buzz,useKeys,Counter} from './ui';

const ROUND=[7,12,20];
const ACCENTS=['é','è','ê','à','â','î','ï','ô','û','ù','ç','œ'];
const decks=[
 ['discover',Compass,'Discover','Walk the corpus from A1 to C1 in frequency order, picking up where you left off. Known words are skipped.'],
 ['library',Layers,'My library','Only the words you have collected — from sentences, swipes, or added by hand.'],
 ['review',History,'Due reviews','Words whose spaced-repetition interval has come around again.']
];
const points=streak=>100+Math.min(streak,8)*25;
const grades={exact:'good',accent:'hard',wrong:'again'};

export default function Play({words,state,setState,picked,setPicked,notice,openWord,launch,onLaunched}){
 const [stage,setStage]=useState('setup'),[size,setSize]=useState(12),[mode,setMode]=useState('discover');
 const [s,setS]=useState(null),[hint,setHint]=useState(false),[draft,setDraft]=useState('');
 const timer=useRef(0),live=useRef(null),field=useRef(null);
 live.current=s;

 const counts=useMemo(()=>Object.fromEntries(decks.map(([m])=>
  [m,queue({words,mode:m,levels:picked,progress:state,size:1e5}).length])),[words,state,picked]);

 const start=(m=mode)=>{
  const list=queue({words,mode:m,levels:picked,progress:state,size});
  if(!list.length)return notice(m==='review'?'Nothing is due yet. Play a discover round to start your schedule.'
   :m==='library'?'Your library is empty in these levels. Sort some words, or play a discover round to collect some.'
   :'Every word in these levels is marked known. Widen the level range to keep going.');
  clearTimeout(timer.current);setMode(m);setHint(false);setDraft('');
  setS({deck:list.map(card),i:0,score:0,streak:0,best:0,right:0,answered:0,collected:0,gain:0,missed:[],result:null,typed:'',mode:m});
  setStage('play');
 };

 const finish=v=>{
  clearTimeout(timer.current);
  setState(st=>({...st,rounds:st.rounds+1,best:Math.max(st.best,v.best)}));
  tone([[523,0,.12],[659,.1,.12],[784,.2,.24]],state.sound);
  setStage('done');
 };
 const next=()=>{
  clearTimeout(timer.current);setHint(false);setDraft('');
  const v=live.current;
  if(!v)return;
  if(v.i+1>=v.deck.length)return finish(v);
  setS({...v,i:v.i+1,result:null,typed:''});
 };

 const settle=(result,typed)=>{
  const v=live.current;
  if(!v||v.result)return;
  const c=v.deck[v.i],ok=result!=='wrong',now=Date.now();
  const gain=result==='exact'?points(v.streak):result==='accent'?Math.round(points(v.streak)/2):0;
  const ids=[...new Set([c.id,...sentenceIds(c.word.example,words)])];
  const fresh=ids.filter(id=>!state.lib[id]&&!state.known[id]).length;
  setState(st=>{
   const lib={...st.lib};
   for(const id of ids)if(!st.known[id]&&!lib[id])lib[id]=now;
   return {...st,lib,cards:{...st.cards,[c.id]:schedule(st.cards[c.id],grades[result],now)},xp:st.xp+gain,
    cursor:v.mode==='discover'?Math.max(st.cursor,c.id):st.cursor};
  });
  const streak=ok?v.streak+1:0;
  setS({...v,result,typed,gain,score:v.score+gain,streak,best:Math.max(v.best,streak),answered:v.answered+1,
   right:v.right+(result==='exact'?1:0),collected:v.collected+fresh,missed:ok?v.missed:[...v.missed,c.word]});
  tone(result==='exact'?[[660,0,.09],[880,.08,.14]]:result==='accent'?[[620,0,.1],[700,.09,.12]]:[[190,0,.18,'sawtooth']],state.sound);
  buzz(ok?18:[28,40,28]);
  if(result==='exact')timer.current=setTimeout(next,950);
 };

 const submit=e=>{
  e?.preventDefault?.();
  const v=live.current;
  if(!v||v.result)return;
  const verdict=check(draft,v.deck[v.i].accepts);
  if(verdict==='empty')return field.current?.focus();
  settle(verdict,draft);
 };
 const giveUp=()=>settle('wrong',draft);

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
  clearTimeout(timer.current);setHint(false);setDraft('');
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

 if(stage==='setup')return <Setup {...{counts,size,setSize,start,picked,setPicked,state}}/>;
 if(stage==='done')return <Summary {...{s,setStage,start,setState,openWord,notice}}/>;

 const c=s.deck[s.i],result=s.result,ok=result&&result!=='wrong';
 const filled=result?c.answer:draft;
 return <div className={'arena'+(result?ok?' win':' fail':'')}>
  <div className="arena-hud">
   <button className="hud-quit" onClick={quit} aria-label="Leave this round"><X size={18}/></button>
   <div className="pips">{s.deck.map((_,i)=><i key={i} className={i<s.i?'done':i===s.i?'now':''}/>)}</div>
   <div className="hud-score">
    <span className={'combo'+(s.streak>1?' hot':'')}><Flame size={13}/>{s.streak}</span>
    <Counter value={s.score}/>
   </div>
  </div>

  <div className="arena-card" key={c.id}>
   <div className="arena-tag"><span>{c.word.level}</span><span>{posOf(c.word)}</span><span className="grow"/>
    <button className="ghost" onClick={markKnown}><Check size={14}/> I know this</button></div>

   {c.kind==='cloze'
    ? <p className="cloze" lang="fr">{c.before}<b className={result?ok?'right':'wrong':'gap'}>{filled}</b>{c.after}</p>
    : <div className="recall-prompt"><span className="arena-eyebrow">WRITE THE FRENCH FOR</span><p className="cloze">“{c.word.meaning}”</p></div>}

   <p className="arena-gloss">{c.kind==='cloze'?c.word.translation:result?c.word.example:'Spell it from memory. Accents count.'}</p>

   <form className="typing" onSubmit={submit}>
    <input ref={field} className={'answer-field'+(result?ok?' right':' wrong':'')} value={result?c.answer:draft}
     onChange={e=>setDraft(e.target.value)} readOnly={!!result} autoFocus lang="fr" enterKeyHint="go"
     autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
     placeholder={'·'.repeat(c.length)} aria-label={c.kind==='cloze'?'Type the missing word':'Type the French word'}/>
    <button className="primary" type="submit">{result?'Next':'Check'} <CornerDownLeft size={16}/></button>
   </form>

   {!result&&<>
    <div className="accents">{ACCENTS.map(ch=><button key={ch} type="button" onClick={()=>accent(ch)}>{ch}</button>)}</div>
    <div className="assists">
     <span>{c.length} letters</span>
     {!hint&&<button className="hint-btn" onClick={()=>setHint(true)}><Ear size={15}/> Sound hint</button>}
     <button className="hint-btn" onClick={giveUp}>Reveal the answer</button>
    </div>
   </>}

   {hint&&!result&&<div className="arena-hint"><Cues ipa={c.word.ipa} size="sm"/><small>/{c.word.ipa}/ — read the cast left to right.</small></div>}

   {result&&<div className="verdict">
    <div className="verdict-head">
     <strong>{result==='exact'?`+${s.gain}`:result==='accent'?`Almost · +${s.gain}`:'Not this time'}</strong>
     <button className="say" onClick={()=>speak(c.word.example,notice)} aria-label="Hear the sentence"><Volume2 size={17}/></button>
     <span lang="fr">{c.word.article||c.word.word} <i>/{c.word.ipa}/</i> — {c.word.meaning}</span>
    </div>
    {result==='accent'&&<span className="slip">You wrote “{s.typed.trim()}” — the accents are part of the spelling.</span>}
    {result==='wrong'&&!!s.typed.trim()&&<span className="slip">You wrote “{s.typed.trim()}”.</span>}
    {!!s.collected&&<span className="collected"><Sparkles size={13}/> {s.collected} sentence word{s.collected===1?'':'s'} saved to your library this round</span>}
    <button className={result==='exact'?'ghost-btn':'primary'} onClick={next}>Keep going <ArrowRight size={17}/></button>
   </div>}
  </div>
 </div>;
}

function Setup({counts,size,setSize,start,picked,setPicked,state}){
 return <>
  <div className="play-hero">
   <div>
    <span className="eyebrow">CLOZE ARCADE</span>
    <h1>Fill the gap.<br/>Keep the sentence.</h1>
    <p>Type the missing word into the sentence. Every sentence you play drops all of its words into your library, so the round you are playing writes the rounds that follow.</p>
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
  <p className="subtle">Answers feed the same spaced-repetition schedule as the Learn tab: a clean answer counts as Good, an accent slip as Hard, a miss as Again. Sound cues are invented memory hooks, not etymology.</p>
 </>;
}

function Summary({s,setStage,start,setState,openWord,notice}){
 const acc=s.answered?Math.round(s.right/s.answered*100):0;
 return <div className="summary">
  <Trophy size={32}/>
  <span className="eyebrow">ROUND COMPLETE</span>
  <h1>{acc>=90?'Nearly flawless.':acc>=60?'Solid round.':'Every miss is a word you now own.'}</h1>
  <div className="score-grid">
   <article><Counter value={s.score}/><span>points</span></article>
   <article><strong>{acc}%</strong><span>{s.right} of {s.answered} spelled clean</span></article>
   <article><strong>{s.best}</strong><span>best streak</span></article>
   <article><strong>{s.collected}</strong><span>words collected</span></article>
  </div>
  {!!s.missed.length&&<div className="missed">
   <span className="eyebrow">WORTH ANOTHER LOOK</span>
   {s.missed.map(w=><div key={w.id} className="missed-row">
    <button onClick={()=>openWord(w)}><strong lang="fr">{w.article||w.word}</strong><i>/{w.ipa}/</i><span>{w.meaning}</span></button>
    <button className="ghost" onClick={()=>{setState(st=>{const lib={...st.lib};delete lib[w.id];
     return {...st,known:{...st.known,[w.id]:Date.now()},lib}});notice(`“${w.word}” marked known.`)}}><Check size={14}/> Known</button>
   </div>)}
  </div>}
  <div className="summary-actions">
   <button className="primary" onClick={()=>start(s.mode)}><RotateCcw size={17}/> Play another round</button>
   <button className="ghost-btn" onClick={()=>setStage('setup')}>Change deck</button>
  </div>
 </div>;
}
