/* v1000 clean main draw engine
 * - 64 teams => 64 draw, no byes
 * - first round rank1 vs rank2, avoid same preliminary group
 * - main draw venue mode: balanced / keep prelim venue
 * - bracket cards get venue badges/colors via custom render for v1000 matches
 * - main court assignment button uses clean engine and does not auto-insert on draw
 */
(function(){
  'use strict';
  if(window.__V1000_MAIN_DRAW_INSTALLED) return;
  window.__V1000_MAIN_DRAW_INSTALLED = true;

  const TAG='[v1000-main-draw]';
  const VENUE_LABELS={gukje:'국제',neungdong:'능동',wondosim:'원도심',jangyu:'장유중',geumbyeong:'금병',samgye:'삼계',dongbu:'동부',merged:'통합',other:'기타'};
  const VENUE_COLORS={
    gukje:'#2563eb', neungdong:'#7c3aed', wondosim:'#16a34a', jangyu:'#dc2626',
    geumbyeong:'#d97706', samgye:'#0f766e', dongbu:'#475569', merged:'#0f1e3a', other:'#64748b'
  };
  const VENUE_BG={
    gukje:'#eff6ff', neungdong:'#f3e8ff', wondosim:'#ecfdf5', jangyu:'#fef2f2',
    geumbyeong:'#fff7ed', samgye:'#f0fdfa', dongbu:'#f8fafc', merged:'#f1f5f9', other:'#f8fafc'
  };

  const oldOpenIndividual = window.openIndividualMainDraw || null;
  const oldRenderTree = window.renderBracketTree || null;

  function ar(v){ return Array.isArray(v)?v:[]; }
  function clean(v){ return String(v==null?'':v).trim(); }
  function ge(id){ return document.getElementById(id); }
  function toastSafe(msg,type='info'){
    try{ if(typeof toast==='function') return toast(msg,type); }catch(e){}
    try{ if(typeof toastMsg==='function') return toastMsg(msg,type); }catch(e){}
    console[type==='error'?'error':'log'](msg);
  }
  function canManageSafe(){ try{ return typeof canManageBracket==='function' ? !!canManageBracket() : (typeof canManage==='function' ? !!canManage() : true); }catch(e){ return true; } }
  function nextPow2(n){ let p=1; while(p<Math.max(1,Number(n)||0)) p*=2; return p; }
  function getKeyParts(key){ const a=String(key||'').split('_'); return {tid:a[0]||'', div:a.slice(1).join('_')||''}; }
  function sortNatural(a,b){ return String(a).localeCompare(String(b),'ko',{numeric:true,sensitivity:'base'}); }

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

  function configuredCourts(key){
    const {tid,div}=getKeyParts(key);
    let courts=[];
    try{ if(typeof getDivisionPhaseConfiguredCourts==='function') courts=ar(getDivisionPhaseConfiguredCourts(tid,div,'main')); }catch(e){}
    if(!courts.length){ try{ if(typeof getBracketAllowedCourts==='function') courts=ar(getBracketAllowedCourts(key)); }catch(e){} }
    if(!courts.length){
      try{
        const d=window.G&&G.draws&&G.draws[key];
        ar(d&&d.groups).forEach(g=>{
          ar(g.courts).forEach(c=>{ if(clean(c)) courts.push(clean(c)); });
          if(clean(g.court)) courts.push(clean(g.court));
        });
      }catch(e){}
    }
    const seen=new Set();
    return courts.map(clean).filter(Boolean).filter(c=>{ const k=c.toLowerCase(); if(seen.has(k)) return false; seen.add(k); return true; }).sort(sortNatural);
  }

  function venueCourtMap(key){
    const map={};
    configuredCourts(key).forEach(c=>{
      const v=venueFromCourt(c)||'other';
      (map[v]=map[v]||[]).push(c);
    });
    Object.keys(map).forEach(v=>map[v].sort(sortNatural));
    return map;
  }
  function orderedVenues(key){
    const map=venueCourtMap(key);
    return Object.keys(map).sort((a,b)=> (map[b].length-map[a].length) || sortNatural(venueLabel(a), venueLabel(b)) );
  }
  function groupVenueMap(key){
    const out={};
    try{
      const d=G.draws[key];
      ar(d&&d.groups).forEach((g,idx)=>{
        let c=clean(ar(g.courts)[0]||g.court||'');
        if(!c){
          const ms=ar(G.matches&&G.matches[key]).find(m=>m&&String(m.phase)==='group'&&Number(m.group)===idx&&clean(m.court));
          c=clean(ms&&ms.court);
        }
        out[idx]=venueFromCourt(c)||'';
      });
    }catch(e){}
    return out;
  }
  function entryVenue(key,e){
    const gm=groupVenueMap(key);
    const gi=Number(e&&e.gn)!=null ? Number(e.gn)-1 : -1;
    return gm[gi] || '';
  }
  function labelEntry(e){
    if(!e) return 'TBD';
    try{ if(typeof getMainEntryBracketLabel==='function'){ const x=getMainEntryBracketLabel(e); if(clean(x)) return clean(x); } }catch(err){}
    if(clean(e._groupLabel)) return clean(e._groupLabel);
    if(clean(e.nm)) return clean(e.nm);
    const gn=Number(e.gn||0), rk=Number(e.rk||0);
    if(gn&&rk){
      try{ if(typeof grpLabel==='function') return `${grpLabel(gn-1)} ${rk}위`; }catch(err){}
      return `${gn}조 ${rk}위`;
    }
    return 'TBD';
  }
  function normalizeEntries(key, advT){
    return ar(advT).map((e,i)=>{
      const gn=Number(e&&e.gn)||0, rk=Number(e&&e.rk)||0;
      let label='';
      try{ if(gn&&rk&&typeof grpLabel==='function') label=`${grpLabel(gn-1)} ${rk}위`; }catch(err){}
      if(!label && gn&&rk) label=`${gn}조 ${rk}위`;
      const o={...e, gn, rk, _idx:i, _groupLabel:label, _label:labelEntry({...e,gn,rk,_groupLabel:label})};
      o._prelimVenue=entryVenue(key,o)||'';
      return o;
    }).filter(e=>e && (e.ti!=null || clean(e._label) || e.placeholder));
  }

  function rotateAvoidSameGroup(rank1, rank2){
    const n=Math.min(rank1.length, rank2.length);
    if(!n) return rank2.slice();
    for(let off=1; off<n; off++){
      let ok=true;
      for(let i=0;i<n;i++){
        const a=rank1[i], b=rank2[(i+off)%n];
        if(a && b && Number(a.gn||0) && Number(a.gn)===Number(b.gn)){ ok=false; break; }
      }
      if(ok) return rank2.map((_,i)=>rank2[(i+off)%n]);
    }
    return rank2.slice().reverse();
  }

  function splitMatchCounts(totalMatches, venues, map){
    if(!venues.length) return {};
    const totalCourts=venues.reduce((s,v)=>s+Math.max(1,ar(map[v]).length),0)||venues.length;
    let used=0;
    const out={};
    venues.forEach((v,idx)=>{
      if(idx===venues.length-1){ out[v]=Math.max(0,totalMatches-used); return; }
      const raw=totalMatches*(Math.max(1,ar(map[v]).length)/totalCourts);
      const n=Math.max(0, Math.round(raw));
      out[v]=n; used+=n;
    });
    let diff=totalMatches-Object.values(out).reduce((a,b)=>a+b,0);
    let i=0;
    while(diff!==0 && venues.length){
      const v=venues[i%venues.length];
      if(diff>0){ out[v]++; diff--; }
      else if(out[v]>0){ out[v]--; diff++; }
      i++;
      if(i>1000) break;
    }
    return out;
  }

  function buildPairsFor64(key, entries, mode){
    const venues=orderedVenues(key);
    const map=venueCourtMap(key);
    const allVenues=venues.length?venues:['merged'];
    const pairs=[];
    function pairList(list, venueForMatches){
      const r1=list.filter(e=>Number(e.rk)===1).sort((a,b)=>Number(a.gn)-Number(b.gn));
      const r2=list.filter(e=>Number(e.rk)!==1).sort((a,b)=>Number(a.gn)-Number(b.gn));
      const rr2=rotateAvoidSameGroup(r1,r2);
      const n=Math.min(r1.length,rr2.length);
      for(let i=0;i<n;i++) pairs.push({a:r1[i], b:rr2[i], venue:venueForMatches});
      const rest=[...r1.slice(n),...rr2.slice(n),...list.filter(e=>Number(e.rk)!==1&&Number(e.rk)!==2)];
      for(let i=0;i<rest.length;i+=2) pairs.push({a:rest[i], b:rest[i+1]||null, venue:venueForMatches});
    }
    if(mode==='keep'){
      const by={};
      entries.forEach(e=>{ const v=e._prelimVenue||allVenues[0]||'merged'; (by[v]=by[v]||[]).push(e); });
      allVenues.forEach(v=>{ if(by[v]&&by[v].length) pairList(by[v],v); });
      Object.keys(by).filter(v=>!allVenues.includes(v)).forEach(v=>pairList(by[v],v));
    }else{
      pairList(entries, null);
      const counts=splitMatchCounts(pairs.length, allVenues, map);
      let idx=0;
      allVenues.forEach(v=>{ for(let j=0;j<(counts[v]||0)&&idx<pairs.length;j++,idx++) pairs[idx].venue=v; });
      for(;idx<pairs.length;idx++) pairs[idx].venue=allVenues[0]||'merged';
    }
    return pairs;
  }

  function buildGenericPairs(key, entries, drawSize, mode){
    const venues=orderedVenues(key); const map=venueCourtMap(key); const allVenues=venues.length?venues:['merged'];
    const byeCount=Math.max(0,drawSize-entries.length);
    const pairs=[];
    const r1=entries.filter(e=>Number(e.rk)===1).sort((a,b)=>Number(a.gn)-Number(b.gn));
    const others=entries.filter(e=>Number(e.rk)!==1).sort((a,b)=>Number(a.rk)-Number(b.rk)||Number(a.gn)-Number(b.gn));
    for(let i=0;i<byeCount;i++) pairs.push({a:r1.shift()||others.shift()||null,b:null,bye:true,venue:null});
    const pool=[...r1,...others];
    for(let i=0;i<pool.length;i+=2) pairs.push({a:pool[i],b:pool[i+1]||null,bye:!pool[i+1],venue:null});
    if(mode==='keep'){
      pairs.forEach(p=>{ p.venue=(p.a&&p.a._prelimVenue)||(p.b&&p.b._prelimVenue)||allVenues[0]||'merged'; });
      pairs.sort((x,y)=>allVenues.indexOf(x.venue)-allVenues.indexOf(y.venue));
    }else{
      const counts=splitMatchCounts(pairs.length, allVenues, map); let idx=0;
      allVenues.forEach(v=>{ for(let j=0;j<(counts[v]||0)&&idx<pairs.length;j++,idx++) pairs[idx].venue=v; });
      for(;idx<pairs.length;idx++) pairs[idx].venue=allVenues[0]||'merged';
    }
    return pairs;
  }

  function makeRound0Match(key, slot, p, drawSize){
    const a=p.a||null,b=p.b||null,bye=!!p.bye || !b;
    const venue=p.venue||a?._prelimVenue||b?._prelimVenue||'merged';
    const t1=(a&&a.ti!=null&&!a.placeholder)?Number(a.ti):null;
    const t2=(!bye&&b&&b.ti!=null&&!b.placeholder)?Number(b.ti):null;
    return {
      id:`main_r0_${slot}`, phase:'main', round:0, slot, t1, t2, winner:bye?t1:null, rubbers:[], bye,
      court:'', courts:[], manualCourtTarget:'', venue, __venue:venue, venueLocked:true, mainBlock:venue,
      bracketN:drawSize, localDrawSize:drawSize, localRoundSize:drawSize, v1000CleanMainDraw:true,
      source1Label:a?labelEntry(a):'', source2Label:bye?'부전승':(b?labelEntry(b):''),
      sourceGroup1:a?.gn?Number(a.gn)-1:null, sourceRank1:a?.rk?Number(a.rk):null,
      sourceGroup2:b?.gn?Number(b.gn)-1:null, sourceRank2:b?.rk?Number(b.rk):null
    };
  }

  function buildUpperRounds(round0, drawSize){
    const out=[];
    let prev=round0;
    let round=1;
    while(prev.length>1){
      const next=[];
      for(let i=0;i<prev.length;i+=2){
        const a=prev[i], b=prev[i+1];
        const venue=(a&&b&&a.venue===b.venue)?a.venue:'merged';
        const m={id:`main_r${round}_${Math.floor(i/2)}`, phase:'main', round, slot:Math.floor(i/2), t1:null, t2:null, winner:null, rubbers:[], bye:false, court:'', courts:[], manualCourtTarget:'', venue, __venue:venue, venueLocked:venue!=='merged', mainBlock:venue, bracketN:drawSize, localDrawSize:drawSize, localRoundSize:Math.max(2,Math.ceil(drawSize/Math.pow(2,round))), source1Label:'', source2Label:'', v1000CleanMainDraw:true};
        if(a && a.bye && a.winner!=null){ m.t1=a.winner; m.source1Label=a.source1Label||''; }
        if(b && b.bye && b.winner!=null){ m.t2=b.winner; m.source2Label=b.source1Label||''; }
        next.push(m); out.push(m);
      }
      prev=next; round++;
    }
    return out;
  }

  function buildCleanMainMatches(advT,key,teams,groupLabelOnly=false,mode='balanced'){
    const entries=normalizeEntries(key,advT);
    const drawSize=nextPow2(entries.length);
    let pairs;
    if(entries.length===64){ pairs=buildPairsFor64(key,entries,mode); }
    else { pairs=buildGenericPairs(key,entries,drawSize,mode); }
    const round0=pairs.map((p,i)=>makeRound0Match(key,i,p,drawSize));
    let matches=[...round0,...buildUpperRounds(round0,drawSize)];
    if(groupLabelOnly){
      matches=matches.map(m=>{
        const o={...m};
        if(o.round===0){ o.t1=null; o.t2=null; if(!o.bye) o.winner=null; }
        return o;
      });
    }
    return matches;
  }

  function ensureVenueModeControls(){
    const sum=ge('individualMainDrawSummary');
    if(!sum || ge('v1000MainVenueModeBox')) return;
    const box=document.createElement('div');
    box.id='v1000MainVenueModeBox';
    box.style.cssText='margin-top:12px;padding:12px 14px;border:1.5px solid #d4a017;border-radius:14px;background:#fffaf0';
    box.innerHTML=`
      <div style="font-weight:1000;color:#8a6412;margin-bottom:8px">🏟️ 본선 구장 운영 방식</div>
      <label style="display:flex;gap:8px;align-items:flex-start;margin:7px 0;font-size:.82rem;line-height:1.45;cursor:pointer"><input type="radio" name="v1000MainVenueMode" value="balanced" checked style="margin-top:3px;accent-color:#d4a017"><span><b>전체 재배정</b><br><span style="color:#64748b">본선 대진을 전체로 섞고, 코트 수가 많은 구장부터 위쪽 구간에 순서대로 배정합니다.</span></span></label>
      <label style="display:flex;gap:8px;align-items:flex-start;margin:7px 0;font-size:.82rem;line-height:1.45;cursor:pointer"><input type="radio" name="v1000MainVenueMode" value="keep" style="margin-top:3px;accent-color:#16a34a"><span><b>예선 구장 유지</b><br><span style="color:#64748b">예선 구장별로 본선 구간을 나눠 이동 없이 운영합니다.</span></span></label>`;
    sum.insertAdjacentElement('afterend',box);
    try{ const old=ge('v606KeepCourtGroupSection'); if(old) old.style.display='none'; }catch(e){}
  }
  function getVenueMode(){
    const el=document.querySelector('input[name="v1000MainVenueMode"]:checked');
    return el&&el.value==='keep'?'keep':'balanced';
  }
  function wrapOpenIndividual(){
    if(typeof oldOpenIndividual!=='function') return;
    const w=function(){ const r=oldOpenIndividual.apply(this,arguments); setTimeout(ensureVenueModeControls,0); setTimeout(ensureVenueModeControls,120); return r; };
    window.openIndividualMainDraw=w; try{ openIndividualMainDraw=w; }catch(e){}
  }

  async function v1000StartIndividualMainDraw(){
    let ctx=null; try{ ctx=IMD; }catch(e){}
    if(!ctx){ toastSafe('본선 추첨 정보가 없습니다. 다시 열어주세요.','error'); return; }
    if(!canManageSafe()){ toastSafe('본선 추첨 권한이 없습니다','error'); return; }
    const {key,teams,allMs,advT,isPrelimDone}=ctx;
    const effectMode=(typeof getIndividualMainDrawEffectMode==='function'?getIndividualMainDrawEffectMode():'instant');
    const isTest=!!ge('individualMainDrawIsTestInput')?.checked;
    const mode=getVenueMode();
    try{ if(typeof closeIndividualMainDrawModal==='function') closeIndividualMainDrawModal(); }catch(e){}
    if(effectMode==='roulette'){
      try{ if(typeof runIndividualMainDrawEffect==='function') await runIndividualMainDrawEffect(advT); }catch(e){}
    }
    if(isTest){ toastSafe('테스트용 본선 추첨 연출만 확인했습니다','success'); return; }
    const groupMs=ar(allMs).filter(m=>String(m&&m.phase)==='group');
    const mainMatches=buildCleanMainMatches(advT,key,teams,!isPrelimDone,mode);
    G.matches[key]=[...groupMs,...mainMatches];
    G.draws[key]={...(G.draws[key]||{}), v1000MainDraw:{mode, drawSize:nextPow2(ar(advT).length), entryCount:ar(advT).length, createdAt:new Date().toISOString()}, mainUpdatedAt:new Date().toISOString()};
    try{ if(typeof sl==='function') sl(true); }catch(e){}
    try{
      await Promise.all([(typeof stM==='function'?stM(key):Promise.resolve()),(typeof stD==='function'?stD(key):Promise.resolve())]);
      toastSafe((ar(advT).length===64?'64드로 본선 추첨 완료':'본선 추첨 완료') + (mode==='keep'?' · 예선 구장 유지':' · 전체 재배정'),'success');
      try{ if(typeof renderBracket==='function') renderBracket(); }catch(e){}
    }catch(e){ toastSafe('저장 실패: '+(e.message||e),'error'); }
    finally{ try{ if(typeof sl==='function') sl(false); }catch(e){} }
  }

  function sideName(key,m,side,teams){
    const label=side===1?m.source1Label:m.source2Label;
    const ti=side===1?m.t1:m.t2;
    if(clean(label)) return clean(label);
    try{ if(ti!=null && teams[ti]) return getMainBracketDisplayName(key,teams[ti],ti); }catch(e){}
    return ti==null?'TBD':`#${Number(ti)+1}`;
  }
  function customRenderBracketTree(key,mMs,teams){
    const ms=ar(mMs).filter(m=>m&&m.v1000CleanMainDraw).map(m=>({...m,round:Number(m.round||0),slot:Number(m.slot||0)}));
    if(!ms.length && typeof oldRenderTree==='function') return oldRenderTree.apply(this,arguments);
    const rounds=[...new Set(ms.map(m=>m.round))].sort((a,b)=>a-b);
    const cols=rounds.map(r=>ms.filter(m=>m.round===r).sort((a,b)=>a.slot-b.slot));
    function card(m,ri){
      const v=m.venue||'merged', c=venueColor(v), bg=venueBg(v);
      const st=(typeof getMatchResultState==='function')?getMatchResultState(key,m):{};
      const done=!!st.done, wn=st.winner;
      const n1=sideName(key,m,1,teams), n2=m.bye?'부전승':sideName(key,m,2,teams);
      const w1=done&&wn===m.t1, w2=done&&wn===m.t2;
      return `<div class="v1000-br-card" style="border:1.5px solid ${c};border-left:6px solid ${c};background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(15,30,58,.10);margin:0 0 10px 0;min-width:176px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:5px 8px;background:${bg};border-bottom:1px solid rgba(15,30,58,.08)"><span style="font-size:.68rem;font-weight:1000;color:${c}">🏟️ ${venueLabel(v)}</span><span style="font-size:.62rem;color:#64748b;font-weight:900">${ri===0?`${m.slot+1}경기`:''}</span></div>
        <div style="padding:7px 9px;font-size:.78rem;font-weight:${w1?1000:800};color:${w1?c:'#0f172a'};background:${w1?bg:'#fff'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${w1?'🏆 ':''}${n1}</div>
        <div style="padding:7px 9px;font-size:.78rem;font-weight:${w2?1000:800};color:${w2?c:(m.bye?'#a16207':'#0f172a')};background:${w2?bg:(m.bye?'#fffbeb':'#fff')};border-top:1px solid #e5eaf3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${w2?'🏆 ':''}${n2}</div>
      </div>`;
    }
    const titles=rounds.map((r,ri)=> ri===rounds.length-1?'결승':(ri===rounds.length-2?'준결승':`${Math.pow(2,rounds.length-ri)}강`));
    return `<div class="v1000-bracket" style="display:flex;gap:28px;align-items:flex-start;overflow-x:auto;padding:8px 4px 18px">
      ${cols.map((list,ri)=>`<div style="min-width:186px;display:flex;flex-direction:column;justify-content:space-around">
        <div style="text-align:center;background:#0f1e3a;color:#fff;border-radius:8px;padding:6px 8px;margin-bottom:10px;font-weight:1000;font-size:.78rem">${titles[ri]}</div>
        ${list.map(m=>card(m,ri)).join('')}
      </div>`).join('')}
    </div>`;
  }

  function assignedCourts(m){ const a=ar(m&&m.courts).map(clean).filter(Boolean); if(a.length) return a; return clean(m&&m.court)?[clean(m.court)]:[]; }
  function isOpenMatch(m){ return m && !m.bye && m.winner==null; }
  function readyMain(m){ return m && String(m.phase)==='main' && Number(m.round||0)===0 && isOpenMatch(m) && ((m.t1!=null)||clean(m.source1Label)) && ((m.t2!=null)||clean(m.source2Label)) && !assignedCourts(m).length; }
  async function cleanMainCourtAssign(key){
    if(!key || !(G&&G.matches&&G.matches[key])) return false;
    const all=ar(G.matches[key]);
    const map=venueCourtMap(key); const venues=orderedVenues(key);
    if(!venues.length){ toastSafe('본선 사용 코트가 설정되지 않았습니다','error'); return false; }
    const counts={};
    Object.values(map).flat().forEach(c=>counts[c]=0);
    all.forEach(m=>{ if(!isOpenMatch(m)) return; assignedCourts(m).forEach(c=>{ if(counts[c]!=null) counts[c]++; }); });
    const pending=all.filter(readyMain).sort((a,b)=>Number(a.slot)-Number(b.slot));
    if(!pending.length){ toastSafe('배정할 본선 경기가 없거나 이미 배정되어 있습니다','info'); return false; }
    const by={}; pending.forEach(m=>{ const v=m.venue||venues[0]; (by[v]=by[v]||[]).push(m); });
    const base=Date.now(); let tick=0, changed=false;
    function order(){ return new Date(base+(tick++)).toISOString(); }
    venues.forEach(v=>{
      const list=by[v]||[]; const courts=ar(map[v]); if(!courts.length) return;
      list.forEach(m=>{
        const eligible=courts.filter(c=>Number(counts[c]||0)<2).sort((a,b)=>Number(counts[a]||0)-Number(counts[b]||0)||sortNatural(a,b));
        const now=order();
        if(eligible.length){
          const c=eligible[0]; const pos=Number(counts[c]||0);
          m.court=c; m.courts=[c]; m.venue=v; m.__venue=v; m.venueLocked=true; m.courtAssignedAt=now; m.courtQueueOrder=now; if(pos>=1) m.waitingFirstAt=now; counts[c]=pos+1;
        }else{
          m.court=''; m.courts=[]; m.venue=v; m.__venue=v; m.venueLocked=true; m.sharedQueue=true; m.courtQueueOrder=now;
        }
        changed=true;
      });
    });
    if(!changed){ toastSafe('배정 가능한 본선 경기가 없습니다','info'); return false; }
    try{ if(typeof sl==='function') sl(true); }catch(e){}
    try{ if(typeof stM==='function') await stM(key); toastSafe('본선 코트 배정 완료 ✅','success'); try{ if(typeof renderBracket==='function') renderBracket(); }catch(e){} return true; }
    catch(e){ toastSafe('본선 코트 배정 저장 실패: '+(e.message||e),'error'); return false; }
    finally{ try{ if(typeof sl==='function') sl(false); }catch(e){} }
  }

  // expose / override
  window.v1000BuildCleanMainMatches=buildCleanMainMatches;
  window.buildIndivMainMatchesFixed=function(advT,key,teams,groupLabelOnly){ return buildCleanMainMatches(advT,key,teams,groupLabelOnly,getVenueMode()); };
  try{ buildIndivMainMatchesFixed=window.buildIndivMainMatchesFixed; }catch(e){}
  window.startIndividualMainDraw=v1000StartIndividualMainDraw; try{ startIndividualMainDraw=v1000StartIndividualMainDraw; }catch(e){}
  window.renderBracketTree=function(key,mMs,teams){ return customRenderBracketTree(key,mMs,teams); };
  try{ renderBracketTree=window.renderBracketTree; }catch(e){}
  window.v773RunMainAssign=cleanMainCourtAssign;
  window.v1000RunMainCourtAssign=cleanMainCourtAssign;
  wrapOpenIndividual();

  console.log(TAG,'installed');
})();
