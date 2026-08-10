import { getAuthRuntime } from './auth-engine.js?v=3565';

const FIREBASE_STORAGE_URL='https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
let storageApi=null;
let storage=null;

function cleanSegment(value,fallback='item'){
  const out=String(value||'').trim().replace(/[^a-zA-Z0-9가-힣._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
  return out||fallback;
}
function cleanFileName(value,type='image/webp'){
  const ext=type==='image/png'?'.png':type==='image/jpeg'?'.jpg':'.webp';
  const base=String(value||'image').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9가-힣._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'image';
  return base+ext;
}
async function ensureStorage(){
  if(storage)return storage;
  const rt=await getAuthRuntime();
  if(!rt?.user)throw new Error('이미지 업로드는 관리자 로그인 후 사용할 수 있습니다.');
  storageApi=storageApi||await import(FIREBASE_STORAGE_URL);
  storage=storageApi.getStorage(rt.auth.app);
  return storage;
}
async function dataUrlToBlob(dataUrl){
  const response=await fetch(dataUrl);
  if(!response.ok)throw new Error('이미지 변환에 실패했습니다.');
  return response.blob();
}
export async function uploadManagedImage({folder,ownerId,itemId='',dataUrl,fileName='',contentType='',previousPath=''}){
  if(!String(dataUrl||'').startsWith('data:image/'))return {url:String(dataUrl||''),path:previousPath||'',name:fileName||'',type:contentType||''};
  await ensureStorage();
  const blob=await dataUrlToBlob(dataUrl);
  const type=contentType||blob.type||'image/webp';
  if(!type.startsWith('image/'))throw new Error('이미지 파일만 업로드할 수 있습니다.');
  if(blob.size>10*1024*1024)throw new Error('업로드 이미지는 10MB 이하여야 합니다.');
  const name=cleanFileName(fileName,type);
  const path=[cleanSegment(folder,'images'),cleanSegment(ownerId,'tournament'),itemId?cleanSegment(itemId,'item'):'',`${Date.now()}-${name}`].filter(Boolean).join('/');
  const ref=storageApi.ref(storage,path);
  await storageApi.uploadBytes(ref,blob,{contentType:type,cacheControl:'public,max-age=3600'});
  const url=await storageApi.getDownloadURL(ref);
  if(previousPath&&previousPath!==path){try{await storageApi.deleteObject(storageApi.ref(storage,previousPath));}catch(error){if(error?.code!=='storage/object-not-found')console.warn('[230MATCH] previous Storage image cleanup skipped',error);}}
  return {url,path,name,type,size:blob.size};
}
export async function deleteManagedImage(path){
  if(!path)return false;
  try{await ensureStorage();await storageApi.deleteObject(storageApi.ref(storage,path));return true;}
  catch(error){if(error?.code==='storage/object-not-found')return true;console.warn('[230MATCH] Storage image delete skipped',error);return false;}
}
export function managedImageUrl(record){return String(record?.imageUrl||record?.imageDataUrl||'');}
