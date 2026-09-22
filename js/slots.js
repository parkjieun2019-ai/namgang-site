/*
 * 사진 자리 목록 — 관리자 페이지(사진 관리)와 사이트(site-data.js)가 함께 사용
 * key: 저장 이름 / page: 사진이 있는 페이지 / sel: 페이지 안의 이미지 위치
 * ratio·width: 관리자에서 사진을 자를 비율과 저장할 가로 크기(px)
 */
window.NAMGANG_SLOTS = [
  { key: 'hero-1', group: '메인 첫 화면', label: '01 원단', ratio: 16 / 9, width: 1920, page: 'index', sel: '.hero-slide:nth-child(1) img' },
  { key: 'hero-2', group: '메인 첫 화면', label: '02 인쇄', ratio: 16 / 9, width: 1920, page: 'index', sel: '.hero-slide:nth-child(2) img' },
  { key: 'hero-3', group: '메인 첫 화면', label: '03 재단', ratio: 16 / 9, width: 1920, page: 'index', sel: '.hero-slide:nth-child(3) img' },
  { key: 'hero-4', group: '메인 첫 화면', label: '04 접착·제함', ratio: 16 / 9, width: 1920, page: 'index', sel: '.hero-slide:nth-child(4) img' },
  { key: 'hero-5', group: '메인 첫 화면', label: '05 출고', ratio: 16 / 9, width: 1920, page: 'index', sel: '.hero-slide:nth-child(5) img' },

  { key: 'product-carton', group: '메인 제품 카드', label: 'CARTON BOX', ratio: 4 / 3, width: 1200, page: 'index', sel: '.product-card:nth-child(1) img' },
  { key: 'product-printed', group: '메인 제품 카드', label: 'PRINTED BOX', ratio: 4 / 3, width: 1200, page: 'index', sel: '.product-card:nth-child(2) img' },

  { key: 'process-1', group: '메인 공정 카드', label: '01 원단', ratio: 3 / 4, width: 900, page: 'index', sel: '.process-item:nth-child(1) img' },
  { key: 'process-2', group: '메인 공정 카드', label: '02 인쇄', ratio: 3 / 4, width: 900, page: 'index', sel: '.process-item:nth-child(2) img' },
  { key: 'process-3', group: '메인 공정 카드', label: '03 재단', ratio: 3 / 4, width: 900, page: 'index', sel: '.process-item:nth-child(3) img' },
  { key: 'process-4', group: '메인 공정 카드', label: '04 접착·제함', ratio: 3 / 4, width: 900, page: 'index', sel: '.process-item:nth-child(4) img' },
  { key: 'process-5', group: '메인 공정 카드', label: '05 출고', ratio: 3 / 4, width: 900, page: 'index', sel: '.process-item:nth-child(5) img' },

  { key: 'trio-about', group: '메인 안내 카드', label: '회사소개', ratio: 4 / 3, width: 900, page: 'index', sel: '.trio-card:nth-child(1) img' },
  { key: 'trio-eco', group: '메인 안내 카드', label: '친환경 포장', ratio: 4 / 3, width: 900, page: 'index', sel: '.trio-card:nth-child(2) img' },
  { key: 'trio-contact', group: '메인 안내 카드', label: '견적 상담 안내', ratio: 4 / 3, width: 900, page: 'index', sel: '.trio-card:nth-child(3) img' },

  { key: 'eco-bg', group: '배경', label: '친환경 배경 (메인·제품소개)', ratio: 16 / 9, width: 1920, page: ['index', 'products'], sel: '.eco-bg img' },

  { key: 'sub-about', group: '페이지 상단', label: '회사소개 상단', ratio: 16 / 9, width: 1920, page: 'about', sel: '.sub-visual-bg img' },
  { key: 'sub-products', group: '페이지 상단', label: '제품소개 상단', ratio: 16 / 9, width: 1920, page: 'products', sel: '.sub-visual-bg img' },
  { key: 'sub-facility', group: '페이지 상단', label: '설비·공정 상단', ratio: 16 / 9, width: 1920, page: 'facility', sel: '.sub-visual-bg img' },
  { key: 'sub-contact', group: '페이지 상단', label: '견적문의 상단', ratio: 16 / 9, width: 1920, page: 'contact', sel: '.sub-visual-bg img' },
  { key: 'sub-careers', group: '페이지 상단', label: '채용 상단', ratio: 16 / 9, width: 1920, page: 'careers', sel: '.sub-visual-bg img' },

  { key: 'greeting', group: '회사소개', label: '인사말 옆 사진', ratio: 4 / 5, width: 1000, page: 'about', sel: '#greeting .split-media img' },

  { key: 'type-1', group: '제품 6종', label: '일반형 박스 (A형)', ratio: 4 / 3, width: 900, page: 'products', sel: '#carton .type-card:nth-child(1) img' },
  { key: 'type-2', group: '제품 6종', label: '조립형 박스', ratio: 4 / 3, width: 900, page: 'products', sel: '#carton .type-card:nth-child(2) img' },
  { key: 'type-3', group: '제품 6종', label: '뚜껑 일체형 박스', ratio: 4 / 3, width: 900, page: 'products', sel: '#carton .type-card:nth-child(3) img' },
  { key: 'type-4', group: '제품 6종', label: '손잡이형 박스', ratio: 4 / 3, width: 900, page: 'products', sel: '#carton .type-card:nth-child(4) img' },
  { key: 'type-5', group: '제품 6종', label: '장형 박스', ratio: 4 / 3, width: 900, page: 'products', sel: '#carton .type-card:nth-child(5) img' },
  { key: 'type-6', group: '제품 6종', label: '싸개형 박스', ratio: 4 / 3, width: 900, page: 'products', sel: '#carton .type-card:nth-child(6) img' },
  { key: 'printed-photo', group: '제품 6종', label: '인쇄 박스 소개 사진', ratio: 4 / 5, width: 1000, page: 'products', sel: '#printed .split-media img' },

  { key: 'step-1', group: '설비·공정 5단계', label: '01 원단', ratio: 4 / 3, width: 1200, page: 'facility', sel: '#process .step-row:nth-child(1) img' },
  { key: 'step-2', group: '설비·공정 5단계', label: '02 인쇄', ratio: 4 / 3, width: 1200, page: 'facility', sel: '#process .step-row:nth-child(2) img' },
  { key: 'step-3', group: '설비·공정 5단계', label: '03 재단', ratio: 4 / 3, width: 1200, page: 'facility', sel: '#process .step-row:nth-child(3) img' },
  { key: 'step-4', group: '설비·공정 5단계', label: '04 접착·제함', ratio: 4 / 3, width: 1200, page: 'facility', sel: '#process .step-row:nth-child(4) img' },
  { key: 'step-5', group: '설비·공정 5단계', label: '05 출고', ratio: 4 / 3, width: 1200, page: 'facility', sel: '#process .step-row:nth-child(5) img' }
];
