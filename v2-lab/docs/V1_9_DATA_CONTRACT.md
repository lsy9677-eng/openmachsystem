# 읽기 전용 데이터 계약

기존 앱에서 참조:
- window.G.tournaments
- window.G.draws[key].groups
- window.G.teams[key]
- window.G.matches[key]
- getMatchResultState(key, match)
- calcGS(key, groupIndex, groupTeams, teams)
- gDS(tournament, division)
- tdn(team, key, index)

V2로 변환되는 진출팀:
- name
- affiliation
- groupNo
- groupRank
- venue
- teamIndex
- sourceKey

쓰기 작업:
- 없음
