/* Chat AI báo giá ở trang /lien-he/ (worker/chat.js, kịch bản: quy-tac-ai.md).
   - Gửi toàn bộ hội thoại (user/assistant) lên POST /api/chat; câu chào đầu chỉ hiển thị, không gửi.
   - Khi phản hồi có bao_gia: mở popup bảng giá (Website mẫu, Giá, Xem thử, Chọn mẫu này).
   - "Xem thử" tô màu dòng + nhãn "Đã xem" (nhớ trong localStorage theo URL, để khách quay lại vẫn thấy)
     và lúc đó mới hiện nút "Chọn mẫu này" ở dòng đó (chưa xem thì chưa cho chọn).
   - "Chọn mẫu này": đánh dấu dòng, đóng popup, tự gửi tin "Mình chọn mẫu ..." để AI xác nhận và dẫn sang Zalo.
   - Hội thoại + các bảng giá đã nhận lưu sessionStorage (dạng entries) để tải lại trang vẫn còn. */
(function () {
  'use strict';
  var log = document.getElementById('lh-chat-log');
  var form = document.getElementById('lh-chat-form');
  var chips = document.getElementById('lh-chat-chips');
  if (!log || !form) return;

  var ZALO = '0964074043';
  var ZALO_URL = 'https://zalo.me/84' + ZALO.slice(1);
  var STORE_KEY = 'w100_chat_v2';
  var VIEWED_KEY = 'w100_mau_da_xem';
  var CHOSEN_KEY = 'w100_mau_da_chon';
  var input = form.querySelector('input[name="q"]');
  var sendBtn = form.querySelector('button[type="submit"]');
  var greeting = log.innerHTML; // câu chào tĩnh trong HTML
  var messages = []; // [{role, content}] gửi lên API
  var entries = [];  // [{kind:'user'|'ai'|'error'|'table'|'zalo', text?, bao_gia?}] để vẽ lại
  var busy = false;
  var popup = null;
  var viewed = loadJson(VIEWED_KEY, {});   // { url: thời điểm xem }
  var chosen = loadJson(CHOSEN_KEY, null); // { url, gia_vnd, nganh }

  var ICON_EXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M8 7h9v9"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 12 5 5 9-10"/></svg>';
  var ICON_TABLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/></svg>';

  function loadJson(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key) || 'null'); return v === null ? fallback : v; } catch (e) { return fallback; }
  }
  function saveJson(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function vnd(v) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
  function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } }
  function scrollLog() { log.scrollTop = log.scrollHeight; }

  /* ---------- Vẽ từng mục trong khung chat ---------- */
  function renderEntry(e) {
    var el;
    if (e.kind === 'table') {
      el = document.createElement('button');
      el.type = 'button';
      el.className = 'lh-chat__table-btn';
      el.innerHTML = ICON_TABLE + 'Xem bảng giá ' + esc(e.bao_gia.nganh.ten) + ' (' + e.bao_gia.bang_gia.length + ' mẫu)';
      el.addEventListener('click', function () { openPopup(e.bao_gia); });
    } else if (e.kind === 'zalo') {
      el = document.createElement('a');
      el.className = 'lh-chat__table-btn lh-chat__table-btn--zalo';
      el.href = ZALO_URL;
      el.target = '_blank';
      el.rel = 'noopener';
      el.textContent = 'Nhắn Zalo ' + ZALO + ' để bắt đầu';
    } else {
      el = document.createElement('div');
      el.className = 'lh-chat__msg lh-chat__msg--' + e.kind;
      el.textContent = e.text;
    }
    log.appendChild(el);
    scrollLog();
    return el;
  }
  function addEntry(e) { entries.push(e); var el = renderEntry(e); save(); return el; }
  function addTyping() {
    var el = document.createElement('div');
    el.className = 'lh-chat__msg lh-chat__msg--typing';
    log.appendChild(el);
    scrollLog();
    return el;
  }

  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ messages: messages, entries: entries.slice(-60) })); } catch (e) { /* bỏ qua */ }
  }
  function restore() {
    try {
      var d = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
      if (!d || !Array.isArray(d.messages) || !d.messages.length) return;
      messages = d.messages;
      entries = Array.isArray(d.entries) ? d.entries : [];
      log.innerHTML = greeting;
      entries.forEach(renderEntry);
      if (chips) chips.hidden = true;
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
  function rowHtml(r, i, bg) {
    var isViewed = !!viewed[r.url];
    var isChosen = chosen && chosen.url === r.url;
    return '<tr data-url="' + esc(r.url) + '" class="' + (isChosen ? 'is-chosen' : isViewed ? 'is-viewed' : '') + '">'
      + '<td>' + (i + 1) + '</td>'
      + '<td class="bg-popup__url">' + esc(host(r.url))
      + '<span class="bg-popup__badge bg-popup__badge--viewed"' + (isViewed && !isChosen ? '' : ' hidden') + '>Đã xem</span>'
      + '<span class="bg-popup__badge bg-popup__badge--chosen"' + (isChosen ? '' : ' hidden') + '>' + ICON_CHECK + 'Đã chọn</span>'
      + '</td>'
      + '<td class="bg-popup__gia">' + esc(vnd(r.gia_vnd)) + '</td>'
      + '<td class="bg-popup__acts">'
      + '<a class="bg-popup__xem" href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer nofollow">Xem thử' + ICON_EXT + '</a>'
      + '<button type="button" class="bg-popup__chon"' + (isChosen ? ' disabled' : '') + (isViewed || isChosen ? '' : ' hidden') + '>' + (isChosen ? ICON_CHECK + 'Đã chọn' : 'Chọn mẫu này') + '</button>'
      + '</td></tr>';
  }
  function openPopup(bg) {
    closePopup();
    var rows = bg.bang_gia.map(function (r, i) { return rowHtml(r, i, bg); }).join('');
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
      + '<p>' + bg.bang_gia.length + ' mẫu tham khảo' + (gia ? ', giá từ ' + esc(gia) : '') + '. Bấm Xem thử để mở website mẫu, dòng đã xem sẽ được đánh dấu và hiện nút Chọn mẫu này.</p>'
      + note
      + '<div class="bg-popup__wrap"><table><thead><tr><th>#</th><th>Website mẫu</th><th>Giá</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<div class="bg-popup__foot"><small>Giá là chi phí làm website tương đương mẫu, chưa gồm tên miền và hosting.</small>'
      + '<a class="btn btn-primary btn-sm" href="' + ZALO_URL + '" target="_blank" rel="noopener">Nhắn Zalo ' + ZALO + '</a></div>'
      + '</div>';
    document.body.appendChild(popup);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { popup && popup.classList.add('is-open'); });
    popup.querySelector('.modal__close').addEventListener('click', closePopup);
    popup.addEventListener('click', function (e) {
      if (e.target === popup) { closePopup(); return; }
      var tr = e.target.closest('tr[data-url]');
      if (!tr) return;
      var url = tr.getAttribute('data-url');
      if (e.target.closest('.bg-popup__xem')) { markViewed(tr, url); return; }
      var btn = e.target.closest('.bg-popup__chon');
      if (btn && !btn.disabled) chooseRow(url, bg);
    });
    // Cuộn tới dòng đã chọn / đã xem gần nhất để khách quay lại thấy ngay
    var focusRow = popup.querySelector('tr.is-chosen') || popup.querySelector('tr.is-viewed');
    if (focusRow) setTimeout(function () { focusRow.scrollIntoView({ block: 'center' }); }, 300);
  }
  function markViewed(tr, url) {
    viewed[url] = Date.now();
    saveJson(VIEWED_KEY, viewed);
    if (!tr.classList.contains('is-chosen')) {
      tr.classList.add('is-viewed');
      tr.querySelector('.bg-popup__badge--viewed').hidden = false;
    }
    tr.querySelector('.bg-popup__chon').hidden = false; // xem rồi mới được chọn
  }
  function chooseRow(url, bg) {
    var row = null;
    for (var i = 0; i < bg.bang_gia.length; i += 1) if (bg.bang_gia[i].url === url) row = bg.bang_gia[i];
    if (!row) return;
    chosen = { url: url, gia_vnd: row.gia_vnd, nganh: bg.nganh.ten };
    saveJson(CHOSEN_KEY, chosen);
    closePopup();
    send('Mình chọn mẫu ' + host(url) + ' (giá ' + vnd(row.gia_vnd) + ') của ngành ' + bg.nganh.ten + '.', { zalo: true });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePopup(); });

  /* ---------- Gửi tin ---------- */
  function setBusy(v) {
    busy = v;
    sendBtn.disabled = v;
    input.disabled = v;
  }
  function send(text, opts) {
    opts = opts || {};
    text = (text || '').trim();
    if (!text || busy) return;
    if (chips) chips.hidden = true;
    addEntry({ kind: 'user', text: text });
    messages.push({ role: 'user', content: text });
    input.value = '';
    setBusy(true);
    var typing = addTyping();
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
          messages.pop(); // không giữ tin lỗi trong hội thoại gửi lên
          if (res.status === 400 && /quá dài/.test(reply)) { messages = []; }
          addEntry({ kind: 'error', text: reply });
          return;
        }
        addEntry({ kind: 'ai', text: reply });
        messages.push({ role: 'assistant', content: reply });
        if (d.bao_gia && d.bao_gia.bang_gia && d.bao_gia.bang_gia.length) {
          addEntry({ kind: 'table', bao_gia: d.bao_gia });
          openPopup(d.bao_gia);
        }
        if (opts.zalo) addEntry({ kind: 'zalo' });
      })
      .catch(function () {
        typing.remove();
        messages.pop();
        addEntry({ kind: 'error', text: 'Không kết nối được, bạn thử lại hoặc nhắn Zalo ' + ZALO + ' nhé.' });
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
