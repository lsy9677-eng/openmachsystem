'use strict';
/* 230MATCH MAIN V2 bundled hotfix
   Single classic script: avoids ES-module MIME/path failures on static hosting.
*/

/* ===== constants.js ===== */
const VERSION = '1.0.0';
const STORAGE_KEY = '230MATCH_MAIN_V2_STATE';
const STATUS = Object.freeze({
  WAITING_SLOTS: 'waiting_slots',
  UNASSIGNED: 'unassigned',
  SHARED: 'shared_queue',
  WAIT1: 'court_wait1',
  PLAYING: 'playing',
  COMPLETED: 'completed'
});
const ROUND_NAMES = Object.freeze({
  128:'128강',64:'64강',32:'32강',16:'16강',8:'8강',4:'준결승',2:'결승'
});



/* ===== utils.js ===== */
function uid(prefix='id'){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;}
function clone(value){return JSON.parse(JSON.stringify(value));}
function nowIso(){return new Date().toISOString();}
function roundName(size){return size===4?'준결승':size===2?'결승':`${size}강`;}
function courtNumber(name){const m=String(name||'').match(/(\d+)\s*$/);return m?Number(m[1]):9999;}
function balancedOrder(count){
  const out=[]; let low=1, high=count;
  const middle=[];
  let left=Math.floor((count+1)/2)+1, right=Math.floor((count+1)/2);
  while(middle.length<count){
    if(left<=count) middle.push(left++);
    if(right>=1) middle.push(right--);
  }
  let mi=0;
  while(out.length<count){
    if(low<=high && !out.includes(low)) out.push(low++);
    if(low<=high && !out.includes(high)) out.push(high--);
    while(mi<middle.length && out.includes(middle[mi])) mi++;
    if(mi<middle.length) out.push(middle[mi++]);
  }
  return out.slice(0,count);
}
function downloadJson(filename,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function safeText(v){return String(v??'');}



/* ===== bracket.js ===== */


function createTeams(size){
  return Array.from({length:size},(_,i)=>({
    id:`team_${i+1}`,
    seed:i+1,
    name:`${i+1}번팀 선수A / 선수B`
  }));
}

function shuffle(items,rng=Math.random){
  const a=[...items];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

function evenlySpacedIndexes(total,count){
  if(count<=0)return [];
  const out=[],used=new Set();
  for(let i=0;i<count;i++){
    let idx=Math.floor((i+0.5)*total/count);
    while(used.has(idx)&&idx<total-1)idx++;
    while(used.has(idx)&&idx>0)idx--;
    used.add(idx);out.push(idx);
  }
  return out.sort((a,b)=>a-b);
}
function parseGroupRankTeams(teams){
  return teams.map((team,i)=>({
    ...team,
    groupNo:Math.floor(i/2)+1,
    groupRank:(i%2)+1
  }));
}
function rotateUntilDifferentGroup(list,avoidGroup){
  const idx=list.findIndex(t=>t.groupNo!==avoidGroup);
  if(idx<0)return list.shift();
  return list.splice(idx,1)[0];
}
function buildGroupRankBalancedSlots(size,teams){
  const ranked=parseGroupRankTeams(teams);
  const winners=ranked.filter(t=>t.groupRank===1);
  const runners=ranked.filter(t=>t.groupRank===2);
  const byeCount=size-ranked.length;

  // 부전승은 조 1위에게 우선 부여. 조 번호 전 구간에서 균등 선정.
  const byeWinnerIndexes=evenlySpacedIndexes(winners.length,Math.min(byeCount,winners.length));
  const byeWinnerIndexSet=new Set(byeWinnerIndexes);
  const byeTeams=winners.filter((_,i)=>byeWinnerIndexSet.has(i));
  const activeWinners=winners.filter((_,i)=>!byeWinnerIndexSet.has(i));

  // 실경기 구성: 남은 1위 vs 다른 조 2위를 먼저 배치.
  const runnerPool=[...runners];
  const pairs=[];
  for(const w of activeWinners){
    if(!runnerPool.length)break;
    const r=rotateUntilDifferentGroup(runnerPool,w.groupNo);
    pairs.push([w,r]);
  }
  // 남은 2위끼리도 동일 조 재대결을 피해서 구성.
  while(runnerPool.length>=2){
    const a=runnerPool.shift();
    const b=rotateUntilDifferentGroup(runnerPool,a.groupNo);
    pairs.push([a,b]);
  }

  const matchCount=size/2;
  const slots=Array(size).fill(null);
  const byeMatchIndexes=evenlySpacedIndexes(matchCount,byeTeams.length);
  const byeSet=new Set(byeMatchIndexes);

  // 부전승 팀은 각 섹션에 고르게 놓고, 좌우 슬롯도 번갈아 배치.
  byeMatchIndexes.forEach((matchIdx,i)=>{
    const slotBase=matchIdx*2;
    if(i%2===0)slots[slotBase]=byeTeams[i];
    else slots[slotBase+1]=byeTeams[i];
  });

  // 남은 경기 역시 빈 경기 번호 전 구간에 균등하게 채움.
  const openMatches=Array.from({length:matchCount},(_,i)=>i).filter(i=>!byeSet.has(i));
  const pairOrder=balancedOrder(openMatches.length).map(n=>n-1);
  pairs.forEach((pair,i)=>{
    const matchIdx=openMatches[pairOrder[i]];
    const slotBase=matchIdx*2;
    // 상하 방향도 교차시켜 특정 구역 편향을 줄임.
    if(i%2===0){slots[slotBase]=pair[0];slots[slotBase+1]=pair[1];}
    else{slots[slotBase]=pair[1];slots[slotBase+1]=pair[0];}
  });

  return {slots,byeCount,byeTeams,pairs,ranked};
}
function createBracket(size,teams){
  if(![32,64,128].includes(size)) throw new Error('지원 대진 규모는 32, 64 또는 128입니다.');
  if(!Array.isArray(teams)||teams.length<2) throw new Error('최소 2팀이 필요합니다.');
  if(teams.length>size) throw new Error(`선택한 ${size}강보다 팀 수가 많습니다.`);
  if(teams.length<=size/2) throw new Error(`${size}강은 ${size/2+1}팀 이상일 때 사용하세요. 더 작은 대진 규모를 선택하세요.`);

  const rounds={};
  let current=size;
  while(current>=2){
    const matchCount=current/2;
    rounds[current]=Array.from({length:matchCount},(_,i)=>({
      id:`r${current}_m${i+1}`,
      roundSize:current,
      matchNo:i+1,
      teamA:null,teamB:null,
      sourceA:null,sourceB:null,
      scoreA:null,scoreB:null,
      winnerId:null,
      bye:false,
      status:current===size?STATUS.UNASSIGNED:STATUS.WAITING_SLOTS,
      venue:'',court:'',queueOrder:null,
      startedAt:null,completedAt:null,
      nextMatchId:current>2?`r${current/2}_m${Math.floor(i/2)+1}`:null,
      nextSlot:current>2?(i%2===0?'A':'B'):null
    }));
    current/=2;
  }

  const policy=document.getElementById('byePolicy')?.value||'group_rank_balanced';
  let slots,byeMeta={};
  if(policy==='group_rank_balanced'&&teams.length%2===0){
    const built=buildGroupRankBalancedSlots(size,teams);
    slots=built.slots;
    byeMeta={
      policy,
      byeTeams:built.byeTeams.map(t=>({id:t.id,name:t.name,groupNo:t.groupNo,groupRank:t.groupRank}))
    };
  }else{
    const shuffled=shuffle(teams);
    const slotOrder=balancedOrder(size).map(n=>n-1);
    slots=Array(size).fill(null);
    shuffled.forEach((team,i)=>{slots[slotOrder[i]]=team;});
    byeMeta={policy:'balanced_random',byeTeams:[]};
  }

  rounds[size].forEach((m,i)=>{
    m.teamA=slots[i*2];
    m.teamB=slots[i*2+1];
  });

  const draw={
    id:uid('draw'),
    size,
    teamCount:teams.length,
    byeCount:size-teams.length,
    createdAt:nowIso(),
    rounds,
    byePolicy:byeMeta.policy,
    byeTeams:byeMeta.byeTeams
  };
  autoAdvanceByes(draw);
  return draw;
}

function autoAdvanceByes(draw){
  let changed=true, guard=0;
  while(changed&&guard++<20){
    changed=false;
    const sizes=Object.keys(draw.rounds).map(Number).sort((a,b)=>b-a);
    for(const size of sizes){
      for(const m of draw.rounds[size]){
        if(m.status===STATUS.COMPLETED) continue;
        const a=!!m.teamA,b=!!m.teamB;
        if(a===b) continue;
        const winner=m.teamA||m.teamB;
        m.winnerId=winner.id;
        m.bye=true;
        m.status=STATUS.COMPLETED;
        m.completedAt=nowIso();
        if(m.nextMatchId){
          const next=getMatch(draw,m.nextMatchId);
          if(m.nextSlot==='A') next.teamA=winner; else next.teamB=winner;
          if(next.teamA&&next.teamB&&next.status===STATUS.WAITING_SLOTS) next.status=STATUS.UNASSIGNED;
        }
        changed=true;
      }
    }
  }
}

function allMatches(draw){
  if(!draw) return [];
  return Object.keys(draw.rounds).map(Number).sort((a,b)=>b-a).flatMap(r=>draw.rounds[r]);
}

function getMatch(draw,id){
  return allMatches(draw).find(m=>m.id===id)||null;
}

function isReady(match){return !!(match&&match.teamA&&match.teamB);}
function isCompleted(match){return match?.status===STATUS.COMPLETED&&!!match.winnerId;}

function applyResult(draw,matchId,scoreA,scoreB){
  const m=getMatch(draw,matchId);
  if(!m) throw new Error('경기를 찾지 못했습니다.');
  if(!isReady(m)) throw new Error('양 팀이 확정되지 않았습니다.');
  scoreA=Number(scoreA);scoreB=Number(scoreB);
  if(!Number.isFinite(scoreA)||!Number.isFinite(scoreB)||scoreA===scoreB) throw new Error('동점이 아닌 유효한 점수를 입력하세요.');
  m.scoreA=scoreA;m.scoreB=scoreB;m.winnerId=scoreA>scoreB?m.teamA.id:m.teamB.id;
  m.status=STATUS.COMPLETED;m.completedAt=nowIso();
  const winner=scoreA>scoreB?m.teamA:m.teamB;
  if(m.nextMatchId){
    const next=getMatch(draw,m.nextMatchId);
    if(m.nextSlot==='A') next.teamA=winner; else next.teamB=winner;
    if(next.teamA&&next.teamB&&next.status===STATUS.WAITING_SLOTS) next.status=STATUS.UNASSIGNED;
  }
  return {match:m,winner};
}

function currentRoundSize(draw){
  const sizes=Object.keys(draw?.rounds||{}).map(Number).sort((a,b)=>b-a);
  for(const size of sizes){
    const matches=draw.rounds[size];
    if(matches.some(m=>m.status!==STATUS.COMPLETED)) return size;
  }
  return 2;
}



/* ===== queue.js ===== */



function makeCourts(count,prefix='국제'){
  return Array.from({length:count},(_,i)=>({id:`court_${i+1}`,name:`${prefix}${i+1}`,venue:prefix,playing:null,wait1:null}));
}

function clearAssignment(match){
  match.venue='';match.court='';match.queueOrder=null;match.startedAt=null;
  if(match.status!==STATUS.COMPLETED) match.status=isReady(match)?STATUS.UNASSIGNED:STATUS.WAITING_SLOTS;
}

function clearAllAssignments(state){
  allMatches(state.draw).forEach(clearAssignment);
  state.courts.forEach(c=>{c.playing=null;c.wait1=null;});
  state.sharedQueue=[];
}

function initialAssign(state){
  clearAllAssignments(state);
  const firstRound=state.draw.rounds[state.draw.size].filter(isReady);
  const order=balancedOrder(firstRound.length).map(n=>firstRound[n-1]).filter(Boolean);
  const courts=state.courts;
  let idx=0;
  for(const court of courts){
    const match=order[idx++]; if(!match) break;
    placePlaying(state,court,match);
  }
  for(const court of courts){
    const match=order[idx++]; if(!match) break;
    placeWait1(state,court,match);
  }
  while(idx<order.length){placeShared(state,order[idx++]);}
  normalizeQueueOrders(state);
}

function placePlaying(state,court,match){
  court.playing=match.id;match.status=STATUS.PLAYING;match.court=court.name;match.venue=court.venue;match.startedAt=match.startedAt||nowIso();match.queueOrder=null;
}
function placeWait1(state,court,match){
  court.wait1=match.id;match.status=STATUS.WAIT1;match.court=court.name;match.venue=court.venue;match.queueOrder=1;
}
function placeShared(state,match){
  if(!state.sharedQueue.includes(match.id)) state.sharedQueue.push(match.id);
  match.status=STATUS.SHARED;match.court='';match.venue=state.courts[0]?.venue||'';match.queueOrder=state.sharedQueue.length;
}

function normalizeQueueOrders(state){
  state.sharedQueue=state.sharedQueue.filter(id=>{
    const m=allMatches(state.draw).find(x=>x.id===id);
    return m&&m.status===STATUS.SHARED;
  });
  state.sharedQueue.forEach((id,i)=>{const m=allMatches(state.draw).find(x=>x.id===id);if(m)m.queueOrder=i+1;});
}

function refreshQueue(state){
  // Strict rule: wait1 -> playing, shared -> wait1. Shared never jumps directly to playing.
  for(const court of state.courts){
    const playing=allMatches(state.draw).find(m=>m.id===court.playing);
    if(playing?.status===STATUS.COMPLETED) court.playing=null;

    if(!court.playing && court.wait1){
      const wait=allMatches(state.draw).find(m=>m.id===court.wait1);
      court.wait1=null;
      if(wait&&wait.status!==STATUS.COMPLETED) placePlaying(state,court,wait);
    }

    if(!court.wait1 && state.sharedQueue.length){
      const nextId=state.sharedQueue.shift();
      const next=allMatches(state.draw).find(m=>m.id===nextId);
      if(next&&next.status!==STATUS.COMPLETED) placeWait1(state,court,next);
    }
  }
  normalizeQueueOrders(state);
}

function enqueueNewReadyMatches(state){
  const assigned=new Set([
    ...state.sharedQueue,
    ...state.courts.flatMap(c=>[c.playing,c.wait1]).filter(Boolean)
  ]);
  allMatches(state.draw).filter(m=>isReady(m)&&m.status===STATUS.UNASSIGNED&&!assigned.has(m.id))
    .sort((a,b)=>b.roundSize-a.roundSize||a.matchNo-b.matchNo)
    .forEach(m=>placeShared(state,m));
  normalizeQueueOrders(state);
}

function completeAndAdvanceQueue(state,matchId){
  const court=state.courts.find(c=>c.playing===matchId||c.wait1===matchId);
  if(court&&court.playing===matchId) court.playing=null;
  if(court&&court.wait1===matchId) court.wait1=null;
  enqueueNewReadyMatches(state);
  if(state.autoAssign) refreshQueue(state);
}



/* ===== store.js ===== */


class Store{
  constructor(initial){this.state=initial;this.listeners=new Set();}
  get(){return this.state;}
  set(next,{persist=true}={}){this.state=next;if(persist)this.persist();this.emit();}
  update(mutator,{persist=true}={}){const next=clone(this.state);mutator(next);this.set(next,{persist});}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  emit(){for(const fn of this.listeners)fn(this.state);}
  persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(this.state));}
  load(){const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return false;this.state=JSON.parse(raw);this.emit();return true;}
  clear(){localStorage.removeItem(STORAGE_KEY);}
}



