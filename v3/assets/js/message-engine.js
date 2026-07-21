import{findMatch}from'./bracket-engine.js';
import{getTeamContact}from'./contact-engine.js';

const cleanPhone=value=>String(value||'').replace(/[^\d+]/g,'');
const formatClock=iso=>iso?new Date(iso).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):'-';
const applyTemplate=(template,data)=>String(template||'').replace(/\{(\w+)\}/g,(_,key)=>String(data[key]??''));

function teamPhone(state,team){
  if(!team)return'';
  const saved=getTeamContact(state,team)?.phone||'';
  if(saved)return cleanPhone(saved);
  const direct=team.phone||team.mobile||team.contact||team.tel||'';
  if(direct)return cleanPhone(direct);
  for(const player of [team.player1,team.player2,team.p1,team.p2]){
    if(player&&typeof player==='object'){
      const value=player.phone||player.mobile||player.contact||player.tel;
      if(value)return cleanPhone(value);
    }
  }
  return'';
}

export function ensureMessagingState(state){
  if(!state.messaging||typeof state.messaging!=='object')state.messaging={};
  if(!Array.isArray(state.messaging.queue))state.messaging.queue=[];
  if(!state.messaging.metrics||typeof state.messaging.metrics!=='object')state.messaging.metrics={updatedCount:0};
  state.messaging.metrics.updatedCount=Number(state.messaging.metrics.updatedCount)||0;
  const previous=state.messaging.settings||{};
  state.messaging.settings={
    autoMessageEnabled:true,
    senderName:'230MATCH',
    deliveryMode:'sms-uri',
    onCourtAssign:true,
    onQueueMove:true,
    smartMessageUpdate:true,
    repeatPolicy:'update-pending',
    ...previous,
    templates:{
      playing:'[{sender}] {team}님, 현재 {court} 코트 경기입니다. 상대팀: {opponent}. 즉시 코트로 이동해 주세요.',
      wait1:'[{sender}] {team}님, {court} 코트 대기 1번입니다. 상대팀: {opponent}. 예상 대기 {wait}분, 예상 시작 {start}.',
      shared:'[{sender}] {team}님, 본선 공용대기 {queueNo}번입니다. 상대팀: {opponent}. 예상 대기 {wait}분, 예상 시작 {start}.',
      ...(previous.templates||{})
    }
  };
}

function forBothTeams(match,callback){
  const result=[];
  if(match?.teamA)result.push(callback(match.teamA,match.teamB));
  if(match?.teamB)result.push(callback(match.teamB,match.teamA));
  return result.filter(Boolean);
}

function addMessage(state,{type,match,team,opponent,court='',queueNo='',wait=0,start='-',suffix=''}){
  ensureMessagingState(state);
  const settings=state.messaging.settings;
  const body=applyTemplate(settings.templates[type],{
    sender:settings.senderName,
    team:team?.name||'팀',
    opponent:opponent?.name||'상대팀',
    court,queueNo,wait,start
  });
  const phone=teamPhone(state,team);
  const identityKey=[type,match.id,team?.id||team?.name].join('|');
  const dedupeKey=[identityKey,court,queueNo,suffix].join('|');
  const existing=state.messaging.queue.find(item=>
    (item.identityKey||[item.type,item.matchId,item.teamId||item.teamName].join('|'))===identityKey && item.status!=='sent'
  );
  const policy=settings.repeatPolicy||'update-pending';
  if(existing&&policy==='block-all')return null;
  if(existing&&settings.smartMessageUpdate!==false&&policy==='update-pending'){
    existing.identityKey=identityKey;
    existing.history=Array.isArray(existing.history)?existing.history:[];
    if(existing.body!==body){
      existing.history.unshift({at:new Date().toISOString(),body:existing.body});
      existing.history=existing.history.slice(0,20);
    }
    existing.dedupeKey=dedupeKey;
    existing.phone=phone;
    existing.body=body;
    existing.status=phone?'pending':'no-phone';
    existing.updatedAt=new Date().toISOString();
    existing.updateCount=Number(existing.updateCount||0)+1;
    state.messaging.metrics.updatedCount=Number(state.messaging.metrics.updatedCount||0)+1;
    return existing;
  }
  if(state.messaging.queue.some(item=>item.dedupeKey===dedupeKey))return null;
  const item={
    id:crypto.randomUUID(),identityKey,dedupeKey,type,matchId:match.id,
    teamId:team?.id||'',teamName:team?.name||'팀',phone,body,
    status:phone?'pending':'no-phone',createdAt:new Date().toISOString(),
    updatedAt:null,updateCount:0,history:[],sentAt:null
  };
  state.messaging.queue.unshift(item);
  return item;
}

