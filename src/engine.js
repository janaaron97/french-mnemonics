export const sounds=[
 ['ɑ̃','Atrium','🏛','nasal','an, en','enfant','Open ah, with air through the nose.'],['ɛ̃','Garden','🌿','nasal','in, ain, ein','pain','Open eh, with nasal airflow.'],['ɔ̃','Observatory','🔭','nasal','on','nom','Rounded lips and nasal airflow.'],['œ̃','Perfume shop','🧴','nasal','un','parfum','Rounded nasal vowel; often merges with /ɛ̃/.'],
 ['a','Beach','🏖','vowel','a, à','chat','Open mouth, as in ah.'],['ɑ','Theatre','🎭','vowel','â','pâte','Back ah; often merges with /a/.'],['i','Ice rink','⛸','vowel','i, y','lit','Tongue high and forward, lips unrounded.'],['y','Moon','🌙','vowel','u','lune','Say ee while rounding your lips.'],['u','Pool','🏊','vowel','ou','roue','Rounded oo, tongue toward the back.'],['e','Café','☕','vowel','é, -er, -ez','été','Pure closed eh; no English ay glide.'],['ɛ','Library','📚','vowel','è, ê, ai','lait','Open eh, as in bed.'],['o','Castle','🏰','vowel','eau, au, ô','eau','Rounded closed o; avoid a glide.'],['ɔ','Port','⚓','vowel','o','porte','More open rounded o.'],['ø','Fire station','🚒','vowel','eu','feu','Say closed eh with rounded lips.'],['œ','Flower shop','🌷','vowel','eu, œu','peur','Say open eh with rounded lips.'],['ə','Waiting room','🪑','vowel','e','le','Relaxed central vowel; may be dropped in speech.'],
 ['p','Pirate','🏴‍☠️','actor','p','pain','Unvoiced p, without a strong puff.'],['b','Bear','🐻','actor','b','beau','Voiced b.'],['t','Tiger','🐯','actor','t','tout','Tongue touches near the upper teeth.'],['d','Detective','🕵️','actor','d','deux','Voiced d near the upper teeth.'],['k','Cat','🐈','actor','c, qu, k','qui','Unvoiced k.'],['ɡ','Gorilla','🦍','actor','g, gu','gare','Hard voiced g.'],['g','Gorilla','🦍','actor','g, gu','gare','Hard voiced g; alternate IPA glyph.'],['f','Fairy','🧚','actor','f, ph','fou','Air between upper teeth and lower lip.'],['v','Vampire','🧛','actor','v','vous','Voiced f.'],['s','Snake','🐍','actor','s, ss, c, ç','sac','Unvoiced hiss.'],['z','Zebra','🦓','actor','z, s','zéro','Voiced s.'],['ʃ','Chef','👨‍🍳','actor','ch','chat','As in sh.'],['ʒ','Magician','🪄','actor','j, g','jour','As in the middle of vision.'],['m','Mime','🎭','actor','m','mot','Lips together, voiced through the nose.'],['n','Ninja','🥷','actor','n','nous','Tongue up, voiced through the nose.'],['ɲ','Onion knight','🧅','actor','gn','agneau','Palatal nasal, similar to Spanish ñ.'],['ŋ','Boxer','🥊','actor','ng','parking','Nasal at the back, as in sing.'],['l','Lion','🦁','actor','l','lit','Clear l with tongue near upper teeth.'],['ʁ','Robot','🤖','actor','r','rue','French r at the back of the mouth.'],['j','Yo-yo','🪀','glide','y, ill, i','yeux','Quick y glide, as in yes.'],['w','Wagon','🛒','glide','oi, ou','oui','Quick rounded w glide.'],['ɥ','Whistle','🪈','glide','u + vowel','huit','Glide from French /y/ into the next vowel.']
].map(([ipa,name,emoji,type,spelling,example,hint])=>({ipa,name,emoji,type,spelling,example,hint}));
export const chunks=[{ipa:'sjɔ̃',name:'Transformation machine',emoji:'⚙️',type:'chunk',hint:'A sound shortcut common in -tion words. It is not always a morpheme.'},{ipa:'mɑ̃',name:'Magic cloak',emoji:'🧥',type:'chunk',hint:'Common in -ment; often creates an adverb, but not always.'},{ipa:'aʒ',name:'Workshop',emoji:'🛠️',type:'chunk',hint:'Common in -age, often an action or result.'},{ipa:'ite',name:'Quality inspector',emoji:'🔎',type:'chunk',hint:'Common in -ité, often an abstract quality.'}];
export function tokenize(ipa,compact=true){const keys=[...(compact?chunks:[]),...sounds].sort((a,b)=>b.ipa.length-a.ipa.length);let rest=ipa.normalize('NFC').replace(/[ʼˈˌ.\s/()‿]/g,'');let out=[];while(rest){const key=keys.find(s=>rest.startsWith(s.ipa));if(key){out.push(key);rest=rest.slice(key.ipa.length)}else{out.push({ipa:[...rest][0],name:'Unmapped sound',emoji:'◌',type:'unknown'});rest=rest.slice([...rest][0].length)}}return out}
// Each character gets things it can DO to whatever comes next in the sound
// order, so the cast acts instead of being listed; each vowel is somewhere the
// action can happen. Two verbs apiece gives the generator room to vary.
const acting={
 p:['runs a cutlass through','kicks a barrel at'],      b:['bear-hugs','swats'],
 t:['pounces on','drags off'],                          d:['handcuffs','shines a torch on'],
 k:['yowls at','claws at'],                             'ɡ':['thumps its chest at','hurls'],
 g:['thumps its chest at','hurls'],                     f:['sprinkles glitter over','shrinks'],
 v:['sinks its fangs into','hypnotises'],               s:['coils around','hisses at'],
 z:['kicks','stampedes past'],                          'ʃ':['flambés','plates up'],
 'ʒ':['saws clean through','makes a dove out of'],            m:['boxes in','mirrors'],
 n:['vanishes behind','throws a smoke bomb at'],        'ɲ':['brings tears to','peels'],
 'ŋ':['jabs at','pins to the ropes'],                   l:['roars at','pads after'],
 'ʁ':['clamps onto','scans'],                           j:['whips around','loops the string round'],
 w:['runs over','carts away'],                          'ɥ':['shrieks at','pierces the ear of'],
 'sjɔ̃':['swallows whole','transforms'],
 'mɑ̃':['throws a cloak over','spirits away'],
 'aʒ':['hammers','clamps to the workbench'],
 'ite':['stamps a seal on','measures up']
};
const setting={
 'ɑ̃':'in the echoing atrium', 'ɛ̃':'in the walled garden', 'ɔ̃':'up in the observatory',
 'œ̃':'in the perfume shop', a:'out on the beach', 'ɑ':'on the theatre stage',
 i:'on the ice rink', y:'on the surface of the moon', u:'at the edge of the pool',
 e:'in the café', 'ɛ':'deep in the library', o:'in the castle keep', 'ɔ':'down at the port',
 'ø':'in the fire station', 'œ':'in the flower shop', 'ə':'in the waiting room'
};
const place=c=>c.type==='vowel'||c.type==='nasal';
const named=c=>c.name.toLowerCase();
const article=n=>(/^[aeiou]/.test(n)?'an ':'a ')+n;
const verb=(c,pick)=>(acting[c.ipa]||['collides with','shoves'])[pick%2];
const where=c=>setting[c.ipa]||`at the ${named(c)}`;

