/* Web100 — blog.js (bộ lọc chủ đề + form đăng ký nhận tin) */

document.addEventListener('DOMContentLoaded', () => {
  initBlogFilters();
  initNewsletterForm();
});

function initBlogFilters() {
  const filters = document.querySelectorAll('.blog-filter');
  const cards = document.querySelectorAll('#blogGrid .blog-card');
  const empty = document.getElementById('blogEmpty');
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

/* Trang tĩnh, chưa có backend nhận email — chỉ phản hồi UI cho người dùng
   thấy hành động đã được ghi nhận, không gửi request nào đi. */
function initNewsletterForm() {
  const form = document.getElementById('blogNewsletterForm');
  const note = document.getElementById('blogNewsletterNote');
  if (!form || !note) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input[type="email"]');
    note.textContent = `Cảm ơn bạn! Chúng tôi sẽ gửi bài viết mới đến ${input.value}.`;
    form.reset();
  });
}
