/* Web100 Builder — engine chung dựng khối từ data/blocks-catalog.json.
   Thêm 1 kiểu khối/variant mới = thêm entry vào file JSON đó, không cần sửa
   file này (trừ khi cần 1 field "type" hoàn toàn mới chưa từng có). */

const STORAGE_KEY = 'web100_builder_state_v2';
const ICON_HANDLE = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="1.3"/><circle cx="16" cy="6" r="1.3"/><circle cx="8" cy="12" r="1.3"/><circle cx="16" cy="12" r="1.3"/><circle cx="8" cy="18" r="1.3"/><circle cx="16" cy="18" r="1.3"/></svg>';
const ICON_DELETE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_SWAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 2.1l4 4-4 4"/><path d="M3 12.1v-2a4 4 0 0 1 4-4h14"/><path d="M7 21.9l-4-4 4-4"/><path d="M21 11.9v2a4 4 0 0 1-4 4H3"/></svg>';
const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
const ICON_ARROW_LEFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 6-6 6 6 6"/></svg>';
const ICON_ARROW_RIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>';

let CATALOG = null;
let ICONS_CATALOG = []; // data/icons-catalog.json — thêm icon mới chỉ cần sửa file đó
let state = { blocks: [] };
let undoStack = [];
let isRestoring = false;
let uploadTarget = null; // "field:<instanceId>:<key>"
let selectedBlockId = null;
// Các khối đang mở panel "Tuỳ chỉnh khối" ở sidebar — độc lập với
// selectedBlockId (chỉ dùng để highlight + cuộn tới khối), nên có thể mở
// nhiều panel cùng lúc (vd 2 khối hero-banner) mà không panel nào tự đóng.
let openPanelIds = new Set();
let addModalCategory = null;
let swapTargetId = null; // id khối đang chờ đổi mẫu qua popup Thêm khối
let btnStyleTarget = null; // { instanceId, fieldKey, itemCtx? } — field button đang mở popup tuỳ chỉnh; itemCtx {listKey, idx} khi là nút bên trong 1 mục list (vd nút "Xem thêm" của từng slide)
let textStyleTarget = null; // { instanceId, fieldKey, itemCtx? } — cùng hình dạng với btnStyleTarget, dùng cho popup "Tuỳ chỉnh chữ" (mọi field text/richtext không phải customStyle:"button")
let imgStyleTarget = null; // { instanceId, fieldKey, fieldDef } — field ảnh đang mở popup tuỳ chỉnh
// Đánh dấu "đang ở chế độ Tuỳ chỉnh" cho tỉ lệ ảnh trong popup, vì giá trị
// tự chọn (vd "1:1") có thể trùng với 1 preset — không thể suy ra chế độ chỉ
// từ giá trị, cần cờ riêng để dropdown không tự nhảy về preset.
const customImgRatioMode = new Set();

/* ------------------------------ Tiện ích ------------------------------ */
function uid() { return 'b' + Math.random().toString(36).slice(2, 9); }
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
function reorderArray(arr, from, to) {
  const copy = arr.slice();
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}
function placeCaretAtEnd(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}
function rafThrottle(fn) {
  let scheduled = false;
  let lastArgs = null;
  return (...args) => {
    lastArgs = args;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; fn(...lastArgs); });
  };
}
function hexToRgba(hex, alpha) {
  const h = (hex || '#ffffff').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const int = parseInt(full, 16) || 0xffffff;
  const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha == null ? 1 : alpha) + ')';
}
function hexToRgbParts(hex) {
  const h = (hex || '#000000').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const int = parseInt(full, 16) || 0;
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}
// Đọc màu chữ HIỆN TẠI (getComputedStyle trả "rgb(r,g,b)") ra hex để hiện
// đúng giá trị đang có trong ô chọn màu của popup "Tuỳ chỉnh chữ" — trước
// khi người dùng thực sự đổi gì (xem wireTextCustomStyle/openTextStyleModal).
function rgbStringToHex(rgbStr) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgbStr || '');
  if (!m) return '#000000';
  const toHex = (n) => Number(n).toString(16).padStart(2, '0');
  return '#' + toHex(m[1]) + toHex(m[2]) + toHex(m[3]);
}
// Cỡ chữ đậm hiện tại (computed font-weight luôn là số, có thể là bất kỳ
// giá trị 100-900) — làm tròn về option gần nhất trong dropdown "Độ đậm".
function nearestWeightOption(w) {
  const options = [400, 500, 600, 700, 800];
  return options.reduce((best, cur) => (Math.abs(cur - w) < Math.abs(best - w) ? cur : best), options[0]);
}
// alpha: giữ nguyên độ trong suốt màu nền (bgOpacity) của nút khi hover đổi
// màu darken/lighten — nếu không, nút đang trong suốt sẽ đột ngột đặc màu
// hoàn toàn ngay khi rê chuột vào.
function darkenHex(hex, amount, alpha) {
  const [r0, g0, b0] = hexToRgbParts(hex);
  const r = Math.max(0, Math.round(r0 * (1 - amount)));
  const g = Math.max(0, Math.round(g0 * (1 - amount)));
  const b = Math.max(0, Math.round(b0 * (1 - amount)));
  return 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha == null ? 1 : alpha) + ')';
}
function lightenHex(hex, amount, alpha) {
  const [r0, g0, b0] = hexToRgbParts(hex);
  const r = Math.min(255, Math.round(r0 + (255 - r0) * amount));
  const g = Math.min(255, Math.round(g0 + (255 - g0) * amount));
  const b = Math.min(255, Math.round(b0 + (255 - b0) * amount));
  return 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha == null ? 1 : alpha) + ')';
}
/* Sinh CSS cho 1 field kiểu button (màu/font/padding/bo góc/viền + hiệu ứng
   hover) — trả về text CSS thô để nhúng trong 1 <style> đi kèm khối, nên
   bản xuất tĩnh (không có builder.js) vẫn giữ đúng mọi hiệu ứng. */
function buttonStyleCss(styleId, bs) {
  const radius = bs.radius != null ? bs.radius : 24;
  const paddingX = bs.paddingX != null ? bs.paddingX : 20;
  const paddingY = bs.paddingY != null ? bs.paddingY : 13;
  const fontSize = bs.fontSize != null ? bs.fontSize : 14;
  const borderWidth = bs.borderWidth != null ? bs.borderWidth : 0;
  const borderColor = bs.borderColor || bs.bg;
  const shadow = bs.shadow != null ? bs.shadow : 0;
  const font = bs.font ? CATALOG.fonts.find((f) => f.id === bs.font) : null;
  const sel = '.blk-btn[data-btn-style-id="' + styleId + '"]';
  const [r, g, b] = hexToRgbParts(bs.bg);
  const bgOpacity = bs.bgOpacity != null ? bs.bgOpacity : 1;
  const bgColor = bgOpacity >= 1 ? bs.bg : hexToRgba(bs.bg, bgOpacity);

  let css = sel + ' {' +
    ' background:' + bgColor + ' !important;' +
    ' color:' + bs.text + ' !important;' +
    ' border-radius:' + radius + 'px !important;' +
    ' padding:' + paddingY + 'px ' + paddingX + 'px !important;' +
    ' height:auto !important;' +
    ' font-size:' + fontSize + 'px !important;' +
    ' border:' + borderWidth + 'px solid ' + borderColor + ' !important;' +
    (font ? ' font-family:' + font.stack + ' !important;' : '') +
    (bs.fontWeight ? ' font-weight:' + bs.fontWeight + ' !important;' : '') +
    ' font-style:' + (bs.italic ? 'italic' : 'normal') + ' !important;' +
    ' text-decoration:' + (bs.underline ? 'underline' : 'none') + ' !important;' +
    // Chỉ đổ bóng dưới + phải (offset-x/offset-y cùng dương), không đổ
    // bóng lên/trái.
    (shadow > 0 ? ' box-shadow: ' + shadow + 'px ' + shadow + 'px ' + Math.round(shadow * 1.3) + 'px rgba(11,15,20,0.22) !important;' : '') +
    ' position:relative; overflow:hidden;' +
    ' transition: background .2s ease, color .2s ease, transform .2s ease, box-shadow .2s ease, border-color .2s ease;' +
    ' }';

  if (bs.hoverEffect === 'darken') {
    css += ' ' + sel + ':hover { background:' + darkenHex(bs.bg, 0.15, bgOpacity) + ' !important; }';
  } else if (bs.hoverEffect === 'lighten') {
    css += ' ' + sel + ':hover { background:' + lightenHex(bs.bg, 0.2, bgOpacity) + ' !important; }';
  } else if (bs.hoverEffect === 'lift') {
    css += ' ' + sel + ':hover { transform: translateY(-3px); box-shadow: 0 12px 22px rgba(11,15,20,0.2); }';
  } else if (bs.hoverEffect === 'scale') {
    css += ' ' + sel + ':hover { transform: scale(1.06); }';
  } else if (bs.hoverEffect === 'glow') {
    css += ' ' + sel + ':hover { box-shadow: 0 0 0 6px rgba(' + r + ',' + g + ',' + b + ',0.25), 0 10px 22px rgba(' + r + ',' + g + ',' + b + ',0.35); }';
  } else if (bs.hoverEffect === 'flip3d') {
    css += ' ' + sel + ' { transform-style: preserve-3d; }' +
      ' ' + sel + ':hover { transform: perspective(500px) rotateX(14deg) scale(1.03); box-shadow: 0 16px 26px rgba(11,15,20,0.22); }';
  } else if (bs.hoverEffect === 'sweep') {
    css += ' ' + sel + '::before {' +
      ' content:""; position:absolute; top:0; bottom:0; left:-60%; width:40%;' +
      ' background: linear-gradient(120deg, transparent, rgba(255,255,255,0.4), transparent);' +
      ' transform: skewX(-20deg); transition: left .5s ease; pointer-events:none;' +
      ' }' +
      ' ' + sel + ':hover::before { left: 130%; }';
  } else if (bs.hoverEffect === 'spotlight') {
    css += ' ' + sel + '::after {' +
      ' content:""; position:absolute; inset:0;' +
      ' background: radial-gradient(140px circle at var(--btn-mx,50%) var(--btn-my,50%), rgba(255,255,255,0.35), transparent 70%);' +
      ' opacity:0; transition: opacity .25s ease; pointer-events:none;' +
      ' }' +
      ' ' + sel + ':hover::after { opacity: 1; }';
  }
  return css;
}
/* Script nhỏ theo dõi vị trí trỏ chuột trong nút để hiệu ứng "spotlight"
   sáng lên đúng từ điểm hover — cần JS vì CSS thuần không đọc được toạ độ
   con trỏ, nhưng script này tự chứa (không phụ thuộc builder.js) nên vẫn
   chạy đúng trong bản xuất tĩnh. */
function buttonStyleScript(styleId) {
  return '(function(){var el=document.querySelector(\'[data-btn-style-id="' + styleId + '"]\');if(!el||el.__spotlightWired)return;el.__spotlightWired=true;' +
    'el.addEventListener("pointermove",function(e){var r=el.getBoundingClientRect();' +
    'el.style.setProperty("--btn-mx",((e.clientX-r.left)/r.width*100)+"%");' +
    'el.style.setProperty("--btn-my",((e.clientY-r.top)/r.height*100)+"%");});})();';
}
/* Script cho hiệu ứng "Thanh trượt" của menu: 1 thanh chỉ báo trượt theo
   đúng vị trí/độ rộng của mục menu đang hover — tự chứa (không phụ thuộc
   builder.js) nên vẫn chạy đúng trong bản xuất tĩnh. */
function navHoverScript(navId) {
  return '(function(){var nav=document.querySelector(\'[data-nav-indicator-id="' + navId + '"]\');if(!nav)return;' +
    'var ind=nav.querySelector(".blk-menu__nav-indicator");if(!ind)return;' +
    'var links=nav.querySelectorAll("a");' +
    'links.forEach(function(a){a.addEventListener("mouseenter",function(){' +
    'var r=a.getBoundingClientRect(),nr=nav.getBoundingClientRect();' +
    'ind.style.left=(r.left-nr.left)+"px";ind.style.width=r.width+"px";ind.classList.add("is-active");' +
    '});});' +
    'nav.addEventListener("mouseleave",function(){ind.classList.remove("is-active");});})();';
}
/* Script cho slideshow hero (fieldDef.slideshow, xem buildHeroDots): tự
   chuyển slide theo thời gian + đổi khi bấm nốt chỉ mục — tự chứa (không
   phụ thuộc builder.js) nên vẫn chạy đúng trong bản xuất tĩnh. boxId trỏ
   đúng phần tử cha chứa cả .blk-hero__slides và .blk-hero__dots, luôn là
   cha trực tiếp của container list (không phải luôn là root khối — vd hero
   3/4 + 2 ô ảnh đặt slideshow trong 1 cột con), nên script tự tìm đúng dù
   mỗi variant bố trí HTML khác nhau. */
