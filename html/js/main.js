/* Web100 — main.js */

// Endpoint GAS dùng chung cho mọi form của site (liên hệ, kiểm tra SEO, yêu cầu báo giá)
// — xem gas/README.md ở gốc repo.
window.WEB100_FORM_URL = 'https://script.google.com/macros/s/AKfycbwgxqNs8MfhlObqxMmBL88CVvG_hQOTXffH3mlflBzDLSosukMKzsv7PLreUQjMp9E/exec';

document.addEventListener('DOMContentLoaded', () => {
  initHeroLeadTyping();
  initMobileNav();
  initDrawerAccordion();
  initNavDropdowns();
  initNavIndicator();
  initFaqAccordion();
  initReveal();
  initEdgeCarousels();
  initBeforeAfter();
  initTemplateActions();
  initStatCounters();
  initClientLogos();
  initAttribution();
  initClickTracking();
  initPackagePicker();
  initMessengerLinks();
});

/* Link Messenger: m.me mở thẳng app trên điện thoại, nhưng trên máy tính lại
   chuyển sang messenger.com — tên miền riêng, phiên đăng nhập riêng nên khách
   đã login facebook.com vẫn bị hỏi đăng nhập lại. Máy tính (chuột + màn hình
   rộng) dùng link facebook.com/messages/... trong data-messenger thay thế. */
function initMessengerLinks() {
  const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 901px)').matches;
  if (!isDesktop) return;
  document.querySelectorAll('a[data-messenger]').forEach((a) => {
    a.href = a.dataset.messenger;
  });
}

/* --------------------------------------------------------------------------
   Đo chuyển đổi cho quảng cáo. Mọi sự kiện đi qua gtag (GA4 đã gắn ở <head>
   mọi trang) — trong GA4 đánh dấu generate_lead / click_call / click_zalo là
   key event rồi import sang Google Ads. Có Facebook Pixel (fbq) thì bắn luôn.
     click_call · click_zalo · click_messenger — bấm nút liên hệ
     form_start      — khách bắt đầu điền một form
     package_selected — chọn gói (nút "Chọn gói" hoặc ô chọn trong form)
     generate_lead   — form gửi THÀNH CÔNG (GAS trả ok)
     form_error      — gửi thất bại (để phát hiện sớm khi GAS lỗi)
   -------------------------------------------------------------------------- */
function track(event, params = {}) {
  try {
    if (typeof window.gtag === 'function') window.gtag('event', event, params);
  } catch (e) { /* tracking không được làm hỏng trang */ }
}

const FB_EVENTS = { generate_lead: 'Lead', click_call: 'Contact', click_zalo: 'Contact', click_messenger: 'Contact' };
function trackFb(event, params) {
  try {
    if (typeof window.fbq === 'function' && FB_EVENTS[event]) window.fbq('track', FB_EVENTS[event], params);
  } catch (e) { /* bỏ qua */ }
}

// Bắn generate_lead rồi mới gọi done() — chờ gtag gửi xong (tối đa 1,2s) vì
// done() có thể chuyển sang trang cảm ơn, rời trang sớm quá là mất sự kiện.
function trackLead({ form, package: pkg, phone }, done) {
  let called = false;
  const once = () => { if (!called) { called = true; done(); } };
  try {
    if (typeof window.gtag === 'function') {
      // Enhanced conversions: gtag tự chuẩn hoá + băm SHA-256 trước khi gửi.
      if (phone) window.gtag('set', 'user_data', { phone_number: '+84' + phone.slice(1) });
      window.gtag('event', 'generate_lead', {
        form, package: pkg, currency: 'VND', value: 1,
        event_callback: once, event_timeout: 1200,
      });
    }
  } catch (e) { /* bỏ qua */ }
  trackFb('generate_lead', { content_name: pkg || form });
  setTimeout(once, 1300);
}

