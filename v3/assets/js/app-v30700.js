
import{loadState,saveState,clearState,saveRecovery,getRecoveries,deleteRecovery,initialState}from'./store.js';
import{prepareTeams,generateDraw,allMatches,findMatch,generateLinkedDrawSlots,syncLinkedDrawQualifiers}from'./bracket-engine.js';
import{ensureDrawMeta,canModifyDraw,createDrawWithMethod,lockDraw,unlockDrawForDevelopment,clearDrawHistory}from'./draw-method-engine.js';
import{buildCourts,assignInitial,queueReadyMatches}from'./court-engine.js';
import{submitResult}from'./result-engine.js';
import{ensurePrelimState,generatePrelim,assignPrelimCourts,findPrelimMatch,submitPrelimResult,resetPrelim,autoFitPrelimGroups,swapActiveReserveTeam}from'./prelim-engine.js';
import{downloadJson}from'./recovery.js';
import{ensureTimeState,calculateTimeMetrics}from'./time-engine.js';
import{ensureMessagingState,generatePlayingMessages,generateWait1Messages,generateCurrentCourtMessages,generateCurrentWaitMessages,generateAllTimeMessages,markMessageSent,deleteMessage,clearSentMessages,markAllSent,smsUri}from'./message-engine.js';
import{render,teamText}from'./ui.js';

