import React,{useState,useEffect} from 'react';
import {Download,Share,Check,X,Plus,MoreVertical,RefreshCw} from 'lucide-react';

// Chromium fires beforeinstallprompt and hands you a prompt to replay later, but
// it fires on its own schedule — often before this bundle has run, since the app
// waits on a Supabase session before mounting. index.html catches it in the head
// and stashes it; this only reads what is already there.
export const standalone=()=>{
 try{return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}catch{return false}
};
const ua=()=>(typeof navigator!=='undefined'&&navigator.userAgent)||'';
const isIOS=()=>/iPad|iPhone|iPod/.test(ua())||(/Macintosh/.test(ua())&&navigator.maxTouchPoints>1);
const isAndroid=()=>/Android/.test(ua());
// Chromium is the only engine with an install API; Firefox and Safari are not.
const isChromium=()=>/Chrome|Chromium|CriOS|Edg/.test(ua())&&!/OPR|SamsungBrowser/.test(ua());
const HIDE='echo-install-hidden';
const ASKED='echo-install-asked';

export function useInstall(){
 const [offer,setOffer]=useState(()=>(typeof window!=='undefined'&&window.__echoInstall)||null);
 const [installed,setInstalled]=useState(()=>standalone()||!!(typeof window!=='undefined'&&window.__echoInstalled));
 useEffect(()=>{
  const pick=()=>setOffer(window.__echoInstall||null);
  const done=()=>{setOffer(null);setInstalled(true)};
  pick();
  window.addEventListener('echo-installable',pick);
  window.addEventListener('echo-installed',done);
  // belt and braces, in case the head script was stripped or ran late
  window.addEventListener('beforeinstallprompt',pick);
  window.addEventListener('appinstalled',done);
  return()=>{window.removeEventListener('echo-installable',pick);window.removeEventListener('echo-installed',done);
   window.removeEventListener('beforeinstallprompt',pick);window.removeEventListener('appinstalled',done)};
 },[]);
 const install=async()=>{
  const e=offer||window.__echoInstall;
  if(!e)return;
  e.prompt();
  const {outcome}=await e.userChoice.catch(()=>({outcome:'dismissed'}));
  if(outcome==='accepted')setInstalled(true);
  window.__echoInstall=null;           // a prompt can only be replayed once
  setOffer(null);
 };
 return {offer,install,installed,ios:isIOS(),android:isAndroid(),chromium:isChromium()};
}

// What to tell someone with no prompt in hand. Chrome dropped the automatic
// install banner years ago, so on Android the menu item is the honest answer.
function Manual({ios,android,chromium}){
 if(ios)return <ol className="install-steps">
  <li>Tap <Share size={14}/> <b>Share</b> in the Safari toolbar.</li>
  <li>Scroll down and tap <Plus size={14}/> <b>Add to Home Screen</b>.</li>
  <li>Tap <b>Add</b>.</li>
 </ol>;
 if(android&&chromium)return <ol className="install-steps">
  <li>Tap <MoreVertical size={14}/> in the Chrome toolbar.</li>
  <li>Tap <b>Add to Home screen</b>, then <b>Install</b>.</li>
 </ol>;
 if(chromium)return <ol className="install-steps">
  <li>Click the <Download size={14}/> install icon at the right of the address bar,</li>
  <li>or open the <MoreVertical size={14}/> menu and choose <b>Cast, save and share → Install page as app</b>.</li>
 </ol>;
 return null;
}

export function InstallPanel({offer,install,installed,ios,android,chromium}){
 const [report,setReport]=useState(null);
 const manual=<Manual ios={ios} android={android} chromium={chromium}/>;
 return <section className="account">
  <h3>Install on this device</h3>
  {installed
   ?<p className="install-done"><Check size={15}/> Running as an installed app. It opens without browser chrome and works offline.</p>
   :<>
     {offer&&<div className="account-row"><button className="primary" onClick={install}><Download size={17}/> Install Écho</button></div>}
     {manual}
     {!offer&&!manual&&<p>This browser has no install option. Chrome, Edge and Safari can add the page as an app; Firefox cannot.</p>}
     <p>{ios
      ?'Safari only offers this from Safari itself — not from Chrome or an in-app browser. Once added it opens full screen and works offline, and audio behaves better than it does in a tab.'
      :'Chrome stopped showing an automatic install banner years ago, so the menu item above is the reliable route even when this page offers no button. Installed, it opens in its own window and keeps working without a connection — only syncing and AI writing need one.'}</p>
    </>}
  <div className="account-row">
   <button className="ghost-btn" onClick={()=>installCheck().then(setReport)}><RefreshCw size={15}/> Install check</button>
  </div>
  {report&&<dl className="report">{Object.entries(report).map(([k,v])=>
   <React.Fragment key={k}><dt>{k}</dt><dd>{String(v)}</dd></React.Fragment>)}</dl>}
 </section>;
}

