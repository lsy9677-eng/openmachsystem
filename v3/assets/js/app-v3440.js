import{getAuthConfig,saveAuthConfig,startAuth,signInGoogle,signOutSocial,beginExternalLogin,getExistingLoginEndpoints}from'./auth-engine.js?v=332015';
import{getAuthRuntime}from'./auth-engine.js?v=332015';
import{notificationSupport,getStoredVapidKey,saveStoredVapidKey,enableMyPush,disableMyPush,queuePush,listPushJobs,listPushTokens}from'./notification-engine.js?v=332012';

import{loadState,saveState,clearState,saveRecovery,getRecoveries,getRecovery,deleteRecovery,prepareRecoveryStorage,initialState}from'./store.js?v=332012';
import{prepareTeams,generateDraw,allMatches,findMatch,generateLinkedDrawSlots,syncLinkedDrawQualifiers}from'./bracket-engine.js?v=332012';
import{ensureDrawMeta,canModifyDraw,createDrawWithMethod,lockDraw,unlockDrawForDevelopment,clearDrawHistory}from'./draw-method-engine.js?v=332012';
import{buildCourts,assignInitial,queueReadyMatches,refillCourt}from'./court-engine.js?v=332012';
import{submitResult}from'./result-engine.js?v=332012';
import{ensurePrelimState,generatePrelim,assignPrelimCourts,findPrelimMatch,submitPrelimResult,resetPrelim,autoFitPrelimGroups,swapActiveReserveTeam,isPrelimLocked,lockPrelim,unlockPrelim}from'./prelim-engine.js?v=332012';
import{downloadJson}from'./recovery.js?v=332012';
import{ensureTimeState,calculateTimeMetrics}from'./time-engine.js?v=332012';
import{ensureMessagingState,generatePlayingMessages,generateWait1Messages,generateCurrentCourtMessages,generateCurrentWaitMessages,generateAllTimeMessages,markMessageSent,deleteMessage,clearSentMessages,markAllSent,smsUri,refreshMessageContacts,mergePendingDuplicates,getMessageHistory}from'./message-engine.js?v=332012';
import{ensureContacts,getTeamContact,setTeamContact,validatePhone,exportContactData,importContactData}from'./contact-engine.js?v=332012';
import{render,teamText}from'./ui.js?v=332012';
import{ensureAuditState,runStateAudit,runPrelimSimulation,runFullSimulation,applyAuditResult}from'./audit-engine.js?v=332012';
import{earlyMainStats,markResolvedMainMatchesReady,canAssignEarlyMain,ensureEarlyMainSettings,autoAssignResolvedMain}from'./early-main-engine.js?v=332012';
import{useUnifiedCourts,prelimPriorityActive,enqueueReadyMainToUnifiedCourts,advanceUnifiedCourt,reconcileUnifiedMainQueues,findUnifiedMatch,moveUnifiedCourtMatchFlexible,reconcilePrelimCourtReservations}from'./unified-court-engine.js?v=3439';
import{shouldUseLinkedDraw,linkedDrawNeedsRepair,rebuildLinkedDraw,hasStartedMainMatches}from'./linked-draw-guard-engine.js?v=332012';
import{ensureVenueSettings,ensureVenueQueues,venuePreset,buildVenueCourts,prelimVenues,mainVenues}from'./venue-engine.js?v=332012';
import{moveQueueItem,reorderQueueItem}from'./queue-control-engine.js?v=332012';
import{availableCourtSlots,assignQueueMatchToCourt,returnWait1ToVenueQueue}from'./manual-court-engine.js?v=332012';

import{ensureCourtStatuses,pauseCourt,resumeCourt}from'./court-status-engine.js?v=332012';
import{ensureCourtManualQueues,assignToCourtManualQueue,moveCourtMatchFlexible,returnManualQueueItemToVenue,reorderCourtManualQueue}from'./court-manual-queue-engine.js?v=332012';
import{reorderPrelimQueue as reorderPrelimQueueItem,movePrelimQueuedMatch,returnPrelimWait1ToQueue}from'./prelim-queue-control-engine.js?v=332012';
import{ensurePrelimCourtStatuses,pausePrelimCourt,resumePrelimCourt}from'./prelim-court-status-engine.js?v=332012';
import{startStateSync,getSyncSettings,saveSyncSettings,connectCloudSync,disconnectCloudSync,pushStateNow,pullStateNow,testCloudConnection}from'./sync-engine.js?v=332012';
import{verifyAndRepairMainFlow}from'./main-flow-integrity-engine.js?v=332012';
import{finalizeTournamentCompletion}from'./tournament-completion-engine.js?v=332012';
import{listExistingTournaments,loadExistingTournament,convertExistingTournament}from'./legacy-firestore-bridge.js?v=332023';


