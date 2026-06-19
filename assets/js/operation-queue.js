/* v993 operation queue split foundation
   Purpose: centralize court/main-draw queue helpers before changing logic.
   This version intentionally does not override existing assignment behavior.
*/
(function(){
  'use strict';
  if(window.__operationQueueV993Installed) return;
  window.__operationQueueV993Installed = true;
  const VERSION = 'v993-general-venue-split';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function lower(v){ return clean(v).toLowerCase(); }
  function log(){ try{ if(window.__OPQ_DEBUG__) console.log.apply(console, ['[operation-queue]', ...arguments]); }catch(e){} }

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
    tid = clean(tid || currentTidSafe());
    div = clean(div || currentDivSafe());
    try{
      if(typeof kd === 'function' && tid && div) return kd(tid, div);
      if(typeof keyOfDivision === 'function' && tid && div) return keyOfDivision(tid, div);
    }catch(e){}
    return tid && div ? (tid + '_' + div) : '';
  }

  function getTournament(tid){
    tid = clean(tid || currentTidSafe());
    try{
      return arr(window.G && G.tournaments).find(t => clean(t.id) === tid) || null;
    }catch(e){ return null; }
  }

  function getDivisionConfig(tid, div){
    const t = getTournament(tid);
    div = clean(div || currentDivSafe());
    if(!t || !div) return null;
    try{
      const d = t.divisions;
      if(Array.isArray(d)){
        return d.find(x => clean(x && (x.name || x.division || x.title)) === div) || null;
      }
      if(d && typeof d === 'object') return d[div] || null;
    }catch(e){}
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

  function getPrelimCourts(tid, div){
    const cfg = getDivisionConfig(tid, div) || {};
    const courts = normalizeCourtList(cfg.courts || cfg.allowedCourts || cfg.prelimCourts || []);
    if(courts.length) return courts;
    try{
      const key = keyOf(tid, div);
      const ms = arr(window.G && G.matches && G.matches[key]);
      return normalizeCourtList(ms.flatMap(m => [m.court, m.courts, m.manualCourtTarget, m.currentCourt]));
    }catch(e){ return []; }
  }

  function getMainCourts(tid, div){
    const cfg = getDivisionConfig(tid, div) || {};
    return normalizeCourtList(cfg.mainCourts || cfg.mainAllowedCourts || cfg.allowedMainCourts || cfg.courts || cfg.allowedCourts || []);
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
    const groups = {};
    normalizeCourtList(courts).forEach(c=>{
      const v = venueOfCourt(c) || '기타';
      if(!groups[v]) groups[v] = [];
      groups[v].push(c);
    });
    return groups;
  }

  function getOperationSnapshot(tid, div){
    const key = keyOf(tid, div);
    const prelimCourts = getPrelimCourts(tid, div);
    const mainCourts = getMainCourts(tid, div);
    const mainVenueGroups = getActiveVenueGroups(mainCourts.length ? mainCourts : prelimCourts);
    let matches=[];
    try{ matches = arr(window.G && G.matches && G.matches[key]); }catch(e){}
    const live = matches.filter(m => !m.winner && clean(m.court));
    const waiting = matches.filter(m => !m.winner && (clean(m.manualCourtTarget) || arr(m.courts).length) && !clean(m.court));
    const main = matches.filter(m => /^(main|playin)$/i.test(clean(m.phase)) && !m.winner);
    const prelim = matches.filter(m => /^(group|prelim)$/i.test(clean(m.phase)) && !m.winner);
    return {version:VERSION, key, tid:clean(tid||currentTidSafe()), division:clean(div||currentDivSafe()), prelimCourts, mainCourts, mainVenueGroups, counts:{matches:matches.length, live:live.length, waiting:waiting.length, prelim:prelim.length, main:main.length}};
  }

  function shouldUseVenueSplit(courts){
    const groups = getActiveVenueGroups(courts);
    return Object.keys(groups).filter(k => arr(groups[k]).length > 0).length > 1;
  }

  window.OperationQueueV993 = {
    version: VERSION,
    currentTid: currentTidSafe,
    currentDiv: currentDivSafe,
    keyOf,
    getTournament,
    getDivisionConfig,
    normalizeCourtList,
    getPrelimCourts,
    getMainCourts,
    venueOfCourt,
    getActiveVenueGroups,
    shouldUseVenueSplit,
    getOperationSnapshot,
    debug(on){ window.__OPQ_DEBUG__ = !!on; log('debug', !!on, getOperationSnapshot()); }
  };



  function courtVenueCode(court){
    const v = venueOfCourt(court);
    return v === '원도심' ? 'wondosim' : 'gukje';
  }

  function getBoardCourtsForKey(key){
    try{
      let out=[];
      if(typeof getCourtBoardConfiguredCourtsV505 === 'function'){
        const cfg = getCourtBoardConfiguredCourtsV505(key) || {};
        if(cfg.explicit && Array.isArray(cfg.list) && cfg.list.length) out = cfg.list.map(String).filter(Boolean);
      }
      if(!out.length && typeof getSelectedCourtFilters === 'function') out = getSelectedCourtFilters(key) || [];
      if(!out.length && typeof getUsedCourtsForKey === 'function') out = getUsedCourtsForKey(key) || [];
      if(!out.length && typeof getIndividualAutoAssignmentPlan === 'function'){
        const plan = getIndividualAutoAssignmentPlan(key) || {};
        out = plan.pool || [];
      }
      return normalizeCourtList(out);
    }catch(e){ return []; }
  }

  function getActiveVenueCodesForKey(key){
    const courts = getBoardCourtsForKey(key);
    const codes = [...new Set(courts.map(courtVenueCode).filter(Boolean))];
    return {courts, codes, hasWondo:codes.includes('wondosim'), hasNonWondo:codes.includes('gukje')};
  }



  function venueCodeOfCourt(court){
    const v = venueOfCourt(court);
    if(v === '원도심') return 'wondosim';
    if(v === '국제') return 'gukje';
    if(v === '능동') return 'neungdong';
    if(v === '장유중') return 'jangyu_jung';
    if(v === '금병') return 'geumbyeong';
    if(v === '삼계') return 'samgye';
    if(v === '동부') return 'dongbu';
    return v ? ('venue_' + v) : '';
  }

  function getActiveVenueLabelsForKey(key){
    const courts = getBoardCourtsForKey(key);
    const groups = getActiveVenueGroups(courts);
    const labels = Object.keys(groups).filter(k => arr(groups[k]).length > 0);
    return {courts, groups, labels, split: labels.length > 1};
  }

  function inferMatchVenueLabelForKey(key, m){
    try{
      const info = getActiveVenueLabelsForKey(key);
      const labels = info.labels || [];
      const rawVenue = clean(m && (m.venue || m.__venue));
      if(rawVenue){
        if(rawVenue === 'wondosim') return labels.includes('원도심') ? '원도심' : (labels[0] || '원도심');
        if(rawVenue === 'gukje'){
          const target = clean(m && (m.__sharedCourtLabel || m.manualCourtTarget || m.court || m.currentCourt));
          const byTarget = venueOfCourt(target);
          if(byTarget && labels.includes(byTarget)) return byTarget;
          if(labels.includes('국제')) return '국제';
          return labels[0] || '국제';
        }
        if(labels.includes(rawVenue)) return rawVenue;
      }
      const target = clean(m && (m.__sharedCourtLabel || m.manualCourtTarget || m.court || m.currentCourt));
      const byTarget = venueOfCourt(target);
      if(byTarget && labels.includes(byTarget)) return byTarget;
      if(labels.length === 1) return labels[0];
      return labels[0] || byTarget || '국제';
    }catch(e){ return '국제'; }
  }

  function normalizeSharedMatchVenueLabelForActiveCourts(key, m){
    try{
      if(!m) return m;
      const label = inferMatchVenueLabelForKey(key, m);
      if(label){
        m.venue = label;
        m.__venue = label;
      }
    }catch(e){}
    return m;
  }

  function normalizeSharedMatchVenueForActiveCourts(key, m){
    try{
      const info = getActiveVenueCodesForKey(key);
      if(!m || !info.codes.length) return m;
      // 원도심 코트를 쓰지 않는 대회에서는 과거 원도심 분리 로직이 남아 있어도
      // 공용대기 항목을 비원도심(국제 버킷)으로 고정한다.
      if(!info.hasWondo && info.hasNonWondo){
        m.venue = 'gukje';
        m.__venue = 'gukje';
        const label = clean(m.__sharedCourtLabel || m.manualCourtTarget || '');
        if(label && /원도심|원도|인조/.test(label)){
          const first = info.courts.find(c => courtVenueCode(c)==='gukje') || info.courts[0] || '';
          m.__sharedCourtLabel = first;
        }
      }
      // 원도심만 쓰는 예외 대회에서는 반대로 원도심 버킷으로 고정한다.
      if(info.hasWondo && !info.hasNonWondo){
        m.venue = 'wondosim';
        m.__venue = 'wondosim';
        const label = clean(m.__sharedCourtLabel || m.manualCourtTarget || '');
        if(label && !/원도심|원도|인조/.test(label)){
          const first = info.courts.find(c => courtVenueCode(c)==='wondosim') || info.courts[0] || '';
          m.__sharedCourtLabel = first;
        }
      }
    }catch(e){}
    return m;
  }

  function installSharedVenueGuard(){
    try{
      if(!document.getElementById('v992SharedVenueGuardStyle')){
        const st=document.createElement('style');
        st.id='v992SharedVenueGuardStyle';
        st.textContent = `
          .v826-shared-venue-split.v992-no-wondo > div:nth-child(2){display:none!important;}
          .v826-shared-venue-split.v992-no-nonwondo > div:nth-child(1){display:none!important;}
          .court-drop-zone.v992-single-venue .court-drop-hint{font-size:.72rem;}
        `;
        document.head.appendChild(st);
      }
    }catch(e){}

    try{
      if(typeof window.getCourtBoardSharedOverflowItems === 'function' && !window.getCourtBoardSharedOverflowItems.__v992VenueGuard){
        const oldShared = window.getCourtBoardSharedOverflowItems;
        const wrappedShared = function(key, items, selectedCourts, usedCourts){
          const list = oldShared.apply(this, arguments) || [];
          try{ list.forEach(m => { normalizeSharedMatchVenueForActiveCourts(key, m); normalizeSharedMatchVenueLabelForActiveCourts(key, m); }); }catch(e){}
          return list;
        };
        wrappedShared.__v992VenueGuard = true;
        wrappedShared.__old = oldShared;
        window.getCourtBoardSharedOverflowItems = wrappedShared;
      }
    }catch(e){}

    try{
      if(typeof window.v771InferMatchVenue === 'function' && !window.v771InferMatchVenue.__v992VenueGuard){
        const oldInfer = window.v771InferMatchVenue;
        const wrappedInfer = function(key, m){
          const info = getActiveVenueCodesForKey(key);
          if(info.codes.length){
            if(!info.hasWondo && info.hasNonWondo) return 'gukje';
            if(info.hasWondo && !info.hasNonWondo) return 'wondosim';
          }
          return oldInfer.apply(this, arguments);
        };
        wrappedInfer.__v992VenueGuard = true;
        wrappedInfer.__old = oldInfer;
        window.v771InferMatchVenue = wrappedInfer;
      }
    }catch(e){}

    try{
      if(typeof window.renderCourtStatusBoard === 'function' && !window.renderCourtStatusBoard.__v992VenueGuard){
        const oldRender = window.renderCourtStatusBoard;
        const wrappedRender = function(key, div){
          let html = oldRender.apply(this, arguments);
          try{
            const info = getActiveVenueCodesForKey(key);
            if(info.codes.length && typeof html === 'string' && html.includes('v826-shared-venue-split')){
              let extraClass = '';
              if(!info.hasWondo) extraClass += ' v992-no-wondo';
              if(!info.hasNonWondo) extraClass += ' v992-no-nonwondo';
              if(info.codes.length === 1) extraClass += ' v992-single-venue';
              if(extraClass){
                html = html.replace('class="v826-shared-venue-split"', 'class="v826-shared-venue-split'+extraClass+'"');
                html = html.replace('class="court-drop-zone"', 'class="court-drop-zone'+(info.codes.length===1?' v992-single-venue':'')+'"');
              }
              if(info.codes.length === 1){
                const title = info.hasWondo ? '⏳ 원도심 공용대기' : '⏳ 공용대기';
                html = html.replace(/⏳\s*구장별\s*공용대기/g, title);
                html = html.replace('각 구장별 위 카드가 우선순위 1번', '위 카드가 우선순위 1번');
              }
            }
          }catch(e){}
          return html;
        };
        wrappedRender.__v992VenueGuard = true;
        wrappedRender.__old = oldRender;
        window.renderCourtStatusBoard = wrappedRender;
      }
    }catch(e){}
  }

  window.OperationQueueV993 = window.OperationQueueV993 || {};
  Object.assign(window.OperationQueueV993, {
    getBoardCourtsForKey,
    getActiveVenueCodesForKey,
    normalizeSharedMatchVenueForActiveCourts,
    getActiveVenueLabelsForKey,
    inferMatchVenueLabelForKey,
    normalizeSharedMatchVenueLabelForActiveCourts,
    installSharedVenueGuard
  });

  installSharedVenueGuard();
  setTimeout(installSharedVenueGuard, 300);
  setTimeout(installSharedVenueGuard, 1200);

  try{ console.log('[v993] general venue split guard loaded'); }catch(e){}
})();
