/* Web100 — khach-hang.js (bộ lọc ngành nghề + phân trang, tối đa 9 khách hàng/trang) */

document.addEventListener('DOMContentLoaded', () => {
  initKhFilters();
});

function initKhFilters() {
  const PAGE_SIZE = 9;
  const filters = document.querySelectorAll('.kh-filter');
  const cards = Array.from(document.querySelectorAll('#khGrid .client-card'));
  const empty = document.getElementById('khEmpty');
  const pagination = document.getElementById('khPagination');
  if (!cards.length) return;

  let currentFilter = 'all';
  let currentPage = 1;

  function getFiltered() {
    return currentFilter === 'all'
      ? cards
      : cards.filter((card) => card.dataset.category === currentFilter);
  }

  function render() {
    const filtered = getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    cards.forEach((card) => { card.style.display = 'none'; });

    const start = (currentPage - 1) * PAGE_SIZE;
    filtered.slice(start, start + PAGE_SIZE).forEach((card) => { card.style.display = ''; });

    if (empty) empty.classList.toggle('is-visible', filtered.length === 0);
    renderPagination(totalPages);
  }

  function goToPage(page) {
    currentPage = page;
    render();
    if (pagination) pagination.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderPagination(totalPages) {
    if (!pagination) return;
    pagination.innerHTML = '';
    if (totalPages <= 1) return;

    const makeBtn = (label, page, { active = false, disabled = false, isArrow = false } = {}) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kh-page' + (isArrow ? ' kh-page--arrow' : '') + (active ? ' is-active' : '');
      btn.innerHTML = label;
      if (active) btn.setAttribute('aria-current', 'page');
      if (disabled) {
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => goToPage(page));
      }
      return btn;
    };

    pagination.appendChild(
      makeBtn('&larr;', currentPage - 1, { disabled: currentPage === 1, isArrow: true })
    );
    for (let p = 1; p <= totalPages; p += 1) {
      pagination.appendChild(makeBtn(String(p), p, { active: p === currentPage }));
    }
    pagination.appendChild(
      makeBtn('&rarr;', currentPage + 1, { disabled: currentPage === totalPages, isArrow: true })
    );
  }

  filters.forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      currentFilter = btn.dataset.filter;
      currentPage = 1;
      render();
    });
  });

  render();
}
