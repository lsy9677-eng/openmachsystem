import{allMatches}from'./bracket-engine.js';

export const MAIN_DRAW_LIFECYCLE_SCHEMA=1;

export function mainMatchIds(state){
  try{return new Set(allMatches(state?.draw||{rounds:{}}).map(m=>m?.id).filter(Boolean));}
  catch(_e){return new Set();}
}

export function clearMainPlacement(state,{clearDraw=false}={}){
  const ids=mainMatchIds(state);
  let removed=0;
  const cleanCourt=c=>{
    if(!c)return;
    if(ids.has(c.playing)){c.playing=null;removed++;}
    if(ids.has(c.wait1)){c.wait1=null;removed++;}
    for(const key of ['queue','manualQueue']){
      if(Array.isArray(c[key])){const before=c[key].length;c[key]=c[key].filter(id=>!ids.has(id));removed+=before-c[key].length;}
    }
  };
  (state?.courts||[]).forEach(cleanCourt);
  (state?.prelim?.courts||[]).forEach(cleanCourt);
  if(Array.isArray(state?.sharedQueue)){const before=state.sharedQueue.length;state.sharedQueue=state.sharedQueue.filter(id=>!ids.has(id));removed+=before-state.sharedQueue.length;}
  Object.keys(state?.venueQueues||{}).forEach(k=>{const q=Array.isArray(state.venueQueues[k])?state.venueQueues[k]:[];const before=q.length;state.venueQueues[k]=q.filter(id=>!ids.has(id));removed+=before-state.venueQueues[k].length;});
  try{allMatches(state?.draw||{rounds:{}}).forEach(m=>{if(m.status!=='completed'){m.status='waiting_slots';delete m.courtId;delete m.court;delete m.venueId;delete m.venueName;delete m.waitStartedAt;delete m.startedAt;}});}catch(_e){}
  if(clearDraw){
    state.draw={size:0,rounds:{}};
    state.drawMeta={...(state.drawMeta||{}),locked:false,createdAt:null,checksum:null};
    if(state.prelim){state.prelim.linkedDraw={active:false,slots:[],createdAt:null,lastSyncedAt:null,userInitiated:false};}
  }
  return removed;
}

export function ensureMainDrawLifecycle(state,{resetLegacy=false}={}){
  const current=state?.mainDrawLifecycle;
  if(!current||current.schema!==MAIN_DRAW_LIFECYCLE_SCHEMA||resetLegacy){
    clearMainPlacement(state,{clearDraw:true});
    state.mainDrawLifecycle={
      schema:MAIN_DRAW_LIFECYCLE_SCHEMA,
      mode:'none',
      status:'not-drawn',
      userInitiated:false,
      actionId:null,
      startedAt:null,
      completedAt:null,
      divisionId:state?.multiDivision?.activeDivisionId||null,
      tournamentName:state?.tournament?.name||'',
      divisionName:state?.tournament?.division||''
    };
    return{migrated:true,control:state.mainDrawLifecycle};
  }
  return{migrated:false,control:current};
}