// 0905 123 456 / +84 905.123.456 / 84905123456 -> "0905123456"; sai định dạng -> "".
function normalizeVnPhone(raw) {
  let digits = String(raw || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+84')) digits = '0' + digits.slice(3);
  else if (digits.startsWith('84') && digits.length === 11) digits = '0' + digits.slice(2);
  // Di động 10 số hoặc máy bàn 11 số (VD: 0236 xxx xxxx).
  return /^0\d{9,10}$/.test(digits) ? digits : '';
}

/* Lưu nguồn quảng cáo (gclid/wbraid/gbraid của Google Ads, fbclid, utm_*) ngay
   khi khách vào trang — khách có thể lướt sang trang khác hoặc quay lại vài hôm
   sau mới gửi form. Lượt click quảng cáo mới nhất ghi đè lượt cũ (last-click),
   giữ 90 ngày = thời hạn click-through mặc định của Google Ads. */
const ATTR_KEY = 'web100_attr';
const ATTR_PARAMS = ['gclid', 'wbraid', 'gbraid', 'fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const ATTR_TTL = 90 * 24 * 60 * 60 * 1000;

function initAttribution() {
  const params = new URLSearchParams(location.search);
  const fresh = {};
  ATTR_PARAMS.forEach((k) => {
    const v = params.get(k);
    if (v) fresh[k] = v.slice(0, 200);
  });
  if (!Object.keys(fresh).length) return;
  fresh.landing = location.pathname;
  fresh.ts = Date.now();
  try { localStorage.setItem(ATTR_KEY, JSON.stringify(fresh)); } catch (e) { /* private mode */ }
}

function attributionNote() {
  let a = null;
  try { a = JSON.parse(localStorage.getItem(ATTR_KEY) || 'null'); } catch (e) { /* bỏ qua */ }
  if (!a || !a.ts || Date.now() - a.ts > ATTR_TTL) return '';
  const parts = ATTR_PARAMS.filter((k) => a[k]).map((k) => `${k}=${a[k]}`);
  if (!parts.length) return '';
  parts.push(`landing=${a.landing}`, `click=${new Date(a.ts).toISOString()}`);
  return `[Nguồn] ${parts.join(' | ')}`;
}

function initClickTracking() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    const area = a.closest('[data-track-area]');
    const params = { link_location: area ? area.dataset.trackArea : 'other', page: location.pathname };
    let event = '';
    if (href.startsWith('tel:')) event = 'click_call';
    else if (/zalo\.me\//.test(href)) event = 'click_zalo';
    else if (a.hasAttribute('data-messenger') || /(^|\/\/)(m\.me|www\.messenger\.com)\//.test(href)) event = 'click_messenger';
    if (!event) return;
    track(event, params);
    trackFb(event, params);
  });

  document.querySelectorAll('.modal__form').forEach((form) => {
    form.addEventListener('focusin', () => {
      track('form_start', { form: form.dataset.formAction || 'contact', page: location.pathname });
    }, { once: true });
  });
}

/* Landing page: nút "Chọn gói ..." ([data-pick-package] trỏ href="#id-form")
   cuộn tới form, tích sẵn gói tương ứng và đặt con trỏ vào ô SĐT — khách chỉ
   còn nhập số điện thoại. [data-goto-form] (nút "Nhận báo giá") làm y hệt
   nhưng không chọn gói. */
function initPackagePicker() {
  document.querySelectorAll('[data-pick-package], [data-goto-form]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = document.querySelector(btn.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const pkg = btn.dataset.pickPackage;
      if (pkg) {
        // Form landing giữ gói trong ô ẩn; form có ô chọn gói dạng radio thì tích sẵn.
        const hidden = target.querySelector('input[type="hidden"][name="goi_dich_vu"]');
        if (hidden) hidden.value = pkg;
        const radio = [...target.querySelectorAll('input[type="radio"][name="goi_dich_vu"]')].find((r) => r.value === pkg);
        if (radio) radio.checked = true;
        track('package_selected', { package: pkg, source: 'pricing' });
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const phone = target.querySelector('[name="dienthoai"]');
      if (phone) setTimeout(() => phone.focus({ preventScroll: true }), 450);
    });
  });

  document.querySelectorAll('.modal__form select[name="loai_website"]').forEach((select) => {
    select.addEventListener('change', () => track('website_type_selected', { website_type: select.value }));
  });

  document.querySelectorAll('.modal__form input[name="goi_dich_vu"][type="radio"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) track('package_selected', { package: radio.value, source: 'form' });
    });
  });
}

/* --------------------------------------------------------------------------
   Logo khách hàng — mỗi ô logo chứa sẵn 2 lớp: thẻ <img> trỏ tới
   images/khach-hang/<slug>.webp và một wordmark bằng chữ làm lớp đỡ. CSS ẩn
   <img> mặc định, hàm này chỉ bật nó lên (class .has-logo) khi file logo thật
   sự tải được — nhờ vậy lúc chưa có file thì thẻ hiện wordmark gọn gàng chứ
   không lòi ra icon ảnh lỗi, và khi bỏ file vào là tự đổi, không cần sửa code.
   -------------------------------------------------------------------------- */
function initClientLogos() {
  document.querySelectorAll('.client-card__logo').forEach((box) => {
    const img = box.querySelector('img');
    if (!img) return;
    const show = () => box.classList.add('has-logo');
    if (img.complete) {
      if (img.naturalWidth > 0) show();
      return;
    }
    img.addEventListener('load', show);
  });
}

/* --------------------------------------------------------------------------
   Carousel dịch vụ + dự án — cùng cơ chế "What We Do" của mvngroup.vn: viewport
   chỉ overflow:hidden để cắt khung nhìn (KHÔNG phải overflow:auto/scroll —
   trình duyệt không bao giờ coi nó là scrollport), việc lướt qua từng thẻ là
   JS tự trượt track bằng transform: translateX(). Cách cũ (overflow-x:auto +
   scroll-snap) biến track thành một scrollport thật: bất kỳ chênh lệch nào
   giữa scrollHeight/clientHeight (ảnh chưa load, hiệu ứng reveal, làm tròn số
   px...) đều khiến Chrome coi track là "có thể cuộn dọc" và cướp mất cuộn
   chuột của trang khi hover vào — dù đã vá nhiều lớp (overflow-y hidden/clip,
   bỏ hiệu ứng reveal...) vẫn còn tái diễn. Bỏ hẳn cơ chế scroll-container là
   cách duy nhất triệt để: không có scrollport thì không có gì để "nuốt" cuộn
   dọc của trang nữa. */
