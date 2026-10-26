# 로컬 환경 구현·검증 기록

검증일: 2026-10-26 (Asia/Seoul). 브랜치: `dev/safe-local-emulators`, 기준 커밋: `ff91192`. 작업 시작 시 `main` 작업 트리는 깨끗했다. 커밋·푸시·배포는 하지 않았다.

## 실행 결과

| 검증 | 결과와 범위 |
| --- | --- |
| 단위·운영 보존 테스트 | `npm.cmd test`: 6개 통과. 호스트 허용 목록, demo 설정 강제, 자격 증명 환경 제거, 미들웨어 조기 모의 응답, 운영 초기화 재시도·설정 재적용 및 기존 Functions·Firebase 설정 보존 확인 |
| 통합 실행 명령 | `npm.cmd run test:emulators`: Emulator 시작 → 브라우저 6개 테스트 통과 → Emulator 종료, exit 0 |
| 로그인 | Google 모의 버튼 경로가 가상 계정을 Auth Emulator에 생성·로그인. Firebase 프로젝트 ID `demo-230match` 확인 |
| 세션 복원 | 새로고침 후 동일 UID와 관리자 역할 복원 |
| 대회 생성 | 실제 대회 목록의 새 대회 버튼과 마법사 입력·확인·생성 클릭. Firestore 매니페스트와 조각 저장 확인 |
| 대회·결과 저장·재조회 | 가상 32개 팀, 앱 대진·경기 결과 엔진에서 6:2 결과 입력 후 Sync 저장. Firestore 문서 존재 및 재조회한 대회명·경기 완료 상태·점수 확인. 로컬 캐시 응답 제외 |
| 이미지 | 앱 이미지 업로드 함수 → Storage Emulator. 다운로드 URL 호스트 `127.0.0.1:9199`, 내려받은 바이트 크기 일치. 공지 다운로드 링크의 파일 저장 이벤트·파일명·실패 없음 확인 |
| 푸시·문자 | FCM 등록/큐 생성 및 문자 발송 함수가 모의 응답. 실제 발송 함수가 호출되면 실패하도록 검증. 서비스 워커 등록 0건 |
| 외부 OAuth | 네이버·카카오 가상 계정 모의 처리. 외부 인증 페이지·토큰 API 요청 없음 |
| 저장소 분리 | 기존 접두사 없는 localStorage 항목 보존, 개발 값의 별도 저장, Firebase Auth를 포함한 IndexedDB와 Cache Storage 이름에 개발 접두사 확인 |
| 실행 중 연결 장애 | 로그인 후 모든 Emulator 요청을 실패시킴. Auth는 `auth/network-request-failed`, 푸시는 모의 처리, 운영 Auth URL 직접 fetch도 차단 |
| 시작 시 장애 | Emulator 연결 실패 시 앱 초기화 중단. 운영 Firebase·OAuth·FCM·문자 요청이 발생하면 실패하는 네트워크 감시 적용 |
| 실제 Emulator 종료 | 9099·8080·9199 TCP 연결 거부 확인 후 `REAL_EMULATORS_OFF=1`로 장애 주입 없이 offline 테스트 3개 통과, exit 0 |
| 미확인 호스트 | 앱은 Firebase SDK 요청 전에 중단, Pages 함수는 403 |
| 비공개 파일 제공 차단 | `.git`, `.dev.vars`, Functions 소스, node_modules와 인코딩된 경로 우회 요청 404 |
| 구문·변경 검사 | 변경·추가 JS/MJS 30개 `node --check` 통과, `git diff --check` 통과. package.json과 lockfile 의존성 일치 |

## 추가 Wrangler 검증 및 수정

