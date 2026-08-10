import{getAuthConfig,saveAuthConfig,startAuth,signInGoogle,signOutSocial,beginExternalLogin,getExistingLoginEndpoints,signInEmail,registerEmail,sendPasswordReset,linkEmailPassword,authProviderIds,getAuthRuntime}from'./auth-engine.js?v=3565';
import{uploadManagedImage,deleteManagedImage,managedImageUrl}from'./storage-image-engine-v6200.js?v=6200';
import{notificationSupport,getStoredVapidKey,saveStoredVapidKey,enableMyPush,disableMyPush,queuePush,listPushJobs,listPushTokens}from'./notification-engine.js?v=332012';

import{loadState,saveState,clearState,saveRecovery,getRecoveries,getRecovery,deleteRecovery,prepareRecoveryStorage,initialState}from'./store-v6200.js?v=6200';
import{prepareTeams,generateDraw,allMatches,findMatch,generateLinkedDrawSlots,syncLinkedDrawQualifiers}from'./bracket-engine-v5000.js?v=5000';
import{ensureDrawMeta,canModifyDraw,createDrawWithMethod,lockDraw,unlockDrawForDevelopment,clearDrawHistory}from'./draw-method-engine.js?v=332012';
import{buildCourts,assignInitial,queueReadyMatches,refillCourt}from'./court-engine.js?v=332012';
import{submitResult}from'./result-engine.js?v=332012';
import{ensurePrelimState,generatePrelim,assignPrelimCourts,findPrelimMatch,submitPrelimResult,resetPrelim,autoFitPrelimGroups,swapActiveReserveTeam,isPrelimLocked,lockPrelim,unlockPrelim}from'./prelim-engine.js?v=3511';
import{downloadJson}from'./recovery.js?v=332012';
import{ensureTimeState,calculateTimeMetrics}from'./time-engine-v5000.js?v=5000';
import{ensureMessagingState,generatePlayingMessages,generateWait1Messages,generateCurrentCourtMessages,generateCurrentWaitMessages,generateAllTimeMessages,markMessageSent,deleteMessage,clearSentMessages,markAllSent,smsUri,refreshMessageContacts,mergePendingDuplicates,getMessageHistory}from'./message-engine.js?v=3521';
import{ensureContacts,getTeamContact,setTeamContact,validatePhone,exportContactData,importContactData}from'./contact-engine-v5000.js?v=5000';
import{render,teamText}from'./ui.js?v=3504';
import{ensureAuditState,runStateAudit,runPrelimSimulation,runFullSimulation,applyAuditResult}from'./audit-engine.js?v=332012';
import{earlyMainStats,markResolvedMainMatchesReady,canAssignEarlyMain,ensureEarlyMainSettings,autoAssignResolvedMain}from'./early-main-engine.js?v=332012';
import{useUnifiedCourts,prelimPriorityActive,enqueueReadyMainToUnifiedCourts,advanceUnifiedCourt,reconcileUnifiedMainQueues,findUnifiedMatch,moveUnifiedCourtMatchFlexible,reconcilePrelimCourtReservations}from'./unified-court-engine.js?v=3542';
import{ensureMainDrawLifecycle,beginMainDraw,completeMainDraw,failMainDraw,resetMainDraw,hasAuthorizedMainDraw,mainDrawStatus,clearMainPlacement,repairMainDrawAuthorization}from'./main-draw-lifecycle-engine.js?v=3501';
import{shouldUseLinkedDraw,linkedDrawNeedsRepair,rebuildLinkedDraw,hasStartedMainMatches}from'./linked-draw-guard-engine.js?v=332012';
import{ensureVenueSettings,ensureVenueQueues,venuePreset,buildVenueCourts,prelimVenues,mainVenues}from'./venue-engine.js?v=332012';
import{moveQueueItem,reorderQueueItem}from'./queue-control-engine.js?v=332012';
import{availableCourtSlots,assignQueueMatchToCourt,returnWait1ToVenueQueue}from'./manual-court-engine.js?v=332012';

import{ensureCourtStatuses,pauseCourt,resumeCourt}from'./court-status-engine.js?v=332012';
import{ensureCourtManualQueues,assignToCourtManualQueue,moveCourtMatchFlexible,returnManualQueueItemToVenue,reorderCourtManualQueue}from'./court-manual-queue-engine.js?v=332012';
import{reorderPrelimQueue as reorderPrelimQueueItem,movePrelimQueuedMatch,returnPrelimWait1ToQueue}from'./prelim-queue-control-engine.js?v=332012';
import{ensurePrelimCourtStatuses,pausePrelimCourt,resumePrelimCourt}from'./prelim-court-status-engine.js?v=332012';
import{startStateSync,getSyncSettings,saveSyncSettings,connectCloudSync,disconnectCloudSync,pushStateNow,pullStateNow,testCloudConnection,prepareCriticalCloudWrite,deleteTournamentNow}from'./sync-engine-v6200.js?v=6200';
import{verifyAndRepairMainFlow}from'./main-flow-integrity-engine.js?v=332012';
import{finalizeTournamentCompletion}from'./tournament-completion-engine.js?v=332012';
import{ensureTournamentIdentity,validateTournamentForArchive,createTournamentArchive,archiveListItem,archiveBackupPayload}from'./archive-engine.js?v=354000';
import{listExistingTournaments,loadExistingTournament,convertExistingTournament}from'./legacy-firestore-bridge.js?v=332023';


const BUILD_LABEL='230MATCH 3.0.2 · 빈 대회 정리본';

const REHEARSAL_KEY='230match-v3-rehearsal-report';
const REHEARSAL_UNLOCK_KEY='230match-v3-rehearsal-unlocked';
function isRehearsalUnlocked(){try{return sessionStorage.getItem(REHEARSAL_UNLOCK_KEY)==='1';}catch(_e){return false;}}
function unlockRehearsalMode(){if(!requireAdmin('리허설 모드'))return false;const typed=prompt('실제 대회 데이터와 분리된 리허설 모드입니다. 잠금을 해제하려면 “리허설”을 입력하세요.');if(typed!=='리허설'){notice('리허설 잠금 해제를 취소했습니다.','warning');return false;}try{sessionStorage.setItem(REHEARSAL_UNLOCK_KEY,'1');}catch(_e){}notice('리허설 모드 잠금을 해제했습니다.','success');return true;}
function lockRehearsalMode(){try{sessionStorage.removeItem(REHEARSAL_UNLOCK_KEY);}catch(_e){}rehearsalReport=null;try{sessionStorage.removeItem(REHEARSAL_KEY);}catch(_e){}notice('리허설 모드를 잠갔습니다.','success');navigatePortalView('home',{pushHistory:true});}

function createRehearsalTeams(count=32){
  return Array.from({length:count},(_,i)=>({id:`rehearsal-team-${i+1}`,name:`테스트팀 ${String(i+1).padStart(2,'0')}`,players:[`선수${i*2+1}`,`선수${i*2+2}`],club:`테스트클럽 ${Math.floor(i/4)+1}`,status:'active'}));
}
function buildRehearsalSandbox(teamCount=32){
  const sim=initialState();
  sim.tournament={name:'230MATCH 리허설 전용 대회',division:'자동 시뮬레이션'};
  sim.teams=createRehearsalTeams(teamCount);
  sim.settings={...sim.settings,drawSize:teamCount<=32?32:teamCount<=64?64:128,courtCount:Math.min(8,Math.max(2,Math.ceil(teamCount/12)))};
  sim.settings.venues=[{id:'rehearsal-venue',name:'리허설구장',courtCount:sim.settings.courtCount,courtPrefix:'테스트'}];
  const fit=autoFitPrelimGroups(teamCount);
  sim.prelim.settings={...sim.prelim.settings,activeTeamCount:teamCount,...fit,courtCount:sim.settings.courtCount,courtPrefix:'테스트',qualifiersPerGroup:2};
  generatePrelim(sim,sim.prelim.settings);
  assignPrelimCourts(sim);
  const slots=generateLinkedDrawSlots(sim.prelim.groups,2,sim.settings.drawSize);
  sim.draw=generateDraw(slots,sim.settings.drawSize);
  sim.prelim.linkedDraw={active:true,drawSize:sim.settings.drawSize,slots,createdAt:new Date().toISOString(),lastSyncedAt:null};
  return sim;
}
function rehearsalPayload(teamCount=32){
  const started=performance.now();
  let sandbox,prelim,full,audit,error='';
  try{
    sandbox=buildRehearsalSandbox(teamCount);
    prelim=runPrelimSimulation(sandbox);
    full=runFullSimulation(sandbox);
    audit=runStateAudit(sandbox);
  }catch(e){error=e?.message||String(e);storeDiagnosticEntry({level:'error',message:`리허설 실패: ${error}`});}
  return {format:'230MATCH_V3_REHEARSAL',build:BUILD_LABEL,generatedAt:new Date().toISOString(),teamCount,elapsedMs:Math.round(performance.now()-started),isolated:true,realStateChanged:false,prelim,full,audit,error};
}
let rehearsalReport=null;
try{rehearsalReport=JSON.parse(sessionStorage.getItem(REHEARSAL_KEY)||'null');}catch(_e){rehearsalReport=null;}
function renderRehearsal(report=rehearsalReport){
  const overall=document.getElementById('rehearsalOverall');if(!overall)return;
  const summary=document.getElementById('rehearsalSummary');const stages=document.getElementById('rehearsalStages');const details=document.getElementById('rehearsalDetails');
  if(!report){overall.className='rehearsal-overall';overall.textContent='리허설 대기 중';if(summary)summary.innerHTML='<div class="portal-empty">팀 수를 선택하고 리허설을 실행하세요.</div>';if(stages)stages.innerHTML='';if(details)details.innerHTML='<div class="portal-empty">리허설 실행 후 세부 점검 항목이 표시됩니다.</div>';return;}
  const ok=!report.error&&report.prelim?.success&&report.full?.success;
  overall.className=`rehearsal-overall ${ok?'safe':'danger'}`;
  overall.innerHTML=`<strong>${ok?'리허설 완주 · PASS':'리허설 확인 필요 · HOLD'}</strong><span>${report.teamCount}팀 · ${report.elapsedMs}ms · 실제 데이터 변경 없음</span>`;
  const rows=[
    ['격리 샌드박스',report.isolated&&report.realStateChanged===false,'실제 운영 상태와 분리'],
    ['테스트팀·예선 생성',Boolean(report.prelim),report.prelim?`${report.prelim.totalGroups}조 · ${report.prelim.totalMatches}경기`:'생성 실패'],
    ['예선 자동 완주',report.prelim?.success,report.prelim?`${report.prelim.completedMatches}/${report.prelim.totalMatches}경기 · ${report.prelim.rankedGroups}/${report.prelim.totalGroups}조 순위`:'미실행'],
    ['본선 자동 완주',report.full?.success,report.full?`${report.full.completedMatches}경기 · BYE ${report.full.autoByeCount} · 우승 ${report.full.winner?.name||'-'}`:'미실행'],
    ['데이터 정합성 검사',report.audit?.overall!=='fail',report.audit?`통과 ${report.audit.counts.pass} · 경고 ${report.audit.counts.warn} · 실패 ${report.audit.counts.fail}`:'미실행']
  ];
  if(stages)stages.innerHTML=rows.map(([label,pass,detail])=>`<article class="rehearsal-stage ${pass?'ok':'fail'}"><span>${pass?'✓':'×'}</span><div><strong>${escapeHtml(label)}</strong><p>${escapeHtml(detail)}</p></div></article>`).join('');
  if(summary)summary.innerHTML=`<div><span>실행 시각</span><strong>${new Date(report.generatedAt).toLocaleString('ko-KR')}</strong></div><div><span>테스트 규모</span><strong>${report.teamCount}팀 / ${report.full?.totalMatches||0} 본선경기</strong></div><div><span>우승팀</span><strong>${escapeHtml(report.full?.winner?.name||'-')}</strong></div><div><span>실행 시간</span><strong>${report.elapsedMs}ms</strong></div>${report.error?`<div class="wide"><span>오류</span><strong>${escapeHtml(report.error)}</strong></div>`:''}`;
  if(details){
    const auditItems=Array.isArray(report.audit?.results)?report.audit.results:[];
    const structural=[
      {level:report.full?.success?'pass':'fail',title:'본선 완주 판정',detail:report.full?.success?`실경기 ${report.full.completedMatches}경기 · 자동 BYE ${report.full.autoByeCount}건 · 우승 ${report.full.winner?.name||'-'}`:`미완료 ${report.full?.unfinished?.length||0}경기 · 사유 ${report.full?.reason||'확인 필요'}`},
      {level:'pass',title:'빈 대진 슬롯 처리',detail:`참가팀 수보다 큰 대진표의 빈 슬롯은 경기 실패가 아니라 VOID/BYE로 제외합니다.`}
    ];
    const items=[...structural,...auditItems];
    details.innerHTML=items.map(item=>`<article class="rehearsal-detail ${item.level||'pass'}"><span>${item.level==='fail'?'×':item.level==='warn'?'!':'✓'}</span><div><strong>${escapeHtml(item.title||item.code||'점검 항목')}</strong><p>${escapeHtml(item.detail||'')}</p></div></article>`).join('')||'<div class="portal-empty">세부 점검 항목이 없습니다.</div>';
  }
}
function bindRehearsalCenter(){
  document.getElementById('runRehearsalBtn')?.addEventListener('click',()=>{
    if(!requireAdmin('리허설 실행'))return;
    const count=Number(document.getElementById('rehearsalTeamCount')?.value||32);
    if(!confirm(`${count}팀 격리 리허설을 실행할까요? 실제 대회 데이터는 변경되지 않습니다.`))return;
    rehearsalReport=rehearsalPayload(count);try{sessionStorage.setItem(REHEARSAL_KEY,JSON.stringify(rehearsalReport));}catch(_e){}
    renderRehearsal();notice(rehearsalReport.full?.success?'리허설을 완주했습니다.':'리허설에서 확인할 항목이 발견됐습니다.',rehearsalReport.full?.success?'success':'error');
  });
  document.getElementById('downloadRehearsalBtn')?.addEventListener('click',()=>{if(!rehearsalReport)return notice('먼저 리허설을 실행하세요.','error');downloadJson(`230match-rehearsal-${rehearsalReport.teamCount}teams-${Date.now()}.json`,rehearsalReport);});
  document.getElementById('clearRehearsalBtn')?.addEventListener('click',()=>{rehearsalReport=null;sessionStorage.removeItem(REHEARSAL_KEY);renderRehearsal();});
  document.getElementById('lockRehearsalBtn')?.addEventListener('click',lockRehearsalMode);
  renderRehearsal();
}


const PERFORMANCE_REPORT_KEY='230match-v3-performance-report';
let performanceReport=null;
try{performanceReport=JSON.parse(sessionStorage.getItem(PERFORMANCE_REPORT_KEY)||'null');}catch(_e){performanceReport=null;}
const perfRound=n=>Math.round(Number(n||0)*10)/10;
function perfAverage(list,key){return list.length?list.reduce((sum,item)=>sum+Number(item[key]||0),0)/list.length:0;}
function runSinglePerformanceBenchmark(teamCount){
  const result={teamCount};
  let sandbox;
  let t=performance.now();
  sandbox=buildRehearsalSandbox(teamCount);
  result.generateMs=performance.now()-t;
  t=performance.now();
  const prelim=runPrelimSimulation(sandbox);
  result.prelimMs=performance.now()-t;result.prelimMatches=prelim?.totalMatches||0;result.prelimSuccess=Boolean(prelim?.success);
  t=performance.now();
  const full=runFullSimulation(sandbox);
  result.mainMs=performance.now()-t;result.mainMatches=full?.totalMatches||0;result.mainSuccess=Boolean(full?.success);
  t=performance.now();
  const audit=runStateAudit(sandbox);
  result.auditMs=performance.now()-t;result.auditFail=audit?.counts?.fail||0;
  t=performance.now();
  const serialized=JSON.stringify(sandbox);
  result.serializeMs=performance.now()-t;result.stateBytes=new Blob([serialized]).size;
  const names=(sandbox.teams||[]).map(x=>`${x.name||''} ${(x.players||[]).join(' ')} ${x.club||''}`.toLowerCase());
  t=performance.now();
  for(let r=0;r<150;r++){const q=`테스트팀 ${String((r%teamCount)+1).padStart(2,'0')}`.toLowerCase();names.filter(x=>x.includes(q));}
  result.search150Ms=performance.now()-t;
  t=performance.now();
  const frag=document.createDocumentFragment();
  for(let i=0;i<Math.min(600,teamCount*5);i++){const el=document.createElement('article');el.className='performance-probe-card';el.textContent=`${i+1} · ${names[i%names.length]||''}`;frag.appendChild(el);}
  const probe=document.createElement('div');probe.style.cssText='position:fixed;left:-99999px;top:-99999px';probe.appendChild(frag);document.body.appendChild(probe);result.domBuildMs=performance.now()-t;probe.remove();
  result.totalMs=result.generateMs+result.prelimMs+result.mainMs+result.auditMs+result.serializeMs+result.search150Ms+result.domBuildMs;
  return result;
}
function buildPerformanceReport(teamCount=96,iterations=3){
  const started=performance.now();const runs=[];let error='';
  try{for(let i=0;i<iterations;i++)runs.push(runSinglePerformanceBenchmark(teamCount));}catch(e){error=e?.message||String(e);storeDiagnosticEntry({level:'error',message:`성능 테스트 실패: ${error}`});}
  const averages={};['generateMs','prelimMs','mainMs','auditMs','serializeMs','search150Ms','domBuildMs','totalMs','stateBytes'].forEach(k=>averages[k]=perfRound(perfAverage(runs,k)));
  const maxTotal=runs.length?Math.max(...runs.map(x=>x.totalMs)):0;
  const success=!error&&runs.length===iterations&&runs.every(x=>x.prelimSuccess&&x.mainSuccess&&!x.auditFail);
  let grade='A';if(averages.totalMs>1800||averages.mainMs>900)grade='C';else if(averages.totalMs>900||averages.mainMs>450)grade='B';
  return{format:'230MATCH_V3_PERFORMANCE',build:BUILD_LABEL,generatedAt:new Date().toISOString(),teamCount,iterations,elapsedMs:perfRound(performance.now()-started),isolated:true,realStateChanged:false,success,grade,averages,maxTotalMs:perfRound(maxTotal),runs,error,environment:{userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency||null,deviceMemory:navigator.deviceMemory||null}};
}
function performanceAdvice(report){
  if(!report)return[];const a=report.averages||{};const rows=[];
  rows.push({ok:report.success,title:'전체 시뮬레이션 정합성',text:report.success?'모든 반복에서 예선·본선·감사가 정상 완주했습니다.':'실패한 반복이 있습니다. 진단 JSON을 확인하세요.'});
  rows.push({ok:a.totalMs<=900,title:'전체 처리 속도',text:a.totalMs<=900?`평균 ${a.totalMs}ms로 원활합니다.`:`평균 ${a.totalMs}ms입니다. 대회 당일 불필요한 브라우저 탭을 닫고 최신 기기를 권장합니다.`});
  rows.push({ok:a.mainMs<=450,title:'128드로 본선 처리',text:a.mainMs<=450?`평균 ${a.mainMs}ms로 안정적입니다.`:`평균 ${a.mainMs}ms입니다. 본선 화면은 필요한 때만 열고 연속 재추첨을 피하세요.`});
  rows.push({ok:a.stateBytes<=3500000,title:'상태 데이터 크기',text:a.stateBytes<=3500000?`${Math.round(a.stateBytes/1024)}KB로 브라우저 저장에 여유가 있습니다.`:`${Math.round(a.stateBytes/1024)}KB입니다. 외부 JSON 백업과 Firebase 동기화를 함께 사용하세요.`});
  rows.push({ok:a.domBuildMs<=120,title:'대량 목록 렌더링',text:a.domBuildMs<=120?`가상 카드 렌더링 ${a.domBuildMs}ms로 양호합니다.`:`가상 카드 렌더링 ${a.domBuildMs}ms입니다. 참가자 검색으로 목록을 좁혀 사용하는 것이 좋습니다.`});
  return rows;
}
function renderPerformanceCenter(){
  const overall=document.getElementById('performanceOverall');if(!overall)return;const metrics=document.getElementById('performanceMetrics');const advice=document.getElementById('performanceAdvice');const grade=document.getElementById('performanceGrade');
  if(!performanceReport){overall.className='performance-overall';overall.textContent='테스트 대기 중';if(metrics)metrics.innerHTML='<div class="portal-empty">부하 테스트를 실행하세요.</div>';if(advice)advice.innerHTML='<div class="portal-empty">측정 결과가 없습니다.</div>';if(grade){grade.textContent='대기';grade.className='badge';}return;}
  const r=performanceReport,a=r.averages||{};overall.className=`performance-overall ${r.success?'safe':'danger'}`;overall.innerHTML=`<strong>${r.success?'대용량 테스트 완료 · PASS':'확인 필요 · HOLD'}</strong><span>${r.teamCount}팀 × ${r.iterations}회 · 평균 ${a.totalMs||0}ms</span>`;
  if(grade){grade.textContent=`등급 ${r.grade}`;grade.className=`badge performance-grade grade-${String(r.grade).toLowerCase()}`;}
  const items=[['샌드박스 생성',a.generateMs,'ms'],['예선 전체 처리',a.prelimMs,'ms'],['본선 전체 처리',a.mainMs,'ms'],['정합성 감사',a.auditMs,'ms'],['JSON 직렬화',a.serializeMs,'ms'],['검색 150회',a.search150Ms,'ms'],['대량 DOM 생성',a.domBuildMs,'ms'],['상태 크기',Math.round((a.stateBytes||0)/1024),'KB']];
  if(metrics)metrics.innerHTML=items.map(([label,val,unit])=>`<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(val))}${unit}</strong></div>`).join('')+(r.error?`<div class="wide danger"><span>오류</span><strong>${escapeHtml(r.error)}</strong></div>`:'');
  if(advice)advice.innerHTML=performanceAdvice(r).map(x=>`<article class="performance-advice-item ${x.ok?'ok':'warn'}"><span>${x.ok?'✓':'!'}</span><div><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.text)}</p></div></article>`).join('');
}
function bindPerformanceCenter(){
  document.getElementById('runPerformanceBtn')?.addEventListener('click',()=>{if(!requireAdmin('대용량 성능 테스트'))return;const count=Number(document.getElementById('performanceTeamCount')?.value||96);const iterations=Number(document.getElementById('performanceIterations')?.value||3);if(!confirm(`${count}팀 부하 테스트를 ${iterations}회 실행할까요? 실제 데이터는 변경되지 않습니다.`))return;const btn=document.getElementById('runPerformanceBtn');if(btn){btn.disabled=true;btn.textContent='측정 중...';}setTimeout(()=>{try{performanceReport=buildPerformanceReport(count,iterations);sessionStorage.setItem(PERFORMANCE_REPORT_KEY,JSON.stringify(performanceReport));renderPerformanceCenter();notice(performanceReport.success?'대용량 부하 테스트를 완료했습니다.':'부하 테스트에서 확인할 항목이 발견됐습니다.',performanceReport.success?'success':'error');}finally{if(btn){btn.disabled=false;btn.textContent='부하 테스트 실행';}}},30);});
  document.getElementById('downloadPerformanceBtn')?.addEventListener('click',()=>{if(!performanceReport)return notice('먼저 부하 테스트를 실행하세요.','error');downloadJson(`230match-performance-${performanceReport.teamCount}teams-${Date.now()}.json`,performanceReport);});
  document.getElementById('clearPerformanceBtn')?.addEventListener('click',()=>{performanceReport=null;sessionStorage.removeItem(PERFORMANCE_REPORT_KEY);renderPerformanceCenter();});
  renderPerformanceCenter();
}

const DIAGNOSTICS_KEY='230match-v3-diagnostics';
let diagnosticEntries=[];
try{diagnosticEntries=JSON.parse(sessionStorage.getItem(DIAGNOSTICS_KEY)||'[]');if(!Array.isArray(diagnosticEntries))diagnosticEntries=[];}catch(_error){diagnosticEntries=[];}
function storeDiagnosticEntry(entry){
  diagnosticEntries.push({id:crypto.randomUUID?.()||String(Date.now()),time:new Date().toISOString(),...entry});
  diagnosticEntries=diagnosticEntries.slice(-80);
  try{sessionStorage.setItem(DIAGNOSTICS_KEY,JSON.stringify(diagnosticEntries));}catch(_error){}
}
window.addEventListener('error',event=>storeDiagnosticEntry({level:'error',message:event.message||'스크립트 오류',source:event.filename||'',line:event.lineno||0,column:event.colno||0,stack:event.error?.stack||''}));
window.addEventListener('unhandledrejection',event=>storeDiagnosticEntry({level:'error',message:String(event.reason?.message||event.reason||'처리되지 않은 Promise 오류'),stack:event.reason?.stack||''}));
function diagnosticText(value){
  if(typeof value==='string')return value;
  if(value instanceof Error)return `${value.name}: ${value.message}${value.stack?`\n${value.stack}`:''}`;
  const seen=new WeakSet();
  try{return JSON.stringify(value,(_key,item)=>{if(typeof item==='object'&&item!==null){if(seen.has(item))return '[Circular]';seen.add(item);}return item;});}
  catch(_error){try{return String(value);}catch{return '[Unserializable]';}}
}
const originalConsoleError=console.error.bind(console);console.error=(...args)=>{try{storeDiagnosticEntry({level:'error',message:args.map(diagnosticText).join(' ').slice(0,2000)});}catch(_error){}originalConsoleError(...args);};
const originalConsoleWarn=console.warn.bind(console);console.warn=(...args)=>{try{storeDiagnosticEntry({level:'warning',message:args.map(diagnosticText).join(' ').slice(0,2000)});}catch(_error){}originalConsoleWarn(...args);};
function diagnosticsChecks(){
  const auth=getAuthRuntime?.()||{};
  let storageOk=true;try{localStorage.setItem('__230diag','1');localStorage.removeItem('__230diag');}catch(_error){storageOk=false;}
  const requiredIds=['openAdminSettingsHubBtn','adminSettingsHub','view-home','view-entry','view-operation','view-bracket'];
  const missing=requiredIds.filter(id=>!document.getElementById(id));
  return [
    {label:'앱 스크립트 실행',ok:true,detail:BUILD_LABEL},
    {label:'필수 화면 요소',ok:missing.length===0,detail:missing.length?`누락: ${missing.join(', ')}`:'필수 화면 요소 정상'},
    {label:'브라우저 저장소',ok:storageOk,detail:storageOk?'localStorage 사용 가능':'저장소 접근 불가'},
    {label:'현재 대회 데이터',ok:Boolean(state?.tournament&&Array.isArray(state?.teams)),detail:state?.tournament?.name||'대회 데이터 없음'},
    {label:'간편로그인 엔진',ok:Boolean(getExistingLoginEndpoints&&getAuthRuntime),detail:auth?.user?`${auth.user.displayName||auth.user.email||'로그인 사용자'} 연결됨`:'엔진 준비됨 · 현재 로그아웃'},
    {label:'온라인 연결',ok:navigator.onLine,detail:navigator.onLine?'네트워크 연결됨':'오프라인 상태'},
    {label:'Service Worker 지원',ok:'serviceWorker' in navigator,detail:'serviceWorker' in navigator?'지원됨':'지원되지 않음',optional:true},
    {label:'최근 실행 오류',ok:diagnosticEntries.filter(x=>x.level==='error').length===0,detail:`오류 ${diagnosticEntries.filter(x=>x.level==='error').length}건 · 경고 ${diagnosticEntries.filter(x=>x.level==='warning').length}건`}
  ];
}
function buildDiagnosticsPayload(){
  const checks=diagnosticsChecks();
  return {format:'230MATCH_V3_DIAGNOSTICS',build:BUILD_LABEL,generatedAt:new Date().toISOString(),url:location.href,userAgent:navigator.userAgent,online:navigator.onLine,role:typeof currentRole==='string'?currentRole:'unknown',tournament:{name:state?.tournament?.name||'',division:state?.tournament?.division||'',teams:state?.teams?.length||0,prelimMatches:state?.prelim?.matches?.length||0,mainMatches:allMatches?.(state)?.length||0},checks,entries:diagnosticEntries.slice(-80)};
}
function renderDiagnostics(){
  const checksEl=document.getElementById('diagnosticsChecks');if(!checksEl)return;
  const checks=diagnosticsChecks();const failures=checks.filter(x=>!x.ok&&!x.optional).length;
  checksEl.innerHTML=checks.map(x=>`<article class="diagnostics-check ${x.ok?'ok':x.optional?'warn':'fail'}"><span>${x.ok?'✓':x.optional?'!':'×'}</span><div><strong>${escapeHtml(x.label)}</strong><p>${escapeHtml(x.detail)}</p></div></article>`).join('');
  const overall=document.getElementById('diagnosticsOverall');if(overall){overall.className=`diagnostics-overall ${failures?'danger':'safe'}`;overall.textContent=failures?`확인이 필요한 항목 ${failures}건`:'주요 시스템 상태 정상';}
  const list=document.getElementById('diagnosticsErrorList');const count=document.getElementById('diagnosticsErrorCount');if(count)count.textContent=`${diagnosticEntries.length}건`;
  if(list)list.innerHTML=diagnosticEntries.length?diagnosticEntries.slice().reverse().map(x=>`<article class="diagnostics-error ${x.level==='warning'?'warning':'error'}"><div><strong>${x.level==='warning'?'경고':'오류'}</strong><time>${new Date(x.time).toLocaleString('ko-KR')}</time></div><p>${escapeHtml(x.message||'')}</p>${x.source?`<small>${escapeHtml(x.source)}${x.line?`:${x.line}`:''}</small>`:''}</article>`).join(''):'<div class="portal-empty">기록된 오류가 없습니다.</div>';
  const summary=document.getElementById('diagnosticsSummary');if(summary){const p=buildDiagnosticsPayload();summary.textContent=[p.build,`대회: ${p.tournament.name||'-'}`,`권한: ${p.role}`,`온라인: ${p.online?'예':'아니오'}`,`점검: ${checks.filter(x=>x.ok).length}/${checks.length} 정상`,`오류 기록: ${p.entries.length}건`].join('\n');}
}
function bindDiagnosticsCenter(){
  document.getElementById('runDiagnosticsBtn')?.addEventListener('click',()=>{renderDiagnostics();notice('시스템 진단을 다시 실행했습니다.','success');});
  document.getElementById('downloadDiagnosticsBtn')?.addEventListener('click',()=>downloadJson(`230match-diagnostics-${Date.now()}.json`,buildDiagnosticsPayload()));
  document.getElementById('copyDiagnosticsBtn')?.addEventListener('click',async()=>{const text=document.getElementById('diagnosticsSummary')?.textContent||JSON.stringify(buildDiagnosticsPayload(),null,2);try{await navigator.clipboard.writeText(text);notice('진단 요약을 복사했습니다.','success');}catch(_error){notice('클립보드 복사에 실패했습니다.','error');}});
  document.getElementById('clearDiagnosticsBtn')?.addEventListener('click',()=>{if(!confirm('현재 브라우저의 오류 기록을 지울까요?'))return;diagnosticEntries=[];try{sessionStorage.removeItem(DIAGNOSTICS_KEY);}catch(_error){}renderDiagnostics();});
  renderDiagnostics();
}
function acceptanceChecks(){
  const requiredViews=['home','tournaments','prelim-public','my-match','entry','guide','board','participants','records','print','operation','bracket','settings','readiness','diagnostics'];
  const requiredButtons=['openAdminSettingsHubBtn','openSocialLoginBtn'];
  const teamIds=(state?.teams||[]).map(x=>String(x?.id||'')).filter(Boolean);
  const duplicateTeamIds=teamIds.filter((id,index)=>teamIds.indexOf(id)!==index);
  const prelimMatches=state?.prelim?.matches||[];
  const mainMatches=typeof allMatches==='function'?allMatches(state):[];
  const matchIds=[...prelimMatches,...mainMatches].map(x=>String(x?.id||'')).filter(Boolean);
  const duplicateMatchIds=matchIds.filter((id,index)=>matchIds.indexOf(id)!==index);
  const courts=(state?.venues||[]).flatMap(v=>(v?.courts||[]).map(c=>typeof c==='string'?c:c?.name||c?.id||'')).filter(Boolean);
  return [
    {group:'화면',label:'필수 페이지 존재',ok:requiredViews.every(v=>document.getElementById(`view-${v}`)),detail:`${requiredViews.filter(v=>document.getElementById(`view-${v}`)).length}/${requiredViews.length}개`,required:true},
    {group:'화면',label:'설정 허브 존재',ok:Boolean(document.getElementById('adminSettingsHub')),detail:document.getElementById('adminSettingsHub')?'정상':'설정 시트 누락',required:true},
    {group:'화면',label:'주요 버튼 연결',ok:requiredButtons.every(id=>document.getElementById(id)),detail:`${requiredButtons.filter(id=>document.getElementById(id)).length}/${requiredButtons.length}개`,required:true},
    {group:'로그인',label:'간편로그인 엔진',ok:typeof startAuth==='function'&&typeof signInGoogle==='function'&&typeof beginExternalLogin==='function',detail:'네이버·카카오·구글 연결 함수',required:true},
    {group:'저장',label:'로컬 저장 가능',ok:(()=>{try{const k='__230_acceptance__';localStorage.setItem(k,'1');localStorage.removeItem(k);return true;}catch(_e){return false;}})(),detail:'localStorage 쓰기 테스트',required:true},
    {group:'저장',label:'상태 저장 함수',ok:typeof saveState==='function'&&typeof saveRecovery==='function',detail:'현재 상태·복구점 함수',required:true},
    {group:'대회',label:'대회 기본정보',ok:Boolean(state?.tournament?.name),detail:state?.tournament?.name||'대회명 미설정',required:true},
    {group:'대회',label:'참가팀 ID 중복 없음',ok:duplicateTeamIds.length===0,detail:duplicateTeamIds.length?`중복 ${[...new Set(duplicateTeamIds)].length}건`:`${teamIds.length}팀 정상`,required:true},
    {group:'경기',label:'경기 ID 중복 없음',ok:duplicateMatchIds.length===0,detail:duplicateMatchIds.length?`중복 ${[...new Set(duplicateMatchIds)].length}건`:`${matchIds.length}경기 정상`,required:true},
    {group:'경기',label:'예선 데이터 구조',ok:Array.isArray(state?.prelim?.matches),detail:`예선 ${prelimMatches.length}경기`,required:true},
    {group:'경기',label:'본선 데이터 구조',ok:Array.isArray(mainMatches),detail:`본선 ${mainMatches.length}경기`,required:true},
    {group:'코트',label:'코트 설정',ok:courts.length>0,detail:courts.length?`${courts.length}면 확인`:'등록 코트 없음',required:true},
    {group:'운영',label:'설정 버튼 직접 연결',ok:typeof window.openAdminSettingsHub==='function',detail:typeof window.openAdminSettingsHub==='function'?'정상':'함수 미연결',required:true},
    {group:'운영',label:'오류 기록',ok:diagnosticEntries.filter(x=>x.level==='error').length===0,detail:`오류 ${diagnosticEntries.filter(x=>x.level==='error').length}건 · 경고 ${diagnosticEntries.filter(x=>x.level==='warning').length}건`,required:false},
    {group:'네트워크',label:'온라인 연결',ok:navigator.onLine,detail:navigator.onLine?'온라인':'오프라인 운영 중',required:false},
    {group:'브라우저',label:'Service Worker 지원',ok:'serviceWorker' in navigator,detail:'serviceWorker' in navigator?'지원됨':'지원되지 않음',required:false}
  ];
}
function buildAcceptancePayload(){
  const checks=acceptanceChecks(),failed=checks.filter(x=>x.required&&!x.ok);
  return {format:'230MATCH_V3_OPERATION_ACCEPTANCE',build:BUILD_LABEL,generatedAt:new Date().toISOString(),url:location.href,role:typeof currentRole==='string'?currentRole:'unknown',releaseDecision:failed.length?'HOLD':'PASS',tournament:{name:state?.tournament?.name||'',division:state?.tournament?.division||'',teams:state?.teams?.length||0,prelimMatches:state?.prelim?.matches?.length||0,mainMatches:typeof allMatches==='function'?allMatches(state).length:0,venues:state?.venues?.length||0},checks};
}
function renderAcceptance(){
  const list=document.getElementById('acceptanceChecklist');if(!list)return;
  const payload=buildAcceptancePayload(),checks=payload.checks,failed=checks.filter(x=>x.required&&!x.ok),warnings=checks.filter(x=>!x.required&&!x.ok);
  list.innerHTML=checks.map(x=>`<article class="acceptance-item ${x.ok?'ok':x.required?'fail':'warn'}"><span>${x.ok?'✓':x.required?'×':'!'}</span><div><strong>${escapeHtml(x.label)}${x.required?'':' <em>권장</em>'}</strong><p>${escapeHtml(x.detail)}</p><small>${escapeHtml(x.group)}</small></div></article>`).join('');
  const overall=document.getElementById('acceptanceOverall');if(overall){overall.className=`acceptance-overall ${failed.length?'danger':warnings.length?'warning':'safe'}`;overall.innerHTML=`<strong>${failed.length?'출시 보류':'운영 가능'}</strong><span>필수 실패 ${failed.length}건 · 권장 확인 ${warnings.length}건</span>`;}
  const count=document.getElementById('acceptanceCount');if(count)count.textContent=`${checks.filter(x=>x.ok).length}/${checks.length} 정상`;
  const d=document.getElementById('acceptanceDataSummary');if(d)d.innerHTML=`<div><span>대회</span><strong>${escapeHtml(payload.tournament.name||'-')}</strong></div><div><span>참가팀</span><strong>${payload.tournament.teams}</strong></div><div><span>예선 경기</span><strong>${payload.tournament.prelimMatches}</strong></div><div><span>본선 경기</span><strong>${payload.tournament.mainMatches}</strong></div><div><span>구장</span><strong>${payload.tournament.venues}</strong></div><div><span>판정</span><strong>${payload.releaseDecision}</strong></div>`;
  const summary=document.getElementById('acceptanceSummary');if(summary)summary.textContent=[BUILD_LABEL,`판정: ${payload.releaseDecision==='PASS'?'운영 가능':'출시 보류'}`,`대회: ${payload.tournament.name||'-'}`,`참가팀: ${payload.tournament.teams}팀`,`예선/본선: ${payload.tournament.prelimMatches}/${payload.tournament.mainMatches}경기`,`필수 실패: ${failed.length}건`,`권장 확인: ${warnings.length}건`,failed.length?'미완료 필수 항목을 처리한 뒤 다시 검수하세요.':'대회 운영을 시작할 수 있습니다.'].join('\n');
}
function bindAcceptanceCenter(){
  document.getElementById('runAcceptanceBtn')?.addEventListener('click',()=>{renderAcceptance();notice('실전 운영 검수를 완료했습니다.','success');});
  document.getElementById('downloadAcceptanceBtn')?.addEventListener('click',()=>downloadJson(`230match-acceptance-${Date.now()}.json`,buildAcceptancePayload()));
  document.getElementById('copyAcceptanceBtn')?.addEventListener('click',async()=>{const text=document.getElementById('acceptanceSummary')?.textContent||JSON.stringify(buildAcceptancePayload(),null,2);try{await navigator.clipboard.writeText(text);notice('검수 요약을 복사했습니다.','success');}catch(_e){notice('복사에 실패했습니다.','error');}});
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function exportFullBackup(){
  const payload={format:'230MATCH_V3_FULL_BACKUP',schemaVersion:2,archiveSchema:'230match-archive-v1',archiveCount:(state.portal?.archives||[]).length,appBuild:BUILD_LABEL,exportedAt:new Date().toISOString(),state:structuredClone(state)};
  downloadJson(`230match-v3-full-${Date.now()}.json`,payload);
}
async function importFullBackup(file){
  let parsed;
  try{parsed=JSON.parse(await file.text());}catch(_error){throw new Error('백업 JSON 파일을 읽을 수 없습니다.');}
  const next=parsed?.format==='230MATCH_V3_FULL_BACKUP'?parsed.state:parsed?.currentState||parsed;
  if(!next?.tournament||!Array.isArray(next.teams))throw new Error('230MATCH V3 전체 백업 형식이 아닙니다.');
  await saveRecovery(state,'백업 불러오기 직전 자동 복구점');
  state=normalizeV5RuntimeState(structuredClone(next));
  ensurePortalState();ensurePrelimState(state);ensureTimeState(state);ensureDrawMeta(state);ensureMessagingState(state);ensureContacts(state);ensureAuditState(state);ensureEarlyMainSettings(state);ensureVenueSettings(state);ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state);ensurePrelimCourtStatuses(state);ensureOperatorState();
  saveState(state);
  location.reload();
}

function normalizeV5RuntimeState(source){
  const s=source&&typeof source==='object'?source:{};
  if(!s.tournament||typeof s.tournament!=='object')s.tournament={name:'대회명 없음',division:'기본 부서'};
  if(!s.settings||typeof s.settings!=='object')s.settings={};
  const settingDefaults={drawSize:64,courtCount:8,courtPrefix:'국제',venues:[],venueAssignmentPolicy:'round-robin',separateVenueQueues:true,autoVenuePromotion:true,matchMinutes:40,minimumMatchMinutes:30,autoTimeEnabled:true,timeRefreshSeconds:30,drawMethod:'instant',byePriority:'group-first'};
  Object.entries(settingDefaults).forEach(([k,v])=>{if(s.settings[k]===undefined)s.settings[k]=structuredClone(v);});
  if(!Array.isArray(s.teams))s.teams=[];
  if(!s.contacts||typeof s.contacts!=='object'||Array.isArray(s.contacts))s.contacts={};
  if(!s.messaging||typeof s.messaging!=='object')s.messaging={};
  if(!s.messaging.settings||typeof s.messaging.settings!=='object')s.messaging.settings={};
  if(!Array.isArray(s.messaging.queue))s.messaging.queue=[];
  if(!Array.isArray(s.messaging.history))s.messaging.history=[];
  if(!s.drawMeta||typeof s.drawMeta!=='object')s.drawMeta={locked:false,method:null,byePriority:null,createdAt:null,checksum:null,history:[]};
  if(!Array.isArray(s.drawMeta.history))s.drawMeta.history=[];
  if(!s.prelim||typeof s.prelim!=='object')s.prelim={};
  if(!s.prelim.settings||typeof s.prelim.settings!=='object')s.prelim.settings={activeTeamCount:96,threeTeamGroups:32,twoTeamGroups:0,courtCount:8,courtPrefix:'국제',qualifiersPerGroup:2};
  ['activeTeams','reserveTeams','groups','matches','courts','qualifiers'].forEach(k=>{if(!Array.isArray(s.prelim[k]))s.prelim[k]=[];});
  if(!s.prelim.linkedDraw||typeof s.prelim.linkedDraw!=='object')s.prelim.linkedDraw={active:false,drawSize:0,slots:[],createdAt:null,lastSyncedAt:null};
  if(!Array.isArray(s.prelim.linkedDraw.slots))s.prelim.linkedDraw.slots=[];
  if(!s.draw||typeof s.draw!=='object'||Array.isArray(s.draw))s.draw={size:0,rounds:{}};
  if(!Number.isFinite(Number(s.draw.size)))s.draw.size=0;
  if(!s.draw.rounds||typeof s.draw.rounds!=='object'||Array.isArray(s.draw.rounds))s.draw.rounds={};
  Object.keys(s.draw.rounds).forEach(k=>{if(!Array.isArray(s.draw.rounds[k]))s.draw.rounds[k]=[];});
  if(!Array.isArray(s.courts))s.courts=[];
  if(!Array.isArray(s.sharedQueue))s.sharedQueue=[];
  if(!s.venueQueues||typeof s.venueQueues!=='object'||Array.isArray(s.venueQueues))s.venueQueues={};
  if(!s.audit||typeof s.audit!=='object')s.audit={lastRunAt:null,overall:'not-run',results:[],simulation:null};
  if(!Array.isArray(s.audit.results))s.audit.results=[];
  if(!Array.isArray(s.logs))s.logs=[];
  if(!s.portal||typeof s.portal!=='object')s.portal={};
  ['posts','resultArchives','tournamentArchives','participantArchives','tournamentTemplates','archives','applications'].forEach(k=>{if(!Array.isArray(s.portal[k]))s.portal[k]=[];});
  if(!s.portal.guide||typeof s.portal.guide!=='object')s.portal.guide={date:'',venue:'',fee:'',bank:'',account:'',paymentNote:'입금 확인 후 참가 확정됩니다.',detail:''};
  if(!s.operation||typeof s.operation!=='object')s.operation={};
  if(s.operation.autoAssignmentEnabled===undefined)s.operation.autoAssignmentEnabled=true;
  if(!Array.isArray(s.operation.heldMatches))s.operation.heldMatches=[];
  if(!s.multiDivision||typeof s.multiDivision!=='object')s.multiDivision={version:1,activeDivisionId:'',divisions:[]};
  if(!Array.isArray(s.multiDivision.divisions))s.multiDivision.divisions=[];
  return s;
}
let state=normalizeV5RuntimeState(loadState());
function ensurePortalState(){
  state=normalizeV5RuntimeState(state);
  if(!state.portal||typeof state.portal!=='object')state.portal={};
  if(!Array.isArray(state.portal.posts))state.portal.posts=[{id:crypto.randomUUID(),title:'230MATCH 대회 안내',body:'대회 일정과 경기 진행 상황은 홈 화면과 경기 현황에서 확인해 주세요.',pinned:true,important:true,popup:false,startAt:'',endAt:'',createdAt:new Date().toISOString()}];
  state.portal.posts=state.portal.posts.map(post=>({...post,important:Boolean(post.important),popup:Boolean(post.popup),startAt:post.startAt||'',endAt:post.endAt||'',popupStartAt:post.popupStartAt||'',popupEndAt:post.popupEndAt||'',imageUrl:post.imageUrl||'',imageStoragePath:post.imageStoragePath||'',imageDataUrl:post.imageDataUrl||'',imageName:post.imageName||'',imageType:post.imageType||'',updatedAt:post.updatedAt||post.createdAt||new Date().toISOString()}));
  if(!Array.isArray(state.portal.resultArchives))state.portal.resultArchives=[];
  if(!Array.isArray(state.portal.tournamentArchives))state.portal.tournamentArchives=[];
  if(!Array.isArray(state.portal.participantArchives))state.portal.participantArchives=[];
  if(!Array.isArray(state.portal.tournamentTemplates))state.portal.tournamentTemplates=[];
  if(!Array.isArray(state.portal.archives))state.portal.archives=[];
  ensureTournamentIdentity(state);
  if(!Array.isArray(state.portal.applications))state.portal.applications=[];
  if(!state.portal.guide||typeof state.portal.guide!=='object')state.portal.guide={date:'',venue:'',fee:'',bank:'',account:'',paymentNote:'입금 확인 후 참가 확정됩니다.',detail:''};
}
ensurePortalState();ensurePrelimState(state);ensureTimeState(state);ensureDrawMeta(state);ensureMessagingState(state);ensureContacts(state);ensureAuditState(state);ensureEarlyMainSettings(state);ensureVenueSettings(state);ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state);ensurePrelimCourtStatuses(state);
function ensureOperatorState(){if(!state.operation||typeof state.operation!=='object')state.operation={};if(state.operation.autoAssignmentEnabled===undefined)state.operation.autoAssignmentEnabled=true;if(!Array.isArray(state.operation.heldMatches))state.operation.heldMatches=[];}
ensureOperatorState();
const stage3500LifecycleInit=ensureMainDrawLifecycle(state);
if(stage3500LifecycleInit.migrated){try{saveState(state);}catch(_e){}}
const ROLE_KEY='230match-v3-session-role';
const ADMIN_PIN_KEY='230match-v3-admin-pin';
const OPERATOR_PIN_KEY='230match-v3-operator-pin';
let currentRole=sessionStorage.getItem(ROLE_KEY)||'viewer';
let currentAuthUser=null;
function authUserLabel(){return currentAuthUser?.appProfile?.name||currentAuthUser?.displayName||currentAuthUser?.email||'로그인 사용자';}
function applyAuthenticatedRole(user,role='viewer',profile=null){
  currentAuthUser=user?{...user,appProfile:profile||null}:null;currentRole=user?role:'viewer';sessionStorage.setItem(ROLE_KEY,currentRole);applyRoleUI();renderAuthStatus();
  if(currentAuthUser&&document.body?.dataset.currentView==='my-match')setTimeout(v3252AutoMyMatch,80);
}
function renderAuthStatus(){
  const name=document.getElementById('authUserName'),email=document.getElementById('authUserEmail'),out=document.getElementById('socialLogoutBtn');
  if(name)name.textContent=currentAuthUser?authUserLabel():'로그인하지 않음';if(email)email.textContent=currentAuthUser?.email||'간편로그인 후 참가 신청과 내 경기 확인을 편리하게 이용할 수 있습니다.';if(out)out.hidden=!currentAuthUser;
}
function openSocialLogin(){const modal=document.getElementById('socialLoginModal');if(modal)modal.hidden=false;}
function closeSocialLogin(){const modal=document.getElementById('socialLoginModal');if(modal)modal.hidden=true;}
async function handleGoogleLogin(){try{await signInGoogle();closeSocialLogin();notice('구글 로그인이 완료되었습니다.','success')}catch(error){notice(error.message||'구글 로그인에 실패했습니다.','error')}}
function handleExternalLogin(provider){try{beginExternalLogin(provider)}catch(error){notice(error.message,'error')}}
async function handleSocialLogout(){try{await signOutSocial();notice('로그아웃했습니다.','success')}catch(error){notice(error.message||'로그아웃에 실패했습니다.','error')}}
function loadAuthSettingsPanel(){const c=getAuthConfig(),ep=getExistingLoginEndpoints();setValue('authFirebaseConfigJson',c.firebaseConfigText||'기존 open-match-manager Firebase 자동 연결');setValue('authAdminEmails',c.adminEmails||'');setValue('authOperatorEmails',c.operatorEmails||'');setValue('authKakaoLoginUrl',c.kakaoLoginUrl||ep.kakaoLoginUrl);setValue('authNaverLoginUrl',c.naverLoginUrl||ep.naverLoginUrl);}
function saveAuthSettingsPanel(){if(!requireAdmin('간편로그인 설정 저장'))return;saveAuthConfig({adminEmails:getValue('authAdminEmails','').trim(),operatorEmails:getValue('authOperatorEmails','').trim(),kakaoLoginUrl:getValue('authKakaoLoginUrl','').trim()||'/kakao/login',naverLoginUrl:getValue('authNaverLoginUrl','').trim()||'/naver/login'});notice('간편로그인과 역할 설정을 저장했습니다.','success');startAuth((u,r,e,p)=>applyAuthenticatedRole(u,r,p));}
function adminPin(){return localStorage.getItem(ADMIN_PIN_KEY)||'2300';}
function operatorPin(){return localStorage.getItem(OPERATOR_PIN_KEY)||'2301';}
function isAdmin(){return currentRole==='admin';}
function isOperator(){return currentRole==='operator';}
function canOperate(){return isAdmin()||isOperator();}
function requireAdmin(action='이 작업'){
  if(isAdmin())return true;
  notice(`${action}은 관리자 권한이 필요합니다.`,'error');
  return false;
}
function requireOperator(action='이 작업'){
  if(canOperate())return true;
  notice(`${action}은 진행자 또는 관리자 로그인이 필요합니다.`,'error');
  return false;
}
function setRole(role){
  const target=['viewer','operator','admin'].includes(role)?role:'viewer';
  if(target==='admin'&&!isAdmin()){
    const pin=prompt('관리자 PIN을 입력하세요.');
    if(pin!==adminPin()){notice('관리자 PIN이 올바르지 않습니다.','error');return false;}
  }
  if(target==='operator'&&!canOperate()){
    const pin=prompt('진행자 PIN을 입력하세요.');
    if(pin!==operatorPin()){notice('진행자 PIN이 올바르지 않습니다.','error');return false;}
  }
  currentRole=target;
  sessionStorage.setItem(ROLE_KEY,currentRole);
  applyRoleUI();
  const label=target==='admin'?'관리자 모드':target==='operator'?'진행자 모드':'일반 선수 보기';
  notice(`${label}로 전환했습니다.`,'success');
  return true;
}
function changeAdminPin(){
  if(!requireAdmin('PIN 변경'))return;
  const kind=prompt('변경할 PIN을 선택하세요. 관리자 또는 진행자','관리자');
  const isOp=String(kind||'').includes('진행');
  const current=prompt(`현재 ${isOp?'진행자':'관리자'} PIN을 입력하세요.`);
  const expected=isOp?operatorPin():adminPin();
  if(current!==expected){notice('현재 PIN이 올바르지 않습니다.','error');return;}
  const next=prompt(`새 ${isOp?'진행자':'관리자'} PIN을 4자리 이상 입력하세요.`);
  if(!next||next.length<4){notice('PIN은 4자리 이상이어야 합니다.','error');return;}
  localStorage.setItem(isOp?OPERATOR_PIN_KEY:ADMIN_PIN_KEY,next);notice(`${isOp?'진행자':'관리자'} PIN을 변경했습니다.`,'success');
}
const ADMIN_ONLY_IDS=['generatePrelimBtn','assignPrelimCourtsBtn','generateLinkedDrawBtn','lockPrelimBtn','unlockPrelimBtn','resetPrelimBtn','lockDrawBtn','resetBtn','applyVenuePresetBtn','clearDrawHistoryBtn','confirmDrawLockBtn','loadSampleBtn','teamFileInput','autoFitPrelimBtn'];
function applyRoleUI(){
  document.body.dataset.role=currentRole;
  const badge=document.getElementById('currentRoleBadge');if(badge)badge.textContent=isAdmin()?'관리자':isOperator()?'진행자':'일반 선수';
  const viewerBtn=document.getElementById('roleViewerBtn');if(viewerBtn)viewerBtn.classList.toggle('active',currentRole==='viewer');
  const adminBtn=document.getElementById('roleAdminBtn');if(adminBtn)adminBtn.classList.toggle('active',isAdmin());
  const operatorBtn=document.getElementById('roleOperatorBtn');if(operatorBtn)operatorBtn.classList.toggle('active',isOperator());
  ADMIN_ONLY_IDS.forEach(id=>{const el=document.getElementById(id);if(!el)return;el.disabled=!isAdmin();el.setAttribute('aria-disabled',String(!isAdmin()));el.title=!isAdmin()?'관리자 전용 기능':'';});
  document.querySelectorAll('[data-admin-only="true"]').forEach(el=>{el.hidden=!isAdmin();});
  document.querySelectorAll('[data-operator-only="true"]').forEach(el=>{el.hidden=!canOperate();});
  document.querySelectorAll('[data-portal-go="operation"],[data-view="operation"],[data-settings-view="operation"]').forEach(el=>{el.hidden=false;});
}
if(hasAuthorizedMainDraw(state)&&state?.mainDrawLifecycle?.mode==='slot'&&linkedDrawNeedsRepair(state)&&!hasStartedMainMatches(state)){
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
let saveFailureNoticeShown=false;
function setSaveHealth(level='ok',detail=''){
  const badge=$('saveStateBadge');if(!badge)return;
  if(level==='error'){badge.textContent='저장 오류';badge.className='badge badge-danger';badge.title=detail||'현재 상태 저장에 실패했습니다.';}
  else if(level==='saving'){badge.textContent='저장 중';badge.className='badge badge-muted';badge.title='현재 상태를 이 브라우저에 저장하고 있습니다.';}
  else{badge.textContent='자동 저장 ON';badge.className='badge badge-safe';badge.title=detail||'현재 상태가 이 브라우저에 저장됩니다.';}
}
function safePersistState(context='현재 상태'){
  setSaveHealth('saving');
  try{
    // V6는 전체 운영 상태를 localStorage에 다시 읽어 검증하지 않습니다.
    // saveState()는 작은 메타 정보만 저장하고, 전체 상태는 동기화 엔진과 IndexedDB 복구점이 담당합니다.
    saveState(state);
    if(!state.updatedAt)throw new Error('저장 시각을 생성하지 못했습니다.');
    saveFailureNoticeShown=false;
    setSaveHealth('ok',`${context} 저장 완료 · ${new Date(state.updatedAt).toLocaleTimeString('ko-KR')}`);
    return true;
  }catch(error){
    console.error(`[230MATCH V3] ${context} 저장 실패`,error);setSaveHealth('error',error?.message||String(error));
    if(!saveFailureNoticeShown){saveFailureNoticeShown=true;notice('현재 상태 저장 준비에 실패했습니다. 잠시 후 다시 시도하세요.','error');}
    return false;
  }
}
function requireTypedConfirmation(action,word){
  const entered=prompt(`${action}은 현재 운영 상태를 크게 변경합니다. 계속하려면 “${word}”를 정확히 입력하세요.`,'');
  return entered===word;
}

const ALIGO_PROXY_URL='https://tennis230-sms-proxy.lsy9677.workers.dev/send-sms';
const ALIGO_CLIENT_KEY='m230sms';
let autoSmsSnapshot=null;
let autoSmsDialogQueue=[];
let autoSmsDialogOpen=false;
function smsDigits(v){let p=String(v||'').replace(/[^0-9]/g,'');if(p.startsWith('82')&&p.length>=11)p='0'+p.slice(2);return p;}
function smsTeamName(team){
  if(!team)return'참가팀';
  const rows=[team.player1,team.player2,team.p1,team.p2,...(Array.isArray(team.players)?team.players:[]),...(Array.isArray(team.individualPlayers)?team.individualPlayers:[])];
  const names=rows.map(p=>typeof p==='string'?p:(p?.name||p?.playerName||'')).map(v=>String(v||'').replace(/\([^)]*\)/g,'').trim()).filter(Boolean);
  if(names.length)return names.slice(0,2).join('/');
  return String(teamText(team)||team?.name||'참가팀').replace(/\([^)]*\)/g,'').replace(/\s*\/\s*/g,'/').replace(/\s+/g,' ').trim()||'참가팀';
}
function findAnyMatchById(id){return findMatch(state.draw,id)||(state.prelim?.matches||[]).find(m=>String(m.id)===String(id))||null;}
function smsTeamRecipients(team){
  if(!team)return[];const saved=getTeamContact(state,team)||{};const phones=[];
  const add=(name,phone)=>{phone=smsDigits(phone);if(phone.length>=9&&!phones.some(x=>x.phone===phone))phones.push({name:name||smsTeamName(team),phone});};
  add(saved.manager||smsTeamName(team),saved.phone||team.phone||team.mobile||team.contact||team.tel);
  for(const p of [team.player1,team.player2,team.p1,team.p2,...(Array.isArray(team.players)?team.players:[]),...(Array.isArray(team.individualPlayers)?team.individualPlayers:[])]){
    if(p&&typeof p==='object')add(p.name||smsTeamName(team),p.phone||p.mobile||p.contact||p.tel);
  }
  return phones;
}
function smsMatchRecipients(match){const out=[];for(const t of [match?.teamA,match?.teamB])for(const r of smsTeamRecipients(t))if(!out.some(x=>x.phone===r.phone))out.push(r);return out;}
function smsOpponent(match,team){const a=match?.teamA,b=match?.teamB;return String(a?.id||a?.name)===String(team?.id||team?.name)?b:a;}
function autoSmsBody(kind,match,placement={}){
  const court=placement.court||match?.court||'배정코트';
  const teams=[match?.teamA,match?.teamB].filter(Boolean).map(smsTeamName).join('vs');
  if(kind==='start')return `${teams} ${court} 경기. 입장`;
  if(kind==='waiting')return `${teams} ${court} 대기${placement.position||1}`;
  if(kind==='changed')return `${teams} ${court} ${placement.slotLabel||'대기'} 변경`;
  return `${teams} 경기완료`;
}

function buildAutoSmsSnapshot(){
  const placements={};const courts=[...(state.prelim?.courts||[]),...(state.courts||[])];
  for(const c of courts){if(c.playing)placements[c.playing]={court:c.name||c.id,slot:'playing',position:0};if(c.wait1)placements[c.wait1]={court:c.name||c.id,slot:'wait1',position:1};
    (c.queue||[]).forEach((id,i)=>placements[id]={court:c.name||c.id,slot:'queue',position:i+2});(c.manualQueue||[]).forEach((id,i)=>placements[id]={court:c.name||c.id,slot:'queue',position:i+2});}
  const completed={};for(const m of [...(state.prelim?.matches||[]),...(typeof allMatches==='function'?allMatches(state):[])])completed[m.id]=m.status==='completed';
  return{placements,completed};
}
function autoSmsEventKey(kind,matchId,p){return[kind,matchId,p?.court||'',p?.slot||'',p?.position||0].join('|');}
function autoSmsRecent(value,seconds=20){const t=value?new Date(value).getTime():0;return Number.isFinite(t)&&t>0&&(Date.now()-t)<=seconds*1000;}
function queueAutoSmsEvent(kind,match,placement){
  ensureMessagingState(state);if(!Array.isArray(state.messaging.smsApprovalHistory))state.messaging.smsApprovalHistory=[];
  const key=autoSmsEventKey(kind,match.id,placement);if(state.messaging.smsApprovalHistory.some(x=>x.key===key))return{queued:false,duplicate:true};
  const recipients=smsMatchRecipients(match);
  if(!recipients.length){
    const teamLabel=`${smsTeamName(match?.teamA)} vs ${smsTeamName(match?.teamB)}`;
    state.messaging.smsApprovalHistory.unshift({key,kind,matchId:match.id,status:'no-phone',detail:'등록된 연락처 없음',createdAt:new Date().toISOString()});
    state.messaging.smsApprovalHistory=state.messaging.smsApprovalHistory.slice(0,300);
    // 연락처 누락도 운영자가 놓치지 않도록 승인창과 같은 순서로 안내합니다.
    autoSmsDialogQueue.push({key,kind,matchId:match.id,match,placement,recipients:[],noPhone:true,teamLabel,body:`${teamLabel}

등록된 연락처가 없어 자동 문자를 만들지 못했습니다. 참가팀 연락처를 등록한 뒤 문자 센터에서 다시 생성하세요.`});
    setTimeout(showNextAutoSmsDialog,30);
    return{queued:false,noPhone:true,teamLabel};
  }
  state.messaging.smsApprovalHistory.unshift({key,kind,matchId:match.id,status:'pending',createdAt:new Date().toISOString()});state.messaging.smsApprovalHistory=state.messaging.smsApprovalHistory.slice(0,300);
  autoSmsDialogQueue.push({key,kind,matchId:match.id,match,placement,recipients,body:autoSmsBody(kind,match,placement)});setTimeout(showNextAutoSmsDialog,30);
  return{queued:true};
}
function detectAutoSmsEvents(){
  const current=buildAutoSmsSnapshot();if(!autoSmsSnapshot){autoSmsSnapshot=current;return;}const s=state.messaging?.settings||{};const missing=[];
  const enqueue=(kind,m,p)=>{const result=queueAutoSmsEvent(kind,m,p);if(result?.noPhone&&result.teamLabel)missing.push(result.teamLabel);};
  if(s.autoSmsApprovalEnabled===true&&canOperate()){
    for(const [id,p] of Object.entries(current.placements)){
      const before=autoSmsSnapshot.placements[id],m=findAnyMatchById(id);if(!m)continue;
      const moved=!before||before.court!==p.court||before.slot!==p.slot||before.position!==p.position;
      const recentStart=p.slot==='playing'&&autoSmsRecent(m.startedAt,25);
      const recentWait=p.slot==='wait1'&&autoSmsRecent(m.waitStartedAt,25);
      if(p.slot==='playing'&&s.autoSmsMatchStart!==false&&(before?.slot!=='playing'||(!before&&recentStart)||recentStart&&!state.messaging.smsApprovalHistory?.some(x=>x.key===autoSmsEventKey('start',m.id,p)))){
        enqueue('start',m,p);
      }else if(p.slot==='wait1'&&s.autoSmsCourtWaiting!==false&&(!before||before.slot!=='wait1'||recentWait&&!state.messaging.smsApprovalHistory?.some(x=>x.key===autoSmsEventKey('waiting',m.id,p)))){
        enqueue('waiting',m,p);
      }else if(moved&&p.slot!=='playing'&&p.slot!=='wait1'&&s.autoSmsCourtChanged!==false){
        enqueue('changed',m,{...p,slotLabel:`대기 ${p.position||1}번`});
      }else if(moved&&p.slot==='wait1'&&before?.slot==='wait1'&&s.autoSmsCourtChanged!==false){
        enqueue('changed',m,{...p,slotLabel:'대기 1번'});
      }
    }
    if(s.autoSmsMatchComplete===true)for(const [id,done] of Object.entries(current.completed)){if(done&&!autoSmsSnapshot.completed[id]){const m=findAnyMatchById(id);if(m)enqueue('complete',m,current.placements[id]||{});}}
  }
  autoSmsSnapshot=current;
  if(missing.length){const unique=[...new Set(missing)];notice(`자동 문자 미생성 · 연락처 없는 경기 ${unique.length}건: ${unique.slice(0,2).join(' / ')}${unique.length>2?' 외':''}`,'error');}
}
function markAutoSmsHistory(key,status,detail=''){const item=state.messaging?.smsApprovalHistory?.find(x=>x.key===key);if(item){item.status=status;item.detail=detail;item.updatedAt=new Date().toISOString();safePersistState('자동 문자 처리');}}
function showNextAutoSmsDialog(){
  if(autoSmsDialogOpen||!autoSmsDialogQueue.length)return;const item=autoSmsDialogQueue.shift();const d=document.getElementById('autoSmsApprovalDialog');if(!d)return;autoSmsDialogOpen=true;d.dataset.eventKey=item.key;
  const title=document.getElementById('autoSmsApprovalTitle'),target=document.getElementById('autoSmsApprovalTarget'),body=document.getElementById('autoSmsApprovalBody');
  const sendButtons=[...d.querySelectorAll('.auto-sms-actions button')].slice(0,3),skip=d.querySelector('.auto-sms-actions button:last-child');
  if(item.noPhone){
    title.textContent='⚠ 자동 문자 미생성 · 연락처 없음';target.textContent=item.teamLabel||'참가팀 연락처 없음';body.value=item.body||'등록된 연락처가 없습니다.';
    sendButtons.forEach(b=>b.disabled=true);if(skip)skip.textContent='확인';
  }else{
    title.textContent=({start:'🎾 시합 시작 문자 확인',waiting:'⏳ 코트 대기 문자 확인',changed:'🔄 코트·순서 변경 문자 확인',complete:'✅ 경기 완료 문자 확인'})[item.kind]||'문자 확인';
    target.textContent=`${item.recipients.length}명 · ${item.recipients.map(x=>`${x.name} ${x.phone}`).join(' / ')}`;body.value=item.body;
    sendButtons.forEach(b=>b.disabled=false);if(skip)skip.textContent='이번만 건너뛰기';
  }
  d.__smsItem=item;d.showModal();
}
function closeAutoSmsDialog(status='skipped'){const d=document.getElementById('autoSmsApprovalDialog');const item=d?.__smsItem;if(item)markAutoSmsHistory(item.key,status);if(d?.open)d.close();if(d)d.__smsItem=null;autoSmsDialogOpen=false;setTimeout(showNextAutoSmsDialog,60);}
async function sendAligoSmsV3(recipients,msg,meta={}){
  const list=[];for(const r of recipients||[]){const phone=smsDigits(r.phone);if(phone.length>=9&&!list.some(x=>x.phone===phone))list.push({name:r.name||'수신자',phone});}if(!list.length)throw new Error('문자 받을 번호가 없습니다.');
  const receivers=list.map(x=>x.phone),body=String(msg||'').trim();const type=new Blob([body]).size>90?'LMS':'SMS';
  const payload={receivers,receiver:receivers[0],recipients:list,targets:list,phones:receivers,to:receivers,msg:body,body,message:body,content:body,type,title:String(meta.title||'230MATCH 문자').slice(0,40),meta:{app:'230MATCH V3',version:'stage31.68',...meta}};
  const res=await fetch(ALIGO_PROXY_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'application/json','x-api-key':ALIGO_CLIENT_KEY},credentials:'omit',body:JSON.stringify(payload)});const raw=await res.text();let data;try{data=JSON.parse(raw)}catch{data={raw}};
  if(!res.ok||data.success===false||data.ok===false)throw new Error(data.message||data.error||data.aligo?.message||raw||`HTTP ${res.status}`);return data;
}
async function approveAutoSmsAligo(){const d=document.getElementById('autoSmsApprovalDialog'),item=d?.__smsItem;if(!item||item.noPhone)return;const body=document.getElementById('autoSmsApprovalBody').value.trim();try{notice('알리고 문자 발송 중...','info');await sendAligoSmsV3(item.recipients,body,{source:'court_auto_approval',kind:item.kind,matchId:item.matchId,title:'230MATCH 경기 안내'});markAutoSmsHistory(item.key,'sent-aligo');notice(`알리고 문자 ${item.recipients.length}명 발송 완료`,'success');closeAutoSmsDialog('sent-aligo');}catch(e){notice(`알리고 발송 실패: ${e.message||e}`,'error');}}
function approveAutoSmsPhone(){const d=document.getElementById('autoSmsApprovalDialog'),item=d?.__smsItem;if(!item||item.noPhone)return;const body=document.getElementById('autoSmsApprovalBody').value.trim(),phones=item.recipients.map(x=>smsDigits(x.phone)).filter(Boolean);if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||''))location.href=`sms:${phones.join(',')}?body=${encodeURIComponent(body)}`;else navigator.clipboard?.writeText(`${phones.join('\n')}\n\n${body}`);markAutoSmsHistory(item.key,'opened-phone');notice('문자앱을 열거나 번호와 내용을 복사했습니다.','success');closeAutoSmsDialog('opened-phone');}
async function copyAutoSms(){const d=document.getElementById('autoSmsApprovalDialog'),item=d?.__smsItem;if(!item||item.noPhone)return;const body=document.getElementById('autoSmsApprovalBody').value.trim();await navigator.clipboard.writeText(`${item.recipients.map(x=>`${x.name} ${x.phone}`).join('\n')}\n\n${body}`);notice('수신자와 문자 내용을 복사했습니다.','success');}
function previewCurrentCourtSms(){if(!requireOperator('자동 문자 점검'))return;autoSmsSnapshot=null;detectAutoSmsEvents();const cur=buildAutoSmsSnapshot();for(const [id,p] of Object.entries(cur.placements)){const m=findAnyMatchById(id);if(m){queueAutoSmsEvent(p.slot==='playing'?'start':'waiting',m,p);return;}}notice('현재 코트에 배정된 경기가 없습니다.','info');}

let legacyBundlePreview=null;
function legacyBridgeStatus(label,detail='',level='info'){
  const b=$('legacyBridgeBadge');if(b){b.textContent=label;b.className=`badge ${level==='success'?'badge-safe':level==='error'?'badge-danger':'badge-muted'}`;}
  if($('legacyBridgeSummary'))$('legacyBridgeSummary').value=detail;
}
async function loadLegacyTournamentList(){
  if(!requireAdmin('기존 대회 목록 조회'))return;
  try{legacyBridgeStatus('조회 중','기존 Firebase tournaments 컬렉션을 확인하고 있습니다.');const list=await listExistingTournaments();const sel=$('legacyTournamentSelect');sel.innerHTML='<option value="">대회를 선택하세요</option>'+list.map(t=>`<option value="${String(t.id).replace(/"/g,'&quot;')}">${String(t.name||t.title||t.id)}${t.date?' · '+t.date:''}</option>`).join('');legacyBridgeStatus('목록 준비',`${list.length}개 기존 대회를 찾았습니다. 연결할 대회 1건을 선택하세요.`,'success');}
  catch(e){legacyBridgeStatus('조회 실패',e.message||String(e),'error');notice(e.message||String(e),'error');}
}
async function previewLegacyTournament(){
  if(!requireAdmin('기존 대회 점검'))return;const tid=$('legacyTournamentSelect')?.value;if(!tid){notice('기존 대회를 먼저 선택하세요.','info');return;}
  try{legacyBridgeStatus('점검 중','기존 대회와 관련 문서를 읽고 있습니다.');legacyBundlePreview=await loadExistingTournament(tid);const c=legacyBundlePreview;legacyBridgeStatus('점검 완료',`대회: ${c.tournament.name||c.tournament.title||tid}\n참가팀 문서: ${c.teams.length}\n경기 문서: ${c.matches.length}\n대진 문서: ${c.draws.length}\n참가신청 문서: ${c.registrations.length}\n공지 문서: ${(c.notices||[]).length}`,'success');renderLegacyArchivePhotoPicker();notice('기존 대회 점검을 완료했습니다.','success');}
  catch(e){legacyBridgeStatus('점검 실패',e.message||String(e),'error');notice(e.message||String(e),'error');}
}
function legacyArchiveTeamNames(bundle){
  const src=(bundle?.teams?.length?bundle.teams:bundle?.registrations)||[];
  const out=[];
  src.forEach((x,i)=>{
    const players=Array.isArray(x.individualPlayers)?x.individualPlayers:(Array.isArray(x.players)?x.players:[]);
    const p=players.map(v=>typeof v==='string'?v:(v?.name||v?.displayName||'')).filter(Boolean).join(' / ');
    const name=String(x.pairLabel||x.entryLabel||x.teamName||x.name||x.club||p||`참가팀 ${i+1}`).trim();
    if(name&&!out.includes(name))out.push(name);
  });
  return out;
}
function legacyArchivePhotoCandidates(bundle){
  const out=[];
  (bundle?.notices||[]).forEach(n=>{
    const urls=[...(Array.isArray(n.imageUrls)?n.imageUrls:[]),n.imageUrl].filter(Boolean);
    urls.forEach((url,index)=>{
      if(out.some(x=>x.url===url))return;
      const title=String(n.title||'시합 결과');
      const body=String(n.body||'');
      const search=`${title} ${body} ${n.category||''}`;
      out.push({
        key:`${n.id||'notice'}:${index}:${url}`,
        url,
        title,
        body,
        noticeId:n.id||'',
        createdAtMs:Number(n.createdAtMs||n.createdAt||0)||0,
        recommended:/결과|입상|우승|준우승|3위|8강|대진/i.test(search)
      });
    });
  });
  return out;
}
function renderLegacyArchivePhotoPicker(){
  const root=document.getElementById('legacyArchivePhotoPicker');if(!root)return;
  if(!legacyBundlePreview){root.innerHTML='<div class="portal-empty">먼저 기존 대회를 선택하고 점검하세요.</div>';return;}
  const photos=legacyArchivePhotoCandidates(legacyBundlePreview);
  if(!photos.length){root.innerHTML='<div class="portal-empty">이 대회의 공지사항에서 이미지 주소를 찾지 못했습니다.</div>';return;}
  const hasRecommended=photos.some(x=>x.recommended);
  root.innerHTML=photos.map((p,i)=>`<label class="legacy-photo-choice"><input type="checkbox" data-legacy-photo-key="${portalEscape(p.key)}" ${(p.recommended||!hasRecommended)?'checked':''}><img src="${portalEscape(p.url)}" alt="결과사진 ${i+1}" loading="lazy"><span><b>${portalEscape(p.title||`결과사진 ${i+1}`)}</b><small>${portalEscape(p.body||'공지 설명 없음')}</small></span></label>`).join('');
}
function selectedLegacyArchivePhotos(){
  const all=legacyArchivePhotoCandidates(legacyBundlePreview);
  const checked=[...document.querySelectorAll('[data-legacy-photo-key]:checked')].map(x=>x.dataset.legacyPhotoKey);
  if(!document.getElementById('legacyArchivePhotoPicker')||!checked.length)return [];
  return all.filter(x=>checked.includes(x.key)).map(({key,recommended,...x})=>x);
}
function parseLegacyThirds(){return [...new Set(String(document.getElementById('legacyArchiveThirds')?.value||'').split(/[\n,;/]+/).map(v=>v.trim()).filter(Boolean))];}
function parseLegacyQuarterfinalInput(){
  return [...new Set(String(document.getElementById('legacyArchiveQuarterfinals')?.value||'').split(/[\n,;/]+/).map(v=>v.trim()).filter(Boolean))];
}
function buildLegacyQuarterfinals(champion,runnerUp,thirds,input){
  const podium=[champion,runnerUp,...thirds].map(v=>String(v||'').trim()).filter(Boolean);
  const typed=[...new Set((input||[]).map(v=>String(v||'').trim()).filter(Boolean))];
  // 4팀 입력은 8강 탈락팀으로 간주해 입상 4팀과 자동 결합한다. 8팀 입력은 전체 명단으로 사용한다.
  if(typed.length===4)return [...new Set([...podium,...typed])];
  return typed;
}
function legacyActionStatus(message,type='info',focusId=''){
  const el=document.getElementById('legacyArchiveActionStatus');
  if(el){el.style.display='block';el.className=`notice ${type}`;el.textContent=message;el.scrollIntoView({behavior:'smooth',block:'center'});}
  if(focusId){const target=document.getElementById(focusId);target?.focus();target?.scrollIntoView({behavior:'smooth',block:'center'});}
  notice(message,type);
}
function legacySummaryPayload(){
  if(!legacyBundlePreview)throw new Error('먼저 기존 대회를 선택하고 점검하세요.');
  const champion=String(document.getElementById('legacyArchiveChampion')?.value||'').trim();
  const runnerUp=String(document.getElementById('legacyArchiveRunnerUp')?.value||'').trim();
  const thirds=parseLegacyThirds();
  const quarterfinalInput=parseLegacyQuarterfinalInput();
  return {
    id:`legacy-summary-${String(legacyBundlePreview.tournament?.id||'modern-cup').replace(/[^a-zA-Z0-9_-]/g,'-')}`,
    name:String(legacyBundlePreview.tournament?.name||legacyBundlePreview.tournament?.title||'제1회 모던배'),
    division:String(legacyBundlePreview.tournament?.division||state.tournament?.division||''),
    archivedAt:new Date().toISOString(),
    champion,
    runnerUp,
    thirds,
    quarterfinalInput,
    quarterfinals:buildLegacyQuarterfinals(champion,runnerUp,thirds,quarterfinalInput),
    teamNames:legacyArchiveTeamNames(legacyBundlePreview),
    resultPhotos:selectedLegacyArchivePhotos(),
    sourceTournamentId:legacyBundlePreview.tournament?.id||'',
    source:'open-match-manager-summary-only',
    note:'참가팀·8강 진출팀·입상결과·선택한 공지 결과사진만 보관. 경기 운영 데이터는 폐기.'
  };
}
function previewLegacySummaryArchive(){
  try{const x=legacySummaryPayload();const el=document.getElementById('legacyArchivePreview');if(el)el.value=`대회: ${x.name}\n참가팀: ${x.teamNames.length}팀\n8강: ${x.quarterfinals.length===8?x.quarterfinals.join(' · '):`${x.quarterfinals.length}팀 입력`}\n입상: 우승 ${x.champion||'미입력'} / 준우승 ${x.runnerUp||'미입력'} / 공동3위 ${x.thirds.join(' · ')||'미입력'}\n선택 결과사진: ${x.resultPhotos.length}장`;return x;}catch(e){notice(e.message||String(e),'error');return null;}
}
async function archiveLegacySummaryAndReset(){
  try{
    legacyActionStatus('보관 내용을 확인하고 있습니다.','info');
    if(!requireAdmin('기존 대회 요약 보관 및 초기화'))return;
    const archive=previewLegacySummaryArchive();if(!archive)return;
    if(!archive.champion||!archive.runnerUp||archive.thirds.length!==2){legacyActionStatus('우승·준우승·공동 3위 2팀을 먼저 정확히 입력하세요.','error','legacyArchiveThirds');return;}
    if(archive.quarterfinals.length!==8){legacyActionStatus(`8강 명단을 완성할 수 없습니다. 현재 입력 ${archive.quarterfinalInput.length}팀, 입상팀과 합친 결과 ${archive.quarterfinals.length}팀입니다. 8강 탈락 4팀 또는 8강 전체 8팀을 입력하세요.`,'error','legacyArchiveQuarterfinals');return;}
    if(!archive.resultPhotos.length){legacyActionStatus('보관할 결과사진을 1장 이상 선택하세요.','error','legacyArchivePhotoPicker');return;}
    const first=window.confirm(`${archive.name}에서 참가팀 ${archive.teamNames.length}팀, 8강 ${archive.quarterfinals.length}팀, 입상 결과, 결과사진 ${archive.resultPhotos.length}장만 보관하고 새 대회를 시작할까요?\n\n잘못 복원된 예선·본선·코트 데이터는 V3에서 초기화됩니다. 기존 Firebase 원본은 삭제하지 않습니다.`);
    if(!first)return;
    if(!requireTypedConfirmation('기록 보관 후 새 대회 시작','새시작')){notice('확인 문구가 일치하지 않아 취소했습니다.','info');return;}
    const recovery=saveRecovery(state,`${archive.name} · 요약 보관 전 전체상태`);
    if(recovery?.ready)await recovery.ready;
    const previous=Array.isArray(state.portal?.resultArchives)?structuredClone(state.portal.resultArchives):[];
    const previousSummaries=Array.isArray(state.portal?.legacyTournamentSummaries)?structuredClone(state.portal.legacyTournamentSummaries):[];
    const previousTournaments=Array.isArray(state.portal?.tournamentArchives)?structuredClone(state.portal.tournamentArchives):[];
    const previousParticipants=Array.isArray(state.portal?.participantArchives)?structuredClone(state.portal.participantArchives):[];
    const sourceId=String(archive.sourceTournamentId||archive.id);
    const sourceTournament=legacyBundlePreview?.tournament||{};
    const tournamentRecord={
      id:`legacy-tournament-${sourceId}`,
      current:false,
      name:archive.name,
      division:archive.division,
      date:String(sourceTournament.date||sourceTournament.startDate||''),
      venue:String(sourceTournament.venue||sourceTournament.place||''),
      fee:String(sourceTournament.fee||''),
      capacity:archive.teamNames.length,
      active:archive.teamNames.length,
      reserve:0,
      status:'completed',
      champion:archive.champion,
      runnerUp:archive.runnerUp,
      thirds:[...archive.thirds],
      quarterfinals:[...archive.quarterfinals],
      prelimCompleted:0,prelimTotal:0,mainCompleted:0,mainTotal:0,
      archivedAt:archive.archivedAt,
      updatedAt:archive.archivedAt,
      sourceTournamentId:sourceId,
      detail:'기존 230 앱에서 참가팀 명단·8강·입상 결과·공지 결과사진만 이식한 완료 대회 기록입니다.'
    };
    const participantRecord={
      id:`legacy-participants-${sourceId}`,
      tournamentId:tournamentRecord.id,
      sourceTournamentId:sourceId,
      name:archive.name,
      division:archive.division,
      archivedAt:archive.archivedAt,
      teamNames:[...archive.teamNames]
    };
    const sameSource=x=>String(x?.sourceTournamentId||'')===sourceId || String(x?.id||'')===archive.id;
    const next=initialState();
    next.portal=next.portal||{};
    next.portal.resultArchives=[archive,...previous.filter(x=>!sameSource(x))];
    next.portal.legacyTournamentSummaries=[archive,...previousSummaries.filter(x=>!sameSource(x))];
    next.portal.tournamentArchives=[tournamentRecord,...previousTournaments.filter(x=>String(x?.sourceTournamentId||'')!==sourceId&&String(x?.id||'')!==tournamentRecord.id)];
    next.portal.participantArchives=[participantRecord,...previousParticipants.filter(x=>String(x?.sourceTournamentId||'')!==sourceId&&String(x?.id||'')!==participantRecord.id)];
    next.updatedAt=new Date().toISOString();
    state=normalizeV5RuntimeState(next);ensurePortalState();ensureOperatorState();ensureContacts(state);commit(`${archive.name} 요약 보관 후 새 대회 시작`);
    try{disconnectCloudSync();}catch(_e){}
    legacyActionStatus('모던배의 참가팀·8강·입상 결과·선택한 결과사진을 보관하고 새 대회 상태로 초기화했습니다.','success');
    navigatePortalView('results',{pushHistory:true});
  }catch(error){
    console.error('[Stage32.2.7] archive reset failed',error);
    legacyActionStatus(`기록 보관 처리 실패: ${error?.message||String(error)}`,'error');
  }
}

window.archiveLegacySummaryAndResetV332026=function(event){
  try{event?.preventDefault?.();event?.stopPropagation?.();}catch(_e){}
  legacyActionStatus('버튼 입력을 확인했습니다. 보관 조건을 점검합니다.','info');
  return archiveLegacySummaryAndReset();
};

async function importLegacyTournament(){
  if(!requireAdmin('기존 대회 연결'))return;const tid=$('legacyTournamentSelect')?.value;if(!tid){notice('기존 대회를 먼저 선택하세요.','info');return;}
  try{if(!legacyBundlePreview||legacyBundlePreview.tournament.id!==tid)legacyBundlePreview=await loadExistingTournament(tid);const ok=confirm(`기존 대회 “${legacyBundlePreview.tournament.name||tid}”를 V3에 연결할까요?\n\n현재 V3 상태는 복구점으로 먼저 저장됩니다.`);if(!ok)return;saveRecovery(state,'기존 대회 연결 직전');const next=convertExistingTournament(legacyBundlePreview,state);applySynchronizedState(next,'기존 230 대회');legacyBridgeStatus('연결 완료',`기존 대회 ${next.tournament.name}\n참가팀 ${next.teams.length}팀\n원본 경기 ${next.legacyBridge.counts.matches}건\n원본은 변경하지 않고 V3 로컬 상태에 연결했습니다.`,'success');notice('기존 대회 1건을 V3에 연결했습니다.','success');}
  catch(e){legacyBridgeStatus('연결 실패',e.message||String(e),'error');notice(e.message||String(e),'error');}
}
function commit(message){
  if(message)log(message);if(state.settings.autoTimeEnabled)calculateTimeMetrics(state);syncInputs();try{syncCurrentTournamentRuntime();}catch(_e){}safePersistState(message||'현재 상태');render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});updateSetupProgress();renderOperatorControls();applyRoleUI();renderPortalViews();renderDivisionWorkspaceBar();flashSaved();setTimeout(detectAutoSmsEvents,0);
}

function applySynchronizedState(nextState,source='동기화'){
  if(!nextState||typeof nextState!=='object')return;
  state=structuredClone(nextState);
  try{ensureMultiTournamentRuntime();}catch(_e){}
  ensurePrelimState(state);ensureTimeState(state);ensureDrawMeta(state);ensureMessagingState(state);ensureContacts(state);ensureAuditState(state);ensureEarlyMainSettings(state);ensureVenueSettings(state);ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state);ensurePrelimCourtStatuses(state);ensureOperatorState();
  if(state.settings.autoTimeEnabled)calculateTimeMetrics(state);
  syncInputs();syncPrelimInputs();safePersistState(`${source} 상태`);
  render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});
  updateSetupProgress();renderOperatorControls();applyRoleUI();renderPortalViews();renderDivisionWorkspaceBar();flashSaved();
  notice(`${source} 상태를 반영했습니다.`,'success');
}
let stage3510LastSyncFeedback='';
function updateSyncPanel(status={}){
  const label=status.label||'로컬 저장',level=status.level||'info',detail=status.detail||'이 브라우저에 자동 저장됩니다.';
  const badge=$('syncStatusBadge');if(badge){badge.textContent=label;badge.className=`badge ${level==='success'?'badge-safe':level==='error'?'badge-danger':'badge-muted'}`;badge.title=detail;}
  const detailEl=$('syncStatusDetail');if(detailEl)detailEl.textContent=detail;
  const top=$('saveStateBadge');if(top){
    const isError=level==='error',isWarn=level==='warning',isBusy=/저장 중|저장 대기|연결 중|재시도/.test(label);
    top.textContent=isError?'동기화 오류':isWarn?'재시도 중':isBusy?'저장 중':label.includes('완료')||level==='success'?'자동 저장 정상':'자동 저장 ON';
    top.className=`badge ${isError?'badge-danger':level==='success'?'badge-safe':'badge-muted'}`;top.title=detail;
  }
  const key=`${label}|${level}|${detail}`;
  if(key!==stage3510LastSyncFeedback&&(level==='error'||level==='warning'||label==='클라우드 저장 완료')){
    stage3510LastSyncFeedback=key;
    const tone=level==='error'?'error':level==='warning'?'warning':'success';
    try{window.__stage3443ActionFeedback?.(detail,tone,label);}catch(_e){}
  }
}
function loadSyncPanel(){
  const cfg=getSyncSettings();
  setChecked('cloudSyncEnabled',cfg.enabled===true);setValue('syncRoomId',cfg.roomId||'230match-production');setValue('firebaseConfigJson',cfg.firebaseConfigText||'기존 open-match-manager Firebase 자동 연결');
}
function collectSyncPanel(){const raw=String(getValue('firebaseConfigJson','')).trim();return{enabled:getChecked('cloudSyncEnabled',false),roomId:'230match-production',firebaseConfigText:raw==='기존 open-match-manager Firebase 자동 연결'?'':raw,collection:'matchRoomsV5'};}
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
  setValue('byePriority',state.settings.byePriority||'group-first');setValue('venueAssignmentPolicy',state.settings.venueAssignmentPolicy||'round-robin');setChecked('separateVenueQueues',state.settings.separateVenueQueues!==false);setChecked('autoVenuePromotion',state.settings.autoVenuePromotion!==false);setChecked('autoMessageEnabled',state.messaging.settings.autoMessageEnabled!==false);setValue('messageSenderName',state.messaging.settings.senderName||'230MATCH');setValue('messageDeliveryMode',state.messaging.settings.deliveryMode||'sms-uri');setChecked('messageOnCourtAssign',state.messaging.settings.onCourtAssign!==false);setChecked('messageOnQueueMove',state.messaging.settings.onQueueMove!==false);setChecked('smartMessageUpdate',state.messaging.settings.smartMessageUpdate!==false);setValue('messageRepeatPolicy',state.messaging.settings.repeatPolicy||'update-pending');setValue('templatePlaying',state.messaging.settings.templates.playing||'');setValue('templateWait1',state.messaging.settings.templates.wait1||'');setValue('templateShared',state.messaging.settings.templates.shared||'');setChecked('autoSmsApprovalEnabled',state.messaging.settings.autoSmsApprovalEnabled===true);setChecked('autoSmsCourtWaiting',state.messaging.settings.autoSmsCourtWaiting!==false);setChecked('autoSmsCourtChanged',state.messaging.settings.autoSmsCourtChanged!==false);setChecked('autoSmsMatchStart',state.messaging.settings.autoSmsMatchStart!==false);setChecked('autoSmsMatchComplete',state.messaging.settings.autoSmsMatchComplete===true);
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
  state.settings.byePriority=getValue('byePriority',state.settings.byePriority||'group-first');state.settings.venueAssignmentPolicy=getValue('venueAssignmentPolicy',state.settings.venueAssignmentPolicy||'round-robin');state.settings.separateVenueQueues=getChecked('separateVenueQueues',state.settings.separateVenueQueues!==false);state.settings.autoVenuePromotion=getChecked('autoVenuePromotion',state.settings.autoVenuePromotion!==false);state.messaging.settings.autoMessageEnabled=getChecked('autoMessageEnabled',state.messaging.settings.autoMessageEnabled!==false);state.messaging.settings.senderName=getValue('messageSenderName',state.messaging.settings.senderName||'230MATCH');state.messaging.settings.deliveryMode=getValue('messageDeliveryMode',state.messaging.settings.deliveryMode||'sms-uri');state.messaging.settings.onCourtAssign=getChecked('messageOnCourtAssign',state.messaging.settings.onCourtAssign!==false);state.messaging.settings.onQueueMove=getChecked('messageOnQueueMove',state.messaging.settings.onQueueMove!==false);state.messaging.settings.smartMessageUpdate=getChecked('smartMessageUpdate',state.messaging.settings.smartMessageUpdate!==false);state.messaging.settings.repeatPolicy=getValue('messageRepeatPolicy',state.messaging.settings.repeatPolicy||'update-pending');state.messaging.settings.templates.playing=getValue('templatePlaying',state.messaging.settings.templates.playing);state.messaging.settings.templates.wait1=getValue('templateWait1',state.messaging.settings.templates.wait1);state.messaging.settings.templates.shared=getValue('templateShared',state.messaging.settings.templates.shared);state.messaging.settings.autoSmsApprovalEnabled=getChecked('autoSmsApprovalEnabled',state.messaging.settings.autoSmsApprovalEnabled===true);state.messaging.settings.autoSmsCourtWaiting=getChecked('autoSmsCourtWaiting',state.messaging.settings.autoSmsCourtWaiting!==false);state.messaging.settings.autoSmsCourtChanged=getChecked('autoSmsCourtChanged',state.messaging.settings.autoSmsCourtChanged!==false);state.messaging.settings.autoSmsMatchStart=getChecked('autoSmsMatchStart',state.messaging.settings.autoSmsMatchStart!==false);state.messaging.settings.autoSmsMatchComplete=getChecked('autoSmsMatchComplete',state.messaging.settings.autoSmsMatchComplete===true);
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
  if(!requireOperator('경기 운영'))return;
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
  if(!requireOperator('경기 운영'))return;
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
  const existingMatches=allMatches(state.draw).filter(m=>m?.teamA||m?.teamB).length;
  if(!confirm(`현재 ${state.draw.size}강 대진 ${existingMatches}경기를 모두 다시 추첨할까요?\n\n기존 코트 배정과 대기열은 초기화됩니다.`))return;
  const typed=prompt('재추첨을 계속하려면 “재추첨”을 입력하세요.','');
  if(typed!=='재추첨'){notice('본선 재추첨을 취소했습니다.','error');return;}
  autoRecovery('본선 재추첨 직전');
  if(state.settings.drawMethod==='roulette'){openRoulette();return;}
  state.draw=createDrawWithMethod(state,state.teams,state.settings.drawSize,{method:state.settings.drawMethod,byePriority:state.settings.byePriority});
  state.courts=[];state.sharedQueue=[];
  commit(`본선 재추첨 · ${state.settings.drawMethod} · 체크섬 ${state.drawMeta.checksum}`);
  notice('복구점을 저장한 뒤 본선 대진을 다시 추첨했습니다.','success');
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
  if(!hasAuthorizedMainDraw(state))throw new Error('본선 추첨을 먼저 실행하세요. 본선 미추첨 상태에서는 공용대기와 코트배정을 만들 수 없습니다.');
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
      notice(`새로 배정할 경기가 없습니다. 확정 경기는 이미 자동 배정되어 있습니다. 현재 코트·대기1 ${active}경기, 공용대기 ${queued}경기입니다.${result.pendingPlayIns?` 미완료 똥통 ${result.pendingPlayIns}경기는 확정되는 즉시 최우선 배정됩니다.`:''}${repaired?` 중복·무효 큐 ${repaired}건을 자동 정리했습니다.`:''}`,'success');
      return;
    }
    commit(`예선·본선 통합 코트배정 · 신규 본선 ${result.assigned}경기 · 큐정리 ${repaired}건`);
    notice(`확정 본선 ${result.assigned}경기를 배정했습니다.${result.prioritizedPlayIns?` 똥통 ${result.prioritizedPlayIns}경기를 최우선으로 배치했습니다.`:''}${result.pendingPlayIns?` 아직 미확정인 똥통 ${result.pendingPlayIns}경기는 확정 즉시 우선 배정됩니다.`:''}${repaired?` 중복·무효 큐 ${repaired}건을 자동 정리했습니다.`:''}`,'success');
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
function ensureResultChangeHistory(){
  ensureOperatorState();
  if(!Array.isArray(state.operation.resultChangeHistory))state.operation.resultChangeHistory=[];
  return state.operation.resultChangeHistory;
}
function stage333ApplyLoserScore(prefix, editedSide){
  const scoreA=$(prefix==='prelim'?'prelimScoreA':'scoreA');
  const scoreB=$(prefix==='prelim'?'prelimScoreB':'scoreB');
  const winner=$(prefix==='prelim'?'prelimWinnerSelect':'winnerSelect');
  if(!scoreA||!scoreB||!winner)return;
  const edited=editedSide==='A'?scoreA:scoreB;
  const other=editedSide==='A'?scoreB:scoreA;
  const value=edited.value===''?null:Number(edited.value);
  if(value===null){other.value='';return;}
  if(!Number.isInteger(value)||value<0||value>5){
    edited.setCustomValidity('진 팀 게임스코어는 0~5만 입력하세요.');
    return;
  }
  edited.setCustomValidity('');
  other.setCustomValidity('');
  other.value='6';
  winner.value=editedSide==='A'?winner.options[1]?.value:winner.options[0]?.value;
}
function stage333PrepareScoreInputs(prefix,{scoreA=null,scoreB=null,completed=false}={}){
  const a=$(prefix==='prelim'?'prelimScoreA':'scoreA');
  const b=$(prefix==='prelim'?'prelimScoreB':'scoreB');
  if(!a||!b)return;
  [a,b].forEach(input=>{input.min='0';input.max='6';input.step='1';input.inputMode='numeric';input.setCustomValidity('');});
  if(completed){a.value=scoreA??6;b.value=scoreB??0;}else{a.value='';b.value='';}
}
function stage333BindQuickScoreInputs(){
  [['scoreA','scoreB',''],['prelimScoreA','prelimScoreB','prelim']].forEach(([aId,bId,prefix])=>{
    const a=$(aId),b=$(bId);if(!a||!b||a.dataset.quickScoreBound==='1')return;
    a.dataset.quickScoreBound=b.dataset.quickScoreBound='1';
    a.addEventListener('focus',()=>{if(a.value==='6'&&b.value!=='6')a.select();});
    b.addEventListener('focus',()=>{if(b.value==='6'&&a.value!=='6')b.select();});
    a.addEventListener('input',()=>stage333ApplyLoserScore(prefix,'A'));
    b.addEventListener('input',()=>stage333ApplyLoserScore(prefix,'B'));
  });
}
function stage333NormalizeScores(prefix,match){
  const a=$(prefix==='prelim'?'prelimScoreA':'scoreA');
  const b=$(prefix==='prelim'?'prelimScoreB':'scoreB');
  const winner=$(prefix==='prelim'?'prelimWinnerSelect':'winnerSelect');
  const scoreA=Number(a?.value),scoreB=Number(b?.value);
  if(!Number.isInteger(scoreA)||!Number.isInteger(scoreB))throw new Error('진 팀 게임스코어 한쪽만 입력하세요. 나머지는 6점으로 자동 완성됩니다.');
  if(!((scoreA===6&&scoreB>=0&&scoreB<=5)||(scoreB===6&&scoreA>=0&&scoreA<=5)))throw new Error('한 팀은 6점, 진 팀은 0~5점이어야 합니다. 진 팀 점수만 입력하세요.');
  const winnerId=scoreA===6?match.teamA?.id:match.teamB?.id;
  if(winner)winner.value=winnerId;
  return{scoreA,scoreB,winnerId};
}

const STAGE340_EXCEPTION_LABELS={retired:'기권',injury:'부상',walkover:'불참',admin:'운영자 판정'};
function stage340Panel(prefix){return document.querySelector(`[data-score-panel="${prefix||'main'}"]`)}
function stage340UpdatePreview(prefix){
  const panel=stage340Panel(prefix),a=$(prefix==='prelim'?'prelimScoreA':'scoreA'),b=$(prefix==='prelim'?'prelimScoreB':'scoreB');
  if(!panel||!a||!b)return;
  const ex=panel.querySelector('[data-exception-type]')?.value||'';
  const p=panel.querySelector('[data-score-preview]');
  const av=a.value,bv=b.value;
  p.textContent=(av!==''&&bv!=='')?`${av} : ${bv}${ex?` · ${STAGE340_EXCEPTION_LABELS[ex]}`:''}`:'진 팀과 게임스코어를 선택하세요.';
}
function stage340ResetPanel(prefix){
  const panel=stage340Panel(prefix);if(!panel)return;
  panel.dataset.loserSide='';panel.querySelectorAll('[data-team-score]').forEach(b=>b.classList.remove('is-selected'));
  const ex=panel.querySelector('[data-exception-type]');if(ex)ex.value='';stage340UpdatePreview(prefix);
}
function stage340BindScorePanels(){
  document.querySelectorAll('[data-score-panel]').forEach(panel=>{
    if(panel.dataset.bound==='1')return;
    panel.dataset.bound='1';
    const prefix=panel.dataset.scorePanel==='prelim'?'prelim':'';
    panel.querySelectorAll('[data-team-score]').forEach(btn=>btn.addEventListener('click',()=>{
      const row=btn.closest('[data-team-side]');
      const side=row?.dataset.teamSide;
      if(!side)return;
      panel.dataset.loserSide=side;
      panel.querySelectorAll('[data-team-score]').forEach(x=>x.classList.toggle('is-selected',x===btn));
      const input=$(prefix==='prelim'?(side==='A'?'prelimScoreA':'prelimScoreB'):(side==='A'?'scoreA':'scoreB'));
      input.value=btn.dataset.teamScore;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      stage340UpdatePreview(prefix);
    }));
    panel.querySelector('[data-exception-type]')?.addEventListener('change',()=>stage340UpdatePreview(prefix));
  });
}
function stage340ResultMeta(prefix){const panel=stage340Panel(prefix);return{resultType:panel?.querySelector('[data-exception-type]')?.value||'normal'}}

function openResult(matchId){
  if(!requireOperator('경기 운영'))return;
  const m=findMatch(state.draw,matchId);if(!m)return;
  stage333BindQuickScoreInputs();stage340BindScorePanels();stage340ResetPanel('');
  $('resultMatchId').value=matchId;$('resultMatchLabel').textContent=`${teamText(m.teamA)} vs ${teamText(m.teamB)}`;
  $('winnerSelect').innerHTML=`<option value="${m.teamA.id}">${teamText(m.teamA)}</option><option value="${m.teamB.id}">${teamText(m.teamB)}</option>`;if($('resultTeamAName'))$('resultTeamAName').textContent=teamText(m.teamA);if($('resultTeamBName'))$('resultTeamBName').textContent=teamText(m.teamB);
  if(m.status==='completed'){
    $('winnerSelect').value=m.winner?.id||m.winnerId||m.teamA.id;
    stage333PrepareScoreInputs('',{scoreA:Number(m.scoreA??6),scoreB:Number(m.scoreB??0),completed:true});
    if(!document.getElementById('stage332ResultEditWarning'))$('resultMatchLabel').insertAdjacentHTML('afterend','<div id="stage332ResultEditWarning" class="stage332-safety-note">이미 확정된 결과입니다. 진 팀 점수만 고치면 상대편은 6점으로 자동 변경됩니다.</div>');
  }else{stage333PrepareScoreInputs('',{completed:false});document.getElementById('stage332ResultEditWarning')?.remove();}
  stage340UpdatePreview('');
  $('resultDialog').showModal();
  setTimeout(()=>stage340Panel('')?.querySelector('[data-team-score]')?.focus(),0);
}
function confirmResult(event){
  event.preventDefault();
  const id=$('resultMatchId').value;
  const before=findMatch(state.draw,id);if(!before){notice('경기 정보를 찾을 수 없습니다.','error');return;}
  let normalized;try{normalized=stage333NormalizeScores('',before);}catch(error){notice(error.message,'error');return;}
  const {scoreA,scoreB,winnerId}=normalized;
  const correcting=before.status==='completed';
  if(correcting){
    const typed=prompt('확정된 결과를 수정하려면 “결과수정”을 입력하세요.','');
    if(typed!=='결과수정'){notice('결과 수정을 취소했습니다.','error');return;}
  }else if(!confirm(`${teamText(before.teamA)} ${scoreA} : ${scoreB} ${teamText(before.teamB)}\n\n승리팀: ${teamText(scoreA>scoreB?before.teamA:before.teamB)}\n이 결과를 확정할까요?`))return;
  autoRecovery(correcting?'확정 경기 결과 수정 전':'경기 결과 입력 전');
  const history=ensureResultChangeHistory();
  const beforeSnapshot={status:before.status||'waiting',winner:before.winner?teamText(before.winner):'',scoreA:Number(before.scoreA||0),scoreB:Number(before.scoreB||0)};
  const sourceCourt=[...(state.prelim?.courts||[]),...(state.courts||[])].find(c=>c.playing===id);const beforePlaying=sourceCourt?.playing||null,beforeWait1=sourceCourt?.wait1||null;
  const m=submitResult(state,{matchId:id,winnerId,scoreA,scoreB});const meta340=stage340ResultMeta('');m.resultType=meta340.resultType;m.resultTypeLabel=STAGE340_EXCEPTION_LABELS[meta340.resultType]||'일반 경기';
  history.unshift({id:`rh-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,at:new Date().toISOString(),matchId:id,teamA:teamText(m.teamA),teamB:teamText(m.teamB),scoreA:Number(m.scoreA),scoreB:Number(m.scoreB),winner:teamText(m.winner),corrected:correcting,before:beforeSnapshot});
  state.operation.resultChangeHistory=history.slice(0,100);
  const flowReport=verifyAndRepairMainFlow(state,{sourceMatchId:id});
  const completionReport=finalizeTournamentCompletion(state);
  const isUnifiedCourt=Boolean(sourceCourt&&(state.prelim?.courts||[]).some(c=>c.id===sourceCourt.id));
  if(isUnifiedCourt){advanceUnifiedCourt(state,sourceCourt.id,id);enqueueReadyMainToUnifiedCourts(state);}
  if(sourceCourt&&state.messaging.settings.autoMessageEnabled&&state.messaging.settings.onQueueMove){if(sourceCourt.playing&&sourceCourt.playing!==beforePlaying)generatePlayingMessages(state,sourceCourt.playing,sourceCourt.name);if(sourceCourt.wait1&&sourceCourt.wait1!==beforeWait1)generateWait1Messages(state,sourceCourt.wait1,sourceCourt.name)}
  commit(`결과 확정 · ${m.id} · 승리 ${teamText(m.winner)} · ${m.scoreA}:${m.scoreB}`);
  $('resultDialog').close();
  const flowText=completionReport.completed?` 대회가 종료되었습니다. 우승 ${teamText(completionReport.champion)}.`:(flowReport.nextMatchId?(flowReport.nextReady?' 다음 라운드 경기가 확정되어 자동 대기열에 연결됩니다.':' 다음 라운드는 상대 결과를 기다립니다.'):' 최종 경기 결과가 반영되었습니다.');
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
  if(!requireOperator('경기 운영'))return;
  try{assertPrelimUnlocked('결과 입력');}catch(e){prelimNotice(e.message,'error');return;}
  const m=findPrelimMatch(state,matchId);if(!m)return;
  stage333BindQuickScoreInputs();stage340BindScorePanels();stage340ResetPanel('prelim');
  $('prelimResultMatchId').value=matchId;
  $('prelimResultMatchLabel').textContent=`${teamText(m.teamA)} vs ${teamText(m.teamB)}`;
  $('prelimWinnerSelect').innerHTML=`<option value="${m.teamA.id}">${teamText(m.teamA)}</option><option value="${m.teamB.id}">${teamText(m.teamB)}</option>`;if($('prelimResultTeamAName'))$('prelimResultTeamAName').textContent=teamText(m.teamA);if($('prelimResultTeamBName'))$('prelimResultTeamBName').textContent=teamText(m.teamB);
  $('prelimWinnerSelect').value=m.winner?.id||m.winnerId||m.teamA.id;
  stage333PrepareScoreInputs('prelim',{scoreA:m.scoreA,scoreB:m.scoreB,completed:m.status==='completed'});
  $('prelimResultDialog').showModal();
  setTimeout(()=>stage340Panel('prelim')?.querySelector('[data-team-score]')?.focus(),0);
}
function confirmPrelimResult(event){
  event.preventDefault();
  const pendingMatch=findPrelimMatch(state,$('prelimResultMatchId').value);
  if(!pendingMatch){prelimNotice('경기 정보를 찾을 수 없습니다.','error');return;}
  let normalized;try{normalized=stage333NormalizeScores('prelim',pendingMatch);}catch(error){prelimNotice(error.message,'error');return;}
  const {scoreA,scoreB,winnerId}=normalized;
  const sourceCourtId=pendingMatch?.prelimCourtId||null;
  const involvedTeamIds=new Set([pendingMatch?.teamA?.id,pendingMatch?.teamB?.id].filter(Boolean));
  const beforeResolvedPlayIns=new Set(Object.values(state.draw?.rounds||{}).flat().filter(x=>x.isPlayIn&&x.teamA&&!x.teamA.placeholder&&x.teamB&&!x.teamB.placeholder).map(x=>x.id));
  const m=submitPrelimResult(state,{matchId:$('prelimResultMatchId').value,winnerId,scoreA,scoreB});const meta340=stage340ResultMeta('prelim');m.resultType=meta340.resultType;m.resultTypeLabel=STAGE340_EXCEPTION_LABELS[meta340.resultType]||'일반 경기';
  const syncResult=syncLinkedDraw({silent:true});
  const newlyResolvedPlayIns=Object.values(state.draw?.rounds||{}).flat().filter(x=>x.isPlayIn&&!beforeResolvedPlayIns.has(x.id)&&x.teamA&&!x.teamA.placeholder&&x.teamB&&!x.teamB.placeholder);
  const directPlayIn=newlyResolvedPlayIns.find(x=>involvedTeamIds.has(x.teamA?.id)||involvedTeamIds.has(x.teamB?.id))||newlyResolvedPlayIns[0]||null;
  // 중요: 예선 결과 직후 확정된 본선 경기를 종료 코트의 시합중 자리에 직접 삽입하지 않습니다.
  // submitPrelimResult()가 먼저 기존 예선 대기1을 시합중으로, 추가대기를 대기1로 원자 승격한 뒤,
  // 본선은 남은 빈 시합중 또는 빈 대기1에만 배정됩니다.
  const autoResult=useUnifiedCourts(state)?enqueueReadyMainToUnifiedCourts(state,{priorityMatchIds:newlyResolvedPlayIns.map(x=>x.id)}):autoAssignResolvedMain(state,{findMatch,queueReadyMatches,refillCourt});
  if((autoResult.assigned===true||Number(autoResult.assigned)>0)&&state.messaging.settings.autoMessageEnabled){generateCurrentCourtMessages(state);generateCurrentWaitMessages(state);}
  commit(`예선 결과 확정 · ${m.id} · 승리 ${teamText(m.winner)} · ${m.scoreA}:${m.scoreB}${syncResult.changes.length?` · 본선 자동반영 ${syncResult.changes.length}팀`:''}${newlyResolvedPlayIns.length?` · 본선 신규확정 ${newlyResolvedPlayIns.length}경기`:''}${autoResult.assigned?' · 빈 자리 본선 자동배정':''}`);
  $('prelimResultDialog').close();
  prelimNotice(autoResult.assigned?'예선 대기열을 먼저 승격한 뒤 남은 빈 자리만 본선으로 채웠습니다.':autoResult.reason==='no-courts'?'본선 팀은 확정됐습니다. 최초 본선 코트배정을 실행하면 운영이 시작됩니다.':'예선 순위와 진출팀을 다시 계산했습니다. 확정된 본선 경기는 예선 예약열 뒤의 빈 자리에서만 배정됩니다.','success');
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
  if(!requireTypedConfirmation('전체 초기화','초기화'))return;
  autoRecovery('전체 초기화 직전');clearState();state=initialState();commit('전체 초기화');notice('전체 초기화를 완료했습니다. 초기화 직전 복구점은 IndexedDB에 저장을 시도했습니다.','info');
}
async function showRecoveries(){
  const root=$('recoveryList');
  root.innerHTML='<div class="empty-state"><p>로컬 복구점을 불러오는 중입니다.</p></div>';
  $('recoveryDialog').showModal();
  const list=await getRecoveries();
  root.innerHTML=list.length?list.map(x=>`<article class="recovery-item"><div><b>${x.label}</b><small>${new Date(x.createdAt).toLocaleString('ko-KR')} · 이 브라우저 로컬 저장</small></div><button class="btn btn-primary" data-restore="${x.id}">복구</button><button class="btn btn-danger-outline" data-delete="${x.id}">삭제</button></article>`).join(''):'<div class="empty-state"><p>저장된 로컬 복구점이 없습니다.</p></div>';
  root.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{if(!requireAdmin('복구점 복원'))return;const item=await getRecovery(b.dataset.restore);if(!item)return;if(!confirm(`현재 상태를 별도 복구점으로 저장한 뒤 “${item.label}” 상태로 되돌릴까요?`))return;if(!requireTypedConfirmation('복구점 복원','복원'))return;autoRecovery('복구점 복원 직전');state=structuredClone(item.state);commit(`로컬 복구점 복원 · ${item.label}`);$('recoveryDialog').close();});
  root.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!requireAdmin('복구점 삭제'))return;if(!confirm('선택한 복구점을 삭제할까요? 삭제한 복구점은 되돌릴 수 없습니다.'))return;await deleteRecovery(b.dataset.delete);await showRecoveries();});
}

let timeTimer=null;
function refreshTimeEngine({save=false,renderNow=false}={}){
  if(state.settings.autoTimeEnabled)calculateTimeMetrics(state);
  // 성능 안정화: 백그라운드 타이머에서는 전체 상태 저장과 전체 화면 재렌더를 하지 않는다.
  // 실제 운영 변경은 commit() 경로에서 계산·저장·렌더되므로 데이터 보존에는 영향이 없다.
  if(save)safePersistState('시간 정보 갱신');
  if(renderNow)render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});
}
function restartTimeTimer(){
  clearInterval(timeTimer);
  const seconds=Math.max(60,Number(state.settings.timeRefreshSeconds)||60);
  timeTimer=setInterval(()=>{
    if(!state.settings.autoTimeEnabled||document.hidden)return;
    const active=document.activeElement;
    if(active?.matches?.('input,textarea,select,[contenteditable="true"]')||document.querySelector('dialog[open]'))return;
    // 시간 계산만 조용히 갱신한다. 전체 렌더/저장은 사용자 조작 시 commit()에서 처리한다.
    calculateTimeMetrics(state);
  },seconds*1000);
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

function ensureSmsDeliveryLogs(){ensureMessagingState(state);if(!Array.isArray(state.messaging.deliveryLogs))state.messaging.deliveryLogs=[];return state.messaging.deliveryLogs;}
function smsAcceptancePayload(){
  ensureMessagingState(state);const settings=state.messaging.settings||{},teams=Array.isArray(state.teams)?state.teams:[];
  const contacts=teams.map(team=>({team,recipients:smsTeamRecipients(team)}));
  const withPhone=contacts.filter(x=>x.recipients.length).length,noPhone=Math.max(0,teams.length-withPhone);
  const queue=state.messaging.queue||[],pending=queue.filter(x=>x.status==='pending'),missing=queue.filter(x=>x.status==='no-phone');
  const identity=new Map(),duplicates=[];for(const item of pending){const key=item.identityKey||[item.type,item.matchId,item.teamId||item.teamName].join('|');if(identity.has(key))duplicates.push({key,first:identity.get(key).id,duplicate:item.id});else identity.set(key,item);}
  const history=Array.isArray(state.messaging.smsApprovalHistory)?state.messaging.smsApprovalHistory:[];
  const eventKeys=new Set(),historyDuplicates=[];for(const item of history){if(!item?.key)continue;if(eventKeys.has(item.key))historyDuplicates.push(item.key);eventKeys.add(item.key);}
  const sample=(()=>{const snap=buildAutoSmsSnapshot();for(const [id,p] of Object.entries(snap.placements)){const match=findAnyMatchById(id);if(match){const recipients=smsMatchRecipients(match);return{matchId:id,court:p.court||'',slot:p.slot||'',recipients,body:autoSmsBody(p.slot==='playing'?'start':'waiting',match,p)};}}return null;})();
  const checks=[
    {label:'알리고 Worker 주소',ok:/^https:\/\//.test(ALIGO_PROXY_URL),detail:ALIGO_PROXY_URL},
    {label:'알리고 인증키 설정',ok:Boolean(ALIGO_CLIENT_KEY),detail:ALIGO_CLIENT_KEY?'클라이언트 키 설정됨':'키 누락'},
    {label:'운영 권한',ok:canOperate(),detail:canOperate()?'관리자/진행자 권한 확인':'운영 권한 필요'},
    {label:'자동 승인 설정',ok:settings.autoSmsApprovalEnabled===true,warning:settings.autoSmsApprovalEnabled!==true,detail:settings.autoSmsApprovalEnabled===true?'사용 중':'현재 꺼짐'},
    {label:'참가팀 연락처',ok:teams.length>0&&withPhone>0,warning:noPhone>0,detail:`${withPhone}/${teams.length}팀 등록 · 미등록 ${noPhone}팀`},
    {label:'발송 대기 번호',ok:missing.length===0,warning:missing.length>0,detail:`정상 ${pending.length}건 · 번호 없음 ${missing.length}건`},
    {label:'미발송 문자 중복',ok:duplicates.length===0,detail:duplicates.length?`${duplicates.length}건 중복`:'중복 없음'},
    {label:'자동 이벤트 중복키',ok:historyDuplicates.length===0,detail:historyDuplicates.length?`${historyDuplicates.length}건 중복`:'중복 없음'},
    {label:'현재 경기 시험대상',ok:Boolean(sample&&sample.recipients.length),warning:Boolean(sample&&!sample.recipients.length),detail:sample?`${sample.court||'-'} · ${sample.recipients.length}명`:'현재 배정 경기 없음'}
  ];
  const fail=checks.filter(x=>!x.ok&&!x.warning).length,warn=checks.filter(x=>x.warning).length;
  return{format:'230MATCH_V3_SMS_ACCEPTANCE',build:BUILD_LABEL,generatedAt:new Date().toISOString(),decision:fail?'HOLD':'PASS',counts:{teams:teams.length,withPhone,noPhone,pending:pending.length,noPhoneMessages:missing.length,duplicates:duplicates.length,historyDuplicates:historyDuplicates.length,fail,warn},settings:{autoSmsApprovalEnabled:settings.autoSmsApprovalEnabled===true,courtWaiting:settings.autoSmsCourtWaiting!==false,courtChanged:settings.autoSmsCourtChanged!==false,matchStart:settings.autoSmsMatchStart!==false,matchComplete:settings.autoSmsMatchComplete===true,deliveryMode:settings.deliveryMode||'sms-uri'},checks,sample,deliveryLogs:ensureSmsDeliveryLogs().slice(0,30)};
}
let lastSmsAcceptance=null;
function renderSmsAcceptance(payload=lastSmsAcceptance){const root=$('smsAcceptanceResult'),badge=$('smsAcceptanceBadge');if(!root||!badge)return;if(!payload){root.innerHTML='<div class="portal-empty">문자 운영 점검을 실행하세요.</div>';badge.className='badge';badge.textContent='검수 전';return;}const ok=payload.decision==='PASS';badge.className=`badge ${ok?'badge-safe':'badge-danger'}`;badge.textContent=ok?'PASS · 운영 가능':'HOLD · 확인 필요';root.innerHTML=`<div class="sms-acceptance-summary"><strong>${ok?'문자 운영 가능':'문자 운영 확인 필요'}</strong><span>연락처 ${payload.counts.withPhone}/${payload.counts.teams}팀 · 경고 ${payload.counts.warn} · 실패 ${payload.counts.fail}</span></div><div class="sms-check-list">${payload.checks.map(x=>`<div class="sms-check-row ${x.ok?'pass':x.warning?'warn':'fail'}"><b>${x.ok?'✅':x.warning?'⚠️':'❌'} ${escapeHtml(x.label)}</b><span>${escapeHtml(x.detail)}</span></div>`).join('')}</div>`;}
function runSmsAcceptance(){if(!requireOperator('문자 운영 점검'))return;lastSmsAcceptance=smsAcceptancePayload();renderSmsAcceptance(lastSmsAcceptance);ensureSmsDeliveryLogs().unshift({at:new Date().toISOString(),type:'acceptance',status:lastSmsAcceptance.decision,detail:`실패 ${lastSmsAcceptance.counts.fail} · 경고 ${lastSmsAcceptance.counts.warn}`});state.messaging.deliveryLogs=state.messaging.deliveryLogs.slice(0,100);safePersistState('문자 운영 검수');notice(lastSmsAcceptance.decision==='PASS'?'문자 운영 점검을 통과했습니다.':'확인이 필요한 문자 항목이 있습니다.',lastSmsAcceptance.decision==='PASS'?'success':'error');}
function previewSmsRecipient(){if(!requireOperator('문자 대상 미리보기'))return;const payload=smsAcceptancePayload(),sample=payload.sample;if(!sample)return notice('현재 코트에 배정된 경기가 없습니다.','info');if(!sample.recipients.length)return notice('현재 경기 대상자에게 등록된 전화번호가 없습니다.','error');const target=sample.recipients.map(x=>`${x.name} ${x.phone}`).join('\n');alert(`현재 경기 문자 대상\n\n경기 ID: ${sample.matchId}\n코트: ${sample.court}\n수신자: ${sample.recipients.length}명\n\n${target}\n\n[예정 문구]\n${sample.body}`);}
function downloadSmsAcceptance(){if(!lastSmsAcceptance)lastSmsAcceptance=smsAcceptancePayload();downloadJson(`230match-sms-acceptance-${Date.now()}.json`,lastSmsAcceptance);notice('문자 검수 보고서를 저장했습니다.','success');}
async function sendSmsTestOne(){if(!requireOperator('알리고 시험문자'))return;const phone=smsDigits(getValue('smsTestPhone','')),body=String(getValue('smsTestBody','')).trim(),box=$('smsTestSendNotice');if(phone.length<10){if(box){box.className='notice error';box.textContent='올바른 휴대전화 번호를 입력하세요.';}return;}if(!body){if(box){box.className='notice error';box.textContent='시험 문구를 입력하세요.';}return;}if(!confirm(`${phone} 번호로 실제 시험문자 1건을 발송할까요?\n\n알리고 이용료가 발생할 수 있습니다.`))return;const typed=prompt('실제 발송을 확인하려면 “시험발송”을 입력하세요.','');if(typed!=='시험발송')return;try{if(box){box.className='notice info';box.textContent='알리고 Worker에 시험문자를 요청하는 중입니다...';}const result=await sendAligoSmsV3([{name:'시험 수신자',phone}],body,{source:'sms_acceptance_test',kind:'test',title:'230MATCH 시험문자'});ensureSmsDeliveryLogs().unshift({at:new Date().toISOString(),type:'test-send',status:'success',phoneMasked:phone.slice(0,3)+'****'+phone.slice(-4),response:result});state.messaging.deliveryLogs=state.messaging.deliveryLogs.slice(0,100);safePersistState('알리고 시험문자 성공');if(box){box.className='notice success';box.textContent=`시험문자 발송 요청 성공 · ${phone.slice(0,3)}-****-${phone.slice(-4)}`;}notice('알리고 시험문자 1건 발송 요청이 성공했습니다.','success');}catch(error){ensureSmsDeliveryLogs().unshift({at:new Date().toISOString(),type:'test-send',status:'failed',phoneMasked:phone.slice(0,3)+'****'+phone.slice(-4),error:error?.message||String(error)});state.messaging.deliveryLogs=state.messaging.deliveryLogs.slice(0,100);safePersistState('알리고 시험문자 실패');if(box){box.className='notice error';box.textContent=`시험문자 실패: ${error?.message||error}`;}notice(`시험문자 실패: ${error?.message||error}`,'error');}}



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
      :simulation.reason==='NO_PRELIM_GROUPS'?'예선 복제 모의운영 대기 · 저장된 예선 경기에서 조편성을 복원하지 못했습니다.':`예선 복제 모의운영 실패 · 미완료 ${simulation.unfinished.length}경기`,
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
      ?`복제 모의대회 완주 · 실제 경기 ${simulation.completedMatches}/${simulation.totalMatches} · 자동 부전승 ${simulation.autoByeCount||0} · 우승 ${simulation.winner?.name||'-'}`
      :simulation.reason==='NO_PRELIM_GROUPS'?'복제 모의대회 대기 · 저장된 예선 경기에서 조편성을 복원하지 못했습니다.':simulation.unresolvedSlots?`복제 모의대회 대기 · 예선 결과 슬롯 ${simulation.unresolvedSlots}개를 확정하지 못했습니다.`:`복제 모의대회 실패 · 미완료 ${simulation.unfinished.length}경기`,
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
  if(!requireOperator('경기 운영'))return;
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
  if(!requireOperator('경기 운영'))return;
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
  if(!requireOperator('경기 운영'))return;
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


let prelimPilotReport=null;
function prelimPilotSetStatus(message,type='info'){
  const el=document.getElementById('prelimPilotStatus');if(!el)return;
  el.className=`notice ${type}`;el.textContent=message;
}
function prelimPilotRender(report=null){
  const p=state.prelim||{};
  const values={prelimPilotTeams:`${state.teams?.filter(t=>t.status!=='reserve').length||0}팀`,prelimPilotGroups:`${p.groups?.length||0}조`,prelimPilotMatches:`${p.matches?.length||0}경기`,prelimPilotCourts:`${p.courts?.length||0}면`};
  Object.entries(values).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});
  const badge=document.getElementById('prelimPilotBadge'),list=document.getElementById('prelimPilotChecks'),exp=document.getElementById('prelimPilotExportBtn');
  if(!report){if(badge){badge.className='badge badge-muted';badge.textContent='점검 전';}if(list)list.innerHTML='';if(exp)exp.disabled=true;return;}
  if(badge){badge.className=`badge ${report.pass?'badge-safe':'badge-warning'}`;badge.textContent=report.pass?'PASS':'확인 필요';}
  if(list)list.innerHTML=report.checks.map(x=>`<article class="${x.ok?'ok':'fail'}"><b>${x.ok?'✓':'!'}</b><span><strong>${escapeHtml(x.label)}</strong><small>${escapeHtml(x.detail)}</small></span></article>`).join('');
  if(exp)exp.disabled=false;
}
function prelimPilotBuildReport(){
  const groups=state.prelim?.groups||[],matches=state.prelim?.matches||[],courts=state.prelim?.courts||[];
  const active=state.prelim?.activeTeams||[];
  const ids=groups.flatMap(g=>(g.teams||[]).map(t=>t.id));
  const unique=new Set(ids);
  const groupTeamTotal=groups.reduce((n,g)=>n+(g.teams?.length||0),0);
  const expectedMatches=groups.reduce((n,g)=>n+(g.size===3?3:1),0);
  const assignedGroups=courts.reduce((n,c)=>n+(c.groups?.length||0),0);
  const counts=courts.map(c=>c.groups?.length||0);
  const spread=counts.length?Math.max(...counts)-Math.min(...counts):999;
  const allMatchesAssigned=matches.every(m=>m.prelimCourtId&&m.court);
  const initialSlots=courts.every(c=>!c.groups?.length||(Boolean(c.playing)&&((c.groups?.length||0)===1||Boolean(c.wait1))));
  const checks=[
    {label:'참가팀 중복 없음',ok:ids.length===unique.size,detail:`배정 ${ids.length}팀 · 고유 ${unique.size}팀`},
    {label:'조별 팀 수 일치',ok:groupTeamTotal===active.length&&groups.every(g=>(g.teams?.length||0)===g.size),detail:`조 배정 ${groupTeamTotal}팀 · 예선 사용 ${active.length}팀`},
    {label:'경기 수 계산 일치',ok:matches.length===expectedMatches,detail:`생성 ${matches.length}경기 · 예상 ${expectedMatches}경기`},
    {label:'모든 조 코트 배정',ok:assignedGroups===groups.length&&allMatchesAssigned,detail:`배정 ${assignedGroups}/${groups.length}조 · 경기 코트 ${allMatchesAssigned?'완료':'누락 있음'}`},
    {label:'코트별 조 균등배정',ok:spread<=1,detail:counts.length?`코트별 ${counts.join('·')}조 · 편차 ${spread}`:'사용 코트 없음'},
    {label:'시합중·대기1 초기 구성',ok:initialSlots,detail:`시합중 ${courts.filter(c=>c.playing).length} · 대기1 ${courts.filter(c=>c.wait1).length}`}
  ];
  return {format:'230MATCH_V3_PRELIM_PILOT',build:BUILD_LABEL,generatedAt:new Date().toISOString(),tournament:{name:state.tournament?.name||'',division:state.tournament?.division||''},summary:{teams:active.length,groups:groups.length,matches:matches.length,courts:courts.length},checks,pass:checks.every(x=>x.ok)};
}
async function runPrelimPilot(){
  if(!requireAdmin('예선 실전 점검'))return;
  try{
    assertPrelimUnlocked('예선 실전 점검');
    const activeTeams=(state.teams||[]).filter(t=>t.status!=='reserve');
    if(activeTeams.length<2)throw new Error('참가팀을 2팀 이상 등록하세요.');
    if(!prelimVenues(state).length)throw new Error('대회 설정에서 예선 사용 구장과 코트 수를 먼저 설정하세요.');
    const ok=confirm(`현재 참가팀 ${activeTeams.length}팀으로 예선 조편성과 코트배정을 다시 생성해 점검할까요?\n\n실행 전 현재 상태를 복구점으로 저장합니다.`);if(!ok)return;
    prelimPilotSetStatus('복구점을 저장하고 조편성을 점검하고 있습니다.');
    const recovery=saveRecovery(state,`${state.tournament?.name||'대회'} · 예선 실전 점검 전 자동 복구점`);if(recovery?.ready)await recovery.ready;
    state.teams=[...activeTeams,...(state.teams||[]).filter(t=>t.status==='reserve')];
    const fit=autoFitPrelimGroups(activeTeams.length);
    state.prelim.settings.activeTeamCount=activeTeams.length;
    state.prelim.settings.threeTeamGroups=fit.threeTeamGroups;
    state.prelim.settings.twoTeamGroups=fit.twoTeamGroups;
    const a=document.getElementById('prelimActiveTeamCount'),b=document.getElementById('threeTeamGroupCount'),c=document.getElementById('twoTeamGroupCount');if(a)a.value=activeTeams.length;if(b)b.value=fit.threeTeamGroups;if(c)c.value=fit.twoTeamGroups;
    generatePrelim(state,state.prelim.settings);
    assignPrelimCourts(state);
    prelimPilotReport=prelimPilotBuildReport();
    commit(`예선 실전 점검 · ${activeTeams.length}팀 · ${state.prelim.groups.length}조 · ${state.prelim.courts.length}면 · ${prelimPilotReport.pass?'PASS':'확인 필요'}`);
    prelimPilotRender(prelimPilotReport);
    prelimPilotSetStatus(prelimPilotReport.pass?'예선 조편성·경기 수·코트 균등배정 점검을 통과했습니다. 결과 입력 전 실제 조편성을 확인하세요.':'점검 항목 중 확인이 필요한 부분이 있습니다.',prelimPilotReport.pass?'success':'warning');
  }catch(error){console.error(error);prelimPilotSetStatus(error.message||String(error),'error');notice(error.message||String(error),'error');}
}
async function createPrelimPilotSample(){
  if(!requireAdmin('예선 테스트 명단 생성'))return;
  if((state.teams||[]).length&&!confirm('현재 참가팀 명단을 12팀 테스트 명단으로 바꿀까요? 기존 상태는 복구점으로 저장됩니다.'))return;
  const recovery=saveRecovery(state,`${state.tournament?.name||'대회'} · 12팀 테스트 명단 적용 전`);if(recovery?.ready)await recovery.ready;
  state.teams=Array.from({length:12},(_,i)=>({id:`pilot-team-${Date.now()}-${i+1}`,name:`테스트 ${String(i+1).padStart(2,'0')}팀`,club:`테스트클럽 ${Math.floor(i/2)+1}`,phone:`0100000${String(i+1).padStart(4,'0')}`,status:'active',createdAt:new Date().toISOString()}));
  ensurePrelimState(state);state.prelim.activeTeams=[];state.prelim.reserveTeams=[];state.prelim.groups=[];state.prelim.matches=[];state.prelim.courts=[];
  commit('예선 실전 점검용 12팀 테스트 명단 생성');prelimPilotReport=null;prelimPilotRender();prelimPilotSetStatus('12팀 테스트 명단을 만들었습니다. 이제 조편성·코트 점검을 실행하세요.','success');
}
function exportPrelimPilotReport(){if(!prelimPilotReport){notice('먼저 예선 실전 점검을 실행하세요.','error');return;}downloadJson(`230MATCH_예선실전점검_${Date.now()}.json`,prelimPilotReport);notice('예선 실전 점검 보고서를 저장했습니다.','success');}

  if($('loadSampleBtn'))$('loadSampleBtn').onclick=()=>loadSample().catch(e=>notice(e.message,'error'));
  if($('prelimPilotRunBtn'))$('prelimPilotRunBtn').onclick=runPrelimPilot;
  if($('prelimPilotSampleBtn'))$('prelimPilotSampleBtn').onclick=createPrelimPilotSample;
  if($('prelimPilotExportBtn'))$('prelimPilotExportBtn').onclick=exportPrelimPilotReport;
  prelimPilotRender();

  if($('teamFileInput'))$('teamFileInput').onchange=e=>{const f=e.target.files[0];if(f)readTeamFile(f).catch(err=>notice(err.message,'error'));};
  if($('instantDrawBtn'))$('instantDrawBtn').onclick=()=>{try{runDrawMethod('instant');}catch(e){notice(e.message,'error');}};
  if($('rouletteDrawBtn'))$('rouletteDrawBtn').onclick=()=>{try{runDrawMethod('roulette');}catch(e){notice(e.message,'error');}};
  if($('seededDrawBtn'))$('seededDrawBtn').onclick=()=>{try{runDrawMethod('seeded');}catch(e){notice(e.message,'error');}};
  if($('reshuffleDrawBtn'))$('reshuffleDrawBtn').onclick=()=>{try{reshuffle();}catch(e){notice(e.message,'error');}};
  if($('lockDrawBtn'))$('lockDrawBtn').onclick=()=>{try{openDrawLockDialog();}catch(e){notice(e.message,'error');}};
  if($('unlockDrawBtn'))$('unlockDrawBtn').onclick=()=>{try{openDrawUnlockDialog();}catch(e){notice(e.message,'error');}};
  if($('drawLockConfirmCheck'))$('drawLockConfirmCheck').onchange=()=>{$('confirmDrawLockBtn').disabled=!$('drawLockConfirmCheck').checked;};
  if($('confirmDrawLockBtn'))$('confirmDrawLockBtn').onclick=confirmDrawLock;
  if($('unlockConfirmText'))$('unlockConfirmText').oninput=()=>{$('confirmDrawUnlockBtn').disabled=$('unlockConfirmText').value.trim()!=='잠금해제';};
  if($('confirmDrawUnlockBtn'))$('confirmDrawUnlockBtn').onclick=confirmDrawUnlock;
  if($('startRouletteBtn'))$('startRouletteBtn').onclick=startRoulette;$('skipRouletteBtn').onclick=finishRoulette;
  if($('cancelRouletteBtn'))$('cancelRouletteBtn').onclick=()=>{clearInterval(rouletteTimer);$('rouletteDialog').close();};
  if($('clearDrawHistoryBtn'))$('clearDrawHistoryBtn').onclick=()=>{clearDrawHistory(state);commit('본선 추첨 기록 삭제');};
  if($('assignCourtsBtn'))$('assignCourtsBtn').onclick=()=>{try{assign();}catch(e){notice(e.message,'error');}};
  if($('refreshQueueBtn'))$('refreshQueueBtn').onclick=refreshQueue;if($('resetBtn'))$('resetBtn').onclick=hardReset;
  if($('recalculateTimeBtn'))$('recalculateTimeBtn').onclick=()=>{pullSettings();calculateTimeMetrics(state);commit('예상 대기시간 즉시 계산');notice('예상시간을 다시 계산했습니다.','success');};
  if($('autoTimeEnabled'))$('autoTimeEnabled').onchange=()=>{pullSettings();commit(`대기시간 자동계산 ${state.settings.autoTimeEnabled?'ON':'OFF'}`);restartTimeTimer();};
  if($('autoIncrementalMainEnabled'))$('autoIncrementalMainEnabled').onchange=()=>{pullSettings();commit(`확정 본선 자동 추가배정 ${state.settings.autoIncrementalMainEnabled?'ON':'OFF'}`);notice(`확정 본선 자동 추가배정을 ${state.settings.autoIncrementalMainEnabled?'켰습니다.':'껐습니다.'}`,'success');};
  if($('timeRefreshSeconds'))$('timeRefreshSeconds').onchange=()=>{pullSettings();commit(`진행시간 갱신주기 ${state.settings.timeRefreshSeconds}초`);restartTimeTimer();};
  if($('confirmResultBtn'))$('confirmResultBtn').onclick=confirmResult;
  if($('autoFitPrelimBtn'))$('autoFitPrelimBtn').onclick=()=>{try{autoFitPrelim();}catch(e){prelimNotice(e.message,'error');}};
  if($('generatePrelimBtn'))$('generatePrelimBtn').onclick=()=>{try{createPrelim();}catch(e){prelimNotice(e.message,'error');}};
  if($('assignPrelimCourtsBtn'))$('assignPrelimCourtsBtn').onclick=()=>{try{assignPrelim();}catch(e){prelimNotice(e.message,'error');}};
  if($('swapReserveBtn'))$('swapReserveBtn').onclick=()=>{
    reserveSwapMode=!reserveSwapMode;
    if(!reserveSwapMode){pendingActiveSwapId=null;state.prelim.swapSelection=null;}
    $('swapReserveBtn').classList.toggle('swap-mode-active',reserveSwapMode);
    $('swapReserveBtn').textContent=reserveSwapMode?'교체할 참가팀 선택':'후보 교체 모드';
    prelimNotice(reserveSwapMode?'교체할 예선 참가팀의 교체 버튼을 누르세요.':'후보 교체 모드를 종료했습니다.','info');
    commit();
  };
  if($('generateLinkedDrawBtn'))$('generateLinkedDrawBtn').onclick=()=>{try{createLinkedDraw();}catch(e){prelimNotice(e.message,'error');}};
  if($('syncLinkedDrawBtn'))$('syncLinkedDrawBtn').onclick=()=>{try{syncLinkedDraw();}catch(e){prelimNotice(e.message,'error');}};
  if($('lockPrelimBtn'))$('lockPrelimBtn').onclick=()=>{try{finalizeAndLockPrelim();}catch(e){prelimNotice(e.message,'error');}};
  if($('unlockPrelimBtn'))$('unlockPrelimBtn').onclick=adminUnlockPrelim;
  if($('confirmPrelimResultBtn'))$('confirmPrelimResultBtn').onclick=confirmPrelimResult;
  if($('resetPrelimBtn'))$('resetPrelimBtn').onclick=resetPrelimOnly;
  if($('useQualifiersForDrawBtn'))$('useQualifiersForDrawBtn').onclick=()=>{try{useQualifiersForDraw();}catch(e){prelimNotice(e.message,'error');}};
  function safeFilePart(value){return String(value||'230match').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'_').slice(0,80)||'230match';}
  function exportFullBackup(){
    const payload={format:'230MATCH_V3_FULL_BACKUP',schemaVersion:2,archiveSchema:'230match-archive-v1',archiveCount:(state.portal?.archives||[]).length,appBuild:BUILD_LABEL,exportedAt:new Date().toISOString(),state:structuredClone(state)};
    downloadJson(`${safeFilePart(state.tournament?.name)}-전체백업-${Date.now()}.json`,payload);
    notice('대회 전체 백업을 저장했습니다.','success');
  }
  async function importFullBackup(file){
    if(!file)return;
    if(!requireAdmin('대회 전체 백업 복원'))return;
    let parsed;
    try{parsed=JSON.parse(await file.text());}catch(error){notice('백업 JSON 파일을 읽을 수 없습니다.','error');return;}
    const next=parsed?.format==='230MATCH_V3_FULL_BACKUP'?parsed.state:parsed;
    if(!next||typeof next!=='object'||!Array.isArray(next.teams)||!next.tournament){notice('230MATCH 대회 백업 형식이 아닙니다.','error');return;}
    if(!confirm(`현재 상태를 복구점에 저장한 뒤 “${next.tournament?.name||'백업 대회'}” 상태로 교체할까요?`))return;
    if(!requireTypedConfirmation('전체 백업 복원','복원'))return;
    autoRecovery('전체 백업 불러오기 전');
    state=structuredClone(next);
    ensureOperatorState();ensureContacts(state);
    commit(`대회 전체 백업 복원 · ${next.tournament?.name||'이름 없음'}`);
    notice('대회 전체 백업을 복원했습니다.','success');
  }
  function csvCell(value){const text=String(value??'');return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;}
  function downloadText(filename,text,type='text/plain;charset=utf-8'){const blob=new Blob(['\ufeff',text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function exportResultsCsv(){
    const rows=[['구분','라운드/조','경기 ID','팀1','팀2','승리팀','상태','코트','시작시각','완료시각']];
    const teamName=v=>typeof v==='string'?v:(v?.name||v?.teamName||v?.label||'');
    const mainMatches=Array.isArray(state.draw?.matches)?state.draw.matches:(Array.isArray(state.matches)?state.matches:[]);
    mainMatches.forEach(m=>rows.push(['본선',m.roundLabel||m.round||'',m.id||'',teamName(m.teamA||m.a||m.slotA),teamName(m.teamB||m.b||m.slotB),teamName(m.winner),m.status||'',m.courtName||m.court||'',m.startedAt?new Date(m.startedAt).toLocaleString('ko-KR'):'',m.completedAt?new Date(m.completedAt).toLocaleString('ko-KR'):'']));
    const prelimMatches=Array.isArray(state.prelim?.matches)?state.prelim.matches:[];
    prelimMatches.forEach(m=>rows.push(['예선',`${m.groupNo||m.groupId||''}조`,m.id||'',teamName(m.teamA||m.a),teamName(m.teamB||m.b),teamName(m.winner),m.status||'',m.courtName||m.court||'',m.startedAt?new Date(m.startedAt).toLocaleString('ko-KR'):'',m.completedAt?new Date(m.completedAt).toLocaleString('ko-KR'):'']));
    const csv=rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
    downloadText(`${safeFilePart(state.tournament?.name)}-경기결과-${Date.now()}.csv`,csv,'text/csv;charset=utf-8');
    notice(`경기 결과 ${Math.max(0,rows.length-1)}건을 CSV로 저장했습니다.`,'success');
  }
  if($('exportJsonBtn'))$('exportJsonBtn').onclick=exportFullBackup;
  if($('stateBackupInput'))$('stateBackupInput').onchange=async event=>{const input=event.currentTarget;await importFullBackup(input.files?.[0]);input.value='';};
  if($('exportResultsCsvBtn'))$('exportResultsCsvBtn').onclick=exportResultsCsv;
  if($('saveRecoveryBtn'))$('saveRecoveryBtn').onclick=async()=>{const item=saveRecovery(state,`${state.tournament.name} · ${state.tournament.division}`);const result=await item.ready;if(result?.saved){log(`로컬 복구점 저장 · ${item.label}`);}saveState(state);render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});renderOperatorControls();if(result?.saved)notice(`이 브라우저에 복구점을 저장했습니다. 최근 ${result.count||1}개를 보관합니다.`,'success');else notice('로컬 복구점 저장에 실패했습니다. 전체 백업 JSON도 함께 저장해 주세요.','warning');};
  if($('saveRecoveryBtnInline'))$('saveRecoveryBtnInline').onclick=()=>$('saveRecoveryBtn').click();
  if($('openRecoveryBtn'))$('openRecoveryBtn').onclick=showRecoveries;$('closeRecoveryBtn').onclick=()=>$('recoveryDialog').close();
  if($('clearLogsBtn'))$('clearLogsBtn').onclick=()=>{state.logs=[];commit();};
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
  if($('runSmsAcceptanceBtn'))$('runSmsAcceptanceBtn').onclick=runSmsAcceptance;
  if($('previewSmsRecipientBtn'))$('previewSmsRecipientBtn').onclick=previewSmsRecipient;
  if($('downloadSmsReportBtn'))$('downloadSmsReportBtn').onclick=downloadSmsAcceptance;
  if($('sendSmsTestBtn'))$('sendSmsTestBtn').onclick=sendSmsTestOne;
  if($('resetSmsShortTemplatesBtn'))$('resetSmsShortTemplatesBtn').onclick=()=>{
    setValue('templatePlaying','{team} {court} 경기. 입장');
    setValue('templateWait1','{team} {court} 대기1. 약{wait}분');
    setValue('templateShared','{team} 본선대기 {queueNo}번');
    pullSettings();commit('알리고 단문 기본값 적용');notice('짧은 문자 기본값을 적용했습니다.','success');
  };
  if($('messageStatusFilter'))$('messageStatusFilter').onchange=()=>render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});

  if($('rosterSearch'))$('rosterSearch').oninput=()=>render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});
  if($('rosterPhoneFilter'))$('rosterPhoneFilter').onchange=()=>render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});
  if($('contactEditPhone'))$('contactEditPhone').oninput=validateContactInput;
  if($('saveContactBtn'))$('saveContactBtn').onclick=saveContact;
  if($('refreshMessagePhonesBtn'))$('refreshMessagePhonesBtn').onclick=reconnectMessagePhones;
  if($('exportContactsBtn'))$('exportContactsBtn').onclick=()=>downloadJson(`230match-contacts-${Date.now()}.json`,exportContactData(state));
  if($('contactFileInput'))$('contactFileInput').onchange=e=>{const f=e.target.files[0];if(f)importContactsFile(f).catch(err=>notice(err.message,'error'));};
  ['autoMessageEnabled','messageSenderName','messageDeliveryMode','messageOnCourtAssign','messageOnQueueMove','smartMessageUpdate','messageRepeatPolicy','templatePlaying','templateWait1','templateShared','autoSmsApprovalEnabled','autoSmsCourtWaiting','autoSmsCourtChanged','autoSmsMatchStart','autoSmsMatchComplete'].forEach(id=>{const el=$(id);if(el)el.addEventListener('change',()=>{pullSettings();commit('문자 설정 변경');});});

  if($('loadLegacyTournamentListBtn'))$('loadLegacyTournamentListBtn').onclick=loadLegacyTournamentList;
  if($('previewLegacyTournamentBtn'))$('previewLegacyTournamentBtn').onclick=previewLegacyTournament;
  if($('importLegacyTournamentBtn'))$('importLegacyTournamentBtn').onclick=importLegacyTournament;
  if($('previewLegacyArchiveBtn'))$('previewLegacyArchiveBtn').onclick=previewLegacySummaryArchive;
  if($('archiveLegacyAndResetBtn'))$('archiveLegacyAndResetBtn').onclick=archiveLegacySummaryAndReset;
  if($('saveSyncSettingsBtn'))$('saveSyncSettingsBtn').onclick=saveAndConnectSync;
  if($('disconnectSyncBtn'))$('disconnectSyncBtn').onclick=()=>{if(!requireAdmin('동기화 연결 해제'))return;disconnectCloudSync();const cfg=collectSyncPanel();cfg.enabled=false;saveSyncSettings(cfg);setChecked('cloudSyncEnabled',false);updateSyncPanel({label:'로컬 저장',detail:'클라우드 연결을 해제했습니다.'});};
  if($('pushSyncNowBtn'))$('pushSyncNowBtn').onclick=async()=>{if(!requireAdmin('현재 상태 업로드'))return;try{await pushStateNow(state);notice('현재 상태를 Firebase에 업로드했습니다.','success');}catch(error){notice(error.message,'error');}};
  if($('pullSyncNowBtn'))$('pullSyncNowBtn').onclick=async()=>{if(!requireAdmin('클라우드 상태 불러오기'))return;if(!confirm('클라우드 상태로 현재 브라우저 상태를 교체할까요? 자동 복구점을 먼저 저장합니다.'))return;autoRecovery('클라우드 상태 불러오기 전');try{const next=await pullStateNow();if(next)applySynchronizedState(next,'클라우드');else notice('클라우드에 저장된 상태가 없습니다.','error');}catch(error){notice(error.message,'error');}};
  if($('testSyncConnectionBtn'))$('testSyncConnectionBtn').onclick=async()=>{if(!requireOperator('Firebase 연결 점검'))return;try{const result=await testCloudConnection();updateSyncPanel({label:'연결 정상',level:'success',detail:`${result.collection}/${result.roomId} · ${result.mode==='read-write'?'읽기/쓰기':'읽기 전용'} · ${result.exists?'클라우드 상태 있음':'빈 대회방'}`});notice('Firebase V3 전용 대회방 연결 점검을 통과했습니다.','success');}catch(error){updateSyncPanel({label:'연결 실패',level:'error',detail:error.message});notice(error.message,'error');}};
  if($('roleViewerBtn'))$('roleViewerBtn').onclick=()=>setRole('viewer');
  if($('roleAdminBtn'))$('roleAdminBtn').onclick=()=>setRole('admin');
  const roleBadge=$('currentRoleBadge');if(roleBadge){roleBadge.title='관리자는 눌러서 설정으로 이동';roleBadge.onclick=()=>{if(isAdmin())window.openAdminSettingsHub?.();};}
  if($('roleOperatorBtn'))$('roleOperatorBtn').onclick=()=>setRole('operator');
  if($('changeAdminPinBtn'))$('changeAdminPinBtn').onclick=changeAdminPin;
  document.querySelectorAll('.tab').forEach(tab=>tab.onclick=()=>navigatePortalView(tab.dataset.view,{pushHistory:true}));
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



async function notificationRuntime(){return getAuthRuntime()}
function renderNotificationStatus(message=''){
  const box=document.getElementById('pushDeviceStatus');if(!box)return;
  const s=notificationSupport();const user=currentAuthUser;
  box.innerHTML=`<strong>${user?'로그인됨':'로그인 필요'}</strong><span>브라우저 권한: ${s.permission} · 서비스워커: ${s.serviceWorker?'지원':'미지원'}</span>${message?`<small>${portalEscape(message)}</small>`:''}`;
  const key=document.getElementById('pushVapidKey');if(key&&!key.value)key.value=getStoredVapidKey();
}
async function refreshNotificationManager(){
  renderNotificationStatus('알림 현황을 확인하는 중입니다.');
  if(!currentAuthUser){renderNotificationStatus('간편로그인 후 경기 알림을 켤 수 있습니다.');return;}
  try{
    const rt=await notificationRuntime();
    const [jobs,tokens]=await Promise.all([listPushJobs(rt,30),currentRole==='viewer'?Promise.resolve([]):listPushTokens(rt,200)]);
    const my=tokens.filter(x=>x.uid===currentAuthUser.uid&&x.enabled!==false);
    document.getElementById('pushTokenSummary').textContent=currentRole==='viewer'?`내 알림 설정을 확인하세요.`:`전체 활성 기기 ${tokens.filter(x=>x.enabled!==false).length}대 · 내 기기 ${my.length}대`;
    const list=document.getElementById('pushHistoryList');
    list.innerHTML=jobs.length?jobs.map(x=>`<article class="push-history-card"><header><strong>${portalEscape(x.title||'230MATCH 알림')}</strong><span class="badge badge-muted">${portalEscape(x.status||'pending')}</span></header><p>${portalEscape(x.body||'')}</p><small>${portalEscape(x.createdAtText||'')} · 성공 ${Number(x.sentCount||0)} · 실패 ${Number(x.failedCount||0)}</small></article>`).join(''):'<div class="portal-empty">발송 기록이 없습니다.</div>';
    renderNotificationStatus('Firebase pushTokens·pushNotifications와 연결되었습니다.');
  }catch(e){renderNotificationStatus('현황 조회 실패: '+(e.message||e));}
}
async function handleEnablePush(){try{const rt=await notificationRuntime();const key=document.getElementById('pushVapidKey')?.value?.trim()||'';saveStoredVapidKey(key);await enableMyPush(rt,{vapidKey:key,onMessage:payload=>notice((payload?.notification?.title||'230MATCH 알림')+' · '+(payload?.notification?.body||''),'success')});notice('이 기기의 경기 알림을 켰습니다.','success');refreshNotificationManager();}catch(e){notice('알림 설정 실패: '+(e.message||e),'error')}}
async function handleDisablePush(){try{const rt=await notificationRuntime();await disableMyPush(rt);notice('이 기기의 경기 알림을 껐습니다.','success');refreshNotificationManager();}catch(e){notice('알림 해제 실패: '+(e.message||e),'error')}}
async function handleManualPush(){if(!requireAdmin('수동 푸시 발송'))return;try{const title=getValue('manualPushTitle','').trim(),body=getValue('manualPushBody','').trim();if(!title||!body)throw new Error('제목과 내용을 입력해 주세요.');const phones=getValue('manualPushPhones','').split(/[\s,;]+/).filter(Boolean);const clubs=getValue('manualPushClubs','').split(/[\n,;]+/).map(v=>v.trim()).filter(Boolean);const rt=await notificationRuntime();await queuePush(rt,{title,body,targetPhones:phones,targetClubs:clubs,tid:state.tournament?.name||'',div:state.tournament?.division||''});notice('푸시 발송 대기열에 등록했습니다.','success');refreshNotificationManager();}catch(e){notice('푸시 등록 실패: '+(e.message||e),'error')}}
function bindNotificationCenter(){document.getElementById('enablePushBtn')?.addEventListener('click',handleEnablePush);document.getElementById('disablePushBtn')?.addEventListener('click',handleDisablePush);document.getElementById('refreshPushManagerBtn')?.addEventListener('click',refreshNotificationManager);document.getElementById('sendManualPushBtn')?.addEventListener('click',handleManualPush);document.getElementById('savePushVapidBtn')?.addEventListener('click',()=>{saveStoredVapidKey(getValue('pushVapidKey','').trim());notice('VAPID Key를 이 브라우저에 저장했습니다.','success')});}

function portalEscape(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function portalTeam(value){return value?teamText(value):'-';}
function portalMainMatches(){try{return allMatches(state.draw||{rounds:{}})||[];}catch(_error){return[];}}
function portalCourtRows(){return [...(state.prelim?.courts||[]),...(state.courts||[])];}
function publicPrelimStatusLabel(status){
  return ({playing:'시합중',court_wait1:'대기1',queued:'추가대기',waiting_dependency:'상대 확정 대기',waiting_previous:'이전 경기 대기',completed:'완료'})[status]||'대기';
}
function renderPublicPrelimGroups(){
  const root=document.getElementById('publicPrelimGroupGrid');
  const summary=document.getElementById('publicPrelimSummary');
  if(!root)return;
  const prelim=state.prelim||{};
  const groups=Array.isArray(prelim.groups)?prelim.groups:[];
  const matches=Array.isArray(prelim.matches)?prelim.matches:[];
  const completed=matches.filter(match=>match.status==='completed').length;
  if(summary)summary.textContent=`${groups.length}조 · ${completed}/${matches.length}경기 완료`;
  if(!groups.length){
    root.className='prelim-group-grid empty-state';
    root.innerHTML='<p>예선 조편성을 생성하면 조별 현황이 표시됩니다.</p>';
    return;
  }
  root.className='prelim-group-grid public-prelim-grid';
  root.innerHTML=groups.map(group=>{
    const groupMatches=matches.filter(match=>match.groupId===group.id || Number(match.groupNo)===Number(group.groupNo));
    const standings=Array.isArray(group.standings)?group.standings:[];
    const groupDone=groupMatches.filter(match=>match.status==='completed').length;
    const groupComplete=groupMatches.length>0&&groupDone===groupMatches.length;
    return `<article class="prelim-group-card public-prelim-card">
      <header><strong>${portalEscape(group.groupNo)}조${group.venueName?`<span class="prelim-group-chip">${portalEscape(group.venueName)}</span>`:''}</strong><span>${portalEscape(group.court||'코트 미배정')} · ${groupDone}/${groupMatches.length}</span></header>
      <div class="public-group-progress"><span style="width:${groupMatches.length?Math.round(groupDone/groupMatches.length*100):0}%"></span></div>
      <table class="prelim-team-table public-standing-table"><thead><tr><th>순위</th><th>팀</th><th>승</th><th>패</th><th>득실</th></tr></thead><tbody>
      ${standings.map((standing,index)=>{const rank=Number(standing.rank||index+1);const qualified=Boolean(standing.qualified)||((prelim.settings?.qualifiersPerGroup||state.settings?.qualifiersPerGroup||2)>=rank&&groupComplete);return `<tr class="${qualified?'qualifier':''}"><td>${rank}</td><td>${portalEscape(portalTeam(standing.team))}${qualified?'<span class="public-qualified-chip">본선권</span>':''}</td><td>${Number(standing.wins||0)}</td><td>${Number(standing.losses||0)}</td><td>${Number(standing.diff||0)>0?'+':''}${Number(standing.diff||0)}</td></tr>`;}).join('')}
      </tbody></table>
      <div class="prelim-match-list public-match-list">
      ${groupMatches.map(match=>{const status=publicPrelimStatusLabel(match.status);const score=match.status==='completed'?`${Number(match.scoreA||0)} : ${Number(match.scoreB||0)}`:'';const winner=match.status==='completed'&&match.winner?`승리 ${portalEscape(portalTeam(match.winner))}`:'';return `<div class="prelim-match public-prelim-match ${portalEscape(match.status||'waiting')}"><div class="prelim-match-top"><span>${Number(match.matchNo||0)}경기</span><span>${portalEscape(match.court||group.court||'-')} · <b>${status}</b></span></div><strong>${portalEscape(portalTeam(match.teamA))} <span>vs</span> ${portalEscape(portalTeam(match.teamB))}</strong><div class="public-match-result">${score?`<b>${score}</b>${winner?`<span>${winner}</span>`:''}`:'<span>결과 대기</span>'}</div></div>`;}).join('')||'<div class="portal-empty">경기표가 아직 생성되지 않았습니다.</div>'}
      </div>
    </article>`;
  }).join('');
}

function myMatchNormalize(value){return String(value??'').toLocaleLowerCase('ko-KR').replace(/\s+/g,'').replace(/[()\[\]{}.,·ㆍ_-]/g,'');}
function myMatchTeamKey(team){return myMatchNormalize(portalTeam(team));}
function myMatchUniqueTeams(){
  const map=new Map();
  const add=team=>{if(!team||team.placeholder)return;const label=portalTeam(team);const key=myMatchNormalize(label);if(key&&!map.has(key))map.set(key,team);};
  (state.teams||[]).forEach(add);(state.prelim?.activeTeams||[]).forEach(add);(state.prelim?.reserveTeams||[]).forEach(add);
  (state.prelim?.groups||[]).forEach(group=>(group.teams||[]).forEach(add));
  (state.prelim?.matches||[]).forEach(match=>{add(match.teamA);add(match.teamB);add(match.winner);});
  portalMainMatches().forEach(match=>{add(match.teamA);add(match.teamB);add(match.winner);});
  return [...map.values()].sort((a,b)=>portalTeam(a).localeCompare(portalTeam(b),'ko-KR'));
}
function myMatchContainsTeam(match,team){const key=myMatchTeamKey(team);return key&&(myMatchTeamKey(match?.teamA)===key||myMatchTeamKey(match?.teamB)===key||myMatchTeamKey(match?.winner)===key);}
function myMatchOpponent(match,team){const key=myMatchTeamKey(team);if(myMatchTeamKey(match?.teamA)===key)return match.teamB;if(myMatchTeamKey(match?.teamB)===key)return match.teamA;return null;}
function myMatchPlacement(match){
  if(!match)return{label:'경기 정보 없음',kind:'unknown'};
  const id=match.id;
  const courts=portalCourtRows();
  for(const court of courts){
    if(court.playing===id)return{label:`${court.name||court.id} · 시합중`,kind:'playing'};
    if(court.wait1===id)return{label:`${court.name||court.id} · 대기1`,kind:'wait1'};
    const queue=[...(court.queue||[]),...(court.manualQueue||[])];const idx=queue.indexOf(id);if(idx>=0)return{label:`${court.name||court.id} · 추가대기 ${idx+1}`,kind:'waiting'};
  }
  const venueEntries=Object.entries(state.venueQueues||{});for(const [venueId,queue] of venueEntries){const idx=(queue||[]).indexOf(id);if(idx>=0){const venue=(state.settings?.venues||[]).find(v=>v.id===venueId);return{label:`${venue?.name||venueId} 공용대기 ${idx+1}`,kind:'shared'};}}
  const shared=(state.sharedQueue||[]).indexOf(id);if(shared>=0)return{label:`본선 공용대기 ${shared+1}`,kind:'shared'};
  if(match.status==='completed')return{label:'경기 완료',kind:'completed'};
  if(match.status==='playing')return{label:`${match.court||'코트'} · 시합중`,kind:'playing'};
  return{label:match.court?`${match.court} · 경기 예정`:'경기 예정',kind:'waiting'};
}
function myMatchRoundLabel(match,isPrelim){
  if(isPrelim)return `${Number(match.groupNo||0)}조 ${Number(match.matchNo||0)}경기`;
  const id=String(match.id||'');const found=id.match(/^r(\d+)_/);return found?`${found[1]}강`:'본선 경기';
}
function myMatchStatusText(match){if(match.status==='completed')return'완료';if(match.status==='playing')return'시합중';return'대기';}
function renderMyMatchTeam(team){
  const root=document.getElementById('myMatchResult');if(!root)return;
  const teamLabel=portalTeam(team);const teamKey=myMatchTeamKey(team);
  const prelim=state.prelim||{};const group=(prelim.groups||[]).find(g=>(g.teams||[]).some(t=>myMatchTeamKey(t)===teamKey));
  const standing=(group?.standings||[]).find(s=>myMatchTeamKey(s.team)===teamKey);
  const prelimMatches=(prelim.matches||[]).filter(m=>myMatchContainsTeam(m,team)).sort((a,b)=>Number(a.matchNo||0)-Number(b.matchNo||0));
  const mainMatches=portalMainMatches().filter(m=>myMatchContainsTeam(m,team)).sort((a,b)=>{const ar=Number(String(a.id||'').match(/^r(\d+)_/)?.[1]||0),br=Number(String(b.id||'').match(/^r(\d+)_/)?.[1]||0);return br-ar;});
  const active=[...prelimMatches,...mainMatches].find(m=>m.status==='playing')||[...prelimMatches,...mainMatches].find(m=>m.status!=='completed');
  const activePlacement=myMatchPlacement(active);
  const groupComplete=group&&prelimMatches.length&&prelimMatches.every(m=>m.status==='completed');
  const qualifiers=Number(prelim.settings?.qualifiersPerGroup||state.settings?.qualifiersPerGroup||2);
  const rank=Number(standing?.rank||0);const qualified=Boolean(rank&&rank<=qualifiers&&groupComplete);
  const matchCards=(items,isPrelim)=>items.map(match=>{const opponent=myMatchOpponent(match,team);const placement=myMatchPlacement(match);const score=match.status==='completed'?`${Number(match.scoreA||0)} : ${Number(match.scoreB||0)}`:'';const won=myMatchTeamKey(match.winner)===teamKey;return `<article class="my-match-game ${portalEscape(placement.kind)}"><div class="my-match-game-head"><b>${portalEscape(myMatchRoundLabel(match,isPrelim))}</b><span>${portalEscape(myMatchStatusText(match))}</span></div><div class="my-match-opponent">상대 · <strong>${portalEscape(portalTeam(opponent))}</strong></div><div class="my-match-placement">${portalEscape(placement.label)}</div>${score?`<div class="my-match-score ${won?'win':'loss'}">${won?'승':'패'} · ${score}</div>`:''}</article>`;}).join('');
  root.className='my-match-result';
  root.innerHTML=`<section class="my-match-summary"><div><p class="eyebrow">MY MATCH</p><h3>${portalEscape(teamLabel)}</h3><div class="portal-muted">${group?`${Number(group.groupNo||0)}조 · ${portalEscape(group.venueName||'')} ${portalEscape(group.court||'')}`:'예선 조 미배정'}</div></div><div class="my-match-current ${portalEscape(activePlacement.kind)}"><span>현재 안내</span><strong>${portalEscape(active?activePlacement.label:(qualified?'본선 진출 확정':groupComplete?'예선 종료':'경기 대기'))}</strong></div></section>
  <div class="my-match-metrics"><div><span>예선 순위</span><b>${rank?`${rank}위`:'-'}</b></div><div><span>승·패</span><b>${Number(standing?.wins||0)}승 ${Number(standing?.losses||0)}패</b></div><div><span>득실</span><b>${Number(standing?.diff||0)>0?'+':''}${Number(standing?.diff||0)}</b></div><div><span>본선 상태</span><b>${qualified?'진출 확정':groupComplete?'예선 탈락/대기':'결과 대기'}</b></div></div>
  <section class="my-match-section"><h3>예선 경기</h3><div class="my-match-games">${matchCards(prelimMatches,true)||'<div class="portal-empty">예선 경기 정보가 없습니다.</div>'}</div></section>
  <section class="my-match-section"><h3>본선 경기</h3><div class="my-match-games">${matchCards(mainMatches,false)||'<div class="portal-empty">아직 확정된 본선 경기가 없습니다.</div>'}</div></section>`;
}
function searchMyMatch(){
  const input=document.getElementById('myMatchSearchInput');const choices=document.getElementById('myMatchTeamChoices');const guide=document.getElementById('myMatchSearchGuide');if(!input||!choices)return;
  const raw=String(input.value||'').trim(),query=myMatchNormalize(raw);
  if(query.length<2){choices.innerHTML='';if(guide)guide.textContent='두 글자 이상 입력하면 일치하는 팀을 보여줍니다.';return;}
  const found=myMatchUniqueTeams().filter(team=>myMatchNormalize(portalTeam(team)).includes(query)).slice(0,30);
  if(guide)guide.textContent=found.length?`${found.length}개 팀을 찾았습니다. 팀을 선택하세요.`:'일치하는 선수 또는 팀이 없습니다.';
  choices.innerHTML=found.map((team,index)=>`<button type="button" class="my-match-choice" data-my-match-index="${index}">${portalEscape(portalTeam(team))}</button>`).join('');
  choices._teams=found;
  if(found.length===1)renderMyMatchTeam(found[0]);
}


// Stage 31.41 · participant roster manager
let participantEditingId=null;
function participantNormalizedTeam(team,index=0){
  return {id:String(team?.id||`team-${Date.now()}-${index}`),name:String(team?.name||'').trim(),affiliation:String(team?.affiliation||'').trim(),rank:Number(team?.rank||index+1)||index+1,groupNo:Number(team?.groupNo||0),groupRank:Number(team?.groupRank||0),placeholder:false,placeholderKey:'',locked:false};
}
function participantHasStarted(){return Boolean((state.prelim?.matches||[]).some(m=>['playing','completed'].includes(m.status))||portalMainMatches().some(m=>['playing','completed'].includes(m.status)));}
function participantReplaceSnapshot(targetId,next){
  const patch=t=>{if(!t||String(t.id)!==String(targetId))return t;return {...t,id:next.id,name:next.name,affiliation:next.affiliation};};
  state.teams=(state.teams||[]).map(patch);
  if(state.prelim){
    state.prelim.activeTeams=(state.prelim.activeTeams||[]).map(patch);state.prelim.reserveTeams=(state.prelim.reserveTeams||[]).map(patch);
    (state.prelim.groups||[]).forEach(g=>{g.teams=(g.teams||[]).map(patch);g.standings=(g.standings||[]).map(s=>({...s,team:patch(s.team)}));});
    (state.prelim.matches||[]).forEach(m=>{m.teamA=patch(m.teamA);m.teamB=patch(m.teamB);m.winner=patch(m.winner);});
    (state.prelim.qualifiers||[]).forEach((t,i)=>state.prelim.qualifiers[i]=patch(t));
  }
  portalMainMatches().forEach(m=>{m.teamA=patch(m.teamA);m.teamB=patch(m.teamB);m.winner=patch(m.winner);});
  if(state.operation?.champion)state.operation.champion=patch(state.operation.champion);
}
function participantReorderByStatus(team,status){
  const list=(state.teams||[]).filter(t=>String(t.id)!==String(team.id));
  const activeCount=Math.max(0,Math.min(Number(state.prelim?.settings?.activeTeamCount||state.settings?.prelimActiveTeamCount||list.length+1),list.length+1));
  if(status==='reserve')list.splice(activeCount,0,team);else list.splice(Math.max(0,activeCount-1),0,team);
  state.teams=list.map((t,i)=>({...t,rank:i+1}));
}
function participantStatus(team){
  const activeIds=new Set((state.prelim?.activeTeams||[]).map(t=>String(t.id)));
  const reserveIds=new Set((state.prelim?.reserveTeams||[]).map(t=>String(t.id)));
  if(activeIds.has(String(team.id)))return'active';if(reserveIds.has(String(team.id)))return'reserve';
  const idx=(state.teams||[]).findIndex(t=>String(t.id)===String(team.id));const limit=Number(state.prelim?.settings?.activeTeamCount||state.settings?.prelimActiveTeamCount||state.teams.length);
  return idx>=limit?'reserve':'active';
}
function clearParticipantForm(){participantEditingId=null;['participantTeamName','participantAffiliation','participantPhone'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});const status=document.getElementById('participantStatus');if(status)status.value='active';const save=document.getElementById('participantSaveBtn');if(save)save.textContent='참가팀 추가';const cancel=document.getElementById('participantCancelEditBtn');if(cancel)cancel.hidden=true;}
function renderParticipantManager(){
  const root=document.getElementById('participantRosterList');if(!root)return;
  const query=myMatchNormalize(document.getElementById('participantSearchInput')?.value||'');
  const teams=(state.teams||[]).filter(t=>!query||myMatchNormalize(`${portalTeam(t)} ${t.affiliation||''}`).includes(query));
  const active=(state.prelim?.activeTeams||[]).length||Math.min(Number(state.prelim?.settings?.activeTeamCount||0),state.teams.length);
  const reserve=Math.max(0,state.teams.length-active);
  const summary=document.getElementById('participantRosterSummary');if(summary)summary.textContent=`전체 ${state.teams.length}팀 · 참가 ${active}팀 · 후보 ${reserve}팀`;
  root.innerHTML=teams.map((team,index)=>{const status=participantStatus(team);const contact=getTeamContact(state,team)||{};return `<article class="participant-row"><div class="participant-order">${(state.teams||[]).findIndex(t=>String(t.id)===String(team.id))+1}</div><div class="participant-info"><strong>${portalEscape(portalTeam(team))}</strong><span>${portalEscape(team.affiliation||'소속 없음')}${contact.phone?` · ${portalEscape(contact.phone)}`:''}</span></div><span class="participant-status ${status}">${status==='active'?'참가':'후보'}</span><div class="participant-actions"><button type="button" class="btn btn-light" data-participant-edit="${portalEscape(team.id)}">수정</button><button type="button" class="btn btn-danger-outline" data-participant-delete="${portalEscape(team.id)}">삭제</button></div></article>`;}).join('')||'<div class="portal-empty">조건에 맞는 참가팀이 없습니다.</div>';
}
function saveParticipant(){
  if(!requireAdmin('참가팀 관리'))return;
  const name=String(document.getElementById('participantTeamName')?.value||'').trim();const affiliation=String(document.getElementById('participantAffiliation')?.value||'').trim();const phone=String(document.getElementById('participantPhone')?.value||'').replace(/[^0-9]/g,'');const status=document.getElementById('participantStatus')?.value||'active';
  if(!name){notice('팀명 또는 선수 이름을 입력하세요.','error');return;}
  if(phone&&!validatePhone(phone)){notice('휴대전화 번호 형식을 확인하세요.','error');return;}
  if(participantEditingId){
    const current=(state.teams||[]).find(t=>String(t.id)===String(participantEditingId));if(!current)return;
    const next=participantNormalizedTeam({...current,name,affiliation});participantReplaceSnapshot(current.id,next);if(phone)setTeamContact(state,next,{phone});
    if(status!==participantStatus(current)){if((state.prelim?.groups||[]).length){notice('조편성 후 참가·후보 상태 변경은 후보 교체 기능을 사용하세요.','error');return;}participantReorderByStatus(next,status);}
    commit(`참가팀 수정 · ${name}`);notice('참가팀 정보를 수정했습니다.','success');
  }else{
    if(state.teams.length>=128){notice('최대 128팀까지 등록할 수 있습니다.','error');return;}
    const team=participantNormalizedTeam({id:crypto.randomUUID(),name,affiliation},state.teams.length);participantReorderByStatus(team,status);if(phone)setTeamContact(state,team,{phone});
    if((state.prelim?.groups||[]).length)notice('새 팀을 등록했습니다. 기존 조편성에는 자동 반영되지 않으므로 재편성 또는 후보 교체가 필요합니다.','info');else notice('참가팀을 등록했습니다.','success');
    commit(`참가팀 등록 · ${name}`);
  }
  clearParticipantForm();renderParticipantManager();
}
function editParticipant(id){if(!requireAdmin('참가팀 관리'))return;const team=(state.teams||[]).find(t=>String(t.id)===String(id));if(!team)return;participantEditingId=team.id;document.getElementById('participantTeamName').value=team.name||'';document.getElementById('participantAffiliation').value=team.affiliation||'';document.getElementById('participantPhone').value=getTeamContact(state,team)?.phone||'';document.getElementById('participantStatus').value=participantStatus(team);document.getElementById('participantSaveBtn').textContent='수정 저장';document.getElementById('participantCancelEditBtn').hidden=false;document.getElementById('participantTeamName').focus();}
function deleteParticipant(id){
  if(!requireAdmin('참가팀 삭제'))return;const team=(state.teams||[]).find(t=>String(t.id)===String(id));if(!team)return;
  const inStarted=(state.prelim?.matches||[]).some(m=>['playing','completed'].includes(m.status)&&(String(m.teamA?.id)===String(id)||String(m.teamB?.id)===String(id)));if(inStarted){notice('이미 진행된 예선 경기에 포함된 팀은 삭제할 수 없습니다. 팀명 수정 또는 후보 교체를 사용하세요.','error');return;}
  if(!confirm(`${portalTeam(team)} 팀을 명단에서 삭제할까요?`))return;
  state.teams=(state.teams||[]).filter(t=>String(t.id)!==String(id));if(state.contacts?.teams)delete state.contacts.teams[id];
  if(!(state.prelim?.groups||[]).length){state.prelim.activeTeams=(state.prelim.activeTeams||[]).filter(t=>String(t.id)!==String(id));state.prelim.reserveTeams=(state.prelim.reserveTeams||[]).filter(t=>String(t.id)!==String(id));}
  commit(`참가팀 삭제 · ${portalTeam(team)}`);clearParticipantForm();notice('참가팀을 삭제했습니다.','success');
}
function bindParticipantManager(){
  document.getElementById('participantSaveBtn')?.addEventListener('click',saveParticipant);document.getElementById('participantCancelEditBtn')?.addEventListener('click',clearParticipantForm);document.getElementById('participantSearchInput')?.addEventListener('input',renderParticipantManager);
  document.addEventListener('click',event=>{const edit=event.target.closest?.('[data-participant-edit]');if(edit){editParticipant(edit.dataset.participantEdit);return;}const del=event.target.closest?.('[data-participant-delete]');if(del)deleteParticipant(del.dataset.participantDelete);});
}


let entryEditingId=null;
function applicationStatusLabel(status){return status==='approved'?'참가 승인':status==='reserve'?'후보 승인':status==='rejected'?'반려':status==='delete_requested'?'삭제 요청':status==='cancelled'?'삭제 완료':'승인 대기';}
function applicationStatusClass(status){return ['approved','reserve'].includes(status)?'safe':['rejected','cancelled','delete_requested'].includes(status)?'danger':'pending';}
function applicationCode(){return `A${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2,5).toUpperCase()}`;}
function reserveApplicationOrder(item){const rows=(state.portal?.applications||[]).filter(a=>a.status==='reserve').sort((a,b)=>String(a.approvedAt||a.updatedAt||a.createdAt).localeCompare(String(b.approvedAt||b.updatedAt||b.createdAt)));const index=rows.findIndex(a=>a.id===item.id);return index<0?0:index+1;}
function entryTournamentRows(){
  const current=currentTournamentSnapshot();
  const history=(state.portal?.tournamentArchives||[]).map(x=>({...x,current:false}));
  const seen=new Set();
  return [current,...history].filter(x=>{const key=String(x.id||'')+'|'+String(x.name||'');if(seen.has(key))return false;seen.add(key);return true;});
}
function renderEntryTournamentSelect(){
  const select=document.getElementById('entryApplicationTournament');if(!select)return;
  const previous=select.value;
  const rows=entryTournamentRows();
  select.innerHTML='<option value="">대회를 선택하세요</option>'+rows.map(x=>{const selectable=!!x.current&&x.status!=='completed';const label=`${x.name||'대회 준비 중'}${x.division?` (${x.division})`:''} · ${tournamentStatusLabel(x.status)}`;return `<option value="${portalEscape(x.id)}" ${selectable?'':'disabled'}>${portalEscape(label)}${selectable?'':' · 신청 불가'}</option>`;}).join('');
  if(previous&&[...select.options].some(o=>o.value===previous&&!o.disabled))select.value=previous;
  else if(rows[0]?.current&&rows[0].status!=='completed')select.value='current';
}
function entryPairFormValue(id){return String(document.getElementById(id)?.value||'').trim();}
function entryPairPhone(id){return String(document.getElementById(id)?.value||'').replace(/[^0-9]/g,'');}
function entryApplicationPlayersFromForm(){
  const players=[
    {name:entryPairFormValue('entryPlayer1Name'),club:entryPairFormValue('entryPlayer1Club'),phone:entryPairPhone('entryPlayer1Phone')},
    {name:entryPairFormValue('entryPlayer2Name'),club:entryPairFormValue('entryPlayer2Club'),phone:entryPairPhone('entryPlayer2Phone')}
  ];
  const representativeIndex=document.querySelector('input[name="entryRepresentative"]:checked')?.value==='2'?1:0;
  return {players,representativeIndex,representative:players[representativeIndex]};
}
function entryApplicationPlayers(item){
  if(Array.isArray(item?.players)&&item.players.length>=2)return item.players.slice(0,2).map(p=>({name:String(p?.name||''),club:String(p?.club||p?.affiliation||''),phone:String(p?.phone||'').replace(/[^0-9]/g,'')}));
  const names=String(item?.teamName||'').split(/\s*\/\s*/).filter(Boolean);
  const clubs=String(item?.affiliation||'').split(/\s*\/\s*/).filter(Boolean);
  return [0,1].map(i=>({name:names[i]||'',club:clubs[i]||clubs[0]||'',phone:i===0?String(item?.phone||'').replace(/[^0-9]/g,''):''}));
}
function clearEntryApplicationForm(){
  entryEditingId=null;
  ['entryPlayer1Name','entryPlayer1Club','entryPlayer1Phone','entryPlayer2Name','entryPlayer2Club','entryPlayer2Phone','entryApplicationMemo'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const rep1=document.getElementById('entryRepresentative1');if(rep1)rep1.checked=true;
  renderEntryTournamentSelect();
  const tournament=document.getElementById('entryApplicationTournament');if(tournament&&[...tournament.options].some(o=>o.value==='current'&&!o.disabled))tournament.value='current';
  const submit=document.getElementById('entryApplicationSubmitBtn');if(submit)submit.textContent='참가 신청 접수';
  const cancel=document.getElementById('entryApplicationEditCancelBtn');if(cancel)cancel.hidden=true;
}
function submitPublicApplication(){
  ensurePortalState();
  const tournamentId=String(document.getElementById('entryApplicationTournament')?.value||'').trim();
  const selectedTournament=entryTournamentRows().find(x=>String(x.id)===tournamentId);
  const {players,representativeIndex,representative}=entryApplicationPlayersFromForm();
  const memo=entryPairFormValue('entryApplicationMemo');
  if(!selectedTournament||!selectedTournament.current||selectedTournament.status==='completed'){notice('현재 접수 가능한 대회를 선택하세요.','error');return;}
  for(let i=0;i<players.length;i++){
    const p=players[i];
    if(!p.name){notice(`선수 ${i+1} 이름을 입력하세요.`,'error');document.getElementById(`entryPlayer${i+1}Name`)?.focus();return;}
    if(!p.club){notice(`선수 ${i+1} 소속 클럽을 입력하세요.`,'error');document.getElementById(`entryPlayer${i+1}Club`)?.focus();return;}
    if(!validatePhone(p.phone)){notice(`선수 ${i+1} 연락처를 01012345678 형식으로 입력하세요.`,'error');document.getElementById(`entryPlayer${i+1}Phone`)?.focus();return;}
  }
  const name=players.map(p=>p.name).join(' / ');
  const affiliation=players.map(p=>p.club).join(' / ');
  const phone=representative.phone;
  const common={tournamentId:selectedTournament.id,tournamentName:selectedTournament.name,tournamentDivision:selectedTournament.division||'',teamName:name,affiliation,phone,memo,players,representativeIndex,representativeName:representative.name,ownerUid:currentAuthUser?.uid||'',smsTargetMode:'representative',updatedAt:new Date().toISOString()};
  if(entryEditingId){
    const item=state.portal.applications.find(a=>a.id===entryEditingId);if(!item||item.status!=='pending'){clearEntryApplicationForm();notice('승인 대기 신청만 수정할 수 있습니다.','error');return;}
    const duplicate=state.portal.applications.find(a=>a.id!==item.id&&a.status==='pending'&&entryApplicationPlayers(a).some(p=>players.some(n=>n.phone===p.phone)));
    if(duplicate){notice(`같은 연락처가 포함된 승인 대기 신청이 이미 있습니다. 신청번호 ${duplicate.code}`,'error');return;}
    Object.assign(item,common);commit(`참가 신청 수정 · ${name}`);clearEntryApplicationForm();lookupPublicApplication();notice('참가 신청을 수정했습니다.','success');return;
  }
  const duplicate=state.portal.applications.find(a=>a.status==='pending'&&entryApplicationPlayers(a).some(p=>players.some(n=>n.phone===p.phone)));
  if(duplicate){notice(`두 선수 중 같은 연락처로 승인 대기 중인 신청이 있습니다. 신청번호 ${duplicate.code}`,'info');renderApplicationPortal();return;}
  const item={id:crypto.randomUUID(),code:applicationCode(),...common,status:'pending',paid:false,createdAt:new Date().toISOString()};
  state.portal.applications.unshift(item);commit(`참가 신청 접수 · ${name}`);clearEntryApplicationForm();
  const receipt=document.getElementById('entryApplicationReceipt');if(receipt){receipt.hidden=false;receipt.innerHTML=`<strong>신청이 접수되었습니다.</strong><span>신청번호 ${portalEscape(item.code)} · 대표 연락처(${portalEscape(representative.name)})로 승인 상태를 조회할 수 있습니다.</span>`;}
  notice('참가 신청을 접수했습니다.','success');
}
function lookupPublicApplication(){
  const phone=String(document.getElementById('entryLookupPhone')?.value||'').replace(/[^0-9]/g,'');
  const root=document.getElementById('entryLookupResult');if(!root)return;
  if(phone.length<10){root.innerHTML='<div class="portal-empty">신청할 때 입력한 연락처를 입력하세요.</div>';return;}
  const rows=(state.portal?.applications||[]).filter(a=>a.phone===phone||entryApplicationPlayers(a).some(p=>p.phone===phone)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  root.innerHTML=rows.map(a=>{const reserveNo=a.status==='reserve'?reserveApplicationOrder(a):0;return `<article class="entry-status-card"><div><strong>${portalEscape(a.teamName)}</strong><span>${portalEscape(a.tournamentName||state.tournament?.name||'현재 대회')}${a.tournamentDivision?` (${portalEscape(a.tournamentDivision)})`:''} · ${portalEscape(a.affiliation||'소속 없음')} · ${new Date(a.createdAt).toLocaleString('ko-KR')}</span></div><span class="entry-status ${applicationStatusClass(a.status)}">${applicationStatusLabel(a.status)}</span><div class="entry-code">${portalEscape(a.code)}</div><div class="entry-extra"><span class="entry-payment ${entryPaymentClass(a)}">${entryPaymentLabel(a)}${a.paidAt?` · ${portalEscape(entryDateTime(a.paidAt))}`:''}</span>${reserveNo?`<span class="entry-wait-number">후보 ${reserveNo}번</span>`:''}</div>${a.adminMemo?`<p>${portalEscape(a.adminMemo)}</p>`:''}${a.status==='pending'?`<div class="entry-public-actions"><button type="button" class="btn btn-light btn-small" data-entry-edit="${a.id}">신청 수정</button><button type="button" class="btn btn-danger-outline btn-small" data-entry-cancel="${a.id}">삭제 요청</button></div>`:''}</article>`;}).join('')||'<div class="portal-empty">해당 연락처의 참가 신청이 없습니다.</div>';
}

function entryPaymentLabel(item){
  const status=item.paymentStatus||(item.paid?'paid':'unpaid');
  return status==='paid'?'입금 완료':status==='refunded'?'환불 완료':status==='checking'?'입금 확인 중':'미입금';
}
function entryPaymentClass(item){const s=item.paymentStatus||(item.paid?'paid':'unpaid');return s==='paid'?'paid':s==='refunded'?'refunded':s==='checking'?'checking':'unpaid';}
function entryDateTime(value){if(!value)return '';try{return new Date(value).toLocaleString('ko-KR');}catch(_e){return String(value)}}
function entrySmsTemplate(kind,item){
  const sender=state.messaging?.settings?.senderName||'230MATCH';
  const event=item.tournamentName||state.tournament?.name||'현재 대회';
  const fee=state.portal?.guide?.fee||'';
  if(kind==='payment')return `[${sender}] ${item.teamName}님, ${event} 참가비 입금이 확인되었습니다.${fee?` 참가비 ${fee}.`:''} 참가 확정 명단을 확인해 주세요.`;
  if(kind==='promote')return `[${sender}] ${item.teamName}님, ${event} 후보에서 일반 참가팀으로 승격되었습니다. 대회 일정과 준비사항을 확인해 주세요.`;
  if(kind==='approve')return `[${sender}] ${item.teamName}님, ${event} 참가 신청이 승인되었습니다.${item.paid?' 참가비 입금도 확인되었습니다.':' 참가비 입금 확인 후 최종 참가가 확정됩니다.'}`;
  if(kind==='reserve')return `[${sender}] ${item.teamName}님, ${event} 후보팀으로 접수되었습니다. 후보 순번은 ${reserveApplicationOrder(item)||'-'}번이며, 승격 시 다시 안내드리겠습니다.`;
  if(kind==='reject')return `[${sender}] ${item.teamName}님, ${event} 참가 신청이 반려되었습니다.${item.adminMemo?` 사유: ${item.adminMemo}`:''}`;
  if(kind==='refund')return `[${sender}] ${item.teamName}님, ${event} 참가비 환불 처리가 완료되었습니다.`;
  return `[${sender}] ${item.teamName}님, ${event} 참가 신청 안내입니다.`;
}
function entrySmsMessage(kind,item){return entrySmsTemplate(kind,item);}
let entrySmsItem=null;
function openEntrySmsDialog(kind,item){
  if(!item||!validatePhone(String(item.phone||'').replace(/\D/g,''))){notice('문자 받을 연락처가 없습니다.','error');return;}
  entrySmsItem={kind,item};
  const d=document.getElementById('entrySmsDialog');if(!d)return;
  const titles={payment:'💳 입금완료 문자 확인',promote:'⬆️ 후보 승격 문자 확인',approve:'✅ 참가승인 문자 확인',reserve:'⏳ 후보등록 문자 확인',reject:'❌ 반려 문자 확인',refund:'↩️ 환불완료 문자 확인'};
  document.getElementById('entrySmsTitle').textContent=titles[kind]||'참가 신청 문자 확인';
  document.getElementById('entrySmsTarget').textContent=`${item.teamName} · ${item.phone}`;
  document.getElementById('entrySmsBody').value=entrySmsTemplate(kind,item);
  if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');
}
function closeEntrySmsDialog(){const d=document.getElementById('entrySmsDialog');if(d?.open)d.close();else d?.removeAttribute('open');entrySmsItem=null;}
async function sendEntrySmsAligo(){if(!entrySmsItem)return;const body=document.getElementById('entrySmsBody')?.value?.trim()||'';try{await sendAligoSmsV3([{name:entrySmsItem.item.teamName,phone:entrySmsItem.item.phone}],body,{source:'registration',kind:entrySmsItem.kind,title:'230MATCH 참가 안내'});entrySmsItem.item.smsHistory=entrySmsItem.item.smsHistory||[];entrySmsItem.item.smsHistory.unshift({kind:entrySmsItem.kind,channel:'aligo',sentAt:new Date().toISOString(),body});commit(`참가 안내 문자 발송 · ${entrySmsItem.item.teamName}`);notice('알리고 문자를 발송했습니다.','success');closeEntrySmsDialog();renderApplicationPortal();}catch(e){notice(`문자 발송 실패: ${e.message||e}`,'error');}}
function sendEntrySmsPhone(){if(!entrySmsItem)return;const body=document.getElementById('entrySmsBody')?.value?.trim()||'',phone=String(entrySmsItem.item.phone||'').replace(/\D/g,'');if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||''))location.href=`sms:${phone}?body=${encodeURIComponent(body)}`;else navigator.clipboard?.writeText(`${phone}\n\n${body}`);entrySmsItem.item.smsHistory=entrySmsItem.item.smsHistory||[];entrySmsItem.item.smsHistory.unshift({kind:entrySmsItem.kind,channel:'phone',sentAt:new Date().toISOString(),body});commit(`참가 안내 문자앱 열기 · ${entrySmsItem.item.teamName}`);notice('문자앱을 열거나 내용을 복사했습니다.','success');closeEntrySmsDialog();}
async function copyEntrySms(){if(!entrySmsItem)return;const body=document.getElementById('entrySmsBody')?.value?.trim()||'';await navigator.clipboard.writeText(`${entrySmsItem.item.phone}\n\n${body}`);notice('번호와 문구를 복사했습니다.','success');}
function bindEntrySmsDialog(){document.getElementById('entrySmsCloseBtn')?.addEventListener('click',closeEntrySmsDialog);document.getElementById('entrySmsSkipBtn')?.addEventListener('click',closeEntrySmsDialog);document.getElementById('entrySmsAligoBtn')?.addEventListener('click',sendEntrySmsAligo);document.getElementById('entrySmsPhoneBtn')?.addEventListener('click',sendEntrySmsPhone);document.getElementById('entrySmsCopyBtn')?.addEventListener('click',copyEntrySms);}
function entryActiveCount(){return (state.portal?.applications||[]).filter(a=>a.status==='approved').length;}
function entryCapacity(){return Math.max(0,Number(state.tournament?.capacity||state.settings?.activeTeamCount||0));}
function suggestReservePromotion(){
  const cap=entryCapacity(),active=entryActiveCount();if(!cap||active>=cap)return;
  const next=(state.portal?.applications||[]).filter(a=>a.status==='reserve').sort((a,b)=>String(a.approvedAt||a.createdAt).localeCompare(String(b.approvedAt||b.createdAt)))[0];
  if(next)notice(`참가 정원에 ${cap-active}자리 여유가 있습니다. 후보 ${reserveApplicationOrder(next)}번 ${next.teamName} 승격을 확인하세요.`,'info');
}

function renderApplicationPortal(){
  ensurePortalState();renderEntryTournamentSelect();
  const applications=[...(state.portal?.applications||[])];
  const approved=applications.filter(a=>a.status==='approved').sort((a,b)=>String(a.approvedAt||a.createdAt).localeCompare(String(b.approvedAt||b.createdAt)));
  const reserve=applications.filter(a=>a.status==='reserve').sort((a,b)=>String(a.approvedAt||a.createdAt).localeCompare(String(b.approvedAt||b.createdAt)));
  const pending=applications.filter(a=>a.status==='pending');
  const totalBadge=document.getElementById('entryPublicTotalBadge');if(totalBadge)totalBadge.textContent=`전체 ${approved.length+reserve.length}팀`;
  const ac=document.getElementById('entryPublicApprovedCount');if(ac)ac.textContent=`${approved.length}팀`;
  const rc=document.getElementById('entryPublicReserveCount');if(rc)rc.textContent=`${reserve.length}팀`;
  const pc=document.getElementById('entryPublicPendingCount');if(pc)pc.textContent=`${pending.length}팀`;
  const publicRows=(rows,type)=>rows.map((a,index)=>`<article class="entry-public-team-row"><span class="entry-public-order">${index+1}</span><div><strong>${portalEscape(a.teamName||'팀명 미등록')}</strong><small>${portalEscape(a.affiliation||entryApplicationPlayers(a).map(p=>p.club).filter(Boolean).join(' / ')||'소속 미등록')}</small></div>${type==='reserve'?`<span class="badge badge-warning">후보 ${index+1}</span>`:'<span class="badge badge-safe">참가</span>'}</article>`).join('')||`<div class="portal-empty">${type==='reserve'?'후보팀이':'승인된 참가팀이'} 없습니다.</div>`;
  const approvedRoot=document.getElementById('entryPublicApprovedList');if(approvedRoot)approvedRoot.innerHTML=publicRows(approved,'approved');
  const reserveRoot=document.getElementById('entryPublicReserveList');if(reserveRoot)reserveRoot.innerHTML=publicRows(reserve,'reserve');
  const admin=document.getElementById('entryAdminList');
  if(admin){
    const filter=document.getElementById('entryAdminFilter')?.value||'all';
    const rows=[...state.portal.applications].filter(a=>filter==='all'||a.status===filter).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    const pending=state.portal.applications.filter(a=>a.status==='pending').length;
    const badge=document.getElementById('entryPendingCount');if(badge)badge.textContent=`승인 대기 ${pending}건`;
    const toolbar=document.querySelector('#view-entry .entry-admin-toolbar');if(toolbar){toolbar.dataset.summary=`전체 ${state.portal.applications.length}건 · 승인대기 ${pending}건 · 참가 ${(state.portal.applications||[]).filter(a=>a.status==='approved').length}건 · 후보 ${(state.portal.applications||[]).filter(a=>a.status==='reserve').length}건`;}
    admin.innerHTML=rows.map(a=>{const reserveNo=a.status==='reserve'?reserveApplicationOrder(a):0;const paymentTime=a.paidAt?`<small class="entry-payment-time">입금 ${portalEscape(entryDateTime(a.paidAt))}</small>`:'';const statusActions=a.status==='pending'?`<button class="btn btn-primary btn-small" data-entry-action="approve" data-entry-id="${a.id}">참가 승인</button><button class="btn btn-secondary btn-small" data-entry-action="reserve" data-entry-id="${a.id}">후보 승인</button><button class="btn btn-danger-outline btn-small" data-entry-action="reject" data-entry-id="${a.id}">반려</button>`:a.status==='reserve'?`<button class="btn btn-primary btn-small" data-entry-action="promote" data-entry-id="${a.id}">일반 참가 승격</button><button class="btn btn-light btn-small" data-entry-action="pending" data-entry-id="${a.id}">승인 대기로</button>`:a.status==='approved'?`<button class="btn btn-secondary btn-small" data-entry-action="reserve" data-entry-id="${a.id}">후보 전환</button><button class="btn btn-light btn-small" data-entry-action="pending" data-entry-id="${a.id}">승인 대기로</button>`:`<button class="btn btn-light btn-small" data-entry-action="pending" data-entry-id="${a.id}">승인 대기로</button>`;return `<article class="entry-admin-row"><div class="entry-main"><strong>${portalEscape(a.teamName)}</strong><span>${portalEscape(a.tournamentName||state.tournament?.name||'현재 대회')}${a.tournamentDivision?` (${portalEscape(a.tournamentDivision)})`:''} · ${portalEscape(a.affiliation||'소속 없음')} · ${portalEscape(a.phone)} · ${portalEscape(a.code)}</span><small>${new Date(a.createdAt).toLocaleString('ko-KR')}${a.memo?` · ${portalEscape(a.memo)}`:''}${reserveNo?` · 후보 ${reserveNo}번`:''}</small></div><span class="entry-status ${applicationStatusClass(a.status)}">${applicationStatusLabel(a.status)}</span><div class="entry-payment-wrap"><span class="entry-payment ${entryPaymentClass(a)}">${entryPaymentLabel(a)}</span>${paymentTime}</div><div class="entry-actions">${statusActions}<button class="btn btn-light btn-small" data-entry-payment="${a.id}">${a.paid?'입금 취소':'입금 완료'}</button>${a.paid?`<button class="btn btn-light btn-small" data-entry-refund="${a.id}">환불 완료</button>`:''}<button class="btn btn-light btn-small" data-entry-sms="${a.id}">문자</button></div></article>`;}).join('')||'<div class="portal-empty">조건에 맞는 참가 신청이 없습니다.</div>';
  }
}
function processEntryApplication(id,action){
  if(!requireAdmin('참가 신청 처리'))return;
  const item=(state.portal?.applications||[]).find(a=>a.id===id);if(!item)return;
  const previous=item.status;
  if(action==='approve'||action==='reserve'||action==='promote'){
    const targetStatus=action==='reserve'?'reserve':'approved';
    const existing=(state.teams||[]).find(t=>myMatchNormalize(portalTeam(t))===myMatchNormalize(item.teamName));
    if(!existing){const team=participantNormalizedTeam({id:crypto.randomUUID(),name:item.teamName,affiliation:item.affiliation},state.teams.length);participantReorderByStatus(team,targetStatus==='approved'?'active':'reserve');team.players=entryApplicationPlayers(item);team.playerPhones=team.players.map(p=>p.phone).filter(Boolean);team.ownerUid=item.ownerUid||'';setTeamContact(state,team,{phone:item.phone});}
    else participantReorderByStatus(existing,targetStatus==='approved'?'active':'reserve');
    item.status=targetStatus;item.approvedAt=item.approvedAt||new Date().toISOString();item.updatedAt=new Date().toISOString();item.adminMemo=targetStatus==='approved'?'참가팀 명단에 등록되었습니다.':'후보팀 명단에 등록되었습니다.';
  }else if(action==='reject'){const reason=prompt('반려 사유를 입력하세요.','참가 요건 또는 정원 확인이 필요합니다.');if(reason===null)return;item.status='rejected';item.adminMemo=reason.trim();item.updatedAt=new Date().toISOString();}
  else if(action==='pending'){item.status='pending';item.adminMemo='';item.approvedAt='';item.updatedAt=new Date().toISOString();}
  commit(`참가 신청 처리 · ${item.teamName} · ${applicationStatusLabel(item.status)}`);renderApplicationPortal();renderParticipantManager();lookupPublicApplication();
  if(action==='promote'||(previous==='reserve'&&item.status==='approved'))openEntrySmsDialog('promote',item);
  else if(action==='approve')openEntrySmsDialog('approve',item);
  else if(action==='reserve')openEntrySmsDialog('reserve',item);
  else if(action==='reject')openEntrySmsDialog('reject',item);
  suggestReservePromotion();
}
function editEntryApplication(id){
  const lookupPhone=String(document.getElementById('entryLookupPhone')?.value||'').replace(/[^0-9]/g,'');
  const item=(state.portal?.applications||[]).find(a=>a.id===id);
  if(!item||!entryApplicationPlayers(item).some(p=>p.phone===lookupPhone)||item.status!=='pending')return;
  entryEditingId=item.id;renderEntryTournamentSelect();
  const tournament=document.getElementById('entryApplicationTournament');if(tournament)tournament.value=item.tournamentId||'current';
  const players=entryApplicationPlayers(item);
  players.forEach((p,i)=>{const n=i+1;const name=document.getElementById(`entryPlayer${n}Name`);const club=document.getElementById(`entryPlayer${n}Club`);const phone=document.getElementById(`entryPlayer${n}Phone`);if(name)name.value=p.name||'';if(club)club.value=p.club||'';if(phone)phone.value=p.phone||'';});
  const rep=Number(item.representativeIndex||0)===1?document.getElementById('entryRepresentative2'):document.getElementById('entryRepresentative1');if(rep)rep.checked=true;
  const memo=document.getElementById('entryApplicationMemo');if(memo)memo.value=item.memo||'';
  document.getElementById('entryApplicationSubmitBtn').textContent='신청 수정 저장';document.getElementById('entryApplicationEditCancelBtn').hidden=false;document.getElementById('entryPlayer1Name')?.focus();window.scrollTo({top:0,behavior:'smooth'});
}
function cancelEntryApplication(id){
  const item=(state.portal?.applications||[]).find(a=>a.id===id);if(!item||item.status!=='pending')return;
  const phone=String(document.getElementById('entryLookupPhone')?.value||'').replace(/[^0-9]/g,'');if(item.phone!==phone)return;
  if(!confirm(`${item.teamName} 참가 신청을 취소할까요?`))return;item.status='cancelled';item.updatedAt=new Date().toISOString();if(entryEditingId===item.id)clearEntryApplicationForm();commit(`참가 신청 취소 · ${item.teamName}`);lookupPublicApplication();renderApplicationPortal();
}
function bindEntryApplications(){
  document.getElementById('entryApplicationSubmitBtn')?.addEventListener('click',submitPublicApplication);
  document.getElementById('entryApplicationEditCancelBtn')?.addEventListener('click',clearEntryApplicationForm);
  document.getElementById('entryLookupBtn')?.addEventListener('click',lookupPublicApplication);
  document.getElementById('entryLookupPhone')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookupPublicApplication();}});
  document.getElementById('entryAdminFilter')?.addEventListener('change',renderApplicationPortal);
  document.addEventListener('click',e=>{const action=e.target.closest?.('[data-entry-action]');if(action){processEntryApplication(action.dataset.entryId,action.dataset.entryAction);return;}const payment=e.target.closest?.('[data-entry-payment]');if(payment){toggleEntryPayment(payment.dataset.entryPayment);return;}const refund=e.target.closest?.('[data-entry-refund]');if(refund){refundEntryPayment(refund.dataset.entryRefund);return;}const sms=e.target.closest?.('[data-entry-sms]');if(sms){manualEntrySms(sms.dataset.entrySms);return;}const edit=e.target.closest?.('[data-entry-edit]');if(edit){editEntryApplication(edit.dataset.entryEdit);return;}const cancel=e.target.closest?.('[data-entry-cancel]');if(cancel)cancelEntryApplication(cancel.dataset.entryCancel);});
}


// Stage 31.47 · public participant records
function participantRecordStatus(team,index){
  const activeIds=new Set((state.prelim?.activeTeams||[]).map(t=>String(t.id)));
  const reserveIds=new Set((state.prelim?.reserveTeams||[]).map(t=>String(t.id)));
  if(activeIds.has(String(team.id)))return 'active';
  if(reserveIds.has(String(team.id)))return 'reserve';
  const activeCount=Math.max(0,Number(state.prelim?.settings?.activeTeamCount||state.settings?.activeTeamCount||state.teams?.length||0));
  return index<activeCount?'active':'reserve';
}
function participantRecordPlayers(team){
  const raw=String(team?.name||'').trim();
  const parts=raw.split(/\s*[/,&·+]\s*|\s{2,}/).map(x=>x.trim()).filter(Boolean);
  return parts.length?parts:[raw||'이름 없음'];
}
function publicParticipantRows(){
  const archives=[...(state.portal?.participantArchives||[])].sort((a,b)=>String(b.archivedAt||'').localeCompare(String(a.archivedAt||'')));
  return archives.flatMap((archived,archiveIndex)=>{
    const names=Array.isArray(archived.teamNames)?archived.teamNames:[];
    return names.flatMap((name,index)=>{
      const team={id:`archived-${archiveIndex}-${index}`,name:String(name||''),affiliation:archived.name||'보관 대회'};
      return participantRecordPlayers(team).map((player,playerIndex)=>({team,index,player,playerIndex,status:'active',contact:null,archiveName:archived.name||'',archivedAt:archived.archivedAt||''}));
    });
  });
}
function renderPublicParticipantRecords(){
  const root=document.getElementById('publicParticipantList');if(!root)return;
  const query=String(document.getElementById('publicParticipantSearch')?.value||'').trim().toLowerCase();
  const filter=document.getElementById('publicParticipantStatus')?.value||'all';
  const rows=publicParticipantRows();
  const activeTeams=new Set(rows.map(r=>`${r.archiveName}::${r.team?.name||''}`)).size;
  const reserveTeams=0;
  const visible=rows.filter(row=>{
    if(filter!=='all'&&row.status!==filter)return false;
    const hay=[row.player,row.team?.name,row.team?.affiliation,row.contact?.manager,canOperate()?row.contact?.phone:''].join(' ').toLowerCase();
    return !query||hay.includes(query);
  });
  document.getElementById('publicParticipantCount').textContent=`전체 ${rows.length}명`;
  document.getElementById('publicParticipantTotal').textContent=`${rows.length}명`;
  document.getElementById('publicParticipantActive').textContent=`${activeTeams}팀`;
  document.getElementById('publicParticipantReserve').textContent=`${reserveTeams}팀`;
  document.getElementById('publicParticipantVisible').textContent=`${visible.length}명`;
  const guide=document.getElementById('publicParticipantGuide');if(guide)guide.textContent=query?`“${query}” 검색 결과 ${visible.length}명입니다.`:`보관된 지난 대회 참가자 ${rows.length}명을 표시합니다.`;
  root.innerHTML=visible.map((row,idx)=>`<article class="public-participant-card"><div class="participant-record-number">${idx+1}</div><div class="participant-record-main"><strong>${portalEscape(row.player)}</strong><span>${portalEscape(row.team?.affiliation||'소속 미등록')}</span><small>${portalEscape(row.team?.name||'')}${row.archiveName?` · 보관 기록`:''}</small>${canOperate()&&row.contact?.phone?`<small class="participant-record-phone">${portalEscape(row.contact.phone)}</small>`:''}</div><span class="participant-record-state ${row.status}">${row.status==='active'?'참가':'후보'}</span></article>`).join('')||'<div class="portal-empty">조건에 맞는 참가자가 없습니다.</div>';
}
function exportPublicParticipantsCsv(){
  if(!requireOperator('참가자 CSV 저장'))return;
  const rows=publicParticipantRows();
  const esc=value=>`"${String(value??'').replaceAll('"','""')}"`;
  const lines=[['번호','선수명','팀명','소속','구분','대표 연락처'].map(esc).join(',')];
  rows.forEach((row,index)=>lines.push([index+1,row.player,row.team?.name||'',row.team?.affiliation||'',row.status==='active'?'참가팀':'후보팀',row.contact?.phone||''].map(esc).join(',')));
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`230MATCH_참가자기록_${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function bindPublicParticipantRecords(){
  document.getElementById('publicParticipantSearch')?.addEventListener('input',renderPublicParticipantRecords);
  document.getElementById('publicParticipantStatus')?.addEventListener('change',renderPublicParticipantRecords);
  document.getElementById('publicParticipantReset')?.addEventListener('click',()=>{const q=document.getElementById('publicParticipantSearch');const f=document.getElementById('publicParticipantStatus');if(q)q.value='';if(f)f.value='all';renderPublicParticipantRecords();});
  document.getElementById('publicParticipantCsv')?.addEventListener('click',exportPublicParticipantsCsv);
}


// Stage 31.48 · legacy result archive and podium
function resultTeamName(team){return team?portalTeam(team):'';}
function resultLoser(match){
  if(!match?.winner)return null;
  const winnerId=String(match.winner?.id||match.winner?.teamId||'');
  const aId=String(match.teamA?.id||match.teamA?.teamId||'');
  const bId=String(match.teamB?.id||match.teamB?.teamId||'');
  if(winnerId&&winnerId===aId)return match.teamB||null;
  if(winnerId&&winnerId===bId)return match.teamA||null;
  const winnerName=resultTeamName(match.winner);
  return resultTeamName(match.teamA)===winnerName?match.teamB:match.teamA;
}
function currentPodium(){
  const rounds=state.draw?.rounds||{};
  const final=(rounds[2]||[])[0]||null;
  const semis=rounds[4]||[];
  const champion=state.operation?.champion||final?.winner||null;
  const runnerUp=final?.status==='completed'?resultLoser(final):null;
  const thirds=semis.filter(m=>m?.status==='completed').map(resultLoser).filter(Boolean);
  return {champion:resultTeamName(champion),runnerUp:resultTeamName(runnerUp),thirds:[...new Set(thirds.map(resultTeamName).filter(Boolean))]};
}
function normalizeResultArchive(item){
  if(item&&!Array.isArray(item.teamNames))item={...item,teamNames:[]};
  return {...item, champion:item?.champion||'', runnerUp:item?.runnerUp||'', thirds:Array.isArray(item?.thirds)?item.thirds:[], division:item?.division||''};
}
function resultArchiveRows(){return (state.portal?.resultArchives||[]).map(normalizeResultArchive);}
function renderResultArchive(){
  const current=document.getElementById('currentResultSummary');
  const prelim=state.prelim?.matches||[],main=portalMainMatches();
  const pDone=prelim.filter(x=>x.status==='completed').length,mDone=main.filter(x=>x.status==='completed').length;
  const podium=currentPodium();
  const complete=Boolean(podium.champion)&&main.length>0&&mDone===main.length;
  const badge=document.getElementById('currentResultStateBadge');if(badge){badge.textContent=complete?'최종 확정':'진행 중';badge.className=`badge ${complete?'badge-safe':'badge-warning'}`;}
  if(current)current.innerHTML=`<div class="legacy-result-title"><strong>${portalEscape(state.tournament?.name||'현재 대회')}</strong><span>${portalEscape(state.tournament?.division||'부서 미설정')}</span></div><div class="legacy-podium-grid"><div class="podium champion"><span>🏆 우승</span><b>${portalEscape(podium.champion||'미확정')}</b></div><div class="podium runner"><span>🥈 준우승</span><b>${portalEscape(podium.runnerUp||'미확정')}</b></div><div class="podium third"><span>🥉 공동 3위</span><b>${portalEscape(podium.thirds.join(' · ')||'미확정')}</b></div></div><div class="portal-result-metrics"><div>예선 완료<br><b>${pDone}/${prelim.length}</b></div><div>본선 완료<br><b>${mDone}/${main.length}</b></div><div>진행률<br><b>${main.length?Math.round(mDone/main.length*100):0}%</b></div><div>최종 갱신<br><b>${state.updatedAt?new Date(state.updatedAt).toLocaleString('ko-KR'):'-'}</b></div></div>`;
  const rows=resultArchiveRows();
  const divisionSelect=document.getElementById('resultArchiveDivision');
  if(divisionSelect){const selected=divisionSelect.value||'all';const divisions=[...new Set(rows.map(x=>x.division).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));divisionSelect.innerHTML='<option value="all">전체 부서</option>'+divisions.map(x=>`<option value="${portalEscape(x)}">${portalEscape(x)}</option>`).join('');divisionSelect.value=divisions.includes(selected)?selected:'all';}
  const query=String(document.getElementById('resultArchiveSearch')?.value||'').trim().toLowerCase();const division=divisionSelect?.value||'all';
  const visible=rows.filter(r=>(division==='all'||r.division===division)&&(!query||`${r.name} ${r.division} ${r.champion} ${r.runnerUp} ${(r.thirds||[]).join(' ')}`.toLowerCase().includes(query))).sort((a,b)=>String(b.archivedAt).localeCompare(String(a.archivedAt)));
  const count=document.getElementById('resultArchiveCount');if(count)count.textContent=`${visible.length}개`;
  const guide=document.getElementById('resultArchiveGuide');if(guide)guide.textContent=query||division!=='all'?`조건에 맞는 결과 ${visible.length}개입니다.`:`보관된 대회 결과 ${rows.length}개입니다.`;
  const root=document.getElementById('resultArchiveList');if(root)root.innerHTML=visible.map(r=>`<article class="portal-record-item legacy-result-item"><div class="legacy-result-item-head"><div><strong>${portalEscape(r.name)}</strong><div class="portal-meta">${portalEscape(r.division||'부서 미설정')} · ${new Date(r.archivedAt).toLocaleDateString('ko-KR')}</div></div>${isAdmin()?`<button type="button" class="btn btn-danger-outline btn-small" data-result-archive-delete="${r.id}">삭제</button>`:''}</div><div class="legacy-result-mini-podium"><div><span>우승</span><b>${portalEscape(r.champion||'미확정')}</b></div><div><span>준우승</span><b>${portalEscape(r.runnerUp||'미확정')}</b></div><div><span>공동 3위</span><b>${portalEscape((r.thirds||[]).join(' · ')||'미확정')}</b></div></div>${Array.isArray(r.quarterfinals)&&r.quarterfinals.length?`<div class="legacy-quarterfinal-record"><strong>8강 진출</strong><span>${r.quarterfinals.map(portalEscape).join(' · ')}</span></div>`:''}${Array.isArray(r.resultPhotos)&&r.resultPhotos.length?`<div class="legacy-result-photo-strip">${r.resultPhotos.map((p,i)=>`<a href="${portalEscape(p.url)}" target="_blank" rel="noopener"><img src="${portalEscape(p.url)}" alt="결과사진 ${i+1}" loading="lazy"></a>`).join('')}</div>`:''}<div class="portal-meta">참가팀 ${(r.teamNames||[]).length}팀 · 결과사진 ${(r.resultPhotos||[]).length}장</div></article>`).join('')||'<div class="portal-empty">조건에 맞는 대회 결과가 없습니다.</div>';
}
function exportResultArchiveCsv(){
  if(!requireAdmin('대회 결과 CSV 저장'))return;
  const esc=v=>`"${String(v??'').replaceAll('"','""')}"`;const rows=[['대회명','부서','우승','준우승','공동3위','예선완료','예선전체','본선완료','본선전체','보관일시']];
  resultArchiveRows().forEach(r=>rows.push([r.name,r.division,r.champion,r.runnerUp,(r.thirds||[]).join(' / '),r.prelimCompleted,r.prelimTotal,r.mainCompleted,r.mainTotal,r.archivedAt]));
  const blob=new Blob(['\ufeff'+rows.map(row=>row.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`230MATCH_대회결과_${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function bindResultArchive(){
  document.getElementById('resultArchiveSearch')?.addEventListener('input',renderResultArchive);
  document.getElementById('resultArchiveDivision')?.addEventListener('change',renderResultArchive);
  document.getElementById('resultArchiveResetBtn')?.addEventListener('click',()=>{const q=document.getElementById('resultArchiveSearch');const d=document.getElementById('resultArchiveDivision');if(q)q.value='';if(d)d.value='all';renderResultArchive();});
  document.getElementById('exportResultArchiveCsvBtn')?.addEventListener('click',exportResultArchiveCsv);
  document.getElementById('resultArchiveList')?.addEventListener('click',e=>{const btn=e.target.closest('[data-result-archive-delete]');if(!btn||!requireAdmin('보관 결과 삭제'))return;if(!confirm('이 보관 결과를 삭제할까요?'))return;state.portal.resultArchives=state.portal.resultArchives.filter(x=>x.id!==btn.dataset.resultArchiveDelete);commit('보관된 대회 결과 삭제');renderResultArchive();});
}

function formatBytes(bytes){
  const value=Number(bytes)||0;
  if(value<1024)return `${value} B`;
  if(value<1024*1024)return `${(value/1024).toFixed(value<10240?1:0)} KB`;
  return `${(value/1024/1024).toFixed(1)} MB`;
}
function recoveryFileName(label){return `${safeFilePart(state.tournament?.name)}-${safeFilePart(label||'복구점')}-${Date.now()}.json`;}
async function recoveryStorageEstimate(){
  try{const estimate=await navigator.storage?.estimate?.();return estimate||{};}catch(_error){return {};}
}
async function renderBackupRecoveryManager(){
  const root=document.getElementById('backupRecoveryManagerList');
  if(!root)return;
  const list=await getRecoveries();
  const currentSize=new Blob([JSON.stringify(state)]).size;
  const newest=list[0];
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  set('backupCurrentTournament',state.tournament?.name||'이름 없음');
  set('backupCurrentUpdated',state.updatedAt?`마지막 저장 ${new Date(state.updatedAt).toLocaleString('ko-KR')}`:'마지막 저장 정보 없음');
  set('backupRecoveryCount',`${list.length}개`);
  set('backupLatestRecovery',newest?`최근 ${new Date(newest.createdAt).toLocaleString('ko-KR')}`:'저장된 복구점 없음');
  set('backupStateSize',formatBytes(currentSize));
  const estimate=await recoveryStorageEstimate();
  const usage=Number(estimate.usage)||0,quota=Number(estimate.quota)||0;
  set('backupStorageUsage',quota?`${formatBytes(usage)} / ${formatBytes(quota)}`:'사용 가능');
  set('backupStorageDetail',quota?`사용률 ${Math.min(100,(usage/quota)*100).toFixed(1)}%`:'저장 용량은 브라우저가 관리합니다.');
  const badge=document.getElementById('backupStorageBadge');if(badge){badge.textContent=list.length?`복구점 ${list.length}/10`:'복구점 없음';badge.className=`badge ${list.length>=9?'badge-warning':'badge-safe'}`;}
  root.innerHTML=list.length?list.map(item=>`<article class="backup-recovery-card"><div><h4>${escapeHtml(item.label||'이름 없는 복구점')}</h4><p>${new Date(item.createdAt).toLocaleString('ko-KR')} · ${escapeHtml(item.state?.tournament?.name||'대회명 없음')} · ${formatBytes(new Blob([JSON.stringify(item.state||{})]).size)}</p></div><div class="button-row"><button type="button" class="btn btn-primary" data-backup-restore="${item.id}">복원</button><button type="button" class="btn btn-light" data-backup-download="${item.id}">파일 저장</button><button type="button" class="btn btn-danger-outline" data-backup-delete="${item.id}">삭제</button></div></article>`).join(''):'<div class="portal-empty">저장된 복구점이 없습니다.</div>';
}
async function createNamedRecovery(){
  if(!requireAdmin('복구점 저장'))return;
  const input=document.getElementById('backupRecoveryLabel');
  const label=String(input?.value||'').trim()||`${state.tournament?.name||'현재 대회'} · 수동 복구점`;
  const item=saveRecovery(state,label),result=await item.ready;
  if(result?.saved){if(input)input.value='';notice(`복구점을 저장했습니다. 현재 ${result.count}개를 보관합니다.`,'success');}
  else notice('복구점 저장에 실패했습니다. 전체 백업 JSON을 저장해 주세요.','error');
  await renderBackupRecoveryManager();
}
async function downloadRecoveryBundle(){
  if(!requireAdmin('복구점 묶음 저장'))return;
  const recoveries=await getRecoveries();
  const payload={format:'230MATCH_V3_RECOVERY_BUNDLE',schemaVersion:1,appBuild:BUILD_LABEL,exportedAt:new Date().toISOString(),currentState:structuredClone(state),recoveries:recoveries.map(item=>({id:item.id,label:item.label,createdAt:item.createdAt,state:item.state}))};
  downloadJson(`${safeFilePart(state.tournament?.name)}-복구점묶음-${Date.now()}.json`,payload);
  notice(`현재 상태와 복구점 ${recoveries.length}개를 한 파일로 저장했습니다.`,'success');
}
async function handleBackupManagerClick(event){
  const restore=event.target.closest?.('[data-backup-restore]');
  if(restore){if(!requireAdmin('복구점 복원'))return;const item=await getRecovery(restore.dataset.backupRestore);if(!item)return notice('복구점을 찾을 수 없습니다.','error');if(!confirm(`현재 상태를 자동 저장한 뒤 “${item.label}” 상태로 복원할까요?`))return;if(!requireTypedConfirmation('복구점 복원','복원'))return;autoRecovery('관리 화면 복원 직전');state=normalizeV5RuntimeState(structuredClone(item.state));ensurePortalState();ensureOperatorState();ensureContacts(state);commit(`복구점 복원 · ${item.label}`);notice('복구점 상태로 복원했습니다.','success');await renderBackupRecoveryManager();return;}
  const download=event.target.closest?.('[data-backup-download]');
  if(download){const item=await getRecovery(download.dataset.backupDownload);if(!item)return notice('복구점을 찾을 수 없습니다.','error');downloadJson(recoveryFileName(item.label),{format:'230MATCH_V3_FULL_BACKUP',schemaVersion:2,archiveSchema:'230match-archive-v1',archiveCount:(state.portal?.archives||[]).length,appBuild:BUILD_LABEL,exportedAt:new Date().toISOString(),sourceRecovery:{label:item.label,createdAt:item.createdAt},state:item.state});return;}
  const del=event.target.closest?.('[data-backup-delete]');
  if(del){if(!requireAdmin('복구점 삭제'))return;if(!confirm('이 복구점을 삭제할까요? 삭제 후 되돌릴 수 없습니다.'))return;await deleteRecovery(del.dataset.backupDelete);await renderBackupRecoveryManager();notice('복구점을 삭제했습니다.','success');}
}
async function deleteAllRecoveries(){
  if(!requireAdmin('복구점 전체 삭제'))return;
  const list=await getRecoveries();if(!list.length)return notice('삭제할 복구점이 없습니다.','info');
  if(!requireTypedConfirmation(`복구점 ${list.length}개 전체 삭제`,'전체삭제'))return;
  await Promise.all(list.map(item=>deleteRecovery(item.id)));await renderBackupRecoveryManager();notice('모든 로컬 복구점을 삭제했습니다.','success');
}
async function previewAndImportBackup(file){
  const preview=document.getElementById('backupImportPreview');if(!file||!preview)return;
  let parsed;try{parsed=JSON.parse(await file.text());}catch(_error){preview.hidden=false;preview.className='backup-import-preview error';preview.textContent='백업 파일을 읽을 수 없습니다.';return;}
  const next=parsed?.format==='230MATCH_V3_FULL_BACKUP'?parsed.state:parsed?.currentState||parsed;
  if(!next?.tournament||!Array.isArray(next.teams)){preview.hidden=false;preview.className='backup-import-preview error';preview.textContent='230MATCH 전체 백업 형식이 아닙니다.';return;}
  preview.hidden=false;preview.className='backup-import-preview';preview.innerHTML=`<strong>불러올 백업 확인</strong>${escapeHtml(next.tournament.name||'이름 없음')} · ${escapeHtml(next.tournament.division||'부서 없음')}<br>참가팀 ${next.teams.length}팀 · 저장 시각 ${parsed.exportedAt?new Date(parsed.exportedAt).toLocaleString('ko-KR'):'정보 없음'}`;
  await importFullBackup(file);
  await renderBackupRecoveryManager();
}
function bindBackupRecoveryManager(){
  const on=(id,event,handler)=>{const el=document.getElementById(id);if(el)el.addEventListener(event,handler);};
  on('backupCreateRecoveryBtn','click',createNamedRecovery);
  on('backupDownloadFullBtn','click',exportFullBackup);
  on('backupDownloadBundleBtn','click',downloadRecoveryBundle);
  on('backupRefreshBtn','click',renderBackupRecoveryManager);
  on('backupDeleteAllBtn','click',deleteAllRecoveries);
  on('backupRecoveryManagerList','click',handleBackupManagerClick);
  on('backupImportInput','change',async event=>{const input=event.currentTarget,file=input.files?.[0];await previewAndImportBackup(file);input.value='';});
}


function readinessCheckItems(){
  const tournamentName=String(state.tournament?.name||'').trim();
  const teams=Array.isArray(state.teams)?state.teams:[];
  const activeTeams=Number(state.prelim?.settings?.activeTeamCount||teams.length||0);
  const venues=Array.isArray(state.settings?.venues)?state.settings.venues:[];
  const usableCourts=venues.reduce((sum,v)=>sum+Number(v.courtCount||0),0);
  const prelimGroups=Array.isArray(state.prelim?.groups)?state.prelim.groups:[];
  const prelimMatches=Array.isArray(state.prelim?.matches)?state.prelim.matches:[];
  const drawMatches=Object.values(state.draw?.rounds||{}).flat();
  const contactCount=Object.keys(state.contacts||{}).length;
  const socialUser=Boolean(window.__230AuthUser||document.getElementById('authUserEmail')?.textContent?.trim());
  return [
    {key:'tournament',label:'대회 기본정보',ok:Boolean(tournamentName&&state.tournament?.division),detail:tournamentName?`${tournamentName} · ${state.tournament?.division||'부서 미설정'}`:'대회명과 부서를 설정하세요.',view:'settings'},
    {key:'teams',label:'참가팀 명단',ok:teams.length>1,detail:`등록 ${teams.length}팀 · 참가 기준 ${activeTeams}팀`,view:'participants'},
    {key:'venues',label:'구장·코트 구성',ok:usableCourts>0,detail:`${venues.length}개 구장 · 총 ${usableCourts}면`,view:'settings'},
    {key:'prelim',label:'예선 조편성',ok:prelimGroups.length>0&&prelimMatches.length>0,detail:prelimGroups.length?`${prelimGroups.length}개 조 · ${prelimMatches.length}경기`:'예선 조를 아직 생성하지 않았습니다.',view:'prelim-public'},
    {key:'draw',label:'본선 대진',ok:Boolean(state.draw?.size&&drawMatches.length),warn:prelimGroups.length>0&&!state.draw?.size,detail:state.draw?.size?`${state.draw.size}강 · ${drawMatches.length}경기 · ${state.drawMeta?.locked?'잠금 완료':'잠금 전'}`:'본선 대진이 아직 없습니다.',view:'bracket'},
    {key:'contacts',label:'참가팀 연락처',ok:contactCount>0,warn:teams.length>0&&contactCount===0,detail:`연락처 ${contactCount}팀 등록`,view:'roster'},
    {key:'login',label:'운영 권한 로그인',ok:isAdmin()||isOperator(),detail:isAdmin()?'관리자 로그인 상태':isOperator()?'진행자 로그인 상태':'관리자 또는 진행자 로그인이 필요합니다.',action:'admin'},
    {key:'social',label:'간편로그인 연결',ok:socialUser,warn:!socialUser,optional:true,detail:socialUser?'간편로그인 사용자 연결됨':'선수용 간편로그인은 선택 점검 항목입니다.',action:'social'},
    {key:'recovery',label:'시작 전 복구점',ok:Boolean(state.portal?.lastReadinessRecoveryAt),warn:!state.portal?.lastReadinessRecoveryAt,detail:state.portal?.lastReadinessRecoveryAt?new Date(state.portal.lastReadinessRecoveryAt).toLocaleString('ko-KR'):'대회 시작 직전에 복구점을 저장하세요.',save:true}
  ];
}
function renderTournamentReadiness(){
  const list=document.getElementById('readinessChecklist');if(!list)return;
  const items=readinessCheckItems();
  const required=items.filter(x=>!x.optional), passed=required.filter(x=>x.ok).length;
  const blocking=required.filter(x=>!x.ok&&!x.warn).length;
  const overall=document.getElementById('readinessOverall');
  if(overall){overall.className=`readiness-overall ${blocking?'danger':passed===required.length?'safe':'warning'}`;overall.innerHTML=`<strong>${blocking?'운영 시작 전 확인 필요':passed===required.length?'운영 시작 준비 완료':'대부분 준비됨'}</strong><span>필수 ${passed}/${required.length} 완료${blocking?` · 미완료 ${blocking}건`:''}</span>`;}
  list.innerHTML=items.map(x=>`<article class="readiness-item ${x.ok?'ok':x.warn?'warn':'fail'}"><span class="readiness-icon">${x.ok?'✓':x.warn?'!':'×'}</span><div><strong>${escapeHtml(x.label)}${x.optional?' <em>선택</em>':''}</strong><p>${escapeHtml(x.detail)}</p></div>${x.view?`<button type="button" class="btn btn-light" data-readiness-go="${x.view}">바로가기</button>`:x.action?`<button type="button" class="btn btn-light" data-readiness-action="${x.action}">로그인</button>`:x.save?'<button type="button" class="btn btn-light" data-readiness-save>저장</button>':''}</article>`).join('');
  const summary=document.getElementById('readinessSummary');
  if(summary){const playing=[...(state.prelim?.courts||[]),...(state.courts||[])].filter(c=>c.playing).length,waiting=[...(state.prelim?.courts||[]),...(state.courts||[])].filter(c=>c.wait1).length;summary.innerHTML=`<div><span>참가팀</span><strong>${state.teams?.length||0}</strong></div><div><span>예선 경기</span><strong>${state.prelim?.matches?.length||0}</strong></div><div><span>본선 경기</span><strong>${Object.values(state.draw?.rounds||{}).flat().length}</strong></div><div><span>진행 코트</span><strong>${playing}</strong></div><div><span>코트 대기1</span><strong>${waiting}</strong></div><div><span>공용대기</span><strong>${(state.sharedQueue||[]).length}</strong></div>`;}
}
async function saveReadinessRecovery(){
  if(!(isAdmin()||isOperator())){notice('관리자 또는 진행자로 로그인하세요.','error');return;}
  try{await saveRecovery(state,'대회 시작 전 운영 점검');state.portal.lastReadinessRecoveryAt=new Date().toISOString();commit('대회 시작 전 복구점 저장');renderTournamentReadiness();notice('대회 시작 전 복구점을 저장했습니다.','success');}catch(error){notice(`복구점 저장 실패: ${error.message}`,'error');}
}
function bindTournamentReadiness(){
  document.getElementById('refreshReadinessBtn')?.addEventListener('click',renderTournamentReadiness);
  document.getElementById('view-readiness')?.addEventListener('click',event=>{
    const go=event.target.closest('[data-readiness-go]')?.dataset.readinessGo;if(go){navigatePortalView(go,{pushHistory:true});return;}
    const action=event.target.closest('[data-readiness-action]')?.dataset.readinessAction;if(action){triggerSettingsSource(action==='social'?'openSocialLoginBtn':'roleAdminBtn');return;}
    if(event.target.closest('[data-readiness-save]'))saveReadinessRecovery();
  });
  renderTournamentReadiness();
}

function stage331FindAnyMatch(id){
  if(!id)return null;
  const unified=findUnifiedMatch(state,id);
  return unified?.match||findPrelimMatch(state,id)||findMatch(state.draw,id)||null;
}
function stage331TeamLabel(match){
  if(!match)return '경기 정보 없음';
  return `${portalTeam(match.teamA)||'미정'} vs ${portalTeam(match.teamB)||'미정'}`;
}
function renderStage331OperationDashboard(){
  const root=document.getElementById('stage331OperationDashboard');
  if(!root)return;
  const courts=portalCourtRows();
  const activeCourts=courts.filter(c=>!c.isPaused);
  const playingRows=activeCourts.filter(c=>c.playing).map(c=>({court:c,match:stage331FindAnyMatch(c.playing)}));
  const emptyCourts=activeCourts.filter(c=>!c.playing);
  const wait1Count=activeCourts.filter(c=>c.wait1).length;
  const manualWaiting=activeCourts.reduce((n,c)=>n+(c.queue?.length||0)+(c.manualQueue?.length||0),0);
  const venueShared=Object.values(state.venueQueues||{}).reduce((n,q)=>n+(Array.isArray(q)?q.length:0),0);
  const sharedCount=venueShared+(state.sharedQueue?.length||0);
  const matchMinutes=Math.max(20,Number(state.settings?.matchMinutes)||40);
  const now=Date.now();
  const elapsedMinutes=m=>m?.startedAt?Math.max(0,Math.floor((now-new Date(m.startedAt).getTime())/60000)):0;
  const delayed=playingRows.filter(x=>elapsedMinutes(x.match)>=matchMinutes);
  const resultCheck=playingRows.filter(x=>elapsedMinutes(x.match)>=matchMinutes+10);
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=String(value)};
  set('stage331PlayingCount',playingRows.length);set('stage331EmptyCourtCount',emptyCourts.length);set('stage331Wait1Count',wait1Count);set('stage331SharedCount',sharedCount);set('stage331DelayedCount',delayed.length);set('stage331ResultCheckCount',resultCheck.length);set('stage331PlayingSummary',`${playingRows.length}경기`);
  const alerts=[];
  if(emptyCourts.length&&(sharedCount+manualWaiting)>0)alerts.push({level:'danger',title:`빈 코트 ${emptyCourts.length}면에 배정 가능한 대기 경기가 있습니다.`,detail:`공용대기 ${sharedCount}경기 · 추가대기 ${manualWaiting}경기`});
  resultCheck.forEach(x=>alerts.push({level:'danger',title:`${x.court.name||x.court.id} 결과 확인 필요`,detail:`${stage331TeamLabel(x.match)} · 진행 ${elapsedMinutes(x.match)}분`}));
  delayed.filter(x=>!resultCheck.includes(x)).forEach(x=>alerts.push({level:'warn',title:`${x.court.name||x.court.id} 경기 지연`,detail:`${stage331TeamLabel(x.match)} · 진행 ${elapsedMinutes(x.match)}분`}));
  const paused=courts.filter(c=>c.isPaused);
  if(paused.length)alerts.push({level:'warn',title:`사용중지 코트 ${paused.length}면`,detail:paused.map(c=>c.name||c.id).join(' · ')});
  set('stage331AlertCount',`${alerts.length}건`);
  const stateBadge=document.getElementById('stage331DashboardState');
  if(stateBadge){const level=resultCheck.length||((emptyCourts.length&&(sharedCount+manualWaiting)>0))?'danger':delayed.length||paused.length?'warn':playingRows.length?'live':'ready';stateBadge.dataset.state=level;stateBadge.textContent=level==='danger'?'즉시 확인 필요':level==='warn'?'운영 확인 필요':level==='live'?'경기 진행 중':'운영 대기';}
  const alertRoot=document.getElementById('stage331AlertList');
  if(alertRoot)alertRoot.innerHTML=alerts.length?alerts.slice(0,8).map(a=>`<button type="button" class="stage331-list-item ${a.level}" data-portal-go="operation"><span>${a.level==='danger'?'!':'△'}</span><div><strong>${portalEscape(a.title)}</strong><small>${portalEscape(a.detail)}</small></div></button>`).join(''):'<div class="stage331-empty-ok">✓ 현재 우선 확인할 운영 항목이 없습니다.</div>';
  const playingRoot=document.getElementById('stage331PlayingList');
  if(playingRoot)playingRoot.innerHTML=playingRows.length?playingRows.slice(0,8).map(x=>`<button type="button" class="stage331-list-item" data-portal-go="operation"><span>🎾</span><div><strong>${portalEscape(x.court.name||x.court.id)} · ${portalEscape(stage331TeamLabel(x.match))}</strong><small>진행 ${elapsedMinutes(x.match)}분${x.court.wait1?' · 대기1 있음':' · 대기1 없음'}</small></div></button>`).join(''):'<div class="stage331-empty">현재 시합중인 경기가 없습니다.</div>';
  const resultHistory=Array.isArray(state.operation?.resultChangeHistory)?state.operation.resultChangeHistory:[];
  set('stage332ResultHistoryCount',`${resultHistory.length}건`);
  const historyRoot=document.getElementById('stage332ResultHistoryList');
  if(historyRoot)historyRoot.innerHTML=resultHistory.length?resultHistory.slice(0,6).map(h=>`<div class="stage332-history-item ${h.corrected?'corrected':''}"><span>${h.corrected?'✏️':'✓'}</span><div><strong>${portalEscape(h.teamA)} ${Number(h.scoreA)} : ${Number(h.scoreB)} ${portalEscape(h.teamB)}</strong><small>${h.corrected?'결과 수정':'결과 확정'} · 승리 ${portalEscape(h.winner)} · ${new Date(h.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</small></div></div>`).join(''):'<div class="stage331-empty">아직 입력된 경기 결과가 없습니다.</div>';
}

function tournamentSelectorLabels(records){
  const rows=(Array.isArray(records)?records:[]).map((r,index)=>{
    const snap=r?.snapshot||{};
    const name=String(r?.name||snap?.tournament?.name||'이름 없는 대회').trim();
    const division=String(r?.division||snap?.tournament?.division||'').trim();
    const date=String(snap?.portal?.guide?.date||r?.date||'').trim();
    return {record:r,index,name,division,date};
  });
  const counts=new Map();
  rows.forEach(x=>counts.set(x.name,(counts.get(x.name)||0)+1));
  const used=new Map();
  return rows.map(x=>{
    const duplicate=(counts.get(x.name)||0)>1;
    let suffix='';
    if(x.division)suffix+=` · ${x.division}`;
    if(x.date)suffix+=` · ${x.date}`;
    if(duplicate&&!suffix){const n=(used.get(x.name)||0)+1;used.set(x.name,n);suffix=` · ${n}`;}
    return {record:x.record,label:`${x.name}${suffix}`};
  });
}

function renderHomeTournamentCards(){
  const root=document.getElementById('homeTournamentCardList');
  if(!root)return;
  ensureMultiTournamentRuntime();
  const records=(state.multiTournament?.tournaments||[]).filter(r=>isRealTournamentName(r?.name||r?.snapshot?.tournament?.name));
  if(!records.length){
    root.innerHTML='<div class="home-tournament-empty">등록된 운영 대회가 없습니다. 대회 목록에서 새 대회를 만들어 주세요.</div>';
    return;
  }
  const labels=new Map(tournamentSelectorLabels(records).map(x=>[String(x.record.id),x.label]));
  root.innerHTML=records.map(r=>{
    const id=String(r.id||'');
    const snap=r.snapshot||{};
    const current=id===String(state.multiTournament?.activeTournamentId||'');
    const name=String(r.name||snap?.tournament?.name||'이름 없는 대회');
    const division=String(r.division||snap?.tournament?.division||'부서 미설정');
    const date=String(snap?.portal?.guide?.date||'');
    const venue=String(snap?.portal?.guide?.venue||'');
    return `<article class="home-tournament-card ${current?'current':''}" data-home-tournament-id="${portalEscape(id)}"><div><span class="tournament-state ${current?'ongoing':'recruiting'}">${current?'현재 선택':'운영 대회'}</span><h3>${portalEscape(labels.get(id)||name)}</h3><div class="meta">${portalEscape(division)}${date?` · ${portalEscape(date)}`:''}${venue?` · ${portalEscape(venue)}`:''}</div></div><div class="actions"><button type="button" class="btn btn-primary" data-guide-tournament-id="${portalEscape(id)}">요강 보기</button><button type="button" class="btn ${current?'btn-primary':'btn-light'}" data-home-tournament-select="${portalEscape(id)}" ${current?'disabled':''}>${current?'선택됨':'이 대회 선택'}</button>${isAdmin()?`<button type="button" class="btn btn-light" data-admin-only="true" data-home-tournament-edit="${portalEscape(id)}">수정·편집</button><button type="button" class="btn btn-danger-outline" data-admin-only="true" data-home-tournament-delete="${portalEscape(id)}">삭제</button>`:''}</div></article>`;
  }).join('');
}

function renderPortalViews(){
  renderBackupRecoveryManager();
  renderTournamentReadiness();
  ensurePortalState();
  renderHomeTournamentCards();
  renderStage331OperationDashboard();
  renderPublicPrelimGroups();
  renderParticipantManager();
  renderPublicParticipantRecords();
  renderApplicationPortal();
  const prelim=state.prelim?.matches||[];const main=portalMainMatches();const courts=portalCourtRows();
  const pDone=prelim.filter(x=>x.status==='completed').length,mDone=main.filter(x=>x.status==='completed').length;
  const playing=courts.filter(x=>x.playing).length;const waiting=courts.reduce((n,x)=>n+(x.wait1?1:0)+(x.queue?.length||0)+(x.manualQueue?.length||0),0)+(state.sharedQueue?.length||0)+Object.values(state.venueQueues||{}).reduce((n,q)=>n+(q?.length||0),0);
  const setText=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setText('homeTournamentName',state.tournament?.name||'대회 준비 중');setText('homeTournamentDivision',state.tournament?.division||'종목 미설정');setText('homePrelimStatus',`${pDone} / ${prelim.length}`);setText('homeMainStatus',`${mDone} / ${main.length}`);setText('homePlayingCourts',playing);setText('homeWaitingMatches',waiting);
  const posts=visibleBoardPosts({admin:isAdmin()});const publicPosts=visibleBoardPosts();
  const home=document.getElementById('homeNoticeList');if(home)home.innerHTML=publicPosts.slice(0,4).map(p=>`<button type="button" class="portal-list-item notice-home-item" data-portal-go="board"><strong>${p.important?'🚨 ':p.pinned?'📌 ':''}${portalEscape(p.title)}</strong><div class="portal-meta">${new Date(p.updatedAt||p.createdAt).toLocaleDateString('ko-KR')}</div></button>`).join('')||'<div class="portal-empty">등록된 공지가 없습니다.</div>';
  const board=document.getElementById('boardPostList');if(board)board.innerHTML=posts.map(p=>{const status=boardPostStatus(p);const statusText=status==='scheduled'?'게시 예정':status==='expired'?'게시 종료':'게시 중';const popupPeriod=(p.popupStartAt||p.popupEndAt)?`<div class="portal-meta notice-period">팝업기간 · ${p.popupStartAt?new Date(p.popupStartAt).toLocaleString('ko-KR'):'즉시'} ~ ${p.popupEndAt?new Date(p.popupEndAt).toLocaleString('ko-KR'):'계속'}</div>`:'';const postImage=stage6109ImageSrc(p);const image=postImage?`<div class="portal-board-image-wrap"><img class="portal-board-image" src="${postImage}" alt="${portalEscape(p.title)} 공지 이미지" loading="lazy"><div class="portal-board-image-actions"><a class="btn btn-light btn-small" href="${postImage}" download="${portalEscape(p.imageName||'공지이미지')}">이미지 다운로드</a></div></div>`:'';return `<article class="portal-board-item ${p.important?'important':''}"><div class="portal-meta notice-meta-row"><span>${p.pinned?'상단 고정 · ':''}${new Date(p.updatedAt||p.createdAt).toLocaleString('ko-KR')}</span><span class="notice-status ${status}">${statusText}${p.popup?' · 홈 팝업':''}</span></div><h3>${p.important?'🚨 ':''}${portalEscape(p.title)}</h3>${image}${p.body?`<div class="portal-board-body">${portalEscape(p.body).replace(/\n/g,'<br>')}</div>`:''}${p.startAt||p.endAt?`<div class="portal-meta notice-period">게시기간 · ${p.startAt?new Date(p.startAt).toLocaleString('ko-KR'):'즉시'} ~ ${p.endAt?new Date(p.endAt).toLocaleString('ko-KR'):'계속'}</div>`:''}${popupPeriod}${isAdmin()?`<div class="portal-board-actions"><button type="button" class="btn btn-light" data-board-edit="${p.id}">수정</button><button type="button" class="btn btn-danger-outline" data-board-delete="${p.id}">삭제</button></div>`:''}</article>`;}).join('')||'<div class="portal-empty">등록된 게시물이 없습니다.</div>';
  const summary=document.getElementById('homeCourtSummary');if(summary){const rows=courts.filter(c=>c.playing||c.wait1).slice(0,12);summary.innerHTML=rows.map(c=>{const play=findUnifiedMatch(state,c.playing)||findPrelimMatch(state,c.playing)||findMatch(state.draw,c.playing);const wait=findUnifiedMatch(state,c.wait1)||findPrelimMatch(state,c.wait1)||findMatch(state.draw,c.wait1);return `<article class="portal-court-item"><strong>${portalEscape(c.name||c.id)}</strong><div>시합중 · ${play?portalEscape(portalTeam(play.teamA))+' vs '+portalEscape(portalTeam(play.teamB)):'없음'}</div><div class="portal-meta">대기1 · ${wait?portalEscape(portalTeam(wait.teamA))+' vs '+portalEscape(portalTeam(wait.teamB)):'없음'}</div></article>`;}).join('')||'<div class="portal-empty">현재 배정된 경기가 없습니다.</div>';}
  renderResultArchive();
  renderTournamentGuide();
  renderTournamentList();
}
function stage6109ImageSrc(record){return managedImageUrl(record);}
function renderTournamentGuide(){
  const guide=state.portal.guide||{};
  const teams=state.teams||[];
  const active=teams.filter(team=>team.status!=='reserve').length;
  const reserve=teams.filter(team=>team.status==='reserve').length;
  const capacity=Number(state.prelim?.settings?.activeTeamCount||0);
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  const name=state.tournament?.name||'대회 준비 중';
  const division=state.tournament?.division||'종목 미설정';
  set('guideTournamentName',name);
  set('guideTournamentMeta',`${division} · 참가 ${active}팀${reserve?` · 후보 ${reserve}팀`:''}`);
  set('guideNameValue',name);set('guideDivisionValue',division);
  set('guideDateValue',guide.date?new Date(`${guide.date}T00:00:00`).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'}):'미정');
  set('guideVenueValue',guide.venue||'미정');
  set('guideCapacityValue',capacity?`정원 ${capacity}팀 · 현재 ${active}팀${reserve?` · 후보 ${reserve}팀`:''}`:`현재 ${active}팀${reserve?` · 후보 ${reserve}팀`:''}`);
  set('guideFormatValue',guide.matchFormat||'예선 조별리그 후 본선 토너먼트');
  set('guideFeeValue',guide.fee||'미설정');set('guideBankValue',guide.bank||'미설정');set('guideAccountValue',guide.account||'미설정');set('guidePaymentNote',guide.paymentNote||'입금 확인 후 참가 확정됩니다.');
  set('guideOrganizerValue',guide.organizer||'미설정');
  set('guideEntryPeriodValue',guide.entryPeriod||'미설정');
  set('guideEligibilityValue',guide.eligibility||'미설정');
  set('guideMatchFormatValue',guide.matchFormat||'미설정');
  set('guideAwardsValue',guide.awards||'미설정');
  set('guideRefundPolicyValue',guide.refundPolicy||'미설정');
  set('guideContactValue',guide.contact||'미설정');
  set('guideExtraValue',guide.extra||'미설정');
  const detail=document.getElementById('guideDetailText');if(detail)detail.innerHTML=guide.detail?portalEscape(guide.detail).replace(/\n/g,'<br>'):'등록된 세부 요강이 없습니다.';
  const imageSection=document.getElementById('guideImageSection');
  const guideView=document.getElementById('view-guide');
  // 이미지 요강이 있으면 요강 화면의 첫 콘텐츠로 고정한다. 포스터 한 장에 전체 내용이 들어있는 운영 방식을 우선한다.
  if(imageSection&&guideView&&guideView.firstElementChild!==imageSection)guideView.insertAdjacentElement('afterbegin',imageSection);
  const imagePreview=document.getElementById('guideImagePreview');
  const imageDownload=document.getElementById('guideImageDownload');
  const guideImageSrc=stage6109ImageSrc(guide);
  if(guideImageSrc){
    if(imageSection)imageSection.hidden=false;
    if(imagePreview)imagePreview.src=guideImageSrc;
    if(imageDownload){imageDownload.href=guideImageSrc;imageDownload.download=guide.imageName||`${name}-요강.${guide.imageType==='image/png'?'png':guide.imageType==='image/webp'?'webp':'jpg'}`;}
  }else{
    if(imageSection)imageSection.hidden=true;
    if(imagePreview)imagePreview.removeAttribute('src');
    if(imageDownload)imageDownload.href='#';
  }
  const badge=document.getElementById('guideStatusBadge');if(badge){const completed=Boolean(state.completion?.completedAt||state.tournament?.completedAt);badge.textContent=completed?'종료':capacity&&active>=capacity?'접수마감':'접수중';badge.className=`badge ${completed?'badge-muted':capacity&&active>=capacity?'badge-danger':'badge-warning'}`;}
}

function stage3610FocusGuideImage(){
  const section=document.getElementById('guideImageSection');
  const img=document.getElementById('guideImagePreview');
  if(section&&!section.hidden){setTimeout(()=>section.scrollIntoView({behavior:'smooth',block:'start'}),60);if(img)img.title='클릭하면 원본 크기로 새 창에서 봅니다.';}
}
async function stage3610OpenTournamentGuide(id=''){
  const targetId=String(id||'').trim();
  const currentId=String(state.multiTournament?.activeTournamentId||state.tournament?.id||'');
  if(targetId&&targetId!==currentId){
    try{switchTournamentWorkspace(targetId);}catch(error){notice('대회 요강을 불러오지 못했습니다: '+(error?.message||error),'error');return false;}
  }
  renderTournamentGuide();
  const opened=navigatePortalView('guide',{pushHistory:true,focus:true});
  if(!opened||document.body.dataset.currentView!=='guide'||!document.getElementById('view-guide')?.classList.contains('active')){
    console.error('[230MATCH 61.1.3] guide route activation failed');
    notice('대회 요강 화면을 열지 못했습니다. 화면 이동 상태를 다시 확인해 주세요.','error');
    return false;
  }
  stage3610FocusGuideImage();
  return true;
}
function openTournamentGuideEditor(){
  if(!requireAdmin('대회 요강 수정'))return;
  const guide=state.portal.guide||{};
  const map={guideDateInput:guide.date||'',guideVenueInput:guide.venue||'',guideFeeInput:guide.fee||'',guideBankInput:guide.bank||'',guideAccountInput:guide.account||'',guideOrganizerInput:guide.organizer||'',guideEntryPeriodInput:guide.entryPeriod||'',guideEligibilityInput:guide.eligibility||'',guideMatchFormatInput:guide.matchFormat||'',guideAwardsInput:guide.awards||'',guideRefundPolicyInput:guide.refundPolicy||'',guideContactInput:guide.contact||'',guideExtraInput:guide.extra||'',guidePaymentNoteInput:guide.paymentNote||'',guideDetailInput:guide.detail||''};
  Object.entries(map).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.value=value;});
  stage328PendingGuideImage=stage6109ImageSrc(guide);
  stage328PendingGuideImageName=guide.imageName||'';
  stage328PendingGuideImageType=guide.imageType||'';
  stage328PendingGuideStoragePath=guide.imageStoragePath||'';
  stage328RenderGuideImageEditorPreview();
  const imageInput=document.getElementById('guideImageInput');if(imageInput)imageInput.value='';
  const editor=document.getElementById('tournamentGuideEditor');if(editor)editor.hidden=false;
}
async function saveTournamentGuide(){
  if(!requireAdmin('대회 요강 저장'))return;
  const val=id=>String(document.getElementById(id)?.value||'').trim();
  const previous=state.portal.guide||{};
  // Save text first. Image transport must never cancel the user's other edits.
  const baseGuide={...previous,date:val('guideDateInput'),venue:val('guideVenueInput'),fee:val('guideFeeInput'),bank:val('guideBankInput'),account:val('guideAccountInput'),organizer:val('guideOrganizerInput'),entryPeriod:val('guideEntryPeriodInput'),eligibility:val('guideEligibilityInput'),matchFormat:val('guideMatchFormatInput'),awards:val('guideAwardsInput'),refundPolicy:val('guideRefundPolicyInput'),contact:val('guideContactInput'),extra:val('guideExtraInput'),paymentNote:val('guidePaymentNoteInput'),detail:val('guideDetailInput')};
  state.portal.guide=baseGuide;saveState(state);
  try{await pushStateNow(state);}catch(error){notice(`요강 텍스트 저장 실패: ${error?.message||error}`,'error');return;}
  let imageError='';
  try{
    if(String(stage328PendingGuideImage||'').startsWith('data:image/')){
      notice('요강 이미지를 Firebase Storage에 업로드하고 있습니다.','info');
      const uploaded=await uploadManagedImage({folder:'tournamentGuides',ownerId:state.tournament?.id||state.multiTournament?.activeTournamentId||'tournament',dataUrl:stage328PendingGuideImage,fileName:stage328PendingGuideImageName,contentType:stage328PendingGuideImageType,previousPath:previous.imageStoragePath||''});
      state.portal.guide={...baseGuide,imageUrl:uploaded.url||'',imageStoragePath:uploaded.path||'',imageDataUrl:'',imageName:uploaded.name||stage328PendingGuideImageName||'',imageType:uploaded.type||stage328PendingGuideImageType||''};stage328PendingGuideImage=uploaded.url||'';stage328PendingGuideStoragePath=uploaded.path||'';saveState(state);await pushStateNow(state);
    }else if(!stage328PendingGuideImage&&previous.imageStoragePath){
      state.portal.guide={...baseGuide,imageUrl:'',imageStoragePath:'',imageDataUrl:'',imageName:'',imageType:''};saveState(state);await pushStateNow(state);void deleteManagedImage(previous.imageStoragePath);
    }
  }catch(error){imageError=error?.message||String(error);}
  const editor=document.getElementById('tournamentGuideEditor');if(editor&&!imageError)editor.hidden=true;
  renderTournamentGuide();
  if(imageError)notice(`요강 글 내용은 저장되었습니다. 이미지 업로드만 실패했습니다: ${imageError}`,'error');
  else notice(stage328PendingGuideImage?'대회 요강과 이미지를 저장했습니다.':'대회 요강을 저장했습니다.','success');
}
async function copyTournamentGuideAccount(){
  const guide=state.portal.guide||{};const text=[guide.bank,guide.account].filter(Boolean).join(' ');
  if(!text){notice('등록된 입금 계좌가 없습니다.','error');return;}
  try{await navigator.clipboard.writeText(text);notice('입금 계좌를 복사했습니다.','success');}
  catch(_error){prompt('아래 계좌를 복사하세요.',text);}
}
function boardDateValue(value){if(!value)return '';const date=new Date(value);if(Number.isNaN(date.getTime()))return '';const pad=n=>String(n).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;}
function boardPostStatus(post,now=Date.now()){const start=post.startAt?new Date(post.startAt).getTime():0,end=post.endAt?new Date(post.endAt).getTime():0;if(start&&start>now)return 'scheduled';if(end&&end<now)return 'expired';return 'active';}
function visibleBoardPosts({admin=false}={}){return [...(state.portal?.posts||[])].filter(p=>admin||boardPostStatus(p)==='active').sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||(b.important?1:0)-(a.important?1:0)||String(b.createdAt).localeCompare(String(a.createdAt)));}
let stage4108PendingNoticeImage='';
let stage4108PendingNoticeImageName='';
let stage4108PendingNoticeImageType='';
let stage4108PendingNoticeStoragePath='';
function stage4108RenderNoticeImagePreview(){const wrap=document.getElementById('boardPostImagePreviewWrap'),img=document.getElementById('boardPostImagePreview');if(!wrap||!img)return;wrap.hidden=!stage4108PendingNoticeImage;if(stage4108PendingNoticeImage)img.src=stage4108PendingNoticeImage;else img.removeAttribute('src');}
async function stage4108CompressNoticeImage(file){if(!file?.type?.startsWith('image/'))throw new Error('이미지 파일만 첨부할 수 있습니다.');if(file.size>12*1024*1024)throw new Error('원본 이미지는 12MB 이하만 사용할 수 있습니다.');const bitmap=await createImageBitmap(file);const max=1600,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();let quality=.82,data=canvas.toDataURL('image/webp',quality);while(data.length>260000&&quality>.46){quality-=.06;data=canvas.toDataURL('image/webp',quality);}if(data.length>320000)throw new Error('공지 이미지가 너무 큽니다. 세로·가로 1600px 이하 이미지로 다시 선택해 주세요.');const type='image/webp';return {dataUrl:data,type,name:stage328SafeFileName(file.name,type)};}
async function stage4108HandleNoticeImage(file){try{notice('공지 이미지를 화면용으로 최적화하고 있습니다.','info');const out=await stage4108CompressNoticeImage(file);stage4108PendingNoticeImage=out.dataUrl;stage4108PendingNoticeImageName=out.name;stage4108PendingNoticeImageType=out.type;stage4108RenderNoticeImagePreview();notice('공지 이미지를 첨부했습니다. 공지 저장을 눌러 완료하세요.','success');}catch(error){notice(error.message||'공지 이미지 첨부에 실패했습니다.','error');}}
function clearBoardPostForm(){['boardPostEditId','boardPostTitle','boardPostBody','boardPostStartAt','boardPostEndAt','boardPostPopupStartAt','boardPostPopupEndAt'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});['boardPostPinned','boardPostImportant','boardPostPopup'].forEach(id=>{const el=document.getElementById(id);if(el)el.checked=false;});stage4108PendingNoticeImage='';stage4108PendingNoticeImageName='';stage4108PendingNoticeImageType='';stage4108PendingNoticeStoragePath='';stage4108RenderNoticeImagePreview();const input=document.getElementById('boardPostImageInput');if(input)input.value='';const form=document.getElementById('boardPostForm');if(form)form.hidden=true;}
function openBoardPostEditor(post=null){if(!requireAdmin(post?'공지 수정':'새 공지 작성'))return;const form=document.getElementById('boardPostForm');if(!form)return;form.hidden=false;document.getElementById('boardPostEditId').value=post?.id||'';document.getElementById('boardPostTitle').value=post?.title||'';document.getElementById('boardPostBody').value=post?.body||'';document.getElementById('boardPostPinned').checked=Boolean(post?.pinned);document.getElementById('boardPostImportant').checked=Boolean(post?.important);document.getElementById('boardPostPopup').checked=Boolean(post?.popup);document.getElementById('boardPostStartAt').value=boardDateValue(post?.startAt);document.getElementById('boardPostEndAt').value=boardDateValue(post?.endAt);document.getElementById('boardPostPopupStartAt').value=boardDateValue(post?.popupStartAt);document.getElementById('boardPostPopupEndAt').value=boardDateValue(post?.popupEndAt);stage4108PendingNoticeImage=stage6109ImageSrc(post||{});stage4108PendingNoticeImageName=post?.imageName||'';stage4108PendingNoticeImageType=post?.imageType||'';stage4108PendingNoticeStoragePath=post?.imageStoragePath||'';stage4108RenderNoticeImagePreview();const imageInput=document.getElementById('boardPostImageInput');if(imageInput)imageInput.value='';form.scrollIntoView({behavior:'smooth',block:'start'});}
async function saveBoardPost(){
  if(!requireAdmin('게시판 공지 저장'))return;
  const value=id=>String(document.getElementById(id)?.value||'').trim();
  const editId=value('boardPostEditId'),title=value('boardPostTitle'),body=value('boardPostBody'),startAt=value('boardPostStartAt'),endAt=value('boardPostEndAt'),popupStartAt=value('boardPostPopupStartAt'),popupEndAt=value('boardPostPopupEndAt');
  if(!title||(!body&&!stage4108PendingNoticeImage)){notice('제목과 내용 또는 이미지를 입력하세요.','error');return;}
  if(startAt&&endAt&&new Date(startAt)>=new Date(endAt)){notice('게시 종료는 게시 시작보다 뒤여야 합니다.','error');return;}
  if(popupStartAt&&popupEndAt&&new Date(popupStartAt)>=new Date(popupEndAt)){notice('팝업 종료는 팝업 시작보다 뒤여야 합니다.','error');return;}
  const postId=editId||crypto.randomUUID();const current=state.portal.posts.find(p=>p.id===editId);let imageUrl=stage4108PendingNoticeImage||'',imageStoragePath=stage4108PendingNoticeStoragePath||'',imageDataUrl='';
  try{
    if(String(stage4108PendingNoticeImage||'').startsWith('data:image/')){
      notice('공지 이미지를 Firebase Storage에 업로드하고 있습니다.','info');
      const uploaded=await uploadManagedImage({folder:'noticePosts',ownerId:state.tournament?.id||state.multiTournament?.activeTournamentId||'tournament',itemId:postId,dataUrl:stage4108PendingNoticeImage,fileName:stage4108PendingNoticeImageName,contentType:stage4108PendingNoticeImageType,previousPath:current?.imageStoragePath||''});
      imageUrl=uploaded.url;imageStoragePath=uploaded.path;stage4108PendingNoticeImage=uploaded.url;stage4108PendingNoticeStoragePath=uploaded.path;
    }else if(!stage4108PendingNoticeImage&&current?.imageStoragePath){await deleteManagedImage(current.imageStoragePath);imageStoragePath='';}
    else if(String(stage4108PendingNoticeImage||'').startsWith('data:'))imageDataUrl=stage4108PendingNoticeImage;
  }catch(error){notice(`공지 이미지 업로드 실패: ${error?.message||error}`,'error');return;}
  const payload={title,body,pinned:Boolean(document.getElementById('boardPostPinned')?.checked),important:Boolean(document.getElementById('boardPostImportant')?.checked),popup:Boolean(document.getElementById('boardPostPopup')?.checked),startAt,endAt,popupStartAt,popupEndAt,imageUrl:imageUrl&&!String(imageUrl).startsWith('data:')?imageUrl:'',imageStoragePath,imageDataUrl,imageName:stage4108PendingNoticeImageName||'',imageType:stage4108PendingNoticeImageType||'',updatedAt:new Date().toISOString()};
  if(current){Object.assign(current,payload);commit(`게시판 공지 수정 · ${title}`);notice('공지를 수정했습니다.','success');}
  else{state.portal.posts.unshift({id:postId,...payload,createdAt:new Date().toISOString()});commit(`게시판 공지 등록 · ${title}`);notice('공지를 등록했습니다.','success');}
  const open=document.getElementById('homeNoticePopup');if(open?.open&&open.dataset.postId===editId&&!payload.popup)open.close();clearBoardPostForm();renderPortalViews();renderPopupManager();showEligibleHomePopup();
}
function popupDismissKey(post){return `230match-notice-dismiss-${post.id}-${new Date().toISOString().slice(0,10)}`;}
function popupPostStatus(post,now=Date.now()){const start=post.popupStartAt?new Date(post.popupStartAt).getTime():(post.startAt?new Date(post.startAt).getTime():0),end=post.popupEndAt?new Date(post.popupEndAt).getTime():(post.endAt?new Date(post.endAt).getTime():0);if(start&&start>now)return 'scheduled';if(end&&end<now)return 'expired';return 'active';}
function closeHomeNoticePopup(){const dialog=document.getElementById('homeNoticePopup');const id=dialog?.dataset.postId;if(id&&document.getElementById('homeNoticePopupDismiss')?.checked)localStorage.setItem(popupDismissKey({id}),'1');if(dialog?.open)dialog.close();}
function showEligibleHomePopup(){if(document.body.dataset.currentView!=='home')return;const post=visibleBoardPosts().find(p=>p.popup&&popupPostStatus(p)==='active'&&!localStorage.getItem(popupDismissKey(p)));const dialog=document.getElementById('homeNoticePopup');if(!post||!dialog||dialog.open)return;dialog.dataset.postId=post.id;document.getElementById('homeNoticePopupBadge').textContent=post.important?'중요 공지':'대회 공지';document.getElementById('homeNoticePopupTitle').textContent=post.title;const body=document.getElementById('homeNoticePopupBody');if(body){body.innerHTML=post.body?portalEscape(post.body).replace(/\n/g,'<br>'):'';body.hidden=!post.body;}const img=document.getElementById('homeNoticePopupImage');if(img){const postImage=stage6109ImageSrc(post);img.hidden=!postImage;if(postImage)img.src=postImage;else img.removeAttribute('src');}document.getElementById('homeNoticePopupDismiss').checked=false;dialog.showModal();}
function renderPopupManager(){const root=document.getElementById('popupManagerList');if(!root)return;const rows=[...(state.portal?.posts||[])].sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)));root.innerHTML=rows.map(p=>{const st=popupPostStatus(p),label=st==='scheduled'?'예정':st==='expired'?'종료':'현재';return `<article class="popup-manager-item" data-popup-manager-id="${p.id}"><div class="popup-manager-item-head"><div><strong>${portalEscape(p.title)}</strong><div class="portal-meta">${p.popup?'홈 팝업 ON':'홈 팝업 OFF'} · ${label}</div></div>${stage6109ImageSrc(p)?`<img class="popup-manager-thumb" src="${stage6109ImageSrc(p)}" alt="공지 이미지">`:''}</div><div class="popup-manager-controls"><label class="form-check"><input type="checkbox" data-popup-enabled ${p.popup?'checked':''}><span>홈 팝업 표시</span></label><label><span>팝업 시작</span><input type="datetime-local" data-popup-start value="${boardDateValue(p.popupStartAt)}"></label><label><span>팝업 종료</span><input type="datetime-local" data-popup-end value="${boardDateValue(p.popupEndAt)}"></label><button type="button" class="btn btn-primary btn-small" data-popup-save>저장</button></div></article>`;}).join('')||'<div class="portal-empty">등록된 공지가 없습니다. 먼저 공지사항을 작성하세요.</div>';}
function openPopupManager(){if(!requireAdmin('홈 팝업 관리'))return;renderPopupManager();document.getElementById('popupManagerDialog')?.showModal();}
function closePopupManager(){const d=document.getElementById('popupManagerDialog');if(d?.open)d.close();}
function savePopupManagerItem(article){const id=article?.dataset.popupManagerId,post=state.portal.posts.find(p=>p.id===id);if(!post)return;const enabled=Boolean(article.querySelector('[data-popup-enabled]')?.checked),start=String(article.querySelector('[data-popup-start]')?.value||''),end=String(article.querySelector('[data-popup-end]')?.value||'');if(start&&end&&new Date(start)>=new Date(end)){notice('팝업 종료는 시작보다 뒤여야 합니다.','error');return;}post.popup=enabled;post.popupStartAt=start;post.popupEndAt=end;post.updatedAt=new Date().toISOString();commit(`홈 팝업 설정 저장 · ${post.title}`);renderPopupManager();renderPortalViews();if(!enabled){const d=document.getElementById('homeNoticePopup');if(d?.open&&d.dataset.postId===id)d.close();}showEligibleHomePopup();notice(enabled?'홈 팝업 설정을 저장했습니다.':'홈 팝업 표시를 해제했습니다.','success');}


function tournamentLifecycle(){
  const prelim=state.prelim?.matches||[],main=portalMainMatches();
  const all=[...prelim,...main],completed=all.length>0&&all.every(x=>x.status==='completed');
  if(completed||state.completion?.completedAt)return 'completed';
  if(all.some(x=>['playing','completed'].includes(x.status)))return 'ongoing';
  return 'recruiting';
}
function tournamentStatusLabel(status){return status==='completed'?'종료':status==='ongoing'?'진행중':'접수중';}
function currentTournamentSnapshot(){
  const name=String(state.tournament?.name||'').trim();
  const noActive=Boolean(state.multiTournament?.noActiveTournament)||!isRealTournamentName(name);
  if(noActive)return {id:'',current:false,empty:true,name:'',division:'',status:'empty'};
  const teams=state.teams||[],active=teams.filter(x=>x.status!=='reserve').length,reserve=teams.filter(x=>x.status==='reserve').length;
  const prelim=state.prelim?.matches||[],main=portalMainMatches(),podium=currentPodium(),guide=state.portal?.guide||{};
  return {id:String(state.tournament?.id||state.multiTournament?.activeTournamentId||'current'),current:true,empty:false,name,division:state.tournament?.division||'',date:guide.date||'',venue:guide.venue||'',fee:guide.fee||'',capacity:Number(state.prelim?.settings?.activeTeamCount||0),active,reserve,status:tournamentLifecycle(),champion:podium.champion||'',runnerUp:podium.runnerUp||'',thirds:podium.thirds||[],prelimCompleted:prelim.filter(x=>x.status==='completed').length,prelimTotal:prelim.length,mainCompleted:main.filter(x=>x.status==='completed').length,mainTotal:main.length,detail:guide.detail||'',updatedAt:state.updatedAt||new Date().toISOString()};
}
function tournamentArchiveRows(){
  try{ensureMultiTournamentRuntime();syncCurrentTournamentRuntime();}catch(_e){}
  const registry=Array.isArray(state.multiTournament?.tournaments)?state.multiTournament.tournaments:[];
  const activeId=String(state.multiTournament?.activeTournamentId||state.tournament?.id||'');
  const active=registry.map(record=>{
    const id=String(record?.id||'');
    const isCurrent=id===activeId;
    const ws=isCurrent?state:(record?.snapshot||null);
    const name=String(ws?.tournament?.name||record?.name||'').trim();
    if(!isRealTournamentName(name))return null;
    const fallback={tournament:{id,name,division:record?.division||''},portal:{guide:record?.guide||{}},teams:[],prelim:{matches:[],settings:{}},draw:{rounds:{}},updatedAt:record?.updatedAt||record?.createdAt||new Date().toISOString()};
    const summary=tournamentSummaryFromWorkspace(ws||fallback,id,isCurrent)||tournamentSummaryFromWorkspace(fallback,id,isCurrent);
    if(!summary)return null;
    summary.id=id;summary.current=isCurrent;summary.workspace=true;summary.name=name;summary.division=summary.division||record?.division||'';
    return summary;
  }).filter(Boolean);
  const modern=(state.portal?.archives||[]).map(archiveListItem);
  const legacy=(state.portal?.tournamentArchives||[]).filter(x=>!modern.some(m=>m.id===x.id));
  return [...active,...modern,...legacy];
}
function archiveCurrentTournament(){
  if(!requireAdmin('현재 대회 종료·보관'))return;
  const check=validateTournamentForArchive(state);
  if(!check.ok){notice(check.errors.join(' '),'error');return;}
  const warning=check.warnings.length?`\n\n주의: ${check.warnings.join(' ')}`:'';
  if(!confirm(`현재 대회를 종료하고 읽기 전용 기록으로 보관할까요?\n\n부서 ${check.counts.divisions}개 · 참가팀 ${check.counts.teams}팀 · 예선 ${check.counts.prelim}경기 · 본선 ${check.counts.main}경기${warning}`))return;
  if(check.counts.unfinished>0&&!requireTypedConfirmation('미완료 경기가 있는 대회 강제 보관','강제보관'))return;
  const archive=createTournamentArchive(state,{force:check.counts.unfinished>0,reason:check.counts.unfinished>0?'forced-manual':'completed-manual'});
  const same=(state.portal.archives||[]).findIndex(x=>x.tournamentId===archive.tournamentId);
  if(same>=0){notice('이미 보관된 대회입니다. 읽기 전용 기록은 덮어쓰지 않습니다.','warning');return;}
  state.portal.archives.unshift(archive);
  state.operation=state.operation||{};state.operation.tournamentCompletedAt=state.operation.tournamentCompletedAt||archive.archivedAt;state.operation.archiveId=archive.archiveId;state.operation.autoAssignmentEnabled=false;
  state.portal.tournamentArchives=(state.portal.tournamentArchives||[]).filter(x=>String(x.sourceTournamentId||x.tournamentId||'')!==String(archive.tournamentId));
  state.portal.tournamentArchives.unshift(archiveListItem(archive));
  commit(`대회 종료·읽기 전용 보관 · ${archive.tournament.name}`);renderTournamentList();
  downloadJson(`${safeFilePart(archive.tournament.name)}-${safeFilePart(archive.tournament.division||'전체')}-종료기록.json`,archiveBackupPayload(archive));
  notice('대회 전체 기록을 읽기 전용으로 보관하고 JSON 백업도 저장했습니다.','success');
}

async function deleteCurrentTournamentSafely(){
  if(!requireAdmin('현재 대회 삭제'))return;
  const snap=currentTournamentSnapshot();
  if(!confirm(`현재 대회 “${snap.name}”를 완전히 삭제할까요?\n\n참가팀·예선·본선·코트 데이터가 함께 삭제됩니다.\n보관된 지난 대회 기록은 유지됩니다.`))return;
  const typed=prompt('삭제하려면 “대회삭제”를 입력하세요.','');
  if(typed!=='대회삭제'){notice('확인 문구가 일치하지 않아 취소했습니다.','warning');return;}
  try{
    await prepareCriticalCloudWrite();
    const activeId=String(state.tournament?.id||state.multiTournament?.activeTournamentId||'');
    const registry=Array.isArray(state.multiTournament?.tournaments)?state.multiTournament.tournaments:[];
    const remaining=registry.filter(x=>String(x.id)!==activeId);
    if(remaining.length){
      const nextRec=remaining[0];
      const next=structuredClone(nextRec.snapshot||initialState());
      next.tournament=next.tournament||{};
      next.tournament.id=String(nextRec.id);
      next.multiTournament={activeTournamentId:String(nextRec.id),tournaments:remaining};
      state=next;
    }else{
      const keepPortal=structuredClone(state.portal||{}),keepSettings=structuredClone(state.settings||{}),keepAuth=structuredClone(state.auth||{}),keepOperator=structuredClone(state.operator||{}),keepSync=structuredClone(state.sync||{});
      const next=initialState();
      next.tournament={id:'',name:'',division:''};
      next.multiTournament={activeTournamentId:'',tournaments:[],noActiveTournament:true};
      next.settings={...next.settings,...keepSettings};
      next.portal={...next.portal,tournamentArchives:keepPortal.tournamentArchives||[],resultArchives:keepPortal.resultArchives||[],archives:keepPortal.archives||[],tournamentTemplates:keepPortal.tournamentTemplates||[],posts:keepPortal.posts||[],guide:{date:'',venue:'',fee:'',bank:'',account:'',paymentNote:'',detail:''},applications:[]};
      next.auth=keepAuth;next.operator=keepOperator;next.sync=keepSync;
      state=next;
    }
    ensurePortalState();ensurePrelimState(state);ensureTimeState(state);ensureDrawMeta(state);ensureMessagingState(state);ensureContacts(state);ensureAuditState(state);ensureEarlyMainSettings(state);ensureVenueSettings(state);ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state);ensurePrelimCourtStatuses(state);ensureOperatorState();
    await deleteTournamentNow(activeId,state);
    saveState(state);syncInputs();syncPrelimInputs();renderVenueSettingsEditor();
    render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});
    renderOperatorControls();applyRoleUI();renderPortalViews();renderTournamentLifecycleManager();renderDivisionWorkspaceBar();
    notice('현재 대회를 삭제했습니다.','success');
  }catch(error){notice(`대회 삭제 실패: ${error?.message||error}`,'error');}
}

function renderTournamentDetail(item){
  const panel=document.getElementById('tournamentDetailPanel');if(!panel)return;
  panel.hidden=false;panel.innerHTML=`<div class="section-head"><div><h2>${portalEscape(item.name)}</h2><p>${portalEscape(item.division||'부서 미설정')} · ${tournamentStatusLabel(item.status)}</p></div><button type="button" class="btn btn-light" data-tournament-detail-close>닫기</button></div><div class="tournament-detail-grid"><div><span>대회일</span><b>${item.date?new Date(item.date+'T00:00:00').toLocaleDateString('ko-KR'):'미정'}</b></div><div><span>장소</span><b>${portalEscape(item.venue||'미정')}</b></div><div><span>참가 현황</span><b>${item.active||0}팀${item.reserve?` · 후보 ${item.reserve}팀`:''}</b></div><div><span>본선 진행</span><b>${item.mainCompleted||0}/${item.mainTotal||0}</b></div></div><div class="tournament-detail-podium"><div><span>🏆 우승</span><b>${portalEscape(item.champion||'미확정')}</b></div><div><span>🥈 준우승</span><b>${portalEscape(item.runnerUp||'미확정')}</b></div><div><span>🥉 공동 3위</span><b>${portalEscape((item.thirds||[]).join(' · ')||'미확정')}</b></div></div>${item.detail?`<div class="tournament-detail-text">${portalEscape(item.detail).replace(/\n/g,'<br>')}</div>`:''}<div class="button-row">${item.current?'<button type="button" class="btn btn-primary" data-portal-go="guide">대회 요강</button><button type="button" class="btn btn-light" data-portal-go="entry">참가 신청</button><button type="button" class="btn btn-light" data-portal-go="operation">경기 현황</button>':'<button type="button" class="btn btn-light" data-portal-go="records">전체 결과 기록</button><button type="button" class="btn btn-primary" data-archive-download="'+item.id+'">보관 JSON 저장</button>'}</div>`;
  panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderTournamentList(){
  const rows=tournamentArchiveRows();
  const query=String(document.getElementById('tournamentListSearch')?.value||'').trim().toLowerCase();
  const status=document.getElementById('tournamentListStatus')?.value||'all';
  const visible=rows.filter(x=>(status==='all'||x.status===status)&&(!query||`${x.name} ${x.division} ${x.venue}`.toLowerCase().includes(query)));
  const summary=document.getElementById('tournamentListSummary');
  if(summary){const counts={recruiting:rows.filter(x=>x.status==='recruiting').length,ongoing:rows.filter(x=>x.status==='ongoing').length,completed:rows.filter(x=>x.status==='completed').length};summary.textContent=`전체 ${rows.length}개 · 접수중 ${counts.recruiting} · 진행중 ${counts.ongoing} · 종료 ${counts.completed}`;}
  const root=document.getElementById('tournamentCardList');if(!root)return;
  root.innerHTML=visible.map(x=>`<article class="panel tournament-list-card ${x.current?'current':''}"><div class="tournament-card-top"><div><span class="tournament-state ${x.status}">${x.current?'현재 · ':''}${tournamentStatusLabel(x.status)}</span><h2>${portalEscape(x.name)}</h2><p>${portalEscape(x.division||'부서 미설정')}</p></div>${x.readOnly?'<span class="badge badge-safe">읽기 전용</span>':''}</div><div class="tournament-card-info"><span>📅 ${x.date?new Date(x.date+'T00:00:00').toLocaleDateString('ko-KR'):'일정 미정'}</span><span>📍 ${portalEscape(x.venue||'장소 미정')}</span><span>👥 참가 ${x.active||0}팀${x.reserve?` · 후보 ${x.reserve}팀`:''}</span></div><div class="tournament-card-progress"><div><span>예선</span><b>${x.prelimCompleted||0}/${x.prelimTotal||0}</b></div><div><span>본선</span><b>${x.mainCompleted||0}/${x.mainTotal||0}</b></div><div><span>상태</span><b>${x.current?'현재 선택':x.workspace?'운영 가능':'보관'}</b></div></div>${x.workspace?`<div class="button-row tournament-card-actions"><button type="button" class="btn btn-primary" data-guide-tournament-id="${x.id}">요강 보기</button><button type="button" class="btn ${x.current?'btn-primary':'btn-light'}" data-active-tournament-switch="${x.id}" ${x.current?'disabled':''}>${x.current?'선택됨':'이 대회 선택'}</button>${isAdmin()?`<button type="button" class="btn btn-light" data-admin-only="true" data-edit-tournament-id="${x.id}">대회 수정·편집</button><button type="button" class="btn btn-danger-outline" data-admin-only="true" data-delete-tournament-id="${x.id}">삭제</button>`:''}</div>`:`<button type="button" class="btn btn-light tournament-open-btn" data-tournament-open="${x.id}">대회 기록 보기</button>`}</article>`).join('')||'<div class="panel portal-empty">조건에 맞는 대회가 없습니다.</div>';
}
function bindTournamentList(){
  document.getElementById('archiveTournamentBtn')?.addEventListener('click',archiveCurrentTournament);
  document.getElementById('tournamentListSearch')?.addEventListener('input',renderTournamentList);
  document.getElementById('tournamentListStatus')?.addEventListener('change',renderTournamentList);
  document.getElementById('tournamentListResetBtn')?.addEventListener('click',()=>{const q=document.getElementById('tournamentListSearch'),s=document.getElementById('tournamentListStatus');if(q)q.value='';if(s)s.value='all';renderTournamentList();});
  document.getElementById('tournamentCardList')?.addEventListener('click',async e=>{
    const guideBtn=e.target.closest('[data-guide-tournament-id]');if(guideBtn){e.preventDefault();await stage3610OpenTournamentGuide(guideBtn.dataset.guideTournamentId);return;}
    const select=e.target.closest('[data-active-tournament-switch]');
    if(select){e.preventDefault();switchTournamentWorkspace(select.dataset.activeTournamentSwitch);renderTournamentList();renderDivisionWorkspaceBar();return;}
    const edit=e.target.closest('[data-edit-tournament-id]');
    if(edit){e.preventDefault();const id=edit.dataset.editTournamentId;if(id!==state.multiTournament?.activeTournamentId)switchTournamentWorkspace(id);setTimeout(()=>{renderTournamentList();stage329OpenTournamentEdit();},0);return;}
    const remove=e.target.closest('[data-delete-tournament-id]');
    if(remove){e.preventDefault();await deleteTournamentById(remove.dataset.deleteTournamentId);return;}
    const open=e.target.closest('[data-tournament-open]');if(open){const item=tournamentArchiveRows().find(x=>x.id===open.dataset.tournamentOpen);if(item)renderTournamentDetail(item);return;}
    const currentDel=e.target.closest('[data-current-tournament-delete]');if(currentDel){await deleteCurrentTournamentSafely();return;}
    const del=e.target.closest('[data-tournament-delete]');if(del&&requireAdmin('대회 기록 삭제')){if(!confirm('이 대회 기록을 삭제할까요?'))return;state.portal.tournamentArchives=state.portal.tournamentArchives.filter(x=>x.id!==del.dataset.tournamentDelete);commit('대회 목록 기록 삭제');renderTournamentList();}
  });
  document.getElementById('tournamentDetailPanel')?.addEventListener('click',e=>{if(e.target.closest('[data-tournament-detail-close]'))document.getElementById('tournamentDetailPanel').hidden=true;const btn=e.target.closest('[data-archive-download]');if(btn){const archive=(state.portal?.archives||[]).find(x=>x.archiveId===btn.dataset.archiveDownload);if(archive)downloadJson(`${safeFilePart(archive.tournament?.name||'대회')}-보관기록.json`,archiveBackupPayload(archive));}});
}

function archiveCurrentResult(){archiveCurrentTournament();}

function printEscape(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
function printTeam(value){if(!value)return '미정';if(typeof value==='string')return value;try{return teamText(value)||value.name||value.teamName||'미정';}catch(_error){return value.name||value.teamName||'미정';}}
function printHeader(title){const t=state.tournament||{},guide=state.portal?.guide||{};return `<header class="print-title"><h1>${printEscape(title)}</h1><p>${printEscape(t.name||'230MATCH 대회')} ${t.division?`· ${printEscape(t.division)}`:''}</p></header><div class="print-meta"><span>${guide.date?`대회일 ${printEscape(guide.date)}`:''}${guide.venue?` · ${printEscape(guide.venue)}`:''}</span><span>출력 ${new Date().toLocaleString('ko-KR')}</span></div>`;}
function printPrelimHtml(){const groups=state.prelim?.groups||[],matches=state.prelim?.matches||[];if(!groups.length)return printHeader('예선 조편성·순위표')+'<div class="print-empty">생성된 예선 조편성이 없습니다.</div>';const cards=groups.map((g,idx)=>{const teams=g.teams||g.teamIds?.map(id=>(state.teams||[]).find(t=>t.id===id)).filter(Boolean)||[];const standings=g.standings||state.prelim?.standings?.[g.id]||[];const gm=matches.filter(m=>m.groupId===g.id);return `<article class="print-card"><h3>${printEscape(g.name||`${idx+1}조`)} ${g.courtName?`· ${printEscape(g.courtName)}`:''}</h3><table class="print-table"><thead><tr><th>순위</th><th>팀</th><th class="center">승</th><th class="center">패</th></tr></thead><tbody>${teams.map((t,i)=>{const row=standings.find?.(x=>x.teamId===t?.id)||standings[i]||{};return `<tr><td class="center">${row.rank||i+1}</td><td>${printEscape(printTeam(t))}</td><td class="center">${row.wins??'-'}</td><td class="center">${row.losses??'-'}</td></tr>`}).join('')}</tbody></table><div style="margin-top:7px">${gm.map(m=>`${printEscape(printTeam(m.teamA))} vs ${printEscape(printTeam(m.teamB))}${m.status==='completed'?` · ${m.scoreA??''}:${m.scoreB??''}`:''}`).join('<br>')}</div></article>`}).join('');return printHeader('예선 조편성·순위표')+`<div class="print-grid">${cards}</div>`;}
function printPrelimAssignmentHtml(){
  const groups=state.prelim?.groups||[],matches=state.prelim?.matches||[];
  if(!groups.length)return printHeader('시합 전 조편성·코트 배정표')+'<div class="print-empty">생성된 예선 조편성이 없습니다.</div>';
  const cards=groups.map((g,idx)=>{
    const teams=g.teams||g.teamIds?.map(id=>(state.teams||[]).find(t=>t.id===id)).filter(Boolean)||[];
    const gm=matches.filter(m=>m.groupId===g.id).sort((a,b)=>(a.matchNo||0)-(b.matchNo||0));
    const court=g.court||g.courtName||gm[0]?.court||gm[0]?.courtName||gm[0]?.assignedCourtName||((state.prelim?.courts||[]).find(c=>c.id===(g.prelimCourtId||gm[0]?.prelimCourtId))?.name)||'코트 미정';
    return `<article class="assignment-group-card"><div class="assignment-group-head"><b>${printEscape(g.name||`${idx+1}조`)}</b><span>${printEscape(court)}</span></div><ol>${teams.map((t,i)=>`<li><em>${i+1}</em><strong>${printEscape(printTeam(t))}</strong>${t?.club||t?.affiliation?`<small>${printEscape(t.club||t.affiliation)}</small>`:''}</li>`).join('')}</ol><div class="assignment-order">${gm.map((m,i)=>`<span>${i+1}경기 ${printEscape(printTeam(m.teamA))} vs ${printEscape(printTeam(m.teamB))}</span>`).join('')}</div></article>`;
  }).join('');
  return printHeader('시합 전 조편성·코트 배정표')+`<div class="assignment-summary"><b>${groups.length}개 조 · ${(state.teams||[]).length}팀</b><span>본인 조와 배정 코트를 확인해 주세요.</span></div><div class="assignment-grid">${cards}</div>`;
}
function printBracketHtml(){
  const draw=state.draw;
  if(!draw?.rounds||!draw?.size)return printHeader('본선 가지형 대진표')+'<div class="print-empty">생성된 본선 대진표가 없습니다.</div>';
  const sizes=Object.keys(draw.rounds).map(Number).filter(Boolean).sort((a,b)=>b-a);
  if(!sizes.length)return printHeader('본선 가지형 대진표')+'<div class="print-empty">생성된 본선 대진표가 없습니다.</div>';
  const nodeW=188,nodeH=48,colGap=58,baseGap=64,padX=16,padY=34;
  const firstCount=(draw.rounds[sizes[0]]||[]).length;
  const width=padX*2+sizes.length*nodeW+(sizes.length-1)*colGap;
  const height=Math.max(300,padY*2+firstCount*baseGap);
  const positions=new Map(),parts=[];
  sizes.forEach((size,ri)=>{
    const round=draw.rounds[size]||[],step=baseGap*Math.pow(2,ri),x=padX+ri*(nodeW+colGap);
    parts.push(`<text class="bp-round-title" x="${x+nodeW/2}" y="20" text-anchor="middle">${printEscape(size===2?'결승':size===4?'준결승':`${size}강`)}</text>`);
    round.forEach((m,i)=>{
      const y=padY+(i+.5)*step-nodeH/2;positions.set(m.id,{x,y,cx:x+nodeW,cy:y+nodeH/2});
      const a=printEscape(printTeam(m.teamA)),b=printEscape(printTeam(m.teamB));
      const score=m.status==='completed'?`${m.scoreA??''}:${m.scoreB??''}`:(m.status==='playing'?'시합중':m.courtName||m.court||'');
      parts.push(`<g class="bp-match ${m.status||''}"><rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="6"/><line x1="${x}" y1="${y+nodeH/2}" x2="${x+nodeW}" y2="${y+nodeH/2}"/><text x="${x+7}" y="${y+16}">${a}</text><text x="${x+7}" y="${y+39}">${b}</text>${score?`<text class="bp-score" x="${x+nodeW-7}" y="${y+29}" text-anchor="end">${printEscape(score)}</text>`:''}</g>`);
    });
  });
  sizes.forEach((size,ri)=>{if(ri===sizes.length-1)return;(draw.rounds[size]||[]).forEach(m=>{const from=positions.get(m.id),to=positions.get(m.nextMatchId);if(!from||!to)return;const mid=from.cx+colGap/2;parts.push(`<path class="bp-link" d="M ${from.cx} ${from.cy} H ${mid} V ${to.cy} H ${to.x}"/>`);});});
  return printHeader('본선 가지형 대진표')+`<div class="bracket-print-note">대진 전체를 가지형으로 출력합니다. 64·128강은 A3 가로와 작은 글씨를 권장합니다.</div><div class="bracket-print-wrap"><svg class="bracket-print-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="본선 전체 가지형 대진표">${parts.join('')}</svg></div>`;
}
function printParticipantsHtml(){const teams=state.teams||[];return printHeader('참가자 명단')+(teams.length?`<table class="print-table"><thead><tr><th class="center">번호</th><th>팀·선수명</th><th>소속</th><th>구분</th></tr></thead><tbody>${teams.map((t,i)=>`<tr><td class="center">${i+1}</td><td>${printEscape(printTeam(t))}</td><td>${printEscape(t.club||t.affiliation||'')}</td><td>${t.status==='reserve'?'후보':'참가'}</td></tr>`).join('')}</tbody></table>`:'<div class="print-empty">등록된 참가자가 없습니다.</div>');}
function printLabelsHtml(){
  const status=document.getElementById('labelStatusSelect')?.value||'active';
  const content=document.getElementById('labelContentSelect')?.value||'team';
  const copies=Math.max(1,Math.min(3,Number(document.getElementById('labelCopySelect')?.value||1)));
  const activeCount=Number(state.prelim?.settings?.activeTeamCount||state.teams?.length||0);
  const base=(state.teams||[]).map((team,index)=>({team,index,status:team.status==='reserve'||index>=activeCount?'reserve':'active'})).filter(row=>status==='all'||row.status===status);
  const rows=[];for(const row of base){for(let c=0;c<copies;c++)rows.push(row);}
  if(!rows.length)return '<div class="print-empty">선택한 조건에 맞는 참가자가 없습니다.</div>';
  return `<div class="label-sheet">${rows.map(({team,index,status})=>{const name=printTeam(team),aff=team.club||team.affiliation||'';let main=name,sub='';if(content==='team-affiliation')sub=aff;if(content==='number-team')main=`${index+1}. ${name}`;return `<div class="participant-label ${status}"><strong>${printEscape(main)}</strong>${sub?`<span>${printEscape(sub)}</span>`:''}${status==='reserve'?'<em>후보</em>':''}</div>`;}).join('')}</div>`;
}
function printCourtsHtml(){const courts=state.unifiedCourts||state.courts||[];const rows=Array.isArray(courts)?courts:Object.values(courts||{});return printHeader('코트별 경기 현황')+(rows.length?`<table class="print-table"><thead><tr><th>코트</th><th>시합중</th><th>대기 1</th><th>상태</th></tr></thead><tbody>${rows.map((c,i)=>{const playing=c.playingMatch||c.playing||c.currentMatch,wait=(c.waiting||c.queue||[])[0]||c.wait1;return `<tr><td>${printEscape(c.name||c.courtName||`${i+1}번 코트`)}</td><td>${playing?`${printEscape(printTeam(playing.teamA))} vs ${printEscape(printTeam(playing.teamB))}`:'-'}</td><td>${wait?`${printEscape(printTeam(wait.teamA))} vs ${printEscape(printTeam(wait.teamB))}`:'-'}</td><td>${c.paused?'일시정지':'운영중'}</td></tr>`}).join('')}</tbody></table>`:'<div class="print-empty">설정된 코트가 없습니다.</div>');}
function printResultsHtml(){const p=currentPodium(),pre=state.prelim?.matches||[],main=portalMainMatches();return printHeader('최종 입상 결과표')+`<div class="print-podium"><div><span>🏆 우승</span><b>${printEscape(p.champion||'미확정')}</b></div><div><span>🥈 준우승</span><b>${printEscape(p.runnerUp||'미확정')}</b></div><div><span>🥉 공동 3위</span><b>${printEscape((p.thirds||[]).join(' · ')||'미확정')}</b></div></div><table class="print-table"><tbody><tr><th>예선 완료</th><td>${pre.filter(x=>x.status==='completed').length} / ${pre.length}</td></tr><tr><th>본선 완료</th><td>${main.filter(x=>x.status==='completed').length} / ${main.length}</td></tr><tr><th>대회 상태</th><td>${state.tournament?.completedAt?'종료':'진행 중'}</td></tr></tbody></table>`;}
function buildPrintDocument(){const target=document.getElementById('printTargetSelect')?.value||'prelim',paper=document.getElementById('printPaperSelect')?.value||'a4',orientation=document.getElementById('printOrientationSelect')?.value||'portrait',tone=document.getElementById('printToneSelect')?.value||'color',scale=document.getElementById('printScaleSelect')?.value||'normal';const map={prelim:printPrelimHtml,'prelim-assignment':printPrelimAssignmentHtml,bracket:printBracketHtml,participants:printParticipantsHtml,labels:printLabelsHtml,courts:printCourtsHtml,results:printResultsHtml};const labels={prelim:'예선 조편성·순위표','prelim-assignment':'시합 전 조편성·코트 배정표',bracket:'본선 가지형 대진표',participants:'참가자 명단',labels:'참가자 라벨지',courts:'코트별 경기 현황',results:'최종 입상 결과표'};const body=(map[target]||printPrelimHtml)();const isLabels=target==='labels';return {target,label:labels[target],paper,orientation,tone,scale,html:`<article class="print-sheet paper-${paper} ${orientation} ${tone} scale-${scale} ${isLabels?'label-print-sheet':''} ${target==='prelim-assignment'?'assignment-print-sheet':''} ${target==='bracket'?'bracket-tree-print-sheet':''}">${body}${isLabels?'':`<footer class="print-footer">230MATCH · ${printEscape(BUILD_LABEL)}</footer>`}</article>`};}
function renderPrintPreview(){const preview=document.getElementById('printPreview');if(!preview)return;const target=document.getElementById('printTargetSelect')?.value||'prelim';const options=document.getElementById('labelPrintOptions');if(options)options.hidden=target!=='labels';const paper=document.getElementById('printPaperSelect'),orientation=document.getElementById('printOrientationSelect'),scale=document.getElementById('printScaleSelect');if(paper)paper.value='a4';if(target==='labels'){if(orientation)orientation.value='portrait';}else if(target==='prelim-assignment'){if(orientation)orientation.value='landscape';if(scale)scale.value='small';}else if(target==='bracket'){if(orientation)orientation.value='landscape';if(scale)scale.value='small';}const doc=buildPrintDocument();preview.innerHTML=doc.html;const summary=document.getElementById('printPreviewSummary');if(summary)summary.textContent=target==='labels'?`${doc.label} · 12×40mm · A4 세로 · ${document.getElementById('labelStatusSelect')?.selectedOptions?.[0]?.textContent||''}`:`${doc.label} · ${doc.paper.toUpperCase()} · ${doc.orientation==='landscape'?'가로':'세로'} · ${doc.tone==='mono'?'흑백':'컬러'}`;}
function printSelectedDocument(){const doc=buildPrintDocument();let root=document.getElementById('printOutputRoot');if(!root){root=document.createElement('div');root.id='printOutputRoot';document.body.appendChild(root);}root.innerHTML=doc.html;document.body.classList.add('printing-output');const cleanup=()=>{document.body.classList.remove('printing-output');root.innerHTML='';window.removeEventListener('afterprint',cleanup);};window.addEventListener('afterprint',cleanup);setTimeout(()=>window.print(),80);}
function wrapCanvasText(ctx,text,maxWidth){const words=String(text||'').split(/\s+/),lines=[];let line='';for(const word of words){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}if(line)lines.push(line);return lines;}
async function saveRichPrintPreviewPng(doc){
  renderPrintPreview();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const sheet=document.querySelector('#printPreview .print-sheet');if(!sheet){notice('출력 미리보기를 찾지 못했습니다.','error');return;}
  const clone=sheet.cloneNode(true),rect=sheet.getBoundingClientRect();
  const width=Math.max(1200,Math.round(sheet.scrollWidth||rect.width||1600));
  const height=Math.max(800,Math.round(sheet.scrollHeight||rect.height||1000));
  let css='';for(const styleSheet of [...document.styleSheets]){try{css+=[...styleSheet.cssRules].map(r=>r.cssText).join('\n');}catch(_e){}}
  const xhtml=`<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;background:#fff;padding:0;margin:0"><style>${css}</style>${clone.outerHTML}</div>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  const img=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  img.onload=()=>{const maxW=2600,scale=Math.min(2,maxW/width),canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(img,0,0);URL.revokeObjectURL(url);canvas.toBlob(blob=>{if(!blob){notice('이미지 생성에 실패했습니다.','error');return;}const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`230MATCH_${doc.label.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);notice('출력 미리보기 그대로 PNG 이미지를 저장했습니다.','success');},'image/png');};
  img.onerror=()=>{URL.revokeObjectURL(url);notice('이미지 변환에 실패했습니다. 인쇄/PDF 저장을 이용해 주세요.','error');};img.src=url;
}
function savePrintPng(){const doc=buildPrintDocument(),title=doc.label;if(doc.target==='bracket'||doc.target==='prelim-assignment'){saveRichPrintPreviewPng(doc);return;}const lines=[];if(doc.target==='participants'){(state.teams||[]).forEach((t,i)=>lines.push(`${i+1}. ${printTeam(t)} · ${t.club||t.affiliation||''} · ${t.status==='reserve'?'후보':'참가'}`));}else if(doc.target==='results'){const p=currentPodium();lines.push(`우승: ${p.champion||'미확정'}`,`준우승: ${p.runnerUp||'미확정'}`,`공동 3위: ${(p.thirds||[]).join(' · ')||'미확정'}`);}else if(doc.target==='bracket'){portalMainMatches().forEach((m,i)=>lines.push(`${m.roundName||m.round||'본선'} ${i+1}: ${printTeam(m.teamA)} vs ${printTeam(m.teamB)}${m.status==='completed'?` · ${printTeam(m.winner)} 승`:''}`));}else if(doc.target==='prelim'||doc.target==='prelim-assignment'){(state.prelim?.groups||[]).forEach((g,i)=>lines.push(`${g.name||`${i+1}조`} · ${g.courtName||'코트 미정'}: ${(g.teams||[]).map(printTeam).join(' / ')}`));}else{const courts=state.unifiedCourts||state.courts||[];(Array.isArray(courts)?courts:Object.values(courts||{})).forEach((c,i)=>lines.push(`${c.name||`${i+1}번 코트`}: ${c.playingMatch?`${printTeam(c.playingMatch.teamA)} vs ${printTeam(c.playingMatch.teamB)}`:'대기'}`));}const width=1600,pad=80,lineH=42;const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font='26px sans-serif';let wrapped=[];for(const line of lines.length?lines:['표시할 자료가 없습니다.'])wrapped.push(...wrapCanvasText(ctx,line,width-pad*2));canvas.width=width;canvas.height=Math.max(1000,260+wrapped.length*lineH+pad);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#10264a';ctx.fillRect(0,0,canvas.width,150);ctx.fillStyle='#ffffff';ctx.font='bold 46px sans-serif';ctx.fillText(title,pad,75);ctx.font='25px sans-serif';ctx.fillText(`${state.tournament?.name||'230MATCH 대회'} · ${state.tournament?.division||''}`,pad,120);ctx.fillStyle='#111827';ctx.font='26px sans-serif';let y=215;for(const line of wrapped){ctx.fillText(line,pad,y);y+=lineH;}canvas.toBlob(blob=>{if(!blob){notice('이미지 생성에 실패했습니다.','error');return;}const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`230MATCH_${title.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);notice('PNG 이미지를 저장했습니다.','success');},'image/png');}
function bindPrintCenter(){['printTargetSelect','printPaperSelect','printOrientationSelect','printToneSelect','printScaleSelect','labelStatusSelect','labelContentSelect','labelCopySelect'].forEach(id=>document.getElementById(id)?.addEventListener('change',renderPrintPreview));document.getElementById('refreshPrintPreviewBtn')?.addEventListener('click',renderPrintPreview);document.getElementById('printDocumentBtn')?.addEventListener('click',printSelectedDocument);document.getElementById('savePrintImageBtn')?.addEventListener('click',savePrintPng);}


function tournamentTemplateSummary(template){
  const venues=Array.isArray(template?.settings?.venues)?template.settings.venues:[];
  const courts=venues.reduce((sum,v)=>sum+(Number(v.courtCount)||0),0);
  return `${template?.division||'부서 미설정'} · ${template?.prelim?.settings?.activeTeamCount||0}팀 · ${courts||template?.settings?.courtCount||0}면`;
}
function renderTournamentLifecycleManager(){
  ensurePortalState();
  const list=document.getElementById('tournamentTemplateList');
  const select=document.getElementById('newTournamentTemplate');
  const templates=state.portal.tournamentTemplates||[];
  if(select){
    const current=select.value;
    select.innerHTML='<option value="current">현재 대회 설정 복사</option><option value="blank">기본값으로 새로 시작</option>'+templates.map(t=>`<option value="${t.id}">${portalEscape(t.name)}</option>`).join('');
    if([...select.options].some(o=>o.value===current))select.value=current;
  }
  if(list)list.innerHTML=templates.map(t=>`<article class="tournament-template-card"><div><strong>${portalEscape(t.name)}</strong><span>${portalEscape(tournamentTemplateSummary(t))}</span><small>${new Date(t.updatedAt||t.createdAt).toLocaleString('ko-KR')}</small></div><div class="button-row"><button type="button" class="btn btn-light btn-small" data-template-use="${t.id}">새 대회에 사용</button><button type="button" class="btn btn-danger-outline btn-small" data-template-delete="${t.id}">삭제</button></div></article>`).join('')||'<div class="portal-empty">저장된 대회 설정 템플릿이 없습니다.</div>';
}
function currentTournamentTemplate(name){
  return {id:crypto.randomUUID(),name:name||`${state.tournament?.name||'대회'} 설정`,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),division:state.tournament?.division||'',settings:structuredClone(state.settings||{}),prelim:{settings:structuredClone(state.prelim?.settings||{})},guide:structuredClone(state.portal?.guide||{}),posts:structuredClone(state.portal?.posts||[])};
}
function saveCurrentTournamentTemplate(){
  if(!requireAdmin('대회 설정 템플릿 저장'))return;
  const name=prompt('템플릿 이름을 입력하세요.',`${state.tournament?.name||'대회'} 설정`);
  if(!name?.trim())return;
  ensurePortalState();
  state.portal.tournamentTemplates.unshift(currentTournamentTemplate(name.trim()));
  state.portal.tournamentTemplates=state.portal.tournamentTemplates.slice(0,20);
  commit(`대회 설정 템플릿 저장 · ${name.trim()}`);renderTournamentLifecycleManager();notice('현재 대회 설정을 템플릿으로 저장했습니다.','success');
}
function sourceForNewTournament(sourceId){
  if(sourceId==='blank')return initialState();
  if(sourceId==='current')return state;
  const t=(state.portal?.tournamentTemplates||[]).find(x=>x.id===sourceId);
  if(!t)return state;
  const base=initialState();
  base.settings=structuredClone(t.settings||base.settings);
  base.prelim.settings=structuredClone(t.prelim?.settings||base.prelim.settings);
  base.portal={guide:structuredClone(t.guide||{}),posts:structuredClone(t.posts||[])};
  base.tournament={name:t.name||'새 대회',division:t.division||''};
  return base;
}
async function createNewTournamentFromManager(options={}){
  if(!requireAdmin('새 대회 생성'))return false;
  try{await prepareCriticalCloudWrite();}catch(error){notice(error?.message||String(error),'error');return false;}
  const name=String(document.getElementById('newTournamentName')?.value||'').trim();
  const division=String(document.getElementById('newTournamentDivision')?.value||'').split(/[,\n]/).map(v=>v.trim()).filter(Boolean)[0]||'';
  if(!name){notice('새 대회명을 입력하세요.','error');return;}
  if(!options.skipPrompt){const typed=prompt(`새 대회 “${name}”로 전환합니다. 확인을 위해 새 대회명을 그대로 입력하세요.`,'');if(typed!==name){notice('대회명이 일치하지 않아 취소했습니다.','warning');return false;}}
  const backup=saveRecovery(state,`${state.tournament?.name||'현재 대회'} · 새 대회 전환 전 자동 복구점`);
  const source=sourceForNewTournament(document.getElementById('newTournamentTemplate')?.value||'current');
  const preserveTeams=document.getElementById('copyTournamentTeams')?.checked===true;
  const preserveGuide=document.getElementById('copyTournamentGuide')?.checked!==false;
  const preservePosts=document.getElementById('copyTournamentPosts')?.checked===true;
  try{syncCurrentTournamentRuntime();}catch(_e){}
  const tournamentRegistry=structuredClone(state.multiTournament||{activeTournamentId:'',tournaments:[]});
  const previousPortal=structuredClone(state.portal||{});
  const next=initialState();
  next.tournament={name,division:division||source.tournament?.division||'부서 미설정'};
  next.settings=structuredClone(source.settings||next.settings);
  next.prelim.settings=structuredClone(source.prelim?.settings||next.prelim.settings);
  const capacity=Math.max(0,Number(document.getElementById('newTournamentCapacity')?.value||next.prelim.settings.activeTeamCount||0));
  if(capacity)next.prelim.settings.activeTeamCount=capacity;
  next.portal={
    tournamentArchives:previousPortal.tournamentArchives||[],resultArchives:previousPortal.resultArchives||[],tournamentTemplates:previousPortal.tournamentTemplates||[],applications:preserveTeams?structuredClone(previousPortal.applications||[]):[],
    guide:preserveGuide?structuredClone(source.portal?.guide||previousPortal.guide||{}):{date:'',venue:'',fee:'',bank:'',account:'',paymentNote:'입금 확인 후 참가 확정됩니다.',detail:''},
    posts:preservePosts?structuredClone(source.portal?.posts||previousPortal.posts||[]):[]
  };
  const date=String(document.getElementById('newTournamentDate')?.value||'');
  const venue=String(document.getElementById('newTournamentVenue')?.value||'').trim();
  if(date)next.portal.guide.date=date;if(venue)next.portal.guide.venue=venue;
  if(preserveTeams){next.teams=structuredClone(state.teams||[]);next.contacts=structuredClone(state.contacts||{});next.prelim.activeTeams=structuredClone(state.prelim?.activeTeams||[]);next.prelim.reserveTeams=structuredClone(state.prelim?.reserveTeams||[]);}
  const newTournamentId=multiTournamentId();
  next.tournament.id=newTournamentId;
  next.multiTournament=tournamentRegistry;
  next.multiTournament.tournaments=Array.isArray(next.multiTournament.tournaments)?next.multiTournament.tournaments:[];
  // 새 대회를 목록에 먼저 등록해 생성 직후 서버의 이전 상태가 덮어쓰지 못하게 합니다.
  if(!next.multiTournament.tournaments.some(t=>String(t?.id)===String(newTournamentId))){
    next.multiTournament.tournaments.push({
      id:newTournamentId,
      name,
      division:next.tournament.division||'',
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      snapshot:null
    });
  }
  next.multiTournament.activeTournamentId=newTournamentId;
  window.__230matchLocalMutationUntil=Date.now()+15000;
  state=normalizeV5RuntimeState(next);ensurePortalState();ensurePrelimState(state);ensureTimeState(state);ensureDrawMeta(state);ensureMessagingState(state);ensureContacts(state);ensureAuditState(state);ensureEarlyMainSettings(state);ensureVenueSettings(state);ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state);ensurePrelimCourtStatuses(state);ensureOperatorState();
  try{syncCurrentTournamentRuntime();}catch(_e){}
  saveState(state);
  // 생성 직후 서버에 먼저 확정 저장한 뒤 화면을 갱신합니다.
  const result=await backup.ready;
  let cloudMessage='';
  if(options.uploadCloud!==false){
    try{
      await pushStateNow(state);
      cloudMessage=' Firebase 업로드도 완료했습니다.';
    }catch(error){
      cloudMessage=` Firebase 업로드는 실패했습니다: ${error?.message||error}`;
    }
  }
  syncInputs();syncPrelimInputs();renderVenueSettingsEditor();render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});renderOperatorControls();applyRoleUI();renderPortalViews();renderTournamentLifecycleManager();renderDivisionWorkspaceBar();
  notice(`새 대회를 생성했습니다.${result?.saved?' 이전 상태는 자동 복구점에 저장했습니다.':''}${cloudMessage}`,cloudMessage.includes('실패')?'warning':'success');return true;
}
function resetTournamentScope(scope){
  if(!requireAdmin('대회 데이터 초기화'))return;
  const labels={prelim:'예선 결과',main:'본선 결과',courts:'코트 배정',applications:'참가 신청',competition:'대회 경기 데이터 전체'};
  const label=labels[scope];if(!label)return;
  const word=scope==='competition'?'전체초기화':'초기화';
  const typed=prompt(`${label}를 초기화합니다. 기존 상태는 자동 복구점에 저장됩니다. 계속하려면 “${word}”를 입력하세요.`,'');
  if(typed!==word){notice('확인 문구가 일치하지 않아 취소했습니다.','warning');return;}
  saveRecovery(state,`${state.tournament?.name||'대회'} · ${label} 초기화 전 자동 복구점`);
  const fresh=initialState();
  if(scope==='prelim'){
    state.prelim={...structuredClone(fresh.prelim),settings:structuredClone(state.prelim?.settings||fresh.prelim.settings)};
  }else if(scope==='main'){
    state.draw=structuredClone(fresh.draw);state.drawMeta=structuredClone(fresh.drawMeta);state.courts=[];state.sharedQueue=[];state.venueQueues={};delete state.completion;delete state.tournament.completedAt;
  }else if(scope==='courts'){
    state.courts=[];state.sharedQueue=[];state.venueQueues={};if(state.prelim){state.prelim.courts=[];(state.prelim.matches||[]).forEach(m=>{if(m.status!=='completed'){m.courtId=null;m.court=null;m.waitStartedAt=null;}});}for(const m of allMatches(state.draw||{rounds:{}})){if(m.status!=='completed'){m.courtId=null;m.court=null;m.waitStartedAt=null;}}
  }else if(scope==='applications'){
    ensurePortalState();state.portal.applications=[];
  }else if(scope==='competition'){
    state.prelim={...structuredClone(fresh.prelim),settings:structuredClone(state.prelim?.settings||fresh.prelim.settings)};state.draw=structuredClone(fresh.draw);state.drawMeta=structuredClone(fresh.drawMeta);state.courts=[];state.sharedQueue=[];state.venueQueues={};state.audit=structuredClone(fresh.audit);state.logs=[];state.messaging.queue=[];delete state.completion;delete state.tournament.completedAt;
  }
  ensurePrelimState(state);ensureDrawMeta(state);ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state);ensurePrelimCourtStatuses(state);commit(`${label} 초기화`);renderTournamentLifecycleManager();notice(`${label}를 초기화했습니다.`,'success');
}

let newTournamentWizardStep=1;
function wizardEl(id){return document.getElementById(id);}
function setWizardMessage(message='',type=''){const el=wizardEl('wizardMessage');if(!el)return;el.hidden=!message;el.textContent=message;el.className=`wizard-message ${type}`.trim();}
function wizardCapacity(){return Math.max(2,Number(wizardEl('wizardTournamentCapacity')?.value||96));}
function wizardEstimate(){const cap=wizardCapacity(),mode=wizardEl('wizardGroupSize')?.value||'3',two=Math.max(0,Number(wizardEl('wizardTwoTeamGroups')?.value||0)),q=Math.max(1,Number(wizardEl('wizardQualifiers')?.value||2));let groups;if(mode==='2')groups=Math.ceil(cap/2);else if(mode==='mixed')groups=two+Math.ceil(Math.max(0,cap-two*2)/3);else groups=Math.ceil(cap/3);const qualifiers=groups*q;let draw=Number(wizardEl('wizardDrawSize')?.value);if(!draw){draw=qualifiers<=32?32:qualifiers<=64?64:128;}return{cap,groups,qualifiers,draw,two};}
function updateWizardGuide(){const x=wizardEstimate(),el=wizardEl('wizardFormatGuide');if(el)el.textContent=`예상 ${x.groups}개 조 · 본선 진출 최대 ${x.qualifiers}팀 · ${x.draw}강 대진 · BYE 약 ${Math.max(0,x.draw-x.qualifiers)}팀`;}
function wizardSummaryHtml(){const x=wizardEstimate();const rows=[['대회명',wizardEl('wizardTournamentName')?.value||'-'],['부서',wizardEl('wizardTournamentDivision')?.value||'-'],['일정·장소',`${wizardEl('wizardTournamentDate')?.value||'미정'} · ${wizardEl('wizardTournamentVenue')?.value||'미정'}`],['참가 정원',`${x.cap}팀`],['예선',`${x.groups}개 조 예상 · 조당 ${wizardEl('wizardQualifiers')?.value||2}팀 진출`],['본선',`${x.draw}강 · 예상 BYE ${Math.max(0,x.draw-x.qualifiers)}`],['코트',`${wizardEl('wizardCourtPrefix')?.value||'코트'} ${wizardEl('wizardCourtCount')?.value||8}면`],['설정 기준',wizardEl('wizardTemplate')?.value==='current'?'현재 대회 설정 복사':'기본값으로 새 시작'],['보관',`요강 ${wizardEl('wizardCopyGuide')?.checked?'복사':'미복사'} · 공지 ${wizardEl('wizardCopyPosts')?.checked?'복사':'미복사'} · 참가팀 ${wizardEl('wizardCopyTeams')?.checked?'복사':'미복사'}`],['Firebase','생성 즉시 자동 업로드']];return rows.map(([k,v])=>`<article><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></article>`).join('');}
function renderNewTournamentWizard(){document.querySelectorAll('[data-wizard-step]').forEach(el=>el.classList.toggle('active',Number(el.dataset.wizardStep)===newTournamentWizardStep));document.querySelectorAll('[data-wizard-dot]').forEach(el=>{const n=Number(el.dataset.wizardDot);el.classList.toggle('active',n===newTournamentWizardStep);el.classList.toggle('done',n<newTournamentWizardStep);});wizardEl('wizardPrevBtn').hidden=newTournamentWizardStep===1;wizardEl('wizardNextBtn').hidden=newTournamentWizardStep===4;wizardEl('wizardCreateBtn').hidden=newTournamentWizardStep!==4;if(newTournamentWizardStep===4)wizardEl('wizardSummary').innerHTML=wizardSummaryHtml();updateWizardGuide();setWizardMessage();}
function openNewTournamentWizard(){if(!requireAdmin('새 대회 생성'))return;const modal=wizardEl('newTournamentWizard');if(!modal)return;newTournamentWizardStep=1;wizardEl('wizardTournamentName').value='';wizardEl('wizardTournamentDivision').value='';wizardEl('wizardTournamentDate').value='';wizardEl('wizardTournamentVenue').value='';wizardEl('wizardTournamentCapacity').value=state.prelim?.settings?.activeTeamCount||96;wizardEl('wizardCourtCount').value=state.settings?.courtCount||8;wizardEl('wizardCourtPrefix').value=state.settings?.courtPrefix||'국제';wizardEl('wizardTemplate').value='blank';wizardEl('wizardConfirmChecked').checked=false;modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';renderNewTournamentWizard();setTimeout(()=>wizardEl('wizardTournamentName')?.focus(),50);}
function closeNewTournamentWizard(){const modal=wizardEl('newTournamentWizard');if(modal){modal.hidden=true;modal.setAttribute('aria-hidden','true');}document.body.style.overflow='';}
function validateWizardStep(step){if(step===1){if(!String(wizardEl('wizardTournamentName')?.value||'').trim()){setWizardMessage('대회명을 입력하세요.','error');wizardEl('wizardTournamentName')?.focus();return false;}if(!String(wizardEl('wizardTournamentDivision')?.value||'').trim()){setWizardMessage('부서를 입력하세요.','error');wizardEl('wizardTournamentDivision')?.focus();return false;}}return true;}
async function createTournamentFromWizard(){if(!wizardEl('wizardConfirmChecked')?.checked){setWizardMessage('최종 확인 항목에 체크하세요.','error');return;}const divisionNames=parseDivisionNames(wizardEl('wizardTournamentDivision')?.value);const x=wizardEstimate();const map={newTournamentName:'wizardTournamentName',newTournamentDivision:'wizardTournamentDivision',newTournamentDate:'wizardTournamentDate',newTournamentVenue:'wizardTournamentVenue',newTournamentCapacity:'wizardTournamentCapacity',newTournamentTemplate:'wizardTemplate'};Object.entries(map).forEach(([dst,src])=>{const d=wizardEl(dst),s=wizardEl(src);if(d&&s)d.value=dst==='newTournamentDivision'?(divisionNames[0]||s.value):s.value;});if(wizardEl('copyTournamentGuide'))wizardEl('copyTournamentGuide').checked=wizardEl('wizardCopyGuide').checked;if(wizardEl('copyTournamentPosts'))wizardEl('copyTournamentPosts').checked=wizardEl('wizardCopyPosts').checked;if(wizardEl('copyTournamentTeams'))wizardEl('copyTournamentTeams').checked=wizardEl('wizardCopyTeams').checked;setWizardMessage('현재 상태를 복구점에 저장하고 새 대회를 생성하고 있습니다.');try{const ok=await createNewTournamentFromManager({skipPrompt:true,uploadCloud:false});if(!ok)return;state.settings.drawSize=x.draw;state.settings.courtCount=Math.max(1,Number(wizardEl('wizardCourtCount')?.value||8));state.settings.courtPrefix=String(wizardEl('wizardCourtPrefix')?.value||'국제').trim();state.prelim.settings.qualifiersPerGroup=Number(wizardEl('wizardQualifiers')?.value||2);state.prelim.settings.twoTeamGroupCount=x.two;state.portal.guide.startTime=wizardEl('wizardTournamentStartTime')?.value||'09:00';initializeTournamentDivisions(divisionNames);saveState(state);renderDivisionWorkspaceBar();try{await pushStateNow(state);}catch(error){throw new Error(`새 대회 서버 저장 실패: ${error?.message||error}`);}setWizardMessage('새 대회 생성이 완료되었습니다.','success');setTimeout(()=>{closeNewTournamentWizard();navigatePortalView('tournaments',{pushHistory:true});},500);}catch(error){setWizardMessage(`생성 실패: ${error?.message||error}`,'error');}}
window.openNewTournamentWizard=openNewTournamentWizard;
document.addEventListener('click',e=>{const b=e.target.closest?.('#createNewTournamentBtn');if(b){e.preventDefault();openNewTournamentWizard();}},true);
function bindNewTournamentWizard(){wizardEl('newTournamentWizardClose')?.addEventListener('click',closeNewTournamentWizard);wizardEl('newTournamentWizard')?.addEventListener('click',e=>{if(e.target===wizardEl('newTournamentWizard'))closeNewTournamentWizard();});wizardEl('wizardPrevBtn')?.addEventListener('click',()=>{newTournamentWizardStep=Math.max(1,newTournamentWizardStep-1);renderNewTournamentWizard();});wizardEl('wizardNextBtn')?.addEventListener('click',()=>{if(!validateWizardStep(newTournamentWizardStep))return;newTournamentWizardStep=Math.min(4,newTournamentWizardStep+1);renderNewTournamentWizard();});wizardEl('wizardCreateBtn')?.addEventListener('click',createTournamentFromWizard);['wizardTournamentCapacity','wizardGroupSize','wizardTwoTeamGroups','wizardQualifiers','wizardDrawSize'].forEach(id=>wizardEl(id)?.addEventListener('input',updateWizardGuide));}

function bindTournamentLifecycleManager(){
  bindNewTournamentWizard();
  document.getElementById('saveTournamentTemplateBtn')?.addEventListener('click',saveCurrentTournamentTemplate);
  document.getElementById('tournamentTemplateList')?.addEventListener('click',e=>{const use=e.target.closest('[data-template-use]');if(use){const sel=document.getElementById('newTournamentTemplate');if(sel)sel.value=use.dataset.templateUse;document.getElementById('newTournamentName')?.focus();return;}const del=e.target.closest('[data-template-delete]');if(!del||!isAdmin())return;const t=(state.portal.tournamentTemplates||[]).find(x=>x.id===del.dataset.templateDelete);if(!t||!confirm(`“${t.name}” 템플릿을 삭제할까요?`))return;state.portal.tournamentTemplates=state.portal.tournamentTemplates.filter(x=>x.id!==t.id);commit(`대회 설정 템플릿 삭제 · ${t.name}`);renderTournamentLifecycleManager();});
  document.querySelectorAll('[data-tournament-reset]').forEach(btn=>btn.addEventListener('click',()=>resetTournamentScope(btn.dataset.tournamentReset)));
  renderTournamentLifecycleManager();
}

const PUBLIC_PORTAL_VIEWS=new Set(['home','tournaments','prelim-public','my-match','entry','guide','board','participants','records','print','operation','bracket']);
const PORTAL_VIEW_TITLES={home:'홈', tournaments:'대회 목록', 'prelim-public':'예선 현황', 'my-match':'내 경기', entry:'참가 신청', guide:'대회 요강', board:'공지사항', participants:'참가 기록', records:'대회 기록', print:'출력 센터', operation:'코트 현황', bracket:'본선 대진표', settings:'대회 관리', roster:'참가팀 관리', messages:'문자 센터', notifications:'알림 관리', manual:'운영 도움말', audit:'운영 점검', logs:'운영 로그', readiness:'당일 운영 준비', acceptance:'실전 운영 검수', rehearsal:'리허설 점검', performance:'대용량 성능 테스트', diagnostics:'오류 진단'};
function updateDocumentTitle(view='home'){const label=PORTAL_VIEW_TITLES[view]||'현재 대회';document.title=`${label} | 230MATCH 테니스 시합관리`; }
const INTERNAL_ADMIN_PORTAL_VIEWS=new Set(['acceptance','rehearsal','performance']);
const INTERNAL_OPERATOR_PORTAL_VIEWS=new Set(['messages','notifications','roster','manual','audit','logs','readiness','diagnostics']);
function portalViewAllowed(name){
  const view=document.getElementById(`view-${name}`);
  if(!view)return false;
  // 공개 화면의 접근 여부는 메뉴 표시 상태와 분리합니다. 모바일/권한 UI가 탭을 숨겨도 화면 이동은 허용합니다.
  if(PUBLIC_PORTAL_VIEWS.has(name))return true;
  if(name==='rehearsal')return isAdmin()&&isRehearsalUnlocked();
  if(INTERNAL_ADMIN_PORTAL_VIEWS.has(name))return isAdmin();
  if(INTERNAL_OPERATOR_PORTAL_VIEWS.has(name))return canOperate();
  const tab=document.querySelector(`.tab[data-view="${name}"]`);
  if(!tab)return false;
  if(tab.hasAttribute('data-admin-only')&&!isAdmin())return false;
  if(tab.hasAttribute('data-operator-only')&&!canOperate())return false;
  return true;
}
function renderPortalViewFast(target){
  // Navigation must be immediate. Heavy all-page rendering is reserved for state changes/initial load.
  try{
    if(target==='guide'){renderTournamentGuide();return;}
    if(target==='tournaments'){renderTournamentList();return;}
    if(target==='prelim-public'){renderPublicPrelimGroups();return;}
    if(target==='entry'){renderApplicationPortal();return;}
    if(target==='participants'){renderPublicParticipantRecords();return;}
    if(target==='records'){renderResultArchive();return;}
    if(target==='print'){renderPrintPreview();return;}
    // operation/bracket/home/my-match/settings already have live DOM maintained by state renders.
  }catch(error){console.warn('[230MATCH 61.1.1] fast view render warning',target,error);}
}
function navigatePortalView(name,{pushHistory=false,replaceHistory=false,focus=true}={}){
  const requested=String(name||'home').replace(/^#/,'').trim()||'home';
  const target=portalViewAllowed(requested)?requested:'home';
  const targetView=document.getElementById(`view-${target}`);
  if(!targetView)return false;

  // 화면 활성화는 이 함수 한 곳에서만 담당합니다.
  document.querySelectorAll('.view').forEach(view=>view.classList.toggle('active',view===targetView));
  document.querySelectorAll('.tab[data-view]').forEach(tab=>tab.classList.toggle('active',tab.dataset.view===target));
  document.querySelectorAll('.mobile-nav-button[data-mobile-view]').forEach(btn=>btn.classList.toggle('active',btn.dataset.mobileView===target));
  document.body.dataset.currentView=target;

  // 코트 현황도 별도 라우터를 두지 않고 여기에서 모드를 확정합니다.
  if(target==='operation'){
    targetView.dataset.operationMode='courts';
    document.querySelectorAll('#view-operation [data-operation-section]').forEach(button=>{
      const active=button.dataset.operationSection==='courts';
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
  }

  updateDocumentTitle(target);
  const moreViews=new Set(['participants','notifications','records','guide','board','print','operation','prelim-public']);
  document.getElementById('mobileMoreBtn')?.classList.toggle('active',moreViews.has(target));
  closeMobileMoreMenu();
  const mobileTitle=document.getElementById('mobilePageTitle');if(mobileTitle)mobileTitle.textContent=PORTAL_VIEW_TITLES[target]||'230MATCH';
  const mobileBack=document.getElementById('mobileBackBtn');if(mobileBack)mobileBack.hidden=target==='home';

  const hash=`#${target}`;
  if(pushHistory&&location.hash!==hash)history.pushState({portalView:target},'',hash);
  else if(replaceHistory&&location.hash!==hash)history.replaceState({portalView:target},'',hash);

  renderPortalViewFast(target);
  if(target==='home')setTimeout(showEligibleHomePopup,120);
  if(target==='my-match')setTimeout(v3252AutoMyMatch,60);
  if(target==='entry')setTimeout(renderApplicationPortal,30);
  if(target==='notifications')setTimeout(refreshNotificationManager,30);
  if(target==='messages')setTimeout(()=>renderSmsAcceptance(lastSmsAcceptance),30);
  if(target==='print')setTimeout(renderPrintPreview,30);
  if(target==='acceptance')setTimeout(renderAcceptance,30);
  if(target==='rehearsal')setTimeout(()=>renderRehearsal(),30);
  if(target==='performance')setTimeout(renderPerformanceCenter,30);
  if(target==='diagnostics')setTimeout(renderDiagnostics,30);
  if(target==='manual')setTimeout(renderOperationsManual,30);

  window.scrollTo({top:0,behavior:focus?'smooth':'auto'});
  if(focus){
    const heading=targetView.querySelector('h1, h2');
    if(heading){heading.setAttribute('tabindex','-1');setTimeout(()=>heading.focus({preventScroll:true}),120);}
  }
  return target===requested;
}
function initialPortalView(){
  const requested=decodeURIComponent(location.hash.replace(/^#/,''));
  navigatePortalView(requested||'home',{replaceHistory:true,focus:false});
}
function openMobileMoreMenu(){
  const sheet=document.getElementById('mobileMoreSheet');
  const btn=document.getElementById('mobileMoreBtn');
  if(!sheet)return;
  sheet.hidden=false;
  requestAnimationFrame(()=>sheet.classList.add('open'));
  btn?.setAttribute('aria-expanded','true');
  document.body.classList.add('mobile-more-open');
}
function closeMobileMoreMenu(){
  const sheet=document.getElementById('mobileMoreSheet');
  const btn=document.getElementById('mobileMoreBtn');
  if(!sheet)return;
  sheet.classList.remove('open');
  btn?.setAttribute('aria-expanded','false');
  document.body.classList.remove('mobile-more-open');
  setTimeout(()=>{if(!sheet.classList.contains('open'))sheet.hidden=true;},180);
}
function bindMobileMoreMenu(){
  document.getElementById('mobileMoreBtn')?.addEventListener('click',()=>{
    const sheet=document.getElementById('mobileMoreSheet');
    if(sheet?.classList.contains('open'))closeMobileMoreMenu();else openMobileMoreMenu();
  });
  document.querySelectorAll('[data-mobile-more-close]').forEach(el=>el.addEventListener('click',closeMobileMoreMenu));
  document.getElementById('mobileMoreSheet')?.addEventListener('click',e=>{if(e.target.closest('[data-portal-go]'))closeMobileMoreMenu();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobileMoreMenu();});
}

function bindMobileSettingsAccess(){
  const btn=document.getElementById('mobileSettingsBtn');
  if(!btn)return;
  btn.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    closeMobileMoreMenu();
    setTimeout(()=>openAdminSettingsHub(),80);
  });
}


function openAdminSettingsHub(){
  const hub=document.getElementById('adminSettingsHub');
  if(!hub)return;
  const roleText=document.getElementById('settingsHubRoleText');
  if(roleText)roleText.textContent=isAdmin()?'관리자 전체 설정을 이용할 수 있습니다.':isOperator()?'진행자 운영 메뉴를 이용할 수 있습니다.':'관리자·진행자 로그인과 일반 설정을 이용할 수 있습니다.';
  hub.hidden=false;
  requestAnimationFrame(()=>hub.classList.add('open'));
  document.body.classList.add('settings-hub-open');
}
function closeAdminSettingsHub(){
  const hub=document.getElementById('adminSettingsHub');
  if(!hub)return;
  hub.classList.remove('open');
  document.body.classList.remove('settings-hub-open');
  setTimeout(()=>{if(!hub.classList.contains('open'))hub.hidden=true;},180);
}
function triggerSettingsSource(id){
  const source=document.getElementById(id);
  if(source)source.click();
}
window.openAdminSettingsHub=openAdminSettingsHub;
window.closeAdminSettingsHub=closeAdminSettingsHub;

function bindSettingsNavigationFallback(){
  document.addEventListener('click',event=>{
    const admin=event.target.closest?.('[data-settings-action="admin"]');
    if(admin){event.preventDefault();event.stopPropagation();closeAdminSettingsHub();setTimeout(()=>setRole('admin'),20);return;}
    const backup=event.target.closest?.('[data-settings-view="backup"]');
    if(backup){event.preventDefault();event.stopPropagation();closeAdminSettingsHub();setTimeout(()=>{navigatePortalView('settings',{pushHistory:true});setTimeout(()=>document.querySelector('.backup-recovery-manager')?.scrollIntoView({behavior:'smooth',block:'start'}),80);},20);}
  },true);
}

function bindAdminSettingsHub(){
  const settingsBtn=document.getElementById('openAdminSettingsHubBtn');if(settingsBtn){settingsBtn.onclick=(event)=>{event?.preventDefault();event?.stopPropagation();openAdminSettingsHub();};}
  document.querySelectorAll('[data-settings-hub-close]').forEach(el=>el.addEventListener('click',closeAdminSettingsHub));
  document.getElementById('adminSettingsHub')?.addEventListener('click',event=>{
    const action=event.target.closest('[data-settings-action]')?.dataset.settingsAction;
    const view=event.target.closest('[data-settings-view]')?.dataset.settingsView;
    if(action){
      const map={social:'openSocialLoginBtn',viewer:'roleViewerBtn',operator:'roleOperatorBtn',pin:'changeAdminPinBtn','save-recovery':'saveRecoveryBtn','open-recovery':'openRecoveryBtn'};
      closeAdminSettingsHub();
      if(action==='admin'){
        setTimeout(()=>setRole('admin'),80);
        return;
      }
      if(action==='rehearsal-unlock'){
        if(unlockRehearsalMode())setTimeout(()=>navigatePortalView('rehearsal',{pushHistory:true}),80);
        return;
      }
      if(action==='popup-manager'){closeAdminSettingsHub();setTimeout(openPopupManager,80);return;}
      if(action==='firebase-sync'){
        setTimeout(()=>{
          navigatePortalView('settings',{pushHistory:true});
          setTimeout(()=>{
            const section=document.getElementById('firebaseLiveSyncSection');
            if(section){
              section.scrollIntoView({behavior:'smooth',block:'start'});
              section.classList.add('settings-target-flash');
              setTimeout(()=>section.classList.remove('settings-target-flash'),1800);
            }
          },140);
        },80);
        return;
      }
      if(map[action])setTimeout(()=>triggerSettingsSource(map[action]),80);
      return;
    }
    if(view){
      closeAdminSettingsHub();
      if(view==='backup'){
        setTimeout(()=>{
          navigatePortalView('settings',{pushHistory:true});
          setTimeout(()=>{
            const section=document.querySelector('.backup-recovery-manager');
            if(section){
              section.scrollIntoView({behavior:'smooth',block:'start'});
              section.classList.add('settings-target-flash');
              setTimeout(()=>section.classList.remove('settings-target-flash'),1800);
            }
          },140);
        },80);
        return;
      }
      if(view==='notices'){
        setTimeout(()=>navigatePortalView('board',{pushHistory:true}),80);
        return;
      }
      if(view==='entry-admin'){
        setTimeout(()=>{
          navigatePortalView('entry',{pushHistory:true});
          setTimeout(()=>{
            renderApplicationPortal();
            const section=document.querySelector('#view-entry .entry-admin-manager');
            if(section){
              section.scrollIntoView({behavior:'smooth',block:'start'});
              section.classList.add('settings-target-flash');
              setTimeout(()=>section.classList.remove('settings-target-flash'),1800);
            }
          },140);
        },80);
        return;
      }
      setTimeout(()=>navigatePortalView(view,{pushHistory:true}),80);
    }
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeAdminSettingsHub();});
}


const OPERATIONS_MANUAL_KEY='230MATCH_V3_OPERATIONS_MANUAL_CHECKLIST';
function manualChecklistState(){try{return JSON.parse(localStorage.getItem(OPERATIONS_MANUAL_KEY)||'{}')||{};}catch(_e){return {};}}
function renderOperationsManual(){
  const saved=manualChecklistState();
  const boxes=[...document.querySelectorAll('[data-manual-check]')];
  boxes.forEach(box=>{box.checked=Boolean(saved[box.dataset.manualCheck]);});
  const done=boxes.filter(x=>x.checked).length,total=boxes.length;
  const progress=document.getElementById('operationsManualProgress');
  if(progress){progress.className=`notice ${done===total&&total?'success':'info'}`;progress.textContent=total?`${done}/${total}개 확인${done===total?' · 대회 시작 준비 완료':' · 남은 항목을 확인하세요.'}`:'체크 항목이 없습니다.';}
}
function saveOperationsManualChecklist(){
  const data={};document.querySelectorAll('[data-manual-check]').forEach(box=>data[box.dataset.manualCheck]=box.checked);
  localStorage.setItem(OPERATIONS_MANUAL_KEY,JSON.stringify(data));renderOperationsManual();
}
function emergencyReportPayload(){
  return {format:'230MATCH_V3_EMERGENCY_REPORT',appBuild:BUILD_LABEL,createdAt:new Date().toISOString(),url:location.href,role:currentRole,online:navigator.onLine,tournament:{name:state.tournament?.name||'',division:state.tournament?.division||'',updatedAt:state.updatedAt||''},counts:{teams:state.teams?.length||0,prelimMatches:state.prelim?.matches?.length||0,mainMatches:state.draw?.matches?.length||0,courts:Array.isArray(state.courts)?state.courts.length:0,messageQueue:state.messaging?.queue?.length||0,logs:state.logs?.length||0},checklist:manualChecklistState(),diagnostics:typeof buildDiagnosticsPayload==='function'?buildDiagnosticsPayload():null,recentLogs:(state.logs||[]).slice(-30)};
}
function bindOperationsManual(){
  document.querySelectorAll('[data-manual-check]').forEach(box=>box.addEventListener('change',saveOperationsManualChecklist));
  document.getElementById('resetManualChecklistBtn')?.addEventListener('click',()=>{if(!confirm('운영 체크 상태를 모두 초기화할까요?'))return;localStorage.removeItem(OPERATIONS_MANUAL_KEY);renderOperationsManual();});
  document.getElementById('view-manual')?.addEventListener('click',async event=>{
    const go=event.target.closest('[data-manual-go]')?.dataset.manualGo;if(go){navigatePortalView(go,{pushHistory:true});return;}
    const action=event.target.closest('[data-manual-action]')?.dataset.manualAction;if(!action)return;
    if(action==='save-recovery'||action==='emergency-snapshot'){
      if(!canOperate())return notice('진행자 또는 관리자 권한이 필요합니다.','error');
      try{triggerSettingsSource('saveRecoveryBtn');if(action==='emergency-snapshot')downloadJson(`230match-emergency-${Date.now()}.json`,emergencyReportPayload());notice('현재 복구점과 비상 보고서를 준비했습니다.','success');}catch(e){notice('비상 저장 실패: '+(e.message||e),'error');}
    }else if(action==='download-emergency-report'){downloadJson(`230match-emergency-${Date.now()}.json`,emergencyReportPayload());notice('비상 진단 보고서를 저장했습니다.','success');}
  });
  renderOperationsManual();
}


function createStage3261TestApplications(){
  if(!requireAdmin('테스트 참가 신청 생성'))return;
  state.portal=state.portal||{};state.portal.applications=state.portal.applications||[];
  if(state.portal.applications.length&&!confirm('기존 참가 신청이 있습니다. 테스트 신청 4팀을 추가할까요?'))return;
  const now=Date.now();
  const names=[['테스트 홍길동','테스트 김철수'],['테스트 이영희','테스트 박민수'],['테스트 최서윤','테스트 정우진'],['테스트 강민호','테스트 윤지아']];
  const clubs=['모던클럽','국제클럽','장유클럽','원도심클럽'];
  names.forEach((pair,i)=>{
    const p1=`0109000${String(i*2+1).padStart(4,'0')}`;
    const p2=`0109000${String(i*2+2).padStart(4,'0')}`;
    state.portal.applications.push({id:`test-app-${now}-${i}`,code:`TEST${String(i+1).padStart(2,'0')}`,tournamentId:state.tournament?.id||'current',tournamentName:state.tournament?.name||'현재 대회',tournamentDivision:state.tournament?.division||'',teamName:`${pair[0]} / ${pair[1]}`,affiliation:clubs[i],phone:p1,players:[{name:pair[0],club:clubs[i],phone:p1},{name:pair[1],club:clubs[i],phone:p2}],representativeIndex:0,status:i===3?'reserve':'pending',paid:false,createdAt:new Date(now+i*1000).toISOString(),updatedAt:new Date(now+i*1000).toISOString(),memo:'Stage32.6.1 기능 점검용 테스트 신청'});
  });
  commit('테스트 참가 신청 4팀 생성');
  renderApplicationPortal();
  notice('테스트 참가 신청 4팀을 만들었습니다. 승인·후보·입금·문자 기능을 점검하세요.','success');
}
function bindPortal(){
  bindMobileMoreMenu();bindMobileSettingsAccess();
  document.getElementById('createTestApplicationsBtn')?.addEventListener('click',createStage3261TestApplications);
  document.addEventListener('click',event=>{const btn=event.target.closest?.('#createTestApplicationsBtn');if(btn&&!btn.dataset.stage3262Handled){event.preventDefault();btn.dataset.stage3262Handled='1';try{createStage3261TestApplications();}finally{setTimeout(()=>delete btn.dataset.stage3262Handled,50);}}},true);
  bindAdminSettingsHub();
  bindSettingsNavigationFallback();
  bindOperationsManual();
  bindTournamentList();
  document.querySelectorAll('[data-portal-go]').forEach(btn => {
    btn.dataset.portalBound='1';btn.addEventListener('click', () => navigatePortalView(btn.dataset.portalGo, { pushHistory: true }));
  });
  document.getElementById('mobileBackBtn')?.addEventListener('click',()=>{if(history.length>1)history.back();else navigatePortalView('home',{pushHistory:true});});
  document.getElementById('editTournamentGuideBtn')?.addEventListener('click',openTournamentGuideEditor);
  document.getElementById('cancelTournamentGuideBtn')?.addEventListener('click',()=>{const el=document.getElementById('tournamentGuideEditor');if(el)el.hidden=true;});
  document.getElementById('saveTournamentGuideBtn')?.addEventListener('click',saveTournamentGuide);
  document.getElementById('copyGuideAccountBtn')?.addEventListener('click',copyTournamentGuideAccount);
  document.getElementById('newBoardPostBtn')?.addEventListener('click',()=>openBoardPostEditor());
  document.getElementById('cancelBoardPostBtn')?.addEventListener('click',clearBoardPostForm);
  document.getElementById('saveBoardPostBtn')?.addEventListener('click',saveBoardPost);
  document.getElementById('boardPostImageInput')?.addEventListener('change',e=>{if(e.target.files?.[0])stage4108HandleNoticeImage(e.target.files[0]);});
  document.getElementById('removeBoardPostImageBtn')?.addEventListener('click',()=>{stage4108PendingNoticeImage='';stage4108PendingNoticeImageName='';stage4108PendingNoticeImageType='';stage4108PendingNoticeStoragePath='';stage4108RenderNoticeImagePreview();const input=document.getElementById('boardPostImageInput');if(input)input.value='';});
  document.getElementById('closePopupManagerBtn')?.addEventListener('click',closePopupManager);document.getElementById('popupManagerDoneBtn')?.addEventListener('click',closePopupManager);document.getElementById('popupManagerNewNoticeBtn')?.addEventListener('click',()=>{closePopupManager();navigatePortalView('board',{pushHistory:true});setTimeout(()=>openBoardPostEditor(),80);});
  document.getElementById('popupManagerList')?.addEventListener('click',e=>{const btn=e.target.closest('[data-popup-save]');if(btn)savePopupManagerItem(btn.closest('[data-popup-manager-id]'));});
  document.getElementById('archiveCurrentResultBtn')?.addEventListener('click',archiveCurrentResult);
  document.getElementById('myMatchSearchBtn')?.addEventListener('click',searchMyMatch);
  document.getElementById('myMatchSearchInput')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();searchMyMatch();}});
  document.getElementById('myMatchSearchInput')?.addEventListener('input',()=>{const value=document.getElementById('myMatchSearchInput')?.value||'';if(myMatchNormalize(value).length>=2)searchMyMatch();});
  document.getElementById('myMatchClearBtn')?.addEventListener('click',()=>{const input=document.getElementById('myMatchSearchInput');if(input)input.value='';const choices=document.getElementById('myMatchTeamChoices');if(choices)choices.innerHTML='';const result=document.getElementById('myMatchResult');if(result){result.className='my-match-result empty-state';result.innerHTML='<p>검색할 선수 이름이나 팀명을 입력하세요.</p>';}const guide=document.getElementById('myMatchSearchGuide');if(guide)guide.textContent='두 글자 이상 입력하면 일치하는 팀을 보여줍니다.';});
  document.getElementById('homeNoticePopupClose')?.addEventListener('click',closeHomeNoticePopup);document.getElementById('homeNoticePopupConfirm')?.addEventListener('click',closeHomeNoticePopup);document.getElementById('homeNoticePopupBoard')?.addEventListener('click',()=>{closeHomeNoticePopup();navigatePortalView('board',{pushHistory:true});});
  document.addEventListener('click',e=>{const portal=e.target.closest?.('[data-portal-go]');if(portal&&!portal.dataset.portalBound){navigatePortalView(portal.dataset.portalGo,{pushHistory:true});return;}const choice=e.target.closest?.('[data-my-match-index]');if(choice){const teams=document.getElementById('myMatchTeamChoices')?._teams||[];const team=teams[Number(choice.dataset.myMatchIndex)];if(team)renderMyMatchTeam(team);return;}const edit=e.target.closest?.('[data-board-edit]');if(edit&&isAdmin()){const post=state.portal.posts.find(p=>p.id===edit.dataset.boardEdit);if(post)openBoardPostEditor(post);return;}const btn=e.target.closest?.('[data-board-delete]');if(!btn||!isAdmin())return;if(!confirm('이 게시물을 삭제할까요?'))return;const deleting=state.portal.posts.find(p=>p.id===btn.dataset.boardDelete);if(deleting?.imageStoragePath)deleteManagedImage(deleting.imageStoragePath);state.portal.posts=state.portal.posts.filter(p=>p.id!==btn.dataset.boardDelete);commit('게시판 공지 삭제');renderPortalViews();});
}

window.addEventListener('pagehide',()=>{try{safePersistState('페이지 종료 전');}catch(_error){}});
window.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){try{safePersistState('화면 전환 전');}catch(_error){}}});

document.getElementById('openSocialLoginBtn')?.addEventListener('click',openSocialLogin);
document.getElementById('socialLoginCloseBtn')?.addEventListener('click',closeSocialLogin);
document.getElementById('googleSocialLoginBtn')?.addEventListener('click',handleGoogleLogin);
document.getElementById('kakaoSocialLoginBtn')?.addEventListener('click',()=>handleExternalLogin('kakao'));
document.getElementById('naverSocialLoginBtn')?.addEventListener('click',()=>handleExternalLogin('naver'));
document.getElementById('socialLogoutBtn')?.addEventListener('click',handleSocialLogout);
document.getElementById('saveAuthSettingsBtn')?.addEventListener('click',saveAuthSettingsPanel);
loadAuthSettingsPanel();renderAuthStatus();startAuth((user,role,error,profile)=>{if(error)notice('간편로그인 연결 오류: '+(error.message||error),'error');applyAuthenticatedRole(user,role,profile);renderNotificationStatus();});

prepareRecoveryStorage().catch(error=>console.warn('로컬 복구점 저장소 준비 실패',error));
syncInputs();syncPrelimInputs();bind();bindPortal();bindPrintCenter();bindParticipantManager();bindEntryApplications();bindPublicParticipantRecords();bindResultArchive();bindTournamentLifecycleManager();bindBackupRecoveryManager();bindNotificationCenter();bindTournamentReadiness();bindAcceptanceCenter();bindRehearsalCenter();bindPerformanceCenter();bindDiagnosticsCenter();window.addEventListener('popstate',()=>navigatePortalView(location.hash.replace(/^#/, '')||'home',{focus:false}));initialPortalView();renderVenueSettingsEditor();calculateTimeMetrics(state);render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});renderOperatorControls();updateSetupProgress();applyRoleUI();renderPortalViews();autoSmsSnapshot=buildAutoSmsSnapshot();restartTimeTimer();updateClock();setInterval(updateClock,1000);installUnifiedMoveControlGuard();ensureUnifiedCourtMoveControls();
loadSyncPanel();startStateSync({getState:()=>state,applyRemoteState:next=>applySynchronizedState(next,'다른 기기'),onStatus:updateSyncPanel,canWrite:()=>isAdmin()||isOperator()});
const buildStageLabel=document.getElementById('buildStageLabel');
window.closeAutoSmsDialog=closeAutoSmsDialog;window.approveAutoSmsAligo=approveAutoSmsAligo;window.approveAutoSmsPhone=approveAutoSmsPhone;window.copyAutoSms=copyAutoSms;window.previewCurrentCourtSms=previewCurrentCourtSms;
if(buildStageLabel)buildStageLabel.textContent=BUILD_LABEL;
document.documentElement.dataset.build='3421';
console.log('[230MATCH] 61.0.8 ready · notice images and popup manager');


// Stage 31.2: presentation-only operation workspace controller.
// Core tournament, draw, court and result state models are unchanged.
(function initCompactOperationWorkspace(){
  const workspace=document.getElementById('view-operation');
  if(!workspace)return;
  const buttons=[...workspace.querySelectorAll('[data-operation-section]')];
  const valid=new Set(['courts','groups','main','setup']);
  const storageKey='230match-v3-operation-section';
  function setMode(mode,{scroll=false}={}){
    const next=currentRole==='viewer'?'courts':(valid.has(mode)?mode:'courts');
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
  const bracketJump=document.getElementById('operationGoBracketBtn');
  if(bracketJump)bracketJump.onclick=()=>{
    document.querySelector('.tab[data-view="bracket"]')?.click();
  };
})();


// Stage 31.60: final deployment stabilization layer.
(function initFinalDeploymentStability(){
  const LAST_GOOD_KEY='230match-v3-last-known-good';
  const saveLastKnownGood=()=>{
    // 전체 상태를 localStorage에 중복 저장하면 브라우저 5MB 한도를 초과합니다.
    // 실제 복구점은 IndexedDB와 Firebase V5가 담당하고, 여기에는 작은 확인 정보만 남깁니다.
    try{
      const payload={build:BUILD_LABEL,savedAt:new Date().toISOString(),updatedAt:state?.updatedAt||'',tournamentId:state?.tournament?.id||'',tournamentName:state?.tournament?.name||''};
      localStorage.setItem(LAST_GOOD_KEY,JSON.stringify(payload));
    }catch(error){try{localStorage.removeItem(LAST_GOOD_KEY);}catch(_e){}console.warn('마지막 정상 상태 표식 저장 실패',error);}
  };
  const verifyAssets=()=>{
    const required=['openAdminSettingsHubBtn','adminSettingsHub','view-home','view-operation','view-entry','view-bracket'];
    const missing=required.filter(id=>!document.getElementById(id));
    if(missing.length){
      storeDiagnosticEntry({level:'error',message:`필수 화면 요소 누락: ${missing.join(', ')}`});
      console.error('[230MATCH V3] required UI missing',missing);
      return false;
    }
    return true;
  };
  const setNetworkBadge=()=>{
    const badge=document.getElementById('saveStateBadge');
    if(!badge)return;
    if(!navigator.onLine){badge.textContent='오프라인 · 로컬 저장';badge.classList.add('badge-warning');}
    else if(badge.textContent.includes('오프라인')){badge.textContent='자동 저장 ON';badge.classList.remove('badge-warning');}
  };
  window.addEventListener('online',()=>{setNetworkBadge();notice('네트워크 연결이 복구되었습니다.','success');});
  window.addEventListener('offline',()=>{setNetworkBadge();notice('오프라인 상태입니다. 현재 기기에 계속 저장합니다.','warning');});
  document.addEventListener('click',event=>{const btn=event.target.closest('[data-settings-action="prelim-pilot"]');if(!btn)return;event.preventDefault();event.stopPropagation();if(!requireAdmin('예선 실전 점검'))return;if(window.closeAdminSettingsHub)window.closeAdminSettingsHub();showView('operation');setOperationSection('setup');setTimeout(()=>document.getElementById('prelimPilotPanel')?.scrollIntoView({behavior:'smooth',block:'start'}),120);});
  window.addEventListener('beforeunload',()=>{try{saveState(state);saveLastKnownGood();}catch(_error){}});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){try{saveState(state);saveLastKnownGood();}catch(_error){}}});
  // 4.3 core: no timer-driven full-state save. Persist only on real changes / page hide.
  // This removes periodic UI stalls during typing and testing.
  setTimeout(()=>{
    const ok=verifyAssets();
    setNetworkBadge();
    saveLastKnownGood();
    if(ok)void 0;
  },0);
})();


// Stage 31.64: mobile usability final polish.
(function initMobileUsabilityFinalPolish(){
  const root=document.documentElement;
  const body=document.body;
  const mobileQuery=window.matchMedia('(max-width: 700px)');
  const setViewportUnit=()=>root.style.setProperty('--app-vh',`${window.innerHeight*0.01}px`);
  const applyMode=()=>{
    const mobile=mobileQuery.matches;
    body.classList.toggle('mobile-ux-mode',mobile);
    root.dataset.mobileUx=mobile?'1':'0';
  };
  setViewportUnit();applyMode();
  window.addEventListener('resize',()=>{setViewportUnit();applyMode();},{passive:true});
  window.visualViewport?.addEventListener('resize',()=>{
    setViewportUnit();
    const keyboardOpen=window.visualViewport.height < window.innerHeight*0.72;
    body.classList.toggle('mobile-keyboard-open',keyboardOpen);
  });
  mobileQuery.addEventListener?.('change',applyMode);

  let topButton=document.getElementById('mobileScrollTopBtn');
  if(!topButton){
    topButton=document.createElement('button');
    topButton.id='mobileScrollTopBtn';
    topButton.type='button';
    topButton.className='mobile-scroll-top';
    topButton.setAttribute('aria-label','화면 맨 위로 이동');
    topButton.textContent='↑';
    document.body.appendChild(topButton);
  }
  topButton.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
  const updateTopButton=()=>topButton.classList.toggle('show',mobileQuery.matches&&window.scrollY>420);
  window.addEventListener('scroll',updateTopButton,{passive:true});updateTopButton();

  // Dense tables remain usable on small screens without changing their data.
  document.querySelectorAll('table').forEach(table=>{
    if(table.closest('.mobile-table-scroll'))return;
    const wrapper=document.createElement('div');
    wrapper.className='mobile-table-scroll';
    table.parentNode?.insertBefore(wrapper,table);
    wrapper.appendChild(table);
  });

  // Keep the focused form field visible above the mobile keyboard.
  document.addEventListener('focusin',event=>{
    if(!mobileQuery.matches)return;
    const field=event.target.closest?.('input,select,textarea');
    if(!field)return;
    setTimeout(()=>field.scrollIntoView({block:'center',behavior:'smooth'}),180);
  });

  // Close auxiliary sheets after navigation and restore page scrolling reliably.
  document.addEventListener('click',event=>{
    if(!event.target.closest?.('[data-portal-go]'))return;
    document.body.classList.remove('mobile-sheet-open');
  });

  // Mark horizontal overflow areas so users receive a subtle visual cue.
  const markOverflow=()=>document.querySelectorAll('.mobile-table-scroll,.mode-tabs,.operation-mode-bar').forEach(el=>{
    el.classList.toggle('has-horizontal-overflow',el.scrollWidth>el.clientWidth+4);
  });
  setTimeout(markOverflow,250);
  window.addEventListener('resize',markOverflow,{passive:true});
  // 성능 안정화: main 전체 DOM 감시 제거. 화면 이동과 리사이즈 때만 오버플로 표시를 계산한다.
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-portal-go],[data-view]'))setTimeout(markOverflow,80);},true);
})();

void 0;


// Stage 32.4.1 stable delegated action bridge
(function installEntryActionBridge(){
  if(window.__stage3241EntryActionBridge)return;
  window.__stage3241EntryActionBridge=true;
  document.addEventListener('click',function(e){
    const target=e.target instanceof Element?e.target:null;
    if(!target)return;
    const action=target.closest('[data-entry-action]');
    const payment=target.closest('[data-entry-payment]');
    const refund=target.closest('[data-entry-refund]');
    const sms=target.closest('[data-entry-sms]');
    if(!(action||payment||refund||sms))return;
    e.preventDefault();
    e.stopPropagation();
    try{
      if(action)processEntryApplication(action.dataset.entryId,action.dataset.entryAction);
      else if(payment)toggleEntryPayment(payment.dataset.entryPayment);
      else if(refund)refundEntryPayment(refund.dataset.entryRefund);
      else if(sms)manualEntrySms(sms.dataset.entrySms);
    }catch(err){
      console.error('[Stage32.4.1] entry action failed',err);
      if(typeof notice==='function')notice(`처리 중 오류: ${err?.message||err}`,'error');
      else alert(`처리 중 오류: ${err?.message||err}`);
    }
  },true);
})();

// Stage 32.4 registration payment and promotion SMS
document.addEventListener('DOMContentLoaded',()=>setTimeout(bindEntrySmsDialog,0),{once:true});


// Stage 32.5.2 · member profile, SMS target, delete request
function v3252ProfileDefaults(){const p=currentAuthUser?.appProfile||{};const d=p.registrationDefaults||{};return{name:String(d.name||p.name||currentAuthUser?.displayName||''),club:String(d.club||p.club||p.affiliation||''),phone:String(d.phone||p.phone||p.mobile||'').replace(/\D/g,'')};}
async function v3252SaveProfile(players,representative){if(!currentAuthUser)return;try{const mine=players.find(p=>myMatchNormalize(p.name)===myMatchNormalize(authUserLabel()))||representative;const rt=await getAuthRuntime();if(!rt?.db||!rt?.user)return;await rt.api.setDoc(rt.api.doc(rt.db,'users',rt.user.uid),{name:mine.name||authUserLabel(),phone:mine.phone||'',club:mine.club||'',registrationDefaults:{name:mine.name||'',phone:mine.phone||'',club:mine.club||''},updatedAt:new Date().toISOString()},{merge:true});currentAuthUser.appProfile={...(currentAuthUser.appProfile||{}),name:mine.name||authUserLabel(),phone:mine.phone||'',club:mine.club||'',registrationDefaults:{name:mine.name||'',phone:mine.phone||'',club:mine.club||''}};}catch(e){console.warn('[32.5.2] profile save failed',e)}}
function v3252AutofillEntry(){if(!currentAuthUser||entryEditingId)return;const d=v3252ProfileDefaults();[['entryPlayer1Name',d.name],['entryPlayer1Club',d.club],['entryPlayer1Phone',d.phone]].forEach(([id,v])=>{const el=document.getElementById(id);if(el&&!el.value&&v)el.value=v;});}
function v3252Recipients(item){const ps=entryApplicationPlayers(item).filter(p=>/^01[016789]\d{7,8}$/.test(String(p.phone||'').replace(/\D/g,'')));const list=item?.smsTargetMode==='both'?ps:[ps[Number(item?.representativeIndex||0)]||ps[0]].filter(Boolean);const seen=new Set();return list.filter(p=>{const k=String(p.phone).replace(/\D/g,'');if(!k||seen.has(k))return false;seen.add(k);return true;});}
function v3252CanEdit(item,lookup=''){return !!item&&item.status==='pending'&&((currentAuthUser&&item.ownerUid===currentAuthUser.uid)||entryApplicationPlayers(item).some(p=>p.phone===lookup));}
function v3252DeleteRequest(id){const item=(state.portal?.applications||[]).find(a=>a.id===id);const lookup=String(document.getElementById('entryLookupPhone')?.value||'').replace(/\D/g,'');if(!v3252CanEdit(item,lookup))return notice('로그인한 본인의 승인 대기 신청만 삭제 요청할 수 있습니다.','error');if(!confirm(`${item.teamName} 참가 신청의 삭제를 관리자에게 요청할까요?`))return;item.status='delete_requested';item.deleteRequestedAt=new Date().toISOString();item.updatedAt=item.deleteRequestedAt;commit(`참가 신청 삭제 요청 · ${item.teamName}`);lookupPublicApplication();renderApplicationPortal();notice('삭제 요청을 접수했습니다. 관리자가 확인 후 삭제합니다.','success');}
function v3252AdminDelete(id){if(!requireAdmin('참가 신청 삭제'))return;const item=(state.portal?.applications||[]).find(a=>a.id===id);if(!item)return;if(!confirm(`${item.teamName} 참가 신청을 최종 삭제할까요?`))return;state.portal.applications=state.portal.applications.filter(a=>a.id!==id);commit(`참가 신청 관리자 삭제 · ${item.teamName}`);renderApplicationPortal();lookupPublicApplication();notice('참가 신청을 삭제했습니다.','success');}
function v3252AutoMyMatch(){
  if(!currentAuthUser)return;
  const profile=currentAuthUser.appProfile||{};
  const phone=String(v3252ProfileDefaults().phone||'').replace(/\D/g,'');
  const name=myMatchNormalize(profile.name||currentAuthUser.displayName||'');
  const uid=String(currentAuthUser.uid||'');
  const scored=myMatchUniqueTeams().map(team=>{
    let score=0;
    if(uid&&String(team.ownerUid||team.applicationOwnerUid||'')===uid)score+=100;
    const contact=String(getTeamContact(state,team)?.phone||'').replace(/\D/g,'');
    const phones=[contact,...(team.playerPhones||[]),...(team.players||[]).map(p=>p?.phone)].map(x=>String(x||'').replace(/\D/g,'')).filter(Boolean);
    if(phone&&phones.includes(phone))score+=60;
    const names=[...(team.players||[]).map(p=>p?.name),team.player1Name,team.player2Name,team.nameA,team.nameB].map(myMatchNormalize).filter(Boolean);
    if(name&&names.includes(name))score+=30;
    return{team,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||portalTeam(a.team).localeCompare(portalTeam(b.team),'ko'));
  if(!scored.length)return;
  const best=scored[0];
  const input=document.getElementById('myMatchSearchInput');if(input)input.value=portalTeam(best.team);
  renderMyMatchTeam(best.team);
  const guide=document.getElementById('myMatchSearchGuide');if(guide)guide.textContent=scored.length>1?'로그인 정보와 가장 잘 일치하는 본인 팀을 먼저 표시했습니다. 다른 팀은 검색할 수 있습니다.':'로그인 정보와 일치하는 본인 경기를 자동 표시했습니다. 다른 선수·팀도 검색할 수 있습니다.';
}
const v3252OriginalSubmit=submitPublicApplication;submitPublicApplication=function(){const before=(state.portal?.applications||[]).length;const data=entryApplicationPlayersFromForm();const result=v3252OriginalSubmit.apply(this,arguments);if((state.portal?.applications||[]).length>before)v3252SaveProfile(data.players,data.representative);return result;};
const v3252OriginalEdit=editEntryApplication;editEntryApplication=function(id){const item=(state.portal?.applications||[]).find(a=>a.id===id);const lookup=String(document.getElementById('entryLookupPhone')?.value||'').replace(/\D/g,'');if(!v3252CanEdit(item,lookup))return notice('로그인한 본인 또는 등록 연락처로 확인된 승인 대기 신청만 수정할 수 있습니다.','error');return v3252OriginalEdit(id);};
const v3252OriginalSmsDialog=openEntrySmsDialog;openEntrySmsDialog=function(kind,item){entrySmsItem={kind,item};document.getElementById('entrySmsTitle').textContent=({approve:'참가 승인 문자',reserve:'후보 등록 문자',promote:'일반 참가 승격 문자',payment:'입금 완료 문자',reject:'신청 반려 문자',refund:'환불 완료 문자'})[kind]||'참가 신청 문자 확인';document.getElementById('entrySmsTarget').textContent=v3252Recipients(item).map(p=>`${p.name} · ${p.phone}`).join(' / ')||'수신번호 없음';document.getElementById('entrySmsBody').value=entrySmsMessage(kind,item);document.getElementById('entrySmsDialog')?.showModal();};
sendEntrySmsAligo=async function(){if(!entrySmsItem)return;const body=document.getElementById('entrySmsBody')?.value?.trim()||'';try{await sendAligoSmsV3(v3252Recipients(entrySmsItem.item),body,{source:'registration',kind:entrySmsItem.kind,title:'230MATCH 참가 안내'});entrySmsItem.item.smsHistory=entrySmsItem.item.smsHistory||[];entrySmsItem.item.smsHistory.unshift({kind:entrySmsItem.kind,channel:'aligo',sentAt:new Date().toISOString(),body});commit(`참가 안내 문자 발송 · ${entrySmsItem.item.teamName}`);notice('알리고 문자를 발송했습니다.','success');closeEntrySmsDialog();renderApplicationPortal();}catch(e){notice(`문자 발송 실패: ${e.message||e}`,'error')}};
const v3252RenderApplications=renderApplicationPortal;renderApplicationPortal=function(){v3252RenderApplications.apply(this,arguments);document.querySelectorAll('.entry-admin-row').forEach(row=>{const sms=row.querySelector('[data-entry-sms]');if(!sms)return;const id=sms.dataset.entrySms;const item=(state.portal?.applications||[]).find(a=>a.id===id);if(!item)return;if(!row.querySelector('[data-entry-sms-mode]')){const sel=document.createElement('select');sel.className='entry-sms-target-select';sel.dataset.entrySmsMode=id;sel.innerHTML=`<option value="representative">대표전화만</option><option value="both">두 선수 모두</option>`;sel.value=item.smsTargetMode==='both'?'both':'representative';sms.before(sel)}if(item.status==='delete_requested'&&!row.querySelector('[data-entry-admin-delete]')){const b=document.createElement('button');b.type='button';b.className='btn btn-danger-outline btn-small';b.dataset.entryAdminDelete=id;b.textContent='삭제 승인';row.querySelector('.entry-actions')?.appendChild(b)}});setTimeout(v3252AutofillEntry,0)};
document.addEventListener('change',e=>{const sel=e.target.closest?.('[data-entry-sms-mode]');if(!sel)return;const item=(state.portal?.applications||[]).find(a=>a.id===sel.dataset.entrySmsMode);if(item){item.smsTargetMode=sel.value==='both'?'both':'representative';commit(`문자 수신대상 설정 · ${item.teamName}`)}});
document.addEventListener('click',e=>{const cancel=e.target.closest?.('[data-entry-cancel]');if(cancel){e.preventDefault();e.stopImmediatePropagation();v3252DeleteRequest(cancel.dataset.entryCancel);return}const del=e.target.closest?.('[data-entry-admin-delete]');if(del){e.preventDefault();e.stopImmediatePropagation();v3252AdminDelete(del.dataset.entryAdminDelete)}} ,true);
window.addEventListener('hashchange',()=>{if(location.hash==='#entry')setTimeout(v3252AutofillEntry,50);if(location.hash==='#my-match')setTimeout(v3252AutoMyMatch,50)});
document.addEventListener('DOMContentLoaded',()=>{setTimeout(v3252AutofillEntry,300);if(location.hash==='#my-match')setTimeout(v3252AutoMyMatch,400)});


// Stage 32.6 · Main draw, SMS and multi-device final pilot
let stage326PilotReport=null;
function stage326Hash(value){
  const text=typeof value==='string'?value:JSON.stringify(value);
  let h=2166136261;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0).toString(16).padStart(8,'0');
}
function stage326Snapshot(){
  const matches=typeof allMatches==='function'?allMatches(state):[];
  const courts=Array.isArray(state.courts)?state.courts:[];
  const teams=Array.isArray(state.teams)?state.teams:[];
  const active=teams.filter(t=>t.status!=='reserve');
  const contacts=active.filter(t=>{
    const phones=[t.phone,t.phone1,t.phone2,t.representativePhone,...(Array.isArray(t.players)?t.players.map(p=>typeof p==='object'?p.phone:''):[])];
    return phones.some(v=>/^01[016789]\d{7,8}$/.test(String(v||'').replace(/\D/g,'')));
  });
  const compact={
    tournament:{name:state.tournament?.name||'',division:state.tournament?.division||''},
    teams:active.map(t=>({id:t.id||'',name:t.name||t.teamName||'',status:t.status||'active'})),
    prelim:{groups:(state.prelim?.groups||[]).map(g=>({id:g.id||'',teams:g.teams||[],court:g.court||''})),matches:(state.prelim?.matches||[]).map(m=>({id:m.id||'',winner:m.winner??null,status:m.status||'',court:m.court||''}))},
    main:matches.map(m=>({id:m.id||'',round:m.round||'',winner:m.winner??null,status:m.status||'',court:m.court||''})),
    courts:courts.map(c=>({id:c.id||c.name||'',playing:c.playing||null,wait1:c.wait1||null,queue:c.queue||[]})),
    updatedAt:state.updatedAt||''
  };
  return {matches,courts,active,contacts,compact,checksum:stage326Hash(compact)};
}
function stage326SetStatus(message,type='info'){
  const el=document.getElementById('stage326PilotStatus');if(!el)return;
  el.className=`notice ${type}`;el.textContent=message;
}
function stage326Check(label,ok,detail,warning=false){return{label,ok:!!ok,detail:String(detail||''),warning:!!warning}}
function stage326BuildReport(){
  const s=stage326Snapshot();
  const ids=s.matches.map(m=>String(m.id||'')).filter(Boolean);
  const duplicateIds=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
  const occupied=[];
  s.courts.forEach(c=>{if(c.playing)occupied.push(String(c.playing));if(c.wait1)occupied.push(String(c.wait1));(c.queue||[]).forEach(x=>occupied.push(String(x)))});
  const duplicateCourt=[...new Set(occupied.filter((id,i)=>occupied.indexOf(id)!==i))];
  const cfg=getSyncSettings?.()||{};
  const hasMain=s.matches.length>0;
  const linked=state.prelim?.linkedDraw?.active===true||state.draw?.linked===true||hasMain;
  const pendingMessages=(state.messaging?.queue||[]).filter(x=>x.status!=='sent').length;
  const checks=[
    stage326Check('현재 대회 기본정보',!!state.tournament?.name,`${state.tournament?.name||'대회명 없음'} · ${state.tournament?.division||'부서 미입력'}`),
    stage326Check('참가팀·연락처',s.active.length>0&&s.contacts.length===s.active.length,`${s.contacts.length}/${s.active.length}팀 연락처 확인`,s.active.length>0&&s.contacts.length<s.active.length),
    stage326Check('예선 결과 준비',state.prelim?.locked===true||((state.prelim?.matches||[]).length>0&&(state.prelim?.matches||[]).every(m=>m.winner!==null&&m.winner!==undefined)),state.prelim?.locked?'예선 잠금 완료':`${(state.prelim?.matches||[]).filter(m=>m.winner!==null&&m.winner!==undefined).length}/${(state.prelim?.matches||[]).length}경기 결과`),
    stage326Check('본선 대진 생성',hasMain,hasMain?`${s.matches.length}경기 · ${state.draw?.size||state.settings?.drawSize||'-'}강`:'본선 대진이 아직 없습니다.'),
    stage326Check('본선 연결 상태',linked,linked?'예선 슬롯 또는 본선 대진 연결 확인':'연결 본선이 아직 준비되지 않았습니다.'),
    stage326Check('경기 ID 중복 없음',duplicateIds.length===0,duplicateIds.length?`중복 ${duplicateIds.length}건: ${duplicateIds.slice(0,4).join(', ')}`:`${ids.length}개 ID 정상`),
    stage326Check('코트 중복 배치 없음',duplicateCourt.length===0,duplicateCourt.length?`동일 경기 중복 배치 ${duplicateCourt.length}건`:`${s.courts.length}면 배치 정상`),
    stage326Check('문자 발송 준비',state.messaging?.settings?.autoMessageEnabled!==false&&s.contacts.length>0,`대기문자 ${pendingMessages}건 · 자동문자 ${state.messaging?.settings?.autoSmsApprovalEnabled===true?'승인창 사용':'승인창 꺼짐'}`,state.messaging?.settings?.autoSmsApprovalEnabled!==true),
    stage326Check('Firebase 대회방 설정',cfg.enabled===true&&!!cfg.roomId,cfg.enabled?`대회방 ${cfg.roomId||'미입력'}`:'실시간 동기화 꺼짐',cfg.enabled!==true),
    stage326Check('브라우저 온라인 상태',navigator.onLine,navigator.onLine?'온라인':'오프라인 · 로컬 저장만 가능')
  ];
  const fatal=checks.filter(x=>!x.ok&&!x.warning).length;
  const warnings=checks.filter(x=>!x.ok&&x.warning).length;
  return {format:'230MATCH_V3_STAGE326_PILOT',build:BUILD_LABEL,generatedAt:new Date().toISOString(),decision:fatal?'HOLD':'PASS',checksum:s.checksum,summary:{teams:s.active.length,contacts:s.contacts.length,prelimMatches:state.prelim?.matches?.length||0,mainMatches:s.matches.length,courts:s.courts.length,pendingMessages},sync:{enabled:cfg.enabled===true,roomId:cfg.roomId||'',collection:cfg.collection||'matchRoomsV5'},checks,warnings,fatal};
}
function stage326Render(report=stage326PilotReport){
  const s=stage326Snapshot();
  const map={stage326Teams:`${s.active.length}팀`,stage326MainMatches:`${s.matches.length}경기`,stage326Courts:`${s.courts.length}면`,stage326Checksum:s.checksum.toUpperCase()};
  Object.entries(map).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v});
  const badge=document.getElementById('stage326PilotBadge'),list=document.getElementById('stage326PilotChecks'),exp=document.getElementById('stage326ExportBtn');
  if(!report){if(badge){badge.className='badge badge-muted';badge.textContent='점검 전'};if(list)list.innerHTML='';if(exp)exp.disabled=true;return}
  if(badge){badge.className=`badge ${report.decision==='PASS'?'badge-success':'badge-warning'}`;badge.textContent=report.decision==='PASS'?'파일럿 통과':'확인 필요'}
  if(list)list.innerHTML=report.checks.map(x=>`<article class="${x.ok?'ok':x.warning?'warn':'fail'}"><b>${x.ok?'✓':x.warning?'△':'!'}</b><span><strong>${escapeHtml(x.label)}</strong><small>${escapeHtml(x.detail)}</small></span></article>`).join('');
  if(exp)exp.disabled=false;
}
async function stage326RunPilot(){
  if(!requireAdmin('본선·문자·다기기 파일럿'))return;
  try{
    stage326SetStatus('현재 상태를 복구점에 저장하고 최종 파일럿 점검을 실행하고 있습니다.');
    const rec=saveRecovery(state,`${state.tournament?.name||'대회'} · Stage32.6 파일럿 점검 전`);if(rec?.ready)await rec.ready;
    stage326PilotReport=stage326BuildReport();
    stage326Render(stage326PilotReport);
    stage326SetStatus(stage326PilotReport.decision==='PASS'?`파일럿 통과 · 기기 확인코드 ${stage326PilotReport.checksum.toUpperCase()}`:`필수 확인 ${stage326PilotReport.fatal}건 · 권장 확인 ${stage326PilotReport.warnings}건`,stage326PilotReport.decision==='PASS'?'success':'warning');
  }catch(e){console.error('[Stage32.6] pilot failed',e);stage326SetStatus(`점검 오류: ${e?.message||e}`,'error')}
}
async function stage326TestFirebase(){
  if(!requireAdmin('Firebase 다기기 점검'))return;
  try{stage326SetStatus('Firebase 대회방 읽기·쓰기 연결을 확인하고 있습니다.');const r=await testCloudConnection();stage326SetStatus(`Firebase 정상 · ${r.collection}/${r.roomId} · ${r.mode==='read-write'?'읽기/쓰기':'읽기 전용'} · 기기코드 ${stage326Snapshot().checksum.toUpperCase()}`,'success')}catch(e){stage326SetStatus(`Firebase 점검 실패: ${e?.message||e}`,'error')}
}
async function stage326CopyCode(){
  const code=stage326Snapshot().checksum.toUpperCase();
  const text=`230MATCH 다기기 확인코드 ${code} · ${state.tournament?.name||'대회'} · ${new Date().toLocaleString('ko-KR')}`;
  try{await navigator.clipboard.writeText(text);stage326SetStatus(`확인코드 ${code}를 복사했습니다. 다른 기기에서 같은 코드인지 확인하세요.`,'success')}catch{prompt('다른 기기에서 비교할 확인코드입니다.',text)}
}
function stage326Export(){if(!stage326PilotReport)return;downloadJson(`230MATCH_STAGE32_6_PILOT_${stage326PilotReport.checksum}.json`,stage326PilotReport)}
function stage326Bind(){
  document.getElementById('stage326RunBtn')?.addEventListener('click',stage326RunPilot);
  document.getElementById('stage326FirebaseBtn')?.addEventListener('click',stage326TestFirebase);
  document.getElementById('stage326CopyCodeBtn')?.addEventListener('click',stage326CopyCode);
  document.getElementById('stage326ExportBtn')?.addEventListener('click',stage326Export);
  stage326Render();
}
document.addEventListener('DOMContentLoaded',stage326Bind,{once:true});
document.addEventListener('click',event=>{const btn=event.target.closest?.('[data-settings-action="stage326-pilot"]');if(!btn)return;event.preventDefault();event.stopPropagation();if(!requireAdmin('본선·문자·다기기 파일럿'))return;if(window.closeAdminSettingsHub)window.closeAdminSettingsHub();showView('operation');setOperationSection('setup');setTimeout(()=>{document.getElementById('stage326PilotPanel')?.scrollIntoView({behavior:'smooth',block:'start'});stage326Render(stage326PilotReport)},120)},true);
void 0;


// Stage 32.6.5 · registration admin edit/delete and tournament quick links
function stage3264FindApplication(id){return (state.portal?.applications||[]).find(a=>String(a.id)===String(id))||null;}
function stage3264ApplicationTeam(item){
  if(!item)return null;
  return (state.teams||[]).find(t=>String(t.ownerUid||'')&&String(t.ownerUid||'')===String(item.ownerUid||''))
    ||(state.teams||[]).find(t=>myMatchNormalize(portalTeam(t))===myMatchNormalize(item.teamName));
}
function stage3264SyncApplicationTeam(item){
  const team=stage3264ApplicationTeam(item);if(!team)return;
  team.name=item.teamName;team.teamName=item.teamName;team.affiliation=item.affiliation;team.club=item.affiliation;
  team.players=structuredClone(entryApplicationPlayers(item));team.playerPhones=team.players.map(p=>p.phone).filter(Boolean);
  team.phone=item.phone;setTeamContact(state,team,{phone:item.phone});
}
function stage3264AdminEditApplicationPromptLegacy(id){
  if(!requireAdmin('참가 신청 수정'))return;
  const item=stage3264FindApplication(id);if(!item)return;
  const players=entryApplicationPlayers(item);
  const values=[];
  const labels=['선수 1 이름','선수 1 클럽','선수 1 전화번호','선수 2 이름','선수 2 클럽','선수 2 전화번호'];
  const defaults=[players[0]?.name||'',players[0]?.club||'',players[0]?.phone||'',players[1]?.name||'',players[1]?.club||'',players[1]?.phone||''];
  for(let i=0;i<labels.length;i++){const v=prompt(labels[i],defaults[i]);if(v===null)return;values.push(String(v).trim());}
  if(!values[0]||!values[1]||!values[2]||!values[3]||!values[4]||!values[5]){notice('두 선수의 이름·클럽·전화번호를 모두 입력하세요.','error');return;}
  if(!validatePhone(values[2].replace(/\D/g,''))||!validatePhone(values[5].replace(/\D/g,''))){notice('전화번호를 01012345678 형식으로 입력하세요.','error');return;}
  const rep=prompt('대표 연락처 선수 번호를 입력하세요. (1 또는 2)',String(Number(item.representativeIndex||0)+1));if(rep===null)return;
  const representativeIndex=String(rep).trim()==='2'?1:0;
  item.players=[{name:values[0],club:values[1],phone:values[2].replace(/\D/g,'')},{name:values[3],club:values[4],phone:values[5].replace(/\D/g,'')}];
  item.representativeIndex=representativeIndex;item.representativeName=item.players[representativeIndex].name;item.phone=item.players[representativeIndex].phone;
  item.teamName=item.players.map(p=>p.name).join(' / ');item.affiliation=item.players.map(p=>p.club).join(' / ');item.updatedAt=new Date().toISOString();
  stage3264SyncApplicationTeam(item);commit(`관리자 참가 신청 수정 · ${item.teamName}`);renderApplicationPortal();renderParticipantManager();lookupPublicApplication();notice('참가 신청과 참가팀 정보를 수정했습니다.','success');
}
function stage3264DeleteApplication(id,label='바로 삭제'){
  if(!requireAdmin('참가 신청 삭제'))return;
  const item=stage3264FindApplication(id);if(!item)return;
  if(!confirm(`${item.teamName} 참가 신청을 ${label}할까요?\n승인·후보 명단에 등록된 팀도 함께 제거됩니다.`))return;
  const team=stage3264ApplicationTeam(item);if(team){state.teams=(state.teams||[]).filter(t=>String(t.id)!==String(team.id));if(state.prelim){state.prelim.activeTeams=(state.prelim.activeTeams||[]).filter(t=>String(t.id)!==String(team.id));state.prelim.reserveTeams=(state.prelim.reserveTeams||[]).filter(t=>String(t.id)!==String(team.id));}}
  state.portal.applications=(state.portal.applications||[]).filter(a=>String(a.id)!==String(id));commit(`관리자 참가 신청 ${label} · ${item.teamName}`);renderApplicationPortal();renderParticipantManager();lookupPublicApplication();notice('참가 신청을 삭제했습니다.','success');
}
const stage3264BaseRenderApplications=renderApplicationPortal;
renderApplicationPortal=function(){
  stage3264BaseRenderApplications.apply(this,arguments);
  document.querySelectorAll('.entry-admin-row').forEach(row=>{
    const anchor=row.querySelector('[data-entry-sms]');if(!anchor)return;const id=anchor.dataset.entrySms;const item=stage3264FindApplication(id);if(!item)return;
    const actions=row.querySelector('.entry-actions');if(!actions)return;
    if(!row.querySelector('[data-entry-admin-edit]')){const b=document.createElement('button');b.type='button';b.className='btn btn-light btn-small';b.dataset.entryAdminEdit=id;b.textContent='수정';actions.appendChild(b);}
    if(item.status==='delete_requested'){
      let b=row.querySelector('[data-entry-admin-delete]');if(!b){b=document.createElement('button');b.type='button';b.className='btn btn-danger-outline btn-small';b.dataset.entryAdminDelete=id;actions.appendChild(b);}b.textContent='삭제 승인';
    }
    if(!row.querySelector('[data-entry-admin-force-delete]')){const b=document.createElement('button');b.type='button';b.className='btn btn-danger-outline btn-small';b.dataset.entryAdminForceDelete=id;b.textContent='바로 삭제';actions.appendChild(b);}
  });
};
const stage3264BaseLookup=lookupPublicApplication;
lookupPublicApplication=function(){
  stage3264BaseLookup.apply(this,arguments);
  const phone=String(document.getElementById('entryLookupPhone')?.value||'').replace(/\D/g,'');
  document.querySelectorAll('#entryLookupResult .entry-status-card').forEach((card,index)=>{
    const rows=(state.portal?.applications||[]).filter(a=>a.phone===phone||entryApplicationPlayers(a).some(p=>p.phone===phone)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    const item=rows[index];if(!item||['cancelled','delete_requested'].includes(item.status))return;
    let actions=card.querySelector('.entry-public-actions');if(!actions){actions=document.createElement('div');actions.className='entry-public-actions';card.appendChild(actions);}
    if(item.status==='pending'&&!actions.querySelector('[data-entry-edit]'))actions.insertAdjacentHTML('beforeend',`<button type="button" class="btn btn-light btn-small" data-entry-edit="${item.id}">신청 수정</button>`);
    if(!actions.querySelector('[data-entry-cancel]'))actions.insertAdjacentHTML('beforeend',`<button type="button" class="btn btn-danger-outline btn-small" data-entry-cancel="${item.id}">삭제 요청</button>`);
  });
};
v3252DeleteRequest=function(id){const item=stage3264FindApplication(id);const lookup=String(document.getElementById('entryLookupPhone')?.value||'').replace(/\D/g,'');const mine=(currentAuthUser&&item?.ownerUid===currentAuthUser.uid)||entryApplicationPlayers(item).some(p=>p.phone===lookup);if(!item||!mine||['cancelled','delete_requested'].includes(item.status))return notice('본인의 유효한 참가 신청만 삭제 요청할 수 있습니다.','error');if(!confirm(`${item.teamName} 참가 신청의 삭제를 관리자에게 요청할까요?`))return;item.previousStatus=item.status;item.status='delete_requested';item.deleteRequestedAt=new Date().toISOString();item.updatedAt=item.deleteRequestedAt;commit(`참가 신청 삭제 요청 · ${item.teamName}`);lookupPublicApplication();renderApplicationPortal();notice('삭제 요청을 접수했습니다. 관리자가 확인 후 삭제합니다.','success');};
document.addEventListener('click',e=>{
  const edit=e.target.closest?.('[data-entry-admin-edit]');if(edit){e.preventDefault();e.stopImmediatePropagation();stage3264AdminEditApplication(edit.dataset.entryAdminEdit);return;}
  const approve=e.target.closest?.('[data-entry-admin-delete]');if(approve){e.preventDefault();e.stopImmediatePropagation();stage3264DeleteApplication(approve.dataset.entryAdminDelete,'삭제 승인');return;}
  const force=e.target.closest?.('[data-entry-admin-force-delete]');if(force){e.preventDefault();e.stopImmediatePropagation();stage3264DeleteApplication(force.dataset.entryAdminForceDelete,'바로 삭제');}
},true);

function stage3264GuideFor(item){return item?.guide||{date:item?.date||'',venue:item?.venue||'',fee:item?.fee||'',detail:item?.detail||'',bank:'',account:'',paymentNote:'',imageDataUrl:'',imageName:'',imageType:''};}
const stage3264BaseCurrentSnapshot=currentTournamentSnapshot;
currentTournamentSnapshot=function(){const x=stage3264BaseCurrentSnapshot();x.guide=structuredClone(state.portal?.guide||{});return x;};
function stage3264OpenArchivedGuide(item){
  const panel=document.getElementById('tournamentDetailPanel');if(!panel)return;const g=stage3264GuideFor(item);
  panel.hidden=false;panel.innerHTML=`<div class="section-head"><div><h2>${portalEscape(item.name)} 요강</h2><p>${portalEscape(item.division||'부서 미설정')} · ${tournamentStatusLabel(item.status)}</p></div><button type="button" class="btn btn-light" data-tournament-detail-close>닫기</button></div><div class="tournament-detail-grid"><div><span>대회일</span><b>${g.date?portalEscape(g.date):'미정'}</b></div><div><span>장소</span><b>${portalEscape(g.venue||'미정')}</b></div><div><span>참가비</span><b>${portalEscape(g.fee||'미설정')}</b></div><div><span>입금계좌</span><b>${portalEscape([g.bank,g.account].filter(Boolean).join(' ')||'미설정')}</b></div></div><div class="tournament-detail-text">${portalEscape(g.detail||item.detail||'등록된 세부 요강이 없습니다.').replace(/\n/g,'<br>')}</div>${stage6109ImageSrc(g)?`<div class="archived-guide-image-wrap"><img class="archived-guide-image" src="${stage6109ImageSrc(g)}" alt="${portalEscape(item.name)} 요강 이미지"><div class="archived-guide-image-actions"><a class="btn btn-light" href="${stage6109ImageSrc(g)}" download="${portalEscape(g.imageName||item.name+'-요강.jpg')}">이미지 다운로드</a></div></div>`:''}`;
  panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function stage3264Go(item,kind){
  if(kind==='guide'){if(item.current)navigatePortalView('guide',{pushHistory:true});else stage3264OpenArchivedGuide(item);return;}
  if(kind==='entry'){if(item.current)navigatePortalView('entry',{pushHistory:true});else renderTournamentDetail(item);return;}
  if(kind==='prelim'){if(item.current)navigatePortalView('prelim-public',{pushHistory:true});else navigatePortalView('records',{pushHistory:true});return;}
  if(kind==='main'){if(item.current)navigatePortalView('bracket',{pushHistory:true});else navigatePortalView('records',{pushHistory:true});}
}
const stage3264BaseTournamentRender=renderTournamentList;
renderTournamentList=function(){
  stage3264BaseTournamentRender.apply(this,arguments);
  const rows=tournamentArchiveRows();
  document.querySelectorAll('#tournamentCardList .tournament-list-card').forEach((card,index)=>{
    const item=rows.filter(x=>{const q=String(document.getElementById('tournamentListSearch')?.value||'').trim().toLowerCase(),st=document.getElementById('tournamentListStatus')?.value||'all';return(st==='all'||x.status===st)&&(!q||`${x.name} ${x.division} ${x.venue}`.toLowerCase().includes(q));})[index];if(!item)return;
    const progress=card.querySelector('.tournament-card-progress');if(progress){progress.innerHTML=`<button type="button" class="tournament-quick-stat" data-tournament-quick="prelim" data-tournament-id="${item.id}"><span>예선 현황</span><b>${item.prelimCompleted||0}/${item.prelimTotal||0}</b></button><button type="button" class="tournament-quick-stat" data-tournament-quick="main" data-tournament-id="${item.id}"><span>본선 대진표</span><b>${item.mainCompleted||0}/${item.mainTotal||0}</b></button><div><span>우승</span><b>${portalEscape(item.champion||'미확정')}</b></div>`;}
    if(item.current&&isAdmin()&&!card.querySelector('[data-current-tournament-delete]')){const delBtn=document.createElement('button');delBtn.type='button';delBtn.className='btn btn-danger-outline btn-small';delBtn.dataset.currentTournamentDelete='1';delBtn.textContent='현재 대회 삭제';card.querySelector('.tournament-card-top')?.appendChild(delBtn);}
    const open=card.querySelector('[data-tournament-open]');if(open&&!card.querySelector('.tournament-quick-actions')){const actions=document.createElement('div');actions.className='button-row compact tournament-quick-actions';actions.innerHTML=`<button type="button" class="btn btn-light btn-small" data-tournament-quick="guide" data-tournament-id="${item.id}">요강</button><button type="button" class="btn btn-light btn-small" data-tournament-quick="entry" data-tournament-id="${item.id}">접수현황</button>`;open.before(actions);}
  });
};
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-tournament-quick]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const item=tournamentArchiveRows().find(x=>String(x.id)===String(b.dataset.tournamentId));if(item)stage3264Go(item,b.dataset.tournamentQuick);},true);
void 0;


// Stage 32.6.5 · registration SMS button and full admin edit dialog
function manualEntrySms(id){
  const item=(state.portal?.applications||[]).find(a=>String(a.id)===String(id));
  if(!item){notice('참가 신청 정보를 찾을 수 없습니다.','error');return;}
  const mode=document.querySelector(`[data-entry-sms-mode="${CSS.escape(String(id))}"]`)?.value;
  if(mode)item.smsTargetMode=mode;
  let kind='approve';
  if((item.paymentStatus||(item.paid?'paid':'unpaid'))==='paid')kind='payment';
  else if(item.status==='reserve')kind='reserve';
  else if(item.status==='rejected')kind='reject';
  else if(item.status==='approved')kind='approve';
  openEntrySmsDialog(kind,item);
}
function stage3265ToLocalInput(value){
  if(!value)return '';
  const d=new Date(value);if(Number.isNaN(d.getTime()))return '';
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function stage3265CloseAdminEdit(){
  const d=document.getElementById('entryAdminEditDialog');
  if(d?.open)d.close();else d?.removeAttribute('open');
}
function stage3264AdminEditApplication(id){
  if(!requireAdmin('참가 신청 수정'))return;
  const item=stage3264FindApplication(id);if(!item)return notice('참가 신청 정보를 찾을 수 없습니다.','error');
  const p=entryApplicationPlayers(item);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??''};
  set('entryAdminEditId',item.id);set('entryAdminEditP1Name',p[0]?.name);set('entryAdminEditP1Club',p[0]?.club);set('entryAdminEditP1Phone',p[0]?.phone);
  set('entryAdminEditP2Name',p[1]?.name);set('entryAdminEditP2Club',p[1]?.club);set('entryAdminEditP2Phone',p[1]?.phone);
  const rep=Number(item.representativeIndex||0)===1?document.getElementById('entryAdminRep2'):document.getElementById('entryAdminRep1');if(rep)rep.checked=true;
  set('entryAdminSmsMode',item.smsTargetMode==='both'?'both':'representative');set('entryAdminStatus',item.status||'pending');
  set('entryAdminPaymentStatus',item.paymentStatus||(item.paid?'paid':'unpaid'));set('entryAdminPaymentAt',stage3265ToLocalInput(item.paidAt||item.refundedAt));
  set('entryAdminMemo',item.memo||'');set('entryAdminAdminMemo',item.adminMemo||'');
  const feedback=document.getElementById('entryAdminEditFeedback');if(feedback){feedback.hidden=true;feedback.textContent=''}
  const d=document.getElementById('entryAdminEditDialog');if(typeof d?.showModal==='function')d.showModal();else d?.setAttribute('open','');
}
function stage3265SaveAdminEdit(){
  if(!requireAdmin('참가 신청 수정'))return;
  const id=document.getElementById('entryAdminEditId')?.value;const item=stage3264FindApplication(id);if(!item)return notice('수정할 신청을 찾을 수 없습니다.','error');
  const val=id=>String(document.getElementById(id)?.value||'').trim();
  const players=[{name:val('entryAdminEditP1Name'),club:val('entryAdminEditP1Club'),phone:val('entryAdminEditP1Phone').replace(/\D/g,'')},{name:val('entryAdminEditP2Name'),club:val('entryAdminEditP2Club'),phone:val('entryAdminEditP2Phone').replace(/\D/g,'')}];
  const feedback=document.getElementById('entryAdminEditFeedback');
  const fail=(msg,id)=>{if(feedback){feedback.hidden=false;feedback.className='notice error';feedback.textContent=msg}document.getElementById(id)?.focus();};
  for(let i=0;i<2;i++){if(!players[i].name)return fail(`선수 ${i+1} 이름을 입력하세요.`,`entryAdminEditP${i+1}Name`);if(!players[i].club)return fail(`선수 ${i+1} 클럽을 입력하세요.`,`entryAdminEditP${i+1}Club`);if(!validatePhone(players[i].phone))return fail(`선수 ${i+1} 전화번호를 확인하세요.`,`entryAdminEditP${i+1}Phone`);}
  const representativeIndex=document.getElementById('entryAdminRep2')?.checked?1:0;
  const oldStatus=item.status;item.players=players;item.representativeIndex=representativeIndex;item.representativeName=players[representativeIndex].name;item.phone=players[representativeIndex].phone;
  item.teamName=players.map(x=>x.name).join(' / ');item.affiliation=players.map(x=>x.club).join(' / ');item.smsTargetMode=val('entryAdminSmsMode')==='both'?'both':'representative';
  item.status=val('entryAdminStatus')||'pending';item.memo=val('entryAdminMemo');item.adminMemo=val('entryAdminAdminMemo');
  const paymentStatus=val('entryAdminPaymentStatus')||'unpaid', at=val('entryAdminPaymentAt');item.paymentStatus=paymentStatus;item.paid=paymentStatus==='paid';
  if(paymentStatus==='paid'){item.paidAt=at?new Date(at).toISOString():(item.paidAt||new Date().toISOString());item.refundedAt='';}
  else if(paymentStatus==='refunded'){item.refundedAt=at?new Date(at).toISOString():(item.refundedAt||new Date().toISOString());item.paid=false;}
  else {item.paidAt='';if(paymentStatus!=='refunded')item.refundedAt='';}
  item.updatedAt=new Date().toISOString();if(item.status==='approved'||item.status==='reserve')item.approvedAt=item.approvedAt||item.updatedAt;
  stage3264SyncApplicationTeam(item);
  if(oldStatus!==item.status){const team=stage3264ApplicationTeam(item);if(team)participantReorderByStatus(team,item.status==='reserve'?'reserve':'active');}
  commit(`관리자 참가 신청 전체 수정 · ${item.teamName}`);stage3265CloseAdminEdit();renderApplicationPortal();renderParticipantManager();lookupPublicApplication();notice('전체 항목을 수정했습니다.','success');
}
function stage3265BindAdminEdit(){
  document.getElementById('entryAdminEditCloseBtn')?.addEventListener('click',stage3265CloseAdminEdit);
  document.getElementById('entryAdminEditCancelBtn')?.addEventListener('click',stage3265CloseAdminEdit);
  document.getElementById('entryAdminEditSaveBtn')?.addEventListener('click',stage3265SaveAdminEdit);
}
document.addEventListener('DOMContentLoaded',stage3265BindAdminEdit,{once:true});
document.addEventListener('click',async e=>{
  const guideBtn=e.target.closest?.('[data-guide-tournament-id]');
  if(guideBtn&&!guideBtn.closest('#tournamentCardList')){e.preventDefault();await stage3610OpenTournamentGuide(guideBtn.dataset.guideTournamentId);return;}
  if(e.target.closest?.('#editTournamentGuideHeroBtn')){e.preventDefault();openTournamentGuideEditor();setTimeout(()=>document.getElementById('tournamentGuideEditor')?.scrollIntoView({behavior:'smooth',block:'start'}),40);return;}
  if(e.target.closest?.('#guideImagePreview')){const src=document.getElementById('guideImagePreview')?.src;if(src)window.open(src,'_blank','noopener');}
},true);

void 0;


// Stage 32.8 · tournament-list guide and image attachment
let stage328PendingGuideImage='';
let stage328PendingGuideImageName='';
let stage328PendingGuideImageType='';
let stage328PendingGuideStoragePath='';
function stage328RenderGuideImageEditorPreview(){
  const wrap=document.getElementById('guideImageEditorPreviewWrap');
  const img=document.getElementById('guideImageEditorPreview');
  if(!wrap||!img)return;
  wrap.hidden=!stage328PendingGuideImage;
  if(stage328PendingGuideImage)img.src=stage328PendingGuideImage;else img.removeAttribute('src');
}
function stage328SafeFileName(name,type){
  const base=String(name||'대회요강').replace(/[^0-9A-Za-z가-힣._-]+/g,'_').slice(0,70)||'대회요강';
  const ext=type==='image/png'?'png':type==='image/webp'?'webp':'jpg';
  return base.replace(/\.(png|jpe?g|webp)$/i,'')+'.'+ext;
}
async function stage328CompressGuideImage(file){
  if(!file?.type?.startsWith('image/'))throw new Error('이미지 파일만 첨부할 수 있습니다.');
  if(file.size>12*1024*1024)throw new Error('원본 이미지는 12MB 이하만 사용할 수 있습니다.');
  const bitmap=await createImageBitmap(file);
  const max=2000,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
  let quality=.86,data=canvas.toDataURL('image/webp',quality);
  while(data.length>420000&&quality>.50){quality-=.07;data=canvas.toDataURL('image/webp',quality);}
  if(data.length>520000){quality=.78;data=canvas.toDataURL('image/jpeg',quality);while(data.length>520000&&quality>.48){quality-=.06;data=canvas.toDataURL('image/jpeg',quality);}}
  if(data.length>560000)throw new Error('요강 이미지가 너무 큽니다. 세로 2000px 이하 이미지로 다시 선택해 주세요.');
  const outType=data.startsWith('data:image/webp')?'image/webp':'image/jpeg';return {dataUrl:data,type:outType,name:stage328SafeFileName(file.name,outType)};
}
async function stage328HandleGuideImage(file){
  try{
    notice('요강 이미지를 화면용으로 압축하고 있습니다.','info');
    const out=await stage328CompressGuideImage(file);
    stage328PendingGuideImage=out.dataUrl;stage328PendingGuideImageName=out.name;stage328PendingGuideImageType=out.type;
    stage328RenderGuideImageEditorPreview();notice('요강 이미지를 첨부했습니다. 요강 저장을 눌러 완료하세요.','success');
  }catch(error){notice(error.message||'이미지 첨부에 실패했습니다.','error');}
}
document.addEventListener('change',e=>{if(e.target?.id==='guideImageInput'&&e.target.files?.[0])stage328HandleGuideImage(e.target.files[0]);});
document.addEventListener('click',e=>{if(e.target?.id==='removeGuideImageBtn'){e.preventDefault();stage328PendingGuideImage='';stage328PendingGuideImageName='';stage328PendingGuideImageType='';stage328PendingGuideStoragePath='';stage328RenderGuideImageEditorPreview();const input=document.getElementById('guideImageInput');if(input)input.value='';notice('첨부 이미지를 제거했습니다. 요강 저장을 눌러 완료하세요.','success');}},true);
void 0;


// Stage 32.8.1 · tournament guide routing hotfix
void 0;


// Stage 32.9 · tournament edit and role-based menu hub
function stage329Esc(value){return portalEscape(String(value??''));}
function stage329EnsureEditor(){
  let dialog=document.getElementById('stage329TournamentEditDialog');
  if(dialog)return dialog;
  dialog=document.createElement('dialog');
  dialog.id='stage329TournamentEditDialog';
  dialog.className='modal stage329-tournament-edit-dialog';
  dialog.innerHTML=`<form id="stage329TournamentEditForm" method="dialog">
    <div class="modal-head"><div><span class="stage329-kicker">현재 대회 관리</span><h2>대회 세부정보·운영 설정 편집</h2><p>필요한 항목을 한 화면에서 수정한 뒤 저장합니다.</p></div><button type="button" class="icon-button" data-stage329-close aria-label="닫기">×</button></div>
    <div class="stage329-edit-grid">
      <label><span>대회명 *</span><input id="stage329Name" required></label>
      <label><span>부서 *</span><input id="stage329Division" required></label>
      <label><span>대회일</span><input id="stage329Date" type="date"></label>
      <label><span>시작 시간</span><input id="stage329StartTime" type="time"></label>
      <label class="stage329-span-2"><span>장소</span><input id="stage329Venue"></label>
      <label><span>참가 정원</span><input id="stage329Capacity" type="number" min="1"></label>
      <label><span>본선 규모</span><select id="stage329DrawSize"><option value="32">32강</option><option value="64">64강</option><option value="128">128강</option></select></label>
      <label><span>조당 본선 진출팀</span><input id="stage329Qualifiers" type="number" min="1" max="3"></label>
      <label><span>2팀조 수</span><input id="stage329TwoTeamGroups" type="number" min="0"></label>
      <label><span>코트 수</span><input id="stage329CourtCount" type="number" min="1"></label>
      <label><span>코트명 접두어</span><input id="stage329CourtPrefix" placeholder="예: 국제"></label>
      <label><span>참가비</span><input id="stage329Fee" placeholder="예: 60,000원"></label>
      <label><span>은행·예금주</span><input id="stage329Bank"></label>
      <label class="stage329-span-2"><span>입금 계좌</span><input id="stage329Account"></label>
      <label class="stage329-span-2"><span>주최·주관</span><input id="stage329Organizer"></label>
      <label><span>접수 시작</span><input id="stage329EntryStart" type="datetime-local"></label>
      <label><span>접수 마감</span><input id="stage329EntryEnd" type="datetime-local"></label>
      <label class="stage329-span-2"><span>참가 자격</span><textarea id="stage329Eligibility" rows="3"></textarea></label>
      <label class="stage329-span-2"><span>경기 방식</span><textarea id="stage329Format" rows="3"></textarea></label>
      <label class="stage329-span-2"><span>시상 내용</span><textarea id="stage329Awards" rows="3"></textarea></label>
      <label class="stage329-span-2"><span>환불 규정</span><textarea id="stage329Refund" rows="3"></textarea></label>
      <label class="stage329-span-2"><span>문의처</span><input id="stage329Contact"></label>
      <label class="stage329-span-2"><span>기타 안내·세부 요강</span><textarea id="stage329Detail" rows="5"></textarea></label>
    </div>
    <div id="stage329EditMessage" class="stage329-edit-message" aria-live="polite"></div>
    <menu><button type="button" class="btn btn-light" data-stage329-close>취소</button><button type="submit" class="btn btn-primary">수정 완료</button></menu>
  </form>`;
  document.body.appendChild(dialog);
  dialog.querySelectorAll('[data-stage329-close]').forEach(b=>b.addEventListener('click',()=>dialog.close()));
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.querySelector('form').addEventListener('submit',stage329SaveTournamentEdit);
  return dialog;
}
function stage329Local(value){if(!value)return '';const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value).slice(0,16);const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;}
function stage329OpenTournamentEdit(){
  if(!requireAdmin('대회 세부정보 수정'))return;
  const d=stage329EnsureEditor(),g=state.portal?.guide||{},ps=state.prelim?.settings||{},s=state.settings||{};
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??'';};
  set('stage329Name',state.tournament?.name||'');set('stage329Division',state.tournament?.division||'');set('stage329Date',g.date||'');set('stage329StartTime',g.startTime||'09:00');set('stage329Venue',g.venue||'');set('stage329Capacity',state.tournament?.capacity||ps.activeTeamCount||96);set('stage329DrawSize',s.drawSize||128);set('stage329Qualifiers',ps.qualifiersPerGroup||2);set('stage329TwoTeamGroups',ps.twoTeamGroupCount||0);set('stage329CourtCount',s.courtCount||8);set('stage329CourtPrefix',s.courtPrefix||'국제');set('stage329Fee',g.fee||'');set('stage329Bank',g.bank||'');set('stage329Account',g.account||'');set('stage329Organizer',g.organizer||g.host||'');set('stage329EntryStart',stage329Local(g.entryStart||g.registrationStart||''));set('stage329EntryEnd',stage329Local(g.entryEnd||g.registrationEnd||''));set('stage329Eligibility',g.eligibility||'');set('stage329Format',g.format||g.matchFormat||'');set('stage329Awards',g.awards||'');set('stage329Refund',g.refund||g.refundPolicy||'');set('stage329Contact',g.contact||'');set('stage329Detail',g.detail||'');
  document.getElementById('stage329EditMessage').textContent='';d.showModal();setTimeout(()=>document.getElementById('stage329Name')?.focus(),30);
}
async function stage329SaveTournamentEdit(e){
  e.preventDefault();if(!requireAdmin('대회 세부정보 수정'))return;
  const val=id=>String(document.getElementById(id)?.value||'').trim();
  const name=val('stage329Name'),division=val('stage329Division');
  const msg=document.getElementById('stage329EditMessage');
  if(!name||!division){msg.textContent='대회명과 부서는 반드시 입력하세요.';msg.className='stage329-edit-message error';return;}
  try{
    const recovery=saveRecovery(state,`${state.tournament?.name||'현재 대회'} · 세부정보 수정 전`);if(recovery?.ready)await recovery.ready;
    state.tournament={...(state.tournament||{}),name,division,capacity:Math.max(1,Number(val('stage329Capacity')||96))};
    state.portal=state.portal||{};state.portal.guide={...(state.portal.guide||{}),date:val('stage329Date'),startTime:val('stage329StartTime'),venue:val('stage329Venue'),fee:val('stage329Fee'),bank:val('stage329Bank'),account:val('stage329Account'),organizer:val('stage329Organizer'),host:val('stage329Organizer'),entryStart:val('stage329EntryStart'),entryEnd:val('stage329EntryEnd'),registrationStart:val('stage329EntryStart'),registrationEnd:val('stage329EntryEnd'),eligibility:val('stage329Eligibility'),format:val('stage329Format'),matchFormat:val('stage329Format'),awards:val('stage329Awards'),refund:val('stage329Refund'),refundPolicy:val('stage329Refund'),contact:val('stage329Contact'),detail:val('stage329Detail')};
    state.settings={...(state.settings||{}),drawSize:Number(val('stage329DrawSize')||128),courtCount:Math.max(1,Number(val('stage329CourtCount')||8)),courtPrefix:val('stage329CourtPrefix')||'코트'};
    state.prelim=state.prelim||{};state.prelim.settings={...(state.prelim.settings||{}),activeTeamCount:state.tournament.capacity,qualifiersPerGroup:Math.max(1,Number(val('stage329Qualifiers')||2)),twoTeamGroupCount:Math.max(0,Number(val('stage329TwoTeamGroups')||0))};
    commit(`대회 세부정보 수정 · ${name}`);stage329EnsureEditor().close();renderPortalViews();renderTournamentList();notice('대회 세부정보와 운영 설정을 수정했습니다.','success');
  }catch(err){msg.textContent=`수정 실패: ${err?.message||err}`;msg.className='stage329-edit-message error';}
}
function stage329OrganizeDesktopMenu(){
  const nav=document.querySelector('.mode-tabs');if(!nav||nav.dataset.stage329==='1')return;nav.dataset.stage329='1';
  const buttons=[...nav.querySelectorAll('.tab')];const byView=Object.fromEntries(buttons.map(b=>[b.dataset.view,b]));
  nav.innerHTML='';nav.classList.add('stage329-menu-hub');
  const makeGroup=(label,views,cls='')=>{const section=document.createElement('section');section.className=`stage329-menu-group ${cls}`;section.innerHTML=`<span class="stage329-menu-label">${label}</span><div class="stage329-menu-buttons"></div>`;const box=section.lastElementChild;views.forEach(v=>{if(byView[v])box.appendChild(byView[v]);});nav.appendChild(section);};
  makeGroup('현재 대회',['home','tournaments','entry','my-match','prelim-public','operation','bracket'],'current');
  const details=document.createElement('details');details.className='stage329-menu-more';details.innerHTML='<summary>기록·안내</summary><div class="stage329-menu-more-panel"></div>';const more=details.lastElementChild;['board','records','participants','print'].forEach(v=>{if(byView[v])more.appendChild(byView[v]);});nav.appendChild(details);
  buttons.filter(b=>!b.parentElement||b.classList.contains('settings-managed-tab')).forEach(b=>{b.hidden=true;nav.appendChild(b);});
}
function stage329EnhanceTournamentCards(){
  document.querySelectorAll('#tournamentCardList .tournament-list-card').forEach((card,index)=>{
    const item=tournamentArchiveRows().filter(x=>{const q=String(document.getElementById('tournamentListSearch')?.value||'').trim().toLowerCase(),st=document.getElementById('tournamentListStatus')?.value||'all';return(st==='all'||x.status===st)&&(!q||`${x.name} ${x.division} ${x.venue}`.toLowerCase().includes(q));})[index];
    if(!item?.current||!isAdmin()||card.querySelector('[data-stage329-edit-tournament]'))return;
    const del=card.querySelector('[data-delete-current-tournament], [data-tournament-delete], .btn-danger-outline');
    const b=document.createElement('button');b.type='button';b.className='btn btn-primary btn-small';b.dataset.stage329EditTournament='1';b.textContent='대회 편집';
    if(del?.parentElement)del.parentElement.insertBefore(b,del);else card.prepend(b);
  });
}
const stage329BaseTournamentRender=renderTournamentList;
renderTournamentList=function(){stage329BaseTournamentRender.apply(this,arguments);stage329EnhanceTournamentCards();};
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-stage329-edit-tournament]');if(b){e.preventDefault();e.stopImmediatePropagation();stage329OpenTournamentEdit();}},true);
function stage329OrganizeMobileMore(){
  const grid=document.querySelector('#mobileMoreSheet .mobile-more-grid');if(!grid||grid.dataset.stage329==='1')return;grid.dataset.stage329='1';
  const buttons=[...grid.children];const map={};buttons.forEach(b=>{map[b.dataset.portalGo||b.id]=b;});grid.innerHTML='';
  const addHead=t=>{const h=document.createElement('div');h.className='stage329-mobile-head';h.textContent=t;grid.appendChild(h);};
  addHead('현재 대회');['operation','prelim-public','board'].forEach(k=>map[k]&&grid.appendChild(map[k]));
  addHead('지난 기록·자료');['records','participants','print'].forEach(k=>map[k]&&grid.appendChild(map[k]));
  addHead('계정·관리');['mobileSocialLoginBtn','mobileSettingsBtn'].forEach(k=>map[k]&&grid.appendChild(map[k]));
}
function stage329Init(){stage329OrganizeDesktopMenu();stage329OrganizeMobileMore();stage329EnsureEditor();stage329EnhanceTournamentCards();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',stage329Init);else stage329Init();
void 0;

// Stage 32.10 · current tournament, venue library and clean settings
let stage3210VenueDraft=[];
function stage3210VenueId(){return `venue-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;}
function stage3210RenderVenueDraft(){
  const root=document.getElementById('stage3210VenueRows');if(!root)return;
  root.innerHTML=stage3210VenueDraft.map((v,i)=>`<article class="stage3210-venue-card" data-stage3210-venue-row="${i}">
    <div class="stage3210-venue-title"><strong>${stage329Esc(v.name||`구장 ${i+1}`)}</strong><button type="button" class="btn btn-danger-outline btn-small" data-stage3210-remove-venue="${i}" ${stage3210VenueDraft.length===1?'disabled':''}>구장 삭제</button></div>
    <div class="stage3210-venue-grid">
      <label><span>구장명</span><input data-vfield="name" value="${stage329Esc(v.name||'')}"></label>
      <label><span>코트 면수</span><input data-vfield="courtCount" type="number" min="1" max="40" value="${Math.max(1,Number(v.courtCount)||1)}"></label>
      <label><span>코트명 접두어</span><input data-vfield="courtPrefix" value="${stage329Esc(v.courtPrefix||v.name||'코트')}" placeholder="예: 국제"></label>
      <div class="stage3210-use-box"><span>대회 사용 구분</span><label><input data-vfield="usePrelim" type="checkbox" ${v.usePrelim!==false?'checked':''}> 예선 구장</label><label><input data-vfield="useMain" type="checkbox" ${v.useMain!==false?'checked':''}> 본선 구장</label></div>
    </div>
    <div class="stage3210-court-preview">${Array.from({length:Math.min(12,Math.max(1,Number(v.courtCount)||1))},(_,n)=>`<span>${stage329Esc(v.courtPrefix||v.name||'코트')}${n+1}</span>`).join('')}${Number(v.courtCount)>12?`<span>외 ${Number(v.courtCount)-12}면</span>`:''}</div>
  </article>`).join('');
  root.querySelectorAll('[data-stage3210-remove-venue]').forEach(b=>b.addEventListener('click',()=>{
    stage3210ReadVenueDraft();const idx=Number(b.dataset.stage3210RemoveVenue);const v=stage3210VenueDraft[idx];
    if(!v||stage3210VenueDraft.length<=1)return;if(!confirm(`“${v.name}” 구장을 현재 대회 설정에서 삭제할까요?`))return;
    stage3210VenueDraft.splice(idx,1);stage3210RenderVenueDraft();stage3210UpdateVenueSummary();
  }));
  root.querySelectorAll('input').forEach(el=>el.addEventListener('input',()=>{stage3210ReadVenueDraft();stage3210RenderCourtPreviewsOnly();stage3210UpdateVenueSummary();}));
  root.querySelectorAll('input[type=checkbox]').forEach(el=>el.addEventListener('change',()=>{stage3210ReadVenueDraft();stage3210UpdateVenueSummary();}));
}
function stage3210ReadVenueDraft(){
  const rows=[...document.querySelectorAll('#stage3210VenueRows [data-stage3210-venue-row]')];
  if(!rows.length)return;
  stage3210VenueDraft=rows.map((r,i)=>({
    id:stage3210VenueDraft[i]?.id||stage3210VenueId(),
    name:String(r.querySelector('[data-vfield=name]')?.value||'').trim()||`구장 ${i+1}`,
    courtCount:Math.max(1,Number(r.querySelector('[data-vfield=courtCount]')?.value)||1),
    courtPrefix:String(r.querySelector('[data-vfield=courtPrefix]')?.value||'').trim()||String(r.querySelector('[data-vfield=name]')?.value||'코트').trim()||'코트',
    usePrelim:!!r.querySelector('[data-vfield=usePrelim]')?.checked,
    useMain:!!r.querySelector('[data-vfield=useMain]')?.checked
  }));
}
function stage3210RenderCourtPreviewsOnly(){
  document.querySelectorAll('#stage3210VenueRows [data-stage3210-venue-row]').forEach((r,i)=>{
    const v=stage3210VenueDraft[i];const p=r.querySelector('.stage3210-court-preview');const title=r.querySelector('.stage3210-venue-title strong');if(title)title.textContent=v.name;
    if(p)p.innerHTML=Array.from({length:Math.min(12,v.courtCount)},(_,n)=>`<span>${stage329Esc(v.courtPrefix)}${n+1}</span>`).join('')+(v.courtCount>12?`<span>외 ${v.courtCount-12}면</span>`:'');
  });
}
function stage3210UpdateVenueSummary(){
  const el=document.getElementById('stage3210VenueSummary');if(!el)return;
  const pre=stage3210VenueDraft.filter(v=>v.usePrelim).map(v=>`${v.name} ${v.courtCount}면`).join(' + ')||'선택 없음';
  const main=stage3210VenueDraft.filter(v=>v.useMain).map(v=>`${v.name} ${v.courtCount}면`).join(' + ')||'선택 없음';
  el.innerHTML=`<b>예선:</b> ${stage329Esc(pre)}<br><b>본선:</b> ${stage329Esc(main)}`;
}
function stage3210EnsureEditor(){
  document.getElementById('stage329TournamentEditDialog')?.remove();
  let d=document.getElementById('stage3210TournamentEditDialog');if(d)return d;
  d=document.createElement('dialog');d.id='stage3210TournamentEditDialog';d.className='modal stage329-tournament-edit-dialog stage3210-dialog';
  d.innerHTML=`<form id="stage3210TournamentEditForm" method="dialog">
  <div class="modal-head"><div><span class="stage329-kicker">현재 대회 전용 설정</span><h2>대회 세부정보·예선·본선 구장 편집</h2><p>현재 진행 중인 대회에만 적용됩니다. 지난 대회 기록은 변경되지 않습니다.</p></div><button type="button" class="icon-button" data-stage3210-close>×</button></div>
  <div class="stage3210-section"><h3>① 대회 기본정보</h3><div class="stage329-edit-grid">
  <label><span>대회명 *</span><input id="stage329Name" required></label><label><span>부서 *</span><input id="stage329Division" required></label>
  <label><span>대회일</span><input id="stage329Date" type="date"></label><label><span>시작 시간</span><input id="stage329StartTime" type="time"></label>
  <label class="stage329-span-2"><span>대표 장소 안내</span><input id="stage329Venue" placeholder="예: 김해 국제테니스장 외"></label>
  <label><span>참가 정원</span><input id="stage329Capacity" type="number" min="1"></label><label><span>본선 규모</span><select id="stage329DrawSize"><option value="32">32강</option><option value="64">64강</option><option value="128">128강</option></select></label>
  <label><span>조당 본선 진출팀</span><input id="stage329Qualifiers" type="number" min="1" max="3"></label><label><span>2팀조 수</span><input id="stage329TwoTeamGroups" type="number" min="0"></label>
  </div></div>
  <div class="stage3210-section"><div class="stage3210-section-head"><div><h3>② 구장 생성·코트 면수·예선/본선 선택</h3><p>구장을 만든 뒤 코트 면수를 설정하고, 예선과 본선 사용 여부를 각각 선택합니다.</p></div><button type="button" class="btn btn-primary" id="stage3210AddVenue">+ 구장 생성</button></div><div id="stage3210VenueRows"></div><div id="stage3210VenueSummary" class="notice info"></div><div class="stage3210-policy-grid"><label><span>구장별 배정 방식</span><select id="stage3210VenuePolicy"><option value="round-robin">구장 순환 균등배정</option><option value="fill-first">첫 구장 우선 채우기</option></select></label><label class="toggle-label"><span>구장별 공용대기 분리</span><input id="stage3210SeparateQueues" type="checkbox"></label><label class="toggle-label"><span>경기 종료 시 다음 경기 자동 투입</span><input id="stage3210AutoPromotion" type="checkbox"></label></div></div>
  <div class="stage3210-section"><h3>③ 접수·요강 정보</h3><div class="stage329-edit-grid">
  <label><span>참가비</span><input id="stage329Fee"></label><label><span>은행·예금주</span><input id="stage329Bank"></label><label class="stage329-span-2"><span>입금 계좌</span><input id="stage329Account"></label><label class="stage329-span-2"><span>주최·주관</span><input id="stage329Organizer"></label><label><span>접수 시작</span><input id="stage329EntryStart" type="datetime-local"></label><label><span>접수 마감</span><input id="stage329EntryEnd" type="datetime-local"></label><label class="stage329-span-2"><span>참가 자격</span><textarea id="stage329Eligibility" rows="3"></textarea></label><label class="stage329-span-2"><span>경기 방식</span><textarea id="stage329Format" rows="3"></textarea></label><label class="stage329-span-2"><span>시상 내용</span><textarea id="stage329Awards" rows="3"></textarea></label><label class="stage329-span-2"><span>환불 규정</span><textarea id="stage329Refund" rows="3"></textarea></label><label class="stage329-span-2"><span>문의처</span><input id="stage329Contact"></label><label class="stage329-span-2"><span>기타 안내·세부 요강</span><textarea id="stage329Detail" rows="5"></textarea></label>
  </div></div><div id="stage329EditMessage" class="stage329-edit-message"></div><menu><button type="button" class="btn btn-light" data-stage3210-close>취소</button><button type="submit" class="btn btn-primary">현재 대회 설정 저장</button></menu></form>`;
  document.body.appendChild(d);d.querySelectorAll('[data-stage3210-close]').forEach(b=>b.onclick=()=>d.close());d.addEventListener('click',e=>{if(e.target===d)d.close();});d.querySelector('form').addEventListener('submit',stage3210SaveTournamentEdit);
  d.querySelector('#stage3210AddVenue').addEventListener('click',()=>{stage3210ReadVenueDraft();const n=stage3210VenueDraft.length+1;stage3210VenueDraft.push({id:stage3210VenueId(),name:`새 구장 ${n}`,courtCount:1,courtPrefix:`코트`,usePrelim:true,useMain:true});stage3210RenderVenueDraft();stage3210UpdateVenueSummary();setTimeout(()=>d.querySelector('#stage3210VenueRows article:last-child input')?.focus(),20);});
  return d;
}
function stage3210OpenTournamentEdit(){
  if(!requireAdmin('현재 대회 설정 편집'))return;ensureVenueSettings(state);
  const d=stage3210EnsureEditor(),g=state.portal?.guide||{},ps=state.prelim?.settings||{},s=state.settings||{};const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??'';};
  set('stage329Name',state.tournament?.name||'');set('stage329Division',state.tournament?.division||'');set('stage329Date',g.date||'');set('stage329StartTime',g.startTime||'09:00');set('stage329Venue',g.venue||'');set('stage329Capacity',state.tournament?.capacity||ps.activeTeamCount||96);set('stage329DrawSize',s.drawSize||128);set('stage329Qualifiers',ps.qualifiersPerGroup||2);set('stage329TwoTeamGroups',ps.twoTeamGroupCount||0);set('stage329Fee',g.fee||'');set('stage329Bank',g.bank||'');set('stage329Account',g.account||'');set('stage329Organizer',g.organizer||g.host||'');set('stage329EntryStart',stage329Local(g.entryStart||g.registrationStart||''));set('stage329EntryEnd',stage329Local(g.entryEnd||g.registrationEnd||''));set('stage329Eligibility',g.eligibility||'');set('stage329Format',g.format||g.matchFormat||'');set('stage329Awards',g.awards||'');set('stage329Refund',g.refund||g.refundPolicy||'');set('stage329Contact',g.contact||'');set('stage329Detail',g.detail||'');
  stage3210VenueDraft=structuredClone(s.venues||[]);if(!stage3210VenueDraft.length)stage3210VenueDraft=[{id:'venue-default',name:s.courtPrefix||'구장',courtCount:s.courtCount||8,courtPrefix:s.courtPrefix||'코트',usePrelim:true,useMain:true}];stage3210RenderVenueDraft();stage3210UpdateVenueSummary();set('stage3210VenuePolicy',s.venueAssignmentPolicy||'round-robin');document.getElementById('stage3210SeparateQueues').checked=s.separateVenueQueues!==false;document.getElementById('stage3210AutoPromotion').checked=s.autoVenuePromotion!==false;document.getElementById('stage329EditMessage').textContent='';d.showModal();
}
async function stage3210SaveTournamentEdit(e){
  e.preventDefault();if(!requireAdmin('현재 대회 설정 편집'))return;stage3210ReadVenueDraft();const val=id=>String(document.getElementById(id)?.value||'').trim();const msg=document.getElementById('stage329EditMessage');const name=val('stage329Name'),division=val('stage329Division');
  if(!name||!division){msg.textContent='대회명과 부서는 반드시 입력하세요.';msg.className='stage329-edit-message error';return;}if(!stage3210VenueDraft.some(v=>v.usePrelim)){msg.textContent='예선에 사용할 구장을 한 곳 이상 선택하세요.';msg.className='stage329-edit-message error';return;}if(!stage3210VenueDraft.some(v=>v.useMain)){msg.textContent='본선에 사용할 구장을 한 곳 이상 선택하세요.';msg.className='stage329-edit-message error';return;}
  try{const recovery=saveRecovery(state,`${state.tournament?.name||'현재 대회'} · 설정 변경 전`);if(recovery?.ready)await recovery.ready;
    state.tournament={...(state.tournament||{}),name,division,capacity:Math.max(1,Number(val('stage329Capacity')||96))};state.portal=state.portal||{};state.portal.guide={...(state.portal.guide||{}),date:val('stage329Date'),startTime:val('stage329StartTime'),venue:val('stage329Venue'),fee:val('stage329Fee'),bank:val('stage329Bank'),account:val('stage329Account'),organizer:val('stage329Organizer'),host:val('stage329Organizer'),entryStart:val('stage329EntryStart'),entryEnd:val('stage329EntryEnd'),registrationStart:val('stage329EntryStart'),registrationEnd:val('stage329EntryEnd'),eligibility:val('stage329Eligibility'),format:val('stage329Format'),matchFormat:val('stage329Format'),awards:val('stage329Awards'),refund:val('stage329Refund'),refundPolicy:val('stage329Refund'),contact:val('stage329Contact'),detail:val('stage329Detail')};
    state.settings={...(state.settings||{}),drawSize:Number(val('stage329DrawSize')||128),venues:structuredClone(stage3210VenueDraft),venueAssignmentPolicy:val('stage3210VenuePolicy')||'round-robin',separateVenueQueues:document.getElementById('stage3210SeparateQueues').checked,autoVenuePromotion:document.getElementById('stage3210AutoPromotion').checked};ensureVenueSettings(state);ensureVenueQueues(state);
    state.prelim=state.prelim||{};state.prelim.settings={...(state.prelim.settings||{}),activeTeamCount:state.tournament.capacity,qualifiersPerGroup:Math.max(1,Number(val('stage329Qualifiers')||2)),twoTeamGroupCount:Math.max(0,Number(val('stage329TwoTeamGroups')||0))};
    // 이미 생성된 경기·대기열은 안전을 위해 즉시 재배치하지 않습니다. 다음 조편성·코트배정부터 새 구장 구성을 사용합니다.
    commit(`현재 대회 설정 수정 · ${name}`);const editDialog=document.getElementById('stage3210TournamentEditDialog');editDialog?.close();renderPortalViews();renderTournamentList();renderVenueSettingsEditor();notice('현재 대회의 기본정보와 예선·본선 구장·코트 설정을 저장했습니다.','success');stage3210RenderSettingsSummary();
  }catch(err){msg.textContent=`저장 실패: ${err?.message||err}`;msg.className='stage329-edit-message error';}
}
function stage3210RenderSettingsSummary(){const el=document.getElementById('stage3210SettingsSummary');if(!el)return;ensureVenueSettings(state);const pre=prelimVenues(state).map(v=>`${v.name} ${v.courtCount}면`).join(' + '),main=mainVenues(state).map(v=>`${v.name} ${v.courtCount}면`).join(' + ');el.innerHTML=`<strong>${stage329Esc(state.tournament?.name||'현재 대회')}</strong><br>예선 ${stage329Esc(pre)}<br>본선 ${stage329Esc(main)}`;}
stage329OpenTournamentEdit=stage3210OpenTournamentEdit;
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-stage3210-open-edit]');if(b){e.preventDefault();stage3210OpenTournamentEdit();}},true);
function stage3210CleanSettings(){document.querySelectorAll('.auth-settings-section,#firebaseLiveSyncSection,.draw-history-section,.feature-roadmap,.venue-settings-section').forEach(el=>{el.hidden=true;el.remove?.();});document.querySelectorAll('[data-settings-action="firebase-sync"],[data-settings-action="prelim-pilot"],[data-settings-action="stage326-pilot"]').forEach(el=>el.remove());const tab=document.querySelector('[data-view="settings"]');if(tab)tab.textContent='현재 대회 관리';stage3210RenderSettingsSummary();}
function stage3210Init(){stage3210CleanSettings();stage3210EnsureEditor();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',stage3210Init);else stage3210Init();
void 0;


/* Stage 32.11 · mobile single-navigation runtime guard */
(function stage3211MobileSingleNavigation(){
  const mq = window.matchMedia('(max-width: 700px)');
  function apply(){
    const desktopNav = document.querySelector('.mode-tabs');
    const mobileNav = document.querySelector('.mobile-bottom-nav');
    const mobileBar = document.querySelector('.mobile-page-bar');
    if (mq.matches) {
      document.body.classList.add('stage3211-mobile-single-nav');
      if (desktopNav) {
        desktopNav.hidden = true;
        desktopNav.setAttribute('aria-hidden','true');
      }
      if (mobileNav) mobileNav.removeAttribute('hidden');
      if (mobileBar) mobileBar.removeAttribute('hidden');
    } else {
      document.body.classList.remove('stage3211-mobile-single-nav');
      if (desktopNav) {
        desktopNav.hidden = false;
        desktopNav.removeAttribute('aria-hidden');
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, {once:true});
  else apply();
  if (mq.addEventListener) mq.addEventListener('change', apply);
  else if (mq.addListener) mq.addListener(apply);
  window.addEventListener('pageshow', apply);
})();


/* Stage 32.12 · current tournament role quick hub */
(function stage3212MatchdayRoleHub(){
  const safeArray=v=>Array.isArray(v)?v:[];
  const countDone=list=>safeArray(list).filter(x=>x&&(['done','completed','finished'].includes(String(x.status||'').toLowerCase())||x.winner||x.winnerId)).length;
  function update(){
    const hub=document.getElementById('stage3212MatchdayHub');
    if(!hub)return;
    const teams=safeArray(state?.teams);
    const waiting=safeArray(state?.entry?.applications||state?.portal?.entryApplications).filter(x=>['pending','waiting','submitted'].includes(String(x?.status||'').toLowerCase())).length;
    const candidates=safeArray(state?.entry?.applications||state?.portal?.entryApplications).filter(x=>['candidate','waitlist','reserve'].includes(String(x?.status||'').toLowerCase())).length;
    const prelim=safeArray(state?.prelim?.matches);
    const main=(typeof allMatches==='function'?safeArray(allMatches(state)):safeArray(state?.draw?.matches));
    const courts=safeArray(state?.courts);
    const playing=courts.filter(c=>c&&(c.playing||c.currentMatchId||String(c.status||'').toLowerCase()==='playing')).length;
    const status=document.getElementById('stage3212HubStatus');
    if(status){
      const hasStarted=prelim.length||main.length||playing;
      status.textContent=hasStarted?'진행 중':teams.length?'접수·준비 중':'대회 준비';
      status.dataset.state=hasStarted?'live':teams.length?'ready':'empty';
    }
    const entry=document.getElementById('stage3212EntryCount');if(entry)entry.textContent=`참가 ${teams.length}팀 · 승인대기 ${waiting} · 후보 ${candidates}`;
    const pc=document.getElementById('stage3212PrelimCount');if(pc)pc.textContent=prelim.length?`${countDone(prelim)} / ${prelim.length}경기 완료`:'조편성·순위';
    const cc=document.getElementById('stage3212CourtCount');if(cc)cc.textContent=`진행 ${playing}코트 · 전체 ${courts.length}코트`;
    const mc=document.getElementById('stage3212MainCount');if(mc)mc.textContent=main.length?`${countDone(main)} / ${main.length}경기 완료`:'대진·결과';
    const admin=hub.querySelector('.stage3212-admin-actions');if(admin)admin.hidden=!(typeof isAdmin==='function'&&isAdmin());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update,{once:true});else update();
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-portal-go],#currentRoleBadge,[data-stage3210-open-edit]'))setTimeout(update,80);
  },true);
  window.addEventListener('pageshow',update);
  window.addEventListener('storage',update);
  // 성능 안정화: 홈 상태를 5초마다 강제 재계산하지 않는다. 화면 진입/버튼 조작 시 갱신한다.
  const originalApplyRoleUI=typeof applyRoleUI==='function'?applyRoleUI:null;
  if(originalApplyRoleUI&&!originalApplyRoleUI.__stage3212Wrapped){
    const wrapped=function(...args){const r=originalApplyRoleUI.apply(this,args);setTimeout(update,0);return r;};
    wrapped.__stage3212Wrapped=true;
    try{window.applyRoleUI=wrapped;}catch(_){ }
  }
})();
void 0;

window.addEventListener('DOMContentLoaded',()=>{try{const hash=(location.hash||'#home').replace(/^#/,'').split('?')[0]||'home';updateDocumentTitle(hash);}catch(_e){updateDocumentTitle('home');}});


/* Stage 32.15 · mobile field-operation readiness & route integrity */
(function stage3215FieldReadiness(){
  const validViews=()=>new Set(Array.from(document.querySelectorAll('[id^="view-"]')).map(el=>el.id.slice(5)));
  const auditRoutes=()=>{
    const views=validViews();
    const invalid=[];
    document.querySelectorAll('[data-portal-go]').forEach(el=>{
      const target=String(el.dataset.portalGo||'').trim();
      if(target&&!views.has(target)){
        invalid.push(target);
        el.dataset.routeInvalid='1';
        el.setAttribute('aria-disabled','true');
      }else{
        delete el.dataset.routeInvalid;
        el.removeAttribute('aria-disabled');
      }
    });
    window.__230matchRouteAudit={checkedAt:new Date().toISOString(),invalid:[...new Set(invalid)]};
    if(invalid.length)console.warn('[230MATCH V3] invalid portal routes',window.__230matchRouteAudit.invalid);
    else void 0;
  };

  const normalizeMobileLabels=()=>{
    const labels={
      participants:'참가 기록', notifications:'알림 관리', records:'대회 기록',
      tournaments:'대회 목록', board:'공지사항', print:'출력 센터',
      operation:'코트 현황', 'prelim-public':'예선 현황', settings:'대회 관리'
    };
    document.querySelectorAll('#mobileMoreSheet [data-portal-go]').forEach(btn=>{
      const b=btn.querySelector('b'); const key=btn.dataset.portalGo;
      if(b&&labels[key])b.textContent=labels[key];
    });
  };

  const updateViewport=()=>{
    const vv=window.visualViewport;
    const h=vv?.height||window.innerHeight;
    document.documentElement.style.setProperty('--stage3215-vh',`${h*.01}px`);
    const keyboard=!!vv && window.innerHeight-vv.height>180;
    document.body.classList.toggle('stage3215-keyboard-open',keyboard);
  };

  document.addEventListener('click',e=>{
    const bad=e.target.closest?.('[data-route-invalid="1"]');
    if(!bad)return;
    e.preventDefault();e.stopPropagation();
    alert('연결되지 않은 메뉴입니다. 관리자에게 알려주세요.');
  },true);

  const ready=()=>{normalizeMobileLabels();auditRoutes();updateViewport();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  window.addEventListener('resize',updateViewport,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(updateViewport,180),{passive:true});
  window.visualViewport?.addEventListener('resize',updateViewport,{passive:true});
  window.addEventListener('hashchange',()=>setTimeout(auditRoutes,0));
  window.stage3215AuditRoutes=auditRoutes;
})();


/* Stage 33.0 · production operation release */
(function stage330ProductionRelease(){
  const RELEASE={version:'33.0.1',channel:'production',label:'230MATCH V3 정식 운영본 · 모바일 메뉴 보정'};
  window.__230MATCH_RELEASE__=Object.freeze(RELEASE);
  function finalize(){
    const label=document.getElementById('buildStageLabel');
    if(label){label.textContent='230MATCH V3 · 당일 운영 대시보드';label.title='Version 33.1';}
    document.documentElement.dataset.release='33.0';
    document.body?.classList.add('production-release');
    // 리허설 도구는 유지보수 도구 내부에서만 접근하게 유지합니다.
    document.querySelectorAll('[data-stage3213-rehearsal], [data-portal-go="rehearsal"]').forEach(el=>{
      if(!el.closest('.settings-maintenance-tools')) el.hidden=true;
    });
    try{
      window.stage3215AuditRoutes?.();
      const invalid=window.__230matchRouteAudit?.invalid||[];
      if(invalid.length) console.warn('[230MATCH V3] Stage33.0 release route warnings',invalid);
      else void 0;
    }catch(err){console.warn('[230MATCH V3] Stage33.0 preflight warning',err);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',finalize,{once:true});else finalize();
})();


/* Stage 33.2 · operation mistake prevention */
(function stage332Release(){
  const ready=()=>{
    const label=document.getElementById('buildStageLabel');
    if(label){label.textContent='230MATCH V3 · 통합 현장 운영 안정본';label.title='Version 33.3';}
    document.documentElement.dataset.release='33.2';
    window.__230MATCH_RELEASE__=Object.freeze({version:'34.2.1',channel:'test',label:'230MATCH 자동 문자 전환 승인창 수정 테스트본'});
    void 0;
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();


/* Stage 34.1.1 · restore tournament setup and draw controls */
(function(){const ready=()=>{const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 34.1.1 · 운영 준비·추첨 복구 테스트본';label.title='Version 34.1.1';}console.info('[230MATCH] Stage34.1.1 tournament setup/draw tab ready');};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();})();

/* Stage 34.2 · single operation workspace reconstruction */
(function stage342SingleWorkspace(){
  function move(el,target){if(el&&target)target.appendChild(el);}
  function rename(id,text){const el=document.getElementById(id);if(el)el.textContent=text;}
  function init(){
    const prelimTarget=document.getElementById('stage342PrelimContent');
    const mainTarget=document.getElementById('stage342MainContent');
    const manageTarget=document.getElementById('stage342ManageContent');
    const prelim=document.getElementById('unifiedPrelimSetup');
    const main=document.querySelector('.operation-general-settings');
    if(!prelimTarget||!mainTarget||!manageTarget||!prelim||!main)return;

    // Keep every existing control and listener, but regroup them into three visible sections.
    [...prelim.children].forEach(child=>{
      if(child.id==='prelimPilotPanel'||child.id==='stage326PilotPanel'||child.classList.contains('section-head'))return;
      move(child,prelimTarget);
    });
    [...main.children].forEach(child=>{
      if(child.classList.contains('section-head'))return;
      move(child,mainTarget);
    });

    rename('lockPrelimBtn','예선 확정');
    rename('unlockPrelimBtn','예선 잠금 해제');
    rename('resetPrelimBtn','예선 초기화');
    rename('lockDrawBtn','본선 확정');
    rename('unlockDrawBtn','본선 잠금 해제');
    rename('reshuffleDrawBtn','본선 재추첨');
    rename('resetBtn','전체 초기화');
    rename('generateLinkedDrawBtn','본선 선추첨');
    rename('syncLinkedDrawBtn','확정팀 반영');
    rename('assignCourtsBtn','본선 코트배정');

    const dangerIds=['unlockPrelimBtn','resetPrelimBtn','reshuffleDrawBtn','unlockDrawBtn','resetBtn'];
    dangerIds.forEach(id=>move(document.getElementById(id),manageTarget));
    const recovery=document.getElementById('saveRecoveryBtnInline');
    if(recovery){recovery.textContent='복구점 저장';move(recovery,manageTarget);}
    const restore=document.createElement('button');
    restore.type='button';restore.className='btn btn-light';restore.textContent='복구 열기';
    restore.addEventListener('click',()=>{const btn=document.querySelector('[data-settings-view="backup"]')||document.querySelector('[data-settings-view="recovery"]');if(btn)btn.click();else navigatePortalView?.('settings',{pushHistory:true});});
    manageTarget.appendChild(restore);

    // Primary actions first, secondary settings below.
    const prelimRow=prelimTarget.querySelector('.button-row');
    if(prelimRow){['generatePrelimBtn','assignPrelimCourtsBtn','lockPrelimBtn','generateLinkedDrawBtn','syncLinkedDrawBtn'].forEach(id=>{const b=document.getElementById(id);if(b)prelimRow.appendChild(b);});}
    const mainRow=mainTarget.querySelector('.button-row');
    if(mainRow){['instantDrawBtn','rouletteDrawBtn','seededDrawBtn','assignCourtsBtn','lockDrawBtn'].forEach(id=>{const b=document.getElementById(id);if(b)mainRow.appendChild(b);});}

    const update=()=>{
      const prelimLocked=!!state?.prelim?.locked;
      const drawLocked=!!state?.settings?.drawLocked;
      const groups=state?.prelim?.groups?.length||0;
      const matches=state?.matches?.length||0;
      const ps=document.getElementById('stage342PrelimState');
      const ms=document.getElementById('stage342MainState');
      const pb=document.getElementById('stage342PrelimSummary');
      const mb=document.getElementById('stage342MainSummary');
      if(ps)ps.textContent=prelimLocked?'확정됨 🔒':groups?`${groups}조 준비`:'설정 전';
      if(ms)ms.textContent=drawLocked?'확정됨 🔒':matches?`${matches}경기 생성`:'미추첨';
      if(pb)pb.textContent=prelimLocked?'확정 완료':groups?'진행 가능':'준비 필요';
      if(mb)mb.textContent=drawLocked?'확정 완료':matches?'검토 중':'준비 필요';
      const overall=document.getElementById('stage342OverallState');
      if(overall)overall.textContent=prelimLocked&&drawLocked?'준비 완료':prelimLocked?'본선 준비':'예선 준비';
    };
    update();
    // 성능 안정화: 운영 요약 1.5초 폴링 제거. 실제 조작/렌더 시 상태가 갱신된다.
    document.addEventListener('click',event=>{if(event.target.closest?.('[data-operation-section],[data-portal-go="operation"]'))setTimeout(update,0);},true);
    const workspace=document.getElementById('view-operation');
    if(workspace&&currentRole==='admin')workspace.dataset.operationMode='setup';
    const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 34.2.1 · 자동 문자 전환 승인창 수정 테스트본';label.title='Version 34.2.1';}
    document.documentElement.dataset.build='3421';
    console.info('[230MATCH] Stage34.2 single operation workspace ready');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();


/* Stage 34.3 · multi-division independent operation */
const DIVISION_GLOBAL_KEYS=new Set(['schemaVersion','tournament','multiDivision','updatedAt','legacyBridge']);
const DIVISION_GLOBAL_PORTAL_KEYS=new Set(['tournamentArchives','participantArchives','resultArchives','tournamentTemplates']);
function divisionClone(value){try{return structuredClone(value);}catch(_e){return JSON.parse(JSON.stringify(value));}}
function newDivisionId(){try{return crypto.randomUUID();}catch(_e){return `division-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}}
function parseDivisionNames(value){const rows=String(value||'').split(/[,\n]/).map(v=>v.trim()).filter(Boolean);return [...new Set(rows.length?rows:['기본 부서'])];}
function captureCurrentDivisionSnapshot(source=state){
  const snapshot={};
  Object.keys(source||{}).forEach(key=>{if(!DIVISION_GLOBAL_KEYS.has(key)&&key!=='portal')snapshot[key]=divisionClone(source[key]);});
  const portal={};Object.entries(source?.portal||{}).forEach(([key,value])=>{if(!DIVISION_GLOBAL_PORTAL_KEYS.has(key))portal[key]=divisionClone(value);});snapshot.portal=portal;return snapshot;
}
function ensureMultiDivisionRuntime(){
  if(!state.multiDivision||!Array.isArray(state.multiDivision.divisions)||!state.multiDivision.divisions.length){const id=newDivisionId();state.multiDivision={version:1,activeDivisionId:id,divisions:[{id,name:state.tournament?.division||'기본 부서',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),snapshot:captureCurrentDivisionSnapshot()}]};}
  let active=state.multiDivision.divisions.find(x=>x.id===state.multiDivision.activeDivisionId);if(!active){active=state.multiDivision.divisions[0];state.multiDivision.activeDivisionId=active.id;}state.tournament.division=active.name||state.tournament.division||'부서 미설정';return active;
}
function syncCurrentDivisionRuntime(){const active=ensureMultiDivisionRuntime();active.name=state.tournament?.division||active.name;active.updatedAt=new Date().toISOString();active.snapshot=captureCurrentDivisionSnapshot();return active;}
function blankDivisionSnapshot(name,copySettings=true){
  const blank=initialState();blank.tournament={name:state.tournament?.name||'대회',division:name};
  if(copySettings){blank.settings=divisionClone(state.settings||blank.settings);blank.prelim.settings=divisionClone(state.prelim?.settings||blank.prelim.settings);blank.messaging.settings=divisionClone(state.messaging?.settings||blank.messaging.settings);blank.portal={...(blank.portal||{}),guide:divisionClone(state.portal?.guide||{}),posts:divisionClone(state.portal?.posts||[]),applications:[],resultArchives:[]};}
  const snapshot={};Object.keys(blank).forEach(key=>{if(!DIVISION_GLOBAL_KEYS.has(key)&&key!=='portal')snapshot[key]=divisionClone(blank[key]);});snapshot.portal={};Object.entries(blank.portal||{}).forEach(([key,value])=>{if(!DIVISION_GLOBAL_PORTAL_KEYS.has(key))snapshot.portal[key]=divisionClone(value);});return snapshot;
}
function initializeTournamentDivisions(names){
  const list=parseDivisionNames(names);const now=new Date().toISOString();const firstId=newDivisionId();
  state.tournament.division=list[0];state.multiDivision={version:1,activeDivisionId:firstId,divisions:[{id:firstId,name:list[0],createdAt:now,updatedAt:now,snapshot:captureCurrentDivisionSnapshot()}]};
  list.slice(1).forEach(name=>state.multiDivision.divisions.push({id:newDivisionId(),name,createdAt:now,updatedAt:now,snapshot:blankDivisionSnapshot(name,true)}));
}
function applyDivisionSnapshot(record){
  if(!record?.snapshot)return false;syncCurrentDivisionRuntime();
  const preservedTournament={...(state.tournament||{})};const globalPortal={};Object.entries(state.portal||{}).forEach(([key,value])=>{if(DIVISION_GLOBAL_PORTAL_KEYS.has(key))globalPortal[key]=divisionClone(value);});
  const managed=new Set();state.multiDivision.divisions.forEach(d=>Object.keys(d.snapshot||{}).forEach(k=>{if(k!=='portal')managed.add(k);}));managed.forEach(key=>delete state[key]);
  Object.entries(record.snapshot||{}).forEach(([key,value])=>{if(key!=='portal')state[key]=divisionClone(value);});
  state.portal={...globalPortal,...divisionClone(record.snapshot.portal||{})};state.tournament={...preservedTournament,division:record.name};state.multiDivision.activeDivisionId=record.id;
  ensurePortalState();ensurePrelimState(state);ensureTimeState(state);ensureDrawMeta(state);ensureMessagingState(state);ensureContacts(state);ensureAuditState(state);ensureEarlyMainSettings(state);ensureVenueSettings(state);ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state);ensurePrelimCourtStatuses(state);ensureOperatorState();ensureMainDrawLifecycle(state);return true;
}
function switchDivisionWorkspace(id){const next=state.multiDivision?.divisions?.find(x=>x.id===id);if(!next||next.id===state.multiDivision.activeDivisionId)return;if(!applyDivisionSnapshot(next))return;state.tournament.capacity=Math.max(1,Number(next.snapshot?.divisionConfig?.capacity||state.prelim?.settings?.activeTeamCount||96));safePersistState(`부서 전환 · ${next.name}`);syncInputs();syncPrelimInputs();renderVenueSettingsEditor();render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});renderOperatorControls();applyRoleUI();renderPortalViews();renderDivisionWorkspaceBar();autoSmsSnapshot=buildAutoSmsSnapshot();notice(`${state.tournament.name} · ${next.name}으로 전환했습니다.`,'success');}
function renderDivisionWorkspaceBarLegacy(){
  ensureMultiDivisionRuntime();let bar=document.getElementById('divisionWorkspaceBar');if(!bar){bar=document.createElement('section');bar.id='divisionWorkspaceBar';bar.className='division-workspace-bar panel';const nav=document.querySelector('main.app-shell > nav.mode-tabs');if(nav)nav.insertAdjacentElement('afterend',bar);else document.querySelector('main.app-shell')?.prepend(bar);}
  const divisions=state.multiDivision.divisions||[];bar.innerHTML=`<div class="division-workspace-current"><span>현재 운영</span><strong>${escapeHtml(state.tournament?.name||'대회명 없음')}</strong></div><label><span class="sr-only">현재 부서</span><select id="activeDivisionSelect">${divisions.map(d=>`<option value="${escapeHtml(d.id)}" ${d.id===state.multiDivision.activeDivisionId?'selected':''}>${escapeHtml(d.name)}</option>`).join('')}</select></label><span class="division-workspace-count">부서 ${divisions.length}개</span><button type="button" id="openDivisionManagerBtn" class="btn btn-light btn-small" data-admin-only="true">부서 관리</button>`;
  bar.querySelector('#activeDivisionSelect')?.addEventListener('change',e=>switchDivisionWorkspace(e.target.value));bar.querySelector('#openDivisionManagerBtn')?.addEventListener('click',openDivisionManager);applyRoleUI();
}
function ensureDivisionManagerModal(){let modal=document.getElementById('divisionManagerModal');if(modal)return modal;modal=document.createElement('div');modal.id='divisionManagerModal';modal.className='modal';modal.hidden=true;modal.innerHTML=`<div class="modal-card division-manager-card"><div class="modal-head"><div><small>TOURNAMENT DIVISIONS</small><h2>부서 관리</h2><p>각 부서는 참가자·예선·본선·코트·문자·복구 상태를 독립적으로 보관합니다.</p></div><button type="button" class="modal-close" data-division-close>×</button></div><div id="divisionManagerList" class="division-manager-list"></div><div class="division-add-row"><input id="newDivisionNameInput" placeholder="새 부서명"><button type="button" class="btn btn-primary" data-division-add-blank>빈 부서 추가</button><button type="button" class="btn btn-light" data-division-add-copy>현재 설정 복사</button></div><p class="division-manager-note">부서 전환 전 현재 상태는 자동 저장됩니다. 마지막 부서는 삭제할 수 없습니다.</p></div>`;document.body.appendChild(modal);modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-division-close]'))closeDivisionManager();const rename=e.target.closest('[data-division-rename]');if(rename)renameDivision(rename.dataset.divisionRename);const del=e.target.closest('[data-division-delete]');if(del)deleteDivision(del.dataset.divisionDelete);const go=e.target.closest('[data-division-switch]');if(go){switchDivisionWorkspace(go.dataset.divisionSwitch);renderDivisionManagerList();}if(e.target.closest('[data-division-add-blank]'))addDivision(false);if(e.target.closest('[data-division-add-copy]'))addDivision(true);});return modal;}
function openDivisionManager(){if(!requireAdmin('부서 관리'))return;ensureDivisionManagerModal().hidden=false;renderDivisionManagerList();}
function closeDivisionManager(){const modal=document.getElementById('divisionManagerModal');if(modal)modal.hidden=true;}
function renderDivisionManagerList(){const root=document.getElementById('divisionManagerList');if(!root)return;const active=state.multiDivision.activeDivisionId;root.innerHTML=state.multiDivision.divisions.map((d,i)=>`<article class="division-manager-item ${d.id===active?'active':''}"><div><span>${d.id===active?'현재 운영':'부서 '+(i+1)}</span><strong>${escapeHtml(d.name)}</strong><small>참가 ${(d.snapshot?.teams||[]).length}팀 · 예선 ${(d.snapshot?.prelim?.matches||[]).length}경기 · 본선 ${Object.values(d.snapshot?.draw?.rounds||{}).flat().length}경기</small></div><div><button type="button" class="btn btn-light btn-small" data-division-switch="${escapeHtml(d.id)}">열기</button><button type="button" class="btn btn-light btn-small" data-division-rename="${escapeHtml(d.id)}">이름 변경</button><button type="button" class="btn btn-danger-outline btn-small" data-division-delete="${escapeHtml(d.id)}" ${state.multiDivision.divisions.length===1?'disabled':''}>삭제</button></div></article>`).join('');}
function addDivision(copyCurrent){const input=document.getElementById('newDivisionNameInput');const name=String(input?.value||'').trim();if(!name){notice('추가할 부서명을 입력하세요.','warning');input?.focus();return;}if(state.multiDivision.divisions.some(d=>d.name===name)){notice('같은 이름의 부서가 이미 있습니다.','warning');return;}syncCurrentDivisionRuntime();const now=new Date().toISOString();const record={id:newDivisionId(),name,createdAt:now,updatedAt:now,snapshot:copyCurrent?captureCurrentDivisionSnapshot():blankDivisionSnapshot(name,true)};if(copyCurrent){record.snapshot.teams=[];record.snapshot.contacts={};record.snapshot.prelim.activeTeams=[];record.snapshot.prelim.reserveTeams=[];record.snapshot.prelim.groups=[];record.snapshot.prelim.matches=[];record.snapshot.prelim.courts=[];record.snapshot.prelim.qualifiers=[];record.snapshot.draw={size:0,rounds:{}};record.snapshot.drawMeta={...(record.snapshot.drawMeta||{}),locked:false,createdAt:null,history:[]};record.snapshot.courts=[];record.snapshot.sharedQueue=[];record.snapshot.venueQueues={};if(record.snapshot.portal){record.snapshot.portal.applications=[];record.snapshot.portal.resultArchives=[];}}state.multiDivision.divisions.push(record);saveState(state);if(input)input.value='';renderDivisionManagerList();renderDivisionWorkspaceBar();notice(`${name} 부서를 추가했습니다.`,'success');}
function renameDivision(id){const record=state.multiDivision.divisions.find(d=>d.id===id);if(!record)return;const name=String(prompt('새 부서명을 입력하세요.',record.name)||'').trim();if(!name||name===record.name)return;if(state.multiDivision.divisions.some(d=>d.id!==id&&d.name===name)){notice('같은 이름의 부서가 이미 있습니다.','warning');return;}record.name=name;if(id===state.multiDivision.activeDivisionId)state.tournament.division=name;saveState(state);renderDivisionManagerList();renderDivisionWorkspaceBar();notice('부서명을 변경했습니다.','success');}
function deleteDivision(id){if(state.multiDivision.divisions.length<=1){notice('마지막 부서는 삭제할 수 없습니다.','warning');return;}const record=state.multiDivision.divisions.find(d=>d.id===id);if(!record)return;if(!confirm(`“${record.name}” 부서의 참가자·예선·본선·코트·문자 데이터를 모두 삭제할까요?`))return;saveRecovery(state,`${state.tournament.name} · ${record.name} 부서 삭제 전`);const wasActive=id===state.multiDivision.activeDivisionId;state.multiDivision.divisions=state.multiDivision.divisions.filter(d=>d.id!==id);if(wasActive){state.multiDivision.activeDivisionId=state.multiDivision.divisions[0].id;applyDivisionSnapshot(state.multiDivision.divisions[0]);}saveState(state);renderDivisionManagerList();renderDivisionWorkspaceBar();if(wasActive)location.reload();else notice(`${record.name} 부서를 삭제했습니다.`,'success');}

ensureMultiDivisionRuntime();renderDivisionWorkspaceBar();void 0;


/* Stage 34.3.1 · division manager + per-division settings hotfix */
function divisionSnapshotSettings(record){
  const snap=record?.snapshot||{};
  snap.settings=snap.settings||divisionClone(state.settings||initialState().settings);
  snap.prelim=snap.prelim||divisionClone(initialState().prelim);
  snap.prelim.settings=snap.prelim.settings||divisionClone(initialState().prelim.settings);
  snap.portal=snap.portal||{};
  snap.portal.guide=snap.portal.guide||{};
  return snap;
}
function venueLinesFromSnapshot(record){
  const snap=divisionSnapshotSettings(record);
  const venues=Array.isArray(snap.settings?.venues)?snap.settings.venues:[];
  return venues.map(v=>`${v.name||'구장'}|${Math.max(1,Number(v.courtCount||1))}|${v.usePrelim!==false?'예선':''}|${v.useMain!==false?'본선':''}`).join('\n');
}
function parseDivisionVenueLines(value){
  const rows=String(value||'').split(/\n+/).map(v=>v.trim()).filter(Boolean);
  return rows.map((row,i)=>{
    const parts=row.split('|').map(v=>v.trim());
    const name=parts[0]||`구장${i+1}`;
    const courtCount=Math.max(1,Number(parts[1]||1));
    const flags=parts.slice(2).join('|');
    const hasFlag=flags.length>0;
    return {id:`division-venue-${Date.now()}-${i}`,name,courtCount,courtPrefix:name,usePrelim:hasFlag?flags.includes('예선'):true,useMain:hasFlag?flags.includes('본선'):true};
  });
}

function normalizeDivisionVenue(v,index=0){
  const raw=Array.isArray(v?.courtNumbers)?v.courtNumbers:[];
  const fallback=Math.max(1,Number(v?.courtMax||v?.totalCourts||v?.courtCount||8));
  const courtMax=Math.max(1,Math.min(40,Number(v?.courtMax||v?.totalCourts||Math.max(fallback,...raw,1))||fallback));
  const courtNumbers=[...new Set((raw.length?raw:Array.from({length:Math.max(1,Number(v?.courtCount||fallback))},(_,i)=>i+1)).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=courtMax))].sort((a,b)=>a-b);
  return {id:String(v?.id||`division-venue-${Date.now()}-${index}`),name:String(v?.name||`구장${index+1}`).trim()||`구장${index+1}`,courtPrefix:String(v?.courtPrefix||v?.name||`코트`).trim()||'코트',courtMax,courtNumbers:courtNumbers.length?courtNumbers:[1],courtCount:courtNumbers.length||1,usePrelim:v?.usePrelim!==false,useMain:v?.useMain!==false};
}
function divisionVenueCardsHtml(venues,scope){
  const list=(Array.isArray(venues)&&venues.length?venues:[{name:'국제',courtMax:8,courtNumbers:[1,2,3,4,5,6,7,8],usePrelim:true,useMain:true}]).map(normalizeDivisionVenue);
  return `<div class="division-venue-builder" data-venue-scope="${scope}"><div class="division-venue-builder-head"><div><strong>구장·사용 코트</strong><small>구장을 추가하고 실제 사용하는 코트 번호만 선택합니다.</small></div><button type="button" class="btn btn-light btn-small" data-add-division-venue>+ 구장 추가</button></div><div class="division-venue-card-list">${list.map((v,i)=>divisionVenueCardHtml(v,i)).join('')}</div></div>`;
}
function divisionVenueCardHtml(v,index){
  v=normalizeDivisionVenue(v,index);
  return `<article class="division-venue-card" data-division-venue-id="${escapeHtml(v.id)}"><div class="division-venue-card-head"><strong>구장 ${index+1}</strong><button type="button" class="btn btn-danger-outline btn-small" data-remove-division-venue>삭제</button></div><div class="division-venue-fields"><label>구장명<input data-dv-field="name" value="${escapeHtml(v.name)}" placeholder="예: 국제"></label><label>표시 접두어<input data-dv-field="courtPrefix" value="${escapeHtml(v.courtPrefix)}" placeholder="예: 국제"></label><label>코트 번호 범위<input data-dv-field="courtMax" type="number" min="1" max="40" value="${v.courtMax}"></label></div><div class="division-venue-scope"><label><input data-dv-field="usePrelim" type="checkbox" ${v.usePrelim?'checked':''}> 예선 사용</label><label><input data-dv-field="useMain" type="checkbox" ${v.useMain?'checked':''}> 본선 사용</label></div><div class="division-court-picker"><div class="division-court-picker-head"><span>사용 코트 선택</span><button type="button" class="btn btn-light btn-small" data-select-all-courts>전체</button><button type="button" class="btn btn-light btn-small" data-clear-all-courts>해제</button></div><div class="division-court-checks">${Array.from({length:v.courtMax},(_,n)=>n+1).map(no=>`<label class="division-court-chip"><input type="checkbox" data-court-no="${no}" ${v.courtNumbers.includes(no)?'checked':''}><span>${no}번</span></label>`).join('')}</div><small class="division-court-summary">선택 ${v.courtNumbers.length}면 · ${v.courtNumbers.map(n=>`${v.courtPrefix}${n}`).join(', ')}</small></div></article>`;
}
function readDivisionVenueBuilder(root){
  return [...root.querySelectorAll('.division-venue-card')].map((card,i)=>{
    const name=String(card.querySelector('[data-dv-field="name"]')?.value||`구장${i+1}`).trim()||`구장${i+1}`;
    const courtPrefix=String(card.querySelector('[data-dv-field="courtPrefix"]')?.value||name).trim()||name;
    const courtMax=Math.max(1,Math.min(40,Number(card.querySelector('[data-dv-field="courtMax"]')?.value||1)));
    const courtNumbers=[...card.querySelectorAll('[data-court-no]:checked')].map(x=>Number(x.dataset.courtNo)).filter(n=>n>=1&&n<=courtMax).sort((a,b)=>a-b);
    return normalizeDivisionVenue({id:card.dataset.divisionVenueId,name,courtPrefix,courtMax,courtNumbers:courtNumbers.length?courtNumbers:[1],usePrelim:card.querySelector('[data-dv-field="usePrelim"]')?.checked!==false,useMain:card.querySelector('[data-dv-field="useMain"]')?.checked!==false},i);
  });
}
function rerenderDivisionVenueCard(card){
  const list=card.parentElement, index=[...list.children].indexOf(card);
  const venue=readDivisionVenueBuilder(card.closest('.division-venue-builder')).find(v=>v.id===card.dataset.divisionVenueId)||normalizeDivisionVenue({},index);
  const wrap=document.createElement('div');wrap.innerHTML=divisionVenueCardHtml(venue,index);card.replaceWith(wrap.firstElementChild);
}

function ensureDivisionSettingsModal(){
  let modal=document.getElementById('divisionSettingsModal');
  if(modal)return modal;
  modal=document.createElement('dialog');modal.id='divisionSettingsModal';modal.className='division-settings-dialog';
  modal.innerHTML=`<div class="modal-card division-settings-card"><div class="modal-head"><div><small>DIVISION SETTINGS</small><h2>부서별 운영 설정</h2><p>이 부서의 참가 정원·예선·본선·구장과 사용 코트를 별도로 설정합니다.</p></div><button type="button" class="modal-close" data-division-settings-close>×</button></div><form id="divisionSettingsForm"><input type="hidden" id="divisionSettingsId"><div class="division-settings-grid"><label>부서명<input id="divisionSettingsName" required></label><label>참가 정원<input id="divisionSettingsCapacity" type="number" min="1" required></label><label>본선 규모<select id="divisionSettingsDrawSize"><option value="32">32강</option><option value="64">64강</option><option value="128">128강</option></select></label><label>조당 본선 진출팀<input id="divisionSettingsQualifiers" type="number" min="1" max="3"></label><label>2팀조 수<input id="divisionSettingsTwoGroups" type="number" min="0"></label><label>경기시간(분)<input id="divisionSettingsMinutes" type="number" min="10"></label></div><div id="divisionSettingsVenueBuilder"></div><div class="division-settings-actions"><button type="button" class="btn btn-light" data-division-settings-close>취소</button><button type="submit" class="btn btn-primary">이 부서 설정 저장</button></div><p id="divisionSettingsMessage" class="division-settings-message"></p></form></div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-division-settings-close]'))modal.close();});
  modal.querySelector('#divisionSettingsForm')?.addEventListener('submit',saveDivisionSettingsFromModal);
  return modal;
}
function openDivisionSettings(id){
  const record=state.multiDivision?.divisions?.find(d=>d.id===id);if(!record)return;
  const snap=divisionSnapshotSettings(record),ps=snap.prelim?.settings||{},settings=snap.settings||{};
  const modal=ensureDivisionSettingsModal();
  modal.querySelector('#divisionSettingsId').value=record.id;
  modal.querySelector('#divisionSettingsName').value=record.name||'';
  modal.querySelector('#divisionSettingsCapacity').value=Number(snap.divisionConfig?.capacity||ps.activeTeamCount||96);
  modal.querySelector('#divisionSettingsDrawSize').value=String(settings.drawSize||64);
  modal.querySelector('#divisionSettingsQualifiers').value=Number(ps.qualifiersPerGroup||2);
  modal.querySelector('#divisionSettingsTwoGroups').value=Number(ps.twoTeamGroups||ps.twoTeamGroupCount||0);
  modal.querySelector('#divisionSettingsMinutes').value=Number(settings.matchMinutes||40);
  modal.querySelector('#divisionSettingsVenueBuilder').innerHTML=divisionVenueCardsHtml(settings.venues||[],'settings');
  modal.querySelector('#divisionSettingsMessage').textContent='';
  if(!modal.open)modal.showModal();
}
function saveDivisionSettingsFromModal(e){
  e.preventDefault();
  const modal=document.getElementById('divisionSettingsModal');
  const id=modal?.querySelector('#divisionSettingsId')?.value;
  const record=state.multiDivision?.divisions?.find(d=>d.id===id);if(!record)return;
  const name=String(modal.querySelector('#divisionSettingsName')?.value||'').trim();
  const capacity=Math.max(1,Number(modal.querySelector('#divisionSettingsCapacity')?.value||96));
  const drawSize=Math.max(2,Number(modal.querySelector('#divisionSettingsDrawSize')?.value||64));
  const qualifiers=Math.max(1,Number(modal.querySelector('#divisionSettingsQualifiers')?.value||2));
  const twoGroups=Math.max(0,Number(modal.querySelector('#divisionSettingsTwoGroups')?.value||0));
  const matchMinutes=Math.max(10,Number(modal.querySelector('#divisionSettingsMinutes')?.value||40));
  const builder=modal.querySelector('#divisionSettingsVenueBuilder .division-venue-builder');
  const venues=builder?readDivisionVenueBuilder(builder):[];
  const msg=modal.querySelector('#divisionSettingsMessage');
  if(!name){msg.textContent='부서명을 입력하세요.';return;}
  if(state.multiDivision.divisions.some(d=>d.id!==id&&d.name===name)){msg.textContent='같은 이름의 부서가 이미 있습니다.';return;}
  if(!venues.length){msg.textContent='구장을 한 곳 이상 추가하세요.';return;}
  if(venues.some(v=>!v.courtNumbers?.length)){msg.textContent='각 구장에서 사용할 코트를 한 면 이상 선택하세요.';return;}
  if(!venues.some(v=>v.usePrelim)){msg.textContent='예선 사용 구장을 한 곳 이상 지정하세요.';return;}
  if(!venues.some(v=>v.useMain)){msg.textContent='본선 사용 구장을 한 곳 이상 지정하세요.';return;}
  const snap=divisionSnapshotSettings(record);
  record.name=name;record.updatedAt=new Date().toISOString();
  snap.divisionConfig={...(snap.divisionConfig||{}),capacity};
  snap.settings={...(snap.settings||{}),drawSize,matchMinutes,venues:divisionClone(venues)};
  snap.prelim=snap.prelim||{};snap.prelim.settings={...(snap.prelim.settings||{}),activeTeamCount:capacity,qualifiersPerGroup:qualifiers,twoTeamGroups:twoGroups,twoTeamGroupCount:twoGroups};
  snap.portal=snap.portal||{};snap.portal.guide={...(snap.portal.guide||{}),venue:venues.map(v=>v.name).join(' · ')};
  record.snapshot=snap;
  if(id===state.multiDivision.activeDivisionId){state.tournament.division=name;state.tournament.capacity=capacity;state.settings={...(state.settings||{}),drawSize,matchMinutes,venues:divisionClone(venues)};state.prelim.settings={...(state.prelim?.settings||{}),activeTeamCount:capacity,qualifiersPerGroup:qualifiers,twoTeamGroups:twoGroups,twoTeamGroupCount:twoGroups};ensureVenueSettings(state);ensureVenueQueues(state);}
  saveState(state);renderDivisionManagerList();renderDivisionWorkspaceBar();modal.close();notice(`${name} 부서 설정을 저장했습니다.`,'success');
  if(id===state.multiDivision.activeDivisionId){syncInputs();syncPrelimInputs();renderVenueSettingsEditor();renderOperatorControls();renderPortalViews();}
}
const originalRenderDivisionManagerList=renderDivisionManagerList;
renderDivisionManagerList=function(){
  const root=document.getElementById('divisionManagerList');if(!root)return;
  const active=state.multiDivision.activeDivisionId;
  root.innerHTML=state.multiDivision.divisions.map((d,i)=>{
    const snap=divisionSnapshotSettings(d),ps=snap.prelim?.settings||{},settings=snap.settings||{},venues=Array.isArray(settings.venues)?settings.venues:[];
    return `<article class="division-manager-item ${d.id===active?'active':''}"><div><span>${d.id===active?'현재 운영':'부서 '+(i+1)}</span><strong>${escapeHtml(d.name)}</strong><small>정원 ${Number(snap.divisionConfig?.capacity||ps.activeTeamCount||96)}팀 · 본선 ${Number(settings.drawSize||64)}강 · 구장 ${venues.map(v=>escapeHtml(v.name)).join(' · ')||'미설정'}</small><small>참가 ${(snap.teams||[]).length}팀 · 예선 ${(snap.prelim?.matches||[]).length}경기 · 본선 ${Object.values(snap.draw?.rounds||{}).flat().length}경기</small></div><div><button type="button" class="btn btn-primary btn-small" data-division-switch="${escapeHtml(d.id)}">운영 열기</button><button type="button" class="btn btn-light btn-small" data-division-settings="${escapeHtml(d.id)}">설정 편집</button><button type="button" class="btn btn-light btn-small" data-division-rename="${escapeHtml(d.id)}">이름 변경</button><button type="button" class="btn btn-danger-outline btn-small" data-division-delete="${escapeHtml(d.id)}" ${state.multiDivision.divisions.length===1?'disabled':''}>삭제</button></div></article>`;
  }).join('');
};

/* delegated events keep buttons alive after any re-render */
document.addEventListener('click',e=>{
  const manager=e.target.closest('#openDivisionManagerBtn,[data-open-division-manager]');
  if(manager){e.preventDefault();openDivisionManager();return;}
  const settings=e.target.closest('[data-division-settings]');
  if(settings){e.preventDefault();openDivisionSettings(settings.dataset.divisionSettings);return;}
},true);

/* make current tournament editor clearly point to division manager */
function injectDivisionManagerIntoTournamentEditor(){
  const modal=document.getElementById('stage329TournamentEditModal');if(!modal)return;
  const divisionInput=modal.querySelector('#stage329Division');if(!divisionInput)return;
  const label=divisionInput.closest('label')||divisionInput.parentElement;
  if(label&&!modal.querySelector('[data-open-division-manager]')){
    const help=document.createElement('div');help.className='division-editor-help';help.innerHTML='<span>이 입력은 현재 부서명만 변경합니다. 부서 추가와 부서별 정원·구장은 부서 관리에서 설정하세요.</span><button type="button" class="btn btn-light btn-small" data-open-division-manager>부서 관리 열기</button>';
    label.insertAdjacentElement('afterend',help);
  }
}
injectDivisionManagerIntoTournamentEditor(); // 61.1.1: broad body observer removed; editor is refreshed explicitly on open

renderDivisionWorkspaceBar();
/* Stage 61.1.0 · guide route + tournament editor guide integration */
document.addEventListener('click',e=>{
  const direct=e.target.closest?.('[data-portal-go="guide"],.mobile-guide-button');
  const card=e.target.closest?.('[data-guide-tournament-id]');
  if(!direct&&!card)return;
  e.preventDefault();e.stopImmediatePropagation();
  const id=card?String(card.dataset.guideTournamentId||''):'';
  const current=String(state.multiTournament?.activeTournamentId||state.tournament?.id||'');
  if(id&&id!==current){try{switchTournamentWorkspace(id);}catch(error){notice('대회 요강을 불러오지 못했습니다: '+(error?.message||error),'error');return;}}
  navigatePortalView('guide',{pushHistory:true});
  stage3610FocusGuideImage?.();
},true);
const stage6110Style=document.createElement('style');stage6110Style.id='stage6110GuideEditorCss';stage6110Style.textContent=`.s6001-guide{border:1px solid #d7e2f2;border-radius:16px;padding:16px;background:#fbfdff}.s6001-guide .s6001-wide{grid-column:1/-1}.s6001-guide textarea{min-height:86px;resize:vertical}.s6001-guide-remove{display:flex!important;flex-direction:row!important;align-items:center;gap:8px}.s6001-guide-remove input{width:auto!important}.s6001-guide-image{grid-column:1/-1;display:grid;gap:8px}.s6001-guide-image img{max-width:260px;max-height:360px;object-fit:contain;border:1px solid #d7e2f2;border-radius:10px;background:white}@media(max-width:760px){.s6001-guide .s6001-wide{grid-column:auto}.s6001-guide .s6001-section-head{align-items:flex-start;flex-direction:column}.s6001-guide .s6001-section-head .btn{width:100%}}`;document.head.appendChild(stage6110Style);
console.info('[230MATCH] 61.1.0 ready · guide route fixed and tournament editor guide integrated');

void 0;


let refreshDivisionEditorPanel = window.refreshDivisionEditorPanel || (()=>{});

/* Stage 34.3.2 · division manager real dialog + editor integration */
(function(){
  function removeStaleDivisionManager(){
    const old=document.getElementById('divisionManagerModal');
    if(old && old.tagName!=='DIALOG') old.remove();
  }
  ensureDivisionManagerModal=function(){
    removeStaleDivisionManager();
    let modal=document.getElementById('divisionManagerModal');
    if(modal)return modal;
    modal=document.createElement('dialog');
    modal.id='divisionManagerModal';
    modal.className='modal division-manager-dialog';
    modal.innerHTML=`<div class="modal-head"><div><small>TOURNAMENT DIVISIONS</small><h2>부서 관리</h2><p>부서별 참가자·예선·본선·구장·코트·문자를 독립 관리합니다.</p></div><button type="button" class="modal-close" data-division-close>×</button></div><div class="division-manager-body"><div id="divisionManagerList" class="division-manager-list"></div><div class="division-add-row"><input id="newDivisionNameInput" placeholder="새 부서명"><button type="button" class="btn btn-primary" data-division-add-blank>빈 부서 추가</button><button type="button" class="btn btn-light" data-division-add-copy>현재 설정 복사</button></div><p class="division-manager-note">각 부서의 정원·구장·예선·본선 설정은 ‘설정 편집’에서 따로 관리합니다.</p></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('cancel',e=>{e.preventDefault();closeDivisionManager();});
    modal.addEventListener('click',e=>{
      if(e.target===modal||e.target.closest('[data-division-close]')){closeDivisionManager();return;}
      const rename=e.target.closest('[data-division-rename]');if(rename){renameDivision(rename.dataset.divisionRename);return;}
      const del=e.target.closest('[data-division-delete]');if(del){deleteDivision(del.dataset.divisionDelete);return;}
      const go=e.target.closest('[data-division-switch]');if(go){switchDivisionWorkspace(go.dataset.divisionSwitch);renderDivisionManagerList();refreshDivisionEditorPanel();return;}
      const settings=e.target.closest('[data-division-settings]');if(settings){openDivisionSettings(settings.dataset.divisionSettings);return;}
      if(e.target.closest('[data-division-add-blank]')){addDivision(false);refreshDivisionEditorPanel();return;}
      if(e.target.closest('[data-division-add-copy]')){addDivision(true);refreshDivisionEditorPanel();return;}
    });
    return modal;
  };
  openDivisionManager=function(){
    if(!requireAdmin('부서 관리'))return;
    ensureMultiDivisionRuntime();
    syncCurrentDivisionRuntime();
    const modal=ensureDivisionManagerModal();
    renderDivisionManagerList();
    if(!modal.open)modal.showModal();
    setTimeout(()=>modal.querySelector('#newDivisionNameInput')?.focus(),30);
  };
  closeDivisionManager=function(){
    const modal=document.getElementById('divisionManagerModal');
    if(modal?.open){if(modal.contains(document.activeElement))document.activeElement.blur();modal.close();}
  };

  function editorDivisionHtml(){
    ensureMultiDivisionRuntime();
    const active=state.multiDivision.activeDivisionId;
    return `<div class="division-editor-panel-head"><div><strong>부서 구성</strong><small>부서마다 정원·구장·예선·본선을 따로 설정합니다.</small></div><button type="button" class="btn btn-primary btn-small" data-open-division-manager>전체 부서 관리</button></div><div class="division-editor-list">${state.multiDivision.divisions.map((d,i)=>{const snap=divisionSnapshotSettings(d),ps=snap.prelim?.settings||{},settings=snap.settings||{},venues=Array.isArray(settings.venues)?settings.venues:[];return `<article class="division-editor-item ${d.id===active?'active':''}"><div><span>${d.id===active?'현재 운영':`부서 ${i+1}`}</span><strong>${escapeHtml(d.name)}</strong><small>정원 ${Number(snap.divisionConfig?.capacity||ps.activeTeamCount||96)}팀 · 본선 ${Number(settings.drawSize||64)}강 · ${venues.map(v=>escapeHtml(v.name)).join(' · ')||'구장 미설정'}</small></div><div><button type="button" class="btn btn-light btn-small" data-division-switch="${escapeHtml(d.id)}">운영</button><button type="button" class="btn btn-light btn-small" data-division-settings="${escapeHtml(d.id)}">설정</button></div></article>`;}).join('')}</div><div class="division-editor-add"><input type="text" data-inline-division-name placeholder="새 부서명"><button type="button" class="btn btn-primary btn-small" data-inline-division-add>부서 추가</button></div>`;
  }
  window.refreshDivisionEditorPanel=refreshDivisionEditorPanel=function(){
    const modal=document.getElementById('stage329TournamentEditModal');if(!modal)return;
    const divisionInput=modal.querySelector('#stage329Division');if(!divisionInput)return;
    const label=divisionInput.closest('label')||divisionInput.parentElement;
    let panel=modal.querySelector('#divisionEditorPanel');
    if(!panel){panel=document.createElement('section');panel.id='divisionEditorPanel';panel.className='division-editor-panel';label.insertAdjacentElement('afterend',panel);}
    panel.innerHTML=editorDivisionHtml();
    // The old single division input is retained for compatibility but is clearly current-division-only.
    const cap=label.querySelector('span');if(cap)cap.textContent='현재 운영 부서명';
  };
  injectDivisionManagerIntoTournamentEditor=refreshDivisionEditorPanel;

  document.addEventListener('click',e=>{
    const manager=e.target.closest('#openDivisionManagerBtn,[data-open-division-manager]');
    if(manager){e.preventDefault();e.stopPropagation();openDivisionManager();return;}
    const settings=e.target.closest('[data-division-settings]');
    if(settings){e.preventDefault();e.stopPropagation();openDivisionSettings(settings.dataset.divisionSettings);return;}
    const sw=e.target.closest('[data-division-switch]');
    if(sw && e.target.closest('#divisionEditorPanel')){e.preventDefault();e.stopPropagation();switchDivisionWorkspace(sw.dataset.divisionSwitch);refreshDivisionEditorPanel();return;}
    const add=e.target.closest('[data-inline-division-add]');
    if(add){
      e.preventDefault();e.stopPropagation();
      const input=add.closest('.division-editor-add')?.querySelector('[data-inline-division-name]');
      const name=String(input?.value||'').trim();
      if(!name){notice('추가할 부서명을 입력하세요.','error');input?.focus();return;}
      if(state.multiDivision.divisions.some(d=>d.name===name)){notice('같은 이름의 부서가 이미 있습니다.','error');return;}
      syncCurrentDivisionRuntime();
      state.multiDivision.divisions.push({id:newDivisionId(),name,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),snapshot:blankDivisionSnapshot(name,true)});
      safePersistState(`부서 추가 · ${name}`);renderDivisionWorkspaceBar();refreshDivisionEditorPanel();notice(`${name} 부서를 추가했습니다.`,'success');
    }
  },true);

  // Avoid aria-hidden warnings by moving focus before hiding the wizard.
  closeNewTournamentWizard=function(){
    const modal=wizardEl('newTournamentWizard');
    if(modal){if(modal.contains(document.activeElement))document.activeElement.blur();modal.hidden=true;modal.setAttribute('aria-hidden','true');}
    document.body.style.overflow='';
  };

  // 61.1.1: obsolete whole-body division observer removed. Explicit editor events already refresh this panel.
  removeStaleDivisionManager();
  renderDivisionWorkspaceBar();
  refreshDivisionEditorPanel();
  console.info('[230MATCH V3] 34.3.2 ready');
})();

/* Stage 34.3.3 · division workflow completion */
(function(){
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  let wizardDivisionDrafts=[];

  function safeRefreshDivisionEditor(){
    try{
      const modal=document.getElementById('stage329TournamentEditModal');
      if(!modal)return;
      const divisionInput=modal.querySelector('#stage329Division');
      if(!divisionInput)return;
      const label=divisionInput.closest('label')||divisionInput.parentElement;
      let panel=modal.querySelector('#divisionEditorPanel');
      if(!panel){panel=document.createElement('section');panel.id='divisionEditorPanel';panel.className='division-editor-panel';label.insertAdjacentElement('afterend',panel);}
      const active=state.multiDivision?.activeDivisionId;
      const divisions=state.multiDivision?.divisions||[];
      panel.innerHTML=`<div class="division-editor-panel-head"><div><strong>부서 구성</strong><small>각 부서의 정원·본선·구장을 별도로 설정합니다.</small></div><button type="button" class="btn btn-primary btn-small" data-open-division-manager>전체 부서 관리</button></div><div class="division-editor-list">${divisions.map((d,i)=>{const snap=divisionSnapshotSettings(d),ps=snap.prelim?.settings||{},settings=snap.settings||{},venues=Array.isArray(settings.venues)?settings.venues:[];return `<article class="division-editor-item ${d.id===active?'active':''}"><div><span>${d.id===active?'현재 운영':`부서 ${i+1}`}</span><strong>${escapeHtml(d.name)}</strong><small>정원 ${Number(snap.divisionConfig?.capacity||ps.activeTeamCount||96)}팀 · 본선 ${Number(settings.drawSize||64)}강 · ${venues.map(v=>escapeHtml(v.name)).join(' · ')||'구장 미설정'}</small></div><div><button type="button" class="btn btn-light btn-small" data-division-switch="${escapeHtml(d.id)}">운영</button><button type="button" class="btn btn-light btn-small" data-division-settings="${escapeHtml(d.id)}">설정</button></div></article>`;}).join('')}</div><div class="division-editor-add"><input type="text" data-inline-division-name placeholder="새 부서명"><button type="button" class="btn btn-primary btn-small" data-inline-division-add>부서 추가</button></div>`;
      const cap=label.querySelector('span');if(cap)cap.textContent='현재 운영 부서명';
    }catch(err){console.error('[230MATCH] 부서 편집 패널 갱신 실패',err);}
  }
  window.refreshDivisionEditorPanel=safeRefreshDivisionEditor;
  try{refreshDivisionEditorPanel=safeRefreshDivisionEditor;}catch(_e){}

  function closeDivisionSettings(){
    const d=document.getElementById('divisionSettingsModal');
    if(!d)return;
    if(d.contains(document.activeElement))document.activeElement.blur();
    if(d.tagName==='DIALOG'&&d.open)d.close();else d.hidden=true;
  }
  ensureDivisionSettingsModal=function(){
    let old=document.getElementById('divisionSettingsModal');
    if(old&&old.tagName!=='DIALOG'){old.remove();old=null;}
    if(old)return old;
    const d=document.createElement('dialog');
    d.id='divisionSettingsModal';d.className='modal division-settings-dialog';
    d.innerHTML=`<div class="modal-card division-settings-card"><div class="modal-head"><div><small>DIVISION SETTINGS</small><h2>부서별 운영 설정</h2><p>이 부서의 참가 정원·예선·본선·구장을 별도로 설정합니다.</p></div><button type="button" class="modal-close" data-division-settings-close>×</button></div><form id="divisionSettingsForm"><input type="hidden" id="divisionSettingsId"><div class="division-settings-grid"><label>부서명<input id="divisionSettingsName" required></label><label>참가 정원<input id="divisionSettingsCapacity" type="number" min="1" required></label><label>본선 규모<select id="divisionSettingsDrawSize"><option value="32">32강</option><option value="64">64강</option><option value="128">128강</option></select></label><label>조당 본선 진출팀<input id="divisionSettingsQualifiers" type="number" min="1" max="3"></label><label>2팀조 수<input id="divisionSettingsTwoGroups" type="number" min="0"></label><label>경기시간(분)<input id="divisionSettingsMinutes" type="number" min="10"></label></div><label class="division-venue-label">구장 설정 <small>한 줄에 구장명|코트수|예선|본선 형식</small><textarea id="divisionSettingsVenues" rows="6" placeholder="국제|8|예선|본선\n원도심|4|예선|본선"></textarea></label><div class="division-settings-actions"><button type="button" class="btn btn-light" data-division-settings-close>취소</button><button type="submit" class="btn btn-primary">이 부서 설정 저장</button></div><p id="divisionSettingsMessage" class="division-settings-message"></p></form></div>`;
    document.body.appendChild(d);
    d.addEventListener('cancel',e=>{e.preventDefault();closeDivisionSettings();});
    d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-division-settings-close]'))closeDivisionSettings();});
    d.querySelector('#divisionSettingsForm').addEventListener('submit',e=>{e.preventDefault();saveDivisionSettingsFromModal(e);});
    return d;
  };
  openDivisionSettings=function(id){
    if(!requireAdmin('부서 설정'))return;
    ensureMultiDivisionRuntime();
    const record=state.multiDivision?.divisions?.find(d=>d.id===id);if(!record)return;
    closeDivisionManager();
    const d=ensureDivisionSettingsModal();
    const snap=divisionSnapshotSettings(record),ps=snap.prelim?.settings||{},settings=snap.settings||{};
    q('#divisionSettingsId',d).value=record.id;
    q('#divisionSettingsName',d).value=record.name||'';
    q('#divisionSettingsCapacity',d).value=Number(snap.divisionConfig?.capacity||ps.activeTeamCount||96);
    q('#divisionSettingsDrawSize',d).value=String(settings.drawSize||64);
    q('#divisionSettingsQualifiers',d).value=Number(ps.qualifiersPerGroup||2);
    q('#divisionSettingsTwoGroups',d).value=Number(ps.twoTeamGroups||ps.twoTeamGroupCount||0);
    q('#divisionSettingsMinutes',d).value=Number(settings.matchMinutes||40);
    q('#divisionSettingsVenues',d).value=venueLinesFromSnapshot(record);
    q('#divisionSettingsMessage',d).textContent='';
    if(!d.open)d.showModal();
    setTimeout(()=>q('#divisionSettingsName',d)?.focus(),30);
  };

  const originalSaveDivisionSettings=saveDivisionSettingsFromModal;
  saveDivisionSettingsFromModal=function(e){
    originalSaveDivisionSettings(e);
    const d=document.getElementById('divisionSettingsModal');
    if(d?.open)d.close();
    renderDivisionManagerList();safeRefreshDivisionEditor();renderDivisionWorkspaceBar();
  };

  function ensureWizardDivisionEditor(){
    const input=wizardEl('wizardTournamentDivision');if(!input)return;
    const label=input.closest('label');if(!label)return;
    input.hidden=true;
    const hint=label.querySelector('span');if(hint)hint.innerHTML='부서 구성 * <small>부서마다 정원·본선·구장을 따로 설정합니다.</small>';
    let host=document.getElementById('wizardDivisionEditor');
    if(!host){host=document.createElement('section');host.id='wizardDivisionEditor';host.className='wizard-division-editor';label.insertAdjacentElement('afterend',host);}
    renderWizardDivisionEditor();
  }
  function defaultDivisionDraft(name='부경신인부'){
    return {id:newDivisionId(),name,capacity:Number(state.prelim?.settings?.activeTeamCount||96),drawSize:Number(state.settings?.drawSize||64),qualifiers:Number(state.prelim?.settings?.qualifiersPerGroup||2),twoTeamGroups:Number(state.prelim?.settings?.twoTeamGroups||state.prelim?.settings?.twoTeamGroupCount||0),matchMinutes:Number(state.settings?.matchMinutes||40),venues:divisionClone((state.settings?.venues||[]).map(normalizeDivisionVenue))};
  }
  function renderWizardDivisionEditor(){
    const host=document.getElementById('wizardDivisionEditor');if(!host)return;
    host.innerHTML=`<div class="wizard-division-head"><strong>부서별 설정</strong><button type="button" class="btn btn-light btn-small" data-wizard-add-division>+ 부서 추가</button></div><div class="wizard-division-list">${wizardDivisionDrafts.map((d,i)=>`<article class="wizard-division-card" data-wizard-division-id="${d.id}"><div class="wizard-division-card-head"><strong>부서 ${i+1}</strong><button type="button" class="btn btn-danger-outline btn-small" data-wizard-remove-division="${d.id}" ${wizardDivisionDrafts.length===1?'disabled':''}>삭제</button></div><div class="wizard-division-grid"><label>부서명<input data-wd-field="name" value="${escapeHtml(d.name)}"></label><label>참가 정원<input type="number" min="1" data-wd-field="capacity" value="${d.capacity}"></label><label>본선 규모<select data-wd-field="drawSize"><option value="32" ${d.drawSize===32?'selected':''}>32강</option><option value="64" ${d.drawSize===64?'selected':''}>64강</option><option value="128" ${d.drawSize===128?'selected':''}>128강</option></select></label><label>조당 진출팀<input type="number" min="1" max="3" data-wd-field="qualifiers" value="${d.qualifiers}"></label><label>2팀조 수<input type="number" min="0" data-wd-field="twoTeamGroups" value="${d.twoTeamGroups}"></label><label>경기시간(분)<input type="number" min="10" data-wd-field="matchMinutes" value="${d.matchMinutes}"></label></div>${divisionVenueCardsHtml(d.venues||[],`wizard-${d.id}`)}</article>`).join('')}</div>`;
  }
  function syncWizardDivisionDrafts(){
    qa('.wizard-division-card',document).forEach(card=>{const d=wizardDivisionDrafts.find(x=>x.id===card.dataset.wizardDivisionId);if(!d)return;qa('[data-wd-field]',card).forEach(el=>{const k=el.dataset.wdField;d[k]=['capacity','drawSize','qualifiers','twoTeamGroups','matchMinutes'].includes(k)?Number(el.value||0):el.value;});const builder=card.querySelector('.division-venue-builder');if(builder)d.venues=readDivisionVenueBuilder(builder);});
    const names=wizardDivisionDrafts.map(d=>d.name.trim()).filter(Boolean);const input=wizardEl('wizardTournamentDivision');if(input)input.value=names.join(', ');
  }
  const oldOpenWizard=openNewTournamentWizard;
  openNewTournamentWizard=function(){
    oldOpenWizard();
    wizardDivisionDrafts=[defaultDivisionDraft('부경신인부')];
    ensureWizardDivisionEditor();
  };
  const oldValidateWizardStep=validateWizardStep;
  validateWizardStep=function(step){
    if(step===1){syncWizardDivisionDrafts();if(!wizardDivisionDrafts.length||wizardDivisionDrafts.some(d=>!String(d.name||'').trim())){setWizardMessage('모든 부서명을 입력하세요.','error');return false;}const names=wizardDivisionDrafts.map(d=>d.name.trim());if(new Set(names).size!==names.length){setWizardMessage('같은 부서명이 중복되어 있습니다.','error');return false;}}
    return oldValidateWizardStep(step);
  };
  const oldWizardSummaryHtml=wizardSummaryHtml;
  wizardSummaryHtml=function(){
    syncWizardDivisionDrafts();
    const base=oldWizardSummaryHtml();
    const division=`<article class="wizard-summary-wide"><span>부서별 설정</span><strong>${wizardDivisionDrafts.map(d=>`${escapeHtml(d.name)} · 정원 ${d.capacity}팀 · 본선 ${d.drawSize}강`).join('<br>')}</strong></article>`;
    return base+division;
  };

  async function createTournamentFromWizard3433(){
    syncWizardDivisionDrafts();
    if(!validateWizardStep(1))return;
    if(!wizardEl('wizardConfirmChecked')?.checked){setWizardMessage('최종 확인 항목에 체크하세요.','error');return;}
    const first=wizardDivisionDrafts[0];
    const map={newTournamentName:'wizardTournamentName',newTournamentDivision:'wizardTournamentDivision',newTournamentDate:'wizardTournamentDate',newTournamentVenue:'wizardTournamentVenue',newTournamentCapacity:'wizardTournamentCapacity',newTournamentTemplate:'wizardTemplate'};
    Object.entries(map).forEach(([dst,src])=>{const d=wizardEl(dst),s=wizardEl(src);if(d&&s)d.value=dst==='newTournamentDivision'?first.name:dst==='newTournamentCapacity'?first.capacity:s.value;});
    if(wizardEl('copyTournamentGuide'))wizardEl('copyTournamentGuide').checked=wizardEl('wizardCopyGuide').checked;
    if(wizardEl('copyTournamentPosts'))wizardEl('copyTournamentPosts').checked=wizardEl('wizardCopyPosts').checked;
    if(wizardEl('copyTournamentTeams'))wizardEl('copyTournamentTeams').checked=wizardEl('wizardCopyTeams').checked;
    setWizardMessage('부서별 설정을 포함해 새 대회를 생성하고 있습니다.');
    try{
      const ok=await createNewTournamentFromManager({skipPrompt:true,uploadCloud:false});if(!ok)return;
      initializeTournamentDivisions(wizardDivisionDrafts.map(d=>d.name));
      for(const draft of wizardDivisionDrafts){
        const record=state.multiDivision.divisions.find(r=>r.name===draft.name);if(!record)continue;
        const snap=divisionSnapshotSettings(record);
        snap.divisionConfig={...(snap.divisionConfig||{}),capacity:draft.capacity};
        snap.prelim=snap.prelim||{};snap.prelim.settings={...(snap.prelim.settings||{}),activeTeamCount:draft.capacity,qualifiersPerGroup:draft.qualifiers,twoTeamGroups:draft.twoTeamGroups,twoTeamGroupCount:draft.twoTeamGroups};
        snap.settings={...(snap.settings||{}),drawSize:draft.drawSize,matchMinutes:draft.matchMinutes,venues:divisionClone((draft.venues||[]).map(normalizeDivisionVenue))};
        record.snapshot=snap;
      }
      const active=state.multiDivision.divisions[0];applyDivisionSnapshot(active);state.tournament.capacity=first.capacity;
      saveState(state);renderDivisionWorkspaceBar();safeRefreshDivisionEditor();
      try{await pushStateNow(state);}catch(error){throw new Error(`새 대회 서버 저장 실패: ${error?.message||error}`);}
      setWizardMessage('부서별 새 대회 생성이 완료되었습니다.','success');setTimeout(()=>{closeNewTournamentWizard();navigatePortalView('tournaments',{pushHistory:true});},500);
    }catch(error){setWizardMessage(`생성 실패: ${error?.message||error}`,'error');}
  }
  function replaceWizardCreateButton(){
    const old=wizardEl('wizardCreateBtn');if(!old||old.dataset.v3433Bound)return;
    const clone=old.cloneNode(true);clone.dataset.v3433Bound='1';old.replaceWith(clone);clone.addEventListener('click',createTournamentFromWizard3433);
  }

  document.addEventListener('click',e=>{
    const add=e.target.closest('[data-wizard-add-division]');if(add){syncWizardDivisionDrafts();wizardDivisionDrafts.push(defaultDivisionDraft(`새 부서 ${wizardDivisionDrafts.length+1}`));renderWizardDivisionEditor();return;}
    const remove=e.target.closest('[data-wizard-remove-division]');if(remove){syncWizardDivisionDrafts();wizardDivisionDrafts=wizardDivisionDrafts.filter(d=>d.id!==remove.dataset.wizardRemoveDivision);renderWizardDivisionEditor();return;}
    const go=e.target.closest('[data-division-switch]');if(go&&e.target.closest('#divisionManagerModal')){e.preventDefault();e.stopImmediatePropagation();const id=go.dataset.divisionSwitch;closeDivisionManager();switchDivisionWorkspace(id);safeRefreshDivisionEditor();return;}
    const settings=e.target.closest('[data-division-settings]');if(settings){e.preventDefault();e.stopImmediatePropagation();openDivisionSettings(settings.dataset.divisionSettings);return;}
  },true);
  document.addEventListener('input',e=>{if(e.target.closest('#wizardDivisionEditor'))syncWizardDivisionDrafts();});

  document.addEventListener('click',e=>{
    const addVenueBtn=e.target.closest('[data-add-division-venue]');
    if(addVenueBtn){const builder=addVenueBtn.closest('.division-venue-builder');const list=builder?.querySelector('.division-venue-card-list');if(!list)return;const i=list.children.length;const wrap=document.createElement('div');wrap.innerHTML=divisionVenueCardHtml(normalizeDivisionVenue({name:`새 구장 ${i+1}`,courtMax:8,courtNumbers:[1],usePrelim:true,useMain:true},i),i);list.appendChild(wrap.firstElementChild);return;}
    const removeVenueBtn=e.target.closest('[data-remove-division-venue]');
    if(removeVenueBtn){const list=removeVenueBtn.closest('.division-venue-card-list');if(list?.children.length<=1){notice('구장은 한 곳 이상 필요합니다.','warning');return;}removeVenueBtn.closest('.division-venue-card')?.remove();return;}
    const all=e.target.closest('[data-select-all-courts]');if(all){all.closest('.division-venue-card')?.querySelectorAll('[data-court-no]').forEach(x=>x.checked=true);return;}
    const clear=e.target.closest('[data-clear-all-courts]');if(clear){clear.closest('.division-venue-card')?.querySelectorAll('[data-court-no]').forEach(x=>x.checked=false);return;}
  },true);
  document.addEventListener('change',e=>{if(e.target.matches('[data-dv-field="courtMax"]'))rerenderDivisionVenueCard(e.target.closest('.division-venue-card'));},true);

  const oldRenderWizard=renderNewTournamentWizard;
  renderNewTournamentWizard=function(){oldRenderWizard();ensureWizardDivisionEditor();replaceWizardCreateButton();};

  // 61.1.1: avoid observing every DOM mutation; wizard/division events call these refreshers directly.
  safeRefreshDivisionEditor();replaceWizardCreateButton();
  const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 34.3.5 · 부서별 구장·코트 선택 개선본';label.title='Version 34.3.5';}
  document.documentElement.dataset.build='3435';
  console.info('[230MATCH V3] 34.3.5 ready · division venue/court picker active');
})();

/* Stage 34.3.6 · real division editor + venue picker final override */
(function(){
  const esc = (v)=> typeof escapeHtml==='function' ? escapeHtml(String(v??'')) : String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const getDivisions=()=>{ try{ ensureMultiDivisionRuntime(); }catch(_e){} return state.multiDivision?.divisions||[]; };
  const getRecord=(id)=>getDivisions().find(d=>d.id===id);
  function closeDivisionSettingsFinal(){
    const d=document.getElementById('divisionSettingsModal');
    if(!d)return;
    if(d.contains(document.activeElement))document.activeElement.blur();
    if(d.open)d.close();
  }
  function ensureDivisionSettingsFinal(){
    document.getElementById('divisionSettingsModal')?.remove();
    const d=document.createElement('dialog');
    d.id='divisionSettingsModal';
    d.className='modal division-settings-dialog division-settings-final';
    d.innerHTML=`<div class="modal-card division-settings-card"><div class="modal-head"><div><small>DIVISION SETTINGS</small><h2>부서별 운영 설정</h2><p>이 부서의 참가 정원·예선·본선·구장과 실제 사용 코트를 별도로 설정합니다.</p></div><button type="button" class="modal-close" data-division-settings-close>×</button></div><form id="divisionSettingsForm"><input type="hidden" id="divisionSettingsId"><div class="division-settings-grid"><label>부서명<input id="divisionSettingsName" required></label><label>참가 정원<input id="divisionSettingsCapacity" type="number" min="1" required></label><label>본선 규모<select id="divisionSettingsDrawSize"><option value="32">32강</option><option value="64">64강</option><option value="128">128강</option></select></label><label>조당 본선 진출팀<input id="divisionSettingsQualifiers" type="number" min="1" max="3"></label><label>2팀조 수<input id="divisionSettingsTwoGroups" type="number" min="0"></label><label>경기시간(분)<input id="divisionSettingsMinutes" type="number" min="10"></label></div><div id="divisionSettingsVenueBuilder"></div><div class="division-settings-actions"><button type="button" class="btn btn-light" data-division-settings-close>취소</button><button type="submit" class="btn btn-primary">이 부서 설정 저장</button></div><p id="divisionSettingsMessage" class="division-settings-message"></p></form></div>`;
    document.body.appendChild(d);
    d.addEventListener('cancel',e=>{e.preventDefault();closeDivisionSettingsFinal();});
    d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-division-settings-close]'))closeDivisionSettingsFinal();});
    d.querySelector('#divisionSettingsForm').addEventListener('submit',saveDivisionSettingsFinal);
    return d;
  }
  function openDivisionSettingsFinal(id){
    if(typeof requireAdmin==='function'&&!requireAdmin('부서 설정'))return;
    const record=getRecord(id); if(!record)return;
    try{ closeDivisionManager(); }catch(_e){}
    const snap=divisionSnapshotSettings(record), ps=snap.prelim?.settings||{}, settings=snap.settings||{};
    const d=ensureDivisionSettingsFinal();
    d.querySelector('#divisionSettingsId').value=record.id;
    d.querySelector('#divisionSettingsName').value=record.name||'';
    d.querySelector('#divisionSettingsCapacity').value=Number(snap.divisionConfig?.capacity||ps.activeTeamCount||96);
    d.querySelector('#divisionSettingsDrawSize').value=String(settings.drawSize||64);
    d.querySelector('#divisionSettingsQualifiers').value=Number(ps.qualifiersPerGroup||2);
    d.querySelector('#divisionSettingsTwoGroups').value=Number(ps.twoTeamGroups||ps.twoTeamGroupCount||0);
    d.querySelector('#divisionSettingsMinutes').value=Number(settings.matchMinutes||40);
    d.querySelector('#divisionSettingsVenueBuilder').innerHTML=divisionVenueCardsHtml(settings.venues||[],`settings-${record.id}`);
    d.querySelector('#divisionSettingsMessage').textContent='';
    d.showModal();
  }
  function saveDivisionSettingsFinal(e){
    e.preventDefault();
    const d=document.getElementById('divisionSettingsModal');
    const id=d?.querySelector('#divisionSettingsId')?.value; const record=getRecord(id); if(!record)return;
    const name=String(d.querySelector('#divisionSettingsName')?.value||'').trim();
    const capacity=Math.max(1,Number(d.querySelector('#divisionSettingsCapacity')?.value||96));
    const drawSize=Math.max(2,Number(d.querySelector('#divisionSettingsDrawSize')?.value||64));
    const qualifiers=Math.max(1,Number(d.querySelector('#divisionSettingsQualifiers')?.value||2));
    const twoGroups=Math.max(0,Number(d.querySelector('#divisionSettingsTwoGroups')?.value||0));
    const matchMinutes=Math.max(10,Number(d.querySelector('#divisionSettingsMinutes')?.value||40));
    const builder=d.querySelector('#divisionSettingsVenueBuilder .division-venue-builder');
    const venues=builder?readDivisionVenueBuilder(builder):[];
    const msg=d.querySelector('#divisionSettingsMessage');
    if(!name){msg.textContent='부서명을 입력하세요.';return;}
    if(getDivisions().some(x=>x.id!==id&&x.name===name)){msg.textContent='같은 이름의 부서가 이미 있습니다.';return;}
    if(!venues.length){msg.textContent='구장을 한 곳 이상 추가하세요.';return;}
    if(venues.some(v=>!v.courtNumbers?.length)){msg.textContent='각 구장에서 사용할 코트를 한 면 이상 선택하세요.';return;}
    if(!venues.some(v=>v.usePrelim)){msg.textContent='예선 사용 구장을 한 곳 이상 지정하세요.';return;}
    if(!venues.some(v=>v.useMain)){msg.textContent='본선 사용 구장을 한 곳 이상 지정하세요.';return;}
    const snap=divisionSnapshotSettings(record);
    record.name=name;record.updatedAt=new Date().toISOString();
    snap.divisionConfig={...(snap.divisionConfig||{}),capacity};
    snap.prelim=snap.prelim||{};snap.prelim.settings={...(snap.prelim.settings||{}),activeTeamCount:capacity,qualifiersPerGroup:qualifiers,twoTeamGroups:twoGroups,twoTeamGroupCount:twoGroups};
    snap.settings={...(snap.settings||{}),drawSize,matchMinutes,venues:structuredClone(venues)};
    snap.portal=snap.portal||{};snap.portal.guide={...(snap.portal.guide||{}),venue:venues.map(v=>v.name).join(' · ')};
    record.snapshot=snap;
    if(id===state.multiDivision?.activeDivisionId){
      state.tournament={...(state.tournament||{}),division:name,capacity};
      state.prelim=state.prelim||{};state.prelim.settings={...(state.prelim.settings||{}),activeTeamCount:capacity,qualifiersPerGroup:qualifiers,twoTeamGroups:twoGroups,twoTeamGroupCount:twoGroups};
      state.settings={...(state.settings||{}),drawSize,matchMinutes,venues:structuredClone(venues)};
      try{ensureVenueSettings(state);ensureVenueQueues(state);}catch(_e){}
    }
    saveState(state);closeDivisionSettingsFinal();
    try{renderDivisionManagerList();renderDivisionWorkspaceBar();}catch(_e){}
    renderTournamentDivisionSection();
    notice(`${name} 부서 설정을 저장했습니다.`,'success');
  }
  window.openDivisionSettings=openDivisionSettingsFinal;
  try{openDivisionSettings=openDivisionSettingsFinal;}catch(_e){}
  window.ensureDivisionSettingsModal=ensureDivisionSettingsFinal;
  try{ensureDivisionSettingsModal=ensureDivisionSettingsFinal;}catch(_e){}

  function divisionSummary(record){
    const snap=divisionSnapshotSettings(record), ps=snap.prelim?.settings||{}, s=snap.settings||{};
    const venues=(s.venues||[]).map(v=>{const nv=normalizeDivisionVenue(v);return `${esc(nv.name)} ${nv.courtNumbers.join('·')}번`;}).join(' / ')||'구장 미설정';
    return `정원 ${Number(snap.divisionConfig?.capacity||ps.activeTeamCount||96)}팀 · 본선 ${Number(s.drawSize||64)}강 · ${venues}`;
  }
  function renderTournamentDivisionSection(){
    const dialog=document.getElementById('stage3210TournamentEditDialog'); if(!dialog)return;
    const form=dialog.querySelector('#stage3210TournamentEditForm');if(!form)return;
    const sections=[...form.querySelectorAll('.stage3210-section')]; if(!sections.length)return;
    // Hide legacy single-division controls and legacy shared venue editor.
    ['stage329Division','stage329Capacity','stage329DrawSize','stage329Qualifiers','stage329TwoTeamGroups'].forEach(id=>{const el=dialog.querySelector('#'+id);const label=el?.closest('label');if(label)label.hidden=true;});
    if(sections[1])sections[1].hidden=true;
    let panel=dialog.querySelector('#stage3436DivisionSection');
    if(!panel){panel=document.createElement('section');panel.id='stage3436DivisionSection';panel.className='stage3210-section stage3436-division-section';sections[0].insertAdjacentElement('afterend',panel);}
    const active=state.multiDivision?.activeDivisionId;
    panel.innerHTML=`<div class="stage3210-section-head"><div><h3>② 부서별 운영 설정</h3><p>각 부서의 정원·본선 규모·구장·실제 사용 코트를 별도로 설정합니다.</p></div><button type="button" class="btn btn-primary" data-open-division-manager>부서 추가·관리</button></div><div class="stage3436-division-list">${getDivisions().map((r,i)=>`<article class="stage3436-division-card ${r.id===active?'active':''}"><div><span>${r.id===active?'현재 운영':`부서 ${i+1}`}</span><strong>${esc(r.name)}</strong><small>${divisionSummary(r)}</small></div><div><button type="button" class="btn btn-light btn-small" data-division-switch="${esc(r.id)}">운영 전환</button><button type="button" class="btn btn-primary btn-small" data-division-settings="${esc(r.id)}">설정 편집</button></div></article>`).join('')}</div>`;
    if(sections[2]){const h=sections[2].querySelector('h3');if(h)h.textContent='③ 접수·요강 정보';}
    bindSharedTournamentSave(form,dialog);
  }
  function bindSharedTournamentSave(form,dialog){
    if(form.dataset.stage3436SaveBound)return;
    form.dataset.stage3436SaveBound='1';
    form.addEventListener('submit',async e=>{
      e.preventDefault();e.stopImmediatePropagation();
      if(typeof requireAdmin==='function'&&!requireAdmin('현재 대회 설정 편집'))return;
      const val=id=>String(dialog.querySelector('#'+id)?.value||'').trim();
      const msg=dialog.querySelector('#stage329EditMessage'); const name=val('stage329Name');
      if(!name){msg.textContent='대회명을 입력하세요.';msg.className='stage329-edit-message error';return;}
      try{
        const recovery=saveRecovery(state,`${state.tournament?.name||'현재 대회'} · 대회 공통정보 변경 전`);if(recovery?.ready)await recovery.ready;
        state.tournament={...(state.tournament||{}),name};
        state.portal=state.portal||{};state.portal.guide={...(state.portal.guide||{}),date:val('stage329Date'),startTime:val('stage329StartTime'),venue:val('stage329Venue'),fee:val('stage329Fee'),bank:val('stage329Bank'),account:val('stage329Account'),organizer:val('stage329Organizer'),host:val('stage329Organizer'),entryStart:val('stage329EntryStart'),entryEnd:val('stage329EntryEnd'),registrationStart:val('stage329EntryStart'),registrationEnd:val('stage329EntryEnd'),eligibility:val('stage329Eligibility'),format:val('stage329Format'),matchFormat:val('stage329Format'),awards:val('stage329Awards'),refund:val('stage329Refund'),refundPolicy:val('stage329Refund'),contact:val('stage329Contact'),detail:val('stage329Detail')};
        saveState(state);dialog.close();renderPortalViews();renderTournamentList();notice('대회 공통정보를 저장했습니다. 부서별 설정은 각 부서 설정에 그대로 유지됩니다.','success');
      }catch(err){msg.textContent=`저장 실패: ${err?.message||err}`;msg.className='stage329-edit-message error';}
    },true);
  }
  const oldOpen=stage3210OpenTournamentEdit;
  stage3210OpenTournamentEdit=function(){oldOpen();setTimeout(renderTournamentDivisionSection,0);};
  stage329OpenTournamentEdit=stage3210OpenTournamentEdit;

  document.addEventListener('click',e=>{
    const settings=e.target.closest('[data-division-settings]');
    if(settings){e.preventDefault();e.stopImmediatePropagation();openDivisionSettingsFinal(settings.dataset.divisionSettings);return;}
    const sw=e.target.closest('#stage3436DivisionSection [data-division-switch]');
    if(sw){e.preventDefault();e.stopImmediatePropagation();switchDivisionWorkspace(sw.dataset.divisionSwitch);renderTournamentDivisionSection();return;}
  },true);

  const style=document.createElement('style');style.id='stage3436Styles';style.textContent=`
  .division-settings-final{z-index:100000!important;max-width:min(980px,96vw);max-height:92vh;padding:0;border:0;background:transparent}.division-settings-final::backdrop{background:rgba(8,25,52,.62)}
  .division-settings-final .modal-card{max-height:92vh;overflow:auto}.stage3436-division-list{display:grid;gap:10px}.stage3436-division-card{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:14px;border:1px solid #d7e2f2;border-radius:14px;background:#fff}.stage3436-division-card.active{border-color:#1d4f91;background:#f2f7ff}.stage3436-division-card>div:first-child{display:grid;gap:4px}.stage3436-division-card span{font-size:12px;color:#1d4f91}.stage3436-division-card small{color:#5d6f89}.stage3436-division-card>div:last-child{display:flex;gap:8px;flex-wrap:wrap}.division-venue-builder{margin-top:16px}.division-venue-builder-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px}.division-venue-card-list{display:grid;gap:12px}.division-venue-card{border:1px solid #d7e2f2;border-radius:14px;padding:14px;background:#f8fbff}.division-venue-card-head,.division-court-picker-head{display:flex;justify-content:space-between;align-items:center;gap:8px}.division-venue-fields{display:grid;grid-template-columns:1fr 1fr 150px;gap:10px;margin-top:10px}.division-venue-scope{display:flex;gap:18px;margin:12px 0}.division-court-checks{display:grid;grid-template-columns:repeat(8,minmax(54px,1fr));gap:7px;margin-top:9px}.division-court-chip{display:flex;align-items:center;gap:5px;border:1px solid #d7e2f2;border-radius:9px;padding:7px;background:white}.division-court-summary{display:block;margin-top:8px;color:#5d6f89}@media(max-width:720px){.stage3436-division-card{align-items:flex-start;flex-direction:column}.division-venue-fields{grid-template-columns:1fr}.division-court-checks{grid-template-columns:repeat(4,1fr)}}`;
  document.head.appendChild(style);
  const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 34.3.6 · 대회 편집 다부서·코트 선택 실제 적용본';label.title='Version 34.3.6';}
  document.documentElement.dataset.build='3436';
  console.info('[230MATCH V3] 34.3.6 ready · tournament editor division picker active');
})();

/* Stage 60.0.1 · unified tournament editor with explicit cloud save */
(function stage6001UnifiedTournamentEditor(){
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clone=v=>{try{return structuredClone(v)}catch(_e){return JSON.parse(JSON.stringify(v))}};
  const now=()=>new Date().toISOString();
  let draft=null;
  let selectedId='';
  let dirty=false;
  let saving=false;

  function divisions(){return Array.isArray(draft?.divisions)?draft.divisions:[];}
  function record(id){return divisions().find(d=>String(d.id)===String(id));}
  function baseSnapshot(){
    const active=(state.multiDivision?.divisions||[]).find(d=>String(d.id)===String(state.multiDivision?.activeDivisionId))||(state.multiDivision?.divisions||[])[0];
    const snap=active?divisionSnapshotSettings(active):{
      divisionConfig:{capacity:Number(state.tournament?.capacity||96)},
      prelim:clone(state.prelim||{settings:{},groups:[],matches:[],standings:[]}),
      settings:clone(state.settings||{}),teams:[],entryRecords:[],draw:{rounds:{}},courts:[],queues:{},messages:[]
    };
    return clone(snap);
  }
  function normalizeVenue(v,i=0){
    const n=typeof normalizeDivisionVenue==='function'?normalizeDivisionVenue(v||{},i):(v||{});
    const max=Math.max(1,Math.min(30,Number(n.courtMax||8)));
    const nums=(Array.isArray(n.courtNumbers)?n.courtNumbers:[]).map(Number).filter(x=>x>=1&&x<=max);
    return {name:String(n.name||`구장 ${i+1}`).trim()||`구장 ${i+1}`,courtMax:max,courtNumbers:[...new Set(nums)].sort((a,b)=>a-b),usePrelim:n.usePrelim!==false,useMain:n.useMain!==false};
  }
  function snapshotValues(rec){
    const snap=rec?.snapshot||{};const ps=snap.prelim?.settings||{};const settings=snap.settings||{};
    return {
      name:String(rec?.name||''),capacity:Math.max(1,Number(snap.divisionConfig?.capacity||ps.activeTeamCount||96)),
      drawSize:Number(settings.drawSize||64),qualifiers:Math.max(1,Number(ps.qualifiersPerGroup||2)),
      twoGroups:Math.max(0,Number(ps.twoTeamGroups||ps.twoTeamGroupCount||0)),minutes:Math.max(10,Number(settings.matchMinutes||40)),
      venues:(Array.isArray(settings.venues)&&settings.venues.length?settings.venues:[{name:'국제',courtMax:8,courtNumbers:[1,2,3,4,5,6,7,8],usePrelim:true,useMain:true}]).map(normalizeVenue)
    };
  }
  function makeDraft(){
    try{ensureMultiDivisionRuntime();}catch(_e){}
    const source=Array.isArray(state.multiDivision?.divisions)?state.multiDivision.divisions:[];
    const list=source.length?clone(source):[{id:`division-${Date.now().toString(36)}`,name:state.tournament?.division||'기본 부서',createdAt:now(),updatedAt:now(),snapshot:baseSnapshot()}];
    draft={
      common:{name:String(state.tournament?.name||''),date:String(state.portal?.guide?.date||''),time:String(state.portal?.guide?.startTime||'09:00'),venue:String(state.portal?.guide?.venue||'')},
      guide:clone(state.portal?.guide||{}),
      activeDivisionId:String(state.multiDivision?.activeDivisionId||list[0]?.id||''),divisions:list
    };
    selectedId=draft.activeDivisionId||list[0]?.id||'';dirty=false;
  }
  function venueCard(v,i){
    const n=normalizeVenue(v,i);
    const checks=Array.from({length:n.courtMax},(_,k)=>k+1).map(no=>`<label class="s6001-court"><input type="checkbox" data-court-no="${no}" ${n.courtNumbers.includes(no)?'checked':''}><span>${no}번</span></label>`).join('');
    return `<article class="s6001-venue"><div class="s6001-venue-head"><strong>구장 ${i+1}</strong><button type="button" class="btn btn-danger-outline btn-small" data-s6001-remove-venue>삭제</button></div><div class="s6001-grid compact"><label>구장명<input data-vf="name" value="${esc(n.name)}"></label><label>코트 번호 범위<input data-vf="courtMax" type="number" min="1" max="30" value="${n.courtMax}"></label></div><div class="s6001-scope"><label><input type="checkbox" data-vf="usePrelim" ${n.usePrelim?'checked':''}> 예선 사용</label><label><input type="checkbox" data-vf="useMain" ${n.useMain?'checked':''}> 본선 사용</label></div><div class="s6001-courts">${checks}</div></article>`;
  }
  function panelHtml(rec){
    const v=snapshotValues(rec);
    return `<div class="s6001-division-form" data-division-id="${esc(rec.id)}"><div class="s6001-grid"><label>부서명<input id="s6001DivName" value="${esc(v.name)}"></label><label>참가 정원<input id="s6001Capacity" type="number" min="1" value="${v.capacity}"></label><label>본선 규모<select id="s6001DrawSize"><option value="32" ${v.drawSize===32?'selected':''}>32강</option><option value="64" ${v.drawSize===64?'selected':''}>64강</option><option value="128" ${v.drawSize===128?'selected':''}>128강</option></select></label><label>조당 본선 진출팀<input id="s6001Qualifiers" type="number" min="1" max="3" value="${v.qualifiers}"></label><label>2팀조 수<input id="s6001TwoGroups" type="number" min="0" value="${v.twoGroups}"></label><label>경기시간(분)<input id="s6001Minutes" type="number" min="10" value="${v.minutes}"></label></div><div class="s6001-venue-title"><div><h4>구장·사용 코트</h4><p>실제로 사용할 코트 번호만 체크합니다.</p></div><button type="button" class="btn btn-light" data-s6001-add-venue>+ 구장 추가</button></div><div id="s6001VenueList">${v.venues.map(venueCard).join('')}</div><div class="s6001-local-actions"><button type="button" class="btn btn-danger-outline" data-s6001-delete-division ${divisions().length<=1?'disabled':''}>부서 삭제</button><button type="button" class="btn btn-light" data-s6001-apply-division>이 부서 변경 적용</button></div><p id="s6001DivisionMessage" class="s6001-message"></p></div>`;
  }
  function ensureDialog(){
    document.getElementById('stage6001TournamentEditor')?.remove();
    const d=document.createElement('dialog');d.id='stage6001TournamentEditor';d.className='s6001-dialog';
    d.innerHTML=`<div class="s6001-shell"><header><div><small>TOURNAMENT EDITOR</small><h2>대회 편집</h2><p>대회 정보·요강·모든 부서를 한 창에서 수정하고, 마지막에 한 번만 서버에 저장합니다.</p></div><button type="button" data-s6001-close aria-label="닫기">×</button></header><div class="s6001-body"><section class="s6001-common"><h3>대회 공통정보</h3><div class="s6001-grid"><label>대회명<input id="s6001Name"></label><label>대회일<input id="s6001Date" type="date"></label><label>시작 시간<input id="s6001Time" type="time"></label><label>대표 장소 안내<input id="s6001Venue"></label></div></section><section class="s6001-guide"><div class="s6001-section-head"><div><h3>대회 요강</h3><p>홈과 대회 요강 화면에 표시되는 내용을 여기서 함께 관리합니다.</p></div><button type="button" class="btn btn-light" data-s6001-open-guide>요강 화면 미리보기</button></div><div class="s6001-grid"><label>참가비<input id="s6001GuideFee" placeholder="예: 팀당 60,000원"></label><label>접수 기간<input id="s6001GuideEntryPeriod" placeholder="예: 9월 14일(월)까지"></label><label class="s6001-wide">참가 자격<textarea id="s6001GuideEligibility" rows="3"></textarea></label><label class="s6001-wide">경기 방식<textarea id="s6001GuideMatchFormat" rows="3"></textarea></label><label class="s6001-wide">시상 내용<textarea id="s6001GuideAwards" rows="3"></textarea></label><label class="s6001-wide">환불 규정<textarea id="s6001GuideRefund" rows="3"></textarea></label><label>문의처<input id="s6001GuideContact"></label><label>주최·주관<input id="s6001GuideOrganizer"></label><label class="s6001-wide">세부 안내<textarea id="s6001GuideDetail" rows="5"></textarea></label><label class="s6001-wide">요강 이미지<input id="s6001GuideImage" type="file" accept="image/*"><small>새 이미지를 선택하면 Firebase Storage에 저장됩니다.</small></label><label class="s6001-guide-remove"><input id="s6001GuideRemoveImage" type="checkbox"> 현재 요강 이미지 제거</label><div id="s6001GuideCurrentImage" class="s6001-guide-image" hidden><span>현재 등록 이미지</span><img alt="현재 요강 이미지"></div></div></section><section class="s6001-divisions"><div class="s6001-section-head"><div><h3>부서별 설정</h3><p>부서를 추가해도 별도 투명창을 열지 않고 이 편집창 안에서 바로 설정합니다.</p></div><button type="button" class="btn btn-primary" data-s6001-add-division>+ 빈 부서 추가</button></div><div id="s6001Tabs" class="s6001-tabs"></div><div id="s6001Panel"></div></section></div><footer><div><strong id="s6001SaveState">변경사항을 확인한 뒤 저장하세요.</strong><span id="s6001SaveDetail">저장 성공 시 창이 자동으로 닫힙니다.</span></div><button type="button" class="btn btn-light" data-s6001-cancel>취소</button><button type="button" class="btn btn-primary" data-s6001-save-all>전체 변경사항 저장</button></footer></div>`;
    document.body.appendChild(d);
    d.addEventListener('cancel',e=>{e.preventDefault();requestClose();});
    d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-s6001-close],[data-s6001-cancel]'))requestClose();});
    d.addEventListener('input',()=>{dirty=true;setSaveText('수정한 내용이 아직 서버에 저장되지 않았습니다.','전체 변경사항 저장을 눌러 주세요.','pending');});
    return d;
  }
  function setSaveText(main,detail='',mode=''){
    const d=document.getElementById('stage6001TournamentEditor');if(!d)return;
    const a=d.querySelector('#s6001SaveState'),b=d.querySelector('#s6001SaveDetail');if(a)a.textContent=main;if(b)b.textContent=detail;
    d.dataset.saveMode=mode;
  }
  function renderTabs(){
    const d=document.getElementById('stage6001TournamentEditor');if(!d)return;
    if(!record(selectedId))selectedId=divisions()[0]?.id||'';
    d.querySelector('#s6001Tabs').innerHTML=divisions().map((r,i)=>`<button type="button" class="${String(r.id)===String(selectedId)?'active':''}" data-s6001-select="${esc(r.id)}"><strong>${esc(r.name||`새 부서 ${i+1}`)}</strong><small>${esc(snapshotValues(r).capacity)}팀 · ${esc(snapshotValues(r).drawSize)}강</small></button>`).join('');
    const rec=record(selectedId);d.querySelector('#s6001Panel').innerHTML=rec?panelHtml(rec):'';
  }
  function openEditor(){
    if(typeof requireAdmin==='function'&&!requireAdmin('대회 편집'))return;
    makeDraft();const d=ensureDialog();
    d.querySelector('#s6001Name').value=draft.common.name;d.querySelector('#s6001Date').value=draft.common.date;d.querySelector('#s6001Time').value=draft.common.time;d.querySelector('#s6001Venue').value=draft.common.venue;
    const g=draft.guide||{};d.querySelector('#s6001GuideFee').value=g.fee||'';d.querySelector('#s6001GuideEntryPeriod').value=g.entryPeriod||'';d.querySelector('#s6001GuideEligibility').value=g.eligibility||'';d.querySelector('#s6001GuideMatchFormat').value=g.matchFormat||'';d.querySelector('#s6001GuideAwards').value=g.awards||'';d.querySelector('#s6001GuideRefund').value=g.refundPolicy||'';d.querySelector('#s6001GuideContact').value=g.contact||'';d.querySelector('#s6001GuideOrganizer').value=g.organizer||'';d.querySelector('#s6001GuideDetail').value=g.detail||'';d.querySelector('#s6001GuideRemoveImage').checked=false;
    const imgWrap=d.querySelector('#s6001GuideCurrentImage'),img=imgWrap?.querySelector('img'),src=stage6109ImageSrc(g);if(imgWrap){imgWrap.hidden=!src;if(img&&src)img.src=src;}
    renderTabs();setSaveText('변경사항을 확인한 뒤 저장하세요.','저장 성공 시 창이 자동으로 닫힙니다.','ready');d.showModal();
  }
  function requestClose(){
    const d=document.getElementById('stage6001TournamentEditor');if(!d||saving)return;
    if(dirty&&!confirm('저장하지 않은 변경사항이 있습니다. 편집창을 닫을까요?'))return;
    d.close();
  }
  function collectPanel({showMessage=true}={}){
    const d=document.getElementById('stage6001TournamentEditor'),rec=record(selectedId);if(!d||!rec)return false;
    const root=d.querySelector('.s6001-division-form'),msg=d.querySelector('#s6001DivisionMessage');
    const name=String(d.querySelector('#s6001DivName')?.value||'').trim();
    const venues=[...root.querySelectorAll('.s6001-venue')].map((el,i)=>normalizeVenue({name:String(el.querySelector('[data-vf="name"]')?.value||`구장 ${i+1}`).trim(),courtMax:Number(el.querySelector('[data-vf="courtMax"]')?.value||8),courtNumbers:[...el.querySelectorAll('[data-court-no]:checked')].map(x=>Number(x.dataset.courtNo)),usePrelim:Boolean(el.querySelector('[data-vf="usePrelim"]')?.checked),useMain:Boolean(el.querySelector('[data-vf="useMain"]')?.checked)},i));
    const fail=text=>{if(msg)msg.textContent=text;setSaveText('입력값을 확인해 주세요.',text,'error');return false;};
    if(!name)return fail('부서명을 입력하세요.');
    if(divisions().some(x=>String(x.id)!==String(rec.id)&&String(x.name).trim()===name))return fail('같은 이름의 부서가 있습니다.');
    if(!venues.length||venues.some(v=>!v.courtNumbers.length))return fail('각 구장에서 사용할 코트를 한 면 이상 선택하세요.');
    if(!venues.some(v=>v.usePrelim)||!venues.some(v=>v.useMain))return fail('예선과 본선 사용 구장을 각각 한 곳 이상 선택하세요.');
    const snap=clone(rec.snapshot||baseSnapshot());const ps=snap.prelim?.settings||{};
    const capacity=Math.max(1,Number(d.querySelector('#s6001Capacity')?.value||96));
    const drawSize=Number(d.querySelector('#s6001DrawSize')?.value||64),qualifiers=Math.max(1,Number(d.querySelector('#s6001Qualifiers')?.value||2)),two=Math.max(0,Number(d.querySelector('#s6001TwoGroups')?.value||0)),minutes=Math.max(10,Number(d.querySelector('#s6001Minutes')?.value||40));
    rec.name=name;rec.updatedAt=now();snap.divisionConfig={...(snap.divisionConfig||{}),capacity};snap.prelim=snap.prelim||{};snap.prelim.settings={...ps,activeTeamCount:capacity,qualifiersPerGroup:qualifiers,twoTeamGroups:two,twoTeamGroupCount:two};snap.settings={...(snap.settings||{}),drawSize,matchMinutes:minutes,venues:clone(venues)};rec.snapshot=snap;
    if(msg&&showMessage)msg.textContent='이 부서 변경을 편집창에 적용했습니다. 전체 저장을 눌러 서버에 저장하세요.';
    dirty=true;renderTabs();setSaveText('변경사항이 편집창에 적용되었습니다.','전체 변경사항 저장을 눌러 서버에 저장하세요.','pending');return true;
  }
  function addDivision(){
    if(!collectPanel({showMessage:false}))return;
    const index=divisions().length+1;const id=`division-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;const snap=baseSnapshot();
    snap.teams=[];snap.entryRecords=[];snap.draw={rounds:{}};snap.prelim={...(snap.prelim||{}),groups:[],matches:[],standings:[]};snap.courts=[];snap.queues={};snap.messages=[];
    divisions().push({id,name:`새 부서 ${index}`,createdAt:now(),updatedAt:now(),snapshot:snap});selectedId=id;dirty=true;renderTabs();setSaveText('새 부서를 추가했습니다.','부서명을 수정한 뒤 전체 변경사항 저장을 눌러 주세요.','pending');
  }
  function deleteDivision(){
    if(divisions().length<=1)return;
    const rec=record(selectedId);if(!confirm(`${rec?.name||'이 부서'}를 삭제할까요?\n이 부서의 참가자와 경기 데이터도 함께 삭제됩니다.`))return;
    const idx=divisions().findIndex(x=>String(x.id)===String(selectedId));divisions().splice(idx,1);selectedId=divisions()[Math.max(0,idx-1)]?.id||divisions()[0]?.id||'';dirty=true;renderTabs();setSaveText('부서 삭제가 편집창에 반영되었습니다.','전체 변경사항 저장 전까지 서버 데이터는 변경되지 않습니다.','pending');
  }
  async function saveAll(){
    if(saving)return;if(!collectPanel({showMessage:false}))return;
    const d=document.getElementById('stage6001TournamentEditor');if(!d)return;
    const name=String(d.querySelector('#s6001Name')?.value||'').trim();if(!name){setSaveText('대회명을 입력하세요.','','error');d.querySelector('#s6001Name')?.focus();return;}
    saving=true;const saveBtn=d.querySelector('[data-s6001-save-all]'),cancel=d.querySelector('[data-s6001-cancel]');saveBtn.disabled=true;cancel.disabled=true;saveBtn.textContent='서버 저장 중…';setSaveText('대회 내용부터 안전하게 저장하고 있습니다.','이미지는 별도 저장소로 이어서 저장합니다.','saving');
    try{
      const activeId=String(state.multiDivision?.activeDivisionId||draft.activeDivisionId||divisions()[0]?.id||'');
      state.tournament={...(state.tournament||{}),name,division:record(activeId)?.name||divisions()[0]?.name||'',capacity:Number(record(activeId)?.snapshot?.divisionConfig?.capacity||state.tournament?.capacity||96)};
      state.portal=state.portal||{};const previousGuide=state.portal.guide||{};
      const removeGuideImage=Boolean(d.querySelector('#s6001GuideRemoveImage')?.checked),guideFile=d.querySelector('#s6001GuideImage')?.files?.[0];
      const textGuide={...previousGuide,date:d.querySelector('#s6001Date')?.value||'',startTime:d.querySelector('#s6001Time')?.value||'09:00',venue:d.querySelector('#s6001Venue')?.value||'',fee:String(d.querySelector('#s6001GuideFee')?.value||'').trim(),entryPeriod:String(d.querySelector('#s6001GuideEntryPeriod')?.value||'').trim(),eligibility:String(d.querySelector('#s6001GuideEligibility')?.value||'').trim(),matchFormat:String(d.querySelector('#s6001GuideMatchFormat')?.value||'').trim(),awards:String(d.querySelector('#s6001GuideAwards')?.value||'').trim(),refundPolicy:String(d.querySelector('#s6001GuideRefund')?.value||'').trim(),contact:String(d.querySelector('#s6001GuideContact')?.value||'').trim(),organizer:String(d.querySelector('#s6001GuideOrganizer')?.value||'').trim(),detail:String(d.querySelector('#s6001GuideDetail')?.value||'').trim()};
      state.portal.guide=textGuide;
      state.multiDivision={...(state.multiDivision||{}),activeDivisionId:activeId,divisions:clone(divisions())};
      const active=record(activeId)||divisions()[0];if(active){const snap=clone(active.snapshot||{});state.tournament.division=active.name;state.prelim=clone(snap.prelim||state.prelim||{});state.settings={...(state.settings||{}),...(clone(snap.settings||{}))};state.teams=clone(snap.teams||[]);state.entryRecords=clone(snap.entryRecords||[]);state.draw=clone(snap.draw||{rounds:{}});state.courts=clone(snap.courts||[]);state.queues=clone(snap.queues||{});state.messages=clone(snap.messages||[]);}
      state.updatedAt=now();saveState(state);await pushStateNow(state); // text/division settings are committed even if Storage fails later
      if(removeGuideImage){state.portal.guide={...textGuide,imageUrl:'',imageStoragePath:'',imageName:'',imageType:'',imageDataUrl:''};saveState(state);await pushStateNow(state);if(previousGuide.imageStoragePath)void deleteManagedImage(previousGuide.imageStoragePath);}
      if(guideFile){setSaveText('대회 내용 저장 완료 · 이미지 업로드 중','Firebase Storage에 요강 이미지를 저장합니다.','saving');const compressed=await stage328CompressGuideImage(guideFile),tid=String(state.tournament?.id||state.multiTournament?.activeTournamentId||'current');const uploaded=await uploadManagedImage({folder:'tournamentGuides',ownerId:tid,dataUrl:compressed.dataUrl,fileName:compressed.name,contentType:compressed.type,previousPath:previousGuide.imageStoragePath||''});state.portal.guide={...textGuide,imageUrl:uploaded.url||'',imageStoragePath:uploaded.path||'',imageName:uploaded.name||compressed.name,imageType:uploaded.type||compressed.type,imageDataUrl:''};saveState(state);await pushStateNow(state);}
      dirty=false;setSaveText('저장이 완료되었습니다.','대회·부서·요강이 서버에 반영되었습니다.','success');notice('대회 편집 내용을 저장했습니다.','success');
      try{renderDivisionWorkspaceBar();renderTournamentList();renderHomeTournamentCards?.();renderPortalViews();}catch(_e){}
      setTimeout(()=>d.close(),350);
    }catch(error){setSaveText('일부 저장에 실패했습니다.',`${error?.message||String(error)} · 텍스트/부서 내용은 이미지 업로드 전에 먼저 저장됩니다.`,'error');notice(`대회 편집: ${error?.message||error}`,'error');}
    finally{saving=false;saveBtn.disabled=false;cancel.disabled=false;saveBtn.textContent='전체 변경사항 저장';}
  }

  function installHandlers(){
    document.addEventListener('click',e=>{
      const legacy=e.target.closest?.('[data-open-division-manager],[data-division-add-blank],[data-division-add-copy]');
      if(legacy){e.preventDefault();e.stopImmediatePropagation();openEditor();return;}
      const sel=e.target.closest?.('[data-s6001-select]');if(sel){e.preventDefault();if(!collectPanel({showMessage:false}))return;selectedId=sel.dataset.s6001Select;renderTabs();return;}
      if(e.target.closest?.('[data-s6001-add-division]')){e.preventDefault();addDivision();return;}
      if(e.target.closest?.('[data-s6001-apply-division]')){e.preventDefault();collectPanel();return;}
      if(e.target.closest?.('[data-s6001-delete-division]')){e.preventDefault();deleteDivision();return;}
      if(e.target.closest?.('[data-s6001-save-all]')){e.preventDefault();saveAll();return;}
      if(e.target.closest?.('[data-s6001-open-guide]')){e.preventDefault();e.stopPropagation();const dlg=document.getElementById('stage6001TournamentEditor');if(dlg?.open)dlg.close();stage3610OpenTournamentGuide();return;}
      if(e.target.closest?.('[data-s6001-add-venue]')){e.preventDefault();const list=document.getElementById('s6001VenueList'),i=list?.children.length||0;list?.insertAdjacentHTML('beforeend',venueCard({name:`새 구장 ${i+1}`,courtMax:8,courtNumbers:[1],usePrelim:true,useMain:true},i));dirty=true;return;}
      const rm=e.target.closest?.('[data-s6001-remove-venue]');if(rm){e.preventDefault();const list=document.getElementById('s6001VenueList');if((list?.children.length||0)<=1){notice('구장은 한 곳 이상 필요합니다.','warning');return;}rm.closest('.s6001-venue')?.remove();dirty=true;return;}
    },true);
    document.addEventListener('change',e=>{
      if(!e.target.matches?.('.s6001-venue [data-vf="courtMax"]'))return;
      const card=e.target.closest('.s6001-venue'),parent=card?.parentElement;if(!card||!parent)return;
      const v={name:card.querySelector('[data-vf="name"]')?.value||'',courtMax:Number(e.target.value||8),courtNumbers:[...card.querySelectorAll('[data-court-no]:checked')].map(x=>Number(x.dataset.courtNo)),usePrelim:card.querySelector('[data-vf="usePrelim"]')?.checked,useMain:card.querySelector('[data-vf="useMain"]')?.checked};
      const idx=[...parent.children].indexOf(card);card.outerHTML=venueCard(v,idx);dirty=true;
    },true);
  }
  stage3210OpenTournamentEdit=openEditor;stage329OpenTournamentEdit=openEditor;window.stage3210OpenTournamentEdit=openEditor;window.stage329OpenTournamentEdit=openEditor;window.openDivisionManager=openEditor;
  installHandlers();
  const style=document.createElement('style');style.id='stage6001EditorCss';style.textContent=`
  .s6001-dialog{border:0;padding:0;background:#fff;width:min(1080px,96vw);max-width:96vw;max-height:94vh;border-radius:22px;box-shadow:0 24px 70px rgba(2,16,38,.35)}.s6001-dialog::backdrop{background:rgba(6,21,45,.72);backdrop-filter:blur(2px)}.s6001-shell{background:#fff;border-radius:22px;overflow:hidden;max-height:94vh;display:grid;grid-template-rows:auto minmax(0,1fr) auto}.s6001-shell>header{background:#123462;color:#fff;padding:20px 24px;display:flex;justify-content:space-between;gap:16px}.s6001-shell>header h2{margin:3px 0 6px}.s6001-shell>header p{margin:0;color:#d9e6f7}.s6001-shell>header button{width:42px;height:42px;border:0;border-radius:12px;font-size:24px;background:#fff;color:#102d57}.s6001-body{padding:20px;overflow:auto;display:grid;gap:16px;background:#f7f9fc}.s6001-common,.s6001-divisions{background:#fff;border:1px solid #d5e0ef;border-radius:16px;padding:16px}.s6001-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.s6001-grid.compact{grid-template-columns:1fr 170px}.s6001-grid label{display:grid;gap:6px;font-weight:700}.s6001-grid input,.s6001-grid select{width:100%;padding:11px;border:1px solid #c7d5e8;border-radius:10px;background:#fff}.s6001-section-head,.s6001-venue-title,.s6001-venue-head,.s6001-local-actions{display:flex;justify-content:space-between;align-items:center;gap:12px}.s6001-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.s6001-tabs button{border:1px solid #c8d7ea;background:#fff;border-radius:12px;padding:10px 12px;text-align:left;display:grid;gap:3px}.s6001-tabs button.active{background:#102d57;color:#fff}.s6001-tabs small{font-size:11px}.s6001-division-form{display:grid;gap:16px}.s6001-venue{border:1px solid #d7e2f2;background:#f8fbff;border-radius:14px;padding:14px;margin-top:10px}.s6001-scope{display:flex;gap:20px;margin:12px 0}.s6001-courts{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:7px}.s6001-court{border:1px solid #d7e2f2;background:#fff;border-radius:9px;padding:8px;display:flex;gap:5px;align-items:center;justify-content:center}.s6001-message{min-height:22px;color:#31557f;font-weight:700}.s6001-shell>footer{border-top:1px solid #d7e2f2;background:#fff;padding:14px 20px;display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center}.s6001-shell>footer>div{display:grid;gap:2px}.s6001-shell>footer span{font-size:12px;color:#61738b}.s6001-dialog[data-save-mode="error"] footer strong{color:#c62828}.s6001-dialog[data-save-mode="success"] footer strong{color:#137333}.s6001-dialog[data-save-mode="saving"] footer strong{color:#1557a0}
  @media(max-width:700px){.s6001-dialog{width:98vw;max-width:98vw;max-height:96vh}.s6001-shell{max-height:96vh}.s6001-grid,.s6001-grid.compact{grid-template-columns:1fr}.s6001-courts{grid-template-columns:repeat(4,1fr)}.s6001-shell>footer{grid-template-columns:1fr 1fr}.s6001-shell>footer>div{grid-column:1/-1}.s6001-shell>footer button{width:100%}}
  `;document.head.appendChild(style);
  document.documentElement.dataset.build='6001';console.info('[230MATCH] 60.0.1 ready · explicit tournament editor save and opaque inline division management');
})();

/* Stage 34.3.9 · court-reserved prelim queue + concurrent main allocation */
(function(){
  function showCourtPolicyState(){
    const host=document.querySelector('#view-operation .operation-unified-head, #view-operation .section-head');
    if(!host)return;
    let badge=document.getElementById('stage3439PolicyBadge');
    if(!badge){badge=document.createElement('span');badge.id='stage3439PolicyBadge';badge.className='badge';host.appendChild(badge);}
    const reserved=(state.prelim?.courts||[]).filter(c=>[c.playing,c.wait1,...(c.queue||[])].some(id=>findUnifiedMatch(state,id)?.type==='prelim'&&findUnifiedMatch(state,id)?.match?.status!=='completed')).length;
    badge.textContent=reserved?`예선 예약 코트 ${reserved}면 · 남는 코트 본선 배정`:'전 코트 본선 배정 가능';
    badge.className=`badge ${reserved?'badge-warning':'badge-safe'}`;
  }
  const oldCommit=commit;
  commit=function(message){const result=oldCommit(message);setTimeout(showCourtPolicyState,0);return result;};
  setTimeout(()=>{if(useUnifiedCourts(state)){const repair=reconcilePrelimCourtReservations(state);if(repair.added||repair.returnedMain){safePersistState('코트별 예선 예약열 복구');render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});}}showCourtPolicyState();autoSmsSnapshot=buildAutoSmsSnapshot();},0);
  const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 34.3.9 · 코트별 예선 예약열·본선 병행배정';label.title='Version 34.3.9';}
  document.documentElement.dataset.build='3439';
  console.info('[230MATCH V3] 34.3.9 ready · court-reserved prelim queue and concurrent main allocation active');
})();

/* Stage 34.4.0 · visible main draw and confirmation controls */
(function stage3440RestoreMainPreparation(){
  const byId=id=>document.getElementById(id);
  function moveControl(id,target){
    const el=byId(id);if(!el||!target)return null;
    target.appendChild(el);el.hidden=false;el.style.removeProperty('display');return el;
  }
  function linkedMode(){try{return typeof shouldUseLinkedDraw==='function'&&shouldUseLinkedDraw(state);}catch(_e){return !!(state?.prelim?.groups?.length);}}
  function install(){
    const target=byId('stage342MainContent');
    const details=byId('stage342MainDetails');
    if(!target||!details)return;
    details.open=true;
    let shell=byId('stage3440MainShell');
    if(!shell){
      shell=document.createElement('section');shell.id='stage3440MainShell';shell.className='stage3440-main-shell';
      shell.innerHTML=`
        <div class="stage3440-main-head">
          <div><h3>2. 본선 준비</h3><p>예선 진행 중에도 본선 추첨을 하고, 확정된 슬롯부터 코트에 배정합니다.</p></div>
          <span id="stage3440MainBadge" class="badge badge-muted-dark">미추첨</span>
        </div>
        <div class="stage3440-main-settings" id="stage3440MainSettings"></div>
        <div class="stage3440-main-actions" id="stage3440MainActions"></div>
        <details class="stage3440-advanced" id="stage3440AdvancedDraw">
          <summary>고급 추첨 방식</summary>
          <div class="stage3440-advanced-actions" id="stage3440AdvancedActions"></div>
        </details>
        <div id="stage3440MainHelp" class="notice info">본선 추첨 후 예선 순위가 확정되는 대로 실제 팀명이 자동 반영됩니다.</div>`;
      target.prepend(shell);
    }
    const settings=byId('stage3440MainSettings');
    ['drawSize','byePriority','matchMinutes','autoIncrementalMainEnabled'].forEach(id=>{
      const el=byId(id);const label=el?.closest('label');if(label&&settings&&!settings.contains(label))settings.appendChild(label);
    });
    const actions=byId('stage3440MainActions');
    const linked=linkedMode();
    const linkedBtn=moveControl('generateLinkedDrawBtn',actions);if(linkedBtn)linkedBtn.textContent='본선 추첨';
    const syncBtn=moveControl('syncLinkedDrawBtn',actions);if(syncBtn)syncBtn.textContent='확정팀 반영';
    const assignBtn=moveControl('assignCourtsBtn',actions);if(assignBtn)assignBtn.textContent='본선 코트배정';
    const lockBtn=moveControl('lockDrawBtn',actions);if(lockBtn)lockBtn.textContent='본선 확정';
    const advanced=byId('stage3440AdvancedActions');
    ['instantDrawBtn','rouletteDrawBtn','seededDrawBtn'].forEach(id=>moveControl(id,advanced));
    const advBox=byId('stage3440AdvancedDraw');if(advBox)advBox.hidden=linked;
    if(linkedBtn)linkedBtn.hidden=!linked;
    if(syncBtn)syncBtn.hidden=!linked;
    const badge=byId('stage3440MainBadge');
    const hasDraw=!!(state?.draw?.rounds&&Object.keys(state.draw.rounds).length)||!!(state?.matches?.length);
    const locked=!!state?.settings?.drawLocked;
    if(badge){badge.textContent=locked?'확정됨 🔒':hasDraw?'추첨 완료':'미추첨';badge.className=`badge ${locked?'badge-safe':hasDraw?'badge-warning':'badge-muted-dark'}`;}
    const summary=byId('stage342MainSummary');if(summary)summary.textContent=locked?'확정됨':hasDraw?'추첨 완료':'본선 추첨 필요';
    const help=byId('stage3440MainHelp');if(help)help.textContent=linked?'예선 진행 중 본선 슬롯을 추첨합니다. 예선 순위가 확정되면 실제 팀명이 자동 반영되고, 확정된 경기부터 코트배정됩니다.':'예선이 없는 대회는 고급 추첨 방식에서 즉시·룰렛·시드 분산 추첨을 선택할 수 있습니다.';
  }
  function ready(){install();setTimeout(install,250);setTimeout(install,900);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  window.addEventListener('hashchange',()=>setTimeout(install,50));
  const oldCommit=commit;commit=function(message){const r=oldCommit(message);setTimeout(install,0);return r;};
  const style=document.createElement('style');style.textContent=`
    .stage3440-main-shell{display:grid;gap:14px;padding:2px 0 6px}.stage3440-main-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.stage3440-main-head h3{margin:0 0 4px}.stage3440-main-head p{margin:0;color:#667085}.stage3440-main-settings{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.stage3440-main-settings label{display:grid;gap:6px}.stage3440-main-actions,.stage3440-advanced-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.stage3440-main-actions .btn,.stage3440-advanced-actions .btn{width:100%;min-height:48px}.stage3440-main-actions #generateLinkedDrawBtn,.stage3440-main-actions #lockDrawBtn{background:#102d57;color:#fff}.stage3440-advanced{border:1px solid #d7e2f2;border-radius:12px;padding:10px 12px}.stage3440-advanced summary{cursor:pointer;font-weight:800}.stage3440-advanced-actions{margin-top:10px}@media(max-width:800px){.stage3440-main-settings{grid-template-columns:repeat(2,1fr)}.stage3440-main-actions,.stage3440-advanced-actions{grid-template-columns:repeat(2,1fr)}}@media(max-width:480px){.stage3440-main-settings,.stage3440-main-actions,.stage3440-advanced-actions{grid-template-columns:1fr}.stage3440-main-head{align-items:flex-start;flex-direction:column}}
  `;document.head.appendChild(style);
  const label=byId('buildStageLabel');if(label){label.textContent='230MATCH 34.4.0 · 본선 추첨·확정 전면 복구';label.title='Version 34.4.0';}
  document.documentElement.dataset.build='3440';
  console.info('[230MATCH V3] 34.4.0 ready · main draw and confirmation controls visible');
})();

/* Stage 34.4.1 · explicit main draw states, visible controls, clean reset */
(function stage3441ExplicitMainFlow(){
  const $=id=>document.getElementById(id);
  const allMain=()=>{try{return typeof allMatches==='function'?allMatches(state.draw||{rounds:{}}):[]}catch(_e){return[]}};
  const linked=()=>state?.prelim?.linkedDraw||{};
  const expectedSlots=()=>Math.max(0,(state?.prelim?.groups?.length||0)*Number(state?.prelim?.settings?.qualifiersPerGroup||1));
  const reflectedSlots=()=>Array.isArray(linked().slots)?linked().slots.filter(x=>x?.resolvedTeamId).length:0;
  function explicitKind(){
    if(state?.draw?.stage3441Explicit==='final')return'final';
    if(state?.draw?.stage3441Explicit==='slot'||linked().userInitiated===true)return'slot';
    return'';
  }
  function status(){
    const kind=explicitKind(), locked=!!(state?.settings?.drawLocked||state?.drawMeta?.locked);
    if(locked)return{key:'locked',label:'본선 확정 완료 🔒',detail:'확정된 본선 대진입니다.'};
    if(kind==='final')return{key:'final',label:'최종 본선 추첨 완료',detail:`실제 진출팀 ${state?.prelim?.qualifiers?.length||0}팀으로 추첨했습니다.`};
    if(kind==='slot')return{key:'slot',label:'슬롯 선추첨 완료',detail:`실제 팀 반영 ${reflectedSlots()}/${linked().slots?.length||expectedSlots()}팀 · 아직 최종 확정 전`};
    if(allMain().length)return{key:'stale',label:'이전 본선 데이터 감지',detail:'현재 버전에서 실행한 추첨이 아닙니다. 본선 초기화 후 다시 추첨하세요.'};
    return{key:'none',label:'본선 미추첨',detail:'예선 중 슬롯 선추첨 또는 예선 종료 후 최종 본선 추첨을 선택하세요.'};
  }
  function save(){try{saveState(state)}catch(_e){}}
  function resetMainOnly(){
    if(typeof requireAdmin==='function'&&!requireAdmin('본선 초기화'))return;
    const typed=prompt('예선 결과는 유지하고 본선 슬롯·대진·코트배정만 초기화합니다. 계속하려면 “본선초기화”를 입력하세요.','');
    if(typed!=='본선초기화'){notice?.('본선 초기화를 취소했습니다.','warning');return;}
    try{saveRecovery(state,`${state.tournament?.name||'대회'} · 본선 초기화 전 자동 복구점`)}catch(_e){}
    const fresh=initialState();
    state.draw=structuredClone(fresh.draw);state.drawMeta=structuredClone(fresh.drawMeta);
    state.prelim=state.prelim||{};state.prelim.linkedDraw={active:false,slots:[],createdAt:null,lastSyncedAt:null,userInitiated:false};
    state.courts=[];state.sharedQueue=[];state.venueQueues={};
    delete state.completion;delete state.tournament?.completedAt;
    try{ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state)}catch(_e){}
    commit('본선만 초기화 · 예선 결과 유지');
    notice?.('본선 슬롯·대진·코트배정을 초기화했습니다. 예선 결과는 유지됩니다.','success');
    refresh();
  }
  function finalDraw(){
    if(typeof requireAdmin==='function'&&!requireAdmin('최종 본선 추첨'))return;
    const qualifiers=[...(state?.prelim?.qualifiers||[])];
    const need=expectedSlots();
    if(qualifiers.length<2){notice?.('확정된 본선 진출팀이 없습니다. 예선 결과를 먼저 확정하세요.','error');return;}
    if(need&&qualifiers.length<need){notice?.(`본선 진출팀이 아직 ${qualifiers.length}/${need}팀만 확정되었습니다. 모든 예선 결과가 나온 뒤 최종 추첨하세요.`,'warning');return;}
    const size=Number(state?.settings?.drawSize)|| (qualifiers.length<=32?32:qualifiers.length<=64?64:128);
    if(!confirm(`확정된 ${qualifiers.length}팀으로 ${size}강 최종 본선 대진을 추첨할까요?\n기존 슬롯 대진과 본선 코트배정은 초기화됩니다.`))return;
    try{saveRecovery(state,`${state.tournament?.name||'대회'} · 최종 본선 추첨 전`)}catch(_e){}
    state.draw=createDrawWithMethod(state,qualifiers,size,{method:'instant',byePriority:state.settings?.byePriority});
    state.draw.stage3441Explicit='final';state.draw.stage3441DrawAt=new Date().toISOString();
    state.prelim.linkedDraw={active:false,slots:[],createdAt:null,lastSyncedAt:null,userInitiated:false,finalDrawAt:new Date().toISOString()};
    state.courts=[];state.sharedQueue=[];state.venueQueues={};
    commit(`최종 본선 추첨 · ${qualifiers.length}팀 · ${size}강`);
    notice?.('최종 본선 대진을 생성했습니다. 검토 후 본선 코트배정과 본선 확정을 진행하세요.','success');
    refresh();
  }
  function markSlotDraw(){
    setTimeout(()=>{
      if(state?.prelim?.linkedDraw?.active){
        state.prelim.linkedDraw.userInitiated=true;
        state.prelim.linkedDraw.userInitiatedAt=new Date().toISOString();
        if(state.draw){state.draw.stage3441Explicit='slot';state.draw.stage3441DrawAt=new Date().toISOString();}
        save();refresh();
      }
    },30);
  }
  function ensurePanel(){
    const hub=$('stage342SimpleSetupHub');if(!hub)return;
    let panel=$('stage3441MainPrep');
    if(!panel){
      panel=document.createElement('section');panel.id='stage3441MainPrep';panel.className='stage3441-main-prep';
      const prelim=$('stage342PrelimDetails');
      if(prelim)prelim.insertAdjacentElement('afterend',panel);else hub.appendChild(panel);
    }
    panel.innerHTML=`
      <div class="stage3441-head"><div><h3>2. 본선 준비</h3><p>예선 중 슬롯 선추첨과 예선 종료 후 최종 본선 추첨을 명확히 구분합니다.</p></div><span id="stage3441Status" class="badge"></span></div>
      <div id="stage3441StatusDetail" class="stage3441-status-detail"></div>
      <div class="stage3441-actions">
        <button type="button" id="stage3441SlotDraw" class="btn btn-purple">예선 중 슬롯 선추첨</button>
        <button type="button" id="stage3441FinalDraw" class="btn btn-primary">최종 본선 추첨</button>
        <button type="button" id="stage3441Sync" class="btn btn-light">확정팀 반영</button>
        <button type="button" id="stage3441Assign" class="btn btn-light">본선 코트배정</button>
        <button type="button" id="stage3441Lock" class="btn btn-primary">본선 확정</button>
        <button type="button" id="stage3441Reset" class="btn btn-danger-outline">본선 초기화</button>
      </div>`;
    $('stage3441SlotDraw').onclick=()=>{const b=$('generateLinkedDrawBtn');if(!b){notice?.('슬롯 선추첨 기능을 찾지 못했습니다.','error');return;}markSlotDraw();b.click();};
    $('stage3441FinalDraw').onclick=finalDraw;
    $('stage3441Sync').onclick=()=>{const b=$('syncLinkedDrawBtn');b?b.click():notice?.('확정팀 반영 기능을 찾지 못했습니다.','error');};
    $('stage3441Assign').onclick=()=>{const b=$('assignCourtsBtn');b?b.click():notice?.('본선 코트배정 기능을 찾지 못했습니다.','error');};
    $('stage3441Lock').onclick=()=>{const b=$('lockDrawBtn');b?b.click():notice?.('본선 확정 기능을 찾지 못했습니다.','error');};
    $('stage3441Reset').onclick=resetMainOnly;
    // Old duplicate main preparation is kept only as a function source, not as visible UI.
    const old=$('stage342MainDetails');if(old)old.hidden=true;
  }
  function mainViewGuard(){
    const section=document.querySelector('#view-operation .operation-main-section');if(!section)return;
    let banner=$('stage3441MainViewBanner');
    if(!banner){banner=document.createElement('div');banner.id='stage3441MainViewBanner';banner.className='stage3441-main-banner';section.querySelector('.section-head')?.insertAdjacentElement('afterend',banner);}
    const s=status();banner.innerHTML=`<strong>${s.label}</strong><span>${s.detail}</span>`;
    const list=$('operationMainReadyList');
    if(list){
      const visible=s.key==='slot'||s.key==='final'||s.key==='locked';
      list.hidden=!visible;
      if(!visible)banner.innerHTML+=`<button type="button" class="btn btn-light btn-small" id="stage3441GoSetup">준비 화면에서 추첨하기</button>`;
      $('stage3441GoSetup')?.addEventListener('click',()=>document.querySelector('[data-operation-section="setup"]')?.click());
    }
  }
  function refresh(){
    ensurePanel();
    const s=status(), badge=$('stage3441Status'), detail=$('stage3441StatusDetail');
    if(badge){badge.textContent=s.label;badge.className=`badge ${s.key==='locked'||s.key==='final'?'badge-safe':s.key==='slot'?'badge-warning':s.key==='stale'?'badge-danger':'badge-muted-dark'}`;}
    if(detail)detail.textContent=s.detail;
    const slot=$('stage3441SlotDraw'), final=$('stage3441FinalDraw'), sync=$('stage3441Sync'), assign=$('stage3441Assign'), lock=$('stage3441Lock');
    if(slot)slot.disabled=!!state?.settings?.drawLocked;
    if(final)final.disabled=!!state?.settings?.drawLocked;
    if(sync)sync.disabled=explicitKind()!=='slot';
    if(assign)assign.disabled=!(explicitKind()==='slot'||explicitKind()==='final');
    if(lock)lock.disabled=!(explicitKind()==='slot'||explicitKind()==='final');
    const ms=$('stage342MainState');if(ms)ms.textContent=s.label.replace(' 완료','');
    mainViewGuard();
  }
  function ready(){refresh();setTimeout(refresh,250);setTimeout(refresh,1000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  window.addEventListener('hashchange',()=>setTimeout(refresh,50));
  const oldCommit3441=commit;commit=function(message){const r=oldCommit3441(message);setTimeout(refresh,0);return r;};
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-operation-section]'))setTimeout(refresh,30);},true);
  const style=document.createElement('style');style.textContent=`
    .stage3441-main-prep{border:1px solid #d7e2f2;border-radius:14px;padding:16px;margin-top:14px;background:#fff;display:grid;gap:12px}.stage3441-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.stage3441-head h3{margin:0 0 4px}.stage3441-head p{margin:0;color:#667085}.stage3441-status-detail{padding:10px 12px;border-radius:10px;background:#f2f7ff;color:#24456f}.stage3441-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.stage3441-actions .btn{width:100%;min-height:48px}.stage3441-main-banner{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;margin:10px 0;border:1px solid #d7e2f2;border-radius:12px;background:#f8fbff}.stage3441-main-banner span{color:#5d6f89}.stage3441-main-banner button{margin-left:auto}@media(max-width:720px){.stage3441-actions{grid-template-columns:repeat(2,1fr)}.stage3441-head{flex-direction:column}}@media(max-width:440px){.stage3441-actions{grid-template-columns:1fr}}
  `;document.head.appendChild(style);
  const label=$('buildStageLabel');if(label){label.textContent='230MATCH 34.4.1 · 본선 추첨 상태 분리·초기화';label.title='Version 34.4.1';}
  document.documentElement.dataset.build='3441';
  console.info('[230MATCH V3] 34.4.1 ready · explicit slot/final draw states active');
})();


// Stage 34.4.2 · unified court wait1 refill and shared queue ETA policy
console.info('[230MATCH V3] 34.4.2 ready · main wait1 refill and shared queue elapsed-only display active');


/* Stage 34.4.3 · admin action center + explicit prelim lock controls */
(function stage3443AdminActionCenter(){
  const byId=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const entries=[];
  let lastFeedbackAt=0;
  let pendingAction='';

  function adminVisible(){
    try{return typeof isAdmin==='function' ? isAdmin() : document.body?.classList.contains('role-admin');}
    catch(_e){return false;}
  }
  function tone(type){return type==='success'?'success':type==='error'?'error':type==='warning'?'warning':'info';}
  function title(type){return type==='success'?'처리 완료':type==='error'?'오류 발생':type==='warning'?'확인 필요':'실행 안내';}
  function ensureCenter(){
    let root=byId('adminActionCenter3443');
    if(root)return root;
    root=document.createElement('aside');root.id='adminActionCenter3443';root.className='admin-action-center-3443';root.hidden=true;
    root.innerHTML=`
      <div class="aac-head">
        <div><b>관리자 실행 상태</b><small id="aacContext3443">버튼 실행 결과와 오류를 표시합니다.</small></div>
        <div class="aac-head-actions"><button type="button" id="aacMin3443" aria-label="상태창 접기">−</button><button type="button" id="aacClear3443" aria-label="기록 지우기">×</button></div>
      </div>
      <div id="aacCurrent3443" class="aac-current info"><strong>대기 중</strong><span>관리자 작업을 실행하면 결과가 여기에 표시됩니다.</span></div>
      <div id="aacHistory3443" class="aac-history" hidden></div>`;
    document.body.appendChild(root);
    const minimizedKey='230match-admin-action-center-minimized';
    let minimized=false;
    try{
      const saved=localStorage.getItem(minimizedKey);
      minimized=saved===null?window.matchMedia('(max-width:700px)').matches:saved==='1';
    }catch(_e){minimized=window.matchMedia('(max-width:700px)').matches;}
    root.classList.toggle('minimized',minimized);
    byId('aacMin3443').textContent=minimized?'+':'−';
    byId('aacMin3443').addEventListener('click',()=>{
      root.classList.toggle('minimized');
      const nowMinimized=root.classList.contains('minimized');
      byId('aacMin3443').textContent=nowMinimized?'+':'−';
      try{localStorage.setItem(minimizedKey,nowMinimized?'1':'0');}catch(_e){}
    });
    byId('aacClear3443').addEventListener('click',()=>{entries.length=0;renderHistory();show('실행 기록을 비웠습니다.','info','상태창');});
    return root;
  }
  function contextText(){
    const t=state?.tournament?.name||state?.settings?.tournamentName||'현재 대회';
    const d=state?.tournament?.division||state?.settings?.division||state?.division?.name||'';
    return d?`${t} · ${d}`:t;
  }
  function renderHistory(){
    const box=byId('aacHistory3443');if(!box)return;
    box.hidden=!entries.length;
    box.innerHTML=entries.slice(0,8).map(x=>`<div class="aac-log ${x.type}"><time>${esc(x.time)}</time><b>${esc(x.label)}</b><span>${esc(x.message)}</span></div>`).join('');
  }
  function show(message,type='info',label='실행 결과'){
    const root=ensureCenter();root.hidden=!adminVisible();if(root.hidden)return;
    lastFeedbackAt=Date.now();
    const kind=tone(type),now=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const current=byId('aacCurrent3443');
    if(current){current.className=`aac-current ${kind}`;current.innerHTML=`<strong>${esc(title(kind))} · ${esc(label)}</strong><span>${esc(message)}</span><small>${esc(now)}</small>`;}
    const ctx=byId('aacContext3443');if(ctx)ctx.textContent=contextText();
    entries.unshift({time:now,label,message,type:kind});renderHistory();
  }
  function processing(label){
    const root=ensureCenter();root.hidden=!adminVisible();if(root.hidden)return;
    pendingAction=label;lastFeedbackAt=Date.now();
    const current=byId('aacCurrent3443');if(current){current.className='aac-current processing';current.innerHTML=`<strong>처리 중 · ${esc(label)}</strong><span>실행 결과를 확인하고 있습니다.</span>`;}
  }

  const originalNotice=typeof notice==='function'?notice:null;
  if(originalNotice){
    notice=function(message,type='info'){
      const result=originalNotice(message,type);
      show(message,type,pendingAction||'관리자 작업');pendingAction='';
      return result;
    };
  }
  const originalPrelimNotice=typeof prelimNotice==='function'?prelimNotice:null;
  if(originalPrelimNotice){
    prelimNotice=function(message,type='info'){
      const result=originalPrelimNotice(message,type);
      show(message,type,pendingAction||'예선 작업');pendingAction='';
      return result;
    };
  }

  function lockState(){try{return typeof isPrelimLocked==='function'&&isPrelimLocked(state);}catch(_e){return false;}}
  function prelimCounts(){
    const matches=state?.prelim?.matches||[];
    return {total:matches.length,done:matches.filter(m=>m.status==='completed').length,qualifiers:state?.prelim?.qualifiers?.length||0};
  }
  function ensurePrelimControl(){
    const host=byId('stage342PrelimContent')||byId('stage342PrelimDetails')||byId('unifiedPrelimSetup');if(!host)return;
    let panel=byId('stage3443PrelimLockPanel');
    if(!panel){
      panel=document.createElement('section');panel.id='stage3443PrelimLockPanel';panel.className='stage3443-prelim-lock-panel';
      panel.innerHTML=`
        <div class="p-lock-copy"><b id="stage3443PrelimLockTitle">예선 확정 상태</b><span id="stage3443PrelimLockDetail"></span></div>
        <div class="p-lock-actions"><button type="button" id="stage3443PrelimLockBtn" class="btn btn-primary">예선 확정·잠금</button><button type="button" id="stage3443PrelimUnlockBtn" class="btn btn-danger-outline">예선 잠금 해제</button></div>`;
      host.prepend(panel);
      byId('stage3443PrelimLockBtn').addEventListener('click',()=>{
        if(typeof requireAdmin==='function'&&!requireAdmin('예선 확정·잠금'))return;
        if(lockState()){show('예선은 이미 확정·잠금 상태입니다.','info','예선 확정');refresh();return;}
        const c=prelimCounts();
        if(!c.total){show('예선 경기가 생성되지 않았습니다. 조편성과 코트배정을 먼저 진행하세요.','error','예선 확정');return;}
        processing('예선 확정·잠금');
        try{
          finalizeAndLockPrelim();
          if(lockState())show(`예선 ${c.done}/${c.total}경기 결과와 진출팀 ${state?.prelim?.qualifiers?.length||0}팀을 확정하고 잠갔습니다.`,'success','예선 확정');
          else show('예선 확정 함수는 실행됐지만 잠금 상태가 확인되지 않았습니다.','error','예선 확정');
        }catch(error){console.error('[230MATCH V3] 예선 확정 실패',error);show(error?.message||String(error),'error','예선 확정');}
        refresh();
      });
      byId('stage3443PrelimUnlockBtn').addEventListener('click',()=>{
        processing('예선 잠금 해제');
        try{adminUnlockPrelim();setTimeout(()=>{if(!lockState())show('예선 잠금이 해제되었습니다. 결과 수정 후 다시 확정하세요.','success','예선 잠금 해제');refresh();},30);}catch(error){console.error('[230MATCH V3] 예선 잠금 해제 실패',error);show(error?.message||String(error),'error','예선 잠금 해제');}
      });
    }
  }
  function refresh(){
    const root=ensureCenter();root.hidden=!adminVisible();
    ensurePrelimControl();
    const panel=byId('stage3443PrelimLockPanel');if(panel)panel.hidden=!adminVisible();
    const locked=lockState(),c=prelimCounts();
    const titleEl=byId('stage3443PrelimLockTitle'),detail=byId('stage3443PrelimLockDetail');
    if(titleEl)titleEl.textContent=locked?'예선 확정됨 🔒':'예선 확정 전';
    if(detail)detail.textContent=locked?`결과 ${c.done}/${c.total}경기 · 진출 ${c.qualifiers}팀 보호 중`:`결과 ${c.done}/${c.total}경기 · 확정하면 결과 수정이 잠깁니다.`;
    const lockBtn=byId('stage3443PrelimLockBtn'),unlockBtn=byId('stage3443PrelimUnlockBtn');
    if(lockBtn){lockBtn.hidden=locked;lockBtn.disabled=!c.total;}
    if(unlockBtn)unlockBtn.hidden=!locked;
    const legacyLock=byId('lockPrelimBtn'),legacyUnlock=byId('unlockPrelimBtn');
    if(legacyLock)legacyLock.hidden=true;if(legacyUnlock)legacyUnlock.hidden=true;
    const ctx=byId('aacContext3443');if(ctx)ctx.textContent=contextText();
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('button');if(!button||!adminVisible()||button.closest('#adminActionCenter3443'))return;
    const label=(button.textContent||button.getAttribute('aria-label')||'버튼 실행').trim().replace(/\s+/g,' ');
    if(!label||button.disabled)return;
    processing(label);
    const started=Date.now();
    setTimeout(()=>{
      if(lastFeedbackAt<=started+20&&pendingAction===label){show(`${label} 실행 요청을 전달했습니다. 화면 상태가 바뀌지 않았다면 오류 기록을 확인하세요.`,'info',label);pendingAction='';}
    },1000);
  },true);
  window.addEventListener('error',event=>{const msg=event?.error?.message||event?.message||'알 수 없는 JavaScript 오류';show(msg,'error','시스템 오류');});
  window.addEventListener('unhandledrejection',event=>{const reason=event?.reason?.message||String(event?.reason||'처리되지 않은 비동기 오류');show(reason,'error','시스템 오류');});

  window.__stage3443ActionFeedback=show;
  window.__stage3443ActionProcessing=processing;
  function ready(){refresh();setTimeout(refresh,300);setTimeout(refresh,1000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  window.addEventListener('hashchange',()=>setTimeout(refresh,50));
  const oldCommit3443=commit;commit=function(message){const r=oldCommit3443(message);setTimeout(refresh,0);return r;};

  const style=document.createElement('style');style.textContent=`
    .admin-action-center-3443{position:fixed;right:18px;bottom:18px;z-index:100000;width:min(420px,calc(100vw - 36px));border:1px solid rgba(143,164,194,.72);border-radius:16px;background:rgba(255,255,255,.86);box-shadow:0 12px 32px rgba(15,42,79,.18);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);overflow:hidden;transition:width .18s ease,opacity .18s ease,box-shadow .18s ease}.aac-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 13px;background:rgba(16,45,87,.84);color:#fff}.aac-head>div:first-child{display:grid;gap:2px}.aac-head small{opacity:.78}.aac-head-actions{display:flex;gap:6px}.aac-head-actions button{width:30px;height:30px;border:0;border-radius:8px;background:rgba(255,255,255,.17);color:#fff;font-size:18px;cursor:pointer}.aac-current{display:grid;grid-template-columns:1fr auto;gap:4px 10px;padding:12px 14px;border-left:5px solid #55759e;background:rgba(255,255,255,.72)}.aac-current strong,.aac-current span{grid-column:1}.aac-current small{grid-column:2;grid-row:1/3;color:#68758a}.aac-current.success{border-color:#1f9d62;background:rgba(239,251,245,.78)}.aac-current.error{border-color:#df3f4f;background:rgba(255,241,242,.9)}.aac-current.warning{border-color:#e0a000;background:rgba(255,248,223,.84)}.aac-current.processing{border-color:#6c45dc;background:rgba(245,241,255,.82)}.aac-history{max-height:210px;overflow:auto;border-top:1px solid rgba(226,232,242,.8);background:rgba(255,255,255,.7)}.aac-log{display:grid;grid-template-columns:70px 110px 1fr;gap:8px;padding:8px 12px;border-bottom:1px solid rgba(237,241,247,.85);font-size:12px}.aac-log time{color:#6d7788}.aac-log.error b{color:#c72f40}.aac-log.success b{color:#168553}.admin-action-center-3443.minimized{width:190px;opacity:.72;box-shadow:0 8px 22px rgba(15,42,79,.14)}.admin-action-center-3443.minimized .aac-current,.admin-action-center-3443.minimized .aac-history{display:none}.admin-action-center-3443.minimized .aac-head small{display:none}.admin-action-center-3443.minimized #aacClear3443{display:none}.stage3443-prelim-lock-panel{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;margin:0 0 14px;border:1px solid #b8c9e2;border-radius:14px;background:#f7faff}.p-lock-copy{display:grid;gap:4px}.p-lock-copy span{color:#5b6c82}.p-lock-actions{display:flex;gap:8px;flex-wrap:wrap}.p-lock-actions .btn{min-height:44px}@media(max-width:700px){.admin-action-center-3443{left:auto!important;top:auto!important;right:8px!important;bottom:76px!important;width:calc(100vw - 16px);background:rgba(255,255,255,.76);box-shadow:0 9px 24px rgba(15,42,79,.14)}.admin-action-center-3443 .aac-head{background:rgba(16,45,87,.72)}.admin-action-center-3443.minimized{width:142px;opacity:.58;border-radius:13px}.admin-action-center-3443.minimized .aac-head{padding:8px 9px;gap:5px}.admin-action-center-3443.minimized .aac-head b{font-size:0}.admin-action-center-3443.minimized .aac-head b::after{content:'⚙ 운영상태';font-size:13px;white-space:nowrap}.admin-action-center-3443.minimized .aac-head-actions button{width:27px;height:27px;font-size:17px}.stage3443-prelim-lock-panel{align-items:stretch;flex-direction:column}.p-lock-actions .btn{flex:1}.aac-log{grid-template-columns:64px 90px 1fr}}
  `;document.head.appendChild(style);
  const label=byId('buildStageLabel');if(label){label.textContent='230MATCH 34.4.3 · 관리자 실행 상태·예선 잠금 복구';label.title='Version 34.4.3';}
  document.documentElement.dataset.build='3443';
  console.info('[230MATCH V3] 34.4.3 ready · admin action center and prelim lock controls active');
})();




/* Stage 35.0.0 · rebuilt explicit main-draw lifecycle */
(function stage3500RebuiltMainLifecycle(){
  const $=id=>document.getElementById(id);
  function feedback(message,type='info',title='본선 운영'){
    try{notice(message,type);}catch(_e){}
    try{window.__stage3443ActionFeedback?.(message,type,title);}catch(_e){}
  }
  function refresh(){
    const st=mainDrawStatus(state);
    const box=$('stage3444DrawGateNotice')||document.createElement('div');
    if(!box.id){box.id='stage3444DrawGateNotice';box.className='notice';const panel=$('stage3441MainPrep')||$('stage342MainDetails');panel?.prepend(box);}
    box.className=`notice ${st.authorized?'success':'warning'}`;
    box.textContent=st.authorized?`${st.label} · 이 추첨에서 생성된 확정 경기만 공용대기와 코트에 배정됩니다.`:'본선 미추첨 · 본선 추첨 버튼을 누르기 전에는 본선 카드·공용대기·코트배정이 생성되지 않습니다.';
    const status=$('stage3441Status');if(status)status.textContent=st.label;
    const detail=$('stage3441StatusDetail');if(detail)detail.textContent=st.authorized?`실행 시각 ${new Date(st.completedAt).toLocaleString('ko-KR')}`:'슬롯 추첨 또는 최종 본선 추첨을 직접 실행하세요.';
  }
  function bindFresh(id,handler){
    const old=$(id);if(!old)return;
    const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.addEventListener('click',handler);return fresh;
  }
  function slotDraw(){
    if(!requireAdmin('예선 중 슬롯 추첨'))return;
    if(!(state?.prelim?.groups?.length)){feedback('예선 조편성이 없습니다. 먼저 예선 조편성을 생성하세요.','error','슬롯 추첨');return;}
    if(!confirm('예선 조 순위 슬롯으로 본선 대진을 추첨할까요?\n이 작업을 실행해야만 본선 카드와 공용대기가 생성될 수 있습니다.'))return;
    try{
      beginMainDraw(state,'slot');
      createLinkedDraw();
      if(state.prelim?.linkedDraw){state.prelim.linkedDraw.userInitiated=true;state.prelim.linkedDraw.userInitiatedAt=new Date().toISOString();}
      completeMainDraw(state,'slot');
      repairMainDrawAuthorization(state);
      if(!hasAuthorizedMainDraw(state))throw new Error('슬롯 본선 추첨은 생성됐지만 실행 인증 상태를 저장하지 못했습니다. 다시 시도해 주세요.');
      commit('사용자 실행 · 예선 중 슬롯 본선 추첨 완료 · 코트배정 활성');
      feedback('슬롯 본선 추첨을 완료했습니다. 실제 팀이 확정된 경기부터 공용대기와 코트배정이 가능합니다.','success','본선 슬롯 추첨');
    }catch(error){failMainDraw(state);commit('본선 슬롯 추첨 실패 상태 정리');feedback(error?.message||String(error),'error','본선 슬롯 추첨');}
    refresh();
  }
  function finalDraw(){
    if(!requireAdmin('최종 본선 추첨'))return;
    const qualifiers=[...(state?.prelim?.qualifiers||[])];
    const need=Math.max(0,(state?.prelim?.groups?.length||0)*Number(state?.prelim?.settings?.qualifiersPerGroup||1));
    if(qualifiers.length<2){feedback('확정된 본선 진출팀이 없습니다.','error','최종 본선 추첨');return;}
    if(need&&qualifiers.length<need){feedback(`본선 진출팀이 ${qualifiers.length}/${need}팀입니다. 모든 예선 결과가 확정된 뒤 실행하세요.`,'warning','최종 본선 추첨');return;}
    const size=Number(state?.settings?.drawSize)||(qualifiers.length<=32?32:qualifiers.length<=64?64:128);
    if(!confirm(`${qualifiers.length}팀으로 ${size}강 최종 본선 추첨을 실행할까요?\n이 작업을 실행해야만 본선 카드와 공용대기가 생성됩니다.`))return;
    try{
      beginMainDraw(state,'final');
      state.draw=createDrawWithMethod(state,qualifiers,size,{method:'instant',byePriority:state.settings?.byePriority});
      state.prelim.linkedDraw={active:false,slots:[],createdAt:null,lastSyncedAt:null,userInitiated:false,finalDrawAt:new Date().toISOString()};
      completeMainDraw(state,'final');
      commit(`사용자 실행 · 최종 본선 추첨 · ${qualifiers.length}팀 · ${size}강`);
      feedback('최종 본선 추첨을 완료했습니다. 이제 본선 코트배정을 실행할 수 있습니다.','success','최종 본선 추첨');
    }catch(error){failMainDraw(state);commit('최종 본선 추첨 실패 상태 정리');feedback(error?.message||String(error),'error','최종 본선 추첨');}
    refresh();
  }
  function resetOnly(){
    if(!requireAdmin('본선 초기화'))return;
    if(prompt('예선 데이터는 유지하고 본선만 초기화합니다. “본선초기화”를 입력하세요.','')!=='본선초기화')return;
    try{saveRecovery(state,`${state.tournament?.name||'대회'} · 본선 초기화 전`);}catch(_e){}
    resetMainDraw(state);commit('본선 생명주기 초기화 · 미추첨 상태');feedback('본선 대진·공용대기·코트배정을 모두 지웠습니다. 예선 데이터는 유지됩니다.','success','본선 초기화');refresh();
  }
  function install(){
    ensureMainDrawLifecycle(state);
    repairMainDrawAuthorization(state);
    bindFresh('stage3441SlotDraw',slotDraw);
    bindFresh('stage3441FinalDraw',finalDraw);
    bindFresh('stage3441Assign',()=>{repairMainDrawAuthorization(state);if(!hasAuthorizedMainDraw(state)){feedback('본선 추첨 실행 기록을 확인하지 못했습니다. 슬롯 추첨을 완료했다면 상태 복구를 다시 시도해 주세요.','error','본선 코트배정');return;}const b=$('assignCourtsBtn');b?b.click():feedback('본선 코트배정 기능을 찾지 못했습니다.','error','본선 코트배정');});
    bindFresh('stage3441Lock',()=>{if(!hasAuthorizedMainDraw(state)){feedback('본선 미추첨 상태에서는 본선을 확정할 수 없습니다.','error','본선 확정');return;}const b=$('lockDrawBtn');b?b.click():feedback('본선 확정 기능을 찾지 못했습니다.','error','본선 확정');});
    bindFresh('stage3441Reset',resetOnly);
    clearMainPlacement(state,{clearDraw:false});
    refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else setTimeout(install,0);
  window.addEventListener('hashchange',()=>setTimeout(()=>{install();refresh();},60));
  const oldCommit3500=commit;commit=function(message){const r=oldCommit3500(message);setTimeout(refresh,0);return r;};
  const label=$('buildStageLabel');if(label){label.textContent='230MATCH 35.0.1 · 슬롯 추첨 코트배정 연결 복구';label.title='Version 35.0.1';}
  document.documentElement.dataset.build='3500';
  console.info('[230MATCH V3] 35.0.1 ready · slot draw authorization persistence fixed');
})();


/* Stage 35.0.4 · additional prelim queue expected start display */
(function stage3504AdditionalQueueExpectedStart(){
  const label=document.getElementById('buildStageLabel');
  if(label){label.textContent='230MATCH 35.0.4 · 예선 추가대기 예상 시작시간';label.title='Version 35.0.4';}
  document.documentElement.dataset.build='3504';
  console.info('[230MATCH V3] 35.0.4 ready · additional prelim queue expected start visible');
})();


/* Stage 35.1.0 · Firebase write coalescing and multi-device sync stabilization */
(function stage3510SyncStability(){
  const byId=id=>document.getElementById(id);
  function applyLabel(){
    const label=byId('buildStageLabel');if(label){label.textContent='230MATCH 35.1 · 저장·다기기 운영 안정화';label.title='Version 35.1.0';}
    document.documentElement.dataset.build='3510';
  }
  function ready(){applyLabel();setTimeout(applyLabel,500);setTimeout(applyLabel,1500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  console.info('[230MATCH V3] 35.1.0 ready · coalesced single-flight Firebase sync active');
})();


/* Stage 35.1.1 · hard pre-entry gate for prelim-first court promotion */
(function stage3511AtomicCourtGate(){
  const label=document.getElementById('buildStageLabel');
  if(label){label.textContent='230MATCH 35.1.1 · 예선 절대우선 원자 승격';label.title='Version 35.1.1';}
  document.documentElement.dataset.build='3511';
  console.info('[230MATCH V3] 35.1.1 ready · main entry is blocked before prelim promotion completes');
})();

/* Stage 35.2.0 · automatic SMS approval and delivery workflow completion */
(function stage3520SmsWorkflow(){
  const byId=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const placementRank=p=>p?.slot==='playing'?0:p?.slot==='wait1'?1:2;
  const eventTitle=kind=>({start:'시합 시작',waiting:'코트 대기1',changed:'코트·순서 변경',complete:'경기 완료'})[kind]||'경기 안내';
  let lastBatch=[];

  function ensureRuntime(){
    ensureMessagingState(state);
    state.messaging.smsRuntime=state.messaging.smsRuntime||{lastDetectedAt:'',lastEvent:'',lastResult:'',queuedCount:0};
    state.messaging.smsApprovalHistory=Array.isArray(state.messaging.smsApprovalHistory)?state.messaging.smsApprovalHistory:[];
    return state.messaging.smsRuntime;
  }
  function validPhoneCount(){
    const seen=new Set();
    for(const team of state.teams||[])for(const r of smsTeamRecipients(team))seen.add(r.phone);
    return seen.size;
  }
  function pendingCount(){return autoSmsDialogQueue.length+(autoSmsDialogOpen?1:0);}
  function setRuntime(result,event=''){
    const rt=ensureRuntime();rt.lastDetectedAt=new Date().toISOString();rt.lastResult=result||rt.lastResult;rt.lastEvent=event||rt.lastEvent;rt.queuedCount=pendingCount();
  }
  function actionFeedback(message,type='info',label='자동 문자'){
    try{window.__stage3443ActionFeedback?.(message,type,label);}catch(_e){}
  }
  function renderStatus(){
    let host=byId('stage3520SmsStatus');
    const operation=byId('view-operation');
    if(!operation||!canOperate())return;
    if(!host){
      host=document.createElement('section');host.id='stage3520SmsStatus';host.className='stage3520-sms-status';
      const head=operation.querySelector('.operation-workspace-head, .operation-mode-tabs, .stage342-workspace-head');
      (head?.parentNode||operation).insertBefore(host,head?.nextSibling||operation.firstChild);
    }
    const s=state.messaging?.settings||{},rt=ensureRuntime(),phones=validPhoneCount(),pending=pendingCount();
    const enabled=s.autoSmsApprovalEnabled===true;
    host.innerHTML=`<div class="stage3520-sms-main"><strong>자동 문자 ${enabled?'ON':'OFF'}</strong><span>연락처 ${phones}개 · 승인 대기 ${pending}건</span><small>${esc(rt.lastResult||'코트 이동을 감지하면 발송 전 승인창이 표시됩니다.')}</small></div><div class="stage3520-sms-actions"><button type="button" class="btn btn-light" data-s3520-test>현재 코트 문자 시험</button><button type="button" class="btn btn-light" data-s3520-settings>문자 설정</button></div>`;
    host.querySelector('[data-s3520-test]')?.addEventListener('click',stage3520Preview);
    host.querySelector('[data-s3520-settings]')?.addEventListener('click',()=>navigatePortalView?.('messages',{pushHistory:true}));
  }
  function stage3520Preview(){
    if(!requireOperator('자동 문자 승인창 시험'))return;
    const cur=buildAutoSmsSnapshot();
    const candidates=Object.entries(cur.placements).map(([id,p])=>({id,p,m:findAnyMatchById(id)})).filter(x=>x.m).sort((a,b)=>placementRank(a.p)-placementRank(b.p));
    const x=candidates[0];if(!x){notice('현재 코트에 배정된 경기가 없습니다.','info');return;}
    const kind=x.p.slot==='playing'?'start':'waiting';
    const recipients=smsMatchRecipients(x.m),key=`preview|${Date.now()}|${x.id}`;
    const item={key,kind,matchId:x.id,match:x.m,placement:x.p,recipients,body:autoSmsBody(kind,x.m,x.p),preview:true};
    if(!recipients.length){item.noPhone=true;item.teamLabel=`${smsTeamName(x.m.teamA)} vs ${smsTeamName(x.m.teamB)}`;item.body=`${item.teamLabel}\n\n등록된 연락처가 없어 시험 문자를 만들지 못했습니다.`;}
    autoSmsDialogQueue.push(item);setRuntime('시험 승인창을 준비했습니다.',eventTitle(kind));showNextAutoSmsDialog();renderStatus();
  }

  // Replace transition detection with an ordered batch: playing first, then wait1, then changed.
  detectAutoSmsEvents=function stage3520DetectAutoSmsEvents(){
    const current=buildAutoSmsSnapshot();
    if(!autoSmsSnapshot){autoSmsSnapshot=current;setRuntime('문자 감지 기준점을 저장했습니다.');renderStatus();return;}
    const s=state.messaging?.settings||{};
    if(s.autoSmsApprovalEnabled!==true||!canOperate()){autoSmsSnapshot=current;renderStatus();return;}
    const events=[];
    for(const [id,p] of Object.entries(current.placements)){
      const before=autoSmsSnapshot.placements[id],m=findAnyMatchById(id);if(!m)continue;
      const moved=!before||before.court!==p.court||before.slot!==p.slot||before.position!==p.position;
      if(!moved)continue;
      if(p.slot==='playing'&&s.autoSmsMatchStart!==false)events.push({kind:'start',m,p,rank:0});
      else if(p.slot==='wait1'&&s.autoSmsCourtWaiting!==false)events.push({kind:'waiting',m,p,rank:1});
      else if(s.autoSmsCourtChanged!==false)events.push({kind:'changed',m,p:{...p,slotLabel:p.slot==='queue'?`대기 ${p.position||2}번`:'대기 위치'},rank:2});
    }
    if(s.autoSmsMatchComplete===true){
      for(const [id,done] of Object.entries(current.completed))if(done&&!autoSmsSnapshot.completed[id]){const m=findAnyMatchById(id);if(m)events.push({kind:'complete',m,p:current.placements[id]||{},rank:3});}
    }
    events.sort((a,b)=>a.rank-b.rank||String(a.p.court||'').localeCompare(String(b.p.court||''),'ko')||Number(a.p.position||0)-Number(b.p.position||0));
    lastBatch=events;
    let queued=0,missing=0,duplicates=0;
    for(const e of events){const r=queueAutoSmsEvent(e.kind,e.m,e.p);if(r?.queued)queued++;else if(r?.noPhone)missing++;else if(r?.duplicate)duplicates++;}
    autoSmsSnapshot=current;
    if(events.length){
      const parts=[];if(queued)parts.push(`승인창 ${queued}건`);if(missing)parts.push(`연락처 없음 ${missing}건`);if(duplicates)parts.push(`중복 제외 ${duplicates}건`);
      const msg=`코트 이동 ${events.length}건 감지 · ${parts.join(' · ')||'처리할 문자 없음'}`;
      setRuntime(msg,events.map(e=>eventTitle(e.kind)).join(' → '));
      actionFeedback(msg,missing?'warning':'success','자동 문자 감지');
    }
    renderStatus();
  };

  const originalShowNext=showNextAutoSmsDialog;
  showNextAutoSmsDialog=function stage3520ShowNextAutoSmsDialog(){
    originalShowNext();
    const d=byId('autoSmsApprovalDialog'),item=d?.__smsItem;if(!item)return;
    let meta=byId('stage3520SmsDialogMeta');
    if(!meta){meta=document.createElement('div');meta.id='stage3520SmsDialogMeta';meta.className='stage3520-sms-dialog-meta';d.querySelector('.modal-body')?.prepend(meta);}
    meta.innerHTML=`<strong>${esc(eventTitle(item.kind))}</strong><span>${esc(item.placement?.court||'코트 미정')} · ${item.placement?.slot==='playing'?'시합중':item.placement?.slot==='wait1'?'대기1':'위치 변경'}</span><small>남은 승인 ${autoSmsDialogQueue.length}건${item.preview?' · 시험':' · 실제 이동 감지'}</small>`;
    setRuntime(`승인창 표시 중 · ${eventTitle(item.kind)}`,eventTitle(item.kind));renderStatus();
  };
  const originalClose=closeAutoSmsDialog;
  closeAutoSmsDialog=function stage3520CloseAutoSmsDialog(status='skipped'){
    const item=byId('autoSmsApprovalDialog')?.__smsItem;
    originalClose(status);
    const result=({skipped:'이번 문자 건너뜀','sent-aligo':'알리고 발송 완료','opened-phone':'문자앱 열기 완료','no-phone':'연락처 없음'})[status]||status;
    setRuntime(`${eventTitle(item?.kind)} · ${result}`,eventTitle(item?.kind));renderStatus();
  };

  function install(){
    ensureRuntime();
    const label=byId('buildStageLabel');if(label){label.textContent='230MATCH 35.2 · 자동 문자 승인·발송 흐름 완성';label.title='Version 35.2.0';}
    document.documentElement.dataset.build='3520';
    autoSmsSnapshot=buildAutoSmsSnapshot();
    renderStatus();
    console.info('[230MATCH V3] 35.2.1 ready · simplified SMS settings and short Aligo templates active');
  }
  const oldCommit3520=commit;commit=function(message){const r=oldCommit3520(message);setTimeout(renderStatus,0);return r;};
  window.addEventListener('hashchange',()=>setTimeout(renderStatus,50));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else setTimeout(install,0);
})();


/* Stage 35.2.2 · draggable admin status + compact assignment print + bracket tree print */
(function stage3522Enhancements(){
  function makeAdminStatusDraggable(){
    const root=document.getElementById('adminActionCenter3443'),head=root?.querySelector('.aac-head');
    if(!root||!head||root.dataset.draggable3522==='1')return;
    root.dataset.draggable3522='1';head.classList.add('aac-drag-handle');head.title='이 부분을 잡고 상태창을 이동할 수 있습니다.';
    const key='230match-admin-action-center-position';
    const clamp=(x,y)=>({x:Math.max(6,Math.min(x,window.innerWidth-root.offsetWidth-6)),y:Math.max(6,Math.min(y,window.innerHeight-root.offsetHeight-6))});
    try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)){const p=clamp(saved.x,saved.y);root.style.left=p.x+'px';root.style.top=p.y+'px';root.style.right='auto';root.style.bottom='auto';}}catch(_e){}
    let drag=null;
    head.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;const r=root.getBoundingClientRect();drag={dx:e.clientX-r.left,dy:e.clientY-r.top};head.setPointerCapture?.(e.pointerId);root.classList.add('dragging');e.preventDefault();});
    head.addEventListener('pointermove',e=>{if(!drag)return;const p=clamp(e.clientX-drag.dx,e.clientY-drag.dy);root.style.left=p.x+'px';root.style.top=p.y+'px';root.style.right='auto';root.style.bottom='auto';});
    const stop=e=>{if(!drag)return;drag=null;root.classList.remove('dragging');const r=root.getBoundingClientRect();localStorage.setItem(key,JSON.stringify({x:Math.round(r.left),y:Math.round(r.top)}));try{head.releasePointerCapture?.(e.pointerId);}catch(_e){}};
    head.addEventListener('pointerup',stop);head.addEventListener('pointercancel',stop);
    window.addEventListener('resize',()=>{if(root.style.left){const r=root.getBoundingClientRect(),p=clamp(r.left,r.top);root.style.left=p.x+'px';root.style.top=p.y+'px';}});
  }
  const style=document.createElement('style');style.textContent=`
    .aac-drag-handle{cursor:move;touch-action:none;user-select:none}.admin-action-center-3443.dragging{opacity:.92;box-shadow:0 18px 46px rgba(15,42,79,.32)}
    .assignment-print-sheet{padding:8mm}.assignment-summary{display:flex;justify-content:space-between;gap:12px;margin:0 0 7px;padding:6px 8px;background:#edf4ff;border:1px solid #a8bdd9;border-radius:6px}.assignment-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.assignment-group-card{break-inside:avoid;border:1px solid #7f93ad;border-radius:5px;overflow:hidden;background:#fff}.assignment-group-head{display:flex;justify-content:space-between;gap:6px;padding:4px 6px;background:#163b70;color:#fff}.assignment-group-head b{font-size:1.05em}.assignment-group-head span{font-weight:800}.assignment-group-card ol{list-style:none;padding:3px 6px;margin:0;display:grid;gap:1px}.assignment-group-card li{display:grid;grid-template-columns:16px minmax(0,1fr) auto;gap:4px;align-items:center;min-height:18px;border-bottom:1px dotted #cad3df}.assignment-group-card li:last-child{border-bottom:0}.assignment-group-card li em{display:grid;place-items:center;width:14px;height:14px;border-radius:50%;background:#e6edf7;font-style:normal;font-weight:900}.assignment-group-card li strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.assignment-group-card li small{max-width:72px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#59687d}.assignment-order{display:grid;grid-template-columns:1fr;gap:1px;padding:3px 6px;border-top:1px solid #bcc8d7;background:#f7f9fc;font-size:.78em;color:#3d4d63}.assignment-order span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bracket-tree-print-sheet{padding:7mm}.bracket-print-note{margin:0 0 6px;padding:5px 8px;border:1px solid #b8c7da;background:#f4f7fb;border-radius:5px;color:#44536a}.bracket-print-wrap{width:100%;overflow:visible}.bracket-print-svg{display:block;width:100%;height:auto;overflow:visible}.bp-round-title{font-size:13px;font-weight:900;fill:#17365f}.bp-match rect{fill:#fff;stroke:#7589a5;stroke-width:1}.bp-match line{stroke:#a5b3c5;stroke-width:1}.bp-match text{font-size:10px;font-weight:700;fill:#111827}.bp-match.completed rect{fill:#f1faf5;stroke:#3a8b62}.bp-match.playing rect{fill:#fff2ef;stroke:#d8493e}.bp-score{font-size:8px!important;fill:#46566c!important}.bp-link{fill:none;stroke:#7387a1;stroke-width:1.2}
    @media(max-width:900px){.assignment-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media print{.assignment-print-sheet{padding:6mm!important}.assignment-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:3mm!important}.assignment-group-card{break-inside:avoid!important}.bracket-tree-print-sheet{padding:5mm!important}.bracket-print-svg{width:100%!important;max-width:none!important}.aac-drag-handle{cursor:default}}
  `;document.head.appendChild(style);
  const run=()=>{makeAdminStatusDraggable();const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 35.2.2 · 이동식 상태창·조편성 코트배정표·가지형 대진표 출력';label.title='Version 35.2.2';}};
  window.addEventListener('load',()=>setTimeout(run,300));setTimeout(run,1200);
  console.info('[230MATCH V3] 35.2.2 ready · draggable admin status and print upgrades active');
})();


/* Stage 35.2.3 · print image export fix + 3-column assignment layout + cleaner bracket tree */
(function stage3523PrintPolish(){
  function stripClubText(value){return String(value||'').replace(/\([^)]*\)/g,'').replace(/\[[^\]]*\]/g,'').replace(/\s+/g,' ').trim();}
  function shortNamePart(part,maxLen){const clean=stripClubText(part).replace(/^[0-9]+[.)\s-]*/,'').trim();return (clean||'미정').slice(0,maxLen);}
  function resolvePrintTeamValue(value){
    if(value==null)return null;
    if(typeof value==='object')return value;
    const key=String(value).trim();
    if(!key)return null;
    const found=(state.teams||[]).find(t=>String(t.id)===key||String(t.teamId||'')===key||String(t.name||'')===key||String(t.teamName||'')===key);
    return found||key;
  }
  function compactTeam(value,maxLen=3){
    const resolved=resolvePrintTeamValue(value);
    if(resolved&&typeof resolved==='object'){
      const players=[...(Array.isArray(resolved.players)?resolved.players:[]),...(Array.isArray(resolved.individualPlayers)?resolved.individualPlayers:[])];
      const names=players.map(p=>typeof p==='string'?p:(p?.name||p?.displayName||'')).filter(Boolean).slice(0,2);
      if(names.length)return names.map(name=>shortNamePart(name,maxLen)).join(' / ');
      const direct=[resolved.player1,resolved.player2,resolved.p1,resolved.p2].map(p=>typeof p==='string'?p:(p?.name||p?.displayName||'')).filter(Boolean);
      if(direct.length)return direct.slice(0,2).map(name=>shortNamePart(name,maxLen)).join(' / ');
    }
    const raw=(typeof printTeam==='function'?printTeam(resolved):String(resolved||'미정'))||'미정';
    const cleaned=stripClubText(raw);
    return cleaned.split(/\s*\/\s*/).filter(Boolean).slice(0,2).map(part=>shortNamePart(part,maxLen)).join(' / ')||'미정';
  }
  function plainTeam(value){
    const resolved=resolvePrintTeamValue(value);
    const raw=(typeof printTeam==='function'?printTeam(resolved):String(resolved||'미정'))||'미정';
    return raw.split('/').map(part=>stripClubText(part)||'미정').join(' / ');
  }
  function drawRoundLabel(size){return size===2?'결승':size===4?'준결승':`${size}강`;}
  function ensureSvgXml(markup){return markup.includes('xmlns=')?markup:markup.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ');}
  function saveBlobDownload(blob,filename){
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=filename;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1200);
  }
  function svgMarkupToPng(markup,width,height,filename){
    return new Promise((resolve,reject)=>{
      const svg=ensureSvgXml(markup);
      const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
      const img=new Image();
      img.onload=()=>{
        try{
          const maxW=3200;
          const scale=Math.max(1,Math.min(2,maxW/Math.max(1,width)));
          const canvas=document.createElement('canvas');
          canvas.width=Math.round(width*scale);
          canvas.height=Math.round(height*scale);
          const ctx=canvas.getContext('2d');
          ctx.scale(scale,scale);
          ctx.fillStyle='#ffffff';
          ctx.fillRect(0,0,width,height);
          ctx.drawImage(img,0,0,width,height);
          URL.revokeObjectURL(url);
          canvas.toBlob(blob=>{
            if(!blob){reject(new Error('PNG blob 생성 실패'));return;}
            saveBlobDownload(blob,filename);resolve();
          },'image/png');
        }catch(error){URL.revokeObjectURL(url);reject(error);}
      };
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('SVG 이미지를 불러오지 못했습니다.'));};
      img.src=url;
    });
  }
  function assignmentCardsData(){
    const groups=state.prelim?.groups||[],matches=state.prelim?.matches||[];
    return groups.map((g,idx)=>{
      const rawTeams=(Array.isArray(g.teams)&&g.teams.length?g.teams:g.teamIds)||[];
      const teams=rawTeams.map(resolvePrintTeamValue).filter(Boolean);
      const gm=matches.filter(m=>m.groupId===g.id).sort((a,b)=>(a.matchNo||0)-(b.matchNo||0));
      const court=g.court||g.courtName||gm[0]?.court||gm[0]?.courtName||gm[0]?.assignedCourtName||((state.prelim?.courts||[]).find(c=>c.id===(g.prelimCourtId||gm[0]?.prelimCourtId))?.name)||'코트 미정';
      const teamKey=t=>String(t?.id||t?.teamId||t?.name||t?.teamName||t||'');
      const teamNo=value=>{const resolved=resolvePrintTeamValue(value),key=teamKey(resolved);const n=teams.findIndex(t=>teamKey(t)===key);return n>=0?n+1:'?';};
      return {
        name:g.name||`${idx+1}조`,
        court,
        teams:teams.map((t,i)=>({order:i+1,label:compactTeam(t,3)})),
        orders:gm.map((m,i)=>`${i+1}경기 ${teamNo(m.teamA)}번 vs ${teamNo(m.teamB)}번`)
      };
    });
  }
  function buildAssignmentPngSvg(){
    const cards=assignmentCardsData();
    const tournament=state.tournament||{},guide=state.portal?.guide||{};
    const cols=3,gap=22,pageW=1500,pad=34,headH=104,summaryH=42,cardW=Math.floor((pageW-pad*2-gap*(cols-1))/cols);
    const cardHeights=cards.map(card=>112+card.teams.length*34+card.orders.length*26);
    let y=pad+headH+summaryH,rowMax=0,x=pad,col=0;
    const placed=[];
    cards.forEach((card,idx)=>{
      const h=cardHeights[idx];
      if(col===cols){col=0;x=pad;y+=rowMax+gap;rowMax=0;}
      placed.push({...card,x,y,w:cardW,h});
      rowMax=Math.max(rowMax,h);col+=1;x+=cardW+gap;
    });
    const totalH=y+rowMax+pad;
    const esc=printEscape;
    const cardSvg=placed.map(card=>{
      const teams=card.teams.map((team,i)=>{
        const yy=card.y+54+i*32;
        return `<g><text x="${card.x+18}" y="${yy+13}" font-size="17" font-weight="900" fill="#16365b">${team.order}</text><text x="${card.x+48}" y="${yy+13}" font-size="19" font-weight="800" fill="#0f172a">${esc(team.label)}</text><line x1="${card.x+14}" y1="${yy+21}" x2="${card.x+card.w-14}" y2="${yy+21}" stroke="#d8e2ef" stroke-dasharray="3 3"/></g>`;
      }).join('');
      const baseOrderY=card.y+60+card.teams.length*32;
      const orders=card.orders.map((line,i)=>`<text x="${card.x+16}" y="${baseOrderY+i*22}" font-size="15" fill="#4b5f79">${esc(line)}</text>`).join('');
      return `<g>
        <rect x="${card.x}" y="${card.y}" width="${card.w}" height="${card.h}" rx="12" fill="#ffffff" stroke="#91a7c6" stroke-width="1.5"/>
        <rect x="${card.x}" y="${card.y}" width="${card.w}" height="34" rx="12" fill="#183a70"/>
        <rect x="${card.x}" y="${card.y+18}" width="${card.w}" height="16" fill="#183a70"/>
        <text x="${card.x+16}" y="${card.y+23}" font-size="19" font-weight="900" fill="#ffffff">${esc(card.name)}</text>
        <text x="${card.x+card.w-16}" y="${card.y+23}" text-anchor="end" font-size="18" font-weight="800" fill="#dbeafe">${esc(card.court)}</text>
        ${teams}
        <rect x="${card.x+1}" y="${baseOrderY-16}" width="${card.w-2}" height="${Math.max(28,card.h-(baseOrderY-card.y)-10)}" rx="0" fill="#f7fbff" stroke="#d8e2ef"/>
        ${orders}
      </g>`;
    }).join('');
    const meta = `${guide.date?`대회일 ${guide.date}`:''}${guide.venue?` · ${guide.venue}`:''}`.trim() || '본인 조와 배정 코트를 확인해 주세요.';
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}" height="${totalH}" viewBox="0 0 ${pageW} ${totalH}">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="${pageW/2}" y="42" text-anchor="middle" font-size="34" font-weight="900" fill="#10264a">시합 전 조편성·코트 배정표</text>
      <text x="${pageW/2}" y="70" text-anchor="middle" font-size="18" fill="#52657d">${esc(tournament.name||'230MATCH 대회')} ${tournament.division?`· ${esc(tournament.division)}`:''}</text>
      <rect x="${pad}" y="${pad+78}" width="${pageW-pad*2}" height="34" rx="10" fill="#edf4ff" stroke="#a8bdd9"/>
      <text x="${pad+16}" y="${pad+100}" font-size="18" font-weight="900" fill="#183a70">${cards.length}개 조 · ${(state.teams||[]).length}팀</text>
      <text x="${pageW-pad-16}" y="${pad+100}" text-anchor="end" font-size="16" fill="#52657d">${esc(meta)}</text>
      ${cardSvg}
    </svg>`;
    return {svg,width:pageW,height:totalH};
  }
  function getPreviewBracketSvg(){
    const svg=document.querySelector('#printPreview .bracket-print-svg');
    return svg?svg.outerHTML:null;
  }
  function getSvgSize(svgMarkup){
    const viewBox=(svgMarkup.match(/viewBox="([^"]+)"/)||[])[1];
    if(viewBox){const parts=viewBox.trim().split(/\s+/).map(Number);if(parts.length===4)return {width:parts[2],height:parts[3]};}
    const width=Number((svgMarkup.match(/width="([0-9.]+)"/)||[])[1]||1600);
    const height=Number((svgMarkup.match(/height="([0-9.]+)"/)||[])[1]||1000);
    return {width,height};
  }
  printPrelimAssignmentHtml = window.printPrelimAssignmentHtml = function(){
    const cards=assignmentCardsData();
    if(!cards.length)return printHeader('시합 전 조편성·코트 배정표')+'<div class="print-empty">생성된 예선 조편성이 없습니다.</div>';
    const html=cards.map(card=>`<article class="assignment-group-card"><div class="assignment-group-head"><b>${printEscape(card.name)}</b><span>${printEscape(card.court)}</span></div><ol>${card.teams.map(team=>`<li><em>${team.order}</em><strong title="${printEscape(team.label)}">${printEscape(team.label)}</strong></li>`).join('')}</ol><div class="assignment-order">${card.orders.map(line=>`<span>${printEscape(line)}</span>`).join('')}</div></article>`).join('');
    return printHeader('시합 전 조편성·코트 배정표')+`<div class="assignment-summary"><b>${cards.length}개 조 · ${(state.teams||[]).length}팀</b><span>본인 조와 배정 코트를 확인해 주세요.</span></div><div class="assignment-grid compact-3col">${html}</div>`;
  };
  printBracketHtml = window.printBracketHtml = function(){
    const draw=state.draw;
    if(!draw?.rounds||!draw?.size)return printHeader('본선 가지형 대진표')+'<div class="print-empty">생성된 본선 대진표가 없습니다.</div>';
    const sizes=Object.keys(draw.rounds).map(Number).filter(Boolean).sort((a,b)=>b-a);
    if(!sizes.length)return printHeader('본선 가지형 대진표')+'<div class="print-empty">생성된 본선 대진표가 없습니다.</div>';
    const nodeW=170,nodeH=46,colGap=54,baseGap=60,padX=18,padY=42;
    const firstCount=(draw.rounds[sizes[0]]||[]).length;
    const width=padX*2+sizes.length*nodeW+(sizes.length-1)*colGap;
    const height=Math.max(320,padY*2+firstCount*baseGap);
    const positions=new Map(),parts=[];
    const roundColors=['#dbeafe','#e8f7e8','#fff4d6','#ffe7df','#ede9fe','#d9f2ef'];
    sizes.forEach((size,ri)=>{
      const round=draw.rounds[size]||[],step=baseGap*Math.pow(2,ri),x=padX+ri*(nodeW+colGap),bg=roundColors[ri%roundColors.length];
      parts.push(`<g><rect x="${x+32}" y="6" width="${nodeW-64}" height="24" rx="12" fill="${bg}" stroke="#a7b8cf"/><text class="bp-round-title" x="${x+nodeW/2}" y="22" text-anchor="middle">${drawRoundLabel(size)}</text></g>`);
      round.forEach((m,i)=>{
        const y=padY+(i+.5)*step-nodeH/2;positions.set(m.id,{x,y,cx:x+nodeW,cy:y+nodeH/2});
        const matchLabel=`${i+1}경기`;
        const stateLabel=m.status==='completed'?'경기 완료':(m.status==='playing'?'시합중':m.courtName||m.court||'대진 대기');
        parts.push(`<g class="bp-match ${m.status||''}"><rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="10"/><text class="bp-match-no" x="${x+12}" y="${y+19}">${matchLabel}</text><text class="bp-match-state" x="${x+12}" y="${y+38}">${printEscape(stateLabel)}</text></g>`);
      });
    });
    sizes.forEach((size,ri)=>{if(ri===sizes.length-1)return;(draw.rounds[size]||[]).forEach(m=>{const from=positions.get(m.id),to=positions.get(m.nextMatchId);if(!from||!to)return;const mid=from.cx+colGap/2;parts.push(`<path class="bp-link" d="M ${from.cx} ${from.cy} H ${mid} V ${to.cy} H ${to.x}"/>`);});});
    return printHeader('본선 가지형 대진표')+`<div class="bracket-print-note">본선 전체 가지형 대진표입니다. 팀명 없이 경기 슬롯과 진행 상태만 표시됩니다.</div><div class="bracket-print-wrap"><svg class="bracket-print-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="본선 전체 가지형 대진표">${parts.join('')}</svg></div>`;
  };
  async function savePrintPng3523(){
    const doc=buildPrintDocument();
    const date=new Date().toISOString().slice(0,10);
    if(doc.target==='prelim-assignment'){
      const asset=buildAssignmentPngSvg();
      await svgMarkupToPng(asset.svg,asset.width,asset.height,`230MATCH_${doc.label.replace(/\s+/g,'_')}_${date}.png`);
      notice('조편성·코트 배정표 PNG 이미지를 저장했습니다.','success');
      return;
    }
    if(doc.target==='bracket'){
      renderPrintPreview();
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const svg=getPreviewBracketSvg();
      if(!svg)throw new Error('가지형 대진표 SVG를 찾지 못했습니다.');
      const size=getSvgSize(svg);
      await svgMarkupToPng(svg,size.width,size.height,`230MATCH_${doc.label.replace(/\s+/g,'_')}_${date}.png`);
      notice('본선 가지형 대진표 PNG 이미지를 저장했습니다.','success');
      return;
    }
    return savePrintPng();
  }
  function interceptSaveButton(){
    const btn=document.getElementById('savePrintImageBtn');
    if(!btn||btn.dataset.stage3523Bound==='1')return;
    btn.dataset.stage3523Bound='1';
    btn.addEventListener('click',async e=>{
      const target=document.getElementById('printTargetSelect')?.value;
      if(target!=='prelim-assignment'&&target!=='bracket')return;
      e.preventDefault();e.stopImmediatePropagation();
      try{await savePrintPng3523();}
      catch(error){console.error(error);notice(error?.message||'PNG 저장 중 오류가 발생했습니다.','error');logAdminAction?.('시스템 오류',error?.message||String(error),'error');}
    },true);
  }
  const style=document.createElement('style');
  style.textContent=`
    .assignment-print-sheet{padding:7mm}
    .assignment-summary{display:flex;justify-content:space-between;gap:12px;margin:0 0 8px;padding:7px 10px;background:#edf4ff;border:1px solid #a8bdd9;border-radius:8px}
    .assignment-grid.compact-3col{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .assignment-group-card{break-inside:avoid;border:1px solid #8fa5c5;border-radius:8px;overflow:hidden;background:#fff;box-shadow:0 1px 0 rgba(15,23,42,.04)}
    .assignment-group-head{display:flex;justify-content:space-between;gap:8px;padding:6px 8px;background:#173b70;color:#fff}
    .assignment-group-head b,.assignment-group-head span{font-size:1.02em;font-weight:900}
    .assignment-group-card ol{list-style:none;padding:4px 8px 2px;margin:0;display:grid;gap:1px}
    .assignment-group-card li{display:grid;grid-template-columns:18px minmax(0,1fr);gap:6px;align-items:center;min-height:22px;border-bottom:1px dotted #d7dfeb}
    .assignment-group-card li:last-child{border-bottom:0}
    .assignment-group-card li em{display:grid;place-items:center;width:17px;height:17px;border-radius:50%;background:#e8eef8;color:#16365b;font-style:normal;font-weight:900;font-size:.9em}
    .assignment-group-card li strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.02em}
    .assignment-order{display:grid;gap:2px;padding:5px 8px 6px;border-top:1px solid #d6dfeb;background:#f7fbff;font-size:.8em;color:#42546b}
    .assignment-order span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bracket-tree-print-sheet{padding:6mm}
    .bracket-print-note{margin:0 0 8px;padding:6px 10px;border:1px solid #c3d0e2;background:linear-gradient(180deg,#f7fbff,#edf4ff);border-radius:8px;color:#44536a}
    .bracket-print-wrap{width:100%;overflow:visible}
    .bracket-print-svg{display:block;width:100%;height:auto;overflow:visible}
    .bp-round-title{font-size:12px;font-weight:900;fill:#16365b}
    .bp-match rect{fill:#e7effb;stroke:#0b2f63;stroke-width:2.6}
    .bp-match line{stroke:#7890b0;stroke-width:1.4}
    .bp-match text{font-size:10px;font-weight:900;fill:#10264a}.bp-match-no{font-size:11px!important}.bp-match-state{font-size:9px!important;fill:#334e73!important}
    .bp-match.completed rect{fill:#ccefd9;stroke:#096b3e;stroke-width:2.8}
    .bp-match.playing rect{fill:#ffd7cc;stroke:#a9251c;stroke-width:2.8}
    .bp-score{font-size:8px!important;fill:#4c617a!important}
    .bp-link{fill:none;stroke:#0b2f63;stroke-width:2.8}
    @media(max-width:900px){.assignment-grid.compact-3col{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media print{.assignment-print-sheet{padding:6mm!important}.assignment-grid.compact-3col{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:3.2mm!important}.assignment-group-card{break-inside:avoid!important}.bracket-tree-print-sheet{padding:5mm!important}.bracket-print-svg{width:100%!important;max-width:none!important}}
  `;
  document.head.appendChild(style);
  const run=()=>{interceptSaveButton();const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 35.2.5 · 조편성 이름 3글자 고정·대진표 선명화';label.title='Version 35.2.5';}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,0),{once:true});else setTimeout(run,0);
  window.addEventListener('load',()=>setTimeout(run,400));
  console.info('[230MATCH V3] 35.2.5 ready · fixed three-character player names and darker bracket tree active');
})();


/* Stage 35.2.6 · restore visible history, participant records and global archives */
(function stage3526RestoreHistoryAndRecords(){
  function clone(value){try{return structuredClone(value);}catch(_e){return JSON.parse(JSON.stringify(value));}}
  function archiveKey(item,type){
    if(!item)return '';
    if(item.id)return `${type}:id:${item.id}`;
    return `${type}:${item.sourceTournamentId||''}|${item.name||''}|${item.division||''}|${item.date||item.archivedAt||''}`;
  }
  function mergeUnique(rows,type){
    const out=[],seen=new Set();
    (rows||[]).forEach(item=>{const key=archiveKey(item,type);if(!key||seen.has(key))return;seen.add(key);out.push(item);});
    return out;
  }
  function collectArchivesFromAllDivisions(){
    ensurePortalState();
    const tournamentRows=[...(state.portal.tournamentArchives||[])];
    const participantRows=[...(state.portal.participantArchives||[])];
    const resultRows=[...(state.portal.resultArchives||[])];
    (state.multiDivision?.divisions||[]).forEach(div=>{
      const portal=div?.snapshot?.portal||{};
      tournamentRows.push(...(Array.isArray(portal.tournamentArchives)?portal.tournamentArchives:[]));
      participantRows.push(...(Array.isArray(portal.participantArchives)?portal.participantArchives:[]));
      resultRows.push(...(Array.isArray(portal.resultArchives)?portal.resultArchives:[]));
    });
    const nextTournament=mergeUnique(tournamentRows,'tournament');
    const nextParticipant=mergeUnique(participantRows,'participant');
    const nextResult=mergeUnique(resultRows,'result');
    const changed=JSON.stringify(state.portal.tournamentArchives)!==JSON.stringify(nextTournament)
      ||JSON.stringify(state.portal.participantArchives)!==JSON.stringify(nextParticipant)
      ||JSON.stringify(state.portal.resultArchives)!==JSON.stringify(nextResult);
    state.portal.tournamentArchives=nextTournament;
    state.portal.participantArchives=nextParticipant;
    state.portal.resultArchives=nextResult;
    return changed;
  }
  const baseApplyDivisionSnapshot3526=applyDivisionSnapshot;
  applyDivisionSnapshot=function(record){
    ensurePortalState();
    const globalArchives={
      tournamentArchives:clone(state.portal.tournamentArchives||[]),
      participantArchives:clone(state.portal.participantArchives||[]),
      resultArchives:clone(state.portal.resultArchives||[])
    };
    const ok=baseApplyDivisionSnapshot3526(record);
    if(ok){
      ensurePortalState();
      state.portal.tournamentArchives=mergeUnique([...globalArchives.tournamentArchives,...(state.portal.tournamentArchives||[])],'tournament');
      state.portal.participantArchives=mergeUnique([...globalArchives.participantArchives,...(state.portal.participantArchives||[])],'participant');
      state.portal.resultArchives=mergeUnique([...globalArchives.resultArchives,...(state.portal.resultArchives||[])],'result');
    }
    return ok;
  };

  const basePublicParticipantRows3526=publicParticipantRows;
  publicParticipantRows=function(){
    const current=(state.teams||[]).flatMap((team,index)=>participantRecordPlayers(team).map((player,playerIndex)=>({
      team,index,player,playerIndex,status:participantRecordStatus(team,index),contact:getTeamContact?.(state,team)||null,archiveName:'',archivedAt:''
    })));
    const archived=basePublicParticipantRows3526();
    const seen=new Set();
    return [...current,...archived].filter(row=>{
      const key=`${row.archiveName||'current'}|${row.player}|${row.team?.name||''}`;
      if(seen.has(key))return false;seen.add(key);return true;
    });
  };

  function restoreDesktopRecordMenu(){
    const nav=document.querySelector('.mode-tabs');if(!nav)return;
    const details=nav.querySelector('.stage329-menu-more');
    const buttons={};
    [...nav.querySelectorAll('[data-view]')].forEach(btn=>buttons[btn.dataset.view]=btn);
    if(details){
      ['board','records','participants','print'].forEach(view=>{const btn=buttons[view];if(btn){btn.hidden=false;nav.insertBefore(btn,details);}});
      details.remove();
    }
    const labels={records:'대회 기록',participants:'선수 기록',print:'출력 센터',board:'공지사항'};
    Object.entries(labels).forEach(([view,label])=>{const btn=buttons[view];if(btn){btn.textContent=label;btn.hidden=false;btn.classList.remove('settings-managed-tab');}});
    nav.classList.add('stage3526-visible-record-menu');
  }
  function addHistoryShortcuts(){
    const listHead=document.querySelector('#view-tournaments .section-head');
    if(listHead&&!listHead.querySelector('[data-stage3526-records]')){
      const row=listHead.querySelector('.button-row')||listHead.lastElementChild;
      const b=document.createElement('button');b.type='button';b.className='btn btn-light';b.dataset.stage3526Records='1';b.textContent='지난 대회 결과';b.addEventListener('click',()=>navigatePortalView('records',{pushHistory:true}));row?.appendChild(b);
      const p=document.createElement('button');p.type='button';p.className='btn btn-light';p.dataset.stage3526Participants='1';p.textContent='선수 기록';p.addEventListener('click',()=>navigatePortalView('participants',{pushHistory:true}));row?.appendChild(p);
    }
  }
  function refreshAllHistoryViews(){
    renderTournamentList?.();renderResultArchive?.();renderPublicParticipantRecords?.();
  }
  function run(){
    const migrated=collectArchivesFromAllDivisions();
    restoreDesktopRecordMenu();addHistoryShortcuts();refreshAllHistoryViews();
    if(migrated){try{saveState(state);}catch(_e){};notice('부서별로 흩어져 있던 지난 대회·선수·결과 기록을 다시 모았습니다.','success');}
    const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 35.2.6 · 지난 대회·선수 기록 복원';label.title='Version 35.2.6';}
  }
  const style=document.createElement('style');style.textContent=`
    .stage3526-visible-record-menu{display:flex!important;align-items:center!important;gap:5px!important;overflow-x:auto!important;white-space:nowrap!important}
    .stage3526-visible-record-menu>.tab{display:inline-flex!important;flex:0 0 auto!important;min-width:max-content!important}
    .stage3526-visible-record-menu .stage329-menu-group{display:contents!important}
    .stage3526-visible-record-menu .stage329-menu-label{display:none!important}
    .stage3526-visible-record-menu .stage329-menu-buttons{display:contents!important}
  `;document.head.appendChild(style);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,50),{once:true});else setTimeout(run,50);
  window.addEventListener('load',()=>setTimeout(run,500));
  window.addEventListener('hashchange',()=>setTimeout(()=>{restoreDesktopRecordMenu();addHistoryShortcuts();},80));
  console.info('[230MATCH V3] 35.2.6 ready · history and participant records restored');
})();


/* Stage 35.2.7 · archive preservation and recovery salvage */
(function stage3527ArchiveRecovery(){
  function clone(v){try{return structuredClone(v);}catch(_e){return JSON.parse(JSON.stringify(v));}}
  function keyOf(item,type){
    if(!item)return '';
    if(item.id)return `${type}:id:${item.id}`;
    return `${type}:${item.sourceTournamentId||''}|${item.name||''}|${item.division||''}|${item.date||item.archivedAt||''}`;
  }
  function merge(rows,type){const out=[],seen=new Set();for(const item of rows||[]){const k=keyOf(item,type);if(!k||seen.has(k))continue;seen.add(k);out.push(item);}return out;}
  function allPortalsFrom(snapshot){
    const out=[];
    if(snapshot?.portal)out.push(snapshot.portal);
    for(const div of snapshot?.multiDivision?.divisions||[])if(div?.snapshot?.portal)out.push(div.snapshot.portal);
    return out;
  }
  function teamLabel(team){
    if(!team)return '';
    if(typeof team==='string')return team;
    return team.name||team.teamName||team.label||'';
  }
  function loser(match){
    if(!match?.winner)return null;
    const w=String(match.winner?.id||match.winner?.teamId||teamLabel(match.winner));
    const a=String(match.teamA?.id||match.teamA?.teamId||teamLabel(match.teamA));
    return w===a?match.teamB:match.teamA;
  }
  function deriveCompletedArchive(s,createdAt){
    const name=String(s?.tournament?.name||'').trim();
    if(!name||name==='대회 준비 중'||name.includes('테스트'))return null;
    const rounds=s?.draw?.rounds||{};
    const final=(rounds[2]||[])[0]||null,semis=rounds[4]||[];
    const champion=teamLabel(s?.operation?.champion||final?.winner);
    const runnerUp=final?.status==='completed'?teamLabel(loser(final)):'';
    const thirds=semis.filter(m=>m?.status==='completed').map(m=>teamLabel(loser(m))).filter(Boolean);
    const prelim=s?.prelim?.matches||[];
    const main=Object.values(rounds).flatMap(x=>Array.isArray(x)?x:[]);
    const completed=Boolean(s?.completion?.completedAt)||Boolean(champion)||main.some(m=>m?.status==='completed');
    if(!completed)return null;
    const guide=s?.portal?.guide||{};
    const teams=s?.teams||[];
    return {
      id:`recovered-${name.replace(/[^0-9A-Za-z가-힣]+/g,'-')}-${String(s?.tournament?.division||'division').replace(/[^0-9A-Za-z가-힣]+/g,'-')}`,
      name,division:s?.tournament?.division||'',date:guide.date||'',venue:guide.venue||'',fee:guide.fee||'',
      active:teams.filter(t=>t?.status!=='reserve').length,reserve:teams.filter(t=>t?.status==='reserve').length,
      status:'completed',champion,runnerUp,thirds:[...new Set(thirds)],
      prelimCompleted:prelim.filter(m=>m?.status==='completed').length,prelimTotal:prelim.length,
      mainCompleted:main.filter(m=>m?.status==='completed').length,mainTotal:main.length,
      teamNames:teams.map(teamLabel).filter(Boolean),archivedAt:s?.completion?.completedAt||createdAt||s?.updatedAt||new Date().toISOString(),
      recoveredFromLocalBackup:true
    };
  }
  async function salvageArchives({showNotice=true}={}){
    ensurePortalState();
    const before={t:(state.portal.tournamentArchives||[]).length,p:(state.portal.participantArchives||[]).length,r:(state.portal.resultArchives||[]).length};
    let tournaments=[...(state.portal.tournamentArchives||[])],participants=[...(state.portal.participantArchives||[])],results=[...(state.portal.resultArchives||[])];
    const collectState=(s,createdAt)=>{
      for(const portal of allPortalsFrom(s)){
        tournaments.push(...(portal.tournamentArchives||[]));participants.push(...(portal.participantArchives||[]));results.push(...(portal.resultArchives||[]));
      }
      const derived=deriveCompletedArchive(s,createdAt);
      if(derived){tournaments.push({...derived,current:false});results.push({...derived});participants.push({id:`participants-${derived.id}`,name:derived.name,division:derived.division,teamNames:derived.teamNames,teams:clone(s.teams||[]),archivedAt:derived.archivedAt,recoveredFromLocalBackup:true});}
    };
    collectState(state,state.updatedAt);
    const recoveries=await getRecoveries();
    for(const rec of recoveries||[])if(rec?.state)collectState(rec.state,rec.createdAt);
    state.portal.tournamentArchives=merge(tournaments,'tournament');
    state.portal.participantArchives=merge(participants,'participant');
    state.portal.resultArchives=merge(results,'result');
    const after={t:state.portal.tournamentArchives.length,p:state.portal.participantArchives.length,r:state.portal.resultArchives.length};
    const added=(after.t-before.t)+(after.p-before.p)+(after.r-before.r);
    if(added>0){saveState(state);renderTournamentList?.();renderResultArchive?.();renderPublicParticipantRecords?.();if(showNotice)notice(`로컬 복구점에서 지난 대회·결과·선수 기록 ${added}건을 복구했습니다.`,'success');}
    else if(showNotice)notice('추가로 복구할 지난 대회 기록을 찾지 못했습니다. 복구점 또는 전체 백업 파일을 확인해 주세요.','warning');
    return {added,before,after};
  }
  function addRecoveryButton(){
    const head=document.querySelector('#view-tournaments .section-head .button-row')||document.querySelector('#view-tournaments .section-head');
    if(!head||head.querySelector('[data-stage3527-recover]'))return;
    const btn=document.createElement('button');btn.type='button';btn.className='btn btn-light';btn.dataset.stage3527Recover='1';btn.textContent='지난 기록 복구 검사';btn.addEventListener('click',()=>salvageArchives({showNotice:true}));head.appendChild(btn);
  }
  async function run(){
    addRecoveryButton();
    await salvageArchives({showNotice:false});
    const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 35.2.7 · 지난 대회 기록 보존·복구';label.title='Version 35.2.7';}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,80),{once:true});else setTimeout(run,80);
  window.addEventListener('hashchange',()=>setTimeout(addRecoveryButton,80));
  console.info('[230MATCH V3] 35.2.7 ready · archive preservation and local recovery salvage active');
})();


/* Stage 35.2.8 · built-in Modern Cup archive restoration */
(function stage3528ModernCupArchiveRestore(){
  const MODERN_ID='modern-cup-2026-06-14-restored';
  const MODERN_TEAM_NAMES=["민양홍(용두산) / 정웅섭(용두산)","배근무(대암,중앙,모닝스타) / 안성우(중앙,모닝스타)","조덕용(개인) / 김대연(백운포)","송인준(신세계) / 이대은(신세계, 다대클럽)","이종호(모던) / 김경준(모던)","맹도영(불나비/통제영/청춘불패) / 김해솔(통제영)","이희영(창원성주/모닝스타/중앙/창단테) / 김동환(베이스라인/창단테)","박형준(개인) / 정윤영(나이스)","김동언(부산하나) / 이미정(부산하나)","엄재오(위아원) / 김성인(위아원/한결)","김경재(모던) / 강병수(모던)","김명욱(부산덕두) / 이철우(부산덕두)","하상봉(개인) / 공대환(청춘불패)","이국원(하모니) / 조찬걸(하모니)","홍성우(유곡하와이) / 박도건(유곡하와이)","박수조(나이스) / 김석환(나이스)","우지현(SN,라이징,수정) / 이덕균(SN, 인사이드)","이상봉(Ing/원샷/방토/장원/동심) / 김홍준(테릉촌/ing)","임태규(용원클럽) / 추양호(용원클럽)","강태우(대암,하모니(부산) / 김무경(대암)","김진우(하모니) / 박진성(개인)","우동석(베스트) / 하태동(부산/베스트)","조광식(모던) / 최진영(모던)","손범규(하모니) / 양우홍(하모니)","김윤환(장유클럽) / 이순보(테사모)","이동규(유곡하와이) / 임광복(유곡하와이)","강민성(APEX) / 김영근(APEX)","오경훈(창원어프로치,창단테,대원,러브올) / 주재헌(창원어프로치,천자봉)","양현철(부산/금화,에브리원,양산/천성) / 서창우(부산/금화)","김창준(부산/금화,에브리원) / 이인규(부산/금화)","박상배(ssr) / 나세용(ssr)","김겸탁(삼계) / 신창륜(하모니)","오세철(창원 성주) / 진형달(창원 봉곡)","황동환(개인) / 외1명(덕두)","이원빈(팀테빌) / 박정식(팀테빌)","이병혁(가야) / 이재경(가야)","성낙훈(덕두, 테나) / 오세인(덕두, 히트)","강홍섭(양정현대) / 정동식(신세계)","이영진(개인) / 조라온(효원)","김성민(애드) / 송주호(애드)","김원진(송사리) / 김정수(올리브)","서성호(베스트) / 박용찬(베스트)","김용수(덕두) / 외 1명(덕두)","곽태우(장복) / 고운(장복.라온)","김동기(늘푸른) / 문문식(늘푸른)","김희찬(능동) / 염철중(능동)","박재정(상정회/일밤) / 박이준(일밤/센)","홍주효(창원대암) / 강민수(창원대암)","채정용(룰루랄라) / 유태곤(룰루랄라)","송재원(월요) / 김태현(월요)","이진형(팀햄머/정우회) / 한송현(무천/정우회)","최윤제(부산N_B) / 최지웅(부산N_B)","정준식(위드) / 김두호(위드)","조정래(월성,용원,러브올) / 정규섭(UH)","조성호(동진주) / 한종우(동진주)","김남기(개인) / 김주열(수령)","배훈(부산수정) / 배만식(개인)","김유신(개인) / 김도형(백구)","김진우(양산천성) / 엄윤호(양산천성)","김병극(가음정클럽) / 박상경(가음정클럽)","김대환(ssr) / 조원혁(ssr)","문광준(창원 대원/더블폴트/더블지앤코) / 유승곤(창원 도계/Return Ace/더블지앤코)","반지훈(TAIM, V.I.P., A1) / 김치영(TAIM, MTC, V.I.P.)","김원진(테라, 연결) / 이봉신(대현, 연결)","김태훈(창원남산/몬스터벤져스) / 고종배(두일,정관TNT)","권세창(이기대 수예단) / 박명원(수예단 남대양)","이감재(금화) / 임준혁(무궁화)","국지윤(수령) / 김동현(수령)","김일용(제주남용) / 유재동(개인)","박원구(수정) / 정환석(수정)","김상영(부산베스트) / 조노연(부산베스트)","김동준(UT) / 구혁(UT)","강민관(테스티니) / 허재원(테스티니)","송경민(신세계) / 엄수관(신세계)","김보수(금블던,두아스) / 김홍일(금블던,두아스)","이재근(빕스클럽) / 박영욱(빕스클럽)","하상호(부산단테매,하모니(부산) / 강완근(하모니(부산)","한조희(에나) / 방대우(에나)","전창현(여명) / 전승용(월촌테우회)","심희철(천자봉) / 강성은(천자봉)","김남훈(개인) / 김연철(토요펠리스)","김성민(단디) / 진종현(단디)","김태우(대원클럽) / 유홍섭(대원클럽)","하형찬(개인) / 김남태(일송/부산)","최일현(개인) / 이경률(개인)","강동완(송사리(SSR) / 김윤호(송사리(SSR)","신민식(해단모) / 강백호(해단모)","서득빈(도담) / 이준석(포인트/서브앤발리)","김길온(김해불나비) / 김대훈(김해불나비)","장윤수(어울림) / 오세열(어울림)","김기환(울산 한라) / 이현진(울산한라)","서장원(테오) / 김의상(테오)","이동규(개인) / 강형빈(창원중앙)","이준식(영도/해송) / 강민수(영도 GF)","박규찬(에오스) / 박재형(에오스)","윤우진(개인) / 김판수(창원교육단지)"];
  const now='2026-06-15T00:00:00.000Z';
  function escId(v){return String(v||'').toLowerCase().replace(/[^a-z0-9가-힣]+/g,'-').replace(/^-+|-+$/g,'');}
  function ensureArrays(){
    if(!state.portal)state.portal={};
    for(const key of ['tournamentArchives','participantArchives','resultArchives','legacyTournamentSummaries'])if(!Array.isArray(state.portal[key]))state.portal[key]=[];
  }
  function hasModern(rows){return (rows||[]).some(x=>String(x?.id||'').includes('modern-cup-2026')||/모던클럽배/.test(String(x?.name||'')));}
  function restoreModernArchive(silent=false){
    ensureArrays();
    let changed=false;
    const tournament={
      id:`tournament-${MODERN_ID}`,current:false,
      name:'2026 제1회 모던클럽배 테니스대회',division:'영남권 지역신인부',
      date:'2026-06-14',venue:'장유 국제테니스장 · 장유중 · 원도심',fee:'팀당 60,000원',
      capacity:96,active:96,reserve:0,status:'completed',
      champion:'문광준 / 유승곤',runnerUp:'기록 확인 중',thirds:['기록 확인 중','기록 확인 중'],quarterfinals:[],
      prelimCompleted:96,prelimTotal:96,mainCompleted:95,mainTotal:95,
      archivedAt:now,updatedAt:now,sourceTournamentId:MODERN_ID,
      detail:'230MATCH 기록에서 복구한 제1회 모던클럽배 완료 대회입니다. 참가팀 96팀과 확인된 우승 기록을 보존했습니다.'
    };
    const result={
      id:`result-${MODERN_ID}`,name:tournament.name,division:tournament.division,archivedAt:now,
      champion:tournament.champion,runnerUp:tournament.runnerUp,thirds:[...tournament.thirds],quarterfinals:[],
      teamNames:[...MODERN_TEAM_NAMES],resultPhotos:[],sourceTournamentId:MODERN_ID,source:'built-in-recovery',
      prelimCompleted:96,prelimTotal:96,mainCompleted:95,mainTotal:95,
      note:'앱 개발 기록과 보존 명단에서 복구. 확인되지 않은 준우승·공동3위는 임의 입력하지 않았습니다.'
    };
    const participants={
      id:`participants-${MODERN_ID}`,tournamentId:tournament.id,sourceTournamentId:MODERN_ID,
      name:tournament.name,division:tournament.division,archivedAt:now,teamNames:[...MODERN_TEAM_NAMES]
    };
    if(!hasModern(state.portal.tournamentArchives)){state.portal.tournamentArchives.unshift(tournament);changed=true;}
    if(!hasModern(state.portal.resultArchives)){state.portal.resultArchives.unshift(result);changed=true;}
    if(!hasModern(state.portal.participantArchives)){state.portal.participantArchives.unshift(participants);changed=true;}
    if(!hasModern(state.portal.legacyTournamentSummaries)){state.portal.legacyTournamentSummaries.unshift(result);changed=true;}
    if(changed){
      state.updatedAt=new Date().toISOString();
      try{saveState(state);}catch(_e){}
      try{renderPortalViews();renderTournamentList();renderResultArchive();renderParticipantRecords?.();}catch(_e){}
      if(!silent){notice('제1회 모던클럽배 기록을 복구했습니다. 대회 목록·대회 기록·선수 기록에서 확인하세요.','success');logAdminAction?.('기록 복구','모던클럽배 참가팀 96팀과 확인된 우승 기록을 복구했습니다.','success');}
    }else if(!silent){notice('모던클럽배 기록이 이미 보관되어 있습니다.','info');}
    return changed;
  }
  function installButton(){
    const host=document.querySelector('.tournament-list-view .section-actions, #tournamentListView .section-actions, #tournamentListView .button-row');
    if(!host||document.getElementById('restoreModernCupArchiveBtn'))return;
    const btn=document.createElement('button');btn.id='restoreModernCupArchiveBtn';btn.type='button';btn.className='btn btn-primary';btn.textContent='모던배 기록 복구';
    btn.addEventListener('click',()=>restoreModernArchive(false));host.appendChild(btn);
  }
  const run=()=>{restoreModernArchive(true);installButton();const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 35.2.8 · 모던배 기록 내장 복구';label.title='Version 35.2.8';}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,300),{once:true});else setTimeout(run,300);
  window.addEventListener('hashchange',()=>setTimeout(installButton,100));
  window.restoreModernCupArchive3528=()=>restoreModernArchive(false);
  console.info('[230MATCH V3] 35.2.8 ready · built-in Modern Cup archive restoration active');
})();


/* Stage 35.2.9 · immutable built-in Modern Cup archive provider */
(function stage3529ImmutableModernArchive(){
  const MODERN_ID='modern-cup-2026-06-14-immutable';
  const MODERN_TEAM_NAMES=["민양홍(용두산) / 정웅섭(용두산)","배근무(대암,중앙,모닝스타) / 안성우(중앙,모닝스타)","조덕용(개인) / 김대연(백운포)","송인준(신세계) / 이대은(신세계, 다대클럽)","이종호(모던) / 김경준(모던)","맹도영(불나비/통제영/청춘불패) / 김해솔(통제영)","이희영(창원성주/모닝스타/중앙/창단테) / 김동환(베이스라인/창단테)","박형준(개인) / 정윤영(나이스)","김동언(부산하나) / 이미정(부산하나)","엄재오(위아원) / 김성인(위아원/한결)","김경재(모던) / 강병수(모던)","김명욱(부산덕두) / 이철우(부산덕두)","하상봉(개인) / 공대환(청춘불패)","이국원(하모니) / 조찬걸(하모니)","홍성우(유곡하와이) / 박도건(유곡하와이)","박수조(나이스) / 김석환(나이스)","우지현(SN,라이징,수정) / 이덕균(SN, 인사이드)","이상봉(Ing/원샷/방토/장원/동심) / 김홍준(테릉촌/ing)","임태규(용원클럽) / 추양호(용원클럽)","강태우(대암,하모니(부산) / 김무경(대암)","김진우(하모니) / 박진성(개인)","우동석(베스트) / 하태동(부산/베스트)","조광식(모던) / 최진영(모던)","손범규(하모니) / 양우홍(하모니)","김윤환(장유클럽) / 이순보(테사모)","이동규(유곡하와이) / 임광복(유곡하와이)","강민성(APEX) / 김영근(APEX)","오경훈(창원어프로치,창단테,대원,러브올) / 주재헌(창원어프로치,천자봉)","양현철(부산/금화,에브리원,양산/천성) / 서창우(부산/금화)","김창준(부산/금화,에브리원) / 이인규(부산/금화)","박상배(ssr) / 나세용(ssr)","김겸탁(삼계) / 신창륜(하모니)","오세철(창원 성주) / 진형달(창원 봉곡)","황동환(개인) / 외1명(덕두)","이원빈(팀테빌) / 박정식(팀테빌)","이병혁(가야) / 이재경(가야)","성낙훈(덕두, 테나) / 오세인(덕두, 히트)","강홍섭(양정현대) / 정동식(신세계)","이영진(개인) / 조라온(효원)","김성민(애드) / 송주호(애드)","김원진(송사리) / 김정수(올리브)","서성호(베스트) / 박용찬(베스트)","김용수(덕두) / 외 1명(덕두)","곽태우(장복) / 고운(장복.라온)","김동기(늘푸른) / 문문식(늘푸른)","김희찬(능동) / 염철중(능동)","박재정(상정회/일밤) / 박이준(일밤/센)","홍주효(창원대암) / 강민수(창원대암)","채정용(룰루랄라) / 유태곤(룰루랄라)","송재원(월요) / 김태현(월요)","이진형(팀햄머/정우회) / 한송현(무천/정우회)","최윤제(부산N_B) / 최지웅(부산N_B)","정준식(위드) / 김두호(위드)","조정래(월성,용원,러브올) / 정규섭(UH)","조성호(동진주) / 한종우(동진주)","김남기(개인) / 김주열(수령)","배훈(부산수정) / 배만식(개인)","김유신(개인) / 김도형(백구)","김진우(양산천성) / 엄윤호(양산천성)","김병극(가음정클럽) / 박상경(가음정클럽)","김대환(ssr) / 조원혁(ssr)","문광준(창원 대원/더블폴트/더블지앤코) / 유승곤(창원 도계/Return Ace/더블지앤코)","반지훈(TAIM, V.I.P., A1) / 김치영(TAIM, MTC, V.I.P.)","김원진(테라, 연결) / 이봉신(대현, 연결)","김태훈(창원남산/몬스터벤져스) / 고종배(두일,정관TNT)","권세창(이기대 수예단) / 박명원(수예단 남대양)","이감재(금화) / 임준혁(무궁화)","국지윤(수령) / 김동현(수령)","김일용(제주남용) / 유재동(개인)","박원구(수정) / 정환석(수정)","김상영(부산베스트) / 조노연(부산베스트)","김동준(UT) / 구혁(UT)","강민관(테스티니) / 허재원(테스티니)","송경민(신세계) / 엄수관(신세계)","김보수(금블던,두아스) / 김홍일(금블던,두아스)","이재근(빕스클럽) / 박영욱(빕스클럽)","하상호(부산단테매,하모니(부산) / 강완근(하모니(부산)","한조희(에나) / 방대우(에나)","전창현(여명) / 전승용(월촌테우회)","심희철(천자봉) / 강성은(천자봉)","김남훈(개인) / 김연철(토요펠리스)","김성민(단디) / 진종현(단디)","김태우(대원클럽) / 유홍섭(대원클럽)","하형찬(개인) / 김남태(일송/부산)","최일현(개인) / 이경률(개인)","강동완(송사리(SSR) / 김윤호(송사리(SSR)","신민식(해단모) / 강백호(해단모)","서득빈(도담) / 이준석(포인트/서브앤발리)","김길온(김해불나비) / 김대훈(김해불나비)","장윤수(어울림) / 오세열(어울림)","김기환(울산 한라) / 이현진(울산한라)","서장원(테오) / 김의상(테오)","이동규(개인) / 강형빈(창원중앙)","이준식(영도/해송) / 강민수(영도 GF)","박규찬(에오스) / 박재형(에오스)","윤우진(개인) / 김판수(창원교육단지)"];
  const archiveDate='2026-06-15T00:00:00.000Z';
  const modernTournament={
    id:`tournament-${MODERN_ID}`,current:false,
    name:'2026 제1회 모던클럽배 테니스대회',division:'영남권 지역신인부',
    date:'2026-06-14',venue:'장유 국제테니스장 · 장유중 · 원도심',fee:'팀당 60,000원',
    capacity:96,active:96,reserve:0,status:'completed',
    champion:'문광준 / 유승곤',runnerUp:'기록 확인 중',thirds:['기록 확인 중','기록 확인 중'],quarterfinals:[],
    prelimCompleted:96,prelimTotal:96,mainCompleted:95,mainTotal:95,
    archivedAt:archiveDate,updatedAt:archiveDate,sourceTournamentId:MODERN_ID,
    detail:'제1회 모던클럽배 보관 기록입니다. 참가팀 96팀과 확인된 우승 기록을 표시합니다.'
  };
  const modernResult={
    id:`result-${MODERN_ID}`,name:modernTournament.name,division:modernTournament.division,archivedAt:archiveDate,
    champion:modernTournament.champion,runnerUp:modernTournament.runnerUp,thirds:[...modernTournament.thirds],quarterfinals:[],
    teamNames:[...MODERN_TEAM_NAMES],resultPhotos:[],sourceTournamentId:MODERN_ID,source:'immutable-built-in',
    prelimCompleted:96,prelimTotal:96,mainCompleted:95,mainTotal:95,
    note:'앱 보관 명단에서 복구된 모던클럽배 기록입니다.'
  };
  const modernParticipants={
    id:`participants-${MODERN_ID}`,tournamentId:modernTournament.id,sourceTournamentId:MODERN_ID,
    name:modernTournament.name,division:modernTournament.division,archivedAt:archiveDate,teamNames:[...MODERN_TEAM_NAMES]
  };
  const isModern=x=>String(x?.id||'').includes('modern-cup-2026')||/모던클럽배/.test(String(x?.name||''));
  const appendModern=(rows,item)=>{const out=Array.isArray(rows)?[...rows]:[];if(!out.some(isModern))out.push(structuredClone(item));return out;};

  const originalTournamentArchiveRows=tournamentArchiveRows;
  tournamentArchiveRows=function(){return appendModern(originalTournamentArchiveRows(),modernTournament);};

  const originalResultArchiveRows=resultArchiveRows;
  resultArchiveRows=function(){return appendModern(originalResultArchiveRows(),modernResult).map(normalizeResultArchive);};

  const originalPublicParticipantRows=publicParticipantRows;
  publicParticipantRows=function(){
    const rows=originalPublicParticipantRows();
    if(rows.some(r=>/모던클럽배/.test(String(r?.archiveName||''))))return rows;
    const extra=MODERN_TEAM_NAMES.flatMap((name,index)=>{
      const team={id:`modern-archived-${index}`,name:String(name||''),affiliation:modernParticipants.name};
      return participantRecordPlayers(team).map((player,playerIndex)=>({team,index,player,playerIndex,status:'active',contact:null,archiveName:modernParticipants.name,archivedAt:archiveDate}));
    });
    return [...rows,...extra];
  };

  function persistCopy(){
    ensurePortalState();
    state.portal.tournamentArchives=appendModern(state.portal.tournamentArchives,modernTournament);
    state.portal.resultArchives=appendModern(state.portal.resultArchives,modernResult);
    state.portal.participantArchives=appendModern(state.portal.participantArchives,modernParticipants);
    try{saveState(state);}catch(_e){}
  }
  function installRestoreButton(){
    if(document.getElementById('restoreModernCupArchive3529Btn'))return;
    const candidates=[...document.querySelectorAll('button')];
    const anchor=candidates.find(b=>/지난 기록 복구 검사/.test(b.textContent||''))||document.getElementById('archiveTournamentBtn');
    const host=anchor?.parentElement||document.querySelector('#tournamentListView .button-row')||document.querySelector('[data-view="tournaments"] .button-row');
    if(!host)return;
    const btn=document.createElement('button');btn.id='restoreModernCupArchive3529Btn';btn.type='button';btn.className='btn btn-primary';btn.textContent='모던배 기록 복구';
    btn.addEventListener('click',()=>{persistCopy();renderTournamentList();renderResultArchive();renderPublicParticipantRecords();notice('모던클럽배 기록을 다시 표시했습니다.','success');});
    host.appendChild(btn);
  }
  function refreshVisibleViews(){
    try{renderTournamentList();}catch(_e){}
    try{renderResultArchive();}catch(_e){}
    try{renderPublicParticipantRecords();}catch(_e){}
    installRestoreButton();
  }
  function run(){
    persistCopy();
    refreshVisibleViews();
    const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 35.2.9 · 모던배 기록 강제 표시 복구';label.title='Version 35.2.9';}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,700),{once:true});else setTimeout(run,700);
  window.addEventListener('load',()=>setTimeout(run,1200));
  window.addEventListener('hashchange',()=>setTimeout(refreshVisibleViews,250));
  setTimeout(run,2500);
  window.restoreModernCupArchive3529=()=>{persistCopy();refreshVisibleViews();};
  console.info('[230MATCH V3] 35.2.9 ready · immutable Modern Cup archive provider active');
})();


/* Stage 35.3.0 · Modern Cup exact archive + legacy photo recovery */
(function stage3530ModernCupExactRestore(){
  const ID='modern-cup-2026-06-14-exact';
  const DATE='2026-06-14';
  const ARCHIVE_AT='2026-06-15T00:00:00.000Z';
  const champion='문광준 / 유승곤';
  const runnerUp='이희영 / 김동환';
  const thirds=['김기환 / 이현진','오경훈 / 주재헌'];
  const quarterfinals=[champion,runnerUp,...thirds,'강홍섭 / 정동식','맹도영 / 김해솔','박재정 / 박이준','황부근 / 송강영'];
  const TEAM_NAMES=(typeof MODERN_TEAM_NAMES!=='undefined'&&Array.isArray(MODERN_TEAM_NAMES))?MODERN_TEAM_NAMES:[];
  let recoveredPhotos=[
    {url:'./assets/images/modern-cup/champion.jpg',title:'우승 문광준·유승곤',body:'제1회 모던클럽배 우승'},
    {url:'./assets/images/modern-cup/runner-up.jpg',title:'준우승 이희영·김동환',body:'제1회 모던클럽배 준우승'},
    {url:'./assets/images/modern-cup/third-kim-lee.jpg',title:'공동 3위 김기환·이현진',body:'제1회 모던클럽배 공동 3위'},
    {url:'./assets/images/modern-cup/third-oh-joo.jpg',title:'공동 3위 오경훈·주재헌',body:'제1회 모던클럽배 공동 3위'},
    {url:'./assets/images/modern-cup/qf-kang-jung.jpg',title:'8강 강홍섭·정동식',body:'제1회 모던클럽배 8강'},
    {url:'./assets/images/modern-cup/qf-maeng-kim.jpg',title:'8강 맹도영·김해솔',body:'제1회 모던클럽배 8강'},
    {url:'./assets/images/modern-cup/qf-park-park.jpg',title:'8강 박재정·박이준',body:'제1회 모던클럽배 8강'},
    {url:'./assets/images/modern-cup/qf-hwang-song.jpg',title:'8강 황부근·송강영',body:'제1회 모던클럽배 8강'}
  ];
  const isModern=x=>/모던클럽배/.test(String(x?.name||''))||String(x?.id||'').includes('modern-cup-2026');
  const modernTournament=()=>({
    id:ID,current:false,status:'completed',name:'2026 제1회 모던클럽배 테니스대회',division:'영남권 지역신인부',
    date:DATE,venue:'장유 국제테니스장 · 장유중 · 원도심',active:96,reserve:0,
    prelimCompleted:96,prelimTotal:96,mainCompleted:63,mainTotal:63,
    champion,runnerUp,thirds:[...thirds],quarterfinals:[...quarterfinals],
    archivedAt:ARCHIVE_AT,updatedAt:ARCHIVE_AT,sourceTournamentId:ID,
    detail:'제1회 모던클럽배 완료 기록입니다. 참가 96팀, 입상 결과와 8강 진출팀 및 결과사진을 보존합니다.'
  });
  const modernResult=()=>({
    id:`result-${ID}`,name:'2026 제1회 모던클럽배 테니스대회',division:'영남권 지역신인부',archivedAt:ARCHIVE_AT,
    champion,runnerUp,thirds:[...thirds],quarterfinals:[...quarterfinals],
    prelimCompleted:96,prelimTotal:96,mainCompleted:63,mainTotal:63,
    teamNames:[...TEAM_NAMES],resultPhotos:[...recoveredPhotos],sourceTournamentId:ID,source:'legacy-230-exact-restore'
  });
  const modernParticipants=()=>({id:`participants-${ID}`,name:'2026 제1회 모던클럽배 테니스대회',division:'영남권 지역신인부',archivedAt:ARCHIVE_AT,teamNames:[...TEAM_NAMES]});
  function replaceModern(rows,item){const out=(Array.isArray(rows)?rows:[]).filter(x=>!isModern(x));out.unshift(structuredClone(item));return out;}
  function persistExact(){
    state.portal=state.portal||{};
    state.portal.tournamentArchives=replaceModern(state.portal.tournamentArchives,modernTournament());
    state.portal.resultArchives=replaceModern(state.portal.resultArchives,modernResult());
    state.portal.participantArchives=replaceModern(state.portal.participantArchives,modernParticipants());
    state.portal.legacyTournamentSummaries=replaceModern(state.portal.legacyTournamentSummaries,modernResult());
    try{saveState(state);}catch(_e){}
  }
  function patchProviders(){
    tournamentArchiveRows=function(){return [currentTournamentSnapshot(),modernTournament(),...(state.portal?.tournamentArchives||[]).filter(x=>!isModern(x))];};
    resultArchiveRows=function(){return [modernResult(),...(state.portal?.resultArchives||[]).filter(x=>!isModern(x))].map(normalizeResultArchive);};
    // 일부 배포본에는 archivedParticipantRows 함수가 존재하지 않습니다.
    // 존재하지 않는 함수에 직접 대입하면 전체 렌더링이 중단되므로 참가자 보관함 확장은 안전하게 생략합니다.
  }
  async function recoverLegacyPhotos(){
    try{
      const rt=await getAuthRuntime();
      if(!rt?.db)return;
      const api=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const {collection,getDocs,query,orderBy,limit}=api;
      let snap;
      try{snap=await getDocs(query(collection(rt.db,'noticePosts'),orderBy('createdAtMs','desc'),limit(160)));}
      catch(_e){snap=await getDocs(collection(rt.db,'noticePosts'));}
      const photos=[];
      snap.docs.forEach(d=>{
        const n={id:d.id,...d.data()};
        const text=`${n.title||''} ${n.body||''} ${n.category||''} ${n.tournamentName||''}`;
        const urls=[...(Array.isArray(n.imageUrls)?n.imageUrls:[]),n.imageUrl].filter(Boolean);
        if(!urls.length)return;
        const modern=/모던|230스포츠미디어배|지역신인부/i.test(text);
        const result=/우승|준우승|공동\s*3위|3위|8강|시합결과|대회결과|입상|경기사진/i.test(text);
        if(!(modern||result))return;
        urls.forEach((url,i)=>{if(!photos.some(x=>x.url===url))photos.push({url,title:n.title||`모던배 결과사진 ${i+1}`,body:n.body||'',noticeId:n.id,createdAtMs:Number(n.createdAtMs||0)});});
      });
      if(photos.length){
        recoveredPhotos=photos;
        persistExact();
        refreshViews();
        notice(`모던배 결과사진 ${photos.length}장을 기존 230 앱에서 불러왔습니다.`,'success');
      }
    }catch(error){console.warn('[35.3.0] legacy photo recovery skipped',error);}
  }
  function refreshViews(){
    try{renderTournamentList();}catch(_e){}
    try{renderResultArchive();}catch(_e){}
    try{renderPublicParticipantRecords();}catch(_e){}
  }
  function installRestoreButton(){
    const host=document.querySelector('#page-tournaments .section-head .button-row,#page-tournaments .button-row');
    if(!host||document.getElementById('restoreModernExact3530'))return;
    const b=document.createElement('button');b.id='restoreModernExact3530';b.type='button';b.className='btn btn-primary';b.textContent='모던배 전체 기록 복구';
    b.onclick=()=>{persistExact();refreshViews();recoverLegacyPhotos();notice('모던배 입상·8강·참가자 기록을 복구했습니다.','success');};host.appendChild(b);
  }
  function run(){patchProviders();persistExact();refreshViews();installRestoreButton();recoverLegacyPhotos();const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 35.3.1 · 모던배 기록·사진 직접 내장 복구';label.title='Version 35.3.1';}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,100),{once:true});else setTimeout(run,100);
  window.addEventListener('hashchange',()=>setTimeout(()=>{refreshViews();installRestoreButton();},120));
  setTimeout(run,1200);
  window.restoreModernCupExact3530=()=>{persistExact();refreshViews();recoverLegacyPhotos();};
  console.info('[230MATCH V3] 35.3.1 ready · embedded Modern Cup records and photos active');
})();


/* Stage 35.4.2 · venue-aware balanced main-court assignment */
(function stage3532UseExistingBracketForPrint(){
  function cleanBracketClone(source){
    const clone=source.cloneNode(true);
    clone.id='printLiveBracketBoard';
    clone.classList.remove('empty-state','bracket-focus-mode','bracket-fullscreen');
    clone.classList.add('print-live-bracket-board');
    clone.querySelectorAll('.is-filtered-out,.is-round-filtered-out').forEach(el=>el.classList.remove('is-filtered-out','is-round-filtered-out'));
    clone.querySelectorAll('[style]').forEach(el=>{
      if(el.style.display==='none')el.style.removeProperty('display');
    });
    return clone;
  }

  printBracketHtml=window.printBracketHtml=function(){
    const source=document.getElementById('bracketBoard');
    if(!source||source.classList.contains('empty-state')||!source.querySelector('.round-column')){
      return printHeader('본선 대진표')+'<div class="print-empty">생성된 본선 대진표가 없습니다.</div>';
    }
    const clone=cleanBracketClone(source);
    return printHeader('본선 대진표')+
      '<div class="bracket-print-note live-copy-note">현재 본선 대진표 화면의 팀명·점수·코트·진행 상태를 그대로 출력합니다.</div>'+
      `<div class="live-bracket-print-viewport">${clone.outerHTML}</div>`;
  };

  function rebindBracketImageSave(){
    const old=document.getElementById('savePrintImageBtn');
    if(!old||old.dataset.stage3532==='1')return;
    const btn=old.cloneNode(true);
    btn.dataset.stage3532='1';
    old.replaceWith(btn);
    btn.addEventListener('click',()=>{
      const doc=buildPrintDocument();
      saveRichPrintPreviewPng(doc);
    });
  }

  const style=document.createElement('style');
  style.textContent=`
    .live-bracket-print-viewport{width:100%;overflow:visible;background:#fff;padding:2mm 0 4mm}
    .print-live-bracket-board{display:flex!important;align-items:flex-start!important;gap:14px!important;overflow:visible!important;width:max-content!important;min-width:100%!important;padding:4px 2px 18px!important;background:#fff!important}
    .print-live-bracket-board .round-column{display:grid!important;min-width:205px!important;width:205px!important;gap:8px!important;align-content:start!important}
    .print-live-bracket-board .round-column>h3{position:static!important;top:auto!important;background:var(--surface,#fff)!important;padding:7px 0!important;font-size:14px!important}
    .print-live-bracket-board .round-match-stack{gap:var(--round-gap,14px)!important;padding-top:var(--round-offset,0px)!important}
    .print-live-bracket-board .round-match-stack>.match-card{min-height:var(--round-card-height,118px)!important;height:var(--round-card-height,118px)!important;break-inside:avoid!important}
    .print-live-bracket-board .match-card header{font-size:11px!important}
    .print-live-bracket-board .match-team{font-size:11px!important;line-height:1.25!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important}
    .print-live-bracket-board .match-meta,.print-live-bracket-board .bracket-court-label{font-size:9px!important}
    .bracket-tree-print-sheet .print-title{margin-bottom:2mm!important}
    @media print{
      .live-bracket-print-viewport{overflow:visible!important}
      .print-live-bracket-board{transform-origin:top left!important;zoom:.72!important}
      .print-live-bracket-board .match-card:hover{transform:none!important;box-shadow:none!important}
    }
  `;
  document.head.appendChild(style);

  function activate(){
    const option=document.querySelector('#printTargetSelect option[value="bracket"]');
    if(option)option.textContent='본선 대진표 그대로 출력';
    rebindBracketImageSave();
    const label=document.getElementById('buildStageLabel');
    if(label){label.textContent='230MATCH 35.4.2 · 구장별 본선 균등배정';label.title='Version 35.4.2';}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(activate,0),{once:true});else setTimeout(activate,0);
  window.addEventListener('load',()=>setTimeout(activate,500));
  console.info('[230MATCH V3] 35.4.2 ready · venue-aware balanced main assignment');
})();


/* Stage 35.5.4 · read-only Firebase load guard */
(function stage3554ReadLoadGuard(){
  const apply=()=>{const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 35.5.4 · 조회 사용자 Firebase 부하 제한';label.title='Version 35.5.4';}document.documentElement.dataset.build='3554';};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  setTimeout(apply,500);setTimeout(apply,1500);
  console.info('[230MATCH V3] 35.5.4 ready · operators realtime, read-only users capped polling');
})();


/* 230MATCH 1.0.0 · official release identity */
(function officialRelease1000(){
  function apply(){
    document.documentElement.dataset.build='1000';
    document.documentElement.dataset.release='official';
    const label=document.getElementById('buildStageLabel');
    if(label){label.textContent='230MATCH 1.0.0 · 정식 운영본';label.title='Version 1.0.0';}
    document.title='230MATCH | 테니스 시합관리';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  setTimeout(apply,500);setTimeout(apply,1600);
  window.addEventListener('load',()=>setTimeout(apply,100));
  console.info('[230MATCH] 1.0.0 official release ready');
})();

/* Stage 35.6.0 · authenticated player self-result entry */
(function stage3560PlayerSelfResult(){
  const TYPE_LABELS={normal:'일반 경기',retired:'기권',injury:'부상',walkover:'노쇼'};
  const normalizePhone=v=>String(v||'').replace(/\D/g,'');
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function ownership(team){
    if(!currentAuthUser||!team)return{ok:false,reason:'login'};
    if(canOperate())return{ok:true,reason:'operator'};
    const uid=String(currentAuthUser.uid||'');
    if(uid&&[team.ownerUid,team.applicationOwnerUid].some(v=>String(v||'')===uid))return{ok:true,reason:'uid'};
    const profilePhone=normalizePhone(v3252ProfileDefaults().phone);
    const contactPhone=normalizePhone(getTeamContact(state,team)?.phone);
    const phones=[contactPhone,...(team.playerPhones||[]),...(team.players||[]).map(p=>p?.phone),team.player1Phone,team.player2Phone].map(normalizePhone).filter(Boolean);
    if(profilePhone&&phones.includes(profilePhone))return{ok:true,reason:'phone'};
    return{ok:false,reason:'unverified'};
  }
  function matchById(id,isPrelim){return isPrelim?findPrelimMatch(state,id):findMatch(state.draw,id)}
  function scoreLabel(match){
    const type=match?.resultType||'normal';
    const label=TYPE_LABELS[type]||match?.resultTypeLabel||'';
    return type!=='normal'&&label?label:'';
  }
  function decorate(team){
    const root=document.getElementById('myMatchResult');if(!root)return;
    const own=ownership(team);
    const teamKey=myMatchTeamKey(team);
    const prelim=(state.prelim?.matches||[]).filter(m=>myMatchContainsTeam(m,team)).sort((a,b)=>Number(a.matchNo||0)-Number(b.matchNo||0));
    const main=portalMainMatches().filter(m=>myMatchContainsTeam(m,team)).sort((a,b)=>{const ar=Number(String(a.id||'').match(/^r(\d+)_/)?.[1]||0),br=Number(String(b.id||'').match(/^r(\d+)_/)?.[1]||0);return br-ar;});
    const sections=[...root.querySelectorAll('.my-match-section')];
    [[sections[0],prelim,true],[sections[1],main,false]].forEach(([section,matches,isPrelim])=>{
      if(!section)return;
      [...section.querySelectorAll('.my-match-game')].forEach((card,index)=>{
        const match=matches[index];if(!match)return;
        card.dataset.playerResultMatch=match.id;card.dataset.playerResultPrelim=isPrelim?'1':'0';
        const special=scoreLabel(match);
        if(special&&!card.querySelector('.stage3560-result-type')){
          const score=card.querySelector('.my-match-score');
          (score||card).insertAdjacentHTML(score?'beforeend':'beforeend',`<span class="stage3560-result-type">${esc(special)}</span>`);
        }
        const eligible=own.ok&&match.teamA&&match.teamB&&!match.teamA.placeholder&&!match.teamB.placeholder;
        if(eligible&&!card.querySelector('[data-player-result-open]')){
          const button=document.createElement('button');
          button.type='button';button.className='btn btn-primary btn-small stage3560-result-button';
          button.dataset.playerResultOpen=match.id;button.dataset.playerResultPrelim=isPrelim?'1':'0';button.dataset.playerResultTeam=teamKey;
          button.textContent=match.status==='completed'?'결과 수정':'결과 입력';
          card.appendChild(button);
        }
      });
    });
    if(!own.ok&&currentAuthUser&&!root.querySelector('.stage3560-verify-note')){
      root.insertAdjacentHTML('beforeend','<div class="stage3560-verify-note">경기 조회는 가능하지만 결과 입력은 등록 전화번호 또는 참가 신청 계정이 확인된 본인 팀에서만 가능합니다.</div>');
    }
  }
  function installDialog(){
    if(document.getElementById('stage3560ResultDialog'))return;
    document.body.insertAdjacentHTML('beforeend',`<dialog id="stage3560ResultDialog" class="stage3560-dialog"><form method="dialog" id="stage3560ResultForm"><div class="stage3560-head"><div><p>PLAYER RESULT</p><h3 id="stage3560Title">경기 결과 입력</h3></div><button type="button" data-stage3560-close aria-label="닫기">×</button></div><div id="stage3560MatchInfo" class="stage3560-match-info"></div><label class="stage3560-label">결과 유형<select id="stage3560Type"><option value="normal">일반 경기</option><option value="retired">기권</option><option value="injury">부상</option><option value="walkover">노쇼</option></select></label><div class="stage3560-score-grid"><button type="button" class="stage3560-team" data-stage3560-winner="A"><span id="stage3560TeamA">A팀</span><input id="stage3560ScoreA" type="number" min="0" max="6" inputmode="numeric" aria-label="A팀 점수"></button><span class="stage3560-colon">:</span><button type="button" class="stage3560-team" data-stage3560-winner="B"><span id="stage3560TeamB">B팀</span><input id="stage3560ScoreB" type="number" min="0" max="6" inputmode="numeric" aria-label="B팀 점수"></button></div><p id="stage3560Guide" class="stage3560-guide">일반 경기는 양 팀 스코어를 입력하세요.</p><div class="stage3560-actions"><button type="button" class="btn btn-secondary" data-stage3560-close>취소</button><button type="submit" class="btn btn-primary">결과 저장</button></div><input type="hidden" id="stage3560MatchId"><input type="hidden" id="stage3560IsPrelim"><input type="hidden" id="stage3560WinnerSide"></form></dialog>`);
    const style=document.createElement('style');style.id='stage3560Style';style.textContent=`.stage3560-result-button{width:100%;margin-top:10px}.stage3560-result-type{display:inline-flex;margin-left:7px;padding:2px 7px;border-radius:999px;background:rgba(245,158,11,.16);font-size:11px;font-weight:800}.stage3560-verify-note{margin-top:14px;padding:10px 12px;border-radius:10px;background:rgba(100,116,139,.1);font-size:12px;color:#64748b}.stage3560-dialog{width:min(92vw,460px);border:0;border-radius:18px;padding:0;box-shadow:0 24px 80px rgba(15,23,42,.28)}.stage3560-dialog::backdrop{background:rgba(15,23,42,.45)}#stage3560ResultForm{padding:18px}.stage3560-head{display:flex;justify-content:space-between;align-items:flex-start}.stage3560-head p{margin:0;color:#2563eb;font-size:11px;font-weight:900;letter-spacing:.08em}.stage3560-head h3{margin:3px 0 0}.stage3560-head>button{border:0;background:transparent;font-size:28px;line-height:1}.stage3560-match-info{margin:14px 0;padding:11px;border-radius:12px;background:#f8fafc;font-weight:800}.stage3560-label{display:grid;gap:6px;font-size:12px;font-weight:800}.stage3560-label select{height:42px;border:1px solid #cbd5e1;border-radius:10px;padding:0 10px;background:white}.stage3560-score-grid{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:stretch;margin-top:14px}.stage3560-team{border:1px solid #cbd5e1;border-radius:14px;background:white;padding:10px 8px;display:grid;gap:8px;text-align:center}.stage3560-team.is-winner{border-color:#2563eb;background:#eff6ff}.stage3560-team span{font-size:13px;font-weight:800}.stage3560-team input{width:100%;height:52px;border:0;border-radius:10px;background:#f1f5f9;text-align:center;font-size:26px;font-weight:900}.stage3560-colon{align-self:center;font-size:26px;font-weight:900}.stage3560-guide{font-size:12px;color:#64748b;margin:10px 0 0}.stage3560-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}@media(max-width:560px){.stage3560-dialog{width:calc(100vw - 24px)}.stage3560-team span{font-size:12px}.stage3560-result-button{min-height:42px}}`;
    document.head.appendChild(style);
  }
  function open(id,isPrelim){
    installDialog();const match=matchById(id,isPrelim);if(!match)return notice('경기 정보를 찾을 수 없습니다.','error');
    const ownA=ownership(match.teamA),ownB=ownership(match.teamB);if(!ownA.ok&&!ownB.ok)return notice('본인 인증된 경기만 결과를 입력할 수 있습니다.','error');
    document.getElementById('stage3560MatchId').value=id;document.getElementById('stage3560IsPrelim').value=isPrelim?'1':'0';
    document.getElementById('stage3560Title').textContent=match.status==='completed'?'경기 결과 수정':'경기 결과 입력';
    document.getElementById('stage3560MatchInfo').textContent=`${isPrelim?myMatchRoundLabel(match,true):myMatchRoundLabel(match,false)} · ${myMatchPlacement(match).label}`;
    document.getElementById('stage3560TeamA').textContent=portalTeam(match.teamA);document.getElementById('stage3560TeamB').textContent=portalTeam(match.teamB);
    document.getElementById('stage3560ScoreA').value=match.status==='completed'?Number(match.scoreA??''):'';document.getElementById('stage3560ScoreB').value=match.status==='completed'?Number(match.scoreB??''):'';
    document.getElementById('stage3560Type').value=match.resultType||'normal';document.getElementById('stage3560WinnerSide').value=Number(match.scoreA)>Number(match.scoreB)?'A':Number(match.scoreB)>Number(match.scoreA)?'B':'';
    syncDialog();document.getElementById('stage3560ResultDialog').showModal();
  }
  function syncDialog(){
    const type=document.getElementById('stage3560Type')?.value||'normal';const side=document.getElementById('stage3560WinnerSide')?.value||'';
    document.querySelectorAll('[data-stage3560-winner]').forEach(b=>b.classList.toggle('is-winner',b.dataset.stage3560Winner===side));
    const guide=document.getElementById('stage3560Guide');if(guide)guide.textContent=type==='normal'?'일반 경기는 양 팀 스코어를 입력하세요. 한 팀은 6점이어야 합니다.':`${TYPE_LABELS[type]} 경기는 승리팀을 누르면 6:0으로 자동 입력됩니다.`;
  }
  function recordAudit(match,isPrelim,correcting){
    state.operation=state.operation||{};state.operation.playerResultHistory=state.operation.playerResultHistory||[];
    state.operation.playerResultHistory.unshift({id:`pr-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,at:new Date().toISOString(),matchId:match.id,isPrelim:Boolean(isPrelim),teamA:portalTeam(match.teamA),teamB:portalTeam(match.teamB),scoreA:Number(match.scoreA),scoreB:Number(match.scoreB),winner:portalTeam(match.winner),resultType:match.resultType||'normal',resultTypeLabel:match.resultTypeLabel||'일반 경기',enteredByUid:currentAuthUser?.uid||'',enteredByName:authUserLabel(),corrected:Boolean(correcting)});
    state.operation.playerResultHistory=state.operation.playerResultHistory.slice(0,200);
  }
  function submit(event){
    event.preventDefault();const id=document.getElementById('stage3560MatchId').value;const isPrelim=document.getElementById('stage3560IsPrelim').value==='1';const match=matchById(id,isPrelim);if(!match)return notice('경기 정보를 찾을 수 없습니다.','error');
    if(!ownership(match.teamA).ok&&!ownership(match.teamB).ok)return notice('본인 인증된 경기만 결과를 입력할 수 있습니다.','error');
    const type=document.getElementById('stage3560Type').value||'normal';let scoreA=Number(document.getElementById('stage3560ScoreA').value),scoreB=Number(document.getElementById('stage3560ScoreB').value);let side=document.getElementById('stage3560WinnerSide').value;
    if(type!=='normal'){
      if(!side)return notice(`${TYPE_LABELS[type]} 처리할 승리팀을 선택하세요.`,'error');scoreA=side==='A'?6:0;scoreB=side==='B'?6:0;
    }
    if(!Number.isInteger(scoreA)||!Number.isInteger(scoreB)||scoreA<0||scoreB<0||scoreA>6||scoreB>6||scoreA===scoreB||!((scoreA===6&&scoreB<=5)||(scoreB===6&&scoreA<=5)))return notice('한 팀은 6점, 상대팀은 0~5점으로 입력하세요.','error');
    const winnerId=scoreA>scoreB?match.teamA.id:match.teamB.id;const correcting=match.status==='completed';
    const summary=`${portalTeam(match.teamA)} ${scoreA} : ${scoreB} ${portalTeam(match.teamB)}${type!=='normal'?` · ${TYPE_LABELS[type]}`:''}`;if(!confirm(`${summary}\n\n이 결과를 ${correcting?'수정':'저장'}할까요?`))return;
    try{
      autoRecovery(correcting?'선수 경기 결과 수정 전':'선수 경기 결과 입력 전');
      let saved;
      if(isPrelim){
        const involved=new Set([match.teamA?.id,match.teamB?.id].filter(Boolean));const beforePlayIns=new Set(Object.values(state.draw?.rounds||{}).flat().filter(x=>x.isPlayIn&&x.teamA&&!x.teamA.placeholder&&x.teamB&&!x.teamB.placeholder).map(x=>x.id));
        saved=submitPrelimResult(state,{matchId:id,winnerId,scoreA,scoreB});saved.resultType=type;saved.resultTypeLabel=TYPE_LABELS[type];
        syncLinkedDraw({silent:true});const newly=Object.values(state.draw?.rounds||{}).flat().filter(x=>x.isPlayIn&&!beforePlayIns.has(x.id)&&x.teamA&&!x.teamA.placeholder&&x.teamB&&!x.teamB.placeholder);const priority=newly.filter(x=>involved.has(x.teamA?.id)||involved.has(x.teamB?.id));
        if(!correcting){if(useUnifiedCourts(state))enqueueReadyMainToUnifiedCourts(state,{priorityMatchIds:(priority.length?priority:newly).map(x=>x.id)});else autoAssignResolvedMain(state,{findMatch,queueReadyMatches,refillCourt});}
      }else{
        const sourceCourt=[...(state.prelim?.courts||[]),...(state.courts||[])].find(c=>c.playing===id);saved=submitResult(state,{matchId:id,winnerId,scoreA,scoreB});saved.resultType=type;saved.resultTypeLabel=TYPE_LABELS[type];verifyAndRepairMainFlow(state,{sourceMatchId:id});finalizeTournamentCompletion(state);
        if(!correcting&&sourceCourt&&(state.prelim?.courts||[]).some(c=>c.id===sourceCourt.id)){advanceUnifiedCourt(state,sourceCourt.id,id);enqueueReadyMainToUnifiedCourts(state);}
      }
      saved.enteredByPlayer=true;saved.enteredByUid=currentAuthUser?.uid||'';saved.enteredByName=authUserLabel();saved.enteredAt=new Date().toISOString();recordAudit(saved,isPrelim,correcting);
      commit(`선수 결과 ${correcting?'수정':'입력'} · ${saved.id} · ${saved.scoreA}:${saved.scoreB}${type!=='normal'?` · ${TYPE_LABELS[type]}`:''}`);
      document.getElementById('stage3560ResultDialog').close();renderPortalViews();setTimeout(v3252AutoMyMatch,80);notice(`경기 결과가 ${correcting?'수정':'저장'}되었습니다.`,'success');
    }catch(error){console.error('[35.6.0] player result failed',error);notice(`결과 저장 실패: ${error?.message||error}`,'error')}
  }
  const originalRender=renderMyMatchTeam;renderMyMatchTeam=function(team){originalRender.apply(this,arguments);setTimeout(()=>decorate(team),0)};
  const originalPublic=renderPublicPrelimGroups;renderPublicPrelimGroups=function(){originalPublic.apply(this,arguments);const matches=(state.prelim?.groups||[]).flatMap(g=>(state.prelim?.matches||[]).filter(m=>m.groupId===g.id||Number(m.groupNo)===Number(g.groupNo)));document.querySelectorAll('.public-prelim-match').forEach((node,i)=>{const m=matches[i],label=scoreLabel(m);if(label&&!node.querySelector('.stage3560-result-type'))node.querySelector('.public-match-result')?.insertAdjacentHTML('beforeend',`<span class="stage3560-result-type">${esc(label)}</span>`)});};
  document.addEventListener('click',event=>{const openBtn=event.target.closest?.('[data-player-result-open]');if(openBtn){event.preventDefault();event.stopPropagation();open(openBtn.dataset.playerResultOpen,openBtn.dataset.playerResultPrelim==='1');return}const winner=event.target.closest?.('[data-stage3560-winner]');if(winner){const type=document.getElementById('stage3560Type').value||'normal';document.getElementById('stage3560WinnerSide').value=winner.dataset.stage3560Winner;if(type!=='normal'){document.getElementById('stage3560ScoreA').value=winner.dataset.stage3560Winner==='A'?6:0;document.getElementById('stage3560ScoreB').value=winner.dataset.stage3560Winner==='B'?6:0;}syncDialog();return}if(event.target.closest?.('[data-stage3560-close]'))document.getElementById('stage3560ResultDialog')?.close();},true);
  document.addEventListener('change',event=>{if(event.target?.id!=='stage3560Type')return;const type=event.target.value;if(type!=='normal'){document.getElementById('stage3560ScoreA').value='';document.getElementById('stage3560ScoreB').value='';}syncDialog();});
  document.addEventListener('submit',event=>{if(event.target?.id==='stage3560ResultForm')submit(event)},true);
  const applyBuild=()=>{installDialog();const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 35.6.0 · 선수 본인 경기 결과 입력';label.title='Version 35.6.0';}document.documentElement.dataset.build='3560';};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(applyBuild,0),{once:true});else setTimeout(applyBuild,0);
  console.info('[230MATCH V3] 35.6.0 ready · authenticated player self-result entry');
})();

/* Stage 35.6.1 · mandatory member profile + cancellation/refund workflow */
(function stage3561MemberAndRefund(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const digits=v=>String(v||'').replace(/\D/g,'');
  const now=()=>new Date().toISOString();
  function ensureRefundState(){
    ensurePortalState();
    state.portal.refundSmsSettings=state.portal.refundSmsSettings||{mode:'phone',adminName:'',adminPhone:''};
    state.portal.refundRequests=state.portal.refundRequests||[];
  }
  function profileComplete(p){
    p=p||{};const d=p.registrationDefaults||{};
    return Boolean(String(p.name||d.name||'').trim()&&digits(p.phone||d.phone).length>=10&&String(p.club||d.club||'').trim()&&String(p.career||'').trim()&&String(p.gender||'').trim()&&String(p.birthYear||'').trim()&&p.profileCompleted===true);
  }
  function installProfileDialog(){
    if(document.getElementById('stage3561ProfileDialog'))return;
    const years=[];for(let y=new Date().getFullYear()-10;y>=1930;y--)years.push(`<option value="${y}">${y}년</option>`);
    document.body.insertAdjacentHTML('beforeend',`<dialog id="stage3561ProfileDialog" class="stage3561-dialog"><form id="stage3561ProfileForm"><div class="stage3561-head"><div><p>MEMBER PROFILE</p><h2>회원 기본정보 등록</h2><span>최초 로그인 시 한 번만 등록합니다.</span></div></div><div class="stage3561-grid"><label>이름<input id="stage3561Name" required maxlength="20"></label><label>휴대전화번호<input id="stage3561Phone" required inputmode="tel" placeholder="01012345678"></label><label>클럽명<input id="stage3561Club" required maxlength="40" placeholder="소속 없음 가능"></label><label>구력<select id="stage3561Career" required><option value="">선택</option><option>1년 미만</option><option>1~3년</option><option>3~5년</option><option>5~10년</option><option>10년 이상</option></select></label><label>성별<select id="stage3561Gender" required><option value="">선택</option><option value="male">남성</option><option value="female">여성</option></select></label><label>출생연도<select id="stage3561BirthYear" required><option value="">선택</option>${years.join('')}</select></label></div><label class="stage3561-agree"><input type="checkbox" id="stage3561Agree" required> 참가신청·본인 경기 확인·대회 안내를 위한 개인정보 수집 및 이용에 동의합니다.</label><button type="submit" class="btn btn-primary stage3561-submit">회원등록 완료</button><p id="stage3561ProfileMessage"></p></form></dialog>`);
    const style=document.createElement('style');style.id='stage3561Style';style.textContent=`.stage3561-dialog{width:min(94vw,560px);border:0;border-radius:20px;padding:0;box-shadow:0 28px 90px rgba(15,23,42,.35)}.stage3561-dialog::backdrop{background:rgba(15,23,42,.6)}#stage3561ProfileForm{padding:22px}.stage3561-head p{margin:0;color:#2563eb;font-size:11px;font-weight:900;letter-spacing:.08em}.stage3561-head h2{margin:4px 0}.stage3561-head span{font-size:13px;color:#64748b}.stage3561-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.stage3561-grid label{display:grid;gap:6px;font-size:12px;font-weight:800}.stage3561-grid input,.stage3561-grid select{height:44px;border:1px solid #cbd5e1;border-radius:10px;padding:0 11px;background:#fff}.stage3561-agree{display:flex;gap:8px;align-items:flex-start;margin:16px 0;font-size:12px;line-height:1.5}.stage3561-submit{width:100%;min-height:46px}#stage3561ProfileMessage{font-size:12px;margin:10px 0 0}.stage3561-refund-btn{margin-left:6px}.stage3561-refund-panel{margin:14px 0;padding:14px;border:1px solid #dbeafe;border-radius:14px;background:rgba(239,246,255,.75)}.stage3561-refund-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:12px}.stage3561-refund-toolbar label{display:grid;gap:4px;font-size:11px;font-weight:800}.stage3561-refund-toolbar input,.stage3561-refund-toolbar select{height:36px;border:1px solid #cbd5e1;border-radius:8px;padding:0 8px}.stage3561-refund-card{display:grid;gap:7px;padding:12px;border-radius:12px;background:#fff;border:1px solid #e2e8f0;margin-top:8px}.stage3561-refund-card small{color:#64748b}.stage3561-refund-actions{display:flex;gap:8px;flex-wrap:wrap}.stage3561-badge{display:inline-flex;width:max-content;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:900;background:#fef3c7;color:#92400e}.stage3561-dialog-card{padding:20px}.stage3561-dialog-card label{display:grid;gap:5px;font-size:12px;font-weight:800;margin-top:10px}.stage3561-dialog-card input,.stage3561-dialog-card select,.stage3561-dialog-card textarea{border:1px solid #cbd5e1;border-radius:10px;padding:10px;background:#fff}.stage3561-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}@media(max-width:560px){.stage3561-grid{grid-template-columns:1fr}.stage3561-dialog{width:calc(100vw - 20px)}.stage3561-refund-toolbar{display:grid;grid-template-columns:1fr 1fr}.stage3561-refund-toolbar label:first-child{grid-column:1/-1}}`;
    document.head.appendChild(style);
  }
  function showProfileDialog(){
    if(!currentAuthUser||profileComplete(currentAuthUser.appProfile))return;
    installProfileDialog();const p=currentAuthUser.appProfile||{},d=p.registrationDefaults||{};
    document.getElementById('stage3561Name').value=p.name||d.name||currentAuthUser.displayName||'';
    document.getElementById('stage3561Phone').value=p.phone||d.phone||'';
    document.getElementById('stage3561Club').value=p.club||d.club||p.affiliation||'';
    document.getElementById('stage3561Career').value=p.career||'';document.getElementById('stage3561Gender').value=p.gender||'';document.getElementById('stage3561BirthYear').value=p.birthYear||'';
    const dlg=document.getElementById('stage3561ProfileDialog');if(!dlg.open)dlg.showModal();
  }
  async function saveProfile(e){
    e.preventDefault();if(!currentAuthUser)return;
    const name=String(document.getElementById('stage3561Name').value||'').trim(),phone=digits(document.getElementById('stage3561Phone').value),club=String(document.getElementById('stage3561Club').value||'').trim(),career=document.getElementById('stage3561Career').value,gender=document.getElementById('stage3561Gender').value,birthYear=document.getElementById('stage3561BirthYear').value;
    if(!name||phone.length<10||!club||!career||!gender||!birthYear||!document.getElementById('stage3561Agree').checked)return notice('필수정보와 개인정보 동의를 모두 확인하세요.','error');
    const data={name,phone,club,career,gender,birthYear,profileCompleted:true,profileCompletedAt:now(),registrationDefaults:{name,phone,club},updatedAt:now()};
    try{const rt=await getAuthRuntime();if(!rt?.db||!rt?.user)throw new Error('회원정보 저장소 연결 실패');await rt.api.setDoc(rt.api.doc(rt.db,'users',rt.user.uid),data,{merge:true});currentAuthUser.appProfile={...(currentAuthUser.appProfile||{}),...data};document.getElementById('stage3561ProfileDialog').close();renderAuthStatus();v3252AutofillEntry?.();notice('정식 회원등록이 완료되었습니다.','success');if(document.body?.dataset.currentView==='my-match')setTimeout(v3252AutoMyMatch,100);}catch(err){notice(`회원정보 저장 실패: ${err?.message||err}`,'error')}
  }
  const originalApply=applyAuthenticatedRole;applyAuthenticatedRole=function(user,role='viewer',profile=null){originalApply.apply(this,arguments);if(user)setTimeout(showProfileDialog,250)};

  function findApplication(id){return (state.portal?.applications||[]).find(a=>String(a.id)===String(id));}
  function ownApplication(item){if(!item||!currentAuthUser)return false;if(item.ownerUid&&item.ownerUid===currentAuthUser.uid)return true;const p=digits(v3252ProfileDefaults().phone);return p&&entryApplicationPlayers(item).some(x=>digits(x.phone)===p);}
  function smsMode(){ensureRefundState();return state.portal.refundSmsSettings.mode||'phone';}
  function adminRecipient(){ensureRefundState();const s=state.portal.refundSmsSettings;return{name:s.adminName||'환불 관리자',phone:digits(s.adminPhone)};}
  function requestText(item,r){return `[230MATCH 취소요청]\n${item.tournamentName||state.tournament?.name||'현재 대회'}${item.tournamentDivision?` / ${item.tournamentDivision}`:''}\n${item.teamName}\n입금자 ${r.depositorName} / ${Number(r.amount||0).toLocaleString()}원\n${r.bank} ${r.account} ${r.accountHolder}\n사유: ${r.reason}\n관리자 화면에서 환불 완료 처리 바랍니다.`;}
  function completeText(item,r){return `[230MATCH 환불완료]\n${item.tournamentName||state.tournament?.name||'현재 대회'}${item.tournamentDivision?` / ${item.tournamentDivision}`:''}\n${item.teamName} 팀의 참가 취소 및 ${Number(r.amount||0).toLocaleString()}원 환불 처리가 완료되었습니다.`;}
  async function dispatchSms(recipients,body,meta){
    const mode=smsMode();if(mode==='none')return 'none';
    const clean=recipients.filter(x=>digits(x.phone).length>=10);if(!clean.length)throw new Error('수신 전화번호가 없습니다.');
    if(mode==='aligo'){await sendAligoSmsV3(clean,body,{source:'refund',kind:meta.kind,title:meta.title});return 'aligo';}
    const phones=clean.map(x=>digits(x.phone));if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||''))location.href=`sms:${phones.join(',')}?body=${encodeURIComponent(body)}`;else{await navigator.clipboard?.writeText(`${phones.join('\n')}\n\n${body}`);notice('문자 수신번호와 내용을 복사했습니다.','info');}return 'phone';
  }
  function installRefundDialog(){
    if(document.getElementById('stage3561RefundDialog'))return;
    document.body.insertAdjacentHTML('beforeend',`<dialog id="stage3561RefundDialog" class="stage3561-dialog"><form id="stage3561RefundForm" class="stage3561-dialog-card"><h2>참가 취소 및 환불 요청</h2><div id="stage3561RefundInfo"></div><label>취소 사유<textarea id="stage3561Reason" rows="3" required></textarea></label><label>환불 금액<input id="stage3561Amount" type="number" min="0" required></label><label>입금자명<input id="stage3561Depositor" required></label><label>은행<select id="stage3561Bank" required><option value="">선택</option><option>농협</option><option>국민</option><option>신한</option><option>우리</option><option>하나</option><option>기업</option><option>부산</option><option>경남</option><option>카카오뱅크</option><option>토스뱅크</option><option>기타</option></select></label><label>환불계좌<input id="stage3561Account" inputmode="numeric" required></label><label>예금주<input id="stage3561Holder" required></label><div class="stage3561-dialog-actions"><button type="button" class="btn btn-light" data-stage3561-refund-close>취소</button><button type="submit" class="btn btn-primary">취소 승인 요청</button></div><input type="hidden" id="stage3561ApplicationId"></form></dialog>`);
  }
  function openRefund(id){
    const item=findApplication(id);if(!item||!ownApplication(item))return notice('본인의 참가 신청만 취소 요청할 수 있습니다.','error');if(['refund_requested','refund_processing','cancelled','refunded'].includes(item.status))return notice('이미 취소 또는 환불 절차가 진행 중입니다.','info');
    installRefundDialog();document.getElementById('stage3561ApplicationId').value=item.id;document.getElementById('stage3561RefundInfo').innerHTML=`<strong>${esc(item.teamName)}</strong><p>${esc(item.tournamentName||'현재 대회')} ${item.tournamentDivision?`· ${esc(item.tournamentDivision)}`:''}</p>`;document.getElementById('stage3561Depositor').value=item.representativeName||authUserLabel();document.getElementById('stage3561Amount').value=Number(item.paymentAmount||String(state.portal?.guide?.fee||'').replace(/\D/g,'')||0);document.getElementById('stage3561RefundDialog').showModal();
  }
  async function submitRefund(e){
    e.preventDefault();const item=findApplication(document.getElementById('stage3561ApplicationId').value);if(!item||!ownApplication(item))return;
    ensureRefundState();const r={id:`refund-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,applicationId:item.id,status:'requested',reason:String(document.getElementById('stage3561Reason').value||'').trim(),amount:Number(document.getElementById('stage3561Amount').value||0),depositorName:String(document.getElementById('stage3561Depositor').value||'').trim(),bank:document.getElementById('stage3561Bank').value,account:String(document.getElementById('stage3561Account').value||'').trim(),accountHolder:String(document.getElementById('stage3561Holder').value||'').trim(),requesterUid:currentAuthUser.uid,requesterName:authUserLabel(),requesterPhone:digits(v3252ProfileDefaults().phone||item.phone),requestedAt:now(),history:[]};
    if(!r.reason||!r.depositorName||!r.bank||!r.account||!r.accountHolder)return notice('환불 요청 정보를 모두 입력하세요.','error');
    if(!confirm(`${item.teamName} 참가 취소와 ${r.amount.toLocaleString()}원 환불을 요청할까요?`))return;
    item.previousStatus=item.status;item.status='refund_requested';item.refundRequestId=r.id;item.updatedAt=now();state.portal.refundRequests.unshift(r);commit(`참가 취소·환불 요청 · ${item.teamName}`);document.getElementById('stage3561RefundDialog').close();lookupPublicApplication();renderApplicationPortal();
    try{const admin=adminRecipient();await dispatchSms([admin],requestText(item,r),{kind:'request',title:'230MATCH 취소 요청'});r.adminSmsAt=now();r.adminSmsChannel=smsMode();commit(`환불 요청 관리자 문자 · ${item.teamName}`);}catch(err){r.adminSmsError=String(err?.message||err);commit(`환불 요청 문자 실패 · ${item.teamName}`);notice(`취소 요청은 접수됐지만 관리자 문자 처리에 실패했습니다: ${err?.message||err}`,'warning');}
    notice('취소·환불 요청이 접수되었습니다.','success');
  }
  function renderRefundAdmin(){
    if(!canOperate())return;ensureRefundState();const host=document.querySelector('#view-entry .entry-admin-toolbar')?.parentElement||document.querySelector('#view-entry');if(!host)return;
    let panel=document.getElementById('stage3561RefundAdmin');if(!panel){panel=document.createElement('section');panel.id='stage3561RefundAdmin';panel.className='stage3561-refund-panel';host.prepend(panel);}
    const s=state.portal.refundSmsSettings,rows=state.portal.refundRequests.filter(r=>['requested','processing'].includes(r.status));
    panel.innerHTML=`<h3>취소·환불 관리 <small>${rows.length}건</small></h3><div class="stage3561-refund-toolbar"><label>문자 방식<select data-refund-setting="mode"><option value="aligo">알리고 자동</option><option value="phone">휴대폰 문자앱</option><option value="none">문자 사용 안 함</option></select></label><label>환불 담당자<input data-refund-setting="adminName" value="${esc(s.adminName||'')}"></label><label>담당자 전화번호<input data-refund-setting="adminPhone" value="${esc(s.adminPhone||'')}"></label><button type="button" class="btn btn-secondary btn-small" data-refund-settings-save>설정 저장</button></div>${rows.map(r=>{const item=findApplication(r.applicationId);return `<article class="stage3561-refund-card"><span class="stage3561-badge">${r.status==='processing'?'환불 처리 중':'취소 요청'}</span><strong>${esc(item?.teamName||'신청 정보 없음')}</strong><small>${esc(item?.tournamentName||'')} ${item?.tournamentDivision?`· ${esc(item.tournamentDivision)}`:''}</small><div>${Number(r.amount||0).toLocaleString()}원 · ${esc(r.bank)} ${esc(r.account)} · ${esc(r.accountHolder)}</div><div>입금자 ${esc(r.depositorName)} · 사유 ${esc(r.reason)}</div><div class="stage3561-refund-actions">${r.status==='requested'?`<button type="button" class="btn btn-light btn-small" data-refund-processing="${r.id}">처리 중</button>`:''}<button type="button" class="btn btn-primary btn-small" data-refund-complete="${r.id}">환불 완료 승인</button><button type="button" class="btn btn-danger-outline btn-small" data-refund-reject="${r.id}">요청 반려</button></div></article>`}).join('')||'<div class="portal-empty">처리할 취소·환불 요청이 없습니다.</div>'}`;
    panel.querySelector('[data-refund-setting="mode"]').value=s.mode||'phone';
  }
  function saveRefundSettings(){ensureRefundState();const panel=document.getElementById('stage3561RefundAdmin');const mode=panel.querySelector('[data-refund-setting="mode"]').value,adminName=panel.querySelector('[data-refund-setting="adminName"]').value.trim(),adminPhone=digits(panel.querySelector('[data-refund-setting="adminPhone"]').value);if(mode!=='none'&&adminPhone.length<10)return notice('환불 담당자 전화번호를 입력하세요.','error');state.portal.refundSmsSettings={mode,adminName,adminPhone};commit('취소·환불 문자 설정 저장');notice('취소·환불 문자 설정을 저장했습니다.','success');}
  function findRefund(id){ensureRefundState();return state.portal.refundRequests.find(r=>r.id===id);}
  async function completeRefund(id){
    const r=findRefund(id),item=findApplication(r?.applicationId);if(!r||!item)return;if(!confirm(`${r.amount.toLocaleString()}원을 ${r.bank} ${r.account} 계좌로 실제 이체했습니까?\n\n완료 승인 후 참가자에게 문자가 발송됩니다.`))return;
    r.status='completed';r.completedAt=now();r.completedByUid=currentAuthUser?.uid||'';r.completedByName=authUserLabel();item.status='cancelled';item.paid=false;item.paymentStatus='refunded';item.refundedAt=r.completedAt;item.refundAmount=r.amount;item.updatedAt=r.completedAt;
    const team=state.teams?.find(t=>String(t.ownerUid||'')===String(item.ownerUid||'')||myMatchNormalize(t.name)===myMatchNormalize(item.teamName));if(team){state.teams=state.teams.filter(t=>t.id!==team.id);state.prelim.activeTeams=(state.prelim.activeTeams||[]).filter(t=>t.id!==team.id);state.prelim.reserveTeams=(state.prelim.reserveTeams||[]).filter(t=>t.id!==team.id);}
    commit(`환불 완료 승인 · ${item.teamName}`);renderApplicationPortal();renderParticipantManager?.();lookupPublicApplication();renderRefundAdmin();
    try{await dispatchSms([{name:item.representativeName||item.teamName,phone:item.phone}],completeText(item,r),{kind:'complete',title:'230MATCH 환불 완료'});r.completionSmsAt=now();r.completionSmsChannel=smsMode();commit(`환불 완료 문자 · ${item.teamName}`);}catch(err){r.completionSmsError=String(err?.message||err);commit(`환불 완료 문자 실패 · ${item.teamName}`);notice(`환불 완료 처리는 저장됐지만 참가자 문자 처리에 실패했습니다: ${err?.message||err}`,'warning');}
    notice('환불 완료와 참가 취소가 승인되었습니다.','success');
  }
  function rejectRefund(id){const r=findRefund(id),item=findApplication(r?.applicationId);if(!r||!item)return;const reason=prompt('취소 요청 반려 사유를 입력하세요.','취소 가능 기간 또는 환불 조건을 확인해 주세요.');if(reason===null)return;r.status='rejected';r.rejectedAt=now();r.rejectReason=reason;item.status=item.previousStatus||'approved';item.updatedAt=now();commit(`취소 요청 반려 · ${item.teamName}`);renderApplicationPortal();lookupPublicApplication();renderRefundAdmin();}
  const originalLookup=lookupPublicApplication;lookupPublicApplication=function(){originalLookup.apply(this,arguments);const root=document.getElementById('entryLookupResult');if(!root)return;const phone=digits(document.getElementById('entryLookupPhone')?.value);const rows=(state.portal?.applications||[]).filter(a=>a.phone===phone||entryApplicationPlayers(a).some(p=>digits(p.phone)===phone)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));[...root.querySelectorAll('.entry-status-card')].forEach((card,i)=>{const item=rows[i];if(!item)return;const active=!['cancelled','rejected','refund_requested','refund_processing','refunded'].includes(item.status);if(active&&!card.querySelector('[data-refund-request]')){let actions=card.querySelector('.entry-public-actions');if(!actions){actions=document.createElement('div');actions.className='entry-public-actions';card.appendChild(actions);}const b=document.createElement('button');b.type='button';b.className='btn btn-danger-outline btn-small stage3561-refund-btn';b.dataset.refundRequest=item.id;b.textContent=item.paid||item.paymentStatus==='paid'?'취소·환불 요청':'참가 취소 요청';actions.appendChild(b);}if(['refund_requested','refund_processing'].includes(item.status))card.insertAdjacentHTML('beforeend','<span class="stage3561-badge">취소·환불 처리 중</span>');});};
  const originalRenderApplications=renderApplicationPortal;renderApplicationPortal=function(){originalRenderApplications.apply(this,arguments);setTimeout(renderRefundAdmin,0)};
  document.addEventListener('submit',e=>{if(e.target?.id==='stage3561ProfileForm')saveProfile(e);if(e.target?.id==='stage3561RefundForm')submitRefund(e)},true);
  document.addEventListener('click',e=>{const req=e.target.closest?.('[data-refund-request]');if(req){openRefund(req.dataset.refundRequest);return}if(e.target.closest?.('[data-stage3561-refund-close]'))document.getElementById('stage3561RefundDialog')?.close();if(e.target.closest?.('[data-refund-settings-save]'))saveRefundSettings();const p=e.target.closest?.('[data-refund-processing]');if(p){const r=findRefund(p.dataset.refundProcessing);if(r){r.status='processing';r.processingAt=now();commit('환불 처리 중 전환');renderRefundAdmin();}}const c=e.target.closest?.('[data-refund-complete]');if(c)completeRefund(c.dataset.refundComplete);const x=e.target.closest?.('[data-refund-reject]');if(x)rejectRefund(x.dataset.refundReject);},true);
  const applyBuild=()=>{installProfileDialog();ensureRefundState();const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 35.6.1 · 회원등록·선수결과·취소환불';label.title='Version 35.6.1';}document.documentElement.dataset.build='3561';if(currentAuthUser)setTimeout(showProfileDialog,300);setTimeout(renderRefundAdmin,500)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyBuild,{once:true});else setTimeout(applyBuild,0);
  console.info('[230MATCH] 35.6.1 ready · mandatory profile and refund workflow');
})();


/* Stage 35.6.2 · member header, profile settings and direct logout */
(function stage3562MemberHeader(){
  const byId=id=>document.getElementById(id);
  function ensureHeaderLogout(){
    let btn=byId('directHeaderLogoutBtn');
    if(btn)return btn;
    const login=byId('openSocialLoginBtn');
    if(!login)return null;
    btn=document.createElement('button');
    btn.id='directHeaderLogoutBtn';
    btn.type='button';
    btn.className='btn btn-light';
    btn.textContent='로그아웃';
    btn.hidden=true;
    btn.addEventListener('click',async event=>{
      event.preventDefault();event.stopPropagation();
      if(!currentAuthUser)return;
      if(!confirm(`${authUserLabel()} 계정에서 로그아웃할까요?`))return;
      await handleSocialLogout();
    });
    login.insertAdjacentElement('afterend',btn);
    return btn;
  }
  function populateMemberProfileDialog(editMode=true){
    if(!currentAuthUser)return openSocialLogin();
    if(typeof installProfileDialog === 'function') installProfileDialog();
    const p=currentAuthUser.appProfile||{},d=p.registrationDefaults||{};
    const set=(id,v)=>{const el=byId(id);if(el)el.value=v??''};
    set('stage3561Name',p.name||d.name||currentAuthUser.displayName||'');
    set('stage3561Phone',p.phone||d.phone||'');
    set('stage3561Club',p.club||d.club||p.affiliation||'');
    set('stage3561Career',p.career||'');set('stage3561Gender',p.gender||'');set('stage3561BirthYear',p.birthYear||'');
    const agree=byId('stage3561Agree');if(agree)agree.checked=Boolean(p.profileCompleted||editMode);
    const dlg=byId('stage3561ProfileDialog');if(!dlg)return;
    const h=dlg.querySelector('.stage3561-head h2'),desc=dlg.querySelector('.stage3561-head span'),submit=dlg.querySelector('.stage3561-submit');
    if(h)h.textContent=editMode?'내 기본정보 설정':'회원 기본정보 등록';
    if(desc)desc.textContent=editMode?'이름·전화번호·클럽·구력을 확인하고 수정할 수 있습니다.':'최초 로그인 시 한 번만 등록합니다.';
    if(submit)submit.textContent=editMode?'회원정보 저장':'회원등록 완료';
    let cancel=byId('stage3562ProfileCloseBtn');
    if(editMode&&!cancel){
      cancel=document.createElement('button');cancel.id='stage3562ProfileCloseBtn';cancel.type='button';cancel.className='btn btn-light';cancel.textContent='닫기';
      cancel.style.cssText='width:100%;min-height:42px;margin-top:8px';cancel.onclick=()=>dlg.close();submit?.insertAdjacentElement('afterend',cancel);
    }
    if(cancel)cancel.hidden=!editMode;
    dlg.dataset.editMode=editMode?'1':'0';if(!dlg.open)dlg.showModal();
  }
  window.openMemberProfileSettings=()=>populateMemberProfileDialog(true);
  const baseRenderAuthStatus=renderAuthStatus;
  renderAuthStatus=function(){
    baseRenderAuthStatus.apply(this,arguments);
    const login=byId('openSocialLoginBtn'),logout=ensureHeaderLogout(),badge=byId('currentRoleBadge');
    if(login){
      login.textContent=currentAuthUser?`${authUserLabel()}님`:'간편로그인';
      login.title=currentAuthUser?'내 기본정보 설정':'간편로그인';
      login.setAttribute('aria-label',login.title);
    }
    if(logout)logout.hidden=!currentAuthUser;
    if(badge){
      badge.textContent=isAdmin()?'관리자':isOperator()?'진행자':'일반 선수';
      badge.title=isAdmin()?'관리자 설정 열기':currentAuthUser?'내 기본정보 설정':'로그인 및 내 설정';
    }
  };
  const baseApplyRoleUI=applyRoleUI;
  applyRoleUI=function(){baseApplyRoleUI.apply(this,arguments);setTimeout(()=>renderAuthStatus(),0)};
  function bindHeaderActions(){
    const badge=byId('currentRoleBadge');
    if(badge)badge.onclick=()=>{if(isAdmin()||isOperator())window.openAdminSettingsHub?.();else if(currentAuthUser)populateMemberProfileDialog(true);else openSocialLogin();};
    const login=byId('openSocialLoginBtn');
    if(login)login.addEventListener('click',event=>{if(!currentAuthUser)return;event.preventDefault();event.stopImmediatePropagation();populateMemberProfileDialog(true);},true);
    renderAuthStatus();
  }
  const baseLogout=handleSocialLogout;
  handleSocialLogout=async function(){await baseLogout.apply(this,arguments);currentAuthUser=null;currentRole='viewer';sessionStorage.setItem(ROLE_KEY,currentRole);applyRoleUI();renderAuthStatus();closeSocialLogin?.();};
  const applyBuild=()=>{bindHeaderActions();const label=byId('buildStageLabel');if(label){label.textContent='230MATCH 35.6.2 · 회원 설정·직접 로그아웃';label.title='Version 35.6.2';}document.documentElement.dataset.build='3562';};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(applyBuild,0),{once:true});else setTimeout(applyBuild,0);
  console.info('[230MATCH] 35.6.2 ready · named member header, profile settings, direct logout');
})();

/* Stage 35.6.3 · mobile member/admin header actions */
(function stage3563MobileHeaderActions(){
  const STYLE_ID='stage3563MobileHeaderStyle';
  function installStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      @media (max-width:720px){
        .top-actions{min-width:0!important;display:flex!important;align-items:center!important;justify-content:flex-end!important}
        .role-switch{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:4px!important;min-width:0!important;flex-wrap:nowrap!important}
        .role-switch #openSocialLoginBtn,
        .role-switch #currentRoleBadge,
        .role-switch #directHeaderLogoutBtn{
          display:inline-flex!important;align-items:center!important;justify-content:center!important;
          min-height:36px!important;height:36px!important;margin:0!important;border-radius:12px!important;
          padding:0 9px!important;font-size:12px!important;line-height:1!important;white-space:nowrap!important;
          max-width:92px!important;overflow:hidden!important;text-overflow:ellipsis!important;flex:0 1 auto!important;
        }
        .role-switch #openSocialLoginBtn{background:rgba(8,38,82,.76)!important;color:#fff!important;border:1px solid rgba(255,255,255,.16)!important;font-weight:800!important}
        .role-switch #currentRoleBadge{background:#fff!important;color:#14223c!important;border:0!important;font-weight:800!important;max-width:72px!important}
        .role-switch #directHeaderLogoutBtn{background:rgba(255,255,255,.15)!important;color:#fff!important;border:1px solid rgba(255,255,255,.28)!important;max-width:72px!important}
        .role-switch #directHeaderLogoutBtn[hidden]{display:none!important}
      }
      @media (max-width:420px){
        .brand-copy small{display:none!important}
        .role-switch{gap:3px!important}
        .role-switch #openSocialLoginBtn,
        .role-switch #currentRoleBadge,
        .role-switch #directHeaderLogoutBtn{height:34px!important;min-height:34px!important;padding:0 7px!important;font-size:11px!important}
        .role-switch #openSocialLoginBtn{max-width:76px!important}
        .role-switch #currentRoleBadge{max-width:62px!important}
        .role-switch #directHeaderLogoutBtn{max-width:62px!important}
      }
    `;
    document.head.appendChild(style);
  }
  function refreshLabels(){
    const login=document.getElementById('openSocialLoginBtn');
    const logout=document.getElementById('directHeaderLogoutBtn');
    const badge=document.getElementById('currentRoleBadge');
    if(login){
      login.textContent=currentAuthUser?`${authUserLabel()}님`:'로그인';
      login.title=currentAuthUser?'내 기본정보 설정 열기':'간편로그인';
    }
    if(logout){
      logout.textContent='로그아웃';
      logout.hidden=!currentAuthUser;
      logout.title='바로 로그아웃';
    }
    if(badge){
      badge.textContent=isAdmin()?'관리자':isOperator()?'진행자':'일반 선수';
      badge.title=isAdmin()||isOperator()?'관리자 설정 열기':currentAuthUser?'내 기본정보 설정 열기':'로그인';
    }
  }
  const previousRender=renderAuthStatus;
  renderAuthStatus=function(){previousRender.apply(this,arguments);installStyle();refreshLabels();};
  function bind(){
    installStyle();refreshLabels();
    const nameBtn=document.getElementById('openSocialLoginBtn');
    if(nameBtn&&!nameBtn.dataset.stage3563Bound){
      nameBtn.dataset.stage3563Bound='1';
      nameBtn.addEventListener('click',event=>{
        if(!currentAuthUser)return;
        event.preventDefault();event.stopImmediatePropagation();
        window.openMemberProfileSettings?.();
      },true);
    }
    const role=document.getElementById('currentRoleBadge');
    if(role&&!role.dataset.stage3563Bound){
      role.dataset.stage3563Bound='1';
      role.addEventListener('click',event=>{
        event.preventDefault();event.stopImmediatePropagation();
        if(isAdmin()||isOperator())window.openAdminSettingsHub?.();
        else if(currentAuthUser)window.openMemberProfileSettings?.();
        else openSocialLogin?.();
      },true);
    }
  }
  const apply=()=>{bind();const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 35.6.3 · 모바일 로그인·설정·로그아웃';label.title='Version 35.6.3';}document.documentElement.dataset.build='3563';};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,0),{once:true});else setTimeout(apply,0);
  window.addEventListener('resize',refreshLabels,{passive:true});
  console.info('[230MATCH] 35.6.3 ready · mobile member/admin header actions');
})();


/* Stage 35.6.5 · unified social + email/password authentication */
(function stage3565UnifiedAuthentication(){
  const ID='stage3565EmailAuth';
  const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function friendly(error){
    const code=String(error?.code||'');
    if(code.includes('invalid-credential')||code.includes('wrong-password')||code.includes('user-not-found'))return '이메일 또는 비밀번호가 올바르지 않습니다.';
    if(code.includes('email-already-in-use'))return '이미 가입된 이메일입니다. 기존 방식으로 로그인한 뒤 이메일 로그인을 연결하세요.';
    if(code.includes('credential-already-in-use'))return '이 이메일 로그인은 다른 계정에 연결되어 있습니다.';
    if(code.includes('weak-password'))return '비밀번호는 6자리 이상 입력하세요.';
    if(code.includes('invalid-email'))return '이메일 형식을 확인하세요.';
    if(code.includes('too-many-requests'))return '로그인 시도가 많습니다. 잠시 후 다시 시도하세요.';
    if(code.includes('operation-not-allowed'))return 'Firebase 콘솔에서 이메일/비밀번호 로그인을 활성화해야 합니다.';
    return error?.message||'로그인 처리 중 오류가 발생했습니다.';
  }
  function installStyle(){
    if(document.getElementById(ID+'Style'))return;
    const style=document.createElement('style');style.id=ID+'Style';style.textContent=`
      .stage3565-divider{display:flex;align-items:center;gap:10px;color:#8390a5;font-size:12px;margin:14px 0}.stage3565-divider:before,.stage3565-divider:after{content:"";height:1px;background:#dbe3ef;flex:1}
      .stage3565-email{border:1px solid #dbe4f1;border-radius:15px;padding:14px;background:#f8fbff}.stage3565-email h4{margin:0 0 4px;color:#102b54}.stage3565-email p{margin:0 0 11px;color:#63728a;font-size:12px;line-height:1.45}
      .stage3565-email label{display:block;margin:8px 0;font-size:12px;font-weight:800;color:#2d405e}.stage3565-email input{display:block;width:100%;box-sizing:border-box;margin-top:5px;height:42px;border:1px solid #cbd8ea;border-radius:11px;padding:0 12px;font-size:14px;background:white}
      .stage3565-email-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.stage3565-email-actions button{min-height:40px}.stage3565-email-actions .wide{grid-column:1/-1}
      .stage3565-linked{padding:11px;border-radius:11px;background:#eaf8ef;color:#17623a;font-weight:800;font-size:13px}.stage3565-message{min-height:18px;margin-top:8px!important;font-size:12px!important;font-weight:700}.stage3565-message.error{color:#b42318}.stage3565-message.success{color:#16754a}
      @media(max-width:520px){.social-login-card{max-height:92vh;overflow:auto}.stage3565-email-actions{grid-template-columns:1fr}.stage3565-email-actions .wide{grid-column:auto}}
    `;document.head.appendChild(style);
  }
  function block(){return document.getElementById(ID)}
  function setMessage(text,type=''){const el=document.getElementById(ID+'Message');if(el){el.textContent=text||'';el.className='stage3565-message '+type}}
  async function refresh(){
    const box=block();if(!box)return;
    const providers=currentAuthUser?await authProviderIds().catch(()=>[]):[];
    const linked=providers.includes('password');
    const email=currentAuthUser?.email||'';
    box.innerHTML=currentAuthUser?`
      <h4>일반로그인 연결</h4><p>간편로그인과 이메일 로그인을 같은 회원정보·참가 기록으로 이용합니다.</p>
      ${linked?`<div class="stage3565-linked">✓ 이메일 로그인이 연결되어 있습니다.<br><small>${escHtml(email)}</small></div>`:`
      <label>이메일<input id="${ID}Email" type="email" autocomplete="email" value="${escHtml(email)}" placeholder="example@email.com"></label>
      <label>사용할 비밀번호<input id="${ID}Password" type="password" autocomplete="new-password" placeholder="6자리 이상"></label>
      <div class="stage3565-email-actions"><button type="button" class="btn btn-primary wide" id="${ID}Link">이 계정에 이메일 로그인 연결</button></div>`}
      <p id="${ID}Message" class="stage3565-message"></p>`:`
      <h4>일반로그인</h4><p>이메일과 비밀번호로 로그인하거나 새 회원으로 가입할 수 있습니다.</p>
      <label>이메일<input id="${ID}Email" type="email" autocomplete="email" placeholder="example@email.com"></label>
      <label>비밀번호<input id="${ID}Password" type="password" autocomplete="current-password" placeholder="6자리 이상"></label>
      <div class="stage3565-email-actions"><button type="button" class="btn btn-primary" id="${ID}Login">로그인</button><button type="button" class="btn btn-light" id="${ID}Register">회원가입</button><button type="button" class="btn btn-light wide" id="${ID}Reset">비밀번호 재설정</button></div>
      <p id="${ID}Message" class="stage3565-message"></p>`;
    bind();
  }
  function values(){return{email:document.getElementById(ID+'Email')?.value.trim()||'',password:document.getElementById(ID+'Password')?.value||''}}
  function busy(btn,on){if(!btn)return;btn.disabled=on;btn.dataset.oldText=btn.dataset.oldText||btn.textContent;btn.textContent=on?'처리 중…':btn.dataset.oldText}
  function bind(){
    const login=document.getElementById(ID+'Login');if(login)login.onclick=async()=>{const v=values();busy(login,true);setMessage('');try{await signInEmail(v.email,v.password);closeSocialLogin();notice('로그인했습니다.','success')}catch(e){setMessage(friendly(e),'error')}finally{busy(login,false)}};
    const reg=document.getElementById(ID+'Register');if(reg)reg.onclick=async()=>{const v=values();if(!confirm(`${v.email} 주소로 새 회원가입을 진행할까요?`))return;busy(reg,true);setMessage('');try{await registerEmail(v.email,v.password);closeSocialLogin();notice('회원가입이 완료되었습니다. 기본정보를 등록하세요.','success')}catch(e){setMessage(friendly(e),'error')}finally{busy(reg,false)}};
    const reset=document.getElementById(ID+'Reset');if(reset)reset.onclick=async()=>{const v=values();busy(reset,true);setMessage('');try{await sendPasswordReset(v.email);setMessage('비밀번호 재설정 메일을 보냈습니다.','success')}catch(e){setMessage(friendly(e),'error')}finally{busy(reset,false)}};
    const link=document.getElementById(ID+'Link');if(link)link.onclick=async()=>{const v=values();if(!confirm('현재 회원정보에 이메일 로그인을 연결할까요?'))return;busy(link,true);setMessage('');try{await linkEmailPassword(v.email,v.password);currentAuthUser={...currentAuthUser,email:v.email};setMessage('이메일 로그인이 연결되었습니다. 다음부터 두 방식 모두 사용할 수 있습니다.','success');setTimeout(refresh,500)}catch(e){setMessage(friendly(e),'error')}finally{busy(link,false)}};
    const pass=document.getElementById(ID+'Password');if(pass&&!currentAuthUser)pass.onkeydown=e=>{if(e.key==='Enter')document.getElementById(ID+'Login')?.click()};
  }
  function install(){
    installStyle();const card=document.querySelector('#socialLoginModal .social-login-card');if(!card)return;
    const socialLogout=document.getElementById('socialLogoutBtn');
    let divider=document.getElementById(ID+'Divider');if(!divider){divider=document.createElement('div');divider.id=ID+'Divider';divider.className='stage3565-divider';divider.textContent='또는';(socialLogout||card.querySelector('p:last-child'))?.insertAdjacentElement('beforebegin',divider)}
    let box=block();if(!box){box=document.createElement('section');box.id=ID;box.className='stage3565-email';divider.insertAdjacentElement('afterend',box)}
    const head=card.querySelector('.social-login-head span');if(head)head.textContent='간편로그인 또는 이메일 로그인으로 이용하세요.';
    refresh();
  }
  const originalOpen=openSocialLogin;openSocialLogin=function(){originalOpen.apply(this,arguments);setTimeout(refresh,0)};
  const originalRender=renderAuthStatus;renderAuthStatus=function(){originalRender.apply(this,arguments);if(!document.getElementById('socialLoginModal')?.hidden)setTimeout(refresh,0)};
  const apply=()=>{install();refresh();const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 35.6.6 · A4·코트현황·일반로그인 수정';label.title='Version 35.6.6';}document.documentElement.dataset.build='3566'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,0),{once:true});else setTimeout(apply,0);
  console.info('[230MATCH] 35.6.5 ready · unified social and email/password authentication');
})();


/* Stage 35.6.8 · print assigned prelim courts + distinguish result-only/full resets */
(function stage3568ResultResetAndPrintFix(){
  const cloneValue=value=>value==null?value:structuredClone(value);
  const pendingTeam=(label,key)=>({id:key,name:label,placeholder:true});
  const clearResultFields=match=>{
    ['winner','loser','winnerId','loserId','scoreA','scoreB','completedAt','resultType','resultTypeLabel','resultEnteredBy','resultEnteredByUid','resultEnteredAt','resultUpdatedAt'].forEach(key=>{
      if(key==='scoreA'||key==='scoreB')match[key]=null;
      else if(key in match)delete match[key];
    });
  };
  function resetPrelimResultsOnly(){
    if(!requireAdmin('예선 경기결과만 초기화'))return;
    if(state.prelim?.lock?.locked){notice('예선 잠금 해제 후 경기결과를 초기화하세요.','warning');return;}
    const completed=(state.prelim?.matches||[]).filter(m=>m.status==='completed').length;
    if(!completed&&!confirm('완료된 예선 결과가 없습니다. 그래도 예선 순위와 결과 상태를 다시 초기화할까요?'))return;
    if(completed&&!confirm(`예선 ${completed}경기의 점수·승패·순위만 초기화합니다.\n\n조편성 및 코트배정은 유지됩니다. 계속할까요?`))return;
    try{saveRecovery(state,`${state.tournament?.name||'대회'} · 예선 경기결과 초기화 전`);}catch(_e){}
    ensurePrelimState(state);
    const groups=state.prelim.groups||[];
    const groupMap=new Map(groups.map(g=>[g.id,g]));
    (state.prelim.matches||[]).forEach(m=>{
      const g=groupMap.get(m.groupId),teams=g?.teams||[];
      clearResultFields(m);
      if(m.matchNo===1){m.teamA=cloneValue(teams[0]);m.teamB=cloneValue(teams[1]);m.status='ready';}
      else if(m.matchNo===2){m.teamA=pendingTeam('첫 경기 승자',`${m.groupId}-winner-m1`);m.teamB=cloneValue(teams[2]);m.status='waiting_dependency';}
      else if(m.matchNo===3){m.teamA=pendingTeam('첫 경기 패자',`${m.groupId}-loser-m1`);m.teamB=cloneValue(teams[2]);m.status='waiting_previous';}
      m.waitStartedAt=null;
    });
    groups.forEach(g=>{g.standings=[];g.nextMatchNo=1;});
    state.prelim.qualifiers=[];
    state.prelim.lock={locked:false,lockedAt:null,lockedBy:'',snapshot:null};
    // 동일한 조·구장 설정으로 코트 운영열만 다시 구성합니다.
    if(groups.length){try{assignPrelimCourts(state);}catch(_e){}}
    // 예선 결과로 확정되었던 연결 본선 슬롯은 아직 본선 경기가 시작되지 않았을 때만 재동기화 대상으로 돌립니다.
    if(!hasStartedMainMatches(state)){
      try{syncLinkedDraw({silent:true});}catch(_e){}
    }
    delete state.completion; if(state.tournament)delete state.tournament.completedAt;
    commit('예선 경기결과만 초기화 · 조편성·코트배정 유지');
    renderTournamentLifecycleManager();
    notice('예선 점수·승패·순위를 초기화했습니다. 조편성과 코트배정은 유지됩니다.','success');
  }
  function resetMainResultsOnly(){
    if(!requireAdmin('본선 경기결과만 초기화'))return;
    const matches=allMatches(state.draw||{rounds:{}});
    const completed=matches.filter(m=>m.status==='completed'&&!m.bye).length;
    if(!state.draw?.size||!matches.length){notice('초기화할 본선 대진이 없습니다.','warning');return;}
    if(!confirm(`본선 ${completed}경기의 점수·승패만 초기화합니다.\n\n본선 추첨 구조와 1회전 대진은 유지되며, 승자 진출로 채워진 다음 라운드는 비워집니다. 계속할까요?`))return;
    try{saveRecovery(state,`${state.tournament?.name||'대회'} · 본선 경기결과 초기화 전`);}catch(_e){}
    const sizes=Object.keys(state.draw.rounds||{}).map(Number).filter(Boolean).sort((a,b)=>b-a);
    const firstSize=sizes[0];
    sizes.forEach(size=>{
      (state.draw.rounds[size]||[]).forEach(m=>{
        clearResultFields(m);
        m.waitStartedAt=null;
        if(size!==firstSize){m.teamA=null;m.teamB=null;m.status='waiting_slots';m.bye=false;}
        else{
          const a=!!(m.teamA&&!m.teamA.placeholder),b=!!(m.teamB&&!m.teamB.placeholder);
          if(a&&b){m.status='ready';m.bye=false;}
          else if((a||b)&&!(m.teamA?.placeholder||m.teamB?.placeholder)){
            m.winner=cloneValue(m.teamA||m.teamB);m.status='completed';m.bye=true;
          }else{m.status='waiting_slots';m.bye=false;}
        }
      });
    });
    // BYE 승자만 다음 라운드에 다시 전달합니다.
    for(const size of sizes){
      if(size<=2)continue;
      for(const m of state.draw.rounds[size]||[]){
        if(m.bye&&m.winner&&m.nextMatchId){
          const next=findMatch(state.draw,m.nextMatchId);if(!next)continue;
          if(m.nextSlot===1)next.teamA=cloneValue(m.winner);else next.teamB=cloneValue(m.winner);
          if(next.teamA&&next.teamB)next.status='ready';
        }
      }
    }
    // 완료 결과가 사라졌으므로 본선 운영 큐는 재배정 전 상태로 정리합니다. 대진 자체는 유지됩니다.
    state.courts=[];state.sharedQueue=[];state.venueQueues={};
    delete state.completion;if(state.tournament)delete state.tournament.completedAt;
    commit('본선 경기결과만 초기화 · 추첨 대진 유지');
    renderTournamentLifecycleManager();
    notice('본선 점수·승패를 초기화했습니다. 추첨 대진은 유지되며 코트배정은 다시 실행해야 합니다.','success');
  }
  const originalResetTournamentScope=resetTournamentScope;
  resetTournamentScope=function(scope){
    if(scope==='prelim')return resetPrelimResultsOnly();
    if(scope==='main')return resetMainResultsOnly();
    return originalResetTournamentScope(scope);
  };
  function addFullResetButtons(){
    const prelimBtn=document.querySelector('[data-tournament-reset="prelim"]');
    const mainBtn=document.querySelector('[data-tournament-reset="main"]');
    if(prelimBtn){prelimBtn.textContent='예선 경기결과만 초기화';prelimBtn.title='조편성과 코트배정은 유지하고 점수·승패·순위만 삭제합니다.';}
    if(mainBtn){mainBtn.textContent='본선 경기결과만 초기화';mainBtn.title='본선 추첨 대진은 유지하고 점수·승패·진출 결과만 삭제합니다.';}
    const host=prelimBtn?.parentElement||mainBtn?.parentElement;
    if(!host||host.querySelector('[data-stage3568-full-prelim]'))return;
    const p=document.createElement('button');p.type='button';p.className='btn btn-danger-outline';p.dataset.stage3568FullPrelim='1';p.textContent='예선 조편성 전체 초기화';p.title='예선 조편성·코트배정·경기결과·순위를 모두 삭제합니다.';
    p.addEventListener('click',()=>{
      if(!requireAdmin('예선 조편성 전체 초기화'))return;
      if(prompt('예선 조편성·코트배정·결과·순위를 모두 삭제합니다. 계속하려면 “예선전체초기화”를 입력하세요.','')!=='예선전체초기화')return;
      try{saveRecovery(state,`${state.tournament?.name||'대회'} · 예선 전체 초기화 전`);}catch(_e){}
      resetPrelim(state);commit('예선 조편성 전체 초기화');renderTournamentLifecycleManager();notice('예선 조편성·코트배정·결과를 모두 초기화했습니다.','success');
    });
    const m=document.createElement('button');m.type='button';m.className='btn btn-danger-outline';m.dataset.stage3568FullMain='1';m.textContent='본선 대진 전체 초기화';m.title='본선 추첨 대진·코트배정·경기결과를 모두 삭제합니다.';
    m.addEventListener('click',()=>{
      if(!requireAdmin('본선 대진 전체 초기화'))return;
      if(prompt('본선 추첨 대진·코트배정·결과를 모두 삭제합니다. 계속하려면 “본선전체초기화”를 입력하세요.','')!=='본선전체초기화')return;
      try{saveRecovery(state,`${state.tournament?.name||'대회'} · 본선 전체 초기화 전`);}catch(_e){}
      resetMainDraw(state);commit('본선 대진 전체 초기화');renderTournamentLifecycleManager();notice('본선 추첨 대진·코트배정·결과를 모두 초기화했습니다.','success');
    });
    host.insertBefore(p,document.querySelector('[data-tournament-reset="courts"]')||null);
    host.insertBefore(m,document.querySelector('[data-tournament-reset="courts"]')||null);
  }
  const ready=()=>{addFullResetButtons();setTimeout(addFullResetButtons,500);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();


/* Stage 40.0.0 · multiple active tournaments with explicit selection */
function multiTournamentId(){return `tournament-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}
function cloneTournamentWorkspace(source=state){
  // 4.3 core: multiTournament contains other tournament snapshots. Exclude it BEFORE cloning.
  // This prevents every score/input save from cloning all tournaments in memory.
  const shallow={...(source||{})};delete shallow.multiTournament;
  return structuredClone(shallow);
}
function tournamentSummaryFromWorkspace(workspace,id,current=false){
  const s=workspace||{};const name=String(s.tournament?.name||'').trim();
  if(!isRealTournamentName(name))return null;
  const guide=s.portal?.guide||{};const prelim=s.prelim?.matches||[];
  const main=(()=>{try{return Object.values(s.draw?.rounds||{}).flat().filter(Boolean);}catch(_e){return [];}})();
  const active=(s.teams||[]).filter((t,i)=>t?.status!=='reserve'&&i<Number(s.prelim?.settings?.activeTeamCount||9999)).length;
  const reserve=Math.max(0,(s.teams||[]).length-active);
  const completed=Boolean(s.completion?.completedAt||s.tournament?.completedAt);
  const started=prelim.some(x=>x.status&&x.status!=='waiting')||main.some(x=>x.status&&x.status!=='waiting');
  return {id,current,name,division:s.tournament?.division||'',date:guide.date||'',venue:guide.venue||'',fee:guide.fee||'',active,reserve,status:completed?'completed':started?'ongoing':'recruiting',champion:'',runnerUp:'',thirds:[],prelimCompleted:prelim.filter(x=>x.status==='completed').length,prelimTotal:prelim.length,mainCompleted:main.filter(x=>x.status==='completed').length,mainTotal:main.length,detail:guide.detail||'',updatedAt:s.updatedAt||new Date().toISOString(),selectable:!completed,workspace:true};
}
function isRealTournamentName(value){const n=String(value||'').trim();return Boolean(n&&n!=='대회 준비 중'&&n!=='등록된 운영 대회 없음'&&n!=='이름 없는 대회');}
function ensureMultiTournamentRuntime(){
  state.multiTournament=state.multiTournament&&typeof state.multiTournament==='object'?state.multiTournament:{};
  state.multiTournament.tournaments=(Array.isArray(state.multiTournament.tournaments)?state.multiTournament.tournaments:[]).filter(r=>isRealTournamentName(r?.name||r?.snapshot?.tournament?.name));
  let activeId=String(state.multiTournament.activeTournamentId||state.tournament?.id||'').trim();
  const hasNamedTournament=isRealTournamentName(state.tournament?.name);
  if(!activeId&&!state.multiTournament.tournaments.length&&!hasNamedTournament){state.multiTournament.activeTournamentId='';state.multiTournament.noActiveTournament=true;state.tournament=state.tournament||{id:'',name:'',division:''};return state.multiTournament;}
  if(!activeId)activeId=state.multiTournament.tournaments[0]?.id||multiTournamentId();
  state.tournament=state.tournament||{};state.tournament.id=activeId;
  let record=state.multiTournament.tournaments.find(x=>x.id===activeId);
  if(!record&&hasNamedTournament){record={id:activeId,name:state.tournament.name,division:state.tournament.division||'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),snapshot:cloneTournamentWorkspace(state)};state.multiTournament.tournaments.push(record);}
  state.multiTournament.activeTournamentId=record?activeId:'';
  state.multiTournament.noActiveTournament=!record;
  return state.multiTournament;
}
function syncCurrentTournamentRuntime(){
  ensureMultiTournamentRuntime();
  if(!isRealTournamentName(state.tournament?.name)){
    const badId=String(state.multiTournament?.activeTournamentId||state.tournament?.id||'');
    state.multiTournament.tournaments=(state.multiTournament.tournaments||[]).filter(r=>r.id!==badId&&isRealTournamentName(r?.name||r?.snapshot?.tournament?.name));
    state.multiTournament.activeTournamentId=state.multiTournament.tournaments[0]?.id||'';state.multiTournament.noActiveTournament=!state.multiTournament.activeTournamentId;
    if(state.multiTournament.noActiveTournament)state.tournament={...(state.tournament||{}),id:'',name:'',division:''};
    return null;
  }
  if(state.multiTournament?.noActiveTournament||!state.multiTournament?.activeTournamentId)return null;
  try{if(typeof syncCurrentDivisionRuntime==='function')syncCurrentDivisionRuntime();}catch(_e){}
  const id=state.multiTournament.activeTournamentId;let record=state.multiTournament.tournaments.find(x=>x.id===id);
  if(!record){record={id,createdAt:new Date().toISOString()};state.multiTournament.tournaments.push(record);}
  state.tournament=state.tournament||{};state.tournament.id=id;
  record.name=state.tournament.name||'대회 준비 중';record.division=state.tournament.division||'';record.updatedAt=new Date().toISOString();record.snapshot=cloneTournamentWorkspace(state);
  return record;
}
function switchTournamentWorkspace(id){
  ensureMultiTournamentRuntime();id=String(id||'');if(!id||id===state.multiTournament.activeTournamentId)return;
  const record=state.multiTournament.tournaments.find(x=>x.id===id);if(!record?.snapshot){notice('선택한 대회 데이터를 찾을 수 없습니다.','error');return;}
  syncCurrentTournamentRuntime();
  const registry=structuredClone(state.multiTournament);const commonPortal={tournamentArchives:structuredClone(state.portal?.tournamentArchives||[]),archives:structuredClone(state.portal?.archives||[]),resultArchives:structuredClone(state.portal?.resultArchives||[]),tournamentTemplates:structuredClone(state.portal?.tournamentTemplates||[])};
  const next=structuredClone(record.snapshot);next.multiTournament=registry;next.multiTournament.activeTournamentId=id;next.tournament=next.tournament||{};next.tournament.id=id;next.portal={...(next.portal||{}),...commonPortal};
  state=normalizeV5RuntimeState(next);ensurePortalState();ensurePrelimState(state);ensureTimeState(state);ensureDrawMeta(state);ensureMessagingState(state);ensureContacts(state);ensureAuditState(state);ensureEarlyMainSettings(state);ensureVenueSettings(state);ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state);ensurePrelimCourtStatuses(state);ensureOperatorState();
  saveState(state);syncInputs();syncPrelimInputs();renderVenueSettingsEditor();
  render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});
  renderOperatorControls();applyRoleUI();renderPortalViews();renderDivisionWorkspaceBar();autoSmsSnapshot=buildAutoSmsSnapshot();
  try{pushStateNow(state).catch(()=>{});}catch(_e){}
  notice(`${state.tournament.name} 대회로 전환했습니다.`,'success');
}
function renderDivisionWorkspaceBar(){
  ensureMultiTournamentRuntime();ensureMultiDivisionRuntime();
  let bar=document.getElementById('divisionWorkspaceBar');
  if(!bar){bar=document.createElement('section');bar.id='divisionWorkspaceBar';bar.className='division-workspace-bar panel';const nav=document.querySelector('main.app-shell > nav.mode-tabs');if(nav)nav.insertAdjacentElement('afterend',bar);else document.querySelector('main.app-shell')?.prepend(bar);}
  const tournaments=(state.multiTournament.tournaments||[]).filter(r=>isRealTournamentName(r?.name||r?.snapshot?.tournament?.name));
  const divisions=state.multiDivision.divisions||[];
  if(!tournaments.length){bar.innerHTML='<div class="division-workspace-current"><span>현재 대회</span><strong>등록된 운영 대회 없음</strong></div><span class="division-workspace-count">새 대회를 만들어 시작하세요.</span>';applyRoleUI();return;}
  const labeled=tournamentSelectorLabels(tournaments);
  bar.innerHTML=`<div class="division-workspace-current"><span>현재 대회</span><label><span class="sr-only">현재 대회 선택</span><select id="activeTournamentSelect">${labeled.map(({record,label})=>`<option value="${escapeHtml(record.id)}" ${record.id===state.multiTournament.activeTournamentId?'selected':''}>${escapeHtml(label)}</option>`).join('')}</select></label></div><label><span class="sr-only">현재 부서</span><select id="activeDivisionSelect">${divisions.map(d=>`<option value="${escapeHtml(d.id)}" ${d.id===state.multiDivision.activeDivisionId?'selected':''}>${escapeHtml(d.name)}</option>`).join('')}</select></label><span class="division-workspace-count">대회 ${tournaments.length}개 · 부서 ${divisions.length}개</span><button type="button" id="openDivisionManagerBtn" class="btn btn-light btn-small" data-admin-only="true">부서 관리</button>`;
  bar.querySelector('#activeTournamentSelect')?.addEventListener('change',e=>{switchTournamentWorkspace(e.target.value);setTimeout(()=>{renderHomeTournamentCards();renderTournamentList();},0);});
  bar.querySelector('#activeDivisionSelect')?.addEventListener('change',e=>switchDivisionWorkspace(e.target.value));
  bar.querySelector('#openDivisionManagerBtn')?.addEventListener('click',openDivisionManager);applyRoleUI();
}

tournamentArchiveRows=function(){
  ensureMultiTournamentRuntime();syncCurrentTournamentRuntime();
  state.multiTournament.tournaments=(state.multiTournament.tournaments||[]).filter(r=>isRealTournamentName(r?.name||r?.snapshot?.tournament?.name));
  const active=state.multiTournament.tournaments.map(r=>{
    const isCurrent=r.id===state.multiTournament.activeTournamentId;
    const fallback={tournament:{id:r.id,name:r.name||'',division:r.division||''},portal:{guide:r.guide||{}},teams:[],prelim:{matches:[],settings:{}},draw:{rounds:{}},updatedAt:r.updatedAt||r.createdAt||new Date().toISOString()};
    const summary=tournamentSummaryFromWorkspace(isCurrent?state:(r.snapshot||fallback),r.id,isCurrent);
    if(!summary&&isRealTournamentName(r.name))return {...tournamentSummaryFromWorkspace(fallback,r.id,isCurrent),name:r.name,division:r.division||''};
    if(summary){summary.name=summary.name||r.name||'';summary.division=summary.division||r.division||'';}
    return summary;
  }).filter(Boolean);
  const modern=(state.portal?.archives||[]).map(archiveListItem);const legacy=(state.portal?.tournamentArchives||[]).filter(x=>!modern.some(m=>m.id===x.id));return [...active,...modern,...legacy];
}

async function deleteTournamentById(id){
  if(!requireAdmin('대회 삭제'))return;
  ensureMultiTournamentRuntime();id=String(id||'');const record=(state.multiTournament.tournaments||[]).find(r=>String(r.id)===id);if(!record)return;
  const name=record.name||record.snapshot?.tournament?.name||'선택한 대회';
  if(!confirm(`“${name}” 대회를 완전히 삭제할까요?\n\n참가팀·예선·본선·코트 데이터가 함께 삭제됩니다.\n종료 보관 기록은 유지됩니다.`))return;
  if(prompt('삭제하려면 “대회삭제”를 입력하세요.','')!=='대회삭제')return notice('확인 문구가 일치하지 않아 취소했습니다.','warning');
  const wasCurrent=id===state.multiTournament.activeTournamentId;
  state.multiTournament.tournaments=state.multiTournament.tournaments.filter(r=>String(r.id)!==id);
  if(wasCurrent){const next=state.multiTournament.tournaments[0];if(next?.snapshot){const registry=structuredClone(state.multiTournament);const restored=structuredClone(next.snapshot);restored.multiTournament=registry;restored.multiTournament.activeTournamentId=next.id;state=normalizeV5RuntimeState(restored);}else{state.multiTournament.activeTournamentId='';state.multiTournament.noActiveTournament=true;state.tournament={id:'',name:'',division:''};}}
  try{await deleteTournamentNow(id,state);}catch(error){notice(`서버 대회 삭제 실패: ${error?.message||error}`,'error');return;}
  saveState(state);renderPortalViews();renderDivisionWorkspaceBar();renderTournamentList();notice(`${name} 대회를 삭제했습니다.`,'success');
}
if(!window.__stage3572TournamentSelectBound){window.__stage3572TournamentSelectBound=true;document.addEventListener('click',e=>{const btn=e.target.closest('[data-active-tournament-switch]');if(btn){e.preventDefault();switchTournamentWorkspace(btn.dataset.activeTournamentSwitch);setTimeout(()=>{renderTournamentList();renderDivisionWorkspaceBar();},0);}});}
ensureMultiTournamentRuntime();syncCurrentTournamentRuntime();saveState(state);renderDivisionWorkspaceBar();





if(!window.__stage5006HomeTournamentBound){
  window.__stage5006HomeTournamentBound=true;
  document.addEventListener('click',async e=>{
    const select=e.target.closest('[data-home-tournament-select]');
    if(select){e.preventDefault();switchTournamentWorkspace(select.dataset.homeTournamentSelect);setTimeout(()=>{renderHomeTournamentCards();renderTournamentList();renderDivisionWorkspaceBar();},0);return;}
    const edit=e.target.closest('[data-home-tournament-edit]');
    if(edit){e.preventDefault();const id=edit.dataset.homeTournamentEdit;if(id!==state.multiTournament?.activeTournamentId)switchTournamentWorkspace(id);setTimeout(()=>{renderHomeTournamentCards();renderTournamentList();renderDivisionWorkspaceBar();stage329OpenTournamentEdit();},0);return;}
    const remove=e.target.closest('[data-home-tournament-delete]');
    if(remove){e.preventDefault();await deleteTournamentById(remove.dataset.homeTournamentDelete);renderHomeTournamentCards();return;}
  });
}
document.documentElement.dataset.build='5006';
console.info('[230MATCH] 50.0.7 ready · general view hides admin actions and profile dialog guard fixed');


/* Stage 50.0.8 · unified compact tournament list sourced from full multi-tournament registry */
function stage5008TournamentRows(){
  try{ensureMultiTournamentRuntime();}catch(_e){}
  const registry=Array.isArray(state.multiTournament?.tournaments)?state.multiTournament.tournaments:[];
  const activeId=String(state.multiTournament?.activeTournamentId||'');
  const activeRows=registry.map((record,index)=>{
    const id=String(record?.id||'');
    const current=id===activeId;
    const workspace=current?state:(record?.snapshot||{});
    const t=workspace?.tournament||{};
    const g=workspace?.portal?.guide||record?.guide||{};
    const name=String(t.name||record?.name||'').trim();
    if(!isRealTournamentName(name))return null;
    const prelim=Array.isArray(workspace?.prelim?.matches)?workspace.prelim.matches:[];
    let main=[];try{main=Object.values(workspace?.draw?.rounds||{}).flat().filter(Boolean);}catch(_e){}
    const teams=Array.isArray(workspace?.teams)?workspace.teams:[];
    const activeCount=teams.filter(x=>x?.status!=='reserve').length;
    return {
      id,current,workspace:true,readOnly:false,
      name,division:String(t.division||record?.division||''),
      date:String(g.date||record?.date||''),venue:String(g.venue||record?.venue||''),
      active:activeCount,reserve:teams.filter(x=>x?.status==='reserve').length,
      prelimCompleted:prelim.filter(x=>x?.status==='completed').length,prelimTotal:prelim.length,
      mainCompleted:main.filter(x=>x?.status==='completed').length,mainTotal:main.length,
      status:(workspace?.completion?.completedAt||t.completedAt)?'completed':(prelim.some(x=>x?.status&&x.status!=='waiting')||main.some(x=>x?.status&&x.status!=='waiting'))?'ongoing':'recruiting',
      updatedAt:record?.updatedAt||record?.createdAt||'',order:index
    };
  }).filter(Boolean);
  const archived=[];
  try{
    const modern=(state.portal?.archives||[]).map(archiveListItem);
    const legacy=(state.portal?.tournamentArchives||[]).filter(x=>!modern.some(m=>String(m.id)===String(x.id)));
    [...modern,...legacy].forEach(x=>archived.push({...x,workspace:false,readOnly:true,current:false}));
  }catch(_e){}
  return [...activeRows,...archived];
}
function stage5008RenderTournamentList(){
  const root=document.getElementById('tournamentCardList');if(!root)return;
  const q=String(document.getElementById('tournamentListSearch')?.value||'').trim().toLowerCase();
  const st=document.getElementById('tournamentListStatus')?.value||'all';
  const all=stage5008TournamentRows();
  const visible=all.filter(x=>(st==='all'||x.status===st)&&(!q||`${x.name} ${x.division} ${x.venue}`.toLowerCase().includes(q)));
  const counts={all:all.length,recruiting:all.filter(x=>x.status==='recruiting').length,ongoing:all.filter(x=>x.status==='ongoing').length,completed:all.filter(x=>x.status==='completed').length};
  const summary=document.getElementById('tournamentListSummary');if(summary)summary.textContent=`전체 ${counts.all}개 · 접수중 ${counts.recruiting} · 진행중 ${counts.ongoing} · 종료 ${counts.completed}`;
  root.classList.add('stage5008-compact-list');
  root.innerHTML=visible.map(x=>{
    const date=x.date?new Date(x.date+'T00:00:00').toLocaleDateString('ko-KR'):'일정 미정';
    const admin=isAdmin()&&!document.body.classList.contains('viewer-mode');
    const status=x.current?'현재 선택':x.status==='completed'?'종료':x.status==='ongoing'?'진행중':'접수중';
    const actions=x.workspace?`<div class="stage5008-actions"><button type="button" class="btn ${x.current?'btn-primary':'btn-light'} btn-small" data-active-tournament-switch="${portalEscape(x.id)}" ${x.current?'disabled':''}>${x.current?'선택됨':'이 대회 선택'}</button>${admin?`<button type="button" class="btn btn-light btn-small" data-edit-tournament-id="${portalEscape(x.id)}">수정·편집</button><button type="button" class="btn btn-danger-outline btn-small" data-delete-tournament-id="${portalEscape(x.id)}">삭제</button>`:''}</div>`:`<div class="stage5008-actions"><button type="button" class="btn btn-light btn-small" data-tournament-open="${portalEscape(x.id)}">대회 기록 보기</button></div>`;
    return `<article class="panel tournament-list-card stage5008-card ${x.current?'current':''}"><div class="stage5008-head"><div><span class="tournament-state ${portalEscape(x.status)}">${status}</span><h2>${portalEscape(x.name)}</h2><p>${portalEscape(x.division||'부서 미설정')}</p></div></div><div class="stage5008-meta"><span>📅 ${portalEscape(date)}</span><span>📍 ${portalEscape(x.venue||'장소 미정')}</span><span>👥 ${x.active||0}팀</span></div><div class="stage5008-progress"><span>예선 <b>${x.prelimCompleted||0}/${x.prelimTotal||0}</b></span><span>본선 <b>${x.mainCompleted||0}/${x.mainTotal||0}</b></span></div>${actions}</article>`;
  }).join('')||'<div class="panel portal-empty">조건에 맞는 대회가 없습니다.</div>';
  applyRoleUI?.();
}
renderTournamentList=stage5008RenderTournamentList;
if(!window.__stage5008ListBound){
  window.__stage5008ListBound=true;
  document.getElementById('tournamentListSearch')?.addEventListener('input',stage5008RenderTournamentList);
  document.getElementById('tournamentListStatus')?.addEventListener('change',stage5008RenderTournamentList);
  document.getElementById('tournamentListResetBtn')?.addEventListener('click',()=>{const q=document.getElementById('tournamentListSearch'),s=document.getElementById('tournamentListStatus');if(q)q.value='';if(s)s.value='all';stage5008RenderTournamentList();});
  document.addEventListener('click',async e=>{
    const edit=e.target.closest?.('[data-edit-tournament-id]');
    if(edit){e.preventDefault();e.stopImmediatePropagation();const id=edit.dataset.editTournamentId;if(id!==state.multiTournament?.activeTournamentId)switchTournamentWorkspace(id);setTimeout(()=>{stage5008RenderTournamentList();renderDivisionWorkspaceBar();stage329OpenTournamentEdit();},0);return;}
    const del=e.target.closest?.('[data-delete-tournament-id]');
    if(del){e.preventDefault();e.stopImmediatePropagation();await deleteTournamentById(del.dataset.deleteTournamentId);stage5008RenderTournamentList();renderHomeTournamentCards?.();}
  },true);
}
if(!document.getElementById('stage5008CompactCss')){
  const style=document.createElement('style');style.id='stage5008CompactCss';style.textContent=`
  #tournamentCardList.stage5008-compact-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .stage5008-card{padding:16px!important;min-height:0!important}
  .stage5008-head h2{font-size:18px;margin:7px 0 3px;line-height:1.3}.stage5008-head p{margin:0;color:#65758b}
  .stage5008-meta{display:flex;flex-wrap:wrap;gap:8px 16px;margin:12px 0 8px;font-size:13px;color:#53657c}
  .stage5008-progress{display:flex;gap:18px;padding:9px 0;border-top:1px solid #e4eaf2;font-size:13px}.stage5008-progress b{margin-left:4px}
  .stage5008-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:8px}.stage5008-actions:has(>button:only-child){grid-template-columns:1fr}
  @media(max-width:760px){#tournamentCardList.stage5008-compact-list{grid-template-columns:1fr}.stage5008-card{padding:13px!important}.stage5008-actions{grid-template-columns:1fr}.stage5008-meta{gap:6px 10px}}
  `;document.head.appendChild(style);
}
try{stage5008RenderTournamentList();}catch(_e){}
document.documentElement.dataset.build='5008';
console.info('[230MATCH] 60.0.0 ready · clean per-tournament persistence core');

/* 230MATCH 4.0.2 · visible division workspace and single editor entry */
(function(){
  const esc=(v)=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const flatCount=(rounds)=>Object.values(rounds||{}).reduce((sum,row)=>sum+(Array.isArray(row)?row.length:0),0);
  function divisionCounts(record){
    const snap=record?.snapshot||{};
    const applications=Array.isArray(snap.portal?.applications)?snap.portal.applications.length:0;
    const teams=Array.isArray(snap.teams)?snap.teams.length:0;
    const prelim=Array.isArray(snap.prelim?.matches)?snap.prelim.matches.length:0;
    const main=flatCount(snap.draw?.rounds);
    return {applications,teams,prelim,main};
  }
  function divisionLabel(record){
    const c=divisionCounts(record);
    const participant=Math.max(c.applications,c.teams);
    return `신청 ${participant}팀 · 예선 ${c.prelim}경기 · 본선 ${c.main}경기`;
  }
  function currentDivision(){
    try{ensureMultiDivisionRuntime();}catch(_e){}
    return state.multiDivision?.divisions?.find(d=>String(d.id)===String(state.multiDivision?.activeDivisionId))||state.multiDivision?.divisions?.[0];
  }
  function renderVisibleDivisionBar(){
    try{ensureMultiTournamentRuntime();ensureMultiDivisionRuntime();}catch(_e){}
    let bar=document.getElementById('divisionWorkspaceBar');
    if(!bar){
      bar=document.createElement('section');bar.id='divisionWorkspaceBar';bar.className='division-workspace-bar panel';
      const nav=document.querySelector('main.app-shell > nav.mode-tabs');
      if(nav)nav.insertAdjacentElement('afterend',bar);else document.querySelector('main.app-shell')?.prepend(bar);
    }
    const tournaments=(state.multiTournament?.tournaments||[]).filter(r=>typeof isRealTournamentName==='function'?isRealTournamentName(r?.name||r?.snapshot?.tournament?.name):Boolean(r?.name));
    const divisions=state.multiDivision?.divisions||[];
    if(!tournaments.length){
      bar.innerHTML='<div class="division-v6002-empty"><strong>등록된 운영 대회 없음</strong><span>대회 목록에서 새 대회를 만들어 시작하세요.</span></div>';
      return;
    }
    const labels=typeof tournamentSelectorLabels==='function'?tournamentSelectorLabels(tournaments):tournaments.map(record=>({record,label:record.name||'대회'}));
    const activeId=String(state.multiDivision?.activeDivisionId||'');
    bar.innerHTML=`
      <div class="division-v6002-top">
        <div class="division-v6002-current">
          <span>현재 대회</span>
          <select id="activeTournamentSelect">${labels.map(({record,label})=>`<option value="${esc(record.id)}" ${String(record.id)===String(state.multiTournament?.activeTournamentId)?'selected':''}>${esc(label)}</option>`).join('')}</select>
        </div>
        <div class="division-v6002-title">
          <strong>부서 선택</strong>
          <span>부서마다 참가신청·예선·본선·코트·결과가 각각 따로 저장됩니다.</span>
        </div>
        <button type="button" class="btn btn-light btn-small" data-v6002-edit-divisions data-admin-only="true">부서 추가·설정</button>
      </div>
      <div class="division-v6002-grid">
        ${divisions.map((d,i)=>{
          const active=String(d.id)===activeId;
          const admin=typeof isAdmin==='function'&&isAdmin()&&!document.body.classList.contains('viewer-mode');
          const quick=active?`<div class="division-v6003-quick" data-v6003-quick-wrap>
            ${admin?`<button type="button" data-v6003-go="entry">참가 승인</button><button type="button" data-v6003-go="roster">참가팀</button><button type="button" data-v6003-go="prelim-public">예선</button><button type="button" data-v6003-go="operation">코트</button><button type="button" data-v6003-go="bracket">본선</button><button type="button" data-v6003-more>${window.__divisionV6003MoreOpen?'접기':'더보기'}</button>`:`<button type="button" data-v6003-go="entry">참가 신청</button><button type="button" data-v6003-go="my-match">내 경기</button><button type="button" data-v6003-go="prelim-public">예선 현황</button><button type="button" data-v6003-go="operation">코트 현황</button><button type="button" data-v6003-go="bracket">본선 대진표</button>`}
            ${admin?`<div class="division-v6003-more" ${window.__divisionV6003MoreOpen?'':'hidden'}><button type="button" data-v6003-go="messages">문자 센터</button><button type="button" data-v6003-go="print">출력 센터</button><button type="button" data-v6003-edit>부서 설정</button></div>`:''}
          </div>`:'';
          return `<div class="division-v6002-card ${active?'active':''}" data-v6002-division="${esc(d.id)}" role="button" tabindex="0">
            <span>${active?'현재 운영':`부서 ${i+1}`}</span>
            <strong>${esc(d.name||`부서 ${i+1}`)}</strong>
            <small>${esc(divisionLabel(d))}</small>
            <em>${active?'선택됨':'이 부서로 전환'}</em>
            ${quick}
          </div>`;
        }).join('')}
      </div>
      <div class="division-v6002-context">현재 화면의 참가자·경기·코트 데이터 기준: <strong>${esc(state.tournament?.name||'대회')} · ${esc(currentDivision()?.name||state.tournament?.division||'부서')}</strong></div>`;
    bar.querySelector('#activeTournamentSelect')?.addEventListener('change',e=>{
      switchTournamentWorkspace(e.target.value);
      setTimeout(()=>{renderVisibleDivisionBar();renderHomeTournamentCards?.();renderTournamentList?.();},0);
    });
    bar.querySelectorAll('[data-v6002-division]').forEach(card=>{
      const activate=()=>{
        const id=card.dataset.v6002Division;
        if(String(id)===String(state.multiDivision?.activeDivisionId))return;
        switchDivisionWorkspace(id);
        setTimeout(renderVisibleDivisionBar,0);
      };
      card.addEventListener('click',e=>{if(e.target.closest('button'))return;activate();});
      card.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();activate();}});
    });
    bar.querySelectorAll('[data-v6003-go]').forEach(btn=>btn.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      navigatePortalView?.(btn.dataset.v6003Go,{pushHistory:true});
    }));
    bar.querySelector('[data-v6003-more]')?.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      const menu=bar.querySelector('.division-v6003-more');if(!menu)return;
      const willOpen=menu.hidden;
      window.__divisionV6003MoreOpen=willOpen;
      menu.hidden=!willOpen;
      e.currentTarget.textContent=willOpen?'접기':'더보기';
    });
    bar.querySelector('[data-v6003-edit]')?.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      if(typeof requireAdmin==='function'&&!requireAdmin('부서 추가·설정'))return;
      stage329OpenTournamentEdit?.();
    });
    bar.querySelector('[data-v6002-edit-divisions]')?.addEventListener('click',()=>{
      if(typeof requireAdmin==='function'&&!requireAdmin('부서 추가·설정'))return;
      if(typeof stage329OpenTournamentEdit==='function')stage329OpenTournamentEdit();
      else if(typeof window.openDivisionManager==='function')window.openDivisionManager();
    });
    try{applyRoleUI();}catch(_e){}
  }
  renderDivisionWorkspaceBar=renderVisibleDivisionBar;
  window.renderDivisionWorkspaceBar=renderVisibleDivisionBar;
  window.openDivisionManager=function(){
    if(typeof requireAdmin==='function'&&!requireAdmin('부서 추가·설정'))return;
    if(typeof stage329OpenTournamentEdit==='function')stage329OpenTournamentEdit();
  };
  document.addEventListener('click',e=>{
    const legacy=e.target.closest?.('#openDivisionManagerBtn,[data-open-division-manager]');
    if(!legacy)return;
    e.preventDefault();e.stopImmediatePropagation();
    window.openDivisionManager();
  },true);
  const style=document.createElement('style');
  style.textContent=`
    #divisionWorkspaceBar{display:grid!important;gap:10px!important;padding:12px 14px!important}
    .division-v6002-top{display:grid;grid-template-columns:minmax(260px,1.1fr) minmax(300px,1.5fr) auto;gap:12px;align-items:end}
    .division-v6002-current{display:grid;gap:5px}.division-v6002-current>span,.division-v6002-title>span{font-size:12px;color:#667892}
    .division-v6002-current select{width:100%;min-height:42px;border:1px solid #c8d6e8;border-radius:10px;background:#fff;padding:0 12px;font-weight:700;color:#102d57}
    .division-v6002-title{display:grid;gap:3px}.division-v6002-title strong{font-size:15px;color:#102d57}
    .division-v6002-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}
    .division-v6002-card{display:grid;gap:4px;text-align:left;border:1px solid #cbd8e8;border-radius:12px;background:#fff;padding:10px 12px;color:#10233f;cursor:pointer}
    .division-v6003-quick{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-top:7px;padding-top:8px;border-top:1px solid #dbe5f1;cursor:default}
    .division-v6003-quick>button,.division-v6003-more>button{min-height:34px;border:1px solid #bfd0e5;border-radius:8px;background:#fff;color:#143861;font-size:12px;font-weight:800;cursor:pointer;padding:5px 7px}
    .division-v6003-quick>button:hover,.division-v6003-more>button:hover{background:#eaf3ff;border-color:#346aa6}
    .division-v6003-more{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.division-v6003-more[hidden]{display:none}
    .division-v6002-card:hover{border-color:#2a5a97;background:#f7faff}.division-v6002-card.active{border:2px solid #173f75;background:#eef5ff;padding:9px 11px}
    .division-v6002-card span{font-size:11px;color:#2e6e55;font-weight:800}.division-v6002-card strong{font-size:15px}.division-v6002-card small{font-size:11px;color:#687a91}.division-v6002-card em{font-style:normal;font-size:11px;font-weight:800;color:#17477e}
    .division-v6002-context{border-top:1px solid #e2e9f2;padding-top:8px;font-size:12px;color:#65768d}.division-v6002-context strong{color:#102d57}
    .division-v6002-empty{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.division-v6002-empty span{color:#687a91}
    @media(max-width:760px){.division-v6002-top{grid-template-columns:1fr}.division-v6002-grid{grid-template-columns:1fr 1fr}.division-v6002-card{padding:9px}.division-v6002-card.active{padding:8px}.division-v6003-quick{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:430px){.division-v6002-grid{grid-template-columns:1fr}.division-v6003-quick{grid-template-columns:repeat(2,minmax(0,1fr))}.division-v6003-more{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
  const rerender=()=>setTimeout(renderVisibleDivisionBar,0);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',rerender,{once:true});else rerender();
  window.addEventListener('hashchange',rerender);
  document.documentElement.dataset.build='6003';
  console.info('[230MATCH] 60.0.3 ready · active division quick routes with isolated context');
})();

/* 230MATCH 4.1.0 · one-pass multi-division operational binding */
(()=>{
  const clone=v=>{try{return structuredClone(v)}catch(_e){try{return JSON.parse(JSON.stringify(v))}catch(_x){return v}}};
  const activeDivision=()=>{
    try{ensureMultiDivisionRuntime?.()}catch(_e){}
    return state.multiDivision?.divisions?.find(d=>String(d.id)===String(state.multiDivision?.activeDivisionId))||state.multiDivision?.divisions?.[0]||null;
  };
  const context=()=>({
    tournamentId:String(state.tournament?.id||state.multiTournament?.activeTournamentId||''),
    tournamentName:String(state.tournament?.name||''),
    divisionId:String(activeDivision()?.id||''),
    divisionName:String(activeDivision()?.name||state.tournament?.division||'')
  });
  const stamp=(row,ctx)=>{
    if(!row||typeof row!=='object')return row;
    row.tournamentId=row.tournamentId||ctx.tournamentId;
    row.tournamentName=row.tournamentName||ctx.tournamentName;
    row.divisionId=ctx.divisionId;
    row.divisionName=ctx.divisionName;
    if('tournamentDivision' in row||row.teamName||row.status)row.tournamentDivision=ctx.divisionName;
    return row;
  };
  const stampArray=(rows,ctx)=>Array.isArray(rows)&&rows.forEach(r=>stamp(r,ctx));
  function normalizeActiveDivisionData(){
    const ctx=context();
    if(!ctx.divisionId)return ctx;
    stampArray(state.teams,ctx);stampArray(state.entryRecords,ctx);stampArray(state.contacts,ctx);
    stampArray(state.portal?.applications,ctx);stampArray(state.portal?.refundRequests,ctx);
    stampArray(state.prelim?.activeTeams,ctx);stampArray(state.prelim?.reserveTeams,ctx);stampArray(state.prelim?.groups,ctx);stampArray(state.prelim?.matches,ctx);stampArray(state.prelim?.qualifiers,ctx);
    if(state.draw?.rounds&&typeof state.draw.rounds==='object')Object.values(state.draw.rounds).forEach(rows=>stampArray(rows,ctx));
    stampArray(state.draw?.matches,ctx);stampArray(state.courts,ctx);stampArray(state.sharedQueue,ctx);stampArray(state.messaging?.queue,ctx);stampArray(state.messages,ctx);
    state.activeContext={...ctx,updatedAt:new Date().toISOString()};
    return ctx;
  }
  const originalCapture=typeof captureCurrentDivisionSnapshot==='function'?captureCurrentDivisionSnapshot:null;
  if(originalCapture)captureCurrentDivisionSnapshot=function(source=state){if(source===state)normalizeActiveDivisionData();return originalCapture(source)};
  const originalSync=typeof syncCurrentDivisionRuntime==='function'?syncCurrentDivisionRuntime:null;
  if(originalSync)syncCurrentDivisionRuntime=function(){normalizeActiveDivisionData();return originalSync()};
  const originalApply=typeof applyDivisionSnapshot==='function'?applyDivisionSnapshot:null;
  if(originalApply)applyDivisionSnapshot=function(record){const ok=originalApply(record);if(ok)normalizeActiveDivisionData();return ok};
  const originalPersist=typeof safePersistState==='function'?safePersistState:null;
  if(originalPersist)safePersistState=function(label='현재 상태'){normalizeActiveDivisionData();try{syncCurrentDivisionRuntime?.()}catch(_e){}return originalPersist(label)};
  const originalSubmit=typeof submitPublicApplication==='function'?submitPublicApplication:null;
  if(originalSubmit)submitPublicApplication=function(){const before=state.portal?.applications?.length||0;const out=originalSubmit.apply(this,arguments);setTimeout(()=>{const ctx=normalizeActiveDivisionData();const rows=state.portal?.applications||[];rows.slice(before).forEach(r=>stamp(r,ctx));try{syncCurrentDivisionRuntime?.();saveState(state)}catch(_e){}},0);return out};
  const viewMap={
    'view-entry':'참가 신청·승인','view-roster':'참가팀 명단','view-prelim-public':'예선 현황','view-prelim':'예선 운영','view-operation':'코트 운영','view-bracket':'본선 대진표','view-messages':'문자 센터','view-print':'출력 센터','view-my-match':'내 경기'
  };
  function renderContextHeaders(){
    const ctx=context();
    Object.entries(viewMap).forEach(([id,label])=>{
      const host=document.getElementById(id);if(!host)return;
      let el=host.querySelector(':scope > .division-context-6100');
      if(!el){el=document.createElement('div');el.className='division-context-6100';host.prepend(el)}
      el.innerHTML=`<span>${label}</span><strong>${String(ctx.tournamentName||'대회 미선택').replace(/[<>&]/g,'')}</strong><em>${String(ctx.divisionName||'부서 미선택').replace(/[<>&]/g,'')}</em>`;
    });
  }
  function refreshAll(){normalizeActiveDivisionData();renderContextHeaders();try{renderDivisionWorkspaceBar?.()}catch(_e){}try{renderApplicationPortal?.()}catch(_e){}try{renderParticipantManager?.()}catch(_e){} }
  window.addEventListener('hashchange',()=>setTimeout(refreshAll,0));
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-v6002-division],[data-v6003-go],[data-s6001-save-all],[data-s6001-apply-division]'))setTimeout(refreshAll,80)},true);
  const style=document.createElement('style');style.textContent=`
    .division-context-6100{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 10px;padding:9px 12px;border:1px solid #c9d8ea;border-radius:10px;background:#f7faff;color:#183a64}
    .division-context-6100 span{font-size:11px;font-weight:800;color:#5f7188}.division-context-6100 strong{font-size:14px}.division-context-6100 em{font-style:normal;font-size:12px;font-weight:900;color:#0d6b4d;background:#e9f8f1;border-radius:999px;padding:3px 8px}
    @media(max-width:560px){.division-context-6100{padding:8px 9px}.division-context-6100 strong{width:100%;font-size:13px}}
  `;document.head.appendChild(style);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refreshAll,0),{once:true});else setTimeout(refreshAll,0);
  document.documentElement.dataset.build='6100';
  console.info('[230MATCH] 61.0.1 ready · persistent division more menu');
})();

/* 230MATCH 4.1.2 · mobile division workspace layout normalization */
(()=>{
  if(document.getElementById('stage6102MobileDivisionCss'))return;
  const style=document.createElement('style');
  style.id='stage6102MobileDivisionCss';
  style.textContent=`
  @media (max-width:760px){
    #divisionWorkspaceBar{
      display:block!important;
      width:100%!important;
      max-width:100%!important;
      min-width:0!important;
      margin:8px 0!important;
      padding:12px!important;
      overflow:visible!important;
      box-sizing:border-box!important;
    }
    #divisionWorkspaceBar, #divisionWorkspaceBar *{box-sizing:border-box!important;min-width:0}
    #divisionWorkspaceBar .division-v6002-top{
      display:flex!important;
      flex-direction:column!important;
      align-items:stretch!important;
      gap:10px!important;
      width:100%!important;
    }
    #divisionWorkspaceBar .division-v6002-current,
    #divisionWorkspaceBar .division-v6002-title{
      display:grid!important;
      grid-template-columns:1fr!important;
      gap:4px!important;
      width:100%!important;
      margin:0!important;
    }
    #divisionWorkspaceBar .division-v6002-current>span,
    #divisionWorkspaceBar .division-v6002-title>strong,
    #divisionWorkspaceBar .division-v6002-title>span{
      display:block!important;
      width:100%!important;
      writing-mode:horizontal-tb!important;
      word-break:keep-all!important;
      overflow-wrap:anywhere!important;
    }
    #divisionWorkspaceBar .division-v6002-current select{
      display:block!important;
      width:100%!important;
      max-width:100%!important;
      min-width:0!important;
      margin:0!important;
    }
    #divisionWorkspaceBar [data-v6002-edit-divisions]{
      width:100%!important;
      min-height:42px!important;
      margin:0!important;
    }
    #divisionWorkspaceBar .division-v6002-grid{
      display:grid!important;
      grid-template-columns:1fr!important;
      gap:9px!important;
      width:100%!important;
      margin-top:10px!important;
    }
    #divisionWorkspaceBar .division-v6002-card{
      width:100%!important;
      max-width:100%!important;
      padding:11px!important;
    }
    #divisionWorkspaceBar .division-v6002-card.active{padding:10px!important}
    #divisionWorkspaceBar .division-v6003-quick{
      display:grid!important;
      grid-template-columns:repeat(3,minmax(0,1fr))!important;
      gap:7px!important;
      width:100%!important;
    }
    #divisionWorkspaceBar .division-v6003-quick>button,
    #divisionWorkspaceBar .division-v6003-more>button{
      width:100%!important;
      min-height:42px!important;
      padding:7px 4px!important;
      line-height:1.2!important;
      white-space:normal!important;
      word-break:keep-all!important;
    }
    #divisionWorkspaceBar .division-v6003-more{
      grid-column:1/-1!important;
      display:grid!important;
      grid-template-columns:repeat(3,minmax(0,1fr))!important;
      gap:7px!important;
      width:100%!important;
    }
    #divisionWorkspaceBar .division-v6003-more[hidden]{display:none!important}
    #divisionWorkspaceBar .division-v6002-context{
      width:100%!important;
      margin-top:10px!important;
      line-height:1.45!important;
      word-break:keep-all!important;
      overflow-wrap:anywhere!important;
    }
  }
  @media (max-width:360px){
    #divisionWorkspaceBar .division-v6003-quick,
    #divisionWorkspaceBar .division-v6003-more{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  }
  `;
  document.head.appendChild(style);
  document.documentElement.dataset.build='6102';
  console.info('[230MATCH] 61.0.2 ready · mobile division workspace normalized');
})();


/* 230MATCH 4.1.3 · court-status direct SMS composer */
(()=>{
  const BUILD='6103';
  const smsEsc=value=>String(value??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  const digits=value=>String(value||'').replace(/\D/g,'');
  const isMobile=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');
  const canSend=()=>{try{return isAdmin()||isOperator();}catch(_e){return false;}};
  const getCourt=courtId=>[...(state.prelim?.courts||[]),...(state.courts||[])].find(c=>String(c.id)===String(courtId));
  const getMatch=id=>{if(!id)return null;const u=findUnifiedMatch(state,id);return u?.match||findPrelimMatch(state,id)||findMatch(state.draw,id)||null;};
  const teamText=team=>{try{return portalTeam(team)||smsTeamName(team)||'미정';}catch(_e){return team?.name||String(team||'미정');}};
  const matchTitle=match=>match?`${teamText(match.teamA)} vs ${teamText(match.teamB)}`:'경기 정보 없음';
  const recipientsFor=match=>{try{return smsMatchRecipients(match);}catch(_e){return [];}};
  const currentMeta=()=>({tournament:String(state.tournament?.name||'230MATCH 대회'),division:String(state.tournament?.division||'부서 미설정')});
  const defaultBody=(kind,court,match,position)=>{
    const {tournament,division}=currentMeta();
    const title=matchTitle(match);
    if(kind==='playing')return `[230MATCH]\n${tournament} · ${division}\n\n${title}\n${court?.name||'배정 코트'}에서 경기를 시작해 주세요.\n코트 주변에서 바로 입장해 주세요.`;
    return `[230MATCH]\n${tournament} · ${division}\n\n${title}\n${court?.name||'배정 코트'} 대기 ${position||1}번입니다.\n앞 경기 종료 후 바로 입장할 수 있도록 코트 주변에서 대기해 주세요.`;
  };
  const ensureHistory=()=>{state.messaging=state.messaging||{};if(!Array.isArray(state.messaging.courtSmsHistory))state.messaging.courtSmsHistory=[];return state.messaging.courtSmsHistory;};
  const duplicateRecent=(matchId,body)=>ensureHistory().find(x=>String(x.matchId)===String(matchId)&&x.body===body&&(Date.now()-new Date(x.at).getTime())<180000);
  const recordHistory=(item,channel,body)=>{const history=ensureHistory();history.unshift({id:`court-sms-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,at:new Date().toISOString(),channel,matchId:item.matchId,courtId:item.courtId,kind:item.kind,position:item.position,body,recipients:item.recipients.map(r=>({name:r.name,phone:digits(r.phone)})),tournamentId:state.tournament?.id||'',divisionId:state.multiDivision?.activeDivisionId||'',tournamentName:state.tournament?.name||'',divisionName:state.tournament?.division||''});state.messaging.courtSmsHistory=history.slice(0,200);};
  function installDialog(){
    if(document.getElementById('courtDirectSmsDialog'))return;
    document.body.insertAdjacentHTML('beforeend',`<dialog id="courtDirectSmsDialog" class="court-direct-sms-dialog"><form method="dialog" id="courtDirectSmsForm"><header><div><small>COURT MESSAGE</small><h3>코트 현황 문자 발송</h3></div><button type="button" data-court-sms-close aria-label="닫기">×</button></header><section class="court-direct-sms-summary"><strong id="courtDirectSmsTarget">대상 경기</strong><span id="courtDirectSmsMeta"></span><span id="courtDirectSmsRecipients"></span></section><div class="court-direct-sms-templates"><button type="button" data-court-sms-template="auto">기본 안내</button><button type="button" data-court-sms-template="custom">직접 작성</button></div><label class="court-direct-sms-label">문자 내용<textarea id="courtDirectSmsBody" rows="9" maxlength="1000"></textarea></label><fieldset><legend>발송 방식</legend><label><input type="radio" name="courtDirectSmsChannel" value="aligo" checked> 알리고 발송</label><label><input type="radio" name="courtDirectSmsChannel" value="phone"> 휴대폰 문자앱</label></fieldset><div id="courtDirectSmsNotice" class="court-direct-sms-notice">문구를 수정한 뒤 발송할 수 있습니다.</div><footer><button type="button" class="btn btn-light" data-court-sms-close>취소</button><button type="submit" class="btn btn-primary">선택한 방식으로 발송</button></footer></form></dialog>`);
    const dialog=document.getElementById('courtDirectSmsDialog');
    dialog.querySelectorAll('[data-court-sms-close]').forEach(b=>b.addEventListener('click',()=>dialog.close()));
    dialog.querySelector('[data-court-sms-template="auto"]').addEventListener('click',()=>{const item=dialog.__item;if(item)document.getElementById('courtDirectSmsBody').value=item.defaultBody;});
    dialog.querySelector('[data-court-sms-template="custom"]').addEventListener('click',()=>{const body=document.getElementById('courtDirectSmsBody');body.value='';body.focus();});
    dialog.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();await sendFromDialog();});
  }
  function openDialog(data){
    if(!canSend()){notice('관리자 또는 진행자로 로그인해야 코트 문자를 발송할 수 있습니다.','warning');return;}
    installDialog();
    const court=getCourt(data.courtId);const match=getMatch(data.matchId);if(!court||!match){notice('문자를 보낼 경기 정보를 찾지 못했습니다.','error');return;}
    const recipients=recipientsFor(match);const position=Number(data.position||1);const item={...data,court,match,position,recipients,defaultBody:defaultBody(data.kind,court,match,position)};
    const dialog=document.getElementById('courtDirectSmsDialog');dialog.__item=item;
    document.getElementById('courtDirectSmsTarget').textContent=matchTitle(match);
    document.getElementById('courtDirectSmsMeta').textContent=`${state.tournament?.name||''} · ${state.tournament?.division||''} · ${court.name||''} · ${data.kind==='playing'?'시합 시작':`대기 ${position}번`}`;
    document.getElementById('courtDirectSmsRecipients').textContent=recipients.length?`수신 ${recipients.length}명 · ${recipients.map(r=>r.name||r.phone).join(', ')}`:'등록된 수신번호 없음';
    document.getElementById('courtDirectSmsBody').value=item.defaultBody;
    const noticeBox=document.getElementById('courtDirectSmsNotice');noticeBox.className='court-direct-sms-notice';noticeBox.textContent=recipients.length?'자동 문구를 확인하고 필요하면 수정하세요.':'참가팀 연락처를 먼저 등록하세요.';
    dialog.showModal();
  }
  async function sendFromDialog(){
    const dialog=document.getElementById('courtDirectSmsDialog'),item=dialog?.__item;if(!item)return;
    const body=String(document.getElementById('courtDirectSmsBody')?.value||'').trim();const channel=document.querySelector('input[name="courtDirectSmsChannel"]:checked')?.value||'aligo';const box=document.getElementById('courtDirectSmsNotice');
    if(!body){box.className='court-direct-sms-notice error';box.textContent='문자 내용을 입력하세요.';return;}
    if(!item.recipients.length){box.className='court-direct-sms-notice error';box.textContent='등록된 휴대전화 번호가 없습니다.';return;}
    if(duplicateRecent(item.matchId,body)&&!confirm('같은 경기와 같은 내용의 문자가 최근 3분 이내 처리되었습니다. 그래도 다시 보낼까요?'))return;
    try{
      box.className='court-direct-sms-notice info';box.textContent=channel==='aligo'?'알리고로 발송 중입니다...':'휴대폰 문자앱을 준비하고 있습니다...';
      if(channel==='aligo'){
        await sendAligoSmsV3(item.recipients,body,{source:'court_manual',kind:item.kind,matchId:item.matchId,courtId:item.courtId,title:'230MATCH 코트 안내'});
        recordHistory(item,'aligo',body);commit(`코트 문자 알리고 발송 · ${item.court.name} · ${matchTitle(item.match)}`);notice(`알리고 문자 ${item.recipients.length}명 발송 완료`,'success');dialog.close();
      }else{
        const phones=item.recipients.map(r=>digits(r.phone)).filter(Boolean);
        if(isMobile())location.href=`sms:${phones.join(',')}?body=${encodeURIComponent(body)}`;
        else{await navigator.clipboard?.writeText(`${phones.join('\n')}\n\n${body}`);notice('PC에서는 수신번호와 문자 내용을 클립보드에 복사했습니다.','success');}
        recordHistory(item,'phone',body);commit(`코트 문자앱 열기 · ${item.court.name} · ${matchTitle(item.match)}`);dialog.close();
      }
    }catch(error){box.className='court-direct-sms-notice error';box.textContent=`발송 실패: ${error?.message||error}`;notice(`코트 문자 발송 실패: ${error?.message||error}`,'error');}
  }
  function addButton(parent,data,label='문자'){
    if(!parent||parent.querySelector(`[data-court-direct-sms="${data.kind}:${data.matchId}"]`))return;
    const b=document.createElement('button');b.type='button';b.className='btn btn-light court-direct-sms-btn';b.textContent=label;b.dataset.courtDirectSms=`${data.kind}:${data.matchId}`;b.dataset.courtId=data.courtId;b.dataset.matchId=data.matchId;b.dataset.kind=data.kind;b.dataset.position=String(data.position||1);parent.appendChild(b);
  }
  function enhanceGrid(root){
    if(!root||!canSend())return;
    root.querySelectorAll('.prelim-court-card').forEach(card=>{
      const anyTransfer=card.querySelector('[data-unified-transfer]');const courtId=anyTransfer?.dataset.unifiedTransfer||card.querySelector('[data-prelim-court-status]')?.dataset.prelimCourtStatus;if(!courtId)return;
      const court=getCourt(courtId);if(!court)return;
      const playing=card.querySelector('.prelim-court-slot.playing');const playId=playing?.querySelector('[data-prelim-result]')?.dataset.prelimResult||playing?.querySelector('[data-main-result]')?.dataset.mainResult||court.playing;
      if(playId){let actions=playing.querySelector('.unified-card-actions');if(!actions){actions=document.createElement('div');actions.className='unified-card-actions';playing.appendChild(actions);}addButton(actions,{courtId,matchId:playId,kind:'playing',position:0},'문자');}
      const wait=card.querySelector('.prelim-court-slot.wait1');if(court.wait1&&wait){let actions=wait.querySelector('.unified-card-actions');if(!actions){actions=document.createElement('div');actions.className='unified-card-actions';wait.appendChild(actions);}addButton(actions,{courtId,matchId:court.wait1,kind:'waiting',position:1},'문자');}
      card.querySelectorAll('.prelim-extra-item').forEach((row,index)=>{const matchId=Array.isArray(court.queue)?court.queue[index]:'';if(matchId)addButton(row,{courtId,matchId,kind:'waiting',position:index+2},'문자');});
    });
  }
  function enhanceAll(){enhanceGrid(document.getElementById('operationUnifiedCourtGrid'));enhanceGrid(document.getElementById('prelimCourtOperationGrid'));}
  document.addEventListener('click',event=>{const b=event.target.closest('[data-court-direct-sms]');if(!b)return;event.preventDefault();event.stopPropagation();openDialog({courtId:b.dataset.courtId,matchId:b.dataset.matchId,kind:b.dataset.kind,position:Number(b.dataset.position||1)});},true);
  let smsEnhanceQueued=false;
  const observer=new MutationObserver(()=>{if(smsEnhanceQueued)return;smsEnhanceQueued=true;requestAnimationFrame(()=>{smsEnhanceQueued=false;enhanceAll();});});
  const start=()=>{
    installDialog();enhanceAll();
    const roots=[document.getElementById('operationUnifiedCourtGrid'),document.getElementById('prelimCourtOperationGrid')].filter(Boolean);
    roots.forEach(root=>observer.observe(root,{childList:true,subtree:true}));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  const style=document.createElement('style');style.textContent=`
    .court-direct-sms-btn{margin-left:6px!important;white-space:nowrap!important}
    .prelim-extra-item>.court-direct-sms-btn{margin-left:auto!important}
    .court-direct-sms-dialog{width:min(680px,calc(100vw - 24px));max-height:90vh;border:0;border-radius:18px;padding:0;box-shadow:0 24px 80px rgba(7,30,65,.35)}
    .court-direct-sms-dialog::backdrop{background:rgba(5,22,48,.62)}
    .court-direct-sms-dialog form{display:flex;flex-direction:column;max-height:90vh;background:#fff}
    .court-direct-sms-dialog header{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 22px;background:#123866;color:#fff}
    .court-direct-sms-dialog header small{font-weight:800;letter-spacing:.08em}.court-direct-sms-dialog header h3{margin:4px 0 0;font-size:22px}
    .court-direct-sms-dialog header button{width:42px;height:42px;border:0;border-radius:12px;background:#fff;color:#102f57;font-size:24px;font-weight:900}
    .court-direct-sms-summary{display:grid;gap:5px;padding:16px 22px;background:#f4f8fd;border-bottom:1px solid #d8e3f1}.court-direct-sms-summary span{font-size:13px;color:#52677e}
    .court-direct-sms-templates{display:flex;gap:8px;padding:14px 22px 0}.court-direct-sms-templates button{border:1px solid #b9cce4;background:#fff;border-radius:10px;padding:9px 14px;font-weight:800;color:#123866}
    .court-direct-sms-label{display:grid;gap:7px;padding:14px 22px;font-weight:800}.court-direct-sms-label textarea{width:100%;box-sizing:border-box;resize:vertical;border:1px solid #b9cce4;border-radius:12px;padding:13px;font:inherit;line-height:1.5}
    .court-direct-sms-dialog fieldset{display:flex;gap:20px;margin:0 22px 12px;padding:12px 14px;border:1px solid #d5e0ed;border-radius:12px}.court-direct-sms-dialog fieldset legend{font-weight:800;padding:0 6px}.court-direct-sms-dialog fieldset label{font-weight:700}
    .court-direct-sms-notice{margin:0 22px 14px;padding:10px 12px;border-radius:10px;background:#eef5ff;color:#284b73;font-size:13px}.court-direct-sms-notice.error{background:#fff0f0;color:#b3261e}.court-direct-sms-notice.info{background:#fff8df;color:#825b00}
    .court-direct-sms-dialog footer{display:flex;justify-content:flex-end;gap:9px;padding:14px 22px 20px;border-top:1px solid #e1e8f0;background:#fff}
    @media(max-width:600px){.court-direct-sms-dialog{width:calc(100vw - 12px)}.court-direct-sms-dialog header,.court-direct-sms-summary,.court-direct-sms-label{padding-left:15px;padding-right:15px}.court-direct-sms-templates{padding-left:15px;padding-right:15px}.court-direct-sms-dialog fieldset{margin-left:15px;margin-right:15px;flex-direction:column;gap:10px}.court-direct-sms-notice{margin-left:15px;margin-right:15px}.court-direct-sms-dialog footer{padding:12px 15px 16px}.unified-card-actions{flex-wrap:wrap}.prelim-extra-item{flex-wrap:wrap}.prelim-extra-item>.court-direct-sms-btn{margin-left:0!important}}
  `;document.head.appendChild(style);
  document.documentElement.dataset.build=BUILD;
  console.info('[230MATCH] 61.0.3 ready · direct court SMS via Aligo or phone app');
})();

/* 230MATCH 4.1.4 · update-safe prelim record preservation */
(()=>{document.documentElement.dataset.build='6104';console.info('[230MATCH] 61.0.4 ready · update-safe local cache and richer-state recovery');})();


/* 230MATCH 4.1.5 · division quick-route court target fix */
(()=>{
  function openDivisionCourtShortcut(event){
    const button=event.target?.closest?.('[data-v6003-go="operation"]');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try{
      navigatePortalView?.('operation',{pushHistory:true,focus:true});
      const view=document.getElementById('view-operation');
      if(view)view.dataset.operationMode='courts';
      try{setOperationSection?.('courts')}catch(_e){}
      document.querySelectorAll('#view-operation [data-operation-section]').forEach(btn=>{
        const active=btn.dataset.operationSection==='courts';
        btn.classList.toggle('active',active);
        btn.setAttribute('aria-pressed',String(active));
      });
      setTimeout(()=>document.querySelector('#view-operation .operation-mode-bar, #view-operation [data-operation-section="courts"], #view-operation h1, #view-operation h2')?.scrollIntoView({block:'start'}),50);
    }catch(error){
      console.error('[230MATCH 4.1.5] 부서 코트 바로가기 실패',error);
      location.hash='#operation';
    }
  }
  document.addEventListener('click',openDivisionCourtShortcut,true);
  document.documentElement.dataset.build='6105';
  console.info('[230MATCH] 61.0.5 ready · division court direct route and compressed cloud workspace');
})();


/* 230MATCH 4.1.6 · mobile app install/open guidance */
(()=>{
  const BUILD='6106';
  const PLAY_URL='https://play.google.com/store/apps/details?id=com.tennis230.match';
  const PACKAGE='com.tennis230.match';
  const HIDE_KEY='230match-app-install-prompt-hide-until';

  const ua=navigator.userAgent||'';
  const isAndroid=/Android/i.test(ua);
  const isIOS=/iPhone|iPad|iPod/i.test(ua) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  const isStandalone=window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone===true;
  const isAndroidWebView=/; wv\)|\bwv\b|Version\/\d+\.\d+ Chrome\/.* Mobile Safari\//i.test(ua);
  const isLikelyAppWebView=isAndroidWebView || /230\s*tennis\s*match|tennis230match/i.test(ua);

  function hiddenToday(){
    try{return Number(localStorage.getItem(HIDE_KEY)||0)>Date.now();}catch(_e){return false;}
  }
  function hideForToday(){
    try{
      const d=new Date(); d.setHours(23,59,59,999);
      localStorage.setItem(HIDE_KEY,String(d.getTime()));
    }catch(_e){}
  }
  function currentDeepPath(){
    return `${location.host}${location.pathname}${location.search}${location.hash}`.replace(/^\/+/, '');
  }
  function openAndroidApp(){
    const fallback=encodeURIComponent(PLAY_URL);
    const intent=`intent://${currentDeepPath()}#Intent;scheme=https;package=${PACKAGE};S.browser_fallback_url=${fallback};end`;
    location.href=intent;
  }
  function installStyles(){
    if(document.getElementById('appInstallPromptStyle'))return;
    const style=document.createElement('style');
    style.id='appInstallPromptStyle';
    style.textContent=`
      .app-install-prompt{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:18px;background:rgba(3,17,38,.66);backdrop-filter:blur(3px)}
      .app-install-prompt[hidden]{display:none!important}
      .app-install-card{width:min(440px,100%);overflow:hidden;border-radius:22px;background:#fff;box-shadow:0 26px 90px rgba(0,20,55,.36);font-family:inherit}
      .app-install-head{display:flex;align-items:center;gap:13px;padding:20px 20px 15px;background:linear-gradient(135deg,#092b58,#154b85);color:#fff}
      .app-install-logo{width:58px;height:58px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(145deg,#fff7cb,#d3a52b);border:3px solid #fff;color:#092b58;font-size:24px;font-weight:1000;box-shadow:0 5px 18px rgba(0,0,0,.2)}
      .app-install-title{min-width:0;flex:1}.app-install-title strong{display:block;font-size:20px;line-height:1.25}.app-install-title span{display:block;margin-top:4px;font-size:13px;opacity:.88}
      .app-install-close{width:38px;height:38px;border:0;border-radius:11px;background:rgba(255,255,255,.14);color:#fff;font-size:22px;font-weight:900;cursor:pointer}
      .app-install-body{padding:18px 20px 20px;color:#183451}.app-install-body p{margin:0 0 14px;line-height:1.55;font-size:14px}.app-install-points{display:grid;gap:7px;margin:0 0 17px;padding:0;list-style:none;font-size:13px}.app-install-points li:before{content:'✓';margin-right:8px;color:#1266b3;font-weight:900}
      .app-install-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}.app-install-actions button,.app-install-actions a{min-height:48px;border-radius:12px;padding:11px 10px;text-align:center;text-decoration:none;font:inherit;font-weight:900;cursor:pointer;box-sizing:border-box}
      .app-install-primary{border:0;background:#0b3c73;color:#fff}.app-install-store{display:grid;place-items:center;border:1px solid #aac2de;background:#f6f9fd;color:#0b3c73}.app-install-secondary{grid-column:1/-1;border:1px solid #d3deea;background:#fff;color:#40566d}
      .app-install-today{display:flex;justify-content:center;margin-top:12px}.app-install-today button{border:0;background:transparent;color:#6a7d91;text-decoration:underline;font:inherit;font-size:12px;cursor:pointer}
      .app-install-ios-guide{margin:12px 0 0;padding:12px;border-radius:12px;background:#eef5ff;color:#284d74;font-size:13px;line-height:1.55}
      @media(max-width:420px){.app-install-prompt{padding:10px;align-items:end}.app-install-card{border-radius:20px 20px 12px 12px}.app-install-actions{grid-template-columns:1fr}.app-install-secondary{grid-column:auto}.app-install-head{padding:16px}.app-install-body{padding:16px}.app-install-logo{width:50px;height:50px}}
    `;
    document.head.appendChild(style);
  }
  function buildPrompt(){
    installStyles();
    const wrap=document.createElement('div');
    wrap.className='app-install-prompt';
    wrap.id='appInstallPrompt';
    wrap.setAttribute('role','dialog');
    wrap.setAttribute('aria-modal','true');
    wrap.setAttribute('aria-label','230 테니스 매치 앱 안내');
    if(isAndroid){
      wrap.innerHTML=`<section class="app-install-card">
        <header class="app-install-head"><div class="app-install-logo">230</div><div class="app-install-title"><strong>230 테니스 매치 앱으로 이용하세요</strong><span>대회 참가신청과 경기 확인을 더 편리하게</span></div><button type="button" class="app-install-close" data-install-close aria-label="닫기">×</button></header>
        <div class="app-install-body"><p>앱이 설치되어 있다면 바로 열 수 있고, 설치되어 있지 않다면 Play 스토어에서 설치할 수 있습니다.</p>
        <ul class="app-install-points"><li>대회 검색 및 참가 신청</li><li>내 경기·예선·본선 현황 확인</li><li>운영 알림을 앱에서 편리하게 확인</li></ul>
        <div class="app-install-actions"><button type="button" class="app-install-primary" data-open-app>앱 열기</button><a class="app-install-store" href="${PLAY_URL}" target="_blank" rel="noopener">Play 스토어 설치</a><button type="button" class="app-install-secondary" data-web-continue>웹으로 계속</button></div>
        <div class="app-install-today"><button type="button" data-hide-today>오늘은 보지 않기</button></div></div></section>`;
    }else{
      wrap.innerHTML=`<section class="app-install-card">
        <header class="app-install-head"><div class="app-install-logo">230</div><div class="app-install-title"><strong>iPhone에서도 홈 화면 앱처럼 사용하세요</strong><span>별도 앱 설치 없이 Safari에서 추가할 수 있습니다</span></div><button type="button" class="app-install-close" data-install-close aria-label="닫기">×</button></header>
        <div class="app-install-body"><p>Safari의 공유 버튼을 누른 뒤 <b>‘홈 화면에 추가’</b>를 선택하면 230MATCH를 앱처럼 바로 실행할 수 있습니다.</p>
        <div class="app-install-ios-guide">Safari → 공유(□↑) → <b>홈 화면에 추가</b> → 추가</div>
        <div class="app-install-actions" style="margin-top:14px"><button type="button" class="app-install-primary app-install-secondary" data-web-continue>웹으로 계속</button></div>
        <div class="app-install-today"><button type="button" data-hide-today>오늘은 보지 않기</button></div></div></section>`;
    }
    wrap.addEventListener('click',e=>{
      if(e.target===wrap || e.target.closest('[data-install-close]') || e.target.closest('[data-web-continue]'))wrap.remove();
      if(e.target.closest('[data-hide-today]')){hideForToday();wrap.remove();}
      if(e.target.closest('[data-open-app]'))openAndroidApp();
    });
    document.body.appendChild(wrap);
  }
  function shouldShow(){
    if(!(isAndroid||isIOS))return false;
    if(isStandalone||isLikelyAppWebView||hiddenToday())return false;
    return true;
  }
  function start(){if(shouldShow())setTimeout(()=>{if(!document.getElementById('appInstallPrompt'))buildPrompt();},900);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
  document.documentElement.dataset.build=BUILD;
  console.info('[230MATCH] 61.0.6 ready · Android app open/install prompt and iPhone home-screen guide');
})();

console.log('[230MATCH] 61.0.7 ready · tournament guide center, direct guide routes and image registration');

console.info('[230MATCH] 61.0.9 ready · Firebase Storage images for guides/notices/popups');

/* 230MATCH 4.2.2 · clean navigation core */
(()=>{document.documentElement.dataset.build='6113';console.info('[230MATCH] 62.0.0 ready · root sync rewrite + nonblocking Storage + image-first guide');})();

console.info('[230MATCH] 62.0.0 core · single Firestore listener, lightweight save events, Storage-decoupled editor');
