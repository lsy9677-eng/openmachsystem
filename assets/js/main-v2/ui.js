import {STATUS,ROUND_NAMES} from './constants.js';
import {allMatches,currentRoundSize,getMatch} from './bracket.js';

export class UI{
  constructor(actions){this.actions=actions;this.activeMatchId=null;this.bind();}
  $(id){return document.getElementById(id);}
  bind(){
    this.$('newDrawBtn').onclick=()=>this.actions.newDraw();
    this.$('assignBtn').onclick=()=>this.actions.assign();
    this.$('refreshQueueBtn').onclick=()=>this.actions.refreshQueue();
    this.$('autoBtn').onclick=()=>this.actions.toggleAuto();
    this.$('resetDemoBtn').onclick=()=>this.actions.resetDemo();
    this.$('exportBtn').onclick=()=>this.actions.export();
    this.$('importInput').onchange=e=>this.actions.import(e.target.files?.[0]);
    this.$('saveResultBtn').onclick=e=>{e.preventDefault();this.actions.saveResult(this.activeMatchId,Number(this.$('scoreA').value),Number(this.$('scoreB').value));};
  }
  msg(text,type='info'){const el=this.$('messageBox');el.textContent=text;el.className=`message-box show ${type}`;clearTimeout(this.msgTimer);this.msgTimer=setTimeout(()=>el.className='message-box',3500);}
  render(state){
    this.$('autoBtn').textContent=state.autoAssign?'⏸ 자동배정 OFF':'▶ 자동배정 ON';
    const matches=state.draw?allMatches(state.draw):[];
    const current=state.draw?currentRoundSize(state.draw):null;
    this.$('currentRound').textContent=current?ROUND_NAMES[current]:'-';
    this.$('totalMatches').textContent=matches.length;
    this.$('completedMatches').textContent=matches.filter(m=>m.status===STATUS.COMPLETED).length;
    this.$('playingMatches').textContent=matches.filter(m=>m.status===STATUS.PLAYING).length;
    this.$('wait1Matches').textContent=matches.filter(m=>m.status===STATUS.WAIT1).length;
    this.$('sharedMatches').textContent=matches.filter(m=>m.status===STATUS.SHARED).length;
    this.renderCourts(state);this.renderShared(state);this.renderStatus(state);this.renderBracket(state);
  }
  matchCard(match,action=true){
    if(!match)return `<div class="slot empty">배정된 경기 없음</div>`;
    const score=match.scoreA!=null?` · ${match.scoreA}:${match.scoreB}`:'';
    return `<div class="match-name">${match.teamA?.name||'TBD'} <span>vs</span> ${match.teamB?.name||'TBD'}</div>
      <div class="match-meta">${ROUND_NAMES[match.roundSize]} · ${match.matchNo}경기${score}</div>
      ${action&&match.teamA&&match.teamB?`<div class="match-actions"><button class="btn primary" data-result="${match.id}">${match.status===STATUS.COMPLETED?'결과 수정':'결과 입력'}</button></div>`:''}`;
  }
  attachResultButtons(){document.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>this.openResult(b.dataset.result));}
  renderCourts(state){
    this.$('courtBoard').innerHTML=state.courts.map(c=>{
      const p=state.draw?getMatch(state.draw,c.playing):null,w=state.draw?getMatch(state.draw,c.wait1):null;
      return `<article class="court-column"><div class="court-head"><span>🎾 ${c.name}</span><span>${p?'시합중':'빈코트'}</span></div>
      <div class="slot"><div class="slot-title"><span>시합중</span></div>${this.matchCard(p)}</div>
      <div class="slot wait1 ${w?'':'empty'}"><div class="slot-title"><span>대기 1번</span></div>${this.matchCard(w)}</div></article>`;
    }).join('');
    this.attachResultButtons();
  }
  renderShared(state){
    const ms=state.sharedQueue.map(id=>getMatch(state.draw,id)).filter(Boolean);
    this.$('sharedCount').textContent=`${ms.length}경기`;
    this.$('sharedQueue').innerHTML=ms.length?ms.map((m,i)=>`<div class="queue-card"><div class="queue-order">${i+1}</div><div>${this.matchCard(m,false)}</div><button class="btn primary" data-result="${m.id}">결과 입력</button></div>`).join(''):'<div class="slot empty">공용대기 경기 없음</div>';
    this.attachResultButtons();
  }
  renderStatus(state){
    if(!state.draw){this.$('statusBoard').innerHTML='<div class="slot empty">본선 대진을 생성하세요.</div>';return;}
    const r=currentRoundSize(state.draw),ms=state.draw.rounds[r];
    this.$('statusBoard').innerHTML=ms.map(m=>{
      const label={playing:'시합중',court_wait1:'대기1',shared_queue:'공용대기',completed:'완료',unassigned:'배정대기',waiting_slots:'슬롯대기'}[m.status]||m.status;
      return `<article class="status-card ${m.status===STATUS.COMPLETED?'completed':''}"><div class="status-head"><span>${m.matchNo}경기</span><span class="state-chip">${label}</span></div>
      <div class="match-name">${m.teamA?.name||'TBD'}<br>vs<br>${m.teamB?.name||'TBD'}</div>
      ${m.scoreA!=null?`<div class="status-score">${m.scoreA}:${m.scoreB}</div>`:''}
      <div class="match-meta">${ROUND_NAMES[r]}${m.court?' · '+m.court:''}</div>
      ${m.teamA&&m.teamB?`<div class="match-actions"><button class="btn primary" data-result="${m.id}">${m.status===STATUS.COMPLETED?'결과 수정':'결과 입력'}</button></div>`:''}</article>`;
    }).join('');
    this.attachResultButtons();
  }
  renderBracket(state){
    if(!state.draw){this.$('bracketBoard').innerHTML='<div class="slot empty">본선 대진을 생성하세요.</div>';return;}
    const sizes=Object.keys(state.draw.rounds).map(Number).sort((a,b)=>b-a);
    this.$('bracketBoard').innerHTML=sizes.map(size=>`<section class="round-column"><div class="round-title">${ROUND_NAMES[size]}</div><div class="round-body">
      ${state.draw.rounds[size].map(m=>`<article class="bracket-card ${m.teamA&&m.teamB?'':'placeholder'}"><div class="bracket-head"><span>${m.matchNo}경기</span><span>${m.court||''}</span></div>
      <div class="bracket-team ${m.winnerId&&m.winnerId===m.teamA?.id?'winner':''}"><span>${m.teamA?.name||'TBD'}</span><strong>${m.scoreA??''}</strong></div>
      <div class="bracket-team ${m.winnerId&&m.winnerId===m.teamB?.id?'winner':''}"><span>${m.teamB?.name||'TBD'}</span><strong>${m.scoreB??''}</strong></div>
      <div class="bracket-foot">${m.status===STATUS.COMPLETED?'완료':m.status}</div>
      ${m.teamA&&m.teamB?`<button class="btn primary" style="margin:7px;width:calc(100% - 14px)" data-result="${m.id}">${m.status===STATUS.COMPLETED?'결과 수정':'결과 입력'}</button>`:''}</article>`).join('')}
      </div></section>`).join('');
    this.attachResultButtons();
  }
  openResult(matchId){
    const state=this.actions.getState(),m=getMatch(state.draw,matchId);if(!m)return;
    this.activeMatchId=matchId;this.$('resultTitle').textContent=`${ROUND_NAMES[m.roundSize]} ${m.matchNo}경기 결과`;
    this.$('resultMeta').textContent=m.court||({shared_queue:'공용대기',court_wait1:'대기1',playing:'시합중'}[m.status]||'');
    this.$('teamALabel').textContent=m.teamA?.name||'1번 팀';this.$('teamBLabel').textContent=m.teamB?.name||'2번 팀';
    this.$('scoreA').value=m.scoreA??'';this.$('scoreB').value=m.scoreB??'';this.$('resultDialog').showModal();
  }
  closeResult(){this.$('resultDialog').close();this.activeMatchId=null;}
}
