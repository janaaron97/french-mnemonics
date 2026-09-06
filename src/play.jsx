import React,{useState,useMemo,useRef,useEffect} from 'react';
import {X,ArrowRight,Check,Zap,Flame,Volume2,Sparkles,Layers,Compass,History,Trophy,RotateCcw,Ear} from 'lucide-react';
import {queue,card,rng,sentenceIds,schedule,posOf} from './engine';
import {LevelChips,Cues,speak,tone,buzz,useKeys,Counter} from './ui';

const ROUND=[7,12,20];
const decks=[
 ['discover',Compass,'Discover','Walk the corpus from A1 to C1 in frequency order, picking up where you left off. Known words are skipped.'],
 ['library',Layers,'My library','Only the words you have collected — from sentences, swipes, or added by hand.'],
 ['review',History,'Due reviews','Words whose spaced-repetition interval has come around again.']
];
const points=streak=>100+Math.min(streak,8)*25;

export default function Play({words,state,setState,picked,setPicked,notice,openWord,launch,onLaunched}){
 const [stage,setStage]=useState('setup'),[size,setSize]=useState(12),[mode,setMode]=useState('discover');
 const [s,setS]=useState(null),[hint,setHint]=useState(false);
 const timer=useRef(0),live=useRef(null);
 live.current=s;

 const counts=useMemo(()=>Object.fromEntries(decks.map(([m])=>
  [m,queue({words,mode:m,levels:picked,progress:state,size:1e5}).length])),[words,state,picked]);

 const start=(m=mode)=>{
  const list=queue({words,mode:m,levels:picked,progress:state,size});
  if(!list.length)return notice(m==='review'?'Nothing is due yet. Play a discover round to start your schedule.'
   :m==='library'?'Your library is empty in these levels. Sort some words, or play a discover round to collect some.'
   :'Every word in these levels is marked known. Widen the level range to keep going.');
  const rand=rng(Date.now()>>>0);
  clearTimeout(timer.current);setMode(m);setHint(false);
  setS({deck:list.map(w=>card(w,words,rand)),i:0,score:0,streak:0,best:0,right:0,answered:0,collected:0,gain:0,missed:[],chosen:null,mode:m});
  setStage('play');
 };

 const finish=v=>{
  clearTimeout(timer.current);
  setState(st=>({...st,rounds:st.rounds+1,best:Math.max(st.best,v.best)}));
  tone([[523,0,.12],[659,.1,.12],[784,.2,.24]],state.sound);
  setStage('done');
 };
 const next=()=>{
  clearTimeout(timer.current);setHint(false);
  const v=live.current;
  if(!v)return;
  if(v.i+1>=v.deck.length)return finish(v);
  setS({...v,i:v.i+1,chosen:null});
 };

 const answer=opt=>{
  const v=live.current;
  if(!v||v.chosen)return;
  const c=v.deck[v.i],ok=opt.id===c.id,gain=ok?points(v.streak):0,now=Date.now();
  const ids=[...new Set([c.id,...sentenceIds(c.word.example,words)])];
  const fresh=ids.filter(id=>!state.lib[id]&&!state.known[id]).length;
  setState(st=>{
   const lib={...st.lib};
   for(const id of ids)if(!st.known[id]&&!lib[id])lib[id]=now;
   return {...st,lib,cards:{...st.cards,[c.id]:schedule(st.cards[c.id],ok?'good':'again',now)},xp:st.xp+gain,
    cursor:v.mode==='discover'?Math.max(st.cursor,c.id):st.cursor};
  });
  const streak=ok?v.streak+1:0;
  setS({...v,chosen:opt,gain,score:v.score+gain,streak,best:Math.max(v.best,streak),answered:v.answered+1,
   right:v.right+(ok?1:0),collected:v.collected+fresh,missed:ok?v.missed:[...v.missed,c.word]});
  tone(ok?[[660,0,.09],[880,.08,.14]]:[[190,0,.18,'sawtooth']],state.sound);
  buzz(ok?18:[28,40,28]);
  if(ok)timer.current=setTimeout(next,950);
 };

 const markKnown=()=>{
  const v=live.current;
  if(!v)return;
  const c=v.deck[v.i],deck=v.deck.filter((_,i)=>i!==v.i);
  clearTimeout(timer.current);setHint(false);
  setState(st=>{const lib={...st.lib};delete lib[c.id];
   return {...st,known:{...st.known,[c.id]:Date.now()},lib,cursor:Math.max(st.cursor,c.id)}});
  notice(`“${c.word.word}” filed under known words. It will not come up again.`);
  if(v.i>=deck.length)return finish({...v,deck});
  setS({...v,deck,chosen:null});
 };
 const quit=()=>{clearTimeout(timer.current);setStage(s&&s.answered?'done':'setup')};

 useEffect(()=>{if(launch){onLaunched();start(launch)}},[launch]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);

 useKeys(e=>{
  if(stage!=='play')return;
  const v=live.current;
  if(!v)return;
  if(e.key==='Escape')return quit();
  if(v.chosen){if(e.key==='Enter'||e.key===' '){e.preventDefault();next()}return}
  if(e.key==='h'||e.key==='H')return setHint(h=>!h);
  const n=Number(e.key);
  if(n>=1&&n<=v.deck[v.i].options.length)answer(v.deck[v.i].options[n-1]);
 });

 if(stage==='setup')return <Setup {...{counts,size,setSize,start,picked,setPicked,state}}/>;
 if(stage==='done')return <Summary {...{s,setStage,start,setState,openWord,notice}}/>;

 const c=s.deck[s.i],chosen=s.chosen,ok=chosen&&chosen.id===c.id;
 return <div className={'arena'+(chosen?ok?' win':' fail':'')}>
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
    ? <p className="cloze" lang="fr">{c.before}<b className={chosen?ok?'right':'wrong':'gap'}>{chosen?c.answer:''}</b>{c.after}</p>
    : <div className="recall-prompt"><span className="arena-eyebrow">WHICH FRENCH WORD MEANS</span><p className="cloze">“{c.word.meaning}”</p></div>}

   <p className="arena-gloss">{c.kind==='cloze'?c.word.translation:chosen?c.word.example:'Pick the word, then hear it inside a sentence.'}</p>

   {hint
    ? <div className="arena-hint"><Cues ipa={c.word.ipa} size="sm"/><small>/{c.word.ipa}/ — read the cast left to right.</small></div>
    : !chosen&&<button className="hint-btn" onClick={()=>setHint(true)}><Ear size={15}/> Sound hint <kbd>H</kbd></button>}

   <div className="options">{c.options.map((o,i)=>{
    const mark=!chosen?'':o.id===c.id?'right':o.id===chosen.id?'wrong':'dim';
    return <button key={o.id} className={'option '+mark} disabled={!!chosen} onClick={()=>answer(o)}>
     <kbd>{i+1}</kbd><strong lang="fr">{o.word}</strong><small>{o.meaning}</small></button>;
   })}</div>

   {chosen&&<div className="verdict">
    <div className="verdict-head">
     <strong>{ok?`+${s.gain}`:'Not this time'}</strong>
     <button className="say" onClick={()=>speak(c.word.example,notice)} aria-label="Hear the sentence"><Volume2 size={17}/></button>
     <span lang="fr">{c.word.article||c.word.word} <i>/{c.word.ipa}/</i> — {c.word.meaning}</span>
    </div>
    {!!s.collected&&<span className="collected"><Sparkles size={13}/> {s.collected} sentence word{s.collected===1?'':'s'} saved to your library this round</span>}
    <button className={ok?'ghost-btn':'primary'} onClick={next}>Keep going <ArrowRight size={17}/></button>
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
    <p>Every sentence you play drops all of its words into your library, so the round you are playing writes the rounds that follow.</p>
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
  <p className="subtle">Answers feed the same spaced-repetition schedule as the Learn tab. Sound cues are invented memory hooks, not etymology.</p>
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
   <article><strong>{acc}%</strong><span>{s.right} of {s.answered} correct</span></article>
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
