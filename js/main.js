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
    // 카카오톡 채널 주소가 없으면 카톡 버튼을 숨긴다 (눌러도 반응 없는 버튼 방지)
    var hasKakao = /^https?:\/\//.test(config.kakaoChannelUrl || '');
    document.querySelectorAll('[data-kakao-link]').forEach(function (el) {
      el.hidden = !hasKakao;
      if (!hasKakao) return;
      el.setAttribute('href', config.kakaoChannelUrl);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener');
    });
    document.documentElement.classList.toggle('no-kakao', !hasKakao);
    document.querySelectorAll('[data-email-text]').forEach(function (el) { el.textContent = config.email; });
    document.querySelectorAll('[data-mail-link]').forEach(function (el) { el.setAttribute('href', 'mailto:' + config.email); });
    document.querySelectorAll('[data-fax-text]').forEach(function (el) { el.textContent = config.fax; });
  }

  /* ---------- PC에서 카톡 버튼: QR 코드 창 ----------
     휴대폰은 링크 그대로(카톡 앱이 바로 열림). PC는 카카오 로그인 대신
     휴대폰으로 QR을 찍거나 PC 카카오톡으로 열 수 있게 작은 창을 띄운다. */
  var QR_JS = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
  var kakaoDlg = null;
  function isDesktop() {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches && window.innerWidth > 860;
  }
  function loadQr() {
    if (window.qrcode) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = QR_JS;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function buildKakaoDialog() {
    var d = document.createElement('dialog');
    d.className = 'kakao-dlg';
    d.setAttribute('aria-labelledby', 'kakaoDlgTitle');
    d.innerHTML =
      '<button type="button" class="kakao-dlg-close" aria-label="닫기">×</button>' +
      '<p class="kakao-dlg-eyebrow"><span class="kakao-dlg-badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7l-1 3.6c-.1.3.3.6.6.4l4.2-2.8c.5.1 1 .1 1.5.1 5.5 0 10-3.6 10-8S17.5 3 12 3z"/></svg></span>카카오톡 상담</p>' +
      '<h2 id="kakaoDlgTitle">휴대폰으로 찍으면 바로 채팅이 열려요</h2>' +
      '<div class="kakao-dlg-qr" data-qr><span>QR 코드를 만드는 중…</span></div>' +
      '<p class="kakao-dlg-help">휴대폰 카메라로 QR 코드를 비춰 주세요.</p>' +
      '<a class="btn btn-kakao kakao-dlg-open" target="_blank" rel="noopener" data-open>PC 카카오톡으로 열기</a>' +
      '<p class="kakao-dlg-tel">전화 상담 <a data-tel-link data-tel-text></a></p>';
    document.body.appendChild(d);
    d.querySelector('.kakao-dlg-close').addEventListener('click', function () { d.close(); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); }); // 바깥 누르면 닫기
    d.querySelector('[data-open]').addEventListener('click', function () { setTimeout(function () { d.close(); }, 100); });
    applyContacts();
    return d;
  }
  function openKakaoDialog(url) {
    if (!kakaoDlg) kakaoDlg = buildKakaoDialog();
    kakaoDlg.querySelector('[data-open]').setAttribute('href', url);
    var box = kakaoDlg.querySelector('[data-qr]');
    if (box.dataset.url !== url) {
      box.dataset.url = url;
      loadQr().then(function () {
        var qr = window.qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        box.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true, alt: '카카오톡 채팅 QR 코드' });
      }).catch(function () {
        box.innerHTML = '<span>QR 코드를 불러오지 못했어요. 아래 버튼을 눌러 주세요.</span>';
      });
    }
    kakaoDlg.showModal();
  }
  function initKakaoPopup() {
    if (typeof HTMLDialogElement !== 'function') return; // 아주 오래된 브라우저는 링크 그대로
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-kakao-link]');
      if (!a || a.closest('.kakao-dlg') || !isDesktop()) return;
      var url = a.getAttribute('href');
      if (!/^https?:\/\//.test(url || '')) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey) return; // 새 탭으로 열려는 경우는 그대로
      e.preventDefault();
      openKakaoDialog(url);
    });
  }

  /* ---------- PC에서 이메일 링크: 주소 복사 창 ----------
     mailto: 는 PC에 메일 프로그램이 설정돼 있어야만 열린다(웹메일 사용자는 반응 없음).
     PC에서는 주소 복사·메일 앱·지메일 중 고를 수 있게 한다. 휴대폰은 메일 앱이 바로 열림. */
  var mailDlg = null;
  // 복사: 클립보드 API → 안 되면 창 안에 임시 입력칸을 만들어 복사 (모달 바깥은 선택이 막혀 있음)
  function copyText(text, host) {
    var fallback = function () {
      return new Promise(function (resolve, reject) {
        var t = document.createElement('textarea');
        t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:absolute;left:-9999px;opacity:0';
        host.appendChild(t); t.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        host.removeChild(t);
        if (ok) resolve(); else reject(new Error('copy failed'));
      });
    };
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(fallback);
    return fallback();
  }
  function buildMailDialog() {
    var d = document.createElement('dialog');
    d.className = 'kakao-dlg mail-dlg';
    d.setAttribute('aria-labelledby', 'mailDlgTitle');
    d.innerHTML =
      '<button type="button" class="kakao-dlg-close" aria-label="닫기">×</button>' +
      '<p class="kakao-dlg-eyebrow"><span class="kakao-dlg-badge mail" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 6 9-6"/></svg></span>이메일 문의</p>' +
      '<h2 id="mailDlgTitle">아래 주소로 메일을 보내 주세요</h2>' +
      '<div class="mail-dlg-addr"><strong data-addr></strong><button type="button" class="btn btn-dark" data-copy>주소 복사</button></div>' +
      '<p class="mail-dlg-done" data-copied role="status"></p>' +
      '<div class="mail-dlg-actions"><a class="btn btn-line" data-mailto>메일 앱으로 열기</a><a class="btn btn-line" data-gmail target="_blank" rel="noopener">지메일로 쓰기</a></div>' +
      '<p class="kakao-dlg-tel">견적은 <a href="contact.html#quote">견적 요청하기</a>가 더 빨라요</p>';
    document.body.appendChild(d);
    d.querySelector('.kakao-dlg-close').addEventListener('click', function () { d.close(); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    d.querySelector('[data-copy]').addEventListener('click', function () {
      var msg = d.querySelector('[data-copied]');
      copyText(d.querySelector('[data-addr]').textContent, d).then(function () {
        msg.textContent = '주소를 복사했어요. 쓰시는 메일에서 받는 사람 칸에 붙여 넣으세요.';
      }).catch(function () { msg.textContent = '복사하지 못했어요. 주소를 직접 선택해 복사해 주세요.'; });
    });
    return d;
  }
  function openMailDialog() {
    if (!mailDlg) mailDlg = buildMailDialog();
    var email = config.email || '';
    var subject = '[남강포장] 견적 문의';
    mailDlg.querySelector('[data-addr]').textContent = email;
    mailDlg.querySelector('[data-copied]').textContent = '';
    mailDlg.querySelector('[data-mailto]').setAttribute('href', 'mailto:' + email + '?subject=' + encodeURIComponent(subject));
    mailDlg.querySelector('[data-gmail]').setAttribute('href', 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(email) + '&su=' + encodeURIComponent(subject));
    mailDlg.showModal();
  }
  function initMailPopup() {
    if (typeof HTMLDialogElement !== 'function') return;
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-mail-link]');
      if (!a || a.closest('.mail-dlg') || !isDesktop() || !config.email) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      openMailDialog();
    });
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

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      submitQuote(new FormData(form)).then(function (result) {
        form.querySelectorAll('.qfield, .qform-bottom').forEach(function (el) { el.hidden = true; });
        if (result && result.mode === 'mail') {
          done.querySelector('strong').textContent = '메일 앱에서 전송을 완료해 주세요';
          done.querySelector('p').innerHTML = '견적 내용이 담긴 메일 창이 열렸습니다. <b>보내기</b>를 눌러야 접수가 완료됩니다.<br>메일 앱이 열리지 않으면 ' + config.phone + '으로 전화 주세요.';
        }
        done.classList.add('is-show');
      }).catch(function () {
        btn.disabled = false;
      });
    });
  }

  /* ---------- 견적 전송 ----------
   * 견적 전송은 이 부분에서만 처리한다. 메인 빠른 견적(FormData)과 견적문의 페이지(객체) 모두 사용.
   * · Supabase가 설정돼 있으면: 첨부 업로드 후 quotes 테이블에 저장 (mode: 'online')
   * · 설정이 없거나 저장에 실패하면: 견적 내용을 담은 메일 창을 연다 (mode: 'mail')
   *   → Supabase 무료 플랜이 일시정지돼도 문의를 놓치지 않는다
   */
  var SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  var supabaseReady = null;

  function loadSupabase() {
    if (!config.supabaseUrl || !config.supabaseAnonKey) return Promise.resolve(null);
    if (!supabaseReady) {
      supabaseReady = new Promise(function (resolve, reject) {
        if (window.supabase) return resolve();
        var s = document.createElement('script');
        s.src = SUPABASE_JS;
        s.onload = resolve;
        s.onerror = function () { reject(new Error('supabase-js를 불러오지 못했습니다')); };
        document.head.appendChild(s);
      }).then(function () {
        return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: false } });
      });
      supabaseReady.catch(function () { supabaseReady = null; });
    }
    return supabaseReady;
  }

  function makeReceiptNo() {
    var d = new Date();
    var ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return 'NG-' + ymd + '-' + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  }

  // 두 폼의 데이터를 같은 모양으로 맞춘다
  function normalizeQuote(data) {
    if (data instanceof FormData) {
      var get = function (k) { return String(data.get(k) || '').trim(); };
      var w = get('width'), l = get('length'), h = get('height');
      return {
        receiptNo: makeReceiptNo(),
        source: 'quick',
        boxType: get('boxType'),
        size: (w || l || h) ? { width: w, length: l, height: h } : null,
        quantity: get('quantity'),
        message: get('message'),
        company: get('company'),
        phone: get('contact'),
        reply: 'phone',
        replyLabel: '전화',
        attachments: []
      };
    }
    var q = Object.assign({ source: 'contact' }, data);
    q.boxType = data.boxTypeLabel || data.boxType;
    return q;
  }

  function uploadAttachments(client, q) {
    return Promise.all((q.attachments || []).map(function (a, i) {
      // 저장소 경로에는 영문·숫자만 쓸 수 있어 한글 파일명은 photo/file로 바꾼다
      var ext = ((a.name || '').match(/\.[A-Za-z0-9]{1,5}$/) || [''])[0].toLowerCase();
      var base = (a.name || '').replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_-]+/g, '').slice(0, 40);
      if (!base) base = /^image\//.test(a.type) ? 'photo' : 'file';
      var path = q.receiptNo + '/' + (i + 1) + '-' + base + ext;
      return client.storage.from('quote-attachments')
        .upload(path, a.blob, { contentType: a.type || 'application/octet-stream', upsert: false })
        .then(function (res) { if (res.error) throw res.error; return path; });
    }));
  }

  function saveOnline(client, q) {
    return uploadAttachments(client, q).then(function (paths) {
      return client.from('quotes').insert({
        receipt_no: q.receiptNo,
        source: q.source,
        box_type: q.boxType || null,
        size: q.size || null,
        quantity: q.quantity || null,
        flute: q.flute || null,
        printing: q.printing || null,
        due_date: q.dueDate || null,
        message: q.message || null,
        company: q.company,
        manager: q.manager || null,
        phone: q.phone,
        email: q.email || null,
        reply: q.reply || null,
        attachments: paths
      });
    }).then(function (res) {
      if (res.error) throw res.error;
      return { mode: 'online', receiptNo: q.receiptNo };
    });
  }

  function sendByMail(q) {
    var size = q.size && (q.size.width || q.size.length || q.size.height)
      ? [q.size.width, q.size.length, q.size.height].map(function (v) { return v || '?'; }).join(' × ') + ' mm (가로 × 세로 × 높이)'
      : '상담 필요';
    var lines = [
      '[홈페이지 견적 문의] 접수번호 ' + q.receiptNo,
      '',
      '회사명: ' + q.company,
      '담당자: ' + (q.manager || '-'),
      '연락처: ' + q.phone,
      '이메일: ' + (q.email || '-'),
      '회신 방법: ' + (q.replyLabel || '-'),
      '',
      '박스 종류: ' + (q.boxType || '-'),
      '규격: ' + size,
      '수량: ' + (q.quantity || '-'),
      '골 종류: ' + (q.flute || '-'),
      '인쇄: ' + (q.printing || '-'),
      '희망 납기: ' + (q.dueDate || '협의'),
      '',
      '요청사항:',
      q.message || '-'
    ];
    if (q.attachments && q.attachments.length) {
      lines.push('', '※ 첨부하신 사진·도면 ' + q.attachments.length + '개는 이 메일에 직접 첨부해 주세요.');
    }
    var href = 'mailto:' + config.email +
      '?subject=' + encodeURIComponent('[견적문의] ' + q.company + ' (' + q.receiptNo + ')') +
      '&body=' + encodeURIComponent(lines.join('\n'));
    var a = document.createElement('a');
    a.href = href;
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { mode: 'mail', receiptNo: q.receiptNo };
  }

  function submitQuote(data) {
    var q = normalizeQuote(data);
    return loadSupabase()
      .then(function (client) { return client ? saveOnline(client, q) : sendByMail(q); })
      .catch(function (err) {
        console.warn('온라인 접수 실패, 메일로 전환합니다', err);
        return sendByMail(q);
      });
  }
  window.submitQuote = submitQuote;
  // site-data.js(관리자에서 바꾼 내용 반영)가 쓰는 공용 함수
  window.NamgangSite = { applyContacts: applyContacts, loadSupabase: loadSupabase };

  document.addEventListener('DOMContentLoaded', function () {
    applyContacts();
    initHeader();
    initKakaoPopup();
    initMailPopup();
    initFullmenu();
    initHero();
    initReveal();
    initQuickQuote();
    var year = document.querySelector('[data-year]');
    if (year) year.textContent = new Date().getFullYear();
  });
})();