export function beginMainDraw(state,mode){
  if(!['slot','final'].includes(mode))throw new Error('지원하지 않는 본선 추첨 방식입니다.');
  ensureMainDrawLifecycle(state);
  clearMainPlacement(state,{clearDraw:true});
  const now=new Date().toISOString();
  state.mainDrawLifecycle={
    schema:MAIN_DRAW_LIFECYCLE_SCHEMA,
    mode,
    status:'drawing',
    userInitiated:true,
    actionId:`${mode}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    startedAt:now,
    completedAt:null,
    divisionId:state?.multiDivision?.activeDivisionId||null,
    tournamentName:state?.tournament?.name||'',
    divisionName:state?.tournament?.division||''
  };
  return state.mainDrawLifecycle;
}

export function completeMainDraw(state,mode){
  const control=state?.mainDrawLifecycle;
  if(!control?.userInitiated||control.status!=='drawing'||control.mode!==mode)throw new Error('본선 추첨 실행 기록을 확인할 수 없습니다.');
  control.status='drawn';
  control.completedAt=new Date().toISOString();
  control.drawSize=Number(state?.draw?.size||0);
  control.firstRoundCount=(state?.draw?.rounds?.[state?.draw?.size]||[]).length;
  if(state.draw){state.draw.lifecycleActionId=control.actionId;state.draw.lifecycleMode=mode;state.draw.lifecycleCompletedAt=control.completedAt;}
  return control;
}

export function failMainDraw(state){
  clearMainPlacement(state,{clearDraw:true});
  ensureMainDrawLifecycle(state,{resetLegacy:true});
}

export function resetMainDraw(state){
  clearMainPlacement(state,{clearDraw:true});
  ensureMainDrawLifecycle(state,{resetLegacy:true});
  return state.mainDrawLifecycle;
}

function drawExists(state){
  const draw=state?.draw;
  return Boolean(draw?.size&&draw?.rounds&&Object.values(draw.rounds).some(list=>Array.isArray(list)&&list.length));
}

function slotEvidence(state){
  const linked=state?.prelim?.linkedDraw;
  return Boolean(linked?.active===true&&linked?.userInitiated===true&&Array.isArray(linked?.slots)&&linked.slots.length&&drawExists(state));
}

function finalEvidence(state){
  const draw=state?.draw;
  return Boolean(drawExists(state)&&(draw?.stage3441Explicit==='final'||draw?.lifecycleMode==='final'));
}

export function repairMainDrawAuthorization(state){
  if(!state)return false;
  let c=state.mainDrawLifecycle;
  const activeDivisionId=state?.multiDivision?.activeDivisionId||null;
  const mode=slotEvidence(state)?'slot':finalEvidence(state)?'final':null;
  if(!mode)return false;

  if(!c||c.schema!==MAIN_DRAW_LIFECYCLE_SCHEMA||c.status!=='drawn'||c.userInitiated!==true||c.mode!==mode){
    const completedAt=state?.prelim?.linkedDraw?.userInitiatedAt||state?.prelim?.linkedDraw?.createdAt||state?.draw?.lifecycleCompletedAt||new Date().toISOString();
    c={
      schema:MAIN_DRAW_LIFECYCLE_SCHEMA,
      mode,
      status:'drawn',
      userInitiated:true,
      actionId:state?.draw?.lifecycleActionId||`${mode}-recovered-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      startedAt:completedAt,
      completedAt,
      divisionId:activeDivisionId,
      tournamentName:state?.tournament?.name||'',
      divisionName:state?.tournament?.division||'',
      recovered:true
    };
    state.mainDrawLifecycle=c;
  }
  if(c.divisionId&&activeDivisionId&&c.divisionId!==activeDivisionId)return false;
  if(!c.divisionId)c.divisionId=activeDivisionId;
  if(!state.draw.lifecycleActionId)state.draw.lifecycleActionId=c.actionId;
  if(!state.draw.lifecycleMode)state.draw.lifecycleMode=mode;
  if(!state.draw.lifecycleCompletedAt)state.draw.lifecycleCompletedAt=c.completedAt||new Date().toISOString();
  return true;
}

export function hasAuthorizedMainDraw(state){
  const c=state?.mainDrawLifecycle;
  const activeDivisionId=state?.multiDivision?.activeDivisionId||null;
  if(c&&c.schema===MAIN_DRAW_LIFECYCLE_SCHEMA&&c.status==='drawn'&&c.userInitiated===true&&c.actionId&&['slot','final'].includes(c.mode)){
    if(c.divisionId&&activeDivisionId&&c.divisionId!==activeDivisionId)return false;
    if(!drawExists(state))return false;
    if(c.mode==='slot'&&!slotEvidence(state))return false;
    if(c.mode==='final'&&!finalEvidence(state)&&state?.draw?.lifecycleMode!=='final')return false;
    if(state.draw.lifecycleActionId!==c.actionId||state.draw.lifecycleMode!==c.mode){
      state.draw.lifecycleActionId=c.actionId;
      state.draw.lifecycleMode=c.mode;
      state.draw.lifecycleCompletedAt=c.completedAt||state.draw.lifecycleCompletedAt||new Date().toISOString();
    }
    return true;
  }
  return repairMainDrawAuthorization(state);
}

export function mainDrawStatus(state){
  const authorized=hasAuthorizedMainDraw(state);
  const c=state?.mainDrawLifecycle;
  if(!authorized)return{mode:'none',label:'본선 미추첨',authorized:false};
  return{mode:c.mode,label:c.mode==='slot'?'예선 중 슬롯 추첨 완료':'최종 본선 추첨 완료',authorized:true,completedAt:c.completedAt,recovered:Boolean(c.recovered)};
}
