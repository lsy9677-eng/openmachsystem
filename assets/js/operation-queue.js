/* v999 main draw / court assignment engine v2
   - Replaces hard-coded 128 draw and legacy post-process venue assignment.
   - Main draw creation and court assignment are separated.
   - Venue sections are assigned from active court counts, largest venue first.
*/
(function(){
  'use strict';
  if(window.__operationQueueV999Installed) return;
  window.__operationQueueV999Installed = true;
  const VERSION='v999-main-draw-engine-v2';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function nowIso(){ return new Date().toISOString(); }
  function natural(a,b){ return String(a||'').localeCompare(String(b||''),'ko',{numeric:true,sensitivity:'base'}); }
  function toastInfo(msg,type){ try{ if(typeof toastMsg==='function') return toastMsg(msg,type||'info'); if(typeof toast==='function') return toast(msg,type||'info'); }catch(e){} }
  function currentTidSafe(){ try{ if(typeof currentTid==='function') return clean(currentTid()); }catch(e){} try{ return clean(window.G&&G.currentTid); }catch(e){return '';} }
  function currentDivSafe(){ try{ if(typeof currentDiv==='function') return clean(currentDiv()); }catch(e){} try{ return clean(window.G&&G.currentDiv); }catch(e){return '';} }
  function keyOf(tid,div){ tid=clean(tid||currentTidSafe()); div=clean(div||currentDivSafe()); try{ if(typeof kd==='function'&&tid&&div) return kd(tid,div); }catch(e){} return tid&&div ? tid+'_'+div : ''; }
  function isWinner(m){ return m && m.winner != null; }
  function isBye(m){ return !!(m && m.bye); }
  function isMainMatch(m){ const p=clean(m&&m.phase).toLowerCase(); return p==='main'||p==='playin'||/^main_|^playin_/.test(clean(m&&m.id)); }
  function isRoundZeroMain(m){ if(!m || !isMainMatch(m)) return false; if(clean(m.phase)==='playin') return true; return Number(m.round||0)===0; }
  function isPrelimMatch(m){ const p=clean(m&&m.phase).toLowerCase(); if(p==='group'||p==='prelim') return true; if(/^g[_-]/i.test(clean(m&&m.id))) return true; if(m && m.group!=null && !isMainMatch(m)) return true; return false; }
  function courtOfMatch(m){ if(!m) return ''; let c=clean(m.manualCourtTarget||m.court||m.currentCourt||m.assignedCourt||m.manualCourt||''); if(!c && arr(m.courts)[0]) c=clean(m.courts[0]); return c; }
  function isManualPinned(m){ return !!(m && (clean(m.manualCourtTarget)||m.manualCourtLocked===true)); }
  function isManualShared(m){ return !!(m && m.manualSharedHold && !clean(m.manualCourtTarget)); }
  function isReadyPair(m){
    if(!m || isBye(m) || isWinner(m)) return false;
    if(m.t1!=null && m.t2!=null) return true;
    const a=clean(m.source1Label||m.label1||''); const b=clean(m.source2Label||m.label2||'');
    if(!a || !b) return false;
    if(/^TBD$/i.test(a)||/^TBD$/i.test(b)||/부전승/.test(b)) return false;
    return true;
  }

  function venueOfCourt(court){
    const c=clean(court);
    if(!c) return '';
    if(/원도심|원도|인조/.test(c)) return '원도심';
    if(/국제|장유국제/.test(c)) return '국제';
    if(/능동/.test(c)) return '능동';
    if(/장유중|클레이/.test(c)) return '장유중';
    if(/금병/.test(c)) return '금병';
    if(/삼계/.test(c)) return '삼계';
    if(/동부/.test(c)) return '동부';
    return '기타';
  }
  function normalizeCourtList(list){
    const out=[];
    arr(list).forEach(v=>{
      if(Array.isArray(v)) v.forEach(x=>{ const c=clean(x); if(c && !out.includes(c)) out.push(c); });
      else { const c=clean(v); if(c && !out.includes(c)) out.push(c); }
    });
    return out.filter(c=>!/(공용\s*대기|대기중|미배정|빈코트|undefined|null)/i.test(c));
  }
  function courtNumber(c){ const m=clean(c).match(/(\d+)\s*$/); return m?Number(m[1]):9999; }
  function getActiveVenueGroups(courts){
    const groups={};
    normalizeCourtList(courts).forEach(c=>{ const v=venueOfCourt(c)||'기타'; (groups[v]||(groups[v]=[])).push(c); });
    Object.keys(groups).forEach(v=>groups[v].sort((a,b)=>courtNumber(a)-courtNumber(b)||natural(a,b)));
    return groups;
  }
  function getBoardCourtsForKey(key){
    try{ let out=[];
      if(typeof getCourtBoardConfiguredCourtsV505==='function'){
        const cfg=getCourtBoardConfiguredCourtsV505(key)||{}; if(cfg.explicit && arr(cfg.list).length) out=cfg.list;
      }
      if(!out.length && typeof getSelectedCourtFilters==='function') out=getSelectedCourtFilters(key)||[];
      if(!out.length && typeof getUsedCourtsForKey==='function') out=getUsedCourtsForKey(key)||[];
      if(!out.length && typeof getIndividualAutoCourtPool==='function') out=getIndividualAutoCourtPool(key,'main')||[];
      if(!out.length && typeof getIndividualAutoAssignmentPlan==='function'){ const p=getIndividualAutoAssignmentPlan(key)||{}; out=p.pool||[]; }
      return normalizeCourtList(out);
    }catch(e){ return []; }
  }
  function getActiveVenueInfo(key){
    const courts=getBoardCourtsForKey(key);
    const groups=getActiveVenueGroups(courts);
    const labels=Object.keys(groups).filter(v=>arr(groups[v]).length>0).sort(sortVenueByMainCourtCount(groups));
    return {courts,groups,labels,split:labels.length>1};
  }
  function sortVenueByMainCourtCount(groups){
    const pref=['국제','능동','원도심','장유중','금병','삼계','동부','기타','통합'];
    return (a,b)=>{
      const ca=arr(groups&&groups[a]).length, cb=arr(groups&&groups[b]).length;
      if(ca!==cb) return cb-ca; // many courts first = main court section first
      const ia=pref.indexOf(a), ib=pref.indexOf(b);
      if(ia!==ib) return (ia<0?99:ia)-(ib<0?99:ib);
      return natural(a,b);
    };
  }
  function venueTheme(label){
    const table={
      '국제':{icon:'🔵',bg:'#eaf3ff',bd:'#2563eb',fg:'#1d4ed8',head:'#dbeafe'},
      '능동':{icon:'🟣',bg:'#f3edff',bd:'#8b5cf6',fg:'#6d28d9',head:'#ede9fe'},
      '원도심':{icon:'🟢',bg:'#ecfdf5',bd:'#22c55e',fg:'#15803d',head:'#dcfce7'},
      '장유중':{icon:'🟤',bg:'#fff7ed',bd:'#f97316',fg:'#c2410c',head:'#ffedd5'},
      '금병':{icon:'🟡',bg:'#fefce8',bd:'#eab308',fg:'#854d0e',head:'#fef3c7'},
      '삼계':{icon:'🔴',bg:'#fff1f2',bd:'#f43f5e',fg:'#be123c',head:'#ffe4e6'},
      '동부':{icon:'🟦',bg:'#eef2ff',bd:'#6366f1',fg:'#3730a3',head:'#e0e7ff'},
      '기타':{icon:'⚪',bg:'#f8fafc',bd:'#94a3b8',fg:'#475569',head:'#e2e8f0'},
      '통합':{icon:'⚪',bg:'#f8fafc',bd:'#94a3b8',fg:'#475569',head:'#e2e8f0'}
    };
    return {...(table[label]||table['기타']),label:label||'기타'};
  }
  function normalizeRawVenue(raw, labels){
    raw=clean(raw); labels=arr(labels);
    const map={gukje:'국제',wondosim:'원도심',neungdong:'능동',jangyu_jung:'장유중',geumbyeong:'금병',samgye:'삼계',dongbu:'동부'};
    if(map[raw]) raw=map[raw];
    if(labels.includes(raw)) return raw;
    return '';
  }
  function teamPrelimVenueMap(key){
    const map=new Map();
    try{ arr(G&&G.matches&&G.matches[key]).forEach(m=>{
      if(!isPrelimMatch(m)) return;
      const v=venueOfCourt(courtOfMatch(m)); if(!v) return;
      [m.t1,m.t2].forEach(t=>{ if(t!=null && !map.has(String(t))) map.set(String(t),v); });
    }); }catch(e){}
    return map;
  }
  function entrySourceVenue(key,e,labels){
    labels=arr(labels);
    const raw=normalizeRawVenue(e&&(e.venue||e.__venue||e.prelimVenue||e.venueLabel),labels); if(raw) return raw;
    try{
      const d=window.G&&G.draws&&G.draws[key]; const gi=Number(e&&e.gn)-1; const g=d&&d.groups&&d.groups[gi];
      const courts=[]; if(g){ if(Array.isArray(g.courts)) g.courts.forEach(c=>courts.push(c)); if(g.court) courts.push(g.court); if(g.assignedCourt) courts.push(g.assignedCourt); }
      for(const c of courts){ const v=venueOfCourt(c); if(v && (!labels.length||labels.includes(v))) return v; }
    }catch(e){}
    try{ if(e&&e.ti!=null){ const v=teamPrelimVenueMap(key).get(String(e.ti)); if(v&&(!labels.length||labels.includes(v))) return v; } }catch(e){}
    return labels[0]||'국제';
  }

  const VENUE_MODE_KEY_PREFIX='OPQ_MAIN_VENUE_MODE:';
  function venueModeStorageKey(key){ return VENUE_MODE_KEY_PREFIX+clean(key||keyOf()); }
  function normalizeMainVenueMode(v){ v=clean(v).toLowerCase(); if(['preserve','keep','prelim','prelim_venue','keep_prelim','venue_keep'].includes(v)) return 'preserve'; if(['rebalance','overall','all','mixed','redistribute','reset'].includes(v)) return 'rebalance'; return ''; }
  function setMainVenueModeForKey(key,mode){ key=clean(key||keyOf()); mode=normalizeMainVenueMode(mode)||'rebalance'; try{localStorage.setItem(venueModeStorageKey(key),mode);}catch(e){} try{G.draws=G.draws||{}; G.draws[key]=G.draws[key]||{}; G.draws[key].mainVenueMode=mode; G.draws[key].mainCourtVenueMode=mode; G.draws[key].mainVenueModeUpdatedAt=nowIso();}catch(e){} return mode; }
  function getMainVenueModeForKey(key){ key=clean(key||keyOf()); let m=''; try{const d=G&&G.draws&&G.draws[key]; m=normalizeMainVenueMode(d&&(d.mainVenueMode||d.mainCourtVenueMode||d.venueMode));}catch(e){} if(!m){try{m=normalizeMainVenueMode(localStorage.getItem(venueModeStorageKey(key)));}catch(e){}} return m||'rebalance'; }

  function allocateVenueSections(key, entryCountByVenue, matchCount, mode){
    const info=getActiveVenueInfo(key), labels=info.labels.length?info.labels:['국제'], groups=info.groups||{};
    if(labels.length===1) return Array(matchCount).fill(labels[0]);
    const counts={}; labels.forEach(v=>counts[v]=0);
    if(normalizeMainVenueMode(mode)==='preserve'){
      labels.forEach(v=>{ counts[v]=Math.max(0, Math.ceil((entryCountByVenue&&entryCountByVenue[v]||0)/2)); });
      labels.forEach(v=>{ if((entryCountByVenue&&entryCountByVenue[v]||0)>0 && counts[v]===0) counts[v]=1; });
    }else{
      const totalCourts=labels.reduce((a,v)=>a+arr(groups[v]).length,0)||labels.length;
      let used=0, rema=[];
      labels.forEach(v=>{ const raw=matchCount*(arr(groups[v]).length||1)/totalCourts; const f=Math.floor(raw); counts[v]=f; used+=f; rema.push([v,raw-f]); });
      rema.sort((a,b)=>b[1]-a[1]||sortVenueByMainCourtCount(groups)(a[0],b[0]));
      for(let i=0; used<matchCount; i++,used++) counts[rema[i%rema.length][0]]++;
    }
    let sum=labels.reduce((a,v)=>a+counts[v],0);
    while(sum>matchCount){ const v=labels.slice().sort((a,b)=>counts[b]-counts[a]||sortVenueByMainCourtCount(groups)(a,b))[0]; if(!v||counts[v]<=0) break; counts[v]--; sum--; }
    while(sum<matchCount){ const v=labels[sum%labels.length]; counts[v]++; sum++; }
    const out=[]; labels.forEach(v=>{ for(let i=0;i<counts[v];i++) out.push(v); });
    return out.slice(0,matchCount);
  }
  function nextPow2(n){ n=Math.max(1,Number(n||0)); let p=1; while(p<n) p*=2; return p; }
  function grpLabelSafe(gi){ try{ if(typeof grpLabel==='function') return grpLabel(Number(gi)||0); }catch(e){} return (Number(gi)+1)+'조'; }
  function entryLabel(e){ try{ if(typeof getMainEntryBracketLabel==='function'){ const x=getMainEntryBracketLabel(e); if(clean(x)) return clean(x); } }catch(e){} if(e&&e.gn&&e.rk) return grpLabelSafe(Number(e.gn)-1)+' '+e.rk+'위'; return clean(e&&(e.nm||e.name||e.label))||'TBD'; }
  function pickByeIndices(matchCount,byeCount){
    byeCount=Math.max(0,Math.min(Number(byeCount||0),matchCount)); const out=[]; if(!byeCount) return out;
    for(let i=0;i<byeCount;i++){ let idx=Math.floor((i+1)*matchCount/(byeCount+1)); while(out.includes(idx)&&idx<matchCount-1)idx++; while(out.includes(idx)&&idx>0)idx--; out.push(idx); }
    return [...new Set(out)].slice(0,byeCount).sort((a,b)=>a-b);
  }
  function assignSide(slot,side,e,groupLabelOnly){ if(!e)return; const lbl=entryLabel(e); if(side==='t1'){slot.source1Label=lbl; slot.gnTarget=e.gn||null; slot.rkTarget=e.rk||null; slot.sourceGroup1=e.gn||null; if(!groupLabelOnly&&e.ti!=null) slot.t1=Number(e.ti);} else {slot.source2Label=lbl; slot.gnTarget2=e.gn||null; slot.rkTarget2=e.rk||null; slot.sourceGroup2=e.gn||null; if(!groupLabelOnly&&e.ti!=null) slot.t2=Number(e.ti);} }
  function chooseNonSame(list,gn){ let idx=list.findIndex(e=>e&&e.gn!==gn); if(idx<0) idx=0; return idx>=0?list.splice(idx,1)[0]:null; }
  function fillSlots(slots, entries, groupLabelOnly){
    const normal=slots.filter(s=>!s.bye), byes=slots.filter(s=>s.bye);
    const r1=entries.filter(e=>Number(e.rk||0)===1 || e.playInPlaceholder), r2=entries.filter(e=>!(Number(e.rk||0)===1 || e.playInPlaceholder));
    byes.forEach(s=>{ const e=r1.shift()||r2.shift(); if(e){ assignSide(s,'t1',e,groupLabelOnly); if(!groupLabelOnly&&e.ti!=null) s.winner=Number(e.ti); } s.source2Label='부전승'; });
    normal.forEach(s=>{ const e=r1.shift(); if(e) assignSide(s,'t1',e,groupLabelOnly); });
    normal.forEach(s=>{ if(!s.source1Label) return; const e=chooseNonSame(r2,s.gnTarget); if(e) assignSide(s,'t2',e,groupLabelOnly); });
    const leftovers=[...r1,...r2];
    normal.forEach(s=>{ if(!s.source1Label){ const e=leftovers.shift(); if(e) assignSide(s,'t1',e,groupLabelOnly); } if(!s.source2Label){ const e=chooseNonSame(leftovers,s.gnTarget); if(e) assignSide(s,'t2',e,groupLabelOnly); } });
  }
  function buildCleanMainMatches(advT,key,teams,groupLabelOnly){
    key=clean(key||keyOf()); const entries=arr(advT).map(e=>({...e,nm:e&&e.nm?e.nm:entryLabel(e)})); const total=entries.length; if(total<2) return [];
    const bracketN=nextPow2(total); const matchCount=bracketN/2; const mode=getMainVenueModeForKey(key);
    const labels=getActiveVenueInfo(key).labels; const byEntryVenue={}; entries.forEach(e=>{ const v=entrySourceVenue(key,e,labels); byEntryVenue[v]=(byEntryVenue[v]||0)+1; });
    const sectionVenues=allocateVenueSections(key,byEntryVenue,matchCount,mode);
    const byeSet=new Set(pickByeIndices(matchCount,bracketN-total));
    const slots=Array.from({length:matchCount},(_,i)=>({id:`main_r0_${i}`,phase:'main',round:0,slot:i,bracketN,t1:null,t2:null,winner:null,rubbers:[],court:'',courts:[],bye:byeSet.has(i),source1Label:'',source2Label:byeSet.has(i)?'부전승':'',venue:sectionVenues[i]||sectionVenues[0]||'국제',__venue:sectionVenues[i]||sectionVenues[0]||'국제'}));
    if(normalizeMainVenueMode(mode)==='preserve'){
      const byV={}; labels.forEach(v=>byV[v]=[]); entries.forEach(e=>{ const v=entrySourceVenue(key,e,labels); (byV[v]||(byV[v]=[])).push(e); });
      labels.forEach(v=>fillSlots(slots.filter(s=>s.venue===v),byV[v]||[],groupLabelOnly));
      const assigned=new Set(slots.flatMap(s=>[s.source1Label,s.source2Label]).filter(Boolean));
      const leftovers=entries.filter(e=>!assigned.has(entryLabel(e))); if(leftovers.length) fillSlots(slots.filter(s=>!s.source1Label || (!s.bye&&!s.source2Label)),leftovers,groupLabelOnly);
    }else fillSlots(slots,entries,groupLabelOnly);
    const all=[...slots]; let prev=slots, round=1;
    while(prev.length>1){ const next=[]; for(let i=0;i<prev.length;i+=2){ const a=prev[i],b=prev[i+1]; const v=(a&&b&&a.venue===b.venue)?a.venue:'통합'; const m={id:`main_r${round}_${Math.floor(i/2)}`,phase:'main',round,slot:Math.floor(i/2),bracketN,t1:null,t2:null,winner:null,rubbers:[],court:'',courts:[],bye:false,venue:v,__venue:v}; [a,b].forEach((c,ci)=>{ if(c&&c.bye&&c.winner!=null){ if(ci===0)m.t1=c.winner; else m.t2=c.winner; } }); next.push(m); all.push(m); } prev=next; round++; }
    return all;
  }

  function firstCourtForVenue(key,venue){ return clean(arr(getActiveVenueInfo(key).groups[venue])[0]||''); }
  function inferMatchVenueLabelForKey(key,m){
    const info=getActiveVenueInfo(key), labels=info.labels;
    if(labels.length===1) return labels[0];
    let v=normalizeRawVenue(m&&(m.venue||m.__venue),labels); if(v) return v;
    v=venueOfCourt(courtOfMatch(m)); if(v&&labels.includes(v)) return v;
    return labels[0]||'국제';
  }
  function orderIso(tick){ return new Date(Date.UTC(2099,0,1,0,0,0,Math.max(0,tick||0))).toISOString(); }
  function clearAutoMain(m){ m.court=''; m.courts=[]; delete m.courtAssignedAt; delete m.courtQueueOrder; delete m.waitingFirstAt; delete m.lastWaitingFirstAt; delete m.autoCourtLabel; }
  function markShared(key,m,venue){ const before=JSON.stringify({c:m.court,cs:m.courts,v:m.venue,o:m.courtQueueOrder}); clearAutoMain(m); m.venue=venue; m.__venue=venue; m.__sharedCourtLabel=firstCourtForVenue(key,venue); m.autoCourtLabel=venue?venue+' 공용 대기':'공용 대기'; m.manualSharedHold=false; return before!==JSON.stringify({c:m.court,cs:m.courts,v:m.venue,o:m.courtQueueOrder}); }
  function assignMainToCourt(m,court,venue,countBefore,tick){ const before=JSON.stringify({c:m.court,cs:m.courts,v:m.venue,o:m.courtQueueOrder,w:m.waitingFirstAt}); m.court=String(court); m.courts=[String(court)]; m.venue=venue; m.__venue=venue; m.__sharedCourtLabel=String(court); m.autoCourtLabel='본선 자동배정'; m.courtAssignedAt=m.courtAssignedAt||nowIso(); m.courtQueueOrder=orderIso(tick); if(Number(countBefore||0)>=1) m.waitingFirstAt=m.waitingFirstAt||nowIso(); else {delete m.waitingFirstAt; delete m.lastWaitingFirstAt;} m.manualSharedHold=false; return before!==JSON.stringify({c:m.court,cs:m.courts,v:m.venue,o:m.courtQueueOrder,w:m.waitingFirstAt}); }
  function sortMain(a,b){ const ra=Number(a.round||0), rb=Number(b.round||0); if(ra!==rb)return ra-rb; const sa=Number(a.slot||0), sb=Number(b.slot||0); return sa-sb||natural(a.id,b.id); }
  function runCleanMainCourtAssignment(key){
    key=clean(key||keyOf()); if(!key||!(window.G&&G.matches&&Array.isArray(G.matches[key]))) return false;
    const matches=G.matches[key], info=getActiveVenueInfo(key), labels=info.labels, groups=info.groups; if(!labels.length) return false;
    let changed=false, tick=0; const occupancy={}; labels.forEach(v=>arr(groups[v]).forEach(c=>occupancy[c]=[]));
    matches.forEach(m=>{ if(!m||isWinner(m))return; const c=courtOfMatch(m); if(c&&Object.prototype.hasOwnProperty.call(occupancy,c)&&(isPrelimMatch(m)||(isMainMatch(m)&&isManualPinned(m)))) occupancy[c].push(m); });
    matches.forEach(m=>{ if(!m||!isMainMatch(m)||isWinner(m)||isManualPinned(m)||isManualShared(m)) return; if(courtOfMatch(m)||arr(m.courts).length||clean(m.autoCourtLabel)||clean(m.courtQueueOrder)){ clearAutoMain(m); changed=true; } });
    const q={}; labels.forEach(v=>q[v]=[]);
    matches.filter(m=>m&&isRoundZeroMain(m)&&!isWinner(m)&&!isBye(m)&&isReadyPair(m)&&!isManualPinned(m)&&!isManualShared(m)).sort(sortMain).forEach(m=>{ const v=inferMatchVenueLabelForKey(key,m); const vv=q[v]?v:labels[0]; m.venue=vv; m.__venue=vv; m.__sharedCourtLabel=firstCourtForVenue(key,vv); q[vv].push(m); });
    const curs={}; labels.forEach(v=>curs[v]=0);
    function pickCourt(v){ const courts=arr(groups[v]); if(!courts.length)return ''; for(const target of [0,1]){ for(let step=0; step<courts.length; step++){ const idx=(Number(curs[v]||0)+step)%courts.length; const c=String(courts[idx]); const count=arr(occupancy[c]).length; if(count===target&&count<2){ curs[v]=(idx+1)%courts.length; return c; } } } return ''; }
    labels.forEach(v=>{ q[v].forEach(m=>{ const c=pickCourt(v); if(c){ const before=arr(occupancy[c]).length; changed=assignMainToCourt(m,c,v,before,tick++)||changed; occupancy[c].push(m); } else changed=markShared(key,m,v)||changed; }); });
    try{console.log('[v999] main assign',key,labels.map(v=>v+':'+(q[v]||[]).length).join(' / '),'changed=',changed);}catch(e){}
    return changed;
  }
  async function runMainAssignButton(key){
    try{ key=clean(key||keyOf()); const changed=runCleanMainCourtAssignment(key); if(!changed){ toastInfo('배정할 본선 경기가 없거나 이미 정리되어 있습니다','info'); try{renderBracket();}catch(e){} return false; } try{ if(window.__FB_WRITE_CACHE&&window.__FB_WRITE_CACHE.matches) delete window.__FB_WRITE_CACHE.matches[key]; }catch(e){} const save=window.stM||window.__v728_stM; if(typeof save==='function') await save(key); try{renderBracket();}catch(e){} toastInfo('본선 코트 배정 완료 ✅','success'); return true; }catch(e){ console.error('[v999] main assign failed',e); toastInfo('본선 코트 배정 실패: '+(e&&e.message?e.message:e),'error'); return false; }
  }

  function ensureModeUiStyle(){ if(document.getElementById('opqVenueModeStyle')) return; const st=document.createElement('style'); st.id='opqVenueModeStyle'; st.textContent=`#v606KeepCourtGroupSection{display:none!important}.opq-main-venue-mode{margin-top:14px;padding:13px 14px;border:1.5px solid #d4a017;border-radius:16px;background:linear-gradient(135deg,#fffdf5,#f8fbff)}.opq-main-venue-mode-title{font-weight:1000;color:#0f1e3a;font-size:.9rem;margin-bottom:10px}.opq-main-venue-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.opq-main-venue-option{display:flex;gap:8px;align-items:flex-start;padding:11px 12px;border:2px solid #dbe3f0;border-radius:14px;background:#fff;cursor:pointer;line-height:1.45}.opq-main-venue-option b{display:block;font-size:.84rem;color:#0f1e3a}.opq-main-venue-option span{display:block;font-size:.72rem;color:#64748b;margin-top:2px}.opq-main-venue-option input{margin-top:2px;accent-color:#d4a017}.opq-main-venue-option:has(input:checked){border-color:#d4a017;background:#fff7dd;box-shadow:0 8px 18px rgba(212,160,23,.13)}.opq-tree-venue-badge{position:absolute;right:4px;top:4px;z-index:9;font-size:10px;font-weight:900;padding:2px 6px;border-radius:999px;line-height:1.15;pointer-events:none}@media(max-width:680px){.opq-main-venue-options{grid-template-columns:1fr}}`; document.head.appendChild(st); }
  function injectMainVenueModeUi(key){ try{ ensureModeUiStyle(); const modal=document.getElementById('mIndividualMainDraw'); const body=modal&&modal.querySelector('.modal-body'); if(!body)return; let box=document.getElementById('opqMainVenueModeBox'); if(!box){ box=document.createElement('div'); box.id='opqMainVenueModeBox'; box.className='opq-main-venue-mode'; box.innerHTML=`<div class="opq-main-venue-mode-title">🧭 본선 구장 운영 방식</div><div class="opq-main-venue-options"><label class="opq-main-venue-option"><input type="radio" name="opqMainVenueMode" value="rebalance"><div><b>전체 재배정</b><span>본선 진출팀을 전체 사용 코트에 다시 고르게 배정합니다. 코트 수 많은 구장이 상단 구간부터 배정됩니다.</span></div></label><label class="opq-main-venue-option"><input type="radio" name="opqMainVenueMode" value="preserve"><div><b>예선 구장 유지</b><span>국제 출신은 국제, 능동 출신은 능동처럼 이동 없이 구장별 본선을 우선 운영합니다.</span></div></label></div><div style="font-size:.72rem;color:#64748b;margin-top:9px;line-height:1.55">※ 본선 추첨은 대진표/구장 구간만 확정하고, 실제 코트 투입은 <b>본선 코트배정</b> 버튼을 눌렀을 때 적용됩니다.</div>`; body.appendChild(box); } const mode=getMainVenueModeForKey(key); const r=box.querySelector(`input[value="${mode}"]`)||box.querySelector('input[value="rebalance"]'); if(r)r.checked=true; }catch(e){console.warn('[v999] mode UI failed',e);} }
  function readModeUi(){ const el=document.querySelector('input[name="opqMainVenueMode"]:checked'); return normalizeMainVenueMode(el&&el.value)||'rebalance'; }

  async function startIndividualMainDrawClean(){
    try{
      if(typeof IMD==='undefined' || !IMD) return (window.__opqOldStartIndividualMainDraw?window.__opqOldStartIndividualMainDraw.apply(this,arguments):undefined);
      const key=IMD.key, teams=IMD.teams||[], allMs=IMD.allMs||[], advT=IMD.advT||[], isPrelimDone=!!IMD.isPrelimDone;
      const mode=setMainVenueModeForKey(key, readModeUi());
      let effectMode='none', isTest=false; try{ effectMode=typeof getIndividualMainDrawEffectMode==='function'?getIndividualMainDrawEffectMode():'none'; }catch(e){} try{ isTest=!!document.getElementById('individualMainDrawIsTestInput')?.checked; }catch(e){}
      try{ if(typeof closeIndividualMainDrawModal==='function') closeIndividualMainDrawModal(); }catch(e){}
      if(effectMode==='roulette'){ try{ await runIndividualMainDrawEffect(advT); }catch(e){} }
      if(isTest){ toastInfo('테스트용 본선 추첨 연출만 확인했습니다','success'); return; }
      const groupMs=arr(allMs).filter(m=>m&&isPrelimMatch(m));
      const mainMatches=buildCleanMainMatches(advT,key,teams,!isPrelimDone);
      G.matches[key]=[...groupMs,...mainMatches];
      G.draws=G.draws||{}; G.draws[key]=G.draws[key]||{}; G.draws[key].mainVenueMode=mode; G.draws[key].mainUpdatedAt=nowIso();
      if(typeof sl==='function') sl(true);
      await Promise.all([typeof stM==='function'?stM(key):Promise.resolve(), typeof stD==='function'?stD(key):Promise.resolve()]);
      if(typeof sl==='function') sl(false);
      try{ if(typeof setMainSectionCollapsed==='function') setMainSectionCollapsed(key,false); }catch(e){}
      toastInfo(isPrelimDone?'본선 대진 추첨 완료':'본선 대진 추첨 완료 (조 순위 표시 — 예선 완료 후 이름 확정)','success');
      try{renderBracket();}catch(e){}
      setTimeout(()=>styleMainTreeVenueBadges(key),180); setTimeout(()=>styleMainTreeVenueBadges(key),900);
    }catch(e){ try{ if(typeof sl==='function') sl(false); }catch(_){} console.error('[v999] clean start main draw failed',e); toastInfo('본선 추첨 실패: '+(e&&e.message?e.message:e),'error'); }
  }

  function installCleanMainDraw(){
    try{ window.buildIndivMainMatchesFixed=buildCleanMainMatches; }catch(e){}
    try{ if(typeof buildIndivMainMatchesFixed!=='undefined') buildIndivMainMatchesFixed=buildCleanMainMatches; }catch(e){}
    try{ window.v748ApplyVenueToMainMatches=function(key){ key=clean(key||keyOf()); arr(G&&G.matches&&G.matches[key]).forEach(m=>{ if(m&&isMainMatch(m)){ const v=inferMatchVenueLabelForKey(key,m); m.venue=v; m.__venue=v; } }); return true; }; }catch(e){}
    try{ ['v748RunMainAutoCourtRebuild','v753RunMainAutoAssign','v760RunMainAutoAssign','v765RunMainCourtRepair','v769RepairKey','ensureIndividualAutoCourtAssignmentsForKey','rebuildIndividualAutoCourtAssignmentsForKey'].forEach(name=>{ window[name]=function(key){ try{console.log('[v999] '+name+' skipped: main assignment requires admin button');}catch(e){} return false; }; }); }catch(e){}
    try{ if(!window.__opqOldStartIndividualMainDraw && typeof window.startIndividualMainDraw==='function') window.__opqOldStartIndividualMainDraw=window.startIndividualMainDraw; window.startIndividualMainDraw=startIndividualMainDrawClean; }catch(e){}
    try{ window.v773RunMainAssign=runMainAssignButton; window.v771AssignMainCourts=function(key){ return runCleanMainCourtAssignment(key); }; window.v770AssignMainCourts=window.v771AssignMainCourts; window.v766AssignMainCourtsNow=window.v771AssignMainCourts; }catch(e){}
  }
  function installOpenModalHook(){ try{ const old=window.openIndividualMainDraw; if(typeof old==='function' && !old.__opqV999Wrapped){ const w=function(tid,div){ const r=old.apply(this,arguments); setTimeout(()=>injectMainVenueModeUi(keyOf(tid,div)),60); setTimeout(()=>injectMainVenueModeUi(keyOf(tid,div)),350); return r; }; w.__opqV999Wrapped=true; window.openIndividualMainDraw=w; } }catch(e){} }
  function installSharedVenueCompat(){ try{ const old=window.getCourtBoardSharedOverflowItems; if(typeof old==='function'&&!old.__opqV999Wrapped){ const w=function(key){ const list=old.apply(this,arguments)||[]; try{ const labels=getActiveVenueInfo(key).labels; list.forEach(m=>{ if(m&&isMainMatch(m)){ const v=inferMatchVenueLabelForKey(key,m); m.venue=v; m.__venue=v; if(!clean(m.__sharedCourtLabel)) m.__sharedCourtLabel=firstCourtForVenue(key,v); } }); }catch(e){} return list; }; w.__opqV999Wrapped=true; window.getCourtBoardSharedOverflowItems=w; } }catch(e){} }
  function styleMainTreeVenueBadges(key){
    try{ key=clean(key||keyOf()); const ms=arr(G&&G.matches&&G.matches[key]).filter(m=>m&&isMainMatch(m)).map(m=>({...m,round:Number(m.round||0),slot:Number(m.slot||0)})).sort(sortMain); if(!ms.length)return; const cards=[...document.querySelectorAll('.main-tree-card .js-main-tree-scroll div[style*="position:absolute"][style*="width:168px"][style*="border"]')]; cards.forEach((el,idx)=>{ const m=ms[idx]; if(!m)return; const th=venueTheme(clean(m.venue||m.__venue)||inferMatchVenueLabelForKey(key,m)); el.style.borderColor=th.bd; el.style.borderLeftColor=th.bd; el.style.background=th.bg; let b=el.querySelector('.opq-tree-venue-badge'); if(!b){ b=document.createElement('div'); b.className='opq-tree-venue-badge'; el.appendChild(b); } b.textContent=th.icon+' '+th.label; b.style.background=th.head; b.style.color=th.fg; b.style.border='1px solid '+th.bd; }); }catch(e){}
  }
  function installTreeDecorator(){ try{ const old=window.renderBracket; if(typeof old==='function' && !old.__opqV999TreeWrapped){ const w=function(){ const r=old.apply(this,arguments); setTimeout(()=>styleMainTreeVenueBadges(keyOf()),180); setTimeout(()=>styleMainTreeVenueBadges(keyOf()),800); return r; }; w.__opqV999TreeWrapped=true; window.renderBracket=w; } }catch(e){} }

  const API={version:VERSION,keyOf,venueOfCourt,getActiveVenueGroups,getBoardCourtsForKey,getActiveVenueLabelsForKey:getActiveVenueInfo,inferMatchVenueLabelForKey,buildCleanMainMatches,runCleanMainCourtAssignment,runMainAssignButton,getMainVenueModeForKey,setMainVenueModeForKey,styleMainTreeVenueBadges};
  window.OperationQueueV999=API; window.OperationQueueV998=API; window.OperationQueueV997=API; window.OperationQueueV996=API; window.OperationQueueV993=API;
  function installAll(){ installCleanMainDraw(); installOpenModalHook(); installSharedVenueCompat(); installTreeDecorator(); ensureModeUiStyle(); }
  installAll(); [100,400,1000,2000,4000].forEach(t=>setTimeout(installAll,t)); setInterval(()=>{ try{styleMainTreeVenueBadges(keyOf());}catch(e){} },1800);
  try{ console.log('[v999] clean main draw engine v2 loaded'); }catch(e){}
})();
