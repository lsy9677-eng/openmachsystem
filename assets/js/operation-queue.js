/* v991 operation queue split foundation
   Purpose: centralize court/main-draw queue helpers before changing logic.
   This version intentionally does not override existing assignment behavior.
*/
(function(){
  'use strict';
  if(window.__operationQueueV991Installed) return;
  window.__operationQueueV991Installed = true;
  const VERSION = 'v991-operation-queue-split-foundation';

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

  window.OperationQueueV991 = {
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

  try{ console.log('[v991] operation queue split foundation loaded'); }catch(e){}
})();
