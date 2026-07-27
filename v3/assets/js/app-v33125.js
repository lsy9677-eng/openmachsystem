
import{loadState,saveState,clearState,saveRecovery,getRecoveries,deleteRecovery,initialState}from'./store.js?v=33125';
import{prepareTeams,generateDraw,allMatches,findMatch,generateLinkedDrawSlots,syncLinkedDrawQualifiers}from'./bracket-engine.js?v=33125';
import{ensureDrawMeta,canModifyDraw,createDrawWithMethod,lockDraw,unlockDrawForDevelopment,clearDrawHistory}from'./draw-method-engine.js?v=33125';
import{buildCourts,assignInitial,queueReadyMatches,refillCourt}from'./court-engine.js?v=33125';
import{submitResult}from'./result-engine.js?v=33125';
import{ensurePrelimState,generatePrelim,assignPrelimCourts,findPrelimMatch,submitPrelimResult,resetPrelim,autoFitPrelimGroups,swapActiveReserveTeam,isPrelimLocked,lockPrelim,unlockPrelim}from'./prelim-engine.js?v=33125';
import{downloadJson}from'./recovery.js?v=33125';
import{ensureTimeState,calculateTimeMetrics}from'./time-engine.js?v=33125';
import{ensureMessagingState,generatePlayingMessages,generateWait1Messages,generateCurrentCourtMessages,generateCurrentWaitMessages,generateAllTimeMessages,markMessageSent,deleteMessage,clearSentMessages,markAllSent,smsUri,refreshMessageContacts,mergePendingDuplicates,getMessageHistory}from'./message-engine.js?v=33125';
import{ensureContacts,getTeamContact,setTeamContact,validatePhone,exportContactData,importContactData}from'./contact-engine.js?v=33125';
import{render,teamText}from'./ui.js?v=33125';
import{ensureAuditState,runStateAudit,runPrelimSimulation,runFullSimulation,applyAuditResult}from'./audit-engine.js?v=33125';
import{earlyMainStats,markResolvedMainMatchesReady,canAssignEarlyMain,ensureEarlyMainSettings,autoAssignResolvedMain}from'./early-main-engine.js?v=33125';
import{useUnifiedCourts,enqueueReadyMainToUnifiedCourts,advanceUnifiedCourt,reconcileUnifiedMainQueues,findUnifiedMatch,moveUnifiedCourtMatchFlexible}from'./unified-court-engine.js?v=33125';
import{shouldUseLinkedDraw,linkedDrawNeedsRepair,rebuildLinkedDraw,hasStartedMainMatches}from'./linked-draw-guard-engine.js?v=33125';
import{ensureVenueSettings,ensureVenueQueues,venuePreset,buildVenueCourts,prelimVenues,mainVenues}from'./venue-engine.js?v=33125';
import{moveQueueItem,reorderQueueItem}from'./queue-control-engine.js?v=33125';
import{availableCourtSlots,assignQueueMatchToCourt,returnWait1ToVenueQueue}from'./manual-court-engine.js?v=33125';

import{ensureCourtStatuses,pauseCourt,resumeCourt}from'./court-status-engine.js?v=33125';
import{ensureCourtManualQueues,assignToCourtManualQueue,moveCourtMatchFlexible,returnManualQueueItemToVenue,reorderCourtManualQueue}from'./court-manual-queue-engine.js?v=33125';
import{reorderPrelimQueue as reorderPrelimQueueItem,movePrelimQueuedMatch,returnPrelimWait1ToQueue}from'./prelim-queue-control-engine.js?v=33125';
import{ensurePrelimCourtStatuses,pausePrelimCourt,resumePrelimCourt}from'./prelim-court-status-engine.js?v=33125';
import{startStateSync,getSyncSettings,saveSyncSettings,connectCloudSync,disconnectCloudSync,pushStateNow,pullStateNow}from'./sync-engine.js?v=33125';
import{verifyAndRepairMainFlow}from'./main-flow-integrity-engine.js?v=33125';

let state=loadState();ensurePrelimState(state);ensureTimeState(state);ensureDrawMeta(state);ensureMessagingState(state);ensureContacts(state);ensureAuditState(state);ensureEarlyMainSettings(state);ensureVenueSettings(state);ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state);ensurePrelimCourtStatuses(state);
function ensureOperatorState(){if(!state.operation||typeof state.operation!=='object')state.operation={};if(state.operation.autoAssignmentEnabled===undefined)state.operation.autoAssignmentEnabled=true;if(!Array.isArray(state.operation.heldMatches))state.operation.heldMatches=[];}
ensureOperatorState();
const ROLE_KEY='230match-v3-session-role';
const ADMIN_PIN_KEY='230match-v3-admin-pin';
let currentRole=sessionStorage.getItem(ROLE_KEY)||'admin';
function adminPin(){return localStorage.getItem(ADMIN_PIN_KEY)||'2300';}
function isAdmin(){return currentRole==='admin';}
function requireAdmin(action='이 작업'){
  if(isAdmin())return true;
  notice(`${action}은 관리자 권한이 필요합니다.`,'error');
  return false;
}
function setRole(role){
  if(role==='admin'&&!isAdmin()){
    const pin=prompt('관리자 PIN을 입력하세요.');
    if(pin!==adminPin()){notice('관리자 PIN이 올바르지 않습니다.','error');return false;}
  }
  currentRole=role==='operator'?'operator':'admin';
  sessionStorage.setItem(ROLE_KEY,currentRole);
  applyRoleUI();
  notice(currentRole==='admin'?'관리자 모드로 전환했습니다.':'진행자 모드로 전환했습니다. 위험한 설정·초기화 기능은 숨겨집니다.','success');
  return true;
}
function changeAdminPin(){
  if(!requireAdmin('관리자 PIN 변경'))return;
  const current=prompt('현재 관리자 PIN을 입력하세요.');
  if(current!==adminPin()){notice('현재 PIN이 올바르지 않습니다.','error');return;}
  const next=prompt('새 관리자 PIN을 4자리 이상 입력하세요.');
  if(!next||next.length<4){notice('PIN은 4자리 이상이어야 합니다.','error');return;}
  localStorage.setItem(ADMIN_PIN_KEY,next);notice('관리자 PIN을 변경했습니다.','success');
}
const ADMIN_ONLY_IDS=['generatePrelimBtn','assignPrelimCourtsBtn','generateLinkedDrawBtn','lockPrelimBtn','unlockPrelimBtn','resetPrelimBtn','lockDrawBtn','resetBtn','applyVenuePresetBtn','clearDrawHistoryBtn','confirmDrawLockBtn','loadSampleBtn','teamFileInput','autoFitPrelimBtn'];
function applyRoleUI(){
  document.body.dataset.role=currentRole;
  const badge=document.getElementById('currentRoleBadge');if(badge)badge.textContent=isAdmin()?'관리자':'진행자';
  const adminBtn=document.getElementById('roleAdminBtn');if(adminBtn)adminBtn.classList.toggle('active',isAdmin());
  const operatorBtn=document.getElementById('roleOperatorBtn');if(operatorBtn)operatorBtn.classList.toggle('active',!isAdmin());
  ADMIN_ONLY_IDS.forEach(id=>{const el=document.getElementById(id);if(!el)return;el.disabled=!isAdmin();el.setAttribute('aria-disabled',String(!isAdmin()));el.title=!isAdmin()?'관리자 전용 기능':'';});
  document.querySelectorAll('[data-admin-only="true"]').forEach(el=>{el.hidden=!isAdmin();});
}
if(linkedDrawNeedsRepair(state)&&!hasStartedMainMatches(state)){
  try{
    const repaired=rebuildLinkedDraw(state,state.settings.drawSize||64);
    saveState(state);
    console.info(`[230MATCH V3] linked draw repaired · ${repaired.slots} slots`);
  }catch(error){
    console.warn('[230MATCH V3] linked draw auto repair skipped',error);
  }
}
const $=id=>document.getElementById(id);
const setValue=(id,value)=>{const el=$(id);if(el)el.value=value;};
const setChecked=(id,value)=>{const el=$(id);if(el)el.checked=Boolean(value);};
const getValue=(id,fallback='')=>{const el=$(id);return el?el.value:fallback;};
const getChecked=(id,fallback=false)=>{const el=$(id);return el?el.checked:fallback;};
function log(message){state.logs.unshift({at:new Date().toISOString(),message});state.logs=state.logs.slice(0,300);}
function commit(message){
  if(message)log(message);if(state.settings.autoTimeEnabled)calculateTimeMetrics(state);syncInputs();saveState(state);render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});updateSetupProgress();renderOperatorControls();applyRoleUI();flashSaved();
}

function applySynchronizedState(nextState,source='동기화'){
  if(!nextState||typeof nextState!=='object')return;
  state=structuredClone(nextState);
  ensurePrelimState(state);ensureTimeState(state);ensureDrawMeta(state);ensureMessagingState(state);ensureContacts(state);ensureAuditState(state);ensureEarlyMainSettings(state);ensureVenueSettings(state);ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state);ensurePrelimCourtStatuses(state);ensureOperatorState();
  if(state.settings.autoTimeEnabled)calculateTimeMetrics(state);
  syncInputs();syncPrelimInputs();saveState(state);
  render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});
  updateSetupProgress();renderOperatorControls();applyRoleUI();flashSaved();
  notice(`${source} 상태를 반영했습니다.`,'success');
}
function updateSyncPanel(status={}){
  const badge=$('syncStatusBadge');if(badge){badge.textContent=status.label||'로컬 저장';badge.className=`badge ${status.level==='success'?'badge-safe':status.level==='error'?'badge-danger':'badge-muted'}`;}
  const detail=$('syncStatusDetail');if(detail)detail.textContent=status.detail||'이 브라우저에 자동 저장됩니다.';
}
function loadSyncPanel(){
  const cfg=getSyncSettings();
  setChecked('cloudSyncEnabled',cfg.enabled===true);setValue('syncRoomId',cfg.roomId||'');setValue('firebaseConfigJson',cfg.firebaseConfigText||'');
}
function collectSyncPanel(){return{enabled:getChecked('cloudSyncEnabled',false),roomId:String(getValue('syncRoomId','')).trim(),firebaseConfigText:String(getValue('firebaseConfigJson','')).trim()};}
async function saveAndConnectSync(){
  if(!requireAdmin('실시간 동기화 설정'))return;
  const cfg=collectSyncPanel();saveSyncSettings(cfg);
  if(!cfg.enabled){disconnectCloudSync();updateSyncPanel({label:'로컬 저장',detail:'클라우드 동기화가 꺼져 있습니다.'});notice('동기화 설정을 저장했습니다.','success');return;}
  try{await connectCloudSync();notice('Firebase 실시간 동기화를 연결했습니다.','success');}catch(error){updateSyncPanel({label:'연결 실패',level:'error',detail:error.message});notice(error.message,'error');}
}

