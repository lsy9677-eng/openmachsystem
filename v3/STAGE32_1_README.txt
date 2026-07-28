230MATCH V3 STAGE 32.1.1 · FIREBASE SETTINGS ENTRY HOTFIX

배포:
- GitHub의 기존 v3 폴더를 이 폴더로 교체합니다.
- 기존 functions 폴더와 알리고 Worker는 그대로 둡니다.

사용:
1. Firebase Console에서 FIRESTORE_RULES_V3.txt 내용을 기존 규칙과 병합하여 게시합니다.
2. 관리자 또는 진행자 계정의 users/{uid}.role이 admin/developer/operator/manager/staff/operator 계열인지 확인합니다.
3. V3에서 간편로그인합니다.
4. 설정 > Firebase 실시간 운영 연결에서 대회방 ID를 입력합니다.
5. Firebase 동기화 사용을 켜고 '설정 저장·연결'을 누릅니다.
6. '연결 점검'을 누릅니다.
7. 기준 기기에서 '현재 상태 업로드' 후 다른 기기에서 같은 대회방으로 연결합니다.

저장 위치:
- Firestore: v3TournamentRooms/{대회방ID}
- 로컬 저장과 복구점은 계속 병행됩니다.

권한:
- 일반 로그인 사용자: 읽기 전용
- 관리자/진행자: 읽기 및 쓰기
- 실제 서버 권한은 Firestore 규칙이 최종 결정합니다.