function initEdgeCarousel({ trackId, viewportClass, prevClass, nextClass, gap, breakpoints }) {
  const track = document.querySelector(trackId);
  const viewport = document.querySelector(viewportClass);
  const prevBtn = document.querySelector(prevClass);
  const nextBtn = document.querySelector(nextClass);
  if (!track || !viewport) return;

  const cards = Array.from(track.children);
  let index = 0;
  let cardWidth = 0;
  let visible = breakpoints[breakpoints.length - 1].visible;

  function getVisible() {
    const w = window.innerWidth;
    const bp = breakpoints.find((b) => !b.maxWidth || w <= b.maxWidth);
    return bp.visible;
  }

  function layout() {
    visible = getVisible();
    cardWidth = (viewport.clientWidth - gap * (visible - 1)) / visible;
    cards.forEach((card) => { card.style.width = `${cardWidth}px`; });
    const maxIndex = Math.max(0, cards.length - visible);
    index = Math.min(index, maxIndex);
    applyTransform();
  }

  function applyTransform() {
    track.style.transform = `translateX(${-index * (cardWidth + gap)}px)`;
  }

  function go(delta) {
    const maxIndex = Math.max(0, cards.length - visible);
    if (delta > 0 && index >= maxIndex) index = 0;
    else if (delta < 0 && index <= 0) index = maxIndex;
    else index = Math.min(Math.max(index + delta, 0), maxIndex);
    applyTransform();
  }

  nextBtn?.addEventListener('click', () => go(1));
  prevBtn?.addEventListener('click', () => go(-1));

  /* overflow:hidden ẩn thanh cuộn nhưng Chrome vẫn cho phép scrollLeft/Top bị
     đẩy lệch trong vài trường hợp hiếm (rê chuột ngang trên trackpad...) — vị
     trí hiển thị của track chỉ nên do transform quyết định, nên hễ viewport
     lệch khỏi (0,0) thì kéo về ngay, tránh cộng dồn lệch hình với transform. */
  viewport.addEventListener('scroll', () => {
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  });

  layout();
}

function initEdgeCarousels() {
  initEdgeCarousel({
    trackId: '#svcTrack',
    viewportClass: '.svc-viewport',
    prevClass: '.svc-nav--prev',
    nextClass: '.svc-nav--next',
    gap: 24,
    breakpoints: [
      { maxWidth: 700, visible: 1 },
      { maxWidth: 900, visible: 2 },
      { visible: 3 },
    ],
  });

  initEdgeCarousel({
    trackId: '.project-track',
    viewportClass: '.project-viewport',
    prevClass: '.project-prev',
    nextClass: '.project-next',
    gap: 20,
    breakpoints: [
      { maxWidth: 700, visible: 1 },
      { maxWidth: 900, visible: 2 },
      { visible: 4 },
    ],
  });

  initGalleryCoverflow();
}

/* --------------------------------------------------------------------------
   Kho giao diện — carousel riêng, 2 chế độ theo bề rộng màn hình:

   • PC (> 900px): coverflow 3D. Toàn bộ thẻ được đặt absolute trong cùng một
     "sân khấu" có perspective; mỗi thẻ nhận transform riêng theo khoảng cách
     tới thẻ đang ở giữa (offset): thẻ giữa nằm thẳng + to nhất, hai thẻ kề
     nghiêng vào giữa và nhỏ lại, các thẻ xa hơn mờ dần rồi ẩn. Bấm prev/next
     chỉ đổi chỉ số thẻ giữa — CSS transition lo phần trượt/nghiêng mượt.
   • Tablet/mobile (<= 900px): giữ cơ chế trượt phẳng như 2 carousel còn lại
     (dịch cả track bằng translateX), vì coverflow 3D trên màn hẹp vừa chật
     vừa khó chạm.

   Hai chế độ dùng chung state currentIndex và chung 2 nút bấm; khi đổi
   breakpoint, style inline của chế độ cũ được xoá sạch trước khi bố cục lại.
   -------------------------------------------------------------------------- */