function syncInputs(){
  setValue('tournamentName',state.tournament.name);
  setValue('divisionName',state.tournament.division);
  setValue('drawSize',String(state.settings.drawSize));
  const prelimSummary=prelimVenues(state).map(v=>`${v.name} ${v.courtCount}면`).join(' + ');
  const mainSummary=mainVenues(state).map(v=>`${v.name} ${v.courtCount}면`).join(' + ');
  setValue('courtCount',`${mainVenues(state).reduce((sum,v)=>sum+v.courtCount,0)}면`);
  setValue('operationVenueSummary',`예선 ${prelimSummary} / 본선 ${mainSummary}`);
  setValue('matchMinutes',state.settings.matchMinutes||40);
  setValue('minimumMatchMinutes',state.settings.minimumMatchMinutes||30);
  setChecked('autoTimeEnabled',state.settings.autoTimeEnabled!==false);
  setValue('timeRefreshSeconds',String(state.settings.timeRefreshSeconds||30));
  setValue('drawMethod',state.settings.drawMethod||'instant');
  setValue('byePriority',state.settings.byePriority||'group-first');setValue('venueAssignmentPolicy',state.settings.venueAssignmentPolicy||'round-robin');setChecked('separateVenueQueues',state.settings.separateVenueQueues!==false);setChecked('autoVenuePromotion',state.settings.autoVenuePromotion!==false);setChecked('autoMessageEnabled',state.messaging.settings.autoMessageEnabled!==false);setValue('messageSenderName',state.messaging.settings.senderName||'230MATCH');setValue('messageDeliveryMode',state.messaging.settings.deliveryMode||'sms-uri');setChecked('messageOnCourtAssign',state.messaging.settings.onCourtAssign!==false);setChecked('messageOnQueueMove',state.messaging.settings.onQueueMove!==false);setChecked('smartMessageUpdate',state.messaging.settings.smartMessageUpdate!==false);setValue('messageRepeatPolicy',state.messaging.settings.repeatPolicy||'update-pending');setValue('templatePlaying',state.messaging.settings.templates.playing||'');setValue('templateWait1',state.messaging.settings.templates.wait1||'');setValue('templateShared',state.messaging.settings.templates.shared||'');
}
function pullSettings(){
  state.tournament.name=String(getValue('tournamentName',state.tournament.name)||'').trim()||'대회명 없음';
  state.tournament.division=String(getValue('divisionName',state.tournament.division)||'').trim()||'부서 없음';
  state.settings.drawSize=Number(getValue('drawSize',state.settings.drawSize||64));
  const selectedMainVenues=mainVenues(state);
  state.settings.courtCount=selectedMainVenues.reduce((sum,v)=>sum+v.courtCount,0);
  state.settings.courtPrefix=selectedMainVenues[0]?.courtPrefix||'코트';
  state.settings.minimumMatchMinutes=Math.max(20,Number(getValue('minimumMatchMinutes',state.settings.minimumMatchMinutes||30))||30);
  state.settings.matchMinutes=Math.max(state.settings.minimumMatchMinutes,Number(getValue('matchMinutes',state.settings.matchMinutes||40))||40);
  state.settings.autoTimeEnabled=getChecked('autoTimeEnabled',state.settings.autoTimeEnabled!==false);
  state.settings.autoIncrementalMainEnabled=getChecked('autoIncrementalMainEnabled',state.settings.autoIncrementalMainEnabled!==false);
  state.settings.timeRefreshSeconds=Number(getValue('timeRefreshSeconds',state.settings.timeRefreshSeconds||30))||30;
  state.settings.drawMethod=getValue('drawMethod',state.settings.drawMethod||'instant');
  state.settings.byePriority=getValue('byePriority',state.settings.byePriority||'group-first');state.settings.venueAssignmentPolicy=getValue('venueAssignmentPolicy',state.settings.venueAssignmentPolicy||'round-robin');state.settings.separateVenueQueues=getChecked('separateVenueQueues',state.settings.separateVenueQueues!==false);state.settings.autoVenuePromotion=getChecked('autoVenuePromotion',state.settings.autoVenuePromotion!==false);state.messaging.settings.autoMessageEnabled=getChecked('autoMessageEnabled',state.messaging.settings.autoMessageEnabled!==false);state.messaging.settings.senderName=getValue('messageSenderName',state.messaging.settings.senderName||'230MATCH');state.messaging.settings.deliveryMode=getValue('messageDeliveryMode',state.messaging.settings.deliveryMode||'sms-uri');state.messaging.settings.onCourtAssign=getChecked('messageOnCourtAssign',state.messaging.settings.onCourtAssign!==false);state.messaging.settings.onQueueMove=getChecked('messageOnQueueMove',state.messaging.settings.onQueueMove!==false);state.messaging.settings.smartMessageUpdate=getChecked('smartMessageUpdate',state.messaging.settings.smartMessageUpdate!==false);state.messaging.settings.repeatPolicy=getValue('messageRepeatPolicy',state.messaging.settings.repeatPolicy||'update-pending');state.messaging.settings.templates.playing=getValue('templatePlaying',state.messaging.settings.templates.playing);state.messaging.settings.templates.wait1=getValue('templateWait1',state.messaging.settings.templates.wait1);state.messaging.settings.templates.shared=getValue('templateShared',state.messaging.settings.templates.shared);
}

function autoRecovery(label){
  try{saveRecovery(state,`자동 · ${label}`);}catch(error){console.warn('자동 복구점 저장 실패',error);}
}
function locateAndRemoveMainMatch(matchId){
  let location=null;
  for(const c of state.prelim?.courts||[]){
    if(c.playing===matchId)return{blocked:true,reason:'시합 중인 경기는 보류할 수 없습니다.'};
    if(c.wait1===matchId){location={type:'wait1',courtId:c.id,venueId:c.venueId};c.wait1=null;}
    c.queue=Array.isArray(c.queue)?c.queue:[];
    const qi=c.queue.indexOf(matchId);if(qi>=0){location={type:'courtQueue',courtId:c.id,venueId:c.venueId,index:qi};c.queue.splice(qi,1);}
    c.manualQueue=Array.isArray(c.manualQueue)?c.manualQueue:[];
    const mi=c.manualQueue.indexOf(matchId);if(mi>=0){location={type:'manualQueue',courtId:c.id,venueId:c.venueId,index:mi};c.manualQueue.splice(mi,1);}
  }
  for(const [venueId,q] of Object.entries(state.venueQueues||{})){
    const i=q.indexOf(matchId);if(i>=0){location={type:'venueQueue',venueId,index:i};q.splice(i,1);}
  }
  const si=(state.sharedQueue||[]).indexOf(matchId);if(si>=0){location={type:'sharedQueue',index:si};state.sharedQueue.splice(si,1);}
  return{blocked:false,location};
}
function holdMainMatch(matchId){
  const m=findMatch(state.draw,matchId);if(!m)return;
  ensureOperatorState();
  if(state.operation.heldMatches.some(x=>x.matchId===matchId))return;
  const reason=prompt('보류 사유를 입력하세요.','선수 도착 지연')||'운영자 보류';
  autoRecovery(`경기 보류 전 · ${matchId}`);
  const removed=locateAndRemoveMainMatch(matchId);if(removed.blocked){notice(removed.reason,'error');return;}
  state.operation.heldMatches.push({matchId,reason,heldAt:new Date().toISOString(),location:removed.location,previousStatus:m.status,venueId:m.venueId||removed.location?.venueId||null});
  m.status='held';m.holdReason=reason;m.waitStartedAt=null;m.court=null;m.courtId=null;
  commit(`본선 경기 보류 · ${matchId} · ${reason}`);notice('경기를 보류했습니다. 자동배정 대상에서 제외됩니다.','success');
}
function releaseHeldMatch(matchId){
  ensureOperatorState();
  const index=state.operation.heldMatches.findIndex(x=>x.matchId===matchId);if(index<0)return;
  autoRecovery(`경기 보류 해제 전 · ${matchId}`);
  const held=state.operation.heldMatches.splice(index,1)[0];const m=findMatch(state.draw,matchId);if(!m)return;
  delete m.holdReason;m.status='ready';m.waitStartedAt=new Date().toISOString();
  const venueId=held.venueId||Object.keys(state.venueQueues||{})[0]||state.prelim?.courts?.[0]?.venueId;
  if(venueId){if(!Array.isArray(state.venueQueues[venueId]))state.venueQueues[venueId]=[];state.venueQueues[venueId].push(matchId);m.status='venue_shared_queue';m.venueId=venueId;}
  commit(`본선 경기 보류 해제 · ${matchId}`);notice('보류를 해제하고 공용대기 맨 뒤로 복귀했습니다.','success');
}
function renderOperatorControls(){
  ensureOperatorState();
  const toggle=$('globalAutoAssignToggle');if(toggle){toggle.textContent=state.operation.autoAssignmentEnabled?'전체 자동배정 ON':'전체 자동배정 OFF';toggle.className=`btn ${state.operation.autoAssignmentEnabled?'btn-primary':'btn-danger-outline'}`;}
  const count=$('heldMatchCount');if(count)count.textContent=String(state.operation.heldMatches.length);
  const list=$('heldMatchList');if(list){list.innerHTML=state.operation.heldMatches.length?state.operation.heldMatches.map(x=>{const m=findMatch(state.draw,x.matchId);return`<article class="held-match-item"><div><b>${m?`${teamText(m.teamA)} vs ${teamText(m.teamB)}`:x.matchId}</b><span>${x.reason} · ${new Date(x.heldAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</span></div><button class="btn btn-light" data-release-held="${x.matchId}">보류 해제</button></article>`}).join(''):'<div class="empty-state"><p>보류된 본선 경기가 없습니다.</p></div>';list.querySelectorAll('[data-release-held]').forEach(b=>b.onclick=()=>releaseHeldMatch(b.dataset.releaseHeld));}
}
function notice(message,type='info'){$('noticeBar').className=`notice ${type}`;$('noticeBar').textContent=message;}
function flashSaved(){$('saveStateBadge').textContent='자동 저장됨';setTimeout(()=>$('saveStateBadge').textContent='자동 저장 ON',1200);}
async function loadSample(){
  const res=await fetch('./data/test-teams-100.json?v=3001');if(!res.ok)throw new Error('테스트 명단을 불러오지 못했습니다.');
  const data=await res.json();state.teams=prepareTeams(data,128);ensureContacts(state);commit(`테스트 명단 ${state.teams.length}팀 불러오기`);notice(`${state.teams.length}팀을 불러왔습니다. 새 본선 추첨을 실행하세요.`,'success');
}
async function readTeamFile(file){
  const data=JSON.parse(await file.text());state.teams=prepareTeams(data,128);ensureContacts(state);commit(`JSON 명단 ${state.teams.length}팀 불러오기`);notice(`${state.teams.length}팀을 불러왔습니다.`,'success');
}

function runDrawMethod(method){
  $('drawMethod').value=method;
  state.settings.drawMethod=method;
  generate();
}

function generate(){
  if(shouldUseLinkedDraw(state))throw new Error('예선 진행 대회는 일반 본선 추첨이 아니라 “예선 슬롯으로 본선 선추첨”을 사용하세요.');
  pullSettings();
  const check=canModifyDraw(state);if(!check.ok&&state.draw.size)throw new Error(check.reason);
  if(state.settings.drawMethod==='roulette'){openRoulette();return;}
  state.draw=createDrawWithMethod(state,state.teams,state.settings.drawSize,{method:state.settings.drawMethod,byePriority:state.settings.byePriority});
  state.courts=[];state.sharedQueue=[];
  commit(`${state.draw.size}강 ${state.settings.drawMethod==='seeded'?'시드 분산':'즉시'} 추첨 · ${allMatches(state.draw).length}경기`);
  notice(`${state.draw.size}강 대진을 생성했습니다. 코트배정을 실행하세요.`,'success');
}

let rouletteTimer=null,roulettePreparedTeams=[];
function openRoulette(){
  if(shouldUseLinkedDraw(state))throw new Error('예선 진행 대회는 일반 본선 추첨이 아니라 “예선 슬롯으로 본선 선추첨”을 사용하세요.');
  if(state.teams.length<2)throw new Error('최소 2팀이 필요합니다.');
  roulettePreparedTeams=[...state.teams];
  $('rouletteTeamName').textContent='추첨 준비';
  $('rouletteProgress').textContent=`0 / ${roulettePreparedTeams.length}`;
  $('rouletteResultList').innerHTML='';
  $('rouletteDialog').showModal();
}
function startRoulette(){
  clearInterval(rouletteTimer);
  const ring=$('rouletteDialog').querySelector('.roulette-ring');ring.classList.add('spinning');
  let ticks=0;
  rouletteTimer=setInterval(()=>{
    const team=roulettePreparedTeams[Math.floor(Math.random()*roulettePreparedTeams.length)];
    $('rouletteTeamName').textContent=teamText(team);
    ticks++;
    $('rouletteProgress').textContent=`${Math.min(ticks,roulettePreparedTeams.length)} / ${roulettePreparedTeams.length}`;
    if(ticks>=Math.min(roulettePreparedTeams.length,36)){
      clearInterval(rouletteTimer);ring.classList.remove('spinning');finishRoulette();
    }
  },90);
}
function finishRoulette(){
  if(shouldUseLinkedDraw(state))throw new Error('예선 진행 대회는 일반 본선 추첨이 아니라 “예선 슬롯으로 본선 선추첨”을 사용하세요.');
  state.draw=createDrawWithMethod(state,state.teams,state.settings.drawSize,{method:'roulette',byePriority:state.settings.byePriority});
  state.courts=[];state.sharedQueue=[];
  const first=state.draw.rounds[state.draw.size]||[];
  $('rouletteResultList').innerHTML=first.slice(0,12).map((m,i)=>`<div>${i+1}. ${teamText(m.teamA)} vs ${teamText(m.teamB)}</div>`).join('');
  $('rouletteTeamName').textContent='추첨 완료';
  $('rouletteProgress').textContent=`${state.teams.length}팀 배치 완료`;
  commit(`${state.draw.size}강 룰렛 추첨 · ${allMatches(state.draw).length}경기`);
  notice('룰렛 추첨을 완료했습니다.','success');
  setTimeout(()=>$('rouletteDialog').close(),900);
}
function reshuffle(){
  if(shouldUseLinkedDraw(state))throw new Error('예선 진행 대회는 일반 본선 추첨이 아니라 “예선 슬롯으로 본선 선추첨”을 사용하세요.');
  pullSettings();const check=canModifyDraw(state);if(!check.ok)throw new Error(check.reason);
  if(!state.draw.size)throw new Error('재추첨할 본선 대진이 없습니다.');
  if(state.settings.drawMethod==='roulette'){openRoulette();return;}
  state.draw=createDrawWithMethod(state,state.teams,state.settings.drawSize,{method:state.settings.drawMethod,byePriority:state.settings.byePriority});
  state.courts=[];state.sharedQueue=[];
  commit(`본선 재추첨 · ${state.settings.drawMethod} · 체크섬 ${state.drawMeta.checksum}`);
  notice('본선 대진을 다시 추첨했습니다.','success');
}
function openDrawLockDialog(){
  if(!state.draw?.size)throw new Error('잠글 본선 대진이 없습니다.');
  if(state.drawMeta.locked)throw new Error('이미 본선 대진이 잠겨 있습니다.');
  $('drawLockConfirmCheck').checked=false;
  $('confirmDrawLockBtn').disabled=true;
  $('lockDialogDrawSize').textContent=`${state.draw.size}강`;
  $('lockDialogMethod').textContent=({instant:'즉시 추첨',roulette:'룰렛 추첨',seeded:'시드 분산'})[state.drawMeta.method]||'-';
  $('lockDialogChecksum').textContent=state.drawMeta.checksum||'-';
  $('drawLockDialog').showModal();
}
function confirmDrawLock(event){
  event.preventDefault();
  if(!$('drawLockConfirmCheck').checked)return;
  lockDraw(state);
  commit(`본선 대진 잠금 · 체크섬 ${state.drawMeta.checksum}`);
  $('drawLockDialog').close();
  notice('본선 대진을 잠갔습니다. 재추첨은 차단되고 경기 운영은 계속할 수 있습니다.','success');
}
function openDrawUnlockDialog(){
  if(!state.drawMeta.locked)throw new Error('현재 본선 대진은 잠겨 있지 않습니다.');
  $('unlockConfirmText').value='';
  $('confirmDrawUnlockBtn').disabled=true;
  $('drawUnlockDialog').showModal();
}
function confirmDrawUnlock(event){
  event.preventDefault();
  if($('unlockConfirmText').value.trim()!=='잠금해제')return;
  unlockDrawForDevelopment(state);
  commit('관리자 본선 대진 잠금 해제');
  $('drawUnlockDialog').close();
  notice('본선 대진 잠금을 해제했습니다. 경기가 시작되기 전에만 재추첨하세요.','success');
}