export function generatePlayingMessages(state,matchId,courtName){
  const match=findMatch(state.draw,matchId);
  if(!match)return[];
  return forBothTeams(match,(team,opponent)=>addMessage(state,{type:'playing',match,team,opponent,court:courtName,suffix:match.startedAt||''}));
}

export function generateWait1Messages(state,matchId,courtName){
  const match=findMatch(state.draw,matchId);
  if(!match)return[];
  return forBothTeams(match,(team,opponent)=>addMessage(state,{type:'wait1',match,team,opponent,court:courtName,wait:match.estimatedWaitMinutes||0,start:formatClock(match.estimatedStartAt),suffix:match.estimatedStartAt||''}));
}

export function generateSharedMessages(state,matchId,queueNo){
  const match=findMatch(state.draw,matchId);
  if(!match)return[];
  return forBothTeams(match,(team,opponent)=>addMessage(state,{type:'shared',match,team,opponent,queueNo,wait:match.estimatedWaitMinutes||0,start:formatClock(match.estimatedStartAt),suffix:match.estimatedStartAt||''}));
}

export function generateCurrentCourtMessages(state){
  const added=[];
  state.courts.forEach(court=>{
    if(court.playing)added.push(...generatePlayingMessages(state,court.playing,court.name));
    if(court.wait1)added.push(...generateWait1Messages(state,court.wait1,court.name));
  });
  return added;
}

export function generateCurrentWaitMessages(state){
  const added=[];
  state.courts.forEach(court=>{if(court.wait1)added.push(...generateWait1Messages(state,court.wait1,court.name));});
  return added;
}

export function generateAllTimeMessages(state){
  const added=generateCurrentWaitMessages(state);
  state.sharedQueue.forEach((id,index)=>added.push(...generateSharedMessages(state,id,index+1)));
  return added;
}

export function markMessageSent(state,id){
  ensureMessagingState(state);
  const item=state.messaging.queue.find(x=>x.id===id);
  if(item){item.status='sent';item.sentAt=new Date().toISOString();}
}
export function deleteMessage(state,id){ensureMessagingState(state);state.messaging.queue=state.messaging.queue.filter(x=>x.id!==id);}
export function clearSentMessages(state){ensureMessagingState(state);state.messaging.queue=state.messaging.queue.filter(x=>x.status!=='sent');}
export function markAllSent(state){
  ensureMessagingState(state);const now=new Date().toISOString();
  state.messaging.queue.forEach(x=>{if(x.status==='pending'){x.status='sent';x.sentAt=now;}});
}
export function smsUri(item){return item?.phone?`sms:${encodeURIComponent(item.phone)}?body=${encodeURIComponent(item.body||'')}`:'';}

export function refreshMessageContacts(state){
  ensureMessagingState(state);let converted=0,updated=0;
  state.messaging.queue.forEach(item=>{
    const team=state.teams.find(t=>t.id===item.teamId||t.name===item.teamName);
    const phone=teamPhone(state,team);
    if(phone&&item.phone!==phone){item.phone=phone;updated++;}
    if(phone&&item.status==='no-phone'){item.status='pending';converted++;}
    if(!phone&&item.status==='pending')item.status='no-phone';
  });
  return{converted,updated};
}

export function mergePendingDuplicates(state){
  ensureMessagingState(state);
  const seen=new Map(),removeIds=new Set();let removed=0;
  [...state.messaging.queue].sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt)).forEach(item=>{
    if(item.status==='sent')return;
    const key=item.identityKey||[item.type,item.matchId,item.teamId||item.teamName].join('|');
    if(!seen.has(key)){seen.set(key,item);return;}
    const keep=seen.get(key);
    keep.history=Array.isArray(keep.history)?keep.history:[];
    keep.history.push({at:item.updatedAt||item.createdAt,body:item.body},...(item.history||[]));
    keep.history=keep.history.slice(0,20);removeIds.add(item.id);removed++;
  });
  state.messaging.queue=state.messaging.queue.filter(x=>!removeIds.has(x.id));
  return{removed};
}

export function getMessageHistory(state,id){
  const item=state.messaging.queue.find(x=>x.id===id);
  return item?[{at:item.updatedAt||item.createdAt,body:item.body,current:true},...(item.history||[])]:[];
}
