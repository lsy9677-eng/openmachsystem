230MATCH V3 STAGE 32.1.2
FIREBASE SDK & NAVER RETURN HOTFIX

수정:
- auth-engine과 sync-engine Firebase SDK를 10.12.0으로 통일
- Firestore 인스턴스 불일치로 발생한 collection()/doc() 오류 수정
- 네이버 로그인 후 V3 복귀를 위한 functions/naver/login.js 별도 패치 제공

배포:
1) 01_OPERATION_UPLOAD/v3를 기존 v3와 교체
2) 02_FUNCTIONS_PATCH/functions/naver/login.js를 기존 functions/naver/login.js와 교체
3) 기존 functions/naver/callback.js는 그대로 유지