function assign(){
  pullSettings();ensureOperatorState();
  if(!state.operation.autoAssignmentEnabled){notice('전체 자동배정이 일시정지되어 있습니다. 수동 배정은 코트·공용대기 카드에서 진행할 수 있습니다.','error');return;}
  autoRecovery('본선 코트배정 전');
  if(!state.draw.size)throw new Error('먼저 예선 슬롯으로 본선 대진을 생성하세요.');
  markResolvedMainMatchesReady(state);
  if(useUnifiedCourts(state)){
    const result=enqueueReadyMainToUnifiedCourts(state);
    const queued=Object.values(state.venueQueues||{}).reduce((n,q)=>n+(q?.length||0),0);
    const repaired=result.repair?.totalRemoved||0;
    const active=(state.prelim?.courts||[]).reduce((n,c)=>n+(c.playing?1:0)+(c.wait1?1:0),0);
    if(!result.assigned){
      commit(`확정 본선 코트배정 확인 · 신규 0경기 · 운영중/대기1 ${active}경기 · 공용대기 ${queued}경기 · 큐정리 ${repaired}건`);
      notice(result.reason==='play-in-gate'
        ?`똥통 예비전이 남아 있어 64강 배정을 보류했습니다. 현재 코트·대기1 ${active}경기, 공용대기 ${queued}경기입니다.`
        :`새로 배정할 경기가 없습니다. 확정 경기는 이미 자동 배정되어 있습니다. 현재 코트·대기1 ${active}경기, 공용대기 ${queued}경기입니다.${repaired?` 중복·무효 큐 ${repaired}건을 자동 정리했습니다.`:''}`,'success');
      return;
    }
    commit(`예선·본선 통합 코트배정 · 신규 본선 ${result.assigned}경기 · 큐정리 ${repaired}건`);
    notice(`확정 본선 ${result.assigned}경기를 배정했습니다.${result.playInOnly?' 똥통 예비전 완료 전까지 64강은 대기합니다.':''}${repaired?` 중복·무효 큐 ${repaired}건을 자동 정리했습니다.`:''}`,'success');
    return;
  }
  const check=canAssignEarlyMain(state);
  if(!check.ok)throw new Error(check.reason);
  ensureVenueSettings(state);
  state.courts=buildVenueCourts(mainVenues(state));
  state.sharedQueue=assignInitial(state.draw,state.courts,state);
  commit('본선 전용 코트배정');
  notice('예선 코트가 없어 본선 전용 코트로 배정했습니다.','success');
}
function openResult(matchId){
  const m=findMatch(state.draw,matchId);if(!m)return;
  $('resultMatchId').value=matchId;$('resultMatchLabel').textContent=`${teamText(m.teamA)} vs ${teamText(m.teamB)}`;
  $('winnerSelect').innerHTML=`<option value="${m.teamA.id}">${teamText(m.teamA)}</option><option value="${m.teamB.id}">${teamText(m.teamB)}</option>`;
  $('scoreA').value=6;$('scoreB').value=3;$('resultDialog').showModal();
}
function confirmResult(event){
  event.preventDefault();
  autoRecovery('경기 결과 입력 전');
  const id=$('resultMatchId').value;
  const sourceCourt=[...(state.prelim?.courts||[]),...(state.courts||[])].find(c=>c.playing===id);const beforePlaying=sourceCourt?.playing||null,beforeWait1=sourceCourt?.wait1||null;
  const m=submitResult(state,{matchId:id,winnerId:$('winnerSelect').value,scoreA:$('scoreA').value,scoreB:$('scoreB').value});
  const flowReport=verifyAndRepairMainFlow(state,{sourceMatchId:id});
  const isUnifiedCourt=Boolean(sourceCourt&&(state.prelim?.courts||[]).some(c=>c.id===sourceCourt.id));
  if(isUnifiedCourt){
    advanceUnifiedCourt(state,sourceCourt.id,id);
    // 예비전 또는 본선 결과로 새로 확정된 다음 라운드 경기를 즉시 구장 공용대기에 연결합니다.
    enqueueReadyMainToUnifiedCourts(state);
  }
  if(sourceCourt&&state.messaging.settings.autoMessageEnabled&&state.messaging.settings.onQueueMove){if(sourceCourt.playing&&sourceCourt.playing!==beforePlaying)generatePlayingMessages(state,sourceCourt.playing,sourceCourt.name);if(sourceCourt.wait1&&sourceCourt.wait1!==beforeWait1)generateWait1Messages(state,sourceCourt.wait1,sourceCourt.name)}
  commit(`결과 확정 · ${m.id} · 승리 ${teamText(m.winner)} · ${m.scoreA}:${m.scoreB}`);
  $('resultDialog').close();
  const flowText=flowReport.nextMatchId?(flowReport.nextReady?' 다음 라운드 경기가 확정되어 자동 대기열에 연결됩니다.':' 다음 라운드는 상대 결과를 기다립니다.'):' 최종 경기 결과가 반영되었습니다.';
  notice(`결과와 대진표·코트 큐를 동기화했습니다.${flowText}${flowReport.propagated||flowReport.statusFixed?` 연결 보정 ${flowReport.propagated+flowReport.statusFixed}건.`:''}`,'success');
}
function refreshQueue(){
  queueReadyMatches(state,id=>findMatch(state.draw,id));commit('준비 경기 큐 재정렬');notice('준비 경기 큐를 재정렬했습니다.','success');
}

function prelimNotice(message,type='info'){$('prelimNoticeBar').className=`notice ${type}`;$('prelimNoticeBar').textContent=message;}
function pullPrelimSettings(){
  ensurePrelimState(state);
  state.prelim.settings.activeTeamCount=Number($('prelimActiveTeamCount').value);
  state.prelim.settings.threeTeamGroups=Number($('threeTeamGroupCount').value);
  state.prelim.settings.twoTeamGroups=Number($('twoTeamGroupCount').value);
  const selectedPrelimVenues=prelimVenues(state);
  state.prelim.settings.courtCount=selectedPrelimVenues.reduce((sum,v)=>sum+v.courtCount,0);
  state.prelim.settings.courtPrefix=selectedPrelimVenues[0]?.courtPrefix||'코트';
  state.prelim.settings.qualifiersPerGroup=Number($('qualifiersPerGroup').value);
}
function syncPrelimInputs(){
  ensurePrelimState(state);
  $('prelimActiveTeamCount').value=state.prelim.settings.activeTeamCount;
  $('threeTeamGroupCount').value=state.prelim.settings.threeTeamGroups;
  $('twoTeamGroupCount').value=state.prelim.settings.twoTeamGroups;
  $('prelimVenueSummary').value=prelimVenues(state).map(v=>`${v.name} ${v.courtCount}면`).join(' + ');
  $('prelimCourtCountSummary').value=`${prelimVenues(state).reduce((sum,v)=>sum+v.courtCount,0)}면`;
  $('qualifiersPerGroup').value=String(state.prelim.settings.qualifiersPerGroup);
}

function autoFitPrelim(){
  const total=Number($('prelimActiveTeamCount').value);
  const fit=autoFitPrelimGroups(total);
  $('threeTeamGroupCount').value=fit.threeTeamGroups;
  $('twoTeamGroupCount').value=fit.twoTeamGroups;
  pullPrelimSettings();
  commit(`예선 사용팀 ${total}팀 기준 조 자동계산 · 3팀조 ${fit.threeTeamGroups} · 2팀조 ${fit.twoTeamGroups}`);
  prelimNotice(`3팀조 ${fit.threeTeamGroups}개, 2팀조 ${fit.twoTeamGroups}개로 계산했습니다.`,'success');
}
let pendingActiveSwapId=null;
let reserveSwapMode=false;

function assertPrelimUnlocked(action='이 작업'){
  if(isPrelimLocked(state))throw new Error(`예선이 최종확정·잠금 상태라 ${action}을 할 수 없습니다.`);
}

function selectActiveSwap(teamId){
  try{assertPrelimUnlocked('후보교체');}catch(e){prelimNotice(e.message,'error');return;}
  reserveSwapMode=true;
  pendingActiveSwapId=teamId;
  state.prelim.swapSelection={activeTeamId:teamId};
  const btn=$('swapReserveBtn');if(btn){btn.classList.add('swap-mode-active');btn.textContent='후보팀을 선택하세요';}
  prelimNotice('교체할 후보팀의 선택 버튼을 누르세요.','info');
  commit();
}
function selectReserveSwap(teamId){
  try{assertPrelimUnlocked('후보교체');}catch(e){prelimNotice(e.message,'error');return;}
  if(!pendingActiveSwapId){prelimNotice('먼저 예선 참가팀에서 교체 버튼을 누르세요.','error');return;}
  try{
    const result=swapActiveReserveTeam(state,pendingActiveSwapId,teamId);
    pendingActiveSwapId=null;reserveSwapMode=false;state.prelim.swapSelection=null;
    const swapBtn=$('swapReserveBtn');if(swapBtn){swapBtn.classList.remove('swap-mode-active');swapBtn.textContent='후보 교체 모드';}
    commit(`예선 참가팀 교체 · 제외 ${teamText(result.activeOut)} · 투입 ${teamText(result.reserveIn)}`);
    prelimNotice('참가팀과 후보팀을 교체했습니다. 조편성을 다시 생성하세요.','success');
  }catch(e){prelimNotice(e.message,'error');}
}

