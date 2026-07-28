import{getAuthRuntime}from'./auth-engine.js?v=332016';
const FIRESTORE_URL='https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
let api=null;
async function runtime(){const rt=await getAuthRuntime();if(!rt?.user||!rt?.db)throw new Error('간편로그인 후 기존 Firebase 대회를 불러올 수 있습니다.');if(!api)api=await import(FIRESTORE_URL);return rt;}
function plain(doc){return{id:doc.id,...doc.data()};}
async function queryByTournament(db,name,tid){
  const {collection,getDocs,query,where}=api;const out=new Map();
  for(const field of ['tournamentId','tid','tournament']){
    try{const snap=await getDocs(query(collection(db,name),where(field,'==',tid)));snap.docs.forEach(d=>out.set(d.id,plain(d)));}catch(_e){}
  }
  return[...out.values()];
}
export async function listExistingTournaments(){
  const rt=await runtime();const {collection,getDocs,query,orderBy,limit}=api;let snap;
  try{snap=await getDocs(query(collection(rt.db,'tournaments'),orderBy('createdAt','desc'),limit(100)));}
  catch(_e){snap=await getDocs(collection(rt.db,'tournaments'));}
  return snap.docs.map(plain).filter(t=>t.deleted!==true);
}
export async function loadExistingTournament(tid){
  const rt=await runtime();const {doc,getDoc}=api;const tourSnap=await getDoc(doc(rt.db,'tournaments',tid));if(!tourSnap.exists())throw new Error('기존 대회 문서를 찾지 못했습니다.');
  const tournament=plain(tourSnap);
  const [teams,matches,draws,registrations]=await Promise.all(['teams','matches','draws','registrations'].map(n=>queryByTournament(rt.db,n,tid)));
  return{tournament,teams,matches,draws,registrations,loadedAt:new Date().toISOString(),sourceProject:'open-match-manager'};
}
function arr(v){return Array.isArray(v)?v:[];}function text(...vs){for(const v of vs){if(v!==undefined&&v!==null&&String(v).trim())return String(v).trim();}return'';}
function phone(v){return String(v||'').replace(/\D/g,'');}
function candidateTeams(bundle){const source=bundle.teams.length?bundle.teams:bundle.registrations;const seen=new Set();const out=[];
  source.forEach((x,i)=>{const players=arr(x.individualPlayers).length?arr(x.individualPlayers):arr(x.players);const playerNames=players.map(p=>typeof p==='string'?p:text(p?.name,p?.displayName)).filter(Boolean);const name=text(x.pairLabel,x.entryLabel,x.teamName,x.name,x.club,playerNames.join(' / '),`기존팀 ${i+1}`);const id=text(x.teamId,x.id,`legacy-team-${i+1}`);if(seen.has(id))return;seen.add(id);out.push({id,name,club:text(x.club,x.clubName),players:playerNames,individualPlayers:players,status:'active',legacySourceId:x.id,legacyRaw:x});});return out;}
export function convertExistingTournament(bundle,currentState){
  const next=structuredClone(currentState);const teams=candidateTeams(bundle);next.tournament={...next.tournament,name:text(bundle.tournament.name,bundle.tournament.title,next.tournament.name),division:text(bundle.tournament.division,arr(bundle.tournament.divisions)[0]?.name,arr(bundle.tournament.divisions)[0],next.tournament.division),legacyTournamentId:bundle.tournament.id};
  if(teams.length)next.teams=teams;next.contacts=next.contacts||{};teams.forEach(t=>{const r=t.legacyRaw||{};const p=phone(text(r.phone,r.mobile,r.contactPhone,r.phone1,arr(r.individualPlayers)[0]?.phone,arr(r.players)[0]?.phone));if(p)next.contacts[t.id]={...(next.contacts[t.id]||{}),phone:p,name:text(r.representativeName,r.contactName,t.name)};delete t.legacyRaw;});
  next.legacyBridge={enabled:true,source:'open-match-manager',tournamentId:bundle.tournament.id,tournamentName:next.tournament.name,loadedAt:bundle.loadedAt,counts:{teams:bundle.teams.length,matches:bundle.matches.length,draws:bundle.draws.length,registrations:bundle.registrations.length},raw:{tournament:bundle.tournament,teams:bundle.teams,matches:bundle.matches,draws:bundle.draws,registrations:bundle.registrations}};
  next.updatedAt=new Date().toISOString();return next;
}