const BUILD_LABEL='230MATCH 34.3.2 · 부서 관리 실동작·편집 통합 V3 테스트본';

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
const originalConsoleError=console.error.bind(console);console.error=(...args)=>{storeDiagnosticEntry({level:'error',message:args.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ').slice(0,2000)});originalConsoleError(...args);};
const originalConsoleWarn=console.warn.bind(console);console.warn=(...args)=>{storeDiagnosticEntry({level:'warning',message:args.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ').slice(0,2000)});originalConsoleWarn(...args);};
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
  const payload={format:'230MATCH_V3_FULL_BACKUP',schemaVersion:1,appBuild:BUILD_LABEL,exportedAt:new Date().toISOString(),state:structuredClone(state)};
  downloadJson(`230match-v3-full-${Date.now()}.json`,payload);
}
async function importFullBackup(file){
  let parsed;
  try{parsed=JSON.parse(await file.text());}catch(_error){throw new Error('백업 JSON 파일을 읽을 수 없습니다.');}
  const next=parsed?.format==='230MATCH_V3_FULL_BACKUP'?parsed.state:parsed?.currentState||parsed;
  if(!next?.tournament||!Array.isArray(next.teams))throw new Error('230MATCH V3 전체 백업 형식이 아닙니다.');
  await saveRecovery(state,'백업 불러오기 직전 자동 복구점');
  state=structuredClone(next);
  ensurePortalState();ensurePrelimState(state);ensureTimeState(state);ensureDrawMeta(state);ensureMessagingState(state);ensureContacts(state);ensureAuditState(state);ensureEarlyMainSettings(state);ensureVenueSettings(state);ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state);ensurePrelimCourtStatuses(state);ensureOperatorState();
  saveState(state);
  location.reload();
}

let state=loadState();
function ensurePortalState(){
  if(!state.portal||typeof state.portal!=='object')state.portal={};
  if(!Array.isArray(state.portal.posts))state.portal.posts=[{id:crypto.randomUUID(),title:'230MATCH 대회 안내',body:'대회 일정과 경기 진행 상황은 홈 화면과 경기 현황에서 확인해 주세요.',pinned:true,important:true,popup:false,startAt:'',endAt:'',createdAt:new Date().toISOString()}];
  state.portal.posts=state.portal.posts.map(post=>({...post,important:Boolean(post.important),popup:Boolean(post.popup),startAt:post.startAt||'',endAt:post.endAt||'',updatedAt:post.updatedAt||post.createdAt||new Date().toISOString()}));
  if(!Array.isArray(state.portal.resultArchives))state.portal.resultArchives=[];
  if(!Array.isArray(state.portal.tournamentArchives))state.portal.tournamentArchives=[];
  if(!Array.isArray(state.portal.participantArchives))state.portal.participantArchives=[];
  if(!Array.isArray(state.portal.tournamentTemplates))state.portal.tournamentTemplates=[];
  if(!Array.isArray(state.portal.applications))state.portal.applications=[];
  if(!state.portal.guide||typeof state.portal.guide!=='object')state.portal.guide={date:'',venue:'',fee:'',bank:'',account:'',paymentNote:'입금 확인 후 참가 확정됩니다.',detail:''};
}
ensurePortalState();ensurePrelimState(state);ensureTimeState(state);ensureDrawMeta(state);ensureMessagingState(state);ensureContacts(state);ensureAuditState(state);ensureEarlyMainSettings(state);ensureVenueSettings(state);ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state);ensurePrelimCourtStatuses(state);
function ensureOperatorState(){if(!state.operation||typeof state.operation!=='object')state.operation={};if(state.operation.autoAssignmentEnabled===undefined)state.operation.autoAssignmentEnabled=true;if(!Array.isArray(state.operation.heldMatches))state.operation.heldMatches=[];}
ensureOperatorState();
const ROLE_KEY='230match-v3-session-role';
const ADMIN_PIN_KEY='230match-v3-admin-pin';
const OPERATOR_PIN_KEY='230match-v3-operator-pin';
let currentRole=sessionStorage.getItem(ROLE_KEY)||'viewer';
let currentAuthUser=null;
function authUserLabel(){return currentAuthUser?.appProfile?.name||currentAuthUser?.displayName||currentAuthUser?.email||'로그인 사용자';}
function applyAuthenticatedRole(user,role='viewer',profile=null){
  currentAuthUser=user?{...user,appProfile:profile||null}:null;currentRole=user?role:'viewer';sessionStorage.setItem(ROLE_KEY,currentRole);applyRoleUI();renderAuthStatus();
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
    saveState(state);
    const check=loadState();
    if(!check||check.updatedAt!==state.updatedAt)throw new Error('저장 검증값이 일치하지 않습니다.');
    saveFailureNoticeShown=false;setSaveHealth('ok',`${context} 저장 완료 · ${new Date(state.updatedAt).toLocaleTimeString('ko-KR')}`);return true;
  }catch(error){
    console.error(`[230MATCH V3] ${context} 저장 실패`,error);setSaveHealth('error',error?.message||String(error));
    if(!saveFailureNoticeShown){saveFailureNoticeShown=true;notice('현재 상태를 브라우저에 저장하지 못했습니다. 전체 백업 JSON을 즉시 저장하고 브라우저 저장공간을 확인하세요.','error');}
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
function smsTeamName(team){return teamText(team)||team?.name||'참가팀';}
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
  const sender=state.messaging?.settings?.senderName||'230MATCH';const court=placement.court||match?.court||'배정 코트';
  const rows=[];for(const team of [match?.teamA,match?.teamB]){if(!team)continue;const opp=smsOpponent(match,team);let body='';
    if(kind==='start')body=`[${sender}] ${smsTeamName(team)}님, 지금 ${court} 코트 경기입니다. 상대팀: ${smsTeamName(opp)}. 즉시 코트로 이동해 주세요.`;
    else if(kind==='waiting')body=`[${sender}] ${smsTeamName(team)}님, ${court} 코트 대기 ${placement.position||1}번입니다. 상대팀: ${smsTeamName(opp)}. 경기 준비 바랍니다.`;
    else if(kind==='changed')body=`[${sender}] ${smsTeamName(team)}님, 경기 대기 위치가 ${court} 코트 ${placement.slotLabel||'대기'}로 변경되었습니다. 상대팀: ${smsTeamName(opp)}. 변경된 안내를 확인해 주세요.`;
    else body=`[${sender}] ${smsTeamName(team)}님, ${court} 코트 경기 결과가 등록되었습니다. 참여해 주셔서 감사합니다.`;
    rows.push(body);
  }
  return rows.length===2&&rows[0]!==rows[1]?rows.join('\n\n'):rows[0]||`[${sender}] 경기 안내입니다.`;
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
    state=next;ensurePortalState();ensureOperatorState();ensureContacts(state);commit(`${archive.name} 요약 보관 후 새 대회 시작`);
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
  if(message)log(message);if(state.settings.autoTimeEnabled)calculateTimeMetrics(state);syncInputs();safePersistState(message||'현재 상태');render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});updateSetupProgress();renderOperatorControls();applyRoleUI();renderPortalViews();renderDivisionWorkspaceBar();flashSaved();setTimeout(detectAutoSmsEvents,0);
}

function applySynchronizedState(nextState,source='동기화'){
  if(!nextState||typeof nextState!=='object')return;
  state=structuredClone(nextState);
  ensurePrelimState(state);ensureTimeState(state);ensureDrawMeta(state);ensureMessagingState(state);ensureContacts(state);ensureAuditState(state);ensureEarlyMainSettings(state);ensureVenueSettings(state);ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state);ensurePrelimCourtStatuses(state);ensureOperatorState();
  if(state.settings.autoTimeEnabled)calculateTimeMetrics(state);
  syncInputs();syncPrelimInputs();safePersistState(`${source} 상태`);
  render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});
  updateSetupProgress();renderOperatorControls();applyRoleUI();renderPortalViews();renderDivisionWorkspaceBar();flashSaved();
  notice(`${source} 상태를 반영했습니다.`,'success');
}
function updateSyncPanel(status={}){
  const badge=$('syncStatusBadge');if(badge){badge.textContent=status.label||'로컬 저장';badge.className=`badge ${status.level==='success'?'badge-safe':status.level==='error'?'badge-danger':'badge-muted'}`;}
  const detail=$('syncStatusDetail');if(detail)detail.textContent=status.detail||'이 브라우저에 자동 저장됩니다.';
}
function loadSyncPanel(){
  const cfg=getSyncSettings();
  setChecked('cloudSyncEnabled',cfg.enabled===true);setValue('syncRoomId',cfg.roomId||'');setValue('firebaseConfigJson',cfg.firebaseConfigText||'기존 open-match-manager Firebase 자동 연결');
}
function collectSyncPanel(){const raw=String(getValue('firebaseConfigJson','')).trim();return{enabled:getChecked('cloudSyncEnabled',false),roomId:String(getValue('syncRoomId','')).trim(),firebaseConfigText:raw==='기존 open-match-manager Firebase 자동 연결'?'':raw,collection:'v3TournamentRooms'};}
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
  const autoResult=useUnifiedCourts(state)?enqueueReadyMainToUnifiedCourts(state,{priorityMatchIds:newlyResolvedPlayIns.map(x=>x.id)}):autoAssignResolvedMain(state,{findMatch,queueReadyMatches,refillCourt});
  let directAssigned=false;
  if(useUnifiedCourts(state)&&sourceCourtId&&directPlayIn){try{moveUnifiedCourtMatchFlexible(state,{matchId:directPlayIn.id,targetCourtId:sourceCourtId,mode:'insert-playing'});directAssigned=true;}catch(error){console.warn('[230MATCH V3] direct play-in placement skipped',error);}}
  if((autoResult.assigned===true||Number(autoResult.assigned)>0||directAssigned)&&state.messaging.settings.autoMessageEnabled){generateCurrentCourtMessages(state);generateCurrentWaitMessages(state);}
  commit(`예선 결과 확정 · ${m.id} · 승리 ${teamText(m.winner)} · ${m.scoreA}:${m.scoreB}${syncResult.changes.length?` · 본선 자동반영 ${syncResult.changes.length}팀`:''}${newlyResolvedPlayIns.length?` · 똥통 신규확정 ${newlyResolvedPlayIns.length}경기`:''}${autoResult.assigned?' · 통합 코트 자동배정':''}${directAssigned?' · 종료 코트 즉시 우선배치':''}`);
  $('prelimResultDialog').close();
  prelimNotice(directAssigned?'똥통 예비전이 확정되어 방금 예선이 끝난 코트의 시합중 자리에 최우선 배치했습니다. 기존 카드는 한 단계씩 뒤로 이동했습니다.':autoResult.assigned?'확정된 똥통은 우선 배정하고, 가능한 다른 본선 경기도 빈 코트 없이 계속 배정했습니다.':autoResult.reason==='no-courts'?'본선 팀은 확정됐습니다. 최초 본선 코트배정을 실행하면 운영이 시작됩니다.':'예선 순위와 진출팀을 다시 계산했습니다. 미확정 똥통은 확정되는 즉시 최우선 배정됩니다.','success');
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
function refreshTimeEngine({save=false}={}){
  if(state.settings.autoTimeEnabled)calculateTimeMetrics(state);
  if(save)safePersistState('시간 정보 갱신');
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
    const payload={format:'230MATCH_V3_FULL_BACKUP',schemaVersion:1,appBuild:BUILD_LABEL,exportedAt:new Date().toISOString(),state:structuredClone(state)};
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
  if(restore){if(!requireAdmin('복구점 복원'))return;const item=await getRecovery(restore.dataset.backupRestore);if(!item)return notice('복구점을 찾을 수 없습니다.','error');if(!confirm(`현재 상태를 자동 저장한 뒤 “${item.label}” 상태로 복원할까요?`))return;if(!requireTypedConfirmation('복구점 복원','복원'))return;autoRecovery('관리 화면 복원 직전');state=structuredClone(item.state);ensurePortalState();ensureOperatorState();ensureContacts(state);commit(`복구점 복원 · ${item.label}`);notice('복구점 상태로 복원했습니다.','success');await renderBackupRecoveryManager();return;}
  const download=event.target.closest?.('[data-backup-download]');
  if(download){const item=await getRecovery(download.dataset.backupDownload);if(!item)return notice('복구점을 찾을 수 없습니다.','error');downloadJson(recoveryFileName(item.label),{format:'230MATCH_V3_FULL_BACKUP',schemaVersion:1,appBuild:BUILD_LABEL,exportedAt:new Date().toISOString(),sourceRecovery:{label:item.label,createdAt:item.createdAt},state:item.state});return;}
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

function renderPortalViews(){
  renderBackupRecoveryManager();
  renderTournamentReadiness();
  ensurePortalState();
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
  const board=document.getElementById('boardPostList');if(board)board.innerHTML=posts.map(p=>{const status=boardPostStatus(p);const statusText=status==='scheduled'?'게시 예정':status==='expired'?'게시 종료':'게시 중';return `<article class="portal-board-item ${p.important?'important':''}"><div class="portal-meta notice-meta-row"><span>${p.pinned?'상단 고정 · ':''}${new Date(p.updatedAt||p.createdAt).toLocaleString('ko-KR')}</span><span class="notice-status ${status}">${statusText}${p.popup?' · 홈 팝업':''}</span></div><h3>${p.important?'🚨 ':''}${portalEscape(p.title)}</h3><div class="portal-board-body">${portalEscape(p.body).replace(/\n/g,'<br>')}</div>${p.startAt||p.endAt?`<div class="portal-meta notice-period">게시기간 · ${p.startAt?new Date(p.startAt).toLocaleString('ko-KR'):'즉시'} ~ ${p.endAt?new Date(p.endAt).toLocaleString('ko-KR'):'계속'}</div>`:''}${isAdmin()?`<div class="portal-board-actions"><button type="button" class="btn btn-light" data-board-edit="${p.id}">수정</button><button type="button" class="btn btn-danger-outline" data-board-delete="${p.id}">삭제</button></div>`:''}</article>`;}).join('')||'<div class="portal-empty">등록된 게시물이 없습니다.</div>';
  const summary=document.getElementById('homeCourtSummary');if(summary){const rows=courts.filter(c=>c.playing||c.wait1).slice(0,12);summary.innerHTML=rows.map(c=>{const play=findUnifiedMatch(state,c.playing)||findPrelimMatch(state,c.playing)||findMatch(state.draw,c.playing);const wait=findUnifiedMatch(state,c.wait1)||findPrelimMatch(state,c.wait1)||findMatch(state.draw,c.wait1);return `<article class="portal-court-item"><strong>${portalEscape(c.name||c.id)}</strong><div>시합중 · ${play?portalEscape(portalTeam(play.teamA))+' vs '+portalEscape(portalTeam(play.teamB)):'없음'}</div><div class="portal-meta">대기1 · ${wait?portalEscape(portalTeam(wait.teamA))+' vs '+portalEscape(portalTeam(wait.teamB)):'없음'}</div></article>`;}).join('')||'<div class="portal-empty">현재 배정된 경기가 없습니다.</div>';}
  renderResultArchive();
  renderTournamentGuide();
  renderTournamentList();
}
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
  const imagePreview=document.getElementById('guideImagePreview');
  const imageDownload=document.getElementById('guideImageDownload');
  if(guide.imageDataUrl){
    if(imageSection)imageSection.hidden=false;
    if(imagePreview)imagePreview.src=guide.imageDataUrl;
    if(imageDownload){imageDownload.href=guide.imageDataUrl;imageDownload.download=guide.imageName||`${name}-요강.${guide.imageType==='image/png'?'png':guide.imageType==='image/webp'?'webp':'jpg'}`;}
  }else{
    if(imageSection)imageSection.hidden=true;
    if(imagePreview)imagePreview.removeAttribute('src');
    if(imageDownload)imageDownload.href='#';
  }
  const badge=document.getElementById('guideStatusBadge');if(badge){const completed=Boolean(state.completion?.completedAt||state.tournament?.completedAt);badge.textContent=completed?'종료':capacity&&active>=capacity?'접수마감':'접수중';badge.className=`badge ${completed?'badge-muted':capacity&&active>=capacity?'badge-danger':'badge-warning'}`;}
}
function openTournamentGuideEditor(){
  if(!requireAdmin('대회 요강 수정'))return;
  const guide=state.portal.guide||{};
  const map={guideDateInput:guide.date||'',guideVenueInput:guide.venue||'',guideFeeInput:guide.fee||'',guideBankInput:guide.bank||'',guideAccountInput:guide.account||'',guideOrganizerInput:guide.organizer||'',guideEntryPeriodInput:guide.entryPeriod||'',guideEligibilityInput:guide.eligibility||'',guideMatchFormatInput:guide.matchFormat||'',guideAwardsInput:guide.awards||'',guideRefundPolicyInput:guide.refundPolicy||'',guideContactInput:guide.contact||'',guideExtraInput:guide.extra||'',guidePaymentNoteInput:guide.paymentNote||'',guideDetailInput:guide.detail||''};
  Object.entries(map).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.value=value;});
  stage328PendingGuideImage=guide.imageDataUrl||'';
  stage328PendingGuideImageName=guide.imageName||'';
  stage328PendingGuideImageType=guide.imageType||'';
  stage328RenderGuideImageEditorPreview();
  const imageInput=document.getElementById('guideImageInput');if(imageInput)imageInput.value='';
  const editor=document.getElementById('tournamentGuideEditor');if(editor)editor.hidden=false;
}
function saveTournamentGuide(){
  if(!requireAdmin('대회 요강 저장'))return;
  const val=id=>String(document.getElementById(id)?.value||'').trim();
  state.portal.guide={date:val('guideDateInput'),venue:val('guideVenueInput'),fee:val('guideFeeInput'),bank:val('guideBankInput'),account:val('guideAccountInput'),organizer:val('guideOrganizerInput'),entryPeriod:val('guideEntryPeriodInput'),eligibility:val('guideEligibilityInput'),matchFormat:val('guideMatchFormatInput'),awards:val('guideAwardsInput'),refundPolicy:val('guideRefundPolicyInput'),contact:val('guideContactInput'),extra:val('guideExtraInput'),paymentNote:val('guidePaymentNoteInput'),detail:val('guideDetailInput'),imageDataUrl:stage328PendingGuideImage||'',imageName:stage328PendingGuideImageName||'',imageType:stage328PendingGuideImageType||''};
  const editor=document.getElementById('tournamentGuideEditor');if(editor)editor.hidden=true;
  commit('대회 요강·참가비·입금 계좌 저장');renderTournamentGuide();notice('대회 요강을 저장했습니다.','success');
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
function clearBoardPostForm(){['boardPostEditId','boardPostTitle','boardPostBody','boardPostStartAt','boardPostEndAt'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});['boardPostPinned','boardPostImportant','boardPostPopup'].forEach(id=>{const el=document.getElementById(id);if(el)el.checked=false;});const form=document.getElementById('boardPostForm');if(form)form.hidden=true;}
function openBoardPostEditor(post=null){if(!requireAdmin(post?'공지 수정':'새 공지 작성'))return;const form=document.getElementById('boardPostForm');if(!form)return;form.hidden=false;document.getElementById('boardPostEditId').value=post?.id||'';document.getElementById('boardPostTitle').value=post?.title||'';document.getElementById('boardPostBody').value=post?.body||'';document.getElementById('boardPostPinned').checked=Boolean(post?.pinned);document.getElementById('boardPostImportant').checked=Boolean(post?.important);document.getElementById('boardPostPopup').checked=Boolean(post?.popup);document.getElementById('boardPostStartAt').value=boardDateValue(post?.startAt);document.getElementById('boardPostEndAt').value=boardDateValue(post?.endAt);form.scrollIntoView({behavior:'smooth',block:'start'});}
function saveBoardPost(){if(!requireAdmin('게시판 공지 저장'))return;const value=id=>String(document.getElementById(id)?.value||'').trim();const id=value('boardPostEditId'),title=value('boardPostTitle'),body=value('boardPostBody'),startAt=value('boardPostStartAt'),endAt=value('boardPostEndAt');if(!title||!body){notice('제목과 내용을 입력하세요.','error');return;}if(startAt&&endAt&&new Date(startAt)>=new Date(endAt)){notice('게시 종료는 게시 시작보다 뒤여야 합니다.','error');return;}const payload={title,body,pinned:Boolean(document.getElementById('boardPostPinned')?.checked),important:Boolean(document.getElementById('boardPostImportant')?.checked),popup:Boolean(document.getElementById('boardPostPopup')?.checked),startAt,endAt,updatedAt:new Date().toISOString()};const current=state.portal.posts.find(p=>p.id===id);if(current){Object.assign(current,payload);commit(`게시판 공지 수정 · ${title}`);notice('공지를 수정했습니다.','success');}else{state.portal.posts.unshift({id:crypto.randomUUID(),...payload,createdAt:new Date().toISOString()});commit(`게시판 공지 등록 · ${title}`);notice('공지를 등록했습니다.','success');}clearBoardPostForm();renderPortalViews();showEligibleHomePopup();}
function popupDismissKey(post){return `230match-notice-dismiss-${post.id}-${new Date().toISOString().slice(0,10)}`;}
function closeHomeNoticePopup(){const dialog=document.getElementById('homeNoticePopup');const id=dialog?.dataset.postId;if(id&&document.getElementById('homeNoticePopupDismiss')?.checked)localStorage.setItem(popupDismissKey({id}),'1');if(dialog?.open)dialog.close();}
function showEligibleHomePopup(){if(document.body.dataset.currentView!=='home')return;const post=visibleBoardPosts().find(p=>p.popup&&!localStorage.getItem(popupDismissKey(p)));const dialog=document.getElementById('homeNoticePopup');if(!post||!dialog||dialog.open)return;dialog.dataset.postId=post.id;document.getElementById('homeNoticePopupBadge').textContent=post.important?'중요 공지':'대회 공지';document.getElementById('homeNoticePopupTitle').textContent=post.title;document.getElementById('homeNoticePopupBody').innerHTML=portalEscape(post.body).replace(/\n/g,'<br>');document.getElementById('homeNoticePopupDismiss').checked=false;dialog.showModal();}


