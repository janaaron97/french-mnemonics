import React,{useState,useEffect,useRef} from 'react';
import {Volume2} from 'lucide-react';
import {tokenize,levels,levelBlurb} from './engine';

export function speak(text,notice,rate=.8){
 if(!('speechSynthesis' in window))return notice?.('Speech is unavailable in this browser. Use the IPA guide.');
 const voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('fr'));
 speechSynthesis.cancel();
 const u=new SpeechSynthesisUtterance(text);
 u.lang='fr-FR';u.rate=rate;
 if(voice)u.voice=voice;else notice?.('Using your device’s French speech service. Voice availability varies by browser.');
 speechSynthesis.speak(u);
}

let ctx;
export function tone(steps,on=true){
 if(!on)return;
 try{
  ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();
  if(ctx.state==='suspended')ctx.resume();
  steps.forEach(([hz,at,len,shape='triangle'],i)=>{
   const o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime+at;
   o.type=shape;o.frequency.setValueAtTime(hz,t);
   g.gain.setValueAtTime(.0001,t);
   g.gain.exponentialRampToValueAtTime(.14,t+.012);
   g.gain.exponentialRampToValueAtTime(.0001,t+len);
   o.connect(g);g.connect(ctx.destination);
   o.start(t);o.stop(t+len+.02);
  });
 }catch{}
}
export const buzz=ms=>{try{navigator.vibrate?.(ms)}catch{}};

export function LevelChips({picked,onChange,compact}){
 const all=picked.length===levels.length;
 return <div className={'level-chips'+(compact?' compact':'')}>
  {levels.map(l=>{
   const on=picked.includes(l);
   return <button key={l} className={on?'on':''} aria-pressed={on}
    onClick={()=>{if(on&&picked.length===1)return;onChange(levels.filter(x=>on?picked.includes(x)&&x!==l:picked.includes(x)||x===l))}}>
    {l}{!compact&&<span>{levelBlurb[l]}</span>}</button>;
  })}
  <button className={'chip-all'+(all?' on':'')} onClick={()=>onChange(all?['A1']:[...levels])}>{all?'A1 only':'A1 → C1'}</button>
 </div>;
}

export function Cues({ipa,onPick,size='md'}){
 return <div className={'cue-strip '+size}>{tokenize(ipa).map((s,i)=>
  <React.Fragment key={i}>{i>0&&<span className="cue-arrow">→</span>}
  <button className={'cue '+s.type} disabled={!onPick} onClick={()=>onPick?.(s)}>
   <span>{s.emoji}</span><strong>{s.name}</strong><small>/{s.ipa}/</small></button></React.Fragment>)}</div>;
}

export function Say({text,label,notice,className}){
 return <button className={className||'say'} aria-label={label||'Listen'} onClick={()=>speak(text,notice)}><Volume2 size={17}/></button>;
}

export function useKeys(handler,deps){
 const ref=useRef(handler);ref.current=handler;
 useEffect(()=>{const on=e=>ref.current(e);window.addEventListener('keydown',on);return()=>window.removeEventListener('keydown',on)},deps||[]);
}

export function Counter({value,className}){
 const [shown,setShown]=useState(value);
 useEffect(()=>{
  if(shown===value)return;
  const from=shown,delta=value-from,t0=performance.now();
  let raf;const step=t=>{const k=Math.min(1,(t-t0)/420);setShown(Math.round(from+delta*(1-Math.pow(1-k,3))));if(k<1)raf=requestAnimationFrame(step)};
  raf=requestAnimationFrame(step);return()=>cancelAnimationFrame(raf);
 },[value]);
 return <strong className={className}>{shown.toLocaleString()}</strong>;
}

// The on-screen keyboard shrinks the visual viewport but not the layout
// viewport, so a bottom-anchored bar ends up underneath it. Track the real
// visible height and let CSS anchor to that instead.
export function useVisualViewport(){
 useEffect(()=>{
  const vv=window.visualViewport;
  const root=document.documentElement;
  const apply=()=>{
   const h=vv?vv.height:window.innerHeight;
   root.style.setProperty('--vvh',h+'px');
   root.style.setProperty('--vvtop',(vv?vv.offsetTop:0)+'px');
  };
  apply();
  if(!vv){window.addEventListener('resize',apply);return()=>window.removeEventListener('resize',apply)}
  vv.addEventListener('resize',apply);vv.addEventListener('scroll',apply);
  return()=>{vv.removeEventListener('resize',apply);vv.removeEventListener('scroll',apply)};
 },[]);
}