function initGalleryCoverflow() {
  const wrap = document.querySelector('.gallery-track-wrap');
  const viewport = document.querySelector('.gallery-viewport');
  const track = document.querySelector('#galleryTrack');
  const prevBtn = document.querySelector('.gallery-nav--prev');
  const nextBtn = document.querySelector('.gallery-nav--next');
  if (!wrap || !viewport || !track) return;

  const cards = Array.from(track.children);
  if (!cards.length) return;

  const GAP = 24;
  const isDesktop = () => window.matchMedia('(min-width: 901px)').matches;
  let index = 0;
  let mode = null;

  function clearInlineStyles() {
    track.style.width = '';
    track.style.transform = '';
    cards.forEach((card) => {
      card.style.width = '';
      card.style.transform = '';
      card.style.opacity = '';
      card.style.zIndex = '';
      card.style.pointerEvents = '';
      card.classList.remove('is-center');
    });
  }

  /* -- Chế độ PC: coverflow 3D -- */
  function layoutCoverflow() {
    /* Dùng offsetWidth (bề rộng layout, không đổi) thay vì
       getBoundingClientRect() — hàm kia trả về bề rộng SAU transform, nên khi
       thẻ này đang nghiêng + thu nhỏ thì số đo bị hụt, step ngắn lại và cả dàn
       thẻ nép dần vào giữa mỗi lần bấm next. */
    const cardWidth = cards[0].offsetWidth || 340;
    const step = cardWidth * 0.62; // hai thẻ kề chỉ nhô ra một phần
    const half = Math.floor(cards.length / 2);
    cards.forEach((card, i) => {
      /* Offset tính theo vòng tròn: thẻ ở cuối danh sách được coi là nằm ngay
         bên trái thẻ đầu, nhờ vậy hai bên thẻ giữa luôn có thẻ nghiêng — kể cả
         khi đang ở thẻ đầu hoặc thẻ cuối. */
      let offset = i - index;
      if (offset > half) offset -= cards.length;
      else if (offset < -half) offset += cards.length;
      const dist = Math.abs(offset);
      const rotate = offset === 0 ? 0 : (offset > 0 ? -32 : 32);
      const scale = dist === 0 ? 1 : Math.max(0.68, 0.84 - (dist - 1) * 0.08);
      const depth = dist === 0 ? 0 : -120 - (dist - 1) * 60;
      const opacity = dist === 0 ? 1 : dist === 1 ? 0.85 : dist === 2 ? 0.4 : 0;

      card.style.transform =
        `translate(-50%, 0) translateX(${offset * step}px) translateZ(${depth}px) rotateY(${rotate}deg) scale(${scale})`;
      card.style.opacity = String(opacity);
      card.style.zIndex = String(20 - dist);
      card.style.pointerEvents = dist > 2 ? 'none' : 'auto';
      card.classList.toggle('is-center', dist === 0);
    });
  }

  /* -- Chế độ tablet/mobile: trượt phẳng cả track -- */
  function layoutFlat() {
    const visible = window.matchMedia('(max-width: 700px)').matches ? 1 : 2;
    const cardWidth = (viewport.clientWidth - GAP * (visible - 1)) / visible;
    cards.forEach((card) => { card.style.width = `${cardWidth}px`; });
    track.style.width = 'max-content';
    const maxIndex = Math.max(0, cards.length - visible);
    if (index > maxIndex) index = Math.floor(maxIndex);
    track.style.transform = `translateX(${-index * (cardWidth + GAP)}px)`;
  }

  function layout() {
    const wantMode = isDesktop() ? 'coverflow' : 'flat';
    if (wantMode !== mode) {
      clearInlineStyles();
      wrap.classList.toggle('is-coverflow', wantMode === 'coverflow');
      mode = wantMode;
    }
    if (mode === 'coverflow') layoutCoverflow();
    else layoutFlat();
  }

  function go(delta) {
    if (mode === 'coverflow') {
      index = (index + delta + cards.length) % cards.length; // quay vòng
      layoutCoverflow();
      return;
    }
    const visible = window.matchMedia('(max-width: 700px)').matches ? 1 : 2;
    const maxIndex = Math.max(0, cards.length - visible);
    if (delta > 0 && index >= maxIndex) index = 0;
    else if (delta < 0 && index <= 0) index = Math.floor(maxIndex);
    else index = Math.min(Math.max(index + delta, 0), maxIndex);
    layoutFlat();
  }

  nextBtn?.addEventListener('click', () => go(1));
  prevBtn?.addEventListener('click', () => go(-1));

  /* Ở chế độ coverflow, bấm vào thẻ nghiêng hai bên là đưa nó vào giữa chứ
     không mở link ngay — chỉ thẻ giữa mới thực sự dẫn sang trang kho giao diện. */
  cards.forEach((card, i) => {
    card.addEventListener('click', (e) => {
      if (mode !== 'coverflow' || i === index) return;
      e.preventDefault();
      index = i;
      layoutCoverflow();
    });
  });

  viewport.addEventListener('scroll', () => {
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  });

  layout();
}

/* --------------------------------------------------------------------------
   Thành tựu: số đếm tăng dần từ 0 lên giá trị đích, chạy 1 lần duy nhất khi
   khối lần đầu lọt vào màn hình (IntersectionObserver, unobserve ngay sau
   đó). Tốc độ giảm dần về cuối (ease-out) cho tự nhiên; hậu tố "+", "%"
   lấy từ data-suffix.
   -------------------------------------------------------------------------- */
