
import{allMatches,roundLabel,findMatch}from'./bracket-engine.js';
import{timeInfo}from'./time-engine.js';
import{contactStats,getTeamContact}from'./contact-engine.js';
import{venueStats,totalVenueQueueCount}from'./venue-engine.js';
import{availableCourtSlots}from'./manual-court-engine.js';
import{earlyMainStats,ensureEarlyMainSettings}from'./early-main-engine.js';
import{findUnifiedMatch}from'./unified-court-engine.js?v=3502';
import{hasAuthorizedMainDraw}from'./main-draw-lifecycle-engine.js?v=3500';
export function teamText(team){
  if(!team)return'TBD';
  if(team.placeholder)return`${team.name}`;
  return `${team.name}${team.affiliation?`(${team.affiliation})`:''}`;
}

function renderEarlyMainStatus(state){
  ensureEarlyMainSettings(state);
  const stats=earlyMainStats(state);
  setText('earlyMainReadyCount',stats.resolved);
  setText('earlyMainPendingCount',stats.pending);
  setText('earlyMainAssignableCount',stats.assignable);
  setText('earlyMainAutoStatus',state.settings.autoIncrementalMainEnabled?'ON':'OFF');
}


function renderLinkedDrawModeGuard(state){
  const guarded=Boolean(state.prelim?.groups?.length);
  ['instantDrawBtn','rouletteDrawBtn','seededDrawBtn','reshuffleDrawBtn'].forEach(id=>{
    const btn=document.getElementById(id);if(!btn)return;
    btn.disabled=guarded;
    btn.title=guarded?'예선 진행 대회는 예선 슬롯 본선 선추첨을 사용합니다.':'';
  });
  const linkedBtn=document.getElementById('generateLinkedDrawBtn');
  if(linkedBtn){
    linkedBtn.classList.toggle('btn-pulse-guide',guarded&&!state.prelim?.linkedDraw?.active);
  }
}

export function render(state,handlers){
  const matches=allMatches(state.draw);
  const completed=matches.filter(m=>m.status==='completed').length;
  const playing=matches.filter(m=>m.status==='playing').length;
  setText('heroDrawSize',state.draw.size?`${state.draw.size}강`:'-');setText('heroMatchCount',matches.length);setText('heroCompleted',completed);setText('heroPlaying',playing);
  setText('summaryTeams',`${state.teams.length}팀`);setText('summaryRound',currentRound(state));setText('summaryPlaying',playing);
  const activeCourts=(state.prelim?.courts?.length?state.prelim.courts:state.courts)||[];setText('summaryWait1',activeCourts.filter(c=>c.wait1).length);setText('summaryShared',totalVenueQueueCount(state)+(state.sharedQueue?.length||0));
  setText('summaryAverageMinutes',`${state.timeMetrics?.averageMinutes||state.settings?.matchMinutes||40}분`);const measuredCount=state.timeMetrics?.measuredSampleCount||0;setText('summaryMeasuredMinutes',measuredCount?`${state.timeMetrics?.measuredAverageMinutes||0}분 (${measuredCount}경기·참고)`:'표본 없음');setText('summaryLongestWait',`${state.timeMetrics?.longestWaitMinutes||0}분`);
  setText('summaryDrawMethod',drawMethodLabel(state.drawMeta?.method));setText('summaryDrawLock',state.drawMeta?.locked?'잠금':'해제');setText('summaryPendingMessages',`${state.messaging?.queue?.filter(x=>x.status==='pending'||x.status==='no-phone').length||0}건`);setText('summaryPhoneTeams',`${contactStats(state).withPhone}팀`);setText('summaryAuditStatus',auditLabel(state.audit?.overall));setText('summaryVenueCount',`${venueStats(state).venueCount}곳`);setText('summaryVenueQueueCount',`${totalVenueQueueCount(state)}경기`);renderContactRoster(state,handlers);updateDrawLockInfo(state);renderMessageCenter(state,handlers);
  setText('baseMatchMinutes',`${state.settings.matchMinutes||30}분`);setText('autoTimeStatus',state.settings.autoTimeEnabled?'ON':'OFF');
  setText('lastTimeCalculated',state.timeMetrics?.lastCalculatedAt?new Date(state.timeMetrics.lastCalculatedAt).toLocaleTimeString('ko-KR'):'-');
  setText('sharedQueueCount',`${totalVenueQueueCount(state)+(state.sharedQueue?.length||0)}경기`);
  renderTournamentCompletion(state);renderCourts(state,handlers);renderQueue(state,handlers);renderPrelim(state,handlers);renderOperationUnified(state,handlers);renderBracket(state);renderDrawHistory(state);renderAudit(state);renderLogs(state);
}
function renderTournamentCompletion(state){
  const el=document.getElementById('tournamentCompletionBanner');if(!el)return;
  const final=findMatch(state.draw,'r2_m1');
  const done=Boolean(final?.status==='completed'&&final.winner);
  el.hidden=!done;
  if(!done)return;
  setText('tournamentChampionName',teamText(final.winner));
  setText('tournamentCompletedTime',(state.operation?.tournamentCompletedAt||final.completedAt)?new Date(state.operation?.tournamentCompletedAt||final.completedAt).toLocaleString('ko-KR'):'');
}
function setText(id,value){const el=document.getElementById(id);if(el)el.textContent=value;}
function currentRound(state){
  const sizes=Object.keys(state.draw.rounds||{}).map(Number).sort((a,b)=>b-a);
  for(const size of sizes){const ms=state.draw.rounds[size];if(ms.some(m=>m.status!=='completed'))return roundLabel(size);}
  return sizes.length?'대회 완료':'-';
}

function compactNameParts(raw=''){
  const cleaned=String(raw)
    .replace(/\([^)]*\)/g,'')
    .replace(/\[[^\]]*\]/g,'')
    .replace(/\s{2,}/g,' ')
    .trim();
  return cleaned.split('/').map(part=>({name:part.trim(),club:''})).filter(x=>x.name);
}
function operationalTeamHtml(team,state){
  if(!team)return'TBD';
  if(team.placeholder)return`<span class="placeholder-team">${team.name}</span>`;
  return compactNameParts(teamText(team)).map(x=>x.name).join(' / ')||teamText(team);
}
function internalMatchIdHtml(id){
  if(!id)return'';
  return `<span class="internal-match-id" title="관리자용 내부 경기 ID">ID ${id}</span>`;
}
function publicMatchFallback(id){
  return `<span class="match-data-missing">경기 정보 확인중</span>${internalMatchIdHtml(id)}`;
}

function operationalTeamText(team,state){
  if(!team)return'TBD';
  if(team.placeholder)return team.name;
  return compactNameParts(teamText(team)).map(x=>x.name).join(' / ')||teamText(team);
}

