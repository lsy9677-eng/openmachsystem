'use strict';
/* 230MATCH MAIN V2 bundled hotfix
   Single classic script: avoids ES-module MIME/path failures on static hosting.
*/

/* ===== constants.js ===== */
const VERSION = '1.0.0';
const STORAGE_KEY = '230MATCH_MAIN_V2_STATE';
const HISTORY_KEY = '230MATCH_MAIN_V2_HISTORY';
const HISTORY_LIMIT = 20;
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
function readHistory(){
  try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');}catch{return [];}
}
function writeHistory(items){
  localStorage.setItem(HISTORY_KEY,JSON.stringify(items.slice(-HISTORY_LIMIT)));
}
function pushHistory(label,state){
  const items=readHistory();
  items.push({id:uid('hist'),label,createdAt:nowIso(),state:clone(state)});
  writeHistory(items);
}
function popHistory(){
  const items=readHistory();
  const item=items.pop()||null;
  writeHistory(items);
  return item;
}
function clearHistory(){localStorage.removeItem(HISTORY_KEY);}
function historyCount(){return readHistory().length;}



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
  // 부전승 자동진출은 최초 라운드에서만 실행한다.
  // 이후 라운드의 한쪽 슬롯만 채워진 상태는 '상대 경기 결과 대기'이지 부전승이 아니다.
  const firstRound=draw.rounds?.[draw.size]||[];
  for(const m of firstRound){
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
  }
}

function repairInvalidByePropagation(draw){
  if(!draw?.rounds)return 0;
  let repaired=0;
  const sizes=Object.keys(draw.rounds).map(Number).filter(size=>size<draw.size).sort((a,b)=>a-b);

  // 결승 쪽부터 거꾸로 정리하여 잘못 전파된 팀을 안전하게 제거한다.
  for(const size of sizes){
    for(const m of draw.rounds[size]){
      const hasOneTeam=!!m.teamA!==!!m.teamB;
      const noRealScore=(m.scoreA==null&&m.scoreB==null);
      const fakeBye=(m.bye===true&&m.status===STATUS.COMPLETED&&hasOneTeam&&noRealScore);
      if(!fakeBye)continue;

      const fakeWinnerId=m.winnerId;
      if(m.nextMatchId&&fakeWinnerId){
        const next=getMatch(draw,m.nextMatchId);
        if(next){
          if(next.teamA?.id===fakeWinnerId)next.teamA=null;
          if(next.teamB?.id===fakeWinnerId)next.teamB=null;
          if(next.winnerId===fakeWinnerId){
            next.winnerId=null;
            next.scoreA=null;
            next.scoreB=null;
            next.completedAt=null;
            next.bye=false;
            next.status=(next.teamA&&next.teamB)?STATUS.UNASSIGNED:STATUS.WAITING_SLOTS;
          }
        }
      }

      m.winnerId=null;
      m.scoreA=null;
      m.scoreB=null;
      m.completedAt=null;
      m.bye=false;
      m.status=(m.teamA&&m.teamB)?STATUS.UNASSIGNED:STATUS.WAITING_SLOTS;
      repaired++;
    }
  }
  return repaired;
}

function repairLoadedStateIfNeeded(){
  const state=store.get();
  if(!state?.draw)return 0;
  const repaired=repairInvalidByePropagation(state.draw);
  if(repaired>0){
    store.set(state);
    ui.msg(`잘못 자동진출된 후속 라운드 ${repaired}경기를 복구했습니다.`,'success');
  }
  return repaired;
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


function detachMatchFromOperations(state,match){
  if(!match)return;
  state.sharedQueue=(state.sharedQueue||[]).filter(id=>id!==match.id);
  for(const court of state.courts||[]){
    if(court.playing===match.id)court.playing=null;
    if(court.wait1===match.id)court.wait1=null;
  }
  match.venue='';
  match.court='';
  match.queueOrder=null;
  match.startedAt=null;
}
function clearDownstreamChain(state,sourceMatch){
  let current=sourceMatch;
  let cleared=0;
  while(current?.nextMatchId){
    const next=getMatch(state.draw,current.nextMatchId);
    if(!next)break;

    detachMatchFromOperations(state,next);

    const propagatedId=current.winnerId;
    if(current.nextSlot==='A'){
      if(!propagatedId || next.teamA?.id===propagatedId)next.teamA=null;
    }else{
      if(!propagatedId || next.teamB?.id===propagatedId)next.teamB=null;
    }

    const hadProgress=
      next.winnerId!=null ||
      next.scoreA!=null ||
      next.scoreB!=null ||
      next.status===STATUS.COMPLETED ||
      next.status===STATUS.PLAYING ||
      next.status===STATUS.WAIT1 ||
      next.status===STATUS.SHARED;

    if(hadProgress){
      next.winnerId=null;
      next.scoreA=null;
      next.scoreB=null;
      next.completedAt=null;
      next.bye=false;
      next.status=(next.teamA&&next.teamB)?STATUS.UNASSIGNED:STATUS.WAITING_SLOTS;
      cleared++;
    }else{
      next.status=(next.teamA&&next.teamB)?STATUS.UNASSIGNED:STATUS.WAITING_SLOTS;
    }

    current=next;
  }
  normalizeQueueOrders(state);
  return cleared;
}
function downstreamProgressCount(state,match){
  let count=0,current=match;
  while(current?.nextMatchId){
    const next=getMatch(state.draw,current.nextMatchId);
    if(!next)break;
    if(next.winnerId!=null || next.scoreA!=null || next.scoreB!=null ||
       [STATUS.PLAYING,STATUS.WAIT1,STATUS.SHARED,STATUS.COMPLETED].includes(next.status)) count++;
    current=next;
  }
  return count;
}
function applyResultSafely(state,matchId,scoreA,scoreB){
  const m=getMatch(state.draw,matchId);
  if(!m)throw new Error('경기를 찾지 못했습니다.');

  const editingExisting=m.status===STATUS.COMPLETED && m.winnerId;
  let cleared=0;
  if(editingExisting){
    cleared=clearDownstreamChain(state,m);
    m.status=STATUS.UNASSIGNED;
    m.completedAt=null;
    m.winnerId=null;
    m.scoreA=null;
    m.scoreB=null;
  }

  const result=applyResult(state.draw,matchId,scoreA,scoreB);
  completeAndAdvanceQueue(state,matchId);
  return {...result,cleared};
}

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
    this.$('snapshotBtn').onclick=()=>this.actions.snapshot();
    this.$('undoBtn').onclick=()=>this.actions.undo();
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
    this.$('scoreA').value=m.scoreA??'';this.$('scoreB').value=m.scoreB??'';
    const warning=this.$('resultWarning');
    const downstream=downstreamProgressCount(this.actions.getState(),m);
    if(m.status===STATUS.COMPLETED){
      warning.hidden=false;
      warning.textContent=downstream
        ?`결과를 수정하면 이후 라운드 ${downstream}경기의 결과·배정이 자동 취소됩니다.`
        :'저장된 결과를 수정합니다. 승자가 바뀌면 다음 라운드 슬롯도 함께 변경됩니다.';
    }else{
      warning.hidden=true;warning.textContent='';
    }
    this.$('resultDialog').showModal();
  }
  closeResult(){this.$('resultDialog').close();this.activeMatchId=null;}
}




/* ===== read-only legacy bridge v1.2 ===== */
const BridgeState={legacyWindow:null,candidates:[],diagnostic:null,direct:null,directReport:null};

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
  next.importedTeams=teams.map(t=>({...t}));
  next.importedSource='legacyExactAdapter';
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



