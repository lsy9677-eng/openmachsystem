// 230MATCH stable module · registration-sms.js · 5.10.14
// 참가신청 문자 확인창/수신자 선택/알리고·문자앱 발송 UI.
// 참가신청 저장, 입금 처리, 승인/취소 상태 자체는 이 모듈이 변경하지 않습니다.

export function createRegistrationSmsModule(api){
  const {
    getState,
    smsApplicationTeamName,
    reserveApplicationOrder,
    entryApplicationPlayers,
    validatePhone,
    portalEscape,
    sendAligoSmsV3,
    commit,
    notice,
    renderApplications
  }=api;

  let entrySmsItem=null;
  let bound=false;

  function entrySmsTemplate(kind,item){
    const state=getState();
    const sender=state.messaging?.settings?.senderName||'230MATCH';
    const event=item?.tournamentName||state.tournament?.name||'현재 대회';
    const fee=state.portal?.guide?.fee||'';

    if(kind==='payment')return `${event} 참가비 ${fee||'6만원'} 입금 확인, 정상 등록되었습니다. 감사합니다.`;
    if(kind==='promote')return `[${sender}] ${smsApplicationTeamName(item)}님, ${event} 후보에서 정상 참가팀으로 승격되었습니다. 이제 참가비 ${fee||'6만원'}을 입금해 주세요. 입금 확인 후 최종 참가가 확정됩니다.`;
    if(kind==='approve')return `[${sender}] ${smsApplicationTeamName(item)}님, ${event} 참가 신청이 승인되었습니다.${item?.paid?' 참가비 입금도 확인되었습니다.':' 참가비 입금 확인 후 최종 참가가 확정됩니다.'}`;
    if(kind==='reserve')return `[${sender}] ${smsApplicationTeamName(item)}님, ${event} 정원 마감으로 후보 ${reserveApplicationOrder(item)||'-'}번에 등록되었습니다. 취소팀 발생 시 순서대로 개별 연락드립니다. 후보 상태에서는 참가비를 입금하지 마세요.`;
    if(kind==='reject')return `[${sender}] ${smsApplicationTeamName(item)}님, ${event} 참가 신청이 반려되었습니다.${item?.adminMemo?` 사유: ${item.adminMemo}`:''}`;
    if(kind==='refund')return `[${sender}] ${smsApplicationTeamName(item)}님, ${event} 참가비 환불 처리가 완료되었습니다.`;
    return `[${sender}] ${smsApplicationTeamName(item)}님, ${event} 참가 신청 안내입니다.`;
  }

  function entrySmsMessage(kind,item){
    return entrySmsTemplate(kind,item);
  }

  function entrySmsDialogPlayers(item){
    const players=entryApplicationPlayers(item).map((p,index)=>({
      index,
      name:String(p?.name||`선수 ${index+1}`),
      phone:String(p?.phone||'').replace(/\D/g,'')
    }));
    const repIndex=Number(item?.representativeIndex||0)===1?1:0;
    return players.map(p=>({...p,representative:p.index===repIndex}));
  }

  function currentEntrySmsRecipients(){
    const root=document.getElementById('entrySmsRecipientEditor');
    if(!root)return[];
    const list=[];
    root.querySelectorAll('[data-entry-sms-recipient]').forEach(check=>{
      if(!check.checked)return;
      const index=check.dataset.entrySmsRecipient;
      const phone=String(root.querySelector(`[data-entry-sms-phone="${index}"]`)?.value||'').replace(/\D/g,'');
      const name=String(root.querySelector(`[data-entry-sms-name="${index}"]`)?.value||`선수 ${Number(index)+1}`).trim();
      if(validatePhone(phone)?.ok&&!list.some(x=>x.phone===phone)){
        list.push({name,phone,index:Number(index)});
      }
    });
    return list;
  }

  function syncEntrySmsTargetText(){
    const recipients=currentEntrySmsRecipients();
    const target=document.getElementById('entrySmsTarget');
    if(!target)return;
    target.textContent=recipients.length
      ?`${recipients.length}명 · ${recipients.map(p=>`${p.name} ${p.phone}`).join(' / ')}`
      :'수신번호를 선택하세요.';
  }

  function renderEntrySmsRecipientEditor(item,mode){
    const root=document.getElementById('entrySmsRecipientEditor');
    if(!root)return;
    const players=entrySmsDialogPlayers(item);
    const actualMode=mode==='representative'?'representative':'both';

    root.innerHTML=players.map(p=>`<label class="entry-sms-recipient-row"><input type="checkbox" data-entry-sms-recipient="${p.index}" ${actualMode==='both'||p.representative?'checked':''}><input type="text" data-entry-sms-name="${p.index}" value="${portalEscape(p.name)}" aria-label="수신자 이름"><input type="tel" inputmode="numeric" data-entry-sms-phone="${p.index}" value="${portalEscape(p.phone)}" aria-label="수신자 전화번호">${p.representative?'<small>대표</small>':''}</label>`).join('');

    syncEntrySmsTargetText();
  }

  function selectEntrySmsRecipients(mode){
    const root=document.getElementById('entrySmsRecipientEditor');
    if(!root||!entrySmsItem)return;
    const repIndex=Number(entrySmsItem.item?.representativeIndex||0)===1?1:0;
    root.querySelectorAll('[data-entry-sms-recipient]').forEach(check=>{
      check.checked=mode==='both'||Number(check.dataset.entrySmsRecipient)===repIndex;
    });
    syncEntrySmsTargetText();
  }

  function openEntrySmsDialog(kind,item){
    if(!item){
      notice('참가 신청 정보를 찾을 수 없습니다.','error');
      return;
    }
    entrySmsItem={kind,item};
    const d=document.getElementById('entrySmsDialog');
    if(!d)return;

    const title=document.getElementById('entrySmsTitle');
    const body=document.getElementById('entrySmsBody');
    const both=document.getElementById('entrySmsSelectBothBtn');
    const rep=document.getElementById('entrySmsSelectRepresentativeBtn');
    const editor=document.getElementById('entrySmsRecipientEditor');

    if(title)title.textContent=({
      approve:'참가 승인 문자',
      reserve:'후보 등록 문자',
      promote:'일반 참가 승격 문자',
      payment:'입금 완료 문자',
      reject:'신청 반려 문자',
      refund:'환불 완료 문자'
    })[kind]||'참가 신청 문자 확인';

    if(body)body.value=entrySmsMessage(kind,item);
    renderEntrySmsRecipientEditor(item,item?.smsTargetMode==='representative'?'representative':'both');

    if(both)both.onclick=()=>selectEntrySmsRecipients('both');
    if(rep)rep.onclick=()=>selectEntrySmsRecipients('representative');
    if(editor){
      editor.oninput=syncEntrySmsTargetText;
      editor.onchange=syncEntrySmsTargetText;
    }

    if(typeof d.showModal==='function')d.showModal();
    else d.setAttribute('open','');
  }

  function closeEntrySmsDialog(){
    const d=document.getElementById('entrySmsDialog');
    if(d?.open)d.close();
    else d?.removeAttribute('open');
    entrySmsItem=null;
  }

  async function sendEntrySmsAligo(){
    if(!entrySmsItem)return;
    const body=document.getElementById('entrySmsBody')?.value?.trim()||'';
    const recipients=currentEntrySmsRecipients();
    if(!recipients.length)return notice('문자 받을 선수를 한 명 이상 선택하세요.','error');

    try{
      await sendAligoSmsV3(recipients,body,{
        source:'registration',
        kind:entrySmsItem.kind,
        title:'230MATCH 참가 안내'
      });
      entrySmsItem.item.smsHistory=entrySmsItem.item.smsHistory||[];
      entrySmsItem.item.smsHistory.unshift({
        kind:entrySmsItem.kind,
        channel:'aligo',
        sentAt:new Date().toISOString(),
        body,
        recipients
      });
      commit(`참가 안내 문자 발송 · ${entrySmsItem.item.teamName} · ${recipients.length}명`);
      notice(`알리고 문자를 ${recipients.length}명에게 발송했습니다.`,'success');
      closeEntrySmsDialog();
      renderApplications();
    }catch(e){
      notice(`문자 발송 실패: ${e?.message||e}`,'error');
    }
  }

  function sendEntrySmsPhone(){
    if(!entrySmsItem)return;
    const body=document.getElementById('entrySmsBody')?.value?.trim()||'';
    const recipients=currentEntrySmsRecipients();
    if(!recipients.length)return notice('문자 받을 선수를 한 명 이상 선택하세요.','error');

    const phones=recipients.map(x=>x.phone);
    if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'')){
      location.href=`sms:${phones.join(',')}?body=${encodeURIComponent(body)}`;
    }else{
      navigator.clipboard?.writeText(`${phones.join('\n')}\n\n${body}`);
    }

    entrySmsItem.item.smsHistory=entrySmsItem.item.smsHistory||[];
    entrySmsItem.item.smsHistory.unshift({
      kind:entrySmsItem.kind,
      channel:'phone',
      sentAt:new Date().toISOString(),
      body,
      recipients
    });
    commit(`참가 안내 문자앱 열기 · ${entrySmsItem.item.teamName} · ${recipients.length}명`);
    notice(`문자앱 수신자 ${recipients.length}명을 준비했습니다.`,'success');
    closeEntrySmsDialog();
  }

  async function copyEntrySms(){
    if(!entrySmsItem)return;
    const body=document.getElementById('entrySmsBody')?.value?.trim()||'';
    const recipients=currentEntrySmsRecipients();
    await navigator.clipboard.writeText(
      `${recipients.map(x=>`${x.name} ${x.phone}`).join('\n')}\n\n${body}`
    );
    notice('선택한 수신자와 문구를 복사했습니다.','success');
  }

  function bindEntrySmsDialog(){
    if(bound)return;
    bound=true;
    document.getElementById('entrySmsCloseBtn')?.addEventListener('click',closeEntrySmsDialog);
    document.getElementById('entrySmsSkipBtn')?.addEventListener('click',closeEntrySmsDialog);
    document.getElementById('entrySmsAligoBtn')?.addEventListener('click',sendEntrySmsAligo);
    document.getElementById('entrySmsPhoneBtn')?.addEventListener('click',sendEntrySmsPhone);
    document.getElementById('entrySmsCopyBtn')?.addEventListener('click',copyEntrySms);
  }

  return {
    entrySmsTemplate,
    entrySmsMessage,
    entrySmsDialogPlayers,
    renderEntrySmsRecipientEditor,
    currentEntrySmsRecipients,
    syncEntrySmsTargetText,
    selectEntrySmsRecipients,
    openEntrySmsDialog,
    closeEntrySmsDialog,
    sendEntrySmsAligo,
    sendEntrySmsPhone,
    copyEntrySms,
    bindEntrySmsDialog
  };
}