function renderCourts(state,handlers){
  const root=document.getElementById('courtGrid');
  if(!root)return;
  if(!state.courts.length){root.className='court-grid empty-state';root.innerHTML='<p>대진 생성과 코트배정을 실행하면 코트 카드가 표시됩니다.</p>';return;}
  root.className='court-grid venue-court-grid';
  const groups=new Map();
  state.courts.forEach(c=>{
    const key=c.venueId||'venue-default';
    if(!groups.has(key))groups.set(key,{name:c.venueName||state.settings.courtPrefix||'구장',courts:[]});
    groups.get(key).courts.push(c);
  });
  root.innerHTML=[...groups.values()].map(group=>`<section class="venue-group">
    <div class="venue-group-head"><h3>📍 ${group.name}</h3><span>${group.courts.length}면</span></div>
    <div class="court-grid">${group.courts.map(c=>{
      const p=c.playing?findMatch(state.draw,c.playing):null,w=c.wait1?findMatch(state.draw,c.wait1):null;
      return `<article class="court-card ${c.isPaused?'paused':''}"><header><strong>${c.isPaused?'⛔':'🚀'} ${c.name}</strong><span>${c.isPaused?'사용중지':p?'시합중':'빈코트'}</span></header>
        <div class="court-slot"><small>시합중</small><b>${p?`${operationalTeamHtml(p.teamA,state)} vs ${operationalTeamHtml(p.teamB,state)}`:'진행 경기 없음'}</b><em>${p?`${roundLabel(p.roundSize)}${internalMatchIdHtml(p.id)}`:'-'}</em>${p?timeBadgeHtml(p):''}
        <button class="btn" data-result="${p?.id||''}" ${p?'':'disabled'}>결과 입력</button>${p?`<div class="court-transfer-actions"><button class="btn btn-light" data-court-transfer="${c.id}" data-slot="playing">⇄</button></div>`:''}</div>
        ${c.isPaused&&c.pauseReason?`<div class="court-pause-reason">중지 사유: ${c.pauseReason}</div>`:''}<div class="court-slot wait"><small>대기 1번</small><b>${w?`${operationalTeamHtml(w.teamA,state)} vs ${operationalTeamHtml(w.teamB,state)}`:'대기 경기 없음'}</b><em>${w?`${roundLabel(w.roundSize)}${internalMatchIdHtml(w.id)}`:'-'}</em>${w?timeBadgeHtml(w):''}${w?`<div class="manual-court-actions"><button class="btn btn-light" data-court-transfer="${c.id}" data-slot="wait1">⇄</button><button class="btn btn-light" data-return-wait1="${c.id}">공용대기로 돌리기</button><button class="btn btn-danger-outline" data-hold-main="${w.id}">보류</button></div>`:''}</div>${c.manualQueue?.length?`<div class="court-manual-queue"><strong>관리자 지정 대기</strong>${c.manualQueue.map((id,index)=>{const mq=findMatch(state.draw,id);return`<div class="court-manual-item"><span class="manual-no">대기${index+2}</span><b>${mq?`${operationalTeamHtml(mq.teamA,state)} vs ${operationalTeamHtml(mq.teamB,state)}`:publicMatchFallback(id)}<span class="admin-designated-badge">관리자 지정</span></b><div class="court-manual-actions"><button class="btn btn-light" data-manual-q-up="${id}" data-court-id="${c.id}" ${index===0?'disabled':''}>▲</button><button class="btn btn-light" data-manual-q-down="${id}" data-court-id="${c.id}" ${index===c.manualQueue.length-1?'disabled':''}>▼</button><button class="btn btn-primary" data-court-transfer="${c.id}" data-slot="manual:${id}">⇄</button><button class="btn btn-light" data-manual-q-return="${id}" data-court-id="${c.id}">공용대기</button></div></div>`}).join('')}</div>`:''}<div class="court-status-actions"><button class="btn ${c.isPaused?'btn-primary':'btn-danger-outline'}" data-court-status="${c.id}">${c.isPaused?'코트 사용 재개':'코트 사용중지'}</button></div>${c.isPaused&&c.pauseReason?`<div class="prelim-court-pause-reason">중지 사유: ${c.pauseReason}</div>`:''}<div class="prelim-court-status-actions"><button class="btn ${c.isPaused?'btn-primary':'btn-danger-outline'}" data-prelim-court-status="${c.id}">${c.isPaused?'코트 사용 재개':'코트 사용중지'}</button></div></article>`;
    }).join('')}</div>
  </section>`).join('');
  root.querySelectorAll('[data-hold-main]').forEach(b=>b.onclick=()=>handlers.holdMainMatch(b.dataset.holdMain));root.querySelectorAll('[data-result]').forEach(b=>b.addEventListener('click',()=>handlers.openResult(b.dataset.result)));root.querySelectorAll('[data-return-wait1]').forEach(b=>b.onclick=()=>handlers.returnWait1(b.dataset.returnWait1));root.querySelectorAll('[data-court-transfer]').forEach(b=>b.onclick=()=>handlers.openCourtTransfer(b.dataset.courtTransfer,b.dataset.slot));root.querySelectorAll('[data-court-status]').forEach(b=>b.onclick=()=>handlers.openCourtStatus(b.dataset.courtStatus));root.querySelectorAll('[data-manual-q-up]').forEach(b=>b.onclick=()=>handlers.reorderManualQueue(b.dataset.courtId,b.dataset.manualQUp,'up'));root.querySelectorAll('[data-manual-q-down]').forEach(b=>b.onclick=()=>handlers.reorderManualQueue(b.dataset.courtId,b.dataset.manualQDown,'down'));root.querySelectorAll('[data-manual-q-return]').forEach(b=>b.onclick=()=>handlers.returnManualQueue(b.dataset.courtId,b.dataset.manualQReturn));
}
function renderQueue(state,handlers){
  const root=document.getElementById('sharedQueue');
  if(!root)return;
  const venues=state.settings.venues||[];
  const queues=state.venueQueues||{};
  const total=Object.values(queues).reduce((sum,q)=>sum+q.length,0)+(state.sharedQueue?.length||0);
  setText('sharedQueueCount',`${total}경기`);
  if(!total){root.className='shared-queue venue-queue-board empty-state';root.innerHTML='<p>구장별 공용대기 경기가 없습니다.</p>';return;}
  root.className='shared-queue venue-queue-board';
  root.innerHTML=venues.map(v=>{
    const queue=queues[v.id]||[];
    return`<section class="venue-queue-section"><header><h3>📍 ${v.name} 공용대기</h3><span>${queue.length}경기</span></header>
      <div class="venue-queue-cards">${queue.length?queue.map((id,i)=>{const m=findMatch(state.draw,id);return`<article class="queue-card operation-queue-card"><span class="num">${i+1}</span><b>${m?`${operationalTeamHtml(m.teamA,state)} vs ${operationalTeamHtml(m.teamB,state)}`:publicMatchFallback(id)}</b><em>${m?`${roundLabel(m.roundSize)}${internalMatchIdHtml(id)}`:'경기 없음'}</em>${m?sharedQueueTimeBadgeHtml(m):''}<div class="queue-card-actions"><button class="btn btn-light" data-queue-up="${id}" data-venue-id="${v.id}" ${i===0?'disabled':''}>▲</button><button class="btn btn-light" data-queue-down="${id}" data-venue-id="${v.id}" ${i===queue.length-1?'disabled':''}>▼</button><button class="btn btn-primary" data-manual-assign="${id}" data-venue-id="${v.id}">${availableCourtSlots(state,v.id).length?'코트배정':'배정 자리 없음'}</button><button class="btn btn-purple" data-admin-queue="${id}" data-venue-id="${v.id}">코트 대기 지정</button><button class="btn btn-secondary" data-queue-move="${id}" data-venue-id="${v.id}">구장 이동</button><button class="btn btn-danger-outline" data-hold-main="${id}">보류</button></div></article>`}).join(''):'<div class="empty-state"><p>대기 경기 없음</p></div>'}</div>
    </section>`;
  }).join('');
  root.querySelectorAll('[data-queue-up]').forEach(b=>b.onclick=()=>handlers.reorderQueue(b.dataset.venueId,b.dataset.queueUp,'up'));
  root.querySelectorAll('[data-queue-down]').forEach(b=>b.onclick=()=>handlers.reorderQueue(b.dataset.venueId,b.dataset.queueDown,'down'));
  root.querySelectorAll('[data-hold-main]').forEach(b=>b.onclick=()=>handlers.holdMainMatch(b.dataset.holdMain));
  root.querySelectorAll('[data-queue-move]').forEach(b=>b.onclick=()=>handlers.openQueueMove(b.dataset.venueId,b.dataset.queueMove));root.querySelectorAll('[data-manual-assign]').forEach(b=>b.onclick=()=>handlers.openManualAssign(b.dataset.venueId,b.dataset.manualAssign));root.querySelectorAll('[data-admin-queue]').forEach(b=>b.onclick=()=>handlers.openManualQueueAssign(b.dataset.venueId,b.dataset.adminQueue));
}