const payoffs={
 noun:[m=>`When it all stops, the one thing still in one piece is ${m}.`,
       m=>`And the thing at the centre of the mess, untouched, is ${m}.`],
 verb:[m=>`Everything they are doing adds up to one act: ${m}.`,
       m=>`Watch the whole thing again and what you are watching is ${m}.`],
 adjective:[m=>`Every single thing in the frame comes out ${m}.`,
            m=>`Whatever they touch turns ${m}.`],
 adverb:[m=>`And all of it happens ${m}.`,
         m=>`The whole scene runs ${m}.`],
 numeral:[m=>`Count what is left on the floor: ${m}.`,
          m=>`However you count the wreckage, it comes to ${m}.`],
 other:[m=>`Whatever just happened, it means ${m}.`,
        m=>`Freeze the frame: that is ${m}.`]
};
const gender=w=>w.article?.startsWith('la ')?'A silver ribbon flutters over it all — feminine.'
 :w.article?.startsWith('le ')?'A golden key hangs above the scene — masculine.'
 :'No gender prop: check a dictionary before you add one.';

// Narrate the cast in sound order: each character acts on whoever comes next,
// each vowel is where that lands, and the payoff sentence is the meaning. The
// arrow chain above the prose stays authoritative for strict order, since
// English grammar cannot always put a location between two linked clauses.
const inanimate=new Set(['w','j','ɥ','sjɔ̃','mɑ̃','aʒ']);
const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
function staged(cues,pick){
 const actors=cues.filter(c=>!place(c));
 if(!actors.length)return `Hold one image and nothing else: ${where(cues[0])}`;
 const spot=new Map();
 let lead='',at=-1;
 for(const c of cues){
  if(place(c)){if(at<0)lead=where(c);else if(!spot.has(at+1))spot.set(at+1,where(c))}
  else at++;
 }
 const clauses=actors.map((c,k)=>{
  const next=actors[k+1];
  const object=next?article(named(next)):(actors.length===1?'the empty air':['whatever is left of it','what little is still standing'][pick%2]);
  const here=spot.get(k+1)?' '+spot.get(k+1):'';
  const subject=k===0?article(named(c)):(inanimate.has(c.ipa)?'which':'who');
  return `${subject} ${verb(c,pick)} ${object}${here}`;
 });
 return cap(lead?`${lead}, ${clauses.join(', ')}`:clauses.join(', '));
}
export const SCENES=8;
export function scene(w,variant=0){
 const v=((variant%SCENES)+SCENES)%SCENES;
 const cues=tokenize(w.ipa);
 const chain=cues.map(named).join(' → ');
 const kind=payoffs[posOf(w)]?posOf(w):'other';
 const body=staged(cues,Math.floor(v/4)%2);
 const end=payoffs[kind][Math.floor(v/2)%2](`“${w.meaning}”`);
 const shape=v%2?`${body}. ${end} (${chain})`:`${chain}. ${body}. ${end}`;
 return `${shape} ${gender(w)}`.replace(/\s+/g,' ').replace(/ \./g,'.');
}
// Other corpus entries whose own example sentence uses this word: real French,
// not generated, so it is only available where the corpus happens to supply it.
const mentions=new WeakMap();
export function alternates(w,list){
 let map=mentions.get(list);
 if(!map){
  map=new Map();
  for(const other of list)for(const id of sentenceIds(other.example,list)){
   if(id===other.id)continue;
   if(!map.has(id))map.set(id,[]);
   map.get(id).push(other.id);
  }
  mentions.set(list,map);
 }
 return (map.get(w.id)||[]).map(id=>list[id-1]);
}
export const MASTERY=10;
const tally={again:'missed',hard:'close',good:'clean',easy:'clean'};
export function schedule(previous,grade,now=Date.now()){
 const old=previous?.interval||0;
 const interval=grade==='again'?0:grade==='hard'?Math.max(1,Math.round(old*1.2)):grade==='good'?Math.max(1,Math.round(old*2.5)):Math.max(4,Math.round(old*3.5));
 const hit=tally[grade];
 return {interval,due:now+(grade==='again'?60000:interval*86400000),reviews:(previous?.reviews||0)+1,last:now,
  clean:(previous?.clean||0)+(hit==='clean'?1:0),
  close:(previous?.close||0)+(hit==='close'?1:0),
  missed:(previous?.missed||0)+(hit==='missed'?1:0)};
}
export const mastery=card=>Math.min(MASTERY,card?.clean||0);
export const seen=card=>card?.reviews||0;
export function stage(card,known){
 if(known)return {key:'known',label:'Known'};
 if(!card||!card.reviews)return {key:'new',label:'New'};
 if(!card.interval)return {key:'learning',label:'Learning'};
 if(card.interval<7)return {key:'familiar',label:'Familiar'};
 if(card.interval<21)return {key:'strong',label:'Strong'};
 return {key:'locked',label:'Locked in'};
}
// One place decides what a graded answer does: it schedules the card, keeps the
// word in the library, and retires it once it has been spelled cleanly MASTERY times.
export function applyGrade(state,id,grade,now=Date.now()){
 const card=schedule(state.cards[id],grade,now);
 const cards={...state.cards,[id]:card};
 if(card.clean>=MASTERY&&!state.known[id]){
  const lib={...state.lib};delete lib[id];
  return {next:{...state,cards,lib,known:{...state.known,[id]:now}},mastered:true};
 }
 const lib=state.known[id]?state.lib:{...state.lib,[id]:state.lib[id]||now};
 return {next:{...state,cards,lib},mastered:false};
}
export const levels=['A1','A2','B1','B2','C1'];
export const levelBlurb={A1:'First steps',A2:'Everyday life',B1:'New horizons',B2:'Going deeper',C1:'Nuance'};
const posAlias={nom:'noun',adj:'adjective',adv:'adverb',num:'numeral'};
export const posOf=w=>posAlias[w.pos]||w.pos||'other';
const irregular={
 'être':'suis es est sommes êtes sont étais était étions étiez étaient été fus fut furent serai seras sera serons serez seront serais serait soit sois soyons soyez soient étant',
 'avoir':'ai as a avons avez ont avais avait avions aviez avaient eu eue eus eut eurent aurai auras aura aurons aurez auront aurais aurait aie aies ait ayons ayez aient ayant',
 'aller':'vais vas va allons allez vont allais allait allions alliez allaient allé allée allés allées irai iras ira irons irez iront irais irait aille ailles aillent allant',
 'faire':'fais fait faisons faites font faisais faisait faisions faisaient faite faits faites ferai feras fera ferons ferez feront ferais ferait fasse fasses fassent faisant',
 'pouvoir':'peux peut pouvons pouvez peuvent pouvais pouvait pouvions pouviez pouvaient pu pourrai pourras pourra pourrons pourrez pourront pourrais pourrait puisse puissent pouvant',
 'vouloir':'veux veut voulons voulez veulent voulais voulait voulions vouliez voulaient voulu voulue voudrai voudras voudra voudrons voudront voudrais voudrait veuille veuillez voulant',
 'devoir':'dois doit devons devez doivent devais devait devions deviez devaient dû due dus dues devrai devras devra devrons devront devrais devrait doive doivent devant',
 'savoir':'sais sait savons savez savent savais savait savions saviez savaient su sue saurai sauras saura saurons sauront saurais saurait sache sachons sachez sachent sachant',
 'venir':'viens vient venons venez viennent venais venait venions veniez venaient venu venue venus venues vins vint viendrai viendras viendra viendrons viendront viendrais viendrait vienne viennent venant',
 'tenir':'tiens tient tenons tenez tiennent tenais tenait tenaient tenu tenue tiendrai tiendra tiendrais tienne tenant',
 'prendre':'prends prend prenons prenez prennent prenais prenait prenions preniez prenaient pris prise prises prendrai prendras prendra prendrons prendront prendrais prendrait prenne prennent prenant',
 'voir':'vois voit voyons voyez voient voyais voyait voyions voyiez voyaient vu vue vus vues verrai verras verra verrons verront verrais verrait voie voient voyant',
 'dire':'dis dit disons dites disent disais disait disions disiez disaient dite dits dites dirai diras dira dirons diront dirais dirait dise disent disant',
 'mettre':'mets met mettons mettez mettent mettais mettait mettaient mis mise mises mettrai mettra mettrons mettront mettrais mettrait mette mettent mettant',
 'falloir':'faut fallait faudra faudrait fallu',
 'valoir':'vaut valent valait valaient valu vaudra vaudrait vaille valant',
 'connaître':'connais connaît connaissons connaissez connaissent connaissais connaissait connaissaient connu connue connus connues connaîtrai connaîtrait connaisse connaissant',
 'paraître':'parais paraît paraissons paraissez paraissent paraissait paraissaient paru paraîtra paraîtrait paraissant',
 'partir':'pars part partons partez partent partais partait partaient parti partie partis parties partirai partira partirait parte partant',
 'sortir':'sors sort sortons sortez sortent sortais sortait sortaient sorti sortie sortis sorties sortirai sortira sortirait sorte sortant',
 'dormir':'dors dort dormons dormez dorment dormais dormait dormi dormirai dormirait dorme dormant',
 'servir':'sers sert servons servez servent servais servait servi servie servirai servirait serve servant',
 'sentir':'sens sent sentons sentez sentent sentais sentait senti sentie sentirai sentirait sente sentant',
 'écrire':'écris écrit écrivons écrivez écrivent écrivais écrivait écrivaient écrite écrits écrites écrirai écrira écrirait écrive écrivant',
 'lire':'lis lit lisons lisez lisent lisais lisait lisaient lu lue lus lues lirai lira lirait lise lisant',
 'boire':'bois boit buvons buvez boivent buvais buvait bu bue bus bues boirai boirait boive buvant',
 'croire':'crois croit croyons croyez croient croyais croyait cru crue crus crues croirai croirait croie croyant',
 'recevoir':'reçois reçoit recevons recevez reçoivent recevais recevait reçu reçue reçus reçues recevrai recevrait reçoive recevant',
 'vivre':'vis vit vivons vivez vivent vivais vivait vécu vécue vécus vivrai vivrait vive vivant',
 'suivre':'suit suivons suivez suivent suivais suivait suivi suivie suivis suivies suivrai suivrait suive suivant',
 'ouvrir':'ouvre ouvres ouvrons ouvrez ouvrent ouvrais ouvrait ouvert ouverte ouverts ouvertes ouvrirai ouvrirait ouvrant',
 'offrir':'offre offres offrons offrez offrent offrais offrait offert offerte offerts offertes offrirai offrant',
 'courir':'cours court courons courez courent courais courait couru courue courrai courrait coure courant',
 'mourir':'meurs meurt mourons mourez meurent mourais mourait mort morte morts mortes mourra mourrait meure mourant',
 'naître':'nais naît naissons naissez naissent naissait né née nés nées naîtra naissant',
 'rire':'ris rit rions riez rient riais riait ri rirai rirait rie riant',
 'plaire':'plais plaît plaisons plaisez plaisent plaisait plu plaira plairait plaise plaisant',
 'craindre':'crains craint craignons craignez craignent craignait craint crainte craindra craindrait craigne craignant',
 'joindre':'joins joint joignons joignez joignent joignait jointe joindra joindrait joigne joignant',
 'peindre':'peins peint peignons peignez peignent peignait peinte peindra peindrait peigne peignant',
 'conduire':'conduis conduit conduisons conduisez conduisent conduisait conduite conduira conduirait conduise conduisant',
 'produire':'produis produit produisons produisez produisent produisait produite produira produirait produise produisant',
 'construire':'construis construit construisons construisez construisent construisait construite construira construirait construise construisant',
 'battre':'bats bat battons battez battent battait battu battue battra battrait batte battant',
 'perdre':'perds perd perdons perdez perdent perdais perdait perdu perdue perdus perdues perdra perdrait perde perdant',
 'attendre':'attends attend attendons attendez attendent attendais attendait attendu attendue attendra attendrait attende attendant',
 'répondre':'réponds répond répondons répondez répondent répondais répondait répondu répondue répondra répondrait réponde répondant',
 'vendre':'vends vend vendons vendez vendent vendais vendait vendu vendue vendra vendrait vende vendant',
 'rendre':'rends rend rendons rendez rendent rendais rendait rendu rendue rendra rendrait rende rendant',
 'entendre':'entends entend entendons entendez entendent entendais entendait entendu entendue entendra entendrait entende entendant',
 'descendre':'descends descend descendons descendez descendent descendait descendu descendue descendra descendant',
 'appeler':'appelle appelles appellent appellerai appellera appellerait appelant appelé appelée appelés appelées',
 'jeter':'jette jettes jettent jetterai jettera jetterait jetant jeté jetée',
 'acheter':'achète achètes achètent achèterai achètera achèterait achetant acheté achetée',
 'lever':'lève lèves lèvent lèverai lèvera lèverait levant levé levée',
 'préférer':'préfère préfères préfèrent préférerai préférerait préférant préféré préférée',
 'espérer':'espère espères espèrent espérerai espérerait espérant espéré espérée',
 'envoyer':'envoie envoies envoient enverrai enverra enverrait envoyant envoyé envoyée envoyés',
 'payer':'paie paies paient paye payes payent paierai paiera paierait payant payé payée',
 'essayer':'essaie essaies essaient essaye essayerai essaiera essaierait essayant essayé essayée',
 'manger':'mange manges mangent mangeons mangeais mangeait mangeaient mangerai mangera mangerait mangeant mangé mangée mangés',
 'commencer':'commence commences commencent commençons commençais commençait commencerai commencera commencerait commençant commencé commencée'};
