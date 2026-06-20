/* v1004 clean 64 bracket renderer - legacy bracket replaced
   - old main draw UI is hidden, not patched
   - no provisional draw before prelim results are complete
   - 64 teams => 64 draw, no byes, rank1 vs rank2, no same group
*/
(function(){
  'use strict';
  if(window.__V1004_MAIN_DRAW_CLEAN_INSTALLED) return;
  window.__V1004_MAIN_DRAW_CLEAN_INSTALLED = true;
  const VERSION = 'v1004-clean-64-bracket-renderer';
  const VENUE_ORDER = ['국제','능동','원도심','삼계','금병','동부','장유중','기타'];
  const VENUE_COLOR = {국제:'#2563eb',능동:'#7c3aed',원도심:'#16a34a',삼계:'#0891b2',금병:'#d97706',동부:'#be123c',장유중:'#475569',기타:'#64748b'};
  const VENUE_BG = {국제:'#eff6ff',능동:'#f5f3ff',원도심:'#ecfdf5',삼계:'#ecfeff',금병:'#fff7ed',동부:'#fff1f2',장유중:'#f8fafc',기타:'#f8fafc'};

  function $(id){return document.getElementById(id)}
  function ar(v){return Array.isArray(v)?v:[]}
  function S(v){return String(v==null?'':v).trim()}
  function N(v){const n=Number(v); return Number.isFinite(n)?n:null}
  function esc(s){return S(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function toast(msg,type){try{ if(typeof window.toast==='function') window.toast(msg,type||'info'); else console.log('[v1003]',msg); }catch(e){ console.log('[v1003]',msg); }}
  function now(){return new Date().toISOString()}
  function ge(id){ try{return document.getElementById(id)}catch(e){return null} }

  function selectedKey(){
    try{ const k=S(window.__CURRENT_RENDER_KEY||window.__v650CurrentGroupLabelKey||''); if(k && window.G && G.draws && G.draws[k]) return k; }catch(e){}
    try{
      const tid=S((ge('brTS')&&ge('brTS').value)||(ge('regTS')&&ge('regTS').value)||(ge('rankTS')&&ge('rankTS').value)||'');
      if(tid){
        let div=''; const brDS=ge('brDS');
        if(brDS && brDS.value && brDS.value!=='__ALL__') div=S(brDS.value);
        if(!div && Array.isArray(window.BR_MULTI_DIVS) && window.BR_MULTI_DIVS.length && !window.BR_MULTI_DIVS.includes('__ALL__')) div=S(window.BR_MULTI_DIVS[0]);
        if(div) return tid+'_'+div;
        const keys=Object.keys((window.G&&G.draws)||{}).filter(k=>k.indexOf(tid+'_')===0);
        if(keys.length) return keys[0];
      }
    }catch(e){}
    try{return Object.keys((window.G&&G.draws)||{})[0]||'';}catch(e){return ''}
  }
  function splitKey(key){const i=S(key).lastIndexOf('_'); return {tid:S(key).slice(0,i), div:S(key).slice(i+1)};}

  function venueOfCourt(court){
    const c=S(court);
    if(!c) return '';
    if(/국제|장유국제/.test(c)) return '국제';
    if(/능동/.test(c)) return '능동';
    if(/원도심|원도|인조/.test(c)) return '원도심';
    if(/삼계/.test(c)) return '삼계';
    if(/금병/.test(c)) return '금병';
    if(/동부/.test(c)) return '동부';
    if(/장유중|클레이/.test(c)) return '장유중';
    return '';
  }
  function teamName(key, ti){
    try{
      const t=ar(G&&G.teams&&G.teams[key])[Number(ti)]||{};
      if(t.pairLabel) return S(t.pairLabel);
      if(t.entryLabel) return S(t.entryLabel);
      if(Array.isArray(t.individualPlayers)&&t.individualPlayers.length) return t.individualPlayers.slice(0,2).map(p=>S((p&&p.name)||p)).filter(Boolean).join(' / ');
      if(Array.isArray(t.players)&&t.players.length) return t.players.slice(0,2).map(S).filter(Boolean).join(' / ');
      return S(t.club||t.name||('T'+ti));
    }catch(e){ return 'T'+ti; }
  }
  function groupNo(g,gi){
    return Number(g&&(g.confirmedGroupNo||g.finalGroupNo||g.displayGroupNo||g.manualGroupNo||g.v702GroupNo||g.groupNo||g.no)) || (Number(gi)+1);
  }
  function groupMatches(key, gi){
    return ar(G&&G.matches&&G.matches[key]).filter(m=>String(m.phase||'')==='group' && Number(m.group)===Number(gi));
  }
  function groupComplete(key, gi){
    const ms=groupMatches(key,gi);
    if(!ms.length) return false;
    return ms.every(m=>m.winner!=null || m.done===true || m.status==='done' || m.completed===true);
  }
  function prelimComplete(key){
    const groups=ar(G&&G.draws&&G.draws[key]&&G.draws[key].groups);
    if(!groups.length) return false;
    return groups.every((g,gi)=>groupComplete(key,gi));
  }
  function groupSignature(key){
    try{
      const draw=(G&&G.draws&&G.draws[key])||{};
      const parts=ar(draw.groups).map((g,gi)=>{
        const teams=ar(g&&g.teams).map(x=>N(x)).join(',');
        const ms=groupMatches(key,gi).map(m=>[m.id,m.t1,m.t2,m.winner,m.score1,m.score2,m.court,m.manualCourtTarget].map(S).join(':')).join('|');
        return `${groupNo(g,gi)}[${teams}]<${ms}>`;
      });
      return parts.join('||');
    }catch(e){return ''}
  }
  function groupVenue(key,g,gi){
    const candidates=[];
    try{ if(g){ candidates.push(g.court,g.manualCourt,g.manualCourtTarget); if(Array.isArray(g.courts)) candidates.push(...g.courts); } }catch(e){}
    try{ groupMatches(key,gi).forEach(m=>{candidates.push(m.court,m.manualCourtTarget,m.currentCourt); if(Array.isArray(m.courts)) candidates.push(...m.courts);}); }catch(e){}
    for(const c of candidates){ const v=venueOfCourt(c); if(v) return v; }
    return '기타';
  }
  function standings(key, gi, g){
    try{
      const teams=ar(G&&G.teams&&G.teams[key]);
      if(typeof window.calcGS==='function'){
        const rows=ar(window.calcGS(key,gi,ar(g&&g.teams),teams));
        const arr=rows.map(r=>N(r&&(r.ti??r.teamIdx??r.idx))).filter(v=>v!=null);
        if(arr.length) return arr;
      }
    }catch(e){}
    for(const f of ['standings','ranking','rankings','rankOrder','order']){
      const arr=ar(g&&g[f]).map(x=>N((x&&typeof x==='object')?(x.ti??x.teamIdx??x.idx??x.team):x)).filter(v=>v!=null);
      if(arr.length) return arr;
    }
    return ar(g&&g.teams).map(N).filter(v=>v!=null);
  }
  function collectEntries(key){
    const out=[]; const groups=ar(G&&G.draws&&G.draws[key]&&G.draws[key].groups);
    groups.forEach((g,gi)=>{
      const gn=groupNo(g,gi); const st=standings(key,gi,g); const venue=groupVenue(key,g,gi);
      [1,2].forEach(rk=>{
        const ti=N(st[rk-1]);
        if(ti!=null) out.push({ti, rk, gi, gn, venue, label:`${gn}조${rk}위`, nm:teamName(key,ti)});
      });
    });
    return out;
  }
  function nextPow2(n){let p=1; while(p<n)p*=2; return p;}
  function pairRank1Rank2(entries){
    const r1=entries.filter(e=>e.rk===1).sort((a,b)=>a.gn-b.gn);
    const base2=entries.filter(e=>e.rk===2).sort((a,b)=>a.gn-b.gn);
    if(!r1.length || !base2.length) return [];
    for(let shift=1; shift<base2.length; shift++){
      const r2=base2.map((_,i)=>base2[(i+shift)%base2.length]);
      if(r1.every((e,i)=>e.gn!==r2[i].gn)) return r1.map((e,i)=>[e,r2[i]]);
    }
    const pool=base2.slice();
    return r1.map(e=>{let i=pool.findIndex(x=>x.gn!==e.gn); if(i<0)i=0; return [e,pool.splice(i,1)[0]||null];});
  }
  function mainCourts(key){
    try{ if(window.OperationQueueV993 && typeof OperationQueueV993.getBoardCourtsForKey==='function'){const x=OperationQueueV993.getBoardCourtsForKey(key); if(x&&x.length) return x.map(S).filter(Boolean);} }catch(e){}
    try{ if(typeof window.getUsedCourtsForKey==='function'){const x=window.getUsedCourtsForKey(key); if(x&&x.length) return x.map(S).filter(Boolean);} }catch(e){}
    try{ const d=G.draws[key]||{}; return [d.mainCourts,d.allowedCourts,d.courts].flatMap(x=>Array.isArray(x)?x:[]).map(S).filter(Boolean); }catch(e){return []}
  }
  function venueGroups(key){
    const map={}; mainCourts(key).forEach(c=>{const v=venueOfCourt(c)||'기타'; (map[v]||(map[v]=[])).push(c);});
    const arr=Object.keys(map).map(v=>({venue:v,courts:map[v],count:map[v].length})).sort((a,b)=>b.count-a.count || VENUE_ORDER.indexOf(a.venue)-VENUE_ORDER.indexOf(b.venue));
    return arr.length?arr:[{venue:'국제',courts:[],count:1}];
  }
  function venueForSlots(key, count, mode, pairs){
    const vg=venueGroups(key);
    if(mode==='keep') return pairs.map(p=>p[0]?.venue || p[1]?.venue || vg[0].venue);
    const total=vg.reduce((s,v)=>s+Math.max(1,v.count),0)||1;
    const arr=[]; let used=0;
    vg.forEach((v,i)=>{let n=i===vg.length-1?count-used:Math.round(count*Math.max(1,v.count)/total); used+=n; for(let k=0;k<n;k++) arr.push(v.venue);});
    while(arr.length<count) arr.push(vg[0].venue);
    return arr.slice(0,count);
  }
  function makeMatch(key, slot, e1, e2, venue, size){
    const id=`v1003_main_${slot}_${Date.now()}`;
    return {id,phase:'main',round:0,slot,bracketN:size,winner:null,rubbers:[],court:'',courts:[],manualCourtTarget:'',
      t1:e1?.ti??null,t2:e2?.ti??null,display1:e1?.nm||e1?.label||'',display2:e2?.nm||e2?.label||'부전승',
      source1Label:e1?.label||'',source2Label:e2?.label||'부전승',sourceGroup1:e1?.gn??null,sourceGroup2:e2?.gn??null,sourceRank1:e1?.rk??null,sourceRank2:e2?.rk??null,
      venue,venueLabel:venue,__venue:venue,mainBlock:venue,cleanMainDraw:true,v1003CleanMain:true,createdAt:now(),updatedAt:now()};
  }
  async function persist(key){
    try{ if(window.__FB_WRITE_CACHE){ if(__FB_WRITE_CACHE.draws) delete __FB_WRITE_CACHE.draws[key]; if(__FB_WRITE_CACHE.matches) delete __FB_WRITE_CACHE.matches[key]; } }catch(e){}
    try{ if(typeof window.stM==='function') await window.stM(key); else if(typeof stM==='function') await stM(key); }catch(e){console.warn('[v1003] stM failed',e)}
    try{ if(typeof window.stD==='function') await window.stD(key); else if(typeof stD==='function') await stD(key); }catch(e){console.warn('[v1003] stD failed',e)}
    try{ if(typeof window.waitForPendingWrites==='function' && window.db) await window.waitForPendingWrites(window.db); }catch(e){}
  }
  async function generateDraw(key, mode){
    key=key||selectedKey(); if(!key){toast('대회와 부서를 먼저 선택하세요','error');return false;}
    if(!prelimComplete(key)){renderInfo(key); toast('예선 결과가 확정되지 않았습니다. 예선 완료 후 본선 추첨을 실행하세요.','info'); return false;}
    const entries=collectEntries(key); if(entries.length<2){toast('본선 진출팀을 찾을 수 없습니다','error');return false;}
    const size=nextPow2(entries.length); const matchCount=size/2;
    let pairs=[];
    if(entries.length===64 || entries.filter(e=>e.rk===1).length===entries.filter(e=>e.rk===2).length){ pairs=pairRank1Rank2(entries); }
    if(!pairs.length){ const q=entries.slice(); while(q.length){pairs.push([q.shift(),q.shift()||null]);} }
    while(pairs.length<matchCount) pairs.push([entries.find(e=>e.rk===1&&!pairs.flat().includes(e))||null,null]);
    const venues=venueForSlots(key,matchCount,mode,pairs);
    const old=ar(G.matches&&G.matches[key]).filter(m=>String(m.phase||'')!=='main' && String(m.phase||'')!=='playin');
    const mains=pairs.slice(0,matchCount).map((p,i)=>makeMatch(key,i,p[0],p[1],venues[i],size));
    G.matches[key]=old.concat(mains);
    const sig=groupSignature(key);
    G.draws[key]=Object.assign({},G.draws[key]||{}, {cleanMainDraw:true,cleanMainDrawVersion:VERSION,mainDrawMode:mode,mainDrawSize:size,mainDrawAt:now(),mainDrawGroupSignature:sig,mainDrawVenueSegments:segments(venues)});
    await persist(key);
    try{ if(typeof window.renderBracket==='function') window.renderBracket(); }catch(e){}
    setTimeout(()=>{ensurePanel(); hideLegacyMainUi(); renderClean(key);},150);
    toast(`새 본선 추첨 완료: ${size}강 · ${mains.length}경기`,'success');
    return true;
  }
  function segments(venues){const out=[]; venues.forEach((v,i)=>{let last=out[out.length-1]; if(!last||last.venue!==v) out.push({venue:v,start:i,end:i,count:1}); else{last.end=i;last.count++;}}); return out;}
  async function assignCourts(key){
    key=key||selectedKey(); if(!key){toast('대회와 부서를 먼저 선택하세요','error');return false;}
    const mains=ar(G.matches&&G.matches[key]).filter(m=>String(m.phase||'')==='main'&&m.cleanMainDraw&&!m.winner);
    if(!mains.length){toast('배정할 새 본선 경기가 없습니다. 먼저 새 본선 추첨을 실행하세요.','info');return false;}
    const vg=venueGroups(key); const byVenue={}; vg.forEach(v=>byVenue[v.venue]=v.courts.slice());
    const allCourts=Object.values(byVenue).flat(); if(!allCourts.length){toast('사용 코트를 찾을 수 없습니다','error');return false;}
    const occ={}; allCourts.forEach(c=>occ[c]={cur:0,wait:0});
    ar(G.matches&&G.matches[key]).filter(m=>!m.winner && !(String(m.phase||'')==='main'&&m.cleanMainDraw)).forEach(m=>{
      const c=S(m.court||m.currentCourt||''); if(c&&occ[c]) occ[c].cur++;
      const w=S(m.manualCourtTarget||(Array.isArray(m.courts)&&m.courts[0])||''); if(w&&occ[w]) occ[w].wait++;
    });
    mains.forEach(m=>{m.court='';m.courts=[];m.manualCourtTarget='';m.__sharedCourtLabel='';});
    let assigned=0, queued=0;
    mains.forEach((m,i)=>{
      const v=S(m.venue||m.venueLabel||m.__venue)||vg[0].venue; const courts=(byVenue[v]&&byVenue[v].length?byVenue[v]:allCourts);
      let done=false;
      for(const c of courts){const o=occ[c]||(occ[c]={cur:0,wait:0}); if(o.cur===0){m.court=c;m.courts=[c];m.manualCourtTarget=c;o.cur++;assigned++;done=true;break;}}
      if(!done){for(const c of courts){const o=occ[c]||(occ[c]={cur:0,wait:0}); if(o.wait===0){m.courts=[c];m.manualCourtTarget=c;o.wait++;assigned++;done=true;break;}}}
      if(!done){m.__sharedCourtLabel=courts[0]||''; queued++;}
      m.courtQueueOrder=Date.now()+i; m.updatedAt=now();
    });
    await persist(key); try{if(typeof window.renderBracket==='function') window.renderBracket();}catch(e){}
    setTimeout(()=>{ensurePanel(); hideLegacyMainUi(); renderClean(key);},150);
    toast(`새 본선 코트배정 완료: 배정 ${assigned}경기 · 공용대기 ${queued}경기`,'success'); return true;
  }
  function renderInfo(key){ const box=$('v1003CleanBracket'); if(!box)return; box.innerHTML='<div class="v1003-empty">예선 결과가 확정되면 새 본선 추첨을 실행할 수 있습니다. 예선 재추첨 후에는 기존 본선 대진을 사용하지 않습니다.</div>'; }
  function renderClean(key){
    key=key||selectedKey(); const box=$('v1003CleanBracket'); if(!box)return;
    if(!key){box.innerHTML='<div class="v1003-empty">대회와 부서를 선택하세요.</div>';return;}
    if(!prelimComplete(key)){renderInfo(key);return;}
    const draw=(G.draws&&G.draws[key])||{};
    if(draw.mainDrawGroupSignature && draw.mainDrawGroupSignature!==groupSignature(key)){box.innerHTML='<div class="v1003-empty">예선 조/결과가 변경되어 기존 본선 대진은 무효입니다. 새 본선 추첨을 다시 실행하세요.</div>';return;}
    const mains=ar(G.matches&&G.matches[key]).filter(m=>String(m.phase||'')==='main'&&m.cleanMainDraw).sort((a,b)=>Number(a.slot||0)-Number(b.slot||0));
    if(!mains.length){box.innerHTML='<div class="v1003-empty">새 본선 대진이 없습니다. 위 버튼으로 새 본선 추첨을 실행하세요.</div>';return;}
    const size=Number(draw.mainDrawSize||mains[0]?.bracketN||mains.length*2)||mains.length*2;
    const seg=ar(draw.mainDrawVenueSegments).map(s=>`<span class="v1003-seg" style="border-color:${VENUE_COLOR[s.venue]||VENUE_COLOR.기타};color:${VENUE_COLOR[s.venue]||VENUE_COLOR.기타};background:${VENUE_BG[s.venue]||VENUE_BG.기타}">${esc(s.venue)} ${s.start+1}~${s.end+1}경기</span>`).join('');
    box.innerHTML=`<div class="v1003-head"><b>새 가지형 본선 대진표 · ${size}강부터 시작</b><div>${seg}</div></div>${renderBracketTree(mains,size)}`;
  }
  function roundLabel(size, ri){
    const n=Math.max(2, Math.floor(size/Math.pow(2,ri)));
    if(n===2) return '결승';
    return n+'강';
  }
  function renderBracketTree(mains,size){
    const rounds=[];
    const first=mains.slice();
    rounds.push(first.map((m,i)=>({type:'match',match:m,idx:i})));
    let cnt=Math.max(1, Math.floor(first.length/2));
    for(let r=1; cnt>=1; r++, cnt=Math.floor(cnt/2)){
      rounds.push(Array.from({length:cnt},(_,i)=>({type:'placeholder',round:r,idx:i})));
      if(cnt===1) break;
    }
    return `<div class="v1004-bracket-wrap"><div class="v1004-bracket">${rounds.map((items,ri)=>`<div class="v1004-round"><div class="v1004-round-title">${roundLabel(size,ri)}</div><div class="v1004-round-body">${items.map((it,i)=> it.type==='match'?bracketMatchCard(it.match,it.idx):placeholderCard(ri,i)).join('')}</div></div>`).join('')}</div></div>`;
  }
  function bracketMatchCard(m,i){
    const v=S(m.venue||m.venueLabel||m.__venue)||'기타'; const c=VENUE_COLOR[v]||VENUE_COLOR.기타,b=VENUE_BG[v]||VENUE_BG.기타;
    const a=esc(m.display1||m.source1Label||'TBD'); const z=esc(m.display2||m.source2Label||'TBD');
    return `<div class="v1004-bmatch" style="--venue-color:${c};--venue-bg:${b}"><div class="v1004-bmatch-top"><b>${i+1}경기</b><span>${esc(v)}</span></div><div class="v1004-bslot">${a}<small>0</small></div><div class="v1004-bslot">${z}<small>0</small></div><div class="v1004-bsrc">${esc(m.source1Label||'')} / ${esc(m.source2Label||'')}</div></div>`;
  }
  function placeholderCard(ri,i){
    return `<div class="v1004-bmatch v1004-placeholder"><div class="v1004-bmatch-top"><b>${i+1}경기</b></div><div class="v1004-bslot">TBD<small>0</small></div><div class="v1004-bslot">TBD<small>0</small></div><div class="v1004-bsrc">이전 라운드 승자</div></div>`;
  }
  function ensureStyle(){ if($('v1003Style'))return; const st=document.createElement('style'); st.id='v1003Style'; st.textContent=`
    #v1003MainPanel{margin:12px 0 16px;padding:16px;border:2px solid #bfdbfe;border-radius:18px;background:linear-gradient(180deg,#f8fbff,#fff);box-shadow:0 12px 28px rgba(15,30,58,.08)}
    .v1003-title{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;font-weight:1000;color:#0f1e3a}.v1003-title small{font-size:.72rem;color:#64748b;font-weight:800}.v1003-controls{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;margin-bottom:10px}.v1003-select{min-height:40px;border:1.5px solid #cbd5e1;border-radius:12px;padding:8px 10px;font-weight:900}.v1003-btn{border:0;border-radius:12px;min-height:40px;padding:8px 13px;font-weight:1000;cursor:pointer}.v1003-btn.primary{background:#2563eb;color:#fff}.v1003-btn.purple{background:#7c3aed;color:#fff}.v1003-note{font-size:.78rem;color:#475569;line-height:1.55;margin-bottom:12px}.v1003-empty{padding:18px;border:1px dashed #cbd5e1;border-radius:14px;text-align:center;color:#64748b;font-weight:900;background:#f8fafc}.v1003-head{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px}.v1003-seg{display:inline-flex;padding:4px 8px;border:1.5px solid;border-radius:999px;font-size:.72rem;font-weight:1000;margin:2px}.v1003-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.v1003-card{border:1px solid #e2e8f0;border-left:7px solid #2563eb;border-radius:14px;padding:10px 12px}.v1003-card-top{display:flex;justify-content:space-between;font-size:.76rem;font-weight:1000;color:#334155;margin-bottom:8px}.v1003-card-top span{color:#fff;border-radius:999px;padding:3px 8px;font-size:.7rem}.v1003-teams{display:grid;grid-template-columns:1fr 30px 1fr;gap:8px;text-align:center;align-items:center;font-weight:1000}.v1003-teams em{font-style:normal;font-size:.7rem;color:#64748b}.v1003-src{text-align:center;margin-top:6px;font-size:.68rem;color:#64748b;font-weight:800}.v1003-legacy-hidden{display:none!important;visibility:hidden!important;pointer-events:none!important}

    .v1004-bracket-wrap{overflow-x:auto;padding:6px 2px 10px;-webkit-overflow-scrolling:touch}.v1004-bracket{display:flex;align-items:stretch;gap:18px;min-width:max-content}.v1004-round{display:flex;flex-direction:column;min-width:220px}.v1004-round-title{background:#0f1e3a;color:#fff;text-align:center;font-weight:1000;border-radius:8px 8px 0 0;padding:7px 10px;font-size:.86rem}.v1004-round-body{display:flex;flex-direction:column;gap:10px;justify-content:space-around;flex:1;padding-top:10px}.v1004-bmatch{position:relative;border:1.5px solid #cbd5e1;border-left:7px solid var(--venue-color,#2563eb);border-radius:12px;background:linear-gradient(90deg,var(--venue-bg,#eff6ff),#fff);box-shadow:0 3px 12px rgba(15,30,58,.08);overflow:hidden}.v1004-bmatch:after{content:'';position:absolute;right:-19px;top:50%;width:18px;height:2px;background:#bfdbfe}.v1004-round:last-child .v1004-bmatch:after{display:none}.v1004-bmatch-top{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 8px;font-size:.72rem;color:#334155}.v1004-bmatch-top span{display:inline-flex;align-items:center;border-radius:999px;background:var(--venue-color,#2563eb);color:#fff;padding:2px 7px;font-size:.68rem;font-weight:1000}.v1004-bslot{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid #e2e8f0;padding:7px 8px;font-size:.8rem;font-weight:900;line-height:1.3;min-height:34px}.v1004-bslot small{font-family:Oswald,sans-serif;color:#94a3b8;font-size:.86rem}.v1004-bsrc{text-align:center;border-top:1px dashed #e2e8f0;padding:5px 8px;font-size:.66rem;color:#64748b;font-weight:800}.v1004-placeholder{background:#f8fafc;border-left-color:#cbd5e1}.v1004-placeholder .v1004-bmatch-top span{display:none}
    @media(max-width:680px){.v1003-controls{grid-template-columns:1fr}.v1003-grid{grid-template-columns:1fr}.v1003-btn{width:100%}}
  `; document.head.appendChild(st); }
  function ensurePanel(){
    ensureStyle(); let panel=$('v1003MainPanel'); const page=$('page-bracket')||document.body;
    if(!panel){panel=document.createElement('div'); panel.id='v1003MainPanel'; panel.innerHTML=`<div class="v1003-title"><div>🏆 새 본선 운영 패널 <small>${VERSION}</small></div><small>기존 본선 고정/확정/128고정 사용 안 함</small></div><div class="v1003-controls"><select id="v1003MainMode" class="v1003-select"><option value="redistribute">전체 재배정 · 코트 수 많은 구장부터 위쪽 배정</option><option value="keep">예선 구장 유지 · 예선 출신 구장별 운영</option></select><button id="v1003DrawBtn" class="v1003-btn primary">🎲 새 본선 추첨</button><button id="v1003AssignBtn" class="v1003-btn purple">🎯 새 본선 코트배정</button></div><div class="v1003-note">예선 결과가 확정되기 전에는 본선 대진을 만들지 않습니다. 64팀 본선은 64드로, 부전승 없음, 1회전은 조1위 vs 조2위입니다.</div><div id="v1003CleanBracket"></div>`; const a=page.querySelector('.sec-title')||page.firstElementChild; if(a&&a.parentNode)a.parentNode.insertBefore(panel,a.nextSibling); else page.prepend(panel); $('v1003DrawBtn').onclick=()=>generateDraw(selectedKey(),$('v1003MainMode')?.value||'redistribute'); $('v1003AssignBtn').onclick=()=>assignCourts(selectedKey());}
    renderClean(selectedKey());
  }
  function hideLegacyMainUi(){try{
    document.querySelectorAll('button').forEach(btn=>{const t=S(btn.textContent).replace(/\s+/g,''); if(/본선확정|본선잠금|본선공개|128강|128고정|수동128|본선시드|본선추첨|본선코트배정/.test(t) && !btn.closest('#v1003MainPanel')) btn.classList.add('v1003-legacy-hidden');});
    const modal=$('mMain'); if(modal) modal.classList.add('v1003-legacy-hidden');
    document.querySelectorAll('#bracketContent .t-bracket,#bracketContent .t-round,#bracketContent [id^="mainStage_"],#bracketContent .main-status-board').forEach(el=>{ if(!el.closest('#v1003MainPanel')){ const p=el.closest('.card,section,div')||el; p.classList.add('v1003-legacy-hidden'); }});
  }catch(e){}}
  function install(){
    const block=()=>{ensurePanel(); hideLegacyMainUi(); toast('기존 본선 함수는 사용하지 않습니다. 새 본선 운영 패널을 사용하세요.','info'); return false;};
    window.startMainDraw=()=>generateDraw(selectedKey(),$('v1003MainMode')?.value||'redistribute');
    window.buildMain=()=>generateDraw(selectedKey(),$('v1003MainMode')?.value||'redistribute');
    window.v773RunMainAssign=()=>assignCourts(selectedKey());
    ['v793FixedDraw','v799LockBracket','v809ToggleBracketLock','v900OpenManual','v900OpenManualCurrent'].forEach(n=>{try{window[n]=block;}catch(e){}});
  }
  window.MainDrawCleanV1004={version:VERSION,ensurePanel,generateDraw,assignCourts,hideLegacyMainUi,selectedKey,prelimComplete}; window.MainDrawCleanV1003=window.MainDrawCleanV1004;
  install();
  function apply(){ensurePanel();hideLegacyMainUi();}
  document.addEventListener('click',()=>setTimeout(apply,90),true); document.addEventListener('input',()=>setTimeout(apply,90),true);
  [0,300,800,1800,3500,6500].forEach(t=>setTimeout(apply,t));
  function loop(){try{apply();}catch(e){} setTimeout(loop,2500)} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(loop,500)); else setTimeout(loop,500);
  try{console.log('[v1004] clean 64 bracket renderer loaded');}catch(e){}
})();


/* v1005: visible main draw controls restore - keep clean main draw engine as source of truth */
(function(){
  'use strict';
  if(window.__v1005MainDrawButtonRestoreInstalled) return;
  window.__v1005MainDrawButtonRestoreInstalled = true;
  var VERSION='v1005-button-restore';
  function $(id){return document.getElementById(id);}
  function S(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function safeToast(msg,type){try{ if(typeof toast==='function') toast(msg,type||'info'); else console.log(msg); }catch(e){}}
  function visible(el){try{if(!el) return false; var cs=getComputedStyle(el); return cs.display!=='none'&&cs.visibility!=='hidden'&&el.offsetParent!==null;}catch(e){return false;}}
  function isPrivileged(){
    try{var b=document.body; if(b && /admin-mode|tm-mode|operator-mode|op-mode|developer-mode|dev-mode/.test(b.className||'')) return true;}catch(e){}
    try{var st=$('adminSettingsBtn'); if(visible(st)) return true;}catch(e){}
    try{var ab=$('adminBadge'); if(ab && /개발자|관리자|운영자|진행자/.test(S(ab.textContent)) && (ab.classList.contains('show')||visible(ab))) return true;}catch(e){}
    try{var h=S(document.querySelector('.header-actions')?.innerText||''); if(/이상영님|개발자|관리자|운영자|진행자/.test(h) && /님|로그아웃|개발자|관리자|운영자/.test(h)) return true;}catch(e){}
    return false;
  }
  function api(){return window.MainDrawCleanV1004 || window.MainDrawCleanV1003 || window.MainDrawCleanV1002 || null;}
  function scrollToPanel(){try{var p=$('v1003MainPanel'); if(p){p.classList.remove('v1003-legacy-hidden'); p.style.display='block'; p.style.visibility='visible'; p.scrollIntoView({behavior:'smooth',block:'start'});}}catch(e){}}
  function callDraw(){
    var a=api();
    if(!a){safeToast('새 본선 엔진이 아직 로드되지 않았습니다. 새로고침 후 다시 시도하세요.','error'); return;}
    try{a.ensurePanel && a.ensurePanel();}catch(e){}
    setTimeout(function(){
      var mode=$('v1003MainMode')?.value || 'redistribute';
      try{
        if(typeof a.generateDraw==='function') a.generateDraw(a.selectedKey ? a.selectedKey() : undefined, mode);
        else $('v1003DrawBtn')?.click();
      }catch(e){console.error('[v1005] draw failed',e); safeToast('새 본선 추첨 실행 중 오류가 발생했습니다.','error');}
      scrollToPanel();
    },30);
  }
  function callAssign(){
    var a=api();
    if(!a){safeToast('새 본선 엔진이 아직 로드되지 않았습니다. 새로고침 후 다시 시도하세요.','error'); return;}
    try{a.ensurePanel && a.ensurePanel();}catch(e){}
    setTimeout(function(){
      try{
        if(typeof a.assignCourts==='function') a.assignCourts(a.selectedKey ? a.selectedKey() : undefined);
        else $('v1003AssignBtn')?.click();
      }catch(e){console.error('[v1005] assign failed',e); safeToast('새 본선 코트배정 실행 중 오류가 발생했습니다.','error');}
      scrollToPanel();
    },30);
  }
  function ensureStyle(){
    if($('v1005MainDrawButtonStyle')) return;
    var st=document.createElement('style'); st.id='v1005MainDrawButtonStyle'; st.textContent=`
      #v1005MainDrawQuickBar{display:none;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 14px;padding:12px 14px;border:2px solid #bfdbfe;border-radius:16px;background:linear-gradient(135deg,#eff6ff,#fff);box-shadow:0 8px 22px rgba(15,30,58,.08);position:relative;z-index:80}
      #v1005MainDrawQuickBar.show{display:flex!important}
      #v1005MainDrawQuickBar .v1005-title{font-weight:1000;color:#0f1e3a;margin-right:auto;font-size:.95rem}
      #v1005MainDrawQuickBar .v1005-sub{font-size:.72rem;color:#64748b;font-weight:800;flex-basis:100%;line-height:1.35}
      .v1005-main-btn{border:0;border-radius:999px;min-height:38px;padding:8px 13px;font-weight:1000;cursor:pointer;font-family:inherit;box-shadow:0 6px 14px rgba(15,30,58,.10)}
      .v1005-main-btn.draw{background:#2563eb;color:#fff}.v1005-main-btn.assign{background:#7c3aed;color:#fff}.v1005-main-btn.panel{background:#fff;color:#0f1e3a;border:1.5px solid #cbd5e1}
      #v1005MainDrawFloat{display:none;position:fixed;right:14px;bottom:max(96px,calc(env(safe-area-inset-bottom,0px) + 88px));z-index:3600;gap:6px;align-items:center;padding:7px;border-radius:999px;background:rgba(15,30,58,.96);box-shadow:0 14px 32px rgba(15,30,58,.28)}
      #v1005MainDrawFloat.show{display:flex!important}
      #v1005MainDrawFloat button{border:0;border-radius:999px;padding:8px 10px;font-size:.75rem;font-weight:1000;cursor:pointer;background:#fff;color:#0f1e3a}
      #v1005MainDrawFloat button.primary{background:#2563eb;color:white}
      .v1005-force-visible{display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}
      @media(max-width:680px){#v1005MainDrawQuickBar{padding:11px 12px}#v1005MainDrawQuickBar .v1005-title{flex-basis:100%}.v1005-main-btn{flex:1 1 30%;font-size:.8rem;padding:8px 8px}#v1005MainDrawFloat{right:8px;left:8px;justify-content:center;bottom:max(86px,calc(env(safe-area-inset-bottom,0px) + 76px))}}
    `; document.head.appendChild(st);
  }
  function ensureQuickBar(){
    ensureStyle();
    var page=$('page-bracket') || document.querySelector('.page.active') || document.body;
    var bar=$('v1005MainDrawQuickBar');
    if(!bar){
      bar=document.createElement('div'); bar.id='v1005MainDrawQuickBar';
      bar.innerHTML='<div class="v1005-title">🏆 새 본선 운영</div><button type="button" class="v1005-main-btn draw" id="v1005DrawBtn">🎲 새 본선 추첨</button><button type="button" class="v1005-main-btn assign" id="v1005AssignBtn">🎯 본선 코트배정</button><button type="button" class="v1005-main-btn panel" id="v1005PanelBtn">⬇ 패널 보기</button><div class="v1005-sub">기존 본선 고정/확정/128고정 버튼은 사용하지 않고, 새 본선 엔진만 사용합니다.</div>';
      var anchor=page.querySelector('.sec-title') || page.querySelector('.card-title') || page.firstElementChild;
      if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(bar, anchor.nextSibling); else page.prepend(bar);
      $('v1005DrawBtn').onclick=callDraw; $('v1005AssignBtn').onclick=callAssign; $('v1005PanelBtn').onclick=function(){var a=api(); try{a&&a.ensurePanel&&a.ensurePanel();}catch(e){} scrollToPanel();};
    }
    var ok=isPrivileged();
    bar.classList.toggle('show', ok);
    var fl=$('v1005MainDrawFloat');
    if(!fl){
      fl=document.createElement('div'); fl.id='v1005MainDrawFloat';
      fl.innerHTML='<button type="button" class="primary" id="v1005FloatDraw">본선추첨</button><button type="button" id="v1005FloatAssign">코트배정</button><button type="button" id="v1005FloatPanel">패널</button>';
      document.body.appendChild(fl);
      $('v1005FloatDraw').onclick=callDraw; $('v1005FloatAssign').onclick=callAssign; $('v1005FloatPanel').onclick=function(){var a=api(); try{a&&a.ensurePanel&&a.ensurePanel();}catch(e){} scrollToPanel();};
    }
    fl.classList.toggle('show', ok);
    try{var p=$('v1003MainPanel'); if(p && ok){p.classList.add('v1005-force-visible'); p.classList.remove('v1003-legacy-hidden');}}catch(e){}
  }
  function apply(){ensureQuickBar();}
  document.addEventListener('click',function(){setTimeout(apply,100);},true);
  document.addEventListener('input',function(){setTimeout(apply,100);},true);
  [0,150,500,1200,2500,5000].forEach(function(t){setTimeout(apply,t);});
  setInterval(apply,1500);
  try{console.log('[v1005] main draw visible buttons restored');}catch(e){}
})();
