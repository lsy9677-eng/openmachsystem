/* 230MATCH single-entry loader: v1051 static-host */
(function(){
  'use strict';
  if(window.__V1051_MAIN_LOADER__) return;
  window.__V1051_MAIN_LOADER__=true;
  const s=document.createElement('script');
  s.id='mainDrawV1051Engine';
  s.src='./assets/js/main-draw-v1051.js?v=1051-static-host';
  s.async=false;
  s.onload=()=>console.info('[main-draw] v1051 static-host engine loaded');
  s.onerror=()=>console.error('[main-draw] failed to load main-draw-v1051.js');
  (document.head||document.documentElement).appendChild(s);
})();
