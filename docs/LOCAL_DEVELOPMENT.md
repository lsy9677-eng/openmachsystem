# 230MATCH 로컬 개발

운영 프로젝트와 데이터를 복사하지 않는다. 로컬 프로젝트 ID는 `demo-230match`이며 실제 Firebase 프로젝트를 만들거나 로그인할 필요가 없다. `firebase login`, 서비스 계정, 운영 `.env`/`.dev.vars`를 사용하지 않는다.

## 설치

필요 도구: Node.js 22 이상, npm, Java 21 이상. 이 작업에서 Node 24.22.1 / npm 11.19.1, Firebase CLI 15.2.1, Java 21, Playwright 1.58.2 Chromium, Wrangler 4.152.0 / workerd 1.20261019.1을 사용했다.

```powershell
npm.cmd ci --ignore-scripts
npx.cmd playwright install chromium
```

Java는 PATH에서 찾는다. 작업 중 내려받은 휴대용 런타임이 `.tools/java21/<배포폴더>/bin/java.exe`에 있으면 실행기가 자동으로 사용한다. `.tools`와 `node_modules`는 Git에 포함하지 않는다. 새 체크아웃에는 Java를 별도로 설치해야 한다.

## 실행

터미널 1:

```powershell
npm.cmd run emulators
```

터미널 2:

```powershell
npm.cmd run dev
```

`http://127.0.0.1:8000`을 연다. Emulator는 Auth 9099, Firestore 8080, Storage 9199를 loopback에서 사용한다. 보조 포트는 Hub 4400, logging 4500, Firestore websocket 9150이다. 실행 중인 Emulator를 종료하면 가상 데이터가 초기화된다. 자동 import/export는 설정하지 않았다.

로컬 배너가 보이는지 확인한다. Google/네이버/카카오 로그인은 외부 OAuth로 이동하지 않고 `google@example.test`, `naver@example.test`, `kakao@example.test` 가상 관리자를 Auth Emulator에 생성·로그인한다. 이 가상 계정의 공통 비밀번호는 코드에 있는 **개발 전용 공개 테스트 비밀번호**다. 이메일 가입도 Auth Emulator를 사용하며 일반 회원으로 생성된다. 운영 관리자 계정을 사용하지 않는다.

화면에서 새 대회를 만들거나 대진을 시험한다. 운영 데이터를 가져오지 말고 가상 선수·연락처만 입력한다. 하단 배너와 `window.__230matchMocks`에서 모의 발송을 확인할 수 있다. 목록은 메모리 전용이라 새로고침하면 초기화된다.

## 분리와 차단

