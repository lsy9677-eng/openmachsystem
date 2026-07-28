230MATCH V3 STAGE 31.64.1

INTERNAL TEST VIEW NAVIGATION HOTFIX

수정 사항
- 설정 허브의 실전 운영 검수, 리허설·시뮬레이션, 대용량 성능 테스트가 홈으로 돌아가던 문제 수정
- 상단 탭이 없는 관리자 전용 내부 화면도 실제 view 섹션과 관리자 권한을 확인하여 열도록 라우팅 보완
- 리허설 화면 진입 시 저장된 리허설 결과를 즉시 렌더링
- 기존 functions 및 Firebase 로그인/푸시 서버 파일 변경 없음

배포
- GitHub의 v3 폴더만 교체
- 확인: https://tennis230.pages.dev/v3/index.html?v=331641
