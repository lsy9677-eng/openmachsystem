import {VERSION} from './constants.js';
import {Store} from './store.js';
import {createTeams,createBracket,applyResult} from './bracket.js';
import {makeCourts,initialAssign,refreshQueue,completeAndAdvanceQueue,enqueueNewReadyMatches} from './queue.js';
import {downloadJson} from './utils.js';
import {UI} from './ui.js';

function initialState(size=64,courts=8,prefix='국제'){
  return {version:VERSION,draw:createBracket(size,createTeams(size)),courts:makeCourts(courts,prefix),sharedQueue:[],autoAssign:true,settings:{estimatedMinutes:30}};
}
const store=new Store(initialState());
const actions={
  getState:()=>store.get(),
  newDraw(){
    const size=Number(document.getElementById('drawSize').value);
    const count=Number(document.getElementById('courtCount').value);
    const prefix=document.getElementById('courtPrefix').value.trim()||'국제';
    store.set(initialState(size,count,prefix));ui.msg(`${size}팀 본선 대진을 새로 생성했습니다.`,'success');
  },
  assign(){store.update(s=>initialAssign(s));ui.msg('코트별 시합중 1경기, 대기1 1경기까지 균등 배정했습니다.','success');},
  refreshQueue(){store.update(s=>{enqueueNewReadyMatches(s);refreshQueue(s);});ui.msg('본선 큐를 갱신했습니다.','success');},
  toggleAuto(){store.update(s=>{s.autoAssign=!s.autoAssign;});},
  resetDemo(){store.clear();store.set(initialState());ui.msg('데모 데이터를 초기화했습니다.','info');},
  export(){downloadJson(`230match-main-v2-${Date.now()}.json`,store.get());},
  async import(file){
    if(!file)return;
    try{const data=JSON.parse(await file.text());store.set(data);ui.msg('JSON 데이터를 불러왔습니다.','success');}
    catch(e){ui.msg(`가져오기 실패: ${e.message}`,'error');}
  },
  saveResult(matchId,a,b){
    try{
      store.update(s=>{applyResult(s.draw,matchId,a,b);completeAndAdvanceQueue(s,matchId);});
      ui.closeResult();ui.msg(`결과 ${a}:${b} 저장 및 다음 라운드/큐 반영 완료`,'success');
    }catch(e){ui.msg(e.message,'error');}
  }
};
const ui=new UI(actions);
store.subscribe(state=>ui.render(state));
if(!store.load()) store.emit();
console.info(`[MAIN-V2] engine ${VERSION} loaded`);