function createPrelim(){
  assertPrelimUnlocked('조편성 생성');
  pullPrelimSettings();
  const result=generatePrelim(state,state.prelim.settings);
  if(state.draw?.size&&!state.prelim.linkedDraw?.active&&!hasStartedMainMatches(state)){
    state.draw={size:0,rounds:{}};state.courts=[];state.sharedQueue=[];
  }
  commit(`예선 조편성 생성 · ${result.groups}조 · ${result.matches}경기 · ${result.teams}팀`);
  prelimNotice(`${result.groups}개 조와 ${result.matches}경기를 생성했습니다.`,'success');
}
function assignPrelim(){
  assertPrelimUnlocked('코트배정');
  pullPrelimSettings();
  const courts=assignPrelimCourts(state);
  const venueSummary=prelimVenues(state).map(v=>`${v.name} ${v.courtCount}면`).join(' + ');
  commit(`예선 코트별 연속 조 묶음 배정 · ${venueSummary}`);
  prelimNotice(`예선 구장 ${venueSummary}에 1조부터 순서대로 배정하고 시합중·대기1·추가대기를 구성했습니다.`,'success');
}
function openPrelimResult(matchId){
  try{assertPrelimUnlocked('결과 입력');}catch(e){prelimNotice(e.message,'error');return;}
  const m=findPrelimMatch(state,matchId);if(!m)return;
  $('prelimResultMatchId').value=matchId;
  $('prelimResultMatchLabel').textContent=`${teamText(m.teamA)} vs ${teamText(m.teamB)}`;
  $('prelimWinnerSelect').innerHTML=`<option value="${m.teamA.id}">${teamText(m.teamA)}</option><option value="${m.teamB.id}">${teamText(m.teamB)}</option>`;
  $('prelimScoreA').value=m.scoreA??6;$('prelimScoreB').value=m.scoreB??3;
  $('prelimResultDialog').showModal();
}
function confirmPrelimResult(event){
  event.preventDefault();
  const m=submitPrelimResult(state,{matchId:$('prelimResultMatchId').value,winnerId:$('prelimWinnerSelect').value,scoreA:$('prelimScoreA').value,scoreB:$('prelimScoreB').value});
  const syncResult=syncLinkedDraw({silent:true});
  const autoResult=useUnifiedCourts(state)
    ?enqueueReadyMainToUnifiedCourts(state)
    :autoAssignResolvedMain(state,{findMatch,queueReadyMatches,refillCourt});
  if((autoResult.assigned===true||Number(autoResult.assigned)>0)&&state.messaging.settings.autoMessageEnabled){
    generateCurrentCourtMessages(state);generateCurrentWaitMessages(state);
  }
  commit(`예선 결과 확정 · ${m.id} · 승리 ${teamText(m.winner)} · ${m.scoreA}:${m.scoreB}${syncResult.changes.length?` · 본선 자동반영 ${syncResult.changes.length}팀`:''}${autoResult.newlyReady?` · 신규 확정 ${autoResult.newlyReady}경기`:''}${autoResult.assigned?' · 통합 코트 자동배정':''}`);
  $('prelimResultDialog').close();
  prelimNotice(autoResult.assigned
    ?'예선 순위 반영 후 새 본선 경기를 기존 코트 운영에 자동 추가했습니다.'
    :autoResult.reason==='no-courts'
      ?'본선 팀은 확정됐습니다. 최초 본선 코트배정을 실행하면 운영이 시작됩니다.'
      :'예선 순위와 진출팀을 다시 계산했습니다.','success');
}
function resetPrelimOnly(){
  if(!requireAdmin('예선 초기화'))return;
  try{assertPrelimUnlocked('예선 초기화');}catch(e){prelimNotice(e.message,'error');return;}
  if(!confirm('예선 조편성·결과·순위를 모두 초기화할까요?'))return;
  resetPrelim(state);commit('예선만 초기화');prelimNotice('예선 데이터를 초기화했습니다.','info');
}
function useQualifiersForDraw(){
  ensurePrelimState(state);
  if(!state.prelim.qualifiers.length)throw new Error('확정된 예선 진출팀이 없습니다.');
  state.teams=structuredClone(state.prelim.qualifiers);
  commit(`예선 진출팀 ${state.teams.length}팀을 본선 명단으로 전환`);
  notice(`예선 진출팀 ${state.teams.length}팀을 본선 명단으로 사용합니다.`,'success');
  document.querySelector('[data-view="operation"]').click();
}



function finalizeAndLockPrelim(){
  const lock=lockPrelim(state,{lockedBy:'관리자'});
  const syncResult=syncLinkedDraw({silent:true});
  commit(`예선 최종확정·잠금 · ${state.prelim.matches.length}경기 · 진출 ${state.prelim.qualifiers.length}팀${syncResult.changes.length?` · 본선 반영 ${syncResult.changes.length}팀`:''}`);
  prelimNotice(`예선 결과를 최종확정하고 잠갔습니다. 진출팀 ${state.prelim.qualifiers.length}팀이 보호됩니다.`,'success');
}
function adminUnlockPrelim(){
  if(!requireAdmin('예선 잠금 해제'))return;
  if(!isPrelimLocked(state)){prelimNotice('예선은 이미 잠금 해제 상태입니다.','info');return;}
  const phrase=prompt('잠금 해제를 위해 "예선잠금해제"를 입력하세요.');
  if(phrase!=='예선잠금해제'){prelimNotice('잠금 해제를 취소했습니다.','info');return;}
  unlockPrelim(state);
  commit('관리자 예선 잠금 해제');
  prelimNotice('예선 잠금을 해제했습니다. 결과 수정 후 다시 최종확정하세요.','error');
}

function createLinkedDraw(){
  pullPrelimSettings();
  ensurePrelimState(state);
  const slotCount=(state.prelim.groups||[]).length*Number(state.prelim.settings.qualifiersPerGroup||1);
  if(slotCount>128)throw new Error(`본선 슬롯 ${slotCount}개는 지원 최대 규모인 128강을 초과합니다. 조당 진출팀 수 또는 예선 조 수를 줄여야 합니다.`);
  const requiredSize=slotCount<=32?32:slotCount<=64?64:128;
  const selectedSize=Number($('drawSize').value)||64;
  const appliedSize=Math.max(selectedSize,requiredSize);
  const autoExpanded=appliedSize!==selectedSize;
  if(autoExpanded){
    $('drawSize').value=String(appliedSize);
    state.settings.drawSize=appliedSize;
  }
  const result=rebuildLinkedDraw(state,appliedSize);
  markResolvedMainMatchesReady(state);
  commit(`예선 슬롯 본선 선추첨 · ${result.slots}슬롯 · ${state.settings.drawSize}강${autoExpanded?' · 자동확대':''}`);
  prelimNotice(`${autoExpanded?`본선 슬롯 ${slotCount}개에 맞춰 대진 규모를 ${selectedSize}강에서 ${appliedSize}강으로 자동 확대했습니다. `:''}본선 대진을 조 순위 슬롯으로 생성했습니다. 현재 실제 팀 반영 ${result.changes}팀입니다.`,'success');
}
function applyLinkedSyncResult(result){
  if(!state.prelim?.linkedDraw?.active)return;
  result.changes.forEach(change=>{
    const ref=state.prelim.linkedDraw.slots.find(x=>x.placeholderKey===change.placeholderKey);
    if(ref){ref.resolvedTeamId=change.teamId;ref.locked=false;}
  });
  result.locked.forEach(item=>{
    const ref=state.prelim.linkedDraw.slots.find(x=>x.placeholderKey===item.placeholderKey);
    if(ref)ref.locked=true;
  });
  state.prelim.linkedDraw.lastSyncedAt=new Date().toISOString();
}
function syncLinkedDraw({silent=false}={}){
  ensurePrelimState(state);
  if(!state.prelim.linkedDraw.active){
    if(!silent)throw new Error('예선 슬롯으로 생성된 연결 본선 대진이 없습니다.');
    return {changes:[],locked:[]};
  }
  const result=syncLinkedDrawQualifiers(state.draw,state.prelim.qualifiers,{protectStarted:true});
  applyLinkedSyncResult(result);
  if(!silent){
    const refs=state.prelim.linkedDraw?.slots||[];
    const reflected=refs.filter(x=>x.resolvedTeamId).length;
    const pending=Math.max(0,refs.length-reflected);
    commit(`예선 확정팀 본선 반영 · 신규 ${result.changes.length}팀 · 누적 ${reflected}팀 · 미확정 ${pending}팀 · 잠금 ${result.locked.length}팀`);
    prelimNotice(result.changes.length
      ?`새로 확정된 ${result.changes.length}팀을 반영했습니다. 누적 ${reflected}팀 반영, ${pending}팀은 예선 결과 대기입니다.${result.locked.length?` 진행 경기 ${result.locked.length}건은 보호했습니다.`:''}`
      :`추가로 반영할 팀이 없습니다. 현재 확정된 ${reflected}팀은 이미 자동 반영되어 있고, ${pending}팀은 예선 결과 대기입니다.${result.locked.length?` 진행 경기 ${result.locked.length}건은 보호 중입니다.`:''}`,'success');
  }
  return result;
}

function hardReset(){
  if(!requireAdmin('전체 초기화'))return;
  if(!confirm('V3의 현재 명단·대진·결과를 모두 초기화할까요?'))return;
  clearState();state=initialState();commit('전체 초기화');notice('초기화했습니다.','info');
}
function showRecoveries(){
  const root=$('recoveryList'),list=getRecoveries();
  root.innerHTML=list.length?list.map(x=>`<article class="recovery-item"><div><b>${x.label}</b><small>${new Date(x.createdAt).toLocaleString('ko-KR')}</small></div><button class="btn btn-primary" data-restore="${x.id}">복구</button><button class="btn btn-danger-outline" data-delete="${x.id}">삭제</button></article>`).join(''):'<div class="empty-state"><p>저장된 복구점이 없습니다.</p></div>';
  root.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{if(!requireAdmin('복구점 복원'))return;const item=getRecoveries().find(x=>x.id===b.dataset.restore);if(item){state=structuredClone(item.state);commit(`복구점 복원 · ${item.label}`);$('recoveryDialog').close();}});
  root.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(!requireAdmin('복구점 삭제'))return;deleteRecovery(b.dataset.delete);showRecoveries();});
  $('recoveryDialog').showModal();
}

let timeTimer=null;
function refreshTimeEngine({save=false}={}){
  if(state.settings.autoTimeEnabled)calculateTimeMetrics(state);
  if(save)saveState(state);
  render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});
}
function restartTimeTimer(){
  clearInterval(timeTimer);
  const seconds=Math.max(15,Number(state.settings.timeRefreshSeconds)||30);
  timeTimer=setInterval(()=>refreshTimeEngine({save:true}),seconds*1000);
}
function updateClock(){const el=$('currentClock');if(el)el.textContent=new Date().toLocaleTimeString('ko-KR');}

async function copyMessage(id){const item=state.messaging.queue.find(x=>x.id===id);if(!item)return;try{await navigator.clipboard.writeText(item.body);notice('문자 내용을 복사했습니다.','success')}catch{prompt('아래 내용을 복사하세요.',item.body)}}
function openSmsMessage(id){const item=state.messaging.queue.find(x=>x.id===id);if(!item)return;const uri=smsUri(item);if(!uri){notice('전화번호가 없어 문자 앱을 열 수 없습니다.','error');return}window.location.href=uri}
function setMessageSent(id){markMessageSent(state,id);commit('문자 발송완료 표시')}
function removeMessage(id){deleteMessage(state,id);commit('문자 삭제')}
function createCurrentCourtMessages(){const a=generateCurrentCourtMessages(state);commit(`현재 코트 호출 문자 ${a.length}건 생성`);notice(`중복을 제외하고 ${a.length}건을 생성했습니다.`,'success')}
function createCurrentWaitMessages(){const a=generateCurrentWaitMessages(state);commit(`현재 대기1 문자 ${a.length}건 생성`);notice(`중복을 제외하고 ${a.length}건을 생성했습니다.`,'success')}
function createAllTimeMessages(){calculateTimeMetrics(state);const a=generateAllTimeMessages(state);commit(`전체 예상시간 문자 ${a.length}건 생성`);notice(`중복을 제외하고 ${a.length}건을 생성했습니다.`,'success')}


function openContactEdit(teamId){
  const team=state.teams.find(t=>t.id===teamId);if(!team)return;
  const c=getTeamContact(state,team);
  $('contactEditTeamId').value=teamId;$('contactEditTeamName').textContent=`${team.name}${team.affiliation?` · ${team.affiliation}`:''}`;
  $('contactEditPhone').value=c.phone||'';$('contactEditManager').value=c.manager||'';validateContactInput();$('contactEditDialog').showModal();
}
function validateContactInput(){
  const result=validatePhone($('contactEditPhone')?.value||''),box=$('contactPhoneValidation');
  if(box){box.className=`notice ${result.ok?'success':'error'}`;box.textContent=result.message;}
  if($('saveContactBtn'))$('saveContactBtn').disabled=!result.ok;return result;
}
function saveContact(event){
  event.preventDefault();const result=validateContactInput();if(!result.ok)return;
  setTeamContact(state,$('contactEditTeamId').value,{phone:$('contactEditPhone').value,manager:$('contactEditManager').value});
  const refreshed=refreshMessageContacts(state);commit(`팀 연락처 저장 · 문자 발송대기 전환 ${refreshed.converted}건`);
  $('contactEditDialog').close();notice(`연락처를 저장했습니다. 기존 문자 ${refreshed.converted}건이 발송 대기로 전환됐습니다.`,'success');
}
async function importContactsFile(file){
  const data=JSON.parse(await file.text()),result=importContactData(state,data),refreshed=refreshMessageContacts(state);
  commit(`연락처 JSON 불러오기 · ${result.updated}팀 · 문자 전환 ${refreshed.converted}건`);notice(`${result.updated}팀의 연락처를 반영했습니다.`,'success');
}
function reconnectMessagePhones(){
  const result=refreshMessageContacts(state);commit(`문자 연락처 다시 연결 · 전환 ${result.converted}건 · 갱신 ${result.updated}건`);
  notice(`발송 대기로 ${result.converted}건 전환했습니다.`,'success');
}

