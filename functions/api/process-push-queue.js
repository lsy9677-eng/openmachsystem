import { CORS_HEADERS, jsonResponse, getGoogleAccessToken, listCollection, patchDocument, sendFcm, phoneIntersects, intersects, normalizeText } from '../_lib/common.js';

function isTargetToken(tokenDoc, job) {
  if (!tokenDoc || tokenDoc.enabled === false || !tokenDoc.token) return false;
  const targetUids = job.targetUids || [];
  const targetPhones = job.targetPhones || [];
  const targetClubs = job.targetClubs || [];

  if (targetUids.length && targetUids.map(String).includes(String(tokenDoc.uid || ''))) return true;
  if (targetPhones.length && phoneIntersects(targetPhones, [tokenDoc.phoneDigits, tokenDoc.phone])) return true;
  if (targetClubs.length && intersects(targetClubs, [tokenDoc.clubKey, tokenDoc.club])) return true;
  return false;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit || 20), 1), 50);
    const requestedDocId = String(body.docId || '').trim();

    const accessToken = await getGoogleAccessToken(env);
    const [allJobs, allTokens] = await Promise.all([
      listCollection(env, accessToken, 'pushNotifications', 100),
      listCollection(env, accessToken, 'pushTokens', 300)
    ]);

    let jobs = allJobs
      .filter(j => String(j.status || 'pending') === 'pending')
      .sort((a, b) => String(a.createdAtText || '').localeCompare(String(b.createdAtText || '')));

    if (requestedDocId) jobs = jobs.filter(j => j.__id === requestedDocId).concat(jobs.filter(j => j.__id !== requestedDocId));
    jobs = jobs.slice(0, limit);

    const summary = [];

    for (const job of jobs) {
      const tokens = allTokens.filter(t => isTargetToken(t, job));
      if (!tokens.length) {
        await patchDocument(env, accessToken, job.__name, {
          status: 'skipped',
          sentCount: 0,
          error: '대상 pushTokens 없음',
          processedAtText: new Date().toISOString()
        });
        summary.push({ id: job.__id, status: 'skipped', sent: 0 });
        continue;
      }

      let sent = 0;
      let failed = 0;
      const errors = [];
      const data = {
        type: job.type || 'match_event',
        kind: job.kind || '',
        tid: job.tid || '',
        div: job.div || '',
        key: job.key || '',
        matchId: job.matchId || '',
        court: job.court || '',
        queuePos: job.queuePos || '',
        url: '/?push=1',
        tag: `230match-${job.kind || 'event'}-${job.matchId || job.__id}`
      };

      for (const tokenDoc of tokens) {
        const res = await sendFcm(env, accessToken, tokenDoc.token, job.title || '230MATCH 경기 알림', job.body || '', data);
        if (res.ok) sent += 1;
        else {
          failed += 1;
          errors.push({ uid: tokenDoc.uid || '', status: res.status, result: res.result });
        }
      }

      await patchDocument(env, accessToken, job.__name, {
        status: failed && !sent ? 'failed' : 'sent',
        sentCount: sent,
        failedCount: failed,
        processedAtText: new Date().toISOString(),
        error: errors.length ? JSON.stringify(errors).slice(0, 1500) : ''
      });
      summary.push({ id: job.__id, status: failed && !sent ? 'failed' : 'sent', sent, failed });
    }

    return jsonResponse({ ok: true, processed: summary.length, summary });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message || error) }, 500);
  }
}
