// 230MATCH stable module · backup-center.js · 5.10.0
export function initBackupCenter(api){
  const {getState,registrationContext,registrationRuntime,REGISTRATION_COLLECTION,PUBLIC_REGISTRATION_COLLECTION,getRecoveries,requireAdmin,downloadJson,saveRecovery,notice,exportFullBackup,downloadRecoveryBundle,navigatePortalView,renderBackupRecoveryManager,restoreStateSnapshot,buildLabel=''}=api;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=v=>{try{return structuredClone(v);}catch(_e){return JSON.parse(JSON.stringify(v));}};
  const safePart=v=>String(v||'230MATCH').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim().slice(0,80)||'230MATCH';
  function context(){const state=getState();let c={};try{c=registrationContext()||{};}catch(_e){}return {tournamentId:String(c.tournamentId||state?.tournament?.id||''),tournamentName:String(c.tournamentName||state?.tournament?.name||'현재대회'),divisionId:String(c.divisionId||state?.multiDivision?.activeDivisionId||''),divisionName:String(c.divisionName||state?.tournament?.division||'')};}
  function belongs(row,ctx){if(String(row?.tournamentId||'')!==ctx.tournamentId)return false;const did=String(row?.divisionId||''),dn=String(row?.tournamentDivision||row?.divisionName||'').trim();if(ctx.divisionId&&did)return did===ctx.divisionId;if(ctx.divisionName&&dn)return dn===ctx.divisionName.trim();return true;}
  async function readCurrentRegistrationCollections(){const ctx=context(),rt=await registrationRuntime();if(!rt?.db||!rt?.api)throw new Error('Firebase 참가신청 저장소에 연결할 수 없습니다.');const [privateSnap,publicSnap]=await Promise.all([rt.api.getDocs(rt.api.query(rt.api.collection(rt.db,REGISTRATION_COLLECTION),rt.api.where('tournamentId','==',ctx.tournamentId))),rt.api.getDocs(rt.api.query(rt.api.collection(rt.db,PUBLIC_REGISTRATION_COLLECTION),rt.api.where('tournamentId','==',ctx.tournamentId)))]);const privateAll=privateSnap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>belongs(r,ctx));const publicRows=publicSnap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>belongs(r,ctx));const trashRows=privateAll.filter(r=>r?.trashed===true||r?.deletedToTrash===true);const activePrivate=privateAll.filter(r=>r?.trashed!==true&&r?.deletedToTrash!==true);return {ctx,privateAll,activePrivate,publicRows,trashRows};}
  async function downloadSafeBackup(){if(!requireAdmin('현재 대회 전체 안전백업'))return;const btn=document.querySelector('[data-stage5983-safe-backup]'),old=btn?.textContent||'';if(btn){btn.disabled=true;btn.textContent='백업 만드는 중...';}try{const state=getState(),data=await readCurrentRegistrationCollections(),recoveries=await getRecoveries().catch(()=>[]);const payload={format:'230MATCH_CURRENT_TOURNAMENT_SAFE_BACKUP',schemaVersion:1,backupCenterVersion:'5.10.7-module',appBuild:buildLabel,exportedAt:new Date().toISOString(),tournamentId:data.ctx.tournamentId,tournamentName:data.ctx.tournamentName,divisionId:data.ctx.divisionId,divisionName:data.ctx.divisionName,counts:{stateTeams:Array.isArray(state?.teams)?state.teams.length:0,registrationActive:data.activePrivate.length,registrationTrash:data.trashRows.length,publicRows:data.publicRows.length,localRecoveries:recoveries.length},currentState:clone(state),firebase:{matchRegistrationsV1:clone(data.privateAll),activeRegistrations:clone(data.activePrivate),trashRegistrations:clone(data.trashRows),matchRegistrationPublicV1:clone(data.publicRows)},localRecoveryIndex:recoveries.map(r=>({id:r.id,label:r.label,createdAt:r.createdAt,kind:r.kind||''}))};downloadJson(`${safePart(data.ctx.tournamentName)}-${safePart(data.ctx.divisionName||'전체')}-전체안전백업-${new Date().toISOString().slice(0,10)}-${Date.now()}.json`,payload);notice(`현재 대회 전체 안전백업을 저장했습니다. 참가신청 ${data.activePrivate.length}건 · 휴지통 ${data.trashRows.length}건 · 공개현황 ${data.publicRows.length}건이 포함되었습니다.`,'success');renderInfo().catch(()=>{});}catch(e){console.error('[backup-center] safe backup failed',e);notice(`전체 안전백업 실패: ${e?.message||e}`,'error');}finally{if(btn){btn.disabled=false;btn.textContent=old||'현재 대회 전체 안전백업';}}}
  async function createRecoveryNow(){if(!requireAdmin('현재 상태 복구점 저장'))return;try{const state=getState(),item=saveRecovery(state,`${state.tournament?.name||'현재 대회'} · 수동 안전복구점`,{kind:'manual'}),result=await item.ready;if(result?.saved)notice(`현재 상태 복구점을 저장했습니다. 전체 ${result.count||1}개 보관 중입니다.`,'success');else notice('로컬 복구점 저장에 실패했습니다. JSON 안전백업을 이용해 주세요.','warning');await renderInfo();}catch(e){notice(`복구점 저장 실패: ${e?.message||e}`,'error');}}

  let selectedBackupFile=null;
  let selectedBackupPayload=null;

  async function parseBackupFile(file){
    if(!file)throw new Error('백업 파일을 선택해 주세요.');
    let parsed;
    try{parsed=JSON.parse(await file.text());}
    catch(_e){throw new Error('백업 JSON 파일을 읽을 수 없습니다.');}

    const isSafe=parsed?.format==='230MATCH_CURRENT_TOURNAMENT_SAFE_BACKUP';
    const isFull=parsed?.format==='230MATCH_V3_FULL_BACKUP';
    const nextState=isSafe?parsed.currentState:isFull?parsed.state:parsed?.currentState||parsed?.state||null;
    if(!nextState?.tournament||!Array.isArray(nextState?.teams)){
      throw new Error('230MATCH 전체/안전 백업 형식이 아닙니다.');
    }
    return {parsed,isSafe,isFull,nextState};
  }

  function renderSelectedBackup(payload,file){
    const root=document.getElementById('stage5983RestorePreview');
    if(!root)return;
    if(!payload||!file){
      root.innerHTML='<span>복구할 JSON 백업 파일을 선택하면 내용을 먼저 확인할 수 있습니다.</span>';
      return;
    }
    const p=payload.parsed||{},state=payload.nextState||{};
    const counts=p.counts||{};
    root.innerHTML=`<b>${esc(file.name)}</b><br>
      백업시각 <b>${esc(p.exportedAt?new Date(p.exportedAt).toLocaleString('ko-KR'):'기록 없음')}</b><br>
      대회 <b>${esc(p.tournamentName||state.tournament?.name||'-')}</b> · 부서 <b>${esc(p.divisionName||state.tournament?.division||'-')}</b><br>
      운영 참가팀 <b>${Number(counts.stateTeams??state.teams?.length??0)}팀</b> · 참가신청 <b>${Number(counts.registrationActive??p.firebase?.activeRegistrations?.length??0)}건</b> · 휴지통 <b>${Number(counts.registrationTrash??p.firebase?.trashRegistrations?.length??0)}건</b>`;
  }

  async function chooseRestoreFile(){
    if(!requireAdmin('백업 파일 선택'))return;
    let input=document.getElementById('stage5983RestoreFileInput');
    if(!input){
      input=document.createElement('input');
      input.id='stage5983RestoreFileInput';
      input.type='file';
      input.accept='.json,application/json';
      input.hidden=true;
      document.body.appendChild(input);
      input.addEventListener('change',async()=>{
        const file=input.files?.[0];
        input.value='';
        if(!file)return;
        try{
          const payload=await parseBackupFile(file);
          selectedBackupFile=file;
          selectedBackupPayload=payload;
          renderSelectedBackup(payload,file);
          const missing=document.querySelector('[data-stage5983-restore-missing]');
          const full=document.querySelector('[data-stage5983-restore-state]');
          if(missing)missing.disabled=!payload.isSafe;
          if(full)full.disabled=false;
          notice('백업 파일을 읽었습니다. 아래 복구 방법을 선택해 주세요.','success');
        }catch(e){
          selectedBackupFile=null;selectedBackupPayload=null;
          renderSelectedBackup(null,null);
          notice(e?.message||String(e),'error');
        }
      });
    }
    input.click();
  }

  async function restoreMissingRegistrations(){
    if(!requireAdmin('누락 참가신청 복구'))return;
    const payload=selectedBackupPayload;
    if(!payload?.isSafe){
      notice('“현재 대회 전체 안전백업”으로 저장한 JSON 파일을 먼저 선택해 주세요.','warning');
      return;
    }

    const safe=payload.parsed;
    const privateRows=Array.isArray(safe?.firebase?.matchRegistrationsV1)?safe.firebase.matchRegistrationsV1:[];
    const publicRows=Array.isArray(safe?.firebase?.matchRegistrationPublicV1)?safe.firebase.matchRegistrationPublicV1:[];
    if(!privateRows.length&&!publicRows.length){
      notice('선택한 백업에 참가신청 Firebase 자료가 없습니다.','warning');
      return;
    }

    const ctx=context();
    const backupTid=String(safe.tournamentId||payload.nextState?.tournament?.id||'');
    const backupDid=String(safe.divisionId||'');
    if(backupTid&&ctx.tournamentId&&backupTid!==ctx.tournamentId){
      notice('현재 대회와 다른 대회의 백업입니다. 누락 참가신청 복구를 중단했습니다.','error');
      return;
    }
    if(backupDid&&ctx.divisionId&&backupDid!==ctx.divisionId){
      notice('현재 선택 부서와 다른 부서의 백업입니다. 누락 참가신청 복구를 중단했습니다.','error');
      return;
    }

    if(!confirm(`현재 대회에 없는 참가신청만 백업에서 복구할까요?\n\n기존 참가신청은 수정하거나 삭제하지 않습니다.`))return;
    const typed=prompt('누락 참가신청 복구를 진행하려면 “누락복구”를 입력하세요.','');
    if(typed!=='누락복구')return;

    const btn=document.querySelector('[data-stage5983-restore-missing]');
    const old=btn?.textContent||'';
    if(btn){btn.disabled=true;btn.textContent='누락 확인 중...';}

    try{
      const rt=await registrationRuntime();
      if(!rt?.db||!rt?.api)throw new Error('Firebase 참가신청 저장소에 연결할 수 없습니다.');

      const current=await readCurrentRegistrationCollections();
      const privateIds=new Set(current.privateAll.map(x=>String(x.id||'')));
      const publicIds=new Set(current.publicRows.map(x=>String(x.id||'')));

      const missingPrivate=privateRows.filter(x=>x?.id&&!privateIds.has(String(x.id)));
      const missingPublic=publicRows.filter(x=>x?.id&&!publicIds.has(String(x.id)));

      if(!missingPrivate.length&&!missingPublic.length){
        notice('현재 Firebase와 비교한 결과 누락된 참가신청이 없습니다.','success');
        return;
      }

      try{
        const recovery=saveRecovery(getState(),`${getState().tournament?.name||'현재 대회'} · 참가신청 누락복구 직전`,{kind:'manual'});
        await recovery?.ready;
      }catch(_e){}

      for(const row of missingPrivate){
        const data=clone(row);delete data.id;
        await rt.api.setDoc(rt.api.doc(rt.db,REGISTRATION_COLLECTION,String(row.id)),data,{merge:false});
      }
      for(const row of missingPublic){
        const data=clone(row);delete data.id;
        await rt.api.setDoc(rt.api.doc(rt.db,PUBLIC_REGISTRATION_COLLECTION,String(row.id)),data,{merge:false});
      }

      notice(`누락 참가신청 복구 완료 · 원본 ${missingPrivate.length}건 · 공개현황 ${missingPublic.length}건. 기존 자료는 변경하지 않았습니다.`,'success');
      await renderInfo();
    }catch(e){
      console.error('[backup-center] missing registration restore failed',e);
      notice(`누락 참가신청 복구 실패: ${e?.message||e}`,'error');
    }finally{
      if(btn){btn.disabled=false;btn.textContent=old||'누락 참가신청만 복구';}
    }
  }

  async function restoreFullState(){
    if(!requireAdmin('전체 상태 복원'))return;
    const payload=selectedBackupPayload;
    if(!payload?.nextState){
      notice('복구할 JSON 백업 파일을 먼저 선택해 주세요.','warning');
      return;
    }
    if(typeof restoreStateSnapshot!=='function'){
      notice('전체 상태 복원 기능이 연결되지 않았습니다.','error');
      return;
    }

    const current=context();
    const backupTid=String(payload.parsed?.tournamentId||payload.nextState?.tournament?.id||'');
    if(backupTid&&current.tournamentId&&backupTid!==current.tournamentId){
      if(!confirm('현재 대회와 다른 대회의 백업입니다. 그래도 전체 상태를 교체할까요?'))return;
    }else if(!confirm('현재 운영 상태 전체를 선택한 백업 시점으로 되돌릴까요?\n\n복원 직전 상태는 자동 복구점으로 먼저 저장됩니다.')){
      return;
    }

    const typed=prompt('전체 상태 복원은 예선·본선·코트·결과까지 백업 시점으로 되돌립니다.\n계속하려면 “전체복원”을 입력하세요.','');
    if(typed!=='전체복원')return;

    try{
      await restoreStateSnapshot(payload.nextState,{label:payload.parsed?.tournamentName||payload.nextState?.tournament?.name||'백업 대회'});
      notice('전체 운영 상태를 백업 시점으로 복원했습니다. 화면을 새로 불러옵니다.','success');
      setTimeout(()=>location.reload(),500);
    }catch(e){
      console.error('[backup-center] full state restore failed',e);
      notice(`전체 상태 복원 실패: ${e?.message||e}`,'error');
    }
  }

  function ensureDialog(){let d=document.getElementById('stage5983BackupCenter');if(d)return d;d=document.createElement('dialog');d.id='stage5983BackupCenter';d.className='stage5983-backup-center';d.innerHTML=`<div class="stage5983-shell"><div class="stage5983-head"><div><strong>💾 백업·복구 관리</strong><span>현재 대회의 중요한 데이터를 파일과 복구점으로 안전하게 보관합니다.</span></div><button type="button" class="btn btn-light btn-small" data-stage5983-close>닫기</button></div><section class="stage5983-primary"><div><b>현재 대회 전체 안전백업</b><p>운영 상태 + 참가신청 원본 + 공개 참가현황 + 휴지통을 한 JSON 파일로 저장합니다.</p></div><button type="button" class="btn btn-primary" data-stage5983-safe-backup>현재 대회 전체 안전백업</button></section><div id="stage5983BackupInfo" class="stage5983-info">현재 상태를 확인하는 중입니다.</div><section class="stage5983-restore"><div><b>백업 파일로 복구</b><p>먼저 JSON 파일을 선택한 뒤 복구 범위를 선택합니다.</p></div><button type="button" class="btn btn-light" data-stage5983-choose-restore>JSON 백업 파일 선택</button></section><div id="stage5983RestorePreview" class="stage5983-info stage5983-restore-preview"><span>복구할 JSON 백업 파일을 선택하면 내용을 먼저 확인할 수 있습니다.</span></div><section class="stage5983-actions stage5983-restore-actions"><button type="button" class="btn btn-primary" data-stage5983-restore-missing disabled>누락 참가신청만 복구</button><button type="button" class="btn btn-danger-outline" data-stage5983-restore-state disabled>전체 상태 복원</button></section><div class="stage5983-note">누락 참가신청 복구는 현재 Firebase에 없는 신청만 추가하며 기존 자료는 건드리지 않습니다. 전체 상태 복원은 예선·본선·코트·결과까지 백업 시점으로 되돌리므로 비상시에만 사용하세요.</div><section class="stage5983-actions"><button type="button" class="btn btn-light" data-stage5983-state-json>전체 상태 JSON 저장</button><button type="button" class="btn btn-light" data-stage5983-recovery>현재 상태 복구점 저장</button><button type="button" class="btn btn-light" data-stage5983-recovery-bundle>복구점 묶음 파일 저장</button><button type="button" class="btn btn-light" data-stage5983-existing-manager>기존 상세 백업관리 보기</button></section></div>`;document.body.appendChild(d);if(!document.getElementById('stage5983BackupCenterStyle')){const style=document.createElement('style');style.id='stage5983BackupCenterStyle';style.textContent=`.stage5983-backup-center{width:min(760px,95vw);max-height:88vh;border:0;border-radius:20px;padding:0;box-shadow:0 25px 80px rgba(15,35,70,.30)}.stage5983-backup-center::backdrop{background:rgba(15,23,42,.46)}.stage5983-shell{padding:20px;background:#fff;color:#172554}.stage5983-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;border-bottom:1px solid #dbe4f0;padding-bottom:14px}.stage5983-head>div{display:flex;flex-direction:column;gap:4px}.stage5983-head strong{font-size:20px}.stage5983-head span{font-size:12px;color:#64748b}.stage5983-primary{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:16px 0;padding:16px;border:2px solid #2563eb;border-radius:16px;background:#eff6ff}.stage5983-primary b{font-size:16px;color:#1e3a8a}.stage5983-primary p{margin:5px 0 0;font-size:12px;color:#475569;line-height:1.5}.stage5983-info{padding:12px 14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;line-height:1.7}.stage5983-restore{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0}.stage5983-restore b{font-size:15px}.stage5983-restore p{margin:4px 0 0;font-size:12px;color:#64748b}.stage5983-restore-preview{margin-top:10px}.stage5983-restore-actions{margin-top:10px}.stage5983-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.stage5983-note{margin-top:14px;padding:10px 12px;border-radius:12px;background:#ecfdf5;color:#166534;font-size:12px;font-weight:700;line-height:1.5}@media(max-width:640px){.stage5983-shell{padding:14px}.stage5983-primary{display:block}.stage5983-primary button{width:100%;margin-top:12px}.stage5983-actions .btn{width:100%}}`;document.head.appendChild(style);}d.addEventListener('click',e=>{if(e.target===d||e.target.closest?.('[data-stage5983-close]')){d.close();return;}if(e.target.closest?.('[data-stage5983-safe-backup]')){void downloadSafeBackup();return;}if(e.target.closest?.('[data-stage5983-choose-restore]')){void chooseRestoreFile();return;}if(e.target.closest?.('[data-stage5983-restore-missing]')){void restoreMissingRegistrations();return;}if(e.target.closest?.('[data-stage5983-restore-state]')){void restoreFullState();return;}if(e.target.closest?.('[data-stage5983-state-json]')){if(requireAdmin('전체 상태 JSON 저장'))exportFullBackup();return;}if(e.target.closest?.('[data-stage5983-recovery]')){void createRecoveryNow();return;}if(e.target.closest?.('[data-stage5983-recovery-bundle]')){void downloadRecoveryBundle();return;}if(e.target.closest?.('[data-stage5983-existing-manager]')){d.close();navigatePortalView('settings',{pushHistory:true});setTimeout(()=>{const section=document.querySelector('.backup-recovery-manager');if(section){section.hidden=false;section.style.display='';section.scrollIntoView({behavior:'smooth',block:'start'});section.classList.add('settings-target-flash');setTimeout(()=>section.classList.remove('settings-target-flash'),1800);try{renderBackupRecoveryManager();}catch(_e){}}else notice('기존 상세 백업관리 영역을 찾지 못했습니다. 위 안전백업 기능은 정상 사용할 수 있습니다.','warning');},180);}});return d;}
  async function renderInfo(){const el=document.getElementById('stage5983BackupInfo');if(!el)return;try{const state=getState(),data=await readCurrentRegistrationCollections(),rs=await getRecoveries().catch(()=>[]);el.innerHTML=`<b>${esc(data.ctx.tournamentName)}</b> · ${esc(data.ctx.divisionName||'부서 미설정')}<br>운영 참가팀 <b>${Array.isArray(state?.teams)?state.teams.length:0}팀</b> · 참가신청 원본 <b>${data.activePrivate.length}건</b> · 공개현황 <b>${data.publicRows.length}건</b> · 휴지통 <b>${data.trashRows.length}건</b> · 로컬 복구점 <b>${rs.length}개</b>`;}catch(e){el.textContent=`현재 상태 확인 중 일부 Firebase 정보를 읽지 못했습니다: ${e?.message||e}`;}}
  window.stage5983OpenBackupCenter=function(){if(!requireAdmin('백업·복구 관리'))return;const d=ensureDialog();if(typeof d.showModal==='function'){if(!d.open)d.showModal();}else d.setAttribute('open','');void renderInfo();};
}

// 5.10.7 · JSON safe-backup restore UI added.
