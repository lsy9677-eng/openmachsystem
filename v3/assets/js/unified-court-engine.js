
import{findMatch}from'./bracket-engine.js';

export function findUnifiedMatch(state,id){
  const prelim=state.prelim?.matches?.find(m=>m.id===id);
  if(prelim)return{type:'prelim',match:prelim};
  const main=findMatch(state.draw,id);
  if(main)return{type:'main',match:main};
  return null;
}
function setUnifiedStatus(state,id,status,court){
  const item=findUnifiedMatch(state,id);if(!item)return;
  item.match.status=status;
  if(court){
    if(item.type==='prelim'){
      item.match.prelimCourtId=court.id;
    }else{
      item.match.courtId=court.id;
    }
    item.match.court=court.name;
    item.match.venueId=court.venueId;
    item.match.venueName=court.venueName;
  }
}
export function promoteUnifiedCourt(state,court){
  court.queue=Array.isArray(court.queue)?court.queue:[];
  if(court.isPaused)return court;
  if(!court.playing&&court.wait1){
    court.playing=court.wait1;court.wait1=null;
    setUnifiedStatus(state,court.playing,'playing',court);
  }
  if(!court.playing&&court.queue.length){
    court.playing=court.queue.shift();
    setUnifiedStatus(state,court.playing,'playing',court);
  }
  if(!court.wait1&&court.queue.length){
    court.wait1=court.queue.shift();
    setUnifiedStatus(state,court.wait1,'court_wait1',court);
  }
  return court;
}
export function advanceUnifiedCourt(state,courtId,completedId){
  const court=(state.prelim?.courts||[]).find(c=>c.id===courtId);
  if(!court)return null;
  if(court.playing===completedId)court.playing=null;
  promoteUnifiedCourt(state,court);
  return court;
}
export function useUnifiedCourts(state){
  return Array.isArray(state.prelim?.courts)&&state.prelim.courts.length>0;
}
export function enqueueReadyMainToUnifiedCourts(state){
  const courts=state.prelim?.courts||[];
  if(!courts.length)return{assigned:0,reason:'no-prelim-courts'};
  const queued=new Set(courts.flatMap(c=>[c.playing,c.wait1,...(c.queue||[])].filter(Boolean)));
  const ready=Object.values(state.draw?.rounds||{}).flat().filter(m=>
    m.status==='ready'&&m.teamA&&!m.teamA.placeholder&&m.teamB&&!m.teamB.placeholder&&!queued.has(m.id)
  );
  let assigned=0;
  ready.forEach(m=>{
    const court=courts.filter(c=>!c.isPaused).sort((a,b)=>{
      const la=(a.playing?1:0)+(a.wait1?1:0)+(a.queue?.length||0);
      const lb=(b.playing?1:0)+(b.wait1?1:0)+(b.queue?.length||0);
      return la-lb;
    })[0];
    if(!court)return;
    court.queue=Array.isArray(court.queue)?court.queue:[];
    court.queue.push(m.id);
    setUnifiedStatus(state,m.id,'queued',court);
    promoteUnifiedCourt(state,court);
    assigned++;
  });
  return{assigned,reason:assigned?'assigned':'no-ready'};
}
