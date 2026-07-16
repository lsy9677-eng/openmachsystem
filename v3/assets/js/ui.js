
import{allMatches,roundLabel,findMatch}from'./bracket-engine.js';
export function teamText(team){return team?`${team.name}${team.affiliation?`(${team.affiliation})`:''}`:'TBD';}
export function render(state,handlers){
  const matches=allMatches(state.draw);
  const completed=matches.filter(m=>m.status==='completed').length;
  const playing=matches.filter(m=>m.status==='playing').length;
  setText('heroDrawSize',state.draw.size?`${state.draw.size}강`:'-');setText('heroMatchCount',matches.length);setText('heroCompleted',completed);setText('heroPlaying',playing);
  setText('summaryTeams',`${state.teams.length}팀`);setText('summaryRound',currentRound(state));setText('summaryPlaying',playing);
  setText('summaryWait1',state.courts.filter(c=>c.wait1).length);setText('summaryShared',state.sharedQueue.length);
  setText('sharedQueueCount',`${state.sharedQueue.length}경기`);
  renderCourts(state,handlers);renderQueue(state);renderBracket(state);renderLogs(state);
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
  root.className='court-grid';
  root.innerHTML=state.courts.map(c=>{
    const p=c.playing?findMatch(state.draw,c.playing):null,w=c.wait1?findMatch(state.draw,c.wait1):null;
    return `<article class="court-card"><header><strong>🚀 ${c.name}</strong><span>${p?'시합중':'빈코트'}</span></header>
      <div class="court-slot"><small>시합중</small><b>${p?`${teamText(p.teamA)} vs ${teamText(p.teamB)}`:'진행 경기 없음'}</b><em>${p?`${roundLabel(p.roundSize)} · ${p.id}`:'-'}</em>
      <button class="btn" data-result="${p?.id||''}" ${p?'':'disabled'}>결과 입력</button></div>
      <div class="court-slot wait"><small>대기 1번</small><b>${w?`${teamText(w.teamA)} vs ${teamText(w.teamB)}`:'대기 경기 없음'}</b><em>${w?`${roundLabel(w.roundSize)} · ${w.id}`:'-'}</em></div></article>`;
  }).join('');
  root.querySelectorAll('[data-result]').forEach(b=>b.addEventListener('click',()=>handlers.openResult(b.dataset.result)));
}
function renderQueue(state){
  const root=document.getElementById('sharedQueue');
  if(!state.sharedQueue.length){root.className='shared-queue empty-state';root.innerHTML='<p>공용대기 경기가 없습니다.</p>';return;}
  root.className='shared-queue';
  root.innerHTML=state.sharedQueue.map((id,i)=>{const m=findMatch(state.draw,id);return`<article class="queue-card"><span class="num">${i+1}</span><b>${m?`${teamText(m.teamA)} vs ${teamText(m.teamB)}`:id}</b><em>${m?`${roundLabel(m.roundSize)} · ${id}`:'경기 없음'}</em></article>`}).join('');
}
function renderBracket(state){
  const root=document.getElementById('bracketBoard');
  const sizes=Object.keys(state.draw.rounds||{}).map(Number).sort((a,b)=>b-a);
  if(!sizes.length){root.className='bracket-board empty-state';root.innerHTML='<p>생성된 대진이 없습니다.</p>';return;}
  root.className='bracket-board';
  root.innerHTML=sizes.map(size=>`<section class="round-column"><h3>${roundLabel(size)}</h3>${state.draw.rounds[size].map(m=>`<article class="match-card ${m.status==='completed'?'completed':''}"><header><span>${m.matchNo}경기</span><span>${statusText(m.status)}</span></header><div class="match-team ${m.winner?.id===m.teamA?.id?'winner':''}">${teamText(m.teamA)}</div><div class="match-team ${m.winner?.id===m.teamB?.id?'winner':''}">${teamText(m.teamB)}</div><div class="match-meta">${m.scoreA!=null?`${m.scoreA}:${m.scoreB}`:`${m.id}${m.bye?' · 부전승':''}`}</div></article>`).join('')}</section>`).join('');
}
function statusText(s){return({waiting_slots:'대진 대기',ready:'배정 대기',playing:'시합중',court_wait1:'대기1',shared_queue:'공용대기',completed:'완료'})[s]||s;}
function renderLogs(state){
  const root=document.getElementById('logList');
  root.innerHTML=state.logs.length?state.logs.map(x=>`<article class="log-item"><time>${new Date(x.at).toLocaleString('ko-KR')}</time><p>${x.message}</p></article>`).join(''):'<div class="empty-state"><p>운영 로그가 없습니다.</p></div>';
}
