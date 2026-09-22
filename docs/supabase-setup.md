# Supabase 설정 가이드 (견적 온라인 접수 · 관리자 페이지용)

Supabase는 견적 문의와 첨부 사진, 사이트 사진을 저장하는 무료 온라인 저장소입니다.
설정 전까지 홈페이지 견적 폼은 **메일 창을 여는 방식**으로 동작하고, 설정이 끝나면 **온라인 접수**로 바뀝니다.

소요 시간: 약 15분 · 비용: 무료 플랜으로 시작

---

## 1. 가입과 프로젝트 만들기

1. https://supabase.com 접속 → **Start your project** → GitHub 계정(parkjieun2019-ai)으로 로그인하면 편합니다.
2. **New project** 클릭
   - Name: `namgang-site`
   - Database Password: 자동 생성 버튼을 누르고 **안전한 곳에 따로 저장** (Claude에게 보내지 마세요)
   - Region: **Northeast Asia (Seoul)** ← 한국 손님이 빠르게 쓸 수 있도록
3. **Create new project** → 1~2분 기다리면 준비됩니다.

## 2. 저장 공간과 보안 규칙 만들기

1. 왼쪽 메뉴 **SQL Editor** → **New query**
2. 홈페이지 폴더의 `supabase/schema.sql` 파일 내용을 **전부 복사해서 붙여넣기**
3. 오른쪽 아래 **Run** 클릭 → "Success. No rows returned" 가 나오면 완료

이 단계에서 만들어지는 것:
- 견적 문의 표(`quotes`), 사이트 문구(`site_settings`), 사진(`photos`), 납품 사례(`works`)
- 견적 첨부 저장소(비공개)와 사이트 사진 저장소(공개)
- 방문자는 견적 **등록만** 되고, 목록은 **관리자만** 볼 수 있는 보안 규칙

## 3. 회원가입 막기 (중요)

관리자 외에는 아무도 로그인할 수 없게 합니다.

1. 왼쪽 메뉴 **Authentication** → **Sign In / Providers** (또는 **Settings**)
2. **Allow new users to sign up** 를 **끄기(OFF)** → **Save**

## 4. 관리자 계정 만들기

1. **Authentication** → **Users** → **Add user** → **Create new user**
2. 관리자로 쓸 이메일과 비밀번호 입력, **Auto Confirm User** 체크 → **Create user**
3. **관리자 명단에 등록**: **SQL Editor**에서 아래 두 줄의 이메일을 방금 만든 주소로 바꿔 실행합니다.
   ```sql
   insert into public.admin_users (email) values ('관리자이메일@example.com')
   on conflict (email) do nothing;
   ```
   명단에 없는 계정은 로그인해도 아무것도 볼 수 없습니다. (회원가입이 실수로 켜져도 손님 정보가 안전한 이유)
4. 이 이메일·비밀번호로 관리자 페이지에 로그인합니다. (비밀번호는 Claude에게 보내지 마세요)
5. 첫 관리자 이후의 담당자 추가·삭제·비밀번호 재설정은 **관리자 페이지 → 담당자** 메뉴에서 합니다. (Supabase Edge Function `admin-users`, 코드: `supabase/functions/admin-users/index.ts`)

## 5. 홈페이지에 연결하기

1. 왼쪽 아래 **Project Settings**(톱니바퀴) → **API** (또는 **Data API**)
2. 아래 두 값을 복사합니다.
   - **Project URL** (예: `https://abcdxyz.supabase.co`)
   - **anon public** 키 (`eyJ...` 로 시작하는 긴 값)
3. 두 값을 Claude에게 알려주시면 연결해 드립니다.
   - anon 키는 홈페이지에 공개되는 용도의 키라 알려주셔도 괜찮습니다. 보안은 2단계의 규칙이 지켜줍니다.
   - ⚠️ **service_role** 키와 데이터베이스 비밀번호는 절대 공유하지 마세요.

## 6. 관리자 페이지 쓰기

- 주소: **https://www.namgangpack.com/admin/** (메뉴에는 없고 주소로만 들어갑니다)
- 4단계에서 만든 이메일·비밀번호로 로그인합니다.
- 할 수 있는 일
  - **견적 문의함**: 접수된 견적 확인, 첨부 사진 보기, 전화·메일 바로가기, 처리 상태(새 문의/연락함/완료)와 메모
  - **사진 관리**: 사이트 사진 34곳을 자리별로 교체. 올리면 회전·자르기·밝기·크라프트 톤을 자동으로 맞춥니다
  - **납품 사례**: 사진·업종·제목 추가, 순서 변경, 공개/숨김
  - **연락처**: 전화·팩스·이메일·카카오톡 채널 주소 수정
- Supabase를 연결하기 전에는 **데모 모드**로 열려 샘플 데이터가 보이고, 바꾼 내용은 저장되지 않습니다.

---

## 알아두실 점

- **무료 플랜 일시정지:** 오랫동안 사용이 없으면 프로젝트가 일시정지될 수 있습니다. 일시정지돼도 홈페이지는 자동으로 메일 접수로 바뀌어 문의를 놓치지 않지만, Supabase 대시보드에 들어가 **Restore(재개)** 를 눌러주세요.
- **새 문의 알림:** 지금은 관리자 페이지 문의함에서 확인합니다. 이메일·카카오톡 알림은 추가 작업으로 붙일 수 있습니다.
- **개인정보처리방침:** 연결 후 개인정보처리방침 제5조(처리 위탁)에 Supabase를 추가해야 합니다. (연결할 때 함께 수정합니다)
