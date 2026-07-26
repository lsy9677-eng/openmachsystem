
import{generateLinkedDrawSlots,syncLinkedDrawQualifiers,allMatches}from'./bracket-engine.js';
import{createDrawWithMethod}from'./draw-method-engine.js';

export function hasStartedMainMatches(state){
  return allMatches(state.draw||{}).some(m=>['playing','completed'].includes(m.status)&&!m.bye);
}
export function shouldUseLinkedDraw(state){
  return Boolean(state.prelim?.groups?.length);
}
export function linkedDrawNeedsRepair(state){
  if(!shouldUseLinkedDraw(state))return false;
  if(!state.draw?.size)return true;
  if(!state.prelim?.linkedDraw?.active)return true;
  const first=state.draw.rounds?.[state.draw.size]||[];
  const unresolvedGroups=(state.prelim.groups||[]).filter(g=>
    !(state.prelim.qualifiers||[]).some(t=>t.groupNo===g.groupNo)
  );
  if(!unresolvedGroups.length)return false;
  const hasExpectedPlaceholder=first.some(m=>[m.teamA,m.teamB].some(t=>t?.placeholder&&t.placeholderKey));
  return !hasExpectedPlaceholder;
}
export function rebuildLinkedDraw(state,drawSize){
  if(!shouldUseLinkedDraw(state))throw new Error('예선 조편성이 없습니다.');
  if(hasStartedMainMatches(state))throw new Error('이미 시작된 본선 경기가 있어 연결 대진을 자동 복구할 수 없습니다.');
  const slotCount=(state.prelim.groups||[]).length*Number(state.prelim.settings.qualifiersPerGroup||1);
  if(slotCount>128)throw new Error(`본선 슬롯 ${slotCount}개는 지원 최대 규모인 128강을 초과합니다.`);
  const requiredSize=slotCount<=32?32:slotCount<=64?64:128;
  const requested=Number(drawSize)||Number(state.settings?.drawSize)||64;
  const size=Math.max(requested,requiredSize);
  const slots=generateLinkedDrawSlots(
    state.prelim.groups,
    state.prelim.settings.qualifiersPerGroup,
    size
  );
  state.settings.drawSize=size;
  state.draw=createDrawWithMethod(state,slots,size,{
    method:state.settings.drawMethod||'instant',
    byePriority:state.settings.byePriority||'group-first'
  });
  state.courts=[];state.sharedQueue=[];
  state.prelim.linkedDraw={
    active:true,drawSize:size,
    slots:slots.map(s=>({
      placeholderKey:s.placeholderKey,label:s.name,
      groupNo:s.groupNo,groupRank:s.groupRank,
      resolvedTeamId:null,locked:false
    })),
    createdAt:new Date().toISOString(),lastSyncedAt:null
  };
  const result=syncLinkedDrawQualifiers(state.draw,state.prelim.qualifiers||[],{protectStarted:true});
  result.changes.forEach(change=>{
    const ref=state.prelim.linkedDraw.slots.find(x=>x.placeholderKey===change.placeholderKey);
    if(ref)ref.resolvedTeamId=change.teamId;
  });
  state.prelim.linkedDraw.lastSyncedAt=new Date().toISOString();
  return{slots:slots.length,changes:result.changes.length};
}
