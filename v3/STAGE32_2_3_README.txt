230MATCH V3 STAGE 32.2.3

BUTTON RESPONSE SYNTAX HOTFIX

수정:
- importLegacyTournament 함수를 async 함수로 변경
- await 예약어 SyntaxError 제거
- 앱 본체 모듈이 정상 로드되어 모든 버튼 이벤트 복구
- Stage32.2.2의 모던배 요약 보관 및 새 시작 기능 유지

배포: 기존 functions는 유지하고 v3 폴더만 교체
테스트: https://tennis230.pages.dev/v3/index.html?v=332023
