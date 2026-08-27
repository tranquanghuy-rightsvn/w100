/* Web100 — kho-templates.js (bộ lọc danh mục + popup xem demo) */

document.addEventListener('DOMContentLoaded', () => {
  initTplFilters();
  initTplLightbox();
});

/* --------------------------------------------------------------------------
   Bộ lọc danh mục: khối tô nền (.tpl-filter-indicator) trượt tới nút đang
   active bằng transform, đo vị trí qua getBoundingClientRect() nên chạy
   đúng ở cả layout dọc (desktop) lẫn hàng ngang (mobile, xem media query
   trong kho-templates.css) mà không cần biết flex-direction hiện tại.
   -------------------------------------------------------------------------- */
function initTplFilters() {
  const filters = document.querySelectorAll('.tpl-filter');
  const cards = document.querySelectorAll('.tpl-card');
  const empty = document.getElementById('tplEmpty');
  const wrap = document.getElementById('tplFilters');
  const indicator = document.getElementById('tplFilterIndicator');
  if (!filters.length || !cards.length) return;

  const moveIndicator = (btn, animate) => {
    if (!indicator || !wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const rect = btn.getBoundingClientRect();
    indicator.style.transition = animate ? '' : 'none';
    indicator.style.width = `${rect.width}px`;
    indicator.style.height = `${rect.height}px`;
    indicator.style.transform = `translate(${rect.left - wrapRect.left}px, ${rect.top - wrapRect.top}px)`;
  };

  filters.forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      moveIndicator(btn, true);

      const filter = btn.dataset.filter;
      let visibleCount = 0;
      cards.forEach((card) => {
        const show = filter === 'all' || card.dataset.category === filter;
        card.style.display = show ? '' : 'none';
        if (show) visibleCount += 1;
      });
      if (empty) empty.classList.toggle('is-visible', visibleCount === 0);
    });
  });

  const placeInitial = () => {
    const active = document.querySelector('.tpl-filter.is-active');
    if (active) moveIndicator(active, false);
  };
  placeInitial();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(placeInitial, 120);
  });
}

/* --------------------------------------------------------------------------
   Popup "Xem demo": nhân bản đúng khối preview thật của thẻ (không phải ảnh
   chụp riêng) để phóng to xem — nếu thẻ đó là kiểu so sánh trước/sau
   (data-before-after), gọi lại initBeforeAfter() (khai báo trong main.js,
   nạp trước file này nên có sẵn ở global scope) để bản sao trong popup vẫn
   kéo được như bản gốc.
   -------------------------------------------------------------------------- */
function initTplLightbox() {
  const lightbox = document.getElementById('tplLightbox');
  const previewEl = document.getElementById('tplLightboxPreview');
  const tagEl = document.getElementById('tplLightboxTag');
  const titleEl = document.getElementById('tplLightboxTitle');
  const descEl = document.getElementById('tplLightboxDesc');
  if (!lightbox || !previewEl) return;

  const open = (card) => {
    const thumb = card.querySelector('.tpl-thumb');
    previewEl.innerHTML = thumb ? thumb.outerHTML : '';
    if (typeof initBeforeAfter === 'function') initBeforeAfter();

    tagEl.textContent = card.querySelector('.tpl-tag').textContent;
    titleEl.textContent = card.querySelector('h3').textContent;
    descEl.textContent = card.querySelector('.tpl-desc').textContent;

    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  document.querySelectorAll('.tpl-demo-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.tpl-card');
      if (card) open(card);
    });
  });

  lightbox.querySelector('.tpl-lightbox__close').addEventListener('click', close);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}
