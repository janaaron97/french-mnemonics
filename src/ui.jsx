import React,{useState,useEffect,useRef} from 'react';
import {Volume2} from 'lucide-react';
import {tokenize,levels,levelBlurb} from './engine';
import {speechFor} from './generate.js';

// Safari will not hand out voices until it has loaded them, and reports an
// empty list on the first call, so cache them and refresh on voiceschanged.
let voices=[];
const readVoices=()=>{try{voices=window.speechSynthesis?.getVoices()||[]}catch{voices=[]}};
if(typeof window!=='undefined'&&window.speechSynthesis){
 readVoices();
 try{window.speechSynthesis.addEventListener('voiceschanged',readVoices)}catch{window.speechSynthesis.onvoiceschanged=readVoices}
}

// Everything Safari gets wrong here is silent, so every attempt records what
// happened — whether the utterance started, ended, or errored, and with what.
// That readout is the only way to tell "muted" apart from "never began".
export let heard={state:'nothing spoken yet'};
export const lastSpoken=()=>heard;
const ua=()=>(typeof navigator!=='undefined'&&navigator.userAgent)||'';
export const isApple=()=>/iPad|iPhone|iPod/.test(ua())||(/Macintosh/.test(ua())&&navigator.maxTouchPoints>1);
export const hasAudioSession=()=>typeof navigator!=='undefined'&&!!navigator.audioSession;

// fr-FR before any other French: the corpus is France French, and a phone that
// lists Amélie (fr-CA) first would otherwise read the whole app in Québécois.
export function frenchVoice(){
 const fr=voices.filter(v=>/^fr/i.test(v.lang));
 return fr.find(v=>/^fr[-_]?FR$/i.test(v.lang))||fr.find(v=>/^fr$/i.test(v.lang))||fr[0];
}
export function speakLocal(text,notice,rate=1,source='browser voice'){
 const synth=typeof window!=='undefined'&&window.speechSynthesis;
 if(!synth)return notice?.('Speech is unavailable in this browser. Use the IPA guide.');
 if(!voices.length)readVoices();
 const voice=frenchVoice();
 let u;
 try{
  u=new SpeechSynthesisUtterance(String(text));
  u.lang=voice?.lang||'fr-FR';
  u.rate=Math.max(.5,Math.min(2,rate));
  // A voice object can go stale across a voiceschanged and be refused on
  // assignment; the utterance is still perfectly usable with just a lang.
  if(voice)try{u.voice=voice}catch{}
 }catch(err){
  heard={said:String(text).slice(0,32),started:'no',ended:'no',error:'could not build the utterance: '+(err&&err.message)};
  return notice?.('Speech failed to start. Try again, or check your device volume.');
 }
 const t0=Date.now();
 heard={said:String(text).slice(0,32),source,voice:voice?`${voice.name} (${voice.lang})`:'device default',
  rate:u.rate,at:new Date().toLocaleTimeString(),started:'no',ended:'no',error:'none',
  startedAfter:'—',wasSpeaking:String(!!synth.speaking),wasPaused:String(!!synth.paused)};
 u.onstart=()=>{heard.started='yes';heard.startedAfter=(Date.now()-t0)+'ms';quiet(true)};
 u.onend=()=>{heard.ended='yes';quiet(false)};
 u.onerror=e=>{heard.error=(e&&e.error)||'unknown';quiet(false)};
 if(!voice&&voices.length)notice?.('No French voice on this device — using the default. Voice availability varies by browser.');
 const go=()=>{try{synth.speak(u)}catch(err){heard.error='threw: '+(err&&err.message);
  notice?.('Speech failed to start. Try again, or check your device volume.')}};
 try{
  if(synth.paused)synth.resume();
  // Safari drops an utterance queued in the same tick as cancel(), so when
  // something really is speaking, cancel and queue on the next turn. The very
  // first call never takes that path, so it keeps its user gesture.
  if(synth.speaking||synth.pending){synth.cancel();setTimeout(go,0)}
  else go();
 }catch(err){heard.error='threw: '+(err&&err.message)}
}

// --- the spoken voice ---------------------------------------------------
// Safari's speechSynthesis runs on an audio session the page cannot set. With
// the ringer switch off it starts, reports no error, and produces nothing you
// can hear — which is exactly what the sound report showed. A media element
// does obey the page's own playback session, so real audio plays where speech
// cannot. The audio is generated server-side and then cached on the device
// forever, so a word costs one request the first time it is ever spoken.
const VOICE='echo-voice',SPEECH_CACHE='echo-speech';
export const voiceMode=()=>{try{return localStorage.getItem(VOICE)||'ai'}catch{return 'ai'}};
export function setVoiceMode(m){try{localStorage.setItem(VOICE,m)}catch{}}

