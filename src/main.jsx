import React,{useState,useEffect,useMemo,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {Volume2,ArrowRight,Search,Layers,Layers2,Library as LibraryIcon,Gamepad2,ChartNoAxesColumnIncreasing,Check,Plus,Download,Upload,X,Sparkles,LogOut,CloudOff,RefreshCw,Menu} from 'lucide-react';
import words from './words.json';
import {sounds,chunks,levels,levelBlurb,migrate,validate,posOf,empty,applyGrade,addDay,addStudy,mastery,spelledCount,standing,stage,streak,bestStreak,lastDays,studySeries,MASTERY} from './engine';
import {LevelChips,Cues,speak,speakLocal,useSoundUnlock,unlockSound,tone,soundReport,isLoud,setLoud,playFile,hasAudioSession,isApple,voiceMode,setVoiceMode} from './ui';
import Play from './play.jsx';
import Sort from './sort.jsx';
import Library from './library.jsx';
import Auth from './auth.jsx';
import Word from './word.jsx';
import {useInstall,InstallPanel,InstallNudge} from './install.jsx';
import {supabase,load,save,diff,isEmpty,hasContent} from './cloud.js';
import './style.css';

// Learn and Sound atlas are reachable from a word and from its sound cast,
// so they do not need to sit in the nav.
const tabs=[['Play',Gamepad2],['Sort',Layers2],['Library',LibraryIcon],
 ['Vocabulary',Layers],['Progress',ChartNoAxesColumnIncreasing]];
const read=()=>{try{return migrate(JSON.parse(localStorage.getItem('echo-progress')))}catch{return migrate(null)}};
const readLevels=()=>{try{const v=JSON.parse(localStorage.getItem('echo-levels'));return Array.isArray(v)&&v.length&&v.every(l=>levels.includes(l))?v:['A1']}catch{return ['A1']}};

function Root(){
 const [session,setSession]=useState(undefined),[recovery,setRecovery]=useState(false);
 useEffect(()=>{
  supabase.auth.getSession().then(({data})=>setSession(data.session||null));
  const {data}=supabase.auth.onAuthStateChange((event,next)=>{
   if(event==='PASSWORD_RECOVERY')setRecovery(true);
   if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='INITIAL_SESSION')setRecovery(r=>event==='SIGNED_OUT'?false:r);
   setSession(next||null);
  });
  return()=>data.subscription.unsubscribe();
 },[]);
 if(session===undefined)return <div className="booting"><span className="tiny-palace">é</span><p>Opening your palace…</p></div>;
 if(!session||recovery)return <Auth recovery={recovery}/>;
 return <App key={session.user.id} session={session}/>;
}

