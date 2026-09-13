/* --------------------------------------------------------------------------
   kiem-tra-seo-tong-the-website.js — mô phỏng quy trình audit SEO ngay trên trình duyệt.
   Không có backend thật: mọi bước "kiểm tra" chỉ là hiệu ứng chờ (setTimeout)
   với thời lượng ngẫu nhiên, tổng thời gian rơi vào khoảng 2 phút. Thông tin
   người dùng nhập (họ tên, SĐT, email, domain) chỉ hiển thị lại trong tóm tắt
   kết quả, không được gửi đi bất cứ đâu.
   -------------------------------------------------------------------------- */
function initSeoCheckTool() {
  const form = document.getElementById('seotoolForm');
  if (!form) return;

  const card = document.getElementById('seotoolCard');
  const stepFormEl = document.getElementById('seotoolStepForm');
  const stepProgressEl = document.getElementById('seotoolStepProgress');
  const progressVerbEl = document.getElementById('seotoolProgressVerb');

  const stepsListEl = document.getElementById('seotoolSteps');
  const barFillEl = document.getElementById('seotoolBarFill');
  const percentEl = document.getElementById('seotoolPercent');
  const timerEl = document.getElementById('seotoolTimer');
  const domainLabelEl = document.getElementById('seotoolDomainLabel');

  const summaryEl = document.getElementById('seotoolSummary');
  const retryBtn = document.getElementById('seotoolRetry');
  const doneModalEl = document.getElementById('seotoolDoneModal');

  const STEPS = [
    // Giai đoạn 1 — Nền tảng kỹ thuật & khả năng thu thập dữ liệu (Technical/Crawlability)
    'Đang kết nối tới domain của bạn',
    'Kiểm tra chứng chỉ bảo mật SSL/HTTPS',
    'Kiểm tra khả năng hiển thị trên thiết bị di động',
    'Kiểm tra tốc độ tải trang (Core Web Vitals)',
    'Kiểm tra tốc độ phản hồi máy chủ (TTFB)',
    'Kiểm tra điểm Lighthouse (Performance, SEO, Accessibility)',
    'Kiểm tra sitemap.xml &amp; robots.txt',
    'Kiểm tra khả năng lập chỉ mục (index) trên Google',
    'Kiểm tra liên kết gãy và lỗi 404',

    // Giai đoạn 2 — SEO Onpage
    'Kiểm tra cấu trúc thẻ tiêu đề &amp; meta description',
    'Kiểm tra dữ liệu có cấu trúc (Schema Markup)',
    'Kiểm tra tối ưu hình ảnh (alt text, dung lượng)',
    'Kiểm tra nội dung trùng lặp (duplicate content)',
    'Kiểm tra cấu trúc liên kết nội bộ (internal linking)',

    // Giai đoạn 3 — Từ khoá & Offpage
    'Kiểm tra từ khoá chính của website',
    'Kiểm tra từ khoá phụ và mật độ phân bổ',
    'Kiểm tra thứ hạng từ khoá chính trên Google',
    'Kiểm tra backlink trỏ về website',
    'Phân tích đối thủ cạnh tranh cùng từ khoá',

    // Giai đoạn 4 — Trải nghiệm & đề xuất cải thiện
    'Kiểm tra trải nghiệm người dùng (UX) tổng thể',
    'Phân tích các điểm thiết kế giao diện chưa tối ưu',
    'Đánh giá và đề xuất các điểm cần cải thiện',
    'Dự đoán thứ hạng từ khoá sau khi cải thiện',
    'Tổng hợp và biên soạn báo cáo SEO',
  ];

  let timerInterval = null;
  let elapsedSeconds = 0;
  let running = false;

  function showStep(el) {
    [stepFormEl, stepProgressEl].forEach((s) => { s.hidden = s !== el; });
  }

  // Popup kết quả dùng chung cơ chế .modal-overlay/.modal__close/Escape/click-nền
  // đã có sẵn trong js/main.js (initTemplateActions) — ở đây chỉ tự mở popup
  // theo lập trình vì không có nút [data-open-modal] nào được bấm.
  function openDoneModal() {
    if (!doneModalEl) return;
    doneModalEl.hidden = false;
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => doneModalEl.classList.add('is-open'));
  }

  function closeDoneModal() {
    if (!doneModalEl || doneModalEl.hidden) return;
    doneModalEl.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    setTimeout(() => { doneModalEl.hidden = true; }, 250);
  }

  function renderSteps() {
    stepsListEl.innerHTML = STEPS.map((label, i) => `
      <div class="seotool-step" data-step="${i}">
        <span class="seotool-step__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>
        </span>
        <span>${label}</span>
      </div>
    `).join('');
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function startTimer() {
    elapsedSeconds = 0;
    timerEl.textContent = formatTime(0);
    timerInterval = setInterval(() => {
      elapsedSeconds += 1;
      timerEl.textContent = formatTime(elapsedSeconds);
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  function randomStepDuration() {
    // 3 - 8s / bước, 24 bước => trung bình khoảng 2 phút tổng.
    return 3000 + Math.random() * 5000;
  }

  function runStep(index) {
    if (!running) return;
    const items = stepsListEl.querySelectorAll('.seotool-step');
    if (index > 0) {
      items[index - 1].classList.remove('is-active');
      items[index - 1].classList.add('is-done');
    }
    const percent = Math.round((index / STEPS.length) * 100);
    barFillEl.style.width = `${percent}%`;
    percentEl.textContent = `${percent}%`;

    if (index >= STEPS.length) {
      barFillEl.style.width = '100%';
      percentEl.textContent = '100%';
      stopTimer();
      setTimeout(finish, 500);
      return;
    }

    items[index].classList.add('is-active');
    setTimeout(() => runStep(index + 1), randomStepDuration());
  }

  function finish() {
    // Giữ nguyên checklist đã hoàn thành (không ẩn/thay thế) — chỉ đổi tiêu đề
    // từ "Đang kiểm tra..." sang "Đã kiểm tra xong..." rồi mở popup thông báo.
    if (progressVerbEl) progressVerbEl.textContent = 'Đã kiểm tra xong domain';
    running = false;
    openDoneModal();
  }

  function resetTool() {
    running = false;
    stopTimer();
    closeDoneModal();
    form.reset();
    form.querySelectorAll('.seotool-error').forEach((el) => { el.textContent = ''; el.classList.remove('is-visible'); });
    form.querySelectorAll('input').forEach((el) => el.classList.remove('is-invalid'));
    if (progressVerbEl) progressVerbEl.textContent = 'Đang kiểm tra domain';
    showStep(stepFormEl);
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /^[0-9+\s.()-]{8,15}$/;
  const DOMAIN_RE = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;

  // Cho phép người dùng dán nguyên URL (https://www.web100.vn/abc?x=1) — tự
  // bóc tách chỉ lấy phần domain trước khi validate, tránh báo lỗi vô lý.
  function normalizeDomain(raw) {
    let value = raw.trim();
    value = value.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, ''); // bỏ scheme (http://, https://...)
    value = value.split(/[/?#]/)[0]; // bỏ path/query/hash
    value = value.replace(/^www\./i, ''); // bỏ tiền tố www.
    value = value.split('@').pop(); // phòng trường hợp dạng user@host
    value = value.split(':')[0]; // bỏ port nếu có
    return value.toLowerCase();
  }

  function setFieldError(name, message) {
    const input = form.querySelector(`[name="${name}"]`);
    const errorEl = form.querySelector(`[data-error-for="${name}"]`);
    if (!input || !errorEl) return;
    if (message) {
      input.classList.add('is-invalid');
      errorEl.textContent = message;
      errorEl.classList.add('is-visible');
    } else {
      input.classList.remove('is-invalid');
      errorEl.textContent = '';
      errorEl.classList.remove('is-visible');
    }
  }

  function validateForm(values) {
    let firstInvalid = null;
    const checks = [
      [!values.hoten, 'hoten', 'Vui lòng nhập họ tên.'],
      [!values.dienthoai, 'dienthoai', 'Vui lòng nhập số điện thoại.'],
      [values.dienthoai && !PHONE_RE.test(values.dienthoai), 'dienthoai', 'Số điện thoại không hợp lệ.'],
      [!values.email, 'email', 'Vui lòng nhập email.'],
      [values.email && !EMAIL_RE.test(values.email), 'email', 'Email không hợp lệ.'],
      [!values.domain, 'domain', 'Vui lòng nhập domain cần check.'],
      [values.domain && !DOMAIN_RE.test(values.domain), 'domain', 'Domain không hợp lệ, VD: web100.vn'],
    ];

    ['hoten', 'dienthoai', 'email', 'domain'].forEach((name) => setFieldError(name, ''));

    checks.forEach(([isInvalid, name, message]) => {
      if (isInvalid && !form.querySelector(`[data-error-for="${name}"]`).textContent) {
        setFieldError(name, message);
        if (!firstInvalid) firstInvalid = name;
      }
    });

    return !firstInvalid;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (running) return;

    const data = new FormData(form);
    const hoten = (data.get('hoten') || '').toString().trim();
    const domain = normalizeDomain((data.get('domain') || '').toString());
    const email = (data.get('email') || '').toString().trim();
    const dienthoai = (data.get('dienthoai') || '').toString().trim();

    if (!validateForm({ hoten, domain, email, dienthoai })) return;

    form.querySelector('[name="domain"]').value = domain;
    domainLabelEl.textContent = domain;
    summaryEl.innerHTML = `
      <span><strong>Họ tên:</strong> ${hoten}</span>
      <span><strong>Số điện thoại:</strong> ${dienthoai}</span>
      <span><strong>Email nhận báo cáo:</strong> ${email}</span>
      <span><strong>Domain đã kiểm tra:</strong> ${domain}</span>
    `;

    renderSteps();
    running = true;
    showStep(stepProgressEl);
    startTimer();
    runStep(0);
  });

  retryBtn?.addEventListener('click', resetTool);

  form.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => setFieldError(input.name, ''));
  });

  showStep(stepFormEl);
}

document.addEventListener('DOMContentLoaded', initSeoCheckTool);
