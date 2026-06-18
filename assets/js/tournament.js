/*
 * v990 tournament.js split
 * Scope: tournament/home 안내 보조 스크립트, 대회 요강/상세 보기 보조, 대회명/부서명 표시 정리.
 * 기능 변경 없이 기존 인라인 패치 일부를 외부 파일로 분리.
 */
(function(){ try{ window.__V990_TOURNAMENT_JS_SPLIT__ = true; }catch(e){} })();

/* ===== extracted from v287CleanMatchTitleNoDivisionScript ===== */
(function(){
  const DIVISION_NOISE_RE = /영남권\s*지역신인부|[가-힣A-Za-z0-9\s·ㆍ-]*(?:신인부|지역신인부|오픈부|금배부|은배부|동배부|테린이부|개인전|단체전)/g;
  function cleanDivisionNoiseText(s){
    return String(s||'').replace(DIVISION_NOISE_RE,'').replace(/\s+/g,' ').trim();
  }
  function cleanM3AndMatchPopupNoise(){
    try{
      const title=document.getElementById('mM3T');
      if(title){
        title.textContent=cleanDivisionNoiseText(title.textContent)
          .replace(/^⚡\s*·\s*/,'⚡ ')
          .replace(/^📝\s*·\s*/,'📝 ')
          .replace(/\s+vs\s+/i,' vs ')
          .trim();
      }
      document.querySelectorAll('#mM3 .m3badge, #matchListPopup .mlp-chip').forEach(el=>{
        const before=(el.textContent||'').trim();
        const after=cleanDivisionNoiseText(before);
        if(before && !after && /신인부|금배부|은배부|동배부|테린이부|오픈부|개인전|단체전/.test(before)){
          el.style.display='none';
        }else if(after && after!==before){
          el.textContent=after;
        }
      });
      document.querySelectorAll('#matchListPopup .mlp-team').forEach(el=>{
        const after=cleanDivisionNoiseText(el.textContent);
        if(after && after!==el.textContent.trim()) el.textContent=after;
      });
      const popTitle=document.getElementById('matchListPopupTitle');
      if(popTitle){
        const cleaned=cleanDivisionNoiseText(popTitle.textContent).replace(/\s+/g,' ').trim();
        if(cleaned) popTitle.textContent=cleaned;
      }
    }catch(e){}
  }
  window.cleanM3AndMatchPopupNoise=cleanM3AndMatchPopupNoise;
  document.addEventListener('DOMContentLoaded',()=>{ setTimeout(cleanM3AndMatchPopupNoise,0); });
})();


/* ===== extracted from v729GuideVisibleForAllTournaments ===== */
(function(){
  'use strict';
  function getSelectedRegisterTournamentId(){
    try{
      const el=document.getElementById('regTS');
      return el && el.value ? String(el.value) : '';
    }catch(e){ return ''; }
  }
  window.openSelectedRegisterGuide=function(){
    const tid=getSelectedRegisterTournamentId();
    if(!tid){
      if(typeof toast==='function') toast('먼저 대회를 선택해 주세요','info');
      else alert('먼저 대회를 선택해 주세요');
      return;
    }
    if(typeof openGuide==='function') openGuide(tid);
    else if(typeof toast==='function') toast('요강 보기 기능을 불러오지 못했습니다','error');
  };
  window.openSelectedRegisterDetail=function(){
    const tid=getSelectedRegisterTournamentId();
    if(!tid){
      if(typeof toast==='function') toast('먼저 대회를 선택해 주세요','info');
      else alert('먼저 대회를 선택해 주세요');
      return;
    }
    if(typeof openTD==='function') openTD(tid);
    else if(typeof openGuide==='function') openGuide(tid);
  };
  // 홈 현재 대회 목록이 여러 개일 때, 각 대회별 요강 버튼을 안정적으로 유지
  window.v729OpenGuideByTournament=function(tid){
    if(!tid) return;
    if(typeof openGuide==='function') openGuide(tid);
  };
})();


/* ===== extracted from v732HomeTournamentButtonsCompactScript ===== */
(function(){
  'use strict';
  if(window.__v732HomeTournamentButtonsCompactInstalled) return;
  window.__v732HomeTournamentButtonsCompactInstalled=true;
  function compactHomeTournamentButtons(){
    try{
      document.querySelectorAll('.home-current-tournament-row').forEach(row=>{
        const actions=row.lastElementChild;
        if(!actions) return;
        actions.querySelectorAll('button.home-panel-badge').forEach(btn=>{
          const t=(btn.textContent||'').trim();
          if(/요강/.test(t)) btn.textContent='📌 요강';
          else if(/신청/.test(t)) btn.textContent='📝 신청';
        });
      });
    }catch(e){}
  }
  const oldRenderHome=window.renderHome;
  if(typeof oldRenderHome==='function' && !oldRenderHome.__v732CompactButtons){
    const wrapped=function(){
      const r=oldRenderHome.apply(this, arguments);
      setTimeout(compactHomeTournamentButtons,0);
      setTimeout(compactHomeTournamentButtons,120);
      return r;
    };
    wrapped.__v732CompactButtons=true;
    window.renderHome=wrapped;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(compactHomeTournamentButtons,300);
    setTimeout(compactHomeTournamentButtons,1200);
  });
  console.log('[v732] home tournament guide/apply buttons compact layout installed');
})();

try{ console.info('[v990] tournament.js loaded'); }catch(e){}
