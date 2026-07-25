# 230MATCH V3 — Stage 30.1 Null Guard Fix

수정:
- 전체 통합 운영으로 제거된 구형 `courtGrid`, `sharedQueue`, `refreshQueueBtn` 참조를 안전 처리
- `Cannot set properties of null (setting 'className')` 오류 수정
- 전체 통합 운영·미확정 슬롯 보호 기능 유지