- 운영 초기화 허용 origin은 `https://tennis230.pages.dev` 하나다. HTTP 운영 주소, 별도 포트, preview/custom 도메인과 파일 직접 열기는 거부한다.
- 로컬은 HTTP loopback 주소만 허용한다. 공통 런타임이 Auth·Firestore를 실제 사용 전에 Emulator에 연결한다. Storage도 같은 앱을 사용하고 사용 전에 Storage Emulator에 연결한다. 버전별 중복 모듈도 같은 런타임을 공유한다.
- 공지·참가 신청·공개 신청·개인 기록·기존 Firestore 브리지는 Auth의 Firestore를 공유하므로 모두 demo 프로젝트를 사용한다. 동기화와 전역 공지는 개발 room `230match-development`를 사용한다.
- 기존 Firebase 설정 입력이나 저장된 운영 설정으로 로컬 프로젝트를 바꿀 수 없다. 시작 시 세 Emulator 중 하나라도 연결되지 않으면 앱을 시작하지 않는다. 실패한 런타임을 운영으로 재초기화하는 로직은 없다. 실행 중 끊기면 SDK가 로컬 대상으로만 실패/재시도한다.
- localStorage·sessionStorage·IndexedDB·Cache Storage 이름에는 `230match:dev:demo-230match:`를 붙인다. Firebase Auth의 IndexedDB도 포함한다. 로컬 `clear()`는 개발 키만 지운다. 운영 origin과 저장소 키는 유지한다.
- 개발 서버의 CSP와 HTML의 사전 정책이 Firebase 서비스·OAuth·FCM·문자 Worker로 나가는 연결을 차단한다. 이미지 변환용 data/blob와 loopback Emulator만 허용한다. SDK 정적 모듈은 기존과 같은 공식 `www.gstatic.com/firebasejs/10.12.0/`에서 받으므로 최초 로딩에는 인터넷이 필요하다. 이는 운영 데이터 API 접근과 별개다.
- 개발 서비스 워커 등록과 FCM 토큰 발급은 차단한다. 기존 로컬 SW는 해제하며 이미 페이지를 제어 중이면 실행을 중단하고 창을 다시 열도록 안내한다. 운영 SW 동작은 기존 origin에서 유지한다.
- 처음 실행할 때는 개발 전용 브라우저 프로필을 사용한다. 예전 로컬 서비스 워커가 캐시한 HTML 자체를 제공하는 프로필은 개발 코드를 받기 전에 이전 앱이 실행될 수 있으므로 해당 로컬 사이트의 기존 SW를 브라우저 설정에서 해제한 뒤 접속한다.
- 푸시 큐·등록, 문자 Worker 발송, 문자앱/intent 이동은 개발 모의 처리한다. 실제 SMS나 푸시가 발송되지 않는다. 배너는 모의 처리를 명시한다.
- 개발 서버는 운영 요청을 프록시하지 않는다. `/api/*`, `/naver/*`, `/kakao/*`에는 모의 JSON을 반환하며 비밀파일·`functions`·`.git`·`node_modules`를 제공하지 않는다.
- Pages Functions의 `_middleware.js`는 로컬 API/OAuth 요청에 자격 증명 접근과 개별 함수 실행 **이전**에 모의 응답을 반환한다. HTML·JS·CSS는 `next()`로 정적 파일을 제공하며 비밀파일 경로는 거부한다. 미확인 호스트는 403이다. 기본 개발 서버에는 Wrangler가 필요 없으며, 실제 Pages 런타임은 아래 명령으로 선택한다.
- `tools/*.local.rules`는 가상 데이터용 Emulator 규칙이다. 운영 보안 규칙이 아니며 배포하면 안 된다. `firebase.local.json`은 배포용 설정과 분리했다.

## 테스트

```powershell
npm.cmd test
# Emulator가 이미 켜져 있다면:
npm.cmd run test:e2e
# Emulator가 꺼져 있다면 실행·테스트·종료를 한 번에:
npm.cmd run test:emulators
```

`test:emulators` 실행 전 다른 Emulator를 종료한다. 개발 서버는 테스트 실행기가 자동 시작하며 8000에 이미 있으면 재사용한다.

실제로 Emulator를 모두 종료한 뒤 연결 실패 검증:

```powershell
$env:REAL_EMULATORS_OFF='1'
npm.cmd run test:offline
Remove-Item Env:REAL_EMULATORS_OFF
```