function heroSlideScript(boxId) {
  return '(function(){var box=document.querySelector(\'[data-hero-slide-id="' + boxId + '"]\');if(!box||box.__heroSlideWired)return;box.__heroSlideWired=true;' +
    'var slidesEl=box.querySelector("[data-list-container]");if(!slidesEl)return;' +
    'var slides=Array.prototype.slice.call(slidesEl.children);' +
    'var dotsWrap=box.querySelector(":scope > .blk-hero__dots");' +
    'var dots=dotsWrap?Array.prototype.slice.call(dotsWrap.querySelectorAll(".blk-hero__dot")):[];' +
    'var prevBtn=box.querySelector(":scope > .blk-hero__arrow--prev");' +
    'var nextBtn=box.querySelector(":scope > .blk-hero__arrow--next");' +
    'if(slides.length<2)return;' +
    'var idx=0,timer;' +
    'function show(i){slides[idx].classList.remove("is-active");if(dots[idx])dots[idx].classList.remove("is-active");idx=(i+slides.length)%slides.length;slides[idx].classList.add("is-active");if(dots[idx])dots[idx].classList.add("is-active");}' +
    'function restart(){clearInterval(timer);timer=setInterval(function(){show(idx+1);},5000);}' +
    'dots.forEach(function(d,i){d.addEventListener("click",function(){show(i);restart();});});' +
    'if(prevBtn)prevBtn.addEventListener("click",function(){show(idx-1);restart();});' +
    'if(nextBtn)nextBtn.addEventListener("click",function(){show(idx+1);restart();});' +
    'restart();})();';
}
/* Chèn/gỡ icon svg (từ ICONS_CATALOG, quản lý ở data/icons-catalog.json)
   ngay trước phần chữ của 1 nút — icon là span con riêng (không phải text
   node) nên el.textContent vẫn đúng, không lẫn nội dung svg khi lưu field.
   Gọi được cả lúc dựng khối lần đầu và lúc live-update từ popup. */
function applyButtonIcon(el, bs) {
  let iconSpan = el.querySelector(':scope > .blk-btn__icon');
  const iconDef = bs.icon ? ICONS_CATALOG.find((ic) => ic.id === bs.icon) : null;
  if (iconDef) {
    if (!iconSpan) {
      iconSpan = document.createElement('span');
      iconSpan.className = 'blk-btn__icon';
      el.insertBefore(iconSpan, el.firstChild);
    }
    iconSpan.innerHTML = iconDef.svg;
    const size = bs.iconSize != null ? bs.iconSize : 18;
    iconSpan.style.width = size + 'px';
    iconSpan.style.height = size + 'px';
    iconSpan.style.color = bs.iconColor || 'currentColor';
  } else if (iconSpan) {
    iconSpan.remove();
  }
}
/* Bọc 1 field kiểu button (customStyle:"button") bằng .btn-style-wrap + icon
   sửa + <style> hiệu ứng riêng — dùng chung cho field tĩnh (menu CTA) và
   field kéo tự do (hero CTA). Yêu cầu el đã có cha trong DOM (đã append vào
   đâu đó) vì dùng el.replaceWith(...) để chèn wrapper vào đúng chỗ. Trả về
   chính el nếu field này không phải customStyle:"button". */
/* Lấy (và tạo nếu chưa có) object style của 1 field kiểu button — dùng
   chung cho field tĩnh/kéo tự do (lưu ở instance.buttonStyles[f.key]) VÀ
   field bên trong 1 mục list (vd nút "Xem thêm" của từng slide, lưu NGAY
   TRONG chính object của mục đó, key "<fieldKey>__btnStyle") khi có itemCtx
   {listKey, idx}. Lưu trong item để khi kéo sắp xếp/xoá mục, style luôn đi
   theo đúng mục của nó thay vì lệch theo vị trí index. */
function getButtonStyleRef(instance, f, itemCtx) {
  if (!itemCtx) {
    if (!instance.buttonStyles) instance.buttonStyles = {};
    if (!instance.buttonStyles[f.key]) instance.buttonStyles[f.key] = Object.assign({}, f.buttonStyleDefault);
    return instance.buttonStyles[f.key];
  }
  const item = instance.fields[itemCtx.listKey][itemCtx.idx];
  const bsKey = f.key + '__btnStyle';
  if (!item[bsKey]) item[bsKey] = Object.assign({}, f.buttonStyleDefault);
  return item[bsKey];
}
function buttonStyleIdOf(instanceId, f, itemCtx) {
  return instanceId + '__' + f.key + (itemCtx ? ':' + itemCtx.listKey + ':' + itemCtx.idx : '');
}
function wireButtonCustomStyle(instance, f, el, itemCtx) {
  if (f.customStyle !== 'button') return el;
  const bs = getButtonStyleRef(instance, f, itemCtx);
  const styleId = buttonStyleIdOf(instance.id, f, itemCtx);
  el.dataset.btnStyleId = styleId;
  applyButtonIcon(el, bs);

  const wrap = document.createElement('span');
  wrap.className = 'btn-style-wrap';
  el.replaceWith(wrap);
  wrap.appendChild(el);

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'btn-style-edit';
  editBtn.setAttribute('data-editor-only', '');
  editBtn.title = 'Tuỳ chỉnh nút';
  editBtn.innerHTML = ICON_EDIT;
  editBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openButtonStyleModal(instance.id, f.key, itemCtx);
  });
  wrap.appendChild(editBtn);

  const styleTag = document.createElement('style');
  styleTag.textContent = buttonStyleCss(styleId, bs);
  wrap.appendChild(styleTag);

  // Hiệu ứng "spotlight" cần theo dõi vị trí trỏ chuột — chèn kèm 1 script
  // nhỏ tự chứa (chạy được cả khi xuất tĩnh, không phụ thuộc builder.js).
  if (bs.hoverEffect === 'spotlight') {
    const scriptTag = document.createElement('script');
    scriptTag.textContent = buttonStyleScript(styleId);
    wrap.appendChild(scriptTag);
  }
  return wrap;
}

/* ------------------------------ Tuỳ chỉnh chữ (mọi field type:"text"/"richtext") ------------------------------
   Áp dụng cho MỌI field chữ trong MỌI loại khối (không riêng hero) — khác
   hệ thống nút bấm ở trên, hệ này KHÔNG có "default" nào cả: object style
   (ts) bắt đầu trống {}, popup chỉ ghi đè property nào người dùng thực sự
   đổi (xem textStyleCss) — để không tự áp 1 giao diện "mặc định" chưa xin
   phép lên hàng trăm field chữ khác nhau (mỗi field vốn đã có cỡ/màu/đậm
   riêng qua các class .blk-heading/.blk-lead/... — hệ này chỉ NỚI THÊM khả
   năng ghi đè khi cần, không thay class gốc). */
function getTextStyleRef(instance, f, itemCtx) {
  if (!itemCtx) {
    if (!instance.textStyles) instance.textStyles = {};
    if (!instance.textStyles[f.key]) instance.textStyles[f.key] = {};
    return instance.textStyles[f.key];
  }
  const item = instance.fields[itemCtx.listKey][itemCtx.idx];
  const tsKey = f.key + '__textStyle';
  if (!item[tsKey]) item[tsKey] = {};
  return item[tsKey];
}
function textStyleIdOf(instanceId, f, itemCtx) {
  return instanceId + '__txt__' + f.key + (itemCtx ? ':' + itemCtx.listKey + ':' + itemCtx.idx : '');
}
/* Chỉ sinh khai báo cho property NGƯỜI DÙNG ĐÃ ĐỔI (ts.<key> khác null) —
   field chưa đụng tới thì không xuất CSS gì, giữ đúng giao diện gốc. */
function textStyleCss(styleId, ts) {
  const sel = '[data-text-style-id="' + styleId + '"]';
  let decls = '';
  if (ts.color) decls += ' color:' + ts.color + ' !important;';
  if (ts.fontSize != null) decls += ' font-size:' + ts.fontSize + 'px !important;';
  if (ts.fontWeight) decls += ' font-weight:' + ts.fontWeight + ' !important;';
  if (ts.italic) decls += ' font-style:italic !important;';
  if (ts.underline) decls += ' text-decoration:underline !important;';
  if (ts.font) {
    const font = CATALOG.fonts.find((f) => f.id === ts.font);
    if (font) decls += ' font-family:' + font.stack + ' !important;';
  }
  return decls ? sel + ' {' + decls + ' }' : '';
}
// Tag inline (span/a) bọc bằng <span> để giữ đúng ngữ cảnh dòng chữ; tag
// khối (h1/h2/h3/p...) bọc bằng <div> — bọc bằng span cho tag khối sẽ khiến
// trình duyệt xử lý sai (span vốn inline).
const INLINE_TEXT_TAGS = new Set(['SPAN', 'A']);
function wireTextCustomStyle(instance, f, el, itemCtx) {
  if (f.type !== 'text' && f.type !== 'richtext') return el;
  if (f.customStyle === 'button') return el; // đã có popup "Tuỳ chỉnh nút" riêng, đầy đủ hơn
  const ts = getTextStyleRef(instance, f, itemCtx);
  const styleId = textStyleIdOf(instance.id, f, itemCtx);
  el.dataset.textStyleId = styleId;

  const wrap = document.createElement(INLINE_TEXT_TAGS.has(el.tagName) ? 'span' : 'div');
  wrap.className = 'text-style-wrap';
  el.replaceWith(wrap);
  wrap.appendChild(el);

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'text-style-edit';
  editBtn.setAttribute('data-editor-only', '');
  editBtn.title = 'Tuỳ chỉnh chữ';
  editBtn.innerHTML = ICON_EDIT;
  editBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openTextStyleModal(instance.id, f.key, itemCtx);
  });
  wrap.appendChild(editBtn);

  const styleTag = document.createElement('style');
  styleTag.textContent = textStyleCss(styleId, ts);
  wrap.appendChild(styleTag);
  return wrap;
}
function toolsHtml(deleteTitle, opts) {
  const withHandle = !opts || opts.withHandle !== false;
  const withSwap = !!(opts && opts.withSwap);
  return '<span class="item-tools" data-editor-only>' +
    (withHandle ? '<button type="button" class="item-tool-btn item-tool-handle" title="Kéo để sắp xếp">' + ICON_HANDLE + '</button>' : '') +
    (withSwap ? '<button type="button" class="item-tool-btn tool-swap" title="Đổi mẫu">' + ICON_SWAP + '</button>' : '') +
    '<button type="button" class="item-tool-btn tool-delete" title="' + (deleteTitle || 'Xoá') + '">' + ICON_DELETE + '</button>' +
    '</span>';
}

/* ------------------------------ Catalog helpers ------------------------------ */
function findType(typeId) { return CATALOG.types.find((t) => t.id === typeId); }
function findVariant(typeId, variantId) {
  const t = findType(typeId);
  return t && t.variants.find((v) => v.id === variantId);
}
function findInstance(id) { return state.blocks.find((b) => b.id === id); }

function createInstanceFromVariant(typeId, variantId) {
  const variant = findVariant(typeId, variantId);
  const fields = {};
  const buttonStyles = {};
  const imageStyles = {};
  (variant.fields || []).forEach((f) => {
    fields[f.key] = f.type === 'list' ? JSON.parse(JSON.stringify(f.default || [])) : f.default;
    if (f.customStyle === 'button') buttonStyles[f.key] = Object.assign({}, f.buttonStyleDefault);
    if (f.type === 'image') imageStyles[f.key] = { zoom: 1, ratio: f.ratio ? f.ratio.default : null, overlay: false, overlayColor: '#ffffff', overlayOpacity: 0.5 };
  });
  const style = {};
  (variant.style || []).forEach((s) => { style[s.key] = s.default; });
  return { id: uid(), typeId, variantId, fields, style, buttonStyles, imageStyles };
}

