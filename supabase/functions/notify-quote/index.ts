// 남강포장 새 견적 알림 — Supabase Edge Function "notify-quote"
// quotes 표에 새 문의가 저장되면 데이터베이스 트리거가 { id } 를 보내 호출한다.
// 한 문의에 한 번만 보낸다(notified_at). 메일에는 고객 연락처를 넣지 않는다 — 상세는 관리자 페이지에서 확인.
// 필요한 비밀값(Edge Functions > Secrets): RESEND_API_KEY / 선택: NOTIFY_FROM (예: 남강포장 <noreply@namgangpack.com>)
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ADMIN_URL = 'https://www.namgangpack.com/admin/';
const FALLBACK_TO = ['may212@daum.net'];

function esc(s: unknown) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

Deno.serve(async (req) => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  let id = '';
  try { id = String((await req.json()).id ?? ''); } catch { /* 빈 요청 */ }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json(400, { error: 'bad id' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // 아직 알림을 안 보낸 10분 이내 문의만 — 한 번만 표시하고 보낸다
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: q, error } = await db.from('quotes')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', id).is('notified_at', null).gte('created_at', since)
    .select('receipt_no, created_at, source, company, box_type, quantity, printing, due_date, attachments')
    .maybeSingle();
  if (error) { console.error(error); return json(500, { error: 'db' }); }
  if (!q) return json(200, { skipped: 'already notified or too old' });

  // 비밀값 이름: RESEND_API_KEY (처음 등록 때 NAMGANG-SITE 이름으로 저장돼 둘 다 읽음)
  const key = Deno.env.get('RESEND_API_KEY') || Deno.env.get('NAMGANG-SITE');
  if (!key) { console.warn('RESEND_API_KEY 없음 — 알림 생략'); return json(200, { skipped: 'no api key' }); }

  const { data: rows } = await db.from('admin_users').select('email').eq('notify', true);
  const to = rows && rows.length ? rows.map((r) => r.email) : FALLBACK_TO;

  const when = new Date(q.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' });
  const lines: [string, unknown][] = [
    ['접수번호', q.receipt_no], ['접수 시각', when], ['회사명', q.company], ['박스 종류', q.box_type],
    ['수량', q.quantity], ['인쇄', q.printing], ['희망 납기', q.due_date],
    ['첨부', q.attachments?.length ? q.attachments.length + '개' : null], ['접수 경로', q.source === 'quick' ? '메인 빠른 견적' : '견적문의 페이지'],
  ];
  const rowsHtml = lines.filter((l) => l[1]).map((l) =>
    '<tr><td style="padding:6px 16px 6px 0;color:#6f6b64;white-space:nowrap">' + esc(l[0]) + '</td><td style="padding:6px 0;font-weight:600">' + esc(l[1]) + '</td></tr>').join('');
  const html =
    '<div style="font-family:Apple SD Gothic Neo,Malgun Gothic,sans-serif;max-width:520px;margin:0 auto;color:#1c1b19">' +
    '<p style="margin:0 0 4px;font-size:13px;color:#8a5a06;font-weight:700">남강포장 홈페이지</p>' +
    '<h1 style="margin:0 0 18px;font-size:22px">새 견적 문의가 들어왔어요</h1>' +
    '<table style="border-collapse:collapse;font-size:15px">' + rowsHtml + '</table>' +
    '<p style="margin:22px 0"><a href="' + ADMIN_URL + '" style="display:inline-block;padding:12px 20px;background:#1c1b19;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">관리자 페이지에서 확인하기</a></p>' +
    '<p style="margin:0;font-size:12.5px;color:#9a968e">고객 연락처와 요청사항은 개인정보 보호를 위해 메일에 넣지 않았어요. 관리자 페이지에서 확인하세요.</p></div>';
  const text = '새 견적 문의가 들어왔어요\n\n' + lines.filter((l) => l[1]).map((l) => l[0] + ': ' + l[1]).join('\n') + '\n\n확인: ' + ADMIN_URL;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('NOTIFY_FROM') || '남강포장 홈페이지 <onboarding@resend.dev>',
      to,
      subject: '[새 견적] ' + q.company + ' · ' + (q.box_type || '박스') + ' (' + q.receipt_no + ')',
      html,
      text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error('Resend 실패', res.status, detail);
    await db.from('quotes').update({ notified_at: null }).eq('id', id); // 다음 시도에서 다시 보낼 수 있게
    return json(502, { error: 'mail failed', status: res.status });
  }
  return json(200, { ok: true, to: to.length });
});
