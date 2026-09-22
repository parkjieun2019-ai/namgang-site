/* ==========================================================================
   남강포장 관리자 페이지
   · Supabase 설정이 있으면 로그인 후 실제 데이터를 다룬다
   · 없으면 데모 모드: 샘플 데이터, 저장 안 됨 (사진 보정은 그대로 체험 가능)
   ========================================================================== */
(function () {
  'use strict';

  var cfg = window.SITE_CONFIG || {};
  var SLOTS = window.NAMGANG_SLOTS || [];
  var P = window.ImagePipeline;
  var DEMO = !(cfg.supabaseUrl && cfg.supabaseAnonKey);
  var SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  var STATUS = { new: '새 문의', contacted: '연락함', done: '완료' };
  var REPLY = { phone: '전화', kakao: '카카오톡', email: '이메일' };

  var sb = null;
  var state = { quotes: [], works: [], photos: {}, settings: {}, filter: 'all', selectedId: null };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  var toastTimer = null;
  function toast(msg, isError) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('error', !!isError);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, isError ? 5000 : 3000);
  }
  function fail(err, fallback) {
    console.error(err);
    toast((fallback || '처리하지 못했어요.') + ' 잠시 후 다시 시도해 주세요.', true);
  }

  /* ---------- Supabase ---------- */
  function loadSupabase() {
    return new Promise(function (resolve, reject) {
      if (window.supabase) return resolve();
      var s = document.createElement('script');
      s.src = SUPABASE_JS;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Supabase 라이브러리를 불러오지 못했어요')); };
      document.head.appendChild(s);
    }).then(function () {
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      return sb;
    });
  }
  function check(res) { if (res.error) throw res.error; return res.data; }

  // 로그인한 계정이 관리자 명단(admin_users)에 있는지 확인. 없으면 로그아웃
  function verifyAdmin() {
    return sb.rpc('is_admin').then(function (res) {
      if (res.error) throw res.error;
      if (res.data === true) return;
      return sb.auth.signOut().then(function () {
        var err = new Error('관리자로 등록되지 않은 계정');
        err.notAdmin = true;
        throw err;
      });
    });
  }
  var NOT_ADMIN_MSG = '관리자로 등록되지 않은 계정이에요. 시스템 관리자에게 등록을 요청하세요.';

  /* ---------- 데모 데이터 (예시임을 이름에 표시) ---------- */
  function loadDemo() {
    var now = Date.now();
    state.quotes = [
      { id: 'd1', created_at: new Date(now - 36e5).toISOString(), receipt_no: 'NG-260922-1042', source: 'contact', box_type: '인쇄 박스', size: { width: 400, length: 300, height: 250 }, quantity: '1,000 ~ 5,000개', flute: 'B골', printing: '2도 인쇄', due_date: '2026-10-10', message: '로고를 2도로 인쇄하고 싶어요. 월 3천 개 정도 쓸 예정입니다.', company: '(예시) 한빛식품', manager: '김담당', phone: '010-1234-5678', email: 'sample@example.com', reply: 'phone', attachments: [], status: 'new', admin_memo: '' },
      { id: 'd2', created_at: new Date(now - 26e6).toISOString(), receipt_no: 'NG-260921-5310', source: 'quick', box_type: '택배·유통 박스', size: { width: '300', length: '', height: '' }, quantity: '2,000개', message: '쇼핑몰 택배용입니다.', company: '(예시) 바른생활몰', phone: '010-9876-5432', reply: 'phone', attachments: [], status: 'contacted', admin_memo: '9/21 통화, 샘플 발송 예정' },
      { id: 'd3', created_at: new Date(now - 2e8).toISOString(), receipt_no: 'NG-260919-0077', source: 'contact', box_type: '맞춤·특수 박스', size: null, quantity: '100 ~ 500개', flute: '이중골(BB/AB)', printing: '무인쇄', message: '부품 포장용 중량물 박스 상담 원합니다.', company: '(예시) 대성정밀', manager: '이과장', phone: '031-000-0000', email: '', reply: 'email', attachments: [], status: 'done', admin_memo: '견적 발송 완료' }
    ];
    state.works = [
      { id: 'w1', title: '유통센터 출고용 박스', industry: '물류·유통', description: '', image_url: 'https://images.unsplash.com/photo-1709804945989-c8be542e04db?auto=format&fit=crop&w=600&q=70', sort_order: 1, published: true },
      { id: 'w2', title: '택배 발송용 박스', industry: '온라인 쇼핑몰', description: '', image_url: 'https://images.unsplash.com/photo-1573376671096-e1fce2d1f19d?auto=format&fit=crop&w=600&q=70', sort_order: 2, published: true },
      { id: 'w3', title: '농산물 선물 박스', industry: '식품·농산물', description: '', image_url: 'https://images.unsplash.com/photo-1630448927918-1dbcd8ba439b?auto=format&fit=crop&w=600&q=70', sort_order: 3, published: true },
      { id: 'w4', title: '부품 대량 포장 박스', industry: '제조·부품', description: '', image_url: 'https://images.unsplash.com/photo-1701849473471-666bf2b0158e?auto=format&fit=crop&w=600&q=70', sort_order: 4, published: true }
    ];
    state.settings = { phone: cfg.phone || '', fax: cfg.fax || '', email: cfg.email || '', kakaoChannelUrl: cfg.kakaoChannelUrl || '' };
    state.photos = {};
  }

  /* ---------- 불러오기 ---------- */
  function loadAll() {
    return Promise.all([
      sb.from('quotes').select('*').order('created_at', { ascending: false }).limit(300).then(check),
      sb.from('works').select('*').order('sort_order').then(check),
      sb.from('photos').select('slot_key,url,updated_at').then(check),
      sb.from('site_settings').select('key,value').eq('key', 'contact').then(check)
    ]).then(function (r) {
      state.quotes = r[0] || [];
      state.works = r[1] || [];
      state.photos = {};
      (r[2] || []).forEach(function (p) { state.photos[p.slot_key] = p; });
      var saved = (r[3] && r[3][0] && r[3][0].value) || {};
      state.settings = {
        phone: saved.phone != null ? saved.phone : (cfg.phone || ''),
        fax: saved.fax != null ? saved.fax : (cfg.fax || ''),
        email: saved.email != null ? saved.email : (cfg.email || ''),
        kakaoChannelUrl: saved.kakaoChannelUrl != null ? saved.kakaoChannelUrl : (cfg.kakaoChannelUrl || '')
      };
    });
  }

  /* ---------- 화면 전환 ---------- */
  function showLogin() { $('#loginView').hidden = false; $('#shellView').hidden = true; setTimeout(function () { $('#loginEmail').focus(); }, 0); }
  function showShell() {
    $('#loginView').hidden = true;
    $('#shellView').hidden = false;
    var badge = $('#modeBadge');
    badge.textContent = DEMO ? '데모 모드' : '온라인';
    badge.classList.toggle('demo', DEMO);
    $('#demoBanner').hidden = !DEMO;
    $('#logoutBtn').hidden = DEMO;
    renderAll();
  }
  function renderAll() { renderQuotes(); renderDetail(); renderPhotos(); renderWorks(); renderSettings(); }

  $$('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      $$('.tab').forEach(function (t) { t.setAttribute('aria-selected', String(t === tab)); });
      $$('.panel').forEach(function (p) { p.hidden = p.dataset.panel !== tab.dataset.tab; });
    });
  });

  /* ---------- 로그인 ---------- */
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('#loginEmail').value.trim(), pw = $('#loginPw').value;
    var errEl = $('#loginErr');
    if (!email || !pw) { errEl.textContent = '이메일과 비밀번호를 입력해 주세요.'; return; }
    var btn = $('#loginBtn');
    btn.disabled = true; btn.textContent = '로그인 중…'; errEl.textContent = '';
    sb.auth.signInWithPassword({ email: email, password: pw }).then(function (res) {
      if (res.error) throw res.error;
      return verifyAdmin().then(loadAll).then(showShell);
    }).catch(function (err) {
      console.warn(err);
      errEl.textContent = err.notAdmin ? NOT_ADMIN_MSG
        : /invalid/i.test(err.message || '') ? '이메일 또는 비밀번호가 맞지 않아요.' : '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.';
    }).then(function () { btn.disabled = false; btn.textContent = '로그인'; });
  });
  $('#logoutBtn').addEventListener('click', function () {
    if (!sb) return;
    sb.auth.signOut().then(function () { location.reload(); });
  });

  /* ---------- 견적 문의함 ---------- */
  function sizeText(s) {
    if (!s || !(s.width || s.length || s.height)) return '상담 필요';
    return [s.width, s.length, s.height].map(function (v) { return v || '?'; }).join(' × ') + ' mm';
  }
  function renderQuotes() {
    var newCount = state.quotes.filter(function (q) { return q.status === 'new'; }).length;
    var badge = $('#newBadge');
    badge.textContent = newCount;
    badge.hidden = !newCount;
    var list = state.quotes.filter(function (q) { return state.filter === 'all' || q.status === state.filter; });
    var ul = $('#quoteList');
    if (!list.length) { ul.innerHTML = '<li class="empty">' + (state.quotes.length ? '이 상태의 문의가 없어요.' : '아직 접수된 문의가 없어요.') + '</li>'; return; }
    ul.innerHTML = list.map(function (q) {
      return '<li class="q-item' + (q.id === state.selectedId ? ' is-active' : '') + '"><button type="button" data-id="' + esc(q.id) + '">' +
        '<span class="q-row1"><span class="pill ' + esc(q.status) + '">' + esc(STATUS[q.status] || q.status) + '</span>' +
        '<span class="q-company">' + esc(q.company) + '</span><span class="q-date">' + esc(fmtDate(q.created_at)) + '</span></span>' +
        '<span class="q-meta">' + esc([q.box_type, q.quantity].filter(Boolean).join(' · ') || '내용 없음') + (q.source === 'quick' ? ' · 빠른 견적' : '') + '</span>' +
        '</button></li>';
    }).join('');
  }
  $('#quoteList').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-id]');
    if (!b) return;
    state.selectedId = b.dataset.id;
    renderQuotes();
    renderDetail();
    if (window.matchMedia('(max-width: 860px)').matches) $('#quoteDetail').scrollIntoView({ behavior: 'smooth' });
  });
  $$('.filters .chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      state.filter = chip.dataset.filter;
      $$('.filters .chip').forEach(function (c) { c.classList.toggle('is-on', c === chip); });
      renderQuotes();
    });
  });

  function renderDetail() {
    var box = $('#quoteDetail');
    var q = state.quotes.filter(function (x) { return x.id === state.selectedId; })[0];
    if (!q) { box.innerHTML = '<p class="empty">왼쪽 목록에서 문의를 선택하세요.</p>'; return; }
    var tel = String(q.phone || '').replace(/[^0-9+]/g, '');
    var rows = [
      ['담당자', q.manager], ['연락처', q.phone], ['이메일', q.email], ['회신 방법', REPLY[q.reply] || q.reply],
      ['박스 종류', q.box_type], ['규격', sizeText(q.size)], ['수량', q.quantity], ['골 종류', q.flute],
      ['인쇄', q.printing], ['희망 납기', q.due_date], ['요청사항', q.message]
    ].filter(function (r) { return r[1]; });
    box.innerHTML =
      '<div class="d-head"><div><h2>' + esc(q.company) + '</h2><p>접수번호 ' + esc(q.receipt_no) + ' · ' + esc(fmtDate(q.created_at)) + (q.source === 'quick' ? ' · 메인 빠른 견적' : '') + '</p></div>' +
      '<div class="d-actions">' + (tel ? '<a class="btn accent" href="tel:' + esc(tel) + '">전화 걸기</a>' : '') +
      (q.email ? '<a class="btn" href="mailto:' + esc(q.email) + '?subject=' + encodeURIComponent('[남강포장] 견적 회신 (' + q.receipt_no + ')') + '">메일 보내기</a>' : '') + '</div></div>' +
      '<dl class="d-grid">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' +
      '<div class="d-block"><h3>첨부 파일</h3><div class="attach" id="attachList">' + (q.attachments && q.attachments.length ? '<span class="q-meta">불러오는 중…</span>' : '<span class="q-meta">없음</span>') + '</div></div>' +
      '<div class="d-block"><h3>처리 상태</h3><div class="status-set" role="group" aria-label="처리 상태">' +
      Object.keys(STATUS).map(function (k) { return '<button type="button" data-status="' + k + '" aria-pressed="' + (q.status === k) + '">' + STATUS[k] + '</button>'; }).join('') + '</div></div>' +
      '<div class="d-block memo"><h3>메모 <small class="q-meta">관리자만 보여요</small></h3><textarea id="memoInput" placeholder="통화 내용, 견적 금액 등">' + esc(q.admin_memo || '') + '</textarea><button type="button" class="btn" id="memoSave">메모 저장</button></div>';

    $$('.status-set button', box).forEach(function (b) {
      b.addEventListener('click', function () { updateQuote(q, { status: b.dataset.status }, '상태를 바꿨어요.'); });
    });
    $('#memoSave', box).addEventListener('click', function () {
      updateQuote(q, { admin_memo: $('#memoInput', box).value }, '메모를 저장했어요.');
    });
    loadAttachments(q);
  }

  function loadAttachments(q) {
    var wrap = $('#attachList');
    if (!q.attachments || !q.attachments.length || DEMO || !wrap) return;
    sb.storage.from('quote-attachments').createSignedUrls(q.attachments, 3600).then(function (res) {
      if (res.error) throw res.error;
      wrap.innerHTML = res.data.map(function (f, i) {
        var name = q.attachments[i].split('/').pop();
        var isImg = /\.(jpe?g|png|webp)$/i.test(name);
        return '<a href="' + esc(f.signedUrl) + '" target="_blank" rel="noopener">' +
          (isImg ? '<img src="' + esc(f.signedUrl) + '" alt="' + esc(name) + '">' : '<span class="file">' + esc(name) + '<br>(열기)</span>') + '</a>';
      }).join('');
    }).catch(function (err) { console.warn(err); wrap.innerHTML = '<span class="err">첨부 파일을 불러오지 못했어요.</span>'; });
  }

  function updateQuote(q, patch, okMsg) {
    var apply = function () { Object.assign(q, patch); renderQuotes(); renderDetail(); toast(okMsg + (DEMO ? ' (데모: 저장 안 됨)' : '')); };
    if (DEMO) return apply();
    sb.from('quotes').update(patch).eq('id', q.id).then(check).then(apply).catch(function (e) { fail(e, '저장하지 못했어요.'); });
  }

  /* ---------- 사진 관리 ---------- */
  function renderPhotos() {
    var groups = [];
    SLOTS.forEach(function (s) {
      var g = groups.filter(function (x) { return x.name === s.group; })[0];
      if (!g) { g = { name: s.group, slots: [] }; groups.push(g); }
      g.slots.push(s);
    });
    $('#slotGroups').innerHTML = groups.map(function (g) {
      return '<section class="slot-group"><h2>' + esc(g.name) + '</h2><div class="slot-grid">' + g.slots.map(function (s) {
        var cur = state.photos[s.key];
        var ratioText = ratioLabel(s.ratio);
        return '<article class="slot"><div class="slot-thumb" style="aspect-ratio:' + s.ratio + '">' +
          (cur ? '<img src="' + esc(cur.url) + '" alt="">' : '기본 사진 사용 중') + '</div>' +
          '<div class="slot-body"><span class="slot-title">' + esc(s.label) + '</span>' +
          '<span class="slot-meta' + (cur ? ' custom' : '') + '">' + (cur ? '직접 올린 사진' + (cur.updated_at ? ' · ' + esc(fmtDate(cur.updated_at)) : '') : ratioText + ' · 가로 ' + s.width + 'px') + '</span>' +
          '<div class="slot-actions"><button type="button" class="btn" data-slot="' + esc(s.key) + '">사진 바꾸기</button>' +
          (cur ? '<button type="button" class="btn ghost" data-revert="' + esc(s.key) + '">기본으로</button>' : '') + '</div></div></article>';
      }).join('') + '</div></section>';
    }).join('');
  }
  function ratioLabel(r) {
    var known = [[16 / 9, '가로 16:9'], [4 / 3, '가로 4:3'], [3 / 2, '가로 3:2'], [1, '정사각 1:1'], [3 / 4, '세로 3:4'], [4 / 5, '세로 4:5']];
    for (var i = 0; i < known.length; i++) if (Math.abs(known[i][0] - r) < 0.01) return known[i][1];
    return '비율 ' + r.toFixed(2);
  }
  $('#slotGroups').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.slot) {
      var slot = SLOTS.filter(function (s) { return s.key === b.dataset.slot; })[0];
      openEditor({ mode: 'slot', slot: slot, title: slot.group + ' · ' + slot.label, ratio: slot.ratio, width: slot.width });
    }
    if (b.dataset.revert) {
      if (!confirm('이 자리를 기본 사진으로 되돌릴까요?')) return;
      var key = b.dataset.revert;
      var done = function () { delete state.photos[key]; renderPhotos(); toast('기본 사진으로 되돌렸어요.' + (DEMO ? ' (데모: 저장 안 됨)' : '')); };
      if (DEMO) return done();
      sb.from('photos').delete().eq('slot_key', key).then(check).then(done).catch(function (err) { fail(err, '되돌리지 못했어요.'); });
    }
  });

  /* ---------- 사진 편집 창 ---------- */
  var ed = { ctx: null, src: null, stats: null, zoom: 1, cx: 0.5, cy: 0.5, strength: 0.6, rendering: false, pending: false };
  var dlg = $('#editor');

  function openEditor(ctx) {
    ed = { ctx: ctx, src: null, stats: null, zoom: 1, cx: 0.5, cy: 0.5, strength: 0.6, rendering: false, pending: false };
    $('#editorTitle').textContent = ctx.mode === 'work' ? (ctx.work ? '납품 사례 수정' : '납품 사례 추가') : '사진 바꾸기';
    $('#editorSub').textContent = ctx.title + ' · ' + ratioLabel(ctx.ratio) + ', 가로 최대 ' + ctx.width + 'px로 저장';
    $('#pickArea').hidden = false;
    $('#compareArea').hidden = true;
    $('#controlsArea').hidden = true;
    $('#editorReset').hidden = true;
    $('#zoomRange').value = 1; $('#zoomOut').textContent = '1.0×';
    $('#toneRange').value = 60; $('#toneOut').textContent = '60%';
    $('#editorFile').value = '';
    var isWork = ctx.mode === 'work';
    $('#workFields').hidden = !isWork;
    if (isWork) {
      var w = ctx.work || {};
      $('#workTitle').value = w.title || '';
      $('#workIndustry').value = w.industry || '';
      $('#workDesc').value = w.description || '';
      $('#workPublished').checked = w.published !== false;
      $('[data-err="title"]').textContent = '';
    }
    $('#editorApply').textContent = isWork ? '저장' : '사이트에 반영';
    $('#editorApply').disabled = !(isWork && ctx.work);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function closeEditor() { if (dlg.open) dlg.close(); }
  $('#editorClose').addEventListener('click', closeEditor);
  $('#editorCancel').addEventListener('click', closeEditor);
  $('#editorReset').addEventListener('click', function () {
    ed.src = null;
    $('#pickArea').hidden = false; $('#compareArea').hidden = true; $('#controlsArea').hidden = true; $('#editorReset').hidden = true;
    $('#editorApply').disabled = !(ed.ctx.mode === 'work' && ed.ctx.work);
  });

  var dz = $('#pickArea .dropzone');
  ['dragenter', 'dragover'].forEach(function (t) { dz.addEventListener(t, function (e) { e.preventDefault(); dz.classList.add('is-over'); }); });
  ['dragleave', 'drop'].forEach(function (t) { dz.addEventListener(t, function (e) { e.preventDefault(); dz.classList.remove('is-over'); }); });
  dz.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) useFile(e.dataTransfer.files[0]); });
  $('#editorFile').addEventListener('change', function () { if (this.files[0]) useFile(this.files[0]); });

  function useFile(file) {
    if (!/^image\//.test(file.type)) { toast('사진 파일만 올릴 수 있어요.', true); return; }
    P.load(file).then(function (src) {
      ed.src = src;
      ed.stats = P.analyze(src);
      ed.zoom = 1; ed.cx = 0.5; ed.cy = 0.5;
      var d = P.dims(src);
      $('#pickArea').hidden = true;
      $('#compareArea').hidden = false;
      $('#controlsArea').hidden = false;
      $('#editorReset').hidden = false;
      $('#editorApply').disabled = false;
      var crop = P.cropRect(src, ed.ctx.ratio, 1, 0.5, 0.5);
      var outW = Math.round(Math.min(ed.ctx.width, crop.w));
      $('#stepInfo').textContent = '원본 ' + d.w + '×' + d.h + 'px → 회전 보정 · ' + ratioLabel(ed.ctx.ratio) + ' 자르기 · 밝기/색 자동 보정 · 크라프트 톤 · 가로 ' + outW + 'px WebP' +
        (crop.w < ed.ctx.width ? ' (원본이 작아 ' + ed.ctx.width + 'px보다 작게 저장돼요)' : '');
      drawBefore();
      drawAfter();
    }).catch(function (err) { toast(err.message || '사진을 읽을 수 없어요.', true); });
  }

  function drawBefore() {
    var c = $('#beforeCanvas'), d = P.dims(ed.src);
    var w = Math.min(420, d.w), h = Math.round(w * d.h / d.w);
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(ed.src, 0, 0, w, h);
  }
  function drawAfter() {
    if (ed.rendering) { ed.pending = true; return; }
    ed.rendering = true;
    requestAnimationFrame(function () {
      var c = $('#afterCanvas');
      var w = 720, h = Math.round(w / ed.ctx.ratio);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      var r = P.render(ed.src, { ratio: ed.ctx.ratio, zoom: ed.zoom, cx: ed.cx, cy: ed.cy, strength: ed.strength, stats: ed.stats }, c);
      ed.cx = r.cx; ed.cy = r.cy;
      ed.rendering = false;
      if (ed.pending) { ed.pending = false; drawAfter(); }
    });
  }
  $('#zoomRange').addEventListener('input', function () { ed.zoom = +this.value; $('#zoomOut').textContent = ed.zoom.toFixed(1) + '×'; if (ed.src) drawAfter(); });
  $('#toneRange').addEventListener('input', function () { ed.strength = this.value / 100; $('#toneOut').textContent = this.value + '%'; if (ed.src) drawAfter(); });

  // 미리보기를 끌어서 자를 위치 조정 (마우스·터치)
  var drag = null, after = $('#afterCanvas');
  after.addEventListener('pointerdown', function (e) {
    if (!ed.src) return;
    drag = { x: e.clientX, y: e.clientY, cx: ed.cx, cy: ed.cy };
    after.setPointerCapture(e.pointerId);
    after.classList.add('dragging');
  });
  after.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var rect = after.getBoundingClientRect(), d = P.dims(ed.src);
    var crop = P.cropRect(ed.src, ed.ctx.ratio, ed.zoom, drag.cx, drag.cy);
    ed.cx = drag.cx - (e.clientX - drag.x) / rect.width * crop.w / d.w;
    ed.cy = drag.cy - (e.clientY - drag.y) / rect.height * crop.h / d.h;
    drawAfter();
  });
  function endDrag() { drag = null; after.classList.remove('dragging'); }
  after.addEventListener('pointerup', endDrag);
  after.addEventListener('pointercancel', endDrag);
  after.addEventListener('keydown', function (e) {
    if (!ed.src) return;
    var step = 0.02, map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!map[e.key]) return;
    e.preventDefault();
    ed.cx += map[e.key][0]; ed.cy += map[e.key][1];
    drawAfter();
  });

  function uploadImage(folder, name, out) {
    var path = folder + '/' + name + '-' + Date.now() + '.' + out.ext;
    return sb.storage.from('site-images').upload(path, out.blob, { contentType: out.type, upsert: false }).then(function (res) {
      if (res.error) throw res.error;
      return sb.storage.from('site-images').getPublicUrl(path).data.publicUrl;
    });
  }

  $('#editorApply').addEventListener('click', function () {
    var ctx = ed.ctx, btn = this;
    if (ctx.mode === 'work' && !$('#workTitle').value.trim()) { $('[data-err="title"]').textContent = '제목을 입력해 주세요.'; $('#workTitle').focus(); return; }
    btn.disabled = true;
    var label = btn.textContent;
    btn.textContent = '저장 중…';
    var imageStep = ed.src
      ? P.exportImage(ed.src, { ratio: ctx.ratio, zoom: ed.zoom, cx: ed.cx, cy: ed.cy, strength: ed.strength, stats: ed.stats, outWidth: ctx.width })
      : Promise.resolve(null);
    imageStep.then(function (out) {
      if (ctx.mode === 'slot') return saveSlot(ctx.slot, out);
      return saveWork(ctx.work, out);
    }).then(function () { closeEditor(); })
      .catch(function (err) { fail(err, '저장하지 못했어요.'); })
      .then(function () { btn.disabled = false; btn.textContent = label; });
  });

  function saveSlot(slot, out) {
    var info = ' (' + out.width + '×' + out.height + ', ' + Math.round(out.blob.size / 1024) + 'KB)';
    if (DEMO) {
      state.photos[slot.key] = { url: URL.createObjectURL(out.blob), updated_at: new Date().toISOString() };
      renderPhotos();
      toast('보정된 사진을 만들었어요' + info + ' — 데모라 사이트에는 반영되지 않아요.');
      return Promise.resolve();
    }
    return uploadImage('slots', slot.key, out).then(function (url) {
      var row = { slot_key: slot.key, url: url, updated_at: new Date().toISOString() };
      return sb.from('photos').upsert(row).then(check).then(function () {
        state.photos[slot.key] = row;
        renderPhotos();
        toast('사이트에 반영했어요' + info + '. 방문자는 새로고침하면 보여요.');
      });
    });
  }

  /* ---------- 납품 사례 ---------- */
  function renderWorks() {
    var ul = $('#workList');
    if (!state.works.length) { ul.innerHTML = '<li class="empty">아직 등록된 사례가 없어요. 사례가 없으면 사이트에는 기본 사진이 보여요.</li>'; return; }
    ul.innerHTML = state.works.map(function (w, i) {
      return '<li class="work"><img src="' + esc(w.image_url || '') + '" alt="">' +
        '<div class="work-info"><strong>' + esc(w.title) + (w.published ? '' : '<span class="hidden-tag">숨김</span>') + '</strong><span>' + esc(w.industry || '업종 없음') + '</span></div>' +
        '<div class="work-actions">' +
        '<button type="button" class="btn ghost" data-move="' + i + '" data-dir="-1" aria-label="위로" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
        '<button type="button" class="btn ghost" data-move="' + i + '" data-dir="1" aria-label="아래로" ' + (i === state.works.length - 1 ? 'disabled' : '') + '>↓</button>' +
        '<button type="button" class="btn" data-edit="' + i + '">수정</button>' +
        '<button type="button" class="btn danger" data-del="' + i + '">삭제</button></div></li>';
    }).join('');
  }
  $('#addWorkBtn').addEventListener('click', function () { openEditor({ mode: 'work', work: null, title: '납품 사례', ratio: 1, width: 900 }); });
  $('#workList').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.edit) { var w = state.works[+b.dataset.edit]; openEditor({ mode: 'work', work: w, title: w.title, ratio: 1, width: 900 }); }
    if (b.dataset.del) {
      var target = state.works[+b.dataset.del];
      if (!confirm('"' + target.title + '" 사례를 삭제할까요?')) return;
      var done = function () { state.works.splice(+b.dataset.del, 1); renderWorks(); toast('삭제했어요.' + (DEMO ? ' (데모: 저장 안 됨)' : '')); };
      if (DEMO) return done();
      sb.from('works').delete().eq('id', target.id).then(check).then(done).catch(function (err) { fail(err, '삭제하지 못했어요.'); });
    }
    if (b.dataset.move) moveWork(+b.dataset.move, +b.dataset.dir);
  });
  function moveWork(i, dir) {
    var j = i + dir, a = state.works[i], c = state.works[j];
    if (!c) return;
    var sa = a.sort_order, sc = c.sort_order;
    if (sa === sc) { sa = i; sc = j; }
    var done = function () { a.sort_order = sc; c.sort_order = sa; state.works[i] = c; state.works[j] = a; renderWorks(); };
    if (DEMO) return done();
    Promise.all([
      sb.from('works').update({ sort_order: sc }).eq('id', a.id).then(check),
      sb.from('works').update({ sort_order: sa }).eq('id', c.id).then(check)
    ]).then(done).catch(function (err) { fail(err, '순서를 바꾸지 못했어요.'); });
  }
  function saveWork(work, out) {
    var fields = {
      title: $('#workTitle').value.trim(),
      industry: $('#workIndustry').value.trim(),
      description: $('#workDesc').value.trim(),
      published: $('#workPublished').checked
    };
    if (!work && !out) return Promise.reject(new Error('사진을 선택해 주세요.'));
    if (DEMO) {
      if (out) fields.image_url = URL.createObjectURL(out.blob);
      if (work) Object.assign(work, fields);
      else state.works.push(Object.assign({ id: 'w' + Date.now(), sort_order: state.works.length + 1 }, fields));
      renderWorks();
      toast('사례를 저장했어요. (데모: 저장 안 됨)');
      return Promise.resolve();
    }
    var withImage = out ? uploadImage('works', 'work', out).then(function (url) { fields.image_url = url; }) : Promise.resolve();
    return withImage.then(function () {
      if (work) return sb.from('works').update(fields).eq('id', work.id).select().then(check);
      var maxOrder = state.works.reduce(function (m, w) { return Math.max(m, w.sort_order || 0); }, 0);
      fields.sort_order = maxOrder + 1;
      return sb.from('works').insert(fields).select().then(check);
    }).then(function (rows) {
      var saved = rows && rows[0];
      if (work) Object.assign(work, saved || fields);
      else state.works.push(saved || fields);
      renderWorks();
      toast('사례를 저장했어요. 사이트에는 새로고침하면 보여요.');
    });
  }

  /* ---------- 연락처 ---------- */
  function renderSettings() {
    $('#setPhone').value = state.settings.phone || '';
    $('#setFax').value = state.settings.fax || '';
    $('#setEmail').value = state.settings.email || '';
    $('#setKakao').value = state.settings.kakaoChannelUrl || '';
  }
  $('#settingsForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = {
      phone: $('#setPhone').value.trim(),
      fax: $('#setFax').value.trim(),
      email: $('#setEmail').value.trim(),
      kakaoChannelUrl: $('#setKakao').value.trim()
    };
    var errs = {
      phone: v.phone.replace(/[^0-9]/g, '').length >= 9 ? '' : '전화번호를 확인해 주세요.',
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) ? '' : '이메일 주소를 확인해 주세요.',
      kakao: !v.kakaoChannelUrl || /^https:\/\/pf\.kakao\.com\//.test(v.kakaoChannelUrl) ? '' : 'https://pf.kakao.com/ 으로 시작하는 채널 주소를 넣어 주세요.'
    };
    Object.keys(errs).forEach(function (k) { $('[data-err="' + k + '"]').textContent = errs[k]; });
    if (errs.phone || errs.email || errs.kakao) return;
    var done = function () { state.settings = v; toast('연락처를 저장했어요.' + (DEMO ? ' (데모: 저장 안 됨)' : ' 사이트에는 새로고침하면 반영돼요.')); };
    if (DEMO) return done();
    sb.from('site_settings').upsert({ key: 'contact', value: v, updated_at: new Date().toISOString() }).then(check).then(done)
      .catch(function (err) { fail(err, '저장하지 못했어요.'); });
  });

  /* ---------- 시작 ---------- */
  if (DEMO) { loadDemo(); showShell(); return; }
  loadSupabase().then(function () { return sb.auth.getSession(); }).then(function (res) {
    if (res.data && res.data.session) return verifyAdmin().then(loadAll).then(showShell);
    showLogin();
  }).catch(function (err) {
    console.error(err);
    showLogin();
    $('#loginErr').textContent = err.notAdmin ? NOT_ADMIN_MSG : '관리자 서버에 연결하지 못했어요. 잠시 후 새로고침해 주세요.';
  });
})();
