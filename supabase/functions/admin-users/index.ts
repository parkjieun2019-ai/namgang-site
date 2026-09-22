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

  try {
    if (action === 'list') {
      const { data: rows, error } = await db.from('admin_users').select('email, created_at').order('created_at');
      if (error) throw error;
      const { data: users, error: uErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (uErr) throw uErr;
      const byEmail = new Map(users.users.map((u) => [(u.email ?? '').toLowerCase(), u]));
      return reply(200, {
        me: myEmail,
        admins: (rows ?? []).map((r) => {
          const u = byEmail.get(r.email.toLowerCase());
          return { email: r.email, added_at: r.created_at, has_account: !!u, last_sign_in_at: u?.last_sign_in_at ?? null };
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
      const { error: insErr } = await db.from('admin_users').upsert({ email }, { onConflict: 'email' });
      if (insErr) throw insErr;
      return reply(200, { ok: true, created: !existing, note });
    }

    if (action === 'reset') {
      if (password.length < MIN_PW) return reply(400, { error: '임시 비밀번호는 ' + MIN_PW + '자 이상으로 정해 주세요.' });
      const { data: listed } = await db.from('admin_users').select('email').eq('email', email).maybeSingle();
      if (!listed) return reply(400, { error: '관리자 명단에 없는 이메일이에요.' });
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

    if (action === 'remove') {
      if (email === myEmail) return reply(400, { error: '본인 계정은 삭제할 수 없어요.' });
      const { count } = await db.from('admin_users').select('email', { count: 'exact', head: true });
      if ((count ?? 0) <= 1) return reply(400, { error: '마지막 관리자는 삭제할 수 없어요.' });
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
