
function ensure(c){if(!('isPaused'in c))c.isPaused=false;if(!('pauseReason'in c))c.pauseReason='';if(!Array.isArray(c.queue))c.queue=[];}
export function ensurePrelimCourtStatuses(state){(state.prelim?.courts||[]).forEach(ensure);}
function move(state,id,source){
  const m=state.prelim.matches.find(x=>x.id===id);if(!m)return;
  const target=(state.prelim.courts||[]).filter(c=>c.id!==source.id&&!c.isPaused&&(c.venueId||'')===(source.venueId||'')).sort((a,b)=>((a.wait1?1:0)+(a.queue?.length||0))-((b.wait1?1:0)+(b.queue?.length||0)))[0];
  if(!target){source.queue.push(id);m.status='queued';return;}
  if(!target.wait1){target.wait1=id;m.status='court_wait1';}else{target.queue.push(id);m.status='queued';}
  m.prelimCourtId=target.id;m.court=target.name;m.venueId=target.venueId;m.venueName=target.venueName;
}
export function pausePrelimCourt(state,{courtId,reason='',evacuateWait=false,evacuateAll=false}){
  const c=state.prelim.courts.find(x=>x.id===courtId);if(!c)throw new Error('예선 코트를 찾지 못했습니다.');ensure(c);
  const ids=[];if(evacuateWait){if(c.wait1){ids.push(c.wait1);c.wait1=null;}ids.push(...c.queue);c.queue=[];}if(evacuateAll&&c.playing){ids.unshift(c.playing);c.playing=null;}
  ids.forEach(id=>move(state,id,c));c.isPaused=true;c.pauseReason=reason.trim();return{court:c,evacuated:ids.length};
}
export function resumePrelimCourt(state,courtId){const c=state.prelim.courts.find(x=>x.id===courtId);if(!c)throw new Error('예선 코트를 찾지 못했습니다.');ensure(c);c.isPaused=false;c.pauseReason='';return c;}