let state=loadState();ensurePrelimState(state);ensureTimeState(state);ensureDrawMeta(state);ensureMessagingState(state);
const $=id=>document.getElementById(id);
const setValue=(id,value)=>{const el=$(id);if(el)el.value=value;};
const setChecked=(id,value)=>{const el=$(id);if(el)el.checked=Boolean(value);};
const getValue=(id,fallback='')=>{const el=$(id);return el?el.value:fallback;};
const getChecked=(id,fallback=false)=>{const el=$(id);return el?el.checked:fallback;};
function log(message){state.logs.unshift({at:new Date().toISOString(),message});state.logs=state.logs.slice(0,300);}
function commit(message){
  if(message)log(message);if(state.settings.autoTimeEnabled)calculateTimeMetrics(state);syncInputs();saveState(state);render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage});flashSaved();
}
function syncInputs(){
  setValue('tournamentName',state.tournament.name);
  setValue('divisionName',state.tournament.division);
  setValue('drawSize',String(state.settings.drawSize));
  setValue('courtCount',state.settings.courtCount);
  setValue('courtPrefix',state.settings.courtPrefix);
  setValue('matchMinutes',state.settings.matchMinutes||40);
  setValue('minimumMatchMinutes',state.settings.minimumMatchMinutes||30);
  setChecked('autoTimeEnabled',state.settings.autoTimeEnabled!==false);
  setValue('timeRefreshSeconds',String(state.settings.timeRefreshSeconds||30));
  setValue('drawMethod',state.settings.drawMethod||'instant');
  setValue('byePriority',state.settings.byePriority||'group-first');setChecked('autoMessageEnabled',state.messaging.settings.autoMessageEnabled!==false);setValue('messageSenderName',state.messaging.settings.senderName||'230MATCH');setValue('messageDeliveryMode',state.messaging.settings.deliveryMode||'sms-uri');setChecked('messageOnCourtAssign',state.messaging.settings.onCourtAssign!==false);setChecked('messageOnQueueMove',state.messaging.settings.onQueueMove!==false);setValue('templatePlaying',state.messaging.settings.templates.playing||'');setValue('templateWait1',state.messaging.settings.templates.wait1||'');setValue('templateShared',state.messaging.settings.templates.shared||'');
}
function pullSettings(){
  state.tournament.name=String(getValue('tournamentName',state.tournament.name)||'').trim()||'대회명 없음';
  state.tournament.division=String(getValue('divisionName',state.tournament.division)||'').trim()||'부서 없음';
  state.settings.drawSize=Number(getValue('drawSize',state.settings.drawSize||64));
  state.settings.courtCount=Number(getValue('courtCount',state.settings.courtCount||8));
  state.settings.courtPrefix=String(getValue('courtPrefix',state.settings.courtPrefix||'코트')).trim()||'코트';
  state.settings.minimumMatchMinutes=Math.max(20,Number(getValue('minimumMatchMinutes',state.settings.minimumMatchMinutes||30))||30);
  state.settings.matchMinutes=Math.max(state.settings.minimumMatchMinutes,Number(getValue('matchMinutes',state.settings.matchMinutes||40))||40);
  state.settings.autoTimeEnabled=getChecked('autoTimeEnabled',state.settings.autoTimeEnabled!==false);
  state.settings.timeRefreshSeconds=Number(getValue('timeRefreshSeconds',state.settings.timeRefreshSeconds||30))||30;
  state.settings.drawMethod=getValue('drawMethod',state.settings.drawMethod||'instant');
  state.settings.byePriority=getValue('byePriority',state.settings.byePriority||'group-first');state.messaging.settings.autoMessageEnabled=getChecked('autoMessageEnabled',state.messaging.settings.autoMessageEnabled!==false);state.messaging.settings.senderName=getValue('messageSenderName',state.messaging.settings.senderName||'230MATCH');state.messaging.settings.deliveryMode=getValue('messageDeliveryMode',state.messaging.settings.deliveryMode||'sms-uri');state.messaging.settings.onCourtAssign=getChecked('messageOnCourtAssign',state.messaging.settings.onCourtAssign!==false);state.messaging.settings.onQueueMove=getChecked('messageOnQueueMove',state.messaging.settings.onQueueMove!==false);state.messaging.settings.templates.playing=getValue('templatePlaying',state.messaging.settings.templates.playing);state.messaging.settings.templates.wait1=getValue('templateWait1',state.messaging.settings.templates.wait1);state.messaging.settings.templates.shared=getValue('templateShared',state.messaging.settings.templates.shared);
}
function notice(message,type='info'){$('noticeBar').className=`notice ${type}`;$('noticeBar').textContent=message;}
function flashSaved(){$('saveStateBadge').textContent='자동 저장됨';setTimeout(()=>$('saveStateBadge').textContent='자동 저장 ON',1200);}
async function loadSample(){
  const res=await fetch('./data/test-teams-100.json?v=3001');if(!res.ok)throw new Error('테스트 명단을 불러오지 못했습니다.');
  const data=await res.json();state.teams=prepareTeams(data,128);commit(`테스트 명단 ${state.teams.length}팀 불러오기`);notice(`${state.teams.length}팀을 불러왔습니다. 새 본선 추첨을 실행하세요.`,'success');
}
async function readTeamFile(file){
  const data=JSON.parse(await file.text());state.teams=prepareTeams(data,128);commit(`JSON 명단 ${state.teams.length}팀 불러오기`);notice(`${state.teams.length}팀을 불러왔습니다.`,'success');
}

function runDrawMethod(method){
  $('drawMethod').value=method;
  state.settings.drawMethod=method;
  generate();
}

