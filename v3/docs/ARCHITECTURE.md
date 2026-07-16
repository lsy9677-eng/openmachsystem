# 230MATCH V3 1단계 구조

- 기존 앱 코드, 전역 변수, 렌더러를 사용하지 않습니다.
- iframe, DOM 패치, MutationObserver를 사용하지 않습니다.
- 상태 원본은 `store.js`의 V3 상태 객체 하나입니다.
- 대진, 코트, 결과, UI는 각각 독립 모듈입니다.
- 현재 저장은 브라우저 localStorage만 사용합니다.
- Firebase, 문자 발송, 예선은 후속 단계에서 V3 전용 모듈로 추가합니다.