// One element, unlocked once inside a gesture and reused for everything after.
// iOS only gates the first play(); once that has happened the src can change
// freely, which is what lets audio start after an await.
let player,playerReady=false,lastUrl;
function prime(){
 if(player)return player;
 try{
  player=new Audio();
  player.setAttribute('playsinline','');
  player.preload='auto';
 }catch{player=null}
 return player;
}
function unlockPlayer(){
 const a=prime();
 if(!a||playerReady)return;
 try{
  a.src=beepFile(true);
  const p=a.play();
  if(p&&p.then)p.then(()=>{playerReady=true;a.pause();a.currentTime=0}).catch(()=>{});
  else playerReady=true;
 }catch{}
}
async function voiceBlob(text){
 const key='/echo-speech/'+encodeURIComponent(text);
 let store=null;
 try{store=await caches.open(SPEECH_CACHE)}catch{}
 if(store){
  const hit=await store.match(key);
  if(hit)return hit.blob();
 }
 const blob=await speechFor(text);
 if(store)try{await store.put(key,new Response(blob.slice(),{headers:{'content-type':blob.type||'audio/mpeg'}}))}catch{}
 return blob;
}
export async function playSpoken(text,rate=1){
 const a=prime();
 if(!a)throw new Error('No audio element available.');
 const blob=await voiceBlob(text);
 if(lastUrl)try{URL.revokeObjectURL(lastUrl)}catch{}
 lastUrl=URL.createObjectURL(blob);
 a.src=lastUrl;
 a.playbackRate=Math.max(.5,Math.min(2,rate));
 await a.play();
 playerReady=true;
 return new Promise(resolve=>{a.onended=()=>resolve('played');setTimeout(()=>resolve('playing'),8000)});
}

// The one entry point the app calls. Tries real audio, falls back to the
// browser voice — offline, without a key, or over the daily limit.
export function speak(text,notice,rate=1){
 const say=String(text||'').trim();
 if(!say)return;
 if(voiceMode()==='browser')return speakLocal(say,notice,rate);
 heard={said:say.slice(0,32),voice:'spoken audio (server)',rate,at:new Date().toLocaleTimeString(),
  started:'no',ended:'no',error:'none',startedAfter:'—',source:'fetching…'};
 const t0=Date.now();
 playSpoken(say,rate).then(how=>{
  heard.started='yes';heard.ended=how==='played'?'yes':'no';
  heard.startedAfter=(Date.now()-t0)+'ms';heard.source='spoken audio';
 }).catch(err=>{
  // Say why the audio route failed, then let the browser voice try: it is
  // better than silence, even where the ringer switch will mute it.
  speakLocal(say,notice,rate,'browser voice — spoken audio failed: '+((err&&err.message)||'unknown'));
 });
}

// An AudioContext starts suspended and Safari only lets a real user gesture
// resume it — and only truly unlocks once a buffer has actually played.
let ctx,unlocked=false,warmed=false;
function audio(){
 try{
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return null;
  if(!ctx){
   ctx=new Ctx();
   // iOS parks a context at 'interrupted' after a call, another app, or the
   // ringer switch, and it stays there until something resumes it.
   ctx.addEventListener?.('statechange',()=>{
    if(ctx.state==='interrupted'||ctx.state==='suspended')ctx.resume().catch(()=>{});
   });
  }
  if(ctx.state!=='running')ctx.resume().catch(()=>{});
  return ctx;
 }catch{return null}
}
export const audioState=()=>ctx?ctx.state:'not created';
export const isUnlocked=()=>unlocked;

// iOS mutes the Web Audio and speech "ambient" session when the ringer switch
// is off. Safari 16.4+ fixes that properly with navigator.audioSession; a
// looping media element is only the fallback for older versions, and it is a
// blunt one — it holds the output device open, which on some versions is
// itself enough to stop speech coming out. So use the API where it exists,
// hum only where it does not, and never hum over an utterance.
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
 if(keeper||!isLoud()||hasAudioSession())return;
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
// Get out of the way while something is being said, then come back.
function quiet(on){
 if(!keeper)return;
 try{on?keeper.pause():keeper.play().catch(()=>{})}catch{}
}
export const keeperState=()=>!isLoud()?'off':hasAudioSession()?'not needed (audioSession supported)'
 :keeper?(keeper.paused?'paused':'running'):'not started';

