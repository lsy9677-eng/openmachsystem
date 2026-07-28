STAGE 31.57 · NOTIFICATION CENTER & PUSH QUEUE BRIDGE
- 기존 open-match-manager Firebase 설정을 V3 인증에 직접 연결
- Google Firebase popup/redirect 로그인
- /naver/login → /naver/callback custom token 연결
- /kakao/login → /kakao/callback custom token 연결
- OAuth 복귀 후 V3에서 signInWithCustomToken 처리
- Firestore users/{uid} 프로필과 role/approved 상태 연결
- 기존 관리자/진행자 이메일 보정 및 PIN 비상 로그인 유지
- 네이버 login function에 returnUrl state 전달 보완
업로드: 기존 v3 폴더 교체. functions 폴더는 삭제하지 말고 동봉된 naver/kakao 파일만 덮어쓰기.
