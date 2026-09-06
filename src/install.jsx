import React,{useState,useEffect} from 'react';
import {Download,Share,Check,X,Plus,MoreVertical,RefreshCw,ClipboardCopy} from 'lucide-react';

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

// What to tell someone with no prompt in hand. The wording matters on Android:
// Chrome's menu offers "Add to Home screen" for any page at all, and for a page
// it does not consider installable that makes a bookmark which still opens in a
// tab with the address bar showing. "Install app" is the one that means it.
function Manual({ios,android,chromium}){
 if(ios)return <ol className="install-steps">
  <li>Tap <Share size={14}/> <b>Share</b> in the Safari toolbar.</li>
  <li>Scroll down and tap <Plus size={14}/> <b>Add to Home Screen</b>.</li>
  <li>Tap <b>Add</b>.</li>
 </ol>;
 if(android&&chromium)return <><ol className="install-steps">
  <li>Tap <MoreVertical size={14}/> in the Chrome toolbar.</li>
  <li>Look for <b>Install app</b> — that is the real one.</li>
 </ol>
 <p className="install-warn">If the menu only offers <b>Add to Home screen</b>, Chrome has not accepted this
  page as an app yet, and that option just makes a bookmark: it opens in a tab with the address bar still
  showing. Run the check below — it names what is missing.</p></>;
 if(chromium)return <ol className="install-steps">
  <li>Click the <Download size={14}/> install icon at the right of the address bar,</li>
  <li>or open the <MoreVertical size={14}/> menu and choose <b>Cast, save and share → Install page as app</b>.</li>
 </ol>;
 return null;
}

export function InstallPanel({offer,install,installed,ios,android,chromium}){
 const [report,setReport]=useState(null),[copied,setCopied]=useState(false);
 const run=()=>installCheck().then(setReport);
 useEffect(()=>{run()},[]);   // it answers the only question worth asking here
 const copy=()=>{
  const text=Object.entries(report||{}).map(([k,v])=>k+': '+v).join('\n');
  navigator.clipboard?.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1600)}).catch(()=>{});
 };
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
  {report&&<p className={'install-verdict '+(String(report.verdict).startsWith('BLOCKED')?'bad':'ok')}>{report.verdict}</p>}
  <div className="account-row">
   <button className="ghost-btn" onClick={run}><RefreshCw size={15}/> Re-run check</button>
   <button className="ghost-btn" onClick={copy} disabled={!report}>
    {copied?<Check size={15}/>:<ClipboardCopy size={15}/>} {copied?'Copied':'Copy report'}</button>
  </div>
  {report&&<dl className="report">{Object.entries(report).filter(([k])=>k!=='verdict').map(([k,v])=>
   <React.Fragment key={k}><dt>{k}</dt><dd>{String(v)}</dd></React.Fragment>)}</dl>}
 </section>;
}

