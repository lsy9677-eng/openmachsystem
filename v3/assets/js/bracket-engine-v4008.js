
function nextPower(value){let n=1;while(n<value)n*=2;return n;}
function shuffled(items){
  const out=[...items];
  for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
function balancedRandomMatchIndexes(matchCount,count){
  if(count<=0)return[];
  if(count>=matchCount)return shuffled(Array.from({length:matchCount},(_,i)=>i));
  // 원형 간격을 거의 동일하게 만든 뒤 시작 위치만 무작위로 돌려 몰림을 최소화한다.
  const phase=Math.random();
  const rotation=Math.floor(Math.random()*matchCount);
  const picked=[];
  for(let i=0;i<count;i++)picked.push((Math.floor((i+phase)*matchCount/count)+rotation)%matchCount);
  return shuffled([...new Set(picked)]);
}

function pairAvoidingSameGroup(items){
  const pool=[...items],pairs=[];
  while(pool.length){
    const first=pool.shift();
    let partnerIndex=pool.findIndex(x=>!first.groupNo||!x.groupNo||x.groupNo!==first.groupNo);
    if(partnerIndex<0)partnerIndex=0;
    const second=pool.splice(partnerIndex,1)[0];
    pairs.push([first,second]);
  }
  return pairs;
}
function normalizeTeam(team,index){
  if(typeof team==='string')return{id:`team-${index+1}`,name:team,rank:index+1};
  const players=[team.player1,team.player2,team.p1,team.p2].filter(Boolean).map(p=>typeof p==='string'?p:(p.name||p.playerName||'')).filter(Boolean);
  return {
    id:String(team.id||team.teamId||team.key||`team-${index+1}`),
    name:String(team.name||team.teamName||team.label||team.displayName||team.playersText||players.join(' / ')||`팀 ${index+1}`),
    affiliation:String(team.affiliation||team.club||team.org||''),
    groupNo:Number(team.groupNo||team.group||0),
    groupRank:Number(team.groupRank||team.rank||0),
    placeholder:Boolean(team.placeholder),
    placeholderKey:String(team.placeholderKey||''),
    locked:Boolean(team.locked)
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

export function makePrelimPlaceholder(groupNo,groupRank){
  return {
    id:`prelim-slot-g${groupNo}-r${groupRank}`,
    name:`${groupNo}조 ${groupRank}위`,
    affiliation:'예선 결과 대기',
    groupNo:Number(groupNo),
    groupRank:Number(groupRank),
    placeholder:true,
    placeholderKey:`g${groupNo}-r${groupRank}`,
    locked:false
  };
}
export function generateLinkedDrawSlots(groups,qualifiersPerGroup,drawSize){
  const slots=[];
  groups.forEach(group=>{
    for(let rank=1;rank<=qualifiersPerGroup;rank++){
      slots.push(makePrelimPlaceholder(group.groupNo,rank));
    }
  });
  if(slots.length>drawSize)throw new Error(`본선 슬롯 ${slots.length}개가 대진 규모 ${drawSize}강을 초과합니다.`);
  return slots;
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
  const half=size/2;
  // 참가 슬롯이 절반을 넘는 경우에는 초과 인원만 1회전 예비전(일명 똥통)을 치른다.
  // 예: 68팀/128드로 => 8팀이 4경기 예비전, 나머지 60팀은 64강 직행.
  if(selected.length>half){
    const preliminaryEntrants=Math.max(0,2*(selected.length-half));
    // 하위 순위팀 중 예비전 대상과 대진 상대를 매 추첨마다 무작위로 선정합니다.
    const lowerRank=shuffled(rest);
    const preliminary=lowerRank.slice(0,preliminaryEntrants);
    const directTop=shuffled(top);
    const directLower=shuffled(lowerRank.slice(preliminaryEntrants));
    const direct=[...directTop,...directLower];
    if(preliminary.length<preliminaryEntrants){
      const shortage=preliminaryEntrants-preliminary.length;
      preliminary.push(...direct.splice(Math.max(0,direct.length-shortage),shortage));
    }
    const preliminaryPairs=pairAvoidingSameGroup(shuffled(preliminary));
    const prelimMatchIndexes=balancedRandomMatchIndexes(half,preliminaryPairs.length);
    const prelimSet=new Set(prelimMatchIndexes);
    const directMatchIndexes=shuffled(Array.from({length:half},(_,i)=>i).filter(i=>!prelimSet.has(i)));
    preliminaryPairs.forEach((pair,i)=>{
      const matchIndex=prelimMatchIndexes[i];
      const oriented=Math.random()<0.5?pair:[pair[1],pair[0]];
      slots[matchIndex*2]=oriented[0];
      slots[matchIndex*2+1]=oriented[1];
    });
    direct.forEach((team,i)=>{
      const matchIndex=directMatchIndexes[i];
      if(matchIndex===undefined)return;
      // 직행팀은 한 경기 칸의 한쪽만 차지하여 BYE로 다음 라운드에 진출합니다.
      slots[matchIndex*2+(Math.random()<0.5?0:1)]=team;
    });
  }else{
    const spread=seedOrder(size);
    top.forEach((team,i)=>{slots[spread[i]-1]=team;});
    let ri=0;
    for(let i=0;i<size;i++)if(!slots[i]&&ri<rest.length)slots[i]=rest[ri++];
  }
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
    m.isPlayIn=selected.length>size/2&&Boolean(m.teamA&&m.teamB);
    m.playInLabel=m.isPlayIn?'64강 진입 예비전':'';
    const aResolved=Boolean(m.teamA&&!m.teamA.placeholder);
    const bResolved=Boolean(m.teamB&&!m.teamB.placeholder);
    if(aResolved&&bResolved){
      m.status='ready';
    }else if((aResolved||bResolved)&&!(m.teamA?.placeholder||m.teamB?.placeholder)){
      m.winner=m.teamA||m.teamB;m.status='completed';m.bye=true;
    }else{
      m.status='waiting_slots';
      m.winner=null;m.bye=false;
    }
  });
  propagateByes(rounds,size);
  return {size,rounds};
}
export function propagateByes(rounds,size){
  for(let roundSize=size;roundSize>2;roundSize/=2){
    rounds[roundSize].forEach(m=>{
      if(m.status==='completed'&&m.winner&&!m.winner.placeholder&&m.nextMatchId){
        const next=rounds[roundSize/2].find(x=>x.id===m.nextMatchId);
        if(m.nextSlot===1)next.teamA=m.winner;else next.teamB=m.winner;
        if(next.teamA&&next.teamB&&next.status!=='completed')next.status='ready';
      }
    });
  }
}

export function syncLinkedDrawQualifiers(draw,qualifiers,{protectStarted=true}={}){
  if(!draw||typeof draw!=='object')draw={size:0,rounds:{}};
  if(!draw.rounds||typeof draw.rounds!=='object')draw.rounds={};
  if(!Array.isArray(qualifiers))qualifiers=[];
  const qualifierMap=new Map(
    qualifiers.map(team=>[`g${team.groupNo}-r${team.groupRank}`,team])
  );
  const changes=[];
  const locked=[];
  const firstRound=draw.rounds?.[draw.size]||[];

  firstRound.forEach(match=>{
    ['teamA','teamB'].forEach(slot=>{
      const current=match[slot];
      if(!current?.placeholder||!current.placeholderKey)return;
      const resolved=qualifierMap.get(current.placeholderKey);
      if(!resolved)return;

      const started=['playing','completed'].includes(match.status);
      if(protectStarted&&started){
        locked.push({matchId:match.id,slot,placeholderKey:current.placeholderKey});
        return;
      }

      match[slot]={...resolved,placeholder:false,placeholderKey:'',locked:false};
      changes.push({matchId:match.id,slot,placeholderKey:current.placeholderKey,teamId:resolved.id});
      const aResolved=Boolean(match.teamA&&!match.teamA.placeholder);
      const bResolved=Boolean(match.teamB&&!match.teamB.placeholder);
      if(match.status!=='playing'){
        if(aResolved&&bResolved){
          match.status='ready';match.winner=null;match.bye=false;
        }else if((aResolved||bResolved)&&!(match.teamA?.placeholder||match.teamB?.placeholder)){
          match.winner=match.teamA||match.teamB;match.status='completed';match.bye=true;
        }else{
          match.status='waiting_slots';match.winner=null;match.bye=false;
        }
      }
    });
  });

  propagateByes(draw.rounds,draw.size);
  return {changes,locked};
}

export function allMatches(draw){
  const rounds=draw&&typeof draw==='object'&&draw.rounds&&typeof draw.rounds==='object'?draw.rounds:{};
  return Object.keys(rounds).sort((a,b)=>Number(b)-Number(a)).flatMap(k=>Array.isArray(rounds[k])?rounds[k]:[]);
}
export function findMatch(draw,id){return allMatches(draw||{rounds:{}}).find(m=>m.id===id)||null;}
export function roundLabel(size){
  if(size===2)return'결승';if(size===4)return'준결승';return`${size}강`;
}
