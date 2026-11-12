/* Chat AI báo giá ở trang /lien-he/ (worker/chat.js, kịch bản: quy-tac-ai.md).
   - Gửi toàn bộ hội thoại (user/assistant) lên POST /api/chat; câu chào đầu chỉ hiển thị, không gửi.
   - Khi phản hồi có bao_gia: mở popup bảng giá (Website mẫu, Giá, Xem thử, Chọn mẫu này).
   - "Xem thử" tô màu dòng + nhãn "Đã xem" (nhớ trong localStorage theo URL, để khách quay lại vẫn thấy)
     và lúc đó mới hiện nút "Chọn mẫu này" ở dòng đó (chưa xem thì chưa cho chọn).
   - "Chọn mẫu này": đánh dấu dòng, đóng popup, tự gửi tin "Mình chọn mẫu ..." để AI xác nhận, rồi hiện khung
     xin tên + số điện thoại ngay trong chat. Gửi khung -> POST action "chat" về GAS (WEB100_FORM_URL ở main.js):
     GAS lưu vào tab "Khách để lại SĐT (chat AI)" + gửi email báo cho Web100 kèm lịch sử chat (gas/README.md).
   - Kênh theo data-kenh của #lh-chat: "lien_he" (mặc định, /lien-he/) có khung nhập sau khi chọn mẫu;
     "lp" (landing /lp/*) không có khung, AI tự xin số Zalo + tên trong chat rồi gửi bằng tool gui_lien_he.
   - Conversion generate_lead (trackLead ở main.js) bắn đúng 1 lần / phiên chat: khi gửi khung thành công
     hoặc khi /api/chat trả lien_he (AI đã gửi số cho Web100).
   - Mỗi phiên có 1 mã sid gửi kèm /api/chat: Worker dùng nó để ghi lịch sử hội thoại lên Google Drive (qua GAS).
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
  var LEAD_KEY = 'w100_chat_lead'; // { hoten, dienthoai } đã gửi, để lần chọn mẫu sau điền sẵn
  var VIEWED_KEY = 'w100_mau_da_xem';
  var CHOSEN_KEY = 'w100_mau_da_chon';
  var chatBox = document.getElementById('lh-chat');
  var KENH = (chatBox && chatBox.getAttribute('data-kenh')) || 'lien_he';
  var input = form.querySelector('input[name="q"]');
  var sendBtn = form.querySelector('button[type="submit"]');
  var greeting = log.innerHTML; // câu chào tĩnh trong HTML
  var messages = []; // [{role, content}] gửi lên API
  var entries = [];  // [{kind:'user'|'ai'|'error'|'table'|'zalo', text?, bao_gia?}] để vẽ lại
  var busy = false;
  var sid = newSid();
  var leadTracked = false; // đã bắn generate_lead cho phiên này chưa
  var leadPhone = '';      // số khách đã để lại trong phiên này (Worker dùng để không gửi lại / không email lại)
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
  function newSid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* bỏ qua */ }
    return 'c' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function normPhone(raw) {
    if (typeof window.normalizeVnPhone === 'function') return window.normalizeVnPhone(raw);
    var d = String(raw || '').replace(/[^\d+]/g, '');
    if (d.indexOf('+84') === 0) d = '0' + d.slice(3);
    else if (d.indexOf('84') === 0 && d.length === 11) d = '0' + d.slice(2);
    return /^0\d{9,10}$/.test(d) ? d : '';
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
    } else if (e.kind === 'lead') {
      el = renderLeadForm(e);
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
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ sid: sid, kenh: KENH, lead: leadTracked, leadPhone: leadPhone, messages: messages, entries: entries.slice(-60) })); } catch (e) { /* bỏ qua */ }
  }
  function restore() {
    try {
      var d = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
      if (!d || !Array.isArray(d.messages) || !d.messages.length) return;
      if ((d.kenh || 'lien_he') !== KENH) return; // hội thoại của trang khác (lien-he vs lp) thì bắt đầu mới
      messages = d.messages;
      if (d.sid) sid = d.sid;
      leadTracked = !!d.lead;
      leadPhone = d.leadPhone || '';
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
    // /lien-he/: hiện khung nhập sau câu trả lời. /lp/: AI tự xin số Zalo + tên trong chat.
    send('Mình chọn mẫu ' + host(url) + ' (giá ' + vnd(row.gia_vnd) + ') của ngành ' + bg.nganh.ten + '.',
      KENH === 'lien_he' ? { lead: { nganh: bg.nganh.ten, mau_chon: url, gia: vnd(row.gia_vnd) } } : {});
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePopup(); });

  /* ---------- Khung xin tên + số điện thoại (sau khi chọn mẫu) ---------- */
  function renderLeadForm(e) {
    var el = document.createElement('form');
    el.className = 'lh-lead';
    el.noValidate = true;
    if (e.sent) {
      el.classList.add('is-sent');
      el.innerHTML = '<p class="lh-lead__done">' + ICON_CHECK + 'Đã gửi: ' + esc(e.hoten) + ', ' + esc(e.dienthoai) + '</p>';
      return el;
    }
    var saved = loadJson(LEAD_KEY, {}) || {};
    el.innerHTML = '<p class="lh-lead__title">Để lại tên và số điện thoại, Web100 gọi lại tư vấn trong vòng vài giờ</p>'
      + '<div class="lh-lead__row">'
      + '<input name="hoten" type="text" placeholder="Tên của bạn" autocomplete="name" maxlength="80" required>'
      + '<input name="dienthoai" type="tel" placeholder="Số điện thoại" autocomplete="tel" inputmode="tel" maxlength="20" required>'
      + '</div>'
      + '<input name="_hp" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" class="lh-lead__hp">'
      + '<p class="lh-lead__err" hidden></p>'
      + '<button type="submit" class="lh-lead__btn">Gửi, Web100 gọi lại cho tôi</button>';
    el.hoten.value = saved.hoten || '';
    el.dienthoai.value = saved.dienthoai || '';
    el.addEventListener('submit', function (ev) { ev.preventDefault(); submitLead(el, e); });
    return el;
  }
  // 1 conversion / phiên chat, dù khách gửi khung rồi AI lại gửi số lần nữa.
  // DÙNG LẠI conversion "gửi form" đang có trên Google Ads (GA4 generate_lead import sang Ads, site không có
  // tag AW- riêng): cùng hàm trackLead, cùng tham số form như form cũ của trang ("lp" ở landing, "contact" ở
  // /lien-he/), package = mẫu đã chọn hoặc "Chưa chọn" như form cũ. Chỉ form_location khác ("chat-hero" /
  // "chat") để tách được lead từ chat trong báo cáo, không cần tạo conversion mới.
  function fireLead(phone, pkg) {
    leadPhone = phone || leadPhone;
    save();
    if (leadTracked) return;
    leadTracked = true;
    save();
    if (typeof window.trackLead === 'function') {
      window.trackLead({
        form: KENH === 'lp' ? 'lp' : 'contact',
        package: pkg || 'Chưa chọn',
        phone: phone,
        location: KENH === 'lp' ? 'chat-hero' : 'chat',
      }, function () {});
    }
  }
  function nguonQuangCao() {
    try { return typeof window.attributionNote === 'function' ? window.attributionNote() : ''; } catch (e) { return ''; }
  }
  function submitLead(el, e) {
    var err = el.querySelector('.lh-lead__err');
    var btn = el.querySelector('.lh-lead__btn');
    var hoten = el.hoten.value.trim();
    var phone = normPhone(el.dienthoai.value);
    var fail = function (msg) { err.textContent = msg; err.hidden = false; };
    err.hidden = true;
    if (!hoten) { fail('Bạn nhập tên giúp mình nhé.'); el.hoten.focus(); return; }
    if (!phone) { fail('Số điện thoại chưa đúng, bạn kiểm tra lại giúp mình nhé.'); el.dienthoai.focus(); return; }
    if (!window.WEB100_FORM_URL) { fail('Chưa gửi được, bạn gọi hoặc nhắn Zalo ' + ZALO + ' nhé.'); return; }
    btn.disabled = true;
    btn.classList.add('is-loading');
    var payload = {
      action: 'chat', _hp: el._hp.value, hoten: hoten, dienthoai: phone, sid: sid,
      nganh: e.nganh || '', mau_chon: e.mau_chon || '', gia: e.gia || '', trang: location.pathname,
      nguon: nguonQuangCao(), kenh: KENH,
    };
    fetch(window.WEB100_FORM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var duplicate = d && d.error === 'rate_limited'; // cùng số vừa gửi xong, yêu cầu trước đã lưu
        if (!d || (!d.ok && !duplicate)) throw new Error((d && d.error) || 'unknown');
        saveJson(LEAD_KEY, { hoten: hoten, dienthoai: phone });
        e.sent = true; e.hoten = hoten; e.dienthoai = phone;
        el.replaceWith(renderLeadForm(e));
        var thanks = 'Cảm ơn ' + hoten + ', Web100 đã nhận thông tin và sẽ gọi lại số ' + phone
          + ' trong vòng vài giờ. Trong lúc chờ, bạn muốn chỉnh gì so với mẫu (màu, bố cục, thêm trang...) cứ nói mình ghi chú nhé.';
        // Ghi vào hội thoại để AI biết khách đã để lại thông tin, không xin lại.
        if (messages.length && messages[messages.length - 1].role === 'assistant') {
          messages.push({ role: 'user', content: '(Mình đã gửi tên ' + hoten + ' và số điện thoại ' + phone + ' để Web100 gọi lại.)' });
          messages.push({ role: 'assistant', content: thanks });
        }
        addEntry({ kind: 'ai', text: thanks });
        leadPhone = phone;
        if (!duplicate) fireLead(phone, e.mau_chon ? 'Mẫu ' + host(e.mau_chon) + ' ' + e.gia : '');
      })
      .catch(function () {
        btn.disabled = false;
        btn.classList.remove('is-loading');
        fail('Chưa gửi được, bạn thử lại hoặc gọi / nhắn Zalo ' + ZALO + ' nhé.');
      })
      .then(save);
  }

  /* ---------- Gửi tin ---------- */
  function setBusy(v) {
    busy = v;
    sendBtn.disabled = v;
    input.disabled = v;
  }
  function addLead(opts) {
    if (opts && opts.lead) addEntry({ kind: 'lead', nganh: opts.lead.nganh, mau_chon: opts.lead.mau_chon, gia: opts.lead.gia });
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
      body: JSON.stringify({ messages: messages, sid: sid, trang: location.pathname, kenh: KENH, nguon: nguonQuangCao(), da_gui: leadPhone }),
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
          addLead(opts); // AI lỗi vẫn phải xin được số điện thoại
          return;
        }
        addEntry({ kind: 'ai', text: reply });
        messages.push({ role: 'assistant', content: reply });
        if (d.lien_he && d.lien_he.dienthoai) {
          saveJson(LEAD_KEY, { hoten: d.lien_he.hoten, dienthoai: d.lien_he.dienthoai });
          fireLead(d.lien_he.dienthoai, chosen ? 'Mẫu ' + host(chosen.url) + ' ' + vnd(chosen.gia_vnd) : '');
        }
        if (d.bao_gia && d.bao_gia.bang_gia && d.bao_gia.bang_gia.length) {
          addEntry({ kind: 'table', bao_gia: d.bao_gia });
          openPopup(d.bao_gia);
        }
        addLead(opts);
      })
      .catch(function () {
        typing.remove();
        messages.pop();
        addEntry({ kind: 'error', text: 'Không kết nối được, bạn thử lại hoặc nhắn Zalo ' + ZALO + ' nhé.' });
        addLead(opts);
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
  // Nút ngoài khung chat (VD ô "Bạn cần website gì?" trên banner landing): data-chat-q = câu gửi cho AI.
  // Khung chat đang khuất (mobile: nằm dưới banner) thì cuộn tới trước.
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-chat-q]');
    if (!b) return;
    e.preventDefault();
    var r = chatBox ? chatBox.getBoundingClientRect() : null;
    if (r && (r.top < 0 || r.bottom > window.innerHeight)) chatBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    send(b.getAttribute('data-chat-q'));
  });
  restore();

  /* ---------- Câu chào đầu như AI đang gõ ----------
     Câu chào vẫn nằm sẵn trong HTML (SEO, không JS vẫn thấy). Phiên mới: ẩn đi, khi khung chat lần đầu
     vào màn hình thì hiện "..." đang gõ ~1,2s rồi mới hiện câu chào + các nút gợi ý. */
  var introEl = log.querySelector('.lh-chat__msg--ai');
  if (!messages.length && introEl && 'IntersectionObserver' in window) {
    var introTyping = null;
    var introTimer = 0;
    var introDone = false;
    var showIntro = function () {
      if (introDone) return;
      introDone = true;
      clearTimeout(introTimer);
      if (introTyping) introTyping.remove();
      introEl.hidden = false;
      introEl.classList.add('is-intro');
      if (chips && !entries.length) chips.hidden = false;
      scrollLog();
    };
    introEl.hidden = true;
    if (chips) chips.hidden = true;
    var io = new IntersectionObserver(function (list) {
      if (!list.some(function (x) { return x.isIntersecting; })) return;
      io.disconnect();
      introTimer = setTimeout(function () {
        if (introDone) return;
        introTyping = addTyping();
        introTimer = setTimeout(showIntro, 1200);
      }, 300);
    }, { threshold: 0.4 });
    io.observe(chatBox || log);
    // Khách gửi tin trước khi câu chào kịp hiện (ô nhập / nút trên banner): hiện ngay, đúng thứ tự.
    form.addEventListener('submit', showIntro, true);
    document.addEventListener('click', function (e) { if (e.target.closest('[data-chat-q]')) showIntro(); }, true);
  }
})();