/* ===== v1.9 deterministic legacy read-only bridge ===== */
function getLegacyWindowOrThrow(){
  const w=BridgeState.legacyWindow;
  if(!w||w.closed)throw new Error('기존 앱 창이 열려 있지 않습니다.');
  if(w.location.origin!==location.origin)throw new Error('기존 앱과 V2가 동일한 도메인이 아닙니다.');
  if(!w.G||!Array.isArray(w.G.tournaments))throw new Error('기존 앱 데이터(window.G)가 아직 준비되지 않았습니다.');
  return w;
}
function legacyTeamName(w,key,teamIndex){
  try{
    const team=w.G?.teams?.[key]?.[teamIndex];
    if(!team)return '';
    if(Array.isArray(team.individualPlayers)&&team.individualPlayers.length){
      return team.individualPlayers.slice(0,2).map(p=>String(p?.name||'').trim()).filter(Boolean).join(' / ');
    }
    if(Array.isArray(team.players)&&team.players.length){
      return team.players.slice(0,2).map(p=>typeof p==='string'?p:String(p?.name||'')).map(v=>v.trim()).filter(Boolean).join(' / ');
    }
    if(typeof w.tdn==='function')return String(w.tdn(team,key,teamIndex)||'').trim();
    return String(team.pairLabel||team.entryLabel||team.name||team.club||'').trim();
  }catch{return '';}
}
function legacyTeamAffiliation(w,key,teamIndex){
  try{
    const team=w.G?.teams?.[key]?.[teamIndex]||{};
    return String(team.club||team.affiliation||team.organization||'').trim();
  }catch{return '';}
}
function legacyGroupVenue(w,key,draw,gi){
  try{
    const grp=draw?.groups?.[gi];
    const court=String(
      (Array.isArray(grp?.courts)&&grp.courts[0])||
      grp?.court||grp?.manualCourt||grp?.manualCourtTarget||''
    ).trim();
    if(court)return court;
    const ms=(w.G?.matches?.[key]||[]).filter(m=>m&&m.phase==='group'&&Number(m.group)===Number(gi));
    for(const m of ms){
      const value=String((Array.isArray(m.courts)&&m.courts[0])||m.court||m.manualCourtTarget||'').trim();
      if(value)return value;
    }
  }catch{}
  return '';
}
function legacyMatchDone(w,key,m){
  try{
    if(typeof w.getMatchResultState==='function')return !!w.getMatchResultState(key,m)?.done;
  }catch{}
  return m?.winner!=null || (Number.isFinite(Number(m?.s1))&&Number.isFinite(Number(m?.s2)));
}
function legacyDivisionSnapshot(w,tid,div){
  const key=`${tid}_${div}`;
  const tournament=(w.G.tournaments||[]).find(t=>String(t.id)===String(tid));
  const draw=w.G.draws?.[key]||{};
  const teams=w.G.teams?.[key]||[];
  const matches=w.G.matches?.[key]||[];
  const groups=Array.isArray(draw.groups)?draw.groups:[];
  let cfg={};
  try{if(typeof w.gDS==='function')cfg=w.gDS(tournament,div)||{};}catch{}
  const defaultAdvance=Math.max(1,Number(draw.advance||cfg.advance||2));
  const qualifiers=[];
  const groupRows=[];
  const courtSet=new Set();

  groups.forEach((grp,gi)=>{
    const teamIds=Array.isArray(grp?.teams)?grp.teams:[];
    const groupMatches=matches.filter(m=>m&&m.phase==='group'&&Number(m.group)===Number(gi));
    const done=groupMatches.length>0 && groupMatches.every(m=>legacyMatchDone(w,key,m));
    const venue=legacyGroupVenue(w,key,draw,gi);
    if(venue)courtSet.add(venue);
    const advCount=teamIds.length<=2?teamIds.length:defaultAdvance;
    let standings=[];
    try{
      if(typeof w.calcGS==='function')standings=w.calcGS(key,gi,teamIds,teams)||[];
    }catch{}
    const top=done?standings.slice(0,advCount):[];
    const confirmed=top.map((row,idx)=>{
      const ti=row?.ti;
      const name=String(row?.nm||legacyTeamName(w,key,ti)||'').trim();
      return {
        id:`legacy_${key}_g${gi+1}_r${idx+1}`,
        seed:qualifiers.length+idx+1,
        name,
        affiliation:legacyTeamAffiliation(w,key,ti),
        groupNo:gi+1,
        groupRank:idx+1,
        venue,
        teamIndex:ti,
        sourceKey:key
      };
    }).filter(x=>x.name);
    qualifiers.push(...confirmed);
    groupRows.push({
      groupNo:gi+1,
      teamCount:teamIds.length,
      matchCount:groupMatches.length,
      completedMatches:groupMatches.filter(m=>legacyMatchDone(w,key,m)).length,
      done,
      venue,
      qualifiers:confirmed
    });
  });

  const allGroupsDone=groups.length>0&&groupRows.every(g=>g.done);
  return {
    readOnly:true,
    scannedAt:new Date().toISOString(),
    tournamentId:tid,
    tournamentName:tournament?.name||tid,
    division:div,
    key,
    groupCount:groups.length,
    completedGroupCount:groupRows.filter(g=>g.done).length,
    teamCount:teams.length,
    groupMatchCount:matches.filter(m=>m&&m.phase==='group').length,
    allGroupsDone,
    qualifiers,
    courts:[...courtSet],
    groups:groupRows
  };
}
function loadLegacyTournamentStructure(){
  try{
    const w=getLegacyWindowOrThrow();
    const tournaments=(w.G.tournaments||[]).map(t=>({
      id:String(t.id),
      name:String(t.name||t.title||t.id),
      divisions:Array.isArray(t.divisions)?t.divisions.map(String):[]
    }));
    BridgeState.direct={tournaments};
    const ts=document.getElementById('legacyTournamentSelect');
    ts.innerHTML=tournaments.length
      ?tournaments.map(t=>`<option value="${safeText(t.id)}">${safeText(t.name)}</option>`).join('')
      :'<option value="">대회 없음</option>';
    populateLegacyDivisions();
    setBridgeChip('legacyDirectModeBadge','읽기 전용 연결됨',true);
    bridgeLog(`구조 직접 읽기 완료: 대회 ${tournaments.length}개`);
    ui.msg(`기존 앱 대회 ${tournaments.length}개를 읽었습니다.`,'success');
  }catch(e){
    setBridgeChip('legacyDirectModeBadge','연결 실패',false);
    ui.msg(e.message,'error');
    bridgeLog(`구조 직접 읽기 실패: ${e.message}`);
  }
}
function populateLegacyDivisions(){
  const ts=document.getElementById('legacyTournamentSelect');
  const ds=document.getElementById('legacyDivisionSelect');
  const t=BridgeState.direct?.tournaments?.find(x=>x.id===ts.value);
  const divs=t?.divisions||[];
  ds.innerHTML=divs.length
    ?divs.map(d=>`<option value="${safeText(d)}">${safeText(d)}</option>`).join('')
    :'<option value="">부서 없음</option>';
}
function setLegacyStat(id,value){
  const el=document.getElementById(id);if(el)el.textContent=String(value);
}
function renderLegacyDirectReport(report){
  setLegacyStat('legacyGroupCount',report.groupCount);
  setLegacyStat('legacyCompletedGroupCount',report.completedGroupCount);
  setLegacyStat('legacyQualifierCount',report.qualifiers.length);
  setLegacyStat('legacyCourtCount',report.courts.length);
  setLegacyStat('legacyPrelimStatus',report.allGroupsDone?'전체 완료':'진행 중');

  const summary=document.getElementById('legacyDirectSummary');
  summary.textContent=
    `${report.tournamentName} · ${report.division} · 조 ${report.completedGroupCount}/${report.groupCount} 완료 · `+
    `확정 진출 ${report.qualifiers.length}팀 · 코트 ${report.courts.join(', ')||'미확인'}`;

  const preview=document.getElementById('legacyDirectPreview');
  const pending=report.groups.filter(g=>!g.done);
  const note=pending.length
    ?`<div class="legacy-direct-preview-note">미완료 조 ${pending.length}개는 명단에 포함하지 않았습니다. 기존 앱에서 결과가 확정된 뒤 새로고침하세요.</div>`
    :'';
  const rows=report.groups.map(g=>{
    const q1=g.qualifiers[0]?.name||'-';
    const q2=g.qualifiers[1]?.name||'-';
    return `<tr class="${g.done?'':'legacy-direct-row-pending'}">
      <td>${g.groupNo}조</td>
      <td>${g.done?'완료':'진행 중'}</td>
      <td>${g.completedMatches}/${g.matchCount}</td>
      <td>${safeText(g.venue||'')}</td>
      <td>${safeText(q1)}</td>
      <td>${safeText(q2)}</td>
    </tr>`;
  }).join('');
  preview.innerHTML=note+`<table><thead><tr><th>조</th><th>상태</th><th>경기</th><th>코트</th><th>1위</th><th>2위</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function inspectLegacySelectedDivision(showToast=true){
  try{
    const w=getLegacyWindowOrThrow();
    const tid=document.getElementById('legacyTournamentSelect').value;
    const div=document.getElementById('legacyDivisionSelect').value;
    if(!tid||!div)throw new Error('대회와 부서를 선택하세요.');
    const report=legacyDivisionSnapshot(w,tid,div);
    BridgeState.directReport=report;
    renderLegacyDirectReport(report);
    setBridgeChip('legacyDirectModeBadge','읽기 전용 정상',true);
    bridgeLog(`직접 진단: ${report.key} / 완료 조 ${report.completedGroupCount}/${report.groupCount} / 진출 ${report.qualifiers.length}팀`);
    if(showToast)ui.msg(`확정 진출팀 ${report.qualifiers.length}팀을 읽었습니다.`,'success');
    return report;
  }catch(e){
    if(showToast)ui.msg(e.message,'error');
    bridgeLog(`선택 부서 진단 실패: ${e.message}`);
    return null;
  }
}
function copyLegacyQualifiers(){
  const report=inspectLegacySelectedDivision(false)||BridgeState.directReport;
  if(!report||!report.qualifiers.length){ui.msg('복사할 확정 진출팀이 없습니다.','error');return;}
  const text=report.qualifiers
    .sort((a,b)=>a.groupNo-b.groupNo||a.groupRank-b.groupRank)
    .map(t=>t.name+(t.affiliation?` | ${t.affiliation}`:''))
    .join('\n');
  document.getElementById('teamImportText').value=text;
  setTeamImportSummary(`${report.key}에서 결과가 확정된 ${report.qualifiers.length}팀을 읽기 전용으로 복사했습니다.`);
  ui.msg(`${report.qualifiers.length}팀을 명단 입력창에 복사했습니다.`,'success');
}
function applyLegacyQualifiers(){
  if(!guardDrawMutation('기존 앱 진출팀 적용'))return;
  const report=inspectLegacySelectedDivision(false)||BridgeState.directReport;
  if(!report||!report.qualifiers.length){ui.msg('적용할 확정 진출팀이 없습니다.','error');return;}
  if(!report.allGroupsDone){
    ui.msg(`예선 미완료 조가 ${report.groupCount-report.completedGroupCount}개 있습니다. 전체 완료 후 적용하세요.`,'error');
    return;
  }
  const teams=report.qualifiers
    .sort((a,b)=>a.groupNo-b.groupNo||a.groupRank-b.groupRank)
    .map((t,i)=>({...t,seed:i+1}));
  const size=chooseBestDrawSize(teams.length);
  if(!size){ui.msg(`${teams.length}팀은 지원 대진 범위가 아닙니다.`,'error');return;}
  const count=Number(document.getElementById('courtCount').value);
  const prefix=document.getElementById('courtPrefix').value.trim()||'국제';
  const next=initialState(size,count,prefix);
  next.draw=createBracket(size,teams);
  next.importedTeams=teams.map(t=>({...t}));
  next.importedSource='legacy-readonly-direct';
  next.bridgeSource={
    mode:'readonly',
    key:report.key,
    tournamentId:report.tournamentId,
    tournamentName:report.tournamentName,
    division:report.division,
    scannedAt:report.scannedAt,
    groupCount:report.groupCount,
    qualifierCount:teams.length,
    courts:report.courts
  };
  next.drawLocked=false;
  store.set(next);
  document.getElementById('drawSize').value=String(size);
  document.getElementById('teamImportText').value=teams.map(t=>t.name+(t.affiliation?` | ${t.affiliation}`:'')).join('\n');
  setTeamImportSummary(`${report.tournamentName} · ${report.division}의 실제 진출 ${teams.length}팀을 V2에 적용했습니다.`);
  setTimeout(()=>{validateCurrentDraw(false);syncDrawLockUI();},0);
  ui.msg(`기존 앱 실제 진출팀 ${teams.length}팀을 V2에 적용했습니다.`,'success');
}
function exportLegacyDirectReport(){
  const report=inspectLegacySelectedDivision(false)||BridgeState.directReport;
  if(!report){ui.msg('저장할 읽기 전용 진단 결과가 없습니다.','error');return;}
  downloadJson(`230match-legacy-readonly-${report.key}-${Date.now()}.json`,report);
}



/* ===== v1.10 Firebase shadow test store ===== */
const ShadowStore={
  config:{
    apiKey:'AIzaSyAbc17RiYyxCqgbMBkxkMoiRdNTmy2q65w',
    authDomain:'open-match-manager.firebaseapp.com',
    projectId:'open-match-manager',
    storageBucket:'open-match-manager.firebasestorage.app',
    messagingSenderId:'195671806262',
    appId:'1:195671806262:web:89691574839266cea1a397',
    collection:'mainV2ShadowTests'
  },
  token:'',
  auth:null,
  authUser:null,
  authReady:false,
  mode:'disconnected',
  snapshots:[],
  selected:null,
  localKey:'230match-main-v2-shadow-snapshots-v1'
};
function shadowSetBadge(text,type='off'){
  const el=document.getElementById('shadowStoreBadge');
  if(!el)return;
  el.textContent=text;
  el.classList.remove('shadow-off','shadow-ok','shadow-warn','shadow-error');
  el.classList.add(`shadow-${type}`);
}
function shadowSetStatus(text,type=''){
  const el=document.getElementById('shadowStoreStatus');
  if(!el)return;
  el.textContent=text;
  el.className='import-summary'+(type?` ${type}`:'');
}
function shadowValue(id){return String(document.getElementById(id)?.value||'').trim();}
function shadowSetValue(id,value){const el=document.getElementById(id);if(el)el.value=value||'';}
function shadowSafeName(value){
  return String(value||'').trim().replace(/[^a-zA-Z0-9가-힣_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
}
function shadowNowName(){
  const state=store.get();
  const source=state.bridgeSource;
  const key=source?.key||source?.division||'manual';
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  return shadowSafeName(`${key}-${stamp}`);
}
function shadowCurrentPayload(){
  const state=JSON.parse(JSON.stringify(store.get()));
  const source=state.bridgeSource||null;
  const summary={
    round:currentRoundLabel(state),
    drawSize:Number(state.draw?.size||0),
    matchCount:Array.isArray(state.draw?.matches)?state.draw.matches.length:0,
    completed:Array.isArray(state.draw?.matches)?state.draw.matches.filter(m=>m?.status==='completed').length:0,
    playing:Array.isArray(state.draw?.matches)?state.draw.matches.filter(m=>m?.status==='playing').length:0,
    courtWait:Array.isArray(state.draw?.matches)?state.draw.matches.filter(m=>m?.status==='court_wait1').length:0,
    sharedQueue:Array.isArray(state.draw?.matches)?state.draw.matches.filter(m=>m?.status==='shared_queue').length:0
  };
  return {
    schemaVersion:'230match-main-v2-shadow-v1',
    readOnlySource:true,
    shadowOnly:true,
    savedAt:new Date().toISOString(),
    source,
    summary,
    state
  };
}
function currentRoundLabel(state){
  try{
    if(typeof getCurrentRoundLabel==='function')return getCurrentRoundLabel(state);
  }catch{}
  const size=Number(state?.draw?.size||0);
  return size?`${size}강`:'-';
}
function shadowUpdateStats(payload){
  document.getElementById('shadowModeStat').textContent=ShadowStore.mode||'-';
  document.getElementById('shadowSourceStat').textContent=
    payload?.source?.key||payload?.source?.division||payload?.state?.importedSource||'-';
  document.getElementById('shadowDrawStat').textContent=
    payload?.summary?.drawSize?`${payload.summary.drawSize}강 · ${payload.summary.matchCount}경기`:'-';
  document.getElementById('shadowSavedAtStat').textContent=
    payload?.savedAt?new Date(payload.savedAt).toLocaleString():'-';
}
async function shadowDiscoverConfig(){
  try{
    const w=BridgeState.legacyWindow;
    let cfg=null;
    if(w&&!w.closed){
      try{
        if(w.firebase?.apps?.length)cfg=w.firebase.app().options;
      }catch{}
      if(!cfg){
        const candidates=[
          w.FB,w.firebaseConfig,w.FIREBASE_CONFIG,w.__firebase_config,
          w.appConfig?.firebase,w.G?.firebaseConfig
        ];
        cfg=candidates.find(v=>v&&typeof v==='object'&&v.projectId);
      }
    }
    cfg={
      apiKey:cfg?.apiKey||ShadowStore.config.apiKey,
      authDomain:cfg?.authDomain||ShadowStore.config.authDomain,
      projectId:cfg?.projectId||ShadowStore.config.projectId,
      storageBucket:cfg?.storageBucket||ShadowStore.config.storageBucket,
      messagingSenderId:cfg?.messagingSenderId||ShadowStore.config.messagingSenderId,
      appId:cfg?.appId||ShadowStore.config.appId
    };
    ShadowStore.config={...ShadowStore.config,...cfg};
    shadowSetValue('shadowProjectId',cfg.projectId);
    shadowSetValue('shadowApiKey',cfg.apiKey);
    shadowSetBadge('Firebase 설정 준비','warn');
    shadowSetStatus(`프로젝트 ${cfg.projectId} 설정을 준비했습니다. 이제 로그인 세션 연결을 누르세요.`);
    return cfg;
  }catch(e){
    shadowSetBadge('탐색 실패','error');
    shadowSetStatus(e.message,'error');
    throw e;
  }
}
function shadowReadConfig(){
  const projectId=shadowValue('shadowProjectId');
  const apiKey=shadowValue('shadowApiKey');
  const collection=shadowSafeName(shadowValue('shadowCollection')||'mainV2ShadowTests');
  if(!projectId)throw new Error('Firebase Project ID가 필요합니다.');
  if(!collection)throw new Error('전용 컬렉션 이름이 필요합니다.');
  ShadowStore.config={...ShadowStore.config,projectId,apiKey,collection};
  return ShadowStore.config;
}

function shadowAuthUI(user,message=''){
  const userEl=document.getElementById('shadowAuthUser');
  const badge=document.getElementById('shadowAuthBadge');
  if(userEl)userEl.textContent=user?(user.email||user.uid):'미연결';
  if(badge){
    badge.textContent=user?'인증됨':'토큰 없음';
    badge.classList.toggle('ok',!!user);
    badge.classList.toggle('warn',!user);
  }
  if(message)shadowSetStatus(message,user?'success':'');
}
function shadowWaitForAuth(auth,timeoutMs=8000){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const timer=setTimeout(()=>{
      if(settled)return;
      settled=true;
      reject(new Error('Firebase 로그인 세션 확인 시간이 초과되었습니다.'));
    },timeoutMs);
    const off=auth.onAuthStateChanged(user=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      off();
      resolve(user||null);
    },err=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      off();
      reject(err);
    });
  });
}
async function shadowConnectAuth(){
  try{
    shadowSetBadge('인증 연결 중','warn');
    if(!window.firebase?.initializeApp)throw new Error('Firebase Auth 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하세요.');
    const cfg=await shadowDiscoverConfig();
    let app;
    try{
      app=window.firebase.apps?.length?window.firebase.app():window.firebase.initializeApp(cfg);
    }catch(e){
      if(String(e?.code||'').includes('duplicate-app'))app=window.firebase.app();
      else throw e;
    }
    const auth=app.auth();
    ShadowStore.auth=auth;
    try{await auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);}catch{}
    let user=auth.currentUser;
    if(!user)user=await shadowWaitForAuth(auth);
    if(!user){
      ShadowStore.token='';
      ShadowStore.authUser=null;
      ShadowStore.authReady=true;
      shadowAuthUI(null,'같은 브라우저의 기존 앱 로그인 세션을 찾지 못했습니다. 기존 앱에서 다시 로그인한 뒤 재시도하세요.');
      shadowSetBadge('로그인 필요','warn');
      return false;
    }
    const token=await user.getIdToken(true);
    if(!token)throw new Error('Firebase ID 토큰을 발급받지 못했습니다.');
    ShadowStore.token=token;
    ShadowStore.authUser={uid:user.uid,email:user.email||'',displayName:user.displayName||''};
    ShadowStore.authReady=true;
    shadowAuthUI(user,`로그인 세션 연결 완료: ${user.email||user.uid}`);
    shadowSetBadge('인증 세션 연결','ok');
    return true;
  }catch(e){
    ShadowStore.token='';
    ShadowStore.authUser=null;
    ShadowStore.authReady=true;
    shadowAuthUI(null,e.message);
    shadowSetBadge('인증 실패','error');
    return false;
  }
}
async function shadowEnsureToken(forceRefresh=false){
  if(!ShadowStore.auth||!ShadowStore.auth.currentUser){
    const ok=await shadowConnectAuth();
    if(!ok)throw new Error('Firebase 로그인 세션이 연결되지 않았습니다.');
  }
  const user=ShadowStore.auth.currentUser;
  const token=await user.getIdToken(!!forceRefresh);
  if(!token)throw new Error('Firebase 인증 토큰이 없습니다.');
  ShadowStore.token=token;
  ShadowStore.authUser={uid:user.uid,email:user.email||'',displayName:user.displayName||''};
  shadowAuthUI(user);
  return token;
}

function shadowFirestoreBase(){
  const {projectId,apiKey,collection}=shadowReadConfig();
  const query=apiKey?`?key=${encodeURIComponent(apiKey)}`:'';
  return {
    list:`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collection)}${query}`,
    document(name){
      return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collection)}/${encodeURIComponent(name)}${query}`;
    }
  };
}
function shadowHeaders(json=true){
  const headers={};
  if(json)headers['Content-Type']='application/json';
  if(ShadowStore.token)headers.Authorization=`Bearer ${ShadowStore.token}`;
  return headers;
}
function shadowToFirestoreFields(value){
  if(value===null||value===undefined)return {nullValue:null};
  if(typeof value==='string')return {stringValue:value};
  if(typeof value==='boolean')return {booleanValue:value};
  if(typeof value==='number'){
    return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};
  }
  if(Array.isArray(value))return {arrayValue:{values:value.map(shadowToFirestoreFields)}};
  if(typeof value==='object'){
    const fields={};
    Object.entries(value).forEach(([k,v])=>{fields[k]=shadowToFirestoreFields(v);});
    return {mapValue:{fields}};
  }
  return {stringValue:String(value)};
}
function shadowFromFirestoreValue(value){
  if(!value)return null;
  if('nullValue'in value)return null;
  if('stringValue'in value)return value.stringValue;
  if('booleanValue'in value)return value.booleanValue;
  if('integerValue'in value)return Number(value.integerValue);
  if('doubleValue'in value)return Number(value.doubleValue);
  if('timestampValue'in value)return value.timestampValue;
  if(value.arrayValue)return (value.arrayValue.values||[]).map(shadowFromFirestoreValue);
  if(value.mapValue){
    const out={};
    Object.entries(value.mapValue.fields||{}).forEach(([k,v])=>out[k]=shadowFromFirestoreValue(v));
    return out;
  }
  return null;
}
function shadowDocToObject(doc){
  const out={};
  Object.entries(doc.fields||{}).forEach(([k,v])=>out[k]=shadowFromFirestoreValue(v));
  out.__name=String(doc.name||'').split('/').pop();
  out.__createTime=doc.createTime||'';
  out.__updateTime=doc.updateTime||'';
  return out;
}
async function shadowTestConnection(){
  try{
    await shadowEnsureToken(true);
    const urls=shadowFirestoreBase();
    shadowSetBadge('권한 검사 중','warn');
    const res=await fetch(`${urls.list}${urls.list.includes('?')?'&':'?'}pageSize=1`,{
      headers:shadowHeaders(false)
    });
    if(res.ok){
      ShadowStore.mode='firebase-authenticated';
      shadowSetBadge('Firebase 인증 연결','ok');
      shadowSetStatus(`로그인 사용자 ${ShadowStore.authUser?.email||ShadowStore.authUser?.uid}의 전용 컬렉션 접근이 정상입니다.`,'success');
      await shadowListSnapshots();
      return true;
    }
    const text=await res.text();
    if(res.status===403){
      ShadowStore.mode='authenticated-forbidden';
      shadowSetBadge('운영자 권한 확인 필요','error');
      shadowSetStatus(
        `로그인은 확인됐지만 mainV2ShadowTests 접근이 거부됐습니다. users/${ShadowStore.authUser?.uid}의 approved 또는 admins 문서를 확인하세요.`,
        'error'
      );
      return false;
    }
    if(res.status===401){
      ShadowStore.token='';
      throw new Error('인증 토큰이 거부되었습니다. 로그인 세션 연결을 다시 누르세요.');
    }
    throw new Error(`연결 실패 HTTP ${res.status}: ${text.slice(0,220)}`);
  }catch(e){
    ShadowStore.mode='local-fallback';
    shadowSetBadge('브라우저 백업 사용','warn');
    shadowSetStatus(`${e.message} 브라우저 백업은 계속 사용할 수 있습니다.`,'error');
    return false;
  }
}
function shadowLocalList(){
  try{return JSON.parse(localStorage.getItem(ShadowStore.localKey)||'[]');}catch{return [];}
}
function shadowLocalWrite(payload,name){
  const list=shadowLocalList().filter(x=>x.name!==name);
  list.unshift({name,payload,savedAt:payload.savedAt,mode:'browser'});
  localStorage.setItem(ShadowStore.localKey,JSON.stringify(list.slice(0,30)));
}
async function shadowSaveLocal(){
  const payload=shadowCurrentPayload();
  const name=shadowSafeName(shadowValue('shadowDocumentName'))||shadowNowName();
  shadowSetValue('shadowDocumentName',name);
  shadowLocalWrite(payload,name);
  ShadowStore.mode='browser';
  shadowSetBadge('브라우저 테스트 저장','ok');
  shadowSetStatus(`브라우저 전용 스냅샷 ${name}을 저장했습니다.`,'success');
  shadowUpdateStats(payload);
  await shadowListSnapshots();
}
async function shadowSaveFirebase(){
  try{
    if(!guardDrawMutation('Firebase 테스트 스냅샷 저장'))return;
    await shadowEnsureToken(true);
    const payload=shadowCurrentPayload();
    const name=shadowSafeName(shadowValue('shadowDocumentName'))||shadowNowName();
    shadowSetValue('shadowDocumentName',name);
    const urls=shadowFirestoreBase();
    const body={fields:{
      schemaVersion:{stringValue:payload.schemaVersion},
      shadowOnly:{booleanValue:true},
      savedAt:{timestampValue:payload.savedAt},
      sourceKey:{stringValue:payload.source?.key||payload.source?.division||payload.state?.importedSource||''},
      drawSize:{integerValue:String(payload.summary.drawSize||0)},
      summary:shadowToFirestoreFields(payload.summary),
      source:shadowToFirestoreFields(payload.source),
      payloadJson:{stringValue:JSON.stringify(payload)}
    }};
    shadowSetBadge('저장 중','warn');
    const res=await fetch(urls.document(name),{
      method:'PATCH',
      headers:shadowHeaders(true),
      body:JSON.stringify(body)
    });
    if(!res.ok){
      const text=await res.text();
      throw new Error(`Firebase 테스트 저장 실패 HTTP ${res.status}: ${text.slice(0,220)}`);
    }
    ShadowStore.mode='firebase';
    shadowSetBadge('Firebase 테스트 저장됨','ok');
    shadowSetStatus(`전용 컬렉션 ${ShadowStore.config.collection}/${name}에 저장했습니다.`,'success');
    shadowUpdateStats(payload);
    await shadowListSnapshots();
  }catch(e){
    shadowSetBadge('저장 실패','error');
    shadowSetStatus(`${e.message} 브라우저 백업 저장을 사용할 수 있습니다.`,'error');
  }
}
async function shadowListSnapshots(){
  const entries=[];
  const local=shadowLocalList();
  local.forEach(x=>entries.push({...x,sourceMode:'browser'}));
  try{
    if(ShadowStore.auth?.currentUser){
      await shadowEnsureToken(false);
      const urls=shadowFirestoreBase();
      const res=await fetch(`${urls.list}${urls.list.includes('?')?'&':'?'}pageSize=30`,{headers:shadowHeaders(false)});
    if(res.ok){
      const json=await res.json();
      (json.documents||[]).forEach(doc=>{
        const obj=shadowDocToObject(doc);
        let payload=null;
        try{payload=JSON.parse(obj.payloadJson||'null');}catch{}
        if(payload)entries.push({name:obj.__name,payload,savedAt:payload.savedAt,sourceMode:'firebase'});
      });
    }
    }
  }catch(e){console.warn('[MAIN-V2] shadow list firebase skipped',e);}
  const unique=new Map();
  entries.sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||''))).forEach(x=>{
    const key=`${x.sourceMode}:${x.name}`;
    if(!unique.has(key))unique.set(key,x);
  });
  ShadowStore.snapshots=[...unique.values()];
  const select=document.getElementById('shadowSnapshotSelect');
  if(!ShadowStore.snapshots.length){
    select.innerHTML='<option value="">저장된 스냅샷 없음</option>';
    document.getElementById('shadowSnapshotPreview').textContent='선택된 스냅샷이 없습니다.';
    return;
  }
  select.innerHTML=ShadowStore.snapshots.map((x,i)=>
    `<option value="${i}">[${x.sourceMode==='firebase'?'Firebase':'브라우저'}] ${safeText(x.name)} · ${new Date(x.savedAt).toLocaleString()}</option>`
  ).join('');
  shadowSelectSnapshot();
}
function shadowSelectSnapshot(){
  const idx=Number(document.getElementById('shadowSnapshotSelect').value);
  const item=ShadowStore.snapshots[idx];
  ShadowStore.selected=item||null;
  document.getElementById('shadowSnapshotPreview').textContent=item
    ?JSON.stringify({name:item.name,mode:item.sourceMode,savedAt:item.savedAt,source:item.payload?.source,summary:item.payload?.summary},null,2)
    :'선택된 스냅샷이 없습니다.';
  if(item)shadowUpdateStats(item.payload);
}
function shadowDownloadSelected(){
  const item=ShadowStore.selected;
  if(!item){ui.msg('선택된 스냅샷이 없습니다.','error');return;}
  downloadJson(`230match-shadow-${item.name}.json`,item.payload);
}
function shadowRestoreSelected(){
  const item=ShadowStore.selected;
  if(!item?.payload?.state){ui.msg('복원할 V2 상태가 없습니다.','error');return;}
  if(!confirm('선택한 테스트 스냅샷을 현재 V2 화면에 복원할까요? 기존 앱 데이터는 변경되지 않습니다.'))return;
  recoveryPushUndoSafe('Firebase/브라우저 테스트 스냅샷 복원 전');
  store.set(JSON.parse(JSON.stringify(item.payload.state)));
  ui.msg('선택한 테스트 스냅샷을 V2 화면에 복원했습니다.','success');
  shadowUpdateStats(item.payload);
}



