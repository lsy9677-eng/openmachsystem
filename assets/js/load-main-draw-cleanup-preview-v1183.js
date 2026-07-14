(function(){
  'use strict';
  window.loadMainDrawCleanupPreviewV1183 = function(){
    if(window.MainDrawCoreV2ReadOnly &&
       typeof window.MainDrawCoreV2ReadOnly.printCleanupPlan === 'function'){
      return Promise.resolve(window.MainDrawCoreV2ReadOnly);
    }
    return new Promise(function(resolve,reject){
      var id='mainDrawCleanupPreviewV1183Runtime';
      document.getElementById(id)?.remove();
      var s=document.createElement('script');
      s.id=id;
      s.src='./assets/js/main-draw-cleanup-preview-v1183.js?v=1183a';
      s.async=true;
      s.onload=function(){ resolve(window.MainDrawCoreV2ReadOnly); };
      s.onerror=function(){ reject(new Error('정리 미리보기 모듈 로드 실패')); };
      document.head.appendChild(s);
    });
  };
  console.log('[230MATCH] optional cleanup preview loader file available');
})();