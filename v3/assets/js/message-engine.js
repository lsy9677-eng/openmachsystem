import{findMatch}from'./bracket-engine.js';
import{getTeamContact}from'./contact-engine.js';
const cleanPhone=v=>String(v||'').replace(/[^\d+]/g,'');
function teamPhone(state,team){if(!team)return'';const d=team.phone||team.mobile||team.contact||team.tel||'';if(d)return cleanPhone(d);for(const p of [team.player1,team.player2,team.p1,team.p2])if(p&&typeof p==='object'){const v=p.phone||p.mobile||p.contact||p.tel;if(v)return cleanPhone(v)}return''}
const fmt=iso=>iso?new Date(iso).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):'-';
const apply=(t,d)=>String(t||'').replace(/\{(\w+)\}/g,(_,k)=>String(d[k]??''));
export function ensureMessagingState(state){
  if(!state.messaging||typeof state.messaging!=='object'){
    state.messaging={settings:{},queue:[],metrics:{updatedCount:0}};
  }
  if(!Array.isArray(state.messaging.queue))state.messaging.queue=[];
  if(!state.messaging.metrics||typeof state.messaging.metrics!=='object'){
    state.messaging.metrics={updatedCount:0};
  }
  if(!Number.isFinite(Number(state.messaging.metrics.updatedCount))){
    state.messaging.metrics.updatedCount=0;
  }
  state.messaging.settings={
    autoMessageEnabled:true,
    senderName:'230MATCH',
    deliveryMode:'sms-uri',
    onCourtAssign:true,
    onQueueMove:true,
    smartMessageUpdate:true,
    repeatPolicy:'update-pending',
    ...(state.messaging.settings||{})
  };
  state.messaging.settings.templates={
    playing:'[{sender}] {team}님, 현재 {court} 코트 경기입니다. 상대팀: {opponent}. 즉시 코트로 이동해 주세요.',
    wait1:'[{sender}] {team}님, {court} 코트 대기 1번입니다. 상대팀: {opponent}. 예상 대기 {wait}분, 예상 시작 {start}.',
    shared:'[{sender}] {team}님, 본선 공용대기 {queueNo}번입니다. 상대팀: {opponent}. 예상 대기 {wait}분, 예상 시작 {start}.',
    ...((state.messaging.settings&&state.messaging.settings.templates)||{})
  };
}

export function mergePendingDuplicates(state){ensureMessagingState(state);const seen=new Map(),removeIds=new Set();let removed=0;[...state.messaging.queue].sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt)).forEach(item=>{if(item.status==='sent')return;const key=item.identityKey||[item.type,item.matchId,item.teamId||item.teamName].join('|');if(!seen.has(key)){seen.set(key,item);return}const keep=seen.get(key);keep.history=Array.isArray(keep.history)?keep.history:[];keep.history.push({at:item.updatedAt||item.createdAt,body:item.body},...(item.history||[]));keep.history=keep.history.slice(0,20);removeIds.add(item.id);removed++});state.messaging.queue=state.messaging.queue.filter(x=>!removeIds.has(x.id));return{removed}}
export function getMessageHistory(state,id){const item=state.messaging.queue.find(x=>x.id===id);return item?[{at:item.updatedAt||item.createdAt,body:item.body,current:true},...(item.history||[])]:[]}


export function generatePlayingMessages(state,id,court){
  const m=findMatch(state.draw,id);
  return m?both(m,(t,o)=>add(state,{type:'playing',match:m,team:t,opponent:o,court,suffix:m.startedAt||''})):[];
}


export function generateWait1Messages(state,id,court){
  const m=findMatch(state.draw,id);
  return m?both(m,(t,o)=>add(state,{type:'wait1',match:m,team:t,opponent:o,court,wait:m.estimatedWaitMinutes||0,start:fmt(m.estimatedStartAt),suffix:m.estimatedStartAt||''})):[];
}


export function refreshMessageContacts(state){
  ensureMessagingState(state);
  let converted=0,updated=0;
  state.messaging.queue.forEach(item=>{
    const team=state.teams.find(t=>t.id===item.teamId||t.name===item.teamName);
    const phone=teamPhone(state,team);
    if(phone&&item.phone!==phone){item.phone=phone;updated++;}
    if(phone&&item.status==='no-phone'){item.status='pending';converted++;}
    if(!phone&&item.status==='pending')item.status='no-phone';
  });
  return{converted,updated};
}


export function generateCurrentCourtMessages(state){
  const added=[];state.courts.forEach(c=>{if(c.playing)added.push(...generatePlayingMessages(state,c.playing,c.name));if(c.wait1)added.push(...generateWait1Messages(state,c.wait1,c.name));});return added;
}


export function generateCurrentWaitMessages(state){
  const added=[];state.courts.forEach(c=>{if(c.wait1)added.push(...generateWait1Messages(state,c.wait1,c.name));});return added;
}


export function generateAllTimeMessages(state){
  const added=generateCurrentWaitMessages(state);state.sharedQueue.forEach((id,index)=>added.push(...generateSharedMessages(state,id,index+1)));return added;
}


export function markMessageSent(state,id){ensureMessagingState(state);const item=state.messaging.queue.find(x=>x.id===id);if(!item)return;item.status='sent';item.sentAt=new Date().toISOString();}


export function deleteMessage(state,id){ensureMessagingState(state);state.messaging.queue=state.messaging.queue.filter(x=>x.id!==id);}


export function clearSentMessages(state){ensureMessagingState(state);state.messaging.queue=state.messaging.queue.filter(x=>x.status!=='sent');}


export function markAllSent(state){ensureMessagingState(state);const now=new Date().toISOString();state.messaging.queue.forEach(x=>{if(x.status==='pending'){x.status='sent';x.sentAt=now;}});}


export function smsUri(item){if(!item?.phone)return'';return `sms:${encodeURIComponent(item.phone)}?body=${encodeURIComponent(item.body||'')}`;}