/* ===== v1.11 autosave and recovery ===== */
const RecoveryStore={
  enabled:false,
  localKey:'230match-main-v2-recovery-v1',
  settingsKey:'230match-main-v2-recovery-settings-v1',
  debounceMs:2500,
  maxLocal:20,
  timer:null,
  lastSerialized:'',
  lastChecksum:'',
  lastChangedAt:'',
  lastLocalAt:'',
  lastFirebaseAt:'',
  entries:[],
  selected:null,
  suppress:false
};
function recoveryStableStringify(value){
  const seen=new WeakSet();
  const normalize=v=>{
    if(v===null||typeof v!=='object')return v;
    if(seen.has(v))return '[Circular]';
    seen.add(v);
    if(Array.isArray(v))return v.map(normalize);
    const out={};
    Object.keys(v).sort().forEach(k=>out[k]=normalize(v[k]));
    return out;
  };
  return JSON.stringify(normalize(value));
}
function recoveryHash(text){
  let h1=0x811c9dc5;
  for(let i=0;i<text.length;i++){
    h1^=text.charCodeAt(i);
    h1=Math.imul(h1,0x01000193);
  }
  return (`00000000${(h1>>>0).toString(16)}`).slice(-8);
}
function recoveryPayload(reason='autosave'){
  const state=JSON.parse(JSON.stringify(store.get()));
  const serialized=recoveryStableStringify(state);
  const checksum=recoveryHash(serialized);
  return {
    schemaVersion:'230match-main-v2-recovery-v1',
    recoveryOnly:true,
    shadowOnly:true,
    reason,
    savedAt:new Date().toISOString(),
    checksum,
    source:state.bridgeSource||null,
    summary:{
      round:currentRoundLabel(state),
      drawSize:Number(state.draw?.size||0),
      matches:Array.isArray(state.draw?.matches)?state.draw.matches.length:0,
      completed:Array.isArray(state.draw?.matches)?state.draw.matches.filter(m=>m?.status==='completed').length:0,
      playing:Array.isArray(state.draw?.matches)?state.draw.matches.filter(m=>m?.status==='playing').length:0,
      courtWait1:Array.isArray(state.draw?.matches)?state.draw.matches.filter(m=>m?.status==='court_wait1').length:0,
      sharedQueue:Array.isArray(state.draw?.matches)?state.draw.matches.filter(m=>m?.status==='shared_queue').length:0
    },
    state
  };
}
function recoveryBadge(text,type='paused'){
  const el=document.getElementById('autosaveBadge');
  if(!el)return;
  el.textContent=text;
  el.classList.remove('autosave-paused','autosave-running','autosave-saving','autosave-error');
  el.classList.add(`autosave-${type}`);
}
function recoverySetStat(id,value){
  const el=document.getElementById(id);if(el)el.textContent=value||'-';
}
function recoveryRenderStatus(){
  recoverySetStat('autosaveModeStat',RecoveryStore.enabled?'ON':'OFF');
  recoverySetStat('autosaveChangedAtStat',RecoveryStore.lastChangedAt?new Date(RecoveryStore.lastChangedAt).toLocaleString():'-');
  recoverySetStat('autosaveLocalAtStat',RecoveryStore.lastLocalAt?new Date(RecoveryStore.lastLocalAt).toLocaleString():'-');
  recoverySetStat('autosaveFirebaseAtStat',RecoveryStore.lastFirebaseAt?new Date(RecoveryStore.lastFirebaseAt).toLocaleString():'-');
  recoverySetStat('autosaveChecksumStat',RecoveryStore.lastChecksum||'-');
  const btn=document.getElementById('toggleAutosaveBtn');
  if(btn)btn.textContent=RecoveryStore.enabled?'자동저장 OFF':'자동저장 ON';
  recoveryBadge(RecoveryStore.enabled?'감시 중':'대기',RecoveryStore.enabled?'running':'paused');
}
function recoveryReadLocal(){
  try{return JSON.parse(localStorage.getItem(RecoveryStore.localKey)||'[]');}catch{return [];}
}
function recoveryWriteLocal(payload){
  const list=recoveryReadLocal();
  const entry={
    id:`local-${payload.savedAt}`,
    mode:'browser',
    savedAt:payload.savedAt,
    checksum:payload.checksum,
    reason:payload.reason,
    payload
  };
  const filtered=list.filter(x=>x.checksum!==payload.checksum);
  filtered.unshift(entry);
  localStorage.setItem(RecoveryStore.localKey,JSON.stringify(filtered.slice(0,RecoveryStore.maxLocal)));
  RecoveryStore.lastLocalAt=payload.savedAt;
}
function recoveryFirebaseName(payload){
  const key=payload.source?.key||payload.source?.division||'manual';
  return shadowSafeName(`recovery-${key}-${payload.savedAt.replace(/[:.]/g,'-')}`);
}
async function recoveryWriteFirebase(payload){
  if(!ShadowStore.auth?.currentUser)return false;
  await shadowEnsureToken(false);
  const cfg=shadowFirestoreBase();
  const name=recoveryFirebaseName(payload);
  const body={fields:{
    schemaVersion:{stringValue:payload.schemaVersion},
    recoveryOnly:{booleanValue:true},
    shadowOnly:{booleanValue:true},
    savedAt:{timestampValue:payload.savedAt},
    checksum:{stringValue:payload.checksum},
    reason:{stringValue:payload.reason},
    sourceKey:{stringValue:payload.source?.key||payload.source?.division||''},
    drawSize:{integerValue:String(payload.summary.drawSize||0)},
    payloadJson:{stringValue:JSON.stringify(payload)}
  }};
  const res=await fetch(cfg.document(name),{
    method:'PATCH',
    headers:shadowHeaders(true),
    body:JSON.stringify(body)
  });
  if(!res.ok){
    const text=await res.text();
    throw new Error(`Firebase 복구점 저장 실패 HTTP ${res.status}: ${text.slice(0,160)}`);
  }
  RecoveryStore.lastFirebaseAt=payload.savedAt;
  return true;
}
async function recoverySave(reason='autosave',showToast=false){
  try{
    const payload=recoveryPayload(reason);
    if(reason==='autosave'&&payload.checksum===RecoveryStore.lastChecksum)return;
    recoveryBadge('저장 중','saving');
    recoveryWriteLocal(payload);
    let firebaseSaved=false;
    try{firebaseSaved=await recoveryWriteFirebase(payload);}catch(e){
      console.warn('[MAIN-V2] firebase recovery skipped',e);
    }
    RecoveryStore.lastChecksum=payload.checksum;
    RecoveryStore.lastSerialized=recoveryStableStringify(payload.state);
    recoveryRenderStatus();
    const validation=document.getElementById('autosaveValidation');
    if(validation){
      validation.textContent=
        `${reason==='manual'?'수동':'자동'} 복구점 저장 완료 · 체크섬 ${payload.checksum} · `+
        `브라우저 저장 ${firebaseSaved?'및 Firebase 저장':'완료, Firebase 미저장'}`;
      validation.className='import-summary success';
    }
    if(showToast)ui.msg('현재 상태 복구점을 저장했습니다.','success');
    await recoveryList();
  }catch(e){
    recoveryBadge('저장 오류','error');
    const validation=document.getElementById('autosaveValidation');
    if(validation){validation.textContent=e.message;validation.className='import-summary error';}
    if(showToast)ui.msg(e.message,'error');
  }
}
function recoverySchedule(){
  if(!RecoveryStore.enabled||RecoveryStore.suppress)return;
  const current=recoveryStableStringify(store.get());
  const checksum=recoveryHash(current);
  if(checksum===RecoveryStore.lastChecksum)return;
  RecoveryStore.lastChangedAt=new Date().toISOString();
  recoveryRenderStatus();
  clearTimeout(RecoveryStore.timer);
  RecoveryStore.timer=setTimeout(()=>recoverySave('autosave',false),RecoveryStore.debounceMs);
}
function recoveryToggle(){
  RecoveryStore.enabled=!RecoveryStore.enabled;
  localStorage.setItem(RecoveryStore.settingsKey,JSON.stringify({enabled:RecoveryStore.enabled}));
  recoveryRenderStatus();
  if(RecoveryStore.enabled){
    recoverySchedule();
    ui.msg('운영 자동저장을 시작했습니다.','success');
  }else{
    clearTimeout(RecoveryStore.timer);
    ui.msg('운영 자동저장을 중지했습니다.','info');
  }
}
async function recoveryList(){
  const entries=[];
  recoveryReadLocal().forEach(x=>entries.push(x));
  try{
    if(ShadowStore.auth?.currentUser){
      await shadowEnsureToken(false);
      const urls=shadowFirestoreBase();
      const res=await fetch(`${urls.list}${urls.list.includes('?')?'&':'?'}pageSize=50`,{headers:shadowHeaders(false)});
      if(res.ok){
        const json=await res.json();
        (json.documents||[]).forEach(doc=>{
          const obj=shadowDocToObject(doc);
          if(obj.schemaVersion!=='230match-main-v2-recovery-v1'||!obj.payloadJson)return;
          let payload=null;
          try{payload=JSON.parse(obj.payloadJson);}catch{}
          if(payload)entries.push({
            id:`firebase-${obj.__name}`,
            mode:'firebase',
            name:obj.__name,
            savedAt:payload.savedAt,
            checksum:payload.checksum,
            reason:payload.reason,
            payload
          });
        });
      }
    }
  }catch(e){console.warn('[MAIN-V2] recovery firebase list skipped',e);}
  const unique=new Map();
  entries.sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||''))).forEach(entry=>{
    const key=`${entry.mode}:${entry.checksum}:${entry.savedAt}`;
    if(!unique.has(key))unique.set(key,entry);
  });
  RecoveryStore.entries=[...unique.values()];
  const select=document.getElementById('recoverySnapshotSelect');
  if(!RecoveryStore.entries.length){
    select.innerHTML='<option value="">저장된 복구점 없음</option>';
    document.getElementById('recoveryPreview').textContent='선택된 복구점이 없습니다.';
    RecoveryStore.selected=null;
    return;
  }
  select.innerHTML=RecoveryStore.entries.map((x,i)=>
    `<option value="${i}">[${x.mode==='firebase'?'Firebase':'브라우저'}] ${new Date(x.savedAt).toLocaleString()} · ${safeText(x.reason||'')} · ${safeText(x.checksum||'')}</option>`
  ).join('');
  recoverySelect();
}
function recoverySelect(){
  const idx=Number(document.getElementById('recoverySnapshotSelect').value);
  RecoveryStore.selected=RecoveryStore.entries[idx]||null;
  recoveryPreviewSelected();
}
function recoveryPreviewSelected(){
  const item=RecoveryStore.selected;
  const el=document.getElementById('recoveryPreview');
  if(!item){el.textContent='선택된 복구점이 없습니다.';return;}
  el.textContent=JSON.stringify({
    mode:item.mode,
    savedAt:item.savedAt,
    checksum:item.checksum,
    reason:item.reason,
    source:item.payload?.source,
    summary:item.payload?.summary
  },null,2);
}
function recoveryValidate(){
  const payload=recoveryPayload('validation');
  const matches=payload.state?.draw?.matches||[];
  const ids=new Set();
  const duplicateIds=[];
  matches.forEach(m=>{
    if(!m?.id)return;
    if(ids.has(m.id))duplicateIds.push(m.id);
    ids.add(m.id);
  });
  const invalidStatus=matches.filter(m=>![
    'waiting_slots','shared_queue','court_wait1','playing','completed'
  ].includes(m?.status)).map(m=>m?.id);
  const errors=[];
  if(duplicateIds.length)errors.push(`중복 경기 ID ${duplicateIds.length}건`);
  if(invalidStatus.length)errors.push(`알 수 없는 상태 ${invalidStatus.length}건`);
  if(payload.summary.completed>payload.summary.matches)errors.push('완료 경기 수가 전체 경기 수보다 큼');
  const el=document.getElementById('autosaveValidation');
  if(errors.length){
    el.textContent=`검증 실패 · ${errors.join(' · ')}`;
    el.className='import-summary error';
    recoveryBadge('검증 오류','error');
  }else{
    el.textContent=`검증 통과 · ${payload.summary.drawSize}강 · ${payload.summary.matches}경기 · 체크섬 ${payload.checksum}`;
    el.className='import-summary success';
    recoveryBadge(RecoveryStore.enabled?'감시 중':'검증 통과',RecoveryStore.enabled?'running':'running');
  }
}

