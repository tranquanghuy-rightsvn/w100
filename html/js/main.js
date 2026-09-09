/* Web100 — main.js */

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
});

/* --------------------------------------------------------------------------
   Logo khách hàng — mỗi ô logo chứa sẵn 2 lớp: thẻ <img> trỏ tới
   images/khach-hang/<slug>.png và một wordmark bằng chữ làm lớp đỡ. CSS ẩn
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
   hiện sẵn "...là...", dừng lâu 1 tí, xoá "..." thay bằng "???" (highlight
   màu), dừng 1 nhịp cho thấy rõ, xoá "???" rồi gõ nháp "đích đến cuối
   cùng." (câu "sai" ban đầu), dừng 1 nhịp, xoá hết cụm đó rồi sửa lại
   thành "mục tiêu tối thượng." — riêng "tối thượng." được gõ xong mới bọc
   thêm 1 khối chữ nhật xanh nhạt nghiêng 10°, rơi từ trên cao xuống, nảy
   nhẹ rồi mắc lại đúng lên chữ (chữ đổi màu trắng để đọc được trên khối).
   Kết thúc đứng yên vĩnh viễn, không còn hiệu ứng gì thêm.
   -------------------------------------------------------------------------- */
function initHeroLeadTyping() {
  const el = document.getElementById('heroLead');
  if (!el) return;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const TYPE_MS = 45;
  const DEL_MS = 28;
  const PREFIX = 'Thành công của khách hàng là';

  // Gõ/xoá phần ĐUÔI thuần văn bản — chỉ nối/cắt trực tiếp trên
  // el.textContent hiện có, không quan tâm phần trước đó là gì.
  async function typeAppend(text) {
    for (let i = 0; i < text.length; i++) {
      el.textContent += text[i];
      await sleep(TYPE_MS);
    }
  }
  async function deleteChars(count) {
    for (let i = 0; i < count; i++) {
      el.textContent = el.textContent.slice(0, -1);
      await sleep(DEL_MS);
    }
  }
  // Gõ/xoá "???" bọc trong span highlight — chỉ gọi khi el.textContent
  // đang đúng bằng PREFIX (không còn ký tự nào phía sau).
  async function typeHighlight(text) {
    for (let i = 1; i <= text.length; i++) {
      el.innerHTML = PREFIX + `<span class="lead-highlight">${text.slice(0, i)}</span>`;
      await sleep(TYPE_MS);
    }
  }
  async function deleteHighlight(text) {
    for (let i = text.length - 1; i >= 0; i--) {
      el.innerHTML = i > 0 ? PREFIX + `<span class="lead-highlight">${text.slice(0, i)}</span>` : PREFIX;
      await sleep(DEL_MS);
    }
  }

  async function run() {
    // "..." + gạch nháy (caret) ở cuối câu — nháy đúng 5 lần (CSS
    // animation-iteration-count: 5, mỗi lần 0.5s = 2.5s) rồi mới xoá caret
    // và bắt đầu các bước tiếp theo.
    el.innerHTML = PREFIX + '...<span class="lead-caret">|</span>';
    await sleep(2500);
    el.textContent = PREFIX + '...'; // bỏ caret, về lại text thường

    await deleteChars(3); // xoá "..."
    await typeHighlight('???'); // thay bằng "???" có highlight màu
    await sleep(750);
    await deleteHighlight('???'); // xoá "???", el.textContent về lại đúng PREFIX

    await typeAppend(' đích đến cuối cùng?'); // gõ nháp câu "sai" ban đầu
    await sleep(900);
    await deleteChars(20); // xoá hết cụm vừa gõ để sửa lại

    await typeAppend(' mục tiêu '); // gõ phần đầu của câu đúng
    // Gõ "tối thượng." dạng thường trước, gõ xong mới bọc khối rơi.
    const finalWord = 'tối thượng!';
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
    if (modal) btn.addEventListener('click', () => openModal(modal));
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

  // Site tĩnh, chưa có backend nhận form — chặn submit thật, đổi sang
  // trạng thái "đã gửi" ngay trong popup.
  document.querySelectorAll('.modal__form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const modal = form.closest('.modal');
      const body = form.closest('.modal__body');
      const done = modal && modal.querySelector('.modal__done');
      if (body) body.hidden = true;
      if (done) done.hidden = false;
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
