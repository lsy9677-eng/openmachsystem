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
  64:'64강',32:'32강',16:'16강',8:'8강',4:'준결승',2:'결승'
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

function createBracket(size,teams){
  if(![32,64].includes(size)) throw new Error('지원 대진 규모는 32 또는 64입니다.');
  if(teams.length!==size) throw new Error(`팀 수가 ${size}팀이어야 합니다.`);
  const shuffled=shuffle(teams);
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
      status:current===size?STATUS.UNASSIGNED:STATUS.WAITING_SLOTS,
      venue:'',court:'',queueOrder:null,
      startedAt:null,completedAt:null,
      nextMatchId:current>2?`r${current/2}_m${Math.floor(i/2)+1}`:null,
      nextSlot:current>2?(i%2===0?'A':'B'):null
    }));
    current/=2;
  }
  rounds[size].forEach((m,i)=>{m.teamA=shuffled[i*2];m.teamB=shuffled[i*2+1];});
  return {id:uid('draw'),size,createdAt:nowIso(),rounds};
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
const actions={
  getState:()=>store.get(),
  newDraw(){
    const size=Number(document.getElementById('drawSize').value);
    const count=Number(document.getElementById('courtCount').value);
    const prefix=document.getElementById('courtPrefix').value.trim()||'국제';
    store.set(initialState(size,count,prefix));ui.msg(`${size}팀 본선 대진을 새로 생성했습니다.`,'success');
  },
  assign(){store.update(s=>initialAssign(s));ui.msg('코트별 시합중 1경기, 대기1 1경기까지 균등 배정했습니다.','success');},
  refreshQueue(){store.update(s=>{enqueueNewReadyMatches(s);refreshQueue(s);});ui.msg('본선 큐를 갱신했습니다.','success');},
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
    try{
      const size=Number(document.getElementById('drawSize').value);
      const teams=parseTeamLines(document.getElementById('teamImportText').value);
      if(teams.length!==size) throw new Error(`${size}팀이 필요하지만 ${teams.length}팀이 입력되었습니다.`);
      const count=Number(document.getElementById('courtCount').value);
      const prefix=document.getElementById('courtPrefix').value.trim()||'국제';
      const next=initialState(size,count,prefix);
      next.draw=createBracket(size,teams);
      store.set(next);
      setTeamImportSummary(`${teams.length}팀 명단으로 본선 대진을 생성했습니다.`);
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
store.subscribe(state=>ui.render(state));
if(!store.load()) store.emit();
console.info(`[MAIN-V2] engine 1.1.0 team-import stage loaded`);

