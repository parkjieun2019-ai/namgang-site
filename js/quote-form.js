/* ==========================================================================
   남강포장 — 견적문의 3단계 폼 (contact.html)
   ========================================================================== */
(function () {
  'use strict';

  var MAX_FILES = 5;
  var MAX_PDF_BYTES = 10 * 1024 * 1024;
  var IMAGE_MAX_SIDE = 1600;

  var LABELS = {
    boxType: {
      delivery: '택배·유통 박스',
      food: '농산물·식품 박스',
      printed: '인쇄 박스',
      custom: '맞춤·특수 박스',
      unknown: '잘 모르겠어요'
    },
    reply: { phone: '전화', kakao: '카카오톡', email: '이메일' }
  };

  // 입력칸 이름 → 오류 표시 위치
  var ERROR_KEY = { sizeW: 'size', sizeL: 'size', sizeH: 'size', sizeUnknown: 'size' };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    var form = document.getElementById('quoteForm');
    if (!form) return;

    var f = form.elements;
    var panels = form.querySelectorAll('[data-step-panel]');
    var steps = document.querySelectorAll('.wz-step');
    var stepper = document.querySelector('.wz-stepper');
    var prevBtn = form.querySelector('[data-prev]');
    var nextBtn = form.querySelector('[data-next]');
    var submitBtn = form.querySelector('[data-submit]');
    var dropzone = form.querySelector('.dropzone');
    var fileList = form.querySelector('.file-list');
    var fileCount = form.querySelector('[data-file-count]');
    var summary = form.querySelector('[data-summary]');
    var done = document.getElementById('quoteDone');

    var current = 0;
    var attachments = []; // { name, kind: 'image'|'pdf', blob, size, url }

    /* ---------- 오류 표시 ---------- */
    function setError(key, msg) {
      var el = form.querySelector('[data-err="' + key + '"]');
      if (!el) return;
      el.textContent = msg || '';
      el.classList.toggle('is-show', !!msg);
      var holder = el.closest('.field, .wz-group');
      if (holder) holder.classList.toggle('has-error', !!msg);
    }

    function clearErrorFor(name) {
      setError(ERROR_KEY[name] || name, '');
    }
    // 첨부파일 오류는 addFiles에서 직접 관리하므로 여기서 지우지 않는다
    function onEdit(e) {
      if (e.target.name && e.target.name !== 'files') clearErrorFor(e.target.name);
    }
    form.addEventListener('input', onEdit);
    form.addEventListener('change', onEdit);

    /* ---------- 단계별 검증: 문제가 있으면 처음 문제 칸을 돌려준다 ---------- */
    var validators = [
      function () {
        var ok = !!f.boxType.value;
        setError('boxType', ok ? '' : '박스 종류를 하나 선택해 주세요.');
        return ok ? null : f.boxType[0];
      },
      function () {
        var first = null;
        var sizes = [f.sizeW, f.sizeL, f.sizeH];
        var badSize = f.sizeUnknown.checked ? [] : sizes.filter(function (el) { return !(Number(el.value) > 0); });
        setError('size', badSize.length ? '가로·세로·높이를 숫자로 입력하거나 “규격을 몰라요”를 선택해 주세요.' : '');
        if (badSize.length) first = badSize[0];

        var qtyOk = !!f.quantity.value;
        setError('quantity', qtyOk ? '' : '대략적인 수량을 선택해 주세요.');
        if (!qtyOk && !first) first = f.quantity[0];

        if (hasPending()) {
          setError('files', '사진을 처리하고 있어요. 잠시 후 다시 눌러주세요.');
          if (!first) first = nextBtn;
        }
        return first;
      },
      function () {
        var first = null;
        function check(name, msg, focusEl) {
          setError(name, msg);
          if (msg && !first) first = focusEl || f[name];
        }
        var digits = f.phone.value.replace(/[^0-9]/g, '');
        var email = f.email.value.trim();
        var emailMsg = '';
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) emailMsg = '이메일 주소 형식을 확인해 주세요.';
        else if (!email && f.reply.value === 'email') emailMsg = '이메일로 회신받으시려면 이메일 주소를 입력해 주세요.';

        check('company', f.company.value.trim() ? '' : '회사명을 입력해 주세요.');
        check('manager', f.manager.value.trim() ? '' : '담당자 성함을 입력해 주세요.');
        check('phone', digits.length >= 9 && digits.length <= 12 ? '' : '연락 가능한 전화번호를 입력해 주세요.');
        check('email', emailMsg);
        check('reply', f.reply.value ? '' : '회신받을 방법을 선택해 주세요.', f.reply[0]);
        check('agree', f.agree.checked ? '' : '개인정보 수집·이용에 동의해 주세요.');
        return first;
      }
    ];

    /* ---------- 단계 이동 ---------- */
    function goTo(index, moveFocus) {
      current = index;
      panels.forEach(function (panel, i) { panel.hidden = i !== current; });
      steps.forEach(function (step, i) {
        step.classList.toggle('is-active', i === current);
        step.classList.toggle('is-done', i < current);
        if (i === current) step.setAttribute('aria-current', 'step');
        else step.removeAttribute('aria-current');
      });
      var last = current === panels.length - 1;
      prevBtn.hidden = current === 0;
      nextBtn.hidden = last;
      submitBtn.hidden = !last;
      if (last) renderSummary();

      if (moveFocus) {
        var top = stepper.getBoundingClientRect().top + window.scrollY - 100;
        if (window.scrollY > top) window.scrollTo({ top: top });
        panels[current].querySelector('h2').focus({ preventScroll: true });
      }
    }

    nextBtn.addEventListener('click', function () {
      var bad = validators[current]();
      if (bad) { bad.focus(); return; }
      goTo(current + 1, true);
    });
    prevBtn.addEventListener('click', function () { goTo(current - 1, true); });

    f.sizeUnknown.addEventListener('change', function () {
      [f.sizeW, f.sizeL, f.sizeH].forEach(function (el) { el.disabled = f.sizeUnknown.checked; });
    });

    /* ---------- 첨부파일 ---------- */
    f.files.addEventListener('change', function () {
      addFiles(f.files.files);
      f.files.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (type) {
      dropzone.addEventListener(type, function (e) { e.preventDefault(); dropzone.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      dropzone.addEventListener(type, function (e) { e.preventDefault(); dropzone.classList.remove('is-over'); });
    });
    dropzone.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });

    function hasPending() {
      return attachments.some(function (a) { return !a.blob; });
    }

    function addFiles(list) {
      var messages = [];
      Array.prototype.forEach.call(list, function (file) {
        var isImage = /^image\//.test(file.type);
        var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        if (attachments.length >= MAX_FILES) {
          messages.push('파일은 최대 ' + MAX_FILES + '개까지 올릴 수 있어요.');
          return;
        }
        if (!isImage && !isPdf) {
          messages.push(file.name + ': 사진이나 PDF만 올릴 수 있어요.');
          return;
        }
        if (isPdf && file.size > MAX_PDF_BYTES) {
          messages.push(file.name + ': PDF는 10MB 이하만 올릴 수 있어요.');
          return;
        }

        var item = { name: file.name, kind: isImage ? 'image' : 'pdf', blob: null, size: 0, url: null };
        attachments.push(item);
        (isImage ? resizeImage(file) : Promise.resolve(file))
          .then(function (blob) {
            item.blob = blob;
            item.size = blob.size;
            if (isImage) {
              item.name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
              item.url = URL.createObjectURL(blob);
            }
          })
          .catch(function () {
            attachments = attachments.filter(function (a) { return a !== item; });
            setError('files', file.name + ': 사진을 읽을 수 없어요. JPG나 PNG로 다시 올려주세요.');
          })
          .then(renderFiles);
      });
      setError('files', messages.filter(function (m, i) { return messages.indexOf(m) === i; }).join(' '));
      renderFiles();
    }

    function renderFiles() {
      fileList.innerHTML = '';
      attachments.forEach(function (item) {
        var li = document.createElement('li');
        li.className = 'file-item' + (item.blob ? '' : ' is-processing');

        var thumb = document.createElement('div');
        thumb.className = 'thumb';
        if (item.url) {
          var img = document.createElement('img');
          img.src = item.url;
          img.alt = '';
          thumb.appendChild(img);
        } else if (item.blob) {
          var badge = document.createElement('b');
          badge.textContent = 'PDF';
          thumb.appendChild(badge);
        }

        var meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = item.blob ? item.name + ' · ' + formatSize(item.size) : '처리 중…';
        meta.title = item.name;

        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'remove';
        remove.setAttribute('aria-label', item.name + ' 삭제');
        remove.textContent = '×';
        remove.addEventListener('click', function () {
          if (item.url) URL.revokeObjectURL(item.url);
          attachments = attachments.filter(function (a) { return a !== item; });
          setError('files', '');
          renderFiles();
        });

        li.appendChild(thumb);
        li.appendChild(meta);
        li.appendChild(remove);
        fileList.appendChild(li);
      });
      fileCount.textContent = attachments.length + ' / ' + MAX_FILES;
    }

    /* ---------- 요청 내용 요약 ---------- */
    function renderSummary() {
      var size = f.sizeUnknown.checked
        ? '규격 상담 필요'
        : [f.sizeW.value, f.sizeL.value, f.sizeH.value].join(' × ') + ' mm';
      var rows = [
        ['박스 종류', LABELS.boxType[f.boxType.value]],
        ['규격', size],
        ['수량', f.quantity.value],
        ['골 종류', f.flute.value],
        ['인쇄', f.printing.value || '선택 안 함'],
        ['희망 납기', f.dueDate.value || '협의'],
        ['첨부', attachments.length ? attachments.length + '개' : '없음']
      ];
      summary.innerHTML = '';
      rows.forEach(function (row) {
        var dt = document.createElement('dt');
        var dd = document.createElement('dd');
        dt.textContent = row[0];
        dd.textContent = row[1] || '-';
        summary.appendChild(dt);
        summary.appendChild(dd);
      });
    }

    /* ---------- 전송 ---------- */
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (current !== panels.length - 1) { nextBtn.click(); return; } // 입력칸에서 Enter
      if (f.website.value) return; // 스팸 봇

      var bad = validators[current]();
      if (bad) { bad.focus(); return; }

      var payload = collect();
      submitBtn.disabled = true;
      submitBtn.textContent = '보내는 중…';
      setError('submit', '');

      Promise.resolve(typeof window.submitQuote === 'function' ? window.submitQuote(payload) : null)
        .then(function () { showDone(payload); })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = '견적 요청하기';
          setError('submit', '전송하지 못했어요. 잠시 후 다시 시도하시거나 전화·카카오톡으로 문의해 주세요.');
        });
    });

    function collect() {
      return {
        receiptNo: makeReceiptNo(),
        boxType: f.boxType.value,
        size: f.sizeUnknown.checked ? null : { width: Number(f.sizeW.value), length: Number(f.sizeL.value), height: Number(f.sizeH.value) },
        quantity: f.quantity.value,
        flute: f.flute.value,
        printing: f.printing.value,
        dueDate: f.dueDate.value,
        message: f.message.value.trim(),
        company: f.company.value.trim(),
        manager: f.manager.value.trim(),
        phone: f.phone.value.trim(),
        email: f.email.value.trim(),
        reply: f.reply.value,
        attachments: attachments.map(function (a) { return { name: a.name, type: a.blob.type, blob: a.blob }; })
      };
    }

    function showDone(payload) {
      form.hidden = true;
      stepper.hidden = true;
      done.querySelector('[data-receipt]').textContent = payload.receiptNo;
      done.querySelector('[data-reply-text]').textContent = LABELS.reply[payload.reply];
      done.hidden = false;
      var top = done.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top: top });
      done.querySelector('h2').focus({ preventScroll: true });
    }

    /* ---------- 시작 ---------- */
    // contact.html?type=printed 처럼 들어오면 박스 종류를 미리 선택
    var preset = new URLSearchParams(location.search).get('type');
    if (preset && LABELS.boxType[preset]) {
      form.querySelector('input[name="boxType"][value="' + preset + '"]').checked = true;
    }
    goTo(0, false);
    renderFiles();
  }

  /* ---------- 사진 줄이기 (긴 변 1600px, JPG) ---------- */
  function resizeImage(file) {
    return loadImage(file).then(function (source) {
      var scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(source.width, source.height));
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(source.width * scale);
      canvas.height = Math.round(source.height * scale);
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      if (source.close) source.close();
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error('변환 실패')); }, 'image/jpeg', 0.85);
      });
    });
  }

  // 휴대폰 사진의 회전 정보를 반영해서 불러온다
  function loadImage(file) {
    return Promise.resolve()
      .then(function () { return createImageBitmap(file, { imageOrientation: 'from-image' }); })
      .catch(function () {
        return new Promise(function (resolve, reject) {
          var url = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
          img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('이미지 로드 실패')); };
          img.src = url;
        });
      });
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + 'KB';
    return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  }

  function makeReceiptNo() {
    var d = new Date();
    var ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return 'NG-' + ymd + '-' + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  }
})();
