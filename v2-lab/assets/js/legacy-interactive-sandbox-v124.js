
(() => {
  'use strict';

  const VERSION = '1.24.0';
  const STORAGE_KEY = '230match-main-v2-approved-handoff-v1';
  const SESSION_KEY = '230match-v2-integration-sandbox-v124';
  const $ = (id) => document.getElementById(id);
  const text = (v) => String(v ?? '').trim();
  const arr = (v) => Array.isArray(v) ? v : [];
  const clone = (v) => JSON.parse(JSON.stringify(v));

  let frameReady = false;
  let approvedPackage = null;
  let sandbox = null;
  let originalSnapshot = null;

  function readApprovedPackage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('V2 승인 패키지가 없습니다.');
    const pkg = JSON.parse(raw);
    if (!pkg?.state?.draw) throw new Error('승인 패키지에 V2 대진 상태가 없습니다.');
    return pkg;
  }

  function allMatches(draw) {
    if (!draw?.rounds) return [];
    return Object.entries(draw.rounds)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .flatMap(([roundSize, matches]) =>
        arr(matches).map((m) => ({ ...m, roundSize: Number(m.roundSize || roundSize) }))
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
        if (found && found !== value) return teamName(found, []);
      }
      const players = [value.player1, value.player2, value.p1, value.p2]
        .filter(Boolean)
        .map((p) => typeof p === 'string' ? p : (p.name || p.playerName || p.label || ''))
        .filter(Boolean)
        .join(' / ');
      return text(
        value.name || value.teamName || value.label || value.displayName ||
        value.playersText || value.nm || players || rawId || '팀명 없음'
      );
    }
    const key = String(value);
    const found = importedTeams.find((t) =>
      String(t.id || t.teamId || t.key || t.uid || '') === key
    );
    return found ? teamName(found, []) : key;
  }

  function frameDoc() {
    const frame = $('legacyFrame');
    if (!frame?.contentDocument) throw new Error('기존 앱 프레임이 준비되지 않았습니다.');
    return frame.contentDocument;
  }

  function findByText(doc, phrase) {
    const nodes = [...doc.querySelectorAll('section,article,div,main')];
    const matches = nodes.filter((el) => text(el.innerText || el.textContent).includes(phrase));
    matches.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
    return matches[0] || null;
  }

  function locateCourtSection(doc) {
    return doc.querySelector('[data-v2-court-board-target]') || findByText(doc, '코트 사용 현황판');
  }

  function validate(pkg) {
    const state = pkg?.state || {};
    const matches = allMatches(state.draw);
    const ids = new Set(matches.map((m) => m.id));
    const errors = [];
    const seen = new Set();

    arr(state.courts).forEach((court) => {
      ['playing', 'wait1'].forEach((slot) => {
        const id = court?.[slot];
        if (!id) return;
        if (!ids.has(id)) errors.push(`${court.name} ${slot}: 없는 경기 ${id}`);
        if (seen.has(id)) errors.push(`중복 배치 ${id}`);
        seen.add(id);
      });
    });
    arr(state.sharedQueue).forEach((id) => {
      if (!ids.has(id)) errors.push(`공용대기: 없는 경기 ${id}`);
      if (seen.has(id)) errors.push(`중복 배치 ${id}`);
      seen.add(id);
    });

    return { ok: errors.length === 0, errors };
  }

  function saveSession() {
    if (!sandbox) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(sandbox));
  }

  function loadSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function resetSandbox() {
    approvedPackage = readApprovedPackage();
    const report = validate(approvedPackage);
    if (!report.ok) throw new Error(report.errors.join(' / '));
    sandbox = {
      version: VERSION,
      createdAt: new Date().toISOString(),
      sourceChecksum: approvedPackage.stateChecksum || '',
      target: clone(approvedPackage.target || {}),
      state: clone(approvedPackage.state),
      undoStack: []
    };
    saveSession();
  }

  function getMatches() {
    return allMatches(sandbox.state.draw);
  }

  function matchIndex() {
    return new Map(getMatches().map((m) => [m.id, m]));
  }

  function importedTeams() {
    return arr(sandbox.state.importedTeams);
  }

  function pushUndo(label) {
    sandbox.undoStack = arr(sandbox.undoStack);
    sandbox.undoStack.push({
      label,
      at: new Date().toISOString(),
      state: clone(sandbox.state)
    });
    if (sandbox.undoStack.length > 20) sandbox.undoStack.shift();
  }

  function findMatchMutable(id) {
    for (const matches of Object.values(sandbox.state.draw.rounds || {})) {
      const found = arr(matches).find((m) => m.id === id);
      if (found) return found;
    }
    return null;
  }

  function removeFromQueues(id) {
    arr(sandbox.state.courts).forEach((court) => {
      if (court.playing === id) court.playing = null;
      if (court.wait1 === id) court.wait1 = null;
    });
    sandbox.state.sharedQueue = arr(sandbox.state.sharedQueue).filter((x) => x !== id);
  }

  function feedWinnerToNext(match) {
    if (!match.nextMatchId || !match.winnerId) return;
    const next = findMatchMutable(match.nextMatchId);
    if (!next) return;
    if (Number(match.nextSlot) === 2) next.teamB = clone(match.winnerId);
    else next.teamA = clone(match.winnerId);
    if (next.teamA && next.teamB && next.status !== 'completed') {
      next.status = 'ready';
    }
  }

  function refillCourt(court) {
    if (!court) return;
    if (!court.playing && court.wait1) {
      court.playing = court.wait1;
      court.wait1 = null;
      const promoted = findMatchMutable(court.playing);
      if (promoted) {
        promoted.status = 'playing';
        promoted.court = court.name || court.id;
        promoted.startedAt = new Date().toISOString();
      }
    }
    if (!court.wait1 && sandbox.state.sharedQueue?.length) {
      const nextId = sandbox.state.sharedQueue.shift();
      court.wait1 = nextId;
      const waiting = findMatchMutable(nextId);
      if (waiting) {
        waiting.status = 'court_wait1';
        waiting.court = court.name || court.id;
      }
    }
  }

  function completeMatch(id) {
    const match = findMatchMutable(id);
    if (!match) throw new Error(`경기를 찾지 못했습니다: ${id}`);
    if (!match.teamA || !match.teamB) throw new Error('양 팀이 확정되지 않은 경기입니다.');

    const teams = importedTeams();
    const aName = teamName(match.teamA, teams);
    const bName = teamName(match.teamB, teams);
    const winnerChoice = prompt(
      `승자를 선택하세요.\n1 = ${aName}\n2 = ${bName}\n\n숫자 1 또는 2 입력`,
      '1'
    );
    if (winnerChoice !== '1' && winnerChoice !== '2') return;

    const score = prompt('스코어를 입력하세요. 예: 6:3', '6:3');
    if (score === null) return;
    const parts = score.split(/[:\-]/).map((v) => Number(v.trim()));
    if (parts.length !== 2 || parts.some((v) => !Number.isFinite(v))) {
      throw new Error('스코어 형식이 올바르지 않습니다.');
    }

    pushUndo(`결과 입력 ${id}`);

    match.scoreA = parts[0];
    match.scoreB = parts[1];
    match.winnerId = clone(winnerChoice === '1' ? match.teamA : match.teamB);
    match.status = 'completed';
    match.completedAt = new Date().toISOString();

    const court = arr(sandbox.state.courts).find((c) => c.playing === id);
    removeFromQueues(id);
    feedWinnerToNext(match);
    refillCourt(court);
    saveSession();
    renderInPlace();
  }

  function undo() {
    const item = sandbox?.undoStack?.pop();
    if (!item) {
      alert('되돌릴 작업이 없습니다.');
      return;
    }
    sandbox.state = item.state;
    saveSession();
    renderInPlace();
  }

  function ensureStyles(doc) {
    if (doc.getElementById('v2InteractiveSandboxStyle')) return;
    const style = doc.createElement('style');
    style.id = 'v2InteractiveSandboxStyle';
    style.textContent = `
      .v2is-banner{margin:10px 0 12px;padding:10px 12px;border:1px solid #e3af30;border-radius:10px;background:#fff6d7}
      .v2is-controls{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
      .v2is-controls button,.v2is-card button{border:1px solid #13294e;border-radius:8px;padding:8px 11px;font-weight:800;cursor:pointer}
      .v2is-controls button{background:#fff}.v2is-controls .primary{background:#17315c;color:#fff}
      .v2is-grid{display:grid;grid-template-columns:repeat(4,minmax(230px,1fr));gap:12px}
      .v2is-card{border:2px solid #2f69e9;border-radius:14px;overflow:hidden;background:#f7faff}
      .v2is-card header{background:#2f69e9;color:#fff;padding:11px 12px;display:flex;justify-content:space-between}
      .v2is-slot{padding:11px;display:grid;gap:5px;min-height:132px}
      .v2is-slot+.v2is-slot{border-top:1px solid #d6e0f2;background:#fffaf1}
      .v2is-slot small{color:#687790}.v2is-slot b{line-height:1.38}.v2is-slot em{font-style:normal;color:#687790;font-size:12px}
      .v2is-slot button{margin-top:auto;background:#e4aa00;color:#17213a}
      .v2is-slot button:disabled{opacity:.45;cursor:not-allowed}
      .v2is-queue{margin-top:16px}.v2is-qgrid{display:grid;grid-template-columns:repeat(4,minmax(210px,1fr));gap:9px}
      .v2is-q{display:grid;grid-template-columns:28px 1fr;gap:4px 8px;padding:10px;border:1px solid #cbd9ee;border-radius:10px;background:#f8fbff}
      .v2is-q span{grid-row:1/3;width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#11264a;color:#fff;font-weight:800}
      .v2is-q em{font-style:normal;color:#6a7890;font-size:12px}
      @media(max-width:1100px){.v2is-grid,.v2is-qgrid{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:650px){.v2is-grid,.v2is-qgrid{grid-template-columns:1fr}}
    `;
    doc.head.appendChild(style);
  }

  function renderInPlace() {
    if (!sandbox) throw new Error('샌드박스 상태가 없습니다.');
    const doc = frameDoc();
    const target = locateCourtSection(doc);
    if (!target) throw new Error('기존 앱의 코트 사용 현황판을 찾지 못했습니다.');

    ensureStyles(doc);
    if (!originalSnapshot) originalSnapshot = { target, html: target.innerHTML };

    const matches = getMatches();
    const byId = new Map(matches.map((m) => [m.id, m]));
    const teams = importedTeams();

    const courtHtml = arr(sandbox.state.courts).map((court) => {
      const playing = court.playing ? byId.get(court.playing) : null;
      const wait1 = court.wait1 ? byId.get(court.wait1) : null;
      const pName = playing ? `${teamName(playing.teamA, teams)} vs ${teamName(playing.teamB, teams)}` : '진행 경기 없음';
      const wName = wait1 ? `${teamName(wait1.teamA, teams)} vs ${teamName(wait1.teamB, teams)}` : '대기 경기 없음';
      return `
        <article class="v2is-card">
          <header><strong>🚀 ${court.name}</strong><span>${playing ? '시합중' : '빈코트'}</span></header>
          <div class="v2is-slot">
            <small>시합중</small><b>${pName}</b>
            <em>${playing ? `${playing.roundSize}강 · ${playing.id}` : '-'}</em>
            <button data-result-id="${playing?.id || ''}" ${playing ? '' : 'disabled'}>V2 결과 입력</button>
          </div>
          <div class="v2is-slot">
            <small>대기 1번</small><b>${wName}</b>
            <em>${wait1 ? `${wait1.roundSize}강 · ${wait1.id}` : '-'}</em>
          </div>
        </article>`;
    }).join('');

    const queueHtml = arr(sandbox.state.sharedQueue).map((id, index) => {
      const m = byId.get(id);
      const name = m ? `${teamName(m.teamA, teams)} vs ${teamName(m.teamB, teams)}` : id;
      return `<div class="v2is-q"><span>${index + 1}</span><b>${name}</b><em>${m ? `${m.roundSize}강 · ${id}` : '-'}</em></div>`;
    }).join('');

    target.innerHTML = `
      <div id="v2InteractiveSandboxRoot">
        <div class="v2is-banner">
          <strong>V2 상호작용 샌드박스</strong> — 결과 입력과 큐 승계는 브라우저 복제 상태에서만 실행됩니다.
          기존 Firebase·window.G·실제 경기 데이터에는 쓰지 않습니다.
        </div>
        <div class="v2is-controls">
          <button class="primary" id="v2isUndo">최근 결과 되돌리기</button>
          <button id="v2isSaveJson">샌드박스 JSON 저장</button>
          <button id="v2isReset">승인 패키지 상태로 초기화</button>
          <button id="v2isRestore">기존 화면 복구</button>
        </div>
        <div class="v2is-grid">${courtHtml}</div>
        <section class="v2is-queue">
          <h3>공용대기 ${sandbox.state.sharedQueue?.length || 0}경기</h3>
          <div class="v2is-qgrid">${queueHtml}</div>
        </section>
      </div>`;

    target.querySelectorAll('[data-result-id]').forEach((button) => {
      button.addEventListener('click', () => {
        try { completeMatch(button.dataset.resultId); }
        catch (e) { alert(e.message); }
      });
    });
    target.querySelector('#v2isUndo')?.addEventListener('click', undo);
    target.querySelector('#v2isReset')?.addEventListener('click', () => {
      if (!confirm('샌드박스를 V2 승인 패키지 상태로 초기화할까요?')) return;
      resetSandbox();
      renderInPlace();
    });
    target.querySelector('#v2isRestore')?.addEventListener('click', restoreOriginal);
    target.querySelector('#v2isSaveJson')?.addEventListener('click', downloadSandbox);

    $('integrationState').textContent = 'V2 샌드박스 ON';
    $('integrationState').className = 'state on';
    $('summary').textContent =
      `로컬 상호작용 · 완료 ${matches.filter((m)=>m.status==='completed').length}/${matches.length} · 기존 앱 쓰기 없음`;
  }

  function restoreOriginal() {
    if (originalSnapshot?.target?.isConnected) {
      originalSnapshot.target.innerHTML = originalSnapshot.html;
    }
    originalSnapshot = null;
    $('integrationState').textContent = 'V2 샌드박스 OFF';
    $('integrationState').className = 'state off';
    $('summary').textContent = '기존 화면으로 복구했습니다.';
  }

  function downloadSandbox() {
    const blob = new Blob([JSON.stringify(sandbox, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `230match-v2-sandbox-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function boot() {
    const frame = $('legacyFrame');
    frame.addEventListener('load', () => {
      frameReady = true;
      originalSnapshot = null;
      $('frameState').textContent = '기존 앱 로드 완료';
      $('frameState').className = 'state on';
    });

    $('readPackageBtn').addEventListener('click', () => {
      try {
        approvedPackage = readApprovedPackage();
        const report = validate(approvedPackage);
        $('packageState').textContent = report.ok ? 'V2 패키지 정상' : 'V2 패키지 오류';
        $('packageState').className = report.ok ? 'state on' : 'state error';
      } catch (e) {
        $('packageState').textContent = '패키지 없음';
        $('packageState').className = 'state error';
        alert(e.message);
      }
    });

    $('startBtn').addEventListener('click', () => {
      try {
        if (!frameReady) throw new Error('기존 앱이 아직 로드되지 않았습니다.');
        approvedPackage = readApprovedPackage();
        const saved = loadSession();
        sandbox = saved && saved.sourceChecksum === (approvedPackage.stateChecksum || '') ? saved : null;
        if (!sandbox) resetSandbox();
        renderInPlace();
      } catch (e) { alert(e.message); }
    });

    $('restoreBtn').addEventListener('click', restoreOriginal);
    $('reloadBtn').addEventListener('click', () => {
      restoreOriginal();
      frame.contentWindow.location.reload();
    });

    try {
      approvedPackage = readApprovedPackage();
      const report = validate(approvedPackage);
      $('packageState').textContent = report.ok ? 'V2 패키지 정상' : 'V2 패키지 오류';
      $('packageState').className = report.ok ? 'state on' : 'state error';
    } catch (_) {}

    console.log(`[V2-INTERACTIVE-SANDBOX] v${VERSION} ready · local clone only · no Firebase writes`);
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot, { once: true })
    : boot();
})();
