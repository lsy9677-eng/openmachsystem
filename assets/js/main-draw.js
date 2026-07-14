/* 230MATCH single-entry loader: v1050 */
(function(){
  'use strict';
  if(window.__V1050_MAIN_LOADER__) return;
  window.__V1050_MAIN_LOADER__=true;
  const s=document.createElement('script');
  s.id='mainDrawV1050Engine';
  s.src='./assets/js/main-draw-v1050.js?v=1050-clean';
  s.async=false;
  s.onload=()=>console.info('[main-draw] v1050 clean main engine loaded');
  s.onerror=()=>console.error('[main-draw] failed to load main-draw-v1050.js');
  (document.head||document.documentElement).appendChild(s);
})();
