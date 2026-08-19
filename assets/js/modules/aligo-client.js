// 230MATCH stable module · aligo-client.js · 5.10.4
// 공통 알리고 Worker 전송부.
// 대회/참가/경기 상태를 직접 읽거나 쓰지 않습니다.

export function createAligoSender({
  proxyUrl,
  clientKey,
  normalizePhone,
  prepareBody,
  fetchImpl=globalThis.fetch
}){
  if(typeof normalizePhone!=='function')throw new Error('normalizePhone is required');
  if(typeof prepareBody!=='function')throw new Error('prepareBody is required');
  if(typeof fetchImpl!=='function')throw new Error('fetch implementation is required');

  return async function sendAligoSmsV3(recipients,msg,meta={}){
    const prepared=prepareBody(msg,meta);
    const list=[];

    for(const r of recipients||[]){
      const phone=normalizePhone(r?.phone);
      if(phone.length>=9&&!list.some(x=>x.phone===phone)){
        list.push({name:r?.name||'수신자',phone});
      }
    }
    if(!list.length)throw new Error('문자 받을 번호가 없습니다.');

    const receivers=list.map(x=>x.phone);
    const body=String(prepared||'').trim();
    const type=new Blob([body]).size>90?'LMS':'SMS';

    const payload={
      receivers,
      receiver:receivers[0],
      recipients:list,
      targets:list,
      phones:receivers,
      to:receivers,
      msg:body,
      body,
      message:body,
      content:body,
      type,
      title:String(meta.title||'230MATCH 문자').slice(0,40),
      meta:{app:'230MATCH',version:'stage31.68',...meta}
    };

    const res=await fetchImpl(proxyUrl,{
      method:'POST',
      mode:'cors',
      headers:{
        'Content-Type':'application/json',
        'x-api-key':clientKey
      },
      credentials:'omit',
      body:JSON.stringify(payload)
    });

    const raw=await res.text();
    let data;
    try{data=JSON.parse(raw)}catch{data={raw}};

    if(!res.ok||data.success===false||data.ok===false){
      throw new Error(data.message||data.error||data.aligo?.message||raw||`HTTP ${res.status}`);
    }
    return data;
  };
}
