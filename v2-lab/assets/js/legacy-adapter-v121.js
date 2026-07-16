
(() => {
  'use strict';

  const VERSION = '1.21.2';

  const $ = (id) => document.getElementById(id);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const asArray = (v) => Array.isArray(v) ? v : [];
  const text = (v) => String(v ?? '').trim();

  function allMatches(draw) {
    if (!draw || !draw.rounds) return [];
    return Object.entries(draw.rounds)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .flatMap(([roundSize, matches]) =>
        asArray(matches).map((m) => ({ ...m, roundSize: Number(m.roundSize || roundSize) }))
      );
  }

  function teamMap(state) {
    const map = new Map();
    asArray(state.importedTeams).forEach((team, index) => {
      const id = text(team.id || team.teamId || `team_${index + 1}`);
      const nestedPlayers = [
        team.player1,
        team.player2,
        team.p1,
        team.p2
      ].filter(Boolean).map((p) => typeof p === 'string' ? p : (p.name || p.playerName || p.label || '')).filter(Boolean);

      map.set(id, {
        id,
        name: text(
          team.name ||
          team.teamName ||
          team.label ||
          team.displayName ||
          team.playersText ||
          team.nm ||
          nestedPlayers.join(' / ') ||
          `팀 ${index + 1}`
        ),
        affiliation: text(team.affiliation || team.club || team.org || team.teamClub || ''),
        seed: Number(team.seed || 0),
        groupNo: Number(team.groupNo || 0),
        groupRank: Number(team.groupRank || 0)
      });
    });
    return map;
  }

  function teamSummary(value, teams) {
    if (!value) return null;

    if (typeof value === 'object') {
      const rawId = value.id || value.teamId || value.key || value.uid || '';
      const mapped = rawId ? teams.get(String(rawId)) : null;
      if (mapped) return mapped;

      const players = [
        value.player1,
        value.player2,
        value.p1,
        value.p2
      ].filter(Boolean);

      const playerText = players.map((p) => {
        if (typeof p === 'string') return p;
        return p.name || p.playerName || p.label || '';
      }).filter(Boolean).join(' / ');

      const name =
        value.name ||
        value.teamName ||
        value.label ||
        value.displayName ||
        value.playersText ||
        value.nm ||
        playerText ||
        (rawId ? String(rawId) : '팀명 없음');

      return {
        id: rawId ? String(rawId) : '',
        name: String(name),
        affiliation: String(value.affiliation || value.club || value.org || value.teamClub || '')
      };
    }

    const key = String(value);
    return teams.get(key) || { id: key, name: key, affiliation: '' };
  }

  function validatePackage(pkg) {
    const errors = [];
    const warnings = [];

    if (!pkg || typeof pkg !== 'object') errors.push('패키지 객체 없음');
    if (!pkg?.state?.draw) errors.push('V2 대진 상태 없음');
    if (!pkg?.target?.division) errors.push('대상 부서 없음');
    if (pkg?.directWriteEnabled === true) errors.push('직접 쓰기 활성 패키지는 허용하지 않음');

    const state = pkg?.state || {};
    const matches = allMatches(state.draw);
    const matchIds = new Set(matches.map((m) => m.id));
    const expected = Math.max(0, Number(state.draw?.size || 0) - 1);

    if (expected && matches.length !== expected) {
      errors.push(`전체 경기 수 불일치: ${matches.length}/${expected}`);
    }

    const seenQueue = new Set();
    const courtIds = new Set();

    asArray(state.courts).forEach((court) => {
      const name = text(court.name || court.id);
      if (!name) errors.push('코트 이름 없음');
      if (courtIds.has(name)) errors.push(`중복 코트: ${name}`);
      courtIds.add(name);

      ['playing', 'wait1'].forEach((slot) => {
        const id = court[slot];
        if (!id) return;
        if (!matchIds.has(id)) errors.push(`${name} ${slot} 경기 ID 없음: ${id}`);
        if (seenQueue.has(id)) errors.push(`경기 중복 배치: ${id}`);
        seenQueue.add(id);
      });
    });

    asArray(state.sharedQueue).forEach((id) => {
      if (!matchIds.has(id)) errors.push(`공용대기 경기 ID 없음: ${id}`);
      if (seenQueue.has(id)) errors.push(`경기 중복 배치: ${id}`);
      seenQueue.add(id);
    });

    matches.forEach((match) => {
      if (match.nextMatchId && !matchIds.has(match.nextMatchId)) {
        errors.push(`다음 경기 참조 오류: ${match.id} → ${match.nextMatchId}`);
      }
      if (match.status === 'completed' && !match.winnerId) {
        errors.push(`완료 경기 승자 없음: ${match.id}`);
      }
      if (match.status === 'playing' && !match.court) {
        warnings.push(`시합중 경기 코트 없음: ${match.id}`);
      }
    });

    return {
      ok: errors.length === 0,
      errors: [...new Set(errors)],
      warnings: [...new Set(warnings)],
      summary: {
        drawSize: Number(state.draw?.size || 0),
        matches: matches.length,
        courts: asArray(state.courts).length,
        sharedQueue: asArray(state.sharedQueue).length,
        completed: matches.filter((m) => m.status === 'completed').length,
        playing: matches.filter((m) => m.status === 'playing').length,
        courtWait1: matches.filter((m) => m.status === 'court_wait1').length,
        waitingSlots: matches.filter((m) => m.status === 'waiting_slots').length
      }
    };
  }

  function buildLegacyModel(pkg) {
    const state = clone(pkg.state);
    const teams = teamMap(state);
    const matches = allMatches(state.draw);
    const byId = new Map(matches.map((m) => [m.id, m]));

    const legacyMatches = matches.map((m) => ({
      id: m.id,
      phase: 'main',
      roundSize: Number(m.roundSize || 0),
      matchNo: Number(m.matchNo || 0),
      t1: teamSummary(m.teamA, teams),
      t2: teamSummary(m.teamB, teams),
      scoreA: m.scoreA == null ? null : Number(m.scoreA),
      scoreB: m.scoreB == null ? null : Number(m.scoreB),
      winner: teamSummary(m.winnerId, teams),
      status: m.status,
      court: text(m.court),
      venue: text(m.venue),
      nextMatchId: text(m.nextMatchId),
      nextSlot: m.nextSlot || null,
      startedAt: m.startedAt || null,
      completedAt: m.completedAt || null,
      bye: Boolean(m.bye)
    }));

    const courts = asArray(state.courts).map((court) => ({
      id: court.id,
      name: court.name,
      venue: court.venue,
      playing: court.playing ? byId.get(court.playing)?.id || court.playing : null,
      wait1: court.wait1 ? byId.get(court.wait1)?.id || court.wait1 : null
    }));

    return {
      schemaVersion: '230match-v2-legacy-adapter-v1',
      generatedAt: new Date().toISOString(),
      sourcePackageVersion: pkg.packageVersion,
      readOnly: true,
      directWriteEnabled: false,
      target: clone(pkg.target),
      checksum: pkg.stateChecksum || '',
      draw: {
        size: Number(state.draw?.size || 0),
        locked: Boolean(state.drawLocked),
        matchCount: legacyMatches.length
      },
      matches: legacyMatches,
      courts,
      sharedQueue: asArray(state.sharedQueue),
      autoAssign: Boolean(state.autoAssign),
      settings: clone(state.settings || {})
    };
  }

  function matchName(match, teams) {
    const a = teamSummary(match.teamA, teams)?.name || 'TBD';
    const b = teamSummary(match.teamB, teams)?.name || 'TBD';
    return `${a} vs ${b}`;
  }

  function render(pkg) {
    const validation = validatePackage(pkg);
    const state = pkg.state || {};
    const teams = teamMap(state);
    const matches = allMatches(state.draw);
    const byId = new Map(matches.map((m) => [m.id, m]));

    $('statusBadge').textContent = validation.ok ? '변환 가능' : '검사 실패';
    $('statusBadge').className = validation.ok ? 'badge ok' : 'badge error';
    $('targetText').textContent =
      `${pkg.target?.tournamentName || '-'} · ${pkg.target?.division || '-'} · ${state.draw?.size || 0}강`;
    $('summaryText').textContent =
      `경기 ${validation.summary.matches} · 코트 ${validation.summary.courts} · 시합중 ${validation.summary.playing} · 대기1 ${validation.summary.courtWait1} · 공용대기 ${validation.summary.sharedQueue}`;

    const errorBox = $('validationBox');
    errorBox.innerHTML = '';
    if (validation.errors.length) {
      validation.errors.forEach((e) => {
        const p = document.createElement('div');
        p.className = 'validation-error';
        p.textContent = e;
        errorBox.appendChild(p);
      });
    } else {
      const p = document.createElement('div');
      p.className = 'validation-ok';
      p.textContent = `검증 통과 · 경고 ${validation.warnings.length}건 · 기존 앱 쓰기 없음`;
      errorBox.appendChild(p);
    }

    const courtGrid = $('courtGrid');
    courtGrid.innerHTML = '';
    asArray(state.courts).forEach((court) => {
      const playing = court.playing ? byId.get(court.playing) : null;
      const wait1 = court.wait1 ? byId.get(court.wait1) : null;
      const card = document.createElement('section');
      card.className = 'court-card';
      card.innerHTML = `
        <header><strong>🚀 ${court.name}</strong><span>${playing ? '시합중' : '빈코트'}</span></header>
        <div class="slot playing">
          <small>시합중</small>
          <b>${playing ? matchName(playing, teams) : '없음'}</b>
          <em>${playing ? `${playing.roundSize}강 · ${playing.id}` : '-'}</em>
        </div>
        <div class="slot wait1">
          <small>대기 1번</small>
          <b>${wait1 ? matchName(wait1, teams) : '없음'}</b>
          <em>${wait1 ? `${wait1.roundSize}강 · ${wait1.id}` : '-'}</em>
        </div>`;
      courtGrid.appendChild(card);
    });

    const queue = $('sharedQueue');
    queue.innerHTML = '';
    asArray(state.sharedQueue).forEach((id, index) => {
      const match = byId.get(id);
      const div = document.createElement('div');
      div.className = 'queue-item';
      div.innerHTML = `<span>${index + 1}</span><b>${match ? matchName(match, teams) : id}</b><em>${match ? `${match.roundSize}강 · ${id}` : '경기 없음'}</em>`;
      queue.appendChild(div);
    });

    window.__V2_LEGACY_ADAPTER_PACKAGE__ = pkg;
    window.__V2_LEGACY_ADAPTER_MODEL__ = buildLegacyModel(pkg);
    window.__V2_LEGACY_ADAPTER_VALIDATION__ = validation;
    $('downloadBtn').disabled = !validation.ok;
  }

  function readStoredPackage() {
    const raw = localStorage.getItem('230match-main-v2-approved-handoff-v1');
    if (!raw) throw new Error('저장된 V2 승인 패키지가 없습니다.');
    return JSON.parse(raw);
  }

  async function readFile(file) {
    const raw = await file.text();
    return JSON.parse(raw);
  }

  function downloadModel() {
    const model = window.__V2_LEGACY_ADAPTER_MODEL__;
    if (!model) return;
    const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `230match-legacy-adapter-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function boot() {
    $('loadStoredBtn').addEventListener('click', () => {
      try {
        render(readStoredPackage());
      } catch (e) {
        alert(e.message);
      }
    });

    $('fileInput').addEventListener('change', async (event) => {
      try {
        const file = event.target.files?.[0];
        if (!file) return;
        render(await readFile(file));
      } catch (e) {
        alert(`JSON 읽기 실패: ${e.message}`);
      }
    });

    $('downloadBtn').addEventListener('click', downloadModel);

    try {
      render(readStoredPackage());
    } catch {
      $('statusBadge').textContent = '패키지 대기';
      $('targetText').textContent = 'V2에서 운영 반영 준비 패키지를 만들거나 JSON 파일을 선택하세요.';
    }

    console.log(`[V2-LEGACY-ADAPTER] v${VERSION} ready · read-only · no legacy writes`);
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot, { once: true })
    : boot();
})();