/* ------------------------------ State I/O ------------------------------ */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.blocks)) return parsed;
    }
  } catch (e) { /* ignore */ }
  return { blocks: [] };
}
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* quota đầy */ }
  }, 500);
}
function pushUndo() {
  if (isRestoring) return;
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 30) undoStack.shift();
  document.getElementById('btnUndo').disabled = undoStack.length < 2;
}
function undo() {
  if (undoStack.length < 2) return;
  undoStack.pop();
  const prev = undoStack[undoStack.length - 1];
  isRestoring = true;
  state = JSON.parse(prev);
  renderAll();
  isRestoring = false;
  scheduleSave();
  document.getElementById('btnUndo').disabled = undoStack.length < 2;
}
function resetAll() {
  if (!window.confirm('Xoá hết toàn bộ khối trên canvas? Không thể hoàn tác sau khi làm mới.')) return;
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  state = { blocks: [] };
  selectedBlockId = null;
  undoStack = [];
  renderAll();
  pushUndo();
}

/* ------------------------------ Ghost theo chuột khi kéo ------------------------------ */
function createDragGhost(sourceEl, pointerX, pointerY) {
  const rect = sourceEl.getBoundingClientRect();
  const ghost = sourceEl.cloneNode(true);
  ghost.classList.add('drag-ghost-el');
  ghost.removeAttribute('id');
  ghost.style.position = 'fixed';
  ghost.style.margin = '0';
  ghost.style.width = rect.width + 'px';
  ghost.style.height = rect.height + 'px';
  ghost.style.left = '0';
  ghost.style.top = '0';
  ghost.style.pointerEvents = 'none';
  document.body.appendChild(ghost);
  document.body.classList.add('is-dragging-something');
  const g = { el: ghost, offsetX: pointerX - rect.left, offsetY: pointerY - rect.top, x: pointerX, y: pointerY, raf: null };
  applyGhostTransform(g);
  return g;
}
function applyGhostTransform(g) {
  const x = g.x - g.offsetX;
  const y = g.y - g.offsetY;
  g.el.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0) scale(1.03)';
}
function moveDragGhost(g, x, y) {
  g.x = x; g.y = y;
  if (g.raf) return;
  g.raf = requestAnimationFrame(() => { g.raf = null; applyGhostTransform(g); });
}
function destroyDragGhost(g) {
  if (g.raf) cancelAnimationFrame(g.raf);
  g.el.remove();
  document.body.classList.remove('is-dragging-something');
}

/* ------------------------------ Kéo sắp xếp — dùng chung cho sidebar & mọi field kiểu list ------------------------------
   opts.wholeItem = true: cầm kéo ở bất kỳ đâu trên cả thẻ (không cần đúng
   nút tay nắm) — dùng cho danh sách khối ở sidebar, nơi kéo/thả chỉ đơn
   thuần là đổi chỗ cho nhau. Có ngưỡng di chuyển (DRAG_THRESHOLD) để phân
   biệt với 1 cú click chọn khối bình thường: chưa vượt ngưỡng thì không
   khởi tạo ghost, để sự kiện "click" gốc vẫn chạy tiếp bình thường. */
function makeReorderable(container, itemSelector, axis, onReorder, opts) {
  const wholeItem = !!(opts && opts.wholeItem);
  const DRAG_THRESHOLD = 6;
  container.querySelectorAll(itemSelector).forEach((item) => {
    const handle = wholeItem ? item : item.querySelector('.item-tool-handle');
    if (!handle || handle.__wired) return;
    handle.__wired = true;
    handle.addEventListener('pointerdown', (e) => {
      if (!wholeItem) { e.preventDefault(); e.stopPropagation(); }
      const liveItems = Array.from(container.querySelectorAll(itemSelector));
      const startIndex = liveItems.indexOf(item);
      let dropIndex = startIndex;
      let started = !wholeItem;
      let ghost = null;
      const startX = e.clientX, startY = e.clientY;

      const others = liveItems.filter((el) => el !== item);
      const clearTargets = () => liveItems.forEach((el) => el.classList.remove('is-drop-target', 'is-drop-target-row'));
      const marker = axis === 'x' ? 'is-drop-target' : 'is-drop-target-row';
      const computeInsertPos = (pointer) => {
        let insertPos = 0;
        others.forEach((other) => {
          const rect = other.getBoundingClientRect();
          const mid = axis === 'x' ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
          if (pointer > mid) insertPos++;
        });
        return insertPos;
      };
      const updateTarget = rafThrottle((pointer) => {
        dropIndex = computeInsertPos(pointer);
        clearTargets();
        if (others[dropIndex]) others[dropIndex].classList.add(marker);
      });
      const beginDrag = () => {
        started = true;
        item.classList.add('is-drag-ghost');
        ghost = createDragGhost(item, e.clientX, e.clientY);
      };
      if (started) beginDrag();

      const onMove = (ev) => {
        if (!started) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
          beginDrag();
        }
        moveDragGhost(ghost, ev.clientX, ev.clientY);
        updateTarget(axis === 'x' ? ev.clientX : ev.clientY);
      };
      const onUp = (ev) => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        if (!started) return; // chỉ là click, không phải kéo — để click gốc tự chạy tiếp
        dropIndex = computeInsertPos(axis === 'x' ? ev.clientX : ev.clientY);
        item.classList.remove('is-drag-ghost');
        destroyDragGhost(ghost);
        clearTargets();
        if (wholeItem) item.__justDragged = true;
        if (dropIndex !== startIndex) onReorder(startIndex, dropIndex);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  });
}

/* ------------------------------ Editable text (contenteditable khi click) ------------------------------ */
function wireEditableText(root) {
  root.querySelectorAll('[data-editable-text]').forEach((el) => {
    if (el.__wired) return;
    el.__wired = true;
    el.addEventListener('click', (e) => {
      if (el.getAttribute('contenteditable') === 'true') return;
      e.preventDefault();
      e.stopPropagation();
      el.setAttribute('contenteditable', 'true');
      el.focus();
      placeCaretAtEnd(el);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && el.dataset.multiline !== 'true') { e.preventDefault(); el.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); el.blur(); }
    });
    el.addEventListener('blur', () => {
      el.removeAttribute('contenteditable');
      commitEdit(el);
    });
  });
}
/* Áp zoom + lớp phủ hiện tại của 1 field ảnh lên đúng phần tử — tách riêng
   hàm này để gọi lại được từ popup live-update, không cần render lại cả
   khối. */
function applyImageStyle(imgEl, wrapEl, is_) {
  imgEl.style.transform = 'scale(' + (is_.zoom != null ? is_.zoom : 1) + ')';
  if (is_.ratio) imgEl.style.aspectRatio = is_.ratio.replace(':', ' / ');
  let overlay = wrapEl.querySelector(':scope > .img-style-overlay');
  if (is_.overlay) {
    if (!overlay) {
      overlay = document.createElement('span');
      overlay.className = 'img-style-overlay';
      wrapEl.appendChild(overlay);
    }
    overlay.style.background = hexToRgba(is_.overlayColor || '#ffffff', is_.overlayOpacity != null ? is_.overlayOpacity : 0.5);
  } else if (overlay) {
    overlay.remove();
  }
}
/* Bọc MỌI field kiểu "image" (ảnh hero, logo menu, ...) bằng .img-style-wrap
   + icon sửa — click ảnh giờ không upload thẳng nữa mà mở popup "Tuỳ chỉnh
   ảnh" gồm cả đổi ảnh, zoom, và lớp phủ màu. */
function wireImageCustomStyle(instance, f, el) {
  if (f.type !== 'image') return el;
  if (!instance.imageStyles) instance.imageStyles = {};
  if (!instance.imageStyles[f.key]) instance.imageStyles[f.key] = { zoom: 1, ratio: f.ratio ? f.ratio.default : null, overlay: false, overlayColor: '#ffffff', overlayOpacity: 0.5 };
  const is_ = instance.imageStyles[f.key];
  const styleId = instance.id + '__' + f.key;
  el.dataset.imgStyleId = styleId;

  const wrap = document.createElement('span');
  wrap.className = 'img-style-wrap';
  el.replaceWith(wrap);
  wrap.appendChild(el);
  applyImageStyle(el, wrap, is_);

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'img-style-edit';
  editBtn.setAttribute('data-editor-only', '');
  editBtn.title = 'Tuỳ chỉnh ảnh';
  editBtn.innerHTML = ICON_EDIT;
  editBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openImageStyleModal(instance.id, f.key);
  });
  wrap.appendChild(editBtn);
  return wrap;
}
/* Bọc ảnh của 1 mục trong field kiểu list (vd từng slide hero) — đơn giản
   hơn wireImageCustomStyle (không có popup zoom/lớp phủ, chỉ đổi ảnh) vì
   mỗi mục là 1 phần tử lặp, không đáng giữ state riêng (zoom/overlay) cho
   từng mục như ảnh tĩnh cấp khối. */
function wireListItemImage(instance, listKey, idx, itemKey, el) {
  const wrap = document.createElement('span');
  wrap.className = 'img-style-wrap';
  el.replaceWith(wrap);
  wrap.appendChild(el);

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'img-style-edit';
  editBtn.setAttribute('data-editor-only', '');
  editBtn.title = 'Đổi ảnh';
  editBtn.innerHTML = ICON_EDIT;
  editBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openUpload('list:' + instance.id + ':' + listKey + ':' + idx + ':' + itemKey);
  });
  wrap.appendChild(editBtn);
  return wrap;
}
/* Dựng thanh "nốt" điều hướng + script tự chạy (autoplay + bấm nốt) cho 1
   field list được đánh dấu fieldDef.slideshow (vd các slide hero). Gắn vào
   CHA của chính container list đó (không phải luôn là root khối) để tự
   đúng vị trí dù variant đặt slideshow trong 1 cột con (vd hero 3/4 + 2 ô
   ảnh) — không cần biết trước cấu trúc HTML cụ thể của từng variant. */
function buildHeroDots(instance, key, container) {
  const box = container.parentElement;
  const slides = instance.fields[key] || [];
  let dotsWrap = box.querySelector(':scope > .blk-hero__dots');
  let prevBtn = box.querySelector(':scope > .blk-hero__arrow--prev');
  let nextBtn = box.querySelector(':scope > .blk-hero__arrow--next');
  if (slides.length < 2) {
    if (dotsWrap) dotsWrap.remove();
    if (prevBtn) prevBtn.remove();
    if (nextBtn) nextBtn.remove();
    const oldScript = box.querySelector(':scope > script[data-hero-slide-script]');
    if (oldScript) oldScript.remove();
    box.removeAttribute('data-hero-slide-id');
    return;
  }
  // Nút prev/next — cùng cơ chế script tự chạy với dots (xem heroSlideScript),
  // luôn có sẵn khi có ≥2 slide bất kể variant nào.
  if (!prevBtn) {
    prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'blk-hero__arrow blk-hero__arrow--prev';
    prevBtn.setAttribute('aria-label', 'Slide trước');
    prevBtn.innerHTML = ICON_ARROW_LEFT;
    box.appendChild(prevBtn);
  }
  if (!nextBtn) {
    nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'blk-hero__arrow blk-hero__arrow--next';
    nextBtn.setAttribute('aria-label', 'Slide tiếp theo');
    nextBtn.innerHTML = ICON_ARROW_RIGHT;
    box.appendChild(nextBtn);
  }
  if (!dotsWrap) {
    dotsWrap = document.createElement('div');
    dotsWrap.className = 'blk-hero__dots';
    box.appendChild(dotsWrap);
  }
  dotsWrap.innerHTML = '';
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'blk-hero__dot' + (i === 0 ? ' is-active' : '');
    dot.setAttribute('aria-label', 'Slide ' + (i + 1));
    dotsWrap.appendChild(dot);
  });
  const heroId = instance.id + '__hero';
  box.dataset.heroSlideId = heroId;
  let script = box.querySelector(':scope > script[data-hero-slide-script]');
  if (!script) {
    script = document.createElement('script');
    script.setAttribute('data-hero-slide-script', '');
    box.appendChild(script);
  }
  script.textContent = heroSlideScript(heroId);
}

function commitEdit(el) {
  const bind = el.dataset.bind;
  if (!bind) return;
  const parts = bind.split(':');
  if (parts[0] === 'field') {
    const inst = findInstance(parts[1]);
    if (!inst) return;
    const key = parts[2];
    const variant = findVariant(inst.typeId, inst.variantId);
    const fieldDef = variant.fields.find((f) => f.key === key);
    inst.fields[key] = (fieldDef && fieldDef.type === 'richtext') ? el.innerHTML.trim() : el.textContent.trim();
  } else if (parts[0] === 'list') {
    const inst = findInstance(parts[1]);
    if (!inst) return;
    const listKey = parts[2];
    const idx = +parts[3];
    const itemKey = parts[4];
    if (inst.fields[listKey] && inst.fields[listKey][idx]) inst.fields[listKey][idx][itemKey] = el.textContent.trim();
  }
  pushUndo();
  scheduleSave();
}