// Installability fails silently, so make the state readable rather than guessed.
export async function installCheck(){
 const out={
  displayMode:standalone()?'standalone (installed)':'browser tab',
  secureContext:typeof isSecureContext!=='undefined'?String(isSecureContext):'unknown',
  origin:location.origin,
  engine:isChromium()?'chromium':isIOS()?'webkit':'other',
  promptSeen:(window.__echoSeen||0)+' time(s)',
  promptInHand:window.__echoInstall?'yes':'no'
 };
 try{
  const link=document.querySelector('link[rel=manifest]');
  out.manifestLink=link?link.getAttribute('href'):'MISSING';
  if(link){
   const res=await fetch(link.href,{cache:'no-store'});
   out.manifestFetch=res.status+' '+(res.headers.get('content-type')||'');
   const m=await res.json();
   out.manifestName=m.name;
   out.manifestDisplay=m.display+' · start '+m.start_url;
   const icons=await Promise.all((m.icons||[]).map(async i=>{
    try{const r=await fetch(new URL(i.src,location.origin),{method:'HEAD',cache:'no-store'});
     return `${i.sizes}${i.purpose==='maskable'?' maskable':''}:${r.status}`}
    catch{return `${i.sizes}:FAILED`}
   }));
   out.icons=icons.join('  ');
   const shots=m.screenshots||[];
   out.screenshots=shots.length?`${shots.length} (${shots.map(x=>x.sizes).join(' ')})`:'none — plain dialog, not the rich one';
   out.richDialog=(shots.length&&m.description)?'eligible':'no: needs screenshots + description';
  }
 }catch(err){out.manifestError=err&&err.message}
 try{
  const regs=await navigator.serviceWorker?.getRegistrations?.()||[];
  out.serviceWorker=regs.length?regs.map(r=>r.scope).join(' '):'none registered';
  out.swControlling=navigator.serviceWorker?.controller?'yes':'no (reload once)';
 }catch{out.serviceWorker='unavailable'}
 try{
  if(navigator.getInstalledRelatedApps){
   const apps=await navigator.getInstalledRelatedApps();
   out.alreadyInstalled=apps.length?apps.map(a=>a.id||a.url).join(' '):'not reported';
  }
 }catch{}
 return out;
}

// One dismissible nudge in the lobby: installing is a once-ever action, so it
// needs to be findable, and the Progress panel alone is too well hidden.
export function InstallNudge({offer,install,installed,ios,android,chromium}){
 const [hidden,setHidden]=useState(()=>{try{return localStorage.getItem(HIDE)==='1'}catch{return false}});
 const showing=!installed&&!hidden&&offer;
 useEffect(()=>{
  // prompt() is gesture-gated, so Chrome never opens the dialog on its own.
  // Arm the next tap once, and only while the nudge is actually on screen.
  if(!showing)return;
  try{if(localStorage.getItem(ASKED)==='1')return}catch{}
  const fire=()=>{
   window.removeEventListener('pointerdown',fire);
   try{localStorage.setItem(ASKED,'1')}catch{}
   install();
  };
  window.addEventListener('pointerdown',fire);
  return()=>window.removeEventListener('pointerdown',fire);
 },[showing]);
 const canManual=ios||(android&&chromium);
 if(installed||hidden||(!offer&&!canManual))return null;
 const dismiss=()=>{try{localStorage.setItem(HIDE,'1')}catch{}setHidden(true)};
 return <div className="install-nudge">
  <img src="/icon-192.png" alt="" width="34" height="34"/>
  <div><strong>Add Écho to your home screen</strong>
   <small>{offer?'It opens in its own window and works offline.'
    :ios?'Share → Add to Home Screen. It opens full screen and works offline.'
    :'Chrome menu ⋮ → Add to Home screen. It works offline once installed.'}</small></div>
  {offer&&<button className="go slim" onClick={install}>INSTALL</button>}
  <button className="nudge-x" onClick={dismiss} aria-label="Dismiss"><X size={16}/></button>
 </div>;
}
