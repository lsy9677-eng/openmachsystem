/*
 * 230MATCH v1038 — authoritative main draw + live queue engine
 * - Legacy main bracket/final-result renderer is disabled in dev.html at source.
 * - Owns the whole main bracket: 64 -> 32 -> 16 -> 8 -> SF -> Final.
 * - Keeps the existing court board UI/data contract.
 * - Shared queue never jumps directly to active court.
 */
(function(){
  'use strict';
  if(window.__V1038_MAIN_DRAW_INSTALLED__) return;
  window.__V1038_MAIN_DRAW_INSTALLED__=true;
  window.__CLEAN_MAIN_ONLY_MODE__=true;

  const VERSION='v1038-new-main-engine';
  const PANEL_ID='v1038MainPanel';
  const BRACKET_ID='v1038Bracket';
  const VENUES=['국제','능동','원도심','삼계','금병','동부','장유중','기타'];
  const VC={국제:'#2563eb',능동:'#7c3aed',원도심:'#16a34a',삼계:'#0891b2',금병:'#d97706',동부:'#be123c',장유중:'#475569',기타:'#64748b'};
  const VB={국제:'#eff6ff',능동:'#f5f3ff',원도심:'#ecfdf5',삼계:'#ecfeff',금병:'#fff7ed',동부:'#fff1f2',장유중:'#f8fafc',기타:'#f8fafc'};
  const S=v=>String(v==null?'':v).trim();
  const N=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
  const A=v=>Array.isArray(v)?v:[];
  const $=id=>document.getElementById(id);
  const esc=s=>S(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const now=()=>new Date().toISOString();
  const toast=(m,t='info')=>{try{typeof window.toast==='function'?window.toast(m,t):console.log('[v1038]',m);}catch(_){}};

  function hasData(){return !!(window.G&&G.draws&&G.matches&&G.teams);}
  function selectedKey(){
    try{const k=S(window.__CURRENT_RENDER_KEY||window.__v650CurrentGroupLabelKey);if(k&&G.draws[k])return k;}catch(_){ }
    try{
      const tid=S($('brTS')?.value||$('regTS')?.value||$('rankTS')?.value);
      let div=S($('brDS')?.value);
      if(div==='__ALL__')div='';
      if(!div&&Array.isArray(window.BR_MULTI_DIVS)){div=S(BR_MULTI_DIVS.find(x=>x&&x!=='__ALL__'));}
      if(tid&&div&&G.draws[tid+'_'+div])return tid+'_'+div;
      if(tid){const k=Object.keys(G.draws).find(x=>x.startsWith(tid+'_'));if(k)return k;}
    }catch(_){ }
    try{return Object.keys(G.draws||{})[0]||'';}catch(_){return '';}
  }
  function venueOfCourt(c){
    c=S(c); if(!c)return '';
    if(/국제|장유국제|gukje/i.test(c))return '국제';
    if(/능동|neung/i.test(c))return '능동';
    if(/원도심|원도|인조|wondo/i.test(c))return '원도심';
    if(/삼계|samgye/i.test(c))return '삼계';
    if(/금병|geum/i.test(c))return '금병';
    if(/동부|dongbu/i.test(c))return '동부';
    if(/장유중|클레이/i.test(c))return '장유중';
    return '기타';
  }
  function courtNo(c){const m=S(c).match(/(\d+)\s*$/);return m?Number(m[1]):9999;}
  function courtSort(a,b){return VENUES.indexOf(venueOfCourt(a))-VENUES.indexOf(venueOfCourt(b))||courtNo(a)-courtNo(b)||S(a).localeCompare(S(b),'ko');}
  function activeCourts(key){
    const sources=[];
    try{if(typeof window.getSelectedCourtFilters==='function')sources.push(window.getSelectedCourtFilters(key));}catch(_){ }
    try{if(window.OperationQueueV993?.getBoardCourtsForKey)sources.push(OperationQueueV993.getBoardCourtsForKey(key));}catch(_){ }
    try{if(typeof window.getUsedCourtsForKey==='function')sources.push(window.getUsedCourtsForKey(key));}catch(_){ }
    try{const d=G.draws[key]||{};sources.push(d.mainAllowedCourts,d.mainCourts,d.allowedCourts,d.courts);}catch(_){ }
    for(let si=0;si<sources.length;si++){
      const out=[];
      A(sources[si]).flat(Infinity).forEach(x=>{const c=S(x);if(c&&!/공용|대기|미배정|null|undefined/i.test(c)&&!out.includes(c))out.push(c);});
      if(out.length)return out.sort(courtSort);
    }
    return [];
  }
  function teamName(key,ti){
    try{
      const t=A(G.teams[key])[Number(ti)]||{};
      if(A(t.individualPlayers).length){const p=t.individualPlayers.slice(0,2).map(x=>S(x?.name||x)).filter(Boolean);if(p.length)return p.join(' / ');}
      if(A(t.players).length){const p=t.players.slice(0,2).map(S).filter(Boolean);if(p.length)return p.join(' / ');}
      return S(t.pairLabel||t.entryLabel||t.name||t.club||('팀 '+(Number(ti)+1))).replace(/\s*\([^)]*\)/g,'');
    }catch(_){return '팀 '+(Number(ti)+1);}
  }
  function groupNo(g,i){return Number(g?.confirmedGroupNo||g?.finalGroupNo||g?.displayGroupNo||g?.manualGroupNo||g?.groupNo||g?.no)||(i+1);}
  function resultState(key,m){
    try{if(typeof window.getMatchResultState==='function'){const s=window.getMatchResultState(key,m)||{};if(s.done||s.started||s.winner!=null||s.sc1!=null||s.sc2!=null)return s;}}catch(_){ }
    return {done:!!(m?.done||m?.completed||m?.status==='done'||m?.winner!=null),winner:m?.winner,sc1:N(m?.score1??m?.sc1)??0,sc2:N(m?.score2??m?.sc2)??0};
  }
  function winnerTeam(key,m){
    const st=resultState(key,m); if(!st.done)return null;
    let w=N(st.winner??m.winner);
    if(w==null){const a=N(st.sc1??m.score1??m.sc1),b=N(st.sc2??m.score2??m.sc2);if(a!=null&&b!=null&&a!==b)w=a>b?N(m.t1):N(m.t2);}
    if(w===1&&N(m.t1)!==1&&N(m.t2)!==1)return N(m.t1);
    if(w===2&&N(m.t1)!==2&&N(m.t2)!==2)return N(m.t2);
    return w;
  }
  function groupMatches(key,gi){return A(G.matches[key]).filter(m=>m&&m.phase==='group'&&Number(m.group)===Number(gi)&&!m.bye);}
  function groupComplete(key,gi){const ms=groupMatches(key,gi);return !!ms.length&&ms.every(m=>resultState(key,m).done);}
  function standings(key,gi,g){
    if(groupComplete(key,gi)){
      try{if(typeof window.calcGS==='function'){const r=A(window.calcGS(key,gi,A(g.teams),A(G.teams[key])));const out=r.map(x=>N(x?.ti??x?.teamIdx??x?.idx??x?.team)).filter(x=>x!=null);if(out.length)return out;}}catch(_){ }
      for(const f of ['standings','ranking','rankings','rankOrder','order']){const out=A(g?.[f]).map(x=>N(typeof x==='object'?(x.ti??x.teamIdx??x.idx??x.team):x)).filter(x=>x!=null);if(out.length)return out;}
    }
    return A(g?.teams).map(N).filter(x=>x!=null);
  }
  function collectSlots(key){
    const out=[];A(G.draws[key]?.groups).forEach((g,gi)=>{const gn=groupNo(g,gi),rank=standings(key,gi,g),done=groupComplete(key,gi);[1,2].forEach(rk=>{const ti=done?N(rank[rk-1]):null;out.push({gi,gn,rk,ti,label:`${gn}조 ${rk}위`,name:ti!=null?teamName(key,ti):`${gn}조 ${rk}위`});});});return out;
  }
  function shuffle(x){const a=x.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function pairSlots(entries){
    const a=shuffle(entries.filter(x=>x.rk===1)), b=shuffle(entries.filter(x=>x.rk===2)), out=[];
    a.forEach(x=>{let i=b.findIndex(y=>y.gn!==x.gn);if(i<0)i=0;out.push([x,b.splice(i,1)[0]||null]);});
    b.forEach(x=>out.push([null,x]));return shuffle(out);
  }
  function nextPow2(n){let p=1;while(p<n)p*=2;return p;}
  function roundName(size,r){const n=size/Math.pow(2,r);if(n===2)return '결승';if(n===4)return '준결승';return n+'강';}
  function balancedOrder(count){
    // 32 matches => 1,32,2,16,17,31,3,15,18,30 ...
    const out=[],seen=new Set();
    const add=x=>{if(x>=0&&x<count&&!seen.has(x)){seen.add(x);out.push(x);}};
    let lo=0,hi=count-1;while(lo<=hi){add(lo++);add(hi--);if(lo<=hi){const mid=Math.floor((lo+hi)/2);add(mid);add(mid+1);}}
    for(let i=0;i<count;i++)add(i);return out;
  }
  function mainMatches(key){return A(G.matches[key]).filter(m=>m&&m.phase==='main'&&m.v1038Main);}
  function getMatch(key,r,slot){return mainMatches(key).find(m=>Number(m.round)===r&&Number(m.slot)===slot);}
  function makeBaseMatch(key,size,r,slot){return {id:`v1038_${r}_${slot}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,phase:'main',round:r,slot,bracketN:size,t1:null,t2:null,winner:null,rubbers:[],display1:'TBD',display2:'TBD',source1Label:r?`${slot*2+1}경기 승자`:'',source2Label:r?`${slot*2+2}경기 승자`:'',court:'',courts:[],manualCourtTarget:'',v1038Main:true,cleanMainDraw:true,createdAt:now(),updatedAt:now()};}
  function createAllRounds(key,size,pairs,venues){
    const order=balancedOrder(size/2),seq={};order.forEach((s,i)=>seq[s]=i+1);
    const all=[];
    for(let r=0;r<Math.log2(size);r++){
      const count=size/Math.pow(2,r+1);
      for(let slot=0;slot<count;slot++){
        const m=makeBaseMatch(key,size,r,slot);
        if(r===0){
          const [a,b]=pairs[slot]||[]; const v=venues[slot]||venues[0]||'국제';
          Object.assign(m,{t1:a?.ti??null,t2:b?.ti??null,display1:a?.name||a?.label||'TBD',display2:b?.name||b?.label||'TBD',sourceGi1:a?.gi??null,sourceGi2:b?.gi??null,sourceGroup1:a?.gn??null,sourceGroup2:b?.gn??null,sourceRank1:a?.rk??null,sourceRank2:b?.rk??null,source1Label:a?.label||'',source2Label:b?.label||'',venue:v,venueLabel:v,__venue:v,mainBlock:v,mainQueueSeq:seq[slot]||slot+1});
        }else Object.assign(m,{mainQueueSeq:10000+r*1000+slot,venue:venues[Math.min(venues.length-1,slot*Math.pow(2,r))]||'국제'});
        all.push(m);
      }
    }
    return all;
  }
  function resolveFirstRound(key){
    const groups=A(G.draws[key]?.groups);let changed=false;
    mainMatches(key).filter(m=>m.round===0).forEach(m=>{
      [1,2].forEach(side=>{const gi=N(m['sourceGi'+side]),rk=N(m['sourceRank'+side]);if(gi==null||rk==null||!groups[gi]||!groupComplete(key,gi))return;const ti=N(standings(key,gi,groups[gi])[rk-1]);if(ti!=null&&(N(m['t'+side])!==ti||m['display'+side]!==teamName(key,ti))){m['t'+side]=ti;m['display'+side]=teamName(key,ti);m.updatedAt=now();changed=true;}});
    });return changed;
  }
  function syncProgression(key){
    let changed=resolveFirstRound(key);const size=Number(G.draws[key]?.mainDrawSize||64);
    for(let r=1;r<Math.log2(size);r++){
      const count=size/Math.pow(2,r+1);
      for(let slot=0;slot<count;slot++){
        const m=getMatch(key,r,slot),a=getMatch(key,r-1,slot*2),b=getMatch(key,r-1,slot*2+1);if(!m||!a||!b)continue;
        const w1=winnerTeam(key,a),w2=winnerTeam(key,b);
        const n1=w1!=null?teamName(key,w1):`${slot*2+1}경기 승자`,n2=w2!=null?teamName(key,w2):`${slot*2+2}경기 승자`;
        if(N(m.t1)!==w1||N(m.t2)!==w2||m.display1!==n1||m.display2!==n2){m.t1=w1;m.t2=w2;m.display1=n1;m.display2=n2;m.updatedAt=now();clearQueue(m);changed=true;}
      }
    }
    return changed;
  }
  function currentRound(key){
    const size=Number(G.draws[key]?.mainDrawSize||64);
    for(let r=0;r<Math.log2(size);r++){
      const ms=mainMatches(key).filter(m=>m.round===r);if(ms.some(m=>m.t1!=null&&m.t2!=null&&!resultState(key,m).done))return roundName(size,r);
      if(ms.some(m=>m.t1==null||m.t2==null))return roundName(size,r);
    }
    return '대회 완료';
  }
  function isReady(key,m){return !resultState(key,m).done&&m.t1!=null&&m.t2!=null;}
  function clearQueue(m){delete m.court;delete m.currentCourt;delete m.manualCourtTarget;delete m.waitingFirstAt;delete m.lastWaitingFirstAt;delete m.manualSharedHold;delete m.__sharedCourtLabel;delete m.__queueStatus;m.courts=[];}
  function setActive(m,c,i=0){m.court=c;m.currentCourt=c;m.courts=[c];m.manualCourtTarget=c;m.__queueStatus='active';m.courtAssignedAt=m.courtAssignedAt||now();m.courtQueueOrder=Date.now()+i;}
  function setWait(m,c,i=0){delete m.court;delete m.currentCourt;m.courts=[c];m.manualCourtTarget=c;m.waitingFirstAt=m.waitingFirstAt||now();m.__queueStatus='wait1';m.courtQueueOrder=Date.now()+i;}
  function setShared(m,v,i=0){delete m.court;delete m.currentCourt;delete m.manualCourtTarget;m.courts=[];m.manualSharedHold=true;m.__sharedCourtLabel=v;m.__queueStatus='shared';m.courtQueueOrder=Date.now()+i;}
  async function persist(key){
    try{if(window.__FB_WRITE_CACHE){delete __FB_WRITE_CACHE.matches?.[key];delete __FB_WRITE_CACHE.draws?.[key];}}catch(_){ }
    try{if(typeof window.stM==='function')await window.stM(key);}catch(e){console.warn('[v1038] stM',e);}
    try{if(typeof window.stD==='function')await window.stD(key);}catch(e){console.warn('[v1038] stD',e);}
  }
  function venuePlan(key,count){
    const cs=activeCourts(key);const map={};cs.forEach(c=>{const v=venueOfCourt(c);(map[v]||(map[v]=[])).push(c);});
    const vs=Object.keys(map).sort((a,b)=>map[b].length-map[a].length||VENUES.indexOf(a)-VENUES.indexOf(b));if(!vs.length)return {courts:[],venues:Array(count).fill('국제')};
    const venues=[];let i=0;while(venues.length<count){venues.push(vs[i++%vs.length]);}return {courts:cs,venues};
  }
  async function newDraw(key,mode='redistribute'){
    key=key||selectedKey();if(!key||!hasData()){toast('대회와 부서를 먼저 선택하세요','error');return;}
    const slots=collectSlots(key);if(slots.length<2){toast('예선 조편성 후 실행하세요','info');return;}
    const size=nextPow2(slots.length),matchCount=size/2,pairs=pairSlots(slots);while(pairs.length<matchCount)pairs.push([null,null]);
    const plan=venuePlan(key,matchCount);const old=A(G.matches[key]).filter(m=>m.phase!=='main'&&m.phase!=='playin'&&m.phase!=='bronze');
    G.matches[key]=old.concat(createAllRounds(key,size,pairs.slice(0,matchCount),plan.venues));
    G.draws[key]=Object.assign({},G.draws[key],{mainDrawSize:size,mainDrawVersion:VERSION,v1038Main:true,mainDrawAt:now(),mainQueueOrder:balancedOrder(matchCount)});
    await persist(key);renderAll(key);toast(`${size}강 본선 대진 생성 완료`,'success');
  }
  async function initialAssign(key){
    key=key||selectedKey();syncProgression(key);const cs=activeCourts(key);if(!cs.length){toast('선택된 본선 코트가 없습니다','error');return;}
    const ready=mainMatches(key).filter(m=>isReady(key,m)).sort((a,b)=>Number(a.mainQueueSeq)-Number(b.mainQueueSeq));if(!ready.length){toast('배정 가능한 본선 경기가 없습니다','info');return;}
    ready.forEach(clearQueue);let idx=0;
    for(const c of cs){const m=ready.shift();if(m)setActive(m,c,idx++);}
    for(const c of cs){const m=ready.shift();if(m)setWait(m,c,idx++);}
    ready.forEach(m=>setShared(m,venueOfCourt(m.venue)||venueOfCourt(cs[0]),idx++));
    await persist(key);try{window.renderBracket?.();}catch(_){ }renderAll(key);toast('본선 코트 초기 배정 완료','success');
  }
  async function reconcileQueue(key,manual=false){
    key=key||selectedKey();if(!key||!hasData())return false;let changed=syncProgression(key);const cs=activeCourts(key);if(!cs.length)return false;
    const all=mainMatches(key),ready=all.filter(m=>isReady(key,m));
    // completed matches release their court
    all.filter(m=>resultState(key,m).done&&(m.court||m.manualCourtTarget||m.manualSharedHold)).forEach(m=>{clearQueue(m);changed=true;});
    // newly available matches always enter shared queue
    ready.forEach(m=>{if(!m.court&&!m.manualCourtTarget&&!m.manualSharedHold&&!m.__queueStatus){setShared(m,venueOfCourt(m.venue)||venueOfCourt(cs[0]),0);changed=true;}});
    for(const c of cs){
      let active=ready.find(m=>S(m.court)===S(c));
      let wait=ready.find(m=>!m.court&&S(m.manualCourtTarget)===S(c));
      if(!active&&wait){setActive(wait,c,0);changed=true;active=wait;wait=null;}
      if(!wait){const v=venueOfCourt(c);const q=ready.filter(m=>m.manualSharedHold&&!m.court&&!m.manualCourtTarget&&venueOfCourt(m.__sharedCourtLabel||m.venue)===v).sort((a,b)=>Number(a.mainQueueSeq)-Number(b.mainQueueSeq));if(q[0]){setWait(q[0],c,0);changed=true;}}
    }
    if(changed){await persist(key);try{window.renderBracket?.();}catch(_){ }renderAll(key);if(manual)toast('본선 큐 갱신 완료','success');}
    else if(manual)toast('변경할 본선 큐가 없습니다','info');return changed;
  }
  function matchStatus(key,m){
    const size=Number(G.draws[key]?.mainDrawSize||64),label=roundName(size,m.round),st=resultState(key,m);
    if(st.done)return `${label} · 완료 ${st.sc1??0}:${st.sc2??0}`;
    if(m.court)return `${label} · 시합중 - ${m.court}`;
    if(m.manualCourtTarget)return `${label} · 코트 대기1 - ${m.manualCourtTarget}`;
    if(m.manualSharedHold)return `${label} · 공용대기 - ${m.__sharedCourtLabel||venueOfCourt(m.venue)}`;
    if(m.t1==null||m.t2==null)return `${label} · 이전 라운드 승자 대기`;
    return `${label} · 배정 대기`;
  }
  function card(key,m){
    const v=venueOfCourt(m.court||m.manualCourtTarget||m.__sharedCourtLabel||m.venue)||'국제',st=resultState(key,m),w=winnerTeam(key,m);
    const n1=m.t1!=null?teamName(key,m.t1):m.display1||'TBD',n2=m.t2!=null?teamName(key,m.t2):m.display2||'TBD';
    return `<div class="v1038-match" style="--v:${VC[v]||VC.기타};--bg:${VB[v]||VB.기타}"><div class="v1038-top"><b>${m.slot+1}경기</b><span>${esc(v)}</span></div><div class="v1038-side ${w!=null&&w===N(m.t1)?'win':''}"><span>${esc(n1)}</span><small>${st.done?(st.sc1??0):0}</small></div><div class="v1038-side ${w!=null&&w===N(m.t2)?'win':''}"><span>${esc(n2)}</span><small>${st.done?(st.sc2??0):0}</small></div><div class="v1038-status">${esc(matchStatus(key,m))}</div>${m.t1!=null&&m.t2!=null?`<button class="v1038-result" onclick="window.openM3&&window.openM3('${key}','${m.id}')">${st.done?'결과 수정':'결과 입력'}</button>`:''}</div>`;
  }
  function bracketHtml(key){
    const ms=mainMatches(key);if(!ms.length)return '<div class="v1038-empty">새 본선 대진이 없습니다. 새 본선 추첨을 실행하세요.</div>';
    syncProgression(key);const size=Number(G.draws[key]?.mainDrawSize||64);let h=`<div class="v1038-current">현재 진행 라운드: <b>${currentRound(key)}</b></div><div class="v1038-scroll"><div class="v1038-bracket">`;
    for(let r=0;r<Math.log2(size);r++){h+=`<section class="v1038-round"><h3>${roundName(size,r)}</h3><div class="v1038-roundbody">`;mainMatches(key).filter(m=>m.round===r).sort((a,b)=>a.slot-b.slot).forEach(m=>h+=card(key,m));h+='</div></section>';}
    return h+'</div></div>';
  }
  function style(){if($('v1038Style'))return;const s=document.createElement('style');s.id='v1038Style';s.textContent=`#${PANEL_ID}{margin:12px 0 18px;padding:16px;border:2px solid #93c5fd;border-radius:18px;background:#fff;box-shadow:0 12px 30px rgba(15,30,58,.09)}.v1038-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-weight:1000;color:#0f1e3a;margin-bottom:10px}.v1038-controls{display:grid;grid-template-columns:1fr auto auto auto;gap:8px;margin-bottom:10px}.v1038-controls select,.v1038-controls button{min-height:40px;border-radius:12px;font-weight:1000}.v1038-controls select{border:1.5px solid #cbd5e1;padding:6px 10px}.v1038-controls button{border:0;padding:8px 13px;color:#fff;cursor:pointer}.v1038-draw{background:#2563eb}.v1038-assign{background:#7c3aed}.v1038-refresh{background:#0f766e}.v1038-current{padding:9px 12px;border-radius:12px;background:#eff6ff;color:#1d4ed8;font-weight:900;margin-bottom:10px}.v1038-scroll{overflow-x:auto}.v1038-bracket{display:flex;gap:18px;min-width:max-content;align-items:stretch}.v1038-round{width:235px;display:flex;flex-direction:column}.v1038-round h3{margin:0;background:#0f1e3a;color:#fff;padding:8px;text-align:center;border-radius:9px 9px 0 0;font-size:.86rem}.v1038-roundbody{display:flex;flex-direction:column;justify-content:space-around;gap:10px;flex:1;padding-top:10px}.v1038-match{border:1.5px solid #cbd5e1;border-left:7px solid var(--v);border-radius:12px;background:linear-gradient(90deg,var(--bg),#fff);overflow:hidden;box-shadow:0 3px 10px rgba(15,30,58,.07)}.v1038-top{display:flex;justify-content:space-between;padding:6px 8px;font-size:.72rem}.v1038-top span{background:var(--v);color:#fff;border-radius:999px;padding:2px 7px;font-weight:1000}.v1038-side{display:flex;justify-content:space-between;gap:8px;padding:7px 8px;border-top:1px solid #e2e8f0;font-weight:900;font-size:.8rem}.v1038-side.win{background:#dcfce7;color:#166534}.v1038-status{padding:5px 8px;text-align:center;border-top:1px dashed #cbd5e1;font-size:.68rem;color:#64748b;font-weight:900}.v1038-result{width:calc(100% - 16px);margin:0 8px 8px;border:0;border-radius:9px;background:#d4a017;padding:7px;font-weight:1000}.v1038-empty{padding:20px;border:1px dashed #cbd5e1;border-radius:14px;text-align:center;color:#64748b;font-weight:900}@media(max-width:700px){.v1038-controls{grid-template-columns:1fr}.v1038-controls button{width:100%}}`;document.head.appendChild(s);}
  function ensurePanel(){
    style();let p=$(PANEL_ID),host=$('bracketContent')||$('page-bracket')||document.body;if(!p){p=document.createElement('div');p.id=PANEL_ID;const sel=host.querySelector('.card');sel?.parentNode?sel.parentNode.insertBefore(p,sel):host.prepend(p);}p.innerHTML=`<div class="v1038-head"><span>🏆 새 본선 운영 패널 <small>${VERSION}</small></span><small>64강부터 실제 결과 연동</small></div><div class="v1038-controls"><select id="v1038Mode"><option value="redistribute">선택 코트 기준 균등 배정</option><option value="keep">예선 구장 유지</option></select><button class="v1038-draw" id="v1038Draw">🎲 새 본선 추첨</button><button class="v1038-assign" id="v1038Assign">🎯 본선 코트배정</button><button class="v1038-refresh" id="v1038Refresh">🔁 본선 큐 갱신</button></div><div id="${BRACKET_ID}"></div>`;
    $('v1038Draw').onclick=()=>newDraw(selectedKey(),$('v1038Mode').value);$('v1038Assign').onclick=()=>initialAssign(selectedKey());$('v1038Refresh').onclick=()=>reconcileQueue(selectedKey(),true);renderPanel(selectedKey());
  }
  function renderPanel(key){const b=$(BRACKET_ID);if(!b)return;b.innerHTML=key&&hasData()?bracketHtml(key):'<div class="v1038-empty">대회와 부서를 선택하세요.</div>';}
  function renderAll(key){ensurePanel();renderPanel(key||selectedKey());}
  function hookSave(){
    const f=window.saveM3;if(typeof f!=='function'||f.__v1038)return;
    const w=async function(){const r=await f.apply(this,arguments);setTimeout(()=>reconcileQueue(selectedKey(),false),100);setTimeout(()=>renderAll(selectedKey()),300);return r;};w.__v1038=true;w.__base=f;window.saveM3=w;
  }
  function install(){
    window.MainDrawV1038={version:VERSION,newDraw,initialAssign,reconcileQueue,renderPanel,selectedKey};
    window.startMainDraw=()=>newDraw(selectedKey(),$('v1038Mode')?.value||'redistribute');window.buildMain=window.startMainDraw;window.v773RunMainAssign=()=>initialAssign(selectedKey());
    const mount=()=>{hookSave();ensurePanel();};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,250));else setTimeout(mount,100);
    setInterval(()=>{try{hookSave();reconcileQueue(selectedKey(),false);renderPanel(selectedKey());}catch(e){console.warn('[v1038] tick',e);}},2500);
    const obs=new MutationObserver(()=>{if(!$ (PANEL_ID))setTimeout(mount,50);});obs.observe(document.body,{childList:true,subtree:true});
    console.info('[v1038] new main engine loaded');
  }
  install();
})();
