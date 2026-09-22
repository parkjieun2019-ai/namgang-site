/* ==========================================================================
   사진 자동 보정 (브라우저 Canvas에서 처리 — 서버로 보내기 전에 끝남)
   1) 휴대폰 사진 회전 바로잡기  2) 자리 비율로 자르기(위치·확대 조정)
   3) 밝기·대비 자동(상하 1% 기준) + 색 틀어짐 약하게 보정
   4) 브랜드 톤: 채도 약간↓, 따뜻한 크라프트 색감, 부드러운 S커브, 약한 비네팅 (강도 조절)
   5) WebP(품질 0.82)로 저장 — 다시 인코딩하므로 GPS 등 위치정보는 남지 않음
   ========================================================================== */
(function () {
  'use strict';

  function load(file) {
    return Promise.resolve()
      .then(function () { return createImageBitmap(file, { imageOrientation: 'from-image' }); })
      .catch(function () {
        return new Promise(function (resolve, reject) {
          var url = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
          img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('사진을 읽을 수 없어요. JPG나 PNG로 다시 올려주세요.')); };
          img.src = url;
        });
      });
  }

  function dims(src) {
    return { w: src.naturalWidth || src.width, h: src.naturalHeight || src.height };
  }

  // 자를 영역 계산: ratio(가로/세로), zoom(1 이상), cx·cy(원본 기준 중심 0~1)
  function cropRect(src, ratio, zoom, cx, cy) {
    var d = dims(src);
    var cw = Math.min(d.w, d.h * ratio) / zoom;
    var ch = cw / ratio;
    var x = Math.max(0, Math.min(d.w - cw, cx * d.w - cw / 2));
    var y = Math.max(0, Math.min(d.h - ch, cy * d.h - ch / 2));
    return { x: x, y: y, w: cw, h: ch, cx: (x + cw / 2) / d.w, cy: (y + ch / 2) / d.h };
  }

  // 작게 줄인 사진으로 밝기 분포와 색 틀어짐을 한 번만 계산
  function analyze(src) {
    var d = dims(src);
    var w = 256, h = Math.max(1, Math.round(256 * d.h / d.w));
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0, w, h);
    var p = ctx.getImageData(0, 0, w, h).data;
    var hist = new Uint32Array(256), sr = 0, sg = 0, sb = 0, n = 0;
    for (var i = 0; i < p.length; i += 4) {
      hist[(p[i] * 0.2126 + p[i + 1] * 0.7152 + p[i + 2] * 0.0722) | 0]++;
      sr += p[i]; sg += p[i + 1]; sb += p[i + 2]; n++;
    }
    function pick(q) {
      var acc = 0, target = n * q;
      for (var v = 0; v < 256; v++) { acc += hist[v]; if (acc >= target) return v; }
      return 255;
    }
    // 보정 한도: 검은 기준은 12 이하(그림자 뭉개짐 방지), 흰 기준은 200 이상에서만 움직인다
    // (가장 밝은 부분이 중간 밝기인 사진을 억지로 흰색까지 늘려 하얗게 날리지 않게)
    var lo = Math.min(pick(0.005), 12), hi = Math.max(pick(0.995), 200);
    // 중간 밝기: 어두운 사진은 평균이 목표(약 46%)에 가까워지도록 올리고, 밝은 사진은 거의 그대로
    var sum = 0;
    for (var v = 0; v < 256; v++) sum += hist[v] * Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    var meanN = Math.max(0.02, sum / n);
    var gamma = Math.max(0.6, Math.min(1.1, Math.log(0.46) / Math.log(meanN)));
    // 색 틀어짐은 약하게만 (공장의 따뜻한 색감은 살린다)
    var mr = sr / n || 1, mg = sg / n || 1, mb = sb / n || 1, avg = (mr + mg + mb) / 3;
    function lim(x) { return Math.max(0.94, Math.min(1.06, x)); }
    return { lo: lo, hi: hi, gamma: gamma, gains: [lim(1 + (avg / mr - 1) * 0.35), lim(1 + (avg / mg - 1) * 0.35), lim(1 + (avg / mb - 1) * 0.35)] };
  }

  function buildLut(stats, s) {
    var luts = [new Uint8ClampedArray(256), new Uint8ClampedArray(256), new Uint8ClampedArray(256)];
    var warm = [1 + 0.05 * s, 1 + 0.01 * s, 1 - 0.06 * s];
    var k = 1 + 0.10 * s;
    var gamma = stats.gamma || 1;
    for (var ch = 0; ch < 3; ch++) {
      for (var v = 0; v < 256; v++) {
        var x = (v * stats.gains[ch] - stats.lo) / (stats.hi - stats.lo);
        x = Math.pow(Math.max(0, Math.min(1, x)), gamma);
        x = x < 0.5 ? 0.5 * Math.pow(2 * x, k) : 1 - 0.5 * Math.pow(2 * (1 - x), k);
        luts[ch][v] = x * 255 * warm[ch];
      }
    }
    return luts;
  }

  // opts: { ratio, zoom, cx, cy, strength(0~1), stats }  → canvas 크기에 맞춰 그림
  function render(src, opts, canvas) {
    var r = cropRect(src, opts.ratio, opts.zoom, opts.cx, opts.cy);
    var W = canvas.width, H = canvas.height;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, W, H);
    var img = ctx.getImageData(0, 0, W, H), p = img.data;
    var s = opts.strength, luts = buildLut(opts.stats, s), sat = 1 - 0.12 * s, vig = 0.14 * s;
    for (var y = 0; y < H; y++) {
      var dy = (y / Math.max(1, H - 1) - 0.5) * 2;
      for (var x = 0; x < W; x++) {
        var i = (y * W + x) * 4;
        var R = luts[0][p[i]], G = luts[1][p[i + 1]], B = luts[2][p[i + 2]];
        var L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
        R = L + (R - L) * sat; G = L + (G - L) * sat; B = L + (B - L) * sat;
        if (vig) {
          var dx = (x / Math.max(1, W - 1) - 0.5) * 2;
          var f = 1 - vig * Math.min(1, (dx * dx + dy * dy) / 2);
          R *= f; G *= f; B *= f;
        }
        p[i] = R; p[i + 1] = G; p[i + 2] = B;
      }
    }
    ctx.putImageData(img, 0, 0);
    return r;
  }

  // 최종 저장본: 원본보다 크게 늘리지 않음
  function exportImage(src, opts) {
    var r = cropRect(src, opts.ratio, opts.zoom, opts.cx, opts.cy);
    var outW = Math.max(1, Math.round(Math.min(opts.outWidth, r.w)));
    var outH = Math.max(1, Math.round(outW / opts.ratio));
    var c = document.createElement('canvas');
    c.width = outW; c.height = outH;
    render(src, opts, c);
    return new Promise(function (resolve, reject) {
      c.toBlob(function (b) {
        if (b && b.type === 'image/webp') return resolve({ blob: b, width: outW, height: outH, type: 'image/webp', ext: 'webp' });
        c.toBlob(function (j) {
          if (!j) return reject(new Error('사진을 저장하지 못했어요.'));
          resolve({ blob: j, width: outW, height: outH, type: 'image/jpeg', ext: 'jpg' });
        }, 'image/jpeg', 0.86);
      }, 'image/webp', 0.82);
    });
  }

  window.ImagePipeline = { load: load, dims: dims, cropRect: cropRect, analyze: analyze, render: render, exportImage: exportImage };
})();