function tournamentLifecycle(){
  const prelim=state.prelim?.matches||[],main=portalMainMatches();
  const all=[...prelim,...main],completed=all.length>0&&all.every(x=>x.status==='completed');
  if(completed||state.completion?.completedAt)return 'completed';
  if(all.some(x=>['playing','completed'].includes(x.status)))return 'ongoing';
  return 'recruiting';
}
function tournamentStatusLabel(status){return status==='completed'?'종료':status==='ongoing'?'진행중':'접수중';}
function currentTournamentSnapshot(){
  const teams=state.teams||[],active=teams.filter(x=>x.status!=='reserve').length,reserve=teams.filter(x=>x.status==='reserve').length;
  const prelim=state.prelim?.matches||[],main=portalMainMatches(),podium=currentPodium(),guide=state.portal?.guide||{};
  return {id:'current',current:true,name:state.tournament?.name||'대회 준비 중',division:state.tournament?.division||'',date:guide.date||'',venue:guide.venue||'',fee:guide.fee||'',capacity:Number(state.prelim?.settings?.activeTeamCount||0),active,reserve,status:tournamentLifecycle(),champion:podium.champion||'',runnerUp:podium.runnerUp||'',thirds:podium.thirds||[],prelimCompleted:prelim.filter(x=>x.status==='completed').length,prelimTotal:prelim.length,mainCompleted:main.filter(x=>x.status==='completed').length,mainTotal:main.length,detail:guide.detail||'',updatedAt:state.updatedAt||new Date().toISOString()};
}
function tournamentArchiveRows(){return [currentTournamentSnapshot(),...(state.portal?.tournamentArchives||[])];}
function archiveCurrentTournament(){
  if(!requireAdmin('현재 대회 보관'))return;
  const snap=currentTournamentSnapshot();
  if(!snap.name||snap.name==='대회 준비 중'){notice('대회명을 먼저 설정하세요.','error');return;}
  const payload={...snap,id:crypto.randomUUID(),current:false,archivedAt:new Date().toISOString()};
  const same=(state.portal.tournamentArchives||[]).findIndex(x=>x.name===payload.name&&x.division===payload.division&&x.date===payload.date);
  if(same>=0){payload.id=state.portal.tournamentArchives[same].id;state.portal.tournamentArchives[same]=payload;}
  else state.portal.tournamentArchives.unshift(payload);
  commit(`대회 목록 보관 · ${payload.name}`);renderTournamentList();notice(same>=0?'기존 대회 기록을 최신 상태로 갱신했습니다.':'현재 대회를 목록에 보관했습니다.','success');
}

async function deleteCurrentTournamentSafely(){
  if(!requireAdmin('현재 대회 삭제'))return;
  const snap=currentTournamentSnapshot();
  const hasTeams=(state.teams||[]).length>0;
  const hasPrelim=(state.prelim?.matches||[]).length>0;
  const hasMain=portalMainMatches().length>0;
  const warning=[
    `현재 대회 “${snap.name}”를 삭제합니다.`,
    hasTeams?`참가팀 ${(state.teams||[]).length}팀이 함께 초기화됩니다.`:'참가팀은 없습니다.',
    (hasPrelim||hasMain)?`예선·본선 경기 데이터가 함께 초기화됩니다.`:'경기 데이터는 없습니다.',
    '보관된 지난 대회와 결과사진 기록은 유지됩니다.',
    '삭제 전 현재 상태는 자동 복구점에 저장됩니다.'
  ].join('\n');
  if(!confirm(warning))return;
  const typed=prompt('현재 대회를 삭제하려면 “대회삭제”를 입력하세요.','');
  if(typed!=='대회삭제'){notice('확인 문구가 일치하지 않아 취소했습니다.','warning');return;}
  const previousPortal=structuredClone(state.portal||{});
  const previousSettings=structuredClone(state.settings||{});
  const previousAuth=structuredClone(state.auth||{});
  const previousOperator=structuredClone(state.operator||{});
  const previousSync=structuredClone(state.sync||{});
  const recovery=saveRecovery(state,`${snap.name||'현재 대회'} · 삭제 전 자동 복구점`);
  const next=initialState();
  next.tournament={name:'대회 준비 중',division:''};
  next.settings={...next.settings,...previousSettings};
  next.portal={
    ...next.portal,
    tournamentArchives:previousPortal.tournamentArchives||[],
    resultArchives:previousPortal.resultArchives||[],
    tournamentTemplates:previousPortal.tournamentTemplates||[],
    posts:previousPortal.posts||[],
    guide:{date:'',venue:'',fee:'',bank:'',account:'',paymentNote:'입금 확인 후 참가 확정됩니다.',detail:''},
    applications:[]
  };
  if(previousAuth&&Object.keys(previousAuth).length)next.auth=previousAuth;
  if(previousOperator&&Object.keys(previousOperator).length)next.operator=previousOperator;
  if(previousSync&&Object.keys(previousSync).length)next.sync=previousSync;
  state=next;
  ensurePortalState();ensurePrelimState(state);ensureTimeState(state);ensureDrawMeta(state);ensureMessagingState(state);ensureContacts(state);ensureAuditState(state);ensureEarlyMainSettings(state);ensureVenueSettings(state);ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state);ensurePrelimCourtStatuses(state);ensureOperatorState();
  saveState(state);syncInputs();syncPrelimInputs();renderVenueSettingsEditor();
  render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});
  renderOperatorControls();applyRoleUI();renderPortalViews();renderTournamentLifecycleManager();
  const saved=await recovery.ready;
  notice(`현재 대회를 삭제했습니다.${saved?.saved?' 삭제 전 상태는 복구점에 저장했습니다.':''}`,'success');
}

