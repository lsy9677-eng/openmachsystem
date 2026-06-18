// v986 preboot guard split from dev.html
// Runs before main app scripts. Keep this file loaded first in <head>.
(function(){ window.__V986_PREBOOT_SPLIT_LOADED = true; })();

// === v939PreBootLegacyConsoleClean ===
(function(){
  'use strict';
  if(window.__v939PreBootInstalled) return;
  window.__v939PreBootInstalled = true;
  window.__V939_LEGACY_CLEAN_MODE = true;
  window.__V939_DEBUG_LEGACY_LOGS = false;

  const DROP_RE = /\[(?:v728|v739|v748|v771|v785|v786|v787|v788|v789|v790|v791|v798|v822|v900|v902|v906|v907|v908|v909|v910|v911|v912|v913|v914|v915|v916|v917|v918|v919|v920|v921|v922|v923|v925|v926|v927|v928|v929|v930|v931|v932|v933|v934|v935|v936|v937|v938)\b|venue split|MutationObserver blocked|fast interval blocked|persist done|wrapped window|blocked body|blocked #|설치완료|installed|fixed installed|installed|A4 v731|manual128-firestore-safe|quickwin-restore|round64-repair|result-scroll-stay|legacy v900|원도심:\s*\d+\s*국제:\s*\d+|공용대기 분리|부전승 32개 보정/i;
  const KEEP_RE = /\[v939\]|v939|error|failed|실패|오류/i;
  function stringifyArgs(args){
    try{return Array.from(args).map(a=>{
      if(typeof a==='string') return a;
      if(a && a.message) return a.message;
      if(a && a.id) return a.id;
      return '';
    }).join(' ');}catch(e){return '';}
  }
  ['log','info','warn','debug'].forEach(name=>{
    const old = console[name];
    if(typeof old !== 'function' || old.__v939Wrapped) return;
    const wrapped = function(){
      try{
        const msg = stringifyArgs(arguments);
        if(!window.__V939_DEBUG_LEGACY_LOGS && DROP_RE.test(msg) && !KEEP_RE.test(msg)) return;
      }catch(e){}
      return old.apply(console, arguments);
    };
    wrapped.__v939Wrapped = true;
    wrapped.__old = old;
    console[name] = wrapped;
  });
  window.v939SetDebugLegacyLogs=function(on){
    window.__V939_DEBUG_LEGACY_LOGS=!!on;
    try{console.log('[v939] legacy debug logs '+(on?'ON':'OFF'));}catch(e){}
  };
})();

// === v928PreBootLowLagGuard ===
(function(){
  'use strict';
  if(window.__v928PreBootInstalled) return;
  window.__v928PreBootInstalled = true;
  window.__v928BlockedIntervals = [];
  window.__v928ObserverCount = 0;
  window.__v928FastIntervalBlocked = 0;

  const NativeMO = window.MutationObserver;
  if(NativeMO && !NativeMO.__v928Wrapped){
    function QuietMutationObserver(cb){
      this.__cb = cb;
      this.__native = null;
      this.__active = false;
      this.__id = ++window.__v928ObserverCount;
    }
    QuietMutationObserver.prototype.observe = function(target, opts){
      try{
        const id = (target && target.id) ? '#'+target.id : (target===document.documentElement?'documentElement':(target===document.body?'body':''));
        // 기존 패치들의 DOM 감시자가 렉/무한 렌더의 주 원인이므로 기본 차단.
        if(window.__V928_ALLOW_MUTATION_OBSERVER === true){
          this.__native = new NativeMO(this.__cb);
          this.__active = true;
          return this.__native.observe(target, opts || {});
        }
        if(console && console.info) console.info('[v928] MutationObserver blocked', id, opts||{});
      }catch(e){}
    };
    QuietMutationObserver.prototype.disconnect = function(){ try{ if(this.__native) this.__native.disconnect(); }catch(e){} this.__active=false; };
    QuietMutationObserver.prototype.takeRecords = function(){ try{ return this.__native ? this.__native.takeRecords() : []; }catch(e){ return []; } };
    QuietMutationObserver.__v928Wrapped = true;
    QuietMutationObserver.__native = NativeMO;
    window.MutationObserver = QuietMutationObserver;
  }

  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearInterval = window.clearInterval.bind(window);
  window.__v928NativeSetInterval = nativeSetInterval;
  window.__v928NativeClearInterval = nativeClearInterval;
  window.setInterval = function(fn, delay){
    const d = Number(delay || 0);
    const src = String(fn || '');
    // 빠른 반복 루프는 화면 흔들림/렉의 주원인. Firebase 실시간 DB는 setInterval 없이 동작하므로 차단.
    if(d && d < 5000 && window.__V928_ALLOW_FAST_INTERVAL !== true){
      window.__v928FastIntervalBlocked++;
      const fakeId = 90000000 + window.__v928FastIntervalBlocked;
      window.__v928BlockedIntervals.push({id:fakeId, delay:d, src:src.slice(0,160)});
      try{ console.info('[v928] fast interval blocked', d, src.slice(0,80)); }catch(e){}
      return fakeId;
    }
    return nativeSetInterval(fn, delay);
  };
  window.clearInterval = function(id){ try{return nativeClearInterval(id);}catch(e){} };
})();