/* ------------------------------ Template engine ------------------------------ */
function substituteTemplate(html, data) {
  return html
    .replace(/{{{\s*([\w.]+)\s*}}}/g, (_, k) => (data[k] != null ? data[k] : ''))
    .replace(/{{\s*([\w.]+)\s*}}/g, (_, k) => escapeHtml(data[k] != null ? data[k] : ''));
}

/* Thay {{field}} ở phần "tĩnh" của variant.html, nhưng KHÔNG đụng vào bên
   trong <template data-list-template>...</template> — placeholder của field
   con (vd {{label}}, {{icon}}) phải giữ nguyên để vòng lặp per-item ở
   renderBlockInstance() thay sau, nếu không chúng bị xoá mất từ bước này
   (trước đây gây bug: mọi item trong field list hiện trống rỗng). */
function substituteOutsideTemplates(html, data) {
  const templateRegex = /<template\b[^>]*>[\s\S]*?<\/template>/g;
  const placeholders = [];
  const withoutTemplates = html.replace(templateRegex, (match) => {
    placeholders.push(match);
    return ' TPL' + (placeholders.length - 1) + ' ';
  });
  const substituted = substituteTemplate(withoutTemplates, data);
  return substituted.replace(/ TPL(\d+) /g, (_, i) => placeholders[+i]);
}

function applyInstanceStyle(root, variant, instance) {
  (variant.style || []).forEach((s) => {
    if (s.type === 'color' && s.key === 'bg') {
      const opacity = instance.style.opacity != null ? instance.style.opacity : 1;
      root.style.setProperty('--blk-bg', hexToRgba(instance.style.bg, opacity));
    } else if (s.type === 'color' && s.key === 'text') {
      root.style.setProperty('--blk-text', instance.style.text);
    } else if (s.type === 'font') {
      const font = CATALOG.fonts.find((f) => f.id === instance.style.font) || CATALOG.fonts[0];
      root.style.setProperty('--blk-font', font.stack);
    } else if (s.type === 'toggle') {
      // Generic: chỉ bật/tắt class "blk--<key>" trên khối — hiệu ứng thật
      // (vd đè lên khối dưới) khai báo hoàn toàn trong blocks.css theo đúng
      // class đó, không cần sửa engine khi thêm toggle mới.
      // s.autoWhen: tự bật thêm khi 1 style khác thoả điều kiện (vd nổi lên
      // ngay khi opacity < 1, không cần tick checkbox riêng) — không lưu
      // lại, chỉ tính lại mỗi lần áp style. Class "-forced" (vd ép nền
      // trong suốt hoàn toàn) CHỈ bật khi tick checkbox thật (manualOn),
      // không tính auto — nếu không, kéo opacity sẽ luôn nhảy thẳng về
      // trong suốt 100% ngay khi vừa nhích khỏi 1 thay vì theo đúng %.
      const manualOn = !!instance.style[s.key];
      let on = manualOn;
      if (s.autoWhen && instance.style[s.autoWhen.key] != null && s.autoWhen.lt != null) {
        if (instance.style[s.autoWhen.key] < s.autoWhen.lt) on = true;
      }
      root.classList.toggle('blk--' + s.key, on);
      root.classList.toggle('blk--' + s.key + '-forced', manualOn);
    } else if (s.type === 'fontSize' || s.type === 'sizeVar') {
      // Generic: set 1 CSS custom property (s.cssVar) trên khối, blocks.css
      // tự quyết định phần tử nào dùng var đó (vd chỉ link menu, KHÔNG đụng
      // nút CTA — nút CTA đã có kích thước chữ riêng trong popup Tuỳ chỉnh
      // nút bấm). Dùng custom property thay vì querySelectorAll trực tiếp
      // vì field list (menu-item) còn dựng DOM sau bước này — style qua
      // biến CSS thì luôn áp dụng đúng dù phần tử được thêm vào sau.
      // "sizeVar" = cùng cơ chế với "fontSize" nhưng dùng cho các biến px
      // khác không phải cỡ chữ (vd bo góc) — tách type riêng chỉ để catalog
      // đọc rõ nghĩa hơn, không phải để engine xử lý khác đi.
      const val = instance.style[s.key] != null ? instance.style[s.key] : s.default;
      root.style.setProperty(s.cssVar, val + 'px');
    } else if (s.type === 'shadow') {
      // s.lockWhen: khi điều kiện đúng (vd opacity < 1 — khối đang nổi/gần
      // trong suốt), đổ bóng vô nghĩa nên ép về 0 bất kể giá trị đã lưu,
      // không cần đợi người dùng tương tác lại slider mới đúng.
      const val = isStyleLocked(s, instance) ? 0 : (instance.style[s.key] != null ? instance.style[s.key] : s.default);
      root.style.boxShadow = val > 0 ? '0 ' + val + 'px ' + Math.round(val * 1.4) + 'px rgba(11,15,20,0.18)' : 'none';
      // Không dùng inline z-index (sẽ luôn thắng !important của .blk--overlay
      // do cùng thuộc tính) — bật qua class để CSS tự phân định thứ tự đúng
      // khi cả 2 cùng áp dụng (dù thực tế không xảy ra vì shadow bị khoá
      // về 0 ngay khi opacity < 1 — chính là điều kiện bật overlay).
      root.classList.toggle('blk--shadow-active', val > 0);
    } else if (s.type === 'navHover') {
      const effect = instance.style[s.key] || s.default;
      const color = instance.style[s.key + 'Color'] || s.colorDefault;
      root.className = root.className.replace(/\bblk-menu--hover-\S+/g, '').trim();
      if (effect !== 'none') root.classList.add('blk-menu--hover-' + effect);
      root.style.setProperty('--blk-nav-hover-color', color);

      const nav = root.querySelector('.blk-menu__nav');
      if (nav) {
        let indicator = nav.querySelector(':scope > .blk-menu__nav-indicator');
        let script = root.querySelector(':scope > script[data-nav-hover-script]');
        if (effect === 'underline-slide') {
          if (!indicator) {
            indicator = document.createElement('span');
            indicator.className = 'blk-menu__nav-indicator';
            nav.appendChild(indicator);
          }
          const navId = instance.id + '__navind';
          nav.dataset.navIndicatorId = navId;
          if (!script) {
            script = document.createElement('script');
            script.setAttribute('data-nav-hover-script', '');
            script.textContent = navHoverScript(navId);
            root.appendChild(script);
          }
        } else {
          if (indicator) indicator.remove();
          if (script) script.remove();
          nav.removeAttribute('data-nav-indicator-id');
        }
      }
    } else if (s.type === 'select') {
      // Generic: đổi 1 class "<cssClassPrefix><value>" trên khối theo lựa
      // chọn trong dropdown (vd kiểu nốt chỉ mục slideshow) — tương tự cách
      // navHover đổi class hiệu ứng, nhưng không cần 1 type riêng mỗi khi
      // thêm 1 dropdown mới, chỉ cần khai báo cssClassPrefix trong catalog.
      if (s.cssClassPrefix) {
        const prefix = s.cssClassPrefix;
        root.className = root.className.replace(new RegExp('\\b' + prefix + '\\S+', 'g'), '').trim();
        const val = instance.style[s.key] || s.default;
        if (val) root.classList.add(prefix + val);
      }
    }
  });
}
function isStyleLocked(s, instance) {
  if (!s.lockWhen) return false;
  const dep = instance.style[s.lockWhen.key];
  return dep != null && s.lockWhen.lt != null && dep < s.lockWhen.lt;
}
/* Sau khi 1 style bất kỳ đổi (vd opacity), kiểm tra các style khác có
   lockWhen phụ thuộc vào key vừa đổi — cập nhật ngay input tương ứng đang
   hiện trên sidebar (disable/ép giá trị) mà KHÔNG render lại toàn panel,
   để không làm gãy thao tác kéo của input đang được người dùng cầm. */
function syncLockedStyleControls(variant, inst) {
  (variant.style || []).forEach((s2) => {
    if (!s2.lockWhen) return;
    // Khoanh vùng bằng data-row-props-id của CHÍNH khối đang sửa — không
    // được tìm suông theo data-style-key thôi, vì 2 khối cùng loại (vd 2
    // khối menu) có thể đang mở panel cùng lúc và dùng chung style key,
    // querySelector sẽ luôn trúng phần tử đầu tiên gặp trong DOM (khối kia)
    // thay vì khối đang chỉnh sửa.
    const el = document.querySelector('[data-row-props-id="' + inst.id + '"] [data-style-key="' + s2.key + '"]');
    if (!el) return;
    const locked = isStyleLocked(s2, inst);
    el.disabled = locked;
    if (locked) {
      el.value = s2.default;
      inst.style[s2.key] = s2.default;
    }
  });
}


function addListItem(instanceId, listKey) {
  const inst = findInstance(instanceId);
  const variant = findVariant(inst.typeId, inst.variantId);
  const fieldDef = variant.fields.find((f) => f.key === listKey);
  const newItem = {};
  (fieldDef.itemFields || []).forEach((itf) => { newItem[itf.key] = itf.default; });
  inst.fields[listKey].push(newItem);
  renderCanvas();
  pushUndo();
  scheduleSave();
}
function removeListItem(instanceId, listKey, idx) {
  const inst = findInstance(instanceId);
  inst.fields[listKey].splice(idx, 1);
  renderCanvas();
  pushUndo();
  scheduleSave();
}

/* Dựng 1 instance khối thành DOM hoàn chỉnh, có gắn sẵn hành vi editor. */
function renderBlockInstance(instance) {
  const variant = findVariant(instance.typeId, instance.variantId);
  if (!variant) {
    const missing = document.createElement('div');
    missing.textContent = '[Khối không xác định]';
    return missing;
  }

  const staticFields = {};
  variant.fields.forEach((f) => {
    if (f.type === 'list') return;
    staticFields[f.key] = instance.fields[f.key];
  });
  const html = substituteOutsideTemplates(variant.html, staticFields);
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const root = wrapper.firstElementChild;
  root.dataset.instanceId = instance.id;
  root.dataset.typeId = instance.typeId;
  root.dataset.variantId = instance.variantId;
  applyInstanceStyle(root, variant, instance);

  // Field list: dựng từ <template data-list-template>
  Array.from(root.querySelectorAll('[data-list-template]')).forEach((tpl) => {
    const key = tpl.dataset.listTemplate;
    const fieldDef = variant.fields.find((f) => f.key === key);
    const container = root.querySelector('[data-list-container="' + key + '"]');
    const items = instance.fields[key] || [];
    items.forEach((itemData, idx) => {
      const itemHtml = substituteTemplate(tpl.innerHTML, itemData);
      const itemWrap = document.createElement('div');
      itemWrap.innerHTML = itemHtml;
      const itemEl = itemWrap.firstElementChild;
      itemEl.setAttribute('data-list-item', '');
      itemEl.dataset.listKey = key;
      itemEl.dataset.listIndex = String(idx);
      // fieldDef.slideshow: khối đầu tiên hiện sẵn — script tự chạy (xem
      // buildHeroDots/heroSlideScript) chỉ đổi class "is-active" qua lại
      // giữa các mục, không tự render lại DOM.
      if (fieldDef && fieldDef.slideshow && idx === 0) itemEl.classList.add('is-active');
      itemEl.querySelectorAll('[data-item-field]').forEach((f2) => {
        f2.setAttribute('data-editable-text', '');
        f2.dataset.bind = 'list:' + instance.id + ':' + key + ':' + idx + ':' + f2.dataset.itemField;
        // itemFields customStyle:"button" (vd nút "Xem thêm" của từng slide)
        // — cùng cơ chế popup Tuỳ chỉnh nút với field tĩnh/kéo tự do, chỉ
        // khác nơi lưu style (xem getButtonStyleRef).
        const itemFieldDef = fieldDef && (fieldDef.itemFields || []).find((itf) => itf.key === f2.dataset.itemField);
        if (itemFieldDef && itemFieldDef.customStyle === 'button') {
          wireButtonCustomStyle(instance, itemFieldDef, f2, { listKey: key, idx });
        } else if (itemFieldDef) {
          wireTextCustomStyle(instance, itemFieldDef, f2, { listKey: key, idx });
        }
      });
      // data-item-image: khác data-item-field ở trên — ảnh trong 1 mục list
      // (vd từng slide) không thể "gõ sửa trực tiếp" như text, cần 1 nút
      // upload riêng (wireListItemImage) thay vì contenteditable.
      itemEl.querySelectorAll('[data-item-image]').forEach((f2) => {
        wireListItemImage(instance, key, idx, f2.dataset.itemImage, f2);
      });
      itemEl.insertAdjacentHTML('afterbegin', toolsHtml('Xoá mục', { withHandle: !(fieldDef && fieldDef.noReorder) }));
      itemEl.querySelector('.tool-delete').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeListItem(instance.id, key, idx);
      });
      container.appendChild(itemEl);
    });
    // fieldDef.sidebarAdd: nút "Thêm mục" nằm ở sidebar (panel Tuỳ chỉnh khối)
    // thay vì chèn ngay trong canvas — dùng cho list nằm trong thanh mỏng như
    // menu, nơi 1 nút "+" giữa các link sẽ phá layout thật của thanh nav.
    if (!(fieldDef && fieldDef.sidebarAdd)) {
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'list-add-btn';
      addBtn.setAttribute('data-editor-only', '');
      addBtn.innerHTML = ICON_PLUS + ' Thêm mục';
      addBtn.addEventListener('click', () => addListItem(instance.id, key));
      container.after(addBtn);
    }
    tpl.remove();
    // fieldDef.noReorder: bỏ hẳn kéo-thả-sắp-xếp + icon tay nắm cho field
    // list này (vd nav menu — không cần kéo đổi thứ tự, chỉ thêm/xoá).
    if (!(fieldDef && fieldDef.noReorder)) {
      makeReorderable(container, ':scope > [data-list-item]', (fieldDef && fieldDef.listAxis) || 'y', (from, to) => {
        const inst = findInstance(instance.id);
        inst.fields[key] = reorderArray(inst.fields[key], from, to);
        renderCanvas();
        pushUndo();
        scheduleSave();
      });
    }
    // fieldDef.slideshow: dựng nốt chỉ mục + script tự chạy (dots+autoplay),
    // sống sót qua bản xuất tĩnh — xem buildHeroDots.
    if (fieldDef && fieldDef.slideshow) buildHeroDots(instance, key, container);
  });

  // Field text/richtext tĩnh (không phải list, không phải ảnh)
  variant.fields.filter((f) => f.type !== 'list' && f.type !== 'image').forEach((f) => {
    const el = root.querySelector('[data-field="' + f.key + '"]');
    if (!el) return;
    el.setAttribute('data-editable-text', '');
    el.dataset.bind = 'field:' + instance.id + ':' + f.key;
    if (f.multiline) el.dataset.multiline = 'true';
    if (f.customStyle === 'button') wireButtonCustomStyle(instance, f, el);
    else wireTextCustomStyle(instance, f, el);
  });

  // Field ảnh — bao gồm cả logo: zoom + lớp phủ qua popup
  variant.fields.filter((f) => f.type === 'image').forEach((f) => {
    const el = root.querySelector('[data-field="' + f.key + '"]');
    if (!el) return;
    wireImageCustomStyle(instance, f, el);
  });

  return root;
}