// Words studied per day. A day you were active on before the counter existed
// has no number, so the line breaks there instead of dropping to a false zero.
// The svg is stretched to the card width, which would squash anything but a
// path, so ticks and hit targets are HTML laid over it rather than svg text.
function StudyLine({series}){
 const W=600,H=150;
 const known=series.filter(d=>d.n!==null);
 const top=Math.max(4,Math.ceil(Math.max(...known.map(d=>d.n),0)/4)*4);
 const x=i=>i*W/Math.max(1,series.length-1);
 const y=n=>(1-n/top)*H;
 // one path per unbroken stretch, so a gap stays a gap
 const runs=[];
 for(const [i,d] of series.entries()){
  const last=runs[runs.length-1];
  if(d.n===null){if(last)runs.push(null);continue}
  if(Array.isArray(last))last.push([x(i),y(d.n)]);else runs.push([[x(i),y(d.n)]]);
 }
 const lines=runs.filter(Array.isArray);
 const total=known.reduce((a,d)=>a+d.n,0);
 const best=Math.max(0,...known.map(d=>d.n));
 const label=d=>`${d.day}: ${d.n===null?'not recorded':d.n+' word'+(d.n===1?'':'s')}`;
 return <div className="study-chart">
  <div className="chart-head">
   <div><strong>{total.toLocaleString()}</strong><span>words in {series.length} days</span></div>
   <div><strong>{best.toLocaleString()}</strong><span>best day</span></div>
  </div>
  <div className="chart-plot">
   <div className="chart-y">{[top,top/2,0].map(v=><span key={v}>{v}</span>)}</div>
   <div className="chart-area">
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
     {[0,.5,1].map(f=><line key={f} className="grid" x1="0" x2={W} y1={f*H} y2={f*H} vectorEffect="non-scaling-stroke"/>)}
     {lines.map((run,i)=><g key={i}>
      {run.length>1&&<path className="fill"
       d={`M${run[0][0]},${H} ${run.map(([px,py])=>`L${px},${py}`).join(' ')} L${run[run.length-1][0]},${H} Z`}/>}
      <path className="line" fill="none" vectorEffect="non-scaling-stroke"
       d={run.length>1?run.map(([px,py],k)=>`${k?'L':'M'}${px},${py}`).join(' ')
        :`M${run[0][0]-3},${run[0][1]} L${run[0][0]+3},${run[0][1]}`}/>
     </g>)}
    </svg>
    <div className="chart-hits" role="img"
     aria-label={`Words studied per day over the last ${series.length} days. ${series.filter(d=>d.n).map(label).join('. ')||'Nothing recorded yet.'}`}>
     {series.map(d=><i key={d.day} title={label(d)} className={d.n===null?'gap':''}
      style={{height:d.n?Math.max(3,d.n/top*100)+'%':'0'}}/>)}
    </div>
   </div>
  </div>
  <div className="chart-axis"><span>{series[0].day.slice(5)}</span><span>{series[series.length-1].day.slice(5)}</span></div>
 </div>;
}

