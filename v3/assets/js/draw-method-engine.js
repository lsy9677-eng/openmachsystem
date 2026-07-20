
import{generateDraw,allMatches}from'./bracket-engine.js';

function clone(v){return structuredClone(v);}
function hashString(input){
  let h=2166136261;
  for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16).padStart(8,'0');
}
function seededRandom(seed){
  let t=seed>>>0;
  return()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296;};
}
function shuffle(input,seed=Date.now()){
  const out=[...input],rnd=seededRandom(Number(seed)&0xffffffff);
  for(let i=out.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
function spreadGroupFirst(teams){
  const first=shuffle(teams.filter(t=>Number(t.groupRank)===1),Date.now());
  const second=shuffle(teams.filter(t=>Number(t.groupRank)!==1),Date.now()+11);
  const result=[];let a=0,b=0;
  while(a<first.length||b<second.length){
    if(a<first.length)result.push(first[a++]);
    if(b<second.length)result.push(second[b++]);
  }
  return result;
}
export function ensureDrawMeta(state){
  if(!state.drawMeta)state.drawMeta={locked:false,method:null,byePriority:null,createdAt:null,checksum:null,history:[]};
  if(!Array.isArray(state.drawMeta.history))state.drawMeta.history=[];
  if(!('locked'in state.drawMeta))state.drawMeta.locked=false;
}
export function canModifyDraw(state){
  ensureDrawMeta(state);
  if(state.drawMeta.locked)return{ok:false,reason:'본선 대진이 잠겨 있습니다.'};
  const started=allMatches(state.draw).some(m=>['playing','completed'].includes(m.status)&&!m.bye);
  if(started)return{ok:false,reason:'이미 시작되거나 완료된 본선 경기가 있어 재추첨할 수 없습니다.'};
  return{ok:true,reason:''};
}
export function prepareDrawTeams(teams,{method='instant',byePriority='group-first'}={}){
  const source=clone(teams);
  if(method==='seeded')return spreadGroupFirst(source);
  if(method==='roulette')return shuffle(source,Date.now()+29);
  if(byePriority==='group-first')return spreadGroupFirst(source);
  return shuffle(source,Date.now());
}
export function createDrawWithMethod(state,teams,drawSize,options={}){
  ensureDrawMeta(state);
  const ordered=prepareDrawTeams(teams,options);
  const draw=generateDraw(ordered,drawSize);
  const checksum=calculateDrawChecksum(draw);
  state.drawMeta={
    ...state.drawMeta,
    locked:false,
    method:options.method||'instant',
    byePriority:options.byePriority||'group-first',
    createdAt:new Date().toISOString(),
    checksum
  };
  state.drawMeta.history.unshift({
    id:crypto.randomUUID(),
    at:state.drawMeta.createdAt,
    method:state.drawMeta.method,
    byePriority:state.drawMeta.byePriority,
    drawSize:Number(drawSize),
    teamCount:teams.length,
    checksum
  });
  state.drawMeta.history=state.drawMeta.history.slice(0,30);
  return draw;
}
export function calculateDrawChecksum(draw){
  const raw=(draw.rounds?.[draw.size]||[]).map(m=>`${m.teamA?.id||'-'}:${m.teamB?.id||'-'}`).join('|');
  return hashString(raw);
}
export function lockDraw(state){
  ensureDrawMeta(state);
  if(!state.draw?.size)throw new Error('잠글 본선 대진이 없습니다.');
  state.drawMeta.locked=true;
  state.drawMeta.lockedAt=new Date().toISOString();
}
export function unlockDrawForDevelopment(state){
  ensureDrawMeta(state);
  const check=canModifyDraw({...state,drawMeta:{...state.drawMeta,locked:false}});
  if(!check.ok)throw new Error(check.reason);
  state.drawMeta.locked=false;
  state.drawMeta.lockedAt=null;
}
export function clearDrawHistory(state){
  ensureDrawMeta(state);state.drawMeta.history=[];
}