function recoveryPushUndoSafe(label){
  try{
    if(typeof pushUndoSnapshot==='function'){
      pushUndoSnapshot(label);
      return true;
    }
    const current=JSON.parse(JSON.stringify(store.get()));
    const key='230match-main-v2-recovery-undo-fallback-v1';
    const list=JSON.parse(localStorage.getItem(key)||'[]');
    list.unshift({
      label:String(label||'복구 전 상태'),
      savedAt:new Date().toISOString(),
      state:current
    });
    localStorage.setItem(key,JSON.stringify(list.slice(0,10)));
    return true;
  }catch(e){
    console.warn('[MAIN-V2] undo fallback skipped',e);
    return false;
  }
}

function recoveryRestore(){
  const item=RecoveryStore.selected;
  if(!item?.payload?.state){ui.msg('복구할 상태가 없습니다.','error');return;}
  if(!confirm(`선택한 ${new Date(item.savedAt).toLocaleString()} 복구점으로 V2 화면을 되돌릴까요?`))return;
  try{
    RecoveryStore.suppress=true;
    recoveryPushUndoSafe('복구점 적용 전');
    store.set(JSON.parse(JSON.stringify(item.payload.state)));
    RecoveryStore.lastChecksum=item.checksum||recoveryHash(recoveryStableStringify(item.payload.state));
    RecoveryStore.lastSerialized=recoveryStableStringify(item.payload.state);
    const el=document.getElementById('autosaveValidation');
    el.textContent=`복구 완료 · ${new Date(item.savedAt).toLocaleString()} · 체크섬 ${RecoveryStore.lastChecksum}`;
    el.className='import-summary success';
    ui.msg('선택한 복구점으로 V2 상태를 복원했습니다.','success');
  }finally{
    setTimeout(()=>{RecoveryStore.suppress=false;recoveryRenderStatus();},300);
  }
}
function recoveryDownload(){
  const item=RecoveryStore.selected;
  if(!item){ui.msg('선택된 복구점이 없습니다.','error');return;}
  downloadJson(`230match-recovery-${item.checksum}-${Date.now()}.json`,item.payload);
}
function recoveryClearLocal(){
  if(!confirm('브라우저에 저장된 V2 복구점을 모두 지울까요? Firebase 복구점은 삭제되지 않습니다.'))return;
  localStorage.removeItem(RecoveryStore.localKey);
  recoveryList();
  ui.msg('브라우저 복구점을 정리했습니다.','success');
}
function recoveryBoot(){
  try{
    const settings=JSON.parse(localStorage.getItem(RecoveryStore.settingsKey)||'{}');
    RecoveryStore.enabled=!!settings.enabled;
  }catch{}
  const initial=recoveryPayload('boot');
  RecoveryStore.lastChecksum=initial.checksum;
  RecoveryStore.lastSerialized=recoveryStableStringify(initial.state);
  recoveryRenderStatus();
  recoveryList();
  setInterval(recoverySchedule,1200);
}