function bracketCourtLabel(match){
  if(match.status==='playing')return match.court?`시합중 · ${match.court}`:'시합중 · 코트 확인중';
  if(match.status==='court_wait1')return match.court?`대기1 · ${match.court}`:'대기1 · 코트 확인중';
  if(match.status==='court_manual_queue')return match.court?`관리자 대기 · ${match.court}`:'관리자 대기';
  if(match.status==='venue_shared_queue'||match.status==='shared_queue')return match.venueId?'구장 공용대기':'공용대기';
  return'';
}
function bracketStatusClass(status){
  return({
    playing:'is-playing',
    court_wait1:'is-wait1',
    court_manual_queue:'is-manual-wait',
    venue_shared_queue:'is-shared-wait',
    shared_queue:'is-shared-wait',
    ready:'is-ready',
    waiting_slots:'is-placeholder',
    completed:'completed'
  })[status]||'';
}
function roundThemeClass(size){
  const map={128:'round-128',64:'round-64',32:'round-32',16:'round-16',8:'round-8',4:'round-4',2:'round-2',1:'round-1'};
  return map[size]||'round-default';
}

function ensureBracketViewState(state){
  if(!state.ui)state.ui={};
  if(!state.ui.bracketView)state.ui.bracketView={round:'all',status:'all',venue:'all',density:'comfortable',activeOnly:false};
  return state.ui.bracketView;
}
function bracketMatchVisible(match,view){
  if(view.status==='active'&&!['playing','court_wait1','court_manual_queue','venue_shared_queue','shared_queue','ready'].includes(match.status))return false;
  if(view.status!=='all'&&view.status!=='active'){
    if(view.status==='venue_shared_queue'){
      if(!['venue_shared_queue','shared_queue'].includes(match.status))return false;
    }else if(match.status!==view.status)return false;
  }
  if(view.venue!=='all'&&match.venueId!==view.venue)return false;
  if(view.activeOnly&&!['playing','court_wait1','court_manual_queue','venue_shared_queue','shared_queue','ready'].includes(match.status))return false;
  return true;
}
function syncBracketViewControls(state){
  const view=ensureBracketViewState(state);
  const sizes=Object.keys(state.draw.rounds||{}).map(Number).sort((a,b)=>b-a);
  const round=document.getElementById('bracketRoundFilter');
  if(round){
    round.innerHTML='<option value="all">전체 라운드</option>'+sizes.map(size=>`<option value="${size}">${roundLabel(size)}</option>`).join('');
    round.value=String(view.round);
  }
  const venue=document.getElementById('bracketVenueFilter');
  if(venue){
    venue.innerHTML='<option value="all">전체 구장</option>'+((state.settings.venues||[]).map(v=>`<option value="${v.id}">${v.name}</option>`).join(''));
    venue.value=view.venue;
  }
  const status=document.getElementById('bracketStatusFilter');if(status)status.value=view.status;
  const density=document.getElementById('bracketDensity');if(density)density.value=view.density;
  const active=document.getElementById('bracketActiveOnlyBtn');if(active)active.className=`btn ${view.activeOnly?'btn-primary':'btn-secondary'}`;
}


function bracketPlayerName(name=''){
  return String(name)
    .replace(/\([^)]*\)/g,'')
    .replace(/\[[^\]]*\]/g,'')
    .replace(/\s{2,}/g,' ')
    .trim();
}
function bracketTeamHtml(team){
  if(!team)return'TBD';
  if(team.placeholder)return`<span class="placeholder-team">${team.name}</span>`;
  const source=team.name||team.teamName||team.label||teamText(team);
  return bracketPlayerName(source)||teamText(team);
}

