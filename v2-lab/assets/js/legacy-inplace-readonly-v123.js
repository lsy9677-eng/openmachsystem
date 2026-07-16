(() => {
  'use strict';
  const VERSION='1.23.0', STORAGE_KEY='230match-main-v2-approved-handoff-v1';
  const $=id=>document.getElementById(id), arr=v=>Array.isArray(v)?v:[], text=v=>String(v??'').trim();
  let frameReady=false,currentPackage=null,snapshot=null;

  function readPackage(){
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) throw new Error('V2 승인 패키지가 없습니다.');
    const pkg=JSON.parse(raw);
    if(!pkg?.state?.draw) throw new Error('V2 대진 상태가 없습니다.');
    return pkg;
  }
  function matches(draw){
    if(!draw?.rounds) return [];
    return Object.entries(draw.rounds).sort((a,b)=>Number(b[0])-Number(a[0]))
      .flatMap(([roundSize,list])=>arr(list).map(m=>({...m,roundSize:Number(m.roundSize||roundSize)})));
  }
  function teamName(v,teams){
    if(!v) return 'TBD';
    if(typeof v==='object'){
      const id=v.id||v.teamId||v.key||v.uid||'';
      if(id){ const found=teams.find(t=>String(t.id||t.teamId||t.key||t.uid||'')===String(id)); if(found&&found!==v) return teamName(found,[]); }
      const players=[v.player1,v.player2,v.p1,v.p2].filter(Boolean).map(p=>typeof p==='string'?p:(p.name||p.playerName||p.label||'')).filter(Boolean).join(' / ');
      return text(v.name||v.teamName||v.label||v.displayName||v.playersText||v.nm||players||id||'팀명 없음');
    }
    const key=String(v), found=teams.find(t=>String(t.id||t.teamId||t.key||t.uid||'')===key);
    return found?teamName(found,[]):key;
  }
  function validate(pkg){
    const state=pkg.state||{}, list=matches(state.draw), byId=new Map(list.map(m=>[m.id,m])), seen=new Set(), errors=[];
    arr(state.courts).forEach(c=>['playing','wait1'].forEach(slot=>{const id=c?.[slot];if(!id)return;if(!byId.has(id))errors.push(`${c.name} ${slot} 경기 없음: ${id}`);if(seen.has(id))errors.push(`경기 중복 배치: ${id}`);seen.add(id);}));
    arr(state.sharedQueue).forEach(id=>{if(!byId.has(id))errors.push(`공용대기 경기 없음: ${id}`);if(seen.has(id))errors.push(`경기 중복 배치: ${id}`);seen.add(id);});
    const expected=Math.max(0,Number(state.draw?.size||0)-1); if(expected&&list.length!==expected) errors.push(`전체 경기 수 불일치: ${list.length}/${expected}`);
    return {ok:!errors.length,errors:[...new Set(errors)],summary:{drawSize:Number(state.draw?.size||0),matches:list.length,courts:arr(state.courts).length,playing:list.filter(m=>m.status==='playing').length,wait1:list.filter(m=>m.status==='court_wait1').length,sharedQueue:arr(state.sharedQueue).length}};
  }
  function doc(){const f=$('legacyFrame');if(!f?.contentDocument)throw new Error('기존 앱이 준비되지 않았습니다.');return f.contentDocument;}
  function findByText(d,phrase){const all=[...d.querySelectorAll('section,article,div,main')].filter(el=>text(el.innerText||el.textContent).includes(phrase));all.sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length);return all[0]||null;}
  function locate(d){const court=d.querySelector('[data-v2-court-board-target]')||findByText(d,'코트 사용 현황판');if(!court)throw new Error('코트 사용 현황판을 찾지 못했습니다.');let shared=d.querySelector('[data-v2-shared-queue-target]')||findByText(d,'공용대기');if(shared&&court.contains(shared))shared=null;return{court,shared};}
  function ensureStyle(d){if(d.getElementById('v2InplaceReadonlyStyle'))return;const s=d.createElement('style');s.id='v2InplaceReadonlyStyle';s.textContent=`
    .v2ip-banner{margin:10px 0 12px;padding:10px 12px;border:1px solid #e5b53b;border-radius:10px;background:#fff7da;color:#644b00;font-weight:700}
    .v2ip-tag{display:inline-block;padding:4px 8px;border-radius:999px;background:#dff8e5;color:#176b2b;font-size:12px;font-weight:800}
    .v2ip-grid,.v2ip-qgrid{display:grid;grid-template-columns:repeat(4,minmax(220px,1fr));gap:10px}
    .v2ip-court{border:2px solid #2f69e9;border-radius:14px;overflow:hidden;background:#f7faff}.v2ip-court header{background:#2f69e9;color:#fff;padding:11px 12px;display:flex;justify-content:space-between}
    .v2ip-slot{padding:12px;display:grid;gap:5px;min-height:100px}.v2ip-slot+.v2ip-slot{border-top:1px solid #d6e0f2;background:#fffaf1}.v2ip-slot small,.v2ip-slot em,.v2ip-q em{color:#6a7890}.v2ip-slot em,.v2ip-q em{font-style:normal;font-size:12px}
    .v2ip-shared{margin-top:16px}.v2ip-q{display:grid;grid-template-columns:28px 1fr;gap:4px 8px;padding:10px;border:1px solid #cbd9ee;border-radius:10px;background:#f8fbff}.v2ip-q span{grid-row:1/3;width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#11264a;color:#fff;font-weight:800}
    @media(max-width:1100px){.v2ip-grid,.v2ip-qgrid{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.v2ip-grid,.v2ip-qgrid{grid-template-columns:1fr}}`;
    d.head.appendChild(s);
  }
  function markup(pkg,report){
    const state=pkg.state, teams=arr(state.importedTeams), list=matches(state.draw), byId=new Map(list.map(m=>[m.id,m]));
    const courts=arr(state.courts).map(c=>{const p=c.playing?byId.get(c.playing):null,w=c.wait1?byId.get(c.wait1):null;return `<article class="v2ip-court"><header><strong>🚀 ${c.name}</strong><span>${p?'시합중':'빈코트'}</span></header><div class="v2ip-slot"><small>시합중</small><b>${p?`${teamName(p.teamA,teams)} vs ${teamName(p.teamB,teams)}`:'배정된 진행 경기 없음'}</b><em>${p?`${p.roundSize}강 · ${p.id}`:'-'}</em></div><div class="v2ip-slot"><small>대기 1번</small><b>${w?`${teamName(w.teamA,teams)} vs ${teamName(w.teamB,teams)}`:'대기중 경기 없음'}</b><em>${w?`${w.roundSize}강 · ${w.id}`:'-'}</em></div></article>`;}).join('');
    const queue=arr(state.sharedQueue).map((id,i)=>{const m=byId.get(id);return `<div class="v2ip-q"><span>${i+1}</span><b>${m?`${teamName(m.teamA,teams)} vs ${teamName(m.teamB,teams)}`:id}</b><em>${m?`${m.roundSize}강 · ${id}`:'경기 없음'}</em></div>`;}).join('');
    return `<div id="v2InplaceReadonlyRoot"><div class="v2ip-banner"><span class="v2ip-tag">V2 읽기 전용</span> 기존 본선 영역의 표시 데이터만 V2로 교체했습니다. 버튼·결과 입력·Firebase·window.G는 변경되지 않습니다. 경기 ${report.summary.matches} · 코트 ${report.summary.courts} · 시합중 ${report.summary.playing} · 대기1 ${report.summary.wait1} · 공용대기 ${report.summary.sharedQueue}</div><div class="v2ip-grid">${courts}</div><section class="v2ip-shared"><h3>공용대기 ${state.sharedQueue?.length||0}경기</h3><div class="v2ip-qgrid">${queue}</div></section></div>`;
  }
  function apply(){
    const pkg=currentPackage||readPackage(), report=validate(pkg); if(!report.ok)throw new Error(report.errors.join(' / '));
    const d=doc();ensureStyle(d);const {court,shared}=locate(d);if(!snapshot)snapshot={court,courtHTML:court.innerHTML,shared,sharedHTML:shared?shared.innerHTML:null};
    court.innerHTML=markup(pkg,report);court.dataset.v2InplaceActive='true';if(shared&&shared!==court){shared.style.display='none';shared.dataset.v2InplaceHidden='true';}
    $('integrationState').textContent='V2 실제 영역 표시 ON';$('integrationState').className='state on';$('summary').textContent=`${pkg.target?.tournamentName||'-'} · ${pkg.target?.division||'-'} · ${report.summary.drawSize}강 · 경기 ${report.summary.matches} · 읽기 전용`;
  }
  function restore(){if(!snapshot)return;const {court,courtHTML,shared,sharedHTML}=snapshot;if(court?.isConnected){court.innerHTML=courtHTML;delete court.dataset.v2InplaceActive;}if(shared?.isConnected){if(sharedHTML!=null)shared.innerHTML=sharedHTML;shared.style.display='';delete shared.dataset.v2InplaceHidden;}snapshot=null;$('integrationState').textContent='V2 실제 영역 표시 OFF';$('integrationState').className='state off';$('summary').textContent='기존 앱 원본 화면으로 복구했습니다.';}
  function boot(){
    const frame=$('legacyFrame');frame.addEventListener('load',()=>{frameReady=true;snapshot=null;$('frameState').textContent='기존 앱 로드 완료';$('frameState').className='state on';});
    $('readPackageBtn').onclick=()=>{try{currentPackage=readPackage();const r=validate(currentPackage);$('packageState').textContent=r.ok?'V2 패키지 정상':'V2 패키지 오류';$('packageState').className=r.ok?'state on':'state error';$('summary').textContent=r.ok?`${currentPackage.target?.tournamentName||'-'} · ${currentPackage.target?.division||'-'} · ${r.summary.drawSize}강 · 경기 ${r.summary.matches}`:r.errors.join(' / ');}catch(e){alert(e.message);}};
    $('applyBtn').onclick=()=>{try{if(!frameReady)throw new Error('기존 앱이 아직 로드되지 않았습니다.');apply();}catch(e){alert(e.message);}};
    $('restoreBtn').onclick=restore;$('reloadBtn').onclick=()=>{restore();frame.contentWindow.location.reload();};
    try{currentPackage=readPackage();const r=validate(currentPackage);$('packageState').textContent=r.ok?'V2 패키지 정상':'V2 패키지 오류';$('packageState').className=r.ok?'state on':'state error';}catch(_){ }
    console.log(`[V2-INPLACE-READONLY] v${VERSION} ready · actual legacy area · no writes`);
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