/* ------------------------------ Xuất bản: gỡ mọi thứ chỉ dành cho editor ------------------------------ */
function stripEditorArtifacts(root) {
  root.querySelectorAll('[data-editor-only]').forEach((el) => el.remove());
  root.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
  root.querySelectorAll('[data-editable-text]').forEach((el) => {
    el.removeAttribute('data-editable-text');
    el.removeAttribute('data-bind');
    el.removeAttribute('data-multiline');
  });
  root.querySelectorAll('[data-img-style-id]').forEach((el) => el.removeAttribute('data-img-style-id'));
  root.querySelectorAll('[data-list-item]').forEach((el) => {
    el.removeAttribute('data-list-item');
    el.removeAttribute('data-list-key');
    el.removeAttribute('data-list-index');
  });
  root.querySelectorAll('.is-dragging, .is-drag-ghost, .is-drop-target, .is-drop-target-row, .is-selected').forEach((el) => {
    el.classList.remove('is-dragging', 'is-drag-ghost', 'is-drop-target', 'is-drop-target-row', 'is-selected');
  });
  root.removeAttribute('data-instance-id');
  root.removeAttribute('data-type-id');
  root.removeAttribute('data-variant-id');
  return root;
}

/* ------------------------------ Render tổng: canvas + sidebar ------------------------------ */
function renderCanvas() {
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = '';
  if (!state.blocks.length) {
    const p = document.createElement('p');
    p.className = 'canvas-empty';
    p.id = 'canvasEmpty';
    p.textContent = 'Canvas trống — thêm khối đầu tiên từ sidebar bên trái.';
    canvas.appendChild(p);
  } else {
    state.blocks.forEach((inst) => canvas.appendChild(renderBlockInstance(inst)));
  }
  wireEditableText(canvas);
}

function selectBlock(id) {
  selectedBlockId = id;
  renderSidebar();
  const el = document.querySelector('#canvas [data-instance-id="' + id + '"]');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function removeBlock(id) {
  state.blocks = state.blocks.filter((b) => b.id !== id);
  if (selectedBlockId === id) selectedBlockId = null;
  openPanelIds.delete(id);
  renderAll();
  pushUndo();
  scheduleSave();
}

function toggleBlockProps(id) {
  if (openPanelIds.has(id)) openPanelIds.delete(id);
  else openPanelIds.add(id);
  renderSidebar();
}

function renderSidebar() {
  const list = document.getElementById('blockList');
  list.innerHTML = '';
  if (!state.blocks.length) {
    const p = document.createElement('p');
    p.className = 'sidebar-empty';
    p.id = 'sidebarEmpty';
    p.innerHTML = 'Chưa có khối nào — bấm <strong>Thêm khối</strong> để bắt đầu.';
    list.appendChild(p);
  } else {
    state.blocks.forEach((inst) => {
      const type = findType(inst.typeId);
      const variant = findVariant(inst.typeId, inst.variantId);
      const isOpen = openPanelIds.has(inst.id);
      const canHaveProps = blockHasProps(variant);
      const row = document.createElement('div');
      row.className = 'block-row' + (inst.id === selectedBlockId ? ' is-selected' : '') + (isOpen ? ' is-props-open' : '');
      row.setAttribute('data-list-item', '');
      // Cố ý KHÔNG dùng data-instance-id ở đây — trùng attribute với khối
      // thật trên canvas sẽ khiến querySelector('[data-instance-id=...]')
      // có thể chọn nhầm sidebar-row thay vì khối canvas (đã từng dính bug
      // này ở renderPropsPanel/selectBlock).
      row.dataset.rowInstanceId = inst.id;
      row.innerHTML =
        toolsHtml('Xoá khối', { withHandle: false, withSwap: true }) +
        '<span class="block-row-icon">' + (type.icon || '') + '</span>' +
        '<span class="block-row-text"><span class="block-row-type">' + escapeHtml(type.label) + '</span><span class="block-row-variant">' + escapeHtml(variant.label) + '</span></span>' +
        (canHaveProps ? '<button type="button" class="block-row-toggle" title="Tuỳ chỉnh khối">' + ICON_CHEVRON + '</button>' : '');
      row.querySelector('.tool-delete').addEventListener('click', (e) => { e.stopPropagation(); removeBlock(inst.id); });
      row.querySelector('.tool-swap').addEventListener('click', (e) => { e.stopPropagation(); openSwapModal(inst.id); });
      const toggleBtn = row.querySelector('.block-row-toggle');
      if (toggleBtn) toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleBlockProps(inst.id); });
      row.addEventListener('click', () => {
        if (row.__justDragged) { row.__justDragged = false; return; }
        selectBlock(inst.id);
      });
      list.appendChild(row);

      if (isOpen && canHaveProps) {
        const panel = document.createElement('div');
        panel.className = 'block-row-props';
        // data-row-props-id: mọi lookup style-control (vd syncLockedStyleControls)
        // PHẢI khoanh vùng qua id này — 2 khối cùng loại (vd 2 khối menu) mở
        // panel cùng lúc sẽ có data-style-key trùng nhau, tìm bằng class/attr
        // suông không khoanh vùng instance sẽ trúng panel của khối khác.
        panel.dataset.rowPropsId = inst.id;
        renderPropsPanel(panel, inst, variant);
        list.appendChild(panel);
      }
    });
    makeReorderable(list, ':scope > [data-list-item]', 'y', (from, to) => {
      state.blocks = reorderArray(state.blocks, from, to);
      renderAll();
      pushUndo();
      scheduleSave();
    }, { wholeItem: true });
  }
}

// fieldDef.sidebarAdd: field kiểu list muốn nút "Thêm mục" nằm ở panel Tuỳ
// chỉnh khối thay vì chèn trong canvas (xem renderBlockInstance).
function sidebarListFieldsOf(variant) {
  return (variant.fields || []).filter((f) => f.type === 'list' && f.sidebarAdd);
}
function blockHasProps(variant) {
  return !!((variant.style && variant.style.length) || sidebarListFieldsOf(variant).length);
}

// Render nội dung panel "Tuỳ chỉnh khối" của 1 khối cụ thể vào `panel` (mỗi
// khối đang mở có panel riêng, độc lập — xem renderSidebar). Luôn gắn liền
// với 1 `inst` cụ thể, không có khái niệm "khối đang chọn" ở đây, để nhiều
// khối cùng loại (vd 2 khối menu) mở panel đồng thời không ghi đè lẫn nhau.
function renderPropsPanel(panel, inst, variant) {
  panel.innerHTML = '';
  const sidebarListFields = sidebarListFieldsOf(variant);
  if (!blockHasProps(variant)) return;

  const title = document.createElement('div');
  title.className = 'props-title';
  title.textContent = 'Tuỳ chỉnh khối';
  panel.appendChild(title);

  (variant.style || []).forEach((s) => {
    // s.hidden: style vẫn được applyInstanceStyle() áp dụng bình thường
    // (vd overlay tự nổi khi opacity < 1 — xem autoWhen), chỉ không hiện
    // control trong sidebar vì đã có cách kích hoạt khác, tránh trùng UI.
    if (s.hidden) return;
    const row = document.createElement('div');
    row.className = 'prop-row';
    const label = document.createElement('label');
    label.textContent = s.label;
    row.appendChild(label);

    if (s.type === 'navHover') {
      const effects = [
        { id: 'none', label: 'Không có' },
        { id: 'color', label: 'Đổi màu chữ' },
        { id: 'underline-slide', label: 'Thanh trượt' },
        { id: 'zoom', label: 'Phóng to nhẹ' },
        { id: 'bold', label: 'Đậm chữ hơn' },
        { id: 'underline-grow', label: 'Gạch chân mở rộng' }
      ];
      const current = inst.style[s.key] || s.default;
      const select = document.createElement('select');
      effects.forEach((ef) => {
        const opt = document.createElement('option');
        opt.value = ef.id;
        opt.textContent = ef.label;
        if (ef.id === current) opt.selected = true;
        select.appendChild(opt);
      });
      row.appendChild(select);
      panel.appendChild(row);

      const needsColor = current === 'color' || current === 'underline-slide' || current === 'underline-grow';
      if (needsColor) {
        const colorRow = document.createElement('div');
        colorRow.className = 'prop-row';
        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'Màu hiệu ứng';
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = inst.style[s.key + 'Color'] || s.colorDefault;
        const applyColor = () => {
          inst.style[s.key + 'Color'] = colorInput.value;
          const rootEl = document.querySelector('#canvas [data-instance-id="' + inst.id + '"]');
          if (rootEl) applyInstanceStyle(rootEl, variant, inst);
        };
        colorInput.addEventListener('input', applyColor);
        colorInput.addEventListener('change', () => { applyColor(); pushUndo(); scheduleSave(); });
        colorRow.appendChild(colorLabel);
        colorRow.appendChild(colorInput);
        panel.appendChild(colorRow);
      }

      select.addEventListener('change', () => {
        inst.style[s.key] = select.value;
        const rootEl = document.querySelector('#canvas [data-instance-id="' + inst.id + '"]');
        if (rootEl) applyInstanceStyle(rootEl, variant, inst);
        pushUndo(); scheduleSave();
        renderPropsPanel(panel, inst, variant);
      });
      return;
    }

    let input;
    if (s.type === 'color') {
      input = document.createElement('input');
      input.type = 'color';
      input.value = inst.style[s.key];
    } else if (s.type === 'range' || s.type === 'fontSize' || s.type === 'shadow' || s.type === 'sizeVar') {
      input = document.createElement('input');
      input.type = 'range';
      input.min = s.min; input.max = s.max; input.step = s.step;
      const locked = s.type === 'shadow' && isStyleLocked(s, inst);
      input.value = locked ? s.default : (inst.style[s.key] != null ? inst.style[s.key] : s.default);
      input.disabled = locked;
    } else if (s.type === 'font') {
      input = document.createElement('select');
      CATALOG.fonts.forEach((f) => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.label;
        if (f.id === inst.style[s.key]) opt.selected = true;
        input.appendChild(opt);
      });
    } else if (s.type === 'toggle') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!inst.style[s.key];
    } else if (s.type === 'select') {
      input = document.createElement('select');
      (s.options || []).forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt.id;
        o.textContent = opt.label;
        if (opt.id === (inst.style[s.key] || s.default)) o.selected = true;
        input.appendChild(o);
      });
    }
    if (!input) return;
    input.dataset.styleKey = s.key;

    const applyLive = () => {
      inst.style[s.key] = (s.type === 'range' || s.type === 'fontSize' || s.type === 'shadow' || s.type === 'sizeVar') ? parseFloat(input.value) : s.type === 'toggle' ? input.checked : input.value;
      const rootEl = document.querySelector('#canvas [data-instance-id="' + inst.id + '"]');
      if (rootEl) applyInstanceStyle(rootEl, variant, inst);
      syncLockedStyleControls(variant, inst);
    };
    input.addEventListener('input', applyLive);
    input.addEventListener('change', () => { applyLive(); pushUndo(); scheduleSave(); });
    row.appendChild(input);
    panel.appendChild(row);
  });

  sidebarListFields.forEach((f) => {
    const row = document.createElement('div');
    row.className = 'prop-row prop-row--list-add';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'list-add-btn';
    addBtn.innerHTML = ICON_PLUS + ' Thêm ' + (f.itemLabel || 'mục');
    addBtn.addEventListener('click', () => addListItem(inst.id, f.key));
    row.appendChild(addBtn);
    panel.appendChild(row);
  });
}