function renderBracket(state){
  const root=document.getElementById('bracketBoard');
  const sizes=Object.keys(state.draw.rounds||{}).map(Number).sort((a,b)=>b-a);
  syncBracketViewControls(state);
  const view=ensureBracketViewState(state);
  if(!sizes.length){root.className='bracket-board empty-state';root.innerHTML='<p>생성된 대진이 없습니다.</p>';return;}
  const densityClass=view.density==='compact'?' bracket-compact':'';
  const focusClass=view.activeOnly?' bracket-focus-mode':'';
  root.className=`bracket-board bracket-live-board${densityClass}${focusClass}`;
  let visibleCount=0,totalCount=0;
  const maxSize=Math.max(...sizes);
  const compact=view.density==='compact';
  const cardHeight=compact?72:118;
  const baseGap=compact?10:14;
  const basePitch=cardHeight+baseGap;
  root.innerHTML=sizes.map(size=>{
    const roundVisible=view.round==='all'||String(view.round)===String(size);
    const ratio=Math.max(1,maxSize/size);
    const roundOffset=Math.round((ratio-1)*basePitch/2);
    const roundGap=Math.round(ratio*basePitch-cardHeight);
    const cards=state.draw.rounds[size].map(m=>{
      totalCount++;
      const visible=roundVisible&&bracketMatchVisible(m,view);
      if(visible)visibleCount++;
      const courtLabel=bracketCourtLabel(m);
      return`<article class="match-card ${bracketStatusClass(m.status)} ${visible?'':'is-filtered-out'}">
        <header><span>${m.matchNo}경기</span><span class="match-status-label">${statusText(m.status)}</span></header>
        ${courtLabel?`<div class="bracket-court-label">${courtLabel}</div>`:''}
        <div class="match-team ${m.winner?.id===m.teamA?.id?'winner':''}">${bracketTeamHtml(m.teamA)}</div>
        <div class="match-team ${m.winner?.id===m.teamB?.id?'winner':''}">${bracketTeamHtml(m.teamB)}</div>
        <div class="match-meta">${m.scoreA!=null?`${m.scoreA}:${m.scoreB}`:`${m.bye?'부전승':'경기 예정'}${internalMatchIdHtml(m.id)}`}</div>
      </article>`;
    }).join('');
    const hasVisible=state.draw.rounds[size].some(m=>roundVisible&&bracketMatchVisible(m,view));
    return`<section class="round-column ${roundThemeClass(size)} ${size===maxSize?'first-round':''} ${roundVisible?'':'is-round-filtered-out'} ${hasVisible?'has-visible-match':''}" style="--round-offset:${roundOffset}px;--round-gap:${roundGap}px;--round-card-height:${cardHeight}px"><h3>${roundLabel(size)}</h3><div class="round-match-stack">${cards}</div></section>`;
  }).join('');
  const summary=document.getElementById('bracketViewSummary');
  if(summary){
    const parts=[`${visibleCount}/${totalCount}경기 표시`];
    if(view.round!=='all')parts.push(roundLabel(Number(view.round)));
    if(view.status!=='all')parts.push(document.getElementById('bracketStatusFilter')?.selectedOptions?.[0]?.textContent||view.status);
    if(view.venue!=='all')parts.push(document.getElementById('bracketVenueFilter')?.selectedOptions?.[0]?.textContent||view.venue);
    if(view.activeOnly)parts.push('활성 경기 집중');
    summary.textContent=parts.join(' · ');
  }
}
function statusText(s){return({waiting_slots:'대진 대기',ready:'배정 대기',playing:'시합중',court_wait1:'대기1',court_manual_queue:'관리자 대기',venue_shared_queue:'구장 공용대기',shared_queue:'공용대기',completed:'완료'})[s]||s;}
function renderLogs(state){
  const root=document.getElementById('logList');
  root.innerHTML=state.logs.length?state.logs.map(x=>`<article class="log-item"><time>${new Date(x.at).toLocaleString('ko-KR')}</time><p>${x.message}</p></article>`).join(''):'<div class="empty-state"><p>운영 로그가 없습니다.</p></div>';
}

function renderUnifiedCourtGrid(state,handlers,rootId,countId){
  const root=document.getElementById(rootId);
  const count=document.getElementById(countId);
  if(!root)return;
  const courts=state.prelim?.courts||[];
  if(count)count.textContent=`${courts.length}면`;
  if(!courts.length){
    root.className='prelim-court-operation-grid empty-state';
    root.innerHTML='<p>예선 코트배정을 실행하면 통합 코트 운영 카드가 표시됩니다.</p>';
    return;
  }
  const mainAllowed=hasAuthorizedMainDraw(state);
  const item=id=>{const x=id?findUnifiedMatch(state,id):null;return x?.type==='main'&&!mainAllowed?null:x;};
  const label=x=>x?.type==='main'
    ?`<span class="match-type-chip main">본선</span>${x.match.roundSize?`${x.match.roundSize}강`:''}`
    :x?`<span class="match-type-chip prelim">예선</span>${x.match.groupNo}조 · ${x.match.matchNo}경기`:'';
  const names=x=>x?`${operationalTeamText(x.match.teamA,state)} vs ${operationalTeamText(x.match.teamB,state)}`:'';
  root.className='prelim-court-operation-grid';
  const guide='<div class="prelim-court-manual-guide unified-court-guide" style="grid-column:1/-1">예선과 본선을 같은 코트에서 함께 운영합니다. 실제 팀이 확정되지 않은 본선 경기는 코트배정하지 않습니다.</div>';
  root.innerHTML=guide+courts.map(c=>{
    const queue=Array.isArray(c.queue)?c.queue:[];
    const playing=item(c.playing),wait1=item(c.wait1);
    return`<article class="prelim-court-card ${c.isPaused?'paused':''}">
      <header><strong>${c.isPaused?'⛔':'🚀'} ${c.name}</strong><span>${c.isPaused?'사용중지 · ':''}${c.venueName?`${c.venueName} · `:''}${playing?'시합중':'빈코트'}</span></header>
      <div class="prelim-court-slot playing"><small>시합중</small>${playing?`<span class="group-label">${label(playing)}</span>`:''}<b>${playing?names(playing):'진행 경기 없음'}</b>${playing?timeBadgeHtml(playing.match):''}${playing?`<div class="unified-card-actions"><button class="btn btn-secondary" ${playing.type==='prelim'?`data-prelim-result="${playing.match.id}"`:`data-main-result="${playing.match.id}"`}>결과 입력</button><button class="btn btn-light compact-move-btn" data-admin-only="true" title="코트 이동·순서 관리" aria-label="코트 이동·순서 관리" data-unified-transfer="${c.id}" data-unified-slot="playing">⇄</button></div>`:''}</div>
      <div class="prelim-court-slot wait1"><small>대기1</small>${wait1?`<span class="group-label">${label(wait1)}</span>`:''}<b>${wait1?names(wait1):'대기 경기 없음'}</b>${wait1?timeBadgeHtml(wait1.match):''}${wait1?`<div class="unified-card-actions"><button class="btn btn-light compact-move-btn" data-admin-only="true" title="코트 이동·순서 관리" aria-label="코트 이동·순서 관리" data-unified-transfer="${c.id}" data-unified-slot="wait1">⇄</button></div>`:''}</div>
      <div class="prelim-extra-queue"><strong>예선 추가 대기 ${queue.length}경기</strong>${queue.length?queue.map((id,i)=>{const x=item(id);const ahead=(playing?1:0)+(wait1?1:0)+i;const wait=x?.match?Math.max(0,Number(x.match.estimatedWaitMinutes||0)):0;return`<div class="prelim-extra-item"><span class="no">${i+2}</span>${x?`<span class="group-no">${label(x)}</span><span class="match-text">${names(x)}</span><span class="prelim-extra-time">앞에 ${ahead}경기${wait?` · 예상 약 ${wait}분`:''}</span><button class="btn btn-light compact-move-btn prelim-extra-move-btn" data-admin-only="true" title="코트 이동·순서 관리" aria-label="코트 이동·순서 관리" data-unified-transfer="${c.id}" data-unified-slot="queue:${i}">⇄</button>`:`<span>${publicMatchFallback(id)}</span>`}</div>`}).join(''):'<p>예선 추가 대기 없음</p>'}</div>
      ${c.isPaused&&c.pauseReason?`<div class="prelim-court-pause-reason">중지 사유: ${c.pauseReason}</div>`:''}
      <div class="prelim-court-status-actions"><button class="btn ${c.isPaused?'btn-primary':'btn-danger-outline'}" data-prelim-court-status="${c.id}">${c.isPaused?'코트 사용 재개':'코트 사용중지'}</button></div>
    </article>`;
  }).join('');
  root.querySelectorAll('[data-prelim-result]').forEach(b=>b.onclick=()=>handlers.openPrelimResult(b.dataset.prelimResult));
  root.querySelectorAll('[data-main-result]').forEach(b=>b.onclick=()=>handlers.openResult(b.dataset.mainResult));
  root.querySelectorAll('[data-unified-transfer]').forEach(b=>b.onclick=()=>handlers.openUnifiedCourtTransfer(b.dataset.unifiedTransfer,b.dataset.unifiedSlot));
  root.querySelectorAll('[data-prelim-court-status]').forEach(b=>b.onclick=()=>handlers.openPrelimCourtStatus(b.dataset.prelimCourtStatus));
}
function renderPrelimCourtOperation(state,handlers){
  renderUnifiedCourtGrid(state,handlers,'prelimCourtOperationGrid','prelimCourtOperationCount');
}


