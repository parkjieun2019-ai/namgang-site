-- ==========================================================================
-- 남강포장 홈페이지 · Supabase 설정
-- 사용법: Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 [Run]
-- 여러 번 실행해도 안전하도록 작성되어 있습니다.
--
-- 권한 원칙
--   · 방문자: 견적 "등록"과 첨부 "업로드"만 가능. 목록 조회·수정 불가
--   · 관리자: admin_users 명단에 등록된 이메일로 로그인한 사람만 모든 관리 가능
--     (로그인만 한 계정은 아무것도 볼 수 없음 — 회원가입이 실수로 켜져도 안전)
-- 관리자 등록은 맨 아래 "7. 관리자 등록"을 참고하세요.
-- ==========================================================================

-- 0. 관리자 명단 ------------------------------------------------------------
create table if not exists public.admin_users (
  email      text primary key,
  role       text not null default 'staff' check (role in ('owner', 'staff')),  -- owner: 담당자 삭제·비밀번호 재설정 가능
  notify     boolean not null default false,  -- 새 견적 알림 메일 받기
  created_at timestamptz not null default now()
);
-- 정책을 만들지 않으므로 사이트·API로는 명단을 읽거나 바꿀 수 없음 (대시보드에서만 관리)
alter table public.admin_users enable row level security;

-- 로그인한 사람이 관리자 명단에 있는지 확인하는 함수
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 1. 견적 문의 ---------------------------------------------------------------
create table if not exists public.quotes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  receipt_no  text not null check (char_length(receipt_no) <= 30),
  source      text not null default 'contact' check (source in ('contact', 'quick')),
  box_type    text check (char_length(box_type) <= 50),
  size        jsonb,
  quantity    text check (char_length(quantity) <= 50),
  flute       text check (char_length(flute) <= 50),
  printing    text check (char_length(printing) <= 50),
  due_date    date,
  message     text check (char_length(message) <= 3000),
  company     text not null check (char_length(company) between 1 and 100),
  manager     text check (char_length(manager) <= 50),
  phone       text not null check (char_length(phone) between 9 and 30),
  email       text check (char_length(email) <= 200),
  reply       text check (reply in ('phone', 'kakao', 'email')),
  attachments text[] not null default '{}' check (cardinality(attachments) <= 5),
  status      text not null default 'new' check (status in ('new', 'contacted', 'done')),
  admin_memo  text
);

alter table public.quotes enable row level security;

drop policy if exists "quotes_insert_public" on public.quotes;
create policy "quotes_insert_public" on public.quotes
  for insert to anon, authenticated
  with check (status = 'new' and admin_memo is null);

drop policy if exists "quotes_admin_select" on public.quotes;
create policy "quotes_admin_select" on public.quotes
  for select to authenticated using (public.is_admin());

drop policy if exists "quotes_admin_update" on public.quotes;
create policy "quotes_admin_update" on public.quotes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "quotes_admin_delete" on public.quotes;
create policy "quotes_admin_delete" on public.quotes
  for delete to authenticated using (public.is_admin());

create index if not exists quotes_created_at_idx on public.quotes (created_at desc);

-- 2. 사이트 문구·연락처 (관리자 페이지에서 수정) --------------------------------
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "settings_read_public" on public.site_settings;
create policy "settings_read_public" on public.site_settings
  for select to anon, authenticated using (true);
drop policy if exists "settings_admin_write" on public.site_settings;
create policy "settings_admin_write" on public.site_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 3. 사진 자리별 이미지 (히어로, 제품 카드 등) ----------------------------------
create table if not exists public.photos (
  slot_key   text primary key,
  url        text not null,
  updated_at timestamptz not null default now()
);
alter table public.photos enable row level security;
drop policy if exists "photos_read_public" on public.photos;
create policy "photos_read_public" on public.photos
  for select to anon, authenticated using (true);
drop policy if exists "photos_admin_write" on public.photos;
create policy "photos_admin_write" on public.photos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 4. 납품 사례 --------------------------------------------------------------
create table if not exists public.works (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  title       text not null,
  industry    text,
  description text,
  image_url   text,
  sort_order  int not null default 0,
  published   boolean not null default true
);
alter table public.works enable row level security;
drop policy if exists "works_read_public" on public.works;
create policy "works_read_public" on public.works
  for select to anon, authenticated using (published or public.is_admin());
drop policy if exists "works_admin_write" on public.works;
create policy "works_admin_write" on public.works
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5. 파일 저장소 -------------------------------------------------------------
--   quote-attachments : 견적 첨부 (비공개, 최대 10MB, 사진·PDF)
--   site-images       : 사이트 사진 (공개, 최대 5MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('quote-attachments', 'quote-attachments', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('site-images', 'site-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "attachments_upload_public" on storage.objects;
create policy "attachments_upload_public" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'quote-attachments');

drop policy if exists "attachments_admin_read" on storage.objects;
create policy "attachments_admin_read" on storage.objects
  for select to authenticated using (bucket_id = 'quote-attachments' and public.is_admin());

drop policy if exists "attachments_admin_delete" on storage.objects;
create policy "attachments_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'quote-attachments' and public.is_admin());

drop policy if exists "site_images_admin_write" on storage.objects;
create policy "site_images_admin_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'site-images' and public.is_admin())
  with check (bucket_id = 'site-images' and public.is_admin());

-- 6. 확인 --------------------------------------------------------------------
-- 실행 후 아래 결과로 표 5개가 보이면 정상입니다:
-- select table_name from information_schema.tables where table_schema = 'public' order by 1;

-- 7. 관리자 등록 ---------------------------------------------------------------
-- Authentication > Users 에서 관리자 계정을 만든 뒤, 같은 이메일을 아래처럼 등록하세요.
-- (이메일을 실제 주소로 바꾸고 이 두 줄만 선택해서 Run)
-- insert into public.admin_users (email, role) values ('관리자이메일@example.com', 'owner')
-- on conflict (email) do nothing;
--
-- 관리자 삭제:  delete from public.admin_users where email = '관리자이메일@example.com';
-- 이후 담당자 추가·삭제는 관리자 페이지 > 담당자 메뉴에서 (삭제·비밀번호 재설정은 role = 'owner'만 가능)
-- 관리자 목록:  select * from public.admin_users;

-- 8. 새 견적 알림 메일 ----------------------------------------------------------
-- 새 문의가 저장되면 Edge Function "notify-quote" 를 호출해 알림 받기(notify)가 켜진 관리자에게 메일을 보낸다.
alter table public.quotes add column if not exists notified_at timestamptz;
drop policy if exists "quotes_insert_public" on public.quotes;
create policy "quotes_insert_public" on public.quotes
  for insert to anon, authenticated
  with check (status = 'new' and admin_memo is null and notified_at is null);

alter table public.admin_users add column if not exists notify boolean not null default false;
update public.admin_users set notify = true where email = 'may212@daum.net';

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_quote()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- 공개용 anon 키로 호출 (함수 쪽에서 한 문의당 한 번만 보내도록 막음)
  perform net.http_post(
    url := 'https://ieowqffzcrggkntmfeik.supabase.co/functions/v1/notify-quote',
    body := jsonb_build_object('id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imllb3dxZmZ6Y3JnZ2tudG1mZWlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNjI2MzcsImV4cCI6MjEwNTYzODYzN30.SaK02GX4u2OKF09LvTRDzIqsT9Jj7PglWcW8VD9QDXw')
  );
  return new;
end $$;

drop trigger if exists quotes_notify on public.quotes;
create trigger quotes_notify after insert on public.quotes
  for each row execute function public.notify_new_quote();
