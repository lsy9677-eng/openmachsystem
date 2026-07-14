/* 230MATCH main draw single-entry loader — v1038 only */
(function(){
  'use strict';
  if (window.__V1038_MAIN_DRAW_INSTALLED__) return;
  if (document.getElementById('mainDrawV1038Engine')) return;
  var s=document.createElement('script');
  s.id='mainDrawV1038Engine';
  s.src='./assets/js/main-draw-v1038.js?v=1038-new-main-engine';
  s.async=false;
  s.onload=function(){ console.info('[main-draw] v1038 new main engine loaded'); };
  s.onerror=function(){ console.error('[main-draw] failed to load v1038 engine'); };
  (document.head||document.documentElement).appendChild(s);
})();
