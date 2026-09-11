/* Web100 — mau-website-dep.js (bộ lọc danh mục + popup xem demo) */

document.addEventListener('DOMContentLoaded', () => {
  initTplFilters();
});

/* --------------------------------------------------------------------------
   Bộ lọc danh mục: khối tô nền (.tpl-filter-indicator) trượt tới nút đang
   active bằng transform, đo vị trí qua getBoundingClientRect() nên chạy
   đúng ở cả layout dọc (desktop) lẫn hàng ngang (mobile, xem media query
   trong mau-website-dep.css) mà không cần biết flex-direction hiện tại.
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

  // 1 mẫu có thể gắn nhiều danh mục cùng lúc: data-category="ban-hang
  // thuc-pham" (cách nhau bằng dấu cách) — khớp nếu danh mục đang chọn nằm
  // trong danh sách đó.
  const applyFilter = (filter, animate) => {
    filters.forEach((b) => b.classList.toggle('is-active', b.dataset.filter === filter));
    const activeBtn = document.querySelector('.tpl-filter.is-active');
    if (activeBtn) moveIndicator(activeBtn, animate);

    let visibleCount = 0;
    cards.forEach((card) => {
      const cardCats = (card.dataset.category || '').split(' ').filter(Boolean);
      const show = filter === 'all' || cardCats.includes(filter);
      card.style.display = show ? '' : 'none';
      if (show) visibleCount += 1;
    });
    if (empty) empty.classList.toggle('is-visible', visibleCount === 0);
  };

  filters.forEach((btn) => {
    btn.addEventListener('click', () => applyFilter(btn.dataset.filter, true));
  });

  // "Xem thêm danh mục": chỉ 5 danh mục nổi bật hiện sẵn, 25 danh mục còn
  // lại (đánh dấu data-more) ẩn cho tới khi bấm nút này.
  const moreFilters = document.querySelectorAll('.tpl-filter[data-more]');
  const toggleBtn = document.getElementById('tplFiltersToggle');
  const setMoreOpen = (open) => {
    moreFilters.forEach((btn) => { btn.hidden = !open; });
    if (toggleBtn) {
      toggleBtn.classList.toggle('is-open', open);
      toggleBtn.querySelector('span').textContent = open ? 'Thu gọn' : 'Xem thêm danh mục';
    }
    // Ẩn/hiện các nút "Xem thêm" làm nút đang active trôi sang vị trí khác
    // trong layout flex-wrap — phải định vị lại khối tô nền theo vị trí mới,
    // nếu không nó đứng yên ở toạ độ cũ và đè lên nút khác (xem ảnh lỗi).
    const activeBtn = document.querySelector('.tpl-filter.is-active');
    if (activeBtn) moveIndicator(activeBtn, true);
  };
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => setMoreOpen(!toggleBtn.classList.contains('is-open')));
  }

  // Cho phép mở thẳng 1 danh mục qua ?category=<slug> — dùng khi gửi link
  // cho khách hàng tham khảo riêng ngành của họ. Slug không khớp nút nào
  // thì bỏ qua, giữ mặc định "Tất cả". Nếu danh mục đó đang nằm trong nhóm
  // "Xem thêm" thì tự mở rộng ra luôn để thấy nút đang active.
  const params = new URLSearchParams(window.location.search);
  const requestedCategory = params.get('category');
  const requestedBtn = requestedCategory ? document.querySelector(`.tpl-filter[data-filter="${CSS.escape(requestedCategory)}"]`) : null;
  const initialFilter = requestedBtn ? requestedCategory : 'all';
  if (requestedBtn && requestedBtn.hasAttribute('data-more')) setMoreOpen(true);
  applyFilter(initialFilter, false);

  // Resize chỉ cần định vị lại khối tô nền theo đúng nút đang active, không
  // chạy lại bộ lọc (tránh phá trạng thái người dùng vừa chọn).
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const active = document.querySelector('.tpl-filter.is-active');
      if (active) moveIndicator(active, false);
    }, 120);
  });
}
