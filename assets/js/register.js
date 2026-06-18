/*
 * v989 register/player-registry helper split
 * Extracted from the former inline helper patch scripts without logic changes.
 * Scope: participant registration helper UI, player registry/player record admin helper patches.
 */
(function(){
  try{ window.__V989_REGISTER_JS_SPLIT__ = true; }catch(e){}
})();

/* ===== extracted from v352RegistryBackupFixScript ===== */
(function(){
  'use strict';
  if(window.__v352RegistryBackupFix) return;
  window.__v352RegistryBackupFix = true;

  function $(id){ return document.getElementById(id); }
  function isManager(){ return document.body.classList.contains('admin-mode') || document.body.classList.contains('tm-mode') || !!window.AD || !!window.TM; }

  window.openBackupModalStable = function(){
    try{
      if(!isManager()){
        if(typeof window.toast==='function') window.toast('관리자 권한이 필요합니다','info');
        return;
      }
      if(typeof window.cm==='function') window.cm('mAdminSettings');
      setTimeout(function(){
        var m=$('mBackup');
        if(!m){ if(typeof window.toast==='function') window.toast('백업/복구 창을 찾을 수 없습니다','error'); return; }
        m.classList.add('open');
        m.style.display='flex';
        m.style.visibility='visible';
        m.style.opacity='1';
        var st=$('backupStatus');
        if(st && !st.textContent.trim()) st.textContent='백업 또는 복구를 선택하세요.';
      },60);
    }catch(e){
      console.error('openBackupModalStable failed', e);
      if(typeof window.toast==='function') window.toast('백업/복구 창 열기 실패','error');
    }
  };

  function wireBackupButtons(){
    try{
      document.querySelectorAll('button').forEach(function(btn){
        var oc=String(btn.getAttribute('onclick')||'');
        var tx=(btn.textContent||'').replace(/\s+/g,' ');
        if(/mBackup/.test(oc) && /백업|복구/.test(tx)){
          btn.setAttribute('onclick','openBackupModalStable()');
          btn.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); window.openBackupModalStable(); return false; };
          btn.style.display='';
        }
      });
    }catch(e){ console.warn('wireBackupButtons failed', e); }
  }

  function forceManagerRegistryVisibility(){
    try{
      if(!isManager()) return;
      var regBtn=$('ptab-registry');
      var recBtn=$('ptab-records');
      var reg=$('ptab-registry-content');
      var rec=$('ptab-records-content');
      if(regBtn) regBtn.style.display='';
      if(document.querySelector('#ptab-registry.active')){
        if(reg) reg.style.display='';
        if(rec) rec.style.display='none';
      }
      if(recBtn && recBtn.classList.contains('active')){
        if(rec) rec.style.display='';
        if(reg) reg.style.display='none';
      }
    }catch(e){}
  }

  const oldSwitch = window.switchPlayersTab;
  window.switchPlayersTab = function(tab){
    var r;
    try{ if(typeof oldSwitch==='function') r=oldSwitch.apply(this, arguments); }catch(e){ console.warn('old switchPlayersTab failed', e); }
    try{
      if(tab==='registry' && isManager()){
        var recBtn=$('ptab-records'), regBtn=$('ptab-registry');
        var rec=$('ptab-records-content'), reg=$('ptab-registry-content');
        if(recBtn) recBtn.classList.remove('active');
        if(regBtn){ regBtn.style.display=''; regBtn.classList.add('active'); }
        if(rec) rec.style.display='none';
        if(reg) reg.style.display='';
        if(typeof window.renderRegistryTab==='function') window.renderRegistryTab(true).catch(function(err){ console.error(err); if(typeof window.toast==='function') window.toast('참가자 목록 로딩 실패: '+(err.message||err),'error'); });
      }
    }catch(e){ console.error('switch registry fix failed', e); }
    return r;
  };

  // 백업 함수가 모달 안에서 확실히 동작하도록 보조. 기존 함수가 있으면 우선 사용하고, 실패 시 window.G로 직접 백업.
  const oldBackup = window.backupJSON;
  window.backupJSON = function(){
    try{
      if(typeof oldBackup==='function') return oldBackup.apply(this, arguments);
    }catch(e){ console.warn('original backupJSON failed, fallback used', e); }
    try{
      var G=window.G||{};
      var data={
        version:3,
        exportDate:new Date().toISOString(),
        meta:G.meta||{},
        tournaments:G.tournaments||[],
        teams:G.teams||{},
        draws:G.draws||{},
        matches:G.matches||{},
        players:G.players||{},
        clubs:G.clubs||[],
        log:G.log||[],
        drawHistories:G.drawHistories||{},
        registry:window.G_REGISTRY||{}
      };
      var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
      var a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='230MATCH_백업_'+new Date().toISOString().slice(0,10)+'.json';
      document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href); a.remove();},300);
      var st=$('backupStatus'); if(st) st.textContent='✅ 백업 파일 다운로드 완료';
      if(typeof window.toast==='function') window.toast('백업 완료 💾','success');
    }catch(e){ console.error(e); if(typeof window.toast==='function') window.toast('백업 실패: '+(e.message||e),'error'); }
  };

  const oldRestore = window.restoreFromJSON;
  window.restoreFromJSON = async function(input){
    try{
      if(typeof oldRestore==='function') return await oldRestore.apply(this, arguments);
    }catch(e){ console.error('restoreFromJSON failed', e); if(typeof window.toast==='function') window.toast('복구 실패: '+(e.message||e),'error'); }
  };

  function apply(){ wireBackupButtons(); forceManagerRegistryVisibility(); }
  document.addEventListener('DOMContentLoaded', function(){ apply(); setTimeout(apply,300); setTimeout(apply,1000); });
  setTimeout(apply,1500);
})();


