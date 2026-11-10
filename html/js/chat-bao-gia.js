/* Chat AI báo giá ở trang /lien-he/ (worker/chat.js, kịch bản: quy-tac-ai.md).
   - Gửi toàn bộ hội thoại (user/assistant) lên POST /api/chat; câu chào đầu chỉ hiển thị, không gửi.
   - Khi phản hồi có bao_gia: mở popup bảng giá (URL mẫu, Giá, nút Xem thử) và gắn nút mở lại dưới tin. */
(function () {
  'use strict';
  var log = document.getElementById('lh-chat-log');
  var form = document.getElementById('lh-chat-form');
  var chips = document.getElementById('lh-chat-chips');
  if (!log || !form) return;

  var ZALO = '0964074043';
  var STORE_KEY = 'w100_chat_v1';
  var input = form.querySelector('input[name="q"]');
  var sendBtn = form.querySelector('button[type="submit"]');
  var messages = []; // [{role, content}] gửi lên API
  var busy = false;
  var popup = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function vnd(v) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
  function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } }
  function scrollLog() { log.scrollTop = log.scrollHeight; }

  function addMsg(kind, text) {
    var el = document.createElement('div');
    el.className = 'lh-chat__msg lh-chat__msg--' + kind;
    el.textContent = text;
    log.appendChild(el);
    scrollLog();
    return el;
  }
  function addTableBtn(baoGia) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lh-chat__table-btn';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/></svg>'
      + 'Xem bảng giá ' + esc(baoGia.nganh.ten) + ' (' + baoGia.bang_gia.length + ' mẫu)';
    btn.addEventListener('click', function () { openPopup(baoGia); });
    log.appendChild(btn);
    scrollLog();
  }

  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ messages: messages, html: log.innerHTML.slice(0, 60000) })); } catch (e) { /* bỏ qua */ }
  }
  function restore() {
    try {
      var d = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
      if (!d || !Array.isArray(d.messages) || !d.messages.length) return;
      messages = d.messages;
      // Chỉ khôi phục tin nhắn, không khôi phục nút bảng giá (dữ liệu bảng không lưu).
      log.innerHTML = '';
      var tmp = document.createElement('div');
      tmp.innerHTML = d.html;
      tmp.querySelectorAll('.lh-chat__msg').forEach(function (m) {
        if (!m.classList.contains('lh-chat__msg--typing')) log.appendChild(m);
      });
      if (chips) chips.hidden = true;
      scrollLog();
    } catch (e) { /* bỏ qua */ }
  }

  /* ---------- Popup bảng giá ---------- */
  function closePopup() {
    if (!popup) return;
    var p = popup; popup = null;
    p.classList.remove('is-open');
    setTimeout(function () { p.remove(); }, 250);
    document.body.style.overflow = '';
  }
  function openPopup(bg) {
    closePopup();
    var rows = bg.bang_gia.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td>'
        + '<td class="bg-popup__url">' + esc(host(r.url)) + '</td>'
        + '<td class="bg-popup__gia">' + esc(vnd(r.gia_vnd)) + '</td>'
        + '<td><a class="bg-popup__xem" href="' + esc(r.url) + '" target="_blank" rel="noopener nofollow">Xem thử'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M8 7h9v9"/></svg></a></td></tr>';
    }).join('');
    var note = bg.ly_do === 'gan_nhat'
      ? '<p class="bg-popup__note">Ngành của bạn chưa có trong dữ liệu, đây là ngành gần nhất để bạn tham khảo.</p>'
      : '';
    var gia = bg.nganh.gia_thap_nhat && bg.nganh.gia_cao_nhat
      ? vnd(bg.nganh.gia_thap_nhat) + ' đến ' + vnd(bg.nganh.gia_cao_nhat) : '';
    popup = document.createElement('div');
    popup.className = 'modal-overlay bg-popup';
    popup.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="Bảng giá website">'
      + '<button class="modal__close" type="button" aria-label="Đóng">&times;</button>'
      + '<h3 class="modal__title">Bảng giá website: ' + esc(bg.nganh.ten) + '</h3>'
      + '<p>' + bg.bang_gia.length + ' mẫu tham khảo' + (gia ? ', giá từ ' + esc(gia) : '') + '. Bấm Xem thử để mở website mẫu, chọn mẫu ưng rồi nói với AI hoặc nhắn Zalo.</p>'
      + note
      + '<div class="bg-popup__wrap"><table><thead><tr><th>#</th><th>Website mẫu</th><th>Giá</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<div class="bg-popup__foot"><small>Giá là chi phí làm website tương đương mẫu, chưa gồm tên miền và hosting.</small>'
      + '<a class="btn btn-primary btn-sm" href="https://zalo.me/84' + ZALO.slice(1) + '" target="_blank" rel="noopener">Nhắn Zalo ' + ZALO + '</a></div>'
      + '</div>';
    document.body.appendChild(popup);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { popup && popup.classList.add('is-open'); });
    popup.querySelector('.modal__close').addEventListener('click', closePopup);
    popup.addEventListener('click', function (e) { if (e.target === popup) closePopup(); });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePopup(); });

  /* ---------- Gửi tin ---------- */
  function setBusy(v) {
    busy = v;
    sendBtn.disabled = v;
    input.disabled = v;
  }
  function send(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    if (chips) chips.hidden = true;
    addMsg('user', text);
    messages.push({ role: 'user', content: text });
    input.value = '';
    setBusy(true);
    var typing = addMsg('typing', '');
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages }),
    })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        typing.remove();
        var d = res.d || {};
        var reply = d.reply || ('Mình đang gặp trục trặc, bạn nhắn Zalo ' + ZALO + ' nhé.');
        if (!d.ok) {
          addMsg('error', reply);
          messages.pop(); // không giữ tin lỗi trong hội thoại gửi lên
          if (res.status === 400 && /quá dài/.test(reply)) { messages = []; }
          return;
        }
        addMsg('ai', reply);
        messages.push({ role: 'assistant', content: reply });
        if (d.bao_gia && d.bao_gia.bang_gia && d.bao_gia.bang_gia.length) {
          addTableBtn(d.bao_gia);
          openPopup(d.bao_gia);
        }
      })
      .catch(function () {
        typing.remove();
        messages.pop();
        addMsg('error', 'Không kết nối được, bạn thử lại hoặc nhắn Zalo ' + ZALO + ' nhé.');
      })
      .then(function () {
        setBusy(false);
        input.focus();
        save();
      });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
  if (chips) {
    chips.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-q]');
      if (b) send(b.getAttribute('data-q'));
    });
  }
  restore();
})();
