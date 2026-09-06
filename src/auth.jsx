import React,{useState} from 'react';
import {ArrowRight,Loader2,MailCheck} from 'lucide-react';
import {supabase} from './cloud.js';

const copy={
 in:{title:'Welcome back.',blurb:'Your library, review schedule, and personal scenes are waiting.',action:'Sign in'},
 up:{title:'Start your palace.',blurb:'One account keeps your words in step across every device you study on.',action:'Create account'},
 forgot:{title:'Reset your password.',blurb:'We’ll email you a link that signs you in and lets you set a new one.',action:'Send reset link'},
 reset:{title:'Choose a new password.',blurb:'Pick something at least eight characters long.',action:'Save password'}
};

export default function Auth({recovery}){
 const [mode,setMode]=useState(recovery?'reset':'in');
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState('');
 const {title,blurb,action}=copy[mode];

 const submit=async e=>{
  e.preventDefault();
  setError('');setSent('');
  if(mode!=='forgot'&&password.length<8)return setError('Passwords need at least eight characters.');
  setBusy(true);
  try{
   if(mode==='in'){
    const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(error)throw error;
   }else if(mode==='up'){
    const {data,error}=await supabase.auth.signUp({email:email.trim(),password});
    if(error)throw error;
    if(!data.session)setSent('Check your inbox and confirm your address, then sign in.');
   }else if(mode==='forgot'){
    const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin});
    if(error)throw error;
    setSent('Reset link sent. Open it on this device to continue.');
   }else{
    const {error}=await supabase.auth.updateUser({password});
    if(error)throw error;
    setSent('Password updated.');
   }
  }catch(err){setError(err?.message||'That did not work. Try again.')}
  setBusy(false);
 };

 const go=next=>{setMode(next);setError('');setSent('')};
 return <div className="gate">
  <form className="gate-card" onSubmit={submit}>
   <div className="gate-brand">écho<span>FRENCH, IN YOUR MIND.</span></div>
   <h1>{title}</h1>
   <p className="gate-blurb">{blurb}</p>

   {mode!=='reset'&&<label className="gate-field"><span>Email</span>
    <input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>}
   {mode!=='forgot'&&<label className="gate-field"><span>Password</span>
    <input type="password" required minLength={8} autoComplete={mode==='in'?'current-password':'new-password'}
     value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least eight characters"/></label>}

   {error&&<p className="gate-error" role="alert">{error}</p>}
   {sent&&<p className="gate-sent" role="status"><MailCheck size={15}/> {sent}</p>}

   <button className="primary" type="submit" disabled={busy}>
    {busy?<Loader2 size={17} className="spin"/>:null}{action} <ArrowRight size={17}/></button>

   <div className="gate-switch">
    {mode==='in'&&<><button type="button" onClick={()=>go('up')}>Create an account</button>
     <button type="button" onClick={()=>go('forgot')}>Forgot password</button></>}
    {mode==='up'&&<button type="button" onClick={()=>go('in')}>I already have an account</button>}
    {mode==='forgot'&&<button type="button" onClick={()=>go('in')}>Back to sign in</button>}
    {mode==='reset'&&<button type="button" onClick={()=>go('in')}>Back to sign in</button>}
   </div>
  </form>
  <p className="gate-foot">Your words sync to your account. Nothing is shared with anyone else.</p>
 </div>;
}