- Wrangler 4.152.0, workerd 1.20261019.1, 동일 버전의 Miniflare 런타임을 고정했다. Windows의 누락된 C++ 런타임 DLL은 Microsoft 공식 패키지를 `.tools/vclibs`에 압축 해제해 해결했다. 시스템 설치는 하지 않았다.
- **수정 1:** 기존 로컬 미들웨어가 정적 파일까지 모의 JSON으로 바꾸는 문제를 발견했다. API/OAuth만 모의 처리하고 HTML·JS·CSS는 통과시키도록 수정했다. 비밀파일·설정파일 경로는 거부한다.
- **수정 2:** 운영 Auth 초기화까지 Promise를 고정하면 실패 후 재시도와 설정 재적용이 막힐 수 있었다. 운영은 매 호출마다 기존 방식으로 초기화·재시도하고 개발만 Emulator 중복 연결 방지 Promise를 유지하도록 수정했다.
- **테스트 보완:** 새로고침 직후 브라우저 테스트가 앱 초기화 완료 전에 Sync 설정을 덮어쓰던 경쟁 상태를 제거했다. Bootstrap 완료와 관리자 UI 적용을 기다린 뒤 검증한다.
- `npm.cmd run test:pages`: **2개 통과, exit 0**. 실제 `wrangler pages dev` HTTP에서 Functions 7개 경로 × GET/POST/OPTIONS = **21개 모의 응답**, 정적 파일 정상 제공, 비밀 경로 404, Host/전달 헤더로 운영 핸들러에 진입하지 않음 확인.
- 같은 명령에서 Wrangler가 빌드한 라우터를 workerd에 로드하고 **모든 외부 fetch를 전송 전에 차단**했다. 차단기 자체의 동작을 확인한 뒤, 가상 코드·상태·이미지 URL을 넣은 로컬 경로들의 외부 요청이 **0건**임을 확인했다. 운영 URL은 가상 입력일 뿐 실제 접속하지 않았다.
- `npm.cmd run test:emulators:pages`: **브라우저 6개 통과, exit 0**. 실제 Wrangler 서버에서 로그인·세션 복원·대회 생성/결과 저장·이미지 업로드/다운로드·OAuth/문자/푸시 모의·연결 장애·저장소 분리를 재검증했다. Emulator는 정상 종료했다.
- `REAL_EMULATORS_OFF=1` + Pages 설정의 offline 테스트: **3개 통과, exit 0**. 실제 Emulator 종료 상태에서도 운영 요청 없이 시작 중단을 확인했다.
- 운영 보존 범위: 기존 Functions 8개 파일과 `_headers`를 기준 커밋과 비교하고, 클라이언트·FCM SW의 공개 Firebase 설정을 비교했다. 가짜 SDK로 운영 모드에서 Emulator 연결·개발 CSP·저장소 래퍼가 적용되지 않음, 초기화 실패 후 재시도 및 다른 설정 재적용을 확인했다. workerd의 가상 운영 요청에서는 기존 네이버 리다이렉트와 자격 증명 없는 푸시 오류 응답을 확인했다.

브라우저 테스트는 loopback 및 공식 Firebase SDK 정적 모듈 외 요청을 전송 전에 중단하고 기록하며, 예상 밖의 요청 목록이 비어 있어야 통과한다. 실제 운영 Firebase·OAuth·FCM·문자 서비스를 호출하지 않았다.

## 변경 검토

- Firebase 초기화는 공통 런타임으로 모았다. Sync의 별도 Firebase 초기화·운영 fallback 코드는 제거했다. 공지·참가 신청·개인 기록·브리지는 같은 Auth 런타임의 Firestore를 사용한다.
- 개발에서는 버전 쿼리가 다른 Auth 모듈 사이에서도 초기화 Promise를 공유해 Emulator 중복 연결을 막았다. 운영은 기존 재시도·설정 재적용 동작을 유지한다.
- 로컬 사전 연결 검사, demo 프로젝트 강제, SDK의 세 서비스 Emulator 연결, CSP와 fetch 차단, 로컬 Functions 조기 모의 응답을 함께 검토했다.
- 이미지 변환에 필요한 data/blob 허용과 공지 이미지 파일 저장 경로를 검증 중 보완했다. 개발 서버의 인코딩된 경로 우회도 차단했다.
- Emulator 실행기는 자격 증명 관련 환경 변수와 CLI 환경 출력 가능성이 있는 DEBUG 설정을 자식 프로세스에 전달하지 않는다. 실제 비밀값을 문서나 소스에 추가하지 않았다.
- 운영 origin에서는 개발 저장소 래퍼·CSP·모의 발송을 적용하지 않는다. 운영 푸시 함수의 인증·권한 개선은 별도 항목으로 남겼다.

## 미검증 범위

- 운영 사이트의 실접속·회귀 테스트, 실제 운영 Rules·IAM·OAuth 콘솔·배포 설정: 접근하지 않음.
- 실제 Cloudflare 운영 엣지·계정 바인딩·서비스 계정 기반 운영 발송: 검증하지 않음. Wrangler/workerd 로컬 검증은 완료했지만 운영 실접속 회귀 테스트를 대신하지 않는다.
- 모든 대진·결과 입력·이미지 편집 화면의 클릭 조합, 모바일 기기·Safari·Firefox: 검증하지 않음. Chromium에서 대회 마법사와 공지 파일 다운로드를 검증하고 경기 결과·이미지 업로드는 실제 앱 모듈로 검증함.
- 기존 로컬 서비스 워커가 이미 제어하는 브라우저 프로필: 자동 해제·중단 코드 검토만 수행함. 전용 브라우저 프로필 사용을 권장함.
- 실제 발송·운영 푸시 함수 권한 문제: 이번 범위에서 실행·수정하지 않음.

설치와 재현 방법: [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md).
