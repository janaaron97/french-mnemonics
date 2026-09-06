import React,{useState,useEffect,useRef} from 'react';
import {Volume2} from 'lucide-react';
import {tokenize,levels,levelBlurb} from './engine';

// Safari will not hand out voices until it has loaded them, and reports an
// empty list on the first call, so cache them and refresh on voiceschanged.
let voices=[];
const readVoices=()=>{try{voices=window.speechSynthesis?.getVoices()||[]}catch{voices=[]}};
if(typeof window!=='undefined'&&window.speechSynthesis){
 readVoices();
 try{window.speechSynthesis.addEventListener('voiceschanged',readVoices)}catch{window.speechSynthesis.onvoiceschanged=readVoices}
}

export function speak(text,notice,rate=.8){
 const synth=typeof window!=='undefined'&&window.speechSynthesis;
 if(!synth)return notice?.('Speech is unavailable in this browser. Use the IPA guide.');
 if(!voices.length)readVoices();
 const voice=voices.find(v=>/^fr/i.test(v.lang));
 try{
  // Safari can be left paused when a tab is backgrounded, and cancelling when
  // nothing is speaking sometimes swallows the next utterance outright.
  if(synth.paused)synth.resume();
  if(synth.speaking||synth.pending)synth.cancel();
  const u=new SpeechSynthesisUtterance(String(text));
  u.lang=voice?.lang||'fr-FR';
  u.rate=Math.max(.5,Math.min(2,rate));
  if(voice)u.voice=voice;
  else if(voices.length)notice?.('No French voice on this device — using the default. Voice availability varies by browser.');
  synth.speak(u);
 }catch{notice?.('Speech failed to start. Try again, or check your device volume.')}
}

// An AudioContext starts suspended and Safari only lets a real user gesture
// resume it — and only truly unlocks once a buffer has actually played.
let ctx,unlocked=false;
function audio(){
 try{
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return null;
  ctx=ctx||new Ctx();
  if(ctx.state==='suspended')ctx.resume();
  return ctx;
 }catch{return null}
}
// iOS mutes the Web Audio and speech "ambient" session when the ringer switch
// is off. A looping HTMLMediaElement moves the page into the playback session,
// which the switch does not silence. It has to carry a non-zero waveform —
// a genuinely silent or muted element stays ambient and changes nothing.
const LOUD='echo-loud';
export const isLoud=()=>{try{return localStorage.getItem(LOUD)!=='0'}catch{return true}};
export function setLoud(on){
 try{localStorage.setItem(LOUD,on?'1':'0')}catch{}
 if(on)keepAwake();else stopAwake();
}
let keeper,keeperUrl;
function hum(){
 const rate=8000,len=rate,buf=new ArrayBuffer(44+len*2),view=new DataView(buf);
 const tag=(at,t)=>{for(let i=0;i<t.length;i++)view.setUint8(at+i,t.charCodeAt(i))};
 tag(0,'RIFF');view.setUint32(4,36+len*2,true);tag(8,'WAVEfmt ');
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
 view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
 tag(36,'data');view.setUint32(40,len*2,true);
 for(let i=0;i<len;i++)view.setInt16(44+i*2,i%2?1:-1,true);
 return URL.createObjectURL(new Blob([buf],{type:'audio/wav'}));
}
export function keepAwake(){
 if(keeper||!isLoud())return;
 try{
  keeperUrl=keeperUrl||hum();
  keeper=new Audio(keeperUrl);
  keeper.loop=true;keeper.volume=.02;
  keeper.setAttribute('playsinline','');
  keeper.play().catch(()=>{keeper=null});
 }catch{keeper=null}
}
export function stopAwake(){
 try{keeper?.pause()}catch{}
 keeper=null;
}

export function unlockSound(){
 // Safari 16.4+ only lets audio through the hardware silent switch when the
 // page declares a playback audio session. Without this, WebAudio and speech
 // are both muted on a phone with the ringer off, with no error anywhere.
 try{if(navigator.audioSession&&navigator.audioSession.type!=='playback')navigator.audioSession.type='playback'}catch{}
 keepAwake();
 const c=audio();
 if(!c||unlocked)return;
 try{
  const s=c.createBufferSource();
  s.buffer=c.createBuffer(1,1,22050);
  s.connect(c.destination);
  s.start(0);
  unlocked=true;
 }catch{}
}
export function useSoundUnlock(){
 useEffect(()=>{
  const on=()=>unlockSound();
  window.addEventListener('pointerdown',on);
  window.addEventListener('touchend',on);
  window.addEventListener('keydown',on);
  return()=>{window.removeEventListener('pointerdown',on);
   window.removeEventListener('touchend',on);window.removeEventListener('keydown',on)};
 },[]);
}
export function tone(steps,on=true){
 if(!on)return;
 const c=audio();
 if(!c)return;
 try{
  steps.forEach(([hz,at,len,shape='triangle'])=>{
   const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+at+.02;
   o.type=shape;o.frequency.setValueAtTime(hz,t);
   g.gain.setValueAtTime(.0001,t);
   g.gain.exponentialRampToValueAtTime(.14,t+.012);
   g.gain.exponentialRampToValueAtTime(.0001,t+len);
   o.connect(g);g.connect(c.destination);
   o.start(t);o.stop(t+len+.02);
  });
 }catch{}
}
export const buzz=ms=>{try{navigator.vibrate?.(ms)}catch{}};

// Safari failures here are silent by nature, so make the state inspectable
// rather than guessing at it from the outside.
export function soundReport(){
 const synth=typeof window!=='undefined'&&window.speechSynthesis;
 const list=synth?(synth.getVoices()||[]):[];
 const fr=list.filter(v=>/^fr/i.test(v.lang));
 return {
  audioContext:ctx?ctx.state:'not created',
  unlocked,
  audioSession:(typeof navigator!=='undefined'&&navigator.audioSession)?(navigator.audioSession.type||'default'):'unsupported',
  silentSwitchOverride:isLoud()?(keeper&&!keeper.paused?'on and running':'on, not started'):'off',
  speech:synth?'available':'missing',
  voices:list.length,
  frenchVoices:fr.length,
  frenchVoice:fr[0]?`${fr[0].name} (${fr[0].lang})`:'none',
  speaking:synth?!!synth.speaking:false,
  paused:synth?!!synth.paused:false
 };
}

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