function generate(){
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
  pullSettings();if(!state.draw.size)throw new Error('먼저 대진을 생성하세요.');
  state.courts=buildCourts(state.settings.courtCount,state.settings.courtPrefix);
  state.sharedQueue=assignInitial(state.draw,state.courts);if(state.messaging.settings.autoMessageEnabled&&state.messaging.settings.onCourtAssign)generateCurrentCourtMessages(state);
  commit(`코트 ${state.courts.length}면 배정 · 공용대기 ${state.sharedQueue.length}경기`);notice('코트배정이 완료되었습니다.','success');
}
function openResult(matchId){
  const m=findMatch(state.draw,matchId);if(!m)return;
  $('resultMatchId').value=matchId;$('resultMatchLabel').textContent=`${teamText(m.teamA)} vs ${teamText(m.teamB)}`;
  $('winnerSelect').innerHTML=`<option value="${m.teamA.id}">${teamText(m.teamA)}</option><option value="${m.teamB.id}">${teamText(m.teamB)}</option>`;
  $('scoreA').value=6;$('scoreB').value=3;$('resultDialog').showModal();
}
function confirmResult(event){
  event.preventDefault();
  const id=$('resultMatchId').value;
  const sourceCourt=state.courts.find(c=>c.playing===id);const beforePlaying=sourceCourt?.playing||null,beforeWait1=sourceCourt?.wait1||null;
  const m=submitResult(state,{matchId:id,winnerId:$('winnerSelect').value,scoreA:$('scoreA').value,scoreB:$('scoreB').value});
  if(sourceCourt&&state.messaging.settings.autoMessageEnabled&&state.messaging.settings.onQueueMove){if(sourceCourt.playing&&sourceCourt.playing!==beforePlaying)generatePlayingMessages(state,sourceCourt.playing,sourceCourt.name);if(sourceCourt.wait1&&sourceCourt.wait1!==beforeWait1)generateWait1Messages(state,sourceCourt.wait1,sourceCourt.name)}
  commit(`결과 확정 · ${m.id} · 승리 ${teamText(m.winner)} · ${m.scoreA}:${m.scoreB}`);
  $('resultDialog').close();notice('결과와 다음 라운드·코트 큐를 반영했습니다.','success');
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
  state.prelim.settings.courtCount=Number($('prelimCourtCount').value);
  state.prelim.settings.courtPrefix=$('prelimCourtPrefix').value.trim()||'코트';
  state.prelim.settings.qualifiersPerGroup=Number($('qualifiersPerGroup').value);
}
function syncPrelimInputs(){
  ensurePrelimState(state);
  $('prelimActiveTeamCount').value=state.prelim.settings.activeTeamCount;
  $('threeTeamGroupCount').value=state.prelim.settings.threeTeamGroups;
  $('twoTeamGroupCount').value=state.prelim.settings.twoTeamGroups;
  $('prelimCourtCount').value=state.prelim.settings.courtCount;
  $('prelimCourtPrefix').value=state.prelim.settings.courtPrefix;
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
function selectActiveSwap(teamId){
  pendingActiveSwapId=teamId;
  prelimNotice('교체할 후보팀의 선택 버튼을 누르세요.','info');
}
function selectReserveSwap(teamId){
  if(!pendingActiveSwapId){prelimNotice('먼저 예선 참가팀에서 교체 버튼을 누르세요.','error');return;}
  try{
    const result=swapActiveReserveTeam(state,pendingActiveSwapId,teamId);
    pendingActiveSwapId=null;
    commit(`예선 참가팀 교체 · 제외 ${teamText(result.activeOut)} · 투입 ${teamText(result.reserveIn)}`);
    prelimNotice('참가팀과 후보팀을 교체했습니다. 조편성을 다시 생성하세요.','success');
  }catch(e){prelimNotice(e.message,'error');}
}

function createPrelim(){
  pullPrelimSettings();
  const result=generatePrelim(state,state.prelim.settings);
  commit(`예선 조편성 생성 · ${result.groups}조 · ${result.matches}경기 · ${result.teams}팀`);
  prelimNotice(`${result.groups}개 조와 ${result.matches}경기를 생성했습니다.`,'success');
}
function assignPrelim(){
  pullPrelimSettings();
  const courts=assignPrelimCourts(state);
  commit(`예선 코트 ${courts.length}면 배정`);
  prelimNotice(`예선 조를 ${courts.length}개 코트에 배정했습니다.`,'success');
}
function openPrelimResult(matchId){
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
  commit(`예선 결과 확정 · ${m.id} · 승리 ${teamText(m.winner)} · ${m.scoreA}:${m.scoreB}${syncResult.changes.length?` · 본선 자동반영 ${syncResult.changes.length}팀`:''}`);
  $('prelimResultDialog').close();
  prelimNotice('예선 순위와 진출팀을 다시 계산했습니다.','success');
}
function resetPrelimOnly(){
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


function createLinkedDraw(){
  pullPrelimSettings();
  ensurePrelimState(state);
  if(!state.prelim.groups.length)throw new Error('먼저 예선 조편성을 생성하세요.');
  const slots=generateLinkedDrawSlots(
    state.prelim.groups,
    state.prelim.settings.qualifiersPerGroup,
    Number($('drawSize').value)
  );
  state.settings.drawSize=Number($('drawSize').value);
  state.draw=createDrawWithMethod(state,slots,state.settings.drawSize,{method:state.settings.drawMethod||'instant',byePriority:state.settings.byePriority||'group-first'});
  state.courts=[];
  state.sharedQueue=[];
  state.prelim.linkedDraw={
    active:true,
    drawSize:state.settings.drawSize,
    slots:slots.map(s=>({
      placeholderKey:s.placeholderKey,
      label:s.name,
      groupNo:s.groupNo,
      groupRank:s.groupRank,
      resolvedTeamId:null,
      locked:false
    })),
    createdAt:new Date().toISOString(),
    lastSyncedAt:null
  };
  const result=syncLinkedDrawQualifiers(state.draw,state.prelim.qualifiers,{protectStarted:true});
  applyLinkedSyncResult(result);
  commit(`예선 슬롯 본선 선추첨 · ${slots.length}슬롯 · ${state.settings.drawSize}강`);
  prelimNotice('예선 조 순위 슬롯으로 본선 대진을 먼저 생성했습니다.','success');
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
    commit(`예선 확정팀 본선 반영 · ${result.changes.length}팀 · 잠금 ${result.locked.length}팀`);
    prelimNotice(`확정팀 ${result.changes.length}팀을 본선 슬롯에 반영했습니다.${result.locked.length?` 진행 경기 ${result.locked.length}건은 변경하지 않았습니다.`:''}`,'success');
  }
  return result;
}

function hardReset(){
  if(!confirm('V3의 현재 명단·대진·결과를 모두 초기화할까요?'))return;
  clearState();state=initialState();commit('전체 초기화');notice('초기화했습니다.','info');
}
function showRecoveries(){
  const root=$('recoveryList'),list=getRecoveries();
  root.innerHTML=list.length?list.map(x=>`<article class="recovery-item"><div><b>${x.label}</b><small>${new Date(x.createdAt).toLocaleString('ko-KR')}</small></div><button class="btn btn-primary" data-restore="${x.id}">복구</button><button class="btn btn-danger-outline" data-delete="${x.id}">삭제</button></article>`).join(''):'<div class="empty-state"><p>저장된 복구점이 없습니다.</p></div>';
  root.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{const item=getRecoveries().find(x=>x.id===b.dataset.restore);if(item){state=structuredClone(item.state);commit(`복구점 복원 · ${item.label}`);$('recoveryDialog').close();}});
  root.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{deleteRecovery(b.dataset.delete);showRecoveries();});
  $('recoveryDialog').showModal();
}

