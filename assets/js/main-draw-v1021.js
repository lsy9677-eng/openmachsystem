/* v1019 clean main draw staged shared-queue balanced assignment mode
   - legacy main draw UI is not used
   - main draw may be created during prelims using group-rank slots
   - actual team names are resolved automatically as prelim results are entered
   - 64 teams => 64 draw, no byes, rank1 vs rank2, no same group
*/
(function(){
  'use strict';
  if(window.__V1019_MAIN_DRAW_CLEAN_INSTALLED) return;
  window.__V1019_MAIN_DRAW_CLEAN_INSTALLED = true;
  // v1019 uses its own guard and filename so cached older scripts cannot block this patch.
  const VERSION = 'v1021-ready-display-queue-assign-fix';
  const VENUE_ORDER = ['국제','능동','원도심','삼계','금병','동부','장유중','기타'];
  const VENUE_COLOR = {국제:'#2563eb',능동:'#7c3aed',원도심:'#16a34a',삼계:'#0891b2',금병:'#d97706',동부:'#be123c',장유중:'#475569',기타:'#64748b'};
  const VENUE_BG = {국제:'#eff6ff',능동:'#f5f3ff',원도심:'#ecfdf5',삼계:'#ecfeff',금병:'#fff7ed',동부:'#fff1f2',장유중:'#f8fafc',기타:'#f8fafc'};

  function $(id){return document.getElementById(id)}
  function ar(v){return Array.isArray(v)?v:[]}
  function S(v){return String(v==null?'':v).trim()}
  function N(v){const n=Number(v); return Number.isFinite(n)?n:null}
  function esc(s){return S(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function toast(msg,type){try{ if(typeof window.toast==='function') window.toast(msg,type||'info'); else console.log('[v1003]',msg); }catch(e){ console.log('[v1003]',msg); }}
  function now(){return new Date().toISOString()}
  function ge(id){ try{return document.getElementById(id)}catch(e){return null} }

  function elementVisible(el){
    try{
      if(!el) return false;
      const cs=getComputedStyle(el);
      return cs.display!=='none' && cs.visibility!=='hidden' && cs.opacity!=='0' && el.offsetParent!==null;
    }catch(e){ return false; }
  }
  function roleText(){
    try{return S(document.querySelector('.header-actions,.login-menu-wrap,.app-header')?.innerText||'');}
    catch(e){return '';}
  }
  function publicLoginOnly(){
    try{
      const t=roleText();
      const btn=S((ge('loginMenuBtn')||document.querySelector('.login-menu-btn'))?.innerText||'');
      const raw=(t+' '+btn).replace(/\s+/g,' ');
      const hasRole=/개발자|관리자|운영자|진행자|로그아웃|님/i.test(raw);
      return /로그인/.test(raw) && !hasRole;
    }catch(e){return false;}
  }
  function cleanMainPrivileged(){
    try{ if(window.AD===true || window.TM===true || window.OP===true) return true; }catch(e){}
    try{ if(typeof window.canManageBracket==='function' && window.canManageBracket()) return true; }catch(e){}
    try{ if(typeof window.isManager==='function' && window.isManager()) return true; }catch(e){}
    try{ if(typeof window.isAdmin==='function' && window.isAdmin()) return true; }catch(e){}
    try{ if(typeof window.isDeveloper==='function' && window.isDeveloper()) return true; }catch(e){}
    try{ if(/admin-mode|tm-mode|operator-mode|op-mode|developer-mode/i.test(document.body?.className||'')) return true; }catch(e){}
    try{ if(/developer|admin|operator|manager|tournament_admin/i.test(String(window.LOGIN_PORTAL_MODE||''))) return true; }catch(e){}
    try{
      const profiles=[window.CURRENT_APP_PROFILE,window.currentUserProfile,window.USER_PROFILE,window.profile,window.me].filter(Boolean);
      for(const p of profiles){
        const role=S(p.role||p.userRole||p.permission||p.type).toLowerCase();
        const email=S(p.email||p.userEmail).toLowerCase();
        const name=S(p.name||p.displayName||p.userName);
        if(email==='canyone2@naver.com' || /이상영/.test(name)) return true;
        if(/developer|admin|operator|manager|host|staff|tournament_admin/.test(role)) return true;
        if(/개발자|관리자|운영자|진행자/.test(role)) return true;
      }
    }catch(e){}
    try{
      const badges=[ge('adminBadge'),ge('opLoginBadge'),ge('adminSettingsBtn'),document.querySelector('.admin-badge.show')].filter(Boolean);
      for(const b of badges){
        const t=S((b.innerText||b.textContent||'')+' '+(b.id||'')+' '+(b.className||''));
        if(elementVisible(b) && /개발자|관리자|운영자|진행자|admin|operator|developer/i.test(t)) return true;
      }
    }catch(e){}
    if(publicLoginOnly()) return false;
    return false;
  }

  function selectedKey(){
    try{ const k=S(window.__CURRENT_RENDER_KEY||window.__v650CurrentGroupLabelKey||''); if(k && window.G && G.draws && G.draws[k]) return k; }catch(e){}
    try{
      const tid=S((ge('brTS')&&ge('brTS').value)||(ge('regTS')&&ge('regTS').value)||(ge('rankTS')&&ge('rankTS').value)||'');
      if(tid){
        let div=''; const brDS=ge('brDS');
        if(brDS && brDS.value && brDS.value!=='__ALL__') div=S(brDS.value);
        if(!div && Array.isArray(window.BR_MULTI_DIVS) && window.BR_MULTI_DIVS.length && !window.BR_MULTI_DIVS.includes('__ALL__')) div=S(window.BR_MULTI_DIVS[0]);
        if(div) return tid+'_'+div;
        const keys=Object.keys((window.G&&G.draws)||{}).filter(k=>k.indexOf(tid+'_')===0);
        if(keys.length) return keys[0];
      }
    }catch(e){}
    try{return Object.keys((window.G&&G.draws)||{})[0]||'';}catch(e){return ''}
  }
  function splitKey(key){const i=S(key).lastIndexOf('_'); return {tid:S(key).slice(0,i), div:S(key).slice(i+1)};}

  function venueKo(v){
    const c=S(v);
    if(!c) return '';
    if(/wondosim|원도심|원도|인조/i.test(c)) return '원도심';
    if(/gukje|국제|장유국제/i.test(c)) return '국제';
    if(/neungdong|능동/i.test(c)) return '능동';
    if(/jangyu_jung|장유중|클레이/i.test(c)) return '장유중';
    if(/geumbyeong|금병/i.test(c)) return '금병';
    if(/samgye|삼계/i.test(c)) return '삼계';
    if(/dongbu|동부/i.test(c)) return '동부';
    if(/기타/.test(c)) return '기타';
    return c;
  }
  function venueOfCourt(court){
    const c=S(court);
    if(!c) return '';
    const known=venueKo(c);
    if(['국제','능동','원도심','삼계','금병','동부','장유중','기타'].includes(known)) return known;
    return '';
  }
  function stripClubPart(name){
    return S(name)
      .replace(/\s*\([^)]*\)/g,'')
      .replace(/\s*\[[^\]]*\]/g,'')
      .replace(/\s+/g,' ')
      .trim();
  }
  function nameOnlyFromLabel(label){
    const raw=S(label);
    if(!raw) return '';
    if(/^(\d+조\s*[12]위|TBD|부전승)$/i.test(raw)) return raw;
    return raw.split(/\s*\/\s*/).map(stripClubPart).filter(Boolean).join(' / ');
  }
  function isSlotOrEmptyLabel(label){
    const raw=S(label);
    if(!raw) return true;
    if(/^(TBD|대기|슬롯\s*대기)$/i.test(raw)) return true;
    if(/부전승|BYE/i.test(raw)) return false;
    return /^\d+조\s*[12]위$/.test(raw);
  }
  function actualDisplayNameForSide(m,side){
    const suffix=side===1?'1':'2';
    const raw=S(m&&((m['display'+suffix])||(m['nameOnly'+suffix])||(m['autoName'+suffix])||''));
    const nm=nameOnlyFromLabel(raw);
    if(!nm || isSlotOrEmptyLabel(nm)) return '';
    return nm;
  }
  function sideReadyForOperation(m,side){
    const suffix=side===1?'1':'2';
    if(N(m&&m['t'+suffix])!=null) return true;
    return !!actualDisplayNameForSide(m,side);
  }
  function teamName(key, ti){
    try{
      const t=ar(G&&G.teams&&G.teams[key])[Number(ti)]||{};
      if(Array.isArray(t.individualPlayers)&&t.individualPlayers.length){
        const ps=t.individualPlayers.slice(0,2).map(p=>stripClubPart((p&&p.name)||p)).filter(Boolean);
        if(ps.length) return ps.join(' / ');
      }
      if(Array.isArray(t.players)&&t.players.length){
        const ps=t.players.slice(0,2).map(stripClubPart).filter(Boolean);
        if(ps.length) return ps.join(' / ');
      }
      if(t.pairLabel) return nameOnlyFromLabel(t.pairLabel);
      if(t.entryLabel) return nameOnlyFromLabel(t.entryLabel);
      return stripClubPart(t.name||t.club||('T'+ti));
    }catch(e){ return 'T'+ti; }
  }
  function mainRoundLabel(size, round){
    const n=Math.max(2, Math.floor(Number(size||2)/Math.pow(2,Number(round||0))));
    if(n<=2) return '결승';
    if(n<=4) return '준결승';
    return n+'강';
  }
  function normalizeCleanMatchDisplay(key,m){
    if(!m || !m.cleanMainDraw) return m;
    const size=Number((G&&G.draws&&G.draws[key]&&G.draws[key].mainDrawSize)||m.bracketN||0)||64;
    const round=Number(m.round||0)||0;
    const v=venueKo(m.venue||m.venueLabel||m.__venue||m.mainBlock||'기타');
    m.venue=v; m.venueLabel=v; m.__venue=v; m.mainBlock=v;
    m.bracketN=size; m.localDrawSize=size; m.localRoundSize=Math.max(2, Math.floor(size/Math.pow(2,round)));
    m.localRoundLabel=mainRoundLabel(size,round);
    m.roundLabel=m.localRoundLabel;
    m.nameOnly1=nameOnlyFromLabel(m.display1||m.source1Label||'TBD');
    m.nameOnly2=nameOnlyFromLabel(m.display2||m.source2Label||'TBD');
    if(m.nameOnly1 || m.nameOnly2) m.autoCourtLabel=(m.nameOnly1||'TBD')+' vs '+(m.nameOnly2||'TBD');
    return m;
  }
  function groupNo(g,gi){
    return Number(g&&(g.confirmedGroupNo||g.finalGroupNo||g.displayGroupNo||g.manualGroupNo||g.v702GroupNo||g.groupNo||g.no)) || (Number(gi)+1);
  }
  function groupMatches(key, gi){
    return ar(G&&G.matches&&G.matches[key]).filter(m=>String(m.phase||'')==='group' && Number(m.group)===Number(gi));
  }
  function groupComplete(key, gi){
    const ms=groupMatches(key,gi);
    if(!ms.length) return false;
    return ms.every(m=>m.winner!=null || m.done===true || m.status==='done' || m.completed===true);
  }
  function prelimComplete(key){
    const groups=ar(G&&G.draws&&G.draws[key]&&G.draws[key].groups);
    if(!groups.length) return false;
    return groups.every((g,gi)=>groupComplete(key,gi));
  }
  function groupStructureSignature(key){
    try{
      const draw=(G&&G.draws&&G.draws[key])||{};
      const parts=ar(draw.groups).map((g,gi)=>{
        const teams=ar(g&&g.teams).map(x=>N(x)).join(',');
        const v=groupVenue(key,g,gi);
        return `${groupNo(g,gi)}[${teams}]@${v}`;
      });
      return parts.join('||');
    }catch(e){return ''}
  }
  // Results may change during prelims; this signature is informational only and must not invalidate the draw.
  function groupResultSignature(key){
    try{
      const draw=(G&&G.draws&&G.draws[key])||{};
      return ar(draw.groups).map((g,gi)=>groupMatches(key,gi).map(m=>[m.id,m.winner,m.score1,m.score2].map(S).join(':')).join('|')).join('||');
    }catch(e){return ''}
  }
  function groupVenue(key,g,gi){
    const candidates=[];
    try{ if(g){ candidates.push(g.court,g.manualCourt,g.manualCourtTarget); if(Array.isArray(g.courts)) candidates.push(...g.courts); } }catch(e){}
    try{ groupMatches(key,gi).forEach(m=>{candidates.push(m.court,m.manualCourtTarget,m.currentCourt); if(Array.isArray(m.courts)) candidates.push(...m.courts);}); }catch(e){}
    for(const c of candidates){ const v=venueOfCourt(c); if(v) return v; }
    return '기타';
  }
  function standings(key, gi, g){
    try{
      const teams=ar(G&&G.teams&&G.teams[key]);
      if(typeof window.calcGS==='function'){
        const rows=ar(window.calcGS(key,gi,ar(g&&g.teams),teams));
        const arr=rows.map(r=>N(r&&(r.ti??r.teamIdx??r.idx))).filter(v=>v!=null);
        if(arr.length) return arr;
      }
    }catch(e){}
    for(const f of ['standings','ranking','rankings','rankOrder','order']){
      const arr=ar(g&&g[f]).map(x=>N((x&&typeof x==='object')?(x.ti??x.teamIdx??x.idx??x.team):x)).filter(v=>v!=null);
      if(arr.length) return arr;
    }
    return ar(g&&g.teams).map(N).filter(v=>v!=null);
  }
  function groupRankReady(key, gi, g){
    try{
      // 예선이 끝나기 전에는 절대 실제 팀명으로 확정하지 않는다.
      // 조별 결과가 모두 들어온 조만 1위/2위가 실제 팀명으로 자동 대체된다.
      return !!groupComplete(key, gi);
    }catch(e){ return false; }
  }
  function resolvedStandings(key, gi, g){
    if(!groupRankReady(key, gi, g)) return [];
    return standings(key, gi, g);
  }
  function collectEntries(key){
    const out=[]; const groups=ar(G&&G.draws&&G.draws[key]&&G.draws[key].groups);
    groups.forEach((g,gi)=>{
      const gn=groupNo(g,gi); const ready=groupRankReady(key,gi,g); const st=ready?standings(key,gi,g):[]; const venue=groupVenue(key,g,gi);
      [1,2].forEach(rk=>{
        const ti=ready?N(st[rk-1]):null;
        const label=`${gn}조 ${rk}위`;
        out.push({ti:ti!=null?ti:null, rk, gi, gn, venue, label, nm:ti!=null?teamName(key,ti):label, provisional:ti==null, slotLabel:label, rankReady:ready});
      });
    });
    return out;
  }
  function resolveEntry(key, entry){
    if(!entry) return null;
    const groups=ar(G&&G.draws&&G.draws[key]&&G.draws[key].groups);
    const gi=N(entry.gi); const rk=N(entry.rk);
    if(gi!=null && rk!=null && groups[gi]){
      const label=entry.label || (entry.gn&&rk?`${entry.gn}조 ${rk}위`:'TBD');
      // 핵심: 예선이 완료되지 않은 조의 저장된 t1/t2는 과거 임시값이어도 무시한다.
      if(!groupRankReady(key,gi,groups[gi])) return Object.assign({},entry,{ti:null,nm:label,provisional:true,rankReady:false});
      const st=standings(key,gi,groups[gi]);
      const ti=N(st[rk-1]);
      if(ti!=null) return Object.assign({},entry,{ti,nm:teamName(key,ti),provisional:false,rankReady:true});
      return Object.assign({},entry,{ti:null,nm:label,provisional:true,rankReady:false});
    }
    if(entry.ti!=null) return Object.assign({},entry,{nm:teamName(key,entry.ti),provisional:false,rankReady:true});
    return Object.assign({},entry,{ti:null,nm:entry.label||'TBD',provisional:true,rankReady:false});
  }
  function isByeLabel(s){ return /부전승|BYE/i.test(S(s)); }
  function resolveMatchSide(key,m,side){
    const suffix=side===1?'1':'2';
    const entry={
      ti:N(m['t'+suffix]), gi:N(m['sourceGi'+suffix]), gn:N(m['sourceGroup'+suffix]), rk:N(m['sourceRank'+suffix]),
      venue:S(m.venue||m.venueLabel||m.__venue)||'기타', label:S(m['source'+suffix+'Label']||'')
    };
    if(!entry.label && entry.gn && entry.rk) entry.label=`${entry.gn}조 ${entry.rk}위`;
    if(isByeLabel(entry.label)){
      m['t'+suffix]=null; m['display'+suffix]='부전승'; m['source'+suffix+'Resolved']=true; return Object.assign({},entry,{ti:null,nm:'부전승',provisional:false,bye:true});
    }
    const r=resolveEntry(key,entry);
    if(r && r.ti!=null){m['t'+suffix]=r.ti; m['display'+suffix]=r.nm; m['source'+suffix+'Resolved']=true;}
    else {m['t'+suffix]=null; m['display'+suffix]=r?.nm||entry.label||'TBD'; m['source'+suffix+'Resolved']=false;}
    return r;
  }
  function resolveCleanMatches(key, persistNames){
    const mains=ar(G&&G.matches&&G.matches[key]).filter(m=>String(m.phase||'')==='main'&&m.cleanMainDraw);
    mains.forEach(m=>{
      const a=resolveMatchSide(key,m,1); const b=resolveMatchSide(key,m,2);
      if(persistNames){m.display1=nameOnlyFromLabel(a?.nm||m.source1Label||'TBD'); m.display2=nameOnlyFromLabel(b?.nm||m.source2Label||'TBD');}
      normalizeCleanMatchDisplay(key,m);
    });
    return mains;
  }
  function nextPow2(n){let p=1; while(p<n)p*=2; return p;}
  function shuffleCopy(list){
    const a=(list||[]).slice();
    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      const t=a[i]; a[i]=a[j]; a[j]=t;
    }
    return a;
  }

  function balancedIndexOrder(n){
    n=Math.max(0, Number(n)||0);
    const used=new Set();
    const out=[];
    const low=[]; for(let i=0;i<n;i++) low.push(i);
    const high=[]; for(let i=n-1;i>=0;i--) high.push(i);
    const mid=[];
    const upper=Math.ceil(n/2);
    for(let d=0; mid.length<n && d<=n; d++){
      const a=upper+d;
      const b=upper-1-d;
      if(a>=0 && a<n) mid.push(a);
      if(b>=0 && b<n) mid.push(b);
    }
    let li=0,hi=0,mi=0;
    while(out.length<n){
      const candidates=[];
      if(li<low.length) candidates.push(low[li++]);
      if(hi<high.length) candidates.push(high[hi++]);
      if(mi<mid.length) candidates.push(mid[mi++]);
      for(const x of candidates){
        if(x>=0 && x<n && !used.has(x)){ used.add(x); out.push(x); }
      }
      if(!candidates.length) break;
    }
    for(let i=0;i<n;i++){ if(!used.has(i)){ used.add(i); out.push(i); } }
    return out;
  }
  function mainQueueNumber(m){
    const n=Number(m?.mainQueueSeq ?? m?.v1019QueueSeq ?? m?.__mainQueueOrder ?? m?.v1011QueueOrder);
    if(Number.isFinite(n) && n>0) return n;
    const s=Number(m?.slot);
    return Number.isFinite(s) ? (10000+s) : 999999;
  }
  function sortedByMainQueue(list){
    return ar(list).slice().sort((a,b)=>{
      const aq=mainQueueNumber(a), bq=mainQueueNumber(b);
      if(aq!==bq) return aq-bq;
      return Number(a?.slot||0)-Number(b?.slot||0) || S(a?.id).localeCompare(S(b?.id),'ko');
    });
  }
  function queueOrderIso(m){
    const q=Math.max(1, mainQueueNumber(m));
    return new Date(Date.UTC(2000,0,1,0,0,q)).toISOString();
  }
  function rotatedCourtsForMatch(m,courts){
    const list=ar(courts).slice();
    if(list.length<2) return list;
    const start=(Math.max(1,mainQueueNumber(m))-1)%list.length;
    return list.slice(start).concat(list.slice(0,start));
  }
  function assignQueueSeqBySegments(key,mains){
    try{
      const draw=(G&&G.draws&&G.draws[key])||{};
      const arr=ar(mains&&mains.length?mains:(G&&G.matches&&G.matches[key]||[]).filter(m=>String(m.phase||'')==='main'&&m.cleanMainDraw));
      if(!arr.length) return {changed:false};
      const bySlot=new Map(arr.map(m=>[Number(m.slot||0),m]));
      let segs=ar(draw.mainDrawVenueSegments).slice();
      if(!segs.length){
        const maxSlot=Math.max(...arr.map(m=>Number(m.slot||0)));
        segs=[{venue:venueKo(arr[0]?.venue||'국제'),start:0,end:maxSlot,count:maxSlot+1}];
      }
      segs.sort((a,b)=>Number(a.start||0)-Number(b.start||0));
      let seq=1, changed=false;
      segs.forEach(seg=>{
        const start=Number(seg.start||0), end=Number(seg.end==null?start:seg.end);
        const len=Math.max(0,end-start+1);
        balancedIndexOrder(len).forEach(localIdx=>{
          const slot=start+localIdx;
          const m=bySlot.get(slot);
          if(!m) return;
          const v=venueKo(seg.venue||m.venue||m.__venue||'기타');
          if(m.venue!==v || m.__venue!==v || m.venueLabel!==v){ m.venue=v; m.__venue=v; m.venueLabel=v; m.mainBlock=v; changed=true; }
          if(Number(m.mainQueueSeq)!==seq || Number(m.v1019QueueSeq)!==seq || Number(m.__mainQueueOrder)!==seq){ changed=true; }
          m.mainQueueSeq=seq;
          m.v1019QueueSeq=seq;
          m.__mainQueueOrder=seq;
          m.v1011QueueOrder=seq;
          m.mainQueueLabel=`${v} 본선대기 ${seq}`;
          normalizeCleanMatchDisplay(key,m);
          seq++;
        });
      });
      if(draw){ draw.v1019QueueSequenceBuiltAt=now(); draw.v1019QueueSequenceMode='venue_segment_balanced'; }
      return {changed};
    }catch(e){ console.warn('[v1019] queue sequence build failed', e); return {changed:false}; }
  }
  function pairRank1Rank2(entries){
    // v1018: 본선 슬롯 추첨은 매번 랜덤이어야 한다.
    // 조건: 1위 vs 2위 유지, 같은 예선 조 재대결 금지.
    const rank1=entries.filter(e=>e.rk===1);
    const rank2=entries.filter(e=>e.rk===2);
    if(!rank1.length || !rank2.length) return [];
    const tries=600;
    let best=null, bestBad=Infinity;
    for(let attempt=0; attempt<tries; attempt++){
      const r1=shuffleCopy(rank1);
      const pool=shuffleCopy(rank2);
      const pairs=[];
      let bad=0;
      for(const e of r1){
        let candidates=[];
        for(let i=0;i<pool.length;i++) if(!pool[i] || pool[i].gn!==e.gn) candidates.push(i);
        if(!candidates.length) candidates=pool.map((_,i)=>i);
        const pick=candidates[Math.floor(Math.random()*candidates.length)];
        const r2=pool.splice(pick,1)[0]||null;
        if(r2 && r2.gn===e.gn) bad++;
        pairs.push([e,r2]);
      }
      while(pool.length) pairs.push([pool.shift(), null]);
      // 같은 조 재대결이 전혀 없으면 즉시 사용. 그래도 최종 순서도 한 번 더 섞어 고정 패턴을 끊는다.
      if(bad===0) return shuffleCopy(pairs);
      if(bad<bestBad){bestBad=bad; best=pairs;}
    }
    return shuffleCopy(best||[]);
  }
  function uniq(list){ return [...new Set(ar(list).map(S).filter(Boolean))]; }
  function mainCourts(key){
    const sp=splitKey(key); const tid=sp.tid, div=sp.div;
    const buckets=[];
    function add(list, tag){
      const arr=uniq(list||[]);
      if(arr.length) buckets.push({tag, list:arr});
    }
    // v1014: 본선 구장은 한 소스에서 "있으면 즉시 반환"하지 않고, 실제 코트현황판/대회설정/본선설정을 병합한다.
    // 기존 방식은 mainAllowedCourts가 일부만 저장된 경우 능동 같은 실제 운영 구장이 본선 패널에서 빠질 수 있었다.
    try{ if(typeof window.getDivisionPhaseConfiguredCourts==='function') add(window.getDivisionPhaseConfiguredCourts(tid,div,'main'),'phaseMain'); }catch(e){}
    try{ if(typeof window.getDivisionMainConfiguredCourts==='function') add(window.getDivisionMainConfiguredCourts(tid,div),'divisionMain'); }catch(e){}
    try{
      const t=ar(G&&G.tournaments).find(x=>S(x.id)===tid)||null;
      const ds=t&&t.divSettings&&t.divSettings[div];
      if(ds){ add(ds.mainAllowedCourts,'dsMain'); add(ds.allowedMainCourts,'dsAllowedMain'); add(ds.allowedCourts,'dsAllowed'); }
      if(t){ add(t.mainCourts,'tMain'); add(t.allowedCourts,'tAllowed'); }
    }catch(e){}
    try{ const d=G.draws[key]||{}; add(d.mainCourts,'drawMain'); add(d.mainAllowedCourts,'drawMainAllowed'); add(d.allowedMainCourts,'drawAllowedMain'); add(d.allowedCourts,'drawAllowed'); add(d.courts,'drawCourts'); }catch(e){}
    try{ if(window.OperationQueueV993 && typeof OperationQueueV993.getMainCourts==='function') add(OperationQueueV993.getMainCourts(tid,div),'opqMain'); }catch(e){}
    try{ if(window.OperationQueueV993 && typeof OperationQueueV993.getBoardCourtsForKey==='function') add(OperationQueueV993.getBoardCourtsForKey(key),'opqBoard'); }catch(e){}
    try{ if(typeof window.getSelectedCourtFilters==='function') add(window.getSelectedCourtFilters(key),'selectedFilters'); }catch(e){}
    try{ if(typeof window.getUsedCourtsForKey==='function') add(window.getUsedCourtsForKey(key),'used'); }catch(e){}
    let merged=[];
    buckets.forEach(b=>b.list.forEach(c=>{ c=S(c); if(c && !merged.includes(c)) merged.push(c); }));
    // 장유중/클레이는 예선 전용으로 쓰는 경우가 많아, 다른 본선 구장이 하나라도 있으면 기본 제외한다.
    const nonPrelimOnly=merged.filter(c=>!/장유중|클레이/i.test(c));
    if(nonPrelimOnly.length) merged=nonPrelimOnly;
    // 구장별 코트 번호 순 정렬. 같은 구장 안에서는 1,2,3... 순서가 유지되어 배정 순서가 안정된다.
    merged.sort((a,b)=>{
      const va=venueOfCourt(a)||'기타', vb=venueOfCourt(b)||'기타';
      const ia=VENUE_ORDER.indexOf(va)<0?999:VENUE_ORDER.indexOf(va);
      const ib=VENUE_ORDER.indexOf(vb)<0?999:VENUE_ORDER.indexOf(vb);
      if(ia!==ib) return ia-ib;
      const na=Number((String(a).match(/(\d+)\s*$/)||[])[1]||9999);
      const nb=Number((String(b).match(/(\d+)\s*$/)||[])[1]||9999);
      if(na!==nb) return na-nb;
      return String(a).localeCompare(String(b),'ko');
    });
    return merged;
  }
  function venueGroups(key){
    const map={}; mainCourts(key).forEach(c=>{const v=venueOfCourt(c)||'기타'; (map[v]||(map[v]=[])).push(c);});
    const arr=Object.keys(map).map(v=>({venue:venueKo(v),courts:map[v],count:map[v].length})).sort((a,b)=>b.count-a.count || ((VENUE_ORDER.indexOf(a.venue)<0?999:VENUE_ORDER.indexOf(a.venue))-(VENUE_ORDER.indexOf(b.venue)<0?999:VENUE_ORDER.indexOf(b.venue))));
    return arr.length?arr:[{venue:'국제',courts:[],count:1}];
  }
  function venueForSlots(key, count, mode, pairs){
    const vg=venueGroups(key);
    const available=vg.map(v=>v.venue);
    const fallback=(available[0]||'국제');
    if(mode==='keep'){
      return pairs.map(p=>{
        const wanted=venueKo(p[0]?.venue || p[1]?.venue || fallback);
        return available.includes(wanted) ? wanted : fallback;
      });
    }
    const total=vg.reduce((s,v)=>s+Math.max(1,v.count),0)||1;
    const exact=vg.map(v=>({venue:v.venue, exact:count*Math.max(1,v.count)/total, n:Math.floor(count*Math.max(1,v.count)/total)}));
    let used=exact.reduce((s,x)=>s+x.n,0);
    exact.sort((a,b)=>(b.exact-b.n)-(a.exact-a.n));
    for(let i=0; used<count && i<exact.length; i++,used++) exact[i].n++;
    // 원래 구장 순서로 돌려서 상단 구간부터 국제 → 능동 → 원도심 순서로 배치한다.
    const order=new Map(vg.map((v,i)=>[v.venue,i]));
    exact.sort((a,b)=>(order.get(a.venue)||0)-(order.get(b.venue)||0));
    const arr=[]; exact.forEach(x=>{for(let k=0;k<x.n;k++) arr.push(x.venue);});
    while(arr.length<count) arr.push(fallback);
    return arr.slice(0,count);
  }
  function makeMatch(key, slot, e1, e2, venue, size){
    const id=`v1016_main_${slot}_${Date.now()}`;
    const v=venueKo(venue||'기타');
    const m={id,phase:'main',round:0,slot,bracketN:size,localDrawSize:size,localRoundSize:size,localRoundLabel:mainRoundLabel(size,0),roundLabel:mainRoundLabel(size,0),winner:null,rubbers:[],court:'',courts:[],manualCourtTarget:'',
      t1:e1?.ti??null,t2:e2?.ti??null,display1:nameOnlyFromLabel(e1?.nm||e1?.label||''),display2:nameOnlyFromLabel(e2?.nm||e2?.label||'부전승'),
      source1Label:e1?.label||'',source2Label:e2?.label||'부전승',sourceGi1:e1?.gi??null,sourceGi2:e2?.gi??null,sourceGroup1:e1?.gn??null,sourceGroup2:e2?.gn??null,sourceRank1:e1?.rk??null,sourceRank2:e2?.rk??null,
      source1Resolved:e1?.ti!=null,source2Resolved:e2?.ti!=null,
      venue:v,venueLabel:v,__venue:v,mainBlock:v,cleanMainDraw:true,v1014CleanMain:true,v1013CleanMain:true,v1012CleanMain:true,v1007CleanMain:true,v1003CleanMain:true,createdAt:now(),updatedAt:now()};
    m.autoCourtLabel=(m.display1||m.source1Label||'TBD')+' vs '+(m.display2||m.source2Label||'TBD');
    return m;
  }
  async function persist(key){
    try{ if(window.__FB_WRITE_CACHE){ if(__FB_WRITE_CACHE.draws) delete __FB_WRITE_CACHE.draws[key]; if(__FB_WRITE_CACHE.matches) delete __FB_WRITE_CACHE.matches[key]; } }catch(e){}
    try{ if(typeof window.stM==='function') await window.stM(key); else if(typeof stM==='function') await stM(key); }catch(e){console.warn('[v1003] stM failed',e)}
    try{ if(typeof window.stD==='function') await window.stD(key); else if(typeof stD==='function') await stD(key); }catch(e){console.warn('[v1003] stD failed',e)}
    try{ if(typeof window.waitForPendingWrites==='function' && window.db) await window.waitForPendingWrites(window.db); }catch(e){}
  }
  async function generateDraw(key, mode){
    key=key||selectedKey(); if(!key){toast('대회와 부서를 먼저 선택하세요','error');return false;}
    const groups=ar(G&&G.draws&&G.draws[key]&&G.draws[key].groups);
    if(!groups.length){toast('예선 조편성 후 본선 슬롯 추첨을 실행하세요.','info'); renderInfo(key); return false;}
    const entries=collectEntries(key); if(entries.length<2){toast('본선 슬롯을 만들 수 없습니다. 조편성을 먼저 확인하세요.','error');return false;}
    const size=nextPow2(entries.length); const matchCount=size/2;
    let pairs=[];
    if(entries.filter(e=>e.rk===1).length===entries.filter(e=>e.rk===2).length){ pairs=pairRank1Rank2(entries); }
    if(!pairs.length){ const q=entries.slice(); while(q.length){pairs.push([q.shift(),q.shift()||null]);} }
    while(pairs.length<matchCount) pairs.push([null,null]);
    const venues=venueForSlots(key,matchCount,mode,pairs);
    const old=ar(G.matches&&G.matches[key]).filter(m=>String(m.phase||'')!=='main' && String(m.phase||'')!=='playin');
    const mains=pairs.slice(0,matchCount).map((p,i)=>makeMatch(key,i,p[0],p[1],venues[i],size));
    G.matches[key]=old.concat(mains);
    const sig=groupStructureSignature(key);
    G.draws[key]=Object.assign({},G.draws[key]||{}, {cleanMainDraw:true,cleanMainDrawVersion:VERSION,mainDrawMode:mode,mainDrawSize:size,mainDrawAt:now(),mainDrawRandomSeed:String(Date.now())+'_'+Math.random().toString(36).slice(2,8),mainDrawGroupStructureSignature:sig,mainDrawResultSignature:groupResultSignature(key),mainDrawVenueSegments:segments(venues)});
    resolveCleanMatches(key,true);
    repairSegmentVenues(key,false);
    await persist(key);
    try{ if(typeof window.renderBracket==='function') window.renderBracket(); }catch(e){}
    setTimeout(()=>{ensurePanel(); hideLegacyMainUi(); renderClean(key);},150);
    const unresolved=mains.filter(m=>!m.source1Resolved||!m.source2Resolved).length;
    toast(`새 본선 슬롯 추첨 완료: ${size}강 · ${mains.length}경기${unresolved?' · 일부는 예선 결과 입력 후 실명 자동 대체':''}`,'success');
    return true;
  }
  function segments(venues){const out=[]; venues.forEach((v,i)=>{let last=out[out.length-1]; if(!last||last.venue!==v) out.push({venue:v,start:i,end:i,count:1}); else{last.end=i;last.count++;}}); return out;}
  function expandSegmentsToVenues(draw,count){
    const arr=Array(Number(count)||0).fill('');
    let ok=false;
    ar(draw&&draw.mainDrawVenueSegments).forEach(s=>{
      const v=venueKo(s&&s.venue);
      const a=Number(s&&s.start), b=Number(s&&s.end);
      if(!v || !Number.isFinite(a) || !Number.isFinite(b)) return;
      for(let i=Math.max(0,a); i<=Math.min(arr.length-1,b); i++){ arr[i]=v; ok=true; }
    });
    return ok && arr.every(Boolean) ? arr : [];
  }
  function repairSegmentVenues(key, forceRecompute){
    try{
      const draw=(G&&G.draws&&G.draws[key])||{};
      const mains=ar(G&&G.matches&&G.matches[key]).filter(m=>String(m.phase||'')==='main'&&m.cleanMainDraw).sort((a,b)=>mainQueueNumber(a)-mainQueueNumber(b)||Number(a.slot||0)-Number(b.slot||0));
      if(!mains.length) return {changed:false, venues:[]};
      const count=mains.length;
      let venues=expandSegmentsToVenues(draw,count);
      const available=venueGroups(key).map(v=>v.venue).filter(Boolean);
      const mustRecompute = !!forceRecompute || !venues.length || (available.includes('능동') && !venues.includes('능동'));
      if(mustRecompute){
        venues=venueForSlots(key,count,'redistribute',mains.map(m=>[null,null]));
      }
      if(!venues.length) return {changed:false, venues:[]};
      let changed=false;
      mains.forEach((m,i)=>{
        const slot=Number(m.slot||i);
        const v=venueKo(venues[slot] || venues[i] || venues[0] || '국제');
        if(venueKo(m.venue||m.venueLabel||m.__venue)!==v){ changed=true; }
        m.venue=v; m.venueLabel=v; m.__venue=v; m.mainBlock=v;
        normalizeCleanMatchDisplay(key,m);
      });
      const nextSeg=segments(venues.map(venueKo));
      const oldSig=JSON.stringify(ar(draw.mainDrawVenueSegments));
      const newSig=JSON.stringify(nextSeg);
      if(oldSig!==newSig){ draw.mainDrawVenueSegments=nextSeg; changed=true; }
      draw.v1016VenueSegmentEnforcedAt=now();
      const q=assignQueueSeqBySegments(key,mains);
      if(q.changed) changed=true;
      return {changed, venues};
    }catch(e){ console.warn('[v1018] venue repair failed', e); return {changed:false, venues:[]}; }
  }
  function readyForCourt(m){
    if(!m || m.winner!=null) return false;
    normalizeCleanMatchDisplay('', m);
    const bye=isByeLabel(m.display2||m.source2Label||m.nameOnly2||'');
    // v1021: 기존 결과저장 경로가 t1/t2 인덱스를 채우지 않아도, 화면에 실제 팀명이 들어온 카드는 운영 카드로 취급한다.
    // 슬롯(예: 7조 2위, TBD)은 제외하고, 실제 이름이 보이는 양쪽 카드부터 공용대기/코트대기에 투입한다.
    return sideReadyForOperation(m,1) && (sideReadyForOperation(m,2) || bye);
  }
  function clearCleanCourtFields(m){
    if(!m) return;
    m.court=''; m.courts=[]; m.manualCourtTarget=''; m.__sharedCourtLabel='';
    delete m.currentCourt; delete m.v1011CourtRole; delete m.v1011SharedWait; delete m.v1011SharedCourt;
    delete m.manualSharedHold; delete m.__manualSharedHold;
    delete m.waitingFirstAt; delete m.lastWaitingFirstAt; delete m.courtAssignedAt; delete m.manualCourtPinnedAt; delete m.courtQueueOrder;
  }
  function markCurrent(m,c,orderIso){
    const q=mainQueueNumber(m);
    m.court=c; m.courts=[c]; m.manualCourtTarget=c;
    m.manualSharedHold=false; m.__manualSharedHold=false; m.v1011SharedWait=false; m.v1011CourtRole='current';
    m.__sharedCourtLabel=''; m.v1011SharedCourt='';
    m.__mainQueueOrder=q; m.v1011QueueOrder=q; m.v1019QueueSeq=q; m.mainQueueSeq=q;
    m.courtAssignedAt=orderIso; m.manualCourtPinnedAt=orderIso; m.courtQueueOrder=queueOrderIso(m);
    delete m.waitingFirstAt; delete m.lastWaitingFirstAt;
    m.manualCourtLocked=true; m.manualCourtLockedAt=m.manualCourtLockedAt||now();
  }
  function markWaiting1(m,c,orderIso){
    const q=mainQueueNumber(m);
    m.court=''; m.courts=[c]; m.manualCourtTarget=c;
    m.manualSharedHold=false; m.__manualSharedHold=false; m.v1011SharedWait=false; m.v1011CourtRole='waiting1';
    m.__sharedCourtLabel=''; m.v1011SharedCourt='';
    m.__mainQueueOrder=q; m.v1011QueueOrder=q; m.v1019QueueSeq=q; m.mainQueueSeq=q;
    m.waitingFirstAt=orderIso; m.courtAssignedAt=orderIso; m.manualCourtPinnedAt=orderIso; m.courtQueueOrder=queueOrderIso(m);
    m.manualCourtLocked=true; m.manualCourtLockedAt=m.manualCourtLockedAt||now();
  }
  function markShared(m,c,orderIso,queueOrder){
    const q=Number.isFinite(Number(queueOrder)) ? Number(queueOrder) : mainQueueNumber(m);
    m.court=''; m.courts=[]; m.manualCourtTarget='';
    m.manualSharedHold=true; m.__manualSharedHold=true;
    m.__sharedCourtLabel=c||''; m.v1011SharedCourt=c||''; m.v1011SharedWait=true; m.v1011CourtRole='shared';
    m.__mainQueueOrder=q; m.v1011QueueOrder=q; m.v1019QueueSeq=q; m.mainQueueSeq=q;
    m.waitingFirstAt=orderIso; m.courtAssignedAt=orderIso; m.manualCourtPinnedAt=orderIso; m.courtQueueOrder=queueOrderIso(m);
    m.manualCourtLocked=true; m.manualCourtLockedAt=m.manualCourtLockedAt||now();
  }
  function cleanMainStatus(key,m){
    try{
      normalizeCleanMatchDisplay(key,m);
      const court=S(m.court||m.currentCourt||'');
      const wait=S(m.manualCourtTarget||(Array.isArray(m.courts)&&m.courts[0])||'');
      const shared=S(m.__sharedCourtLabel||m.v1011SharedCourt||'');
      const label=mainRoundLabel(Number((G&&G.draws&&G.draws[key]&&G.draws[key].mainDrawSize)||m.bracketN||64)||64, Number(m.round||0)||0);
      if(court) return {kind:'current', text:`시합중 · ${court}`, chip:'시합중', detail:`${court} 현재경기`, label};
      if(wait) return {kind:'wait1', text:`코트 대기1 · ${wait}`, chip:'대기1', detail:`${wait} 대기1`, label};
      if(m.manualSharedHold||m.__manualSharedHold||m.v1011SharedWait) return {kind:'shared', text:`공용대기 · ${shared||venueKo(m.venue)||''}`, chip:'공용', detail:`${shared||venueKo(m.venue)||''} 공용대기`, label};
      if(readyForCourt(m)) return {kind:'ready', text:'배정 대기', chip:'준비', detail:'배정 대기', label};
      return {kind:'slot', text:'슬롯 대기', chip:'슬롯', detail:'예선 결과 대기', label};
    }catch(e){ return {kind:'slot', text:'슬롯 대기', chip:'슬롯', detail:'예선 결과 대기', label:'본선'}; }
  }
  function hasMainCourtAssignment(key){
    try{ const d=G&&G.draws&&G.draws[key]; return !!(d&&(d.v1019MainQueueEnabled||d.v1011MainCourtAssignment||d.v1014MainCourtAssignment||d.v1011MainCourtAssignedAt||d.v1014MainCourtAssignedAt)); }catch(e){ return false; }
  }
  function isCleanAssigned(m){
    return !!(S(m&&m.court)||S(m&&m.manualCourtTarget)||ar(m&&m.courts).length||S(m&&m.__sharedCourtLabel)||m?.manualSharedHold||m?.__manualSharedHold||m?.v1011SharedWait);
  }
  function buildCourtOccupancy(key, excludeIds){
    const vg=venueGroups(key); const byVenue={}; vg.forEach(v=>byVenue[v.venue]=v.courts.slice());
    const allCourts=Object.values(byVenue).flat();
    const occ={}; allCourts.forEach(c=>occ[c]={cur:0,wait:0});
    ar(G.matches&&G.matches[key]).filter(m=>m&&m.winner==null&&!excludeIds.has(S(m.id))).forEach(m=>{
      const c=S(m.court||m.currentCourt||''); if(c&&occ[c]) occ[c].cur++;
      const w=S(m.manualCourtTarget||(Array.isArray(m.courts)&&m.courts[0])||''); if(w&&occ[w]) occ[w].wait++;
    });
    return {vg,byVenue,allCourts,occ};
  }
  function placeCleanMatches(key, mains, opts){
    opts=opts||{};
    const excludeIds=new Set(mains.map(m=>S(m.id)));
    const {vg,byVenue,allCourts,occ}=buildCourtOccupancy(key,excludeIds);
    if(!allCourts.length) return {currentCnt:0,waitCnt:0,sharedCnt:0,noCourts:true};
    let currentCnt=0, waitCnt=0, sharedCnt=0;
    const base=Date.now();
    sortedByMainQueue(mains).forEach((m,i)=>{
      const v=venueKo(m.venue||m.venueLabel||m.__venue)||vg[0].venue;
      const baseCourts=(byVenue[v]&&byVenue[v].length?byVenue[v]:allCourts);
      const courts=rotatedCourtsForMatch(m,baseCourts);
      const orderIso=new Date(base + i*1000).toISOString();
      let placed=false;
      for(const c of courts){ const o=occ[c]||(occ[c]={cur:0,wait:0}); if(o.cur===0){ markCurrent(m,c,orderIso); o.cur++; currentCnt++; placed=true; break; } }
      if(!placed){ for(const c of courts){ const o=occ[c]||(occ[c]={cur:0,wait:0}); if(o.wait===0){ markWaiting1(m,c,orderIso); o.wait++; waitCnt++; placed=true; break; } } }
      if(!placed){ const target=courts[0]||allCourts[0]||''; markShared(m,target,orderIso,mainQueueNumber(m)); sharedCnt++; }
      m.updatedAt=now();
    });
    return {currentCnt,waitCnt,sharedCnt,noCourts:false};
  }
  const __autoQueueState={};
  function scheduleAutoQueueResolved(key){
    try{
      key=key||selectedKey(); if(!key||!hasMainCourtAssignment(key)) return;
      if(__autoQueueState[key]) return;
      __autoQueueState[key]=setTimeout(()=>{ __autoQueueState[key]=null; autoQueueResolvedAfterPrelim(key).catch(e=>console.warn('[v1019] auto queue failed',e)); }, 350);
    }catch(e){}
  }
  function promoteSharedToOpenSlots(key){
    const shared=ar(G&&G.matches&&G.matches[key])
      .filter(m=>m&&m.cleanMainDraw&&m.winner==null&&readyForCourt(m)&&(m.manualSharedHold||m.__manualSharedHold||m.v1011SharedWait)&&!S(m.manualCourtTarget)&&!S(m.court))
      .sort((a,b)=>{
        const av=venueKo(a.venue||a.venueLabel||a.__venue), bv=venueKo(b.venue||b.venueLabel||b.__venue);
        const ai=VENUE_ORDER.indexOf(av)<0?999:VENUE_ORDER.indexOf(av), bi=VENUE_ORDER.indexOf(bv)<0?999:VENUE_ORDER.indexOf(bv);
        if(ai!==bi) return ai-bi;
        const aq=Number(a.__mainQueueOrder!=null?a.__mainQueueOrder:a.v1011QueueOrder||a.slot||9999);
        const bq=Number(b.__mainQueueOrder!=null?b.__mainQueueOrder:b.v1011QueueOrder||b.slot||9999);
        if(aq!==bq) return aq-bq;
        return S(a.id).localeCompare(S(b.id),'ko');
      });
    if(!shared.length) return {changed:false,currentCnt:0,waitCnt:0};
    const excludeIds=new Set(shared.map(m=>S(m.id)));
    const {vg,byVenue,allCourts,occ}=buildCourtOccupancy(key,excludeIds);
    if(!allCourts.length) return {changed:false,currentCnt:0,waitCnt:0,noCourts:true};
    let changed=false,currentCnt=0,waitCnt=0;
    const base=Date.now()+500000;
    shared.forEach((m,i)=>{
      const v=venueKo(m.venue||m.venueLabel||m.__venue)||vg[0].venue;
      const baseCourts=(byVenue[v]&&byVenue[v].length?byVenue[v]:allCourts);
      const courts=rotatedCourtsForMatch(m,baseCourts);
      const orderIso=new Date(base+i*1000).toISOString();
      let placed=false;
      // 빈 코트가 있으면 바로 현재경기로, 이미 현재경기가 있으면 대기1까지만 붙인다.
      for(const c of courts){ const o=occ[c]||(occ[c]={cur:0,wait:0}); if(o.cur===0){ markCurrent(m,c,orderIso); o.cur++; currentCnt++; placed=true; changed=true; break; } }
      if(!placed){ for(const c of courts){ const o=occ[c]||(occ[c]={cur:0,wait:0}); if(o.wait===0){ markWaiting1(m,c,orderIso); o.wait++; waitCnt++; placed=true; changed=true; break; } } }
      if(!placed){
        // 모든 코트가 현재+대기1로 찼으면 공용대기 유지. 라벨만 정규화한다.
        const target=courts[0]||allCourts[0]||'';
        if(S(m.__sharedCourtLabel||m.v1011SharedCourt)!==target){ markShared(m,target,orderIso,mainQueueNumber(m)); changed=true; }
      }
      if(changed) m.updatedAt=now();
    });
    return {changed,currentCnt,waitCnt,noCourts:false};
  }
  async function refreshLiveMainQueue(key, reason){
    key=key||selectedKey();
    const reasonText=String(reason||'auto');
    const manualReasonPre=/manual|button|assign|force/i.test(reasonText);
    if(!key) return false;
    if(!hasMainCourtAssignment(key) && !manualReasonPre) return false;
    if(!hasMainCourtAssignment(key) && manualReasonPre){
      try{ if(G.draws&&G.draws[key]){ G.draws[key].v1019MainQueueEnabled=true; G.draws[key].v1011MainCourtAssignment='manual_queue_refresh_enabled'; G.draws[key].v1011MainCourtAssignedAt=now(); } }catch(e){}
    }
    // v1020: watchdog/interval은 실제 신규 본선 운영카드 생성이나 승격이 있을 때만 저장·렌더·토스트를 한다.
    // 이전 버전은 구간/라벨 정리만 해도 changed=true가 되어 초록 토스트가 2~3초마다 반복됐다.
    const manualReason=manualReasonPre;
    let changed=false;
    let meaningful=false;
    resolveCleanMatches(key,true);
    const rep=repairSegmentVenues(key,false);
    if(rep.changed){ changed=true; }
    const targets=ar(G.matches&&G.matches[key])
      .filter(m=>String(m.phase||'')==='main'&&m.cleanMainDraw&&!m.winner&&readyForCourt(m)&&!isCleanAssigned(m))
      .sort((a,b)=>mainQueueNumber(a)-mainQueueNumber(b)||Number(a.slot||0)-Number(b.slot||0));
    let res={currentCnt:0,waitCnt:0,sharedCnt:0,noCourts:false};
    if(targets.length){
      res=placeCleanMatches(key,targets,{auto:true});
      if(!res.noCourts){ changed=true; meaningful=true; }
    }
    const promo=promoteSharedToOpenSlots(key);
    if(promo.changed){
      changed=true;
      if((promo.currentCnt||0)>0 || (promo.waitCnt||0)>0) meaningful=true;
    }
    if(!changed) return false;
    // 자동 감시에서는 '정리 완료'만 반복되는 유지보수성 변경은 화면/DB를 흔들지 않는다.
    if(!meaningful && !manualReason) return false;
    try{ if(G.draws&&G.draws[key]){ G.draws[key].v1020MainQueueRefreshedAt=now(); G.draws[key].v1020MainQueueReason=reasonText; G.draws[key].v1016MainQueueRefreshedAt=now(); G.draws[key].v1016MainQueueReason=reasonText; } }catch(e){}
    await persist(key);
    try{ if(typeof window.renderBracket==='function') window.renderBracket(); }catch(e){}
    setTimeout(()=>{installSharedQueueBridge(); installCourtBoardCleanPatch(); ensurePanel(); hideLegacyMainUi(); renderClean(key);},120);
    const msg=[];
    if(targets.length) msg.push(`신규 ${targets.length}경기`);
    if(promo.changed && ((promo.currentCnt||0)>0 || (promo.waitCnt||0)>0)) msg.push(`공용대기 승격 현재 ${promo.currentCnt} · 대기1 ${promo.waitCnt}`);
    if(manualReason || meaningful) toast(`본선 대기열 갱신: ${msg.join(' · ')||'변경 없음'}`,'success');
    return meaningful || manualReason;
  }
  async function autoQueueResolvedAfterPrelim(key){
    return refreshLiveMainQueue(key,'prelim_result_or_queue_change');
  }
  async function assignCourts(key){
    key=key||selectedKey(); if(!key){toast('대회와 부서를 먼저 선택하세요','error');return false;}
    resolveCleanMatches(key,true);
    repairSegmentVenues(key,false);
    let mains=ar(G.matches&&G.matches[key]).filter(m=>String(m.phase||'')==='main'&&m.cleanMainDraw&&!m.winner).sort((a,b)=>mainQueueNumber(a)-mainQueueNumber(b)||Number(a.slot||0)-Number(b.slot||0));
    if(!mains.length){toast('배정할 새 본선 경기가 없습니다. 먼저 새 본선 추첨을 실행하세요.','info');return false;}
    const unresolved=mains.filter(m=>!readyForCourt(m));
    mains=mains.filter(readyForCourt);
    if(!mains.length){
      try{ if(G.draws&&G.draws[key]){ G.draws[key].v1019MainQueueEnabled=true; G.draws[key].v1011MainCourtAssignedAt=now(); G.draws[key].v1011MainCourtAssignment='staged_shared_queue_waiting_for_ready'; G.draws[key].v1014MainCourtAssignedAt=now(); G.draws[key].v1014MainCourtAssignment='staged_shared_queue_waiting_for_ready'; } }catch(e){}
      await persist(key);
      try{ if(typeof window.renderBracket==='function') window.renderBracket(); }catch(e){}
      setTimeout(()=>{ensurePanel(); hideLegacyMainUi(); renderClean(key);},150);
      toast('본선 자동 배정 대기 ON: 양쪽 팀명이 확정되는 카드부터 공용대기/코트대기로 자동 투입됩니다.','success');
      return true;
    }
    ar(G.matches&&G.matches[key]).filter(m=>String(m.phase||'')==='main'&&m.cleanMainDraw).forEach(clearCleanCourtFields);
    const res=placeCleanMatches(key,mains,{manual:true});
    if(res.noCourts){toast('본선 사용 코트를 찾을 수 없습니다. 대회 부서의 본선 사용 코트를 확인하세요.','error');return false;}
    try{ if(G.draws&&G.draws[key]){ G.draws[key].v1019MainQueueEnabled=true; G.draws[key].v1011MainCourtAssignedAt=now(); G.draws[key].v1011MainCourtAssignment='staged_shared_queue_balanced'; G.draws[key].v1014MainCourtAssignedAt=now(); G.draws[key].v1014MainCourtAssignment='staged_shared_queue_balanced_auto_follow'; } }catch(e){}
    await persist(key); try{if(typeof window.renderBracket==='function') window.renderBracket();}catch(e){}
    setTimeout(()=>{installSharedQueueBridge(); ensurePanel(); hideLegacyMainUi(); renderClean(key);},150);
    toast(`새 본선 코트배정 완료: 현재경기 ${res.currentCnt} · 코트대기1 ${res.waitCnt} · 공용대기 ${res.sharedCnt}${unresolved.length?' · 미확정 '+unresolved.length+'경기 보류':''}`,'success'); return true;
  }
  function renderInfo(key){ const box=$('v1003CleanBracket'); if(!box)return; box.innerHTML='<div class="v1003-empty">예선 조편성이 끝나면 조 순위 슬롯으로 새 본선 추첨을 미리 할 수 있습니다. 결과가 입력되면 1조 1위 같은 슬롯이 실제 팀명으로 자동 대체됩니다.</div>'; }
  function renderClean(key){
    if(!cleanMainPrivileged()) return;
    key=key||selectedKey(); const box=$('v1003CleanBracket'); if(!box)return;
    if(!key){box.innerHTML='<div class="v1003-empty">대회와 부서를 선택하세요.</div>';return;}
    const draw=(G.draws&&G.draws[key])||{};
    if(draw.mainDrawGroupStructureSignature && draw.mainDrawGroupStructureSignature!==groupStructureSignature(key)){box.innerHTML='<div class="v1003-empty">예선 조편성이 변경되어 기존 본선 슬롯 대진은 무효입니다. 새 본선 추첨을 다시 실행하세요.</div>';return;}
    resolveCleanMatches(key,true);
    repairSegmentVenues(key,false);
    const mains=ar(G.matches&&G.matches[key]).filter(m=>String(m.phase||'')==='main'&&m.cleanMainDraw).sort((a,b)=>mainQueueNumber(a)-mainQueueNumber(b)||Number(a.slot||0)-Number(b.slot||0));
    if(!mains.length){box.innerHTML='<div class="v1003-empty">새 본선 대진이 없습니다. 위 버튼으로 새 본선 추첨을 실행하세요.</div>';return;}
    const size=Number(draw.mainDrawSize||mains[0]?.bracketN||mains.length*2)||mains.length*2;
    const seg=ar(draw.mainDrawVenueSegments).map(s=>{const v=venueKo(s.venue); return `<span class="v1003-seg" style="border-color:${VENUE_COLOR[v]||VENUE_COLOR.기타};color:${VENUE_COLOR[v]||VENUE_COLOR.기타};background:${VENUE_BG[v]||VENUE_BG.기타}">${esc(v)} ${s.start+1}~${s.end+1}경기</span>`;}).join('');
    box.innerHTML=`<div class="v1003-head"><b>새 가지형 본선 대진표 · ${size}강부터 시작</b><div>${seg}</div></div>${renderBracketTree(mains,size)}`;
    scheduleAutoQueueResolved(key);
  }
  function roundLabel(size, ri){ return mainRoundLabel(size,ri); }
  function renderBracketTree(mains,size){
    const rounds=[];
    const first=mains.slice();
    rounds.push(first.map((m,i)=>({type:'match',match:m,idx:i})));
    let cnt=Math.max(1, Math.floor(first.length/2));
    for(let r=1; cnt>=1; r++, cnt=Math.floor(cnt/2)){
      rounds.push(Array.from({length:cnt},(_,i)=>({type:'placeholder',round:r,idx:i})));
      if(cnt===1) break;
    }
    return `<div class="v1004-bracket-wrap"><div class="v1004-bracket">${rounds.map((items,ri)=>`<div class="v1004-round"><div class="v1004-round-title">${roundLabel(size,ri)}</div><div class="v1004-round-body">${items.map((it,i)=> it.type==='match'?bracketMatchCard(it.match,it.idx):placeholderCard(ri,i)).join('')}</div></div>`).join('')}</div></div>`;
  }
  function bracketMatchCard(m,i){
    normalizeCleanMatchDisplay(selectedKey(),m);
    const v=venueKo(m.venue||m.venueLabel||m.__venue)||'기타'; const c=VENUE_COLOR[v]||VENUE_COLOR.기타,b=VENUE_BG[v]||VENUE_BG.기타;
    const a=esc(nameOnlyFromLabel(m.display1||m.source1Label||'TBD')); const z=esc(nameOnlyFromLabel(m.display2||m.source2Label||'TBD'));
    const st=cleanMainStatus(selectedKey(),m);
    const statusHtml=`<div class="v1004-bstatus v1004-status-${esc(st.kind)}">${esc(st.text)}</div>`;
    return `<div class="v1004-bmatch v1004-${esc(st.kind)}" style="--venue-color:${c};--venue-bg:${b}"><div class="v1004-bmatch-top"><b>${i+1}경기</b><span>${esc(v)}</span></div><div class="v1004-bslot">${a}<small>0</small></div><div class="v1004-bslot">${z}<small>0</small></div>${statusHtml}<div class="v1004-bsrc">${esc(m.source1Label||'')} / ${esc(m.source2Label||'')}</div></div>`;
  }
  function placeholderCard(ri,i){
    return `<div class="v1004-bmatch v1004-placeholder"><div class="v1004-bmatch-top"><b>${i+1}경기</b></div><div class="v1004-bslot">TBD<small>0</small></div><div class="v1004-bslot">TBD<small>0</small></div><div class="v1004-bsrc">이전 라운드 승자</div></div>`;
  }
  function ensureStyle(){ if($('v1003Style'))return; const st=document.createElement('style'); st.id='v1003Style'; st.textContent=`
    #v1003MainPanel{margin:12px 0 16px;padding:16px;border:2px solid #bfdbfe;border-radius:18px;background:linear-gradient(180deg,#f8fbff,#fff);box-shadow:0 12px 28px rgba(15,30,58,.08)}
    .v1003-title{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;font-weight:1000;color:#0f1e3a}.v1003-title small{font-size:.72rem;color:#64748b;font-weight:800}.v1003-controls{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;margin-bottom:10px}.v1003-select{min-height:40px;border:1.5px solid #cbd5e1;border-radius:12px;padding:8px 10px;font-weight:900}.v1003-btn{border:0;border-radius:12px;min-height:40px;padding:8px 13px;font-weight:1000;cursor:pointer}.v1003-btn.primary{background:#2563eb;color:#fff}.v1003-btn.purple{background:#7c3aed;color:#fff}.v1003-note{font-size:.78rem;color:#475569;line-height:1.55;margin-bottom:12px}.v1003-empty{padding:18px;border:1px dashed #cbd5e1;border-radius:14px;text-align:center;color:#64748b;font-weight:900;background:#f8fafc}.v1003-head{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px}.v1003-seg{display:inline-flex;padding:4px 8px;border:1.5px solid;border-radius:999px;font-size:.72rem;font-weight:1000;margin:2px}.v1003-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.v1003-card{border:1px solid #e2e8f0;border-left:7px solid #2563eb;border-radius:14px;padding:10px 12px}.v1003-card-top{display:flex;justify-content:space-between;font-size:.76rem;font-weight:1000;color:#334155;margin-bottom:8px}.v1003-card-top span{color:#fff;border-radius:999px;padding:3px 8px;font-size:.7rem}.v1003-teams{display:grid;grid-template-columns:1fr 30px 1fr;gap:8px;text-align:center;align-items:center;font-weight:1000}.v1003-teams em{font-style:normal;font-size:.7rem;color:#64748b}.v1003-src{text-align:center;margin-top:6px;font-size:.68rem;color:#64748b;font-weight:800}.v1003-legacy-hidden{display:none!important;visibility:hidden!important;pointer-events:none!important}
    #bracketContent [id^="mainStage_"], #bracketContent .v1013-legacy-main-tree-hidden{display:none!important;visibility:hidden!important;pointer-events:none!important}

    .v1004-bracket-wrap{overflow-x:auto;padding:6px 2px 10px;-webkit-overflow-scrolling:touch}.v1004-bracket{display:flex;align-items:stretch;gap:18px;min-width:max-content}.v1004-round{display:flex;flex-direction:column;min-width:220px}.v1004-round-title{background:#0f1e3a;color:#fff;text-align:center;font-weight:1000;border-radius:8px 8px 0 0;padding:7px 10px;font-size:.86rem}.v1004-round-body{display:flex;flex-direction:column;gap:10px;justify-content:space-around;flex:1;padding-top:10px}.v1004-bmatch{position:relative;border:1.5px solid #cbd5e1;border-left:7px solid var(--venue-color,#2563eb);border-radius:12px;background:linear-gradient(90deg,var(--venue-bg,#eff6ff),#fff);box-shadow:0 3px 12px rgba(15,30,58,.08);overflow:hidden}.v1004-bmatch:after{content:'';position:absolute;right:-19px;top:50%;width:18px;height:2px;background:#bfdbfe}.v1004-round:last-child .v1004-bmatch:after{display:none}.v1004-bmatch-top{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 8px;font-size:.72rem;color:#334155}.v1004-bmatch-top span{display:inline-flex;align-items:center;border-radius:999px;background:var(--venue-color,#2563eb);color:#fff;padding:2px 7px;font-size:.68rem;font-weight:1000}.v1004-bslot{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid #e2e8f0;padding:7px 8px;font-size:.8rem;font-weight:900;line-height:1.3;min-height:34px}.v1004-bslot small{font-family:Oswald,sans-serif;color:#94a3b8;font-size:.86rem}.v1004-bsrc{text-align:center;border-top:1px dashed #e2e8f0;padding:5px 8px;font-size:.66rem;color:#64748b;font-weight:800}.v1004-placeholder{background:#f8fafc;border-left-color:#cbd5e1}.v1004-placeholder .v1004-bmatch-top span{display:none}.v1004-bstatus{border-top:1px dashed #e2e8f0;padding:5px 8px;font-size:.68rem;font-weight:1000;color:#475569;background:rgba(255,255,255,.65)}.v1004-status-current{color:#b45309;background:#fff7ed}.v1004-status-wait1{color:#1d4ed8;background:#eff6ff}.v1004-status-shared{color:#0f766e;background:#ecfdf5}.v1004-status-ready{color:#7c3aed;background:#f5f3ff}.v1004-status-slot{color:#64748b;background:#f8fafc}
    @media(max-width:680px){.v1003-controls{grid-template-columns:1fr}.v1003-grid{grid-template-columns:1fr}.v1003-btn{width:100%}}
  `; document.head.appendChild(st); }
  function ensurePanel(){
    ensureStyle();
    let panel=$('v1003MainPanel');
    if(!cleanMainPrivileged()){
      if(panel){
        panel.classList.add('v1003-public-hidden');
        panel.style.setProperty('display','none','important');
        panel.style.setProperty('visibility','hidden','important');
        panel.style.setProperty('pointer-events','none','important');
      }
      return;
    }
    const page=$('page-bracket')||document.body;
    const html=`<div class="v1003-title"><div>🏆 새 본선 운영 패널 <small>${VERSION}</small></div><small>기존 본선 고정/확정/128고정 사용 안 함</small></div><div class="v1003-controls"><select id="v1003MainMode" class="v1003-select"><option value="redistribute">전체 재배정 · 코트 수 많은 구장부터 위쪽 배정</option><option value="keep">예선 구장 유지 · 예선 출신 구장별 운영</option></select><button type="button" id="v1003DrawBtn" class="v1003-btn primary">🎲 새 본선 추첨</button><button type="button" id="v1003AssignBtn" class="v1003-btn purple">🎯 본선 자동배정 ON</button></div><div class="v1003-note">예선 진행 중에도 조 순위 슬롯으로 본선 추첨이 가능합니다. 64팀 본선은 64드로, 부전승 없음, 1회전은 조1위 vs 조2위입니다. 결과 입력 시 슬롯은 실제 팀명으로 자동 대체되고, 양쪽이 확정된 카드부터 균등 운영순서에 따라 공용대기/코트대기로 자동 투입됩니다.</div><div id="v1003CleanBracket"></div>`;
    if(!panel){
      panel=document.createElement('div');
      panel.id='v1003MainPanel';
      panel.innerHTML=html;
      const a=page.querySelector('.sec-title')||page.firstElementChild;
      if(a&&a.parentNode)a.parentNode.insertBefore(panel,a.nextSibling); else page.prepend(panel);
    }else if(panel.dataset.cleanVersion!==VERSION || !panel.querySelector('#v1003DrawBtn') || !panel.querySelector('#v1003AssignBtn') || !panel.querySelector('#v1003MainMode')){
      // 기존 v1002~v1007 패널 찌꺼기가 남아 있으면 버튼까지 포함한 새 패널로 강제 재구성한다.
      panel.innerHTML=html;
    }
    panel.dataset.cleanVersion=VERSION;
    panel.classList.remove('v1003-legacy-hidden','v1003-public-hidden','v979-admin-hidden','v977-hidden-admin-panel');
    panel.style.removeProperty('display');
    panel.style.display='block';
    panel.style.visibility='visible';
    panel.style.pointerEvents='auto';
    const drawBtn=$('v1003DrawBtn');
    const assignBtn=$('v1003AssignBtn');
    if(drawBtn) drawBtn.onclick=()=>generateDraw(selectedKey(),$('v1003MainMode')?.value||'redistribute');
    if(assignBtn) assignBtn.onclick=()=>assignCourts(selectedKey());
    forcePanelVisible();
    renderClean(selectedKey());
  }
  function forcePanelVisible(){
    try{
      const panel=$('v1003MainPanel');
      if(panel){
        panel.classList.remove('v1003-legacy-hidden','v977-hidden-admin-panel');
        panel.style.setProperty('display','block','important');
        panel.style.setProperty('visibility','visible','important');
        panel.style.setProperty('opacity','1','important');
        panel.style.setProperty('pointer-events','auto','important');
      }
      document.querySelectorAll('#v1003MainPanel .v1003-controls,#v1003MainPanel #v1003DrawBtn,#v1003MainPanel #v1003AssignBtn,#v1003MainPanel #v1003MainMode,#v1003MainPanel .v1003-note,#v1003CleanBracket').forEach(el=>{
        el.classList.remove('v1003-legacy-hidden','v977-hidden-admin-panel');
        const display = el.id==='v1003DrawBtn'||el.id==='v1003AssignBtn' ? 'inline-flex' : (el.classList.contains('v1003-controls') ? 'grid' : 'block');
        el.style.setProperty('display', display, 'important');
        el.style.setProperty('visibility','visible','important');
        el.style.setProperty('opacity','1','important');
        el.style.setProperty('pointer-events','auto','important');
      });
    }catch(e){}
  }
  function hideLegacyMainUi(){try{
    document.querySelectorAll('button').forEach(btn=>{const t=S(btn.textContent).replace(/\s+/g,''); if(btn.closest('#v1003MainPanel,#v1005MainDrawQuickBar,#v1005MainDrawFloat')) return; if(/본선확정|본선잠금|본선공개|128강|128고정|수동128|본선시드|본선추첨|본선코트배정/.test(t)) btn.classList.add('v1003-legacy-hidden');});
    const modal=$('mMain'); if(modal) modal.classList.add('v1003-legacy-hidden');
    document.querySelectorAll('#bracketContent .t-bracket,#bracketContent .t-round,#bracketContent [id^="mainStage_"]').forEach(el=>{ if(!el.closest('#v1003MainPanel')){ const p=el.closest('.card,section,div')||el; p.classList.add('v1003-legacy-hidden'); }}); hideLegacyTreeOnly();
  }catch(e){}}
  function hideLegacyTreeOnly(){try{
    const re=/본선\s*(?:토너먼트\s*)?대진표|본선\s*나무가지|본선\s*구조\s*미리보기/;
    document.querySelectorAll('#bracketContent [id^="mainStage_"], #bracketContent .t-bracket, #bracketContent .t-round').forEach(el=>{
      if(el.closest('#v1003MainPanel')) return;
      (el.closest('.card,section,article')||el).classList.add('v1013-legacy-main-tree-hidden');
    });
    document.querySelectorAll('#bracketContent .card, #bracketContent section, #bracketContent article').forEach(el=>{
      if(el.closest('#v1003MainPanel')) return;
      const txt=(el.innerText||'').replace(/\s+/g,' ').trim();
      if(!txt || txt.length>1800) return;
      if(re.test(txt) && !/코트\s*현황|공용대기|본선\s*경기\s*현황|⚡\s*본선/.test(txt)){
        el.classList.add('v1013-legacy-main-tree-hidden');
      }
    });
  }catch(e){}}
  function installResultSaveQueueHook(){
    try{
      if(window.__v1016ResultSaveQueueHookInstalled) return;
      const oldSave=window.saveM3;
      if(typeof oldSave!=='function') return;
      const wrapped=async function(){
        const beforeKey=S(window.CM_key||selectedKey());
        let r;
        try{ r=await oldSave.apply(this,arguments); }
        finally{
          const key=S(window.CM_key||beforeKey||selectedKey());
          [120,650,1500,3000].forEach(ms=>setTimeout(()=>{ try{ refreshLiveMainQueue(key,'after_result_save').catch(e=>console.warn('[v1018] after save queue failed',e)); }catch(e){} },ms));
        }
        return r;
      };
      wrapped.__v1016ResultSaveQueueHook=true;
      wrapped.__old=oldSave;
      window.saveM3=wrapped;
      try{ saveM3=wrapped; }catch(e){}
      window.__v1016ResultSaveQueueHookInstalled=true;
    }catch(e){ console.warn('[v1018] result save hook failed', e); }
  }
  function install(){
    installSharedQueueBridge();
    installCourtBoardCleanPatch();
    installResultSaveQueueHook();
    const block=()=>{ensurePanel(); hideLegacyMainUi(); toast('기존 본선 함수는 사용하지 않습니다. 새 본선 운영 패널을 사용하세요.','info'); return false;};
    window.startMainDraw=()=>generateDraw(selectedKey(),$('v1003MainMode')?.value||'redistribute');
    window.buildMain=()=>generateDraw(selectedKey(),$('v1003MainMode')?.value||'redistribute');
    window.v773RunMainAssign=()=>assignCourts(selectedKey());
    ['v793FixedDraw','v799LockBracket','v809ToggleBracketLock','v900OpenManual','v900OpenManualCurrent'].forEach(n=>{try{window[n]=block;}catch(e){}});
  }
  function installSharedQueueBridge(){
    try{
      if(window.__v1013SharedQueueBridgeInstalled) return;
      const old=window.getIndividualAutoSharedWaitingItems;
      if(typeof old!=='function') return;
      const wrapped=function(key){
        const base=ar(old.apply(this, arguments));
        let extras=[];
        try{
          extras=ar(G&&G.matches&&G.matches[key]).filter(m=>m&&m.cleanMainDraw&&m.v1011SharedWait&&m.winner==null).map(m=>({
            ...normalizeCleanMatchDisplay(key,m),
            __sharedCourtLabel:S(m.__sharedCourtLabel||m.v1011SharedCourt||''),
            __manualSharedHold:true,
            __mainQueueOrder:Number(m.__mainQueueOrder!=null?m.__mainQueueOrder:m.v1011QueueOrder||9999)
          }));
        }catch(e){ extras=[]; }
        const extraIds=new Set(extras.map(m=>S(m.id)));
        const merged=base.filter(m=>!extraIds.has(S(m&&m.id))).concat(extras);
        merged.sort((a,b)=>{
          const aq=Number(a&&a.__mainQueueOrder); const bq=Number(b&&b.__mainQueueOrder);
          if(Number.isFinite(aq)&&Number.isFinite(bq)&&aq!==bq) return aq-bq;
          const at=S(a&& (a.waitingFirstAt||a.courtAssignedAt||a.createdAt));
          const bt=S(b&& (b.waitingFirstAt||b.courtAssignedAt||b.createdAt));
          if(at!==bt) return at.localeCompare(bt);
          return S(a&&a.id).localeCompare(S(b&&b.id),'ko');
        });
        return merged;
      };
      wrapped.__v1013SharedQueueBridge=true; wrapped.__old=old;
      window.getIndividualAutoSharedWaitingItems=wrapped;
      window.__v1013SharedQueueBridgeInstalled=true;
    }catch(e){ console.warn('[v1019] shared queue bridge failed', e); }
  }
  function installCourtBoardCleanPatch(){
    try{
      const old=window.describeCourtBoardMatch;
      if(typeof old==='function' && !old.__v1013CleanMainWrapped){
        const wrapped=function(key,m){
          const r=old.apply(this,arguments)||{};
          try{
            const base=(m&&m.__autoItem&&m.__autoItem.match)?m.__autoItem.match:m;
            if(base&&base.cleanMainDraw){
              normalizeCleanMatchDisplay(key,base);
              const title=(base.nameOnly1||nameOnlyFromLabel(base.display1||base.source1Label)||'TBD')+' vs '+(base.nameOnly2||nameOnlyFromLabel(base.display2||base.source2Label)||'TBD');
              { const size=Number((G&&G.draws&&G.draws[key]&&G.draws[key].mainDrawSize)||base.bracketN||base.localDrawSize||64)||64; const st=cleanMainStatus(key,base); r.label=st.label||mainRoundLabel(size,base.round||0); r.statusText=st.text; r.cleanMainStatus=st.kind; r.courtLabel=S(base.court||base.manualCourtTarget||base.__sharedCourtLabel||''); }
              { const st=cleanMainStatus(key,base); r.title=title; r.rawTitle=title; r.autoTitle=title; r.detail=st.detail||''; }
            }
          }catch(e){}
          return r;
        };
        wrapped.__v1013CleanMainWrapped=true; wrapped.__old=old;
        window.describeCourtBoardMatch=wrapped; try{ describeCourtBoardMatch=wrapped; }catch(e){}
      }
      const oldRound=window.getMainRoundLabelByRoundIndex;
      if(typeof oldRound==='function' && !oldRound.__v1013CleanMainWrapped){
        const rw=function(round,key){
          try{
            const mains=ar(G&&G.matches&&G.matches[key]).filter(x=>x&&x.cleanMainDraw&&String(x.phase||'')==='main');
            if(mains.length){
              const size=Number((G&&G.draws&&G.draws[key]&&G.draws[key].mainDrawSize)||mains[0].bracketN||mains.length*2)||64;
              return mainRoundLabel(size,Number(round||0));
            }
          }catch(e){}
          return oldRound.apply(this,arguments);
        };
        rw.__v1013CleanMainWrapped=true; rw.__old=oldRound;
        window.getMainRoundLabelByRoundIndex=rw; try{ getMainRoundLabelByRoundIndex=rw; }catch(e){}
      }
    }catch(e){ console.warn('[v1019] court board clean patch failed', e); }
  }
  window.MainDrawCleanV1020={version:VERSION,ensurePanel,generateDraw,assignCourts,autoQueueResolvedAfterPrelim,hideLegacyMainUi,hideLegacyTreeOnly,selectedKey,prelimComplete,resolveCleanMatches,isPrivileged:cleanMainPrivileged,normalizeCleanMatchDisplay,nameOnlyFromLabel,venueKo,mainCourts,venueGroups,promoteSharedToOpenSlots,refreshLiveMainQueue,balancedIndexOrder,assignQueueSeqBySegments,mainQueueNumber}; window.MainDrawCleanV1019=window.MainDrawCleanV1020;
  window.MainDrawCleanV1018=window.MainDrawCleanV1019; window.MainDrawCleanV1017=window.MainDrawCleanV1019; window.MainDrawCleanV1016=window.MainDrawCleanV1019; window.MainDrawCleanV1015=window.MainDrawCleanV1019; window.MainDrawCleanV1014=window.MainDrawCleanV1019; window.MainDrawCleanV1013=window.MainDrawCleanV1019; window.MainDrawCleanV1012=window.MainDrawCleanV1019; window.MainDrawCleanV1010=window.MainDrawCleanV1019; window.MainDrawCleanV1007=window.MainDrawCleanV1019; window.MainDrawCleanV1004=window.MainDrawCleanV1019; window.MainDrawCleanV1003=window.MainDrawCleanV1019;
  install();
  function apply(){installSharedQueueBridge();installCourtBoardCleanPatch();installResultSaveQueueHook();ensurePanel();hideLegacyMainUi();hideLegacyTreeOnly();forcePanelVisible();scheduleAutoQueueResolved(selectedKey());}
  document.addEventListener('click',()=>setTimeout(apply,90),true); document.addEventListener('input',()=>setTimeout(apply,90),true);
  [0,300,800,1800,3500,6500].forEach(t=>setTimeout(apply,t));
  function loop(){try{apply();}catch(e){} setTimeout(loop,2500)} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(loop,500)); else setTimeout(loop,500);
  try{console.log('[v1021] staged shared queue balanced draw loaded');}catch(e){}
})();


