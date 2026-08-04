const ARCHIVE_SCHEMA='230match-archive-v1';
const ARCHIVE_VERSION=1;

function clone(value){try{return structuredClone(value);}catch(_e){return JSON.parse(JSON.stringify(value));}}
function uid(prefix='archive'){try{return `${prefix}-${crypto.randomUUID()}`;}catch(_e){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;}}
function text(value){return String(value??'').trim();}
function matchesFromDraw(draw){return Object.values(draw?.rounds||{}).flat().filter(Boolean);}
function teamName(team){if(!team)return '';if(typeof team==='string')return team;return text(team.name||team.teamName||[team.player1,team.player2].filter(Boolean).join(' / '));}
function podiumFromState(state){
  const matches=matchesFromDraw(state.draw);
  const final=matches.find(m=>m.id==='r2_m1')||matches.find(m=>String(m.roundName||'').includes('결승')&&!String(m.roundName||'').includes('준결승'));
  const semis=matches.filter(m=>String(m.roundName||'').includes('준결승'));
  const champion=teamName(final?.winner||state.operation?.champion);
  const runnerUp=final?teamName(final.winner?.id===final.teamA?.id?final.teamB:final.teamA):'';
  const thirds=semis.map(m=>teamName(m.winner?.id===m.teamA?.id?m.teamB:m.teamA)).filter(Boolean);
  return{champion,runnerUp,thirds:[...new Set(thirds)].slice(0,2)};
}
function stripRecursiveArchives(portal={}){
  const next=clone(portal||{});
  delete next.archives;delete next.archiveRegistry;delete next.tournamentArchives;delete next.participantArchives;delete next.resultArchives;delete next.legacyTournamentSummaries;
  return next;
}
function divisionSnapshots(state){
  const md=state.multiDivision;
  if(!Array.isArray(md?.divisions)||!md.divisions.length)return[{divisionId:'default',name:text(state.tournament?.division)||'기본 부서',snapshot:currentDivisionPayload(state)}];
  return md.divisions.map(div=>({divisionId:text(div.id)||uid('division'),name:text(div.name)||'부서 미설정',createdAt:div.createdAt||null,updatedAt:div.updatedAt||null,snapshot:clone(div.snapshot||{})}));
}
function currentDivisionPayload(state){
  const copy=clone(state);
  if(copy.portal)copy.portal=stripRecursiveArchives(copy.portal);
  delete copy.multiDivision;
  return copy;
}
export function ensureTournamentIdentity(state){
  state.tournament=state.tournament&&typeof state.tournament==='object'?state.tournament:{};
  if(!state.tournament.id)state.tournament.id=uid('tournament');
  if(!state.tournament.createdAt)state.tournament.createdAt=new Date().toISOString();
  return state.tournament.id;
}
export function validateTournamentForArchive(state){
  const errors=[],warnings=[];
  const tournamentName=text(state.tournament?.name);
  if(!tournamentName||tournamentName==='대회 준비 중')errors.push('대회명이 설정되지 않았습니다.');
  const divisions=divisionSnapshots(state);
  if(!divisions.length)errors.push('보관할 부서가 없습니다.');
  const teams=Array.isArray(state.teams)?state.teams:[];
  if(!teams.length)warnings.push('현재 부서 참가팀이 없습니다.');
  const prelim=Array.isArray(state.prelim?.matches)?state.prelim.matches:[];
  const main=matchesFromDraw(state.draw);
  const unfinished=[...prelim,...main].filter(m=>m.status!=='completed'&&m.status!=='bye');
  if(unfinished.length)warnings.push(`미완료 경기가 ${unfinished.length}건 있습니다.`);
  const podium=podiumFromState(state);
  if(main.length&&!podium.champion)warnings.push('본선 우승팀이 확정되지 않았습니다.');
  return{ok:errors.length===0,errors,warnings,counts:{divisions:divisions.length,teams:teams.length,prelim:prelim.length,main:main.length,unfinished:unfinished.length},podium};
}
export function createTournamentArchive(state,{force=false,reason='manual'}={}){
  const validation=validateTournamentForArchive(state);
  if(!validation.ok)throw new Error(validation.errors.join(' '));
  if(!force&&validation.counts.unfinished>0)throw new Error(`미완료 경기 ${validation.counts.unfinished}건이 있습니다.`);
  const now=new Date().toISOString();
  const tournamentId=ensureTournamentIdentity(state);
  const guide=clone(state.portal?.guide||{});
  const photos=[];
  if(guide.imageDataUrl)photos.push({type:'guide',name:guide.imageName||'대회요강',mimeType:guide.imageType||'',dataUrl:guide.imageDataUrl});
  for(const photo of state.portal?.resultPhotos||[]){if(photo?.dataUrl||photo?.src)photos.push(clone(photo));}
  const podium=validation.podium;
  const archive={
    archiveId:uid('archive'),schemaVersion:ARCHIVE_SCHEMA,archiveVersion:ARCHIVE_VERSION,readOnly:true,
    tournamentId,sourceUpdatedAt:state.updatedAt||null,archivedAt:now,reason,
    tournament:{...clone(state.tournament),id:tournamentId,status:'completed',completedAt:state.operation?.tournamentCompletedAt||state.completion?.completedAt||now},
    guide,summary:{...validation.counts,...podium},
    divisions:divisionSnapshots(state),
    participants:clone(state.teams||[]),contacts:clone(state.contacts||{}),applications:clone(state.portal?.applications||[]),
    preliminary:clone(state.prelim||{}),mainDraw:clone(state.draw||{}),drawMeta:clone(state.drawMeta||{}),
    courts:{preliminary:clone(state.prelim?.courts||[]),main:clone(state.courts||[]),sharedQueue:clone(state.sharedQueue||[]),venueQueues:clone(state.venueQueues||{})},
    photos,finalBracket:{draw:clone(state.draw||{}),podium},
    integrity:{warnings:validation.warnings,createdFromBuild:document.getElementById('buildStageLabel')?.textContent||'',immutable:true}
  };
  return Object.freeze(archive);
}
export function archiveListItem(archive){
  const s=archive.summary||{},g=archive.guide||{},t=archive.tournament||{};
  return{id:archive.archiveId,archiveId:archive.archiveId,schemaVersion:archive.schemaVersion,readOnly:true,current:false,name:t.name||'대회',division:t.division||'',date:g.date||'',venue:g.venue||'',fee:g.fee||'',capacity:Number(s.teams||0),active:Number(s.teams||0),reserve:0,status:'completed',champion:s.champion||'',runnerUp:s.runnerUp||'',thirds:s.thirds||[],prelimCompleted:Number(s.prelim||0)-Number(s.unfinished||0),prelimTotal:Number(s.prelim||0),mainCompleted:Number(s.main||0)-Number(s.unfinished||0),mainTotal:Number(s.main||0),detail:g.detail||'',archivedAt:archive.archivedAt,updatedAt:archive.archivedAt};
}
export function archiveBackupPayload(archive){return{format:'230MATCH_V3_TOURNAMENT_ARCHIVE',schemaVersion:ARCHIVE_SCHEMA,exportedAt:new Date().toISOString(),archive:clone(archive)};}
