/*
 * 230MATCH v1051 — clean main tournament engine
 *
 * Single authority for:
 * - complete fixed bracket tree (64→32→16→8→4→final)
 * - score/result propagation
 * - current-round status cards with result entry
 * - balanced first assignment
 * - active → wait1 → shared queue flow
 *
 * It intentionally does not depend on legacy main-draw renderers.
 */
(function(){
  'use strict';
  if (window.__V1051_MAIN_ENGINE__) return;
  window.__V1051_MAIN_ENGINE__ = true;
  window.__CLEAN_MAIN_ONLY_MODE__ = true;
  window.__MAIN_DRAW_AUTHORITY_VERSION__ = 'v1051-clean-main-engine';

  const VERSION = 'v1051-clean-main-engine';
  const PANEL_ID = 'v1051MainPanel';
  const BRACKET_ID = 'v1051MainBracket';
  const AUTO_KEY = 'V1051_MAIN_AUTO_ENABLED';
  const VENUES = ['국제','능동','원도심','삼계','금병','동부','장유중','기타'];
  const COLORS = {국제:'#2563eb',능동:'#7c3aed',원도심:'#16a34a',삼계:'#0891b2',금병:'#d97706',동부:'#be123c',장유중:'#475569',기타:'#64748b'};
  const BGS = {국제:'#eff6ff',능동:'#f5f3ff',원도심:'#ecfdf5',삼계:'#ecfeff',금병:'#fff7ed',동부:'#fff1f2',장유중:'#f8fafc',기타:'#f8fafc'};

  const $ = id => document.getElementById(id);
  const arr = v => Array.isArray(v) ? v : [];
  const str = v => String(v == null ? '' : v).trim();
  const num = v => { const n=Number(v); return Number.isFinite(n)?n:null; };
  const esc = v => str(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const iso = () => new Date().toISOString();
  const log = (...a) => { try{ console.info('[v1051]',...a); }catch(_e){} };
  const notify = (m,t='info') => { try{ if(typeof window.toast==='function') window.toast(m,t); else log(m); }catch(_e){} };

  function hasData(){ return !!(window.G && G.draws && G.matches && G.teams); }
  function splitKey(key){ const s=str(key),i=s.lastIndexOf('_'); return {tid:s.slice(0,i),div:s.slice(i+1)}; }
  function selectedKey(){
    try{
      const direct=str(window.__CURRENT_RENDER_KEY||window.__v650CurrentGroupLabelKey||'');
      if(direct && G.draws && G.draws[direct]) return direct;
    }catch(_e){}
    try{
      const tid=str(($('brTS')&&$('brTS').value)||($('regTS')&&$('regTS').value)||($('rankTS')&&$('rankTS').value)||'');
      let div='';
      const ds=$('brDS');
      if(ds && ds.value && ds.value!=='__ALL__') div=str(ds.value);
      if(!div && Array.isArray(window.BR_MULTI_DIVS)) div=str(window.BR_MULTI_DIVS.find(v=>v&&v!=='__ALL__')||'');
      if(tid&&div&&G.draws[tid+'_'+div]) return tid+'_'+div;
      if(tid){ const keys=Object.keys(G.draws||{}).filter(k=>k.startsWith(tid+'_')); if(keys.length) return keys[0]; }
    }catch(_e){}
    try{ return Object.keys(G.draws||{})[0]||''; }catch(_e){ return ''; }
  }

  function venueOfCourt(c){
    c=str(c);
    if(/국제|장유국제|gukje/i.test(c)) return '국제';
    if(/능동|neung/i.test(c)) return '능동';
    if(/원도심|원도|인조|wondo/i.test(c)) return '원도심';
    if(/삼계|samgye/i.test(c)) return '삼계';
    if(/금병|geum/i.test(c)) return '금병';
    if(/동부|dongbu/i.test(c)) return '동부';
    if(/장유중|클레이/i.test(c)) return '장유중';
    return c?'기타':'';
  }
  function courtNo(c){ const m=str(c).match(/(\d+)\s*$/); return m?Number(m[1]):9999; }
  function courtSort(a,b){
    const va=venueOfCourt(a),vb=venueOfCourt(b);
    return (VENUES.indexOf(va)<0?99:VENUES.indexOf(va))-(VENUES.indexOf(vb)<0?99:VENUES.indexOf(vb)) || courtNo(a)-courtNo(b) || str(a).localeCompare(str(b),'ko');
  }
  function normalizeCourts(src){
    const out=[];
    arr(src).flat(Infinity).forEach(v=>{ const c=str(v); if(c&&!out.includes(c)&&!/공용|대기|미배정|undefined|null/i.test(c)) out.push(c); });
    return out.sort(courtSort);
  }
  function activeCourts(key){
    // Explicit user-selected board filter is authoritative when present.
    try{
      if(typeof window.getSelectedCourtFilters==='function'){
        const explicit=normalizeCourts(window.getSelectedCourtFilters(key));
        if(explicit.length) return explicit;
      }
    }catch(_e){}
    const {tid,div}=splitKey(key);
    try{
      if(typeof window.getDivisionPhaseConfiguredCourts==='function'){
        const configured=normalizeCourts(window.getDivisionPhaseConfiguredCourts(tid,div,'main'));
        if(configured.length) return configured;
      }
    }catch(_e){}
    try{
      const d=G.draws[key]||{};
      const configured=normalizeCourts(d.mainAllowedCourts||d.mainCourts||d.allowedMainCourts||d.allowedCourts||d.courts);
      if(configured.length) return configured;
    }catch(_e){}
    try{
      if(window.OperationQueueV993 && typeof OperationQueueV993.getBoardCourtsForKey==='function'){
        const board=normalizeCourts(OperationQueueV993.getBoardCourtsForKey(key));
        if(board.length) return board;
      }
    }catch(_e){}
    return [];
  }

  function team(key,ti){ return arr(G.teams&&G.teams[key])[Number(ti)]||null; }
  function teamName(key,ti){
    const t=team(key,ti); if(!t) return ti==null?'TBD':'팀 '+(Number(ti)+1);
    try{
      if(arr(t.individualPlayers).length) return t.individualPlayers.slice(0,2).map(p=>str((p&&p.name)||p)).filter(Boolean).join(' / ');
      if(arr(t.players).length) return t.players.slice(0,2).map(p=>str((p&&p.name)||p)).filter(Boolean).join(' / ');
      return str(t.pairLabel||t.entryLabel||t.name||t.club||('팀 '+(Number(ti)+1))).replace(/\([^)]*\)/g,'').trim();
    }catch(_e){ return '팀 '+(Number(ti)+1); }
  }
  function groupNo(g,gi){ return Number(g&&(g.confirmedGroupNo||g.finalGroupNo||g.displayGroupNo||g.manualGroupNo||g.groupNo||g.no)) || gi+1; }
  function groupMatches(key,gi){ return arr(G.matches[key]).filter(m=>m&&str(m.phase)==='group'&&Number(m.group)===Number(gi)&&!m.bye); }
  function rawState(key,m){
    try{ if(typeof window.getMatchResultState==='function') return window.getMatchResultState(key,m)||{}; }catch(_e){}
    return {};
  }
  function done(key,m){ const s=rawState(key,m); return !!(s.done||m.winner!=null||m.completedAt||m.status==='done'); }
  function scoreText(key,m){
    const direct=str(m.actualScoreText||m.scoreText||m.resultText||'');
    if(/^\d+\s*[:：]\s*\d+$/.test(direct)) return direct.replace('：',':').replace(/\s/g,'');
    const rb=arr(m.rubbers).find(r=>r&&num(r.score1)!=null&&num(r.score2)!=null);
    if(rb) return `${Number(rb.score1)}:${Number(rb.score2)}`;
    const s=rawState(key,m);
    const a=num(s.actual1??s.disp1??m.score1??m.sc1), b=num(s.actual2??s.disp2??m.score2??m.sc2);
    return a!=null&&b!=null?`${a}:${b}`:'';
  }
  function groupComplete(key,gi){ const ms=groupMatches(key,gi); return !!ms.length&&ms.every(m=>done(key,m)); }
  function standings(key,gi,g){
    if(groupComplete(key,gi)){
      try{
        if(typeof window.calcGS==='function'){
          const rows=arr(window.calcGS(key,gi,arr(g.teams),arr(G.teams[key])));
          const ids=rows.map(r=>num(r&&(r.ti??r.teamIdx??r.idx??r.team))).filter(v=>v!=null);
          if(ids.length) return ids;
        }
      }catch(_e){}
      for(const f of ['standings','ranking','rankings','rankOrder','order']){
        const ids=arr(g&&g[f]).map(x=>num(typeof x==='object'?(x.ti??x.teamIdx??x.idx??x.team):x)).filter(v=>v!=null);
        if(ids.length) return ids;
      }
    }
    return arr(g&&g.teams).map(num).filter(v=>v!=null);
  }
  function collectEntries(key){
    const entries=[];
    arr(G.draws[key]&&G.draws[key].groups).forEach((g,gi)=>{
      const gn=groupNo(g,gi), st=standings(key,gi,g), complete=groupComplete(key,gi);
      [1,2].forEach(rank=>{
        const ti=complete?num(st[rank-1]):null;
        entries.push({gi,gn,rank,ti,label:`${gn}조 ${rank}위`,name:ti!=null?teamName(key,ti):`${gn}조 ${rank}위`});
      });
    });
    return entries;
  }
  function resolveEntry(key,e){
    if(!e) return null;
    const groups=arr(G.draws[key]&&G.draws[key].groups),gi=num(e.gi),rank=num(e.rank);
    if(gi!=null&&rank!=null&&groups[gi]&&groupComplete(key,gi)){
      const ti=num(standings(key,gi,groups[gi])[rank-1]);
      if(ti!=null) return {...e,ti,name:teamName(key,ti),resolved:true};
    }
    if(e.ti!=null) return {...e,name:teamName(key,e.ti),resolved:true};
    return {...e,ti:null,name:e.label||'TBD',resolved:false};
  }

  function shuffle(input){ const a=input.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
  function pairEntries(entries){
    const first=shuffle(entries.filter(e=>e.rank===1)), second=shuffle(entries.filter(e=>e.rank===2)), out=[];
    first.forEach(a=>{ let i=second.findIndex(b=>b.gn!==a.gn); if(i<0)i=0; out.push([a,second.splice(i,1)[0]||null]); });
    second.forEach(b=>out.push([null,b]));
    return shuffle(out);
  }
  function nextPow2(n){ let p=1; while(p<n)p*=2; return p; }
  function balancedOrder(n){
    // 32 matches: 1,32,17,2,31,16,3,30,18,4,29,15...
    const out=[],seen=new Set(); let centerRight=Math.floor(n/2)+1,centerLeft=Math.floor(n/2),rightTurn=true;
    for(let edge=1;out.length<n;edge++){
      for(const one of [edge,n-edge+1]) if(one>=1&&one<=n&&!seen.has(one)){seen.add(one);out.push(one-1);}
      const mid=rightTurn?centerRight++:centerLeft--;
      rightTurn=!rightTurn;
      if(mid>=1&&mid<=n&&!seen.has(mid)){seen.add(mid);out.push(mid-1);}
    }
    return out.slice(0,n);
  }
  function roundName(size,r){ const n=size/Math.pow(2,r); return n===2?'결승':n===4?'4강':`${n}강`; }
  function engineMatches(key){ return arr(G.matches[key]).filter(m=>m&&m.phase==='main'&&m.v1051Main===true); }
  function byRound(key,r){ return engineMatches(key).filter(m=>Number(m.round)===r).sort((a,b)=>Number(a.slot)-Number(b.slot)); }
  function matchById(key,id){ return engineMatches(key).find(m=>str(m.id)===str(id))||null; }
  function makeId(key,r,s){ return `v1051_${key.replace(/[^a-zA-Z0-9_-]/g,'_')}_r${r}_s${s}_${Date.now().toString(36)}`; }
  function clearResult(m){
    m.winner=null; m.sc1=null; m.sc2=null; m.score1=null; m.score2=null; m.scoreText=''; m.actualScoreText=''; m.rubbers=[];
    delete m.completedAt; delete m.resultSavedAt; delete m.finishedAt; delete m.resultText;
  }
  function clearQueue(m){
    delete m.court; m.courts=[]; delete m.currentCourt; delete m.manualCourtTarget; delete m.waitingFirstAt; delete m.lastWaitingFirstAt;
    delete m.manualSharedHold; delete m.__sharedCourtLabel; delete m.__queueStatus; delete m.courtAssignedAt; delete m.courtQueueOrder;
  }
  function makeFirst(key,size,slot,e1,e2,seq,venue){
    e1=resolveEntry(key,e1); e2=resolveEntry(key,e2);
    return {id:makeId(key,0,slot),phase:'main',round:0,slot,bracketN:size,v1051Main:true,engineVersion:VERSION,
      t1:e1&&e1.ti!=null?e1.ti:null,t2:e2&&e2.ti!=null?e2.ti:null,
      display1:e1?e1.name:'부전승',display2:e2?e2.name:'부전승',
      sourceGi1:e1?e1.gi:null,sourceGi2:e2?e2.gi:null,sourceRank1:e1?e1.rank:null,sourceRank2:e2?e2.rank:null,
      source1Label:e1?e1.label:'부전승',source2Label:e2?e2.label:'부전승',source1Resolved:!!(e1&&e1.resolved),source2Resolved:!!(e2&&e2.resolved),
      winner:null,rubbers:[],mainQueueSeq:seq,venue,venueLabel:venue,__venue:venue,mainBlock:venue,createdAt:iso(),updatedAt:iso()};
  }
  function makeLater(key,size,r,slot,left,right,seq,venue){
    return {id:makeId(key,r,slot),phase:'main',round:r,slot,bracketN:size,v1051Main:true,engineVersion:VERSION,
      t1:null,t2:null,display1:`${Number(left.slot)+1}경기 승자`,display2:`${Number(right.slot)+1}경기 승자`,
      sourceMatch1:left.id,sourceMatch2:right.id,source1Label:'이전 라운드 승자',source2Label:'이전 라운드 승자',
      winner:null,rubbers:[],mainQueueSeq:seq,venue,venueLabel:venue,__venue:venue,mainBlock:venue,createdAt:iso(),updatedAt:iso()};
  }
  function syncFirstSlots(key){
    const groups=arr(G.draws[key]&&G.draws[key].groups);
    byRound(key,0).forEach(m=>{
      [1,2].forEach(side=>{
        const gi=num(m['sourceGi'+side]),rank=num(m['sourceRank'+side]);
        if(gi==null||rank==null||!groups[gi]) return;
        const e=resolveEntry(key,{gi,gn:groupNo(groups[gi],gi),rank,label:m['source'+side+'Label']});
        const old=m['t'+side];
        m['t'+side]=e.ti!=null?e.ti:null; m['display'+side]=e.name; m['source'+side+'Resolved']=!!e.resolved;
        if(old!=null&&e.ti!=null&&Number(old)!==Number(e.ti)) clearResult(m);
      });
    });
  }
  function syncTree(key){
    syncFirstSlots(key);
    const size=Number((G.draws[key]||{}).v1051Size||64),max=Math.log2(size)-1;
    for(let r=1;r<=max;r++){
      byRound(key,r).forEach(m=>{
        const src1=matchById(key,m.sourceMatch1),src2=matchById(key,m.sourceMatch2);
        const new1=src1&&src1.winner!=null?Number(src1.winner):null,new2=src2&&src2.winner!=null?Number(src2.winner):null;
        const changed=(m.t1!=null&&new1!=null&&Number(m.t1)!==new1)||(m.t2!=null&&new2!=null&&Number(m.t2)!==new2);
        if(changed) clearResult(m);
        m.t1=new1; m.t2=new2;
        m.display1=new1!=null?teamName(key,new1):`${Number(src1&&src1.slot||0)+1}경기 승자`;
        m.display2=new2!=null?teamName(key,new2):`${Number(src2&&src2.slot||0)+1}경기 승자`;
        if(new1!=null&&new2!=null&&!m.readyAt) m.readyAt=iso();
      });
    }
  }
  function winnerSide(m){ if(m.winner==null)return 0; return Number(m.winner)===Number(m.t1)?1:Number(m.winner)===Number(m.t2)?2:0; }
  function sideName(key,m,s){ const ti=num(m['t'+s]); return ti!=null?teamName(key,ti):str(m['display'+s]||'TBD'); }
  function isReady(m){ return m&&m.winner==null&&m.t1!=null&&m.t2!=null&&!m.bye; }
  function currentRound(key){
    const size=Number((G.draws[key]||{}).v1051Size||64),max=Math.log2(size)-1;
    for(let r=0;r<=max;r++){ const ms=byRound(key,r); if(ms.some(m=>!done(key,m))) return r; }
    return max;
  }

  async function persist(key){
    try{ if(window.__FB_WRITE_CACHE){ if(__FB_WRITE_CACHE.matches) delete __FB_WRITE_CACHE.matches[key]; if(__FB_WRITE_CACHE.draws) delete __FB_WRITE_CACHE.draws[key]; } }catch(_e){}
    if(typeof window.stM==='function') await window.stM(key);
    if(typeof window.stD==='function') await window.stD(key);
    try{ if(typeof window.waitForPendingWrites==='function'&&window.db) await window.waitForPendingWrites(window.db); }catch(_e){}
  }

  function venuePlan(key,count){
    const courts=activeCourts(key),counts={};
    courts.forEach(c=>{const v=venueOfCourt(c)||'기타';counts[v]=(counts[v]||0)+1;});
    const vs=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]||(VENUES.indexOf(a)-VENUES.indexOf(b)));
    if(!vs.length) return Array(count).fill('국제');
    const total=courts.length,plan=[];let used=0;
    vs.forEach((v,i)=>{let n=i===vs.length-1?count-used:Math.round(count*counts[v]/total);n=Math.max(0,Math.min(count-used,n));used+=n;for(let j=0;j<n;j++)plan.push(v);});
    while(plan.length<count)plan.push(vs[0]);
    return plan;
  }
  async function generateDraw(key){
    key=key||selectedKey();
    if(!hasData()||!key){notify('대회와 부서를 먼저 선택하세요','error');return false;}
    const entries=collectEntries(key); if(entries.length<2){notify('예선 조편성 후 본선 추첨을 실행하세요','info');return false;}
    const size=nextPow2(entries.length),firstCount=size/2,pairs=pairEntries(entries);
    while(pairs.length<firstCount)pairs.push([null,null]);
    const order=balancedOrder(firstCount),seq={};order.forEach((slot,i)=>seq[slot]=i+1);
    const venues=venuePlan(key,firstCount),all=[];
    for(let i=0;i<firstCount;i++) all.push(makeFirst(key,size,i,pairs[i][0],pairs[i][1],seq[i]||i+1,venues[i]));
    let prev=all.slice();
    for(let r=1,count=firstCount/2;count>=1;r++,count=Math.floor(count/2)){
      const next=[];
      for(let i=0;i<count;i++){
        const m=makeLater(key,size,r,i,prev[i*2],prev[i*2+1],100000+r*1000+i+1,prev[i*2].venue||venues[0]);
        all.push(m);next.push(m);
      }
      prev=next;
    }
    const nonMain=arr(G.matches[key]).filter(m=>!['main','playin','bronze'].includes(str(m&&m.phase)));
    G.matches[key]=nonMain.concat(all);
    G.draws[key]={...(G.draws[key]||{}),v1051Main:true,v1051Size:size,v1051Version:VERSION,v1051DrawAt:iso(),mainDrawSize:size,mainDrawVersion:VERSION};
    syncTree(key); await persist(key); render();
    notify(`새 본선 대진 생성 완료: ${size}강 · 전체 라운드 고정 생성`,'success');
    return true;
  }

  function setActive(m,c,order){ clearQueue(m);m.court=c;m.courts=[c];m.manualCourtTarget=c;m.__queueStatus='active';m.courtAssignedAt=iso();m.courtQueueOrder=Date.now()+order; }
  function setWait(m,c,order){ clearQueue(m);m.courts=[c];m.manualCourtTarget=c;m.waitingFirstAt=iso();m.__queueStatus='wait1';m.courtAssignedAt=iso();m.courtQueueOrder=Date.now()+order; }
  function setShared(m,v,order){ clearQueue(m);m.manualSharedHold=true;m.__sharedCourtLabel=v;m.__queueStatus='shared';m.courtQueueOrder=Date.now()+order; }
  function readyQueue(key){
    return engineMatches(key).filter(isReady).sort((a,b)=>Number(a.mainQueueSeq||999999)-Number(b.mainQueueSeq||999999)||str(a.readyAt||a.createdAt).localeCompare(str(b.readyAt||b.createdAt)));
  }
  async function assignInitial(key){
    key=key||selectedKey(); if(!key)return false; syncTree(key);
    const courts=activeCourts(key); if(!courts.length){notify('본선 사용 코트를 찾지 못했습니다','error');return false;}
    const ready=readyQueue(key); if(!ready.length){notify('양 팀이 확정된 본선 경기가 없습니다','info');render();return false;}
    ready.forEach(clearQueue);
    const groups={};courts.forEach(c=>{const v=venueOfCourt(c)||'기타';(groups[v]||(groups[v]=[])).push(c);});
    let order=0,active=0,wait=0,shared=0;
    Object.keys(groups).sort((a,b)=>VENUES.indexOf(a)-VENUES.indexOf(b)).forEach(v=>{
      const cs=groups[v].sort(courtSort),q=ready.filter(m=>(venueOfCourt(m.venue)||v)===v);
      // If old venue labels do not match selected venues, normalize to this primary venue later.
      for(const c of cs){const m=q.shift();if(!m)break;setActive(m,c,order++);active++;}
      for(const c of cs){const m=q.shift();if(!m)break;setWait(m,c,order++);wait++;}
      q.forEach(m=>{setShared(m,v,order++);shared++;});
    });
    // Matches whose legacy venue is not selected are distributed through selected courts.
    const unqueued=ready.filter(m=>!m.court&&!m.manualCourtTarget&&!m.manualSharedHold);
    const primary=venueOfCourt(courts[0])||'국제';unqueued.forEach(m=>{m.venue=primary;m.__venue=primary;setShared(m,primary,order++);shared++;});
    await persist(key); redrawHost(); render();
    notify(`본선 배정 완료: 시합중 ${active} · 대기1 ${wait} · 공용대기 ${shared}`,'success');
    return true;
  }
  function queueStatus(m){ if(m.court&&!m.waitingFirstAt)return'active';if(m.manualCourtTarget&&m.waitingFirstAt)return'wait1';if(m.manualSharedHold)return'shared';return'unassigned'; }
  async function refreshQueue(key,manual=false){
    key=key||selectedKey(); if(!key)return false; syncTree(key);
    const courts=activeCourts(key);if(!courts.length)return false;
    const ready=readyQueue(key);let changed=false,order=0;
    // Newly ready matches always enter shared queue first.
    ready.forEach(m=>{if(queueStatus(m)==='unassigned'){setShared(m,venueOfCourt(m.venue)||venueOfCourt(courts[0])||'국제',order++);changed=true;}});
    for(const c of courts){
      const v=venueOfCourt(c)||'기타';
      let active=ready.find(m=>str(m.court)===str(c)&&!m.waitingFirstAt);
      let wait=ready.find(m=>str(m.manualCourtTarget)===str(c)&&!!m.waitingFirstAt);
      if(!active&&wait){ setActive(wait,c,order++);active=wait;wait=null;changed=true; }
      if(!wait){
        const shared=ready.filter(m=>m.manualSharedHold&&!m.court&&!m.manualCourtTarget&&(venueOfCourt(m.__sharedCourtLabel||m.venue)||'기타')===v)
          .sort((a,b)=>Number(a.mainQueueSeq||999999)-Number(b.mainQueueSeq||999999)||Number(a.courtQueueOrder||0)-Number(b.courtQueueOrder||0))[0];
        if(shared){setWait(shared,c,order++);wait=shared;changed=true;}
      }
    }
    if(changed){await persist(key);redrawHost();render();if(manual)notify('본선 큐 갱신 완료','success');}
    else if(manual)notify('변경할 본선 큐가 없습니다','info');
    return changed;
  }

  function autoOn(){try{return localStorage.getItem(AUTO_KEY)!=='0';}catch(_e){return true;}}
  function setAuto(on){try{localStorage.setItem(AUTO_KEY,on?'1':'0');}catch(_e){}updateAuto();notify(`본선 자동배정 ${on?'ON':'OFF'}`,on?'success':'info');}
  function updateAuto(){const b=$('v1051AutoBtn');if(!b)return;const on=autoOn();b.textContent=on?'▶ 자동배정 ON':'⏸ 자동배정 OFF';b.className='v1051-btn '+(on?'auto-on':'auto-off');}

  function stateLabel(m){const q=queueStatus(m);if(done(selectedKey(),m))return'완료';if(q==='active')return'시합중';if(q==='wait1')return'대기1';if(q==='shared')return'공용대기';return m.t1!=null&&m.t2!=null?'배정대기':'진출대기';}
  function statusMeta(key,m){
    const q=queueStatus(m),r=roundName(Number(m.bracketN||64),Number(m.round||0)),score=scoreText(key,m);
    if(done(key,m))return `${r} · 완료${score?' '+score:''}`;
    if(q==='active')return `${r} · 시합중 · ${str(m.court)}`;
    if(q==='wait1')return `${r} · 대기1 · ${str(m.manualCourtTarget)}`;
    if(q==='shared')return `${r} · 공용대기 · ${str(m.__sharedCourtLabel||m.venue)}`;
    return `${r} · ${m.t1!=null&&m.t2!=null?'배정대기':'진출대기'}`;
  }
  function resultButton(key,m,cls='v1051-result'){
    if(m.t1==null||m.t2==null||typeof window.openM3!=='function')return'';
    return `<button type="button" class="${cls}" data-v1051-result="${esc(m.id)}">${done(key,m)?'결과 수정':'결과 입력'}</button>`;
  }
  function cardHtml(key,m){
    const v=venueOfCourt(m.court||m.manualCourtTarget||m.__sharedCourtLabel||m.venue)||'국제',win=winnerSide(m),score=scoreText(key,m).split(':');
    return `<article class="v1051-match" style="--vc:${COLORS[v]||COLORS.기타};--vb:${BGS[v]||BGS.기타}"><header><b>${Number(m.slot)+1}경기</b><span>${esc(v)}</span></header>
      <div class="v1051-side ${win===1?'win':''}"><strong>${esc(sideName(key,m,1))}</strong><em>${score[0]||0}</em></div>
      <div class="v1051-side ${win===2?'win':''}"><strong>${esc(sideName(key,m,2))}</strong><em>${score[1]||0}</em></div>
      <footer>${esc(statusMeta(key,m))}</footer>${resultButton(key,m)}</article>`;
  }
  function bracketHtml(key){
    const ms=engineMatches(key);if(!ms.length)return'<div class="v1051-empty">새 본선 대진이 없습니다. 새 본선 추첨을 실행하세요.</div>';
    syncTree(key);const size=Number(G.draws[key].v1051Size||64),max=Math.log2(size)-1;
    let h=`<div class="v1051-bracket-head"><b>본선 대진표 · ${size}강부터 결승까지</b><span>결과는 다음 라운드에 즉시 반영</span></div><div class="v1051-scroll"><div class="v1051-tree">`;
    for(let r=0;r<=max;r++){
      h+=`<section class="v1051-round"><h4>${roundName(size,r)}</h4><div class="v1051-round-body">`;
      byRound(key,r).forEach(m=>h+=cardHtml(key,m));h+='</div></section>';
    }
    return h+'</div></div>';
  }
  function statusHtml(key){
    const ms=engineMatches(key);if(!ms.length)return'';const size=Number(G.draws[key].v1051Size||64),r=currentRound(key),list=byRound(key,r);
    return `<section class="v1051-current"><div class="v1051-current-title"><b>⚡ 본선 경기 현황</b><span>${roundName(size,r)}</span></div><div class="v1051-grid">${list.map(m=>`<article class="v1051-status"><header><b>${Number(m.slot)+1}경기</b><span>${stateLabel(m)}</span></header><div>${esc(sideName(key,m,1))}<i>vs</i>${esc(sideName(key,m,2))}</div><small>${esc(statusMeta(key,m))}</small>${resultButton(key,m,'v1051-status-result')}</article>`).join('')}</div></section>`;
  }

  function ensureCss(){if($('v1051Css'))return;const s=document.createElement('style');s.id='v1051Css';s.textContent=`
    #${PANEL_ID}{margin:14px 0 20px;padding:16px;border:2px solid #bfdbfe;border-radius:18px;background:linear-gradient(180deg,#f8fbff,#fff);box-shadow:0 12px 28px rgba(15,30,58,.08)}
    .v1051-top{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}.v1051-top b{font-size:1rem}.v1051-top small{color:#64748b;font-weight:800}
    .v1051-controls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.v1051-btn{border:0;border-radius:11px;min-height:40px;padding:8px 14px;font-weight:1000;cursor:pointer}.v1051-btn.blue{background:#2563eb;color:#fff}.v1051-btn.purple{background:#7c3aed;color:#fff}.v1051-btn.green{background:#0f766e;color:#fff}.v1051-btn.auto-on{background:#d4a017;color:#111827}.v1051-btn.auto-off{background:#e2e8f0;color:#334155}
    .v1051-note{font-size:.78rem;color:#475569;line-height:1.55;margin-bottom:10px}.v1051-empty{padding:20px;text-align:center;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b;font-weight:900}
    .v1051-bracket-head,.v1051-current-title{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0 8px}.v1051-bracket-head span{font-size:.72rem;color:#64748b}.v1051-current-title span{background:#0f1e3a;color:#fff;border-radius:999px;padding:4px 10px;font-size:.74rem}
    .v1051-scroll{overflow-x:auto;padding:4px 0 10px}.v1051-tree{display:flex;gap:18px;min-width:max-content}.v1051-round{width:235px;display:flex;flex-direction:column}.v1051-round h4{margin:0;background:#0f1e3a;color:#fff;text-align:center;padding:8px;border-radius:8px 8px 0 0}.v1051-round-body{display:flex;flex-direction:column;justify-content:space-around;gap:10px;flex:1;padding-top:10px}
    .v1051-match{border:1.5px solid #cbd5e1;border-left:7px solid var(--vc);border-radius:12px;background:linear-gradient(90deg,var(--vb),#fff);overflow:hidden;box-shadow:0 3px 11px rgba(15,30,58,.08)}.v1051-match header,.v1051-status header{display:flex;justify-content:space-between;align-items:center;padding:6px 8px;font-size:.72rem}.v1051-match header span,.v1051-status header span{background:#e0ecff;color:#1d4ed8;border-radius:999px;padding:2px 7px;font-weight:1000}.v1051-side{display:flex;justify-content:space-between;gap:8px;border-top:1px solid #e2e8f0;padding:7px 8px;font-size:.8rem}.v1051-side.win{background:#dcfce7;color:#166534}.v1051-side em{font-style:normal;color:#64748b}.v1051-match footer{border-top:1px dashed #e2e8f0;padding:5px 8px;text-align:center;font-size:.68rem;color:#64748b;font-weight:900}.v1051-result,.v1051-status-result{width:calc(100% - 16px);margin:0 8px 8px;border:0;border-radius:8px;background:#d4a017;padding:7px;font-weight:1000;cursor:pointer}
    .v1051-current{margin-top:16px;border-top:2px solid #e2e8f0;padding-top:8px}.v1051-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.v1051-status{border:1.5px solid #bfdbfe;border-radius:12px;background:#f8fbff;padding:8px}.v1051-status>div{font-size:.82rem;font-weight:1000;line-height:1.4}.v1051-status i{font-style:normal;color:#64748b;margin:0 5px}.v1051-status small{display:block;color:#64748b;font-size:.7rem;margin:6px 0;font-weight:800}
    @media(max-width:900px){.v1051-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.v1051-grid{grid-template-columns:1fr}.v1051-controls .v1051-btn{flex:1 1 100%}}
  `;document.head.appendChild(s);}
  function ensurePanel(){
    ensureCss();
    const host=$('v1051MainPanelHost');
    if(!host) return null;
    let p=$(PANEL_ID);
    if(!p){ p=document.createElement('section'); p.id=PANEL_ID; host.replaceChildren(p); }
    p.style.display='block'; p.style.visibility='visible'; p.style.opacity='1';
    const missing=!p.dataset.ready||!$('v1051DrawBtn')||!$('v1051AssignBtn')||!$('v1051RefreshBtn')||!$('v1051AutoBtn')||!$(BRACKET_ID);
    if(missing){
      p.innerHTML=`<div class="v1051-top"><b>🏆 새 본선 운영 · ${VERSION}</b><small>대진·결과·큐 단일 엔진</small></div><div class="v1051-controls"><button id="v1051DrawBtn" class="v1051-btn blue">🎲 새 본선 추첨</button><button id="v1051AssignBtn" class="v1051-btn purple">🎯 본선 코트배정</button><button id="v1051RefreshBtn" class="v1051-btn green">🔁 본선 큐 갱신</button><button id="v1051AutoBtn" class="v1051-btn auto-off">⏸ 자동배정 OFF</button></div><div class="v1051-note">64강 대진 전체를 먼저 만들고, 실제 점수와 승자를 다음 라운드에 즉시 반영합니다. 최초 배정은 각 코트 시합중 1경기 + 대기1 1경기, 나머지는 공용대기입니다.</div><div id="${BRACKET_ID}"></div>`;
      p.dataset.ready='1';
    }
    $('v1051DrawBtn').onclick=()=>generateDraw(selectedKey());
    $('v1051AssignBtn').onclick=async()=>{if(await assignInitial(selectedKey()))setAuto(true);};
    $('v1051RefreshBtn').onclick=()=>refreshQueue(selectedKey(),true);
    $('v1051AutoBtn').onclick=()=>setAuto(!autoOn());
    p.onclick=e=>{const b=e.target.closest('[data-v1051-result]');if(!b)return;const key=selectedKey();if(typeof window.openM3==='function')window.openM3(key,b.dataset.v1051Result);};
    updateAuto();return p;
  }
  function render(){const p=ensurePanel(),box=$(BRACKET_ID);if(!p||!box)return;const key=selectedKey();if(!hasData()||!key){box.innerHTML='<div class="v1051-empty">대회와 부서를 선택하세요.</div>';return;}syncTree(key);box.innerHTML=bracketHtml(key)+statusHtml(key);}
  function redrawHost(){try{if(typeof window.renderBracket==='function')window.renderBracket();}catch(_e){}setTimeout(render,50);}

  function afterResultSaved(keyHint){
    setTimeout(async()=>{
      try{
        const key=keyHint||selectedKey();
        if(!key||!G.matches[key]) return;
        if(G.draws[key]&&G.draws[key].v1051Main) G.matches[key]=arr(G.matches[key]).filter(m=>m.phase!=='main'||m.v1051Main===true);
        syncTree(key);
        if(autoOn()) await refreshQueue(key,false); else await persist(key);
        render();
        try{ if(typeof window.renderCourtBoard==='function') window.renderCourtBoard(); }catch(_e){}
        try{ if(typeof window.renderBracket==='function') window.renderBracket(); }catch(_e){}
        setTimeout(render,120);
      }catch(e){console.error('[v1051] post-result sync failed',e);}
    },180);
  }
  function wrapOneResultFunction(name){
    const old=window[name];
    if(typeof old!=='function'||old.__v1051Wrapped) return;
    const wrapped=async function(){
      const keyBefore=window.CM_key||selectedKey();
      try{return await old.apply(this,arguments);}
      finally{afterResultSaved(keyBefore);}
    };
    wrapped.__v1051Wrapped=true; wrapped.__old=old; window[name]=wrapped;
    try{ if(name==='saveM3') saveM3=wrapped; if(name==='saveM3Core') saveM3Core=wrapped; }catch(_e){}
  }
  function installResultHooks(){ wrapOneResultFunction('saveM3Core'); wrapOneResultFunction('saveM3'); }
  function installEvents(){
    document.addEventListener('change',e=>{if(e.target&&['brTS','brDS'].includes(e.target.id))setTimeout(render,100);},true);
    document.addEventListener('click',e=>{if(e.target&&e.target.closest('[onclick*="showPage"],#nav-bracket,.nav-item'))setTimeout(render,180);},true);
  }
  function boot(attempt=0){
    if(!hasData()||!$('page-bracket')){if(attempt<60)setTimeout(()=>boot(attempt+1),250);return;}
    ensurePanel();installResultHooks();installEvents();render();
    window.MainDrawV1051={version:VERSION,generateDraw,assignInitial,refreshQueue,render,syncTree,selectedKey,setAuto};
    window.startMainDraw=()=>generateDraw(selectedKey());window.buildMain=window.startMainDraw;window.v1051RefreshMainQueue=()=>refreshQueue(selectedKey(),true);
    log('static-host clean main engine loaded');
    (function watchdog(){
      try{ ensurePanel(); installResultHooks(); if(document.getElementById('page-bracket')?.classList.contains('active')) render(); }catch(e){ console.error('[v1051] watchdog',e); }
      setTimeout(watchdog,2500);
    })();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
})();
