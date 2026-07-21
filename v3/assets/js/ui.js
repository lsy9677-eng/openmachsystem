
import{allMatches,roundLabel,findMatch}from'./bracket-engine.js';
import{timeInfo}from'./time-engine.js';
import{contactStats,getTeamContact}from'./contact-engine.js';
import{venueStats,totalVenueQueueCount}from'./venue-engine.js';
export function teamText(team){
  if(!team)return'TBD';
  if(team.placeholder)return`${team.name}`;
  return `${team.name}${team.affiliation?`(${team.affiliation})`:''}`;
}
export function render(state,handlers){
  const matches=allMatches(state.draw);
  const completed=matches.filter(m=>m.status==='completed').length;
  const playing=matches.filter(m=>m.status==='playing').length;
  setText('heroDrawSize',state.draw.size?`${state.draw.size}강`:'-');setText('heroMatchCount',matches.length);setText('heroCompleted',completed);setText('heroPlaying',playing);
  setText('summaryTeams',`${state.teams.length}팀`);setText('summaryRound',currentRound(state));setText('summaryPlaying',playing);
  setText('summaryWait1',state.courts.filter(c=>c.wait1).length);setText('summaryShared',state.sharedQueue.length);
  setText('summaryAverageMinutes',`${state.timeMetrics?.averageMinutes||0}분`);setText('summaryLongestWait',`${state.timeMetrics?.longestWaitMinutes||0}분`);
  setText('summaryDrawMethod',drawMethodLabel(state.drawMeta?.method));setText('summaryDrawLock',state.drawMeta?.locked?'잠금':'해제');setText('summaryPendingMessages',`${state.messaging?.queue?.filter(x=>x.status==='pending'||x.status==='no-phone').length||0}건`);setText('summaryPhoneTeams',`${contactStats(state).withPhone}팀`);setText('summaryAuditStatus',auditLabel(state.audit?.overall));setText('summaryVenueCount',`${venueStats(state).venueCount}곳`);setText('summaryVenueQueueCount',`${totalVenueQueueCount(state)}경기`);renderContactRoster(state,handlers);updateDrawLockInfo(state);renderMessageCenter(state,handlers);
  setText('baseMatchMinutes',`${state.settings.matchMinutes||30}분`);setText('autoTimeStatus',state.settings.autoTimeEnabled?'ON':'OFF');
  setText('lastTimeCalculated',state.timeMetrics?.lastCalculatedAt?new Date(state.timeMetrics.lastCalculatedAt).toLocaleTimeString('ko-KR'):'-');
  setText('sharedQueueCount',`${state.sharedQueue.length}경기`);
  renderCourts(state,handlers);renderQueue(state);renderPrelim(state,handlers);renderBracket(state);renderDrawHistory(state);renderAudit(state);renderLogs(state);
}
function setText(id,value){const el=document.getElementById(id);if(el)el.textContent=value;}
function currentRound(state){
  const sizes=Object.keys(state.draw.rounds||{}).map(Number).sort((a,b)=>b-a);
  for(const size of sizes){const ms=state.draw.rounds[size];if(ms.some(m=>m.status!=='completed'))return roundLabel(size);}
  return sizes.length?'대회 완료':'-';
}
function renderCourts(state,handlers){
  const root=document.getElementById('courtGrid');
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
      return `<article class="court-card"><header><strong>🚀 ${c.name}</strong><span>${p?'시합중':'빈코트'}</span></header>
        <div class="court-slot"><small>시합중</small><b>${p?`${teamHtml(p.teamA)} vs ${teamHtml(p.teamB)}`:'진행 경기 없음'}</b><em>${p?`${roundLabel(p.roundSize)} · ${p.id}`:'-'}</em>${p?timeBadgeHtml(p):''}
        <button class="btn" data-result="${p?.id||''}" ${p?'':'disabled'}>결과 입력</button></div>
        <div class="court-slot wait"><small>대기 1번</small><b>${w?`${teamHtml(w.teamA)} vs ${teamHtml(w.teamB)}`:'대기 경기 없음'}</b><em>${w?`${roundLabel(w.roundSize)} · ${w.id}`:'-'}</em>${w?timeBadgeHtml(w):''}</div></article>`;
    }).join('')}</div>
  </section>`).join('');
  root.querySelectorAll('[data-result]').forEach(b=>b.addEventListener('click',()=>handlers.openResult(b.dataset.result)));
}
function renderQueue(state){
  const root=document.getElementById('sharedQueue');
  const venues=state.settings.venues||[];
  const queues=state.venueQueues||{};
  const total=Object.values(queues).reduce((sum,q)=>sum+q.length,0)+(state.sharedQueue?.length||0);
  setText('sharedQueueCount',`${total}경기`);
  if(!total){root.className='shared-queue venue-queue-board empty-state';root.innerHTML='<p>구장별 공용대기 경기가 없습니다.</p>';return;}
  root.className='shared-queue venue-queue-board';
  root.innerHTML=venues.map(v=>{
    const queue=queues[v.id]||[];
    return`<section class="venue-queue-section"><header><h3>📍 ${v.name} 공용대기</h3><span>${queue.length}경기</span></header>
      <div class="venue-queue-cards">${queue.length?queue.map((id,i)=>{const m=findMatch(state.draw,id);return`<article class="queue-card"><span class="num">${i+1}</span><b>${m?`${teamHtml(m.teamA)} vs ${teamHtml(m.teamB)}`:id}</b><em>${m?`${roundLabel(m.roundSize)} · ${id}`:'경기 없음'}</em>${m?timeBadgeHtml(m):''}</article>`}).join(''):'<div class="empty-state"><p>대기 경기 없음</p></div>'}</div>
    </section>`;
  }).join('');
}
function renderBracket(state){
  const root=document.getElementById('bracketBoard');
  const sizes=Object.keys(state.draw.rounds||{}).map(Number).sort((a,b)=>b-a);
  if(!sizes.length){root.className='bracket-board empty-state';root.innerHTML='<p>생성된 대진이 없습니다.</p>';return;}
  root.className='bracket-board';
  root.innerHTML=sizes.map(size=>`<section class="round-column"><h3>${roundLabel(size)}</h3>${state.draw.rounds[size].map(m=>`<article class="match-card ${m.status==='completed'?'completed':''}"><header><span>${m.matchNo}경기</span><span>${statusText(m.status)}</span></header><div class="match-team ${m.winner?.id===m.teamA?.id?'winner':''}">${teamHtml(m.teamA)}</div><div class="match-team ${m.winner?.id===m.teamB?.id?'winner':''}">${teamHtml(m.teamB)}</div><div class="match-meta">${m.scoreA!=null?`${m.scoreA}:${m.scoreB}`:`${m.id}${m.bye?' · 부전승':''}`}</div></article>`).join('')}</section>`).join('');
}
function statusText(s){return({waiting_slots:'대진 대기',ready:'배정 대기',playing:'시합중',court_wait1:'대기1',shared_queue:'공용대기',completed:'완료'})[s]||s;}
function renderLogs(state){
  const root=document.getElementById('logList');
  root.innerHTML=state.logs.length?state.logs.map(x=>`<article class="log-item"><time>${new Date(x.at).toLocaleString('ko-KR')}</time><p>${x.message}</p></article>`).join(''):'<div class="empty-state"><p>운영 로그가 없습니다.</p></div>';
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
  renderLinkedDrawStatus(state);
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
      <header><strong>${group.groupNo}조</strong><span>${group.court||'코트 미배정'}</span></header>
      <table class="prelim-team-table"><thead><tr><th>순위</th><th>팀</th><th>승</th><th>패</th><th>득실</th></tr></thead><tbody>
      ${group.standings.map(s=>`<tr class="${s.qualified?'qualifier':''}"><td>${s.rank}</td><td>${teamText(s.team)}</td><td>${s.wins}</td><td>${s.losses}</td><td>${s.diff>0?'+':''}${s.diff}</td></tr>`).join('')}
      </tbody></table>
      <div class="prelim-match-list">
      ${matches.map(m=>`<div class="prelim-match"><div class="prelim-match-top"><span>${m.matchNo}경기</span><span>${m.court||'-'} · ${m.status==='completed'?'완료':'대기'}</span></div>
      <b>${teamText(m.teamA)} vs ${teamText(m.teamB)}</b>
      <em>${m.status==='completed'?`${m.scoreA}:${m.scoreB} · 승리 ${teamText(m.winner)}`:'결과 미입력'}</em>
      <button class="btn btn-secondary" data-prelim-result="${m.id}">${m.status==='completed'?'결과 수정':'결과 입력'}</button></div>`).join('')}
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
  activeRoot.innerHTML=active.length?active.map(t=>`<article class="team-chip"><div><b>${teamText(t)}</b><small>예선 참가</small></div>${reserve.length?`<button data-active-swap="${t.id}">교체</button>`:''}</article>`).join(''):'<p>예선 조편성을 생성하면 표시됩니다.</p>';

  reserveRoot.className=reserve.length?'team-pool':'team-pool empty-state';
  reserveRoot.innerHTML=reserve.length?reserve.map(t=>`<article class="team-chip"><div><b>${teamText(t)}</b><small>후보</small></div><button data-reserve-pick="${t.id}">선택</button></article>`).join(''):'<p>후보팀이 없습니다.</p>';

  activeRoot.querySelectorAll('[data-active-swap]').forEach(btn=>btn.addEventListener('click',()=>handlers.selectActiveSwap(btn.dataset.activeSwap)));
  reserveRoot.querySelectorAll('[data-reserve-pick]').forEach(btn=>btn.addEventListener('click',()=>handlers.selectReserveSwap(btn.dataset.reservePick)));
}

function timeBadgeHtml(match){
  const info=timeInfo(match);
  const total=(match.elapsedMinutes||0)+(match.estimatedRemainingMinutes||0);
  const pct=match.status==='playing'&&total?Math.min(100,Math.max(0,(match.elapsedMinutes/total)*100)):0;
  return `<div><span class="time-badge ${info.className}">${info.label}</span>${match.status==='playing'?`<div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>`:''}</div>`;
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
