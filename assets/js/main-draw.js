/* 230MATCH main draw single-entry loader: v1037-safe-controls-no-blank */
(function(){
  'use strict';
  if(document.getElementById('mainDrawV1037SafeEngine')) return;
  var s=document.createElement('script');
  s.id='mainDrawV1037SafeEngine';
  s.src='./assets/js/main-draw-v1037.js?v=1037-safe-02';
  s.async=false;
  s.onload=function(){console.info('[main-draw] v1037 safe controls/no-blank loaded');};
  s.onerror=function(){console.error('[main-draw] failed to load v1037 safe engine');};
  (document.head||document.documentElement).appendChild(s);
})();