/* ===== v1.12 legacy sync staging ===== */
const SyncStaging={
  target:null,
  plan:null,
  validation:null,
  targetKey:'230match-main-v2-sync-target-v1'
};
function syncBadge(text,type='idle'){
  const el=document.getElementById('syncStagingBadge');
  if(!el)return;
  el.textContent=text;
  el.classList.remove('sync-idle','sync-ready','sync-warn','sync-error');
  el.classList.add(`sync-${type}`);
}
function syncText(id,value){
  const el=document.getElementById(id);
  if(el)el.textContent=value==null||value===''?'-':String(value);
}
function syncGetCurrentSource(){
  const state=store.get();
  const source=state.bridgeSource||{};
  const report=BridgeState.directReport||{};
  return {
    tournamentId:source.tournamentId||report.tournamentId||'',
    tournamentName:source.tournamentName||report.tournamentName||'',
    division:source.division||report.division||'',
    key:source.key||report.key||state.importedSource||'',
    qualifierCount:Number(source.qualifierCount||report.qualifiers?.length||state.importedTeams?.length||0),
    scannedAt:source.scannedAt||report.scannedAt||''
  };
}
function syncCaptureTarget(){
  const source=syncGetCurrentSource();
  const state=store.get();
  if(!source.tournamentId&&!source.tournamentName){
    ui.msg('기존 앱 대회·부서를 먼저 읽고 V2에 적용하세요.','error');
    return;
  }
  if(!source.division){
    ui.msg('반영할 부서가 확인되지 않습니다.','error');
    return;
  }
  SyncStaging.target={
    ...source,
    drawSize:Number(state.draw?.size||0),
    importedCount:Number(state.importedTeams?.length||0),
    capturedAt:new Date().toISOString(),
    sourceChecksum:recoveryHash(recoveryStableStringify({
      source,
      teams:state.importedTeams||[]
    }))
  };
  localStorage.setItem(SyncStaging.targetKey,JSON.stringify(SyncStaging.target));
  syncRenderTarget();
  syncBadge('대상 고정','warn');
  document.getElementById('syncTargetStatus').textContent=
    `${SyncStaging.target.tournamentName} · ${SyncStaging.target.division}을 반영 대상으로 고정했습니다.`;
  document.getElementById('syncTargetStatus').className='import-summary success';
}
function syncClearTarget(){
  SyncStaging.target=null;
  SyncStaging.plan=null;
  SyncStaging.validation=null;
  localStorage.removeItem(SyncStaging.targetKey);
  syncRenderTarget();
  syncRenderPlan();
  syncBadge('대기','idle');
}
function syncRenderTarget(){
  const t=SyncStaging.target;
  syncText('syncTournamentStat',t?.tournamentName);
  syncText('syncDivisionStat',t?.division);
  syncText('syncSourceKeyStat',t?.key);
  syncText('syncDrawSizeStat',t?.drawSize?`${t.drawSize}강`:'-');
  syncText('syncReadyTarget',t?'예':'아니오');
}
function syncNormalizeScore(match){
  const score=match?.score||match?.result||null;
  if(score&&typeof score==='object'){
    return {
      a:Number(score.a??score.team1??score.home??score.left??0),
      b:Number(score.b??score.team2??score.away??score.right??0)
    };
  }
  return {
    a:Number(match?.scoreA??match?.team1Score??match?.homeScore??0),
    b:Number(match?.scoreB??match?.team2Score??match?.awayScore??0)
  };
}
function syncTeamSummary(team){
  if(!team)return null;
  if(typeof team==='string')return {name:team};
  return {
    id:team.id||team.teamId||'',
    name:team.name||team.teamName||team.label||'',
    affiliation:team.affiliation||team.club||team.org||'',
    seed:Number(team.seed||0),
    groupNo:Number(team.groupNo||0),
    groupRank:Number(team.groupRank||0)
  };
}
function syncBuildPlan(){
  const state=store.get();
  if(!SyncStaging.target){
    ui.msg('먼저 반영 대상을 고정하세요.','error');
    return null;
  }
  const currentSource=syncGetCurrentSource();
  const sourceMismatch=
    String(currentSource.tournamentId||currentSource.tournamentName)!==
    String(SyncStaging.target.tournamentId||SyncStaging.target.tournamentName) ||
    String(currentSource.division)!==String(SyncStaging.target.division);
  const matches=Array.isArray(state.draw?.matches)?state.draw.matches:[];
  const completed=[];
  const live=[];
  const queue=[];
  const advances=[];
  matches.forEach(m=>{
    const item={
      matchId:m.id||'',
      round:Number(m.round||0),
      roundLabel:m.roundLabel||m.label||'',
      matchNo:Number(m.matchNo||m.number||0),
      status:m.status||'',
      court:m.court||m.courtName||'',
      team1:syncTeamSummary(m.team1||m.a||m.home),
      team2:syncTeamSummary(m.team2||m.b||m.away),
      winner:syncTeamSummary(m.winner),
      score:syncNormalizeScore(m),
      nextMatchId:m.nextMatchId||m.nextId||''
    };
    if(m.status==='completed')completed.push(item);
    if(m.status==='playing')live.push(item);
    if(m.status==='court_wait1'||m.status==='shared_queue'||m.status==='waiting_slots')queue.push(item);
    if(m.winner&&m.nextMatchId)advances.push({
      fromMatchId:item.matchId,
      toMatchId:m.nextMatchId,
      winner:item.winner
    });
  });
  const serialized=recoveryStableStringify(state);
  SyncStaging.plan={
    schemaVersion:'230match-main-v2-sync-plan-v1',
    dryRun:true,
    directWriteEnabled:false,
    createdAt:new Date().toISOString(),
    target:SyncStaging.target,
    sourceNow:currentSource,
    sourceMismatch,
    stateChecksum:recoveryHash(serialized),
    draw:{
      size:Number(state.draw?.size||0),
      locked:!!state.drawLocked,
      matchCount:matches.length
    },
    summary:{
      completed:completed.length,
      playing:live.length,
      courtWait1:matches.filter(m=>m.status==='court_wait1').length,
      sharedQueue:matches.filter(m=>m.status==='shared_queue').length,
      waitingSlots:matches.filter(m=>m.status==='waiting_slots').length,
      advances:advances.length
    },
    changes:{completed,live,queue,advances}
  };
  syncRenderPlan();
  syncValidatePlan(false);
  return SyncStaging.plan;
}
function syncValidatePlan(showToast=true){
  const plan=SyncStaging.plan||syncBuildPlan();
  if(!plan)return null;
  const errors=[];
  const warnings=[];
  if(!plan.target?.tournamentId&&!plan.target?.tournamentName)errors.push('대회 대상 없음');
  if(!plan.target?.division)errors.push('부서 대상 없음');
  if(plan.sourceMismatch)errors.push('고정 대상과 현재 연결 대상 불일치');
  if(!plan.draw.size)errors.push('대진 규모 없음');
  const expectedFirstRound=Math.max(0,Math.floor(Number(plan.draw.size||0)/2));
  if(plan.draw.matchCount && plan.draw.matchCount < expectedFirstRound){
    errors.push(`대진 경기 수 부족: ${plan.draw.matchCount}/${expectedFirstRound}`);
  }
  if(!plan.draw.matchCount)errors.push('대진 경기 없음');
  if(!plan.draw.locked)errors.push('대진 잠금 해제 상태');
  const ids=new Set();
  for(const m of [...plan.changes.completed,...plan.changes.live,...plan.changes.queue]){
    if(!m.matchId){warnings.push('경기 ID 없는 항목 존재');continue;}
    if(ids.has(m.matchId))errors.push(`중복 경기 ID ${m.matchId}`);
    ids.add(m.matchId);
  }
  for(const m of plan.changes.completed){
    if(!m.winner?.name)errors.push(`완료 경기 ${m.matchId} 승자 없음`);
    if(m.score.a===m.score.b)warnings.push(`완료 경기 ${m.matchId} 동점 점수`);
  }
  SyncStaging.validation={
    checkedAt:new Date().toISOString(),
    ok:errors.length===0,
    errors:[...new Set(errors)],
    warnings:[...new Set(warnings)]
  };
  const el=document.getElementById('syncValidationStatus');
  if(SyncStaging.validation.ok){
    el.textContent=`사전검사 통과 · 오류 0건 · 경고 ${SyncStaging.validation.warnings.length}건`;
    el.className='import-summary success';
    syncBadge('패키지 생성 가능','ready');
  }else{
    el.textContent=`사전검사 실패 · ${SyncStaging.validation.errors.join(' · ')}`;
    el.className='import-summary error';
    syncBadge('검사 오류','error');
  }
  syncText('syncReadyValidation',SyncStaging.validation.ok?'통과':'실패');
  if(showToast)ui.msg(
    SyncStaging.validation.ok?'동기화 계획 안전성 검사를 통과했습니다.':'동기화 계획에 오류가 있습니다.',
    SyncStaging.validation.ok?'success':'error'
  );
  syncRenderPlan();
  return SyncStaging.validation;
}
function syncRenderPlan(){
  const p=SyncStaging.plan;
  syncText('syncCompletedStat',p?.summary?.completed||0);
  syncText('syncPlayingStat',p?.summary?.playing||0);
  syncText('syncCourtWaitStat',p?.summary?.courtWait1||0);
  syncText('syncSharedQueueStat',p?.summary?.sharedQueue||0);
  syncText('syncAdvancedStat',p?.summary?.advances||0);
  syncText('syncReadyLock',p?.draw?.locked?'예':'아니오');
  syncText('syncReadyChecksum',p?.stateChecksum||'-');
  const preview=document.getElementById('syncPlanPreview');
  if(!p){
    preview.textContent='계획이 없습니다.';
    return;
  }
  preview.textContent=JSON.stringify({
    createdAt:p.createdAt,
    target:p.target,
    sourceMismatch:p.sourceMismatch,
    stateChecksum:p.stateChecksum,
    draw:p.draw,
    summary:p.summary,
    validation:SyncStaging.validation
  },null,2);
}
function syncDownloadPlan(){
  const plan=SyncStaging.plan||syncBuildPlan();
  if(!plan)return;
  downloadJson(`230match-sync-plan-${shadowSafeName(plan.target.key||plan.target.division)}-${Date.now()}.json`,{
    ...plan,
    validation:SyncStaging.validation
  });
}
async function syncSaveCheckpoint(){
  await recoverySave('before-legacy-sync',true);
}
function syncDownloadOperationPackage(){
  const plan=SyncStaging.plan||syncBuildPlan();
  const validation=SyncStaging.validation||syncValidatePlan(false);
  if(!plan||!validation?.ok){
    ui.msg('대진 생성·잠금 후 안전성 검사를 통과해야 합니다.','error');
    return;
  }
  if(!plan.draw.matchCount||!plan.draw.locked){
    ui.msg('대진 경기와 대진 잠금이 확인되지 않아 패키지를 만들 수 없습니다.','error');
    return;
  }
  const state=JSON.parse(JSON.stringify(store.get()));
  const pkg={
    packageVersion:'230match-main-v2-operation-package-v1',
    generatedAt:new Date().toISOString(),
    mode:'staging-only',
    directWriteEnabled:false,
    target:plan.target,
    stateChecksum:plan.stateChecksum,
    validation,
    plan,
    state
  };
  downloadJson(`230match-operation-${shadowSafeName(plan.target.key||plan.target.division)}-${Date.now()}.json`,pkg);
  ui.msg('운영 반영 패키지를 저장했습니다. 기존 앱에는 쓰지 않았습니다.','success');
}
async function syncCopySummary(){
  const plan=SyncStaging.plan||syncBuildPlan();
  const validation=SyncStaging.validation||syncValidatePlan(false);
  if(!plan)return;
  const lines=[
    `[230MATCH V2 운영 반영 사전검사]`,
    `대회: ${plan.target.tournamentName||'-'}`,
    `부서: ${plan.target.division||'-'}`,
    `대진: ${plan.draw.size}강 / ${plan.draw.matchCount}경기`,
    `완료 ${plan.summary.completed} · 시합중 ${plan.summary.playing} · 대기1 ${plan.summary.courtWait1} · 공용대기 ${plan.summary.sharedQueue}`,
    `다음 라운드 확정 ${plan.summary.advances}`,
    `체크섬: ${plan.stateChecksum}`,
    `검사: ${validation?.ok?'통과':'실패'}`,
    `직접 쓰기: 비활성`
  ];
  try{
    await navigator.clipboard.writeText(lines.join('\n'));
    ui.msg('검증 요약을 복사했습니다.','success');
  }catch{
    ui.msg('클립보드 복사에 실패했습니다.','error');
  }
}
function syncBoot(){
  try{
    const saved=JSON.parse(localStorage.getItem(SyncStaging.targetKey)||'null');
    if(saved)SyncStaging.target=saved;
  }catch{}
  syncRenderTarget();
  syncRenderPlan();
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

  const invalidLaterByes=Object.keys(draw.rounds).map(Number)
    .filter(size=>size<draw.size)
    .flatMap(size=>draw.rounds[size])
    .filter(m=>m.bye===true&&m.status===STATUS.COMPLETED&&(!!m.teamA!==!!m.teamB)&&m.scoreA==null&&m.scoreB==null);
  if(invalidLaterByes.length)issues.push(`후속 라운드 잘못된 자동진출 ${invalidLaterByes.length}경기`);

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
    invalidLaterByes:invalidLaterByes.length,
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
    ['후속 자동진출',`${m.invalidLaterByes??0}경기`,`0경기가 정상`],
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


/* ===== operation simulator v1.8 ===== */
let LastSimulationReport=null;

function simulationPositionMap(state){
  const map=new Map();
  for(const court of state.courts||[]){
    if(court.playing)map.set(court.playing,`playing:${court.name}`);
    if(court.wait1)map.set(court.wait1,`wait1:${court.name}`);
  }
  (state.sharedQueue||[]).forEach((id,i)=>map.set(id,`shared:${i+1}`));
  return map;
}
function validateOperationalState(state){
  const errors=[],warnings=[];
  if(!state?.draw){errors.push('대진표 없음');return {errors,warnings};}
  const ids=[];
  for(const court of state.courts||[]){
    if(court.playing)ids.push(court.playing);
    if(court.wait1)ids.push(court.wait1);
    if(court.playing&&court.playing===court.wait1)errors.push(`${court.name}: 같은 경기가 시합중과 대기1에 중복`);
    const p=court.playing?getMatch(state.draw,court.playing):null;
    const w=court.wait1?getMatch(state.draw,court.wait1):null;
    if(court.playing&&!p)errors.push(`${court.name}: 존재하지 않는 시합중 경기`);
    if(court.wait1&&!w)errors.push(`${court.name}: 존재하지 않는 대기1 경기`);
    if(p&&p.status!==STATUS.PLAYING)errors.push(`${court.name}: 시합중 카드 상태 불일치(${p.status})`);
    if(w&&w.status!==STATUS.WAIT1)errors.push(`${court.name}: 대기1 카드 상태 불일치(${w.status})`);
    if(p&&!isReady(p))errors.push(`${court.name}: 미확정 경기가 시합중 배정`);
    if(w&&!isReady(w))errors.push(`${court.name}: 미확정 경기가 대기1 배정`);
  }
  for(const id of state.sharedQueue||[]){
    ids.push(id);
    const m=getMatch(state.draw,id);
    if(!m)errors.push('공용대기: 존재하지 않는 경기');
    else{
      if(m.status!==STATUS.SHARED)errors.push(`${m.id}: 공용대기 상태 불일치(${m.status})`);
      if(!isReady(m))errors.push(`${m.id}: 미확정 경기가 공용대기 배정`);
    }
  }
  const seen=new Set();
  for(const id of ids){if(seen.has(id))errors.push(`${id}: 운영 위치 중복 배정`);seen.add(id);}
  for(const m of allMatches(state.draw)){
    if(m.status===STATUS.COMPLETED&&seen.has(m.id))errors.push(`${m.id}: 완료 경기가 운영 큐에 남음`);
    if(m.roundSize<state.draw.size && m.bye===true)errors.push(`${m.id}: 후속 라운드 부전승 자동처리 오류`);
    if(m.winnerId && m.status!==STATUS.COMPLETED)errors.push(`${m.id}: 미완료 경기 승자 존재`);
    if(m.status===STATUS.COMPLETED && !m.winnerId)errors.push(`${m.id}: 완료 경기 승자 없음`);
  }
  const duplicateErrors=[...new Set(errors)];
  return {errors:duplicateErrors,warnings};
}
function deterministicScore(step){
  const loser=step%3===0?4:(step%3===1?2:1);
  return step%2===0?[6,loser]:[loser,6];
}
function simulationRoundProgress(state){
  const sizes=Object.keys(state.draw.rounds).map(Number).sort((a,b)=>b-a);
  return sizes.map(size=>{
    const ms=state.draw.rounds[size];
    return {round:ROUND_NAMES[size],completed:ms.filter(m=>m.status===STATUS.COMPLETED).length,total:ms.length};
  });
}
function runOperationSimulation(limit=1){
  const live=store.get();
  if(!live?.draw)throw new Error('먼저 본선 대진을 생성하세요.');
  const state=clone(live);
  state.autoAssign=true;
  const logs=[],errors=[],warnings=[];
  let processed=0,promotions=0,advances=0,guard=0;
  const initialCheck=validateOperationalState(state);
  errors.push(...initialCheck.errors.map(v=>`시작 상태: ${v}`));
  warnings.push(...initialCheck.warnings);
  if(!(state.courts||[]).some(c=>c.playing||c.wait1) && !(state.sharedQueue||[]).length){
    initialAssign(state);
    logs.push('초기 코트배정 실행: 시합중/대기1/공용대기 구성');
  }
  while(processed<limit && guard++<1000){
    enqueueNewReadyMatches(state);
    refreshQueue(state);
    const playing=(state.courts||[]).map(c=>c.playing?getMatch(state.draw,c.playing):null).filter(Boolean);
    if(!playing.length){
      const final=state.draw.rounds[2]?.[0];
      if(final?.status===STATUS.COMPLETED)break;
      const pendingReady=allMatches(state.draw).filter(m=>isReady(m)&&m.status!==STATUS.COMPLETED);
      if(!pendingReady.length){warnings.push('진행 가능한 경기가 없지만 결승이 완료되지 않음');break;}
      refreshQueue(state);
      continue;
    }
    const match=playing[processed%playing.length];
    const court=state.courts.find(c=>c.playing===match.id);
    const beforePos=simulationPositionMap(state);
    const nextBefore=match.nextMatchId?getMatch(state.draw,match.nextMatchId):null;
    const nextHadBoth=!!(nextBefore?.teamA&&nextBefore?.teamB);
    const [a,b]=deterministicScore(processed);
    const round=ROUND_NAMES[match.roundSize];
    const teamA=match.teamA?.name||'TBD',teamB=match.teamB?.name||'TBD';
    applyResultSafely(state,match.id,a,b);
    processed++;
    const nextAfter=match.nextMatchId?getMatch(state.draw,match.nextMatchId):null;
    if(nextAfter && !nextHadBoth && nextAfter.teamA&&nextAfter.teamB)advances++;
    const afterPos=simulationPositionMap(state);
    if(court){
      const newPlaying=court.playing?getMatch(state.draw,court.playing):null;
      const newWait=court.wait1?getMatch(state.draw,court.wait1):null;
      if(newPlaying)promotions++;
      logs.push(`${processed}. ${court.name} · ${round} ${match.matchNo}경기 · ${teamA} ${a}:${b} ${teamB}`);
      logs.push(`   → 시합중: ${newPlaying?`${ROUND_NAMES[newPlaying.roundSize]} ${newPlaying.matchNo}경기`:'없음'} / 대기1: ${newWait?`${ROUND_NAMES[newWait.roundSize]} ${newWait.matchNo}경기`:'없음'} / 공용대기 ${state.sharedQueue.length}경기`);
    }
    const check=validateOperationalState(state);
    if(check.errors.length){
      errors.push(...check.errors.map(v=>`${processed}번째 결과 후: ${v}`));
      break;
    }
  }
  const final=state.draw.rounds[2]?.[0];
  const champion=final?.status===STATUS.COMPLETED
    ?(final.teamA?.id===final.winnerId?final.teamA?.name:final.teamB?.name)
    :null;
  const report={
    version:'1.8.0',generatedAt:new Date().toISOString(),requestedLimit:limit,
    processed,errors:[...new Set(errors)],warnings:[...new Set(warnings)],promotions,advances,
    champion,completed:allMatches(state.draw).filter(m=>m.status===STATUS.COMPLETED).length,
    total:allMatches(state.draw).length,sharedQueue:state.sharedQueue.length,
    roundProgress:simulationRoundProgress(state),logs,finalState:state
  };
  LastSimulationReport=report;
  renderSimulationReport(report);
  return report;
}
function runFullOperationSimulation(){
  const live=store.get();
  if(!live?.draw)throw new Error('먼저 본선 대진을 생성하세요.');
  const unfinished=allMatches(live.draw).filter(m=>m.status!==STATUS.COMPLETED).length;
  return runOperationSimulation(Math.max(unfinished+10,200));
}
function renderSimulationReport(report){
  const badge=document.getElementById('simulationBadge');
  const result=document.getElementById('simulationResult');
  document.getElementById('simProcessed').textContent=report.processed;
  document.getElementById('simErrors').textContent=report.errors.length;
  document.getElementById('simWarnings').textContent=report.warnings.length;
  document.getElementById('simPromotions').textContent=report.promotions;
  document.getElementById('simAdvances').textContent=report.advances;
  document.getElementById('simFinalState').textContent=report.champion?'결승 완료':`${report.completed}/${report.total}`;
  const ok=!report.errors.length;
  badge.textContent=ok?(report.champion?'전체 통과':'부분 통과'):'오류 발견';
  result.className=`simulation-result ${ok?(report.warnings.length?'warn':'ok'):'bad'}`;
  result.textContent=ok
    ?(report.champion?`전체 대회 시뮬레이션 통과 · 우승 ${report.champion}`:`${report.processed}경기 처리 통과 · 실제 데이터 변경 없음`)
    :`운영 시뮬레이션 실패 · 오류 ${report.errors.length}건`;
  const lines=[
    `[${new Date(report.generatedAt).toLocaleString('ko-KR')}] 처리 ${report.processed}경기`,
    `완료 ${report.completed}/${report.total} · 큐 승계 ${report.promotions} · 라운드 진출 ${report.advances}`,
    ...report.roundProgress.map(r=>`${r.round}: ${r.completed}/${r.total}`),
    ...(report.errors.length?['[오류]',...report.errors]:[]),
    ...(report.warnings.length?['[경고]',...report.warnings]:[]),
    '[운영 로그]',...report.logs.slice(-250)
  ];
  document.getElementById('simulationLog').textContent=lines.join('\n');
}
function clearSimulationReport(){
  LastSimulationReport=null;
  document.getElementById('simulationBadge').textContent='대기';
  document.getElementById('simulationResult').className='simulation-result';
  document.getElementById('simulationResult').textContent='아직 시뮬레이션을 실행하지 않았습니다.';
  ['simProcessed','simErrors','simWarnings','simPromotions','simAdvances'].forEach(id=>document.getElementById(id).textContent='0');
  document.getElementById('simFinalState').textContent='-';
  document.getElementById('simulationLog').textContent='[대기] 현재 대진을 만든 뒤 검사를 실행하세요.';
}
function exportSimulationReport(){
  if(!LastSimulationReport){ui.msg('먼저 시뮬레이션을 실행하세요.','error');return;}
  const report={...LastSimulationReport};
  delete report.finalState;
  downloadJson(`230match-operation-simulation-${Date.now()}.json`,report);
}

const actions={
  getState:()=>store.get(),
  newDraw(){
    if(!guardDrawMutation('새 본선 추첨'))return;
    pushHistory('새 본선 추첨 전',store.get());
    try{
      const size=Number(document.getElementById('drawSize').value);
      const count=Number(document.getElementById('courtCount').value);
      const prefix=document.getElementById('courtPrefix').value.trim()||'국제';

      const text=document.getElementById('teamImportText')?.value?.trim()||'';
      let teams=text?parseTeamLines(text):[];

      if(!teams.length){
        const saved=store.get().importedTeams;
        if(Array.isArray(saved)&&saved.length) teams=saved.map(t=>({...t}));
      }

      if(!teams.length){
        throw new Error('불러온 명단이 없습니다. 명단 파일을 불러오거나 명단 입력창에 붙여넣으세요.');
      }
      if(teams.length>size){
        throw new Error(`선택한 ${size}강보다 명단 ${teams.length}팀이 많습니다.`);
      }
      if(teams.length<=size/2){
        throw new Error(`${size}강에는 최소 ${size/2+1}팀이 필요합니다.`);
      }

      const next=initialState(size,count,prefix);
      next.draw=createBracket(size,teams);
      next.importedTeams=teams.map(t=>({...t}));
      next.importedSource='redraw';
      next.drawLocked=false;
      store.set(next);

      document.getElementById('teamImportText').value=
        teams.map(t=>t.name+(t.affiliation?` | ${t.affiliation}`:'')).join('\n');

      const byeCount=size-teams.length;
      setTeamImportSummary(`${teams.length}팀 명단을 유지한 채 새로 추첨했습니다. ${size}강 · 부전승 ${byeCount}자리.`);
      setTimeout(()=>{validateCurrentDraw(false);syncDrawLockUI();},0);
      ui.msg(`${teams.length}팀 명단으로 새 본선 추첨을 완료했습니다.`,'success');
    }catch(e){
      ui.msg(e.message,'error');
    }
  },
  assign(){pushHistory('코트배정 전',store.get());store.update(s=>initialAssign(s));ui.msg('코트별 시합중 1경기, 대기1 1경기까지 균등 배정했습니다.','success');},
  refreshQueue(){
    if(!guardDrawMutation('본선 큐 갱신'))return;pushHistory('본선 큐 갱신 전',store.get());store.update(s=>{enqueueNewReadyMatches(s);refreshQueue(s);});ui.msg('본선 큐를 갱신했습니다.','success');},
  toggleAuto(){store.update(s=>{s.autoAssign=!s.autoAssign;});},
  snapshot(){
    pushHistory('수동 스냅샷',store.get());
    ui.msg(`스냅샷을 저장했습니다. 보관 ${historyCount()}개`,'success');
  },
  undo(){
    const item=popHistory();
    if(!item){ui.msg('되돌릴 작업 기록이 없습니다.','error');return;}
    store.set(item.state);
    const teams=Array.isArray(item.state.importedTeams)?item.state.importedTeams:[];
    if(teams.length){
      document.getElementById('teamImportText').value=
        teams.map(t=>t.name+(t.affiliation?` | ${t.affiliation}`:'')).join('\n');
    }
    ui.msg(`되돌리기 완료: ${item.label}`,'success');
  },
  resetDemo(){
    pushHistory('데모 초기화 전',store.get());
    store.clear();store.set(initialState());ui.msg('데모 데이터를 초기화했습니다.','info');
  },
  export(){downloadJson(`230match-main-v2-${Date.now()}.json`,store.get());},
  async import(file){
    if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      store.set(data);
      const teams=Array.isArray(data.importedTeams)?data.importedTeams:[];
      if(teams.length){
        document.getElementById('teamImportText').value=
          teams.map(t=>t.name+(t.affiliation?` | ${t.affiliation}`:'')).join('\n');
        setTeamImportSummary(`JSON에서 ${teams.length}팀 명단을 복원했습니다.`);
      }
      ui.msg('JSON 데이터를 불러왔습니다.','success');
    }
    catch(e){ui.msg(`가져오기 실패: ${e.message}`,'error');}
  },
  saveResult(matchId,a,b){
    try{
      const before=clone(store.get());
      const match=getMatch(before.draw,matchId);
      const label=match?.status===STATUS.COMPLETED
        ?`${ROUND_NAMES[match.roundSize]} ${match.matchNo}경기 결과 수정 전`
        :`${ROUND_NAMES[match?.roundSize]||''} ${match?.matchNo||''}경기 결과 입력 전`;
      pushHistory(label,before);

      let outcome=null;
      store.update(s=>{outcome=applyResultSafely(s,matchId,a,b);});
      ui.closeResult();
      const suffix=outcome?.cleared
        ?` · 이후 라운드 ${outcome.cleared}경기 자동 취소`
        :'';
      ui.msg(`결과 ${a}:${b} 저장 및 다음 라운드/큐 반영 완료${suffix}`,'success');
    }catch(e){ui.msg(e.message,'error');}
  },
  importTeamText(){
    if(!guardDrawMutation('실제 명단 적용'))return;pushHistory('실제 명단 적용 전',store.get());
    try{
      const size=Number(document.getElementById('drawSize').value);
      const teams=parseTeamLines(document.getElementById('teamImportText').value);
      if(teams.length>size) throw new Error(`선택한 ${size}강보다 입력 팀 수 ${teams.length}팀이 많습니다.`);
      if(teams.length<=size/2) throw new Error(`${size}강에는 최소 ${size/2+1}팀이 필요합니다. 더 작은 대진 규모를 선택하세요.`);
      const count=Number(document.getElementById('courtCount').value);
      const prefix=document.getElementById('courtPrefix').value.trim()||'국제';
      const next=initialState(size,count,prefix);
      next.draw=createBracket(size,teams);
      next.importedTeams=teams.map(t=>({...t}));
      next.importedSource='teamImportText';
      next.drawLocked=false;
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




document.getElementById('captureSyncTargetBtn').onclick=syncCaptureTarget;
document.getElementById('clearSyncTargetBtn').onclick=syncClearTarget;
document.getElementById('buildSyncPlanBtn').onclick=syncBuildPlan;
document.getElementById('validateSyncPlanBtn').onclick=()=>syncValidatePlan(true);
document.getElementById('downloadSyncPlanBtn').onclick=syncDownloadPlan;
document.getElementById('saveSyncCheckpointBtn').onclick=syncSaveCheckpoint;
document.getElementById('downloadOperationPackageBtn').onclick=syncDownloadOperationPackage;
document.getElementById('copySyncSummaryBtn').onclick=syncCopySummary;

document.getElementById('toggleAutosaveBtn').onclick=recoveryToggle;
document.getElementById('saveRecoveryNowBtn').onclick=()=>recoverySave('manual',true);
document.getElementById('refreshRecoveryListBtn').onclick=recoveryList;
document.getElementById('verifyRecoveryBtn').onclick=recoveryValidate;
document.getElementById('clearLocalRecoveryBtn').onclick=recoveryClearLocal;
document.getElementById('recoverySnapshotSelect').onchange=recoverySelect;
document.getElementById('previewRecoveryBtn').onclick=recoveryPreviewSelected;
document.getElementById('restoreRecoveryBtn').onclick=recoveryRestore;
document.getElementById('downloadRecoveryBtn').onclick=recoveryDownload;

document.getElementById('discoverShadowConfigBtn').onclick=shadowDiscoverConfig;
document.getElementById('connectShadowAuthBtn').onclick=shadowConnectAuth;
document.getElementById('testShadowConnectionBtn').onclick=shadowTestConnection;
document.getElementById('saveShadowSnapshotBtn').onclick=shadowSaveFirebase;
document.getElementById('saveShadowLocalBtn').onclick=shadowSaveLocal;
document.getElementById('listShadowSnapshotsBtn').onclick=shadowListSnapshots;
document.getElementById('shadowSnapshotSelect').onchange=shadowSelectSnapshot;
document.getElementById('downloadShadowSnapshotBtn').onclick=shadowDownloadSelected;
document.getElementById('restoreShadowSnapshotBtn').onclick=shadowRestoreSelected;

document.getElementById('loadLegacyStructureBtn').onclick=loadLegacyTournamentStructure;
document.getElementById('legacyTournamentSelect').onchange=populateLegacyDivisions;
document.getElementById('inspectLegacyDivisionBtn').onclick=()=>inspectLegacySelectedDivision(true);
document.getElementById('refreshLegacyQualifiersBtn').onclick=()=>inspectLegacySelectedDivision(true);
document.getElementById('copyLegacyQualifiersBtn').onclick=copyLegacyQualifiers;
document.getElementById('applyLegacyQualifiersBtn').onclick=applyLegacyQualifiers;
document.getElementById('exportLegacyBridgeReportBtn').onclick=exportLegacyDirectReport;

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
document.getElementById('simulateOneBtn').onclick=()=>{try{runOperationSimulation(1);}catch(e){ui.msg(e.message,'error');}};
document.getElementById('simulateTenBtn').onclick=()=>{try{runOperationSimulation(10);}catch(e){ui.msg(e.message,'error');}};
document.getElementById('simulateFullBtn').onclick=()=>{try{runFullOperationSimulation();}catch(e){ui.msg(e.message,'error');}};
document.getElementById('exportSimulationBtn').onclick=exportSimulationReport;
document.getElementById('clearSimulationBtn').onclick=clearSimulationReport;

document.getElementById('load100TestTeamsBtn').onclick=async()=>{
  try{await load100TestTeams();}catch(err){ui.msg(err.message,'error');}
};
document.getElementById('buildRankedTeamsBtn').onclick=()=>copyCandidateToText(true);
document.getElementById('copyCandidateTextBtn').onclick=()=>copyCandidateToText(false);
store.subscribe(state=>ui.render(state));
if(!store.load()) store.emit();
setTimeout(()=>{
  repairLoadedStateIfNeeded();
  syncDrawLockUI();
  const savedTeams=store.get()?.importedTeams;
  const input=document.getElementById('teamImportText');
  if(input&&Array.isArray(savedTeams)&&savedTeams.length&&!input.value.trim()){
    input.value=savedTeams.map(t=>t.name+(t.affiliation?` | ${t.affiliation}`:'')).join('\n');
    setTeamImportSummary(`저장된 명단 ${savedTeams.length}팀을 복원했습니다.`);
  }
  if(currentDraw())validateCurrentDraw(false);
},0);
console.info(`[MAIN-V2] engine 1.12.1 strict sync validation loaded`);


setTimeout(()=>{
  try{
    shadowSetValue('shadowProjectId',ShadowStore.config.projectId);
    shadowSetValue('shadowApiKey',ShadowStore.config.apiKey);
    shadowSetValue('shadowCollection','mainV2ShadowTests');
    shadowAuthUI(null);
    shadowListSnapshots(); // 브라우저 저장 목록만 우선 표시
    shadowUpdateStats(shadowCurrentPayload());
  }catch(e){console.warn('[MAIN-V2] shadow store init',e);}
},300);

setTimeout(()=>{
  try{recoveryBoot();}
  catch(e){console.warn('[MAIN-V2] recovery boot failed',e);}
},500);

setTimeout(()=>{
  try{syncBoot();}
  catch(e){console.warn('[MAIN-V2] sync staging boot failed',e);}
},650);