function initStatCounters() {
  const nums = document.querySelectorAll('.stat__num[data-count-to]');
  if (!nums.length) return;

  function run(el) {
    const target = parseInt(el.dataset.countTo, 10) || 0;
    const suffix = el.dataset.suffix || '';
    // Hậu tố ("+", "%") bọc trong span riêng để CSS thu nhỏ được — nếu nối
    // thẳng vào textContent thì hậu tố sẽ to bằng số, không style riêng được.
    const suffixHTML = suffix ? `<span class="stat__suffix">${suffix}</span>` : '';
    const duration = 1400;
    const start = performance.now();
    function frame(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.innerHTML = Math.round(target * eased) + suffixHTML;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (!('IntersectionObserver' in window)) {
    nums.forEach(run);
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      run(entry.target);
    });
  }, { threshold: 0.4 });
  nums.forEach((el) => io.observe(el));
}

/* --------------------------------------------------------------------------
   Hiệu ứng gõ chữ 1 LẦN DUY NHẤT cho đoạn lead dưới title (không lặp lại):
   hiện sẵn "Thành công của khách hàng là", gõ thẳng "mục tiêu hàng đầu!"
   — riêng "hàng đầu!" được gõ xong mới bọc thêm 1 khối chữ nhật xanh nhạt
   nghiêng 10°, rơi từ trên cao xuống rồi mắc lại đúng lên chữ (chữ đổi màu
   trắng để đọc được trên khối). Kết thúc đứng yên vĩnh viễn.
   -------------------------------------------------------------------------- */
function initHeroLeadTyping() {
  const el = document.getElementById('heroLead');
  if (!el) return;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const TYPE_MS = 45;
  const PREFIX = 'Thành công của khách hàng là';

  async function typeAppend(text) {
    for (let i = 0; i < text.length; i++) {
      el.textContent += text[i];
      await sleep(TYPE_MS);
    }
  }

  async function run() {
    el.textContent = PREFIX;
    await typeAppend(' mục tiêu ');
    // Gõ "hàng đầu!" dạng thường trước, gõ xong mới bọc khối rơi.
    const finalWord = 'hàng đầu!';
    await typeAppend(finalWord);
    const base = el.textContent.slice(0, el.textContent.length - finalWord.length);
    el.innerHTML =
      base +
      `<span class="lead-mark"><span class="lead-mark__block"></span><span class="lead-mark__text">${finalWord}</span></span>`;

    dropBlock();
    // Xong — giữ nguyên câu hoàn chỉnh, không lặp lại.
  }

  /* Khối rơi + "quét trắng" chữ mà nó đi qua.
     Cách làm: tạo 1 BẢN SAO toàn bộ .hero-copy (chữ màu trắng) phủ chồng
     khít lên bản thật, rồi mỗi khung hình cắt (clip-path) bản sao đó đúng
     bằng hình chữ nhật nghiêng 10° của khối đang rơi. Nhờ vậy chữ chỉ
     trắng đúng phần đang bị khối phủ — kể cả chữ ở phía trên mà khối đi
     ngang qua trên đường rơi — còn chữ thật bên dưới vẫn giữ màu bình
     thường, không bị biến mất lúc nào cả. Rơi nhanh dần đều (như trọng
     lực), không nảy. */
  function dropBlock() {
    const block = el.querySelector('.lead-mark__block');
    const heroCopy = el.closest('.hero-copy');
    if (!block || !heroCopy) return;

    const FALL_MS = 1150;
    /* Các pha chuyển động (y: px lệch so với vị trí nghỉ, rot: độ nghiêng).
       `ease` của mỗi mốc áp cho ĐOẠN bắt đầu từ chính mốc đó:
         1. rơi tự do, nhanh dần đều
         2. VA CHẠM: khựng lại rất gấp, đồng thời vênh góc lên vì vướng một
            mép vào chữ (như tấm vải quệt phải cành cây)
         3. tì sát, ghì lại một nhịp rất ngắn
         4. TRÔI TUỘT: tuột chậm dần xuống dọc theo chữ, góc nghiêng hạ dần
         5. MẮC KẸT: giảm tốc rồi dừng hẳn ở đúng vị trí nghỉ */
    const KEYS = [
      { t: 0.00, y: -175, rot: 3, ease: (p) => p * p },
      { t: 0.38, y: -34, rot: 7, ease: (p) => 1 - (1 - p) ** 3 },
      { t: 0.49, y: -25, rot: 15.5, ease: (p) => p },
      { t: 0.57, y: -22.5, rot: 14.5, ease: (p) => p * p * (3 - 2 * p) },
      { t: 0.85, y: -6, rot: 11, ease: (p) => 1 - (1 - p) ** 2 },
      { t: 1.00, y: 0, rot: 10 },
    ];

    function sample(progress) {
      for (let i = 0; i < KEYS.length - 1; i++) {
        const a = KEYS[i];
        const b = KEYS[i + 1];
        if (progress <= b.t || i === KEYS.length - 2) {
          const span = b.t - a.t;
          const local = span > 0 ? Math.min(Math.max((progress - a.t) / span, 0), 1) : 1;
          const e = a.ease ? a.ease(local) : local;
          return { y: a.y + (b.y - a.y) * e, rot: a.rot + (b.rot - a.rot) * e };
        }
      }
      return { y: 0, rot: 10 };
    }

    const ghost = document.createElement('div');
    ghost.className = `${heroCopy.className} hero-copy-ghost`;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.innerHTML = heroCopy.innerHTML;
    const ghostBlock = ghost.querySelector('.lead-mark__block');
    if (ghostBlock) ghostBlock.remove(); // bản sao không cần khối màu
    heroCopy.appendChild(ghost);

    // Đo HỘP GỐC của khối (tắt transform lúc đo, vì getBoundingClientRect
    // trả về hộp ĐÃ biến đổi — nếu đo khi còn transform sẽ bị cộng dồn sai
    // vị trí), rồi quy về hệ toạ độ của .hero-copy.
    const copyRect = heroCopy.getBoundingClientRect();
    block.style.transform = 'none';
    const blockRect = block.getBoundingClientRect();
    const x0 = blockRect.left - copyRect.left;
    const y0 = blockRect.top - copyRect.top;
    const w = blockRect.width;
    const h = blockRect.height;
    block.style.transform = `translateY(${KEYS[0].y}px) rotate(${KEYS[0].rot}deg)`;

    const start = performance.now();
    function frame(now) {
      const p = Math.min((now - start) / FALL_MS, 1);
      const { y: dy, rot } = sample(p);
      block.style.transform = `translateY(${dy}px) rotate(${rot}deg)`;

      const rad = (rot * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const cx = x0 + w / 2;
      const cy = y0 + h / 2 + dy;
      const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
        .map(([ox, oy]) => {
          const px = cx + ox * cos - oy * sin;
          const py = cy + ox * sin + oy * cos;
          return `${px.toFixed(1)}px ${py.toFixed(1)}px`;
        })
        .join(', ');
      ghost.style.clipPath = `polygon(${corners})`;

      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  run();
}

/* -------------------------------------------------------------------------- */
function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const drawer = document.querySelector('.mobile-nav-drawer');
  const overlay = document.querySelector('.nav-overlay');
  if (!toggle || !drawer || !overlay) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    drawer.classList.toggle('open', open);
    overlay.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });
  overlay.addEventListener('click', () => setOpen(false));
  drawer.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
}

