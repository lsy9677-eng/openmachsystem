const VERSION='1.19.1';
const t=v=>String(v??'').trim();
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function selectedKey(){
  try{
    if(window.MainDrawV1052&&typeof window.MainDrawV1052.selectedKey==='function'){
      const k=t(window.MainDrawV1052.selectedKey());if(k)return k;
    }
  }catch(_e){}
  const direct=t(window.CM_key||window.currentDrawKey||window.selectedDrawKey);
  if(direct&&window.G?.draws?.[direct])return direct;
  const tid=t(document.getElementById('brTS')?.value);
  let div=t(document.getElementById('brDS')?.value);
  if(tid&&div&&div!=='__ALL__'&&window.G?.draws?.[`${tid}_${div}`])return `${tid}_${div}`;
  if(tid){
    const keys=Object.keys(window.G?.draws||{}).filter(k=>k.startsWith(tid+'_'));
    if(keys.length===1)return keys[0];
  }
  if(!div||div==='__ALL__'){
    const a=document.querySelector('#brMultiDiv button.active,#brMultiDiv button.selected,#brMultiDiv [aria-pressed="true"]');
    div=t(a?.dataset?.div||a?.dataset?.value||a?.textContent).replace(/[✓✔]/g,'').trim();
  }
  return tid&&div?`${tid}_${div}`:'';
}
function splitKey(key){const i=key.indexOf('_');return i<0?{tid:key,div:''}:{tid:key.slice(0,i),div:key.slice(i+1)}}
function rawTeamName(raw,teams,index){
  if(raw==null)return '';
  if(typeof raw==='number'||(/^\d+$/.test(String(raw))&&teams?.[Number(raw)])){
    const obj=teams?.[Number(raw)];
    return t(obj?.nm||obj?.name||obj?.teamName||obj?.label||obj?.playersText||obj?.displayName||`팀 ${Number(raw)+1}`);
  }
  if(typeof raw==='string')return t(raw);
  return t(raw?.nm||raw?.name||raw?.teamName||raw?.label||raw?.playersText||raw?.displayName||[raw?.player1,raw?.player2].filter(Boolean).join(' / ')||raw?.id||raw?.teamId||`팀 ${index+1}`);
}
function entry(x,i,teams=[]){
  const ti=x?.ti!=null?n(x.ti,null):(typeof x==='number'?n(x,null):null);
  return {id:t(x?.id||x?.teamId||(ti!=null?`team-${ti}`:`slot-${i+1}`)),ti,name:rawTeamName(x,teams,i)||`본선 자리 ${i+1}`,group:x?.gn??x?.group??null,rank:n(x?.rk||x?.rank||2,2),placeholder:!!x?.placeholder||ti==null,raw:clone(x)}
}
function entryId(x){return t(x?.teamId||x?.id||x?.regId||x?.uid||x?.key||x?.teamKey||x?.name||x?.teamName||x?.label||x?.ti)}
function collectFromGroups(draw,teams){
  const out=[];
  const groups=Array.isArray(draw?.groups)?draw.groups:[];
  groups.forEach((g,gi)=>{
    const rows=g?.ranks||g?.rankings||g?.standings||g?.teams||g?.entries||[];
    if(Array.isArray(rows)&&rows.length){
      rows.forEach((row,ri)=>{
        const rank=n(row?.rank||row?.place||row?.position||(ri+1));
        if(rank>0&&rank<=2)out.push({...row,gn:gi+1,rk:rank,id:entryId(row)||`g${gi+1}r${rank}`});
      });
    }else{
      [['winner',1],['first',1],['runnerUp',2],['second',2]].forEach(([f,rank])=>{if(g?.[f])out.push({...g[f],gn:gi+1,rk:rank,id:entryId(g[f])||`g${gi+1}r${rank}`})});
    }
  });
  return out;
}
function collectFromMainMatches(key,teams){
  const main=(window.G?.matches?.[key]||[]).filter(m=>m&&(m.v1051Main===true||m.phase==='main'||m.stage==='main'));
  if(!main.length)return [];
  const rounds=main.map(m=>n(m?.round??m?.roundIndex??m?.r,999));
  const minRound=Math.min(...rounds);
  const first=main.filter(m=>n(m?.round??m?.roundIndex??m?.r,999)===minRound);
  const seen=new Set(),out=[];
  for(const m of first){
    for(const side of ['t1','team1','teamA','p1','side1','t2','team2','teamB','p2','side2']){
      const raw=m?.[side]; if(raw==null||t(raw)==='')continue;
      const id=typeof raw==='object'?entryId(raw):t(raw);
      if(!id||id==='TBD'||seen.has(id))continue;
      seen.add(id);
      const obj=typeof raw==='object'?raw:{ti:/^\d+$/.test(id)?Number(id):null,id,name:rawTeamName(raw,teams,out.length)};
      out.push({...obj,rk:n(obj?.rk||obj?.rank||2,2)});
    }
  }
  return out;
}
function extractQualifiers(key=selectedKey()){
  const G=window.G;if(!G||!key)return {key,entries:[],source:'none'};
  const {tid,div}=splitKey(key),draw=G.draws?.[key],teams=G.teams?.[key]||[],tour=(G.tournaments||[]).find(x=>String(x.id)===tid);
  let rows=[],source='';
  try{
    if(typeof window.gDS==='function'){
      const cfg=window.gDS(tour,div),gm=(G.matches?.[key]||[]).filter(m=>m?.phase==='group');
      const done=gm.length&&gm.every(m=>{try{return !!window.getMatchResultState?.(key,m)?.done}catch(_){return false}});
      if(done&&typeof window.getAdvT==='function'){rows=window.getAdvT(key,draw,teams,cfg)||[];source='getAdvT'}
      else if(typeof window.getPreviewAdvSlots==='function'){rows=window.getPreviewAdvSlots(draw,cfg)||[];source='getPreviewAdvSlots'}
    }
  }catch(e){console.warn('[V2-SHADOW] qualifier extraction fallback',e)}
  if(!rows.length){rows=collectFromGroups(draw,teams);if(rows.length)source='draw.groups'}
  if(!rows.length&&Array.isArray(draw?.mainQualifiers)){rows=draw.mainQualifiers;source='mainQualifiers'}
  if(!rows.length&&Array.isArray(draw?.qualifiers)){rows=draw.qualifiers;source='qualifiers'}
  if(!rows.length){rows=collectFromMainMatches(key,teams);if(rows.length)source='existing-main-first-round'}
  return {key,tid,div,source,entries:rows.map((x,i)=>entry(x,i,teams)),draw:clone(draw)};
}
function pow2(c){let p=2;while(p<c&&p<128)p*=2;return Math.min(128,p)}
function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rand(seed){let x=seed||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296}}
function shuffle(a,r){a=[...a];for(let i=a.length-1;i;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function rev(v,b){let o=0;for(let i=0;i<b;i++)o=(o<<1)|((v>>i)&1);return o}
function balanced(count){const b=Math.ceil(Math.log2(Math.max(1,count)));return [...Array(count).keys()].sort((a,c)=>rev(a,b)-rev(c,b))}
function take(pool,pred){const i=pool.findIndex(pred);return i<0?null:pool.splice(i,1)[0]}
function createShadowDraw(opts={}){
  const src=extractQualifiers(opts.key||selectedKey()), q=src.entries;if(q.length<2)throw Error('본선 진출팀을 찾지 못했습니다.');
  const size=opts.drawSize||pow2(q.length), byeCount=size-q.length, seed=n(opts.seed,hash(src.key+'|'+q.map(x=>x.id).join('|'))), r=rand(seed), mc=size/2;
  const byeSet=new Set(balanced(mc).slice(0,byeCount));
  let rank1=shuffle(q.filter(x=>x.rank===1),r), others=shuffle(q.filter(x=>x.rank!==1),r);
  const first=[...Array(mc)].map((_,i)=>({id:`R1-M${i+1}`,round:1,roundSize:size,matchNo:i+1,team1:null,team2:null,bye:false,winner:null,nextMatchId:`R2-M${Math.floor(i/2)+1}`,nextSlot:i%2+1,state:'future'}));
  for(const i of balanced(mc))if(byeSet.has(i)){const e=rank1.shift()||others.shift();if(e){Object.assign(first[i],{team1:e,bye:true,winner:e,state:'completed-bye'})}}
  const pool=shuffle([...rank1,...others],r);
  for(const i of [...Array(mc).keys()].filter(i=>!byeSet.has(i))){const a=pool.shift()||null,b=a?(take(pool,x=>x.group==null||a.group==null||x.group!==a.group)||pool.shift()||null):null;Object.assign(first[i],{team1:a,team2:b,state:a&&b?'ready':'future'})}
  const rounds=[first];let prev=first,round=2,rs=size/2;
  while(prev.length>1){const cur=[...Array(prev.length/2)].map((_,i)=>({id:`R${round}-M${i+1}`,round,roundSize:rs,matchNo:i+1,team1:null,team2:null,winner:null,source1:`R${round-1}-M${i*2+1}`,source2:`R${round-1}-M${i*2+2}`,nextMatchId:prev.length/2>1?`R${round+1}-M${Math.floor(i/2)+1}`:null,nextSlot:prev.length/2>1?i%2+1:null,state:'future'}));rounds.push(cur);prev=cur;round++;rs/=2}
  for(let i=0;i<rounds.length-1;i++)rounds[i].forEach((m,j)=>{if(m.winner){const d=rounds[i+1][Math.floor(j/2)];j%2?d.team2=m.winner:d.team1=m.winner;if(d.team1&&d.team2)d.state='ready'}});
  const plan={engine:'V2-shadow',version:VERSION,createdAt:new Date().toISOString(),readOnly:true,sourceKey:src.key,source:src.source,seed,qualifierCount:q.length,drawSize:size,byeCount,totalMatchCount:size-1,qualifiers:q,rounds};
  plan.validation=validatePlan(plan);window.__V2_MAIN_ENGINE_SHADOW_PLAN__=plan;return plan;
}
function validatePlan(p){const errors=[],warnings=[],all=p.rounds.flat(),ids=new Set();for(const m of all){if(ids.has(m.id))errors.push(`경기 ID 중복 ${m.id}`);ids.add(m.id)}if(all.length!==p.totalMatchCount)errors.push(`경기 수 ${all.length}/${p.totalMatchCount}`);if(new Set(p.qualifiers.map(x=>x.id)).size!==p.qualifiers.length)errors.push('진출팀 중복');const same=p.rounds[0].filter(m=>m.team1&&m.team2&&m.team1.group!=null&&m.team1.group===m.team2.group);if(same.length)warnings.push(`같은 조 1회전 ${same.length}건`);return {ok:!errors.length,errors,warnings,sameGroupFirstRound:same.map(x=>x.id),byeRank1:p.rounds[0].filter(m=>m.bye&&m.team1?.rank===1).length,byeCount:p.byeCount}}
function printPlan(p=createShadowDraw()){console.group(`[V2-SHADOW] ${p.drawSize}강 · ${p.qualifierCount}팀`);console.info('검증',p.validation);console.table(p.rounds[0].map(m=>({경기:m.id,'1번팀':m.team1?.name||'BYE/TBD','1번조':m.team1?.group??'','1번순위':m.team1?.rank||'','2번팀':m.team2?.name||'BYE/TBD','2번조':m.team2?.group??'','2번순위':m.team2?.rank||'',부전승:m.bye?'예':'아니오'})));console.groupEnd();return p}
function compareWithLegacy(p=createShadowDraw()){const main=(window.G?.matches?.[p.sourceKey]||[]).filter(m=>m?.phase==='main');return {version:VERSION,readOnly:true,key:p.sourceKey,shadow:{qualifierCount:p.qualifierCount,drawSize:p.drawSize,byeCount:p.byeCount,totalMatchCount:p.totalMatchCount,validation:p.validation},legacy:{mainMatchCount:main.length,playing:main.filter(m=>m.court&&!m.waitingFirstAt&&!m.winner).length,courtWait1:main.filter(m=>m.manualCourtTarget&&m.waitingFirstAt&&!m.winner).length,sharedQueue:main.filter(m=>m.manualSharedHold&&!m.winner).length},sourceUnchanged:true}}
function downloadPlan(p=createShadowDraw()){const b=new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`230match-v2-shadow-${p.drawSize}-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);return p}
const API={version:VERSION,selectedKey,extractQualifiers,createShadowDraw,validatePlan,printPlan,compareWithLegacy,downloadPlan};window.V2MainEngineShadow=API;console.log(`[V2-MAIN-ENGINE-SHADOW] v${VERSION} ready · qualifier fallback fixed · no writes`);export default API;