function openMessageHistory(id){const list=getMessageHistory(state,id),root=$('messageHistoryList');if(!root)return;root.innerHTML=list.length?list.map(x=>`<article class="message-history-item"><time>${new Date(x.at).toLocaleString('ko-KR')} ${x.current?'· 현재 내용':''}</time><p>${x.body}</p></article>`).join(''):'<div class="empty-state"><p>변경 이력이 없습니다.</p></div>';$('messageHistoryDialog').showModal()}
function mergeDuplicates(){const result=mergePendingDuplicates(state);commit(`기존 중복 문자 정리 · ${result.removed}건 제거`);notice(`${result.removed}건의 중복 미발송 문자를 정리했습니다.`,'success')}



function setAuditActionNotice(message,type='info'){
  const el=$('auditActionNotice');
  if(el){el.className=`notice ${type}`;el.textContent=message;}
}
function executeAuditAction(action,label){
  setAuditActionNotice(`${label} 실행 중입니다...`,'info');
  requestAnimationFrame(()=>{
    try{
      action();
    }catch(error){
      console.error('[230MATCH V3 AUDIT]',error);
      setAuditActionNotice(`${label} 실패: ${error?.message||error}`,'error');
    }
  });
}
function runCurrentAudit(){
  const queueRepair=reconcileUnifiedMainQueues(state);
  const audit=runStateAudit(state);
  applyAuditResult(state,audit,null,null);
  commit(`운영 상태 점검 · 통과 ${audit.counts.pass} · 주의 ${audit.counts.warn} · 오류 ${audit.counts.fail} · 큐정리 ${queueRepair.totalRemoved}건`);
  setAuditActionNotice(`현재 상태 점검 완료 · 통과 ${audit.counts.pass} · 주의 ${audit.counts.warn} · 오류 ${audit.counts.fail} · 중복·무효 큐 정리 ${queueRepair.totalRemoved}건`,audit.counts.fail?'error':audit.counts.warn?'info':'success');
}

function runPrelimSimulationAudit(){
  const audit=runStateAudit(state);
  const simulation=runPrelimSimulation(state);
  applyAuditResult(state,audit,null,simulation);
  commit(`예선 복제 모의운영 · ${simulation.completedMatches}/${simulation.totalMatches}경기 · ${simulation.success?'완주':'실패'}`);
  setAuditActionNotice(
    simulation.success
      ?`예선 복제 모의운영 완주 · ${simulation.completedMatches}/${simulation.totalMatches}경기 · ${simulation.rankedGroups}/${simulation.totalGroups}조 순위 확정`
      :`예선 복제 모의운영 실패 · 미완료 ${simulation.unfinished.length}경기`,
    simulation.success?'success':'error'
  );
}

function runSimulationAudit(){
  const audit=runStateAudit(state);
  const simulation=runFullSimulation(state);
  applyAuditResult(state,audit,simulation,null);
  commit(`복제 모의대회 · ${simulation.completedMatches}/${simulation.totalMatches}경기 · ${simulation.success?'완주':'실패'}`);
  setAuditActionNotice(
    simulation.success
      ?`복제 모의대회 완주 · ${simulation.completedMatches}/${simulation.totalMatches}경기 · 우승 ${simulation.winner?.name||'-'}`
      :`복제 모의대회 실패 · 미완료 ${simulation.unfinished.length}경기`,
    simulation.success?'success':'error'
  );
}
function runAllAudit(){
  const audit=runStateAudit(state);
  const prelimSimulation=state.prelim?.groups?.length?runPrelimSimulation(state):null;
  const simulation=state.draw?.size?runFullSimulation(state):null;
  applyAuditResult(state,audit,simulation,prelimSimulation);
  commit(`전체 운영 점검 · 상태 ${state.audit.overall}`);
  setAuditActionNotice(
    `전체 점검 완료 · 통과 ${state.audit.results.filter(x=>x.level==='pass').length} · 주의 ${state.audit.results.filter(x=>x.level==='warn').length} · 오류 ${state.audit.results.filter(x=>x.level==='fail').length}`,
    state.audit.overall==='fail'?'error':state.audit.overall==='warn'?'info':'success'
  );
}
function downloadAudit(){
  if(!state.audit?.lastRunAt)throw new Error('먼저 운영 점검을 실행하세요.');
  downloadJson(`230match-audit-${Date.now()}.json`,{tournament:state.tournament,drawMeta:state.drawMeta,audit:state.audit});
}
function clearAudit(){
  state.audit={lastRunAt:null,overall:'not-run',results:[],simulation:null,prelimSimulation:null};
  commit('운영 점검 결과 삭제');
  setAuditActionNotice('점검 결과를 지웠습니다.','info');
}



function renderVenueSettingsEditor(){
  ensureVenueSettings(state);
  const root=$('venueSettingsList');if(!root)return;
  root.innerHTML=state.settings.venues.map((v,i)=>`<article class="venue-row" data-venue-index="${i}">
    <label><span>구장명</span><input data-field="name" value="${v.name}"></label>
    <label><span>코트 수</span><input data-field="courtCount" type="number" min="1" max="32" value="${v.courtCount}"></label>
    <label class="venue-prefix"><span>코트명 접두어</span><input data-field="courtPrefix" value="${v.courtPrefix}"></label>
    <div class="venue-scope-options">
      <label><input data-field="usePrelim" type="checkbox" ${v.usePrelim!==false?'checked':''}><span>예선 사용</span></label>
      <label><input data-field="useMain" type="checkbox" ${v.useMain!==false?'checked':''}><span>본선 사용</span></label>
    </div>
    <button class="btn btn-danger-outline" data-remove-venue="${i}" ${state.settings.venues.length===1?'disabled':''}>삭제</button>
  </article>`).join('');
  root.querySelectorAll('[data-remove-venue]').forEach(btn=>btn.onclick=()=>{
    state.settings.venues.splice(Number(btn.dataset.removeVenue),1);renderVenueSettingsEditor();
  });
}
function readVenueSettingsEditor(){
  const rows=[...document.querySelectorAll('#venueSettingsList .venue-row')];
  state.settings.venues=rows.map((row,i)=>({
    id:state.settings.venues[i]?.id||`venue-${Date.now()}-${i}`,
    name:row.querySelector('[data-field="name"]').value.trim()||`구장${i+1}`,
    courtCount:Math.max(1,Number(row.querySelector('[data-field="courtCount"]').value)||1),
    courtPrefix:row.querySelector('[data-field="courtPrefix"]').value.trim()||'코트',
    usePrelim:row.querySelector('[data-field="usePrelim"]').checked,
    useMain:row.querySelector('[data-field="useMain"]').checked
  }));
  ensureVenueSettings(state);ensureVenueQueues(state);
}
function applyVenuePreset(){
  if(!requireAdmin('구장 프리셋 변경'))return;
  state.settings.venues=venuePreset();renderVenueSettingsEditor();readVenueSettingsEditor();
  commit('본선 구장 프리셋 적용 · 국제 8면 · 원도심 4면');
  notice('국제 8면과 원도심 4면을 적용했습니다.','success');
}
function addVenue(){
  readVenueSettingsEditor();
  state.settings.venues.push({id:`venue-${Date.now()}`,name:`구장${state.settings.venues.length+1}`,courtCount:1,courtPrefix:'코트',usePrelim:true,useMain:true});
  renderVenueSettingsEditor();
}
function saveVenueSettings(){
  readVenueSettingsEditor();
  const prelimSummary=prelimVenues(state).map(v=>`${v.name} ${v.courtCount}면`).join(' + ');
  const mainSummary=mainVenues(state).map(v=>`${v.name} ${v.courtCount}면`).join(' + ');
  commit(`구장 설정 저장 · 예선 ${prelimSummary} · 본선 ${mainSummary}`);
  syncPrelimInputs();syncInputs();
  notice(`예선: ${prelimSummary} / 본선: ${mainSummary}로 저장했습니다.`,'success');
}


function reorderQueue(venueId,matchId,direction){
  const changed=reorderQueueItem(state,{venueId,matchId,direction});
  if(!changed)return;
  calculateTimeMetrics(state);
  commit(`공용대기 순서 변경 · ${venueId} · ${direction==='up'?'위로':'아래로'}`);
}
function openQueueMove(sourceVenueId,matchId){
  const m=findMatch(state.draw,matchId);if(!m)return;
  $('queueMoveSourceVenueId').value=sourceVenueId;
  $('queueMoveMatchId').value=matchId;
  $('queueMoveMatchLabel').textContent=`${teamText(m.teamA)} vs ${teamText(m.teamB)}`;
  $('queueMoveTargetVenue').innerHTML=state.settings.venues.filter(v=>v.id!==sourceVenueId).map(v=>`<option value="${v.id}">${v.name}</option>`).join('');
  if(!$('queueMoveTargetVenue').options.length){notice('이동할 다른 구장이 없습니다.','error');return;}
  $('queueMoveDialog').showModal();
}
function confirmQueueMove(event){
  event.preventDefault();
  moveQueueItem(state,{
    matchId:$('queueMoveMatchId').value,
    sourceVenueId:$('queueMoveSourceVenueId').value,
    targetVenueId:$('queueMoveTargetVenue').value,
    targetPosition:$('queueMoveTargetPosition').value
  });
  const m=findMatch(state.draw,$('queueMoveMatchId').value);
  if(m)m.venueId=$('queueMoveTargetVenue').value;
  calculateTimeMetrics(state);
  commit('공용대기 경기 구장 이동');
  $('queueMoveDialog').close();
  notice('경기를 다른 구장 공용대기로 이동했습니다.','success');
}


function openManualAssign(venueId,matchId){
  const match=findMatch(state.draw,matchId);
  if(!match){notice('경기를 찾지 못했습니다.','error');return;}
  const slots=availableCourtSlots(state,venueId);
  $('manualAssignVenueId').value=venueId;
  $('manualAssignMatchId').value=matchId;
  $('manualAssignMatchLabel').textContent=`${teamText(match.teamA)} vs ${teamText(match.teamB)}`;
  const select=$('manualAssignCourtSelect');
  const info=$('manualAssignInfo');
  const confirm=$('confirmManualAssignBtn');
  if(slots.length){
    select.disabled=false;
    select.innerHTML=slots.map(x=>`<option value="${x.courtId}|${x.slot}">${x.label}</option>`).join('');
    info.className='notice success';
    info.textContent=`현재 배정 가능한 자리가 ${slots.length}개 있습니다.`;
    confirm.disabled=false;
  }else{
    select.disabled=true;
    select.innerHTML='<option value="">배정 가능한 자리 없음</option>';
    info.className='notice error';
    info.textContent='현재 이 구장의 모든 코트에 시합중과 대기1 경기가 배정되어 있습니다. 경기 결과가 입력되어 자리가 비면 배정할 수 있습니다.';
    confirm.disabled=true;
  }
  $('manualCourtAssignDialog').showModal();
}
function confirmManualAssign(event){
  event.preventDefault();
  const [courtId,slot]=$('manualAssignCourtSelect').value.split('|');
  const result=assignQueueMatchToCourt(state,{venueId:$('manualAssignVenueId').value,matchId:$('manualAssignMatchId').value,courtId,slot},id=>findMatch(state.draw,id));
  if(state.messaging.settings.autoMessageEnabled){
    if(slot==='playing')generatePlayingMessages(state,result.match.id,result.court.name);
    else generateWait1Messages(state,result.match.id,result.court.name);
  }
  calculateTimeMetrics(state);commit(`공용대기 수동 코트배정 · ${result.court.name} · ${slot}`);
  $('manualCourtAssignDialog').close();notice('수동 코트배정이 완료되었습니다.','success');
}
function returnWait1(courtId){
  const result=returnWait1ToVenueQueue(state,{courtId},id=>findMatch(state.draw,id));
  calculateTimeMetrics(state);commit(`대기1 공용대기 복귀 · ${result.matchId}`);
  notice('대기1 경기를 해당 구장 공용대기 맨 앞으로 돌렸습니다.','success');
}



function sourceTransferMatchId(source,sourceSlot){
  if(sourceSlot==='playing')return source?.playing||null;
  if(sourceSlot==='wait1')return source?.wait1||null;
  if(sourceSlot?.startsWith('manual:'))return sourceSlot.slice(7)||null;
  return null;
}

