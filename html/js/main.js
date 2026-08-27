/* Web100 — main.js */

document.addEventListener('DOMContentLoaded', () => {
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
});

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
