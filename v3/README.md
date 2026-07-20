# 230MATCH V3 6.3.1

이전 HTML과 새 JavaScript가 캐시에서 섞이며 `minimumMatchMinutes` 요소가 null이 되어 앱 시작이 중단되던 문제를 수정했습니다.

- 새 JavaScript 파일명 `app-v30631.js`
- 설정 DOM 접근 null-safe 처리
- 버튼 이벤트 초기화 중단 방지
- 40분 기본 / 30분 최소 정책 유지
