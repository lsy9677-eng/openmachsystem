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


/* v994 prelim priority guard
   Rule: while a prelim/group match is still assigned to a court, main-draw/playin matches
   on that same court must not become the current/live card ahead of prelims. This is a
   display/queue-order guard only; it does not rewrite match data or manual placements.
*/
(function(){
  'use strict';
  if(window.__operationQueueV994PrelimPriorityInstalled) return;
  window.__operationQueueV994PrelimPriorityInstalled = true;
  const VERSION = 'v994-prelim-main-priority';

  function clean(v){ return String(v == null ? '' : v).trim(); }
  function arr(v){ return Array.isArray(v) ? v : []; }
  function phaseOf(m){ return clean(m && m.phase).toLowerCase(); }
  function isOpen(m){ return !!(m && m.winner == null); }
  function isPrelim(m){ const p = phaseOf(m); return p === 'group' || p === 'prelim'; }
  function isMain(m){ const p = phaseOf(m); return p === 'main' || p === 'playin'; }
  function orderToken(m){
    return clean(m && (m.courtQueueOrder || m.courtAssignedAt || m.manualCourtPinnedAt || m.waitingFirstAt || m.createdAt || ''));
  }
  function fallbackCompare(a,b){
    const aa = orderToken(a), bb = orderToken(b);
    if(aa !== bb) return aa.localeCompare(bb);
    const ga = Number(a && a.group != null ? a.group : 9999);
    const gb = Number(b && b.group != null ? b.group : 9999);
    if(ga !== gb) return ga - gb;
    const ra = Number(a && a.round || 0), rb = Number(b && b.round || 0);
    if(ra !== rb) return ra - rb;
    const sa = Number(a && a.slot || 0), sb = Number(b && b.slot || 0);
    if(sa !== sb) return sa - sb;
    return clean(a && a.id).localeCompare(clean(b && b.id),'ko');
  }
  function hasPrelimOnCourt(related){
    return arr(related).some(m => isOpen(m) && isPrelim(m));
  }
  function sortRelatedWithPrelimPriority(related){
    const list = arr(related).slice();
    const forcePrelimFirst = hasPrelimOnCourt(list);
    list.sort((a,b)=>{
      if(forcePrelimFirst){
        const ap = isPrelim(a) ? 0 : (isMain(a) ? 1 : 2);
        const bp = isPrelim(b) ? 0 : (isMain(b) ? 1 : 2);
        if(ap !== bp) return ap - bp;
      }
      return fallbackCompare(a,b);
    });
    return list;
  }
  function applySnapshotPrelimPriority(snapshot){
    return arr(snapshot).map(item=>{
      try{
        const related = sortRelatedWithPrelimPriority(item && item.related ? item.related : []);
        if(!related.length) return item;
        const current = related[0] || null;
        const waiting = related.slice(1);
        return Object.assign({}, item, {
          related,
          current,
          waiting,
          status: current ? 'live' : 'empty',
          __v994PrelimPriority: hasPrelimOnCourt(related)
        });
      }catch(e){ return item; }
    });
  }

  function installPrelimPriorityGuard(){
    try{
      if(typeof window.getCourtStatusSnapshot === 'function' && !window.getCourtStatusSnapshot.__v994PrelimPriority){
        const oldSnapshot = window.getCourtStatusSnapshot;
        const wrappedSnapshot = function(key){
          const result = oldSnapshot.apply(this, arguments);
          return applySnapshotPrelimPriority(result);
        };
        wrappedSnapshot.__v994PrelimPriority = true;
        wrappedSnapshot.__old = oldSnapshot;
        window.getCourtStatusSnapshot = wrappedSnapshot;
      }
    }catch(e){ try{ console.warn('[v994] getCourtStatusSnapshot wrap failed', e); }catch(_e){} }

    try{
      if(typeof window.renderCourtStatusBoard === 'function' && !window.renderCourtStatusBoard.__v994PrelimPriorityBadge){
        const oldRender = window.renderCourtStatusBoard;
        const wrappedRender = function(key, div){
          let html = oldRender.apply(this, arguments);
          try{
            if(typeof html === 'string'){
              // 안내 문구만 추가. 실제 로직은 snapshot guard가 처리한다.
              const marker = 'v994-prelim-priority-note';
              if(!html.includes(marker) && /코트 현황판|코트 사용 현황|court-drop-zone/.test(html)){
                const note = `<div class="${marker}" style="margin:0 0 10px;padding:9px 12px;border-radius:12px;background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;font-size:.76rem;font-weight:900;line-height:1.45">🛡️ 예선 진행 코트 보호: 같은 코트에 예선 경기가 남아 있으면 본선/진출전은 예선 뒤 대기로 표시됩니다.</div>`;
                html = note + html;
              }
            }
          }catch(e){}
          return html;
        };
        wrappedRender.__v994PrelimPriorityBadge = true;
        wrappedRender.__old = oldRender;
        window.renderCourtStatusBoard = wrappedRender;
      }
    }catch(e){ try{ console.warn('[v994] renderCourtStatusBoard wrap failed', e); }catch(_e){} }
  }

  window.OperationQueueV994 = Object.assign({}, window.OperationQueueV993 || {}, {
    version: VERSION,
    isPrelim,
    isMain,
    sortRelatedWithPrelimPriority,
    applySnapshotPrelimPriority,
    installPrelimPriorityGuard
  });
  installPrelimPriorityGuard();
  setTimeout(installPrelimPriorityGuard, 300);
  setTimeout(installPrelimPriorityGuard, 1200);
  try{ console.log('[v994] prelim priority guard loaded'); }catch(e){}
})();


