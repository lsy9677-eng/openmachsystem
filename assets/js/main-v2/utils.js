export function uid(prefix='id'){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;}
export function clone(value){return JSON.parse(JSON.stringify(value));}
export function nowIso(){return new Date().toISOString();}
export function roundName(size){return size===4?'준결승':size===2?'결승':`${size}강`;}
export function courtNumber(name){const m=String(name||'').match(/(\d+)\s*$/);return m?Number(m[1]):9999;}
export function balancedOrder(count){
  const out=[]; let low=1, high=count;
  const middle=[];
  let left=Math.floor((count+1)/2)+1, right=Math.floor((count+1)/2);
  while(middle.length<count){
    if(left<=count) middle.push(left++);
    if(right>=1) middle.push(right--);
  }
  let mi=0;
  while(out.length<count){
    if(low<=high && !out.includes(low)) out.push(low++);
    if(low<=high && !out.includes(high)) out.push(high--);
    while(mi<middle.length && out.includes(middle[mi])) mi++;
    if(mi<middle.length) out.push(middle[mi++]);
  }
  return out.slice(0,count);
}
export function downloadJson(filename,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
export function safeText(v){return String(v??'');}