function renderPrelimLockStatus(state){
  const lock=state.prelim?.lock||{locked:false};
  const root=document.getElementById('prelimLockStatus');
  const lockBtn=document.getElementById('lockPrelimBtn');
  const unlockBtn=document.getElementById('unlockPrelimBtn');
  if(root){
    root.className=`prelim-lock-status ${lock.locked?'locked':'unlocked'}`;
    root.innerHTML=lock.locked
      ?`<strong>🔒 예선 최종확정·잠금</strong><span>${lock.lockedAt?new Date(lock.lockedAt).toLocaleString('ko-KR'):''} · 결과·조편성·후보교체 보호중</span>`
      :'<strong>🔓 예선 잠금 해제 상태</strong><span>결과 입력·조편성·후보교체가 가능합니다.</span>';
  }
  if(lockBtn)lockBtn.disabled=lock.locked;
  if(unlockBtn)unlockBtn.disabled=!lock.locked;
  const view=document.getElementById('view-prelim');
  if(view)view.classList.toggle('prelim-locked-overlay',lock.locked);
}



function renderOperationSharedQueue(state,handlers){
  const root=document.getElementById('operationSharedQueue');
  if(!hasAuthorizedMainDraw(state)){const count=document.getElementById('operationSharedQueueCount');if(count)count.textContent='0경기';if(root){root.className='shared-queue venue-queue-board empty-state';root.innerHTML='<p>본선 미추첨 · 본선 추첨 후 공용대기가 생성됩니다.</p>';}return;}
  const count=document.getElementById('operationSharedQueueCount');
  if(!root)return;
  const courts=state.prelim?.courts||[];
  const venueMap=new Map();
  courts.forEach(c=>{const id=c.venueId||'venue-default';if(!venueMap.has(id))venueMap.set(id,c.venueName||id);});
  (state.settings.venues||[]).forEach(v=>{if(!venueMap.has(v.id))venueMap.set(v.id,v.name);});
  const queues=state.venueQueues||{};
  const total=[...venueMap.keys()].reduce((n,id)=>n+(queues[id]?.length||0),0);
  if(count)count.textContent=`${total}경기`;
  if(!total){root.className='shared-queue venue-queue-board empty-state';root.innerHTML='<p>확정된 본선 공용대기 경기가 없습니다.</p>';return;}
  root.className='shared-queue venue-queue-board';
  root.innerHTML=[...venueMap.entries()].map(([venueId,venueName])=>{
    const queue=queues[venueId]||[];
    return`<section class="venue-queue-section operation-queue-section"><header><h3>📍 ${venueName} 본선 공용대기</h3><span>${queue.length}경기</span></header><div class="venue-queue-cards operation-queue-cards">${queue.length?queue.map((id,i)=>{const m=findMatch(state.draw,id);return`<article class="queue-card operation-queue-card"><span class="num">${i+1}</span><b>${m?`${operationalTeamHtml(m.teamA,state)} vs ${operationalTeamHtml(m.teamB,state)}`:publicMatchFallback(id)}</b><em>${m?`${roundLabel(m.roundSize)}${internalMatchIdHtml(id)}`:'경기 없음'}</em>${m?`<span class="time-badge">대기 ${Math.max(0,Math.floor((Date.now()-new Date(m.waitStartedAt||Date.now()).getTime())/60000))}분 경과 · 코트 배정 대기</span>`:''}<div class="queue-card-actions"><button class="btn btn-light" data-op-queue-up="${id}" data-venue-id="${venueId}" ${i===0?'disabled':''}>▲</button><button class="btn btn-light" data-op-queue-down="${id}" data-venue-id="${venueId}" ${i===queue.length-1?'disabled':''}>▼</button><button class="btn btn-primary" data-manual-assign="${id}" data-venue-id="${venueId}">${availableCourtSlots(state,venueId).length?'수동 코트배정':'배정 자리 없음'}</button><button class="btn btn-purple" data-admin-queue="${id}" data-venue-id="${venueId}">코트 대기 지정</button><button class="btn btn-secondary" data-op-queue-move="${id}" data-venue-id="${venueId}">구장 이동</button><button class="btn btn-danger-outline" data-hold-main="${id}">보류</button></div></article>`}).join(''):'<div class="empty-state"><p>대기 경기 없음</p></div>'}</div></section>`;
  }).join('');
  root.querySelectorAll('[data-op-queue-up]').forEach(b=>b.onclick=()=>handlers.reorderQueue(b.dataset.venueId,b.dataset.opQueueUp,'up'));
  root.querySelectorAll('[data-op-queue-down]').forEach(b=>b.onclick=()=>handlers.reorderQueue(b.dataset.venueId,b.dataset.opQueueDown,'down'));
  root.querySelectorAll('[data-op-queue-move]').forEach(b=>b.onclick=()=>handlers.openQueueMove(b.dataset.venueId,b.dataset.opQueueMove));
  root.querySelectorAll('[data-admin-queue]').forEach(b=>b.onclick=()=>handlers.openManualQueueAssign(b.dataset.venueId,b.dataset.adminQueue));
  root.querySelectorAll('[data-hold-main]').forEach(b=>b.onclick=()=>handlers.holdMainMatch(b.dataset.holdMain));
}

