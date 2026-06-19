/* v998 clean operation engine + clean main draw engine
   Purpose: replace the scattered main-court assignment patches with one data-first engine.
   Base: v993 successful general venue split. v994/v995 display-reorder patches are intentionally not used.
*/
(function(){
  'use strict';
  if(window.__operationQueueV998Installed) return;
  window.__operationQueueV998Installed = true;
  const VERSION = 'v998-clean-main-draw-engine';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function nowIso(){ return new Date().toISOString(); }
  function log(){ try{ if(window.__OPQ_DEBUG__) console.log.apply(console, ['[operation-queue]', ...arguments]); }catch(e){} }
  function isWinner(m){ return m && m.winner != null; }
  function isBye(m){ return !!(m && m.bye); }
  function isReadyPair(m){
    if(!m) return false;
    if(m.t1 != null && m.t2 != null) return true;
    const a=clean(m.source1Label || m.label1 || '');
    const b=clean(m.source2Label || m.label2 || '');
    if(a && b && !/^부전승$/i.test(b) && !/^TBD$/i.test(a) && !/^TBD$/i.test(b)) return true;
    return false;
  }
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

  const VENUE_MODE_KEY_PREFIX='OPQ_MAIN_VENUE_MODE:';
  function venueModeStorageKey(key){ return VENUE_MODE_KEY_PREFIX + clean(key||keyOf()); }
  function normalizeMainVenueMode(v){
    v=clean(v).toLowerCase();
    if(['preserve','keep','prelim','prelim_venue','keep_prelim','venue_keep'].includes(v)) return 'preserve';
    if(['rebalance','overall','all','mixed','redistribute','reset'].includes(v)) return 'rebalance';
    return '';
  }
  function setMainVenueModeForKey(key,mode){
    key=clean(key||keyOf()); mode=normalizeMainVenueMode(mode)||'rebalance';
    try{ localStorage.setItem(venueModeStorageKey(key), mode); }catch(e){}
    try{
      if(window.G){
        G.draws=G.draws||{}; G.draws[key]=G.draws[key]||{};
        G.draws[key].mainVenueMode=mode;
        G.draws[key].mainCourtVenueMode=mode;
        G.draws[key].mainVenueModeUpdatedAt=nowIso();
      }
    }catch(e){}
    return mode;
  }
  function getMainVenueModeForKey(key){
    key=clean(key||keyOf());
    let mode='';
    try{ const d=window.G && G.draws && G.draws[key]; mode=normalizeMainVenueMode(d && (d.mainVenueMode || d.mainCourtVenueMode || d.venueMode)); }catch(e){}
    if(!mode){ try{ const d=window.G && G.draws && G.draws[key]; if(d && d.v606KeepCourtGroup && d.v606KeepCourtGroup.enabled) mode='preserve'; }catch(e){} }
    if(!mode){ try{ mode=normalizeMainVenueMode(localStorage.getItem(venueModeStorageKey(key))); }catch(e){} }
    return mode || 'rebalance';
  }
  function venueWeightListForKey(key){
    const info=getActiveVenueLabelsForKey(key);
    const groups=info.groups||{};
    const labels=(info.labels&&info.labels.length)?info.labels:Object.keys(groups);
    const weighted=[];
    labels.forEach(v=>{
      const n=Math.max(1, arr(groups[v]).length || 1);
      for(let i=0;i<n;i++) weighted.push(v);
    });
    return weighted.length?weighted:labels;
  }
  function rebalanceVenueForMatch(key,m){
    const weighted=venueWeightListForKey(key);
    if(!weighted.length) return '';
    const slot = Number(m && (m.slot ?? m.mainSlot ?? 0));
    const round = Number(m && (m.round ?? 0));
    const idx = Math.abs((Number.isFinite(slot)?slot:0) + (Number.isFinite(round)?round*997:0)) % weighted.length;
    return weighted[idx] || weighted[0];
  }
  function getPrelimVenueForMatchByTeams(key,m,labels){
    const teamVenue=teamPrelimVenueMap(key);
    const a=(m&&m.t1!=null) ? teamVenue.get(String(m.t1)) : '';
    const b=(m&&m.t2!=null) ? teamVenue.get(String(m.t2)) : '';
    if(a && labels.includes(a)) return a;
    if(b && labels.includes(b)) return b;
    return a||b||'';
  }
  function inferMatchVenueLabelForKey(key, m){
    const info=getActiveVenueLabelsForKey(key);
    const labels=info.labels||[];
    if(labels.length===1) return labels[0];

    // v997: 본선/진출전의 구장 배정 방식은 관리자가 본선 추첨 시 선택한다.
    // - rebalance: 전체 재배정(기본값). 사용 코트 수 비율에 맞춰 구장을 다시 분산한다.
    // - preserve : 예선 구장 유지. 예선 출신 구장 기준으로 본선 구간/공용대기를 나눈다.
    if(m && isMainMatch(m)){
      const mode=getMainVenueModeForKey(key);
      if(mode==='rebalance'){
        const v=rebalanceVenueForMatch(key,m);
        if(v && (!labels.length || labels.includes(v))) return v;
      }
      if(mode==='preserve'){
        const pv=getPrelimVenueForMatchByTeams(key,m,labels);
        if(pv && (!labels.length || labels.includes(pv))) return pv;
      }
    }

    const fromRaw=normalizeRawVenue(m && (m.venue || m.__venue), labels);
    if(fromRaw) return fromRaw;
    const target=courtOfMatch(m) || clean(m && m.__sharedCourtLabel);
    const byTarget=venueOfCourt(target);
    if(byTarget && (!labels.length || labels.includes(byTarget))) return byTarget;
    const pv=getPrelimVenueForMatchByTeams(key,m,labels);
    if(pv && (!labels.length || labels.includes(pv))) return pv;
    return labels[0] || byTarget || '국제';
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

    try{ console.log('[v998] clean main court engine', key, labels.map(v=>v+':'+(queues[v]||[]).length).join(' / ')); }catch(e){}
    return changed;
  }

  function rebuildNoMainDuringDraw(key){
    // Main draw creation must not push main cards into courts. Keep prelim auto helpers only.
    try{
      if(key && window.G && G.matches && Array.isArray(G.matches[key])){
        const hasUnassignedGroup=G.matches[key].some(m=>m && !isWinner(m) && isPrelimMatch(m) && !courtOfMatch(m) && !(Array.isArray(m.courts)&&m.courts.length));
        if(hasUnassignedGroup && typeof window.assignPrelimCourtsEvenly==='function') window.assignPrelimCourtsEvenly(key);
      }
    }catch(e){ console.warn('[v997] prelim helper failed', e); }
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
      console.error('[v998] clean main assign failed', e);
      if(typeof toastMsg==='function') toastMsg('본선 코트 배정 실패: '+(e&&e.message?e.message:e),'error');
      return false;
    }
  }

  // Keep shared queue venue rendering compatible with v993 board.
  function normalizeSharedMatchVenueLabelForActiveCourts(key,m){
    try{ if(m){ const v=inferMatchVenueLabelForKey(key,m); if(v){m.venue=v;m.__venue=v;if(!clean(m.__sharedCourtLabel)) m.__sharedCourtLabel=firstCourtForVenue(key,v);} } }catch(e){}
    return m;
  }

  function ensureMainVenueModeStyle(){
    if(document.getElementById('opqVenueModeStyle')) return;
    const st=document.createElement('style');
    st.id='opqVenueModeStyle';
    st.textContent=`
      .opq-main-venue-mode{margin-top:14px;padding:13px 14px;border:1.5px solid #d4a017;border-radius:16px;background:linear-gradient(135deg,#fffdf5,#f8fbff);}
      .opq-main-venue-mode-title{font-weight:1000;color:#0f1e3a;font-size:.9rem;margin-bottom:10px;display:flex;align-items:center;gap:6px;}
      .opq-main-venue-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
      .opq-main-venue-option{display:flex;gap:8px;align-items:flex-start;padding:11px 12px;border:2px solid #dbe3f0;border-radius:14px;background:#fff;cursor:pointer;line-height:1.45;}
      .opq-main-venue-option b{display:block;font-size:.84rem;color:#0f1e3a;}
      .opq-main-venue-option span{display:block;font-size:.72rem;color:#64748b;margin-top:2px;}
      .opq-main-venue-option input{margin-top:2px;accent-color:#d4a017;}
      .opq-main-venue-option:has(input:checked){border-color:#d4a017;background:#fff7dd;box-shadow:0 8px 18px rgba(212,160,23,.13);}
      .opq-main-venue-note{font-size:.72rem;color:#64748b;margin-top:9px;line-height:1.55;}
      #v606KeepCourtGroupSection{display:none !important;}
      @media(max-width:680px){.opq-main-venue-options{grid-template-columns:1fr}.opq-main-venue-mode{padding:12px}}
    `;
    document.head.appendChild(st);
  }
  function injectMainVenueModeUi(key){
    try{
      ensureMainVenueModeStyle();
      const modal=document.getElementById('mIndividualMainDraw');
      if(!modal) return;
      const body=modal.querySelector('.modal-body');
      if(!body) return;
      let box=document.getElementById('opqMainVenueModeBox');
      if(!box){
        box=document.createElement('div');
        box.id='opqMainVenueModeBox';
        box.className='opq-main-venue-mode';
        box.innerHTML=`
          <div class="opq-main-venue-mode-title">🧭 본선 구장 운영 방식</div>
          <div class="opq-main-venue-options">
            <label class="opq-main-venue-option">
              <input type="radio" name="opqMainVenueMode" value="rebalance">
              <div><b>전체 재배정</b><span>본선 진출팀을 전체 사용 코트에 다시 고르게 배정합니다. 기본값입니다.</span></div>
            </label>
            <label class="opq-main-venue-option">
              <input type="radio" name="opqMainVenueMode" value="preserve">
              <div><b>예선 구장 유지</b><span>국제 출신은 국제, 능동 출신은 능동처럼 이동 없이 구장별 본선을 우선 운영합니다.</span></div>
            </label>
          </div>
          <div class="opq-main-venue-note">※ 본선 추첨은 대진표/구장 구간만 확정하고, 실제 코트 투입은 <b>본선 코트배정</b> 버튼을 눌렀을 때 적용됩니다.</div>`;
        const testRow=document.getElementById('individualMainDrawIsTestInput');
        const testLabel=testRow ? testRow.closest('label') : null;
        if(testLabel && testLabel.parentElement===body) body.insertBefore(box, testLabel);
        else body.appendChild(box);
      }
      const mode=getMainVenueModeForKey(key||keyOf());
      const radio=box.querySelector(`input[name="opqMainVenueMode"][value="${mode}"]`) || box.querySelector('input[value="rebalance"]');
      if(radio) radio.checked=true;
    }catch(e){ console.warn('[v998] main venue mode UI inject failed',e); }
  }
  function readMainVenueModeFromUi(){
    const el=document.querySelector('input[name="opqMainVenueMode"]:checked');
    return normalizeMainVenueMode(el && el.value) || 'rebalance';
  }
  function installMainDrawVenueModeHooks(){
    if(window.__opqMainVenueModeHooksV997) return;
    window.__opqMainVenueModeHooksV997=true;
    ensureMainVenueModeStyle();
    try{
      const oldOpen=window.openIndividualMainDraw;
      if(typeof oldOpen==='function' && !oldOpen.__opqVenueModeWrapped){
        const wrapped=function(tid,div){
          const r=oldOpen.apply(this,arguments);
          setTimeout(()=>injectMainVenueModeUi(keyOf(tid,div)),0);
          setTimeout(()=>injectMainVenueModeUi(keyOf(tid,div)),160);
          return r;
        };
        wrapped.__opqVenueModeWrapped=true; wrapped.__old=oldOpen; window.openIndividualMainDraw=wrapped;
      }
    }catch(e){}
    try{
      const oldStart=window.startIndividualMainDraw;
      if(typeof oldStart==='function' && !oldStart.__opqVenueModeWrapped){
        const wrapped=async function(){
          const key=keyOf();
          const mode=setMainVenueModeForKey(key, readMainVenueModeFromUi());
          try{
            const oldV606=document.getElementById('v606KeepCourtGroupEnabled');
            if(oldV606) oldV606.checked=(mode==='preserve');
          }catch(e){}
          const r=await oldStart.apply(this,arguments);
          setTimeout(()=>{
            try{
              setMainVenueModeForKey(key, mode);
              if(window.G && G.draws && G.draws[key] && typeof window.stD==='function') window.stD(key);
            }catch(e){}
          },700);
          return r;
        };
        wrapped.__opqVenueModeWrapped=true; wrapped.__old=oldStart; window.startIndividualMainDraw=wrapped;
      }
    }catch(e){}
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



  /* ─────────────────────────────────────────────────────────────
     v998 Clean main draw builder
     - Removes the hard-coded 128 draw / 국제+원도심 fixed table logic.
     - Draw size is derived only from actual advEntries count.
     - Venue mode is selected by admin at main-draw time:
       rebalance = redistribute across all active venues by court count
       preserve  = keep preliminary venue sections and draw inside each section
  ───────────────────────────────────────────────────────────── */
  function safeGrpLabel(gi){
    try{ if(typeof grpLabel==='function') return grpLabel(Number(gi)||0); }catch(e){}
    const n=(Number(gi)||0)+1;
    const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return n<=26 ? (letters[n-1]+'조') : (n+'조');
  }
  function safeNextPow2(n){
    n=Math.max(1, Number(n||0));
    try{ if(typeof nextPow2==='function') return Number(nextPow2(n))||n; }catch(e){}
    let p=1; while(p<n) p*=2; return p;
  }
  function safeMainSpec(total){
    try{ if(typeof computeMainBracketSpec==='function'){ const sp=computeMainBracketSpec(total); if(sp&&sp.mainSize) return sp; } }catch(e){}
    const mainSize=safeNextPow2(total);
    return {mainSize, playInTeams:0, playInMatches:0, winnersNeeded:0, directCount:total, exact:mainSize===total};
  }
  function cleanEntryLabel(e){
    try{ if(typeof getMainEntryBracketLabel==='function'){ const x=getMainEntryBracketLabel(e); if(clean(x)) return clean(x); } }catch(_e){}
    if(e && e.gn && e.rk) return safeGrpLabel(Number(e.gn)-1)+' '+Number(e.rk)+'위';
    return clean(e && (e.nm || e.name || e.label)) || 'TBD';
  }
  function pickByeIndicesClean(matchCount, byeCount){
    matchCount=Number(matchCount||0); byeCount=Math.max(0, Math.min(Number(byeCount||0), matchCount));
    if(!byeCount) return [];
    try{
      if(typeof pickByeMatchIndices==='function'){
        const a=arr(pickByeMatchIndices(matchCount,byeCount)).map(Number).filter(i=>Number.isFinite(i)&&i>=0&&i<matchCount);
        if(a.length===byeCount) return [...new Set(a)].slice(0,byeCount);
      }
    }catch(e){}
    const out=[];
    for(let i=0;i<byeCount;i++){
      let idx=Math.floor((i+1)*matchCount/(byeCount+1));
      while(out.includes(idx) && idx<matchCount-1) idx++;
      while(out.includes(idx) && idx>0) idx--;
      out.push(idx);
    }
    return [...new Set(out)].slice(0,byeCount).sort((a,b)=>a-b);
  }
  function entrySourceVenue(key,e,activeLabels){
    const labels=arr(activeLabels);
    const raw=normalizeRawVenue(e && (e.venue || e.__venue || e.prelimVenue || e.venueLabel), labels);
    if(raw) return raw;
    try{
      const gi=Number(e&&e.gn)-1;
      const d=window.G && G.draws && G.draws[key];
      const g=d && d.groups && d.groups[gi];
      const courts=[];
      if(g){
        if(Array.isArray(g.courts)) g.courts.forEach(c=>courts.push(c));
        if(g.court) courts.push(g.court);
        if(g.assignedCourt) courts.push(g.assignedCourt);
      }
      for(const c of courts){ const v=venueOfCourt(c); if(v && (!labels.length || labels.includes(v))) return v; }
    }catch(e){}
    try{
      const teamVenue=teamPrelimVenueMap(key);
      if(e && e.ti!=null){ const v=teamVenue.get(String(e.ti)); if(v && (!labels.length || labels.includes(v))) return v; }
    }catch(e){}
    return labels[0] || '국제';
  }
  function venueTheme(label){
    label=clean(label)||'통합';
    const table={
      '국제':{label:'국제', icon:'🔵', bg:'#eaf3ff', bd:'#2563eb', fg:'#1d4ed8', head:'#dbeafe'},
      '능동':{label:'능동', icon:'🟣', bg:'#f3edff', bd:'#8b5cf6', fg:'#6d28d9', head:'#ede9fe'},
      '원도심':{label:'원도심', icon:'🟢', bg:'#ecfdf5', bd:'#22c55e', fg:'#15803d', head:'#dcfce7'},
      '장유중':{label:'장유중', icon:'🟤', bg:'#fff7ed', bd:'#f97316', fg:'#c2410c', head:'#ffedd5'},
      '금병':{label:'금병', icon:'🟡', bg:'#fefce8', bd:'#eab308', fg:'#854d0e', head:'#fef3c7'},
      '삼계':{label:'삼계', icon:'🔴', bg:'#fff1f2', bd:'#f43f5e', fg:'#be123c', head:'#ffe4e6'},
      '동부':{label:'동부', icon:'🟦', bg:'#eef2ff', bd:'#6366f1', fg:'#3730a3', head:'#e0e7ff'},
      '통합':{label:'통합', icon:'⚪', bg:'#f8fafc', bd:'#94a3b8', fg:'#475569', head:'#e2e8f0'},
      '기타':{label:'기타', icon:'⚪', bg:'#f8fafc', bd:'#94a3b8', fg:'#475569', head:'#e2e8f0'}
    };
    return table[label] || {label, icon:'⚪', bg:'#f8fafc', bd:'#94a3b8', fg:'#475569', head:'#e2e8f0'};
  }
  function orderedActiveVenueLabels(key){
    const info=getActiveVenueLabelsForKey(key);
    const labels=arr(info.labels);
    const pref=['국제','능동','원도심','장유중','금병','삼계','동부','기타'];
    return labels.sort((a,b)=>{
      const ia=pref.indexOf(a), ib=pref.indexOf(b);
      if(ia!==ib) return (ia<0?99:ia)-(ib<0?99:ib);
      return natural(a,b);
    });
  }
  function buildVenueSlotPlan(key, entries, matchCount, mode){
    const labels=orderedActiveVenueLabels(key);
    if(!labels.length) return Array.from({length:matchCount},()=> '국제');
    if(labels.length===1) return Array.from({length:matchCount},()=>labels[0]);
    if(normalizeMainVenueMode(mode)==='preserve'){
      const counts={}; labels.forEach(v=>counts[v]=0);
      entries.forEach(e=>{ const v=entrySourceVenue(key,e,labels); counts[v]=(counts[v]||0)+1; });
      let needed={}; labels.forEach(v=>{ needed[v]=counts[v]>0?Math.max(1, Math.ceil(counts[v]/2)):0; });
      let sum=labels.reduce((a,v)=>a+needed[v],0);
      while(sum>matchCount){
        const cand=labels.filter(v=>needed[v]>1).sort((a,b)=>(needed[b]-Math.ceil((counts[b]||0)/2))-(needed[a]-Math.ceil((counts[a]||0)/2)) || needed[b]-needed[a])[0];
        if(!cand) break; needed[cand]--; sum--;
      }
      while(sum<matchCount){
        const weighted=venueWeightListForKey(key);
        const v=weighted[sum % Math.max(1, weighted.length)] || labels[sum%labels.length];
        needed[v]=(needed[v]||0)+1; sum++;
      }
      const out=[]; labels.forEach(v=>{ for(let i=0;i<(needed[v]||0);i++) out.push(v); });
      return out.slice(0,matchCount);
    }
    const weighted=venueWeightListForKey(key).filter(v=>labels.includes(v));
    const src=weighted.length?weighted:labels;
    return Array.from({length:matchCount},(_,i)=>src[i%src.length]||labels[0]);
  }
  function chooseNonSameGroup(list, gn){
    let idx=list.findIndex(e=>e && e.gn!==gn);
    if(idx<0) idx=0;
    if(idx<0) return null;
    return list.splice(idx,1)[0]||null;
  }
  function assignEntryToSide(slot, side, entry, groupLabelOnly){
    if(!entry) return;
    const lbl=cleanEntryLabel(entry);
    if(side==='t1'){
      slot.source1Label=lbl;
      if(!groupLabelOnly && entry.ti!=null) slot.t1=Number(entry.ti);
      slot.gnTarget=entry.gn||null; slot.rkTarget=entry.rk||null;
    }else{
      slot.source2Label=lbl;
      if(!groupLabelOnly && entry.ti!=null) slot.t2=Number(entry.ti);
      slot.gnTarget2=entry.gn||null; slot.rkTarget2=entry.rk||null;
    }
  }
  function fillSlotsClean(slots, entries, groupLabelOnly){
    const normal=slots.filter(s=>!s.bye);
    const byes=slots.filter(s=>s.bye);
    const r1=entries.filter(e=>Number(e.rk||0)===1 || e.playInPlaceholder);
    const r2=entries.filter(e=>!(Number(e.rk||0)===1 || e.playInPlaceholder));
    byes.forEach(s=>{ const e=r1.shift()||r2.shift(); if(e){ assignEntryToSide(s,'t1',e,groupLabelOnly); if(!groupLabelOnly && e.ti!=null){ s.winner=Number(e.ti); } } s.source2Label='부전승'; });
    normal.forEach(s=>{ const e=r1.shift(); if(e) assignEntryToSide(s,'t1',e,groupLabelOnly); });
    normal.forEach(s=>{
      if(!s.source1Label) return;
      const e1gn=s.gnTarget;
      const e2=chooseNonSameGroup(r2,e1gn);
      if(e2) assignEntryToSide(s,'t2',e2,groupLabelOnly);
    });
    const leftovers=[...r1,...r2];
    normal.forEach(s=>{
      if(!s.source1Label){ const e=leftovers.shift(); if(e) assignEntryToSide(s,'t1',e,groupLabelOnly); }
      if(!s.source2Label){ const e=chooseNonSameGroup(leftovers,s.gnTarget); if(e) assignEntryToSide(s,'t2',e,groupLabelOnly); }
    });
  }
  function makeRound0Slots(key, entries, bracketN, mode, groupLabelOnly){
    const matchCount=bracketN/2;
    const byeCount=Math.max(0, bracketN-entries.length);
    const byeSet=new Set(pickByeIndicesClean(matchCount, byeCount));
    const slotVenues=buildVenueSlotPlan(key, entries, matchCount, mode);
    const slots=Array.from({length:matchCount},(_,i)=>({
      id:`main_r0_${i}`, phase:'main', round:0, slot:i, bracketN,
      t1:null,t2:null,winner:null,rubbers:[],court:'',courts:[],bye:byeSet.has(i),
      source1Label:'', source2Label:byeSet.has(i)?'부전승':'',
      venue:slotVenues[i]||slotVenues[0]||'국제', __venue:slotVenues[i]||slotVenues[0]||'국제'
    }));
    const labels=orderedActiveVenueLabels(key);
    if(normalizeMainVenueMode(mode)==='preserve' && labels.length>1){
      const byV={}; labels.forEach(v=>byV[v]=[]);
      entries.forEach(e=>{ const v=entrySourceVenue(key,e,labels); (byV[v]||(byV[v]=[])).push(e); });
      labels.forEach(v=>fillSlotsClean(slots.filter(s=>s.venue===v), byV[v]||[], groupLabelOnly));
      const assigned=new Set(slots.flatMap(s=>[s.source1Label,s.source2Label]).filter(Boolean));
      const leftovers=entries.filter(e=>!assigned.has(cleanEntryLabel(e)));
      if(leftovers.length) fillSlotsClean(slots.filter(s=>!s.source1Label || (!s.bye&&!s.source2Label)), leftovers, groupLabelOnly);
    }else{
      fillSlotsClean(slots, entries, groupLabelOnly);
    }
    return slots;
  }
  function buildUpperRoundsClean(round0){
    const result=[...round0];
    let prev=round0;
    let round=1;
    while(prev.length>1){
      const next=[];
      for(let i=0;i<prev.length;i+=2){
        const a=prev[i], b=prev[i+1];
        const venue=(a&&b&&a.venue===b.venue)?a.venue:'통합';
        const m={id:`main_r${round}_${Math.floor(i/2)}`, phase:'main', round, slot:Math.floor(i/2), bracketN:Math.max(2, prev.length),
          t1:null,t2:null,winner:null,rubbers:[],court:'',courts:[],bye:false,venue,__venue:venue};
        [a,b].forEach((child,ci)=>{
          if(child && child.bye && child.winner!=null){ if(ci===0) m.t1=child.winner; else m.t2=child.winner; }
        });
        next.push(m); result.push(m);
      }
      prev=next; round++;
    }
    return result;
  }
  function buildCleanMainMatches(advT,key,teams,groupLabelOnly){
    key=clean(key||keyOf());
    const entries=arr(advT).map(e=>({...(e||{}), nm:e&&e.nm?e.nm:cleanEntryLabel(e), _groupLabel:cleanEntryLabel(e)}));
    const total=entries.length;
    if(total<2) return [];
    const mode=getMainVenueModeForKey(key);
    const spec=safeMainSpec(total);
    let mainEntries=entries;
    const playIn=[];
    if(spec.playInMatches>0){
      const rank2=entries.filter(e=>Number(e.rk||0)!==1);
      const playInEntries=rank2.slice(0, spec.playInTeams||0);
      const playSet=new Set(playInEntries.map(e=>cleanEntryLabel(e)+'|'+e.ti+'|'+e.gn+'|'+e.rk));
      const direct=entries.filter(e=>!playSet.has(cleanEntryLabel(e)+'|'+e.ti+'|'+e.gn+'|'+e.rk));
      const placeholders=Array.from({length:spec.winnersNeeded||0},(_,i)=>({nm:`진출전 승자${i+1}`,rk:1,gn:null,ti:null,placeholder:true,playInPlaceholder:true,playInId:i+1,venue:''}));
      mainEntries=[...direct,...placeholders];
      for(let i=0;i<(spec.playInMatches||0);i++){
        const a=playInEntries[i*2]||null, b=playInEntries[i*2+1]||null;
        const v=(normalizeMainVenueMode(mode)==='preserve') ? (entrySourceVenue(key,a,orderedActiveVenueLabels(key)) || entrySourceVenue(key,b,orderedActiveVenueLabels(key))) : (buildVenueSlotPlan(key, entries, spec.playInMatches, mode)[i]||'국제');
        playIn.push({id:`playin_${i}`,phase:'playin',round:0,slot:i,t1:(!groupLabelOnly&&a&&a.ti!=null)?Number(a.ti):null,t2:(!groupLabelOnly&&b&&b.ti!=null)?Number(b.ti):null,winner:null,rubbers:[],court:'',courts:[],bye:false,playInId:i+1,winnerLabel:`진출전 승자${i+1}`,source1Label:a?cleanEntryLabel(a):'TBD',source2Label:b?cleanEntryLabel(b):'TBD',venue:v,__venue:v});
      }
    }
    const bracketN=Number(spec.mainSize)||safeNextPow2(mainEntries.length);
    const r0=makeRound0Slots(key, mainEntries, bracketN, mode, groupLabelOnly);
    return [...playIn, ...buildUpperRoundsClean(r0)];
  }
  function installCleanMainDrawBuilder(){
    try{
      const fn=function(advT,key,teams,groupLabelOnly){ return buildCleanMainMatches(advT,key,teams,!!groupLabelOnly); };
      window.buildIndivMainMatchesFixed=fn;
      try{ buildIndivMainMatchesFixed=fn; }catch(e){}
    }catch(e){ console.warn('[v998] clean builder install failed',e); }
    try{
      // Old v748 venue post-process rewrote venue into hard-coded gukje/wondosim. Replace it with a safe normalizer.
      window.v748ApplyVenueToMainMatches=function(key){
        try{
          key=clean(key||keyOf());
          arr(window.G&&G.matches&&G.matches[key]).forEach(m=>{ if(m&&isMainMatch(m)){ const v=inferMatchVenueLabelForKey(key,m); m.venue=v; m.__venue=v; } });
          return true;
        }catch(e){return false;}
      };
    }catch(e){}
  }
  function styleMainTreeVenueBadges(key){
    try{
      key=clean(key||keyOf());
      const all=arr(window.G&&G.matches&&G.matches[key]).filter(m=>m&&isMainMatch(m)).map(m=>({...m,round:Number(m.round||0),slot:Number(m.slot||0)}));
      if(!all.length) return;
      const ordered=all.sort((a,b)=>Number(a.round||0)-Number(b.round||0)||Number(a.slot||0)-Number(b.slot||0));
      document.querySelectorAll('.main-tree-card .js-main-tree-scroll div[style*="position:absolute"][style*="width:168px"][style*="border"]').forEach((el,idx)=>{
        const m=ordered[idx]; if(!m) return;
        const th=venueTheme(clean(m.venue||m.__venue)||inferMatchVenueLabelForKey(key,m));
        el.style.borderColor=th.bd;
        el.style.borderLeftColor=th.bd;
        el.style.background=th.bg;
        if(!el.querySelector('.opq-tree-venue-badge')){
          const b=document.createElement('div');
          b.className='opq-tree-venue-badge';
          b.textContent=th.icon+' '+th.label;
          b.style.cssText='position:absolute;right:4px;top:4px;z-index:4;font-size:10px;font-weight:900;padding:2px 6px;border-radius:999px;background:'+th.head+';color:'+th.fg+';border:1px solid '+th.bd+';line-height:1.15;pointer-events:none;';
          el.appendChild(b);
        }
      });
    }catch(e){}
  }
  function installTreeVenueDecorator(){
    try{
      if(typeof window.renderBracket==='function' && !window.renderBracket.__opqTreeVenueWrapped){
        const old=window.renderBracket;
        const wrapped=function(){ const r=old.apply(this,arguments); setTimeout(()=>styleMainTreeVenueBadges(keyOf()),120); setTimeout(()=>styleMainTreeVenueBadges(keyOf()),600); return r; };
        wrapped.__opqTreeVenueWrapped=true; wrapped.__old=old; window.renderBracket=wrapped;
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
    getMainVenueModeForKey,
    setMainVenueModeForKey,
    installMainDrawVenueModeHooks,
    buildCleanMainMatches,
    installCleanMainDrawBuilder,
    styleMainTreeVenueBadges,
    installTreeVenueDecorator,
    debug(on){ window.__OPQ_DEBUG__=!!on; log('debug',!!on); }
  };
  window.OperationQueueV998=API;
  window.OperationQueueV997=API;
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
    window[name]=function(key){ try{ console.log('[v998] '+name+' skipped: main court assignment requires admin button'); }catch(e){} return false; };
  });

  installSharedVenueGuard();
  installMainDrawVenueModeHooks();
  installCleanMainDrawBuilder();
  installTreeVenueDecorator();
  setTimeout(installSharedVenueGuard,300);
  setTimeout(installMainDrawVenueModeHooks,300);
  setTimeout(installCleanMainDrawBuilder,300);
  setTimeout(installTreeVenueDecorator,300);
  setTimeout(installSharedVenueGuard,1200);
  setTimeout(installMainDrawVenueModeHooks,1200);
  setTimeout(installCleanMainDrawBuilder,1200);
  setTimeout(installTreeVenueDecorator,1200);
  try{ console.log('[v998] clean operation engine + clean main draw engine loaded'); }catch(e){}
})();
