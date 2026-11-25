/**
 * Dismissible floating invite banner for HọcTA Android Closed Testing (Google Play).
 * - Automatically hidden inside installed PWA / Android TWA (standalone/fullscreen/android-app referrer).
 * - Respects user dismissal via localStorage.
 * - Opens a 2-step modal (1: join Google Group -> 2: opt-in & install from Play Store).
 * - Self-contained so it can be removed or switched to the public Play Store link once live.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'hocta_android_beta_dismissed_v1';
  var GROUP_URL = 'https://groups.google.com/g/hocta-testers';
  var TESTING_URL = 'https://play.google.com/apps/testing/vn.hocta.app';

  // Never show inside the installed Android TWA or standalone PWA.
  var isStandalone =
    (window.matchMedia &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches)) ||
    window.navigator.standalone === true ||
    (document.referrer && document.referrer.indexOf('android-app://') === 0);

  if (isStandalone) return;

  try {
    if (window.localStorage && window.localStorage.getItem(STORAGE_KEY) === '1') {
      return;
    }
  } catch (_) {}

  function init() {
    if (!document.body || document.getElementById('hocta-android-beta-host')) return;

    var host = document.createElement('div');
    host.id = 'hocta-android-beta-host';
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

    root.innerHTML = [
      '<style>',
      ':host{all:initial;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}',
      '.banner{',
      '  position:fixed;right:16px;bottom:16px;z-index:9990;',
      '  display:flex;align-items:center;gap:12px;',
      '  max-width:420px;padding:12px 14px;border-radius:16px;',
      '  background:#ffffff;color:#17253b;',
      '  border:1px solid rgba(41,60,200,0.18);',
      '  box-shadow:0 10px 30px rgba(23,37,59,0.16),0 2px 6px rgba(23,37,59,0.08);',
      '  box-sizing:border-box;line-height:1.4;',
      '  animation:hb-in .28s ease-out both;',
      '}',
      '@keyframes hb-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}',
      '.badge{',
      '  flex:0 0 38px;width:38px;height:38px;border-radius:11px;',
      '  background:#293cc8;color:#fff;display:flex;align-items:center;justify-content:center;',
      '}',
      '.copy{flex:1 1 auto;min-width:0;}',
      '.title{font-size:13.5px;font-weight:700;color:#17253b;margin:0;}',
      '.sub{font-size:12px;color:#566277;margin:2px 0 0;}',
      '.cta{',
      '  flex:0 0 auto;border:0;border-radius:10px;padding:8px 12px;',
      '  background:#293cc8;color:#fff;font-size:12.5px;font-weight:600;',
      '  cursor:pointer;white-space:nowrap;transition:background .15s;',
      '}',
      '.cta:hover,.cta:focus-visible{background:#1f2fa3;outline:none;}',
      '.close{',
      '  flex:0 0 auto;width:28px;height:28px;border:0;border-radius:8px;',
      '  background:transparent;color:#566277;font-size:18px;line-height:1;',
      '  cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;',
      '}',
      '.close:hover,.close:focus-visible{background:rgba(23,37,59,0.08);color:#17253b;outline:none;}',
      '@media (max-width:899px){',
      '  .banner{left:10px;right:10px;bottom:calc(env(safe-area-inset-bottom,0px) + 64px);max-width:none;padding:7px 10px;gap:8px;border-radius:12px;}',
      '  .badge{flex-basis:30px;width:30px;height:30px;border-radius:8px;}',
      '  .title{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '  .sub{display:none;}',
      '  .cta{padding:6px 10px;font-size:12px;border-radius:8px;}',
      '}',
      '.backdrop{',
      '  position:fixed;inset:0;z-index:9995;',
      '  background:rgba(15,23,42,0.55);backdrop-filter:blur(3px);',
      '  display:none;align-items:center;justify-content:center;padding:16px;',
      '  box-sizing:border-box;',
      '}',
      '.backdrop.open{display:flex;}',
      '.modal{',
      '  width:100%;max-width:430px;background:#ffffff;color:#17253b;',
      '  border-radius:20px;padding:22px 20px 18px;box-sizing:border-box;',
      '  box-shadow:0 20px 50px rgba(15,23,42,0.28);',
      '  position:relative;line-height:1.5;',
      '}',
      '.modal-close{',
      '  position:absolute;top:14px;right:14px;width:32px;height:32px;',
      '  border:0;border-radius:10px;background:rgba(23,37,59,0.06);color:#566277;',
      '  font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;',
      '}',
      '.modal-close:hover{background:rgba(23,37,59,0.12);color:#17253b;}',
      '.modal h2{margin:0 32px 6px 0;font-size:18px;font-weight:700;color:#17253b;}',
      '.modal-desc{margin:0 0 16px;font-size:13.5px;color:#566277;}',
      '.steps{display:flex;flex-direction:column;gap:10px;margin:0 0 14px;}',
      '.step{',
      '  display:flex;align-items:center;gap:12px;padding:12px 14px;',
      '  border-radius:14px;background:#fbf8ef;border:1px solid #e6e2d5;',
      '  text-decoration:none;color:#17253b;transition:border-color .15s,transform .15s;',
      '}',
      '.step:hover{border-color:#293cc8;transform:translateY(-1px);}',
      '.step-num{',
      '  flex:0 0 28px;width:28px;height:28px;border-radius:50%;',
      '  background:#293cc8;color:#fff;font-size:13px;font-weight:700;',
      '  display:flex;align-items:center;justify-content:center;',
      '}',
      '.step-body{flex:1 1 auto;min-width:0;}',
      '.step-title{display:block;font-size:14px;font-weight:700;color:#17253b;}',
      '.step-sub{display:block;font-size:12px;color:#566277;margin-top:2px;}',
      '.step-arrow{flex:0 0 auto;color:#293cc8;font-size:16px;font-weight:700;}',
      '.modal-note{margin:0;font-size:12px;color:#566277;line-height:1.45;}',
      '@media (prefers-color-scheme:dark){',
      '  .banner,.modal{background:#182032;color:#eef2ff;border-color:rgba(130,152,255,0.24);}',
      '  .title,.modal h2,.step-title{color:#eef2ff;}',
      '  .sub,.modal-desc,.step-sub,.modal-note,.close,.modal-close{color:#a8b3cf;}',
      '  .close:hover,.modal-close:hover{background:rgba(255,255,255,0.1);color:#fff;}',
      '  .step{background:#1f2a42;border-color:rgba(130,152,255,0.22);}',
      '  .step:hover{border-color:#7c90ff;}',
      '  .step-arrow{color:#8fa1ff;}',
      '}',
      '</style>',
      '<div class="banner" role="region" aria-label="Mời dùng thử ứng dụng HọcTA Android">',
      '  <div class="badge" aria-hidden="true">',
      '    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">',
      '      <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.46 11.46 0 00-8.94 0L5.65 5.67c-.19-.28-.54-.37-.83-.22-.3.16-.42.54-.26.85L6.4 9.48A10.78 10.78 0 001 18h22a10.78 10.78 0 00-5.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z"/>',
      '    </svg>',
      '  </div>',
      '  <div class="copy">',
      '    <p class="title">HọcTA đã có bản Android (CH Play)</p>',
      '    <p class="sub">Tra offline, bôi đen tra mọi app — mời bạn dùng thử</p>',
      '  </div>',
      '  <button type="button" class="cta" id="hb-open">Dùng thử</button>',
      '  <button type="button" class="close" id="hb-dismiss" aria-label="Đóng thông báo">&times;</button>',
      '</div>',
      '<div class="backdrop" id="hb-backdrop" role="dialog" aria-modal="true" aria-labelledby="hb-modal-title">',
      '  <div class="modal">',
      '    <button type="button" class="modal-close" id="hb-modal-close" aria-label="Đóng">&times;</button>',
      '    <h2 id="hb-modal-title">Dùng thử HọcTA trên Android</h2>',
      '    <p class="modal-desc">Ứng dụng đang trong giai đoạn thử nghiệm khép kín trên Google Play (miễn phí 100%, không quảng cáo). Cài đặt chỉ với 2 bước:</p>',
      '    <div class="steps">',
      '      <a class="step" href="' + GROUP_URL + '" target="_blank" rel="noopener noreferrer">',
      '        <span class="step-num">1</span>',
      '        <span class="step-body">',
      '          <span class="step-title">Tham gia nhóm tester (Google Group)</span>',
      '          <span class="step-sub">Bấm "Tham gia nhóm" bằng tài khoản Gmail trên máy Android</span>',
      '        </span>',
      '        <span class="step-arrow" aria-hidden="true">↗</span>',
      '      </a>',
      '      <a class="step" href="' + TESTING_URL + '" target="_blank" rel="noopener noreferrer">',
      '        <span class="step-num">2</span>',
      '        <span class="step-body">',
      '          <span class="step-title">Nhận quyền test &amp; tải trên CH Play</span>',
      '          <span class="step-sub">Bấm "Trở thành người thử nghiệm" rồi cài HọcTA từ Google Play</span>',
      '        </span>',
      '        <span class="step-arrow" aria-hidden="true">↗</span>',
      '      </a>',
      '    </div>',
      '    <p class="modal-note">Lưu ý: Bạn cần vào nhóm ở <strong>Bước 1</strong> trước để CH Play mở link tải ở <strong>Bước 2</strong>. Rất mong nhận được góp ý của bạn!</p>',
      '  </div>',
      '</div>'
    ].join('');

    var openBtn = root.getElementById('hb-open');
    var dismissBtn = root.getElementById('hb-dismiss');
    var backdrop = root.getElementById('hb-backdrop');
    var modalClose = root.getElementById('hb-modal-close');

    function dismiss() {
      try {
        if (window.localStorage) window.localStorage.setItem(STORAGE_KEY, '1');
      } catch (_) {}
      host.remove();
    }

    function openModal() {
      backdrop.classList.add('open');
      if (modalClose) modalClose.focus();
    }

    function closeModal() {
      backdrop.classList.remove('open');
    }

    openBtn.addEventListener('click', openModal);
    dismissBtn.addEventListener('click', dismiss);
    modalClose.addEventListener('click', closeModal);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && backdrop.classList.contains('open')) {
        closeModal();
      }
    });

    document.body.appendChild(host);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