function unifiedSourceMatchId(source,sourceSlot){
  if(sourceSlot==='playing')return source?.playing||null;
  if(sourceSlot==='wait1')return source?.wait1||null;
  if(sourceSlot?.startsWith('queue:')){
    const index=Number(sourceSlot.slice(6));
    return Array.isArray(source?.queue)?source.queue[index]||null:null;
  }
  return null;
}
function openUnifiedCourtTransfer(sourceCourtId,sourceSlot){
  const source=(state.prelim?.courts||[]).find(c=>c.id===sourceCourtId);
  const matchId=unifiedSourceMatchId(source,sourceSlot);
  const item=findUnifiedMatch(state,matchId);
  if(!source||!item){notice('이동할 통합 코트 경기를 찾지 못했습니다.','error');return;}
  const targets=(state.prelim?.courts||[]).filter(c=>(c.venueId||'venue-default')===(source.venueId||'venue-default')&&c.id!==sourceCourtId);
  if(!targets.length){notice('같은 구장에 이동할 다른 코트가 없습니다.','error');return;}
  $('courtTransferSourceCourtId').value=`unified:${sourceCourtId}`;
  $('courtTransferSourceSlot').value=sourceSlot;
  $('courtTransferMatchLabel').textContent=`${source.name} · ${teamText(item.match.teamA)} vs ${teamText(item.match.teamB)}`;
  $('courtTransferTargetSelect').innerHTML=targets.map(c=>`<option value="${c.id}">${c.name} · 시합중 ${c.playing?'있음':'없음'} · 대기1 ${c.wait1?'있음':'없음'} · 예비 ${(c.queue?.length||0)}경기${c.isPaused?' · 사용중지':''}</option>`).join('');
  refreshCourtTransferPositions();
  $('courtTransferDialog').showModal();
}
function openCourtTransfer(sourceCourtId,sourceSlot){
  const source=state.courts.find(c=>c.id===sourceCourtId);
  const matchId=sourceTransferMatchId(source,sourceSlot);
  const match=findMatch(state.draw,matchId);
  if(!source||!match){notice('이동할 경기를 찾지 못했습니다.','error');return;}
  const targets=state.courts.filter(c=>(c.venueId||'venue-default')===(source.venueId||'venue-default')&&c.id!==sourceCourtId);
  if(!targets.length){notice('같은 구장에 이동할 다른 코트가 없습니다.','error');return;}
  $('courtTransferSourceCourtId').value=sourceCourtId;
  $('courtTransferSourceSlot').value=sourceSlot;
  $('courtTransferMatchLabel').textContent=`${source.name} · ${teamText(match.teamA)} vs ${teamText(match.teamB)}`;
  $('courtTransferTargetSelect').innerHTML=targets.map(c=>`<option value="${c.id}">${c.name} · 시합중 ${c.playing?'있음':'없음'} · 대기1 ${c.wait1?'있음':'없음'} · 예비 ${(c.manualQueue?.length||0)}경기${c.isPaused?' · 사용중지':''}</option>`).join('');
  refreshCourtTransferPositions();
  $('courtTransferDialog').showModal();
}

function refreshCourtTransferPositions(){
  const unifiedSource=String($('courtTransferSourceCourtId').value||'').startsWith('unified:');
  const court=(unifiedSource?(state.prelim?.courts||[]):state.courts).find(c=>c.id===$('courtTransferTargetSelect').value);
  const select=$('courtTransferMode');if(!court||!select)return;
  const reserveCount=unifiedSource?(court.queue?.length||0):(court.manualQueue?.length||0);
  const opts=[
    ['insert-playing',`시합 바로진행 자리${court.playing?' · 기존 카드부터 한 단계씩 밀림':''}`],
    ['insert-wait1',`대기1 자리${court.wait1?' · 기존 대기1은 예비1로 밀림':''}`],
    ...Array.from({length:reserveCount+1},(_,i)=>[`insert-reserve-${i}`,`예비 ${i+1}번 자리${i<reserveCount?' · 뒤 카드 밀림':''}`]),
    ['manual-bottom','예비 대기 맨 뒤']
  ];
  select.innerHTML=opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
}

function confirmCourtTransfer(event){
  event.preventDefault();
  const rawSourceId=$('courtTransferSourceCourtId').value;
  const sourceSlot=$('courtTransferSourceSlot').value;
  const unified=String(rawSourceId||'').startsWith('unified:');
  const sourceId=unified?rawSourceId.slice(8):rawSourceId;
  const source=unified?(state.prelim?.courts||[]).find(c=>c.id===sourceId):state.courts.find(c=>c.id===sourceId);
  const matchId=unified?unifiedSourceMatchId(source,sourceSlot):sourceTransferMatchId(source,sourceSlot);
  const result=unified
    ?moveUnifiedCourtMatchFlexible(state,{matchId,targetCourtId:$('courtTransferTargetSelect').value,mode:$('courtTransferMode').value})
    :moveCourtMatchFlexible(state,{matchId,targetCourtId:$('courtTransferTargetSelect').value,mode:$('courtTransferMode').value},id=>findMatch(state.draw,id));
  calculateTimeMetrics(state);commit(`경기 카드 삽입 이동 · ${result.court.name}`);
  $('courtTransferDialog').close();notice(result.shifted?.length?`선택한 위치에 넣고 기존 카드 ${result.shifted.length}개를 한 단계씩 밀었습니다.`:result.slot==='manual'?'선택한 예비 대기 위치에 넣었습니다.':'경기를 선택한 위치로 이동했습니다.','success');
}



function openCourtStatus(courtId){
  const court=state.courts.find(c=>c.id===courtId);if(!court)return;
  $('courtStatusCourtId').value=courtId;
  $('courtStatusCourtLabel').textContent=`${court.venueName||''} ${court.name} · 시합중 ${court.playing?'있음':'없음'} · 대기1 ${court.wait1?'있음':'없음'}`;
  $('courtStatusAction').value=court.isPaused?'resume':'pause-keep';
  $('courtStatusReason').value=court.pauseReason||'';
  $('courtStatusReason').disabled=court.isPaused;
  $('courtStatusDialog').showModal();
}
function confirmCourtStatus(event){
  event.preventDefault();
  const courtId=$('courtStatusCourtId').value,action=$('courtStatusAction').value;
  if(action==='resume'){
    const court=resumeCourt(state,courtId);
    refillCourt(state,court,id=>findMatch(state.draw,id));
    calculateTimeMetrics(state);commit(`코트 사용 재개 · ${court.name}`);
    notice(`${court.name} 사용을 재개했습니다.`,'success');
  }else{
    const court=pauseCourt(state,{
      courtId,reason:$('courtStatusReason').value,
      returnWait1:action==='pause-return-wait1'||action==='pause-return-all',
      returnPlaying:action==='pause-return-all'
    },id=>findMatch(state.draw,id));
    calculateTimeMetrics(state);commit(`코트 사용중지 · ${court.name} · ${action}`);
    notice(`${court.name}을 사용중지했습니다.`,'success');
  }
  $('courtStatusDialog').close();
}


function openManualQueueAssign(venueId,matchId){
  const match=findMatch(state.draw,matchId);if(!match)return;
  const courts=state.courts.filter(c=>(c.venueId||'venue-default')===venueId);
  if(!courts.length){notice('해당 구장의 코트를 찾지 못했습니다.','error');return;}
  $('manualQueueAssignVenueId').value=venueId;$('manualQueueAssignMatchId').value=matchId;
  $('manualQueueAssignMatchLabel').textContent=`${teamText(match.teamA)} vs ${teamText(match.teamB)}`;
  $('manualQueueAssignCourt').innerHTML=courts.map(c=>`<option value="${c.id}">${c.name} · 현재 수동대기 ${c.manualQueue?.length||0}경기</option>`).join('');
  $('manualQueueAssignDialog').showModal();
}
function confirmManualQueueAssign(event){
  event.preventDefault();
  const result=assignToCourtManualQueue(state,{matchId:$('manualQueueAssignMatchId').value,courtId:$('manualQueueAssignCourt').value,position:$('manualQueueAssignPosition').value},id=>findMatch(state.draw,id));
  calculateTimeMetrics(state);commit(`관리자 코트 대기 지정 · ${result.court.name}`);
  $('manualQueueAssignDialog').close();notice(`${result.court.name}의 수동 대기열에 등록했습니다.`,'success');
}
function reorderManualQueue(courtId,matchId,direction){
  if(!reorderCourtManualQueue(state,{courtId,matchId,direction}))return;
  calculateTimeMetrics(state);commit('코트 수동 대기 순서 변경');
}
function returnManualQueue(courtId,matchId){
  returnManualQueueItemToVenue(state,{courtId,matchId,position:'top'},id=>findMatch(state.draw,id));
  calculateTimeMetrics(state);commit('코트 수동 대기 → 구장 공용대기 1번');
  notice('해당 구장 공용대기 맨 앞으로 이동했습니다.','success');
}


function updateBracketView(key,value){
  if(!state.ui)state.ui={};
  if(!state.ui.bracketView)state.ui.bracketView={round:'all',status:'all',venue:'all',density:'comfortable',activeOnly:false};
  state.ui.bracketView[key]=value;
  saveState(state);
  render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});
}
function resetBracketView(){
  state.ui=state.ui||{};
  state.ui.bracketView={round:'all',status:'all',venue:'all',density:'comfortable',activeOnly:false};
  saveState(state);
  render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});
}
function setBracketFullscreen(open){
  const board=$('bracketBoard'),button=$('bracketFullscreenBtn');
  if(!board||!button)return;
  board.classList.toggle('bracket-fullscreen',open);
  document.body.classList.toggle('bracket-fullscreen-open',open);
  button.textContent=open?'전체화면 종료':'대진표 전체화면';
  button.setAttribute('aria-pressed',open?'true':'false');
}
function toggleBracketFullscreen(){
  setBracketFullscreen(!$('bracketBoard')?.classList.contains('bracket-fullscreen'));
}


function reorderPrelimQueue(courtId,matchId,direction){
  if(!reorderPrelimQueueItem(state,{courtId,matchId,direction}))return;
  commit(`예선 추가대기 순서 변경 · ${courtId} · ${direction}`);
}
function openPrelimMove(sourceCourtId,matchId){
  const match=findPrelimMatch(state,matchId);if(!match)return;
  const source=state.prelim.courts.find(c=>c.id===sourceCourtId);
  const targets=state.prelim.courts.filter(c=>c.id!==sourceCourtId);
  if(!targets.length){prelimNotice('이동할 다른 예선 코트가 없습니다.','error');return;}
  $('prelimMoveSourceCourtId').value=sourceCourtId;
  $('prelimMoveMatchId').value=matchId;
  $('prelimMoveMatchLabel').textContent=`${match.groupNo}조 ${match.matchNo}경기 · ${teamText(match.teamA)} vs ${teamText(match.teamB)}`;
  $('prelimMoveTargetCourt').innerHTML=targets.map(c=>`<option value="${c.id}">${c.venueName||''} ${c.name} · 대기1 ${c.wait1?'있음':'비어있음'} · 추가대기 ${(c.queue||[]).length}경기</option>`).join('');
  $('prelimQueueMoveDialog').showModal();
}
function confirmPrelimMove(event){
  event.preventDefault();
  const result=movePrelimQueuedMatch(state,{
    sourceCourtId:$('prelimMoveSourceCourtId').value,
    targetCourtId:$('prelimMoveTargetCourt').value,
    matchId:$('prelimMoveMatchId').value,
    position:$('prelimMoveTargetPosition').value
  });
  commit(`예선 경기 코트 이동 · ${result.source.name} → ${result.target.name}`);
  $('prelimQueueMoveDialog').close();
  prelimNotice(`${result.match.groupNo}조 ${result.match.matchNo}경기를 ${result.target.name}으로 이동했습니다.`,'success');
}
function returnPrelimWait1(courtId){
  const matchId=returnPrelimWait1ToQueue(state,{courtId});
  commit(`예선 대기1 추가대기 복귀 · ${matchId}`);
  prelimNotice('대기1 경기를 해당 코트 추가대기 맨 앞으로 이동했습니다.','success');
}


function openPrelimCourtStatus(courtId){
  const c=state.prelim.courts.find(x=>x.id===courtId);if(!c)return;
  $('prelimStatusCourtId').value=courtId;
  $('prelimStatusCourtLabel').textContent=`${c.venueName||''} ${c.name} · 시합중 ${c.playing?'있음':'없음'} · 대기1 ${c.wait1?'있음':'없음'} · 추가대기 ${(c.queue||[]).length}경기`;
  $('prelimStatusAction').value=c.isPaused?'resume':'pause-keep';
  $('prelimStatusReason').value=c.pauseReason||'';
  $('prelimCourtStatusDialog').showModal();
}
function confirmPrelimCourtStatus(event){
  event.preventDefault();
  const id=$('prelimStatusCourtId').value,action=$('prelimStatusAction').value;
  if(action==='resume'){const c=resumePrelimCourt(state,id);commit(`예선 코트 사용 재개 · ${c.name}`);prelimNotice(`${c.name} 사용을 재개했습니다.`,'success');}
  else{const r=pausePrelimCourt(state,{courtId:id,reason:$('prelimStatusReason').value,evacuateWait:action!=='pause-keep',evacuateAll:action==='pause-evacuate-all'});commit(`예선 코트 사용중지 · ${r.court.name}`);prelimNotice(`${r.court.name}을 사용중지하고 ${r.evacuated}경기를 대피했습니다.`,'success');}
  $('prelimCourtStatusDialog').close();
}


