/* ==========================================================================
   남강포장 — 공통 스크립트
   ========================================================================== */
(function () {
  'use strict';

  var config = window.SITE_CONFIG || {};

  /* ---------- 연락처 설정값을 페이지에 적용 ---------- */
  function applyContacts() {
    var telHref = 'tel:' + String(config.phone || '').replace(/[^0-9+]/g, '');
    document.querySelectorAll('[data-tel-link]').forEach(function (el) { el.setAttribute('href', telHref); });
    document.querySelectorAll('[data-tel-text]').forEach(function (el) { el.textContent = config.phone; });
    document.querySelectorAll('[data-kakao-link]').forEach(function (el) {
      el.setAttribute('href', config.kakaoChannelUrl || '#');
      if (config.kakaoChannelUrl && config.kakaoChannelUrl !== '#') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
      }
    });
    document.querySelectorAll('[data-email-text]').forEach(function (el) { el.textContent = config.email; });
    document.querySelectorAll('[data-mail-link]').forEach(function (el) { el.setAttribute('href', 'mailto:' + config.email); });
    document.querySelectorAll('[data-fax-text]').forEach(function (el) { el.textContent = config.fax; });
  }

  /* ---------- 헤더: 스크롤하면 흰 배경 ---------- */
  function initHeader() {
    var header = document.querySelector('.site-header');
    var topBtn = document.querySelector('.float-top');
    if (!header) return;
    var onScroll = function () {
      var y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 40);
      if (topBtn) topBtn.classList.toggle('is-show', y > window.innerHeight * 0.6);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    if (topBtn) {
      topBtn.addEventListener('click', function () { window.scrollTo({ top: 0 }); });
    }
  }

  /* ---------- 전체화면 메뉴 ---------- */
  function initFullmenu() {
    var menu = document.querySelector('.fullmenu');
    var openBtn = document.querySelector('.menu-toggle');
    if (!menu || !openBtn) return;
    var closeBtn = menu.querySelector('.fullmenu-close');
    var setOpen = function (open) {
      menu.classList.toggle('is-open', open);
      openBtn.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    };
    openBtn.addEventListener('click', function () { setOpen(true); });
    closeBtn.addEventListener('click', function () { setOpen(false); });
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  /* ---------- 히어로: 원스톱 공정 슬라이드 ---------- */
  function initHero() {
    var hero = document.querySelector('.hero');
    if (!hero) return;
    var slides = hero.querySelectorAll('.hero-slide');
    var steps = hero.querySelectorAll('.hero-step');
    var duration = 5500;
    var current = 0;
    var timer = null;
    hero.style.setProperty('--slide-ms', duration + 'ms');

    var show = function (index) {
      current = (index + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle('is-active', i === current); });
      steps.forEach(function (s, i) {
        s.classList.remove('is-active');
        if (i === current) {
          void s.offsetWidth; // 진행 막대 애니메이션 재시작
          s.classList.add('is-active');
        }
        s.setAttribute('aria-current', i === current ? 'step' : 'false');
      });
    };
    var start = function () {
      clearInterval(timer);
      timer = setInterval(function () { show(current + 1); }, duration);
    };

    steps.forEach(function (step, i) {
      step.addEventListener('click', function () { show(i); start(); });
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearInterval(timer); else start();
    });

    show(0);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) start();
  }

  /* ---------- 스크롤 등장 효과 ---------- */
  function initReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 빠른 견적 폼 ---------- */
  function initQuickQuote() {
    var form = document.querySelector('#quickQuote');
    if (!form) return;
    var done = document.querySelector('.qform-done');

    var validators = {
      company: function (v) { return v.trim() ? '' : '회사명을 입력해 주세요.'; },
      contact: function (v) {
        var digits = v.replace(/[^0-9]/g, '');
        return digits.length >= 9 ? '' : '연락 가능한 전화번호를 입력해 주세요.';
      },
      boxType: function (v) { return v ? '' : '박스 종류를 선택해 주세요.'; }
    };

    var validateField = function (name) {
      var input = form.elements[name];
      var field = input.closest('.qfield');
      var msg = validators[name](input.value);
      field.classList.toggle('has-error', !!msg);
      field.querySelector('.err').textContent = msg;
      return !msg;
    };

    Object.keys(validators).forEach(function (name) {
      var input = form.elements[name];
      input.addEventListener('input', function () {
        if (input.closest('.qfield').classList.contains('has-error')) validateField(name);
      });
      input.addEventListener('change', function () {
        if (input.closest('.qfield').classList.contains('has-error')) validateField(name);
      });
    });

    var agree = form.elements.agree;
    agree.addEventListener('change', function () {
      agree.closest('.agree').classList.toggle('has-error', !agree.checked);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.elements.website && form.elements.website.value) return; // 스팸 봇

      var ok = Object.keys(validators).map(validateField).every(Boolean);
      agree.closest('.agree').classList.toggle('has-error', !agree.checked);
      if (!ok || !agree.checked) {
        var firstError = form.querySelector('.has-error input, .has-error select');
        if (firstError) firstError.focus();
        return;
      }

      // TODO: Supabase 연결 후 submitQuote(data)로 실제 저장
      submitQuote(new FormData(form)).then(function () {
        form.querySelectorAll('.qfield, .qform-bottom').forEach(function (el) { el.hidden = true; });
        done.classList.add('is-show');
      });
    });
  }

  // 견적 전송은 이 함수 하나에서만 처리한다 (저장소가 바뀌어도 여기만 수정)
  // 메인 빠른 견적(FormData)과 견적문의 페이지(객체) 모두 이 함수를 쓴다
  function submitQuote(data) {
    var preview = data instanceof FormData ? Object.fromEntries(data.entries()) : data;
    console.info('[demo] 견적 접수', preview);
    return new Promise(function (resolve) { setTimeout(resolve, 600); });
  }
  window.submitQuote = submitQuote;

  document.addEventListener('DOMContentLoaded', function () {
    applyContacts();
    initHeader();
    initFullmenu();
    initHero();
    initReveal();
    initQuickQuote();
    var year = document.querySelector('[data-year]');
    if (year) year.textContent = new Date().getFullYear();
  });
})();