function renderOperationUnified(state,handlers){
  if(!hasAuthorizedMainDraw(state)){
    const q=document.getElementById('operationUnifiedQueueBoard');if(q){q.className='shared-queue venue-queue-board empty-state';q.innerHTML='<p>본선 미추첨 · 본선 추첨 후 공용대기가 생성됩니다.</p>';}
  }
  renderUnifiedCourtGrid(state,handlers,'operationUnifiedCourtGrid','operationUnifiedCourtCount');
  renderOperationSharedQueue(state,handlers);
  const opGroup=document.getElementById('operationPrelimGroupGrid');
  const srcGroup=document.getElementById('prelimGroupGrid');
  if(opGroup&&srcGroup){
    opGroup.className=srcGroup.className;
    opGroup.innerHTML=srcGroup.innerHTML;
    opGroup.querySelectorAll('[data-prelim-result]').forEach(b=>b.onclick=()=>handlers.openPrelimResult(b.dataset.prelimResult));
  }
  const list=document.getElementById('operationMainReadyList');
  const summary=document.getElementById('operationMainReadySummary');
  if(!hasAuthorizedMainDraw(state)){if(summary)summary.textContent='본선 미추첨';if(list){list.className='main-operation-rounds empty-state';list.innerHTML='<p>본선 추첨 후 경기 카드가 표시됩니다.</p>';}return;}
  if(list){
    const roundEntries=Object.entries(state.draw?.rounds||{}).map(([size,matches])=>[Number(size),matches||[]]).sort((a,b)=>b[0]-a[0]);
    const all=roundEntries.flatMap(([size,matches])=>matches.map(m=>({m,size}))).filter(({m})=>m.teamA&&!m.teamA.placeholder&&m.teamB&&!m.teamB.placeholder);
    const completed=all.filter(({m})=>m.status==='completed').length;
    const playing=all.filter(({m})=>m.status==='playing').length;
    if(summary)summary.textContent=`전체 ${all.length} · 진행 ${playing} · 완료 ${completed}`;
    list.className=all.length?'main-operation-rounds':'main-operation-rounds empty-state';
    list.innerHTML=all.length?roundEntries.map(([size,matches])=>{
      const resolved=matches.filter(m=>m.teamA&&!m.teamA.placeholder&&m.teamB&&!m.teamB.placeholder);
      if(!resolved.length)return '';
      return `<section class="main-round-section"><header><h3>${roundLabel(size)}</h3><span>${resolved.filter(m=>m.status==='completed').length}/${resolved.length} 완료</span></header><div class="main-match-card-grid">${resolved.map(m=>{const status=m.status==='completed'?'완료':m.status==='playing'?'시합중':m.status==='court_wait1'?'대기1':m.status==='venue_shared_queue'||m.status==='shared_queue'?'공용대기':m.status==='queued'?'추가대기':'배정 대기';const score=m.status==='completed'?`<strong class="main-match-score">${Number(m.scoreA??0)} : ${Number(m.scoreB??0)}</strong>`:'';return `<article class="main-match-status-card ${m.status||'waiting'}"><div><b>${operationalTeamText(m.teamA,state)}</b><span>vs</span><b>${operationalTeamText(m.teamB,state)}</b></div><footer><em>${status}${internalMatchIdHtml(m.id)}</em>${score}<button type="button" class="btn btn-primary" data-main-result="${m.id}">${m.status==='completed'?'결과 수정':'결과 입력'}</button></footer></article>`}).join('')}</div></section>`;
    }).join(''):'<p>확정된 본선 경기가 없습니다.</p>';
    list.querySelectorAll('[data-main-result]').forEach(b=>b.onclick=()=>handlers.openResult(b.dataset.mainResult));
  }
}

function renderPrelim(state,handlers){
  const prelim=state.prelim||{groups:[],matches:[],qualifiers:[]};
  setText('prelimSummaryActiveTeams',`${prelim.activeTeams?.length||0}팀`);
  setText('prelimSummaryReserveTeams',`${prelim.reserveTeams?.length||0}팀`);
  setText('prelimSummaryGroups',`${prelim.groups.length}조`);
  setText('prelimSummaryMatches',prelim.matches.length);
  setText('prelimSummaryCompleted',prelim.matches.filter(m=>m.status==='completed').length);
  setText('prelimSummaryFirst',prelim.qualifiers.filter(t=>t.groupRank===1).length);
  setText('prelimSummarySecond',prelim.qualifiers.filter(t=>t.groupRank===2).length);
  setText('prelimSummaryQualifiers',`${prelim.qualifiers.length}팀`);
  const linked=prelim.linkedDraw||{active:false,slots:[]};
  setText('prelimSummaryLinkedSlots',linked.active?linked.slots.length:0);
  renderLinkedDrawStatus(state);renderPrelimCourtOperation(state,handlers);
  renderTeamPools(state,handlers);
  const root=document.getElementById('prelimGroupGrid');
  if(!root)return;
  if(!prelim.groups.length){
    root.className='prelim-group-grid empty-state';
    root.innerHTML='<p>예선 조편성을 생성하면 조별 카드가 표시됩니다.</p>';
    return;
  }
  root.className='prelim-group-grid';
  root.innerHTML=prelim.groups.map(group=>{
    const matches=prelim.matches.filter(m=>m.groupId===group.id);
    return `<article class="prelim-group-card">
      <header><strong>${group.groupNo}조${group.venueName?`<span class="prelim-group-chip">${group.venueName}</span>`:''}</strong><span>${group.court||'코트 미배정'}</span></header>
      <table class="prelim-team-table"><thead><tr><th>순위</th><th>팀</th><th>승</th><th>패</th><th>득실</th></tr></thead><tbody>
      ${group.standings.map(s=>`<tr class="${s.qualified?'qualifier':''}"><td>${s.rank}</td><td>${operationalTeamText(s.team,state)}</td><td>${s.wins}</td><td>${s.losses}</td><td>${s.diff>0?'+':''}${s.diff}</td></tr>`).join('')}
      </tbody></table>
      <div class="prelim-match-list">
      ${matches.map(m=>{const statusLabel=({playing:'시합중',court_wait1:'대기1',queued:'추가대기',waiting_dependency:'첫 경기 결과 대기',waiting_previous:'이전 경기 완료 대기',completed:'완료'})[m.status]||'대기';const canInput=m.status==='playing'||m.status==='completed';return`<div class="prelim-match"><div class="prelim-match-top"><span>${m.matchNo}경기</span><span>${m.court||'-'} · ${statusLabel}</span></div>
      <b>${operationalTeamText(m.teamA,state)} vs ${operationalTeamText(m.teamB,state)}</b>
      <span class="prelim-match-dependency">${m.sequenceLabel||''}</span>
      <em>${m.status==='completed'?`${m.scoreA}:${m.scoreB} · 승리 ${operationalTeamText(m.winner,state)}`:(m.status==='waiting_dependency'||m.status==='waiting_previous'?'상대팀 확정 대기':'결과 미입력')}</em>
      ${canInput?`<button class="btn btn-secondary" data-prelim-result="${m.id}">${m.status==='completed'?'결과 수정':'결과 입력'}</button>`:''}</div>`}).join('')}
      </div></article>`;
  }).join('');
  root.querySelectorAll('[data-prelim-result]').forEach(b=>b.addEventListener('click',()=>handlers.openPrelimResult(b.dataset.prelimResult)));
}