/* v995 venue-aware shared queue + stronger prelim priority guard
   Fixes:
   1) Shared waiting items are split by the actual venue of their source prelim group/team,
      not by the first active venue.
   2) A main/playin match must never be displayed as the current/live card while any unfinished
      prelim/group match is still assigned/waiting on that same court.
*/
(function(){
  'use strict';
  if(window.__operationQueueV995VenuePrelimFixInstalled) return;
  window.__operationQueueV995VenuePrelimFixInstalled = true;
  const VERSION = 'v995-venue-source-prelim-priority';

  function clean(v){ return String(v == null ? '' : v).trim(); }
  function arr(v){ return Array.isArray(v) ? v : []; }
  function keySafe(){
    try{ if(window.OperationQueueV993 && typeof OperationQueueV993.keyOf==='function') return OperationQueueV993.keyOf(); }catch(e){}
    try{ if(typeof currentTid==='function' && typeof currentDiv==='function' && typeof kd==='function') return kd(currentTid(), currentDiv()); }catch(e){}
    return '';
  }
  function venueOfCourt(court){
    try{ if(window.OperationQueueV993 && typeof OperationQueueV993.venueOfCourt==='function') return OperationQueueV993.venueOfCourt(court); }catch(e){}
    const c=clean(court);
    if(/원도심|원도|인조/.test(c)) return '원도심';
    if(/국제|장유국제/.test(c)) return '국제';
    if(/능동/.test(c)) return '능동';
    if(/장유중|클레이/.test(c)) return '장유중';
    if(/금병/.test(c)) return '금병';
    if(/삼계/.test(c)) return '삼계';
    if(/동부/.test(c)) return '동부';
    return c ? '기타' : '';
  }
  function activeVenueLabels(key){
    try{
      if(window.OperationQueueV993 && typeof OperationQueueV993.getActiveVenueLabelsForKey==='function'){
        const info=OperationQueueV993.getActiveVenueLabelsForKey(key)||{};
        return arr(info.labels).map(clean).filter(Boolean);
      }
    }catch(e){}
    return [];
  }
  function drawGroups(key){
    try{ return arr(window.G && G.draws && G.draws[key] && G.draws[key].groups); }catch(e){ return []; }
  }
  function matchesForKey(key){
    try{ return arr(window.G && G.matches && G.matches[key]); }catch(e){ return []; }
  }
  function courtFromObj(o){
    if(!o) return '';
    const vals=[];
    ['manualCourtTarget','court','manualCourt','assignedCourt','courtName','currentCourt','__sharedCourtLabel'].forEach(k=>{ if(clean(o[k])) vals.push(clean(o[k])); });
    arr(o.courts).forEach(c=>{ if(clean(c)) vals.push(clean(c)); });
    return vals.find(Boolean) || '';
  }
  function groupVenue(key, gi){
    gi=Number(gi);
    if(!Number.isFinite(gi)) return '';
    const groups=drawGroups(key);
    const candidates=[];
    [gi, gi-1].forEach(idx=>{
      if(idx>=0 && idx<groups.length){
        const c=courtFromObj(groups[idx]);
        const v=venueOfCourt(c); if(v) candidates.push(v);
      }
    });
    matchesForKey(key).forEach(m=>{
      if(!m) return;
      const p=clean(m.phase).toLowerCase();
      if(!(p==='group'||p==='prelim'||p==='preliminary'||p==='qual'||p==='qualifying')) return;
      const mg=Number(m.group);
      if(mg===gi || mg===gi-1){ const v=venueOfCourt(courtFromObj(m)); if(v) candidates.push(v); }
    });
    return candidates[0] || '';
  }
  function groupOfTeam(key, teamIndex){
    const ti=Number(teamIndex);
    if(!Number.isFinite(ti)) return null;
    const groups=drawGroups(key);
    for(let gi=0; gi<groups.length; gi++){
      const teams=arr(groups[gi] && groups[gi].teams).map(x=>Number(x));
      if(teams.some(x=>x===ti)) return gi;
    }
    return null;
  }
  function sourceGroupCandidates(key, m){
    const out=[];
    ['sourceGroup1','sourceGroup2','sourceGroup','group'].forEach(k=>{
      if(m && m[k] !== undefined && m[k] !== null && m[k] !== '') out.push(Number(m[k]));
    });
    ['t1','t2','winner'].forEach(k=>{
      const gi=groupOfTeam(key, m && m[k]);
      if(gi !== null) out.push(gi);
    });
    return [...new Set(out.filter(x=>Number.isFinite(x)))];
  }
  function mostFrequentVenue(vs){
    const counts={};
    vs.map(clean).filter(Boolean).forEach(v=>counts[v]=(counts[v]||0)+1);
    let best=''; let bestN=0;
    Object.keys(counts).forEach(v=>{ if(counts[v]>bestN){ best=v; bestN=counts[v]; } });
    return best;
  }
  function sourceVenueForMatch(key, m){
    const labels=activeVenueLabels(key);
    const target=clean(m && (m.__sharedCourtLabel || m.manualCourtTarget || m.court || m.currentCourt));
    const byTarget=venueOfCourt(target);
    if(byTarget && (!labels.length || labels.includes(byTarget))) return byTarget;

    const raw=clean(m && (m.venue || m.__venue || m.mainBlock));
    const rawMap={wondosim:'원도심',gukje:'국제',neungdong:'능동',jangyu_jung:'장유중',geumbyeong:'금병',samgye:'삼계',dongbu:'동부'};
    const rawLabel=rawMap[raw] || raw;
    // If raw is a precise active venue, keep it. If raw is old generic 'gukje' while multiple
    // non-wondo venues are active, prefer the source prelim group below.
    const rawIsOldGeneric = raw === 'gukje' && labels.length > 1 && labels.some(v=>v!=='국제' && v!=='원도심');

    const groupVenues=sourceGroupCandidates(key,m).map(gi=>groupVenue(key,gi)).filter(Boolean).filter(v=>!labels.length || labels.includes(v));
    if(groupVenues.length){
      const chosen=mostFrequentVenue(groupVenues) || groupVenues[0];
      if(chosen) return chosen;
    }
    if(rawLabel && labels.includes(rawLabel) && !rawIsOldGeneric) return rawLabel;
    if(labels.length===1) return labels[0];
    return (rawLabel && labels.includes(rawLabel)) ? rawLabel : (labels[0] || byTarget || '국제');
  }
  function normalizeVenueForShared(key,m){
    try{
      if(!m) return m;
      const label=sourceVenueForMatch(key,m);
      if(label){
        m.venue=label;
        m.__venue=label;
        // Do not invent a concrete court here; only classify the shared waiting bucket.
      }
    }catch(e){}
    return m;
  }

  function winnerSet(m){ return m && m.winner !== undefined && m.winner !== null && clean(m.winner) !== ''; }
  function isUnfinished(m){ return !!m && !winnerSet(m); }
  function phase(m){ return clean(m && m.phase).toLowerCase(); }
  function isMainV995(m){
    const p=phase(m);
    const id=clean(m && m.id);
    if(p==='main'||p==='playin'||p==='final'||p==='draw') return true;
    if(/^main[_-]/i.test(id)) return true;
    if(m && (m.bracketN || m.localRoundSize || m.fixedLeafStart || m.fixedLeaf1)) return true;
    return false;
  }
  function isPrelimV995(m){
    const p=phase(m);
    const id=clean(m && m.id);
    if(p==='group'||p==='prelim'||p==='preliminary'||p==='qual'||p==='qualifying') return true;
    if(/^g[_-]/i.test(id)) return true;
    if(m && m.group !== undefined && m.group !== null && !isMainV995(m)) return true;
    return false;
  }
  function orderToken(m){
    return clean(m && (m.courtQueueOrder || m.courtAssignedAt || m.manualCourtPinnedAt || m.waitingFirstAt || m.createdAt || m.id || ''));
  }
  function cmpOrder(a,b){
    const aa=orderToken(a), bb=orderToken(b);
    if(aa!==bb) return aa.localeCompare(bb);
    const ga=Number(a && a.group!=null?a.group:9999), gb=Number(b && b.group!=null?b.group:9999);
    if(ga!==gb) return ga-gb;
    const ra=Number(a&&a.round||0), rb=Number(b&&b.round||0);
    if(ra!==rb) return ra-rb;
    const sa=Number(a&&a.slot||0), sb=Number(b&&b.slot||0);
    if(sa!==sb) return sa-sb;
    return clean(a&&a.id).localeCompare(clean(b&&b.id),'ko');
  }
  function sortCourtRelatedV995(list){
    const related=arr(list).filter(Boolean).slice();
    const hasPrelim=related.some(m=>isUnfinished(m) && isPrelimV995(m));
    related.sort((a,b)=>{
      if(hasPrelim){
        const ap=isPrelimV995(a)?0:(isMainV995(a)?1:2);
        const bp=isPrelimV995(b)?0:(isMainV995(b)?1:2);
        if(ap!==bp) return ap-bp;
      }
      return cmpOrder(a,b);
    });
    return related;
  }
  function applySnapshotGuardV995(snapshot){
    return arr(snapshot).map(item=>{
      try{
        const base=(arr(item && item.related).length ? arr(item.related) : [item && item.current].concat(arr(item && item.waiting))).filter(Boolean);
        const related=sortCourtRelatedV995(base);
        const current=related[0] || null;
        return Object.assign({}, item, {
          related,
          current,
          waiting: related.slice(1),
          status: current ? 'live' : 'empty',
          __v995PrelimPriority: related.some(m=>isPrelimV995(m))
        });
      }catch(e){ return item; }
    });
  }
  function installV995(){
    try{
      if(window.OperationQueueV993){
        OperationQueueV993.inferMatchVenueLabelForKey=function(key,m){ return sourceVenueForMatch(key,m); };
        OperationQueueV993.normalizeSharedMatchVenueLabelForActiveCourts=function(key,m){ return normalizeVenueForShared(key,m); };
        OperationQueueV993.sourceVenueForMatch=sourceVenueForMatch;
        OperationQueueV993.groupVenue=groupVenue;
      }
    }catch(e){}
    try{
      if(typeof window.getCourtBoardSharedOverflowItems==='function' && !window.getCourtBoardSharedOverflowItems.__v995VenueSource){
        const old=window.getCourtBoardSharedOverflowItems;
        const wrapped=function(key){
          const list=old.apply(this, arguments) || [];
          try{ list.forEach(x=>normalizeVenueForShared(key,x)); }catch(e){}
          return list;
        };
        wrapped.__v995VenueSource=true;
        wrapped.__old=old;
        window.getCourtBoardSharedOverflowItems=wrapped;
      }
    }catch(e){}
    try{
      if(typeof window.getCourtStatusSnapshot==='function' && !window.getCourtStatusSnapshot.__v995PrelimPriority){
        const old=window.getCourtStatusSnapshot;
        const wrapped=function(key){ return applySnapshotGuardV995(old.apply(this, arguments)); };
        wrapped.__v995PrelimPriority=true;
        wrapped.__old=old;
        window.getCourtStatusSnapshot=wrapped;
        try{ getCourtStatusSnapshot=wrapped; }catch(e){}
      }
    }catch(e){}
    try{
      if(typeof window.renderCourtStatusBoard==='function' && !window.renderCourtStatusBoard.__v995Note){
        const old=window.renderCourtStatusBoard;
        const wrapped=function(key,div){
          let html=old.apply(this, arguments);
          try{
            if(typeof html==='string' && !html.includes('v995-queue-note')){
              html=html.replace('v994-prelim-priority-note', 'v994-prelim-priority-note v995-queue-note');
            }
          }catch(e){}
          return html;
        };
        wrapped.__v995Note=true;
        wrapped.__old=old;
        window.renderCourtStatusBoard=wrapped;
      }
    }catch(e){}
  }

  window.OperationQueueV995={
    version:VERSION,
    sourceVenueForMatch,
    groupVenue,
    isPrelim:isPrelimV995,
    isMain:isMainV995,
    sortCourtRelated:sortCourtRelatedV995,
    applySnapshotGuard:applySnapshotGuardV995,
    install:installV995
  };
  installV995();
  [0,150,500,1200,2600,5000].forEach(t=>setTimeout(installV995,t));
  try{ console.log('[v995] venue source + prelim priority guard loaded'); }catch(e){}
})();
