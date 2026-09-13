function safeFilename(value){
  const raw=String(value||'230MATCH_공지이미지.jpg').replace(/[\r\n]/g,' ').trim();
  return (raw||'230MATCH_공지이미지.jpg').slice(0,180);
}
function allowedImageUrl(raw){
  let u;
  try{u=new URL(raw);}catch(_e){return null;}
  if(u.protocol!=='https:')return null;
  const host=u.hostname.toLowerCase();
  const allowed=host==='firebasestorage.googleapis.com' || host==='storage.googleapis.com' || host.endsWith('.googleapis.com');
  return allowed?u:null;
}
export async function onRequestGet(context){
  const reqUrl=new URL(context.request.url);
  const source=allowedImageUrl(reqUrl.searchParams.get('url')||'');
  if(!source)return new Response('Invalid image URL',{status:400,headers:{'Cache-Control':'no-store'}});
  const name=safeFilename(reqUrl.searchParams.get('name'));
  let upstream;
  try{
    upstream=await fetch(source.toString(),{method:'GET',redirect:'follow',headers:{'Accept':'image/*'}});
  }catch(_e){
    return new Response('Image fetch failed',{status:502,headers:{'Cache-Control':'no-store'}});
  }
  if(!upstream.ok)return new Response('Image fetch failed',{status:upstream.status,headers:{'Cache-Control':'no-store'}});
  const type=(upstream.headers.get('content-type')||'application/octet-stream').toLowerCase();
  if(!type.startsWith('image/'))return new Response('Not an image',{status:415,headers:{'Cache-Control':'no-store'}});
  const headers=new Headers();
  headers.set('Content-Type',type);
  headers.set('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  headers.set('Cache-Control','private, max-age=60');
  headers.set('X-Content-Type-Options','nosniff');
  const len=upstream.headers.get('content-length');
  if(len)headers.set('Content-Length',len);
  return new Response(upstream.body,{status:200,headers});
}
