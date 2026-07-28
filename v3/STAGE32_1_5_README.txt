230MATCH V3 Stage32.1.5

네이버 로그인 후 V3로 돌아왔지만 로그아웃으로 표시되던 문제 수정.
원인: 앱 라우터가 Firebase customToken 해시를 인증 처리 전에 #home으로 교체.
수정: 최초 인증 해시를 즉시 sessionStorage에 보관하고 Firebase signInWithCustomToken 완료 후 제거.

배포: GitHub v3 폴더만 교체. 기존 functions/naver/login.js와 callback.js는 유지.