function renderTournamentDetail(item){
  const panel=document.getElementById('tournamentDetailPanel');if(!panel)return;
  panel.hidden=false;panel.innerHTML=`<div class="section-head"><div><h2>${portalEscape(item.name)}</h2><p>${portalEscape(item.division||'부서 미설정')} · ${tournamentStatusLabel(item.status)}</p></div><button type="button" class="btn btn-light" data-tournament-detail-close>닫기</button></div><div class="tournament-detail-grid"><div><span>대회일</span><b>${item.date?new Date(item.date+'T00:00:00').toLocaleDateString('ko-KR'):'미정'}</b></div><div><span>장소</span><b>${portalEscape(item.venue||'미정')}</b></div><div><span>참가 현황</span><b>${item.active||0}팀${item.reserve?` · 후보 ${item.reserve}팀`:''}</b></div><div><span>본선 진행</span><b>${item.mainCompleted||0}/${item.mainTotal||0}</b></div></div><div class="tournament-detail-podium"><div><span>🏆 우승</span><b>${portalEscape(item.champion||'미확정')}</b></div><div><span>🥈 준우승</span><b>${portalEscape(item.runnerUp||'미확정')}</b></div><div><span>🥉 공동 3위</span><b>${portalEscape((item.thirds||[]).join(' · ')||'미확정')}</b></div></div>${item.detail?`<div class="tournament-detail-text">${portalEscape(item.detail).replace(/\n/g,'<br>')}</div>`:''}<div class="button-row">${item.current?'<button type="button" class="btn btn-primary" data-portal-go="guide">대회 요강</button><button type="button" class="btn btn-light" data-portal-go="entry">참가 신청</button><button type="button" class="btn btn-light" data-portal-go="operation">경기 현황</button>':'<button type="button" class="btn btn-light" data-portal-go="records">전체 결과 기록</button>'}</div>`;
  panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderTournamentList(){
  const rows=tournamentArchiveRows(),query=String(document.getElementById('tournamentListSearch')?.value||'').trim().toLowerCase(),status=document.getElementById('tournamentListStatus')?.value||'all';
  const visible=rows.filter(x=>(status==='all'||x.status===status)&&(!query||`${x.name} ${x.division} ${x.venue}`.toLowerCase().includes(query)));
  const summary=document.getElementById('tournamentListSummary');if(summary){const counts={recruiting:rows.filter(x=>x.status==='recruiting').length,ongoing:rows.filter(x=>x.status==='ongoing').length,completed:rows.filter(x=>x.status==='completed').length};summary.textContent=`전체 ${rows.length}개 · 접수중 ${counts.recruiting} · 진행중 ${counts.ongoing} · 종료 ${counts.completed}`;}
  const root=document.getElementById('tournamentCardList');if(!root)return;
  root.innerHTML=visible.map(x=>`<article class="panel tournament-list-card ${x.current?'current':''}"><div class="tournament-card-top"><div><span class="tournament-state ${x.status}">${x.current?'현재 · ':''}${tournamentStatusLabel(x.status)}</span><h2>${portalEscape(x.name)}</h2><p>${portalEscape(x.division||'부서 미설정')}</p></div>${isAdmin()?`<button type="button" class="btn btn-danger-outline btn-small" ${x.current?'data-current-tournament-delete':'data-tournament-delete="'+x.id+'"'}>삭제</button>`:''}</div><div class="tournament-card-info"><span>📅 ${x.date?new Date(x.date+'T00:00:00').toLocaleDateString('ko-KR'):'일정 미정'}</span><span>📍 ${portalEscape(x.venue||'장소 미정')}</span><span>👥 참가 ${x.active||0}팀${x.reserve?` · 후보 ${x.reserve}팀`:''}</span></div><div class="tournament-card-progress"><div><span>예선</span><b>${x.prelimCompleted||0}/${x.prelimTotal||0}</b></div><div><span>본선</span><b>${x.mainCompleted||0}/${x.mainTotal||0}</b></div><div><span>우승</span><b>${portalEscape(x.champion||'미확정')}</b></div></div><button type="button" class="btn ${x.current?'btn-primary':'btn-light'} tournament-open-btn" data-tournament-open="${x.id}">${x.current?'현재 대회 보기':'대회 기록 보기'}</button></article>`).join('')||'<div class="panel portal-empty">조건에 맞는 대회가 없습니다.</div>';
}
function bindTournamentList(){
  document.getElementById('archiveTournamentBtn')?.addEventListener('click',archiveCurrentTournament);
  document.getElementById('tournamentListSearch')?.addEventListener('input',renderTournamentList);
  document.getElementById('tournamentListStatus')?.addEventListener('change',renderTournamentList);
  document.getElementById('tournamentListResetBtn')?.addEventListener('click',()=>{const q=document.getElementById('tournamentListSearch'),s=document.getElementById('tournamentListStatus');if(q)q.value='';if(s)s.value='all';renderTournamentList();});
  document.getElementById('tournamentCardList')?.addEventListener('click',async e=>{const open=e.target.closest('[data-tournament-open]');if(open){const item=tournamentArchiveRows().find(x=>x.id===open.dataset.tournamentOpen);if(item)renderTournamentDetail(item);return;}const currentDel=e.target.closest('[data-current-tournament-delete]');if(currentDel){await deleteCurrentTournamentSafely();return;}const del=e.target.closest('[data-tournament-delete]');if(del&&requireAdmin('대회 기록 삭제')){if(!confirm('이 대회 기록을 삭제할까요?'))return;state.portal.tournamentArchives=state.portal.tournamentArchives.filter(x=>x.id!==del.dataset.tournamentDelete);commit('대회 목록 기록 삭제');renderTournamentList();}});
  document.getElementById('tournamentDetailPanel')?.addEventListener('click',e=>{if(e.target.closest('[data-tournament-detail-close]'))document.getElementById('tournamentDetailPanel').hidden=true;});
}

function archiveCurrentResult(){if(!requireAdmin('대회 결과 보관'))return;const prelim=state.prelim?.matches||[],main=portalMainMatches(),podium=currentPodium();const item={id:crypto.randomUUID(),name:state.tournament?.name||'대회',division:state.tournament?.division||'',champion:podium.champion,runnerUp:podium.runnerUp,thirds:podium.thirds,prelimCompleted:prelim.filter(x=>x.status==='completed').length,prelimTotal:prelim.length,mainCompleted:main.filter(x=>x.status==='completed').length,mainTotal:main.length,archivedAt:new Date().toISOString()};state.portal.resultArchives.unshift(item);commit(`대회 결과 기록 보관 · ${item.name}`);notice('현재 대회 결과를 입상 기록과 함께 보관했습니다.','success');}

function printEscape(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
function printTeam(value){if(!value)return '미정';if(typeof value==='string')return value;try{return teamText(value)||value.name||value.teamName||'미정';}catch(_error){return value.name||value.teamName||'미정';}}
function printHeader(title){const t=state.tournament||{},guide=state.portal?.guide||{};return `<header class="print-title"><h1>${printEscape(title)}</h1><p>${printEscape(t.name||'230MATCH 대회')} ${t.division?`· ${printEscape(t.division)}`:''}</p></header><div class="print-meta"><span>${guide.date?`대회일 ${printEscape(guide.date)}`:''}${guide.venue?` · ${printEscape(guide.venue)}`:''}</span><span>출력 ${new Date().toLocaleString('ko-KR')}</span></div>`;}
function printPrelimHtml(){const groups=state.prelim?.groups||[],matches=state.prelim?.matches||[];if(!groups.length)return printHeader('예선 조편성·순위표')+'<div class="print-empty">생성된 예선 조편성이 없습니다.</div>';const cards=groups.map((g,idx)=>{const teams=g.teams||g.teamIds?.map(id=>(state.teams||[]).find(t=>t.id===id)).filter(Boolean)||[];const standings=g.standings||state.prelim?.standings?.[g.id]||[];const gm=matches.filter(m=>m.groupId===g.id);return `<article class="print-card"><h3>${printEscape(g.name||`${idx+1}조`)} ${g.courtName?`· ${printEscape(g.courtName)}`:''}</h3><table class="print-table"><thead><tr><th>순위</th><th>팀</th><th class="center">승</th><th class="center">패</th></tr></thead><tbody>${teams.map((t,i)=>{const row=standings.find?.(x=>x.teamId===t?.id)||standings[i]||{};return `<tr><td class="center">${row.rank||i+1}</td><td>${printEscape(printTeam(t))}</td><td class="center">${row.wins??'-'}</td><td class="center">${row.losses??'-'}</td></tr>`}).join('')}</tbody></table><div style="margin-top:7px">${gm.map(m=>`${printEscape(printTeam(m.teamA))} vs ${printEscape(printTeam(m.teamB))}${m.status==='completed'?` · ${m.scoreA??''}:${m.scoreB??''}`:''}`).join('<br>')}</div></article>`}).join('');return printHeader('예선 조편성·순위표')+`<div class="print-grid">${cards}</div>`;}
function printBracketHtml(){const matches=portalMainMatches();if(!matches.length)return printHeader('본선 대진표')+'<div class="print-empty">생성된 본선 대진표가 없습니다.</div>';const rounds=[...new Set(matches.map(m=>m.roundName||m.round||'본선'))];return printHeader('본선 대진표')+rounds.map(round=>`<section class="print-card" style="margin-bottom:10px"><h3>${printEscape(round)}</h3><table class="print-table"><thead><tr><th>경기</th><th>대진</th><th>상태·결과</th></tr></thead><tbody>${matches.filter(m=>(m.roundName||m.round||'본선')===round).map((m,i)=>`<tr><td>${i+1}</td><td>${printEscape(printTeam(m.teamA))} vs ${printEscape(printTeam(m.teamB))}</td><td>${m.status==='completed'?`${printEscape(printTeam(m.winner))} 승 ${m.scoreA??''}:${m.scoreB??''}`:m.status==='playing'?'시합중':m.courtName?`${printEscape(m.courtName)} 대기`:'대기'}</td></tr>`).join('')}</tbody></table></section>`).join('');}
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
function buildPrintDocument(){const target=document.getElementById('printTargetSelect')?.value||'prelim',paper=document.getElementById('printPaperSelect')?.value||'a4',orientation=document.getElementById('printOrientationSelect')?.value||'portrait',tone=document.getElementById('printToneSelect')?.value||'color',scale=document.getElementById('printScaleSelect')?.value||'normal';const map={prelim:printPrelimHtml,bracket:printBracketHtml,participants:printParticipantsHtml,labels:printLabelsHtml,courts:printCourtsHtml,results:printResultsHtml};const labels={prelim:'예선 조편성·순위표',bracket:'본선 대진표',participants:'참가자 명단',labels:'참가자 라벨지',courts:'코트별 경기 현황',results:'최종 입상 결과표'};const body=(map[target]||printPrelimHtml)();const isLabels=target==='labels';return {target,label:labels[target],paper,orientation,tone,scale,html:`<article class="print-sheet paper-${paper} ${orientation} ${tone} scale-${scale} ${isLabels?'label-print-sheet':''}">${body}${isLabels?'':`<footer class="print-footer">230MATCH V3 · ${printEscape(BUILD_LABEL)}</footer>`}</article>`};}
function renderPrintPreview(){const preview=document.getElementById('printPreview');if(!preview)return;const target=document.getElementById('printTargetSelect')?.value||'prelim';const options=document.getElementById('labelPrintOptions');if(options)options.hidden=target!=='labels';if(target==='labels'){const paper=document.getElementById('printPaperSelect');if(paper)paper.value='a4';const orientation=document.getElementById('printOrientationSelect');if(orientation)orientation.value='portrait';}const doc=buildPrintDocument();preview.innerHTML=doc.html;const summary=document.getElementById('printPreviewSummary');if(summary)summary.textContent=target==='labels'?`${doc.label} · 12×40mm · A4 세로 · ${document.getElementById('labelStatusSelect')?.selectedOptions?.[0]?.textContent||''}`:`${doc.label} · ${doc.paper.toUpperCase()} · ${doc.orientation==='landscape'?'가로':'세로'} · ${doc.tone==='mono'?'흑백':'컬러'}`;}
function printSelectedDocument(){const doc=buildPrintDocument();let root=document.getElementById('printOutputRoot');if(!root){root=document.createElement('div');root.id='printOutputRoot';document.body.appendChild(root);}root.innerHTML=doc.html;document.body.classList.add('printing-output');const cleanup=()=>{document.body.classList.remove('printing-output');root.innerHTML='';window.removeEventListener('afterprint',cleanup);};window.addEventListener('afterprint',cleanup);setTimeout(()=>window.print(),80);}
function wrapCanvasText(ctx,text,maxWidth){const words=String(text||'').split(/\s+/),lines=[];let line='';for(const word of words){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}if(line)lines.push(line);return lines;}
function savePrintPng(){const doc=buildPrintDocument(),title=doc.label,lines=[];if(doc.target==='participants'){(state.teams||[]).forEach((t,i)=>lines.push(`${i+1}. ${printTeam(t)} · ${t.club||t.affiliation||''} · ${t.status==='reserve'?'후보':'참가'}`));}else if(doc.target==='results'){const p=currentPodium();lines.push(`우승: ${p.champion||'미확정'}`,`준우승: ${p.runnerUp||'미확정'}`,`공동 3위: ${(p.thirds||[]).join(' · ')||'미확정'}`);}else if(doc.target==='bracket'){portalMainMatches().forEach((m,i)=>lines.push(`${m.roundName||m.round||'본선'} ${i+1}: ${printTeam(m.teamA)} vs ${printTeam(m.teamB)}${m.status==='completed'?` · ${printTeam(m.winner)} 승`:''}`));}else if(doc.target==='prelim'){(state.prelim?.groups||[]).forEach((g,i)=>lines.push(`${g.name||`${i+1}조`}: ${(g.teams||[]).map(printTeam).join(' / ')}`));}else{const courts=state.unifiedCourts||state.courts||[];(Array.isArray(courts)?courts:Object.values(courts||{})).forEach((c,i)=>lines.push(`${c.name||`${i+1}번 코트`}: ${c.playingMatch?`${printTeam(c.playingMatch.teamA)} vs ${printTeam(c.playingMatch.teamB)}`:'대기'}`));}const width=1600,pad=80,lineH=42;const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font='26px sans-serif';let wrapped=[];for(const line of lines.length?lines:['표시할 자료가 없습니다.'])wrapped.push(...wrapCanvasText(ctx,line,width-pad*2));canvas.width=width;canvas.height=Math.max(1000,260+wrapped.length*lineH+pad);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#10264a';ctx.fillRect(0,0,canvas.width,150);ctx.fillStyle='#ffffff';ctx.font='bold 46px sans-serif';ctx.fillText(title,pad,75);ctx.font='25px sans-serif';ctx.fillText(`${state.tournament?.name||'230MATCH 대회'} · ${state.tournament?.division||''}`,pad,120);ctx.fillStyle='#111827';ctx.font='26px sans-serif';let y=215;for(const line of wrapped){ctx.fillText(line,pad,y);y+=lineH;}canvas.toBlob(blob=>{if(!blob){notice('이미지 생성에 실패했습니다.','error');return;}const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`230MATCH_${title.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);notice('PNG 이미지를 저장했습니다.','success');},'image/png');}
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
  const name=String(document.getElementById('newTournamentName')?.value||'').trim();
  const division=String(document.getElementById('newTournamentDivision')?.value||'').split(/[,\n]/).map(v=>v.trim()).filter(Boolean)[0]||'';
  if(!name){notice('새 대회명을 입력하세요.','error');return;}
  if(!options.skipPrompt){const typed=prompt(`새 대회 “${name}”로 전환합니다. 확인을 위해 새 대회명을 그대로 입력하세요.`,'');if(typed!==name){notice('대회명이 일치하지 않아 취소했습니다.','warning');return false;}}
  const backup=saveRecovery(state,`${state.tournament?.name||'현재 대회'} · 새 대회 전환 전 자동 복구점`);
  const source=sourceForNewTournament(document.getElementById('newTournamentTemplate')?.value||'current');
  const preserveTeams=document.getElementById('copyTournamentTeams')?.checked===true;
  const preserveGuide=document.getElementById('copyTournamentGuide')?.checked!==false;
  const preservePosts=document.getElementById('copyTournamentPosts')?.checked===true;
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
  state=next;ensurePortalState();ensurePrelimState(state);ensureTimeState(state);ensureDrawMeta(state);ensureMessagingState(state);ensureContacts(state);ensureAuditState(state);ensureEarlyMainSettings(state);ensureVenueSettings(state);ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state);ensurePrelimCourtStatuses(state);ensureOperatorState();
  saveState(state);syncInputs();syncPrelimInputs();renderVenueSettingsEditor();render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});renderOperatorControls();applyRoleUI();renderPortalViews();renderTournamentLifecycleManager();
  const result=await backup.ready;let cloudMessage='';if(options.uploadCloud){try{await pushStateNow(state);cloudMessage=' Firebase 업로드도 완료했습니다.';}catch(error){cloudMessage=` Firebase 업로드는 실패했습니다: ${error?.message||error}`;}}notice(`새 대회를 생성했습니다.${result?.saved?' 이전 상태는 자동 복구점에 저장했습니다.':''}${cloudMessage}`,cloudMessage.includes('실패')?'warning':'success');return true;
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
function wizardSummaryHtml(){const x=wizardEstimate();const rows=[['대회명',wizardEl('wizardTournamentName')?.value||'-'],['부서',wizardEl('wizardTournamentDivision')?.value||'-'],['일정·장소',`${wizardEl('wizardTournamentDate')?.value||'미정'} · ${wizardEl('wizardTournamentVenue')?.value||'미정'}`],['참가 정원',`${x.cap}팀`],['예선',`${x.groups}개 조 예상 · 조당 ${wizardEl('wizardQualifiers')?.value||2}팀 진출`],['본선',`${x.draw}강 · 예상 BYE ${Math.max(0,x.draw-x.qualifiers)}`],['코트',`${wizardEl('wizardCourtPrefix')?.value||'코트'} ${wizardEl('wizardCourtCount')?.value||8}면`],['설정 기준',wizardEl('wizardTemplate')?.value==='current'?'현재 대회 설정 복사':'기본값으로 새 시작'],['보관',`요강 ${wizardEl('wizardCopyGuide')?.checked?'복사':'미복사'} · 공지 ${wizardEl('wizardCopyPosts')?.checked?'복사':'미복사'} · 참가팀 ${wizardEl('wizardCopyTeams')?.checked?'복사':'미복사'}`],['Firebase',wizardEl('wizardCloudUpload')?.checked?'생성 후 업로드':'로컬 저장만']];return rows.map(([k,v])=>`<article><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></article>`).join('');}
function renderNewTournamentWizard(){document.querySelectorAll('[data-wizard-step]').forEach(el=>el.classList.toggle('active',Number(el.dataset.wizardStep)===newTournamentWizardStep));document.querySelectorAll('[data-wizard-dot]').forEach(el=>{const n=Number(el.dataset.wizardDot);el.classList.toggle('active',n===newTournamentWizardStep);el.classList.toggle('done',n<newTournamentWizardStep);});wizardEl('wizardPrevBtn').hidden=newTournamentWizardStep===1;wizardEl('wizardNextBtn').hidden=newTournamentWizardStep===4;wizardEl('wizardCreateBtn').hidden=newTournamentWizardStep!==4;if(newTournamentWizardStep===4)wizardEl('wizardSummary').innerHTML=wizardSummaryHtml();updateWizardGuide();setWizardMessage();}
function openNewTournamentWizard(){if(!requireAdmin('새 대회 생성'))return;const modal=wizardEl('newTournamentWizard');if(!modal)return;newTournamentWizardStep=1;wizardEl('wizardTournamentName').value='';wizardEl('wizardTournamentDivision').value='';wizardEl('wizardTournamentDate').value='';wizardEl('wizardTournamentVenue').value='';wizardEl('wizardTournamentCapacity').value=state.prelim?.settings?.activeTeamCount||96;wizardEl('wizardCourtCount').value=state.settings?.courtCount||8;wizardEl('wizardCourtPrefix').value=state.settings?.courtPrefix||'국제';wizardEl('wizardTemplate').value='blank';wizardEl('wizardConfirmChecked').checked=false;modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';renderNewTournamentWizard();setTimeout(()=>wizardEl('wizardTournamentName')?.focus(),50);}
function closeNewTournamentWizard(){const modal=wizardEl('newTournamentWizard');if(modal){modal.hidden=true;modal.setAttribute('aria-hidden','true');}document.body.style.overflow='';}
function validateWizardStep(step){if(step===1){if(!String(wizardEl('wizardTournamentName')?.value||'').trim()){setWizardMessage('대회명을 입력하세요.','error');wizardEl('wizardTournamentName')?.focus();return false;}if(!String(wizardEl('wizardTournamentDivision')?.value||'').trim()){setWizardMessage('부서를 입력하세요.','error');wizardEl('wizardTournamentDivision')?.focus();return false;}}return true;}
async function createTournamentFromWizard(){if(!wizardEl('wizardConfirmChecked')?.checked){setWizardMessage('최종 확인 항목에 체크하세요.','error');return;}const divisionNames=parseDivisionNames(wizardEl('wizardTournamentDivision')?.value);const x=wizardEstimate();const map={newTournamentName:'wizardTournamentName',newTournamentDivision:'wizardTournamentDivision',newTournamentDate:'wizardTournamentDate',newTournamentVenue:'wizardTournamentVenue',newTournamentCapacity:'wizardTournamentCapacity',newTournamentTemplate:'wizardTemplate'};Object.entries(map).forEach(([dst,src])=>{const d=wizardEl(dst),s=wizardEl(src);if(d&&s)d.value=dst==='newTournamentDivision'?(divisionNames[0]||s.value):s.value;});if(wizardEl('copyTournamentGuide'))wizardEl('copyTournamentGuide').checked=wizardEl('wizardCopyGuide').checked;if(wizardEl('copyTournamentPosts'))wizardEl('copyTournamentPosts').checked=wizardEl('wizardCopyPosts').checked;if(wizardEl('copyTournamentTeams'))wizardEl('copyTournamentTeams').checked=wizardEl('wizardCopyTeams').checked;setWizardMessage('현재 상태를 복구점에 저장하고 새 대회를 생성하고 있습니다.');try{const ok=await createNewTournamentFromManager({skipPrompt:true,uploadCloud:wizardEl('wizardCloudUpload')?.checked});if(!ok)return;state.settings.drawSize=x.draw;state.settings.courtCount=Math.max(1,Number(wizardEl('wizardCourtCount')?.value||8));state.settings.courtPrefix=String(wizardEl('wizardCourtPrefix')?.value||'국제').trim();state.prelim.settings.qualifiersPerGroup=Number(wizardEl('wizardQualifiers')?.value||2);state.prelim.settings.twoTeamGroupCount=x.two;state.portal.guide.startTime=wizardEl('wizardTournamentStartTime')?.value||'09:00';initializeTournamentDivisions(divisionNames);saveState(state);renderDivisionWorkspaceBar();if(wizardEl('wizardCloudUpload')?.checked){try{await pushStateNow(state);}catch(_e){}}setWizardMessage('새 대회 생성이 완료되었습니다.','success');setTimeout(()=>{closeNewTournamentWizard();navigatePortalView('tournaments',{pushHistory:true});},500);}catch(error){setWizardMessage(`생성 실패: ${error?.message||error}`,'error');}}
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
  if(name==='rehearsal')return isAdmin()&&isRehearsalUnlocked();
  if(INTERNAL_ADMIN_PORTAL_VIEWS.has(name))return isAdmin();
  if(INTERNAL_OPERATOR_PORTAL_VIEWS.has(name))return canOperate();
  // 대회 요강처럼 상단 탭을 숨긴 공개 화면도 직접 이동을 허용합니다.
  if(PUBLIC_PORTAL_VIEWS.has(name)){
    const publicTab=document.querySelector(`.tab[data-view="${name}"]`);
    if(!publicTab)return true;
    if(publicTab.hasAttribute('data-admin-only')&&!isAdmin())return false;
    if(publicTab.hasAttribute('data-operator-only')&&!canOperate())return false;
    return !publicTab.hidden&&publicTab.style.display!=='none';
  }
  const tab=document.querySelector(`.tab[data-view="${name}"]`);
  if(!tab||tab.hidden||tab.style.display==='none')return false;
  if(tab.hasAttribute('data-admin-only')&&!isAdmin())return false;
  if(tab.hasAttribute('data-operator-only')&&!canOperate())return false;
  return true;
}
function navigatePortalView(name,{pushHistory=false,replaceHistory=false,focus=true}={}){
  const target=portalViewAllowed(name)?name:'home';
  updateDocumentTitle(target);
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.view===target));
  document.querySelectorAll('.mobile-nav-button').forEach(x=>x.classList.toggle('active',x.dataset.mobileView===target));
  const moreViews=new Set(['participants','notifications','records','guide','board','print','operation','prelim-public']);
  document.getElementById('mobileMoreBtn')?.classList.toggle('active',moreViews.has(target));
  closeMobileMoreMenu();
  document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===`view-${target}`));
  document.body.dataset.currentView=target;
  const mobileTitle=document.getElementById('mobilePageTitle');if(mobileTitle)mobileTitle.textContent=PORTAL_VIEW_TITLES[target]||'230MATCH';
  const mobileBack=document.getElementById('mobileBackBtn');if(mobileBack)mobileBack.hidden=target==='home';
  const hash=`#${target}`;
  if(pushHistory&&location.hash!==hash)history.pushState({portalView:target},'',hash);
  else if(replaceHistory&&location.hash!==hash)history.replaceState({portalView:target},'',hash);
  renderPortalViews();
  if(target==='home')setTimeout(showEligibleHomePopup,120);if(target==='entry')setTimeout(renderApplicationPortal,30);if(target==='notifications')setTimeout(refreshNotificationManager,30);if(target==='messages')setTimeout(()=>{renderPortalViews();renderSmsAcceptance(lastSmsAcceptance);},30);if(target==='print')setTimeout(renderPrintPreview,30);if(target==='acceptance')setTimeout(renderAcceptance,30);if(target==='rehearsal')setTimeout(()=>renderRehearsal(),30);if(target==='performance')setTimeout(renderPerformanceCenter,30);if(target==='diagnostics')setTimeout(renderDiagnostics,30);if(target==='manual')setTimeout(renderOperationsManual,30);
  window.scrollTo({top:0,behavior:focus?'smooth':'auto'});
  if(focus){
    const heading=document.querySelector(`#view-${target} h1, #view-${target} h2`);
    if(heading){heading.setAttribute('tabindex','-1');setTimeout(()=>heading.focus({preventScroll:true}),180);}
  }
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
  document.getElementById('archiveCurrentResultBtn')?.addEventListener('click',archiveCurrentResult);
  document.getElementById('myMatchSearchBtn')?.addEventListener('click',searchMyMatch);
  document.getElementById('myMatchSearchInput')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();searchMyMatch();}});
  document.getElementById('myMatchSearchInput')?.addEventListener('input',()=>{const value=document.getElementById('myMatchSearchInput')?.value||'';if(myMatchNormalize(value).length>=2)searchMyMatch();});
  document.getElementById('myMatchClearBtn')?.addEventListener('click',()=>{const input=document.getElementById('myMatchSearchInput');if(input)input.value='';const choices=document.getElementById('myMatchTeamChoices');if(choices)choices.innerHTML='';const result=document.getElementById('myMatchResult');if(result){result.className='my-match-result empty-state';result.innerHTML='<p>검색할 선수 이름이나 팀명을 입력하세요.</p>';}const guide=document.getElementById('myMatchSearchGuide');if(guide)guide.textContent='두 글자 이상 입력하면 일치하는 팀을 보여줍니다.';});
  document.getElementById('homeNoticePopupClose')?.addEventListener('click',closeHomeNoticePopup);document.getElementById('homeNoticePopupConfirm')?.addEventListener('click',closeHomeNoticePopup);document.getElementById('homeNoticePopupBoard')?.addEventListener('click',()=>{closeHomeNoticePopup();navigatePortalView('board',{pushHistory:true});});
  document.addEventListener('click',e=>{const portal=e.target.closest?.('[data-portal-go]');if(portal&&!portal.dataset.portalBound){navigatePortalView(portal.dataset.portalGo,{pushHistory:true});return;}const choice=e.target.closest?.('[data-my-match-index]');if(choice){const teams=document.getElementById('myMatchTeamChoices')?._teams||[];const team=teams[Number(choice.dataset.myMatchIndex)];if(team)renderMyMatchTeam(team);return;}const edit=e.target.closest?.('[data-board-edit]');if(edit&&isAdmin()){const post=state.portal.posts.find(p=>p.id===edit.dataset.boardEdit);if(post)openBoardPostEditor(post);return;}const btn=e.target.closest?.('[data-board-delete]');if(!btn||!isAdmin())return;if(!confirm('이 게시물을 삭제할까요?'))return;state.portal.posts=state.portal.posts.filter(p=>p.id!==btn.dataset.boardDelete);commit('게시판 공지 삭제');renderPortalViews();});
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
console.log('[230MATCH] Stage34.3 multi-division independent operation');


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
    try{
      const payload={build:BUILD_LABEL,savedAt:new Date().toISOString(),state:structuredClone(state)};
      localStorage.setItem(LAST_GOOD_KEY,JSON.stringify(payload));
    }catch(error){console.warn('마지막 정상 상태 저장 실패',error);}
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
  setInterval(()=>{try{saveState(state);saveLastKnownGood();}catch(error){console.warn('주기 자동 저장 실패',error);}},300000);
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
  new MutationObserver(()=>requestAnimationFrame(markOverflow)).observe(document.querySelector('main')||document.body,{subtree:true,childList:true});
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
function v3252AutoMyMatch(){if(!currentAuthUser)return;const phone=v3252ProfileDefaults().phone;if(!phone)return;const teams=myMatchUniqueTeams().filter(t=>{const c=String(getTeamContact(state,t)?.phone||'').replace(/\D/g,'');const ps=[...(t.playerPhones||[]),...(t.players||[]).map(p=>p?.phone)].map(x=>String(x||'').replace(/\D/g,''));return c===phone||ps.includes(phone)});if(teams.length===1){const input=document.getElementById('myMatchSearchInput');if(input)input.value=portalTeam(teams[0]);renderMyMatchTeam(teams[0]);}}
const v3252OriginalSubmit=submitPublicApplication;submitPublicApplication=function(){const before=(state.portal?.applications||[]).length;const data=entryApplicationPlayersFromForm();const result=v3252OriginalSubmit.apply(this,arguments);if((state.portal?.applications||[]).length>before)v3252SaveProfile(data.players,data.representative);return result;};
const v3252OriginalEdit=editEntryApplication;editEntryApplication=function(id){const item=(state.portal?.applications||[]).find(a=>a.id===id);const lookup=String(document.getElementById('entryLookupPhone')?.value||'').replace(/\D/g,'');if(!v3252CanEdit(item,lookup))return notice('로그인한 본인 또는 등록 연락처로 확인된 승인 대기 신청만 수정할 수 있습니다.','error');return v3252OriginalEdit(id);};
const v3252OriginalSmsDialog=openEntrySmsDialog;openEntrySmsDialog=function(kind,item){entrySmsItem={kind,item};document.getElementById('entrySmsTitle').textContent=({approve:'참가 승인 문자',reserve:'후보 등록 문자',promote:'일반 참가 승격 문자',payment:'입금 완료 문자',reject:'신청 반려 문자',refund:'환불 완료 문자'})[kind]||'참가 신청 문자 확인';document.getElementById('entrySmsTarget').textContent=v3252Recipients(item).map(p=>`${p.name} · ${p.phone}`).join(' / ')||'수신번호 없음';document.getElementById('entrySmsBody').value=entrySmsMessage(kind,item);document.getElementById('entrySmsDialog')?.showModal();};
sendEntrySmsAligo=async function(){if(!entrySmsItem)return;const body=document.getElementById('entrySmsBody')?.value?.trim()||'';try{await sendAligoSmsV3(v3252Recipients(entrySmsItem.item),body,{source:'registration',kind:entrySmsItem.kind,title:'230MATCH 참가 안내'});entrySmsItem.item.smsHistory=entrySmsItem.item.smsHistory||[];entrySmsItem.item.smsHistory.unshift({kind:entrySmsItem.kind,channel:'aligo',sentAt:new Date().toISOString(),body});commit(`참가 안내 문자 발송 · ${entrySmsItem.item.teamName}`);notice('알리고 문자를 발송했습니다.','success');closeEntrySmsDialog();renderApplicationPortal();}catch(e){notice(`문자 발송 실패: ${e.message||e}`,'error')}};
const v3252RenderApplications=renderApplicationPortal;renderApplicationPortal=function(){v3252RenderApplications.apply(this,arguments);document.querySelectorAll('.entry-admin-row').forEach(row=>{const sms=row.querySelector('[data-entry-sms]');if(!sms)return;const id=sms.dataset.entrySms;const item=(state.portal?.applications||[]).find(a=>a.id===id);if(!item)return;if(!row.querySelector('[data-entry-sms-mode]')){const sel=document.createElement('select');sel.className='entry-sms-target-select';sel.dataset.entrySmsMode=id;sel.innerHTML=`<option value="representative">대표전화만</option><option value="both">두 선수 모두</option>`;sel.value=item.smsTargetMode==='both'?'both':'representative';sms.before(sel)}if(item.status==='delete_requested'&&!row.querySelector('[data-entry-admin-delete]')){const b=document.createElement('button');b.type='button';b.className='btn btn-danger-outline btn-small';b.dataset.entryAdminDelete=id;b.textContent='삭제 승인';row.querySelector('.entry-actions')?.appendChild(b)}});setTimeout(v3252AutofillEntry,0)};
document.addEventListener('change',e=>{const sel=e.target.closest?.('[data-entry-sms-mode]');if(!sel)return;const item=(state.portal?.applications||[]).find(a=>a.id===sel.dataset.entrySmsMode);if(item){item.smsTargetMode=sel.value==='both'?'both':'representative';commit(`문자 수신대상 설정 · ${item.teamName}`)}});
document.addEventListener('click',e=>{const cancel=e.target.closest?.('[data-entry-cancel]');if(cancel){e.preventDefault();e.stopImmediatePropagation();v3252DeleteRequest(cancel.dataset.entryCancel);return}const del=e.target.closest?.('[data-entry-admin-delete]');if(del){e.preventDefault();e.stopImmediatePropagation();v3252AdminDelete(del.dataset.entryAdminDelete)}} ,true);
window.addEventListener('hashchange',()=>{if(location.hash==='#entry')setTimeout(v3252AutofillEntry,50);if(location.hash==='#mymatch')setTimeout(v3252AutoMyMatch,50)});
document.addEventListener('DOMContentLoaded',()=>{setTimeout(v3252AutofillEntry,300);if(location.hash==='#mymatch')setTimeout(v3252AutoMyMatch,400)});


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
  return {format:'230MATCH_V3_STAGE326_PILOT',build:BUILD_LABEL,generatedAt:new Date().toISOString(),decision:fatal?'HOLD':'PASS',checksum:s.checksum,summary:{teams:s.active.length,contacts:s.contacts.length,prelimMatches:state.prelim?.matches?.length||0,mainMatches:s.matches.length,courts:s.courts.length,pendingMessages},sync:{enabled:cfg.enabled===true,roomId:cfg.roomId||'',collection:cfg.collection||'v3TournamentRooms'},checks,warnings,fatal};
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
  panel.hidden=false;panel.innerHTML=`<div class="section-head"><div><h2>${portalEscape(item.name)} 요강</h2><p>${portalEscape(item.division||'부서 미설정')} · ${tournamentStatusLabel(item.status)}</p></div><button type="button" class="btn btn-light" data-tournament-detail-close>닫기</button></div><div class="tournament-detail-grid"><div><span>대회일</span><b>${g.date?portalEscape(g.date):'미정'}</b></div><div><span>장소</span><b>${portalEscape(g.venue||'미정')}</b></div><div><span>참가비</span><b>${portalEscape(g.fee||'미설정')}</b></div><div><span>입금계좌</span><b>${portalEscape([g.bank,g.account].filter(Boolean).join(' ')||'미설정')}</b></div></div><div class="tournament-detail-text">${portalEscape(g.detail||item.detail||'등록된 세부 요강이 없습니다.').replace(/\n/g,'<br>')}</div>${g.imageDataUrl?`<div class="archived-guide-image-wrap"><img class="archived-guide-image" src="${g.imageDataUrl}" alt="${portalEscape(item.name)} 요강 이미지"><div class="archived-guide-image-actions"><a class="btn btn-light" href="${g.imageDataUrl}" download="${portalEscape(g.imageName||item.name+'-요강.jpg')}">이미지 다운로드</a></div></div>`:''}`;
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
void 0;


