import React,{useState,useEffect} from 'react';
import {Download,Share,Check,X,Plus} from 'lucide-react';

// Chromium fires beforeinstallprompt and hands you a prompt to replay later.
// Safari has no such API at all: on iOS the only route is Share → Add to Home
// Screen, so there the honest thing to show is the instruction, not a button.
export const standalone=()=>{
 try{return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}catch{return false}
};
const isIOS=()=>{
 const ua=navigator.userAgent||'';
 return /iPad|iPhone|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
};
const HIDE='echo-install-hidden';

export function useInstall(){
 const [offer,setOffer]=useState(null);
 const [installed,setInstalled]=useState(standalone);
 useEffect(()=>{
  const hold=e=>{e.preventDefault();setOffer(e)};
  const done=()=>{setOffer(null);setInstalled(true)};
  window.addEventListener('beforeinstallprompt',hold);
  window.addEventListener('appinstalled',done);
  return()=>{window.removeEventListener('beforeinstallprompt',hold);window.removeEventListener('appinstalled',done)};
 },[]);
 const install=async()=>{
  if(!offer)return;
  offer.prompt();
  const {outcome}=await offer.userChoice.catch(()=>({outcome:'dismissed'}));
  if(outcome==='accepted')setInstalled(true);
  setOffer(null);           // a prompt can only be replayed once
 };
 return {offer,install,installed,ios:isIOS()};
}

export function InstallPanel({offer,install,installed,ios}){
 return <section className="account">
  <h3>Install on this device</h3>
  {installed
   ?<p className="install-done"><Check size={15}/> Running as an installed app. It opens without browser chrome and works offline.</p>
   :offer
    ?<><div className="account-row"><button className="primary" onClick={install}><Download size={17}/> Install Écho</button></div>
      <p>It gets its own icon and window, and keeps working without a connection — only syncing and AI writing need one.</p></>
    :ios
     ?<><ol className="install-steps">
        <li>Tap <Share size={14}/> <b>Share</b> in the Safari toolbar.</li>
        <li>Scroll down and tap <Plus size={14}/> <b>Add to Home Screen</b>.</li>
        <li>Tap <b>Add</b>.</li>
       </ol>
       <p>Safari only offers this from Safari itself — not from Chrome or an in-app browser. Once added it opens
        full screen and works offline, and audio behaves better than it does in a tab.</p></>
     :<p>Your browser has not offered an install for this page. In Chrome or Edge it appears in the address bar
       or under the ⋮ menu as <b>Install app</b>; Firefox and desktop Safari can add a bookmark but not an app.</p>}
 </section>;
}

// One dismissible nudge in the lobby: installing is a once-ever action, so it
// needs to be findable, and the Progress panel alone is too well hidden.
export function InstallNudge({offer,install,installed,ios}){
 const [hidden,setHidden]=useState(()=>{try{return localStorage.getItem(HIDE)==='1'}catch{return false}});
 if(installed||hidden||(!offer&&!ios))return null;
 const dismiss=()=>{try{localStorage.setItem(HIDE,'1')}catch{}setHidden(true)};
 return <div className="install-nudge">
  <img src="/icon-192.png" alt="" width="34" height="34"/>
  <div><strong>Add Écho to your home screen</strong>
   <small>{ios?'Share → Add to Home Screen. It opens full screen and works offline.'
    :'It opens in its own window and works offline.'}</small></div>
  {offer&&<button className="go slim" onClick={install}>INSTALL</button>}
  <button className="nudge-x" onClick={dismiss} aria-label="Dismiss"><X size={16}/></button>
 </div>;
}
