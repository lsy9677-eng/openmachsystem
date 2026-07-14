(function(){
  'use strict';
  if(window.MainDrawCoreV2ReadOnly) return;

  const VERSION='1.18.1';
  const SUPPORTED=[32,64,128];
  const arr=v=>Array.isArray(v)?v:[];
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const text=v=>String(v??'').trim();
  const clone=v=>{try{return structuredClone(v);}catch(_e){return JSON.parse(JSON.stringify(v));}};

  function selectedKey(){
    try{
      if(window.MainDrawV1052 && typeof MainDrawV1052.selectedKey==='function'){
        const key=MainDrawV1052.selectedKey(); if(key) return key;
      }
    }catch(_e){}
    const direct=text(window.CM_key||window.currentDrawKey||window.selectedDrawKey);
    if(direct && window.G?.draws?.[direct]) return direct;
    const tid=text(document.getElementById('brTS')?.value);
    const div=text(document.getElementById('brDS')?.value);
    if(tid && div && window.G?.draws?.[tid+'_'+div]) return tid+'_'+div;
    if(tid){
      const keys=Object.keys(window.G?.draws||{}).filter(k=>k.startsWith(tid+'_'));
      if(keys.length===1) return keys[0];
    }
    return '';
  }

  function entryId(e){
    if(!e) return '';
    return text(e.teamId||e.id||e.regId||e.uid||e.key||e.teamKey||e.name||e.teamName||e.label);
  }

  function collectQualifiers(key){
    const draw=window.G?.draws?.[key]||{};
    const groups=arr(draw.groups);
    const result=[];
    groups.forEach((g,gi)=>{
      const rows=arr(g?.ranks||g?.rankings||g?.standings||g?.teams||g?.entries);
      rows.forEach((row,ri)=>{
        const rank=num(row?.rank||row?.place||row?.position||(ri+1));
        if(rank>0 && rank<=2){
          result.push({
            group:gi+1,
            rank,
            id:entryId(row),
            raw:row
          });
        }
      });
      // fallback: explicit winner/runner-up fields
      if(!rows.length){
        [['winner',1],['first',1],['runnerUp',2],['second',2]].forEach(([field,rank])=>{
          const row=g?.[field]; if(row) result.push({group:gi+1,rank,id:entryId(row),raw:row});
        });
      }
    });
    return result;
  }

  function chooseSize(count){
    if(count<=32) return 32;
    if(count<=64) return 64;
    return 128;
  }

  function mainMatches(key){
    return arr(window.G?.matches?.[key]).filter(m=>m && (m.v1051Main===true || m.phase==='main' || m.stage==='main'));
  }

  function matchRound(m){
    return num(m?.round ?? m?.roundIndex ?? m?.r ?? 0);
  }

  function matchSlot(m){
    return num(m?.slot ?? m?.matchNo ?? m?.index ?? 0);
  }

  function sideId(m,side){
    const fields=side===1
      ? ['t1','team1','teamA','p1','side1']
      : ['t2','team2','teamB','p2','side2'];
    for(const f of fields){ if(m?.[f]!=null && text(m[f])) return text(m[f]); }
    return '';
  }

  function queueState(m){
    if(m?.winner!=null || m?.status==='done' || m?.done===true || m?.completedAt) return 'completed';
    if(m?.court && !m?.waitingFirstAt) return 'playing';
    if(m?.manualCourtTarget && m?.waitingFirstAt) return 'court_wait1';
    if(m?.manualSharedHold) return 'shared_queue';
    if(sideId(m,1) && sideId(m,2)) return 'ready_unassigned';
    return 'future';
  }


  function matchLabel(m){
    const round=matchRound(m);
    const slot=matchSlot(m);
    const roundSize=num(m?.roundSize||m?.size||m?.drawSize||0);
    return text(
      m?.label||
      m?.matchLabel||
      (roundSize?`${roundSize}강 ${slot||'?'}경기`:`라운드${round} · ${slot||'?'}경기`)
    );
  }

  function teamLabel(raw){
    if(raw==null) return '';
    if(typeof raw==='string' || typeof raw==='number') return text(raw);
    return text(
      raw.teamName||raw.name||raw.label||raw.playersText||raw.displayName||
      [raw.player1,raw.player2].filter(Boolean).join(' / ')||
      raw.id||raw.teamId||raw.key
    );
  }

  function sideLabel(m,side){
    const fields=side===1
      ? ['t1','team1','teamA','p1','side1']
      : ['t2','team2','teamB','p2','side2'];
    for(const f of fields){
      if(m?.[f]!=null){
        const label=teamLabel(m[f]);
        if(label) return label;
      }
    }
    return '';
  }

  function matchDiagnosticRow(m,index){
    const state=queueState(m);
    const court=text(m?.court||m?.manualCourtTarget);
    return {
      index:index+1,
      id:text(m?.id||m?.matchId||m?.key||''),
      label:matchLabel(m),
      round:matchRound(m),
      slot:matchSlot(m),
      state,
      court,
      team1:sideLabel(m,1)||sideId(m,1),
      team2:sideLabel(m,2)||sideId(m,2),
      winner:teamLabel(m?.winner)||text(m?.winner),
      waitingFirstAt:text(m?.waitingFirstAt||''),
      completedAt:text(m?.completedAt||'')
    };
  }

  function detailedDiagnostics(key=selectedKey()){
    const matches=key?mainMatches(key):[];
    const rows=matches.map(matchDiagnosticRow);
    const byCourt={};

    rows.forEach(row=>{
      if(!row.court || !['playing','court_wait1'].includes(row.state)) return;
      byCourt[row.court]=byCourt[row.court]||{court:row.court,playing:[],court_wait1:[]};
      byCourt[row.court][row.state].push(row);
    });

    const conflicts=[];
    Object.values(byCourt).forEach(group=>{
      if(group.playing.length>1){
        conflicts.push({
          type:'multiple_playing',
          court:group.court,
          count:group.playing.length,
          matches:group.playing
        });
      }
      if(group.court_wait1.length>1){
        conflicts.push({
          type:'multiple_wait1',
          court:group.court,
          count:group.court_wait1.length,
          matches:group.court_wait1
        });
      }
    });

    const playing=rows.filter(r=>r.state==='playing');
    const courtWait1=rows.filter(r=>r.state==='court_wait1');
    const sharedQueue=rows.filter(r=>r.state==='shared_queue');
    const readyUnassigned=rows.filter(r=>r.state==='ready_unassigned');

    return {
      version:VERSION,
      checkedAt:new Date().toISOString(),
      key,
      readOnly:true,
      totals:{
        matches:rows.length,
        playing:playing.length,
        court_wait1:courtWait1.length,
        shared_queue:sharedQueue.length,
        ready_unassigned:readyUnassigned.length,
        conflictCourts:conflicts.length
      },
      conflicts,
      byCourt,
      playing,
      courtWait1,
      sharedQueue,
      readyUnassigned,
      rows
    };
  }

  function printDiagnostics(key=selectedKey()){
    const d=detailedDiagnostics(key);
    console.group(`[MAIN-DRAW-CORE-V2] queue diagnostics · ${d.key||'선택 없음'}`);
    console.info('요약',d.totals);

    if(d.conflicts.length){
      console.warn(`중복 코트 상태 ${d.conflicts.length}건`);
      d.conflicts.forEach(conflict=>{
        console.group(`${conflict.court} · ${conflict.type} · ${conflict.count}건`);
        console.table(conflict.matches.map(row=>({
          '경기':row.label,
          '상태':row.state,
          '코트':row.court,
          '1번팀':row.team1,
          '2번팀':row.team2,
          '경기ID':row.id
        })));
        console.groupEnd();
      });
    }else{
      console.info('코트별 시합중/대기1 중복 없음');
    }

    console.group('전체 시합중');
    console.table(d.playing.map(row=>({
      '경기':row.label,
      '코트':row.court,
      '1번팀':row.team1,
      '2번팀':row.team2,
      '경기ID':row.id
    })));
    console.groupEnd();

    console.groupEnd();
    window.__MAIN_DRAW_CORE_V2_DIAGNOSTICS__=d;
    return d;
  }

  function downloadDiagnostics(key=selectedKey()){
    const payload={
      inspection:compareSnapshot(key),
      diagnostics:detailedDiagnostics(key)
    };
    const safe=(key||'main-draw').replace(/[^\w가-힣-]+/g,'_');
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`230match-main-draw-diagnostics-${safe}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    return payload;
  }

  function inspect(key=selectedKey()){
    const errors=[]; const warnings=[];
    if(!window.G) errors.push('G 데이터 없음');
    if(!key) errors.push('대회·부서 키 없음');
    const qualifiers=key?collectQualifiers(key):[];
    const matches=key?mainMatches(key):[];
    const draw=key?(window.G?.draws?.[key]||{}):{};
    const declaredSize=num(draw.v1051Size||draw.mainDrawSize||0);
    const expectedSize=chooseSize(qualifiers.length||declaredSize||32);
    const size=SUPPORTED.includes(declaredSize)?declaredSize:expectedSize;
    const expectedTotal=size-1;

    if(key && !qualifiers.length) warnings.push('예선 진출팀 자동 탐색 결과 0팀');
    if(matches.length && matches.length!==expectedTotal) errors.push(`본선 경기 수 불일치: ${matches.length}/${expectedTotal}`);
    if(!matches.length) warnings.push('새 본선 대진 없음');

    const ids=qualifiers.map(q=>q.id).filter(Boolean);
    const duplicateQualifiers=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
    if(duplicateQualifiers.length) errors.push(`진출팀 중복 ${duplicateQualifiers.length}건`);

    const roundCounts={};
    const slotKeys=new Set();
    let duplicateSlots=0;
    let invalidWinner=0;
    const queue={completed:0,playing:0,court_wait1:0,shared_queue:0,ready_unassigned:0,future:0};
    matches.forEach(m=>{
      const r=matchRound(m), s=matchSlot(m), sk=r+':'+s;
      roundCounts[r]=(roundCounts[r]||0)+1;
      if(slotKeys.has(sk)) duplicateSlots++; else slotKeys.add(sk);
      const a=sideId(m,1), b=sideId(m,2), w=text(m?.winner);
      if(w && w!==a && w!==b && String(num(w))!==String(num(m?.t1)) && String(num(w))!==String(num(m?.t2))) invalidWinner++;
      queue[queueState(m)]++;
    });
    if(duplicateSlots) errors.push(`라운드·슬롯 중복 ${duplicateSlots}건`);
    if(invalidWinner) errors.push(`승자 참조 오류 ${invalidWinner}건`);

    const expectedRounds=Math.log2(size);
    for(let r=0;r<expectedRounds;r++){
      const exp=size/(2**(r+1));
      const got=roundCounts[r]||0;
      if(matches.length && got!==exp) errors.push(`${size/(2**r)}강 라운드 경기 수 불일치: ${got}/${exp}`);
    }

    // Queue invariants: a court can own at most one playing and one wait1 main match.
    const courtUse={};
    matches.forEach(m=>{
      const state=queueState(m);
      const court=text(m?.court||m?.manualCourtTarget);
      if(!court || !['playing','court_wait1'].includes(state)) return;
      courtUse[court]=courtUse[court]||{playing:0,court_wait1:0};
      courtUse[court][state]++;
    });
    Object.entries(courtUse).forEach(([court,v])=>{
      if(v.playing>1) errors.push(`${court} 시합중 본선 경기 ${v.playing}건`);
      if(v.court_wait1>1) errors.push(`${court} 대기1 본선 경기 ${v.court_wait1}건`);
    });

    const diagnostics=detailedDiagnostics(key);
    const report={
      version:VERSION,
      readOnly:true,
      checkedAt:new Date().toISOString(),
      key,
      qualifierCount:qualifiers.length,
      declaredSize,
      expectedSize,
      drawSize:size,
      expectedMatchCount:expectedTotal,
      actualMatchCount:matches.length,
      roundCounts,
      queue,
      duplicateQualifiers,
      conflictDetails:diagnostics.conflicts,
      errors,
      warnings,
      ok:errors.length===0,
      checksum:checksum({key,qualifiers:qualifiers.map(q=>[q.group,q.rank,q.id]),matches:matches.map(m=>[matchRound(m),matchSlot(m),sideId(m,1),sideId(m,2),text(m?.winner),queueState(m)])})
    };
    window.__MAIN_DRAW_CORE_V2_REPORT__=report;
    return report;
  }

  function checksum(value){
    const s=JSON.stringify(value); let h=2166136261;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
    return (h>>>0).toString(16).padStart(8,'0');
  }

  function compareSnapshot(key=selectedKey()){
    const before=clone({draw:window.G?.draws?.[key],matches:window.G?.matches?.[key]});
    const report=inspect(key);
    const after=clone({draw:window.G?.draws?.[key],matches:window.G?.matches?.[key]});
    const unchanged=JSON.stringify(before)===JSON.stringify(after);
    return {...report,sourceUnchanged:unchanged};
  }

  function logReport(){
    const r=compareSnapshot();
    const level=r.ok&&r.sourceUnchanged?'info':'warn';
    console[level]('[MAIN-DRAW-CORE-V2] read-only inspection',r);
    return r;
  }

  window.MainDrawCoreV2ReadOnly={
    version:VERSION,
    inspect,
    compareSnapshot,
    collectQualifiers,
    chooseSize,
    selectedKey,
    detailedDiagnostics,
    printDiagnostics,
    downloadDiagnostics,
    logReport
  };

  // No DOM rendering, no event interception, no mutation.
  console.log('[MAIN-DRAW-CORE-V2] v1.18.1 detailed queue diagnostics loaded');
  [1000,3000,7000].forEach(ms=>setTimeout(()=>{try{if(window.G)logReport();}catch(e){console.warn('[MAIN-DRAW-CORE-V2]',e);}},ms));
})();