// Stage 32.8 · tournament-list guide and image attachment
let stage328PendingGuideImage='';
let stage328PendingGuideImageName='';
let stage328PendingGuideImageType='';
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
  const max=1800,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
  let quality=.82,data=canvas.toDataURL('image/jpeg',quality);
  while(data.length>650000&&quality>.42){quality-=.08;data=canvas.toDataURL('image/jpeg',quality);}
  if(data.length>850000)throw new Error('이미지를 충분히 압축하지 못했습니다. 더 작은 이미지를 선택해 주세요.');
  return {dataUrl:data,type:'image/jpeg',name:stage328SafeFileName(file.name,'image/jpeg')};
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
document.addEventListener('click',e=>{if(e.target?.id==='removeGuideImageBtn'){e.preventDefault();stage328PendingGuideImage='';stage328PendingGuideImageName='';stage328PendingGuideImageType='';stage328RenderGuideImageEditorPreview();const input=document.getElementById('guideImageInput');if(input)input.value='';notice('첨부 이미지를 제거했습니다. 요강 저장을 눌러 완료하세요.','success');}},true);
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
  setInterval(()=>{if(document.body?.dataset?.currentView==='home'||document.querySelector('#view-home.active'))update();},5000);
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
    update();setInterval(update,1500);
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
const DIVISION_GLOBAL_PORTAL_KEYS=new Set(['tournamentArchives','participantArchives','tournamentTemplates']);
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
  ensurePortalState();ensurePrelimState(state);ensureTimeState(state);ensureDrawMeta(state);ensureMessagingState(state);ensureContacts(state);ensureAuditState(state);ensureEarlyMainSettings(state);ensureVenueSettings(state);ensureVenueQueues(state);ensureCourtStatuses(state);ensureCourtManualQueues(state);ensurePrelimCourtStatuses(state);ensureOperatorState();return true;
}
function switchDivisionWorkspace(id){const next=state.multiDivision?.divisions?.find(x=>x.id===id);if(!next||next.id===state.multiDivision.activeDivisionId)return;if(!applyDivisionSnapshot(next))return;state.tournament.capacity=Math.max(1,Number(next.snapshot?.divisionConfig?.capacity||state.prelim?.settings?.activeTeamCount||96));safePersistState(`부서 전환 · ${next.name}`);syncInputs();syncPrelimInputs();renderVenueSettingsEditor();render(state,{openResult,openPrelimResult,selectActiveSwap,selectReserveSwap,copyMessage,openSmsMessage,setMessageSent,removeMessage,openContactEdit,openMessageHistory,reorderQueue,openQueueMove,openManualAssign,returnWait1,openCourtTransfer,openUnifiedCourtTransfer,openCourtStatus,openManualQueueAssign,reorderManualQueue,returnManualQueue,reorderPrelimQueue,openPrelimMove,returnPrelimWait1,openPrelimCourtStatus,holdMainMatch,releaseHeldMatch});renderOperatorControls();applyRoleUI();renderPortalViews();renderDivisionWorkspaceBar();autoSmsSnapshot=buildAutoSmsSnapshot();notice(`${state.tournament.name} · ${next.name}으로 전환했습니다.`,'success');}
function renderDivisionWorkspaceBar(){
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
const divisionObserver=new MutationObserver(()=>injectDivisionManagerIntoTournamentEditor());
divisionObserver.observe(document.body,{childList:true,subtree:true});
injectDivisionManagerIntoTournamentEditor();

renderDivisionWorkspaceBar();
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

  const observer=new MutationObserver(()=>refreshDivisionEditorPanel());
  observer.observe(document.body,{childList:true,subtree:true});
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
      if(wizardEl('wizardCloudUpload')?.checked){try{await pushStateNow(state);}catch(_e){}}
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

  const mo=new MutationObserver(()=>{safeRefreshDivisionEditor();replaceWizardCreateButton();});
  mo.observe(document.body,{childList:true,subtree:true});
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

/* Stage 34.3.7 · simple complete multi-division editor */
(function(){
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clone=v=>{try{return structuredClone(v)}catch(_e){return JSON.parse(JSON.stringify(v))}};
  const divisions=()=>{try{ensureMultiDivisionRuntime()}catch(_e){} return state.multiDivision?.divisions||[]};
  const record=id=>divisions().find(d=>String(d.id)===String(id));
  let selectedDivisionId='';

  function summary(rec){
    const snap=divisionSnapshotSettings(rec), ps=snap.prelim?.settings||{}, s=snap.settings||{};
    const venues=(s.venues||[]).map(v=>{const n=normalizeDivisionVenue(v);return `${n.name} ${n.courtNumbers.join('·')}번`}).join(' / ')||'구장 미설정';
    return `정원 ${Number(snap.divisionConfig?.capacity||ps.activeTeamCount||96)}팀 · 본선 ${Number(s.drawSize||64)}강 · ${venues}`;
  }
  function ensureEditor(){
    document.getElementById('stage3437TournamentEditor')?.remove();
    const d=document.createElement('dialog');
    d.id='stage3437TournamentEditor';d.className='stage3437-dialog';
    d.innerHTML=`<div class="stage3437-shell"><header><div><small>TOURNAMENT EDITOR</small><h2>대회 편집</h2><p>대회 공통정보와 부서별 운영 설정을 한 화면에서 관리합니다.</p></div><button type="button" data-3437-close aria-label="닫기">×</button></header><div class="stage3437-body"><section class="stage3437-common"><h3>대회 공통정보</h3><div class="stage3437-grid"><label>대회명<input id="s3437Name"></label><label>대회일<input id="s3437Date" type="date"></label><label>시작 시간<input id="s3437Time" type="time"></label><label>대표 장소 안내<input id="s3437Venue"></label></div><button type="button" class="btn btn-light" data-3437-save-common>공통정보 저장</button></section><section class="stage3437-divisions"><div class="stage3437-section-head"><div><h3>부서별 설정</h3><p>부서를 선택하면 해당 부서의 정원·본선·구장·사용 코트만 표시됩니다.</p></div><button type="button" class="btn btn-primary" data-3437-add-division>+ 부서 추가</button></div><div id="s3437DivisionTabs" class="stage3437-tabs"></div><div id="s3437DivisionPanel"></div></section></div></div>`;
    document.body.appendChild(d);
    d.addEventListener('cancel',e=>{e.preventDefault();d.close()});
    d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-3437-close]'))d.close()});
    return d;
  }
  function venueCard(v,i){
    const n=normalizeDivisionVenue(v||{name:`새 구장 ${i+1}`,courtMax:8,courtNumbers:[1],usePrelim:true,useMain:true});
    const checks=Array.from({length:Math.max(1,Number(n.courtMax||8))},(_,k)=>k+1).map(no=>`<label><input type="checkbox" data-court-no="${no}" ${n.courtNumbers.includes(no)?'checked':''}>${no}번</label>`).join('');
    return `<article class="stage3437-venue"><div class="stage3437-venue-head"><strong>구장 ${i+1}</strong><button type="button" class="btn btn-danger-outline btn-small" data-3437-remove-venue>삭제</button></div><div class="stage3437-grid compact"><label>구장명<input data-vf="name" value="${esc(n.name)}"></label><label>코트 번호 범위<input data-vf="courtMax" type="number" min="1" max="30" value="${n.courtMax||8}"></label></div><div class="stage3437-scope"><label><input type="checkbox" data-vf="usePrelim" ${n.usePrelim?'checked':''}> 예선 사용</label><label><input type="checkbox" data-vf="useMain" ${n.useMain?'checked':''}> 본선 사용</label></div><div class="stage3437-courts">${checks}</div></article>`;
  }
  function divisionPanelHtml(rec){
    const snap=divisionSnapshotSettings(rec), ps=snap.prelim?.settings||{}, s=snap.settings||{}, venues=s.venues||[];
    return `<div class="stage3437-division-form" data-division-id="${esc(rec.id)}"><div class="stage3437-grid"><label>부서명<input id="s3437DivName" value="${esc(rec.name)}"></label><label>참가 정원<input id="s3437Capacity" type="number" min="1" value="${Number(snap.divisionConfig?.capacity||ps.activeTeamCount||96)}"></label><label>본선 규모<select id="s3437DrawSize"><option value="32" ${Number(s.drawSize||64)===32?'selected':''}>32강</option><option value="64" ${Number(s.drawSize||64)===64?'selected':''}>64강</option><option value="128" ${Number(s.drawSize||64)===128?'selected':''}>128강</option></select></label><label>조당 본선 진출팀<input id="s3437Qualifiers" type="number" min="1" max="3" value="${Number(ps.qualifiersPerGroup||2)}"></label><label>2팀조 수<input id="s3437TwoGroups" type="number" min="0" value="${Number(ps.twoTeamGroups||ps.twoTeamGroupCount||0)}"></label><label>경기시간(분)<input id="s3437Minutes" type="number" min="10" value="${Number(s.matchMinutes||40)}"></label></div><div class="stage3437-venue-title"><div><h4>구장·사용 코트</h4><p>실제 사용할 코트 번호만 체크하세요.</p></div><button type="button" class="btn btn-light" data-3437-add-venue>+ 구장 추가</button></div><div id="s3437VenueList">${(venues.length?venues:[{name:'국제',courtMax:8,courtNumbers:[1,2,3,4,5,6,7,8],usePrelim:true,useMain:true}]).map(venueCard).join('')}</div><div class="stage3437-actions"><button type="button" class="btn btn-danger-outline" data-3437-delete-division ${divisions().length<=1?'disabled':''}>부서 삭제</button><button type="button" class="btn btn-primary" data-3437-save-division>이 부서 설정 저장</button></div><p id="s3437Message"></p></div>`;
  }
  function renderTabs(){
    const d=document.getElementById('stage3437TournamentEditor');if(!d)return;
    const list=divisions();if(!list.length)return;
    if(!record(selectedDivisionId))selectedDivisionId=state.multiDivision?.activeDivisionId||list[0].id;
    d.querySelector('#s3437DivisionTabs').innerHTML=list.map(r=>`<button type="button" class="${String(r.id)===String(selectedDivisionId)?'active':''}" data-3437-select-division="${esc(r.id)}"><strong>${esc(r.name)}</strong><small>${esc(summary(r))}</small></button>`).join('');
    d.querySelector('#s3437DivisionPanel').innerHTML=divisionPanelHtml(record(selectedDivisionId));
  }
  function openEditor(){
    if(typeof requireAdmin==='function'&&!requireAdmin('대회 편집'))return;
    const d=ensureEditor();
    d.querySelector('#s3437Name').value=state.tournament?.name||'';
    d.querySelector('#s3437Date').value=state.portal?.guide?.date||'';
    d.querySelector('#s3437Time').value=state.portal?.guide?.startTime||'09:00';
    d.querySelector('#s3437Venue').value=state.portal?.guide?.venue||'';
    selectedDivisionId=state.multiDivision?.activeDivisionId||divisions()[0]?.id||'';
    renderTabs();d.showModal();
  }
  function readVenues(root){
    return [...root.querySelectorAll('.stage3437-venue')].map((el,i)=>normalizeDivisionVenue({name:String(el.querySelector('[data-vf="name"]')?.value||`구장 ${i+1}`).trim(),courtMax:Number(el.querySelector('[data-vf="courtMax"]')?.value||8),courtNumbers:[...el.querySelectorAll('[data-court-no]:checked')].map(x=>Number(x.dataset.courtNo)),usePrelim:Boolean(el.querySelector('[data-vf="usePrelim"]')?.checked),useMain:Boolean(el.querySelector('[data-vf="useMain"]')?.checked)},i));
  }
  function saveDivision(){
    const d=document.getElementById('stage3437TournamentEditor'), rec=record(selectedDivisionId);if(!d||!rec)return;
    const root=d.querySelector('.stage3437-division-form'), msg=d.querySelector('#s3437Message');
    const name=String(d.querySelector('#s3437DivName')?.value||'').trim();
    const venues=readVenues(root);
    if(!name){msg.textContent='부서명을 입력하세요.';return}
    if(divisions().some(x=>String(x.id)!==String(rec.id)&&x.name===name)){msg.textContent='같은 이름의 부서가 있습니다.';return}
    if(!venues.length||venues.some(v=>!v.courtNumbers.length)){msg.textContent='각 구장에서 사용할 코트를 한 면 이상 선택하세요.';return}
    if(!venues.some(v=>v.usePrelim)||!venues.some(v=>v.useMain)){msg.textContent='예선과 본선 사용 구장을 각각 한 곳 이상 선택하세요.';return}
    const capacity=Math.max(1,Number(d.querySelector('#s3437Capacity')?.value||96));
    const drawSize=Number(d.querySelector('#s3437DrawSize')?.value||64), qualifiers=Math.max(1,Number(d.querySelector('#s3437Qualifiers')?.value||2)), two=Math.max(0,Number(d.querySelector('#s3437TwoGroups')?.value||0)), minutes=Math.max(10,Number(d.querySelector('#s3437Minutes')?.value||40));
    const snap=divisionSnapshotSettings(rec);rec.name=name;rec.updatedAt=new Date().toISOString();snap.divisionConfig={...(snap.divisionConfig||{}),capacity};snap.prelim=snap.prelim||{};snap.prelim.settings={...(snap.prelim.settings||{}),activeTeamCount:capacity,qualifiersPerGroup:qualifiers,twoTeamGroups:two,twoTeamGroupCount:two};snap.settings={...(snap.settings||{}),drawSize,matchMinutes:minutes,venues:clone(venues)};rec.snapshot=snap;
    if(String(rec.id)===String(state.multiDivision?.activeDivisionId)){state.tournament={...(state.tournament||{}),division:name,capacity};state.prelim=snap.prelim;state.settings={...(state.settings||{}),...snap.settings};try{ensureVenueSettings(state);ensureVenueQueues(state)}catch(_e){}}
    saveState(state);renderTabs();augmentTournamentCards();notice(`${name} 부서 설정을 저장했습니다.`,'success');
  }
  function addDivision(){
    const name=prompt('추가할 부서명을 입력하세요.');if(!name?.trim())return;
    const id=`division-${Date.now().toString(36)}`;const base=divisionSnapshotSettings(record(selectedDivisionId)||divisions()[0]);
    divisions().push({id,name:name.trim(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),snapshot:{...clone(base),teams:[],entryRecords:[],draw:{rounds:{}},prelim:{...(clone(base.prelim||{})),groups:[],matches:[],standings:[]},courts:[],queues:{},messages:[]}});selectedDivisionId=id;saveState(state);renderTabs();augmentTournamentCards();
  }
  function deleteDivision(){
    if(divisions().length<=1)return;if(!confirm('이 부서를 삭제할까요? 부서의 참가자와 경기 데이터도 함께 삭제됩니다.'))return;
    const idx=divisions().findIndex(x=>String(x.id)===String(selectedDivisionId));divisions().splice(idx,1);selectedDivisionId=divisions()[0].id;if(String(state.multiDivision.activeDivisionId)===String(selectedDivisionId))state.multiDivision.activeDivisionId=selectedDivisionId;saveState(state);renderTabs();augmentTournamentCards();
  }
  function augmentTournamentCards(){
    const card=document.querySelector('.tournament-list-card.current');if(!card)return;
    let wrap=card.querySelector('.stage3437-card-divisions');if(!wrap){wrap=document.createElement('div');wrap.className='stage3437-card-divisions';const info=card.querySelector('.tournament-card-info');(info||card).insertAdjacentElement('afterend',wrap)}
    wrap.innerHTML=`<span>부서</span>${divisions().map(r=>`<button type="button" class="${String(r.id)===String(state.multiDivision?.activeDivisionId)?'active':''}" data-3437-card-division="${esc(r.id)}">${esc(r.name)}</button>`).join('')}`;
  }

  stage3210OpenTournamentEdit=openEditor;stage329OpenTournamentEdit=openEditor;
  window.stage3210OpenTournamentEdit=openEditor;window.stage329OpenTournamentEdit=openEditor;
  const baseRender=renderTournamentList;renderTournamentList=function(){baseRender.apply(this,arguments);setTimeout(augmentTournamentCards,0)};
  document.addEventListener('click',e=>{
    const sel=e.target.closest('[data-3437-select-division]');if(sel){selectedDivisionId=sel.dataset['3437SelectDivision'];renderTabs();return}
    if(e.target.closest('[data-3437-add-division]')){addDivision();return}
    if(e.target.closest('[data-3437-save-common]')){state.tournament={...(state.tournament||{}),name:document.getElementById('s3437Name')?.value.trim()||state.tournament?.name};state.portal=state.portal||{};state.portal.guide={...(state.portal.guide||{}),date:document.getElementById('s3437Date')?.value||'',startTime:document.getElementById('s3437Time')?.value||'',venue:document.getElementById('s3437Venue')?.value||''};saveState(state);notice('대회 공통정보를 저장했습니다.','success');return}
    if(e.target.closest('[data-3437-save-division]')){saveDivision();return}
    if(e.target.closest('[data-3437-delete-division]')){deleteDivision();return}
    if(e.target.closest('[data-3437-add-venue]')){const list=document.getElementById('s3437VenueList'),i=list.children.length;list.insertAdjacentHTML('beforeend',venueCard({name:`새 구장 ${i+1}`,courtMax:8,courtNumbers:[1],usePrelim:true,useMain:true},i));return}
    const rm=e.target.closest('[data-3437-remove-venue]');if(rm){const list=document.getElementById('s3437VenueList');if(list.children.length<=1){notice('구장은 한 곳 이상 필요합니다.','warning');return}rm.closest('.stage3437-venue')?.remove();return}
    const card=e.target.closest('[data-3437-card-division]');if(card){e.preventDefault();switchDivisionWorkspace(card.dataset['3437CardDivision']);augmentTournamentCards();renderPortalViews();return}
  },true);
  document.addEventListener('change',e=>{if(e.target.matches('.stage3437-venue [data-vf="courtMax"]')){const card=e.target.closest('.stage3437-venue'),v={name:card.querySelector('[data-vf="name"]')?.value||'',courtMax:Number(e.target.value||8),courtNumbers:[...card.querySelectorAll('[data-court-no]:checked')].map(x=>Number(x.dataset.courtNo)),usePrelim:card.querySelector('[data-vf="usePrelim"]')?.checked,useMain:card.querySelector('[data-vf="useMain"]')?.checked};card.outerHTML=venueCard(v,[...card.parentElement.children].indexOf(card))}},true);
  const style=document.createElement('style');style.textContent=`.stage3437-dialog{border:0;padding:0;background:transparent;width:min(1100px,96vw);max-width:96vw;max-height:94vh}.stage3437-dialog::backdrop{background:rgba(7,24,52,.66)}.stage3437-shell{background:white;border-radius:22px;overflow:hidden;max-height:94vh}.stage3437-shell>header{background:#102d57;color:white;padding:20px 24px;display:flex;justify-content:space-between;gap:15px}.stage3437-shell>header h2{margin:3px 0}.stage3437-shell>header button{width:42px;height:42px;border:0;border-radius:12px;font-size:24px}.stage3437-body{padding:20px;overflow:auto;max-height:calc(94vh - 120px);display:grid;gap:18px}.stage3437-common,.stage3437-divisions{border:1px solid #d7e2f2;border-radius:16px;padding:16px}.stage3437-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.stage3437-grid.compact{grid-template-columns:1fr 160px}.stage3437-grid label{display:grid;gap:6px;font-weight:700}.stage3437-grid input,.stage3437-grid select{width:100%;padding:11px;border:1px solid #c8d7ea;border-radius:10px}.stage3437-section-head,.stage3437-venue-title,.stage3437-venue-head,.stage3437-actions{display:flex;justify-content:space-between;align-items:center;gap:12px}.stage3437-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.stage3437-tabs button{border:1px solid #c8d7ea;background:white;border-radius:12px;padding:10px 12px;text-align:left;display:grid;gap:3px}.stage3437-tabs button.active{background:#102d57;color:white}.stage3437-tabs small{font-size:11px}.stage3437-division-form{display:grid;gap:16px}.stage3437-venue{border:1px solid #d7e2f2;background:#f8fbff;border-radius:14px;padding:14px;margin-top:10px}.stage3437-scope{display:flex;gap:20px;margin:12px 0}.stage3437-courts{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:7px}.stage3437-courts label{border:1px solid #d7e2f2;background:white;border-radius:8px;padding:7px;display:flex;gap:5px;align-items:center}.stage3437-card-divisions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:10px 0}.stage3437-card-divisions button{border:1px solid #c8d7ea;background:white;border-radius:999px;padding:7px 11px}.stage3437-card-divisions button.active{background:#102d57;color:white}.stage3437-actions{margin-top:8px}@media(max-width:700px){.stage3437-grid,.stage3437-grid.compact{grid-template-columns:1fr}.stage3437-courts{grid-template-columns:repeat(4,1fr)}}`;
  document.head.appendChild(style);
  setTimeout(augmentTournamentCards,0);
  const label=document.getElementById('buildStageLabel');if(label){label.textContent='230MATCH 34.3.7 · 단순 다부서 완성 편집본';label.title='Version 34.3.7'}
  document.documentElement.dataset.build='3437';console.info('[230MATCH V3] 34.3.7 ready · simple multi-division editor active');
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