export function unlockSound(){
 // Safari 16.4+ only lets audio through the hardware silent switch when the
 // page declares a playback audio session. Without this, WebAudio and speech
 // are both muted on a phone with the ringer off, with no error anywhere.
 try{if(navigator.audioSession&&navigator.audioSession.type!=='playback')navigator.audioSession.type='playback'}catch{}
 keepAwake();
 unlockPlayer();
 // iOS only lets the FIRST utterance begin from inside a user gesture; every
 // one after it is free. Spend that first one on a space nobody hears, so the
 // real one later in a round is never the one being refused.
 if(!warmed&&typeof window!=='undefined'&&window.speechSynthesis){
  warmed=true;
  try{
   const w=new SpeechSynthesisUtterance(' ');
   w.volume=0;w.rate=2;w.lang='fr-FR';
   w.onerror=e=>{heard={state:'warm-up refused',error:(e&&e.error)||'unknown'}};
   window.speechSynthesis.speak(w);
  }catch{}
 }
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
export const isWarmed=()=>warmed;
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
// A real, audible tone through an <audio> element — a different pipeline from
// WebAudio and from speech, so testing it separately says which one is muted.
let toneUrl;
let hushUrl;
export function beepFile(silent){
 if(silent){
  if(!hushUrl){
   const rate=8000,len=1200,buf=new ArrayBuffer(44+len*2),view=new DataView(buf);
   const tag=(at,t)=>{for(let i=0;i<t.length;i++)view.setUint8(at+i,t.charCodeAt(i))};
   tag(0,'RIFF');view.setUint32(4,36+len*2,true);tag(8,'WAVEfmt ');
   view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
   view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
   tag(36,'data');view.setUint32(40,len*2,true);
   hushUrl=URL.createObjectURL(new Blob([buf],{type:'audio/wav'}));
  }
  return hushUrl;
 }
 if(!toneUrl){
  const rate=22050,len=Math.floor(rate*.45),buf=new ArrayBuffer(44+len*2),view=new DataView(buf);
  const tag=(at,t)=>{for(let i=0;i<t.length;i++)view.setUint8(at+i,t.charCodeAt(i))};
  tag(0,'RIFF');view.setUint32(4,36+len*2,true);tag(8,'WAVEfmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  tag(36,'data');view.setUint32(40,len*2,true);
  for(let i=0;i<len;i++){
   const fade=Math.min(1,i/900,(len-i)/900);
   view.setInt16(44+i*2,Math.round(Math.sin(2*Math.PI*660*i/rate)*12000*fade),true);
  }
  toneUrl=URL.createObjectURL(new Blob([buf],{type:'audio/wav'}));
 }
 return toneUrl;
}
export function playFile(){
 return new Promise(resolve=>{
  try{
   const a=new Audio(beepFile());
   a.setAttribute('playsinline','');a.volume=1;
   a.onended=()=>resolve('played to the end');
   a.onerror=()=>resolve('element error: '+(a.error?a.error.code:'unknown'));
   a.play().then(()=>{setTimeout(()=>resolve(a.paused?'started, then paused':'playing'),700)})
    .catch(err=>resolve('play() rejected: '+(err&&err.name)+' '+(err&&err.message)));
  }catch(err){resolve('threw: '+(err&&err.message))}
 });
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

// Safari fails silently by design here, so make every layer inspectable: which
// pipeline was asked, whether it began, and what it said if it refused.
export function soundReport(){
 const synth=typeof window!=='undefined'&&window.speechSynthesis;
 const list=synth?(synth.getVoices()||[]):[];
 const fr=list.filter(v=>/^fr/i.test(v.lang));
 const m=ua().match(/(?:iPhone )?OS (\d+[_.]\d+)|Version\/(\d+\.\d+)/);
 return {
  device:isApple()?'Apple (iOS/iPadOS/Safari)':'other',
  osOrSafari:m?(m[1]||m[2]).replace('_','.'):'unknown',
  standalone:(()=>{try{return String(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)}catch{return '?'}})(),
  audioContext:audioState(),
  webAudioUnlocked:String(isUnlocked()),
  speechWarmedUp:String(isWarmed()),
  audioSession:hasAudioSession()?(navigator.audioSession.type||'default'):'unsupported',
  silentSwitchHum:keeperState(),
  voiceSource:voiceMode()==='ai'?'spoken audio (falls back to the browser voice)':'browser voice only',
  audioElement:player?(playerReady?'unlocked':'created, not unlocked'):'not created',
  speech:synth?'available':'missing',
  voices:list.length,
  frenchVoices:fr.length,
  frenchVoice:(()=>{const v=frenchVoice();return v?`${v.name} (${v.lang})`:'none'})(),
  speaking:synth?String(!!synth.speaking):'?',
  paused:synth?String(!!synth.paused):'?',
  ...Object.fromEntries(Object.entries(lastSpoken()).map(([k,v])=>['last '+k,v]))
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
