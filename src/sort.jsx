import React,{useState,useRef,useMemo} from 'react';
import {Check,Plus,ChevronDown,Undo2,Volume2,Sparkles} from 'lucide-react';
import {posOf} from './engine';
import {LevelChips,Cues,speak,tone,buzz,useKeys} from './ui';

const THROW=105,VISIBLE=3;
const verdicts={
 known:{label:'I know this',tone:[[300,0,.1]],hint:'Filed away. It stops appearing in games and sorting.'},
 study:{label:'Add to studying',tone:[[620,0,.08],[820,.07,.11]],hint:'Added to your library and queued for future rounds.'},
 skip:{label:'Skip for now',tone:[[400,0,.07]],hint:'Left unlabelled. It comes back another day.'}
};

export default function Sort({words,state,setState,picked,setPicked,notice}){
 const [drag,setDrag]=useState(null),[flying,setFly]=useState(null),[sorted,setSorted]=useState(0),[peek,setPeek]=useState(false);
 const [skipped,setSkipped]=useState(()=>new Set()),[last,setLast]=useState(null);
 const grab=useRef(null);

 const deck=useMemo(()=>words.filter(w=>!state.lib[w.id]&&!state.known[w.id]&&picked.includes(w.level)&&!skipped.has(w.id)),
  [words,state.lib,state.known,picked,skipped]);
 const top=deck[0];

 const commit=verdict=>{
  if(!top)return;
  const w=top;
  setFly({verdict,id:w.id});
  tone(verdicts[verdict].tone,state.sound);
  buzz(verdict==='skip'?10:20);
  setTimeout(()=>{
   if(verdict==='known')setState(st=>{const lib={...st.lib};delete lib[w.id];return {...st,known:{...st.known,[w.id]:Date.now()},lib}});
   else if(verdict==='study')setState(st=>({...st,lib:{...st.lib,[w.id]:Date.now()}}));
   else setSkipped(s=>new Set(s).add(w.id));
   setLast({word:w,verdict});setSorted(n=>n+1);setFly(null);setDrag(null);setPeek(false);
  },210);
 };
 const undo=()=>{
  if(!last)return;
  const {word:w,verdict}=last;
  if(verdict==='known')setState(st=>{const known={...st.known};delete known[w.id];return {...st,known}});
  else if(verdict==='study')setState(st=>{const lib={...st.lib};delete lib[w.id];return {...st,lib}});
  else setSkipped(s=>{const n=new Set(s);n.delete(w.id);return n});
  setLast(null);setSorted(n=>Math.max(0,n-1));
  notice(`Put “${w.word}” back on top of the stack.`);
 };

 const down=e=>{if(flying)return;grab.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);setDrag({dx:0,dy:0})};
 const move=e=>{if(!grab.current)return;setDrag({dx:e.clientX-grab.current.x,dy:e.clientY-grab.current.y})};
 const up=()=>{
  const d=drag;grab.current=null;
  if(!d)return;
  if(d.dy>THROW&&Math.abs(d.dy)>Math.abs(d.dx))return commit('skip');
  if(d.dx>THROW)return commit('study');
  if(d.dx<-THROW)return commit('known');
  setDrag(null);
 };

 useKeys(e=>{
  if(e.target.tagName==='INPUT')return;
  if(e.key==='ArrowRight')commit('study');
  else if(e.key==='ArrowLeft')commit('known');
  else if(e.key==='ArrowDown')commit('skip');
  else if(e.key==='u')undo();
 });

 const d=drag||{dx:0,dy:0};
 const lean=flying?{known:-1,study:1,skip:0}[flying.verdict]:0;
 const style=flying
  ?{transform:`translate(${lean*520}px,${flying.verdict==='skip'?420:60}px) rotate(${lean*22}deg)`,opacity:0,transition:'transform .22s ease-in,opacity .22s ease-in'}
  :{transform:`translate(${d.dx}px,${d.dy}px) rotate(${d.dx/24}deg)`,transition:grab.current?'none':'transform .25s cubic-bezier(.2,1.3,.4,1)'};
 const glow=v=>flying?.verdict===v?1:v==='study'?Math.max(0,Math.min(1,d.dx/THROW)):v==='known'?Math.max(0,Math.min(1,-d.dx/THROW)):Math.max(0,Math.min(1,d.dy/THROW));

 return <>
  <div className="page-title"><div className="eyebrow">TRIAGE</div><h1>Know it, or study it.</h1>
   <p>Sweep the whole range from A1 to C1 and label each word in one gesture. Nothing here is a test.</p></div>
  <div className="setup-row"><span className="setup-label">LEVEL RANGE</span><LevelChips picked={picked} onChange={setPicked}/></div>

  {top?<>
   <div className="stack">
    <div className="stack-edge left" style={{opacity:.25+glow('known')*.75}}><Check size={17}/> KNOWN</div>
    <div className="stack-edge right" style={{opacity:.25+glow('study')*.75}}>STUDY <Plus size={17}/></div>
    {deck.slice(0,VISIBLE).map((w,i)=>i===0
     ?<article key={w.id} className="swipe-card" style={style} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
       <div className="swipe-top"><span className="tag">{w.level}</span><span>{posOf(w)}</span>
        <button className="say" onPointerDown={e=>e.stopPropagation()} onClick={()=>speak(w.word,notice)} aria-label="Hear the word"><Volume2 size={17}/></button></div>
       <h2 lang="fr">{w.article||w.word}</h2>
       <button className="ipa-line" onPointerDown={e=>e.stopPropagation()} onClick={()=>speak(w.word,notice)}>/{w.ipa}/</button>
       <h3>{w.meaning}</h3>
       {peek?<div className="swipe-peek"><Cues ipa={w.ipa} size="sm"/><p lang="fr">{w.example}</p><span>{w.translation}</span></div>
        :<button className="hint-btn" onPointerDown={e=>e.stopPropagation()} onClick={()=>setPeek(true)}><Sparkles size={14}/> Peek at the scene</button>}
       <div className="swipe-down" style={{opacity:.3+glow('skip')*.7}}><ChevronDown size={16}/> skip labelling</div>
      </article>
     :<article key={w.id} className="swipe-card behind" style={{transform:`translateY(${i*14}px) scale(${1-i*.04})`,zIndex:VISIBLE-i}}>
       <h2 lang="fr">{w.article||w.word}</h2></article>)}
   </div>
   <div className="swipe-controls">
    <button className="verdict-btn known" onClick={()=>commit('known')}><Check size={18}/> I know this<kbd>←</kbd></button>
    <button className="verdict-btn skip" onClick={()=>commit('skip')}><ChevronDown size={18}/> Skip<kbd>↓</kbd></button>
    <button className="verdict-btn study" onClick={()=>commit('study')}><Plus size={18}/> Study this<kbd>→</kbd></button>
   </div>
   <div className="swipe-status">
    <span>{sorted} sorted this session <i>·</i> {deck.length.toLocaleString()} unlabelled left in {picked.join(', ')}</span>
    {last&&<button className="ghost" onClick={undo}><Undo2 size={14}/> Undo “{last.word.word}” <kbd>U</kbd></button>}
   </div>
   <p className="subtle">{last?verdicts[last.verdict].hint:'Swipe, drag, or use the arrow keys. Skipping leaves a word unlabelled so it returns in a later session.'}</p>
  </>:<div className="empty-state">
   <Sparkles size={26}/><h3>Nothing left to sort in {picked.join(', ')}.</h3>
   <p>Every word in this range is either in your library or marked known. Widen the level range to keep going.</p>
   <LevelChips picked={picked} onChange={setPicked}/>
  </div>}
 </>;
}
