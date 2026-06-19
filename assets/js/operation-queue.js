/* v996 clean operation engine
   Purpose: replace the scattered main-court assignment patches with one data-first engine.
   Base: v993 successful general venue split. v994/v995 display-reorder patches are intentionally not used.
*/
(function(){
  'use strict';
  if(window.__operationQueueV996Installed) return;
  window.__operationQueueV996Installed = true;
  const VERSION = 'v996-clean-operation-engine';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function nowIso(){ return new Date().toISOString(); }
  function log(){ try{ if(window.__OPQ_DEBUG__) console.log.apply(console, ['[operation-queue]', ...arguments]); }catch(e){} }
  function isWinner(m){ return m && m.winner != null; }
  function isBye(m){ return !!(m && m.bye); }
  function isReadyPair(m){ return m && m.t1 != null && m.t2 != null; }
  function natural(a,b){ return String(a||'').localeCompare(String(b||''),'ko',{numeric:true,sensitivity:'base'}); }

  function currentTidSafe(){
    try{
      if(typeof currentTid === 'function') return clean(currentTid());
      if(window.G && G.currentTid) return clean(G.currentTid);
      const el = document.getElementById('tSelect') || document.getElementById('tourSelect') || document.querySelector('[data-current-tid]');
      return clean(el && (el.value || el.getAttribute('data-current-tid')));
    }catch(e){ return ''; }
  }
  function currentDivSafe(){
    try{
      if(typeof currentDiv === 'function') return clean(currentDiv());
      if(window.G && G.currentDiv) return clean(G.currentDiv);
      const el = document.getElementById('dSelect') || document.getElementById('divisionSelect') || document.querySelector('[data-current-division]');
      return clean(el && (el.value || el.getAttribute('data-current-division')));
    }catch(e){ return ''; }
  }
  function keyOf(tid, div){
    tid = clean(tid || currentTidSafe()); div = clean(div || currentDivSafe());
    try{ if(typeof kd === 'function' && tid && div) return kd(tid, div); }catch(e){}
    return tid && div ? (tid + '_' + div) : '';
  }
  function getTournament(tid){
    tid = clean(tid || currentTidSafe());
    try{ return arr(window.G && G.tournaments).find(t => clean(t.id) === tid) || null; }catch(e){ return null; }
  }
  function getDivisionConfig(tid, div){
    const t = getTournament(tid); div = clean(div || currentDivSafe());
    if(!t || !div) return null;
    try{
      const d = t.divisions;
      if(Array.isArray(d)) return d.find(x => clean(x && (x.name || x.division || x.title)) === div) || null;
      if(d && typeof d === 'object') return d[div] || null;
    }catch(e){}
    try{ return t.divSettings && t.divSettings[div] || null; }catch(e){}
    return null;
  }
  function normalizeCourtList(list){
    const out=[];
    arr(list).forEach(v=>{
      if(Array.isArray(v)) v.forEach(x=>{ const c=clean(x); if(c && !out.includes(c)) out.push(c); });
      else { const c=clean(v); if(c && !out.includes(c)) out.push(c); }
    });
    return out.filter(c => !/(공용\s*대기|대기중|미배정|빈코트|undefined|null)/i.test(c));
  }
  function venueOfCourt(court){
    const c = clean(court);
    if(!c) return '';
    if(/원도심|원도|인조/.test(c)) return '원도심';
    if(/국제|장유국제/.test(c)) return '국제';
    if(/장유중|클레이/.test(c)) return '장유중';
    if(/능동/.test(c)) return '능동';
    if(/금병/.test(c)) return '금병';
    if(/삼계/.test(c)) return '삼계';
    if(/동부/.test(c)) return '동부';
    return '기타';
  }
  function getActiveVenueGroups(courts){
    const groups={};
    normalizeCourtList(courts).forEach(c=>{ const v=venueOfCourt(c)||'기타'; (groups[v]||(groups[v]=[])).push(c); });
    return groups;
  }
  function getBoardCourtsForKey(key){
    try{
      let out=[];
      if(typeof getCourtBoardConfiguredCourtsV505 === 'function'){
        const cfg=getCourtBoardConfiguredCourtsV505(key)||{};
        if(cfg.explicit && Array.isArray(cfg.list) && cfg.list.length) out=cfg.list.map(String).filter(Boolean);
      }
      if(!out.length && typeof getSelectedCourtFilters === 'function') out=getSelectedCourtFilters(key)||[];
      if(!out.length && typeof getUsedCourtsForKey === 'function') out=getUsedCourtsForKey(key)||[];
      if(!out.length && typeof getIndividualAutoCourtPool === 'function') out=getIndividualAutoCourtPool(key,'main')||[];
      if(!out.length && typeof getIndividualAutoAssignmentPlan === 'function'){
        const plan=getIndividualAutoAssignmentPlan(key)||{}; out=plan.pool||[];
      }
      return normalizeCourtList(out);
    }catch(e){ return []; }
  }
  function getMainCourtsForKey(key){
    try{ const pool=typeof getIndividualAutoCourtPool==='function' ? getIndividualAutoCourtPool(key,'main') : []; if(arr(pool).length) return normalizeCourtList(pool); }catch(e){}
    return getBoardCourtsForKey(key);
  }
  function getPrelimCourtsForKey(key){
    try{ const pool=typeof getIndividualAutoCourtPool==='function' ? getIndividualAutoCourtPool(key,'group') : []; if(arr(pool).length) return normalizeCourtList(pool); }catch(e){}
    return getBoardCourtsForKey(key);
  }
  function getActiveVenueLabelsForKey(key){
    const courts = getBoardCourtsForKey(key);
    const groups = getActiveVenueGroups(courts);
    const labels = Object.keys(groups).filter(k => arr(groups[k]).length > 0);
    return {courts, groups, labels, split: labels.length > 1};
  }
  function courtOfMatch(m){
    if(!m) return '';
    let c=clean(m.manualCourtTarget || m.court || m.currentCourt || m.assignedCourt || m.manualCourt || '');
    if(!c && Array.isArray(m.courts) && m.courts[0]) c=clean(m.courts[0]);
    return c;
  }
  function isPrelimMatch(m){
    const p=clean(m&&m.phase).toLowerCase();
    if(p==='group' || p==='prelim') return true;
    if(m && m.group != null && !isMainMatch(m)) return true;
    return /^g[_-]/i.test(clean(m&&m.id));
  }
  function isMainMatch(m){
    const p=clean(m&&m.phase).toLowerCase();
    return p==='main' || p==='playin';
  }
  function isManualPinned(m){ return !!(m && (clean(m.manualCourtTarget) || m.manualCourtLocked===true)); }
  function isManualShared(m){ return !!(m && m.manualSharedHold && !clean(m.manualCourtTarget)); }

  function teamPrelimVenueMap(key){
    const map=new Map();
    try{
      arr(G && G.matches && G.matches[key]).forEach(m=>{
        if(!isPrelimMatch(m)) return;
        const c=courtOfMatch(m);
        const v=venueOfCourt(c);
        if(!v) return;
        [m.t1,m.t2].forEach(t=>{ if(t!=null && !map.has(String(t))) map.set(String(t), v); });
      });
    }catch(e){}
    return map;
  }
  function normalizeRawVenue(raw, activeLabels){
    raw=clean(raw);
    if(!raw) return '';
    if(activeLabels.includes(raw)) return raw;
    if(raw==='wondosim' && activeLabels.includes('원도심')) return '원도심';
    if(raw==='gukje' && activeLabels.includes('국제')) return '국제';
    if(raw==='neungdong' && activeLabels.includes('능동')) return '능동';
    if(raw==='jangyu_jung' && activeLabels.includes('장유중')) return '장유중';
    if(raw==='geumbyeong' && activeLabels.includes('금병')) return '금병';
    if(raw==='samgye' && activeLabels.includes('삼계')) return '삼계';
    if(raw==='dongbu' && activeLabels.includes('동부')) return '동부';
    return '';
  }
  function inferMatchVenueLabelForKey(key, m){
    const info=getActiveVenueLabelsForKey(key);
    const labels=info.labels||[];
    if(labels.length===1) return labels[0];
    const fromRaw=normalizeRawVenue(m && (m.venue || m.__venue), labels);
    if(fromRaw) return fromRaw;
    const target=courtOfMatch(m) || clean(m && m.__sharedCourtLabel);
    const byTarget=venueOfCourt(target);
    if(byTarget && (!labels.length || labels.includes(byTarget))) return byTarget;
    const teamVenue=teamPrelimVenueMap(key);
    const a=(m&&m.t1!=null) ? teamVenue.get(String(m.t1)) : '';
    const b=(m&&m.t2!=null) ? teamVenue.get(String(m.t2)) : '';
    if(a && labels.includes(a)) return a;
    if(b && labels.includes(b)) return b;
    return labels[0] || a || b || byTarget || '국제';
  }
  function firstCourtForVenue(key, venue){
    const info=getActiveVenueLabelsForKey(key);
    const list=(info.groups&&info.groups[venue])||[];
    return clean(list[0]||'');
  }
  function sortByQueueOrder(a,b){
    const aa=clean(a && (a.courtQueueOrder || a.courtAssignedAt || a.manualCourtPinnedAt || a.createdAt));
    const bb=clean(b && (b.courtQueueOrder || b.courtAssignedAt || b.manualCourtPinnedAt || b.createdAt));
    if(aa!==bb) return aa.localeCompare(bb);
    return clean(a&&a.id).localeCompare(clean(b&&b.id),'ko',{numeric:true});
  }
  function mainSort(a,b){
    const pa=clean(a.phase)==='playin'?0:1, pb=clean(b.phase)==='playin'?0:1;
    if(pa!==pb) return pa-pb;
    const ra=Number(a.round||0), rb=Number(b.round||0); if(ra!==rb) return ra-rb;
    const sa=Number(a.slot||0), sb=Number(b.slot||0); if(sa!==sb) return sa-sb;
    return clean(a.id).localeCompare(clean(b.id),'ko',{numeric:true});
  }
  function orderIso(tick){ return new Date(Date.UTC(2099,0,1,0,0,0, Math.max(0,tick||0))).toISOString(); }

  function markShared(key, m, venue){
    const first=firstCourtForVenue(key, venue);
    const before=JSON.stringify({court:m.court||'',courts:m.courts||[],v:m.venue||m.__venue||'',s:m.__sharedCourtLabel||'',label:m.autoCourtLabel||''});
    m.court=''; m.courts=[];
    delete m.courtAssignedAt; delete m.courtQueueOrder; delete m.waitingFirstAt; delete m.lastWaitingFirstAt;
    m.venue=venue; m.__venue=venue; m.__sharedCourtLabel=first;
    m.autoCourtLabel=venue ? (venue+' 공용 대기') : '공용 대기';
    if(m.manualSharedHold!==true) m.manualSharedHold=false;
    const after=JSON.stringify({court:m.court||'',courts:m.courts||[],v:m.venue||m.__venue||'',s:m.__sharedCourtLabel||'',label:m.autoCourtLabel||''});
    return before!==after;
  }
  function assignMainToCourt(m, court, venue, countBefore, tick){
    const before=JSON.stringify({court:m.court||'',courts:m.courts||[],v:m.venue||m.__venue||'',order:m.courtQueueOrder||'',wait:m.waitingFirstAt||'',label:m.autoCourtLabel||''});
    m.court=String(court); m.courts=[String(court)];
    m.venue=venue; m.__venue=venue; m.__sharedCourtLabel=String(court);
    m.autoCourtLabel='본선 자동배정';
    m.courtAssignedAt = m.courtAssignedAt || nowIso();
    m.courtQueueOrder = orderIso(tick);
    if(Number(countBefore||0)>=1){ m.waitingFirstAt=m.waitingFirstAt||nowIso(); }
    else { delete m.waitingFirstAt; delete m.lastWaitingFirstAt; }
    m.manualSharedHold=false;
    const after=JSON.stringify({court:m.court||'',courts:m.courts||[],v:m.venue||m.__venue||'',order:m.courtQueueOrder||'',wait:m.waitingFirstAt||'',label:m.autoCourtLabel||''});
    return before!==after;
  }

  function runCleanMainCourtAssignment(key, opts){
    opts=opts||{};
    if(!key || !(window.G && G.matches && Array.isArray(G.matches[key]))) return false;
    const matches=G.matches[key];
    const active=getActiveVenueLabelsForKey(key);
    const groups=active.groups || {};
    const labels=active.labels && active.labels.length ? active.labels : Object.keys(groups);
    if(!labels.length) return false;
    let changed=false;

    // 1) Build immutable occupancy from prelim + manual-pinned matches. Auto main is rebuilt from scratch.
    const occupancy={};
    labels.forEach(v=>arr(groups[v]).forEach(c=>{ occupancy[c]=[]; }));

    // Clear only non-manual unfinished main/playin matches. Do not touch prelim.
    matches.forEach(m=>{
      if(!m || isWinner(m) || !isMainMatch(m)) return;
      const venue=inferMatchVenueLabelForKey(key,m);
      if(isManualShared(m)) { changed = markShared(key,m,venue) || changed; return; }
      if(isManualPinned(m)) return;
      if(clean(m.court) || arr(m.courts).length || clean(m.autoCourtLabel) || clean(m.courtQueueOrder)){
        m.court=''; m.courts=[]; delete m.courtAssignedAt; delete m.courtQueueOrder; delete m.waitingFirstAt; delete m.lastWaitingFirstAt; delete m.autoCourtLabel;
        changed=true;
      }
      m.venue=venue; m.__venue=venue; m.__sharedCourtLabel=firstCourtForVenue(key, venue);
    });

    // Now count prelim and manual assignments.
    matches.slice().sort(sortByQueueOrder).forEach(m=>{
      if(!m || isWinner(m)) return;
      const c=courtOfMatch(m);
      if(!c || !Object.prototype.hasOwnProperty.call(occupancy,c)) return;
      if(isPrelimMatch(m) || (isMainMatch(m) && isManualPinned(m))){
        occupancy[c].push(m);
      }
    });

    // 2) Ready main queue by venue.
    const queues={}; labels.forEach(v=>queues[v]=[]);
    matches.filter(m=>m && !isWinner(m) && !isBye(m) && isMainMatch(m) && isReadyPair(m) && !isManualPinned(m) && !isManualShared(m))
      .sort(mainSort)
      .forEach(m=>{
        const venue=inferMatchVenueLabelForKey(key,m);
        const v=queues[venue] ? venue : labels[0];
        m.venue=v; m.__venue=v; m.__sharedCourtLabel=firstCourtForVenue(key,v);
        queues[v].push(m);
      });

    // 3) For each venue: court capacity is exactly 2 cards total (current + waiting1). Prelim always occupies first.
    let tick=0;
    const venueCursor={}; labels.forEach(v=>venueCursor[v]=0);
    function pickCourt(v){
      const courts=arr(groups[v]);
      if(!courts.length) return '';
      // empty first, then one-card court. round-robin within each level.
      for(const targetCount of [0,1]){
        for(let step=0; step<courts.length; step++){
          const idx=(Number(venueCursor[v]||0)+step)%courts.length;
          const c=String(courts[idx]);
          const count=arr(occupancy[c]).length;
          if(count===targetCount && count<2){ venueCursor[v]=(idx+1)%courts.length; return c; }
        }
      }
      return '';
    }

    labels.forEach(v=>{
      const q=queues[v]||[];
      q.forEach(m=>{
        const c=pickCourt(v);
        if(c){ const before=arr(occupancy[c]).length; changed = assignMainToCourt(m,c,v,before,tick++) || changed; occupancy[c].push(m); }
        else { changed = markShared(key,m,v) || changed; }
      });
    });

    try{ console.log('[v996] clean main court engine', key, labels.map(v=>v+':'+(queues[v]||[]).length).join(' / ')); }catch(e){}
    return changed;
  }

  function rebuildNoMainDuringDraw(key){
    // Main draw creation must not push main cards into courts. Keep prelim auto helpers only.
    try{
      if(key && window.G && G.matches && Array.isArray(G.matches[key])){
        const hasUnassignedGroup=G.matches[key].some(m=>m && !isWinner(m) && isPrelimMatch(m) && !courtOfMatch(m) && !(Array.isArray(m.courts)&&m.courts.length));
        if(hasUnassignedGroup && typeof window.assignPrelimCourtsEvenly==='function') window.assignPrelimCourtsEvenly(key);
      }
    }catch(e){ console.warn('[v996] prelim helper failed', e); }
    return false;
  }

  async function runMainAssignButton(key){
    try{
      key=clean(key); if(!key || !(window.G&&G.matches&&G.matches[key])) return false;
      const changed=runCleanMainCourtAssignment(key,{manualButton:true});
      if(!changed){
        if(typeof toastMsg==='function') toastMsg('배정할 본선 경기가 없거나 이미 정리되어 있습니다','info');
        else if(typeof toast==='function') toast('배정할 본선 경기가 없거나 이미 정리되어 있습니다','info');
        try{ if(typeof renderBracket==='function') renderBracket(); }catch(e){}
        return false;
      }
      try{ if(window.__FB_WRITE_CACHE&&window.__FB_WRITE_CACHE.matches) delete window.__FB_WRITE_CACHE.matches[key]; }catch(e){}
      const save=window.stM || window.__v728_stM;
      if(typeof save==='function') await save(key);
      try{ if(typeof renderBracket==='function') renderBracket(); }catch(e){}
      if(typeof toastMsg==='function') toastMsg('본선 코트 배정 완료 ✅ 예선 우선순위 보호 적용','success');
      else if(typeof toast==='function') toast('본선 코트 배정 완료 ✅','success');
      return true;
    }catch(e){
      console.error('[v996] clean main assign failed', e);
      if(typeof toastMsg==='function') toastMsg('본선 코트 배정 실패: '+(e&&e.message?e.message:e),'error');
      return false;
    }
  }

  // Keep shared queue venue rendering compatible with v993 board.
  function normalizeSharedMatchVenueLabelForActiveCourts(key,m){
    try{ if(m){ const v=inferMatchVenueLabelForKey(key,m); if(v){m.venue=v;m.__venue=v;if(!clean(m.__sharedCourtLabel)) m.__sharedCourtLabel=firstCourtForVenue(key,v);} } }catch(e){}
    return m;
  }
  function installSharedVenueGuard(){
    try{
      if(typeof window.getCourtBoardSharedOverflowItems === 'function' && !window.getCourtBoardSharedOverflowItems.__v996VenueGuard){
        const oldShared=window.getCourtBoardSharedOverflowItems;
        const wrapped=function(key,items,selectedCourts,usedCourts){
          const list=oldShared.apply(this,arguments)||[];
          try{ list.forEach(m=>normalizeSharedMatchVenueLabelForActiveCourts(key,m)); }catch(e){}
          return list;
        };
        wrapped.__v996VenueGuard=true; wrapped.__old=oldShared; window.getCourtBoardSharedOverflowItems=wrapped;
      }
    }catch(e){}
  }

  const API={
    version: VERSION,
    currentTid: currentTidSafe,
    currentDiv: currentDivSafe,
    keyOf,
    getTournament,
    getDivisionConfig,
    normalizeCourtList,
    venueOfCourt,
    getActiveVenueGroups,
    getBoardCourtsForKey,
    getMainCourtsForKey,
    getPrelimCourtsForKey,
    getActiveVenueLabelsForKey,
    inferMatchVenueLabelForKey,
    normalizeSharedMatchVenueLabelForActiveCourts,
    runCleanMainCourtAssignment,
    runMainAssignButton,
    installSharedVenueGuard,
    debug(on){ window.__OPQ_DEBUG__=!!on; log('debug',!!on); }
  };
  window.OperationQueueV996=API;
  window.OperationQueueV993=API; // renderCourtStatusBoard already asks OperationQueueV993.

  // Replace scattered assignment entry points with the clean engine.
  window.rebuildIndividualAutoCourtAssignmentsForKey = rebuildNoMainDuringDraw;
  window.ensureIndividualAutoCourtAssignmentsForKey = rebuildNoMainDuringDraw;
  window.v773RunMainAssign = runMainAssignButton;
  window.v771AssignMainCourts = function(key,save){ return runCleanMainCourtAssignment(key,{legacy:true,save:!!save}); };
  window.v770AssignMainCourts = window.v771AssignMainCourts;
  window.v766AssignMainCourtsNow = window.v771AssignMainCourts;
  // Post-draw/auto repair aliases must not assign main cards automatically. Admin button does that explicitly.
  ['v748RunMainAutoCourtRebuild','v753RunMainAutoAssign','v760RunMainAutoAssign','v765RunMainCourtRepair','v769RepairKey'].forEach(name=>{
    window[name]=function(key){ try{ console.log('[v996] '+name+' skipped: main court assignment requires admin button'); }catch(e){} return false; };
  });

  installSharedVenueGuard();
  setTimeout(installSharedVenueGuard,300);
  setTimeout(installSharedVenueGuard,1200);
  try{ console.log('[v996] clean operation engine loaded'); }catch(e){}
})();