function renderAll() {
  renderCanvas();
  renderSidebar();
}

/* ------------------------------ Thêm khối ------------------------------ */
function addBlockInstance(typeId, variantId) {
  const inst = createInstanceFromVariant(typeId, variantId);
  if (typeId === 'menu') {
    // Menu luôn nằm trên cùng trang, bất kể đang chọn khối nào — không đi
    // theo quy tắc "chèn sau khối đang chọn" như các loại khối khác.
    state.blocks.unshift(inst);
  } else {
    const afterId = selectedBlockId;
    if (afterId) {
      const idx = state.blocks.findIndex((b) => b.id === afterId);
      state.blocks.splice(idx + 1, 0, inst);
    } else {
      state.blocks.push(inst);
    }
  }
  selectedBlockId = inst.id;
  renderAll();
  pushUndo();
  scheduleSave();
}

/* Đổi mẫu 1 khối đã có sẵn sang variant khác (cùng loại hoặc khác loại) —
   giữ nguyên id/vị trí trong state.blocks, nhưng field/style dựng lại hoàn
   toàn theo default của variant mới vì schema field mỗi variant có thể khác
   nhau, không thể map field cũ sang field mới 1 cách an toàn. */
function swapBlockVariant(instanceId, typeId, variantId) {
  const idx = state.blocks.findIndex((b) => b.id === instanceId);
  if (idx === -1) return;
  const fresh = createInstanceFromVariant(typeId, variantId);
  fresh.id = instanceId;
  state.blocks[idx] = fresh;
  selectedBlockId = instanceId;
  renderAll();
  pushUndo();
  scheduleSave();
}

/* Popup xác nhận đẹp dùng chung, thay cho window.confirm() mặc định của
   trình duyệt — trả về Promise<boolean> để nơi gọi "await" như confirm(). */
function askConfirm(message, opts) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    document.getElementById('confirmTitle').textContent = (opts && opts.title) || 'Xác nhận';
    document.getElementById('confirmMessage').textContent = message;
    okBtn.textContent = (opts && opts.okLabel) || 'Đồng ý';
    cancelBtn.textContent = (opts && opts.cancelLabel) || 'Huỷ';

    const cleanup = (result) => {
      modal.classList.remove('is-open');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onOverlay);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onOverlay = (e) => { if (e.target === modal) cleanup(false); };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onOverlay);
    modal.classList.add('is-open');
  });
}

function openSwapModal(instanceId) {
  const inst = findInstance(instanceId);
  if (!inst) return;
  swapTargetId = instanceId;
  addModalCategory = inst.typeId;
  openAddModal();
}

/* ------------------------------ Popup tuỳ chỉnh nút bấm (customStyle:"button") ------------------------------ */
/* Tìm lại đúng field def + object style (+ styleId dùng để querySelector
   trên canvas) đang được popup "Tuỳ chỉnh nút" trỏ tới, theo btnStyleTarget
   hiện tại — dùng chung cho mọi hàm xử lý popup, tránh lặp lại logic phân
   nhánh field tĩnh/kéo tự do (instance.buttonStyles) vs field trong 1 mục
   list (lưu ngay trong item, xem getButtonStyleRef). */
function resolveButtonTarget() {
  if (!btnStyleTarget) return null;
  const inst = findInstance(btnStyleTarget.instanceId);
  if (!inst) return null;
  const variant = findVariant(inst.typeId, inst.variantId);
  if (!variant) return null;
  let f;
  if (btnStyleTarget.itemCtx) {
    const listField = variant.fields.find((ff) => ff.key === btnStyleTarget.itemCtx.listKey);
    f = listField && (listField.itemFields || []).find((itf) => itf.key === btnStyleTarget.fieldKey);
  } else {
    f = variant.fields.find((ff) => ff.key === btnStyleTarget.fieldKey);
  }
  if (!f) return null;
  return { inst, f, bs: getButtonStyleRef(inst, f, btnStyleTarget.itemCtx), styleId: buttonStyleIdOf(inst.id, f, btnStyleTarget.itemCtx) };
}
function openButtonStyleModal(instanceId, fieldKey, itemCtx) {
  btnStyleTarget = { instanceId, fieldKey, itemCtx };
  const ctx = resolveButtonTarget();
  if (!ctx) { btnStyleTarget = null; return; }
  const bs = ctx.bs;
  document.getElementById('btnStyleBg').value = bs.bg;
  document.getElementById('btnStyleBgOpacity').value = bs.bgOpacity != null ? bs.bgOpacity : 1;
  document.getElementById('btnStyleText').value = bs.text;
  document.getElementById('btnStyleFont').value = bs.font || '';
  document.getElementById('btnStylePaddingX').value = bs.paddingX != null ? bs.paddingX : 20;
  document.getElementById('btnStylePaddingY').value = bs.paddingY != null ? bs.paddingY : 13;
  document.getElementById('btnStyleFontSize').value = bs.fontSize != null ? bs.fontSize : 14;
  document.getElementById('btnStyleRadius').value = bs.radius;
  document.getElementById('btnStyleBorderWidth').value = bs.borderWidth != null ? bs.borderWidth : 0;
  document.getElementById('btnStyleBorderColor').value = bs.borderColor || bs.bg;
  document.getElementById('btnStyleShadow').value = bs.shadow != null ? bs.shadow : 0;
  document.getElementById('btnStyleWeight').value = bs.fontWeight || 700;
  document.getElementById('btnStyleItalic').checked = !!bs.italic;
  document.getElementById('btnStyleUnderline').checked = !!bs.underline;
  document.getElementById('btnStyleHover').value = bs.hoverEffect;
  updateButtonIconControlsUI();
  document.getElementById('buttonStyleModal').classList.add('is-open');
}
function closeButtonStyleModal() {
  document.getElementById('buttonStyleModal').classList.remove('is-open');
  btnStyleTarget = null;
}
function updateButtonIconControlsUI() {
  const ctx = resolveButtonTarget();
  if (!ctx) return;
  const bs = ctx.bs;
  const iconDef = bs.icon ? ICONS_CATALOG.find((ic) => ic.id === bs.icon) : null;
  document.getElementById('btnStyleIconPickBtn').textContent = iconDef ? iconDef.label + ' — đổi' : 'Chọn icon…';
  document.getElementById('btnStyleIconGroup').style.display = iconDef ? '' : 'none';
  if (iconDef) {
    document.getElementById('btnStyleIconColor').value = bs.iconColor || bs.text;
    document.getElementById('btnStyleIconSize').value = bs.iconSize != null ? bs.iconSize : 18;
  }
}
function applyButtonIconLive() {
  const ctx = resolveButtonTarget();
  if (!ctx) return;
  const bs = ctx.bs;
  bs.iconColor = document.getElementById('btnStyleIconColor').value;
  bs.iconSize = parseFloat(document.getElementById('btnStyleIconSize').value);
  const btnEl = document.querySelector('#canvas [data-btn-style-id="' + ctx.styleId + '"]');
  if (btnEl) applyButtonIcon(btnEl, bs);
}
function openIconPicker() {
  if (!btnStyleTarget) return;
  renderIconPickerGrid();
  document.getElementById('iconPickerModal').classList.add('is-open');
}
function closeIconPicker() {
  document.getElementById('iconPickerModal').classList.remove('is-open');
}
function renderIconPickerGrid() {
  const grid = document.getElementById('iconPickerGrid');
  grid.innerHTML = '';
  const ctx = resolveButtonTarget();
  if (!ctx) return;
  const bs = ctx.bs;

  const noneItem = document.createElement('button');
  noneItem.type = 'button';
  noneItem.className = 'icon-picker-item' + (!bs.icon ? ' is-selected' : '');
  noneItem.innerHTML = ICON_DELETE + '<span>Không có</span>';
  noneItem.addEventListener('click', () => selectButtonIcon(''));
  grid.appendChild(noneItem);

  ICONS_CATALOG.forEach((icon) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'icon-picker-item' + (bs.icon === icon.id ? ' is-selected' : '');
    item.innerHTML = icon.svg + '<span>' + escapeHtml(icon.label) + '</span>';
    item.addEventListener('click', () => selectButtonIcon(icon.id));
    grid.appendChild(item);
  });
}
function selectButtonIcon(iconId) {
  const ctx = resolveButtonTarget();
  if (!ctx) return;
  const bs = ctx.bs;
  bs.icon = iconId;
  if (iconId && !bs.iconColor) bs.iconColor = bs.text;
  if (iconId && bs.iconSize == null) bs.iconSize = 18;
  const btnEl = document.querySelector('#canvas [data-btn-style-id="' + ctx.styleId + '"]');
  if (btnEl) applyButtonIcon(btnEl, bs);
  updateButtonIconControlsUI();
  pushUndo(); scheduleSave();
  closeIconPicker();
}
function applyButtonStyleLive() {
  const ctx = resolveButtonTarget();
  if (!ctx) return;
  const bs = ctx.bs;
  bs.bg = document.getElementById('btnStyleBg').value;
  bs.bgOpacity = parseFloat(document.getElementById('btnStyleBgOpacity').value);
  bs.text = document.getElementById('btnStyleText').value;
  bs.font = document.getElementById('btnStyleFont').value;
  bs.paddingX = parseInt(document.getElementById('btnStylePaddingX').value, 10);
  bs.paddingY = parseInt(document.getElementById('btnStylePaddingY').value, 10);
  bs.fontSize = parseInt(document.getElementById('btnStyleFontSize').value, 10);
  bs.radius = parseInt(document.getElementById('btnStyleRadius').value, 10);
  bs.borderWidth = parseFloat(document.getElementById('btnStyleBorderWidth').value);
  bs.borderColor = document.getElementById('btnStyleBorderColor').value;
  bs.shadow = parseFloat(document.getElementById('btnStyleShadow').value);
  bs.fontWeight = parseInt(document.getElementById('btnStyleWeight').value, 10);
  bs.italic = document.getElementById('btnStyleItalic').checked;
  bs.underline = document.getElementById('btnStyleUnderline').checked;
  bs.hoverEffect = document.getElementById('btnStyleHover').value;
  const styleId = ctx.styleId;
  const btnEl = document.querySelector('#canvas [data-btn-style-id="' + styleId + '"]');
  if (btnEl) {
    const wrap = btnEl.parentElement;
    const styleTag = wrap.querySelector('style');
    if (styleTag) styleTag.textContent = buttonStyleCss(styleId, bs);
    // Hiệu ứng "spotlight" cần script theo dõi chuột — thêm/gỡ ngay khi
    // đổi hiệu ứng trong popup mà không cần render lại toàn khối.
    const hasScript = !!wrap.querySelector('script');
    if (bs.hoverEffect === 'spotlight' && !hasScript) {
      const scriptTag = document.createElement('script');
      scriptTag.textContent = buttonStyleScript(styleId);
      wrap.appendChild(scriptTag);
    } else if (bs.hoverEffect !== 'spotlight' && hasScript) {
      wrap.querySelector('script').remove();
    }
  }
}