function openView(name){
  const btn=document.querySelector(`[data-view="${name}"]`);
  if(btn)btn.click();
}


function setupReadiness(){
  const teamCount=Array.isArray(state.teams)?state.teams.length:0;
  const groupCount=Array.isArray(state.prelim?.groups)?state.prelim.groups.length:0;
  const courtCount=Array.isArray(state.prelim?.courts)?state.prelim.courts.length:0;
  const linked=state.prelim?.linkedDraw?.active===true&&Array.isArray(state.prelim.linkedDraw.slots)&&state.prelim.linkedDraw.slots.length>0;
  return {teamCount,groupCount,courtCount,linked,ready:teamCount>0&&groupCount>0&&courtCount>0&&linked};
}
function updateSetupProgress(){
  const status=setupReadiness();
  const steps=[
    ['setupStepRoster',status.teamCount>0,'setupStepRosterText',status.teamCount?`${status.teamCount}팀 불러옴`:'명단 필요'],
    ['setupStepGroups',status.groupCount>0,'setupStepGroupsText',status.groupCount?`${status.groupCount}개 조 생성`:'조편성 필요'],
    ['setupStepCourts',status.courtCount>0,'setupStepCourtsText',status.courtCount?`${status.courtCount}면 배정`:'코트배정 필요'],
    ['setupStepDraw',status.linked,'setupStepDrawText',status.linked?`${state.prelim.linkedDraw.slots.length}슬롯 생성`:'선추첨 필요']
  ];
  steps.forEach(([id,done,textId,text])=>{
    const el=$(id);if(el){el.classList.toggle('complete',done);el.classList.toggle('pending',!done);}
    const textEl=$(textId);if(textEl)textEl.textContent=text;
  });
  const badge=$('setupReadyBadge');
  if(badge){badge.textContent=status.ready?'운영 시작 가능':'준비 진행 중';badge.className=`badge ${status.ready?'badge-safe':'badge-muted-dark'}`;}
  const start=$('startTournamentOperationBtn');if(start)start.disabled=!status.ready;
  const next=$('setupNextAction');
  if(next){
    let message='준비가 완료되었습니다. 복구점을 저장하고 코트 운영으로 전환하세요.';
    if(!status.teamCount)message='1단계: 참가팀 명단을 불러오세요.';
    else if(!status.groupCount)message='2단계: 예선 조 자동계산 후 조편성을 생성하세요.';
    else if(!status.courtCount)message='3단계: 예선 코트배정을 실행하세요.';
    else if(!status.linked)message='4단계: 예선 슬롯으로 본선 선추첨을 실행하세요.';
    next.textContent=message;next.className=`notice ${status.ready?'success':'info'}`;
  }
}
function jumpSetupStep(step){
  const targets={roster:'setupRosterActions',groups:'generatePrelimBtn',courts:'assignPrelimCourtsBtn',draw:'generateLinkedDrawBtn'};
  const target=$(targets[step]);
  target?.scrollIntoView({behavior:'smooth',block:'center'});
  if(target?.tagName==='BUTTON'){target.classList.add('setup-focus-pulse');setTimeout(()=>target.classList.remove('setup-focus-pulse'),1600);}
}
function startTournamentOperation(){
  const status=setupReadiness();
  if(!status.ready){updateSetupProgress();throw new Error('명단·예선 조편성·코트배정·본선 슬롯 선추첨을 모두 완료해야 합니다.');}
  const item=saveRecovery(state,`${state.tournament.name} · 운영 시작 전 자동 복구점`);
  log(`대회 준비 완료 · 운영 시작 · 복구점 ${item.label}`);
  saveState(state);
  const operationButton=document.querySelector('[data-operation-section="courts"]');
  operationButton?.click();
  document.querySelector('.operation-mode-bar')?.scrollIntoView({behavior:'smooth',block:'start'});
  notice('대회 준비가 완료되었습니다. 코트 운영 화면으로 전환했습니다.','success');
  flashSaved();
}

function bind(){
  document.querySelectorAll('[data-setup-jump]').forEach(button=>button.addEventListener('click',()=>jumpSetupStep(button.dataset.setupJump)));
  if($('startTournamentOperationBtn'))$('startTournamentOperationBtn').onclick=()=>{try{startTournamentOperation();}catch(error){prelimNotice(error.message,'error');}};
  if($('bracketRoundFilter'))$('bracketRoundFilter').onchange=e=>updateBracketView('round',e.target.value);
  if($('bracketStatusFilter'))$('bracketStatusFilter').onchange=e=>updateBracketView('status',e.target.value);
  if($('bracketVenueFilter'))$('bracketVenueFilter').onchange=e=>updateBracketView('venue',e.target.value);
  if($('bracketDensity'))$('bracketDensity').onchange=e=>updateBracketView('density',e.target.value);
  if($('bracketActiveOnlyBtn'))$('bracketActiveOnlyBtn').onclick=()=>updateBracketView('activeOnly',!(state.ui?.bracketView?.activeOnly));
  if($('bracketResetViewBtn'))$('bracketResetViewBtn').onclick=resetBracketView;
  if($('bracketFullscreenBtn'))$('bracketFullscreenBtn').onclick=toggleBracketFullscreen;
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('bracket-fullscreen-open'))setBracketFullscreen(false);});

  $('loadSampleBtn').onclick=()=>loadSample().catch(e=>notice(e.message,'error'));
  $('teamFileInput').onchange=e=>{const f=e.target.files[0];if(f)readTeamFile(f).catch(err=>notice(err.message,'error'));};
  $('instantDrawBtn').onclick=()=>{try{runDrawMethod('instant');}catch(e){notice(e.message,'error');}};
  $('rouletteDrawBtn').onclick=()=>{try{runDrawMethod('roulette');}catch(e){notice(e.message,'error');}};
  $('seededDrawBtn').onclick=()=>{try{runDrawMethod('seeded');}catch(e){notice(e.message,'error');}};
  $('reshuffleDrawBtn').onclick=()=>{try{reshuffle();}catch(e){notice(e.message,'error');}};
  $('lockDrawBtn').onclick=()=>{try{openDrawLockDialog();}catch(e){notice(e.message,'error');}};
  $('unlockDrawBtn').onclick=()=>{try{openDrawUnlockDialog();}catch(e){notice(e.message,'error');}};
  $('drawLockConfirmCheck').onchange=()=>{$('confirmDrawLockBtn').disabled=!$('drawLockConfirmCheck').checked;};
  $('confirmDrawLockBtn').onclick=confirmDrawLock;
  $('unlockConfirmText').oninput=()=>{$('confirmDrawUnlockBtn').disabled=$('unlockConfirmText').value.trim()!=='잠금해제';};
  $('confirmDrawUnlockBtn').onclick=confirmDrawUnlock;
  $('startRouletteBtn').onclick=startRoulette;$('skipRouletteBtn').onclick=finishRoulette;
  $('cancelRouletteBtn').onclick=()=>{clearInterval(rouletteTimer);$('rouletteDialog').close();};
  $('clearDrawHistoryBtn').onclick=()=>{clearDrawHistory(state);commit('본선 추첨 기록 삭제');};
  $('assignCourtsBtn').onclick=()=>{try{assign();}catch(e){notice(e.message,'error');}};
  if($('refreshQueueBtn'))$('refreshQueueBtn').onclick=refreshQueue;if($('resetBtn'))$('resetBtn').onclick=hardReset;
  if($('recalculateTimeBtn'))$('recalculateTimeBtn').onclick=()=>{pullSettings();calculateTimeMetrics(state);commit('예상 대기시간 즉시 계산');notice('예상시간을 다시 계산했습니다.','success');};
  if($('autoTimeEnabled'))$('autoTimeEnabled').onchange=()=>{pullSettings();commit(`대기시간 자동계산 ${state.settings.autoTimeEnabled?'ON':'OFF'}`);restartTimeTimer();};
  if($('autoIncrementalMainEnabled'))$('autoIncrementalMainEnabled').onchange=()=>{pullSettings();commit(`확정 본선 자동 추가배정 ${state.settings.autoIncrementalMainEnabled?'ON':'OFF'}`);notice(`확정 본선 자동 추가배정을 ${state.settings.autoIncrementalMainEnabled?'켰습니다.':'껐습니다.'}`,'success');};
  if($('timeRefreshSeconds'))$('timeRefreshSeconds').onchange=()=>{pullSettings();commit(`진행시간 갱신주기 ${state.settings.timeRefreshSeconds}초`);restartTimeTimer();};
  $('confirmResultBtn').onclick=confirmResult;
  $('autoFitPrelimBtn').onclick=()=>{try{autoFitPrelim();}catch(e){prelimNotice(e.message,'error');}};
  $('generatePrelimBtn').onclick=()=>{try{createPrelim();}catch(e){prelimNotice(e.message,'error');}};
  $('assignPrelimCourtsBtn').onclick=()=>{try{assignPrelim();}catch(e){prelimNotice(e.message,'error');}};
  if($('swapReserveBtn'))$('swapReserveBtn').onclick=()=>{
    reserveSwapMode=!reserveSwapMode;
    if(!reserveSwapMode){pendingActiveSwapId=null;state.prelim.swapSelection=null;}
    $('swapReserveBtn').classList.toggle('swap-mode-active',reserveSwapMode);
    $('swapReserveBtn').textContent=reserveSwapMode?'교체할 참가팀 선택':'후보 교체 모드';
    prelimNotice(reserveSwapMode?'교체할 예선 참가팀의 교체 버튼을 누르세요.':'후보 교체 모드를 종료했습니다.','info');
    commit();
  };
  $('generateLinkedDrawBtn').onclick=()=>{try{createLinkedDraw();}catch(e){prelimNotice(e.message,'error');}};
  $('syncLinkedDrawBtn').onclick=()=>{try{syncLinkedDraw();}catch(e){prelimNotice(e.message,'error');}};
  if($('lockPrelimBtn'))$('lockPrelimBtn').onclick=()=>{try{finalizeAndLockPrelim();}catch(e){prelimNotice(e.message,'error');}};
  if($('unlockPrelimBtn'))$('unlockPrelimBtn').onclick=adminUnlockPrelim;
  $('confirmPrelimResultBtn').onclick=confirmPrelimResult;
  $('resetPrelimBtn').onclick=resetPrelimOnly;
  $('useQualifiersForDrawBtn').onclick=()=>{try{useQualifiersForDraw();}catch(e){prelimNotice(e.message,'error');}};
  $('exportJsonBtn').onclick=()=>downloadJson(`230match-v3-${Date.now()}.json`,state);
  $('saveRecoveryBtn').onclick=()=>{const item=saveRecovery(state,`${state.tournament.name} · ${state.tournament.division}`);log(`복구점 저장 · ${item.label}`);saveState(state);render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});renderOperatorControls();notice('복구점을 저장했습니다.','success');};
  if($('saveRecoveryBtnInline'))$('saveRecoveryBtnInline').onclick=()=>$('saveRecoveryBtn').click();
  $('openRecoveryBtn').onclick=showRecoveries;$('closeRecoveryBtn').onclick=()=>$('recoveryDialog').close();
  $('clearLogsBtn').onclick=()=>{state.logs=[];commit();};
  if($('operationGoPrelimSettingsBtn'))$('operationGoPrelimSettingsBtn').onclick=()=>{
    const target=$('unifiedPrelimSetup');
    if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
  };
  if($('operationGoBracketBtn'))$('operationGoBracketBtn').onclick=()=>openView('bracket');
  if($('quickAuditBtn'))$('quickAuditBtn').onclick=()=>executeAuditAction(runAllAudit,'전체 운영 점검');
  if($('globalAutoAssignToggle'))$('globalAutoAssignToggle').onclick=()=>{ensureOperatorState();autoRecovery('자동배정 설정 변경 전');state.operation.autoAssignmentEnabled=!state.operation.autoAssignmentEnabled;commit(`전체 자동배정 ${state.operation.autoAssignmentEnabled?'재개':'일시정지'}`);notice(state.operation.autoAssignmentEnabled?'전체 자동배정을 재개했습니다.':'전체 자동배정을 일시정지했습니다. 현재 시합과 대기1은 유지됩니다.','success');};
  if($('runStateAuditBtn'))$('runStateAuditBtn').onclick=()=>executeAuditAction(runCurrentAudit,'현재 상태 점검');
  if($('runPrelimSimulationBtn'))$('runPrelimSimulationBtn').onclick=()=>executeAuditAction(runPrelimSimulationAudit,'예선 복제 모의운영');
  if($('runFullSimulationBtn'))$('runFullSimulationBtn').onclick=()=>executeAuditAction(runSimulationAudit,'본선 복제 모의대회');
  if($('runAllAuditBtn'))$('runAllAuditBtn').onclick=()=>executeAuditAction(runAllAudit,'전체 점검');
  if($('downloadAuditBtn'))$('downloadAuditBtn').onclick=()=>executeAuditAction(downloadAudit,'점검 결과 저장');
  if($('clearAuditBtn'))$('clearAuditBtn').onclick=clearAudit;
  if($('applyVenuePresetBtn'))$('applyVenuePresetBtn').onclick=applyVenuePreset;
  if($('addVenueBtn'))$('addVenueBtn').onclick=addVenue;
  if($('saveVenueSettingsBtn'))$('saveVenueSettingsBtn').onclick=saveVenueSettings;
  if($('confirmQueueMoveBtn'))$('confirmQueueMoveBtn').onclick=confirmQueueMove;
  if($('confirmManualAssignBtn'))$('confirmManualAssignBtn').onclick=confirmManualAssign;
  if($('confirmCourtTransferBtn'))$('confirmCourtTransferBtn').onclick=confirmCourtTransfer;
  if($('confirmCourtStatusBtn'))$('confirmCourtStatusBtn').onclick=confirmCourtStatus;
  if($('confirmManualQueueAssignBtn'))$('confirmManualQueueAssignBtn').onclick=confirmManualQueueAssign;
  if($('confirmPrelimMoveBtn'))$('confirmPrelimMoveBtn').onclick=confirmPrelimMove;
  if($('confirmPrelimCourtStatusBtn'))$('confirmPrelimCourtStatusBtn').onclick=confirmPrelimCourtStatus;
  if($('courtStatusAction'))$('courtStatusAction').onchange=()=>{$('courtStatusReason').disabled=$('courtStatusAction').value==='resume';};
  if($('generateTimeMessagesBtn'))$('generateTimeMessagesBtn').onclick=createAllTimeMessages;
  if($('generateCurrentCourtMessagesBtn'))$('generateCurrentCourtMessagesBtn').onclick=createCurrentCourtMessages;
  if($('generateCurrentWaitMessagesBtn'))$('generateCurrentWaitMessagesBtn').onclick=createCurrentWaitMessages;
  if($('generateAllTimeMessagesBtn'))$('generateAllTimeMessagesBtn').onclick=createAllTimeMessages;
  if($('markAllMessagesSentBtn'))$('markAllMessagesSentBtn').onclick=()=>{markAllSent(state);commit('모든 대기 문자를 발송완료로 표시');};
  if($('clearSentMessagesBtn'))$('clearSentMessagesBtn').onclick=()=>{clearSentMessages(state);commit('발송완료 문자 정리');};if($('mergeDuplicateMessagesBtn'))$('mergeDuplicateMessagesBtn').onclick=mergeDuplicates;if($('closeMessageHistoryBtn'))$('closeMessageHistoryBtn').onclick=()=>$('messageHistoryDialog').close();
  if($('messageStatusFilter'))$('messageStatusFilter').onchange=()=>render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});

  if($('rosterSearch'))$('rosterSearch').oninput=()=>render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});
  if($('rosterPhoneFilter'))$('rosterPhoneFilter').onchange=()=>render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});
  if($('contactEditPhone'))$('contactEditPhone').oninput=validateContactInput;
  if($('saveContactBtn'))$('saveContactBtn').onclick=saveContact;
  if($('refreshMessagePhonesBtn'))$('refreshMessagePhonesBtn').onclick=reconnectMessagePhones;
  if($('exportContactsBtn'))$('exportContactsBtn').onclick=()=>downloadJson(`230match-contacts-${Date.now()}.json`,exportContactData(state));
  if($('contactFileInput'))$('contactFileInput').onchange=e=>{const f=e.target.files[0];if(f)importContactsFile(f).catch(err=>notice(err.message,'error'));};
  ['autoMessageEnabled','messageSenderName','messageDeliveryMode','messageOnCourtAssign','messageOnQueueMove','smartMessageUpdate','messageRepeatPolicy','templatePlaying','templateWait1','templateShared'].forEach(id=>{const el=$(id);if(el)el.addEventListener('change',()=>{pullSettings();commit('문자 설정 변경');});});

  if($('saveSyncSettingsBtn'))$('saveSyncSettingsBtn').onclick=saveAndConnectSync;
  if($('disconnectSyncBtn'))$('disconnectSyncBtn').onclick=()=>{if(!requireAdmin('동기화 연결 해제'))return;disconnectCloudSync();const cfg=collectSyncPanel();cfg.enabled=false;saveSyncSettings(cfg);setChecked('cloudSyncEnabled',false);updateSyncPanel({label:'로컬 저장',detail:'클라우드 연결을 해제했습니다.'});};
  if($('pushSyncNowBtn'))$('pushSyncNowBtn').onclick=async()=>{if(!requireAdmin('현재 상태 업로드'))return;try{await pushStateNow(state);notice('현재 상태를 Firebase에 업로드했습니다.','success');}catch(error){notice(error.message,'error');}};
  if($('pullSyncNowBtn'))$('pullSyncNowBtn').onclick=async()=>{if(!requireAdmin('클라우드 상태 불러오기'))return;if(!confirm('클라우드 상태로 현재 브라우저 상태를 교체할까요? 자동 복구점을 먼저 저장합니다.'))return;autoRecovery('클라우드 상태 불러오기 전');try{const next=await pullStateNow();if(next)applySynchronizedState(next,'클라우드');else notice('클라우드에 저장된 상태가 없습니다.','error');}catch(error){notice(error.message,'error');}};
  if($('roleAdminBtn'))$('roleAdminBtn').onclick=()=>setRole('admin');
  if($('roleOperatorBtn'))$('roleOperatorBtn').onclick=()=>setRole('operator');
  if($('changeAdminPinBtn'))$('changeAdminPinBtn').onclick=changeAdminPin;
  document.querySelectorAll('.tab').forEach(tab=>tab.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));tab.classList.add('active');$(`view-${tab.dataset.view}`).classList.add('active');});
  ['tournamentName','divisionName','drawSize','matchMinutes','minimumMatchMinutes','drawMethod','byePriority','venueAssignmentPolicy','separateVenueQueues','autoVenuePromotion'].forEach(id=>{
    const el=$(id);if(el)el.addEventListener('change',()=>{pullSettings();commit('대회 설정 변경');});
  });
}

