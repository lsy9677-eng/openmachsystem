/* 230MATCH single-entry loader: v1052 persistent boot */
(function(){
  'use strict';
  if(window.__V1052_MAIN_DRAW_LOADER__) return;
  window.__V1052_MAIN_DRAW_LOADER__=true;
  var s=document.createElement('script');
  s.id='mainDrawV1052Engine';
  s.src='./assets/js/main-draw-v1052.js?v=1052-persistent-boot';
  s.async=false;
  s.onload=function(){console.info('[main-draw] v1052 persistent-boot engine loaded');};
  s.onerror=function(){console.error('[main-draw] failed to load main-draw-v1052.js');};
  (document.head||document.documentElement).appendChild(s);
})();
