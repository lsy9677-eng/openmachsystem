
(() => {
  'use strict';

  const VERSION = '1.22.0';
  const STORAGE_KEY = '230match-main-v2-approved-handoff-v1';
  const $ = (id) => document.getElementById(id);
  const text = (v) => String(v ?? '').trim();
  const asArray = (v) => Array.isArray(v) ? v : [];
  const clone = (v) => JSON.parse(JSON.stringify(v));

  let frameReady = false;
  let currentPackage = null;

  function readPackage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('V2 승인 패키지가 없습니다. V2 화면에서 운영 반영 준비 실행을 먼저 완료하세요.');
    const pkg = JSON.parse(raw);
    if (!pkg?.state?.draw) throw new Error('승인 패키지에 V2 대진 상태가 없습니다.');
    return pkg;
  }

  function allMatches(draw) {
    if (!draw?.rounds) return [];
    return Object.entries(draw.rounds)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .flatMap(([roundSize, matches]) =>
        asArray(matches).map((m) => ({ ...m, roundSize: Number(m.roundSize || roundSize) }))
      );
  }

  function teamName(value, importedTeams) {
    if (!value) return 'TBD';

    if (typeof value === 'object') {
      const rawId = value.id || value.teamId || value.key || value.uid || '';
      if (rawId) {
        const found = importedTeams.find((t) =>
          String(t.id || t.teamId || t.key || t.uid || '') === String(rawId)
        );
        if (found) return teamName(found, []);
      }

      const playerText = [value.player1, value.player2, value.p1, value.p2]
        .filter(Boolean)
        .map((p) => typeof p === 'string' ? p : (p.name || p.playerName || p.label || ''))
        .filter(Boolean)
        .join(' / ');

      return text(
        value.name ||
        value.teamName ||
        value.label ||
        value.displayName ||
        value.playersText ||
        value.nm ||
        playerText ||
        rawId ||
        '팀명 없음'
      );
    }

    const key = String(value);
    const found = importedTeams.find((t) =>
      String(t.id || t.teamId || t.key || t.uid || '') === key
    );
    if (found) return teamName(found, []);
    return key;
  }

  function validate(pkg) {
    const errors = [];
    const state = pkg.state || {};
    const matches = allMatches(state.draw);
    const byId = new Map(matches.map((m) => [m.id, m]));
    const seen = new Set();

    asArray(state.courts).forEach((court) => {
      ['playing', 'wait1'].forEach((slot) => {
        const id = court[slot];
        if (!id) return;
        if (!byId.has(id)) errors.push(`${court.name} ${slot} 경기 없음: ${id}`);
        if (seen.has(id)) errors.push(`경기 중복 배치: ${id}`);
        seen.add(id);
      });
    });

    asArray(state.sharedQueue).forEach((id) => {
      if (!byId.has(id)) errors.push(`공용대기 경기 없음: ${id}`);
      if (seen.has(id)) errors.push(`경기 중복 배치: ${id}`);
      seen.add(id);
    });

    return {
      ok: errors.length === 0,
      errors,
      summary: {
        drawSize: Number(state.draw?.size || 0),
        matches: matches.length,
        courts: asArray(state.courts).length,
        playing: matches.filter((m) => m.status === 'playing').length,
        wait1: matches.filter((m) => m.status === 'court_wait1').length,
        sharedQueue: asArray(state.sharedQueue).length
      }
    };
  }

  function getFrameDoc() {
    const frame = $('legacyFrame');
    if (!frame?.contentWindow || !frame?.contentDocument) {
      throw new Error('기존 앱 프레임이 아직 준비되지 않았습니다.');
    }
    return frame.contentDocument;
  }

  function removePreview() {
    try {
      const doc = getFrameDoc();
      doc.getElementById('v2LegacyLivePreviewRoot')?.remove();
      doc.getElementById('v2LegacyLivePreviewStyle')?.remove();
    } catch (_) {}
    $('previewState').textContent = 'V2 미리보기 OFF';
    $('previewState').className = 'state off';
  }

  function ensureStyles(doc) {
    if (doc.getElementById('v2LegacyLivePreviewStyle')) return;
    const style = doc.createElement('style');
    style.id = 'v2LegacyLivePreviewStyle';
    style.textContent = `
      #v2LegacyLivePreviewRoot{
        position:fixed;inset:84px 18px 18px 18px;z-index:2147483000;
        overflow:auto;background:#edf3fb;border:2px solid #2b67e8;border-radius:18px;
        box-shadow:0 18px 60px rgba(9,33,80,.28);padding:18px;color:#13213c;
        font-family:Arial,"Noto Sans KR",sans-serif;
      }
      #v2LegacyLivePreviewRoot *{box-sizing:border-box}
      #v2LegacyLivePreviewRoot .v2lp-head{
        position:sticky;top:-18px;z-index:2;margin:-18px -18px 16px;padding:14px 18px;
        background:#11264a;color:#fff;display:flex;gap:12px;align-items:center;justify-content:space-between
      }
      #v2LegacyLivePreviewRoot .v2lp-head button{
        border:0;border-radius:10px;padding:9px 14px;font-weight:800;cursor:pointer
      }
      #v2LegacyLivePreviewRoot .v2lp-note{
        background:#fff7d9;border:1px solid #e9b73d;border-radius:10px;padding:10px 12px;margin-bottom:14px
      }
      #v2LegacyLivePreviewRoot .v2lp-grid{
        display:grid;grid-template-columns:repeat(4,minmax(250px,1fr));gap:12px
      }
      #v2LegacyLivePreviewRoot .v2lp-court{
        border:2px solid #2e69e8;border-radius:14px;overflow:hidden;background:#f7faff
      }
      #v2LegacyLivePreviewRoot .v2lp-court header{
        background:#2e69e8;color:#fff;padding:11px 12px;display:flex;justify-content:space-between
      }
      #v2LegacyLivePreviewRoot .v2lp-slot{padding:12px;display:grid;gap:5px;min-height:105px}
      #v2LegacyLivePreviewRoot .v2lp-slot+.v2lp-slot{border-top:1px solid #d6e0f2;background:#fffaf1}
      #v2LegacyLivePreviewRoot .v2lp-slot small{color:#6b7890}
      #v2LegacyLivePreviewRoot .v2lp-slot b{line-height:1.4}
      #v2LegacyLivePreviewRoot .v2lp-slot em{font-style:normal;color:#6b7890;font-size:12px}
      #v2LegacyLivePreviewRoot .v2lp-queue{
        margin-top:18px;background:#fff;border-radius:14px;border:1px solid #c7d6ef;padding:14px
      }
      #v2LegacyLivePreviewRoot .v2lp-queue-grid{
        display:grid;grid-template-columns:repeat(4,minmax(220px,1fr));gap:9px
      }
      #v2LegacyLivePreviewRoot .v2lp-q{
        display:grid;grid-template-columns:28px 1fr;gap:4px 8px;padding:10px;border:1px solid #d1ddef;border-radius:10px;background:#f8fbff
      }
      #v2LegacyLivePreviewRoot .v2lp-q span{
        grid-row:1/3;width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#11264a;color:#fff;font-weight:800
      }
      #v2LegacyLivePreviewRoot .v2lp-q em{font-style:normal;color:#6b7890;font-size:12px}
      @media(max-width:1100px){
        #v2LegacyLivePreviewRoot .v2lp-grid,
        #v2LegacyLivePreviewRoot .v2lp-queue-grid{grid-template-columns:repeat(2,1fr)}
      }
      @media(max-width:650px){
        #v2LegacyLivePreviewRoot{inset:70px 6px 6px}
        #v2LegacyLivePreviewRoot .v2lp-grid,
        #v2LegacyLivePreviewRoot .v2lp-queue-grid{grid-template-columns:1fr}
      }
    `;
    doc.head.appendChild(style);
  }

  function renderPreview() {
    const pkg = currentPackage || readPackage();
    const report = validate(pkg);
    if (!report.ok) {
      throw new Error(`V2 패키지 검증 실패: ${report.errors.join(' / ')}`);
    }

    const doc = getFrameDoc();
    ensureStyles(doc);
    doc.getElementById('v2LegacyLivePreviewRoot')?.remove();

    const state = clone(pkg.state);
    const importedTeams = asArray(state.importedTeams);
    const matches = allMatches(state.draw);
    const byId = new Map(matches.map((m) => [m.id, m]));

    const root = doc.createElement('section');
    root.id = 'v2LegacyLivePreviewRoot';

    const courtHtml = asArray(state.courts).map((court) => {
      const playing = court.playing ? byId.get(court.playing) : null;
      const wait1 = court.wait1 ? byId.get(court.wait1) : null;
      const playingName = playing
        ? `${teamName(playing.teamA, importedTeams)} vs ${teamName(playing.teamB, importedTeams)}`
        : '없음';
      const wait1Name = wait1
        ? `${teamName(wait1.teamA, importedTeams)} vs ${teamName(wait1.teamB, importedTeams)}`
        : '없음';

      return `
        <article class="v2lp-court">
          <header><strong>🚀 ${court.name}</strong><span>${playing ? '시합중' : '빈코트'}</span></header>
          <div class="v2lp-slot">
            <small>시합중</small>
            <b>${playingName}</b>
            <em>${playing ? `${playing.roundSize}강 · ${playing.id}` : '-'}</em>
          </div>
          <div class="v2lp-slot">
            <small>대기 1번</small>
            <b>${wait1Name}</b>
            <em>${wait1 ? `${wait1.roundSize}강 · ${wait1.id}` : '-'}</em>
          </div>
        </article>`;
    }).join('');

    const queueHtml = asArray(state.sharedQueue).map((id, index) => {
      const m = byId.get(id);
      const name = m
        ? `${teamName(m.teamA, importedTeams)} vs ${teamName(m.teamB, importedTeams)}`
        : id;
      return `
        <div class="v2lp-q">
          <span>${index + 1}</span>
          <b>${name}</b>
          <em>${m ? `${m.roundSize}강 · ${id}` : '경기 없음'}</em>
        </div>`;
    }).join('');

    root.innerHTML = `
      <div class="v2lp-head">
        <div>
          <strong>V2 본선 상태 — 기존 앱 내부 읽기 전용 미리보기</strong>
          <div>${pkg.target?.tournamentName || '-'} · ${pkg.target?.division || '-'} · ${state.draw?.size || 0}강</div>
        </div>
        <button type="button" id="v2lpCloseBtn">미리보기 닫기</button>
      </div>
      <div class="v2lp-note">
        실제 운영 데이터와 버튼은 변경되지 않습니다. V2 상태를 기존 앱 화면 안에서 표시만 합니다.
        경기 ${report.summary.matches} · 코트 ${report.summary.courts} · 시합중 ${report.summary.playing} · 대기1 ${report.summary.wait1} · 공용대기 ${report.summary.sharedQueue}
      </div>
      <div class="v2lp-grid">${courtHtml}</div>
      <section class="v2lp-queue">
        <h3>공용대기 ${state.sharedQueue?.length || 0}경기</h3>
        <div class="v2lp-queue-grid">${queueHtml}</div>
      </section>`;

    doc.body.appendChild(root);
    root.querySelector('#v2lpCloseBtn').addEventListener('click', removePreview);

    $('previewState').textContent = 'V2 미리보기 ON';
    $('previewState').className = 'state on';
    $('summary').textContent =
      `검증 통과 · ${state.draw?.size || 0}강 · 경기 ${report.summary.matches} · 코트 ${report.summary.courts} · 기존 앱 쓰기 없음`;
  }

  function boot() {
    const frame = $('legacyFrame');

    frame.addEventListener('load', () => {
      frameReady = true;
      $('frameState').textContent = '기존 앱 로드 완료';
      $('frameState').className = 'state on';
    });

    $('loadPackageBtn').addEventListener('click', () => {
      try {
        currentPackage = readPackage();
        const report = validate(currentPackage);
        $('packageState').textContent = report.ok ? 'V2 패키지 정상' : 'V2 패키지 오류';
        $('packageState').className = report.ok ? 'state on' : 'state error';
        $('summary').textContent = report.ok
          ? `${currentPackage.target?.tournamentName || '-'} · ${currentPackage.target?.division || '-'} · ${report.summary.drawSize}강 · 경기 ${report.summary.matches}`
          : report.errors.join(' / ');
      } catch (e) {
        $('packageState').textContent = '패키지 없음';
        $('packageState').className = 'state error';
        alert(e.message);
      }
    });

    $('previewBtn').addEventListener('click', () => {
      try {
        if (!frameReady) throw new Error('기존 앱 화면이 아직 준비되지 않았습니다.');
        renderPreview();
      } catch (e) {
        alert(e.message);
      }
    });

    $('removeBtn').addEventListener('click', removePreview);
    $('reloadBtn').addEventListener('click', () => frame.contentWindow.location.reload());

    try {
      currentPackage = readPackage();
      const report = validate(currentPackage);
      $('packageState').textContent = report.ok ? 'V2 패키지 정상' : 'V2 패키지 오류';
      $('packageState').className = report.ok ? 'state on' : 'state error';
    } catch (_) {}

    console.log(`[V2-LEGACY-LIVE-PREVIEW] v${VERSION} ready · iframe bridge · read-only`);
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot, { once: true })
    : boot();
})();
