-- ==========================================================================
-- 남강포장 홈페이지 · Supabase 설정
-- 사용법: Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 [Run]
-- 여러 번 실행해도 안전하도록 작성되어 있습니다.
--
-- 권한 원칙
--   · 방문자(anon): 견적 "등록"과 첨부 "업로드"만 가능. 목록 조회·수정 불가
--   · 관리자(authenticated): 모두 가능  ※ 회원가입을 꺼두어 관리자 계정만 존재해야 함
-- ==========================================================================

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
  for select to authenticated using (true);

drop policy if exists "quotes_admin_update" on public.quotes;
create policy "quotes_admin_update" on public.quotes
  for update to authenticated using (true) with check (true);

drop policy if exists "quotes_admin_delete" on public.quotes;
create policy "quotes_admin_delete" on public.quotes
  for delete to authenticated using (true);

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
  for all to authenticated using (true) with check (true);

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
  for all to authenticated using (true) with check (true);

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
  for select to anon, authenticated using (published or auth.role() = 'authenticated');
drop policy if exists "works_admin_write" on public.works;
create policy "works_admin_write" on public.works
  for all to authenticated using (true) with check (true);

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
  for select to authenticated using (bucket_id = 'quote-attachments');

drop policy if exists "attachments_admin_delete" on storage.objects;
create policy "attachments_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'quote-attachments');

drop policy if exists "site_images_admin_write" on storage.objects;
create policy "site_images_admin_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'site-images') with check (bucket_id = 'site-images');
