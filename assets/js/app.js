'use strict';
// ── 현재 연도 (매년 자동 갱신 - 코드 수정 불필요) ──
const REG_YEAR = new Date().getFullYear(); // 2026, 2027, 2028...
// ── 대회 편집 복식 수 헬퍼 ──
function etToggleRub(dk){
  const chk=ge('etD_'+({'G':'금','S':'은','B':'동','T':'테린이'}[dk]||dk));
  const sel=ge('etRubSel'+dk);
  if(!sel)return;
  sel.style.display=(chk&&chk.checked)?'flex':'none';
}
function etSelRub(dk,n){
  const b5=ge('etRub'+dk+'_5'),b3=ge('etRub'+dk+'_3');
  if(!b5||!b3)return;
  b5.classList.toggle('active',n===5);
  b3.classList.toggle('active',n===3);
}
function etGetRubbers(dk){
  const b3=ge('etRub'+dk+'_3');
  if(!b3)return({'G':5,'S':5,'B':5,'T':3}[dk]||5);
  return b3.classList.contains('active')?3:5;
}

// ── 부서별 복식 수 선택 헬퍼 ──
// divKey: 'G'=금, 'S'=은, 'B'=동, 'T'=테린이
const DIV_RUB_DEFAULT={'G':5,'S':5,'B':5,'T':3};
function toggleDivRubber(dk){
  const chk=ge('div'+dk);
  const sel=ge('rubSel'+dk);
  if(!chk||!sel)return;
  sel.style.display=chk.checked?'flex':'none';
}
function selRub(dk,n){
  // 활성 토글
  const btn5=ge('rub'+dk+'_5'),btn3=ge('rub'+dk+'_3');
  if(!btn5||!btn3)return;
  btn5.classList.toggle('active',n===5);
  btn3.classList.toggle('active',n===3);
}
function getDivRubbers(dk){
  const btn3=ge('rub'+dk+'_3');
  if(!btn3)return DIV_RUB_DEFAULT[dk]||5;
  return btn3.classList.contains('active')?3:5;
}

// ── 대회별 코트군/코트 목록 헬퍼 ──────────────────────────
const DEFAULT_COURT_GROUPS = [
  { title: '능동', courts: Array.from({length:8},(_,i)=>`장유능동${i+1}`) },
  { title: '국제', courts: Array.from({length:8},(_,i)=>`장유국제${i+1}`) },
  { title: '금병', courts: Array.from({length:4},(_,i)=>`금병${i+1}`) },
  { title: '신삼계', courts: Array.from({length:10},(_,i)=>`신삼계${i+1}`) },
  { title: '구삼계', courts: Array.from({length:2},(_,i)=>`구삼계${i+1}`) },
  { title: '원도심', courts: Array.from({length:4},(_,i)=>`원도심${i+1}`) },
  { title: '동부', courts: Array.from({length:7},(_,i)=>`동부${i+1}`) }
];
const DEFAULT_COURT_LIST = DEFAULT_COURT_GROUPS.flatMap(g=>g.courts);
let _customCourtGroupList = []; // [{name,count}]
function getTournamentCourtGroups(tid, fallback=true){
  try{
    const t=(G.tournaments||[]).find(x=>x.id===tid);
    const arr=normalizeCourtGroups(t?.courtGroups||[]);
    if(arr.length) return arr;
  }catch(e){}
  return fallback ? DEFAULT_COURT_GROUPS.map(g=>({name:g.title,count:(g.courts||[]).length})) : [];
}
function getTournamentCourtList(tid, fallback=true){
  const groups=getTournamentCourtGroups(tid, fallback);
  return uniqueCourtList(buildCourtList(groups));
}
function getDraftCourtGroups(mode='create'){
  const raw = mode==='edit' ? (window._etCourtGroupList||[]) : _customCourtGroupList;
  return normalizeCourtGroups(raw);
}
function getDraftCourtList(mode='create'){
  const groups=getDraftCourtGroups(mode);
  const expanded=expandCourtGroups(groups);
  return (expanded.length?expanded:DEFAULT_COURT_GROUPS).flatMap(g=>g.courts||[]);
}
function getCourtGroupsForTournamentOrKey(input, fallback=true){
  if(!input) return fallback ? DEFAULT_COURT_GROUPS : [];
  const str=String(input);
  const tid=str.includes('_') ? _k2td(str).tid : str;
  return expandCourtGroups(getTournamentCourtGroups(tid, fallback));
}
function getAllKnownCourts(tid=''){
  const list=[...DEFAULT_COURT_LIST, ...getTournamentCourtList(tid,true)];
  return uniqueCourtList(list);
}
function renderCourtGroupManager(mode='create'){
  const list=mode==='edit' ? (window._etCourtGroupList||[]) : _customCourtGroupList;
  const targetId=mode==='edit' ? 'etCourtGroupList' : 'courtGroupList';
  const el=ge(targetId);
  if(!el) return;
  if(!list.length){
    el.innerHTML='<div style="font-size:.75rem;color:var(--text3);padding:8px 0">코트군을 추가해 주세요. 비워두면 기존 기본 코트 목록을 사용합니다.</div>';
    return;
  }
  el.innerHTML=list.map((g,i)=>`<div style="padding:9px 10px;background:var(--panel2);border:1px solid var(--border);border-radius:10px"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-weight:800;font-size:.84rem;min-width:90px">${g.name}</span><input class="form-input" value="${g.name}" style="flex:1;min-width:120px;font-size:.8rem;padding:6px 10px" onchange="setCourtGroupName('${mode}',${i},this.value)"><input class="form-input" type="number" min="1" value="${g.count}" style="width:90px;font-size:.8rem;padding:6px 10px" onchange="setCourtGroupCount('${mode}',${i},this.value)"><span class="badge bg-blue" style="font-size:.7rem">${Array.from({length:Math.max(1,parseInt(g.count||1)||1)},(_,idx)=>`${g.name}${idx+1}`).slice(0,4).join(', ')}${Number(g.count)>4?' ...':''}</span><button type="button" class="btn btn-danger" style="padding:3px 8px;font-size:.72rem" onclick="removeCourtGroup('${mode}',${i})">✕</button></div></div>`).join('');
}
function addCourtPreset(name,count,mode='create'){
  const list=mode==='edit' ? (window._etCourtGroupList||(window._etCourtGroupList=[])) : _customCourtGroupList;
  if(list.find(g=>String(g.name).trim()===String(name).trim())){ toast('이미 추가된 코트군입니다','info'); return; }
  list.push({name:String(name).trim(), count:Math.max(1,parseInt(count||1)||1)});
  renderCourtGroupManager(mode);
  if(mode==='edit') _renderEtDivList(); else _renderCustomDivList();
}
function addCourtGroup(mode='create'){
  const name=(ge(mode==='edit'?'etNewCourtGroupName':'newCourtGroupName')?.value||'').trim();
  const count=Math.max(1, parseInt(ge(mode==='edit'?'etNewCourtGroupCount':'newCourtGroupCount')?.value||'0')||0);
  if(!name){ toast('코트군 이름을 입력해 주세요','error'); return; }
  if(!count){ toast('면수를 입력해 주세요','error'); return; }
  addCourtPreset(name,count,mode);
  if(ge(mode==='edit'?'etNewCourtGroupName':'newCourtGroupName')) ge(mode==='edit'?'etNewCourtGroupName':'newCourtGroupName').value='';
  if(ge(mode==='edit'?'etNewCourtGroupCount':'newCourtGroupCount')) ge(mode==='edit'?'etNewCourtGroupCount':'newCourtGroupCount').value='';
}
function setCourtGroupName(mode, idx, value){
  const list=mode==='edit' ? (window._etCourtGroupList||[]) : _customCourtGroupList;
  const item=list[idx]; if(!item) return;
  item.name=String(value||'').trim()||item.name;
  renderCourtGroupManager(mode);
  if(mode==='edit') _renderEtDivList(); else _renderCustomDivList();
}
function setCourtGroupCount(mode, idx, value){
  const list=mode==='edit' ? (window._etCourtGroupList||[]) : _customCourtGroupList;
  const item=list[idx]; if(!item) return;
  item.count=Math.max(1, parseInt(value||'0')||1);
  renderCourtGroupManager(mode);
  if(mode==='edit') _renderEtDivList(); else _renderCustomDivList();
}
function removeCourtGroup(mode, idx){
  const list=mode==='edit' ? (window._etCourtGroupList||[]) : _customCourtGroupList;
  list.splice(idx,1);
  renderCourtGroupManager(mode);
  if(mode==='edit') _renderEtDivList(); else _renderCustomDivList();
}
window.addCourtGroup=addCourtGroup;
window.addCourtPreset=addCourtPreset;
window.setCourtGroupName=setCourtGroupName;
window.setCourtGroupCount=setCourtGroupCount;
window.removeCourtGroup=removeCourtGroup;

// ── 커스텀 부서 목록 관리 (대회 생성용) ──────────────────────────
let _customDivList = []; // [{name, rub, maxTeams}]
function _renderCustomDivList(){
  const list=ge('customDivList');
  const empty=ge('customDivEmpty');
  if(!list)return;
  if(!_customDivList.length){
    list.innerHTML='<div style="font-size:.75rem;color:var(--text3);padding:8px 0" id="customDivEmpty">부서를 추가해 주세요</div>';
    return;
  }
  list.innerHTML=_customDivList.map((d,i)=>`
    <div style="padding:9px 10px;background:var(--panel2);border:1px solid var(--border);border-radius:10px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-weight:700;font-size:.85rem;flex:1">${d.name}</span>
        <select class="form-select" style="width:80px;font-size:.78rem;padding:3px 6px" onchange="_customDivList[${i}].rub=parseInt(this.value)">
          <option value="5" ${d.rub===5?'selected':''}>5복식</option>
          <option value="4" ${d.rub===4?'selected':''}>4복식</option>
          <option value="3" ${d.rub===3?'selected':''}>3복식</option>
          <option value="2" ${d.rub===2?'selected':''}>2복식</option>
          <option value="1" ${d.rub===1?'selected':''}>1복식</option>
        </select>
        <input class="form-input" type="number" min="0" value="${d.maxTeams||''}" placeholder="정원"
          style="width:78px;font-size:.76rem;padding:4px 8px" onchange="_customDivList[${i}].maxTeams=parseInt(this.value||'0')||0">
        <button class="btn btn-danger" style="padding:3px 8px;font-size:.72rem" onclick="_removeCustomDiv(${i})">✕</button>
      </div>
      ${renderDivisionCourtInlineSelector(d.courts||[],'create',i)}
    </div>`).join('');
}
function _removeCustomDiv(i){
  _customDivList.splice(i,1);
  _renderCustomDivList();
}
function addPresetDiv(name, rub){
  if(_customDivList.find(d=>d.name===name)){toast(`"${name}" 이미 추가됨`,'info');return;}
  _customDivList.push({name,rub,maxTeams:0,courts:[]});
  _renderCustomDivList();
}
function addCustomDiv(){
  const name=(ge('newDivName')?.value||'').trim();
  const rub=parseInt(ge('newDivRub')?.value||'5');
  const maxTeams=parseInt(ge('newDivMaxTeams')?.value||'0')||0;
  if(!name){toast('부서명을 입력해 주세요','error');return;}
  if(_customDivList.find(d=>d.name===name)){toast(`"${name}" 이미 추가됨`,'info');return;}
  _customDivList.push({name,rub,maxTeams,courts:[]});
  if(ge('newDivName'))ge('newDivName').value='';
  if(ge('newDivMaxTeams'))ge('newDivMaxTeams').value='';
  _renderCustomDivList();
}
function getCustomDivList(){return _customDivList.slice();}
function clearCustomDivList(){_customDivList=[];_renderCustomDivList();}
function getDivisionConfiguredCourts(tid, div){
  try{
    const t=(G.tournaments||[]).find(x=>x.id===tid);
    const arr=((t?.divSettings?.[div]?.allowedCourts)||[]);
    return Array.isArray(arr)?arr.map(String).filter(Boolean):[];
  }catch(e){ return []; }
}
function renderDivisionCourtInlineSelector(selectedCourts=[], mode='create', idx=0){
  const selected=new Set((selectedCourts||[]).map(String).filter(Boolean));
  const courtGroups=expandCourtGroups(getDraftCourtGroups(mode));
  const groups=courtGroups.length ? courtGroups : DEFAULT_COURT_GROUPS;
  return `<div style="margin-top:8px;padding:10px 12px;background:linear-gradient(135deg,#f8fbff,#fffdf5);border:1px solid #dbe7ff;border-radius:12px">
    <div style="font-size:.76rem;font-weight:900;color:var(--primary-dark);margin-bottom:8px">🎾 사용 코트 설정</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      <button type="button" class="btn btn-outline" style="font-size:.7rem;padding:3px 9px;min-height:30px" onclick="toggleDivisionCourtsAll('${mode}',${idx},true)">전체 선택</button>
      <button type="button" class="btn btn-outline" style="font-size:.7rem;padding:3px 9px;min-height:30px" onclick="toggleDivisionCourtsAll('${mode}',${idx},false)">전체 해제</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">${groups.map((g,gidx)=>{
      const picked=(g.courts||[]).filter(c=>selected.has(String(c)));
      const body=(g.courts||[]).map(c=>`<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid ${selected.has(String(c))?'#1565c0':'var(--border)'};border-radius:999px;background:${selected.has(String(c))?'#e8f4fd':'#fff'};font-size:.76rem;font-weight:${selected.has(String(c))?800:600};cursor:pointer"><input type="checkbox" ${selected.has(String(c))?'checked':''} onchange="setDivisionCourtSelection('${mode}',${idx},${JSON.stringify(c).replace(/"/g,'&quot;')},this.checked)"><span>${c}</span></label>`).join('');
      return `<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#fff"><button type="button" onclick="toggleCourtAccordion('divCourt_${mode}_${idx}_${gidx}', this)" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border:none;background:${picked.length?'linear-gradient(135deg,#eef4ff,#fff8df)':'#f8fafc'};cursor:pointer"><span style="font-size:.78rem;font-weight:900;color:var(--primary-dark)">📍 ${g.title}</span><span style="font-size:.7rem;color:${picked.length?'var(--primary)':'var(--text2)'}">${picked.length?picked.join('/'):'선택 없음'}</span></button><div id="divCourt_${mode}_${idx}_${gidx}" style="display:${picked.length?'block':'none'};padding:10px;border-top:1px solid var(--border)"><div style="display:flex;flex-wrap:wrap;gap:6px">${body}</div></div></div>`;
    }).join('')}</div>
    <div style="font-size:.68rem;color:var(--text3);margin-top:8px">선택 안 하면 현재 대회의 전체 운영 코트를 허용합니다.</div>
  </div>`;
}
function setDivisionCourtSelection(mode, idx, court, checked){
  const list = mode==='edit' ? (window._etDivList||[]) : _customDivList;
  const item=list[idx]; if(!item) return;
  if(!Array.isArray(item.courts)) item.courts=[];
  const v=String(court);
  item.courts = checked ? [...new Set([...item.courts, v])] : item.courts.filter(x=>String(x)!==v);
  mode==='edit' ? _renderEtDivList() : _renderCustomDivList();
}
function toggleDivisionCourtsAll(mode, idx, flag){
  const list = mode==='edit' ? (window._etDivList||[]) : _customDivList;
  const item=list[idx]; if(!item) return;
  item.courts = flag ? getDraftCourtList(mode).slice() : [];
  mode==='edit' ? _renderEtDivList() : _renderCustomDivList();
}
window.setDivisionCourtSelection=setDivisionCourtSelection;
window.toggleDivisionCourtsAll=toggleDivisionCourtsAll;

function getSelectedTournamentType(){
  return ge('tType')?.value || 'team';
}
function getTournamentTypeById(tid){
  const t=(G.tournaments||[]).find(x=>x.id===tid);
  return t?.type || 'team';
}
function isIndividualTournament(t){
  return (t?.type||'team')==='individual_pair';
}
function isIndividualByKey(key=''){
  const tid=String(key||'').split('_')[0]||'';
  return getTournamentTypeById(tid)==='individual_pair';
}
function currentRegTournament(){
  const tid=ge('regTS')?.value||'';
  return (G.tournaments||[]).find(x=>x.id===tid)||null;
}
function currentRegIsIndividual(){
  const t=currentRegTournament();
  return isIndividualTournament(t);
}
function setRegClubInputMode(isIndividual){
  const freeClubInput = isIndividual || !usesFixedClubList();
  const selWrap=ge('regClubSelectWrap');
  const txtWrap=ge('regClubTextWrap');
  const clubGroup=ge('regClubLabel')?.closest('.form-group');
  const noGroup=ge('regNoLabel')?.closest('.form-group');
  if(selWrap) selWrap.style.display=freeClubInput?'none':'block';
  if(txtWrap) txtWrap.style.display=freeClubInput?'block':'none';
  if(clubGroup) clubGroup.style.display='';
  if(noGroup) noGroup.style.display=isIndividual?'none':'';
  if(ge('regClubLabel')) ge('regClubLabel').innerHTML = isIndividual ? '대표 클럽/팀명' : (freeClubInput ? '클럽/팀명<span class="req">*</span>' : '클럽<span class="req">*</span>');
  if(ge('regClubText')) ge('regClubText').placeholder = isIndividual ? '예: 모던,나이스 / 개인전 팀명 입력' : '예: 모던 / 김해 / 자체 대회 클럽명 입력';
  const row=ge('regContactRow');
  if(row && (freeClubInput || isIndividual)) row.style.display='none';
}
function getRegClubInputValue(){
  if(currentRegIsIndividual() || !usesFixedClubList()) return (ge('regClubText')?.value||'').trim();
  return (ge('regClub')?.value||'').trim();
}
function getDivisionMaxTeams(tid, div){
  const t=(G.tournaments||[]).find(x=>x.id===tid);
  const v=Number(t?.divSettings?.[div]?.maxTeams||0);
  return Number.isFinite(v)&&v>0?v:0;
}
function getDivisionLabelForRegister(div, t){
  const type=t?.type||'team';
  return type==='individual_pair' ? `${div} 참가현황` : dl(div);
}
function parseClubAliases(raw=''){
  return String(raw||'').split(',').map(s=>normalizeClub(s.trim())).filter(Boolean);
}
function getIndividualPlayers(team){
  if(Array.isArray(team?.individualPlayers) && team.individualPlayers.length){
    return team.individualPlayers.map((p,idx)=>({
      ...p,
      receiveSms: p?.receiveSms !== false,
      receiveOrderSms: p?.receiveOrderSms !== false,
      receiveResultSms: p?.receiveResultSms !== false
    }));
  }
  const ps=(team?.players||[]).slice(0,2);
  return ps.map((name)=>({
    name,
    clubsRaw:String(team?.club||'').trim(),
    clubs:parseClubAliases(team?.club||''),
    phone:'',
    receiveSms:true,
    receiveOrderSms:true,
    receiveResultSms:true
  }));
}
function getTeamClubTokens(team){
  if(Array.isArray(team?.individualPlayers) && team.individualPlayers.length){
    return [...new Set(team.individualPlayers.flatMap(p=>Array.isArray(p?.clubs)&&p.clubs.length?p.clubs:parseClubAliases(p?.clubsRaw||'')))].filter(Boolean);
  }
  return [...new Set(parseClubAliases(team?.club||''))];
}
function formatPhoneLoose(raw=''){
  const v=String(raw||'').trim();
  if(!v) return '';
  const digits=v.replace(/[^0-9]/g,'');
  if(digits.length===11) return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
  if(digits.length===10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  return v.replace(/[^0-9-]/g,'');
}

const PERSONAL_MATCH_PHONE_KEY='kimhae_personal_match_phone_v1';
function getPersonalMatchPhone(){
  try{return normalizePhoneDigits(localStorage.getItem(PERSONAL_MATCH_PHONE_KEY)||'');}catch(e){return '';}
}
function setPersonalMatchPhone(raw=''){
  const digits=normalizePhoneDigits(raw);
  if(digits.length<9){ toast('전화번호를 다시 확인해 주세요','error'); return false; }
  try{ localStorage.setItem(PERSONAL_MATCH_PHONE_KEY, digits); }catch(e){}
  toast('내 경기 전화번호를 저장했습니다 ✅','success');
  try{ renderBracket(); }catch(e){}
  return true;
}
function promptPersonalMatchPhone(){
  const prev=formatPhoneLoose(getPersonalMatchPhone());
  const raw=window.prompt('개인전 내 경기 확인용 전화번호를 입력하세요.\n(참가 등록 때 입력한 번호)', prev||'');
  if(raw===null) return;
  setPersonalMatchPhone(raw);
}
function clearPersonalMatchPhone(){
  try{ localStorage.removeItem(PERSONAL_MATCH_PHONE_KEY); }catch(e){}
  toast('저장된 전화번호를 지웠습니다','success');
  try{ renderBracket(); }catch(e){}
}
function teamHasPersonalPhone(team, digits=''){
  const target=normalizePhoneDigits(digits);
  if(!target) return false;
  const players=getIndividualPlayers(team);
  return players.some(p=>normalizePhoneDigits(p?.phone||'')===target);
}
function getPersonalSideInfo(team, digits=''){
  const target=normalizePhoneDigits(digits);
  if(!target) return null;
  const players=getIndividualPlayers(team);
  const idx=players.findIndex(p=>normalizePhoneDigits(p?.phone||'')===target);
  if(idx<0) return null;
  const p=players[idx]||{};
  return {index:idx, player:p, name:String(p?.name||'').trim(), club:String(p?.clubsRaw||'').trim()};
}
function getPersonalizedIndividualMatches(tid, divs, digits=''){
  const target=normalizePhoneDigits(digits);
  if(!tid || !target) return [];
  const out=[];
  (divs||[]).forEach(div=>{
    const key=tid+'_'+div;
    const teams=G.teams[key]||[];
    (G.matches[key]||[]).forEach(m=>{
      if(!m || m.bye) return;
      const t1=teams[m.t1]??teams.find(t=>t&&((t.id!=null&&t.id===m.t1)||(t.name&&t.name===m.t1)));
      const t2=teams[m.t2]??teams.find(t=>t&&((t.id!=null&&t.id===m.t2)||(t.name&&t.name===m.t2)));
      const side1=teamHasPersonalPhone(t1,target);
      const side2=teamHasPersonalPhone(t2,target);
      if(!side1 && !side2) return;
      out.push({tid,div,key,match:m,team1:t1,team2:t2,mySide:side1?1:2,myInfo:side1?getPersonalSideInfo(t1,target):getPersonalSideInfo(t2,target)});
    });
  });
  return out.sort((a,b)=>{
    const ma=a.match||{}, mb=b.match||{};
    const pa=String(ma.phase||''), pb=String(mb.phase||'');
    const order=(p)=>p==='group'?0:(p==='playin'?1:(p==='main'?2:3));
    if(order(pa)!==order(pb)) return order(pa)-order(pb);
    if(Number(ma.group??-1)!==Number(mb.group??-1)) return Number(ma.group??-1)-Number(mb.group??-1);
    if(Number(ma.round||0)!==Number(mb.round||0)) return Number(ma.round||0)-Number(mb.round||0);
    if(Number(ma.slot||0)!==Number(mb.slot||0)) return Number(ma.slot||0)-Number(mb.slot||0);
    return String(ma.id||'').localeCompare(String(mb.id||''),'ko');
  });
}
function getPersonalMatchStatusLabel(key, m){
  const st=getMatchResultState(key,m);
  const targetId=String(m?.id||'');
  const courts=getMatchCourtsForStatusBoard(key,m)||[];
  const courtTxt=courts.length?` · 🎾 ${courts.join('/')}`:'';
  const makeStatus=(text,tone,bg,border,code,priority,waitingOrder,extra={})=>({text,tone,bg,border,code,priority,waitingOrder,...extra});
  if(st.done){
    const winSide=st.winner===m.t1?1:(st.winner===m.t2?2:0);
    return makeStatus(`경기 완료${courtTxt}`,'#166534','#dcfce7','#86efac','done',90,999,{winSide});
  }
  if(st.started){
    return makeStatus(`경기중 ${st.disp1??st.sc1??0}:${st.disp2??st.sc2??0}${courtTxt}`,'#b45309','#fff7ed','#fdba74','live',0,0,{winSide:0});
  }
  const buildQueueStatus=(courtList)=>{
    if(!courtList.length) return null;
    for(const court of courtList){
      const queue=getCourtQueueInfo(key,court);
      const currentId=String(queue?.active?.id||'');
      if(currentId===targetId){
        return makeStatus(`곧 시작 · 🎾 ${court}`,'#92400e','#fff7ed','#fdba74','start_soon',1,0,{court,winSide:0});
      }
      const waiting=(queue?.waiting||[]).map(x=>String(x?.id||''));
      const idx=waiting.indexOf(targetId);
      if(idx>=0){
        const isSoon=idx===0;
        return makeStatus(`코트 대기 ${idx+1}번 · 🎾 ${court}`,isSoon?'#92400e':'#9a3412','#fff7ed','#fdba74',isSoon?'start_soon':'court_wait',isSoon?2:(10+idx),idx+1,{court,winSide:0});
      }
    }
    return courtList.length ? makeStatus(`코트 배정 완료 · 🎾 ${courtList.join('/')}`,'#7c3aed','#f5f3ff','#c4b5fd','assigned',20,98,{court:courtList[0],winSide:0}) : null;
  };
  const directStatus=buildQueueStatus(courts);
  if(directStatus) return directStatus;

  if(isIndividualByKey(key) && isIndividualAutoCourtAssignEnabled()){
    try{
      const snapshots=getCourtStatusSnapshot(key)||[];
      for(const item of snapshots){
        const court=String(item?.court||'').trim();
        if(!court) continue;
        const currentId=String(item?.current?.id||'');
        if(currentId===targetId){
          return makeStatus(`곧 시작 · 🎾 ${court}`,'#92400e','#fff7ed','#fdba74','start_soon',1,0,{court,winSide:0});
        }
        const waiting=(item?.waiting||[]).map(x=>String(x?.id||''));
        const idx=waiting.indexOf(targetId);
        if(idx>=0){
          const isSoon=idx===0;
          return makeStatus(`코트 대기 ${idx+1}번 · 🎾 ${court}`,isSoon?'#92400e':'#9a3412','#fff7ed','#fdba74',isSoon?'start_soon':'court_wait',isSoon?2:(10+idx),idx+1,{court,winSide:0});
        }
      }
      const shared=(typeof getVisibleSharedWaitingOrderForAssign==='function'
        ? (getVisibleSharedWaitingOrderForAssign(key)||[])
        : (typeof getIndividualAutoSharedWaitingItems==='function' ? (getIndividualAutoSharedWaitingItems(key)||[]) : []));
      const sIdx=shared.findIndex(x=>String(x?.id||'')===targetId);
      if(sIdx>=0){
        const entry=shared[sIdx]||{};
        const targetCourt=String(entry.__sharedCourtLabel||entry.manualCourtTarget||'').trim();
        return makeStatus(`공용 대기 ${sIdx+1}번${targetCourt?` · 🎾 ${targetCourt}`:''}`,'#1d4ed8','#eff6ff','#93c5fd','shared_wait',40+sIdx,sIdx+1,{court:targetCourt,winSide:0});
      }
      const pinnedCourt=String(m?.manualCourtTarget||'').trim();
      if(pinnedCourt){
        return makeStatus(`코트 배정 완료 · 🎾 ${pinnedCourt}`,'#7c3aed','#f5f3ff','#c4b5fd','assigned',20,98,{court:pinnedCourt,winSide:0});
      }
    }catch(e){}
  }
  return makeStatus(`경기 대기${courtTxt}`,'#1d4ed8','#eff6ff','#93c5fd','waiting',30,99,{winSide:0});
}
function getPersonalMatchStartSoonChip(status){
  if(!status) return '';
  if(status.code==='live'){
    return `<span class="my-match-summary-chip" style="border:1.5px solid #f59e0b;background:#fff7ed;color:#92400e">🎾 경기중</span>`;
  }
  if(status.code==='start_soon'){
    return `<span class="my-match-summary-chip" style="border:1.5px solid #ef4444;background:#fef2f2;color:#b91c1c">⏰ 곧 시작</span>`;
  }
  if(status.code==='court_wait'){
    return `<span class="my-match-summary-chip" style="border:1.5px solid #f59e0b;background:#fff7ed;color:#9a3412">⏳ 코트 대기</span>`;
  }
  if(status.code==='shared_wait'){
    return `<span class="my-match-summary-chip" style="border:1.5px solid #60a5fa;background:#eff6ff;color:#1d4ed8">📋 공용 대기</span>`;
  }
  return '';
}
function renderPersonalStatusChipRow(status){
  if(!status) return '';
  return `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px">
    <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:${status.bg};border:1px solid ${status.border};font-size:.8rem;font-weight:900;color:${status.tone}">${status.text}</span>
    ${getPersonalMatchStartSoonChip(status)}
  </div>`;
}
function getPersonalNextMatchRow(rows=[]){
  const pending=(rows||[]).filter(row=>row && row.status && row.status.code!=='done');
  if(!pending.length) return null;
  const hasPendingGroup = pending.some(row=>String(row?.match?.phase||'')==='group');
  const target = hasPendingGroup
    ? pending.filter(row=>String(row?.match?.phase||'')==='group')
    : pending;
  return target.sort((a,b)=>{
    const pa=Number(a?.status?.priority||999), pb=Number(b?.status?.priority||999);
    if(pa!==pb) return pa-pb;
    if(String(a?.div||'')!==String(b?.div||'')) return String(a?.div||'').localeCompare(String(b?.div||''),'ko');
    const ma=a?.match||{}, mb=b?.match||{};
    const phaseOrder=(m)=>{
      const p=String(m?.phase||'');
      return p==='group'?0:(p==='playin'?1:(p==='main'?2:3));
    };
    if(phaseOrder(ma)!==phaseOrder(mb)) return phaseOrder(ma)-phaseOrder(mb);
    if(Number(ma.group??-1)!==Number(mb.group??-1)) return Number(ma.group??-1)-Number(mb.group??-1);
    if(Number(ma.round||0)!==Number(mb.round||0)) return Number(ma.round||0)-Number(mb.round||0);
    if(Number(ma.slot||0)!==Number(mb.slot||0)) return Number(ma.slot||0)-Number(mb.slot||0);
    return String(ma.id||'').localeCompare(String(mb.id||''),'ko');
  })[0]||null;
}
function renderPersonalNextMatchCard(row){
  if(!row) return '';
  const m=row.match, key=row.key, status=row.status||getPersonalMatchStatusLabel(key,m);
  const info=describeCourtBoardMatch(key,m);
  const n1=tdn(row.team1,key,m.t1)||'?';
  const n2=tdn(row.team2,key,m.t2)||'?';
  const soonChip=getPersonalMatchStartSoonChip(status);
  const detail=[dl(row.div), info?.label, info?.detail].filter(Boolean).join(' · ');
  return `<div style="padding:12px 14px;margin-bottom:10px;border:2px solid ${status.code==='start_soon'?'#ef4444':(status.code==='live'?'#f59e0b':'#2563eb')};border-radius:14px;background:linear-gradient(135deg,#ffffff,#f8fbff)">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div style="min-width:220px;flex:1">
        <div style="font-size:.76rem;font-weight:900;color:#1d4ed8;letter-spacing:.02em">📌 내 다음 경기</div>
        <div style="font-size:1rem;font-weight:900;color:var(--primary-dark);line-height:1.4;margin-top:4px">${n1} <span style="color:var(--text3);font-weight:700">vs</span> ${n2}</div>
        <div style="font-size:.78rem;color:var(--text2);margin-top:4px;line-height:1.55">${detail}</div>
        ${renderPersonalStatusChipRow(status)}
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
        <button class="my-match-toggle-btn" onclick="event.stopPropagation();goBracketMatch('${row.tid}','${row.div}','${m.id}');" style="border:1px solid #2563eb;border-radius:999px;background:white;color:#1d4ed8;cursor:pointer">해당 경기로</button>
      </div>
    </div>
  </div>`;
}
function renderPersonalMatchBanner(tid, targetDivs=[]){
  const t=(G.tournaments||[]).find(x=>x.id===tid);
  if(!t || getTournamentTypeById(tid)!=='individual_pair') return '';
  const digits=getPersonalMatchPhone();
  const saved=formatPhoneLoose(digits);
  const rows=digits?getPersonalizedIndividualMatches(tid,targetDivs,digits):[];
  const headerBtns=`<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="my-match-toggle-btn" onclick="event.stopPropagation();promptPersonalMatchPhone()" style="border:1px solid #2563eb;border-radius:999px;background:white;color:#1d4ed8;cursor:pointer">${saved?'📱 번호 변경':'📱 전화번호 입력'}</button>${saved?'<button class="my-match-toggle-btn" onclick="event.stopPropagation();clearPersonalMatchPhone()" style="border:1px solid #64748b;border-radius:999px;background:white;color:#475569;cursor:pointer">초기화</button>':''}</div>`;
  if(!saved){
    return `<div style="padding:10px 12px;background:linear-gradient(135deg,#eef4ff,#fffdf5);border:1.5px solid #93c5fd;border-radius:10px;margin-bottom:10px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><div class="my-match-panel-title">📱 개인전 내 경기 찾기</div><div style="font-size:.82rem;color:#1e3a8a;margin-top:4px;line-height:1.6">참가 등록 때 입력한 전화번호를 저장하면 이 기기에서 <b>내 경기만 바로 모아보기</b>가 됩니다.</div></div>${headerBtns}</div></div>`;
  }
  const rowsWithStatus=rows.map(row=>({
    ...row,
    status:getPersonalMatchStatusLabel(row.key,row.match)
  }));
  const nextRow=getPersonalNextMatchRow(rowsWithStatus);
  const nextCard=renderPersonalNextMatchCard(nextRow);
  const cards=rowsWithStatus.length?rowsWithStatus.map(row=>{
    const key=row.key, m=row.match, t1=row.team1, t2=row.team2;
    const n1=tdn(t1,key,m.t1)||'?';
    const n2=tdn(t2,key,m.t2)||'?';
    const info=describeCourtBoardMatch(key,m);
    const status=row.status||getPersonalMatchStatusLabel(key,m);
    const amIWinner=!!(status.winSide && row.mySide===status.winSide);
    const isNext=nextRow && String(nextRow.match?.id||'')===String(m.id||'') && String(nextRow.div||'')===String(row.div||'');
    const orderSummary=(function(){
      // 개인전은 오더 제출 기능이 없으므로 오더 관련 칩을 표시하지 않는다.
      return renderPersonalStatusChipRow(status);
    })();
    const title=`${n1} <span style="color:var(--text3);font-weight:700">vs</span> ${n2}`;
    const sub=[dl(row.div), info?.label, info?.detail].filter(Boolean).join(' · ');
    return `<div style="background:white;border:1.5px solid ${isNext?(status.code==='start_soon'?'#ef4444':'#2563eb'):(amIWinner?'#16a34a':'#2563eb')};border-radius:10px;padding:8px 12px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;cursor:pointer;box-shadow:${isNext?'0 0 0 3px rgba(37,99,235,.12)':'none'}" onclick="goBracketMatch('${tid}','${row.div}','${m.id}')"><div style="flex:1;min-width:220px"><div class="my-match-card-title">${isNext?'<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:.72rem;font-weight:900;margin-right:6px">다음 경기</span>':''}${title}</div><div style="font-size:.78rem;color:var(--text2);margin-top:3px">${sub}</div><div style="font-size:.78rem;color:${status.tone};font-weight:800;margin-top:5px;display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;background:${status.bg};border:1px solid ${status.border}">${amIWinner?'🏆 내 승리 · ':''}${status.text}</div>${orderSummary}</div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end"><button class="my-match-toggle-btn" onclick="event.stopPropagation();goBracketMatch('${tid}','${row.div}','${m.id}');" style="border:1px solid #2563eb;border-radius:999px;background:white;color:#1d4ed8;cursor:pointer">해당 경기로</button></div></div>`;
  }).join(''):`<div style="font-size:.88rem;color:#1e3a8a;font-weight:700">저장된 번호와 일치하는 현재 대회 경기가 없습니다</div>`;
  return `<div style="padding:10px 12px;background:linear-gradient(135deg,#eef4ff,#fffdf5);border:1.5px solid #93c5fd;border-radius:10px;margin-bottom:10px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:${cards?8:0}px"><div><div class="my-match-panel-title">📱 개인전 내 경기 모아보기</div><div style="font-size:.8rem;color:#1e3a8a;margin-top:4px;line-height:1.6">저장 번호: <b>${saved}</b> · 현재 대회 ${rows.length}경기</div></div>${headerBtns}</div>${nextCard}${cards}</div>`;
}
window.promptPersonalMatchPhone = promptPersonalMatchPhone;
window.clearPersonalMatchPhone = clearPersonalMatchPhone;
function getIndividualDisplayLine(team){
  const parts=getIndividualPlayers(team).slice(0,2).map(p=>{
    const name=(p?.name||'').trim()||'-';
    const club=(p?.clubsRaw||'').trim();
    return `${name}${club?`(${club})`:''}`.trim();
  }).filter(Boolean);
  const note=String(team?.note||'').trim();
  return `${parts.join(' / ')}${note?` · ${note}`:''}`.trim();
}
function ensureIndividualSimpleFields(){
  const anchor=ge('regPlayerSlots');
  if(!anchor) return;
  let box=ge('individualSimpleFields');
  if(!box){
    box=document.createElement('div');
    box.id='individualSimpleFields';
    box.style.marginTop='10px';
    anchor.insertAdjacentElement('afterend', box);
  }
  box.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr;gap:10px">
      <div style="padding:10px 12px;background:var(--panel2);border:1px solid var(--border);border-radius:12px">
        <div style="font-size:.82rem;font-weight:800;color:var(--primary-dark);margin-bottom:8px">1번 참가자</div>
        <div class="frow">
          <div class="form-group" style="margin-bottom:8px"><label class="form-label">이름<span class="req">*</span></label><input class="form-input" id="ip1name" placeholder="예: 이상영"></div>
          <div class="form-group" style="margin-bottom:8px"><label class="form-label">클럽명<span class="req">*</span></label><input class="form-input" id="p1club" placeholder="예: 모던,나이스"></div>
        </div>
        <div class="frow">
          <div class="form-group" style="margin-bottom:8px"><label class="form-label">전화번호<span class="req">*</span></label><input class="form-input" id="p1phone" inputmode="tel" placeholder="예: 010-1234-5678"></div>
          <div class="form-group" style="margin-bottom:8px"><label class="form-label">구력</label><input class="form-input" id="p1career" placeholder="예: 24.07"></div>
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;padding:8px 10px;background:#fff;border:1px solid var(--border);border-radius:10px">
          <label style="display:flex;align-items:center;gap:6px;font-size:.78rem;font-weight:800;color:var(--primary-dark);cursor:pointer"><input type="checkbox" id="p1receiveOrderSms" checked> 경기 배정/대기 문자 받기</label>
          <label style="display:flex;align-items:center;gap:6px;font-size:.78rem;font-weight:800;color:var(--primary-dark);cursor:pointer"><input type="checkbox" id="p1receiveResultSms" checked> 경기 완료 문자 받기</label>
        </div>
      </div>
      <div style="padding:10px 12px;background:var(--panel2);border:1px solid var(--border);border-radius:12px">
        <div style="font-size:.82rem;font-weight:800;color:var(--primary-dark);margin-bottom:8px">2번 참가자</div>
        <div class="frow">
          <div class="form-group" style="margin-bottom:8px"><label class="form-label">이름<span class="req">*</span></label><input class="form-input" id="ip2name" placeholder="예: 강대영"></div>
          <div class="form-group" style="margin-bottom:8px"><label class="form-label">클럽명<span class="req">*</span></label><input class="form-input" id="p2club" placeholder="예: 모던"></div>
        </div>
        <div class="frow">
          <div class="form-group" style="margin-bottom:8px"><label class="form-label">전화번호<span class="req">*</span></label><input class="form-input" id="p2phone" inputmode="tel" placeholder="예: 010-9876-4321"></div>
          <div class="form-group" style="margin-bottom:8px"><label class="form-label">구력</label><input class="form-input" id="p2career" placeholder="예: 23.06"></div>
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;padding:8px 10px;background:#fff;border:1px solid var(--border);border-radius:10px">
          <label style="display:flex;align-items:center;gap:6px;font-size:.78rem;font-weight:800;color:var(--primary-dark);cursor:pointer"><input type="checkbox" id="p2receiveOrderSms" checked> 경기 배정/대기 문자 받기</label>
          <label style="display:flex;align-items:center;gap:6px;font-size:.78rem;font-weight:800;color:var(--primary-dark);cursor:pointer"><input type="checkbox" id="p2receiveResultSms" checked> 경기 완료 문자 받기</label>
        </div>
      </div>
      <div style="padding:10px 12px;background:linear-gradient(135deg,#eef4ff,#fff8df);border:1px solid #dbe7ff;border-radius:12px;font-size:.76rem;line-height:1.7;color:var(--text2)">
        <b style="color:var(--primary-dark)">📢 개인전 접수 안내</b><br>
        • 참가자 2명의 <b>휴대폰 번호는 모두 필수</b>입니다.<br>
        • 체크한 참가자만 <b>코트 배정 / 대기 / 경기 시작 / 경기 완료</b> 문자를 받습니다.<br>
        • 한 명만 체크하면 대표 1명만, 두 명 모두 체크하면 둘 다 문자 받습니다.<br>
        • 문자 기능은 운영자의 즉시 호출 및 자동 알림에 사용됩니다.
      </div>
      <div class="frow">
        <div class="form-group" style="margin-bottom:0"><label class="form-label">비고</label><input class="form-input" id="pNote" placeholder="예: 혼복 / 전국신인 / 파트너변경 가능"></div>
        <div class="form-group" style="margin-bottom:0"><label class="form-label">수정/삭제 비밀번호 <span class="req">*</span></label><input class="form-input" id="pEditPin" inputmode="numeric" maxlength="4" placeholder="숫자 4자리"></div>
      </div>
    </div>`;
}
function toggleIndividualSimpleFields(isIndividual){
  let box=ge('individualSimpleFields');
  if(isIndividual){
    ensureIndividualSimpleFields();
    box=ge('individualSimpleFields');
    if(box) box.style.display='block';
    const slots=ge('regPlayerSlots');
    if(slots) slots.style.display='none';
  }else{
    if(box) box.style.display='none';
    const slots=ge('regPlayerSlots');
    if(slots) slots.style.display='block';
  }
}

function updateTournamentTypeUI(){
  const type=getSelectedTournamentType();
  const isInd=type==='individual_pair';
  const fmt=ge('tFormat');
  const gs=ge('tGrpSize');
  const adv=ge('tAdvance');
  const note=ge('tTypeNote');
  if(note){
    note.innerHTML=isInd
      ? '개인전 모드: <b>2인 페어 참가</b>, 후보 없음, 사전등록 없이 누구나 접수, 클럽명 직접 입력'
      : '단체전 모드: 클럽/팀 단위, 후보 가능, 공개등록/로그인등록 모두 지원';
  }
  // 개인전도 group_knockout 방식 허용 (예선조별+본선)
  if(gs) gs.disabled=false;
  if(adv) adv.disabled=false;
}
window.updateTournamentTypeUI = updateTournamentTypeUI;

function getAppTitle(){
  return String(G?.meta?.appTitle||'시합관리 시스템').trim() || '시합관리 시스템';
}
function usesFixedClubList(){ return !!G?.meta?.useFixedClubs; }
function isPublicTeamRegistrationEnabled(){ return !!G?.meta?.allowPublicTeamRegistration; }
function isPublicResultEntryEnabled(){ return !!G?.meta?.allowPublicResultEntry; }
function shouldUsePlayerRegistry(t){ return !!G?.meta?.usePlayerRegistry && needsMemberRegistry2026(t); }
function refreshAppBranding(){
  try{
    document.title=getAppTitle();
    const logoText=document.querySelector('.logo-text h1');
    if(logoText) logoText.textContent=getAppTitle();
    const assocTitle=document.querySelector('#homeAssocCard .card-title');
    if(assocTitle) assocTitle.textContent = (G.meta.showAssociationDashboard ? '📊 협회/단체 현황' : '📊 전체 현황');
  }catch(e){}
}

// ── 대회 편집용 부서 목록 관리 ─────────────────────────────────
function _renderEtDivList(){
  const list=ge('etDivList');
  if(!list)return;
  const divs=window._etDivList||[];
  if(!divs.length){
    list.innerHTML='<div style="font-size:.75rem;color:var(--text3);padding:6px 0">부서를 추가해 주세요</div>';
    return;
  }
  list.innerHTML=divs.map((d,i)=>`
    <div style="padding:9px 10px;background:var(--panel2);border:1px solid var(--border);border-radius:10px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-weight:700;font-size:.85rem;flex:1">${d.name}${d.locked?'<small style="color:var(--text3);font-weight:400;margin-left:4px">(팀 있음)</small>':''}</span>
        <select class="form-select" style="width:80px;font-size:.78rem;padding:3px 6px" onchange="window._etDivList[${i}].rub=parseInt(this.value)">
          <option value="5" ${d.rub===5?'selected':''}>5복식</option>
          <option value="4" ${d.rub===4?'selected':''}>4복식</option>
          <option value="3" ${d.rub===3?'selected':''}>3복식</option>
          <option value="2" ${d.rub===2?'selected':''}>2복식</option>
          <option value="1" ${d.rub===1?'selected':''}>1복식</option>
        </select>
        ${d.locked?`<span style="font-size:.7rem;color:var(--text3)">삭제불가</span>`:`<button class="btn btn-danger" style="padding:3px 8px;font-size:.72rem" onclick="_etRemoveDiv(${i})">✕</button>`}
      </div>
      ${renderDivisionCourtInlineSelector(d.courts||[],'edit',i)}
    </div>`).join('');
}
function _etRemoveDiv(i){
  if((window._etDivList||[])[i]?.locked){toast('팀이 등록된 부서는 삭제할 수 없습니다','info');return;}
  (window._etDivList||[]).splice(i,1);
  _renderEtDivList();
}
function etAddPreset(name,rub){
  if(!window._etDivList)window._etDivList=[];
  if(window._etDivList.find(d=>d.name===name)){toast(`"${name}" 이미 추가됨`,'info');return;}
  window._etDivList.push({name,rub,maxTeams:0,courts:[],locked:false});
  _renderEtDivList();
}
function etAddCustomDiv(){
  const name=(ge('etNewDivName')?.value||'').trim();
  const rub=parseInt(ge('etNewDivRub')?.value||'5');
  if(!name){toast('부서명을 입력해 주세요','error');return;}
  if(!window._etDivList)window._etDivList=[];
  if(window._etDivList.find(d=>d.name===name)){toast(`"${name}" 이미 추가됨`,'info');return;}
  window._etDivList.push({name,rub,maxTeams:0,courts:[],locked:false});
  if(ge('etNewDivName'))ge('etNewDivName').value='';
  _renderEtDivList();
}

// 조 알파벳 레이블: 0→A조, 1→B조 ...
function grpLabel(gi){ return `${Number(gi)+1}조`; }

import{normalizePhoneDigits,pKey,baseClub,pKeyParse,normName,cleanName,splitKeyNameClub,normalizeClub,formatRecentLabel}from'./players.js';
import{loadRegistryDocument,saveRegistryDocument,normalizeRegistryRows,parseOfficialRegistryExcelRows}from'./player-registry.js';
import{buildPlayerRecordCard,buildRegistryManagerTable,buildRegistryEmptyState,buildRegistryRegionSections}from'./player-registry-ui.js';
import{getDirectorSessionVersion,isClubPasswordCustomValue,getClubTemporaryPassword,getClubLoginPassword,getClubLoginHint,shouldPromptClubPasswordChange,isDirectorSessionVersionValid,getClubContact,hasClubContact,derivePasswordFromPhone,setClubPassword,resetClubPasswordToTemporary,saveClubContact,saveClubDirectorContact,registerFirstLoginContact,getClubDefaultRegion,setClubDefaultRegion,applyClubDefaultRegion,applyClubDefaultRegions,normalizeRegionLabel,inferClubRegionFromMembers,buildClubRegionOptions}from'./clubs.js';
import{validateRegistrationCapacity,validateIndividualRegistration,validateTeamRegistration,buildTeamRegistrationPayload,buildIndividualRegistrationPayload,buildTeamEditPayload,buildIndividualEditPayload,validateTeamEdit,canDeleteRegistration}from'./registrations.js';
import{buildRegistrationRosterGrid,getRegistrationFormState,getWomenPairNoticeHtml}from'./registration-ui.js';
import{normalizeCourtGroups,expandCourtGroups,buildCourtList,uniqueCourtList,getCourtGroupCount,resolveAllowedCourts,buildCourtShareMap,getCourtShareLevel,getCourtShareSummary}from'./courts.js';
import{getCourtBoardDisplayLimitsForMatch,splitCourtWaitingByDisplayLimit,getCourtBoardStatusCounts,sortCourtWaitingByPriority,getCourtQueueDisplayState,getCourtBoardItemState}from'./court-status.js';
import{normalizeCourtTarget,validateCourtMoveTarget,buildManualCourtMoveMeta,buildTeamCourtMovePatch,applyCourtMovePatch,buildCourtMoveOptions}from'./court-ops.js';
import{cloneMatchForRollback,commitCourtMove}from'./court-service.js';
import{analyzeRubberScore,getRubberScoreErrorMessage,getTeamMatchOutcome,resolveWinnerTeamIndex,buildResultSaveLabel}from'./match-results.js';
import{cloneResultMatchForRollback,createPlayerStatSnapshot,runResultPersistencePlan,commitMatchResultSave}from'./match-result-service.js';
import{buildResultModalTitle,getResultFooterButtonState,buildScoreButtonsHtml,buildResultTeamsHeaderHtml,buildRubberResultCardHtml,buildResultSectionHtml,buildResultMemoHtml,buildMatchMemoFieldHtml,buildTeamResultIntroHtml,buildOrderSubmitStatusHtml,buildPhotoAssistHtml,buildIndividualResultBodyHtml,buildOrderSideBoxHtml,buildTeamRubberCardHtml,buildQuickActionPanelHtml}from'./match-result-ui.js';
import{getBlankRubberNumbers,getBlankRubberLabel,validateOrderRubbers,normalizeOrderPayloadsForSave,applyOrderSubmissions,clearOnlineOrderSubmissionState,resetMatchOrderResultState,buildSubmitSuccessMessage,buildUnlockSuccessMessage}from'./order-ops.js';
import{cloneOrderState,commitOrderSubmission,commitOrderReset,createOrderResetPlayerSnapshot,snapshotBooleanMapEntry}from'./order-service.js';
import{GHOST_ORDER,normalizePair,findNextTapCursor,getTapUsedPlayers,toggleTapPlayer,setTapGhost,backspaceTapSlot,resetTapSlots,buildReorderSlots,toggleReorderPick,applyReorderPlan,getGhostScorePlan}from'./order-picker-ops.js';
import{buildTapOrderSummaryHtml,buildTapOrderCurrentText,buildTapOrderPlayerListHtml,buildReorderOverlayHtml,buildReorderCardsHtml,buildReorderPreviewHtml}from'./order-picker-ui.js';
import{buildCourtStatusSummaryHtml,buildCourtWaitingBadgeHtml,buildCourtCardShellHtml,buildCourtBoardHiddenHtml,buildCourtBoardFrameHtml,buildCourtCurrentSectionHtml,buildCourtWaitingSectionHtml,buildCourtDropZoneHtml,buildNoCourtAssignedHtml,buildSharedWaitingCardHtml,buildSharedWaitingSectionHtml,buildCourtWaitingItemHtml,buildCourtMovePickerHtml}from'./court-status-ui.js';
import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import{getFirestore,collection,doc,getDoc,getDocs,setDoc,addDoc,updateDoc,deleteDoc,onSnapshot,query,orderBy,limit,serverTimestamp,writeBatch,where,documentId}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import{getStorage,ref,uploadBytes,getDownloadURL,deleteObject,listAll}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
const FB={apiKey:"AIzaSyB7gqyDoFhujrBB_h4StvHkn_Y0VoUCPgE",authDomain:"kimheatennis2026.firebaseapp.com",projectId:"kimheatennis2026",storageBucket:"kimheatennis2026.firebasestorage.app",messagingSenderId:"243465970482",appId:"1:243465970482:web:ceafbd39de51837d49ed2b"};
const _app=initializeApp(FB);
const db=getFirestore(_app);
const storage=getStorage(_app);
const FIRESTORE_WRITE_TRACE = /[?&]debugWrites=1(?:&|$)/.test(location.search);
if(FIRESTORE_WRITE_TRACE){
  const wrapTrace=(name, fn)=>async (...args)=>{
    try{ console.log('🔥', name, args[0]?.path||args[0]); console.trace(); }catch(e){}
    return fn(...args);
  };
  try{
    window.__OAI_setDoc = setDoc;
    window.__OAI_updateDoc = updateDoc;
    window.__OAI_addDoc = addDoc;
  }catch(e){}
}

let AD=false;
let OP=false; // 경기진행자 로그인 상태
let REG=false; // 팀등록 로그인 상태
let REG_CLUB='';   // 로그인한 경기이사 클럽명
// window에 노출 - HTML onclick에서 접근 가능하게
Object.defineProperty(window,'REG_CLUB',{get:()=>REG_CLUB,set:(v)=>{REG_CLUB=v;}});
// ── 과거 대회 내장 데이터 ─────────────────────────────────
let HIST_DATA = []; // 과거 대회 데이터는 엑셀/Firestore로 관리

let G={meta:{pw:'kimhae1234',regPw:'202601',memberRegistry2026:[],clubContacts:{},clubEmails:{},clubPasswords:{},clubPasswordCustom:{},clubDefaultRegions:{},regDeadlineDt:'',onlineOrderEnabled:false,operatorPw:'2026court',individualAutoCourtAssignEnabled:false,regSessionVersion:1,drawHistoryPolicyVersion:0,usePlayerRegistry:false,showAssociationDashboard:false,useFixedClubs:false,allowPublicTeamRegistration:false,allowPublicResultEntry:false,appTitle:'시합관리 시스템'},clubs:[],tournaments:[],teams:{},draws:{},matches:{},players:{},log:[],drawHistories:{}};
const PLAYER_CACHE_KEY='OAI_PLAYER_CACHE_V1';
const PLAYER_CACHE_TTL=1000*60*60*12;
const TOURNAMENT_BUNDLE_CACHE_KEY='OAI_TOURNAMENT_BUNDLE_CACHE_V3';
const TOURNAMENT_BUNDLE_CACHE_TTL=1000*60*10;
const TOURNAMENT_BUNDLE_MEM={};
let DRAW_HISTORY_LOADED=false;
let CURRENT_LIVE_TID=null;
let _realtimeRegsUnsub=null,_realtimeMatchesUnsub=null,_realtimeDrawsUnsub=null;
let _tournamentsUnsub=null;
let _firebaseInitPromise=null;
let _firebaseInitDone=false;
const _snapshotErrStamp=new Map();
function logSnapshotError(scope, err){
  const now=Date.now();
  const key=String(scope||'snapshot');
  const prev=Number(_snapshotErrStamp.get(key)||0);
  if(now-prev<15000) return;
  _snapshotErrStamp.set(key,now);
  const code=String(err?.code||'');
  const msg=String(err?.message||err||'');
  if(code==='unavailable' || /network|transport|webchannel|offline/i.test(msg)){
    console.warn(`[Firestore] ${key} 연결 일시 중단 — SDK 자동 재연결 대기`, code||msg);
  }else{
    console.error(`[Firestore] ${key} listener error`, err);
  }
}
function stopTournamentListSync(){
  if(_tournamentsUnsub){ try{_tournamentsUnsub();}catch(e){} _tournamentsUnsub=null; }
}
let _viewerBracketPoller=null;
let _viewerBracketPollTid='';
const VIEWER_BRACKET_POLL_MS=20000;
let _bundleFetchSeq=0;
let PLAYERS_LOADED=false;
let PLAYERS_LOADING_PROMISE=null;
function _playerDocId(k){ return String(k||'').replace(/[\/\.#\$\[\]]/g,'_'); }
function loadPlayersFromLocalCache(){
  try{
    const raw=localStorage.getItem(PLAYER_CACHE_KEY);
    if(!raw) return false;
    const parsed=JSON.parse(raw);
    const ts=Number(parsed?.ts||0);
    const data=parsed?.data||{};
    if(!ts || !data || typeof data!=='object') return false;
    if(Date.now()-ts>PLAYER_CACHE_TTL) return false;
    G.players=data;
    return Object.keys(G.players||{}).length>0;
  }catch(e){ return false; }
}
function savePlayersToLocalCache(){
  try{
    localStorage.setItem(PLAYER_CACHE_KEY, JSON.stringify({ts:Date.now(), data:G.players||{}}));
  }catch(e){}
}
async function ensurePlayersLoaded(force=false){
  if(force){ PLAYERS_LOADED=false; PLAYERS_LOADING_PROMISE=null; }
  if(PLAYERS_LOADED && !force) return G.players||{};
  if(PLAYERS_LOADING_PROMISE && !force) return PLAYERS_LOADING_PROMISE;
  PLAYERS_LOADING_PROMISE=(async()=>{
    const playersSnap=await getDocs(collection(db,'players'));
    const next={};
    playersSnap.forEach(d=>{
      const x=d.data();
      if(!x?.name) return;
      const k=x.key||(x.club?x.name+'__'+x.club:x.name);
      next[k]=x;
    });
    G.players=next;
    PLAYERS_LOADED=true;
    savePlayersToLocalCache();
    return G.players;
  })().catch(err=>{
    console.warn('ensurePlayersLoaded failed', err);
    throw err;
  }).finally(()=>{ PLAYERS_LOADING_PROMISE=null; });
  return PLAYERS_LOADING_PROMISE;
}

function getCurrentPageName(){
  return document.querySelector('.nav-tab.active')?.dataset?.page || 'home';
}
function getSelectedTournamentIdForPage(page){
  const pg=page||getCurrentPageName();
  if(pg==='bracket') return ge('brTS')?.value||'';
  if(pg==='register') return ge('regTS')?.value||'';
  if(pg==='ranking') return ge('rankTS')?.value||'';
  if(pg==='tournament') return '';
  return '';
}
function shouldUseRealtimeForTournament(page, tid){
  const pg=page||getCurrentPageName();
  const targetTid=String(tid||'').trim();
  if(!targetTid) return false;
  if(pg!=='bracket') return false;
  if(AD || OP || REG) return true;
  return false;
}
function isViewerReadOnlyMode(){
  return !(AD || OP || REG);
}
function stopViewerBracketPolling(){
  if(_viewerBracketPoller){ try{ clearInterval(_viewerBracketPoller); }catch(e){} }
  _viewerBracketPoller=null;
  _viewerBracketPollTid='';
}
async function runViewerBracketPoll(force=false){
  if(!isViewerReadOnlyMode()) return stopViewerBracketPolling();
  if(getCurrentPageName()!=='bracket') return stopViewerBracketPolling();
  const tid=String(getSelectedTournamentIdForPage('bracket') || getRealtimeTargetTournamentId() || '').trim();
  if(!tid) return stopViewerBracketPolling();
  _viewerBracketPollTid=tid;
  try{
    await fetchTournamentBundle(tid, {force: !!force, acceptStale:true});
    if(getCurrentPageName()==='bracket' && String(ge('brTS')?.value||'')===tid){
      try{ renderBracket(); }catch(e){}
      try{ initBracketNotice(); }catch(e){}
    }
  }catch(e){
    console.warn('viewer bracket poll failed', e);
  }
}
function ensureViewerBracketPolling(page, tid){
  const pg=page||getCurrentPageName();
  const targetTid=String(tid || getSelectedTournamentIdForPage(pg) || getRealtimeTargetTournamentId() || '').trim();
  if(!isViewerReadOnlyMode() || pg!=='bracket' || !targetTid){
    stopViewerBracketPolling();
    return;
  }
  const needsRestart = (!_viewerBracketPoller) || (_viewerBracketPollTid!==targetTid);
  if(needsRestart){
    stopViewerBracketPolling();
    _viewerBracketPollTid=targetTid;
    _viewerBracketPoller=setInterval(()=>{ runViewerBracketPoll(true); }, VIEWER_BRACKET_POLL_MS);
  }
}
window.runViewerBracketPoll = runViewerBracketPoll;
function readTournamentBundleCache(){
  try{
    const raw=localStorage.getItem(TOURNAMENT_BUNDLE_CACHE_KEY);
    const parsed=raw?JSON.parse(raw):{};
    return parsed && typeof parsed==='object' ? parsed : {};
  }catch(e){ return {}; }
}
function writeTournamentBundleCache(all){
  try{ localStorage.setItem(TOURNAMENT_BUNDLE_CACHE_KEY, JSON.stringify(all||{})); }catch(e){}
}
function saveTournamentBundleCache(tid, payload){
  if(!tid) return;
  TOURNAMENT_BUNDLE_MEM[tid]={ts:Date.now(), payload:payload||{}};
  const all=readTournamentBundleCache();
  all[tid]={ts:Date.now(), payload:payload||{}};
  const keys=Object.keys(all).sort((a,b)=>String(all[b]?.ts||0).localeCompare(String(all[a]?.ts||0)));
  keys.slice(8).forEach(k=>{ delete all[k]; });
  writeTournamentBundleCache(all);
}
function getTournamentBundleCache(tid){
  if(!tid) return null;
  const mem=TOURNAMENT_BUNDLE_MEM[tid];
  if(mem && (Date.now()-Number(mem.ts||0) <= TOURNAMENT_BUNDLE_CACHE_TTL)) return mem.payload||null;
  const all=readTournamentBundleCache();
  const cached=all[tid];
  if(!cached) return null;
  if(Date.now()-Number(cached.ts||0) > TOURNAMENT_BUNDLE_CACHE_TTL) return null;
  TOURNAMENT_BUNDLE_MEM[tid]=cached;
  return cached.payload||null;
}
function applyTournamentBundle(tid, bundle){
  if(!tid) return;
  bundle=bundle||{};
  Object.keys(G.teams||{}).forEach(k=>{ if(_k2td(k).tid===tid) delete G.teams[k]; });
  Object.keys(G.matches||{}).forEach(k=>{ if(_k2td(k).tid===tid) delete G.matches[k]; });
  Object.keys(G.draws||{}).forEach(k=>{ if(_k2td(k).tid===tid) delete G.draws[k]; });
  if(!G._regIdsByKey) G._regIdsByKey={};
  if(!G._matchIdsByKey) G._matchIdsByKey={};
  Object.keys(G._regIdsByKey).forEach(k=>{ if(_k2td(k).tid===tid) delete G._regIdsByKey[k]; });
  Object.keys(G._matchIdsByKey).forEach(k=>{ if(_k2td(k).tid===tid) delete G._matchIdsByKey[k]; });

  const regs=Array.isArray(bundle.regs)?bundle.regs:[];
  regs.forEach(x=>{
    const div=x.division; if(!div) return;
    const key=tid+'_'+div;
    if(!G.teams[key]) G.teams[key]=[];
    G.teams[key].push({_id:x._id||x.id||'', ...x, players:x.players||[]});
    if(!G._regIdsByKey[key]) G._regIdsByKey[key]=[];
    if(x._id||x.id) G._regIdsByKey[key].push(x._id||x.id);
  });
  Object.keys(G.teams).filter(k=>_k2td(k).tid===tid).forEach(k=>{
    G.teams[k].sort((a,b)=>(a.registeredAt||'').localeCompare(b.registeredAt||''));
    const docs=(G.teams[k]||[]).map(t=>normalizeRegistrationPayloadForHash({tournamentId:tid,division:_k2td(k).div,club:t.club,players:t.players||[],registeredAt:t.registeredAt||'',...(t.tournamentType?{tournamentType:t.tournamentType}:{}),...(t.editPin?{editPin:t.editPin}:{}),...(Array.isArray(t.individualPlayers)?{individualPlayers:t.individualPlayers}:{}),...(t.clubTokens?{clubTokens:t.clubTokens}:{}),...(t.pairLabel!==undefined?{pairLabel:t.pairLabel}:{}),...(t.entryLabel!==undefined?{entryLabel:t.entryLabel}:{}),...(t.note!==undefined?{note:t.note}:{}),...(t.doublesCount!==undefined?{doublesCount:t.doublesCount}:{}),...(t.mainPlayerCount!==undefined?{mainPlayerCount:t.mainPlayerCount}:{}),...(t.tiebreakAge!==undefined?{tiebreakAge:Number(t.tiebreakAge||0)||0}:{})}));
    markFbWriteCache('teams',k,{docs,ids:(G._regIdsByKey[k]||[]).slice().sort(),deleted:[]});
  });

  const matches=Array.isArray(bundle.matches)?bundle.matches:[];
  matches.forEach(x=>{
    const div=x.division; if(!div) return;
    const key=tid+'_'+div;
    if(!G.matches[key]) G.matches[key]=[];
    G.matches[key].push({_id:x._id||x.id||'', ...x});
    if(!G._matchIdsByKey[key]) G._matchIdsByKey[key]=[];
    if(x._id||x.id) G._matchIdsByKey[key].push(x._id||x.id);
  });
  Object.keys(G.matches).filter(k=>_k2td(k).tid===tid).forEach(k=>{
    G.matches[k].sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
    const docs=(G.matches[k]||[]).map(x=>{ const payload={...x}; delete payload._id; payload.tournamentId=tid; payload.division=_k2td(k).div; return normalizeMatchPayloadForHash(payload); });
    markFbWriteCache('matches',k,{docs,ids:(G._matchIdsByKey[k]||[]).slice().sort(),deleted:[]});
  });

  const draws=Array.isArray(bundle.draws)?bundle.draws:[];
  draws.forEach(x=>{
    const id=x.id||''; if(!id) return;
    const payload={...x}; delete payload.id;
    G.draws[id]=payload;
    markFbWriteCache('draws', id, payload||{});
  });
}
async function fetchTournamentBundle(tid, opts={}){
  const options=opts||{};
  const force=!!options.force;
  if(!tid) return null;
  if(!force){
    const cached=getTournamentBundleCache(tid);
    if(cached){
      applyTournamentBundle(tid, cached);
      return cached;
    }
  }
  const seq=++_bundleFetchSeq;
  const regsQ=query(collection(db,'registrations'), where('tournamentId','==',tid));
  const matchesQ=query(collection(db,'matches'), where('tournamentId','==',tid));
  const drawsQ=query(collection(db,'draws'), where(documentId(), '>=', tid + '_'), where(documentId(), '<=', tid + '_\uf8ff'));
  const [regsSnap, matchesSnap, drawsSnap]=await Promise.all([getDocs(regsQ), getDocs(matchesQ), getDocs(drawsQ)]);
  if(seq!==_bundleFetchSeq && !options.acceptStale) return null;
  const payload={
    regs: regsSnap.docs.map(d=>({_id:d.id,...(d.data()||{})})),
    matches: matchesSnap.docs.map(d=>({_id:d.id,...(d.data()||{})})),
    draws: drawsSnap.docs.map(d=>({id:d.id,...(d.data()||{})}))
  };
  saveTournamentBundleCache(tid, payload);
  applyTournamentBundle(tid, payload);
  return payload;
}
function stopRealtimeTournamentSync(){
  if(_realtimeRegsUnsub){ try{_realtimeRegsUnsub();}catch(e){} _realtimeRegsUnsub=null; }
  if(_realtimeMatchesUnsub){ try{_realtimeMatchesUnsub();}catch(e){} _realtimeMatchesUnsub=null; }
  if(_realtimeDrawsUnsub){ try{_realtimeDrawsUnsub();}catch(e){} _realtimeDrawsUnsub=null; }
  CURRENT_LIVE_TID=null;
}
function startRealtimeTournamentSync(tid){
  if(!tid) return stopRealtimeTournamentSync();
  if(CURRENT_LIVE_TID===tid && _realtimeRegsUnsub && _realtimeMatchesUnsub && _realtimeDrawsUnsub) return;
  stopRealtimeTournamentSync();
  CURRENT_LIVE_TID=tid;
  _realtimeRegsUnsub = onSnapshot(query(collection(db,'registrations'), where('tournamentId','==',tid)), s=>{
    const bundle={regs:s.docs.map(d=>({_id:d.id,...(d.data()||{})})), matches:(getTournamentBundleCache(tid)?.matches)||[], draws:(getTournamentBundleCache(tid)?.draws)||[]};
    saveTournamentBundleCache(tid,{...(getTournamentBundleCache(tid)||{}), regs:bundle.regs, matches:bundle.matches, draws:bundle.draws});
    applyTournamentBundle(tid, getTournamentBundleCache(tid)||bundle);
    onDU();
  }, e=>logSnapshotError('registrations',e));
  _realtimeDrawsUnsub = onSnapshot(query(collection(db,'draws'), where(documentId(), '>=', tid + '_'), where(documentId(), '<=', tid + '_\uf8ff')), s=>{
    const bundle=getTournamentBundleCache(tid)||{};
    const next={...(bundle||{}), draws:s.docs.map(d=>({id:d.id,...(d.data()||{})}))};
    saveTournamentBundleCache(tid, next);
    applyTournamentBundle(tid, next);
    onDU();
  }, e=>logSnapshotError('draws',e));
  _realtimeMatchesUnsub = onSnapshot(query(collection(db,'matches'), where('tournamentId','==',tid)), s=>{
    const prevMatchMap=buildMatchAlertStateMap(G.matches||{});
    const prevCourtMap=buildCourtNotificationStateMap(G.matches||{});
    const bundle=getTournamentBundleCache(tid)||{};
    const next={...(bundle||{}), matches:s.docs.map(d=>({_id:d.id,...(d.data()||{})}))};
    saveTournamentBundleCache(tid, next);
    applyTournamentBundle(tid, next);
    try{ processOnlineOrderAlerts(prevMatchMap, G.matches||{}); }catch(err){ console.warn('order alert process failed', err); }
    try{ processCourtSmsAlerts(prevCourtMap, buildCourtNotificationStateMap(G.matches||{})); }catch(err){ console.warn('court sms alert process failed', err); }
    onDU();
  }, e=>logSnapshotError('matches',e));
}
async function syncTournamentDataForPage(page, tid, force=false){
  const targetTid=String(tid || getSelectedTournamentIdForPage(page) || getRealtimeTargetTournamentId() || '').trim();
  if(!targetTid){
    if(!shouldUseRealtimeForTournament(page,'')) stopRealtimeTournamentSync();
    stopViewerBracketPolling();
    return;
  }
  if(shouldUseRealtimeForTournament(page, targetTid)){
    stopViewerBracketPolling();
    const hasCache=!!getTournamentBundleCache(targetTid);
    if(force || !hasCache) await fetchTournamentBundle(targetTid, {force:!!force, acceptStale:true});
    startRealtimeTournamentSync(targetTid);
  }else{
    stopRealtimeTournamentSync();
    await fetchTournamentBundle(targetTid, {force:!!force, acceptStale:true});
    ensureViewerBracketPolling(page, targetTid);
  }
}
async function ensureDrawHistoryLoaded(force=false){
  if(DRAW_HISTORY_LOADED && !force) return G.drawHistories||{};
  try{
    const dhSnap = await getDocs(collection(db,'drawHistory'));
    G.drawHistories = {};
    dhSnap.forEach(d=>{
      const x={id:d.id,...(d.data()||{})};
      const k=x.key || ((x.tournamentId&&x.division)?(x.tournamentId+'_'+x.division):'');
      if(!k) return;
      if(!G.drawHistories[k]) G.drawHistories[k]=[];
      G.drawHistories[k].push(x);
    });
    Object.keys(G.drawHistories).forEach(k=>G.drawHistories[k].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))));
  }catch(e){
    console.warn('drawHistory load failed', e);
    G.drawHistories = G.drawHistories || {};
  }
  DRAW_HISTORY_LOADED=true;
  return G.drawHistories;
}

function getRealtimeTargetTournamentId(){
  try{
    const selected = ge('brTS')?.value || ge('regTS')?.value || ge('rankTS')?.value || '';
    if(selected && (G.tournaments||[]).some(t=>t.id===selected)) return selected;
  }catch(e){}
  return (G.tournaments||[]).find(t=>t.status==='ongoing')?.id
    || (G.tournaments||[]).find(t=>t.status==='open')?.id
    || sortTournamentsLatest(G.tournaments||[])[0]?.id
    || '';
}

window.G = G;

let CE_tid=null,CE_key=null,CE_idx=null,CM_key=null,CM_id=null,CD_key=null;
let PF={club:'',div:'',search:''};

// ── 기본 코트 목록 (기존 김해시 대회 호환용 fallback) ─────────────────
const COURT_GROUPS = DEFAULT_COURT_GROUPS;
const COURT_LIST = DEFAULT_COURT_LIST;

function getDrawAllowedCourts(key){
  try{
    return ((G.draws?.[key]?.allowedCourts)||[]).map(String).filter(Boolean);
  }catch(e){ return []; }
}
function getBracketAllowedCourts(key){
  const {tid,div}=_k2td(key);
  return resolveAllowedCourts({
    divisionCourts:getDivisionConfiguredCourts(tid,div),
    drawCourts:getDrawAllowedCourts(key),
    tournamentCourts:getTournamentCourtList(tid,true)
  });
}
function renderDrawAllowedCourtSelector(key, selectedCourts=[]){
  const selected=(selectedCourts||[]).map(String).filter(Boolean);
  const body=renderCourtAccordionSelector(selected, null, `draw_allowed_${key}`, getBracketAllowedCourts(key));
  return `<div style="margin-top:12px;padding:12px 14px;background:linear-gradient(135deg,#f8fbff,#fffdf5);border:1.5px solid #dbe7ff;border-radius:12px">
    <div style="font-weight:900;font-size:.88rem;color:var(--primary-dark);margin-bottom:6px">🎾 예선 운영 코트 지정</div>
    <div style="font-size:.76rem;color:var(--text2);line-height:1.6;margin-bottom:10px">
      여기서 고른 코트만 이 부서 예선 운영 코트로 사용됩니다. 저장된 뒤에는 <b>조 코트 배정</b>, <b>경기 코트 배정</b>에서도 이 코트들만 선택할 수 있습니다.
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <button type="button" class="btn btn-outline" style="font-size:.76rem;padding:5px 12px;min-height:34px" onclick="toggleAllDrawAllowedCourts(true)">전체 선택</button>
      <button type="button" class="btn btn-outline" style="font-size:.76rem;padding:5px 12px;min-height:34px" onclick="toggleAllDrawAllowedCourts(false)">전체 해제</button>
    </div>
    <div id="drawAllowedCourtsWrap">${body}</div>
    <div id="drawAllowedCourtsSummary" style="font-size:.72rem;color:var(--text3);margin-top:8px;line-height:1.55"></div>
  </div>`;
}
function updateDrawAllowedCourtsSummary(){
  const box=ge('drawAllowedCourtsWrap');
  const summary=ge('drawAllowedCourtsSummary');
  if(!box || !summary) return;
  const selected=[...box.querySelectorAll('input[type="checkbox"]:checked')].map(i=>String(i.value));
  summary.innerHTML = selected.length
    ? `선택 코트 <b>${selected.length}</b>면 · ${selected.join(', ')}`
    : '<span style="color:var(--danger);font-weight:800">선택된 코트가 없습니다. 해제 상태면 전체 코트를 허용합니다.</span>';
}
function bindDrawAllowedCourtInputs(){
  const box=ge('drawAllowedCourtsWrap');
  if(!box) return;
  box.querySelectorAll('input[type="checkbox"]').forEach(inp=>{
    inp.onchange=()=>updateDrawAllowedCourtsSummary();
  });
  updateDrawAllowedCourtsSummary();
}
function toggleAllDrawAllowedCourts(flag){
  const box=ge('drawAllowedCourtsWrap');
  if(!box) return;
  box.querySelectorAll('input[type="checkbox"]').forEach(inp=>{ inp.checked=!!flag; });
  updateDrawAllowedCourtsSummary();
}
function getDrawAllowedCourtsFromModal(){
  const box=ge('drawAllowedCourtsWrap');
  if(!box) return [];
  return [...box.querySelectorAll('input[type="checkbox"]:checked')].map(i=>String(i.value));
}
function getGroupMemo(key, gi){
  try{
    return String(G.draws?.[key]?.groups?.[Number(gi)]?.memo || '').trim();
  }catch(e){ return ''; }
}
function getMatchMemo(key, mid){
  try{
    const m=(G.matches?.[key]||[]).find(x=>String(x.id)===String(mid));
    return String(m?.memo || '').trim();
  }catch(e){ return ''; }
}
function getMatchMemoByObj(m){
  try{ return String(m?.memo || '').trim(); }catch(e){ return ''; }
}
function getCourtShareMap(key){
  try{
    return buildCourtShareMap((G.draws?.[key]?.groups)||[]);
  }catch(e){
    return {};
  }
}
function getGroupCourtShareBadges(key, gi){
  try{
    const grp=(G.draws?.[key]?.groups||[])[Number(gi)];
    const courts=Array.isArray(grp?.courts)?grp.courts:[];
    if(!courts.length) return '';
    const map=getCourtShareMap(key);
    return courts.map(c=>{
      const count=Array.isArray(map[c]) ? map[c].length : 0;
      const level=getCourtShareLevel(count);
      if(level==='danger') return `<span class="badge" style="font-size:.74rem;padding:4px 9px;background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5">🚨 ${c} ${count}조배정</span>`;
      if(level==='warning') return `<span class="badge" style="font-size:.74rem;padding:4px 9px;background:#fff7ed;color:#c2410c;border:1px solid #fdba74">⚠️ ${c} 2조배정</span>`;
      return '';
    }).filter(Boolean).join(' ');
  }catch(e){ return ''; }
}
function escAttr(v=''){
  return String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function renderNoticeTicker(text,label='📢 공지',compact=false){
  const msg=String(text||'').trim();
  if(!msg) return '';
  const safeLabel=esc(String(label||'📢 공지'));
  const safeMsg=esc(msg);
  const outerStyle=compact
    ? 'display:flex;align-items:center;gap:8px;width:100%;max-width:100%;padding:6px 10px;border-radius:999px;background:linear-gradient(135deg,#fff1f2,#ffe4e6 55%,#fff7ed);border:2px solid #fb7185;box-shadow:0 4px 12px rgba(244,63,94,.12);overflow:hidden;'
    : 'display:flex;align-items:center;gap:10px;width:100%;max-width:100%;padding:9px 12px;border-radius:12px;background:linear-gradient(135deg,#fff1f2,#ffe4e6 55%,#fff7ed);border:2px solid #fb7185;box-shadow:0 4px 12px rgba(244,63,94,.12);overflow:hidden;';
  const labelStyle=compact
    ? 'flex:0 0 auto;display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:#be123c;color:#fff;font-size:.74rem;font-weight:900;line-height:1;white-space:nowrap;'
    : 'flex:0 0 auto;display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;background:#be123c;color:#fff;font-size:.78rem;font-weight:900;line-height:1;white-space:nowrap;';
  const viewportStyle='position:relative;flex:1 1 auto;min-width:0;overflow:hidden;height:'+(compact?'1.3em':'1.45em')+';display:flex;align-items:center;';
  const trackStyle='display:inline-flex;align-items:center;gap:42px;white-space:nowrap;min-width:max-content;will-change:transform;animation:noticeMarquee 14s linear infinite;';
  const msgStyle=compact
    ? 'display:inline-block;font-size:.88rem;font-weight:900;color:#9f1239;white-space:nowrap;'
    : 'display:inline-block;font-size:.92rem;font-weight:900;color:#9f1239;white-space:nowrap;';
  return `<div class="notice-ticker-inline" style="${outerStyle}"><span class="notice-ticker-inline-label" style="${labelStyle}">${safeLabel}</span><div class="notice-ticker-inline-viewport" style="${viewportStyle}"><div class="notice-ticker-inline-track" style="${trackStyle}"><span class="notice-ticker-inline-msg" style="${msgStyle}">${safeMsg}</span><span class="notice-ticker-inline-msg" aria-hidden="true" style="${msgStyle}">${safeMsg}</span><span class="notice-ticker-inline-msg" aria-hidden="true" style="${msgStyle}">${safeMsg}</span></div></div></div>`;
}

function renderCourtAccordionSelector(selectedCourts=[], usedCourtsMap=null, scope='group', allowedCourts=null){
  const selected=new Set((selectedCourts||[]).filter(Boolean));
  const allowedSet=allowedCourts && allowedCourts.length ? new Set((allowedCourts||[]).filter(Boolean)) : null;
  let groups=[];
  if(allowedSet && allowedSet.size){
    const source=[...allowedSet].map(String);
    const map=new Map();
    source.forEach(c=>{
      const m=String(c).match(/^(.*?)(\d+)$/);
      const title=(m&&m[1])?m[1]:String(c);
      if(!map.has(title)) map.set(title, []);
      map.get(title).push(String(c));
    });
    groups=[...map.entries()].map(([title,courts])=>({title,courts:courts.sort((a,b)=>a.localeCompare(b,'ko',{numeric:true}))}));
  } else {
    groups = DEFAULT_COURT_GROUPS.map(g=>({title:g.title,courts:(g.courts||[]).slice()}));
  }
  groups = groups.filter(g=>(g.courts||[]).length>0);

  if(!groups.length){
    return `<div style="padding:14px 12px;border:1px dashed #bfdbfe;border-radius:12px;background:#fff;font-size:.82rem;line-height:1.7;color:var(--text2)">
      선택 가능한 코트가 없습니다.<br>먼저 조 코트를 배정해 주세요.
    </div>`;
  }

  return groups.map((g, idx)=>{
    const boxId=`courtAcc_${scope}_${idx}_${Math.random().toString(36).slice(2,7)}`;
    const hasSelected=(g.courts||[]).some(c=>selected.has(c));
    const labels=(g.courts||[]).map(c=>{
      const isMine=selected.has(c);
      const usedBy=usedCourtsMap && usedCourtsMap[c] ? usedCourtsMap[c] : [];
      const isUsed=usedBy.length>0;
      const bg=isMine?'#e8f4fd':isUsed?'#fff8e1':'white';
      const border=isMine?'#1565c0':isUsed?'#f5a623':'var(--border)';
      const extra=isUsed?`<div style="display:flex;flex-direction:column;gap:2px;width:100%;margin-top:2px">${usedBy.slice(0,2).map(msg=>`<span style="font-size:.62rem;color:#b45309;line-height:1.35">⚠️ ${esc(msg)}</span>`).join('')}${usedBy.length>2?`<span style="font-size:.62rem;color:#92400e">외 ${usedBy.length-2}건</span>`:''}</div>`:'';
      return `<label style="display:flex;align-items:flex-start;gap:6px;padding:8px 12px;border:1.5px solid ${border};border-radius:16px;background:${bg};font-size:.88rem;cursor:pointer;flex-wrap:wrap">
        <input type="checkbox" value="${escAttr(c)}" ${isMine?'checked':''}>
        <span style="font-weight:${isMine?700:600};flex:1 1 auto">${c}${isMine?' ✅':''}</span>
        ${extra}
      </label>`;
    }).join('');
    return `<div style="margin-bottom:12px;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:#fff">
      <button type="button" onclick="toggleCourtAccordion('${boxId}', this)" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border:none;background:${hasSelected?'linear-gradient(135deg,#eef4ff,#fff8df)':'#f8fafc'};cursor:pointer">
        <span style="font-size:.92rem;font-weight:900;color:var(--primary-dark)">📍 ${g.title}</span>
        <span style="font-size:.76rem;font-weight:800;color:${hasSelected?'var(--primary)':'var(--text2)'}">${hasSelected?((g.courts||[]).filter(c=>selected.has(c)).join('/')):'구장 선택'}</span>
      </button>
      <div id="${boxId}" style="display:${hasSelected?'block':'none'};padding:12px 14px;border-top:1px solid var(--border)">
        <div style="display:flex;flex-wrap:wrap;gap:8px">${labels}</div>
      </div>
    </div>`;
  }).join('');
}
function toggleCourtAccordion(id, btn){
  const box=ge(id);
  if(!box) return;
  box.style.display = box.style.display==='none' ? 'block' : 'none';
}
window.toggleCourtAccordion = toggleCourtAccordion;

function getTotalCourtCount(){
  return getCourtGroupCount(DEFAULT_COURT_GROUPS);
}
function renderCourtInfoBody(){
  const body=ge('mCourtInfoBody');
  if(!body) return;
  const tid=(ge('brTS')?.value||ge('regTS')?.value||'');
  const groups=getCourtGroupsForTournamentOrKey(tid||'', true);
  const total=groups.reduce((sum,g)=>sum + ((g.courts||[]).length), 0);
  const title=tid ? '현재 대회 운영 코트 현황' : '기본 운영 코트 현황';
  body.innerHTML = `
    <div style="padding:10px 12px;background:linear-gradient(135deg,#eef4ff,#fff7dd);border:1px solid var(--border);border-radius:12px;margin-bottom:12px;font-size:.84rem;line-height:1.65">
      <b style="color:var(--primary-dark)">${title}</b><br>
      총 <b style="color:var(--primary)">${total}면</b> 운영 기준
    </div>
    <div style="display:flex;flex-direction:column;gap:7px">
      ${groups.map(g=>`
        <div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;background:#fff">
          <div style="padding:10px 12px;background:var(--primary);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span>${g.title}</span>
            <span style="font-size:.78rem;background:rgba(255,255,255,.16);padding:3px 8px;border-radius:999px">${(g.courts||[]).length}면</span>
          </div>
          <div style="padding:10px 12px;display:flex;flex-wrap:wrap;gap:6px">
            ${(g.courts||[]).map(c=>`<span class="badge bg-blue" style="font-size:.76rem">${c}</span>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
function openCourtInfoModal(){
  renderCourtInfoBody();
  om('mCourtInfo');
}
window.openCourtInfoModal = openCourtInfoModal;



const COURT_BOARD_UI_STATE = {};
function getCourtBoardUIState(key){
  if(!COURT_BOARD_UI_STATE[key]) COURT_BOARD_UI_STATE[key]={collapsed:false,hidden:false,sharedExpanded:false};
  return COURT_BOARD_UI_STATE[key];
}
function toggleCourtBoardCollapsed(key){
  const st=getCourtBoardUIState(key);
  st.collapsed=!st.collapsed;
  renderBracket();
}
function toggleCourtBoardHidden(key){
  const st=getCourtBoardUIState(key);
  st.hidden=!st.hidden;
  renderBracket();
}
function toggleCourtBoardSharedExpanded(key){
  const st=getCourtBoardUIState(key);
  st.sharedExpanded=!st.sharedExpanded;
  renderBracket();
}
window.toggleCourtBoardCollapsed = toggleCourtBoardCollapsed;
window.toggleCourtBoardHidden = toggleCourtBoardHidden;
window.toggleCourtBoardSharedExpanded = toggleCourtBoardSharedExpanded;

function getMatchCourtsForStatusBoard(key,m){
  if(!m) return [];
  // 조 코트 배정은 배포/표시용이고, 실제 코트 현황/대기열/알림은 경기 코트 배정만 사용한다.
  const ownCourts=Array.isArray(m.courts)&&m.courts.length ? m.courts : (m.court?[m.court]:[]);
  return [...new Set((ownCourts||[]).filter(Boolean))];
}
function getUsedCourtsForKey(key){
  const matchCourts=(G.matches[key]||[]).flatMap(m=>getMatchCourtsForStatusBoard(key,m));
  const all=[...new Set(matchCourts.filter(Boolean))];
  const idxMap=new Map(getAllKnownCourts(_k2td(key).tid).map((c,i)=>[c,i]));
  return all.sort((a,b)=>{
    const ia=idxMap.has(a)?idxMap.get(a):9999;
    const ib=idxMap.has(b)?idxMap.get(b):9999;
    if(ia!==ib) return ia-ib;
    return String(a).localeCompare(String(b),'ko');
  });
}
function getCourtBoardSafeTeamName(key, teamIdx){
  const teams=G.teams[key]||[];
  const team=teams[teamIdx] ?? teams.find(t=>t&&((t.id!=null&&t.id===teamIdx)||(t.name&&t.name===teamIdx)));
  return team ? getCourtBoardTeamName(team,key,teamIdx) : 'TBD';
}
function getGroupSlotNames(key, gi){
  const grp=G.draws?.[key]?.groups?.[Number(gi)];
  const arr=Array.isArray(grp?.teams) ? grp.teams : [];
  return arr.map(ti=>getCourtBoardSafeTeamName(key, ti));
}
function buildCourtBoardGroupHeadline(key, m, autoTitle, rawTitle){
  const gi=Number(m?.group||0);
  const slots=getGroupSlotNames(key, gi);
  const s1=slots[0]||'1번';
  const s2=slots[1]||'2번';
  const s3=slots[2]||'3번';
  const label=String(autoTitle||'').trim();
  const detail=`예선 ${grpLabel(m.group||0)}`;
  if(!label) return {headline: rawTitle, detail};
  if(label==='1번 vs 2번') return {headline: `${s1} vs ${s2}`, detail};
  if(label==='1번 vs 3번') return {headline: `${s1} vs ${s3}`, detail};
  if(label==='2번 vs 3번') return {headline: `${s2} vs ${s3}`, detail};

  const grp=G.draws?.[key]?.groups?.[gi];
  const teams=Array.isArray(grp?.teams) ? grp.teams : [];
  let win12='1,2번 승자';
  let lose12='1,2번 패자';
  if(teams.length>=2){
    const m12=findGroupMatchByTeams(key, gi, teams[0], teams[1]);
    if(m12 && m12.winner!=null){
      const winnerId=m12.winner;
      const loserId=(winnerId===teams[0]) ? teams[1] : teams[0];
      win12=getCourtBoardSafeTeamName(key, winnerId);
      lose12=getCourtBoardSafeTeamName(key, loserId);
    }
  }

  if(label==='1,2번 승자 vs 3번') return {headline: `${win12} vs ${s3}`, detail};
  if(label==='1,2번 패자 vs 3번') return {headline: `${lose12} vs ${s3}`, detail};
  return {headline: label, detail};
}
function describeCourtBoardMatch(key,m){
  const base=(m&&m.__autoItem&&m.__autoItem.match)?m.__autoItem.match:m;
  const autoTitle=(m&&m.__autoItem&&m.__autoItem.autoLabel) || (m&&m.autoCourtLabel) || '';
  const {t1,t2}=getMatchTeamObjects(key,base||m);
  const dn1=t1?getCourtBoardTeamName(t1,key,(base||m).t1):'TBD';
  const dn2=t2?getCourtBoardTeamName(t2,key,(base||m).t2):'TBD';
  const rawTitle=`${dn1} vs ${dn2}`;
  const st=getMatchResultState(key,base||m);
  let label='경기';
  if((base||m).phase==='group') label=`예선 ${grpLabel((base||m).group||0)}`;
  else if((base||m).phase==='playin') label='진출전';
  else if((base||m).phase==='main') label=getMainRoundLabelByRoundIndex((base||m).round||0, key) || '본선';
  else if((base||m).phase==='bronze') label='3·4위전';
  const score=(st.started || st.done) ? `${st.disp1??st.sc1??0}:${st.disp2??st.sc2??0}` : '';
  let title=(autoTitle || rawTitle);
  let detail='';
  if(String((base||m)?.phase||'')==='group'){
    const built=buildCourtBoardGroupHeadline(key,base||m,autoTitle,rawTitle);
    title=built.headline || title;
    detail=built.detail || '';
  }else if(autoTitle && rawTitle && rawTitle!=='TBD vs TBD'){
    detail=rawTitle;
  }else if(!autoTitle && rawTitle && rawTitle!=='TBD vs TBD'){
    detail='';
  }
  if(detail===title || detail===`${label} · ${title}`) detail='';
  return {label, title, rawTitle, autoTitle, detail, score, started:!!st.started, done:!!st.done};
}

function getRoundVisualTheme(label='', phase=''){
  const safeLabel=String(label||'').trim();
  const safePhase=String(phase||'').trim();
  // 예선 32조처럼 숫자가 들어가도 본선 32강으로 오인하지 않도록 예선 우선 처리
  if(safePhase==='group' || safeLabel.includes('예선')){
    return {bg:'#f1f5f9', bd:'#64748b', fg:'#1e293b', chipBg:'#cbd5e1', chipFg:'#1e293b', softBg:'#f1f5f9', strongBg:'#cbd5e1'};
  }
  if(safePhase==='playin'){
    return {bg:'#fff7ed', bd:'#ea580c', fg:'#9a3412', chipBg:'#fed7aa', chipFg:'#9a3412', softBg:'#fff7ed', strongBg:'#fed7aa'};
  }
  // 128강: 연두 계열 — 64강 파랑과 명확히 구분
  if(/128강/.test(safeLabel)){
    return {bg:'#f7fee7', bd:'#65a30d', fg:'#365314', chipBg:'#d9f99d', chipFg:'#365314', softBg:'#f7fee7', strongBg:'#bef264'};
  }
  // 64강: 진한 파랑 — 128강과 명확히 구분
  if(/64강/.test(safeLabel)){
    return {bg:'#eff6ff', bd:'#2563eb', fg:'#1d4ed8', chipBg:'#bfdbfe', chipFg:'#1e3a8a', softBg:'#eff6ff', strongBg:'#60a5fa'};
  }
  if(/32강/.test(safeLabel)){
    return {bg:'#ecfeff', bd:'#0f766e', fg:'#115e59', chipBg:'#ccfbf1', chipFg:'#115e59', softBg:'#ecfeff', strongBg:'#99f6e4'};
  }
  if(/16강/.test(safeLabel)){
    return {bg:'#f0fdf4', bd:'#15803d', fg:'#166534', chipBg:'#dcfce7', chipFg:'#166534', softBg:'#f0fdf4', strongBg:'#bbf7d0'};
  }
  if(/8강/.test(safeLabel)){
    return {bg:'#fff7ed', bd:'#ea580c', fg:'#c2410c', chipBg:'#ffedd5', chipFg:'#9a3412', softBg:'#fff7ed', strongBg:'#fed7aa'};
  }
  if(safeLabel.includes('준결승')){
    return {bg:'#eef2ff', bd:'#4f46e5', fg:'#3730a3', chipBg:'#e0e7ff', chipFg:'#3730a3', softBg:'#eef2ff', strongBg:'#c7d2fe'};
  }
  if(safeLabel.includes('결승')){
    return {bg:'#fffbeb', bd:'#d4a017', fg:'#8a6412', chipBg:'#fef3c7', chipFg:'#8a6412', softBg:'#fffbeb', strongBg:'#fde68a'};
  }
  return {bg:'#fff8e8', bd:'#f6d28b', fg:'#7a4b00', chipBg:'#fff3cd', chipFg:'#9a6400', softBg:'#fff8e8', strongBg:'#ffe8a3'};
}
function getCourtBoardPhaseColor(info, match){
  const theme=getRoundVisualTheme(String(info?.label||''), String(match?.phase||''));
  return {bg:theme.bg, bd:theme.bd, fg:theme.fg, chipBg:theme.chipBg, chipFg:theme.chipFg};
}

function getAutoAssignedGroupsForCourt(key, court){
  try{
    const plan=getIndividualAutoAssignmentPlan(key);
    const list=(plan && plan.fixed && plan.fixed[court]) ? plan.fixed[court] : [];
    return Array.isArray(list) ? list.slice() : [];
  }catch(e){ return []; }
}
function getCourtStatusSnapshot(key){
  const selectedCourts=getDisplayCourtFilters(key)||[];
  const usedCourts=getUsedCourtsForKey(key);
  const targetCourts=(selectedCourts.length && isIndividualByKey(key))
    ? [...new Set([...selectedCourts, ...usedCourts])]
    : usedCourts;
  const list=G.matches[key]||[];
  return targetCourts.map(court=>{
    const related=list.filter(m=>getMatchCourtsForStatusBoard(key,m).includes(court) && m.winner==null).sort((a,b)=>{
      const aa=String(a.courtQueueOrder||a.courtAssignedAt||'');
      const bb=String(b.courtQueueOrder||b.courtAssignedAt||'');
      if(aa!==bb) return aa.localeCompare(bb);
      const pa=String(a.phase||''), pb=String(b.phase||'');
      if(pa!==pb) return pa.localeCompare(pb);
      const ga=Number(a.group??-1), gb=Number(b.group??-1);
      if(ga!==gb) return ga-gb;
      const ra=Number(a.round||0), rb=Number(b.round||0);
      if(ra!==rb) return ra-rb;
      return Number(a.slot||0)-Number(b.slot||0);
    });
    // 첫 배정 경기는 즉시 현재 경기로 간주한다. 이후 같은 코트 재배정은 대기열로 내려간다.
    const current=related[0]||null;
    const waiting=related.slice(1);
    let status='empty';
    if(current) status=waiting.length?'live':'live';
    return {court,status,current,waiting,related};
  });
}

function isManualCourtPinnedMatch(m){
  return !!(m && m.winner==null && String(m.manualCourtTarget||'').trim());
}
function getManualCourtPinnedAt(m){
  return String(m?.manualCourtPinnedAt||m?.courtAssignedAt||'');
}
function getManualCourtPinnedMatchesForCourt(key, court){
  return (G.matches[key]||[])
    .filter(m=>m && m.winner==null && String(m.manualCourtTarget||'')===String(court))
    .sort((a,b)=>{
      const aa=getManualCourtPinnedAt(a);
      const bb=getManualCourtPinnedAt(b);
      if(aa!==bb) return aa.localeCompare(bb);
      return String(a.id||'').localeCompare(String(b.id||''),'ko');
    });
}
function getCourtBoardCardToken(key, m){
  return encodeURIComponent(JSON.stringify({key:key, mid:String(m?.id||'')}));
}
function getCourtBoardDropToken(raw){
  try{ return JSON.parse(decodeURIComponent(String(raw||''))); }catch(e){ return null; }
}
function getCourtBoardManualTargetMap(key){
  const out={};
  try{
    (G.matches[key]||[]).forEach(m=>{
      if(!m || m.winner!=null) return;
      const c=String(m.manualCourtTarget||'').trim();
      if(!c) return;
      out[String(m.id)] = c;
    });
  }catch(e){}
  return out;
}

function onCourtCardDragStart(ev, key, mid){
  try{
    const token=getCourtBoardCardToken(key,{id:mid});
    ev.dataTransfer.setData('text/plain', token);
    ev.dataTransfer.effectAllowed='move';
    const card=ev.currentTarget;
    card && card.classList.add('dragging');
  }catch(e){}
}
function onCourtCardDragEnd(ev){
  try{ ev.currentTarget && ev.currentTarget.classList.remove('dragging'); }catch(e){}
  document.querySelectorAll('.court-drop-zone.drag-over').forEach(el=>el.classList.remove('drag-over'));
}
function onCourtDropOver(ev){
  ev.preventDefault();
  try{ ev.dataTransfer.dropEffect='move'; }catch(e){}
  ev.currentTarget && ev.currentTarget.classList.add('drag-over');
}
function onCourtDropLeave(ev){
  ev.currentTarget && ev.currentTarget.classList.remove('drag-over');
}
async function moveCourtQueueCard(key, mid, targetCourt){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 이동할 수 있습니다','info'); return; }
  const prevCourtState=captureCourtNotificationState();
  const list=G.matches[key]||[];
  const m=list.find(x=>String(x.id)===String(mid));
  if(!m || m.winner!=null) return;
  const rollbackSnapshot=cloneMatchForRollback(m);
  const nowIso = new Date().toISOString();
  const moveCheck=validateCourtMoveTarget({
    targetCourt,
    allowedCourts:getAllowedCourtsForMatch(key,m)
  });
  if(!moveCheck.ok){
    toast(moveCheck.error,'error');
    return;
  }
  const court=moveCheck.court;
  applyCourtMovePatch(m,buildManualCourtMoveMeta({
    targetCourt:court,
    nowIso
  }));
  if(isIndividualByKey(key) && isIndividualAutoCourtAssignEnabled()){
    if(court){
      // [BUG FIX] rebuild 전에 m.courts/m.court를 즉시 설정해두어야
      // renderBracket() 시점에 snapshot에서 카드가 사라지지 않는다.
      m.courts=[court];
      m.court=court;
      if(!m.courtAssignedAt) m.courtAssignedAt=nowIso;
      ensureIndividualAutoCourtAssignmentsForKey(key);
      // rebuild 후에도 m.courts가 올바르게 설정됐는지 보장
      if(!Array.isArray(m.courts)||!m.courts.length){ m.courts=[court]; m.court=court; }
    }else{
      m.courts=[];
      m.court='';
      delete m.courtAssignedAt;
      delete m.autoCourtLabel;
      delete m.waitingFirstAt;
    }
  }else{
    applyCourtMovePatch(m,buildTeamCourtMovePatch({
      matches:G.matches[key]||[],
      match:m,
      targetCourt:court,
      nowIso
    }));
  }
  await commitCourtMove({
    key,
    match:m,
    snapshot:rollbackSnapshot,
    persistMatch:persistSingleMatchDoc,
    setLoading:sl,
    dispatchAlerts:dispatchLocalCourtNotificationAlerts,
    previousNotificationState:prevCourtState,
    render:renderBracket,
    notify:toast,
    successMessage:(court ? `수동 배정 완료 ✅ → ${court}` : '공용 대기로 이동 완료 ✅'),
    failurePrefix:'이동 저장 실패: '
  });
}
async function onCourtDrop(ev, key, targetCourt){
  ev.preventDefault();
  ev.currentTarget && ev.currentTarget.classList.remove('drag-over');
  const data=getCourtBoardDropToken(ev.dataTransfer.getData('text/plain'));
  if(!data || String(data.key)!==String(key) || !data.mid) return;
  await moveCourtQueueCard(key, data.mid, targetCourt);
}

let COURT_MOVE_PICKER_STATE = null;
function closeCourtMovePicker(){
  COURT_MOVE_PICKER_STATE = null;
  const el=document.getElementById('courtMovePickerOverlay');
  if(el) el.remove();
}
function getCourtMoveOptions(key, mid){
  const list=G.matches[key]||[];
  const m=list.find(x=>String(x.id)===String(mid));
  if(!m) return [];
  return buildCourtMoveOptions(getAllowedCourtsForMatch(key,m));
}
function showCourtMovePicker(key, mid){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 이동할 수 있습니다','info'); return; }
  const list=G.matches[key]||[];
  const m=list.find(x=>String(x.id)===String(mid));
  if(!m || m.winner!=null) return;
  closeCourtMovePicker();
  const info=describeCourtBoardMatch(key,m);
  const current=String(m.manualCourtTarget||'').trim();
  const options=getCourtMoveOptions(key, mid);
  COURT_MOVE_PICKER_STATE={key, mid};
  const overlay=document.createElement('div');
  overlay.id='courtMovePickerOverlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.48);z-index:10020;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML=buildCourtMovePickerHtml({
    title:info.title||'경기',
    label:info.label||'',
    detail:info.detail||'',
    current,
    options,
    escapeHtml:esc,
    escapeAttr:escAttr
  });
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeCourtMovePicker(); });
  document.body.appendChild(overlay);
}
async function applyCourtMovePicker(targetCourt){
  const st=COURT_MOVE_PICKER_STATE;
  if(!st) return;
  const key=st.key, mid=st.mid;
  closeCourtMovePicker();
  await moveCourtQueueCard(key, mid, targetCourt||'');
}
window.onCourtCardDragStart = onCourtCardDragStart;
window.onCourtCardDragEnd = onCourtCardDragEnd;
window.onCourtDropOver = onCourtDropOver;
window.onCourtDropLeave = onCourtDropLeave;
window.onCourtDrop = onCourtDrop;
window.moveCourtQueueCard = moveCourtQueueCard;
window.showCourtMovePicker = showCourtMovePicker;
window.closeCourtMovePicker = closeCourtMovePicker;
window.applyCourtMovePicker = applyCourtMovePicker;



function renderCourtWaitingBadge(match){
  return buildCourtWaitingBadgeHtml(match,{escapeHtml:esc});
}

function renderCourtCardShell(args){
  return buildCourtCardShellHtml(args);
}

function renderCourtStatusSummary(counts){
  return buildCourtStatusSummaryHtml({
    total:counts?.total||0,
    live:counts?.live||0,
    waiting:counts?.waiting||0,
    empty:counts?.empty||0
  });
}


function getCourtBoardVisibleWaiting(item){
  return getCourtQueueDisplayState(item?.waiting||[]);
}
function getCourtBoardSharedOverflowItems(key, items, selectedCourts, usedCourts){
  const shared=[];
  const courtsForLabel=((selectedCourts&&selectedCourts.length)?selectedCourts:usedCourts).map(String);
  const courtIndexMap=new Map(courtsForLabel.map((c,i)=>[c,i]));
  const existingShared=new Set();
  const itemMap=new Map((items||[]).map(item=>[String(item.court||''), item]));
  const visibleCountsByCourt={};
  items.forEach(item=>{
    const split=getCourtBoardVisibleWaiting(item);
    split.overflow.forEach(m=>{
      if(!m || m.winner!=null) return;
      existingShared.add(String(m.id||''));
      const clone={...m};
      clone.__sharedCourtLabel=String(item.court||'');
      shared.push(clone);
    });
    item.__visibleWaiting=split.visible;
    const counts={group:0,main:0};
    (item.__visibleWaiting||[]).forEach(m=>{
      const cfg=getCourtBoardDisplayLimitsForMatch(m);
      counts[cfg.bucket]=(counts[cfg.bucket]||0)+1;
    });
    visibleCountsByCourt[String(item.court||'')]=counts;
  });
  // getIndividualAutoSharedWaitingItems는 이미 균형 정렬(__mainQueueOrder) 기준으로
  // 정렬된 목록을 반환한다. 이 순서(인덱스)를 __sharedListOrder로 기록해두어
  // overflow 경기와 통합 정렬 시에도 같은 기준을 쓸 수 있게 한다.
  const sharedListOrderMap=new Map();
  (getIndividualAutoSharedWaitingItems(key)||[]).forEach((m,idx)=>{
    if(!m) return;
    sharedListOrderMap.set(String(m.id||''), idx);
  });
  (getIndividualAutoSharedWaitingItems(key)||[]).forEach(m=>{
    if(!m || m.winner!=null) return;
    const mid=String(m.id||'');
    if(existingShared.has(mid)) return;
    const clone={...m};
    const target=String(m.__sharedCourtLabel||m.manualCourtTarget||'').trim();
    if(target) clone.__sharedCourtLabel=target;
    // 공용대기 항목은 targetCourt 라벨이 있더라도 공용대기에 그대로 남겨둔다.
    existingShared.add(mid);
    shared.push(clone);
  });
  // overflow 경기와 autoShared 경기를 통합 정렬:
  // 모든 경기에 __sharedListOrder(균형 정렬 기준 순위)를 부여하여 일관된 순서를 보장한다.
  shared.sort((a,b)=>{
    const pa=(String(a?.phase||'')==='group'?0:1), pb=(String(b?.phase||'')==='group'?0:1);
    if(pa!=pb) return pa-pb;
    // manualSharedHold 경기를 항상 최우선
    const ah=!!(a?.manualSharedHold||a?.__manualSharedHold), bh=!!(b?.manualSharedHold||b?.__manualSharedHold);
    if(ah!==bh) return ah?-1:1;
    // 균형 정렬 기준 순위 (getIndividualAutoSharedWaitingItems의 순서)
    const ao=sharedListOrderMap.has(String(a?.id||'')) ? sharedListOrderMap.get(String(a?.id||'')) : 99999;
    const bo=sharedListOrderMap.has(String(b?.id||'')) ? sharedListOrderMap.get(String(b?.id||'')) : 99999;
    if(ao!==bo) return ao-bo;
    // 같은 순위(둘 다 sharedListOrderMap에 없는 경우) → 코트 인덱스, 라운드, slot 순
    const ia=courtIndexMap.has(String(a?.__sharedCourtLabel||''))?courtIndexMap.get(String(a?.__sharedCourtLabel||'')):999;
    const ib=courtIndexMap.has(String(b?.__sharedCourtLabel||''))?courtIndexMap.get(String(b?.__sharedCourtLabel||'')):999;
    if(ia!=ib) return ia-ib;
    const ra=Number(a?.round||0), rb=Number(b?.round||0);
    if(ra!=rb) return ra-rb;
    const sa=String(a?.courtAssignedAt||a?.manualCourtPinnedAt||''), sb=String(b?.courtAssignedAt||b?.manualCourtPinnedAt||'');
    if(sa!=sb) return sa.localeCompare(sb);
    return String(a?.id||'').localeCompare(String(b?.id||''),'ko');
  });
  return shared;
}

function getVisibleSharedWaitingOrderForAssign(key){
  try{
    const usedCourts=getUsedCourtsForKey(key)||[];
    const autoPool=(isIndividualByKey(key) && isIndividualAutoCourtAssignEnabled()) ? (getIndividualAutoAssignmentPlan(key)?.pool||[]) : [];
    const boardCourts=[...new Set([...(usedCourts||[]), ...(autoPool||[])])].map(String).filter(Boolean);
    if(!boardCourts.length) return getIndividualAutoSharedWaitingItems(key)||[];
    const snapshots=getCourtStatusSnapshot(key)||[];
    const snapshotMap=new Map((snapshots||[]).map(item=>[String(item.court||''), item]));
    const items=boardCourts.map(court=>snapshotMap.get(String(court)) || {court:String(court),status:'empty',current:null,waiting:[],related:[]});
    const processed=items.map(item=>{
      const split=getCourtBoardVisibleWaiting(item);
      return {...item,__visibleWaiting:split.visible,__overflowWaiting:split.overflow};
    });
    return getCourtBoardSharedOverflowItems(key, processed, [], boardCourts);
  }catch(e){
    return getIndividualAutoSharedWaitingItems(key)||[];
  }
}

function renderCourtStatusBoard(key, div){
  const selectedCourts=getSelectedCourtFilters(key);
  const usedCourts=getUsedCourtsForKey(key);
  const st=getCourtBoardUIState(key);
  if(st.hidden){
    return buildCourtBoardHiddenHtml({key,escapeAttr:escAttr});
  }
  const autoPool=(isIndividualByKey(key) && isIndividualAutoCourtAssignEnabled()) ? (getIndividualAutoAssignmentPlan(key)?.pool||[]) : [];
  const boardCourts=(selectedCourts.length ? selectedCourts : [...new Set([...(usedCourts||[]), ...(autoPool||[])])]).map(String).filter(Boolean);
  const allSnapshots=getCourtStatusSnapshot(key);
  const snapshotMap=new Map((allSnapshots||[]).map(item=>[String(item.court), item]));
  const items=boardCourts.map(court=>snapshotMap.get(String(court)) || {court:String(court),status:'empty',current:null,waiting:[],related:[]});
  const liveCount=items.filter(x=>x.status==='live').length;
  const hasCourts=boardCourts.length>0;
  const processedItems=items.map(item=>{
    const split=getCourtBoardVisibleWaiting(item);
    return {...item,__visibleWaiting:split.visible,__overflowWaiting:split.overflow};
  });
  const sharedWaiting=(isIndividualByKey(key) && isIndividualAutoCourtAssignEnabled()) ? getCourtBoardSharedOverflowItems(key, processedItems, selectedCourts, boardCourts) : [];
  const sharedWaitingDefaultVisibleCount=10;
  const sharedWaitingExpanded=!!st.sharedExpanded;
  const sharedWaitingVisible=(sharedWaitingExpanded ? sharedWaiting : sharedWaiting.slice(0,sharedWaitingDefaultVisibleCount));
  const sharedWaitingHiddenCount=Math.max(0, sharedWaiting.length-sharedWaitingVisible.length);
  const waitingCount=processedItems.reduce((sum,item)=>sum+((item.__visibleWaiting||[]).length),0);
  const emptyCount=processedItems.filter(x=>x.status==='empty').length;
  const sharedWaitingCardsHtml=sharedWaitingVisible.map((w,idx)=>{
    const wi=describeCourtBoardMatch(key,w);
    const priority=idx+1;
    const headline=((wi.title&&wi.title!=='TBD vs TBD')
      ? wi.title
      : ((wi.rawTitle&&wi.rawTitle!=='TBD vs TBD') ? wi.rawTitle : (wi.autoTitle||'경기 대기')));
    const targetCourt=String(w.__sharedCourtLabel||'').trim();
    const detailParts=[wi.label,targetCourt?`${targetCourt} 배정예정`:'공용 대기'];
    const isManual=!!w.manualSharedHold || !!String(w.manualCourtTarget||'').trim();
    const assignedElapsed=buildElapsedMetaLine(w.courtAssignedAt||'','wait_placed');
    const metaEntries=[];
    if(assignedElapsed.clock) metaEntries.push({...assignedElapsed,prefix:'대기배치'});
    const theme=getCourtBoardPhaseColor(wi,w);
    const elapsedBadgeHtml=assignedElapsed.badge
      ? `<span class="badge" style="font-size:.66rem;padding:3px 7px;background:${assignedElapsed.badge.bg};color:${assignedElapsed.badge.color};border:1px solid ${assignedElapsed.badge.bd}">${assignedElapsed.badge.text}</span>`
      : '';

    return buildSharedWaitingCardHtml({
      key,
      matchId:String(w.id),
      headline,
      detail:detailParts.join(' · '),
      metaHtml:renderElapsedMetaBlocks(metaEntries,theme.fg),
      priority,
      theme,
      elapsedBadgeHtml,
      manual:isManual,
      canManage:canManageBracket(),
      targetCourt,
      escapeHtml:esc,
      escapeAttr:escAttr
    });
  }).join('');

  const sharedWaitingHtml=buildSharedWaitingSectionHtml({
    key,
    total:sharedWaiting.length,
    visibleCount:sharedWaitingVisible.length,
    hiddenCount:sharedWaitingHiddenCount,
    expanded:sharedWaitingExpanded,
    defaultVisibleCount:sharedWaitingDefaultVisibleCount,
    cardsHtml:sharedWaitingCardsHtml,
    escapeAttr:escAttr
  });
  const cards=hasCourts ? processedItems.map(item=>{
    const info=item.current ? describeCourtBoardMatch(key,item.current) : null;
    const assignedGroups=(isIndividualByKey(key) && isIndividualAutoCourtAssignEnabled()) ? getAutoAssignedGroupsForCourt(key, item.court) : [];
    const currentTheme = info ? getRoundVisualTheme(info.label||'', item.current?.phase||'') : null;
    const badge = item.current
      ? `<span class="badge live-blink" style="font-size:.76rem;padding:4px 9px;background:${currentTheme?.chipBg||'#dcfce7'};color:${currentTheme?.chipFg||'#166534'};border:1px solid ${currentTheme?.bd||'#86efac'}">시합중</span>`
      : `<span class="badge bg-gray" style="font-size:.76rem;padding:4px 9px">빈코트</span>`;
    const isCurrentManual = !!String(item.current?.manualCourtTarget||'').trim() || !!item.current?.manualSharedHold;
    const phaseChip = info
      ? `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px"><span class="badge" style="font-size:.72rem;padding:3px 9px;font-weight:900;background:${getCourtBoardPhaseColor(info,item.current).chipBg};color:${getCourtBoardPhaseColor(info,item.current).chipFg};border:2px solid ${getCourtBoardPhaseColor(info,item.current).bd}">${esc(info.label||'경기')}</span>${info.detail?`<span style="font-size:.72rem;color:var(--text2);font-weight:700">${esc(info.detail)}</span>`:''}</div>`
      : '';
    const currentElapsed = item.current ? buildElapsedMetaLine(item.current.courtAssignedAt||'', 'assigned') : {text:'', badge:null, mins:0, mode:'assigned', label:'', clock:'', duration:'', prefix:'시합시작'};
    const currentMetaEntries=[];
    // 현재경기: 시합시작 시각 1개만 표시
    if(currentElapsed.clock) currentMetaEntries.push({...currentElapsed, prefix:'시합시작'});
    const currentTitleHtml = info
      ? `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px"><div style="font-size:.84rem;font-weight:900;color:var(--primary-dark);line-height:1.35;flex:1;word-break:keep-all;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(info.title)}</div><div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:flex-end">${isCurrentManual?'<span class="badge bg-blue" style="font-size:.66rem;padding:3px 7px">수동</span>':''}${currentElapsed.badge?`<span class="badge" style="font-size:.66rem;padding:3px 7px;background:${currentElapsed.badge.bg};color:${currentElapsed.badge.color};border:1px solid ${currentElapsed.badge.bd}">${currentElapsed.badge.text}</span>`:''}</div></div>`
      : '';
    const currentMetaHtml = info ? renderElapsedMetaBlocks(currentMetaEntries, currentElapsed.badge?currentElapsed.badge.color:'var(--text2)') : '';
    const currentActionsHtml = info
      ? `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">${canManageBracket()?`<button class="btn btn-outline" type="button" style="font-size:.66rem;padding:4px 8px;min-height:28px;white-space:nowrap" onclick="sendCourtCardSms('${key}','${String(item.current?.id||'')}','match_started','${String(item.court||'')}',0)">📨 문자</button>`:''}</div>`
      : '';
    const line = buildCourtCurrentSectionHtml({
      titleHtml:currentTitleHtml,
      phaseHtml:phaseChip,
      metaHtml:currentMetaHtml,
      actionsHtml:currentActionsHtml,
      empty:!info
    });
    const waitingList=[...(item.__visibleWaiting||[])];
    const waitingCardsHtml = waitingList.length ? `${waitingList.map((w,idx)=>{
              const wi=describeCourtBoardMatch(key,w);
              const priority=idx+1;
              const isManual=!!String(w.manualCourtTarget||'').trim() || !!w.manualSharedHold;
              const waitElapsed = buildElapsedMetaLine(w.courtAssignedAt||w.waitingFirstAt||'', 'waiting1');
              const metaEntries=[];
              // 대기카드: 대기시작 시각 1개만
              if(waitElapsed.clock) metaEntries.push({...waitElapsed, prefix:'대기시작'});
              const waitTheme=getCourtBoardPhaseColor(wi,w);
              const waitBadgeHtml=waitElapsed.badge
                ? `<span class="badge" style="font-size:.66rem;padding:3px 7px;background:${waitElapsed.badge.bg};color:${waitElapsed.badge.color};border:1px solid ${waitElapsed.badge.bd}">${waitElapsed.badge.text}</span>`
                : '';
              return buildCourtWaitingItemHtml({
                key,
                matchId:String(w.id),
                title:wi.title,
                label:[wi.label,'대기중'].filter(Boolean).join(' · '),
                metaHtml:renderElapsedMetaBlocks(metaEntries,waitTheme.fg),
                priority,
                theme:waitTheme,
                elapsedBadgeHtml:waitBadgeHtml,
                manual:isManual,
                canManage:canManageBracket(),
                targetCourt:String(item.court||''),
                escapeHtml:esc,
                escapeAttr:escAttr
              });
            }).join('')}` : '';
    const waitingHtml = buildCourtWaitingSectionHtml({
      count:waitingList.length,
      cardsHtml:waitingCardsHtml
    });
    return buildCourtDropZoneHtml({
      key,
      court:String(item.court),
      headerBadgeHtml:badge,
      currentSectionHtml:line,
      waitingSectionHtml:waitingHtml,
      borderColor:item.current?(currentTheme?.bd||'var(--border)'):'var(--border)',
      background:item.current?(currentTheme?.softBg||'#fff'):'#fff',
      escapeAttr:escAttr
    });
  }).join('') : buildNoCourtAssignedHtml();
  return buildCourtBoardFrameHtml({
    key,
    divisionLabel:dl(div),
    courtCount:processedItems.length,
    liveCount,
    waitingCount,
    sharedWaitingCount:sharedWaiting.length,
    emptyCount,
    collapsed:st.collapsed,
    sharedWaitingHtml,
    cardsHtml:cards,
    escapeAttr:escAttr
  });
}


// ── 조 코트 배정 UI 열림 상태(렌더 후에도 유지) ─────────────────────
let GC_OPEN = {}; // { [key:string]: Set<number> }
function _gcSet(key){ if(!GC_OPEN[key]) GC_OPEN[key]=new Set(); return GC_OPEN[key]; }
window.INDIV_GROUP_MATCH_OPEN = window.INDIV_GROUP_MATCH_OPEN || {};
function isIndividualGroupMatchesOpen(key, gi){
  return !!(window.INDIV_GROUP_MATCH_OPEN?.[key]?.[Number(gi)]);
}
function setIndividualGroupMatchesOpen(key, gi, isOpen){
  window.INDIV_GROUP_MATCH_OPEN = window.INDIV_GROUP_MATCH_OPEN || {};
  if(!window.INDIV_GROUP_MATCH_OPEN[key]) window.INDIV_GROUP_MATCH_OPEN[key] = {};
  window.INDIV_GROUP_MATCH_OPEN[key][Number(gi)] = !!isOpen;
}
function getGroupDisplayCourts(key, gi){
  const stored=((G.draws?.[key]?.groups?.[Number(gi)]?.courts)||[]).map(String).filter(Boolean);
  const live=(G.matches?.[key]||[])
    .filter(m=>m && m.phase==='group' && Number(m.group)===Number(gi))
    .flatMap(m=>getMatchCourtsForStatusBoard(key,m)||[])
    .map(String)
    .filter(Boolean);
  return [...new Set([...stored, ...live])];
}
function getFilteredGroupCourtAssignments(key, groupIndexes){
  const selectedCourts=(getSelectedCourtFilters(key)||[]).filter(Boolean).map(String);
  if(!selectedCourts.length) return {};
  const groups=(Array.isArray(groupIndexes) && groupIndexes.length)
    ? groupIndexes.map(v=>Number(v)).filter(v=>Number.isFinite(v))
    : ((G.draws?.[key]?.groups)||[]).map((_,i)=>i);
  if(!groups.length) return {};
  const sortedGroups=[...new Set(groups)].sort((a,b)=>a-b);
  const sortedCourts=[...new Set(selectedCourts)].sort((a,b)=>String(a).localeCompare(String(b),'ko'));
  const out={};
  const chunk=Math.max(1, Math.ceil(sortedGroups.length / Math.max(1, sortedCourts.length)));
  sortedGroups.forEach((gi, idx)=>{
    const court=sortedCourts[Math.min(sortedCourts.length-1, Math.floor(idx / chunk))] || sortedCourts[idx % sortedCourts.length];
    if(court) out[gi]=court;
  });
  return out;
}
function getIndividualGroupStartedCount(key, gi){
  try{
    return (G.matches[key]||[]).filter(m=>m && m.phase==='group' && Number(m.group)===Number(gi) && (m.winner!=null || Number(m.sc1||0)!==0 || Number(m.sc2||0)!==0)).length;
  }catch(e){ return 0; }
}
function getIndividualAutoAssignmentPlan(key){
  const groups=(G.draws[key]?.groups)||[];
  const targetGroups=groups.map((_,i)=>i).sort((a,b)=>a-b);
  // ⚠️ 보기 필터는 실제 자동 코트 배정에 영향을 주지 않는다.
  // 예선 자동 배정 원칙:
  // 1) 빈 코트가 있으면 각 조의 첫 경기를 서로 다른 코트에 우선 배정한다.
  // 2) 예선은 가능한 한 모든 잔여 경기를 코트 내부 대기열에 붙인다.
  // 3) 코트가 부족하면 여러 조를 한 코트에 묶되, 조 순서를 라운드로빈으로 섞는다.
  //    예) A조 1번vs2번 → B조 1번vs2번 → A조 승자vs3번 → B조 승자vs3번 ...
  // 4) 본선만 현재경기+대기1번 중심, 나머지는 공용대기로 유지한다.
  const pool=getIndividualAutoCourtPool(key).map(String).filter(Boolean);
  const plan={pool:[...new Set(pool)], fixed:{}, shared:[]};
  if(!targetGroups.length || !plan.pool.length) return plan;

  const courtCount=Math.max(1, plan.pool.length);
  const groupCount=targetGroups.length;
  const basePerCourt=Math.floor(groupCount / courtCount);
  const extraCourts=groupCount % courtCount;

  let cursor=0;
  for(let courtIdx=0; courtIdx<courtCount; courtIdx++){
    const court=plan.pool[courtIdx] || '';
    if(!court) continue;
    const takeCount=basePerCourt + (courtIdx < extraCourts ? 1 : 0);
    if(takeCount<=0) continue;
    const assignedGroups=targetGroups.slice(cursor, cursor + takeCount);
    cursor += takeCount;
    if(!assignedGroups.length) continue;
    if(!plan.fixed[court]) plan.fixed[court]=[];
    plan.fixed[court].push(...assignedGroups);
  }

  Object.entries(plan.fixed).forEach(([court, gis])=>{
    const perGroup=(gis||[]).map(gi=>getIndividualGroupAutoQueue(key,gi));
    const maxLen=Math.max(0,...perGroup.map(arr=>arr.length));
    for(let idx=0; idx<maxLen; idx++){
      perGroup.forEach((arr)=>{
        const item=arr[idx];
        if(!item) return;
        if(!plan.fixed.__items) plan.fixed.__items={};
        if(!plan.fixed.__items[court]) plan.fixed.__items[court]=[];
        plan.fixed.__items[court].push(item);
      });
    }
  });

  // 예선은 가능한 한 코트 내부 대기열에 모두 표시한다.
  // 공용대기는 코트가 전혀 없는 예외 상황에서만 사용한다.
  const remainingGroups=targetGroups.slice(cursor);
  remainingGroups.forEach((gi, sharedIdx)=>{
    const q=getIndividualGroupAutoQueue(key, gi);
    const targetCourt=plan.pool[sharedIdx % Math.max(1, plan.pool.length)] || '';
    q.forEach(item=>{
      if(!item) return;
      plan.shared.push({type:'shared', courts:[...plan.pool], item, __sharedCourtLabel:targetCourt});
    });
  });

  return plan;
}
function getIndividualAutoSharedWaitingItems(key){
  const held=(G.matches[key]||[]).filter(m=>m && m.winner==null && !!m.manualSharedHold && !String(m.manualCourtTarget||'').trim()).map(m=>({
    ...m,
    __sharedCourtLabel:'',
    __manualSharedHold:true
  }));
  const heldIds=new Set(held.map(m=>String(m.id)));
  const plan=getIndividualAutoAssignmentPlan(key);
  const auto=(plan.shared||[]).map(x=>{
    const item=x&&x.item;
    const m=item&&item.match ? item.match : item;
    if(!m) return null;
    if(heldIds.has(String(m.id))) return null;
    if(String(m.manualCourtTarget||'').trim()) return null;
    const courts=getMatchCourtsForStatusBoard(key,m)||[];
    if(courts.length) return null;
    const cloned={...m};
    if(item&&item.autoLabel) cloned.autoCourtLabel=item.autoLabel;
    if(item) cloned.__autoItem=item;
    if(x && x.__sharedCourtLabel) cloned.__sharedCourtLabel=String(x.__sharedCourtLabel||'');
    return cloned;
  }).filter(Boolean);
  const taken=new Set([...held, ...auto].map(m=>String(m?.id||'')));
  const mainQueue=getIndividualMainAutoQueue(key)
    .filter(x=>x && x.match)
    .filter(x=>!taken.has(String(x.match.id)) && !String(x.match.manualCourtTarget||'').trim() && !(getMatchCourtsForStatusBoard(key,x.match)||[]).length)
    .map((x,idx)=>({
      ...x.match,
      __sharedCourtLabel:'',
      __mainQueueOrder:Number(x.__queueOrder!=null ? x.__queueOrder : idx)
    }));
  const all=[...held, ...auto, ...mainQueue];
  const pool=(getIndividualAutoCourtPool(key)||[]).map(String).filter(Boolean);
  const courtIndexMap=new Map(pool.map((c,i)=>[c,i]));
  all.sort((a,b)=>{
    const ah=(a.__manualSharedHold||a.manualSharedHold)?0:1;
    const bh=(b.__manualSharedHold||b.manualSharedHold)?0:1;
    if(ah!==bh) return ah-bh;
    const ap=(String(a.phase||'')==='group'?0:1), bp=(String(b.phase||'')==='group'?0:1);
    if(ap!==bp) return ap-bp;
    const aq=Number.isFinite(Number(a.__mainQueueOrder)) ? Number(a.__mainQueueOrder) : null;
    const bq=Number.isFinite(Number(b.__mainQueueOrder)) ? Number(b.__mainQueueOrder) : null;
    if(aq!=null || bq!=null){
      if(aq==null) return 1;
      if(bq==null) return -1;
      if(aq!==bq) return aq-bq;
    }
    const ac=String(a.__sharedCourtLabel||a.manualCourtTarget||'').trim();
    const bc=String(b.__sharedCourtLabel||b.manualCourtTarget||'').trim();
    const ai=courtIndexMap.has(ac)?courtIndexMap.get(ac):999;
    const bi=courtIndexMap.has(bc)?courtIndexMap.get(bc):999;
    if(ai!==bi) return ai-bi;
    const ag=Number(a.group??999), bg=Number(b.group??999);
    if(ag!==bg) return ag-bg;
    const ar=Number(a.round||0), br=Number(b.round||0);
    if(ar!==br) return ar-br;
    const at=String(a.manualCourtPinnedAt||a.waitingFirstAt||a.courtAssignedAt||a.createdAt||'');
    const bt=String(b.manualCourtPinnedAt||b.waitingFirstAt||b.courtAssignedAt||b.createdAt||'');
    if(at!==bt) return at.localeCompare(bt);
    return String(a.id||'').localeCompare(String(b.id||''),'ko');
  });
  return all;
}

// ── 과거대회 요강(첨부 이미지) 내장 ─────────────────────────────────────
const HIST_GUIDES = {}; // 요강 이미지는 Firebase Storage에서 로드

// ── 요강 업로드(생성/편집) 임시 저장 ─────────────────────────────────────
let GUIDE_FILES_CREATE = []; // [{name,type,dataUrl}]
let GUIDE_FILES_EDIT = [];   // [{name,type,dataUrl}]


async function initFB(){
  if(_firebaseInitDone) return true;
  if(_firebaseInitPromise) return _firebaseInitPromise;
  _firebaseInitPromise=(async()=>{
    sl(true);
    try{
    await loadMeta();
    await loadRegistry(2026);

    // 대회 목록은 앱 전체에서 단 하나의 listener만 유지
    stopTournamentListSync();
    _tournamentsUnsub=onSnapshot(query(collection(db,'tournaments'),orderBy('createdAt','desc')), async s=>{
      G.tournaments=s.docs.map(d=>({id:d.id,...d.data()}));
      try{
        const activeTid = getRealtimeTargetTournamentId() || null;
        await syncTournamentDataForPage(getCurrentPageName(), activeTid, false);
      }catch(syncErr){
        console.warn('initial tournament sync failed', syncErr);
      }
      onDU();
    },e=>logSnapshotError('tournaments',e));

    // 선수기록은 로컬 캐시 우선
    loadPlayersFromLocalCache();
    popCF();
    G.log=[];
    G.drawHistories = G.drawHistories || {};

    sl(false);toast('🔥 연결 완료','success');
    if(window.renderHomeReg) window.renderHomeReg();
    refreshAppBranding();
    if(!window.__directorSessionPoller){
      window.__directorSessionPoller=setInterval(()=>{ try{ pollDirectorSessionVersion(); }catch(e){} }, 20000);
    }
      _firebaseInitDone=true;
      return true;
    }catch(e){
      sl(false);
      _firebaseInitDone=false;
      stopTournamentListSync();
      stopRealtimeTournamentSync();
      toast('연결 실패: '+e.message,'error');
      throw e;
    }finally{
      _firebaseInitPromise=null;
    }
  })();
  return _firebaseInitPromise;
}
if(!window.__kimhaeFirestoreCleanupBound){
  window.__kimhaeFirestoreCleanupBound=true;
  window.addEventListener('pagehide',()=>{
    try{ stopTournamentListSync(); }catch(e){}
    try{ stopRealtimeTournamentSync(); }catch(e){}
  },{capture:false});
}

async function loadMeta(){
  // 2026 명단 기준 클럽명 정규화 맵 (구 이름 → 새 이름)
  const CLUB_RENAME={'단디클럽':'단디','수로클럽':'수로','김해':'수로','어메이징':'아테','한울':'하모니','위드':'불사조','한별':'테사모','더블폴트':'로패','포티폴':'포티올','김해시시니어 클럽':'김해시니어','김해시시니어클럽':'김해시니어','김해시 시니어 클럽':'김해시니어','김해시 시니어클럽':'김해시니어','시니어클럽':'김해시니어'};
  try{
    const s=await getDoc(doc(db,'meta','config'));
    if(s.exists()){
      const d=s.data();
      // memberRegistry2026은 meta/config에서 제외 → memberRegistries/2026 에서만 관리
      const {memberRegistry2026:_mr, ...dClean}=d;
      G.meta={pw:'kimhae1234',regPw:'202601',memberRegistry2026:[],clubContacts:{},clubEmails:{},clubPasswords:{},clubPasswordCustom:{},clubDefaultRegions:{},adminFloatingNotice:'',adminFloatingNoticeEnabled:false,onlineOrderEnabled:false,operatorPw:'2026court',individualAutoCourtAssignEnabled:false,regSessionVersion:1,usePlayerRegistry:false,showAssociationDashboard:false,useFixedClubs:false,allowPublicTeamRegistration:false,allowPublicResultEntry:false,appTitle:'시합관리 시스템',...dClean};
      if(Array.isArray(d.clubs)){
        G.clubs=d.clubs.map(x=>String(x||'').trim()).filter(Boolean);
      }
      if(!Array.isArray(G.clubs)) G.clubs=[];
      if(!G.meta.adminPhone)G.meta.adminPhone='';
      if(!G.meta.regPw)G.meta.regPw='202601';
      if(!G.meta.clubContacts||typeof G.meta.clubContacts!=='object')G.meta.clubContacts={};
      if(!G.meta.clubEmails||typeof G.meta.clubEmails!=='object')G.meta.clubEmails={};
      if(!G.meta.clubPasswords||typeof G.meta.clubPasswords!=='object')G.meta.clubPasswords={};
      if(!G.meta.clubPasswordCustom||typeof G.meta.clubPasswordCustom!=='object')G.meta.clubPasswordCustom={};
      if(!G.meta.clubDefaultRegions||typeof G.meta.clubDefaultRegions!=='object')G.meta.clubDefaultRegions={};
      if(!G.meta.regDeadlineDt) G.meta.regDeadlineDt='';
      if(typeof G.meta.adminFloatingNotice!=='string') G.meta.adminFloatingNotice='';
      if(typeof G.meta.adminFloatingNoticeEnabled!=='boolean') G.meta.adminFloatingNoticeEnabled=!!G.meta.adminFloatingNoticeEnabled;
      if(typeof G.meta.onlineOrderEnabled!=='boolean') G.meta.onlineOrderEnabled=!!G.meta.onlineOrderEnabled;
      if(!G.meta.operatorPw) G.meta.operatorPw='2026court';
      if(typeof G.meta.individualAutoCourtAssignEnabled!=='boolean') G.meta.individualAutoCourtAssignEnabled=!!G.meta.individualAutoCourtAssignEnabled;
      if(typeof G.meta.usePlayerRegistry!=='boolean') G.meta.usePlayerRegistry=!!G.meta.usePlayerRegistry;
      if(typeof G.meta.showAssociationDashboard!=='boolean') G.meta.showAssociationDashboard=!!G.meta.showAssociationDashboard;
      if(typeof G.meta.useFixedClubs!=='boolean') G.meta.useFixedClubs=!!G.meta.useFixedClubs;
      if(typeof G.meta.allowPublicTeamRegistration!=='boolean') G.meta.allowPublicTeamRegistration=!!G.meta.allowPublicTeamRegistration;
      if(typeof G.meta.allowPublicResultEntry!=='boolean') G.meta.allowPublicResultEntry=!!G.meta.allowPublicResultEntry;
      if(!G.meta.appTitle) G.meta.appTitle='시합관리 시스템';
      if(!Number.isFinite(Number(G.meta.regSessionVersion))) G.meta.regSessionVersion=1;
      // 개인시합 기간 잠금 설정
      if(!G.meta.indivLockEnabled) G.meta.indivLockEnabled=false;
      if(!G.meta.indivLockStart) G.meta.indivLockStart='';
      if(!G.meta.indivLockEnd) G.meta.indivLockEnd='';
      markFbWriteCache('meta','config',{pw:G.meta.pw,regPw:(G.meta.regPw||'202601'),clubs:G.clubs,adminPhone:(G.meta.adminPhone||''),clubContacts:(G.meta.clubContacts||{}),clubEmails:(G.meta.clubEmails||{}),clubPasswords:(G.meta.clubPasswords||{}),clubPasswordCustom:(G.meta.clubPasswordCustom||{}),clubDefaultRegions:(G.meta.clubDefaultRegions||{}),regDeadlineDt:(G.meta.regDeadlineDt||''),adminFloatingNotice:(G.meta.adminFloatingNotice||''),adminFloatingNoticeEnabled:!!G.meta.adminFloatingNoticeEnabled,onlineOrderEnabled:!!G.meta.onlineOrderEnabled,operatorPw:(G.meta.operatorPw||'2026court'),individualAutoCourtAssignEnabled:!!G.meta.individualAutoCourtAssignEnabled,usePlayerRegistry:!!G.meta.usePlayerRegistry,showAssociationDashboard:!!G.meta.showAssociationDashboard,useFixedClubs:!!G.meta.useFixedClubs,allowPublicTeamRegistration:!!G.meta.allowPublicTeamRegistration,allowPublicResultEntry:!!G.meta.allowPublicResultEntry,appTitle:(G.meta.appTitle||'시합관리 시스템'),regSessionVersion:Number(G.meta.regSessionVersion||1),drawHistoryPolicyVersion:Number(G.meta.drawHistoryPolicyVersion||0),indivLockEnabled:!!G.meta.indivLockEnabled,indivLockStart:(G.meta.indivLockStart||''),indivLockEnd:(G.meta.indivLockEnd||'')});
    }else{
      await setDoc(doc(db,'meta','config'),{pw:'kimhae1234',regPw:'202601',clubs:G.clubs,adminPhone:'',clubContacts:{},clubPasswords:{},clubPasswordCustom:{},clubDefaultRegions:{},adminFloatingNotice:'',adminFloatingNoticeEnabled:false,onlineOrderEnabled:false,operatorPw:'2026court',individualAutoCourtAssignEnabled:false,regSessionVersion:1,drawHistoryPolicyVersion:0,usePlayerRegistry:false,showAssociationDashboard:false,useFixedClubs:false,allowPublicTeamRegistration:false,allowPublicResultEntry:false,appTitle:'시합관리 시스템'});
    }
  }catch(e){}

  // 현재 연도 명단을 memberRegistries/{REG_YEAR} 에서 로드
  try{
    const regSnap=await getDoc(doc(db,'memberRegistries',String(REG_YEAR)));
    if(regSnap.exists()){
      const members=regSnap.data().members||[];
      G.meta.memberRegistry2026=members; // 레거시 호환 유지
      if(!window.G_REGISTRY) window.G_REGISTRY={};
      G_REGISTRY[REG_YEAR]=members;
      if(!REGISTRY_YEARS_LOADED.includes(REG_YEAR)) REGISTRY_YEARS_LOADED.push(REG_YEAR);
    }else{
      G.meta.memberRegistry2026=[];
    }
  }catch(e){
    G.meta.memberRegistry2026=[];
  }
}
async function saveMeta(){
  // memberRegistry2026 제외 - saveRegistry(2026)으로만 관리 (1MB 초과 방지)
  const payload={
    pw:G.meta.pw,
    regPw:(G.meta.regPw||'202601'),
    clubs:G.clubs,
    adminPhone:(G.meta.adminPhone||''),
    clubContacts:(G.meta.clubContacts||{}),
    clubEmails:(G.meta.clubEmails||{}),
    clubPasswords:(G.meta.clubPasswords||{}),
    clubPasswordCustom:(G.meta.clubPasswordCustom||{}),
    clubDefaultRegions:(G.meta.clubDefaultRegions||{}),
    regDeadlineDt:(G.meta.regDeadlineDt||''),
    adminFloatingNotice:(G.meta.adminFloatingNotice||''),
    adminFloatingNoticeEnabled:!!G.meta.adminFloatingNoticeEnabled,
    onlineOrderEnabled:!!G.meta.onlineOrderEnabled,
    operatorPw:(G.meta.operatorPw||'2026court'),
    individualAutoCourtAssignEnabled:!!G.meta.individualAutoCourtAssignEnabled,
    usePlayerRegistry:!!G.meta.usePlayerRegistry,
    showAssociationDashboard:!!G.meta.showAssociationDashboard,
    useFixedClubs:!!G.meta.useFixedClubs,
    allowPublicTeamRegistration:!!G.meta.allowPublicTeamRegistration,
    allowPublicResultEntry:!!G.meta.allowPublicResultEntry,
    appTitle:(G.meta.appTitle||'시합관리 시스템'),
    regSessionVersion:Number(G.meta.regSessionVersion||1),
    drawHistoryPolicyVersion:Number(G.meta.drawHistoryPolicyVersion||0),
    indivLockEnabled:!!G.meta.indivLockEnabled,
    indivLockStart:(G.meta.indivLockStart||''),
    indivLockEnd:(G.meta.indivLockEnd||'')
  };
  try{
    if(isSameFbWrite('meta','config',payload)) return;
    await setDoc(doc(db,'meta','config'), payload);
    markFbWriteCache('meta','config',payload);
  }catch(e){
    console.error('saveMeta 오류:', e);
    throw e;
  }
}

// ─── 개인시합 기간 김해시 UI 잠금 ────────────────────────────────────────
function isIndivLockActive(){
  if(!G.meta.indivLockEnabled) return false;
  const now=new Date();
  const start=G.meta.indivLockStart ? new Date(G.meta.indivLockStart) : null;
  const end=G.meta.indivLockEnd   ? new Date(G.meta.indivLockEnd)   : null;
  if(start && now < start) return false;
  if(end   && now > end)   return false;
  return true;
}

function applyIndivLock(){
  // 탭 숨김은 refreshRoleUI()에서 통합 처리
  // 여기서는 카드류(협회 현황, 등록선수 버튼)만 담당
  const isAdmin = document.body.classList.contains('admin-mode');
  const shouldHide = isIndivLockActive() && !isAdmin;

  // 홈: 협회 현황 카드
  document.querySelectorAll('.home-status-card').forEach(el=>{
    el.style.display = shouldHide ? 'none' : '';
  });

  // 홈: 등록선수 현황 버튼
  const regCard = document.getElementById('homeRegViewerCard');
  if(regCard) regCard.style.display = shouldHide ? 'none' : '';

  // 잠금 중 대상 탭에 있으면 홈으로 이동
  if(shouldHide){
    const lockPages = ['tournament','players'];
    const curPage = document.querySelector('.nav-tab.active')?.dataset?.page;
    if(curPage && lockPages.includes(curPage)){
      try{ showPage('home'); }catch(e){}
    }
  }
}
window.applyIndivLock = applyIndivLock;
async function purgeLegacyDrawHistoryOnce(){
  // 운영 안정화: 추첨 기록 자동 삭제를 더 이상 실행하지 않습니다.
  return;
}
async function fbSet(col,key,data){await setDoc(doc(db,col,key),{...data,_u:new Date().toISOString()});}

/** ===== 문서형 구조(마이그레이션): registrations / matches ===== */
function _k2td(key){const i=key.lastIndexOf('_');return {tid:key.slice(0,i), div:key.slice(i+1)};}

function getMainRoundLabelByRoundIndex(round, key){
  try{
    const mains=(G.matches?.[key]||[]).filter(m=>String(m?.phase||'')==='main');
    if(!mains.length){
      const r=Number(round||0);
      return r===0 ? '결승' : '본선';
    }
    const rounds=[...new Set(mains.map(m=>Number(m?.round||0)).filter(Number.isFinite))].sort((a,b)=>a-b);
    const idx=rounds.indexOf(Number(round||0));
    const total=rounds.length;
    if(idx<0) return '본선';
    if(idx===total-1) return '결승';
    if(idx===total-2 && total>1) return '준결승';
    return `${Math.pow(2,total-idx)}강`;
  }catch(e){
    return '본선';
  }
}

function _rid(){return 'r_'+Math.random().toString(36).slice(2,10);}
function _mid(){return 'm_'+Math.random().toString(36).slice(2,10);}

// Firestore no-op write 방지용 안정 해시
const __FB_WRITE_CACHE = { meta:'', draws:{}, teams:{}, matches:{} };
function stableStringify(value){
  const seen = new WeakSet();
  const walk = (v)=>{
    if(v===null || typeof v!=='object') return v;
    if(seen.has(v)) return null;
    seen.add(v);
    if(Array.isArray(v)) return v.map(walk);
    const out={};
    Object.keys(v).sort().forEach(k=>{ out[k]=walk(v[k]); });
    return out;
  };
  try{ return JSON.stringify(walk(value)); }catch(e){ return JSON.stringify(value); }
}
function markFbWriteCache(kind, key, payload){
  try{
    if(kind==='meta') __FB_WRITE_CACHE.meta = stableStringify(payload);
    else if(__FB_WRITE_CACHE[kind]) __FB_WRITE_CACHE[kind][key] = stableStringify(payload);
  }catch(e){}
}
function isSameFbWrite(kind, key, payload){
  try{
    const next = stableStringify(payload);
    if(kind==='meta') return __FB_WRITE_CACHE.meta === next;
    return (__FB_WRITE_CACHE[kind]?.[key]||'') === next;
  }catch(e){ return false; }
}
function normalizeRegistrationPayloadForHash(payload){
  const x={...payload};
  delete x.updatedAt;
  return x;
}
function normalizeMatchPayloadForHash(payload){
  const x={...payload};
  delete x.updatedAt;
  delete x.createdAt;
  return x;
}


async function stD(k){
  const payload=G.draws[k]||{};
  if(isSameFbWrite('draws', k, payload)) return;
  await fbSet('draws',k,payload);
  markFbWriteCache('draws', k, payload);
  try{ cacheTournamentBundleFromMemory(_k2td(k).tid); }catch(e){}
} // draws는 기존처럼 tid_div 문서 유지

async function stT(key){
  const {tid,div}=_k2td(key);
  const cur=G.teams[key]||[];
  cur.forEach(t=>{ if(!t._id) t._id=_rid(); });
  const curIds=new Set(cur.map(t=>t._id));
  const prevIds=new Set((G._regIdsByKey && G._regIdsByKey[key]) ? G._regIdsByKey[key] : []);
  const toDel=[...prevIds].filter(id=>!curIds.has(id));

  const docsForHash=cur.map(t=>normalizeRegistrationPayloadForHash({
    tournamentId: tid,
    division: div,
    club: t.club,
    players: t.players||[],
    registeredAt: t.registeredAt || '',
    ...(t.tournamentType ? {tournamentType: t.tournamentType} : {}),
    ...(t.editPin ? {editPin: t.editPin} : {}),
    ...(Array.isArray(t.individualPlayers) ? {individualPlayers: t.individualPlayers} : {}),
    ...(t.clubTokens ? {clubTokens: t.clubTokens} : {}),
    ...(t.pairLabel !== undefined ? {pairLabel: t.pairLabel} : {}),
    ...(t.entryLabel !== undefined ? {entryLabel: t.entryLabel} : {}),
    ...(t.note !== undefined ? {note: t.note} : {}),
    ...(t.doublesCount !== undefined ? {doublesCount: t.doublesCount} : {}),
    ...(t.mainPlayerCount !== undefined ? {mainPlayerCount: t.mainPlayerCount} : {}),
    ...(t.tiebreakAge !== undefined ? {tiebreakAge: Number(t.tiebreakAge||0)||0} : {})
  }));
  const hashPayload={ docs: docsForHash, ids:[...curIds].sort(), deleted:[...toDel].sort() };
  if(isSameFbWrite('teams', key, hashPayload)) return;

  const batch=writeBatch(db);
  cur.forEach(t=>{
    const docId=t._id;
    const payload={
      tournamentId: tid,
      division: div,
      club: t.club,
      players: t.players||[],
      registeredAt: t.registeredAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(t.tournamentType ? {tournamentType: t.tournamentType} : {}),
      ...(t.editPin ? {editPin: t.editPin} : {}),
      ...(Array.isArray(t.individualPlayers) ? {individualPlayers: t.individualPlayers} : {}),
      ...(t.clubTokens ? {clubTokens: t.clubTokens} : {}),
      ...(t.pairLabel !== undefined ? {pairLabel: t.pairLabel} : {}),
      ...(t.entryLabel !== undefined ? {entryLabel: t.entryLabel} : {}),
      ...(t.note !== undefined ? {note: t.note} : {}),
      ...(t.doublesCount !== undefined ? {doublesCount: t.doublesCount} : {}),
      ...(t.mainPlayerCount !== undefined ? {mainPlayerCount: t.mainPlayerCount} : {}),
      ...(t.tiebreakAge !== undefined ? {tiebreakAge: Number(t.tiebreakAge||0)||0} : {})
    };
    batch.set(doc(db,'registrations',docId), payload, {merge:true});
  });
  toDel.forEach(id=>batch.delete(doc(db,'registrations',id)));
  await batch.commit();
  markFbWriteCache('teams', key, hashPayload);
  if(!G._regIdsByKey) G._regIdsByKey={};
  G._regIdsByKey[key]=[...curIds];
  try{ cacheTournamentBundleFromMemory(tid); }catch(e){}
}

async function stM(key){
  const {tid,div}=_k2td(key);
  const cur=G.matches[key]||[];
  cur.forEach(x=>{ if(!x._id) x._id=_mid(); });
  const curIds=new Set(cur.map(x=>x._id));
  const prevIds=new Set((G._matchIdsByKey && G._matchIdsByKey[key]) ? G._matchIdsByKey[key] : []);
  const toDel=[...prevIds].filter(id=>!curIds.has(id));

  const docsForHash=cur.map(x=>{
    const payload={...x};
    delete payload._id;
    payload.tournamentId = tid;
    payload.division = div;
    return normalizeMatchPayloadForHash(payload);
  });
  const hashPayload={ docs: docsForHash, ids:[...curIds].sort(), deleted:[...toDel].sort() };
  if(isSameFbWrite('matches', key, hashPayload)) return;

  const batch=writeBatch(db);
  cur.forEach(x=>{
    const docId=x._id;
    const payload={...x};
    delete payload._id;
    payload.tournamentId = tid;
    payload.division = div;
    payload.updatedAt = new Date().toISOString();
    if(!payload.createdAt) payload.createdAt = new Date().toISOString();
    batch.set(doc(db,'matches',docId), payload, {merge:true});
  });
  toDel.forEach(id=>batch.delete(doc(db,'matches',id)));
  await batch.commit();
  markFbWriteCache('matches', key, hashPayload);
  if(!G._matchIdsByKey) G._matchIdsByKey={};
  G._matchIdsByKey[key]=[...curIds];
  try{ cacheTournamentBundleFromMemory(_k2td(key).tid); }catch(e){}
}

async function persistSingleMatchDoc(key, matchObj){
  const {tid,div}=_k2td(key);
  if(!matchObj) return;
  if(!matchObj._id) matchObj._id=_mid();
  const payload={...matchObj};
  delete payload._id;
  payload.tournamentId=tid;
  payload.division=div;
  payload.updatedAt=new Date().toISOString();
  if(!payload.createdAt) payload.createdAt=payload.updatedAt;
  await setDoc(doc(db,'matches',matchObj._id), payload, {merge:true});
  const cur=G.matches[key]||[];
  const docsForHash=cur.map(x=>{
    const cloned={...x};
    delete cloned._id;
    cloned.tournamentId=tid;
    cloned.division=div;
    return normalizeMatchPayloadForHash(cloned);
  });
  const ids=[...new Set(cur.map(x=>x._id).filter(Boolean))].sort();
  markFbWriteCache('matches', key, {docs:docsForHash, ids, deleted:[]});
  if(!G._matchIdsByKey) G._matchIdsByKey={};
  G._matchIdsByKey[key]=ids;
  try{ cacheTournamentBundleFromMemory(tid); }catch(e){}
}
const __PLAYER_WRITE_QUEUE = new Set();
let __PLAYER_WRITE_TIMER = null;
async function flushQueuedPlayers(){
  if(!__PLAYER_WRITE_QUEUE.size) return;
  const keys=[...__PLAYER_WRITE_QUEUE];
  __PLAYER_WRITE_QUEUE.clear();
  const batch=writeBatch(db);
  keys.forEach(k=>{
    const pk=pKeyParse(k); const pureName=cleanName(pk.name||k);
    if(!G.players[k]) return;
    batch.set(doc(db,'players',k.replace(/[\/\.#\$\[\]]/g,'_')),{...G.players[k],key:k,name:pureName,club:pk.club||''},{merge:true});
  });
  await batch.commit();
}
function queuePlayerFlush(delay=12000){
  if(__PLAYER_WRITE_TIMER) clearTimeout(__PLAYER_WRITE_TIMER);
  __PLAYER_WRITE_TIMER=setTimeout(()=>{ flushQueuedPlayers().catch(e=>console.warn('player flush failed',e)); }, delay);
}
function enqueuePlayerPersist(keys=[], delay=12000){
  (keys||[]).forEach(k=>{ if(k && G.players[k]) __PLAYER_WRITE_QUEUE.add(k); });
  queuePlayerFlush(delay);
}
window.addEventListener('beforeunload', ()=>{ try{ if(__PLAYER_WRITE_QUEUE.size) flushQueuedPlayers(); }catch(e){} });
document.addEventListener('visibilitychange', ()=>{
  try{
    if(document.visibilityState==='hidden' && __PLAYER_WRITE_QUEUE.size){
      flushQueuedPlayers().catch(()=>{});
    }
  }catch(e){}
});
function cacheTournamentBundleFromMemory(tid){
  if(!tid) return;
  const payload={
    regs:Object.entries(G.teams||{}).filter(([k])=>_k2td(k).tid===tid).flatMap(([k,arr])=>(arr||[]).map(t=>{const o={...t}; o.division=_k2td(k).div; return o;})),
    matches:Object.entries(G.matches||{}).filter(([k])=>_k2td(k).tid===tid).flatMap(([k,arr])=>(arr||[]).map(m=>{const o={...m}; o.division=_k2td(k).div; return o;})),
    draws:Object.entries(G.draws||{}).filter(([k])=>_k2td(k).tid===tid).map(([k,v])=>({id:k,...v}))
  };
  saveTournamentBundleCache(tid,payload);
}
async function stP(k){try{const pk=pKeyParse(k);const pureName=cleanName(pk.name||k);await setDoc(doc(db,'players',k.replace(/[\\/\\.#\\$\\[\\]]/g,'_')),{...G.players[k],key:k,name:pureName,club:pk.club||''});}catch(e){}}
async function fbLog(t,i='📌'){ return; }

function onDU(){
  // 새로고침 후 관리자 세션 복원
  if(!AD && localStorage.getItem('adm')==='1'){
    applyAdminUI();
  }
  // 팀등록 세션 복원
  if(!OP && localStorage.getItem('op')==='1' && !AD){
    OP=true;
    refreshRoleUI();
  }
  if(!REG && localStorage.getItem('reg')==='1'){
    if(isDirectorSessionValid()){
      REG=true;
      REG_CLUB = localStorage.getItem('reg_club')||'';
      ge('regToggleBtn') && (ge('regToggleBtn').textContent='로그아웃');
      ge('regToggleBtn') && (ge('regToggleBtn').style.background='#388e3c');
      const _badge = ge('regLoginBadge');
      if(_badge){
        _badge.textContent = REG_CLUB ? `${REG_CLUB} 경기이사` : '경기이사';
        _badge.style.display='inline';
      }
    }else{
      forceDirectorLogoutLocal('관리자가 다시 로그인하도록 설정했습니다. 경기이사 비밀번호로 다시 로그인해 주세요.');
    }
  }
  applyRegLoginUI();
  if(REG && REG_CLUB) updateMyClubUI(); // 새로고침 후 내 클럽 UI 복원

  try{ upDash(); }catch(e){ console.warn('onDU upDash failed', e); }
  const p=document.querySelector('.nav-tab.active')?.dataset.page;
  if(p==='tournament'){ try{ renderTL(); }catch(e){ console.warn('onDU renderTL failed', e); } }
  if(p==='register'){
    try{ popSel(); }catch(e){ console.warn('onDU popSel(register) failed', e); }
    try{ renderRL(); }catch(e){ console.warn('onDU renderRL failed', e); }
  }
  if(p==='bracket'){ try{ renderBracket(); }catch(e){ console.warn('onDU renderBracket failed', e); } }
  if(p==='ranking'){ try{ renderRanking(); }catch(e){ console.warn('onDU renderRanking failed', e); } }
  try{ popSel(); }catch(e){ console.warn('onDU popSel failed', e); }
  renderFloatingNotice();
  refreshAppBranding();
  updateOperationSticky();
  try{ applyIndivLock(); }catch(e){}
}
function sl(s){let el=ge('gLd');if(!el){el=document.createElement('div');el.id='gLd';el.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;height:3px;background:linear-gradient(90deg,#1565c0,#f5a623);animation:ldA 1.2s ease-in-out infinite;';document.head.insertAdjacentHTML('beforeend',``);document.body.appendChild(el);}el.style.display=s?'block':'none';}




function toggleLoginMenu(ev){
  try{ ev?.stopPropagation?.(); }catch(e){}
  const wrap=ge('loginMenuWrap');
  if(!wrap) return;
  wrap.classList.toggle('open');
}
function closeLoginMenu(){
  const wrap=ge('loginMenuWrap');
  if(wrap) wrap.classList.remove('open');
}
document.addEventListener('click',(e)=>{
  const wrap=ge('loginMenuWrap');
  if(wrap && !wrap.contains(e.target)) wrap.classList.remove('open');
  document.querySelectorAll('.js-mini-menu.open').forEach(node=>{
    if(!node.contains(e.target)){ node.classList.remove('open'); }
  });
});
window.toggleLoginMenu = toggleLoginMenu;
window.closeLoginMenu = closeLoginMenu;

/* ── 포탈 드롭다운: body에 직접 fixed 패널을 띄워 overflow/z-index 문제 완전 해결 ── */
(function(){
  let _portalEl = null;       // body에 붙은 포탈 div
  let _activeWrapId = null;   // 현재 열린 wrap ID
  let _scrollHandler = null;

  function getPortal(){
    if(!_portalEl){
      _portalEl = document.createElement('div');
      _portalEl.id = '__miniMenuPortal__';
      _portalEl.style.cssText = [
        'position:fixed','z-index:99999','display:none',
        'flex-direction:column','gap:6px','padding:8px',
        'background:rgba(9,18,37,.98)',
        'border:1px solid rgba(255,255,255,.12)',
        'border-radius:14px','box-shadow:0 14px 32px rgba(0,0,0,.28)',
        'min-width:184px','max-width:calc(100vw - 16px)','max-height:calc(100vh - 110px)','overflow-y:auto',
        'font-family:inherit'
      ].join(';');
      document.body.appendChild(_portalEl);

      // 포탈 외부 클릭 시 닫기
      document.addEventListener('click', function(e){
        if(!_portalEl || _portalEl.style.display==='none') return;
        const wrap = _activeWrapId ? document.getElementById(_activeWrapId) : null;
        if(!_portalEl.contains(e.target) && (!wrap || !wrap.contains(e.target))){
          _closePortal();
        }
      }, true);

      // 스크롤/리사이즈 시 위치 재계산 또는 닫기
      window.addEventListener('resize', _closePortal);
    }
    return _portalEl;
  }

  function _positionPortal(btn){
    const portal = getPortal();
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const isMobile = vw <= 768;
    const sideGap = isMobile ? 8 : 6;
    const bottomSafe = isMobile ? 86 : 10;
    const desiredW = isMobile ? Math.min(Math.max(rect.width, 176), vw - sideGap * 2) : Math.min(Math.max(rect.width, 184), 220);
    portal.style.width = desiredW + 'px';
    portal.style.minWidth = desiredW + 'px';
    portal.style.maxWidth = `calc(100vw - ${sideGap*2}px)`;
    portal.style.maxHeight = `calc(100vh - ${bottomSafe + 24}px)`;

    const panelW = Math.min(desiredW, vw - sideGap * 2);
    const panelH = portal.offsetHeight || portal.scrollHeight || 180;

    let left = isMobile ? rect.left : rect.right - panelW;
    if(left < sideGap) left = sideGap;
    if(left + panelW > vw - sideGap) left = vw - panelW - sideGap;

    let top = rect.bottom + 6;
    if(top + panelH > vh - bottomSafe) top = rect.top - panelH - 6;
    if(top < 6) top = Math.min(rect.bottom + 6, vh - panelH - bottomSafe);

    portal.style.left = Math.max(sideGap, left) + 'px';
    portal.style.top  = Math.max(6, top)  + 'px';
  }

  function _closePortal(){
    if(!_portalEl) return;
    _portalEl.style.display = 'none';
    _portalEl.innerHTML = '';
    if(_activeWrapId){
      const wrap = document.getElementById(_activeWrapId);
      if(wrap) wrap.classList.remove('open');
    }
    _activeWrapId = null;
    if(_scrollHandler){
      window.removeEventListener('scroll', _scrollHandler, true);
      _scrollHandler = null;
    }
  }

  function toggleMiniMenu(ev, wrapId){
    try{ ev?.stopPropagation?.(); }catch(e){}
    const wrap = document.getElementById(wrapId);
    if(!wrap) return;

    // 이미 같은 메뉴 열려있으면 닫기
    if(_activeWrapId === wrapId){
      _closePortal();
      return;
    }

    // 다른 메뉴 닫기
    _closePortal();

    // 원본 panel 내용을 포탈로 복사
    const origPanel = wrap.querySelector('.login-menu-panel');
    if(!origPanel) return;

    const portal = getPortal();
    portal.innerHTML = origPanel.innerHTML;

    // 스타일 복사 (min-width 등 inline style)
    const origStyle = origPanel.getAttribute('style') || '';
    if(origStyle) portal.setAttribute('style', portal.getAttribute('style') + ';' + origStyle);

    // btn-sm login-menu-item 스타일 보정
    portal.querySelectorAll('.login-menu-item').forEach(btn=>{
      btn.style.cssText = (btn.getAttribute('style')||'') +
        ';width:100%;display:flex;align-items:center;justify-content:flex-start;' +
        'padding:7px 10px;font-size:.74rem;min-height:34px;border-radius:10px;' +
        'cursor:pointer;font-family:inherit;font-weight:700;line-height:1.25;white-space:normal;word-break:keep-all;';
    });

    portal.style.display = 'flex';
    _activeWrapId = wrapId;
    wrap.classList.add('open');

    // 버튼 위치 기준으로 패널 위치 설정
    const triggerBtn = wrap.querySelector('button');
    if(triggerBtn){
      // 렌더링 후 높이 계산
      requestAnimationFrame(()=>{ _positionPortal(triggerBtn); });
    }

    // 스크롤 시 닫기
    _scrollHandler = _closePortal;
    window.addEventListener('scroll', _scrollHandler, true);
  }

  function closeMiniMenu(wrapId){
    if(_activeWrapId === wrapId || !wrapId) _closePortal();
  }

  function closeAllMiniMenus(){
    _closePortal();
  }

  window.toggleMiniMenu    = toggleMiniMenu;
  window.closeMiniMenu     = closeMiniMenu;
  window.closeAllMiniMenus = closeAllMiniMenus;
  window._closePortalMenu  = _closePortal;
})();

function toggleBracketSaveMenu(ev){
  toggleMiniMenu(ev,'bracketSaveMenuWrap');
}
function closeBracketSaveMenu(){
  closeMiniMenu('bracketSaveMenuWrap');
}
window.toggleBracketSaveMenu = toggleBracketSaveMenu;
window.closeBracketSaveMenu = closeBracketSaveMenu;
function executeBracketSaveAction(ev, action){
  try{ ev?.stopPropagation?.(); }catch(e){}
  closeBracketSaveMenu();
  const run = ()=>{
    try{
      if(action==='image') return bracketToImage();
      if(action==='pdf') return bracketToPDF();
      if(action==='prelim_print') return exportPrelimSheet();
      if(action==='prelim_image') return exportPrelimImage();
    }catch(err){
      console.error(err);
      toast('저장 기능 실행 중 오류가 발생했습니다','error');
    }
  };
  // 메뉴 닫힘과 실행 충돌 방지
  setTimeout(run, 0);
}
window.executeBracketSaveAction = executeBracketSaveAction;

function isOperatorMode(){ return !!(OP && !AD); }

const INDIV_OPERATOR_FILTERS = {};
const INDIV_FILTER_STORAGE_KEY = 'kimhae_indiv_operator_filters_v1';
// 보기 필터는 화면 렌더링 전용이다. 실제 코트 배정 허용 범위, 자동 코트 배정,
// 수동 코트 이동, 저장 데이터에는 절대 영향을 주지 않는다.

function loadIndivOperatorFilters(){
  try{
    // 운영 필터는 기본값을 항상 "전체 보기"로 시작한다.
    // 이전 선택을 로컬에 남겨도 다음 진입 시 자동 복원하지 않는다.
    localStorage.removeItem(INDIV_FILTER_STORAGE_KEY);
  }catch(e){}
}
function persistIndivOperatorFilters(){
  try{
    const clean={};
    Object.keys(INDIV_OPERATOR_FILTERS||{}).forEach(key=>{
      const src=INDIV_OPERATOR_FILTERS[key]||{};
      clean[key]={
        groups:Array.isArray(src.groups)?src.groups.map(v=>String(v)):[],
        courts:Array.isArray(src.courts)?src.courts.map(v=>String(v)):[],
        mainMatches:Array.isArray(src.mainMatches)?src.mainMatches.map(v=>String(v)):[],
        mainBlocks:Array.isArray(src.mainBlocks)?src.mainBlocks.map(v=>String(v)):[]
      };
    });
    localStorage.setItem(INDIV_FILTER_STORAGE_KEY, JSON.stringify(clean));
  }catch(e){}
}
loadIndivOperatorFilters();
function ensureOperatorFilters(key){
  if(!INDIV_OPERATOR_FILTERS[key]) INDIV_OPERATOR_FILTERS[key]={groups:[],courts:[],mainMatches:[],mainBlocks:[]};
  const f=INDIV_OPERATOR_FILTERS[key];
  if(!Array.isArray(f.groups)) f.groups=[];
  if(!Array.isArray(f.courts)) f.courts=[];
  if(!Array.isArray(f.mainMatches)) f.mainMatches=[];
  if(!Array.isArray(f.mainBlocks)) f.mainBlocks=[];
  return f;
}
function getIndivOperatorGroupFilter(key){
  return ensureOperatorFilters(key).groups;
}
function toggleIndivOperatorGroupFilter(key, value){
  const f=ensureOperatorFilters(key);
  const v=String(value);
  if(v==='__ALL__') f.groups=[];
  else f.groups = f.groups.includes(v) ? f.groups.filter(x=>x!==v) : [...f.groups, v];
  persistIndivOperatorFilters();
  renderBracket();
}
function toggleIndivOperatorCourtFilter(key, value){
  const f=ensureOperatorFilters(key);
  const v=String(value);
  if(v==='__ALL__') f.courts=[];
  else f.courts = f.courts.includes(v) ? f.courts.filter(x=>x!==v) : [...f.courts, v];
  persistIndivOperatorFilters();
  renderBracket();
}
function toggleIndivOperatorMainMatchFilter(key, value){
  const f=ensureOperatorFilters(key);
  const v=String(value);
  if(v==='__ALL__') f.mainMatches=[];
  else f.mainMatches = f.mainMatches.includes(v) ? f.mainMatches.filter(x=>x!==v) : [...f.mainMatches, v];
  persistIndivOperatorFilters();
  renderBracket();
}
function toggleIndivOperatorMainBlockFilter(key, value){
  const f=ensureOperatorFilters(key);
  const v=String(value);
  if(v==='__ALL__') f.mainBlocks=[];
  else f.mainBlocks = f.mainBlocks.includes(v) ? f.mainBlocks.filter(x=>x!==v) : [...f.mainBlocks, v];
  persistIndivOperatorFilters();
  renderBracket();
}
function clearIndivOperatorFilters(key){
  INDIV_OPERATOR_FILTERS[key]={groups:[],courts:[],mainMatches:[],mainBlocks:[]};
  persistIndivOperatorFilters();
  renderBracket();
}
window.toggleIndivOperatorGroupFilter = toggleIndivOperatorGroupFilter;
window.toggleIndivOperatorCourtFilter = toggleIndivOperatorCourtFilter;
window.toggleIndivOperatorMainMatchFilter = toggleIndivOperatorMainMatchFilter;
window.toggleIndivOperatorMainBlockFilter = toggleIndivOperatorMainBlockFilter;
window.clearIndivOperatorFilters = clearIndivOperatorFilters;

let INDIV_FILTER_PICKER_STATE = null;
function getIndivFilterHeading(){
  return (AD || OP) ? '🎯 해당 경기·코트·본선구간 골라 운영하기' : '🎯 해당 경기·코트·본선구간 골라보기';
}
function getIndivFilterSubheading(){
  return (AD || OP)
    ? '조, 코트, 본선 구간은 중복 선택 가능합니다. 이 설정은 보기용이며 실제 코트 배정·자동배정·저장 데이터는 바꾸지 않습니다.'
    : '보고 싶은 조, 코트, 본선 구간만 골라서 화면을 간단하게 볼 수 있습니다.';
}
function closeIndivFilterPicker(){
  INDIV_FILTER_PICKER_STATE = null;
  const existing = document.getElementById('indivFilterPickerOverlay');
  if(existing) existing.remove();
}
function renderIndivFilterPicker(){
  const state = INDIV_FILTER_PICKER_STATE;
  const body = document.getElementById('indivFilterPickerBody');
  if(!state || !body) return;
  const draw = G.draws[state.key] || {};
  const groups = Array.isArray(draw.groups) ? draw.groups : [];
  const temp = state.temp || {groups:[], courts:[], mainMatches:[], mainBlocks:[]};
  const groupButtons = groups.map((grp, gi)=>{
    const active = temp.groups.includes(String(gi));
    const courts = (grp.courts||[]).filter(Boolean);
    return `<button class="btn ${active?'btn-primary':'btn-outline'}" style="padding:7px 12px;font-size:.8rem;white-space:nowrap;${courts.length?'':'opacity:.78'}" onclick="toggleTempIndivFilter('groups','${gi}')">${grpLabel(gi)}${courts.length?` · ${courts.join('/')}`:' · 미배정'}</button>`;
  }).join('');
  const courtButtons = getCourtGroupsForTournamentOrKey(state.key, true).map(group=>{
    const rows=(group.courts||[]).map(court=>{
      const active = temp.courts.includes(String(court));
      return `<button class="btn ${active?'btn-primary':'btn-outline'}" style="padding:7px 12px;font-size:.8rem;white-space:nowrap" onclick="toggleTempIndivFilter('courts',${JSON.stringify(''+court).replace(/"/g,'&quot;')})">🎾 ${court}</button>`;
    }).join('');
    return `<div style="padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:#fff">
      <div style="font-size:.78rem;font-weight:900;color:var(--primary-dark);margin-bottom:8px">📍 ${group.title}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${rows}</div>
    </div>`;
  }).join('');
  const mainBlocks = getMainBracketBlockList(state.key);
  const mainBlockButtons = mainBlocks.map(item=>{
    const active = (temp.mainBlocks||[]).includes(String(item.id));
    const slotLabel = `${item.startSlot+1}~${item.endSlot+1} 드로`;
    return `<button class="btn ${active?'btn-primary':'btn-outline'}" style="padding:7px 12px;font-size:.8rem;white-space:nowrap" onclick="toggleTempIndivFilter('mainBlocks','${item.id}')">${item.label} · ${slotLabel}</button>`;
  }).join('');
  body.innerHTML = `
    <div style="display:grid;gap:12px">
      <div>
        <div style="font-size:.78rem;font-weight:900;color:var(--primary-dark);margin-bottom:7px">조 선택</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">${groupButtons || '<span style="font-size:.8rem;color:var(--text3)">조가 없습니다</span>'}</div>
      </div>
      <div>
        <div style="font-size:.78rem;font-weight:900;color:var(--primary-dark);margin-bottom:7px">코트 선택</div>
        <div style="display:flex;flex-direction:column;gap:8px;max-height:280px;overflow:auto;padding-right:4px">${courtButtons || '<span style="font-size:.8rem;color:var(--text3)">코트가 없습니다</span>'}</div>
      </div>
      ${mainBlockButtons ? `<div>
        <div style="font-size:.78rem;font-weight:900;color:var(--primary-dark);margin-bottom:7px">본선 위치 선택</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:180px;overflow:auto;padding-right:4px">${mainBlockButtons}</div>
        <div style="margin-top:6px;font-size:.72rem;color:var(--text3);line-height:1.5">본선은 경기 번호가 아니라 대진표 위치 기준으로 나눠서 봅니다. 여러 구간을 함께 선택할 수 있습니다.</div>
      </div>` : ''}
    </div>`;
  const summary = document.getElementById('indivFilterPickerSummary');
  if(summary){
    summary.innerHTML = `선택 조 <b>${temp.groups.length}</b> · 선택 코트 <b>${temp.courts.length}</b>${getMainBracketBlockList(state.key).length ? ` · 선택 본선구간 <b>${(temp.mainBlocks||[]).length}</b>` : ''}`;
  }
}
function openIndivFilterPicker(key){
  closeIndivFilterPicker();
  const current = ensureOperatorFilters(key);
  INDIV_FILTER_PICKER_STATE = {
    key,
    temp: {
      groups: [...current.groups],
      courts: [...current.courts],
      mainMatches: [...current.mainMatches],
      mainBlocks: [...(current.mainBlocks||[])],
    }
  };
  const overlay = document.createElement('div');
  overlay.id = 'indivFilterPickerOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `
    <div style="width:min(980px,96vw);max-height:88vh;overflow:hidden;background:#fff;border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,.24);border:1px solid #dbe7ff;display:flex;flex-direction:column">
      <div style="padding:16px 18px 12px;border-bottom:1px solid #e8eefc;background:linear-gradient(135deg,#fff,#f8fbff)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-size:1rem;font-weight:900;color:var(--primary-dark)">${getIndivFilterHeading()}</div>
            <div style="font-size:.78rem;color:var(--text2);margin-top:4px">${getIndivFilterSubheading()}</div>
          </div>
          <button class="btn btn-outline" style="padding:7px 12px;font-size:.8rem" onclick="closeIndivFilterPicker()">닫기</button>
        </div>
        <div id="indivFilterPickerSummary" style="margin-top:8px;font-size:.78rem;color:var(--text2)"></div>
      </div>
      <div id="indivFilterPickerBody" style="padding:16px 18px;overflow:auto"></div>
      <div style="padding:14px 18px;border-top:1px solid #e8eefc;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;background:#fff">
        <button class="btn btn-outline" style="padding:8px 14px;font-size:.82rem" onclick="clearTempIndivFilters()">전체 보기로 초기화</button>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline" style="padding:8px 14px;font-size:.82rem" onclick="closeIndivFilterPicker()">취소</button>
          <button class="btn btn-primary" style="padding:8px 14px;font-size:.82rem" onclick="applyIndivFilterPicker()">적용</button>
        </div>
      </div>
    </div>`;
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeIndivFilterPicker(); });
  document.body.appendChild(overlay);
  renderIndivFilterPicker();
}
function toggleTempIndivFilter(type, value){
  const state = INDIV_FILTER_PICKER_STATE;
  if(!state) return;
  const list = Array.isArray(state.temp[type]) ? state.temp[type] : (state.temp[type]=[]);
  const v = String(value);
  state.temp[type] = list.includes(v) ? list.filter(x=>x!==v) : [...list, v];
  renderIndivFilterPicker();
}
function clearTempIndivFilters(){
  const state = INDIV_FILTER_PICKER_STATE;
  if(!state) return;
  state.temp = {groups:[],courts:[],mainMatches:[],mainBlocks:[]};
  renderIndivFilterPicker();
}
function applyIndivFilterPicker(){
  const state = INDIV_FILTER_PICKER_STATE;
  if(!state) return;
  INDIV_OPERATOR_FILTERS[state.key] = {
    groups: [...(state.temp.groups||[])],
    courts: [...(state.temp.courts||[])],
    mainMatches: [...(state.temp.mainMatches||[])],
    mainBlocks: [...(state.temp.mainBlocks||[])],
  };
  persistIndivOperatorFilters();
  closeIndivFilterPicker();
  renderBracket();
}
window.openIndivFilterPicker = openIndivFilterPicker;
window.closeIndivFilterPicker = closeIndivFilterPicker;
window.toggleTempIndivFilter = toggleTempIndivFilter;
window.clearTempIndivFilters = clearTempIndivFilters;
window.applyIndivFilterPicker = applyIndivFilterPicker;


window.__OP_VIEW_MODE = window.__OP_VIEW_MODE || {};
function getOperationViewMode(key){
  return String((window.__OP_VIEW_MODE && window.__OP_VIEW_MODE[key]) || 'all');
}
function setOperationViewMode(key, mode){
  if(!window.__OP_VIEW_MODE) window.__OP_VIEW_MODE={};
  const next = ['all','group','main'].includes(String(mode)) ? String(mode) : 'all';
  window.__OP_VIEW_MODE[key]=next;
  renderBracket();
}
function shouldShowPrelimByOperationMode(key){
  const mode=getOperationViewMode(key);
  return mode==='all' || mode==='group';
}
function shouldShowMainByOperationMode(key){
  const mode=getOperationViewMode(key);
  return mode==='all' || mode==='main';
}
function renderOperationViewButtons(key){
  const mode=getOperationViewMode(key);
  return `<div style="margin:10px 0 12px;padding:12px 14px;border:1px solid #dbe7ff;border-radius:14px;background:linear-gradient(135deg,#fff,#f8fbff)">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div>
        <div style="font-size:.92rem;font-weight:900;color:var(--primary-dark)">🧭 운영 보기</div>
        <div style="font-size:.76rem;color:var(--text2);margin-top:4px">예선과 본선 운영 화면을 나눠서 볼 수 있습니다. 자동감지와 자동 접기는 그대로 유지됩니다.</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ${mode==='all'?'btn-primary':'btn-outline'}" style="padding:7px 12px;font-size:.8rem;white-space:nowrap" onclick="setOperationViewMode('${key}','all')">전체</button>
        <button class="btn ${mode==='group'?'btn-primary':'btn-outline'}" style="padding:7px 12px;font-size:.8rem;white-space:nowrap" onclick="setOperationViewMode('${key}','group')">예선</button>
        <button class="btn ${mode==='main'?'btn-primary':'btn-outline'}" style="padding:7px 12px;font-size:.8rem;white-space:nowrap" onclick="setOperationViewMode('${key}','main')">본선 운영</button>
      </div>
    </div>
  </div>`;
}
function getDisplayGroupFilters(key){ return getIndivOperatorGroupFilter(key)||[]; }
function getDisplayCourtFilters(key){ return getSelectedCourtFilters(key)||[]; }
function getDisplayMainBlockFilters(key){ return getSelectedMainBlockFilters(key)||[]; }

function getVisibleGroupIndexesForKey(key){
  const draw=G.draws[key]||{};
  const groups=Array.isArray(draw.groups)?draw.groups:[];
  const allIdx=groups.map((_,i)=>i);
  if(!isIndividualByKey(key)) return allIdx;
  const selected=getIndivOperatorGroupFilter(key)||[];
  if(!selected.length) return allIdx;
  return allIdx.filter(i=>selected.includes(String(i)));
}
function getSelectedCourtFilters(key){
  return ensureOperatorFilters(key).courts;
}
function getSelectedMainMatchFilters(key){
  return ensureOperatorFilters(key).mainMatches;
}
function getSelectedMainBlockFilters(key){
  return ensureOperatorFilters(key).mainBlocks;
}
function getMainFirstRoundMatchCount(key){
  const mains=(G.matches[key]||[]).filter(m=>m.phase==='main');
  if(!mains.length) return 0;
  const minRound=Math.min(...mains.map(m=>Number(m.round||0)));
  return mains.filter(m=>Number(m.round||0)===minRound).length;
}
function splitCountsEvenly(total, parts){
  if(parts<=0) return [];
  const base=Math.floor(total/parts);
  const rem=total%parts;
  return Array.from({length:parts},(_,i)=>base + (i<rem?1:0));
}
function getMainBracketBlockList(key){
  const firstCount=getMainFirstRoundMatchCount(key);
  if(firstCount<=1) return [];
  const partCount=firstCount>=4 ? 4 : 2;
  const sizes=splitCountsEvenly(firstCount, partCount).filter(v=>v>0);
  let start=0;
  return sizes.map((size, idx)=>{
    const end=start+size-1;
    const label=partCount===4
      ? (idx<2 ? `상단 ${idx+1}/4` : `하단 ${idx+1}/4`)
      : (idx===0 ? '상단 하프' : '하단 하프');
    const out={id:`block_${idx+1}`, label, startSlot:start, endSlot:end, order:idx+1};
    start=end+1;
    return out;
  });
}
function getMainMatchCoverageRange(key,m){
  if(!m || m.phase!=='main') return null;
  const mains=(G.matches[key]||[]).filter(x=>x.phase==='main');
  if(!mains.length) return null;
  const minRound=Math.min(...mains.map(x=>Number(x.round||0)));
  const relRound=Math.max(0, Number(m.round||0)-minRound);
  const span=Math.pow(2, relRound);
  const start=Number(m.slot||0) * span;
  const end=start + span - 1;
  return {start, end};
}
function isMainMatchVisibleByBlockFilter(key,m){
  const selected=getSelectedMainBlockFilters(key);
  if(!selected.length) return true;
  const blocks=getMainBracketBlockList(key);
  if(!blocks.length) return true;
  const selectedBlocks=blocks.filter(b=>selected.includes(String(b.id)));
  if(!selectedBlocks.length) return true;
  const selectedSlots=new Set();
  selectedBlocks.forEach(b=>{ for(let s=b.startSlot; s<=b.endSlot; s++) selectedSlots.add(s); });
  const range=getMainMatchCoverageRange(key,m);
  if(!range) return true;
  for(let s=range.start; s<=range.end; s++){
    if(!selectedSlots.has(s)) return false;
  }
  return true;
}
function getMainMatchSequenceList(key){
  return (G.matches[key]||[])
    .filter(m=>m.phase==='main')
    .sort((a,b)=>Number(a.round||0)-Number(b.round||0) || Number(a.slot||0)-Number(b.slot||0))
    .map((m,i)=>({id:String(m.id), label:`본선 ${i+1}경기`, index:i+1, match:m}));
}
function isMatchVisibleByCourtFilter(key, m){
  const selected=getSelectedCourtFilters(key);
  if(!selected.length) return true;
  const courts=getMatchCourtsForStatusBoard(key,m)||[];
  return courts.some(c=>selected.includes(String(c)));
}
function isMainMatchVisibleByFilter(key,m){
  return isMainMatchVisibleByBlockFilter(key,m);
}
function getGroupAssignedCourts(key, gi){
  return getGroupDisplayCourts(key, Number(gi));
}
function getAllowedCourtsForMatch(key,m){
  if(!m) return [];
  // 중요: 보기 필터(getSelectedCourtFilters / 본선구간 필터)는 실제 코트 배정 제한에 절대 사용하지 않는다.
  // 수동 코트 변경/이동은 항상 부서에 설정된 운영 코트 전체 안에서 가능해야 한다.
  const drawAllowed=getBracketAllowedCourts(key).map(String);
  const pool=drawAllowed.length ? drawAllowed.slice() : getTournamentCourtList(_k2td(key).tid, true);
  return [...new Set(pool.map(String))];
}
function formatIndivFilterSummary(key){
  const groups=(getIndivOperatorGroupFilter(key)||[]).map(v=>Number(v)).filter(v=>Number.isFinite(v)).sort((a,b)=>a-b);
  const courts=(getSelectedCourtFilters(key)||[]).filter(Boolean).map(String);
  const mains=(getSelectedMainMatchFilters(key)||[]).filter(Boolean).map(String);
  const parts=[];
  if(groups.length){
    const labels=groups.map(v=>grpLabel(v));
    parts.push(labels.length<=3 ? `조 ${labels.join(', ')}` : `조 ${labels.length}개 선택`);
  }
  if(courts.length){
    parts.push(courts.length<=3 ? `코트 ${courts.join(', ')}` : `코트 ${courts.length}개 선택`);
  }
  if(mains.length){
    parts.push(mains.length<=3 ? `본선 ${mains.length}경기 선택` : `본선 ${mains.length}경기 선택`);
  }
  return parts.length ? parts.join(' · ') : '전체 보기';
}
function getCourtQueueInfo(key, court){
  const related=(G.matches[key]||[]).filter(m=>getMatchCourtsForStatusBoard(key,m).includes(court) && m.winner==null).sort((a,b)=>{
    const aa=String(a.courtQueueOrder||a.courtAssignedAt||'');
    const bb=String(b.courtQueueOrder||b.courtAssignedAt||'');
    if(aa!==bb) return aa.localeCompare(bb);
    return String(a.id||'').localeCompare(String(b.id||''));
  });
  const active=related[0] || null;
  const waiting=related.slice(1);
  return {active, waiting, related};
}
function formatClockTime(iso=''){
  try{
    if(!iso) return '';
    const d=new Date(iso);
    if(Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
  }catch(e){ return ''; }
}
function getElapsedMinutesSince(iso=''){
  try{
    if(!iso) return 0;
    const ts=new Date(iso).getTime();
    if(!Number.isFinite(ts)) return 0;
    return Math.max(0, Math.floor((Date.now()-ts)/60000));
  }catch(e){ return 0; }
}
function getDelayBadgeMeta(minutes, mode='assigned'){
  const mins=Math.max(0, Number(minutes||0));
  if(mins>=60) return {text:'장기 지연', color:'#991b1b', bg:'#fee2e2', bd:'#fca5a5'};
  if(mins>=45) return {text:'확인 필요', color:'#b45309', bg:'#fff7ed', bd:'#fdba74'};
  if(mins>=30) return {text:'지연 의심', color:'#92400e', bg:'#fffbeb', bd:'#fcd34d'};
  return null;
}
function buildElapsedMetaLine(iso='', mode='assigned'){
  const clock=formatClockTime(iso);
  const mins=getElapsedMinutesSince(iso);
  const badge=getDelayBadgeMeta(mins, mode);
  if(!clock && !mins) return {text:'', badge:null, mins:0, mode, label:'', clock:'', duration:'', prefix:'', _iso:''};
  const prefix=mode==='waiting1' ? '대기시작' : mode==='wait_placed' ? '대기배치' : '배정';
  const label=`${prefix} ${clock||'-'} · ${mins}분 경과`;
  return {text:label, badge, mins, mode, label, clock:clock||'-', duration:`${mins}분 경과`, prefix, _iso:String(iso||'')};
}
function renderElapsedMetaBlocks(items=[], color='var(--text2)'){
  const list=(items||[]).filter(x=>x && (x.clock || x.duration));
  if(!list.length) return '';
  // data-iso 속성 추가 → courtBoardClockTick()이 60초마다 경과시간만 DOM 업데이트
  // 각 파트를 개별 span으로 분리하여 타이머가 elapsed-duration만 정확히 갱신할 수 있게 함
  return `<div style="margin-top:3px;display:flex;align-items:center;flex-wrap:wrap;gap:4px">${list.map(it=>{
    const tone=it.badge?.color || color;
    const border=it.badge?.bd || 'rgba(148,163,184,.32)';
    const bg=it.badge?.bg || 'rgba(255,255,255,.55)';
    const label=it.prefix || (it.mode==='waiting1' ? '대기1' : '배정');
    const isoAttr=it._iso ? ` data-iso="${esc(it._iso)}" data-label="${esc(label)}"` : '';
    const clockSpan=`<span class="elapsed-clock">🕒 ${esc(label)} ${esc(it.clock||'-')}</span>`;
    const durSpan=`<span class="elapsed-sep"> · </span><span class="elapsed-duration">${esc(it.duration||'0분 경과')}</span>`;
    const badgeSpan=it.badge?.text ? `<span class="elapsed-sep"> · </span><span class="elapsed-badge-text">⚠️ ${esc(it.badge.text)}</span>` : '';
    return `<span class="elapsed-chip"${isoAttr} style="display:inline-flex;align-items:center;gap:0;padding:2px 7px;border-radius:999px;background:${bg};border:1px solid ${border};font-size:.67rem;font-weight:800;color:${tone};line-height:1.3;white-space:nowrap">${clockSpan}${durSpan}${badgeSpan}</span>`;
  }).join('')}</div>`;
}
function isSameMinuteTime(a='', b=''){
  try{
    if(!a || !b) return false;
    const ta=new Date(a).getTime();
    const tb=new Date(b).getTime();
    if(!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
    return Math.floor(ta/60000)===Math.floor(tb/60000);
  }catch(e){ return false; }
}
// ── 코트 현황판 경과시간 실시간 갱신 타이머 ─────────────────────────────
// renderElapsedMetaBlocks가 생성한 .elapsed-chip[data-iso] 요소를
// 매 분마다 DOM에서 직접 업데이트 → renderBracket 전체 재호출 없이 시간 갱신
let _courtClockTimer = null;
function courtBoardClockTick(){
  try{
    document.querySelectorAll('.elapsed-chip[data-iso]').forEach(el=>{
      const iso = el.getAttribute('data-iso');
      if(!iso) return;
      const ts = new Date(iso).getTime();
      if(!Number.isFinite(ts)) return;
      const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));

      // ① elapsed-duration span만 교체 (배정시각 clock span은 절대 건드리지 않음)
      const durEl = el.querySelector('.elapsed-duration');
      if(durEl) durEl.textContent = `${mins}분 경과`;

      // ② 지연 배지 텍스트/색상
      let badgeText='', badgeColor='', badgeBg='', badgeBd='';
      if(mins>=60){ badgeText='장기 지연'; badgeColor='#991b1b'; badgeBg='#fee2e2'; badgeBd='#fca5a5'; }
      else if(mins>=45){ badgeText='확인 필요'; badgeColor='#b45309'; badgeBg='#fff7ed'; badgeBd='#fdba74'; }
      else if(mins>=30){ badgeText='지연 의심'; badgeColor='#92400e'; badgeBg='#fffbeb'; badgeBd='#fcd34d'; }

      if(badgeText){
        el.style.background = badgeBg;
        el.style.borderColor = badgeBd;
        el.style.color = badgeColor;
      } else {
        el.style.background = '';
        el.style.borderColor = '';
        el.style.color = '';
      }

      const badgeTextEl = el.querySelector('.elapsed-badge-text');
      const badgeSepEl  = badgeTextEl ? badgeTextEl.previousElementSibling : null;
      if(badgeText){
        if(badgeTextEl){
          badgeTextEl.textContent = '⚠️ ' + badgeText;
        } else {
          const sep = document.createElement('span');
          sep.className = 'elapsed-sep';
          sep.textContent = ' · ';
          const badge = document.createElement('span');
          badge.className = 'elapsed-badge-text';
          badge.textContent = '⚠️ ' + badgeText;
          el.appendChild(sep);
          el.appendChild(badge);
        }
      } else if(badgeTextEl){
        if(badgeSepEl && badgeSepEl.classList.contains('elapsed-sep')) badgeSepEl.remove();
        badgeTextEl.remove();
      }
    });
  }catch(e){ console.warn('courtBoardClockTick error', e); }
}
function startCourtBoardClock(){
  if(_courtClockTimer) clearInterval(_courtClockTimer);
  // 즉시 실행하면 renderBracket 직후라 0분으로 표시됨 → 첫 틱은 60초 후
  _courtClockTimer = setInterval(courtBoardClockTick, 60000);
}
window.courtBoardClockTick = courtBoardClockTick;
window.startCourtBoardClock = startCourtBoardClock;
// ─────────────────────────────────────────────────────────────────────────────
function captureCourtNotificationState(){
  try{ return buildCourtNotificationStateMap(G.matches||{}); }catch(e){ return {}; }
}
function dispatchLocalCourtNotificationAlerts(prevState){
  try{
    const nextState=buildCourtNotificationStateMap(G.matches||{});
    enqueueCourtSmsAlertsFromState(prevState||{}, nextState||{});
  }catch(e){ console.warn('local court sms alert dispatch failed', e); }
}
function formatMatchQueueLabel(key,m){
  if(!m) return '';
  const base=(m.phase==='group'&&m.group!=null)?`${grpLabel(m.group)} ${getIndividualMatchLabel(key,m)||''}`.trim():describeCourtBoardMatch(key,m).label;
  const st=getMatchResultState(key,m);
  return `${base} ${st.started?'진행중':'대기중'}`.trim();
}
function getBracketTreeCourtStatusChip(key,m){
  try{
    if(!m || String(m.phase||'')!=='main' || m.winner!=null) return null;
    const courts=getMatchCourtsForStatusBoard(key,m)||[];
    const court=String(courts[0]||'').trim();
    if(!court) return null;
    const queue=getCourtQueueInfo(key, court);
    const currentId=String(queue?.active?.id||'');
    const waiting=(queue?.waiting||[]).map(x=>String(x?.id||''));
    const myId=String(m.id||'');
    if(currentId===myId){
      return {text:`🎾 ${court} 경기중`, kind:'live'};
    }
    const idx=waiting.indexOf(myId);
    if(idx>=0){
      return {text:`⏳ ${court} 대기${idx+1}번`, kind:'wait'};
    }
    return null;
  }catch(e){
    return null;
  }
}

function getBracketTreeFocusRoundIndex(key, roundsMs){
  try{
    if(!Array.isArray(roundsMs) || !roundsMs.length) return 0;
    for(let ri=0; ri<roundsMs.length; ri++){
      const rms=Array.isArray(roundsMs[ri]) ? roundsMs[ri] : [];
      if(!rms.length) continue;
      const hasActive=rms.some(m=>m && !m.bye && m.winner==null && !getMatchResultState(key,m).done);
      if(hasActive) return ri;
    }
    return Math.max(0, roundsMs.length-1);
  }catch(e){
    return 0;
  }
}
function autoFocusMainBracketTrees(){
  try{
    const scope=ge('page-bracket') || document;
    const trees=[...scope.querySelectorAll('.js-main-tree-scroll')];
    trees.forEach(wrap=>{
      if(!wrap || wrap.dataset.autoFocused==='1') return;
      const isMobile=(window.innerWidth||0) <= 820;
      if(!isMobile){
        wrap.dataset.autoFocused='1';
        return;
      }
      const focusLeft=Math.max(0, Number(wrap.dataset.focusLeft||0) || 0);
      const maxScroll=Math.max(0, (wrap.scrollWidth||0) - (wrap.clientWidth||0));
      const target=Math.min(maxScroll, Math.max(0, focusLeft - 12));
      wrap.scrollLeft=target;
      wrap.dataset.autoFocused='1';
    });
  }catch(e){}
}
window.autoFocusMainBracketTrees = autoFocusMainBracketTrees;
function canManageBracket(){ return !!(AD || OP); }
function refreshRoleUI(){
  const opPages=['tournament','register','players'];
  // 개인시합 잠금 탭 목록
  const lockPages=['tournament','players'];
  const isAdmin = document.body.classList.contains('admin-mode');
  const lockActive = isIndivLockActive() && !isAdmin;

  document.querySelectorAll('.nav-tab').forEach(tab=>{
    const p=tab.dataset.page;
    // 경기진행자 모드면 해당 탭 숨김
    if(isOperatorMode() && opPages.includes(p)){
      tab.style.display='none';
    // 잠금 기간 중(비관리자)이면 대상 탭 숨김
    } else if(lockActive && lockPages.includes(p)){
      tab.style.display='none';
    } else {
      tab.style.display='';
    }
  });
  const opBtn=ge('opToggleBtn');
  if(opBtn){
    opBtn.textContent = OP ? '🎾 진행자 로그아웃' : '🎾 진행자 로그인';
    opBtn.style.background = OP ? '#0f4ea8' : '#1565c0';
  }
  const opBadge=ge('opLoginBadge');
  if(opBadge) opBadge.style.display = OP ? 'inline-flex' : 'none';

  // 클럽 로그인 상태에 따른 헤더 버튼 표시/숨김
  const clubNameBadge = ge('regClubNameBadge');
  const opToggle = ge('opToggleBtn');
  const adminToggle = ge('adminToggleBtn');

  if(REG && !AD){
    // 클럽 로그인 중: 진행자·관리자 버튼 숨기고 클럽명 표시
    if(opToggle) opToggle.style.display = 'none';
    if(adminToggle) adminToggle.style.display = 'none';
    if(clubNameBadge){
      clubNameBadge.textContent = REG_CLUB ? `🏆 ${REG_CLUB}` : '🏆 클럽';
      clubNameBadge.style.display = 'inline-flex';
    }
  } else {
    // 로그아웃 상태: 모든 버튼 원래대로
    if(opToggle) opToggle.style.display = '';
    if(adminToggle) adminToggle.style.display = '';
    if(clubNameBadge) clubNameBadge.style.display = 'none';
  }
  // 카드류 잠금은 applyIndivLock에서 별도 처리
  try{ ensureViewerBracketPolling(getCurrentPageName(), getSelectedTournamentIdForPage(getCurrentPageName()) || getRealtimeTargetTournamentId() || null); }catch(e){}
  try{ applyIndivLock(); }catch(e){}
}
function applyOperatorUI(){
  OP=true;
  try{ localStorage.setItem('op','1'); }catch(e){}
  if(REG){
    REG=false; REG_CLUB='';
    try{
      localStorage.removeItem('reg');
      localStorage.removeItem('reg_club');
      localStorage.removeItem('reg_session_version');
    }catch(e){}
    const regBtn=ge('regToggleBtn');
    if(regBtn){ regBtn.textContent='🏆 클럽 로그인'; regBtn.style.background='var(--success)'; }
    const regBadge=ge('regLoginBadge'); if(regBadge) regBadge.style.display='none';
  }
  refreshRoleUI();
  applyRegLoginUI();
}
function toggleOperator(){ closeLoginMenu();
  if(OP){
    OP=false;
    try{ localStorage.removeItem('op'); }catch(e){}
    refreshRoleUI();
    toast('경기진행자 로그아웃','info');
    if(document.querySelector('.nav-tab.active')?.dataset?.page==='tournament') showPage('home');
    return;
  }
  if(AD){ toast('관리자 로그인 상태에서는 경기진행자 로그인이 필요 없습니다','info'); return; }
  om('mOpLogin');
  setTimeout(()=>ge('opPwInput')?.focus(),160);
}
function doOperatorLogin(){
  const pw=(ge('opPwInput')?.value||'').trim();
  if(!pw){ toast('비밀번호를 입력해주세요','error'); return; }
  if(pw !== (G.meta.operatorPw||'2026court')){ toast('비밀번호가 틀렸습니다','error'); ge('opPwInput')?.select(); return; }
  cm('mOpLogin');
  applyOperatorUI();
  toast('경기진행자 로그인 ✅','success');
  showPage('bracket');
  // ▼▼▼ [이용안내] 진행자 로그인 시 안내 팝업 자동 표시 (세션당 1회) ▼▼▼
  if(!sessionStorage.getItem('opManualShown')){
    sessionStorage.setItem('opManualShown','1');
    setTimeout(()=>{ om('mOperatorManual'); }, 400);
  }
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
}
function toggleShowOperatorPw(btn){
  const el = ge('currentOperatorPwDisplay');
  if(!el) return;
  if(el.textContent === '●●●●'){
    el.textContent = G.meta.operatorPw||'(미설정)';
    btn.textContent='숨기기';
  } else {
    el.textContent='●●●●';
    btn.textContent='보기';
  }
}

async function saveOperatorPw(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const cur=(ge('currentOperatorPwInput')?.value||'').trim();
  const nw=(ge('newOperatorPwInput')?.value||'').trim();
  const nw2=(ge('newOperatorPwInput2')?.value||'').trim();
  const currentSaved=G.meta.operatorPw||'2026court';
  if(cur!==currentSaved){ toast('현재 경기진행자 비밀번호가 올바르지 않습니다','error'); return; }
  if(!nw || nw.length<4){ toast('새 비밀번호는 4자 이상 입력하세요','error'); return; }
  if(nw!==nw2){ toast('새 비밀번호 확인이 일치하지 않습니다','error'); return; }
  if(nw===cur){ toast('현재 비밀번호와 다른 값으로 입력하세요','error'); return; }
  G.meta.operatorPw=nw;
  try{
    await saveMeta();
    if(ge('currentOperatorPwInput')) ge('currentOperatorPwInput').value='';
    if(ge('newOperatorPwInput')) ge('newOperatorPwInput').value='';
    if(ge('newOperatorPwInput2')) ge('newOperatorPwInput2').value='';
    if(ge('currentOperatorPwDisplay')) ge('currentOperatorPwDisplay').textContent='●●●●';
    toast('경기진행자 비밀번호 변경 완료 ✅','success');
  }catch(e){
    toast('저장 실패: '+e.message,'error');
  }
}

function updatePlayersAdminControls(){
  const recBtns=ge('playerPageBtns');
  const regBtns=ge('registryActionBtns');
  const recActive=!!ge('ptab-records')?.classList.contains('active');
  const regActive=!!ge('ptab-registry')?.classList.contains('active');
  if(recBtns) recBtns.style.display=(AD && recActive)?'flex':'none';
  if(regBtns) regBtns.style.display=(AD && regActive)?'flex':'none';
}

let __APP_NAV_HISTORY_READY = false;
let __APP_NAV_SUPPRESS_PUSH = false;
let __APP_MODAL_SYNCING = false;
const __APP_ROOT_GUARD_TAG = '__root_guard__';

function getActiveModalId(){
  const modals=[...document.querySelectorAll('.modal-overlay.open')];
  if(!modals.length) return '';
  return modals[modals.length-1].id || '';
}
function closeTopModal(){
  const modals=[...document.querySelectorAll('.modal-overlay.open')];
  if(!modals.length) return false;
  const top=modals[modals.length-1];
  if(top?.id) cm(top.id);
  return true;
}
function syncModalStateTo(targetModalId=''){
  const current=getActiveModalId();
  if(current===String(targetModalId||'')) return;
  __APP_MODAL_SYNCING = true;
  try{
    document.querySelectorAll('.modal-overlay.open').forEach(el=>{
      if(!targetModalId || el.id!==targetModalId) cm(el.id);
    });
    if(targetModalId){
      const target=document.getElementById(targetModalId);
      if(target && !target.classList.contains('open')) om(targetModalId);
    }
  }finally{
    __APP_MODAL_SYNCING = false;
  }
}
function buildAppHistoryState(page, modalId='', isGuard=false){
  return {__appNav:true, page:String(page||'home'), modalId:String(modalId||''), guard:isGuard?__APP_ROOT_GUARD_TAG:''};
}
function appPushHistoryState(page, modalId='', isGuard=false){
  if(!__APP_NAV_HISTORY_READY) return;
  try{
    const state=buildAppHistoryState(page, modalId, isGuard);
    const hash='#'+encodeURIComponent(String(page||'home'));
    history.pushState(state, '', hash);
  }catch(e){}
}
function appReplaceHistoryState(page, modalId='', isGuard=false){
  try{
    const state=buildAppHistoryState(page, modalId, isGuard);
    const hash='#'+encodeURIComponent(String(page||'home'));
    history.replaceState(state, '', hash);
  }catch(e){}
}
function ensureAppHistoryReady(){
  if(__APP_NAV_HISTORY_READY) return;
  const current=document.querySelector('.page.active')?.id?.replace('page-','')||'home';
  appReplaceHistoryState(current, '', false);
  appPushHistoryState(current, '', true);
  __APP_NAV_HISTORY_READY = true;
}
function handleAppPopState(ev){
  if(window.__disableLegacyAppPopState) return;
  const state=ev?.state;
  if(!state || !state.__appNav){
    __APP_NAV_SUPPRESS_PUSH = true;
    try{ syncModalStateTo(''); showPage('home'); }finally{ __APP_NAV_SUPPRESS_PUSH = false; }
    appPushHistoryState('home', '', true);
    return;
  }
  const targetPage=String(state.page||'home');
  const targetModal=String(state.modalId||'');
  __APP_NAV_SUPPRESS_PUSH = true;
  try{
    syncModalStateTo(targetModal);
    showPage(targetPage);
  }finally{
    __APP_NAV_SUPPRESS_PUSH = false;
  }
  if(state.guard===__APP_ROOT_GUARD_TAG){
    appPushHistoryState(targetPage, targetModal, true);
  }
}
window.addEventListener('popstate', handleAppPopState);

function showPage(n){
  if(isOperatorMode() && ['tournament','register','players'].includes(n)){
    toast('경기진행자 권한에서는 대진표/시합결과만 운영할 수 있습니다','info');
    n='bracket';
  }
  const prev=document.querySelector('.page.active')?.id?.replace('page-','')||'home';
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  ge('page-'+n).classList.add('active');
  document.querySelector(`.nav-tab[data-page="${n}"]`).classList.add('active');
  document.querySelectorAll('.swipe-dot').forEach(d=>
    d.classList.toggle('active', d.dataset.page===n)
  );
  const activeTab=document.querySelector(`.nav-tab[data-page="${n}"]`);
  if(activeTab) activeTab.scrollIntoView({block:'nearest',inline:'center',behavior:'auto'});
  if(window.goPageSheet) window.goPageSheet(n, ['players','ranking','bracket'].includes(n) || ['players','ranking','bracket'].includes(prev));
  if(n==='home')upDash();if(n==='tournament'){renderTL();renderCourtGroupManager('create');}if(n==='register'){popSel();renderRL();}
  if(n==='bracket')popSel();
  if(n==='players'){
    const act=ge('ptab-registry')?.classList.contains('active');
    if(!act) switchPlayersTab('registry');
    else {
      const b=ge('regTabBody');
      if(b && !b.dataset.ready){
        b.innerHTML='<div class="card" style="padding:22px;text-align:center;font-size:.9rem;color:var(--text2)">선수 명단을 불러오는 중입니다…</div>';
      }
      setTimeout(()=>initRegistryTab(),0);
    }
  }
  if(n==='ranking')popSel();

  if(n==='register'){
    const el=ge('regTS');
    if(el && !el.value){ el.value = pickDefaultTournamentId(); onRegTC(); }
  }
  if(n==='bracket'){
    const el=ge('brTS');
    if(el && !el.value){ el.value = pickDefaultTournamentId(); onBrTC(); }
  }
  if(n==='ranking'){
    const el=ge('rankTS');
    if(el && !el.value){ el.value = pickDefaultTournamentId(); onRankTC(); }
  }

  try{
    const activeTid = getSelectedTournamentIdForPage(n) || getRealtimeTargetTournamentId();
    syncTournamentDataForPage(n, activeTid, false).catch(e=>console.warn('page tournament sync failed', e));
  }catch(e){}

  window.scrollTo({top:0,behavior:'auto'});
  renderFloatingNotice();
  setTimeout(updateOperationSticky,0);
  setTimeout(()=>window.updatePageSliderHeight && window.updatePageSliderHeight(), 0);
  try{ syncTournamentDataForPage(n, getSelectedTournamentIdForPage(n) || getRealtimeTargetTournamentId() || null, false).catch(e=>console.warn('page sync failed', e)); }catch(e){}
  ensureViewerBracketPolling(n, getSelectedTournamentIdForPage(n) || getRealtimeTargetTournamentId() || null);
  refreshRoleUI();
  try{ applyIndivLock(); }catch(e){}

  if(__APP_NAV_HISTORY_READY && !__APP_NAV_SUPPRESS_PUSH){
    const currentState=history.state||{};
    const currentPage=String(currentState.page||'');
    const currentModal=String(currentState.modalId||'');
    if(currentPage!==String(n) || currentModal){
      appPushHistoryState(n, '', false);
    }
  }
}

function toggleAdmin(){ closeLoginMenu();
  if(AD){
    AD=false;
    localStorage.removeItem('adm');
    document.body.classList.remove('admin-mode');
    ge('adminBadge').classList.remove('show');
    ge('adminToggleBtn').classList.remove('active');
    ge('adminToggleBtn').textContent='🔐 관리자';
    document.querySelectorAll('[id^="ao"]').forEach(e=>e.style.display='none');
    const rh2=ge('regActHdr'); if(rh2) rh2.textContent='';
    const ptabRec=ge('ptab-records'); if(ptabRec) ptabRec.style.display='none';
    const curPg=document.querySelector('.nav-tab.active')?.dataset?.page;
    if(curPg==='players') switchPlayersTab('registry');
    // 선수기록 탭 숨김, 선수기록 보고 있었으면 홈으로
    document.querySelectorAll('.ao-players-tab').forEach(e=>e.style.display='none');
    // 빠른추가 UI 숨김
    const qaHide=ge('regTabQuickAdd'); if(qaHide) qaHide.style.display='none';
    const curPage=document.querySelector('.nav-tab.active')?.dataset?.page;
    if(curPage==='players') showPage('home');
    cm('mAdminSettings');
    updatePlayersAdminControls();
    renderOpStickyRibbonFromMarker(null);
    refreshRoleUI();
    toast('로그아웃','info');
    const _ap=document.querySelector('.nav-tab.active')?.dataset?.page;
    if(_ap==='register'){renderRegisterDivisionOverview();renderRL();}
    try{ applyIndivLock(); }catch(e){}
  } else om('mAdmin');
}
function applyAdminUI(){
  AD=true;
  OP=false;
  try{ localStorage.removeItem('op'); }catch(e){};
  document.body.classList.add('admin-mode');
  try{ if(sessionStorage.getItem('hideOpStickyRibbon')!=='1') window.__hideOpStickyRibbon=false; }catch(e){}
  setTimeout(updateOperationSticky,0);
  ge('adminBadge').classList.add('show');
  ge('adminToggleBtn').classList.add('active');
  ge('adminToggleBtn').textContent='🔐 로그아웃';
  document.querySelectorAll('[id^="ao"]').forEach(e=>e.style.display='block');
  const rh=ge('regActHdr'); if(rh) rh.textContent='관리';
  const ptabR=ge('ptab-records'); if(ptabR) ptabR.style.display='';
  // 선수기록 탭 표시
  document.querySelectorAll('.ao-players-tab').forEach(e=>e.style.display='');
  // 등록 현황 탭 — 빠른추가 UI 표시 + 클럽 셀렉트 채우기
  const qa=ge('regTabQuickAdd'); if(qa) qa.style.display='';
  const rtSel=ge('rtabAddClub');
  if(rtSel && G.clubs && G.clubs.length){
    rtSel.innerHTML='<option value="">-- 클럽 선택 --</option>'+(G.clubs||[]).map(c=>`<option value="${c}">${c}</option>`).join('');
  }
  updatePlayersAdminControls();
  refreshRoleUI();
  try{ applyIndivLock(); }catch(e){}
}
function doLogin(){
  const pw=ge('adminPw').value;
  if(pw===G.meta.pw){
    applyAdminUI();
    localStorage.setItem('adm','1');
    cm('mAdmin');
    ge('adminPw').value='';
    toast('관리자 로그인 ✅','success');
    const pg=document.querySelector('.nav-tab.active').dataset.page;
    if(pg==='tournament')renderTL();
    if(pg==='register'){renderRegisterDivisionOverview();renderRL();}
    if(pg==='bracket')renderBracket();
  } else {
    toast('비밀번호 오류','error');
    ge('adminPw').select();
  }
}


// ── 팀등록 로그인 함수들 ──────────────────────
function toggleReg(){ closeLoginMenu();
  if(REG && !AD){
    // 로그아웃
    REG=false;
    REG_CLUB='';
    localStorage.removeItem('reg');
    localStorage.removeItem('reg_club');
    localStorage.removeItem('reg_session_version');
    ge('regToggleBtn').textContent='🏆 클럽 로그인';
    ge('regToggleBtn').style.background='var(--success)';
    ge('regLoginBadge') && (ge('regLoginBadge').style.display='none');
    ge('aoReg') && (ge('aoReg').style.display='none');
    refreshRoleUI(); // 진행자·관리자 버튼 다시 표시 + 클럽명 뱃지 숨김
    applyRegLoginUI();
    updateMyClubUI(); // 내 클럽 카드/버튼 숨김
    const _rp=document.querySelector('.nav-tab.active')?.dataset?.page;
    if(_rp==='register'){renderRegisterDivisionOverview();renderRL();}
    toast('경기이사 로그아웃','info');
  } else if(AD) {
    // 관리자는 이미 팀등록 가능
    toast('관리자는 팀 등록이 가능합니다','info');
  } else {
    om('mRegLogin');
    // 클럽 선택 드롭다운 채우기
    const _rclSel=ge('regClubLogin');
    if(_rclSel){
      _rclSel.innerHTML='<option value="">-- 클럽 선택 --</option>'+(G.clubs||[]).map(c=>`<option value="${c}">${c}</option>`).join('');
    }
    ge('regLoginHint') && (ge('regLoginHint').textContent='');
    setTimeout(()=>ge('regClubLogin')?.focus(),200);
  }
}

function onRegLoginClubChange(){
  const club = ge('regClubLogin')?.value||'';
  const hint = ge('regLoginHint');
  if(!hint) return;
  const info=getClubLoginHint(G.meta,club);
  hint.textContent=info.text;
  if(info.color) hint.style.color=info.color;
}

let FORCE_PW_CLUB='';
Object.defineProperty(window,'FORCE_PW_CLUB',{get:()=>FORCE_PW_CLUB,set:(v)=>{FORCE_PW_CLUB=v;}});
function getRegSessionVersion(){
  return getDirectorSessionVersion(G.meta);
}
function isClubPasswordCustom(club){
  return isClubPasswordCustomValue(G.meta,club);
}
function getClubTempPassword(club){
  return getClubTemporaryPassword(G.meta,club);
}
function openForceClubPwModal(club){
  FORCE_PW_CLUB=club;
  ge('forcePwClubName').textContent=club;
  ge('forceClubPw1').value='';
  ge('forceClubPw2').value='';
  ge('forceClubPwMsg').textContent='';
  cm('mRegLogin');
  cm('mFirstLogin');
  om('mForceClubPw');
  setTimeout(()=>ge('forceClubPw1')?.focus(),180);
}
function cancelForcedClubPassword(){
  FORCE_PW_CLUB='';
  cm('mForceClubPw');
  om('mRegLogin');
}
async function saveForcedClubPassword(){
  const club=FORCE_PW_CLUB;
  const pw1=(ge('forceClubPw1')?.value||'').trim();
  const pw2=(ge('forceClubPw2')?.value||'').trim();
  const msg=ge('forceClubPwMsg');
  const tempPw=getClubTempPassword(club);
  if(!club){ cm('mForceClubPw'); return; }
  if(!pw1 || pw1.length<6){ if(msg){msg.textContent='비밀번호는 6자리 이상으로 입력해 주세요.'; msg.style.color='var(--danger)';} return; }
  if(pw1!==pw2){ if(msg){msg.textContent='비밀번호 확인이 일치하지 않습니다.'; msg.style.color='var(--danger)';} return; }
  if(pw1===tempPw){ if(msg){msg.textContent='임시 비밀번호와 동일한 값은 사용할 수 없습니다.'; msg.style.color='var(--danger)';} return; }
  sl(true);
  try{
    setClubPassword(G.meta,club,pw1,{custom:true});
    await saveMeta();
    sl(false);
    cm('mForceClubPw');
    const _club=club; FORCE_PW_CLUB='';
    _completeRegLogin(_club);
    toast('클럽 전용 비밀번호 설정 완료 ✅ 이제 이 비밀번호로 로그인합니다.','success');
    renderAdminContactList();
  }catch(e){
    sl(false);
    if(msg){msg.textContent='저장 실패: '+e.message; msg.style.color='var(--danger)';}
  }
}

function doRegLogin(){
  const pw   = (ge('regPwInput')?.value||'').trim();
  const club = (ge('regClubLogin')?.value||'').trim();
  if(!club){ toast('클럽을 선택해주세요','error'); return; }
  if(!pw)  { toast('비밀번호를 입력해주세요','error'); return; }

  const valid = getClubLoginPassword(G.meta,club);

  if(pw === valid){
    _completeRegLogin(club);
  } else {
    toast('비밀번호가 틀렸습니다', 'error');
    ge('regPwInput')?.select();
  }
}

function _completeRegLogin(club){
  REG=true;
  REG_CLUB=club;
  localStorage.setItem('reg','1');
  localStorage.setItem('reg_club', club);
  localStorage.setItem('reg_session_version', String(getRegSessionVersion()));

  // ── 헤더 버튼·뱃지 업데이트 ──
  const toggleBtn = ge('regToggleBtn');
  if(toggleBtn){ toggleBtn.textContent='🏆 클럽 로그아웃'; toggleBtn.style.background='#388e3c'; }
  const badge = ge('regLoginBadge');
  if(badge){
    badge.textContent=`${club} 클럽`;
    badge.style.cssText='display:inline-flex;align-items:center;background:var(--success);color:#fff;font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:999px;margin-right:4px';
  }

  // ── 모달 닫기 ──
  cm('mRegLogin');
  cm('mForceClubPw');
  cm('mFirstLogin');

  // ── UI 갱신 ──
  applyRegLoginUI();

  // ── 팀등록 탭으로 자동 이동 ──
  toast(`${club} 경기이사 로그인 ✅`,'success');
  setTimeout(()=>{
    showPage('home');
    upDash();
    updateMyClubUI();
    // 비번 미변경 클럽이면 변경 권장 팝업
    const pwNeeded = openChangePwIfNeeded(club);
    // ▼▼▼ [이용안내] 비번 변경 팝업이 안 뜰 때만 이용안내 자동 표시 ▼▼▼
    if(!pwNeeded){
      const shownKey = 'manualShown_' + club;
      if(!sessionStorage.getItem(shownKey)){
        sessionStorage.setItem(shownKey, '1');
        setTimeout(()=>{ window.mShowTab(1); om('mDirectorManual'); }, 400);
      }
    }
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
  }, 150);
}

// 최초 로그인 시 전화번호 등록 모달
// ── 비밀번호 변경 (로그인 후 권장) ──────────────────────────
let CHANGE_PW_CLUB = '';
Object.defineProperty(window,'CHANGE_PW_CLUB',{get:()=>CHANGE_PW_CLUB,set:(v)=>{CHANGE_PW_CLUB=v;}});

function shouldPromptPwChange(club){
  const skipped = Number(localStorage.getItem('pw_skip_'+club)||0);
  return shouldPromptClubPasswordChange(G.meta,club,skipped,Date.now());
}

function openChangePwIfNeeded(club){
  if(!shouldPromptPwChange(club)) return false;
  CHANGE_PW_CLUB = club;
  ge('changePw1').value='';
  ge('changePw2').value='';
  ge('changePwMsg').textContent='';
  setTimeout(()=>{ om('mChangePw'); ge('changePw1')?.focus(); }, 400);
  return true;
}

// 직접 비번 변경 (로그인 상태에서 버튼 클릭)
function openChangePwDirect(){
  if(!REG_CLUB){ toast('경기이사 로그인 상태에서만 가능합니다','info'); return; }
  CHANGE_PW_CLUB = REG_CLUB;
  ge('changePw1').value='';
  ge('changePw2').value='';
  ge('changePwMsg').textContent='';
  om('mChangePw');
  setTimeout(()=>ge('changePw1')?.focus(), 200);
}

function skipChangePw(){
  // 3일간 건너뛰기
  localStorage.setItem('pw_skip_'+CHANGE_PW_CLUB, String(Date.now()));
  CHANGE_PW_CLUB='';
  cm('mChangePw');
  toast('나중에 변경할 수 있습니다. 보안을 위해 변경을 권장합니다 🔒','info');
}

async function saveChangePw(){
  const club = CHANGE_PW_CLUB;
  const pw1 = (ge('changePw1')?.value||'').trim();
  const pw2 = (ge('changePw2')?.value||'').trim();
  const msg = ge('changePwMsg');
  if(!club){ cm('mChangePw'); return; }
  if(!pw1 || pw1.length<6){
    if(msg){msg.textContent='6자리 이상 입력해 주세요.'; msg.style.color='var(--danger)';}
    return;
  }
  if(pw1!==pw2){
    if(msg){msg.textContent='비밀번호 확인이 일치하지 않습니다.'; msg.style.color='var(--danger)';}
    return;
  }
  // 현재 비번과 동일한지 체크
  const curPw = (G.meta.clubPasswords||{})[club]||'';
  if(pw1===curPw){
    if(msg){msg.textContent='현재 비밀번호와 동일합니다. 다른 비밀번호를 입력해 주세요.'; msg.style.color='var(--danger)';}
    return;
  }
  sl(true);
  try{
    setClubPassword(G.meta,club,pw1,{custom:true});
    await saveMeta();
    sl(false);
    localStorage.removeItem('pw_skip_'+club);
    CHANGE_PW_CLUB='';
    cm('mChangePw');
    toast(`비밀번호 변경 완료 ✅ 다음 로그인부터 새 비밀번호를 사용하세요.`,'success');
    try{ renderAdminContactList(); }catch(e){}
  }catch(e){
    sl(false);
    if(msg){msg.textContent='저장 실패: '+e.message; msg.style.color='var(--danger)';}
  }
}

function openFirstLoginPhoneModal(club){
  ge('firstLoginClubName').textContent = club;
  ge('firstLoginPhone').value='';
  ge('firstLoginMsg').textContent='';
  FIRST_LOGIN_CLUB = club;
  om('mFirstLogin');
  setTimeout(()=>ge('firstLoginPhone')?.focus(),200);
}

let FIRST_LOGIN_CLUB='';
Object.defineProperty(window,'FIRST_LOGIN_CLUB',{get:()=>FIRST_LOGIN_CLUB,set:(v)=>{FIRST_LOGIN_CLUB=v;}});

async function saveFirstLoginPhone(){
  const raw = (ge('firstLoginPhone')?.value||'').trim();
  const phone = raw.replace(/[^0-9-]/g,'');
  const msg = ge('firstLoginMsg');
  if(phone.length < 9){
    if(msg){ msg.textContent='올바른 전화번호를 입력해주세요 (9자리 이상)'; msg.style.color='var(--danger)'; }
    return;
  }
  const last4 = derivePasswordFromPhone(phone);
  sl(true);
  try{
    registerFirstLoginContact(G.meta,FIRST_LOGIN_CLUB,phone);
    await saveMeta();
    sl(false);
    cm('mFirstLogin');
    // 전화번호 뒷4자리가 storedPw로 저장됐으므로 바로 로그인
    toast('전화번호 등록 완료 ✅','success');
    const _loginClub = FIRST_LOGIN_CLUB;
    FIRST_LOGIN_CLUB = '';
    _completeRegLogin(_loginClub);
  }catch(e){
    sl(false);
    if(msg){ msg.textContent='저장 실패: '+e.message; msg.style.color='var(--danger)'; }
  }
}

function applyRegLoginUI(){
  const loggedIn = REG || AD;
  // 로그인 안내 카드 / 팀등록 폼 표시 제어
  const prompt = ge('regLoginPrompt');
  if(prompt){ const freeReg=(currentRegTournament()?.status==='open') && (currentRegIsIndividual() || isPublicTeamRegistrationEnabled()); prompt.style.display = (loggedIn || freeReg) ? 'none' : 'block'; }
  // 로그인 상태 바
  const bar = ge('regLoginStatusBar');
  if(bar){
    bar.style.display = (REG && !AD) ? 'flex' : 'none';
  }
  // 홈 2026 명단 버튼: 항상 표시
  const regCard = ge('homeRegViewerCard');
  if(regCard) regCard.style.display = 'block';
}

function isDirectorSessionValid(){
  try{
    const localVer = Number(localStorage.getItem('reg_session_version')||'1');
    return isDirectorSessionVersionValid(G.meta,localVer);
  }catch(e){
    return true;
  }
}
function forceDirectorLogoutLocal(message='경기이사 세션이 만료되었습니다. 다시 로그인해 주세요.'){
  try{
    REG=false;
    REG_CLUB='';
    localStorage.removeItem('reg');
    localStorage.removeItem('reg_club');
    localStorage.removeItem('reg_session_version');
  }catch(e){}
  const btn=ge('regToggleBtn');
  if(btn){
    btn.textContent='경기이사 로그인';
    btn.style.background='var(--success)';
  }
  const badge=ge('regLoginBadge');
  if(badge) badge.style.display='none';
  refreshRoleUI(); // 진행자·관리자 버튼 다시 표시 + 클럽명 뱃지 숨김
  applyRegLoginUI();
  updateMyClubUI();
  try{ renderRegisterDivisionOverview(); }catch(e){}
  try{ renderRL(); }catch(e){}
  try{ renderBracket(); }catch(e){}
  if(message) toast(message,'info');
}
async function pollDirectorSessionVersion(){
  try{
    if(!REG || AD) return;
    const remoteVer = Number(G?.meta?.regSessionVersion||1);
    const localVer = Number(localStorage.getItem('reg_session_version')||'1');
    if(remoteVer !== localVer){
      forceDirectorLogoutLocal('관리자 설정으로 경기이사 세션이 만료되었습니다. 다시 로그인해 주세요.');
    }
  }catch(e){}
}
window.forceDirectorLogoutLocal = forceDirectorLogoutLocal;
window.pollDirectorSessionVersion = pollDirectorSessionVersion;
window.isDirectorSessionValid = isDirectorSessionValid;

async function saveRegPw(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const nw = (ge('newRegPwInput')?.value||'').trim();
  if(!nw){ toast('새 비밀번호를 입력하세요','error'); return; }
  if(nw.length < 4){ toast('4자 이상 입력하세요','error'); return; }
  G.meta.regPw = nw;
  try{
    await saveMeta();
    if(ge('newRegPwInput')) ge('newRegPwInput').value='';
    ge('currentRegPwDisplay') && (ge('currentRegPwDisplay').textContent='●●●●');
    toast('팀등록 비밀번호 저장 완료 ✅','success');
  }catch(e){ toast('저장 실패: '+e.message,'error'); }
}

async function forceDirectorReLoginAll(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  if(!confirm('현재 로그인 중인 경기이사 세션을 모두 만료시키고, 다음 접속부터 다시 로그인하도록 하시겠습니까?')) return;
  G.meta.regSessionVersion = Number(G.meta.regSessionVersion||1) + 1;
  try{
    await saveMeta();
    forceDirectorLogoutLocal('관리자 설정으로 경기이사 세션이 만료되었습니다. 다시 로그인해 주세요.');
    toast('경기이사 전체 다시 로그인 설정 완료 ✅','success');
  }catch(e){
    G.meta.regSessionVersion = Math.max(1, Number(G.meta.regSessionVersion||2)-1);
    toast('설정 실패: '+e.message,'error');
  }
}

function toggleShowRegPw(btn){
  const el = ge('currentRegPwDisplay');
  if(!el) return;
  if(el.textContent === '●●●●'){
    el.textContent = G.meta.regPw||'(미설정)';
    btn.textContent='숨기기';
  } else {
    el.textContent='●●●●';
    btn.textContent='보기';
  }
}


// ── 등록 기한 관련 함수들 ─────────────────────────────────────────────

// 경기이사의 현재 등록 가능 여부 (기한 체크)
// ── 등록 기한: 시합별 관리 ─────────────────────────────────────
function isRegDeadlinePassed(tid){
  const _tid = tid || ge('regTS')?.value || '';
  const t = G.tournaments.find(t=>t.id===_tid);
  const dt = t?.regDeadlineDt||'';
  if(!dt) return false;
  return new Date() > new Date(dt);
}
function regDeadlineLabel(tid){
  const _tid = tid || ge('regTS')?.value || '';
  const t = G.tournaments.find(t=>t.id===_tid);
  const dt = t?.regDeadlineDt||'';
  if(!dt) return '기한 없음 (항상 허용)';
  const d = new Date(dt);
  const passed = new Date() > d;
  const fmt = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return passed ? `⛔ 기한 만료 — ${fmt}` : `✅ ${fmt} 까지 허용`;
}
async function saveRegDeadline(){
  // 대회 편집 모달(ET)에서 저장 시 호출
  const val = ge('etRegDl')?.value||'';
  const tid = CE_tid;
  if(!tid){ toast('대회를 선택하세요','error'); return; }
  const t = G.tournaments.find(t=>t.id===tid);
  if(!t) return;
  t.regDeadlineDt = val ? new Date(val).toISOString() : '';
  sl(true);
  try{
    await updateDoc(doc(db,'tournaments',tid),{regDeadlineDt: t.regDeadlineDt});
    sl(false);
    toast(val ? `등록 기한 저장 ✅ — ${regDeadlineLabel(tid)}` : '등록 기한 해제 완료 ✅','success');
  }catch(e){ sl(false); toast('저장 실패: '+e.message,'error'); }
}
function refreshRegDeadlineUI(){ /* 시합별로 이동 - 사용 안 함 */ }
async function clearRegDeadline(){ /* 시합별로 이동 - etRegDl 해제 버튼으로 처리 */ }

function openAdminSettings(){
  if(!AD){toast('관리자 로그인 필요','info');return;}
  // 입력 초기화
  ['aspCur','aspNew','aspNew2'].forEach(id=>{const el=ge(id);if(el)el.value='';});
  const ap=ge('adminPhoneInput'); if(ap) ap.value=(G.meta.adminPhone||'');
  const fn=ge('adminFloatingNoticeInput'); if(fn) fn.value=(G.meta.adminFloatingNotice||'');
  const fne=ge('adminFloatingNoticeEnabled'); if(fne) fne.checked=!!G.meta.adminFloatingNoticeEnabled;
  const ooe=ge('onlineOrderEnabled'); if(ooe) ooe.checked=!!G.meta.onlineOrderEnabled;
  const upr=ge('metaUsePlayerRegistry'); if(upr) upr.checked=!!G.meta.usePlayerRegistry;
  const sad=ge('metaShowAssociationDashboard'); if(sad) sad.checked=!!G.meta.showAssociationDashboard;
  const ufc=ge('metaUseFixedClubs'); if(ufc) ufc.checked=!!G.meta.useFixedClubs;
  const ptr=ge('metaAllowPublicTeamRegistration'); if(ptr) ptr.checked=!!G.meta.allowPublicTeamRegistration;
  const pre=ge('metaAllowPublicResultEntry'); if(pre) pre.checked=!!G.meta.allowPublicResultEntry;
  const atx=ge('metaAppTitle'); if(atx) atx.value=(G.meta.appTitle||'시합관리 시스템');
  // 잠금 설정 불러오기
  const ile=ge('indivLockEnabled'); if(ile) ile.checked=!!G.meta.indivLockEnabled;
  const ils=ge('indivLockStart');
  if(ils) ils.value = G.meta.indivLockStart
    ? new Date(G.meta.indivLockStart).toISOString().slice(0,16) : '';
  const ile2=ge('indivLockEnd');
  if(ile2) ile2.value = G.meta.indivLockEnd
    ? new Date(G.meta.indivLockEnd).toISOString().slice(0,16) : '';
  _updateIndivLockStatusDisplay();
  renderFloatingNotice();
  fillAdminPlayerClub();
  ge('apName') && (ge('apName').value='');
  // 팀등록 비번 표시 초기화
  ge('currentRegPwDisplay') && (ge('currentRegPwDisplay').textContent='●●●●');
  ge('newRegPwInput') && (ge('newRegPwInput').value='');
  ge('currentOperatorPwDisplay') && (ge('currentOperatorPwDisplay').textContent='●●●●');
  ge('currentOperatorPwInput') && (ge('currentOperatorPwInput').value='');
  ge('newOperatorPwInput') && (ge('newOperatorPwInput').value='');
  ge('newOperatorPwInput2') && (ge('newOperatorPwInput2').value='');
  renderAdminDirectorEmailSection();
  renderAdminNoticeSection();
  om('mAdminSettings');
}

function _updateIndivLockStatusDisplay(){
  const el=ge('indivLockStatus');
  if(!el) return;
  const enabled=ge('indivLockEnabled')?.checked;
  if(!enabled){ el.textContent='잠금 기능 꺼짐'; el.style.color='#64748b'; return; }
  const startVal=ge('indivLockStart')?.value;
  const endVal=ge('indivLockEnd')?.value;
  const now=new Date();
  const start=startVal ? new Date(startVal) : null;
  const end=endVal   ? new Date(endVal)   : null;
  let status='';
  if(start && now < start){
    status=`⏳ 잠금 대기 중 — ${start.toLocaleString('ko-KR')} 시작 예정`;
    el.style.color='#1565c0';
  } else if(end && now > end){
    status=`✅ 잠금 기간 종료됨 (${end.toLocaleString('ko-KR')} 완료)`;
    el.style.color='#166534';
  } else {
    status=`🔒 현재 잠금 중 — ${end ? end.toLocaleString('ko-KR')+' 까지' : '종료일 미설정'}`;
    el.style.color='#92400e';
  }
  el.textContent=status;
}
window._updateIndivLockStatusDisplay=_updateIndivLockStatusDisplay;
async function saveGenericAppSettings(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  G.meta.appTitle=(ge('metaAppTitle')?.value||'').trim()||'시합관리 시스템';
  G.meta.showAssociationDashboard=!!ge('metaShowAssociationDashboard')?.checked;
  G.meta.useFixedClubs=!!ge('metaUseFixedClubs')?.checked;
  G.meta.usePlayerRegistry=!!ge('metaUsePlayerRegistry')?.checked;
  G.meta.allowPublicTeamRegistration=!!ge('metaAllowPublicTeamRegistration')?.checked;
  G.meta.allowPublicResultEntry=!!ge('metaAllowPublicResultEntry')?.checked;
  sl(true);
  try{
    await saveMeta();
    sl(false);
    refreshAppBranding();
    popSel();
    renderRL();
    renderRegisterDivisionOverview();
    upDash();
    toast('공용 시합앱 설정 저장 완료 ✅','success');
  }catch(e){
    sl(false);
    toast('저장 실패: '+e.message,'error');
  }
}
window.saveGenericAppSettings=saveGenericAppSettings;

async function saveIndivLockSettings(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const enabled=!!ge('indivLockEnabled')?.checked;
  const startVal=ge('indivLockStart')?.value||'';
  const endVal=ge('indivLockEnd')?.value||'';
  G.meta.indivLockEnabled=enabled;
  G.meta.indivLockStart=startVal ? new Date(startVal).toISOString() : '';
  G.meta.indivLockEnd=endVal   ? new Date(endVal).toISOString()   : '';
  sl(true);
  try{
    await saveMeta();
    sl(false);
    _updateIndivLockStatusDisplay();
    applyIndivLock();
    toast(enabled ? '🔒 잠금 설정 저장됨' : '잠금 해제 저장됨','success');
  }catch(e){
    sl(false);
    toast('저장 실패: '+e.message,'error');
  }
}
window.saveIndivLockSettings=saveIndivLockSettings;

async function saveAdminPassword(){
  if(!AD){toast('관리자 로그인 필요','info');return;}
  const cur=ge('aspCur')?.value||'';
  const nw=ge('aspNew')?.value||'';
  const nw2=ge('aspNew2')?.value||'';

  if(cur!==G.meta.pw){toast('현재 비밀번호가 올바르지 않습니다','error');return;}
  if(!nw||nw.length<4){toast('새 비밀번호는 4자 이상','error');return;}
  if(nw!==nw2){toast('새 비밀번호 확인이 일치하지 않습니다','error');return;}

  G.meta.pw = nw;
  sl(true);
  try{
    await saveMeta();
    sl(false);
    toast('비밀번호 변경 완료 ✅','success');
    cm('mAdminSettings');
  }catch(e){
    sl(false);
    toast('비밀번호 저장 실패: '+e.message,'error');
  }
}


// ── 관리자: 선수 직접 추가(이름+클럽) ─────────────────────────────
function fillAdminPlayerClub(){
  const sel = ge('apClub');
  if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- 클럽 선택 --</option>' + (G.clubs||[]).map(c=>`<option value="${c}">${c}</option>`).join('');
  // 기존 선택 복원
  if(cur && [...sel.options].some(o=>o.value===cur)) sel.value = cur;
}


function openQuickAddPlayer(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  // 클럽 목록 채우기
  const sel = ge('qapClub');
  if(sel){
    const cur=sel.value;
    sel.innerHTML = '<option value="">-- 클럽 선택 --</option>' + (G.clubs||[]).map(c=>`<option value="${c}">${c}</option>`).join('');
    if(cur && [...sel.options].some(o=>o.value===cur)) sel.value=cur;
  }
  ge('qapName') && (ge('qapName').value='');
  ge('qapSubClub') && (ge('qapSubClub').value='');
  om('mQuickAddPlayer');
}

async function quickAddPlayer(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const name=(ge('qapName')?.value||'').trim();
  const club=(ge('qapClub')?.value||'').trim();
  const subClub=(ge('qapSubClub')?.value||'').trim();
  if(!name){ toast('이름을 입력하세요','error'); return; }
  if(!club){ toast('클럽을 선택하세요','error'); return; }

  const key = pKey(name, club);
  if(G.players[key]){
    toast('이미 등록된 선수입니다','info');
    return;
  }
  const qPhone=(ge('qapPhone')?.value||'').trim();
  G.players[key] = { key, name, club, clubs:[club].concat(subClub?subClub.split(',').map(s=>normalizeClub(s.trim())).filter(Boolean):[]), history:[], wins:0, losses:0, phone:qPhone||'' };

  // 2026 등록 명단에도 추가
  if(!window.G_REGISTRY) window.G_REGISTRY={};
  if(!G_REGISTRY[2026]) G_REGISTRY[2026]=[];
  const alreadyInReg = G_REGISTRY[2026].find(m=>m.name===name&&m.club===club);
  if(!alreadyInReg) G_REGISTRY[2026].push({name, club, region:'', subClub:subClub||''});

  sl(true);
  try{
    await stP(key);
    await saveRegistry(2026);
    await fbLog(`선수추가: ${name}(${club})`,'👤');
    sl(false);
    toast(`선수 추가 완료: ${name}(${club}) — 2026 명단 등록됨`,'success');
    if(ge('qapPhone')) ge('qapPhone').value='';
    if(ge('qapSubClub')) ge('qapSubClub').value='';
    cm('mQuickAddPlayer');
    renderAllP();
    popCF();
  }catch(e){
    sl(false);
    toast('선수 추가 실패: '+e.message,'error');
  }
}

async function adminAddPlayer(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const name = (ge('apName')?.value || '').trim();
  const club = (ge('apClub')?.value || '').trim();
  if(!name){ toast('이름을 입력하세요','error'); return; }
  if(!club){ toast('클럽을 선택하세요','error'); return; }

  const key = pKey(name, club); // 이름__클럽
  if(G.players[key]){
    toast('이미 등록된 선수입니다','info');
    return;
  }
  // 레거시(name-only) 플레이어가 있어도 합치지 않음 (동명이인 보호)
  const apPhone=(ge('apPhone')?.value||'').trim();
  G.players[key] = { key, name, club, clubs:[club], history:[], wins:0, losses:0, phone:apPhone||'' };

  sl(true);
  try{
    await stP(key);
    await fbLog(`선수추가: ${name}(${club})`,'👤');
    sl(false);
    toast(`선수 추가 완료: ${name}(${club})`,'success');
    ge('apName').value='';
    ge('apClub').value='';
    if(ge('apPhone')) ge('apPhone').value='';
    renderAllP();
    popCF();
  }catch(e){
    sl(false);
    toast('선수 추가 실패: '+e.message,'error');
  }
}




async function saveAdminPhone(){
  if(!AD){toast('관리자 로그인 필요','info');return;}
  const raw = (ge('adminPhoneInput')?.value||'').trim();
  // 간단 정규화: 숫자/하이픈만
  const phone = raw.replace(/[^0-9\-]/g,'');
  if(phone && phone.length < 9){ toast('휴대폰 번호를 확인해주세요','error'); return; }
  G.meta.adminPhone = phone;
  sl(true);
  try{
    await saveMeta();
    sl(false);
    toast('관리자 번호 저장 완료 ✅','success');
  }catch(e){
    sl(false);
    toast('저장 실패: '+e.message,'error');
  }
}


let INDIVIDUAL_EXCEL_ROWS = [];
function openIndividualExcelModal(){
  const tid=ge('regTS')?.value||'';
  const div=ge('regDS')?.value||'';
  const t=(G.tournaments||[]).find(x=>x.id===tid);
  if(!tid || !div || !t){ toast('대회와 부서를 먼저 선택하세요','info'); return; }
  if(!isIndividualTournament(t)){ toast('개인전 부서에서만 사용할 수 있습니다','info'); return; }
  INDIVIDUAL_EXCEL_ROWS=[];
  if(ge('individualExcelFile')) ge('individualExcelFile').value='';
  if(ge('individualExcelPreview')) ge('individualExcelPreview').innerHTML='파일을 선택하면 미리보기가 표시됩니다.';
  om('mIndividualExcelImport');
}

function _individualNormalizeCell(v){
  return String(v==null?'':v).replace(/\r/g,' ').replace(/\n/g,' ').replace(/\s+/g,' ').trim();
}
function _individualSplitPair(v){
  return _individualNormalizeCell(v).split('/').map(s=>s.trim()).filter(Boolean);
}
function _individualDetectHeader(rows){
  const scoreRow=(row)=>{
    let score=0;
    (row||[]).forEach(cell=>{
      const c=_individualNormalizeCell(cell);
      if(!c) return;
      if(/참가\s*No|참가번호|번호|No\.?/i.test(c)) score+=2;
      if(/이름|성명|참가자/.test(c)) score+=3;
      if(/구력|경력/.test(c)) score+=3;
      if(/소속|클럽/.test(c)) score+=3;
      if(/전화|휴대|연락처/.test(c)) score+=1;
      if(/비고|메모|기타/.test(c)) score+=1;
    });
    return score;
  };
  let best={idx:-1, score:0};
  (rows||[]).forEach((row,idx)=>{
    const s=scoreRow(row);
    if(s>best.score) best={idx, score:s};
  });
  return best.score>=6 ? best.idx : -1;
}
function parseIndividualExcelSheetRows(rows){
  const cleaned=(rows||[]).map(r=>Array.isArray(r)?r.map(v=>_individualNormalizeCell(v)):[]);
  const headerIdx=_individualDetectHeader(cleaned);
  const start=headerIdx>=0?headerIdx:0;
  const header=cleaned[start]||[];
  const findIdx=(patterns, fallback=-1)=>{
    for(let i=0;i<header.length;i++){
      const cell=_individualNormalizeCell(header[i]);
      if(patterns.some(rx=>rx.test(cell))) return i;
    }
    return fallback;
  };
  const noIdx=findIdx([/참가\s*No/i,/참가번호/,/번호/,/^No\.?$/i], -1);
  const nameIdx=findIdx([/이름/,/성명/,/참가자/], -1);
  const careerIdx=findIdx([/구력/,/경력/], -1);
  const clubIdx=findIdx([/소속/,/클럽/], -1);
  const phoneIdx=findIdx([/전화/,/휴대/,/연락처/], -1);
  const noteIdx=findIdx([/기타/,/비고/,/메모/], -1);

  const name1Idx=findIdx([/1번.*이름/,/참가자1.*이름/,/선수1.*이름/,/^이름1$/], -1);
  const name2Idx=findIdx([/2번.*이름/,/참가자2.*이름/,/선수2.*이름/,/^이름2$/], -1);
  const career1Idx=findIdx([/1번.*구력/,/참가자1.*구력/,/선수1.*구력/,/^구력1$/], -1);
  const career2Idx=findIdx([/2번.*구력/,/참가자2.*구력/,/선수2.*구력/,/^구력2$/], -1);
  const club1Idx=findIdx([/1번.*소속/,/1번.*클럽/,/참가자1.*소속/,/선수1.*소속/,/^소속1$/, /^클럽1$/], -1);
  const club2Idx=findIdx([/2번.*소속/,/2번.*클럽/,/참가자2.*소속/,/선수2.*소속/,/^소속2$/, /^클럽2$/], -1);
  const phone1Idx=findIdx([/1번.*전화/,/1번.*연락처/,/참가자1.*전화/,/선수1.*전화/,/^전화1$/], -1);
  const phone2Idx=findIdx([/2번.*전화/,/2번.*연락처/,/참가자2.*전화/,/선수2.*전화/,/^전화2$/], -1);

  const out=[];
  for(const row of cleaned.slice(start+1)){
    if(!row.some(Boolean)) continue;
    const no=noIdx>=0 ? _individualNormalizeCell(row[noIdx]) : '';
    let names=[], clubs=[], careers=[], phones=[];
    if(nameIdx>=0){
      names=_individualSplitPair(row[nameIdx]);
      clubs=clubIdx>=0 ? _individualSplitPair(row[clubIdx]) : [];
      careers=careerIdx>=0 ? _individualSplitPair(row[careerIdx]).map(v=>normalizeCareerValue(v)) : [];
      phones=phoneIdx>=0 ? _individualSplitPair(row[phoneIdx]).map(v=>formatPhoneLoose(v)) : [];
    }
    if(names.length<2 && name1Idx>=0 && name2Idx>=0){
      names=[_individualNormalizeCell(row[name1Idx]), _individualNormalizeCell(row[name2Idx])].filter(Boolean);
      clubs=[
        club1Idx>=0 ? _individualNormalizeCell(row[club1Idx]) : '',
        club2Idx>=0 ? _individualNormalizeCell(row[club2Idx]) : ''
      ].filter(Boolean);
      careers=[
        career1Idx>=0 ? normalizeCareerValue(row[career1Idx]) : '',
        career2Idx>=0 ? normalizeCareerValue(row[career2Idx]) : ''
      ];
      phones=[
        phone1Idx>=0 ? formatPhoneLoose(row[phone1Idx]) : '',
        phone2Idx>=0 ? formatPhoneLoose(row[phone2Idx]) : ''
      ];
    }
    if(names.length<2 || clubs.length<2){
      const compact=row.filter(Boolean);
      if(compact.length>=4){
        const maybeNames=_individualSplitPair(compact[1]||compact[0]||'');
        const maybeCareers=_individualSplitPair(compact[2]||'').map(v=>normalizeCareerValue(v));
        const maybeClubs=_individualSplitPair(compact[3]||compact[2]||'');
        if(maybeNames.length>=2 && maybeClubs.length>=2){
          names=maybeNames;
          clubs=maybeClubs;
          careers=maybeCareers;
        }
      }
    }
    if(names.length<2 || clubs.length<2) continue;
    const note=noteIdx>=0 ? _individualNormalizeCell(row[noteIdx]) : '';
    out.push({
      entryNo:no,
      note,
      players:[
        {name:names[0]||'', clubsRaw:clubs[0]||'', clubs:parseClubAliases(clubs[0]||''), phone:phones[0]||'', career:careers[0]||''},
        {name:names[1]||'', clubsRaw:clubs[1]||'', clubs:parseClubAliases(clubs[1]||''), phone:phones[1]||'', career:careers[1]||''}
      ]
    });
  }
  return out;
}
async function previewIndividualExcelFile(input){
  const file=input?.files?.[0];
  if(!file) return;
  const preview=ge('individualExcelPreview');
  if(preview) preview.innerHTML='엑셀 분석 중입니다...';
  try{
    let candidateSheets=[];
    if(/\.csv$/i.test(file.name||'')){
      const text=await file.text();
      candidateSheets=[{name:file.name, rows:text.split(/\r?\n/).map(line=>line.split(','))}];
    }else{
      const buf=await file.arrayBuffer();
      const wb=XLSX.read(buf,{type:'array'});
      candidateSheets=wb.SheetNames.map(s=>({
        name:s,
        rows:XLSX.utils.sheet_to_json(wb.Sheets[s],{header:1,defval:''})
      }));
    }
    let best=null;
    for(const sheet of candidateSheets){
      const parsed=parseIndividualExcelSheetRows(sheet.rows);
      const bonus=/배포용/.test(sheet.name||'') ? 0.5 : 0;
      const score=parsed.length + bonus;
      if(!best || score>best.score){
        best={name:sheet.name, rows:sheet.rows, parsed, score};
      }
    }
    INDIVIDUAL_EXCEL_ROWS=best?.parsed||[];
    window.__INDIVIDUAL_EXCEL_SHEET_NAME=best?.name||'';
    if(preview){
      if(!INDIVIDUAL_EXCEL_ROWS.length){
        const sample=(best?.rows||[]).slice(0,8).map(r=>(Array.isArray(r)?r.map(v=>_individualNormalizeCell(v)).join(' | '):'')).filter(Boolean).slice(0,4);
        preview.innerHTML=`<span style="color:var(--danger)">가져올 수 있는 행이 없습니다. 이름/구력/소속 컬럼을 확인해 주세요.</span>${sample.length?`<div style="margin-top:8px;font-size:.72rem;color:var(--text3)">감지된 시트: ${window.__INDIVIDUAL_EXCEL_SHEET_NAME||'-'}<br>샘플: ${sample.join('<br>')}</div>`:''}`;
      }else{
        preview.innerHTML=`<div style="font-weight:800;color:var(--primary-dark);margin-bottom:6px">감지된 참가팀 ${INDIVIDUAL_EXCEL_ROWS.length}건${window.__INDIVIDUAL_EXCEL_SHEET_NAME?` · 시트: ${window.__INDIVIDUAL_EXCEL_SHEET_NAME}`:''}</div>
          <div style="display:flex;flex-direction:column;gap:6px">${INDIVIDUAL_EXCEL_ROWS.slice(0,6).map((row,idx)=>`<div style="padding:8px 10px;background:#fff;border:1px solid var(--border);border-radius:10px"><div style="font-size:.8rem;font-weight:800">${row.entryNo||idx+1}. ${row.players[0].name} / ${row.players[1].name}</div><div style="font-size:.72rem;color:var(--text2);margin-top:3px">구력: ${(row.players[0].career||'-')} / ${(row.players[1].career||'-')} · 소속: ${row.players[0].clubsRaw} / ${row.players[1].clubsRaw}</div></div>`).join('')}</div>
          ${INDIVIDUAL_EXCEL_ROWS.length>6?`<div style="margin-top:8px;font-size:.72rem;color:var(--text3)">외 ${INDIVIDUAL_EXCEL_ROWS.length-6}건 더 있습니다.</div>`:''}`;
      }
    }
  }catch(e){
    console.error(e);
    INDIVIDUAL_EXCEL_ROWS=[];
    if(preview) preview.innerHTML=`<span style="color:var(--danger)">파일 분석 실패: ${e.message}</span>`;
  }
}
async function importIndividualExcelTeams(){
  const tid=ge('regTS')?.value||'';
  const div=ge('regDS')?.value||'';
  const t=(G.tournaments||[]).find(x=>x.id===tid);
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  if(!tid || !div || !t){ toast('대회와 부서를 먼저 선택하세요','error'); return; }
  if(!isIndividualTournament(t)){ toast('개인전 부서에서만 사용할 수 있습니다','error'); return; }
  if(!INDIVIDUAL_EXCEL_ROWS.length){ toast('먼저 엑셀 파일을 선택해 주세요','error'); return; }
  const key=tid+'_'+div;
  if(!G.teams[key]) G.teams[key]=[];
  const existing=G.teams[key];
  const maxTeams=getDivisionMaxTeams(tid,div);
  let added=0, skipped=0;
  const createdPlayers=[];
  for(const row of INDIVIDUAL_EXCEL_ROWS){
    if(maxTeams>0 && existing.length>=maxTeams){ skipped++; continue; }
    const players=row.players||[];
    if(players.length<2) { skipped++; continue; }
    const names=players.map(p=>String(p?.name||'').trim()).filter(Boolean);
    if(names.length!==2) { skipped++; continue; }
    const pairKey=[...names].sort().join('|');
    const dup=existing.find(tm=>(((tm.players||[]).slice().sort().join('|'))===pairKey));
    if(dup){ skipped++; continue; }
    const newTeam={
      club:players[0]?.clubsRaw||players[1]?.clubsRaw||'',
      players:names,
      individualPlayers:players,
      clubTokens:[...new Set(players.flatMap(p=>p.clubs||[]))],
      doublesCount:1,
      mainPlayerCount:2,
      pairLabel:getIndividualDisplayLine({individualPlayers:players}),
      entryLabel:getIndividualDisplayLine({individualPlayers:players}),
      tournamentType:'individual_pair',
      note:String(row.note||'').trim(),
      editPin:'',
      registeredAt:new Date().toISOString()
    };
    existing.push(newTeam);
    createdPlayers.push(...players);
    added++;
  }
  if(!added){ toast(skipped?'중복 또는 형식 문제로 추가된 팀이 없습니다':'추가할 팀이 없습니다','info'); return; }
  sl(true);
  try{
    await stT(key);
    await persistIndividualPlayerMeta(createdPlayers);
    sl(false);
    cm('mIndividualExcelImport');
    renderRL();
    toast(`엑셀 일괄 등록 완료 ✅ ${added}팀 추가${skipped?` · ${skipped}팀 건너뜀`:''}`,'success');
  }catch(e){
    sl(false);
    toast('엑셀 등록 실패: '+e.message,'error');
  }
}
function _getActiveTournamentLabel(){
  try{
    const at=G.tournaments.find(t=>t.status==='ongoing')||G.tournaments.find(t=>t.status==='open')||G.tournaments[0];
    return at?`${at.name} (${at.date||''})`:'';
  }catch(e){return '';}
}

// ── 클럽 경기이사 연락처 + 공지 문자 함수들 ────────────────────────────────

// 팀 등록 폼 - 클럽 선택 변경 시
function onRegClubChange(){
  const club = (ge('regClub')?.value||'').trim();
  const row = ge('regContactRow');
  if(!club){ if(row) row.style.display='none'; return; }
  const contacts = G.meta.clubContacts||{};
  const saved = contacts[club]||'';
  const lbl = ge('regContactClubLabel');
  const inp = ge('regContactPhone');
  const badge = ge('regContactSavedBadge');
  if(lbl) lbl.textContent = club;
  if(inp) inp.value = saved;
  if(badge) badge.style.display = saved ? 'inline' : 'none';
  if(row) row.style.display = 'block';
}

function onRegContactInput(){
  const badge = ge('regContactSavedBadge');
  if(badge) badge.style.display='none';
}

async function saveRegContact(){
  const club = (ge('regClub')?.value||'').trim();
  const raw = (ge('regContactPhone')?.value||'').trim();
  const phone = raw.replace(/[^0-9-]/g,'');
  if(!club){ toast('클럽을 먼저 선택하세요','error'); return; }
  if(phone && phone.length < 9){ toast('번호를 확인해주세요','error'); return; }
  // Play 스토어 정식 등록 이후 팀 등록 화면에서는 전화번호만 저장한다.
  // 과거 clubEmails 데이터는 관리자 호환성을 위해 그대로 보존한다.
  const savedEmail=(G.meta.clubEmails||{})[club]||'';
  saveClubDirectorContact(G.meta,club,phone,savedEmail);
  try{
    await saveMeta();
    ge('regContactSavedBadge') && (ge('regContactSavedBadge').style.display='inline');
    toast(`${club} 경기이사 번호 저장 완료 ✅`,'success');
    renderAdminContactList();
  renderAdminDirectorEmailSection();
  }catch(e){ toast('저장 실패: '+e.message,'error'); }
}

// 클럽 경기이사 연락처 접기/펼치기
function toggleContactList(header){
  const body = ge('contactListBody');
  const icon = ge('contactListToggleIcon');
  if(!body) return;
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  icon.textContent = isHidden ? '▲ 접기' : '▼ 펼치기';
  if(isHidden) renderAdminContactList();
}

// 관리자 설정 - 클럽 연락처 목록 렌더링
function renderAdminContactList(){
  const el = ge('adminContactList');
  if(!el) return;
  const contacts = G.meta.clubContacts||{};
  const emails = G.meta.clubEmails||{};
  const clubs = G.clubs||[];
  const withPhone = clubs.filter(c=>contacts[c]);
  const noPhone = clubs.filter(c=>!contacts[c]);
  const sorted = [...withPhone, ...noPhone];
  if(!sorted.length){ el.innerHTML='<div style="font-size:.78rem;color:var(--text3)">등록된 클럽이 없습니다.</div>'; return; }
  const passwords = G.meta.clubPasswords||{};
  const customMap = G.meta.clubPasswordCustom||{};
  const notChanged = sorted.filter(c=>!customMap[c]);
  const summary = notChanged.length
    ? `<div style="margin-bottom:12px;padding:10px 12px;background:linear-gradient(135deg,#fff1f2,#ffe4e6);border:1.5px solid #fca5a5;border-radius:10px;font-size:.82rem;color:#991b1b">
        <div style="font-weight:800;margin-bottom:4px">⚠️ 비밀번호 미변경 클럽: ${notChanged.length}개</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${notChanged.map(c=>`<span style="background:#fee2e2;border:1px solid #fca5a5;border-radius:6px;padding:2px 8px;font-size:.76rem;font-weight:700">${c}</span>`).join('')}</div>
        <div style="font-size:.72rem;margin-top:6px;color:#b91c1c">해당 클럽 경기이사가 로그인하면 비번 변경 안내가 자동으로 표시됩니다.</div>
      </div>`
    : `<div style="margin-bottom:12px;padding:8px 12px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;font-size:.82rem;color:#166534;font-weight:700">✅ 전체 클럽 비밀번호 변경 완료</div>`;
  el.innerHTML = summary + sorted.map(club=>{
    const phone = contacts[club]||'';
    const email = emails[club]||'';
    const phone4 = phone.replace(/[^0-9]/g,'').slice(-4);
    const pw = passwords[club]||(phone4.length===4?phone4:'');
    const isCustom = !!((G.meta.clubPasswordCustom||{})[club]);
    const statusTxt = isCustom ? '✅ 전용 비번 설정' : '⚠️ 미변경';
    const statusColor = isCustom ? 'var(--success)' : '#dc2626';
    const statusBg = isCustom ? '' : 'background:linear-gradient(135deg,#fff1f2,#ffe4e6);border-radius:8px;padding:2px 0;';
    return `<div style="padding:7px 0;border-bottom:1px dashed var(--border);${statusBg}">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">
        <span style="min-width:65px;font-size:.82rem;font-weight:${phone?'700':'400'};color:${phone?'var(--text1)':'var(--text3)'}">${club}</span>
        <input class="form-input" value="${phone}" placeholder="번호 없음" id="cc_${club}" inputmode="tel"
          style="flex:1;min-width:110px;font-size:.8rem;padding:4px 8px">
        <button class="btn btn-outline" style="font-size:.74rem;padding:3px 8px;white-space:nowrap" onclick="saveContactFromAdmin('${club}')">💾</button>
        ${phone?`<a href="sms:${phone.replace(/[^0-9+]/g,'')}" style="text-decoration:none"><button class="btn btn-gray" style="font-size:.74rem;padding:3px 8px">📱</button></a>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:${email?'4px':'0'}">
        <span style="min-width:65px;font-size:.72rem;color:var(--text3)">🔑 비밀번호</span>
        <input class="form-input" value="${pw}" placeholder="뒷4자리 자동" id="cpw_${club}" maxlength="20"
          style="flex:1;min-width:100px;font-size:.8rem;padding:4px 8px" type="text">
        <span style="font-size:.72rem;font-weight:700;color:${statusColor};white-space:nowrap">${statusTxt}</span>
        <button class="btn btn-outline" style="font-size:.74rem;padding:3px 8px;white-space:nowrap;color:#1565c0" onclick="saveClubPassword('${club}')">🔑저장</button>
        <button class="btn btn-danger" style="font-size:.74rem;padding:3px 8px;white-space:nowrap" onclick="resetClubPassword('${club}')">초기화</button>
      </div>
      ${email?`<div style="font-size:.72rem;color:#1a73e8;padding-left:2px">📧 ${email}</div>`:''}
    </div>`;
  }).join('');
}

async function saveClubPassword(club){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const pw = (ge('cpw_'+club)?.value||'').trim();
  if(!pw){ toast('비밀번호를 입력하세요','error'); return; }
  setClubPassword(G.meta,club,pw,{custom:true});
  try{
    await saveMeta();
    toast(`${club} 비밀번호 저장 완료 ✅`,'success');
  }catch(e){ toast('저장 실패: '+e.message,'error'); }
}

async function resetClubPassword(club){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const tempPw = getClubTempPassword(club);
  if(!confirm(`${club} 클럽 비밀번호를 임시 비밀번호로 초기화하시겠습니까?\n초기화 후에는 해당 클럽이 다시 로그인할 때 전용 비밀번호를 강제로 새로 설정해야 합니다.`)) return;
  resetClubPasswordToTemporary(G.meta,club);
  try{
    await saveMeta();
    renderAdminContactList();
    toast(`${club} 비밀번호 초기화 완료 ✅ (임시 비밀번호로 복귀)`,'success');
  }catch(e){ toast('초기화 실패: '+e.message,'error'); }
}

async function saveContactFromAdmin(club){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const raw = (ge('cc_'+club)?.value||'').trim();
  const phone = raw.replace(/[^0-9-]/g,'');
  if(phone && phone.length < 9){ toast('번호를 확인해주세요','error'); return; }
  // 전화번호 저장 + 기존 비밀번호가 없을 때만 뒷 4자리 임시비번 자동 설정
  saveClubContact(G.meta,club,phone,{setPasswordIfMissing:true});
  try{
    await saveMeta();
    const last4 = phone.replace(/[^0-9]/g,'').slice(-4);
    toast(`${club} 번호 저장 완료 ✅ (비밀번호: ${last4||'미설정'})`, 'success');
    renderAdminContactList();
    renderNoticeContactBtns();
  }catch(e){ toast('저장 실패: '+e.message,'error'); }
}

// 공지 문자 내용 자동 완성
function prefillNoticeMsg(type){
  const tid = (G.tournaments.find(t=>t.status==='ongoing')||G.tournaments.find(t=>t.status==='open')||G.tournaments.find(t=>t.status==='closed')||G.tournaments[0])?.id||'';
  const t = G.tournaments.find(x=>x.id===tid);
  const tname = t?.name||'(대회명 없음)';
  const tdate = t?.date||'';
  let lines = [];

  if(type==='roster'){
    lines = [`[${tname}] 팀 등록 현황`, tdate?`📅 ${tdate}`:'', ''];
    if(tid && t){
      (t.divisions||[]).forEach(d=>{
        const key=tid+'_'+d;
        const teams=G.teams[key]||[];
        const total=teams.reduce((s,tm)=>s+(tm.players||[]).length,0);
        lines.push(`${dl(d)}: ${teams.length}팀 / ${total}명`);
        teams.forEach((tm,i)=>lines.push(`  ${i+1}. ${tm.club} (${(tm.players||[]).length}명)`));
        lines.push('');
      });
    }
    lines.push('📋 앱에서 상세 확인 가능합니다.');

  }else if(type==='bracket_draw'){
    lines = [`[${tname}] 추첨 결과 안내`, tdate?`📅 ${tdate}`:'', '추첨이 완료되었습니다.', ''];
    if(tid && t){
      (t.divisions||[]).forEach(d=>{
        const key=tid+'_'+d;
        const draw=G.draws[key];
        const teams=G.teams[key]||[];
        if(!draw){ lines.push(`${dl(d)}: 추첨 미완료`); return; }
        lines.push(`📌 ${dl(d)} 추첨 결과:`);
        (draw.groups||[]).forEach((g,gi)=>{
          lines.push(`  ${gi+1}조: ${g.map(ti=>teams[ti]?.club||'?').join(' vs ')}`);
        });
        lines.push('');
      });
    }
    lines.push('📱 대진표 이미지는 별도 공유드립니다.');

  }else if(type==='final_result'){
    lines = [`[${tname}] 최종 결과`, tdate?`📅 ${tdate}`:'', ''];
    if(tid && t){
      (t.divisions||[]).forEach(d=>{
        const key=tid+'_'+d;
        const teams=G.teams[key]||[];
        const medals=['🥇','🥈','🥉'];
        lines.push(`🏅 ${dl(d)}`);
        const ranked=teams.map((tm,i)=>({...tm,_idx:i})).filter(tm=>tm.rank).sort((a,b)=>a.rank-b.rank);
        if(ranked.length){
          ranked.slice(0,3).forEach((tm,i)=>lines.push(`  ${medals[i]||''} ${tm.club}`));
        } else { lines.push('  (결과 미입력)'); }
        lines.push('');
      });
    }
    lines.push('참가해주신 모든 선수 여러분 수고하셨습니다! 🎾');
  }

  const msg = lines.filter((l,i)=>!(i===1&&!tdate)).join('\n');
  const ta=ge('noticeMsg');
  if(ta) ta.value=msg;
  renderNoticeContactBtns();
}

// 문자 발송 버튼 목록 렌더링
// ── 선택된 클럽 체크박스 상태 추적 ─────────────────────────────────────────
let _selClubs = new Set(); // 체크된 클럽 목록
let _noticeWithPhone = []; // 전화번호 있는 클럽 캐시

function renderNoticeContactBtns(){
  const el = ge('noticeContactBtns');
  if(!el) return;
  const contacts = G.meta.clubContacts||{};
  _noticeWithPhone = (G.clubs||[]).filter(c=>contacts[c]);
  if(!_noticeWithPhone.length){
    el.innerHTML='<div style="font-size:.78rem;color:var(--text3);padding:6px 0">등록된 경기이사 번호가 없습니다.<br>위 "클럽 경기이사 연락처 관리"에서 번호를 추가하세요.</div>';
    return;
  }
  // 처음 렌더링 시 전체 선택 상태 초기화
  if(_selClubs.size === 0) _noticeWithPhone.forEach(c=>_selClubs.add(c));

  el.innerHTML = `
    <!-- 클럽 체크박스 선택 영역 -->
    <div style="background:var(--panel2);border-radius:10px;padding:10px 12px;margin-bottom:10px;border:1px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px;flex-wrap:wrap">
        <div style="font-size:.82rem;font-weight:700;color:var(--text1)">📋 받는 경기이사 선택</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-gray" style="font-size:.72rem;padding:3px 10px" onclick="selAllClubs(true)">전체선택</button>
          <button class="btn btn-gray" style="font-size:.72rem;padding:3px 10px" onclick="selAllClubs(false)">전체해제</button>
        </div>
      </div>
      <div id="clubCheckboxArea" style="display:flex;flex-wrap:wrap;gap:6px">
        ${_noticeWithPhone.map(club=>`
          <label id="clublabel_${CSS.escape(club)}" style="display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:20px;
            border:1.5px solid ${_selClubs.has(club)?'var(--primary)':'var(--border)'};
            background:${_selClubs.has(club)?'rgba(37,99,235,.1)':'transparent'};
            cursor:pointer;font-size:.8rem;font-weight:${_selClubs.has(club)?'700':'400'};
            color:${_selClubs.has(club)?'var(--primary)':'var(--text2)'};user-select:none">
            <input type="checkbox" ${_selClubs.has(club)?'checked':''} onchange="toggleClubSel('${club.replace(/'/g,"\\'")}',this.checked)" style="accent-color:var(--primary)">
            ${club}
          </label>
        `).join('')}
      </div>
      <div id="selClubCount" style="font-size:.72rem;color:var(--text3);margin-top:7px">
        선택된 클럽: <b style="color:var(--primary)">${_selClubs.size}</b> / ${_noticeWithPhone.length}개
      </div>
    </div>

    <!-- 문자 발송 영역 -->
    <div style="background:linear-gradient(135deg,#e3f2fd,#f0f8ff);border-radius:10px;padding:10px 12px;margin-bottom:8px;border:1px solid #bbdefb">
      <div style="font-size:.8rem;font-weight:700;color:#1565c0;margin-bottom:8px">📱 문자(SMS) 발송</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn" style="font-size:.78rem;padding:7px 14px;background:#1976d2;color:#fff;border:none;border-radius:8px;flex:1;min-width:120px"
          onclick="sendSmsSelected()">
          ✉️ 선택 번호 문자 한번에
        </button>
        <button class="btn" style="font-size:.78rem;padding:7px 14px;background:#0d47a1;color:#fff;border:none;border-radius:8px;flex:1;min-width:120px"
          onclick="sendSmsAll()">
          📨 전체 문자 한번에 (${_noticeWithPhone.length}개)
        </button>
      </div>
      <div style="font-size:.7rem;color:#1565c0;margin-top:6px;line-height:1.5;padding:5px 8px;background:rgba(255,255,255,.6);border-radius:6px">
        📱 모바일: 선택된 번호들을 한 번에 넣은 문자앱이 열립니다.<br>
        🖥️ PC: 번호 목록+내용이 클립보드에 복사됩니다.
      </div>
    </div>

    <!-- 카카오톡 발송 영역 -->
    <div style="background:linear-gradient(135deg,#fffde7,#fff9c4);border-radius:10px;padding:10px 12px;margin-bottom:8px;border:1px solid #f9a825">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="font-size:1.1rem">💛</span>
        <span style="font-size:.8rem;font-weight:700;color:#92400e">카카오톡 발송</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
        <button class="btn" style="font-size:.78rem;padding:7px 14px;background:#fee500;color:#3c1e1e;border:none;border-radius:8px;flex:1;min-width:120px;font-weight:700"
          onclick="sendKakaoSelected()">
          💬 선택 클럽 내용 복사
        </button>
        <button class="btn" style="font-size:.78rem;padding:7px 14px;background:#f9c400;color:#3c1e1e;border:none;border-radius:8px;flex:1;min-width:120px;font-weight:700"
          onclick="sendKakaoAll()">
          💛 전체 내용 복사 (${_noticeWithPhone.length}개)
        </button>
      </div>
      <div style="font-size:.7rem;color:#78350f;line-height:1.5;background:rgba(255,255,255,.6);border-radius:6px;padding:5px 8px">
        내용 복사 후 카카오톡 단톡방에 붙여넣으세요
      </div>
    </div>

    <div style="font-size:.7rem;color:var(--text3);line-height:1.5;padding:6px 8px;background:var(--panel2);border-radius:6px">
      💡 내용 복사 후 카카오톡 단톡방에 붙여넣으세요
    </div>`;
}

// 체크박스 상태만 업데이트 (전체 re-render 없이)
function _updateClubLabelStyle(club){
  const sel = _selClubs.has(club);
  // label 스타일 업데이트
  const labels = document.querySelectorAll('#clubCheckboxArea label');
  labels.forEach(lbl=>{
    const cb = lbl.querySelector('input[type=checkbox]');
    if(!cb) return;
    // onchange 속성에서 클럽명 추출
    const oc = cb.getAttribute('onchange')||'';
    const m = oc.match(/toggleClubSel\('(.+?)',/);
    if(!m) return;
    const c = m[1].replace(/\\'/g,"'");
    const s = _selClubs.has(c);
    lbl.style.borderColor = s?'var(--primary)':'var(--border)';
    lbl.style.background = s?'rgba(37,99,235,.1)':'transparent';
    lbl.style.fontWeight = s?'700':'400';
    lbl.style.color = s?'var(--primary)':'var(--text2)';
    cb.checked = s;
  });
  // 카운트 업데이트
  const cnt = ge('selClubCount');
  if(cnt) cnt.innerHTML = `선택된 클럽: <b style="color:var(--primary)">${_selClubs.size}</b> / ${_noticeWithPhone.length}개`;
}

function toggleClubSel(club, checked){
  if(checked === undefined) checked = !_selClubs.has(club);
  if(checked) _selClubs.add(club);
  else _selClubs.delete(club);
  _updateClubLabelStyle(club);
}

function selAllClubs(selectAll){
  const contacts = G.meta.clubContacts||{};
  const withPhone = (G.clubs||[]).filter(c=>contacts[c]);
  _selClubs.clear();
  if(selectAll) withPhone.forEach(c=>_selClubs.add(c));
  // 전체 label 일괄 스타일 업데이트
  const labels = document.querySelectorAll('#clubCheckboxArea label');
  labels.forEach(lbl=>{
    const cb = lbl.querySelector('input[type=checkbox]');
    if(!cb) return;
    const oc = cb.getAttribute('onchange')||'';
    const m = oc.match(/toggleClubSel\('(.+?)',/);
    if(!m) return;
    const c = m[1].replace(/\\'/g,"'");
    const s = _selClubs.has(c);
    lbl.style.borderColor = s?'var(--primary)':'var(--border)';
    lbl.style.background = s?'rgba(37,99,235,.1)':'transparent';
    lbl.style.fontWeight = s?'700':'400';
    lbl.style.color = s?'var(--primary)':'var(--text2)';
    cb.checked = s;
  });
  const cnt = ge('selClubCount');
  if(cnt) cnt.innerHTML = `선택된 클럽: <b style="color:var(--primary)">${_selClubs.size}</b> / ${withPhone.length}개`;
}

// ── 문자(SMS) 발송 ──────────────────────────────────────────────────────────
function _checkBodyAndGet(){
  const body = (ge('noticeMsg')?.value||'').trim();
  if(!body){ toast('공지 내용을 먼저 입력하세요','error'); return null; }
  return body;
}


// ── 복사 공용 유틸 ─────────────────────────────────────────────────────────
function _copyFallback(text){
  try{
    const ta=document.createElement('textarea');
    ta.value=text;
    ta.style.cssText='position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  }catch(_e){
    return false;
  }
}

async function copyTextSafe(text){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(text);
      return true;
    }
  }catch(_e){}
  return _copyFallback(text);
}

function sendSmsSelected(){
  const body = _checkBodyAndGet(); if(!body) return;
  const contacts = G.meta.clubContacts||{};
  const targets = [..._selClubs].filter(c=>contacts[c]);
  if(!targets.length){ toast('선택된 클럽이 없습니다','error'); return; }
  sendSmsBulk(targets, body, '선택 번호');
}

function sendSmsAll(){
  const body = _checkBodyAndGet(); if(!body) return;
  const contacts = G.meta.clubContacts||{};
  const all = (G.clubs||[]).filter(c=>contacts[c]);
  if(!all.length){ toast('등록된 번호가 없습니다','error'); return; }
  if(!confirm(`전체 ${all.length}개 클럽 번호를 한 번에 넣은 문자창을 엽니다.

${all.join(', ')}

계속하시겠습니까?`)) return;
  sendSmsBulk(all, body, '전체');
}

function sendSmsBulk(clubs, body, modeLabel='선택 번호'){
  const contacts = G.meta.clubContacts||{};
  const phones = [...new Set(clubs.map(c=>(contacts[c]||'').replace(/[^0-9+]/g,'')).filter(Boolean))];
  if(!phones.length){ toast('보낼 번호가 없습니다','error'); return; }

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if(!isMobile){
    const allLines = clubs.map(c=>`${c}: ${contacts[c]||''}`).join('\\n');
    const copyText = `[수신자]
${allLines}

[내용]
${body}`;
    navigator.clipboard.writeText(copyText)
      .then(()=>toast(`📋 PC: ${modeLabel} 번호 ${phones.length}개와 내용이 복사됐습니다. 문자앱에 붙여넣으세요.`,'info'))
      .catch(()=>{ alert(copyText); });
    return;
  }

  const recipients = phones.join(',');
  const smsUrl = `sms:${recipients}?body=${encodeURIComponent(body)}`;
  window.location.href = smsUrl;
  toast(`✅ ${modeLabel} 문자창을 한 번에 열었습니다 (${phones.length}개 번호)`,'success');
}

// ── 카카오톡 발송 ───────────────────────────────────────────────────────────
const KAKAO_JS_KEY = '9dee117ad9f0ea8f08467597240f5f86';

function ensureKakaoReady(){
  try{
    if(typeof window.Kakao === 'undefined'){
      console.warn('Kakao SDK not loaded');
      return false;
    }
    if(!window.Kakao.isInitialized || !window.Kakao.isInitialized()){
      window.Kakao.init(KAKAO_JS_KEY);
    }
    return true;
  }catch(err){
    console.error('Kakao init failed', err);
    return false;
  }
}

async function shareViaKakaoTalk(text){
  if(!ensureKakaoReady()) return false;
  try{
    window.Kakao.Share.sendDefault({
      objectType: 'text',
      text,
      link: {
        mobileWebUrl: window.location.href,
        webUrl: window.location.href
      },
      buttons: [{
        title: '앱 열기',
        link: {
          mobileWebUrl: window.location.href,
          webUrl: window.location.href
        }
      }]
    });
    return true;
  }catch(err){
    console.error('Kakao share failed', err);
    return false;
  }
}

async function shareOrCopyKakaoMsg(clubs, body){
  let msg;
  if(clubs.length === 1){
    msg = body;
  } else {
    const header = clubs.map(c=>`• ${c}`).join('\n');
    msg = `[발송 대상]\n${header}\n\n${body}`;
  }

  const shared = await shareViaKakaoTalk(msg);
  if(shared){
    toast('카카오톡 공유창을 열었습니다.','success');
    return;
  }

  const ok = await copyTextSafe(msg);
  if(ok){
    toast(`📋 ${clubs.length}개 클럽 발송 내용이 복사됐습니다! 카카오톡에 붙여넣으세요.`,'info');
  } else {
    alert(`아래 내용을 복사하세요:\n\n${msg}`);
  }
}

async function sendKakaoSelected(){
  const body = _checkBodyAndGet(); if(!body) return;
  const contacts = G.meta.clubContacts||{};
  const targets = [..._selClubs].filter(c=>contacts[c]);
  if(!targets.length){ toast('선택된 클럽이 없습니다','error'); return; }
  await shareOrCopyKakaoMsg(targets, body);
}

async function sendKakaoAll(){
  const body = _checkBodyAndGet(); if(!body) return;
  const contacts = G.meta.clubContacts||{};
  const all = (G.clubs||[]).filter(c=>contacts[c]);
  if(!all.length){ toast('등록된 번호가 없습니다','error'); return; }
  await shareOrCopyKakaoMsg(all, body);
}

// 선택된 클럽 전체를 하나의 메시지로 합쳐서 복사
async function _buildAndCopyKakaoMsg(clubs, body){
  return shareOrCopyKakaoMsg(clubs, body);
}

function openKakaoApp(){
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if(!isMobile){
    toast('PC에서는 카카오톡 앱을 직접 실행하세요.','info');
    return;
  }
  try{
    window.open('kakaotalk://','_self');
  }catch(e){
    window.location.href='kakaotalk://';
  }
}

async function copyMsgOnly(){
  const body = _checkBodyAndGet(); if(!body) return;
  const ok = await copyTextSafe(body);
  if(ok){
    toast('📋 내용 복사됨! 카카오톡에 붙여넣으세요','success');
  } else {
    toast('내용을 수동으로 복사해주세요','info');
  }
}

// 대진표 이미지 캡처 및 저장 (카카오톡 공유용)
async function captureAndShareBracket(mode){
  // 먼저 대진표 탭으로 이동하여 표시
  const bracketEl = ge('bracketContent');
  if(!bracketEl){ toast('대진표 탭을 먼저 열어주세요','info'); return; }

  // html2canvas 로드
  if(!window.html2canvas){
    toast('이미지 생성 준비 중...','info');
    await new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload=res; s.onerror=rej; document.head.appendChild(s);
    });
  }

  // 현재 대진표 탭의 내용을 캡처
  const tid = ge('brTS')?.value || (G.tournaments.find(t=>t.status==='ongoing')||G.tournaments[0])?.id||'';
  const t = G.tournaments.find(x=>x.id===tid);

  if(!tid || !t){
    toast('대진표 탭에서 대회를 먼저 선택하세요','info');
    showPage('bracket');
    return;
  }

  if(!bracketEl.querySelector('.t-bracket,.grp-card,.rr-team-card')){
    toast('대진표 탭에서 대회/부서를 선택하면 이미지를 저장할 수 있습니다','info');
    showPage('bracket');
    return;
  }

  toast('이미지 생성 중... 잠시 기다려주세요','info');
  try{
    const canvas = await html2canvas(bracketEl,{scale:3,backgroundColor:'#f0f4fa',useCORS:true,logging:false});
    const a = document.createElement('a');
    const fname = mode==='preview'
      ? `예상대진_${t.name}_${new Date().toISOString().substring(0,10)}.png`
      : `대진표_${t.name}_${new Date().toISOString().substring(0,10)}.png`;
    a.href = canvas.toDataURL('image/png');
    a.download = fname;
    a.click();
    toast('이미지 저장 완료 🖼️ 카카오톡에서 공유하세요','success');
  }catch(e){
    toast('이미지 저장 실패. 대진표 탭에서 직접 저장해주세요','error');
    showPage('bracket');
  }
}

// openAdminSettings에서 연락처/공지 렌더링 추가 (기존 함수에서 호출)

function renderAdminDirectorEmailSection(){
  const wrap = ge('adminDirectorEmailSection');
  if(!wrap) return;

  const clubEmails = G.meta?.clubEmails || {};
  const clubContacts = G.meta?.clubContacts || {};
  const clubs = G.clubs || [];

  const rows = clubs.map(club => ({
    club,
    phone: String(clubContacts[club] || '').trim(),
    email: String(clubEmails[club] || '').trim().toLowerCase()
  })).filter(r => r.email);

  const uniq = new Map();
  rows.forEach(r=>{
    const k = [r.club, r.phone, r.email].join('|');
    if(!uniq.has(k)) uniq.set(k, r);
  });
  const items = [...uniq.values()].sort((a,b)=>
    String(a.club||'').localeCompare(String(b.club||''), 'ko')
  );
  const emailCount = items.length;

  if(!items.length){
    wrap.innerHTML = `<div class="card" style="margin-top:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <div style="font-weight:800">📧 경기이사 (이메일 등록: 0명)</div>
        <div style="font-size:.78rem;color:var(--text2)">이메일 입력한 경기이사만 표시</div>
      </div>
      <div style="font-size:.82rem;color:var(--text3)">이메일을 입력한 경기이사가 없습니다.</div>
    </div>`;
    return;
  }

  wrap.innerHTML = `<div class="card" style="margin-top:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <div style="font-weight:800">📧 경기이사 (이메일 등록: ${emailCount}명)</div>
      <div style="font-size:.78rem;color:var(--text2)">이메일 입력한 경기이사만 표시</div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>클럽</th>
            <th>전화</th>
            <th>이메일</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(r=>`<tr>
            <td>${r.club || '-'}</td>
            <td>${r.phone || '-'}</td>
            <td>${r.email}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderAdminNoticeSection(){
  renderAdminContactList();
  renderNoticeContactBtns();
}

function ensureFloatingNoticeEl(){
  let el=ge('brFloatingNotice');
  if(el) return el;
  el=document.createElement('div');
  el.id='brFloatingNotice';
  el.className='br-floating-notice';
  el.innerHTML=`<span class="tag" title="끌어서 위치 이동">📢 전체 공지</span><div class="text"><div class="marquee"><span class="msg"></span><span class="msg" aria-hidden="true"></span></div></div><div class="actions"><button class="btnx" onclick="hideFloatingNoticeForNow()">숨기기</button></div>`;
  document.body.appendChild(el);
  initFloatingNoticeDrag(el);
  restoreFloatingNoticePosition(el);
  return el;
}
function shouldShowFloatingNotice(){
  return !!(G.meta?.adminFloatingNoticeEnabled && (G.meta?.adminFloatingNotice||'').trim() && !window.__hideFloatingNoticeOnce);
}
function getFloatingNoticePositionKey(){ return 'kimhae_floating_notice_position_v2'; }
function clampFloatingNoticePosition(x, y, el){
  const rect=el?.getBoundingClientRect?.() || {width:320,height:48};
  const margin=8;
  const maxX=Math.max(margin, window.innerWidth - Math.min(rect.width||320, window.innerWidth-margin*2) - margin);
  const maxY=Math.max(margin, window.innerHeight - Math.min(rect.height||54, window.innerHeight-margin*2) - margin);
  return {x:Math.min(Math.max(margin, Number(x)||margin), maxX), y:Math.min(Math.max(margin, Number(y)||margin), maxY)};
}
function applyFloatingNoticePosition(el, pos){
  if(!el || !pos) return;
  const p=clampFloatingNoticePosition(pos.x,pos.y,el);
  el.style.setProperty('left', p.x+'px', 'important');
  el.style.setProperty('top', p.y+'px', 'important');
  el.style.setProperty('right', 'auto', 'important');
  el.style.setProperty('bottom', 'auto', 'important');
  el.style.setProperty('transform', 'none', 'important');
  el.dataset.moved='1';
}
function restoreFloatingNoticePosition(el){
  try{
    const raw=localStorage.getItem(getFloatingNoticePositionKey());
    if(!raw) return;
    const pos=JSON.parse(raw);
    if(pos && Number.isFinite(Number(pos.x)) && Number.isFinite(Number(pos.y))){
      requestAnimationFrame(()=>applyFloatingNoticePosition(el,pos));
    }
  }catch(e){}
}
function saveFloatingNoticePosition(el){
  try{
    const rect=el.getBoundingClientRect();
    localStorage.setItem(getFloatingNoticePositionKey(), JSON.stringify({x:Math.round(rect.left), y:Math.round(rect.top)}));
  }catch(e){}
}
function resetFloatingNoticePosition(ev){
  try{ ev?.stopPropagation?.(); ev?.preventDefault?.(); }catch(e){}
  const el=ensureFloatingNoticeEl();
  try{ localStorage.removeItem(getFloatingNoticePositionKey()); }catch(e){}
  el.style.removeProperty('left');
  el.style.removeProperty('top');
  el.style.removeProperty('right');
  el.style.removeProperty('bottom');
  el.style.removeProperty('transform');
  delete el.dataset.moved;
}
function initFloatingNoticeDrag(el){
  if(!el || el.dataset.dragReady==='1') return;
  el.dataset.dragReady='1';
  let dragging=false, startX=0, startY=0, baseX=0, baseY=0, pointerId=null;
  const start=(ev)=>{
    if(ev.target && ev.target.closest && ev.target.closest('.actions')) return;
    if(ev.button!=null && ev.button!==0) return;
    dragging=true;
    pointerId=ev.pointerId;
    const rect=el.getBoundingClientRect();
    startX=ev.clientX; startY=ev.clientY; baseX=rect.left; baseY=rect.top;
    try{ el.setPointerCapture(pointerId); }catch(e){}
    el.style.transition='none';
    ev.preventDefault();
  };
  const move=(ev)=>{
    if(!dragging) return;
    const next=clampFloatingNoticePosition(baseX+(ev.clientX-startX), baseY+(ev.clientY-startY), el);
    el.style.setProperty('left', next.x+'px', 'important');
    el.style.setProperty('top', next.y+'px', 'important');
    el.style.setProperty('right', 'auto', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
    el.style.setProperty('transform', 'none', 'important');
    el.dataset.moved='1';
    ev.preventDefault();
  };
  const end=(ev)=>{
    if(!dragging) return;
    dragging=false;
    try{ el.releasePointerCapture(pointerId); }catch(e){}
    pointerId=null;
    saveFloatingNoticePosition(el);
  };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  window.addEventListener('resize', ()=>{ if(el.dataset.moved==='1') restoreFloatingNoticePosition(el); });
}
window.resetFloatingNoticePosition=resetFloatingNoticePosition;
function renderFloatingNotice(){
  const el=ensureFloatingNoticeEl();
  const textWrap=el.querySelector('.text');
  const marquee=el.querySelector('.text .marquee');
  const msgs=el.querySelectorAll('.text .msg');
  const notice=(G.meta?.adminFloatingNotice||'').trim();
  msgs.forEach(n=>n.textContent=notice || ' ');
  const show=shouldShowFloatingNotice();
  el.classList.toggle('show', show);
  el.style.display=show?'flex':'none';
  if(show && el.dataset.moved!=='1') restoreFloatingNoticePosition(el);
  if(textWrap && marquee){
    requestAnimationFrame(()=>{
      const first=el.querySelector('.text .msg');
      const contentW=Math.max(first?.scrollWidth||0, notice.length*12);
      const boxW=Math.max(1, textWrap.clientWidth||0);
      const needsScroll = notice.length > 20 || contentW > boxW - 8;
      textWrap.classList.toggle('static', !needsScroll);
      if(needsScroll){
        const seconds=Math.max(10, Math.min(28, Math.ceil((contentW + boxW)/55)));
        marquee.style.animationDuration = seconds + 's';
        marquee.style.animationPlayState = 'running';
      }else{
        marquee.style.animationDuration = '0s';
        marquee.style.animationPlayState = 'paused';
      }
    });
  }
}
async function saveFloatingNoticeSettings(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const input=ge('adminFloatingNoticeInput');
  const check=ge('adminFloatingNoticeEnabled');
  G.meta.adminFloatingNotice=(input?.value||'').trim();
  G.meta.adminFloatingNoticeEnabled=!!check?.checked;
  window.__hideFloatingNoticeOnce=false;
  try{
    await saveMeta();
    renderFloatingNotice();
    setTimeout(renderFloatingNotice, 80);
    toast('공지 저장 완료 ✅','success');
  }catch(e){ console.error(e); toast('저장 실패: '+e.message,'error'); }
}
async function clearFloatingNotice(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  G.meta.adminFloatingNotice='';
  G.meta.adminFloatingNoticeEnabled=false;
  window.__hideFloatingNoticeOnce=false;
  const inp=ge('adminFloatingNoticeInput'); if(inp) inp.value='';
  const chk=ge('adminFloatingNoticeEnabled'); if(chk) chk.checked=false;
  try{
    await saveMeta();
    renderFloatingNotice();
    toast('공지 지움 완료','success');
  }catch(e){ console.error(e); toast('저장 실패: '+e.message,'error'); }
}
window.forceDirectorReLoginAll = forceDirectorReLoginAll;
window.saveFloatingNoticeSettings = saveFloatingNoticeSettings;
window.clearFloatingNotice = clearFloatingNotice;
window.hideFloatingNoticeForNow = hideFloatingNoticeForNow;
function hideFloatingNoticeForNow(){
  window.__hideFloatingNoticeOnce=true;
  renderFloatingNotice();
}
function ensureOpStickyRibbonEl(){
  let el=ge('opStickyRibbon');
  if(el) return el;
  el=document.createElement('div');
  el.id='opStickyRibbon';
  el.className='op-sticky-ribbon';
  document.body.appendChild(el);
  return el;
}
function canShowOpStickyRibbon(){
  return !!(AD || OP) && !window.__hideOpStickyRibbon;
}
function hideOpStickyRibbon(){
  window.__hideOpStickyRibbon=true;
  try{ sessionStorage.setItem('hideOpStickyRibbon','1'); }catch(e){}
  renderOpStickyRibbonFromMarker(null);
}
function resetOpStickyRibbon(){
  window.__hideOpStickyRibbon=false;
  try{ sessionStorage.removeItem('hideOpStickyRibbon'); }catch(e){}
  updateOperationSticky();
}
try{ window.__hideOpStickyRibbon = sessionStorage.getItem('hideOpStickyRibbon')==='1'; }catch(e){ window.__hideOpStickyRibbon=false; }
function renderOpStickyRibbonFromMarker(marker){
  const el=ensureOpStickyRibbonEl();
  if(!marker || !canShowOpStickyRibbon()){ el.classList.remove('show'); el.style.display='none'; el.innerHTML=''; return; }
  const cls=(marker.className||'').split(/\s+/).find(x=>/^op-banner-/.test(x))||'op-banner-blue';
  const mobileLowered = window.innerWidth <= 680 ? ' mobile-lowered' : '';
  el.className='op-sticky-ribbon show '+cls+mobileLowered;
  const label=marker.dataset.opLabel||'운영';
  const stats=marker.dataset.opStats||'';
  const sub=marker.dataset.opSub||'';
  el.style.display='inline-flex';
  el.innerHTML=`<span>🏁 ${label}</span><span class="mini">운영중</span>${stats?`<span class="mini">${stats}</span>`:''}${sub?`<span class="sub">${sub}</span>`:''}<button class="closex" onclick="hideOpStickyRibbon()">숨기기</button>`;
}
window.hideOpStickyRibbon = hideOpStickyRibbon;
window.resetOpStickyRibbon = resetOpStickyRibbon;
function updateOperationSticky(){
  const page=document.querySelector('.nav-tab.active')?.dataset?.page;
  if(page!=='bracket'){ renderOpStickyRibbonFromMarker(null); return; }
  const markers=[...document.querySelectorAll('#bracketContent .op-div-marker')];
  if(!markers.length){ renderOpStickyRibbonFromMarker(null); return; }

  const headerEl=document.querySelector('.app-header');
  const noticeEl=ge('globalFloatingNotice');
  const headerBottom=headerEl?headerEl.getBoundingClientRect().bottom:0;
  const noticeBottom=(noticeEl && noticeEl.style.display!=='none')?noticeEl.getBoundingClientRect().bottom:0;
  const baseTop = Math.max(headerBottom, noticeBottom);
  const contentOffset = window.innerWidth<=680 ? 76 : 96;
  const anchorY = baseTop + contentOffset;

  // 마커를 '섹션 시작점'으로 보고, 다음 마커 전까지를 해당 부서 구간으로 계산.
  // 기준선(anchorY)이 포함되는 구간을 우선 선택하면,
  // 상단에 남아 있는 이전 부서 마커를 오래 물고 가는 문제가 줄어든다.
  let chosen = null;
  for(let i=0;i<markers.length;i++){
    const cur = markers[i];
    const next = markers[i+1] || null;
    const curTop = cur.getBoundingClientRect().top;
    const nextTop = next ? next.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
    if(anchorY >= curTop && anchorY < nextTop){
      chosen = cur;
      break;
    }
  }

  // 아직 못 찾았으면: 기준선보다 위에 있는 마지막 마커 사용
  if(!chosen){
    for(const m of markers){
      if(m.getBoundingClientRect().top <= anchorY) chosen = m;
      else break;
    }
  }

  // 그래도 없으면 화면 안에 가장 먼저 보이는 마커 또는 첫 마커
  if(!chosen){
    chosen = markers.find(m=>m.getBoundingClientRect().bottom>=baseTop) || markers[0];
  }

  renderOpStickyRibbonFromMarker(chosen||null);
}
window.addEventListener('scroll',()=>{ try{ updateOperationSticky(); }catch(e){} }, {passive:true});
window.addEventListener('resize',()=>{ try{ updateOperationSticky(); }catch(e){} });

// ✅ 기본 대회 선택: 가장 최근 대회 우선
function _toMs(v){
  try{
    if(v==null) return 0;
    if(typeof v==='number') return isFinite(v)?v:0;
    if(typeof v?.toMillis==='function') return v.toMillis();
    if(typeof v?.seconds==='number') return v.seconds*1000 + Math.floor((v.nanoseconds||0)/1e6);
    const t=new Date(v).getTime();
    return isNaN(t)?0:t;
  }catch(e){ return 0; }
}
function tournamentSortValue(t){
  if(!t) return 0;
  const dateMs=_toMs(t.date || t.datetime || t.startAt || t.startDate || t.matchDate);
  const createdMs=_toMs(t.createdAt || t.updatedAt || t.ts);
  return Math.max(dateMs, createdMs);
}

function sortTournamentsEarliest(arr){
  return [...(Array.isArray(arr)?arr:[])].sort((a,b)=>{
    const diff=tournamentSortValue(a)-tournamentSortValue(b);
    if(diff!==0) return diff;
    return String(a?.name||'').localeCompare(String(b?.name||''),'ko');
  });
}
function sortTournamentsLatest(arr){
  return [...(Array.isArray(arr)?arr:[])].sort((a,b)=>{
    const diff=tournamentSortValue(b)-tournamentSortValue(a);
    if(diff!==0) return diff;
    return String(b?.name||'').localeCompare(String(a?.name||''));
  });
}
function pickDefaultTournamentId(){
  if(!Array.isArray(G.tournaments) || G.tournaments.length===0) return '';
  return sortTournamentsLatest(G.tournaments)[0]?.id || '';
}


function goHomeMetric(kind){
  const currentTid = pickDefaultTournamentId();
  switch(kind){
    case 'current_clubs':
    case 'current_teams': {
      showPage('register');
      const el=ge('regTS');
      if(el && currentTid){ el.value=currentTid; onRegTC(); }
      window.scrollTo({top:0,behavior:'smooth'});
      break;
    }
    case 'assoc_clubs':
    case 'assoc_teams':
    case 'assoc_players':
    case 'reg2026': {
      showPage('players');
      switchPlayersTab('registry');
      const y=ge('regYearSel');
      if(y){ y.value='2026'; }
      renderRegistryTab();
      window.scrollTo({top:0,behavior:'smooth'});
      break;
    }
    case 'courts': {
      openCourtInfoModal();
      break;
    }
    default:
      break;
  }
}
window.goHomeMetric = goHomeMetric;

function openSupportModal(){
  const phone = (G.meta.adminPhone||'').trim();
  if(!phone){
    toast('관리자 연락처가 아직 설정되지 않았습니다 (관리자 설정에서 번호 저장)','info');
  }
  // 기본 문구 구성
  const tlabel=_getActiveTournamentLabel();
  const base=`[요청사항]\n대회: ${tlabel||'-'}\n구분: (수정/불편/개선/기타)\n내용: \n\n- 보내는 사람: (이름/클럽)`;
  const ta=ge('supportMsg');
  if(ta) ta.value = base;
  const sel=ge('supportType');
  if(sel) sel.value='불편';
  om('mSupport');
}

function _openSMS(phone, body){
  const raw=String(phone||'').trim();
  const normalized=raw.split(/[;,]/).map(v=>v.trim()).filter(Boolean).map(v=>v.replace(/[^0-9\+]/g,'').replace(/^82/, '+82'));
  const p = normalized.join(',');
  const msg = encodeURIComponent(body||'');
  const url = `sms:${p}?body=${msg}`;
  try{
    window.location.href = url;
  }catch(e){
    // fallback handled by caller
  }
}
function _normalizePhoneList(values=[]){
  const seen=new Set();
  return (Array.isArray(values)?values:[values]).flatMap(v=>String(v||'').split(/[;,]/)).map(v=>formatPhoneLoose(v)).map(v=>String(v||'').trim()).filter(v=>v && v.replace(/[^0-9]/g,'').length>=9 && !seen.has(v) && (seen.add(v), true));
}
function _openSMSForRecipients(recipients=[], body=''){
  const phones=_normalizePhoneList(recipients.map(r=>r?.phone||''));
  if(!phones.length){ toast('문자 받을 번호가 없습니다','error'); return false; }
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if(!isMobile){
    const lines=[body||'', '', '받는 번호', ...phones];
    navigator.clipboard?.writeText(lines.join('\n')).then(()=>{
      toast('PC에서는 문자앱을 열 수 없어 문구와 번호를 복사했습니다. 휴대폰에서 붙여넣어 보내주세요.','info');
    }).catch(()=>{
      toast('PC에서는 문자앱 열기가 제한될 수 있습니다. 휴대폰에서 보내주세요.','info');
    });
    return false;
  }
  _openSMS(phones.join(','), body);
  return true;
}
function getMatchNotificationRecipients(key,m){
  try{
    const {t1,t2}=getMatchTeamObjects(key,m);
    const teams=[t1,t2].filter(Boolean);
    const isIndividual = teams.some(team=>team?.tournamentType==='individual_pair' || Array.isArray(team?.individualPlayers));
    if(isIndividual){
      const out=[];
      const seen=new Set();
      teams.forEach(team=>{
        getIndividualPlayers(team).slice(0,2).forEach((p,idx)=>{
          const wantsOrder = p?.receiveOrderSms !== false;
          if(!wantsOrder) return;
          const phone=formatPhoneLoose(p?.phone||'');
          if(!phone) return;
          if(seen.has(phone)) return;
          seen.add(phone);
          const nm=String(p?.name||'').trim() || `참가자${idx+1}`;
          out.push({name:nm, phone, role:'player'});
        });
      });
      return out;
    }
    const contacts=G.meta?.clubContacts||{};
    const seen=new Set();
    return teams.map((team,idx)=>{
      const club=String(team?.club||'').trim();
      const phone=formatPhoneLoose(contacts[club]||'');
      const label=tdn(team,key, idx===0?m?.t1:m?.t2);
      return {name:label||club||`팀${idx+1}`, phone, role:'captain', club};
    }).filter(r=>r.phone && !seen.has(r.phone) && (seen.add(r.phone), true));
  }catch(e){ return []; }
}
function getMatchResultNotificationRecipients(key,m){
  try{
    const {t1,t2}=getMatchTeamObjects(key,m);
    const teams=[t1,t2].filter(Boolean);
    const isIndividual = teams.some(team=>team?.tournamentType==='individual_pair' || Array.isArray(team?.individualPlayers));
    if(isIndividual){
      const out=[];
      const seen=new Set();
      teams.forEach(team=>{
        getIndividualPlayers(team).slice(0,2).forEach((p,idx)=>{
          const wantsResult = p?.receiveResultSms !== false;
          if(!wantsResult) return;
          const phone=formatPhoneLoose(p?.phone||'');
          if(!phone) return;
          if(seen.has(phone)) return;
          seen.add(phone);
          const nm=String(p?.name||'').trim() || `참가자${idx+1}`;
          out.push({name:nm, phone, role:'player'});
        });
      });
      return out;
    }
    return getMatchNotificationRecipients(key,m);
  }catch(e){ return []; }
}

function buildCourtNotificationMessage(kind,key,m,meta={}){
  const info=describeCourtBoardMatch(key,m||{});
  const court=String(meta.court||'').trim();
  const queuePos=Number(meta.queuePos||0)||0;
  const queueText=queuePos>0 ? `${queuePos}번째 대기` : '';
  const prefix=`[김해시테니스협회]`;
  if(kind==='match_started') return `${prefix} 경기 시작합니다. 5분 내에 출전하세요. ${court?`${court} 코트`:''} ${info.title||''}`.replace(/\s+/g,' ').trim();
  if(kind==='match_completed') return `${prefix} 경기 완료되었습니다. 결과를 확인해 주세요. ${court?`${court} 코트`:''} ${info.title||''}`.replace(/\s+/g,' ').trim();
  if(kind==='court_changed') return `${prefix} 대기 코트가 변경되었습니다. ${court?`${court} 코트`:''} ${queueText||'대기 등록'} 되었습니다. ${info.title||''}`.replace(/\s+/g,' ').trim();
  return `${prefix} ${court?`${court} 코트`:''} ${queueText||'대기 등록'} 되었습니다. ${info.title||''}`.replace(/\s+/g,' ').trim();
}
function buildCourtNotificationApprovalPayload(kind,key,m,meta={}){
  const recipients=(kind==='match_completed') ? getMatchResultNotificationRecipients(key,m) : getMatchNotificationRecipients(key,m);
  const body=buildCourtNotificationMessage(kind,key,m,meta);
  const info=describeCourtBoardMatch(key,m||{});
  const title = kind==='match_completed' ? '✅ 경기 완료 알림' : (kind==='match_started' ? '🎾 경기 시작 알림' : (kind==='court_changed' ? '🔄 대기 코트 알림' : '⏳ 대기 배정 알림'));
  const recipientLabel = recipients.length ? recipients.map(r=>`${r.name}(${r.phone})`).join(', ') : '번호 없음';
  const queueText = meta.queuePos>0 ? ` · ${meta.queuePos}번째 대기` : '';
  return {
    msg:`${info.title||'경기'}
${meta.court?meta.court+' 코트':''}${queueText}
받는 사람: ${recipientLabel}`.trim(),
    title,
    kind:'court_sms',
    actionType:'sms_approval',
    smsRecipients:recipients,
    smsBody:body,
    tid:meta.tid||'',
    div:meta.div||'',
    matchId:m?.id||m?._id||'',
    dedupeKey:`court_sms:${kind}:${meta.tid||''}:${meta.div||''}:${m?.id||m?._id||''}:${meta.court||''}:${meta.queuePos||0}`
  };
}
const COURT_ALERT_BOOTSTRAPPED = { value:false };
function buildCourtNotificationStateMap(matchesObj){
  const out={};
  Object.keys(matchesObj||{}).forEach(key=>{
    const items=getCourtStatusSnapshot(key)||[];
    items.forEach(item=>{
      const court=String(item?.court||'').trim();
      if(item?.current){
        const mid=String(item.current.id||item.current._id||'');
        if(mid) out[mid]={key, tid:_k2td(key).tid, div:_k2td(key).div, status:'current', court, queuePos:0, match:item.current};
      }
      const waiting=[...(item?.__visibleWaiting||item?.waiting||[])];
      waiting.forEach((m,idx)=>{
        const mid=String(m?.id||m?._id||'');
        if(mid) out[mid]={key, tid:_k2td(key).tid, div:_k2td(key).div, status:'waiting', court, queuePos:idx+1, match:m};
      });
    });
    // 공용대기(shared queue)는 순서 변동이 잦아 알림/문자 승인 대상으로 잡지 않는다.
    // 실제 알림은 코트에 배정된 대기열(waiting)과 현재 경기(current)만 대상으로 처리한다.
  });
  return out;
}
function buildCourtSmsAlertPayloads(prevMap,nextMap){
  const payloads=[];
  Object.entries(nextMap||{}).forEach(([mid,next])=>{
    if(!next?.match || next.match?.winner!=null) return;
    const prev=prevMap?.[mid]||null;
    let kind='';
    if(next.status==='current' && (!prev || prev.status!=='current' || prev.court!==next.court)) kind='match_started';
    // 대기 알림은 공용대기/미배정 상태에서 각 코트 대기로 처음 들어온 경우만 자동 처리한다.
    // 같은 코트 안에서 대기 2번→1번처럼 순번만 바뀌는 경우에는 문자/알림을 만들지 않는다.
    else if(next.status==='waiting' && (!prev || prev.status==='none')) kind='waiting_registered';
    if(!kind) return;
    const payload=buildCourtNotificationApprovalPayload(kind,next.key,next.match,{court:next.court,queuePos:next.queuePos,tid:next.tid,div:next.div});
    if(kind==='match_started'){
      payload.title='🎾 경기 시작 알림';
      payload.side='left';
    }
    payloads.push(payload);
  });
  return payloads;
}
function enqueueCourtSmsAlertsFromState(prevMap,nextMap){
  buildCourtSmsAlertPayloads(prevMap,nextMap).forEach(payload=>enqueueStickyAlert(payload,'info'));
}

function sendCourtCardSms(key, mid, statusKind='queue_registered', court='', queuePos=0){
  try{
    if(!canManageBracket()){ toast('관리자 또는 경기진행자만 문자 발송 가능','info'); return false; }
    const list=G.matches?.[key]||[];
    const m=list.find(x=>String(x?.id||'')===String(mid||''));
    if(!m){ toast('경기를 찾을 수 없습니다','error'); return false; }
    const recipients=getMatchNotificationRecipients(key,m);
    if(!recipients.length){ toast('문자 받을 번호가 없습니다','error'); return false; }
    const meta={court:String(court||'').trim(), queuePos:Number(queuePos||0)||0};
    const body=buildCourtNotificationMessage(statusKind,key,m,meta);
    const ok=_openSMSForRecipients(recipients, body);
    if(ok) toast('문자 앱을 열었습니다','success');
    return ok;
  }catch(e){
    toast('문자 발송 실패: '+e.message,'error');
    return false;
  }
}
window.sendCourtCardSms = sendCourtCardSms;

function processCourtSmsAlerts(prevMap,nextMap){
  if(!COURT_ALERT_BOOTSTRAPPED.value){
    COURT_ALERT_BOOTSTRAPPED.value=true;
    return;
  }
  enqueueCourtSmsAlertsFromState(prevMap,nextMap);
}
function flushStickyCourtSmsAlertsForFinishedMatch(matchId=''){
  const mid=String(matchId||'').trim();
  if(!mid) return;
  for(let i=STICKY_ALERT_QUEUE.length-1;i>=0;i--){
    const item=STICKY_ALERT_QUEUE[i];
    if(item && item.actionType==='sms_approval' && String(item.matchId||'')===mid){
      STICKY_ALERT_QUEUE.splice(i,1);
    }
  }
  const wrap=ge('stickyAlertWrap');
  if(wrap && String(wrap.getAttribute('data-action-type')||'')==='sms_approval' && String(wrap.getAttribute('data-mid')||'')===mid){
    closeStickyAlert(false);
  }
}
function enqueueCourtCompleteAlert(payload){
  flushStickyCourtSmsAlertsForFinishedMatch(payload?.matchId||'');
  enqueueStickyAlert(payload,'info');
}
function enqueueCourtCompleteAlertReliable(payload){
  const item={...(payload||{})};
  const isMobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');
  if(isMobile && !(Number(item.autoCloseMs||0)>0 && Number(item.autoCloseMs||0)>=9000)) item.autoCloseMs=9000;
  setTimeout(()=>enqueueCourtCompleteAlert(item), 180);
}
function sendStickyAlertSMS(){
  const wrap=ge('stickyAlertWrap');
  if(!wrap) return;
  try{
    const recipients=JSON.parse(wrap.getAttribute('data-sms-recipients')||'[]');
    const body=wrap.getAttribute('data-sms-body')||'';
    if(!_openSMSForRecipients(recipients, body)) return;
    closeStickyAlert(true);
    toast('문자 앱을 열었습니다','success');
  }catch(e){
    toast('문자앱 열기 실패: '+e.message,'error');
  }
}
window.sendStickyAlertSMS = sendStickyAlertSMS;

async function sendSupportSMS(){
  const phone=(G.meta.adminPhone||'').trim();
  const body=(ge('supportMsg')?.value||'').trim();
  if(!body){ toast('내용을 입력하세요','error'); return; }
  if(!phone){
    toast('관리자 연락처가 없습니다. 관리자 설정에서 번호를 저장해주세요.','error');
    return;
  }

  // PC/데스크탑일 때는 sms 스킴이 안 먹는 경우가 많아 복사 안내
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if(!isMobile){
    try{
      await navigator.clipboard.writeText(body);
      toast('PC에서는 문자앱을 열 수 없어 내용을 복사했습니다. 휴대폰에서 붙여넣어 보내주세요.','info');
    }catch(e){
      toast('PC에서는 문자앱 열기가 제한될 수 있습니다. 내용을 복사해 보내주세요.','info');
    }
    // 전화번호도 같이 안내
    ge('supportHint') && (ge('supportHint').innerHTML = `받는 번호: <b>${phone}</b> (복사하여 문자로 보내주세요)`);
    return;
  }

  _openSMS(phone, body);
  cm('mSupport');
  toast('문자 앱을 열었습니다','success');
}

function tdn(team,key,idx){
  if(!team) return '?';
  const isIndividual = team?.tournamentType==='individual_pair' || Array.isArray(team?.individualPlayers);
  if(isIndividual){
    return team.entryLabel || team.pairLabel || getIndividualDisplayLine(team) || ((team.players||[]).slice(0,2).join(' / ')) || '?';
  }
  const ts=G.teams[key]||[];
  const same=ts.filter(t=>t.club===team.club);
  if(same.length<=1)return team.club;
  let o=0;for(let i=0;i<idx;i++){if(ts[i]&&ts[i].club===team.club)o++;}
  return team.club+'-'+String.fromCharCode(65+o);
}

function getIndividualNameOnlyDisplayLine(team){
  try{
    const ps=getIndividualPlayers(team).slice(0,2).map(p=>String(p?.name||'').trim()).filter(Boolean);
    return ps.join(' / ') || ((team?.players||[]).slice(0,2).map(v=>String(v||'').trim()).filter(Boolean).join(' / ')) || '?';
  }catch(e){ return '?'; }
}
function stripIndividualClubLabel(text=''){
  const raw=String(text||'').trim();
  if(!raw) return '';
  return raw.split('/').map(part=>String(part||'').replace(/\s*\([^)]*\)\s*$/,'').trim()).filter(Boolean).join(' / ') || raw;
}
function getMainBracketDisplayName(key, team, idx){
  if(!team) return 'TBD';
  const isIndividual = team?.tournamentType==='individual_pair' || Array.isArray(team?.individualPlayers);
  return isIndividual ? getIndividualNameOnlyDisplayLine(team) : tdn(team,key,idx);
}
function getResolvedMainPlaceholderName(key, label=''){
  const raw=String(label||'').trim();
  if(!raw) return '';
  const map=getPrelimResolvedLabelMap(key)||{};
  return map[raw]?.name || map[raw.replace(/\s+/g,' ')]?.name || '';
}
function getMainBracketSourceLabel(key, label=''){
  const raw=String(label||'').trim();
  if(!raw) return '';
  const resolved=getResolvedMainPlaceholderName(key, raw);
  if(resolved) return stripIndividualClubLabel(resolved);
  return stripIndividualClubLabel(raw);
}
function getCourtBoardTeamName(team,key,idx){
  if(!team) return '?';
  const isIndividual = team?.tournamentType==='individual_pair' || Array.isArray(team?.individualPlayers);
  return isIndividual ? getIndividualNameOnlyDisplayLine(team) : tdn(team,key,idx);
}

async function createTournament(){
  const nm=ge('tName').value.trim(),dt=ge('tDate').value;
  if(!nm||!dt){toast('대회명과 일자 필수','error');return;}
  const type=getSelectedTournamentType();
  const divItems=getCustomDivList();
  if(!divItems.length){toast('부서를 최소 1개 추가해 주세요','error');return;}
  const divs=divItems.map(d=>d.name);
  sl(true);
  try{
    let fmt=ge('tFormat').value,gs=parseInt(ge('tGrpSize').value),adv=parseInt(ge('tAdvance').value);
    if(type==='individual_pair'){
      // 개인전은 선택한 경기방식(fmt)을 그대로 사용 (group_knockout 허용)
      // grpSize/advance는 개인전에서도 사용자 설정값 유지
    }
    const ds={};
    divItems.forEach((d)=>{ const {name,rub,maxTeams}=d;
      ds[name]={format:fmt,grpSize:gs,advance:adv,doublesCount:type==='individual_pair'?1:rub,maxTeams:parseInt(maxTeams||0)||0,thirdPlaceMode:'shared',allowedCourts:Array.isArray(d.courts)?d.courts.map(String).filter(Boolean):[]};
    });
    const _tRegDl=ge('tRegDl')?.value;
    const tRef=await addDoc(collection(db,'tournaments'),{
      name:nm,date:dt,venue:ge('tVenue').value.trim(),deadline:ge('tDeadline').value,
      courtGroups:getDraftCourtGroups('create'),
      regDeadlineDt:_tRegDl?new Date(_tRegDl).toISOString():'',
      type,
      divisions:divs,format:fmt,grpSize:gs,advance:adv,divSettings:ds,
      notice:ge('tNotice').value.trim(),guideText:ge('tGuideText')?.value.trim()||'',guideUrl:ge('tGuideUrl')?.value.trim()||'',
      hasGuideAssets:(GUIDE_FILES_CREATE||[]).length>0||(GUIDE_FILES_CREATE_PENDING||[]).length>0,
      status:'open',createdAt:serverTimestamp()
    });
    await flushGuideUploads(tRef.id, 'create');
    const assets=GUIDE_FILES_CREATE||[];
    if(assets.length>0){await setDoc(doc(db,'tourGuides',tRef.id),{assets,updatedAt:serverTimestamp()});}
    await fbLog('대회 생성: '+nm+' ['+(type==='individual_pair'?'개인전':'단체전')+']','🏆');
    ['tName','tDate','tVenue','tDeadline','tRegDl','tNotice','tGuideText','tGuideUrl','newDivMaxTeams','newCourtGroupName','newCourtGroupCount'].forEach(id=>{const el=ge(id);if(el)el.value='';});
    if(ge('tType')) ge('tType').value='team';
    updateTournamentTypeUI();
    GUIDE_FILES_CREATE=[];GUIDE_FILES_CREATE_PENDING=[];renderGuidePreview('create');
    clearCustomDivList();
    _customCourtGroupList=[]; renderCourtGroupManager('create');
    sl(false);toast('"'+nm+'" 생성됨','success');
  }catch(e){sl(false);toast('생성 실패: '+e.message,'error');}
}

function renderTL(){
  const el=ge('tournList');if(!G.tournaments.length){el.innerHTML='<div class="empty-state card"><div class="empty-icon">🏆</div><p>등록된 대회 없음</p></div>';return;}
  const sm={open:'s-open',closed:'s-closed',ongoing:'s-ongoing',finished:'s-finished'};
  const sl2={open:'접수중',closed:'접수마감',ongoing:'진행중',finished:'종료'};
  const sorted=[...G.tournaments].sort((a,b)=>{
    const ad=(a?.date||'').toString();
    const bd=(b?.date||'').toString();
    if(bd!==ad) return bd.localeCompare(ad);
    const ac=(a?.createdAt?.seconds||0);
    const bc=(b?.createdAt?.seconds||0);
    return bc-ac;
  });
  el.innerHTML=sorted.map(t=>{
    const tc=Object.keys(G.teams).filter(k=>k.startsWith(t.id+'_')).reduce((s,k)=>s+(G.teams[k]||[]).length,0);
    return`<div class="tc"><div class="tc-hdr"><h3>${t.name}</h3><span class="sbadge ${sm[t.status]||'s-open'}">${sl2[t.status]||'접수중'}</span></div>
    <div class="tc-body"><div class="tc-meta"><span class="tc-mi">📅 ${t.date}</span>${t.venue?`<span class="tc-mi">📍 ${t.venue}</span>`:''}<span class="tc-mi">${(t.type||'team')==='individual_pair'?'🎾 개인전':'👥 단체전'}</span><span class="tc-mi">👥 ${tc}${(t.type||'team')==='individual_pair'?'조':'팀'}</span></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${(t.divisions||[]).map(d=>`<span class="dpill ${dc(d)}" style="cursor:pointer" onclick="openRoster('${t.id}','${d}')">${dl(d)} <small>${(G.teams[t.id+'_'+d]||[]).length}팀</small></span>`).join('')}</div>
    ${AD?`<div class="tc-acts"><select class="form-select" style="width:auto;padding:5px 8px;font-size:.75rem" onchange="chgTS('${t.id}',this.value)"><option value="open" ${t.status==='open'?'selected':''}>접수중</option><option value="closed" ${t.status==='closed'?'selected':''}>마감</option><option value="ongoing" ${t.status==='ongoing'?'selected':''}>진행중</option><option value="finished" ${t.status==='finished'?'selected':''}>종료</option></select><button class="btn btn-outline" style="font-size:.75rem;padding:5px 10px" onclick="openTD('${t.id}')">⚙️ 설정</button><button class="btn btn-primary" style="font-size:.75rem;padding:5px 10px" onclick="openET('${t.id}')">✏️ 편집</button><button class="btn btn-danger" style="font-size:.75rem;padding:5px 10px" onclick="delT('${t.id}')">삭제</button></div>`:
    `<div class="tc-acts"><button class="btn btn-outline" style="font-size:.75rem" onclick="openTD('${t.id}')">상세보기</button></div>`}</div></div>`;
  }).join('');
}

async function chgTS(tid,s){try{await updateDoc(doc(db,'tournaments',tid),{status:s});}catch(e){toast('실패','error');}}
async function delT(tid){
  if(!confirm('대회를 삭제하시겠습니까?\n⚠️ 관련 경기기록, 팀등록, 선수 이력도 함께 삭제됩니다.'))return;
  sl(true);
  try{
    const keys=['금','은','동','테린이','여성부'].map(d=>tid+'_'+d);
    // ① 매치 승패 차감
    for(const key of keys) await resetMatchRecords(key);
    // ② registrations 삭제
    const regSnap=await getDocs(query(collection(db,'registrations'),where('tournamentId','==',tid)));
    // ③ players.history에서 해당 tid 제거
    const affectedPlayerKeys=new Set();
    regSnap.docs.forEach(d=>{
      const reg=d.data()||{};
      (reg.players||[]).forEach(pn=>{
        const bc=baseClub(reg.club||'');
        const pk=pKey(pn,bc);
        if(G.players[pk]){
          G.players[pk].history=(G.players[pk].history||[]).filter(h=>h.tid!==tid);
          affectedPlayerKeys.add(pk);
        }
      });
    });
    // ④ Firestore batch 삭제
    const batch=writeBatch(db);
    batch.delete(doc(db,'tournaments',tid));
    keys.forEach(k=>{batch.delete(doc(db,'teams',k));batch.delete(doc(db,'draws',k));batch.delete(doc(db,'matches',k));});
    regSnap.docs.forEach(d=>batch.delete(doc(db,'registrations',d.id)));
    await batch.commit();
    // ⑤ 선수 저장 or 완전삭제 (신규선수: history 없고 승패 0이면 명단에서 삭제)
    if(affectedPlayerKeys.size>0){
      const toDelete=[], toSave=[];
      for(const pk of affectedPlayerKeys){
        const p=G.players[pk]; if(!p) continue;
        if((p.history||[]).length===0 && (p.wins||0)===0 && (p.losses||0)===0){
          toDelete.push(pk);
        } else {
          toSave.push(pk);
        }
      }
      if(toSave.length>0) await Promise.all(toSave.map(pk=>stP(pk)));
      if(toDelete.length>0){
        await Promise.all(toDelete.map(pk=>
          deleteDoc(doc(db,'players',pk.replace(/[/.#$[\]]/g,'_'))).catch(()=>{})
        ));
        toDelete.forEach(pk=>{ delete G.players[pk]; });
      }
    }
    // ⑥ 로컬 상태 정리
    const keys2=['금','은','동','테린이','여성부'].map(d=>tid+'_'+d);
    keys2.forEach(key=>{
      delete G.teams[key]; delete G.draws[key]; delete G.matches[key];
      if(G._regIdsByKey) delete G._regIdsByKey[key];
    });
    G.tournaments=(G.tournaments||[]).filter(t=>t.id!==tid);
    sl(false);toast('대회 및 관련 기록 삭제 완료','info');
    renderTL(); renderBracket();
  }catch(e){sl(false);toast('삭제 실패: '+e.message,'error');console.error(e);}
}

function openET(tid){
  const t=G.tournaments.find(t=>t.id===tid);if(!t)return;CE_tid=tid;
  ge('mETT').textContent='✏️ 편집: '+t.name;
  // 기존 부서 목록으로 _etDivList 초기화
  const existDivs=(t.divisions||[]);
  ge('mETB').innerHTML=`<div class="form-group"><label class="form-label">대회명</label><input class="form-input" id="etN" value="${t.name||''}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="form-group"><label class="form-label">일자</label><input class="form-input" type="date" id="etDt" value="${t.date||''}"></div><div class="form-group"><label class="form-label">장소</label><input class="form-input" id="etVn" value="${t.venue||''}"></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="form-group"><label class="form-label">마감</label><input class="form-input" type="date" id="etDl" value="${t.deadline||''}"></div><div class="form-group"><label class="form-label">상태</label><select class="form-select" id="etSt"><option value="open" ${t.status==='open'?'selected':''}>접수중</option><option value="closed" ${t.status==='closed'?'selected':''}>마감</option><option value="ongoing" ${t.status==='ongoing'?'selected':''}>진행중</option><option value="finished" ${t.status==='finished'?'selected':''}>종료</option></select></div></div>
    <div class="form-group" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #16a34a;border-radius:10px;padding:10px 12px">
      <label class="form-label" style="color:#166534">📅 경기이사 등록 기한</label>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input class="form-input" type="datetime-local" id="etRegDl" style="flex:1;min-width:180px"
          value="${(()=>{const _d=t.regDeadlineDt?new Date(t.regDeadlineDt):null;return _d?new Date(_d.getTime()-_d.getTimezoneOffset()*60000).toISOString().slice(0,16):'';})()}">
        <button class="btn btn-primary" style="white-space:nowrap;background:#166534" onclick="saveRegDeadline()">💾 저장</button>
        <button class="btn btn-gray" style="white-space:nowrap" onclick="ge('etRegDl').value='';saveRegDeadline()">🗑 해제</button>
      </div>
      <div id="etRegDlStatus" style="font-size:.75rem;margin-top:6px;color:#166534">${regDeadlineLabel(t.id)}</div>
      <div style="font-size:.7rem;color:var(--text3);margin-top:3px">비워두면 제한 없음. 관리자는 항상 등록 가능.</div>
    </div>
    <div class="form-group" style="background:linear-gradient(135deg,#f8fbff,#fffdf5);border:1.5px solid #dbe7ff;border-radius:10px;padding:10px 12px">
      <label class="form-label" style="color:var(--primary-dark)">🎾 대회 운영 코트 설정</label>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
        <input class="form-input" id="etNewCourtGroupName" placeholder="코트군 이름" style="flex:1;min-width:150px;font-size:.82rem">
        <input class="form-input" type="number" min="1" id="etNewCourtGroupCount" placeholder="면수" style="width:86px;font-size:.82rem">
        <button type="button" class="btn btn-primary" style="font-size:.76rem;padding:5px 10px;white-space:nowrap" onclick="addCourtGroup('edit')">➕ 추가</button>
      </div>
      <div id="etCourtGroupList" style="display:flex;flex-direction:column;gap:8px"></div>
      <div style="font-size:.7rem;color:var(--text3);margin-top:6px">편집 후 저장하면 이 대회의 코트 구조 전체가 갱신됩니다.</div>
    </div>
    <div class="form-group"><label class="form-label">부서 &amp; 복식 수</label>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 10px">
        <span style="font-size:.72rem;color:var(--text2);align-self:center">빠른 추가:</span>
        <button type="button" class="btn btn-outline" style="font-size:.7rem;padding:2px 8px" onclick="etAddPreset('금배부',5)">🥇 금배부</button>
        <button type="button" class="btn btn-outline" style="font-size:.7rem;padding:2px 8px" onclick="etAddPreset('은배부',5)">🥈 은배부</button>
        <button type="button" class="btn btn-outline" style="font-size:.7rem;padding:2px 8px" onclick="etAddPreset('동배부',5)">🥉 동배부</button>
        <button type="button" class="btn btn-outline" style="font-size:.7rem;padding:2px 8px" onclick="etAddPreset('테린이부',3)">🌱 테린이부</button>
        <button type="button" class="btn btn-outline" style="font-size:.7rem;padding:2px 8px" onclick="etAddPreset('여성부',3)">👩 여성부</button>
        <button type="button" class="btn btn-outline" style="font-size:.7rem;padding:2px 8px" onclick="etAddPreset('직장부',5)">🏢 직장부</button>
        <button type="button" class="btn btn-outline" style="font-size:.7rem;padding:2px 8px" onclick="etAddPreset('시니어부',5)">🎖 시니어부</button>
      </div>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px">
        <input class="form-input" id="etNewDivName" placeholder="부서명 직접 입력" style="flex:1;font-size:.82rem">
        <select class="form-select" id="etNewDivRub" style="width:85px;font-size:.8rem">
          <option value="5">5복식</option><option value="3">3복식</option><option value="4">4복식</option><option value="2">2복식</option><option value="1">1복식</option>
        </select>
        <button type="button" class="btn btn-primary" style="font-size:.78rem;padding:5px 10px;white-space:nowrap" onclick="etAddCustomDiv()">➕ 추가</button>
      </div>
      <div id="etDivList" style="display:flex;flex-direction:column;gap:6px"></div>
      <div style="font-size:.72rem;color:var(--text3);margin-top:8px;line-height:1.5">부서별 사용 코트는 아래 각 부서 카드에서 선택합니다.</div>
    </div>
    <div class="form-group"><label class="form-label">공지</label><textarea class="form-textarea" id="etNt" rows="3">${t.notice||''}</textarea></div>
    <div class="form-group"><label class="form-label">대회요강 (텍스트)</label>
      <textarea class="form-textarea" id="etGuideText" rows="4" placeholder="대회 요강 텍스트(선택)">${t.guideText||''}</textarea>
    </div>
    <div class="frow">
      <div class="form-group"><label class="form-label">대회요강 (링크)</label>
        <input class="form-input" id="etGuideUrl" value="${t.guideUrl||''}" placeholder="https://... (선택)">
      </div>
      <div class="form-group"><label class="form-label">대회요강 (파일/이미지)</label>
        <input class="form-input" type="file" id="etGuideFiles" multiple accept="image/*,application/pdf" onchange="onGuideFilesSelected(this,'edit')">
        <div style="font-size:.7rem;color:var(--text3);margin-top:4px">※ 이미지/PDF 업로드(선택). 너무 큰 파일은 저장이 제한될 수 있어요.</div>
      </div>
    </div>
    <div id="etGuidePreview" style="margin-top:6px"></div>
`;
  // 기존 부서 목록으로 _etDivList 초기화
  window._etCourtGroupList = normalizeCourtGroups(t.courtGroups||getTournamentCourtGroups(tid,true));
  renderCourtGroupManager('edit');
  window._etDivList = existDivs.map(d=>({name:d, rub:(t.divSettings?.[d]?.doublesCount)||5, maxTeams:parseInt(t.divSettings?.[d]?.maxTeams||0)||0, courts:getDivisionConfiguredCourts(tid,d), locked:(G.teams[tid+'_'+d]||[]).length>0}));
  _renderEtDivList();
  // guideAssets를 별도 컬렉션(tourGuides)에서 불러오기
  GUIDE_FILES_EDIT = [];
  getDoc(doc(db,'tourGuides',tid)).then(snap=>{
    if(snap.exists()) GUIDE_FILES_EDIT=(snap.data().assets||[]).slice();
    else GUIDE_FILES_EDIT=(t.guideAssets||[]).slice();
    renderGuidePreview('edit');
  }).catch(()=>{ GUIDE_FILES_EDIT=(t.guideAssets||[]).slice(); renderGuidePreview('edit'); });
  om('mET');
}

async function saveET(){
  const t = G.tournaments.find(t => t.id === CE_tid);
  if(!t) return;

  const nm = ge('etN').value.trim();
  if(!nm){ toast('대회명 필수','error'); return; }

  const etDivs = (window._etDivList||[]);
  const newD = etDivs.map(d=>d.name);
  if(!newD.length){ toast('부서 1개 이상','error'); return; }

  sl(true);
  try{
    const ds = { ...(t.divSettings || {}) };
    etDivs.forEach(({name, rub, courts}) => {
      if(!ds[name]) ds[name] = { format:'group_knockout', grpSize:4, advance:2, thirdPlaceMode:'shared' };
      ds[name].doublesCount = rub;
      ds[name].maxTeams = parseInt((window._etDivList||[]).find(x=>x.name===name)?.maxTeams||ds[name].maxTeams||0)||0;
      ds[name].thirdPlaceMode = ds[name].thirdPlaceMode || 'shared';
      ds[name].allowedCourts = Array.isArray(courts)?courts.map(String).filter(Boolean):[];
    });

    await flushGuideUploads(CE_tid, 'edit');

    const assets = GUIDE_FILES_EDIT || [];
    const guideText = ge('etGuideText')?.value.trim() || '';
    const guideUrl  = ge('etGuideUrl')?.value.trim() || '';
    const notice    = ge('etNt').value.trim();
    const venue     = ge('etVn').value.trim();
    const hasGuideAssets = assets.length > 0;

    const _etRegDlVal = ge('etRegDl')?.value||'';
    const updFields = {
      name: nm,
      date: ge('etDt').value,
      venue,
      deadline: ge('etDl').value,
      regDeadlineDt: _etRegDlVal ? new Date(_etRegDlVal).toISOString() : '',
      status: ge('etSt').value,
      divisions: newD,
      divSettings: ds,
      notice,
      guideText,
      guideUrl,
      hasGuideAssets,
      type: t.type || 'team',
      courtGroups: getDraftCourtGroups('edit')
    };

    await updateDoc(doc(db, 'tournaments', CE_tid), updFields);

    if(hasGuideAssets){
      await setDoc(doc(db, 'tourGuides', CE_tid), {
        assets,
        updatedAt: serverTimestamp()
      });
    }

    const _ti = G.tournaments.findIndex(x => x.id === CE_tid);
    if(_ti >= 0){
      Object.assign(G.tournaments[_ti], updFields);
    }

    await fbLog('대회 편집: ' + nm, '✏️');

    sl(false);
    cm('mET');
    renderTL();
    toast('저장 완료 ✅', 'success');

  }catch(e){
    sl(false);
    toast('저장 실패: ' + e.message, 'error');
    console.error(e);
  }
}
function openTD(tid){
  const t=G.tournaments.find(t=>t.id===tid);if(!t)return;
  ge('mTDT').textContent=t.name;
  const fl={group_knockout:'예선+본선',knockout:'토너먼트',roundrobin:'풀리그'};
  const rows=(t.divisions||[]).map(d=>{const c=gDS(t,d),cnt=(G.teams[tid+'_'+d]||[]).length;
    const bronzeOpt = (c.format!=='roundrobin' && cnt<10)
      ? (AD
          ? `<select class="form-select" id="dTP_${tid}_${d}" style="width:120px"><option value="shared" ${c.thirdPlaceMode==='shared'?'selected':''}>공동 3위</option><option value="match" ${c.thirdPlaceMode==='match'?'selected':''}>3·4위전</option></select><div style="font-size:.65rem;color:var(--text3);margin-top:4px">10팀 미만만 적용</div>`
          : `<span class="badge bg-bronze">${c.thirdPlaceMode==='match'?'3·4위전':'공동 3위'}</span>`)
      : `<span style="font-size:.72rem;color:var(--text3)">-</span>`;
    return`<tr><td><span class="dpill ${dc(d)}" style="cursor:pointer" onclick="openRoster('${tid}','${d}')">${dl(d)}</span></td><td><b>${cnt}</b>팀</td>
    <td>${AD?`<select class="form-select" id="dF_${tid}_${d}"><option value="group_knockout" ${c.format==='group_knockout'?'selected':''}>예선+본선</option><option value="roundrobin" ${c.format==='roundrobin'?'selected':''}>풀리그</option><option value="knockout" ${c.format==='knockout'?'selected':''}>토너먼트</option></select>`:`<span class="badge bg-green">${fl[c.format]}</span>`}</td>
    <td>${AD?`<select class="form-select" id="dG_${tid}_${d}" style="width:75px"><option value="3" ${c.grpSize===3?'selected':''}>3팀</option><option value="4" ${c.grpSize===4?'selected':''}>4팀</option><option value="5" ${c.grpSize===5?'selected':''}>5팀</option></select>`:`${c.grpSize}팀`}</td>
    <td>${AD?`<select class="form-select" id="dA_${tid}_${d}" style="width:80px"><option value="1" ${c.advance===1?'selected':''}>1위</option><option value="2" ${c.advance===2?'selected':''}>상위2</option><option value="3" ${c.advance===3?'selected':''}>상위3</option></select>`:`상위${c.advance}`}</td>
    <td>${bronzeOpt}</td>
    <td>${AD?`<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start"><button class="btn btn-outline" style="padding:3px 8px;font-size:.7rem" onclick="applyRec('${tid}','${d}')">추천</button><label style="display:flex;gap:6px;align-items:center;font-size:.72rem"><input type="checkbox" id="cFmt_${tid}_${d}" checked>방식</label><label style="display:flex;gap:6px;align-items:center;font-size:.72rem"><input type="checkbox" id="cGs_${tid}_${d}" checked>조</label><label style="display:flex;gap:6px;align-items:center;font-size:.72rem"><input type="checkbox" id="cAdv_${tid}_${d}" checked>진출</label></div>`:''}</td></tr>`;
  }).join('');
  ge('mTDB').innerHTML=`<div style="font-size:.88rem;margin-bottom:10px"><b>📅 ${t.date}</b>${t.venue?' | 📍 '+t.venue:''}</div>
    <div class="card" style="box-shadow:none;padding:12px"><div class="card-title">⚙️ 부서별 설정</div>
    <div class="table-wrap"><table><thead><tr><th>부서</th><th>팀수</th><th>방식</th><th>조당</th><th>본선진출</th><th>10팀 미만 3위</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    ${AD?`<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="btn btn-outline" onclick="openClubMgr()">🏟 클럽</button><button class="btn btn-primary" onclick="saveDivS('${tid}')">💾 저장</button></div>`:''}
    </div>${t.notice?`<div style="background:var(--panel2);padding:10px;border-radius:var(--radius);border:1px solid var(--border);margin-top:8px"><b>공지:</b><br><span style="font-size:.83rem;white-space:pre-line">${t.notice}</span></div>`:''}`+
    `${(t.guideText||t.guideUrl||t.hasGuideAssets||((t.guideAssets||[]).length))?`<div style="margin-top:10px;display:flex;justify-content:flex-end"><button class="btn btn-outline" style="padding:6px 12px;font-size:.78rem" onclick="openGuide('${tid}')">📌 대회 요강 보기</button></div>`:''}`;
  om('mTD');
}


function popSel(){
  // regTS / brTS / rankTS : 가장 최근 대회순으로 정렬, 가장 최근 대회 기본 선택
  ['regTS','brTS'].forEach(id=>{
    const el=ge(id); if(!el) return;
    let v = el.value;

    const sortedTours = sortTournamentsLatest(G.tournaments);
    if(!v || !sortedTours.some(t=>t.id===v)) v = pickDefaultTournamentId();

    el.innerHTML='<option value="">-- 대회 선택 --</option>'+
      sortedTours.map(t=>{
        const dis = (!AD && id==='regTS' && t.status!=='open') ? 'disabled' : '';
        const label = `${t.name} (${t.date||''})` + (t.status==='open'?' [접수중]':t.status==='ongoing'?' [진행중]':t.status==='closed'?' [마감]':t.status==='finished'?' [종료]':'');
        return `<option value="${t.id}" ${t.id===v?'selected':''} ${dis}>${label}</option>`;
      }).join('');
  });

  // rankTS: Firebase 대회 + 과거 내장 대회 모두 최근순 표시
  const rankEl=ge('rankTS');
  if(rankEl){
    let v = rankEl.value;
    const allT=sortTournamentsLatest([...G.tournaments,...HIST_DATA]);
    if(!v || !allT.some(t=>t.id===v)) v = (allT[0]?.id || '');
    rankEl.innerHTML='<option value="">-- 대회 선택 --</option>'+
      allT.map(t=>`<option value="${t.id}" ${t.id===v?'selected':''}>${t.name} (${t.date||''})</option>`).join('');
  }

  const cs=ge('regClub');
  if(cs) cs.innerHTML='<option value="">-- 클럽 선택 --</option>'+G.clubs.map(c=>`<option>${c}</option>`).join('');

  // ✅ FIX: popSel 후 각 select 값 있으면 즉시 UI 갱신 → 부서 바로 표시
  setTimeout(()=>{
    const regEl=ge('regTS'); if(regEl&&regEl.value) onRegTC();
    const brEl=ge('brTS');  if(brEl&&brEl.value)  onBrTC();
    const rkEl=ge('rankTS'); if(rkEl&&rkEl.value)  onRankTC();
  }, 0);
}
// ── 2026 김해시 등록 선수 명단 관리 ────────────────────────────────
function _m26Name(s){
  return (s||'').toString().replace(/\s*\(0\d{1,2}[-\d]+\)/g,'').replace(/\s+/g,'').trim();
}
function _m26Club(s){
  let club=(s||'').toString().trim();
  if(!club) return '';
  const aliasMap={
    '김해시시니어 클럽':'김해시니어',
    '김해시시니어클럽':'김해시니어',
    '김해시 시니어 클럽':'김해시니어',
    '김해시 시니어클럽':'김해시니어',
    '시니어클럽':'김해시니어'
  };
  if(aliasMap[club]) club=aliasMap[club];
  let m=club.match(/^(.+?)\s+([A-D])$/);
  if(m && m[1].trim().length>=2) club=m[1].trim();
  else {
    m=club.match(/^(.+?)([A-D])$/);
    if(m && /[가-힣]/.test(m[1]) && m[1].trim().length>=2) club=m[1].trim();
  }
  if(aliasMap[club]) club=aliasMap[club];
  return normalizeClub(club);
}
function getMemberRegistry2026(){
  if(!Array.isArray(G.meta.memberRegistry2026)) G.meta.memberRegistry2026=[];
  return G.meta.memberRegistry2026;
}
function _m26YearFromTournament(t){
  const d=(t?.date||'').toString().trim();
  const y=parseInt(d.slice(0,4),10);
  if(!isNaN(y)) return y;
  const m=(t?.name||'').toString().match(/20\d{2}/);
  return m?parseInt(m[0],10):0;
}
function needsMemberRegistry2026(t){ return _m26YearFromTournament(t) >= 2026; }
function findMemberRegistry2026(name, club){
  const nn=_m26Name(name), cc=_m26Club(club);
  return getMemberRegistry2026().find(x=>_m26Name(x.name)===nn && _m26Club(x.club)===cc);
}
function missingMembers2026(names, club, t){
  if(!shouldUsePlayerRegistry(t)) return [];
  return (names||[]).filter(n=>!findMemberRegistry2026(n, club));
}
function showMissingMembers2026(missing){
  const uniq=[...new Set((missing||[]).map(x=>(x||'').trim()).filter(Boolean))];
  const msg=`등록 선수 제한이 켜져 있어 명단 등록 후 출전 가능합니다` + (uniq.length?('\n\n미등록 선수: '+uniq.join(', ')): '');
  alert(msg);
}
async function syncRegistryMembersToPlayers(rows){
  const keys=[];
  (rows||[]).forEach(r=>{
    const name=(r.name||'').trim();
    const club=_m26Club(r.club||'');
    if(!name || !club) return;
    const key=pKey(name,club);
    if(!G.players[key]) G.players[key]={key,name,club,clubs:[club],history:[],wins:0,losses:0,phone:(r.phone||'').trim()};
    const p=G.players[key];
    p.key=key; p.name=name; p.club=club;
    if(!Array.isArray(p.clubs)) p.clubs=[];
    const clubSet = new Set((p.clubs||[]).map(c=>normalizeClub(c)).filter(Boolean));
    clubSet.add(normalizeClub(club));
    (String(r.subClub||'').split(',').map(s=>normalizeClub(s.trim())).filter(Boolean)).forEach(sc=>clubSet.add(sc));
    p.clubs = [...clubSet];
    if((r.phone||'').trim()) p.phone=(r.phone||'').trim();
    keys.push(key);
  });
  // 한 번에 너무 많은 동시 쓰기 방지: 20개씩 나눠서 순차 저장
  const CHUNK = 20;
  for(let i=0; i<keys.length; i+=CHUNK){
    await Promise.all(keys.slice(i, i+CHUNK).map(k=>stP(k)));
  }
}
function parseMemberRegistry2026Rows(rows){
  return normalizeRegistryRows(rows,{
    normalizeClub:_m26Club,
    normalizeName:_m26Name
  });
}
async function applyMemberRegistry2026(rows, mode){
  const incoming=parseMemberRegistry2026Rows(rows);
  if(!incoming.length){ toast('가져올 선수 명단이 없습니다','error'); return; }
  const cur=getMemberRegistry2026();
  let next;
  if(mode==='replace') next=incoming;
  else{
    const map=new Map(cur.map(r=>[_m26Name(r.name)+'__'+_m26Club(r.club), {name:r.name,club:_m26Club(r.club),phone:r.phone||''}]));
    incoming.forEach(r=>map.set(r.key,{name:r.name,club:_m26Club(r.club),phone:r.phone||''}));
    next=[...map.values()];
  }
  G.meta.memberRegistry2026=next.map(r=>({name:r.name,club:_m26Club(r.club),phone:(r.phone||'').trim()}));
  sl(true);
  try{
    await saveMeta();
    toast(`명단 저장 완료 (${incoming.length}명) — 선수 데이터 동기화 중...`,'info');
    await syncRegistryMembersToPlayers(G.meta.memberRegistry2026);
    sl(false);
    renderMemberRegistry2026Status();
    if(ge('m26Text')) ge('m26Text').value='';
    toast(`${REG_YEAR} 등록 선수 명단 ${mode==='replace'?'전체교체':'추가'} 완료 (${incoming.length}명 반영)`,'success');
  }catch(e){ sl(false); toast('명단 저장 실패: '+e.message,'error'); }
}
async function importMemberRegistry2026Text(mode){
  const text=(ge('m26Text')?.value||'').trim();
  if(!text){ toast('붙여넣을 명단을 입력하세요','error'); return; }
  await applyMemberRegistry2026(text.split(/\r?\n/), mode||'append');
}
async function importMemberRegistry2026File(input, mode){
  const f=input?.files?.[0];
  if(!f) return;
  try{
    let rows=[];
    const name=(f.name||'').toLowerCase();
    if(name.endsWith('.xlsx')||name.endsWith('.xls')){
      const buf=await f.arrayBuffer();
      const wb=XLSX.read(buf,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
    }else{
      rows=(await f.text()).split(/\r?\n/);
    }
    await applyMemberRegistry2026(rows, mode||'append');
  }catch(e){ toast('파일 불러오기 실패: '+e.message,'error'); }
  finally{ input.value=''; }
}
async function clearMemberRegistry2026(){
  if(!confirm(`${REG_YEAR} 등록 선수 명단을 모두 삭제할까요?\n과거 경기기록과 선수 이력은 삭제되지 않습니다.`)) return;
  G.meta.memberRegistry2026=[];
  sl(true);
  try{
    await saveMeta();
    _syncMetaToRegistry();
    await saveRegistry(2026);
    sl(false); renderMemberRegistry2026Status(); toast(`${REG_YEAR} 등록 선수 명단 삭제 완료`,'success');
  }catch(e){ sl(false); toast('삭제 실패: '+e.message,'error'); }
}
function renderMemberRegistry2026Status(){
  const box=ge('m26Status'), listEl=ge('m26List');
  if(!box || !listEl) return;
  const rows=[...getMemberRegistry2026()].sort((a,b)=>{
    const c=_m26Club(a.club).localeCompare(_m26Club(b.club),'ko');
    if(c!==0) return c;
    return (a.name||'').localeCompare((b.name||''),'ko');
  });
  box.innerHTML=`<div style="font-size:.78rem;color:var(--text2);line-height:1.55">• ${REG_YEAR}년 등록 선수만 신규 대회에 팀 등록할 수 있습니다.<br>• 클럽명은 자동으로 기본 클럽명으로 저장됩니다.</div>`;
  listEl.innerHTML = rows.length ? rows.map(r=>`<div style="display:flex;gap:8px;justify-content:space-between;padding:4px 0;border-bottom:1px dashed var(--border);font-size:.76rem"><span>${r.name}</span><span style="color:var(--text2)">${_m26Club(r.club)}${r.phone?` · ${r.phone}`:''}</span></div>`).join('') : `<div style="font-size:.76rem;color:var(--text3);padding:6px 0">${REG_YEAR}년 등록된 선수 명단이 없습니다.</div>`;
  // 홈 탭 등록선수 현황도 함께 갱신
  if(window.renderHomeReg) window.renderHomeReg();
}
function isFirstAppearancePlayer(name, club, currentTid){
  const nn = normName(name);
  if(!nn) return false;

  // 첫 출전은 "현재 대회 이전에 실제 출전 기록이 전혀 없는 경우"만 인정한다.
  // 이름만 등록돼 있거나 임시 승/패 값이 있는 정도로는 첫 출전을 지우지 않는다.

  // 1) 과거 엑셀/히스토리 대회
  for(const t of (HIST_DATA||[])){
    if((t?.id||'') === currentTid) continue;
    if((t?.teams||[]).some(tm => (tm?.players||[]).some(pn => normName(pn) === nn))) return false;
  }

  // 2) players 마스터의 명시적 history만 인정
  for(const k of Object.keys(G.players||{})){
    const p = G.players[k] || {};
    const playerName = normName(p.name || pKeyParse(k).name || '');
    if(playerName !== nn) continue;
    const hist = Array.isArray(p.history) ? p.history.filter(h => h && h.tid && h.tid !== currentTid) : [];
    if(hist.length > 0) return false;
  }

  // 3) 현재 시스템에 저장된 다른 대회 팀등록 데이터
  for(const key of Object.keys(G.teams||{})){
    const idx = key.lastIndexOf('_');
    const tid = idx>0 ? key.slice(0, idx) : '';
    if(tid && tid === currentTid) continue;
    const teams = G.teams[key] || [];
    for(const tm of teams){
      if((tm?.players||[]).some(pn => normName(pn) === nn)) return false;
    }
  }

  return true;
}
function normalizeCareerValue(v){
  return String(v==null?'':v).trim();
}
function findIndividualPlayerMeta(name, club=''){
  try{
    const nn=String(name||'').trim();
    const cc=String(club||'').trim();
    if(!nn) return null;
    for(const list of Object.values(G.teams||{})){
      for(const team of (list||[])){
        for(const p of (team?.individualPlayers||[])){
          const pName=String(p?.name||'').trim();
          if(pName!==nn) continue;
          const pClub=String(p?.clubsRaw||team?.club||'').trim();
          const clubOk=!cc || pClub===cc || baseClub(pClub)===baseClub(cc) || parseClubAliases(pClub).includes(baseClub(cc));
          if(!clubOk) continue;
          return {
            name: pName,
            club: pClub,
            phone: formatPhoneLoose(String(p?.phone||'')),
            career: normalizeCareerValue(p?.career||''),
            note: String(team?.note||'').trim()
          };
        }
      }
    }
    return null;
  }catch(e){ return null; }
}
function getPlayerContactInfo(name, club='', phone='', career=''){
  try{
    const nn=String(name||'').trim();
    const cc=String(club||'').trim();
    const info={phone:formatPhoneLoose(String(phone||'')),career:normalizeCareerValue(career),club:cc,note:''};
    const fromTeam=findIndividualPlayerMeta(nn, cc);
    if(fromTeam){
      if(!info.phone && fromTeam.phone) info.phone=fromTeam.phone;
      if(!info.career && fromTeam.career) info.career=fromTeam.career;
      if(!info.club && fromTeam.club) info.club=fromTeam.club;
      if(fromTeam.note) info.note=fromTeam.note;
    }
    const candidates=[];
    if(cc){
      candidates.push(pKey(nn, cc));
      const bc=baseClub(cc);
      if(bc && bc!==cc) candidates.push(pKey(nn, bc));
    }
    for(const key of candidates){
      const p=G.players?.[key];
      if(!p) continue;
      if(!info.phone && p.phone) info.phone=formatPhoneLoose(String(p.phone));
      if(!info.career && p.career) info.career=normalizeCareerValue(p.career);
      if(!info.club && (p.club || pKeyParse(key).club)) info.club=String(p.club||pKeyParse(key).club||'').trim();
    }
    for(const [key,p] of Object.entries(G.players||{})){
      const parsed=pKeyParse(key);
      if(String(p?.name||parsed.name||'').trim()!==nn) continue;
      if(cc){
        const pClub=String(p?.club||parsed.club||'').trim();
        const pBase=baseClub(pClub);
        const clubBase=baseClub(cc);
        const clubs=[pClub,pBase].filter(Boolean);
        if(!clubs.includes(cc) && !(clubBase && clubs.includes(clubBase))) continue;
      }
      if(!info.phone && p?.phone) info.phone=formatPhoneLoose(String(p.phone));
      if(!info.career && p?.career) info.career=normalizeCareerValue(p.career);
      if(!info.club && (p?.club||parsed.club)) info.club=String(p?.club||parsed.club||'').trim();
      break;
    }
    return info;
  }catch(e){
    return {phone:formatPhoneLoose(String(phone||'')),career:normalizeCareerValue(career),club:String(club||'').trim(),note:''};
  }
}
function getPlayerPhone(name, club=''){
  return getPlayerContactInfo(name, club).phone||'';
}
function getPlayerCareer(name, club=''){
  return getPlayerContactInfo(name, club).career||'';
}
function renderClickablePlayerName(name, club='', phone='', style='', career=''){
  const nm=String(name||'').trim();
  if(!nm) return '-';
  const info=getPlayerContactInfo(nm, club, phone, career);
  const baseStyle=`cursor:pointer;${style||''}`;
  return `<span onclick="openPlayerContact('${esc(nm)}','${esc(info.club||club||'')}','${esc(info.phone||'')}','${esc(info.career||'')}')" style="${baseStyle}">${nm}</span>`;
}
function renderClickablePlayerNames(names=[], club='', phones=[], careers=[]){
  try{
    return (names||[]).map((nm,idx)=>renderClickablePlayerName(nm, club, Array.isArray(phones)?phones[idx]:'', '', Array.isArray(careers)?careers[idx]:'')).join(' / ');
  }catch(e){ return (names||[]).join(' / '); }
}
function openPlayerContact(name, club='', phone='', career=''){
  try{
    const nm=String(name||'').trim()||'선수';
    const info=getPlayerContactInfo(nm, club, phone, career);
    const raw=String(info.phone||'').trim();
    const clean=raw.replace(/[^0-9+]/g,'');
    const body=ge('mPlayerQuickContactBody');
    const title=ge('mPlayerQuickContactTitle');
    const callBtn=ge('mPlayerQuickContactCall');
    const smsBtn=ge('mPlayerQuickContactSms');
    const copyBtn=ge('mPlayerQuickContactCopy');
    if(title) title.textContent=`📱 ${nm}`;
    if(body){
      body.innerHTML=`<div style="display:grid;gap:10px">
        <div style="padding:10px 12px;background:var(--panel2);border:1px solid var(--border);border-radius:12px">
          <div style="font-size:.78rem;color:var(--text3);margin-bottom:6px">전화번호</div>
          <div style="font-size:1rem;font-weight:900;color:var(--text)">${raw||'미등록'}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="padding:10px 12px;background:var(--panel2);border:1px solid var(--border);border-radius:12px">
            <div style="font-size:.78rem;color:var(--text3);margin-bottom:6px">구력</div>
            <div style="font-size:.96rem;font-weight:800;color:var(--text)">${info.career||'미입력'}</div>
          </div>
          <div style="padding:10px 12px;background:var(--panel2);border:1px solid var(--border);border-radius:12px">
            <div style="font-size:.78rem;color:var(--text3);margin-bottom:6px">소속</div>
            <div style="font-size:.96rem;font-weight:800;color:var(--text)">${info.club||club||'-'}</div>
          </div>
        </div>
        ${info.note?`<div style="padding:10px 12px;background:#fff8df;border:1px solid #f6d365;border-radius:12px;font-size:.82rem;line-height:1.6;color:#7a5600"><b>비고</b><br>${info.note}</div>`:''}
      </div>`;
    }
    if(callBtn){
      callBtn.disabled=!clean;
      callBtn.onclick=()=>{ if(clean) location.href=`tel:${clean}`; };
    }
    if(smsBtn){
      smsBtn.disabled=!clean;
      smsBtn.onclick=()=>{ if(clean) location.href=`sms:${clean}`; };
    }
    if(copyBtn){
      copyBtn.onclick=async ()=>{
        if(!raw){ toast('전화번호가 등록되지 않았습니다','info'); return; }
        const copied=await copyTextSafe(raw);
        toast(copied?'번호 복사 완료 ✅':'번호를 수동으로 복사해 주세요','success');
      };
    }
    om('mPlayerQuickContact');
  }catch(e){
    console.warn('openPlayerContact error', e);
  }
}
function rosterPlayerHTML(name, club, tid){
  const mark=isFirstAppearancePlayer(name, club, tid);
  const info=getPlayerContactInfo(name, club);
  const style=`color:${mark?'#92400e':'var(--primary)'};font-weight:${mark?'800':'700'}`;
  return renderClickablePlayerName(name, club, info.phone||'', style, info.career||'');
}

function onRegTC(){
  const tid=ge('regTS').value,ds=ge('regDS');
  try{ syncTournamentDataForPage('register', tid || getRealtimeTargetTournamentId() || null, false).catch(e=>console.warn('register sync failed', e)); }catch(e){}
  setRegClubInputMode(currentRegIsIndividual());
  applyRegLoginUI();
  ge('regSection').style.display='none';
  if(!tid){
    if(ds) ds.innerHTML='<option value="">-- 부서 선택 --</option>';
    const ov=ge('regDivisionOverview'); if(ov) ov.innerHTML='';
    return;
  }
  const t=G.tournaments.find(t=>t.id===tid);
  if(ds) ds.innerHTML='<option value="">-- 부서 선택 --</option>'+t.divisions.map(d=>`<option value="${d}">${dl(d)}</option>`).join('');
  renderRegisterDivisionOverview();
  if(t.divisions.length===1){
    ds.value=t.divisions[0];
    renderRL();
  }else if(ds.value && t.divisions.includes(ds.value)){
    renderRL();
  }
}
// 현재 부서가 테린이인지 확인하고 복식 수 반환
function getRegDoublesCount(){
  const div=ge('regDS')?.value||'';
  const tid=ge('regTS')?.value||'';
  const t=G.tournaments.find(x=>x.id===tid);
  // divSettings에 저장된 복식 수 우선 사용
  const cfgDbl=t?.divSettings?.[div]?.doublesCount;
  if(cfgDbl) return cfgDbl;
  // 테린이/여성부 기본 3복식, 나머지 5복식
  if(div==='테린이'||div==='terinee'||div==='여성부') return 3;
  return 5;
}

// 등록 폼 슬롯 업데이트 (부서/복식 수 변경 시)
function updateRegisterSlots(){
  const div=ge('regDS')?.value||'';
  const tid=ge('regTS')?.value||'';
  const t=G.tournaments.find(x=>x.id===tid);
  const isIndividual=isIndividualTournament(t);
  const state=getRegistrationFormState({
    div,
    isIndividual,
    doublesCount:(isIndividual?1:getRegDoublesCount())
  });

  setRegClubInputMode(state.isIndividual);
  toggleIndividualSimpleFields(state.isIndividual);

  const sel=ge('terineeModeSel');
  if(sel) sel.style.display=state.showTerineeMode?'block':'none';

  const s4=ge('slot4'),s5=ge('slot5');
  if(s4) s4.style.display=state.showSlot4?'block':'none';
  if(s5) s5.style.display=state.showSlot5?'block':'none';

  state.pairLabels.forEach((info,idx)=>{
    const lbl=ge(`pairLabel${idx+1}`);
    if(!lbl) return;
    lbl.textContent=info.text;
    lbl.style.display=info.show?'block':'none';
    if(info.color) lbl.style.color=info.color;
  });

  const sn1=ge('subNum1'),sn2=ge('subNum2');
  if(sn1) sn1.textContent=state.subNum1;
  if(sn2) sn2.textContent=state.subNum2;

  const p11=ge('p11'),p12=ge('p12');
  if(p11) p11.placeholder=state.subPlaceholder1;
  if(p12) p12.placeholder=state.subPlaceholder2;

  const modeLabel=ge('regModeLabel');
  if(modeLabel) modeLabel.textContent=state.modeLabel;

  const pl=ge('regPlayerLabel');
  if(pl) pl.innerHTML=state.playerLabelHtml;

  const clubLabel=ge('regClubLabel');
  if(clubLabel) clubLabel.innerHTML=state.clubLabelHtml;

  const noLabel=ge('regNoLabel');
  if(noLabel) noLabel.textContent=state.numberLabel;

  let womenNotice=ge('womenPairNotice');
  if(state.showWomenNotice){
    if(!womenNotice){
      womenNotice=document.createElement('div');
      womenNotice.id='womenPairNotice';
      const anchor=ge('regPlayerLabel')?.closest('.form-group')||ge('regPlayerLabel');
      if(anchor) anchor.insertAdjacentElement('beforebegin',womenNotice);
    }
    womenNotice.style.display='block';
    womenNotice.innerHTML=getWomenPairNoticeHtml();
  }else if(womenNotice){
    womenNotice.style.display='none';
  }

  state.visibleSlots.forEach((show,idx)=>{
    const i=idx+1;
    const slot=ge('p'+i)?.closest('.pslot');
    const hint=ge('h'+i);
    if(slot) slot.style.display=show?'flex':'none';
    if(hint) hint.style.display=show?'block':'none';
  });

  const subWrap=ge('p11')?.closest('div[style*="border-top"]');
  if(subWrap) subWrap.style.display=state.showSubWrap?'block':'none';
}


function buildRegisterRosterGrid(tid,div,teams,key){
  const tournament=(G.tournaments||[]).find(x=>x.id===tid);
  return buildRegistrationRosterGrid({
    tid,
    div,
    teams,
    key,
    tournament,
    isIndividual:isIndividualTournament(tournament),
    regClub:REG_CLUB,
    isAdmin:AD,
    isDirector:REG,
    deadlinePassed:(!AD && isRegDeadlinePassed()),
    baseClub,
    getIndividualDisplayLine,
    teamDisplayName:tdn,
    isFirstAppearancePlayer,
    rosterPlayerHTML,
    escapeHtml:esc
  });
}



function upsertIndividualPlayerMetaRecords(individualPlayers=[]){
  try{
    (individualPlayers||[]).forEach(p=>{
      const nm=String(p?.name||'').trim();
      const rawClub=String(p?.clubsRaw||'').trim();
      const career=normalizeCareerValue(p?.career||'');
      const phone=formatPhoneLoose(String(p?.phone||''));
      if(!nm || !rawClub) return;
      const clubs=parseClubAliases(rawClub);
      const base=clubs[0]||rawClub;
      const key=pKey(nm, base);
      if(!G.players[key]) G.players[key]={key,name:nm,club:base,clubs:[base],history:[],wins:0,losses:0};
      const rec=G.players[key];
      rec.key=key;
      rec.name=nm;
      rec.club=base;
      rec.clubs=[...new Set([...(rec.clubs||[]), ...clubs, base].filter(Boolean))];
      if(phone) rec.phone=phone;
      if(career) rec.career=career;
    });
  }catch(e){}
}
async function persistIndividualPlayerMeta(individualPlayers=[]){
  upsertIndividualPlayerMetaRecords(individualPlayers);
  try{
    const keys=(individualPlayers||[]).map(p=>pKey(String(p?.name||'').trim(), parseClubAliases(String(p?.clubsRaw||'').trim())[0]||String(p?.clubsRaw||'').trim())).filter(Boolean);
    for(const k of keys){
      if(G.players[k]) await stP(k);
    }
  }catch(e){ console.warn('persistIndividualPlayerMeta failed', e); }
}
function renderRegisterDivisionOverview(){
  const box=ge('regDivisionOverview');
  const tid=ge('regTS')?.value||'';
  if(!box) return;

  // ✅ innerHTML 갱신 전에 aoReg 폼을 body로 피신시켜 DOM 소실 방지
  const form=ge('aoReg');
  if(form && box.contains(form)) document.body.appendChild(form);

  if(!tid){ box.innerHTML=''; return; }
  const t=G.tournaments.find(x=>x.id===tid);
  if(!t){ box.innerHTML=''; return; }
  const isOpen=t.status==='open';
  const selected=ge('regDS')?.value||'';
  const divisions=(t.divisions||[]).slice().sort((a,b)=>{
    const order={'금':1,'은':2,'동':3,'테린이':4};
    return (order[a]||99)-(order[b]||99);
  });
  // 필터 안내 배너
  const _filterBanner = (MY_CLUB_FILTER && REG_CLUB)
    ? `<div style="padding:8px 12px;background:#dcfce7;border:1.5px solid #16a34a;border-radius:10px;font-size:.8rem;color:#166534;font-weight:600;margin-bottom:10px">
        🏆 ${REG_CLUB} 팀만 표시 중 (같은 클럽 다른 팀은 숨김) &nbsp;<button onclick="toggleMyClubFilter('register')" style="font-size:.74rem;padding:2px 8px;border:1px solid #16a34a;border-radius:999px;background:white;color:#166534;cursor:pointer">전체 보기</button>
      </div>` : '';
  box.innerHTML=_filterBanner+divisions.map(div=>{
    const key=tid+'_'+div;
    const allTeams=G.teams[key]||[];
    // 내 클럽 필터 ON 시 내 클럽 팀만 표시
    const bc = REG_CLUB ? baseClub(REG_CLUB) : '';
    const teams = (MY_CLUB_FILTER && bc)
      ? allTeams
          .map((tm,origIdx)=>({...tm,_origIdx:origIdx}))
          .filter(tm=>baseClub(tm.club||'')===bc || tm.club===REG_CLUB)
      : allTeams.map((tm,origIdx)=>({...tm,_origIdx:origIdx}));
    const totalPlayers=teams.reduce((s,tm)=>s+((tm.players||[]).length),0);
    const isSel=selected===div;
    const canRegister=isIndividualTournament(t) ? isOpen : ((AD||REG||isPublicTeamRegistrationEnabled()) && (AD||isOpen) && (AD||!isRegDeadlinePassed()));
    // 내 클럽 필터 ON 시 내 클럽이 있는 부서만 강조
    const hasMyTeam = bc && allTeams.some(tm=>baseClub(tm.club||'')===bc||tm.club===REG_CLUB);
    const borderColor = MY_CLUB_FILTER && hasMyTeam ? '#16a34a' : isSel ? '#d4a017' : '#dbe4f0';
    return `<div class="card" style="margin-bottom:14px;border-top:3px solid ${borderColor}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="dpill ${dc(div)}">${dl(div)}</span>
          <span class="badge bg-green">${teams.length}${isIndividualTournament(t)?'조':'팀'}</span>
          <span class="badge bg-blue">${totalPlayers}명</span>${getDivisionMaxTeams(tid,div)?`<span class="badge bg-gold">정원 ${getDivisionMaxTeams(tid,div)}</span>`:''}
          ${isSel?'<span class="badge" style="background:var(--accent);color:#fff">등록 입력중</span>':''}
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn ${canRegister?'btn-primary':'btn-gray'}" style="padding:7px 14px;font-size:.78rem" ${canRegister?`onclick="selectRegDivision('${div}')"`:'disabled'}>${canRegister?(isIndividualTournament(t)?'+ 참가 접수':'+ 팀 등록'):'등록 불가'}</button>
        </div>
      </div>
      ${buildRegisterRosterGrid(tid,div,teams,key)}
      <div id="regInlineForm_${div}" style="margin-top:12px;display:${isSel&&canRegister?'block':'none'}"></div>
      ${!isOpen&&!AD?`<div style="margin-top:10px;padding:9px 12px;background:var(--panel2);border:1px solid var(--border);border-radius:10px;font-size:.76rem;color:var(--text2)">⛔ 현재 대회 상태가 <b>${t.status==='finished'?'종료':t.status==='closed'?'마감':'접수 불가'}</b>라 ${isIndividualTournament(t)?'참가 접수':'일반 팀 등록'}은 비활성화됩니다.</div>`:''}
    </div>`;
  }).join('');
}

function selectRegDivision(div){
  const tid=ge('regTS')?.value||'';
  const t=G.tournaments.find(x=>x.id===tid);
  if(!t){ toast('대회를 먼저 선택하세요','info'); return; }
  if(!(AD||REG||isPublicTeamRegistrationEnabled()) && !isIndividualTournament(t)){ toast('로그인 후 등록할 수 있습니다','info'); return; }
  if(!AD && t.status!=='open'){ toast('접수중 대회만 등록 가능합니다','error'); return; }
  const ds=ge('regDS');
  if(ds) ds.value=div;
  renderRegisterDivisionOverview();
  renderRL();
  setTimeout(()=>{ ge(`regInlineForm_${div}`)?.scrollIntoView({behavior:'smooth',block:'nearest'}); },60);
}

function mountRegisterFormInline(div){
  const form=ge('aoReg');
  const host=ge(`regInlineForm_${div}`);
  if(!form||!host) return;
  // host가 숨겨져 있으면 표시
  host.style.display='block';
  if(form.parentElement!==host) host.appendChild(form);
  form.style.display='block';
}

function renderRL(){
  const tid=ge('regTS').value,div=ge('regDS').value;
  updateFilterBtnUI('register', MY_CLUB_FILTER);
  renderRegisterDivisionOverview();
  if(!tid||!div){
    ge('regSection').style.display='none';
    const form=ge('aoReg');
    if(form) form.style.display='none';
    return;
  }

  const t=G.tournaments.find(t=>t.id===tid);
  const isIndividual=isIndividualTournament(t);
  const isOpen = (t?.status==='open');
  const deadlinePassed = !AD && isRegDeadlinePassed();
  const canRegister = isIndividual ? isOpen : (AD || REG || (isPublicTeamRegistrationEnabled() && !deadlinePassed));
  const lock = (!AD && !isOpen) || (!isIndividual && deadlinePassed);

  ge('regSection').style.display='block';
  ge('aoReg').style.display=canRegister?'block':'none';
  if(canRegister) mountRegisterFormInline(div);
  if(isIndividual){ const modeLabel=ge('regModeLabel'); if(modeLabel) modeLabel.textContent='— 개인전 | 2인 페어 참가 | 참가자별 클럽·전화·구력 입력'; } else { const modeLabel=ge('regModeLabel'); if(modeLabel) modeLabel.textContent='— 단체전 | 복식 수/후보 설정 사용'; }
  const bulkBarHost=ge('individualBulkImportBar');
  if(bulkBarHost) bulkBarHost.remove();
  if(canRegister && isIndividual && AD){
    const formBox=ge('aoReg');
    const titleEl=formBox?.querySelector('.card-title');
    if(formBox && titleEl){
      const bar=document.createElement('div');
      bar.id='individualBulkImportBar';
      bar.style.cssText='display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin:-4px 0 10px';
      bar.innerHTML=`<button class="btn btn-outline" style="font-size:.78rem;padding:6px 12px" onclick="openIndividualExcelModal()">📥 엑셀 일괄 등록</button>`;
      titleEl.insertAdjacentElement('afterend', bar);
    }
  }

  if(REG && REG_CLUB && !AD && !isIndividual){
    setTimeout(()=>{
      if(usesFixedClubList()){
        const cs=ge('regClub');
        if(cs&&cs.value!==REG_CLUB){
          const wantBase=baseClub(normalizeClub(REG_CLUB));
          const opt=[...cs.options].find(o=>{
            const ov=normalizeClub(o.value||o.textContent||'');
            return ov===normalizeClub(REG_CLUB) || baseClub(ov)===wantBase;
          });
          if(opt){ cs.value=opt.value; try{ onRegClubChange(); }catch(e){} }
        }
      }else{
        const txt=ge('regClubText');
        if(txt && !String(txt.value||'').trim()) txt.value=normalizeClub(REG_CLUB);
      }
    },150);
  }else if(isIndividual){
    if(ge('regClubText')) ge('regClubText').value='';
  }

  updateRegisterSlots();

  const clubSel=ge('regClub'); if(clubSel) clubSel.disabled = lock || isIndividual;
  const clubTxt=ge('regClubText'); if(clubTxt) clubTxt.disabled = lock || !isIndividual;
  for(let i=1;i<=12;i++){ const el=ge('p'+i); if(el) el.disabled = lock; }
  const regBtn = document.querySelector('#aoReg button.btn.btn-primary');
  if(regBtn){
    regBtn.disabled = lock || !canRegister;
    regBtn.textContent = isIndividual ? '✅ 참가 접수' : '✅ 팀 등록';
  }

  let msg = ge('regLockMsg');
  if(!msg){
    msg = document.createElement('div');
    msg.id = 'regLockMsg';
    msg.style.cssText = 'margin-top:10px;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--panel2);font-size:.78rem;color:var(--text2);line-height:1.5;display:none;';
    const anchor = ge('aoReg');
    if(anchor) anchor.insertAdjacentElement('afterend', msg);
  }
  if(!isIndividual && deadlinePassed && REG){
    msg.style.display='block';
    msg.innerHTML = `⛔ <b>등록 기한이 만료</b>되어 팀 등록·수정·삭제가 불가합니다.<br><span style="font-size:.75rem;color:var(--text3)">${regDeadlineLabel()}</span>`;
    ge('aoReg').style.display='none';
  }else if(!canRegister){
    msg.style.display='block';
    msg.innerHTML=isIndividual
      ? '현재는 참가 접수할 수 없는 상태입니다.'
      : (isPublicTeamRegistrationEnabled() ? '현재 팀 등록은 공개 접수 방식입니다. 클럽/팀명을 직접 입력해 접수할 수 있습니다.' : '📋 팀 등록을 하려면 상단의 <b>팀담당 로그인</b>이 필요합니다.');
  }else if(lock){
    msg.style.display='block';
    msg.innerHTML = `⛔ 현재 선택한 대회는 <b>${t?.status==='finished'?'종료':t?.status==='closed'?'마감':'접수중 아님'}</b> 상태라 ${isIndividual?'참가 접수':'팀 등록'}이 비활성화 됩니다.<br>상단에서 <b>접수중 대회</b>를 선택해 주세요.`;
  }else{
    msg.style.display='none';
  }

  const key=tid+'_'+div,teams=G.teams[key]||[];
  ge('regTCnt').textContent=teams.length+(isIndividual?'조':'팀');
  ge('regNo').value=teams.length+1;
  renderRegistrationRosterPreview('', '', [], '');
}

function renderRegistrationRosterPreview(club='', teamNo='', players=[], note=''){
  const card = ge('regRosterPreviewCard');
  const body = ge('regRosterPreviewBody');
  if(!card || !body) return;
  const safePlayers = Array.isArray(players) ? players.filter(Boolean) : [];
  if(!club && !teamNo && safePlayers.length===0 && !note){
    card.style.display='none';
    body.innerHTML='';
    return;
  }
  card.style.display='none';
  body.innerHTML='';
}

async function registerTeam(){
  const tid=ge('regTS').value,div=ge('regDS').value;
  const t=G.tournaments.find(t=>t.id===tid);
  const isIndividual=isIndividualTournament(t);
  const club=getRegClubInputValue();

  if(!AD && !isIndividual && isRegDeadlinePassed()){ toast(`등록 기한이 만료되어 등록할 수 없습니다.\n${regDeadlineLabel()}`,'error'); return; }
  if(!tid||!div){toast('대회/부서 선택','error');return;}
  if(t?.status&&t.status!=='open'){toast('접수중인 대회만 등록 가능','error');return;}
  if(!isIndividual && !club){toast('클럽 선택','error');return;}

  const key=tid+'_'+div,ex=G.teams[key]||[];
  const maxTeams=getDivisionMaxTeams(tid,div);
  const capacityCheck=validateRegistrationCapacity({
    currentCount:ex.length,
    maxTeams,
    isIndividual
  });
  if(!capacityCheck.ok){ toast(capacityCheck.error,'error'); return; }

  let names=[];
  let dbl=1;
  let regMainCount=2;

  let individualPlayers=[];
  if(isIndividual){
    const p1=(ge('ip1name')?.value||'').trim();
    const p2=(ge('ip2name')?.value||'').trim();
    const p1clubRaw=(ge('p1club')?.value||'').trim();
    const p2clubRaw=(ge('p2club')?.value||'').trim();
    const p1phone=formatPhoneLoose(ge('p1phone')?.value||'');
    const p2phone=formatPhoneLoose(ge('p2phone')?.value||'');
    const p1career=normalizeCareerValue(ge('p1career')?.value||'');
    const p2career=normalizeCareerValue(ge('p2career')?.value||'');
    const note=(ge('pNote')?.value||'').trim();
    const editPin=((ge('pEditPin')?.value||'').trim()).replace(/\D/g,'');
    names=[p1,p2].filter(Boolean);
    const p1receiveOrderSms=!!ge('p1receiveOrderSms')?.checked;
    const p1receiveResultSms=!!ge('p1receiveResultSms')?.checked;
    const p2receiveOrderSms=!!ge('p2receiveOrderSms')?.checked;
    const p2receiveResultSms=!!ge('p2receiveResultSms')?.checked;
    const individualCheck=validateIndividualRegistration({
      names,
      player1Club:p1clubRaw,
      player2Club:p2clubRaw,
      editPin,
      player1Phone:p1phone,
      player2Phone:p2phone,
      smsFlags:[p1receiveOrderSms,p1receiveResultSms,p2receiveOrderSms,p2receiveResultSms],
      existingTeams:ex
    });
    if(!individualCheck.ok){ toast(individualCheck.error,'error'); return; }
    individualPlayers=[
      {name:p1, clubsRaw:p1clubRaw, clubs:parseClubAliases(p1clubRaw), phone:p1phone, career:p1career, receiveSms:(p1receiveOrderSms||p1receiveResultSms), receiveOrderSms:p1receiveOrderSms, receiveResultSms:p1receiveResultSms},
      {name:p2, clubsRaw:p2clubRaw, clubs:parseClubAliases(p2clubRaw), phone:p2phone, career:p2career, receiveSms:(p2receiveOrderSms||p2receiveResultSms), receiveOrderSms:p2receiveOrderSms, receiveResultSms:p2receiveResultSms}
    ];
  }else{
    if(!club){toast('클럽 선택','error');return;}
    dbl=getRegDoublesCount();
    const mainCount=dbl*2;
    const isRegW=(div==='여성부'), isRegT=(div==='테린이'||div==='terinee');
    regMainCount=isRegW?6:mainCount;
    const regTotal=regMainCount+2;
    for(let i=1;i<=regTotal;i++){const v=ge('p'+i)?.value.trim();if(v)names.push(v);}
    const teamCheck=validateTeamRegistration({
      names,
      club,
      maxPlayers:regTotal,
      existingTeams:ex,
      makePlayerKey:pKey
    });
    if(!teamCheck.ok){ toast(teamCheck.error,'error'); return; }
    const missing2026=missingMembers2026(names, club, t);
    if(missing2026.length){showMissingMembers2026(missing2026);return;}
  }

  sl(true);
  if(!G.teams[key])G.teams[key]=[];
  const newTeam=isIndividual
    ? buildIndividualRegistrationPayload({
        club:(individualPlayers[0]?.clubsRaw||individualPlayers[1]?.clubsRaw||''),
        players:names,
        individualPlayers,
        editPin:((ge('pEditPin')?.value||'').trim()).replace(/\D/g,''),
        extra:{
          clubTokens:[...new Set(individualPlayers.flatMap(p=>p.clubs||[]))],
          doublesCount:1,
          mainPlayerCount:2,
          pairLabel:getIndividualDisplayLine({individualPlayers}),
          entryLabel:getIndividualDisplayLine({individualPlayers}),
          tournamentType:'individual_pair',
          note:((ge('pNote')?.value||'').trim())
        }
      })
    : buildTeamRegistrationPayload({
        club,
        players:names,
        doublesCount:dbl,
        extra:{
          mainPlayerCount:regMainCount,
          tournamentType:'team',
          pairLabel:'',
          entryLabel:'',
          note:'',
          editPin:''
        }
      });
  G.teams[key].push(newTeam);
  const newIdx=G.teams[key].length-1;

  try{
    await stT(key);
  }catch(e){
    G.teams[key].splice(newIdx,1);
    if(!G.teams[key].length) delete G.teams[key];
    sl(false);
    toast('등록 실패: '+e.message,'error');
    return;
  }

  const postErrors=[];
  if(!isIndividual){
    try{
      await Promise.all(names.map(n=>regP(n,club,tid,div)));
    }catch(e){
      postErrors.push('선수기록 동기화');
      console.warn('registerTeam regP failed', e);
    }
  }

  try{
    await fbLog(`${isIndividual?'개인전 접수':'팀 등록'}: ${newTeam.entryLabel||tdn({club},key,newIdx)} ${div}`,'📋');
  }catch(e){
    postErrors.push('활동로그 저장');
    console.warn('registerTeam fbLog failed', e);
  }

  if(!isIndividual){
    try{
      const _regPhone=(ge('regContactPhone')?.value||'').replace(/[^0-9-]/g,'').trim();
      if(_regPhone && _regPhone.length>=9 && !(G.meta.clubContacts||{})[club]){
        if(!G.meta.clubContacts) G.meta.clubContacts={};
        G.meta.clubContacts[club]=_regPhone;
        const _last4=_regPhone.replace(/[^0-9]/g,'').slice(-4);
        if(_last4.length===4){
          if(!G.meta.clubPasswords) G.meta.clubPasswords={};
          if(!G.meta.clubPasswords[club]) G.meta.clubPasswords[club]=_last4;
        }
        await saveMeta();
      }
    }catch(e){
      postErrors.push('연락처 저장');
      console.warn('registerTeam saveMeta failed', e);
    }
  }

  for(let i=1;i<=12;i++){const el=ge('p'+i);if(el){el.value='';const h=ge('h'+i);if(h)h.innerHTML='';}}
  ['ip1name','ip2name','p1club','p2club','p1phone','p2phone','pNote','pEditPin','regClubText'].forEach(id=>{ if(ge(id)) ge(id).value=''; });
  ['p1receiveOrderSms','p1receiveResultSms','p2receiveOrderSms','p2receiveResultSms'].forEach(id=>{ if(ge(id)) ge(id).checked=true; });
  sl(false);
  renderRL();
  renderRegisterDivisionOverview();
  toast(isIndividual?'참가 접수 완료 ✅':'팀 등록 완료 ✅','success');
}
async function _removePlayerHistory(names, club, tid, div){
  const bc = baseClub(club || '');

  for(const name of (names || [])){
    const keys = [];
    const k1 = pKey(name, bc);
    if(k1) keys.push(k1);
    if(G.players[name]) keys.push(name); // 예전 방식 키 대응

    for(const pk of [...new Set(keys)]){
      const p = G.players[pk];
      if(!p) continue;

      p.history = (p.history || []).filter(h => !(h.tid === tid && h.div === div));

      if(!(p.history || []).length && !(p.wins || 0) && !(p.losses || 0)){
        try{
          await deleteDoc(doc(db,'players', pk.replace(/[\/\.#\$\[\]]/g,'_')));
        }catch(e){}
        delete G.players[pk];
      }else{
        await stP(pk);
      }
    }
  }
}

function verifyIndividualEditPin(team, actionLabel='수정/삭제'){
  const isIndividual = !!team && (
    team.tournamentType==='individual_pair' ||
    Array.isArray(team.individualPlayers) ||
    getTournamentTypeById(String(CE_key||'').split('_')[0]||'')==='individual_pair'
  );
  if(!isIndividual) return true;
  const saved=String(team.editPin||'').replace(/\D/g,'');
  if(saved.length!==4){ toast('이 참가팀의 비밀번호 정보가 없습니다','error'); return false; }
  const entered=String(prompt(`${actionLabel} 비밀번호 4자리를 입력하세요`)||'').trim().replace(/\D/g,'');
  if(!entered) return false;
  if(entered!==saved){ toast('비밀번호가 일치하지 않습니다','error'); return false; }
  return true;
}
async function delTeam(key,idx){
  const team = (G.teams[key] || [])[idx];
  if(!team) return;
  const tid0 = String(key||'').split('_')[0] || '';
  const isIndividual = getTournamentTypeById(tid0)==='individual_pair' || team.tournamentType==='individual_pair' || Array.isArray(team.individualPlayers);

  if(isIndividual){
    if(!AD && !verifyIndividualEditPin(team,'삭제')) return;
  }else{
    const deleteCheck=canDeleteRegistration({
      isAdmin:AD,
      isDirector:REG,
      teamClub:baseClub(team.club||''),
      directorClub:baseClub(REG_CLUB||'')
    });
    if(!deleteCheck.ok){
      toast(deleteCheck.error==='삭제 권한이 없습니다'?'경기이사 로그인 후 내 클럽 팀만 삭제할 수 있습니다':deleteCheck.error,'error');
      return;
    }
    if(!AD && isRegDeadlinePassed()){
      toast(`등록 기한이 만료되어 삭제할 수 없습니다.\n${regDeadlineLabel()}`,'error');
      return;
    }
  }

  if(!confirm('팀을 삭제하면 해당 선수들의 참가 기록도 함께 삭제됩니다.\n삭제하시겠습니까?')) return;

  const {tid, div} = _k2td(key);
  const oldPlayers = [...(team.players || [])];
  const oldClub = team.club || '';
  const backupTeams = JSON.parse(JSON.stringify(G.teams[key] || []));

  sl(true);
  try{
    G.teams[key].splice(idx,1);
    await stT(key);
  }catch(e){
    G.teams[key] = backupTeams;
    sl(false);
    toast('삭제 실패: '+e.message,'error');
    return;
  }

  const postErrors = [];

  try{
    await _removePlayerHistory(oldPlayers, oldClub, tid, div);
  }catch(e){
    postErrors.push('선수기록 삭제');
    console.warn('delTeam _removePlayerHistory failed', e);
  }

  sl(false);
  try{ renderRL(); }catch(e){ console.warn('delTeam renderRL failed', e); }
  try{ renderAllP(); }catch(e){ console.warn('delTeam renderAllP failed', e); }

  if(postErrors.length){
    toast('팀 및 선수기록 삭제 완료 ✅','success'); console.warn('부가정리 실패:', postErrors.join(', '));
  }else{
    toast('팀 및 선수기록 삭제 완료','success');
  }
}
function buildRosterInputsHTML(prefix,count,values=[],div,dbl,mainCountOverride){
  div=div||''; dbl=dbl||5;
  const isW=(div==='여성부');
  const isT=(div==='테린이'||div==='terinee');
  const mainCount=Number.isFinite(Number(mainCountOverride)) && Number(mainCountOverride)>0
    ? Number(mainCountOverride)
    : (isW?6:isT?dbl*2:count-2);
  const wLabels=['1조 🌸 개나리','2조 🌼 국화','3조 🌱 테린이 (구력 4년↓)'];
  let html='';
  for(let i=1;i<=count;i++){
    const isSub=i>mainCount;
    if(isW && i<=6 && (i===1||i===3||i===5)){
      const gi=(i-1)/2;
      html+=`<div style="font-size:.68rem;font-weight:700;color:#7c3aed;padding:${i>1?'6px':'0px'} 0 3px">${wLabels[gi]}</div>`;
    }
    if(isSub && i===mainCount+1){
      html+='<div style="font-size:.68rem;font-weight:700;color:var(--text3);padding:8px 0 3px;border-top:1.5px dashed var(--border);margin-top:2px">후보 (선택, 최대 2명)</div>';
    }
    const subIdx=i-mainCount;
    const ph=isSub?`후보 ${subIdx}`:`선수 ${i}`;
    const badgeTxt=isSub?`후${subIdx}`:`${i}`;
    const borderC=(isW&&!isSub&&i<=6)?'border-color:#d8b4fe;':isSub?'border-style:dashed;':'';
    html+=`<div class="pslot" style="${borderC}margin-bottom:4px"><div class="pslot-num" style="${isSub?'background:var(--bg2);color:var(--text3)':''}">${badgeTxt}</div><input type="text" id="${prefix}${i}" value="${values[i-1]||''}" placeholder="${ph}" autocomplete="off" style="flex:1;min-width:0;border:none;background:transparent;font-family:inherit;font-size:.82rem;color:var(--text);outline:none"></div>`;
  }
  return html;
}
function openETeam(key,idx){
  const team=(G.teams[key]||[])[idx];
  if(!team) return;
  const tid0=String(key||'').split('_')[0]||'';
  const isIndividual=(getTournamentTypeById(tid0)==='individual_pair') || (team.tournamentType==='individual_pair') || Array.isArray(team.individualPlayers);
  window.__IND_TEAM_EDIT_VERIFIED = false;

  if(!isIndividual){
    const editAccess=canDeleteRegistration({
      isAdmin:AD,
      isDirector:REG,
      teamClub:baseClub(team.club||''),
      directorClub:baseClub(REG_CLUB||'')
    });
    if(!editAccess.ok){
      toast(AD||REG?'내 클럽 팀만 수정할 수 있습니다':'경기이사 로그인 후 수정할 수 있습니다','error');
      return;
    }
  }else{
    if(!AD && !verifyIndividualEditPin(team,'수정')) return;
    window.__IND_TEAM_EDIT_VERIFIED = true;
  }

  CE_key=key;
  CE_idx=idx;
  const[,div]=key.split('_');
  if(isIndividual){
    const ips=getIndividualPlayers(team);
    ge('mETeamB').innerHTML=`<div style="margin-bottom:12px;padding:8px 14px;background:var(--primary);color:white;border-radius:var(--radius);font-weight:700">개인전 참가 수정 — ${dl(div)}</div>
      <div style="display:grid;grid-template-columns:1fr;gap:10px">
        <div style="padding:10px 12px;background:var(--panel2);border:1px solid var(--border);border-radius:12px">
          <div style="font-size:.82rem;font-weight:800;color:var(--primary-dark);margin-bottom:8px">1번 참가자</div>
          <div class="frow">
            <div class="form-group" style="margin-bottom:8px"><label class="form-label">이름</label><input class="form-input" id="etIp1Name" value="${esc(ips[0]?.name||'')}"></div>
            <div class="form-group" style="margin-bottom:8px"><label class="form-label">클럽명</label><input class="form-input" id="etP1Club" value="${esc(ips[0]?.clubsRaw||'')}"></div>
          </div>
          <div class="frow"><div class="form-group" style="margin-bottom:0"><label class="form-label">전화번호<span class="req">*</span></label><input class="form-input" id="etP1Phone" value="${esc(ips[0]?.phone||'')}"></div><div class="form-group" style="margin-bottom:0"><label class="form-label">구력</label><input class="form-input" id="etP1Career" value="${esc(ips[0]?.career||'')}" placeholder="예: 24.07"></div></div>
          <div style="display:flex;gap:14px;flex-wrap:wrap;padding:8px 10px;background:#fff;border:1px solid var(--border);border-radius:10px;margin-top:8px">
            <label style="display:flex;align-items:center;gap:6px;font-size:.78rem;font-weight:800;color:var(--primary-dark);cursor:pointer"><input type="checkbox" id="etP1ReceiveOrderSms" ${ips[0]?.receiveOrderSms!==false?'checked':''}> 경기 배정/대기 문자 받기</label>
            <label style="display:flex;align-items:center;gap:6px;font-size:.78rem;font-weight:800;color:var(--primary-dark);cursor:pointer"><input type="checkbox" id="etP1ReceiveResultSms" ${ips[0]?.receiveResultSms!==false?'checked':''}> 경기 완료 문자 받기</label>
          </div>
        </div>
        <div style="padding:10px 12px;background:var(--panel2);border:1px solid var(--border);border-radius:12px">
          <div style="font-size:.82rem;font-weight:800;color:var(--primary-dark);margin-bottom:8px">2번 참가자</div>
          <div class="frow">
            <div class="form-group" style="margin-bottom:8px"><label class="form-label">이름</label><input class="form-input" id="etIp2Name" value="${esc(ips[1]?.name||'')}"></div>
            <div class="form-group" style="margin-bottom:8px"><label class="form-label">클럽명</label><input class="form-input" id="etP2Club" value="${esc(ips[1]?.clubsRaw||'')}"></div>
          </div>
          <div class="frow"><div class="form-group" style="margin-bottom:0"><label class="form-label">전화번호<span class="req">*</span></label><input class="form-input" id="etP2Phone" value="${esc(ips[1]?.phone||'')}"></div><div class="form-group" style="margin-bottom:0"><label class="form-label">구력</label><input class="form-input" id="etP2Career" value="${esc(ips[1]?.career||'')}" placeholder="예: 23.06"></div></div>
          <div style="display:flex;gap:14px;flex-wrap:wrap;padding:8px 10px;background:#fff;border:1px solid var(--border);border-radius:10px;margin-top:8px">
            <label style="display:flex;align-items:center;gap:6px;font-size:.78rem;font-weight:800;color:var(--primary-dark);cursor:pointer"><input type="checkbox" id="etP2ReceiveOrderSms" ${ips[1]?.receiveOrderSms!==false?'checked':''}> 경기 배정/대기 문자 받기</label>
            <label style="display:flex;align-items:center;gap:6px;font-size:.78rem;font-weight:800;color:var(--primary-dark);cursor:pointer"><input type="checkbox" id="etP2ReceiveResultSms" ${ips[1]?.receiveResultSms!==false?'checked':''}> 경기 완료 문자 받기</label>
          </div>
        </div>
        <div class="frow">
          <div class="form-group" style="margin-bottom:0"><label class="form-label">비고</label><input class="form-input" id="etPNote" value="${esc(team.note||'')}"></div>
          <div class="form-group" style="margin-bottom:0"><label class="form-label">수정/삭제 비밀번호</label><input class="form-input" id="etEditPin" inputmode="numeric" maxlength="4" value="${esc(team.editPin||'')}"></div>
        </div>
      </div>`;
    om('mETeam');
    return;
  }
  const p=team.players||[];
  const isT=(div==='테린이'||div==='terinee');
  const isW=(div==='여성부');
  const dbl=team.doublesCount||((isT||isW)?(p.length<=6?3:p.length<=8?4:5):5);
  const savedMainCount = Number.isFinite(Number(team.mainPlayerCount)) ? Number(team.mainPlayerCount) : 0;
  const mainCount=savedMainCount>0 ? savedMainCount : (isW?6:dbl*2);
  const totalCount=mainCount+2;
  const terineeSelHtml=isT?`<div style="margin-bottom:8px"><label class="form-label" style="font-size:.8rem">복식 수</label><div style="display:flex;gap:10px;margin-top:4px">${[3,4,5].map(n=>`<label style="font-size:.82rem;cursor:pointer"><input type="radio" name="etDbl" value="${n}" ${n===dbl?'checked':''} onchange="etUpdateSlots(this.value,${idx})"> ${n}복식</label>`).join('')}</div></div>`:'';
  ge('mETeamB').innerHTML=`<div style="margin-bottom:12px;padding:8px 14px;background:var(--primary);color:white;border-radius:var(--radius);font-weight:700">${tdn(team,key,idx)} — ${dl(div)}</div>
    ${terineeSelHtml}
    <div class="form-group"><label class="form-label">클럽</label><select class="form-select" id="etTC">${G.clubs.map(c=>`<option ${c===team.club?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="form-group">
      <label class="form-label" id="editRosterLabel">${isW?'주전 6명 + 후보 최대 2명':isT?`주전 ${mainCount}명 + 후보 최대 2명`:'주전 10명 + 후보 최대 2명'}</label>
      <div id="etSlots">${buildRosterInputsHTML('ep',mainCount+2,p,div,dbl,mainCount)}</div>
      <div style="font-size:.72rem;color:var(--text3);margin-top:6px">페어는 경기 결과 입력 때 선택합니다.</div>
    </div>`;
  om('mETeam');
}
function etUpdateSlots(newDbl,origIdx){
  const team=(G.teams[CE_key]||[])[CE_idx];
  if(!team) return;
  const p=team.players||[];
  const dbl=parseInt(newDbl,10);
  const mainCount=dbl*2;
  const totalCount=mainCount+2;
  const curVals=[];
  for(let i=1;i<=dbl*2+2;i++){
    const el=ge('ep'+i);
    if(el) curVals.push(el.value.trim());
  }
  const[,eDiv]=CE_key.split('_');
  const isEW=(eDiv==='여성부'), isET=(eDiv==='테린이'||eDiv==='terinee');
  ge('etSlots').innerHTML=buildRosterInputsHTML('ep',dbl*2+2,curVals.length?curVals:p,eDiv,dbl,dbl*2);
  const lbl=ge('editRosterLabel');
  if(lbl) lbl.textContent=isEW?'주전 6명 + 후보 최대 2명':isET?`주전 ${dbl*2}명 + 후보 최대 2명`:'주전 10명 + 후보 최대 2명';
}
async function saveETeam(){
  const teams = G.teams[CE_key] || [];
  const team = teams[CE_idx];
  if(!team) return;

  const tid0 = String(CE_key||'').split('_')[0] || '';
  const isIndividual = getTournamentTypeById(tid0)==='individual_pair' || team.tournamentType==='individual_pair' || Array.isArray(team.individualPlayers);

  if(isIndividual){
    if(!AD && !window.__IND_TEAM_EDIT_VERIFIED){
      if(!verifyIndividualEditPin(team,'수정')) return;
    }
    const p1Name=(ge('etIp1Name')?.value||'').trim();
    const p1Club=(ge('etP1Club')?.value||'').trim();
    const p1Phone=formatPhoneLoose(ge('etP1Phone')?.value||'');
    const p1Career=normalizeCareerValue(ge('etP1Career')?.value||'');
    const p2Name=(ge('etIp2Name')?.value||'').trim();
    const p2Club=(ge('etP2Club')?.value||'').trim();
    const p2Phone=formatPhoneLoose(ge('etP2Phone')?.value||'');
    const p2Career=normalizeCareerValue(ge('etP2Career')?.value||'');
    const note=(ge('etPNote')?.value||'').trim();
    const editPin=String(ge('etEditPin')?.value||'').replace(/\D/g,'').slice(0,4);

    const p1ReceiveOrderSms=!!ge('etP1ReceiveOrderSms')?.checked;
    const p1ReceiveResultSms=!!ge('etP1ReceiveResultSms')?.checked;
    const p2ReceiveOrderSms=!!ge('etP2ReceiveOrderSms')?.checked;
    const p2ReceiveResultSms=!!ge('etP2ReceiveResultSms')?.checked;
    if(!p1Name || !p1Club || !p2Name || !p2Club){
      toast('이름, 클럽명을 모두 입력해 주세요','error');
      return;
    }
    if(!p1Phone || !p2Phone){
      toast('개인전은 참가자 2명의 휴대폰 번호를 모두 입력해야 합니다','error');
      return;
    }
    if((p1Phone && p1Phone.replace(/[^0-9]/g,'').length<9) || (p2Phone && p2Phone.replace(/[^0-9]/g,'').length<9)){
      toast('전화번호를 확인해 주세요','error');
      return;
    }
    if(!(p1ReceiveOrderSms || p1ReceiveResultSms || p2ReceiveOrderSms || p2ReceiveResultSms)){
      toast('최소 1명은 문자 수신 대상으로 선택해 주세요','error');
      return;
    }
    if(editPin.length!==4){
      toast('수정/삭제 비밀번호 4자리를 입력해 주세요','error');
      return;
    }
    if(new Set([p1Name,p2Name]).size!==2){
      toast('참가자 이름이 서로 같을 수 없습니다','error');
      return;
    }

    const individualPlayers=[
      {name:p1Name, clubsRaw:p1Club, clubs:parseClubAliases(p1Club), phone:p1Phone, career:p1Career, receiveSms:(p1ReceiveOrderSms||p1ReceiveResultSms), receiveOrderSms:p1ReceiveOrderSms, receiveResultSms:p1ReceiveResultSms},
      {name:p2Name, clubsRaw:p2Club, clubs:parseClubAliases(p2Club), phone:p2Phone, career:p2Career, receiveSms:(p2ReceiveOrderSms||p2ReceiveResultSms), receiveOrderSms:p2ReceiveOrderSms, receiveResultSms:p2ReceiveResultSms}
    ];
    const backupTeam = JSON.parse(JSON.stringify(team));
    const individualEditPayload=buildIndividualEditPayload({
      club:(p1Club||p2Club||''),
      players:[p1Name,p2Name],
      individualPlayers,
      editPin,
      note,
      pairLabel:getIndividualDisplayLine({individualPlayers}),
      entryLabel:getIndividualDisplayLine({individualPlayers}),
      extra:{
        clubTokens:[...new Set(individualPlayers.flatMap(p=>p.clubs||[]))]
      }
    });
    Object.assign(team,individualEditPayload);

    sl(true);
    try{
      await stT(CE_key);
    }catch(e){
      teams[CE_idx] = backupTeam;
      sl(false);
      toast('저장 실패: '+e.message,'error');
      return;
    }

    try{ await persistIndividualPlayerMeta(individualPlayers); }catch(e){}
    sl(false);
    window.__IND_TEAM_EDIT_VERIFIED = false;
    cm('mETeam');
    try{ renderRL(); }catch(e){ console.warn('saveETeam renderRL failed', e); }
    toast('수정 완료 ✅','success');
    return;
  }

  const saveEditAccess=canDeleteRegistration({
    isAdmin:AD,
    isDirector:REG,
    teamClub:baseClub(team.club||''),
    directorClub:baseClub(REG_CLUB||'')
  });
  if(!saveEditAccess.ok){
    toast(AD||REG?'내 클럽 팀만 수정할 수 있습니다':'경기이사 로그인 후 수정할 수 있습니다','error');
    return;
  }
  if(!AD && isRegDeadlinePassed()){
    toast(`등록 기한이 만료되어 수정할 수 없습니다.\n${regDeadlineLabel()}`,'error');
    return;
  }

  const [,div] = CE_key.split('_');
  const dblEl = document.querySelector('input[name="etDbl"]:checked');
  const dbl = dblEl ? parseInt(dblEl.value,10) : (team.doublesCount || 5);
  const isEW=(div==='여성부'), isET=(div==='테린이'||div==='terinee');
  const mainCount = isEW ? 6 : dbl * 2;
  const totalSlots=mainCount+2;
  const np = [];
  for(let i=1;i<=totalSlots;i++){
    const el = ge('ep'+i);
    if(el){
      const v = el.value.trim();
      if(v) np.push(v);
    }
  }

  const editCheck=validateTeamEdit({
    players:np,
    maxPlayers:totalSlots
  });
  if(!editCheck.ok){
    toast(editCheck.error,'error');
    return;
  }

  const newClub = ge('etTC').value;
  const tid = CE_key.split('_')[0];
  const tournament = G.tournaments.find(t=>t.id===tid);

  const missing2026 = missingMembers2026(np, newClub, tournament);
  if(missing2026.length){
    showMissingMembers2026(missing2026);
    return;
  }

  const oldPlayers = [...(team.players || [])];
  const oldClub = team.club || '';
  const removed = oldPlayers.filter(n => !np.includes(n));
  const added = np.filter(n => !oldPlayers.includes(n));

  const backupTeam = JSON.parse(JSON.stringify(team));
  Object.assign(team,buildTeamEditPayload({
    club:newClub,
    players:np,
    doublesCount:dbl,
    mainPlayerCount:mainCount
  }));

  sl(true);
  try{
    await stT(CE_key);
  }catch(e){
    teams[CE_idx] = backupTeam;
    sl(false);
    toast('저장 실패: '+e.message,'error');
    return;
  }

  const postErrors = [];

  if(removed.length){
    try{
      await _removePlayerHistory(removed, oldClub, tid, div);
    }catch(e){
      postErrors.push('삭제선수 기록정리');
      console.warn('saveETeam remove history failed', e);
    }
  }

  if(added.length){
    try{
      await Promise.all(added.map(n => regP(n, newClub, tid, div)));
    }catch(e){
      postErrors.push('추가선수 기록동기화');
      console.warn('saveETeam regP failed', e);
    }
  }

  sl(false);
  cm('mETeam');
  try{ renderRL(); }catch(e){ console.warn('saveETeam renderRL failed', e); }
  try{ renderAllP(); }catch(e){ console.warn('saveETeam renderAllP failed', e); }

  if(postErrors.length){
    toast('수정 완료 ✅','success'); console.warn('부가저장 실패:', postErrors.join(', '));
  }else{
    toast('수정 완료 ✅','success');
  }
}


let BR_MULTI_DIVS = ['__ALL__'];
function getBracketSelectedDivs(tid){
  const t = G.tournaments.find(x=>x.id===tid);
  const allDivs = t?.divisions || [];
  const cur = Array.isArray(BR_MULTI_DIVS) ? BR_MULTI_DIVS.slice() : ['__ALL__'];
  if(cur.includes('__ALL__') || !cur.length) return allDivs.slice();
  return cur.filter(d=>allDivs.includes(d));
}
function setBracketSelectedDivs(divs, tid){
  const t = G.tournaments.find(x=>x.id===tid);
  const allDivs = t?.divisions || [];
  let next = Array.isArray(divs) ? divs.filter(d=>allDivs.includes(d)) : [];
  if(!next.length || next.length===allDivs.length) next=['__ALL__'];
  BR_MULTI_DIVS = next;
  const ds = ge('brDS');
  if(ds) ds.value = (BR_MULTI_DIVS[0]||'__ALL__');
  renderBracketDivisionChips(tid);
}
function toggleBracketDivision(div){
  const tid = ge('brTS')?.value;
  if(!tid) return;
  const t = G.tournaments.find(x=>x.id===tid);
  const allDivs = t?.divisions || [];
  if(div==='__ALL__'){
    setBracketSelectedDivs(['__ALL__'], tid);
    renderBracket();
    return;
  }
  let cur = BR_MULTI_DIVS.includes('__ALL__') ? [] : BR_MULTI_DIVS.slice();
  if(cur.includes(div)) cur = cur.filter(x=>x!==div);
  else cur.push(div);
  if(!cur.length || cur.length===allDivs.length) cur=['__ALL__'];
  setBracketSelectedDivs(cur, tid);
  renderBracket();
}
function renderBracketDivisionChips(tid){
  const box = ge('brMultiDiv');
  if(!box) return;
  const t = G.tournaments.find(x=>x.id===tid);
  if(!t){ box.innerHTML=''; return; }
  const allDivs = t.divisions || [];
  const active = Array.isArray(BR_MULTI_DIVS) ? BR_MULTI_DIVS : ['__ALL__'];
  const mk = (val, label, activeOn) => `<button type="button" onclick="toggleBracketDivision('${val.replace("'","\'")}')" style="padding:7px 14px;border-radius:999px;border:1.5px solid ${activeOn?'#0f1e3a':'var(--border)'};background:${activeOn?'#0f1e3a':'white'};color:${activeOn?'white':'var(--text2)'};font-size:.82rem;font-weight:${activeOn?'800':'600'};cursor:pointer">${label}</button>`;
  box.innerHTML = [mk('__ALL__','전체', active.includes('__ALL__'))].concat(allDivs.map(d=>mk(d, dl(d), active.includes('__ALL__')?false:active.includes(d)))).join('');
}

function initBracketNotice(){
  const el = ge('brNotice');
  if(!el) return;
  if(!localStorage.getItem('br_notice_seen')){
    localStorage.setItem('br_notice_seen','1');
    setTimeout(()=>{
      el.style.background='transparent';
      el.style.border='none';
      el.style.color='#666';
      el.style.fontWeight='600';
      el.style.padding='2px 0';
    },3500);
  }else{
    el.style.background='transparent';
    el.style.border='none';
    el.style.color='#666';
    el.style.fontWeight='600';
    el.style.padding='2px 0';
  }
}

function onBrTC(){
  const tid=ge('brTS').value, ds=ge('brDS');
  try{ syncTournamentDataForPage('bracket', tid || getRealtimeTargetTournamentId() || null, false).catch(e=>console.warn('bracket sync failed', e)); }catch(e){}
  if(!tid){
    if(ds) ds.innerHTML='<option value="__ALL__">전체</option>';
    BR_MULTI_DIVS=['__ALL__'];
    renderBracketDivisionChips('');
    ge('bracketContent').innerHTML='<div class="empty-state card"><div class="empty-icon">🎲</div><p>대회를 선택하세요</p></div>';
    return;
  }
  const t=G.tournaments.find(t=>t.id===tid);
  if(ds) ds.innerHTML='<option value="__ALL__">전체</option>'+t.divisions.map(d=>`<option value="${d}">${dl(d)}</option>`).join('');
  setBracketSelectedDivs(BR_MULTI_DIVS, tid);
  renderBracket();
  initBracketNotice();
}

function renderBracket(){
  const tid=ge('brTS').value;
  const selectedDivs=getBracketSelectedDivs(tid);
  const currentTournament=G.tournaments.find(t=>t.id===tid);
  const isAll = !tid ? true : (BR_MULTI_DIVS.includes('__ALL__') || selectedDivs.length === (currentTournament?.divisions||[]).length);
  const div=isAll?'__ALL__':(selectedDivs[0]||'__ALL__');
  const targetDivs = isAll ? (currentTournament?.divisions||[]) : selectedDivs;
  const cont=ge('bracketContent');

  updateFilterBtnUI('bracket', MY_CLUB_FILTER);
  let _bBanner=ge('bracketFilterBanner');
  if(!_bBanner){
    _bBanner=document.createElement('div');
    _bBanner.id='bracketFilterBanner';
    const _bp=ge('page-bracket');
    if(_bp) _bp.insertBefore(_bBanner,_bp.firstChild);
  }
  const _personalBanner = renderPersonalMatchBanner(tid, targetDivs);

  if(MY_CLUB_FILTER&&REG_CLUB){
    const _mbc=baseClub(REG_CLUB);
    const _atid=ge('brTS').value;
    const _at=G.tournaments.find(t=>t.id===_atid);
    let _myMatchCards='';
    if(_at){
      const _targetDivs = isAll ? (_at.divisions||[]) : selectedDivs;
      _targetDivs.forEach(_div=>{
        const _key=_atid+'_'+_div;
        const _tms=G.teams[_key]||[];
        const _allMs=G.matches[_key]||[];
        const _myMs=_allMs.filter(_m=>{
          const _t1=_tms[_m.t1]??_tms.find(t=>t.id===_m.t1);
          const _t2=_tms[_m.t2]??_tms.find(t=>t.id===_m.t2);
          return !_m.bye&&((_t1&&baseClub(_t1.club||'')===_mbc)||(_t2&&baseClub(_t2.club||'')===_mbc));
        });
        if(_myMs.length){
          _myMatchCards+=`<div class="my-match-section-label" style="margin:10px 0 6px">${dl(_div)}</div>`;
          _myMs.forEach(_m=>{
            const _t1=_tms[_m.t1]??_tms.find(t=>t.id===_m.t1);
            const _t2=_tms[_m.t2]??_tms.find(t=>t.id===_m.t2);
            const _n1=tdn(_t1,_key,_m.t1)||'?'; const _n2=tdn(_t2,_key,_m.t2)||'?';
            const _grpCourts=(G.draws[_key]?.groups?.[Number(_m.group)]?.courts)||[];
            const _matchCourts=Array.isArray(_m.courts)&&_m.courts.length?_m.courts:(_m.court?[_m.court]:_grpCourts);
            const _courts=_matchCourts.length?` 🎾${_matchCourts.join('/')}`:'';
            const _st=getMatchResultState(_key,_m);
            const _done=_st.done;
            const _winNm=_done?(baseClub((_tms[_st.winner]??_tms.find(t=>t.id===_st.winner))?.club||'')===_mbc?'🏆 승':'😢 패'):(_st.started?`⏳ 진행중 ${_st.disp1??_st.sc1}:${_st.disp2??_st.sc2}`:'⏳ 대기');
            const _orderSummary=getMyClubOrderStatusSummaryHTML(_key,_m,_mbc);
            const _draftBadge=getMyClubOrderDraftBadgeHTML(_key,_m,_mbc);
            _myMatchCards+=`<div style="background:white;border:1.5px solid #16a34a;border-radius:10px;padding:8px 12px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;cursor:pointer" onclick="goBracketMatch('${_atid}','${_div}','${_m.id}')">
              <div style="flex:1;min-width:220px">
                <div class="my-match-card-title">${_n1} <span style="color:var(--text3);font-weight:700">vs</span> ${_n2}</div>
                ${_orderSummary}
                ${_draftBadge}
              </div>
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
                ${_courts?`<span style="font-size:.78rem;color:var(--primary)">${_courts}</span>`:''}
                <span style="font-size:.78rem;font-weight:700;color:${_done?('#16a34a'):'#e67e22'}">${_winNm}</span>
                <button class="my-match-toggle-btn" onclick="event.stopPropagation();openMyMatchOrderFromCard('${_atid}','${_div}','${_m.id}')" style="border:1px solid #ea580c;border-radius:999px;background:white;color:#c2410c;cursor:pointer">📝 오더쓰기</button>
                <button class="my-match-toggle-btn" onclick="event.stopPropagation();submitSavedOrderFromCard('${_atid}','${_div}','${_m.id}')" style="border:1px solid #2563eb;border-radius:999px;background:#eff6ff;color:#1d4ed8;cursor:pointer">📤 오더 제출</button>
              </div>
            </div>`;
          });
        }
      });
    }
    _bBanner.innerHTML=`<div style="padding:10px 12px;background:#dcfce7;border:1.5px solid #16a34a;border-radius:10px;margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:${_myMatchCards?'8px':'0'}">
        <span class="my-match-panel-title">🏆 ${REG_CLUB} 내 경기 모아보기</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          <button class="my-match-toggle-btn" onclick="event.stopPropagation();openMyClubQuickOrder()" style="border:1px solid #ea580c;border-radius:999px;background:white;color:#c2410c;cursor:pointer">📝 바로 오더쓰기</button>
          <button class="my-match-toggle-btn" onclick="event.stopPropagation();toggleMyClubFilter('bracket')" style="border:1px solid #16a34a;border-radius:999px;background:white;color:#166534;cursor:pointer">전체 보기</button>
        </div>
      </div>
      ${_myMatchCards||'<div style="font-size:.9rem;color:#166534;font-weight:700">등록된 경기가 없습니다</div>'}
    </div>`;
  } else {
    _bBanner.innerHTML=_personalBanner||'';
  }

  if(!tid){
    cont.innerHTML='<div class="empty-state card"><div class="empty-icon">🎲</div><p>대회를 선택하세요</p></div>';
    return;
  }

  const t=currentTournament;
  if(!t){
    cont.innerHTML='<div class="empty-state card"><div class="empty-icon">🎲</div><p>대회 정보를 찾을 수 없습니다</p></div>';
    return;
  }

  targetDivs.forEach(d=>{ ensureAutoTeamMainBracketIfReady(tid,d).then(changed=>{ if(changed) try{ renderBracket(); }catch(e){}; }).catch(()=>{}); });
  const parts = targetDivs.map(d=>renderBracketHTMLForDiv(tid,d,isAll)).filter(Boolean);
  cont.innerHTML = parts.length ? parts.join('<div style="height:14px"></div>') : '<div class="empty-state card"><div class="empty-icon">🎲</div><p>표시할 부서가 없습니다</p></div>';
  const _eb=ge('bracketExportBar');
  if(_eb) _eb.style.display = parts.length ? 'flex' : 'none';
  requestAnimationFrame(()=>{
    updateOperationSticky();
    autoFocusMainBracketTrees();
    // [BUG FIX] 코트 현황판 경과시간 실시간 갱신 타이머 시작
    if(typeof startCourtBoardClock==='function') startCourtBoardClock();
  });
}

function getBracketDisplayTeams(key, teams){
  return (teams||[]).map((tm,i)=>({name:tdn(tm,key,i), club:tm.club||'', idx:i}));
}
function buildBracketRegisteredTeamBadges(tid,div,key,teams){
  const list=getBracketDisplayTeams(key,teams);
  if(!list.length) return '<div style="font-size:.78rem;color:var(--text3)">등록된 팀이 없습니다.</div>';
  return `<div style="display:flex;flex-wrap:wrap;gap:6px">${list.map(tm=>`<span class="badge bg-green" style="font-size:.78rem;padding:5px 10px">${tm.name}</span>`).join('')}</div>`;
}
function buildBracketAdminSettingsCard(tid,div,cfg,teams){
  if(!AD) return '';
  const teamCount=(teams||[]).length;
  const presets=calcGroupPresets(teamCount);
  const selectedPreset=(presets.find(p=>p.sizes[0]===Number(cfg.grpSize||4))||presets[0]);
  const gsOpts=(presets.length?presets:[{sizes:[Math.max(2,Math.min(teamCount||2,4))],label:'기본'}]).map(p=>{
    const val=p.sizes.join(',');
    const selected=((selectedPreset?.sizes||[]).join(',')===val)?'selected':'';
    return `<option value="${val}" ${selected}>${p.label}</option>`;
  }).join('');
  const advLimit=Math.max(1, Math.min(...((selectedPreset?.sizes)||[Math.max(2,Number(cfg.grpSize||4))])));
  const advOpts=Array.from({length:Math.max(1,Math.min(4,advLimit))},(_,i)=>i+1).map(a=>`<option value="${a}" ${Number(cfg.advance||2)===a?'selected':''}>${a}팀</option>`).join('');
  return `<div style="margin-top:12px;padding:12px 14px;background:var(--panel2);border-radius:14px;border:1px solid var(--border)">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      <div style="font-weight:800;color:var(--primary-dark)">🛠 대진표 설정</div>
      <div style="font-size:.72rem;color:var(--text3)">관리자 로그인 시 여기서 바로 변경</div>
    </div>
    <div class="frow3" style="grid-template-columns:1.2fr 1fr 1fr">
      <div class="form-group" style="margin-bottom:0"><label class="form-label">경기 방식</label>
        <select class="form-select" id="bsFmt_${tid}_${div}">
          <option value="group_knockout" ${cfg.format==='group_knockout'?'selected':''}>예선조별+본선</option>
          <option value="roundrobin" ${cfg.format==='roundrobin'?'selected':''}>풀 리그전</option>
          <option value="knockout" ${cfg.format==='knockout'?'selected':''}>토너먼트 단판</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom:0"><label class="form-label">조당 팀수</label>
        <select class="form-select" id="bsGs_${tid}_${div}">${gsOpts}</select>
      </div>
      <div class="form-group" style="margin-bottom:0"><label class="form-label">본선 진출수</label>
        <select class="form-select" id="bsAdv_${tid}_${div}">${advOpts}</select>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;flex-wrap:wrap">
      <button class="btn btn-outline" style="font-size:.78rem;padding:5px 10px" onclick="applyBracketRecommend('${tid}','${div}')">추천</button>
      <button class="btn btn-accent" style="font-size:.78rem;padding:5px 10px" onclick="saveBracketDivisionSettings('${tid}','${div}')">저장</button>
    </div>
  </div>`;
}
function buildBracketPreviewFromConfig(cfg, teams, draw){
  // group_knockout이 아니어도 draw.groups가 있으면(=개인전 추첨 완료 전) 미리보기 가능
  const hasDrawGroups = draw && Array.isArray(draw.groups) && draw.groups.length > 0;
  const isGK = cfg.format==='group_knockout' || hasDrawGroups;
  if(!isGK || !(teams||[]).length) return '';
  const n=(teams||[]).length;
  const grpSize=Math.max(2, Number(cfg.grpSize||4));
  const groups=Math.ceil(n/grpSize);
  if(groups<1) return '';
  const fakeDraw= hasDrawGroups ? draw : {groups:Array.from({length:groups},()=>({})), advance:Number(cfg.advance||2)};
  const pv=buildPreviewMainSlots(fakeDraw,cfg);
  if(pv.n<2) return '';
  return `<div class="card" style="background:linear-gradient(135deg,#fffdf5,#eef5ff);border:1.5px dashed var(--accent);margin-top:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      <div style="font-weight:800;color:var(--primary-dark)">🌳 추첨 전 본선 대진표 예시</div>
      <span class="badge" style="background:var(--accent);color:#fff;font-size:.72rem">예상 ${fakeDraw.groups.length}조 / 조당 ${grpSize}팀 / ${Number(fakeDraw.advance||cfg.advance||2)}팀 진출</span>
    </div>
    <div style="font-size:.76rem;color:var(--text2);margin-bottom:10px">관리자가 저장한 설정 기준의 본선 구조 예시입니다. 예선 종료 후 실제 팀이 추첨으로 배정됩니다.</div>
    ${renderMainPreviewHTML(pv.matchSlots,pv.n,true)}
  </div>`;
}
async function saveBracketDivisionSettings(tid,div){
  const t=G.tournaments.find(x=>x.id===tid);
  if(!t) return;
  const fmt=ge(`bsFmt_${tid}_${div}`)?.value||'group_knockout';
  const gsRaw=ge(`bsGs_${tid}_${div}`)?.value||'4';
  const gsParts=gsRaw.split(',').map(v=>parseInt(v,10)).filter(Boolean);
  const grpSize=gsParts[0]||4;
  const adv=parseInt(ge(`bsAdv_${tid}_${div}`)?.value||'2',10);
  const ds={...(t.divSettings||{})};
  const prev=gDS(t,div);
  ds[div]={...prev, format:fmt, grpSize, advance:adv};
  sl(true);
  try{
    await updateDoc(doc(db,'tournaments',tid),{divSettings:ds});
    const idx=G.tournaments.findIndex(x=>x.id===tid);
    if(idx>=0) G.tournaments[idx].divSettings=ds;
    sl(false);
    toast(`${dl(div)} 설정 저장 완료`,'success');
    renderBracket();
  }catch(e){ sl(false); toast('설정 저장 실패: '+e.message,'error'); }
}
function applyBracketRecommend(tid,div){
  const cnt=(G.teams[tid+'_'+div]||[]).length;
  const rec=recTemplate(cnt);
  const f=ge(`bsFmt_${tid}_${div}`), g=ge(`bsGs_${tid}_${div}`), a=ge(`bsAdv_${tid}_${div}`);
  if(f) f.value=rec.fmt;
  if(g){
    const found=[...g.options].find(o=>o.value.split(',')[0]===String(rec.gs));
    if(found) g.value=found.value;
  }
  if(a){
    const found=[...a.options].find(o=>o.value===String(rec.adv));
    if(found) a.value=found.value;
  }
  toast(`${dl(div)} 추천 적용`, 'success');
}
function buildFreshGroupMatchesFromDraw(key){
  const draw=G.draws[key];
  const groups=Array.isArray(draw?.groups)?draw.groups:[];
  const fresh=[];
  groups.forEach((grp,gi)=>{
    const teamIdxs=Array.isArray(grp?.teams)?grp.teams:[];
    for(let a=0;a<teamIdxs.length;a++){
      for(let b=a+1;b<teamIdxs.length;b++){
        fresh.push({
          id:`g_${gi}_${a}_${b}`,
          phase:'group',
          group:gi,
          t1:teamIdxs[a],
          t2:teamIdxs[b],
          winner:null,
          rubbers:[],
          court:''
        });
      }
    }
  });
  return fresh;
}



function getPreservedSeedDrawState(key){
  const draw = G.draws?.[key] || {};
  const preserved = {};
  if(typeof draw.mainSeedRaw === 'string') preserved.mainSeedRaw = draw.mainSeedRaw;
  if(draw.mainSeedMap && typeof draw.mainSeedMap === 'object'){
    preserved.mainSeedMap = JSON.parse(JSON.stringify(draw.mainSeedMap));
  }
  return preserved;
}


async function resetPrelimDrawOnly(key){
  const {tid,div}=_k2td(key);
  if(!confirm(`예선 리셋을 진행합니다.

- 예선 대진표/예선 경기/예선 결과/오더를 모두 초기화
- 본선 대진표/본선 경기/본선 결과도 함께 제거
- 팀 등록은 유지
- 관리자 저장 시드는 유지

추첨 전 상태로 완전히 되돌릴까요?`)) return;
  sl(true);
  try{
    const preservedSeedDraw = getPreservedSeedDrawState(key);
    await resetMatchRecords(key);
    G.matches[key]=[];
    await stM(key);
    if(G.mainMatches && G.mainMatches[key]) delete G.mainMatches[key];
    try{
      if(window.BRACKET_PRELIM_TOGGLE && Object.prototype.hasOwnProperty.call(window.BRACKET_PRELIM_TOGGLE,key)){
        delete window.BRACKET_PRELIM_TOGGLE[key];
      }
      if(window.BRACKET_MAIN_TOGGLE && Object.prototype.hasOwnProperty.call(window.BRACKET_MAIN_TOGGLE,key)){
        delete window.BRACKET_MAIN_TOGGLE[key];
      }
    }catch(_e){}
    if(Object.keys(preservedSeedDraw).length){
      G.draws[key]=preservedSeedDraw;
      await stD(key);
    }else{
      try{ await deleteDoc(doc(db,'draws',key)); }catch(_e){}
      delete G.draws[key];
    }
    await fbLog(`예선 리셋: ${tid} ${dl(div)} (예선/본선 대진 전체 초기화, 시드 유지)`,'♻️');
    sl(false);
    toast('예선 리셋 완료 ✅ 예선·본선 대진은 초기화되고 관리자 시드는 유지됩니다','success');
    renderBracket();
  }catch(e){ sl(false); toast('예선 리셋 실패: '+e.message,'error'); }
}

async function resetMainDrawOnly(key){
  const {tid,div}=_k2td(key);
  const draw=G.draws[key];
  if(!(draw && Array.isArray(draw.groups) && draw.groups.length)){
    toast('예선 추첨이 없습니다. 먼저 예선 추첨을 진행하세요','info');
    return;
  }
  if(!confirm(`본선 리셋을 진행합니다.

- 예선 대진표/예선 결과는 유지
- 본선 대진표/진출전/본선 경기/본선 결과만 제거
- 본선은 추첨 전 상태로 돌아갑니다
- 관리자 저장 시드는 유지

계속할까요?`)) return;
  sl(true);
  try{
    await resetMatchRecords(key);
    const preservedSeedDraw=getPreservedSeedDrawState(key);
    const preservedDraw={...draw, ...preservedSeedDraw};
    delete preservedDraw.mainPlan;
    delete preservedDraw.mainAudit;
    delete preservedDraw.mainUpdatedAt;
    G.draws[key]=preservedDraw;
    G.matches[key]=(G.matches[key]||[]).filter(m=>m.phase==='group');
    await stM(key);
    await stD(key);
    try{
      if(window.BRACKET_MAIN_TOGGLE && Object.prototype.hasOwnProperty.call(window.BRACKET_MAIN_TOGGLE,key)){
        delete window.BRACKET_MAIN_TOGGLE[key];
      }
    }catch(_e){}
    await fbLog(`본선 리셋: ${tid} ${dl(div)} (예선 유지 / 본선 초기화, 시드 유지)`,'♻️');
    sl(false);
    toast('본선 리셋 완료 ✅ 예선은 유지되고 관리자 시드는 그대로 유지됩니다','success');
    renderBracket();
  }catch(e){ sl(false); toast('본선 리셋 실패: '+e.message,'error'); }
}

async function resetDrawOnly(key){
  const {tid,div}=_k2td(key);
  if(!confirm(`전체 리셋을 진행합니다.

- 예선 대진표/예선 경기/예선 결과/오더 삭제
- 본선 대진표/본선 경기/본선 결과 삭제
- 팀 등록은 유지
- 관리자 저장 시드는 유지

예선 추첨 전 상태로 완전히 되돌릴까요?`)) return;
  sl(true);
  try{
    const preservedSeedDraw = getPreservedSeedDrawState(key);
    await resetMatchRecords(key);
    G.matches[key]=[];
    await stM(key);
    if(G.mainMatches && G.mainMatches[key]) delete G.mainMatches[key];
    try{
      if(window.BRACKET_PRELIM_TOGGLE && Object.prototype.hasOwnProperty.call(window.BRACKET_PRELIM_TOGGLE,key)){
        delete window.BRACKET_PRELIM_TOGGLE[key];
      }
      if(window.BRACKET_MAIN_TOGGLE && Object.prototype.hasOwnProperty.call(window.BRACKET_MAIN_TOGGLE,key)){
        delete window.BRACKET_MAIN_TOGGLE[key];
      }
    }catch(_e){}
    if(Object.keys(preservedSeedDraw).length){
      G.draws[key]=preservedSeedDraw;
      await stD(key);
    }else{
      try{ await deleteDoc(doc(db,'draws',key)); }catch(_e){}
      delete G.draws[key];
    }
    await fbLog(`전체 리셋: ${tid} ${dl(div)} (예선/본선 대진 전체 초기화, 시드 유지)`,'♻️');
    sl(false);
    toast('전체 리셋 완료 ✅ 예선·본선 대진은 초기화되고 관리자 시드는 유지됩니다','success');
    renderBracket();
  }catch(e){ sl(false); toast('전체 리셋 실패: '+e.message,'error'); }
}

function getGroupOrderPairKey(key, gi, m){
  if(!m || m.phase!=='group') return '';
  const grp = G.draws[key]?.groups?.[Number(gi)];
  const gTeams = Array.isArray(grp?.teams) ? grp.teams : [];
  if(!gTeams.length) return '';
  const a = gTeams.indexOf(m.t1);
  const b = gTeams.indexOf(m.t2);
  if(a < 0 || b < 0) return '';
  return [a,b].sort((x,y)=>x-y).join('-');
}
function getGroupDisplayPriority(key, gi, m){
  const grp = G.draws[key]?.groups?.[Number(gi)];
  const gTeams = Array.isArray(grp?.teams) ? grp.teams : [];
  const size = gTeams.length;
  const pk = getGroupOrderPairKey(key, gi, m);
  if(!pk) return Number(m.slot || 999);

  // 2팀 1조: 단 1경기이므로 항상 0번
  if(size === 2) return 0;

  if(size === 4){
    const map = {'0-1':0,'2-3':1,'0-2':2,'1-3':3,'0-3':4,'1-2':5};
    return map[pk] ?? Number(m.slot || 999);
  }
  if(size === 3){
    if(pk === '0-1') return 0;
    const groupMatches = (G.matches[key] || []).filter(x => x.phase==='group' && Number(x.group)===Number(gi));
    const firstMatch = groupMatches.find(x => getGroupOrderPairKey(key, gi, x) === '0-1');
    if(firstMatch && firstMatch.winner != null){
      const waiting = gTeams[2];
      const winnerPair = [firstMatch.winner, waiting].sort((a,b)=>String(a).localeCompare(String(b))).join('|');
      const thisPair = [m.t1, m.t2].sort((a,b)=>String(a).localeCompare(String(b))).join('|');
      return thisPair === winnerPair ? 1 : 2;
    }
    if(pk === '0-2') return 1;
    if(pk === '1-2') return 2;
  }
  return Number(m.slot || 999);
}
function sortGroupMatchesForDisplay(key, gi, list){
  return [...(list||[])].sort((a,b)=>{
    const ap = getGroupDisplayPriority(key, gi, a);
    const bp = getGroupDisplayPriority(key, gi, b);
    if(ap !== bp) return ap - bp;
    return String(a.id||'').localeCompare(String(b.id||''),'ko');
  });
}

function renderMatchProgressSummary(key){
  const list=G.matches[key]||[];
  const [tid,div]=key.split('_');
  const teams=G.teams[key]||[];
  const isIndividualMode=isIndividualByKey(key);
  const useOrder=!!G.meta.onlineOrderEnabled && !isIndividualMode;
  const estimatedMainTotal = estimateMainBracketMatchCount(key);
  if(isIndividualMode) return '';
  if(!list.length && !estimatedMainTotal) return '';

  const isDone=m=>!!getMatchResultState(key,m).done;
  const isPlaying=m=>!isDone(m)&&!m.bye&&(m.rubbers||[]).some(rb=>rb&&((rb.players1&&rb.players1.length)||(rb.players2&&rb.players2.length)||(rb.score1!=null)||(rb.score2!=null)));
  let orderTotal=0,orderSubmitted=0;
  const groups = {};
  const main = { total:0, done:0, playing:0, matches:[] };

  function matchName(idx,m){
    const t=teams[idx];
    return t ? tdn(t,key,idx) : '?';
  }
  function mainMatchRoundLabel(m){
    if(m.phase!=='main') return '';
    const mainList=(main.matches||[]).length ? main.matches : list.filter(x=>x.phase==='main');
    if(!mainList.length) return '';
    const totalRounds=Math.max(...mainList.map(x=>Number(x.round||0)))+1;
    const round=Number(m.round||0);
    if(round===totalRounds-1) return '결승';
    if(round===totalRounds-2 && totalRounds>1) return '준결승';
    return `${Math.pow(2, totalRounds-round)}강`;
  }
  function resultLine(m){
  const st=getMatchResultState(key,m);
  if(!st.done || m.bye) return '';
  const n1=matchName(m.t1,m), n2=matchName(m.t2,m);
  const s1=Number((st.disp1??st.sc1)||0), s2=Number((st.disp2??st.sc2)||0);
  const leftWin = s1 > s2;
  const rightWin = s2 > s1;
  const roundLabel = m.phase==='main' ? mainMatchRoundLabel(m) : '예선';
  const roundTheme = getRoundVisualTheme(roundLabel, m.phase||'');
  const roundChip = `<span class="ms-round-chip" style="background:${roundTheme.chipBg};color:${roundTheme.chipFg};border:1px solid ${roundTheme.bd}">${m.phase==='main'?'🏆':'🎾'} ${roundLabel}</span>`;

  return `<div class="main-status-row" onclick="goBracketMatch('${tid}','${div}','${m.id||m._id||''}')" style="cursor:pointer;padding:7px 10px;border-radius:10px;background:${roundTheme.softBg};border:1.5px solid ${roundTheme.bd};display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    ${roundChip}
    <span class="ms-chip" style="font-size:.78rem;font-weight:900;color:#166534;background:#dcfce7;border:1px solid #86efac;border-radius:999px;padding:3px 9px">결과</span>
    <span class="ms-name" style="font-size:.9rem;font-weight:${leftWin?900:500};color:${leftWin?'var(--text)':'var(--text2)'}">${n1}</span>
    <span class="ms-score" style="font-size:.92rem;font-weight:900;color:#1d4ed8">${st.disp1??st.sc1}:${st.disp2??st.sc2}</span>
    <span style="font-size:.86rem;color:var(--text2)">vs <span class="ms-name" style="font-weight:${rightWin?900:500};color:${rightWin?'var(--text)':'var(--text2)'}">${n2}</span></span>
    <span class="ms-move" style="margin-left:auto;font-size:.78rem;color:var(--text3);white-space:nowrap">👆 경기로 이동</span>
  </div>`;
  }
  function buildOrderChips(matchList){
    if(!useOrder||!matchList.length) return '';
    return matchList.map(m=>{
      const st=getOnlineOrderState(key,m);
      const n1=matchName(m.t1,m), n2=matchName(m.t2,m);
      const mid=m.id||m._id||'';
      const chip=(name,done)=>`<span class="ms-chip" style="display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:6px;font-size:.78rem;font-weight:900;background:${done?'#dcfce7':'#fee2e2'};color:${done?'#166534':'#991b1b'};border:1px solid ${done?'#86efac':'#fca5a5'}">${name} ${done?'✅':'⏳'}</span>`;
      const label = st.bothSubmitted?'🔓 양팀완료':(!st.s1&&!st.s2?'⏳ 미제출':'📝 제출중');
      const roundLabel = m.phase==='main' ? mainMatchRoundLabel(m) : '예선';
      const roundTheme = getRoundVisualTheme(roundLabel, m.phase||'');
      const roundChip = `<span class="ms-round-chip" style="background:${roundTheme.chipBg};color:${roundTheme.chipFg};border:1px solid ${roundTheme.bd}">${m.phase==='main'?'🏆':'🎾'} ${roundLabel}</span>`;
      return `<div class="main-status-row" onclick="goBracketMatch('${tid}','${div}','${mid}')" style="cursor:pointer;padding:9px 11px;border-radius:12px;background:${st.bothSubmitted?roundTheme.softBg:'#fffbeb'};border:1.5px solid ${st.bothSubmitted?roundTheme.bd:'#fde68a'};display:flex;align-items:center;gap:8px;flex-wrap:wrap;transition:box-shadow .15s" onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,.12)'" onmouseout="this.style.boxShadow='none'">
        ${roundChip}
        <span style="font-size:.84rem;font-weight:800;color:var(--text2);white-space:nowrap">${label}</span>
        <div style="display:flex;gap:5px;flex-wrap:wrap">${chip(n1,st.s1)}${chip(n2,st.s2)}</div>
        <span class="ms-move" style="margin-left:auto;font-size:.78rem;color:var(--text3);white-space:nowrap">👆 경기로 이동</span>
      </div>`;
    }).join('');
  }
  function standingsHtml(gi, grpMatches){
    const grp = G.draws[key]?.groups?.[Number(gi)];
    const tids = Array.isArray(grp?.teams) ? grp.teams : [];
    if(!tids.length) return '';
    const stats = calcGS(key, Number(gi), tids, teams);
    if(!stats.length) return '';
    return `<div style="margin-top:8px;border-top:1px dashed var(--border);padding-top:8px">
      <div style="font-size:.74rem;font-weight:800;color:#334155;margin-bottom:5px">🏅 순위</div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${stats.map((s,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:${i===0?'#eff6ff':i===1?'#fff7ed':'#f8fafc'};border:1px solid ${i===0?'#bfdbfe':i===1?'#fed7aa':'#e5e7eb'};border-radius:8px">
          <span style="min-width:22px;font-weight:900;color:${i===0?'#1d4ed8':i===1?'#c2410c':'#475569'}">${i+1}</span>
          <span style="flex:1;font-size:.78rem;font-weight:800;color:var(--text)">${s.nm}</span>
          <span style="font-size:.72rem;color:var(--text2)">${s.w}승 ${s.l}패</span>
          <span style="font-size:.72rem;color:${s.diff>0?'#1565c0':s.diff<0?'#c62828':'var(--text2)'}">득실 ${s.diff>0?'+':''}${s.diff}</span>
        </div>`).join('')}
      </div>
    </div>`;
  }

  list.forEach(m=>{
    if(!m.bye){
      const st=getOnlineOrderState(key,m);
      orderTotal+=2;
      if(st.s1) orderSubmitted++;
      if(st.s2) orderSubmitted++;
    }
    if(m.phase === 'group' && m.group != null){
      const gi = Number(m.group);
      if(!groups[gi]) groups[gi] = { total:0, done:0, playing:0, matches:[] };
      groups[gi].total++;
      groups[gi].matches.push(m);
      if(isDone(m)) groups[gi].done++;
      else if(isPlaying(m)) groups[gi].playing++;
    }else if(m.phase === 'main'){
      main.total++;
      main.matches.push(m);
      if(isDone(m)) main.done++;
      else if(isPlaying(m)) main.playing++;
    }
  });

  if(main.total===0 && estimatedMainTotal>0){
    main.total = estimatedMainTotal;
  }

  const groupTotal = Object.values(groups).reduce((s,v)=>s+v.total,0);
  const groupDone = Object.values(groups).reduce((s,v)=>s+v.done,0);
  const groupPlaying = Object.values(groups).reduce((s,v)=>s+v.playing,0);
  const mainRemain = Math.max(0, main.total-main.done);
  const remainAll = Math.max(0, (groupTotal+main.total) - (groupDone+main.done));
  const playingAll = groupPlaying + main.playing;
  const estimatedMainSize = estimateMainBracketSize(key);
  const mainRoundLabel = (()=>{
    const mainList = main.matches||[];
    if(!mainList.length) return estimatedMainSize>=2 ? `${estimatedMainSize}강` : '';
    const active = mainList.filter(m=>!isDone(m));
    const target = active.length ? active : mainList;
    const round = Math.min(...target.map(m=>Number(m.round||0)));
    const totalRounds = Math.max(...mainList.map(m=>Number(m.round||0))) + 1;
    if(round===totalRounds-1) return isDone(target[0]) ? '결승 종료' : '결승';
    if(round===totalRounds-2 && totalRounds>2) return '준결승';
    return `${Math.pow(2, totalRounds-round)}강`;
  })();

  const groupHtml = Object.keys(groups).map(Number).sort((a,b)=>a-b).map(gi=>{
    const s = groups[gi];
    const remain = Math.max(0, s.total - s.done);
    const liveCls = s.playing > 0 ? ' live-card' : '';
    const pendingInGrp = useOrder ? s.matches.filter(m=>!m.bye&&!isDone(m)) : [];
    const doneInGrp = s.matches.filter(m=>isDone(m) && !m.bye);
    const groupTheme = getRoundVisualTheme('예선', 'group');
    return `<div class="card${liveCls}" style="padding:10px 12px;background:${groupTheme.softBg};border:1.5px solid ${groupTheme.bd};margin:0">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div style="font-weight:900;color:${groupTheme.fg}"><span class="main-status-round" style="background:${groupTheme.chipBg};color:${groupTheme.chipFg};border:1px solid ${groupTheme.bd};margin-right:6px">🎾 예선</span>${grpLabel(gi)} 현황</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          <span class="badge" style="background:#dbeafe;color:#1d4ed8">전체 ${s.total}</span>
          <span class="badge" style="background:#ecfccb;color:#3f6212">완료 ${s.done}</span>
          ${s.playing > 0 ? `<span class="badge live-blink" style="background:#fff3cd;color:#9a6400;border:1px solid #f5a623">진행 ${s.playing}</span>` : ''}
          <span class="badge" style="background:#f3f4f6;color:#374151">잔여 ${remain}</span>
        </div>
      </div>
      ${standingsHtml(gi, s.matches)}
      ${useOrder&&pendingInGrp.length?`<div style="margin-top:8px;font-size:.74rem;font-weight:700;color:${pendingInGrp.every(m=>getOnlineOrderState(key,m).bothSubmitted)?'#166534':'#92400e'};margin-bottom:4px">📋 오더 제출 현황</div><div style="display:flex;flex-direction:column;gap:4px">${buildOrderChips(pendingInGrp)}</div>`:''}
      ${doneInGrp.length?`<div style="margin-top:8px;font-size:.74rem;font-weight:700;color:#1e3a8a;margin-bottom:4px">🏁 경기 결과</div><div style="display:flex;flex-direction:column;gap:4px">${doneInGrp.map(resultLine).join('')}</div>`:''}
    </div>`;
  }).join('');

  const sortMainStatusMatches = (arr=[]) => [...arr].sort((a,b)=>{
    const ra = Number(a?.round ?? 999);
    const rb = Number(b?.round ?? 999);
    if(ra !== rb) return ra - rb; // 8강 → 준결승 → 결승
    return Number(a?.slot ?? 0) - Number(b?.slot ?? 0);
  });
  const mainPending = useOrder ? sortMainStatusMatches(main.matches.filter(m=>!m.bye&&!isDone(m))) : [];
  const doneInMain = sortMainStatusMatches(main.matches.filter(m=>isDone(m) && !m.bye));
  const mainTheme = getRoundVisualTheme(mainRoundLabel||'본선', 'main');
  const mainHtml = main.total ? `<div class="card main-status-card${main.playing>0?' live-card':''}" style="padding:12px 14px;background:${mainTheme.softBg};border:1.5px solid ${mainTheme.bd};margin:0">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div class="main-status-title" style="font-weight:900;color:${mainTheme.fg}">본선 현황 ${mainRoundLabel?`<span class="main-status-round" style="background:${mainTheme.chipBg};color:${mainTheme.chipFg};border:1px solid ${mainTheme.bd}">${mainRoundLabel}</span>`:''}</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          <span class="badge" style="background:#ede9fe;color:#6d28d9">전체 ${main.total}</span>
          <span class="badge" style="background:#ecfccb;color:#3f6212">완료 ${main.done}</span>
          ${main.playing > 0 ? `<span class="badge live-blink" style="background:#fff3cd;color:#9a6400;border:1px solid #f5a623">진행 ${main.playing}</span>` : ''}
          <span class="badge" style="background:#f3f4f6;color:#374151">잔여 ${mainRemain}</span>
          ${main.matches.length===0&&estimatedMainTotal>0?`<span class="badge" style="background:#eef2ff;color:#4338ca">예상 경기수 반영</span>`:''}
        </div>
      </div>
      ${useOrder&&mainPending.length?`<div class="main-status-section-title" style="margin-top:8px;font-size:.84rem;font-weight:800;color:${mainPending.every(m=>getOnlineOrderState(key,m).bothSubmitted)?'#166534':'#92400e'};margin-bottom:6px">📋 오더 제출 현황</div><div style="display:flex;flex-direction:column;gap:6px">${buildOrderChips(mainPending)}</div>`:''}
      ${doneInMain.length?`<div class="main-status-section-title" style="margin-top:10px;font-size:.84rem;font-weight:800;color:#1e3a8a;margin-bottom:6px">🏁 경기 결과</div><div style="display:flex;flex-direction:column;gap:6px">${doneInMain.map(resultLine).join('')}</div>`:''}
      ${main.matches.length===0&&estimatedMainTotal>0?`<div style="margin-top:8px;font-size:.82rem;color:var(--text2);line-height:1.65">예선 조 추첨 기준으로 본선 예상 경기수를 미리 포함했습니다. 본선 추첨 전이라 결과는 아직 없습니다.</div>`:''}
    </div>` : '';

  const orderBadgeHtml = useOrder && orderTotal>0 ? `
    <span class="badge" style="background:${orderSubmitted===orderTotal?'#dcfce7':'#fef3c7'};color:${orderSubmitted===orderTotal?'#166534':'#92400e'};border:1px solid ${orderSubmitted===orderTotal?'#86efac':'#fde68a'}">📋 오더 ${orderSubmitted}/${orderTotal} 제출</span>` : '';

  return `<div class="card main-status-board" style="margin-top:12px;background:linear-gradient(135deg,#f9fbff,#eef4ff);border:1.5px solid #d7e3ff">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <div class="main-status-top-title" style="font-weight:900;color:var(--primary-dark);font-size:.98rem">📊 경기 진행 현황</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="badge" style="background:#dbeafe;color:#1d4ed8">전체 ${groupTotal+main.total}경기</span>
        <span class="badge" style="background:${getRoundVisualTheme('예선','group').chipBg};color:${getRoundVisualTheme('예선','group').chipFg};border:1px solid ${getRoundVisualTheme('예선','group').bd}">예선 ${groupTotal}경기</span>
        <span class="badge" style="background:${getRoundVisualTheme(mainRoundLabel||'본선','main').chipBg};color:${getRoundVisualTheme(mainRoundLabel||'본선','main').chipFg};border:1px solid ${getRoundVisualTheme(mainRoundLabel||'본선','main').bd}">본선 ${main.total}경기</span>
        <span class="badge ${playingAll>0?'live-blink':''}" style="background:#fff7e8;color:#9a6400">진행중 ${playingAll}경기</span>
        <span class="badge" style="background:#f3f4f6;color:#374151">잔여 ${remainAll}경기</span>
        ${orderBadgeHtml}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px">
      ${groupHtml}
      ${mainHtml}
    </div>
  </div>`;
}


function _prelimToggleId(key){
  return 'prelimSection_'+String(key||'').replace(/[^a-zA-Z0-9_-]/g,'_');
}
function _mainToggleId(key){
  return 'mainSection_'+String(key||'').replace(/[^a-zA-Z0-9_-]/g,'_');
}
function getPrelimCollapsedState(key, hasMain, mainFinished){
  window.BRACKET_PRELIM_TOGGLE = window.BRACKET_PRELIM_TOGGLE || {};
  if(Object.prototype.hasOwnProperty.call(window.BRACKET_PRELIM_TOGGLE, key)){
    return !!window.BRACKET_PRELIM_TOGGLE[key];
  }
  // ★ 본선이 있으면 기본적으로 접힘 (예선 완료 여부 무관)
  // ★ 본선이 없어도 예선이 전부 완료됐으면 접힘
  if(hasMain) return true;
  // 예선 전 경기 완료 여부 확인
  try{
    const gMs=(G.matches[key]||[]).filter(m=>m && String(m.phase||'')==='group');
    const allDone = gMs.length>0 && gMs.every(m=>getMatchResultState(key,m).done);
    if(allDone) return true;
  }catch(e){}
  return false;
}
function getMainCollapsedState(key){
  window.BRACKET_MAIN_TOGGLE = window.BRACKET_MAIN_TOGGLE || {};
  if(Object.prototype.hasOwnProperty.call(window.BRACKET_MAIN_TOGGLE, key)){
    return !!window.BRACKET_MAIN_TOGGLE[key];
  }
  return false;
}
function hasMainBracketForKey(key){
  try{
    const draw = G.draws?.[key] || {};
    const drawHasMain = Array.isArray(draw.mainBracket) ? draw.mainBracket.length > 0 : !!draw.mainBracket;
    const matchHasMain = (G.matches?.[key] || []).some(m => String(m?.phase||'') === 'main' || String(m?.phase||'') === 'bronze' || String(m?.phase||'') === 'playin');
    return !!(drawHasMain || matchHasMain);
  }catch(e){
    return false;
  }
}
function togglePrelimSection(key){
  window.BRACKET_PRELIM_TOGGLE = window.BRACKET_PRELIM_TOGGLE || {};
  const hasMainBracket = hasMainBracketForKey(key);
  const defaultCollapsed = !!hasMainBracket;
  const current = Object.prototype.hasOwnProperty.call(window.BRACKET_PRELIM_TOGGLE, key)
    ? !!window.BRACKET_PRELIM_TOGGLE[key]
    : defaultCollapsed;
  window.BRACKET_PRELIM_TOGGLE[key] = !current;
  renderBracket();
}
function toggleMainSection(key){
  window.BRACKET_MAIN_TOGGLE = window.BRACKET_MAIN_TOGGLE || {};
  const current = !!window.BRACKET_MAIN_TOGGLE[key];
  window.BRACKET_MAIN_TOGGLE[key] = !current;
  renderBracket();
}
window.MAIN_STATUS_ROUND_TOGGLE = window.MAIN_STATUS_ROUND_TOGGLE || {};
window.MAIN_STATUS_DONE_MATCH_TOGGLE = window.MAIN_STATUS_DONE_MATCH_TOGGLE || {};
function isMainStatusRoundCollapsed(key, round, autoCollapsed){
  const map = window.MAIN_STATUS_ROUND_TOGGLE || {};
  const rk = `${key}__${round}`;
  return Object.prototype.hasOwnProperty.call(map, rk) ? !!map[rk] : !!autoCollapsed;
}
function toggleMainStatusRound(key, round){
  window.MAIN_STATUS_ROUND_TOGGLE = window.MAIN_STATUS_ROUND_TOGGLE || {};
  const rk = `${key}__${round}`;
  const current = !!window.MAIN_STATUS_ROUND_TOGGLE[rk];
  window.MAIN_STATUS_ROUND_TOGGLE[rk] = !current;
  renderBracket();
}
function isMainStatusDoneMatchCollapsed(key, round, autoCollapsed){
  const map = window.MAIN_STATUS_DONE_MATCH_TOGGLE || {};
  const rk = `${key}__${round}`;
  return Object.prototype.hasOwnProperty.call(map, rk) ? !!map[rk] : !!autoCollapsed;
}
function toggleMainStatusDoneMatches(key, round){
  window.MAIN_STATUS_DONE_MATCH_TOGGLE = window.MAIN_STATUS_DONE_MATCH_TOGGLE || {};
  const rk = `${key}__${round}`;
  const current = !!window.MAIN_STATUS_DONE_MATCH_TOGGLE[rk];
  window.MAIN_STATUS_DONE_MATCH_TOGGLE[rk] = !current;
  renderBracket();
}
window.togglePrelimSection = togglePrelimSection;
window.toggleMainSection = toggleMainSection;
window.toggleMainStatusRound = toggleMainStatusRound;
window.toggleMainStatusDoneMatches = toggleMainStatusDoneMatches;


function isIndividualAutoCourtAssignEnabled(){
  return !!G?.meta?.individualAutoCourtAssignEnabled;
}
function getIndividualAutoCourtPool(key){
  const base=[...new Set(getBracketAllowedCourts(key).map(String).filter(Boolean))];
  const grpCourts=[...new Set((((G.draws[key]?.groups)||[]).flatMap(g=>Array.isArray(g?.courts)?g.courts:[]).filter(Boolean).map(String)))];
  // 본선 자동 배정은 예선에서 실제 사용된 코트 수가 아니라, 이 부서에 허용된 전체 운영 코트를 기준으로 돌아야 한다.
  // 그렇지 않으면 예선에서 7개 코트만 썼을 때 본선도 7개만 돌고 8번 코트가 비는 문제가 생긴다.
  if(base.length) return base;
  if(grpCourts.length) return grpCourts;
  return getTournamentCourtList(_k2td(key).tid, true);
}
function findGroupMatchByTeams(key, gi, ta, tb){
  return (G.matches[key]||[]).find(m=>m && m.phase==='group' && Number(m.group)===Number(gi) && ((m.t1===ta && m.t2===tb) || (m.t1===tb && m.t2===ta)));
}
function getIndividualGroupAutoQueue(key, gi){
  const grp=G.draws[key]?.groups?.[Number(gi)];
  if(!grp || !Array.isArray(grp.teams)) return [];
  const teams=grp.teams.slice();
  if(teams.length<2) return [];
  if(teams.length===2){
    const m=findGroupMatchByTeams(key, gi, teams[0], teams[1]);
    return (m && m.winner==null) ? [{match:m, autoLabel:'1번 vs 2번'}] : [];
  }

  // 3팀조 예선 순서는 고정:
  // 1) 1번 vs 2번
  // 2) (1vs2) 승자 vs 3번
  // 3) (1vs2) 패자 vs 3번
  // 단, 운영자는 대기열에서 전체 경기 수를 미리 알아야 하므로
  // 첫 경기 결과 전에도 2·3번째 경기를 placeholder 라벨과 함께 보여준다.
  const [a,b,c]=teams;
  const m12=findGroupMatchByTeams(key, gi, a, b);
  const m13=findGroupMatchByTeams(key, gi, a, c);
  const m23=findGroupMatchByTeams(key, gi, b, c);
  const queue=[];
  if(m12 && m12.winner==null) queue.push({match:m12, autoLabel:'1번 vs 2번'});

  if(m12 && m12.winner!=null){
    const winner=m12.winner;
    const loser=(winner===a)?b:a;
    const winnerVs3=(winner===a)?m13:m23;
    const loserVs3=(loser===a)?m13:m23;
    if(winnerVs3 && winnerVs3.winner==null) queue.push({match:winnerVs3, autoLabel:'1,2번 승자 vs 3번'});
    if(loserVs3 && loserVs3.winner==null) queue.push({match:loserVs3, autoLabel:'1,2번 패자 vs 3번'});
    return queue;
  }

  if(m12 && m12.winner==null){
    if(m13 && m13.winner==null) queue.push({match:m13, autoLabel:'1,2번 승자 vs 3번'});
    if(m23 && m23.winner==null) queue.push({match:m23, autoLabel:'1,2번 패자 vs 3번'});
  }
  return queue;
}
function getBalancedMainFirstRoundOrder(count){
  const n=Math.max(0, Number(count||0));
  if(n<=1) return n===1 ? [0] : [];
  // 브래킷을 4분면 교차 방식으로 배정한다.
  // 전체 경기를 상위절반(upper)과 하위절반(lower)으로 나눈 뒤,
  // 각 절반 내에서 끝↔중간 교차(balanced) 순서를 만들고
  // upper[0],lower[0],upper[1],lower[1],... 로 교차한다.
  //
  // 예) 32경기(0~31):
  //   upper(0~15)의 balanced: 0,15,1,14,2,13,...
  //   lower(16~31)의 balanced: 16,31,17,30,18,29,...
  //   결과: 0,16,15,31,1,17,14,30,2,18,13,29,...
  //
  // 쌍 배정 시: (0,16)→코트1, (15,31)→코트2, (1,17)→코트3, (14,30)→코트4 ...
  //   → 각 코트에 상위절반+하위절반이 항상 한 쌍으로 배정된다.
  //   → 브래킷 위쪽+아래쪽이 균등하게 각 코트에서 진행된다.
  const half=Math.floor(n/2);
  const upperCount=n-half; // 홀수면 upper에 1개 더
  const lowerCount=half;
  // upper 인덱스(0~upperCount-1) balanced 순서
  const upperIdxOrder=[];
  {let l=0,r=upperCount-1; while(l<=r){upperIdxOrder.push(l);if(r!==l)upperIdxOrder.push(r);l++;r--;}}
  // lower 인덱스(0~lowerCount-1) balanced 순서
  const lowerIdxOrder=[];
  {let l=0,r=lowerCount-1; while(l<=r){lowerIdxOrder.push(l);if(r!==l)lowerIdxOrder.push(r);l++;r--;}}
  // 교차 병합: upper[0], lower[0], upper[1], lower[1], ...
  const out=[];
  const maxLen=Math.max(upperIdxOrder.length, lowerIdxOrder.length);
  for(let i=0;i<maxLen;i++){
    if(i<upperIdxOrder.length) out.push(upperIdxOrder[i]);
    if(i<lowerIdxOrder.length) out.push(upperCount+lowerIdxOrder[i]);
  }
  return out;
}
function getIndividualMainAutoQueue(key){
  const list=(G.matches[key]||[]).filter(m=>m && m.winner==null && !m.bye && (m.phase==='playin' || m.phase==='main') && m.t1!=null && m.t2!=null);
  const mainOnly=list.filter(m=>String(m.phase||'')==='main');

  // ── 균형 정렬 rank 맵 구축 ──
  // 핵심: getBalancedMainFirstRoundOrder(count)는 0~count-1 인덱스 기준이므로
  // "남은 경기들의 실제 slot 번호"와 직접 비교하면 안 된다.
  // 올바른 방법:
  //   1) 라운드별 남은 경기를 slot 오름차순 정렬 → slotsSorted
  //   2) slotsSorted의 인덱스(0~count-1) 기준으로 balanced_order 적용
  //   3) rankMap = 실제 slot번호 → 배정 우선순위(rank)
  // 이렇게 하면 bye/완료 경기로 slot이 띄엄띄엄 있어도 정확히 동작한다.
  const rounds=[...new Set(mainOnly.map(m=>Number(m.round||0)))];
  const roundRankMap=new Map(); // round → Map<실제slot, rank>
  rounds.forEach(r=>{
    const matchesInRound=mainOnly.filter(m=>Number(m.round||0)===r);
    // 남은 경기들의 slot을 오름차순 정렬
    const slotsSorted=matchesInRound.map(m=>Number(m.slot||0)).sort((a,b)=>a-b);
    const count=slotsSorted.length;
    if(!count) return;
    // 0~count-1 인덱스 기준 균형 정렬 순서
    const balancedIdxOrder=getBalancedMainFirstRoundOrder(count);
    // balancedIdxOrder[rank] = slotsSorted의 인덱스 → 실제 slot
    const rankMap=new Map();
    balancedIdxOrder.forEach((slotsIdx, rank)=>{
      const actualSlot=slotsSorted[slotsIdx];
      if(actualSlot!=null) rankMap.set(actualSlot, rank);
    });
    roundRankMap.set(r, rankMap);
  });

  const sortStage=(arr)=>arr.slice().sort((a,b)=>{
    // playin 우선
    const pa=String(a.phase||'')==='playin' ? 0 : 1;
    const pb=String(b.phase||'')==='playin' ? 0 : 1;
    if(pa!==pb) return pa-pb;
    // 라운드 오름차순
    const ra=Number(a.round||0), rb=Number(b.round||0);
    if(ra!==rb) return ra-rb;
    // 같은 라운드 내: 실제 남은 경기들의 slot 기준 상단↔하단 교차 균형 정렬
    if(pa===1){
      const rankMap=roundRankMap.get(ra);
      if(rankMap && rankMap.size){
        const ia=rankMap.has(Number(a.slot||0)) ? rankMap.get(Number(a.slot||0)) : 9999;
        const ib=rankMap.has(Number(b.slot||0)) ? rankMap.get(Number(b.slot||0)) : 9999;
        if(ia!==ib) return ia-ib;
      }
    }
    return Number(a.slot||0)-Number(b.slot||0);
  });

  // 본선 코트 자동배정 원칙
  // 1) 상대가 둘 다 확정된 경기만 대상
  // 2) 진출전(playin)을 최우선으로 먼저 배정
  // 3) 모든 라운드에서, 남은 경기들 slot 기준 상단↔하단을 번갈아 분산 배정
  //    예) 남은 경기 slot=[0,1,3,5,7,9,11,15,18,20,25,28,31]
  //    → slot 0, 31, 1, 28, 3, 25, 5, 20, 7, 18, 9, 15, 11 순으로 배정
  //    → bye/완료 경기가 빠져도 항상 브래킷 상단↔하단이 교차된다.
  // 4) 남는 코트가 있으면 다음 라운드에서 상대가 확정된 경기를 이어서 채움
  const readyPlayins=sortStage(list.filter(m=>m.phase==='playin'));
  const readyMains=sortStage(list.filter(m=>m.phase==='main'));
  return [
    ...readyPlayins.map((m,idx)=>({match:m, autoLabel:'', __queueOrder:idx})),
    ...readyMains.map((m,idx)=>({match:m, autoLabel:'', __queueOrder:readyPlayins.length+idx}))
  ];
}
function rebuildIndividualAutoCourtAssignmentsForKey(key){
  if(!isIndividualByKey(key) || !isIndividualAutoCourtAssignEnabled()) return false;
  const list=G.matches[key]||[];
  const scopes=new Set(['group','playin','main']);
  let changed=false;
  const prevState=new Map();
  list.forEach(m=>{
    if(!m || !scopes.has(String(m.phase||'')) || m.winner!=null) return;
    prevState.set(String(m.id), {
      courts: JSON.stringify(Array.isArray(m.courts)?m.courts:(m.court?[m.court]:[])),
      assignedAt: String(m.courtAssignedAt||''),
      queueOrder: String(m.courtQueueOrder||''),
      waitingFirstAt: String(m.waitingFirstAt||''),
      lastWaitingFirstAt: String(m.lastWaitingFirstAt||''),
      autoLabel: String(m.autoCourtLabel||''),
      manualCourtTarget: String(m.manualCourtTarget||''),
      manualCourtPinnedAt: String(m.manualCourtPinnedAt||''),
      manualSharedHold: !!m.manualSharedHold
    });
    m.courts=[]; m.court=''; delete m.courtAssignedAt; delete m.courtQueueOrder; delete m.waitingFirstAt; delete m.lastWaitingFirstAt; delete m.autoCourtLabel;
  });
  const assignedIds=new Set();
  let tick=0;
  const manualPinned = list.filter(m=>m && m.winner==null && scopes.has(String(m.phase||'')) && String(m.manualCourtTarget||'').trim());
  const manualShared = list.filter(m=>m && m.winner==null && scopes.has(String(m.phase||'')) && !!m.manualSharedHold && !String(m.manualCourtTarget||'').trim());
  const manualIds=new Set(manualPinned.map(m=>String(m.id)));
  const manualSharedIds=new Set(manualShared.map(m=>String(m.id)));
  const markShared=(item)=>{
    if(!item || !item.match || item.match.winner!=null || manualIds.has(String(item.match.id))) return;
    const m=item.match;
    const prev=prevState.get(String(m.id)) || {courts:'[]', assignedAt:'', queueOrder:'', waitingFirstAt:'', lastWaitingFirstAt:'', autoLabel:'', manualCourtTarget:'', manualCourtPinnedAt:'', manualSharedHold:false};
    if(prev.courts!=='[]' || prev.assignedAt || prev.autoLabel!==String(item.autoLabel||'')) changed=true;
    m.courts=[]; m.court=''; delete m.courtAssignedAt;
    if(item.autoLabel) m.autoCourtLabel=item.autoLabel; else delete m.autoCourtLabel;
    if(prev.manualCourtTarget && !String(m.manualCourtTarget||'')) delete m.manualCourtPinnedAt;
    if(!manualSharedIds.has(String(m.id))) m.manualSharedHold=false;
  };
  const __courtAssignedCounter={};
  const assign=(court, item, forceManual=false)=>{
    if(!court || !item || !item.match || item.match.winner!=null || (!forceManual && (manualIds.has(String(item.match.id)) || manualSharedIds.has(String(item.match.id))))) return;
    const m=item.match;
    const seqTs=new Date(Date.UTC(2000,0,1,0,0,0,tick++)).toISOString();
    const nextCourts=JSON.stringify([String(court)]);
    const prev=prevState.get(String(m.id)) || {courts:'[]', assignedAt:'', queueOrder:'', waitingFirstAt:'', lastWaitingFirstAt:'', autoLabel:'', manualCourtTarget:'', manualCourtPinnedAt:'', manualSharedHold:false};
    const sameCourt = prev.courts===nextCourts;

    const currentIndex=Number(__courtAssignedCounter[court]||0);
    const isCurrentMatch=currentIndex===0;
    __courtAssignedCounter[court]=currentIndex+1;

    let realAssignedAt=prev.assignedAt || new Date().toISOString();
    let queueOrder=(sameCourt && prev.queueOrder) ? prev.queueOrder : seqTs;

    // 현재 경기
    if(isCurrentMatch){
      // 대기 -> 경기중 승격 시 해당 코트 경기시간만 새로 시작
      if(prev.waitingFirstAt){
        realAssignedAt=new Date().toISOString();
      }else if(!(sameCourt && prev.assignedAt)){
        realAssignedAt=new Date().toISOString();
      }
    }else{
      // 대기 카드는 기존 대기시간 유지
      if(!prev.waitingFirstAt){
        prev.waitingFirstAt=new Date().toISOString();
      }
    }

    if(prev.courts!==nextCourts || prev.assignedAt!==realAssignedAt || prev.queueOrder!==queueOrder || prev.autoLabel!==String(item.autoLabel||'')) changed=true;

    m.courts=[String(court)];
    m.court=String(court);
    m.courtAssignedAt=realAssignedAt;
    m.courtQueueOrder=queueOrder;

    if(item.autoLabel) m.autoCourtLabel=item.autoLabel; else delete m.autoCourtLabel;
    m.manualSharedHold=false;

    if(isCurrentMatch){
      delete m.waitingFirstAt;
    }else{
      m.waitingFirstAt=prev.waitingFirstAt || new Date().toISOString();
    }

    if(prev.lastWaitingFirstAt) m.lastWaitingFirstAt=prev.lastWaitingFirstAt; else delete m.lastWaitingFirstAt;

    assignedIds.add(String(m.id));
  };

  const plan=getIndividualAutoAssignmentPlan(key);
  const fixedItems=(plan.fixed && plan.fixed.__items) ? plan.fixed.__items : {};
  const pool=(plan.pool||[]).filter(Boolean).map(String);
  const manualByCourt={};
  manualPinned.forEach(m=>{
    const court=String(m.manualCourtTarget||'').trim();
    if(!court) return;
    if(!manualByCourt[court]) manualByCourt[court]=[];
    manualByCourt[court].push(m);
  });
  Object.keys(manualByCourt).forEach(court=>{
    manualByCourt[court].sort((a,b)=>String(a.manualCourtPinnedAt||a.courtAssignedAt||'').localeCompare(String(b.manualCourtPinnedAt||b.courtAssignedAt||'')) || String(a.id||'').localeCompare(String(b.id||''),'ko'));
  });

  // 결과 저장 후에는 기존 코트 대기열 순서를 먼저 보존해야 한다.
  // 그렇지 않으면 1번 코트의 다음 대기가 아니라 전역 자동배정 기준(예: 8번조)이 끼어들 수 있다.
  const preservedByCourt={};
  list.forEach(m=>{
    if(!m || m.winner!=null || !scopes.has(String(m.phase||''))) return;
    const mid=String(m.id);
    if(manualIds.has(mid) || manualSharedIds.has(mid)) return;
    const phase=String(m.phase||'');
    const hasStarted = Number(m.sc1||0)!==0 || Number(m.sc2||0)!==0 || (Array.isArray(m.rubbers) && m.rubbers.some(r=>Number(r?.s1||0)!==0 || Number(r?.s2||0)!==0));
    // 예선은 기존 대기열을 유지한다.
    // 본선은 '현재 경기 + 대기 1번'까지만 기존 코트 순서를 보존해야
    // 현재 경기 종료 시 대기 1번이 바로 위로 승격된다.
    // 그 외 본선 후보는 공용대기로 보내고, 준비된 상대가 생기면 다시 채운다.
    // 따라서 phase==='group' 이거나, 현재 코트에 이미 배정돼 있는 미완료 본선은 일단 보존 대상으로 수집한다.
    if(phase!=='group' && !Array.isArray(m.courts) && !String(m.court||'').trim()) return;
    const prev=prevState.get(mid);
    if(!prev) return;
    let prevCourts=[];
    try{ prevCourts=JSON.parse(prev.courts||'[]'); }catch(e){ prevCourts=[]; }
    const court=String((Array.isArray(prevCourts) && prevCourts[0]) || '').trim();
    if(!court) return;
    if(!preservedByCourt[court]) preservedByCourt[court]=[];
    preservedByCourt[court].push({match:m, autoLabel:String(prev.autoLabel||m.autoCourtLabel||'')});
  });
  Object.keys(preservedByCourt).forEach(court=>{
    preservedByCourt[court].sort((a,b)=>{
      const pa=prevState.get(String(a.match?.id)) || {assignedAt:'', autoLabel:''};
      const pb=prevState.get(String(b.match?.id)) || {assignedAt:'', autoLabel:''};
      const qa=String(pa.queueOrder||pa.assignedAt||'');
      const qb=String(pb.queueOrder||pb.assignedAt||'');
      if(qa!==qb) return qa.localeCompare(qb);
      return String(a.match?.id||'').localeCompare(String(b.match?.id||''),'ko');
    });
    preservedByCourt[court] = (preservedByCourt[court]||[]).slice(0,2);
  });

  manualShared.forEach(m=>{
    const prev=prevState.get(String(m.id)) || {courts:'[]', assignedAt:'', queueOrder:'', waitingFirstAt:'', lastWaitingFirstAt:'', autoLabel:'', manualCourtTarget:'', manualCourtPinnedAt:'', manualSharedHold:false};
    if(prev.courts!=='[]' || prev.assignedAt || prev.autoLabel || !prev.manualSharedHold) changed=true;
    m.courts=[]; m.court=''; delete m.courtAssignedAt; delete m.autoCourtLabel;
    if(!m.manualCourtPinnedAt) m.manualCourtPinnedAt=new Date().toISOString();
    m.manualSharedHold=true;
  });

  const extraCourts=[...new Set([...Object.keys(fixedItems), ...Object.keys(manualByCourt), ...Object.keys(preservedByCourt)].map(String).filter(Boolean))];
  const courtNames=[...pool, ...extraCourts.filter(c=>!pool.includes(c))];
  let hasPendingGroups=false;
  const preservedIds=new Set(Object.values(preservedByCourt).flat().map(item=>String(item.match?.id||'')));
  const sharedCarry=[];
  const pushCarryToShared=(court, item)=>{
    if(!item || !item.match || item.match.winner!=null) return;
    sharedCarry.push({
      type:'shared',
      courts:[...pool],
      item:{match:item.match, autoLabel:String(item.autoLabel||item.match.autoCourtLabel||'')},
      __sharedCourtLabel:String(court||'')
    });
  };
  const sharedEntries=getVisibleSharedWaitingOrderForAssign(key)
    .filter(m=>m && m.winner==null)
    .filter(m=>String(m.phase||'')==='group' || !!m.manualSharedHold || !!m.__manualSharedHold || !!m.__autoItem)
    .filter(m=>!(manualIds.has(String(m.id||m._id||'')) || manualSharedIds.has(String(m.id||m._id||'')) || preservedIds.has(String(m.id||m._id||''))))
    .map(m=>({
      type:'shared',
      courts:[...pool],
      item:(m.__autoItem || {match:m, autoLabel:String(m.autoCourtLabel||'')}),
      __sharedCourtLabel:String(m.__sharedCourtLabel||'')
    }));
  const mainQueue=getIndividualMainAutoQueue(key).filter(item=>!(item && item.match && (manualIds.has(String(item.match.id)) || manualSharedIds.has(String(item.match.id)) || preservedIds.has(String(item.match.id)))));

  const deferredManualByCourt={};
  const delayedFillBusyCourts=[];
  const hasGroupItemsInFixed = Object.values(fixedItems).some(arr=>Array.isArray(arr) && arr.some(item=>String(item?.match?.phase||'')==='group'));
  const hasGroupItemsPreserved = Object.values(preservedByCourt).some(arr=>Array.isArray(arr) && arr.some(item=>String(item?.match?.phase||'')==='group'));
  const hasGroupItemsManual = Object.values(manualByCourt).some(arr=>Array.isArray(arr) && arr.some(m=>String(m?.phase||'')==='group'));
  const groupWorkActive = hasGroupItemsInFixed || hasGroupItemsPreserved || hasGroupItemsManual || sharedEntries.length>0;

  const appendNextPendingToCourt=(court, maxFill=1)=>{
    let filled=0;
    while(filled < maxFill){
      // 절대 원칙: 빈 코트가 있으면 대기열을 만들지 말고 먼저 그 코트를 채운다.
      // 따라서 예선 공용대기(sharedEntries)가 남아 있으면 그걸 먼저 올리고,
      // 없으면 본선/진출전(mainQueue)을 바로 올린다.
      if(sharedEntries.length){
        const nextShared=sharedEntries.shift();
        if(!nextShared || !nextShared.item) break;
        hasPendingGroups=true;
        assign(court, nextShared.item);
        filled++;
        continue;
      }
      const nextMain=mainQueue.shift();
      if(!nextMain) break;
      assign(court, nextMain);
      filled++;
    }
    return filled>0;
  };
  courtNames.forEach(court=>{
    const preservedItems=[...(preservedByCourt[court]||[])];
    const items=[...(fixedItems[court]||[])].filter(item=>!(item && item.match && (manualIds.has(String(item.match.id)) || preservedIds.has(String(item.match.id)))));
    const manualItems=(manualByCourt[court]||[]).map(m=>({match:m, autoLabel:String(m.autoCourtLabel||'')}));
    const hasGroupFixedItems = items.some(item=>String(item?.match?.phase||'')==='group');
    const visibleSlotsLeft=hasGroupFixedItems ? Number.POSITIVE_INFINITY : Math.max(0, 2 - preservedItems.length);
    const visibleItems=items.slice(0, visibleSlotsLeft);
    const overflowItems=hasGroupFixedItems ? [] : items.slice(visibleSlotsLeft);
    overflowItems.forEach(item=>pushCarryToShared(court, item));
    const preservedMainCount = preservedItems.filter(item=>String(item?.match?.phase||'')!=='group').length;
    const freshMainCount = visibleItems.filter(item=>String(item?.match?.phase||'')!=='group').length;

    // [BUG FIX] 수동 배정(manualItems)은 슬롯 제한 없이 항상 최우선으로 assign한다.
    // 기존에는 (2 - preservedItems - visibleItems) 슬롯이 남을 때만 assign되어
    // 코트에 이미 2경기가 있으면 수동 배정 카드가 완전히 무시되는 버그가 있었다.
    manualItems.forEach(item=>assign(court,item,true));

    if(preservedItems.length){
      hasPendingGroups = hasPendingGroups || preservedItems.some(item=>String(item?.match?.phase||'')==='group');
      preservedItems.forEach(item=>assign(court,item));
      visibleItems.forEach(item=>assign(court,item));
      const alreadyFilledMain = preservedMainCount + freshMainCount;
      const alreadyFilledGroup = preservedItems.filter(item=>String(item?.match?.phase||'')==='group').length;
      delayedFillBusyCourts.push({
        court,
        maxFill: groupWorkActive ? Math.max(0, 1 - alreadyFilledGroup) : Math.max(0, 1 - alreadyFilledMain),
        hasDelayRisk: preservedItems.some(item=>getElapsedMinutesSince(item?.match?.courtAssignedAt||'')>=30 || getElapsedMinutesSince(item?.match?.waitingFirstAt||'')>=30)
      });
      return;
    }
    if(items.length){
      hasPendingGroups = hasPendingGroups || items.some(item=>String(item?.match?.phase||'')==='group');
      visibleItems.forEach(item=>assign(court,item));
      const alreadyFilledMain = freshMainCount;
      const alreadyFilledGroup = Math.min(1, items.filter(item=>String(item?.match?.phase||'')==='group').length);
      delayedFillBusyCourts.push({
        court,
        maxFill: groupWorkActive ? Math.max(0, 1 - alreadyFilledGroup) : Math.max(0, 1 - alreadyFilledMain),
        hasDelayRisk: preservedItems.some(item=>getElapsedMinutesSince(item?.match?.courtAssignedAt||'')>=30 || getElapsedMinutesSince(item?.match?.waitingFirstAt||'')>=30)
      });
      return;
    }
    // 예선(group) 작업이 남아 있을 때만 빈 코트에 공용대기 1경기를 먼저 올린다.
    const filledFromPending = groupWorkActive ? appendNextPendingToCourt(court, 1) : false;
    if(filledFromPending){
      return; // manualItems는 이미 위에서 assign 완료
    }
    // manualItems는 이미 위에서 assign 완료
  });
  if(sharedCarry.length) sharedEntries.push(...sharedCarry);
  delayedFillBusyCourts.forEach(({court,maxFill})=>{
    appendNextPendingToCourt(court, maxFill);
  });

  // 각 코트의 현재 경기/대기1번 시각을 실제 운영 시간 기준으로 보정
  courtNames.forEach(court=>{
    const queue=(list||[]).filter(m=>m && m.winner==null && (Array.isArray(m.courts)?m.courts:(m.court?[m.court]:[])).includes(court)).sort((a,b)=>{
      const aa=String(a.courtQueueOrder||a.courtAssignedAt||'');
      const bb=String(b.courtQueueOrder||b.courtAssignedAt||'');
      if(aa!==bb) return aa.localeCompare(bb);
      return String(a.id||'').localeCompare(String(b.id||''),'ko');
    });
    if(!queue.length) return;
    const current=queue[0];
    if(current){
      const prevCurrent=prevState.get(String(current.id)) || {waitingFirstAt:'', lastWaitingFirstAt:'', courts:'[]'};
      const currentCourts=JSON.stringify(Array.isArray(current.courts)?current.courts:(current.court?[current.court]:[]));
      if(prevCurrent.waitingFirstAt && prevCurrent.courts===currentCourts){
        current.lastWaitingFirstAt=prevCurrent.waitingFirstAt;
      }else if(prevCurrent.lastWaitingFirstAt && prevCurrent.courts===currentCourts){
        current.lastWaitingFirstAt=prevCurrent.lastWaitingFirstAt;
      }else{
        delete current.lastWaitingFirstAt;
      }
      delete current.waitingFirstAt;
    }
    const firstWaiting=queue[1]||null;
    queue.slice(2).forEach(x=>{ if(x) delete x.waitingFirstAt; });
    if(firstWaiting){
      const prev=prevState.get(String(firstWaiting.id)) || {waitingFirstAt:'', courts:'[]'};
      const currentCourts=JSON.stringify(Array.isArray(firstWaiting.courts)?firstWaiting.courts:(firstWaiting.court?[firstWaiting.court]:[]));
      if(prev.courts===currentCourts && (prev.waitingFirstAt || prev.lastWaitingFirstAt)){
        firstWaiting.waitingFirstAt=prev.waitingFirstAt || prev.lastWaitingFirstAt;
      }else{
        firstWaiting.waitingFirstAt=new Date().toISOString();
        changed=true;
      }
    }
  });
  sharedEntries.forEach(entry=>markShared(entry.item));

  if(!groupWorkActive && mainQueue.length){
    // 본선은 완전 고정형 배정으로 처리한다.
    // 1) 진출전(playin) 우선
    // 2) 본선은 더 큰 라운드(64/32/16...)부터
    // 3) 같은 단계에서는 현재 커서 기준 1→N 순서로 한 바퀴씩만 배정
    // 4) 빈 코트를 먼저 모두 채운 뒤, 2번째 대기, 3번째 대기 순으로 올린다.
    //    -> 앞 코트에만 몰리지 않고, 대기 1번이 경기 종료 후 바로 현재 경기로 올라온다.
    const mainAssignedCounts={};
    courtNames.forEach(court=>{
      mainAssignedCounts[court]=(list||[]).filter(m=>m && m.winner==null && String(m.phase||'')!=='group' && (Array.isArray(m.courts)?m.courts:(m.court?[m.court]:[])).includes(court)).length;
    });
    const mainListAll=(list||[]).filter(m=>m && m.winner==null && String(m.phase||'')==='main');
    const totalMainRounds = mainListAll.length ? (Math.max(...mainListAll.map(m=>Number(m.round||0))) + 1) : 0;
    const stageQueues=[];
    const playinStage=mainQueue.filter(item=>String(item?.match?.phase||'')==='playin');
    if(playinStage.length) stageQueues.push({name:'playin', items:[...playinStage]});
    const mainRounds=[...new Set(mainQueue.filter(item=>String(item?.match?.phase||'')==='main').map(item=>Number(item?.match?.round||0)).filter(Number.isFinite))]
      .sort((a,b)=>{
        const sa = Math.pow(2, Math.max(0, totalMainRounds - a));
        const sb = Math.pow(2, Math.max(0, totalMainRounds - b));
        if(sa!==sb) return sb-sa; // 64강 -> 32강 -> 16강
        return a-b;
      });
    mainRounds.forEach(round=>{
      const stage=mainQueue.filter(item=>String(item?.match?.phase||'')==='main' && Number(item?.match?.round||0)===round);
      if(stage.length) stageQueues.push({name:'main_'+round, items:[...stage]});
    });

    let courtCursor=0;
    const courtCount=Math.max(1, courtNames.length||1);
    const findNextCourtForFill=(fillLevel)=>{
      for(let step=0; step<courtCount; step++){
        const idx=(courtCursor + step) % courtCount;
        const court=String(courtNames[idx]||'');
        if(!court) continue;
        const count=Number(mainAssignedCounts[court]||0);
        if(count===fillLevel && count<2){
          courtCursor=(idx + 1) % courtCount;
          return court;
        }
      }
      return '';
    };

    stageQueues.forEach(stage=>{
      const q=[...(stage.items||[])];
      // ── 쌍 배정(pair assignment) ──
      // 배정 순서가 [slot0, slotN-1, slot1, slotN-2, ...]인 상태에서
      // fillLevel=0→slot0(상단), fillLevel=1→slot1(상단)으로 같은 코트에 배정하면
      // 각 코트가 (상단+상단) 또는 (하단+하단) 으로 편향된다.
      //
      // 올바른 방법: 인접 쌍 [rank0,rank1], [rank2,rank3]... 을 같은 코트에 배정.
      // 즉 (slot0, slotN-1) → 코트1, (slot1, slotN-2) → 코트2 ...
      // 이렇게 하면 각 코트에 항상 (상단,하단) 한 쌍이 들어가고
      // 한 경기가 끝난 뒤에도 반대쪽 트리 경기가 올라와 브래킷 균형이 유지된다.
      courtCursor=0;
      // 2개씩 쌍으로 묶어서 한 코트에 배정
      while(q.length){
        const first=q.shift();
        if(!first) break;
        // 빈 코트 또는 1개 배정된 코트 찾기 (현재경기 슬롯 우선)
        let court='';
        for(let step=0;step<courtCount;step++){
          const idx=(courtCursor+step)%courtCount;
          const c=String(courtNames[idx]||'');
          if(!c) continue;
          const cnt=Number(mainAssignedCounts[c]||0);
          if(cnt===0){
            courtCursor=(idx+1)%courtCount;
            court=c;
            break;
          }
        }
        if(!court){
          // 빈 코트 없음 → 대기1 슬롯 있는 코트
          for(let step=0;step<courtCount;step++){
            const idx=(courtCursor+step)%courtCount;
            const c=String(courtNames[idx]||'');
            if(!c) continue;
            const cnt=Number(mainAssignedCounts[c]||0);
            if(cnt===1){
              courtCursor=(idx+1)%courtCount;
              court=c;
              break;
            }
          }
        }
        if(!court){ q.unshift(first); break; }
        assign(court,first);
        mainAssignedCounts[court]=Number(mainAssignedCounts[court]||0)+1;
        // 쌍의 두 번째 항목을 같은 코트에 배정 (대기1 슬롯)
        if(q.length && Number(mainAssignedCounts[court]||0)<2){
          const second=q.shift();
          if(second){
            assign(court,second);
            mainAssignedCounts[court]=Number(mainAssignedCounts[court]||0)+1;
          }
        }
      }
      q.forEach(item=>markShared(item));
    });
  }
  Object.entries(deferredManualByCourt).forEach(([court, manualItems])=>{
    (manualItems||[]).forEach(item=>assign(court,item,true));
  });
  prevState.forEach((prev, mid)=>{
    if(assignedIds.has(mid)) return;
    const cur=list.find(x=>String(x.id)===String(mid));
    const curCourts=JSON.stringify(Array.isArray(cur?.courts)?cur.courts:(cur?.court?[cur.court]:[]));
    const curAssigned=String(cur?.courtAssignedAt||'');
    const curLabel=String(cur?.autoCourtLabel||'');
    const curManualCourt=String(cur?.manualCourtTarget||'');
    const curManualPinnedAt=String(cur?.manualCourtPinnedAt||'');
    const curManualSharedHold=!!cur?.manualSharedHold;
    if(prev.courts!==curCourts || prev.assignedAt!==curAssigned || prev.autoLabel!==curLabel || prev.manualCourtTarget!==curManualCourt || prev.manualCourtPinnedAt!==curManualPinnedAt || !!prev.manualSharedHold!==curManualSharedHold) changed=true;
  });
  return changed;
}

function scheduleAutoCourtAssignmentSave(key){
  // 2026-04 hotfix: 자동 코트배정은 렌더 중 Firestore write를 발생시키지 않는다.
  // 화면 표시용으로만 재계산하고, 실제 저장은 결과입력/수동저장 등 기존 저장 경로에서만 일어난다.
  return false;
}
function ensureIndividualAutoCourtAssignmentsForKey(key){
  return rebuildIndividualAutoCourtAssignmentsForKey(key);
}
window.toggleIndividualAutoCourtAssign = async function toggleIndividualAutoCourtAssign(){
  if(!AD){ toast('관리자만 변경할 수 있습니다','info'); return; }
  G.meta.individualAutoCourtAssignEnabled = !isIndividualAutoCourtAssignEnabled();
  sl(true);
  try{
    await saveMeta();
    const keys=Object.keys(G.matches||{}).filter(k=>isIndividualByKey(k));
    if(G.meta.individualAutoCourtAssignEnabled){
      keys.forEach(k=>ensureIndividualAutoCourtAssignmentsForKey(k));
    }
    sl(false);
    toast(`개인전 자동 코트배정 ${G.meta.individualAutoCourtAssignEnabled?'사용':'해제'} 완료 ✅`,'success');
    renderBracket();
  }catch(e){
    sl(false);
    toast('저장 실패: '+e.message,'error');
  }
}

function renderBracketHTMLForDiv(tid,div,isAll){
  const key=tid+'_'+div;
  const showPrelimSection = shouldShowPrelimByOperationMode(key);
  const showMainSection = shouldShowMainByOperationMode(key);
  if(isIndividualByKey(key) && isIndividualAutoCourtAssignEnabled()){
    // 공용대기/코트대기 승격은 결과 저장 직후뿐 아니라 화면 렌더 때도 항상 재계산해야
    // 빈 대기칸이 생겼을 때 즉시 공용대기에서 다시 채워진다.
    ensureIndividualAutoCourtAssignmentsForKey(key);
  }
  const teams=G.teams[key]||[];
  const draw=G.draws[key];
  const t=G.tournaments.find(t=>t.id===tid);
  const cfg=gDS(t,div);

  const allMs=G.matches[key]||[];
  const gMs=allMs.filter(m=>m.phase==='group');
  const playInMs=allMs.filter(m=>m.phase==='playin');
  const mMs=allMs.filter(m=>m.phase==='main');
  const gDone=gMs.filter(m=>getMatchResultState(key,m).done).length;
  const estimatedMainTotal = estimateMainBracketMatchCount(key);
  const shownMainTotal = Math.max(mMs.length + playInMs.length, estimatedMainTotal + playInMs.length);
  const shownMainDone = mMs.filter(m=>getMatchResultState(key,m).done||m.bye).length;

  const s1=teams.length>0, s2=!!draw, s3=gMs.length>0&&gDone===gMs.length, s4=shownMainTotal>0&&shownMainDone===shownMainTotal;
  const hasMainBracket = mMs.length>0;
  const prelimCollapsed = getPrelimCollapsedState(key, hasMainBracket, s4);
  const mainCollapsed = getMainCollapsedState(key);
  const prelimToggleId = _prelimToggleId(key);
  const mainToggleId = _mainToggleId(key);
  const teamHeader=buildBracketRegisteredTeamBadges(tid,div,key,teams);
  const latestSavedDraw=(G.drawHistories[key]||[]).filter(it=>!it.deleted).slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0]||null;
  const latestMainSavedDraw=(G.drawHistories[key]||[]).filter(it=>!it.deleted && String(it.mode||'')==='main').slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0]||null;
  // 개인전이라도 draw.groups가 있으면 group_knockout처럼 동작 (기존 개인전 대회 호환)
  const isIndivKey = isIndividualByKey(key);
  const hasGroups = !!(draw && Array.isArray(draw.groups) && draw.groups.length > 0);
  const isGroupKO = cfg.format==='group_knockout' || (isIndivKey && (hasGroups || mMs.length > 0));
  const visibleGroupIndexes = getVisibleGroupIndexesForKey(key);
  const canMainRedraw = isGroupKO && hasGroups;
  const prelimRedrawLabel = draw ? '예선 재추첨' : '예선 추첨';
  const prelimRedrawAction = `openDraw('${tid}','${div}')`;
  const mainRedrawLabel = latestMainSavedDraw || mMs.length ? '본선 재추첨' : '본선 추첨';
  const latestPrelimSavedDraw=(G.drawHistories[key]||[]).filter(it=>!it.deleted && String(it.mode||'')!=='main').slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0]||null;
  const prelimMenuWrapId = `prelimMenuWrap_${key.replace(/[^a-zA-Z0-9_-]/g,'_')}`;
  const mainMenuWrapId = `mainMenuWrap_${key.replace(/[^a-zA-Z0-9_-]/g,'_')}`;
  const topActions=`<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;max-width:100%">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end">
        <div class="login-menu-wrap js-mini-menu" id="${prelimMenuWrapId}">
          <button class="btn btn-outline" style="padding:4px 10px;font-size:.72rem;min-height:34px;white-space:nowrap;font-weight:800" onclick="toggleMiniMenu(event,'${prelimMenuWrapId}')">🎲 예선 추첨 관리</button>
          <div class="login-menu-panel" style="min-width:210px">
            ${canManageBracket()?`<button class="btn-sm login-menu-item" onclick="closeMiniMenu('${prelimMenuWrapId}');${prelimRedrawAction}" style="background:#fff;color:#0f1e3a;border:1px solid rgba(15,30,58,.12)">${draw?'🎲 예선 재추첨':'🎲 예선 추첨 시작'}</button>`:''}
            <button class="btn-sm login-menu-item" onclick="closeMiniMenu('${prelimMenuWrapId}');openLatestSavedDraw('${tid}','${div}','prelim')" style="background:#fff;color:#0f1e3a;border:1px solid rgba(15,30,58,.12);${latestPrelimSavedDraw?'':'opacity:.5;cursor:not-allowed;'}" ${latestPrelimSavedDraw?'':'disabled'}>📋 예선 결과 보기</button>
            <button class="btn-sm login-menu-item" onclick="closeMiniMenu('${prelimMenuWrapId}');openDrawHistory('${tid}','${div}','prelim')" style="background:#fff;color:#0f1e3a;border:1px solid rgba(15,30,58,.12)">🗂 예선 추첨 기록</button>
            ${canManageBracket()?`<button class="btn-sm login-menu-item" onclick="closeMiniMenu('${prelimMenuWrapId}');resetPrelimDrawOnly('${key}')" style="background:#fff;color:#0f1e3a;border:1px solid rgba(15,30,58,.12)">♻️ 예선 초기화</button>`:''}
          </div>
        </div>
        ${isGroupKO ? `<div class="login-menu-wrap js-mini-menu" id="${mainMenuWrapId}">
          <button class="btn btn-outline" style="padding:4px 10px;font-size:.72rem;min-height:34px;white-space:nowrap;font-weight:800;${canMainRedraw?'':'opacity:.5;cursor:not-allowed;'}" onclick="${canMainRedraw?`toggleMiniMenu(event,'${mainMenuWrapId}')`:`toast('예선을 먼저 완료하세요','info')`}">🏆 본선 추첨 관리</button>
          <div class="login-menu-panel" style="min-width:210px">
            ${canManageBracket()?`<button class="btn-sm login-menu-item" onclick="closeMiniMenu('${mainMenuWrapId}');buildMain('${tid}','${div}')" style="background:#fff;color:#0f1e3a;border:1px solid rgba(15,30,58,.12);${canMainRedraw?'':'opacity:.5;cursor:not-allowed;'}" ${canMainRedraw?'':'disabled'}>${latestMainSavedDraw || mMs.length ? '🎲 본선 재추첨' : '🎲 본선 추첨 시작'}</button>`:''}
            <button class="btn-sm login-menu-item" onclick="closeMiniMenu('${mainMenuWrapId}');openLatestSavedDraw('${tid}','${div}','main')" style="background:#fff;color:#0f1e3a;border:1px solid rgba(15,30,58,.12);${latestMainSavedDraw?'':'opacity:.5;cursor:not-allowed;'}" ${latestMainSavedDraw?'':'disabled'}>📋 본선 결과 보기</button>
            <button class="btn-sm login-menu-item" onclick="closeMiniMenu('${mainMenuWrapId}');openDrawHistory('${tid}','${div}','main')" style="background:#fff;color:#0f1e3a;border:1px solid rgba(15,30,58,.12)">🗂 본선 추첨 기록</button>
            ${canManageBracket()?`<button class="btn-sm login-menu-item" onclick="closeMiniMenu('${mainMenuWrapId}');resetMainDrawOnly('${key}')" style="background:#fff;color:#0f1e3a;border:1px solid rgba(15,30,58,.12);${(draw&&Array.isArray(draw.groups)&&draw.groups.length)?'':'opacity:.5;cursor:not-allowed;'}" ${(draw&&Array.isArray(draw.groups)&&draw.groups.length)?'':'disabled'}>♻️ 본선 초기화</button>`:''}
          </div>
        </div>` : ``}
        ${canManageBracket() && isIndivKey?`<button class="btn ${isIndividualAutoCourtAssignEnabled()?'btn-primary':'btn-outline'}" style="padding:4px 10px;font-size:.72rem;min-height:34px;white-space:nowrap;font-weight:800" onclick="toggleIndividualAutoCourtAssign()">🤖 자동코트배정 ${isIndividualAutoCourtAssignEnabled()?'ON':'OFF'}</button>`:''}
        ${canManageBracket()?`<button class="btn btn-outline" style="padding:4px 10px;font-size:.72rem;min-height:34px;white-space:nowrap" onclick="resetDrawOnly('${key}')">🧨 전체 초기화</button>`:''}
      </div>
    </div>`;

  // 개인전은 참가자 목록 기본 접기
  const entryListId = `entryList_${key}`;
  const entryListCollapsed = isIndivKey; // 개인전이면 기본 접힘

  let html=`${renderOperationDivisionBanner(tid,div,key,teams)}<div class="card" style="margin-bottom:12px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px">
      <div>
        <div style="font-weight:700;font-size:.96rem">${t.name} — ${dl(div)}</div>
        <div style="font-size:.72rem;color:var(--text3);margin-top:4px">${isIndivKey?'참가':'등록'} 팀 (${teams.length}${isIndivKey?'조':'팀'})</div>
      </div>
      ${topActions}
    </div>
    ${isIndivKey ? `
    <div style="margin-bottom:12px">
      <button onclick="(function(btn){var el=document.getElementById('${entryListId}');if(!el)return;var hidden=el.style.display==='none';el.style.display=hidden?'':'none';btn.textContent=hidden?'📁 참가자 목록 접기':'📂 참가자 목록 보기 (${teams.length}조)';}).call(this,this)"
        style="width:100%;padding:7px 14px;font-size:.80rem;font-weight:700;border-radius:10px;border:1.5px solid var(--border);background:var(--panel2);color:var(--text2);cursor:pointer;text-align:left;display:flex;align-items:center;gap:6px">
        📂 참가자 목록 보기 (${teams.length}조)
      </button>
      <div id="${entryListId}" style="display:none;padding:10px 12px;background:var(--panel2);border-radius:0 0 14px 14px;border:1px solid var(--border);border-top:none">
        ${teamHeader}
      </div>
    </div>
    ` : `
    <div style="padding:10px 12px;background:var(--panel2);border-radius:14px;border:1px solid var(--border);margin-bottom:12px">
      ${teamHeader}
    </div>
    `}
    <div class="sf-flow" style="margin-top:12px">
      <div class="sf-step"><div class="sf-dot ${s1?'sf-done':'sf-pend'}">${s1?'✓':1}</div><div class="sf-lbl">${isIndivKey?'접수':'팀등록'}<br>${teams.length}${isIndivKey?'조':'팀'}</div></div>
      <div class="sf-step"><div class="sf-dot ${s2?'sf-done':'sf-pend'}">${s2?'✓':2}</div><div class="sf-lbl">추첨<br>${s2?'완료':'대기'}</div></div>
      <div class="sf-step"><div class="sf-dot ${s3?'sf-done':s2?'sf-active':'sf-pend'}">${s3?'✓':3}</div><div class="sf-lbl">예선<br>${gMs.length?gDone+'/'+gMs.length:'미시작'}</div></div>
      ${isGroupKO?`<div class="sf-step" style="cursor:pointer" onclick="jumpToMainBracketSection('${tid}','${div}')"><div class="sf-dot ${s4?'sf-done':s3?'sf-active':'sf-pend'}">${s4?'🏆':4}</div><div class="sf-lbl">본선<br>${shownMainTotal?shownMainDone+'/'+shownMainTotal:'미시작'}</div></div>`:''}
    </div></div>`;

  html += renderMatchProgressSummary(key);
  html += renderOperationViewButtons(key);
  if(isIndivKey && draw?.groups?.length){
    const selectedGroups=getDisplayGroupFilters(key)||[];
    const selectedCourts=getDisplayCourtFilters(key)||[];
    const selectedMainMatches=getSelectedMainMatchFilters(key)||[];
    const summaryText = formatIndivFilterSummary(key);
    html += `<div style="margin:10px 0 12px;padding:12px 14px;border:1px solid #dbe7ff;border-radius:14px;background:linear-gradient(135deg,#fff,#f8fbff)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div>
          <div style="font-size:.92rem;font-weight:900;color:var(--primary-dark)">${getIndivFilterHeading()}</div>
          <div style="font-size:.76rem;color:var(--text2);margin-top:4px">현재: <b style="color:var(--primary-dark)">${summaryText}</b></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline" style="padding:7px 12px;font-size:.8rem;white-space:nowrap" onclick="openIndivFilterPicker('${key}')">⚙️ 선택하기</button>
          <button class="btn ${(!selectedGroups.length && !selectedCourts.length && !selectedMainMatches.length)?'btn-primary':'btn-outline'}" style="padding:7px 12px;font-size:.8rem;white-space:nowrap" onclick="clearIndivOperatorFilters('${key}')">전체 보기</button>
        </div>
      </div>
    </div>`;
  }
  html += renderCourtStatusBoard(key, div, visibleGroupIndexes);

  // 예선 접기 버튼: 본선 여부와 무관하게 항상 표시 (개인전/단체전 공통)
  if(showPrelimSection){
    const prelimBtnLabel = prelimCollapsed ? '📂 예선내용 펼치기' : '📁 예선내용 접기';
    html += `<div class="prelim-sticky-toggle-wrap"><button class="prelim-sticky-toggle-btn" onclick="togglePrelimSection('${key}')">${prelimBtnLabel}</button></div>`;
  }

  if(!draw){
    html += buildBracketPreviewFromConfig(cfg, teams, draw);
    const drawReadyMsg = teams.length
      ? `<div class="card" style="margin-top:12px;background:linear-gradient(135deg,#fffdf5,#f8fbff);border:1.5px solid #dbe7ff">
          <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:nowrap">
            <div style="font-size:2rem;line-height:1;flex:0 0 auto">🎲</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:900;font-size:1rem;color:var(--primary-dark);margin-bottom:6px">예선 추첨 전입니다</div>
              <div style="font-size:.84rem;color:var(--text2);line-height:1.7">등록팀은 위에서 바로 확인할 수 있습니다. 예선 추첨을 진행하면 조편성, 예선 경기, 본선 흐름이 자동으로 표시됩니다.</div>
              ${canManageBracket() ? `<div style="margin-top:10px;display:flex;justify-content:flex-end"><button class="btn btn-accent" style="padding:8px 14px;font-size:.82rem;min-height:36px" onclick="openDraw('${tid}','${div}')">🎲 예선 추첨 시작</button></div>` : ''}
            </div>
          </div>
        </div>`
      : `<div class="empty-state card"><div class="empty-icon">👥</div><p>등록된 팀이 없습니다</p><div style="font-size:.78rem;color:var(--text3);margin-top:8px">팀 등록 후 예선 추첨을 진행할 수 있습니다.</div></div>`;
    html += drawReadyMsg;
    return html;
  }

  if(draw.groups?.length && showPrelimSection){
    html+=`<div class="sec-title" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <span>${isIndividualByKey(key)?'📋 예선 경기표':'📋 예선 조별 대진표'}</span>
    </div>`;
    html+=`<div id="${prelimToggleId}" style="display:${prelimCollapsed?'none':'block'}">`;
    draw.groups.forEach((grp,gi)=>{
      if(visibleGroupIndexes.length && !visibleGroupIndexes.includes(Number(gi))) return;
      const adv=cfg.advance||2;
      const stats=calcGS(key,gi,grp.teams,teams);
      const gms=gMs.filter(m=>m.group===gi);
      const grpDone=gms.length>0&&gms.every(m=>getMatchResultState(key,m).done);

      const grpCourts = getGroupDisplayCourts(key, gi);
      const courtBadges = grpCourts.length
        ? grpCourts.map(c=>`<span class="badge bg-blue" style="font-size:.82rem;padding:3px 9px">🎾 ${c}</span>`).join(' ')
        : (AD ? `<span class="badge bg-gray" style="font-size:.82rem;padding:3px 9px">코트: 미배정</span>` : ``);
      const grpCourtShareBadges = getGroupCourtShareBadges(key,gi);
      const doneCnt=gms.filter(m=>getMatchResultState(key,m).done).length;
      const indivMode=isIndividualByKey(key);
      const indivFlow=getIndividualGroupFlowText(key,gi);
      const indivCollapsed = indivMode ? !isIndividualGroupMatchesOpen(key, gi) : false;
      const grpMemo = getGroupMemo(key, gi);
      const grpMemoHeaderUI = canManageBracket()
        ? `<button class="btn btn-outline" style="padding:5px 13px;font-size:.82rem;white-space:nowrap;background:${grpMemo?'rgba(255,248,223,.22)':'rgba(255,255,255,.18)'};border:1.5px solid ${grpMemo?'#f6d365':'rgba(255,255,255,.5)'};color:${grpMemo?'#fff3bf':'white'};border-radius:999px;font-weight:700" onclick="openGroupMemoModal('${key}',${gi})">📢 공지(조)${grpMemo?' 수정':' 입력'}</button>`
        : (grpMemo?renderNoticeTicker(grpMemo,'📢 공지(조)',true):'');
      const simpleGroupHint = (grp.teams.length===2 && gms.length===1)
        ? `<span style="background:rgba(255,255,255,.18);padding:2px 9px;border-radius:999px;font-size:.7rem;font-weight:700">단판 1경기</span>`
        : '';
      html+=`<div class="grp-card">
        <div class="grp-hdr">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="font-size:1.15rem;font-weight:900;letter-spacing:.5px">${grpLabel(gi)}</span>
            <span style="font-size:.75rem;opacity:.85;font-weight:600">${grp.teams.length}${indivMode?'조':'팀'}</span>
            ${grpDone?'<span style="background:rgba(255,255,255,.25);padding:2px 9px;border-radius:999px;font-size:.7rem;font-weight:700">✅ 완료</span>'
              :`<span style="background:rgba(255,255,255,.18);padding:2px 9px;border-radius:999px;font-size:.7rem;font-weight:600">${doneCnt}/${gms.length} 경기</span>`}
            ${simpleGroupHint}
            ${indivMode&&indivFlow?`<span style="font-size:.72rem;font-weight:700;background:rgba(255,255,255,.14);padding:4px 9px;border-radius:999px">${indivFlow}</span>`:''}
            ${indivMode&&stats.some(s=>s.tiePending)&&canManageBracket()?`<button class="btn btn-outline" style="padding:4px 10px;font-size:.76rem;white-space:nowrap;background:rgba(255,248,223,.22);border:1.5px solid #f6d365;color:#fff3bf;border-radius:999px;font-weight:800" onclick="openIndividualTieAgePrompt('${key}',${gi})">🎂 동률 나이입력</button>`:''}
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${courtBadges}
            ${grpCourtShareBadges}
            ${grpMemoHeaderUI}
            ${canManageBracket()?`<button class="btn btn-outline" style="padding:5px 13px;font-size:.88rem;white-space:nowrap;background:rgba(255,255,255,.18);border:1.5px solid rgba(255,255,255,.5);color:white;border-radius:999px;font-weight:700" onclick="openGroupSmsModal('${key}',${gi})">📨 문자보내기</button>`:''}
            ${canManageBracket()?`<button class="btn btn-outline" style="padding:5px 13px;font-size:.88rem;white-space:nowrap;background:rgba(255,255,255,.18);border:1.5px solid rgba(255,255,255,.5);color:white;border-radius:999px;font-weight:600" onclick="openGroupCourtModal('${key}',${gi})">🎾 코트배정</button>`:''}
            ${indivMode?`<button id="indivGroupToggle_${key}_${gi}" class="btn btn-outline" style="padding:5px 13px;font-size:.86rem;white-space:nowrap;background:rgba(255,255,255,.18);border:1.5px solid rgba(255,255,255,.5);color:white;border-radius:999px;font-weight:700" onclick="toggleIndividualGroupMatches('${key}',${gi})">📂 경기 보기</button>`:''}
          </div>
        </div>
        ${grpMemo?renderNoticeTicker(grpMemo,'📢 공지(조)'):''}`;
      if(!indivMode){
        html+=`<div style="border-bottom:2px solid var(--border)">`;
        stats.forEach((s,r)=>{
          const isAdv=r<adv&&grpDone;
          const rowCls=isAdv&&r===0?'adv-1st':isAdv&&r===1?'adv-2nd':isAdv?'adv':'';
          const chipStyle=r===0?'background:#1565c0;color:white;':r===1?'background:#e67e22;color:white;':'background:#7f8c8d;color:white;';
          const rankLabel=s.rank==null?`${s.slot||r+1}번`:`${s.rank}위`;
          html+=`<div class="gs-row ${rowCls}">
            <div class="gs-rk">${rankLabel}</div>
            <div class="gs-nm">${s.nm}${(isAdv&&s.rank!=null)?`<span class="adv-chip" style="${chipStyle}">${r===0?'1위 진출':'2위 진출'}</span>`:''}</div>
            <div class="gs-stats">${s.rank==null?'<span style="color:var(--text3)">경기 전</span>':`<><span>${s.w}승 ${s.l}패</span><span style="color:${s.diff>0?'#1565c0':s.diff<0?'#c62828':'var(--text2)'}">득실 ${s.diff>0?'+':''}${s.diff}</span></>`}</div>
          </div>`.replace('<>','').replace('</>','');
        });
        html+=`</div><div class="grp-matches-section"><div class="grp-matches-label">📋 경기 목록</div>`;
      }else{
        const indivRows=stats.map((s,r)=>{
          const team=teams[s.teamIdx]||{};
          const info=getIndividualTeamCompactInfo(team);
          const hasRank=typeof s.rank==='number';
          const rankColor=hasRank?(s.rank===1?'#1d4ed8':s.rank===2?'#c2410c':'#475569'):'#475569';
          const diffColor=s.diff>0?'#1565c0':s.diff<0?'#c62828':'#64748b';
          const grpTeamLabel=getIndividualSideLabel(key,{group:gi},s.teamIdx)||`${s.slot||r+1}번`;
          const leftLabel=s.rankLabel||(hasRank?`${s.rank}위`:`${s.slot||r+1}번`);
          const mainEntryLabel = hasRank ? `${grpLabel(gi)} ${s.rank}위` : '';
          const jumpable = !!(hasRank && hasMainBracketForKey(key));
          return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);background:${hasRank?(s.rank===1?'linear-gradient(135deg,#eff6ff,#f8fbff)':s.rank===2?'linear-gradient(135deg,#fff7ed,#fffaf5)':'#fff'):'#fff'};${jumpable?'cursor:pointer;':''}" ${jumpable?`onclick="jumpToMainEntryByLabel('${key}','${mainEntryLabel}')" title="본선 자리로 이동"`:''}>
            <div style="flex:0 0 46px;text-align:center">
              <div style="font-size:.72rem;font-weight:900;color:${rankColor}">${leftLabel}</div>
              <div style="margin-top:6px;padding:4px 0;border-radius:10px;background:#f8fafc;border:1px solid var(--border);font-size:.72rem;font-weight:900;color:var(--primary)">${grpTeamLabel}</div>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:.98rem;font-weight:900;color:var(--text);line-height:1.38;word-break:keep-all;overflow-wrap:anywhere">${info.namesHtml||info.names}</div>
              ${info.clubs?`<div style="font-size:.66rem;color:#64748b;margin-top:4px;line-height:1.35;word-break:keep-all;overflow-wrap:anywhere">${info.clubs}</div>`:''}
              ${hasRank?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
                <span class="badge bg-blue" style="font-size:.72rem;padding:3px 8px">승 ${s.w}</span>
                <span class="badge bg-gray" style="font-size:.72rem;padding:3px 8px">패 ${s.l}</span>
                <span class="badge bg-gray" style="font-size:.72rem;padding:3px 8px">게임득 ${s.pf}</span>
                <span class="badge bg-gray" style="font-size:.72rem;padding:3px 8px">게임실 ${s.pa}</span>
                <span class="badge" style="font-size:.72rem;padding:3px 8px;background:#f8fafc;color:${diffColor};border:1px solid ${diffColor==='\#64748b'?'#cbd5e1':diffColor}">게임득실 ${s.diff>0?'+':''}${s.diff}</span>
                ${s.tiePending?`<span class="badge" style="font-size:.72rem;padding:3px 8px;background:#fff7ed;color:#c2410c;border:1px solid #fdba74">동률 · 나이입력 필요</span>`:''}
                ${hasRank&&hasMainBracketForKey(key)?`<span class="badge" style="font-size:.72rem;padding:3px 8px;background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe">본선 자리 보기</span>`:''}
              </div>`:''}
            </div>
          </div>`;
        }).join('');
        html+=`<div style="border-top:1px solid rgba(255,255,255,.14);background:#fff">
          <div style="padding:9px 12px;font-size:.8rem;font-weight:900;color:var(--primary-dark);background:linear-gradient(135deg,#f8fafc,#eef4ff);border-bottom:1px solid var(--border)">📋 조별 명단 · 순위 현황</div>
          ${indivRows}
        </div>
        <div id="indivGroupMatches_${key}_${gi}" class="grp-matches-section" style="padding-top:12px;display:${indivCollapsed?'none':'block'}"><div class="grp-matches-label">📋 경기 목록</div>`;
      }
      sortGroupMatchesForDisplay(key, gi, gms).filter(m=>isMatchVisibleByCourtFilter(key,m)).forEach(m=>{
        const mt1=teams[m.t1],mt2=teams[m.t2];
        if(!mt1||!mt2)return;
        const dn1=tdn(mt1,key,m.t1),dn2=tdn(mt2,key,m.t2);
        const st=getMatchResultState(key,m);
        const done=st.done;
        const sc1=st.sc1,sc2=st.sc2;
        html+=mCard(m,key,dn1,dn2,done,sc1,sc2,indivMode?getIndividualMatchLabel(key,m):`예선 ${grpLabel(gi)}`);
      });
      html+=`</div></div>`;
    });

    if(isGroupKO && showMainSection){
      const advT = s3 ? getAdvT(key,draw,teams,cfg) : [];
      html+=`<div class="card" style="background:linear-gradient(135deg,#eef2ff,#dce8fb);border:1.5px solid var(--success)">
        <div class="card-title" style="color:var(--success)">🏆 본선 ${s3?`진출팀 (${advT.length}팀)`:'진출 예정'}</div>
        ${s3 ? `
          <div style="display:flex;flex-wrap:wrap;gap:6px">${advT.map((at,i)=>`<span class="badge" style="font-size:.8rem;padding:5px 12px;background:${at.rk===1?'linear-gradient(135deg,#fff7dd,#f6d365)':'linear-gradient(135deg,#eef2f7,#d8e0ea)'};color:${at.rk===1?'#7a5600':'#425466'};border:1px solid ${at.rk===1?'#d4a017':'#b8c3d1'}">${at.rk===1?'👑':'🥈'} ${i+1}. ${at.nm} <small style="opacity:.8">(${grpLabel(at.gn-1)} ${at.rk}위)</small></span>`).join('')}</div>
        ` : `
          <div style="font-size:.82rem;color:var(--text2);line-height:1.7">예선이 아직 진행 중이라 실제 진출팀은 확정되지 않았습니다. 아래 본선 대진표는 <b>미리보기</b>로 항상 표시되며, 본선 추첨 버튼을 누르면 A조 1위·B조 2위 같은 자리 기준으로도 바로 추첨할 수 있습니다.</div>
        `}
        ${canManageBracket()&&!mMs.length?`<div style="margin-top:12px"><button class="btn btn-primary" style="padding:8px 20px" onclick="buildMain('${tid}','${div}')">🎲 본선 추첨</button></div>`:''}
      </div>`;
      {
        const pvCfg = cfg.format==='group_knockout' ? cfg : {...cfg, format:'group_knockout'};
        const pv=buildPreviewMainSlots(draw, pvCfg);
        const spec=pv.spec||computeMainBracketSpec((draw.advance||cfg.advance||2)*(draw.groups?.length||0));
        // 조별 본선 배정 표
        const slotAssignHtml=(()=>{
          const slots=pv.matchSlots||[];
          const playIns=pv.playInMatches||[];
          const playInMap={};
          playIns.forEach((pm,i)=>{
            if(pm.t1) playInMap[pm.t1.nm]=`🪣 진출전(똥통) ${i+1}경기`;
            if(pm.t2) playInMap[pm.t2.nm]=`🪣 진출전(똥통) ${i+1}경기`;
          });
          const mainMap={};
          slots.forEach((ms,si)=>{
            if(ms.t1) mainMap[ms.t1.nm]=`${spec.mainSize||pv.n}강 ${si+1}번`;
            if(ms.t2) mainMap[ms.t2.nm]=`${spec.mainSize||pv.n}강 ${si+1}번`;
          });
          const rows=(draw.groups||[]).map((grp,gi)=>{
            const grpSz=grp.teams?.length||0;
            const advCount=grpSz<=2?grpSz:2;
            const entries=[];
            for(let rk=1;rk<=advCount;rk++){
              const nm=`${grpLabel(gi)} ${rk}위`;
              const dest=playInMap[nm]||mainMap[nm]||'—';
              const isPlayIn=!!playInMap[nm];
              const destClr=isPlayIn?'#92400e':'#166534';
              const destBg=isPlayIn?'#fff8e6':'#f0fdf4';
              entries.push(`<span style="font-size:.7rem;font-weight:700;padding:2px 7px;border-radius:5px;background:${destBg};color:${destClr}">${rk}위→${dest}</span>`);
            }
            return `<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:4px 8px;border-bottom:1px solid #f1f5f9">
              <span style="font-size:.75rem;font-weight:800;color:#0f1e3a;min-width:28px">${grpLabel(gi)}</span>${entries.join('')}
            </div>`;
          }).join('');
          return rows?`<div style="margin-top:10px;border:1px solid #e2e8f0;border-radius:9px;overflow:hidden">
            <div style="padding:5px 9px;background:#f8fafc;font-size:.7rem;font-weight:700;color:#475569;border-bottom:1px solid #e2e8f0">📌 조별 본선 배정 위치</div>${rows}</div>`:'';
        })();
        if(pv.n>=2 && !mMs.length){
          const adv=draw.advance||cfg.advance||2;
          const grpCount=draw.groups?.length||0;
          const specLabel=spec.playInMatches>0?`${spec.mainSize}강+진출전${spec.playInMatches}경기`:`${pv.n}강`;
          html+=`<div class="sec-title" id="mainPreviewTitle_${tid}_${div}" style="margin-top:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
            <span>🏆 본선 토너먼트 대진표</span>
            <span class="badge" style="background:var(--accent);color:#fff;font-size:.72rem">${adv}팀 진출 × ${grpCount}조 → ${specLabel}</span>
          </div>`;
          const isFixedPreview=((draw.mainMode||'fixed')==='fixed');
          const redrawPreview=buildIndivRedrawPreviewData(draw.groups||[], draw.grpSize||2);
          html+=`<div class="card" id="mainPreviewCard_${tid}_${div}" style="background:linear-gradient(135deg,#fffdf5,#eef5ff);border:1.5px dashed var(--accent)">
            <div style="font-weight:800;color:var(--primary-dark);margin-bottom:6px">${isFixedPreview?'📌 본선은 지금부터 계속 보입니다':'📌 본선은 예선 후 재추첨됩니다'}</div>
            <div style="font-size:.78rem;color:var(--text2);margin-bottom:10px;line-height:1.7">
              ${isFixedPreview
                ? '예선이 끝나기 전에는 <b>본선 구조 미리보기</b>로 표시되고, 예선 종료 후 본선 추첨을 하면 실제 팀으로 자동 배정됩니다. 진출전이 있으면 직행팀 수와 진출전 팀 수가 함께 표시됩니다.'
                : '본선을 <b>재추첨</b>으로 설정한 경우에는 예선 단계에서 실제 본선 배정 위치를 미리 보여주지 않습니다. 아래에는 구조와 진출전 자리만 표시됩니다. 예: 66팀이면 직행 62팀, 진출전 4팀(2경기), 승자 2팀이 64강 합류.'}
            </div>
            ${isFixedPreview ? renderMainPreviewHTML(pv.matchSlots,pv.n,true,pv.playInMatches||[]) : renderMainPreviewHTML(redrawPreview.matchSlots,redrawPreview.spec.mainSize||pv.n,true,redrawPreview.playInMatches||[])}
            ${isFixedPreview ? slotAssignHtml : ''}
          </div>`;
        } else if(pv.n>=2 && mMs.length){
          html+=`<div style="margin-top:8px">
            <button class="btn btn-outline" style="font-size:.72rem;padding:4px 12px" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.textContent=this.nextElementSibling.style.display==='none'?'🌳 조별 본선 연결구조 보기':'🌳 조별 본선 연결구조 접기'">🌳 조별 본선 연결구조 보기</button>
            <div style="display:none;margin-top:8px">
              <div style="font-size:.75rem;color:var(--text2);margin-bottom:6px">본선은 전체 재추첨이므로 추첨 전에는 실제 배정 정보를 숨깁니다.</div>
              <div style="background:linear-gradient(135deg,#fffdf5,#eef5ff);border:1.5px dashed var(--accent);border-radius:var(--radius-lg);padding:12px">
                ${renderMainPreviewHTML(buildIndivRedrawPreviewData(draw.groups||[], draw.grpSize||2).matchSlots, buildIndivRedrawPreviewData(draw.groups||[], draw.grpSize||2).spec.mainSize||pv.n, true, buildIndivRedrawPreviewData(draw.groups||[], draw.grpSize||2).playInMatches||[])}
              </div>
            </div>
          </div>`;
        }
      }
    }
  }

  if(draw.groups?.length && showPrelimSection){
    html+=`</div>`;
  }

  if(mMs.length && showMainSection){
    const rounds=[...new Set(mMs.map(m=>Number(m.round||0)))].sort((a,b)=>a-b);
    const totalR=rounds.length;

    if(prelimCollapsed && !s4){
      html+=`<div style="margin:6px 0 10px;padding:10px 12px;border-radius:12px;background:linear-gradient(135deg,#eef4ff,#f8fbff);border:1px solid #cfe0ff;font-size:.82rem;font-weight:700;color:#1d4ed8">📌 예선 내용은 접혀 있습니다. 위의 <b>예선내용 펼치기</b>를 누르면 전체 내용을 다시 볼 수 있습니다.</div>`;
    }

    html+=`<div class="sec-title" style="margin-top:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <span id="mainStageTitle_${tid}_${div}">🏆 본선 토너먼트 대진표</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-outline" style="font-size:.76rem;padding:5px 12px;font-weight:800;border-color:var(--accent);color:var(--accent)" onclick="toggleMainSection('${key}')">${mainCollapsed?'📂 가지형 대진표 펼치기':'📁 가지형 대진표 접기'}</button>
        ${canManageBracket()?`<div style="display:flex;gap:6px">
          <button class="btn btn-outline" style="font-size:.72rem;padding:4px 10px" onclick="buildMain('${tid}','${div}')">🎲 본선 시드보호 재추첨</button>
          <button class="btn btn-outline" style="font-size:.72rem;padding:4px 10px" onclick="openManualEdit('${tid}','${div}')">✏️ 수동수정</button>
        </div>`:''}
      </div>
    </div>`;

    const filteredMainMs=mMs.filter(m=>isMainMatchVisibleByFilter(key,m) && isMatchVisibleByCourtFilter(key,m));
    const hasMainOpFilter=(getDisplayMainBlockFilters(key).length>0);
    html+=`<div id="${mainToggleId}" style="display:${mainCollapsed?'none':'block'}">`;
    html+= `<div id="mainStage_${tid}_${div}">`+(filteredMainMs.length?renderBracketTree(key,filteredMainMs,teams):`<div style="padding:14px 12px;border:1px dashed #bfdbfe;border-radius:12px;background:#fff;font-size:.82rem;color:var(--text2)">선택한 본선 구간에 표시할 대진이 없습니다.</div>`)+`</div>`;
    html+=`</div>`;
    if(mainCollapsed){
      html += `<div style="margin:6px 0 10px;padding:10px 12px;border-radius:12px;background:linear-gradient(135deg,#fff7ed,#fff1e6);border:1px solid #fed7aa;font-size:.82rem;font-weight:700;color:#c2410c">📌 가지형 본선 대진표만 접혀 있습니다. 아래 <b>본선 경기 현황</b>과 결과는 그대로 볼 수 있습니다.</div>`;
    }

    // 진출전(play-in) 경기 표시
    if(playInMs.length){
      html+=`<div class="sec-title" style="margin-top:14px">🪣 진출전(똥통) 경기 현황</div><div style="font-size:.74rem;color:var(--text2);margin:4px 0 8px">직행팀은 바로 본선으로 들어가고, 아래 경기 승자만 본선에 합류합니다.</div>`;
      playInMs.filter(pm=>isMatchVisibleByCourtFilter(key,pm)).forEach((pm,idx)=>{
        const mt1=pm.t1!==null?teams[pm.t1]:null;
        const mt2=pm.t2!==null?teams[pm.t2]:null;
        const dn1=mt1?tdn(mt1,key,pm.t1):(pm.source1Label||'TBD');
        const dn2=mt2?tdn(mt2,key,pm.t2):(pm.source2Label||'TBD');
        const st=getMatchResultState(key,pm);
        const doneHtml=st.done?`<span class="badge bg-green" style="font-size:.76rem">완료</span>`:'';
        const winnerHtml=st.done&&pm.winner!==null?`<div style="font-size:.76rem;color:#166534;margin-top:4px">✅ 승자 → ${tdn(teams[pm.winner],key,pm.winner)} → ${pm.winnerLabel||'본선 합류'}</div>`:`<div style="font-size:.72rem;color:var(--text3);margin-top:4px">승자 → ${pm.winnerLabel||'본선 합류'}</div>`;
        html+=`<div style="padding:10px 14px;border:1.5px solid #f59e0b;border-radius:10px;margin-bottom:8px;background:linear-gradient(135deg,#fffbeb,#fff8e6)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:.8rem;font-weight:800;color:#92400e">🪣 진출전(똥통) ${idx+1}</span>${doneHtml}
          </div>
          ${mCard(pm,key,dn1,dn2,st.done,st.sc1,st.sc2,'진출전')}
          ${winnerHtml}
        </div>`;
      });
    }

    html+=`<div class="sec-title" style="margin-top:14px">⚡ 본선 경기 현황</div>`;
    rounds.forEach((r,rIdx)=>{
      const rms=mMs.filter(m=>Number(m.round||0)===r).filter(m=>isMainMatchVisibleByFilter(key,m) && isMatchVisibleByCourtFilter(key,m)).sort((a,b)=>Number(a.slot||0)-Number(b.slot||0));
      if(!rms.length) return;
      const lbl=r===rounds[rounds.length-1]?'결승':rIdx===totalR-2&&totalR>2?'준결승':`${Math.pow(2,totalR-1-rIdx)*2}강`;
      const roundTheme=getRoundVisualTheme(lbl,'main');
      const activeMatches=[];
      const doneMatches=[];
      const byeMatches=[];
      rms.forEach(m=>{
        if(m.bye) byeMatches.push(m);
        else {
          const st=getMatchResultState(key,m);
          if(st.done) doneMatches.push(m);
          else activeMatches.push(m);
        }
      });
      const roundDone = activeMatches.length===0;
      const roundCollapsed = isMainStatusRoundCollapsed(key, r, roundDone);
      const doneCollapsed = isMainStatusDoneMatchCollapsed(key, r, true);
      const headerBadges = `<div style="display:flex;gap:5px;flex-wrap:wrap">        <span class="badge" style="background:${roundTheme.chipBg};color:${roundTheme.chipFg};border:1px solid ${roundTheme.bd}">${lbl}</span>        <span class="badge" style="background:#ecfccb;color:#166534">완료 ${doneMatches.length + byeMatches.length}</span>        ${activeMatches.length?`<span class="badge live-blink" style="background:#fff3cd;color:#9a6400;border:1px solid #f5a623">진행·대기 ${activeMatches.length}</span>`:''}      </div>`;
      html+=`<div style="margin:10px 0 8px;border:1.5px solid ${roundTheme.bd};border-radius:14px;background:${roundCollapsed?'#fff':'linear-gradient(135deg,#fff, '+roundTheme.softBg+')'};overflow:hidden">        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:10px 12px;background:${roundCollapsed?'#f8fafc':roundTheme.softBg};border-bottom:${roundCollapsed?'none':'1px solid '+roundTheme.bd}">          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0">            <button class="btn btn-outline" style="font-size:.72rem;padding:4px 10px;font-weight:800;border-color:${roundTheme.bd};color:${roundTheme.fg};background:#fff" onclick="toggleMainStatusRound('${key}',${r})">${roundCollapsed?'📂':'📁'}</button>            <div style="font-size:.88rem;font-weight:900;color:${roundTheme.fg}">${lbl}</div>            ${headerBadges}          </div>          <div style="font-size:.74rem;font-weight:800;color:${roundDone?'#166534':'#9a6400'}">${roundDone?'자동 접힘':'진행중 라운드'}</div>        </div>`;
      if(!roundCollapsed){
        html+=`<div style="padding:10px 12px">`;
        if(activeMatches.length){
          activeMatches.forEach(m=>{
            const mt1=m.t1!==null?teams[m.t1]:null,mt2=m.t2!==null?teams[m.t2]:null;
            if(!mt1&&!mt2){
              html+=`<div style="padding:8px 14px;background:var(--panel2);border-radius:var(--radius);border:1px solid var(--border);font-size:.78rem;color:var(--text3);margin-bottom:6px">🎲 추첨 전 대기 중</div>`;
              return;
            }
            const dn1=mt1?tdn(mt1,key,m.t1):'TBD';
            const dn2=mt2?tdn(mt2,key,m.t2):'TBD';
            const st=getMatchResultState(key,m);
            html+=mCard(m,key,dn1,dn2,st.done,st.sc1,st.sc2,'본선');
          });
        }else{
          html+=`<div style="padding:9px 12px;border:1px dashed #86efac;border-radius:10px;background:#f0fdf4;font-size:.8rem;font-weight:800;color:#166534;margin-bottom:6px">✅ 이 라운드 경기가 모두 끝나 자동으로 접힙니다.</div>`;
        }
        if(doneMatches.length || byeMatches.length){
          html+=`<div style="margin-top:8px;border-top:1px dashed ${roundTheme.bd};padding-top:8px">            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:${doneCollapsed?'0':'8px'}">              <div style="font-size:.78rem;font-weight:900;color:#1e3a8a">🏁 완료 경기 ${doneMatches.length + byeMatches.length}</div>              <button class="btn btn-outline" style="font-size:.72rem;padding:4px 10px" onclick="toggleMainStatusDoneMatches('${key}',${r})">${doneCollapsed?'📂 완료 경기 펼치기':'📁 완료 경기 접기'}</button>            </div>`;
          if(!doneCollapsed){
            doneMatches.forEach(m=>{
              const mt1=m.t1!==null?teams[m.t1]:null,mt2=m.t2!==null?teams[m.t2]:null;
              const dn1=mt1?tdn(mt1,key,m.t1):'TBD';
              const dn2=mt2?tdn(mt2,key,m.t2):'TBD';
              const st=getMatchResultState(key,m);
              html+=mCard(m,key,dn1,dn2,st.done,st.sc1,st.sc2,'본선');
            });
            byeMatches.forEach(m=>{
              const bt=m.winner!==null?teams[m.winner]:null;
              const byeLabel=String(m.source1Label||'').trim();
              const byeText=bt?tdn(bt,key,m.winner):(byeLabel||'TBD');
              html+=`<div style="padding:8px 14px;background:var(--panel2);border-radius:var(--radius);border:1px solid var(--border);font-size:.8rem;color:var(--text3);margin-bottom:6px">🎫 부전승: ${byeText}${byeLabel?` <span style="color:var(--text2)">(${byeLabel} 자리)</span>`:''}</div>`;
            });
          }
          html+=`</div>`;
        }
        html+=`</div>`;
      }
      html+=`</div>`;
    });

    const bronzeMode=getThirdPlaceModeByKey(key);
    const bronzeMatch=(bronzeMode==='match') ? ensureBronzeMatchForKey(key,false) : getBronzeMatch(key);
    if(bronzeMode==='match' && bronzeMatch){
      const bt1=bronzeMatch.t1!==null?teams[bronzeMatch.t1]:null;
      const bt2=bronzeMatch.t2!==null?teams[bronzeMatch.t2]:null;
      const bdn1=bt1?tdn(bt1,key,bronzeMatch.t1):(bronzeMatch.t1===null?'TBD':'?');
      const bdn2=bt2?tdn(bt2,key,bronzeMatch.t2):(bronzeMatch.t2===null?'TBD':'?');
      const bst=getMatchResultState(key,bronzeMatch);
      const bronzeReassignBtn=AD?`<button class="btn btn-outline" style="padding:3px 8px;font-size:.72rem;margin-left:8px;vertical-align:middle;color:#7c3aed;border-color:#7c3aed" onclick="resetBronzeTeams('${key}')">🔄 팀 재배정</button>`:'';
      html += `<div style="font-size:.82rem;font-weight:700;color:var(--primary-dark);margin:10px 0 4px;padding-left:4px">— 3·4위전${bronzeReassignBtn}</div>`;
      html += mCard(bronzeMatch,key,bdn1,bdn2,bst.done,bst.sc1,bst.sc2,'3·4위전');
    }
    const ranks = calcFinalRanks(key,teams,mMs);
    if(ranks.length){
      html += renderRankingCard(key, ranks, teams);
    }
  }

  return html;
}

function calcFinalRanks(key,teams,mMs){
  try{
    const mainList=getMainOnlyMatches(mMs);
    if(!mainList.length) return [];
    const finalMatch=getMainFinalMatch(mainList);
    if(!finalMatch || finalMatch.winner==null) return [];
    const ranks=[];
    const added=new Set();
    const pushRank=(teamIdx, rank, label)=>{
      if(teamIdx===null || teamIdx===undefined || added.has(teamIdx)) return;
      const tm=teams?.[teamIdx];
      if(!tm) return;
      added.add(teamIdx);
      ranks.push({teamIdx, rank, label, club: tm.club||tdn(tm,key,teamIdx)});
    };
    const runner = finalMatch.winner===finalMatch.t1 ? finalMatch.t2 : finalMatch.t1;
    pushRank(finalMatch.winner,1,'우승');
    pushRank(runner,2,'준우승');

    const bronzeMode=getThirdPlaceModeByKey(key);
    const bronzeMatch=getBronzeMatch(key);
    if(bronzeMode==='match' && bronzeMatch && bronzeMatch.winner!=null && !bronzeMatch.bye){
      const bronzeLoser = bronzeMatch.winner===bronzeMatch.t1 ? bronzeMatch.t2 : bronzeMatch.t1;
      pushRank(bronzeMatch.winner,3,'3위');
      pushRank(bronzeLoser,4,'4위');
    }else{
      getSharedThirdTeamIndexes(key,teams,mainList).forEach(idx=>pushRank(idx,3,'공동 3위'));
    }
    return ranks.sort((a,b)=>a.rank-b.rank || String(a.club).localeCompare(String(b.club),'ko'));
  }catch(e){
    console.warn('calcFinalRanks fallback error', e);
    return [];
  }
}
function renderRankingCard(key,ranks,teams){
  try{
    if(!Array.isArray(ranks) || !ranks.length) return '';
    const medal={1:'🥇',2:'🥈',3:'🥉',4:'4️⃣'};
    const rows=ranks.map(r=>{
      const tm=teams?.[r.teamIdx]||null;
      const name=tm?tdn(tm,key,r.teamIdx):(r.club||'-');
      return `<div class="gs-row ${r.rank===1?'adv-1st':r.rank===2?'adv-2nd':'adv'}">
        <div class="gs-rk">${medal[r.rank]||'🏅'}</div>
        <div class="gs-nm">${name}${r.label?` <span class="adv-chip">${r.label}</span>`:''}</div>
        <div class="gs-stats"><span>${r.label||''}</span></div>
      </div>`;
    }).join('');
    return `<div class="sec-title" style="margin-top:14px">🏅 최종 결과</div>
      <div class="grp-card"><div class="grp-body">${rows}</div></div>`;
  }catch(e){
    console.warn('renderRankingCard fallback error', e);
    return '';
  }
}


function getIndividualMatchLabel(key,m){
  try{
    if(!isIndividualByKey(key) || !m || m.phase!=='group' || m.group==null) return '';
    const gi=Number(m.group);
    const pr=getGroupDisplayPriority(key, gi, m);
    return `${pr+1}경기`;
  }catch(e){ return ''; }
}
function getIndividualGroupFlowText(key,gi){
  try{
    if(!isIndividualByKey(key)) return '';
    const grp=G.draws[key]?.groups?.[Number(gi)];
    const size=Array.isArray(grp?.teams)?grp.teams.length:0;
    if(size===2) return '진행순서: 1번조 vs 2번조';
    if(size===3) return '진행순서: 1번조 vs 2번조 → 승리팀 vs 3번조 → 패배팀 vs 3번조';
    return '';
  }catch(e){ return ''; }
}
function getIndividualSideLabel(key,m,teamId){
  try{
    if(!isIndividualByKey(key) || !m || m.group==null) return '';
    const grp=G.draws[key]?.groups?.[Number(m.group)];
    const arr=Array.isArray(grp?.teams)?grp.teams:[];
    const idx=arr.findIndex(v=>String(v)===String(teamId));
    return idx>=0 ? `${idx+1}번` : '';
  }catch(e){ return ''; }
}
function getIndividualTeamCompactInfo(team){
  try{
    const players=getIndividualPlayers(team).slice(0,2);
    const names=players.map(p=>String(p?.name||'').trim()).filter(Boolean);
    const clubs=players.map(p=>String(p?.clubsRaw||'').trim()).filter(Boolean);
    const namesHtml=players.length
      ? players.map(p=>{
          const nm=String(p?.name||'').trim();
          if(!nm) return '';
          const ph=formatPhoneLoose(String(p?.phone||'').trim());
          const club=String(p?.clubsRaw||'').trim();
          const career=normalizeCareerValue(p?.career||'');
          return renderClickablePlayerName(nm, club, ph, 'font-weight:900;color:var(--text)', career);
        }).filter(Boolean).join(' / ')
      : '-';
    return {
      names: names.length ? names.join(' / ') : '-',
      namesHtml,
      clubs: clubs.length ? clubs.join(' · ') : ''
    };
  }catch(e){ return {names:'-', namesHtml:'-', clubs:''}; }
}
function getIndividualGroupStatsMap(key,gi){
  try{
    const grp=G.draws[key]?.groups?.[Number(gi)];
    const tids=Array.isArray(grp?.teams)?grp.teams:[];
    if(!tids.length) return {};
    const teams=G.teams[key]||[];
    const stats=calcGS(key,Number(gi),tids,teams)||[];
    const out={};
    stats.forEach((s,idx)=>{
      const teamKey = s.teamIdx ?? s.ti ?? s.teamId ?? s.idx;
      const hasRank=typeof s.rank==='number';
      out[String(teamKey)]={
        rank:hasRank?s.rank:null,
        rankLabel:String(s.rankLabel||''),
        tiePending:!!s.tiePending,
        age:Number(s.age||0),
        slot:idx+1,
        w:Number(s.w||0),
        l:Number(s.l||0),
        pf:Number(s.pf ?? s.gw ?? 0),
        pa:Number(s.pa ?? s.gl ?? 0),
        diff:Number(s.diff ?? ((s.pf ?? s.gw ?? 0) - (s.pa ?? s.gl ?? 0)) ?? 0)
      };
    });
    return out;
  }catch(e){ return {}; }
}
function individualMiniStatHtml(st){
  try{
    if(!st) return '';
    const label=String(st.rankLabel||'').trim() || (typeof st.rank==='number'?`${st.rank}위`:'');
    if(!label && !st.tiePending && Number(st.w||0)===0 && Number(st.l||0)===0 && Number(st.pf||0)===0 && Number(st.pa||0)===0) return '';
    const numRank=typeof st.rank==='number'?st.rank:null;
    return `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px">
      ${label?`<span style="font-size:.67rem;font-weight:900;color:${numRank===1?'#1d4ed8':numRank===2?'#c2410c':'#475569'}">${label}</span>`:''}
      <span style="font-size:.64rem;color:#64748b">${st.w}승 ${st.l}패</span>
      <span style="font-size:.64rem;color:#64748b">게임득 ${st.pf} 게임실 ${st.pa}</span>
      <span style="font-size:.64rem;color:${st.diff>0?'#1565c0':st.diff<0?'#c62828':'#64748b'}">게임득실 ${st.diff>0?'+':''}${st.diff}</span>
      ${st.tiePending?`<span style="font-size:.64rem;color:#c2410c">동률 · 나이입력 전</span>`:''}
    </div>`;
  }catch(e){ return ''; }
}
function toggleIndividualGroupMatches(key,gi){
  try{
    const box=ge(`indivGroupMatches_${key}_${gi}`);
    const btn=ge(`indivGroupToggle_${key}_${gi}`);
    if(!box||!btn) return;
    const hidden=box.style.display==='none';
    const nextOpen=hidden;
    box.style.display=nextOpen?'block':'none';
    btn.textContent=nextOpen?'📂 경기 접기':'📂 경기 보기';
    setIndividualGroupMatchesOpen(key, gi, nextOpen);
  }catch(e){}
}

function mCard(m,key,dn1,dn2,done,sc1,sc2,label){
  const wn1=done&&m.winner===m.t1,wn2=done&&m.winner===m.t2;
  const rbs=m.rubbers||[];
  const indivMode=isIndividualByKey(key);
  // 복식 수 결정
  const[,div]=key.split('_');const isT=div==='terinee';
  const teams=G.teams[key]||[];const t1=teams[m.t1];
  const p1=t1?.players||[];
  const dbl=indivMode?1:(t1?.doublesCount||(isT?(p1.length<=6?3:p1.length<=8?4:5):5));
  const rbLabels=indivMode?['1경기']:['1복식','2복식','3복식','4복식','5복식'];
  const rbH=rbs.length?rbs.map((rb,r)=>{
    if(!rb||rb.score1==null)return`<div class="rb-row pend"><span class="rb-p1">${rb.players1?.join('/')||dn1+' '+(r+1)+'복식'}</span><span class="rb-sc">- : -</span><span class="rb-p2">${rb.players2?.join('/')||dn2+' '+(r+1)+'복식'}</span></div>`;
    const rw1=rb.winner===0,rw2=rb.winner===1;
    return`<div class="rb-row ${rw1?'win1':rw2?'win2':'pend'}"><span class="rb-p1" style="color:${rw1?'var(--success)':rw2?'var(--text3)':'inherit'}">${rb.players1?.join('/')||'-'}</span><span class="rb-sc" style="color:${rw1?'var(--success)':rw2?'var(--danger)':'var(--text2)'}">${rb.tiebreak?`<b>${rb.score1}:${rb.score2}</b><small style="font-size:.6em">TB</small>`:`${rb.score1}:${rb.score2}`}</span><span class="rb-p2" style="color:${rw2?'var(--success)':rw1?'var(--text3)':'inherit'}">${rb.players2?.join('/')||'-'}</span></div>`;
  }).join(''): rbLabels.slice(0,dbl).map(l=>`<div class="rb-row pend"><span>${l}</span><span class="rb-sc">-:-</span><span>-</span></div>`).join('');


  if(indivMode){
    const st2=getMatchResultState(key,m);
    done=st2.done; sc1=st2.sc1; sc2=st2.sc2;
    const canDirEdit=canEditMatchByDirector(key,m);
    const indivAuth=getIndividualResultAuthState(key,m);
    const btn=(AD||canDirEdit||indivAuth.allowed)?`<button class="btn ${done?'btn-gray':'btn-accent'}" style="padding:5px 12px;font-size:.77rem;white-space:nowrap" onclick="openM3('${key}','${m.id}')">${done?'✏️ 결과수정':'⚡ 결과입력'}</button>`:'';
    const sideLabel1=getIndividualSideLabel(key,m,m.t1)||'1번';
    const sideLabel2=getIndividualSideLabel(key,m,m.t2)||'2번';
    const grpCourts=(m.phase==='group' && m.group!=null)?((G.draws[key]?.groups?.[Number(m.group)]?.courts)||[]):[];
    const grpCourtShareBadges=(m.phase==='group' && m.group!=null)?getGroupCourtShareBadges(key, Number(m.group)):'';
    const matchMemo=getMatchMemoByObj(m);
    const matchCourts=Array.isArray(m.courts)?m.courts:(m.court?[m.court]:[]);
    const groupCourtUI=canManageBracket() && m.phase==='group' && m.group!=null
      ? `<button style="padding:5px 12px;font-size:.78rem;white-space:nowrap;background:#fff;color:var(--primary-dark);border:1.5px solid var(--border);border-radius:999px;font-weight:800" onclick="openGroupCourtModal('${key}',${Number(m.group)})">🎾 조코트 ${grpCourts.length?grpCourts.join('/'): '미배정'}</button>`
      : (grpCourts.length?`<span class="badge bg-gray" style="font-size:.74rem;padding:4px 9px">🎾 조코트 ${grpCourts.join('/')}</span>`:'');
    const matchCourtUI=canManageBracket()
      ? `<button style="padding:5px 12px;font-size:.78rem;white-space:nowrap;background:#fff;color:var(--primary-dark);border:1.5px solid var(--border);border-radius:999px;font-weight:800" onclick="openMatchCourtModal('${key}','${m.id}')">🎾 경기코트 ${matchCourts.length?matchCourts.join('/'): '미배정'}</button>`
      : (matchCourts.length?`<span class="badge bg-gray" style="font-size:.74rem;padding:4px 9px">🎾 경기코트 ${matchCourts.join('/')}</span>`:'');
    const matchMemoUI=canManageBracket()
      ? `<button style="padding:5px 12px;font-size:.78rem;white-space:nowrap;background:#fff;color:${matchMemo?'#7a5600':'var(--primary-dark)'};border:1.5px solid ${matchMemo?'#f6d365':'var(--border)'};border-radius:999px;font-weight:800" onclick="openMatchMemoModal('${key}','${m.id}')">📢 공지(경기)${matchMemo?' 수정':' 입력'}</button>`
      : (matchMemo?renderNoticeTicker(matchMemo,'📢 공지(경기)',true):'');
    const info1=getIndividualTeamCompactInfo(teams[m.t1]||{});
    const info2=getIndividualTeamCompactInfo(teams[m.t2]||{});
    // 예선 미완료 본선 추첨 시: t1/t2가 null이면 source*Label(="A조1위" 등) 표시
    const label1Html = m.t1===null && dn1 && dn1!=='TBD'
      ? `<span style="font-size:.92rem;font-weight:800;color:var(--primary-dark)">${dn1}</span>`
      : (info1.namesHtml||info1.names||dn1||'-');
    const label2Html = m.t2===null && dn2 && dn2!=='TBD'
      ? `<span style="font-size:.92rem;font-weight:800;color:var(--primary-dark)">${dn2}</span>`
      : (info2.namesHtml||info2.names||dn2||'-');
    const statMap=getIndividualGroupStatsMap(key,Number(m.group));
    const stat1=statMap[String(m.t1)]||null;
    const stat2=statMap[String(m.t2)]||null;
    const dispSc1=st2.disp1??sc1, dispSc2=st2.disp2??sc2;
    const sideWrap1Style=done&&wn1?'padding:10px;border:1.5px solid #86efac;border-radius:12px;background:linear-gradient(135deg,#ecfdf5,#dcfce7);min-width:0;overflow:hidden':done&&wn2?'padding:10px;border:1.5px solid #fecaca;border-radius:12px;background:linear-gradient(135deg,#fff7f7,#fef2f2);min-width:0;overflow:hidden':'padding:10px;border:1.5px solid var(--border);border-radius:12px;background:#fff;min-width:0;overflow:hidden';
    const sideWrap2Style=done&&wn2?'padding:10px;border:1.5px solid #86efac;border-radius:12px;background:linear-gradient(135deg,#ecfdf5,#dcfce7);min-width:0;overflow:hidden':done&&wn1?'padding:10px;border:1.5px solid #fecaca;border-radius:12px;background:linear-gradient(135deg,#fff7f7,#fef2f2);min-width:0;overflow:hidden':'padding:10px;border:1.5px solid var(--border);border-radius:12px;background:#fff;min-width:0;overflow:hidden';
    const personalStatus = getPersonalMatchStatusLabel(key,m);
    const statusMainChip = `<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:${personalStatus.bg};border:1px solid ${personalStatus.border};font-size:.78rem;font-weight:900;color:${personalStatus.tone}">${personalStatus.text}</span>`;
    const statusSoonChip = getPersonalMatchStartSoonChip(personalStatus);
    return `<div class="m3card" id="${getMatchCardDomId(key,m.id)}" data-match-id="${m.id}" style="${done?(wn1?'border:2px solid #86efac;box-shadow:0 0 0 3px rgba(22,163,74,.08)':wn2?'border:2px solid #86efac;box-shadow:0 0 0 3px rgba(22,163,74,.08)':''):(MY_CLUB_FILTER?'':'border:1.5px solid var(--border);box-shadow:none')}">
      <div class="m3body" style="padding:12px 14px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span class="m3badge">${dl(div)}</span><span class="m3badge">${label||'1경기'}</span></div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">${statusMainChip}${statusSoonChip}${done?`<span class="badge bg-green" style="font-size:.78rem;padding:3px 9px">완료</span>`:''}${btn}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:10px">${groupCourtUI}${matchCourtUI}${matchMemoUI}${grpCourtShareBadges}</div>
        ${matchMemo?renderNoticeTicker(matchMemo,'📢 공지(경기)'):''}
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:stretch;margin-bottom:8px">
          <div style="${sideWrap1Style}">
            <div style="font-size:.74rem;font-weight:900;color:var(--primary);margin-bottom:6px">${sideLabel1}</div>
            <div style="padding:10px;border-radius:10px;background:#f8fafc;border:1px solid var(--border);text-align:center;line-height:1.35;min-width:0;overflow:hidden">
              <div style="font-size:.98rem;font-weight:900;color:var(--text);word-break:keep-all;overflow-wrap:anywhere">${label1Html}</div>
              ${m.t1!==null&&info1.clubs?`<div style="font-size:.62rem;color:#64748b;margin-top:4px;white-space:normal;line-height:1.25;word-break:keep-all;overflow-wrap:anywhere">${info1.clubs}</div>`:''}
              ${m.t1!==null?individualMiniStatHtml(stat1):''}
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:center;font-size:1.05rem;font-weight:900;color:var(--text3)">VS</div>
          <div style="${sideWrap2Style}">
            <div style="font-size:.74rem;font-weight:900;color:var(--primary);margin-bottom:6px">${sideLabel2}</div>
            <div style="padding:10px;border-radius:10px;background:#f8fafc;border:1px solid var(--border);text-align:center;line-height:1.35;min-width:0;overflow:hidden">
              <div style="font-size:.98rem;font-weight:900;color:var(--text);word-break:keep-all;overflow-wrap:anywhere">${label2Html}</div>
              ${m.t2!==null&&info2.clubs?`<div style="font-size:.62rem;color:#64748b;margin-top:4px;white-space:normal;line-height:1.25;word-break:keep-all;overflow-wrap:anywhere">${info2.clubs}</div>`:''}
              ${m.t2!==null?individualMiniStatHtml(stat2):''}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;font-size:1.1rem;font-weight:900;color:${done?(wn1?'var(--success)':wn2?'var(--danger)':'var(--primary)'):'var(--text2)'}">${done?`${dispSc1}:${dispSc2}`:'- : -'}</div>
      </div>
    </div>`;
  }

  // ── 조 코트(복수) 자동 표시: 예선 경기 카드에 "n조 코트: ..." 배지
  let grpCourtBadge = '';
  let grpCourtShareBadge = '';
  const matchMemo = getMatchMemoByObj(m);
  let matchMemoBadge = matchMemo ? renderNoticeTicker(matchMemo,'📢 공지(경기)',true) : '';
  if(m && m.phase==='group' && m.group!=null){
    const gi = m.group;
    const grpCourts = (G.draws[key]?.groups?.[gi]?.courts) || [];
    if(grpCourts.length){
      grpCourtBadge = `<span style="font-size:.88rem;font-weight:700;background:rgba(255,255,255,.22);color:white;padding:3px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.4)">🎾 ${grpLabel(gi)}: ${grpCourts.join('/')}</span>`;
      grpCourtShareBadge = getGroupCourtShareBadges(key, gi);
    } else if(AD){
      grpCourtBadge = `<span style="font-size:.88rem;font-weight:600;background:rgba(255,255,255,.12);color:rgba(255,255,255,.8);padding:3px 12px;border-radius:12px;border:1px dashed rgba(255,255,255,.45)">🎾 미배정</span>`;
    }
  }
  // 개별 경기 코트 상태 계산
  const mCourts = Array.isArray(m.courts) ? m.courts : (m.court ? [m.court] : []);
  // 이 경기보다 먼저 같은 코트가 배정된 미완료 경기 찾기 → 대기 코트 판별
  const allM = G.matches[key] || [];
  const waitingCourts = new Set(); // 내가 대기해야 하는 코트
  const myAssignedAt = m.courtAssignedAt || '';
  mCourts.forEach(c => {
    const blocker = allM.find(x =>
      x.id !== m.id &&
      x.winner == null &&
      (Array.isArray(x.courts) ? x.courts : (x.court ? [x.court] : [])).includes(c) &&
      (x.courtAssignedAt || '') < myAssignedAt
    );
    if(blocker) waitingCourts.add(c);
  });
  const activeCourts = mCourts.filter(c => !waitingCourts.has(c));
  const isWaiting = waitingCourts.size > 0 && activeCourts.length === 0;
  const isPartialWait = waitingCourts.size > 0 && activeCourts.length > 0;

  let courtLabel, courtBtnStyle;
  if(!mCourts.length){
    courtLabel = '🎾 코트배정';
    courtBtnStyle = 'padding:5px 14px;font-size:.88rem;white-space:nowrap;background:rgba(255,255,255,.1);color:rgba(255,255,255,.85);border:1.5px dashed rgba(255,255,255,.5);border-radius:999px;cursor:pointer';
  } else if(isWaiting){
    courtLabel = `⏳ 대기(${[...waitingCourts].join('/')})`;
    courtBtnStyle = 'padding:5px 14px;font-size:.88rem;white-space:nowrap;background:rgba(245,166,35,.3);color:#ffe082;border:1.5px solid rgba(245,166,35,.7);border-radius:999px;font-weight:700;cursor:pointer';
  } else if(isPartialWait){
    courtLabel = `🎾 ${activeCourts.join('/')} + ⏳${[...waitingCourts].join('/')}`;
    courtBtnStyle = 'padding:5px 14px;font-size:.88rem;white-space:nowrap;background:rgba(255,255,255,.2);color:white;border:1.5px solid rgba(255,255,255,.5);border-radius:999px;font-weight:700;cursor:pointer';
  } else {
    courtLabel = `🎾 ${mCourts.join('/')}`;
    courtBtnStyle = 'padding:5px 14px;font-size:.88rem;white-space:nowrap;background:rgba(255,255,255,.25);color:white;border:1.5px solid rgba(255,255,255,.6);border-radius:999px;font-weight:700;cursor:pointer';
  }
  const courtUI = canManageBracket()
    ? `<button style="${courtBtnStyle}" onclick="openMatchCourtModal('${key}','${m.id}')">${courtLabel}</button>`
    : (mCourts.length ? `<span style="font-size:.88rem;font-weight:700;background:${isWaiting?'rgba(245,166,35,.3)':'rgba(255,255,255,.22)'};color:${isWaiting?'#ffe082':'white'};padding:3px 12px;border-radius:12px;border:1px solid ${isWaiting?'rgba(245,166,35,.6)':'rgba(255,255,255,.4)'}">${courtLabel}</span>` : '');

  const st2=getMatchResultState(key,m);
  done=st2.done; sc1=st2.sc1; sc2=st2.sc2;
  const canDirEdit=canEditMatchByDirector(key,m);
  const useOrderHere=!!G.meta.onlineOrderEnabled && !isIndividualByKey(key);
  const _ost2 = useOrderHere ? getOnlineOrderState(key,m) : null;
  const _btnLabel = done
    ? '✏️ 결과수정'
    : useOrderHere
      ? (_ost2.bothSubmitted ? '📝 오더/기록확인입력' : (_ost2.mySubmitted ? '📝 오더/기록확인입력' : '📝 오더 입력·제출'))
      : '⚡ 결과입력';
  const _btnStyle = done ? 'btn-gray' : (useOrderHere ? (_ost2.bothSubmitted||_ost2.mySubmitted ? 'btn-primary' : 'btn-accent') : 'btn-accent');
  const btn=(AD||canDirEdit)?`<button class="btn ${_btnStyle}" style="padding:5px 12px;font-size:.77rem;white-space:nowrap" onclick="openM3('${key}','${m.id}')">${_btnLabel}</button>`:'';
  const memoBtn=canManageBracket()?`<button class="btn btn-outline" style="padding:5px 10px;font-size:.75rem;white-space:nowrap;background:#fff;color:${matchMemo?'#7a5600':'var(--primary-dark)'};border-color:${matchMemo?'#f6d365':'var(--border)'}" onclick="openMatchMemoModal('${key}','${m.id}')">📢 공지(경기)${matchMemo?' 수정':' 입력'}</button>`:'';
  const orderBadge=useOrderHere?getOnlineOrderStatusBadgeHTML(key,m):'';
  const orderTeamStatus=useOrderHere?getOnlineOrderTeamStatusHTML(key,m):'';
  const unlockBtn=(AD&&useOrderHere)?`<button class="btn btn-outline" style="padding:5px 10px;font-size:.75rem;white-space:nowrap;background:#fff;color:#8a6412;border-color:#d4a017" onclick="CM_key='${key}';CM_id='${m.id}';confirmUnlockOrder()">🔓 오더초기화</button>`:'';
  const _bc2=REG_CLUB?baseClub(REG_CLUB):'';
  const _tms2=G.teams[key]||[];
  const _tm1x=_tms2[m.t1]??_tms2.find(t=>t.id===m.t1||t.name===m.t1);
  const _tm2x=_tms2[m.t2]??_tms2.find(t=>t.id===m.t2||t.name===m.t2);
  const _isMyCM=MY_CLUB_FILTER&&_bc2&&((_tm1x&&baseClub(_tm1x.club||'')===_bc2)||(_tm2x&&baseClub(_tm2x.club||'')===_bc2));
  const _isOtherM=MY_CLUB_FILTER&&_bc2&&!_isMyCM;
  const teamCardStyleBase=`${_isMyCM?'border:2.5px solid #16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.15);':''}${_isOtherM?'opacity:0.35;':''}`;
  const teamWinTint=done&&wn1?'background:linear-gradient(135deg,#f7fff9,#eefbf3);border-color:#86efac;':done&&wn2?'background:linear-gradient(135deg,#fff7f7,#fef2f2);border-color:#fecaca;':'';
  return`<div class="m3card" id="${getMatchCardDomId(key,m.id)}" data-match-id="${m.id}" style="${teamCardStyleBase}${teamWinTint}"><div class="m3hdr ${divisionHeaderClass(div)}" style="${_isMyCM?'background:linear-gradient(90deg,#14532d,#166534)':''}"><div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><span class="m3badge">${dl(div)}</span><span class="m3badge">${label}</span><span style="font-size:1.08rem;font-weight:800">${dn1} vs ${dn2}</span></div><div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end">${grpCourtBadge} ${grpCourtShareBadge} ${matchMemoBadge} ${courtUI} ${orderBadge} ${done?'<span class="badge bg-green" style="font-size:.82rem;padding:3px 9px">완료</span>':(st2.started?`<span style="font-size:.82rem;opacity:.95;font-weight:700;color:#ffd166">진행중 ${st2.disp1??st2.sc1}:${st2.disp2??st2.sc2}</span>`:'<span style="font-size:.86rem;opacity:.8;font-weight:600">대기중</span>')} ${unlockBtn} ${memoBtn} ${btn}</div></div>
    <div class="m3body">
      ${matchMemo?renderNoticeTicker(matchMemo,'📢 공지(경기)'):''}${orderTeamStatus}${done?`<div class="m3sc-row"><div class="m3tnm ${wn1?'win':'lose'}">${wn1?'🏆 ':''} ${dn1}</div><div class="m3sc">${sc1}:${sc2}</div><div class="m3tnm ${wn2?'win':'lose'}">${dn2} ${wn2?' 🏆':''}</div></div>`:`<div style="text-align:center;color:var(--text3);font-size:.8rem;margin:${orderTeamStatus?'8px':'0'} 0 6px">경기 대기중</div>`}
    <div style="font-size:.7rem;font-weight:700;color:var(--text2);margin-bottom:5px">${dbl}복식 상세 (6게임 선취 승리 · 타이브렉)</div>
    <div class="rb-rows">${rbH}</div></div></div>`;
}


// ═══════════════════════════════════════════════════
//  전체 대진표 시각화 (그림형 브라켓)
// ═══════════════════════════════════════════════════
let BV = { tid: null, div: '__ALL__' };

function openBracketView(){
  const tid = ge('brTS')?.value;
  if(!tid){ toast('대회를 먼저 선택하세요','info'); return; }
  const t = G.tournaments.find(t=>t.id===tid);
  if(!t) return;
  BV.tid = tid;
  const divs = t.divisions || [];
  const tabsEl = ge('mBVTabs');
  const allTabs = ['__ALL__', ...divs];
  tabsEl.innerHTML = allTabs.map((d)=>`
    <button onclick="switchBVTab('${d}')" id="bvtab_${d}"
      style="padding:4px 12px;font-size:.75rem;border-radius:999px;border:1.5px solid rgba(255,255,255,.5);
             background:rgba(255,255,255,.15);color:white;cursor:pointer;transition:.2s">
      ${d==='__ALL__'?'전체':dl(d)}
    </button>`).join('');
  switchBVTab('__ALL__');
  om('mBracketView');
}

function switchBVTab(div){
  BV.div = div;
  document.querySelectorAll('[id^="bvtab_"]').forEach(b=>{
    const active = b.id === 'bvtab_'+div;
    b.style.background = active ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.15)';
    b.style.color = active ? '#1565c0' : 'white';
    b.style.fontWeight = active ? '700' : '400';
  });
  ge('mBVTitle').textContent = div==='__ALL__' ? `📊 전체 대진표` : `📊 ${dl(div)} 통합 대진표`;
  renderBracketView(BV.tid, div);
}

function renderCombinedBracketSection(tid, div){
  const key = tid+'_'+div;
  const teams = G.teams[key] || [];
  const draw = G.draws[key];
  const t = G.tournaments.find(t=>t.id===tid);
  const cfg = gDS(t, div);
  const allMs = G.matches[key] || [];
  const gMs = allMs.filter(m=>m.phase==='group');
  const playInMs = allMs.filter(m=>m.phase==='playin').sort((a,b)=>a.slot-b.slot);
  const mMs = allMs.filter(m=>m.phase==='main').sort((a,b)=>a.round-b.round||a.slot-b.slot);
  const bronzeMode=getThirdPlaceModeByKey(key);
  const bronzeMatch=(bronzeMode==='match')?ensureBronzeMatchForKey(key,false):getBronzeMatch(key);

  if(!draw){
    return `<div style="background:white;border-radius:16px;padding:18px;border:1px solid #e5e7eb;box-shadow:0 6px 20px rgba(0,0,0,.06)">
      <div style="font-size:1rem;font-weight:800;color:#1565c0;margin-bottom:8px">${dl(div)}</div>
      <div style="color:#666;padding:18px 0;text-align:center">아직 추첨이 진행되지 않았습니다</div>
    </div>`;
  }

  // 개인전이라도 draw.groups가 있으면 group_knockout처럼 처리
  const _isIndivKey = isIndividualByKey(key);
  const _hasDrawGroups = Array.isArray(draw.groups) && draw.groups.length > 0;
  const _isGroupKO = cfg.format==='group_knockout' || (_isIndivKey && _hasDrawGroups);

  let mainHTML = '';
  if(_isGroupKO){
    const pvCfg = cfg.format==='group_knockout' ? cfg : {...cfg, format:'group_knockout'};
    const pv = buildPreviewMainSlots(draw, pvCfg);
    if(pv.n>=2){
      const adv=draw.advance||cfg.advance||2;
      const grpCount=draw.groups?.length||0;
      if(mMs.length){
        if(playInMs.length){
          mainHTML += `<div class="card" style="margin-bottom:10px"><div class="card-title">🪣 진출전(똥통)</div>${playInMs.map((pm,idx)=>`<div style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;background:#fff8df;font-size:.82rem">${pm.source1Label || 'TBD'} vs ${pm.source2Label || 'TBD'}<div style="font-size:.72rem;color:var(--text3);margin-top:4px">승자 → ${pm.winnerLabel||'64강 합류'}</div></div>`).join('')}</div>`;
        }
        mainHTML += renderBracketTree(key,mMs,teams);
        if(bronzeMode==='match' && bronzeMatch){ const bst=getMatchResultState(key,bronzeMatch); const b1=bronzeMatch.t1!==null?teams[bronzeMatch.t1]:null; const b2=bronzeMatch.t2!==null?teams[bronzeMatch.t2]:null; mainHTML += `<div class="card" style="margin-top:10px"><div class="card-title">🥉 3·4위전</div>${mCard(bronzeMatch,key,b1?tdn(b1,key,bronzeMatch.t1):(bronzeMatch.t1===null?'TBD':'?'),b2?tdn(b2,key,bronzeMatch.t2):(bronzeMatch.t2===null?'TBD':'?'),bst.done,bst.sc1,bst.sc2,'3·4위전')}</div>`; }
        // 본선 확정 후에도 조별 연결구조 토글로 제공
        mainHTML += `<div style="margin-top:10px">
          <button class="btn btn-outline" style="font-size:.72rem;padding:4px 12px" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.textContent=this.nextElementSibling.style.display==='none'?'🌳 조별 본선 연결구조 보기':'🌳 조별 본선 연결구조 접기'">🌳 조별 본선 연결구조 보기</button>
          <div style="display:none;margin-top:8px">
            <div style="font-size:.75rem;color:var(--text2);margin-bottom:6px;padding:0 2px">각 조 몇 위가 어느 본선 슬롯에 배정됐는지 확인합니다.</div>
            <div style="background:linear-gradient(135deg,#fffdf5,#eef5ff);border:1.5px dashed var(--accent);border-radius:var(--radius-lg);padding:12px">
              ${renderMainPreviewHTML(pv.matchSlots,pv.n,true)}
            </div>
          </div>
        </div>`;
      } else {
        const isFixedPreview = ((draw.mainMode||'fixed')==='fixed');
        const redrawPreview = buildIndivRedrawPreviewData(draw.groups||[], draw.grpSize||2);
        const previewSlots = isFixedPreview ? (pv.matchSlots||[]) : (redrawPreview.matchSlots||[]);
        const previewPlayIns = isFixedPreview ? (pv.playInMatches||[]) : (redrawPreview.playInMatches||[]);
        const previewN = isFixedPreview ? (pv.n||0) : (redrawPreview.spec?.mainSize || pv.n || 0);
        const previewBadge = isFixedPreview
          ? `${adv}팀 진출 × ${grpCount}조 → ${pv.n}강`
          : `${adv}팀 진출 × ${grpCount}조 → 재추첨 후 확정`;
        const previewDesc = isFixedPreview
          ? '📌 본선 대진표는 예선 중에도 계속 보입니다. 지금은 구조 미리보기이고, 실제 배정은 본선 추첨 후 확정됩니다.'
          : '📌 본선을 재추첨으로 설정한 경우 예선 추첨 직후에는 본선 자리 배정을 미리 확정해서 보여주지 않습니다. 아래는 구조 미리보기만 표시되고, 실제 본선 배정은 본선 추첨 버튼을 눌렀을 때 확정됩니다.';
        mainHTML = `<div class="card" style="margin:0;background:linear-gradient(135deg,#fffdf5,#eef5ff);border:1.5px dashed var(--accent)">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px">
            <div class="card-title" style="color:var(--primary-dark);margin:0">🌳 ${isFixedPreview ? '미리보기' : '재추첨 구조 미리보기'}</div>
            <span class="badge" style="background:var(--accent);color:#fff;font-size:.72rem">${previewBadge}</span>
          </div>
          <div style="font-size:.75rem;color:var(--text2);margin-bottom:10px;line-height:1.6">${previewDesc}</div>
          ${renderMainPreviewHTML(previewSlots,previewN,true,previewPlayIns)}
        </div>`;
      }
    } else {
      if(mMs.length) mainHTML = renderBracketTree(key,mMs,teams);
      else mainHTML = `<div class="card" style="margin:0"><div class="empty-state" style="padding:28px"><p>본선 대진표 데이터가 없습니다</p></div></div>`;
    }
  } else if(mMs.length){
    mainHTML = renderBracketTree(key,mMs,teams);
    if(bronzeMode==='match' && bronzeMatch){ const bst=getMatchResultState(key,bronzeMatch); const b1=bronzeMatch.t1!==null?teams[bronzeMatch.t1]:null; const b2=bronzeMatch.t2!==null?teams[bronzeMatch.t2]:null; mainHTML += `<div class="card" style="margin-top:10px"><div class="card-title">🥉 3·4위전</div>${mCard(bronzeMatch,key,b1?tdn(b1,key,bronzeMatch.t1):(bronzeMatch.t1===null?'TBD':'?'),b2?tdn(b2,key,bronzeMatch.t2):(bronzeMatch.t2===null?'TBD':'?'),bst.done,bst.sc1,bst.sc2,'3·4위전')}</div>`; }
  }

  let groupsHTML = '';
  if(draw.groups?.length){
    groupsHTML = `<div style="display:flex;flex-wrap:wrap;gap:12px">`;
    draw.groups.forEach((grp, gi)=>{
      const grpMs = gMs.filter(m=>m.group===gi);
      const stats = calcGS(key, gi, grp.teams, teams);
      const grpDone = grpMs.length>0 && grpMs.every(m=>getMatchResultState(key,m).done);
      const adv = cfg.advance || 2;
      const grpCourts = getGroupDisplayCourts(key, gi);
      const grpCourtLine = grpCourts.length
        ? `<div style="margin:8px 0 10px;padding:7px 10px;border-radius:10px;background:#f8fbff;border:1px solid #dbeafe;font-size:.72rem;font-weight:800;color:#1565c0;line-height:1.5">🎾 배정 코트: ${grpCourts.join(' / ')}</div>`
        : `<div style="margin:8px 0 10px;padding:7px 10px;border-radius:10px;background:#f8fafc;border:1px dashed #cbd5e1;font-size:.72rem;font-weight:700;color:#64748b;line-height:1.5">🎾 배정 코트: 미배정</div>`;
      groupsHTML += `<div style="background:white;border-radius:12px;border:1px solid #dbeafe;box-shadow:0 2px 10px rgba(21,101,192,.08);min-width:220px;flex:1;overflow:hidden">
        <div style="background:linear-gradient(90deg,#1565c0,#1e88e5);color:white;padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div style="font-weight:800">${grpLabel(gi)}</div>
          <div style="font-size:.68rem;display:flex;gap:4px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
            ${grpCourts.length ? `<span style="background:rgba(255,255,255,.22);padding:2px 8px;border-radius:999px;font-weight:800">🎾 ${grpCourts.join(' / ')}</span>` : `<span style="background:rgba(255,255,255,.14);padding:2px 8px;border-radius:999px">코트 미배정</span>`}
            <span style="background:${grpDone?'#43a047':'rgba(255,255,255,.18)'};padding:2px 6px;border-radius:999px">${grpDone?'완료':'진행중'}</span>
          </div>
        </div>
        <div style="padding:10px 12px">
          ${grpCourtLine}
          ${stats.map((s,r)=>{
            const isAdv = grpDone && r<adv;
            return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:${r<stats.length-1?'1px solid #f1f5f9':'none'}">
              <div style="display:flex;align-items:center;gap:8px;min-width:0">
                <span style="font-size:.9rem">${r+1}</span>
                <span style="font-weight:${isAdv?'800':'500'};color:${isAdv?'#1565c0':'#1f2937'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.nm}</span>
              </div>
              <div style="display:flex;gap:5px;align-items:center;white-space:nowrap">
                <span style="font-size:.68rem;color:#64748b">${s.w}승 ${s.l}패</span>
                ${isAdv?`<span style="font-size:.62rem;background:${r===0?'#1565c0':'#e67e22'};color:white;padding:2px 6px;border-radius:999px">${grpLabel(gi)} ${r+1}위</span>`:''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    });
    groupsHTML += `</div>`;
  } else {
    groupsHTML = `<div class="card" style="margin:0"><div class="empty-state" style="padding:24px"><p>예선 조별 데이터가 없습니다</p></div></div>`;
  }

  const rightTitle = mMs.length ? '🏆 본선 나무가지 대진표' : '🏆 본선 나무가지 미리보기';

  return `<div style="background:linear-gradient(180deg,#f8fbff,#ffffff);border-radius:18px;padding:16px;border:1px solid #dbeafe;box-shadow:0 8px 24px rgba(0,0,0,.07);margin-bottom:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <div>
        <div style="font-size:1rem;font-weight:900;color:#1565c0">${t.name} · ${dl(div)}</div>
        <div style="font-size:.74rem;color:#64748b">예선 + 본선을 한 화면에서 함께 보는 통합 대진표</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span style="background:#1565c0;color:white;padding:4px 10px;border-radius:999px;font-size:.68rem;font-weight:700">예선 ${draw.groups?.length||0}조</span>
        <span style="background:#e67e22;color:white;padding:4px 10px;border-radius:999px;font-size:.68rem;font-weight:700">${mMs.length?'본선 진행':'본선 미리보기'}</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(320px,1.1fr) 44px minmax(360px,1.4fr);gap:12px;align-items:start">
      <div>
        <div style="font-size:.84rem;font-weight:800;color:#1565c0;margin-bottom:8px">📋 예선 조별 현황</div>
        ${groupsHTML}
      </div>
      <div style="display:flex;align-items:center;justify-content:center;min-height:220px;color:#94a3b8;font-size:1.6rem;font-weight:900">➜</div>
      <div>
        <div style="font-size:.84rem;font-weight:800;color:#e67e22;margin-bottom:8px">${rightTitle}</div>
        ${mainHTML}
      </div>
    </div>
  </div>`;
}

function renderBracketView(tid, div){
  const body = ge('mBVBody');
  const t = G.tournaments.find(t=>t.id===tid);
  if(!t){ body.innerHTML='<div style="text-align:center;padding:40px;color:#666">대회 정보를 찾을 수 없습니다</div>'; return; }

  if(div==='__ALL__'){
    const sections = (t.divisions||[]).map(d=>renderCombinedBracketSection(tid,d)).join('');
    body.innerHTML = `<div id="bvContent" style="min-width:920px">${sections || '<div style="text-align:center;padding:40px;color:#666">표시할 부서가 없습니다</div>'}</div>`;
    return;
  }

  body.innerHTML = `<div id="bvContent" style="min-width:920px">${renderCombinedBracketSection(tid,div)}</div>`;
}

async function saveBracketViewImage(){
  const el = ge('bvContent');
  if(!el){ toast('대진표를 먼저 열어주세요','info'); return; }
  try{
    if(!window.html2canvas){
      await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
    }
    toast('이미지 생성 중...','info');
    const canvas = await html2canvas(el, {backgroundColor:'#f0f4fa', scale:3, useCORS:true});
    const a = document.createElement('a');
    a.download = `대진표_${BV.div||''}_${new Date().toISOString().substring(0,10)}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    toast('이미지 저장 완료 🖼️','success');
  }catch(e){ toast('이미지 저장 실패: '+e.message,'error'); }
}


function getRoundTheme(roundIndex,totalRounds){
  const ri = Number(roundIndex||0);
  const total = Math.max(1, Number(totalRounds||1));
  const finals = { titleBg:'linear-gradient(135deg,#d4a017,#f3c746)', titleClr:'#5a3a00' };
  const semis  = { titleBg:'linear-gradient(135deg,#1d4ed8,#2563eb)', titleClr:'#ffffff' };
  const early  = { titleBg:'linear-gradient(135deg,#0f1e3a,#1b2f5a)', titleClr:'#ffffff' };
  const mid    = { titleBg:'linear-gradient(135deg,#334155,#475569)', titleClr:'#ffffff' };
  if(ri >= total - 1) return finals;
  if(total >= 3 && ri === total - 2) return semis;
  if(ri === 0) return early;
  return mid;
}

function getRoundCardTheme(roundIndex,totalRounds){
  // 색약 친화: 라운드 구분은 색상이 아닌 테두리 굵기/명도로만 처리
  // 결승(금색 강조) / 준결승~이하(네이비 블루 계열 명도 단계)
  const ri = Number(roundIndex||0);
  const total = Math.max(1, Number(totalRounds||1));
  const roundSize = Math.pow(2, total - ri);
  // 결승
  if(ri >= total - 1 || roundSize === 2){
    return {
      cardBg:'#fff8e6', cardAltBg:'#fffdf5', cardBorder:'#d4a017',
      slotWinBg:'linear-gradient(to right,#b8860b 4px,#fff3cc 4px)', winColor:'#7a5500',
      mutedColor:'#888', lineColor:'#d4a017'
    };
  }
  // 준결승
  if(total >= 3 && ri === total - 2){
    return {
      cardBg:'#eef2ff', cardAltBg:'#f5f8ff', cardBorder:'#1d4ed8',
      slotWinBg:'linear-gradient(to right,#1d4ed8 4px,#dbeafe 4px)', winColor:'#1e3a8a',
      mutedColor:'#6b85b8', lineColor:'#1d4ed8'
    };
  }
  // 8강
  if(roundSize === 8){
    return {
      cardBg:'#f0f4ff', cardAltBg:'#f7faff', cardBorder:'#4066c0',
      slotWinBg:'linear-gradient(to right,#3355b0 4px,#dce4f8 4px)', winColor:'#1e3070',
      mutedColor:'#7a90bb', lineColor:'#4066c0'
    };
  }
  // 16강
  if(roundSize === 16){
    return {
      cardBg:'#f3f6fc', cardAltBg:'#f9fbff', cardBorder:'#6080b8',
      slotWinBg:'linear-gradient(to right,#4060a8 4px,#e0e8f8 4px)', winColor:'#2a4080',
      mutedColor:'#8fa0c0', lineColor:'#6080b8'
    };
  }
  // 32강 이상
  return {
    cardBg:'#f6f8fc', cardAltBg:'#ffffff', cardBorder:'#8aa0c8',
    slotWinBg:'linear-gradient(to right,#5070a8 4px,#e4ecf8 4px)', winColor:'#304870',
    mutedColor:'#9db0c8', lineColor:'#8aa0c8'
  };
}

function renderBracketTree(key,mMs,teams){
  // round 값이 문자열/숫자 혼용으로 저장될 수 있으므로 Number()로 정규화
  let normalizedMs = mMs.map(m=>({...m, round: Number(m.round||0), slot: Number(m.slot||0)}));

  // ── 본선 라운드 정보가 망가진 경우 강제 복원 ───────────────────────────
  // v48 시드 보호 반영 후 일부 데이터에서 round가 전부 0으로 저장되거나,
  // 불완전한 라운드 정보만 남아 "결승만 보이는" 현상이 발생할 수 있어
  // match 개수 기준으로 전체 토너먼트 라운드를 다시 계산한다.
  {
    const mc = normalizedMs.length;
    const expectedRounds = Math.max(1, Math.round(Math.log2(mc + 1)));
    const uniqueRounds = [...new Set(normalizedMs.map(m=>m.round).filter(v=>Number.isFinite(v)))].sort((a,b)=>a-b);
    const uniqueCount = uniqueRounds.length;

    const needRebuild =
      mc > 1 && (
        uniqueCount <= 1 ||
        uniqueCount < expectedRounds ||
        uniqueRounds.some(v => v < 0 || v > expectedRounds - 1)
      );

    if(needRebuild){
      normalizedMs = [...normalizedMs].sort((a,b)=>{
        const ida = String(a.id||'');
        const idb = String(b.id||'');
        const ma = ida.match(/main_r(\d+)_([0-9]+)/);
        const mb = idb.match(/main_r(\d+)_([0-9]+)/);
        if(ma && mb){
          const ra = parseInt(ma[1],10), rb = parseInt(mb[1],10);
          if(ra !== rb) return ra - rb;
          return parseInt(ma[2],10) - parseInt(mb[2],10);
        }
        if(ma) return -1;
        if(mb) return 1;
        if(a.round !== b.round) return a.round - b.round;
        return a.slot - b.slot;
      });

      const rebuilt = [];
      let idx = 0;
      let count = Math.max(1, Math.floor((mc + 1) / 2)); // 첫 라운드 경기 수 = n/2
      let roundNo = 0;

      while(count >= 1 && idx < normalizedMs.length){
        for(let s = 0; s < count && idx < normalizedMs.length; s++, idx++){
          rebuilt.push({...normalizedMs[idx], round: roundNo, slot: s});
        }
        count = Math.floor(count / 2);
        roundNo++;
      }
      normalizedMs = rebuilt;
    }
  }

  const roundNums=[...new Set(normalizedMs.map(m=>m.round))].sort((a,b)=>a-b);
  const totalR=roundNums.length;
  if(!totalR) return '';

  // ── 상수 ───────────────────────────────────────────────
  const CARD_H  = 72;
  const CARD_W  = 168;
  const COL_GAP = 48;
  const ROW_GAP = 14;   // 같은 라운드 카드 간 세로 간격
  const TITLE_H = 28;
  const COL_W   = CARD_W + COL_GAP;

  // 각 라운드 경기 목록 (Number() 변환으로 비교)
  const roundsMs = roundNums.map(r => normalizedMs.filter(m=>m.round===r).sort((a,b)=>a.slot-b.slot));
  // rounds는 라운드 인덱스 배열 (titlesHtml 등에서 사용)
  const rounds = roundNums;
  const firstCount = roundsMs[0].length;

  // 전체 높이 (첫 라운드 기준)
  const totalH = firstCount * CARD_H + Math.max(0, firstCount - 1) * ROW_GAP;

  // ── 각 라운드별 카드 Y 중심 계산 ──────────────────────
  // 첫 라운드: 균등 배치
  const firstCenters = Array.from({length: firstCount}, (_, i) =>
    i * (CARD_H + ROW_GAP) + CARD_H / 2
  );

  // 후속 라운드: 이전 라운드 pair(2개씩)의 중간값으로 결정
  // → 토너먼트 구조상 정확히 연결선 중심에 카드가 옴
  const centersByRound = [firstCenters];
  for(let ri = 1; ri < totalR; ri++){
    const prev = centersByRound[ri - 1];
    const cur  = [];
    for(let i = 0; i < prev.length; i += 2){
      const y1 = prev[i];
      const y2 = (i + 1 < prev.length) ? prev[i + 1] : y1;
      cur.push((y1 + y2) / 2);
    }
    // 실제 이 라운드 경기 수에 맞게 clamp
    const actual = roundsMs[ri]?.length || cur.length;
    centersByRound.push(cur.slice(0, actual));
  }

  const svgW = totalR * COL_W - COL_GAP + 4;
  const svgH = totalH + TITLE_H + 16;

  // ── SVG 연결선 ────────────────────────────────────────
  function getWinnerOf(rIdx, mIdx){
    const m = roundsMs[rIdx]?.[mIdx];
    if(!m) return null;
    const st = getMatchResultState(key, m);
    return st.done ? st.winner : null;
  }

  function getResolvedBracketSideName(rIdx, side, m, fallback){
    if(rIdx===0){
      return fallback || 'TBD';
    }
    const prevRound=roundsMs[rIdx-1]||[];
    const parentSlot=Number(m?.slot||0)*2 + (side===1?0:1);
    const parent=prevRound[parentSlot];
    if(!parent) return 'TBD';
    const parentState=getMatchResultState(key, parent);
    if(parentState?.done && parentState.winner!=null){
      const winTeam=teams[parentState.winner];
      return winTeam ? getMainBracketDisplayName(key, winTeam, parentState.winner) : 'TBD';
    }
    if(parent.bye && parent.winner!=null){
      const byeTeam=teams[parent.winner];
      return byeTeam ? getMainBracketDisplayName(key, byeTeam, parent.winner) : 'TBD';
    }
    return 'TBD';
  }

  let svgLines = '';
  for(let r = 0; r < totalR - 1; r++){
    const curCenters  = centersByRound[r];
    const nextCenters = centersByRound[r + 1];
    const xRight = r * COL_W + CARD_W;
    const xMid   = xRight + COL_GAP / 2;
    const xLeft  = (r + 1) * COL_W;

    for(let i = 0; i < curCenters.length; i += 2){
      const y1 = curCenters[i] + TITLE_H + 4;
      const y2 = (i + 1 < curCenters.length) ? curCenters[i + 1] + TITLE_H + 4 : y1;
      const nextIdx = Math.floor(i / 2);
      const yNext  = (nextCenters[nextIdx] ?? (y1 + y2) / 2) + TITLE_H + 4;
      const yMidV  = (y1 + y2) / 2;

      const w1 = getWinnerOf(r, i);
      const w2 = getWinnerOf(r, i + 1);
      const hasWin1 = w1 !== null && w1 !== undefined;
      const hasWin2 = w2 !== null && w2 !== undefined;
      const anyWin  = hasWin1 || hasWin2;

      const lineClr1 = hasWin1 ? '#1565c0' : '#c8d4e8';
      const lineClr2 = hasWin2 ? '#1565c0' : '#c8d4e8';
      const lineSW1  = hasWin1 ? 3 : 2;
      const lineSW2  = hasWin2 ? 3 : 2;
      const vertClr  = anyWin  ? '#1565c0' : '#c8d4e8';
      const vertSW   = anyWin  ? 3 : 2;

      svgLines += `<line x1="${xRight}" y1="${y1}" x2="${xMid}" y2="${y1}" stroke="${lineClr1}" stroke-width="${lineSW1}"/>`;
      if(i + 1 < curCenters.length){
        svgLines += `<line x1="${xRight}" y1="${y2}" x2="${xMid}" y2="${y2}" stroke="${lineClr2}" stroke-width="${lineSW2}"/>`;
      }
      svgLines += `<line x1="${xMid}" y1="${y1}" x2="${xMid}" y2="${y2}" stroke="${vertClr}" stroke-width="${vertSW}"/>`;
      svgLines += `<line x1="${xMid}" y1="${yMidV}" x2="${xLeft}" y2="${yNext}" stroke="${vertClr}" stroke-width="${vertSW}"/>`;
    }
  }

  // ── 경기 카드 HTML ────────────────────────────────────
  let cardsHtml = '';

  rounds.forEach((r, ri) => {
    const rms     = roundsMs[ri];
    const centers = centersByRound[ri];
    const isFinal = ri === totalR - 1;
    const xLeft   = ri * COL_W;

    rms.forEach((m, mi) => {
      const cy  = (centers[mi] ?? 0) + TITLE_H + 4;
      const top = cy - CARD_H / 2;

      const mt1 = m.t1 !== null ? teams[m.t1] : null;
      const mt2 = m.t2 !== null ? teams[m.t2] : null;
      const useSource1 = (m.round===0 && (m.source1Label||'')) || m.phase==='playin';
      const useSource2 = (m.round===0 && (m.source2Label||'')) || m.phase==='playin';
      const rawDn1 = useSource1 ? (getMainBracketSourceLabel(key, m.source1Label||'TBD')||'TBD') : (mt1 ? getMainBracketDisplayName(key,mt1,m.t1) : (getMainBracketSourceLabel(key, (m.source1Label||'')) || (m.t1===null&&!m.bye ? 'TBD' : '?')));
      const rawDn2 = useSource2 ? (getMainBracketSourceLabel(key, m.source2Label||'TBD')||'TBD') : (mt2 ? getMainBracketDisplayName(key,mt2,m.t2) : (getMainBracketSourceLabel(key, (m.source2Label||'')) || 'TBD'));
      const dn1 = getResolvedBracketSideName(ri, 1, m, rawDn1);
      const dn2 = getResolvedBracketSideName(ri, 2, m, rawDn2);
      const st  = getMatchResultState(key, m);
      const done=st.done, wn1=done&&st.winner===m.t1, wn2=done&&st.winner===m.t2;
      const sc1=(st.disp1 ?? st.sc1), sc2=(st.disp2 ?? st.sc2);
      const hasWinner = done && (wn1 || wn2);

      const roundTheme = getRoundCardTheme(ri, totalR);
      const borderClr = hasWinner ? roundTheme.winColor : (roundTheme.cardBorder || (isFinal ? '#d4a017' : '#d5dbea'));
      const shadowClr = hasWinner ? `0 0 0 1.5px ${roundTheme.lineColor || borderClr}44,0 2px 8px rgba(15,30,58,.10)` : '0 1px 6px rgba(15,30,58,.07)';

      if(m.bye){
        const byeEntryLabel = String(m.source1Label || '').trim();
        const byeTeam = mt1 ? getMainBracketDisplayName(key,mt1,m.t1) : (getMainBracketSourceLabel(key, byeEntryLabel) || '?');
        cardsHtml += `<div style="position:absolute;left:${xLeft}px;top:${top}px;width:${CARD_W}px;border:1.5px solid #d4a017;border-radius:7px;overflow:hidden;background:white;box-shadow:${shadowClr}">
          <div style="display:flex;align-items:center;padding:5px 9px;min-height:34px;background:linear-gradient(to right,#1565c0 3px,#dce8fb 3px)">
            <span style="font-size:.78rem;font-weight:800;color:#0c3880;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">👑 ${byeTeam}</span>
            <span style="font-size:.6rem;background:var(--accent);color:#5a3a00;padding:1px 6px;border-radius:5px;font-weight:700;flex-shrink:0;white-space:nowrap">부전승</span>
          </div>
          <div style="display:flex;align-items:center;padding:5px 9px;min-height:34px;background:#f8f9fb;border-top:1px solid #e5eaf3">
            <span style="font-size:.7rem;color:#94a3b8;font-style:italic">${byeEntryLabel ? '입력 자리: ' + byeEntryLabel + ' → 다음 라운드 직행' : '다음 라운드 직행 →'}</span>
          </div>
        </div>`;
        return;
      }

      const slot1Bg  = wn1 ? roundTheme.slotWinBg : wn2 ? roundTheme.cardAltBg : roundTheme.cardBg;
      const slot2Bg  = wn2 ? roundTheme.slotWinBg : wn1 ? roundTheme.cardAltBg : '#fff';
      const slot1Clr = wn1 ? roundTheme.winColor : wn2 ? roundTheme.mutedColor : 'var(--text)';
      const slot2Clr = wn2 ? roundTheme.winColor : wn1 ? roundTheme.mutedColor : 'var(--text)';
      const slot1Fw  = wn1 ? 800 : 500;
      const slot2Fw  = wn2 ? 800 : 500;
      const slot1Op  = wn2 ? '.45' : '1';
      const slot2Op  = wn1 ? '.45' : '1';
      const courtChip = getBracketTreeCourtStatusChip(key,m);
      const chipHtml = courtChip ? `<div style="position:absolute;left:6px;right:6px;top:6px;display:flex;justify-content:flex-start;pointer-events:none;z-index:2"><span class="${courtChip.kind==='live'?'live-blink':''}" style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;font-size:.62rem;font-weight:900;line-height:1;background:${courtChip.kind==='live'?'#dcfce7':'#fff7ed'};color:${courtChip.kind==='live'?'#166534':'#9a3412'};border:1px solid ${courtChip.kind==='live'?'#86efac':'#fdba74'};box-shadow:0 2px 6px rgba(15,30,58,.12)">${courtChip.text}</span></div>` : '';

      cardsHtml += `<div style="position:absolute;left:${xLeft}px;top:${top}px;width:${CARD_W}px;border:1.5px solid ${borderClr};border-left:4px solid ${borderClr};border-radius:7px;overflow:hidden;background:${roundTheme.cardAltBg};box-shadow:${shadowClr}">
        ${chipHtml}
        <div style="display:flex;align-items:center;padding:${courtChip?'18px 9px 5px':'5px 9px'};min-height:${courtChip?47:34}px;background:${slot1Bg};opacity:${slot1Op}">
          <span style="font-size:.78rem;font-weight:${slot1Fw};color:${slot1Clr};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${wn1?'🏆 ':''}${dn1}</span>
          ${sc1!==null?`<span style="font-family:'Oswald',sans-serif;font-weight:800;font-size:.9rem;color:${wn1?roundTheme.winColor:roundTheme.mutedColor};min-width:22px;text-align:right;flex-shrink:0">${sc1}</span>`:''}
        </div>
        <div style="display:flex;align-items:center;padding:5px 9px;min-height:34px;background:${slot2Bg};border-top:1px solid #e5eaf3;opacity:${slot2Op}">
          <span style="font-size:.78rem;font-weight:${slot2Fw};color:${slot2Clr};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${wn2?'🏆 ':''}${dn2}</span>
          ${sc2!==null?`<span style="font-family:'Oswald',sans-serif;font-weight:800;font-size:.9rem;color:${wn2?'#0c3880':'#94a3b8'};min-width:22px;text-align:right;flex-shrink:0">${sc2}</span>`:''}
        </div>
      </div>`;
    });
  });

  // ── 라운드 타이틀 ─────────────────────────────────────
  let titlesHtml = '';
  rounds.forEach((r, ri) => {
    const x     = ri * COL_W;
    const isFin = ri === totalR - 1;
    const lbl   = isFin ? '결승' : ri === totalR - 2 && totalR > 2 ? '준결승' : `${Math.pow(2, totalR - ri)}강`;
    const th    = getRoundTheme(ri, totalR);
    titlesHtml += `<div style="position:absolute;left:${x}px;top:0;width:${CARD_W}px;background:${th.titleBg};color:${th.titleClr};text-align:center;padding:5px 4px;border-radius:4px 4px 0 0;font-size:.7rem;font-weight:700">${lbl}</div>`;
  });

  // ── 시상 ─────────────────────────────────────────────
  const fm = getMainFinalMatch(mMs);
  const bronzeMode  = getThirdPlaceModeByKey(key);
  const bronzeMatch = (bronzeMode==='match') ? ensureBronzeMatchForKey(key,false) : getBronzeMatch(key);
  let awardHtml = '';
  if(fm?.winner != null){
    const c = teams[fm.winner];
    const sharedThirdIdxs = getSharedThirdTeamIndexes(key,teams,mMs);
    const loserIdx = fm.winner===fm.t1 ? fm.t2 : fm.t1;
    const runner = teams[loserIdx];
    let thirdHtml = '';
    if(bronzeMode==='match' && bronzeMatch && bronzeMatch.winner!=null && !bronzeMatch.bye){
      const ti3=bronzeMatch.winner, ti4=bronzeMatch.winner===bronzeMatch.t1?bronzeMatch.t2:bronzeMatch.t1;
      if(ti3!=null&&teams[ti3]) thirdHtml+=`<div class="t-champ" style="padding:8px 12px"><div style="font-size:1.1rem">🥉</div><div style="font-weight:700;font-size:.78rem;margin-top:3px">${tdn(teams[ti3],key,ti3)}</div><div style="font-size:.62rem;color:var(--text2)">3위</div></div>`;
      if(ti4!=null&&teams[ti4]) thirdHtml+=`<div class="t-champ" style="padding:8px 12px"><div style="font-size:1rem">4️⃣</div><div style="font-weight:700;font-size:.78rem;margin-top:3px">${tdn(teams[ti4],key,ti4)}</div><div style="font-size:.62rem;color:var(--text2)">4위</div></div>`;
    } else if(sharedThirdIdxs.length){
      thirdHtml=`<div class="t-champ" style="padding:8px 12px"><div style="font-size:1.1rem">🥉</div><div style="font-weight:700;font-size:.78rem;margin-top:3px">${sharedThirdIdxs.map(idx=>teams[idx]?tdn(teams[idx],key,idx):'').filter(Boolean).join(' · ')}</div><div style="font-size:.62rem;color:var(--text2)">공동 3위</div></div>`;
    }
    awardHtml=`<div class="t-round" style="min-width:120px"><div class="t-rtitle" style="background:var(--accent);margin-right:4px">🏆 시상</div><div class="t-matches" style="gap:8px">
      <div class="t-champ"><div style="font-size:1.5rem">🥇</div><div style="font-weight:800;font-size:.85rem;color:#5a3a00;margin-top:3px">${c?tdn(c,key,fm.winner):'?'}</div><div style="font-size:.62rem;color:var(--text2)">우승</div></div>
      ${runner?`<div class="t-champ" style="padding:8px 12px"><div style="font-size:1.3rem">🥈</div><div style="font-weight:700;font-size:.82rem;margin-top:3px">${tdn(runner,key,loserIdx)}</div><div style="font-size:.62rem;color:var(--text2)">준우승</div></div>`:''}
      ${thirdHtml}
    </div></div>`;
  } else if(totalR > 0){
    awardHtml=`<div class="t-round" style="min-width:120px"><div class="t-rtitle" style="background:var(--accent);margin-right:4px">🏆 시상</div><div class="t-matches"><div class="t-champ"><div style="font-size:1.2rem">🥇🥈🥉</div><div style="font-size:.7rem;color:var(--text3);margin-top:4px">경기 진행 중</div></div></div></div>`;
  }

  const focusRoundIndex=getBracketTreeFocusRoundIndex(key, roundsMs);
  const focusLeft=focusRoundIndex * COL_W;
  return `<div class="card" style="padding:8px 4px"><div class="js-main-tree-scroll" data-key="${key}" data-focus-round="${focusRoundIndex}" data-focus-left="${focusLeft}" style="overflow-x:auto;padding-bottom:8px"><div style="display:flex;align-items:flex-start;gap:0">
    <div style="position:relative;width:${svgW}px;height:${svgH}px;min-width:${svgW}px;flex-shrink:0">
      ${titlesHtml}
      <svg style="position:absolute;left:0;top:0;width:${svgW}px;height:${svgH}px;overflow:visible;pointer-events:none" xmlns="http://www.w3.org/2000/svg">${svgLines}</svg>
      ${cardsHtml}
    </div>
    ${awardHtml ? `<div style="margin-left:16px;margin-top:${TITLE_H}px;flex-shrink:0">${awardHtml}</div>` : ''}
  </div></div></div>`;
}

function getIndividualTieAge(team){
  const age=Number(team?.tiebreakAge||team?.tieBreakAge||team?.ageTie||0)||0;
  return age>0?age:0;
}
function getIndividualTieLabel(rank){
  return `공동${rank}위`;
}
async function openIndividualTieAgePrompt(key,gi){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 입력할 수 있습니다','info'); return; }
  const grp=G.draws?.[key]?.groups?.[Number(gi)];
  const tids=Array.isArray(grp?.teams)?grp.teams:[];
  const teams=G.teams[key]||[];
  if(!tids.length){ toast('대상 조가 없습니다','error'); return; }
  for(const ti of tids){
    const team=teams[ti];
    if(!team) continue;
    const title=tdn(team,key,ti)||`참가자 ${ti+1}`;
    const prev=getIndividualTieAge(team);
    const input=prompt(`${grpLabel(gi)} 동률 정렬용 대표 나이를 입력하세요.

${title}
(숫자만 입력, 비워두면 미입력 유지)`, prev?String(prev):'');
    if(input===null) continue;
    const v=String(input).trim();
    if(!v){ delete team.tiebreakAge; continue; }
    const age=Number(v.replace(/[^0-9]/g,''));
    if(!Number.isFinite(age) || age<=0){ toast('나이는 숫자로 입력하세요','error'); return; }
    team.tiebreakAge=age;
  }
  sl(true);
  try{
    await stT(key);
    sl(false);
    renderBracket();
    toast('동률 정렬용 나이 저장 완료 ✅','success');
  }catch(e){
    sl(false);
    toast('저장 실패: '+e.message,'error');
  }
}
window.openIndividualTieAgePrompt = openIndividualTieAgePrompt;

function calcGS(key,gi,tidxs,teams){
  const indivMode=isIndividualByKey(key);
  const rows=tidxs.map((ti,slotIdx)=>{
    const tm=teams[ti];let w=0,l=0,gw=0,gl=0,played=0;
    (G.matches[key]||[]).filter(m=>m.phase==='group'&&m.group===gi&&(m.t1===ti||m.t2===ti)).forEach(m=>{
      const isT1=m.t1===ti;
      const rubbers=Array.isArray(m.rubbers)?m.rubbers:[];
      const hasRealScore=rubbers.some(rb=>rb&&((rb.score1!=null&&rb.score1!=='')||(rb.score2!=null&&rb.score2!=='')));
      if(!hasRealScore) return;
      played++;
      if(indivMode){
        const rb=rubbers[0]||{};
        const sFor=Number(isT1?(rb.score1||0):(rb.score2||0));
        const sAg=Number(isT1?(rb.score2||0):(rb.score1||0));
        gw+=sFor; gl+=sAg;
      }else{
        const sc=rbSc(m,isT1?0:1),scO=rbSc(m,isT1?1:0);
        gw+=sc; gl+=scO;
      }
      if(m.winner===ti) w++; else if(m.winner!=null) l++;
    });
    return{ti,teamIdx:ti,nm:tdn(tm,key,ti),w,l,gw,gl,pf:gw,pa:gl,diff:gw-gl,slot:slotIdx+1,played,age:getIndividualTieAge(tm),rank:null,rankLabel:'',tiePending:false};
  });
  const hasAnyScore=rows.some(r=>Number(r.played||0)>0);
  if(!hasAnyScore){
    return rows.map((row,idx)=>({...row, rank:null, rankLabel:`${row.slot||idx+1}번`}));
  }
  if(!indivMode){
    const sorted=rows.slice().sort((a,b)=>b.w-a.w||b.diff-a.diff||a.slot-b.slot);
    return sorted.map((row,idx)=>({...row, rank:idx+1, rankLabel:`${idx+1}위`}));
  }
  const sorted=rows.slice().sort((a,b)=>b.w-a.w||b.diff-a.diff||a.slot-b.slot);
  let idx=0;
  let nextRank=1;
  while(idx<sorted.length){
    let j=idx+1;
    while(j<sorted.length && sorted[j].w===sorted[idx].w && sorted[j].diff===sorted[idx].diff) j++;
    const group=sorted.slice(idx,j);
    if(group.length===1){
      group[0].rank=nextRank;
      group[0].rankLabel=`${nextRank}위`;
    }else{
      const allHaveAge=group.every(r=>Number(r.age||0)>0);
      if(allHaveAge){
        group.sort((a,b)=>b.age-a.age||a.slot-b.slot);
        group.forEach((row,offset)=>{ row.rank=nextRank+offset; row.rankLabel=`${nextRank+offset}위`; });
        sorted.splice(idx, group.length, ...group);
      }else{
        group.forEach(row=>{ row.rank=null; row.rankLabel=getIndividualTieLabel(nextRank); row.tiePending=true; });
      }
    }
    idx += group.length;
    nextRank += group.length;
  }
  return sorted;
}
function rbSc(m,idx){if(!m.rubbers)return 0;return m.rubbers.filter(rb=>rb&&rb.winner===idx).length;}
function getMatchDoublesCount(key,m){
  const teams=G.teams[key]||[];
  const [,div]=key.split('_');
  const tid=key.slice(0,key.lastIndexOf('_'));
  const tObj=G.tournaments.find(t=>t.id===tid);
  const cfg=gDS(tObj,div);
  const team1=(m&&m.t1!=null)?(teams[m.t1]??teams.find(t=>t.id===m.t1)):null;
  const team2=(m&&m.t2!=null)?(teams[m.t2]??teams.find(t=>t.id===m.t2)):null;
  const fromCfg=Number(cfg?.doublesCount||0);
  const fromTeam=Number(team1?.doublesCount||team2?.doublesCount||0);
  if(fromCfg>0) return fromCfg;
  if(fromTeam>0) return fromTeam;
  if(div==='테린이'||div==='terinee'||div==='여성부') return 3;
  return 5;
}
function getMatchResultState(key,m){
  if(!m) return {done:false,started:false,sc1:0,sc2:0,disp1:0,disp2:0,winner:null,totalRubbers:0};
  if(m.bye) return {done:true,started:true,sc1:1,sc2:0,disp1:1,disp2:0,winner:m.winner,totalRubbers:1};
  const totalRubbers=getMatchDoublesCount(key,m);
  const need=Math.floor(totalRubbers/2)+1;
  const rubbers=Array.isArray(m.rubbers)?m.rubbers:[];
  const indivMode=isIndividualByKey(key);
  let sc1=0, sc2=0, started=false;
  let disp1=0, disp2=0;
  rubbers.forEach((rb, idx)=>{
    if(!rb) return;
    const hasScore=(rb.score1!=null||rb.score2!=null);
    const hasPlayers=(Array.isArray(rb.players1)&&rb.players1.length)||(Array.isArray(rb.players2)&&rb.players2.length);
    if(hasScore||hasPlayers) started=true;
    if(rb.winner===0) sc1++;
    else if(rb.winner===1) sc2++;
    if(indivMode && idx===0 && hasScore){
      disp1=Number(rb.score1||0);
      disp2=Number(rb.score2||0);
    }
  });
  let winner=null, done=false;
  if(sc1>=need){ winner=m.t1; done=true; }
  else if(sc2>=need){ winner=m.t2; done=true; }
  if(!indivMode){
    disp1=sc1;
    disp2=sc2;
  }
  return {done,started,sc1,sc2,disp1,disp2,winner,totalRubbers};
}

function estimateMainBracketSize(key){
  const [tid,div]=key.split('_');
  const t=G.tournaments.find(x=>x.id===tid);
  const cfg=gDS(t,div);
  const draw=G.draws[key];
  if(!cfg || !draw || !Array.isArray(draw.groups) || !draw.groups.length) return 0;
  // group_knockout이 아니어도 draw.groups가 있으면(=개인전) 추정 가능
  if(cfg.format!=='group_knockout' && !isIndividualByKey(key)) return 0;
  const adv = Number(draw.advance||cfg.advance||2);
  const groups = draw.groups.length;
  const advTeams = adv * groups;
  if(advTeams < 2) return 0;
  let n = 1;
  while(n < advTeams) n *= 2;
  return n;
}
function estimateMainBracketMatchCount(key){
  const size = estimateMainBracketSize(key);
  return size >= 2 ? Math.max(0, size - 1) : 0;
}
function jumpToMainBracketSection(tid,div){
  const ids = [
    `mainStageTitle_${tid}_${div}`,
    `mainPreviewTitle_${tid}_${div}`,
    `mainPreviewCard_${tid}_${div}`,
    `mainStage_${tid}_${div}`
  ];
  let el = ids.map(id=>ge(id)).find(Boolean);
  if(!el){
    const page = ge('bracketContent') || document;
    const candidates = Array.from(page.querySelectorAll('.sec-title, .card, div'));
    el = candidates.find(x=>{
      const txt = (x.textContent||'').replace(/\s+/g,' ').trim();
      return txt.includes('본선 토너먼트 대진표') || txt.includes('본선 대진표 구조 미리보기');
    }) || null;
  }
  if(!el) return;
  el.scrollIntoView({behavior:'smooth', block:'start'});
  const target = el.closest('.card') || el;
  target.classList.add('match-focus-pulse');
  setTimeout(()=>target.classList.remove('match-focus-pulse'), 2200);
}
window.jumpToMainBracketSection = jumpToMainBracketSection;

function findMainEntryMatchByLabel(key, entryLabel){
  const label=String(entryLabel||'').trim();
  if(!label) return null;
  return (G.matches[key]||[]).find(m=>m && m.winner==null!==undefined && (String(m.source1Label||'').trim()===label || String(m.source2Label||'').trim()===label))
    || (G.matches[key]||[]).find(m=>m && (String(m.source1Label||'').trim()===label || String(m.source2Label||'').trim()===label))
    || null;
}
function jumpToMainEntryByLabel(key, entryLabel){
  const label=String(entryLabel||'').trim();
  if(!label) return;
  const info=_k2td(key);
  const match=findMainEntryMatchByLabel(key,label);
  if(match){
    goBracketMatch(info.tid, info.div, match.id);
    return;
  }
  showPage('bracket');
  const brTS=ge('brTS');
  if(brTS) brTS.value=info.tid;
  try{ onBrTC(); }catch(e){}
  setTimeout(()=>{
    try{ setBracketSelectedDivs([info.div], info.tid); }catch(e){}
    try{ renderBracket(); }catch(e){}
    setTimeout(()=>jumpToMainBracketSection(info.tid, info.div), 220);
  }, 260);
}
window.jumpToMainEntryByLabel = jumpToMainEntryByLabel;


function getMatchCardDomId(key, mid){
  return 'matchCard_'+String(key).replace(/[^a-zA-Z0-9_-]/g,'_')+'_'+String(mid).replace(/[^a-zA-Z0-9_-]/g,'_');
}
function getAdvT(key,draw,teams,cfg){
  // 개인전: draw.indivMode 플래그 기반으로 전용 진출팀 계산
  if(draw.indivMode){
    const res=[];
    (draw.groups||[]).forEach((grp,gi)=>{
      const gs=calcGS(key,gi,grp.teams,teams);
      const grpSize=grp.teams.length;
      const advCount=grpSize<=2 ? grpSize : Math.max(1, Number(draw?.advance||cfg?.advance||2));
      gs.slice(0,advCount).forEach((s,rk)=>res.push({ti:s.ti,nm:s.nm,gn:gi+1,rk:rk+1,grpSize}));
    });
    return res;
  }
  const res=[];
  (draw.groups||[]).forEach((grp,gi)=>{
    const grpSize=(grp?.teams||[]).length||0;
    const advCount=grpSize<=2 ? grpSize : Math.max(1, Number(draw?.advance||cfg?.advance||2));
    calcGS(key,gi,grp.teams,teams).slice(0,advCount).forEach((s,rk)=>res.push({ti:s.ti,nm:s.nm,gn:gi+1,rk:rk+1,grpSize}));
  });
  return res;
}
function getPreviewAdvSlots(draw,cfg){
  const res=[];
  (draw?.groups||[]).forEach((grp,gi)=>{
    const grpSize=(grp?.teams||[]).length||0;
    const advCount=grpSize<=2 ? grpSize : Math.max(1, Number(draw?.advance||cfg?.advance||2));
    for(let rk=1; rk<=advCount; rk++) res.push({nm:`${grpLabel(gi)} ${rk}위`, gn:gi+1, rk, placeholder:true, grpSize});
  });
  return res;
}

const AUTO_MAIN_BUILDING = {};
async function ensureAutoTeamMainBracketIfReady(tid,div){
  const key=tid+'_'+div;
  const t=G.tournaments.find(x=>x.id===tid);
  const draw=G.draws[key];
  if(!t || !draw || isIndividualTournament(t)) return false;
  const cfg=gDS(t,div);
  const isGroupKO = (cfg.format==='group_knockout');
  if(!isGroupKO) return false;
  const allMs=G.matches[key]||[];
  if(allMs.some(m=>m && (m.phase==='main' || m.phase==='playin'))) return false;
  const gMs=allMs.filter(m=>m && m.phase==='group');
  if(!gMs.length) return false;
  const allDone=gMs.every(m=>getMatchResultState(key,m).done);
  if(!allDone) return false;
  if(AUTO_MAIN_BUILDING[key]) return false;

  const teams=G.teams[key]||[];
  const advT=getAdvT(key,draw,teams,cfg);
  if((advT||[]).length < 2) return false;
  const pv=buildPreviewMainSlots(draw, cfg);
  if(!(pv && Number(pv.n||0) >= 2 && Array.isArray(pv.matchSlots) && pv.matchSlots.length)) return false;

  AUTO_MAIN_BUILDING[key]=true;
  try{
    const nonMain=allMs.filter(m=>m && m.phase!=='main' && m.phase!=='playin');
    const built=buildMainMatches(pv.matchSlots||[], pv.n||0, pv.playInMatches||[]);
    if(!built.length) return false;
    G.matches[key]=[...nonMain, ...built];
    G.draws[key]={...(G.draws[key]||{}), autoMainBuiltAt:new Date().toISOString()};
    try{ setMainSectionCollapsed(key,false); }catch(e){}
    await stD(key);
    await stM(key);
    toast('예선 완료로 본선 대진표를 자동 생성했습니다 ✅','success');
    return true;
  }catch(e){
    console.error('ensureAutoTeamMainBracketIfReady failed', e);
    return false;
  }finally{
    AUTO_MAIN_BUILDING[key]=false;
  }
}

function getPrelimResolvedLabelMap(key){
  try{
    const draw=G.draws[key]||{};
    if(!Array.isArray(draw.groups) || !draw.groups.length) return {};
    const info=_k2td(key);
    const t=G.tournaments.find(x=>x.id===info.tid);
    const cfg=gDS(t,info.div);
    const teams=G.teams[key]||[];
    const advDefault=Math.max(1, Number(draw?.advance||cfg?.advance||2));
    const map={};

    (draw.groups||[]).forEach((grp,gi)=>{
      const tids=Array.isArray(grp?.teams)?grp.teams:[];
      if(!tids.length) return;
      const stats=calcGS(key,gi,tids,teams)||[];
      if(!stats.length) return;
      const grpSize=tids.length;
      const advCount=grpSize<=2 ? grpSize : advDefault;
      const topStats=stats.slice(0,advCount);
      if(!topStats.length) return;
      const resolved=topStats.every(row=>row && row.ti!=null && row.rank!=null && !row.tiePending);
      if(!resolved) return;
      topStats.forEach((row,idx)=>{
        const entry={ti:row.ti,nm:tdn(teams[row.ti],key,row.ti),gn:gi+1,rk:idx+1,grpSize};
        const label=getMainEntryBracketLabel(entry);
        if(label){
          map[String(label).trim()]={ti:row.ti,name:tdn(teams[row.ti],key,row.ti)};
        }
      });
    });
    return map;
  }catch(e){ return {}; }
}
function propagateResolvedMainAdvancements(key){
  const list=G.matches[key]||[];
  let changed=false;
  const playins=list.filter(m=>m && m.phase==='playin');
  const mains=list.filter(m=>m && m.phase==='main').sort((a,b)=>Number(a.round||0)-Number(b.round||0)||Number(a.slot||0)-Number(b.slot||0));

  playins.forEach(m=>{
    if(m && m.winner!=null){
      const target=list.find(x=>x && x.phase==='main' && Number(x.round||0)===0 && Number(x.slot||0)===Number(m.targetSlot));
      if(target){
        if(String(m.targetSide||'t1')==='t2'){
          if(target.t2!==m.winner){ target.t2=m.winner; changed=true; }
        }else{
          if(target.t1!==m.winner){ target.t1=m.winner; changed=true; }
        }
      }
    }
  });

  mains.forEach(m=>{
    if(!m || Number(m.round||0)!==0) return;
    const hasOnlyOne=(m.t1!=null && m.t2==null) || (m.t1==null && m.t2!=null);
    const isByeLabel=String(m.source2Label||'').trim()==='부전승';
    if(hasOnlyOne || isByeLabel){
      const winnerTi=(m.t1!=null)?m.t1:m.t2;
      if(winnerTi!=null){
        if(m.t1==null){ m.t1=winnerTi; changed=true; }
        if(m.winner!==winnerTi){ m.winner=winnerTi; changed=true; }
        if(!m.bye){ m.bye=true; changed=true; }
      }
    }
  });

  mains.forEach(m=>{
    if(!m || m.winner==null) return;
    const next=list.find(x=>x && x.phase==='main' && Number(x.round||0)===Number(m.round||0)+1 && Number(x.slot||0)===Math.floor(Number(m.slot||0)/2));
    if(!next) return;
    if(Number(m.slot||0)%2===0){
      if(next.t1!==m.winner){ next.t1=m.winner; changed=true; }
    }else{
      if(next.t2!==m.winner){ next.t2=m.winner; changed=true; }
    }
  });
  return changed;
}
function syncIndividualMainBracketFromPrelim(key){
  if(!isIndividualByKey(key)) return false;
  const labelMap=getPrelimResolvedLabelMap(key);
  if(!Object.keys(labelMap).length) return false;
  const list=G.matches[key]||[];
  let changed=false;
  const applySide=(m,side,label)=>{
    const resolved=labelMap[String(label||'').trim()];
    if(!resolved) return;
    if(side==='t1'){
      if(m.t1!==resolved.ti){ m.t1=resolved.ti; changed=true; }
      if(m.phase==='playin'){
        if(String(m.source1Label||'')!==resolved.name){ m.source1Label=resolved.name; changed=true; }
      }else if(String(m.source1Label||'')){
        m.source1Label=''; changed=true;
      }
    }else{
      if(m.t2!==resolved.ti){ m.t2=resolved.ti; changed=true; }
      if(m.phase==='playin'){
        if(String(m.source2Label||'')!==resolved.name){ m.source2Label=resolved.name; changed=true; }
      }else if(String(m.source2Label||'').trim()!=='부전승' && String(m.source2Label||'')){
        m.source2Label=''; changed=true;
      }
    }
  };
  list.forEach(m=>{
    if(!m) return;
    if(m.phase==='playin' || (m.phase==='main' && Number(m.round||0)===0)){
      applySide(m,'t1',m.source1Label);
      applySide(m,'t2',m.source2Label);
    }
  });
  if(propagateResolvedMainAdvancements(key)) changed=true;
  return changed;
}
window.syncIndividualMainBracketFromPrelim = syncIndividualMainBracketFromPrelim;
function hybridSpreadOrder(count){
  const arr=[];
  let left=0,right=count-1;
  while(left<=right){
    arr.push(left);
    if(right!==left) arr.push(right);
    left++; right--;
  }
  return arr;
}

function pickByeMatchIndices(matchCount, byeCount){
  if(byeCount<=0) return [];
  const parents=Math.max(1, Math.ceil(matchCount/2));
  const parentOrder=hybridSpreadOrder(parents);
  const out=[];
  const used=new Set();

  for(const p of parentOrder){
    if(out.length>=byeCount) break;
    const a=p*2, b=a+1;
    if(a<matchCount && !used.has(a)){ out.push(a); used.add(a); continue; }
    if(b<matchCount && !used.has(b)){ out.push(b); used.add(b); }
  }
  if(out.length<byeCount){
    for(const p of parentOrder){
      if(out.length>=byeCount) break;
      const a=p*2, b=a+1;
      if(b<matchCount && !used.has(b)){ out.push(b); used.add(b); continue; }
      if(a<matchCount && !used.has(a)){ out.push(a); used.add(a); }
    }
  }
  if(out.length<byeCount){
    for(let i=0;i<matchCount && out.length<byeCount;i++){
      if(!used.has(i)){ out.push(i); used.add(i); }
    }
  }
  return out.slice(0, byeCount);
}

function buildHybridMainSlots(entries, n){
  const total=(entries||[]).length;
  if(total<2 || !n) return {matchSlots:[], n:0, byeCount:0, byeIdxs:[], normalIdxs:[]};

  const byeCount=n-total;
  const rank1=(entries||[]).filter(a=>a.rk===1);
  const rank2=(entries||[]).filter(a=>a.rk!==1);
  const matchCount=n/2;
  const matchSlots=Array.from({length:matchCount},(_,i)=>({id:i,t1:null,t2:null,bye:false}));

  const byeIdxs=pickByeMatchIndices(matchCount, byeCount);
  const byeSet=new Set(byeIdxs);
  const normalIdxs=hybridSpreadOrder(matchCount).filter(i=>!byeSet.has(i));

  // 조당 2팀 진출 + 부전승 없음이면 기본은 크로스 배치
  // 예: A조1위 vs B조2위 / B조1위 vs A조2위
  const canUseCross = byeCount===0
    && rank1.length>=2
    && rank1.length===rank2.length
    && entries.every(e=>e && (e.rk===1 || e.rk===2) && e.gn!=null);

  if(canUseCross){
    const gmap = new Map();
    entries.forEach(e=>{
      const gn = Number(e.gn);
      if(!gmap.has(gn)) gmap.set(gn, {});
      gmap.get(gn)[e.rk] = {...e};
    });

    const groups = [...gmap.keys()].sort((a,b)=>a-b);
    const desiredMatches = [];

    for(let i=0;i<groups.length;i+=2){
      const gA = groups[i];
      const gB = groups[i+1];
      const A = gmap.get(gA) || {};
      const B = gmap.get(gB) || {};

      if(gB!=null){
        // 기본 크로스 배치
        if(A[1] || B[2]) desiredMatches.push({t1:A[1]||null, t2:B[2]||null, bye:false});
        if(B[1] || A[2]) desiredMatches.push({t1:B[1]||null, t2:A[2]||null, bye:false});
      }else{
        // 홀수 조가 남는 특수 상황만 예외 처리
        if(A[1] || A[2]) desiredMatches.push({t1:A[1]||null, t2:A[2]||null, bye:false});
      }
    }

    desiredMatches.slice(0, normalIdxs.length).forEach((m, idx)=>{
      const slotIdx = normalIdxs[idx];
      if(slotIdx==null) return;
      if(m.t1) matchSlots[slotIdx].t1 = {...m.t1};
      if(m.t2) matchSlots[slotIdx].t2 = {...m.t2};
    });

    return {matchSlots, n, byeCount, byeIdxs, normalIdxs};
  }

  const byeRank1Count=Math.min(byeCount, rank1.length);
  const byeRank1=rank1.slice(0, byeRank1Count);
  const byeRank2=rank2.slice(0, Math.max(0, byeCount-byeRank1Count));
  const remainRank2=rank2.slice(Math.max(0, byeCount-byeRank1Count));
  const normalRank1=rank1.slice(byeRank1Count);

  const byeAll=[...byeRank1, ...byeRank2];
  byeIdxs.forEach((slotIdx, i)=>{
    const team=byeAll[i];
    if(!team) return;
    matchSlots[slotIdx].t1={...team};
    matchSlots[slotIdx].bye=true;
  });

  const r1Idxs=normalIdxs.slice(0, normalRank1.length);
  normalRank1.forEach((team, i)=>{
    const slotIdx=r1Idxs[i];
    if(slotIdx==null) return;
    matchSlots[slotIdx].t1={...team};
  });

  let r2ptr=0;
  const vsRank1Idxs=normalIdxs.filter(i=>matchSlots[i].t1 && !matchSlots[i].bye);
  for(const slotIdx of vsRank1Idxs){
    const seed = matchSlots[slotIdx].t1;
    let pickIdx = remainRank2.findIndex(t=>t && seed && t.gn!==seed.gn);
    if(pickIdx<0) pickIdx = 0;
    const [team] = remainRank2.splice(pickIdx, 1);
    if(!team) break;
    matchSlots[slotIdx].t2={...team};
  }

  const emptyNormalIdxs=normalIdxs.filter(i=>!matchSlots[i].t1);
  for(const slotIdx of emptyNormalIdxs){
    const teamA=remainRank2.shift();
    let teamB = null;
    if(teamA){
      let pickIdx = remainRank2.findIndex(t=>t && t.gn!==teamA.gn);
      if(pickIdx<0) pickIdx = 0;
      teamB = remainRank2.splice(pickIdx,1)[0] || null;
    }
    if(teamA) matchSlots[slotIdx].t1={...teamA};
    if(teamB) matchSlots[slotIdx].t2={...teamB};
  }

  return {matchSlots, n, byeCount, byeIdxs, normalIdxs};
}

function computeMainBracketSpec(total){
  const t=Math.max(0, Number(total||0));
  if(t<2) return {mainSize:0, playInTeams:0, playInMatches:0, winnersNeeded:0, directCount:t, exact:true};
  let lower=1;
  while(lower*2 <= t) lower*=2;
  if(lower===t) return {mainSize:t, playInTeams:0, playInMatches:0, winnersNeeded:0, directCount:t, exact:true};
  const winnersNeeded=t-lower;
  const playInTeams=Math.min(t, winnersNeeded*2);
  const playInMatches=Math.floor(playInTeams/2);

  // 진출전은 최대 4경기까지만 허용.
  // 4경기 이상이 필요한 구간은 상위 드로(예: 64강 -> 128강)로 올려
  // 부전승을 늘리고 진출전 표시 없이 본선만 보이도록 한다.
  if(playInMatches >= 4){
    return {
      mainSize: lower*2,
      playInTeams: 0,
      playInMatches: 0,
      winnersNeeded: 0,
      directCount: t,
      exact: false,
      promotedBracket: true,
      baseMainSize: lower
    };
  }

  return {
    mainSize: lower,
    playInTeams,
    playInMatches,
    winnersNeeded,
    directCount: t-playInTeams,
    exact:false
  };
}

function formatMainSpecSummary(spec){
  if(!spec || !spec.mainSize) return '';
  if(spec.playInMatches>0){
    return `직행 ${spec.directCount}팀 + 진출전 ${spec.playInTeams}팀(${spec.playInMatches}경기) → 승자 ${spec.winnersNeeded}팀이 ${spec.mainSize}강 합류`;
  }
  if(spec.promotedBracket && spec.baseMainSize){
    return `진출전 ${Math.max(0, Math.floor((Number(spec.directCount||0)-Number(spec.baseMainSize||0))/2))}경기 구간은 상위 드로로 승격 → ${spec.mainSize}강 본선 (부전승 ${Math.max(0, spec.mainSize - spec.directCount)}팀)`;
  }
  return `${spec.mainSize}강 본선`;
}
function buildPreviewMainSlots(draw,cfg){
  const advT=getPreviewAdvSlots(draw,cfg);
  const total=advT.length;
  if(total<2) return {matchSlots:[], n:0, byeCount:0, playInMatches:[], spec:computeMainBracketSpec(total)};
  const spec=computeMainBracketSpec(total);
  if(!spec.playInTeams){
    const n=spec.mainSize;
    const base=buildHybridMainSlots(advT, n);
    return {...base, spec, playInMatches:[]};
  }

  const rank1=advT.filter(a=>a.rk===1);
  const others=advT.filter(a=>a.rk!==1);
  const playInEntries=others.slice(0, spec.playInTeams).map((e,i)=>({...e, playInId:i+1}));
  const directEntries=advT.filter(e=>!playInEntries.some(p=>p.nm===e.nm && p.gn===e.gn && p.rk===e.rk));
  const placeholders=Array.from({length:spec.winnersNeeded},(_,i)=>({
    nm:`진출전 승자${i+1}`, gn:null, rk:2, placeholder:true, playInPlaceholder:true, playInId:i+1
  }));
  const mainEntries=[...directEntries, ...placeholders];
  const base=buildHybridMainSlots(mainEntries, spec.mainSize);
  const playInMatches=[];
  for(let i=0;i<spec.playInMatches;i++){
    playInMatches.push({
      id:`playin_${i}`,
      t1:playInEntries[i*2]||null,
      t2:playInEntries[i*2+1]||null,
      winnerLabel:`진출전 승자${i+1}`,
      playInId:i+1
    });
  }
  return {...base, spec, playInMatches};
}

function makeSeededRng(seed){
  let x=((seed>>>0) || 1)>>>0;
  return function(){
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}
function shuffleWithRng(arr, rng){
  const out=[...arr];
  for(let i=out.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [out[i],out[j]]=[out[j],out[i]]; }
  return out;
}
function buildSnakeOrderSeeded(grps, rng){
  let rem=grps.map((g,idx)=>({i:(g&&g.i!=null)?g.i:idx,rem:(g&&g.size!=null)?g.size:(g&&g.rem!=null)?g.rem:0}));
  rem=shuffleWithRng(rem, rng);
  if(rem.length>1){ const k=Math.floor(rng()*rem.length); rem=rem.slice(k).concat(rem.slice(0,k)); }
  let fwd = rng() < 0.5;
  const order=[];
  while(rem.some(g=>g.rem>0)){
    const seq=fwd?rem:[...rem].reverse();
    for(const g of seq){ if(g.rem>0){ order.push(g.i); g.rem--; } }
    fwd=!fwd;
  }
  return order;
}
function seededSmartShuffle(indices,teams,seed){
  const grpSizes=DW.cfg?.grpSizes||[];
  const salt = seedStringHash(`${DW.key||''}|${DW.div||''}|${seed}|${indices.length}`)>>>0;
  const rng=makeSeededRng(salt || seed || 1);
  for(let attempt=0;attempt<160;attempt++){
    const arr=shuffleWithRng(indices, rng);
    if(!grpSizes.length) return arr;
    const grps=grpSizes.map(()=>[]);
    const snakeOrder=buildSnakeOrderSeeded(grpSizes.map((size,i)=>({i,size})), rng);
    snakeOrder.forEach((gi,pos)=>{ if(pos<arr.length) grps[gi].push(arr[pos]); });
    let conflict=false;
    for(const grp of grps){
      const clubs=grp.map(ti=>teams[ti]?.club).filter(Boolean);
      if(clubs.length!==new Set(clubs).size){ conflict=true; break; }
    }
    if(!conflict) return arr;
  }
  const byClub={};
  indices.forEach(ti=>{ const c=teams[ti]?.club||`__${ti}`; (byClub[c]||(byClub[c]=[])).push(ti); });
  const clubs=Object.values(byClub).map(group=>shuffleWithRng(group, rng)).sort((a,b)=>b.length-a.length);
  const result=[]; const maxLen=clubs[0]?.length||0;
  for(let i=0;i<maxLen;i++) for(const group of clubs) if(i<group.length) result.push(group[i]);
  return result;
}
function getDrawSeedMethod(){ return ge('drawExternalMode')?.value||'time'; }
function getDrawNth(){ const n=parseInt(ge('drawNthPick')?.value||'1',10); return Math.max(1, Math.min(10, Number.isNaN(n)?1:n)); }
function computeDrawExternalSeed(method){
  if(method==='random'){
    let raw=Math.floor(Math.random()*1000000);
    try{ const arr=new Uint32Array(1); crypto.getRandomValues(arr); raw=arr[0]>>>0; }catch(e){}
    return {seed:(raw%10)+1, sourceLabel:'브라우저 난수', snapshotLabel:'브라우저 난수 기준 확정', rawValue:String(raw)};
  }
  const now=new Date(); const sec=now.getSeconds();
  return {seed:(sec%10)+1, sourceLabel:'현재 시각 초', snapshotLabel:`현재 시각 ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(sec).padStart(2,'0')} 기준 확정`, rawValue:String(sec)};
}
function buildNthDrawPlan(teams, baseSeed, nth){
  const candidates=[];
  const indices=teams.map((_,i)=>i);
  for(let i=1;i<=10;i++){
    const candidateSeed=((baseSeed-1 + ((i-1)*7)) % 10) + 1;
    const shuffled=seededSmartShuffle(indices, teams, candidateSeed);
    candidates.push({index:i, seed:candidateSeed, shuffled});
  }
  const chosen=candidates[Math.max(0, Math.min(candidates.length-1, nth-1))];
  return {candidates, chosen};
}
function prepareDrawExternalPlan(forceNew=false){
  if(!DW.teams || !DW.teams.length) return null;
  const method=getDrawSeedMethod();
  const nth=getDrawNth();
  const needNew = forceNew || !DW.seedPreparedAt || DW.seedMethod!==method;
  if(needNew){
    const ext=computeDrawExternalSeed(method);
    DW.seed=ext.seed;
    DW.seedMethod=method;
    DW.seedSourceLabel=ext.sourceLabel;
    DW.seedSnapshotLabel=ext.snapshotLabel;
    DW.seedPreparedAt=new Date().toISOString();
  }
  DW.nthPick=nth;
  const nthPlan=buildNthDrawPlan(DW.teams, DW.seed, nth);
  DW.candidates=nthPlan.candidates;
  DW.plan=nthPlan.chosen||null;
  const snap=ge('drawExternalSnapshot');
  if(snap) snap.textContent=`${DW.seedSourceLabel||'외부값'} · ${nth}번째 결과 채택 준비 완료`;
  renderDrawCandidatePreviewCards();
  return DW.plan;
}

// ─── 추첨 전역 상태 ───────────────────────────────────────
let DW={key:null,tid:null,div:null,teams:[],cfg:{},isRunning:false,seed:1,seedMethod:'time',seedSourceLabel:'',seedSnapshotLabel:'',seedPreparedAt:'',nthPick:1,candidates:[],drawAudit:null,plan:null};

function openDraw(tid,div){
  if(!canManageBracket()){ toast('예선 추첨은 관리자 또는 경기진행자만 실행할 수 있습니다','error'); return; }
  const key=tid+'_'+div;
  const teams=G.teams[key]||[];
  const t=G.tournaments.find(t=>t.id===tid);
  // 개인전은 전용 추첨 UI로 분기
  if(isIndividualTournament(t)){ openIndividualDraw(tid,div); return; }
  DW={key,tid,div,teams,cfg:{},isRunning:false};
  const hasSameClub=checkSameClub(teams);
  ge('drawTeamList').innerHTML=`<div style="padding:10px 12px;background:var(--panel2);border-radius:var(--radius-lg);border:1px solid var(--border)"><div style="font-weight:700;font-size:.85rem;margin-bottom:8px">${dl(div)} — 등록 팀 (${teams.length}팀)</div><div style="display:flex;flex-wrap:wrap;gap:4px">${teams.map((tm,i)=>`<span class="badge bg-green" style="font-size:.78rem">${tdn(tm,key,i)}</span>`).join('')}</div></div>`;
  buildDrawPresets(teams.length,t,div);
  ge('sameClubWarn').classList.toggle('show',hasSameClub);
  DW.candidates=[];
  DW.plan=null;
  const histCnt=(G.drawHistories[key]||[]).filter(x=>!x.deleted).length;
  const titleInput=ge('drawTitleInput');
  if(titleInput) titleInput.value=`${dl(div)} 추첨 ${histCnt+1}`;
  const drawIsTestInput=ge('drawIsTestInput');
  if(drawIsTestInput) drawIsTestInput.checked=false;

  const oldSeedBox=ge('drawSeedConfigWrap');
  if(oldSeedBox) oldSeedBox.remove();
  const cfgScreen=ge('drawCfgScreen');
  if(cfgScreen){
    const seedWrap=document.createElement('div');
    seedWrap.id='drawSeedConfigWrap';
    seedWrap.className='admin-block';
    const savedSeedRaw=String((G.draws[key]||{}).mainSeedRaw||'').trim();
    seedWrap.innerHTML=`
      <div style="margin-bottom:12px;padding:12px 14px;background:linear-gradient(135deg,#fff8df,#eef4ff);border:1.5px solid var(--accent);border-radius:12px">
        <div style="font-weight:900;font-size:.88rem;color:var(--primary-dark);margin-bottom:6px">🎯 예선 단계 본선 시드 설정</div>
        <div style="font-size:.76rem;color:var(--text2);line-height:1.6;margin-bottom:8px">관리자만 설정합니다. 형식은 <b>팀번호=시드번호</b>, 최대 8번까지 입력합니다. 입력한 시드팀은 예선에서 서로 다른 조로 자동 분산됩니다. 예: <code>12=1, 7=2, 3=3, 9=4</code></div>
        <input class="form-input" id="drawMainManualSeedsInput" placeholder="예: 12=1, 7=2, 3=3, 9=4" value="${savedSeedRaw.replace(/"/g,'&quot;')}" oninput="updatePrelimSeedSummary()">
        <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button type="button" class="btn btn-outline" style="font-size:.76rem;padding:5px 12px;min-height:34px" onclick="savePrelimSeedConfigFromModal()">💾 시드 저장</button>
        </div>
        <div id="drawMainManualSeedsSummary" style="font-size:.72rem;color:var(--text3);margin-top:6px;line-height:1.55"></div>
      </div>`;
    cfgScreen.insertBefore(seedWrap, cfgScreen.firstChild);
  }
  const drawCourtBox=ge('drawAllowedCourtsBox');
  if(drawCourtBox){
    drawCourtBox.innerHTML=renderDrawAllowedCourtSelector(key, getDrawAllowedCourts(key));
    drawCourtBox.style.display = AD ? 'block' : 'none';
  }
  updatePrelimSeedSummary();
  bindDrawAllowedCourtInputs();
  document.querySelectorAll('#drawCfgScreen .admin-block').forEach(el=>{ if(el.id!=='drawAllowedCourtsBox') el.style.display = AD ? 'block' : 'none'; });
  // 설정화면 표시, 진행화면 숨김
  const cfgScr=ge('drawCfgScreen'); if(cfgScr) cfgScr.style.display='block';
  const runScr=ge('drawRunScreen');  if(runScr) runScr.style.display='none';
  ge('confirmDrawBtn').textContent='🎲 추첨 시작';
  ge('confirmDrawBtn').onclick=startDraw;
  ge('confirmDrawBtn').disabled=teams.length<2;
  om('mDraw');
}

function checkSameClub(teams){const clubs=teams.map(t=>t.club);return clubs.length!==new Set(clubs).size;}

function calcGroupPresets(n){
  const presets=[];const seen=new Set();
  for(let gs=2;gs<=Math.min(n,6);gs++){
    const ng=Math.ceil(n/gs);const sizes=[];let rem=n;
    for(let g=0;g<ng;g++){const s=Math.ceil(rem/(ng-g));sizes.push(s);rem-=s;}
    const key2=sizes.slice().sort().join(',');if(seen.has(key2))continue;seen.add(key2);
    const label=sizes.every(s=>s===sizes[0])?`${sizes[0]}팀씩 ${ng}조`:`${sizes.join('+')}팀 → ${ng}조`;
    presets.push({label,groups:ng,sizes});
  }
  return presets;
}

function buildDrawPresets(n,t,div){
  const cfg=gDS(t,div);
  const presets=calcGroupPresets(n);
  const presetsEl=ge('grpPresets');const advEl=ge('advancePresets');
  presetsEl.innerHTML='';
  let defaultIdx=presets.findIndex(p=>p.sizes[0]===(cfg.grpSize||4));if(defaultIdx<0)defaultIdx=Math.floor(presets.length/2);
  const sel=presets[defaultIdx]||presets[0];
  DW.cfg.groups=sel.groups;DW.cfg.grpSizes=sel.sizes;DW.cfg.advance=cfg.advance||2;
  presets.forEach((p,i)=>{
    const btn=document.createElement('span');
    btn.className='grp-preset'+(i===defaultIdx?' active':'');
    btn.textContent=p.label;
    btn.onclick=()=>{presetsEl.querySelectorAll('.grp-preset').forEach(b=>b.classList.remove('active'));btn.classList.add('active');DW.cfg.groups=p.groups;DW.cfg.grpSizes=p.sizes;updateAdvPresets(n);};
    presetsEl.appendChild(btn);
  });
  updateAdvPresets(n);
}

function updateAdvPresets(n){
  const {groups,grpSizes}=DW.cfg;
  ge('grpConfigDisplay').textContent=`${grpSizes.join('+')}팀 × ${groups}조`;
  const advEl=ge('advancePresets');advEl.innerHTML='';
  const maxAdv=Math.min(...grpSizes);
  for(let a=1;a<=maxAdv;a++){
    const total=a*groups;const np=nextPow2(total);const byes=np-total;
    const btn=document.createElement('span');
    btn.className='grp-preset'+(a===DW.cfg.advance?' active':'');
    btn.textContent=`조당${a}팀→${np}강${byes?'(부전승'+byes+')':''}`;
    btn.onclick=()=>{advEl.querySelectorAll('.grp-preset').forEach(b=>b.classList.remove('active'));btn.classList.add('active');DW.cfg.advance=a;updateMainSizeDisplay();};
    advEl.appendChild(btn);
  }
  updateMainSizeDisplay();
}

function updateMainSizeDisplay(){
  const {groups,advance,grpSizes}=DW.cfg;if(!groups)return;
  const total=(advance||1)*groups;const spec=computeMainBracketSpec(total);
  ge('mainSizeDisplay').textContent = spec.playInMatches>0
    ? `본선 진출 ${total}팀 → ${spec.mainSize}강 본선 / 직행 ${spec.directCount}팀 + 진출전 ${spec.playInTeams}팀(${spec.playInMatches}경기)`
    : `본선 진출 ${total}팀 → ${spec.mainSize}강 토너먼트${spec.exact?' (완전 대진)':` (부전승 ${spec.mainSize-total}팀)`}`;
  // 본선 나무가지 미리보기 갱신
  updateDrawMainPreview();
}

async function persistPrelimSeedConfig(key, teams, raw, extra={}){
  const cleanRaw=String(raw||'').trim();
  const seedMap=parseManualSeedMapFromText(cleanRaw, (teams||[]).map((tm,ti)=>({ti,nm:tdn(tm,key,ti)})));
  const base=(G.draws[key] && typeof G.draws[key]==='object') ? G.draws[key] : {};
  G.draws[key]={...base, ...extra, mainSeedRaw:cleanRaw, mainSeedMap:seedMap};
  await stD(key);
  return seedMap;
}
async function savePrelimSeedConfigFromModal(){
  if(!AD){ toast('관리자만 저장할 수 있습니다','info'); return; }
  const key=DW?.key||'';
  if(!key){ toast('대회를 먼저 선택하세요','error'); return; }
  const raw=(ge('drawMainManualSeedsInput')?.value||'').trim();
  sl(true);
  try{
    await persistPrelimSeedConfig(key, DW?.teams||[], raw);
    sl(false);
    updatePrelimSeedSummary();
    toast('예선 시드 저장 완료 ✅ 추첨 전에도 계속 유지됩니다.','success');
  }catch(e){
    sl(false);
    toast('시드 저장 실패: '+e.message,'error');
  }
}
async function saveIdwSeedConfigFromModal(){
  if(!AD){ toast('관리자만 저장할 수 있습니다','info'); return; }
  const key=IDW?.key||'';
  if(!key){ toast('대회를 먼저 선택하세요','error'); return; }
  const raw=(ge('idwSeedInput')?.value||'').trim();
  sl(true);
  try{
    await persistPrelimSeedConfig(key, IDW?.teams||[], raw, {indivMode:true, grpSize:(IDW?.grpSize||2)});
    sl(false);
    window.updateIdwSeedSummary?.();
    toast('예선 시드 저장 완료 ✅ 추첨 전에도 계속 유지됩니다.','success');
  }catch(e){
    sl(false);
    toast('시드 저장 실패: '+e.message,'error');
  }
}
window.savePrelimSeedConfigFromModal = savePrelimSeedConfigFromModal;
window.saveIdwSeedConfigFromModal = saveIdwSeedConfigFromModal;

function getPrelimManualSeedMap(){
  const key=DW?.key||'';
  const teams=DW?.teams||[];
  const raw=(AD ? (ge('drawMainManualSeedsInput')?.value||String((G.draws[key]||{}).mainSeedRaw||'')) : String((G.draws[key]||{}).mainSeedRaw||'')).trim();
  return parseManualSeedMapFromText(raw, teams.map((tm,ti)=>({ti,nm:tdn(tm,key,ti)})));
}
function updatePrelimSeedSummary(){
  const summary=ge('drawMainManualSeedsSummary');
  if(!summary) return;
  const key=DW?.key||'';
  const teams=DW?.teams||[];
  const seedMap=getPrelimManualSeedMap();
  const pairs=Object.entries(seedMap).map(([ti,seedNo])=>{
    const idx=Number(ti);
    return teams[idx] ? `#${idx+1} ${tdn(teams[idx], key, idx)} → ${seedNo}번 시드` : '';
  }).filter(Boolean).sort((a,b)=>{
    const sa=parseInt((a.match(/(\d+)번 시드/)||[])[1]||'999',10);
    const sb=parseInt((b.match(/(\d+)번 시드/)||[])[1]||'999',10);
    return sa-sb;
  });
  summary.innerHTML = pairs.length
    ? `설정됨: <b>${pairs.join(' / ')}</b><br><span style="color:#8a6412">설정한 시드팀은 예선 추첨에서도 서로 다른 조로 우선 분산되고, 본선에서도 1·2 시드는 결승 전까지, 상위 시드는 최대한 늦게 만나도록 유지됩니다.</span>`
    : '저장된 시드가 없으면 일반 본선 추첨으로 진행됩니다. 관리자 저장 후에는 추첨을 안 해도 계속 유지됩니다.';
}

function updateDrawMainPreview(){
  const {groups,advance}=DW.cfg;
  const pvBox=ge('drawMainPreviewBox');
  const pvCont=ge('drawMainPreviewContent');
  if(!pvBox||!pvCont||!groups||!advance) return;
  prepareDrawExternalPlan(false);
  const fakeGroups=Array.from({length:groups},(_,i)=>({i}));
  const fakeDraw={groups:fakeGroups,advance};
  const pv=buildPreviewMainSlots(fakeDraw,{});
  if(pv.n<2){pvBox.style.display='none';return;}
  pvBox.style.display='block';
  const spec=pv.spec||computeMainBracketSpec((advance||1)*groups);
  const badgeHtml=`<span class="badge" style="background:var(--accent);color:#fff">${advance}팀 진출 × ${groups}조 → ${spec.playInMatches>0 ? `${spec.mainSize}강 본선 / 직행 ${spec.directCount}팀 + 진출전 ${spec.playInTeams}팀` : `${pv.n}강`}</span>`;
  const prepared = DW.seedPreparedAt ? new Date(DW.seedPreparedAt) : null;
  const preparedTxt = prepared ? `${String(prepared.getHours()).padStart(2,'0')}:${String(prepared.getMinutes()).padStart(2,'0')}:${String(prepared.getSeconds()).padStart(2,'0')}` : '-';
  pvCont.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
    <div style="font-size:.8rem;color:var(--text2)">예시 구조 — 실제 본선 자리는 예선 종료 후 추첨으로 확정</div>
    ${badgeHtml}
  </div><div style="font-size:.74rem;color:var(--text2);margin-bottom:8px">${DW.seedSourceLabel||'외부값'} · <b>${DW.nthPick||1}번째 결과</b> · 계산시각 ${preparedTxt}</div>${renderMainPreviewHTML(pv.matchSlots,pv.n,true)}`;
}

function nextPow2(n){let p=1;while(p<n)p*=2;return p;}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

function buildSnakeOrder(grps,opt){
  opt = opt || {};
  const order=[];
  let rem=grps.map((g,idx)=>({
    i:(g&&g.i!=null)?g.i:idx,
    rem:(g&&g.size!=null)?g.size:(g&&g.rem!=null)?g.rem:0
  }));
  if(opt.shuffle) shuffle(rem);
  if(opt.rotate && rem.length>1){
    const k = randInt(rem.length);
    rem = rem.slice(k).concat(rem.slice(0,k));
  }
  let fwd = true;
  if(opt.startRandom) fwd = randInt(2)===0;
  if(opt.startReverse) fwd = false;
  while(rem.some(g=>g.rem>0)){
    const seq = fwd ? rem : [...rem].reverse();
    for(const g of seq){ if(g.rem>0){ order.push(g.i); g.rem--; } }
    fwd = !fwd;
  }
  return order;
}



function getPrelimSeedDistributedGroups(indices, teams, grpSizes, seedMap){
  const groups=(grpSizes||[]).map((size,gi)=>({gi,size,teams:[]}));
  if(!groups.length) return [];

  const sm=seedMap||{};
  const seededEntries=(indices||[])
    .filter(ti=>sm[Number(ti)]>=1 && sm[Number(ti)]<=8)
    .map(ti=>({ti:Number(ti), seedNo:Number(sm[Number(ti)])}))
    .sort((a,b)=>a.seedNo-b.seedNo);

  const usedSeedNos=new Set();
  const seeded=[];
  seededEntries.forEach(e=>{
    if(!usedSeedNos.has(e.seedNo)){
      usedSeedNos.add(e.seedNo);
      seeded.push(e);
    }
  });

  const seededSet=new Set(seeded.map(e=>e.ti));
  const rest=(indices||[]).filter(ti=>!seededSet.has(Number(ti)));

  const emptySlots=g=>Math.max(0, Number(g.size||0) - Number((g.teams||[]).length||0));
  const teamClubs=(ti)=>getTeamClubTokens(teams?.[ti]||{});
  const sameClubCount=(group, ti)=>{
    const tokens=teamClubs(ti);
    return (group.teams||[]).reduce((cnt,idx)=>{
      const gt=getTeamClubTokens(teams?.[idx]||{});
      return cnt + (tokens.some(t=>gt.includes(t)) ? 1 : 0);
    }, 0);
  };

  // 시드팀은 서로 다른 조에 우선 분산
  seeded.forEach((entry, seedIdx)=>{
    let candidates=groups.filter(g=>emptySlots(g)>0);
    candidates.sort((a,b)=>{
      const sameDiff=sameClubCount(a, entry.ti)-sameClubCount(b, entry.ti);
      if(sameDiff!==0) return sameDiff;
      const lenDiff=(a.teams.length||0)-(b.teams.length||0);
      if(lenDiff!==0) return lenDiff;
      return a.gi-b.gi;
    });
    const fallback=groups[seedIdx % groups.length];
    const best=candidates[0] || fallback;
    if(best && emptySlots(best)>0) best.teams.push(entry.ti);
  });

  // 나머지 팀은 같은 클럽 최소화 + 빈칸 균형 배치
  const byClub={};
  rest.forEach(ti=>{
    const clubs=teamClubs(ti);
    const club=String(clubs[0]||teams?.[ti]?.club||`__${ti}`);
    if(!byClub[club]) byClub[club]=[];
    byClub[club].push(Number(ti));
  });
  Object.values(byClub).forEach(arr=>shuffle(arr));
  const clubEntries=Object.entries(byClub).sort((a,b)=>{
    if(b[1].length!==a[1].length) return b[1].length-a[1].length;
    return Math.random()<0.5 ? -1 : 1;
  });

  for(const [club, teamIdxs] of clubEntries){
    for(const ti of teamIdxs){
      let candidates=groups.filter(g=>emptySlots(g)>0 && sameClubCount(g, ti)===0);
      if(!candidates.length) candidates=groups.filter(g=>emptySlots(g)>0);
      candidates.sort((a,b)=>{
        const sameDiff=sameClubCount(a, ti)-sameClubCount(b, ti);
        if(sameDiff!==0) return sameDiff;
        const lenDiff=(a.teams.length||0)-(b.teams.length||0);
        if(lenDiff!==0) return lenDiff;
        const roomDiff=emptySlots(b)-emptySlots(a);
        if(roomDiff!==0) return roomDiff;
        return Math.random()<0.5 ? -1 : 1;
      });
      const best=candidates[0];
      if(best) best.teams.push(Number(ti));
    }
  }

  return improveBalancedGroups(groups, teams);
}
function buildGreedyBalancedGroups(indices, teams, grpSizes){
  const groups=(grpSizes||[]).map((size,gi)=>({gi,size,teams:[]}));
  if(!groups.length) return [];

  const isIndividual = (teams||[]).some(t=>t?.tournamentType==='individual_pair' || Array.isArray(t?.individualPlayers));
  if(isIndividual){
    const shuffled=[...(indices||[])];
    shuffle(shuffled);
    let ptr=0;
    groups.forEach(g=>{
      while(g.teams.length<g.size && ptr<shuffled.length){
        g.teams.push(shuffled[ptr++]);
      }
    });
    return groups;
  }

  const byClub={};
  indices.forEach(ti=>{
    const clubs=getTeamClubTokens(teams[ti]);
    const club=String(clubs[0]||teams[ti]?.club||'기타');
    if(!byClub[club]) byClub[club]=[];
    byClub[club].push(ti);
  });
  Object.values(byClub).forEach(arr=>shuffle(arr));
  const clubEntries=Object.entries(byClub).sort((a,b)=>{
    if(b[1].length!==a[1].length) return b[1].length-a[1].length;
    return Math.random()<0.5?-1:1;
  });

  function sameClubCount(group, club){
    return group.teams.reduce((cnt,idx)=>{
      const tokens=getTeamClubTokens(teams[idx]);
      return cnt + (tokens.includes(club)?1:0);
    }, 0);
  }
  function emptySlots(group){ return group.size - group.teams.length; }

  for(const [club, teamIdxs] of clubEntries){
    for(const ti of teamIdxs){
      let candidates=groups.filter(g=>emptySlots(g)>0 && sameClubCount(g, club)===0);
      if(!candidates.length){
        candidates=groups.filter(g=>emptySlots(g)>0);
      }
      candidates.sort((a,b)=>{
        const sameDiff=sameClubCount(a,club)-sameClubCount(b,club);
        if(sameDiff!==0) return sameDiff;
        const lenDiff=a.teams.length-b.teams.length;
        if(lenDiff!==0) return lenDiff;
        const roomDiff=emptySlots(b)-emptySlots(a);
        if(roomDiff!==0) return roomDiff;
        return Math.random()<0.5?-1:1;
      });
      const best=candidates[0];
      if(best) best.teams.push(ti);
    }
  }
  return groups;
}
function improveBalancedGroups(groups, teams){
  if(!groups?.length) return groups;
  const conflictsFor=(g)=> {
    const seen=new Map(); let c=0;
    for(const idx of g.teams){
      const club=String(teams[idx]?.club||'');
      const n=(seen.get(club)||0)+1; seen.set(club,n);
      if(n>1) c++;
    }
    return c;
  };
  const hasClub=(g, club)=>g.teams.some(idx=>getTeamClubTokens(teams[idx]).includes(club));
  for(let pass=0; pass<12; pass++){
    let moved=false;
    for(let a=0; a<groups.length; a++){
      const ga=groups[a];
      const counts={};
      ga.teams.forEach(idx=>{
        getTeamClubTokens(teams[idx]).forEach(club=>{ counts[club]=(counts[club]||0)+1; });
      });
      const dupClub=Object.keys(counts).find(c=>counts[c]>1);
      if(!dupClub) continue;
      const dupIdx=ga.teams.find(idx=>getTeamClubTokens(teams[idx]).includes(dupClub));
      for(let b=0; b<groups.length; b++){
        if(a===b) continue;
        const gb=groups[b];
        if(hasClub(gb, dupClub)) continue;
        const swapPos=gb.teams.findIndex(idx=>!getTeamClubTokens(teams[idx]).some(cl=>hasClub(ga, cl)));
        if(swapPos<0) continue;
        const before=conflictsFor(ga)+conflictsFor(gb);
        const ai=ga.teams.indexOf(dupIdx);
        const tmpA=ga.teams[ai], tmpB=gb.teams[swapPos];
        ga.teams[ai]=tmpB; gb.teams[swapPos]=tmpA;
        const after=conflictsFor(ga)+conflictsFor(gb);
        if(after<before){ moved=true; break; }
        ga.teams[ai]=tmpA; gb.teams[swapPos]=tmpB;
      }
      if(moved) break;
    }
    if(!moved) break;
  }
  return groups;
}
function groupsToAssignmentOrder(groups){
  const order=[];
  const maxSize=Math.max(0,...groups.map(g=>g.size||g.teams.length));
  for(let slot=0; slot<maxSize; slot++){
    for(const g of groups){
      if(slot < g.teams.length) order.push({gi:g.gi, ti:g.teams[slot]});
    }
  }
  return order;
}
function smartShuffle(indices,teams){
  const grpSizes=DW.cfg?.grpSizes||[];
  if(!grpSizes.length){
    const arr=[...indices];
    shuffle(arr);
    return arr;
  }
  const initial=buildGreedyBalancedGroups(indices, teams, grpSizes);
  const improved=improveBalancedGroups(initial, teams);
  const conflictCount=improved.reduce((sum,g)=>{
    const seen=new Set(); let dup=0;
    g.teams.forEach(idx=>{
      getTeamClubTokens(teams[idx]).forEach(c=>{ if(seen.has(c)) dup++; else seen.add(c); });
    });
    return sum+dup;
  },0);
  if(conflictCount>0){
    toast('⚠️ 같은 클럽 팀 수가 많아 일부 조는 겹칠 수 있지만 최소화해서 배정했습니다','info');
  }
  return groupsToAssignmentOrder(improved).map(x=>x.ti);
}

/* =========================
   🎰 슬롯 추첨 효과 + WebAudio SFX (외부 파일 없음)
   - 모바일/브라우저 정책상 "사용자 클릭" 이후에만 소리 재생 가능
========================= */
const SFX = (() => {
  let ctx = null, master = null;
  function ensure(){
    if(ctx) return true;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    }catch(e){ return false; }
  }
  function now(){ return ctx ? ctx.currentTime : 0; }

  // 드럼 타격음 (저음 킥 + 스네어 노이즈)
  function drumHit(t, type='kick', vol=0.5){
    if(!ctx) return;
    if(type==='kick'){
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.2);
    } else if(type==='snare'){
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.15), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1) * (1 - i/data.length) * 0.9;
      const ns = ctx.createBufferSource();
      const g = ctx.createGain();
      ns.buffer = buf;
      g.gain.setValueAtTime(vol*0.7, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      ns.connect(g); g.connect(master);
      ns.start(t);
      // snare tone
      const o = ctx.createOscillator();
      const g2 = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(220, t);
      g2.gain.setValueAtTime(vol*0.3, t);
      g2.gain.exponentialRampToValueAtTime(0.0001, t+0.08);
      o.connect(g2); g2.connect(master);
      o.start(t); o.stop(t+0.09);
    } else if(type==='hihat'){
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1) * (1 - i/data.length);
      const ns = ctx.createBufferSource();
      const g = ctx.createGain();
      const flt = ctx.createBiquadFilter();
      flt.type = 'highpass'; flt.frequency.value = 7000;
      ns.buffer = buf;
      g.gain.setValueAtTime(vol*0.4, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t+0.04);
      ns.connect(flt); flt.connect(g); g.connect(master);
      ns.start(t);
    }
  }

  // 팡파레 음표
  function fanfareNote(freq, t, dur, vol=0.22){
    if(!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    // 브라스 느낌: sawtooth + detune
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    o.detune.setValueAtTime(8, t);
    // 부드러운 envelope
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.04);
    g.gain.setValueAtTime(vol, t + dur - 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    // 약간의 필터로 부드럽게
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = 3200;
    o.connect(flt); flt.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.01);
  }

  // 착지 효과음 (쿵 + 하이햇)
  function landSound(){
    if(!ensure()) return;
    if(ctx.state==='suspended') ctx.resume().catch(()=>{});
    const t = now();
    drumHit(t, 'kick', 0.7);
    drumHit(t+0.02, 'hihat', 0.8);
  }

  // 조 완성 효과음 (스네어 롤 마무리)
  function groupComplete(){
    if(!ensure()) return;
    if(ctx.state==='suspended') ctx.resume().catch(()=>{});
    const t = now();
    drumHit(t,       'snare', 0.5);
    drumHit(t+0.08,  'snare', 0.6);
    drumHit(t+0.14,  'snare', 0.75);
    drumHit(t+0.18,  'kick',  0.8);
    // 짧은 성공 딩
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(880, t+0.22);
    o.frequency.exponentialRampToValueAtTime(1320, t+0.32);
    g.gain.setValueAtTime(0.0001, t+0.22);
    g.gain.exponentialRampToValueAtTime(0.18, t+0.24);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.38);
    o.connect(g); g.connect(master);
    o.start(t+0.22); o.stop(t+0.40);
  }

  // 드럼롤 (점점 빨라지다가 크레셴도)
  let rollingTimer = null;
  function rollStart(totalMs=2400){
    if(!ensure()) return;
    if(ctx.state==='suspended') ctx.resume().catch(()=>{});
    if(rollingTimer){ clearTimeout(rollingTimer); rollingTimer=null; }
    const start = performance.now();
    let beat = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const prog = Math.min(1, elapsed / totalMs);
      // 처음엔 kick+snare 교대, 후반엔 빠른 스네어롤
      const step = prog < 0.5
        ? 280 - prog * 300   // 280ms → 130ms (느린 킥+스네어)
        : 130 - (prog-0.5)*200; // 130ms → 30ms (빠른 롤)
      const vol = 0.3 + prog * 0.5;
      if(prog < 0.6){
        if(beat % 2 === 0) drumHit(now(), 'kick', vol);
        else               drumHit(now(), 'snare', vol * 0.8);
      } else {
        drumHit(now(), 'snare', vol);
        if(beat % 3 === 0) drumHit(now()+0.01, 'hihat', 0.5);
      }
      beat++;
      if(prog >= 1){ rollingTimer=null; return; }
      rollingTimer = setTimeout(tick, Math.max(18, step));
    };
    tick();
  }
  function rollStop(){
    if(rollingTimer){ clearTimeout(rollingTimer); rollingTimer=null; }
  }

  // reveal: 마지막 킥 + 하이햇 플래시
  function reveal(){
    if(!ensure()) return;
    if(ctx.state==='suspended') ctx.resume().catch(()=>{});
    const t = now();
    drumHit(t, 'kick', 0.9);
    drumHit(t+0.01, 'hihat', 1.0);
    drumHit(t+0.04, 'snare', 0.7);
  }

  // 팡파레 (도-미-솔-높은도 + 화음)
  function finale(){
    if(!ensure()) return;
    if(ctx.state==='suspended') ctx.resume().catch(()=>{});
    const t = now();
    // 드럼 인트로
    drumHit(t,      'kick',  1.0);
    drumHit(t+0.05, 'snare', 0.9);
    drumHit(t+0.09, 'hihat', 0.8);
    drumHit(t+0.12, 'kick',  0.8);
    // 팡파레 멜로디: 도-미-솔-도(옥타브)
    fanfareNote(523.25, t+0.18, 0.18, 0.20); // 도
    fanfareNote(659.25, t+0.36, 0.18, 0.22); // 미
    fanfareNote(783.99, t+0.54, 0.18, 0.22); // 솔
    fanfareNote(1046.5, t+0.72, 0.32, 0.24); // 높은 도
    // 화음 (도+미+솔 동시)
    fanfareNote(523.25, t+0.72, 0.32, 0.12);
    fanfareNote(659.25, t+0.72, 0.32, 0.10);
    // 마지막 킥
    drumHit(t+0.72, 'kick', 0.7);
    drumHit(t+0.80, 'snare', 0.6);
    drumHit(t+0.86, 'hihat', 0.9);
  }

  return { rollStart, rollStop, reveal, finale, landSound, groupComplete };
})();


/* ── 🎾 세로 룰렛 → 낙엽 착지 추첨 시스템 ── */

// confetti
function spawnConfetti(container){
  const colors=['#1565c0','#43a047','#f59e0b','#e53935','#8e24aa','#00897b'];
  for(let i=0;i<16;i++){
    const el=document.createElement('div');
    el.className='confetti-piece';
    el.style.cssText=`left:${10+Math.random()*80}%;background:${colors[~~(Math.random()*colors.length)]};animation-delay:${Math.random()*.3}s;animation-duration:${.5+Math.random()*.4}s;transform:rotate(${Math.random()*360}deg);width:${5+Math.random()*7}px;height:${5+Math.random()*7}px;border-radius:${Math.random()>.5?'50%':'2px'};`;
    container.style.position='relative';
    container.appendChild(el);
    setTimeout(()=>el.remove(), 900);
  }
}

// 세로 룰렛: 빠르게 돌다가 점점 느려지며 당첨 팀에서 멈춤
async function runRoulette(containerEl, names, finalName, totalMs){
  if(!containerEl||!names.length) return;
  // 두 벌 복제 (무한 스크롤 느낌)
  const doubled=[...names,...names];
  const itemH=42;
  const uid='rs'+Date.now();
  containerEl.innerHTML=`
    <div class="roulette-strip-wrap">
      <div class="roulette-highlight"></div>
      <div class="roulette-strip" id="${uid}">
        ${doubled.map(n=>`<div class="roulette-item">${n}</div>`).join('')}
      </div>
    </div>`;

  const strip=containerEl.querySelector('#'+uid);
  if(!strip) return;

  // 빠른 스크롤
  strip.style.setProperty('--speed','.09s');
  strip.classList.add('spinning');
  SFX.rollStart(totalMs);
  await sleep(totalMs * 0.65);

  // 점점 느려지기
  for(const spd of [.14,.21,.30,.42,.56,.74,.95]){
    strip.style.setProperty('--speed', spd+'s');
    await sleep(spd * 780);
  }
  strip.classList.remove('spinning');
  SFX.rollStop();

  // 당첨 팀 중앙 정렬
  const winIdx = names.findIndex(n=>n===finalName);
  const targetIdx = (winIdx >= 0 ? winIdx : 0) + names.length; // 두 번째 세트
  const wrapH = 180;
  const offset = -(targetIdx * itemH) + (wrapH/2) - (itemH/2);
  strip.style.transition = 'transform .52s cubic-bezier(.22,.68,.35,1.15)';
  strip.style.transform = `translateY(${offset}px)`;
  // 당첨 항목 강조
  strip.querySelectorAll('.roulette-item').forEach((el,i)=>{
    if(i===targetIdx) el.classList.add('winner-item');
  });
  await sleep(560);
}

// 낙엽 착지: 위에서 둥실 내려와 착지 후 살랑살랑
async function leafLandReveal(stageEl, teamName, isSameClub){
  if(!stageEl) return;
  const lx=(Math.random()-.5)*44;
  const ly=-(65+Math.random()*35);
  const lr=(Math.random()-.5)*30;
  stageEl.innerHTML='';
  stageEl.style.cssText='display:flex;justify-content:center;align-items:center;min-height:68px;position:relative;overflow:visible;padding:4px 0;';
  const card=document.createElement('div');
  card.className='leaf-card-stage'+(isSameClub?' same-club-card':'');
  card.textContent=teamName;
  card.style.cssText=`opacity:0;`;
  card.style.setProperty('--lx', lx+'px');
  card.style.setProperty('--ly', ly+'px');
  card.style.setProperty('--lr', lr+'deg');
  stageEl.appendChild(card);
  // 다음 프레임에 애니메이션 시작
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  card.classList.add('landing');
  SFX.landSound();
  await sleep(680);
  card.style.opacity='1';
  card.classList.remove('landing');
  card.classList.add('floating');
  await sleep(500);
}

// 해당 조의 다음 빈 슬롯을 반짝이게
function activateSlot(groupIdx){
  document.querySelectorAll('.draw-team-slot.slot-active').forEach(el=>el.classList.remove('slot-active'));
  const slots=ge('dg_slots_'+groupIdx);
  if(!slots) return;
  const empty=slots.querySelector('.draw-team-slot:not([data-filled])');
  if(empty) empty.classList.add('slot-active');
}

// 슬롯 채우기
function fillSlotWithLeaf(groupIdx, teamName, isSameClub){
  const slots=ge('dg_slots_'+groupIdx);
  if(!slots) return;
  const empty=slots.querySelector('.draw-team-slot:not([data-filled])');
  if(!empty) return;
  empty.classList.remove('slot-active');
  empty.setAttribute('data-filled','1');
  empty.textContent=teamName;
  empty.classList.add('slot-filled');
  if(isSameClub) empty.classList.add('same-club');
}

// 조 완성 연출
async function celebrateGroupComplete(groupIdx){
  const row=ge('dg_'+groupIdx);
  if(!row) return;
  row.classList.add('group-complete');
  SFX.groupComplete();
  spawnConfetti(row);
  row.style.background='linear-gradient(90deg,#dcfce7,#d1fae5)';
  row.style.borderColor='#22c55e';
  await sleep(900);
  row.style.background='';
  row.style.borderColor='';
  row.classList.remove('group-complete');
}

// 설정화면 → 진행화면 전환
function switchToRunScreen(){
  const cfg=ge('drawCfgScreen'); if(cfg) cfg.style.display='none';
  const run=ge('drawRunScreen'); if(run) run.style.display='block';
  const src=ge('drawMainPreviewContent');
  const dst=ge('drawRunPreviewContent');
  if(src&&dst) dst.innerHTML=src.innerHTML;
}

// 추첨 완료 후 오른쪽 패널 갱신
function refreshRunPreview(key){
  const freshDraw=G.draws[key];
  const dst=ge('drawRunPreviewContent');
  if(!freshDraw||!dst) return;
  const pv=buildPreviewMainSlots(freshDraw,{});
  if(pv.n<2){ dst.innerHTML=''; return; }

  const spec=pv.spec||computeMainBracketSpec((freshDraw.advance||2)*(freshDraw.groups?.length||0));
  const adv=freshDraw.advance||2;
  const gc=freshDraw.groups?.length||0;

  // 각 조 1,2위가 어느 본선 슬롯으로 가는지 매핑
  const slotAssignHtml = (()=>{
    const slots=pv.matchSlots||[];
    const playIns=pv.playInMatches||[];
    // playIn 배정
    const playInMap={}; // nm → "진출전 N경기"
    playIns.forEach((pm,i)=>{
      if(pm.t1) playInMap[pm.t1.nm]=`🪣 진출전(똥통) ${i+1}경기`;
      if(pm.t2) playInMap[pm.t2.nm]=`🪣 진출전(똥통) ${i+1}경기`;
    });
    // 본선 슬롯 배정
    const mainMap={}; // nm → "N번 슬롯"
    slots.forEach((ms,si)=>{
      if(ms.t1) mainMap[ms.t1.nm]=`본선 ${si+1}번 슬롯`;
      if(ms.t2) mainMap[ms.t2.nm]=`본선 ${si+1}번 슬롯`;
    });

    const rows=(freshDraw.groups||[]).map((grp,gi)=>{
      const entries=[];
      const grpSz=grp.teams?.length||0;
      const advCount=grpSz<=2?grpSz:2;
      for(let rk=1;rk<=advCount;rk++){
        const nm=`${grpLabel(gi)} ${rk}위`;
        const dest=playInMap[nm]||mainMap[nm]||'—';
        const isPlayIn=!!playInMap[nm];
        const color=rk===1?'#1565c0':'#e67e22';
        const destClr=isPlayIn?'#92400e':'#166534';
        const destBg=isPlayIn?'#fff8e6':'#f0fdf4';
        entries.push(`<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:.72rem;font-weight:700;background:${destBg};color:${destClr}">${rk}위→<b>${dest}</b></span>`);
      }
      return `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:5px 8px;border-bottom:1px solid #f1f5f9">
        <span style="font-size:.76rem;font-weight:800;color:#0f1e3a;min-width:32px">${grpLabel(gi)}</span>
        ${entries.join('')}
      </div>`;
    }).join('');

    return rows ? `<div style="margin-top:10px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:white">
      <div style="padding:6px 10px;background:#f8fafc;font-size:.72rem;font-weight:700;color:#475569;border-bottom:1px solid #e2e8f0">📌 조별 본선 배정 위치</div>
      ${rows}
    </div>` : '';
  })();

  const specBadge=spec.playInMatches>0
    ? `${adv}팀×${gc}조→${spec.mainSize}강+진출전${spec.playInMatches}경기`
    : `${adv}팀×${gc}조→${pv.n}강`;

  dst.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap">
    <div style="font-size:.78rem;font-weight:700;color:var(--primary-dark)">⏳ 본선 시드보호 재추첨 대기</div>
    <span class="badge" style="background:var(--accent);color:#fff;font-size:.7rem">${specBadge}</span>
  </div>
  <div style="font-size:.74rem;color:var(--text2);margin-bottom:8px">지금은 구조만 표시됩니다. 실제 배정은 본선 추첨 후 확정됩니다.</div>
  ${renderMainPreviewHTML(pv.matchSlots,pv.n,true)}
  ${slotAssignHtml}`;
}

// 추첨 스테이지 초기화
function initDrawStage(current, total, groupIdx){
  const groupColors=['#1565c0','#2e7d32','#6a1b9a','#c62828','#00695c','#e65100'];
  const gc=groupColors[groupIdx%groupColors.length];
  const el=ge('drawStageContent');
  if(!el) return;
  el.innerHTML=`
    <div class="draw-stage-card" style="border-color:${gc}55">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:.85rem;font-weight:800;color:${gc}">${grpLabel(groupIdx)} 배정 중 🎰</div>
        <div style="font-size:.72rem;color:var(--text2);font-weight:600">${current} / ${total}번째</div>
      </div>
      <div id="rouletteWrap_${groupIdx}_${current}"></div>
      <div id="leafStage_${groupIdx}_${current}" style="margin-top:8px;min-height:68px;display:flex;justify-content:center;align-items:center;overflow:visible"></div>
    </div>`;
  // ID를 동적으로 부여해서 반환
  el._rouletteId = `rouletteWrap_${groupIdx}_${current}`;
  el._leafId     = `leafStage_${groupIdx}_${current}`;
}

function buildRouletteStrip(names){ return names.map(n=>`<div class="roulette-item">${n}</div>`).join(''); }

function buildDrawCandidateGroupsFromShuffled(shuffled){
  const sizes=(DW.cfg?.grpSizes||[]).slice();
  const groups=sizes.map(()=>[]);
  const maxSize=Math.max(0,...sizes);
  let idx=0;
  for(let slot=0; slot<maxSize; slot++){
    for(let gi=0; gi<sizes.length; gi++){
      if(slot < sizes[gi] && idx < shuffled.length){
        groups[gi].push(shuffled[idx++]);
      }
    }
  }
  return groups;
}

function compactGroupSummaryFromShuffled(shuffled){
  const groups=buildDrawCandidateGroupsFromShuffled(shuffled||[]);
  return groups.map((grp,gi)=>`${grpLabel(gi)} ${grp.map(ti=>tdn(DW.teams[ti],DW.key,ti)).join(' · ')}`).join(' / ');
}
function compactMainSummaryFromPlan(plan){
  const slots=(plan?.matchSlots)||[];
  const playIns=(plan?.playInMatches)||[];
  const parts=[];
  if(playIns.length){
    playIns.forEach((s,idx)=>{
      const a=s?.t1?.nm||'TBD';
      const b=s?.t2?.nm||'TBD';
      parts.push(`진출전${idx+1} ${a} vs ${b}`);
    });
  }
  slots.forEach((s,idx)=>{
    const a=s?.source1Label || getMainEntryBracketLabel(s?.t1) || '자동진출';
    const b=s?.source2Label || getMainEntryBracketLabel(s?.t2) || '대기';
    parts.push(`${idx+1}경기 ${a} vs ${b}`);
  });
  return parts.join(' / ');
}
function renderDrawCandidatePreviewCards(){
  const el=ge('drawCandidatePreview');
  if(!el) return;
  const nth=DW.nthPick||1;
  const mode=DW.seedSourceLabel||'외부값';
  el.innerHTML=`<div style="padding:10px 12px;border:1.5px solid var(--border);border-radius:12px;background:var(--panel2);font-size:.78rem;line-height:1.65;color:var(--text2)">
    <div style="font-weight:900;color:var(--primary-dark);margin-bottom:4px">예선 추첨 진행 방식</div>
    <div>${mode} 기준으로 <b>${nth}번째 결과</b>를 채택합니다.</div>
    <div>1번째부터 ${Math.max(1,nth-1)}번째까지는 빠르게 지나가고, 마지막 ${nth}번째만 실제 추첨처럼 천천히 진행됩니다.</div>
  </div>`;
}
function renderDrawCandidateStage(index, candidate, chosen){
  return `<div style="width:100%;display:flex;flex-direction:column;gap:10px;align-items:stretch">
    <div style="text-align:center;font-size:${chosen?'1.02rem':'.96rem'};font-weight:900;color:${chosen?'#8a6412':'var(--primary-dark)'}">${index}번째 결과 ${chosen?'최종 채택':''}</div>
    <div style="font-size:.78rem;color:var(--text2);text-align:center">${chosen?'이 결과로 실제 추첨을 진행합니다.':'빠른 확인 중...'}</div>
    <div style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:${chosen?'#fff8df':'var(--panel2)'};font-size:.8rem;line-height:1.65">${compactGroupSummaryFromShuffled(candidate.shuffled)}</div>
  </div>`;
}
function renderMainCandidatePreviewCards(){
  const el=ge('mainCandidatePreview');
  if(!el) return;
  const nth=MD.nthPick||1;
  const mode=MD.seedSourceLabel||'외부값';
  el.innerHTML=`<div style="padding:10px 12px;border:1.5px solid var(--border);border-radius:12px;background:var(--panel2);font-size:.78rem;line-height:1.65;color:var(--text2)">
    <div style="font-weight:900;color:var(--primary-dark);margin-bottom:4px">본선 추첨 진행 방식</div>
    <div>${mode} 기준으로 <b>${nth}번째 결과</b>를 채택합니다.</div>
    <div>1번째부터 ${Math.max(1,nth-1)}번째까지는 빠르게 확인하고, 마지막 ${nth}번째만 실제 추첨처럼 천천히 진행됩니다.</div>
  </div>`;
}

function renderMainBracketPreviewHTML(key, plan, teams){
  try{
    const prev = ge('mainBracketPreview')?.innerHTML || '';
    const box = document.createElement('div');
    box.innerHTML = prev || '';
    if(box.innerHTML.trim()) return box.innerHTML;
  }catch(e){}
  return `<div style="font-size:.82rem;line-height:1.7">${compactMainSummaryFromPlan(plan||[]).replace(/\n/g,'<br>')}</div>`;
}

function renderMainCandidateStage(index, candidate, chosen){
  return `<div style="width:100%;display:flex;flex-direction:column;gap:10px;align-items:stretch">
    <div style="text-align:center;font-size:${chosen?'1.02rem':'.96rem'};font-weight:900;color:${chosen?'#8a6412':'var(--primary-dark)'}">${index}번째 결과 ${chosen?'최종 채택':''}</div>
    <div style="font-size:.78rem;color:var(--text2);text-align:center">${chosen?'이 결과로 실제 본선 추첨을 진행합니다.':'빠른 확인 중...'}</div>
    <div style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:${chosen?'#fff8df':'var(--panel2)'};font-size:.8rem;line-height:1.65">${compactMainSummaryFromPlan(candidate.plan)}</div>
  </div>`;
}


async function ensureHtml2CanvasReady(){
  if(window.html2canvas) return true;
  try{
    await new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload=res; s.onerror=rej; document.head.appendChild(s);
    });
    return true;
  }catch(e){
    toast('이미지 저장 준비 실패','error');
    return false;
  }
}
async function saveElementAsPng(el, filename){
  if(!el){ toast('저장할 화면이 없습니다','error'); return; }
  const ok=await ensureHtml2CanvasReady();
  if(!ok) return;
  toast('이미지 생성 중...','info');
  let stage=null;
  try{
    const clone = el.cloneNode(true);
    const srcNodes=[el, ...el.querySelectorAll('*')];
    const cloneNodes=[clone, ...clone.querySelectorAll('*')];

    clone.style.maxHeight='none';
    clone.style.height='auto';
    clone.style.overflow='visible';
    clone.style.width=Math.ceil(Math.max(el.scrollWidth, el.clientWidth))+'px';

    srcNodes.forEach((src, idx)=>{
      const dst=cloneNodes[idx];
      if(!dst) return;
      let cs=null;
      try{ cs=getComputedStyle(src); }catch(_e){}
      const scrollY = src.scrollHeight > src.clientHeight + 2;
      const scrollX = src.scrollWidth > src.clientWidth + 2;
      const oy = (cs?.overflowY||'') + ' ' + (cs?.overflow||'');
      const ox = (cs?.overflowX||'') + ' ' + (cs?.overflow||'');
      if(scrollY || /(auto|scroll|hidden)/i.test(oy)){
        dst.style.maxHeight='none';
        dst.style.height='auto';
        dst.style.overflowY='visible';
      }
      if(scrollX || /(auto|scroll|hidden)/i.test(ox)){
        dst.style.maxWidth='none';
        dst.style.width=Math.ceil(Math.max(src.scrollWidth, src.clientWidth))+'px';
        dst.style.overflowX='visible';
      }
    });

    stage=document.createElement('div');
    stage.style.cssText='position:fixed;left:-100000px;top:0;z-index:-1;background:#f4f6fb;padding:0;margin:0;overflow:visible;';
    stage.appendChild(clone);
    document.body.appendChild(stage);

    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

    const targetW=Math.ceil(Math.max(clone.scrollWidth, clone.offsetWidth, el.scrollWidth, el.clientWidth));
    const targetH=Math.ceil(Math.max(clone.scrollHeight, clone.offsetHeight, el.scrollHeight, el.clientHeight));

    const canvas = await html2canvas(clone,{
      scale:3,
      backgroundColor:'#f4f6fb',
      useCORS:true,
      logging:false,
      width:targetW,
      height:targetH,
      windowWidth:targetW,
      windowHeight:targetH,
      scrollX:0,
      scrollY:0
    });
    const a=document.createElement('a');
    a.href=canvas.toDataURL('image/png');
    a.download=filename||('draw_'+Date.now()+'.png');
    a.click();
    toast('이미지 저장 완료 🖼️','success');
  }catch(e){
    console.error('saveElementAsPng failed', e);
    toast('이미지 저장 실패','error');
  }finally{
    if(stage && stage.parentNode) stage.parentNode.removeChild(stage);
  }
}
async function saveDrawModalImage(){
  const box = ge('mDraw')?.querySelector('.modal-body');
  const t=G.tournaments.find(t=>t.id===DW.tid);
  const ttl=(ge('drawTitleInput')?.value||`${dl(DW.div||'')} 추첨`).trim();
  const fname = `${(t?.name||'대회')}_${ttl}_예선추첨.png`.replace(/[\\/:*?"<>|]+/g,'_');
  await saveElementAsPng(box, fname);
}
function normalizeDrawHistoryEntry(entry){
  const plan = entry?.plan && typeof entry.plan==='object' ? entry.plan : null;
  const matchSlots = Array.isArray(plan?.matchSlots) ? plan.matchSlots : [];
  return {
    ...entry,
    mode: String(entry?.mode||'group'),
    isTest: !!entry.isTest,
    deleted: !!entry.deleted,
    groups: (entry.groups||[]).map((g,gi)=>({
      label:g.label||grpLabel(gi),
      teams:(g.teams||[]).map(tm=>typeof tm==='string'?{name:tm, club:''}:tm)
    })),
    plan,
    mainPreviewSlots: Array.isArray(entry?.mainPreviewSlots) && entry.mainPreviewSlots.length ? entry.mainPreviewSlots : matchSlots,
    mainSize: Number(entry?.mainSize||plan?.n||0),
    groupCount: Number(entry?.groupCount || (entry?.groups||[]).length || 0)
  };
}
async function saveDrawHistoryEntry(entry){
  try{
    const docRef = await addDoc(collection(db,'drawHistory'), entry);
    DRAW_HISTORY_LOADED=false;
    const full={id:docRef.id,...entry};
    const key=entry.key;
    if(!G.drawHistories[key]) G.drawHistories[key]=[];
    G.drawHistories[key].unshift(full);
    G.drawHistories[key].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  }catch(e){
    console.warn('draw history save failed', e);
  }
}
function renderSavedDrawView(entry){
  const norm=normalizeDrawHistoryEntry(entry);
  const body=ge('drawHistoryViewBody');
  if(!body) return;
  const infoDate = new Date(norm.createdAt||Date.now());
  const isMainMode = String(norm.mode||'')==='main';
  const savedMainSlots = (Array.isArray(norm.mainPreviewSlots) && norm.mainPreviewSlots.length)
    ? norm.mainPreviewSlots
    : (Array.isArray(norm.plan?.matchSlots) && norm.plan.matchSlots.length ? norm.plan.matchSlots : []);
  const savedMainSize = Number(norm.mainSize || norm.plan?.n || 0);
  const mainHtml = (savedMainSlots.length && savedMainSize>=2)
    ? renderMainPreviewHTML(savedMainSlots, savedMainSize, !isMainMode)
    : '<div style="font-size:.8rem;color:var(--text3)">본선 구조 정보 없음</div>';
  const groupsHtml = (norm.groups||[]).length ? (norm.groups||[]).map((g,gi)=>`<div class="draw-group-row" style="margin-bottom:8px">
            <div class="draw-group-label">${g.label||grpLabel(gi)}</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
              ${(g.teams||[]).map(tm=>`<span class="draw-team-slot slot-filled ${tm.club&&((g.teams||[]).filter(x=>x.club===tm.club).length>1)?'same-club':''}" style="animation:none">${tm.name}</span>`).join('')}
            </div>
          </div>`).join('') : '<div style="font-size:.8rem;color:var(--text3)">예선 추첨 정보 없음</div>';
  const mainSummaryHtml = norm.summaryHtml
    ? `<div style="font-size:.84rem;line-height:1.8;color:var(--text);padding:12px 14px;background:linear-gradient(135deg,#f8fbff,#eef5ff);border:1px solid var(--border);border-radius:12px">${norm.summaryHtml}</div>`
    : (() => {
        const slots = Array.isArray(norm.plan?.matchSlots) ? norm.plan.matchSlots : [];
        const chips = [];
        slots.forEach((slot, idx) => {
          if(slot?.t1?.nm) chips.push(`<span class="badge" style="font-size:.8rem;padding:5px 12px;background:linear-gradient(135deg,#fff7dd,#f6d365);color:#7a5600;border:1px solid #d4a017">👑 ${idx+1}. ${slot.t1.nm}</span>`);
          if(slot?.t2?.nm) chips.push(`<span class="badge" style="font-size:.8rem;padding:5px 12px;background:linear-gradient(135deg,#eef2f7,#d8e0ea);color:#425466;border:1px solid #b8c3d1">🥈 ${chips.length+1}. ${slot.t2.nm}</span>`);
          if(slot?.bye) chips.push(`<span class="badge" style="font-size:.8rem;padding:5px 12px;background:linear-gradient(135deg,#fff7dd,#ffe8a3);color:#7a5600;border:1px solid #d4a017">🎫 자동 진출</span>`);
        });
        return chips.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${chips.join('')}</div>` : '<div style="font-size:.8rem;color:var(--text3)">본선 추첨 요약 정보 없음</div>';
      })();
  const leftTitle = isMainMode ? '📋 본선 추첨 결과' : '📋 예선 추첨 결과';
  const leftHtml = isMainMode ? mainSummaryHtml : groupsHtml;
  const leftBadge = isMainMode ? `<span class="badge bg-blue">본선 기록</span>` : `<span class="badge bg-blue">${(norm.groups||[]).length}조</span>`;
  body.innerHTML = `<div id="savedDrawCaptureArea">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      <div>
        <div style="font-size:1rem;font-weight:900;color:var(--primary-dark)">${norm.title||'추첨 기록'}</div>
        <div style="font-size:.8rem;color:var(--text2);margin-top:4px">${norm.tournamentName||''} — ${dl(norm.division||norm.div||'')} · ${infoDate.toLocaleString('ko-KR')}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="badge ${norm.isTest?'bg-bronze':'bg-green'}">${norm.isTest?'🧪 테스트':'🔒 실운영'}</span>
        ${leftBadge}
        <span class="badge bg-green">본선 ${norm.mainSize||0}강</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(320px,1fr) minmax(320px,1fr);gap:14px;align-items:start">
      <div>
        <div style="font-weight:800;font-size:.84rem;color:var(--primary-dark);margin-bottom:8px">${leftTitle}</div>
        ${leftHtml}
      </div>
      <div>
        <div style="font-weight:800;font-size:.84rem;color:var(--primary-dark);margin-bottom:8px">🌳 ${isMainMode ? '본선 추첨 결과' : '본선 구조 미리보기'}</div>
        <div style="background:linear-gradient(135deg,#fffdf5,#eef5ff);border:1.5px dashed var(--accent);border-radius:var(--radius-lg);padding:10px;overflow-x:auto">
          ${mainHtml}
        </div>
      </div>
    </div>
  </div>`;
  ge('drawHistoryViewTitle').textContent = isMainMode ? `🌳 ${norm.title||'저장된 본선 추첨 보기'}` : `🎲 ${norm.title||'저장된 예선 추첨 보기'}`;
  setModalFullscreenState('mDrawHistoryView', true);
  om('mDrawHistoryView');
}
async function saveSavedDrawImage(){
  const area=ge('savedDrawCaptureArea');
  const title=(ge('drawHistoryViewTitle')?.textContent||'저장된추첨').replace(/^🎲\s*/,'');
  await saveElementAsPng(area, `${title}.png`.replace(/[\\/:*?"<>|]+/g,'_'));
}
let DRAW_HISTORY_CTX_KEY='';

function openSavedDrawHistory(id, key){
  const entry=(G.drawHistories[key]||[]).find(x=>x.id===id);
  if(!entry){ toast('추첨 기록을 찾을 수 없습니다','error'); return; }
  renderSavedDrawView(entry);
}
async function openDrawHistory(tid,div,mode='prelim'){
  await ensureDrawHistoryLoaded();
  const key=tid+'_'+div;
  DRAW_HISTORY_CTX_KEY=key;
  const wantMain = String(mode||'prelim')==='main';
  const list=(G.drawHistories[key]||[])
    .filter(it=>!it.deleted)
    .filter(it=> wantMain ? String(it.mode||'')==='main' : String(it.mode||'')!=='main')
    .slice()
    .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  const box=ge('drawHistoryList');
  if(!box) return;
  const footer=ge('mDrawHistory')?.querySelector('.modal-footer');
  if(footer){
    footer.innerHTML=`${AD?'<button class="btn btn-outline" type="button" onclick="openDrawDeleteLog()">🧾 삭제 로그 보기</button>':''}<button class="btn btn-gray" onclick="cm(\'mDrawHistory\')">닫기</button>`;
  }
  const titleEl = ge('mDrawHistory')?.querySelector('.modal-header h3');
  if(titleEl) titleEl.textContent = wantMain ? '🌳 본선 추첨 기록' : '🎲 예선 추첨 기록';
  if(!list.length){
    box.innerHTML=`<div class="empty-state"><div class="empty-icon">${wantMain?'🌳':'🗂'}</div><p>${wantMain?'저장된 본선 추첨 기록이 없습니다':'저장된 예선 추첨 기록이 없습니다'}</p></div>`;
    setModalFullscreenState('mDrawHistory', true);
    om('mDrawHistory');
    return;
  }
  box.innerHTML=list.map((it,idx)=>{
    const d=new Date(it.createdAt||Date.now());
    const isMain = String(it.mode||'')==='main';
    const rowTitle = it.title || ((isMain?'본선 추첨 ':'예선 추첨 ')+(list.length-idx));
    const metaText = isMain
      ? `${d.toLocaleString('ko-KR')} · 본선 ${(it.mainSize||it.plan?.n||0)}강`
      : `${d.toLocaleString('ko-KR')} · ${(it.groupCount||0)}조 · 본선 ${(it.mainSize||0)}강`;
    return `<div class="card" style="padding:14px 16px;margin-bottom:10px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <div style="font-weight:900;font-size:.94rem;color:var(--primary-dark)">${rowTitle}</div>
            <span class="badge ${it.isTest?'bg-bronze':'bg-green'}">${it.isTest?'🧪 테스트':'🔒 실운영'}</span>
            <span class="badge ${isMain?'bg-blue':'bg-gray'}">${isMain?'본선':'예선'}</span>
          </div>
          <div style="font-size:.76rem;color:var(--text2);margin-top:4px">${metaText}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-outline" style="font-size:.76rem;padding:5px 12px" onclick="openSavedDrawHistory('${it.id}','${key}')">📋 내용 보기</button>
          ${AD && it.isTest ? `<button class="btn btn-danger" style="font-size:.76rem;padding:5px 12px" onclick="deleteSavedDrawHistory('${it.id}','${key}')">🗑 삭제</button>` : ``}
          ${AD && !it.isTest ? `<button class="btn btn-outline" style="font-size:.76rem;padding:5px 12px;border-color:#c0392b;color:#c0392b;font-weight:800" onclick="forceDeleteSavedDrawHistory('${it.id}','${key}')">⚠️ 강제삭제</button>` : ``}
        </div>
      </div>
    </div>`;
  }).join('');
  setModalFullscreenState('mDrawHistory', true);
  om('mDrawHistory');
}

async function openLatestSavedDraw(tid,div,mode='prelim'){
  await ensureDrawHistoryLoaded();
  const key=tid+'_'+div;
  const wantMain = String(mode||'prelim')==='main';
  const entry=(G.drawHistories[key]||[])
    .filter(it=>!it.deleted)
    .filter(it=> wantMain ? String(it.mode||'')==='main' : String(it.mode||'')!=='main')
    .slice()
    .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0];
  if(!entry){ toast(wantMain?'저장된 본선 추첨 기록이 없습니다':'저장된 예선 추첨 기록이 없습니다','info'); return; }
  renderSavedDrawView(entry);
}

function openLatestMainSavedDraw(tid,div){
  openLatestSavedDraw(tid,div,'main');
}

async function deleteSavedDrawHistory(id,key){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const entry=(G.drawHistories[key]||[]).find(x=>x.id===id);
  if(!entry){ toast('추첨 기록을 찾을 수 없습니다','error'); return; }
  if(!entry.isTest){
    toast('실운영 추첨은 일반 삭제가 불가합니다. 관리자 강제삭제를 사용하세요.','error');
    return;
  }
  if(!confirm(`테스트 추첨 "${entry.title||'제목 없음'}" 을(를) 삭제하시겠습니까?\n삭제 기록은 남고 목록에서는 숨겨집니다.`)) return;
  sl(true);
  try{
    const deletedAt = new Date().toISOString();
    DRAW_HISTORY_LOADED=false;
    DRAW_HISTORY_LOADED=false;
    await updateDoc(doc(db,'drawHistory',id),{
      deleted:true,
      deletedAt,
      deletedBy:'admin',
      deleteReason:'test cleanup'
    });
    try{
      await addDoc(collection(db,'drawDeleteLog'),{
        drawHistoryId:id,
        key:key||entry.key||'',
        title:entry.title||'',
        tournamentId:entry.tournamentId||'',
        tournamentName:entry.tournamentName||'',
        division:entry.division||entry.div||'',
        isTest:true,
        forced:false,
        deletedAt,
        deletedBy:'admin',
        reason:'test cleanup'
      });
    }catch(logErr){
      console.warn('draw delete log save failed', logErr);
    }
    const arr=G.drawHistories[key]||[];
    const idx=arr.findIndex(x=>x.id===id);
    if(idx>=0){
      arr[idx]={...arr[idx], deleted:true, deletedAt, deletedBy:'admin', deleteReason:'test cleanup'};
    }
    sl(false);
    toast('테스트 추첨 기록을 삭제했습니다','success');
    openDrawHistory(entry.tournamentId||DW.tid, entry.division||entry.div||DW.div);
  }catch(e){
    sl(false);
    toast('삭제 실패: '+(e?.message||e),'error');
  }
}

async function forceDeleteSavedDrawHistory(id,key){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const entry=(G.drawHistories[key]||[]).find(x=>x.id===id);
  if(!entry){ toast('추첨 기록을 찾을 수 없습니다','error'); return; }
  if(entry.deleted){
    toast('이미 삭제된 기록입니다','info');
    return;
  }
  const title = entry.title||'제목 없음';
  const info = `${entry.tournamentName||''} ${dl(entry.division||entry.div||'')}`.trim();
  const firstOk = confirm(`⚠️ 실운영 추첨 강제삭제\n\n"${title}"\n${info?info+'\n':''}이 기록은 일반 삭제 대상이 아닙니다.\n정말 삭제하시겠습니까?`);
  if(!firstOk) return;
  const reason = (prompt('삭제 사유를 입력하세요.\n예: 테스트인데 체크 누락 / 잘못 저장됨', '테스트인데 체크 누락')||'').trim();
  if(!reason){
    toast('삭제 사유를 입력해야 강제삭제할 수 있습니다','error');
    return;
  }
  const secondOk = confirm(`마지막 확인입니다.\n\n"${title}"\n사유: ${reason}\n\n강제삭제하면 목록에서 숨겨지고 삭제 로그가 남습니다.`);
  if(!secondOk) return;
  sl(true);
  try{
    const deletedAt = new Date().toISOString();
    await updateDoc(doc(db,'drawHistory',id),{
      deleted:true,
      deletedAt,
      deletedBy:'admin_force',
      deleteReason:reason,
      forcedDelete:true
    });
    try{
      await addDoc(collection(db,'drawDeleteLog'),{
        drawHistoryId:id,
        key:key||entry.key||'',
        title:title,
        tournamentId:entry.tournamentId||'',
        tournamentName:entry.tournamentName||'',
        division:entry.division||entry.div||'',
        isTest:!!entry.isTest,
        forced:true,
        deletedAt,
        deletedBy:'admin_force',
        reason:reason
      });
    }catch(logErr){
      console.warn('draw delete log save failed', logErr);
    }
    const arr=G.drawHistories[key]||[];
    const idx=arr.findIndex(x=>x.id===id);
    if(idx>=0){
      arr[idx]={...arr[idx], deleted:true, deletedAt, deletedBy:'admin_force', deleteReason:reason, forcedDelete:true};
    }
    sl(false);
    toast('실운영 추첨 기록을 강제삭제했습니다. 삭제 로그는 남았습니다.','success');
    openDrawHistory(entry.tournamentId||DW.tid, entry.division||entry.div||DW.div);
  }catch(e){
    sl(false);
    toast('강제삭제 실패: '+(e?.message||e),'error');
  }
}



async function openDrawDeleteLog(key=''){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const useKey = key || DRAW_HISTORY_CTX_KEY || '';
  const titleEl=ge('drawDeleteLogTitle');
  const bodyEl=ge('drawDeleteLogBody');
  if(titleEl) titleEl.textContent = useKey ? '🧾 추첨 삭제 로그' : '🧾 전체 추첨 삭제 로그';
  if(bodyEl) bodyEl.innerHTML='<div class="card" style="padding:18px;text-align:center;color:var(--text2)">삭제 로그를 불러오는 중입니다…</div>';
  setModalFullscreenState('mDrawDeleteLog', true);
  om('mDrawDeleteLog');
  try{
    const snap = await getDocs(collection(db,'drawDeleteLog'));
    let rows = snap.docs.map(d=>({id:d.id, ...(d.data()||{})}));
    if(useKey) rows = rows.filter(r => (r.key||'')===useKey);
    rows.sort((a,b)=>String(b.deletedAt||b.createdAt||'').localeCompare(String(a.deletedAt||a.createdAt||'')));
    if(!rows.length){
      bodyEl.innerHTML='<div class="empty-state"><div class="empty-icon">🧾</div><p>삭제 로그가 없습니다</p></div>';
      return;
    }
    bodyEl.innerHTML = rows.map((r,idx)=>{
      const dt = new Date(r.deletedAt||r.createdAt||Date.now());
      const divLabel = dl(r.division||r.div||'') || (r.division||r.div||'');
      const who = r.deletedBy==='admin_force' ? '관리자 강제삭제' : (r.deletedBy||'admin');
      return `
        <div class="card" style="padding:14px 16px;margin-bottom:10px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <div style="flex:1;min-width:240px">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <div style="font-weight:900;font-size:.94rem;color:var(--primary-dark)">${r.title||('삭제 로그 '+(rows.length-idx))}</div>
                <span class="badge ${r.forced?'bg-red':'bg-bronze'}">${r.forced?'⚠️ 강제삭제':'🗑 일반삭제'}</span>
                <span class="badge ${r.isTest?'bg-bronze':'bg-green'}">${r.isTest?'🧪 테스트':'🔒 실운영'}</span>
              </div>
              <div style="font-size:.76rem;color:var(--text2);margin-top:4px">${dt.toLocaleString('ko-KR')} · ${r.tournamentName||''} ${divLabel?('· '+divLabel):''}</div>
              <div style="margin-top:8px;padding:10px 12px;background:var(--panel2);border:1px solid var(--border);border-radius:10px;font-size:.8rem;line-height:1.6">
                <div><b>삭제자:</b> ${who}</div>
                <div><b>삭제 사유:</b> ${r.reason||r.deleteReason||'-'}</div>
                ${r.key?`<div><b>기록 키:</b> ${r.key}</div>`:''}
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  }catch(e){
    console.error('openDrawDeleteLog failed', e);
    bodyEl.innerHTML='<div class="empty-state"><div class="empty-icon">⚠️</div><p>삭제 로그를 불러오지 못했습니다</p></div>';
    toast('삭제 로그 불러오기 실패: '+(e?.message||e),'error');
  }
}

window.openDrawHistory = openDrawHistory;
window.openDrawDeleteLog = openDrawDeleteLog;
window.openSavedDrawHistory = openSavedDrawHistory;
window.openLatestSavedDraw = openLatestSavedDraw;
window.deleteSavedDrawHistory = deleteSavedDrawHistory;
window.forceDeleteSavedDrawHistory = forceDeleteSavedDrawHistory;


// ═══════════════════════════════════════════════════════════════
// 개인전 전용 예선 추첨 시스템
// ═══════════════════════════════════════════════════════════════

// 개인전 조 구성 계산: 2팀/3팀 1조, 나머지 4팀이면 2+2
function calcIndivGroups(n, grpSize){
  // grpSize: 2 또는 3
  if(grpSize===2){
    // 전원 2팀씩 → 홀수면 마지막 1팀은 직전 조에 합류해 3팀 조 1개
    const groups=[];
    let rem=n;
    while(rem>=2){
      if(rem===3){ groups.push(3); rem=0; }
      else { groups.push(2); rem-=2; }
    }
    return groups;
  }
  // grpSize===3
  const groups=[];
  let rem=n;
  while(rem>0){
    if(rem===1){
      // 마지막 1팀 → 직전 2팀 조를 2팀×2개로 분리
      if(groups.length>=1 && groups[groups.length-1]===2){
        // 직전 조(2팀) + 이 1팀 → 2+1인데 이미 조가 2팀이므로 2팀 조 하나 더 추가 후 이 팀 넣기
        // 실제로는 마지막 조(2팀) 분리: 2팀→1팀씩 2조로 → 불가. 대신:
        // 뒤에서 2팀 조를 찾아서 그걸 2팀 조 유지하고 이 1팀을 별도 2팀 조에 배정
        // => 사실상 마지막 2팀 조(2팀) + 현재 1팀 = 3팀 → 3팀 1조로 처리
        const last=groups.pop(); // 2팀 조 제거
        groups.push(last+1);    // 3팀 조로 합침
        rem=0;
      } else {
        // 2팀 조 없으면 직전 3팀 조에서 1팀 빼서 2+2로
        if(groups.length>=1 && groups[groups.length-1]===3){
          groups[groups.length-1]=2;
          groups.push(2);
          rem=0;
        } else {
          groups.push(1); rem=0;
        }
      }
    } else if(rem===2){ groups.push(2); rem=0; }
    else if(rem===4){ groups.push(2); groups.push(2); rem=0; } // 4팀→2+2
    else { groups.push(3); rem-=3; }
  }
  return groups;
}

// 개인전 추첨 모달 열기
function openIndividualDraw(tid,div){
  const key=tid+'_'+div;
  const teams=G.teams[key]||[];
  const t=G.tournaments.find(t=>t.id===tid);
  if(teams.length<2){ toast('최소 2팀 필요','error'); return; }

  IDW={key,tid,div,teams,grpSize:2,isRunning:false,drawMode:'instant'};

  // 팀 목록 표시
  const listHTML=teams.map((tm,i)=>`<span class="badge bg-green" style="font-size:.78rem">${tdn(tm,key,i)}</span>`).join('');

  // 조 구성 미리보기 업데이트 함수
  function updatePreview(gs){
    const groups=calcIndivGroups(teams.length,gs);
    const g3=groups.filter(x=>x===3).length;
    const g2=groups.filter(x=>x===2).length;
    let desc='';
    if(g3&&g2) desc=`3팀 조 ${g3}개 + 2팀 조 ${g2}개`;
    else if(g3) desc=`3팀 조 ${g3}개`;
    else desc=`2팀 조 ${g2}개`;
    const adv=gs===2?'전원 본선':'각 조 1·2위 본선 (3위 탈락)';
    const el=document.getElementById('idwPreview');
    if(el) el.innerHTML=`<b>${desc}</b> · ${adv}`;
  }

  const modalHTML=`
    <div style="margin-bottom:14px;padding:10px 14px;background:var(--panel2);border-radius:var(--radius-lg);border:1px solid var(--border)">
      <div style="font-weight:700;font-size:.85rem;margin-bottom:8px">${tl(div)} — 등록 (${teams.length}조)</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">${listHTML}</div>
    </div>
    <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:12px">
      <div style="flex:1;min-width:200px">
        <label class="form-label">추첨 제목</label>
        <input class="form-input" id="idwTitle" placeholder="예: 전국신인부 예선 추첨">
      </div>
      <div style="min-width:180px;padding-bottom:6px">
        <label style="display:flex;align-items:center;gap:8px;font-size:.84rem;font-weight:800;cursor:pointer">
          <input type="checkbox" id="idwIsTest" style="accent-color:var(--accent)"> 테스트용 추첨
        </label>
        <div style="font-size:.72rem;color:var(--text3);margin-top:4px">테스트용만 삭제 가능</div>
      </div>
    </div>
    <div style="padding:12px 14px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border:1.5px solid #7dd3fc;border-radius:12px;margin-bottom:14px">
      <div style="font-weight:800;font-size:.88rem;margin-bottom:10px;color:#0369a1">⚙️ 조 편성 설정</div>
      <div style="margin-bottom:12px;padding:10px 12px;background:#fff;border:1px solid #bae6fd;border-radius:12px">
        <div style="font-size:.82rem;font-weight:800;color:#0f172a;margin-bottom:8px">🎰 추첨 표시 방식</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid var(--border);border-radius:999px;background:#fff;cursor:pointer;font-size:.82rem;font-weight:700">
            <input type="radio" name="idwDrawMode" value="roulette" style="accent-color:var(--accent)"> 룰렛으로 돌리기
          </label>
          <label style="display:flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid var(--border);border-radius:999px;background:#fff;cursor:pointer;font-size:.82rem;font-weight:700">
            <input type="radio" name="idwDrawMode" value="instant" checked style="accent-color:var(--accent)"> 바로 추첨 표시
          </label>
        </div>
        <div style="font-size:.72rem;color:var(--text3);margin-top:6px;line-height:1.55">개인전도 룰렛 연출 또는 즉시 표시 중에서 선택할 수 있습니다.</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
        <span style="font-size:.82rem;font-weight:700;color:var(--text2)">조당 팀수</span>
        <button id="idwBtn2" class="btn btn-accent" style="padding:6px 18px;font-size:.85rem" onclick="selectIndivGrpSize(2)">2팀 1조</button>
        <button id="idwBtn3" class="btn btn-outline" style="padding:6px 18px;font-size:.85rem" onclick="selectIndivGrpSize(3)">3팀 1조</button>
      </div>
      <div style="font-size:.82rem;padding:8px 12px;background:white;border-radius:8px;border:1px solid var(--border)" id="idwPreview">-</div>
      <div style="margin-top:10px;font-size:.78rem;color:#0369a1;line-height:1.7">
        <div>🏅 <b>2팀 1조</b> : 1경기 → 승=1위·패=2위 → <b>전원 본선 진출</b></div>
        <div>🏅 <b>3팀 1조</b> : 조별 리그 → <b>1·2위만 본선</b>, 3위 탈락</div>
        <div>⚖️ 개인전은 클럽이 아니라 접수된 페어(2인 1팀) 기준으로 무작위 배정됩니다</div>
        <div>🔢 4팀이 남을 경우 2팀 조 2개로 자동 처리됩니다</div>
      </div>
    </div>
    <div style="padding:10px 12px;background:linear-gradient(135deg,#fefce8,#fef9c3);border:1.5px solid #fde047;border-radius:12px;margin-bottom:6px">
      <div style="font-weight:800;font-size:.82rem;margin-bottom:6px;color:#854d0e">🌳 본선 대진 방식</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <label style="display:flex;align-items:center;gap:6px;font-size:.82rem;font-weight:700;cursor:pointer">
          <input type="radio" name="idwMainMode" value="redraw" id="idwRedraw" checked style="accent-color:var(--accent)">
          예선 후 본선 시드보호 재추첨
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:.82rem;font-weight:700;cursor:pointer">
          <input type="radio" name="idwMainMode" value="fixed" id="idwFixed" style="accent-color:var(--accent)">
          예선 추첨 시 본선 확정
        </label>
      </div>
      <div style="font-size:.74rem;color:#92400e;margin-top:6px;line-height:1.6">
        · <b>시드보호 재추첨</b>: 예선 종료 후 본선 대진을 다시 추첨하되, 시드는 보호한 채 나머지 자리만 재추첨<br>
        · <b>확정</b>: 예선 추첨과 동시에 본선 대진 확정 (조1위 부전승 우선)
      </div>
    </div>
    <div class="admin-block" style="margin-top:10px;padding:12px 14px;background:linear-gradient(135deg,#fff8df,#eef4ff);border:1.5px solid var(--accent);border-radius:12px">
      <div style="font-weight:900;font-size:.86rem;color:var(--primary-dark);margin-bottom:5px">🎯 본선 시드 배정 <span style="font-size:.72rem;font-weight:600;color:var(--text3)">(관리자 전용 · 최대 8번)</span></div>
      <div style="font-size:.75rem;color:var(--text2);line-height:1.6;margin-bottom:8px">
        관리자만 설정합니다. 형식: <b>팀번호=시드번호</b> (쉼표 구분) — 예: <code>12=1, 7=2, 3=3, 9=4</code><br>
        1·2 시드는 결승 전까지 만나지 않도록, 상위 시드끼리는 최대한 늦게 만나도록 본선 추첨에 반영됩니다.
      </div>
      <input class="form-input" id="idwSeedInput" placeholder="예: 12=1, 7=2, 3=3, 9=4  (미입력 시 시드 없이 추첨)" oninput="updateIdwSeedSummary()" style="margin-bottom:6px">
      <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <button type="button" class="btn btn-outline" style="font-size:.76rem;padding:5px 12px;min-height:34px" onclick="saveIdwSeedConfigFromModal()">💾 시드 저장</button>
      </div>
      <div id="idwSeedSummary" style="font-size:.72rem;color:var(--text3);line-height:1.55"></div>
    </div>`;

  // mDraw 모달 재활용
  const cfgScr=document.getElementById('drawCfgScreen');
  const runScr=document.getElementById('drawRunScreen');
  if(cfgScr){ cfgScr.innerHTML=modalHTML; cfgScr.style.display='block'; }
  if(runScr) runScr.style.display='none';

  document.getElementById('confirmDrawBtn').textContent='🎲 추첨 시작';
  document.getElementById('confirmDrawBtn').onclick=startIndividualDraw;
  document.getElementById('confirmDrawBtn').disabled=false;
  document.querySelector('#mDraw .modal-header h3').textContent='🎲 개인전 예선 추첨';
  om('mDraw');

  // 관리자만 시드 설정 블록 표시
  document.querySelectorAll('#drawCfgScreen .admin-block').forEach(el=>{ el.style.display = AD ? 'block' : 'none'; });
  // 기존 저장된 시드 복원
  const savedSeed=String((G.draws[key]||{}).mainSeedRaw||'').trim();
  const seedInput=ge('idwSeedInput');
  if(seedInput&&savedSeed) { seedInput.value=savedSeed; window.updateIdwSeedSummary(); }

  // 기본값 선택 표시
  updatePreview(2);
  window._idwUpdatePreview=updatePreview;
}

window.selectIndivGrpSize=function(gs){
  IDW.grpSize=gs;
  document.getElementById('idwBtn2').className='btn '+(gs===2?'btn-accent':'btn-outline');
  document.getElementById('idwBtn3').className='btn '+(gs===3?'btn-accent':'btn-outline');
  if(window._idwUpdatePreview) window._idwUpdatePreview(gs);
};

// 개인전 추첨 시드 요약 표시
window.updateIdwSeedSummary=function(){
  const summary=ge('idwSeedSummary');
  if(!summary) return;
  const key=IDW?.key||'';
  const teams=IDW?.teams||[];
  const raw=(AD ? (ge('idwSeedInput')?.value||'') : String((G.draws[key]||{}).mainSeedRaw||'')).trim();
  const entries=teams.map((tm,ti)=>({ti,nm:tdn(tm,key,ti)}));
  const seedMap=parseManualSeedMapFromText(raw, entries);
  const pairs=Object.entries(seedMap).map(([ti,seedNo])=>{
    const idx=Number(ti);
    return teams[idx]?`#${idx+1} ${tdn(teams[idx],key,idx)} → ${seedNo}번 시드`:'';
  }).filter(Boolean).sort((a,b)=>{
    const sa=parseInt((a.match(/(\d+)번 시드/)||[])[1]||'999',10);
    const sb=parseInt((b.match(/(\d+)번 시드/)||[])[1]||'999',10);
    return sa-sb;
  });
  summary.innerHTML=pairs.length
    ? `<span style="color:#92400e;font-weight:700">설정됨: ${pairs.join(' / ')}</span>`
    : '관리자만 설정할 수 있습니다. 저장된 시드가 없으면 시드 없이 추첨됩니다. 저장 후에는 추첨을 안 해도 계속 유지되며 예선 분산과 본선 시드에 함께 반영됩니다.';
};

function tl(div){ return dl ? dl(div) : div; }

let IDW={key:'',tid:'',div:'',teams:[],grpSize:2,isRunning:false};

async function startIndividualDraw(){
  if(IDW.isRunning) return;
  if(!IDW.key||IDW.teams.length<2){ toast('최소 2팀 필요','error'); return; }
  IDW.isRunning=true;
  const btn=document.getElementById('confirmDrawBtn');
  btn.disabled=true; btn.textContent='추첨 중...';

  const key=IDW.key, teams=IDW.teams, tid=IDW.tid, div=IDW.div;
  const gs=IDW.grpSize;
  const drawMode=document.querySelector('input[name="idwDrawMode"]:checked')?.value||'instant';
  IDW.drawMode=drawMode;
  const mainMode=document.querySelector('input[name="idwMainMode"]:checked')?.value||'redraw';
  const drawTitle=(document.getElementById('idwTitle')?.value||`${tl(div)} 예선 추첨`).trim();
  const drawIsTest=!!document.getElementById('idwIsTest')?.checked;
  const drawTime=new Date();

  await resetMatchRecords(key);

  // 조 크기 배열 계산
  const grpSizes=calcIndivGroups(teams.length,gs);
  const ng=grpSizes.length;

  // 개인전도 시드팀 자동 분산 + 같은 클럽(소속) 회피를 적용한다.
  // targetGroups(최종 배정)와 runGroups(애니메이션용 빈 그룹)를 분리한다.
  const indices=teams.map((_,i)=>i);
  const prelimSeedRaw=(AD ? (ge('idwSeedInput')?.value||'') : String((G.draws[key]||{}).mainSeedRaw||'')).trim();
  const prelimSeedMap=prelimSeedRaw
    ? parseManualSeedMapFromText(prelimSeedRaw, teams.map((tm,ti)=>({ti,nm:tdn(tm,key,ti)})))
    : {};
  const targetGroups=getPrelimSeedDistributedGroups(indices, teams, grpSizes, prelimSeedMap);
  const runGroups=grpSizes.map((size,gi)=>({gi,size,teams:[]}));

  // 추첨 애니메이션 화면으로 전환
  switchToRunScreen();

  // 조 슬롯 UI 렌더링
  document.getElementById('drawGroupRows').innerHTML=targetGroups.map((g,gi)=>`
    <div class="draw-group-row" id="dg_${gi}" style="overflow:visible">
      <div class="draw-group-label">${grpLabel(gi)} (${g.size}팀)</div>
      <div id="dg_slots_${gi}" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
        ${Array(g.size).fill(0).map(()=>`<span class="draw-team-slot">?</span>`).join('')}
      </div>
    </div>`).join('');

  // 배정 순서: 최종 배정 결과를 슬롯 순서로 펼친다.
  const assignOrder=groupsToAssignmentOrder(targetGroups);

  for(let i=0;i<assignOrder.length;i++){
    const {gi,ti}=assignOrder[i];
    const team=teams[ti];
    const dn=tdn(team,key,ti);
    document.getElementById('drawProgressBar').style.width=`${Math.round((i+1)/assignOrder.length*100)}%`;
    activateSlot(gi);
    initDrawStage(i+1,assignOrder.length,gi);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

    const stageEl=document.getElementById('drawStageContent');
    const pool=assignOrder.slice(i).map(a=>tdn(teams[a.ti],key,a.ti));

    if(String(drawMode||'roulette') === 'instant'){
      if(stageEl){
        stageEl.innerHTML=`<div style="padding:18px 16px;border:1.5px solid var(--border);border-radius:16px;background:linear-gradient(135deg,#f8fbff,#fff8df);text-align:center">
          <div style="font-size:.82rem;color:var(--text2);font-weight:800;margin-bottom:8px">${grpLabel(gi)} 배정</div>
          <div style="font-size:1.06rem;font-weight:900;color:var(--primary-dark);line-height:1.55">${dn}</div>
        </div>`;
      }
      fillSlotWithLeaf(gi,dn,false);
      const g=runGroups[gi];
      g.teams.push(ti);
      if(g.teams.length>=g.size){ await sleep(120); await celebrateGroupComplete(gi); }
      else await sleep(70);
      continue;
    }

    const rWrap=stageEl && stageEl._rouletteId ? document.getElementById(stageEl._rouletteId) : null;
    await runRoulette(rWrap,pool,dn,1400+randInt(800));
    await sleep(180);
    const g=runGroups[gi];
    const leafEl=stageEl && stageEl._leafId ? document.getElementById(stageEl._leafId) : null;
    await leafLandReveal(leafEl,dn,false);
    fillSlotWithLeaf(gi,dn,false);
    g.teams.push(ti);
    if(g.teams.length>=g.size){ await sleep(260); await celebrateGroupComplete(gi); }
    else await sleep(140);
  }

  document.getElementById('drawProgressBar').style.width='100%';
  document.getElementById('drawStageContent').innerHTML=`<div style="font-size:1.1rem;font-weight:800;color:var(--success);margin:10px 0;text-align:center">🎉 추첨 완료!</div><div style="font-size:.8rem;color:var(--text2);text-align:center">${drawTime.toLocaleString('ko-KR')} 추첨</div>`;
  await sleep(400);

  const groupData=runGroups.map(g=>({teams:[...g.teams],courts:[],memo:''}));
  G.draws[key]={groups:groupData,advance:2,indivMode:true,grpSize:gs,mainMode,
    mainSeedRaw:prelimSeedRaw,mainSeedMap:prelimSeedMap,
    groupDrawAudit:{mode:'seeded_balanced',modeLabel:'시드 자동분산 + 같은클럽 회피',loggedAt:drawTime.toISOString()}};

  // 예선 경기 생성 (2팀 조: 1경기, 3팀 조: 3경기)
  const mlist=[];
  groupData.forEach((grp,gi)=>{
    for(let a=0;a<grp.teams.length;a++)
      for(let b=a+1;b<grp.teams.length;b++)
        mlist.push({id:`g_${gi}_${a}_${b}`,phase:'group',group:gi,t1:grp.teams[a],t2:grp.teams[b],winner:null,rubbers:[],court:''});
  });

  // 본선 확정 모드: 예선 추첨 시 본선 대진 미리 생성
  if(mainMode==='fixed'){
    const advEntries=[];
    groupData.forEach((grp,gi)=>{
      const grpSz=grp.teams.length;
      const adv=grpSz<=2?grpSz:2;
      for(let rk=1;rk<=adv;rk++) advEntries.push({ti:null,nm:`${grpLabel(gi)} ${rk}위`,gn:gi+1,rk,grpSize:grpSz,placeholder:true});
    });
    const totalAdv=advEntries.length;
    const bracketN=nextPow2(totalAdv);
    const mainMatches=buildIndivMainMatchesFromSlots(advEntries,bracketN,key);
    mlist.push(...mainMatches);
  }

  G.matches[key]=mlist;

  const t=G.tournaments.find(t=>t.id===tid);
  sl(true);
  try{
    await stD(key); await stM(key);
    const preview=buildIndivMainPreview(groupData,gs);
    await saveDrawHistoryEntry({
      key, tournamentId:tid, tournamentName:t?.name||'',
      division:div, div, title:drawTitle, isTest:drawIsTest,
      createdAt:drawTime.toISOString(),
      groupCount:ng, groupSizes:grpSizes, advance:2,
      mainSize:preview.totalAdv||0, mainPreviewSlots:[],
      groups:groupData.map((g,gi)=>({
        label:grpLabel(gi),
        teams:g.teams.map(ti=>({name:tdn(teams[ti],key,ti),club:String(teams[ti]?.club||'')}))
      })),
      indivMode:true, grpSize:gs, mainMode
    });
    await fbLog(`개인전추첨: ${t?.name||''} ${tl(div)} ${ng}조 / ${gs}팀1조 / ${drawIsTest?'테스트':'실운영'} / ${drawTitle} / ${drawTime.toLocaleString('ko-KR')}`,'🎲');
    sl(false);
    btn.textContent='✅ 닫기';
    btn.onclick=()=>{cm('mDraw');renderBracket();};
    btn.disabled=false;
    IDW.isRunning=false;
    SFX.finale();
    toast('추첨 완료 🎲','success');
    refreshRunPreview(key);
  }catch(e){
    sl(false); IDW.isRunning=false;
    const msg=e?.code==='permission-denied'?'권한 없음':(e?.message||'저장 실패');
    toast('저장 실패: '+msg,'error');
    btn.textContent='⚠️ 다시 시도';
    btn.onclick=()=>{IDW.isRunning=false;startIndividualDraw();};
    btn.disabled=false;
  }
}

// 개인전 본선 대진 슬롯 구성 (조1위 부전승 우선, 없으면 조1vs조2)
function buildIndivMainMatchesFromSlots(advEntries,bracketN,key){
  // play-in(진출전) 구조 계산
  const spec=computeMainBracketSpec(advEntries.length);
  const hasPlayIn=spec.playInTeams>0;

  // ── play-in 없는 경우 ──────────────────────────────────
  if(!hasPlayIn){
    const matchCount=bracketN/2;
    const byeCount=bracketN-advEntries.length;
    const byeIdxs=pickByeMatchIndices(matchCount,byeCount);
    const byeSet=new Set(byeIdxs);
    const normalIdxs=hybridSpreadOrder(matchCount).filter(i=>!byeSet.has(i));
    const slots=Array.from({length:matchCount},(_,i)=>({
      id:`main_${i}`,phase:'main',round:0,slot:i,
      t1:null,t2:null,winner:null,rubbers:[],court:'',courts:[],
      bye:byeSet.has(i)
    }));
    let rank1=advEntries.filter(e=>e.rk===1);
    let rank2=advEntries.filter(e=>e.rk===2);
    // 부전승: 조1위 → 조2위 순
    for(const si of byeIdxs){
      const picked=rank1.shift()||rank2.shift()||null;
      if(picked){ slots[si].t1=picked.ti; slots[si].winner=picked.ti; }
    }
    // 일반 슬롯: 조1위 vs 조2위 (같은 조 피함)
    for(const si of normalIdxs){ const p1=rank1.shift()||null; if(p1) slots[si].t1=p1.ti; }
    for(const si of normalIdxs){
      if(slots[si].t1===null) continue;
      const t1gn=advEntries.find(e=>e.ti===slots[si].t1)?.gn;
      const opp=removeFirstMatch(rank2,e=>e&&e.gn!==t1gn)||rank2.shift()||null;
      if(opp) slots[si].t2=opp.ti;
    }
    const leftover=[...rank1,...rank2];
    for(const si of normalIdxs){
      if(slots[si].t1===null){ const p=leftover.shift(); if(p) slots[si].t1=p.ti; }
      if(!slots[si].bye&&slots[si].t2===null){ const p=leftover.shift(); if(p) slots[si].t2=p.ti; }
    }
    // 토너먼트 트리 (round 0→1→2... 생성)
    return _buildTournamentRounds(slots, matchCount);
  }

  // ── play-in 있는 경우 (똥통 방식) ────────────────────
  // 2위팀 중 일부만 진출전 → 이긴 팀이 본선(spec.mainSize강) 합류
  const rank2s=advEntries.filter(e=>e.rk!==1);
  const playInEntries=rank2s.slice(0, spec.playInTeams);
  const directEntries=advEntries.filter(e=>!playInEntries.includes(e));
  // 진출전 경기 생성 (phase='playin')
  const playInMs=[];
  for(let i=0;i<spec.playInMatches;i++){
    playInMs.push({
      id:`playin_${i}_${Date.now()}`,phase:'playin',round:0,slot:i,
      t1:playInEntries[i*2]?.ti??null,
      t2:playInEntries[i*2+1]?.ti??null,
      winner:null,rubbers:[],court:'',courts:[],bye:false,
      source1Label:playInEntries[i*2]?.nm||'TBD',
      source2Label:playInEntries[i*2+1]?.nm||'TBD',
      winnerLabel:`${spec.mainSize}강 합류`,
      playInId:i+1
    });
  }
  // 본선 슬롯: directEntries + 진출전 승자 플레이스홀더
  const placeholders=Array.from({length:spec.winnersNeeded},(_,i)=>({
    ti:null,nm:`진출전 승자${i+1}`,gn:null,rk:99,placeholder:true,playInPlaceholder:true,playInId:i+1
  }));
  const mainEntries=[...directEntries,...placeholders];
  const mainMatchCount=spec.mainSize/2;
  const byeCount=spec.mainSize-mainEntries.length;
  const byeIdxs=pickByeMatchIndices(mainMatchCount,byeCount);
  const byeSet=new Set(byeIdxs);
  const normalIdxs=hybridSpreadOrder(mainMatchCount).filter(i=>!byeSet.has(i));
  const slots=Array.from({length:mainMatchCount},(_,i)=>({
    id:`main_${i}`,phase:'main',round:0,slot:i,
    t1:null,t2:null,winner:null,rubbers:[],court:'',courts:[],
    bye:byeSet.has(i)
  }));
  let r1=mainEntries.filter(e=>e.rk===1||e.playInPlaceholder);
  let r2=mainEntries.filter(e=>e.rk!==1&&!e.playInPlaceholder);
  for(const si of byeIdxs){
    const picked=r1.shift()||r2.shift()||null;
    if(picked&&!picked.playInPlaceholder){ slots[si].t1=picked.ti; slots[si].winner=picked.ti; }
  }
  for(const si of normalIdxs){ const p1=r1.shift()||null; if(p1&&!p1.playInPlaceholder) slots[si].t1=p1.ti; }
  for(const si of normalIdxs){
    if(slots[si].t1===null) continue;
    const t1gn=mainEntries.find(e=>e.ti===slots[si].t1)?.gn;
    const opp=removeFirstMatch(r2,e=>e&&e.gn!==t1gn)||r2.shift()||null;
    if(opp) slots[si].t2=opp.ti;
  }
  const leftover=[...r1,...r2];
  for(const si of normalIdxs){
    if(slots[si].t1===null){ const p=leftover.shift(); if(p&&!p.playInPlaceholder) slots[si].t1=p.ti; }
    if(!slots[si].bye&&slots[si].t2===null){ const p=leftover.shift(); if(p) slots[si].t2=p.ti; }
  }
  return [...playInMs, ..._buildTournamentRounds(slots, mainMatchCount)];
}

// 토너먼트 트리 round 부여 (round=0→1→2...)
function _buildTournamentRounds(slots, matchCount){
  slots.forEach((s,i)=>{ s.round=0; s.slot=i; });
  const result=[...slots];
  let prevRound=slots;
  let round=1;
  while(prevRound.length>1){
    const nextRound=[];
    for(let i=0;i<prevRound.length;i+=2){
      const m={id:`main_r${round}_${Math.floor(i/2)}_${Date.now()}`,phase:'main',round,slot:Math.floor(i/2),t1:null,t2:null,winner:null,rubbers:[],court:'',courts:[],bye:false};
      nextRound.push(m);
      result.push(m);
    }
    prevRound=nextRound;
    round++;
  }
  return result;
}

function buildIndivMainPreview(groupData,gs){
  let totalAdv=0;
  groupData.forEach(grp=>{ totalAdv+=grp.teams.length<=2?grp.teams.length:2; });
  return {totalAdv};
}

function buildIndivRedrawPreviewData(groupData, gs){
  const advEntries=[];
  (groupData||[]).forEach((grp,gi)=>{
    const grpSz=(grp?.teams||[]).length || Number(gs||0) || 0;
    const adv=grpSz<=2 ? grpSz : 2;
    for(let rk=1; rk<=adv; rk++){
      advEntries.push({nm:`${grpLabel(gi)} ${rk}위`,gn:gi+1,rk,placeholder:true});
    }
  });
  const totalAdv=advEntries.length;
  const spec=computeMainBracketSpec(totalAdv);
  const matchSlots=Array.from({length:Math.max(1,(spec.mainSize||0)/2)},(_,i)=>({
    id:`preview_main_${i}`, bye:false, t1:null, t2:null,
    source1Label:'추첨 대기', source2Label:'추첨 대기'
  }));
  const playInMatches=(spec.playInMatches>0)
    ? Array.from({length:spec.playInMatches},(_,i)=>({
        id:`preview_playin_${i}`,
        t1:{nm:'2위팀'},
        t2:{nm:'2위팀'},
        winnerLabel:`진출전 승자${i+1}`,
        playInId:i+1,
        targetSlot:i,
        targetSide:'t1'
      }))
    : [];
  return {totalAdv, spec, matchSlots, playInMatches};
}

async function startDraw(){
  if(DW.isRunning)return;
  if(!DW.key||DW.teams.length<2){toast('최소 2팀 필요','error');return;}
  DW.isRunning=true;
  ge('confirmDrawBtn').disabled=true;
  ge('confirmDrawBtn').textContent='추첨 중...';
  switchToRunScreen();

  const key=DW.key, teams=DW.teams, {groups:ng,grpSizes,advance}=DW.cfg;
  const drawTitle=(ge('drawTitleInput')?.value||`${dl(DW.div)} 추첨`).trim()||`${dl(DW.div)} 추첨`;
  const drawIsTest=!!ge('drawIsTestInput')?.checked;
  await resetMatchRecords(key);

  // 시드 자동 분산 + 같은 클럽 회피 예선 추첨
  const drawTime = new Date();
  const indices = teams.map((_,i)=>i);
  const prelimSeedRaw=(AD ? (ge('drawMainManualSeedsInput')?.value||'') : String((G.draws[key]||{}).mainSeedRaw||'')).trim();
  const prelimSeedMap=getPrelimManualSeedMap();
  const allowedCourts=getDrawAllowedCourtsFromModal();
  const seededPrelimGroups=getPrelimSeedDistributedGroups(indices, teams, grpSizes, prelimSeedMap);
  const shuffled=groupsToAssignmentOrder(seededPrelimGroups).map(x=>x.ti);

  const grps = grpSizes.map((size,gi)=>({teams:[],size,gi}));
  const assignPairs=groupsToAssignmentOrder(seededPrelimGroups);

  ge('drawGroupRows').innerHTML=grps.map((_,gi)=>`
    <div class="draw-group-row" id="dg_${gi}" style="overflow:visible">
      <div class="draw-group-label">${grpLabel(gi)}</div>
      <div id="dg_slots_${gi}" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
        ${Array(grps[gi].size).fill(0).map(()=>`<span class="draw-team-slot">?</span>`).join('')}
      </div>
    </div>`).join('');

  for(let i=0;i<assignPairs.length;i++){
    const gi=assignPairs[i].gi;
    const ti=assignPairs[i].ti;
    const team=teams[ti];
    const dn=tdn(team,key,ti);
    ge('drawProgressBar').style.width=`${Math.round((i+1)/shuffled.length*100)}%`;
    activateSlot(gi);
    initDrawStage(i+1, shuffled.length, gi);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const stageEl=ge('drawStageContent');
    const rWrap=stageEl?document.getElementById(stageEl._rouletteId):null;
    const pool=shuffled.slice(i).map(tj=>tdn(teams[tj],key,tj));
    await runRoulette(rWrap, pool, dn, 1400+randInt(800));
    await sleep(180);
    const sameClub=grps[gi].teams.some(idx=>getTeamClubTokens(teams[idx]||{}).some(c=>getTeamClubTokens(team||{}).includes(c)));
    const leafEl=stageEl?document.getElementById(stageEl._leafId):null;
    await leafLandReveal(leafEl, dn, sameClub);
    fillSlotWithLeaf(gi, dn, sameClub);
    grps[gi].teams.push(ti);
    if(grps[gi].teams.length>=grps[gi].size){ await sleep(260); await celebrateGroupComplete(gi); }
    else { await sleep(140); }
  }

  ge('drawProgressBar').style.width='100%';
  ge('drawStageContent').innerHTML=`<div style="font-size:1.1rem;font-weight:800;color:var(--success);margin:10px 0;text-align:center">🎉 추첨 완료!</div><div style="font-size:.8rem;color:var(--text2);text-align:center">${drawTime.toLocaleString('ko-KR')} 시드 자동분산 + 같은클럽 회피 추첨</div>`;
  await sleep(400);

  const audit={mode:'seeded_balanced',modeLabel:'시드 자동분산 + 같은클럽 회피',loggedAt:drawTime.toISOString()};
  DW.drawAudit=audit;
  const groupData=grps.map(g=>({teams:g.teams,courts:[],memo:''}));
  G.draws[key]={groups:groupData,shuffled,advance,groupDrawAudit:audit,mainSeedRaw:prelimSeedRaw,mainSeedMap:prelimSeedMap,allowedCourts};
  const mlist=[];
  groupData.forEach((grp,gi)=>{
    for(let a=0;a<grp.teams.length;a++)
      for(let b=a+1;b<grp.teams.length;b++)
        mlist.push({id:`g_${gi}_${a}_${b}`,phase:'group',group:gi,t1:grp.teams[a],t2:grp.teams[b],winner:null,rubbers:[],court:''});
  });
  G.matches[key]=mlist;

  const t=G.tournaments.find(t=>t.id===DW.tid);
  if(t){
    if(!t.divSettings)t.divSettings={};
    if(!t.divSettings[DW.div])t.divSettings[DW.div]={};
    t.divSettings[DW.div].advance=advance;
  }
  sl(true);
  try{
    await stD(key); await stM(key);
    const preview=buildPreviewMainSlots(G.draws[key],{advance});
    await saveDrawHistoryEntry({
      key,
      tournamentId: DW.tid,
      tournamentName: t?.name||'',
      division: DW.div,
      div: DW.div,
      title: drawTitle,
      isTest: drawIsTest,
      createdAt: drawTime.toISOString(),
      groupCount: ng,
      groupSizes: grpSizes,
      advance,
      mainSize: preview.n||0,
      mainPreviewSlots: preview.matchSlots||[],
      groups: groupData.map((g,gi)=>({
        label: grpLabel(gi),
        teams: g.teams.map(ti=>({name:tdn(teams[ti],key,ti), club:String(teams[ti]?.club||'')}))
      }))
    });
    await fbLog(`추첨완료: ${t?.name||''} ${dl(DW.div)} ${ng}조 / ${drawIsTest?'테스트':'실운영'} / 무작위 / ${drawTitle} / ${drawTime.toLocaleString('ko-KR')}`,'🎲');
    sl(false);
    ge('confirmDrawBtn').textContent='✅ 닫기';
    ge('confirmDrawBtn').onclick=()=>{cm('mDraw');renderBracket();};
    ge('confirmDrawBtn').disabled=false;
    DW.isRunning=false;
    SFX.finale();
    toast('추첨 완료 🎲','success');
    refreshRunPreview(key);
  }catch(e){
    sl(false); DW.isRunning=false;
    const msg=e?.code==='permission-denied'?'권한 없음 — 관리자 로그인 필요':(e?.message||'저장 실패');
    toast('저장 실패: '+msg,'error');
    ge('confirmDrawBtn').textContent='⚠️ 다시 시도';
    ge('confirmDrawBtn').onclick=()=>{DW.isRunning=false;startDraw();};
    ge('confirmDrawBtn').disabled=false;
  }
}
async function confirmDraw(){startDraw();}

// ═══════════════════════════════════════════════════════
//  본선 대진표 공개형 추첨
//  - 공개 변수(1~10) 기반 재현형 추첨
//  - 한 자리씩 실시간 공개
//  - 같은 변수값이면 같은 결과 재현
// ═══════════════════════════════════════════════════════
let MD = {key:null,tid:null,div:null,advT:[],bracketSize:0,byeCount:0,isRunning:false,seed:1,plan:null,seedHash:'',seedMethod:'time',seedSourceLabel:'',seedSnapshotLabel:'',seedPreparedAt:'',nthPick:1,candidates:[],drawAudit:null};

async function buildMain(tid,div){
  const t=G.tournaments.find(x=>x.id===tid);
  if(isIndividualTournament(t)){ openIndividualMainDraw(tid,div); return; }
  openMainDraw(tid,div);
}

// 개인전 본선 재추첨
function openIndividualMainDraw(tid,div){
  const key=tid+'_'+div;
  const teams=G.teams[key]||[];
  const draw=G.draws[key];
  const t=G.tournaments.find(x=>x.id===tid);
  const cfg=gDS(t,div);
  if(!draw){ toast('예선 추첨을 먼저 진행해주세요','error'); return; }

  // 예선 완료 여부 체크
  const allMs=G.matches[key]||[];
  const gMs=allMs.filter(m=>m.phase==='group');
  const gDone=gMs.filter(m=>getMatchResultState(key,m).done).length;
  const isPrelimDone = gMs.length>0 && gDone===gMs.length;

  const advT=getAdvT(key,draw,teams,cfg);
  if(!advT.length){ toast('예선 진출팀이 없습니다','error'); return; }

  const spec=computeMainBracketSpec(advT.length);
  const bracketN=spec.playInTeams>0 ? spec.mainSize : nextPow2(advT.length);

  // 예선 미완료 시 안내 메시지 추가
  const prelimWarnMsg = isPrelimDone ? '' :
    `\n⚠️ 예선이 아직 진행 중입니다.\n대진표에는 이름 대신 "A조1위", "C조2위" 형태로 표시되고\n예선 결과가 확정되면 실제 이름으로 자동 업데이트됩니다.`;

  const confirmMsg=(spec.playInMatches>0
    ? `본선 대진을 추첨합니다.\n진출 ${advT.length}팀 → ${spec.mainSize}강 + 진출전 ${spec.playInMatches}경기\n기존 본선 결과가 초기화됩니다.`
    : `본선 대진을 추첨합니다.\n진출 ${advT.length}팀 → ${bracketN}강 (부전승 ${nextPow2(advT.length)-advT.length}팀)\n기존 본선 결과가 초기화됩니다.`)
    + prelimWarnMsg + '\n\n계속하시겠습니까?';
  if(!confirm(confirmMsg)) return;

  // 기존 본선/진출전 경기 제거, 새로 생성
  // 예선 미완료 시 groupLabelOnly=true → 이름 대신 조 순위 레이블만 저장
  const groupMs=allMs.filter(m=>m.phase==='group');
  const mainMatches=buildIndivMainMatchesFixed(advT, key, teams, !isPrelimDone);
  G.matches[key]=[...groupMs,...mainMatches];

  sl(true);
  stM(key).then(()=>{
    sl(false);
    try{
      setMainSectionCollapsed(key,false);
      const selectedMain=getSelectedMainMatchFilters(key)||[];
      if(Array.isArray(selectedMain) && selectedMain.length){
        setSelectedMainMatchFilters(key,[]);
      }
    }catch(e){}
    toast(isPrelimDone ? '본선 대진 추첨 완료' : '본선 대진 추첨 완료 (조 순위 표시 — 예선 완료 후 이름 확정)','success');
    try{ renderBracket(); }catch(e){}
  }).catch(e=>{ sl(false); toast('저장 실패: '+e.message,'error'); });
}

// 개인전 본선 대진 생성 — play-in 포함
// groupLabelOnly=true: 예선 미완료 시 ti 대신 null, source*Label에 "A조1위" 형태만 저장
function buildIndivMainMatchesFixed(advT, key, teams, groupLabelOnly=false){
  const seededEntries=(advT||[]).map(e=>({
    ...e,
    nm:e.nm||getMainEntryBracketLabel(e)||`T${e.ti??''}`,
    _groupLabel:`${grpLabel((e.gn||1)-1)} ${e.rk}위`
  }));
  const plan=buildSeededMainSlots(seededEntries, nextPow2(Math.max(2, seededEntries.length)), Date.now()%10+1, key, 'individual');
  let matches=buildMainMatches((plan?.matchSlots)||[], plan?.n||0, (plan?.playInMatches)||[]);

  if(groupLabelOnly){
    const labelByTeam=new Map();
    seededEntries.forEach(e=>{ if(e && e.ti!=null) labelByTeam.set(Number(e.ti), String(e._groupLabel||e.nm||'')); });
    matches=matches.map(m=>{
      const out={...m};
      if(out.phase==='playin'){
        if(out.t1!=null) out.source1Label = labelByTeam.get(Number(out.t1)) || out.source1Label || 'TBD';
        if(out.t2!=null) out.source2Label = labelByTeam.get(Number(out.t2)) || out.source2Label || 'TBD';
        out.t1=null;
        out.t2=null;
        out.winner=null;
      }else if(out.phase==='main' && Number(out.round||0)===0){
        if(out.t1!=null) out.source1Label = labelByTeam.get(Number(out.t1)) || out.source1Label || '';
        if(out.t2!=null) out.source2Label = labelByTeam.get(Number(out.t2)) || out.source2Label || '';
        if(out.source1PlayInId) out.source1Label = `진출전 승자${out.source1PlayInId}`;
        if(out.source2PlayInId) out.source2Label = out.bye ? '부전승' : `진출전 승자${out.source2PlayInId}`;
        out.t1=null;
        out.t2=null;
        out.winner=null;
      }
      return out;
    });
  }
  return matches;
}


function buildTournamentTree(slots, matchCount){
  // 이미 round=0, slot=i 부여됨. 상위 라운드 매치 생성
  const result=[...slots];
  let prevRound=slots;
  let round=1;
  while(prevRound.length>1){
    const nextRound=[];
    for(let i=0;i<prevRound.length;i+=2){
      const m={id:`main_r${round}_${i/2}_${Date.now()}`,phase:'main',round,slot:Math.floor(i/2),t1:null,t2:null,winner:null,rubbers:[],court:'',courts:[],bye:false};
      nextRound.push(m);
      result.push(m);
    }
    prevRound=nextRound;
    round++;
  }
  return result;
}


function clampMainSeed(v){
  const n=parseInt(v,10);
  if(Number.isNaN(n)) return 1;
  return Math.max(1, Math.min(10, n));
}
function getMainSeed(){
  return clampMainSeed(ge('mainSeedInput')?.value||1);
}
function setMainSeed(v){
  const n=clampMainSeed(v);
  if(ge('mainSeedInput')) ge('mainSeedInput').value=String(n);
  return n;
}
function randomizeMainSeed(){
  prepareMainExternalDraw(true);
}
function getMainSeedMethod(){
  return ge('mainExternalMode')?.value||'time';
}
function getMainNth(){
  const n=parseInt(ge('mainDrawNth')?.value||'1',10);
  return Math.max(1, Math.min(10, Number.isNaN(n)?1:n));
}
function computeExternalSeed(method){
  if(method==='random'){
    let raw=Math.floor(Math.random()*1000000);
    try{
      const arr=new Uint32Array(1);
      crypto.getRandomValues(arr);
      raw=arr[0]>>>0;
    }catch(e){}
    return {seed:(raw%10)+1, sourceLabel:'브라우저 난수', snapshotLabel:`난수 추첨 완료`, rawValue:String(raw)};
  }
  const now=new Date();
  const sec=now.getSeconds();
  return {seed:(sec%10)+1, sourceLabel:'현재 시각 초', snapshotLabel:`현재 시각 ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(sec).padStart(2,'0')} 기준 확정`, rawValue:String(sec)};
}
function buildNthMainPlan(entries, n, baseSeed, nth, tid, div){
  const candidates=[];
  for(let i=1;i<=10;i++){
    const candidateSeed=((baseSeed-1 + ((i-1)*7)) % 10) + 1;
    const plan=buildSeededMainSlots(entries, n, candidateSeed, tid, div);
    candidates.push({index:i, seed:candidateSeed, plan});
  }
  const chosen=candidates[Math.max(0, Math.min(candidates.length-1, nth-1))];
  return {candidates, chosen};
}

function updateMainManualSeeds(){
  try{
    if(!MD || !MD.advT) return;
    MD.manualSeedMap=getMainManualSeedMap(MD.advT);
    const pairs=Object.entries(MD.manualSeedMap||{}).map(([ti, seedNo])=>{
      const found=(MD.advT||[]).find(a=>Number(a?.ti)===Number(ti));
      return found ? `#${Number(found.ti)+1} ${found.nm} → ${seedNo}번 시드` : '';
    }).filter(Boolean).sort((a,b)=>{
      const sa=parseInt((a.match(/(\d+)번 시드/)||[])[1]||'999',10);
      const sb=parseInt((b.match(/(\d+)번 시드/)||[])[1]||'999',10);
      return sa-sb;
    });
    const summary=ge('mainManualSeedsSummary');
    if(summary){
      summary.innerHTML=pairs.length
        ? `예선 추첨에서 설정된 시드: <b>${pairs.join(' / ')}</b><br><span style="color:#8a6412">1·2 시드는 결승 전까지, 상위 시드는 최대한 늦게 만나도록 배치합니다.</span>`
        : '예선 추첨 단계에서 저장된 시드가 없습니다. 일반 본선 추첨으로 진행됩니다.';
    }
    MD.plan=null;
    updateMainSeedPreview();
  }catch(e){}
}

function prepareMainExternalDraw(forceNew=false){
  if(!MD.advT || !MD.advT.length) return null;
  const method=getMainSeedMethod();
  const nth=getMainNth();
  const needNew = forceNew || !MD.seedPreparedAt || MD.seedMethod!==method;
  if(needNew){
    const ext=computeExternalSeed(method);
    MD.seed=ext.seed;
    MD.seedMethod=method;
    MD.seedSourceLabel=ext.sourceLabel;
    MD.seedSnapshotLabel=ext.snapshotLabel;
    MD.seedPreparedAt=new Date().toISOString();
    setMainSeed(ext.seed);
  }
  MD.nthPick=nth;
  const nthPlan=buildNthMainPlan(MD.advT, MD.bracketSize, MD.seed, nth, MD.tid, MD.div);
  MD.candidates=nthPlan.candidates;
  MD.plan=nthPlan.chosen?.plan||null;
  if(MD.plan) renderMainSeedSummary(MD.plan, MD.seed);
  const snap=ge('mainExternalSnapshot');
  if(snap){
    snap.textContent=`${MD.seedSourceLabel} · ${nth}번째 결과 채택 준비 완료`;
  }
  renderMainCandidatePreviewCards();
  return MD.plan;
}
function seedStringHash(str){
  let h=2166136261>>>0;
  const s=String(str||'');
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h>>>0;
}
function mulberry32(seed){
  let a=seed>>>0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededMainRng(seed, tid, div, total){
  const mix=`${seed}|${tid||''}|${div||''}|${total||0}`;
  return mulberry32(seedStringHash(mix));
}
function shuffleSeeded(arr, rnd){
  const a=[...(arr||[])];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(rnd()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function removeFirstMatch(arr,pred){
  const idx=(arr||[]).findIndex(pred);
  if(idx<0) return null;
  return arr.splice(idx,1)[0]||null;
}
function uniquePoolNames(items){
  const out=[];
  const seen=new Set();
  (items||[]).forEach(it=>{
    const nm = typeof it==='string' ? it : (it?.nm||it?.name||'');
    if(!nm || seen.has(nm)) return;
    seen.add(nm);
    out.push(nm);
  });
  return out;
}

function getMainEntryBracketLabel(entry){
  if(!entry) return '';
  if(entry.playInPlaceholder) return String(entry.nm || `진출전 승자${entry.playInId||''}` || '').trim();
  if(entry.placeholder) return String(entry.nm || '').trim();
  const gn=Number(entry.gn||0);
  const rk=Number(entry.rk||0);
  if(gn>=1 && rk>=1) return `${grpLabel(gn-1)} ${rk}위`;
  return stripIndividualClubLabel(String(entry.nm||'').trim());
}


function buildStandardSeedLeafOrder(size){
  let arr=[1,2];
  while(arr.length < size){
    const nextMax=arr.length*2+1;
    const out=[];
    arr.forEach(v=>{
      out.push(v);
      out.push(nextMax-v);
    });
    arr=out;
  }
  return arr.slice(0,size);
}
function parseManualSeedMapFromText(input, entries){
  const out={};
  const txt=String(input||'').trim();
  if(!txt) return out;
  const pool=[...(entries||[])].filter(e=>e && e.ti!=null);
  const usedTi=new Set();
  txt.split(/[\n,;]+/).map(s=>s.trim()).filter(Boolean).forEach(token=>{
    let m = token.match(/^(\d+)\s*[:=\-]\s*(\d+)$/);
    let teamNo=null, seedNo=null;
    if(m){
      teamNo=parseInt(m[1],10);
      seedNo=parseInt(m[2],10);
    }else{
      m = token.match(/^#?(\d+)$/);
      if(m){
        return;
      }
    }
    if(!(teamNo>=1) || !(seedNo>=1 && seedNo<=8)) return;
    const found=pool.find(a=>Number(a?.ti)===teamNo-1);
    if(!found) return;
    const ti=Number(found.ti);
    if(usedTi.has(ti)) return;
    usedTi.add(ti);
    out[ti]=seedNo;
  });
  return out;
}
function getMainManualSeedMap(entries){
  try{
    if(MD && MD.manualSeedMap && Object.keys(MD.manualSeedMap).length) return MD.manualSeedMap;
  }catch(e){}
  const input=(ge('mainManualSeedsInput')?.value||'').trim();
  return parseManualSeedMapFromText(input, entries);
}
function scoreMainLeafCandidate(pos, entry, leaves, n){
  let score=0;
  const sib = pos%2===0 ? pos+1 : pos-1;
  const sibEntry = (sib>=0 && sib<n) ? leaves[sib] : null;
  if(sibEntry && entry && sibEntry.gn!=null && entry.gn===sibEntry.gn) score += 1000;
  if(sibEntry && sibEntry.rk===1 && entry?.rk===1) score += 160;
  const quarterSize=Math.max(2, n/4);
  const qStart=Math.floor(pos/quarterSize)*quarterSize;
  const qEntries=leaves.slice(qStart, qStart+quarterSize).filter(Boolean);
  if(qEntries.some(x=>x?.gn!=null && entry?.gn===x.gn)) score += 120;
  const halfSize=Math.max(2, n/2);
  const hStart=Math.floor(pos/halfSize)*halfSize;
  const hEntries=leaves.slice(hStart, hStart+halfSize).filter(Boolean);
  const sameGroupHalf=hEntries.filter(x=>x?.gn!=null && entry?.gn===x.gn).length;
  score += sameGroupHalf * 30;
  if(entry?.rk===1){
    const siblingFilled = !!sibEntry;
    if(siblingFilled) score += 14;
  }
  score += (pos%2===0 ? 0 : 2);
  return score;
}
function chooseBestMainLeaf(positions, entry, leaves, n, rnd){
  let bestPos=null, bestScore=Number.POSITIVE_INFINITY;
  const shuffled=shuffleSeeded(positions, rnd);
  shuffled.forEach(pos=>{
    const sc=scoreMainLeafCandidate(pos, entry, leaves, n);
    if(sc < bestScore){
      bestScore=sc;
      bestPos=pos;
    }
  });
  return bestPos;
}
function buildSeededMainSlots(entries, n, seed, tid, div){
  const total=(entries||[]).length;
  const spec=computeMainBracketSpec(total);
  if(total<2 || !spec.mainSize) return {matchSlots:[], n:0, byeCount:0, byeIdxs:[], normalIdxs:[], revealOrder:[], playInMatches:[], spec};

  const rnd=seededMainRng(seed, tid, div, total);
  const manualSeedMap=getMainManualSeedMap(entries);

  const toSeeded = (list)=> (list||[]).map(e=>({...e, seedNo:manualSeedMap[Number(e?.ti)]||null}));
  const allSeeded=toSeeded(entries);
  let playInEntries=[];
  let mainPool=[];

  if(spec.playInTeams>0){
    const manualProtected=new Set(Object.keys(manualSeedMap).map(v=>Number(v)));
    const candidates=shuffleSeeded(
      allSeeded.filter(e=>!manualProtected.has(Number(e?.ti))).sort((a,b)=>{
        const ra=Number(a?.rk||99), rb=Number(b?.rk||99);
        if(ra!==rb) return rb-ra; // 2위 우선 진출전
        return Number(a?.gn||0)-Number(b?.gn||0);
      }),
      rnd
    );
    const playMap=new Set();
    playInEntries=candidates.slice(0, spec.playInTeams).map((e,i)=>{
      playMap.add(Number(e.ti));
      return {...e, playInId:Math.floor(i/2)+1};
    });
    mainPool=allSeeded.filter(e=>!playMap.has(Number(e.ti)));
    const placeholders=Array.from({length:spec.winnersNeeded},(_,i)=>({
      nm:`진출전 승자${i+1}`,
      gn:null,
      rk:2,
      placeholder:true,
      playInPlaceholder:true,
      playInId:i+1,
      seedNo:null
    }));
    mainPool=[...mainPool, ...placeholders];
  }else{
    mainPool=[...allSeeded];
  }

  const mainSize=spec.mainSize;
  const byeCount=mainSize-mainPool.length;
  const matchCount=mainSize/2;
  const matchSlots=Array.from({length:matchCount},(_,i)=>({id:i,t1:null,t2:null,bye:false}));
  const seedEntries=(mainPool||[])
    .filter(x=>!x.placeholder && x.seedNo>=1 && x.seedNo<=Math.min(8, mainSize))
    .sort((a,b)=>a.seedNo-b.seedNo);

  const remaining=(mainPool||[]).filter(e=>e.placeholder || e.seedNo==null);
  const rank1=shuffleSeeded(remaining.filter(a=>!a.placeholder && a.rk===1), rnd);
  const others=shuffleSeeded(remaining.filter(a=>a.placeholder || a.rk!==1), rnd);

  const leaves=Array.from({length:mainSize},()=>null);
  const stdOrder=buildStandardSeedLeafOrder(mainSize);
  const seedPosByNo={};
  stdOrder.forEach((seedNo, leafIdx)=>{ seedPosByNo[seedNo]=leafIdx; });

  seedEntries.forEach((entry)=>{
    const pos=seedPosByNo[entry.seedNo];
    if(pos==null || pos<0 || pos>=mainSize) return;
    leaves[pos]={...entry};
  });

  const getOpenPositions=()=>leaves.map((v,i)=>v?null:i).filter(v=>v!=null);
  [...rank1, ...others].forEach(entry=>{
    const opens=getOpenPositions();
    if(!opens.length) return;
    const pos=entry.placeholder
      ? opens[Math.floor(rnd()*opens.length)]
      : chooseBestMainLeaf(opens, entry, leaves, mainSize, rnd);
    if(pos!=null) leaves[pos]={...entry};
  });

  for(let i=0;i<matchCount;i++){
    const a=leaves[i*2]||null;
    const b=leaves[i*2+1]||null;
    if(a) matchSlots[i].t1={...a};
    if(b) matchSlots[i].t2={...b};
    if((a&&!b) || (!a&&b)){
      matchSlots[i].bye=true;
      if(!a && b){
        matchSlots[i].t1={...b};
        matchSlots[i].t2=null;
      }
    }
  }

  const byeIdxs=[], normalIdxs=[];
  matchSlots.forEach((slot,idx)=>{ if(slot.bye) byeIdxs.push(idx); else normalIdxs.push(idx); });
  matchSlots.forEach((slot)=>{
    slot.source1Label = getMainEntryBracketLabel(slot.t1) || slot.source1Label || '';
    slot.source2Label = slot.bye ? '부전승' : (getMainEntryBracketLabel(slot.t2) || slot.source2Label || '');
  });

  const revealOrder=[];
  byeIdxs.forEach(slotIdx=>{
    const slot=matchSlots[slotIdx];
    if(slot?.t1) revealOrder.push({slotIdx, side:'t1', team:slot.t1, bye:true});
  });
  normalIdxs.forEach(slotIdx=>{
    const slot=matchSlots[slotIdx];
    if(slot?.t1) revealOrder.push({slotIdx, side:'t1', team:slot.t1, bye:false});
  });
  normalIdxs.forEach(slotIdx=>{
    const slot=matchSlots[slotIdx];
    if(slot?.t2) revealOrder.push({slotIdx, side:'t2', team:slot.t2, bye:false});
  });

  const playInMatches=[];
  if(spec.playInMatches>0){
    for(let i=0;i<spec.playInMatches;i++){
      const a=playInEntries[i*2]||null;
      const b=playInEntries[i*2+1]||null;
      const target = matchSlots.findIndex(ms=>(ms?.t1?.playInId===i+1)||(ms?.t2?.playInId===i+1));
      const targetSide = target>=0 && matchSlots[target]?.t1?.playInId===i+1 ? 't1' : 't2';
      playInMatches.push({
        id:`playin_${i}`,
        t1:a, t2:b,
        source1Label:getMainEntryBracketLabel(a) || 'TBD',
        source2Label:getMainEntryBracketLabel(b) || 'TBD',
        winnerLabel:`진출전 승자${i+1}`,
        playInId:i+1,
        targetSlot: target,
        targetSide
      });
    }
  }

  return {matchSlots, n:mainSize, byeCount, byeIdxs, normalIdxs, revealOrder, playInMatches, spec};
}
function rouletteBallHTML(text, cls='', extraStyle=''){
  return `<div class="leaf-card-stage ${cls||''}" style="${extraStyle||''}">${text}</div>`;
}
function tennisRevealHTML(text, tone='primary', sub=''){
  const color=tone==='accent'?'var(--accent)':tone==='success'?'var(--success)':'var(--primary)';
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:8px">
    <div class="draw-slot-big" style="border-color:${color};box-shadow:0 0 0 4px rgba(21,101,192,.10)">${text}</div>
    ${sub?`<div style="font-size:.74rem;color:var(--text2);text-align:center">${sub}</div>`:''}
  </div>`;
}
function showMainStageMsg(html){
  ge('mainStageContent').innerHTML=html;
}
let _mainAudioCtx=null;
function getMainAudioCtx(){
  try{
    if(!_mainAudioCtx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC) return null;
      _mainAudioCtx=new AC();
    }
    if(_mainAudioCtx.state==='suspended') _mainAudioCtx.resume();
    return _mainAudioCtx;
  }catch(e){ return null; }
}
function playTone(freq=440,duration=0.08,type='sine',gainValue=0.04,delay=0){
  const ctx=getMainAudioCtx();
  if(!ctx) return;
  const now=ctx.currentTime+Math.max(0,delay);
  const osc=ctx.createOscillator();
  const gain=ctx.createGain();
  osc.type=type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainValue, now+0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now+duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now+duration+0.02);
}
function playMainSpinFx(totalMs=2600, tone='primary'){
  const ctx=getMainAudioCtx();
  if(!ctx) return ()=>{};
  const base=tone==='success'?520:680;
  let tick=0;
  const iv=setInterval(()=>{
    tick++;
    const freq=base + (tick%6)*28;
    playTone(freq, 0.05, 'triangle', 0.03);
  }, 135);
  return ()=>{ try{ clearInterval(iv); }catch(e){} };
}
function playMainRevealFx(rk=1){
  if(rk===1){
    playTone(740,0.08,'triangle',0.03,0);
    playTone(988,0.10,'triangle',0.028,0.08);
    playTone(1318,0.16,'sine',0.03,0.18);
  }else{
    playTone(520,0.07,'triangle',0.022,0);
    playTone(660,0.09,'triangle',0.022,0.08);
    playTone(784,0.13,'sine',0.022,0.18);
  }
}
function runMainStageSlotSpin({title='', pool=[], finalText='', totalMs=3200, accent='var(--primary)', rk=1}){
  return new Promise(resolve=>{
    const names=uniquePoolNames(pool);
    const loop=[...names,...names,...names,...names];
    const stripId='mainSpinStrip';
    showMainStageMsg(`
      <div style="width:100%">
        <div style="font-size:.98rem;font-weight:800;color:${accent};text-align:center;margin-bottom:10px">${title}</div>
        <div style="font-size:.74rem;color:var(--text2);text-align:center;margin-bottom:10px">룰렛이 멈추면 해당 자리가 즉시 확정됩니다</div>
        <div class="roulette-strip-wrap" style="height:210px">
          <div class="roulette-highlight"></div>
          <div class="roulette-strip spinning" id="${stripId}" style="--speed:.16s">
            ${loop.map(nm=>`<div class="roulette-item">${nm}</div>`).join('')}
          </div>
        </div>
      </div>
    `);
    const strip=ge(stripId);
    const stopFx=playMainSpinFx(totalMs, rk===1?'primary':'success');
    setTimeout(()=>{
      stopFx && stopFx();
      if(strip){
        strip.classList.remove('spinning');
        strip.innerHTML = `<div class="roulette-item winner-item">${finalText}</div>`;
        strip.style.transform='translateY(82px)';
      }
      playMainRevealFx(rk);
      setTimeout(resolve, 760);
    }, totalMs);
  });
}
function renderMainSeedSummary(plan, seed){
  const hash = String(seedStringHash(JSON.stringify((plan?.matchSlots||[]).map(s=>({
    t1:s?.t1?.nm||'',
    t2:s?.t2?.nm||'',
    bye:!!s?.bye
  }))))).slice(-6);
  MD.seedHash=hash;
  const el=ge('mainSeedSummary');
  if(el){
    const prepared = MD.seedPreparedAt ? new Date(MD.seedPreparedAt) : null;
    const preparedTxt = prepared ? `${String(prepared.getHours()).padStart(2,'0')}:${String(prepared.getMinutes()).padStart(2,'0')}:${String(prepared.getSeconds()).padStart(2,'0')}` : '-';
    el.innerHTML=`${MD.seedSourceLabel||'외부값'} · <b>${MD.nthPick||1}번째 결과</b> · 본선 ${MD.bracketSize}강 · 확정시각 ${preparedTxt}`;
  }
}
function updateMainSeedPreview(){
  if(!MD.advT || !MD.advT.length) return;
  const plan=prepareMainExternalDraw(false);
  if(ge('mainSeedPreview')){
    ge('mainSeedPreview').innerHTML=renderMainPreviewHTML((plan?.matchSlots)||[], MD.bracketSize, true);
  }
  renderMainCandidatePreviewCards();
}

function getMainDrawDefaultTitle(){
  const tid = MD?.tid || '';
  const div = MD?.div || '';
  const t = G.tournaments.find(x=>x.id===tid);
  const tname = t?.name || '본선 추첨';
  const dname = div ? dl(div) : '본선';
  const cnt = (G.drawHistories[MD?.key||'']||[]).filter(x=>String(x.mode||'')==='main' && !x.deleted).length + 1;
  return `${tname} ${dname} 본선 추첨 ${cnt}`;
}
function getMainDrawMetaValues(){
  return {
    title: (ge('mainDrawTitleInput')?.value || '').trim() || getMainDrawDefaultTitle(),
    isTest: !!ge('mainDrawIsTestInput')?.checked
  };
}
function cloneMainDrawPlan(plan){
  if(!plan) return null;
  try{
    return JSON.parse(JSON.stringify(plan));
  }catch(e){
    const slots=((plan?.matchSlots)||[]).map(s=>({
      ...s,
      t1:s?.t1?{...s.t1}:null,
      t2:s?.t2?{...s.t2}:null
    }));
    const reveal=((plan?.revealOrder)||[]).map(step=>({
      ...step,
      team:step?.team?{...step.team}:null
    }));
    return {
      ...(typeof plan==='object'?plan:{}),
      matchSlots:slots,
      revealOrder:reveal
    };
  }
}
function getMainDrawPlanStorageValue(plan, isTest){
  if(isTest) return null;
  return cloneMainDrawPlan(plan);
}
async function saveMainDrawHistoryEntry(opts={}){
  const key = opts.key || MD.key;
  const tid = opts.tournamentId || MD.tid;
  const div = opts.division || MD.div;
  const t = G.tournaments.find(x=>x.id===tid) || {};
  const historyTitle = (opts.title || '').trim() || getMainDrawDefaultTitle();
  const entry = {
    key,
    tournamentId: tid,
    tournamentName: t.name || '',
    division: div,
    mode: 'main',
    title: historyTitle,
    isTest: !!opts.isTest,
    deleted: false,
    createdAt: opts.createdAt || new Date().toISOString(),
    createdBy: AD ? 'admin' : (OP ? 'operator' : 'unknown'),
    plan: cloneMainDrawPlan(opts.plan),
    seedInfo: opts.seedInfo || {},
    previewHtml: opts.previewHtml || '',
    summaryHtml: opts.summaryHtml || '',
  };
  if(!G.drawHistories[key]) G.drawHistories[key] = [];
  try{
    const ref = await addDoc(collection(db,'drawHistory'), entry);
    DRAW_HISTORY_LOADED=false;
    entry.id = ref.id;
  }catch(e){
    console.warn('main draw history save failed', e);
    entry.id = 'local_'+Math.random().toString(36).slice(2,10);
  }
  G.drawHistories[key].unshift(entry);
  return entry;
}

function openMainDraw(tid,div){
  if(!canManageBracket()){ toast('본선 추첨은 관리자 또는 경기진행자만 실행할 수 있습니다','error'); return; }
  const key=tid+'_'+div, t=G.tournaments.find(t=>t.id===tid),
        draw=G.draws[key], teams=G.teams[key]||[], cfg=gDS(t,div);

  let advT=getAdvT(key,draw,teams,cfg);
  let previewOnly=false;
  if(advT.length<2){
    advT=getPreviewAdvSlots(draw,cfg);
    previewOnly=true;
  }
  if(advT.length<2){toast('진출 자리 2개 이상 필요','error');return;}

  const spec=computeMainBracketSpec(advT.length);
  const n=spec.mainSize;
  const byeCount=Math.max(0, n-advT.length);
  const rank1=advT.filter(a=>a.rk===1);
  const rank2=advT.filter(a=>a.rk!==1);

  const savedMainSeedMap=(draw && typeof draw.mainSeedMap==='object' && draw.mainSeedMap) ? draw.mainSeedMap : {};
  const savedMainSeedRaw=String(draw?.mainSeedRaw||'').trim();
  MD={key,tid,div,advT,previewOnly,bracketSize:n,byeCount,rank1,rank2,spec,isRunning:false,seed:1,plan:null,seedHash:'',manualSeedMap:savedMainSeedMap,manualSeedRaw:savedMainSeedRaw};

  ge('mainAdvTeams').innerHTML=`
    <div style="padding:10px 14px;background:linear-gradient(135deg,#eef2ff,#dce8fb);border-radius:var(--radius-lg);border:1.5px solid var(--success);margin-bottom:10px">
      <div style="font-weight:700;font-size:.88rem;margin-bottom:8px">🏆 본선 진출팀 (${advT.length}팀)</div>
      ${spec.playInMatches>0?`<div style="font-size:.76rem;color:var(--text2);line-height:1.6;margin-bottom:8px"><b>직행 ${spec.directCount}팀</b>은 바로 ${spec.mainSize}강, <b>진출전 ${spec.playInTeams}팀</b>은 ${spec.playInMatches}경기 후 <b>승자 ${spec.winnersNeeded}팀</b>이 ${spec.mainSize}강 합류</div>`:''}
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        ${advT.map(a=>`<span class="badge" style="background:${a.rk===1?'linear-gradient(135deg,#fff7dd,#f6d365)':'linear-gradient(135deg,#eef2f7,#d8e0ea)'};color:${a.rk===1?'#7a5600':'#425466'};border:1px solid ${a.rk===1?'#d4a017':'#b8c3d1'};font-size:.78rem">#${Number(a.ti)+1} ${a.rk===1?'👑':'🥈'} ${a.nm} <small style="opacity:.8">(${(a.gn!=null?grpLabel(a.gn):'?')} ${a.rk}위)</small></span>`).join('')}
      </div>
    </div>`;

  ge('mainBracketInfo').innerHTML=`
    <div class="main-info-grid">
      <div class="main-info-item">진출팀 <b>${advT.length}팀</b>${MD?.previewOnly?` <span style="font-size:.72rem;color:var(--text3)">(자리 추첨)</span>`:""}</div>
      <div class="main-info-item">본선 <b>${spec.mainSize}강</b></div>
      ${spec.playInMatches>0?`<div class="main-info-item" style="grid-column:1/-1"><b>직행 ${spec.directCount}팀</b>은 바로 ${spec.mainSize}강 진출 · <b>진출전(똥통) ${spec.playInTeams}팀</b>은 ${spec.playInMatches}경기 후 <b>승자 ${spec.winnersNeeded}팀</b>이 ${spec.mainSize}강 합류</div>`: (byeCount>0?`<div class="main-info-item" style="grid-column:1/-1">부전승 <b>${byeCount}자리</b></div>`:'')}
      <div class="main-info-item" style="grid-column:1/-1">조당 2팀이면 각 조 <b>1위/2위 모두 본선 진출</b>로 처리됩니다.</div><div class="main-info-item" style="grid-column:1/-1">${MD?.previewOnly?'예선 결과가 아직 없어도 A조 1위, B조 2위 같은 자리 기준으로 본선 추첨이 가능합니다.':'예선 결과 확정 후 실제 팀 기준으로도 동일하게 추첨됩니다.'}</div>
    </div>`;

  ge('mainStep1').style.display='block';
  ge('mainStep2').style.display='none';
  ge('mainDrawBtn').textContent='🎲 본선 추첨 시작';
  ge('mainDrawBtn').disabled=false;
  ge('mainDrawBtn').onclick=startMainDraw;
  ge('mainCancelBtn').textContent='취소';
  ge('mainCancelBtn').style.display='';
  ge('mainCancelBtn').onclick=()=>cm('mMain');
  MD.nthPick=1;
  updateMainSeedPreview();

  const metaRow = `
    <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:12px">
      <div style="flex:1;min-width:220px">
        <label class="form-label">추첨 제목</label>
        <input class="form-input" id="mainDrawTitleInput" placeholder="예: 본선 추첨 1차">
      </div>
      <div style="min-width:220px;padding-bottom:6px">
        <label style="display:flex;align-items:center;gap:8px;font-size:.84rem;font-weight:800;color:var(--text);cursor:pointer">
          <input type="checkbox" id="mainDrawIsTestInput" style="accent-color:var(--accent)">
          테스트용 본선 추첨
        </label>
        <div style="font-size:.72rem;color:var(--text3);margin-top:6px;line-height:1.5">
          테스트로 저장하면 기록만 남고 실제 본선 대진표는 바뀌지 않습니다.
        </div>
      </div>
      <div class="admin-block" style="flex:1;min-width:280px">
        <label class="form-label">시드 배정 <span style="font-size:.72rem;color:var(--text3);font-weight:600">(예선 추첨 단계에서 설정)</span></label>
        <div style="padding:10px 12px;background:var(--panel2);border:1px solid var(--border);border-radius:10px">
          <div id="mainManualSeedsSummary" style="font-size:.72rem;color:var(--text3);line-height:1.6">예선 추첨에서 저장된 시드가 있으면 자동 적용됩니다.</div>
        </div>
      </div>
    </div>`;
  const step1 = ge('mainStep1');
  if(step1){
    const oldMeta = ge('mainDrawMetaRowWrap');
    if(oldMeta) oldMeta.remove();
    const wrap = document.createElement('div');
    wrap.id = 'mainDrawMetaRowWrap';
    wrap.innerHTML = metaRow;
    step1.insertBefore(wrap, step1.firstChild);
    const titleInput = ge('mainDrawTitleInput');
    if(titleInput) titleInput.value = getMainDrawDefaultTitle();
    updateMainManualSeeds();
  }
  const footer = ge('mMain')?.querySelector('.modal-footer');
  if(footer && !ge('mainHistoryBtn')){
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline';
    btn.id = 'mainHistoryBtn';
    btn.textContent = '🗂 본선 추첨기록';
    btn.onclick = ()=>openDrawHistory(MD.tid, MD.div, 'main');
    footer.insertBefore(btn, ge('mainDrawBtn'));
  }
  om('mMain');
}

async function runMainExternalDrawAnimation(plan,audit={}){
  const slots=(plan?.matchSlots)||[];
  const revealOrder=(plan?.revealOrder)||[];
  const n=plan?.n || MD?.bracketSize || Math.max(2, slots.length*2);
  const stage=ge('mainStageContent');
  const progress=ge('mainProgressBar');
  if(stage) stage.innerHTML='';
  const liveSlots=slots.map(s=>({
    id:s?.id,
    t1:null,
    t2:null,
    bye:!!s?.bye
  }));

  const total=Math.max(1,revealOrder.length);
  renderMainPreview(liveSlots,n,G.teams[MD?.key||'']||[],MD?.key||'',false,(plan?.playInMatches)||[]);
  renderMainSeedSummary(plan, audit?.chosenSeed || audit?.baseSeed || MD?.seed || 1);

  if(!revealOrder.length){
    renderMainPreview(slots,n,G.teams[MD?.key||'']||[],MD?.key||'',true,(plan?.playInMatches)||[]);
    if(progress) progress.style.width='100%';
    showMainStageMsg(tennisRevealHTML('본선 대진표 확정','success','추첨할 슬롯이 없어 바로 확정했습니다'));
    await sleep(280);
    return;
  }

  for(let i=0;i<revealOrder.length;i++){
    const step=revealOrder[i]||{};
    const slotIdx=step.slotIdx;
    const side=step.side==='t2'?'t2':'t1';
    const team=step.team||null;
    const rk=Math.max(1, parseInt(team?.rk||1,10));
    const title=side==='t1'
      ? `🎯 ${slotIdx+1}번 매치 상단 배정`
      : `🎯 ${slotIdx+1}번 매치 하단 배정`;
    const sub=step.bye
      ? '부전승 자리 우선 배정'
      : (rk===1 ? '조 1위팀 우선 배정' : '상대 자리 무작위 배정');
    const pool=team ? [team.nm] : slots.flatMap(s=>[s?.t1?.nm,s?.t2?.nm]).filter(Boolean);
    await runMainStageSlotSpin({
      title,
      pool,
      finalText:team?.nm||'미정',
      totalMs: (i===0?2100:1650),
      accent: rk===1 ? 'var(--accent)' : 'var(--primary)',
      rk
    });

    if(!liveSlots[slotIdx]) liveSlots[slotIdx]={id:slotIdx,t1:null,t2:null,bye:false};
    if(side==='t1') liveSlots[slotIdx].t1 = team ? {...team} : null;
    else liveSlots[slotIdx].t2 = team ? {...team} : null;
    if(step.bye) liveSlots[slotIdx].bye = true;

    renderMainPreview(liveSlots,n,G.teams[MD?.key||'']||[],MD?.key||'',false,(plan?.playInMatches)||[]);
    if(progress) progress.style.width=`${Math.round(((i+1)/total)*100)}%`;
    ge('mainStageMeta').innerHTML=`시드보호 본선 재추첨 진행 중... (${i+1}/${total})`;
    await sleep(i===revealOrder.length-1 ? 260 : 120);
  }

  renderMainPreview(slots,n,G.teams[MD?.key||'']||[],MD?.key||'',true,(plan?.playInMatches)||[]);
  showMainStageMsg(tennisRevealHTML('본선 대진표 확정','success','모든 슬롯 배정이 완료되었습니다'));
  if(progress) progress.style.width='100%';
  try{ spawnConfetti(ge('mainStageContent')); }catch(e){}
  await sleep(420);
}

async function startMainDraw(){
  if(!canManageBracket()){ toast('본선 추첨 권한이 없습니다','error'); return; }
  if(MD.isRunning)return;
  const meta = getMainDrawMetaValues();
  MD.isRunning=true;
  const planPrepared=prepareMainExternalDraw(false);
  MD.plan=planPrepared || MD.plan;
  ge('mainStageMeta').innerHTML='시드보호 본선 재추첨 진행 중...';

  ge('mainDrawBtn').disabled=true;
  ge('mainStep1').style.display='none';
  ge('mainStep2').style.display='block';
  ge('mainProgressBar').style.width='0%';
  const {key,tid,div}=MD;
  const teams=G.teams[key]||[];
  const plan=MD.plan;
  const audit={
    mode: MD.seedMethod,
    modeLabel: MD.seedSourceLabel,
    nth: MD.nthPick||1,
    baseSeed: MD.seed,
    chosenSeed: (MD.candidates||[])[Math.max(0,(MD.nthPick||1)-1)]?.seed || MD.seed,
    preparedAt: MD.preparedAt||new Date().toISOString(),
    isTest: !!meta.isTest
  };

  try{
    await runMainExternalDrawAnimation(plan,audit);
    const previewHtml = renderMainBracketPreviewHTML(key, plan, teams);
    const summaryHtml = compactMainSummaryFromPlan(plan);

    if(!meta.isTest){
      const mainMatches = buildMainMatches((plan?.matchSlots)||[], plan?.n||0, (plan?.playInMatches)||[]);
      const prevMatches = Array.isArray(G.matches[key]) ? G.matches[key] : [];
      const nonMainMatches = prevMatches.filter(m=>m.phase!=='main' && m.phase!=='playin');
      G.matches[key] = [...nonMainMatches, ...mainMatches];
      G.draws[key]={
        ...(G.draws[key]||{}),
        mainPlan:getMainDrawPlanStorageValue(plan,false),
        mainAudit:audit,
        mainUpdatedAt:new Date().toISOString()
      };
      await stD(key);
      await stM(key);
      try{
        setMainSectionCollapsed(key,false);
        const selectedMain=getSelectedMainMatchFilters(key)||[];
        if(Array.isArray(selectedMain) && selectedMain.length){
          setSelectedMainMatchFilters(key,[]);
        }
      }catch(e){}
      try{ renderBracket(); }catch(e){}
    }

    await saveMainDrawHistoryEntry({
      key,
      tournamentId: tid,
      division: div,
      title: meta.title,
      isTest: meta.isTest,
      plan,
      seedInfo: audit,
      previewHtml,
      summaryHtml
    });

    ge('mainStageMeta').innerHTML = meta.isTest
      ? '테스트용 본선 추첨 완료 — 기록만 저장했습니다.'
      : '본선 추첨 완료 — 실제 대진표와 본선 시합 생성이 완료되었습니다.';
    ge('mainProgressBar').style.width='100%';
    ge('mainDrawBtn').disabled=false;
    ge('mainDrawBtn').textContent='🎲 다시 추첨';
    ge('mainDrawBtn').onclick=startMainDraw;
    toast(meta.isTest ? '테스트 본선 추첨 저장 완료 ✅' : '본선 추첨 저장 및 본선 시합 생성 완료 ✅','success');
    try{ openDrawHistory(tid, div); }catch(e){}
  }catch(e){
    console.error(e);
    toast('본선 추첨 실패: '+(e?.message||e),'error');
    ge('mainDrawBtn').disabled=false;
  }finally{
    MD.isRunning=false;
  }
}
function renderMainPreviewHTML(matchSlots,n,isPreview,playInMatches=[]){
  // ── 상수 ──────────────────────────────────────────────
  const CARD_H   = 72;
  const CARD_W   = 158;
  const COL_GAP  = 48;
  const ROW_GAP  = 14;  // renderBracketTree와 동일
  const COL_W    = CARD_W + COL_GAP;
  const TITLE_H  = 28;

  const rounds = Math.max(1, Math.log2(n));
  const firstCount = Math.max(1, n / 2);

  // ── 각 라운드별 카드 수 계산 ──────────────────────────
  const colCounts = [];
  let cnt = firstCount;
  for(let r = 0; r < rounds; r++){
    colCounts.push(cnt);
    cnt = Math.max(1, Math.ceil(cnt / 2));
  }

  // ── 각 라운드별 카드 Y 중심 좌표 계산 ────────────────
  // renderBracketTree와 동일 로직: 첫 라운드 절대 배치 → 후속 라운드는 pair 중간값
  const firstCenters = Array.from({length: firstCount}, (_, i) =>
    i * (CARD_H + ROW_GAP) + CARD_H / 2
  );
  const centersByRound = [firstCenters];
  for(let r = 1; r < rounds; r++){
    const prev = centersByRound[r - 1];
    const cur  = [];
    for(let i = 0; i < prev.length; i += 2){
      const y1 = prev[i];
      const y2 = (i + 1 < prev.length) ? prev[i + 1] : y1;
      cur.push((y1 + y2) / 2);
    }
    centersByRound.push(cur.slice(0, colCounts[r]));
  }

  // ── 전체 SVG 캔버스 크기 ──────────────────────────────
  const totalH = firstCount * CARD_H + Math.max(0, firstCount - 1) * ROW_GAP;
  const svgW = rounds * COL_W - COL_GAP + 4;
  const svgH = totalH + TITLE_H + 16;

  // ── SVG 선 생성 ───────────────────────────────────────
  // 각 라운드 카드에서 다음 라운드 카드로 연결
  let svgLines = '';
  for(let r = 0; r < rounds - 1; r++){
    const curCenters  = centersByRound[r];
    const nextCenters = centersByRound[r + 1];
    const xRight = r * COL_W + CARD_W;          // 현 라운드 카드 오른쪽 끝 X
    const xLeft  = (r + 1) * COL_W;             // 다음 라운드 카드 왼쪽 끝 X
    const xMid   = xRight + COL_GAP / 2;        // 중간 X (수직선 위치)

    // 2개씩 묶어서 다음 라운드 1개에 연결
    for(let i = 0; i < curCenters.length; i += 2){
      const y1 = curCenters[i]  + TITLE_H + 4;
      const y2 = i + 1 < curCenters.length ? curCenters[i + 1] + TITLE_H + 4 : y1;
      const nextIdx = Math.floor(i / 2);
      const yNext  = nextCenters[nextIdx] + TITLE_H + 4;
      const yMidV  = (y1 + y2) / 2;  // 수직선 중심 Y

      // 왼쪽 카드 → 수평선 → 수직선
      svgLines += `<line x1="${xRight}" y1="${y1}" x2="${xMid}" y2="${y1}" stroke="#c8d4e8" stroke-width="2"/>`;
      if(i + 1 < curCenters.length){
        svgLines += `<line x1="${xRight}" y1="${y2}" x2="${xMid}" y2="${y2}" stroke="#c8d4e8" stroke-width="2"/>`;
      }
      // 수직선 (두 카드를 잇는 선)
      svgLines += `<line x1="${xMid}" y1="${y1}" x2="${xMid}" y2="${y2}" stroke="#c8d4e8" stroke-width="2"/>`;
      // 수직선 중심 → 다음 라운드 카드
      svgLines += `<line x1="${xMid}" y1="${yMidV}" x2="${xLeft}" y2="${yNext}" stroke="#c8d4e8" stroke-width="2"/>`;
    }
  }

  // ── 카드 HTML 생성 (position:absolute) ───────────────
  let cardsHtml = '';

  // 첫 번째 라운드: matchSlots 기반
  for(let i = 0; i < firstCount; i++){
    const ms = matchSlots[i] || {};
    const cy = centersByRound[0][i] + TITLE_H + 4;
    const top = cy - CARD_H / 2;

    const isBye = !!ms.bye;
    const topLabel = (ms.source1Label||'') || (ms.t1 ? (getMainEntryBracketLabel(ms.t1) || '추첨 대기') : '추첨 대기');
    const botLabel = isBye ? '부전승' : ((ms.source2Label||'') || (ms.t2 ? (getMainEntryBracketLabel(ms.t2) || '추첨 대기') : '추첨 대기'));

    const topBg   = ms.t1 ? '#eef4ff' : '#f8fafc';
    const botBg   = isBye ? '#fff8e6' : (ms.t2 ? '#f0fdf4' : '#f8fafc');
    const topClr  = ms.t1 ? 'var(--primary-dark)' : '#94a3b8';
    const botClr  = isBye ? '#92400e' : (ms.t2 ? '#166534' : '#94a3b8');
    const botItal = (!isBye && !ms.t2) ? 'italic' : 'normal';

    cardsHtml += `<div style="position:absolute;left:0;top:${top}px;width:${CARD_W}px;border:1.5px solid #d5dbea;border-radius:7px;overflow:hidden;background:white;box-shadow:0 1px 6px rgba(15,30,58,.07)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;min-height:34px;background:${topBg};border-bottom:1px solid #e5eaf3;gap:4px">
        <span style="font-size:.76rem;font-weight:${ms.t1?700:400};color:${topClr};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${topLabel}</span>
        <span style="font-size:.6rem;color:#b0bac9;flex-shrink:0">${i+1}-1</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;min-height:34px;background:${botBg};gap:4px">
        <span style="font-size:.76rem;font-weight:${(isBye||ms.t2)?700:400};color:${botClr};font-style:${botItal};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${botLabel}</span>
        <span style="font-size:.6rem;color:#b0bac9;flex-shrink:0">${isBye?'🏅':i+1+'-2'}</span>
      </div>
    </div>`;
  }

  // 이후 라운드: "승자 진출" 카드
  for(let r = 1; r < rounds; r++){
    const xLeft   = r * COL_W;
    const centers = centersByRound[r];
    const isFinal = r === rounds - 1;
    for(let i = 0; i < centers.length; i++){
      const cy  = centers[i] + TITLE_H + 4;
      const top = cy - CARD_H / 2;
      const borderClr = isFinal ? 'var(--accent)' : '#d5dbea';
      const leftBar   = isFinal ? '3px solid var(--accent)' : '3px solid #c8d4e8';
      cardsHtml += `<div style="position:absolute;left:${xLeft}px;top:${top}px;width:${CARD_W}px;border:1.5px solid ${borderClr};border-radius:7px;overflow:hidden;background:white;box-shadow:0 1px 6px rgba(15,30,58,.07)">
        <div style="display:flex;align-items:center;padding:5px 8px;min-height:34px;background:#f1f5f9;border-bottom:1px solid #e5eaf3;border-left:${leftBar}">
          <span style="font-size:.74rem;color:#94a3b8;font-style:italic">승자 진출</span>
        </div>
        <div style="display:flex;align-items:center;padding:5px 8px;min-height:34px;background:#f1f5f9;border-left:${leftBar}">
          <span style="font-size:.74rem;color:#94a3b8;font-style:italic">승자 진출</span>
        </div>
      </div>`;
    }
  }

  // ── 라운드 타이틀 ─────────────────────────────────────
  let titlesHtml = '';
  for(let r = 0; r < rounds; r++){
    const x      = r * COL_W;
    const isFin  = r === rounds - 1;
    const lbl    = isFin ? '결승' : r === rounds - 2 && rounds > 2 ? '준결승' : `${n / Math.pow(2, r)}강`;
    const bg     = isFin ? 'var(--accent)' : '#0f1e3a';
    const clr    = isFin ? 'var(--text)' : 'white';
    titlesHtml += `<div style="position:absolute;left:${x}px;top:0;width:${CARD_W}px;background:${bg};color:${clr};text-align:center;padding:5px 4px;border-radius:4px 4px 0 0;font-size:.7rem;font-weight:700">${lbl}</div>`;
  }

  const specInfo=computeMainBracketSpec((matchSlots?.length||0)*2 + ((playInMatches?.length||0)*2>0 ? 2 : 0));
  const playInHtml=(playInMatches&&playInMatches.length)?`<div style="margin-bottom:12px">
      <div style="font-size:.76rem;font-weight:800;color:#92400e;margin-bottom:6px">🪣 진출전(똥통) 자리</div>
      <div style="font-size:.72rem;color:#7c6f57;line-height:1.6;margin-bottom:8px">직행 팀들은 바로 본선으로 들어가고, 아래 ${playInMatches.length}경기의 승자만 본선에 합류합니다.</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px">
        ${playInMatches.map((pm,idx)=>`
          <div style="border:1.5px solid #f5c26b;border-radius:10px;background:linear-gradient(135deg,#fff8e6,#fffdf7);overflow:hidden">
            <div style="padding:6px 10px;background:#fff1c7;font-size:.72rem;font-weight:900;color:#92400e">진출전 ${idx+1}경기</div>
            <div style="padding:9px 10px;border-top:1px solid #fde7b0;font-size:.78rem;color:#7c2d12">${pm?.t1?.nm||'2위팀'}</div>
            <div style="padding:9px 10px;border-top:1px solid #fde7b0;font-size:.78rem;color:#7c2d12">${pm?.t2?.nm||'2위팀'}</div>
            <div style="padding:8px 10px;border-top:1px dashed #f5c26b;font-size:.72rem;color:#92400e;font-weight:800">${pm?.winnerLabel||'본선 합류'}</div>
          </div>`).join('')}
      </div>
    </div>`:'';

  return `<div style="overflow-x:auto;padding-bottom:8px">
    ${playInHtml}
    <div style="position:relative;width:${svgW}px;height:${svgH}px;min-width:${svgW}px">
      ${titlesHtml}
      <svg style="position:absolute;left:0;top:0;width:${svgW}px;height:${svgH}px;overflow:visible;pointer-events:none" xmlns="http://www.w3.org/2000/svg">
        ${svgLines}
      </svg>
      ${cardsHtml}
    </div>
  </div>`;
}
function renderMainPreview(matchSlots,n,teams,key,final,playInMatches=[]){
  ge('mainBracketPreview').innerHTML=renderMainPreviewHTML(matchSlots,n,false,playInMatches);
}

// ─── Firebase 저장용 match 구조 생성 ────────────────────
function buildMainMatches(matchSlots,n,playInMatches=[]){
  const out=[];
  const matchCount=n/2;

  // 진출전 경기 생성
  (playInMatches||[]).forEach((pm, i)=>{
    out.push({
      id:`playin_${i}`,
      phase:'playin',
      round:0,
      slot:i,
      t1:pm?.t1 && !pm.t1.placeholder ? pm.t1.ti : null,
      t2:pm?.t2 && !pm.t2.placeholder ? pm.t2.ti : null,
      winner:null,
      rubbers:[],
      bye:false,
      court:'',
      targetSlot:Number(pm?.targetSlot??-1),
      targetSide:String(pm?.targetSide||'t1'),
      source1Label:String(pm?.source1Label || getMainEntryBracketLabel(pm?.t1) || 'TBD'),
      source2Label:String(pm?.source2Label || getMainEntryBracketLabel(pm?.t2) || 'TBD'),
      winnerLabel:String(pm?.winnerLabel||`진출전 승자${i+1}`)
    });
  });

  const mainMs=[];
  for(let i=0;i<matchCount;i++){
    const ms=matchSlots[i]||{};
    const t1ti=(ms.t1 && !ms.t1.placeholder)?ms.t1.ti:null;
    const t2ti=(ms.t2 && !ms.t2.placeholder)?ms.t2.ti:null;
    const m={id:`main_r0_${i}`,phase:'main',round:0,slot:i,
      t1:t1ti,t2:t2ti,winner:null,rubbers:[],bye:!!ms.bye,court:'',
      t1Seed:(ms.t1&&ms.t1.seedNo)?Number(ms.t1.seedNo):null,
      t2Seed:(ms.t2&&ms.t2.seedNo)?Number(ms.t2.seedNo):null,
      source1Label:String((ms.source1Label||'') || (ms.t1 ? (getMainEntryBracketLabel(ms.t1)||'') : '')),
      source2Label:String((ms.source2Label||'') || (ms.t2 ? (getMainEntryBracketLabel(ms.t2)||'') : '')),
      source1PlayInId:(ms.t1&&ms.t1.playInId)?Number(ms.t1.playInId):null,
      source2PlayInId:(ms.t2&&ms.t2.playInId)?Number(ms.t2.playInId):null
    };
    if(ms.bye && t1ti!==null){ m.winner=t1ti; }
    mainMs.push(m);
  }

  let slots=matchCount;
  for(let r=1;slots>1;r++){
    const hs=Math.ceil(slots/2);
    for(let i=0;i<hs;i++){
      mainMs.push({id:`main_r${r}_${i}`,phase:'main',round:r,slot:i,t1:null,t2:null,winner:null,rubbers:[],bye:false,court:''});
    }
    slots=hs;
  }

  const maxR=Math.max(...mainMs.map(m=>m.round));
  for(let r=0;r<maxR;r++){
    mainMs.filter(m=>m.round===r&&m.winner!==null&&m.bye).forEach(bm=>{
      const nm=mainMs.find(m2=>m2.round===r+1&&m2.slot===Math.floor(bm.slot/2));
      if(!nm) return;
      if(bm.slot%2===0){ if(nm.t1===null) nm.t1=bm.winner; }
      else             { if(nm.t2===null) nm.t2=bm.winner; }
    });
  }
  return [...out, ...mainMs];
}
// ─── 수동 수정 ──────────────────────────────────────────
let ME={key:null,tid:null,div:null};
function openManualEdit(tid,div){
  if(!canManageBracket()){ toast('본선 대진표 수동 수정 권한이 없습니다','error'); return; }
  const key=tid+'_'+div;
  ME={key,tid,div};
  const teams=G.teams[key]||[];
  const mMs=(G.matches[key]||[]).filter(m=>m.phase==='main'&&m.round===0).sort((a,b)=>a.slot-b.slot);
  if(!mMs.length){toast('본선 대진표가 없습니다','error');return;}

  const teamOpts=['<option value="">-- 미정 --</option>',...teams.map((t,i)=>`<option value="${i}">${tdn(t,key,i)}</option>`)].join('');

  const rows=mMs.map((m,mi)=>{
    const mt1=m.t1!==null?teams[m.t1]:null;
    const mt2=m.t2!==null?teams[m.t2]:null;
    const lbl=m.bye?'🎫 부전승':'⚡ 경기';
    return`<div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:8px;background:var(--panel)">
      <div style="font-size:.72rem;font-weight:700;color:var(--primary-dark);margin-bottom:8px">${lbl} — ${mi+1}번 매치</div>
      <div style="display:grid;grid-template-columns:1fr 20px 1fr;gap:8px;align-items:center">
        <div>
          <div style="font-size:.65rem;color:var(--text2);margin-bottom:3px">팀1 (상위시드)</div>
          <select class="form-select" id="me_t1_${m.id}" style="font-size:.8rem">
            ${teams.map((t,i)=>`<option value="${i}" ${m.t1===i?'selected':''}>${tdn(t,key,i)}</option>`).join('')}
            <option value="" ${m.t1===null?'selected':''}>-- 미정 --</option>
          </select>
        </div>
        <div style="text-align:center;font-weight:700;color:var(--text3)">vs</div>
        <div>
          <div style="font-size:.65rem;color:var(--text2);margin-bottom:3px">${m.bye?'부전승 (자동 진출)':'팀2'}</div>
          ${m.bye?`<div style="padding:7px 10px;background:var(--bg2);border-radius:var(--radius);font-size:.78rem;color:var(--text3);border:1px solid var(--border)">🎫 부전승 진출</div>`
          :`<select class="form-select" id="me_t2_${m.id}" style="font-size:.8rem">
            ${teams.map((t,i)=>`<option value="${i}" ${m.t2===i?'selected':''}>${tdn(t,key,i)}</option>`).join('')}
            <option value="" ${m.t2===null?'selected':''}>-- 미정 --</option>
          </select>`}
        </div>
      </div>
      <div style="margin-top:6px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.72rem;color:var(--text2)">
          <input type="checkbox" id="me_bye_${m.id}" ${m.bye?'checked':''} onchange="toggleByeEdit('${m.id}')"> 부전승 처리 (팀1이 자동 다음 라운드 진출)
        </label>
      </div>
    </div>`;
  }).join('');

  ge('manualEditBody').innerHTML=rows;
  om('mManualEdit');
}

function toggleByeEdit(mid){
  const cb=ge(`me_bye_${mid}`);
  const t2el=ge(`me_t2_${mid}`);
  if(t2el) t2el.disabled=cb.checked;
}

async function saveManualEdit(){
  if(!canManageBracket()){ toast('본선 대진표 수동 수정 권한이 없습니다','error'); return; }
  const {key,tid,div}=ME;
  const allMs=G.matches[key]||[];
  const mMs=allMs.filter(m=>m.phase==='main'&&m.round===0).sort((a,b)=>a.slot-b.slot);
  const teams=G.teams[key]||[];

  mMs.forEach(m=>{
    const t1el=ge(`me_t1_${m.id}`);
    const t2el=ge(`me_t2_${m.id}`);
    const byeEl=ge(`me_bye_${m.id}`);
    if(t1el){const v=t1el.value;m.t1=v===''?null:parseInt(v);}
    if(t2el){const v=t2el.value;m.t2=v===''?null:parseInt(v);}
    if(byeEl){
      m.bye=byeEl.checked;
      if(m.bye&&m.t1!==null)m.winner=m.t1;
      else if(!m.bye)m.winner=null;
    }
  });

  // 다음 라운드 부전승 재연산 (winner 자동설정 제거)
  const mainMs=allMs.filter(m=>m.phase==='main');
  mainMs.filter(m=>m.round>0).forEach(m=>{m.t1=null;m.t2=null;m.winner=null;m.bye=false;});
  mainMs.filter(m=>m.bye&&m.winner!==null&&m.round===0).forEach(bm=>{
    const nm=mainMs.find(m2=>m2.round===bm.round+1&&m2.slot===Math.floor(bm.slot/2));
    if(nm){
      if(bm.slot%2===0)nm.t1=bm.winner; else nm.t2=bm.winner;
      // winner 자동설정 안 함
    }
  });

  sl(true);
  try{
    await stM(key);
    await fbLog(`본선 수동수정: ${dl(div)}`,'✏️');
    sl(false);cm('mManualEdit');renderBracket();toast('수정 저장 완료 ✅','success');
  }catch(e){sl(false);toast('저장 실패','error');}
}

function seedAdv(advT){
  const r1=[],r2=[];
  advT.forEach(t=>{if(t.rk===1)r1.push(t);else r2.push(t);});
  const res=[];const max=Math.max(r1.length,r2.length);
  for(let i=0;i<max;i++){if(r1[i])res.push(r1[i]);if(r2[i])res.push(r2[i]);}
  return res;
}



function ensureM3OperatorSubmitButtons(){
  const footer=ge('mM3Footer');
  if(!footer) return {};
  let homeBtn=ge('mM3SubmitOperatorHomeBtn');
  let awayBtn=ge('mM3SubmitOperatorAwayBtn');
  if(!homeBtn){
    homeBtn=document.createElement('button');
    homeBtn.id='mM3SubmitOperatorHomeBtn';
    homeBtn.className='btn btn-outline m3-side-submit-btn';
    homeBtn.style.display='none';
    homeBtn.onclick=()=>confirmSubmitOrderForSide(1);
    footer.insertBefore(homeBtn, ge('mM3SubmitBtn')||null);
  }
  if(!awayBtn){
    awayBtn=document.createElement('button');
    awayBtn.id='mM3SubmitOperatorAwayBtn';
    awayBtn.className='btn btn-outline m3-side-submit-btn';
    awayBtn.style.display='none';
    awayBtn.onclick=()=>confirmSubmitOrderForSide(2);
    footer.insertBefore(awayBtn, ge('mM3SubmitBtn')||null);
  }
  return {homeBtn,awayBtn};
}

function ensureM3AdminSubmitButtons(){
  const footer=ge('mM3Footer');
  if(!footer) return {};
  let homeBtn=ge('mM3SubmitHomeBtn');
  let awayBtn=ge('mM3SubmitAwayBtn');
  if(!homeBtn){
    homeBtn=document.createElement('button');
    homeBtn.id='mM3SubmitHomeBtn';
    homeBtn.className='btn btn-outline m3-side-submit-btn';
    homeBtn.style.display='none';
    homeBtn.onclick=()=>confirmSubmitOrderForSide(1);
    footer.insertBefore(homeBtn, ge('mM3SubmitBtn')||null);
  }
  if(!awayBtn){
    awayBtn=document.createElement('button');
    awayBtn.id='mM3SubmitAwayBtn';
    awayBtn.className='btn btn-outline m3-side-submit-btn';
    awayBtn.style.display='none';
    awayBtn.onclick=()=>confirmSubmitOrderForSide(2);
    footer.insertBefore(awayBtn, ge('mM3SubmitBtn')||null);
  }
  return {homeBtn,awayBtn};
}

function openM3(key,mid){
  const m=(G.matches[key]||[]).find(m=>m.id===mid);if(!m)return;
  const indivAuth=getIndividualResultAuthState(key,m);
  if(!(AD||canEditMatchByDirector(key,m)||indivAuth.allowed||isPublicResultEntryEnabled())){
    toast(isIndividualByKey(key)?'개인전은 참가자 비밀번호 또는 운영 권한이 있을 때만 결과 입력할 수 있습니다':'해당 경기 참가팀 로그인 또는 운영 권한이 필요합니다','error');
    return;
  }
  const {t1,t2}=getMatchTeamObjects(key,m);
  if(!t1 && !t2){toast('팀 정보를 찾을 수 없음','error');return;}
  CM_key=key;CM_id=mid;
  const [tid2,div]=key.split('_');
  const dn1=t1?tdn(t1,key,m.t1):'TBD',dn2=t2?tdn(t2,key,m.t2):(m.bye?'부전승 대기팀':'TBD');
  const tObj=G.tournaments.find(t=>t.id===tid2);
  const cfg=gDS(tObj,div);
  const dbl=cfg.doublesCount||(t1.doublesCount)||5;
  const st=getOnlineOrderState(key,m);
  const mySide=st.mySide;
  const isIndividualMode=isIndividualByKey(key);
  const useOrderHere=!!G.meta.onlineOrderEnabled && !isIndividualMode;
  window._m3Ctx = { key, mid, dbl, mySide, dn1, dn2, isStaff: !!(AD||OP), online: useOrderHere, individual: isIndividualMode };
  const revealBoth=AD||st.bothSubmitted||!useOrderHere;
  const myLocked=useOrderHere && !AD && !OP && st.bothSubmitted;
  const isOperator = !!OP;
  const side1PhotoEditable = useOrderHere && (AD || (mySide===1 && !myLocked) || (isOperator && !st.s1 && !st.bothSubmitted));
  const side2PhotoEditable = useOrderHere && (AD || (mySide===2 && !myLocked) || (isOperator && !st.s2 && !st.bothSubmitted));
  const side1PhotoViewable = useOrderHere && !!_orderPhotoGetSaved(m,1) && _orderPhotoCanView(m,1);
  const side2PhotoViewable = useOrderHere && !!_orderPhotoGetSaved(m,2) && _orderPhotoCanView(m,2);

  // ── 제목 동적 설정 ──
  const titleEl=ge('mM3T');
  titleEl.textContent=buildResultModalTitle({
    divisionLabel:dl(div),
    team1:dn1,
    team2:dn2,
    isIndividual:isIndividualMode,
    useOnlineOrder:useOrderHere,
    bothSubmitted:st.bothSubmitted,
    mySubmitted:st.mySubmitted
  });

  // ── footer 버튼 상태 제어 ──
  const btnSave=ge('mM3SaveBtn');
  const btnUnlock=ge('mM3UnlockBtn');
  const btnSubmit=ge('mM3SubmitBtn');
  const btnSaveResult=ge('mM3SaveResultBtn');
  const adminSubmitBtns=ensureM3AdminSubmitButtons();
  const btnSubmitHome=adminSubmitBtns.homeBtn;
  const btnSubmitAway=adminSubmitBtns.awayBtn;
  const operatorSubmitBtns=ensureM3OperatorSubmitButtons();
  const btnOpSubmitHome=operatorSubmitBtns.homeBtn;
  const btnOpSubmitAway=operatorSubmitBtns.awayBtn;

  const footerState=getResultFooterButtonState({
    isIndividual:isIndividualMode,
    useOnlineOrder:useOrderHere,
    isAdmin:!!AD,
    isOperator:!!isOperator,
    mySide,
    bothSubmitted:st.bothSubmitted,
    mySubmitted:st.mySubmitted,
    side1Submitted:st.s1,
    side2Submitted:st.s2
  });

  const applyBtnState=(btn,s)=>{
    if(!btn||!s) return;
    btn.style.display=s.show?'':'none';
    btn.disabled=!!s.disabled;
    if(s.text) btn.textContent=s.text;
    if(s.title) btn.title=s.title;
  };

  applyBtnState(btnSave,footerState.save);
  applyBtnState(btnUnlock,footerState.unlock);
  applyBtnState(btnSubmit,footerState.submit);
  applyBtnState(btnSaveResult,footerState.saveResult);
  applyBtnState(btnSubmitHome,footerState.submitHome);
  applyBtnState(btnSubmitAway,footerState.submitAway);
  applyBtnState(btnOpSubmitHome,footerState.opSubmitHome);
  applyBtnState(btnOpSubmitAway,footerState.opSubmitAway);

  if(btnSubmitHome && footerState.submitHome.show){
    btnSubmitHome.textContent=`📤 ${dn1}만 제출`;
    btnSubmitHome.title='홈팀 오더만 제출 또는 재제출';
  }
  if(btnSubmitAway && footerState.submitAway.show){
    btnSubmitAway.textContent=`📤 ${dn2}만 제출`;
    btnSubmitAway.title='원정팀 오더만 제출 또는 재제출';
  }
  if(btnOpSubmitHome && footerState.opSubmitHome.show){
    btnOpSubmitHome.textContent=`📤 ${dn1}만 대리제출`;
    btnOpSubmitHome.title='홈팀 오더만 대신 제출합니다';
  }
  if(btnOpSubmitAway && footerState.opSubmitAway.show){
    btnOpSubmitAway.textContent=`📤 ${dn2}만 대리제출`;
    btnOpSubmitAway.title='원정팀 오더만 대신 제출합니다';
  }

  const resultTeamsHeaderHtml=buildResultTeamsHeaderHtml({
    team1:dn1,
    team2:dn2,
    club1:baseClub(t1?.club||''),
    club2:baseClub(t2?.club||''),
    isIndividual:isIndividualMode,
    escapeHtml:esc
  });
  const p1=t1.players||[],p2=t2.players||[];
  const exRb=Array.isArray(m.rubbers)?m.rubbers:[];
  const existingMatchMemo=getMatchMemoByObj(m);
  const scBtns=(id,cur)=>buildScoreButtonsHtml({
    inputId:id,
    current:cur,
    escapeAttr:escAttr
  });
  const buildResultRubberCard=(args)=>buildRubberResultCardHtml(args);
  const buildResultSection=(args)=>buildResultSectionHtml(args);
  const buildResultMemo=(memo)=>buildResultMemoHtml({memo,escapeHtml:esc});
  let html='';

  if(isIndividualMode){
    const rb=(Array.isArray(exRb)&&exRb[0])?exRb[0]:{};
    const p1v=(rb.players1&&rb.players1.length?rb.players1:p1)||[];
    const p2v=(rb.players2&&rb.players2.length?rb.players2:p2)||[];
    const s1v=(rb.score1!=null&&rb.score1!=='')?rb.score1:'';
    const s2v=(rb.score2!=null&&rb.score2!=='')?rb.score2:'';
    const roundLabel=getIndividualMatchLabel(key,m)||'1경기';
    const sideLabel1=getIndividualSideLabel(key,m,m.t1)||'1번';
    const sideLabel2=getIndividualSideLabel(key,m,m.t2)||'2번';
    const grpCourts=(m.phase==='group' && m.group!=null)?((G.draws[key]?.groups?.[Number(m.group)]?.courts)||[]):[];
    const matchCourts=Array.isArray(m.courts)?m.courts:(m.court?[m.court]:[]);
    const roundTheme=getRoundVisualTheme(roundLabel,m.phase||'');
    html=buildIndividualResultBodyHtml({
      divisionLabel:dl(div),
      divisionClass:divisionHeaderClass(div),
      roundLabel,
      roundTheme,
      phase:m.phase||'',
      groupIndex:m.group,
      groupCourts:grpCourts,
      matchId:m.id,
      matchCourts,
      memo:existingMatchMemo||'',
      sideLabel1,
      sideLabel2,
      players1:p1v,
      players2:p2v,
      score1:s1v,
      score2:s2v,
      scoreButtons1Html:scBtns('rs1_0',s1v===''?null:Number(s1v)),
      scoreButtons2Html:scBtns('rs2_0',s2v===''?null:Number(s2v)),
      key,
      escapeHtml:esc,
      escapeAttr:escAttr
    });
    ge('mM3B').innerHTML=html;
    om('mM3');
    refreshAllOrderChipAvailability();
    return;
  }


  const defSlotLabels=['1·2번','3·4번','5·6번','7·8번','9·10번'];
  let statusText='';
  if(useOrderHere){
    if(st.bothSubmitted) statusText='🔒 양팀 제출 완료 — 오더가 공개되었고 더 이상 수정할 수 없습니다.';
    else if(isOperator) statusText='👀 경기진행자는 양 팀 명단과 제출 현황만 먼저 볼 수 있습니다. 이미 제출한 팀의 오더 배치는 양팀 제출 완료 후에만 공개됩니다. 아직 제출하지 않은 팀만 대신 제출할 수 있습니다.';
    else if(st.mySubmitted) statusText='✅ 내 클럽 제출 완료 — 상대 클럽 제출 전까지는 내 오더를 다시 선택해서 수정제출할 수 있습니다.';
    else if(mySide) statusText='📝 아직 제출 전입니다. 지금은 자유롭게 수정할 수 있고, 제출하면 내 클럽 오더가 저장됩니다.';
    else statusText='📝 관리자만 전체 오더를 확인할 수 있습니다.';
  }
  const photoAssistVisible=!!(
    side1PhotoEditable||side2PhotoEditable||
    side1PhotoViewable||side2PhotoViewable||
    _orderPhotoGetSaved(m,1)||_orderPhotoGetSaved(m,2)
  );

  html=`${resultTeamsHeaderHtml}
  ${buildTeamResultIntroHtml({
    useOnlineOrder:useOrderHere,
    bothSubmitted:st.bothSubmitted,
    isOperator
  })}
  ${buildOrderSubmitStatusHtml({
    show:useOrderHere,
    bothSubmitted:st.bothSubmitted,
    mySubmitted:st.mySubmitted,
    side1Submitted:st.s1,
    side2Submitted:st.s2,
    team1:dn1,
    team2:dn2,
    statusText,
    escapeHtml:esc
  })}
  ${buildPhotoAssistHtml({
    show:photoAssistVisible,
    team1:dn1,
    team2:dn2,
    side1Editable:side1PhotoEditable,
    side2Editable:side2PhotoEditable,
    side1Saved:!!_orderPhotoGetSaved(m,1),
    side2Saved:!!_orderPhotoGetSaved(m,2),
    escapeHtml:esc
  })}
  ${buildMatchMemoFieldHtml({
    memo:existingMatchMemo||'',
    escapeHtml:esc
  })}`;
  for(let r=0;r<dbl;r++){
    const rb=exRb[r]||{};
    const submitted1=getSubmittedPlayersForSide(key,m,1,r);
    const submitted2=getSubmittedPlayersForSide(key,m,2,r);
    const submittedRow1=((st.subs[st.c1]||{}).rubbers||[])[r]||{};
    const submittedRow2=((st.subs[st.c2]||{}).rubbers||[])[r]||{};
    const defP1=[p1[r*2],p1[r*2+1]].filter(Boolean);
    const defP2=[p2[r*2],p2[r*2+1]].filter(Boolean);
    const savedP1=Array.isArray(rb.players1)?rb.players1.filter(Boolean):[];
    const savedP2=Array.isArray(rb.players2)?rb.players2.filter(Boolean):[];
    // 초기 진입 시 기본 슬롯 선수(1·2번, 3·4번 ...)를 자동 선택하지 않음.
    // 이미 제출되었거나 임시저장된 값만 복원하고, 처음 작성은 빈 상태로 시작한다.
    const selP1=submitted1.length?submitted1:((submittedRow1.blankOrder||rb.blankOrder1)?[]:savedP1);
    const selP2=submitted2.length?submitted2:((submittedRow2.blankOrder||rb.blankOrder2)?[]:savedP2);
    const sv1=rb.score1!=null?rb.score1:'';
    const sv2=rb.score2!=null?rb.score2:'';
    const canEditSide1=AD || (mySide===1 && !myLocked) || (isOperator && !st.s1 && !st.bothSubmitted);
    const canEditSide2=AD || (mySide===2 && !myLocked) || (isOperator && !st.s2 && !st.bothSubmitted);
    const showSide1=isOperator || revealBoth || mySide===1 || AD;
    const showSide2=isOperator || revealBoth || mySide===2 || AD;
    const displaySelP1=(isOperator && !st.bothSubmitted && st.s1)?[]:selP1;
    const displaySelP2=(isOperator && !st.bothSubmitted && st.s2)?[]:selP2;
    const pickerHtml=(arr,selArr,cid,editable)=>`<div id="${cid}" class="m3-pick-wrap" data-players="${encodeURIComponent(JSON.stringify(arr||[]))}" data-selected="${encodeURIComponent(JSON.stringify(selArr||[]))}"><div class="m3-picked"></div>${editable?`<button type="button" class="btn btn-outline m3-picker-toggle" onclick="togglePlayerDropdown('${cid}')"><span>선수 선택</span><span>▼</span></button><div class="m3-picker-list" id="${cid}_list"></div>`:''}</div>`;
    const hiddenHtml=(selArr,cid)=>`<div id="${cid}" style="display:none" data-selected="${encodeURIComponent(JSON.stringify(selArr||[]))}"></div>`;
    const fixedPairHtml=(arr,cid)=>`<div id="${cid}" style="display:none" data-selected="${encodeURIComponent(JSON.stringify(arr||[]))}"></div><div style="padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;background:#f8fafc;font-size:.82rem;color:var(--text);font-weight:800;line-height:1.6">${(arr||[]).length?arr.join(' / '):'선수 정보 없음'}</div>`;
    const side1BoxHtml=buildOrderSideBoxHtml({
      teamName:dn1,
      isIndividual:isIndividualMode,
      submitted:st.s1,
      showSide:showSide1,
      operatorHiddenSubmitted:(isOperator && !st.bothSubmitted && st.s1),
      blankOrder:!!(submittedRow1.blankOrder||rb.blankOrder1),
      pickerHtml:(isIndividualMode?fixedPairHtml(p1,`rp1_${r}`):pickerHtml(p1,displaySelP1,`rp1_${r}`,canEditSide1)),
      hiddenHtml:hiddenHtml([],`rp1_${r}`),
      fixedPairHtml:fixedPairHtml(p1,`rp1_${r}`),
      escapeHtml:esc
    });
    const side2BoxHtml=buildOrderSideBoxHtml({
      teamName:dn2,
      isIndividual:isIndividualMode,
      submitted:st.s2,
      showSide:showSide2,
      operatorHiddenSubmitted:(isOperator && !st.bothSubmitted && st.s2),
      blankOrder:!!(submittedRow2.blankOrder||rb.blankOrder2),
      pickerHtml:(isIndividualMode?fixedPairHtml(p2,`rp2_${r}`):pickerHtml(p2,displaySelP2,`rp2_${r}`,canEditSide2)),
      hiddenHtml:hiddenHtml([],`rp2_${r}`),
      fixedPairHtml:fixedPairHtml(p2,`rp2_${r}`),
      escapeHtml:esc
    });
    html+=buildTeamRubberCardHtml({
      rubberNo:r+1,
      defaultSlotLabel:defSlotLabels[r],
      winnerLabel:(rb.winner!=null?(rb.winner===0?dn1:dn2):''),
      side1BoxHtml,
      side2BoxHtml,
      team1:dn1,
      team2:dn2,
      scoreButtons1Html:scBtns('rs1_'+r,sv1===''?null:Number(sv1)),
      scoreButtons2Html:scBtns('rs2_'+r,sv2===''?null:Number(sv2)),
      score1:sv1,
      score2:sv2,
      escapeHtml:esc,
      escapeAttr:escAttr
    });
  }
  ge('mM3B').innerHTML=html;
  const body = ge('mM3B');
  if(body){
    const topInfo = document.createElement('div');
    topInfo.style.cssText = 'margin-bottom:12px;padding:12px 14px;border-radius:14px;border:1.5px solid var(--border);background:linear-gradient(135deg,#f8fbff,#eef4ff)';
    topInfo.innerHTML = ``;
    body.prepend(topInfo);
    if(!myLocked && !isIndividualMode){
      const quickActionWrap=document.createElement('div');
      quickActionWrap.id='mM3QuickActionWrap';
      quickActionWrap.style.cssText='margin:0 0 12px;padding:12px 13px;border-radius:14px;border:1.5px solid #fed7aa;background:linear-gradient(135deg,#fffaf0,#fff7ed)';
      quickActionWrap.innerHTML=buildQuickActionPanelHtml({
        doublesCount:dbl,
        team1:dn1,
        team2:dn2,
        isAdmin:!!AD,
        isOperator:!!OP,
        mySide,
        escapeHtml:esc
      });
      const submitStatusCard=ge('mM3SubmitStatusCard');
      const photoAssistCard=ge('mM3PhotoAssistCard');
      if(submitStatusCard){
        if(photoAssistCard) photoAssistCard.insertAdjacentElement('beforebegin', quickActionWrap);
        else submitStatusCard.insertAdjacentElement('afterend', quickActionWrap);
      }else if(photoAssistCard){
        photoAssistCard.insertAdjacentElement('beforebegin', quickActionWrap);
      }else{
        body.prepend(quickActionWrap);
      }
    }
  }
  setTimeout(()=>{
    try{
      ensureM3AdminSubmitButtons();
      ensureM3OperatorSubmitButtons();
    }catch(_e){}
  },0);
  om('mM3');
  refreshAllOrderChipAvailability();
  requestAnimationFrame(()=>applyLastOrderIfEmpty(key, m, dbl, st));
}


function esc(s){return(s||'').replace(/'/g,"\\'").replace(/"/g,'&quot;');}
// 스코어 버튼 클릭 핸들러
function setRbSc(inputId, val){
  const inp = ge(inputId);
  if(!inp) return;
  inp.value = val;
  for(let n=0;n<=6;n++){
    const btn = ge(inputId+'_btn'+n);
    if(!btn) continue;
    const active = n===val;
    btn.style.background = active?'var(--primary)':'white';
    btn.style.color = active?'white':'var(--text)';
    btn.style.borderColor = active?'var(--primary)':'var(--border)';
  }
}

function getPickerSelected(cid){
  const cont=ge(cid); if(!cont) return [];
  if(cont.dataset.selected){
    try{ return JSON.parse(decodeURIComponent(cont.dataset.selected)); }catch(e){}
  }
  return [...(cont.querySelectorAll('.p-chip.sel')||[])].map(c=>String(c.dataset.p||'')).filter(Boolean);
}
function setPickerSelected(cid, arr){
  const cont=ge(cid); if(!cont) return;
  cont.dataset.selected=encodeURIComponent(JSON.stringify((arr||[]).filter(Boolean).slice(0,2)));
}
function getPickerPlayers(cid){
  const cont=ge(cid); if(!cont) return [];
  if(cont.dataset.players){
    try{ return JSON.parse(decodeURIComponent(cont.dataset.players)); }catch(e){}
  }
  return [...(cont.querySelectorAll('.p-chip')||[])].map(c=>String(c.dataset.p||'')).filter(Boolean);
}
function getPickerOtherUsed(cid){
  const prefix=(cid||'').startsWith('rp2_')?'rp2_':'rp1_';
  const out=[];
  document.querySelectorAll(`[id^="${prefix}"]`).forEach(el=>{
    if(!el || !/^rp[12]_\d+$/.test(el.id) || el.id===cid) return;
    getPickerSelected(el.id).forEach(p=>{ if(p && !out.includes(p)) out.push(p); });
  });
  return out;
}

function syncGhostScoreFromPickers(cid){
  const m=(CM_key&&CM_id)?(G.matches[CM_key]||[]).find(x=>x.id===CM_id):null;
  if(!m) return;
  const r = parseInt(String(cid||'').split('_')[1]||'-1',10);
  if(!(r>=0)) return;
  const sel1=getPickerSelected('rp1_'+r);
  const sel2=getPickerSelected('rp2_'+r);
  const in1=ge('rs1_'+r), in2=ge('rs2_'+r);
  if(!in1||!in2) return;
  const prev=(Array.isArray(m.rubbers)?m.rubbers:[])[r]||{};
  const plan=getGhostScorePlan(sel1,sel2,prev,in1.value,in2.value);
  if(plan.action==='set'){
    setRbSc('rs1_'+r,plan.score1);
    setRbSc('rs2_'+r,plan.score2);
  }else if(plan.action==='clear'){
    in1.value=''; in2.value='';
    for(let n=0;n<=6;n++){
      const b1=ge('rs1_'+r+'_btn'+n), b2=ge('rs2_'+r+'_btn'+n);
      if(b1){b1.style.background='white';b1.style.color='var(--text)';b1.style.borderColor='var(--border)';}
      if(b2){b2.style.background='white';b2.style.color='var(--text)';b2.style.borderColor='var(--border)';}
    }
  }
}
function setGhostOrder(cid){
  const cont=ge(cid); if(!cont) return;
  setPickerSelected(cid,['__GHOST__']);
  renderPlayerDropdown(cid);
  syncGhostScoreFromPickers(cid);
}
function clearGhostOrder(cid){
  setPickerSelected(cid,[]);
  renderPlayerDropdown(cid);
  syncGhostScoreFromPickers(cid);
}
function renderPlayerDropdown(cid){
  const cont=ge(cid); if(!cont) return;
  const list=ge(cid+'_list');
  const players=getPickerPlayers(cid);
  const selected=getPickerSelected(cid);
  const otherUsed=getPickerOtherUsed(cid);
  const available=players.filter(p=>!otherUsed.includes(p) && !selected.includes(p));
  const editable=!!list;
  const picked=cont.querySelector('.m3-picked');
  if(picked){
    const isGhost = selected[0]==='__GHOST__';
    picked.innerHTML=isGhost
      ? `<span class="m3-picked-item" style="background:#fff7ed;color:#9a3412;border-color:#fdba74"><span class="num" style="background:#d97706">!</span>공오더${editable?`<button type="button" class="rm" onclick="clearGhostOrder('${cid}')" style="background:#d97706">✕</button>`:''}</span>`
      : (selected.length
        ? selected.map((p,idx)=>`<span class="m3-picked-item"><span class="num">${idx+1}</span>${p}${editable?`<button type="button" class="rm" onclick="removeSelectedPlayerFromDropdown('${cid}','${esc(p)}')">✕</button>`:''}</span>`).join('')
        : '<div class="m3-picked-empty">선수 2명 선택 또는 공오더</div>');
  }
  if(!list) return;
  const btn=cont.querySelector('.m3-picker-toggle');
  if(btn){
    const label = selected.length===0
      ? '선수 선택'
      : (selected.length===2 ? '선수 선택 완료 (2/2)' : `선수 ${selected.length}명 선택됨 (${selected.length}/2)`);
    btn.innerHTML=`<span>${label}</span><span>${list.classList.contains('open')?'▲':'▼'}</span>`;
  }
  list.innerHTML=available.length
    ? available.map((p,idx)=>`<div class="m3-picker-row pickable" role="button" tabindex="0" onclick="choosePlayerFromDropdown('${cid}','${esc(p)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();choosePlayerFromDropdown('${cid}','${esc(p)}')}"><span>${p}</span><span class="meta">${idx+1}</span></div>`).join('')
    : '<div class="m3-picker-row"><span>선택 가능한 선수가 없습니다</span><span class="meta">다른 복식조 사용중</span></div>';
}
function togglePlayerDropdown(cid){
  const list=ge(cid+'_list'); if(!list) return;
  const willOpen=!list.classList.contains('open');
  document.querySelectorAll('.m3-picker-list.open').forEach(el=>el.classList.remove('open'));
  if(willOpen) list.classList.add('open');
  renderPlayerDropdown(cid);
}
function choosePlayerFromDropdown(cid, player){
  const selected=getPickerSelected(cid);
  if(selected.includes(player)) return;
  if(selected.length>=2){ toast('이 복식조는 이미 2명 선택되었습니다','info'); return; }
  selected.push(player);
  setPickerSelected(cid, selected);
  refreshAllOrderChipAvailability();
  const list=ge(cid+'_list');
  if(list && selected.length>=2){
    list.classList.remove('open');
    renderPlayerDropdown(cid);
  }
  syncGhostScoreFromPickers(cid);
}
function removeSelectedPlayerFromDropdown(cid, player){
  setPickerSelected(cid, getPickerSelected(cid).filter(p=>p!==player));
  refreshAllOrderChipAvailability();
  syncGhostScoreFromPickers(cid);
}
function refreshOrderChipAvailability(sidePrefix){
  document.querySelectorAll(`[id^="${sidePrefix}"]`).forEach(el=>{
    if(!el || !/^rp[12]_\d+$/.test(el.id) || !el.dataset.players) return;
    renderPlayerDropdown(el.id);
  });
}
function refreshAllOrderChipAvailability(){
  refreshOrderChipAvailability('rp1_');
  refreshOrderChipAvailability('rp2_');
}
function tC(cid,player){
  const sel=getPickerSelected(cid);
  if(sel.includes(player)) removeSelectedPlayerFromDropdown(cid,player);
  else choosePlayerFromDropdown(cid,player);
}

async function saveM3(){
  const prevCourtState=captureCourtNotificationState();
  const key=CM_key,mid=CM_id;if(!key||!mid)return;
  const list=G.matches[key]||[];const idx=list.findIndex(m=>m.id===mid);if(idx<0)return;
  const m=list[idx];
  const resultMatchSnapshot=cloneResultMatchForRollback(m);
  const indivAuth=getIndividualResultAuthState(key,m);
  const canStandardEdit=(AD||OP||canEditMatchByDirector(key,m));
  let participantWinnerAuth=null;
  if(isIndividualByKey(key) && !canStandardEdit){
    if(!indivAuth.allowed){toast('참가자 등록 비밀번호가 설정되지 않아 결과를 저장할 수 없습니다','error');return;}
  }else if(!canStandardEdit){toast('해당 경기 참가 클럽의 경기이사·경기진행자·관리자만 저장할 수 있습니다','error');return;}
  const {t1,t2}=getMatchTeamObjects(key,m); if(!t1 && !t2) return;
  const [tid,div]=key.split('_');
  const tObj=G.tournaments.find(t=>t.id===tid);
  const cfg=gDS(tObj,div);
  const dbl=cfg.doublesCount||(t1.doublesCount)||5;
  const orderState=getOnlineOrderState(key,m);
  const mySide=orderState.mySide;
  const newRb=[];let sc1=0,sc2=0;let validScoreCount=0;let pairChanged=false;
  const prevRb=Array.isArray(m.rubbers)?m.rubbers:[];
  m.memo=(ge('mM3MatchMemo')?.value||'').trim();
  for(let r=0;r<dbl;r++){
    const c1=ge('rp1_'+r),c2=ge('rp2_'+r);
    const rawPl1=getPickerSelected('rp1_'+r);
    const rawPl2=getPickerSelected('rp2_'+r);
    const currentBlank1=rawPl1[0]==='__GHOST__';
    const currentBlank2=rawPl2[0]==='__GHOST__';
    const pl1=currentBlank1?[]:rawPl1;
    const pl2=currentBlank2?[]:rawPl2;
    let s1v=ge('rs1_'+r)?.value,s2v=ge('rs2_'+r)?.value;
    const prev=prevRb[r]||{};
    const rowBlank1=!!(currentBlank1 || prev.blankOrder1 || ((orderState.subs[orderState.c1]||{}).rubbers||[])[r]?.blankOrder);
    const rowBlank2=!!(currentBlank2 || prev.blankOrder2 || ((orderState.subs[orderState.c2]||{}).rubbers||[])[r]?.blankOrder);
    if(rowBlank1 && !rowBlank2){ s1v='0'; s2v='6'; }
    else if(!rowBlank1 && rowBlank2){ s1v='6'; s2v='0'; }
    else if(rowBlank1 && rowBlank2){ s1v=''; s2v=''; }
    if(ge('rs1_'+r) && (rowBlank1||rowBlank2)) ge('rs1_'+r).value = (s1v ?? '');
    if(ge('rs2_'+r) && (rowBlank1||rowBlank2)) ge('rs2_'+r).value = (s2v ?? '');
    const hasPair=(pl1.length>0||pl2.length>0||rowBlank1||rowBlank2);
    const noScore=(s1v===''&&s2v==='');
    const isZeroZero=(String(s1v)==='0'&&String(s2v)==='0');
    const prev1=JSON.stringify(prev.players1||[]), cur1=JSON.stringify(pl1||[]);
    const prev2=JSON.stringify(prev.players2||[]), cur2=JSON.stringify(pl2||[]);
    if(prev1!==cur1||prev2!==cur2) pairChanged=true;
    const ownChanged = mySide===1 ? (prev1!==cur1) : mySide===2 ? (prev2!==cur2) : ((prev1!==cur1)||(prev2!==cur2));
    if(G.meta.onlineOrderEnabled && !AD && !OP && orderState.bothSubmitted && ownChanged){
      toast('양팀 제출 완료 후에는 오더를 수정할 수 없습니다. 관리자만 초기화할 수 있습니다','error');
      return;
    }

    if(noScore||isZeroZero){
      if(hasPair){
        const baseRb={players1:pl1,players2:pl2,score1:null,score2:null,winner:null,tiebreak:false};
        if(rowBlank1) baseRb.blankOrder1=true;
        if(rowBlank2) baseRb.blankOrder2=true;
        applyBlankOrderAutoScore(baseRb);
        newRb.push(baseRb);
      }else newRb.push({});
      continue;
    }

    const scoreResult=analyzeRubberScore(s1v,s2v);
    const scoreError=getRubberScoreErrorMessage(scoreResult,r+1);
    if(scoreError){toast(scoreError,'error');return;}
    const s1=scoreResult.score1, s2=scoreResult.score2, w=scoreResult.winner;
    if(w===0) sc1++; else sc2++;
    validScoreCount++;
    const scoreRb={players1:pl1,players2:pl2,score1:s1,score2:s2,winner:w,tiebreak:false};
    if(rowBlank1) scoreRb.blankOrder1=true;
    if(rowBlank2) scoreRb.blankOrder2=true;
    applyBlankOrderAutoScore(scoreRb);
    newRb.push(scoreRb);
  }

  const prevW=m.winner;

  if(validScoreCount===0){
    if(prevW!=null && !m.bye){toast('이미 결과가 확정된 경기는 점수 없이 저장할 수 없습니다','error');return;}
    if(!pairChanged){toast('변경된 페어가 없습니다','info');return;}
    m.rubbers=newRb;
    m.winner=null;
    sl(true);
    try{
      await persistSingleMatchDoc(key, m);
      saveLastOrderFromPicker(key, m);
      sl(false);cm('mM3');toast('페어 저장 완료 ✅','success');renderBracket();
    }catch(e){sl(false);toast('저장 실패: '+e.message,'error');}
    return;
  }

  const totalRubbers=getMatchDoublesCount(key,m);
  const resultOutcome=getTeamMatchOutcome({
    score1:sc1,
    score2:sc2,
    totalRubbers
  });
  const {needWins,isTieState,hasFinalWinner}=resultOutcome;

  if(isIndividualByKey(key) && !canStandardEdit){
    if(!hasFinalWinner){
      toast('개인전 참가자 입력은 승패가 확정된 결과만 저장할 수 있습니다','error');
      return;
    }
    const scoreText=getIndividualActualScoreText({rubbers:newRb}) || `${sc1}:${sc2}`;
    const winnerSide=getIndividualWinnerSideByScoreText(scoreText) || (sc1>sc2?1:2);
    const inputPw=String(prompt('참가자 등록 시 입력한 비밀번호 4자리를 입력하세요')||'').replace(/\D/g,'').slice(0,4);
    if(inputPw.length!==4){
      toast('비밀번호 4자리를 정확히 입력해야 합니다','error');
      return;
    }
    const pw1=String(indivAuth.pw1||'').replace(/\D/g,'');
    const pw2=String(indivAuth.pw2||'').replace(/\D/g,'');
    const authSide=inputPw===pw1?1:inputPw===pw2?2:0;
    if(!authSide){
      toast('비밀번호가 일치하지 않습니다','error');
      return;
    }
    if(authSide!==winnerSide){
      toast('승리팀 참가자 비밀번호일 때만 결과 저장할 수 있습니다','error');
      return;
    }
    participantWinnerAuth={authSide, scoreText};
  }

  m.rubbers=newRb;
  if(G.meta.onlineOrderEnabled && orderState.bothSubmitted) syncRevealedOrderIntoMatchRubbers(key,m);
  m.winner=resolveWinnerTeamIndex({
    team1Index:m.t1,
    team2Index:m.t2,
    outcome:resultOutcome
  });

  const adjustPlayerStatsForUnfinalized = async () => {
    if(prevW==null) return;
    const teams=G.teams[key]||[];
    const gk=(n,t)=>getPlayerKey(n,baseClub(t?.club||''));
    const pw=teams[prevW], pl=teams[prevW===m.t1?m.t2:m.t1];
    const affected=new Set();
    if(pw) (pw.players||[]).forEach(n=>{
      const k=gk(n,pw);
      if(G.players[k]?.wins>0){
        G.players[k].wins--;
        affected.add(k);
      }
    });
    if(pl) (pl.players||[]).forEach(n=>{
      const k=gk(n,pl);
      if(G.players[k]?.losses>0){
        G.players[k].losses--;
        affected.add(k);
      }
    });
    if(affected.size) enqueuePlayerPersist([...affected], 15000);
  };

  const resultPlayerKeys=[...new Set([
    ...((t1?.players)||[]).map(n=>getPlayerKey(n,baseClub(t1?.club||''))),
    ...((t2?.players)||[]).map(n=>getPlayerKey(n,baseClub(t2?.club||'')))
  ].filter(Boolean))];
  const resultPlayerSnapshot=createPlayerStatSnapshot(G.players,resultPlayerKeys);

  if(hasFinalWinner) await updPS(key,m,prevW);
  else await adjustPlayerStatsForUnfinalized();

  const finishedCourts = hasFinalWinner ? (Array.isArray(m.courts) ? m.courts : (m.court ? [m.court] : [])) : [];

  saveLastOrderFromPicker(key, m);
  const dn1=tdn(t1,key,m.t1),dn2=tdn(t2,key,m.t2);
  const indivScoreText=isIndividualByKey(key)?(getIndividualActualScoreText(m)||`${sc1}:${sc2}`):'';
  const alertScoreText=indivScoreText||`${sc1}:${sc2}`;

  await commitMatchResultSave({
    match:m,
    matchSnapshot:resultMatchSnapshot,
    playersStore:G.players,
    playerSnapshot:resultPlayerSnapshot,
    setLoading:sl,
    dispatchAlerts:dispatchLocalCourtNotificationAlerts,
    previousNotificationState:prevCourtState,
    closeModal:()=>cm('mM3'),
    notify:toast,
    successMessage:buildResultSaveLabel(resultOutcome),
    render:renderBracket,
    enqueuePlayerPersist,
    failurePrefix:'저장 실패: ',
    runPersistence:()=>runResultPersistencePlan({
      hasFinalWinner,
      isTieState,
      isIndividual:isIndividualByKey(key),
      phase:m.phase,
      persistMatch:()=>persistSingleMatchDoc(key,m),
      saveAllMatches:()=>stM(key),
      syncIndividualMain:()=>m.phase==='group' ? syncIndividualMainBracketFromPrelim(key) : false,
      ensureAutoCourtAssignments:()=>isIndividualAutoCourtAssignEnabled()
        ? ensureIndividualAutoCourtAssignmentsForKey(key)
        : false,
      logFinal:()=>fbLog(`결과: ${dn1} ${alertScoreText} ${dn2}`,'⚡'),
      logTie:()=>fbLog(`실시간점수: ${dn1} ${alertScoreText} ${dn2} (동점 진행중)`,'📝'),
      logLive:()=>fbLog(`실시간점수: ${dn1} ${alertScoreText} ${dn2}`,'📝'),
      autoAdvance:()=>autoAdv(key,m.id)
    })
  });
}

// ═══════════════════════════════════════════════════
//  경기기록 초기화 & 전체 재계산
// ═══════════════════════════════════════════════════

/**
 * key(대회_부서)의 매치 기록에서 선수 승패 차감 + 메모리 초기화
 */
async function resetMatchRecords(key){
  const matches=G.matches[key]||[];
  const teams=G.teams[key]||[];
  const affected=new Set();
  for(const m of matches){
    if(m.winner==null) continue;
    const wt=teams[m.winner],lt=teams[m.winner===m.t1?m.t2:m.t1];
    (wt?.players||[]).forEach(n=>{const k=getPlayerKey(n,baseClub(wt?.club||''));if(G.players[k]){G.players[k].wins=Math.max(0,(G.players[k].wins||0)-1);affected.add(k);}});
    (lt?.players||[]).forEach(n=>{const k=getPlayerKey(n,baseClub(lt?.club||''));if(G.players[k]){G.players[k].losses=Math.max(0,(G.players[k].losses||0)-1);affected.add(k);}});
  }
  if(affected.size>0) enqueuePlayerPersist([...affected], 4000);
  G.matches[key]=[];
  delete G.draws[key];
}

/**
 * Firebase 매치 데이터 기반으로 모든 선수 승패 완전 재계산
 * 기존에 잘못 쌓인 기록을 한 번에 정리할 때 사용
 */
async function recalcAllPlayerStats(){
  if(!confirm('전체 선수 승패를 현재 경기 결과 기준으로 재계산합니다.\n잘못 쌓인 테스트 기록이 정리됩니다.\n계속하시겠습니까?')) return;
  sl(true);
  try{
    // ① 모든 선수 승패 0으로 초기화
    Object.values(G.players).forEach(p=>{p.wins=0;p.losses=0;});

    // ② 현재 남아있는 모든 매치 기준으로 재집계
    for(const [key,matchList] of Object.entries(G.matches)){
      const teams=G.teams[key]||[];
      for(const m of (matchList||[])){
        if(m.winner==null||m.bye) continue;
        const wt=teams[m.winner], lt=teams[m.winner===m.t1?m.t2:m.t1];
        (wt?.players||[]).forEach(n=>{const k=getPlayerKey(n,baseClub(wt?.club||''));if(G.players[k])G.players[k].wins=(G.players[k].wins||0)+1;});
        (lt?.players||[]).forEach(n=>{const k=getPlayerKey(n,baseClub(lt?.club||''));if(G.players[k])G.players[k].losses=(G.players[k].losses||0)+1;});
      }
    }

    // ③ 모든 선수 Firebase 저장 (일괄 1회 flush)
    const names=Object.keys(G.players);
    enqueuePlayerPersist(names, 100);
    await flushQueuedPlayers();

    sl(false);
    toast(`재계산 완료 ✅ (${names.length}명)`,'success');
    renderAllP();
  }catch(e){
    sl(false);
    toast('재계산 실패: '+e.message,'error');
    console.error(e);
  }
}

async function updPS(key,m,prevW){
  const teams=G.teams[key]||[];const t1=teams[m.t1],t2=teams[m.t2];if(!t1||!t2)return;
  const gk=(n,t)=>getPlayerKey(n,baseClub(t?.club||''));
  if(prevW!=null){
    const pw=teams[prevW],pl=teams[prevW===m.t1?m.t2:m.t1];
    if(pw)pw.players.forEach(n=>{const k=gk(n,pw);if(G.players[k]?.wins>0)G.players[k].wins--;});
    if(pl)pl.players.forEach(n=>{const k=gk(n,pl);if(G.players[k]?.losses>0)G.players[k].losses--;});
  }
  const wt=teams[m.winner],lt=teams[m.winner===m.t1?m.t2:m.t1];
  if(wt)wt.players.forEach(n=>{const k=gk(n,wt);if(G.players[k])G.players[k].wins=(G.players[k].wins||0)+1;});
  if(lt)lt.players.forEach(n=>{const k=gk(n,lt);if(G.players[k])G.players[k].losses=(G.players[k].losses||0)+1;});
  const allKeys=[...((wt?.players)||[]).map(n=>gk(n,wt)),...((lt?.players)||[]).map(n=>gk(n,lt))];
  enqueuePlayerPersist(allKeys, 15000);
}

async function autoAdv(key,mid){
  const list=G.matches[key]||[];
  const m=list.find(m=>m.id===mid);
  if(!m) return;

  if(m.phase==='playin'){
    const target=list.find(x=>x.phase==='main' && x.round===0 && x.slot===Number(m.targetSlot));
    if(target && m.winner!=null){
      if(String(m.targetSide||'t1')==='t2') target.t2=m.winner;
      else target.t1=m.winner;
      target.winner=null;
      target.bye=false;
    }
    await stM(key);
    return;
  }

  if(m.phase!=='main') return;
  const nm=list.find(m2=>m2.phase==='main'&&m2.round===m.round+1&&m2.slot===Math.floor(m.slot/2));
  if(nm){
    if(m.slot%2===0)nm.t1=m.winner;else nm.t2=m.winner;
    nm.winner=null;nm.bye=false;
  }
  ensureBronzeMatchForKey(key,false);
  await stM(key);
}


function onRankTC(){
  const tid=ge('rankTS').value, ds=ge('rankDS');
  try{ syncTournamentDataForPage('ranking', tid || getRealtimeTargetTournamentId() || null, false).catch(e=>console.warn('ranking sync failed', e)); }catch(e){}
  ds.innerHTML='<option value="">전체 부서</option><option value="__GUIDE__">📌 요강</option>';
  if(!tid)return;
  const t=[...G.tournaments,...HIST_DATA].find(t=>t.id===tid);
  if(t)ds.innerHTML+=t.divisions.map(d=>`<option value="${d}">${dl(d)}</option>`).join('');
  // 관리자: 요강 업로드 바 초기화
  const bar=ge('histGuideUploadBar');
  if(bar){ bar.dataset.tid=tid; ge('histGuidePreview').innerHTML=''; const fi=ge('histGuideFileInput'); if(fi)fi.value=''; window.HIST_GUIDE_PENDING=[]; }
  renderRanking();
}

function getHistTournament(tid){
  return HIST_DATA.find(t=>t.id===tid)||null;
}

function renderRanking(){
  const tid=ge('rankTS').value, div=ge('rankDS').value, cont=ge('rankContent');
  if(!tid){cont.innerHTML='<div class="empty-state card"><div class="empty-icon">📋</div><p>대회를 선택하세요</p></div>';return;}

  // 📌 요강 보기 선택
  if(div==='__GUIDE__'){
    openGuide(tid);
    // 결과 화면에는 안내만 표시
    cont.innerHTML='<div class="empty-state card"><div class="empty-icon">📌</div><p>요강은 팝업으로 열립니다.</p></div>';
    return;
  }

  // Firebase 대회인지 내장 과거 대회인지 판별
  const isHist=HIST_DATA.some(t=>t.id===tid);
  const fbTour=G.tournaments.find(t=>t.id===tid);
  if(isHist){
    renderHistRanking(tid,div,cont);
  } else if(fbTour?.isHistorical){
    // 엑셀 업로드된 과거 대회 → registrations의 rank로 순위 표시
    renderHistRankingFromRegistrations(tid,div,cont);
  } else {
    renderLiveRanking(tid,div,cont);
  }
  if(window.queueStablePageHeight) window.queueStablePageHeight();
}


// ── 과거(엑셀 업로드) 대회 시합결과: registrations(rank) 기반 렌더링 ─────────
function renderHistRankingFromRegistrations(tid, div, cont){
  const t = G.tournaments.find(x=>x.id===tid);
  if(!t){ cont.innerHTML='<div class="empty-state card"><p>대회 정보를 찾을 수 없습니다</p></div>'; return; }

  const allRegs = [];
  Object.entries(G.teams||{}).forEach(([key, arr])=>{
    if(!key.startsWith(tid+'_')) return;
    const divPart = key.slice(tid.length+1);
    (arr||[]).forEach(team=>{
      allRegs.push({
        div: team.division || divPart,
        club: team.club||'',
        players: team.players||[],
        rank: (typeof team.rank==='number'?team.rank:(typeof team._rank==='number'?team._rank:null))
      });
    });
  });

  if(!allRegs.length){
    // G.teams 미로드 → Firestore 직접 읽기
    cont.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3);font-size:.82rem">⏳ 데이터 로딩 중...</div>';
    getDocs(query(collection(db,'registrations'),where('tournamentId','==',tid)))
      .then(snap=>{
        const regs2=[];
        snap.docs.forEach(d=>{
          const x=d.data()||{};
          regs2.push({div:x.division||'',club:x.club||'',players:x.players||[],
            rank:(typeof x.rank==='number'?x.rank:null)});
        });
        _renderHistRankingHTML(t,div,regs2,cont);
      })
      .catch(e=>{ cont.innerHTML=`<div class="empty-state card"><p>로드 실패: ${e.message}</p></div>`; });
    return;
  }
  _renderHistRankingHTML(t,div,allRegs,cont);
}

function _renderHistRankingHTML(t, div, allRegs, cont){
  const divs = div ? [div] : (t.divisions||[]);
  let html=`<div style="padding:10px 14px;background:linear-gradient(135deg,#eef2ff,#dce8fb);border-radius:var(--radius-lg);border:1.5px solid var(--success);margin-bottom:14px">
    <div style="font-weight:700;font-size:.95rem">${t.name}</div>
    <div style="font-size:.78rem;color:var(--text2);margin-top:2px">📅 ${t.date}</div>
  </div>`;

  divs.forEach(d=>{
    const teams = allRegs.filter(r=>r.div===d);
    if(!teams.length) return;
    if(divs.length>1) html+=`<div class="sec-title" style="margin-top:12px">${dl(d)}</div>`;

    const champ=teams.find(x=>x.rank===1);
    if(champ){
      html+=`<div style="background:linear-gradient(135deg,#fef3cd,#f5a623);border:2px solid var(--accent);border-radius:var(--radius-lg);padding:12px 14px;margin-bottom:10px;display:flex;align-items:center;gap:12px">
        <div style="font-size:2rem">🏆</div>
        <div><div style="font-weight:700;font-size:1rem">${champ.club}</div><div style="font-size:.72rem;color:#92400e">우승 · ${dl(d)}</div></div>
      </div>`;
    }

    const ranked=teams.filter(x=>typeof x.rank==='number').sort((a,b)=>a.rank-b.rank);
    const unranked=teams.filter(x=>typeof x.rank!=='number');

    html+=`<div class="card" style="margin-bottom:10px"><div class="table-wrap"><table>
      <thead><tr><th>순위</th><th>팀명</th><th>선수 명단</th></tr></thead><tbody>`;
    [...ranked,...unranked].forEach(tm=>{
      const rk=tm.rank;
      const badge=rk===1?'🥇':rk===2?'🥈':rk===3?'🥉':rk===99?'최하위':rk?rk+'위':'참가';
      const bg=rk===1?'#fef3cd':rk===2?'#f0f4fa':rk===3?'#fdf0ef':'';
      html+=`<tr style="background:${bg}">
        <td style="text-align:center;font-weight:700">${badge}</td>
        <td style="font-weight:700;white-space:nowrap">${tm.club}</td>
        <td style="font-size:.72rem;color:var(--text2)">${(tm.players||[]).join(' · ')}</td>
      </tr>`;
    });
    html+=`</tbody></table></div></div>`;
  });
  cont.innerHTML=html;
  renderFloatingNotice();
}

// ── 과거 내장 데이터 시합결과 렌더링 ─────────────────────
function renderHistRanking(tid,div,cont){
  const ht=HIST_DATA.find(t=>t.id===tid);
  if(!ht){cont.innerHTML='<div class="empty-state card"><p>데이터 없음</p></div>';return;}

  const divs=div?[div]:ht.divisions;
  let html=`<div style="padding:10px 14px;background:linear-gradient(135deg,#eef2ff,#dce8fb);border-radius:var(--radius-lg);border:1.5px solid var(--success);margin-bottom:14px">
    <div style="font-weight:700;font-size:.95rem">${ht.name}</div>
    <div style="font-size:.78rem;color:var(--text2);margin-top:2px">📅 ${ht.date} &nbsp;|&nbsp; 회차: 제${ht.seq}회 ${ht.season}</div>
  </div>`;

  divs.forEach(d=>{
    const teams=ht.teams.filter(tm=>tm.div===d);
    if(!teams.length)return;
    if(divs.length>1) html+=`<div class="sec-title" style="margin-top:12px">${dl(d)}</div>`;

    // 우승팀
    const champ=teams.find(tm=>tm.rank===1);
    if(champ) html+=`<div style="background:linear-gradient(135deg,#fef3cd,#f5a623);border:2px solid var(--accent);border-radius:var(--radius-lg);padding:12px 14px;margin-bottom:10px;display:flex;align-items:center;gap:12px">
      <div style="font-size:2rem">🏆</div>
      <div><div style="font-weight:700;font-size:1rem">${champ.club}</div><div style="font-size:.72rem;color:#92400e">최종 우승 · ${dl(d)}</div></div>
    </div>`;

    // 순위별 팀 목록
    const ranked=teams.filter(tm=>tm.rank).sort((a,b)=>a.rank-b.rank);
    const unranked=teams.filter(tm=>!tm.rank);

    html+=`<div class="card" style="margin-bottom:10px"><div class="table-wrap"><table>
      <thead><tr><th>순위</th><th>팀명</th><th>선수 명단</th></tr></thead><tbody>`;

    [...ranked,...unranked].forEach(tm=>{
      const rk=tm.rank;
      const rkBadge=rk===1?'🥇':rk===2?'🥈':rk===3?'🥉':rk?rk+'위':'참가';
      const rkBg=rk===1?'#fef3cd':rk===2?'#f0f4fa':rk===3?'#fdf0ef':'';
      html+=`<tr style="background:${rkBg}">
        <td style="text-align:center;font-weight:700;font-size:.9rem">${rkBadge}</td>
        <td style="font-weight:700;white-space:nowrap">${tm.club}</td>
        <td style="font-size:.72rem;color:var(--text2)">${tm.players.join(' · ')}</td>
      </tr>`;
    });
    html+=`</tbody></table></div></div>`;
  });

  cont.innerHTML=html;
  if(window.queueStablePageHeight) window.queueStablePageHeight();
}

// ── Firebase 실시간 대회 시합결과 렌더링 ──────────────────
function renderLiveRanking(tid,div,cont){
  const t=G.tournaments.find(t=>t.id===tid);if(!t)return;
  const divs=div?[div]:(t.divisions||[]);
  let html='';
  divs.forEach(d=>{
    const key=tid+'_'+d,teams=G.teams[key]||[],draw=G.draws[key];
    const allMs=G.matches[key]||[];
    const playInMs=allMs.filter(m=>m.phase==='playin');
  const mMs=allMs.filter(m=>m.phase==='main');
    const summary=getMainMedalSummary(key,teams,mMs);
    if(divs.length>1) html+=`<div class="sec-title" style="margin-top:${html?'18px':'0'}">${dl(d)}</div>`;
    if(summary){
      const medalItems=[
        {emoji:'🏆',title:'우승',value:summary.champion,bg:'linear-gradient(135deg,#fff8dd,#fde68a)',border:'#d4a017'},
        {emoji:'🥈',title:'준우승',value:summary.runner,bg:'linear-gradient(135deg,#f8fafc,#e5e7eb)',border:'#aab2c3'},
        {emoji:'🥉',title:summary.thirdLabel||'공동 3위',value:summary.thirds.length?summary.thirds.join(' · '):'-',bg:'linear-gradient(135deg,#fff1e8,#f6c59c)',border:'#a97142'}
      ];
      if(summary.fourth){ medalItems.push({emoji:'4️⃣',title:'4위',value:summary.fourth,bg:'linear-gradient(135deg,#f8fafc,#eef2f7)',border:'#cbd5e1'}); }
      html+=renderFinalSummaryCard(dl(d),medalItems);
    }else if(draw && gDS(t,d).format==='roundrobin'){
      const group=draw.groups?.[0];
      const stats=group?calcGS(key,0,group.teams,teams):[];
      html+=renderFinalSummaryCard(dl(d),[
        {emoji:'🥇',title:'1위',value:stats[0]?.nm||'-',bg:'linear-gradient(135deg,#fff8dd,#fde68a)',border:'#d4a017'},
        {emoji:'🥈',title:'2위',value:stats[1]?.nm||'-',bg:'linear-gradient(135deg,#f8fafc,#e5e7eb)',border:'#aab2c3'},
        {emoji:'🥉',title:'3위',value:stats[2]?.nm||'-',bg:'linear-gradient(135deg,#fff1e8,#f6c59c)',border:'#a97142'}
      ]);
    }else if(!draw){
      html+=`<div class="card"><p style="color:var(--text3);text-align:center;padding:12px">추첨 미진행</p></div>`;
      return;
    }else{
      html+=`<div class="card"><p style="color:var(--text3);text-align:center;padding:12px">최종 결과가 아직 확정되지 않았습니다</p></div>`;
    }

    if(draw && gDS(t,d).format==='roundrobin'){
      const group=draw.groups?.[0];
      const stats=group?calcGS(key,0,group.teams,teams):[];
      html+=`<div class="card"><div class="card-title">📋 최종 순위표</div><div class="table-wrap"><table><thead><tr><th>순위</th><th>팀</th><th>승</th><th>패</th><th>${isIndividualByKey(key)?'게임득실':'득실'}</th></tr></thead><tbody>${stats.map((s,r)=>`<tr><td>${s.rankLabel|| (typeof s.rank==='number'?`${s.rank}위`:`${r+1}`)}</td><td style="font-weight:800">${s.nm}</td><td style="color:var(--success);font-weight:700">${s.w}</td><td style="color:var(--danger)">${s.l}</td><td style="font-weight:700;color:${s.diff>0?'var(--success)':s.diff<0?'var(--danger)':'inherit'}">${s.diff>0?'+':''}${s.diff}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
  });
  cont.innerHTML=html||'<div class="empty-state card"><p>데이터 없음</p></div>';
  if(window.queueStablePageHeight) window.queueStablePageHeight();
}

function getAssociationSummary(){
  const clubSet = new Set();
  const playerSet = new Set();
  let teamCount = 0;
  let matchCount = 0;

  Object.values(G.teams||{}).forEach(arr=>{
    (arr||[]).forEach(team=>{
      teamCount++;
      const bc = baseClub(team?.club||'') || (team?.club||'');
      if(bc) clubSet.add(bc);
      (team?.players||[]).forEach(name=>{
        const clean = cleanName(name);
        if(clean) playerSet.add(`${normName(clean)}__${bc}`);
      });
    });
  });

  (HIST_DATA||[]).forEach(t=>{
    (t.teams||[]).forEach(team=>{
      teamCount++;
      const bc = baseClub(team?.club||'') || (team?.club||'');
      if(bc) clubSet.add(bc);
      (team?.players||[]).forEach(name=>{
        const clean = cleanName(name);
        if(clean) playerSet.add(`${normName(clean)}__${bc}`);
      });
    });
  });

  Object.values(G.matches||{}).forEach(arr=>{
    (arr||[]).forEach(m=>{
      if(m && m.winner!==null && !m.bye) matchCount++;
    });
  });

  Object.entries(G.players||{}).forEach(([k,p])=>{
    const pk = pKeyParse(k);
    const nm = cleanName(pk.name || p?.name || k);
    const bc = baseClub(pk.club || p?.club || '') || (pk.club || p?.club || '');
    if(nm) playerSet.add(`${normName(nm)}__${bc}`);
    (p?.clubs||[]).forEach(c=>{
      const b = baseClub(c)||c;
      if(b) clubSet.add(b);
    });
  });

  return {
    clubs: clubSet.size,
    teams: teamCount,
    matches: matchCount,
    players: playerSet.size
  };
}


// ══════════════════════════════════════════════════════
// 🏆 내 클럽 기능 (경기이사 로그인 시)
// ══════════════════════════════════════════════════════

let MY_CLUB_FILTER = false; // 내 클럽 필터 on/off 상태
Object.defineProperty(window,'MY_CLUB_FILTER',{get:()=>MY_CLUB_FILTER,set:(v)=>{MY_CLUB_FILTER=!!v;}});
const MY_CLUB_FILTER_STORAGE_KEY = 'kimhae_my_club_filter';
function loadMyClubFilterState(){
  try{ MY_CLUB_FILTER = localStorage.getItem(MY_CLUB_FILTER_STORAGE_KEY)==='1'; }
  catch(e){ MY_CLUB_FILTER=false; }
  return MY_CLUB_FILTER;
}
function persistMyClubFilterState(v){
  MY_CLUB_FILTER = !!v;
  try{
    if(MY_CLUB_FILTER) localStorage.setItem(MY_CLUB_FILTER_STORAGE_KEY,'1');
    else localStorage.removeItem(MY_CLUB_FILTER_STORAGE_KEY);
  }catch(e){}
  return MY_CLUB_FILTER;
}
function clearMyClubFilterState(){ return persistMyClubFilterState(false); }
loadMyClubFilterState();

// 로그인/로그아웃 시 내 클럽 UI 갱신
function updateMyClubUI(){
  const club = REG_CLUB;
  const isReg = REG && !AD && club;

  // 각 탭 버튼 표시/숨김
  const regBar = ge('myClubRegBar');
  const bracketBar = ge('myClubBracketBar');
  if(regBar) regBar.style.display = isReg ? 'block' : 'none';
  if(bracketBar) bracketBar.style.display = isReg ? 'block' : 'none';

  // 홈 카드 표시/숨김
  const homeCard = ge('myClubHomeCard');
  if(homeCard) homeCard.style.display = isReg ? 'block' : 'none';

  if(isReg){
    const titleEl = ge('myClubCardTitle');
    if(titleEl) titleEl.textContent = `🏆 ${club} 현황`;
    updateFilterBtnUI('register', MY_CLUB_FILTER);
    updateFilterBtnUI('bracket', MY_CLUB_FILTER);
    updateMyClubHomeCard();
    // 팀등록 탭: 내 클럽 자동 선택
    const regClubSel = ge('regClub');
    if(regClubSel && regClubSel.value !== club){
      // 옵션이 로드된 후 선택
      setTimeout(()=>{
        const regClubSel2 = ge('regClub');
        if(regClubSel2){
          const opt = [...regClubSel2.options].find(o=>o.value===club);
          if(opt){ regClubSel2.value=club; onRegClubChange(); }
        }
      }, 300);
    }
  } else {
    clearMyClubFilterState();
    updateFilterBtnUI('register', false);
    updateFilterBtnUI('bracket', false);
  }
}

// 홈 내 클럽 카드 내용 갱신
function updateMyClubHomeCard(){
  const club = REG_CLUB;
  const body = ge('myClubHomeBody');
  if(!body || !club) return;

  const at = G.tournaments.find(t=>t.status==='ongoing') ||
             G.tournaments.find(t=>t.status==='open') ||
             G.tournaments[0];
  if(!at){ body.innerHTML='<div style="color:var(--text3)">진행 중인 대회가 없습니다</div>'; return; }

  const bc = baseClub(club);
  let html = '';

  // 각 부서에서 내 클럽 팀 찾기
  const myTeams = [];
  (at.divisions||[]).forEach(div=>{
    const key = at.id+'_'+div;
    const teams = G.teams[key]||[];
    teams.forEach((team,idx)=>{
      if(baseClub(team.club||'')=== bc || team.club===club){
        myTeams.push({team, div, key, idx});
      }
    });
  });

  if(!myTeams.length){
    body.innerHTML = `<div>📋 <b>${at.name}</b>에 등록된 팀이 없습니다.</div>
      <button class="btn" style="margin-top:8px;font-size:.8rem;padding:5px 12px;background:#166534;color:white;border-radius:8px"
        onclick="showPage('register')">📝 팀 등록하러 가기</button>`;
    return;
  }

  // 등록 팀 정보
  html += `<div style="margin-bottom:6px">📋 <b>${at.name}</b></div>`;
  myTeams.forEach(({team, div, key, idx})=>{
    const allMs = G.matches[key]||[];
    // 내 팀 경기만
    const myMs = allMs.filter(m=>m && !m.bye && (m.t1===idx || m.t2===idx));
    const done = myMs.filter(m=>getMatchResultState(key,m).done).length;
    const total = myMs.length;
    const wins = myMs.filter(m=>{
      const st = getMatchResultState(key,m);
      return st.done && st.winner===idx;
    }).length;

    const nextM = myMs.find(m=>!getMatchResultState(key,m).done);
    let nextInfo = '';
    if(nextM){
      const tms = G.teams[key]||[];
      const st = getMatchResultState(key,nextM);
      const op = nextM.t1===idx ? (tms[nextM.t2]??tms.find(t=>t.id===nextM.t2)) : (tms[nextM.t1]??tms.find(t=>t.id===nextM.t1));
      const opNm = op ? (op.club||'?') : '?';
      const grpCourts = (G.draws[key]?.groups?.[Number(nextM.group)]?.courts)||[];
      const matchCourts = Array.isArray(nextM.courts)&&nextM.courts.length ? nextM.courts : (nextM.court?[nextM.court]:grpCourts);
      const courts = matchCourts.length ? ` 🎾${matchCourts.join('/')}` : '';
      const progress = st.started ? ` · 진행중 ${st.disp1??st.sc1}:${st.disp2??st.sc2}` : '';
      nextInfo = `<div style="font-size:.78rem;color:#1d4ed8;margin-top:3px;cursor:pointer" onclick="goBracketMatch('${at.id}','${div}','${nextM.id}')">⏭ 다음: vs <b>${opNm}</b>${courts}${progress}</div>`;
    }

    // 오더 상태
    let orderStatus = '';
    if(G.meta.onlineOrderEnabled && myMs.length>0){
      const orderSummary = myMs.filter(m=>!getMatchResultState(key,m).done).map(m=>{
        const ost = getOnlineOrderState(key,m);
        const mySide2 = ost.mySide;
        const myDone = mySide2===1 ? ost.s1 : mySide2===2 ? ost.s2 : false;
        const opDone = mySide2===1 ? ost.s2 : mySide2===2 ? ost.s1 : false;
        const tms=G.teams[key]||[];
        const opIdx=m.t1===idx?m.t2:m.t1;
        const opTeam=tms[opIdx];
        const opName=opTeam?tdn(opTeam,key,opIdx):'?';
        const _mid2 = m.id||'';
        const _clickStyle = "cursor:pointer;text-decoration:underline;text-underline-offset:2px";
        if(ost.bothSubmitted) return `<span onclick="goBracketMatch('${at.id}','${div}','${_mid2}')" style="font-size:.68rem;padding:2px 6px;border-radius:4px;background:#dcfce7;color:#166534;font-weight:700;cursor:pointer" title="경기로 이동">vs ${opName} 🔓공개</span>`;
        if(myDone) return `<span onclick="goBracketMatch('${at.id}','${div}','${_mid2}')" style="font-size:.68rem;padding:2px 6px;border-radius:4px;background:#fef3c7;color:#92400e;font-weight:700;cursor:pointer" title="경기로 이동">vs ${opName} ✅내오더제출·상대대기</span>`;
        return `<span onclick="goBracketMatch('${at.id}','${div}','${_mid2}')" style="font-size:.68rem;padding:2px 6px;border-radius:4px;background:#fee2e2;color:#991b1b;font-weight:700;cursor:pointer" title="경기로 이동">vs ${opName} ⏳오더미제출</span>`;
      });
      if(orderSummary.length>0){
        orderStatus=`<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px">${orderSummary.join('')}</div>`;
      }
    }
    html += `<div style="padding:6px 10px;background:white;border-radius:8px;margin-bottom:6px;border:1px solid #bbf7d0">
      <div style="font-weight:700;cursor:pointer;color:var(--primary)" onclick="goBracket('${at.id}','${div}')" title="${dl(div)} 대진표로 이동">⛳ ${dl(div)} — ${tdn(team,key,idx)} <span style="font-size:.68rem;color:var(--text3);font-weight:400">▶ 대진표</span></div>
      <div style="font-size:.8rem;color:#166534">🧍 ${(team.players||[]).length}명 등록${total>0?` · 🏅 ${wins}승 ${done-wins}패 (${done}/${total}경기)`:''}</div>
      ${orderStatus}
      ${nextInfo}
    </div>`;
  });

  html += `<div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
    <button class="btn" style="flex:1;min-width:120px;font-size:.78rem;padding:5px;background:#166534;color:white;border-radius:8px"
      onclick="showPage('register');toggleMyClubFilter('register',true)">📋 내 팀 보기</button>
    <button class="btn" style="flex:1;min-width:120px;font-size:.78rem;padding:5px;background:#ea580c;color:white;border-radius:8px"
      onclick="openMyClubQuickOrder()">📝 바로 오더쓰기</button>
    <button class="btn" style="flex:1;min-width:120px;font-size:.78rem;padding:5px;background:#1d4ed8;color:white;border-radius:8px"
      onclick="goMyClubBracket()">🎲 내 경기 보기</button>
  </div>`;

  body.innerHTML = html;
}

// 내 클럽 대진표로 이동
function goMyClubBracket(){
  const at = G.tournaments.find(t=>t.status==='ongoing') ||
             G.tournaments.find(t=>t.status==='open') || G.tournaments[0];
  if(!at) return;
  showPage('bracket');
  const brTS = ge('brTS');
  if(brTS){ brTS.value = at.id; onBrTC(); }
  setTimeout(()=>toggleMyClubFilter('bracket', true), 300);
}

function openMyClubQuickOrder(){
  const club = REG_CLUB;
  if(!REG || !club){
    toast('클럽 로그인 후 사용해 주세요','info');
    return;
  }
  const at = G.tournaments.find(t=>t.status==='ongoing') ||
             G.tournaments.find(t=>t.status==='open') || G.tournaments[0];
  if(!at){
    toast('진행 중인 대회가 없습니다','info');
    return;
  }
  const bc = baseClub(club);
  let target = null;

  for(const div of (at.divisions||[])){
    const key = at.id + '_' + div;
    const teams = G.teams[key] || [];
    const myIdxs = [];
    teams.forEach((team, idx)=>{
      if(baseClub(team.club||'')===bc || team.club===club) myIdxs.push(idx);
    });
    if(!myIdxs.length) continue;

    const matches = (G.matches[key]||[]).filter(m=>m && !m.bye);
    for(const idx of myIdxs){
      const next = matches.find(m => (m.t1===idx || m.t2===idx) && !getMatchResultState(key,m).done);
      if(next){
        target = { key, mid: next.id, tid: at.id, div };
        break;
      }
    }
    if(target) break;
  }

  if(!target){
    toast('오더를 입력할 다음 경기가 없습니다','info');
    return;
  }

  showPage('bracket');
  const brTS = ge('brTS');
  if(brTS){ brTS.value = at.id; onBrTC(); }
  setTimeout(()=>{
    try{ toggleMyClubFilter('bracket', true); }catch(e){}
    try{ openM3(target.key, target.mid); }catch(e){ toast('오더창을 여는 중 오류가 발생했습니다','error'); }
  }, 350);
}

function focusMatchCardElement(el){
  if(!el) return false;
  const header=document.querySelector('.app-header');
  const notice=ge('brFloatingNotice');
  const headerH=header?header.getBoundingClientRect().height:0;
  const noticeH=(notice && getComputedStyle(notice).display!=='none')?notice.getBoundingClientRect().height:0;
  const top=window.scrollY + el.getBoundingClientRect().top - headerH - noticeH - 24;
  window.scrollTo({top: Math.max(0, top), behavior:'smooth'});
  el.classList.remove('match-focus-pulse');
  void el.offsetWidth;
  el.classList.add('match-focus-pulse');
  setTimeout(()=>el.classList.remove('match-focus-pulse'), 2600);
  return true;
}

function goBracketMatch(tid,div,matchId){
  const matchKey = tid + '_' + div;
  const pageBracket = ge('page-bracket');
  if(!tid || !div || !matchId){
    showPage('bracket');
    return;
  }

  const matchList=(G.matches?.[matchKey]||[]);
  const targetMatch=matchList.find(m=>String(m?.id||m?._id||'')===String(matchId)) || null;
  const ensureTargetSectionOpen=()=>{
    try{
      if(targetMatch && String(targetMatch.phase||'')==='group'){
        window.BRACKET_PRELIM_TOGGLE = window.BRACKET_PRELIM_TOGGLE || {};
        window.BRACKET_PRELIM_TOGGLE[matchKey] = false;
        try{ setIndividualGroupMatchesOpen(matchKey, Number(targetMatch.group||0), true); }catch(e){}
      }
      if(targetMatch && (String(targetMatch.phase||'')==='main' || String(targetMatch.phase||'')==='playin' || String(targetMatch.phase||'')==='bronze')){
        window.BRACKET_MAIN_TOGGLE = window.BRACKET_MAIN_TOGGLE || {};
        window.BRACKET_MAIN_TOGGLE[matchKey] = false;
        try{
          const rk = `${matchKey}__${Number(targetMatch.round||0)}`;
          window.MAIN_STATUS_ROUND_TOGGLE = window.MAIN_STATUS_ROUND_TOGGLE || {};
          window.MAIN_STATUS_DONE_MATCH_TOGGLE = window.MAIN_STATUS_DONE_MATCH_TOGGLE || {};
          window.MAIN_STATUS_ROUND_TOGGLE[rk] = false;
          window.MAIN_STATUS_DONE_MATCH_TOGGLE[rk] = false;
        }catch(e){}
      }
    }catch(e){}
  };

  showPage('bracket');
  const brTS = ge('brTS');
  if(brTS) brTS.value = tid;
  if(typeof onBrTC === 'function') onBrTC();

  const applyAndFocus = ()=>{
    try{ setBracketSelectedDivs([div], tid); }catch(_e){}
    ensureTargetSectionOpen();
    try{ renderBracket(); }catch(_e){}

    let tries = 0;
    const finder = ()=>{
      ensureTargetSectionOpen();
      const scope = pageBracket || document;
      const exactId = getMatchCardDomId(matchKey, matchId);
      const safeId = (typeof CSS!=='undefined' && typeof CSS.escape==='function') ? CSS.escape(exactId) : exactId.replace(/([^a-zA-Z0-9_-])/g,'\$1');
      const exact = scope.querySelector(`#${safeId}`);
      const byData = scope.querySelector(`.m3card[data-match-id="${String(matchId).replace(/"/g,'\"')}"]`);
      const el = exact || byData;

      if(el){
        focusMatchCardElement(el);
        return;
      }

      tries++;
      if(tries < 36){
        try{ renderBracket(); }catch(_e){}
        setTimeout(finder, 180);
      }else{
        toast('해당 경기를 찾지 못했습니다. 선택된 부서를 확인해 주세요.','info');
      }
    };

    setTimeout(finder, 220);
  };

  requestAnimationFrame(()=>setTimeout(applyAndFocus, 260));
}

window.goBracketMatch = goBracketMatch;

// 내 클럽 필터 토글
function toggleMyClubFilter(tab, forceOn){
  const nextState = (forceOn !== undefined) ? !!forceOn : !MY_CLUB_FILTER;
  persistMyClubFilterState(nextState);
  updateFilterBtnUI('register', MY_CLUB_FILTER);
  updateFilterBtnUI('bracket', MY_CLUB_FILTER);
  if(tab==='bracket') renderBracket();
  if(tab==='register') renderRL();
}

function canEditMatchByDirector(key,m){
  if(AD || OP || isPublicResultEntryEnabled()) return true;
  if(!REG || !REG_CLUB || !m) return false;
  const teams=G.teams[key]||[];
  const t1=teams[m.t1]??teams.find(t=>t.id===m.t1||t.name===m.t1);
  const t2=teams[m.t2]??teams.find(t=>t.id===m.t2||t.name===m.t2);
  const bc=baseClub(REG_CLUB||'');
  return !!(bc && ((t1 && baseClub(t1.club||'')===bc) || (t2 && baseClub(t2.club||'')===bc)));
}


function getMatchTeamObjects(key,m){
  const teams=G.teams[key]||[];
  const t1=teams[m?.t1]??teams.find(t=>t&&((t.id!=null&&t.id===m?.t1)||(t.name&&t.name===m?.t1)));
  const t2=teams[m?.t2]??teams.find(t=>t&&((t.id!=null&&t.id===m?.t2)||(t.name&&t.name===m?.t2)));
  return {t1,t2};
}

function getMatchBaseClubs(key,m){
  const {t1,t2}=getMatchTeamObjects(key,m);
  return {c1:baseClub(t1?.club||'')||(t1?.club||''), c2:baseClub(t2?.club||'')||(t2?.club||'')};
}

function getDirectorMatchSide(key,m){
  if(AD) return 0;
  if(!(REG&&REG_CLUB&&m)) return 0;
  const myBase=baseClub(REG_CLUB)||REG_CLUB;
  const {c1,c2}=getMatchBaseClubs(key,m);
  if(c1===myBase) return 1;
  if(c2===myBase) return 2;
  return 0;
}

function getOrderSubmissions(match){
  return (match&&typeof match.orderSubmissions==='object'&&match.orderSubmissions)?match.orderSubmissions:{};
}

function getIndividualResultAuthState(key,m){
  try{
    if(!isIndividualByKey(key) || !m) return {allowed:false, reason:'not_individual'};
    if(AD || OP || canEditMatchByDirector(key,m)) return {allowed:true, reason:'staff'};
    const teams=G.teams[key]||[];
    const t1=teams[m.t1]??teams.find(t=>t&&((t.id!=null&&t.id===m.t1)||(t.name&&t.name===m.t1)));
    const t2=teams[m.t2]??teams.find(t=>t&&((t.id!=null&&t.id===m.t2)||(t.name&&t.name===m.t2)));
    const pw1=String(t1?.editPin||'').replace(/\D/g,'');
    const pw2=String(t2?.editPin||'').replace(/\D/g,'');
    return {allowed:!!(pw1||pw2), reason:(pw1||pw2)?'pin':'no_pin', team1:t1, team2:t2, pw1, pw2};
  }catch(e){ return {allowed:false, reason:'error'}; }
}
function getIndividualActualScoreText(m){
  try{
    const rbs=Array.isArray(m?.rubbers)?m.rubbers:[];
    const rb=rbs.find(rb=>rb && rb.score1!=null && rb.score2!=null);
    if(!rb) return '';
    return `${rb.score1}:${rb.score2}`;
  }catch(e){ return ''; }
}
function getIndividualWinnerSideByScoreText(scoreText){
  try{
    const m=String(scoreText||'').match(/^(\d+)\s*:\s*(\d+)$/);
    if(!m) return 0;
    const s1=parseInt(m[1],10), s2=parseInt(m[2],10);
    if(Number.isNaN(s1)||Number.isNaN(s2)||s1===s2) return 0;
    return s1>s2?1:2;
  }catch(e){ return 0; }
}

function getOnlineOrderState(key,m){
  const {c1,c2}=getMatchBaseClubs(key,m);
  const subs=getOrderSubmissions(m);
  const s1=!!(c1&&subs[c1]);
  const s2=!!(c2&&subs[c2]);
  const mySide=getDirectorMatchSide(key,m);
  const myBase=mySide===1?c1:(mySide===2?c2:'');
  const mySubmitted=!!(myBase&&subs[myBase]);
  return {c1,c2,subs,s1,s2,bothSubmitted:s1&&s2,mySide,myBase,mySubmitted};
}

function getSubmittedPlayersForSide(key,m,side,r){
  const st=getOnlineOrderState(key,m);
  const base=side===1?st.c1:st.c2;
  const row=((st.subs[base]||{}).rubbers||[])[r]||{};
  return Array.isArray(row.players)?row.players:[];
}

function syncRevealedOrderIntoMatchRubbers(key,m){
  const st=getOnlineOrderState(key,m);
  if(!st.bothSubmitted) return;
  const rubbers=Array.isArray(m.rubbers)?m.rubbers:[];
  const r1=((st.subs[st.c1]||{}).rubbers)||[];
  const r2=((st.subs[st.c2]||{}).rubbers)||[];
  const maxLen=Math.max(rubbers.length,r1.length,r2.length);
  for(let i=0;i<maxLen;i++){
    if(!rubbers[i]) rubbers[i]={};
    const row1=r1[i]||{};
    const row2=r2[i]||{};
    if(Array.isArray(row1.players)&&row1.players.length===2) rubbers[i].players1=[...row1.players];
    else if(row1.blankOrder){ rubbers[i].players1=[]; }
    if(Array.isArray(row2.players)&&row2.players.length===2) rubbers[i].players2=[...row2.players];
    else if(row2.blankOrder){ rubbers[i].players2=[]; }
    if(row1.blankOrder) rubbers[i].blankOrder1=true; else delete rubbers[i].blankOrder1;
    if(row2.blankOrder) rubbers[i].blankOrder2=true; else delete rubbers[i].blankOrder2;
    applyBlankOrderAutoScore(rubbers[i]);
  }
  m.rubbers=rubbers;
  m.orderRevealed=true;
  if(!m.orderRevealedAt) m.orderRevealedAt=new Date().toISOString();
}

function applyBlankOrderAutoScore(rb){
  if(!rb || typeof rb!=='object') return rb;
  const b1=!!rb.blankOrder1, b2=!!rb.blankOrder2;
  if(b1 && !b2){
    rb.score1=0;
    rb.score2=6;
    rb.winner=1;
    rb.tiebreak=false;
  }else if(!b1 && b2){
    rb.score1=6;
    rb.score2=0;
    rb.winner=0;
    rb.tiebreak=false;
  }else if(b1 && b2){
    rb.score1=null;
    rb.score2=null;
    rb.winner=null;
    rb.tiebreak=false;
  }
  return rb;
}

function isOnlineOrderLocked(match,key=''){
  if(!(match&&G.meta.onlineOrderEnabled)) return false;
  if(!key) return !!(match.orderSubmitted || (match.orderSubmissions&&Object.keys(match.orderSubmissions).length));
  const st=getOnlineOrderState(key,match);
  return !!(st.s1||st.s2);
}

function getOnlineOrderStatusLabel(key,m){
  if(!G.meta.onlineOrderEnabled) return '';
  const st=getOnlineOrderState(key,m);
  if(st.bothSubmitted) return '공개됨';
  if(st.s1||st.s2) return '제출완료';
  return '미제출';
}

function getOnlineOrderStatusBadgeHTML(key,m){
  if(!G.meta.onlineOrderEnabled) return '';
  const st=getOnlineOrderState(key,m);
  if(st.bothSubmitted) return `<span class="badge bg-green" style="font-size:.76rem;padding:3px 9px">🔓 오더공개</span>`;
  if(st.s1||st.s2) return `<span class="badge bg-gold" style="font-size:.76rem;padding:3px 9px">📝 제출완료</span>`;
  return `<span class="badge bg-gray" style="font-size:.76rem;padding:3px 9px">⏳ 미제출</span>`;
}

function getOnlineOrderTeamStatusHTML(key,m){
  if(!G.meta.onlineOrderEnabled) return '';
  const st=getOnlineOrderState(key,m);
  const {t1,t2}=getMatchTeamObjects(key,m);
  const dn1=t1?tdn(t1,key,m.t1):'팀1';
  const dn2=t2?tdn(t2,key,m.t2):'팀2';
  const chip=(name,submitted)=>`<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:.73rem;font-weight:800;border:1.5px solid ${submitted?'#16a34a':'#cbd5e1'};background:${submitted?'#ecfdf5':'#f8fafc'};color:${submitted?'#166534':'#475569'}">${name} · ${submitted?'제출완료':'미제출'}</span>`;
  const pub=st.bothSubmitted?`<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:.73rem;font-weight:800;border:1.5px solid #16a34a;background:#dcfce7;color:#166534">🔓 공개됨</span>`:'';
  return `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;margin-top:4px">${chip(dn1,st.s1)}${chip(dn2,st.s2)}${pub}</div>`;
}

function getMyClubOrderStatusSummaryHTML(key,m,myBaseClub=''){
  if(!G.meta.onlineOrderEnabled) return '';
  const st=getOnlineOrderState(key,m);
  const myBase=baseClub(myBaseClub||REG_CLUB||'')||(myBaseClub||REG_CLUB||'');
  const isSide1=!!(myBase && st.c1===myBase);
  const isSide2=!!(myBase && st.c2===myBase);
  const mySubmitted=isSide1?st.s1:isSide2?st.s2:false;
  const oppSubmitted=isSide1?st.s2:isSide2?st.s1:(st.s1||st.s2);
  const myLabel=isSide1?'내팀 오더':isSide2?'내팀 오더':'오더';
  const oppLabel=isSide1?'상대팀 오더':isSide2?'상대팀 오더':'상대 오더';
  const chip=(label,submitted,accent)=>`<span class="my-match-summary-chip" style="border:1.5px solid ${submitted?(accent||'#16a34a'):'#cbd5e1'};background:${submitted?'#ecfdf5':'#f8fafc'};color:${submitted?'#166534':'#475569'}">${label} · ${submitted?'제출완료':'미제출'}</span>`;
  const pub=st.bothSubmitted?`<span class="my-match-summary-pub" style="border:1.5px solid #16a34a;background:#dcfce7;color:#166534">🔓 양팀 공개</span>`:'';
  return `<div class="my-match-summary-wrap">${chip(myLabel,mySubmitted,'#2563eb')}${chip(oppLabel,oppSubmitted,'#16a34a')}${pub}</div>`;
}

function getMySavedOrderDraftInfo(key,m,myBaseClub=''){
  const myBase=baseClub(myBaseClub||REG_CLUB||'')||(myBaseClub||REG_CLUB||'');
  if(!myBase || !m) return {hasDraft:false, side:0, count:0, submitted:false};
  const st=getOnlineOrderState(key,m);
  const side=st.c1===myBase?1:(st.c2===myBase?2:0);
  if(!side) return {hasDraft:false, side:0, count:0, submitted:false};
  const submitted=side===1?st.s1:st.s2;
  const rows=Array.isArray(m.rubbers)?m.rubbers:[];
  let count=0;
  rows.forEach(rb=>{
    if(!rb || typeof rb!=='object') return;
    const players=side===1?(Array.isArray(rb.players1)?rb.players1:[]):(Array.isArray(rb.players2)?rb.players2:[]);
    const blank=side===1?!!rb.blankOrder1:!!rb.blankOrder2;
    if(blank || players.length===2) count++;
  });
  return {hasDraft:count>0, side, count, submitted};
}

function getMyClubOrderDraftBadgeHTML(key,m,myBaseClub=''){
  const info=getMySavedOrderDraftInfo(key,m,myBaseClub);
  if(!info.hasDraft) return '';
  return `<div class="my-match-summary-wrap" style="margin-top:6px;justify-content:flex-start"><span class="my-match-summary-chip" style="border:1.5px solid ${info.submitted?'#16a34a':'#ea580c'};background:${info.submitted?'#ecfdf5':'#fff7ed'};color:${info.submitted?'#166534':'#9a3412'}">${info.submitted?'✅ 제출된 오더 있음':'💾 임시저장 오더 있음'} · ${info.count}개 복식</span></div>`;
}

function openMyMatchOrderFromCard(tid,div,mid){
  const key=tid+'_'+div;
  showPage('bracket');
  const brTS=ge('brTS');
  if(brTS){ brTS.value=tid; onBrTC(); }
  setTimeout(()=>{
    try{ toggleMyClubFilter('bracket', true); }catch(e){}
    try{ openM3(key, mid); }catch(e){ toast('오더창을 여는 중 오류가 발생했습니다','error'); }
  }, 260);
}

function collectSavedOrderPayloadForSide(key,m,side){
  const st=getOnlineOrderState(key,m);
  const base=side===1?st.c1:st.c2;
  if(!base) return null;
  const rows=Array.isArray(m.rubbers)?m.rubbers:[];
  const rubbers=[];
  for(let r=0;r<rows.length;r++){
    const rb=rows[r]||{};
    const players=side===1?(Array.isArray(rb.players1)?[...rb.players1]:[]):(Array.isArray(rb.players2)?[...rb.players2]:[]);
    const blank=side===1?!!rb.blankOrder1:!!rb.blankOrder2;
    rubbers.push({players:blank?[]:players, blankOrder:blank || players.length===0});
  }
  const hasDraft=rubbers.some(rb=>rb.blankOrder || (rb.players||[]).length===2);
  if(!hasDraft) return null;
  return {side, base, rubbers, club: side===1 ? (getMatchTeamObjects(key,m).t1?.club||base) : (getMatchTeamObjects(key,m).t2?.club||base)};
}

async function submitSavedOrderFromCard(tid,div,mid){
  const key=tid+'_'+div;
  const list=G.matches[key]||[];
  const m=list.find(x=>x.id===mid);
  if(!m){ toast('경기 정보를 찾을 수 없습니다','error'); return; }
  if(!G.meta.onlineOrderEnabled){ toast('온라인 오더 제출 기능이 꺼져 있습니다','info'); return; }
  if(!(REG && REG_CLUB) && !AD && !OP){ toast('클럽 로그인 후 사용해 주세요','info'); return; }
  if(!(AD || OP || canEditMatchByDirector(key,m))){ toast('해당 경기 참가 클럽만 제출할 수 있습니다','error'); return; }
  const info=getMySavedOrderDraftInfo(key,m,REG_CLUB||'');
  if(!info.hasDraft){ toast('먼저 오더쓰기에서 임시저장해 주세요','info'); return; }
  if(info.submitted){ toast('이미 제출완료 상태입니다','info'); return; }
  const payload=collectSavedOrderPayloadForSide(key,m,info.side);
  if(!payload){ toast('임시저장된 오더를 찾을 수 없습니다','error'); return; }
  const blankOrders=[];
  (payload.rubbers||[]).forEach((rb,idx)=>{ if(rb.blankOrder || !(rb.players||[]).length) blankOrders.push(idx+1); });
  if(blankOrders.length){
    const label=[...new Set(blankOrders)].sort((a,b)=>a-b).map(n=>`${n}복식`).join(', ');
    if(!confirm(`${label}은 공오더로 제출됩니다.
임시저장된 오더를 바로 제출하시겠습니까?`)) return;
  }else{
    if(!confirm('임시저장된 오더를 바로 제출하시겠습니까?')) return;
  }
  if(!m.orderSubmissions||typeof m.orderSubmissions!=='object') m.orderSubmissions={};
  const nowIso=new Date().toISOString();
  m.orderSubmissions[payload.base]={ club:payload.club||payload.base, side:payload.side, submittedAt:nowIso, rubbers:payload.rubbers };
  m.orderSubmitted=true;
  m.orderSubmittedAt=nowIso;
  m.orderSubmittedBy=REG_CLUB||'경기이사';
  syncRevealedOrderIntoMatchRubbers(key,m);
  sl(true);
  try{
    await stM(key);
    sl(false);
    toast(getOnlineOrderState(key,m).bothSubmitted ? '양팀 제출 완료 — 오더 자동 공개 ✅' : '임시저장 오더 제출 완료 ✅','success');
    renderBracket();
    if(REG&&REG_CLUB&&!AD) updateMyClubHomeCard();
  }catch(e){ sl(false); toast('제출 실패: '+e.message,'error'); }
}

function collectSideOrderFromModal(key, mid, side){
  const list=G.matches[key]||[]; const m=list.find(x=>x.id===mid); if(!m) return null;
  if(!(side===1||side===2)) return null;
  const st=getOnlineOrderState(key,m);
  const base=side===1?st.c1:st.c2;
  if(!base) return null;
  const [tid,div]=key.split('_');
  const tObj=G.tournaments.find(t=>t.id===tid);
  const cfg=gDS(tObj,div);
  const {t1}=getMatchTeamObjects(key,m);
  const dbl=cfg.doublesCount||((t1&&t1.doublesCount)||5);
  const rubbers=[];
  for(let r=0;r<dbl;r++){
    const cid=side===1?`rp1_${r}`:`rp2_${r}`;
    const cont=ge(cid);
    const players=getPickerSelected(cid);
    const isGhost = players[0]==='__GHOST__';
    rubbers.push({players:isGhost?[]:players,blankOrder:isGhost||players.length===0});
  }
  return {side,base,rubbers};
}


async function saveOnlineOrderSettings(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const chk=ge('onlineOrderEnabled');
  G.meta.onlineOrderEnabled=!!chk?.checked;
  try{
    await saveMeta();
    toast('온라인 오더 설정 저장 완료 ✅','success');
    renderBracket();
  }catch(e){ toast('저장 실패: '+e.message,'error'); }
}

function collectMyOnlineOrderFromModal(key, mid){
  const list=G.matches[key]||[]; const m=list.find(x=>x.id===mid); if(!m) return null;
  const mySide=getDirectorMatchSide(key,m);
  if(!mySide) return null;
  const st=getOnlineOrderState(key,m);
  const rubbers=[];
  const {t1}=getMatchTeamObjects(key,m);
  const [tid,div]=key.split('_');
  const tObj=G.tournaments.find(t=>t.id===tid);
  const cfg=gDS(tObj,div);
  const dbl=cfg.doublesCount||((t1&&t1.doublesCount)||5);
  for(let r=0;r<dbl;r++){
    const cid=mySide===1?`rp1_${r}`:`rp2_${r}`;
    const cont=ge(cid);
    const players=getPickerSelected(cid);
    const isGhost = players[0]==='__GHOST__';
    rubbers.push({players:isGhost?[]:players,blankOrder:isGhost||players.length===0});
  }
  return {mySide,myBase:st.myBase,rubbers};
}

// ── 관리자 한 팀 제출 확인 ──
function confirmSubmitOrderForSide(side){
  const key=CM_key, mid=CM_id; if(!key||!mid) return;
  const m=(G.matches[key]||[]).find(x=>x.id===mid); if(!m) return;
  if(!(AD||OP)){
    toast('관리자 또는 진행자만 사용할 수 있습니다','error');
    return;
  }
  const teams=G.teams[key]||[];
  const teamObj=side===1?teams[m.t1]:teams[m.t2];
  const teamName=teamObj?tdn(teamObj,key,side===1?m.t1:m.t2):(side===1?'홈팀':'원정팀');
  const payload=collectSideOrderFromModal(key,mid,side);
  if(!payload){ toast('오더 정보를 읽을 수 없습니다','error'); return; }
  const blankOrders=getBlankRubberNumbers([payload]);
  if(blankOrders.length){
    const label=getBlankRubberLabel(blankOrders);
    if(!confirm(`${teamName}의 ${label}에 선수 이름이 입력되지 않았습니다.
해당 조 공오더 제출 하시겠습니까?`)) return;
  }
  const st=getOnlineOrderState(key,m);
  const already=(side===1?st.s1:st.s2);
  const actor=AD?'관리자':'진행자';
  const msg=already
    ? `${actor} 권한으로 ${teamName} 오더만 다시 제출하시겠습니까?
현재 모달에 선택된 ${teamName} 오더만 제출 상태로 다시 저장됩니다.`
    : `${actor} 권한으로 ${teamName} 오더만 제출하시겠습니까?
상대팀은 그대로 두고 ${teamName}만 제출 상태로 저장됩니다.`;
  if(!confirm(msg)) return;
  submitOnlineOrder(side);
}

// ── 오더 제출 확인 팝업 ──
function confirmSubmitOrder(){
  const key=CM_key, mid=CM_id; if(!key||!mid) return;
  const m=(G.matches[key]||[]).find(x=>x.id===mid); if(!m) return;
  const st=getOnlineOrderState(key,m);

  const payloads=[];
  if(AD){
    const p1=collectSideOrderFromModal(key,mid,1);
    const p2=collectSideOrderFromModal(key,mid,2);
    if(p1) payloads.push(p1);
    if(p2) payloads.push(p2);
  }else if(OP){
    if(!st.s1){ const p1=collectSideOrderFromModal(key,mid,1); if(p1) payloads.push(p1); }
    if(!st.s2){ const p2=collectSideOrderFromModal(key,mid,2); if(p2) payloads.push(p2); }
  }else{
    const payload=collectMyOnlineOrderFromModal(key,mid);
    if(payload) payloads.push({side:payload.mySide,base:payload.myBase,rubbers:payload.rubbers});
  }

  const uniqBlankOrders=getBlankRubberNumbers(payloads);
  if(uniqBlankOrders.length){
    const label=getBlankRubberLabel(uniqBlankOrders);
    if(!confirm(`${label}에 선수 이름이 입력되지 않았습니다.
해당 조 공오더 제출 하시겠습니까?`)) return;
  }

  let msg='';
  if(AD){
    msg=st.bothSubmitted
      ? `관리자 권한으로 양팀 오더를 다시 제출하시겠습니까?
현재 모달에 선택된 양쪽 오더가 제출 상태로 저장됩니다.`
      : `관리자 권한으로 양팀 오더를 제출하시겠습니까?
현재 모달에 선택된 양쪽 오더가 모두 제출된 상태로 저장됩니다.`;
  }else if(OP){
    const pending=[];
    if(!st.s1) pending.push('홈팀');
    if(!st.s2) pending.push('원정팀');
    msg=`경기진행자 권한으로 ${pending.join(' + ')} 오더를 대신 제출하시겠습니까?
이미 제출된 팀의 오더는 건드리지 않고, 아직 미제출인 팀만 제출 처리됩니다.`;
  }else{
    const isResubmit=st.mySubmitted && !st.bothSubmitted;
    msg=isResubmit
      ? `오더를 수정제출하시겠습니까?
이번 내용으로 내 클럽 오더가 다시 저장됩니다.
상대 클럽이 아직 미제출이면 다시 수정제출할 수 있습니다.`
      : `오더를 제출하시겠습니까?
제출하면 현재 선택한 내 클럽 오더가 저장됩니다.
양팀이 모두 제출 완료되면 자동 공개되고 이후에는 수정할 수 없습니다.`;
  }
  if(!confirm(msg)) return;
  submitOnlineOrder();
}

// ── 오더 초기화 확인 팝업 (관리자/진행자) ──
function confirmUnlockOrder(){
  if(!(AD||OP)){ toast('관리자 또는 진행자만 초기화할 수 있습니다','error'); return; }
  if(!confirm(`이 경기의 오더 제출 상태를 초기화하시겠습니까?
양쪽 클럽의 제출 내용이 모두 삭제되고, 대진표 명단도 원래 상태로 돌아갑니다.`)) return;
  unlockOnlineOrder(CM_key, CM_id);
}

async function submitOnlineOrder(sideOnly=null){
  const key=CM_key, mid=CM_id; if(!key||!mid) return;
  const list=G.matches[key]||[]; const idx=list.findIndex(x=>x.id===mid); if(idx<0) return;
  const m=list[idx];
  const orderSubmitSnapshot=cloneOrderState(m);
  if(!G.meta.onlineOrderEnabled){ toast('온라인 오더 제출 기능이 비활성화되어 있습니다','info'); return; }
  if(!(AD || canEditMatchByDirector(key,m))){ toast('해당 경기 참가 클럽의 경기이사·경기진행자·관리자만 제출할 수 있습니다','error'); return; }
  const st=getOnlineOrderState(key,m);
  if(st.bothSubmitted && !AD){ toast('양쪽 오더가 이미 공개되었습니다. 오더 수정은 관리자 초기화 후 가능합니다','info'); return; }
  if(!m.orderSubmissions||typeof m.orderSubmissions!=='object') m.orderSubmissions={};

  const payloads=[];
  if(AD){
    if(sideOnly===1 || sideOnly===2){
      const p=collectSideOrderFromModal(key,mid,sideOnly);
      if(!p){ toast('선택한 팀 오더 정보를 읽을 수 없습니다','error'); return; }
      payloads.push(p);
    }else{
      const p1=collectSideOrderFromModal(key,mid,1);
      const p2=collectSideOrderFromModal(key,mid,2);
      if(!p1||!p2){ toast('양팀 오더 정보를 읽을 수 없습니다','error'); return; }
      payloads.push(p1,p2);
    }
  }else if(OP){
    if(sideOnly===1 || sideOnly===2){
      const alreadySubmitted = sideOnly===1 ? st.s1 : st.s2;
      if(alreadySubmitted){
        toast('해당 팀은 이미 제출 완료 상태입니다','info');
        return;
      }
      const p=collectSideOrderFromModal(key,mid,sideOnly);
      if(!p){ toast(sideOnly===1?'홈팀 오더 정보를 읽을 수 없습니다':'원정팀 오더 정보를 읽을 수 없습니다','error'); return; }
      const sideTeam = sideOnly===1 ? getMatchTeamObjects(key,m).t1 : getMatchTeamObjects(key,m).t2;
      payloads.push({...p, club:sideTeam?.club||p.base, proxy:true});
    }else{
      if(!st.s1){ const p1=collectSideOrderFromModal(key,mid,1); if(!p1){ toast('홈팀 오더 정보를 읽을 수 없습니다','error'); return; } payloads.push({...p1, club:getMatchTeamObjects(key,m).t1?.club||p1.base, proxy:true}); }
      if(!st.s2){ const p2=collectSideOrderFromModal(key,mid,2); if(!p2){ toast('원정팀 오더 정보를 읽을 수 없습니다','error'); return; } payloads.push({...p2, club:getMatchTeamObjects(key,m).t2?.club||p2.base, proxy:true}); }
      if(!payloads.length){ toast('이미 양팀 모두 제출 완료 상태입니다','info'); return; }
    }
  }else{
    const payload=collectMyOnlineOrderFromModal(key,mid); if(!payload) return;
    payloads.push({side:payload.mySide,base:payload.myBase,rubbers:payload.rubbers,club:REG_CLUB||payload.myBase});
  }

  const validation=validateOrderRubbers(payloads,{admin:!!AD});
  if(!validation.ok){
    toast(validation.message,'error');
    return;
  }

  const normalizedPayloads=normalizeOrderPayloadsForSave(payloads);
  const nowIso=new Date().toISOString();
  applyOrderSubmissions(m,normalizedPayloads,{
    nowIso,
    submittedBy:AD?'관리자':(OP?'경기진행자':(REG_CLUB||'경기이사'))
  });
  syncRevealedOrderIntoMatchRubbers(key,m);
  await commitOrderSubmission({
    key,
    match:m,
    matchSnapshot:orderSubmitSnapshot,
    persistMatch:persistSingleMatchDoc,
    setLoading:sl,
    afterPersist:async()=>{ saveLastOrderFromPicker(key,m); },
    getSuccessMessage:()=>{
      const st2=getOnlineOrderState(key,m);
      const submittedOneSide = AD && (sideOnly===1 || sideOnly===2);
      const submittedTeamName = submittedOneSide
        ? ((sideOnly===1?getMatchTeamObjects(key,m).t1:getMatchTeamObjects(key,m).t2)?.club || (sideOnly===1?st.c1:st.c2) || '선택 팀')
        : '';
      return buildSubmitSuccessMessage({
        bothSubmitted:st2.bothSubmitted,
        submittedOneSide,
        submittedTeamName,
        operator:!!OP
      });
    },
    closeModal:()=>cm('mM3'),
    notify:toast,
    render:renderBracket,
    failurePrefix:'저장 실패: '
  });
}

function resetMatchOrderSelections(match){
  return resetMatchOrderResultState(match,{nowIso:new Date().toISOString()});
}

async function rollbackSingleMatchPlayerStats(key,m){
  if(!m || m.winner==null || m.bye) return;
  const teams=G.teams[key]||[];
  const wt=teams[m.winner], lt=teams[m.winner===m.t1?m.t2:m.t1];
  const touched=new Set();
  const takeBack=(team,field)=>{
    (team?.players||[]).forEach(n=>{
      const k=getPlayerKey(n,baseClub(team?.club||''));
      if(G.players[k]){
        G.players[k][field]=Math.max(0,(G.players[k][field]||0)-1);
        touched.add(k);
      }
    });
  };
  takeBack(wt,'wins');
  takeBack(lt,'losses');
  if(touched.size) await Promise.all([...touched].map(k=>stP(k)));
}

async function unlockOnlineOrder(key,mid){
  if(!(AD||OP)){ toast('관리자 또는 진행자만 해제할 수 있습니다','error'); return; }
  const list=G.matches[key]||[]; const idx=list.findIndex(x=>x.id===mid); if(idx<0) return;
  const target=list[idx];
  const orderResetMatchListSnapshot=cloneOrderState(list);
  const orderResetDrawSnapshot=G.draws[key] ? cloneOrderState(G.draws[key]) : null;
  const hadWinner=target.winner!=null;
  const resetPlayerKeys=hadWinner ? (()=>{
    const teams=G.teams[key]||[];
    const wt=teams[target.winner];
    const lt=teams[target.winner===target.t1?target.t2:target.t1];
    return [...new Set([
      ...((wt?.players)||[]).map(n=>getPlayerKey(n,baseClub(wt?.club||''))),
      ...((lt?.players)||[]).map(n=>getPlayerKey(n,baseClub(lt?.club||'')))
    ].filter(Boolean))];
  })() : [];
  const orderResetPlayerSnapshot=createOrderResetPlayerSnapshot(G.players,resetPlayerKeys);
  const orderResetPrelimToggleSnapshot=snapshotBooleanMapEntry(window.BRACKET_PRELIM_TOGGLE,key);

  clearOnlineOrderSubmissionState(target);
  if(hadWinner) await rollbackSingleMatchPlayerStats(key,target);
  resetMatchOrderSelections(target);

  if(target.phase==='group'){
    const curDraw=G.draws[key]||{};
    const nonMainMatches=(G.matches[key]||[]).filter(m=>m.phase!=='main');
    G.matches[key]=nonMainMatches;
    if(G.draws[key]){
      delete curDraw.mainPlan;
      delete curDraw.mainAudit;
      delete curDraw.mainUpdatedAt;
      G.draws[key]=curDraw;
    }
    if(window.BRACKET_PRELIM_TOGGLE && Object.prototype.hasOwnProperty.call(window.BRACKET_PRELIM_TOGGLE,key)){
      window.BRACKET_PRELIM_TOGGLE[key]=false;
    }
  }

  const resetTargetPhase=target.phase;
  await commitOrderReset({
    matchList:G.matches[key],
    matchListSnapshot:orderResetMatchListSnapshot,
    drawsStore:G.draws,
    drawKey:key,
    drawSnapshot:orderResetDrawSnapshot,
    playersStore:G.players,
    playerSnapshot:orderResetPlayerSnapshot,
    persistRestoredPlayers:(keys)=>Promise.all((keys||[]).map(k=>stP(k))),
    prelimToggleStore:window.BRACKET_PRELIM_TOGGLE,
    prelimToggleKey:key,
    prelimToggleSnapshot:orderResetPrelimToggleSnapshot,
    saveMatches:()=>stM(key),
    saveDraw:()=>stD(key),
    hasDraw:!!G.draws[key],
    setLoading:sl,
    afterSuccess:()=>cm('mM3'),
    notify:toast,
    successMessage:buildUnlockSuccessMessage({phase:resetTargetPhase}),
    render:renderBracket,
    renderPlayers:renderAllP,
    updateClubHome:()=>{ if(REG&&REG_CLUB&&!AD) updateMyClubHomeCard(); },
    failurePrefix:'해제 실패: '
  });
}

// 필터 버튼 UI 업데이트
function updateFilterBtnUI(tab, isOn){
  const btnText = ge(tab==='bracket' ? 'myClubBracketBtnText' : 'myClubRegBtnText');
  const btn = ge(tab==='bracket' ? 'myClubBracketBtn' : 'myClubRegBtn');
  const label = tab==='bracket' ? '내 클럽 경기만 보기' : '내 클럽 팀만 보기';
  if(btnText) btnText.textContent = isOn ? `✅ ${label} (ON)` : label;
  if(btn){
    btn.style.background = isOn ? '#166534' : '#f0fdf4';
    btn.style.color = isOn ? 'white' : '#166534';
  }
}


function upLog(){ return; }


function upDash(){
  // ── 홈 현황판 4개: 2026년 협회 전체 기준 ──────────────────
  const reg2026 = (G_REGISTRY&&G_REGISTRY[2026]) || [];
  const assocClubs = new Set(reg2026.map(m=>m.club).filter(Boolean));
  const assocPlayers = reg2026.length;

  // 등록 팀수: G.teams 전체 (현재까지 등록된 모든 팀)
  let assocTeams = 0;
  Object.values(G.teams||{}).forEach(arr=>{ assocTeams += (arr||[]).length; });
  const totalCourts = getTotalCourtCount();

  ge('sClubs').textContent = assocClubs.size || 0;
  ge('sTeams').textContent = totalCourts;
  ge('sMatches').textContent = reg2026.length;
  ge('sPlayers').textContent = assocPlayers;
  ge('regBadge').textContent = assocTeams;
  const assocCard=ge('homeAssocCard'); if(assocCard) assocCard.style.display = G.meta.showAssociationDashboard ? '' : 'none';

  // ── 현재 대회 섹션 ──────────────────────────────────────────
  const activeHomeTours = getHomeVisibleTournaments();
  const at = activeHomeTours[0] || null;
  if(at){
    const currentTeams=(at.divisions||[]).flatMap(d=>G.teams[at.id+'_'+d]||[]);
    const currentClubSet=new Set();
    const currentPlayerSet=new Set();
    let currentMatchCount=0;

    currentTeams.forEach(team=>{
      const bc=baseClub(team?.club||'') || (team?.club||'');
      if(bc) currentClubSet.add(bc);
      (team?.players||[]).forEach(name=>{
        const clean=cleanName(name);
        if(clean) currentPlayerSet.add(clean+'__'+bc);
      });
    });

    (at.divisions||[]).forEach(d=>{
      (G.matches[at.id+'_'+d]||[]).forEach(m=>{
        if(m && getMatchResultState(at.id+'_'+d,m).done && !m.bye) currentMatchCount++;
      });
    });

    const slbl={open:'접수중',closed:'접수마감',ongoing:'진행중',finished:'종료'};
    ge('heroTitle').textContent=at.name;
    ge('heroStatus').textContent='📌 '+slbl[at.status];
    ge('heroClubs').innerHTML=`🏟 참가 <b>${currentClubSet.size}</b>개 클럽`;
    ge('heroTeams').innerHTML=`👥 참가 <b>${currentTeams.length}</b>팀 · 인원 <b>${currentPlayerSet.size}</b>명`;
    const homeTours = getHomeVisibleTournaments();
    ge('homeTournInfo').innerHTML=`<div style="display:flex;flex-direction:column;gap:8px">
      <div style="font-weight:700;font-size:1rem">${at.name}</div>
      <div style="font-size:.82rem;color:var(--text2)">📅 ${at.date||'-'}${at.venue?' | 📍 '+at.venue:''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="hero-chip home-click-chip" style="background:var(--panel2);color:var(--primary-dark);border:1px solid var(--border)" onclick="goHomeMetric('current_clubs')">🏟 ${currentClubSet.size}개 클럽</span>
        <span class="hero-chip home-click-chip" style="background:var(--panel2);color:var(--primary-dark);border:1px solid var(--border)" onclick="goHomeMetric('current_teams')">👥 ${currentTeams.length}팀</span>
        <span class="hero-chip home-click-chip" style="background:var(--panel2);color:var(--primary-dark);border:1px solid var(--border)" onclick="goHomeMetric('current_teams')">🧍 ${currentPlayerSet.size}명</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${at.divisions.map(d=>`<span class="dpill ${dc(d)}" style="cursor:pointer" onclick="openRoster('${at.id}','${d}')">${dl(d)} <small>${(G.teams[at.id+'_'+d]||[]).length}팀</small></span>`).join('')}</div>
      ${homeTours.length ? `<div style="margin-top:2px;padding:8px 10px;background:var(--panel2);border:1px solid var(--border);border-radius:10px"><div style="font-size:.76rem;font-weight:800;color:var(--primary-dark);margin-bottom:6px">📋 현재 접수중/진행중 대회 (날짜 빠른순)</div><div style="display:flex;flex-direction:column;gap:6px">${homeTours.map(t=>`<div onclick="showPage('register');const el=ge('regTS');if(el){el.value='${t.id}';onRegTC();}window.scrollTo({top:0,behavior:'smooth'});" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;background:#fff;border:1px solid var(--border);border-radius:8px"><div style="font-size:.8rem;font-weight:700;color:var(--text)">• ${esc(t.name||'')}</div><div style="font-size:.72rem;color:var(--text2);white-space:nowrap">${esc(t.date||'-')} · ${String(t.status||'')==='ongoing'?'진행중':'접수중'}</div></div>`).join('')}</div></div>` : ''}
      <div style="display:flex;justify-content:flex-end"><button class="btn btn-outline" style="font-size:.78rem;padding:5px 11px" onclick="openGuide('${at.id}')">📌 요강 보기</button></div>
      ${at.notice?`<div style="font-size:.78rem;background:var(--panel2);padding:8px;border-radius:var(--radius);border:1px solid var(--border);white-space:pre-line">${at.notice}</div>`:''}
    </div>`;
    ge('homeDivStatus').innerHTML=at.divisions.map(d=>{
      const k=`${at.id}_${d}`;
      const tc=(G.teams[k]||[]).length;
      const allMs=G.matches[k]||[];
      const gMs=allMs.filter(m=>m.phase==='group');
      const playInMs=allMs.filter(m=>m.phase==='playin');
  const mMs=allMs.filter(m=>m.phase==='main');
      const md=allMs.filter(m=>getMatchResultState(k,m).done).length;
      const mt=allMs.length;
      const hd=!!G.draws[k];
      const isOngoing=at.status==='ongoing'||(hd&&mt>0);
      let summary='';
      if(isOngoing&&mt>0){
        const gDone=gMs.filter(m=>getMatchResultState(k,m).done).length;
        const gTotal=gMs.length;
        const mDone=mMs.filter(m=>getMatchResultState(k,m).done).length;
        const mTotal=mMs.filter(m=>!m.bye).length;
        const mainStarted=mMs.some(m=>getMatchResultState(k,m).done);
        if(mainStarted){
          const finalM=[...mMs].sort((a,b)=>b.round-a.round)[0];
          const champ=finalM?.winner!=null?(G.teams[k]||[])[finalM.winner]:null;
          if(champ){
            const champNm=tdn(champ,k,finalM.winner);
            summary=`<div style="margin-top:6px;padding:6px 8px;background:linear-gradient(90deg,#fef3cd,#fff9e6);border-radius:var(--radius);border:1px solid var(--accent)"><div style="font-size:.65rem;color:var(--text2);margin-bottom:2px">🏆 최종 우승</div><div style="font-weight:700;font-size:.82rem;color:#b45309">${champNm}</div></div>`;
          } else {
            summary=`<div style="margin-top:6px;padding:5px 8px;background:var(--panel2);border-radius:var(--radius);font-size:.76rem;color:var(--text2)">🏆 본선 진행중 <b>${mDone}/${mTotal}</b></div>`;
          }
        } else if(gTotal>0){
          const grps=(G.draws[k]?.groups||[]);
          const grpSummary=grps.map((grp,gi)=>{
            const gcMs=gMs.filter(m=>m.group===gi);
            const gcDone=gcMs.filter(m=>getMatchResultState(k,m).done).length;
            const gcTotal=gcMs.length;
            return `${grpLabel(gi)} ${gcDone}/${gcTotal}`;
          }).join(' · ');
          summary=`<div style="margin-top:6px;padding:5px 8px;background:var(--panel2);border-radius:var(--radius);font-size:.75rem;color:var(--text2)">📋 예선 진행중<br><span style="font-weight:600">${grpSummary}</span></div>`;
        }
      }
      const onClickFn=isOngoing?`goBracket('${at.id}','${d}')`:`openRoster('${at.id}','${d}')`;
      // 홈 현재 부서 진행 현황에는 상세 오더 목록 대신 요약만 표시
      let orderHtml='';
      if(G.meta.onlineOrderEnabled && isOngoing && allMs.length>0){
        const allMatchMs=allMs.filter(m=>!m.bye);
        let s1cnt=0,s2cnt=0,bothCnt=0;
        allMatchMs.forEach(m=>{
          const ost=getOnlineOrderState(k,m);
          if(ost.s1) s1cnt++;
          if(ost.s2) s2cnt++;
          if(ost.bothSubmitted) bothCnt++;
        });
        const totalSides=allMatchMs.length*2;
        const totalSubmitted=s1cnt+s2cnt;
        const pendingSides=Math.max(0,totalSides-totalSubmitted);
        const allDone=allMatchMs.length>0 && bothCnt===allMatchMs.length;
        const someDone=totalSubmitted>0;
        const color=allDone?'#166534':(someDone?'#b45309':'#475569');
        const bg=allDone?'#dcfce7':(someDone?'#fef3c7':'#f1f5f9');
        const bd=allDone?'#86efac':(someDone?'#fde68a':'#e2e8f0');
        orderHtml=`<div style="margin-top:6px;padding:6px 8px;border-radius:8px;background:${bg};border:1px solid ${bd}">
          <div style="font-size:.72rem;font-weight:800;color:${color}">📋 오더 제출 요약</div>
          <div style="font-size:.8rem;color:${color};margin-top:3px;font-weight:800">제출 ${totalSubmitted}/${totalSides} · 미제출 ${pendingSides}</div>
          <div style="font-size:.74rem;color:${color};margin-top:2px;font-weight:700">양팀 제출 완료 경기 ${bothCnt}/${allMatchMs.length}</div>
        </div>`;
      }
      return`<div class="stat-card" style="cursor:pointer;padding:20px 18px;min-height:158px;border-width:2px" onclick="${onClickFn}"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span class="dpill ${dc(d)}" style="font-size:.9rem;padding:6px 14px">${dl(d)}</span>${isOngoing&&mt>0?'<span class="badge bg-green" style="animation:pulse 2s infinite;font-size:.78rem;padding:5px 10px">진행중</span>':hd?'<span class="badge bg-green" style="font-size:.78rem;padding:5px 10px">추첨완료</span>':'<span class="badge bg-gray" style="font-size:.78rem;padding:5px 10px">대기</span>'}</div><div class="stat-val" style="margin-top:12px;font-size:2.25rem">${tc}<span style="font-size:1.08rem;font-weight:500"> 팀</span></div><div class="stat-label" style="font-size:.9rem;margin-top:2px">${mt>0?`경기 ${md}/${mt} 완료`:'미시작'}</div>${summary}${orderHtml}${isOngoing?'<div style="margin-top:10px;font-size:.82rem;color:var(--primary);font-weight:700">👆 탭하면 대진표 실시간 보기</div>':''}</div>`;
    }).join('');
  } else {
    ge('heroTitle').textContent=getAppTitle();
    ge('heroStatus').textContent='대회 준비중';
    ge('heroClubs').textContent='🏟 현재 참가 -';
    ge('heroTeams').textContent='👥 현재 참가 -';
    ge('homeTournInfo').innerHTML='<p class="muted">현재 접수중/진행중인 대회가 없습니다</p>';
    ge('homeDivStatus').innerHTML='';
  }
  upLog();
  if(window.renderHomeReg) window.renderHomeReg();
  // 내 클럽 카드 갱신 (경기이사 로그인 상태면)
  if(REG && REG_CLUB && !AD) updateMyClubHomeCard();
}

async function regP(name,club,tid,div,rank,_tname,_date){
  const bc=baseClub(club); // 소속 클럽 (A/B 제거: 하모니A→하모니)
  const k=pKey(name,bc);
  if(!G.players[k])G.players[k]={clubs:[],history:[],wins:0,losses:0,name,club:bc};
  const p=G.players[k];
  if(!p.clubs)p.clubs=[];
  if(!p.clubs.includes(bc))p.clubs.push(bc);
  const t=G.tournaments.find(t=>t.id===tid);
  if(!p.history)p.history=[];
  // 이력에는 원본 팀명(하모니A) 보존, 기본 클럽도 저장
  if(!p.history.find(h=>h.tid===tid&&h.div===div&&h.club===club)){
    const rankVal=(typeof rank==='number')?rank:null;
    const resultStr=rankVal===1?'우승':rankVal===2?'준우승':rankVal===3?'3위':rankVal===99?'최하위':'참가';
    const tnameVal=t?.name||_tname||'';
    const dateVal=t?.date||_date||'';
    p.history.push({tid,tname:tnameVal,date:dateVal,club,baseClub:bc,div,result:resultStr,rank:rankVal});
  }
  await stP(k);
}

// ✅ 선수기록 이력용: "2024년43회 김해시장기" 형태로 표시
function formatTournamentTitle(tname, dateStr){
  const year = (dateStr||'').toString().substring(0,4);
  const raw = (tname||'').toString().trim();

  // 회차 추출: "제43회", "제 43 회" 등
  const m = raw.match(/제\s*(\d+)\s*회/);
  const seq = m ? m[1] : null;

  // 대회명 정리
  let base = raw.replace(/제\s*\d+\s*회/g,'').trim();
  // 표기 통일(원하신 예시 기준)
  base = base
    .replace('김해시테니스협회장기','김해시협회장기')
    .replace('김해테니스협회장기','김해시협회장기')
    .replace('테니스협회장기','협회장기')
    .replace('김해시 협회장기','김해시협회장기')
    .replace(/\s+/g,' ');

  // 년도 없으면 원문 유지
  if(!year) return raw;

  // 회차가 있으면 "YYYY년NN회 {대회명}"
  if(seq){
    const tail = base || raw;
    return `${year}년${seq}회 ${tail}`.replace(/\s+/g,' ').trim();
  }

  // 회차가 없으면 "YYYY년 {대회명}"
  return `${year}년 ${base||raw}`.replace(/\s+/g,' ').trim();
}



function getPlayerKeyByName(name,club){
  const n=normName(name);
  const wantClub = normalizeClub(club||'');
  if(wantClub){
    const k1=pKey(name,wantClub);
    if(G.players[k1]) return k1;
    for(const k of Object.keys(G.players||{})){
      const pk=pKeyParse(k);
      if(normName(pk.name)!==n) continue;
      const p=G.players[k]||{};
      const clubs=[normalizeClub(pk.club||''), ...(Array.isArray(p.clubs)?p.clubs.map(c=>normalizeClub(c)):[])].filter(Boolean);
      if(clubs.includes(wantClub)) return k;
    }
  }
  for(const k of Object.keys(G.players||{})){
    const pk=pKeyParse(k);
    if(normName(pk.name)===n) return k;
  }
  return null;
}
// 팀 클럽명으로 선수 key 찾기 (동명이인 구분)
function getPlayerKey(name,club){
  // ✅ 동명이인/이적 혼동 방지: club이 있으면 무조건 name__club 키를 사용
  if(club) return pKey(name,club);

  // club이 없을 때만 레거시(name-only) 허용
  if(G.players[name]) return name;

  return name;
}
function hasHistPlayer(name){
  const n = normName(name);
  let found = false;
  HIST_DATA.forEach(t=>{
    t.teams.forEach(tm=>{
      (tm.players||[]).forEach(pn=>{
        if(normName(pn)===n) found = true;
      });
    });
  });
  return found;
}
function getLastClubFromHist(name){
  const n = normName(name);
  let bestDate = '';
  let bestClub = '';
  HIST_DATA.forEach(t=>{
    t.teams.forEach(tm=>{
      if((tm.players||[]).some(pn=>normName(pn)===n)){
        const d = (t.date||'');
        if(d && d >= bestDate){ bestDate = d; bestClub = tm.club || bestClub; }
      }
    });
  });
  return bestClub;
}
function allPlayerNames(){
  const set = new Set(Object.keys(G.players||{}));
  HIST_DATA.forEach(t=>{
    t.teams.forEach(tm=>{
      (tm.players||[]).forEach(pn=>{
        const x = (pn||'').trim();
        if(x) set.add(x);
      });
    });
  });
  (getMemberRegistry2026()||[]).forEach(r=>{
    const name=(r.name||'').trim();
    const club=normalizeClub(r.club||'');
    if(name){
      set.add(club ? pKey(name, club) : name);
      String(r.subClub||'').split(',').map(s=>normalizeClub(s.trim())).filter(Boolean).forEach(sc=>set.add(pKey(name, sc)));
    }
  });
  return [...set];
}
function getPlayerForDisplay(name){
  const key = getPlayerKeyByName(name);
  if(key){
    const parsed=pKeyParse(key);
    const displayName=cleanName(parsed.name||name||key);
    return { name:displayName, key, p:G.players[key], exists:true };
  }
  // Firebase에 없더라도 HIST_DATA에 있으면 빈 객체로 buildPH를 호출할 수 있게 함
  if(hasHistPlayer(name)) return { name:cleanName(name), key:'', p:{wins:0,losses:0,clubs:[],history:[]}, exists:true };
  return { name:cleanName(name), key:'', p:null, exists:false };
}


function getRegAutocompleteYear(){
  const tid = ge('regTS')?.value || '';
  const t = (G.tournaments||[]).find(x=>x.id===tid);
  const y = parseInt(String(t?.date||'').slice(0,4),10);
  if(!isNaN(y) && y >= 2026) return y;
  return REG_YEAR >= 2026 ? REG_YEAR : 2026;
}
function getRegistryRowsForAutocomplete(year){
  // G.meta.memberRegistry2026은 레거시 호환용 - REG_YEAR와 같을 때만 사용
  if(year===REG_YEAR && year===2026 && Array.isArray(G.meta?.memberRegistry2026) && G.meta.memberRegistry2026.length){
    return G.meta.memberRegistry2026;
  }
  return (window.G_REGISTRY && Array.isArray(G_REGISTRY[year])) ? G_REGISTRY[year] : [];
}

function selectRegistrationPlayerSuggestion(num,name,club){
  // club 인자는 phint에서 공식 등록명단의 주클럽만 전달한다.
  const inp=ge('p'+num);
  if(inp) inp.value=String(name||'');
  const hint=ge('h'+num);
  if(hint) hint.innerHTML='';

  // 개인전은 참가자별 클럽 입력 구조이므로 팀명 자동입력 대상이 아니다.
  if(currentRegIsIndividual()) return;

  // 경기이사 로그인 상태라면 로그인한 본인 클럽을 최우선으로 사용한다.
  const suggestedClub=normalizeClub((REG && !AD && REG_CLUB) ? REG_CLUB : (club||''));
  if(!suggestedClub) return;

  if(usesFixedClubList()){
    const sel=ge('regClub');
    if(!sel || sel.value) return;

    const wantBase=baseClub(suggestedClub);
    const opt=[...(sel.options||[])].find(o=>{
      const ov=normalizeClub(o.value||o.textContent||'');
      return ov===suggestedClub || baseClub(ov)===wantBase;
    });
    if(opt){
      sel.value=opt.value;
      try{ onRegClubChange(); }catch(e){}
    }
    return;
  }

  // 자유 입력 방식(현재 화면의 클럽/팀명 입력란)은 비어 있을 때만 자동 채운다.
  // 관리자가 별도 팀명을 직접 입력한 경우에는 덮어쓰지 않는다.
  const txt=ge('regClubText');
  if(txt && !String(txt.value||'').trim()){
    txt.value=suggestedClub;
    try{ txt.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){}
    try{ txt.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){}
  }
}


function isSameRegistrationClub(a,b){
  const aa=normalizeClub(a||'');
  const bb=normalizeClub(b||'');
  if(!aa || !bb) return false;
  if(aa===bb) return true;
  return baseClub(aa)===baseClub(bb);
}

function phint(inp,num){
  const v=(inp?.value||'').trim(), h=ge('h'+num);
  if(!h) return;
  if(!v){ h.innerHTML=''; return; }

  const nv = normName(v);
  const selectedClub = normalizeClub(getRegClubInputValue()||'');
  const year = getRegAutocompleteYear();
  const registryRows = getRegistryRowsForAutocomplete(year);

  // 2026년 이후 대회는 해당 연도 등록선수 명단 안에서만 자동완성
  const seen = new Set();
  const cand = registryRows.map(r=>{
    const disp = cleanName(r.name||'');
    const mainClub = normalizeClub(r.club||'');
    const subClubs = [...new Set(
      String(r.subClub||'').split(',').map(s=>normalizeClub(s.trim())).filter(Boolean)
    )].filter(c=>c && !isSameRegistrationClub(c,mainClub));

    const mainMatch = !!(selectedClub && mainClub && isSameRegistrationClub(selectedClub,mainClub));
    const subMatch = !!(selectedClub && !mainMatch && subClubs.some(c=>isSameRegistrationClub(selectedClub,c)));

    // 자동완성에 표시/선택되는 소속은 언제나 공식 등록명단의 '주클럽'을 기준으로 한다.
    // 부클럽이 현재 팀과 일치하더라도 주클럽을 부클럽으로 바꾸어 표시하지 않는다.
    return {
      disp,
      club:mainClub,
      mainClub,
      subClubs,
      mainMatch,
      subMatch,
      matchClub:(mainMatch||subMatch)
    };
  }).filter(x=> x.disp && normName(x.disp).includes(nv)).sort((a,b)=>{
    // 현재 팀의 주클럽 회원을 최우선, 그 다음 부클럽 일치, 그 다음 이름순
    if(!!b.mainMatch !== !!a.mainMatch) return Number(b.mainMatch)-Number(a.mainMatch);
    if(!!b.subMatch !== !!a.subMatch) return Number(b.subMatch)-Number(a.subMatch);
    return a.disp.localeCompare(b.disp,'ko');
  }).filter(x=>{
    const dedupeKey = `${normName(x.disp)}|${x.mainClub||''}`;
    if(seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });

  if(!cand.length){
    h.innerHTML=`<span style="color:var(--text3);font-size:.72rem">${year} 등록선수 명단에 없는 선수</span>`;
    return;
  }

  h.innerHTML = cand.slice(0,4).map(x=>{
    const clubDisp = x.mainClub || x.club || '';
    const badge = x.mainMatch
      ? `<span style="font-size:.64rem;color:#166534;font-weight:800"> [주클럽]</span>`
      : (x.subMatch
          ? `<span style="font-size:.64rem;color:#7c3aed;font-weight:800"> [부클럽]</span>`
          : '');
    const subText = x.subClubs?.length
      ? `<span style="font-size:.62rem;color:var(--text3);text-decoration:none"> · 부 ${x.subClubs.map(esc).join(', ')}</span>`
      : '';
    return `<span onclick="selectRegistrationPlayerSuggestion(${num},'${esc(x.disp)}','${esc(clubDisp)}')"
      style="cursor:pointer;color:var(--primary);font-size:.73rem;text-decoration:underline">
      ${x.disp}${clubDisp?`(${clubDisp})`:''}${badge}${subText}
    </span>`;
  }).join(' ');
}
async function openPHist(iid){
  try{ if(!Object.keys(G.players||{}).length) await ensurePlayersLoaded(); }catch(e){}
  let name=(ge(iid)?.value||'').trim();
  if(!name){toast('이름 먼저 입력','info');return;}

  // 입력값에 "이름__클럽"이 들어와도 보정
  const sp = splitKeyNameClub(name);
  name = sp.name || name;

  const info = getPlayerForDisplay(name);
  ge('mPHistBody').innerHTML = info.exists
    ? buildPH(info.name, info.p)
    : `<div class="empty-state"><div class="empty-icon">👤</div><p>${name} 기록 없음</p></div>`;
  om('mPHist');
}
// ── 선수 상세 카드 빌더 (Firebase + 내장 과거 데이터 통합) ──
function getPlayerRegistryRow(name,p,preferClub=''){
  const yr=REG_YEAR||new Date().getFullYear();
  const rows=(G_REGISTRY&&(G_REGISTRY[yr]||G_REGISTRY[2026]))||[];
  const nm=_m26Name(name);
  const candidates=rows.filter(r=>_m26Name(r.name)===nm);
  if(!candidates.length) return null;

  const preferSet=new Set([
    preferClub,
    p?.club,
    pKeyParse(p?.key||'').club,
    ...((p?.clubs)||[])
  ].map(c=>normalizeClub((c||'').trim())).filter(Boolean));

  const pick=candidates.find(r=>{
    const main=normalizeClub(r.club||'');
    const subs=String(r.subClub||'').split(',').map(s=>normalizeClub(s.trim())).filter(Boolean);
    return preferSet.has(main) || subs.some(sc=>preferSet.has(sc));
  });

  return pick || (candidates.length===1 ? candidates[0] : null);
}
function resolvePlayerDisplayClubInfo(name,p,preferClub=''){
  const regRow=getPlayerRegistryRow(name,p,preferClub);
  if(regRow){
    const mainClub=normalizeClub(regRow.club||'');
    const subClubs=[...new Set(String(regRow.subClub||'').split(',').map(s=>normalizeClub(s.trim())).filter(Boolean))]
      .filter(c=>c && c!==mainClub);
    return {mainClub, subClubs, registryRow:regRow, registryDriven:true};
  }

  const fallbackMain=normalizeClub((preferClub||p?.club||pKeyParse(p?.key||'').club||((p?.clubs||[])[0])||'').trim());
  return {mainClub:fallbackMain, subClubs:[], registryRow:null, registryDriven:false};
}
function buildPH(name,p){
  const safeName=cleanName(pKeyParse(name||'').name||name||'');
  const wr=p.wins+p.losses>0?Math.round(p.wins/(p.wins+p.losses)*100):0;
  const clubInfo=resolvePlayerDisplayClubInfo(safeName,p,p?.club||'');

  // ① Firebase 저장 이력
  const fbHist=(p.history||[]).map(h=>({
    date:h.date||'',tname:h.tname||'',club:h.club||'',div:h.div||'',
    rank:h.rank||null,result:h.result||'',source:'fb'
  }));

  // ② 내장 과거 데이터에서 선수 검색
  const histHist=[];
  HIST_DATA.forEach(t=>{
    t.teams.forEach(tm=>{
      if((tm.players||[]).some(pn=>pn===safeName||pn.replace(/\s/g,'')=== safeName.replace(/\s/g,''))){
        histHist.push({
          date:t.date, tname:t.name,
          club:tm.club,          // 원본 팀명 (하모니A)
          baseClub:baseClub(tm.club), // 실제 클럽 (하모니)
          div:tm.div,
          rank:tm.rank, result:tm.rank?tm.rank+'위':'참가', source:'hist',
          tid:t.id
        });
      }
    });
  });

  // ③ 합치기 (중복 제거: tid 우선 + (부서+클럽) 기준)
  // - 대회명을 수정/삭제해도 중복으로 쌓이지 않도록 tid가 있으면 tid로 묶음
  // - club은 하모니A/하모니B 같은 팀표기를 baseClub로 정규화해서 중복 방지
  const seen=new Set();
  const liveHist = collectLivePlayerHistory(safeName, clubInfo.mainClub||p?.club||'');
  const allHist=[...fbHist,...histHist,...liveHist].filter(h=>{
    const keyTid = (h.tid||'') || (h.tname||'');
    const keyClub = (h.baseClub||baseClub(h.club)||h.club||'');
    const k = keyTid+'|'+(h.div||'')+'|'+keyClub;
    if(seen.has(k))return false;
    seen.add(k);
    return true;
  }).sort((a,b)=>b.date.localeCompare(a.date));

  // 총 참가 횟수, 통계
  const totalGames=allHist.length;
  const divCounts={'금':0,'은':0,'동':0,'테린이':0};
  allHist.forEach(h=>{if(divCounts[h.div]!==undefined)divCounts[h.div]++;});

  // ④ 이력 HTML 생성
  const histHtml=allHist.length
    ? allHist.map(h=>{
        const rank=h.rank;
        const resultLabel=String(h.result||'').trim();
        const rankStr=rank===1?'🥇 1위':rank===2?'🥈 2위':rank===3?'🥉 3위':rank===4?'4위':rank?rank+'위':(resultLabel||'참가');
        const badgeCls=(rank===1||resultLabel==='1위')?'bg-gold':(rank===2||resultLabel==='2위')?'bg-silver':((rank===3||/3위/.test(resultLabel))?'bg-bronze':(resultLabel && resultLabel!=='참가' ? 'bg-blue' : 'bg-gray'));
        const srcBadge='';
        return`<div class="hist-row">
          <div class="hist-yr">${h.date.substring(0,4)}</div>
          <div class="hist-detail">
            <div style="font-weight:600;font-size:.82rem">${formatTournamentTitle(h.tname, h.date)}${srcBadge}</div>
            <div style="font-size:.7rem;color:var(--text2);margin-top:1px">${h.club} · <span class="dpill ${dc(h.div)}" style="font-size:.58rem;padding:1px 4px">${dl(h.div)}</span></div>
          </div>
          <div><span class="badge ${badgeCls}" style="white-space:nowrap;font-size:.72rem">${rankStr}</span></div>
        </div>`;
      }).join('')
    : '<p style="color:var(--text3);text-align:center;padding:16px">이력 없음</p>';

  // ⑤ 부서별 참가 태그
  const divTags=Object.entries(divCounts)
    .filter(([,c])=>c>0)
    .map(([d,c])=>`<span class="dpill ${dc(d)}" style="font-size:.62rem;padding:2px 7px">${dl(d)} ${c}회</span>`)
    .join('');

  return`<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <div style="width:46px;height:46px;background:var(--primary);color:white;border-radius:50%;font-size:1.2rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${safeName.charAt(0)}</div>
      <div style="flex:1">
        <b style="font-size:1.1rem">${safeName}</b>
        <div style="font-size:.75rem;color:var(--text2);margin-top:2px">주클럽: ${clubInfo.mainClub||'-'}</div>
        ${clubInfo.subClubs.length?`<div style="font-size:.75rem;margin-top:3px;display:flex;align-items:center;gap:4px;flex-wrap:wrap"><span style="color:#7c3aed;font-weight:600">부클럽:</span><span class="sub-badge" style="font-size:.72rem">${clubInfo.subClubs.join(', ')}</span></div>`:''}
        ${(p.phone||p.career)?`<div style="font-size:.75rem;color:var(--text2);margin-top:2px;display:flex;gap:10px;flex-wrap:wrap">${p.phone?`<span>📱 ${p.phone}</span>`:''}${p.career?`<span>⏱ 구력 ${p.career}</span>`:''}</div>`:''}
        ${divTags?`<div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:3px">${divTags}</div>`:''}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(1,1fr);gap:6px;margin-bottom:14px">
      <div class="psm"><div class="psm-val">${totalGames}</div><div class="psm-label">총참가</div></div>
    </div>
    <div style="font-size:.78rem;font-weight:700;color:var(--primary-dark);margin-bottom:6px">📋 대회 이력 및 순위</div>
    <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">${histHtml}</div>`;
}
function popCF(){const el=ge('pfClub');if(!el)return;const cur=el.value;el.innerHTML='<option value="">전체 클럽</option>'+G.clubs.map(c=>`<option ${c===cur?'selected':''}>${c}</option>`).join('');}

function getLiveTeamAchievementForHistory(key, teamIdx, team, tid, div){
  try{
    const teams=G.teams[key]||[];
    const matches=G.matches[key]||[];
    const teamRefs=new Set([
      String(teamIdx),
      String(team?.id??''),
      String(team?._id??''),
      String(team?.name??'')
    ].filter(Boolean));
    const isMyTeam=(v)=>teamRefs.has(String(v??''));

    const toRankLabel=(rankVal,label='')=>{
      const rv=Number(rankVal||0)||null;
      const txt=String(label||'').trim();
      if(rv===1) return {rank:1, result:'1위'};
      if(rv===2) return {rank:2, result:'2위'};
      if(rv===3) return {rank:3, result:(txt.includes('공동') ? '공동 3위' : '3위')};
      if(rv===4) return {rank:4, result:'4위'};
      if(txt) return {rank:rv, result:txt};
      return {rank:rv, result:'참가'};
    };

    const explicitTeamRank=(typeof team?.rank==='number') ? Number(team.rank||0) : (Number(team?.rank||0)||0);
    if(explicitTeamRank>0){
      return toRankLabel(explicitTeamRank, explicitTeamRank===1?'1위':explicitTeamRank===2?'2위':explicitTeamRank===3?'3위':`${explicitTeamRank}위`);
    }

    const finalRanks=calcFinalRanks(key, teams, matches)||[];
    const rankHit=finalRanks.find(r=>Number(r.teamIdx)===Number(teamIdx) || isMyTeam(r.teamIdx));
    if(rankHit){
      return toRankLabel(rankHit.rank, rankHit.label||'');
    }

    const mainMatches=matches.filter(m=>m && (m.phase==='main' || m.phase==='playin' || m.phase==='bronze') && (isMyTeam(m.t1) || isMyTeam(m.t2)));
    const bronzeMatch=mainMatches.find(m=>m && m.phase==='bronze');
    if(bronzeMatch && bronzeMatch.winner!=null){
      const isWinner=isMyTeam(bronzeMatch.winner);
      const loser=(String(bronzeMatch.winner)===String(bronzeMatch.t1)) ? bronzeMatch.t2 : bronzeMatch.t1;
      if(isWinner) return {rank:3, result:'3위'};
      if(isMyTeam(loser)) return {rank:4, result:'4위'};
    }

    if(mainMatches.length){
      const pureMain=mainMatches.filter(m=>m && m.phase==='main');
      if(pureMain.length){
        const maxRound=Math.max(...pureMain.map(m=>Number(m.round||0)).filter(Number.isFinite));
        let roundLabel=String(getMainRoundLabelByRoundIndex(maxRound,key)||'본선').trim();
        if(roundLabel==='결승') return {rank:null,result:'결승'};
        if(roundLabel==='준결승') return {rank:null,result:'4강'};
        if(roundLabel==='본선') return {rank:null,result:'본선 진출'};
        return {rank:null,result:roundLabel};
      }
      return {rank:null,result:'본선 진출'};
    }

    const draw=G.draws[key]||{};
    const t=G.tournaments.find(x=>x.id===tid);
    const cfg=gDS(t,div);
    const advTeams=getAdvT(key,draw,teams,cfg)||[];
    if(advTeams.some(x=>Number(x.ti)===Number(teamIdx) || isMyTeam(x.ti))) return {rank:null,result:'예선 통과'};

    const groupMatches=matches.filter(m=>m && m.phase==='group' && (isMyTeam(m.t1) || isMyTeam(m.t2)));
    if(groupMatches.length) return {rank:null,result:'예선 참가'};

    const groups=(draw.groups||[]);
    const joinedGroup=groups.some(g=>Array.isArray(g?.teams) && g.teams.some(v=>isMyTeam(v)));
    if(joinedGroup) return {rank:null,result:'예선 참가'};
  }catch(e){}
  return {rank:null,result:'참가'};
}
function collectLivePlayerHistory(name, preferClub=''){
  const targetName = cleanName(name||'').trim();
  const wantClub = normalizeClub(preferClub||'');
  const out = [];
  const seen = new Set();

  (G.tournaments||[]).forEach(t=>{
    const tid = t?.id || '';
    (t?.divisions||[]).forEach(div=>{
      const key = `${tid}_${div}`;
      (G.teams?.[key]||[]).forEach((team, teamIdx)=>{
        const teamClubRaw = String(team?.club||'').trim();
        const teamBaseClub = normalizeClub(baseClub(teamClubRaw)||teamClubRaw);
        if(wantClub && teamBaseClub && teamBaseClub !== wantClub) return;

        const names = [];
        (team?.players||[]).forEach(pn=>{
          const cn = cleanName(String(pn||'').trim());
          if(cn) names.push(cn);
        });
        (team?.individualPlayers||[]).forEach(p=>{
          const cn = cleanName(String(p?.name||'').trim());
          if(cn) names.push(cn);
        });

        const matched = names.some(n=>n===targetName || normName(n)===normName(targetName));
        if(!matched) return;

        const ach = getLiveTeamAchievementForHistory(key, teamIdx, team, tid, div);
        const rankVal = (typeof team?.rank === 'number') ? team.rank : ((typeof ach?.rank === 'number') ? ach.rank : (Number(team?.rank||0) || null));
        const rec = {
          tid,
          date: t?.date || '',
          tname: t?.name || '',
          club: teamClubRaw || teamBaseClub || '',
          baseClub: teamBaseClub || '',
          div: div || '',
          rank: rankVal,
          result: ach?.result || (rankVal===1 ? '우승' : rankVal===2 ? '준우승' : rankVal===3 ? '3위' : '참가'),
          source: 'live'
        };
        const dk = `${rec.tid}|${rec.div}|${rec.baseClub||rec.club}|${targetName}`;
        if(seen.has(dk)) return;
        seen.add(dk);
        out.push(rec);
      });
    });
  });

  return out;
}

function collectLiveParticipantEntries(){
  const out = [];
  const seen = new Set();

  (G.tournaments||[]).forEach(t=>{
    const tid = t?.id || '';
    (t?.divisions||[]).forEach(div=>{
      const key = `${tid}_${div}`;
      (G.teams?.[key]||[]).forEach(team=>{
        const teamClubRaw = String(team?.club||'').trim();
        const teamBaseClub = normalizeClub(baseClub(teamClubRaw)||teamClubRaw);

        const pushEntry = (playerName)=>{
          const clean = cleanName(String(playerName||'').trim());
          if(!clean) return;
          const dk = `${clean}|${teamBaseClub||teamClubRaw}`;
          if(seen.has(dk)) return;
          seen.add(dk);
          out.push({
            name: clean,
            club: teamBaseClub || teamClubRaw || '',
            rawClub: teamClubRaw || '',
            tid,
            div: div || '',
            date: t?.date || '',
            tname: t?.name || '',
            rank: (typeof team?.rank === 'number') ? team.rank : (Number(team?.rank||0) || null),
            source: 'live'
          });
        };

        (team?.players||[]).forEach(pushEntry);
        (team?.individualPlayers||[]).forEach(p=>pushEntry(p?.name||''));
      });
    });
  });

  return out;
}

function getTodayDateKey(){
  try{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }catch(e){ return ''; }
}
function getTournamentDateKey(t){
  const raw=String(t?.date || t?.matchDate || t?.startDate || t?.datetime || t?.startAt || '').trim();
  const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}
function isHomeActiveTournament(t){
  const st=String(t?.status||'').trim();
  if(!['open','ongoing'].includes(st)) return false;
  const dateKey=getTournamentDateKey(t);
  const todayKey=getTodayDateKey();
  // 날짜가 있는 대회는 오늘 이후만 홈의 '현재 대회'로 표시한다.
  // 과거 날짜인데 상태값만 접수중/진행중으로 남은 오래된 대회는 홈에서 숨긴다.
  if(dateKey && todayKey && dateKey < todayKey) return false;
  return true;
}
function getHomePrimaryTournament(){
  const tours = Array.isArray(G.tournaments) ? G.tournaments : [];
  return sortTournamentsEarliest(tours.filter(isHomeActiveTournament))[0] || null;
}

function getHomeVisibleTournaments(){
  const tours = Array.isArray(G.tournaments) ? G.tournaments : [];
  return sortTournamentsEarliest(tours.filter(isHomeActiveTournament));
}

function getPlayerRecordPhoneCandidates(name, playerObj, histClub=''){
  const out=new Set();
  const add=(v)=>{ const digits=normalizePhoneDigits(v||''); if(digits.length>=8) out.add(digits); };
  add(playerObj?.phone||'');
  Object.values(G.teams||{}).forEach(arr=>{
    (arr||[]).forEach(team=>{
      if(Array.isArray(team?.individualPlayers) && team.individualPlayers.length){
        team.individualPlayers.forEach(p=>{
          const pname=String(p?.name||'').trim();
          if(!pname || pname!==name) return;
          const clubs=[...(Array.isArray(p?.clubs)?p.clubs:[]), ...(parseClubAliases(p?.clubsRaw||''))].map(c=>normalizeClub(c)).filter(Boolean);
          const wanted=normalizeClub(histClub||playerObj?.club||'');
          if(wanted && clubs.length && !clubs.includes(wanted)) return;
          add(p?.phone||'');
        });
      }
    });
  });
  return [...out];
}
function getPlayerRecordSummary(name, club, playerObj, histRecs){
  const p=playerObj||{clubs:[],history:[],wins:0,losses:0};
  const dCnt={'금':0,'은':0,'동':0,'테린이':0};
  const allHist=[...(p.history||[]), ...(histRecs||[])];
  allHist.forEach(h=>{ if(dCnt[h.div]!==undefined) dCnt[h.div]++; });
  let bestRank=null;
  allHist.forEach(h=>{ const rank=Number(h?.rank||0)||0; if(rank && (!bestRank || rank<bestRank)) bestRank=rank; });
  const totalCount=allHist.length;
  const lastDate=(allHist||[]).map(h=>String(h?.date||'')).filter(Boolean).sort().slice(-1)[0]||'';
  const phoneList=getPlayerRecordPhoneCandidates(name, p, club);
  const displayPhone=phoneList[0] ? formatPhoneLoose(phoneList[0]) : '';
  return { totalCount, dCnt, bestRank, lastDate, phoneList, displayPhone };
}
function matchesPlayerRecordFilters(name, club, summary){
  const filterClub = PF.club ? normalizeClub(PF.club) : '';
  const filterDiv = PF.div||'';
  const filterSearch = String(PF.search||'').trim();
  const recentYears = parseInt(PF.recent||'0',10)||0;
  const minCount = parseInt(PF.count||'0',10)||0;
  if(filterSearch){
    const q=filterSearch.toLowerCase();
    const qDigits=normalizePhoneDigits(filterSearch);
    const nameHit=String(name||'').toLowerCase().includes(q);
    const clubHit=String(club||'').toLowerCase().includes(q);
    const phoneHit=qDigits && (summary.phoneList||[]).some(ph=>String(ph).includes(qDigits));
    if(!nameHit && !clubHit && !phoneHit) return false;
  }
  if(filterClub){
    const clubTokens=[normalizeClub(club||''), ...parseClubAliases(club||'').map(normalizeClub)].filter(Boolean);
    if(!clubTokens.includes(filterClub)) return false;
  }
  if(filterDiv && !(summary.dCnt?.[filterDiv]>0)) return false;
  if(recentYears>0){
    if(!summary.lastDate) return false;
    const dt=new Date(summary.lastDate);
    if(Number.isNaN(dt.getTime())) return false;
    const threshold=new Date();
    threshold.setFullYear(threshold.getFullYear()-recentYears);
    if(dt < threshold) return false;
  }
  if(minCount>0 && Number(summary.totalCount||0) < minCount) return false;
  return true;
}
function filterP(){PF.club='';PF.div='';PF.recent='';PF.count='';PF.search=ge('psInput')?.value||'';renderAllP();}
async function showP(name,club){
  try{ if(!Object.keys(G.players||{}).length) await ensurePlayersLoaded(); }catch(e){}
  const sec=ge('ppSection');
  if(sec) sec.style.display='none';

  // name이 "이름__클럽" 형태로 들어와도 보정
  const sp = splitKeyNameClub(name);
  const dispName = sp.name || (name||'');
  const clubFromKey = sp.club || '';
  const useClub = (club||'').trim() || clubFromKey;

  const k = useClub ? getPlayerKeyByName(dispName, useClub) : getPlayerKeyByName(dispName);
  let p = k ? G.players[k] : null;

  if(!p){
    // ① 과거 엑셀 업로드 데이터(HIST_DATA)에서 확인
    const histRecs=[];
    HIST_DATA.forEach(t=>{
      t.teams.forEach(tm=>{
        if((tm.players||[]).some(pn=>pn===dispName) && (!useClub||tm.club===useClub)){
          histRecs.push({date:t.date,tname:t.name,club:tm.club,div:tm.div,rank:tm.rank});
        }
      });
    });

    // ② 현재 라이브 대회 참가 기록도 확인 (G.teams 기반)
    const liveRecs = collectLivePlayerHistory(dispName, useClub);

    // 양쪽 모두 없을 때만 "기록 없음" 처리
    if(!histRecs.length && !liveRecs.length){
      toast(`"${dispName}" 기록 없음`,'info');
      return;
    }

    // 더미 p 객체 생성 — buildPH() 내부에서 live 이력을 다시 수집하므로
    // clubs만 넣어두면 주클럽 표시에 활용됨
    const allClubs=[...new Set([
      ...(useClub?[useClub]:[]),
      ...histRecs.map(r=>r.club).filter(Boolean),
      ...liveRecs.map(r=>r.club||r.baseClub||'').filter(Boolean)
    ])];
    p={name:dispName,clubs:allClubs,history:[],wins:0,losses:0};
  }

  const body=ge('mPHistBody');
  if(body) body.innerHTML = buildPH(dispName,p);
  om('mPHist');
}

function renderAllP(){
  if(!PLAYERS_LOADED && !Object.keys(G.players||{}).length){ loadPlayersFromLocalCache(); }

  const reg2026 = (G_REGISTRY&&G_REGISTRY[2026]) || [];
  const fbKeys = Object.keys(G.players||{});
  const liveEntries = collectLiveParticipantEntries();

  const rowMap = new Map();
  const upsertRow = (name, club='', subClub='', isReg=false)=>{
    const clean = cleanName(name||'').trim();
    if(!clean) return;
    const normClub = normalizeClub(club||'');
    const key = `${clean}|${normClub}`;
    if(!rowMap.has(key)){
      rowMap.set(key, { name: clean, club: normClub||'', subClub: subClub||'', isReg: !!isReg });
    } else {
      const row = rowMap.get(key);
      if(!row.club && normClub) row.club = normClub;
      if(!row.subClub && subClub) row.subClub = subClub;
      if(isReg) row.isReg = true;
    }
  };

  reg2026.forEach(m=>upsertRow(m.name, m.club||'', m.subClub||'', true));
  liveEntries.forEach(r=>upsertRow(r.name, r.club||r.rawClub||'', '', false));
  fbKeys.forEach(k=>{
    const pk = pKeyParse(k);
    const p = G.players[k] || {};
    const club = normalizeClub(pk.club || p.club || (Array.isArray(p.clubs)&&p.clubs.length ? p.clubs[p.clubs.length-1] : ''));
    upsertRow(pk.name||k, club, '', false);
  });
  HIST_DATA.forEach(t=>{
    (t.teams||[]).forEach(tm=>{
      const club = normalizeClub(baseClub(tm.club)||tm.club||'');
      (tm.players||[]).forEach(pn=>upsertRow(pn, club, '', false));
    });
  });

  let rows = [...rowMap.values()].map(row=>{
    const fbKey =
      fbKeys.find(k=>{
        const pk=pKeyParse(k);
        return cleanName(pk.name||k)===row.name && normalizeClub(pk.club||'')===normalizeClub(row.club||'');
      }) ||
      fbKeys.find(k=>cleanName(pKeyParse(k).name||k)===row.name);

    const p = fbKey ? (G.players[fbKey]||{clubs:[],history:[],wins:0,losses:0}) : {clubs:[],history:[],wins:0,losses:0};
    const histRecs = [];

    HIST_DATA.forEach(t=>{
      (t.teams||[]).forEach(tm=>{
        const matched=(tm.players||[]).some(pn=>cleanName(pn)===row.name || normName(cleanName(pn))===normName(row.name));
        if(matched){
          histRecs.push({
            date:t.date||'',
            tname:t.name||'',
            club:tm.club||'',
            baseClub:baseClub(tm.club)||tm.club||'',
            div:tm.div||'',
            rank:tm.rank||null,
            tid:t.id||'',
            source:'hist'
          });
        }
      });
    });

    collectLivePlayerHistory(row.name, row.club).forEach(r=>histRecs.push(r));

    const summary = getPlayerRecordSummary(row.name, row.club, p, histRecs);
    const recentClub = normalizeClub(
      row.club ||
      (p?.clubs&&p.clubs.length ? p.clubs[p.clubs.length-1] : '') ||
      (p?.history&&p.history.length ? p.history[p.history.length-1]?.club : '') ||
      (histRecs.length ? baseClub(histRecs[histRecs.length-1].club) : '') || ''
    );

    return { name: row.name, club: row.club||recentClub||'', subClub: row.subClub||'', isReg: !!row.isReg, summary };
  });

  rows = rows.filter(row=>matchesPlayerRecordFilters(row.name, row.club, row.summary));
  const q = String(PF.search||'').trim();
  const total = rowMap.size;
  const info=ge('pFInfo');
  if(info){
    if(q){
      info.innerHTML=`검색 결과 <b>${rows.length}</b>명`;
    }else{
      info.innerHTML=`이름이나 전화번호로 바로 찾을 수 있습니다. 전체 대상 <b>${total}</b>명`;
    }
  }

  const container=ge('psResults');
  if(!container) return;
  const buildCard=(row, highlight=false)=>buildPlayerRecordCard({
    row,
    highlight,
    escapeHtml:esc,
    formatRecentLabel
  });

  let displayRows = rows.slice();
  if(q){
    displayRows.sort((a,b)=>{
      const aExact = a.name===q || normalizePhoneDigits(a.summary?.displayPhone||'')===normalizePhoneDigits(q);
      const bExact = b.name===q || normalizePhoneDigits(b.summary?.displayPhone||'')===normalizePhoneDigits(q);
      if(aExact!==bExact) return aExact?-1:1;
      const ad=String(a.summary?.lastDate||'');
      const bd=String(b.summary?.lastDate||'');
      if(ad!==bd) return bd.localeCompare(ad);
      return Number(b.summary?.totalCount||0)-Number(a.summary?.totalCount||0);
    });
    const limited=displayRows.slice(0,20);
    container.innerHTML = limited.length
      ? `<div style="display:flex;flex-direction:column;gap:7px">${limited.map((row,idx)=>buildCard(row, idx===0 && limited.length===1)).join('')}</div>`
      : '<div class="empty-state" style="padding:18px 6px"><p>검색 결과가 없습니다</p></div>';
    if(limited.length===1){ showP(limited[0].name, limited[0].club); }
  } else {
    displayRows.sort((a,b)=>{
      const ad=String(a.summary?.lastDate||'');
      const bd=String(b.summary?.lastDate||'');
      if(ad!==bd) return bd.localeCompare(ad);
      return Number(b.summary?.totalCount||0)-Number(a.summary?.totalCount||0);
    });
    const recentRows=displayRows.slice(0,8);
    container.innerHTML = recentRows.length
      ? `<div style="font-size:.84rem;font-weight:900;color:var(--primary-dark);margin-bottom:10px">최근 참가자 빠르게 보기</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px">${recentRows.map(row=>buildCard(row)).join('')}</div>`
      : '<div class="empty-state" style="padding:18px 6px"><p>표시할 참가자 기록이 없습니다</p></div>';
  }
}
async function openPD(name,club){
  try{ if(!Object.keys(G.players||{}).length) await ensurePlayersLoaded(); }catch(e){}
  // name에 "이름__클럽"이 들어와도 정상 표시되도록 보정
  const sp = splitKeyNameClub(name);
  const dispName = sp.name || (name||'');
  const dispClubFromKey = sp.club || '';
  const useClub = (club||'').trim() || dispClubFromKey;

  const k = useClub ? getPlayerKeyByName(dispName, useClub) : getPlayerKeyByName(dispName);
  let p = k ? G.players[k] : null;

  // G.players에 없으면 라이브 대회 기록에서 더미 p 생성 (showP와 동일한 로직)
  if(!p){
    const histRecs=[];
    HIST_DATA.forEach(t=>{
      t.teams.forEach(tm=>{
        if((tm.players||[]).some(pn=>pn===dispName) && (!useClub||tm.club===useClub)){
          histRecs.push({date:t.date,tname:t.name,club:tm.club,div:tm.div,rank:tm.rank});
        }
      });
    });
    const liveRecs = collectLivePlayerHistory(dispName, useClub);
    if(histRecs.length || liveRecs.length){
      const allClubs=[...new Set([
        ...(useClub?[useClub]:[]),
        ...histRecs.map(r=>r.club).filter(Boolean),
        ...liveRecs.map(r=>r.club||r.baseClub||'').filter(Boolean)
      ])];
      p={name:dispName,clubs:allClubs,history:[],wins:0,losses:0};
    }
  }

  const title = dispName;
  ge('mPDT').textContent='👤 '+title;
  ge('mPDB').innerHTML = p ? buildPH(dispName, p)
    : `<div class="empty-state"><div class="empty-icon">👤</div><p>기록 없음</p></div>`;

  const footer=ge('mPDFooter');
  const editKey = k || (useClub ? pKey(dispName, useClub) : dispName);
  if(footer){
    footer.innerHTML = AD
      ? `<button class="btn btn-outline" style="font-size:.78rem" onclick="openEditPlayer('${editKey}')">✏️ 수정/삭제</button><div style="flex:1"></div><button class="btn btn-gray" onclick="cm('mPD')">닫기</button>`
      : `<button class="btn btn-gray" onclick="cm('mPD')">닫기</button>`;
  }
  om('mPD');
}

let EP_name=null;
function openEditPlayer(name){
  EP_name=name;
  const p=G.players[name]||{clubs:[],history:[]};
  const pk=pKeyParse(name);
  const displayName=cleanName(pk.name||name);
  const clubList=(p.clubs&&p.clubs.length?(p.clubs||[]):(pk.club?[pk.club]:[])).filter(Boolean);
  const clubInfo=resolvePlayerDisplayClubInfo(displayName,p,pk.club||p.club||'');
  const mainClub=((clubInfo.mainClub||p.club||pk.club||clubList[0]||'').trim());
  const subClubs=(clubInfo.subClubs||[]).filter(c=>c&&c!==mainClub);
  ge('epOldName').value=displayName;
  ge('epNewName').value='';
  const mainSel=ge('epMainClub');
  if(mainSel){
    const opts=[...new Set([...(G.clubs||[]), ...clubList, ...(mainClub?[mainClub]:[])])].filter(Boolean);
    mainSel.innerHTML='<option value="">-- 주 클럽 선택 --</option>'+opts.map(c=>`<option value="${esc(c)}">${c}</option>`).join('');
    mainSel.value=mainClub;
  }
  ge('epSubClubs').value=subClubs.join(', ');
  ge('epClubs').value=[mainClub,...subClubs].filter(Boolean).join(', ');
  ge('epPhone').value=p.phone||'';
  // 이력 편집 UI
  const hist=(p.history||[]);
  ge('epHistSection').innerHTML=hist.length?`
    <div style="font-weight:700;font-size:.82rem;margin:12px 0 6px">📋 이력 수정 (삭제할 항목 체크)</div>
    ${hist.map((h,i)=>`<label style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:.78rem;cursor:pointer">
      <input type="checkbox" class="ep-del-hist" data-idx="${i}">
      <span style="flex:1">${formatTournamentTitle(h.tname||h.tid, h.date||'')} · ${h.club} · ${dl(h.div)} · ${h.rank?h.rank+'위':'참가'}</span>
    </label>`).join('')}
  `:'<p style="font-size:.78rem;color:var(--text3);margin-top:8px">이력 없음</p>';
  // 합치기 드롭다운 - 현재 선수 제외한 전체 목록 (이름 유사한 것 먼저)
  const mergeEl=ge('epMergeTarget');
  if(mergeEl){
    const curRawName=cleanName(pKeyParse(name).name||name);
    const opts=Object.keys(G.players)
      .filter(k=>k!==name)
      .sort((a,b)=>{
        const na=cleanName(pKeyParse(a).name||a), nb=cleanName(pKeyParse(b).name||b);
        const sa=na===curRawName?0:1, sb=nb===curRawName?0:1;
        if(sa!==sb) return sa-sb;
        return na.localeCompare(nb,'ko');
      });
    mergeEl.innerHTML='<option value="">합칠 선수 선택...</option>'+
      opts.map(k=>{
        const pk=pKeyParse(k);
        const dn=cleanName(pk.name||k)+(pk.club?` (${pk.club})`:'');
        return `<option value="${esc(k)}">${dn}</option>`;
      }).join('');
  }
  cm('mPD');om('mEditP');
}

async function saveEditPlayer(){
  const oldKey=EP_name;
  const oldPk=pKeyParse(oldKey);
  const oldDisplayName=cleanName(oldPk.name||oldKey);
  const newName=ge('epNewName').value.trim();
  const mainClub=(ge('epMainClub')?.value||'').trim() || (oldPk.club||'').trim();
  const subRaw=(ge('epSubClubs')?.value||'').trim();
  const subClubs=subRaw?subRaw.split(',').map(c=>normalizeClub(c.trim())).filter(Boolean):[];
  const clubs=[mainClub, ...subClubs.filter(c=>c && c!==mainClub)];
  ge('epClubs').value=clubs.filter(Boolean).join(', ');
  const finalDisplayName=newName||oldDisplayName;
  const finalClub=(mainClub||oldPk.club||'').trim();
  if(!finalClub){ toast('주 클럽을 선택하세요','error'); return; }
  const finalKey=pKey(finalDisplayName, finalClub);
  const phone=(ge('epPhone')?.value||'').trim();
  const delIdxs=[...document.querySelectorAll('.ep-del-hist:checked')].map(el=>parseInt(el.dataset.idx));
  const finalSubClubStr=subClubs.join(', ');

  async function syncRegistryRow(){
    const year = REG_YEAR;
    if(!window.G_REGISTRY) window.G_REGISTRY={};
    const members = Array.isArray(G_REGISTRY[year]) ? G_REGISTRY[year] : await loadRegistry(year);
    if(!Array.isArray(members) || !members.length) return false;

    const oldNormName = normName(cleanName(oldDisplayName));
    const finalNormName = normName(cleanName(finalDisplayName));
    const oldMain = normalizeClub(oldPk.club || '');
    const finalMain = normalizeClub(finalClub || '');

    let idx = members.findIndex(r=> normName(cleanName(r.name||''))===oldNormName && normalizeClub(r.club||'')===oldMain);
    if(idx<0) idx = members.findIndex(r=> normName(cleanName(r.name||''))===oldNormName && normalizeClub(r.club||'')===finalMain);
    if(idx<0){
      const sameNameIdx = members.map((r,i)=>({r,i})).filter(x=> normName(cleanName(x.r.name||''))===oldNormName);
      if(sameNameIdx.length===1) idx = sameNameIdx[0].i;
    }
    if(idx<0){
      const sameNewNameIdx = members.map((r,i)=>({r,i})).filter(x=> normName(cleanName(x.r.name||''))===finalNormName);
      if(sameNewNameIdx.length===1) idx = sameNewNameIdx[0].i;
    }
    if(idx<0) return false;

    const row = {...members[idx]};
    row.name = finalDisplayName;
    row.club = finalClub;
    row.subClub = finalSubClubStr;
    members[idx] = row;
    G_REGISTRY[year] = members;
    await saveRegistry(year);
    return true;
  }

  // HIST 전용 선수(Firebase 없음) → HIST 이름만 수정
  if(!G.players[oldKey]){
    if(finalDisplayName!==oldDisplayName){
      let cnt=0;
      HIST_DATA.forEach(t=>t.teams.forEach(tm=>{
        tm.players=tm.players.map(pn=>{if(pn===oldDisplayName){cnt++;return finalDisplayName;}return pn;});
      }));
      toast(cnt>0?'"'+finalDisplayName+'"으로 변경됨 ✅':'변경할 기록 없음','success');
      savePlayersToLocalCache();
      cm('mEditP');renderAllP();
    }
    return;
  }

  const p=G.players[oldKey];
  const myHist=(p.history||[]).filter((_,i)=>!delIdxs.includes(i));

  sl(true);
  try{
    let registrySynced = false;
    if(finalKey!==oldKey){
      const existing=G.players[finalKey];
      let mergedHist=[...myHist];
      let mergedWins=(p.wins||0);
      let mergedLosses=(p.losses||0);
      let mergedClubs=[...new Set([...(clubs.length?clubs:(p.clubs||[])),...(existing?.clubs||[])])];

      if(existing){
        const seen=new Set(myHist.map(h=>h.tid+'|'+h.div));
        (existing.history||[]).forEach(h=>{if(!seen.has(h.tid+'|'+h.div))mergedHist.push(h);});
        mergedWins+=(existing.wins||0);
        mergedLosses+=(existing.losses||0);
        await deleteDoc(doc(db,'players',finalKey.replace(/[/.#$[\]]/g,'_')));
      }

      const newP={...p,key:finalKey,name:finalDisplayName,club:finalClub,clubs:mergedClubs,subClub:finalSubClubStr,history:mergedHist,wins:mergedWins,losses:mergedLosses,phone:phone||p.phone||''};
      await setDoc(doc(db,'players',finalKey.replace(/[/.#$[\]]/g,'_')),newP);
      await deleteDoc(doc(db,'players',oldKey.replace(/[/.#$[\]]/g,'_')));
      delete G.players[oldKey];
      if(existing) delete G.players[finalKey];
      G.players[finalKey]=newP;

      HIST_DATA.forEach(t=>t.teams.forEach(tm=>{
        tm.players=tm.players.map(pn=>pn===oldDisplayName?finalDisplayName:pn);
      }));
      registrySynced = await syncRegistryRow();
      toast(existing?'"'+oldDisplayName+'"과 "'+finalDisplayName+'" 합치기 완료 ✅':'"'+finalDisplayName+'"으로 변경 완료 ✅','success');
    } else {
      G.players[oldKey]={...p,key:oldKey,name:oldDisplayName,club:finalClub,clubs:(clubs.length?clubs:(p.clubs||[])),subClub:finalSubClubStr,history:myHist,phone};
      await stP(oldKey);
      registrySynced = await syncRegistryRow();
      toast('저장 완료 ✅','success');
    }
    savePlayersToLocalCache();
    sl(false);cm('mEditP');renderAllP();
    if(window.renderRegistryTab) renderRegistryTab();
    await fbLog('선수수정: '+oldDisplayName+'→'+finalDisplayName+(registrySynced?' (등록명단 동기화)':''),'✏️');
  }catch(e){sl(false);toast('저장 실패: '+e.message,'error');console.error(e);}
}

async function mergePlayer(){
  const baseKey=EP_name;
  const targetKey=ge('epMergeTarget')?.value;
  if(!targetKey){ toast('합칠 선수를 선택하세요','error'); return; }
  if(targetKey===baseKey){ toast('같은 선수입니다','error'); return; }

  const baseName=cleanName(pKeyParse(baseKey).name||baseKey);
  const targetName=cleanName(pKeyParse(targetKey).name||targetKey);
  if(!confirm(`"${baseName}"에 "${targetName}"의 이력·승패를 합칩니다.\n합쳐진 후 "${targetName}"은 삭제됩니다.\n계속하시겠습니까?`)) return;

  const base=G.players[baseKey]||{clubs:[],history:[],wins:0,losses:0};
  const target=G.players[targetKey]||{clubs:[],history:[],wins:0,losses:0};

  // 이름 정리 (전화번호 제거)
  const cleanBaseName=cleanName(pKeyParse(baseKey).name||baseKey);

  // clubs 합산
  const mergedClubs=[...new Set([...(base.clubs||[]),...(target.clubs||[])])];
  // 승패 합산
  const mergedWins=(base.wins||0)+(target.wins||0);
  const mergedLosses=(base.losses||0)+(target.losses||0);
  // 이력 합산 (tid+div+club 중복 제거)
  const seen=new Set((base.history||[]).map(h=>h.tid+'|'+h.div+'|'+h.club));
  const mergedHist=[...(base.history||[])];
  (target.history||[]).forEach(h=>{
    const k=h.tid+'|'+h.div+'|'+h.club;
    if(!seen.has(k)){ seen.add(k); mergedHist.push(h); }
  });
  mergedHist.sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  // phone: base 우선, 없으면 target
  const phone=base.phone||target.phone||'';

  // baseKey의 이름에 전화번호가 포함된 경우 → 새 키로 교체
  const needRename = (pKeyParse(baseKey).name||baseKey) !== cleanBaseName;
  const finalClub=pKeyParse(baseKey).club||base.club||'';
  const finalKey=needRename ? pKey(cleanBaseName, finalClub) : baseKey;

  sl(true);
  try{
    const merged={...base, name:cleanBaseName, club:finalClub,
      clubs:mergedClubs, wins:mergedWins, losses:mergedLosses,
      history:mergedHist, phone, key:finalKey};

    // Firebase 저장
    await setDoc(doc(db,'players',finalKey.replace(/[\/\.#\$\[\]]/g,'_')), merged);
    // target 삭제
    await deleteDoc(doc(db,'players',targetKey.replace(/[\/\.#\$\[\]]/g,'_')));
    // base가 이름 변경된 경우 기존 문서 삭제
    if(needRename && finalKey!==baseKey){
      await deleteDoc(doc(db,'players',baseKey.replace(/[\/\.#\$\[\]]/g,'_')));
    }

    // 로컬 상태 업데이트
    G.players[finalKey]=merged;
    if(finalKey!==baseKey) delete G.players[baseKey];
    delete G.players[targetKey];

    await fbLog(`선수합치기: ${cleanBaseName} ← ${targetName}`,'🔗');
    sl(false);
    toast(`합치기 완료 ✅ "${cleanBaseName}"으로 통합됐습니다`,'success');
    cm('mEditP');
    renderAllP();
    popCF();
  }catch(e){
    sl(false);
    toast('합치기 실패: '+e.message,'error');
    console.error(e);
  }
}

async function deletePlayer(){
  const key=EP_name;
  const pk=pKeyParse(key);
  const displayName=cleanName(pk.name||key);
  if(!confirm(`"${displayName}" 선수를 완전히 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`))return;
  sl(true);
  try{
    const docId=key.replace(/[\/\.#\$\[\]]/g,'_');
    await deleteDoc(doc(db,'players',docId));
    delete G.players[key];
    sl(false);cm('mEditP');
    renderAllP();
    toast(`"${displayName}" 삭제 완료`,'success');
    await fbLog(`선수삭제: ${displayName}`,'🗑️');
  }catch(e){sl(false);toast('삭제 실패: '+e.message,'error');}
}
function openRoster(tid,div){
  const t=G.tournaments.find(t=>t.id===tid);if(!t)return;
  const key=tid+'_'+div,teams=G.teams[key]||[];
  const isIndividual=isIndividualTournament(t);
  ge('mRosterT').textContent=`${dl(div)} 선수명단 (참가기록 조회 → 명단 클릭)`;
  if(!teams.length){ge('mRosterB').innerHTML='<div class="empty-state"><div class="empty-icon">👥</div><p>등록된 팀 없음</p></div>';om('mRoster');return;}
  const total=teams.reduce((s,t)=>s+(isIndividual?(t.individualPlayers||t.players||[]).length:t.players.length),0);
  const unitLabel=isIndividual?'조':'팀';
  let html=`<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;padding:8px 14px;background:var(--primary);color:white;border-radius:var(--radius-lg)"><b style="font-size:1.2rem">${teams.length}</b><span style="opacity:.8">${unitLabel}</span><span style="opacity:.4">|</span><b style="font-size:1.2rem">${total}</b><span style="opacity:.8">명</span></div>`;
  // 팀전만 첫 출전 안내 표시
  if(!isIndividual){
    html+=`<div style="margin:-2px 0 12px;padding:8px 12px;background:linear-gradient(135deg,#fff7ed,#fef3c7);border:1.5px solid #f59e0b;border-radius:var(--radius);font-size:.82rem;font-weight:700;color:#92400e">🟠 주황 배경 표시는 이 대회 첫 출전 선수입니다.</div>`;
  }
  teams.forEach((team,i)=>{
    if(isIndividual){
      // 개인전: 팀명 헤더 없이 참가자 2명만 표시
      const ips=getIndividualPlayers(team);
      const note=team.note?`<div style="font-size:.72rem;color:var(--text3);margin-top:6px">📝 ${esc(team.note)}</div>`:'';
      html+=`<div style="margin-bottom:10px;border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden">
        <div style="padding:10px 14px"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:5px">${ips.map((ip,idx)=>`<div style="background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius);padding:5px 7px;font-size:.78rem;display:flex;align-items:center;gap:4px"><span style="width:18px;height:18px;background:var(--primary);color:#fff;border-radius:50%;font-size:.62rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${idx+1}</span><span>${esc(ip.name||'')}${ip.clubsRaw?`<span style="font-size:.65rem;color:var(--text3);margin-left:2px">(${esc(ip.clubsRaw)})</span>`:''}</span></div>`).join('')}</div>${note}</div></div>`;
    }else{
      const dn=tdn(team,key,i);const p=team.players||[];const tc=esc(team.club||'');
      html+=`<div style="margin-bottom:10px;border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden"><div style="background:var(--primary-dark);color:white;padding:7px 14px;display:flex;align-items:center;justify-content:space-between"><span style="font-weight:700">${dn}</span><span style="font-size:.72rem;opacity:.75">${p.length}명</span></div>
      <div style="padding:10px 14px">${(()=>{const isWV=(div==='여성부');const isTV=(div==='테린이'||div==='terinee');const cfgDbl=Number(G.tournaments.find(x=>x.id===tid)?.divSettings?.[div]?.doublesCount||0);const dbl=Number(team.doublesCount||cfgDbl||((isTV||isWV)?(p.length<=6?3:p.length<=8?4:5):5));const savedMainCount=Number.isFinite(Number(team.mainPlayerCount))&&Number(team.mainPlayerCount)>0?Number(team.mainPlayerCount):0;const mainCount=savedMainCount||(isWV?6:dbl*2);const mainP=p.slice(0,mainCount);const subP=p.slice(mainCount);return`<div style="font-size:.65rem;color:var(--text3);font-weight:600;margin-bottom:6px">선수 명단 (페어는 경기 때 결정)</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:5px;margin-bottom:6px">${mainP.map((n,idx)=>{const isD=isFirstAppearancePlayer(n,team.club||'',tid);return`<div style="background:${isD?'linear-gradient(135deg,#fff7ed,#fef3c7)':'var(--panel2)'};border:1px solid ${isD?'#f59e0b':'var(--border)'};border-radius:var(--radius);padding:5px 7px;font-size:.78rem;display:flex;align-items:center;gap:4px"><span style="width:18px;height:18px;background:${isD?'#f59e0b':'var(--primary)'};color:#fff;border-radius:50%;font-size:.62rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${idx+1}</span>${rosterPlayerHTML(n, team.club||'', tid)}</div>`;}).join('')}</div>${subP.length?`<div style="font-size:.72rem;color:var(--text3)">후보: ${subP.map(n=>rosterPlayerHTML(n, team.club||'', tid)).join(', ')}</div>`:''}`})()}</div></div>`;
    }
  });
  ge('mRosterB').innerHTML=html;om('mRoster');
}


function openAdvancedDataTools(){
  if(!AD){toast('관리자 로그인 필요','info');return;}
  const target=document.getElementById('mAdvancedDataTools');
  if(!target){
    toast('고급 데이터 도구 화면을 찾지 못했습니다','error');
    console.error('mAdvancedDataTools element missing');
    return;
  }
  om('mAdvancedDataTools');
  setTimeout(()=>cm('mAdminSettings'),0);
}

function advancedDataRecalc(){
  if(!AD){toast('관리자 로그인 필요','info');return;}
  if(!confirm('선수 승/패 통계를 현재 저장된 경기결과 기준으로 다시 계산할까요?')) return;
  if(!confirm('재계산을 진행합니다. 계속하시겠습니까?')) return;
  cm('mAdvancedDataTools');
  recalcAllPlayerStats();
}

function advancedOpenHistoryExcel(){
  if(!AD){toast('관리자 로그인 필요','info');return;}
  cm('mAdvancedDataTools');
  om('mHistExcel');
}

function advancedOpenSelectiveClear(){
  if(!AD){toast('관리자 로그인 필요','info');return;}
  if(!confirm('선택한 대회의 팀·경기·선수 이력이 삭제될 수 있습니다.\n먼저 백업했는지 확인해 주세요.\n\n계속하시겠습니까?')) return;
  if(!confirm('삭제 도구를 여시겠습니까?\n실제 삭제 전에도 대상 대회를 다시 확인하세요.')) return;
  cm('mAdvancedDataTools');
  openSelectiveClearModal();
}

function advancedCleanupHistories(){
  if(!AD){toast('관리자 로그인 필요','info');return;}
  if(!confirm('개인기록 중복/삭제대회 데이터를 정리합니다.\n먼저 JSON 백업을 권장합니다.\n\n계속하시겠습니까?')) return;
  if(!confirm('개인기록 정리를 실행하시겠습니까?')) return;
  cm('mAdvancedDataTools');
  cleanupPlayerHistories();
}

let CLUB_MGR_MEMBERS_CACHE=[];

async function openClubMgr(){
  try{
    CLUB_MGR_MEMBERS_CACHE=await loadRegistry(2026);
  }catch(e){
    CLUB_MGR_MEMBERS_CACHE=[];
  }
  populateClubMgrRegionFilter();
  renderCL();
  om('mClubs');
}

function getClubMgrResolvedRegion(club){
  const saved=getClubDefaultRegion(G.meta,club);
  if(saved) return {region:normalizeRegionLabel(saved),source:'saved',count:0,total:0};
  const inferred=inferClubRegionFromMembers(CLUB_MGR_MEMBERS_CACHE,club,normalizeClub);
  return {
    region:normalizeRegionLabel(inferred.region||''),
    source:inferred.region?'registry':'none',
    count:inferred.count||0,
    total:inferred.total||0
  };
}

function populateClubMgrRegionFilter(){
  const sel=ge('clubMgrRegionFilter');
  if(!sel) return;
  const current=sel.value||'';
  const regions=buildClubRegionOptions(CLUB_MGR_MEMBERS_CACHE,G.meta.clubDefaultRegions||{});
  sel.innerHTML='<option value="">전체 구장/지역</option>'+regions.map(r=>`<option value="${escAttr(r)}">${esc(r)}</option>`).join('');
  if(regions.includes(current)) sel.value=current;
}

function renderCL(){
  const list=ge('clubList');
  if(!list) return;

  const q=(ge('clubMgrSearch')?.value||'').trim().toLowerCase();
  const filter=normalizeRegionLabel(ge('clubMgrRegionFilter')?.value||'');
  const sortMode=ge('clubMgrSort')?.value||'region';

  let rows=(G.clubs||[]).map((club,i)=>{
    const info=getClubMgrResolvedRegion(club);
    return {
      club,
      originalIndex:i,
      phone:getClubContact(G.meta,club),
      saved:getClubDefaultRegion(G.meta,club),
      region:info.region||'',
      source:info.source,
      count:info.count||0,
      total:info.total||0
    };
  });

  if(q) rows=rows.filter(r=>r.club.toLowerCase().includes(q));
  if(filter) rows=rows.filter(r=>normalizeRegionLabel(r.region)===filter);

  rows.sort((a,b)=>{
    if(sortMode==='club') return a.club.localeCompare(b.club,'ko');
    if(sortMode==='unassigned'){
      const au=a.region?1:0, bu=b.region?1:0;
      if(au!==bu) return au-bu;
      return a.club.localeCompare(b.club,'ko');
    }
    const ar=a.region||'zzzz', br=b.region||'zzzz';
    return ar.localeCompare(br,'ko') || a.club.localeCompare(b.club,'ko');
  });

  const assigned=rows.filter(r=>r.region).length;
  const inferred=rows.filter(r=>r.source==='registry').length;
  const unassigned=rows.length-assigned;
  const sum=ge('clubMgrSummary');
  if(sum) sum.textContent=`표시 ${rows.length}클럽 · 기본코트 ${assigned} · 명단기준 ${inferred} · 미지정 ${unassigned}`;

  if(!rows.length){
    list.innerHTML='<div style="padding:14px;text-align:center;color:var(--text3)">조건에 맞는 클럽이 없습니다</div>';
    return;
  }

  list.innerHTML=rows.map(r=>{
    const sourceBadge=r.source==='saved'
      ? '<span style="font-size:.58rem;background:#dcfce7;color:#166534;border:1px solid #86efac;border-radius:999px;padding:1px 5px;font-weight:800">저장값</span>'
      : r.source==='registry'
        ? `<span style="font-size:.58rem;background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd;border-radius:999px;padding:1px 5px;font-weight:800">명단기준${r.total?` ${r.count}/${r.total}`:''}</span>`
        : '<span style="font-size:.58rem;background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db;border-radius:999px;padding:1px 5px;font-weight:800">미지정</span>';

    return `<div class="club-mgr-row" style="display:grid;grid-template-columns:28px minmax(95px,.85fr) minmax(145px,1.05fr) minmax(130px,1fr) 70px;gap:7px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <input type="checkbox" class="club-mgr-check" data-club-check="${escAttr(r.club)}">
      <div style="min-width:0">
        <div style="font-weight:900;color:var(--primary-dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.club)}</div>
        <div style="margin-top:3px">${sourceBadge}</div>
      </div>
      <input class="form-input" data-club-phone="${escAttr(r.club)}" value="${escAttr(r.phone)}" placeholder="경기이사 전화번호" inputmode="tel" style="font-size:.78rem;padding:5px 7px">
      <input class="form-input" data-club-region="${escAttr(r.club)}" value="${escAttr(r.region)}" placeholder="기본 소속코트" style="font-size:.78rem;padding:5px 7px">
      <button class="btn btn-danger" style="padding:4px 8px;font-size:.7rem;white-space:nowrap" onclick="delClub(${r.originalIndex})">삭제</button>
    </div>`;
  }).join('');
}

function toggleClubMgrSelectAll(checked){
  document.querySelectorAll('#clubList .club-mgr-check').forEach(el=>el.checked=!!checked);
}

function applyBulkClubRegion(){
  const region=normalizeRegionLabel(ge('clubMgrBulkRegion')?.value||'');
  if(!region){toast('일괄 적용할 코트/지역을 입력하세요','info');return;}
  const checked=[...document.querySelectorAll('#clubList .club-mgr-check:checked')];
  if(!checked.length){toast('적용할 클럽을 선택하세요','info');return;}

  const targets=new Set(checked.map(c=>c.dataset.clubCheck));
  document.querySelectorAll('#clubList [data-club-region]').forEach(input=>{
    if(targets.has(input.dataset.clubRegion)) input.value=region;
  });
  toast(`${checked.length}개 클럽에 "${region}"을 적용했습니다. 저장 버튼을 눌러 확정하세요.`,'success');
}

function autoFillClubRegionsFromRegistry(){
  let changed=0;
  document.querySelectorAll('#clubList [data-club-region]').forEach(input=>{
    if((input.value||'').trim()) return;
    const club=input.dataset.clubRegion||'';
    const inferred=inferClubRegionFromMembers(CLUB_MGR_MEMBERS_CACHE,club,normalizeClub);
    if(inferred.region){
      input.value=normalizeRegionLabel(inferred.region);
      changed++;
    }
  });
  toast(changed?`${changed}개 클럽을 명단 기준으로 자동 채웠습니다. 저장 버튼을 눌러 확정하세요.`:'자동 채울 클럽이 없습니다',changed?'success':'info');
}

async function saveClubManagerDetails(){
  if(!AD){toast('관리자 로그인 필요','info');return;}
  const phoneInputs=[...document.querySelectorAll('#clubList [data-club-phone]')];
  const regionInputs=[...document.querySelectorAll('#clubList [data-club-region]')];

  phoneInputs.forEach(input=>{
    const club=(input.dataset.clubPhone||'').trim();
    const phone=(input.value||'').trim();
    if(club) saveClubContact(G.meta,club,phone,{setPasswordIfMissing:true});
  });
  regionInputs.forEach(input=>{
    const club=(input.dataset.clubRegion||'').trim();
    const region=normalizeRegionLabel(input.value||'');
    if(club) setClubDefaultRegion(G.meta,club,region);
  });

  sl(true);
  try{
    await saveMeta();
    sl(false);
    toast('클럽 연락처·기본 소속코트 저장 완료되었습니다.','success');
    populateClubMgrRegionFilter();
    renderCL();
  }catch(e){
    sl(false);
    toast('저장 실패: '+e.message,'error');
  }
}

async function addClub(){const v=ge('newClubInput').value.trim();if(!v){toast('클럽명 입력','error');return;}if(G.clubs.includes(v)){toast('이미 있는 클럽','error');return;}G.clubs.push(v);await saveMeta();renderCL();popSel();popCF();ge('newClubInput').value='';toast(v+' 추가됨','success');}
async function delClub(i){if(!confirm('삭제?'))return;G.clubs.splice(i,1);await saveMeta();renderCL();popSel();}
function normalizeThirdPlaceMode(mode, teamCount){
  return (Number(teamCount||0) < 10 && mode==='match') ? 'match' : 'shared';
}
function getDivisionTeamCount(tid,div){
  return (G.teams?.[tid+'_'+div]||[]).length;
}
function getThirdPlaceModeByKey(key){
  const [tid,div]=String(key||'').split('_');
  const t=G.tournaments.find(x=>x.id===tid);
  const cnt=getDivisionTeamCount(tid,div);
  const raw=t?.divSettings?.[div]?.thirdPlaceMode||'shared';
  return normalizeThirdPlaceMode(raw,cnt);
}
function getMainOnlyMatches(list){
  return (Array.isArray(list)?list:[]).filter(m=>m && m.phase==='main');
}
function getBronzeMatch(key){
  return (G.matches[key]||[]).find(m=>m && (m.phase==='bronze' || m.isThirdPlaceMatch)) || null;
}
function getMainFinalMatch(mMs){
  const list=getMainOnlyMatches(mMs).filter(m=>!m.bye);
  if(!list.length) return null;
  const finalRound=Math.max(...list.map(m=>Number(m.round||0)));
  return list.filter(m=>Number(m.round||0)===finalRound).sort((a,b)=>(Number(a.slot||0)-Number(b.slot||0))||String(a.id||'').localeCompare(String(b.id||''),'ko'))[0] || null;
}
function getSharedThirdTeamIndexes(key,teams,mMs){
  const allMain=getMainOnlyMatches(mMs);
  const list=allMain.filter(m=>m && !m.bye && m.winner!=null);
  if(!list.length) return [];
  // finalRound는 bye 포함 전체 main 경기 기준으로 계산 (부전승이 있어도 올바른 라운드 파악)
  const finalMatchForRound=getMainFinalMatch(allMain);
  if(!finalMatchForRound) return [];
  const finalRound=Number(finalMatchForRound.round||0);
  const semiRound=finalRound-1;
  const picked=[];
  const added=new Set();
  const pushLoser=(m)=>{
    if(!m || m.winner==null) return;
    const loser=(m.winner===m.t1)?m.t2:((m.winner===m.t2)?m.t1:null);
    if(loser==null || added.has(loser) || !teams?.[loser]) return;
    added.add(loser);
    picked.push(loser);
  };

  // 1) 원칙: 결승 바로 이전 라운드(준결승) 패자 2팀만 3위 후보로 잡는다.
  list.filter(m=>Number(m.round||0)===semiRound)
    .sort((a,b)=>(Number(a.slot||0)-Number(b.slot||0))||String(a.id||'').localeCompare(String(b.id||''),'ko'))
    .forEach(pushLoser);

  // 2) 예외적으로 준결승 기록이 덜 갖춰진 오래된 데이터만 하위 라운드로 보조한다.
  if(picked.length<2){
    list.filter(m=>Number(m.round||0)<semiRound)
      .sort((a,b)=>{
        const rd=Number(b.round||0)-Number(a.round||0);
        if(rd) return rd;
        return (Number(a.slot||0)-Number(b.slot||0))||String(a.id||'').localeCompare(String(b.id||''),'ko');
      })
      .forEach(pushLoser);
  }
  return picked.slice(0,2);
}
function ensureBronzeMatchForKey(key, persist=false){
  const [tid,div]=String(key||'').split('_');
  const t=G.tournaments.find(x=>x.id===tid);
  if(!t) return null;
  const cfg=gDS(t,div);
  const list=(G.matches[key]||[]);
  const mainList=getMainOnlyMatches(list);
  let bronze=getBronzeMatch(key);
  if(cfg.format==='roundrobin' || cfg.thirdPlaceMode!=='match' || getDivisionTeamCount(tid,div)>=10 || !mainList.length){
    return bronze || null;
  }
  const finalMatch=getMainFinalMatch(mainList);
  if(!finalMatch) return bronze || null;
  const finalRound=Number(finalMatch.round||0);
  if(finalRound<=0) return bronze || null;
  // 준결승(결승 직전 라운드) 경기가 모두 완료된 경우에만 3위전 팀을 배정한다.
  // 준결승 완료 전에 배정하면 엉뚱한 팀이 Firestore에 저장되어 굳어버리는 버그 방지.
  const semiRound=finalRound-1;
  // 부전승(bye)도 준결승 경기로 포함하여 완료 여부 판단
  const semiMatches=mainList.filter(m=>Number(m.round||0)===semiRound);
  const semiAllDone=semiMatches.length>0 && semiMatches.every(m=>m.winner!=null);
  const cands=semiAllDone ? getSharedThirdTeamIndexes(key,G.teams[key]||[],mainList) : [];
  let changed=false;
  if(!bronze){
    bronze={id:'bronze_match',phase:'bronze',isThirdPlaceMatch:true,round:finalRound,slot:999,t1:null,t2:null,winner:null,rubbers:[],court:'',courts:[]};
    list.push(bronze);
    changed=true;
  }
  const nt1=cands[0] ?? null;
  const nt2=cands[1] ?? null;
  if(bronze.t1!==nt1 || bronze.t2!==nt2){
    bronze.t1=nt1; bronze.t2=nt2;
    bronze.winner=null; bronze.rubbers=[]; bronze.score1=null; bronze.score2=null; bronze.court=''; bronze.courts=[];
    changed=true;
  }
  if(persist && changed) return stM(key).then(()=>bronze).catch(()=>bronze);
  return bronze;
}
async function resetBronzeTeams(key){
  if(!AD){ toast('관리자만 사용 가능합니다','error'); return; }
  const [tid,div]=String(key||'').split('_');
  const t=G.tournaments.find(x=>x.id===tid);
  if(!t){ toast('대회 정보 없음','error'); return; }
  const mainList=getMainOnlyMatches(G.matches[key]||[]);
  const finalMatch=getMainFinalMatch(mainList);
  if(!finalMatch){ toast('본선 경기 정보 없음','error'); return; }
  const finalRound=Number(finalMatch.round||0);
  const semiRound=finalRound-1;
  const semiMatches=mainList.filter(m=>Number(m.round||0)===semiRound);
  if(!semiMatches.every(m=>m.winner!=null)){
    toast('준결승이 아직 완료되지 않았습니다','error'); return;
  }
  const cands=getSharedThirdTeamIndexes(key,G.teams[key]||[],mainList);
  const bronze=getBronzeMatch(key);
  if(!bronze){ toast('3위전 경기 데이터 없음','error'); return; }
  const nt1=cands[0]??null;
  const nt2=cands[1]??null;
  if(bronze.t1===nt1 && bronze.t2===nt2){
    toast('이미 올바른 팀이 배정되어 있습니다','success'); return;
  }
  const t1name=nt1!=null&&G.teams[key]?.[nt1]?tdn(G.teams[key][nt1],key,nt1):'?';
  const t2name=nt2!=null&&G.teams[key]?.[nt2]?tdn(G.teams[key][nt2],key,nt2):'?';
  if(!confirm(`3위전 팀을 준결승 패자(${t1name} vs ${t2name})로 재배정합니다.\n기존 3위전 결과는 초기화됩니다. 계속하시겠습니까?`)) return;
  bronze.t1=nt1; bronze.t2=nt2;
  bronze.winner=null; bronze.rubbers=[]; bronze.score1=null; bronze.score2=null; bronze.court=''; bronze.courts=[];
  sl(true);
  try{
    await stM(key);
    toast(`3위전 팀 재배정 완료: ${t1name} vs ${t2name}`,'success');
    try{ renderBracket(); }catch(e){}
  }catch(e){
    toast('저장 실패: '+e.message,'error');
  }finally{ sl(false); }
}
function gDS(t,div){
  const ds=t?.divSettings?.[div];
  const defDbl=(div==='테린이'||div==='terinee')?3:5;
  const dbl=parseInt(ds?.doublesCount||defDbl);
  const tid=t?.id||'';
  const thirdPlaceMode=normalizeThirdPlaceMode(ds?.thirdPlaceMode||'shared', getDivisionTeamCount(tid,div));
  return{format:ds?.format||t?.format||'group_knockout',grpSize:parseInt(ds?.grpSize||t?.grpSize||4),advance:parseInt(ds?.advance||t?.advance||2),doublesCount:dbl,thirdPlaceMode};
}
function recTemplate(cnt){
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  if(cnt<=0) return {fmt:'group_knockout',gs:3,adv:2,note:'팀 수 입력 필요'};
  if(cnt<=5){
    return {fmt:'roundrobin', gs: clamp(cnt,3,5), adv:1, note:'5팀 이하: 풀리그 추천'};
  }
  let gs = (cnt<=7)?3 : (cnt<=12)?4 : 5;
  let adv = 2;
  return {fmt:'group_knockout', gs, adv, note:`${cnt}팀: 예선 조별 + 본선 토너 추천`};
}
function applyRec(tid,div){
  const t=G.tournaments.find(t=>t.id===tid); if(!t) return;
  const key=tid+'_'+div;
  const cnt=(G.teams[key]||[]).length;
  const rec=recTemplate(cnt);
  const fe=ge(`dF_${tid}_${div}`), gee=ge(`dG_${tid}_${div}`), ae=ge(`dA_${tid}_${div}`);
  const cFmt=ge(`cFmt_${tid}_${div}`), cGs=ge(`cGs_${tid}_${div}`), cAdv=ge(`cAdv_${tid}_${div}`);
  const doFmt = cFmt ? cFmt.checked : true;
  const doGs  = cGs  ? cGs.checked  : true;
  const doAdv = cAdv ? cAdv.checked : true;

  if(doFmt && fe) fe.value=rec.fmt;
  if(doGs  && gee) gee.value=String(rec.gs);
  if(doAdv && ae) ae.value=String(rec.adv);

  toast(`${dl(div)} 추천 적용 · ${rec.note}`,'success');
}
async function saveDivS
(tid){const t=G.tournaments.find(t=>t.id===tid);if(!t || !assertTournamentManagePermission(t,'부서 설정 저장'))return;const ds={...(t.divSettings||{})};(t.divisions||[]).forEach(div=>{const fe=ge(`dF_${tid}_${div}`),ge2=ge(`dG_${tid}_${div}`),ae=ge(`dA_${tid}_${div}`),tp=ge(`dTP_${tid}_${div}`);const c=gDS(t,div);const nextMode=normalizeThirdPlaceMode(tp?tp.value:c.thirdPlaceMode,getDivisionTeamCount(tid,div));ds[div]={...(ds[div]||{}),format:fe?fe.value:c.format,grpSize:ge2?parseInt(ge2.value):c.grpSize,advance:ae?parseInt(ae.value):c.advance,doublesCount:Number(ds[div]?.doublesCount||c.doublesCount||((div==='테린이'||div==='terinee')?3:5)),maxTeams:parseInt(ds[div]?.maxTeams||0)||0,thirdPlaceMode:nextMode};});sl(true);try{await updateDoc(doc(db,'tournaments',tid),{divSettings:ds});const idx=G.tournaments.findIndex(x=>x.id===tid);if(idx>=0) G.tournaments[idx].divSettings=ds;for(const div of (t.divisions||[])){await ensureBronzeMatchForKey(tid+'_'+div,true);}await fbLog(`설정 변경: ${t.name}`,'⚙️');sl(false);toast('저장 완료','success');try{renderBracket();}catch(e){}}catch(e){sl(false);toast('저장 실패','error');}}

function goBracket(tid,div){
  showPage('bracket');
  const brTS=ge('brTS');if(!brTS)return;
  brTS.value=tid;onBrTC();
  setTimeout(()=>{ setBracketSelectedDivs([div], tid); renderBracket(); },100);
}

function divisionBannerClass(div){
  if(div==='금' || div==='gold') return 'op-banner-gold';
  if(div==='은' || div==='silver') return 'op-banner-silver';
  if(div==='동' || div==='bronze') return 'op-banner-bronze';
  if(div==='테린이' || div==='terinee') return 'op-banner-green';
  return 'op-banner-blue';
}
function divisionHeaderClass(div){
  if(div==='금' || div==='gold') return 'op-gold';
  if(div==='은' || div==='silver') return 'op-silver';
  if(div==='동' || div==='bronze') return 'op-bronze';
  if(div==='테린이' || div==='terinee') return 'op-green';
  return 'op-blue';
}
function renderOperationDivisionBanner(tid,div,key,teams){
  const t=G.tournaments.find(x=>x.id===tid);
  const allMs=G.matches[key]||[];
  const total=allMs.length;
  const done=allMs.filter(m=>getMatchResultState(key,m).done).length;
  const playing=allMs.filter(m=>!getMatchResultState(key,m).done && getMatchResultState(key,m).started).length;
  const remain=Math.max(0,total-done);
  const label=dl(div).replace(/^[^\s]+\s*/,'').trim()||dl(div);
  const stats=`${teams.length}팀 · 완료 ${done}/${total} · 진행 ${playing} · 잔여 ${remain}`;
  return `<div class="op-div-marker ${divisionBannerClass(div)}" data-op-label="${esc(label)}" data-op-stats="${esc(stats)}" data-op-sub="${esc(t?.name||'')}" aria-hidden="true"></div>`;
}
function renderFinalSummaryCard(label,items){
  return `<div class="card" style="margin-bottom:12px"><div class="card-title">🏅 ${label} 최종 결과 요약</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">${items.map(it=>`<div style="padding:14px 12px;border-radius:14px;background:${it.bg};border:1.5px solid ${it.border};text-align:center"><div style="font-size:1.35rem;margin-bottom:6px">${it.emoji}</div><div style="font-size:.78rem;color:var(--text2);font-weight:700;margin-bottom:4px">${it.title}</div><div style="font-size:1rem;font-weight:900;line-height:1.35">${it.value||'-'}</div></div>`).join('')}</div></div>`;
}
function getMainMedalSummary(key,teams,mMs){
  const mainList=getMainOnlyMatches(mMs);
  if(!mainList.length) return null;
  const finalMatch=getMainFinalMatch(mainList);
  if(!finalMatch || finalMatch.winner==null) return null;
  const champion=teams[finalMatch.winner]?tdn(teams[finalMatch.winner],key,finalMatch.winner):'';
  const runnerIdx=finalMatch.winner===finalMatch.t1?finalMatch.t2:finalMatch.t1;
  const runner=teams[runnerIdx]?tdn(teams[runnerIdx],key,runnerIdx):'';
  const bronzeMode=getThirdPlaceModeByKey(key);
  const bronzeMatch=getBronzeMatch(key);
  const sharedThirds=getSharedThirdTeamIndexes(key,teams,mainList).map(idx=>teams[idx]?tdn(teams[idx],key,idx):'').filter(Boolean);
  if(bronzeMode==='match' && bronzeMatch && bronzeMatch.winner!=null && !bronzeMatch.bye){
    const fourthIdx=bronzeMatch.winner===bronzeMatch.t1?bronzeMatch.t2:bronzeMatch.t1;
    return {champion,runner,thirdLabel:'3위',thirds:[teams[bronzeMatch.winner]?tdn(teams[bronzeMatch.winner],key,bronzeMatch.winner):''].filter(Boolean),fourth:teams[fourthIdx]?tdn(teams[fourthIdx],key,fourthIdx):''};
  }
  return {champion,runner,thirdLabel:'공동 3위',thirds:[...new Set(sharedThirds)],fourth:''};
}

function dl(d){return{'금':'🥇 금배부','은':'🥈 은배부','동':'🥉 동배부','테린이':'🌱 테린이부','여성부':'👩 여성부','직장부':'🏢 직장부','시니어부':'🎖 시니어부','gold':'🥇 금배부','silver':'🥈 은배부','bronze':'🥉 동배부','terinee':'🌱 테린이부','women':'👩 여성부'}[d]||d;}
function dc(d){return{'금':'gold','은':'silver','동':'bronze','테린이':'blue','여성부':'purple','gold':'gold','silver':'silver','bronze':'bronze','terinee':'blue','women':'purple'}[d]||'purple';}
function randInt(max){
  max = Math.floor(max||0);
  if(max<=0) return 0;
  const c = (window.crypto||window.msCrypto);
  if(c && c.getRandomValues){
    const u = new Uint32Array(1);
    const limit = Math.floor(0xFFFFFFFF / max) * max;
    let x = 0;
    do{ c.getRandomValues(u); x = u[0]; }while(x>=limit);
    return x % max;
  }
  return Math.floor(Math.random()*max);
}
function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j=randInt(i+1);
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function np2(n){let p=1;while(p<n)p*=2;return p;}
function ago(iso){const d=Date.now()-new Date(iso).getTime(),m=Math.floor(d/60000);if(m<1)return'방금';if(m<60)return m+'분 전';const h=Math.floor(m/60);if(h<24)return h+'시간 전';return Math.floor(h/24)+'일 전';}
function ge(id){return document.getElementById(id);}
window.faqShowTab=function(n){
  [1,2,3].forEach(i=>{
    const tab=document.getElementById('faqTab'+i);
    const cont=document.getElementById('faqTabC'+i);
    if(!tab||!cont) return;
    const colors=['#2e7d32','#1565c0','#b45309'];
    if(i===n){
      tab.style.color=colors[i-1]; tab.style.borderBottomColor=colors[i-1]; tab.style.fontWeight='800';
      cont.style.display='flex';
    } else {
      tab.style.color='#888'; tab.style.borderBottomColor='transparent'; tab.style.fontWeight='700';
      cont.style.display='none';
    }
  });
};
window.opShowTab=function(n){
  [1,2,3].forEach(i=>{
    const tab=document.getElementById('opTab'+i);
    const cont=document.getElementById('opTabC'+i);
    if(!tab||!cont) return;
    if(i===n){
      tab.style.color='#1565c0'; tab.style.borderBottomColor='#1565c0'; tab.style.fontWeight='800';
      cont.style.display='';
    } else {
      tab.style.color='#888'; tab.style.borderBottomColor='transparent'; tab.style.fontWeight='700';
      cont.style.display='none';
    }
  });
};
window.mShowTab=function(n){
  [1,2,3].forEach(i=>{
    const tab=document.getElementById('mTab'+i);
    const cont=document.getElementById('mTabC'+i);
    if(!tab||!cont) return;
    if(i===n){
      tab.style.color='#2e7d32'; tab.style.borderBottomColor='#2e7d32'; tab.style.fontWeight='800';
      cont.style.display='';
    } else {
      tab.style.color='#888'; tab.style.borderBottomColor='transparent'; tab.style.fontWeight='700';
      cont.style.display='none';
    }
  });
};
function om(id){document.getElementById(id)?.classList.add('open');}
function cm(id){const el=document.getElementById(id);if(!el)return;el.classList.remove('open');const box=el.querySelector('.modal-box');if(box)box.classList.remove('fullscreen');el.querySelectorAll('.modal-close[title="전체화면"]').forEach(b=>b.textContent='⛶');}
function toggleModalFullscreen(id,btn){const overlay=document.getElementById(id);if(!overlay)return;const box=overlay.querySelector('.modal-box');if(!box)return;const isFull=box.classList.toggle('fullscreen');if(btn)btn.textContent=isFull?'🗗':'⛶';}
function setModalFullscreenState(id,on=true){const overlay=document.getElementById(id);if(!overlay)return;const box=overlay.querySelector('.modal-box');if(!box)return;box.classList.toggle('fullscreen',!!on);overlay.querySelectorAll('.modal-close[title="전체화면"]').forEach(b=>b.textContent=on?'🗗':'⛶');}

function buildMatchAlertStateMap(matchesObj){
  const map={};
  try{
    Object.entries(matchesObj||{}).forEach(([key,list])=>{
      (list||[]).forEach(m=>{
        if(!m) return;
        const mid=m._id||m.id;
        if(!mid) return;
        const subs=(m&&typeof m.orderSubmissions==='object'&&m.orderSubmissions)?m.orderSubmissions:{};
        const bases=getMatchBaseClubs(key,m);
        const c1=bases.c1||'';
        const c2=bases.c2||'';
        map[mid]={
          key,
          tid:(m.tournamentId||key.split('_').slice(0,-1).join('_')||''),
          div:(m.division||key.split('_').slice(-1)[0]||''),
          id:(m.id||mid),
          c1,c2,
          s1:!!(c1&&subs[c1]),
          s2:!!(c2&&subs[c2]),
          both:!!(c1&&c2&&subs[c1]&&subs[c2]),
          t1:m.t1,
          t2:m.t2
        };
      });
    });
  }catch(e){ console.warn('buildMatchAlertStateMap failed', e); }
  return map;
}
function isDivisionSelectedForAlert(tid, div){
  const selectedTid=ge('brTS')?.value||'';
  if(!selectedTid || selectedTid!==tid) return false;
  const selectedDivs=getBracketSelectedDivs(tid)||[];
  return selectedDivs.includes(div);
}
function buildOrderAlertMessageForViewer(key,m,submittedSide){
  const teams=G.teams[key]||[];
  const home=teams[m.t1]??teams.find(t=>t&&((t.id!=null&&t.id===m.t1)||(t.name&&t.name===m.t1)));
  const away=teams[m.t2]??teams.find(t=>t&&((t.id!=null&&t.id===m.t2)||(t.name&&t.name===m.t2)));
  const homeName=tdn(home,key,m.t1)||home?.club||'홈팀';
  const awayName=tdn(away,key,m.t2)||away?.club||'원정팀';
  const submitTeamName=submittedSide===1?homeName:awayName;
  const matchLabel=`${dl(m.division||key.split('_').slice(-1)[0]||'')} · ${homeName} vs ${awayName}`;
  if(REG && REG_CLUB){
    return `상대팀 ${submitTeamName} 오더 제출 · ${matchLabel}`;
  }
  return `${submitTeamName} 오더 제출 · ${matchLabel}`;
}
function shouldNotifyForOrderAlert(prevState,nextState,submittedSide){
  if(!nextState || !submittedSide) return false;
  // 로그인한 사용자라면 어느 탭에서든 알람 수신
  if(!(AD||OP||REG)) return false;
  if(REG && REG_CLUB){
    const myBase=baseClub(REG_CLUB)||REG_CLUB;
    const isMine=(submittedSide===1?(nextState.c1===myBase):(nextState.c2===myBase));
    if(isMine) return false;
    const involved = nextState.c1===myBase || nextState.c2===myBase;
    if(!involved) return false;
  }
  return true;
}
function processOnlineOrderAlerts(prevMap,newMatchesObj){
  const nextMap=buildMatchAlertStateMap(newMatchesObj||{});
  Object.entries(nextMap).forEach(([mid,nextState])=>{
    const prevState=prevMap[mid];
    if(!prevState) return;
    const side1Changed=!prevState.s1 && !!nextState.s1;
    const side2Changed=!prevState.s2 && !!nextState.s2;
    if(side1Changed && shouldNotifyForOrderAlert(prevState,nextState,1)){
      enqueueStickyAlert({
        msg:buildOrderAlertMessageForViewer(nextState.key,{t1:nextState.t1,t2:nextState.t2,division:nextState.div},1),
        type:'info', tid:nextState.tid, div:nextState.div, matchId:mid
      });
    }
    if(side2Changed && shouldNotifyForOrderAlert(prevState,nextState,2)){
      enqueueStickyAlert({
        msg:buildOrderAlertMessageForViewer(nextState.key,{t1:nextState.t1,t2:nextState.t2,division:nextState.div},2),
        type:'info', tid:nextState.tid, div:nextState.div, matchId:mid
      });
    }
  });
}
const STICKY_ALERT_QUEUE=[];
let STICKY_ALERT_OPEN=false;
let STICKY_ALERT_TIMER=null;
function isPersistentOrderAlertMessage(msg='',type='info'){
  const s=String(msg||'');
  if(type!=='info') return false;
  if(/상대.{0,18}제출/.test(s)) return true;
  if(/양팀.{0,10}(완료|공개)/.test(s)) return true;
  if(/오더.{0,18}(도착|확인|알림)/.test(s)) return true;
  return false;
}
function closeStickyAlert(showNext=true){
  const wrap=ge('stickyAlertWrap');
  if(!wrap) return;
  if(STICKY_ALERT_TIMER){ clearTimeout(STICKY_ALERT_TIMER); STICKY_ALERT_TIMER=null; }
  wrap.classList.remove('show','left-side');
  wrap.innerHTML='';
  wrap.removeAttribute('data-msg');
  wrap.removeAttribute('data-mid');
  wrap.removeAttribute('data-tid');
  wrap.removeAttribute('data-div');
  wrap.removeAttribute('data-side');
  wrap.removeAttribute('data-action-type');
  wrap.removeAttribute('data-sms-body');
  wrap.removeAttribute('data-sms-recipients');
  wrap.removeAttribute('data-dedupe-key');
  STICKY_ALERT_OPEN=false;
  if(showNext && STICKY_ALERT_QUEUE.length){
    setTimeout(renderNextStickyAlert,120);
  }
}
function goToStickyAlertMatch(){
  const wrap=ge('stickyAlertWrap');
  if(!wrap) return;
  const tid=wrap.getAttribute('data-tid')||'';
  const div=wrap.getAttribute('data-div')||'';
  const mid=wrap.getAttribute('data-mid')||'';
  closeStickyAlert(true);
  if(tid && div && mid && typeof goBracketMatch==='function'){
    setTimeout(()=>goBracketMatch(tid,div,mid),120);
  }
}
function renderNextStickyAlert(){
  const wrap=ge('stickyAlertWrap');
  if(!wrap || STICKY_ALERT_OPEN) return;
  const item=STICKY_ALERT_QUEUE.shift();
  if(!item) return;
  STICKY_ALERT_OPEN=true;
  const alertTitle = item.title || (item.kind==='court_complete' ? '🎾 코트 완료 알림' : '🔔 오더 제출 알림');
  const hasSmsRecipients = Array.isArray(item.smsRecipients) && item.smsRecipients.length>0;
  const canApproveSms = item.actionType==='sms_approval' && (AD||OP);
  const actions = canApproveSms
    ? `${hasSmsRecipients?`<button type="button" class="sticky-alert-btn primary" onclick="window.sendStickyAlertSMS()">문자 보내기</button>`:`<button type="button" class="sticky-alert-btn secondary" onclick="window.closeStickyAlert()">번호 없음</button>`}<button type="button" class="sticky-alert-btn secondary" onclick="window.closeStickyAlert()">닫기</button>`
    : `<button type="button" class="sticky-alert-btn secondary" onclick="window.closeStickyAlert()">${item.actionType==='sms_approval'?'확인':'확인'}</button>`;
  wrap.innerHTML=`<div class="sticky-alert-card">
    <div class="sticky-alert-title">${esc(alertTitle)}</div>
    <div class="sticky-alert-msg">${esc(item.msg||'')}</div>
    <div class="sticky-alert-actions">${actions}</div>
  </div>`;
  wrap.setAttribute('data-msg', String(item.msg||'').trim());
  if(item.matchId) wrap.setAttribute('data-mid', String(item.matchId));
  if(item.tid) wrap.setAttribute('data-tid', String(item.tid));
  if(item.div) wrap.setAttribute('data-div', String(item.div));
  if(item.actionType) wrap.setAttribute('data-action-type', String(item.actionType));
  else wrap.removeAttribute('data-action-type');
  if(item.smsBody) wrap.setAttribute('data-sms-body', String(item.smsBody));
  else wrap.removeAttribute('data-sms-body');
  if(item.smsRecipients) wrap.setAttribute('data-sms-recipients', JSON.stringify(item.smsRecipients));
  else wrap.removeAttribute('data-sms-recipients');
  if(item.dedupeKey) wrap.setAttribute('data-dedupe-key', String(item.dedupeKey));
  else wrap.removeAttribute('data-dedupe-key');
  if(item.side==='left'){
    wrap.classList.add('left-side');
    wrap.setAttribute('data-side','left');
  }else{
    wrap.classList.remove('left-side');
    wrap.removeAttribute('data-side');
  }
  wrap.classList.add('show');
  if(Number(item.autoCloseMs||0)>0){
    STICKY_ALERT_TIMER=setTimeout(()=>window.closeStickyAlert(true), Number(item.autoCloseMs||0));
  }else{
    STICKY_ALERT_TIMER=null;
  }
}
window.closeStickyAlert = closeStickyAlert;
window.goToStickyAlertMatch = goToStickyAlertMatch;
window.resetBronzeTeams = resetBronzeTeams;
window.openIndividualDraw = openIndividualDraw;
window.selectIndivGrpSize = selectIndivGrpSize;
window.startIndividualDraw = startIndividualDraw;
window.openIndividualMainDraw = openIndividualMainDraw;

function enqueueStickyAlert(payload,type='info'){
  const item=(payload && typeof payload==='object' && !Array.isArray(payload))
    ? {msg:String(payload.msg||'').trim(), type:payload.type||type, tid:payload.tid||'', div:payload.div||'', matchId:payload.matchId||payload.mid||'', title:String(payload.title||''), kind:String(payload.kind||''), actionType:String(payload.actionType||''), smsRecipients:Array.isArray(payload.smsRecipients)?payload.smsRecipients:[], smsBody:String(payload.smsBody||''), dedupeKey:String(payload.dedupeKey||''), side:String(payload.side||''), autoCloseMs:Number(payload.autoCloseMs||0)||0}
    : {msg:String(payload||'').trim(), type, tid:'', div:'', matchId:'', title:'', kind:'', actionType:'', smsRecipients:[], smsBody:'', dedupeKey:'', side:'', autoCloseMs:0};
  const key=item.dedupeKey || item.msg;
  if(!key) return;
  const wrap=ge('stickyAlertWrap');
  const current=(wrap ? (wrap.getAttribute('data-dedupe-key')||wrap.getAttribute('data-msg')||'') : '');
  if(current===key) return;
  if(STICKY_ALERT_QUEUE.some(x=>x&&((x.dedupeKey||x.msg)===key))) return;
  STICKY_ALERT_QUEUE.push(item);
  renderNextStickyAlert();
}
function toast(msg,type='info'){
  if(isPersistentOrderAlertMessage(msg,type)){
    enqueueStickyAlert({msg,type});
    return;
  }
  const c=ge('TC');
  const el=document.createElement('div');
  el.className='toast '+type;
  el.innerHTML=`${type==='success'?'✅':type==='error'?'❌':'ℹ️'} ${msg}`;
  c.appendChild(el);
  setTimeout(()=>{el.style.cssText='opacity:0;transform:translateX(30px);transition:all .3s';setTimeout(()=>el.remove(),300)},3000);
}


window.addEventListener('scroll',()=>ge('stBtn').classList.toggle('show',window.scrollY>300));
document.querySelectorAll('.modal-overlay').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)el.classList.remove('open');}));


// ═══════════════════════════════════════════════════════
//  백업 / 복구 / 내보내기
// ═══════════════════════════════════════════════════════

function backupJSON(){
  const data={
    version:2,
    exportDate:new Date().toISOString(),
    tournaments:G.tournaments,
    teams:G.teams,
    draws:G.draws,
    matches:G.matches,
    players:G.players,
    clubs:G.clubs
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  const d=new Date().toISOString().substring(0,10);
  a.download=`김해테니스협회_백업_${d}.json`;
  a.click();
  ge('backupStatus').textContent='✅ 백업 파일 다운로드 완료!';
  toast('백업 완료 💾','success');
}

async function restoreFromJSON(input){
  const file=input.files[0];if(!file)return;
  const text=await file.text();
  let data;
  try{data=JSON.parse(text);}catch(e){toast('파일 형식 오류','error');return;}
  if(!confirm('선택한 JSON으로 데이터를 복구하시겠습니까?\n⚠️ 기존 데이터는 덮어쓰여집니다.'))return;
  sl(true);
  try{
    // 선수 데이터 복구
    if(data.players){
      for(const [name,p] of Object.entries(data.players)){
        await setDoc(doc(db,'players',name.replace(/[\/\.#\$\[\]]/g,'_')),{...p,name});
      }
    }
    sl(false);
    ge('backupStatus').textContent='✅ 복구 완료! 잠시 후 데이터가 갱신됩니다.';
    toast('복구 완료 ✅','success');
    await fbLog('JSON 복구 실행','📥');
  }catch(e){sl(false);toast('복구 실패: '+e.message,'error');}
  input.value='';
}

function exportPlayersCSV(){
  const rows=[['이름','소속','총참가','금배참가','은배참가','동배참가','테린이참가','팀승','팀패','승률','최고순위']];
  // Firebase 선수
  const fbNames=new Set(Object.keys(G.players));
  const histNames=new Set();
  HIST_DATA.forEach(t=>t.teams.forEach(tm=>(tm.players||[]).forEach(pn=>{if(pn&&pn.trim())histNames.add(pn.trim());})));
  const allNames=[...new Set([...fbNames,...histNames])].sort();

  allNames.forEach(name=>{
    const p=G.players[name]||{clubs:[],history:[],wins:0,losses:0};
    const histRecs=[];
    HIST_DATA.forEach(t=>t.teams.forEach(tm=>{
      if((tm.players||[]).some(pn=>pn===name))histRecs.push({div:tm.div,rank:tm.rank,club:tm.club});
    }));
    const allClubs=[...new Set([...(p.clubs||[]),...histRecs.map(r=>r.club)])];
    const dCnt={'금':0,'은':0,'동':0,'테린이':0};
    (p.history||[]).forEach(h=>{if(dCnt[h.div]!==undefined)dCnt[h.div]++;});
    histRecs.forEach(r=>{if(dCnt[r.div]!==undefined)dCnt[r.div]++;});
    const total=(p.history||[]).length+histRecs.length;
    const wr=p.wins+p.losses>0?Math.round(p.wins/(p.wins+p.losses)*100):0;
    let bestRank=null;
    (p.history||[]).forEach(h=>{if(h.rank&&(!bestRank||h.rank<bestRank))bestRank=h.rank;});
    histRecs.forEach(r=>{if(r.rank&&(!bestRank||r.rank<bestRank))bestRank=r.rank;});
    rows.push([name,allClubs.join('/'),total,dCnt['금'],dCnt['은'],dCnt['동'],dCnt['테린이'],p.wins||0,p.losses||0,wr+'%',bestRank?bestRank+'위':'-']);
  });
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const BOM='\uFEFF';
  const blob=new Blob([BOM+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`김해테니스협회_선수기록_${new Date().toISOString().substring(0,10)}.csv`;
  a.click();toast('CSV 저장 완료 📄','success');
}

function exportPlayersExcel(){
  // SheetJS-like 간단 xlsx via CSV with UTF-8 BOM (opens in Excel)
  exportPlayersCSV();
  // 추가 안내
  setTimeout(()=>toast('CSV 파일을 Excel에서 열 수 있습니다','info'),1200);
}

function backupPlayersExcel(){
  exportPlayersCSV();
}

// ─── 대진표 이미지/PDF 저장 ─────────────────────────────
async function bracketToImage(){
  const el=ge('bracketContent');
  if(!el||!el.querySelector('.t-bracket,.grp-card,.grp-block,.m3card')){toast('대진표를 먼저 불러오세요','info');return;}
  toast('이미지 생성 중...','info');
  try{
    if(!window.html2canvas){
      await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload=res;s.onerror=rej;document.head.appendChild(s);
      });
    }
    const canvas=await html2canvas(el,{scale:3,backgroundColor:'#f0f4fa',useCORS:true,logging:false,windowWidth:Math.max(document.documentElement.clientWidth, el.scrollWidth || 0)});
    const a=document.createElement('a');
    a.href=canvas.toDataURL('image/png');
    a.download=`대진표_${new Date().toISOString().substring(0,10)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('이미지 저장 완료 🖼️','success');
  }catch(e){
    console.error(e);
    toast('이미지 저장 실패: '+e.message,'error');
  }
}

async function bracketToPDF(){
  const el=ge('bracketContent');
  if(!el||!el.querySelector('.t-bracket,.grp-card')){toast('대진표를 먼저 불러오세요','info');return;}
  toast('PDF 생성 중...','info');
  try{
    if(!window.html2canvas){
      await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload=res;s.onerror=rej;document.head.appendChild(s);
      });
    }
    if(!window.jspdf){
      await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload=res;s.onerror=rej;document.head.appendChild(s);
      });
    }
    const canvas=await html2canvas(el,{scale:3,backgroundColor:'#f0f4fa',useCORS:true,logging:false});
    const imgData=canvas.toDataURL('image/png');
    const {jsPDF}=window.jspdf;
    const isLandscape=canvas.width>canvas.height;
    const pdf=new jsPDF({orientation:isLandscape?'landscape':'portrait',unit:'mm',format:'a4'});
    const pageW=pdf.internal.pageSize.getWidth();
    const pageH=pdf.internal.pageSize.getHeight();
    const margin=6;
    const imgW=pageW-margin*2;
    const imgH=canvas.height*imgW/canvas.width;
    if(imgH<=pageH-margin*2){
      pdf.addImage(imgData,'PNG',margin,margin,imgW,imgH);
    }else{
      let remaining=imgH,position=0;
      pdf.addImage(imgData,'PNG',margin,margin+position,imgW,imgH);
      remaining-=(pageH-margin*2);
      while(remaining>0){position-=(pageH-margin*2);pdf.addPage();pdf.addImage(imgData,'PNG',margin,margin+position,imgW,imgH);remaining-=(pageH-margin*2);}
    }
    pdf.save(`대진표_${new Date().toISOString().substring(0,10)}.pdf`);
    toast('PDF 저장 완료 📄','success');
  }catch(e){toast('PDF 저장 실패: '+e.message,'error');}
}

// ── 팀 등록 명단 내보내기 (로그인 불필요) ────────────────────────────────
async function _buildRegListEl44(){
  const tid=ge('regTS')?.value||'';
  const selDiv=ge('regDS')?.value||'';
  const t=G.tournaments.find(x=>x.id===tid);
  if(!t){toast('대회를 먼저 선택해 주세요','info');return null;}
  const allDivs=[...(t.divisions||[])].sort((a,b)=>divOrder44(a)-divOrder44(b));
  const targetDivs=(selDiv&&allDivs.includes(selDiv))?[selDiv]:allDivs;
  const wrap=document.createElement('div');
  wrap.style.cssText='position:fixed;left:-9999px;top:0;width:500px;background:#f0f4fa;padding:16px;font-family:inherit;z-index:-1';
  const tdate=t.date?`📅 ${t.date}`:'';
  const divLabel=selDiv?dl(selDiv):'전체 부서';
  wrap.innerHTML=`<div style="text-align:center;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #3b6fd8">
    <div style="font-size:1.1rem;font-weight:800;color:#0f1e3a">${t.name||'대회'}</div>
    ${tdate?`<div style="font-size:.78rem;color:#555;margin-top:3px">${tdate}</div>`:''}
    <div style="font-size:.82rem;color:#3b6fd8;font-weight:700;margin-top:4px">📋 팀 등록 현황 — ${divLabel}</div>
  </div>`;
  targetDivs.forEach(div=>{
    const key=tid+'_'+div;
    const teams=(G.teams[key]||[]).slice();
    const sorted=teams.map((team,i)=>({team,i})).sort((x,y)=>(x.team.club||'').localeCompare(y.team.club||'','ko'));
    const sec=document.createElement('div');
    sec.style.cssText='margin-bottom:14px';
    let html=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:6px 10px;background:#3b6fd8;border-radius:8px">
      <span style="font-weight:800;color:#fff;font-size:.92rem">${dl(div)}</span>
      <span style="background:rgba(255,255,255,.25);color:#fff;font-size:.72rem;font-weight:700;padding:1px 8px;border-radius:10px">${teams.length}팀</span>
    </div>`;
    if(!sorted.length){
      html+=`<div style="font-size:.78rem;color:#888;padding:4px 6px">등록된 팀 없음</div>`;
    }else{
      // 첫 출전 선수 안내 문구
      html+=`<div style="margin-bottom:8px;padding:5px 10px;background:linear-gradient(135deg,#fff7ed,#fef3c7);border:1.5px solid #f59e0b;border-radius:8px;font-size:.76rem;font-weight:700;color:#92400e">🟠 주황 배경은 이 대회 첫 출전 선수입니다.</div>`;
      sorted.forEach(({team,i})=>{
        const teamName=tdn(team,key,i);
        const players=(team.players||[]).filter(Boolean);
        const dbl=team.doublesCount||5;
        const main=players.slice(0,dbl*2);
        const sub=players.slice(dbl*2);
        html+=`<div style="border:1px solid #d1d9e6;border-radius:10px;overflow:hidden;background:#fff;margin-bottom:8px">
          <div style="background:#0f1e3a;color:#fff;padding:7px 12px;display:flex;align-items:center;justify-content:space-between">
            <span style="font-weight:800;font-size:.88rem">${i+1}. ${teamName}</span>
            <span style="font-size:.72rem;opacity:.82">${players.length}명 / ${dbl}복식</span>
          </div>
          <div style="padding:8px 12px;display:flex;flex-wrap:wrap;gap:4px">
            ${main.map((p,idx)=>{
              const isD=isFirstAppearancePlayer(p,team.club||'',tid);
              return`<span style="background:${isD?'linear-gradient(135deg,#fff7ed,#fef3c7)':'#f0f4fa'};border:${isD?'1.5px solid #f59e0b':'1px solid #cdd5e0'};border-radius:6px;padding:3px 9px;font-size:.82rem;font-weight:${isD?'800':'600'};color:${isD?'#92400e':'inherit'};display:inline-flex;align-items:center;gap:4px"><span style="width:18px;height:18px;background:${isD?'#f59e0b':'#0f1e3a'};color:#fff;border-radius:50%;font-size:.6rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${idx+1}</span>${p}</span>`;
            }).join('')}
            ${sub.map(p=>{
              const isD=isFirstAppearancePlayer(p,team.club||'',tid);
              return`<span style="background:${isD?'linear-gradient(135deg,#fff7ed,#fef3c7)':'#f8f9fa'};border:${isD?'1.5px solid #f59e0b':'1px dashed #b0b8c8'};border-radius:6px;padding:3px 9px;font-size:.78rem;color:${isD?'#92400e':'#666'};font-weight:${isD?'800':'400'}">후보. ${p}</span>`;
            }).join('')}
          </div>
        </div>`;
      });
    }
    sec.innerHTML=html;
    wrap.appendChild(sec);
  });
  const footer=document.createElement('div');
  footer.style.cssText='text-align:right;font-size:.68rem;color:#999;margin-top:8px;border-top:1px solid #dde3ee;padding-top:6px';
  footer.textContent=`출력일시: ${new Date().toLocaleString('ko-KR')}`;
  wrap.appendChild(footer);
  document.body.appendChild(wrap);
  return wrap;
}
function divOrder44(d){return{'금':0,'은':1,'동':2,'테린이':3}[d]??99;}
async function _loadH2c44(){
  if(!window.html2canvas) await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
}
async function saveRegListImage44(){
  const tid=ge('regTS')?.value||'';
  if(!tid){toast('대회를 먼저 선택해 주세요','info');return;}
  try{
    await _loadH2c44();
    toast('이미지 생성 중...','info');
    const wrap=await _buildRegListEl44();if(!wrap)return;
    const selDiv=ge('regDS')?.value||'';
    const t=G.tournaments.find(x=>x.id===tid);
    const divLabel=selDiv?dl(selDiv):'전체';
    const fname=`팀등록명단_${(t?.name||'').replace(/\s/g,'')}_${divLabel}_${new Date().toISOString().substring(0,10)}.png`;
    await new Promise(r=>setTimeout(r,80));
    const canvas=await html2canvas(wrap,{backgroundColor:'#f0f4fa',scale:3,useCORS:true,logging:false});
    document.body.removeChild(wrap);
    const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=fname;a.click();
    toast('이미지 저장 완료 🖼️','success');
  }catch(e){toast('이미지 저장 실패: '+e.message,'error');}
}
async function saveRegListKakao44(){
  const tid=ge('regTS')?.value||'';
  if(!tid){toast('대회를 먼저 선택해 주세요','info');return;}
  try{
    await _loadH2c44();
    toast('카톡용 이미지 생성 중...','info');
    const wrap=await _buildRegListEl44();if(!wrap)return;
    const selDiv=ge('regDS')?.value||'';
    const t=G.tournaments.find(x=>x.id===tid);
    const divLabel=selDiv?dl(selDiv):'전체';
    const fname=`카톡_팀등록명단_${(t?.name||'').replace(/\s/g,'')}_${divLabel}_${new Date().toISOString().substring(0,10)}.png`;
    await new Promise(r=>setTimeout(r,80));
    const canvas=await html2canvas(wrap,{backgroundColor:'#f0f4fa',scale:3,useCORS:true,logging:false});
    document.body.removeChild(wrap);
    const isMobile=/Android|iPhone|iPad/i.test(navigator.userAgent);
    if(isMobile&&navigator.share){
      canvas.toBlob(async(blob)=>{
        try{const file=new File([blob],fname,{type:'image/png'});await navigator.share({files:[file],title:fname});toast('카카오톡 공유창을 열었습니다.','success');}
        catch(err){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fname;a.click();toast('이미지 저장됨 — 카카오톡에서 직접 공유하세요','info');}
      },'image/png');
    }else{
      const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=fname;a.click();
      toast('이미지 저장 완료 — 카카오톡에 첨부하세요 💛','success');
    }
  }catch(e){toast('카톡용 이미지 실패: '+e.message,'error');}
}
async function saveRegListPDF44(){
  const tid=ge('regTS')?.value||'';
  if(!tid){toast('대회를 먼저 선택해 주세요','info');return;}
  try{
    await _loadH2c44();
    if(!window.jspdf) await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
    toast('PDF 생성 중...','info');
    const wrap=await _buildRegListEl44();if(!wrap)return;
    const selDiv=ge('regDS')?.value||'';
    const t=G.tournaments.find(x=>x.id===tid);
    const divLabel=selDiv?dl(selDiv):'전체';
    const fname=`팀등록명단_${(t?.name||'').replace(/\s/g,'')}_${divLabel}_${new Date().toISOString().substring(0,10)}.pdf`;
    await new Promise(r=>setTimeout(r,80));
    const canvas=await html2canvas(wrap,{backgroundColor:'#f0f4fa',scale:3,useCORS:true,logging:false});
    document.body.removeChild(wrap);
    const {jsPDF}=window.jspdf;
    const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const pageW=pdf.internal.pageSize.getWidth(),pageH=pdf.internal.pageSize.getHeight(),margin=8;
    const imgW=pageW-margin*2,imgH=canvas.height*imgW/canvas.width;
    const imgData=canvas.toDataURL('image/png');
    if(imgH<=pageH-margin*2){pdf.addImage(imgData,'PNG',margin,margin,imgW,imgH);}
    else{let rem=imgH,pos=0;pdf.addImage(imgData,'PNG',margin,margin+pos,imgW,imgH);rem-=(pageH-margin*2);while(rem>0){pos-=(pageH-margin*2);pdf.addPage();pdf.addImage(imgData,'PNG',margin,margin+pos,imgW,imgH);rem-=(pageH-margin*2);}}
    pdf.save(fname);
    toast('PDF 저장 완료 📄','success');
  }catch(e){toast('PDF 저장 실패: '+e.message,'error');}
}

async function saveRegListExcel44(){
  const tid=ge('regTS')?.value||'';
  if(!tid){toast('대회를 먼저 선택해 주세요','info');return;}
  const t=G.tournaments.find(x=>x.id===tid);
  if(!t){toast('대회를 먼저 선택해 주세요','info');return;}
  try{
    await ensureXLSX();
    const selDiv=ge('regDS')?.value||'';
    const allDivs=[...(t.divisions||[])].sort((a,b)=>divOrder44(a)-divOrder44(b));
    const targetDivs=(selDiv&&allDivs.includes(selDiv))?[selDiv]:allDivs;
    const rows=[['부서','팀순번','클럽명','구분','번호','선수명']];
    targetDivs.forEach(div=>{
      const key=tid+'_'+div;
      const teams=(G.teams[key]||[]).slice();
      const sorted=teams.map((team,i)=>({team,sortIdx:i})).sort((x,y)=>(x.team.club||'').localeCompare(y.team.club||'','ko'));
      if(!sorted.length){
        rows.push([dl(div),'','','등록팀없음','','']);
        return;
      }
      sorted.forEach(({team},idx)=>{
        const teamName=tdn(team,key,idx);
        const players=(team.players||[]).filter(Boolean);
        const dbl=Number(team.mainPlayerCount||team.doublesCount||5);
        const main=players.slice(0,dbl*2);
        const sub=players.slice(dbl*2);
        main.forEach((p,pidx)=>rows.push([dl(div),idx+1,teamName,'주전',pidx+1,p]));
        sub.forEach((p,sidx)=>rows.push([dl(div),idx+1,teamName,'후보',sidx+1,p]));
      });
      rows.push(['','','','','','']);
    });
    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:12},{wch:8},{wch:18},{wch:10},{wch:8},{wch:18}];
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'팀등록명단');
    const divLabel=selDiv?dl(selDiv):'전체';
    const fname=`팀등록명단_${(t?.name||'').replace(/\s/g,'')}_${divLabel}_${new Date().toISOString().substring(0,10)}.xlsx`;
    XLSX.writeFile(wb,fname);
    toast('엑셀 저장 완료 📊','success');
  }catch(e){toast('엑셀 저장 실패: '+e.message,'error');}
}

async function saveRegistryFilteredImageHQ(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const body=ge('regTabBody');
  if(!body || !body.innerHTML.trim()){ toast('저장할 등록선수 현황이 없습니다','info'); return; }
  try{
    await _loadH2c44();
    toast('고화질 이미지 생성 중...','info');
    const year=parseInt(ge('regYearSel')?.value||2026);
    const selRegion=ge('regRegionSel')?.value||'';
    const selClub=ge('regClubSel')?.value||'';
    const showSubOnly=ge('regShowSubOnly')?.checked||false;
    const keyword=(ge('regSearchInput')?.value||'').trim();
    const stat=(ge('regTabStat')?.textContent||'').trim();
    const wrap=document.createElement('div');
    wrap.style.cssText='position:fixed;left:-9999px;top:0;width:1100px;background:#f0f4fa;padding:18px 18px 24px;font-family:inherit;z-index:-1';
    const filters=[];
    if(selRegion) filters.push(`지역: ${selRegion}`);
    if(selClub) filters.push(`클럽: ${selClub}`);
    if(showSubOnly) filters.push('부클럽만');
    if(keyword) filters.push(`검색: ${keyword}`);
    wrap.innerHTML=`<div style="background:#fff;border:1px solid #d5dbea;border-radius:16px;padding:18px;box-shadow:0 4px 18px rgba(15,30,58,.08)">      <div style="text-align:center;margin-bottom:14px;padding-bottom:12px;border-bottom:2px solid #1e40af">        <div style="font-size:1.22rem;font-weight:900;color:#0f1e3a">${year}년 선수 등록 현황</div>        <div style="font-size:.82rem;color:#475569;margin-top:4px">${filters.length?filters.join(' · '):'전체'}</div>        <div style="font-size:.8rem;color:#1e40af;font-weight:700;margin-top:6px">${stat||''}</div>      </div>      <div id="registryImageInner"></div>      <div style="text-align:right;font-size:.68rem;color:#94a3b8;margin-top:12px;border-top:1px solid #e2e8f0;padding-top:8px">출력일시: ${new Date().toLocaleString('ko-KR')}</div>    </div>`;
    const inner=wrap.querySelector('#registryImageInner');
    inner.innerHTML=body.innerHTML;
    document.body.appendChild(wrap);
    await new Promise(r=>setTimeout(r,100));
    const canvas=await html2canvas(wrap,{backgroundColor:'#f0f4fa',scale:4,useCORS:true,logging:false,windowWidth:1300});
    document.body.removeChild(wrap);
    const fname=`등록선수현황_${year}_${new Date().toISOString().substring(0,10)}.png`;
    const a=document.createElement('a');
    a.href=canvas.toDataURL('image/png');
    a.download=fname;
    a.click();
    toast('고화질 이미지 저장 완료 🖼️','success');
  }catch(e){toast('이미지 저장 실패: '+e.message,'error');}
}

// ═══════════════════════════════════════════════════════
//  📌 대회요강(텍스트/링크/파일) 업로드 & 표시
// ═══════════════════════════════════════════════════════
function _pickGuideStore(mode){ return mode==='edit' ? GUIDE_FILES_EDIT : GUIDE_FILES_CREATE; }
function _setGuideStore(mode, arr){ if(mode==='edit') GUIDE_FILES_EDIT = arr; else GUIDE_FILES_CREATE = arr; }

function renderGuidePreview(mode){
  const arr = _pickGuideStore(mode);
  const box = ge(mode==='edit' ? 'etGuidePreview' : 'tGuidePreview');
  if(!box) return;
  if(!arr.length){ box.innerHTML=''; return; }
  box.innerHTML = `<div style="font-size:.78rem;font-weight:700;color:var(--primary-dark);margin:8px 0 6px">첨부 요강 (${arr.length})</div>` +
    `<div style="display:flex;flex-wrap:wrap;gap:8px">`+
    arr.map((a,i)=>`
      <div style="border:1px solid var(--border);border-radius:10px;padding:8px;background:white;min-width:120px">
        <div style="font-size:.7rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">${a.name}</div>
        <div style="font-size:.65rem;color:var(--text3)">${a.type}</div>
        ${a.type.startsWith('image/')?`<img src="${a.dataUrl}" style="width:160px;max-width:100%;border-radius:8px;margin-top:6px;border:1px solid var(--border)">`:''}
        <div style="margin-top:6px;display:flex;gap:6px;justify-content:flex-end">
          <button class="btn btn-danger" style="padding:3px 8px;font-size:.7rem" onclick="removeGuideFile('${mode}',${i})">삭제</button>
        </div>
      </div>
    `).join('')+
    `</div>`;
}

function removeGuideFile(mode, idx){
  const arr = _pickGuideStore(mode);
  arr.splice(idx,1);
  _setGuideStore(mode, arr);
  renderGuidePreview(mode);
}

function readFileAsDataUrl(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>res(r.result);
    r.onerror=()=>rej(new Error('파일 읽기 실패'));
    r.readAsDataURL(file);
  });
}

async function compressImageDataUrl(dataUrl, maxW=1400, quality=0.82){
  // dataUrl -> Image -> canvas -> jpeg dataUrl
  return new Promise((res)=>{
    const img=new Image();
    img.onload=()=>{
      const w=img.width, h=img.height;
      const scale = w>maxW ? (maxW/w) : 1;
      const cw=Math.round(w*scale), ch=Math.round(h*scale);
      const canvas=document.createElement('canvas');
      canvas.width=cw; canvas.height=ch;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,cw,ch);
      // jpeg로 저장(용량 절감)
      try{
        const out = canvas.toDataURL('image/jpeg', quality);
        res(out);
      }catch(e){
        res(dataUrl);
      }
    };
    img.onerror=()=>res(dataUrl);
    img.src=dataUrl;
  });
}

// GUIDE_FILES_*_PENDING: 아직 업로드 안 된 File 객체 임시 보관
let GUIDE_FILES_CREATE_PENDING = [];
let GUIDE_FILES_EDIT_PENDING   = [];

async function onGuideFilesSelected(input, mode){
  const files=[...(input.files||[])];
  if(!files.length) return;
  const pending = mode==='edit' ? GUIDE_FILES_EDIT_PENDING : GUIDE_FILES_CREATE_PENDING;

  for(const f of files){
    if(f.size > 10*1024*1024){ toast(`파일이 너무 큽니다 (최대 10MB): ${f.name}`, 'error'); continue; }
    pending.push(f);
    const arr = _pickGuideStore(mode);
    // 미리보기용 dataUrl 생성
    let dataUrl = await readFileAsDataUrl(f);
    if(f.type.startsWith('image/') && dataUrl.length>350_000){
      dataUrl = await compressImageDataUrl(dataUrl, 1400, 0.82);
    }
    arr.push({name:f.name, type:f.type||'application/octet-stream', dataUrl, _pending:true});
    _setGuideStore(mode, arr);
  }
  renderGuidePreview(mode);
  input.value='';
}

// 대회 저장 시 pending 파일들을 Storage에 업로드하고 URL 반환
async function flushGuideUploads(tid, mode){
  const pending = mode==='edit' ? GUIDE_FILES_EDIT_PENDING : GUIDE_FILES_CREATE_PENDING;
  if(!pending.length) return;
  const arr = _pickGuideStore(mode);
  for(const file of pending){
    try{
      const fileRef = ref(storage, `guides/${tid}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      // arr 안의 pending 항목을 Storage URL로 교체
      const idx = arr.findIndex(a=>a._pending && a.name===file.name);
      if(idx>=0){ arr[idx] = {name:file.name, type:file.type, dataUrl:url, isStorage:true}; }
    }catch(e){ toast(`업로드 실패: ${file.name}`,'error'); }
  }
  // pending 비우기
  if(mode==='edit') GUIDE_FILES_EDIT_PENDING.length=0;
  else GUIDE_FILES_CREATE_PENDING.length=0;
  _setGuideStore(mode, arr);
}

// ── 요강 보기 모달 ─────────────────────────────────────
function ensureGuideModal(){
  if(ge('mGuide')) return;
  const wrap=document.createElement('div');
  wrap.className='modal-overlay';
  wrap.id='mGuide';
  wrap.innerHTML=`
    <div class="modal-box" style="max-width:860px">
      <div class="modal-header">
        <h3 id="mGuideT">📌 대회 요강</h3>
        <button class="modal-close" onclick="cm('mGuide')">✕</button>
      </div>
      <div class="modal-body" id="mGuideB" style="max-height:78vh;overflow:auto"></div>
      <div class="modal-footer">
        <button class="btn btn-gray" onclick="cm('mGuide')">닫기</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click',e=>{ if(e.target===wrap) wrap.classList.remove('open'); });
}

function buildGuideHTML(title, text, url, assets){
  const safe = s => (s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const textHtml = text ? `<div style="white-space:pre-line;line-height:1.65;font-size:.86rem;color:var(--text2);background:var(--panel2);border:1px solid var(--border);padding:12px;border-radius:12px">${safe(text)}</div>` : '';
  const urlHtml = url ? `<div style="margin-top:10px"><a href="${url}" target="_blank" style="color:var(--primary);font-weight:700;text-decoration:underline">🔗 요강 링크 열기</a></div>` : '';
  const assetsHtml = (assets&&assets.length) ? `
    <div style="margin-top:12px;font-weight:800;color:var(--primary-dark)">첨부 파일</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
      ${assets.map(a=>{
        const isImg = (a.type||'').startsWith('image/');
        const btn = `<a download="${a.name||'file'}" href="${a.dataUrl}" style="font-size:.75rem;color:var(--primary);font-weight:700;text-decoration:underline">다운로드</a>`;
        return `<div style="border:1px solid var(--border);border-radius:12px;background:white;padding:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
            <div style="font-weight:800">${a.name||''} <span style="font-size:.7rem;color:var(--text3);font-weight:600">${a.type||''}</span></div>
            ${btn}
          </div>
          ${isImg?`<img src="${a.dataUrl}" style="width:100%;max-width:760px;border-radius:10px;margin-top:8px;border:1px solid var(--border)">`
                 : `<div style="margin-top:8px;font-size:.8rem;color:var(--text2)">PDF/파일은 다운로드로 확인하세요.</div>`}
        </div>`;
      }).join('')}
    </div>` : '';
  return `<div style="font-weight:900;font-size:1.05rem;color:var(--primary-dark);margin-bottom:10px">${title||'대회 요강'}</div>${textHtml}${urlHtml}${assetsHtml}`;
}

function openGuide(tid){
  ensureGuideModal();
  ge('mGuideT').textContent='📌 대회 요강';
  ge('mGuideB').innerHTML='<div style="text-align:center;padding:20px;color:var(--text3)">불러오는 중...</div>';
  om('mGuide');

  // 과거대회: tourGuides 컬렉션 우선 → Storage 폴더 fallback
  const isHist = typeof HIST_DATA!=='undefined' && HIST_DATA.some(t=>t.id===tid);
  const ht = isHist ? HIST_DATA.find(t=>t.id===tid) : null;
  const liveT = G.tournaments.find(x=>x.id===tid);

  const title = ht ? `${ht.name} 요강` : (liveT ? `${liveT.name} 요강` : '대회 요강');
  const text  = liveT?.guideText || '';
  const url   = liveT?.guideUrl  || '';

  // tourGuides 컬렉션 먼저 조회
  getDoc(doc(db,'tourGuides',tid)).then(snap=>{
    const assets = snap.exists() ? (snap.data().assets||[]) : (liveT?.guideAssets||[]);
    if(!text && !url && (!assets||!assets.length)){
      // Storage 폴더 확인 (guides/{tid}/)
      return loadGuideFromStorage(tid).then(storageAssets=>{
        if(!storageAssets.length && !text && !url){
          ge('mGuideB').innerHTML='<div style="text-align:center;padding:20px;color:var(--text3)">등록된 요강이 없습니다</div>';
        } else {
          ge('mGuideB').innerHTML=buildGuideHTML(title,text,url,storageAssets);
        }
      });
    }
    ge('mGuideB').innerHTML=buildGuideHTML(title,text,url,assets);
  }).catch(()=>{
    loadGuideFromStorage(tid).then(storageAssets=>{
      const assets=liveT?.guideAssets||[];
      const merged=[...storageAssets,...assets];
      if(!text && !url && !merged.length){ ge('mGuideB').innerHTML='<div style="text-align:center;padding:20px;color:var(--text3)">등록된 요강이 없습니다</div>'; return; }
      ge('mGuideB').innerHTML=buildGuideHTML(title,text,url,merged);
    });
  });
}

// Firebase Storage에서 guides/{tid}/ 폴더의 파일 목록+URL 가져오기
async function loadGuideFromStorage(tid){
  try{
    const folderRef = ref(storage, `guides/${tid}`);
    const res = await listAll(folderRef);
    const assets = await Promise.all(res.items.map(async itemRef=>{
      const url = await getDownloadURL(itemRef);
      const name = itemRef.name;
      const ext = name.split('.').pop().toLowerCase();
      const type = ext==='pdf'?'application/pdf':(ext==='png'?'image/png':'image/jpeg');
      return {name, type, dataUrl:url, isStorage:true};
    }));
    return assets.sort((a,b)=>a.name.localeCompare(b.name));
  }catch(e){ return []; }
}

// 요강 파일 업로드 (Storage)
async function uploadGuideFiles(tid, files){
  if(!files||!files.length) return [];
  const uploaded=[];
  for(const file of files){
    try{
      const fileRef = ref(storage, `guides/${tid}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      uploaded.push({name:file.name, type:file.type, dataUrl:url, isStorage:true});
      toast(`📎 ${file.name} 업로드 완료`,'success');
    }catch(e){ toast(`업로드 실패: ${file.name}`,'error'); }
  }
  return uploaded;
}

// 요강 삭제 (Storage)
async function deleteGuideFile(tid, fileName){
  try{
    const folderRef = ref(storage, `guides/${tid}`);
    const res = await listAll(folderRef);
    const target = res.items.find(it=>it.name===fileName || it.name.endsWith('_'+fileName));
    if(target) await deleteObject(target);
  }catch(e){}
}
// ─── 개별 경기 코트 배정 모달 (복수 선택) ──────────────────────────────
let MC_MODAL = { key:null, mid:null };

function ensureMatchCourtModal(){
  if(document.getElementById('mMCourt')) return;
  const wrap=document.createElement('div');
  wrap.id='mMCourt';
  wrap.className='modal';
  wrap.innerHTML=`<div class="modal-box" style="max-width:400px">
    <div class="modal-hdr">
      <h3 id="mMCourtT">🎾 경기 코트 배정</h3>
      <button class="modal-close" onclick="cm('mMCourt')">✕</button>
    </div>
    <div class="modal-body" id="mMCourtB"></div>
    <div class="modal-ftr">
      <button class="btn btn-gray" onclick="cm('mMCourt')">닫기</button>
      <button class="btn btn-primary" onclick="saveMatchCourtModal()">💾 저장</button>
    </div>
  </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click',e=>{ if(e.target===wrap) wrap.classList.remove('open'); });
}

function openMatchCourtModal(key,mid){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 코트 배정 가능','info'); return; }
  if(isIndividualByKey(key) && isIndividualAutoCourtAssignEnabled()){ toast('개인전 자동 코트배정이 켜져 있습니다. 자동배정을 끄면 수동 배정할 수 있습니다.','info'); return; }
  ensureMatchCourtModal();
  MC_MODAL={key,mid};
  const list=G.matches[key]||[];
  let m=list.find(x=>x.id===mid);
  if(!m){
    const drw=G.draws[key];
    if(drw){
      const allM=[...(drw.matches||[]),...((drw.groups||[]).flatMap(g=>g.matches||[]))];
      m=allM.find(x=>x.id===mid);
    }
  }
  if(!m) m={id:mid,courts:[],court:''};
  const mCourts = Array.isArray(m.courts) ? m.courts : (m.court ? [m.court] : []);
  const allowedCourts = getAllowedCourtsForMatch(key,m);
  const groupCourts = (m.phase==='group' && m.group!=null) ? getGroupAssignedCourts(key, Number(m.group)).map(String) : [];
  let label='경기';
  if(m.phase==='group') label=`${(m.group??0)+1}조 예선`;
  else if(m.phase==='main') label=`본선 R${m.round??''} #${(m.slot??0)+1}`;
  ge('mMCourtT').textContent=`🎾 코트 배정 – ${label}`;

  const usedCourts={};
  (G.matches[key]||[]).forEach(x=>{
    if(x.id===mid) return;
    const xC=Array.isArray(x.courts)?x.courts:(x.court?[x.court]:[]);
    xC.forEach(c=>{
      if(!usedCourts[c]) usedCourts[c]=[];
      usedCourts[c].push(formatMatchQueueLabel(key,x));
    });
  });

  const sectionsHtml = renderCourtAccordionSelector(mCourts, usedCourts, `match_${key}_${mid}`, allowedCourts);
  const isIndivRestricted = isIndividualByKey(key) && m.phase==='group';
  const restrictLines=[];
  if(groupCourts.length) restrictLines.push(`현재 조 배정 코트: <b>${groupCourts.join(', ')}</b>`);
  if(isIndivRestricted && !allowedCourts.length) restrictLines.push('<span style="color:var(--danger);font-weight:800">이 부서에 설정된 운영 코트가 없어 현재 선택 가능한 코트가 없습니다.</span>');
  const hint=`<div style="font-size:.72rem;color:var(--text2);margin-bottom:10px;padding:8px 10px;background:var(--panel2);border-radius:var(--radius);border:1px solid var(--border)">
    ${isIndivRestricted
      ? `✅ 수동 코트 변경은 <b>이 부서에 설정된 운영 코트 전체</b> 안에서 가능합니다.${restrictLines.length?`<br>${restrictLines.join('<br>')}`:''}<br>⚠️ 이미 사용 중인 코트를 선택하면 이 경기는 해당 코트의 <b>대기 경기</b>로 등록됩니다.<br>👁️ '해당 경기·코트만 골라보기'는 화면 표시만 바뀌며, 실제 코트 배정 범위는 바뀌지 않습니다.`
      : `✅ 현재 배정된 코트 &nbsp;|&nbsp; ⚠️ 다른 경기 사용 중<br>사용 중인 코트 선택 시 해당 경기는 그 코트의 <b>대기중</b>으로 표시됩니다.`}
  </div>`;
  ge('mMCourtB').innerHTML=hint+sectionsHtml;
  om('mMCourt');
}

async function saveMatchCourtModal(){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 저장 가능','info'); return; }
  const prevCourtState=captureCourtNotificationState();
  const {key,mid}=MC_MODAL;
  if(!key||!mid) return;
  const list=G.matches[key]||[];
  const m=list.find(x=>x.id===mid);
  if(!m){ toast('경기를 찾을 수 없습니다','error'); return; }
  const box=ge('mMCourtB');
  const courts=[...box.querySelectorAll('input[type="checkbox"]:checked')].map(i=>i.value);
  const allowedCourts=getAllowedCourtsForMatch(key,m);
  if(allowedCourts.length){
    const invalid=courts.filter(c=>!allowedCourts.includes(c));
    if(invalid.length){ toast('해당 조에 배정된 코트만 선택할 수 있습니다','error'); return; }
  }

  let waitingCount=0;
  courts.forEach(c=>{
    const queue=getCourtQueueInfo(key,c);
    const hasOther=queue.related.some(x=>x.id!==m.id);
    if(hasOther) waitingCount++;
  });

  const prevCourtsJson = JSON.stringify(Array.isArray(m.courts)?m.courts:(m.court?[m.court]:[]));
  const nextCourtsJson = JSON.stringify((courts||[]).filter(Boolean));
  const sameCourts = prevCourtsJson===nextCourtsJson;
  const nowIso = new Date().toISOString();
  const assignedAt = (sameCourts && m.courtAssignedAt) ? m.courtAssignedAt : nowIso;
  const queueOrder = (sameCourts && m.courtQueueOrder) ? m.courtQueueOrder : assignedAt;
  m.courts=courts;
  m.court=courts[0]||'';
  m.courtAssignedAt=assignedAt;
  m.courtQueueOrder=queueOrder;
  if(!courts.length){
    delete m.waitingFirstAt;
  }
  if(isIndividualByKey(key) && courts[0]){ m.manualCourtTarget=String(courts[0]); m.manualCourtPinnedAt=assignedAt; }
  else if(isIndividualByKey(key) && !courts[0]){ delete m.manualCourtTarget; delete m.manualCourtPinnedAt; }
  sl(true);
  try{
    await persistSingleMatchDoc(key, m);
    sl(false);
    dispatchLocalCourtNotificationAlerts(prevCourtState);
    toast(waitingCount>0?`코트 배정 저장 ✅ (${waitingCount}개 코트 대기 등록)`: '코트 배정 저장 ✅','success');
    cm('mMCourt');
    renderBracket();
  }catch(e){
    sl(false);
    toast('코트 저장 실패: '+e.message,'error');
  }
}

async function setCourt(key, mid, value){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 코트 배정 가능','info'); return; }
  const prevCourtState=captureCourtNotificationState();
  const list=G.matches[key]||[];
  const m=list.find(m=>m.id===mid);
  if(!m) return;
  const allowedCourts=getAllowedCourtsForMatch(key,m);
  if(value && allowedCourts.length && !allowedCourts.includes(value)){ toast('해당 조에 배정된 코트만 선택할 수 있습니다','error'); return; }
  const prevCourtsJson = JSON.stringify(Array.isArray(m.courts)?m.courts:(m.court?[m.court]:[]));
  const nextCourtsJson = JSON.stringify(value ? [value] : []);
  const sameCourts = prevCourtsJson===nextCourtsJson;
  const nowIso = new Date().toISOString();
  const assignedAt = (sameCourts && m.courtAssignedAt) ? m.courtAssignedAt : nowIso;
  const queueOrder = (sameCourts && m.courtQueueOrder) ? m.courtQueueOrder : assignedAt;
  m.court = value || '';
  m.courts = value ? [value] : [];
  m.courtAssignedAt=assignedAt;
  m.courtQueueOrder=queueOrder;
  if(!value) delete m.waitingFirstAt;
  if(isIndividualByKey(key) && value){ m.manualCourtTarget=String(value); m.manualCourtPinnedAt=assignedAt; }
  else if(isIndividualByKey(key) && !value){ delete m.manualCourtTarget; delete m.manualCourtPinnedAt; }
  sl(true);
  try{
    await persistSingleMatchDoc(key, m);
    sl(false);
    dispatchLocalCourtNotificationAlerts(prevCourtState);
    toast('코트 배정 저장 ✅','success');
    renderBracket();
  }catch(e){
    sl(false);
    toast('코트 저장 실패: '+e.message,'error');
  }
}

function _gcuiId(key,gi){ return `gcui_${key}_${gi}`; }

function toggleGroupCourtUI(key,gi){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 코트 배정 가능','info'); return; }
  const set=_gcSet(key);
  if(set.has(gi)) set.delete(gi); else set.add(gi);
  renderBracket();
}

async function onGroupCourtChange(key,gi){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 코트 배정 가능','info'); return; }
  _gcSet(key).add(gi);
  const box = ge(_gcuiId(key,gi));
  if(!box) return;
  const courts = [...box.querySelectorAll('input[type="checkbox"]:checked')].map(i=>i.value);
  if(!G.draws[key] || !G.draws[key].groups || !G.draws[key].groups[gi]) return;
  G.draws[key].groups[gi].courts = courts;
  sl(true);
  try{
    await stD(key);
    sl(false);
    toast('조 코트 배정 저장 ✅','success');
  }catch(e){
    sl(false);
    toast('코트 저장 실패: '+e.message,'error');
    return;
  }
  renderBracket();
}

let GC_MODAL = { key:null, gi:null };

function openGroupCourtModal(key,gi){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 코트 배정 가능','info'); return; }
  GC_MODAL={key,gi};
  const grpCourts=getGroupDisplayCourts(key, gi);
  const title=`🎾 ${grpLabel(gi)} 코트 배정 (복수 선택)`;
  const allowedCourts = getBracketAllowedCourts(key);
  const sectionsHtml = renderCourtAccordionSelector(grpCourts, null, `group_${key}_${gi}`, allowedCourts);
  const divisionAllowedCourts=getDrawAllowedCourts(key);
  const divisionLine = divisionAllowedCourts.length
    ? `<br>• 이 부서 예선 운영 코트로 지정된 코트만 보입니다. <b>${divisionAllowedCourts.join(', ')}</b>`
    : '';
  const hint = `<div style="font-size:.72rem;color:var(--text2);margin-bottom:10px;padding:8px 10px;background:var(--panel2);border-radius:var(--radius);border:1px solid var(--border)">
    • 구장 이름을 누르면 아래에 세부 코트 번호가 펼쳐집니다.<br>
    • 체크박스로 여러 코트를 선택할 수 있습니다.${divisionLine}<br>
    • '해당 경기·코트만 골라보기'는 화면 표시만 바뀌며, 여기서 선택 가능한 코트는 바뀌지 않습니다.<br>
    • 아래 저장을 눌러야 반영됩니다.
  </div>`;
  ge('mGCourtT').textContent = title;
  ge('mGCourtB').innerHTML = hint + sectionsHtml;
  om('mGCourt');
}

// ─── 경기순서 자동배열 실행 (현재 선택된 대회/부서) ─────────────────────
function runAutoOrder(){
  const tid=ge('brTS')?.value;
  if(!tid){ toast('대회를 먼저 선택하세요','info'); return; }
  const t=G.tournaments.find(t=>t.id===tid);
  if(!t){ return; }
  const divs = getBracketSelectedDivs(tid);
  if(divs.length===0){ toast('부서가 없습니다','info'); return; }
  // 부서별 순차 실행
  (async()=>{
    for(const d of divs){
      await autoOrderMatches(tid+'_'+d);
    }
    toast('전체 경기순서 배열 완료 ✅','success');
    renderBracket();
  })();
}

// ─── 경기 순서 자동 배열 ──────────────────────────────────────────────────
// 규칙:
//  1순위: 같은 코트에 같은 클럽 팀이 있는 경기 (클럽 내 대기 최소화)
//  2순위: 코트가 겹치지 않는 경기끼리 묶어 순서 배열
//  미배정 경기는 뒤로
async function autoOrderMatches(key){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 순서 배열 가능','info'); return; }
  const list = G.matches[key] || [];
  const teams = G.teams[key] || [];
  const pending = list.filter(m => m.winner == null);
  const done    = list.filter(m => m.winner != null);

  function getClub(tid){
    const t = teams.find(t => t.id === tid || t.name === tid);
    return t ? (t.club || '') : '';
  }
  function getCourts(m){
    if(m.phase === 'group'){
      const grpCourts = (G.draws[key]?.groups?.[m.group||0]?.courts) || [];
      if(grpCourts.length) return grpCourts.filter(Boolean);
    }
    return Array.isArray(m.courts) ? m.courts : (m.court ? [m.court] : []);
  }
  function pairKeyFromMatch(m, gTeams){
    const a = gTeams.indexOf(m.t1);
    const b = gTeams.indexOf(m.t2);
    if(a < 0 || b < 0) return '';
    return [a,b].sort((x,y)=>x-y).join('-');
  }
  function getGroupPriority(m){
    const gi = Number(m.group || 0);
    const grp = G.draws[key]?.groups?.[gi];
    const gTeams = Array.isArray(grp?.teams) ? grp.teams : [];
    const size = gTeams.length;
    const pk = pairKeyFromMatch(m, gTeams);
    if(!pk) return Number(m.slot || 999);

    if(size === 4){
      const map = {'0-1':0,'2-3':1,'0-2':2,'1-3':3,'0-3':4,'1-2':5};
      return map[pk] ?? Number(m.slot || 999);
    }
    if(size === 3){
      if(pk === '0-1') return 0;
      const allGroupMatches = list.filter(x => x.phase === 'group' && Number(x.group || 0) === gi);
      const firstMatch = allGroupMatches.find(x => pairKeyFromMatch(x, gTeams) === '0-1');
      if(firstMatch && firstMatch.winner != null){
        const winnerPair = [firstMatch.winner, gTeams[2]].sort((a,b)=>String(a).localeCompare(String(b))).join('|');
        const thisPair = [m.t1, m.t2].sort((a,b)=>String(a).localeCompare(String(b))).join('|');
        return thisPair === winnerPair ? 1 : 2;
      }
      if(pk === '0-2') return 1;
      if(pk === '1-2') return 2;
    }
    return Number(m.slot || 999);
  }
  function sameClub(m){
    const c1 = getClub(m.t1), c2 = getClub(m.t2);
    return c1 && c2 && c1 === c2;
  }

  const withCourt = pending.filter(m => getCourts(m).length > 0);
  const withoutCourt = pending.filter(m => getCourts(m).length === 0);

  withCourt.sort((a, b) => {
    if(a.phase === 'group' && b.phase === 'group'){
      const ag = Number(a.group ?? 999), bg = Number(b.group ?? 999);
      if(ag !== bg) return ag - bg;
      const ap = getGroupPriority(a), bp = getGroupPriority(b);
      if(ap !== bp) return ap - bp;
    }
    const sa = sameClub(a) ? 1 : 0;
    const sb = sameClub(b) ? 1 : 0;
    if(sb !== sa) return sb - sa;
    return (getCourts(a)[0]||'').localeCompare((getCourts(b)[0]||''), 'ko');
  });

  const ordered = [];
  let remaining = [...withCourt];
  while(remaining.length > 0){
    const usedInRound = new Set();
    const usedTeams = new Set();
    const nextRemaining = [];
    for(const m of remaining){
      const mc = getCourts(m);
      const tids = [m.t1, m.t2].filter(v => v !== null && v !== undefined);
      const courtConflict = mc.some(c => usedInRound.has(c));
      const teamConflict = tids.some(t => usedTeams.has(t));
      if(!courtConflict && !teamConflict){
        mc.forEach(c => usedInRound.add(c));
        tids.forEach(t => usedTeams.add(t));
        ordered.push(m);
      } else {
        nextRemaining.push(m);
      }
    }
    if(nextRemaining.length === remaining.length){
      ordered.push(...nextRemaining);
      break;
    }
    remaining = nextRemaining;
  }

  const finalOrder = [...done, ...ordered, ...withoutCourt];
  const base = new Date('2000-01-01T00:00:00Z').getTime();
  finalOrder.forEach((m, i) => {
    if(getCourts(m).length > 0){
      m.courtAssignedAt = new Date(base + i * 1000).toISOString();
      m.courtQueueOrder = m.courtAssignedAt;
      delete m.waitingFirstAt;
    }
  });

  sl(true);
  try{
    await stM(key);
    sl(false);
    toast('경기 순서 자동 배열 완료 ✅ (예선 표준 순서 반영)', 'success');
    renderBracket();
  }catch(e){
    sl(false);
    toast('저장 실패: '+e.message, 'error');
  }
}

async function saveGroupCourtModal(){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 저장 가능','info'); return; }
  const {key,gi}=GC_MODAL;
  if(key==null || gi==null) return;
  const box=ge('mGCourtB');
  const courts=[...box.querySelectorAll('input[type="checkbox"]:checked')].map(i=>i.value);
  if(!G.draws[key] || !G.draws[key].groups || !G.draws[key].groups[gi]){ toast('추첨 데이터가 없습니다','error'); return; }
  G.draws[key].groups[gi].courts = courts;
  sl(true);
  try{
    await stD(key);
    sl(false);
    toast('조 코트 배정 저장 ✅','success');
    cm('mGCourt');
    renderBracket();
  }catch(e){
    sl(false);
    toast('코트 저장 실패: '+e.message,'error');
  }
}

// ─── 경기 메모 입력 모달 ───────────────────────────────────────────────
let MM_MODAL = { key:null, mid:null };

function ensureMatchMemoModal(){
  if(document.getElementById('mMMemo')) return;
  const wrap=document.createElement('div');
  wrap.className='modal-overlay';
  wrap.id='mMMemo';
  wrap.innerHTML=`
    <div class="modal-box" style="max-width:560px">
      <div class="modal-header">
        <h3 id="mMMemoT">📢 경기 공지</h3>
        <button class="modal-close" onclick="cm('mMMemo')">✕</button>
      </div>
      <div class="modal-body">
        <div style="font-size:.74rem;color:var(--text2);margin-bottom:10px;line-height:1.6;padding:8px 10px;background:var(--panel2);border:1px solid var(--border);border-radius:10px">
          예: 2번 코트 대기 / 바로 입장 / 순서 변경 / 운영 전달사항 등 경기 단위 공지를 남길 수 있습니다.
        </div>
        <textarea class="form-textarea" id="mMMemoInput" placeholder="경기 공지를 입력하세요"></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-gray" onclick="cm('mMMemo')">닫기</button>
        <button class="btn btn-outline" onclick="clearMatchMemoModal()">지우기</button>
        <button class="btn btn-primary" onclick="saveMatchMemoModal()">💾 저장</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click',e=>{ if(e.target===wrap) wrap.classList.remove('open'); });
}
function openMatchMemoModal(key,mid){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 경기 공지 입력 가능','info'); return; }
  const m=(G.matches?.[key]||[]).find(x=>String(x.id)===String(mid));
  if(!m){ toast('경기를 찾을 수 없습니다','error'); return; }
  ensureMatchMemoModal();
  MM_MODAL={key,mid};
  ge('mMMemoT').textContent=`📢 경기 공지`;
  ge('mMMemoInput').value=getMatchMemo(key,mid);
  om('mMMemo');
}
async function saveMatchMemoModal(){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 저장 가능','info'); return; }
  const {key,mid}=MM_MODAL;
  if(!key||!mid) return;
  const m=(G.matches?.[key]||[]).find(x=>String(x.id)===String(mid));
  if(!m){ toast('경기를 찾을 수 없습니다','error'); return; }
  m.memo=(ge('mMMemoInput')?.value||'').trim();
  sl(true);
  try{
    await stM(key);
    sl(false);
    toast('경기 공지 저장 ✅','success');
    cm('mMMemo');
    renderBracket();
  }catch(e){
    sl(false);
    toast('메모 저장 실패: '+e.message,'error');
  }
}
async function clearMatchMemoModal(){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 저장 가능','info'); return; }
  if(ge('mMMemoInput')) ge('mMMemoInput').value='';
}
window.openMatchMemoModal = openMatchMemoModal;
window.saveMatchMemoModal = saveMatchMemoModal;
window.clearMatchMemoModal = clearMatchMemoModal;

function getGroupNoticePhonesMap(key, gi){
  try{
    const grp=G.draws?.[key]?.groups?.[Number(gi)];
    if(!grp) return {};
    if(!grp.noticePhones || typeof grp.noticePhones!=='object') grp.noticePhones={};
    return grp.noticePhones;
  }catch(e){ return {}; }
}
function getGroupNoticeRecipients(key, gi){
  const grp=G.draws?.[key]?.groups?.[Number(gi)];
  const teams=G.teams?.[key]||[];
  if(!grp) return [];
  const recipients=[];
  (grp.teams||[]).forEach((teamIdx, slotIdx)=>{
    const team=teams[teamIdx]||{};
    const isIndividual = team?.tournamentType==='individual_pair' || Array.isArray(team?.individualPlayers);
    if(isIndividual){
      const players=(Array.isArray(team.individualPlayers)&&team.individualPlayers.length)
        ? team.individualPlayers.slice(0,2)
        : (team.players||[]).slice(0,2).map((name)=>({name, clubsRaw:String(team?.club||'').trim(), clubs:parseClubAliases(team?.club||'')}));
      players.forEach((p, pIdx)=>{
        const info=getPlayerContactInfo(String(p?.name||'').trim(), String(p?.clubsRaw||'').trim(), String(p?.phone||'').trim(), String(p?.career||'').trim());
        const label=`${String(p?.name||'').trim()||'-'}${info.club?` (${info.club})`:''}`;
        recipients.push({
          id:`player_${teamIdx}_${pIdx}`,
          type:'player',
          teamIdx,
          playerIdx:pIdx,
          label,
          phone:formatPhoneLoose(String(info.phone||'')),
          missing:!String(info.phone||'').trim()
        });
      });
    }else{
      const savedMap=getGroupNoticePhonesMap(key, gi);
      const savedPhone=formatPhoneLoose(String(savedMap?.[teamIdx]||team?.noticePhone||team?.repPhone||''));
      recipients.push({
        id:`team_${teamIdx}`,
        type:'team',
        teamIdx,
        label:`${tdn(team,key,teamIdx)} 대표`,
        teamLabel:tdn(team,key,teamIdx),
        phone:savedPhone,
        missing:!savedPhone
      });
    }
  });
  return recipients;
}
function updateGroupSmsCount(){
  const countEl=ge('mGroupSmsCount');
  if(!countEl) return;
  const rows=[...document.querySelectorAll('#mGroupSmsList .group-sms-row')];
  const total=rows.length;
  let selected=0, valid=0;
  rows.forEach(row=>{
    const cb=row.querySelector('.group-sms-check');
    const input=row.querySelector('.group-sms-phone-input');
    const phone=formatPhoneLoose(String(input?.value||''));
    if(phone) valid++;
    if(cb?.checked) selected++;
  });
  countEl.innerHTML=`선택 ${selected}명 / 전체 ${total}명 · 문자 가능 ${valid}명`;
}
function toggleAllGroupSmsRecipients(checked){
  document.querySelectorAll('#mGroupSmsList .group-sms-row').forEach(row=>{
    const cb=row.querySelector('.group-sms-check');
    const input=row.querySelector('.group-sms-phone-input');
    const hasPhone=!!formatPhoneLoose(String(input?.value||''));
    if(cb){
      cb.checked=checked && hasPhone;
      cb.disabled=!hasPhone;
    }
  });
  updateGroupSmsCount();
}
function onGroupSmsPhoneInput(rowId){
  const row=ge(rowId);
  if(!row) return;
  const input=row.querySelector('.group-sms-phone-input');
  const cb=row.querySelector('.group-sms-check');
  const badge=row.querySelector('.group-sms-status');
  const phone=formatPhoneLoose(String(input?.value||''));
  if(input) input.value=phone;
  if(cb){
    cb.disabled=!phone;
    if(!phone) cb.checked=false;
  }
  if(badge){
    badge.textContent=phone ? phone : '번호 미등록';
    badge.style.color=phone ? 'var(--text2)' : '#dc2626';
    badge.style.fontWeight=phone ? '700' : '800';
  }
  updateGroupSmsCount();
}
function collectGroupSmsSelection(){
  const rows=[...document.querySelectorAll('#mGroupSmsList .group-sms-row')];
  const selected=[];
  const persistMap={};
  rows.forEach(row=>{
    const type=row.dataset.type||'';
    const teamIdx=row.dataset.teamIdx||'';
    const playerIdx=row.dataset.playerIdx||'';
    const label=row.dataset.label||'';
    const input=row.querySelector('.group-sms-phone-input');
    const cb=row.querySelector('.group-sms-check');
    const phone=formatPhoneLoose(String(input?.value||''));
    if(type==='team' && teamIdx!=='') persistMap[teamIdx]=phone;
    if(cb?.checked && phone){
      selected.push({type, teamIdx:Number(teamIdx), playerIdx:Number(playerIdx), label, phone});
    }
  });
  return {selected, persistMap};
}
let GROUP_SMS_MODAL={key:null, gi:null};
function ensureGroupSmsModal(){
  if(document.getElementById('mGroupSms')) return;
  const wrap=document.createElement('div');
  wrap.className='modal-overlay';
  wrap.id='mGroupSms';
  wrap.innerHTML=`
    <div class="modal-box" style="max-width:680px">
      <div class="modal-header">
        <h3 id="mGroupSmsT">📨 조 문자 보내기</h3>
        <button class="modal-close" onclick="cm('mGroupSms')">✕</button>
      </div>
      <div class="modal-body">
        <div style="font-size:.74rem;color:var(--text2);margin-bottom:10px;line-height:1.6;padding:8px 10px;background:var(--panel2);border:1px solid var(--border);border-radius:10px">
          개인전은 <b>개인별 전화번호</b>로, 단체전은 <b>이 조의 대표 전화번호</b>로 문자를 보냅니다. 단체전 대표 번호는 여기서 직접 입력해 저장할 수 있습니다.
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <div id="mGroupSmsCount" style="font-size:.76rem;color:var(--text2);font-weight:800"></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-gray" style="font-size:.74rem;padding:4px 10px;min-height:30px" onclick="toggleAllGroupSmsRecipients(true)">전체선택</button>
            <button class="btn btn-gray" style="font-size:.74rem;padding:4px 10px;min-height:30px" onclick="toggleAllGroupSmsRecipients(false)">전체해제</button>
          </div>
        </div>
        <div id="mGroupSmsList" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px"></div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">문자 내용</label>
          <textarea class="form-textarea" id="mGroupSmsMsg" placeholder="보낼 내용을 입력하세요"></textarea>
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between;flex-wrap:wrap">
        <button class="btn btn-gray" onclick="cm('mGroupSms')">닫기</button>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline" onclick="saveGroupSmsRecipientPhones()">💾 번호 저장</button>
          <button class="btn btn-primary" onclick="sendGroupSmsNow()">📨 문자 보내기</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click',e=>{ if(e.target===wrap) wrap.classList.remove('open'); });
}
function openGroupSmsModal(key, gi){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 문자 발송 가능','info'); return; }
  ensureGroupSmsModal();
  GROUP_SMS_MODAL={key, gi};
  const listEl=ge('mGroupSmsList');
  const msgEl=ge('mGroupSmsMsg');
  const recipients=getGroupNoticeRecipients(key, gi);
  ge('mGroupSmsT').textContent=`📨 ${grpLabel(gi)} 문자 보내기`;
  listEl.innerHTML = recipients.length ? recipients.map((r, idx)=>{
    const rowId=`groupSmsRow_${idx}_${Date.now()}`;
    return `<div class="group-sms-row" id="${rowId}" data-type="${r.type}" data-team-idx="${r.teamIdx}" data-player-idx="${r.playerIdx??''}" data-label="${escAttr(r.label)}" style="padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:#fff">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;min-width:180px">
          <input type="checkbox" class="group-sms-check" ${r.phone?'checked':''} ${r.phone?'':'disabled'} onchange="updateGroupSmsCount()">
          <span style="font-size:.9rem;font-weight:800;color:var(--primary-dark)">${esc(r.label)}</span>
        </label>
        <span class="group-sms-status" style="font-size:.74rem;${r.phone?'color:var(--text2);font-weight:700':'color:#dc2626;font-weight:800'}">${r.phone||'번호 미등록'}</span>
      </div>
      <input class="form-input group-sms-phone-input" value="${escAttr(r.phone||'')}" inputmode="tel" placeholder="${r.type==='team'?'이 조 대표 전화번호 입력':'선수 전화번호'}" oninput="onGroupSmsPhoneInput('${rowId}')">
    </div>`;
  }).join('') : `<div style="padding:18px 14px;border:1px dashed var(--border);border-radius:12px;background:#fff;font-size:.82rem;color:var(--text2)">이 조에서 문자 보낼 대상을 찾지 못했습니다.</div>`;
  if(msgEl) msgEl.value = `${grpLabel(gi)} 안내:\n`;
  updateGroupSmsCount();
  om('mGroupSms');
}
async function saveGroupSmsRecipientPhones(){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 저장 가능','info'); return; }
  const {key, gi}=GROUP_SMS_MODAL;
  if(key==null || gi==null) return;
  const grp=G.draws?.[key]?.groups?.[Number(gi)];
  if(!grp){ toast('조 정보를 찾을 수 없습니다','error'); return; }
  const {persistMap}=collectGroupSmsSelection();
  grp.noticePhones=persistMap;
  sl(true);
  try{
    await stD(key);
    sl(false);
    toast('조 대표 번호 저장 ✅','success');
    renderBracket();
    updateGroupSmsCount();
  }catch(e){
    sl(false);
    toast('번호 저장 실패: '+e.message,'error');
  }
}
async function sendGroupSmsNow(){
  const body=(ge('mGroupSmsMsg')?.value||'').trim();
  if(!body){ toast('문자 내용을 입력하세요','error'); return; }
  const {selected, persistMap}=collectGroupSmsSelection();
  if(!selected.length){ toast('문자 보낼 대상을 선택하세요','error'); return; }
  const {key, gi}=GROUP_SMS_MODAL;
  const grp=G.draws?.[key]?.groups?.[Number(gi)];
  if(grp) grp.noticePhones=persistMap;
  const phones=[...new Set(selected.map(x=>String(x.phone||'').replace(/[^0-9+]/g,'')).filter(Boolean))];
  if(!phones.length){ toast('문자 가능한 번호가 없습니다','error'); return; }
  try{
    if(grp) await stD(key);
  }catch(e){}
  const isMobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if(!isMobile){
    const listing=selected.map(x=>`${x.label}: ${x.phone}`).join('\n');
    const copied=await copyTextSafe(`[수신자]\n${listing}\n\n[내용]\n${body}`);
    toast(copied?'📋 PC에서는 수신자와 내용이 복사되었습니다. 문자앱에 붙여넣으세요.':'내용을 수동으로 복사해 주세요','info');
    return;
  }
  const recipients=phones.join(',');
  location.href=`sms:${recipients}?body=${encodeURIComponent(body)}`;
  toast(`문자창을 열었습니다 ✅ (${selected.length}명 선택)`,'success');
}
window.openGroupSmsModal = openGroupSmsModal;
window.saveGroupSmsRecipientPhones = saveGroupSmsRecipientPhones;
window.sendGroupSmsNow = sendGroupSmsNow;
window.toggleAllGroupSmsRecipients = toggleAllGroupSmsRecipients;
window.onGroupSmsPhoneInput = onGroupSmsPhoneInput;
window.updateGroupSmsCount = updateGroupSmsCount;

// ─── 조 메모 입력 모달 ───────────────────────────────────────────────
let GM_MODAL = { key:null, gi:null };

function ensureGroupMemoModal(){
  if(document.getElementById('mGMemo')) return;
  const wrap=document.createElement('div');
  wrap.className='modal-overlay';
  wrap.id='mGMemo';
  wrap.innerHTML=`
    <div class="modal-box" style="max-width:560px">
      <div class="modal-header">
        <h3 id="mGMemoT">📢 공지(조)</h3>
        <button class="modal-close" onclick="cm('mGMemo')">✕</button>
      </div>
      <div class="modal-body">
        <div style="font-size:.74rem;color:var(--text2);margin-bottom:10px;line-height:1.6;padding:8px 10px;background:var(--panel2);border:1px solid var(--border);border-radius:10px">
          예: 2번코트 대기 / 5분 뒤 출전 요망 / 경기순서 변경 등 조별 공지를 남길 수 있습니다.
        </div>
        <textarea class="form-textarea" id="mGMemoInput" placeholder="조별 운영 메모를 입력하세요"></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-gray" onclick="cm('mGMemo')">닫기</button>
        <button class="btn btn-outline" onclick="clearGroupMemoModal()">지우기</button>
        <button class="btn btn-primary" onclick="saveGroupMemoModal()">💾 저장</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click',e=>{ if(e.target===wrap) wrap.classList.remove('open'); });
}
function openGroupMemoModal(key,gi){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 조 공지 입력 가능','info'); return; }
  ensureGroupMemoModal();
  GM_MODAL={key,gi};
  ge('mGMemoT').textContent=`📢 ${grpLabel(gi)} 공지`;
  ge('mGMemoInput').value=getGroupMemo(key,gi);
  om('mGMemo');
}
async function saveGroupMemoModal(){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 저장 가능','info'); return; }
  const {key,gi}=GM_MODAL;
  if(key==null || gi==null) return;
  if(!G.draws[key] || !G.draws[key].groups || !G.draws[key].groups[gi]){ toast('추첨 데이터가 없습니다','error'); return; }
  G.draws[key].groups[gi].memo = (ge('mGMemoInput')?.value||'').trim();
  sl(true);
  try{
    await stD(key);
    sl(false);
    toast('조 공지 저장 ✅','success');
    cm('mGMemo');
    renderBracket();
  }catch(e){
    sl(false);
    toast('메모 저장 실패: '+e.message,'error');
  }
}
async function clearGroupMemoModal(){
  if(!canManageBracket()){ toast('관리자 또는 경기진행자만 저장 가능','info'); return; }
  if(ge('mGMemoInput')) ge('mGMemoInput').value='';
}
window.openGroupMemoModal = openGroupMemoModal;
window.saveGroupMemoModal = saveGroupMemoModal;
window.clearGroupMemoModal = clearGroupMemoModal;

// ─── 과거 대회 요강 업로드 (관리자용) ───────────────────────────────
window.HIST_GUIDE_PENDING = []; // File 객체 임시 보관

async function onHistGuideFilesSelected(input){
  const files = [...(input.files||[])];
  if(!files.length) return;
  for(const f of files){
    if(f.size > 15*1024*1024){ toast(`파일이 너무 큽니다(최대 15MB): ${f.name}`, 'error'); continue; }
    window.HIST_GUIDE_PENDING.push(f);
  }
  renderHistGuidePending();
  input.value='';
}

function renderHistGuidePending(){
  const box = ge('histGuidePreview');
  if(!box) return;
  const arr = window.HIST_GUIDE_PENDING;
  if(!arr.length){ box.innerHTML=''; return; }
  box.innerHTML = `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">` +
    arr.map((f,i)=>`
      <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:white;border:1px solid var(--border);border-radius:8px;font-size:.75rem">
        <span>${f.type.startsWith('image/')?'🖼️':'📄'} ${f.name}</span>
        <span style="color:var(--text3)">${(f.size/1024).toFixed(0)}KB</span>
        <button onclick="removeHistGuidePending(${i})" style="background:none;border:none;cursor:pointer;color:#e74c3c;font-size:.8rem;padding:0">✕</button>
      </div>`).join('') +
    `</div>`;
}

function removeHistGuidePending(idx){
  window.HIST_GUIDE_PENDING.splice(idx,1);
  renderHistGuidePending();
}

async function uploadHistGuideFiles(){
  const tid = ge('histGuideUploadBar')?.dataset?.tid || ge('rankTS').value;
  if(!tid){ toast('대회를 먼저 선택하세요','error'); return; }
  const files = window.HIST_GUIDE_PENDING;
  if(!files.length){ toast('업로드할 파일을 선택하세요','info'); return; }

  sl(true);
  let ok=0, fail=0;
  for(const file of files){
    try{
      const fileName = `${Date.now()}_${file.name}`;
      const fileRef = ref(storage, `guides/${tid}/${fileName}`);
      await uploadBytes(fileRef, file);
      ok++;
      toast(`✅ ${file.name} 업로드 완료`,'success');
    }catch(e){
      fail++;
      toast(`❌ ${file.name} 실패: ${e.message}`,'error');
    }
  }
  sl(false);
  window.HIST_GUIDE_PENDING=[];
  renderHistGuidePending();
  ge('histGuideFileInput').value='';
  toast(`업로드 완료: ${ok}개 성공${fail?', '+fail+'개 실패':''}`,'success');

  // tourGuides 컬렉션 hasGuideAssets 플래그 업데이트 (과거 대회 요강 표시용)
  // hist_XX는 Firestore tournaments 문서가 없으므로 별도 처리
  try{
    await setDoc(doc(db,'tourGuides',tid),{hasGuideAssets:true,updatedAt:serverTimestamp()},{merge:true});
  }catch(e){}
}

// ─── 업로드 현황 모달 ────────────────────────────────────────────
async function manageHistGuide(){
  const tid = ge('histGuideUploadBar')?.dataset?.tid || ge('rankTS').value;
  if(!tid){ toast('대회를 먼저 선택하세요','error'); return; }

  ensureHistGuideModal();
  const t = [...G.tournaments,...HIST_DATA].find(t=>t.id===tid);
  ge('mHGT').textContent = `📂 요강 파일 관리 — ${t?.name||tid}`;
  ge('mHGB').innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">로딩 중...</div>';
  om('mHGModal');

  try{
    const folderRef = ref(storage, `guides/${tid}`);
    const res = await listAll(folderRef);
    if(!res.items.length){
      ge('mHGB').innerHTML='<div style="text-align:center;padding:24px;color:var(--text3)">업로드된 요강 파일이 없습니다</div>';
      return;
    }
    const items = await Promise.all(res.items.map(async item=>{
      const url = await getDownloadURL(item);
      return {name:item.name, url, ref:item};
    }));
    ge('mHGB').innerHTML = `<div style="display:flex;flex-direction:column;gap:7px">` +
      items.map((item,i)=>`
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:white">
          ${item.name.match(/\.(png|jpg|jpeg|gif|webp)$/i)
            ? `<img src="${item.url}" style="width:60px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">`
            : `<div style="width:60px;height:44px;background:var(--bg2);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.4rem">📄</div>`}
          <div style="flex:1;min-width:0">
            <div style="font-size:.78rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.name.replace(/^\d+_/,'')}</div>
            <a href="${item.url}" target="_blank" style="font-size:.68rem;color:var(--primary)">🔗 미리보기</a>
          </div>
          <button class="btn btn-danger" style="font-size:.72rem;padding:4px 10px;white-space:nowrap" onclick="deleteHistGuideFile('${tid}','${item.name}',this)">🗑️ 삭제</button>
        </div>`).join('') +
      `</div>`;
  }catch(e){
    ge('mHGB').innerHTML=`<div style="text-align:center;padding:24px;color:var(--text3)">불러오기 실패: ${e.message}</div>`;
  }
}

async function deleteHistGuideFile(tid, fileName, btn){
  if(!confirm(`"${fileName.replace(/^\d+_/,'')}" 을(를) 삭제하시겠습니까?`)) return;
  try{
    btn.disabled=true; btn.textContent='삭제 중...';
    const fileRef = ref(storage, `guides/${tid}/${fileName}`);
    await deleteObject(fileRef);
    toast('삭제 완료','success');
    manageHistGuide(); // 새로고침
  }catch(e){ toast('삭제 실패: '+e.message,'error'); btn.disabled=false; btn.textContent='🗑️ 삭제'; }
}

function ensureHistGuideModal(){
  if(ge('mHGModal')) return;
  const wrap=document.createElement('div');
  wrap.className='modal-overlay';
  wrap.id='mHGModal';
  wrap.innerHTML=`
    <div class="modal-box" style="max-width:580px">
      <div class="modal-header">
        <h3 id="mHGT">📂 요강 파일 관리</h3>
        <button class="modal-close" onclick="cm('mHGModal')">✕</button>
      </div>
      <div class="modal-body" id="mHGB" style="max-height:70vh;overflow-y:auto"></div>
      <div class="modal-footer">
        <button class="btn btn-gray" onclick="cm('mHGModal')">닫기</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click',e=>{ if(e.target===wrap) wrap.classList.remove('open'); });
}

// ── 홈 탭 등록선수 버튼 카운트 업데이트 ──────────────────────
window.renderHomeReg = function(){
  const count = getMemberRegistry2026().length;
  const el = ge('homeRegCount');
  if(el) el.textContent = count ? `총 ${count}명` : '';
};

// ── 등록선수 현황 모달 열기 (일반 회원용) ─────────────────────
window.openRegViewer = function(){
  const titleEl = ge('mRegViewerTitle');
  if(titleEl) titleEl.textContent = `🧾 ${REG_YEAR}년 등록선수 현황`;
  if(ge('mRegViewerSearch')) ge('mRegViewerSearch').value = '';
  window.renderRegViewer();
  document.getElementById('mRegViewer')?.classList.add('open');
};

window.renderRegViewer = function(){
  const statEl = ge('mRegViewerStat');
  const bodyEl = ge('mRegViewerBody');
  if(!bodyEl) return;

  const rows = getMemberRegistry2026();
  const keyword = (ge('mRegViewerSearch')?.value||'').trim().toLowerCase();

  if(!rows.length){
    bodyEl.innerHTML = `<div style="color:var(--text3);padding:24px 0;text-align:center">${REG_YEAR}년 등록 선수 명단이 없습니다</div>`;
    if(statEl) statEl.textContent = '';
    return;
  }

  // 클럽별 그룹핑
  const clubMap = new Map();
  rows.forEach(r=>{
    const club = _m26Club(r.club)||r.club||'기타';
    const name = (r.name||'').trim();
    if(!name) return;
    if(keyword && !name.toLowerCase().includes(keyword) && !club.toLowerCase().includes(keyword)) return;
    if(!clubMap.has(club)) clubMap.set(club,[]);
    clubMap.get(club).push(r);
  });

  const clubs = [...clubMap.keys()].sort((a,b)=>a.localeCompare(b,'ko'));
  const totalShown = clubs.reduce((s,c)=>s+clubMap.get(c).length, 0);

  if(statEl) statEl.textContent = keyword
    ? `전체 ${rows.length}명 중 ${totalShown}명`
    : `총 ${rows.length}명 · ${clubMap.size}개 클럽`;

  if(!clubs.length){
    bodyEl.innerHTML = `<div style="color:var(--text3);padding:24px 0;text-align:center">검색 결과가 없습니다</div>`;
    return;
  }

  bodyEl.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px">
      ${clubs.map(club=>{
        const members = clubMap.get(club);
        return `<div style="background:var(--panel2);border-radius:var(--radius);padding:8px 10px;border:1px solid var(--border)">
          <div style="font-weight:700;font-size:.8rem;color:var(--primary-dark);margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
            <span>${club}</span>
            <span style="font-weight:400;color:var(--text3);font-size:.75rem">${members.length}명</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${members.map(m=>`<span style="background:var(--bg);border:1px solid var(--border);border-radius:20px;padding:2px 8px;font-size:.73rem;color:var(--text)">${m.name}</span>`).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>`;
};

// Storage 함수들을 window에 노출 (모듈 스코프 → 전역 접근용)
window._storage = storage;
window._storageRef = ref;
window._uploadBytes = uploadBytes;
window._getDownloadURL = getDownloadURL;
window._listAll = listAll;
window._deleteObject = deleteObject;

// ──────────────────────────────────────────────────────────────
// 📥 과거대회 엑셀 업로드 → Firestore(histTournaments/histTeams)
//  - SheetJS(xlsx) 동적 로드
//  - 엑셀에서 "금배/은배/동배/테린이/여성부" 블록 자동 파싱
// ──────────────────────────────────────────────────────────────
function _rankToNum(v){
  const s=(v??'').toString().trim();
  if(!s) return null;
  if(/공동\s*3/.test(s)) return 3;
  const m=s.match(/(\d+)\s*위/);
  if(m) return parseInt(m[1],10);
  const n=parseInt(s,10);
  return Number.isFinite(n)?n:null;
}
function _divToLegacyKey(label){
  const s=(label||'').toString();
  if(/금/.test(s)) return 'gold';
  if(/은/.test(s)) return 'silver';
  if(/동/.test(s)) return 'bronze';
  if(/테린이/.test(s)) return 'terinee';
  if(/여성/.test(s)) return 'women';
  return s;
}
function _divToUIKey(legacy){
  return ({gold:'금',silver:'은',bronze:'동',terinee:'테린이',women:'women'}[legacy]||legacy);
}
async function ensureXLSX(){
  // head에 미리 로드됨 - 혹시 아직 로드 안됐으면 대기
  if(window.XLSX) return;
  await new Promise((res,rej)=>{
    let tries=0;
    const t=setInterval(()=>{
      if(window.XLSX){clearInterval(t);res();}
      else if(++tries>50){clearInterval(t);rej(new Error('SheetJS 로드 실패. 네트워크를 확인해주세요.'));}
    },100);
  });
}
function _sheetToGrid(ws){
  const range = XLSX.utils.decode_range(ws['!ref']||'A1:A1');
  const grid=[];
  for(let r=range.s.r;r<=range.e.r;r++){
    const row=[];
    for(let c=range.s.c;c<=range.e.c;c++){
      const cell=ws[XLSX.utils.encode_cell({r,c})];
      let v=cell?cell.v:null;
      if(typeof v==='string') v=v.trim();
      row.push(v);
    }
    grid.push(row);
  }
  return grid;
}
function _findDivisionBlocks(grid){
  const blocks=[];
  const rx=/(금배|은배|동배|테린이|여성부)\s*\(?\d*\)?/;
  for(let r=0;r<grid.length;r++){
    for(let c=0;c<(grid[r]||[]).length;c++){
      const v=grid[r][c];
      if(typeof v==='string' && rx.test(v)) blocks.push({divLabel:v,row:r,col:c});
    }
  }
  blocks.sort((a,b)=>a.row-b.row||a.col-b.col);
  return blocks;
}
function _parseBlock(grid, block){
  const div=_divToLegacyKey(block.divLabel);
  const headerRow=block.row+1;
  const clubRow=grid[headerRow]||[];
  const clubs=[];
  const start=block.col+1;
  for(let c=start;c<clubRow.length;c++){
    const v=clubRow[c];
    if(v==null || v==='') break;
    clubs.push({name:String(v).trim(), col:c});
  }
  if(!clubs.length) return {div, teams:[]};

  // rank row: contains "시합결과"
  let rankRowIdx=-1;
  for(let r=headerRow+1;r<Math.min(grid.length, headerRow+250);r++){
    const row=grid[r]||[];
    if(row.some(x=>String(x||'').replace(/\s/g,'')==='시합결과')){ rankRowIdx=r; break; }
    if(row.some(x=>typeof x==='string' && /(금배|은배|동배|테린이|여성부)/.test(x))) break;
  }
  const rankByClub={};
  if(rankRowIdx>=0){
    clubs.forEach(cl=>{
      const v=(grid[rankRowIdx]||[])[cl.col];
      const rk=_rankToNum(v);
      if(rk!=null) rankByClub[cl.name]=rk;
    });
  }

  const playersByClub={}; clubs.forEach(cl=>playersByClub[cl.name]=[]);
  const endRow = rankRowIdx>=0 ? rankRowIdx : grid.length;
  for(let r=headerRow+1;r<endRow;r++){
    const row=grid[r]||[];
    // 종료 조건: 클럽 영역이 연속으로 비면 중단
    const allEmpty = clubs.every(cl=> (row[cl.col]==null || row[cl.col]===''));
    if(allEmpty) continue;
    clubs.forEach(cl=>{
      const v=row[cl.col];
      if(v==null || v==='') return;
      const name=String(v).trim();
      // 선수 이름 필터: 숫자만, 전화번호, 1자 이하, '시합결과' 제외
      if(!name || name==='시합결과') return;
      if(/^\d+[-\d]*\d*$/.test(name.replace(/\s/g,''))) return; // 전화번호/숫자
      if(/^\d+$/.test(name)) return; // 순수 숫자
      if(name.length < 2) return; // 1자 이하
      playersByClub[cl.name].push(name);
    });
  }

  const teams = clubs.map(cl=>({
    club: cl.name,
    div,
    players: playersByClub[cl.name].filter(Boolean),
    rank: rankByClub[cl.name] ?? null
  })).filter(t=>t.players.length>0 || t.rank!=null);

  return {div, teams};
}
async function loadHistFromDB(){ /* no longer used: historical tournaments are stored in tournaments/registrations */ return; }


// 파일 선택 시 내용 미리보기
async function previewHistExcel(input){
  const f = input?.files?.[0];
  const preview = ge('histExcelPreview');
  if(!f || !preview){ if(preview) preview.style.display='none'; return; }
  try{
    await ensureXLSX();
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, {type:'array'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const grid = _sheetToGrid(ws);
    const blocks = _findDivisionBlocks(grid);
    if(!blocks.length){ preview.innerHTML='⚠️ 부서 블록(금배조/은배조 등)을 찾지 못했습니다. 파일 형식을 확인하세요.'; preview.style.display='block'; return; }
    
    let totalTeams=0, totalPlayers=0;
    const divSummary=[];
    blocks.forEach(b=>{
      const res=_parseBlock(grid,b);
      const uiDiv=_divToUIKey(res.div);
      const teams=res.teams||[];
      totalTeams+=teams.length;
      const players=teams.reduce((s,t)=>s+(t.players?.length||0),0);
      totalPlayers+=players;
      divSummary.push(`${uiDiv}배 ${teams.length}팀 ${players}명`);
    });
    
    // 동명이인 감지
    const nameClubMap=new Map();
    const dups=new Set();
    blocks.forEach(b=>{
      const res=_parseBlock(grid,b);
      (res.teams||[]).forEach(t=>{
        (t.players||[]).forEach(name=>{
          const key=name;
          if(!nameClubMap.has(key)) nameClubMap.set(key,[]);
          nameClubMap.get(key).push(t.club);
        });
      });
    });
    nameClubMap.forEach((clubs,name)=>{ if(new Set(clubs).size>1) dups.add(name); });
    
    const dupHtml = dups.size>0
      ? `<div style="color:#d97706;margin-top:6px">⚠️ 동명이인 ${dups.size}명: ${[...dups].join(', ')}</div>`
      : '<div style="color:#16a34a;margin-top:6px">✅ 동명이인 없음</div>';
    
    preview.innerHTML=`<b>📋 미리보기</b><br>${divSummary.join(' · ')}<br>총 ${totalTeams}팀 ${totalPlayers}명${dupHtml}`;
    preview.style.display='block';
  }catch(e){
    if(preview){ preview.innerHTML='파일 분석 실패: '+e.message; preview.style.display='block'; }
  }
}

// ── 복합 엑셀 파서: 여러 대회 + 부서 가로 배치 형식 ─────────────
// (2022~2023 클럽대항 형식: 대회제목행 → 금배/은배/동배 가로 배치 → 결과행)
function _parseMultiTournamentExcel(grid){
  const tourn_list = [];

  function cleanName(v){
    if(v==null) return '';
    const s = String(v).replace(/\s+/g,'').replace(/,+$/,'').trim();
    return (s.length>=2 && !/^\d+$/.test(s)) ? s : '';
  }
  function normClub(c){
    if(!c) return '';
    c = String(c).replace(/\s*[A-Da-d]$/, '').trim();
    const m={'한별':'테사모','위드':'불사조','한울':'하모니','더블폴트':'로패','어메이징':'아테','LT':'LTC'};
    return m[c]||c;
  }
  function rankNum(s){
    s=String(s||'').trim();
    if(s==='우승') return 1;
    if(s.includes('준우승')) return 2;
    if(s.includes('3위')) return 3;
    if(s.includes('최하위')) return 99;
    return null;
  }

  // 대회 제목 행 찾기 (날짜 패턴 포함)
  const dateRx = /(\d{4})\.(\d{2})\.(\d{2})/;
  const titleRows = [];
  for(let i=0;i<grid.length;i++){
    const flat=(grid[i]||[]).map(v=>String(v||'')).join(' ');
    const dm=flat.match(dateRx);
    if(dm) titleRows.push({row:i, date:`${dm[1]}-${dm[2]}-${dm[3]}`, text:flat});
  }
  if(!titleRows.length) return null; // 이 형식 아님

  for(let ti=0;ti<titleRows.length;ti++){
    const {row:titleRow, date, text} = titleRows[ti];
    const endRow = ti+1<titleRows.length ? titleRows[ti+1].row : grid.length;

    let tname='', ttype='';
    if(text.includes('시장기')) ttype='시장기';
    else if(text.includes('협회장기')||text.includes('협회장')) ttype='협회장기';
    else ttype='대회';
    const yr=date.slice(0,4);
    const seqM=text.match(/제(\d+)회/);
    const seq2=seqM?seqM[1]:'';
    if(seq2){
      tname=ttype==='시장기'
        ?`제${seq2}회 김해시장기 테니스대회`
        :`제${seq2}회 김해시테니스협회장기 테니스대회`;
    } else { tname=`${yr} ${ttype}`; }

    // 헤더 행 찾기 (금배/은배/동배 포함)
    let hdrRow=-1;
    const DIV_KEYS=['금배','은배','동배','테린이','여성부','여성'];
    const DIV_NORM={'금배':'금','은배':'은','동배':'동','테린이':'테린이','여성부':'여성부','여성':'여성부'};
    for(let r=titleRow+1;r<endRow;r++){
      const vals=(grid[r]||[]).map(v=>String(v||'').trim());
      if(DIV_KEYS.some(k=>vals.includes(k))){ hdrRow=r; break; }
    }
    if(hdrRow<0) continue;

    // 결과 행 찾기 ('결과' 포함)
    let resRow=-1;
    for(let r=hdrRow+1;r<endRow;r++){
      const v=String((grid[r]||[])[0]||'').trim();
      if(v==='결과'){ resRow=r; break; }
    }
    if(resRow<0) resRow=endRow-1;

    // 컬럼 → (div, club) 매핑
    const colMap={};
    let curDiv='';
    const hdr=grid[hdrRow]||[];
    for(let ci=0;ci<hdr.length;ci++){
      const sv=String(hdr[ci]||'').trim();
      if(DIV_KEYS.includes(sv)){ curDiv=DIV_NORM[sv]||sv; continue; }
      if(sv && sv!=='번호/클럽명' && curDiv){
        const club=normClub(sv);
        if(club) colMap[ci]={div:curDiv,club};
      }
    }

    // 순위 수집
    const colRank={};
    if(resRow>=0){
      const rr=grid[resRow]||[];
      for(const ci in colMap){
        const rk=rankNum(rr[ci]);
        if(rk) colRank[ci]=rk;
      }
    }

    // 선수 수집
    const clubPlayers={};
    for(const ci in colMap) clubPlayers[ci]=[];
    for(let r=hdrRow+1;r<resRow;r++){
      const row=grid[r]||[];
      for(const ci in colMap){
        const name=cleanName(row[ci]);
        if(name && !clubPlayers[ci].includes(name)) clubPlayers[ci].push(name);
      }
    }

    // 팀 조합
    const teams=[];
    for(const ci in colMap){
      const {div,club}=colMap[ci];
      const players=clubPlayers[ci]||[];
      const rank=colRank[ci]||null;
      if(players.length||rank) teams.push({club,div,players,rank});
    }

    tourn_list.push({tname,date,teams});
  }
  return tourn_list.length ? tourn_list : null;
}

async function uploadHistFromExcel(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const f=ge('histExcelFile')?.files?.[0];
  const tname=(ge('histExcelName')?.value||'').trim();
  const date=(ge('histExcelDate')?.value||'').trim();
  const seq=parseInt((ge('histExcelSeq')?.value||'').trim()||'0',10)||null;
  const type=(ge('histExcelType')?.value||'').trim();
  const overwrite = !!ge('histExcelOverwrite')?.checked;

  if(!f){ toast('파일을 선택해주세요','error'); return; }

  sl(true);
  try{
    toast('엑셀 파싱 중...','info');
    await ensureXLSX();
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, {type:'array'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const grid = _sheetToGrid(ws);

    // ── 다중 대회 형식 자동 감지 ──
    const multiResult = _parseMultiTournamentExcel(grid);
    if(multiResult){
      // 다중 대회 형식: 대회명/일자 자동 추출, 한 번에 저장
      toast(`${multiResult.length}개 대회 파싱 완료, Firebase 저장 중...`,'info');
      let totalAdded=0, totalTeams=0;
      for(const tourn of multiResult){
        const t_tname = tourn.tname;
        const t_date  = tourn.date;
        const t_tid   = 'hist_'+t_tname.replace(/[\s　]/g,'_').replace(/[^\w가-힣]/g,'');
        const parsedTeams = tourn.teams;
        totalTeams += parsedTeams.length;

        const regSnap2 = await getDocs(collection(db,'registrations'));
        const existingRegs2 = regSnap2.docs.map(d=>({id:d.id,...d.data()}));
        const existingKeySet2 = new Set(existingRegs2
          .filter(r=>r.tournamentId===t_tid)
          .map(r=>`${r.division}||${r.club}`));

        const divisions2=[...new Set(parsedTeams.map(t=>t.div))].filter(Boolean);
        const divSettings2={};
        divisions2.forEach(d=>divSettings2[d]={format:'group_knockout',grpSize:4,advance:2});
        await setDoc(doc(db,'tournaments',t_tid),{
          ownerUid: auth.currentUser?.uid || '',
          ownerEmail: auth.currentUser?.email || '',
          name:t_tname, date:t_date, venue:'', deadline:'',
          divisions:divisions2, format:'group_knockout',
          grpSize:4, advance:2, divSettings:divSettings2,
          notice:'', status:'finished', isHistorical:true,
          histType:t_tname.includes('시장기')?'시장기':'협회장기',
          updatedAt:serverTimestamp(), createdAt:serverTimestamp()
        },{merge:true});

        const batch2=writeBatch(db);
        if(overwrite) existingRegs2.forEach(r=>{ if(r.tournamentId===t_tid) batch2.delete(doc(db,'registrations',r.id)); });
        let addCnt2=0;
        for(const tm of parsedTeams){
          const k=`${tm.div}||${tm.club}`;
          if(!overwrite && existingKeySet2.has(k)) continue;
          batch2.set(doc(collection(db,'registrations')),{
            tournamentId:t_tid, division:tm.div, club:tm.club,
            players:tm.players, rank:(typeof tm.rank==='number'?tm.rank:null),
            registeredAt:new Date().toISOString(),
            updatedAt:new Date().toISOString(), isHistorical:true
          });
          addCnt2++;
        }
        await batch2.commit();
        totalAdded+=addCnt2;

        // 선수 history 반영
        for(const tm of parsedTeams){
          for(const pname of (tm.players||[])){
            try{ await regP(pname, tm.club, t_tid, tm.div, tm.rank, t_tname, t_date); }catch(e){}
          }
        }
        toast(`${t_tname} 저장 완료 (${addCnt2}팀)`,'info');
      }
      sl(false);
      toast(`✅ ${multiResult.length}개 대회 / ${totalTeams}팀 / ${totalAdded}팀 추가 완료`,'success');
      await fbLog(`과거대회 다중 업로드: ${multiResult.map(t=>t.tname).join(', ')}`, '📥');
      return;
    }

    // ── 기존 단일 대회 형식 ──
    // 파일 1행에서 대회명/날짜 자동 추출 시도
    let autoName = tname, autoDate = date;
    if(!autoName || !autoDate){
      const firstCell = (grid[0]||[])[0];
      if(firstCell && typeof firstCell==='string'){
        const dm = firstCell.match(/(\d{4}-\d{2}-\d{2})/);
        if(dm && !autoDate) autoDate = dm[1];
        if(!autoName){
          const candidate = firstCell.replace(/\(?\d{4}-\d{2}-\d{2}\)?/g,'').replace(/[()（）]/g,'').trim();
          // 부서명(테린이/금배 등)이면 무시
          if(candidate && !['테린이','금배','은배','동배','여성부'].includes(candidate)){
            autoName = candidate;
          }
        }
      }
    }
    if(!autoName){ sl(false); toast('대회명을 입력해 주세요','error'); return; }
    if(!autoDate){ sl(false); toast('대회 날짜를 입력해 주세요','error'); return; }
    const tid = (ge('histExcelId')?.value||'').trim() || ('hist_'+(autoDate.replace(/-/g,'')));

    const blocks=_findDivisionBlocks(grid);
    if(!blocks.length){ throw new Error('부서(금배/은배/동배/테린이/여성부) 블록을 찾지 못했습니다'); }

    // legacy div -> UI div (금/은/동/테린이/여성부)
    const parsedTeams=[];
    blocks.forEach(b=>{
      const res=_parseBlock(grid,b);
      (res.teams||[]).forEach(t=>{
        const uiDiv = _divToUIKey(t.div);
        parsedTeams.push({club:t.club, div:uiDiv, players:(t.players||[]).filter(Boolean), rank:t.rank});
      });
    });

    if(!parsedTeams.length){ throw new Error('추출된 팀/선수 데이터가 없습니다'); }

    // ── 0) 기존 등록팀 조회(중복 스킵/덮어쓰기용) ──
    const regSnap = await getDocs(collection(db,'registrations'));
    const existingRegs = regSnap.docs.map(d=>({id:d.id, ...d.data()}));
    const existingKeySet = new Set(existingRegs
      .filter(r=>r.tournamentId===tid)
      .map(r=>`${r.division}||${r.club}`));

    // ── 1) 대회(tournaments) 문서 upsert (기존 규칙 그대로 사용 가능) ──
    const divisions = [...new Set(parsedTeams.map(t=>t.div))].filter(Boolean);
    const divSettings = {};
    divisions.forEach(d=>divSettings[d]={format:'group_knockout', grpSize:4, advance:2});
    await setDoc(doc(db,'tournaments',tid), {
      ownerUid: auth.currentUser?.uid || '',
      ownerEmail: auth.currentUser?.email || '',
      name: autoName,
      date: autoDate,
      venue: '',
      deadline: '',
      divisions,
      format: 'group_knockout',
      grpSize: 4,
      advance: 2,
      divSettings,
      notice: '',
      status: 'finished',
      isHistorical: true,
      histType: type||'',
      histSeq: seq||null,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }, {merge:true});

    // ── 2) registrations: 덮어쓰기면 기존 tournamentId 데이터 삭제 ──
    const batch = writeBatch(db);

    if(overwrite){
      existingRegs.forEach(r=>{
        if(r.tournamentId===tid){
          batch.delete(doc(db,'registrations', r.id));
        }
      });
    }

    // ── 3) registrations 추가(또는 스킵) ──
    let addCnt=0, skipCnt=0;
    for(const tm of parsedTeams){
      const k = `${tm.div}||${tm.club}`;
      if(!overwrite && existingKeySet.has(k)){
        skipCnt++;
        continue;
      }
      const docRef = doc(collection(db,'registrations'));
      batch.set(docRef, {
        tournamentId: tid,
        division: tm.div,
        club: tm.club,
        players: tm.players,
        rank: tm.rank ?? null,
        registeredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isHistorical: true
      });
      addCnt++;
    }

    await batch.commit();

    // ── 4) players 문서에도 history 반영 ──
    // 소속(key/clubs)은 baseClub("하모니A"→"하모니")으로 통일
    // 이력(history)에는 원본 팀명("하모니A") 보존
    for(const tm of parsedTeams){
      const bc=baseClub(tm.club);
      for(const pn of (tm.players||[])){
        const k=pKey(pn, bc);
        if(!G.players[k]) G.players[k]={clubs:[bc],history:[],wins:0,losses:0,name:pn,club:bc};
        const p=G.players[k];
        if(!p.clubs) p.clubs=[];
        if(!p.clubs.includes(bc)) p.clubs.push(bc);
        if(!p.history) p.history=[];
        if(!p.history.find(h=>h.tid===tid && h.div===tm.div && h.club===tm.club)){
          const rankStr=tm.rank===1?'우승':tm.rank===2?'준우승':tm.rank===3?'3위':tm.rank===99?'최하위':'참가';
          p.history.push({tid,tname:autoName,date:autoDate,club:tm.club,baseClub:bc,div:tm.div,result:rankStr,rank:tm.rank||null});
        }
        await stP(k);
      }
    }

    await fbLog(`과거대회 업로드: ${autoName} (${addCnt}팀${skipCnt?`, 스킵 ${skipCnt}`:''})`,'📥');

    sl(false);
    // ✅ 모달 닫기 전에 toast 먼저 표시
    const msg = overwrite
      ? `☁️ "${autoName}" 저장 완료! (${addCnt}팀)`
      : `☁️ "${autoName}" 저장 완료! (추가 ${addCnt}팀${skipCnt?`, 스킵 ${skipCnt}`:''}팀)`;
    toast(msg, 'success');

    // UI 갱신 후 모달 닫기
    popSel();
    renderAllP();
    popCF();
    setTimeout(()=>cm('mHistExcel'), 800); // toast 보이고 나서 닫기
  }catch(e){
    console.error(e);
    sl(false);
    toast('업로드 실패: '+(e?.message||e),'error');
  }
}



// ──────────────────────────────────────────────────────────────

// ── 대회별 개별 삭제 모달 ──────────────────────────────────────────
function openSelectiveClearModal(){
  cm('mAdminSettings');
  const container=ge('scTournList');
  if(!container) return;

  // Firebase 대회 + 과거 업로드 대회(isHistorical) 모두 표시
  const allT=[...G.tournaments].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(!allT.length){
    container.innerHTML='<p style="color:var(--text3);text-align:center;padding:20px">등록된 대회가 없습니다</p>';
    om('mSelectiveClear'); return;
  }

  container.innerHTML=allT.map(t=>{
    const divs=(t.divisions||[]).join(', ');
    const teamCount=(t.divisions||[]).reduce((s,d)=>{return s+(G.teams[t.id+'_'+d]||[]).length;},0);
    const statusLabel=t.status==='finished'?'종료':t.status==='ongoing'?'진행중':t.status==='closed'?'마감':'접수중';
    const isHist=t.isHistorical;
    return `<div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px 14px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="flex:1">
          <div style="font-weight:700;font-size:.88rem">${t.name}${isHist?'<span style="font-size:.65rem;background:#e0e7ff;color:#3730a3;border-radius:4px;padding:1px 5px;margin-left:5px">과거</span>':''}</div>
          <div style="font-size:.73rem;color:var(--text2);margin-top:3px">📅 ${t.date} &nbsp;|&nbsp; ${statusLabel} &nbsp;|&nbsp; ${divs} &nbsp;|&nbsp; 팀수: ${teamCount}</div>
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <button class="btn btn-outline" style="font-size:.72rem;padding:5px 10px;white-space:nowrap" onclick="selectiveClearTournament('${t.id}','${t.name.replace(/'/g,'\'')}',false)">📊 기록만 삭제</button>
          <button class="btn btn-danger" style="font-size:.72rem;padding:5px 10px;white-space:nowrap" onclick="selectiveClearTournament('${t.id}','${t.name.replace(/'/g,'\'')}',true)">🗑️ 대회 전체삭제</button>
        </div>
      </div>
    </div>`;
  }).join('');

  om('mSelectiveClear');
}

/**
 * 대회별 개별 삭제
 * @param {string} tid - 대회 ID
 * @param {string} tname - 대회명 (확인 메시지용)
 * @param {boolean} deleteTournament - true: 대회 문서까지 삭제 / false: 경기·선수기록만 삭제
 */
async function selectiveClearTournament(tid, tname, deleteTournament){
  const msg = deleteTournament
    ? `"${tname}" 대회를 완전히 삭제합니다.\n\n삭제 항목:\n• 대회 정보\n• 팀 등록\n• 추첨 결과\n• 경기 기록\n• 선수 출전이력 & 승패\n\n계속하시겠습니까?`
    : `"${tname}" 대회의 기록만 삭제합니다.\n\n삭제 항목:\n• 경기 기록 (승패 차감)\n• 선수 출전이력\n• 선수 승패 수치\n\n유지 항목:\n• 대회 정보·팀등록은 유지됩니다\n\n계속하시겠습니까?`;
  if(!confirm(msg)) return;

  sl(true);
  cm('mSelectiveClear');
  try{
    const t=G.tournaments.find(x=>x.id===tid);
    const divList=(t?.divisions||['금','은','동','테린이','여성부']);
    const keys=divList.map(d=>tid+'_'+d);

    // ① 매치 승패 차감
    for(const key of keys) await resetMatchRecords(key);

    // ② registrations에서 선수 이력 제거
    const regSnap=await getDocs(query(collection(db,'registrations'),where('tournamentId','==',tid)));
    const affectedPlayerKeys=new Set();
    regSnap.docs.forEach(d=>{
      const reg=d.data()||{};
      (reg.players||[]).forEach(pn=>{
        const bc=baseClub(reg.club||'');
        const pk=pKey(pn,bc);
        if(G.players[pk]){
          G.players[pk].history=(G.players[pk].history||[]).filter(h=>h.tid!==tid);
          affectedPlayerKeys.add(pk);
        }
      });
    });
    await Promise.all([...affectedPlayerKeys].map(k=>stP(k)));

    // ③ Firestore batch 삭제
    const batch=writeBatch(db);
    if(deleteTournament){
      batch.delete(doc(db,'tournaments',tid));
      keys.forEach(k=>{
        batch.delete(doc(db,'teams',k));
        batch.delete(doc(db,'draws',k));
        batch.delete(doc(db,'matches',k));
      });
      regSnap.docs.forEach(d=>batch.delete(doc(db,'registrations',d.id)));
    } else {
      // 기록만 삭제: draws + matches만 지우고 teams/registrations는 유지
      keys.forEach(k=>{
        batch.delete(doc(db,'draws',k));
        batch.delete(doc(db,'matches',k));
      });
    }
    await batch.commit();

    sl(false);
    const msg2=deleteTournament?`"${tname}" 삭제 완료`:`"${tname}" 기록 삭제 완료`;
    toast(msg2,'info');
    await fbLog(msg2,'🗑️');

    // 모달 목록 갱신
    if(!deleteTournament) openSelectiveClearModal();

  }catch(e){
    sl(false);
    toast('삭제 실패: '+e.message,'error');
    console.error(e);
  }
}

// 🧹 개인 기록 정리(중복/삭제된 대회 제거) + 🧨 전체 리셋(관리자)
// ──────────────────────────────────────────────────────────────
async function cleanupPlayerHistories(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  if(!confirm('개인 기록을 정리합니다.\n- 삭제된 대회(tid 없음) 기록 제거\n- 같은 대회/부서/클럽 중복 제거\n계속하시겠습니까?')) return;

  sl(true);
  try{
    const liveTids = new Set((G.tournaments||[]).map(t=>t.id));
    const histTids = new Set((HIST_DATA||[]).map(t=>t.id));
    const keepTids = new Set([...liveTids, ...histTids]);

    const keys = Object.keys(G.players||{});
    let changed = 0;

    let batch = writeBatch(db);
    let ops = 0;

    for(const k of keys){
      const p = G.players[k];
      if(!p) continue;
      const hist = Array.isArray(p.history) ? p.history : [];

      let filtered = hist.filter(h=>{
        const tid = h?.tid;
        if(!tid) return true;
        return keepTids.has(tid);
      });

      const seen = new Set();
      const out = [];
      for(const h of filtered){
        const tid = h?.tid || '';
        const div = h?.div || '';
        const club = h?.baseClub || baseClub(h?.club||'') || (h?.club||'');
        const key = (tid||h?.tname||'') + '|' + div + '|' + club;
        if(seen.has(key)) continue;
        seen.add(key);
        out.push(h);
      }
      out.sort((a,b)=>((b?.date||'').localeCompare(a?.date||'')));

      const sameLen = out.length===hist.length;
      const same = sameLen && out.every((h,i)=>h===hist[i]);
      if(!same){
        p.history = out;
        changed++;

        const docId = k.replace(/[\/\.#\$\[\]]/g,'_');
        batch.set(doc(db,'players',docId), {...p, key:k}, {merge:true});
        ops++;

        if(ops>=400){
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }
      }
    }

    if(ops>0) await batch.commit();

    sl(false);
    toast(`정리 완료 ✅ (수정 ${changed}명)`, 'success');
    renderAllP();
  }catch(e){
    sl(false);
    console.error(e);
    toast('정리 실패: '+(e?.message||e), 'error');
  }
}

async function _deleteCollectionAll(colName){
  const snap = await getDocs(collection(db, colName));
  if(snap.empty) return 0;
  let deleted = 0;
  let batch = writeBatch(db);
  let ops = 0;
  for(const d of snap.docs){
    batch.delete(doc(db, colName, d.id));
    ops++; deleted++;
    if(ops>=450){
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if(ops>0) await batch.commit();
  return deleted;
}

async function hardResetAllData(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  if(!confirm('⚠️ 전체 리셋을 진행합니다.\n\n삭제 대상:\n- tournaments(대회)\n- registrations(팀등록)\n- draws(추첨)\n- matches(경기)\n- players(선수)\n- activityLog(활동로그)\n- tourGuides(요강메타)\n\n※ 이 작업은 되돌릴 수 없습니다.\n계속하시겠습니까?')) return;

  sl(true);
  try{
    const res = {};
    res.tournaments = await _deleteCollectionAll('tournaments');
    res.registrations = await _deleteCollectionAll('registrations');
    res.draws = await _deleteCollectionAll('draws');
    res.matches = await _deleteCollectionAll('matches');
    res.players = await _deleteCollectionAll('players');
    try{ res.activityLog = await _deleteCollectionAll('activityLog'); }catch(e){}
    try{ res.tourGuides  = await _deleteCollectionAll('tourGuides'); }catch(e){}

    G.tournaments = [];
    G.teams = {};
    G.draws = {};
    G.matches = {};
    G.players = {};
    G.log = [];

    popSel();
    renderTL();
    renderAllP();
    upDash();

    sl(false);
    toast(`전체 리셋 완료 ✅ (대회 ${res.tournaments||0}, 팀 ${res.registrations||0}, 경기 ${res.matches||0}, 선수 ${res.players||0})`, 'success');
    await fbLog('전체 리셋 실행','🧨');
  }catch(e){
    sl(false);
    console.error(e);
    toast('전체 리셋 실패: '+(e?.message||e), 'error');
  }
}


// ═══════════════════════════════════════════════════════════════
//  🗂️ 참가자 목록 시스템
// ═══════════════════════════════════════════════════════════════
const REGISTRY_2026_DEFAULT = []; // Firebase에서 관리 - 코드 내장 제거
let G_REGISTRY = {};
let REGISTRY_YEARS_LOADED = [];

// 유효 클럽 셋 - G.clubs 기반 동적 생성 (연도 무관)
function _getValidClubSet(){ return new Set(G.clubs||[]); }
// 연도별 버전 문자열 생성
function _registryVersion(year){ return `v${year}_r1`; }

function _isRegistryClean(members, version, year){
  if(!members||!members.length) return false;
  if(version !== _registryVersion(year)) return false;
  if(members.length < 10) return false; // 연도별 최소 인원 완화 (신규 연도 대비)
  // 정상 클럽 비율 체크
  const validClubs = _getValidClubSet();
  const validClub = members.filter(m=>validClubs.has(m.club||'')).length;
  return (validClub/members.length) >= 0.8;
}

async function loadRegistry(year){
  if(REGISTRY_YEARS_LOADED.includes(year)) return G_REGISTRY[year]||[];
  try{
    const loaded=await loadRegistryDocument({db,doc,getDoc,year});
    if(loaded.exists){
      if(!_isRegistryClean(loaded.members, loaded.version, year)){
        console.warn(`⚠️ memberRegistries/${year} 버전 불일치 - 그대로 사용`);
      }
      G_REGISTRY[year]=loaded.members;
    }else{
      G_REGISTRY[year]=[];
    }
    REGISTRY_YEARS_LOADED.push(year);
  }catch(e){
    G_REGISTRY[year]=[];
    REGISTRY_YEARS_LOADED.push(year);
  }
  return G_REGISTRY[year]||[];
}
async function saveRegistry(year){
  const members=G_REGISTRY[year]||[];
  await saveRegistryDocument({
    db,doc,setDoc,serverTimestamp,year,members,
    version:_registryVersion(year)
  });
}
async function getRegistryYears(){
  try{
    const snaps=await getDocs(collection(db,'memberRegistries'));
    const years=snaps.docs.map(d=>parseInt(d.id)).filter(y=>!isNaN(y)).sort();
    if(!years.includes(REG_YEAR)) years.push(REG_YEAR);
    return years.sort();
  }catch(e){ return [REG_YEAR]; }
}

// 탭 전환
const REGISTRY_TAB_CACHE={ yearsLoaded:false, yearsKey:'', filterKey:'' };
function switchPlayersTab(tab){
  ['records','registry'].forEach(t=>{
    const btn=ge('ptab-'+t); if(btn) btn.classList.toggle('active',t===tab);
    const c=ge('ptab-'+t+'-content'); if(c) c.style.display=(t===tab)?'':'none';
  });
  updatePlayersAdminControls();
  if(tab==='registry'){
    const b=ge('regTabBody');
    if(b && !b.dataset.ready){
      b.innerHTML='<div class="card" style="padding:22px;text-align:center;font-size:.9rem;color:var(--text2)">선수 명단을 불러오는 중입니다…</div>';
    }
    setTimeout(()=>initRegistryTab(),0);
  }
  if(tab==='records'){
    Promise.all([loadRegistry(2026), ensurePlayersLoaded(), ensureAllParticipationDataLoaded()]).then(()=>{ renderAllP(); popCF(); updatePlayersAdminControls(); }).catch(()=>{ renderAllP(); popCF(); updatePlayersAdminControls(); });
  }
}

async function initRegistryTab(force){
  updatePlayersAdminControls();
  const years=await getRegistryYears();
  const yearsKey=years.join('|');
  const yearSel=ge('regYearSel');
  if(yearSel && (!REGISTRY_TAB_CACHE.yearsLoaded || REGISTRY_TAB_CACHE.yearsKey!==yearsKey || force)){
    const prev=parseInt(yearSel.value||0);
    yearSel.innerHTML=years.map(y=>`<option value="${y}">${y}년</option>`).join('');
    const preferred=(prev && years.includes(prev))?prev:(years.includes(new Date().getFullYear())?new Date().getFullYear():years[years.length-1]);
    yearSel.value=preferred;
    REGISTRY_TAB_CACHE.yearsLoaded=true;
    REGISTRY_TAB_CACHE.yearsKey=yearsKey;
  }
  await renderRegistryTab(force);
}


async function renderRegistryTab(force){
  const regTabBody=ge('regTabBody');
  if(regTabBody && !regTabBody.dataset.ready){
    regTabBody.innerHTML='<div class="card" style="padding:22px;text-align:center;font-size:.9rem;color:var(--text2)">등록 선수 명단을 불러오는 중입니다…</div>';
  }
  const year=parseInt(ge('regYearSel')?.value||2026);

  // ✅ 선수등록 현황은 "현재 대회 참가자"가 아니라, 해당 연도 memberRegistries/{year}의 공식 등록명단만 표시한다.
  //    기존에는 collectLiveParticipantEntries()를 병합해서 대회 참가자가 섞이고, 클럽별 현황도 깨져 보였다.
  const registryMembers = await loadRegistry(year);
  const members = (registryMembers||[])
    .map((m, idx)=>({
      ...m,
      __idx: idx,
      name: cleanName(m.name||''),
      club: normalizeClub(m.club||''),
      region: String(m.region||'').trim(),
      subClub: String(m.subClub||'').trim(),
      source: 'registry'
    }))
    .filter(m=>m.name && m.club);

  const regions=[...new Set(members.map(m=>m.region).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
  const clubs=[...new Set(members.map(m=>m.club).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
  const filterKey=year+'__registry_only__'+regions.join('|')+'__'+clubs.join('|');
  const regSel=ge('regRegionSel');
  if(regSel && (force || REGISTRY_TAB_CACHE.filterKey!==filterKey)){
    const p=regSel.value;
    regSel.innerHTML='<option value="">전체 지역</option>'+regions.map(r=>`<option value="${escAttr(r)}">${esc(r)}</option>`).join('');
    if(p) regSel.value=p;
  }
  const clubSel=ge('regClubSel');
  if(clubSel && (force || REGISTRY_TAB_CACHE.filterKey!==filterKey)){
    const p=clubSel.value;
    clubSel.innerHTML='<option value="">전체 클럽</option>'+clubs.map(c=>`<option value="${escAttr(c)}">${esc(c)}</option>`).join('');
    if(p) clubSel.value=p;
  }
  REGISTRY_TAB_CACHE.filterKey=filterKey;

  const selRegion=ge('regRegionSel')?.value||'';
  const selClub=ge('regClubSel')?.value||'';
  const showSubOnly=ge('regShowSubOnly')?.checked||false;
  const keyword=(ge('regSearchInput')?.value||'').trim();

  const filtered=members.filter(m=>{
    if(selRegion&&m.region!==selRegion) return false;
    if(selClub&&m.club!==selClub) return false;
    if(showSubOnly&&!m.subClub) return false;
    if(keyword&&!(m.name||'').includes(keyword)&&!(m.club||'').includes(keyword)&&!(m.subClub||'').includes(keyword)&&!(m.region||'').includes(keyword)) return false;
    return true;
  });

  const subCount=filtered.filter(m=>m.subClub).length;
  const clubCount=[...new Set(filtered.map(m=>m.club))].length;
  const statEl=ge('regTabStat');
  if(statEl) statEl.innerHTML=`${year}년 공식 등록명단 · 총 <b>${filtered.length}</b>명 · <b>${clubCount}</b>클럽 · 부클럽 <b>${subCount}</b>명`;

  const body=ge('regTabBody');
  if(!body) return;

  if(!filtered.length){
    body.dataset.ready='1';
    body.innerHTML=buildRegistryEmptyState(year);
    return;
  }

  const sortedFiltered=filtered.slice().sort((a,b)=>{
    const cr=String(a.region||'소속 코트 미지정').localeCompare(String(b.region||'소속 코트 미지정'),'ko',{numeric:true});
    if(cr!==0) return cr;
    const cc=String(a.club||'소속 미상').localeCompare(String(b.club||'소속 미상'),'ko',{numeric:true});
    if(cc!==0) return cc;
    return String(a.name||'').localeCompare(String(b.name||''),'ko',{numeric:true});
  });

  body.innerHTML=buildRegistryRegionSections({
    members:sortedFiltered,
    year,
    admin:AD,
    escapeHtml:esc,
    escapeAttr:escAttr
  });
  body.dataset.ready='1';
}

async function exportRegistryFiltered(fmt){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  fmt = fmt || 'xlsx';
  const year=parseInt(ge('regYearSel')?.value||2026);
  const members=await loadRegistry(year);
  const selRegion=ge('regRegionSel')?.value||'';
  const selClub=ge('regClubSel')?.value||'';
  const showSubOnly=ge('regShowSubOnly')?.checked||false;
  const keyword=(ge('regSearchInput')?.value||'').trim();
  const filtered=members.filter(m=>{
    if(selRegion&&m.region!==selRegion) return false;
    if(selClub&&m.club!==selClub) return false;
    if(showSubOnly&&!m.subClub) return false;
    if(keyword&&!(m.name||'').includes(keyword)&&!(m.club||'').includes(keyword)) return false;
    return true;
  });
  if(!filtered.length){ toast('다운로드할 데이터가 없습니다','info'); return; }
  const label=selClub||selRegion||(showSubOnly?'부클럽':(year+'년전체'));
  const date=new Date().toISOString().substring(0,10);
  if(fmt==='csv'){
    const hdr=['지역구분','주클럽','회원명','부클럽'];
    const dataRows=filtered.map(m=>[m.region||'',m.club||'',m.name||'',m.subClub||'']);
    const allRows=[hdr,...dataRows];
    const csv=allRows.map(r=>r.map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='김해테니스_등록선수_'+label+'_'+date+'.csv';
    a.click();
    toast('CSV 저장 완료 📄','success');
    return;
  }
  await ensureXLSX();
  const wsData=[['지역구분','주클럽','회원명','부클럽']].concat(filtered.map(m=>[m.region||'',m.club||'',m.name||'',m.subClub||'']));
  const wb2=XLSX.utils.book_new();
  const ws2=XLSX.utils.aoa_to_sheet(wsData);
  ws2['!cols']=[{wch:12},{wch:14},{wch:10},{wch:14}];
  XLSX.utils.book_append_sheet(wb2,ws2,year+'년 등록명단');
  XLSX.writeFile(wb2,'김해테니스_등록선수_'+label+'_'+date+'.xlsx');
  toast('엑셀 저장 완료 📊','success');
}

// 명단 관리
async function openRegistryMgr(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const years=await getRegistryYears();
  const rmgrYearSel=ge('rmgrYearSel');
  if(rmgrYearSel){ rmgrYearSel.innerHTML=years.map(y=>`<option value="${y}">${y}년</option>`).join(''); rmgrYearSel.value=ge('regYearSel')?.value||2026; }
  const cs=ge('rmgr_club'); if(cs) cs.innerHTML=G.clubs.map(c=>`<option value="${c}">${c}</option>`).join('');
  // 일괄 변경용 클럽 셀렉트 채우기
  const bc=ge('rmgr_bulk_club'); if(bc) bc.innerHTML='<option value="">-- 클럽 선택 --</option>'+G.clubs.map(c=>`<option value="${c}">${c}</option>`).join('');
  await renderRegistryMgr(); om('mRegistryMgr');
}

function renderClubDefaultRegionManager(){
  const wrap=ge('clubDefaultRegionList');
  if(!wrap) return;
  const clubs=(G.clubs||[]).slice().sort((a,b)=>a.localeCompare(b,'ko'));
  if(!clubs.length){
    wrap.innerHTML='<div style="padding:10px;color:var(--text3);font-size:.78rem">등록된 클럽이 없습니다.</div>';
    return;
  }
  wrap.innerHTML=clubs.map((club,i)=>{
    const region=getClubDefaultRegion(G.meta,club);
    const phone=getClubContact(G.meta,club);
    return `<div style="display:grid;grid-template-columns:minmax(100px,1.1fr) minmax(120px,1fr) minmax(130px,1fr);gap:6px;align-items:center;padding:7px 8px;border:1px solid var(--border);border-radius:9px;background:#fff">
      <div style="font-size:.82rem;font-weight:800;color:var(--primary-dark)">${esc(club)}</div>
      <div style="font-size:.72rem;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(phone||'경기이사 연락처 미등록')}</div>
      <input class="form-input" id="club_default_region_${i}" data-club="${escAttr(club)}" value="${escAttr(region)}" placeholder="예) 국제 / 장유 / 동부" style="font-size:.78rem;padding:5px 7px">
    </div>`;
  }).join('');
}

async function saveAllClubDefaultRegions(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const inputs=[...(document.querySelectorAll('#clubDefaultRegionList [data-club]')||[])];
  if(!inputs.length){ toast('저장할 클럽이 없습니다','info'); return; }

  inputs.forEach(input=>{
    const club=(input.dataset.club||'').trim();
    const region=(input.value||'').trim();
    if(club) setClubDefaultRegion(G.meta,club,region);
  });

  sl(true);
  try{
    await saveMeta();
    sl(false);
    toast('클럽별 기본 소속코트 저장 완료되었습니다.','success');
    renderClubDefaultRegionManager();
  }catch(e){
    sl(false);
    toast('저장 실패: '+e.message,'error');
  }
}

function syncDefaultRegionEditor(){
  renderClubDefaultRegionManager();
}
async function saveClubDefaultRegionSetting(){
  return saveAllClubDefaultRegions();
}

async function applyDefaultRegionsToUnassigned(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const year=parseInt(ge('rmgrYearSel')?.value||2026);
  const members=await loadRegistry(year);

  (G.clubs||[]).forEach(club=>{
    if(getClubDefaultRegion(G.meta,club)) return;
    const inferred=inferClubRegionFromMembers(members,club,normalizeClub);
    if(inferred.region) setClubDefaultRegion(G.meta,club,inferred.region);
  });

  const result=applyClubDefaultRegions(G.meta,members,{onlyMissing:true});
  if(!result.changed){
    toast('기본 소속 코트를 적용할 미배정 선수가 없습니다','info');
    return;
  }
  if(!confirm(`소속 코트가 비어 있는 ${result.changed}명에게 클럽별 기본 소속 코트를 적용할까요?`)) return;
  G_REGISTRY[year]=result.members;
  sl(true);
  try{
    await saveRegistry(year);
    sl(false);
    toast(`${result.changed}명의 소속 코트를 자동 배정했습니다`,'success');
    try{ await renderRegistryMgr(); }catch(e){}
    try{ await renderRegistryTab(); }catch(e){}
    try{ renderAllP(); }catch(e){}
  }catch(e){
    sl(false);
    toast('저장 실패: '+e.message,'error');
  }
}

async function bulkChangeRegion(){
  const year=parseInt(ge('rmgrYearSel')?.value||2026);
  const club=(ge('rmgr_bulk_club')?.value||'').trim();
  const region=(ge('rmgr_bulk_region')?.value||'').trim();
  if(!club){ toast('클럽을 선택하세요','info'); return; }
  if(!region){ toast('변경할 지역을 입력하세요','info'); return; }
  const members=G_REGISTRY[year];
  if(!members){ toast('명단이 없습니다','info'); return; }
  let cnt=0;
  members.forEach(m=>{ if(m.club===club){ m.region=region; cnt++; } });
  if(!cnt){ toast(`${club} 소속 선수를 찾을 수 없습니다`,'info'); return; }
  await saveRegistry(year, members);
  toast(`✅ ${club} 소속 ${cnt}명의 지역을 "${region}"으로 변경했습니다`,'success');
  await renderRegistryMgr();
}
async function renderRegistryMgr(){
  const year=parseInt(ge('rmgrYearSel')?.value||2026);
  const members=await loadRegistry(year);
  const stat=ge('rmgrStat'); if(stat) stat.textContent=`총 ${members.length}명 (부클럽 ${members.filter(m=>m.subClub).length}명)`;
  const list=ge('rmgr_list'); if(!list) return;
  list.innerHTML=buildRegistryManagerTable({
    members,
    clubs:G.clubs||[],
    year,
    escapeHtml:esc
  });
}
// 선수 등록 현황 탭 — 빠른 추가
async function registryTabQuickAdd(){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const name=(ge('rtabAddName')?.value||'').trim();
  const club=(ge('rtabAddClub')?.value||'').trim();
  const subClub=(ge('rtabAddSubClub')?.value||'').trim();
  if(!name){ toast('이름을 입력하세요','error'); return; }
  if(!club){ toast('클럽을 선택하세요','error'); return; }
  const year=parseInt(ge('regYearSel')?.value||2026);
  const members=await loadRegistry(year);
  if(members.find(m=>m.name===name&&m.club===club)){ toast('이미 등록된 선수입니다','info'); return; }
  members.push(applyClubDefaultRegion(G.meta,{name,club,region:'',subClub:subClub||''}));
  if(!window.G_REGISTRY) window.G_REGISTRY={};
  G_REGISTRY[year]=members;
  // G.players에도 추가
  const key=pKey(name,club);
  if(!G.players[key]) G.players[key]={key,name,club,clubs:[club].concat(subClub?subClub.split(',').map(s=>normalizeClub(s.trim())).filter(Boolean):[]),history:[],wins:0,losses:0,phone:''};
  sl(true);
  try{
    await stP(key);
    await saveRegistry(year);
    await fbLog(`선수추가: ${name}(${club})`,'👤');
    sl(false);
    if(ge('rtabAddName')) ge('rtabAddName').value='';
    if(ge('rtabAddSubClub')) ge('rtabAddSubClub').value='';
    toast(`${name}(${club}) 추가 완료 ✅`,'success');
    savePlayersToLocalCache();
    renderAllP();
    renderRegistryTab();
  }catch(e){ sl(false); toast('추가 실패: '+e.message,'error'); }
}

// 선수 등록 현황 탭 — 인라인 빠른 수정
// 현재 등록명단의 이름/주클럽을 함께 수정한다.
// 과거 대회 history 안의 club 값은 당시 기록 보존을 위해 변경하지 않는다.
async function quickEditRegistryMember(year, idx){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const members = await loadRegistry(year);
  const m = members[idx];
  if(!m){ toast('선수를 찾을 수 없습니다','error'); return; }

  const oldName=(m.name||'').trim();
  const oldClub=(m.club||'').trim();

  const newNameRaw = prompt(`이름 수정\n현재: ${oldName}`, oldName);
  if(newNameRaw===null) return;
  const newName = newNameRaw.trim();
  if(!newName){ toast('이름을 입력하세요','error'); return; }

  const newClubRaw = prompt(`주 클럽 수정\n현재: ${oldClub}\n\n김해시 등록 클럽명을 정확히 입력하세요.`, oldClub);
  if(newClubRaw===null) return;
  const newClub = normalizeClub(newClubRaw.trim());
  if(!newClub){ toast('주 클럽을 입력하세요','error'); return; }

  const currentRegion=String(m.region||'').trim();
  const suggestedRegion=currentRegion || getClubDefaultRegion(G.meta,newClub);
  const newRegionRaw=prompt(`소속 코트/지역 수정\n현재: ${currentRegion||'미배정'}\n\n클럽 기본값이 있으면 자동 제안됩니다.`, suggestedRegion);
  if(newRegionRaw===null) return;
  const newRegion=normalizeRegionLabel(newRegionRaw);

  if(newName===oldName && newClub===normalizeClub(oldClub) && newRegion===currentRegion){
    toast('변경된 내용이 없습니다','info');
    return;
  }

  // 공식 등록명단 내 동일 이름+클럽 중복 방지
  const duplicate = members.some((r,i)=>
    i!==idx &&
    normName(cleanName(r.name||''))===normName(cleanName(newName)) &&
    normalizeClub(r.club||'')===normalizeClub(newClub)
  );
  if(duplicate){
    toast('같은 이름과 클럽으로 이미 등록된 선수가 있습니다','error');
    return;
  }

  const oldKey=pKey(oldName,oldClub);
  const newKey=pKey(newName,newClub);

  // 선수 DB에 새 키가 이미 있으면 자동 합치지 않고 차단
  if(newKey!==oldKey && G.players[newKey]){
    toast('변경하려는 이름+클럽의 선수 기록이 이미 존재합니다. 선수 합치기 기능을 사용하세요.','error');
    return;
  }

  sl(true);
  try{
    // 1) 공식 등록명단 수정
    members[idx]={...m,name:newName,club:newClub,region:newRegion};
    G_REGISTRY[year]=members;
    await saveRegistry(year);

    // 2) 현재 선수 DB도 동기화
    //    과거 history의 h.club은 과거 소속 기록이므로 그대로 유지
    const oldPlayer=G.players[oldKey];
    if(oldPlayer){
      const existingClubs=Array.isArray(oldPlayer.clubs)?oldPlayer.clubs:[];
      const nextClubs=[
        newClub,
        ...existingClubs.filter(c=>c && normalizeClub(c)!==normalizeClub(oldClub) && normalizeClub(c)!==normalizeClub(newClub))
      ];

      const nextPlayer={
        ...oldPlayer,
        key:newKey,
        name:newName,
        club:newClub,
        clubs:nextClubs
      };

      if(newKey!==oldKey){
        await setDoc(doc(db,'players',newKey.replace(/[/.#$[\]]/g,'_')),nextPlayer);
        await deleteDoc(doc(db,'players',oldKey.replace(/[/.#$[\]]/g,'_')));
        delete G.players[oldKey];
        G.players[newKey]=nextPlayer;
      }else{
        G.players[oldKey]=nextPlayer;
        await stP(oldKey);
      }
    }

    await fbLog(`등록선수 수정: ${oldName}(${oldClub}/${currentRegion||'미배정'}) → ${newName}(${newClub}/${newRegion||'미배정'})`,'✏️');

    savePlayersToLocalCache();
    sl(false);
    toast(`수정 완료되었습니다.\n${oldName}(${oldClub}) → ${newName}(${newClub})\n소속 코트: ${newRegion||'미배정'}`,'success');

    try{ renderAllP(); }catch(e){ console.warn('renderAllP after quickEditRegistryMember',e); }
    try{ await renderRegistryTab(); }catch(e){ console.warn('renderRegistryTab after quickEditRegistryMember',e); }
    try{ await renderRegistryMgr(); }catch(e){ /* 관리자 명단관리 모달이 닫혀있으면 무시 */ }
  }catch(e){
    sl(false);
    toast('저장 실패: '+e.message,'error');
    console.error('quickEditRegistryMember',e);
  }
}

// 선수 등록 현황 탭 — 인라인 빠른 삭제
async function quickDeleteRegistryMember(year, idx){
  if(!AD){ toast('관리자 로그인 필요','info'); return; }
  const members = await loadRegistry(year);
  const m = members[idx];
  if(!m){ toast('선수를 찾을 수 없습니다','error'); return; }
  if(!confirm(`"${m.name}" (${m.club})을 ${year}년 명단에서 삭제할까요?`)) return;
  members.splice(idx,1);
  if(window.G_REGISTRY && G_REGISTRY[year]) G_REGISTRY[year] = members;
  sl(true);
  try{
    await saveRegistry(year);
    sl(false);
    toast(`${m.name} 삭제 완료`,'success');
    savePlayersToLocalCache();
    renderAllP();
    renderRegistryTab();
  }catch(e){ sl(false); toast('삭제 실패: '+e.message,'error'); }
}

async function addRegistryRow(){
  const year=parseInt(ge('rmgrYearSel')?.value||2026);
  const name=(ge('rmgr_name')?.value||'').trim(); const club=ge('rmgr_club')?.value||'';
  const region=(ge('rmgr_region')?.value||'').trim(); const subClub=(ge('rmgr_subclub')?.value||'').trim();
  if(!name||!club){ toast('이름과 클럽은 필수입니다','error'); return; }
  const members=await loadRegistry(year);
  if(members.find(m=>m.name===name&&m.club===club)){ toast('이미 등록된 선수입니다','info'); return; }
  members.push(applyClubDefaultRegion(G.meta,{name,club,region,subClub})); sl(true);
  try{
    await saveRegistry(year);
    ['rmgr_name','rmgr_region','rmgr_subclub'].forEach(id=>{const el=ge(id);if(el)el.value='';});
    try{ await renderRegistryMgr(); }catch(uiErr){ console.warn('renderRegistryMgr failed after addRegistryRow', uiErr); }
    try{ await renderRegistryTab(); }catch(uiErr){ console.warn('renderRegistryTab failed after addRegistryRow', uiErr); }
    toast(`${name} 추가 완료`,'success');
  } catch(e){
    toast('저장 실패: '+e.message,'error');
  }
  sl(false);
}
async function saveRegistryRow(year,idx){
  const members=await loadRegistry(year); if(!members[idx]) return;
  members[idx].name=(ge(`rmgr_n_${idx}`)?.value||'').trim(); members[idx].club=ge(`rmgr_c_${idx}`)?.value||'';
  members[idx].region=(ge(`rmgr_r_${idx}`)?.value||'').trim(); members[idx].subClub=(ge(`rmgr_s_${idx}`)?.value||'').trim();
  sl(true);
  try{
    await saveRegistry(year);
    toast('수정 완료','success');
    try{ await renderRegistryTab(); }catch(uiErr){ console.warn('renderRegistryTab failed after saveRegistryRow', uiErr); }
  } catch(e){
    toast('저장 실패: '+e.message,'error');
  }
  sl(false);
}
async function deleteRegistryRow(year,idx){
  if(!confirm('이 선수를 삭제하시겠습니까?')) return;
  const members=await loadRegistry(year); members.splice(idx,1); sl(true);
  try{
    await saveRegistry(year);
    try{ await renderRegistryMgr(); }catch(uiErr){ console.warn('renderRegistryMgr failed after deleteRegistryRow', uiErr); }
    try{ await renderRegistryTab(); }catch(uiErr){ console.warn('renderRegistryTab failed after deleteRegistryRow', uiErr); }
    toast('삭제 완료','success');
  } catch(e){
    toast('삭제 실패: '+e.message,'error');
  }
  sl(false);
}
async function clearRegistryYear(){
  const year=parseInt(ge('rmgrYearSel')?.value||2026);
  if(!confirm(`${year}년 명단을 전체 삭제하시겠습니까?`)) return;
  G_REGISTRY[year]=[]; sl(true);
  try{
    await saveRegistry(year);
    try{ await renderRegistryMgr(); }catch(uiErr){ console.warn('renderRegistryMgr failed after clearRegistryYear', uiErr); }
    try{ await renderRegistryTab(); }catch(uiErr){ console.warn('renderRegistryTab failed after clearRegistryYear', uiErr); }
    toast('삭제 완료','success');
  } catch(e){
    toast('실패: '+e.message,'error');
  }
  sl(false);
}
async function importRegistryFromFile(input){
  const file=input?.files?.[0]; if(!file) return;
  const year=parseInt(ge('rmgrYearSel')?.value||2026);
  await ensureXLSX();
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:'array'});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const rawRows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  const parsed=parseOfficialRegistryExcelRows(rawRows);
  if(!parsed.ok){ toast(parsed.error,'error'); input.value=''; return; }
  const newRows=applyClubDefaultRegions(G.meta,parsed.rows,{onlyMissing:true}).members;
  if(!confirm(`${year}년 명단을 ${newRows.length}명으로 교체하시겠습니까?`)){ input.value=''; return; }
  G_REGISTRY[year]=newRows; sl(true);
  try{
    await saveRegistry(year);
    try{ await renderRegistryMgr(); }catch(uiErr){ console.warn('renderRegistryMgr failed after importRegistryFromFile', uiErr); }
    try{ await renderRegistryTab(); }catch(uiErr){ console.warn('renderRegistryTab failed after importRegistryFromFile', uiErr); }
    toast(`${newRows.length}명 업로드 완료`,'success');
  }catch(e){
    toast('저장 실패: '+e.message,'error');
  }
  sl(false);
  input.value='';
}
async function exportRegistryExcel(){ const year=parseInt(ge('regYearSel')?.value||2026); const members=await loadRegistry(year); await ensureXLSX(); const wsData=[['지역구분','주클럽','회원명','부클럽'],...members.map(m=>[m.region||'',m.club||'',m.name||'',m.subClub||''])]; const wb2=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb2,XLSX.utils.aoa_to_sheet(wsData),`${year}년 등록명단`); XLSX.writeFile(wb2,`김해테니스_등록선수_${year}_${new Date().toISOString().substring(0,10)}.xlsx`); }
function exportRegistryExcelMgr(){ exportRegistryExcel(); }





let __tapOrderState = {side:0,dbl:0,slots:[],players:[],cursor:0};
function _orderPhotoStoreKey(match, side){
  return side===1 ? 'side1' : 'side2';
}
function _orderPhotoGetSaved(match, side){
  if(!match || !match.orderPhotoStore) return null;
  const key=_orderPhotoStoreKey(match, side);
  const entry = match.orderPhotoStore[key] || null;
  if(!entry) return null;
  // Storage 방식(downloadURL) 또는 구형 방식(dataUrl) 모두 유효
  if(entry.hasPhoto || entry.downloadURL || entry.dataUrl) return entry;
  return null;
}
function _orderPhotoCanView(match, side){
  if(!match) return false;
  if(AD || OP) return true;
  const key = CM_key || '';
  const teams = G.teams[key] || [];
  const team = side===1 ? teams[match.t1] : teams[match.t2];
  const club = String(team?.club || '').trim();
  return !!(REG && REG_CLUB && club && String(REG_CLUB).trim()===club);
}
function _sanitizeOrderPhotoStore(raw){
  const out={};
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) return out;
  ['side1','side2'].forEach(k=>{
    const v=raw[k];
    if(!v || typeof v!=='object' || Array.isArray(v)) return;
    const dataUrl=typeof v.dataUrl==='string' ? v.dataUrl : '';
    if(!dataUrl) return;
    out[k]={
      dataUrl,
      updatedAt: typeof v.updatedAt==='string' ? v.updatedAt : '',
      source: typeof v.source==='string' ? v.source : 'upload',
      side: String(k==='side1'?1:2),
      club: typeof v.club==='string' ? v.club : '',
      savedBy: typeof v.savedBy==='string' ? v.savedBy : ''
    };
  });
  return out;
}
function _safeStorageSeg(v){
  return encodeURIComponent(String(v||'').replace(/[\/]+/g,'_').trim() || 'unknown');
}
async function persistOrderPhoto(side, imageDataUrl, source){
  const key=CM_key, mid=CM_id; if(!key||!mid||!imageDataUrl) return null;
  const list=G.matches[key]||[]; const m=list.find(x=>x.id===mid || x._id===mid); if(!m) return null;
  const teams=G.teams[key]||[];
  const team=side===1?teams[m.t1]:teams[m.t2];
  const base=_orderPhotoStoreKey(m, side); // 'side1' or 'side2'
  const [tid, div] = key.split('_');
  const matchDocId = m._id || m.id;

  // ── 1. dataUrl → Blob 변환 (압축: 최대 1200px, jpeg 78%) ──
  let blob;
  try {
    const compressed = await compressImageDataUrl(imageDataUrl, 1200, 0.78);
    const res = await fetch(compressed);
    blob = await res.blob();
  } catch(e) {
    try {
      const res = await fetch(imageDataUrl);
      blob = await res.blob();
    } catch(e2) {
      throw new Error('이미지 변환 실패: ' + (e2?.message||e2));
    }
  }
  if(!blob || !blob.size) throw new Error('이미지 데이터가 비어 있습니다');
  if(blob.size > 5 * 1024 * 1024) throw new Error('이미지가 너무 큽니다. 5MB 이하로 다시 시도해 주세요');

  // ── 2. Firebase Storage에 업로드 ──
  const storagePath = `orderPhotos/${_safeStorageSeg(tid)}/${_safeStorageSeg(div)}/${_safeStorageSeg(matchDocId)}/${base}.jpg`;
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, blob, {
    contentType: 'image/jpeg',
    cacheControl: 'private,max-age=3600',
    customMetadata: {
      tournamentId: String(tid||''),
      division: String(div||''),
      matchId: String(matchDocId||''),
      side: String(base||''),
      club: String(team?.club||''),
      source: String(source||'upload')
    }
  });
  const downloadURL = await getDownloadURL(fileRef);

  // ── 3. match 문서에는 URL + 메타만 저장 (base64 절대 포함 안 함) ──
  const meta = {
    downloadURL,
    storagePath,
    updatedAt: new Date().toISOString(),
    source: String(source||'upload'),
    club: String(team?.club||base||''),
    savedBy: String(AD?'관리자':(OP?'경기진행자':(REG_CLUB||'경기이사'))),
    hasPhoto: true
  };
  if(!m.orderPhotoStore) m.orderPhotoStore = {};
  m.orderPhotoStore[base] = meta;

  try {
    await updateDoc(doc(db,'matches', matchDocId), {
      [`orderPhotoStore.${base}`]: meta,
      updatedAt: new Date().toISOString()
    });
  } catch(e) {
    console.warn('match orderPhotoStore meta update failed', e);
    throw new Error('사진 저장 중 오류가 발생했습니다. 다시 시도해 주세요');
  }

  // 메모리 캐시에는 dataUrl도 임시 보관 (뷰어 즉시 열기용)
  m.orderPhotoStore[base] = { ...meta, dataUrl: imageDataUrl };
  return m.orderPhotoStore[base];
}
async function openOrderPhotoViewer(side){
  toast('사진보기는 제공되지 않습니다','info');
}

function _tapOrderUsedPlayers(slots){
  return slots.flatMap(arr=>Array.isArray(arr)?arr:[]).filter(Boolean);
}
function openTapOrderModal(side,dbl){
  const ctx=window._m3Ctx||{};
  if(!(AD||OP)){
    const allowed=Number(ctx.mySide||0);
    if(!allowed || Number(side)!==allowed){
      toast('내 팀 선수만 입력할 수 있습니다','info');
      return;
    }
  }
  const slots=[];
  for(let r=0;r<dbl;r++) slots.push(getPickerSelected(`rp${side}_${r}`).slice(0,2));
  const players=getPickerPlayers(`rp${side}_0`)||[];
  const cursor=findNextTapCursor(slots,0);
  __tapOrderState={side,dbl,slots,players,cursor:Math.max(0,cursor)};
  const title=ge('mTapOrderTitle');
  title && (title.textContent=`선수 입력 · ${side===1?'홈팀':'원정팀'}`);
  renderTapOrderModal();
  om('mTapOrder');
}
function renderTapOrderModal(){
  const st=__tapOrderState||{}; const dbl=st.dbl||0;
  const summary=ge('tapOrderSummary'), current=ge('tapOrderCurrent'), list=ge('tapOrderPlayerList');
  if(summary){ summary.innerHTML=buildTapOrderSummaryHtml({slots:st.slots||[],cursor:st.cursor||0,escapeHtml:esc}); }
  if(current){ current.textContent=buildTapOrderCurrentText({cursor:st.cursor||0,doublesCount:dbl,pair:st.slots?.[st.cursor]||[]}); }
  if(list){ list.innerHTML=buildTapOrderPlayerListHtml({players:st.players||[],currentPair:st.slots?.[st.cursor]||[],usedPlayers:getTapUsedPlayers(st.slots||[]),escapeHtml:esc,escapeAttr:esc}); }
}
function tapOrderFocus(idx){ __tapOrderState.cursor=idx; renderTapOrderModal(); }
function tapOrderPick(player){
  const st=__tapOrderState; if(!st||!st.players) return;
  const next=toggleTapPlayer(st.slots||[],st.cursor||0,player);
  st.slots=next.slots;
  st.cursor=next.cursor;
  renderTapOrderModal();
}
function tapOrderBack(){
  const st=__tapOrderState; if(!st) return;
  const next=backspaceTapSlot(st.slots||[],st.cursor||0);
  st.slots=next.slots;
  st.cursor=next.cursor;
  renderTapOrderModal();
}
function tapOrderClear(){
  const st=__tapOrderState; if(!st) return;
  const next=backspaceTapSlot(st.slots||[],st.cursor||0);
  st.slots=next.slots;
  st.cursor=next.cursor;
  renderTapOrderModal();
}
function tapOrderReset(){
  const st=__tapOrderState; if(!st) return;
  st.slots=resetTapSlots(st.dbl||0);
  st.cursor=0;
  renderTapOrderModal();
}
function tapOrderGhost(){
  const st=__tapOrderState; if(!st) return;
  const next=setTapGhost(st.slots||[],st.cursor||0);
  st.slots=next.slots;
  st.cursor=next.cursor;
  renderTapOrderModal();
}
function applyTapOrderSelections(){
  const st=__tapOrderState; if(!st) return;
  for(let r=0;r<(st.dbl||0);r++){
    const arr=normalizePair(st.slots[r]||[]);
    setPickerSelected(`rp${st.side}_${r}`, arr);
    renderPlayerDropdown(`rp${st.side}_${r}`);
  }
  refreshAllOrderChipAvailability();
  cm('mTapOrder');
  toast('선수 입력 적용 완료 ✅','success');
}
function closeTapOrderModal(){ cm('mTapOrder'); }

let __orderPhotoTesseractPromise = null;
function _orderPhotoNorm(v){
  return String(v||'').normalize('NFC').replace(/\s+/g,'').replace(/[^가-힣a-zA-Z0-9]/g,'').toLowerCase();
}
function _orderPhotoHangulParts(ch){
  const code=String(ch||'').charCodeAt(0);
  const base=0xAC00;
  const idx=code-base;
  if(idx<0 || idx>11171) return null;
  const cho=Math.floor(idx/588);
  const jung=Math.floor((idx%588)/28);
  const jong=idx%28;
  return {cho,jung,jong};
}
function _orderPhotoCharsNear(a,b){
  if(a===b) return 1;
  const pa=_orderPhotoHangulParts(a), pb=_orderPhotoHangulParts(b);
  if(pa && pb){
    let same=0;
    if(pa.cho===pb.cho) same++;
    if(pa.jung===pb.jung) same++;
    if(pa.jong===pb.jong) same++;
    if(same>=2) return 0.82;
    if(same===1) return 0.45;
    return 0;
  }
  if(/[a-z0-9]/i.test(a) && /[a-z0-9]/i.test(b)) return a===b?1:0;
  return 0;
}
function _orderPhotoLevenshtein(a,b){
  const s=_orderPhotoNorm(a), t=_orderPhotoNorm(b);
  const m=s.length, n=t.length;
  if(!m||!n) return Math.max(m,n);
  const dp=Array.from({length:m+1},()=>Array(n+1).fill(0));
  for(let i=0;i<=m;i++) dp[i][0]=i;
  for(let j=0;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++){
    for(let j=1;j<=n;j++){
      const near=_orderPhotoCharsNear(s[i-1], t[j-1]);
      const cost = near>=0.8 ? 0.2 : (near>0 ? 0.55 : (s[i-1]===t[j-1]?0:1));
      dp[i][j]=Math.min(
        dp[i-1][j]+1,
        dp[i][j-1]+1,
        dp[i-1][j-1]+cost
      );
    }
  }
  return dp[m][n];
}
function _orderPhotoScore(token,candidate,lineText=''){
  const a=_orderPhotoNorm(token), b=_orderPhotoNorm(candidate), line=_orderPhotoNorm(lineText);
  if(!a||!b) return 0;
  if(a===b) return 1;
  let score=1-(_orderPhotoLevenshtein(a,b)/Math.max(a.length,b.length,1));
  if(b.includes(a) || a.includes(b)) score=Math.max(score, Math.min(0.97, Math.max(a.length,b.length)>=3 ? 0.92 : 0.78));
  if(line && line.includes(b)) score=Math.max(score,0.98);
  if(a[0] && b[0] && a[0]===b[0]) score+=0.05;
  if(a.length>=2 && b.length>=2 && a.slice(0,2)===b.slice(0,2)) score+=0.12;
  if(a.length===b.length && _orderPhotoLevenshtein(a,b)<=1) score+=0.12;
  if(a.length===b.length && a.length>=2 && a.length<=4){
    let nearCount=0;
    for(let i=0;i<a.length;i++) if(_orderPhotoCharsNear(a[i],b[i])>=0.8) nearCount++;
    if(nearCount>=Math.max(2,a.length-1)) score+=0.12;
  }
  return Math.max(0, Math.min(1, score));
}
function _orderPhotoExtractLines(text){
  return String(text||'')
    .split(/\r?\n+/)
    .map(line=>line.replace(/[|]/g,' ').replace(/[\t]+/g,' ').replace(/\s+/g,' ').trim())
    .filter(Boolean)
    .slice(0,60)
    .map((text,idx)=>({text,y:idx*40,source:'plain'}));
}
function _orderPhotoExtractStructuredLines(result){
  const data=result&&result.data||{};
  const out=[];
  const lines=Array.isArray(data.lines)?data.lines:[];
  if(lines.length){
    lines.forEach((ln,idx)=>{
      const raw=String(ln.text||'').replace(/\s+/g,' ').trim();
      if(!raw) return;
      const bb=ln.bbox||{};
      const y=((bb.y0??bb.top??(idx*40)) + (bb.y1??bb.bottom??(idx*40+20)))/2;
      out.push({text:raw,y,source:'line',bbox:bb});
    });
  }else if(Array.isArray(data.words) && data.words.length){
    const buckets=[];
    data.words.forEach((w,idx)=>{
      const raw=String(w.text||'').trim();
      if(!raw) return;
      const bb=w.bbox||{};
      const y=((bb.y0??bb.top??(idx*20)) + (bb.y1??bb.bottom??(idx*20+10)))/2;
      let bucket=buckets.find(b=>Math.abs(b.y-y)<18);
      if(!bucket){ bucket={y,parts:[]}; buckets.push(bucket); }
      bucket.parts.push({text:raw,x:(bb.x0??bb.left??0)});
    });
    buckets.sort((a,b)=>a.y-b.y).forEach((b,idx)=>{
      b.parts.sort((p,q)=>p.x-q.x);
      const raw=b.parts.map(p=>p.text).join(' ').replace(/\s+/g,' ').trim();
      if(raw) out.push({text:raw,y:b.y,source:'word',bbox:{top:b.y}});
    });
  }
  if(!out.length) return _orderPhotoExtractLines(data.text||'');
  return out
    .sort((a,b)=>a.y-b.y)
    .map((line,idx)=>({
      ...line,
      text:String(line.text||'').replace(/[|]/g,' ').replace(/[\t]+/g,' ').replace(/\s+/g,' ').trim(),
      idx
    }))
    .filter(x=>x.text);
}
function _orderPhotoExtractTokens(line){
  const base=String(line||'').replace(/[\/,_\-:]+/g,' ').replace(/[(){}\[\]]/g,' ');
  const parts=base.split(/\s+/).map(x=>x.trim()).filter(Boolean);
  const chunks=base.match(/[가-힣]{2,5}|[A-Za-z]{2,12}|[0-9]{2,}/g)||[];
  return [...new Set([...parts,...chunks].filter(Boolean))];
}
function _orderPhotoCleanLineText(line){
  return String(line||'')
    .replace(/^\s*\d+\s*[\.\),-]?\s*/,'')
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function _orderPhotoSplitPairSegments(line){
  const cleaned=_orderPhotoCleanLineText(line);
  if(!cleaned) return [];
  const strongSplit=cleaned.split(/\s*[,，·ㆍ\/\\]\s*|\s{2,}/).map(x=>x.trim()).filter(Boolean);
  if(strongSplit.length>=2) return strongSplit.slice(0,2);
  const hangul=cleaned.match(/[가-힣]{2,5}/g)||[];
  if(hangul.length>=2) return [hangul[0], hangul[1]];
  const tokens=_orderPhotoExtractTokens(cleaned);
  if(tokens.length>=2){
    const half=Math.ceil(tokens.length/2);
    return [tokens.slice(0,half).join(' '), tokens.slice(half).join(' ')].map(x=>x.trim()).filter(Boolean);
  }
  return cleaned ? [cleaned] : [];
}
function _orderPhotoGetContext(side){
  const key=CM_key, mid=CM_id;
  if(!key||!mid) return null;
  const m=(G.matches[key]||[]).find(x=>x.id===mid);
  if(!m) return null;
  const teams=G.teams[key]||[];
  const team=side===1?teams[m.t1]:teams[m.t2];
  if(!team) return null;
  const [tid,div]=key.split('_');
  const tObj=G.tournaments.find(t=>t.id===tid);
  const cfg=gDS(tObj,div);
  const dbl=cfg.doublesCount||(team.doublesCount)||5;
  return {key,mid,match:m,team,dbl,candidates:(team.players||[]).filter(Boolean)};
}
function _orderPhotoSetStatus(side,msg,isWarn=false){
  const el=ge('orderPhotoStatus'+side);
  if(!el) return;
  el.textContent=msg;
  el.style.color=isWarn?'#b45309':'var(--text2)';
}
function _orderPhotoApplySelection(side, assignments){
  assignments.forEach((players,idx)=>{
    setPickerSelected(`rp${side}_${idx}`, (players||[]).slice(0,2));
    renderPlayerDropdown(`rp${side}_${idx}`);
  });
  refreshAllOrderChipAvailability();
}
function _orderPhotoBestCandidate(sourceText, unused, lineText=''){
  let best=null, bestScore=0;
  [...unused].forEach(cand=>{
    const score=Math.max(
      _orderPhotoScore(sourceText,cand,lineText),
      _orderPhotoScore(lineText,cand,lineText)
    );
    if(score>bestScore){ bestScore=score; best=cand; }
  });
  return {best,bestScore};
}
function _orderPhotoAssign(lines,candidates,dbl){
  const usable=(candidates||[]).filter(Boolean);
  const maxPlayers=Math.min(usable.length, dbl*2);
  const orderedLines=(lines||[]).slice().sort((a,b)=>(a.y??0)-(b.y??0)).slice(0, Math.max(dbl+2,dbl));
  const assignments=Array.from({length:dbl},()=>[]);
  const lineMeta=Array.from({length:dbl},(_,i)=>orderedLines[i]||null);
  const unused=new Set(usable);
  const seen=new Set();
  for(let row=0; row<dbl; row++){
    const lineObj=lineMeta[row];
    if(!lineObj) continue;
    const lineText=String(lineObj.text||'');
    const segments=_orderPhotoSplitPairSegments(lineText);
    const chosen=[];
    segments.forEach(seg=>{
      if(chosen.length>=2) return;
      const {best,bestScore}=_orderPhotoBestCandidate(seg, unused, lineText);
      if(best && bestScore>=0.28 && !seen.has(best)){
        chosen.push(best); seen.add(best); unused.delete(best);
      }
    });
    if(chosen.length<2){
      const tokens=_orderPhotoExtractTokens(lineText);
      tokens.forEach(tok=>{
        if(chosen.length>=2) return;
        const {best,bestScore}=_orderPhotoBestCandidate(tok, unused, lineText);
        if(best && bestScore>=0.34 && !seen.has(best)){
          chosen.push(best); seen.add(best); unused.delete(best);
        }
      });
    }
    if(chosen.length<2){
      const ranked=[...unused].map(cand=>({cand,score:_orderPhotoScore(lineText,cand,lineText)})).sort((a,b)=>b.score-a.score);
      ranked.forEach(item=>{
        if(chosen.length>=2) return;
        if(item.score<0.24) return;
        if(!seen.has(item.cand)){
          chosen.push(item.cand); seen.add(item.cand); unused.delete(item.cand);
        }
      });
    }
    assignments[row]=chosen.slice(0,2);
  }
  const allLineTexts=orderedLines.map(x=>String(x.text||''));
  for(let row=0; row<dbl; row++){
    const lineText=String((lineMeta[row]&&lineMeta[row].text)||'');
    while(assignments[row].length<2 && seen.size<maxPlayers){
      let ranked=[...unused].map(cand=>{
        let score=_orderPhotoScore(lineText,cand,lineText);
        if(!lineText){
          allLineTexts.forEach(txt=>{ score=Math.max(score,_orderPhotoScore(txt,cand,txt)); });
        }
        return {cand,score};
      }).sort((a,b)=>b.score-a.score);
      let next=ranked.find(x=>!seen.has(x.cand));
      if(!next){
        next=usable.find(c=>!seen.has(c)) ? {cand:usable.find(c=>!seen.has(c)),score:0} : null;
      }
      if(!next) break;
      assignments[row].push(next.cand);
      seen.add(next.cand);
      unused.delete(next.cand);
    }
  }
  const assignedCount=assignments.reduce((n,row)=>n+row.length,0);
  return {assignments, assignedCount, unused:[...unused]};
}
function _orderPhotoReadFile(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(reader.error||new Error('파일 읽기 실패'));
    reader.readAsDataURL(file);
  });
}
function _orderPhotoLoadImage(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error('이미지 로드 실패'));
    img.src=src;
  });
}
function _orderPhotoBuildVariant(img, mode='gray'){
  const maxW=1600;
  const scale=Math.min(1.8, maxW/Math.max(img.width,1));
  const w=Math.max(1, Math.round(img.width*scale));
  const h=Math.max(1, Math.round(img.height*scale));
  const canvas=document.createElement('canvas');
  canvas.width=w; canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0,w,h);
  const imageData=ctx.getImageData(0,0,w,h);
  const d=imageData.data;
  for(let i=0;i<d.length;i+=4){
    const r=d[i], g=d[i+1], b=d[i+2];
    let v=0.299*r+0.587*g+0.114*b;
    if(mode==='contrast'){
      v=(v-128)*1.6+128;
    }else if(mode==='binary'){
      v=v<168?0:255;
    }else if(mode==='binaryStrong'){
      v=v<186?0:255;
    }
    v=Math.max(0,Math.min(255,v));
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(imageData,0,0);
  return canvas;
}
async function _ensureOrderPhotoTesseract(){
  if(window.Tesseract) return window.Tesseract;
  if(__orderPhotoTesseractPromise) return __orderPhotoTesseractPromise;
  __orderPhotoTesseractPromise = new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.async=true;
    s.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('OCR 라이브러리 로드 실패'));
    s.onerror=()=>reject(new Error('OCR 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'));
    document.head.appendChild(s);
  });
  return __orderPhotoTesseractPromise;
}
async function _orderPhotoRecognizeBest(Tesseract, imageSrc){
  const img=await _orderPhotoLoadImage(imageSrc);
  const variants=[
    {name:'orig', src:imageSrc},
    {name:'gray', src:_orderPhotoBuildVariant(img,'gray').toDataURL('image/png')},
    {name:'contrast', src:_orderPhotoBuildVariant(img,'contrast').toDataURL('image/png')},
    {name:'binary', src:_orderPhotoBuildVariant(img,'binary').toDataURL('image/png')}
  ];
  let best=null;
  for(const variant of variants){
    try{
      const result=await Tesseract.recognize(variant.src,'kor+eng',{
        tessedit_pageseg_mode: 6,
        preserve_interword_spaces: 1
      });
      const lines=_orderPhotoExtractStructuredLines(result);
      const hangulChars=String(result?.data?.text||'').replace(/[^가-힣]/g,'').length;
      const score=(lines.length*8)+hangulChars;
      if(!best || score>best.score){
        best={result,lines,score,name:variant.name};
      }
    }catch(err){}
  }
  if(!best) throw new Error('글자 인식 실패');
  return best;
}
async function _processOrderPhoto(side,file){
  const ctx=_orderPhotoGetContext(side);
  if(!ctx){ toast('경기 정보를 찾을 수 없습니다','error'); return; }
  const currentRows=Array.from({length:ctx.dbl},(_,i)=>getPickerSelected(`rp${side}_${i}`)).flat();
  if(currentRows.length && !confirm('현재 선택된 오더를 사진 인식 결과로 덮어쓸까요?')) return;
  _orderPhotoSetStatus(side,'이미지 읽는 중…');
  try{
    const Tesseract=await _ensureOrderPhotoTesseract();
    const image=await _orderPhotoReadFile(file);
    await persistOrderPhoto(side, image, file?.__captureSource||'upload');
    _orderPhotoSetStatus(side,'사진 저장 완료 · 명단 기반으로 사진 분석 중…');
    const best=await _orderPhotoRecognizeBest(Tesseract, image);
    const lines=(best&&best.lines)||[];
    if(!lines.length){ _orderPhotoSetStatus(side,'글자를 찾지 못했습니다',true); toast('글자를 찾지 못했습니다','error'); return; }
    const assigned=_orderPhotoAssign(lines,ctx.candidates,ctx.dbl);
    _orderPhotoApplySelection(side, assigned.assignments);
    const rowsMatched=assigned.assignments.filter(row=>row.length>0).length;
    const totalNeed=Math.min(ctx.candidates.length, ctx.dbl*2);
    const warn = assigned.assignedCount < totalNeed;
    _orderPhotoSetStatus(side, `자동선택 ${assigned.assignedCount}명 · ${rowsMatched}개 복식 반영${assigned.unused.length?` · 남음 ${assigned.unused.length}명`:''}${best?.name?` · ${best.name}판독`:''}`, warn);
    toast(`사진 인식 완료 · ${assigned.assignedCount}명 자동선택`, assigned.assignedCount?'success':'info');
  }catch(err){
    console.error(err);
    _orderPhotoSetStatus(side, '인식 실패 — 직접 선택해 주세요', true);
    toast('사진 인식 실패: '+(err?.message||err), 'error');
  }
}
function triggerOrderPhoto(side, source){
  const input=document.createElement('input');
  input.type='file';
  input.accept='image/*';
  if(source==='camera') input.setAttribute('capture','environment');
  input.style.display='none';
  input.addEventListener('change', ()=>{
    const file=input.files&&input.files[0];
    if(file){ file.__captureSource=source; _processOrderPhoto(side,file); }
    input.remove();
  }, {once:true});
  document.body.appendChild(input);
  input.click();
}


// showPage 수정 - players는 누구나 접근

// ═══════════════════════════════════════════════════
//  이전 오더 자동 불러오기 + 복식 순서 변경 팝업
// ═══════════════════════════════════════════════════

if(!window._lastOrderCache) {
  try{
    window._lastOrderCache = JSON.parse(localStorage.getItem('LAST_ORDER_CACHE_V1')||'{}') || {};
  }catch(_){
    window._lastOrderCache = {};
  }
}
function persistLastOrderCache(){
  try{ localStorage.setItem('LAST_ORDER_CACHE_V1', JSON.stringify(window._lastOrderCache||{})); }catch(_){}
}

// ── 캐시 저장: 저장/제출 버튼 시점에 picker DOM에서 직접 읽음 ──
function saveLastOrderFromPicker(key, m) {
  if (!key || !m) return;
  const teams = G.teams[key] || [];
  const t1 = teams[m.t1], t2 = teams[m.t2];
  if (!t1 || !t2) return;
  const [tid, div] = key.split('_');
  const cfg = gDS(G.tournaments.find(t => t.id === tid), div);
  const dbl = cfg.doublesCount || (t1.doublesCount) || 5;
  if (!window._lastOrderCache[key]) window._lastOrderCache[key] = {};
  const r1 = [], r2 = [];
  for (let r = 0; r < dbl; r++) {
    r1.push({ myPlayers: getPickerSelected(`rp1_${r}`).filter(Boolean) });
    r2.push({ myPlayers: getPickerSelected(`rp2_${r}`).filter(Boolean) });
  }
  if (r1.some(rb => rb.myPlayers.length > 0) && m.t1 != null)
    window._lastOrderCache[key][m.t1] = { rubbers: r1, savedAt: new Date().toISOString() };
  persistLastOrderCache();
  if (r2.some(rb => rb.myPlayers.length > 0) && m.t2 != null)
    window._lastOrderCache[key][m.t2] = { rubbers: r2, savedAt: new Date().toISOString() };
  persistLastOrderCache();
}

function getLastOrder(key, teamIdx) {
  return window._lastOrderCache?.[key]?.[teamIdx] || null;
}

// ── openM3 렌더 직후: 빈 오더에만 이전 오더 자동 채우기 ──
function applyLastOrderIfEmpty(key, m, dbl, st) {
  const teams = G.teams[key] || [];
  const t1 = teams[m.t1], t2 = teams[m.t2];
  if (!t1 || !t2) return;
  [{ teamIdx: m.t1, side: 1, teamObj: t1 },
   { teamIdx: m.t2, side: 2, teamObj: t2 }
  ].forEach(({ teamIdx, side, teamObj }) => {
    if (side === 1 ? st.s1 : st.s2) return;
    let has = false;
    for (let r = 0; r < dbl; r++) { if (getPickerSelected(`rp${side}_${r}`).some(Boolean)) { has = true; break; } }
    if (has) return;
    const last = getLastOrder(key, teamIdx);
    if (!last) return;
    let applied = 0;
    last.rubbers.forEach((cache, r) => {
      if (r >= dbl) return;
      const cid = `rp${side}_${r}`;
      const valid = (cache.myPlayers || []).filter(p => getPickerPlayers(cid).includes(p));
      if (!valid.length) return;
      setPickerSelected(cid, valid);
      renderPlayerDropdown(cid);
      applied++;
    });
    if (applied > 0) {
      ge(`lastOrderBanner_side${side}`)?.remove();
      const b = document.createElement('div');
      b.id = `lastOrderBanner_side${side}`;
      b.style.cssText = 'margin-bottom:8px;padding:8px 12px;background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1.5px solid #d97706;border-radius:10px;font-size:.76rem;color:#92400e;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap';
      b.innerHTML = `<span>📋 <b>${tdn(teamObj,key,side===1?m.t1:m.t2)}</b> — 이전 오더 불러왔습니다</span><button type="button" onclick="clearLastOrderFill(${side},${dbl})" style="padding:3px 9px;border-radius:8px;border:1px solid #d97706;background:white;color:#92400e;font-size:.72rem;cursor:pointer;white-space:nowrap">초기화</button>`;
      const fp = ge(`rp${side}_0`);
      let blk = fp; while (blk && !blk.classList?.contains('rb-blk')) blk = blk.parentElement;
      if (blk) blk.insertAdjacentElement('beforebegin', b);
      else ge('mM3B')?.insertAdjacentElement('afterbegin', b);
    }
  });
}

function clearLastOrderFill(side, dbl) {
  for (let r = 0; r < dbl; r++) { setPickerSelected(`rp${side}_${r}`, []); renderPlayerDropdown(`rp${side}_${r}`); }
  ge(`lastOrderBanner_side${side}`)?.remove();
}

// ── 복식 순서 변경 팝업 ────────────────────────────────────────
// 상태: 현재 팝업에서 선택 중인 순서 배열 (ex. [2,0,1,3,4] = 기존 3번→1복식, 1번→2복식...)
let _reorderState = { dbl: 0, order: [], picked: [], side: 0, teamLabel: '' };

function openReorderPopup(dbl, side = 0) {
  const ctx=window._m3Ctx||{};
  if(!(AD||OP)){
    const allowed=Number(ctx.mySide||0);
    side = allowed || Number(side||0) || 1;
    if(!allowed){
      toast('내 팀 순서만 변경할 수 있습니다','info');
      return;
    }
  }
  // 현재 picker에서 각 복식의 선수 스냅샷
  const side1Slots=[],side2Slots=[];
  for(let r=0;r<dbl;r++){
    side1Slots.push((AD||OP || side===1) ? getPickerSelected(`rp1_${r}`) : []);
    side2Slots.push((AD||OP || side===2) ? getPickerSelected(`rp2_${r}`) : []);
  }
  const slots=buildReorderSlots(side1Slots,side2Slots,dbl);
  const teamLabel = side===1 ? ((ctx.dn1)||'홈팀') : side===2 ? ((ctx.dn2)||'원정팀') : '';
  _reorderState = { dbl, slots, picked: [], side, teamLabel };

  // 팝업 오버레이 생성
  let overlay = ge('reorderOverlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'reorderOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML=buildReorderOverlayHtml({teamLabel,escapeHtml:esc});
  document.body.appendChild(overlay);
  renderReorderCards();
}

function renderReorderCards() {
  const { slots, picked, side } = _reorderState;
  const container = ge('reorderCards');
  if (!container) return;
  container.innerHTML=buildReorderCardsHtml({slots,picked,side,escapeHtml:esc});
}

function reorderTap(idx) {
  const { picked, slots } = _reorderState;
  _reorderState.picked=toggleReorderPick(picked,idx,slots.length);
  renderReorderCards();
  // 프리뷰 업데이트
  const preview = ge('reorderPreview');
  const previewList = ge('reorderPreviewList');
  const applyBtn = ge('reorderApplyBtn');
  if (picked.length === slots.length) {
    preview.style.display = 'block';
    previewList.innerHTML=buildReorderPreviewHtml({slots,picked,side:_reorderState.side,escapeHtml:esc});
    applyBtn.disabled = false;
    applyBtn.style.background = 'var(--primary)';
  } else {
    preview.style.display = 'none';
    applyBtn.disabled = true;
  }
}

function reorderReset() {
  _reorderState.picked = [];
  ge('reorderPreview').style.display = 'none';
  ge('reorderApplyBtn').disabled = true;
  renderReorderCards();
}

function applyReorder() {
  const { slots, picked, dbl, side } = _reorderState;
  if (picked.length !== slots.length) return;
  const snap1=[],snap2=[];
  for(let r=0;r<dbl;r++){
    snap1.push(getPickerSelected(`rp1_${r}`));
    snap2.push(getPickerSelected(`rp2_${r}`));
  }
  const plan=applyReorderPlan(snap1,snap2,picked,side);
  if(!plan.ok) return;
  for(let r=0;r<dbl;r++){
    if(!side || side===1) setPickerSelected(`rp1_${r}`,plan.side1[r]||[]);
    if(!side || side===2) setPickerSelected(`rp2_${r}`,plan.side2[r]||[]);
  }
  // UI 갱신
  for (let r = 0; r < dbl; r++) {
    if (!side || side === 1) renderPlayerDropdown(`rp1_${r}`);
    if (!side || side === 2) renderPlayerDropdown(`rp2_${r}`);
  }
  closeReorderPopup();
  toast(`${_reorderState.teamLabel ? _reorderState.teamLabel + ' ' : ''}복식 순서가 변경되었습니다 ✅`, 'success');
}

function closeReorderPopup() {
  ge('reorderOverlay')?.remove();
}

Object.assign(window,{selectRegistrationPlayerSuggestion,openAdvancedDataTools,advancedDataRecalc,advancedOpenHistoryExcel,advancedOpenSelectiveClear,advancedCleanupHistories,toggleClubMgrSelectAll,applyBulkClubRegion,autoFillClubRegionsFromRegistry,saveClubManagerDetails, closeStickyAlert, goToStickyAlertMatch, toggleModalFullscreen, setModalFullscreenState, openQuickAddPlayer, quickAddPlayer, fillAdminPlayerClub, adminAddPlayer, openSupportModal, sendSupportSMS, saveAdminPhone, 
  showPage,toggleAdmin,doLogin,openAdminSettings,saveAdminPassword,goBracket,onGuideFilesSelected,removeGuideFile,openGuide,loadHistFromDB,uploadHistFromExcel,previewHistExcel,renderGuidePreview,onHistGuideFilesSelected,uploadHistGuideFiles,manageHistGuide,deleteHistGuideFile,removeHistGuidePending,
  createTournament,renderTL,chgTS,delT,openET,saveET,openTD,applyRec,saveDivS,
  onRegTC,renderRL,renderRegisterDivisionOverview,selectRegDivision,registerTeam,delTeam,phint,openPHist,openETeam,saveETeam,etUpdateSlots,updateRegisterSlots,
  onBrTC,renderBracket,toggleBracketDivision,setBracketSelectedDivs,saveBracketDivisionSettings,applyBracketRecommend,resetPrelimDrawOnly,resetMainDrawOnly,resetDrawOnly,openDraw,openDrawHistory,openLatestSavedDraw,openLatestMainSavedDraw,openSavedDrawHistory,saveDrawModalImage,saveSavedDrawImage,confirmDraw,startDraw,buildMain,openMainDraw,startMainDraw,prepareMainExternalDraw,updateMainSeedPreview,spawnConfetti,celebrateGroupComplete,
  openManualEdit,saveManualEdit,toggleByeEdit,
  openM3,saveM3,tC,setCourt,toggleGroupCourtUI,onGroupCourtChange,openGroupCourtModal,saveGroupCourtModal,setOperationViewMode,
  openMatchCourtModal,saveMatchCourtModal,autoOrderMatches,runAutoOrder,
  openPD,openEditPlayer,saveEditPlayer,deletePlayer,saveClubPassword,resetClubPassword,saveFirstLoginPhone,saveForcedClubPassword,cancelForcedClubPassword,_completeRegLogin,updateMyClubUI,updateMyClubHomeCard,goMyClubBracket,openMyClubQuickOrder,openMyMatchOrderFromCard,submitSavedOrderFromCard,toggleMyClubFilter,saveRegDeadline,clearRegDeadline,refreshRegDeadlineUI,mergePlayer,openSelectiveClearModal,selectiveClearTournament,cleanupPlayerHistories,hardResetAllData,
  resetMatchRecords,recalcAllPlayerStats,
  backupJSON,restoreFromJSON,backupPlayersExcel,exportPlayersCSV,exportPlayersExcel,
  bracketToImage,bracketToPDF,openBracketView,switchBVTab,renderBracketView,saveBracketViewImage,
  onRankTC,renderRanking,
  filterP,showP,renderAllP,openPD,openRoster,openIndividualExcelModal,previewIndividualExcelFile,importIndividualExcelTeams,openPlayerContact,
  switchPlayersTab,initRegistryTab,renderRegistryTab,openRegistryMgr,renderRegistryMgr,
  registryTabQuickAdd,quickEditRegistryMember,quickDeleteRegistryMember,addRegistryRow,saveRegistryRow,deleteRegistryRow,clearRegistryYear,renderClubDefaultRegionManager,saveAllClubDefaultRegions,syncDefaultRegionEditor,saveClubDefaultRegionSetting,applyDefaultRegionsToUnassigned,
  importRegistryFromFile,exportRegistryExcel,exportRegistryExcelMgr,exportRegistryFiltered,normalizeClub,bulkChangeRegion,
  openClubMgr,addClub,delClub,renderCL,
  toggleOperator,doOperatorLogin,saveOperatorPw,toggleShowOperatorPw,toggleReg,doRegLogin,applyRegLoginUI,saveRegPw,forceDirectorReLoginAll,toggleShowRegPw,onRegLoginClubChange,getRegSessionVersion,openChangePwIfNeeded,openChangePwDirect,skipChangePw,saveChangePw,saveOnlineOrderSettings,submitOnlineOrder,unlockOnlineOrder,confirmSubmitOrder,confirmUnlockOrder,openOrderPhotoViewer,openTapOrderModal,closeTapOrderModal,renderTapOrderModal,tapOrderFocus,tapOrderPick,tapOrderBack,tapOrderClear,tapOrderReset,tapOrderGhost,applyTapOrderSelections,setGhostOrder,clearGhostOrder,canEditMatchByDirector,
  onRegClubChange,onRegContactInput,saveRegContact,
  renderAdminContactList,saveContactFromAdmin,renderAdminDirectorEmailSection,renderAdminNoticeSection,toggleContactList,saveFloatingNoticeSettings,clearFloatingNotice,hideFloatingNoticeForNow,
  prefillNoticeMsg,renderNoticeContactBtns,captureAndShareBracket,
  saveRegListImage44,saveRegListExcel44,saveRegListKakao44,saveRegListPDF44,saveRegistryFilteredImageHQ,
  toggleClubSel,selAllClubs,sendSmsSelected,sendSmsAll,sendKakaoSelected,sendKakaoAll,copyMsgOnly,openKakaoApp,triggerOrderPhoto,
  gDS,om,cm,toast,ge,esc,setRbSc,togglePlayerDropdown,choosePlayerFromDropdown,removeSelectedPlayerFromDropdown,
  buildDrawPresets,updateAdvPresets,updateMainSizeDisplay,calcGroupPresets,updateDrawAllowedCourtsSummary,toggleAllDrawAllowedCourts,
  switchToRunScreen,runRoulette,leafLandReveal,initDrawStage,fillSlotWithLeaf,
  activateSlot,celebrateGroupComplete,refreshRunPreview,buildRouletteStrip,updateDrawMainPreview,
  toggleDivRubber,selRub,getDivRubbers,
  addPresetDiv,addCustomDiv,_removeCustomDiv,etAddPreset,etAddCustomDiv,_etRemoveDiv,
  etToggleRub,etSelRub,etGetRubbers,
  saveLastOrderFromPicker,applyLastOrderIfEmpty,clearLastOrderFill,
  openReorderPopup,reorderTap,reorderReset,applyReorder,closeReorderPopup,
  updateMainManualSeeds,
  toggleIndividualGroupMatches});

document.addEventListener('DOMContentLoaded',()=>{
  // 연도 레이블 초기화 (REG_YEAR는 모듈 스코프라 직접 접근 불가 → 현재 연도 직접 계산)
  const yr = new Date().getFullYear();
  document.querySelectorAll('.reg-year-label').forEach(el=>{
    el.textContent = yr+'년 등록선수';
  });
  initFB();
  refreshRoleUI();
});