/* v1005: visible main draw controls restore - keep clean main draw engine as source of truth */
(function(){
  'use strict';
  if(window.__v1005MainDrawButtonRestoreInstalled) return;
  window.__v1005MainDrawButtonRestoreInstalled = true;
  var VERSION='v1019-button-staged-queue-fix';
  function $(id){return document.getElementById(id);}
  function S(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function safeToast(msg,type){try{ if(typeof toast==='function') toast(msg,type||'info'); else console.log(msg); }catch(e){}}
  function visible(el){try{if(!el) return false; var cs=getComputedStyle(el); return cs.display!=='none'&&cs.visibility!=='hidden'&&el.offsetParent!==null;}catch(e){return false;}}
  function isBracketPageActive(){
    try{
      var p=$('page-bracket');
      if(p && p.classList && p.classList.contains('active')) return true;
      var active=document.querySelector('.nav-tab.active,.tab.active,.page-tab.active');
      var t=S(active&&active.textContent);
      return /대진표|본선/.test(t);
    }catch(e){return false;}
  }
  function isPublicLoginState(){
    try{
      var h=S(document.querySelector('.header-actions')?.innerText||'');
      if(/로그인/.test(h) && !/로그아웃|개발자|관리자|운영자|진행자/.test(h)) return true;
    }catch(e){}
    try{
      var btns=[].slice.call(document.querySelectorAll('button,.btn,.btn-sm'));
      var loginVisible=btns.some(function(b){return visible(b)&&/^\s*(🔐\s*)?로그인\s*$/.test(S(b.textContent));});
      var logoutVisible=btns.some(function(b){return visible(b)&&/로그아웃/.test(S(b.textContent));});
      if(loginVisible && !logoutVisible) return true;
    }catch(e){}
    return false;
  }
  function isPrivileged(){
    // 강한 권한 신호를 먼저 본다. 로그인 메뉴에 '로그인'이라는 글자가 남아 있어도
    // AD/TM/OP/canManageBracket가 true이면 관리자 화면으로 인정한다.
    try{ if(window.AD===true || window.TM===true || window.OP===true) return true; }catch(e){}
    try{ if(typeof window.canManageBracket==='function' && window.canManageBracket()) return true; }catch(e){}
    try{ if(typeof window.isManager==='function' && window.isManager()) return true; }catch(e){}
    try{ if(typeof window.isAdmin==='function' && window.isAdmin()) return true; }catch(e){}
    try{ if(typeof window.isDeveloper==='function' && window.isDeveloper()) return true; }catch(e){}
    try{ if(api() && typeof api().isPrivileged==='function' && api().isPrivileged()) return true; }catch(e){}
    try{ if(/admin-mode|tm-mode|operator-mode|op-mode|developer-mode/i.test(document.body?.className||'')) return true; }catch(e){}
    try{ if(/developer|admin|operator|manager|tournament_admin/i.test(String(window.LOGIN_PORTAL_MODE||''))) return true; }catch(e){}
    try{
      var profiles=[window.CURRENT_APP_PROFILE,window.currentUserProfile,window.USER_PROFILE,window.profile,window.me].filter(Boolean);
      for(var i=0;i<profiles.length;i++){
        var p=profiles[i]||{};
        var role=S(p.role||p.userRole||p.permission||p.type).toLowerCase();
        var email=S(p.email||p.userEmail).toLowerCase();
        var name=S(p.name||p.displayName||p.userName);
        if(email==='canyone2@naver.com' || /이상영/.test(name)) return true;
        if(/developer|admin|operator|manager|host|staff|tournament_admin/.test(role)) return true;
        if(/개발자|관리자|운영자|진행자/.test(role)) return true;
      }
    }catch(e){}
    if(isPublicLoginState()) return false;
    try{
      var ab=$('adminBadge');
      var txt=S(ab&&ab.textContent);
      if(ab && /개발자|관리자|운영자|진행자/.test(txt) && (ab.classList.contains('show')||visible(ab))) return true;
    }catch(e){}
    try{
      var h=S(document.querySelector('.header-actions')?.innerText||'');
      if(/개발자|관리자|운영자|진행자/.test(h) && /로그아웃|님/.test(h)) return true;
    }catch(e){}
    return false;
  }
  function api(){return window.MainDrawCleanV1019 || window.MainDrawCleanV1018 || window.MainDrawCleanV1017 || window.MainDrawCleanV1016 || window.MainDrawCleanV1015 || window.MainDrawCleanV1014 || window.MainDrawCleanV1010 || window.MainDrawCleanV1007 || window.MainDrawCleanV1004 || window.MainDrawCleanV1003 || window.MainDrawCleanV1002 || null;}
  function scrollToPanel(){try{var p=$('v1003MainPanel'); if(p){p.classList.remove('v1003-legacy-hidden'); p.style.display='block'; p.style.visibility='visible'; p.scrollIntoView({behavior:'smooth',block:'start'});}}catch(e){}}
  function callDraw(){
    var a=api();
    if(!a){safeToast('새 본선 엔진이 아직 로드되지 않았습니다. 새로고침 후 다시 시도하세요.','error'); return;}
    try{a.ensurePanel && a.ensurePanel();}catch(e){}
    setTimeout(function(){
      var mode=$('v1003MainMode')?.value || 'redistribute';
      try{
        if(typeof a.generateDraw==='function') a.generateDraw(a.selectedKey ? a.selectedKey() : undefined, mode);
        else $('v1003DrawBtn')?.click();
      }catch(e){console.error('[v1005] draw failed',e); safeToast('새 본선 추첨 실행 중 오류가 발생했습니다.','error');}
      scrollToPanel();
    },30);
  }
  function callAssign(){
    var a=api();
    if(!a){safeToast('새 본선 엔진이 아직 로드되지 않았습니다. 새로고침 후 다시 시도하세요.','error'); return;}
    try{a.ensurePanel && a.ensurePanel();}catch(e){}
    setTimeout(function(){
      try{
        if(typeof a.assignCourts==='function') a.assignCourts(a.selectedKey ? a.selectedKey() : undefined);
        else $('v1003AssignBtn')?.click();
      }catch(e){console.error('[v1005] assign failed',e); safeToast('새 본선 코트배정 실행 중 오류가 발생했습니다.','error');}
      scrollToPanel();
    },30);
  }
  function ensureStyle(){
    if($('v1005MainDrawButtonStyle')) return;
    var st=document.createElement('style'); st.id='v1005MainDrawButtonStyle'; st.textContent=`
      #v1005MainDrawQuickBar{display:none;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 14px;padding:12px 14px;border:2px solid #bfdbfe;border-radius:16px;background:linear-gradient(135deg,#eff6ff,#fff);box-shadow:0 8px 22px rgba(15,30,58,.08);position:relative;z-index:80}
      #v1005MainDrawQuickBar.show{display:flex!important}
      #v1005MainDrawQuickBar .v1005-title{font-weight:1000;color:#0f1e3a;margin-right:auto;font-size:.95rem}
      #v1005MainDrawQuickBar .v1005-sub{font-size:.72rem;color:#64748b;font-weight:800;flex-basis:100%;line-height:1.35}
      .v1005-main-btn{border:0;border-radius:999px;min-height:38px;padding:8px 13px;font-weight:1000;cursor:pointer;font-family:inherit;box-shadow:0 6px 14px rgba(15,30,58,.10)}
      .v1005-main-btn.draw{background:#2563eb;color:#fff}.v1005-main-btn.assign{background:#7c3aed;color:#fff}.v1005-main-btn.panel{background:#fff;color:#0f1e3a;border:1.5px solid #cbd5e1}
      #v1005MainDrawFloat{display:none;position:fixed;right:14px;bottom:max(96px,calc(env(safe-area-inset-bottom,0px) + 88px));z-index:3600;gap:6px;align-items:center;padding:7px;border-radius:999px;background:rgba(15,30,58,.96);box-shadow:0 14px 32px rgba(15,30,58,.28)}
      #v1005MainDrawFloat.show{display:flex!important}
      #v1005MainDrawFloat button{border:0;border-radius:999px;padding:8px 10px;font-size:.75rem;font-weight:1000;cursor:pointer;background:#fff;color:#0f1e3a}
      #v1005MainDrawFloat button.primary{background:#2563eb;color:white}
      .v1005-force-visible{display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}
      @media(max-width:680px){#v1005MainDrawQuickBar{padding:11px 12px}#v1005MainDrawQuickBar .v1005-title{flex-basis:100%}.v1005-main-btn{flex:1 1 30%;font-size:.8rem;padding:8px 8px}#v1005MainDrawFloat{right:8px;left:8px;justify-content:center;bottom:max(86px,calc(env(safe-area-inset-bottom,0px) + 76px))}}
    `; document.head.appendChild(st);
  }
  function ensureQuickBar(){
    ensureStyle();
    var page=$('page-bracket') || document.querySelector('.page.active') || document.body;
    var bar=$('v1005MainDrawQuickBar');
    if(!bar){
      bar=document.createElement('div'); bar.id='v1005MainDrawQuickBar';
      bar.innerHTML='<div class="v1005-title">🏆 새 본선 운영</div><button type="button" class="v1005-main-btn draw" id="v1005DrawBtn">🎲 새 본선 추첨</button><button type="button" class="v1005-main-btn assign" id="v1005AssignBtn">🎯 본선 코트배정</button><button type="button" class="v1005-main-btn panel" id="v1005PanelBtn">⬇ 패널 보기</button><div class="v1005-sub">기존 본선 고정/확정/128고정 버튼은 사용하지 않고, 새 본선 엔진만 사용합니다.</div>';
      var anchor=page.querySelector('.sec-title') || page.querySelector('.card-title') || page.firstElementChild;
      if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(bar, anchor.nextSibling); else page.prepend(bar);
      $('v1005DrawBtn').onclick=callDraw; $('v1005AssignBtn').onclick=callAssign; $('v1005PanelBtn').onclick=function(){var a=api(); try{a&&a.ensurePanel&&a.ensurePanel();}catch(e){} scrollToPanel();};
    }
    var ok=isBracketPageActive() && isPrivileged();
    [bar].concat([].slice.call(bar.querySelectorAll('*'))).forEach(function(el){
      try{el.classList.remove('v1003-legacy-hidden','v977-hidden-admin-panel'); el.style.removeProperty('visibility'); el.style.removeProperty('pointer-events');}catch(e){}
    });
    bar.classList.toggle('show', ok);
    var fl=$('v1005MainDrawFloat');
    if(!fl){
      fl=document.createElement('div'); fl.id='v1005MainDrawFloat';
      fl.innerHTML='<button type="button" class="primary" id="v1005FloatDraw">본선추첨</button><button type="button" id="v1005FloatAssign">코트배정</button><button type="button" id="v1005FloatPanel">패널</button>';
      document.body.appendChild(fl);
      $('v1005FloatDraw').onclick=callDraw; $('v1005FloatAssign').onclick=callAssign; $('v1005FloatPanel').onclick=function(){var a=api(); try{a&&a.ensurePanel&&a.ensurePanel();}catch(e){} scrollToPanel();};
    }
    fl.classList.toggle('show', ok);
    try{
      [bar, fl].forEach(function(root){ if(root) root.querySelectorAll('button').forEach(function(b){ b.classList.remove('v1003-legacy-hidden','v979-admin-hidden','v977-hidden-admin-panel'); b.style.removeProperty('display'); b.style.removeProperty('visibility'); }); });
      var p=$('v1003MainPanel');
      if(p && ok){p.classList.add('v1005-force-visible'); p.classList.remove('v1003-legacy-hidden','v1003-public-hidden','v979-admin-hidden','v977-hidden-admin-panel'); p.style.removeProperty('display'); p.style.visibility='visible';}
      if(p && !ok){p.classList.remove('v1005-force-visible'); p.style.setProperty('display','none','important');}
    }catch(e){}
  }
  function apply(){ensureQuickBar();}
  document.addEventListener('click',function(){setTimeout(apply,100);},true);
  document.addEventListener('input',function(){setTimeout(apply,100);},true);
  [0,150,500,1200,2500,5000].forEach(function(t){setTimeout(apply,t);});
  setInterval(apply,500);
  try{console.log('[v1018] main draw buttons cache-proof fixed');}catch(e){}
})();


/* v1020: live main queue watchdog
   The result-save hook alone is not enough because some prelim result paths bypass saveM3 or restore from cached bundles.
   This watcher scans all clean main draws and refreshes newly resolved slots into current/wait1/shared queues.
*/
(function(){
  'use strict';
  if(window.__V1020_MAIN_QUEUE_WATCHDOG_INSTALLED) return;
  window.__V1020_MAIN_QUEUE_WATCHDOG_INSTALLED = true;
  const VERSION='v1021-ready-display-queue-assign-fix';
  const S=v=>String(v==null?'':v).trim();
  const ar=v=>Array.isArray(v)?v:[];
  function api(){return window.MainDrawCleanV1020||window.MainDrawCleanV1019||window.MainDrawCleanV1018||window.MainDrawCleanV1017||window.MainDrawCleanV1016||window.MainDrawCleanV1015||window.MainDrawCleanV1014||window.MainDrawCleanV1010||null;}
  function toast(msg,type){try{ if(typeof window.toast==='function') window.toast(msg,type||'info'); else console.log('[v1018]',msg); }catch(e){} }
  function isPriv(){try{const a=api(); if(a&&typeof a.isPrivileged==='function') return !!a.isPrivileged();}catch(e){} try{return !!(window.AD||window.TM||window.OP||(typeof window.canManageBracket==='function'&&window.canManageBracket()));}catch(e){return false;}}
  function cleanKeys(){
    try{
      const out=[];
      const matches=(window.G&&G.matches)||{};
      Object.keys(matches).forEach(k=>{
        const list=ar(matches[k]);
        if(!list.some(m=>m&&m.cleanMainDraw&&String(m.phase||'')==='main')) return;
        const d=(G.draws&&G.draws[k])||{};
        const assigned=!!(d.v1019MainQueueEnabled||d.v1011MainCourtAssignment||d.v1014MainCourtAssignment||d.v1011MainCourtAssignedAt||d.v1014MainCourtAssignedAt||list.some(m=>m&&m.cleanMainDraw&&(S(m.court)||S(m.manualCourtTarget)||S(m.__sharedCourtLabel)||m.manualSharedHold||m.v1011SharedWait)));
        if(assigned) out.push(k);
      });
      return out;
    }catch(e){return [];}
  }
  let running=false;
  async function refreshAll(reason, quiet){
    const a=api();
    if(!a||typeof a.refreshLiveMainQueue!=='function'||running) return false;
    if(!isPriv()) return false;
    const keys=cleanKeys();
    if(!keys.length) return false;
    running=true;
    let changed=0;
    try{
      for(const k of keys){
        try{ if(await a.refreshLiveMainQueue(k, reason||'watchdog')) changed++; }
        catch(e){ console.warn('[v1018] queue refresh failed', k, e); }
      }
      if(changed && !quiet){ toast('본선 큐 갱신 완료: '+changed+'개 부서','success'); }
      return changed>0;
    }finally{ running=false; }
  }
  window.v1018RefreshAllCleanMainQueues=function(){ return refreshAll('manual_force', false); }; window.v1017RefreshAllCleanMainQueues=window.v1018RefreshAllCleanMainQueues;
  function ensureForceButton(){
    try{
      const panel=document.getElementById('v1003MainPanel');
      if(!panel||panel.querySelector('#v1018QueueRefreshBtn')) return;
      const row=panel.querySelector('.v1003-controls')||panel;
      const btn=document.createElement('button');
      btn.type='button';
      btn.id='v1018QueueRefreshBtn';
      btn.className='v1003-btn';
      btn.style.background='#0f766e';
      btn.style.color='#fff';
      btn.textContent='🔁 본선 큐 갱신';
      btn.title='예선 결과가 저장됐는데 본선 카드가 바로 안 붙으면 이 버튼으로 새 본선 대기열을 강제 갱신합니다.';
      btn.onclick=function(ev){ev.preventDefault();ev.stopPropagation();refreshAll('manual_button',false);};
      row.appendChild(btn);
    }catch(e){}
  }
  function hookFunction(name){
    try{
      const fn=window[name];
      if(typeof fn!=='function'||fn.__v1018QueueWatchHook) return;
      const wrapped=async function(){
        let r;
        try{ r=await fn.apply(this,arguments); }
        finally{ [180,700,1600,3500].forEach(ms=>setTimeout(()=>refreshAll('after_'+name,true),ms)); }
        return r;
      };
      wrapped.__v1018QueueWatchHook=true; wrapped.__old=fn;
      window[name]=wrapped;
      try{ eval(name+'=wrapped'); }catch(e){}
    }catch(e){}
  }
  function hookKnown(){
    ['saveM3','saveM3Result','saveGroupResult','saveResult','persistSingleMatchDoc','persistSingleMatchDocPublic','stM'].forEach(hookFunction);
  }
  document.addEventListener('click', function(ev){
    try{
      const t=S(ev.target&&ev.target.textContent||'');
      if(/결과\s*저장|결과저장|저장|확정|본선\s*코트\s*배정|코트배정/.test(t)){
        [450,1400,3200].forEach(ms=>setTimeout(()=>refreshAll('click_'+t.slice(0,12),true),ms));
      }
    }catch(e){}
  }, true);
  document.addEventListener('DOMContentLoaded',()=>{hookKnown();ensureForceButton();setTimeout(()=>refreshAll('dom_ready',true),1800);});
  [500,1400,2800,5200,9000].forEach(ms=>setTimeout(()=>{hookKnown();ensureForceButton();refreshAll('startup_'+ms,true);},ms));
  setInterval(()=>{hookKnown();ensureForceButton();refreshAll('watchdog_interval',true);},2600);
  try{console.log('[v1021] staged queue watchdog installed');}catch(e){}
})();


/* v1018: court board elapsed clock fallback
   Existing court board timer uses tournament date as base. In dev/test tournaments scheduled on a future date,
   live cards can stay at 0분 경과 even after the operator presses 지금 시작 or assigns cards.
   This patch keeps the DOM clock moving by using today's same HH:MM when a visible elapsed chip points to a future date.
*/
(function(){
  'use strict';
  if(window.__V1020_COURT_CLOCK_FALLBACK_INSTALLED) return;
  window.__V1020_COURT_CLOCK_FALLBACK_INSTALLED = true;
  function effectiveTs(iso){
    try{
      if(!iso) return NaN;
      let ts=new Date(iso).getTime();
      if(!Number.isFinite(ts)) return NaN;
      const now=Date.now();
      // Future scheduled tournament/test date: use today's same time-of-day so the live board clock actually moves.
      if(ts > now + 60000){
        const d=new Date(ts);
        const alt=new Date();
        alt.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), 0);
        if(alt.getTime() <= now + 60000) ts=alt.getTime();
      }
      return ts;
    }catch(e){return NaN;}
  }
  function badgeMeta(mins){
    if(mins>=60) return {text:'장기 지연', color:'#991b1b', bg:'#fee2e2', bd:'#fca5a5'};
    if(mins>=45) return {text:'확인 필요', color:'#b45309', bg:'#fff7ed', bd:'#fdba74'};
    if(mins>=30) return {text:'지연 의심', color:'#92400e', bg:'#fffbeb', bd:'#fcd34d'};
    return null;
  }
  function tick(){
    try{
      document.querySelectorAll('.elapsed-chip[data-iso]').forEach(el=>{
        const ts=effectiveTs(el.getAttribute('data-iso')||'');
        if(!Number.isFinite(ts)) return;
        const mins=Math.max(0, Math.floor((Date.now()-ts)/60000));
        const dur=el.querySelector('.elapsed-duration');
        if(dur) dur.textContent=mins+'분 경과';
        const meta=badgeMeta(mins);
        let b=el.querySelector('.elapsed-badge-text');
        let sep=b&&b.previousElementSibling&&b.previousElementSibling.classList.contains('elapsed-sep')?b.previousElementSibling:null;
        if(meta){
          el.style.background=meta.bg; el.style.borderColor=meta.bd; el.style.color=meta.color;
          if(!b){ sep=document.createElement('span'); sep.className='elapsed-sep'; sep.textContent=' · '; b=document.createElement('span'); b.className='elapsed-badge-text'; el.appendChild(sep); el.appendChild(b); }
          b.textContent='⚠️ '+meta.text;
        }else if(b){
          el.style.background=''; el.style.borderColor=''; el.style.color='';
          if(sep) sep.remove(); b.remove();
        }
      });
    }catch(e){}
  }
  const old=window.courtBoardClockTick;
  if(typeof old==='function' && !old.__v1018ClockFallback){
    const wrapped=function(){ try{ old.apply(this, arguments); }catch(e){} tick(); };
    wrapped.__v1018ClockFallback=true;
    window.courtBoardClockTick=wrapped;
  }
  window.v1018CourtClockTick=tick;
  [300,1200,3000].forEach(ms=>setTimeout(tick,ms));
  setInterval(tick,15000);
  try{console.log('[v1018] court clock fallback installed');}catch(e){}
})();
