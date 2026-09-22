// 남강포장 관리자(담당자) 관리 — Supabase Edge Function "admin-users"
// 관리자 페이지에서 호출. 로그인한 사람이 admin_users 명단에 있을 때만 동작한다.
// 최고 권한 키(SUPABASE_SERVICE_ROLE_KEY)는 Supabase가 자동으로 넣어주며, 홈페이지 코드에는 절대 들어가지 않는다.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ALLOWED_ORIGINS = ['https://www.namgangpack.com', 'https://namgangpack.com', 'http://localhost:8123'];
const MIN_PW = 8;

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply(405, { error: '허용되지 않는 요청이에요.' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  // 1) 호출한 사람이 관리자 명단에 있는지 확인
  const asCaller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: me } = await asCaller.auth.getUser();
  const { data: isAdmin } = await asCaller.rpc('is_admin');
  if (!me?.user || isAdmin !== true) return reply(403, { error: '관리자만 사용할 수 있어요.' });
  const myEmail = (me.user.email ?? '').toLowerCase();
  const OWNER_ONLY = '최고 관리자만 할 수 있어요.';

  const db = createClient(url, service, { auth: { persistSession: false } });
  let body: Record<string, string> = {};
  try { body = await req.json(); } catch { /* 빈 요청 */ }
  const action = body.action;
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  async function findUser(target: string) {
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
      if (hit) return hit;
      if (data.users.length < 200) return null;
    }
    return null;
  }
  const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  async function roleOf(target: string) {
    const { data } = await db.from('admin_users').select('role').eq('email', target).maybeSingle();
    return data?.role ?? null;
  }

  try {
    if (action === 'list') {
      const { data: rows, error } = await db.from('admin_users').select('email, role, notify, created_at').order('created_at');
      if (error) throw error;
      const { data: users, error: uErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (uErr) throw uErr;
      const byEmail = new Map(users.users.map((u) => [(u.email ?? '').toLowerCase(), u]));
      return reply(200, {
        me: myEmail,
        my_role: (rows ?? []).find((r) => r.email.toLowerCase() === myEmail)?.role ?? 'staff',
        admins: (rows ?? []).map((r) => {
          const u = byEmail.get(r.email.toLowerCase());
          return { email: r.email, role: r.role, notify: !!r.notify, added_at: r.created_at, has_account: !!u, last_sign_in_at: u?.last_sign_in_at ?? null };
        }),
      });
    }

    if (action === 'add') {
      if (!validEmail(email)) return reply(400, { error: '이메일 주소를 확인해 주세요.' });
      const existing = await findUser(email);
      let note = '';
      if (existing) {
        note = '이미 있는 계정이라 기존 비밀번호를 그대로 써요.';
      } else {
        if (password.length < MIN_PW) return reply(400, { error: '임시 비밀번호는 ' + MIN_PW + '자 이상으로 정해 주세요.' });
        const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
        if (error) throw error;
      }
      const { error: insErr } = await db.from('admin_users').upsert({ email, role: 'staff' }, { onConflict: 'email', ignoreDuplicates: true });
      if (insErr) throw insErr;
      return reply(200, { ok: true, created: !existing, note });
    }

    if (action === 'reset') {
      if ((await roleOf(myEmail)) !== 'owner') return reply(403, { error: OWNER_ONLY });
      if (password.length < MIN_PW) return reply(400, { error: '임시 비밀번호는 ' + MIN_PW + '자 이상으로 정해 주세요.' });
      const targetRole = await roleOf(email);
      if (!targetRole) return reply(400, { error: '관리자 명단에 없는 이메일이에요.' });
      if (targetRole === 'owner') return reply(400, { error: '최고 관리자 비밀번호는 본인이 [내 비밀번호 변경]에서 바꿔 주세요.' });
      const user = await findUser(email);
      if (!user) {
        const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
        if (error) throw error;
      } else {
        const { error } = await db.auth.admin.updateUserById(user.id, { password });
        if (error) throw error;
      }
      return reply(200, { ok: true });
    }

    if (action === 'notify') {
      // 새 문의 알림 받기 켜기/끄기 — 본인 것은 누구나, 다른 사람 것은 최고 관리자만
      if (email !== myEmail && (await roleOf(myEmail)) !== 'owner') return reply(403, { error: OWNER_ONLY });
      if (!(await roleOf(email))) return reply(400, { error: '관리자 명단에 없는 이메일이에요.' });
      const { error } = await db.from('admin_users').update({ notify: String(body.on) === 'true' }).eq('email', email);
      if (error) throw error;
      return reply(200, { ok: true });
    }

    if (action === 'remove') {
      if ((await roleOf(myEmail)) !== 'owner') return reply(403, { error: OWNER_ONLY });
      if (email === myEmail) return reply(400, { error: '본인 계정은 삭제할 수 없어요.' });
      const targetRole = await roleOf(email);
      if (!targetRole) return reply(400, { error: '관리자 명단에 없는 이메일이에요.' });
      if (targetRole === 'owner') return reply(400, { error: '최고 관리자는 삭제할 수 없어요.' });
      const { error } = await db.from('admin_users').delete().eq('email', email);
      if (error) throw error;
      const user = await findUser(email);
      if (user) {
        const { error: dErr } = await db.auth.admin.deleteUser(user.id);
        if (dErr) throw dErr;
      }
      return reply(200, { ok: true });
    }

    return reply(400, { error: '알 수 없는 요청이에요.' });
  } catch (err) {
    console.error(err);
    return reply(500, { error: '처리하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
});