/* ------------------------------ Popup tuỳ chỉnh chữ (mọi field type:"text"/"richtext") ------------------------------ */
function resolveTextTarget() {
  if (!textStyleTarget) return null;
  const inst = findInstance(textStyleTarget.instanceId);
  if (!inst) return null;
  const variant = findVariant(inst.typeId, inst.variantId);
  if (!variant) return null;
  let f;
  if (textStyleTarget.itemCtx) {
    const listField = variant.fields.find((ff) => ff.key === textStyleTarget.itemCtx.listKey);
    f = listField && (listField.itemFields || []).find((itf) => itf.key === textStyleTarget.fieldKey);
  } else {
    f = variant.fields.find((ff) => ff.key === textStyleTarget.fieldKey);
  }
  if (!f) return null;
  return { inst, f, ts: getTextStyleRef(inst, f, textStyleTarget.itemCtx), styleId: textStyleIdOf(inst.id, f, textStyleTarget.itemCtx) };
}
/* Điền popup: field nào NGƯỜI DÙNG ĐÃ ĐỔI (ts.<key> có giá trị) thì hiện
   đúng giá trị đó; field nào CHƯA đụng tới thì đọc computed style hiện tại
   của chính field đó làm điểm khởi đầu — set .value bằng JS không tự bắn
   event "input"/"change" nên ts vẫn giữ nguyên trống cho tới khi người dùng
   thực sự kéo/chọn gì trong popup (xem applyTextStyleLive). */
function openTextStyleModal(instanceId, fieldKey, itemCtx) {
  textStyleTarget = { instanceId, fieldKey, itemCtx };
  const ctx = resolveTextTarget();
  if (!ctx) { textStyleTarget = null; return; }
  const ts = ctx.ts;
  const el = document.querySelector('#canvas [data-text-style-id="' + ctx.styleId + '"]');
  const cs = el ? getComputedStyle(el) : null;
  document.getElementById('textStyleColor').value = ts.color || (cs ? rgbStringToHex(cs.color) : '#0b0f14');
  document.getElementById('textStyleFont').value = ts.font || '';
  document.getElementById('textStyleFontSize').value = ts.fontSize != null ? ts.fontSize : (cs ? Math.round(parseFloat(cs.fontSize)) : 16);
  document.getElementById('textStyleWeight').value = ts.fontWeight || (cs ? nearestWeightOption(parseFloat(cs.fontWeight)) : 400);
  document.getElementById('textStyleItalic').checked = ts.italic != null ? ts.italic : !!(cs && cs.fontStyle === 'italic');
  document.getElementById('textStyleUnderline').checked = ts.underline != null ? ts.underline : !!(cs && cs.textDecorationLine.includes('underline'));
  document.getElementById('textStyleModal').classList.add('is-open');
}
function closeTextStyleModal() {
  document.getElementById('textStyleModal').classList.remove('is-open');
  textStyleTarget = null;
}
function applyTextStyleLive() {
  const ctx = resolveTextTarget();
  if (!ctx) return;
  const ts = ctx.ts;
  ts.color = document.getElementById('textStyleColor').value;
  ts.font = document.getElementById('textStyleFont').value;
  ts.fontSize = parseInt(document.getElementById('textStyleFontSize').value, 10);
  ts.fontWeight = parseInt(document.getElementById('textStyleWeight').value, 10);
  ts.italic = document.getElementById('textStyleItalic').checked;
  ts.underline = document.getElementById('textStyleUnderline').checked;
  const el = document.querySelector('#canvas [data-text-style-id="' + ctx.styleId + '"]');
  if (el) {
    const styleTag = el.parentElement.querySelector('style');
    if (styleTag) styleTag.textContent = textStyleCss(ctx.styleId, ts);
  }
}
// Xoá hết mọi ghi đè đã lưu, trả field về đúng giao diện gốc của khối — mở
// lại popup ngay sau đó để các ô hiện lại đúng giá trị "theo khối" (computed
// style tự nhiên, không còn ts nào áp nữa).
function resetTextStyle() {
  const ctx = resolveTextTarget();
  if (!ctx) return;
  const target = textStyleTarget;
  if (target.itemCtx) {
    ctx.inst.fields[target.itemCtx.listKey][target.itemCtx.idx][target.fieldKey + '__textStyle'] = {};
  } else {
    ctx.inst.textStyles[target.fieldKey] = {};
  }
  const el = document.querySelector('#canvas [data-text-style-id="' + ctx.styleId + '"]');
  if (el) {
    const styleTag = el.parentElement.querySelector('style');
    if (styleTag) styleTag.textContent = '';
  }
  pushUndo();
  scheduleSave();
  openTextStyleModal(target.instanceId, target.fieldKey, target.itemCtx);
}

/* ------------------------------ Popup tuỳ chỉnh ảnh (mọi field type:"image") ------------------------------
   fieldDef.ratio: khai báo presets tỉ lệ (vd logo) — có mới hiện mục "Tỉ lệ
   ảnh". fieldDef.allowOverlay === false: coi ảnh này là đặc biệt (vd logo),
   ẩn hẳn mục "Lớp phủ" vì không hợp lý (logo nhỏ, không cần phủ màu). */
function openImageStyleModal(instanceId, fieldKey) {
  const inst = findInstance(instanceId);
  if (!inst || !inst.imageStyles || !inst.imageStyles[fieldKey]) return;
  const variant = findVariant(inst.typeId, inst.variantId);
  const fieldDef = (variant.fields || []).find((f) => f.key === fieldKey);
  imgStyleTarget = { instanceId, fieldKey, fieldDef };
  const is_ = inst.imageStyles[fieldKey];
  document.getElementById('imgStyleZoom').value = is_.zoom != null ? is_.zoom : 1;

  const hasRatio = !!(fieldDef && fieldDef.ratio);
  document.getElementById('imgStyleRatioGroup').style.display = hasRatio ? '' : 'none';
  if (hasRatio) renderImageRatioControl();

  const allowOverlay = !(fieldDef && fieldDef.allowOverlay === false);
  document.getElementById('imgStyleOverlayGroup').style.display = allowOverlay ? '' : 'none';
  if (allowOverlay) {
    document.getElementById('imgStyleOverlayToggle').checked = !!is_.overlay;
    document.getElementById('imgStyleOverlayColor').value = is_.overlayColor || '#ffffff';
    document.getElementById('imgStyleOverlayOpacity').value = is_.overlayOpacity != null ? is_.overlayOpacity : 0.5;
    updateImageOverlayRowsVisibility();
  }
  document.getElementById('imageStyleModal').classList.add('is-open');
}
function closeImageStyleModal() {
  document.getElementById('imageStyleModal').classList.remove('is-open');
  imgStyleTarget = null;
}
function updateImageOverlayRowsVisibility() {
  const on = document.getElementById('imgStyleOverlayToggle').checked;
  document.getElementById('imgStyleOverlayColorRow').style.display = on ? '' : 'none';
  document.getElementById('imgStyleOverlayOpacityRow').style.display = on ? '' : 'none';
}
function renderImageRatioControl() {
  if (!imgStyleTarget || !imgStyleTarget.fieldDef || !imgStyleTarget.fieldDef.ratio) return;
  const inst = findInstance(imgStyleTarget.instanceId);
  const is_ = inst.imageStyles[imgStyleTarget.fieldKey];
  const ratioCfg = imgStyleTarget.fieldDef.ratio;
  const presets = ratioCfg.presets || [];
  const presetIds = presets.map((p) => p.id);
  const current = is_.ratio || ratioCfg.default;
  const modeKey = imgStyleTarget.instanceId + ':' + imgStyleTarget.fieldKey;
  const isCustom = customImgRatioMode.has(modeKey) || !presetIds.includes(current);

  const select = document.getElementById('imgStyleRatio');
  select.innerHTML = '';
  presets.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label;
    if (p.id === current) opt.selected = true;
    select.appendChild(opt);
  });
  const customOpt = document.createElement('option');
  customOpt.value = '__custom__';
  customOpt.textContent = 'Tuỳ chỉnh…';
  if (isCustom) customOpt.selected = true;
  select.appendChild(customOpt);

  const customRow = document.getElementById('imgStyleRatioCustomRow');
  customRow.style.display = isCustom ? 'flex' : 'none';
  if (isCustom) {
    const [w, h] = current.split(':');
    document.getElementById('imgStyleRatioW').value = w;
    document.getElementById('imgStyleRatioH').value = h;
  }
}
function applyImageRatioLive(value) {
  if (!imgStyleTarget) return;
  const inst = findInstance(imgStyleTarget.instanceId);
  if (!inst) return;
  const is_ = inst.imageStyles[imgStyleTarget.fieldKey];
  is_.ratio = value;
  const styleId = imgStyleTarget.instanceId + '__' + imgStyleTarget.fieldKey;
  const imgEl = document.querySelector('#canvas [data-img-style-id="' + styleId + '"]');
  if (imgEl) applyImageStyle(imgEl, imgEl.parentElement, is_);
}
function applyImageStyleLive() {
  if (!imgStyleTarget) return;
  const inst = findInstance(imgStyleTarget.instanceId);
  if (!inst) return;
  const is_ = inst.imageStyles[imgStyleTarget.fieldKey];
  is_.zoom = parseFloat(document.getElementById('imgStyleZoom').value);
  const allowOverlay = !(imgStyleTarget.fieldDef && imgStyleTarget.fieldDef.allowOverlay === false);
  if (allowOverlay) {
    is_.overlay = document.getElementById('imgStyleOverlayToggle').checked;
    is_.overlayColor = document.getElementById('imgStyleOverlayColor').value;
    is_.overlayOpacity = parseFloat(document.getElementById('imgStyleOverlayOpacity').value);
    updateImageOverlayRowsVisibility();
  }
  const styleId = imgStyleTarget.instanceId + '__' + imgStyleTarget.fieldKey;
  const imgEl = document.querySelector('#canvas [data-img-style-id="' + styleId + '"]');
  if (imgEl) applyImageStyle(imgEl, imgEl.parentElement, is_);
}

function renderAddModalCategories() {
  const wrap = document.getElementById('addCategories');
  wrap.innerHTML = '';
  CATALOG.types.forEach((t) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'add-category-btn' + (t.id === addModalCategory ? ' is-active' : '');
    btn.innerHTML = (t.icon || '') + '<span>' + escapeHtml(t.label) + '</span>';
    btn.addEventListener('click', () => { addModalCategory = t.id; renderAddModalCategories(); renderAddModalVariants(); });
    wrap.appendChild(btn);
  });
}
function renderAddModalVariants() {
  const wrap = document.getElementById('addVariants');
  wrap.innerHTML = '';
  const type = findType(addModalCategory);
  if (!type) return;
  const swapInst = swapTargetId ? findInstance(swapTargetId) : null;
  type.variants.forEach((v) => {
    const isCurrent = !!(swapInst && swapInst.typeId === type.id && swapInst.variantId === v.id);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'variant-card' + (isCurrent ? ' is-current' : '');

    const previewInstance = createInstanceFromVariant(type.id, v.id);
    const previewEl = renderBlockInstance(previewInstance);
    stripEditorArtifacts(previewEl);

    const thumb = document.createElement('div');
    thumb.className = 'variant-thumb';
    const inner = document.createElement('div');
    inner.className = 'variant-thumb-inner';
    inner.appendChild(previewEl);
    thumb.appendChild(inner);

    const label = document.createElement('div');
    label.className = 'variant-label';
    label.textContent = v.label + (isCurrent ? ' (đang dùng)' : '');

    card.appendChild(thumb);
    card.appendChild(label);
    card.addEventListener('click', async () => {
      if (swapTargetId) {
        // Hỏi xác nhận ngay khi chọn mẫu mới, vì lúc này mới thực sự biết
        // người dùng muốn đổi — bấm nút "Đổi mẫu" ở sidebar chỉ để mở popup
        // xem qua, chưa chắc đã đổi.
        const ok = await askConfirm(
          'Những thay đổi trên khối này sẽ bị reset. Bạn có chắc muốn đổi mẫu không?',
          { title: 'Đổi mẫu khối?', okLabel: 'Đồng ý, đổi mẫu' }
        );
        if (!ok) return;
        swapBlockVariant(swapTargetId, type.id, v.id);
      } else {
        addBlockInstance(type.id, v.id);
      }
      closeAddModal();
    });
    wrap.appendChild(card);
  });
}
function openAddModal() {
  if (!addModalCategory) addModalCategory = CATALOG.types[0].id;
  document.getElementById('addModalTitle').textContent = swapTargetId ? 'Đổi mẫu khối' : 'Thêm khối';
  renderAddModalCategories();
  renderAddModalVariants();
  document.getElementById('addBlockModal').classList.add('is-open');
}
function closeAddModal() {
  document.getElementById('addBlockModal').classList.remove('is-open');
  swapTargetId = null;
}

