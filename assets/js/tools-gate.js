(function(){
  'use strict';
  if(window.__v988ToolGateInstalled) return;
  window.__v988ToolGateInstalled = true;

  const VERSION = 'v988 로그인도구복구';
  const TOOL_IDS = [
    'v979ToolToggle','v953ModeSwitch','v952ModeSwitch','v954ResultGuardBar',
    'v950ModeBadge','v951SmsTimeNotice','v953ModeSafetyBanner','bracketFreshnessBadge'
  ];

  function $(id){ return document.getElementById(id); }
  function clean(v){ return String(v || '').replace(/\s+/g, ' ').trim(); }
  function body(){ return document.body || document.documentElement; }
  function textOf(el){ return clean(el && (el.innerText || el.textContent || el.value) || ''); }
  function visible(el){
    try{
      if(!el) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
    }catch(e){ return false; }
  }
  function headerText(){
    try{ return textOf(document.querySelector('.header-actions,.login-menu-wrap,.app-header')); }
    catch(e){ return ''; }
  }
  function loginButtonText(){
    try{ return textOf($('loginMenuBtn') || document.querySelector('.login-menu-btn')); }
    catch(e){ return ''; }
  }
  function definitelyLoggedOut(){
    try{
      const t = loginButtonText();
      if(/로그인/.test(t) && !/로그아웃|님|이상영|canyone2/i.test(t)) return true;
      const ht = headerText();
      if(/로그인/.test(ht) && !/로그아웃|님|이상영|canyone2/i.test(ht) && !/개발자|관리자|운영자|진행자/.test(ht)) return true;
    }catch(e){}
    return false;
  }
  function profilePrivileged(){
    try{
      const profiles = [
        window.CURRENT_APP_PROFILE,
        window.currentUserProfile,
        window.USER_PROFILE,
        window.profile,
        window.me
      ].filter(Boolean);
      for(const p of profiles){
        const role = clean(p.role || p.userRole || p.permission || p.type).toLowerCase();
        const email = clean(p.email || p.userEmail).toLowerCase();
        const name = clean(p.name || p.displayName || p.userName);
        if(email === 'canyone2@naver.com' || name.indexOf('이상영') >= 0) return true;
        if(/developer|admin|operator|manager|host|staff/.test(role)) return true;
        if(/개발자|관리자|운영자|진행자/.test(role)) return true;
      }
    }catch(e){}
    return false;
  }
  function globalPrivileged(){
    try{ if(window.AD === true || window.TM === true || window.OP === true) return true; }catch(e){}
    try{ if(typeof AD !== 'undefined' && AD === true) return true; }catch(e){}
    try{ if(typeof TM !== 'undefined' && TM === true) return true; }catch(e){}
    try{ if(typeof OP !== 'undefined' && OP === true) return true; }catch(e){}
    return false;
  }
  function badgePrivileged(){
    try{
      const candidates = [
        $('adminBadge'), $('opLoginBadge'), $('regLoginBadge'), $('adminSettingsBtn'),
        document.querySelector('.admin-badge.show'),
        document.querySelector('[data-role="admin"],[data-role="developer"],[data-role="operator"],[data-role="manager"]')
      ].filter(Boolean);
      for(const el of candidates){
        const t = textOf(el);
        if(visible(el) && /개발자|관리자|운영자|진행자|이상영|canyone2/i.test(t + ' ' + (el.id || '') + ' ' + (el.className || ''))) return true;
      }
    }catch(e){}
    return false;
  }
  function headerPrivileged(){
    const t = headerText() + ' ' + loginButtonText();
    if(/이상영\s*님|이상영|canyone2@naver\.com/i.test(t)) return true;
    if(/개발자|관리자|운영자|진행자/.test(t) && /님|로그아웃/.test(t)) return true;
    return false;
  }
  function bodyPrivileged(){
    try{
      const cls = body().className || '';
      // dev.html이라서 붙는 dev-mode만으로는 권한 인정하지 않는다.
      if(/admin-mode|tm-mode|operator-mode|op-mode|developer-mode/i.test(cls)) return true;
      if(/dev-mode/i.test(cls) && !definitelyLoggedOut() && (headerPrivileged() || badgePrivileged() || globalPrivileged() || profilePrivileged())) return true;
    }catch(e){}
    return false;
  }
  function isPrivileged(){
    if(definitelyLoggedOut() && !(headerPrivileged() || profilePrivileged() || globalPrivileged())) return false;
    return !!(globalPrivileged() || profilePrivileged() || badgePrivileged() || headerPrivileged() || bodyPrivileged());
  }
  function hardHide(el){
    if(!el) return;
    try{
      el.style.setProperty('display','none','important');
      el.style.setProperty('visibility','hidden','important');
      el.style.setProperty('pointer-events','none','important');
    }catch(e){}
  }
  function hardShow(el, display){
    if(!el) return;
    try{
      el.style.setProperty('display', display || 'flex', 'important');
      el.style.setProperty('visibility','visible','important');
      el.style.setProperty('pointer-events','auto','important');
    }catch(e){}
  }
  function mode(){
    const p = String(location.pathname || '').toLowerCase();
    if(p.indexOf('replay') >= 0) return 'replay';
    if(p.indexOf('dev') >= 0) return 'dev';
    return 'live';
  }
  function ensureModeSwitch(){
    let panel = $('v953ModeSwitch');
    if(!panel){
      panel = document.createElement('div');
      panel.id = 'v953ModeSwitch';
      document.body.appendChild(panel);
    }
    if(!panel.querySelector('button[data-mode]')){
      panel.innerHTML = '';
      const lab = document.createElement('span');
      lab.className = 'v953-label';
      panel.appendChild(lab);
      [
        ['운영','live','/'],
        ['복기/복구','replay','/replay.html'],
        ['개발','dev','/dev.html']
      ].forEach(([label, m, path]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.setAttribute('data-mode', m);
        b.onclick = function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          const u = new URL(path, location.origin);
          u.searchParams.set('v','988');
          u.searchParams.set('__ts', String(Date.now()));
          location.href = u.toString();
        };
        panel.appendChild(b);
      });
    }
    try{
      const lab = panel.querySelector('.v953-label');
      if(lab) lab.textContent = mode() === 'dev' ? '개발' : (mode() === 'replay' ? '복기/복구' : '운영');
      panel.querySelectorAll('button[data-mode]').forEach(b => b.classList.toggle('active', b.getAttribute('data-mode') === mode()));
    }catch(e){}
    return panel;
  }
  function ensureToolToggle(){
    let btn = $('v979ToolToggle');
    if(!btn){
      btn = document.createElement('button');
      btn.id = 'v979ToolToggle';
      btn.type = 'button';
      btn.title = '하단 운영/복기/개발, 결과 되돌리기 도구를 숨기거나 다시 보입니다.';
      btn.onclick = function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        const hidden = !document.body.classList.contains('v979-floating-hidden');
        document.body.classList.toggle('v979-floating-hidden', hidden);
        try{ localStorage.setItem('v979FloatingHidden', hidden ? '1' : '0'); }catch(e){}
        apply();
      };
      document.body.appendChild(btn);
    }
    btn.textContent = document.body.classList.contains('v979-floating-hidden') ? '도구 보이기' : '도구 숨김';
    return btn;
  }
  function modalOpen(){
    try{
      if(document.body.classList.contains('v979-modal-open') || document.body.classList.contains('v977-notice-modal-open')) return true;
      if(document.querySelector('.v977-backdrop,.v977-image-viewer,.modal-overlay.open')) return true;
    }catch(e){}
    return false;
  }
  function apply(){
    const ok = isPrivileged();
    document.documentElement.classList.toggle('v988-privileged-tools', ok);
    document.documentElement.classList.toggle('v982-is-priv', ok);
    document.documentElement.classList.toggle('v979-is-admin', ok);
    document.body.classList.toggle('v988-privileged-tools', ok);
    document.body.classList.toggle('v986-public-tools-hidden', !ok);

    if(!ok){
      TOOL_IDS.forEach(id => hardHide($(id)));
      return;
    }

    // 권한 있는 사용자는 최소한 도구 보이기/숨김 버튼은 항상 접근 가능해야 한다.
    const toggle = ensureToolToggle();
    hardShow(toggle, 'inline-flex');

    const floatingHidden = document.body.classList.contains('v979-floating-hidden');
    const inModal = modalOpen();
    const panel = ensureModeSwitch();
    const undo = $('v954ResultGuardBar');

    if(floatingHidden || inModal){
      hardHide(panel);
      hardHide(undo);
    }else{
      hardShow(panel, 'flex');
      if(undo) hardShow(undo, 'flex');
    }

    ['v950ModeBadge','v951SmsTimeNotice','v953ModeSafetyBanner','bracketFreshnessBadge'].forEach(id => {
      const el = $(id);
      if(el) hardShow(el, id === 'bracketFreshnessBadge' ? 'inline-flex' : 'block');
    });
    try{ const b = $('bracketFreshnessBadge'); if(b) b.textContent = VERSION; }catch(e){}
  }

  window.v988ApplyToolGate = apply;
  // 기존 inline 패치들이 다시 숨기더라도 마지막에 이 게이트가 다시 정리한다.
  ['click','input','change','keyup','pointerup','touchend'].forEach(evt => document.addEventListener(evt, () => setTimeout(apply, 80), true));
  [0,120,350,800,1400,2400,4200,7000].forEach(t => setTimeout(apply, t));
  setInterval(apply, 500);
})();

/* v1003: persist safety banner temporary hide */
(function(){
  'use strict';
  if(window.__V1003_SAFETY_BANNER_HIDE_INSTALLED) return;
  window.__V1003_SAFETY_BANNER_HIDE_INSTALLED = true;
  const KEY='v1003SafetyBannerHidden:'+String(location.pathname||'');
  function hideBanner(){
    try{
      const b=document.getElementById('v953ModeSafetyBanner');
      if(b && sessionStorage.getItem(KEY)==='1'){
        b.style.setProperty('display','none','important');
        b.style.setProperty('visibility','hidden','important');
        b.style.setProperty('pointer-events','none','important');
      }
    }catch(e){}
  }
  document.addEventListener('click', function(ev){
    try{
      const btn=ev.target && ev.target.closest && ev.target.closest('#v953ModeSafetyBanner button.ghost');
      if(btn){ sessionStorage.setItem(KEY,'1'); setTimeout(hideBanner,0); setTimeout(hideBanner,80); }
    }catch(e){}
  }, true);
  [0,120,400,900,1600,2600,5000].forEach(t=>setTimeout(hideBanner,t));
  setInterval(hideBanner,1000);
})();
