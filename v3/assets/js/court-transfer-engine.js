
function getSlot(court,slot){return slot==='playing'?court.playing:court.wait1;}
function setSlot(court,slot,value){if(slot==='playing')court.playing=value;else court.wait1=value;}
function applyMatchSlot(match,court,slot){
  if(!match)return;
  match.court=court.name;
  match.venueId=court.venueId;
  if(slot==='playing'){
    match.status='playing';
    if(!match.startedAt)match.startedAt=new Date().toISOString();
  }else{
    match.status='court_wait1';
  }
}
export function transferTargets(state,{sourceCourtId,sourceSlot}){
  const source=state.courts.find(c=>c.id===sourceCourtId);
  if(!source)return[];
  const rows=[];
  state.courts.filter(c=>(c.venueId||'venue-default')===(source.venueId||'venue-default')).forEach(c=>{
    ['playing','wait1'].forEach(slot=>{
      if(c.id===sourceCourtId&&slot===sourceSlot)return;
      const occupied=Boolean(getSlot(c,slot));
      rows.push({
        courtId:c.id,slot,occupied,
        label:`${c.name} · ${slot==='playing'?'시합중':'대기1'}${occupied?' · 경기 있음':' · 빈 자리'}`
      });
    });
  });
  return rows;
}
export function transferCourtMatch(state,{sourceCourtId,sourceSlot,targetCourtId,targetSlot,allowSwap},findMatch){
  const source=state.courts.find(c=>c.id===sourceCourtId);
  const target=state.courts.find(c=>c.id===targetCourtId);
  if(!source||!target)throw new Error('코트를 찾지 못했습니다.');
  if((source.venueId||'venue-default')!==(target.venueId||'venue-default'))throw new Error('다른 구장으로는 코트 간 직접 이동할 수 없습니다.');
  const sourceMatchId=getSlot(source,sourceSlot);
  if(!sourceMatchId)throw new Error('이동할 경기가 없습니다.');
  const targetMatchId=getSlot(target,targetSlot);
  if(targetMatchId&&!allowSwap)throw new Error('대상 자리에 이미 경기가 있습니다.');
  setSlot(source,sourceSlot,targetMatchId||null);
  setSlot(target,targetSlot,sourceMatchId);
  applyMatchSlot(findMatch(sourceMatchId),target,targetSlot);
  if(targetMatchId)applyMatchSlot(findMatch(targetMatchId),source,sourceSlot);
  return{sourceMatchId,targetMatchId,swapped:Boolean(targetMatchId)};
}
