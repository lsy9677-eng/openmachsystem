/* v1001 clean main draw engine
 * Legacy 128/fixed-table/venue patches are removed from dev.html.
 * This module owns:
 * - individual main draw modal
 * - draw-size calculation
 * - 64-team: 64 draw, 1st rank vs 2nd rank, avoid same prelim group
 * - venue block allocation and bracket badge/color rendering
 * - main court assignment button handler
 */
(function(){
  'use strict';
  if(window.__V1001_MAIN_DRAW_INSTALLED) return;
  window.__V1001_MAIN_DRAW_INSTALLED = true;

  const TAG='[v1001-main-draw]';
  const VENUE_LABELS={gukje:'국제',neungdong:'능동',wondosim:'원도심',jangyu:'장유중',geumbyeong:'금병',samgye:'삼계',dongbu:'동부',merged:'통합',other:'기타'};
  const VENUE_COLORS={gukje:'#2563eb',neungdong:'#7c3aed',wondosim:'#16a34a',jangyu:'#dc2626',geumbyeong:'#d97706',samgye:'#0f766e',dongbu:'#475569',merged:'#0f1e3a',other:'#64748b'};
  const VENUE_BG={gukje:'#eff6ff',neungdong:'#f3e8ff',wondosim:'#ecfdf5',jangyu:'#fef2f2',geumbyeong:'#fff7ed',samgye:'#f0fdfa',dongbu:'#f8fafc',merged:'#f1f5f9',other:'#f8fafc'};

  const oldBuildMain = window.buildMain || null;
  const oldRenderBracketTree = window.renderBracketTree || null;

  let CTX=null;

  function ar(v){ return Array.isArray(v)?v:[]; }
  function clean(v){ return String(v==null?'':v).trim(); }
  function ge(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
  function toastSafe(msg,type='info'){
    try{ if(typeof toast==='function') return toast(msg,type); }catch(e){}
    try{ if(typeof toastMsg==='function') return toastMsg(msg,type); }catch(e){}
    console[type==='error'?'error':'log'](msg);
  }
  function canManageSafe(){ try{ return typeof canManageBracket==='function' ? !!canManageBracket() : true; }catch(e){ return true; } }
  function sortNatural(a,b){ return String(a).localeCompare(String(b),'ko',{numeric:true,sensitivity:'base'}); }
  function keyOf(tid,div){ return `${tid}_${div}`; }
  function keyParts(key){ const i=String(key||'').indexOf('_'); return i<0?{tid:'',div:''}:{tid:key.slice(0,i),div:key.slice(i+1)}; }
  function nextPow2(n){ let p=1; while(p<Math.max(1,Number(n)||0)) p*=2; return p; }

  function venueFromCourt(c){
    const s=clean(c).replace(/\s+/g,'');
    if(!s) return '';
    if(/원도심|원동심|wondo/i.test(s)) return 'wondosim';
    if(/능동|neung/i.test(s)) return 'neungdong';
    if(/국제|gukje|international/i.test(s)) return 'gukje';
    if(/장유중|장유|jangyu/i.test(s)) return 'jangyu';
    if(/금병|geum/i.test(s)) return 'geumbyeong';
    if(/삼계|samgye/i.test(s)) return 'samgye';
    if(/동부|dongbu/i.test(s)) return 'dongbu';
    return 'other';
  }
  function venueLabel(v){ return VENUE_LABELS[v] || clean(v) || '구장'; }
  function venueColor(v){ return VENUE_COLORS[v] || VENUE_COLORS.other; }
  function venueBg(v){ return VENUE_BG[v] || VENUE_BG.other; }

  function getTournament(tid){ try{ return ar(G&&G.tournaments).find(t=>String(t.id)===String(tid)); }catch(e){ return null; } }
  function getCfg(tid,div){
    try{ if(typeof gDS==='function') return gDS(getTournament(tid),div)||{}; }catch(e){}
    const t=getTournament(tid)||{};
    return (t.divSettings&&t.divSettings[div]) || {};
  }
  function configuredCourts(key){
    const {tid,div}=keyParts(key);
    let courts=[];
    try{ if(typeof getDivisionPhaseConfiguredCourts==='function') courts=ar(getDivisionPhaseConfiguredCourts(tid,div,'main')); }catch(e){}
    if(!courts.length){ try{ if(typeof getBracketAllowedCourts==='function') courts=ar(getBracketAllowedCourts(key)); }catch(e){} }
    if(!courts.length){
      try{
        const cfg=getCfg(tid,div);
        courts=ar(cfg.mainAllowedCourts&&cfg.mainAllowedCourts.length?cfg.mainAllowedCourts:cfg.allowedCourts);
      }catch(e){}
    }
    if(!courts.length){
      try{
        const d=G.draws&&G.draws[key];
        ar(d&&d.groups).forEach(g=>{
          ar(g.courts).forEach(c=>{ if(clean(c)) courts.push(clean(c)); });
          ['court','manualCourt','assignedCourt'].forEach(k=>{ if(clean(g&&g[k])) courts.push(clean(g[k])); });
        });
      }catch(e){}
    }
    const seen=new Set();
    return courts.map(clean).filter(Boolean).filter(c=>{ const k=c.toLowerCase(); if(seen.has(k)) return false; seen.add(k); return true; }).sort(sortNatural);
  }
  function venueCourtMap(key){
    const map={};
    configuredCourts(key).forEach(c=>{ const v=venueFromCourt(c)||'other'; (map[v]=map[v]||[]).push(c); });
    Object.keys(map).forEach(v=>map[v].sort(sortNatural));
    return map;
  }
  function orderedVenues(key){
    const map=venueCourtMap(key);
    return Object.keys(map).sort((a,b)=>(ar(map[b]).length-ar(map[a]).length)||sortNatural(venueLabel(a),venueLabel(b)));
  }
  function groupVenueMap(key){
    const out={};
    try{
      const draw=G.draws&&G.draws[key];
      ar(draw&&draw.groups).forEach((g,gi)=>{
        let c=clean(ar(g&&g.courts)[0] || g?.court || g?.manualCourt || g?.assignedCourt || '');
        if(!c){
          const mm=ar(G.matches&&G.matches[key]).find(m=>m&&String(m.phase)==='group'&&Number(m.group)===gi&&clean(m.court));
          c=clean(mm&&mm.court);
        }
        out[gi]=venueFromCourt(c)||'';
      });
    }catch(e){}
    return out;
  }
  function entryVenue(key,e){ const gi=Number(e&&e.gn)-1; return groupVenueMap(key)[gi]||''; }

  function groupLabelSafe(gi){ try{ if(typeof grpLabel==='function') return grpLabel(gi); }catch(e){} return `${Number(gi)+1}조`; }
  function teamName(key,ti){
    try{
      const t=ar(G.teams&&G.teams[key])[Number(ti)];
      if(t && typeof getMainBracketDisplayName==='function') return getMainBracketDisplayName(key,t,Number(ti));
      if(t && typeof tdn==='function') return tdn(t,key,Number(ti));
      if(t) return clean(t.name||t.teamName||t.club||t.players?.join('/'));
    }catch(e){}
    return ti==null?'':`#${Number(ti)+1}`;
  }
  function entryLabel(e){
    if(!e) return '';
    if(clean(e._label)) return clean(e._label);
    if(clean(e.nm)) return clean(e.nm);
    const gn=Number(e.gn||0), rk=Number(e.rk||0);
    if(gn&&rk) return `${groupLabelSafe(gn-1)} ${rk}위`;
    return 'TBD';
  }

  function fallbackAdvEntries(key){
    const out=[];
    try{
      const {tid,div}=keyParts(key); const cfg=getCfg(tid,div);
      const draw=G.draws&&G.draws[key]; const teams=ar(G.teams&&G.teams[key]);
      const adv=Math.max(1,Number(draw?.advance||cfg.advance||2));
      ar(draw&&draw.groups).forEach((g,gi)=>{
        let ranked=[];
        try{ if(typeof calcGS==='function') ranked=ar(calcGS(key,gi,g.teams,teams)); }catch(e){}
        if(!ranked.length) ranked=ar(g.teams).map((ti,idx)=>({ti,rank:idx+1}));
        ranked.slice(0,adv).forEach((r,idx)=>{
          const ti=Number(r.ti!=null?r.ti:r.teamIndex!=null?r.teamIndex:r.idx!=null?r.idx:r);
          out.push({ti:Number.isFinite(ti)?ti:null, gn:gi+1, rk:idx+1, nm:teamName(key,ti)});
        });
      });
    }catch(e){}
    return out;
  }
  function getAdvEntries(key){
    const {tid,div}=keyParts(key); const cfg=getCfg(tid,div); const draw=G.draws&&G.draws[key]; const teams=ar(G.teams&&G.teams[key]);
    let raw=[];
    try{ if(typeof getAdvT==='function') raw=ar(getAdvT(key,draw,teams,cfg)); }catch(e){ console.warn(TAG,'getAdvT failed',e); }
    if(!raw.length) raw=fallbackAdvEntries(key);
    return raw.map((e,i)=>{
      const gn=Number(e.gn||e.groupNo||e.group||0);
      const rk=Number(e.rk||e.rank||e.rankNo||0);
      const ti=e.ti!=null?Number(e.ti):(e.teamIndex!=null?Number(e.teamIndex):null);
      const o={...e, ti:Number.isFinite(ti)?ti:null, gn, rk, _idx:i};
      o._label=entryLabel(o);
      o._prelimVenue=entryVenue(key,o);
      return o;
    }).filter(e=>e && (e.ti!=null || clean(e._label)));
  }

  function rotateAvoidSameGroup(rank1, rank2){
    const n=Math.min(rank1.length,rank2.length);
    if(!n) return rank2.slice();
    for(let off=1; off<n; off++){
      let ok=true;
      for(let i=0;i<n;i++) if(Number(rank1[i]?.gn)===Number(rank2[(i+off)%n]?.gn)){ ok=false; break; }
      if(ok) return rank2.map((_,i)=>rank2[(i+off)%n]);
    }
    return rank2.slice().reverse();
  }
  function splitCounts(total, venues, map){
    const out={}; if(!venues.length) return out;
    const totalCourts=venues.reduce((s,v)=>s+Math.max(1,ar(map[v]).length),0)||venues.length;
    let used=0;
    venues.forEach((v,idx)=>{ if(idx===venues.length-1){ out[v]=Math.max(0,total-used); } else { const n=Math.round(total*(Math.max(1,ar(map[v]).length)/totalCourts)); out[v]=n; used+=n; } });
    let diff=total-Object.values(out).reduce((a,b)=>a+b,0), i=0;
    while(diff!==0 && i<1000){ const v=venues[i%venues.length]; if(diff>0){out[v]++;diff--;} else if(out[v]>0){out[v]--;diff++;} i++; }
    return out;
  }
  function venueForPairsBalanced(key,pairs){
    const map=venueCourtMap(key); const venues=orderedVenues(key); if(!venues.length) return pairs.map(p=>({...p,venue:'merged'}));
    const counts=splitCounts(pairs.length,venues,map); let idx=0;
    venues.forEach(v=>{ for(let i=0;i<(counts[v]||0)&&idx<pairs.length;i++,idx++) pairs[idx].venue=v; });
    for(;idx<pairs.length;idx++) pairs[idx].venue=venues[0];
    return pairs;
  }
  function makePairs64(key,entries,mode){
    let pairs=[];
    function build(list,forcedVenue){
      const r1=list.filter(e=>Number(e.rk)===1).sort((a,b)=>Number(a.gn)-Number(b.gn));
      const r2=list.filter(e=>Number(e.rk)===2).sort((a,b)=>Number(a.gn)-Number(b.gn));
      const rr2=rotateAvoidSameGroup(r1,r2);
      const n=Math.min(r1.length,rr2.length);
      for(let i=0;i<n;i++) pairs.push({a:r1[i],b:rr2[i],venue:forcedVenue});
      const rest=[...r1.slice(n),...rr2.slice(n),...list.filter(e=>Number(e.rk)!==1&&Number(e.rk)!==2)];
      for(let i=0;i<rest.length;i+=2) pairs.push({a:rest[i],b:rest[i+1]||null,venue:forcedVenue});
    }
    if(mode==='keep'){
      const by={}; entries.forEach(e=>{ const v=e._prelimVenue||'merged'; (by[v]=by[v]||[]).push(e); });
      const venues=orderedVenues(key); [...venues,...Object.keys(by).filter(v=>!venues.includes(v))].forEach(v=>{ if(by[v]) build(by[v],v); });
    }else{
      build(entries,null); venueForPairsBalanced(key,pairs);
    }
    return pairs;
  }
  function makeGenericPairs(key,entries,drawSize,mode){
    const byeCount=Math.max(0,drawSize-entries.length);
    const r1=entries.filter(e=>Number(e.rk)===1).sort((a,b)=>Number(a.gn)-Number(b.gn));
    const rest=entries.filter(e=>Number(e.rk)!==1).sort((a,b)=>Number(a.rk)-Number(b.rk)||Number(a.gn)-Number(b.gn));
    const pairs=[];
    for(let i=0;i<byeCount;i++) pairs.push({a:r1.shift()||rest.shift()||null,b:null,bye:true,venue:null});
    const pool=[...r1,...rest];
    for(let i=0;i<pool.length;i+=2) pairs.push({a:pool[i],b:pool[i+1]||null,bye:!pool[i+1],venue:null});
    if(mode==='keep') pairs.forEach(p=>{p.venue=(p.a&&p.a._prelimVenue)||(p.b&&p.b._prelimVenue)||'merged';}); else venueForPairsBalanced(key,pairs);
    return pairs;
  }
  function makeRound0(key,p,i,drawSize){
    const a=p.a||null,b=p.b||null,bye=!!p.bye||!b;
    const venue=p.venue || (a&&a._prelimVenue) || (b&&b._prelimVenue) || 'merged';
    return {id:`v1001_main_r0_${i}`,phase:'main',round:0,slot:i,t1:a&&a.ti!=null?Number(a.ti):null,t2:!bye&&b&&b.ti!=null?Number(b.ti):null,winner:bye&&a&&a.ti!=null?Number(a.ti):null,rubbers:[],bye,bracketN:drawSize,localDrawSize:drawSize,source1Label:a?entryLabel(a):'',source2Label:bye?'부전승':(b?entryLabel(b):''),sourceGroup1:a?.gn?Number(a.gn)-1:null,sourceRank1:a?.rk?Number(a.rk):null,sourceGroup2:b?.gn?Number(b.gn)-1:null,sourceRank2:b?.rk?Number(b.rk):null,court:'',courts:[],venue,__venue:venue,venueLocked:venue!=='merged',mainBlock:venue,v1001CleanMainDraw:true};
  }
  function buildUpper(round0,drawSize){
    const out=[]; let prev=round0, r=1;
    while(prev.length>1){
      const next=[];
      for(let i=0;i<prev.length;i+=2){
        const a=prev[i],b=prev[i+1]; const venue=(a&&b&&a.venue===b.venue)?a.venue:'merged';
        const m={id:`v1001_main_r${r}_${Math.floor(i/2)}`,phase:'main',round:r,slot:Math.floor(i/2),t1:null,t2:null,winner:null,rubbers:[],bye:false,bracketN:drawSize,localDrawSize:drawSize,source1Label:`승자 ${a?Number(a.slot)+1:''}경기`,source2Label:`승자 ${b?Number(b.slot)+1:''}경기`,court:'',courts:[],venue,__venue:venue,venueLocked:venue!=='merged',mainBlock:venue,v1001CleanMainDraw:true};
        next.push(m); out.push(m);
      }
      prev=next; r++;
    }
    return out;
  }
  function buildMatches(key,entries,mode){
    const drawSize=nextPow2(entries.length);
    const pairs= entries.length===64 ? makePairs64(key,entries,mode) : makeGenericPairs(key,entries,drawSize,mode);
    const r0=pairs.map((p,i)=>makeRound0(key,p,i,drawSize));
    return [...r0,...buildUpper(r0,drawSize)];
  }

  function ensureModal(){
    if(ge('v1001MainDrawModal')) return;
    const wrap=document.createElement('div'); wrap.id='v1001MainDrawModal'; wrap.className='modal-overlay';
    wrap.innerHTML=`<div class="modal-box" style="max-width:640px"><div class="modal-header"><h3>🏆 본선 추첨</h3><button class="modal-close" onclick="v1001CloseMainDrawModal()">✕</button></div><div class="modal-body"><div id="v1001MainSummary" style="padding:12px 14px;background:linear-gradient(135deg,#eef4ff,#fffaf0);border:1px solid var(--border);border-radius:12px;font-size:.84rem;line-height:1.75;margin-bottom:12px"></div><div style="padding:12px 14px;border:1.5px solid #d4a017;border-radius:14px;background:#fffaf0;margin-bottom:12px"><div style="font-weight:1000;color:#8a6412;margin-bottom:8px">🏟️ 본선 구장 운영 방식</div><label style="display:flex;gap:8px;align-items:flex-start;margin:8px 0;font-size:.84rem;line-height:1.45;cursor:pointer"><input type="radio" name="v1001VenueMode" value="balanced" checked style="margin-top:3px;accent-color:#d4a017"><span><b>전체 재배정</b><br><span style="color:#64748b">코트 수가 많은 구장부터 본선 대진 위쪽 구간에 순서대로 배정합니다.</span></span></label><label style="display:flex;gap:8px;align-items:flex-start;margin:8px 0;font-size:.84rem;line-height:1.45;cursor:pointer"><input type="radio" name="v1001VenueMode" value="keep" style="margin-top:3px;accent-color:#16a34a"><span><b>예선 구장 유지</b><br><span style="color:#64748b">예선 구장별로 본선 구간을 나눠 이동 없이 운영합니다.</span></span></label></div><label style="display:flex;gap:8px;align-items:center;font-size:.82rem;color:#64748b"><input type="checkbox" id="v1001MainTestOnly"> 테스트 연출만 보기</label></div><div class="modal-footer"><button class="btn btn-gray" onclick="v1001CloseMainDrawModal()">취소</button><button class="btn btn-accent" onclick="v1001StartMainDraw()">🎲 본선 추첨 확정</button></div></div>`;
    document.body.appendChild(wrap);
  }
  window.v1001CloseMainDrawModal=function(){ const el=ge('v1001MainDrawModal'); if(el) el.classList.remove('open'); };
  function openModal(tid,div){
    const key=keyOf(tid,div); const entries=getAdvEntries(key); const drawSize=nextPow2(entries.length); const venues=orderedVenues(key);
    CTX={tid,div,key,entries}; ensureModal();
    const s=ge('v1001MainSummary');
    if(s){
      const r1=entries.filter(e=>Number(e.rk)===1).length, r2=entries.filter(e=>Number(e.rk)===2).length;
      s.innerHTML=`<b>${esc(div)}</b> 본선 진출 ${entries.length}팀 · <b>${drawSize}드로</b><br>조1위 ${r1}팀 / 조2위 ${r2}팀${entries.length===64?' · 64팀은 부전승 없이 조1위 vs 조2위로 배정':''}<br>사용 구장: ${venues.length?venues.map(venueLabel).join(' / '):'미설정'}`;
    }
    const el=ge('v1001MainDrawModal'); if(el) el.classList.add('open');
  }
  window.v1001StartMainDraw=async function(){
    if(!CTX){ toastSafe('본선 추첨 정보를 찾을 수 없습니다','error'); return; }
    if(!canManageSafe()){ toastSafe('본선 추첨 권한이 없습니다','error'); return; }
    const {key,entries}=CTX;
    if(entries.length<2){ toastSafe('본선 진출팀이 부족합니다','error'); return; }
    const mode=(document.querySelector('input[name="v1001VenueMode"]:checked')?.value==='keep')?'keep':'balanced';
    const testOnly=!!ge('v1001MainTestOnly')?.checked;
    window.v1001CloseMainDrawModal();
    if(testOnly){ toastSafe('테스트 선택 상태입니다. 실제 저장은 하지 않았습니다.','info'); return; }
    const matches=buildMatches(key,entries,mode);
    const nonMain=ar(G.matches&&G.matches[key]).filter(m=>m && String(m.phase)!=='main' && String(m.phase)!=='playin');
    G.matches[key]=[...nonMain,...matches];
    if(!G.draws) G.draws={}; if(!G.draws[key]) G.draws[key]={};
    Object.assign(G.draws[key],{v1001CleanMainDraw:{mode,drawSize:nextPow2(entries.length),entryCount:entries.length,createdAt:new Date().toISOString()},mainUpdatedAt:new Date().toISOString()});
    // legacy main flags that caused 128/fixed preview confusion
    ['mainBracketFixed','manualMainOperational','mainBracketLocked','mainManual128Json','manual128Json','v918ExactByeDraw','v822ModernCupLock','v784FixedDraw','v785ByeCount32','v786VenueSplit'].forEach(k=>{ try{ delete G.draws[key][k]; }catch(e){} });
    try{ if(typeof sl==='function') sl(true); }catch(e){}
    try{
      await Promise.all([(typeof stM==='function'?stM(key):Promise.resolve()),(typeof stD==='function'?stD(key):Promise.resolve())]);
      toastSafe(`${nextPow2(entries.length)}드로 본선 추첨 완료 ✅${mode==='keep'?' · 예선 구장 유지':' · 전체 재배정'}`,'success');
      try{ if(typeof renderBracket==='function') renderBracket(); }catch(e){}
    }catch(e){ console.error(TAG,e); toastSafe('본선 추첨 저장 실패: '+(e.message||e),'error'); }
    finally{ try{ if(typeof sl==='function') sl(false); }catch(e){} }
  };

  function nameForSide(key,m,side,teams){
    const label=clean(side===1?m.source1Label:m.source2Label); const ti=side===1?m.t1:m.t2;
    if(label) return label;
    return ti==null?'TBD':teamName(key,ti);
  }
  function renderCleanTree(key,mMs,teams){
    const list=ar(mMs).filter(m=>m&&m.v1001CleanMainDraw).map(m=>({...m,round:Number(m.round||0),slot:Number(m.slot||0)}));
    if(!list.length && typeof oldRenderBracketTree==='function') return oldRenderBracketTree.apply(this,arguments);
    const rounds=[...new Set(list.map(m=>m.round))].sort((a,b)=>a-b);
    const roundCount=rounds.length;
    const cols=rounds.map(r=>list.filter(m=>m.round===r).sort((a,b)=>a.slot-b.slot));
    const title=(ri)=> ri===roundCount-1?'결승':ri===roundCount-2?'준결승':`${Math.pow(2,roundCount-ri)}강`;
    const card=(m,ri)=>{
      const v=m.venue||'merged', c=venueColor(v), bg=venueBg(v); const n1=nameForSide(key,m,1,teams), n2=m.bye?'부전승':nameForSide(key,m,2,teams);
      return `<div class="v1001-br-card" style="border:1.5px solid ${c};border-left:7px solid ${c};background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(15,30,58,.10);margin:0 0 10px 0;min-width:182px"><div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:5px 8px;background:${bg};border-bottom:1px solid rgba(15,30,58,.08)"><span style="font-size:.68rem;font-weight:1000;color:${c}">🏟️ ${venueLabel(v)}</span><span style="font-size:.62rem;color:#64748b;font-weight:900">${ri===0?`${m.slot+1}경기`:''}</span></div><div style="padding:7px 9px;font-size:.78rem;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n1)}</div><div style="padding:7px 9px;font-size:.78rem;font-weight:800;color:${m.bye?'#a16207':'#0f172a'};background:${m.bye?'#fffbeb':'#fff'};border-top:1px solid #e5eaf3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n2)}</div></div>`;
    };
    return `<div class="v1001-bracket" style="display:flex;gap:28px;align-items:flex-start;overflow-x:auto;padding:8px 4px 18px">${cols.map((col,ri)=>`<div style="min-width:190px"><div style="text-align:center;background:#0f1e3a;color:#fff;border-radius:8px;padding:6px 8px;margin-bottom:10px;font-weight:1000;font-size:.78rem">${title(ri)}</div>${col.map(m=>card(m,ri)).join('')}</div>`).join('')}</div>`;
  }

  function assignedCourts(m){ const a=ar(m&&m.courts).map(clean).filter(Boolean); if(a.length) return a; return clean(m&&m.court)?[clean(m.court)]:[]; }
  function isOpen(m){ return m && !m.bye && m.winner==null; }
  async function assignMainCourtsClean(key){
    if(!key || !(G&&G.matches&&G.matches[key])) return false;
    const map=venueCourtMap(key); const venues=orderedVenues(key); if(!venues.length){ toastSafe('본선 사용 코트가 없습니다','error'); return false; }
    const counts={}; Object.values(map).flat().forEach(c=>counts[c]=0);
    ar(G.matches[key]).forEach(m=>{ if(!isOpen(m)) return; assignedCourts(m).forEach(c=>{ if(counts[c]!=null) counts[c]++; }); });
    const pending=ar(G.matches[key]).filter(m=>m&&m.v1001CleanMainDraw&&String(m.phase)==='main'&&Number(m.round||0)===0&&isOpen(m)&&!assignedCourts(m).length).sort((a,b)=>Number(a.slot)-Number(b.slot));
    if(!pending.length){ toastSafe('배정할 본선 경기가 없거나 이미 배정되어 있습니다','info'); return false; }
    const base=Date.now(); let tick=0; const stamp=()=>new Date(base+(tick++)).toISOString(); let changed=false;
    const by={}; pending.forEach(m=>{ const v=m.venue||venues[0]; (by[v]=by[v]||[]).push(m); });
    venues.forEach(v=>{
      const courts=ar(map[v]); const list=by[v]||[]; if(!courts.length) return;
      list.forEach(m=>{
        const target=courts.slice().sort((a,b)=>Number(counts[a]||0)-Number(counts[b]||0)||sortNatural(a,b))[0];
        const n=Number(counts[target]||0); const now=stamp();
        if(n<2){ m.court=target; m.courts=[target]; m.courtAssignedAt=now; m.courtQueueOrder=now; if(n>=1)m.waitingFirstAt=now; counts[target]=n+1; }
        else { m.court=''; m.courts=[]; m.sharedQueue=true; m.courtQueueOrder=now; }
        m.venue=v; m.__venue=v; m.venueLocked=true; m.mainBlock=v; changed=true;
      });
    });
    try{ if(typeof sl==='function') sl(true); }catch(e){}
    try{ if(changed && typeof stM==='function') await stM(key); toastSafe('본선 코트 배정 완료 ✅','success'); try{ if(typeof renderBracket==='function') renderBracket(); }catch(e){} return changed; }
    catch(e){ console.error(TAG,e); toastSafe('본선 코트 배정 저장 실패: '+(e.message||e),'error'); return false; }
    finally{ try{ if(typeof sl==='function') sl(false); }catch(e){} }
  }

  window.v1001OpenMainDraw=function(tid,div){ openModal(tid,div); };
  window.buildMain=function(tid,div){
    try{ const t=getTournament(tid); if(t && typeof isIndividualTournament==='function' && isIndividualTournament(t)) return openModal(tid,div); }catch(e){}
    if(typeof oldBuildMain==='function') return oldBuildMain.apply(this,arguments);
  };
  try{ buildMain=window.buildMain; }catch(e){}
  window.renderBracketTree=function(key,mMs,teams){ return renderCleanTree(key,mMs,teams); };
  try{ renderBracketTree=window.renderBracketTree; }catch(e){}
  window.v1001RunMainAssign=assignMainCourtsClean;
  window.v773RunMainAssign=assignMainCourtsClean;
  try{ v773RunMainAssign=assignMainCourtsClean; }catch(e){}

  console.log(TAG,'installed clean engine; legacy main draw patches removed');
})();
