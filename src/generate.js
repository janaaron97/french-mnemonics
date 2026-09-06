import {supabase} from './cloud.js';
import {tokenize,posOf} from './engine.js';

export const endpoint=import.meta.env?.VITE_GENERATE_URL||'/api/generate';

const genderLine=w=>w.article?.startsWith('la ')?'A silver ribbon flutters over it all — feminine.'
 :w.article?.startsWith('le ')?'A golden key hangs above the scene — masculine.'
 :'No gender prop: check a dictionary before you add one.';

export const castOf=w=>tokenize(w.ipa).map(c=>({name:c.name,ipa:c.ipa,place:c.type==='vowel'||c.type==='nasal'}));

async function call(kind,w){
 const {data}=await supabase.auth.getSession();
 const token=data?.session?.access_token;
 if(!token)throw new Error('Sign in again to generate.');
 const res=await fetch(endpoint,{
  method:'POST',
  headers:{'content-type':'application/json',authorization:`Bearer ${token}`},
  body:JSON.stringify({kind,gender:genderLine(w),cast:castOf(w),
   word:{word:w.word,article:w.article,ipa:w.ipa,meaning:w.meaning,pos:posOf(w),level:w.level,example:w.example}})
 });
 let body;
 try{body=await res.json()}catch{throw new Error(`The generator returned ${res.status}.`)}
 if(!res.ok)throw new Error(body?.error||`The generator returned ${res.status}.`);
 return body;
}

export const mnemonicFor=w=>call('mnemonic',w);
export const sentenceFor=w=>call('sentence',w);
