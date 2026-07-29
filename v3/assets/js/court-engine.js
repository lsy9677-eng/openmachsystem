
import{allMatches}from'./bracket-engine.js';
import{promoteCourtManualQueue}from'./court-manual-queue-engine.js';

function venueIds(courts){return[...new Set(courts.map(c=>c.venueId||'venue-default'))];}
function ensureQueues(state){
  if(!state.venueQueues||typeof state.venueQueues!=='object')state.venueQueues={};
  venueIds(state.courts||[]).forEach(id=>{if(!Array.isArray(state.venueQueues[id]))state.venueQueues[id]=[];});
}
function queueFor(state,venueId){
  ensureQueues(state);
  return state.venueQueues[venueId]||(state.venueQueues[venueId]=[]);
}

export function topBottomMiddleOrder(items){
  const source=[...items],result=[],used=new Set();
  const n=source.length;
  let top=0,bottom=n-1,leftCenter=Math.floor((n-1)/2),rightCenter=Math.ceil((n-1)/2),toggle=0;
  const take=i=>{if(i>=0&&i<n&&!used.has(i)){used.add(i);result.push(source[i]);}};
  while(result.length<n){
    take(top++);take(bottom--);
    if(result.length>=n)break;
    if(toggle%2===0)take(rightCenter++);
    else take(leftCenter--);
    toggle++;
  }
  return result;
}
function resetAssignableMatches(draw){
  allMatches(draw).forEach(m=>{
    if(m.status==='completed'||m.bye)return;
    if(m.teamA&&m.teamB){
      m.status='ready';m.court=null;m.venueId=null;m.startedAt=null;
    }
  });
}