function teamHtml(team){
  if(!team)return'TBD';
  if(team.placeholder)return`<span class="placeholder-team">${team.name}</span> <span class="placeholder-chip">예선 대기</span>`;
  return teamText(team);
}
function renderLinkedDrawStatus(state){
  const root=document.getElementById('linkedDrawStatus');
  const badge=document.getElementById('linkedDrawBadge');
  if(!root||!badge)return;
  const linked=state.prelim?.linkedDraw;
  if(!linked?.active){
    badge.textContent='연결 대진 없음';
    badge.className='badge badge-muted-dark';
    root.className='linked-status-grid empty-state';
    root.innerHTML='<p>예선 슬롯으로 본선 선추첨을 실행하면 연결 상태가 표시됩니다.</p>';
    return;
  }
  const firstRound=state.draw.rounds?.[state.draw.size]||[];
  const entries=[];
  firstRound.forEach(match=>{
    ['teamA','teamB'].forEach(slot=>{
      const team=match[slot];
      const ref=linked.slots.find(x=>x.placeholderKey===team?.placeholderKey || x.resolvedTeamId===team?.id);
      if(!ref)return;
      entries.push({...ref,matchId:match.id,slot,currentTeam:team});
    });
  });
  const resolved=entries.filter(x=>!x.currentTeam?.placeholder).length;
  const locked=entries.filter(x=>x.locked).length;
  badge.textContent=`${resolved}/${entries.length}팀 반영`;
  badge.className='badge badge-safe';
  root.className='linked-status-grid';
  root.innerHTML=entries.map(x=>`<article class="linked-status-card ${x.locked?'locked':(!x.currentTeam?.placeholder?'done':'')}">
    <strong>${x.label}</strong>
    <span>${x.locked?'진행 경기라 자동 변경 차단':(x.currentTeam?.placeholder?'예선 결과 대기':`반영: ${teamText(x.currentTeam)}`)}</span>
  </article>`).join('');
}

function renderTeamPools(state,handlers){
  const active=state.prelim?.activeTeams||[];
  const reserve=state.prelim?.reserveTeams||[];
  setText('activePoolCount',`${active.length}팀`);
  setText('reservePoolCount',`${reserve.length}팀`);
  const activeRoot=document.getElementById('activeTeamPool');
  const reserveRoot=document.getElementById('reserveTeamPool');
  if(!activeRoot||!reserveRoot)return;

  activeRoot.className=active.length?'team-pool':'team-pool empty-state';
  activeRoot.innerHTML=active.length?active.map(t=>`<article class="team-chip ${state.prelim?.swapSelection?.activeTeamId===t.id?'swap-selected':''}"><div><b>${teamText(t)}</b><small>예선 참가</small></div>${reserve.length?`<button data-active-swap="${t.id}">교체</button>`:''}</article>`).join(''):'<p>예선 조편성을 생성하면 표시됩니다.</p>';

  reserveRoot.className=reserve.length?'team-pool':'team-pool empty-state';
  reserveRoot.innerHTML=reserve.length?reserve.map(t=>`<article class="team-chip"><div><b>${teamText(t)}</b><small>후보</small></div><button data-reserve-pick="${t.id}">선택</button></article>`).join(''):'<p>후보팀이 없습니다.</p>';

  activeRoot.querySelectorAll('[data-active-swap]').forEach(btn=>btn.addEventListener('click',()=>handlers.selectActiveSwap(btn.dataset.activeSwap)));
  reserveRoot.querySelectorAll('[data-reserve-pick]').forEach(btn=>btn.addEventListener('click',()=>handlers.selectReserveSwap(btn.dataset.reservePick)));
}


function sharedQueueTimeBadgeHtml(match){
  const elapsed=Number(match?.waitElapsedMinutes||0);
  return `<div class="time-wrap"><span class="time-badge">대기 ${elapsed}분 경과 · 코트 배정 대기</span></div>`;
}

function timeBadgeHtml(match){
  const info=timeInfo(match);
  const total=(match.elapsedMinutes||0)+(match.estimatedRemainingMinutes||0);
  const pct=match.status==='playing'&&total?Math.min(100,Math.max(0,(match.elapsedMinutes/total)*100)):0;
  return `<div class="time-wrap"><span class="time-badge ${info.className}">${info.label}</span>${match.status==='playing'?`<div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>`:''}</div>`;
}

function drawMethodLabel(method){return({instant:'즉시',roulette:'룰렛',seeded:'시드분산'})[method]||'-';}
function renderDrawHistory(state){
  const root=document.getElementById('drawHistoryList');if(!root)return;
  const list=state.drawMeta?.history||[];
  if(!list.length){root.className='draw-history-list empty-state';root.innerHTML='<p>추첨 기록이 없습니다.</p>';return;}
  root.className='draw-history-list';
  root.innerHTML=list.map(x=>`<article class="draw-history-item"><time>${new Date(x.at).toLocaleString('ko-KR')}</time><div><b>${drawMethodLabel(x.method)} 추첨 · ${x.drawSize}강 · ${x.teamCount}팀</b><small>부전승 ${x.byePriority==='group-first'?'조 1위 우선':'전체 랜덤'} · 체크섬 ${x.checksum}</small></div><span class="draw-lock-badge">${x.checksum}</span></article>`).join('');
}