/* ------------------------------ Ảnh upload ------------------------------ */
function openUpload(bind) {
  uploadTarget = bind;
  document.getElementById('uploadTitle').textContent = 'Đổi ảnh';
  document.getElementById('uploadOverlay').classList.add('is-open');
}
function closeUpload() {
  document.getElementById('uploadOverlay').classList.remove('is-open');
  document.getElementById('uploadInput').value = '';
  uploadTarget = null;
}

/* ------------------------------ Font ------------------------------ */
function loadCatalogFonts() {
  CATALOG.fonts.forEach((f) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + f.google + '&display=swap';
    document.head.appendChild(link);
  });
}
function populateFontSelects() {
  ['btnStyleFont', 'textStyleFont'].forEach((id) => {
    const sel = document.getElementById(id);
    CATALOG.fonts.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.label;
      sel.appendChild(opt);
    });
  });
}

/* ------------------------------ Export ------------------------------ */
/* Trong lúc chỉnh sửa, ảnh dùng đường dẫn gốc (/images/…) để trang builder
   chạy được ở /tool-landing-builder/. Bản xuất ra là site độc lập nên phải
   đổi ngược về images/… cho khớp cấu trúc thư mục trong file ZIP. */
function toRelativeAssets(htmlStr) {
  return htmlStr
    .replace(/(src|href|srcset)="\/images\//g, '$1="images/')
    .replace(/url\((["\']?)\/images\//g, 'url($1images/');
}

function buildExportDocument() {
  const usedFontIds = new Set();
  state.blocks.forEach((inst) => { if (inst.style && inst.style.font) usedFontIds.add(inst.style.font); });
  const fontLinks = CATALOG.fonts.filter((f) => usedFontIds.has(f.id))
    .map((f) => '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=' + f.google + '&display=swap">')
    .join('\n');
  const bodyHtml = state.blocks.map((inst) => {
    const el = renderBlockInstance(inst);
    stripEditorArtifacts(el);
    return el.outerHTML;
  }).join('\n');
  const bodyOut = toRelativeAssets(bodyHtml);
  return '<!DOCTYPE html>\n<html lang="vi">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Trang của bạn</title>\n' +
    fontLinks + '\n<link rel="stylesheet" href="css/blocks.css">\n</head>\n<body>\n' + bodyOut + '\n</body>\n</html>\n';
}

/* Mở tab mới thuần HTML/CSS đã build — không dính script/DOM của editor,
   vì dùng chính buildExportDocument() (đã stripEditorArtifacts) render ra
   1 trang tĩnh độc lập, nạp qua Blob URL thay vì chia sẻ document hiện tại. */
function previewSite() {
  if (!state.blocks.length) {
    window.alert('Chưa có khối nào để xem trước — hãy thêm khối trước đã.');
    return;
  }
  // Chèn <base> trỏ về gốc site: trang preview nạp qua blob URL (không có
  // "thư mục" thật) nên các đường dẫn tương đối như css/blocks.css, images/...
  // trong buildExportDocument() cần điểm neo này mới load được.
  const baseHref = location.origin + '/';
  const html = buildExportDocument().replace('<head>', '<head>\n<base href="' + baseHref + '">');
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/data:(.*?);base64/)[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
function ensureJsZip() {
  if (window.JSZip) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Không tải được thư viện JSZip'));
    document.head.appendChild(s);
  });
}
async function exportZip() {
  await ensureJsZip();
  const zip = new window.JSZip();
  zip.file('index.html', buildExportDocument());
  zip.file('css/blocks.css', await fetch('/css/blocks.css').then((r) => r.text()));

  const staticImagePaths = new Set();
  state.blocks.forEach((inst) => {
    const variant = findVariant(inst.typeId, inst.variantId);
    (variant.fields || []).forEach((f) => {
      if (f.type === 'image') {
        const val = inst.fields[f.key];
        if (val && !val.startsWith('data:')) staticImagePaths.add(val);
      } else if (f.type === 'list') {
        // Ảnh trong từng mục list (vd từng slide hero) — không nằm ở field
        // cấp khối nên phải soát riêng, nếu không ảnh mặc định (đường dẫn
        // tĩnh, chưa từng đổi qua upload) sẽ bị thiếu trong ZIP xuất ra.
        (f.itemFields || []).forEach((itf) => {
          if (itf.type !== 'image') return;
          (inst.fields[f.key] || []).forEach((item) => {
            const val = item[itf.key];
            if (val && !val.startsWith('data:')) staticImagePaths.add(val);
          });
        });
      }
    });
  });
  if (staticImagePaths.size) {
    const imgFolder = zip.folder('images');
    await Promise.all(Array.from(staticImagePaths).map(async (path) => {
      try {
        const blob = await fetch(path).then((r) => r.blob());
        imgFolder.file(path.split('/').pop(), blob);
      } catch (e) { /* bỏ qua nếu không tải được */ }
    }));
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'web100-landing.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function showAdminExport() {
  const payload = { app: 'web100-builder', state };
  const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  document.getElementById('exportAdminCode').value = base64;
  document.getElementById('exportAdminBox').classList.add('is-open');
}

/* ------------------------------ Wiring toàn cục ------------------------------ */
function wireGlobalHandlers() {
  document.getElementById('canvas').addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a && (a.getAttribute('href') === '#' || !a.getAttribute('href'))) e.preventDefault();
  });
  document.getElementById('canvas').addEventListener('dragstart', (e) => e.preventDefault());

  document.getElementById('btnAddBlock').addEventListener('click', openAddModal);
  document.getElementById('addModalClose').addEventListener('click', closeAddModal);
  document.getElementById('addBlockModal').addEventListener('click', (e) => {
    if (e.target.id === 'addBlockModal') closeAddModal();
  });

  document.getElementById('uploadCancel').addEventListener('click', closeUpload);
  document.getElementById('uploadOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'uploadOverlay') closeUpload();
  });
  document.getElementById('uploadInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || !uploadTarget) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parts = uploadTarget.split(':');
      const inst = findInstance(parts[1]);
      if (inst) {
        if (parts[0] === 'list') {
          // "list:<instanceId>:<listKey>:<idx>:<itemKey>" — đổi ảnh của 1
          // mục trong field list (vd 1 slide hero) — xem wireListItemImage.
          const idx = +parts[3];
          if (inst.fields[parts[2]] && inst.fields[parts[2]][idx]) inst.fields[parts[2]][idx][parts[4]] = reader.result;
        } else {
          inst.fields[parts[2]] = reader.result;
        }
      }
      renderCanvas();
      closeUpload();
      pushUndo();
      scheduleSave();
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btnUndo').addEventListener('click', undo);
  document.getElementById('btnReset').addEventListener('click', resetAll);
  document.getElementById('btnPreview').addEventListener('click', previewSite);

  document.getElementById('btnStyleCloseBtn').addEventListener('click', closeButtonStyleModal);
  document.getElementById('buttonStyleModal').addEventListener('click', (e) => {
    if (e.target.id === 'buttonStyleModal') closeButtonStyleModal();
  });
  ['btnStyleBg', 'btnStyleBgOpacity', 'btnStyleText', 'btnStyleFont', 'btnStylePaddingX', 'btnStylePaddingY', 'btnStyleFontSize', 'btnStyleRadius', 'btnStyleBorderWidth', 'btnStyleBorderColor', 'btnStyleShadow', 'btnStyleWeight', 'btnStyleItalic', 'btnStyleUnderline', 'btnStyleHover'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('input', applyButtonStyleLive);
    el.addEventListener('change', () => { applyButtonStyleLive(); pushUndo(); scheduleSave(); });
  });

  document.getElementById('textStyleCloseBtn').addEventListener('click', closeTextStyleModal);
  document.getElementById('textStyleModal').addEventListener('click', (e) => {
    if (e.target.id === 'textStyleModal') closeTextStyleModal();
  });
  ['textStyleColor', 'textStyleFont', 'textStyleFontSize', 'textStyleWeight', 'textStyleItalic', 'textStyleUnderline'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('input', applyTextStyleLive);
    el.addEventListener('change', () => { applyTextStyleLive(); pushUndo(); scheduleSave(); });
  });
  document.getElementById('textStyleResetBtn').addEventListener('click', resetTextStyle);

  document.getElementById('btnStyleIconPickBtn').addEventListener('click', openIconPicker);
  document.getElementById('btnStyleIconRemoveBtn').addEventListener('click', () => selectButtonIcon(''));
  ['btnStyleIconColor', 'btnStyleIconSize'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('input', applyButtonIconLive);
    el.addEventListener('change', () => { applyButtonIconLive(); pushUndo(); scheduleSave(); });
  });
  document.getElementById('iconPickerCloseBtn').addEventListener('click', closeIconPicker);
  document.getElementById('iconPickerModal').addEventListener('click', (e) => {
    if (e.target.id === 'iconPickerModal') closeIconPicker();
  });

  document.getElementById('imgStyleCloseBtn').addEventListener('click', closeImageStyleModal);
  document.getElementById('imageStyleModal').addEventListener('click', (e) => {
    if (e.target.id === 'imageStyleModal') closeImageStyleModal();
  });
  document.getElementById('imgStyleUploadBtn').addEventListener('click', () => {
    if (!imgStyleTarget) return;
    openUpload('field:' + imgStyleTarget.instanceId + ':' + imgStyleTarget.fieldKey);
  });
  ['imgStyleZoom', 'imgStyleOverlayToggle', 'imgStyleOverlayColor', 'imgStyleOverlayOpacity'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('input', applyImageStyleLive);
    el.addEventListener('change', () => { applyImageStyleLive(); pushUndo(); scheduleSave(); });
  });
  document.getElementById('imgStyleRatio').addEventListener('change', () => {
    if (!imgStyleTarget) return;
    const select = document.getElementById('imgStyleRatio');
    const modeKey = imgStyleTarget.instanceId + ':' + imgStyleTarget.fieldKey;
    if (select.value === '__custom__') {
      customImgRatioMode.add(modeKey);
    } else {
      customImgRatioMode.delete(modeKey);
      applyImageRatioLive(select.value);
      pushUndo(); scheduleSave();
    }
    renderImageRatioControl();
  });
  ['imgStyleRatioW', 'imgStyleRatioH'].forEach((id) => {
    const el = document.getElementById(id);
    const liveRatio = () => applyImageRatioLive(document.getElementById('imgStyleRatioW').value + ':' + document.getElementById('imgStyleRatioH').value);
    el.addEventListener('input', liveRatio);
    el.addEventListener('change', () => { liveRatio(); pushUndo(); scheduleSave(); });
  });

  const modal = document.getElementById('exportModal');
  document.getElementById('btnExport').addEventListener('click', () => {
    modal.classList.add('is-open');
    document.getElementById('exportAdminBox').classList.remove('is-open');
  });
  document.getElementById('exportClose').addEventListener('click', () => modal.classList.remove('is-open'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('is-open'); });

  document.getElementById('btnExportZip').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    exportZip().catch((err) => window.alert('Xuất ZIP thất bại: ' + err.message)).finally(() => { btn.disabled = false; });
  });
  document.getElementById('btnExportAdmin').addEventListener('click', showAdminExport);
  document.getElementById('btnCopyAdminCode').addEventListener('click', () => {
    const ta = document.getElementById('exportAdminCode');
    ta.select();
    const done = () => {
      const note = document.getElementById('exportCopiedNote');
      note.classList.add('show');
      setTimeout(() => note.classList.remove('show'), 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ta.value).then(done).catch(() => { document.execCommand('copy'); done(); });
    } else {
      document.execCommand('copy'); done();
    }
  });
}

/* ------------------------------ Init ------------------------------ */
async function init() {
  const res = await fetch('/data/blocks-catalog.json');
  CATALOG = await res.json();
  try {
    const iconsRes = await fetch('/data/icons-catalog.json');
    ICONS_CATALOG = (await iconsRes.json()).icons || [];
  } catch (e) { ICONS_CATALOG = []; }
  loadCatalogFonts();
  populateFontSelects();
  state = loadState();
  wireGlobalHandlers();
  renderAll();
  pushUndo();
}
document.addEventListener('DOMContentLoaded', init);
