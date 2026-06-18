
(function(){
  'use strict';
  if(window.__v986StrictPublicToolGateInstalled) return;
  window.__v986StrictPublicToolGateInstalled = true;

  const IDS = [
    'v979ToolToggle','v953ModeSwitch','v952ModeSwitch','v954ResultGuardBar',
    'v950ModeBadge','v951SmsTimeNotice','v953ModeSafetyBanner','bracketFreshnessBadge'
  ];

  function $(id){ return document.getElementById(id); }
  function txt(el){ return String(el && (el.innerText || el.textContent) || '').replace(/\s+/g,' ').trim(); }
  function isVisible(el){
    try{
      if(!el) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
    }catch(e){ return false; }
  }
  function hasGlobalRole(){
    try{ if(typeof AD !== 'undefined' && AD === true) return true; }catch(e){}
    try{ if(typeof TM !== 'undefined' && TM === true) return true; }catch(e){}
    try{ if(typeof OP !== 'undefined' && OP === true) return true; }catch(e){}
    try{ if(window.AD === true || window.TM === true || window.OP === true) return true; }catch(e){}
    return false;
  }
  function hasApprovedProfileRole(){
    try{
      const p = window.CURRENT_APP_PROFILE || {};
      const role = String(p.role || p.userRole || '').trim();
      const approved = p.approved === true || p.tournamentAdminApproved === true || p.operatorApproved === true || p.clubDirectorApproved === true;
      if((role === 'admin' || role === 'developer') && (p.uid || p.email || approved)) return true;
      if((role === 'tournament_admin' || role === 'operator' || role === 'manager') && approved) return true;
    }catch(e){}
    return false;
  }
  function hasRoleBadge(){
    try{
      const adminBadge = $('adminBadge');
      if(adminBadge && adminBadge.classList.contains('show') && isVisible(adminBadge) && /개발자|관리자|운영자|진행자/.test(txt(adminBadge))) return true;
      const opBadge = $('opLoginBadge');
      if(opBadge && opBadge.classList.contains('show') && isVisible(opBadge) && /진행자|운영자/.test(txt(opBadge))) return true;
    }catch(e){}
    return false;
  }
  function headerIndicatesLoggedOut(){
    try{
      const loginBtn = $('loginMenuBtn');
      const t = txt(loginBtn);
      if(isVisible(loginBtn) && /로그인/.test(t) && !/로그아웃|님/.test(t)) return true;
      const logoutBtn = $('googleLogoutBtn');
      if(!isVisible(logoutBtn) && isVisible(loginBtn) && /로그인/.test(t)) return true;
    }catch(e){}
    return false;
  }
  function bodyRoleAllowedOnlyWhenLoggedIn(){
    try{
      // dev.html이라는 이유로 붙는 dev-mode는 권한으로 보지 않는다.
      if(document.body.classList.contains('admin-mode') ||
         document.body.classList.contains('tm-mode') ||
         document.body.classList.contains('operator-mode') ||
         document.body.classList.contains('op-mode') ||
         document.body.classList.contains('developer-mode')){
        return !headerIndicatesLoggedOut();
      }
    }catch(e){}
    return false;
  }
  function isPrivileged(){
    // 비로그인 화면이면 어떤 dev 페이지/임시 클래스가 있어도 무조건 차단
    if(headerIndicatesLoggedOut() && !hasGlobalRole() && !hasRoleBadge() && !hasApprovedProfileRole()) return false;
    return !!(hasGlobalRole() || hasRoleBadge() || hasApprovedProfileRole() || bodyRoleAllowedOnlyWhenLoggedIn());
  }
  function hideElement(el){
    if(!el) return;
    try{
      el.style.setProperty('display','none','important');
      el.style.setProperty('visibility','hidden','important');
      el.style.setProperty('pointer-events','none','important');
    }catch(e){}
  }
  function showElement(el, display){
    if(!el) return;
    try{
      el.style.removeProperty('visibility');
      el.style.removeProperty('pointer-events');
      const modalOpen = document.body.classList.contains('v979-modal-open') || document.body.classList.contains('v977-notice-modal-open');
      const floatingHidden = document.body.classList.contains('v979-floating-hidden');
      if(el.id === 'v979ToolToggle'){
        if(modalOpen) hideElement(el);
        else el.style.setProperty('display', display || 'inline-flex', 'important');
        return;
      }
      if(el.id === 'v953ModeSwitch' || el.id === 'v954ResultGuardBar'){
        if(modalOpen || floatingHidden) hideElement(el);
        else el.style.setProperty('display', display || 'flex', 'important');
        return;
      }
      el.style.removeProperty('display');
    }catch(e){}
  }
  function apply(){
    const ok = isPrivileged();
    document.documentElement.classList.toggle('v986-priv-tools', ok);
    document.documentElement.classList.toggle('v982-is-priv', ok);
    document.documentElement.classList.toggle('v979-is-admin', ok);
    document.body.classList.toggle('v984-privileged-tools', ok);
    document.body.classList.toggle('v986-public-tools-hidden', !ok);

    if(!ok){
      IDS.forEach(id => hideElement($(id)));
      return;
    }

    showElement($('v979ToolToggle'), 'inline-flex');
    showElement($('v953ModeSwitch'), 'flex');
    showElement($('v954ResultGuardBar'), 'flex');
    ['v950ModeBadge','v951SmsTimeNotice','v953ModeSafetyBanner','bracketFreshnessBadge'].forEach(id=>{
      const el=$(id); if(el){ el.style.removeProperty('display'); el.style.removeProperty('visibility'); el.style.removeProperty('pointer-events'); }
    });
    try{ const b=$('bracketFreshnessBadge'); if(b) b.textContent='v986 도구권한정리 DEV'; }catch(e){}
  }

  window.v986ApplyStrictPublicToolGate = apply;
  ['click','input','change','keyup'].forEach(evt => document.addEventListener(evt, () => setTimeout(apply,50), true));
  [0,120,350,800,1400,2400,4200,7000].forEach(t => setTimeout(apply,t));
  setInterval(apply, 250);
})();