const elided={j:'je',l:'le',d:'de',n:'ne',c:'ce',s:'se',m:'me',t:'te',qu:'que',lorsqu:'lorsque',puisqu:'puisque',quoiqu:'quoique',jusqu:'jusque',quelqu:'quelque'};
const inflectable=new Set(['noun','adjective','numeral']);
export function forms(w){
 const base=w.word.toLowerCase().normalize('NFC'),p=posOf(w),out=[base];
 if(irregular[base])out.push(...irregular[base].split(' '));
 if(/[\s'’]/.test(base))return out;
 const add=(stem,tails)=>out.push(...tails.split(' ').map(t=>stem+t));
 if(p==='verb'){
  if(base.endsWith('er'))add(base.slice(0,-2),'e es ent ons ez ais ait ions iez aient é és ée ées ant erai eras era erons erez eront erais erait erions eriez eraient');
  else if(base.endsWith('oir'))add(base.slice(0,-3),'ois oit oyons oyez oient oyais oyait u us ue ues');
  else if(base.endsWith('ir'))add(base.slice(0,-2),'is it issons issez issent issais issait issaient i ie ies irai iras ira irons iront irais irait issant');
  else if(base.endsWith('re'))add(base.slice(0,-2),'s t ons ez ent ais ait aient u us ue ues rai ra rons ront rais rait ant');
 }else if(inflectable.has(p)){
  if(base.endsWith('al'))out.push(base.slice(0,-2)+'aux');
  if(/(eau|eu)$/.test(base))out.push(base+'x');
  if(!/[sxz]$/.test(base))out.push(base+'s');
  if(p==='adjective'){
   if(base.endsWith('x'))add(base.slice(0,-1),'se ses');
   else if(base.endsWith('f'))add(base.slice(0,-1),'ve ves');
   else if(base.endsWith('er'))add(base.slice(0,-2),'ère ères');
   else if(base.endsWith('eux'))add(base.slice(0,-1),'se ses');
   else if(!base.endsWith('e'))add(base,'e es');
  }
 }
 return out;
}
const indexes=new WeakMap();
export function formIndex(list){
 let map=indexes.get(list);
 if(map)return map;
 map=new Map();
 for(const w of list){const k=w.word.toLowerCase().normalize('NFC');if(!map.has(k))map.set(k,w.id)}
 for(const w of list)for(const f of forms(w))if(f.length>1&&!map.has(f))map.set(f,w.id);
 indexes.set(list,map);
 return map;
}
export function sentenceIds(sentence,list){
 const map=formIndex(list),ids=[];
 for(const raw of String(sentence).toLowerCase().normalize('NFC').match(/\p{L}+(?:['’]\p{L}+)*(?:-\p{L}+)*/gu)||[]){
  const parts=map.has(raw)?[raw]:raw.split(/['’-]/).map((p,i,a)=>i<a.length-1&&elided[p]?elided[p]:p);
  for(const part of parts){const id=map.get(part);if(id&&!ids.includes(id))ids.push(id)}
 }
 return ids;
}
export function blank(w){
 const target=w.word.toLowerCase().normalize('NFC');
 for(const m of String(w.example).normalize('NFC').matchAll(/\p{L}+/gu))
  if(m[0].toLowerCase()===target)return {before:w.example.slice(0,m.index),answer:m[0],after:w.example.slice(m.index+m[0].length)};
 return null;
}
const bare=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/æ/g,'ae');
const tidy=s=>String(s).trim().toLowerCase().normalize('NFC').replace(/[\u2019\u02bc]/g,"'").replace(/\s+/g,' ');
// The prompt a mode puts in front of you. 'meaning' asks for the English,
// 'compose' asks for a whole sentence and is graded elsewhere; both still carry
// an answer and a length so the shared round machinery works unchanged.
export function card(w,mode){
 if(mode==='english')return {id:w.id,word:w,kind:'meaning',before:'',after:'',
  answer:w.meaning,accepts:meanings(w),length:String(w.meaning).length};
 if(mode==='compose')return {id:w.id,word:w,kind:'compose',before:'',after:'',
  answer:w.word,accepts:[w.word],length:w.word.length};
 const cut=blank(w);
 const answer=cut?cut.answer:w.word;
 return {id:w.id,word:w,kind:cut?'cloze':'recall',before:cut?.before||'',after:cut?.after||'',answer,
  accepts:cut?[answer]:[w.word,w.article].filter(Boolean),length:answer.length};
}
export function check(typed,accepts){
 const given=tidy(typed);
 if(!given)return 'empty';
 const wanted=accepts.map(tidy);
 if(wanted.includes(given))return 'exact';
 if(wanted.some(a=>bare(a)===bare(given)))return 'accent';
 return 'wrong';
}
// English answers are free prose, and the corpus packs alternatives into one
// string: "to know (facts · how to do something)". Accept any alternative,
// with or without the parenthetical, with or without a leading article.
const flat=s=>tidy(s).replace(/[^\p{L}\p{N}\s']/gu,' ').replace(/\s+/g,' ').trim();
const unparen=s=>String(s).replace(/\([^)]*\)/g,' ');
const opener=/^(?:to|the|a|an)\s+/;
export function meanings(w){
 const out=new Set(),add=t=>{
  const v=flat(t);
  if(!v)return;
  out.add(v);
  const short=v.replace(opener,'');
  if(short)out.add(short);
 };
 const whole=String(w.meaning||'');
 for(const text of [whole,unparen(whole)]){
  add(text);
  for(const part of text.split(/[·;,]| or /))add(part);
 }
 return [...out].filter(Boolean);
}
// Damerau-Levenshtein, so a swapped pair counts as the one slip it is rather
// than two. Anything past two changes is a different answer, not a typo.
function edits(a,b){
 if(a===b)return 0;
 if(Math.abs(a.length-b.length)>2)return 3;
 let two=null,prev=Array.from({length:b.length+1},(_,j)=>j);
 for(let i=1;i<=a.length;i++){
  const row=[i];
  for(let j=1;j<=b.length;j++){
   row[j]=Math.min(prev[j]+1,row[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
   if(two&&i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])row[j]=Math.min(row[j],two[j-2]+1);
  }
  two=prev;prev=row;
 }
 return prev[b.length];
}
// 'near' is the English counterpart of 'accent': right idea, one slip. It
// grades as close, so it keeps the card moving without advancing mastery.
export function checkMeaning(typed,accepts){
 const given=flat(typed);
 if(!given)return 'empty';
 if(accepts.includes(given))return 'exact';
 const stem=given.replace(opener,'');
 if(accepts.some(a=>a.replace(opener,'')===stem))return 'exact';
 if(accepts.some(a=>bare(a)===bare(given)))return 'exact';
 if(accepts.some(a=>edits(bare(a),bare(given))<=(Math.min(a.length,given.length)>6?2:1)))return 'near';
 return 'wrong';
}
const rank=Object.fromEntries(levels.map((l,i)=>[l,i]));
// Discover walks the whole corpus A1 → C1, and inside a level by frequency.
// The level range is a filter for browsing and sorting, not for progression.
export const ladder=(words,known={})=>words
 .filter(w=>!known[w.id])
 .sort((a,b)=>rank[a.level]-rank[b.level]||a.id-b.id);

// Spread the second list evenly through the first rather than blocking it at
// one end, so a round of new words has its reviews sprinkled through it.
export function weave(main,extra){
 if(!extra.length)return [...main];
 if(!main.length)return [...extra];
 const total=main.length+extra.length,step=total/extra.length,out=[];
 let next=step/2-.5,m=0,e=0;
 for(let i=0;i<total;i++){
  if(e<extra.length&&(i>=Math.round(next)||m>=main.length)){out.push(extra[e++]);next+=step}
  else out.push(main[m++]);
 }
 return out;
}

export function queue({words,mode='discover',progress,now=Date.now(),size=10}){
 const {cards={},lib={},known={}}=progress||{};
 const due=words.filter(w=>!known[w.id]&&cards[w.id]&&cards[w.id].due<=now)
  .sort((a,b)=>cards[a.id].due-cards[b.id].due);
 if(mode==='review')return due.slice(0,size);
 // Everything that studies your own shelf draws from the same pool, due first:
 // the cloze round, the English recall round, and the sentence-writing round.
 if(mode==='library'||mode==='english'||mode==='compose')return words.filter(w=>lib[w.id]&&!known[w.id])
  .sort((a,b)=>(cards[a.id]?cards[a.id].due:now+1)-(cards[b.id]?cards[b.id].due:now+1)).slice(0,size);

 // There is no stored resume point: the next new word is simply the first one
 // on the ladder you have neither met nor retired. Nothing to drift, nothing to
 // migrate, and marking a word known or answering one moves it on by itself.
 const unseen=ladder(words,known).filter(w=>!cards[w.id]);
 // reviews take at most half a round, so progression never stalls behind them
 const reviews=due.slice(0,Math.floor(size/2));
 const fresh=unseen.slice(0,size-reviews.length);
 const topUp=due.slice(reviews.length,reviews.length+(size-reviews.length-fresh.length));
 return weave(fresh,[...reviews,...topUp]);
}
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const pad=n=>String(n).padStart(2,'0');
export const dayKey=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const addDay=(days,day=dayKey())=>days.includes(day)?days:[...days,day].sort();
const shift=(day,by)=>{const d=new Date(day+'T00:00:00');d.setDate(d.getDate()+by);return dayKey(d)};
export function streak(days,from=dayKey()){
 const set=new Set(days);
 let at=set.has(from)?from:shift(from,-1),n=0;
 while(set.has(at)){n++;at=shift(at,-1)}
 return n;
}
export function bestStreak(days){
 const sorted=[...new Set(days)].sort();
 let best=0,run=0,prev=null;
 for(const day of sorted){run=prev&&shift(prev,1)===day?run+1:1;best=Math.max(best,run);prev=day}
 return best;
}
export function lastDays(days,count=91,from=dayKey()){
 const set=new Set(days),out=[];
 for(let i=count-1;i>=0;i--){const day=shift(from,-i);out.push({day,on:set.has(day)})}
 return out;
}
export const empty={version:2,cards:{},notes:{},aiNotes:{},phrases:{},notesOn:{},lib:{},known:{},days:[],cursor:0,xp:0,best:0,rounds:0,sound:true};
export function migrate(saved){
 if(!saved||typeof saved!=='object'||Array.isArray(saved))return {...empty};
 const out={...empty,...saved,version:2,cards:plain(saved.cards),notes:plain(saved.notes),aiNotes:plain(saved.aiNotes),phrases:plain(saved.phrases),notesOn:plain(saved.notesOn),lib:plain(saved.lib),known:plain(saved.known)};
 if(!saved.lib)out.lib=Object.fromEntries(Object.keys(out.cards).map(id=>[id,0]));
 out.days=Array.isArray(saved.days)?saved.days.filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort():[];
 for(const key of ['cursor','xp','best','rounds'])out[key]=Number.isFinite(out[key])?out[key]:0;
 out.sound=out.sound!==false;
 return out;
}
export function validate(data,words){
 const d=plain(data);
 if(d.version!==1&&d.version!==2)return null;
 const ids=new Set(words.map(w=>String(w.id)));
 for(const key of ['cards','notes','aiNotes','phrases','notesOn','lib','known'])if(key in d&&plain(d[key])!==d[key])return null;
 for(const [id,c] of Object.entries(plain(d.cards)))
  if(!ids.has(id)||!c||!Number.isFinite(c.due)||!Number.isFinite(c.interval)||c.interval<0||!Number.isFinite(c.reviews))return null;
 for(const [id,n] of Object.entries(plain(d.notes)))if(!ids.has(id)||typeof n!=='string')return null;
 for(const key of ['lib','known','aiNotes','phrases','notesOn'])for(const id of Object.keys(plain(d[key])))if(!ids.has(id))return null;
 return migrate(d);
}
