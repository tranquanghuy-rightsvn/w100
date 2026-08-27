/* Web100 — hieu-ung-dep.js (bộ lọc nhóm hiệu ứng + tương tác chuột/chạm) */

document.addEventListener('DOMContentLoaded', () => {
  initFxFilters();
  initFxTapToggle();
  initFxTilt();
  initFxSpotlight();
});

/* -------------------------------------------------------------------------- */
function initFxFilters() {
  const filters = document.querySelectorAll('.fx-filter');
  const cards = document.querySelectorAll('#fxGrid .fx-card');
  if (!filters.length || !cards.length) return;

  filters.forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      const filter = btn.dataset.filter;
      cards.forEach((card) => {
        const show = filter === 'all' || card.dataset.category === filter;
        card.style.display = show ? '' : 'none';
      });
    });
  });
}

/* --------------------------------------------------------------------------
   Chạm để bật/tắt hiệu ứng trên điện thoại (không có :hover thật) — mọi CSS
   hiệu ứng trong hieu-ung-dep.css đều phản ứng với cả :hover lẫn .is-active.
   -------------------------------------------------------------------------- */
function initFxTapToggle() {
  document.querySelectorAll('.fx-trigger').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      el.classList.toggle('is-active');
    });
  });
}

/* -------------------------------------------------------------------------- */
function initFxTilt() {
  const el = document.getElementById('fxTilt');
  if (!el) return;

  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(400px) rotateX(${py * -18}deg) rotateY(${px * 18}deg)`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = 'perspective(400px) rotateX(0) rotateY(0)';
  });
}

/* -------------------------------------------------------------------------- */
function initFxSpotlight() {
  const el = document.getElementById('fxSpotlight');
  if (!el) return;

  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--x', (e.clientX - rect.left) + 'px');
    el.style.setProperty('--y', (e.clientY - rect.top) + 'px');
  });
}
