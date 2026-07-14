/* v1037 authoritative clean main draw engine
   - Existing legacy main/final renderers are not used for the new main draw.
   - This module owns: slot draw, clean bracket UI, result propagation, balanced queue order.
   - Development build first. Do not deploy to live/replay until verified.
*/
(function(){
  'use strict';
  if(window.__V1037_AUTHORITATIVE_MAIN_DRAW_INSTALLED) return;
  window.__V1037_AUTHORITATIVE_MAIN_DRAW_INSTALLED = true;
  window.__CLEAN_MAIN_ONLY_MODE__ = true;
  window.__MAIN_DRAW_AUTHORITY_VERSION__ = 'v1037-safe-controls-no-blank';

  const VERSION = 'v1037-safe-controls-no-blank';
  const PANEL_ID = 'v1037MainPanel';
  const BRACKET_ID = 'v1037MainBracket';
  const VENUE_ORDER = ['국제','능동','원도심','삼계','금병','동부','장유중','기타'];
  const VENUE_COLOR = {국제:'#2563eb',능동:'#7c3aed',원도심:'#16a34a',삼계:'#0891b2',금병:'#d97706',동부:'#be123c',장유중:'#475569',기타:'#64748b'};
  const VENUE_BG = {국제:'#eff6ff',능동:'#f5f3ff',원도심:'#ecfdf5',삼계:'#ecfeff',금병:'#fff7ed',동부:'#fff1f2',장유중:'#f8fafc',기타:'#f8fafc'};

  function $(id){return document.getElementById(id);}
  function ar(v){return Array.isArray(v)?v:[];}
  function S(v){return String(v==null?'':v).trim();}
  function N(v){const n=Number(v); return Number.isFinite(n)?n:null;}
  function esc(s){return S(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function toast(msg,type){try{ if(typeof window.toast==='function') window.toast(msg,type||'info'); else console.log('[v1037]',msg); }catch(e){console.log('[v1037]',msg);}}
  function now(){return new Date().toISOString();}
  function hasG(){return !!(window.G && G.draws && G.matches && G.teams);}

  function selectedKey(){
    try{ const k=S(window.__CURRENT_RENDER_KEY||window.__v650CurrentGroupLabelKey||''); if(k && G.draws && G.draws[k]) return k; }catch(e){}
    try{
      const tid=S(($('brTS')&&$('brTS').value)||($('regTS')&&$('regTS').value)||($('rankTS')&&$('rankTS').value)||'');
      if(tid){
        let div='';
        const brDS=$('brDS');
        if(brDS && brDS.value && brDS.value!=='__ALL__') div=S(brDS.value);
        if(!div && Array.isArray(window.BR_MULTI_DIVS) && window.BR_MULTI_DIVS.length && !window.BR_MULTI_DIVS.includes('__ALL__')) div=S(window.BR_MULTI_DIVS[0]);
        if(div) return tid+'_'+div;
        const keys=Object.keys(G.draws||{}).filter(k=>k.indexOf(tid+'_')===0);
        if(keys.length) return keys[0];
      }
    }catch(e){}
    try{return Object.keys((G&&G.draws)||{})[0]||'';}catch(e){return '';}
  }
  function splitKey(key){const s=S(key); const i=s.lastIndexOf('_'); return {tid:s.slice(0,i),div:s.slice(i+1)};}

  function venueOfCourt(court){
    const c=S(court);
    if(!c) return '';
    if(/국제|장유국제|gukje/i.test(c)) return '국제';
    if(/능동|neung/i.test(c)) return '능동';
    if(/원도심|원도|인조|wondo/i.test(c)) return '원도심';
    if(/삼계|samgye/i.test(c)) return '삼계';
    if(/금병|geum/i.test(c)) return '금병';
    if(/동부|dongbu/i.test(c)) return '동부';
    if(/장유중|클레이/i.test(c)) return '장유중';
    return '기타';
  }
  function venueColor(v){return VENUE_COLOR[v]||VENUE_COLOR.기타;}
  function venueBg(v){return VENUE_BG[v]||VENUE_BG.기타;}
  function venueSort(a,b){
    const ia=VENUE_ORDER.indexOf(a); const ib=VENUE_ORDER.indexOf(b);
    return (ia<0?999:ia)-(ib<0?999:ib) || S(a).localeCompare(S(b),'ko');
  }
  function courtNo(c){const m=S(c).match(/(\d+)\s*$/); return m?Number(m[1]):9999;}
  function courtSort(a,b){const va=venueOfCourt(a), vb=venueOfCourt(b); return venueSort(va,vb)||courtNo(a)-courtNo(b)||S(a).localeCompare(S(b),'ko');}

  function activeCourts(key){
    const sources=[];
    try{ if(typeof window.getSelectedCourtFilters==='function') sources.push(window.getSelectedCourtFilters(key)); }catch(e){}
    try{ if(window.OperationQueueV993 && typeof OperationQueueV993.getBoardCourtsForKey==='function') sources.push(OperationQueueV993.getBoardCourtsForKey(key)); }catch(e){}
    try{ if(typeof window.getUsedCourtsForKey==='function') sources.push(window.getUsedCourtsForKey(key)); }catch(e){}
    try{ const d=G.draws[key]||{}; sources.push(d.mainAllowedCourts,d.allowedCourts,d.courts,d.mainCourts); }catch(e){}
    const out=[];
    for(const src of sources){
      const arrs=ar(src).flatMap(x=>Array.isArray(x)?x:[x]);
      for(const c of arrs){ const v=S(c); if(v && !out.includes(v) && !/공용|대기|미배정|null|undefined/i.test(v)) out.push(v); }
      // If the UI has an explicit selected court filter, prefer it over fallback sources.
      if(out.length && src===sources[0]) break;
    }
    return out.sort(courtSort);
  }
  function venueGroups(key){
    const cs=activeCourts(key);
    const map={};
    cs.forEach(c=>{const v=venueOfCourt(c)||'기타'; (map[v]||(map[v]=[])).push(c);});
    const labels=Object.keys(map).sort((a,b)=>map[b].length-map[a].length || venueSort(a,b));
    if(!labels.length) return [{venue:'국제',courts:[],count:1}];
    return labels.map(v=>({venue:v,courts:map[v].sort(courtSort),count:map[v].length}));
  }

  function teamObj(key, ti){ return ar(G.teams&&G.teams[key])[Number(ti)]||null; }
  function nameOnlyFromTeam(team){
    try{
      if(!team) return '';
      if(Array.isArray(team.individualPlayers)&&team.individualPlayers.length){
        return team.individualPlayers.slice(0,2).map(p=>S((p&&p.name)||p)).filter(Boolean).join(' / ');
      }
      if(Array.isArray(team.players)&&team.players.length) return team.players.slice(0,2).map(S).filter(Boolean).join(' / ');
      if(team.pairLabel) return S(team.pairLabel).replace(/\([^)]*\)/g,'').replace(/\s+\/\s+/g,' / ').trim();
      if(team.entryLabel) return S(team.entryLabel).replace(/\([^)]*\)/g,'').replace(/\s+\/\s+/g,' / ').trim();
      return S(team.name||team.club||'');
    }catch(e){return '';}
  }
  function teamName(key,ti){return nameOnlyFromTeam(teamObj(key,ti))||('팀'+(Number(ti)+1));}
  function groupNo(g,gi){return Number(g&&(g.confirmedGroupNo||g.finalGroupNo||g.displayGroupNo||g.manualGroupNo||g.v702GroupNo||g.groupNo||g.no)) || (Number(gi)+1);}
  function groupMatches(key,gi){return ar(G.matches&&G.matches[key]).filter(m=>m && String(m.phase||'')==='group' && Number(m.group)===Number(gi));}
  function matchState(key,m){
    try{ if(typeof window.getMatchResultState==='function'){ const st=window.getMatchResultState(key,m)||{}; if(st && (st.done||st.started||st.sc1!=null||st.sc2!=null)) return st; } }catch(e){}
    const done=m && (m.done===true || m.status==='done' || m.completed===true || m.winner!=null);
    return {done:!!done, sc1:N(m&&m.score1)??N(m&&m.sc1)??0, sc2:N(m&&m.score2)??N(m&&m.sc2)??0, winner:m?m.winner:null};
  }
  function matchDone(key,m){return !!matchState(key,m).done;}
  function groupComplete(key,gi){ const ms=groupMatches(key,gi).filter(m=>!m.bye); return !!ms.length && ms.every(m=>matchDone(key,m)); }
  function standings(key,gi,g){
    const teams=ar(G.teams&&G.teams[key]);
    if(groupComplete(key,gi)){
      try{ if(typeof window.calcGS==='function'){
        const rows=ar(window.calcGS(key,gi,ar(g&&g.teams),teams));
        const arr=rows.map(r=>N(r&&(r.ti??r.teamIdx??r.idx??r.team))).filter(v=>v!=null);
        if(arr.length) return arr;
      }}catch(e){}
      for(const f of ['standings','ranking','rankings','rankOrder','order']){
        const arr=ar(g&&g[f]).map(x=>N((x&&typeof x==='object')?(x.ti??x.teamIdx??x.idx??x.team):x)).filter(v=>v!=null);
        if(arr.length) return arr;
      }
    }
    return ar(g&&g.teams).map(N).filter(v=>v!=null);
  }
  function collectEntries(key){
    const out=[]; const groups=ar(G.draws&&G.draws[key]&&G.draws[key].groups);
    groups.forEach((g,gi)=>{
      const gn=groupNo(g,gi); const st=standings(key,gi,g); const complete=groupComplete(key,gi);
      [1,2].forEach(rk=>{
        const ti=complete?N(st[rk-1]):null;
        const label=`${gn}조 ${rk}위`;
        out.push({ti, gi, gn, rk, label, nm:ti!=null?teamName(key,ti):label});
      });
    });
    return out;
  }
  function resolveEntry(key,e){
    if(!e) return null;
    const groups=ar(G.draws&&G.draws[key]&&G.draws[key].groups);
    const gi=N(e.gi), rk=N(e.rk);
    if(gi!=null && rk!=null && groups[gi] && groupComplete(key,gi)){
      const st=standings(key,gi,groups[gi]); const ti=N(st[rk-1]);
      if(ti!=null) return Object.assign({},e,{ti,nm:teamName(key,ti),resolved:true});
    }
    if(e.ti!=null) return Object.assign({},e,{nm:teamName(key,e.ti),resolved:true});
    return Object.assign({},e,{ti:null,nm:e.label||'TBD',resolved:false});
  }
  function isSlotText(s){ return /^(?:\d+조\s*[12]위|TBD|부전승|슬롯\s*대기|배정\s*대기)$/i.test(S(s)); }
  function sideEntryFromMatch(m,side){
    const n=side===1?'1':'2';
    const e={ti:N(m['t'+n]), gi:N(m['sourceGi'+n]), gn:N(m['sourceGroup'+n]), rk:N(m['sourceRank'+n]), label:S(m['source'+n+'Label']||'')};
    if(!e.label && e.gn && e.rk) e.label=`${e.gn}조 ${e.rk}위`;
    return e;
  }
  function displaySide(key,m,side,persist){
    const n=side===1?'1':'2';
    const e=resolveEntry(key,sideEntryFromMatch(m,side));
    const nm=e?(e.nm||e.label||'TBD'):'TBD';
    if(persist){
      m['display'+n]=nm;
      m['source'+n+'Resolved']=!!(e&&e.resolved);
      if(e&&e.ti!=null) m['t'+n]=e.ti;
    }
    return {text:nm, ti:e&&e.ti, resolved:!!(e&&e.resolved), label:e&&e.label};
  }
  function resolveAll(key,persist){
    const ms=mainMatches(key);
    ms.forEach(m=>{displaySide(key,m,1,persist); displaySide(key,m,2,persist);});
    return ms;
  }
  function mainMatches(key){return ar(G.matches&&G.matches[key]).filter(m=>m && String(m.phase||'')==='main' && (m.v1037CleanMain||m.cleanMainDraw||m.v1007CleanMain));}
  function firstRoundMatches(key){return mainMatches(key).filter(m=>Number(m.round||0)===0).sort((a,b)=>Number(a.slot||0)-Number(b.slot||0));}
  function readyMatch(key,m){
    const a=displaySide(key,m,1,true), b=displaySide(key,m,2,true);
    if(matchDone(key,m)) return false;
    if(m.bye || S(a.text)==='부전승' || S(b.text)==='부전승') return false;
    return !!(a.resolved && b.resolved && !isSlotText(a.text) && !isSlotText(b.text));
  }
  function nextPow2(n){let p=1; while(p<n)p*=2; return p;}
  function shuffle(arr){
    const a=arr.slice();
    for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];}
    return a;
  }
  function pairRankSlots(entries){
    const r1=shuffle(entries.filter(e=>e.rk===1));
    let r2=shuffle(entries.filter(e=>e.rk===2));
    const pairs=[];
    for(const a of r1){
      let idx=r2.findIndex(b=>b.gn!==a.gn);
      if(idx<0) idx=0;
      pairs.push([a, r2.splice(idx,1)[0]||null]);
    }
    r2.forEach(b=>pairs.push([null,b]));
    return shuffle(pairs);
  }
  function positionBalancedMatchOrder(matchCount){
    const size=matchCount*2;
    const pos=[];
    let a=0,b=size-1;
    while(a<=b){pos.push(a++); if(a<=b)pos.push(b--);}
    const mids=[];
    const half=Math.floor(size/2);
    for(let i=0;i<half;i++){mids.push(i); mids.push(i+half);}
    const mix=[]; const seenPos=new Set();
    [...pos,...mids].forEach(p=>{if(p>=0&&p<size&&!seenPos.has(p)){seenPos.add(p);mix.push(p);}});
    const out=[]; const seenSlot=new Set();
    mix.forEach(p=>{const s=Math.floor(p/2); if(!seenSlot.has(s)){seenSlot.add(s); out.push(s);}});
    for(let i=0;i<matchCount;i++) if(!seenSlot.has(i)) out.push(i);
    return out;
  }
  function buildSegments(venues){
    const out=[];
    venues.forEach((v,i)=>{const last=out[out.length-1]; if(last&&last.venue===v){last.end=i;last.count++;}else out.push({venue:v,start:i,end:i,count:1});});
    return out;
  }
  function venuesForMatchSlots(key,count,mode,pairs){
    const vgs=venueGroups(key);
    if(mode==='keep') return pairs.map(p=>p[0]?.venue||p[1]?.venue||vgs[0].venue);
    const total=vgs.reduce((s,v)=>s+Math.max(1,v.count),0)||1;
    const arr=[]; let used=0;
    vgs.forEach((v,i)=>{
      let n=i===vgs.length-1?count-used:Math.max(1,Math.round(count*Math.max(1,v.count)/total));
      if(used+n>count) n=count-used;
      used+=n;
      for(let k=0;k<n;k++) arr.push(v.venue);
    });
    while(arr.length<count) arr.push(vgs[0].venue);
    return arr.slice(0,count);
  }
  function makeMatch(slot,e1,e2,venue,size,seq){
    const id=`v1037_main_${Date.now()}_${Math.random().toString(36).slice(2,8)}_${slot}`;
    return {id, phase:'main', round:0, slot, bracketN:size, winner:null, rubbers:[], court:'', courts:[], manualCourtTarget:'',
      t1:e1?.ti??null, t2:e2?.ti??null, display1:e1?.nm||e1?.label||'TBD', display2:e2?.nm||e2?.label||'TBD',
      source1Label:e1?.label||'', source2Label:e2?.label||'', sourceGi1:e1?.gi??null, sourceGi2:e2?.gi??null, sourceGroup1:e1?.gn??null, sourceGroup2:e2?.gn??null, sourceRank1:e1?.rk??null, sourceRank2:e2?.rk??null,
      source1Resolved:e1?.ti!=null, source2Resolved:e2?.ti!=null, venue, venueLabel:venue, __venue:venue, mainBlock:venue,
      mainQueueSeq:seq, cleanMainDraw:true, v1037CleanMain:true, createdAt:now(), updatedAt:now()};
  }
  async function persist(key){
    try{ if(window.__FB_WRITE_CACHE){ if(__FB_WRITE_CACHE.draws) delete __FB_WRITE_CACHE.draws[key]; if(__FB_WRITE_CACHE.matches) delete __FB_WRITE_CACHE.matches[key]; } }catch(e){}
    try{ if(typeof window.stM==='function') await window.stM(key); }catch(e){console.warn('[v1037] stM failed',e);}
    try{ if(typeof window.stD==='function') await window.stD(key); }catch(e){console.warn('[v1037] stD failed',e);}
    try{ if(typeof window.waitForPendingWrites==='function' && window.db) await window.waitForPendingWrites(window.db); }catch(e){}
  }
  async function generateDraw(key,mode){
    if(!hasG()) return false;
    key=key||selectedKey();
    if(!key){toast('대회와 부서를 먼저 선택하세요','error');return false;}
    const groups=ar(G.draws&&G.draws[key]&&G.draws[key].groups);
    if(!groups.length){toast('예선 조편성 후 본선 추첨을 실행하세요','info'); return false;}
    const entries=collectEntries(key);
    if(entries.length<2){toast('본선 슬롯을 만들 수 없습니다','error');return false;}
    const size=nextPow2(entries.length);
    const matchCount=size/2;
    let pairs=pairRankSlots(entries);
    while(pairs.length<matchCount) pairs.push([null,null]);
    pairs=pairs.slice(0,matchCount);
    const venues=venuesForMatchSlots(key,matchCount,mode||'redistribute',pairs);
    const balanced=positionBalancedMatchOrder(matchCount);
    const seqBySlot={}; balanced.forEach((slot,i)=>seqBySlot[slot]=i+1);
    const mains=pairs.map((p,i)=>makeMatch(i,resolveEntry(key,p[0]),resolveEntry(key,p[1]),venues[i],size,seqBySlot[i]||i+1));
    const old=ar(G.matches&&G.matches[key]).filter(m=>!['main','playin','bronze'].includes(String(m&&m.phase||'')));
    G.matches[key]=old.concat(mains);
    G.draws[key]=Object.assign({},G.draws[key]||{}, {cleanMainDraw:true,v1037CleanMain:true,mainDrawVersion:VERSION,mainDrawSize:size,mainDrawAt:now(),mainDrawVenueSegments:buildSegments(venues),mainQueueOrder:balanced});
    resolveAll(key,true);
    await persist(key);
    try{ if(typeof window.renderBracket==='function') window.renderBracket(); }catch(e){}
    setTimeout(()=>{ensurePanel(); renderPanel(key); hideLegacy();},100);
    toast(`새 본선 추첨 완료: ${size}강 · 균등 운영순서 적용`,'success');
    return true;
  }

  function winnerIdx(key,m){
    const st=matchState(key,m);
    if(st.done && st.winner!=null) return N(st.winner);
    if(m.winner!=null) return N(m.winner);
    return null;
  }
  function ensureProgression(key){
    const size=Number((G.draws[key]||{}).mainDrawSize||firstRoundMatches(key)[0]?.bracketN||64);
    const maxRound=Math.log2(size)-1;
    let changed=false;
    for(let r=1;r<=maxRound;r++){
      const prev=mainMatches(key).filter(m=>Number(m.round||0)===r-1).sort((a,b)=>Number(a.slot||0)-Number(b.slot||0));
      if(!prev.length) break;
      for(let i=0;i<prev.length;i+=2){
        const a=prev[i], b=prev[i+1]; if(!a||!b) continue;
        const w1=winnerIdx(key,a), w2=winnerIdx(key,b);
        if(w1==null || w2==null) continue;
        const slot=Math.floor(i/2);
        let m=mainMatches(key).find(x=>Number(x.round||0)===r && Number(x.slot||0)===slot);
        if(!m){
          m={id:`v1037_main_r${r}_${slot}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, phase:'main', round:r, slot, bracketN:size, winner:null, rubbers:[], t1:w1,t2:w2,display1:teamName(key,w1),display2:teamName(key,w2), source1Label:'이전 라운드 승자', source2Label:'이전 라운드 승자', venue:a.venue||a.__venue||'국제', venueLabel:a.venue||a.__venue||'국제', __venue:a.venue||a.__venue||'국제', cleanMainDraw:true, v1037CleanMain:true, mainQueueSeq:1000+r*100+slot, createdAt:now(), updatedAt:now()};
          G.matches[key].push(m); changed=true;
        }else{
          if(Number(m.t1)!==w1 || Number(m.t2)!==w2){m.t1=w1;m.t2=w2;m.display1=teamName(key,w1);m.display2=teamName(key,w2);m.updatedAt=now(); changed=true;}
        }
      }
    }
    return changed;
  }
  function roundLabel(size,r){
    const n=Math.max(2, Math.floor(size/Math.pow(2,r)));
    if(n===2) return '결승';
    if(n===4) return '준결승';
    return n+'강';
  }
  function scoreText(key,m){
    const st=matchState(key,m);
    if(!st.done) return '';
    const s1=st.disp1??st.sc1??m.score1??m.sc1??0;
    const s2=st.disp2??st.sc2??m.score2??m.sc2??0;
    return `${s1}:${s2}`;
  }
  function sideText(key,m,side){
    const n=side===1?'1':'2';
    const ti=N(m['t'+n]);
    if(ti!=null) return teamName(key,ti);
    const d=S(m['display'+n]); if(d) return d;
    const s=S(m['source'+n+'Label']); if(s) return s;
    return 'TBD';
  }
  function statusText(key,m){
    const size=Number(m.bracketN||G.draws[key]?.mainDrawSize||64);
    const lbl=roundLabel(size,Number(m.round||0));
    const st=matchState(key,m);
    if(st.done) return `${lbl} · 완료 ${scoreText(key,m)}`;
    const court=S(m.court||m.currentCourt||'');
    const wait=S(m.manualCourtTarget||(Array.isArray(m.courts)&&m.courts[0])||'');
    const shared=S(m.__sharedCourtLabel||m.mainBlock||m.venue||m.__venue||'');
    if(court) return `${lbl} · 시합중 - ${court}`;
    if(wait) return `${lbl} · 코트 대기1 - ${wait}`;
    if(m.manualSharedHold || m.__queueStatus==='shared') return `${lbl} · 공용대기 - ${venueOfCourt(shared)||shared||'구장'}`;
    const a=sideText(key,m,1), b=sideText(key,m,2);
    if(isSlotText(a) || isSlotText(b)) return '슬롯 대기';
    return `${lbl} · 배정 대기`;
  }
  function renderMatchCard(key,m){
    const v=venueOfCourt(m.court||m.manualCourtTarget||m.__sharedCourtLabel||m.venue||m.__venue)||'국제';
    const c=venueColor(v), bg=venueBg(v);
    const a=sideText(key,m,1), b=sideText(key,m,2);
    const st=matchState(key,m); const win=winnerIdx(key,m);
    const score=scoreText(key,m);
    const canInput=!isSlotText(a)&&!isSlotText(b)&&typeof window.openM3==='function'&&m.id;
    return `<div class="v1037-match" style="--v:${c};--vb:${bg}">
      <div class="v1037-match-top"><b>${Number(m.slot||0)+1}경기</b><span>${esc(v)}</span></div>
      <div class="v1037-side ${win!=null&&Number(m.t1)===win?'win':''}"><span>${esc(a)}</span><small>${st.done?score.split(':')[0]||0:0}</small></div>
      <div class="v1037-side ${win!=null&&Number(m.t2)===win?'win':''}"><span>${esc(b)}</span><small>${st.done?score.split(':')[1]||0:0}</small></div>
      <div class="v1037-status">${esc(statusText(key,m))}</div>
      ${canInput?`<button class="v1037-result-btn" type="button" onclick="window.openM3('${key}','${m.id}')">${st.done?'결과 수정':'결과 입력'}</button>`:''}
    </div>`;
  }
  function renderPlaceholder(r,i,size,source){
    return `<div class="v1037-match v1037-placeholder"><div class="v1037-match-top"><b>${i+1}경기</b></div><div class="v1037-side"><span>${esc(source&&source[0]||'TBD')}</span><small>0</small></div><div class="v1037-side"><span>${esc(source&&source[1]||'TBD')}</span><small>0</small></div><div class="v1037-status">이전 라운드 승자</div></div>`;
  }
  function renderBracket(key){
    const mains=mainMatches(key);
    if(!mains.length) return '<div class="v1037-empty">새 본선 대진이 없습니다. 위 버튼으로 새 본선 추첨을 실행하세요.</div>';
    const changed=ensureProgression(key); if(changed) setTimeout(()=>persist(key).catch(()=>{}),0);
    resolveAll(key,true);
    const size=Number(G.draws[key]?.mainDrawSize||firstRoundMatches(key)[0]?.bracketN||mains.length*2||64);
    const maxRound=Math.log2(size)-1;
    const segs=ar(G.draws[key]?.mainDrawVenueSegments).map(s=>`<span class="v1037-seg" style="border-color:${venueColor(s.venue)};color:${venueColor(s.venue)};background:${venueBg(s.venue)}">${esc(s.venue)} ${Number(s.start)+1}~${Number(s.end)+1}경기</span>`).join('');
    let html=`<div class="v1037-bracket-title"><b>새 본선 경기표 · ${size}강부터 시작</b><div>${segs}</div></div>`;
    html+=`<div class="v1037-bracket-wrap"><div class="v1037-bracket">`;
    for(let r=0;r<=maxRound;r++){
      const roundMatches=mainMatches(key).filter(m=>Number(m.round||0)===r).sort((a,b)=>Number(a.slot||0)-Number(b.slot||0));
      const count=Math.max(1, size/Math.pow(2,r+1));
      html+=`<div class="v1037-round"><div class="v1037-round-title">${roundLabel(size,r)}</div><div class="v1037-round-body">`;
      for(let i=0;i<count;i++){
        const m=roundMatches.find(x=>Number(x.slot||0)===i);
        if(m) html+=renderMatchCard(key,m);
        else html+=renderPlaceholder(r,i,size,null);
      }
      html+=`</div></div>`;
    }
    html+=`</div></div>`;
    return html;
  }

  function clearQueueFields(m){
    delete m.court; m.courts=[]; delete m.currentCourt; delete m.manualCourtTarget; delete m.waitingFirstAt; delete m.lastWaitingFirstAt; delete m.__sharedCourtLabel; delete m.manualSharedHold; delete m.__queueStatus;
  }
  function setActive(m,c,i){m.court=c;m.courts=[c];m.manualCourtTarget=c;m.__queueStatus='active';m.courtAssignedAt=m.courtAssignedAt||now();m.courtQueueOrder=Date.now()+i;}
  function setWait1(m,c,i){delete m.court;m.courts=[c];m.manualCourtTarget=c;m.waitingFirstAt=m.waitingFirstAt||now();m.__queueStatus='wait1';m.courtQueueOrder=Date.now()+i;}
  function setShared(m,venue,i){delete m.court;m.courts=[];delete m.manualCourtTarget;m.manualSharedHold=true;m.__sharedCourtLabel=venue;m.__queueStatus='shared';m.courtQueueOrder=Date.now()+i;}
  function readyMainMatches(key){return mainMatches(key).filter(m=>readyMatch(key,m)).sort((a,b)=>Number(a.mainQueueSeq||9999)-Number(b.mainQueueSeq||9999)||Number(a.round||0)-Number(b.round||0)||Number(a.slot||0)-Number(b.slot||0));}
  async function assignInitial(key){
    if(!hasG()) return false; key=key||selectedKey(); if(!key){toast('대회와 부서를 먼저 선택하세요','error');return false;}
    resolveAll(key,true); ensureProgression(key);
    const ready=readyMainMatches(key); if(!ready.length){toast('양쪽 팀명이 확정된 본선 경기가 아직 없습니다.','info');renderPanel(key);return false;}
    const cs=activeCourts(key); if(!cs.length){toast('본선 사용 코트를 찾지 못했습니다.','error');return false;}
    ready.forEach(clearQueueFields);
    const byVenue={}; cs.forEach(c=>{const v=venueOfCourt(c)||'기타'; (byVenue[v]||(byVenue[v]=[])).push(c);});
    Object.values(byVenue).forEach(a=>a.sort(courtSort));
    const byReady={}; ready.forEach(m=>{const v=venueOfCourt(m.venue||m.__venue)||venueOfCourt(cs[0])||'국제'; (byReady[v]||(byReady[v]=[])).push(m);});
    let idx=0, assigned=0, wait=0, shared=0;
    for(const v of Object.keys(byReady).sort(venueSort)){
      const list=byReady[v]; const courts=(byVenue[v]&&byVenue[v].length?byVenue[v]:cs);
      const q=list.slice();
      for(const c of courts){const m=q.shift(); if(!m) break; setActive(m,c,idx++); assigned++;}
      for(const c of courts){const m=q.shift(); if(!m) break; setWait1(m,c,idx++); wait++;}
      q.forEach(m=>{setShared(m,v,idx++); shared++;});
    }
    await persist(key); try{ if(typeof window.renderBracket==='function') window.renderBracket(); }catch(e){}
    setTimeout(()=>renderPanel(key),120);
    toast(`본선 코트배정 완료: 시합중 ${assigned} · 대기1 ${wait} · 공용대기 ${shared}`,'success'); return true;
  }
  async function refreshQueue(key,manual){
    if(!hasG()) return false; key=key||selectedKey(); if(!key) return false;
    resolveAll(key,true); ensureProgression(key);
    const cs=activeCourts(key); if(!cs.length) return false;
    const ready=readyMainMatches(key);
    let changed=false;
    // Any newly-ready unqueued matches go to shared queue only. They must never jump directly to active during auto refresh.
    ready.forEach(m=>{const has=m.court||m.manualCourtTarget||m.manualSharedHold||m.__queueStatus; if(!has){setShared(m,venueOfCourt(m.venue||m.__venue)||venueOfCourt(cs[0])||'국제',0); changed=true;}});
    for(const c of cs){
      const active=ready.find(m=>S(m.court)===S(c) && !matchDone(key,m));
      let wait=ready.find(m=>!m.court && S(m.manualCourtTarget)===S(c) && !matchDone(key,m));
      if(active && !wait){
        const v=venueOfCourt(c)||'기타';
        const shared=ready.filter(m=>m.manualSharedHold && !m.court && !m.manualCourtTarget && (venueOfCourt(m.__sharedCourtLabel||m.venue||m.__venue)||'기타')===v).sort((a,b)=>Number(a.mainQueueSeq||9999)-Number(b.mainQueueSeq||9999))[0];
        if(shared){setWait1(shared,c,0); changed=true;}
      }
      if(!active && wait){ setActive(wait,c,0); changed=true; }
      // If both active and wait are empty, only fill wait1 from shared, not active.
      if(!active && !wait){
        const v=venueOfCourt(c)||'기타';
        const shared=ready.filter(m=>m.manualSharedHold && !m.court && !m.manualCourtTarget && (venueOfCourt(m.__sharedCourtLabel||m.venue||m.__venue)||'기타')===v).sort((a,b)=>Number(a.mainQueueSeq||9999)-Number(b.mainQueueSeq||9999))[0];
        if(shared){setWait1(shared,c,0); changed=true;}
      }
    }
    if(changed){ await persist(key); try{if(typeof window.renderBracket==='function') window.renderBracket();}catch(e){} setTimeout(()=>renderPanel(key),120); if(manual) toast('본선 큐 갱신 완료','success'); }
    else if(manual) toast('갱신할 본선 큐 변경이 없습니다','info');
    return changed;
  }

  function ensureStyle(){
    if($('v1037Style')) return;
    const st=document.createElement('style'); st.id='v1037Style'; st.textContent=`
      #${PANEL_ID}{margin:12px 0 16px;padding:16px;border:2px solid #bfdbfe;border-radius:18px;background:linear-gradient(180deg,#f8fbff,#fff);box-shadow:0 12px 28px rgba(15,30,58,.08)}
      .v1037-title{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;font-weight:1000;color:#0f1e3a}.v1037-title small{font-size:.72rem;color:#64748b;font-weight:800}.v1037-controls{display:grid;grid-template-columns:1fr auto auto auto auto;gap:8px;align-items:center;margin-bottom:10px}.v1037-select{min-height:40px;border:1.5px solid #cbd5e1;border-radius:12px;padding:8px 10px;font-weight:900}.v1037-btn{border:0;border-radius:12px;min-height:40px;padding:8px 13px;font-weight:1000;cursor:pointer}.v1037-btn.primary{background:#2563eb;color:#fff}.v1037-btn.purple{background:#7c3aed;color:#fff}.v1037-btn.green{background:#0f766e;color:#fff}.v1037-btn.auto-on{background:#d4a017;color:#111827}.v1037-btn.auto-off{background:#e2e8f0;color:#334155}.v1037-note{font-size:.78rem;color:#475569;line-height:1.55;margin-bottom:12px}.v1037-empty{padding:18px;border:1px dashed #cbd5e1;border-radius:14px;text-align:center;color:#64748b;font-weight:900;background:#f8fafc}.v1037-bracket-title{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:12px 0 10px}.v1037-seg{display:inline-flex;padding:4px 8px;border:1.5px solid;border-radius:999px;font-size:.72rem;font-weight:1000;margin:2px}.v1037-bracket-wrap{overflow-x:auto;padding:6px 2px 10px;-webkit-overflow-scrolling:touch}.v1037-bracket{display:flex;align-items:stretch;gap:18px;min-width:max-content}.v1037-round{display:flex;flex-direction:column;min-width:230px}.v1037-round-title{background:#0f1e3a;color:#fff;text-align:center;font-weight:1000;border-radius:8px 8px 0 0;padding:7px 10px;font-size:.86rem}.v1037-round-body{display:flex;flex-direction:column;gap:10px;justify-content:space-around;flex:1;padding-top:10px}.v1037-match{position:relative;border:1.5px solid #cbd5e1;border-left:7px solid var(--v,#2563eb);border-radius:12px;background:linear-gradient(90deg,var(--vb,#eff6ff),#fff);box-shadow:0 3px 12px rgba(15,30,58,.08);overflow:hidden}.v1037-match:after{content:'';position:absolute;right:-19px;top:50%;width:18px;height:2px;background:#bfdbfe}.v1037-round:last-child .v1037-match:after{display:none}.v1037-match-top{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 8px;font-size:.72rem;color:#334155}.v1037-match-top span{display:inline-flex;align-items:center;border-radius:999px;background:var(--v,#2563eb);color:#fff;padding:2px 7px;font-size:.68rem;font-weight:1000}.v1037-side{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid #e2e8f0;padding:7px 8px;font-size:.8rem;font-weight:900;line-height:1.3;min-height:34px}.v1037-side.win{background:#ecfdf5;color:#166534}.v1037-side small{font-family:Oswald,sans-serif;color:#94a3b8;font-size:.86rem}.v1037-status{text-align:center;border-top:1px dashed #e2e8f0;padding:5px 8px;font-size:.66rem;color:#64748b;font-weight:900}.v1037-result-btn{display:block;width:calc(100% - 16px);margin:0 8px 8px;padding:6px 8px;border:0;border-radius:9px;background:#d4a017;color:#111827;font-weight:1000;cursor:pointer}.v1037-placeholder{background:#f8fafc;border-left-color:#cbd5e1}.v1037-legacy-hidden{display:none!important;visibility:hidden!important;pointer-events:none!important}
      @media(max-width:680px){.v1037-controls{grid-template-columns:1fr}.v1037-btn{width:100%}}
    `; document.head.appendChild(st);
  }
  function ensurePanel(){
    ensureStyle();
    let p=$(PANEL_ID);
    const page=$('page-bracket');
    if(!page) return null;
    if(!p){
      p=document.createElement('div'); p.id=PANEL_ID;
      const anchor=page.querySelector('.sec-title')||page.firstElementChild;
      if(anchor&&anchor.parentNode) anchor.parentNode.insertBefore(p,anchor.nextSibling); else page.prepend(p);
    }
    p.style.display='block'; p.style.visibility='visible'; p.classList.remove('v1037-legacy-hidden');
    const controlsMissing=!p.querySelector('#v1037MainMode')||!p.querySelector('#v1037DrawBtn')||!p.querySelector('#v1037AssignBtn')||!p.querySelector('#v1037RefreshBtn')||!p.querySelector('#v1037AutoBtn')||!p.querySelector('#'+BRACKET_ID);
    if(!p.dataset.built || controlsMissing){
      p.innerHTML=`<div class="v1037-title"><div>🏆 새 본선 운영 패널 <small>${VERSION}</small></div><small>기존 본선 렌더러 미사용 · 새 엔진 단독</small></div>
        <div class="v1037-controls"><select id="v1037MainMode" class="v1037-select"><option value="redistribute">전체 재배정 · 선택 코트 기준 균등 배정</option><option value="keep">예선 구장 유지</option></select><button type="button" id="v1037DrawBtn" class="v1037-btn primary">🎲 새 본선 추첨</button><button type="button" id="v1037AssignBtn" class="v1037-btn purple">🎯 본선 코트배정</button><button type="button" id="v1037RefreshBtn" class="v1037-btn green">🔁 본선 큐 갱신</button><button type="button" id="v1037AutoBtn" class="v1037-btn auto-off">⏸ 자동배정 OFF</button></div>
        <div class="v1037-note">본선은 이 패널만 사용합니다. 예선 결과가 확정된 경기부터 실제 팀명으로 바뀌며, 결과 입력 시 다음 라운드로 승자가 올라갑니다. 공용대기는 바로 시합중으로 가지 않고 각 코트의 대기1로만 이동합니다.</div>
        <div id="${BRACKET_ID}"></div>`;
      p.dataset.built='1';
    }
    const draw=$('v1037DrawBtn'), assign=$('v1037AssignBtn'), ref=$('v1037RefreshBtn'), auto=$('v1037AutoBtn');
    if(draw) draw.onclick=()=>generateDraw(selectedKey(),$('v1037MainMode')?.value||'redistribute');
    if(assign) assign.onclick=async()=>{ const ok=await assignInitial(selectedKey()); if(ok) setAutoState(true); };
    if(ref) ref.onclick=()=>refreshQueue(selectedKey(),true);
    if(auto) auto.onclick=()=>setAutoState(!autoEnabled());
    updateAutoButton();
    renderPanel(selectedKey());
    return p;
  }
  function renderPanel(key){
    key=key||selectedKey();
    const box=$(BRACKET_ID); if(!box) return;
    if(!hasG()||!key){box.innerHTML='<div class="v1037-empty">대회와 부서를 선택하세요.</div>';return;}
    resolveAll(key,true); ensureProgression(key);
    box.innerHTML=renderBracket(key);
  }
  function hideLegacy(){
    try{
      document.querySelectorAll('button').forEach(btn=>{
        const t=S(btn.textContent).replace(/\s+/g,'');
        if(/가지형대진표|조별본선연결구조/.test(t)) btn.style.display='none';
      });
    }catch(e){}
  }

  const AUTO_KEY='V1037_MAIN_AUTO_ENABLED';
  function autoEnabled(){ try{return localStorage.getItem(AUTO_KEY)==='1';}catch(e){return false;} }
  function updateAutoButton(){
    const b=$('v1037AutoBtn'); if(!b) return;
    const on=autoEnabled();
    b.textContent=on?'▶ 자동배정 ON':'⏸ 자동배정 OFF';
    b.classList.toggle('auto-on',on); b.classList.toggle('auto-off',!on);
  }
  function setAutoState(on){
    try{localStorage.setItem(AUTO_KEY,on?'1':'0');}catch(e){}
    updateAutoButton();
    if(on){ refreshQueue(selectedKey(),true); toast('본선 자동배정 ON','success'); }
    else toast('본선 자동배정 OFF','info');
  }


  function install(){
    window.MainDrawCleanV1037={version:VERSION,ensurePanel,renderPanel,generateDraw,assignCourts:assignInitial,refreshQueue,selectedKey,setAutoState,autoEnabled};
    window.MainDrawCleanV1036=window.MainDrawCleanV1037;
    window.startMainDraw=()=>generateDraw(selectedKey(),$('v1037MainMode')?.value||'redistribute');
    window.buildMain=window.startMainDraw;
    window.v773RunMainAssign=()=>assignInitial(selectedKey());
    window.v1037RefreshMainQueue=()=>refreshQueue(selectedKey(),true);
    const oldSave=window.saveM3;
    if(typeof oldSave==='function' && !oldSave.__v1037Wrapped){
      const wrapped=async function(){
        const r=await oldSave.apply(this,arguments);
        setTimeout(()=>{try{refreshQueue(selectedKey(),false);renderPanel(selectedKey());hideLegacy();}catch(e){}},250);
        setTimeout(()=>{try{renderPanel(selectedKey());hideLegacy();}catch(e){}},900);
        return r;
      };
      wrapped.__v1037Wrapped=true; wrapped.__old=oldSave; window.saveM3=wrapped;
    }
    const boot=()=>{
      let tries=0;
      const timer=setInterval(()=>{
        tries++;
        const panel=ensurePanel();
        if(panel || tries>30) clearInterval(timer);
      },250);
    };
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
    const pageObserver=new MutationObserver(()=>{
      if(!$('v1037MainPanel')) ensurePanel();
      else updateAutoButton();
    });
    const observeTarget=$('page-bracket');
    if(observeTarget) pageObserver.observe(observeTarget,{childList:true,subtree:false});
    setInterval(()=>{
      try{
        if(autoEnabled()) refreshQueue(selectedKey(),false);
        if($('v1037MainPanel')) renderPanel(selectedKey());
      }catch(e){}
    },3500);
    try{console.log('[v1037-safe] controls/no-blank engine loaded');}catch(e){}
  }
  install();
})();
