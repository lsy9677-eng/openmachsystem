
function normalizePhone(value){
  const digits=String(value||'').replace(/\D/g,'');
  if(!digits)return'';
  if(digits.length===11)return`${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
  if(digits.length===10)return`${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  return String(value||'').trim();
}
export function ensureContacts(state){
  if(!state.contacts||typeof state.contacts!=='object')state.contacts={};
  state.teams.forEach(team=>{
    const current=state.contacts[team.id]||{};
    const direct=team.phone||team.mobile||team.contact||team.tel||'';
    state.contacts[team.id]={phone:normalizePhone(current.phone||direct),manager:current.manager||team.manager||team.contactName||''};
  });
}
export function getTeamContact(state,team){
  ensureContacts(state);return state.contacts[team?.id]||{phone:'',manager:''};
}
export function setTeamContact(state,teamId,{phone,manager}){
  ensureContacts(state);
  state.contacts[teamId]={phone:normalizePhone(phone),manager:String(manager||'').trim()};
  const team=state.teams.find(t=>t.id===teamId);if(team)team.phone=state.contacts[teamId].phone;
  return state.contacts[teamId];
}
export function validatePhone(value){
  const digits=String(value||'').replace(/\D/g,'');
  if(!digits)return{ok:true,empty:true,message:'전화번호 없이 저장할 수 있습니다.'};
  if(/^01[016789]\d{7,8}$/.test(digits))return{ok:true,empty:false,message:'사용 가능한 휴대전화 번호입니다.'};
  return{ok:false,empty:false,message:'휴대전화 번호 형식을 확인하세요.'};
}
export function contactStats(state){
  ensureContacts(state);
  const total=state.teams.length,withPhone=state.teams.filter(t=>getTeamContact(state,t).phone).length;
  return{total,withPhone,withoutPhone:total-withPhone};
}
export function exportContactData(state){
  ensureContacts(state);
  return{schemaVersion:'230match-v3-contacts-v1',tournament:state.tournament,exportedAt:new Date().toISOString(),
    contacts:state.teams.map(t=>({teamId:t.id,teamName:t.name,affiliation:t.affiliation||'',phone:getTeamContact(state,t).phone,manager:getTeamContact(state,t).manager}))};
}
export function importContactData(state,data){
  ensureContacts(state);
  const list=Array.isArray(data)?data:(data.contacts||data.teams||[]);
  let updated=0,notFound=0;
  list.forEach(item=>{
    const team=state.teams.find(t=>String(t.id)===String(item.teamId||item.id||'')||String(t.name).trim()===String(item.teamName||item.name||'').trim());
    if(!team){notFound++;return;}
    setTeamContact(state,team.id,{phone:item.phone||item.mobile||'',manager:item.manager||item.contactName||''});updated++;
  });
  return{updated,notFound};
}