/* ===== extracted from v354PlayersTabsRealFixScript ===== */
(function(){
  'use strict';
  if(window.__v354PlayersTabsRealFix) return;
  window.__v354PlayersTabsRealFix = true;

  var lockedTab = null;
  var lockUntil = 0;
  function $(id){ return document.getElementById(id); }
  function isManager(){ return document.body.classList.contains('admin-mode') || document.body.classList.contains('tm-mode') || !!window.AD || !!window.TM; }
  function inRecordsClickEvent(){
    try{ var ev=window.event; return !!(ev && ev.target && ev.target.closest && ev.target.closest('#ptab-records')); }catch(e){ return false; }
  }
  function setPlayersTabDom(tab){
    tab = tab === 'registry' ? 'registry' : 'records';
    var recBtn=$('ptab-records'), regBtn=$('ptab-registry');
    var rec=$('ptab-records-content'), reg=$('ptab-registry-content');
    if(recBtn) recBtn.classList.toggle('active', tab==='records');
    if(regBtn){ regBtn.style.display=''; regBtn.classList.toggle('active', tab==='registry'); }
    if(rec) rec.style.display = tab==='records' ? '' : 'none';
    if(reg) reg.style.display = tab==='registry' ? '' : 'none';
    if(!isManager()){
      ['playerPageBtns','registryActionBtns','regTabQuickAdd'].forEach(function(id){ var el=$(id); if(el) el.style.display='none'; });
    }
  }
  function markRecordButtons(){
    try{
      document.querySelectorAll('#psResults button').forEach(function(btn){
        var oc=String(btn.getAttribute('onclick')||'');
        var tx=(btn.textContent||'').replace(/\s+/g,'').trim();
        if(oc.indexOf('showP')>=0 || tx.indexOf('기록보기')>=0){
          btn.type='button';
          btn.classList.add('v354-record-view-btn');
          btn.style.animation='none';
          btn.style.transform='none';
          btn.style.transition='background-color .12s ease,border-color .12s ease,color .12s ease';
        }
      });
    }catch(e){}
  }
  function decodeHtml(s){ try{ var t=document.createElement('textarea'); t.innerHTML=String(s||''); return t.value; }catch(e){ return String(s||''); } }
  function loadRecords(){
    try{
      var jobs=[];
      if(typeof window.loadRegistry==='function') jobs.push(Promise.resolve(window.loadRegistry(new Date().getFullYear())));
      if(typeof window.ensurePlayersLoaded==='function') jobs.push(Promise.resolve(window.ensurePlayersLoaded()));
      // v519 비용 보호: 관리자(AD)일 때만 전체 participation 조회
      if(typeof window.ensureAllParticipationDataLoaded==='function' && window.AD) jobs.push(Promise.resolve(window.ensureAllParticipationDataLoaded()));
      Promise.allSettled(jobs).then(function(){
        try{ if(typeof window.renderAllP==='function') window.renderAllP(); }catch(e){}
        try{ if(typeof window.popCF==='function') window.popCF(); }catch(e){}
        try{ if(typeof window.updatePlayersAdminControls==='function') window.updatePlayersAdminControls(); }catch(e){}
        setTimeout(markRecordButtons,0); setTimeout(markRecordButtons,120);
      });
    }catch(e){ try{ if(typeof window.renderAllP==='function') window.renderAllP(); }catch(_e){} setTimeout(markRecordButtons,0); }
  }
  function loadRegistry(force){
    try{
      var body=$('regTabBody');
      if(body && !body.dataset.ready){
        body.innerHTML='<div class="card" style="padding:22px;text-align:center;font-size:.9rem;color:var(--text2)">참가자 목록을 불러오는 중입니다…</div>';
      }
      var p;
      if(typeof window.initRegistryTab==='function') p=Promise.resolve(window.initRegistryTab(!!force));
      else if(typeof window.renderRegistryTab==='function') p=Promise.resolve(window.renderRegistryTab(true));
      if(p) p.catch(function(err){ console.error('registry load failed',err); if(window.toast) toast('참가자 목록 로딩 실패','error'); });
    }catch(e){ console.error('registry load failed',e); }
  }

  var originalSwitch = window.switchPlayersTab;
  window.switchPlayersTab = function(tab){
    tab = tab === 'registry' ? 'registry' : 'records';
    if(tab === 'registry'){
      lockedTab = 'registry';
      lockUntil = Date.now() + 3500;
      setPlayersTabDom('registry');
      loadRegistry(true);
      setTimeout(function(){ setPlayersTabDom('registry'); },80);
      setTimeout(function(){ setPlayersTabDom('registry'); },300);
      return false;
    }
    // 이전 스크립트가 자동으로 records로 돌려놓는 호출은 일정 시간 무시한다.
    if(tab === 'records' && lockedTab === 'registry' && Date.now() < lockUntil && !inRecordsClickEvent()){
      setPlayersTabDom('registry');
      return false;
    }
    lockedTab = 'records';
    lockUntil = 0;
    setPlayersTabDom('records');
    loadRecords();
    return false;
  };

  // 탭 버튼 클릭은 캡처 단계에서 직접 처리해서 기존 강제 전환 스크립트를 우회한다.
  document.addEventListener('click', function(ev){
    var regBtn = ev.target && ev.target.closest ? ev.target.closest('#ptab-registry') : null;
    if(regBtn){
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
      window.switchPlayersTab('registry');
      return false;
    }
    var recBtn = ev.target && ev.target.closest ? ev.target.closest('#ptab-records') : null;
    if(recBtn){
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
      lockedTab='records'; lockUntil=0;
      window.switchPlayersTab('records');
      return false;
    }
  }, true);

  // 기록 보기 버튼은 카드/hover 이벤트와 분리해서 직접 실행한다.
  document.addEventListener('click', function(ev){
    var btn = ev.target && ev.target.closest ? ev.target.closest('#psResults button') : null;
    if(!btn) return;
    var oc=String(btn.getAttribute('onclick')||'');
    var tx=(btn.textContent||'').replace(/\s+/g,'').trim();
    if(oc.indexOf('showP')<0 && tx.indexOf('기록보기')<0) return;
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    try{
      var name=btn.getAttribute('data-pname')||'';
      var club=btn.getAttribute('data-pclub')||'';
      if(!name){
        var m=oc.match(/showP\('([^']*)'\s*,\s*'([^']*)'\)/);
        if(m){ name=decodeHtml(m[1]); club=decodeHtml(m[2]); }
      }else{ name=decodeHtml(name); club=decodeHtml(club); }
      if(typeof window.showP==='function') window.showP(name, club);
      else if(window.toast) toast('선수 기록 함수가 아직 준비되지 않았습니다. 잠시 후 다시 눌러주세요.','info');
    }catch(e){ console.error('record view failed',e); if(window.toast) toast('기록 보기 실행 실패','error'); }
    return false;
  }, true);

  function reinforce(){
    try{
      var regBtn=$('ptab-registry'); if(regBtn) regBtn.style.display='';
      if(lockedTab==='registry' && Date.now()<lockUntil) setPlayersTabDom('registry');
      markRecordButtons();
    }catch(e){}
  }
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(reinforce,100); setTimeout(reinforce,600); setTimeout(reinforce,1500);
  });
  try{
    var mo=new MutationObserver(function(){ clearTimeout(window.__v354PlayersTimer); window.__v354PlayersTimer=setTimeout(reinforce,80); });
    mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  }catch(e){}
})();


/* ===== extracted from v355PublicRegistryStickyFixScript ===== */
(function(){
  'use strict';
  if(window.__v355PublicRegistryStickyFix) return;
  window.__v355PublicRegistryStickyFix = true;

  var desiredTab = 'records';
  var lastRegistryClickAt = 0;
  function $(id){ return document.getElementById(id); }
  function currentPageIsPlayers(){
    try{ return !!document.querySelector('#page-players.active'); }catch(e){ return false; }
  }
  function isManager(){
    return document.body.classList.contains('admin-mode') || document.body.classList.contains('tm-mode') || !!window.AD || !!window.TM;
  }
  function setDom(tab){
    tab = tab === 'registry' ? 'registry' : 'records';
    var recBtn=$('ptab-records'), regBtn=$('ptab-registry');
    var rec=$('ptab-records-content'), reg=$('ptab-registry-content');
    if(recBtn) recBtn.classList.toggle('active', tab==='records');
    if(regBtn){ regBtn.style.display=''; regBtn.classList.toggle('active', tab==='registry'); }
    if(rec) rec.style.display = tab==='records' ? '' : 'none';
    if(reg) reg.style.display = tab==='registry' ? '' : 'none';
    document.body.classList.toggle('players-registry-active', currentPageIsPlayers() && tab==='registry');
    document.body.classList.toggle('players-records-active', currentPageIsPlayers() && tab==='records');
    if(!isManager()){
      ['playerPageBtns','registryActionBtns','regTabQuickAdd'].forEach(function(id){ var el=$(id); if(el) el.style.display='none'; });
    }
  }
  function renderRegistry(force){
    try{
      var body=$('regTabBody');
      if(body && !body.dataset.ready){
        body.innerHTML='<div class="card" style="padding:22px;text-align:center;font-size:.9rem;color:var(--text2)">참가자 목록을 불러오는 중입니다…</div>';
      }
      var p=null;
      if(typeof window.initRegistryTab==='function') p=Promise.resolve(window.initRegistryTab(!!force));
      else if(typeof window.renderRegistryTab==='function') p=Promise.resolve(window.renderRegistryTab(true));
      if(p){
        p.then(function(){ setDom('registry'); }).catch(function(err){
          console.error('registry load failed',err);
          if(typeof window.toast==='function') window.toast('참가자 목록 로딩 실패: '+(err.message||err),'error');
        });
      }
    }catch(e){ console.error('registry load failed',e); }
  }
  function renderRecords(){
    try{
      var jobs=[];
      if(typeof window.loadRegistry==='function') jobs.push(Promise.resolve(window.loadRegistry(new Date().getFullYear())));
      if(typeof window.ensurePlayersLoaded==='function') jobs.push(Promise.resolve(window.ensurePlayersLoaded()));
      // v519 비용 보호: 관리자(AD)일 때만 전체 participation 조회
      if(typeof window.ensureAllParticipationDataLoaded==='function' && window.AD) jobs.push(Promise.resolve(window.ensureAllParticipationDataLoaded()));
      Promise.allSettled(jobs).then(function(){
        try{ if(typeof window.renderAllP==='function') window.renderAllP(); }catch(e){}
        try{ if(typeof window.popCF==='function') window.popCF(); }catch(e){}
        try{ if(typeof window.updatePlayersAdminControls==='function') window.updatePlayersAdminControls(); }catch(e){}
      });
    }catch(e){ try{ if(typeof window.renderAllP==='function') window.renderAllP(); }catch(_e){} }
  }

  var prevSwitch = window.switchPlayersTab;
  window.switchPlayersTab = function(tab, opts){
    tab = tab === 'registry' ? 'registry' : 'records';
    opts = opts || {};
    // 참가자 목록을 사용자가 선택한 직후에는 다른 스크립트의 자동 records 전환을 막는다.
    if(tab==='records' && desiredTab==='registry' && !opts.explicit){
      setDom('registry');
      renderRegistry(false);
      return false;
    }
    desiredTab = tab;
    try{ sessionStorage.setItem('playersDesiredTab', desiredTab); }catch(e){}
    if(tab==='registry'){
      lastRegistryClickAt = Date.now();
      setDom('registry');
      renderRegistry(true);
      setTimeout(function(){ setDom('registry'); },80);
      setTimeout(function(){ setDom('registry'); },350);
      setTimeout(function(){ setDom('registry'); },1200);
      return false;
    }
    setDom('records');
    renderRecords();
    return false;
  };

  // 탭 클릭을 캡처 단계에서 직접 처리하여 기존 onclick/이전 패치의 자동 전환을 차단한다.
  document.addEventListener('click', function(ev){
    var t = ev.target && ev.target.closest ? ev.target.closest('#ptab-registry,#ptab-records') : null;
    if(!t) return;
    if(t.id==='ptab-registry'){
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
      desiredTab='registry';
      try{ sessionStorage.setItem('playersDesiredTab','registry'); }catch(e){}
      window.switchPlayersTab('registry');
      return false;
    }
    if(t.id==='ptab-records'){
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
      desiredTab='records';
      try{ sessionStorage.setItem('playersDesiredTab','records'); }catch(e){}
      window.switchPlayersTab('records',{explicit:true});
      return false;
    }
  }, true);

  // showPage('players') 이후에도 사용자가 마지막으로 참가자 목록을 보던 상태면 목록을 유지한다.
  var prevShowPage = window.showPage;
  if(typeof prevShowPage==='function'){
    window.showPage = function(page){
      var r = prevShowPage.apply(this, arguments);
      try{
        if(page==='players'){
          var saved=sessionStorage.getItem('playersDesiredTab')||desiredTab;
          if(saved==='registry') setTimeout(function(){ window.switchPlayersTab('registry'); },30);
        }else{
          document.body.classList.remove('players-registry-active','players-records-active');
        }
      }catch(e){}
      return r;
    };
  }

  function reinforce(){
    try{
      var saved=sessionStorage.getItem('playersDesiredTab');
      if(saved==='registry') desiredTab='registry';
      if(currentPageIsPlayers() && desiredTab==='registry'){
        setDom('registry');
        var body=$('regTabBody');
        if(body && (!body.dataset.ready || /최근\s*참가자\s*빠르게\s*보기/.test(body.textContent||''))){
          renderRegistry(false);
        }
      }
    }catch(e){}
  }
  document.addEventListener('DOMContentLoaded', function(){
    try{ desiredTab=sessionStorage.getItem('playersDesiredTab')||desiredTab; }catch(e){}
    setTimeout(reinforce,100); setTimeout(reinforce,700); setTimeout(reinforce,1600);
  });
  try{
    var mo=new MutationObserver(function(){
      clearTimeout(window.__v355PlayersRegistryTimer);
      window.__v355PlayersRegistryTimer=setTimeout(reinforce,60);
    });
    mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  }catch(e){}
})();


