import fs from 'node:fs';
const ipa = new Map(fs.readFileSync('data/ipa.txt','utf8').split('\n').map(l=>l.split('\t')));
const seen=new Set();
const words=JSON.parse(fs.readFileSync('data/french.json','utf8')).filter(w=>w.useful_for_flashcard && ['A1','A2','B1','B2','C1'].includes(w.cefr_level)&&ipa.has(w.word)&&!seen.has(w.word)&&seen.add(w.word)).sort((a,b)=>a.word_frequency-b.word_frequency).slice(0,5500).map((w,i)=>({id:i+1,word:w.word,article:['le','la','les','un','une','des'].includes(w.article_with_word)?w.article_with_word+' '+w.word:["l’","l'"].includes(w.article_with_word)?w.article_with_word+w.word:w.article_with_word,meaning:w.english_translation.replaceAll(';',' · '),level:w.cefr_level,pos:w.pos,example:w.example_sentence_native,translation:w.example_sentence_english,ipa:ipa.get(w.word).trim().split(',')[0].replaceAll('/','')}));
if(words.length!==5500)throw Error(`Only ${words.length} matched entries`);
fs.writeFileSync('src/words.json',JSON.stringify(words));
fs.mkdirSync('public/licenses',{recursive:true});
for(const f of ['LICENSE','IPA-LICENSE','attributions.md'])fs.copyFileSync('data/'+f,'public/licenses/'+f);
console.log(words.length, Object.fromEntries(['A1','A2','B1','B2','C1'].map(l=>[l,words.filter(w=>w.level===l).length])));
