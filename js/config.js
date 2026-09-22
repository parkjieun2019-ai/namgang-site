/*
 * 사이트 설정값
 * 연락처는 나중에 관리자 페이지(문구·연락처)에서 바꿀 수 있게 되며,
 * 그 전까지는 여기 값이 사용됩니다.
 */
window.SITE_CONFIG = {
  companyName: '주식회사 남강포장',
  phone: '031-611-8366',
  fax: '031-611-8367',
  email: 'may212@daum.net',
  // 카카오톡 채널 '남강포장' (끝의 /chat: 누르면 바로 1:1 채팅이 열림). 비우면 카톡 버튼이 숨겨짐
  kakaoChannelUrl: 'https://pf.kakao.com/_xhxjfaX/chat',

  // Supabase 연결 정보 (관리자설정가이드.md 참고). 비어 있으면 기본 내용만 표시
  // (공개용 anon 키 — 홈페이지에 공개되어도 안전. 권한은 Supabase 보안 규칙이 지킴)
  supabaseUrl: 'https://ieowqffzcrggkntmfeik.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imllb3dxZmZ6Y3JnZ2tudG1mZWlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNjI2MzcsImV4cCI6MjEwNTYzODYzN30.SaK02GX4u2OKF09LvTRDzIqsT9Jj7PglWcW8VD9QDXw'
};
