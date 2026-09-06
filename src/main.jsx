import React,{useState,useEffect,useMemo,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {BookOpen,Volume2,ArrowRight,Search,Layers,Layers2,Library as LibraryIcon,Gamepad2,ChartNoAxesColumnIncreasing,Compass,Check,Plus,Download,Upload,X,Sparkles,LogOut,CloudOff,RefreshCw} from 'lucide-react';
import words from './words.json';
import {sounds,chunks,levels,levelBlurb,migrate,validate,posOf,empty,applyGrade,mastery,stage,streak,bestStreak,lastDays,MASTERY} from './engine';
import {LevelChips,Cues,speak} from './ui';
import Play from './play.jsx';
import Sort from './sort.jsx';
import Library from './library.jsx';
import Auth from './auth.jsx';
import Word from './word.jsx';
import {supabase,load,save,diff,isEmpty,hasContent} from './cloud.js';
import './style.css';

const groups=[
 ['PRACTICE',[['Play',Gamepad2],['Sort',Layers2],['Learn',BookOpen]]],
 ['YOUR WORDS',[['Library',LibraryIcon],['Vocabulary',Layers]]],
 ['REFERENCE',[['Sound atlas',Compass],['Progress',ChartNoAxesColumnIncreasing]]]
];
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

function App({session}){
 const [state,setState]=useState(read),[page,setPage]=useState('Play'),[picked,setPicked]=useState(readLevels);
 const [query,setQuery]=useState(''),[selected,setSelected]=useState(null),[revealed,setRevealed]=useState(false);
 const [review,setReview]=useState(false),[notice,setNotice]=useState(''),[soundType,setSoundType]=useState('All');
 const [time,setTime]=useState(Date.now()),[launch,setLaunch]=useState(null);

 useEffect(()=>{try{localStorage.setItem('echo-progress',JSON.stringify(state))}catch{setNotice('Browser storage is full or unavailable. Export your progress before leaving.')}},[state]);
 useEffect(()=>{try{localStorage.setItem('echo-levels',JSON.stringify(picked))}catch{}},[picked]);
 useEffect(()=>{const id=setInterval(()=>setTime(Date.now()),15000);return()=>clearInterval(id)},[]);
 useEffect(()=>{
  const shut=e=>{if(e.type==='pointerdown'||e.key==='Escape')setMenu(false)};
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

 const rate=grade=>{
  const climbed=grade!=='again'&&grade!=='hard'&&!state.known[w.id]&&(state.cards[w.id]?.clean||0)+1>=MASTERY;
  setState(s=>applyGrade(s,w.id,grade).next);
  setTime(Date.now());
  if(climbed)setNotice(`“${w.word}” reached ${MASTERY} clean answers and moved to your known words.`);
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
 const matches=list=>list.filter(x=>(x.word+' '+x.meaning).toLowerCase().includes(query.toLowerCase()));
 const introduced=pool.filter(x=>state.cards[x.id]||state.known[x.id]).length;
 const shared={words,state,setState,picked,setPicked,notice:setNotice,openWord};

 return <div className="shell"><aside>
  <a className="brand" href="#" onClick={e=>{e.preventDefault();setPage('Play')}}>écho</a>
  <nav>{groups.map(([label,items])=><React.Fragment key={label}>
   <div className="nav-label">{label}</div>
   {items.map(([name,Icon])=><button key={name} className={page===name?'active':''} onClick={()=>{setQuery('');setPage(name)}}>
    <Icon size={18}/>{name}
    {name==='Library'&&!!collected&&<span className="nav-count">{collected>999?'999+':collected}</span>}
    {name==='Play'&&!!due.length&&<span className="nav-dot"/>}</button>)}
  </React.Fragment>)}</nav>
  <div className="sidebar-bottom">
   <div className={'local '+sync}>{sync==='error'?<><CloudOff size={12}/> Not syncing — changes held here</>
    :sync==='saving'?<><RefreshCw size={12} className="spin"/> Saving…</>
    :<><span/> Synced to your account</>}</div>
   <button className="signout" onClick={()=>supabase.auth.signOut()}><LogOut size={14}/> {session.user.email}</button></div>
 </aside>

 <main><header><div>{page}</div>
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
  </div></header>
 {notice&&<div role="status" className="notice">{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={16}/></button></div>}

 {page==='Play'&&<Play {...shared} launch={launch} onLaunched={()=>setLaunch(null)}/>}
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
  <article><strong>{state.xp.toLocaleString()}</strong><span>XP over {state.rounds} rounds</span></article></div>
 <div className="summary-actions">
  <button className="primary" disabled={!due.length} onClick={()=>toPlay('review')}>Play due words <ArrowRight size={18}/></button>
  <button className="ghost-btn" onClick={()=>setState(s=>({...s,sound:!s.sound}))}>Game sound: {state.sound?'on':'off'}</button></div>
 <div className="level-progress">{levels.map(l=>{
  const total=words.filter(x=>x.level===l).length;
  const count=words.filter(x=>x.level===l&&(state.lib[x.id]||state.known[x.id])).length;
  return <article key={l}><strong>{l}</strong><em>{levelBlurb[l]}</em><div className="progress-track"><i style={{width:count/total*100+'%'}}/></div>
   <span>{count.toLocaleString()} / {total.toLocaleString()}</span></article>})}</div>
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
