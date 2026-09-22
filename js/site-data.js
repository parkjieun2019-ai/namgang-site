/* ==========================================================================
   관리자 페이지에서 바꾼 사진·연락처·납품 사례를 불러와 사이트에 반영
   · Supabase 설정이 없으면 아무것도 하지 않는다 (HTML의 기본 내용 그대로)
   · 불러오기에 실패해도 기본 내용이 그대로 보인다
   ========================================================================== */
(function () {
  'use strict';

  var config = window.SITE_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseAnonKey) return;

  var page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';

  function text(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function applyPhotos(rows) {
    var map = {};
    rows.forEach(function (r) { map[r.slot_key] = r.url; });
    (window.NAMGANG_SLOTS || []).forEach(function (slot) {
      if (!map[slot.key] || [].concat(slot.page).indexOf(page) < 0) return;
      document.querySelectorAll(slot.sel).forEach(function (img) {
        img.removeAttribute('srcset');
        img.src = map[slot.key];
      });
    });
  }

  function applySettings(row) {
    if (!row || !row.value) return;
    var v = row.value;
    ['phone', 'fax', 'email', 'kakaoChannelUrl'].forEach(function (k) {
      if (typeof v[k] === 'string') config[k] = v[k];
    });
    if (window.NamgangSite) window.NamgangSite.applyContacts();
  }

  function applyWorks(rows) {
    if (!rows.length) return;
    document.querySelectorAll('.works-grid').forEach(function (grid) {
      grid.innerHTML = rows.slice(0, 4).map(function (w) {
        return '<article class="work-card">' +
          '<div class="thumb"><img src="' + text(w.image_url) + '" alt="' + text(w.title) + '" loading="lazy"></div>' +
          '<span class="tag">' + text(w.industry) + '</span><h3>' + text(w.title) + '</h3></article>';
      }).join('');
    });
  }

  function start() {
    var site = window.NamgangSite;
    if (!site || !site.loadSupabase) return;
    site.loadSupabase().then(function (client) {
      if (!client) return;
      return Promise.all([
        client.from('photos').select('slot_key,url'),
        client.from('site_settings').select('key,value').eq('key', 'contact'),
        client.from('works').select('title,industry,image_url,sort_order').eq('published', true).order('sort_order').limit(8)
      ]).then(function (res) {
        if (res[0].data) applyPhotos(res[0].data);
        if (res[1].data) applySettings(res[1].data[0]);
        if (res[2].data) applyWorks(res[2].data.filter(function (w) { return w.image_url; }));
      });
    }).catch(function (err) {
      console.warn('사이트 데이터를 불러오지 못해 기본 내용으로 표시합니다', err);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
