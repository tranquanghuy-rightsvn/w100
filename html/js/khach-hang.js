/* Web100 — khach-hang.js (bộ lọc ngành nghề) */

document.addEventListener('DOMContentLoaded', () => {
  initKhFilters();
});

function initKhFilters() {
  const filters = document.querySelectorAll('.kh-filter');
  const cards = document.querySelectorAll('#khGrid .project-card');
  const empty = document.getElementById('khEmpty');
  if (!filters.length || !cards.length) return;

  filters.forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

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
}