let timeTimer=null;
function refreshTimeEngine({save=false}={}){
  if(state.settings.autoTimeEnabled)calculateTimeMetrics(state);
  if(save)saveState(state);
  render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage});
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

function bind(){
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
  $('refreshQueueBtn').onclick=refreshQueue;$('resetBtn').onclick=hardReset;
  if($('recalculateTimeBtn'))$('recalculateTimeBtn').onclick=()=>{pullSettings();calculateTimeMetrics(state);commit('예상 대기시간 즉시 계산');notice('예상시간을 다시 계산했습니다.','success');};
  if($('autoTimeEnabled'))$('autoTimeEnabled').onchange=()=>{pullSettings();commit(`대기시간 자동계산 ${state.settings.autoTimeEnabled?'ON':'OFF'}`);restartTimeTimer();};
  if($('timeRefreshSeconds'))$('timeRefreshSeconds').onchange=()=>{pullSettings();commit(`진행시간 갱신주기 ${state.settings.timeRefreshSeconds}초`);restartTimeTimer();};
  $('confirmResultBtn').onclick=confirmResult;
  $('autoFitPrelimBtn').onclick=()=>{try{autoFitPrelim();}catch(e){prelimNotice(e.message,'error');}};
  $('generatePrelimBtn').onclick=()=>{try{createPrelim();}catch(e){prelimNotice(e.message,'error');}};
  $('assignPrelimCourtsBtn').onclick=()=>{try{assignPrelim();}catch(e){prelimNotice(e.message,'error');}};
  $('generateLinkedDrawBtn').onclick=()=>{try{createLinkedDraw();}catch(e){prelimNotice(e.message,'error');}};
  $('syncLinkedDrawBtn').onclick=()=>{try{syncLinkedDraw();}catch(e){prelimNotice(e.message,'error');}};
  $('confirmPrelimResultBtn').onclick=confirmPrelimResult;
  $('resetPrelimBtn').onclick=resetPrelimOnly;
  $('useQualifiersForDrawBtn').onclick=()=>{try{useQualifiersForDraw();}catch(e){prelimNotice(e.message,'error');}};
  $('exportJsonBtn').onclick=()=>downloadJson(`230match-v3-${Date.now()}.json`,state);
  $('saveRecoveryBtn').onclick=()=>{const item=saveRecovery(state,`${state.tournament.name} · ${state.tournament.division}`);log(`복구점 저장 · ${item.label}`);saveState(state);render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage});notice('복구점을 저장했습니다.','success');};
  $('openRecoveryBtn').onclick=showRecoveries;$('closeRecoveryBtn').onclick=()=>$('recoveryDialog').close();
  $('clearLogsBtn').onclick=()=>{state.logs=[];commit();};
  if($('generateTimeMessagesBtn'))$('generateTimeMessagesBtn').onclick=createAllTimeMessages;
  if($('generateCurrentCourtMessagesBtn'))$('generateCurrentCourtMessagesBtn').onclick=createCurrentCourtMessages;
  if($('generateCurrentWaitMessagesBtn'))$('generateCurrentWaitMessagesBtn').onclick=createCurrentWaitMessages;
  if($('generateAllTimeMessagesBtn'))$('generateAllTimeMessagesBtn').onclick=createAllTimeMessages;
  if($('markAllMessagesSentBtn'))$('markAllMessagesSentBtn').onclick=()=>{markAllSent(state);commit('모든 대기 문자를 발송완료로 표시');};
  if($('clearSentMessagesBtn'))$('clearSentMessagesBtn').onclick=()=>{clearSentMessages(state);commit('발송완료 문자 정리');};
  if($('messageStatusFilter'))$('messageStatusFilter').onchange=()=>render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage});
  ['autoMessageEnabled','messageSenderName','messageDeliveryMode','messageOnCourtAssign','messageOnQueueMove','templatePlaying','templateWait1','templateShared'].forEach(id=>{const el=$(id);if(el)el.addEventListener('change',()=>{pullSettings();commit('문자 설정 변경');});});
  document.querySelectorAll('.tab').forEach(tab=>tab.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));tab.classList.add('active');$(`view-${tab.dataset.view}`).classList.add('active');});
  ['tournamentName','divisionName','drawSize','courtCount','courtPrefix','matchMinutes','minimumMatchMinutes','drawMethod','byePriority'].forEach(id=>{
    const el=$(id);if(el)el.addEventListener('change',()=>{pullSettings();commit('대회 설정 변경');});
  });
}
syncInputs();syncPrelimInputs();bind();calculateTimeMetrics(state);render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage});restartTimeTimer();updateClock();setInterval(updateClock,1000);
console.log('[230MATCH V3] stage7 message-center loaded · no legacy code · no Firebase writes');
