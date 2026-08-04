230MATCH GitHub 통합 배포 패키지
생성일: 2026-08-04

[주소 구조]
1. 정식판
   https://tennis230.pages.dev/
   - 저장소 루트의 index.html, assets/, data/ 사용
   - 현재 230MATCH 1.0.0 정식 운영본
   - 현재 기능 기준은 V3 Stage35.5.5와 동일

2. V3 개발판
   https://tennis230.pages.dev/v3/
   - 저장소의 v3/ 폴더 사용
   - 현재 개발 기준: Stage35.5.5
   - 이후 신규 개발과 테스트는 v3 폴더에서만 진행

[GitHub 업로드]
이 ZIP을 풀고 안의 파일과 폴더를 저장소 최상위에 그대로 업로드합니다.
중요: 바깥쪽 폴더를 한 단계 더 감싸서 올리지 마십시오.

저장소 최상위 예시:
index.html
assets/
data/
v3/
README_GITHUB_DEPLOY.txt
RELEASE_NOTES_1.0.0.txt
DEPLOY_GUIDE.txt

[운영 원칙]
- 휴대폰에서는 정식 루트 주소를 확인합니다.
- 현재 PC에서는 /v3/ 개발판을 사용합니다.
- V3에서는 이름 앞에 [TEST]를 붙인 테스트 대회만 생성합니다.
- 실제 대회는 V3에서 수정하거나 삭제하지 않습니다.
- 검증된 V3 변경만 정식판으로 승격합니다.
- 정식 업데이트 전 전체 JSON 백업을 저장합니다.

[Firebase]
- 정식판과 V3는 현재 동일 Firebase를 사용합니다.
- 테스트 대회를 구분하고 테스트 종료 후 삭제하는 방식으로 운영합니다.
- Firebase 및 로컬 저장 키 최종 정리는 앱이 거의 완성된 시점에 한 번에 진행합니다.