// Installability fails silently: Chrome simply declines, and the browser menu
// then offers "Add to Home screen", which makes a plain bookmark that opens in
// a tab. So check every requirement by hand and say which one is missing.
export async function installCheck(){
 const out={};
 const verdict=[];
 out.displayMode=standalone()?'standalone (installed)':'browser tab';
 out.promptSeen=(window.__echoSeen||0)+' time(s)';
 out.promptInHand=window.__echoInstall?'yes':'no';
 out.secureContext=typeof isSecureContext!=='undefined'?String(isSecureContext):'unknown';
 if(typeof isSecureContext!=='undefined'&&!isSecureContext)verdict.push('not a secure context');
 out.origin=location.origin;
 out.engine=isChromium()?'chromium':isIOS()?'webkit':'other';

 // A file caught by the SPA rewrite comes back as the app's HTML, which is the
 // classic silent break: the manifest will not parse and the worker will not
 // register with an HTML content type.
 const probe=async path=>{
  try{
   // ?__probe bypasses this app's own service worker, which is cache-first and
   // would otherwise answer with a stored copy instead of the server's.
   const u=new URL(path,location.href);
   u.searchParams.set('__probe',Date.now());
   const r=await fetch(u.href,{cache:'no-store'});
   const type=(r.headers.get('content-type')||'').split(';')[0];
   const head=(await r.text()).slice(0,40).replace(/\s+/g,' ');
   return {ok:r.ok,status:r.status,type,head,html:/^\s*<(!doctype|html)/i.test(head)};
  }catch(err){return {ok:false,status:0,type:'',head:String(err&&err.message),html:false}}
 };

 const mf=document.querySelector('link[rel=manifest]');
 out.manifestLink=mf?mf.getAttribute('href'):'MISSING';
 if(!mf)verdict.push('no manifest link in the page');
 else{
  const p=await probe(mf.href);
  out.manifestServed=`${p.status} ${p.type}`;
  if(!p.ok)verdict.push('manifest did not load ('+p.status+')');
  else if(p.html)verdict.push('manifest came back as HTML — a rewrite is swallowing it');
  else{
   try{
    const mu=new URL(mf.href,location.href);mu.searchParams.set('__probe',Date.now());
    const m=await(await fetch(mu.href,{cache:'no-store'})).json();
    out.manifestName=m.name||'(none)';
    out.manifestDisplay=`${m.display} · start ${m.start_url} · scope ${m.scope}`;
    if(!m.name&&!m.short_name)verdict.push('manifest has no name');
    if(!['standalone','fullscreen','minimal-ui'].includes(m.display))verdict.push('display is '+m.display);
    if(m.prefer_related_applications===true)verdict.push('prefer_related_applications is true');
    const sizes=(m.icons||[]).flatMap(i=>String(i.sizes||'').split(' '));
    const px=sizes.map(x=>parseInt(x,10)).filter(Boolean);
    if(!px.some(n=>n>=192))verdict.push('no icon of 192px or more');
    if(!px.some(n=>n>=512))verdict.push('no icon of 512px or more');
    const icons=await Promise.all((m.icons||[]).map(async i=>{
     const r=await probe(new URL(i.src,location.origin).href);
     if(!r.ok||r.html)verdict.push('icon '+i.src+' did not load');
     return `${i.sizes}:${r.status}`;
    }));
    out.icons=icons.join('  ')||'NONE';
    const shots=m.screenshots||[];
    out.screenshots=shots.length?shots.length+' × '+shots[0].sizes:'none';
    out.richDialog=(shots.length&&m.description)?'eligible':'plain dialog only';
   }catch(err){verdict.push('manifest is not valid JSON');out.manifestParse=String(err&&err.message)}
  }
 }

 out.swRegister=window.__echoSW||'never attempted';
 if(String(out.swRegister).startsWith('FAILED'))verdict.push('service worker did not register');
 const p=await probe('/sw.js');
 out.swServed=`${p.status} ${p.type}`;
 if(p.html)verdict.push('/sw.js came back as HTML — a rewrite is swallowing it');
 else if(!p.ok)verdict.push('/sw.js did not load ('+p.status+')');
 try{
  const regs=await navigator.serviceWorker.getRegistrations();
  out.swState=regs.length?regs.map(r=>(r.active?'active':r.installing?'installing':r.waiting?'waiting':'idle')+' @ '+r.scope).join(' | '):'none';
  if(!regs.length)verdict.push('no service worker registered');
  else if(!regs.some(r=>r.active))verdict.push('service worker never activated');
  out.swControls=navigator.serviceWorker.controller?'yes':'no — reload once';
 }catch(err){out.swState='unavailable: '+(err&&err.message);verdict.push('service workers unavailable')}

 try{
  if(navigator.getInstalledRelatedApps){
   const apps=await navigator.getInstalledRelatedApps();
   if(apps.length)verdict.push('already installed — Chrome hides the offer');
   out.alreadyInstalled=apps.length?apps.map(a=>a.id||a.url).join(' '):'no';
  }
 }catch{}

 out.verdict=standalone()?'running as an installed app'
  :verdict.length?'BLOCKED: '+verdict.join('; ')
  :window.__echoInstall?'ready — Chrome has offered an install'
  :'every requirement is met, but Chrome has not offered yet (it gates on engagement — use the app a while, then reload)';
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
