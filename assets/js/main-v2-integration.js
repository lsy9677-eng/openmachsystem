(function(){
  'use strict';
  if (window.__MAIN_V2_LAUNCHER_INSTALLED__) return;
  window.__MAIN_V2_LAUNCHER_INSTALLED__ = true;

  function openV2(){
    try {
      sessionStorage.setItem('230match-main-v2-return-url', location.href);
    } catch(e) {}
    location.href = './main-v2.html?v=23&from=legacy';
  }

  function install(){
    if (document.getElementById('mainV2IntegratedLauncher')) return;

    const btn = document.createElement('button');
    btn.id = 'mainV2IntegratedLauncher';
    btn.type = 'button';
    btn.textContent = '🏆 본선 운영 V2';
    btn.title = '새 본선 운영 시스템 열기';
    btn.style.cssText = [
      'position:fixed',
      'right:18px',
      'bottom:82px',
      'z-index:2147483000',
      'border:2px solid #f59e0b',
      'border-radius:999px',
      'padding:11px 16px',
      'background:#0f172a',
      'color:#fff',
      'font-weight:900',
      'font-size:14px',
      'box-shadow:0 10px 25px rgba(15,23,42,.28)',
      'cursor:pointer'
    ].join(';');
    btn.addEventListener('click', openV2);
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, {once:true});
  } else {
    install();
  }

  console.log('[MAIN-V2-INTEGRATION] v1.15 launcher loaded');
})();