function App({session}){
 const [state,setState]=useState(read),[page,setPage]=useState('Play'),[picked,setPicked]=useState(readLevels);
 const [query,setQuery]=useState(''),[selected,setSelected]=useState(null),[revealed,setRevealed]=useState(false);
 const [review,setReview]=useState(false),[notice,setNotice]=useState(''),[soundType,setSoundType]=useState('All');
 const [time,setTime]=useState(Date.now()),[launch,setLaunch]=useState(null),[drawer,setDrawer]=useState(false),[check,setCheck]=useState(null),[loud,setLoudOn]=useState(isLoud),[trial,setTrial]=useState({});

 useEffect(()=>{try{localStorage.setItem('echo-progress',JSON.stringify(state))}catch{setNotice('Browser storage is full or unavailable. Export your progress before leaving.')}},[state]);
 useEffect(()=>{try{localStorage.setItem('echo-levels',JSON.stringify(picked))}catch{}},[picked]);
 useEffect(()=>{const id=setInterval(()=>setTime(Date.now()),15000);return()=>clearInterval(id)},[]);
 useSoundUnlock();
 useEffect(()=>{
  const shut=e=>{if(e.type==='pointerdown'||e.key==='Escape')setMenu(false);if(e.key==='Escape')setDrawer(false)};
  window.addEventListener('pointerdown',shut);window.addEventListener('keydown',shut);
  return()=>{window.removeEventListener('pointerdown',shut);window.removeEventListener('keydown',shut)};
 },[]);

 const [sync,setSync]=useState('loading');
 const [attempt,setAttempt]=useState(0),[menu,setMenu]=useState(false);
 const synced=useRef({state:null,levels:null});
 const userId=session.user.id;
 const retry=()=>{setSync('loading');setNotice('');setAttempt(n=>n+1)};

 useEffect(()=>{
  let live=true;
  (async()=>{
   try{
    const cloud=await load(userId);
    if(!live)return;
    const local=read();
    const seed=cloud.fresh&&hasContent(local)&&!hasContent(cloud.state);
    const next=seed?local:cloud.state;
    const nextLevels=seed?readLevels():(cloud.levels||readLevels());
    setState(next);setPicked(nextLevels);
    synced.current=seed?{state:{...empty},levels:null}:{state:next,levels:nextLevels};
    setSync('ready');
    if(seed)setNotice('Your progress on this device was uploaded to your account.');
   }catch(err){if(live){setSync('error');setNotice('Could not reach your account: '+(err?.message||'unknown error')+'. Changes are held on this device.')}}
  })();
  return()=>{live=false};
 },[userId,attempt]);

 useEffect(()=>{
  if(sync==='loading'||!synced.current.state)return;
  const changes=diff(synced.current.state,state,synced.current.levels,picked);
  if(isEmpty(changes))return;
  const id=setTimeout(async()=>{
   setSync('saving');
   try{
    await save(userId,changes);
    synced.current={state,levels:picked};
    setSync('ready');
   }catch(err){setSync('error');setNotice('Could not save to your account: '+(err?.message||'unknown error'))}
  },900);
  return()=>clearTimeout(id);
 },[state,picked,sync,userId]);

 const due=useMemo(()=>words.filter(w=>!state.known[w.id]&&state.cards[w.id]?.due<=time),[state.cards,state.known,time]);
 const collected=Object.keys(state.lib).length;
 const pool=useMemo(()=>words.filter(w=>picked.includes(w.level)),[picked]);
 const next=pool.find(w=>!state.cards[w.id]&&!state.known[w.id]);
 const w=selected||next||pool[0];

 const say=text=>speak(text,setNotice);
 const openWord=(word,isReview=false)=>{setSelected(word);setReview(isReview);setRevealed(!isReview);setPage('Learn')};
 const toPlay=mode=>{setLaunch(mode);setPage('Play')};
 const collect=word=>setState(s=>({...s,lib:{...s.lib,[word.id]:Date.now()}}));
 const fileKnown=word=>{
  setState(s=>{const lib={...s.lib};delete lib[word.id];return {...s,known:{...s.known,[word.id]:Date.now()},lib}});
  setNotice(`“${word.word}” filed under known words.`);
 };

 // Nothing on this page asks you to write the French — you reveal it and say how
 // it went — so a rating here is logged against the word without moving mastery.
 // Mastery is only ever earned by producing the word in a round.
 const rate=grade=>{
  const now=Date.now();
  setState(s=>applyGrade({...s,days:addDay(s.days),daily:addStudy(s.daily,s.cards[w.id],now)},w.id,grade,now,false).next);
  setTime(now);
  const following=review?due.find(x=>x.id!==w.id):pool.find(x=>x.id!==w.id&&!state.cards[x.id]&&!state.known[x.id]);
  setSelected(following||null);setRevealed(!review);
  if(!following){setReview(false);setNotice(review?'You’re caught up. Come back when your next review is due.':'Every word in these levels has been introduced. Widen the level range.');setPage('Progress')}
 };

 const exportData=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state)],{type:'application/json'}));a.download='echo-progress.json';a.click();URL.revokeObjectURL(a.href)};
 const importData=async e=>{
  try{
   const restored=validate(JSON.parse(await e.target.files[0].text()),words);
   if(!restored)throw Error();
   setState(restored);setNotice('Progress restored.');
  }catch{setNotice('That backup could not be read. Choose a valid Écho progress file.')}
  e.target.value='';
 };

 const run=useMemo(()=>streak(state.days),[state.days]),bestRun=useMemo(()=>bestStreak(state.days),[state.days]);
 const rank=useMemo(()=>standing(state.points),[state.points]);
 const install=useInstall();
 const dayline=useMemo(()=>studySeries(state.days,state.daily,30),[state.days,state.daily]);
 const matches=list=>list.filter(x=>(x.word+' '+x.meaning).toLowerCase().includes(query.toLowerCase()));
 const introduced=pool.filter(x=>state.cards[x.id]||state.known[x.id]).length;
 const shared={words,state,setState,picked,setPicked,notice:setNotice,openWord};

 const go=name=>{setQuery('');setPage(name);setDrawer(false)};
 return <div className="shell">
  {drawer&&<div className="scrim" onClick={()=>setDrawer(false)}/>}
  <aside className={drawer?'open':''}>
  <a className="brand" href="#" onClick={e=>{e.preventDefault();go('Play')}}>écho</a>
  <nav>{tabs.map(([name,Icon])=><button key={name} className={page===name?'active':''} onClick={()=>go(name)}>
   <Icon size={18}/>{name}
   {name==='Library'&&!!collected&&<span className="nav-count">{collected>999?'999+':collected}</span>}
   {name==='Play'&&!!due.length&&<span className="nav-dot"/>}</button>)}</nav>
  <div className="sidebar-bottom">
   <div className={'local '+sync}>{sync==='error'?<><CloudOff size={12}/> Not syncing — changes held here</>
    :sync==='saving'?<><RefreshCw size={12} className="spin"/> Saving…</>
    :<><span/> Synced to your account</>}</div>
   <button className="signout" onClick={()=>supabase.auth.signOut()}><LogOut size={14}/> {session.user.email}</button></div>
 </aside>

 <main><header>
  <div className="header-left"><span>{page}</span></div>
  <div className="header-right">
   <button className="review-pill" onClick={()=>due.length?toPlay('review'):setNotice('No reviews due yet. Play a round to begin your review schedule.')}>
    <span className="status-dot"/>{due.length} reviews due <ArrowRight size={15}/></button>
   <div className="account-menu" onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
    <button className={'avatar '+sync} onClick={()=>setMenu(m=>!m)} aria-haspopup="menu" aria-expanded={menu}
     aria-label={'Account: '+session.user.email}>{(session.user.email||'?')[0].toUpperCase()}</button>
    {menu&&<div className="account-pop" role="menu">
     <span className="pop-email">{session.user.email}</span>
     <span className={'sync-pill '+sync}>{sync==='error'?<><CloudOff size={13}/> not syncing</>
      :sync==='saving'?<><RefreshCw size={13} className="spin"/> saving</>
      :sync==='loading'?<><RefreshCw size={13} className="spin"/> loading</>
      :<><Check size={13}/> synced</>}</span>
     {sync==='error'&&<button onClick={()=>{setMenu(false);retry()}}><RefreshCw size={15}/> Try again</button>}
     <button onClick={()=>supabase.auth.signOut()}><LogOut size={15}/> Sign out</button>
    </div>}
   </div>
   <button className="burger" onClick={()=>setDrawer(true)} aria-label="Menu"><Menu size={22}/></button>
  </div></header>
 {notice&&<div role="status" className="notice">{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={16}/></button></div>}

 {page==='Play'&&<><InstallNudge {...install}/><Play {...shared} launch={launch} onLaunched={()=>setLaunch(null)}/></>}
 {page==='Sort'&&<Sort {...shared}/>}
 {page==='Library'&&<Library {...shared} onPlay={toPlay}/>}

 {page==='Learn'&&<Word w={w} words={words} state={state} setState={setState} notice={setNotice}
  review={review} revealed={revealed} setRevealed={setRevealed} onRate={rate}
  onExplore={cue=>{setQuery(cue.ipa);setPage('Sound atlas')}}
  onClose={()=>{setSelected(null);setReview(false);setPage(selected?'Library':'Play')}}/>}

 {page==='Vocabulary'&&<><div className="page-title"><h1>Vocabulary</h1></div>
 <div className="filters"><label className="search"><Search size={18}/>
  <input placeholder="Search French or English…" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
 <div className="setup-row"><LevelChips picked={picked} onChange={setPicked} compact/></div>
 <p className="subtle">{matches(pool).length.toLocaleString()} of 5,500 · levels are source estimates.</p>
 <div className="word-list">{matches(pool).slice(0,150).map(x=><div key={x.id} className="lib-row">
  <button className="lib-open" onClick={()=>openWord(x)}><div><strong lang="fr">{x.article||x.word}</strong><span>/{x.ipa}/</span></div>
   <div className="lib-meaning">{x.meaning}</div></button>
  <span className={'tag '+(state.known[x.id]?'known':state.lib[x.id]?'due':'')}>{state.known[x.id]?'Known':state.lib[x.id]?'In library':x.level}</span>
  <div className="lib-actions">
   {!state.lib[x.id]&&!state.known[x.id]&&<button title="Add to library" aria-label={'Add '+x.word+' to library'} onClick={()=>collect(x)}><Plus size={15}/></button>}
   {!state.known[x.id]&&<button title="Mark known" aria-label={'Mark '+x.word+' known'} onClick={()=>fileKnown(x)}><Check size={15}/></button>}
   <button title="Open" aria-label={'Open '+x.word} onClick={()=>openWord(x)}><ArrowRight size={15}/></button></div>
 </div>)}</div>
 {matches(pool).length>150&&<p className="subtle">Showing the first 150. Narrow your search to see more.</p>}</>}

 {page==='Sound atlas'&&<><div className="page-title"><h1>Sound atlas</h1>
  <p>Characters act at vowel locations; glides move the scene. Nasal vowels have their own locations. Shortcuts compress recurring sequences, even when they are not morphemes. Golden key = masculine, silver ribbon = feminine.</p></div>
 <div className="filters"><label className="search"><Search size={18}/>
  <input placeholder="Search a sound, character, or spelling…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <select aria-label="Sound category" value={soundType} onChange={e=>setSoundType(e.target.value)}>{['All','actor','vowel','nasal','glide','chunk'].map(t=><option key={t}>{t}</option>)}</select></div>
 <div className="sound-grid">{[...sounds,...chunks].filter(s=>(soundType==='All'||s.type===soundType)&&Object.values(s).join(' ').toLowerCase().includes(query.toLowerCase())).map(s=>
  <article key={s.ipa}><div className="sound-heading"><span>{s.emoji}</span><strong>/{s.ipa}/</strong>
   <small>{s.type==='actor'?'character':s.type==='chunk'?'shortcut':s.type}</small></div>
   <h3>{s.name}</h3><p>{s.hint}</p>
   {s.example&&<button onClick={()=>say(s.example)}><Volume2 size={16}/>{s.example}<span>{s.spelling}</span></button>}</article>)}</div>
 <p className="subtle">Representative France French. /ɑ/–/a/ and /œ̃/–/ɛ̃/ may merge by speaker.</p></>}

 {page==='Progress'&&<><div className="page-title"><h1>Progress</h1></div>
 <div className="level-card">
  <div className="level-n"><small>LEVEL</small><strong>{rank.level}</strong></div>
  <div className="level-bar">
   <div className="progress-track"><i style={{width:rank.pct+'%'}}/></div>
   <small>{rank.into.toLocaleString()} / {rank.need.toLocaleString()} points · {rank.toNext.toLocaleString()} to level {rank.level+1}</small>
  </div>
  <p className="subtle">A clean answer earns 100–300 points depending on your run, a near miss half of
   that, and a miss costs 75. Points fall as well as rise, so a bad stretch takes the level back down.
   Level {rank.level+1} sits at {(rank.points+rank.toNext).toLocaleString()} points in total.</p>
 </div>
 <StudyLine series={dayline}/>
 <div className="streak-card">
  <div><strong>{run}</strong><span>day streak</span></div>
  <div><strong>{bestRun}</strong><span>longest</span></div>
  <div><strong>{state.days.length}</strong><span>days played</span></div>
  <div className="streak-grid" role="img" aria-label={`${state.days.length} days played in the last 13 weeks`}>
   {lastDays(state.days,91).map(d=><i key={d.day} className={d.on?'on':''} title={d.day}/>)}</div>
 </div>
 <div className="stats">
  <article><strong>{collected.toLocaleString()}</strong><span>words collected</span></article>
  <article><strong>{Object.keys(state.known).length.toLocaleString()}</strong><span>marked known</span></article>
  <article><strong>{due.length.toLocaleString()}</strong><span>ready for review</span></article>
  <article><strong>{state.rounds.toLocaleString()}</strong><span>rounds played</span></article></div>
 <div className="summary-actions">
  <button className="primary" disabled={!due.length} onClick={()=>toPlay('review')}>Play due words <ArrowRight size={18}/></button>
  <button className="ghost-btn" onClick={()=>setState(s=>({...s,sound:!s.sound}))}>Game sound: {state.sound?'on':'off'}</button></div>
 <div className="level-progress">{levels.map(l=>{
  const total=words.filter(x=>x.level===l).length;
  const count=words.filter(x=>x.level===l&&(state.lib[x.id]||state.known[x.id])).length;
  return <article key={l}><strong>{l}</strong><em>{levelBlurb[l]}</em><div className="progress-track"><i style={{width:count/total*100+'%'}}/></div>
   <span>{count.toLocaleString()} / {total.toLocaleString()}</span></article>})}</div>
 <InstallPanel {...install}/>
 <section className="account"><h3>Sound check</h3>
  <p>Three different pipelines carry sound, and iOS can mute them independently.
   Try each: whichever one stays silent is the one at fault.</p>
  <ol className="sound-tests">
   <li><button className="ghost-btn" onClick={()=>{unlockSound();tone([[660,0,.12],[880,.1,.16]],true);
    setTrial(t=>({...t,web:'triggered'}));setTimeout(()=>setCheck(soundReport()),400)}}>1 · Web Audio beep</button>
    <span>{trial.web||'not tried'}</span></li>
   <li><button className="ghost-btn" onClick={async()=>{unlockSound();setTrial(t=>({...t,file:'playing…'}));
    const r=await playFile();setTrial(t=>({...t,file:r}));setCheck(soundReport())}}>2 · Audio file tone</button>
    <span>{trial.file||'not tried'}</span></li>
   <li><button className="ghost-btn" onClick={()=>{unlockSound();speakLocal('Bonjour, ceci est un test.',setNotice);
    setTrial(t=>({...t,speech:'queued'}));setTimeout(()=>setCheck(soundReport()),1200)}}>3 · Browser speech</button>
    <span>{trial.speech||'not tried'}</span></li>
   <li><button className="ghost-btn" onClick={()=>{unlockSound();speak('Bonjour, ceci est un test.',setNotice);
    setTrial(t=>({...t,voice:'fetching…'}));setTimeout(()=>{setCheck(soundReport());setTrial(t=>({...t,voice:'see “last” rows below'}))},2500)}}>4 · Spoken audio</button>
    <span>{trial.voice||'not tried'}</span></li>
  </ol>
  <div className="account-row">
   <button className="ghost-btn" onClick={()=>setCheck(soundReport())}><RefreshCw size={15}/> Refresh</button>
   <button className="ghost-btn" disabled={!check} onClick={()=>{
    navigator.clipboard?.writeText(Object.entries(check||{}).map(([k,v])=>k+': '+v).join('\n'))
     .then(()=>setNotice('Sound report copied.')).catch(()=>{})}}>Copy report</button>
   <button className="ghost-btn" onClick={()=>{const next=voiceMode()==='ai'?'browser':'ai';setVoiceMode(next);setCheck(soundReport())}}>
    Voice: {voiceMode()==='ai'?'spoken audio':'browser'}</button>
   {!hasAudioSession()&&<button className={'ghost-btn'+(loud?' on':'')} onClick={()=>{const next=!loud;setLoud(next);setLoudOn(next);setCheck(soundReport())}}>
    Silent-switch hum: {loud?'on':'off'}</button>}
  </div>
  {check&&<dl className="report">{Object.entries(check).map(([k,v])=>
   <React.Fragment key={k}><dt>{k}</dt><dd>{String(v)}</dd></React.Fragment>)}</dl>}
  <p><b>last started: no</b> with <b>last error: none</b> means the utterance was accepted and never
   began — that is the phone muting it, not the app. An error of <i>not-allowed</i> means Safari refused
   it for want of a gesture, and <i>interrupted</i> or <i>canceled</i> means something cut it off.</p>
  <p>Test 3 is Safari's own speech, which runs on an audio session this page cannot set: with the ringer
   switch off it starts, reports nothing wrong, and is silent anyway. Test 4 plays generated French through
   a media element, which does obey the page's playback session — that is the one that should be audible
   with the ringer off. Each word is fetched once and then kept on the device, so it costs nothing to
   repeat and works offline afterwards.</p>
  {isApple()&&<p>{hasAudioSession()
   ?'This Safari supports audioSession, so the page asks for a playback session directly and no silent-switch hum is used.'
   :'This Safari is too old for audioSession, so a near-silent looping track is used instead to escape the ringer switch. It holds the output open, which can itself block speech — if test 3 stays silent while 1 and 2 work, turn the hum off and try again.'}</p>}
 </section>
 <section className="account"><h3>Your account.</h3>
  <div className="account-row"><strong>{session.user.email}</strong>
   <span className={'sync-pill '+sync}>{sync==='error'?<><CloudOff size={13}/> not syncing</>
    :sync==='saving'?<><RefreshCw size={13} className="spin"/> saving</>
    :sync==='loading'?<><RefreshCw size={13} className="spin"/> loading</>
    :<><Check size={13}/> synced</>}</span>
   {sync==='error'&&<button className="ghost-btn" onClick={retry}><RefreshCw size={15}/> Try again</button>}
   <button className="ghost-btn" onClick={()=>supabase.auth.signOut()}><LogOut size={15}/> Sign out</button></div>
 </section>
 <section className="backup"><h3>Backup</h3>
  <p>Everything syncs to your account. An export is still worth keeping offline; importing replaces your progress and syncs the result up.</p>
  <button onClick={exportData}><Download size={17}/> Export progress</button>
  <label className="import"><Upload size={17}/> Restore backup<input type="file" accept="application/json" onChange={importData}/></label></section>
 <details className="sources"><summary>About the vocabulary & sources</summary>
  <p>5,500 unique entries matched to IPA pronunciations. Translations, sentences, and CEFR estimates come from the AI-assisted <a href="https://github.com/vbvss199/Language-Learning-decks">Language-Learning-decks</a> dataset (MIT). Levels are estimates, not an official CEFR syllabus; vocabulary alone does not establish C1 proficiency. Content can contain errors. Pronunciations come from <a href="https://github.com/open-dict-data/ipa-dict">ipa-dict</a> (MIT); only the first listed pronunciation is used. Mnemonic scenes are generated templates, editable by you. Sentence words are matched back to entries with a rule-based inflection table, so an occasional word is missed or attached to a look-alike lemma.</p>
  <p><a href="/licenses/LICENSE">Vocabulary license</a> · <a href="/licenses/IPA-LICENSE">IPA license</a> · <a href="/licenses/attributions.md">Frequency data attribution (CC BY-SA)</a></p></details></>}

 <footer><button onClick={()=>setPage('Progress')}>Sources & backup</button></footer></main></div>;
}
createRoot(document.getElementById('root')).render(<Root/>);
// Registered only for a built app: in dev this would cache module requests and
// fight hot reload. The worker keeps navigation network-first, so a deploy still
// lands as soon as the device is online.
if(import.meta.env.PROD&&'serviceWorker' in navigator)
 window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js')
  .then(reg=>{window.__echoSW='registered '+reg.scope})
  .catch(err=>{window.__echoSW='FAILED: '+(err&&err.message)}));
else if(!('serviceWorker' in navigator))window.__echoSW='unsupported by this browser';
else window.__echoSW='not registered (dev build)';