function updateDrawLockInfo(state){
  const el=document.getElementById('drawLockInfo');if(!el)return;
  if(state.drawMeta?.locked){
    el.className='draw-lock-info locked';
    el.innerHTML=`<strong>🔒 본선 대진 잠금 완료</strong><span>재추첨은 차단되었습니다. 코트배정·결과 입력·다음 라운드 진행은 계속할 수 있습니다.</span>`;
  }else{
    el.className='draw-lock-info unlocked';
    el.innerHTML=`<strong>본선 대진 잠금 해제 상태</strong><span>추첨과 재추첨이 가능합니다. 대진 검토가 끝난 뒤 잠그세요.</span>`;
  }
}

function renderMessageCenter(state,handlers){const q=state.messaging?.queue||[];setText('messageTotalCount',`${q.length}건`);setText('messagePendingCount',`${q.filter(x=>x.status==='pending').length}건`);setText('messageSentCount',`${q.filter(x=>x.status==='sent').length}건`);setText('messageNoPhoneCount',`${q.filter(x=>x.status==='no-phone').length}건`);const root=document.getElementById('messageQueueList');if(!root)return;const filter=document.getElementById('messageStatusFilter')?.value||'pending';const list=q.filter(x=>filter==='all'||x.status===filter);if(!list.length){root.className='message-queue-list empty-state';root.innerHTML='<p>조건에 맞는 문자가 없습니다.</p>';return}root.className='message-queue-list';root.innerHTML=list.map(x=>`<article class="message-card ${x.status}"><div class="message-card-head"><div><h3>${x.teamName}</h3><small>${({playing:'시합중 호출',wait1:'대기1 안내',shared:'공용대기 안내'})[x.type]||x.type} · ${new Date(x.createdAt).toLocaleString('ko-KR')}</small></div><div class="message-phone">${x.phone||'전화번호 없음'}</div></div><div class="message-body">${escapeHtml(x.body)}</div><div class="message-actions"><button class="btn btn-light" data-message-copy="${x.id}">내용 복사</button>${x.phone&&x.status!=='sent'?`<button class="btn btn-primary" data-message-send="${x.id}">문자 앱 열기</button>`:''}${x.status!=='sent'?`<button class="btn btn-secondary" data-message-sent="${x.id}">발송완료 표시</button>`:''}${x.history?.length?`<button class="btn btn-light" data-message-history="${x.id}">변경 이력</button>`:''}<button class="btn btn-danger-outline" data-message-delete="${x.id}">삭제</button></div></article>`).join('');root.querySelectorAll('[data-message-copy]').forEach(b=>b.onclick=()=>handlers.copyMessage(b.dataset.messageCopy));root.querySelectorAll('[data-message-send]').forEach(b=>b.onclick=()=>handlers.openSmsMessage(b.dataset.messageSend));root.querySelectorAll('[data-message-sent]').forEach(b=>b.onclick=()=>handlers.setMessageSent(b.dataset.messageSent));root.querySelectorAll('[data-message-delete]').forEach(b=>b.onclick=()=>handlers.removeMessage(b.dataset.messageDelete))}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function renderContactRoster(state,handlers){
  const stats=contactStats(state);
  setText('rosterTotalTeams',`${stats.total}팀`);setText('rosterPhoneCount',`${stats.withPhone}팀`);
  setText('rosterNoPhoneCount',`${stats.withoutPhone}팀`);
  setText('rosterConvertibleMessages',`${state.messaging?.queue?.filter(x=>x.status==='no-phone').length||0}건`);
  const root=document.getElementById('contactRosterList');if(!root)return;
  const query=(document.getElementById('rosterSearch')?.value||'').trim().toLowerCase();
  const filter=document.getElementById('rosterPhoneFilter')?.value||'no-phone';
  const teams=state.teams.filter(team=>{
    const c=getTeamContact(state,team),has=Boolean(c.phone);
    if(filter==='has-phone'&&!has)return false;if(filter==='no-phone'&&has)return false;
    return !query||`${team.name} ${team.affiliation||''} ${c.phone} ${c.manager}`.toLowerCase().includes(query);
  });
  setText('rosterVisibleCount',`${teams.length}팀 표시`);
  if(!teams.length){root.className='contact-roster-list empty-state';root.innerHTML='<p>조건에 맞는 팀이 없습니다.</p>';return;}
  root.className='contact-roster-list';
  root.innerHTML=teams.map(team=>{
    const c=getTeamContact(state,team);
    return`<article class="contact-card ${c.phone?'has-phone':''}"><h3>${escapeHtml(team.name)}</h3><small>${escapeHtml(team.affiliation||'소속 없음')}</small>
    <div class="contact-card-phone ${c.phone?'':'missing'}">${c.phone||'전화번호 없음'}</div>${c.manager?`<small>대표자 ${escapeHtml(c.manager)}</small>`:''}
    <div class="contact-card-actions"><button class="btn btn-primary" data-contact-edit="${team.id}">연락처 수정</button></div></article>`;
  }).join('');
  root.querySelectorAll('[data-contact-edit]').forEach(b=>b.onclick=()=>handlers.openContactEdit(b.dataset.contactEdit));
}

function auditLabel(value){return({pass:'통과',warn:'주의',fail:'오류','not-run':'미실행'})[value]||'미실행';}
function renderAudit(state){
  const audit=state.audit||{overall:'not-run',results:[],simulation:null};
  setText('auditPassCount',audit.results.filter(x=>x.level==='pass').length);
  setText('auditWarnCount',audit.results.filter(x=>x.level==='warn').length);
  setText('auditFailCount',audit.results.filter(x=>x.level==='fail').length);
  setText('auditPrelimSimCompleted',audit.prelimSimulation?.completedMatches||0);
  setText('auditPrelimRanked',audit.prelimSimulation?.rankedGroups||0);
  setText('auditSimCompleted',audit.simulation?.completedMatches||0);
  setText('auditSimWinner',audit.simulation?.winner?.name||'-');
  setText('auditLastRunText',audit.lastRunAt?`마지막 실행 ${new Date(audit.lastRunAt).toLocaleString('ko-KR')}`:'아직 실행하지 않았습니다.');
  const badge=document.getElementById('auditOverallBadge');
  if(badge){
    badge.textContent=auditLabel(audit.overall);
    badge.className=`badge ${audit.overall==='pass'?'badge-safe':audit.overall==='fail'?'badge-danger':'badge-muted-dark'}`;
  }
  const root=document.getElementById('auditResultList');if(!root)return;
  if(!audit.results.length){root.className='audit-result-list empty-state';root.innerHTML='<p>점검을 실행하면 결과가 표시됩니다.</p>';return;}
  root.className='audit-result-list';
  root.innerHTML=audit.results.map(x=>`<article class="audit-item ${x.level}">
    <strong>${x.level==='pass'?'통과':x.level==='warn'?'주의':'오류'}</strong>
    <div><b>${x.title}</b><p>${x.detail}</p></div>
    <span class="audit-code">${x.code}</span>
  </article>`).join('');
}
