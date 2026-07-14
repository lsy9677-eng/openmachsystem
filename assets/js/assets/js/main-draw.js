/* 230MATCH main draw single-entry loader: v1040 */
(function(){
  'use strict';
  if (window.__V1039_MAIN_DRAW_LOADER__) return;
  window.__V1039_MAIN_DRAW_LOADER__ = true;
  var s=document.createElement('script');
  s.id='mainDrawV1039Engine';
  s.src='./assets/js/main-draw-v1040.js?v=1039-queue/status/balanced';
  s.async=false;
  s.onload=function(){console.info('[main-draw] v1040 queue/status/balanced engine loaded');};
  s.onerror=function(){console.error('[main-draw] failed to load main-draw-v1040.js');};
  (document.head||document.documentElement).appendChild(s);
})();
