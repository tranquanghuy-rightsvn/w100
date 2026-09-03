/* Web100 — main.js */

document.addEventListener('DOMContentLoaded', () => {
  initHeroLeadTyping();
  initMobileNav();
  initDrawerAccordion();
  initNavDropdowns();
  initNavIndicator();
  initFaqAccordion();
  initReveal();
  initToTop();
  initProjectNext();
  initServiceSlider();
  initBeforeAfter();
  initStatCounters();
});

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

/* -------------------------------------------------------------------------- */
function initToTop() {
  const btn = document.querySelector('.to-top');
  if (!btn) return;

  let ticking = false;
  const apply = () => {
    ticking = false;
    btn.classList.toggle('show', window.scrollY > 500);
  };
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(apply);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* --------------------------------------------------------------------------
   Nút "dự án tiếp theo": trượt danh sách dự án sang phải một thẻ, quay lại
   đầu khi đã hết.
   -------------------------------------------------------------------------- */
function initProjectNext() {
  const btn = document.querySelector('.project-next');
  const track = document.querySelector('.project-track');
  if (!btn || !track) return;

  btn.addEventListener('click', () => {
    const card = track.querySelector('.project-card');
    if (!card) return;
    const step = card.getBoundingClientRect().width + 20;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    track.scrollTo({ left: atEnd ? 0 : track.scrollLeft + step, behavior: 'smooth' });
  });
}

/* --------------------------------------------------------------------------
   Slide dịch vụ: mỗi lần 1 slide toàn chiều rộng (scroll-snap), có nút
   trái/phải + dấu chấm đồng bộ theo slide đang hiển thị.
   -------------------------------------------------------------------------- */
function initServiceSlider() {
  const track = document.querySelector('#serviceTrack');
  const dotsWrap = document.querySelector('#serviceDots');
  if (!track || !dotsWrap) return;

  const slides = Array.from(track.querySelectorAll('.service-slide'));
  if (!slides.length) return;

  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'service-dot';
    dot.setAttribute('aria-label', `Đến dịch vụ ${i + 1}`);
    dotsWrap.appendChild(dot);
  });
  const dots = Array.from(dotsWrap.children);

  const currentIndex = () => {
    let closest = 0;
    let minDist = Infinity;
    slides.forEach((slide, i) => {
      const dist = Math.abs(slide.offsetLeft - track.scrollLeft);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    return closest;
  };

  const setActiveDot = (i) => {
    dots.forEach((dot, idx) => dot.classList.toggle('active', idx === i));
  };

  const goTo = (i) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo({ left: slides[clamped].offsetLeft, behavior: 'smooth' });
  };

  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));

  const prevBtn = document.querySelector('.service-arrow--prev');
  const nextBtn = document.querySelector('.service-arrow--next');
  if (prevBtn) prevBtn.addEventListener('click', () => goTo(currentIndex() - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(currentIndex() + 1));

  let ticking = false;
  track.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { setActiveDot(currentIndex()); ticking = false; });
  }, { passive: true });

  setActiveDot(0);
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
