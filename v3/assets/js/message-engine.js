import{findMatch}from'./bracket-engine.js';
import{getTeamContact}from'./contact-engine.js';
const cleanPhone=v=>String(v||'').replace(/[^\d+]/g,'');
function teamPhone(state,team){if(!team)return'';const d=team.phone||team.mobile||team.contact||team.tel||'';if(d)return cleanPhone(d);for(const p of [team.player1,team.player2,team.p1,team.p2])if(p&&typeof p==='object'){const v=p.phone||p.mobile||p.contact||p.tel;if(v)return cleanPhone(v)}return''}
const fmt=iso=>iso?new Date(iso).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):'-';
const apply=(t,d)=>String(t||'').replace(/\{(\w+)\}/g,(_,k)=>String(d[k]??''));
export function ensureMessagingState(state){if(!state.messaging)state.messaging={settings:{},queue:[]};if(!Array.isArray(state.messaging.queue))state.messaging.queue=[];const defaults={autoMessageEnabled:true,senderName:'230MATCH',deliveryMode:'sms-uri',onCourtAssign:true,onQueueMove:true,smartMessageUpdate:true,repeatPolicy:'update-pending',templates:{playing:'[{sender}] {team}님, 현재 {court} 코트 경기입니다. 상대팀: {opponent}. 즉시 코트로 이동해 주세요.',wait1:'[{sender}] {team}님, {court} 코트 대기 1번입니다. 상대팀: {opponent}. 예상 대기 {wait}분, 예상 시작 {start}.',shared:'[{sender}] {team}님, 본선 공용대기 {queueNo}번입니다. 상대팀: {opponent}. 예상 대기 {wait}분, 예상 시작 {start}.'}};state.messaging.settings={...defaults,...(state.messaging.settings||{}),templates:{...defaults.templates,...(state.messaging.settings?.templates||{})}}}
function add(state,{type,match,team,opponent,court='',queueNo='',wait=0,start='-',suffix=''}){ensureMessagingState(state);const body=apply(state.messaging.settings.templates[type],{sender:state.messaging.settings.senderName,team:team?.name||'팀',opponent:opponent?.name||'상대팀',court,queueNo,wait,start});const phone=teamPhone(state,team);const identityKey=[type,match.id,team?.id||team?.name].join('|');const dedupeKey=[identityKey,court,queueNo,suffix].join('|');const policy=state.messaging.settings.repeatPolicy||'update-pending';const smart=state.messaging.settings.smartMessageUpdate!==false;const existing=state.messaging.queue.find(x=>(x.identityKey||[x.type,x.matchId,x.teamId||x.teamName].join('|'))===identityKey&&x.status!=='sent');if(existing&&policy==='block-all')return null;if(existing&&smart&&policy==='update-pending'){existing.identityKey=identityKey;existing.history=Array.isArray(existing.history)?existing.history:[];if(existing.body!==body){existing.history.unshift({at:new Date().toISOString(),body:existing.body});existing.history=existing.history.slice(0,20)}existing.dedupeKey=dedupeKey;existing.phone=phone;existing.body=body;existing.status=phone?'pending':'no-phone';existing.updatedAt=new Date().toISOString();existing.updateCount=Number(existing.updateCount||0)+1;state.messaging.metrics.updatedCount=Number(state.messaging.metrics.updatedCount||0)+1;return existing}if(state.messaging.queue.some(x=>x.dedupeKey===dedupeKey))return null;const item={id:crypto.randomUUID(),identityKey,dedupeKey,type,matchId:match.id,teamId:team?.id||'',teamName:team?.name||'팀',phone,body,status:phone?'pending':'no-phone',createdAt:new Date().toISOString(),updatedAt:null,updateCount:0,history:[],sentAt:null};state.messaging.queue.unshift(item);return item}
function both(match,fn){return[match.teamA&&fn(match.teamA,match.teamB),match.teamB&&fn(match.teamB,match.teamA)].filter(Boolean)}
export function generatePlayingMessages(state,id,court){const m=findMatch(state.draw,id);return m?both(m,(t,o)=>add(state,{type:'playing',match:m,team:t,opponent:o,court,suffix:m.startedAt||''})):[]}
export function generateWait1Messages(state,id,court){const m=findMatch(state.draw,id);return m?both(m,(t,o)=>add(state,{type:'wait1',match:m,team:t,opponent:o,court,wait:m.estimatedWaitMinutes||0,start:fmt(m.estimatedStartAt),suffix:m.estimatedStartAt||''})):[]}
export function generateSharedMessages(state,id,no){const m=findMatch(state.draw,id);return m?both(m,(t,o)=>add(state,{type:'shared',match:m,team:t,opponent:o,queueNo:no,wait:m.estimatedWaitMinutes||0,start:fmt(m.estimatedStartAt),suffix:m.estimatedStartAt||''})):[]}
export function generateCurrentCourtMessages(state){const out=[];state.courts.forEach(c=>{if(c.playing)out.push(...generatePlayingMessages(state,c.playing,c.name));if(c.wait1)out.push(...generateWait1Messages(state,c.wait1,c.name))});return out}
export function generateCurrentWaitMessages(state){const out=[];state.courts.forEach(c=>{if(c.wait1)out.push(...generateWait1Messages(state,c.wait1,c.name))});return out}
export function generateAllTimeMessages(state){const out=generateCurrentWaitMessages(state);state.sharedQueue.forEach((id,i)=>out.push(...generateSharedMessages(state,id,i+1)));return out}
export function markMessageSent(state,id){const x=state.messaging.queue.find(x=>x.id===id);if(x){x.status='sent';x.sentAt=new Date().toISOString()}}
export function deleteMessage(state,id){state.messaging.queue=state.messaging.queue.filter(x=>x.id!==id)}
export function clearSentMessages(state){state.messaging.queue=state.messaging.queue.filter(x=>x.status!=='sent')}
export function markAllSent(state){const now=new Date().toISOString();state.messaging.queue.forEach(x=>{if(x.status==='pending'){x.status='sent';x.sentAt=now}})}
export function smsUri(item){return item.phone?`sms:${encodeURIComponent(item.phone)}?body=${encodeURIComponent(item.body)}`:''}

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

export function mergePendingDuplicates(state){ensureMessagingState(state);const seen=new Map(),removeIds=new Set();let removed=0;[...state.messaging.queue].sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt)).forEach(item=>{if(item.status==='sent')return;const key=item.identityKey||[item.type,item.matchId,item.teamId||item.teamName].join('|');if(!seen.has(key)){seen.set(key,item);return}const keep=seen.get(key);keep.history=Array.isArray(keep.history)?keep.history:[];keep.history.push({at:item.updatedAt||item.createdAt,body:item.body},...(item.history||[]));keep.history=keep.history.slice(0,20);removeIds.add(item.id);removed++});state.messaging.queue=state.messaging.queue.filter(x=>!removeIds.has(x.id));return{removed}}
export function getMessageHistory(state,id){const item=state.messaging.queue.find(x=>x.id===id);return item?[{at:item.updatedAt||item.createdAt,body:item.body,current:true},...(item.history||[])]:[]}