/* ===== repository.js ===== */
class LocalRepository{
  async save(state){return state;}
  async load(){return null;}
}
class LegacyBridge{
  static detect(){
    try{return !!(window.opener&&window.opener.G);}catch{return false;}
  }
  static readLegacySnapshot(){
    if(!this.detect()) throw new Error('연결된 기존 앱 창이 없습니다.');
    return JSON.parse(JSON.stringify(window.opener.G));
  }
}
// Firebase 연동은 기존 앱의 데이터 계약을 확정한 뒤 이 인터페이스에 구현합니다.
class FirebaseRepository{
  async save(){throw new Error('FirebaseRepository는 아직 운영 경로에 연결되지 않았습니다.');}
  async load(){throw new Error('FirebaseRepository는 아직 운영 경로에 연결되지 않았습니다.');}
}



/* ===== ui.js ===== */


class UI{
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
      const label={playing:'시합중',court_wait1:'코트 대기 1번',shared_queue:'공용대기',completed:'완료',unassigned:'배정 대기',waiting_slots:'대진 확정 대기'}[m.status]||m.status;
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
      <div class="bracket-foot">${({playing:'시합중',court_wait1:'코트 대기 1번',shared_queue:'공용대기',completed:'완료',unassigned:'배정 대기',waiting_slots:'대진 확정 대기'}[m.status]||m.status)}</div>
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




/* ===== read-only legacy bridge v1.2 ===== */
const BridgeState={legacyWindow:null,candidates:[],diagnostic:null};

function bridgeLog(message){
  const el=document.getElementById('bridgeLog');
  if(!el)return;
  const stamp=new Date().toLocaleTimeString('ko-KR',{hour12:false});
  el.textContent+=`\n[${stamp}] ${message}`;
  el.scrollTop=el.scrollHeight;
}

function setBridgeChip(id,text,ok=false){
  const el=document.getElementById(id);if(!el)return;
  el.textContent=text;el.className=`bridge-chip ${ok?'ok':'warn'}`;
}

function safeKeys(obj,limit=300){
  try{return Object.keys(obj).slice(0,limit);}catch{return [];}
}
function plainClone(value,depth=0,seen=new WeakSet()){
  if(depth>4)return '[depth-limit]';
  if(value===null||['string','number','boolean'].includes(typeof value))return value;
  if(typeof value==='function'||typeof value==='undefined')return undefined;
  if(typeof value!=='object')return String(value);
  if(seen.has(value))return '[circular]';
  seen.add(value);
  if(Array.isArray(value))return value.slice(0,200).map(v=>plainClone(v,depth+1,seen));
  const out={};for(const k of safeKeys(value,80)){try{out[k]=plainClone(value[k],depth+1,seen);}catch{}}
  return out;
}
function nameFromAny(item){
  if(item==null)return '';
  if(typeof item==='string')return item.trim();
  const direct=item.teamName||item.displayName||item.name||item.title||item.pairName||item.label;
  if(direct&&typeof direct==='string')return direct.trim();
  const a=item.player1?.name||item.player1||item.p1||item.name1||item.member1||item.firstPlayer||item.aName;
  const b=item.player2?.name||item.player2||item.p2||item.name2||item.member2||item.secondPlayer||item.bName;
  const joined=[a,b].filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()).join(' / ');
  return joined;
}
function affiliationFromAny(item){
  if(!item||typeof item!=='object')return '';
  return String(item.club||item.affiliation||item.team||item.organization||item.org||item.groupName||'').trim();
}
function rankFromAny(item,index){
  if(!item||typeof item!=='object')return null;
  const v=item.rank??item.place??item.position??item.order??item.standing??item.groupRank;
  const n=Number(v);return Number.isFinite(n)?n:null;
}
function groupFromAny(item){
  if(!item||typeof item!=='object')return '';
  return String(item.groupNo??item.group??item.pool??item.prelimGroup??item.groupName??'').trim();
}
function looksTeamArray(arr){
  if(!Array.isArray(arr)||arr.length<2)return false;
  const sample=arr.slice(0,Math.min(arr.length,20));
  const named=sample.filter(v=>!!nameFromAny(v)).length;
  return named>=Math.max(2,Math.ceil(sample.length*.55));
}
function candidateKind(arr){
  const sample=arr.slice(0,30);
  const ranked=sample.filter(v=>rankFromAny(v)!=null||groupFromAny(v)).length;
  return ranked>=Math.max(2,Math.ceil(sample.length*.35))?'ranked':'teams';
}
function normalizeCandidate(arr,path,source){
  const teams=arr.map((item,i)=>({
    rawIndex:i,
    name:nameFromAny(item),
    affiliation:affiliationFromAny(item),
    rank:rankFromAny(item,i),
    group:groupFromAny(item),
    raw:plainClone(item)
  })).filter(x=>x.name);
  return {id:`cand_${source}_${BridgeState.candidates.length}_${Date.now()}`,source,path,kind:candidateKind(arr),count:teams.length,teams};
}
function walkCandidates(root,source,basePath,maxDepth=4){
  const results=[],seen=new WeakSet();
  function walk(value,path,depth){
    if(depth>maxDepth||value==null)return;
    if(typeof value!=='object')return;
    if(seen.has(value))return;seen.add(value);
    if(Array.isArray(value)){
      if(looksTeamArray(value))results.push(normalizeCandidate(value,path,source));
      const inspect=value.slice(0,12);
      inspect.forEach((v,i)=>walk(v,`${path}[${i}]`,depth+1));
      return;
    }
    for(const key of safeKeys(value,120)){
      if(/^(document|window|parent|top|frames|self|opener|ownerDocument)$/i.test(key))continue;
      let child;try{child=value[key];}catch{continue;}
      if(typeof child==='function')continue;
      walk(child,path?`${path}.${key}`:key,depth+1);
    }
  }
  walk(root,basePath,0);
  return results;
}
function scanStorage(storage,source){
  const results=[];
  try{
    for(let i=0;i<storage.length;i++){
      const key=storage.key(i),raw=storage.getItem(key);
      if(!raw||raw.length>2000000)continue;
      try{
        const val=JSON.parse(raw);
        results.push(...walkCandidates(val,source,`storage.${key}`,4));
      }catch{}
    }
  }catch(e){bridgeLog(`${source} 저장소 검사 실패: ${e.message}`);}
  return results;
}
function dedupeCandidates(list){
  const map=new Map();
  for(const c of list){
    const sig=`${c.count}|${c.teams.slice(0,5).map(t=>t.name).join('|')}`;
    if(!map.has(sig))map.set(sig,c);
  }
  return [...map.values()].sort((a,b)=>{
    const rank=(x)=>(x.kind==='ranked'?0:1);
    return rank(a)-rank(b)||b.count-a.count||a.path.localeCompare(b.path);
  });
}
function refreshCandidateUI(){
  const select=document.getElementById('bridgeCandidateSelect');
  const list=BridgeState.candidates;
  select.innerHTML=list.length?list.map((c,i)=>`<option value="${i}">${c.kind==='ranked'?'[순위형]':'[팀목록]'} ${c.count}팀 · ${c.source} · ${c.path}</option>`).join(''):'<option value="">탐지된 후보 없음</option>';
  setBridgeChip('candidateCountChip',`후보 ${list.length}개`,list.length>0);
  const ranked=list.filter(c=>c.kind==='ranked').length;
  setBridgeChip('rankedCountChip',`순위형 ${ranked}개`,ranked>0);
  renderCandidatePreview();
}
function selectedCandidate(){
  const i=Number(document.getElementById('bridgeCandidateSelect').value);
  return Number.isInteger(i)?BridgeState.candidates[i]:null;
}
function renderCandidatePreview(){
  const box=document.getElementById('bridgePreview'),c=selectedCandidate();
  if(!c){box.innerHTML='<div class="bridge-empty">검사 후 후보를 선택하세요.</div>';return;}
  const rows=c.teams.slice(0,80).map((t,i)=>`<tr><td>${i+1}</td><td>${safeText(t.group||'')}</td><td>${t.rank??''}</td><td>${safeText(t.name)}</td><td>${safeText(t.affiliation)}</td></tr>`).join('');
  box.innerHTML=`<table><thead><tr><th>#</th><th>조</th><th>순위</th><th>팀</th><th>소속</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function openLegacyApp(){
  const url=new URL('./dev.html',location.href);
  url.searchParams.set('__bridge','main-v2-readonly');
  url.searchParams.set('__ts',Date.now());
  BridgeState.legacyWindow=window.open(url.href,'230match_legacy_bridge');
  if(BridgeState.legacyWindow){setBridgeChip('legacyWindowChip','기존 앱 창 열림',true);bridgeLog('기존 앱 새 창을 열었습니다. 로그인과 대회/부서 선택 후 검사하세요.');}
  else{bridgeLog('팝업이 차단되었습니다. 브라우저에서 팝업을 허용하세요.');}
}
function scanLegacyWindow(){
  const w=BridgeState.legacyWindow;
  if(!w||w.closed){setBridgeChip('legacyWindowChip','기존 앱 미연결',false);bridgeLog('열린 기존 앱 창이 없습니다.');return;}
  try{
    if(w.location.origin!==location.origin)throw new Error('동일 출처가 아닙니다.');
    const roots=[];
    const priority=['G','STATE','APP_STATE','store','currentTournament','tournaments','participants','teams','groups','standings','prelimResults','windowData'];
    for(const key of priority){try{if(w[key]!=null)roots.push([key,w[key]]);}catch{}}
    let found=[];
    for(const [key,value] of roots)found.push(...walkCandidates(value,'legacy-window',`window.${key}`,5));
    found.push(...scanStorage(w.localStorage,'legacy-window-localStorage'));
    try{found.push(...scanStorage(w.sessionStorage,'legacy-window-sessionStorage'));}catch{}
    BridgeState.candidates=dedupeCandidates(found);
    BridgeState.diagnostic={scannedAt:new Date().toISOString(),origin:w.location.origin,path:w.location.pathname,rootKeys:priority.filter(k=>{try{return w[k]!=null}catch{return false}}),candidates:BridgeState.candidates.map(c=>({...c,teams:c.teams.slice(0,100)}))};
    setBridgeChip('legacyWindowChip','기존 앱 연결됨',true);
    bridgeLog(`기존 앱 검사 완료: 후보 ${BridgeState.candidates.length}개`);
    refreshCandidateUI();
  }catch(e){bridgeLog(`기존 앱 검사 실패: ${e.message}`);}
}
function scanCurrentPageStorage(){
  const found=dedupeCandidates([...scanStorage(localStorage,'current-localStorage'),...scanStorage(sessionStorage,'current-sessionStorage')]);
  BridgeState.candidates=found;
  BridgeState.diagnostic={scannedAt:new Date().toISOString(),origin:location.origin,path:location.pathname,candidates:found};
  bridgeLog(`현재 페이지 저장소 검사 완료: 후보 ${found.length}개`);
  refreshCandidateUI();
}
function teamsFromCandidate(c,rankOnly=false){
  let rows=[...c.teams];
  if(rankOnly){
    const grouped=new Map();
    for(const t of rows){
      const g=t.group||'unknown';
      if(!grouped.has(g))grouped.set(g,[]);
      grouped.get(g).push(t);
    }
    rows=[...grouped.values()].flatMap(group=>{
      const ranked=group.filter(x=>x.rank!=null).sort((a,b)=>a.rank-b.rank);
      if(ranked.length>=2)return ranked.filter(x=>x.rank===1||x.rank===2).slice(0,2);
      return group.slice(0,2);
    });
  }
  return rows.map((t,i)=>({id:`bridge_team_${i+1}`,seed:i+1,name:t.name,affiliation:t.affiliation||''}));
}
function copyCandidateToText(rankOnly=false){
  const c=selectedCandidate();if(!c){ui.msg('데이터 후보를 먼저 선택하세요.','error');return;}
  const teams=teamsFromCandidate(c,rankOnly);
  document.getElementById('teamImportText').value=teams.map(t=>t.name+(t.affiliation?` | ${t.affiliation}`:'')).join('\n');
  setTeamImportSummary(`${c.path}에서 ${teams.length}팀을 명단 입력창으로 복사했습니다.`);
  ui.msg(`${teams.length}팀을 명단 입력창으로 복사했습니다.`,'success');
}
function useCandidate(rankOnly=false){
  if(!guardDrawMutation('기존 데이터 적용'))return;
  const c=selectedCandidate();if(!c){ui.msg('데이터 후보를 먼저 선택하세요.','error');return;}
  const teams=teamsFromCandidate(c,rankOnly);
  const size=Number(document.getElementById('drawSize').value);
  if(teams.length!==size){
    copyCandidateToText(rankOnly);
    ui.msg(`${size}팀이 필요하지만 후보는 ${teams.length}팀입니다. 명단 입력창에서 검토·수정하세요.`,'error');
    return;
  }
  const count=Number(document.getElementById('courtCount').value);
  const prefix=document.getElementById('courtPrefix').value.trim()||'국제';
  const next=initialState(size,count,prefix);
  next.draw=createBracket(size,teams);
  next.bridgeSource={source:c.source,path:c.path,kind:c.kind,count:c.count,importedAt:new Date().toISOString()};
  store.set(next);
  ui.msg(`${teams.length}팀을 기존 앱에서 읽어 본선 대진에 적용했습니다.`,'success');
}

function isByeName(name){
  const v=String(name||'').trim().toUpperCase();
  return !v || v==='BYE' || v.includes('부전승');
}
function findExactLegacyDrawCandidate(){
  const exact=BridgeState.candidates.filter(c=>
    /\.draw\.manual128\.rounds\[0\]$/.test(c.path||'') &&
    Array.isArray(c.teams) &&
    c.teams.some(t=>!isByeName(t.name))
  );
  if(!exact.length)return null;
  exact.sort((a,b)=>{
    const aReal=a.teams.filter(t=>!isByeName(t.name)).length;
    const bReal=b.teams.filter(t=>!isByeName(t.name)).length;
    return bReal-aReal;
  });
  return exact[0];
}
function nextPowerOfTwo(n){
  let p=1; while(p<n)p*=2; return p;
}
function useExactLegacyDraw(){
  if(!guardDrawMutation('기존 본선 슬롯 적용'))return;
  const c=findExactLegacyDrawCandidate();
  if(!c){
    ui.msg('기존 본선 슬롯 데이터(manual128.rounds[0])를 찾지 못했습니다. 먼저 기존 앱 데이터 검사를 실행하세요.','error');
    return;
  }
  const rawTeams=c.teams.filter(t=>!isByeName(t.name));
  const seen=new Set();
  const teams=[];
  for(const t of rawTeams){
    const key=String(t.name||'').trim();
    if(!key || seen.has(key)) continue;
    seen.add(key);
    teams.push({
      id:`legacy_exact_${teams.length+1}`,
      seed:teams.length+1,
      name:key,
      affiliation:t.affiliation||''
    });
  }
  const suggested=nextPowerOfTwo(teams.length);
  const supported=[32,64,128];
  const size=supported.includes(suggested)?suggested:null;
  if(!size){
    document.getElementById('teamImportText').value=teams.map(t=>t.name).join('\n');
    setTeamImportSummary(`정확한 기존 본선 슬롯에서 ${teams.length}팀을 찾았습니다. 지원 대진 규모와 맞지 않아 명단 입력창에만 복사했습니다.`);
    ui.msg(`${teams.length}팀을 찾았습니다. 대진 규모를 확인하세요.`,'error');
    return;
  }

  const drawSizeEl=document.getElementById('drawSize');
  const hasOption=[...drawSizeEl.options].some(o=>Number(o.value)===size);
  if(hasOption) drawSizeEl.value=String(size);

  const count=Number(document.getElementById('courtCount').value);
  const prefix=document.getElementById('courtPrefix').value.trim()||'국제';
  const next=initialState(size,count,prefix);
  next.draw=createBracket(size,teams);
  next.bridgeSource={
    source:c.source,
    path:c.path,
    kind:'exact-manual128-round0',
    rawSlotCount:c.teams.length,
    actualTeamCount:teams.length,
    importedAt:new Date().toISOString()
  };
  next.drawLocked=false;
  store.set(next);
  setTimeout(()=>{validateCurrentDraw(false);syncDrawLockUI();},0);
  document.getElementById('teamImportText').value=teams.map(t=>t.name).join('\n');
  setTeamImportSummary(`기존 본선 슬롯 ${c.teams.length}칸에서 부전승을 제외한 실제 ${teams.length}팀을 적용했습니다.`);
  bridgeLog(`정확 어댑터 적용: ${c.path} / 전체 슬롯 ${c.teams.length} / 실제 팀 ${teams.length} / 대진 ${size}강`);
  ui.msg(`기존 본선 슬롯에서 실제 ${teams.length}팀을 정확히 적용했습니다.`,'success');
}

function exportBridgeDiagnostic(){
  if(!BridgeState.diagnostic){ui.msg('먼저 데이터 검사를 실행하세요.','error');return;}
  downloadJson(`230match-bridge-diagnostic-${Date.now()}.json`,BridgeState.diagnostic);
}


/* ===== app.js ===== */







function parseTeamLines(raw){
  const lines=String(raw||'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
  return lines.map((line,i)=>{
    // Supports: "홍길동 / 김철수", "홍길동,김철수", tab-separated and optional affiliation after |
    const [namePart, affiliation=''] = line.split('|').map(v=>v.trim());
    const normalized=namePart.replace(/\t+/g,' / ').replace(/\s*,\s*/g,' / ').replace(/\s*\/\s*/g,' / ');
    return {id:`import_team_${i+1}`,seed:i+1,name:normalized,affiliation};
  });
}
function readLegacyCandidates(){
  const found=[];
  const keys=['participants','teams','registrations','tournamentParticipants','entryList','players'];
  for(const key of keys){
    try{
      const raw=localStorage.getItem(key);
      if(!raw) continue;
      const val=JSON.parse(raw);
      if(Array.isArray(val)) found.push(...val);
    }catch{}
  }
  // Search likely JSON values without mutating anything.
  try{
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!/team|participant|entry|player|register/i.test(key||'')) continue;
      try{
        const val=JSON.parse(localStorage.getItem(key));
        if(Array.isArray(val)) found.push(...val);
      }catch{}
    }
  }catch{}
  const seen=new Set(),teams=[];
  for(const item of found){
    const name=typeof item==='string'?item:
      item?.teamName||item?.name||item?.displayName||
      [item?.player1?.name||item?.p1||item?.name1,item?.player2?.name||item?.p2||item?.name2].filter(Boolean).join(' / ');
    if(!name||seen.has(name)) continue;
    seen.add(name);
    teams.push({id:`legacy_team_${teams.length+1}`,seed:teams.length+1,name:String(name),affiliation:item?.club||item?.affiliation||''});
  }
  return teams;
}
function setTeamImportSummary(text){const el=document.getElementById('teamImportSummary');if(el)el.textContent=text;}

function initialState(size=64,courts=8,prefix='국제'){
  return {version:VERSION,draw:createBracket(size,createTeams(size)),courts:makeCourts(courts,prefix),sharedQueue:[],autoAssign:true,settings:{estimatedMinutes:30}};
}
const store=new Store(initialState());

function parseImportedFileText(text,filename=''){
  const lower=filename.toLowerCase();
  if(lower.endsWith('.json')){
    const data=JSON.parse(text);
    const arr=Array.isArray(data)?data:(Array.isArray(data.teams)?data.teams:[]);
    return arr.map((v,i)=>({
      id:`file_team_${i+1}`,
      seed:Number(v.seed)||i+1,
      name:typeof v==='string'?v:String(v.name||v.teamName||'').trim(),
      affiliation:String(v.affiliation||v.club||'').trim()
    })).filter(t=>t.name);
  }
  const lines=String(text||'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
  if(lower.endsWith('.csv')){
    // Supports: team, affiliation OR player1, player2, affiliation
    return lines.map((line,i)=>{
      const cols=line.split(',').map(v=>v.trim().replace(/^"|"$/g,''));
      if(i===0&&cols.some(v=>/team|팀|선수|name/i.test(v))) return null;
      const name=cols.length>=2&& !cols[0].includes('/') ? `${cols[0]} / ${cols[1]}` : cols[0];
      const affiliation=cols.length>=3?cols[2]:'';
      return {id:`file_team_${i+1}`,seed:i+1,name,affiliation};
    }).filter(t=>t&&t.name);
  }
  return parseTeamLines(text);
}
function chooseBestDrawSize(teamCount){
  if(teamCount<=32&&teamCount>16)return 32;
  if(teamCount<=64&&teamCount>32)return 64;
  if(teamCount<=128&&teamCount>64)return 128;
  return null;
}
function applyTeamsToInput(teams,sourceLabel){
  const size=chooseBestDrawSize(teams.length);
  if(!size) throw new Error(`${teams.length}팀은 지원 범위가 아닙니다. 17~128팀을 사용하세요.`);
  document.getElementById('drawSize').value=String(size);
  document.getElementById('teamImportText').value=teams.map(t=>t.name+(t.affiliation?` | ${t.affiliation}`:'')).join('\n');
  setTeamImportSummary(`${sourceLabel}: ${teams.length}팀 탐지 · 자동 선택 ${size}강 · 부전승 ${size-teams.length}자리`);
}
async function loadTeamFile(file){
  const text=await file.text();
  const teams=parseImportedFileText(text,file.name);
  applyTeamsToInput(teams,file.name);
  ui.msg(`${file.name}에서 ${teams.length}팀을 불러왔습니다. 실제 명단 적용을 누르세요.`,'success');
}
async function load100TestTeams(){
  const res=await fetch('./data/test-teams-100.json?v=1',{cache:'no-store'});
  if(!res.ok) throw new Error('100팀 테스트 명단 파일을 불러오지 못했습니다.');
  const data=await res.json();
  const teams=data.teams.map((v,i)=>({id:`test100_${i+1}`,seed:v.seed||i+1,name:v.name,affiliation:v.affiliation||''}));
  applyTeamsToInput(teams,'부경신인부 100팀 테스트 명단');
  ui.msg('100팀 테스트 명단을 불러왔습니다. 128강과 부전승 28자리가 자동 선택됩니다.','success');
}


function currentDraw(){
  try{return store.get().draw||null;}catch{return null;}
}
function getFirstRoundMatches(draw){
  if(!draw)return [];
  return draw.rounds?.[draw.size]||[];
}
function validateDrawStructure(draw){
  const issues=[],warnings=[];
  if(!draw){issues.push('대진표가 없습니다.');return {ok:false,issues,warnings,metrics:{}};}
  const first=getFirstRoundMatches(draw);
  const expectedMatches=draw.size/2;
  if(first.length!==expectedMatches)issues.push(`1회전 경기 수가 ${expectedMatches}경기가 아닙니다.`);
  const allTeams=[];
  let byeMatches=0, sameGroupMatches=0, emptyMatches=0, doubleEmpty=0;
  const byeSections=new Set();
  first.forEach((m,i)=>{
    const a=m.teamA,b=m.teamB;
    if(!a&&!b){doubleEmpty++;emptyMatches++;return;}
    if(!a||!b){
      byeMatches++;
      byeSections.add(Math.floor(i/8)+1);
    }
    if(a)allTeams.push(a);
    if(b)allTeams.push(b);
    if(a?.groupNo&&b?.groupNo&&a.groupNo===b.groupNo)sameGroupMatches++;
  });

  const seen=new Map(),duplicates=[];
  for(const t of allTeams){
    const key=String(t.id||t.name);
    seen.set(key,(seen.get(key)||0)+1);
  }
  for(const [key,count] of seen)if(count>1)duplicates.push(`${key} × ${count}`);

  if(duplicates.length)issues.push(`중복 배치 팀 ${duplicates.length}건`);
  if(sameGroupMatches)issues.push(`같은 조 1회전 재대결 ${sameGroupMatches}경기`);
  if(byeMatches!==draw.byeCount)issues.push(`부전승 수 불일치: 예상 ${draw.byeCount}, 실제 ${byeMatches}`);
  if(doubleEmpty)warnings.push(`양쪽 모두 빈 경기 ${doubleEmpty}경기`);
  if(draw.byeCount>0){
    const sectionCount=Math.ceil(expectedMatches/8);
    const minSections=Math.min(sectionCount,draw.byeCount);
    if(byeSections.size<Math.max(1,Math.floor(minSections*.6))){
      warnings.push('부전승이 특정 구간에 몰려 있습니다.');
    }
  }

  const firstRoundPlayable=first.filter(m=>m.teamA&&m.teamB).length;
  const completeByes=first.filter(m=>m.bye&&m.status===STATUS.COMPLETED).length;
  const metrics={
    drawSize:draw.size,
    teamCount:draw.teamCount,
    byeCount:draw.byeCount,
    actualByeMatches:byeMatches,
    playableMatches:firstRoundPlayable,
    autoAdvancedByes:completeByes,
    sameGroupMatches,
    duplicates:duplicates.length,
    byeSectionCount:byeSections.size,
    policy:draw.byePolicy||'unknown'
  };
  return {ok:issues.length===0,issues,warnings,metrics,duplicates};
}
function renderDrawValidation(result){
  const summary=document.getElementById('drawValidationSummary');
  const details=document.getElementById('drawValidationDetails');
  if(!summary||!details)return;
  const cls=result.ok?(result.warnings.length?'warn':'ok'):'bad';
  summary.className=`draw-validation-summary ${cls}`;
  summary.textContent=result.ok
    ?(result.warnings.length?`검증 통과 · 주의 ${result.warnings.length}건`:'검증 통과 · 주요 오류 없음')
    :`검증 실패 · 오류 ${result.issues.length}건`;

  const m=result.metrics||{};
  const cards=[
    ['대진 규모',`${m.drawSize||'-'}강`,`참가 ${m.teamCount||0}팀`],
    ['부전승',`${m.actualByeMatches??0}경기`,`예상 ${m.byeCount??0}경기`],
    ['실제 1회전',`${m.playableMatches??0}경기`,`부전승 자동진출 ${m.autoAdvancedByes??0}`],
    ['재대결 검사',`${m.sameGroupMatches??0}경기`,`같은 조 1위·2위`],
    ['중복 배치',`${m.duplicates??0}건`,`동일 팀 중복 여부`],
    ['부전승 분포',`${m.byeSectionCount??0}개 구간`,`8경기 단위 구간`],
  ];
  let html=cards.map(c=>`<div class="validation-card"><strong>${c[0]}: ${c[1]}</strong><small>${c[2]}</small></div>`).join('');
  if(result.issues.length)html+=`<div class="validation-card"><strong>오류</strong><ul class="validation-list">${result.issues.map(v=>`<li>${safeText(v)}</li>`).join('')}</ul></div>`;
  if(result.warnings.length)html+=`<div class="validation-card"><strong>주의</strong><ul class="validation-list">${result.warnings.map(v=>`<li>${safeText(v)}</li>`).join('')}</ul></div>`;
  details.innerHTML=html;
}
function validateCurrentDraw(showToast=true){
  const result=validateDrawStructure(currentDraw());
  renderDrawValidation(result);
  if(showToast)ui.msg(result.ok?'대진 검증을 완료했습니다.':'대진 검증에서 오류가 발견됐습니다.',result.ok?'success':'error');
  return result;
}
function isDrawLocked(){
  try{return !!store.get().drawLocked;}catch{return false;}
}
function syncDrawLockUI(){
  const locked=isDrawLocked();
  document.body.classList.toggle('draw-locked',locked);
  const badge=document.getElementById('drawLockBadge');
  const btn=document.getElementById('toggleDrawLockBtn');
  if(badge){
    badge.textContent=locked?'대진 잠금됨':'잠금 해제';
    badge.className=`bridge-chip ${locked?'ok':'warn'}`;
  }
  if(btn)btn.textContent=locked?'대진 잠금 해제':'대진 잠금';
}
function toggleDrawLock(){
  const locked=isDrawLocked();
  if(!locked){
    const result=validateCurrentDraw(false);
    if(!result.ok){ui.msg('검증 오류가 있어 잠글 수 없습니다.','error');return;}
  }
  store.update(s=>{s.drawLocked=!locked;});
  syncDrawLockUI();
  ui.msg(!locked?'대진을 잠갔습니다.':'대진 잠금을 해제했습니다.','success');
}
function exportDrawAudit(){
  const draw=currentDraw();
  if(!draw){ui.msg('저장할 대진표가 없습니다.','error');return;}
  const validation=validateDrawStructure(draw);
  const report={
    generatedAt:new Date().toISOString(),
    version:'1.6.0',
    validation,
    drawSummary:{
      id:draw.id,size:draw.size,teamCount:draw.teamCount,byeCount:draw.byeCount,
      byePolicy:draw.byePolicy,createdAt:draw.createdAt,locked:isDrawLocked()
    },
    byeTeams:draw.byeTeams||[],
    firstRound:getFirstRoundMatches(draw).map(m=>({
      matchNo:m.matchNo,
      teamA:m.teamA?.name||null,
      teamB:m.teamB?.name||null,
      teamAGroup:m.teamA?.groupNo||null,
      teamBGroup:m.teamB?.groupNo||null,
      bye:!!m.bye,
      status:m.status
    }))
  };
  downloadJson(`230match-draw-audit-${Date.now()}.json`,report);
}
function guardDrawMutation(actionName){
  if(isDrawLocked()){
    ui.msg(`대진이 잠겨 있어 ${actionName}을 실행할 수 없습니다.`,'error');
    return false;
  }
  return true;
}

const actions={
  getState:()=>store.get(),
  newDraw(){
    if(!guardDrawMutation('새 본선 추첨'))return;
    const size=Number(document.getElementById('drawSize').value);
    const count=Number(document.getElementById('courtCount').value);
    const prefix=document.getElementById('courtPrefix').value.trim()||'국제';
    store.set(initialState(size,count,prefix));ui.msg(`${size}팀 본선 대진을 새로 생성했습니다.`,'success');
  },
  assign(){store.update(s=>initialAssign(s));ui.msg('코트별 시합중 1경기, 대기1 1경기까지 균등 배정했습니다.','success');},
  refreshQueue(){
    if(!guardDrawMutation('본선 큐 갱신'))return;store.update(s=>{enqueueNewReadyMatches(s);refreshQueue(s);});ui.msg('본선 큐를 갱신했습니다.','success');},
  toggleAuto(){store.update(s=>{s.autoAssign=!s.autoAssign;});},
  resetDemo(){store.clear();store.set(initialState());ui.msg('데모 데이터를 초기화했습니다.','info');},
  export(){downloadJson(`230match-main-v2-${Date.now()}.json`,store.get());},
  async import(file){
    if(!file)return;
    try{const data=JSON.parse(await file.text());store.set(data);ui.msg('JSON 데이터를 불러왔습니다.','success');}
    catch(e){ui.msg(`가져오기 실패: ${e.message}`,'error');}
  },
  saveResult(matchId,a,b){
    try{
      store.update(s=>{applyResult(s.draw,matchId,a,b);completeAndAdvanceQueue(s,matchId);});
      ui.closeResult();ui.msg(`결과 ${a}:${b} 저장 및 다음 라운드/큐 반영 완료`,'success');
    }catch(e){ui.msg(e.message,'error');}
  },
  importTeamText(){
    if(!guardDrawMutation('실제 명단 적용'))return;
    try{
      const size=Number(document.getElementById('drawSize').value);
      const teams=parseTeamLines(document.getElementById('teamImportText').value);
      if(teams.length>size) throw new Error(`선택한 ${size}강보다 입력 팀 수 ${teams.length}팀이 많습니다.`);
      if(teams.length<=size/2) throw new Error(`${size}강에는 최소 ${size/2+1}팀이 필요합니다. 더 작은 대진 규모를 선택하세요.`);
      const count=Number(document.getElementById('courtCount').value);
      const prefix=document.getElementById('courtPrefix').value.trim()||'국제';
      const next=initialState(size,count,prefix);
      next.draw=createBracket(size,teams);
      store.set(next);
      const policy=document.getElementById('byePolicy')?.value||'group_rank_balanced';
      setTeamImportSummary(`${teams.length}팀 명단으로 ${size}강 대진 생성 · 부전승 ${size-teams.length}자리 · ${policy==='group_rank_balanced'?'조 1위 우선 균등 배치':'전체 균등 무작위'}`);
      ui.msg('실제 팀 명단을 적용했습니다.','success');
    }catch(e){ui.msg(e.message,'error');}
  },
  scanLegacy(){
    const teams=readLegacyCandidates();
    document.getElementById('teamImportText').value=teams.map(t=>t.name+(t.affiliation?` | ${t.affiliation}`:'')).join('\n');
    setTeamImportSummary(teams.length?`같은 도메인의 로컬 저장소에서 ${teams.length}팀 후보를 찾았습니다.`:'기존 앱 로컬 저장소에서 팀 명단을 찾지 못했습니다.');
    ui.msg(teams.length?'기존 앱 후보 명단을 불러왔습니다. 검토 후 적용하세요.':'자동 탐색 결과가 없습니다. 명단을 붙여넣으세요.',teams.length?'success':'info');
  },
  loadSampleTeams(){
    const size=Number(document.getElementById('drawSize').value);
    const names=Array.from({length:size},(_,i)=>`${i+1}번 실제선수A / ${i+1}번 실제선수B`);
    document.getElementById('teamImportText').value=names.join('\n');
    setTeamImportSummary(`${size}팀 입력 예시를 채웠습니다.`);
  }
};
const ui=new UI(actions);
document.getElementById('applyTeamTextBtn').onclick=()=>actions.importTeamText();
document.getElementById('scanLegacyBtn').onclick=()=>actions.scanLegacy();
document.getElementById('sampleTeamsBtn').onclick=()=>actions.loadSampleTeams();
document.getElementById('openLegacyBtn').onclick=openLegacyApp;
document.getElementById('scanLegacyWindowBtn').onclick=scanLegacyWindow;
document.getElementById('scanCurrentPageBtn').onclick=scanCurrentPageStorage;
document.getElementById('exportDiagnosticBtn').onclick=exportBridgeDiagnostic;
document.getElementById('bridgeCandidateSelect').onchange=renderCandidatePreview;
document.getElementById('useBridgeCandidateBtn').onclick=()=>useCandidate(false);
document.getElementById('useExactLegacyDrawBtn').onclick=useExactLegacyDraw;
document.getElementById('teamFileInput').onchange=async(e)=>{
  const file=e.target.files?.[0]; if(!file)return;
  try{await loadTeamFile(file);}catch(err){ui.msg(err.message,'error');}
  e.target.value='';
};
document.getElementById('validateDrawBtn').onclick=()=>validateCurrentDraw(true);
document.getElementById('toggleDrawLockBtn').onclick=toggleDrawLock;
document.getElementById('exportDrawAuditBtn').onclick=exportDrawAudit;
document.getElementById('load100TestTeamsBtn').onclick=async()=>{
  try{await load100TestTeams();}catch(err){ui.msg(err.message,'error');}
};
document.getElementById('buildRankedTeamsBtn').onclick=()=>copyCandidateToText(true);
document.getElementById('copyCandidateTextBtn').onclick=()=>copyCandidateToText(false);
store.subscribe(state=>ui.render(state));
if(!store.load()) store.emit();
setTimeout(()=>{syncDrawLockUI();if(currentDraw())validateCurrentDraw(false);},0);
console.info(`[MAIN-V2] engine 1.6.0 draw validation and lock loaded`);

