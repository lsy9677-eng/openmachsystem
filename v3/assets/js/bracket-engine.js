
function nextPower(value){let n=1;while(n<value)n*=2;return n;}
function normalizeTeam(team,index){
  if(typeof team==='string')return{id:`team-${index+1}`,name:team,rank:index+1};
  const players=[team.player1,team.player2,team.p1,team.p2].filter(Boolean).map(p=>typeof p==='string'?p:(p.name||p.playerName||'')).filter(Boolean);
  return {
    id:String(team.id||team.teamId||team.key||`team-${index+1}`),
    name:String(team.name||team.teamName||team.label||team.displayName||team.playersText||players.join(' / ')||`팀 ${index+1}`),
    affiliation:String(team.affiliation||team.club||team.org||''),
    groupNo:Number(team.groupNo||team.group||0),
    groupRank:Number(team.groupRank||team.rank||0)
  };
}
function seedOrder(size){
  let order=[1,2];
  while(order.length<size){
    const max=order.length*2+1;
    order=order.flatMap(x=>[x,max-x]);
  }
  return order.slice(0,size);
}
export function prepareTeams(rawTeams,limit){
  const input=Array.isArray(rawTeams)?rawTeams:(rawTeams.teams||rawTeams.data||rawTeams.qualifiers||[]);
  return input.map(normalizeTeam).slice(0,limit);
}
export function generateDraw(teams,requestedSize){
  const size=Number(requestedSize)||nextPower(teams.length);
  if(![32,64,128].includes(size))throw new Error('지원 대진 규모는 32·64·128강입니다.');
  if(teams.length<2)throw new Error('최소 2팀이 필요합니다.');
  const selected=teams.slice(0,size);
  const ranked=[...selected].sort((a,b)=>{
    const ar=a.groupRank||99,br=b.groupRank||99;
    return ar-br||a.groupNo-b.groupNo||a.name.localeCompare(b.name,'ko');
  });
  const top=ranked.filter(t=>t.groupRank===1);
  const rest=ranked.filter(t=>t.groupRank!==1);
  const slots=Array(size).fill(null);
  const spread=seedOrder(size);
  top.forEach((team,i)=>{slots[spread[i]-1]=team;});
  let ri=0;
  for(let i=0;i<size;i++)if(!slots[i]&&ri<rest.length)slots[i]=rest[ri++];
  const rounds={};
  for(let roundSize=size;roundSize>=2;roundSize/=2){
    const count=roundSize/2;
    rounds[roundSize]=Array.from({length:count},(_,i)=>({
      id:`r${roundSize}_m${i+1}`,roundSize,matchNo:i+1,
      teamA:null,teamB:null,winner:null,scoreA:null,scoreB:null,
      status:'waiting_slots',court:null,nextMatchId:roundSize>2?`r${roundSize/2}_m${Math.floor(i/2)+1}`:null,
      nextSlot:roundSize>2?(i%2===0?1:2):null
    }));
  }
  rounds[size].forEach((m,i)=>{
    m.teamA=slots[i*2];m.teamB=slots[i*2+1];
    if(m.teamA&&m.teamB)m.status='ready';
    else if(m.teamA||m.teamB){
      m.winner=m.teamA||m.teamB;m.status='completed';m.bye=true;
    }
  });
  propagateByes(rounds,size);
  return {size,rounds};
}
export function propagateByes(rounds,size){
  for(let roundSize=size;roundSize>2;roundSize/=2){
    rounds[roundSize].forEach(m=>{
      if(m.status==='completed'&&m.winner&&m.nextMatchId){
        const next=rounds[roundSize/2].find(x=>x.id===m.nextMatchId);
        if(m.nextSlot===1)next.teamA=m.winner;else next.teamB=m.winner;
        if(next.teamA&&next.teamB&&next.status!=='completed')next.status='ready';
      }
    });
  }
}
export function allMatches(draw){
  return Object.keys(draw.rounds||{}).sort((a,b)=>Number(b)-Number(a)).flatMap(k=>draw.rounds[k]);
}
export function findMatch(draw,id){return allMatches(draw).find(m=>m.id===id)||null;}
export function roundLabel(size){
  if(size===2)return'결승';if(size===4)return'준결승';return`${size}강`;
}