document.addEventListener('click',event=>{
  const button=event.target.closest?.('button');
  if(!button)return;
  const actions={
    runStateAuditBtn:[runCurrentAudit,'현재 상태 점검'],
    runFullSimulationBtn:[runSimulationAudit,'복제 모의대회'],
    runAllAuditBtn:[runAllAudit,'전체 점검'],
    quickAuditBtn:[runAllAudit,'전체 운영 점검']
  };
  const selected=actions[button.id];
  if(!selected)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  executeAuditAction(selected[0],selected[1]);
},{capture:true});


document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-manual-assign]');
  if(!button)return;
  event.preventDefault();
  event.stopPropagation();
  openManualAssign(button.dataset.venueId,button.dataset.manualAssign);
},{capture:true});


document.addEventListener('click',event=>{
  const active=event.target.closest?.('[data-active-swap]');
  if(active){event.preventDefault();event.stopPropagation();selectActiveSwap(active.dataset.activeSwap);return;}
  const reserve=event.target.closest?.('[data-reserve-pick]');
  if(reserve){event.preventDefault();event.stopPropagation();selectReserveSwap(reserve.dataset.reservePick);}
},{capture:true});


function ensureUnifiedCourtMoveControls(){
  const grid=document.getElementById('prelimCourtOperationGrid');
  if(!grid)return;
  const cards=[...grid.querySelectorAll('.prelim-court-card')];
  const courts=state.prelim?.courts||[];
  cards.forEach((card,index)=>{
    const court=courts[index];
    if(!court)return;
    const playing=card.querySelector('.prelim-court-slot.playing');
    if(court.playing&&playing&&!playing.querySelector('[data-force-unified-transfer="playing"]')){
      let actions=playing.querySelector('.unified-card-actions');
      if(!actions){actions=document.createElement('div');actions.className='unified-card-actions';playing.appendChild(actions);}
      const btn=document.createElement('button');btn.type='button';btn.className='btn btn-light compact-move-btn';btn.textContent='⇄';btn.title='코트 이동·순서 관리';btn.setAttribute('aria-label','코트 이동·순서 관리');btn.dataset.adminOnly='true';
      btn.dataset.forceUnifiedTransfer='playing';btn.onclick=()=>openUnifiedCourtTransfer(court.id,'playing');actions.appendChild(btn);
    }
    const wait1=card.querySelector('.prelim-court-slot.wait1');
    if(court.wait1&&wait1&&!wait1.querySelector('[data-force-unified-transfer="wait1"]')){
      let actions=wait1.querySelector('.unified-card-actions');
      if(!actions){actions=document.createElement('div');actions.className='unified-card-actions';wait1.appendChild(actions);}
      const btn=document.createElement('button');btn.type='button';btn.className='btn btn-light compact-move-btn';btn.textContent='⇄';btn.title='코트 이동·순서 관리';btn.setAttribute('aria-label','코트 이동·순서 관리');btn.dataset.adminOnly='true';
      btn.dataset.forceUnifiedTransfer='wait1';btn.onclick=()=>openUnifiedCourtTransfer(court.id,'wait1');actions.appendChild(btn);
    }
    const queueItems=[...card.querySelectorAll('.prelim-extra-item')];
    queueItems.forEach((item,qIndex)=>{
      if(!item.querySelector('[data-force-unified-transfer^="queue:"]')){
        const btn=document.createElement('button');btn.type='button';btn.className='btn btn-light compact-move-btn prelim-extra-move-btn force-visible-move';btn.textContent='⇄';btn.title='코트 이동·순서 관리';btn.setAttribute('aria-label','코트 이동·순서 관리');btn.dataset.adminOnly='true';
        btn.dataset.forceUnifiedTransfer=`queue:${qIndex}`;btn.onclick=()=>openUnifiedCourtTransfer(court.id,`queue:${qIndex}`);if(typeof isAdmin==='function'&&!isAdmin())btn.hidden=true;item.appendChild(btn);
      }
    });
  });
}
function installUnifiedMoveControlGuard(){
  const grid=document.getElementById('prelimCourtOperationGrid');
  if(!grid)return;
  let queued=false;
  const run=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;ensureUnifiedCourtMoveControls();});};
  new MutationObserver(run).observe(grid,{childList:true,subtree:true});
  run();
}

syncInputs();syncPrelimInputs();bind();renderVenueSettingsEditor();calculateTimeMetrics(state);render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});renderOperatorControls();updateSetupProgress();applyRoleUI();restartTimeTimer();updateClock();setInterval(updateClock,1000);installUnifiedMoveControlGuard();ensureUnifiedCourtMoveControls();
loadSyncPanel();startStateSync({getState:()=>state,applyRemoteState:next=>applySynchronizedState(next,'다른 기기'),onStatus:updateSyncPanel});
const BUILD_LABEL='STAGE 31.25 · MAIN BRACKET LIVE INTEGRITY';
const buildStageLabel=document.getElementById('buildStageLabel');
if(buildStageLabel)buildStageLabel.textContent=BUILD_LABEL;
document.documentElement.dataset.build='33125';
console.log('[230MATCH V3] stage31.25 main-bracket-live-integrity loaded · local fallback enabled');


// Stage 31.2: presentation-only operation workspace controller.
// Core tournament, draw, court and result state models are unchanged.
(function initCompactOperationWorkspace(){
  const workspace=document.getElementById('view-operation');
  if(!workspace)return;
  const buttons=[...workspace.querySelectorAll('[data-operation-section]')];
  const valid=new Set(['courts','groups','main','setup']);
  const storageKey='230match-v3-operation-section';
  function setMode(mode,{scroll=false}={}){
    const next=valid.has(mode)?mode:'courts';
    workspace.dataset.operationMode=next;
    buttons.forEach(button=>{
      const active=button.dataset.operationSection===next;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    try{localStorage.setItem(storageKey,next);}catch(_error){}
    if(scroll){workspace.querySelector('.operation-mode-bar')?.scrollIntoView({behavior:'smooth',block:'start'});}
  }
  buttons.forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.operationSection)));
  let initial='courts';
  try{initial=localStorage.getItem(storageKey)||'courts';}catch(_error){}
  setMode(initial);
  const setupJump=document.getElementById('operationGoPrelimSettingsBtn');
  if(setupJump)setupJump.onclick=()=>setMode('setup',{scroll:true});
  const bracketJump=document.getElementById('operationGoBracketBtn');
  if(bracketJump)bracketJump.onclick=()=>{
    document.querySelector('.tab[data-view="bracket"]')?.click();
  };
})();
