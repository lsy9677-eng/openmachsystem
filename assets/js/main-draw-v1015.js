/* v1015 clean main draw display mode
   - legacy main draw UI is not used
   - main draw may be created during prelims using group-rank slots
   - actual team names are resolved automatically as prelim results are entered
   - 64 teams => 64 draw, no byes, rank1 vs rank2, no same group
*/
(function(){
  'use strict';
  if(window.__V1015_MAIN_DRAW_CLEAN_INSTALLED) return;
  window.__V1015_MAIN_DRAW_CLEAN_INSTALLED = true;
  // v1015 uses its own guard and filename so cached v1008~v1014 scripts cannot block this patch.
  const VERSION = 'v1015-venue-segment-enforce-fix';
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
  function pairRank1Rank2(entries){
    const r1=entries.filter(e=>e.rk===1).sort((a,b)=>a.gn-b.gn);
    const base2=entries.filter(e=>e.rk===2).sort((a,b)=>a.gn-b.gn);
    if(!r1.length || !base2.length) return [];
    for(let shift=1; shift<base2.length; shift++){
      const r2=base2.map((_,i)=>base2[(i+shift)%base2.length]);
      if(r1.every((e,i)=>e.gn!==r2[i].gn)) return r1.map((e,i)=>[e,r2[i]]);
    }
    const pool=base2.slice();
    return r1.map(e=>{let i=pool.findIndex(x=>x.gn!==e.gn); if(i<0)i=0; return [e,pool.splice(i,1)[0]||null];});
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
    const id=`v1015_main_${slot}_${Date.now()}`;
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
    G.draws[key]=Object.assign({},G.draws[key]||{}, {cleanMainDraw:true,cleanMainDrawVersion:VERSION,mainDrawMode:mode,mainDrawSize:size,mainDrawAt:now(),mainDrawGroupStructureSignature:sig,mainDrawResultSignature:groupResultSignature(key),mainDrawVenueSegments:segments(venues)});
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
      const mains=ar(G&&G.matches&&G.matches[key]).filter(m=>String(m.phase||'')==='main'&&m.cleanMainDraw).sort((a,b)=>Number(a.slot||0)-Number(b.slot||0));
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
      draw.v1015VenueSegmentEnforcedAt=now();
      return {changed, venues};
    }catch(e){ console.warn('[v1015] venue repair failed', e); return {changed:false, venues:[]}; }
  }
  function readyForCourt(m){
    if(!m || m.winner!=null) return false;
    const bye=isByeLabel(m.display2||m.source2Label||'');
    return m.t1!=null && (m.t2!=null || bye);
  }
  function clearCleanCourtFields(m){
    if(!m) return;
    m.court=''; m.courts=[]; m.manualCourtTarget=''; m.__sharedCourtLabel='';
    delete m.currentCourt; delete m.v1011CourtRole; delete m.v1011SharedWait; delete m.v1011SharedCourt; delete m.__mainQueueOrder;
    delete m.manualSharedHold; delete m.__manualSharedHold;
    delete m.waitingFirstAt; delete m.lastWaitingFirstAt; delete m.courtAssignedAt; delete m.manualCourtPinnedAt; delete m.courtQueueOrder;
  }
  function markCurrent(m,c,orderIso){
    m.court=c; m.courts=[c]; m.manualCourtTarget=c;
    m.manualSharedHold=false; m.v1011CourtRole='current';
    m.courtAssignedAt=orderIso; m.manualCourtPinnedAt=orderIso; m.courtQueueOrder=orderIso;
    m.manualCourtLocked=true; m.manualCourtLockedAt=m.manualCourtLockedAt||now();
  }
  function markWaiting1(m,c,orderIso){
    m.court=''; m.courts=[c]; m.manualCourtTarget=c;
    m.manualSharedHold=false; m.v1011CourtRole='waiting1';
    m.waitingFirstAt=orderIso; m.courtAssignedAt=orderIso; m.manualCourtPinnedAt=orderIso; m.courtQueueOrder=orderIso;
    m.manualCourtLocked=true; m.manualCourtLockedAt=m.manualCourtLockedAt||now();
  }
  function markShared(m,c,orderIso,queueOrder){
    m.court=''; m.courts=[]; m.manualCourtTarget='';
    m.manualSharedHold=true; m.__manualSharedHold=true;
    m.__sharedCourtLabel=c||''; m.v1011SharedCourt=c||''; m.v1011SharedWait=true; m.v1011CourtRole='shared';
    m.__mainQueueOrder=queueOrder; m.v1011QueueOrder=queueOrder;
    m.waitingFirstAt=orderIso; m.courtAssignedAt=orderIso; m.courtQueueOrder=orderIso;
    m.manualCourtLocked=true; m.manualCourtLockedAt=m.manualCourtLockedAt||now();
  }
  function hasMainCourtAssignment(key){
    try{ const d=G&&G.draws&&G.draws[key]; return !!(d&&(d.v1011MainCourtAssignment||d.v1014MainCourtAssignment||d.v1011MainCourtAssignedAt||d.v1014MainCourtAssignedAt)); }catch(e){ return false; }
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
    mains.sort((a,b)=>Number(a.slot||0)-Number(b.slot||0)).forEach((m,i)=>{
      const v=venueKo(m.venue||m.venueLabel||m.__venue)||vg[0].venue;
      const courts=(byVenue[v]&&byVenue[v].length?byVenue[v]:allCourts);
      const orderIso=new Date(base + i*1000).toISOString();
      let placed=false;
      for(const c of courts){ const o=occ[c]||(occ[c]={cur:0,wait:0}); if(o.cur===0){ markCurrent(m,c,orderIso); o.cur++; currentCnt++; placed=true; break; } }
      if(!placed){ for(const c of courts){ const o=occ[c]||(occ[c]={cur:0,wait:0}); if(o.wait===0){ markWaiting1(m,c,orderIso); o.wait++; waitCnt++; placed=true; break; } } }
      if(!placed){ const target=courts[0]||allCourts[0]||''; markShared(m,target,orderIso,Number(m.slot||i)); sharedCnt++; }
      m.updatedAt=now();
    });
    return {currentCnt,waitCnt,sharedCnt,noCourts:false};
  }
  const __autoQueueState={};
  function scheduleAutoQueueResolved(key){
    try{
      key=key||selectedKey(); if(!key||!hasMainCourtAssignment(key)) return;
      if(__autoQueueState[key]) return;
      __autoQueueState[key]=setTimeout(()=>{ __autoQueueState[key]=null; autoQueueResolvedAfterPrelim(key).catch(e=>console.warn('[v1015] auto queue failed',e)); }, 350);
    }catch(e){}
  }
  async function autoQueueResolvedAfterPrelim(key){
    if(!key||!hasMainCourtAssignment(key)) return false;
    resolveCleanMatches(key,true);
    const targets=ar(G.matches&&G.matches[key]).filter(m=>String(m.phase||'')==='main'&&m.cleanMainDraw&&!m.winner&&readyForCourt(m)&&!isCleanAssigned(m));
    if(!targets.length) return false;
    const res=placeCleanMatches(key,targets,{auto:true});
    if(res.noCourts) return false;
    try{ if(G.draws&&G.draws[key]){ G.draws[key].v1014MainCourtAssignedAt=now(); G.draws[key].v1014AutoQueuedAt=now(); } }catch(e){}
    await persist(key);
    try{ if(typeof window.renderBracket==='function') window.renderBracket(); }catch(e){}
    setTimeout(()=>{installSharedQueueBridge(); ensurePanel(); hideLegacyMainUi(); renderClean(key);},120);
    toast(`예선 결과 확정분 본선 자동 배정: 현재 ${res.currentCnt} · 대기1 ${res.waitCnt} · 공용대기 ${res.sharedCnt}`,'success');
    return true;
  }
  async function assignCourts(key){
    key=key||selectedKey(); if(!key){toast('대회와 부서를 먼저 선택하세요','error');return false;}
    resolveCleanMatches(key,true);
    repairSegmentVenues(key,false);
    let mains=ar(G.matches&&G.matches[key]).filter(m=>String(m.phase||'')==='main'&&m.cleanMainDraw&&!m.winner).sort((a,b)=>Number(a.slot||0)-Number(b.slot||0));
    if(!mains.length){toast('배정할 새 본선 경기가 없습니다. 먼저 새 본선 추첨을 실행하세요.','info');return false;}
    const unresolved=mains.filter(m=>!readyForCourt(m));
    mains=mains.filter(readyForCourt);
    if(!mains.length){toast('본선 슬롯은 있지만 아직 실명 확정된 경기가 없습니다. 예선 결과가 들어오면 자동 대체 후 배정하세요.','info'); renderClean(key); return false;}
    ar(G.matches&&G.matches[key]).filter(m=>String(m.phase||'')==='main'&&m.cleanMainDraw).forEach(clearCleanCourtFields);
    const res=placeCleanMatches(key,mains,{manual:true});
    if(res.noCourts){toast('본선 사용 코트를 찾을 수 없습니다. 대회 부서의 본선 사용 코트를 확인하세요.','error');return false;}
    try{ if(G.draws&&G.draws[key]){ G.draws[key].v1011MainCourtAssignedAt=now(); G.draws[key].v1011MainCourtAssignment='current_wait1_shared'; G.draws[key].v1014MainCourtAssignedAt=now(); G.draws[key].v1014MainCourtAssignment='current_wait1_shared_auto_follow'; } }catch(e){}
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
    const mains=ar(G.matches&&G.matches[key]).filter(m=>String(m.phase||'')==='main'&&m.cleanMainDraw).sort((a,b)=>Number(a.slot||0)-Number(b.slot||0));
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
    return `<div class="v1004-bmatch" style="--venue-color:${c};--venue-bg:${b}"><div class="v1004-bmatch-top"><b>${i+1}경기</b><span>${esc(v)}</span></div><div class="v1004-bslot">${a}<small>0</small></div><div class="v1004-bslot">${z}<small>0</small></div><div class="v1004-bsrc">${esc(m.source1Label||'')} / ${esc(m.source2Label||'')}</div></div>`;
  }
  function placeholderCard(ri,i){
    return `<div class="v1004-bmatch v1004-placeholder"><div class="v1004-bmatch-top"><b>${i+1}경기</b></div><div class="v1004-bslot">TBD<small>0</small></div><div class="v1004-bslot">TBD<small>0</small></div><div class="v1004-bsrc">이전 라운드 승자</div></div>`;
  }
  function ensureStyle(){ if($('v1003Style'))return; const st=document.createElement('style'); st.id='v1003Style'; st.textContent=`
    #v1003MainPanel{margin:12px 0 16px;padding:16px;border:2px solid #bfdbfe;border-radius:18px;background:linear-gradient(180deg,#f8fbff,#fff);box-shadow:0 12px 28px rgba(15,30,58,.08)}
    .v1003-title{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;font-weight:1000;color:#0f1e3a}.v1003-title small{font-size:.72rem;color:#64748b;font-weight:800}.v1003-controls{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;margin-bottom:10px}.v1003-select{min-height:40px;border:1.5px solid #cbd5e1;border-radius:12px;padding:8px 10px;font-weight:900}.v1003-btn{border:0;border-radius:12px;min-height:40px;padding:8px 13px;font-weight:1000;cursor:pointer}.v1003-btn.primary{background:#2563eb;color:#fff}.v1003-btn.purple{background:#7c3aed;color:#fff}.v1003-note{font-size:.78rem;color:#475569;line-height:1.55;margin-bottom:12px}.v1003-empty{padding:18px;border:1px dashed #cbd5e1;border-radius:14px;text-align:center;color:#64748b;font-weight:900;background:#f8fafc}.v1003-head{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px}.v1003-seg{display:inline-flex;padding:4px 8px;border:1.5px solid;border-radius:999px;font-size:.72rem;font-weight:1000;margin:2px}.v1003-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.v1003-card{border:1px solid #e2e8f0;border-left:7px solid #2563eb;border-radius:14px;padding:10px 12px}.v1003-card-top{display:flex;justify-content:space-between;font-size:.76rem;font-weight:1000;color:#334155;margin-bottom:8px}.v1003-card-top span{color:#fff;border-radius:999px;padding:3px 8px;font-size:.7rem}.v1003-teams{display:grid;grid-template-columns:1fr 30px 1fr;gap:8px;text-align:center;align-items:center;font-weight:1000}.v1003-teams em{font-style:normal;font-size:.7rem;color:#64748b}.v1003-src{text-align:center;margin-top:6px;font-size:.68rem;color:#64748b;font-weight:800}.v1003-legacy-hidden{display:none!important;visibility:hidden!important;pointer-events:none!important}
    #bracketContent [id^="mainStage_"], #bracketContent .v1013-legacy-main-tree-hidden{display:none!important;visibility:hidden!important;pointer-events:none!important}

    .v1004-bracket-wrap{overflow-x:auto;padding:6px 2px 10px;-webkit-overflow-scrolling:touch}.v1004-bracket{display:flex;align-items:stretch;gap:18px;min-width:max-content}.v1004-round{display:flex;flex-direction:column;min-width:220px}.v1004-round-title{background:#0f1e3a;color:#fff;text-align:center;font-weight:1000;border-radius:8px 8px 0 0;padding:7px 10px;font-size:.86rem}.v1004-round-body{display:flex;flex-direction:column;gap:10px;justify-content:space-around;flex:1;padding-top:10px}.v1004-bmatch{position:relative;border:1.5px solid #cbd5e1;border-left:7px solid var(--venue-color,#2563eb);border-radius:12px;background:linear-gradient(90deg,var(--venue-bg,#eff6ff),#fff);box-shadow:0 3px 12px rgba(15,30,58,.08);overflow:hidden}.v1004-bmatch:after{content:'';position:absolute;right:-19px;top:50%;width:18px;height:2px;background:#bfdbfe}.v1004-round:last-child .v1004-bmatch:after{display:none}.v1004-bmatch-top{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 8px;font-size:.72rem;color:#334155}.v1004-bmatch-top span{display:inline-flex;align-items:center;border-radius:999px;background:var(--venue-color,#2563eb);color:#fff;padding:2px 7px;font-size:.68rem;font-weight:1000}.v1004-bslot{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid #e2e8f0;padding:7px 8px;font-size:.8rem;font-weight:900;line-height:1.3;min-height:34px}.v1004-bslot small{font-family:Oswald,sans-serif;color:#94a3b8;font-size:.86rem}.v1004-bsrc{text-align:center;border-top:1px dashed #e2e8f0;padding:5px 8px;font-size:.66rem;color:#64748b;font-weight:800}.v1004-placeholder{background:#f8fafc;border-left-color:#cbd5e1}.v1004-placeholder .v1004-bmatch-top span{display:none}
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
    const html=`<div class="v1003-title"><div>🏆 새 본선 운영 패널 <small>${VERSION}</small></div><small>기존 본선 고정/확정/128고정 사용 안 함</small></div><div class="v1003-controls"><select id="v1003MainMode" class="v1003-select"><option value="redistribute">전체 재배정 · 코트 수 많은 구장부터 위쪽 배정</option><option value="keep">예선 구장 유지 · 예선 출신 구장별 운영</option></select><button type="button" id="v1003DrawBtn" class="v1003-btn primary">🎲 새 본선 추첨</button><button type="button" id="v1003AssignBtn" class="v1003-btn purple">🎯 새 본선 코트배정</button></div><div class="v1003-note">예선 진행 중에도 조 순위 슬롯으로 본선 추첨이 가능합니다. 64팀 본선은 64드로, 부전승 없음, 1회전은 조1위 vs 조2위입니다. 결과 입력 시 슬롯은 실제 팀명으로 자동 대체됩니다.</div><div id="v1003CleanBracket"></div>`;
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
  function install(){
    installSharedQueueBridge();
    installCourtBoardCleanPatch();
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
    }catch(e){ console.warn('[v1015] shared queue bridge failed', e); }
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
              { const size=Number((G&&G.draws&&G.draws[key]&&G.draws[key].mainDrawSize)||base.bracketN||base.localDrawSize||64)||64; r.label=mainRoundLabel(size,base.round||0); }
              r.title=title; r.rawTitle=title; r.autoTitle=title; r.detail='';
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
    }catch(e){ console.warn('[v1015] court board clean patch failed', e); }
  }
  window.MainDrawCleanV1014={version:VERSION,ensurePanel,generateDraw,assignCourts,autoQueueResolvedAfterPrelim,hideLegacyMainUi,hideLegacyTreeOnly,selectedKey,prelimComplete,resolveCleanMatches,isPrivileged:cleanMainPrivileged,normalizeCleanMatchDisplay,nameOnlyFromLabel,venueKo,mainCourts,venueGroups};
  window.MainDrawCleanV1013=window.MainDrawCleanV1014;
  window.MainDrawCleanV1012=window.MainDrawCleanV1013; window.MainDrawCleanV1010=window.MainDrawCleanV1013; window.MainDrawCleanV1007=window.MainDrawCleanV1013; window.MainDrawCleanV1004=window.MainDrawCleanV1013; window.MainDrawCleanV1003=window.MainDrawCleanV1013;
  install();
  function apply(){installSharedQueueBridge();installCourtBoardCleanPatch();ensurePanel();hideLegacyMainUi();hideLegacyTreeOnly();forcePanelVisible();scheduleAutoQueueResolved(selectedKey());}
  document.addEventListener('click',()=>setTimeout(apply,90),true); document.addEventListener('input',()=>setTimeout(apply,90),true);
  [0,300,800,1800,3500,6500].forEach(t=>setTimeout(apply,t));
  function loop(){try{apply();}catch(e){} setTimeout(loop,2500)} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(loop,500)); else setTimeout(loop,500);
  try{console.log('[v1015] venue/autoqueue main draw loaded');}catch(e){}
})();


/* v1005: visible main draw controls restore - keep clean main draw engine as source of truth */
(function(){
  'use strict';
  if(window.__v1005MainDrawButtonRestoreInstalled) return;
  window.__v1005MainDrawButtonRestoreInstalled = true;
  var VERSION='v1015-button-venue-segment-enforce-fix';
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
  function api(){return window.MainDrawCleanV1014 || window.MainDrawCleanV1010 || window.MainDrawCleanV1007 || window.MainDrawCleanV1004 || window.MainDrawCleanV1003 || window.MainDrawCleanV1002 || null;}
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
  try{console.log('[v1015] main draw buttons cache-proof fixed');}catch(e){}
})();