Firebase의 [Auth](https://firebase.google.com/docs/emulator-suite/connect_auth), [Firestore](https://firebase.google.com/docs/emulator-suite/connect_firestore), [Storage](https://firebase.google.com/docs/emulator-suite/connect_storage) Emulator 연결 방식을 따른다. `demo-` 프로젝트는 실제 클라우드 리소스 없이 검증하기 위한 구성이다.

## Wrangler Pages 로컬 런타임

```powershell
# 터미널 1: 가상 Firebase
npm.cmd run emulators
# 터미널 2: 실제 Pages Functions + 정적 파일
npm.cmd run dev:pages
```

접속 주소는 `http://127.0.0.1:8788`이다. 계정 로그인이나 `wrangler login`은 필요 없다. `pages dev .`로 저장소 전체를 공개하지 않는다. 실행기가 `.tools/pages-local/run-*`에 공개 파일과 실제 `functions/` 소스만 복사하고, 빈 `.env`·`.dev.vars`, 로컬 전용 Wrangler 설정을 만든다. 저장소나 상위 디렉터리의 자격 증명을 복사하지 않는다. 원본을 수정하면 서버를 재시작해 새 스냅샷을 만든다.

자식 프로세스의 Firebase·OAuth·SMS·Cloudflare 자격 증명 환경 변수를 제거하고, 프로세스 환경을 Worker 바인딩으로 가져오는 기능을 끈다. Wrangler 사용자 설정·로그는 `.tools` 아래에 격리하고 원격 바인딩·텔레메트리·버전 확인을 사용하지 않는다. `CF_PAGES_*` 자동 로컬 메타데이터만 표시될 수 있다. “Using secrets defined in .dev.vars” 출력은 생성한 **빈 파일**을 읽었다는 뜻이다.

Windows에서 workerd가 `0xC0000135`/`write EOF`로 시작하지 않으면 C++ 런타임 DLL이 필요할 수 있다. 이번 작업에서는 [Microsoft 공식 패키지](https://learn.microsoft.com/en-us/windows/msix/msix-troubleshooting-guide)에 있는 DLL을 `.tools/vclibs`에만 압축 해제해 사용했으며 시스템 설치·전역 PATH 변경은 하지 않았다. 재현할 때 시스템에 호환 런타임이 이미 있으면 이 단계가 필요 없다.

```powershell
Invoke-WebRequest 'https://aka.ms/Microsoft.VCLibs.x64.14.00.Desktop.appx' -OutFile '.tools/vclibs.zip'
Expand-Archive -LiteralPath '.tools/vclibs.zip' -DestinationPath '.tools/vclibs' -Force
```

검증 명령:

```powershell
npm.cmd test
# Emulator 없이도 가능한 실제 Functions HTTP + workerd 외부전송 감시
npm.cmd run test:pages
# Emulator와 Wrangler를 시작해 전체 브라우저 테스트 후 종료
npm.cmd run test:emulators:pages
# Emulator를 실제 종료한 상태의 Wrangler 오프라인 검증
$env:REAL_EMULATORS_OFF='1'
npx.cmd playwright test offline.spec.mjs --config playwright.pages.config.mjs
Remove-Item Env:REAL_EMULATORS_OFF
```

테스트 전 수동으로 실행한 Pages 서버와 Emulator를 종료한다. HTTP 검증은 8790, 브라우저 검증은 8788을 사용한다. `test:pages`는 빌드된 실제 Functions 라우터를 workerd에 추가로 로드하고 모든 외부 `fetch`를 차단·기록한다. 운영 호스트 검사는 실제 HTTP 접속 대신 가상 `dispatchFetch`로 수행하며 OAuth 리다이렉트를 따라가지 않는다. 이 외부전송 차단기는 **검증용**이다. 일반 `dev:pages`의 안전성은 로컬 미들웨어·브라우저 정책·자격 증명 제거에 의존한다.

로컬 Pages 사용법의 기준: [Cloudflare Pages 로컬 개발 문서](https://developers.cloudflare.com/pages/functions/local-development/).

기본 offline 테스트는 네트워크 장애를 강제로 주입한다. `REAL_EMULATORS_OFF=1`일 때는 장애 주입 없이 실제 연결 실패를 검사한다. 브라우저 테스트는 loopback과 공식 Firebase SDK 정적 파일 외의 요청을 기록하고 전송 전에 중단한다. 예상 밖의 요청이 있으면 테스트가 실패한다. 가상 32개 팀의 결과는 실제 앱 대진·결과 엔진과 Sync 저장 함수를 사용한다. 이미지 검증은 앱 업로드 함수와 다운로드 URL을 사용한다. 모든 결과 입력 화면을 클릭하는 테스트는 아니다.

## 변경 검토와 운영 후속 항목

운영 origin에서는 개발 CSP·저장소 접두사·모의 응답을 적용하지 않고 기존 Firebase 설정과 발송 경로를 유지한다. 실제 운영 서비스에 접속해서 회귀 검증하지는 않는다.

별도 개선 항목: `functions/api/send-push.js`와 `process-push-queue.js`의 요청자 Firebase ID token 검증 및 서버 권한 검사, 발송 제한·감사 기록, CORS 제한. 이번 작업은 운영 함수의 인증 동작을 변경하지 않는다. 네이버 운영 콜백 하드코딩도 이번에는 변경하지 않고 로컬에서 우회한다.

현재 저장소에는 오래된 `/v3/`, `main-v2.html` 실행 문서와 중복 앱·백업 파일이 있다. 개발 서버와 테스트는 루트 `index.html` → `bootstrap.js` → `assets/js/app.js`만 실행한다. 백업 파일은 수정하지 않았다.

실행 결과는 [LOCAL_VALIDATION.md](LOCAL_VALIDATION.md)에 기록한다.
