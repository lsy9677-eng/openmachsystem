/* 230MATCH main draw single-entry loader
 * Active engine: main-draw-v1037.js only.
 * Do not add older main-draw-v*.js fallbacks here.
 */
(function () {
  'use strict';

  if (window.__V1037_AUTHORITATIVE_MAIN_DRAW_INSTALLED) return;
  if (document.getElementById('mainDrawV1037Engine')) return;

  var script = document.createElement('script');
  script.id = 'mainDrawV1037Engine';
  script.src = './assets/js/main-draw-v1037.js?v=1037-clean';
  script.async = false;
  script.onload = function () {
    console.info('[main-draw] v1037 authoritative engine loaded');
  };
  script.onerror = function () {
    console.error('[main-draw] failed to load main-draw-v1037.js');
  };
  (document.head || document.documentElement).appendChild(script);
})();
