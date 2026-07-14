/* 230MATCH main draw single-entry loader — v1037 controls fix */
(function(){
  'use strict';
  if (window.__V1037_AUTHORITATIVE_MAIN_DRAW_INSTALLED) return;
  if (document.getElementById('mainDrawV1037Engine')) return;
  var script=document.createElement('script');
  script.id='mainDrawV1037Engine';
  script.src='./assets/js/main-draw-v1037.js?v=1037-controls-fix-1';
  script.async=false;
  script.onload=function(){console.info('[main-draw] v1037 controls fix loaded');};
  script.onerror=function(){console.error('[main-draw] failed to load v1037 controls fix');};
  (document.head||document.documentElement).appendChild(script);
})();