/* --------------------------------------------------------------------------
   Dropdown menu desktop: mở khi hover (chỉ trên thiết bị có hover thật) và
   khi click (bàn phím / cảm ứng), mũi tên xoay theo aria-expanded.
   -------------------------------------------------------------------------- */
function initNavDropdowns() {
  const items = document.querySelectorAll('.nav-item.has-dropdown');
  if (!items.length) return;

  const hasHover = () => window.matchMedia('(hover: hover)').matches;
  let closeTimer = null;

  const closeItem = (item) => {
    item.classList.remove('open');
    const trigger = item.querySelector('.nav-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  };
  const openItem = (item) => {
    clearTimeout(closeTimer);
    items.forEach((other) => { if (other !== item) closeItem(other); });
    item.classList.add('open');
    const trigger = item.querySelector('.nav-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
  };

  items.forEach((item) => {
    const trigger = item.querySelector('.nav-trigger');
    if (!trigger) return;

    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      isOpen ? closeItem(item) : openItem(item);
    });

    item.addEventListener('mouseenter', () => {
      if (hasHover()) openItem(item);
    });
    item.addEventListener('mouseleave', () => {
      if (!hasHover()) return;
      closeTimer = setTimeout(() => closeItem(item), 180);
    });
  });

  document.addEventListener('click', (e) => {
    items.forEach((item) => {
      if (!item.contains(e.target)) closeItem(item);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') items.forEach(closeItem);
  });
}

/* --------------------------------------------------------------------------
   Thanh trượt (magic line) nhảy theo mục nav đang hover, trở về ẩn khi rời
   khỏi toàn bộ menu.
   -------------------------------------------------------------------------- */
function initNavIndicator() {
  const nav = document.querySelector('.main-nav');
  const indicator = document.querySelector('.nav-indicator');
  if (!nav || !indicator) return;

  const links = nav.querySelectorAll(':scope > .nav-item > .nav-link');

  const moveTo = (el) => {
    const navRect = nav.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    indicator.style.width = rect.width + 'px';
    indicator.style.transform = `translateX(${rect.left - navRect.left}px)`;
    indicator.style.opacity = '1';
  };

  links.forEach((link) => {
    link.addEventListener('mouseenter', () => moveTo(link));
  });
  nav.addEventListener('mouseleave', () => {
    indicator.style.opacity = '0';
  });
}

/* --------------------------------------------------------------------------
   Accordion menu con trong drawer mobile: trượt xuống bằng grid-template-rows
   (0fr -> 1fr) nên không cần đo chiều cao bằng JS.
   -------------------------------------------------------------------------- */
function initDrawerAccordion() {
  const items = document.querySelectorAll('.drawer-item');
  if (!items.length) return;

  items.forEach((item) => {
    const trigger = item.querySelector('.drawer-trigger');
    if (!trigger) return;
    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach((other) => {
        if (other !== item) {
          other.classList.remove('open');
          other.querySelector('.drawer-trigger').setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.toggle('open', !isOpen);
      trigger.setAttribute('aria-expanded', String(!isOpen));
    });
  });
}

/* --------------------------------------------------------------------------
   Accordion FAQ: mỗi lần chỉ mở một câu hỏi, trượt bằng grid-template-rows
   (0fr -> 1fr) giống accordion drawer mobile.
   -------------------------------------------------------------------------- */
function initFaqAccordion() {
  const items = document.querySelectorAll('.faq-item');
  if (!items.length) return;

  items.forEach((item) => {
    const trigger = item.querySelector('.faq-trigger');
    if (!trigger) return;
    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach((other) => {
        if (other !== item) {
          other.classList.remove('open');
          other.querySelector('.faq-trigger').setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.toggle('open', !isOpen);
      trigger.setAttribute('aria-expanded', String(!isOpen));
    });
  });
}

/* -------------------------------------------------------------------------- */
function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  items.forEach((el) => observer.observe(el));
}

/* --------------------------------------------------------------------------
   Trang chi tiết kho templates: nút "Xem live" mở URL thật bằng JS (không
   dùng thẻ <a href>) ở tab mới, và popup "Chọn mẫu này" ([data-open-modal]
   trỏ tới id của .modal-overlay). Dùng chung .modal-overlay/.modal trong
   style.css nên tái sử dụng được cho mọi trang có popup dạng form.
   -------------------------------------------------------------------------- */
function initTemplateActions() {
  document.querySelectorAll('[data-live-url]').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.open(btn.dataset.liveUrl, '_blank', 'noopener');
    });
  });

  const openModal = (modal) => {
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => modal.classList.add('is-open'));
  };
  const closeModal = (modal) => {
    modal.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    setTimeout(() => { modal.hidden = true; }, 250);
  };

  document.querySelectorAll('[data-open-modal]').forEach((btn) => {
    const modal = document.getElementById(btn.dataset.openModal);
    if (!modal) return;
    btn.addEventListener('click', () => {
      // Nút chọn gói giá mang theo data-package -> điền sẵn vào field ẩn
      // "goi_dich_vu" của modal báo giá, để form biết đang gửi cho gói nào.
      if (btn.dataset.package) {
        const pkgInput = modal.querySelector('[name="goi_dich_vu"]');
        if (pkgInput) pkgInput.value = btn.dataset.package;
      }
      openModal(modal);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
    overlay.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(overlay));
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal-overlay.is-open').forEach(closeModal);
  });

  // Honeypot chống bot: field ẩn `_hp`, con người không thấy nên luôn để trống.
  // Ẩn bằng vị trí off-screen (không display:none) để form tự-điền/bot đọc DOM
  // vẫn thấy field tồn tại và có khả năng tự điền vào, lộ ra là bot.
  const addHoneypot = (form) => {
    if (form.querySelector('[name="_hp"]')) return;
    const hp = document.createElement('input');
    hp.type = 'text';
    hp.name = '_hp';
    hp.autocomplete = 'off';
    hp.tabIndex = -1;
    hp.setAttribute('aria-hidden', 'true');
    hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;';
    form.appendChild(hp);
  };

  // Dòng báo lỗi ngay trong form — tạo khi cần, để các form cũ không phải sửa markup.
  const showFormError = (form, message) => {
    let el = form.querySelector('.form-error');
    if (!el) {
      el = document.createElement('p');
      el.className = 'form-error';
      el.setAttribute('role', 'alert');
      const submit = form.querySelector('button[type="submit"]');
      form.insertBefore(el, submit || null);
    }
    el.innerHTML = message;
    el.hidden = !message;
  };
  const SEND_FAIL_MSG = 'Chưa gửi được yêu cầu. Vui lòng thử lại, hoặc gọi <a href="tel:+84964074043">096.407.4043</a> / nhắn <a href="https://zalo.me/84964074043" target="_blank" rel="noopener">Zalo</a> để được tư vấn ngay.';

  // Gửi form liên hệ (dùng chung mọi trang), form yêu cầu báo giá (đánh dấu
  // bằng data-form-action="quote") và form ngắn của landing page quảng cáo
  // (data-form-action="lp") thẳng lên GAS — xem gas/README.md.
  document.querySelectorAll('.modal__form').forEach((form) => {
    addHoneypot(form);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const modal = form.closest('.modal');
      const body = form.closest('.modal__body');
      const done = modal && modal.querySelector('.modal__done');
      const submitBtn = form.querySelector('button[type="submit"]');

      const data = new FormData(form);
      if (data.get('_hp')) return; // bot dính bẫy — im lặng, không gửi, không báo lỗi

      const formAction = form.dataset.formAction || 'contact';
      const hoten = (data.get('hoten') || '').toString().trim();
      const email = (data.get('email') || '').toString().trim();
      const dienthoai = (data.get('dienthoai') || '').toString().trim();
      const mau = (data.get('mau') || '').toString().trim();
      const mota = (data.get('mota') || '').toString().trim();
      const goi = (data.get('goi_dich_vu') || '').toString().trim();
      const loaiWebsite = (data.get('loai_website') || '').toString().trim();

      const phone = normalizeVnPhone(dienthoai);
      if (dienthoai && !phone) {
        showFormError(form, 'Số điện thoại chưa đúng, vui lòng kiểm tra lại, VD: 0905 123 456.');
        const input = form.querySelector('[name="dienthoai"]');
        if (input) input.focus();
        return;
      }
      showFormError(form, '');

      // Nguồn quảng cáo (gclid/utm...) ghi kèm vào ghi chú để biết lead đến từ đâu.
      const source = attributionNote();
      const withSource = (text) => [text, source].filter(Boolean).join('\n');

      let payload;
      if (formAction === 'lp') {
        // Form landing chỉ bắt buộc SĐT; GAS (action quote) vẫn đòi đủ họ tên/email/gói
        // nên điền giá trị mặc định cho các ô khách không phải nhập.
        payload = {
          action: 'quote',
          hoten: hoten || 'Landing page',
          email: email || 'web100.vn@gmail.com',
          dienthoai: phone,
          goi_dich_vu: goi || 'Chưa chọn',
          ghi_chu: withSource([loaiWebsite && `Website cần thiết kế: ${loaiWebsite}`, mota].filter(Boolean).join('\n')),
          trang: location.pathname,
        };
      } else if (formAction === 'quote') {
        payload = {
          action: 'quote',
          hoten, email, dienthoai,
          goi_dich_vu: goi,
          ghi_chu: withSource(mota),
          trang: location.pathname,
        };
      } else {
        payload = {
          action: 'contact',
          hoten, email, dienthoai,
          mota: withSource(mau ? `[Mẫu tham khảo: ${mau}] ${mota}` : mota),
          trang: location.pathname,
        };
      }

      const setLoading = (on) => {
        if (!submitBtn) return;
        submitBtn.disabled = on;
        submitBtn.classList.toggle('is-loading', on);
      };
      setLoading(true);

      fetch(window.WEB100_FORM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then((json) => {
          // rate_limited = cùng số điện thoại vừa gửi xong — yêu cầu trước đã vào Sheet,
          // coi như thành công nhưng không bắn conversion lần nữa.
          const duplicate = json && json.error === 'rate_limited';
          if (!json || (!json.ok && !duplicate)) throw new Error((json && json.error) || 'unknown');
          return duplicate;
        })
        .then((duplicate) => {
          const finish = () => {
            if (form.dataset.redirect) {
              const url = new URL(form.dataset.redirect, location.href);
              if (payload.goi_dich_vu) url.searchParams.set('goi', payload.goi_dich_vu);
              location.href = url.toString();
              return;
            }
            setLoading(false);
            if (body) body.hidden = true;
            if (done) done.hidden = false;
          };
          if (duplicate) { finish(); return; }
          trackLead({ form: formAction, package: payload.goi_dich_vu || '', phone }, finish);
        })
        .catch((err) => {
          console.error('Gửi form thất bại:', err);
          setLoading(false);
          showFormError(form, SEND_FAIL_MSG);
          track('form_error', { form: formAction, error: String(err && err.message || err).slice(0, 80) });
        });
    });
  });

  // Cho phép link ngoài (VD: nút "Chọn mẫu này" ở trang /demo/) tự mở popup
  // qua ?modal=<id> thay vì phải bấm lại nút trên trang đích.
  const autoModalId = new URLSearchParams(window.location.search).get('modal');
  if (autoModalId) {
    const autoModal = document.getElementById(autoModalId);
    if (autoModal) openModal(autoModal);
  }
}

/* --------------------------------------------------------------------------
   So sánh trước/sau: kéo (chuột hoặc chạm) trên toàn khối để lộ dần ảnh
   "sau" qua clip-path, thanh kéo bám theo vị trí con trỏ.
   -------------------------------------------------------------------------- */
function initBeforeAfter() {
  document.querySelectorAll('[data-before-after]').forEach((el) => {
    const afterPane = el.querySelector('.ba-pane--after');
    const handle = el.querySelector('.ba-handle');
    if (!afterPane || !handle) return;

    let dragging = false;

    const setPercent = (percent) => {
      const p = clamp(percent, 0, 100);
      afterPane.style.clipPath = `inset(0 ${100 - p}% 0 0)`;
      handle.style.left = p + '%';
    };

    const percentFromEvent = (e) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX != null ? e.clientX : 0) - rect.left;
      return (x / rect.width) * 100;
    };

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dragging = true;
      el.setPointerCapture(e.pointerId);
      setPercent(percentFromEvent(e));
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      setPercent(percentFromEvent(e));
    });
    const stopDrag = () => { dragging = false; };
    el.addEventListener('pointerup', stopDrag);
    el.addEventListener('pointercancel', stopDrag);
  });
}

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
