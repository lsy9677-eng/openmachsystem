# 230MATCH V3 Stage 35.3.3

## 적용 내용
- 모던배 전용 자동 복구·강제 주입 코드 중단
- 기존 브라우저에 이미 저장된 모던배 기록은 삭제하지 않음
- 신규 대회에 고유 tournamentId 자동 부여
- 각 부서를 divisionId 기준으로 분리 보존
- 상태 변경 후 IndexedDB 기록 금고에 자동 저장
- 대회/부서별 최근 자동 저장본 30개 유지
- 브라우저 종료 직전 emergency 최신 상태 별도 저장
- 대회 종료 감지 시 변경 불가능한 종료 스냅샷 자동 생성
- 관리자 대회 보관 버튼 사용 시 기록 금고 확정본도 생성
- 중복 확정본은 checksum으로 차단하고 변경 시 revision 추가
- 상단 저장 배지에 기록 저장 중/정상/오류 표시

## 기록 금고 콘솔 점검
브라우저 개발자 콘솔에서 아래 API를 사용할 수 있습니다.
- MatchRecordVault.status()
- MatchRecordVault.validate()
- MatchRecordVault.saveNow()
- MatchRecordVault.archiveNow()
- MatchRecordVault.listAutosaves()
- MatchRecordVault.listArchives()