/* ===== extracted from v356PlayersUnifiedScript ===== */
(function(){
  'use strict';
  if(window.__v356PlayersUnified) return;
  window.__v356PlayersUnified = true;
  function $(id){ return document.getElementById(id); }
  function setUnifiedDom(){
    try{
      document.body.classList.remove('players-registry-active');
      document.body.classList.add('players-records-active');
      try{ sessionStorage.setItem('playersDesiredTab','records'); }catch(e){}
      var title=$('playerPageTitle'); if(title) title.textContent='참가자 기록';
      var bar=document.querySelector('#page-players .players-tab-bar'); if(bar) bar.style.display='none';
      var rec=$('ptab-records-content'); if(rec) rec.style.display='block';
      var reg=$('ptab-registry-content'); if(reg) reg.style.display='none';
      var recBtn=$('ptab-records'); if(recBtn) recBtn.style.display='none';
      var regBtn=$('ptab-registry'); if(regBtn) regBtn.style.display='none';
      ['playerPageBtns','registryActionBtns','regTabQuickAdd'].forEach(function(id){var el=$(id); if(el && !document.body.classList.contains('admin-mode')) el.style.display='none';});
    }catch(e){}
  }
  function renderUnified(){
    setUnifiedDom();
    try{
      if(typeof window.loadRegistry==='function') window.loadRegistry(new Date().getFullYear()).catch(function(){});
      if(typeof window.ensurePlayersLoaded==='function') window.ensurePlayersLoaded().catch(function(){});
      // v519 비용 보호: 관리자(AD)일 때만
      if(typeof window.ensureAllParticipationDataLoaded==='function' && window.AD) window.ensureAllParticipationDataLoaded().catch(function(){});
    }catch(e){}
    setTimeout(function(){ try{ if(typeof window.renderAllP==='function') window.renderAllP(); }catch(e){} setUnifiedDom(); },80);
    setTimeout(function(){ try{ if(typeof window.renderAllP==='function') window.renderAllP(); }catch(e){} setUnifiedDom(); },650);
  }
  window.switchPlayersTab=function(){
    renderUnified();
    return false;
  };
  var oldShowPage=window.showPage;
  if(typeof oldShowPage==='function'){
    window.showPage=function(page){
      var r=oldShowPage.apply(this, arguments);
      if(page==='players') renderUnified();
      return r;
    };
  }
  document.addEventListener('click',function(ev){
    var t=ev.target&&ev.target.closest?ev.target.closest('#ptab-records,#ptab-registry'):null;
    if(t){ ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); renderUnified(); return false; }
  },true);
  document.addEventListener('DOMContentLoaded',function(){
    setTimeout(function(){ if(document.querySelector('#page-players.active')) renderUnified(); else setUnifiedDom(); },120);
    setTimeout(function(){ if(document.querySelector('#page-players.active')) renderUnified(); },900);
  });
  try{
    var mo=new MutationObserver(function(){
      clearTimeout(window.__v356PlayersUnifiedTimer);
      window.__v356PlayersUnifiedTimer=setTimeout(function(){
        if(document.querySelector('#page-players.active')) setUnifiedDom();
      },80);
    });
    mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  }catch(e){}
})();


