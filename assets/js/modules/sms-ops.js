// 230MATCH stable module · sms-ops.js · 5.10.3
// 문자 운영 점검/시험 발송 UI만 분리.
// 실제 자동문자 감지·승인·발송 엔진과 참가신청 데이터는 app.js 기존 로직을 그대로 사용합니다.

export function createSmsOpsModule(api){
  const {
    getState,
    ensureMessagingState,
    smsTeamRecipients,
    buildAutoSmsSnapshot,
    findAnyMatchById,
    smsMatchRecipients,
    autoSmsBody,
    aligoProxyUrl,
    aligoClientKey,
    canOperate,
    buildLabel,
    requireOperator,
    escapeHtml,
    safePersistState,
    notice,
    downloadJson,
    smsDigits,
    getValue,
    sendAligoSmsV3,
    byId
  }=api;

  let lastSmsAcceptance=null;

  function stateNow(){
    return getState();
  }

  function ensureSmsDeliveryLogs(){
    const state=stateNow();
    ensureMessagingState(state);
    if(!Array.isArray(state.messaging.deliveryLogs))state.messaging.deliveryLogs=[];
    return state.messaging.deliveryLogs;
  }

  function smsAcceptancePayload(){
    const state=stateNow();
    ensureMessagingState(state);
    const settings=state.messaging.settings||{};
    const teams=Array.isArray(state.teams)?state.teams:[];
    const contacts=teams.map(team=>({team,recipients:smsTeamRecipients(team)}));
    const withPhone=contacts.filter(x=>x.recipients.length).length;
    const noPhone=Math.max(0,teams.length-withPhone);
    const queue=state.messaging.queue||[];
    const pending=queue.filter(x=>x.status==='pending');
    const missing=queue.filter(x=>x.status==='no-phone');

    const identity=new Map(),duplicates=[];
    for(const item of pending){
      const key=item.identityKey||[item.type,item.matchId,item.teamId,item.teamName].join('|');
      if(identity.has(key))duplicates.push({key,first:identity.get(key).id,duplicate:item.id});
      else identity.set(key,item);
    }

    const history=Array.isArray(state.messaging.smsApprovalHistory)?state.messaging.smsApprovalHistory:[];
    const eventKeys=new Set(),historyDuplicates=[];
    for(const item of history){
      if(!item?.key)continue;
      if(eventKeys.has(item.key))historyDuplicates.push(item.key);
      eventKeys.add(item.key);
    }

    const sample=(()=>{
      const snap=buildAutoSmsSnapshot();
      for(const [id,p] of Object.entries(snap.placements)){
        const match=findAnyMatchById(id);
        if(match){
          const recipients=smsMatchRecipients(match);
          return {
            matchId:id,
            court:p.court||'',
            slot:p.slot||'',
            recipients,
            body:autoSmsBody(p.slot==='playing'?'start':'waiting',match,p)
          };
        }
      }
      return null;
    })();

    const checks=[
      {label:'알리고 Worker 주소',ok:/^https:\/\//.test(aligoProxyUrl),detail:aligoProxyUrl},
      {label:'알리고 인증키 설정',ok:Boolean(aligoClientKey),detail:aligoClientKey?'클라이언트 키 설정됨':'키 누락'},
      {label:'운영 권한',ok:canOperate(),detail:canOperate()?'관리자/진행자 권한 확인':'운영 권한 필요'},
      {label:'자동 승인 설정',ok:settings.autoSmsApprovalEnabled===true,warning:settings.autoSmsApprovalEnabled!==true,detail:settings.autoSmsApprovalEnabled===true?'사용 중':'현재 꺼짐'},
      {label:'참가팀 연락처',ok:teams.length>0&&withPhone>0,warning:noPhone>0,detail:`${withPhone}/${teams.length}팀 등록 · 미등록 ${noPhone}팀`},
      {label:'발송 대기 번호',ok:missing.length===0,warning:missing.length>0,detail:`정상 ${pending.length}건 · 번호 없음 ${missing.length}건`},
      {label:'미발송 문자 중복',ok:duplicates.length===0,detail:duplicates.length?`${duplicates.length}건 중복`:'중복 없음'},
      {label:'자동 이벤트 중복키',ok:historyDuplicates.length===0,detail:historyDuplicates.length?`${historyDuplicates.length}건 중복`:'중복 없음'},
      {label:'현재 경기 시험대상',ok:Boolean(sample&&sample.recipients.length),warning:Boolean(sample&&!sample.recipients.length),detail:sample?`${sample.court||'-'} · ${sample.recipients.length}명`:'현재 배정 경기 없음'}
    ];
    const fail=checks.filter(x=>!x.ok&&!x.warning).length;
    const warn=checks.filter(x=>x.warning).length;

    return {
      format:'230MATCH_V3_SMS_ACCEPTANCE',
      build:buildLabel,
      generatedAt:new Date().toISOString(),
      decision:fail?'HOLD':'PASS',
      counts:{
        teams:teams.length,withPhone,noPhone,pending:pending.length,
        noPhoneMessages:missing.length,duplicates:duplicates.length,
        historyDuplicates:historyDuplicates.length,fail,warn
      },
      settings:{
        autoSmsApprovalEnabled:settings.autoSmsApprovalEnabled===true,
        courtWaiting:settings.autoSmsCourtWaiting!==false,
        courtChanged:settings.autoSmsCourtChanged!==false,
        matchStart:settings.autoSmsMatchStart!==false,
        matchComplete:settings.autoSmsMatchComplete===true,
        deliveryMode:settings.deliveryMode||'sms-uri'
      },
      checks,
      sample,
      deliveryLogs:ensureSmsDeliveryLogs().slice(0,30)
    };
  }

  function renderSmsAcceptance(payload=lastSmsAcceptance){
    const root=byId('smsAcceptanceResult');
    const badge=byId('smsAcceptanceBadge');
    if(!root||!badge)return;
    if(!payload){
      root.innerHTML='<div class="portal-empty">문자 운영 점검을 실행하세요.</div>';
      badge.className='badge';
      badge.textContent='검수 전';
      return;
    }
    const ok=payload.decision==='PASS';
    badge.className=`badge ${ok?'badge-safe':'badge-danger'}`;
    badge.textContent=ok?'PASS · 운영 가능':'HOLD · 확인 필요';
    root.innerHTML=`<div class="sms-acceptance-summary"><strong>${ok?'문자 운영 가능':'문자 운영 확인 필요'}</strong><span>연락처 ${payload.counts.withPhone}/${payload.counts.teams}팀 · 경고 ${payload.counts.warn} · 실패 ${payload.counts.fail}</span></div><div class="sms-check-list">${payload.checks.map(x=>`<div class="sms-check-row ${x.ok?'pass':x.warning?'warn':'fail'}"><b>${x.ok?'✅':x.warning?'⚠️':'❌'} ${escapeHtml(x.label)}</b><span>${escapeHtml(x.detail)}</span></div>`).join('')}</div>`;
  }

  function runSmsAcceptance(){
    if(!requireOperator('문자 운영 점검'))return;
    const state=stateNow();
    lastSmsAcceptance=smsAcceptancePayload();
    renderSmsAcceptance(lastSmsAcceptance);
    ensureSmsDeliveryLogs().unshift({
      at:new Date().toISOString(),
      type:'acceptance',
      status:lastSmsAcceptance.decision,
      detail:`실패 ${lastSmsAcceptance.counts.fail} · 경고 ${lastSmsAcceptance.counts.warn}`
    });
    state.messaging.deliveryLogs=state.messaging.deliveryLogs.slice(0,100);
    safePersistState('문자 운영 검수');
    notice(
      lastSmsAcceptance.decision==='PASS'?'문자 운영 점검을 통과했습니다.':'확인이 필요한 문자 항목이 있습니다.',
      lastSmsAcceptance.decision==='PASS'?'success':'error'
    );
  }

  function previewSmsRecipient(){
    if(!requireOperator('문자 대상 미리보기'))return;
    const payload=smsAcceptancePayload(),sample=payload.sample;
    if(!sample)return notice('현재 코트에 배정된 경기가 없습니다.','info');
    if(!sample.recipients.length)return notice('현재 경기 대상자에게 등록된 전화번호가 없습니다.','error');
    const target=sample.recipients.map(x=>`${x.name} ${x.phone}`).join('\n');
    alert(`현재 경기 문자 대상\n\n경기 ID: ${sample.matchId}\n코트: ${sample.court}\n수신자: ${sample.recipients.length}명\n\n${target}\n\n[예정 문구]\n${sample.body}`);
  }

  function downloadSmsAcceptance(){
    if(!lastSmsAcceptance)lastSmsAcceptance=smsAcceptancePayload();
    downloadJson(`230match-sms-acceptance-${Date.now()}.json`,lastSmsAcceptance);
    notice('문자 검수 보고서를 저장했습니다.','success');
  }

  async function sendSmsTestOne(){
    if(!requireOperator('알리고 시험문자'))return;
    const phone=smsDigits(getValue('smsTestPhone',''));
    const body=String(getValue('smsTestBody','')).trim();
    const box=byId('smsTestSendNotice');

    if(phone.length<10){
      if(box){box.className='notice error';box.textContent='올바른 휴대전화 번호를 입력하세요.';}
      return;
    }
    if(!body){
      if(box){box.className='notice error';box.textContent='시험 문구를 입력하세요.';}
      return;
    }
    if(!confirm(`${phone} 번호로 실제 시험문자 1건을 발송할까요?\n\n알리고 이용료가 발생할 수 있습니다.`))return;
    const typed=prompt('실제 발송을 확인하려면 “시험발송”을 입력하세요.','');
    if(typed!=='시험발송')return;

    const state=stateNow();
    try{
      if(box){box.className='notice info';box.textContent='알리고 Worker에 시험문자를 요청하는 중입니다...';}
      const result=await sendAligoSmsV3(
        [{name:'시험 수신자',phone}],
        body,
        {source:'sms_acceptance_test',kind:'test',title:'230MATCH 시험문자'}
      );
      ensureSmsDeliveryLogs().unshift({
        at:new Date().toISOString(),
        type:'test-send',
        status:'success',
        phoneMasked:phone.slice(0,3)+'****'+phone.slice(-4),
        response:result
      });
      state.messaging.deliveryLogs=state.messaging.deliveryLogs.slice(0,100);
      safePersistState('알리고 시험문자 성공');
      if(box){box.className='notice success';box.textContent=`시험문자 발송 요청 성공 · ${phone.slice(0,3)}-****-${phone.slice(-4)}`;}
      notice('알리고 시험문자 1건 발송 요청이 성공했습니다.','success');
    }catch(error){
      ensureSmsDeliveryLogs().unshift({
        at:new Date().toISOString(),
        type:'test-send',
        status:'failed',
        phoneMasked:phone.slice(0,3)+'****'+phone.slice(-4),
        error:error?.message||String(error)
      });
      state.messaging.deliveryLogs=state.messaging.deliveryLogs.slice(0,100);
      safePersistState('알리고 시험문자 실패');
      if(box){box.className='notice error';box.textContent=`시험문자 실패: ${error?.message||error}`;}
      notice(`시험문자 실패: ${error?.message||error}`,'error');
    }
  }

  return {
    renderSmsAcceptance,
    runSmsAcceptance,
    previewSmsRecipient,
    downloadSmsAcceptance,
    sendSmsTestOne,
    getLastSmsAcceptance:()=>lastSmsAcceptance
  };
}