function balancedReadyMatches(draw){
  const ready=allMatches(draw).filter(m=>m.status==='ready');
  const byRound=new Map();
  ready.forEach(m=>{
    const key=Number(m.roundSize)||0;
    if(!byRound.has(key))byRound.set(key,[]);
    byRound.get(key).push(m);
  });
  const ordered=[];
  [...byRound.keys()].sort((a,b)=>b-a).forEach(size=>{
    const list=byRound.get(size).sort((a,b)=>(a.matchNo||0)-(b.matchNo||0));
    ordered.push(...topBottomMiddleOrder(list));
  });
  return ordered;
}
function activeVenueGroups(courts){
  const groups=new Map();
  courts.filter(c=>!c.isPaused).forEach(c=>{
    const id=c.venueId||'venue-default';
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push(c);
  });
  return [...groups.entries()].map(([venueId,venueCourts])=>({venueId,courts:venueCourts}));
}
function splitBalancedByVenue(matches,groups){
  const buckets=new Map(groups.map(g=>[g.venueId,[]]));
  const loads=new Map(groups.map(g=>[g.venueId,0]));
  matches.forEach(match=>{
    const target=groups.reduce((best,g)=>{
      const normalized=loads.get(g.venueId)/Math.max(1,g.courts.length);
      if(!best||normalized<best.normalized-1e-9)return{group:g,normalized};
      return best;
    },null).group;
    buckets.get(target.venueId).push(match);
    loads.set(target.venueId,loads.get(target.venueId)+1);
  });
  return buckets;
}
export function buildCourts(count,prefix){
  return Array.from({length:count},(_,i)=>({id:`court-${i+1}`,name:`${prefix}${i+1}`,venueId:'venue-default',venueName:prefix,playing:null,wait1:null}));
}
export function assignInitial(draw,courts,state=null){
  resetAssignableMatches(draw);
  const ready=balancedReadyMatches(draw);
  courts.forEach(c=>{c.playing=null;c.wait1=null;c.manualQueue=[];if(!('isPaused'in c))c.isPaused=false;});
  if(!state){
    let index=0;
    courts.filter(c=>!c.isPaused).forEach(c=>{
      if(ready[index]){
        c.playing=ready[index].id;ready[index].status='playing';ready[index].court=c.name;ready[index].venueId=c.venueId;ready[index].startedAt=new Date().toISOString();index++;
      }
    });
    courts.filter(c=>!c.isPaused).forEach(c=>{
      if(ready[index]){
        c.wait1=ready[index].id;ready[index].status='court_wait1';ready[index].court=c.name;ready[index].venueId=c.venueId;index++;
      }
    });
    const shared=[];
    while(index<ready.length){ready[index].status='shared_queue';ready[index].court=null;shared.push(ready[index].id);index++;}
    return shared;
  }

  ensureQueues(state);
  Object.keys(state.venueQueues).forEach(id=>state.venueQueues[id]=[]);
  const groups=activeVenueGroups(courts);
  const buckets=splitBalancedByVenue(ready,groups);

  groups.forEach(group=>{
    const bucket=buckets.get(group.venueId)||[];
    let index=0;
    group.courts.forEach(c=>{
      const m=bucket[index++];
      if(!m)return;
      c.playing=m.id;m.status='playing';m.court=c.name;m.venueId=c.venueId;m.startedAt=new Date().toISOString();
    });
    group.courts.forEach(c=>{
      const m=bucket[index++];
      if(!m)return;
      c.wait1=m.id;m.status='court_wait1';m.court=c.name;m.venueId=c.venueId;
    });
    while(index<bucket.length){
      const m=bucket[index++];
      m.status='venue_shared_queue';m.court=null;m.venueId=group.venueId;
      queueFor(state,group.venueId).push(m.id);
    }
  });
  state.sharedQueue=[];
  return [];
}
export function removeFromQueues(state,matchId){
  let sourceCourt=null;
  state.courts.forEach(c=>{
    if(c.playing===matchId){c.playing=null;sourceCourt=c;}
    if(c.wait1===matchId)c.wait1=null;
  });
  state.sharedQueue=(state.sharedQueue||[]).filter(id=>id!==matchId);
  ensureQueues(state);
  Object.keys(state.venueQueues).forEach(id=>state.venueQueues[id]=state.venueQueues[id].filter(x=>x!==matchId));
  return sourceCourt;
}
export function refillCourt(state,court,findMatch){
  if(!court||court.isPaused)return;
  if(promoteCourtManualQueue(state,court,findMatch)){}
  if(!court.playing&&court.wait1){
    court.playing=court.wait1;court.wait1=null;
    const m=findMatch(court.playing);if(m){m.status='playing';m.court=court.name;m.venueId=court.venueId;m.startedAt=new Date().toISOString();}
  }
  if(!court.wait1&&(!court.manualQueue||!court.manualQueue.length)){
    ensureQueues(state);
    const q=queueFor(state,court.venueId||'venue-default');
    if(q.length){
      court.wait1=q.shift();
      const m=findMatch(court.wait1);if(m){m.status='court_wait1';m.court=court.name;m.venueId=court.venueId;}
    }else if((state.sharedQueue||[]).length){
      court.wait1=state.sharedQueue.shift();
      const m=findMatch(court.wait1);if(m){m.status='court_wait1';m.court=court.name;m.venueId=court.venueId;}
    }
  }
}
export function queueReadyMatches(state,findMatch){
  ensureQueues(state);
  const occupied=new Set(state.courts.flatMap(c=>[c.playing,c.wait1]).filter(Boolean));
  (state.sharedQueue||[]).forEach(id=>occupied.add(id));
  Object.values(state.venueQueues).flat().forEach(id=>occupied.add(id));
  const ready=balancedReadyMatches(state.draw).filter(m=>!occupied.has(m.id));
  const ids=venueIds(state.courts);
  let cursor=0;
  ready.forEach(m=>{
    const venueId=m.venueId&&ids.includes(m.venueId)?m.venueId:ids[cursor%ids.length];
    m.status='venue_shared_queue';m.venueId=venueId;queueFor(state,venueId).push(m.id);cursor++;
  });
  state.courts.filter(c=>!c.isPaused).forEach(c=>refillCourt(state,c,findMatch));
}
export function venueQueueSnapshot(state){
  ensureQueues(state);
  return Object.fromEntries(Object.entries(state.venueQueues).map(([id,q])=>[id,[...q]]));
}