/* ===== extracted from v357AdminPlayerRecordEditScript ===== */
(function(){
  'use strict';
  if(window.__v357AdminPlayerRecordEdit) return;
  window.__v357AdminPlayerRecordEdit=true;
  function isAdminLike(){
    try{return !!(window.AD||window.TM||document.body.classList.contains('admin-mode')||document.body.classList.contains('tm-mode'));}catch(e){return false;}
  }
  function cleanNameLocal(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function normPhone(v){return String(v||'').replace(/[^0-9]/g,'');}
  function safeEsc(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function splitKey(k){
    var s=String(k||'');
    if(s.indexOf('__')>=0){var a=s.split('__');return {name:a[0]||'',club:a.slice(1).join('__')||''};}
    return {name:s,club:''};
  }
  function ensurePlayerKey(name,club){
    name=cleanNameLocal(name); club=cleanNameLocal(club);
    var G=window.G||{}; var players=G.players||{};
    var keys=Object.keys(players);
    var found=keys.find(function(k){var sp=splitKey(k);return cleanNameLocal(sp.name)===name && (!club || cleanNameLocal(sp.club)===club);}) ||
              keys.find(function(k){var sp=splitKey(k);return cleanNameLocal(sp.name)===name;});
    return found || (club ? name+'__'+club : name);
  }
  async function removeFromRegistryAndHist(name,club){
    var changed=false;
    try{
      if(window.G_REGISTRY){
        Object.keys(window.G_REGISTRY).forEach(function(y){
          var arr=Array.isArray(window.G_REGISTRY[y])?window.G_REGISTRY[y]:[];
          var before=arr.length;
          window.G_REGISTRY[y]=arr.filter(function(r){
            var rn=cleanNameLocal(r&&r.name); var rc=cleanNameLocal((r&&r.club)||'');
            if(rn!==name) return true;
            if(club && rc && rc!==club) return true;
            return false;
          });
          if(window.G_REGISTRY[y].length!==before) changed=true;
        });
      }
      if(window.HIST_DATA){
        (window.HIST_DATA||[]).forEach(function(t){
          (t.teams||[]).forEach(function(tm){
            var before=(tm.players||[]).length;
            tm.players=(tm.players||[]).filter(function(pn){return cleanNameLocal(pn)!==name;});
            if(tm.players.length!==before) changed=true;
          });
        });
      }
      if(changed){
        try{ if(typeof window.saveRegistry==='function') await window.saveRegistry(new Date().getFullYear()); }catch(e){}
        try{ if(typeof window.savePlayersToLocalCache==='function') window.savePlayersToLocalCache(); }catch(e){}
      }
    }catch(e){console.warn('v357 registry/hist cleanup failed',e);}
    return changed;
  }
  var originalOpenPD=window.openPD;
  if(typeof originalOpenPD==='function'){
    window.openPD=async function(name,club){
      var r=await originalOpenPD.apply(this,arguments);
      setTimeout(function(){
        try{
          if(!isAdminLike()) return;
          var footer=document.getElementById('mPDFooter');
          if(!footer || footer.querySelector('.v357-admin-record-actions')) return;
          var key=ensurePlayerKey(name,club);
          footer.innerHTML='<div class="v357-admin-record-actions">'+
            '<button class="btn btn-outline" onclick="openEditPlayer(\''+safeEsc(key)+'\')">✏️ 기록 수정</button>'+
            '<button class="btn btn-danger" onclick="deletePlayerRecordDirect(\''+safeEsc(key)+'\')">🗑️ 기록 삭제</button>'+
            '</div><div style="flex:1"></div><button class="btn btn-gray" onclick="cm(\'mPD\')">닫기</button>';
        }catch(e){console.warn('v357 openPD footer failed',e);}
      },80);
      return r;
    };
  }
  window.deletePlayerRecordDirect=async function(key){
    if(!isAdminLike()){ if(window.toast) toast('관리자 권한이 필요합니다.','error'); return; }
    var sp=splitKey(key); var name=cleanNameLocal(sp.name||key), club=cleanNameLocal(sp.club||'');
    if(!confirm('"'+name+'" 참가자 기록을 삭제하시겠습니까?\n선수 기록/참가자 목록에서 제거됩니다.')) return;
    try{
      if(typeof window.sl==='function') window.sl(true);
      var G=window.G||{}; var players=G.players||{};
      var realKey=ensurePlayerKey(name,club);
      if(players[realKey]){
        try{
          var docId=realKey.replace(/[\/\.#\$\[\]]/g,'_');
          if(window.db && window.deleteDoc && window.doc) await window.deleteDoc(window.doc(window.db,'players',docId));
        }catch(e){console.warn('v357 firestore delete skipped/failed',e);}
        delete players[realKey];
      }
      await removeFromRegistryAndHist(name,club);
      try{ if(typeof window.cm==='function'){cm('mPD');cm('mEditP');} }catch(e){}
      try{ if(typeof window.renderAllP==='function') window.renderAllP(); }catch(e){}
      if(window.toast) toast('기록 삭제 완료 ✅','success');
    }catch(e){ if(window.toast) toast('기록 삭제 실패: '+(e.message||e),'error'); }
    finally{ try{ if(typeof window.sl==='function') window.sl(false); }catch(e){} }
  };
  // 기존 deletePlayer도 registry/hist 정리까지 보강
  var originalDeletePlayer=window.deletePlayer;
  if(typeof originalDeletePlayer==='function'){
    window.deletePlayer=async function(){
      var key=window.EP_name || (document.getElementById('epOldName')?document.getElementById('epOldName').value:'');
      var sp=splitKey(key); var name=cleanNameLocal(sp.name||key), club=cleanNameLocal(sp.club||'');
      var r=await originalDeletePlayer.apply(this,arguments);
      try{ await removeFromRegistryAndHist(name,club); if(typeof window.renderAllP==='function') window.renderAllP(); }catch(e){}
      return r;
    };
  }
  var originalRenderAllP=window.renderAllP;
  if(typeof originalRenderAllP==='function'){
    window.renderAllP=function(){
      var r=originalRenderAllP.apply(this,arguments);
      setTimeout(function(){
        try{
          if(!isAdminLike()) return;
          // 기록 카드마다 수정/삭제 빠른 버튼을 추가하려고 시도. 구조가 다르면 상세 팝업 버튼만 사용.
          document.querySelectorAll('#psResults [onclick*="openPD"], #psResults [onclick*="showP"]').forEach(function(btn){
            var card=btn.closest('.card, .home-panel-row, .ri, div');
            if(!card || card.querySelector('.v357-admin-record-actions')) return;
            var text=(card.innerText||'').split('\n')[0]||'';
            var name=text.replace(/기록 보기|수정|삭제|👤|🏆|📊/g,'').trim().split(/\s{2,}|\|/)[0].trim();
            if(!name || name.length>20) return;
          });
        }catch(e){}
      },120);
      return r;
    };
  }
})();


/* ===== extracted from v361DeveloperOnlyPlayerRecordEditScript ===== */
(function(){
  'use strict';
  if(window.__v361DeveloperOnlyPlayerRecordEdit) return;
  window.__v361DeveloperOnlyPlayerRecordEdit = true;

  function isDeveloper(){
    try{
      return document.body.classList.contains('admin-mode') || window.LOGIN_PORTAL_MODE === 'developer';
    }catch(e){ return false; }
  }
  function clean(v){ return String(v||'').replace(/\s+/g,' ').trim(); }
  function splitKey(k){
    var s=String(k||'');
    if(s.indexOf('__')>=0){ var a=s.split('__'); return {name:a[0]||'', club:a.slice(1).join('__')||''}; }
    return {name:s, club:''};
  }
  function jsArg(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' '); }
  function ensurePlayerKey(name,club){
    name=clean(name); club=clean(club);
    try{
      var players=(window.G&&window.G.players)||{};
      var keys=Object.keys(players);
      var found=keys.find(function(k){ var sp=splitKey(k); return clean(sp.name)===name && (!club || clean(sp.club)===club); }) ||
                keys.find(function(k){ var sp=splitKey(k); return clean(sp.name)===name; });
      if(found) return found;
    }catch(e){}
    return club ? (name+'__'+club) : name;
  }
  function inferKeyFromModalBody(bodyEl, fallback){
    var text=clean(bodyEl && bodyEl.innerText || '');
    var first=(text.split('\n').map(clean).filter(Boolean)[0]||'');
    first=first.replace(/^👤\s*/,'').replace(/기록\s*없음.*$/,'').trim();
    var sp=splitKey(first || fallback || '');
    return ensurePlayerKey(sp.name || fallback, sp.club || '');
  }
  async function removeFromRegistryAndHist(name,club){
    var changed=false;
    try{
      if(window.G_REGISTRY){
        Object.keys(window.G_REGISTRY).forEach(function(y){
          var arr=Array.isArray(window.G_REGISTRY[y])?window.G_REGISTRY[y]:[];
          var before=arr.length;
          window.G_REGISTRY[y]=arr.filter(function(r){
            var rn=clean(r&&r.name), rc=clean((r&&r.club)||'');
            if(rn!==name) return true;
            if(club && rc && rc!==club) return true;
            return false;
          });
          if(window.G_REGISTRY[y].length!==before) changed=true;
        });
      }
      if(window.HIST_DATA){
        (window.HIST_DATA||[]).forEach(function(t){
          (t.teams||[]).forEach(function(tm){
            var before=(tm.players||[]).length;
            tm.players=(tm.players||[]).filter(function(pn){return clean(pn)!==name;});
            if(tm.players.length!==before) changed=true;
          });
        });
      }
      if(changed){
        try{ if(typeof window.saveRegistry==='function') await window.saveRegistry(new Date().getFullYear()); }catch(e){}
        try{ if(typeof window.savePlayersToLocalCache==='function') window.savePlayersToLocalCache(); }catch(e){}
      }
    }catch(e){ console.warn('v361 registry cleanup failed', e); }
    return changed;
  }
  function setPHistFooter(key){
    try{
      var footer=document.querySelector('#mPHist .modal-footer');
      if(!footer) return;
      if(!isDeveloper()){
        footer.innerHTML='<button class="btn btn-gray" onclick="cm(\'mPHist\')">닫기</button>';
        return;
      }
      footer.innerHTML='<div class="v360-dev-record-actions">'
        +'<button class="btn btn-outline" onclick="openEditPlayer(\''+jsArg(key)+'\')">✏️ 기록 수정</button>'
        +'<button class="btn btn-danger" onclick="deletePlayerRecordDirect(\''+jsArg(key)+'\')">🗑️ 기록 삭제</button>'
        +'<button class="btn btn-gray" onclick="cm(\'mPHist\')">닫기</button>'
        +'</div>';
    }catch(e){ console.warn('v361 mPHist footer failed', e); }
  }
  function setPDetailFooter(key){
    try{
      var footer=document.getElementById('mPDFooter');
      if(!footer) return;
      if(!isDeveloper()){
        footer.innerHTML='<button class="btn btn-gray" onclick="cm(\'mPD\')">닫기</button>';
        return;
      }
      footer.innerHTML='<div class="v360-dev-record-actions">'
        +'<button class="btn btn-outline" onclick="openEditPlayer(\''+jsArg(key)+'\')">✏️ 기록 수정</button>'
        +'<button class="btn btn-danger" onclick="deletePlayerRecordDirect(\''+jsArg(key)+'\')">🗑️ 기록 삭제</button>'
        +'<button class="btn btn-gray" onclick="cm(\'mPD\')">닫기</button>'
        +'</div>';
    }catch(e){ console.warn('v361 mPD footer failed', e); }
  }

  var installWrappers=function(){
    if(window.__v361PlayerWrappersInstalled) return;
    window.__v361PlayerWrappersInstalled=true;
    var prevOpenPHist = window.openPHist;
    if(typeof prevOpenPHist === 'function'){
      window.openPHist = async function(iid){
        var raw='';
        try{ raw=(document.getElementById(iid)?.value||'').trim(); }catch(e){}
        var result = await prevOpenPHist.apply(this, arguments);
        setTimeout(function(){
          var sp=splitKey(raw);
          var key=ensurePlayerKey(sp.name||raw, sp.club||'');
          if(!key) key=inferKeyFromModalBody(document.getElementById('mPHistBody'), raw);
          if(key) setPHistFooter(key);
        }, 140);
        return result;
      };
    }

    var prevOpenPD = window.openPD;
    if(typeof prevOpenPD === 'function'){
      window.openPD = async function(name,club){
        var result = await prevOpenPD.apply(this, arguments);
        setTimeout(function(){ setPDetailFooter(ensurePlayerKey(name,club)); }, 180);
        setTimeout(function(){ setPDetailFooter(ensurePlayerKey(name,club)); }, 360);
        return result;
      };
    }

    var prevOpenEditPlayer = window.openEditPlayer;
    if(typeof prevOpenEditPlayer === 'function'){
      window.openEditPlayer = function(key){
        if(!isDeveloper()){
          if(window.toast) toast('개발자 권한에서만 기록 수정이 가능합니다.','error');
          return;
        }
        return prevOpenEditPlayer.apply(this, arguments);
      };
    }
  };

  window.deletePlayerRecordDirect = async function(key){
    if(!isDeveloper()){
      if(window.toast) toast('개발자 권한에서만 기록 삭제가 가능합니다.','error');
      return;
    }
    var sp=splitKey(key);
    var name=clean(sp.name||key), club=clean(sp.club||'');
    if(!name){ if(window.toast) toast('삭제할 기록을 찾지 못했습니다.','error'); return; }
    if(!confirm('"'+name+'" 참가자 기록을 삭제하시겠습니까?\n선수 기록/참가자 목록에서 제거됩니다.')) return;
    try{
      if(typeof window.sl==='function') window.sl(true);
      var G=window.G||{}; var players=G.players||{};
      var realKey=ensurePlayerKey(name, club);
      if(players[realKey]){
        try{
          var docId=realKey.replace(/[\\/\.#\$\[\]]/g,'_');
          if(window.db && window.deleteDoc && window.doc) await window.deleteDoc(window.doc(window.db,'players',docId));
        }catch(e){ console.warn('v361 Firestore player delete skipped/failed', e); }
        delete players[realKey];
      }
      await removeFromRegistryAndHist(name, club);
      try{ if(typeof window.cm==='function'){ cm('mPD'); cm('mPHist'); cm('mEditP'); } }catch(e){}
      try{ if(typeof window.renderAllP==='function') window.renderAllP(); }catch(e){}
      try{ if(typeof window.renderRegistryTab==='function') window.renderRegistryTab(); }catch(e){}
      if(window.toast) toast('기록 삭제 완료 ✅','success');
    }catch(e){
      if(window.toast) toast('기록 삭제 실패: '+(e.message||e),'error');
    }finally{
      try{ if(typeof window.sl==='function') window.sl(false); }catch(e){}
    }
  };

  try{
    installWrappers();
    setTimeout(installWrappers, 500);
    setTimeout(installWrappers, 1600);
    var mo=new MutationObserver(function(){
      clearTimeout(window.__v361RecordFooterTimer);
      window.__v361RecordFooterTimer=setTimeout(function(){
        installWrappers();
        if(!isDeveloper()){
          var f1=document.getElementById('mPDFooter');
          if(f1 && f1.querySelector('.v357-admin-record-actions,.v360-dev-record-actions')) f1.innerHTML='<button class="btn btn-gray" onclick="cm(\'mPD\')">닫기</button>';
          var f2=document.querySelector('#mPHist .modal-footer');
          if(f2 && f2.querySelector('.v357-admin-record-actions,.v360-dev-record-actions')) f2.innerHTML='<button class="btn btn-gray" onclick="cm(\'mPHist\')">닫기</button>';
        }
      }, 60);
    });
    mo.observe(document.body,{subtree:true,childList:true});
  }catch(e){}
})();


/* ===== extracted from v365AdminRecordDeleteCleanupScript ===== */
(function(){
  'use strict';
  if(window.__v365AdminRecordDeleteCleanup) return;
  window.__v365AdminRecordDeleteCleanup=true;

  function isAdminLike(){
    try{return !!(window.AD||window.TM||document.body.classList.contains('admin-mode')||document.body.classList.contains('tm-mode')||window.LOGIN_PORTAL_MODE==='developer'||window.LOGIN_PORTAL_MODE==='tournament_admin');}catch(e){return false;}
  }
  function clean(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function normClub(v){try{return typeof window.normalizeClub==='function'?window.normalizeClub(v):clean(v);}catch(e){return clean(v);}}
  function splitKey(k){var s=String(k||''); if(s.indexOf('__')>=0){var a=s.split('__');return {name:a[0]||'',club:a.slice(1).join('__')||''};} return {name:s,club:''};}
  function jsArg(s){return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' ');}
  function makeKey(name,club){try{if(typeof window.pKey==='function')return window.pKey(name,club);}catch(e){} return club?name+'__'+club:name;}
  function selectedClub(){try{var v=(document.getElementById('regClub')&&document.getElementById('regClub').value)||'';if(!v||v==='__custom__')v=(document.getElementById('regClubText')&&document.getElementById('regClubText').value)||'';return normClub(v);}catch(e){return '';}}
  function ensureKey(name,club){
    name=clean(name); club=normClub(club||'');
    try{var players=(window.G&&window.G.players)||{};var keys=Object.keys(players);var found=keys.find(function(k){var sp=splitKey(k);return clean(sp.name)===name&&(!club||normClub(sp.club)===club);})||keys.find(function(k){var sp=splitKey(k);return clean(sp.name)===name;});if(found)return found;}catch(e){}
    return makeKey(name,club);
  }
  function inferKeyFromBody(body,fallback,club){
    var text=clean((body&&body.innerText)||'');
    var first=(text.split('\n').map(clean).filter(Boolean)[0]||fallback||'');
    first=first.replace(/^👤\s*/,'').replace(/기록\s*없음.*$/,'').trim();
    var sp=splitKey(first||fallback||'');
    return ensureKey(sp.name||fallback,sp.club||club||'');
  }
  function footerHtml(key){
    return '<div class="v365-record-actions">'
      +'<button class="btn btn-danger" onclick="deletePlayerRecordDirect(\''+jsArg(key)+'\')">🗑️ 명단 삭제</button>'
      +'<button class="btn btn-gray" onclick="cm(\'mPD\');cm(\'mPHist\')">닫기</button>'
      +'</div>';
  }
  function setPHistFooter(key){
    try{var footer=document.querySelector('#mPHist .modal-footer'); if(!footer)return; if(!isAdminLike()){footer.innerHTML='<button class="btn btn-gray" onclick="cm(\'mPHist\')">닫기</button>';return;} footer.innerHTML=footerHtml(key); var body=document.getElementById('mPHistBody'); if(body&&!body.querySelector('.v365-record-note')){var n=document.createElement('div');n.className='v365-record-note';n.textContent='관리자 모드: 테스트 이름, 외1명처럼 잘못 남은 명단은 아래 삭제 버튼으로 기록보기/참가자 목록에서 정리할 수 있습니다.';body.appendChild(n);}}catch(e){console.warn('v365 PHist footer failed',e);}
  }
  function setPDFooter(key){
    try{var footer=document.getElementById('mPDFooter'); if(!footer)return; if(!isAdminLike()){footer.innerHTML='<button class="btn btn-gray" onclick="cm(\'mPD\')">닫기</button>';return;} footer.innerHTML=footerHtml(key);}catch(e){console.warn('v365 PD footer failed',e);}
  }
  function removeNameFromTeam(team,name){
    var changed=false, nm=clean(name);
    if(Array.isArray(team.players)){
      var before=team.players.length;
      team.players=team.players.filter(function(p){return clean(p)!==nm;});
      if(team.players.length!==before) changed=true;
    }
    if(Array.isArray(team.individualPlayers)){
      var before2=team.individualPlayers.length;
      team.individualPlayers=team.individualPlayers.filter(function(p){return clean((p&&p.name)||p)!==nm;});
      if(team.individualPlayers.length!==before2) changed=true;
    }
    if(changed){
      var names=[];
      if(Array.isArray(team.individualPlayers)&&team.individualPlayers.length) names=team.individualPlayers.map(function(p){return clean((p&&p.name)||p);}).filter(Boolean);
      else if(Array.isArray(team.players)) names=team.players.map(clean).filter(Boolean);
      if(team.tournamentType==='individual_pair'||team.individualPlayers||team.pairLabel||team.entryLabel){
        team.pairLabel=names.join(' / ');
        team.entryLabel=team.pairLabel;
      }
      team.updatedAt=new Date().toISOString();
    }
    return changed;
  }
  async function cleanupEverywhere(name,club){
    var changedKeys=[];
    try{
      var G=window.G||{};
      if(G.players){
        var keys=Object.keys(G.players);
        keys.forEach(function(k){var sp=splitKey(k);var n=clean(sp.name), c=normClub(sp.club||G.players[k]?.club||''); if(n===name&&(!club||!c||c===club)){delete G.players[k];}});
      }
      if(G.teams){
        Object.keys(G.teams).forEach(function(key){
          var arr=Array.isArray(G.teams[key])?G.teams[key]:[];
          var changed=false;
          arr.forEach(function(team){
            var teamClub=normClub(team&&team.club||'');
            if(!club||!teamClub||teamClub===club) changed=removeNameFromTeam(team,name)||changed;
            else changed=removeNameFromTeam(team,name)||changed; // 이름 찌꺼기는 클럽 정보가 부정확한 경우가 많아 동일 이름 기준으로도 제거
          });
          if(changed) changedKeys.push(key);
        });
      }
      if(window.G_REGISTRY){
        Object.keys(window.G_REGISTRY).forEach(function(y){
          var arr=Array.isArray(window.G_REGISTRY[y])?window.G_REGISTRY[y]:[];
          window.G_REGISTRY[y]=arr.filter(function(r){var rn=clean(r&&r.name), rc=normClub((r&&r.club)||''); if(rn!==name)return true; if(club&&rc&&rc!==club)return true; return false;});
        });
      }
      if(window.HIST_DATA){
        (window.HIST_DATA||[]).forEach(function(t){(t.teams||[]).forEach(function(tm){tm.players=(tm.players||[]).filter(function(pn){return clean(pn)!==name;});});});
      }
      try{var docId=ensureKey(name,club).replace(/[\\/\.#\$\[\]]/g,'_'); if(window.db&&window.deleteDoc&&window.doc) await window.deleteDoc(window.doc(window.db,'players',docId));}catch(e){console.warn('v365 player doc delete skipped',e);}
      for(var i=0;i<changedKeys.length;i++){try{if(typeof window.stT==='function') await window.stT(changedKeys[i]);}catch(e){console.warn('v365 team save skipped',changedKeys[i],e);}}
      try{if(typeof window.saveRegistry==='function') await window.saveRegistry(window.REG_YEAR||new Date().getFullYear());}catch(e){}
      try{if(typeof window.savePlayersToLocalCache==='function') window.savePlayersToLocalCache();}catch(e){}
    }catch(e){console.warn('v365 cleanup failed',e);throw e;}
  }
  window.deletePlayerRecordDirect=async function(key){
    if(!isAdminLike()){if(window.toast)toast('관리자 권한이 필요합니다.','error');return;}
    var sp=splitKey(key); var name=clean(sp.name||key), club=normClub(sp.club||'');
    if(!name){if(window.toast)toast('삭제할 이름을 찾지 못했습니다.','error');return;}
    if(!confirm('"'+name+'" 명단을 삭제하시겠습니까?\n기록보기/참가자 목록/등록 명단에 남은 동일 이름을 정리합니다.')) return;
    try{if(typeof window.sl==='function')window.sl(true); await cleanupEverywhere(name,club); try{if(typeof window.cm==='function'){cm('mPD');cm('mPHist');cm('mEditP');}}catch(e){} try{if(typeof window.renderAllP==='function')window.renderAllP();}catch(e){} try{if(typeof window.renderRegistryTab==='function')window.renderRegistryTab();}catch(e){} try{if(typeof window.renderRL==='function')window.renderRL();}catch(e){} try{if(typeof window.renderBracket==='function')window.renderBracket();}catch(e){} if(window.toast)toast('명단 삭제 완료 ✅','success');}
    catch(e){if(window.toast)toast('삭제 실패: '+(e.message||e),'error');}
    finally{try{if(typeof window.sl==='function')window.sl(false);}catch(e){}}
  };
  var prevOpenPHist=window.openPHist;
  if(typeof prevOpenPHist==='function'){
    window.openPHist=async function(iid){var raw='',club='';try{raw=(document.getElementById(iid)?.value||'').trim();club=selectedClub();}catch(e){} var r=await prevOpenPHist.apply(this,arguments); setTimeout(function(){var sp=splitKey(raw);var key=ensureKey(sp.name||raw,sp.club||club); if(!key)key=inferKeyFromBody(document.getElementById('mPHistBody'),raw,club); if(key)setPHistFooter(key);},220); return r;};
  }
  var prevOpenPD=window.openPD;
  if(typeof prevOpenPD==='function'){
    window.openPD=async function(name,club){var r=await prevOpenPD.apply(this,arguments); setTimeout(function(){setPDFooter(ensureKey(name,club));},240); setTimeout(function(){setPDFooter(ensureKey(name,club));},520); return r;};
  }
  try{
    var mo=new MutationObserver(function(){clearTimeout(window.__v365RecordTimer);window.__v365RecordTimer=setTimeout(function(){try{if(!isAdminLike())return;var pd=document.getElementById('mPD');if(pd&&pd.classList.contains('open')){var title=(document.getElementById('mPDT')?.textContent||'').replace(/^👤\s*/,'').trim();if(title)setPDFooter(ensureKey(title,''));}var ph=document.getElementById('mPHist');if(ph&&ph.classList.contains('open')){var key=inferKeyFromBody(document.getElementById('mPHistBody'),'','');if(key)setPHistFooter(key);}}catch(e){}},90);});
    mo.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  }catch(e){}
})();


/* ===== extracted from v366RecordViewDeleteVisibleScript ===== */
(function(){
  'use strict';
  if(window.__v366RecordViewDeleteVisible) return;
  window.__v366RecordViewDeleteVisible=true;

  function clean(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function splitKey(k){var s=String(k||''); if(s.indexOf('__')>=0){var a=s.split('__');return {name:a[0]||'',club:a.slice(1).join('__')||''};} return {name:s,club:''};}
  function jsArg(s){return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' ');}
  function isAdminLike(){
    try{
      var badge=document.getElementById('adminBadge');
      var badgeText=clean(badge&&badge.textContent||'');
      var badgeShown=!!(badge && (badge.classList.contains('show') || badge.style.display!=='none') && /관리자|운영자|개발자/.test(badgeText));
      return !!(
        document.body.classList.contains('admin-mode') ||
        document.body.classList.contains('tm-mode') ||
        window.AD || window.TM ||
        window.LOGIN_PORTAL_MODE==='developer' ||
        window.LOGIN_PORTAL_MODE==='tournament_admin' ||
        badgeShown
      );
    }catch(e){return false;}
  }
  function makeKey(name,club){
    name=clean(name); club=clean(club);
    try{ if(typeof window.pKey==='function' && club) return window.pKey(name,club); }catch(e){}
    try{
      var players=(window.G&&window.G.players)||{};
      var keys=Object.keys(players);
      var found=keys.find(function(k){var sp=splitKey(k);return clean(sp.name)===name && (!club || clean(sp.club)===club);}) ||
                keys.find(function(k){var sp=splitKey(k);return clean(sp.name)===name;});
      if(found) return found;
    }catch(e){}
    return club ? name+'__'+club : name;
  }
  function inferKeyFromRecordBody(fallbackName,fallbackClub){
    try{
      var body=document.getElementById('mPHistBody');
      var txt=clean(body&&body.innerText||'');
      var first=(txt.split('\n').map(clean).filter(Boolean)[0]||'');
      first=first.replace(/^👤\s*/,'').replace(/기록\s*없음.*$/,'').trim();
      var sp=splitKey(first||fallbackName||'');
      return makeKey(sp.name||fallbackName, sp.club||fallbackClub||'');
    }catch(e){return makeKey(fallbackName,fallbackClub);}
  }
  function setRecordViewFooter(key){
    try{
      var footer=document.querySelector('#mPHist .modal-footer');
      if(!footer) return;
      if(!isAdminLike()){
        footer.innerHTML='<button class="btn btn-gray" onclick="cm(\'mPHist\')">닫기</button>';
        return;
      }
      footer.innerHTML='<div class="v366-record-delete-row">'
        +'<button class="btn btn-danger" onclick="deletePlayerRecordDirect(\''+jsArg(key)+'\')">🗑️ 명단 삭제</button>'
        +'<button class="btn btn-gray" onclick="cm(\'mPHist\')">닫기</button>'
        +'</div>';
      var body=document.getElementById('mPHistBody');
      if(body && !body.querySelector('.v365-record-note') && !body.querySelector('.v366-record-note')){
        var note=document.createElement('div');
        note.className='v366-record-note v365-record-note';
        note.textContent='관리자 모드: 외1명, 테스트 이름처럼 잘못 남은 명단은 아래 명단 삭제로 정리할 수 있습니다.';
        body.appendChild(note);
      }
    }catch(e){console.warn('v366 record footer failed',e);}
  }
  function setPlayerDetailFooter(key){
    try{
      var footer=document.getElementById('mPDFooter');
      if(!footer) return;
      if(!isAdminLike()){
        footer.innerHTML='<button class="btn btn-gray" onclick="cm(\'mPD\')">닫기</button>';
        return;
      }
      footer.innerHTML='<div class="v366-record-delete-row">'
        +'<button class="btn btn-danger" onclick="deletePlayerRecordDirect(\''+jsArg(key)+'\')">🗑️ 명단 삭제</button>'
        +'<button class="btn btn-gray" onclick="cm(\'mPD\')">닫기</button>'
        +'</div>';
    }catch(e){console.warn('v366 detail footer failed',e);}
  }

  var prevShowP=window.showP;
  if(typeof prevShowP==='function'){
    window.showP=async function(name,club){
      var r=await prevShowP.apply(this,arguments);
      var key=makeKey(name,club);
      setTimeout(function(){setRecordViewFooter(key||inferKeyFromRecordBody(name,club));},80);
      setTimeout(function(){setRecordViewFooter(key||inferKeyFromRecordBody(name,club));},260);
      setTimeout(function(){setRecordViewFooter(key||inferKeyFromRecordBody(name,club));},620);
      return r;
    };
  }

  var prevOpenPD=window.openPD;
  if(typeof prevOpenPD==='function'){
    window.openPD=async function(name,club){
      var r=await prevOpenPD.apply(this,arguments);
      var key=makeKey(name,club);
      setTimeout(function(){setPlayerDetailFooter(key);},120);
      setTimeout(function(){setPlayerDetailFooter(key);},360);
      return r;
    };
  }

  // 이미 열린 상태에서 관리자 로그인/렌더링 타이밍이 뒤바뀌어도 버튼을 다시 붙인다.
  try{
    var mo=new MutationObserver(function(){
      clearTimeout(window.__v366RecordViewTimer);
      window.__v366RecordViewTimer=setTimeout(function(){
        try{
          if(!isAdminLike()) return;
          var ph=document.getElementById('mPHist');
          if(ph && ph.classList.contains('open')) setRecordViewFooter(inferKeyFromRecordBody('',''));
          var pd=document.getElementById('mPD');
          if(pd && pd.classList.contains('open')){
            var t=clean((document.getElementById('mPDT')&&document.getElementById('mPDT').textContent)||'').replace(/^👤\s*/,'');
            if(t) setPlayerDetailFooter(makeKey(t,''));
          }
        }catch(e){}
      },120);
    });
    mo.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  }catch(e){}
})();


/* ===== extracted from v367InlineRecordDeleteButtonScript ===== */
(function(){
  'use strict';
  if(window.__v367InlineRecordDeleteButton) return;
  window.__v367InlineRecordDeleteButton=true;
  function clean(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function isAdminLike(){
    try{
      var badge=document.getElementById('adminBadge');
      var badgeText=clean(badge&&badge.textContent||'');
      return !!(document.body.classList.contains('admin-mode')||document.body.classList.contains('tm-mode')||window.AD||window.TM||/관리자|운영자|개발자/.test(badgeText));
    }catch(e){return false;}
  }
  function jsArg(s){return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' ');}
  function makeKey(name,club){
    name=clean(name); club=clean(club);
    try{if(typeof window.pKey==='function' && club)return window.pKey(name,club);}catch(e){}
    return club?name+'__'+club:name;
  }
  function addInlineDeleteButtons(){
    try{
      if(!isAdminLike()) return;
      document.querySelectorAll('#psResults .v354-record-view-btn[data-pname]').forEach(function(viewBtn){
        var wrap=viewBtn.parentElement;
        if(!wrap || wrap.querySelector('.v367-inline-delete-btn')) return;
        var name=viewBtn.getAttribute('data-pname')||'';
        var club=viewBtn.getAttribute('data-pclub')||'';
        if(!name) return;
        var btn=document.createElement('button');
        btn.type='button';
        btn.className='btn btn-danger v367-inline-delete-btn';
        btn.textContent='명단 삭제';
        btn.onclick=function(ev){
          ev.preventDefault(); ev.stopPropagation();
          if(typeof window.deletePlayerRecordDirect==='function') window.deletePlayerRecordDirect(makeKey(name,club));
          else alert('삭제 기능을 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.');
          return false;
        };
        wrap.appendChild(btn);
      });
    }catch(e){console.warn('v367 inline delete failed',e);}
  }
  var prevRenderAllP=window.renderAllP;
  if(typeof prevRenderAllP==='function'){
    window.renderAllP=function(){
      var r=prevRenderAllP.apply(this,arguments);
      setTimeout(addInlineDeleteButtons,80);
      setTimeout(addInlineDeleteButtons,300);
      return r;
    };
  }
  var prevFilterP=window.filterP;
  if(typeof prevFilterP==='function'){
    window.filterP=function(){
      var r=prevFilterP.apply(this,arguments);
      setTimeout(addInlineDeleteButtons,120);
      return r;
    };
  }
  document.addEventListener('DOMContentLoaded',function(){setTimeout(addInlineDeleteButtons,600);setTimeout(addInlineDeleteButtons,1400);});
  try{
    var mo=new MutationObserver(function(){clearTimeout(window.__v367InlineDeleteTimer);window.__v367InlineDeleteTimer=setTimeout(addInlineDeleteButtons,160);});
    mo.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  }catch(e){}
})();


/* ===== extracted from v374ParticipantNotifySmsScript ===== */
// v374: 기능 본체는 module 스크립트 안에서 직접 등록합니다. 로딩 방해 방지를 위해 DOM 전체 감시는 사용하지 않습니다.


/* ===== extracted from v383ParticipantClubSortFastScript ===== */
(function(){
  const MODE_KEY='participant_record_view_mode_v382';
  let timer=null;
  let organizing=false;
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function clubText(card){try{const el=card.querySelector('.v374-record-club');const t=(el?.getAttribute('title')||el?.textContent||'').trim();return t&&t!=='미상'?t:'소속 미상';}catch(e){return '소속 미상';}}
  function nameText(card){try{return (card.querySelector('.v374-record-name')?.textContent||'').trim();}catch(e){return '';}}
  function getMode(){try{return localStorage.getItem(MODE_KEY)||'name';}catch(e){return 'name';}}
  function toolbarHTML(mode,total){return `<div class="v382-record-toolbar" data-v382-toolbar="1" data-v382-mode="${esc(mode)}"><div class="v382-record-toolbar-title">🧾 참가자 정리 <span style="color:#64748b;font-weight:900">${Number(total||0)}명</span></div><div class="v382-record-toolbar-actions"><button type="button" class="v382-record-mode-btn ${mode==='name'?'active':''}" onclick="setParticipantRecordViewMode('name')">가나다순</button><button type="button" class="v382-record-mode-btn ${mode==='club'?'active':''}" onclick="setParticipantRecordViewMode('club')">클럽별</button></div></div>`;}
  function makeSummary(total){return `<div class="v374-record-summary">📋 전체 참가자 기록 <b>${Number(total||0)}</b>명</div>`;}
  function organize(force=false){
    const container=document.getElementById('psResults');
    if(!container||organizing) return;
    const mode=getMode();
    const existingToolbar=container.querySelector('[data-v382-toolbar="1"]');
    if(existingToolbar && existingToolbar.dataset.v382Mode===mode && !force) return;
    const allCards=[...container.querySelectorAll('.v374-record-card')];
    if(!allCards.length) return;
    organizing=true;
    try{
      const cards=allCards;
      cards.forEach(c=>c.classList.add('v382-record-card'));
      cards.sort((a,b)=>{const ca=clubText(a),cb=clubText(b); if(mode==='club'&&ca!==cb)return ca.localeCompare(cb,'ko'); return nameText(a).localeCompare(nameText(b),'ko')||ca.localeCompare(cb,'ko');});
      const frag=document.createDocumentFragment();
      const tmp=document.createElement('div');
      tmp.innerHTML=toolbarHTML(mode,cards.length)+makeSummary(cards.length);
      while(tmp.firstChild) frag.appendChild(tmp.firstChild);
      if(mode==='club'){
        const list=document.createElement('div'); list.className='v382-club-list';
        const groups=new Map();
        cards.forEach(c=>{const cl=clubText(c); if(!groups.has(cl))groups.set(cl,[]); groups.get(cl).push(c);});
        [...groups.entries()].forEach(([club,items])=>{
          const sec=document.createElement('div'); sec.className='v382-club-section';
          const head=document.createElement('div'); head.className='v382-club-head'; head.innerHTML=`<span>🏷 ${esc(club)}</span><span class="v382-club-count">${items.length}</span>`;
          const grid=document.createElement('div'); grid.className='v374-record-grid v382-record-grid v382-compact';
          items.forEach(c=>grid.appendChild(c));
          sec.appendChild(head); sec.appendChild(grid); list.appendChild(sec);
        });
        frag.appendChild(list);
      }else{
        const grid=document.createElement('div'); grid.className='v374-record-grid v382-record-grid v382-compact';
        cards.forEach(c=>grid.appendChild(c));
        frag.appendChild(grid);
      }
      container.replaceChildren(frag);
    }catch(e){console.warn('v383 participant club organizer failed',e);}finally{organizing=false;}
  }
  function schedule(force=false,delay=40){clearTimeout(timer);timer=setTimeout(()=>organize(force),delay);}
  window.v382OrganizeParticipantRecords=organize;
  window.setParticipantRecordViewMode=function(m){try{localStorage.setItem(MODE_KEY,m);}catch(e){} organize(true);};
  document.addEventListener('DOMContentLoaded',()=>schedule(false,120));
  try{
    const mo=new MutationObserver(()=>{
      if(organizing) return;
      const c=document.getElementById('psResults');
      if(!c) return;
      if(c.querySelector('[data-v382-toolbar="1"]')) return;
      schedule(false,70);
    });
    mo.observe(document.body,{childList:true,subtree:true});
  }catch(e){}
})();


/* ===== extracted from v391RecordDetailAdminActionsScript ===== */
(function(){
  function v391AddRecordDetailActions(name,club){
    try{
      if(!(typeof v374IsManagerLike==='function' && v374IsManagerLike())) return;
      const footer=document.querySelector('#mPHist .modal-footer');
      if(!footer) return;
      const safeName=(typeof v374Js==='function')?v374Js(name):String(name||'').replace(/'/g,"\\'");
      const safeClub=(typeof v374Js==='function')?v374Js(club):String(club||'').replace(/'/g,"\\'");
      const notifyBtn=`<button class="btn btn-outline" onclick="openParticipantPersonNotifySms('${safeName}','${safeClub}','')">🔔 알림/문자</button>`;
      const delBtn=(typeof isRecordDeleteAdminAllowed==='function' && isRecordDeleteAdminAllowed())
        ? `<button class="btn btn-danger" onclick="deletePlayerRecordFromList('${safeName}','${safeClub}')">🗑️ 삭제</button>` : '';
      footer.innerHTML=`${notifyBtn}${delBtn}<div style="flex:1"></div><button class="btn btn-gray" onclick="cm('mPHist')">닫기</button>`;
      footer.style.gap='8px';
      footer.style.flexWrap='wrap';
    }catch(e){console.warn('v391 detail actions failed',e);}
  }
  const prevShowP=window.showP;
  if(typeof prevShowP==='function' && !window.__v391ShowPWrapped){
    window.__v391ShowPWrapped=true;
    window.showP=function(name,club){
      const r=prevShowP.apply(this,arguments);
      setTimeout(()=>v391AddRecordDetailActions(name,club),120);
      return r;
    };
  }
})();


/* ===== extracted from v392RecordDetailNotifyFixScript ===== */
(function(){
  'use strict';
  if(window.__v392RecordDetailNotifyFix) return;
  window.__v392RecordDetailNotifyFix=true;

  var lastName='';
  var lastClub='';

  function isManagerLike(){
    try{
      return !!(window.AD || window.TM || window.OP ||
        document.body.classList.contains('admin-mode') ||
        document.body.classList.contains('tm-mode') ||
        document.body.classList.contains('operator-mode'));
    }catch(e){ return false; }
  }
  function canDeleteRecord(){
    try{
      if(typeof window.isRecordDeleteAdminAllowed==='function') return !!window.isRecordDeleteAdminAllowed();
      return !!(window.AD || window.TM || document.body.classList.contains('admin-mode') || document.body.classList.contains('tm-mode'));
    }catch(e){ return false; }
  }
  function jsArg(v){
    return String(v==null?'':v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' ');
  }
  function clean(v){ return String(v||'').replace(/\s+/g,' ').trim(); }
  function inferFromBody(){
    try{
      var body=document.getElementById('mPHistBody');
      var text=clean(body && body.innerText || '');
      var first=(text.split('\n').map(clean).filter(Boolean)[0]||'');
      first=first.replace(/^👤\s*/,'').replace(/기록\s*없음.*$/,'').trim();
      if(first && first.length<30 && !/승률|전체|출전|우승|준우승|상세/.test(first)) return first;
    }catch(e){}
    return '';
  }
  function applyFooter(name,club){
    try{
      if(name) lastName=clean(name);
      if(club) lastClub=clean(club);
      var n=lastName || inferFromBody();
      var c=lastClub || '';
      var footer=document.querySelector('#mPHist .modal-footer');
      if(!footer) return;
      if(!isManagerLike()){
        footer.classList.remove('v392-record-footer');
        footer.innerHTML='<button class="btn btn-gray" onclick="cm(\'mPHist\')">닫기</button>';
        return;
      }
      var notify='';
      if(typeof window.openParticipantPersonNotifySms==='function'){
        notify='<button type="button" class="btn btn-outline" onclick="openParticipantPersonNotifySms(\''+jsArg(n)+'\',\''+jsArg(c)+'\',\'\')">🔔 알림/문자</button>';
      }
      var del='';
      if(canDeleteRecord() && typeof window.deletePlayerRecordFromList==='function'){
        del='<button type="button" class="btn btn-danger" onclick="deletePlayerRecordFromList(\''+jsArg(n)+'\',\''+jsArg(c)+'\')">🗑️ 삭제</button>';
      }
      footer.classList.add('v392-record-footer');
      footer.innerHTML= notify + del + '<div class="v392-spacer" style="flex:1"></div><button type="button" class="btn btn-gray" onclick="cm(\'mPHist\')">닫기</button>';
    }catch(e){ console.warn('v392 record detail footer failed', e); }
  }

  var prevShowP=window.showP;
  if(typeof prevShowP==='function'){
    window.showP=function(name,club){
      lastName=clean(name); lastClub=clean(club);
      var r=prevShowP.apply(this,arguments);
      setTimeout(function(){applyFooter(lastName,lastClub);},80);
      setTimeout(function(){applyFooter(lastName,lastClub);},260);
      setTimeout(function(){applyFooter(lastName,lastClub);},700);
      return r;
    };
  }

  try{
    var mo=new MutationObserver(function(){
      var m=document.getElementById('mPHist');
      if(!m || !m.classList.contains('open')) return;
      clearTimeout(window.__v392RecordFooterTimer);
      window.__v392RecordFooterTimer=setTimeout(function(){applyFooter(lastName,lastClub);},90);
    });
    mo.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  }catch(e){}
})();


/* ===== extracted from v393PDetailNotifyFixScript ===== */
(function(){
  'use strict';
  if(window.__v393PDetailNotifyFix) return;
  window.__v393PDetailNotifyFix=true;

  var lastName='';
  var lastClub='';

  function clean(v){ return String(v||'').replace(/\s+/g,' ').trim(); }
  function jsArg(v){ return String(v==null?'':v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' '); }
  function splitKey(v){
    var s=clean(v);
    if(s.indexOf('__')>=0){ var a=s.split('__'); return {name:clean(a[0]), club:clean(a.slice(1).join('__'))}; }
    return {name:s, club:''};
  }
  function isManagerLike(modalId){
    try{
      var footer = modalId ? document.querySelector('#'+modalId+' .modal-footer') : null;
      var hasDelete = footer && /삭제|명단 삭제|기록 삭제/.test(footer.innerText||'');
      return !!(hasDelete || window.AD || window.TM || window.OP ||
        document.body.classList.contains('admin-mode') ||
        document.body.classList.contains('tm-mode') ||
        document.body.classList.contains('operator-mode'));
    }catch(e){ return false; }
  }
  function inferFromModal(modalId){
    try{
      var title = clean(document.querySelector('#'+modalId+' .modal-header h3')?.innerText||'');
      title = title.replace(/^👤\s*/,'').replace(/^참가자\s*기록$/,'').replace(/^선수\s*기록$/,'').trim();
      var body = clean(document.querySelector('#'+modalId+' .modal-body')?.innerText||'');
      var lines = body.split('\n').map(clean).filter(Boolean);
      var candidates = [title].concat(lines);
      for(var i=0;i<candidates.length;i++){
        var v = clean(candidates[i]).replace(/^👤\s*/,'');
        if(!v) continue;
        if(/참가자 기록|선수 기록|총참가|대회 이력|순위|참가|닫기|삭제|수정/.test(v)) continue;
        if(v.length>20) continue;
        return v;
      }
    }catch(e){}
    return '';
  }
  function makeNotifyButton(n,c){
    return '<button type="button" class="btn btn-outline v393-notify-btn" style="background:#eff6ff;color:#1d4ed8;border:1.5px solid #93c5fd" onclick="if(typeof openParticipantPersonNotifySms===\'function\'){openParticipantPersonNotifySms(\''+jsArg(n)+'\',\''+jsArg(c)+'\',\'\')}else if(window.toast){toast(\'알림/문자 기능을 찾지 못했습니다.\',\'error\')}">🔔 알림/문자</button>';
  }
  function makeDeleteButton(n,c){
    if(typeof window.deletePlayerRecordFromList==='function'){
      return '<button type="button" class="btn btn-danger" onclick="deletePlayerRecordFromList(\''+jsArg(n)+'\',\''+jsArg(c)+'\')">🗑️ 명단 삭제</button>';
    }
    return '';
  }
  function applyFooter(modalId,name,club){
    try{
      var footer = document.querySelector('#'+modalId+' .modal-footer');
      if(!footer) return;
      if(name){ var sp=splitKey(name); lastName=sp.name||clean(name); if(sp.club) lastClub=sp.club; }
      if(club) lastClub=clean(club);
      var n = lastName || inferFromModal(modalId);
      var c = lastClub || '';
      if(!n) return;
      if(!isManagerLike(modalId)) return;
      var existingText = footer.innerText || '';
      var closeBtn = '<button type="button" class="btn btn-gray" onclick="cm(\''+modalId+'\')">닫기</button>';
      var del = /삭제|명단 삭제|기록 삭제/.test(existingText) ? makeDeleteButton(n,c) : '';
      if(!del && modalId==='mPD' && (window.AD || window.TM || document.body.classList.contains('admin-mode') || document.body.classList.contains('tm-mode'))){
        del = makeDeleteButton(n,c);
      }
      footer.classList.add('v393-detail-footer');
      footer.innerHTML = makeNotifyButton(n,c) + del + '<div class="v393-spacer" style="flex:1"></div>' + closeBtn;
    }catch(e){ console.warn('v393 detail footer failed', e); }
  }

  var prevShowP=window.showP;
  if(typeof prevShowP==='function'){
    window.showP=function(name,club){
      var sp=splitKey(name); lastName=sp.name||clean(name); lastClub=clean(club)||sp.club||'';
      var r=prevShowP.apply(this,arguments);
      [80,240,700,1300].forEach(function(ms){setTimeout(function(){applyFooter('mPHist',lastName,lastClub);},ms);});
      return r;
    };
  }

  var prevOpenPD=window.openPD;
  if(typeof prevOpenPD==='function'){
    window.openPD=function(name,club){
      var sp=splitKey(name); lastName=sp.name||clean(name); lastClub=clean(club)||sp.club||'';
      var r=prevOpenPD.apply(this,arguments);
      Promise.resolve(r).finally(function(){
        [80,240,700,1300].forEach(function(ms){setTimeout(function(){applyFooter('mPD',lastName,lastClub);},ms);});
      });
      return r;
    };
  }

  function refreshOpenModals(){
    var pd=document.getElementById('mPD');
    var ph=document.getElementById('mPHist');
    if(pd && pd.classList.contains('open')) applyFooter('mPD',lastName,lastClub);
    if(ph && ph.classList.contains('open')) applyFooter('mPHist',lastName,lastClub);
  }
  try{
    var mo=new MutationObserver(function(){
      clearTimeout(window.__v393FooterTimer);
      window.__v393FooterTimer=setTimeout(refreshOpenModals,60);
    });
    mo.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  }catch(e){}
  document.addEventListener('DOMContentLoaded',function(){setTimeout(refreshOpenModals,300);});
})();


try{ console.info('[v989] register.js loaded'); }catch(e){}
