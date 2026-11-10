// Tra cứu báo giá theo ngành. Thuần JS, không phụ thuộc runtime để test được bằng node.
// Dữ liệu: worker/bao-gia.json (sinh bởi scripts/build_bao_gia.py từ baogiatonghop.csv).

/** 'Cửa hàng xe máy điện' / 'cua-hang-xe-may-dien' / 'xe%20máy%20điện' -> 'cua-hang-xe-may-dien' */
export function slugify(text) {
  let s = String(text || '');
  try { s = decodeURIComponent(s); } catch (_) { /* giữ nguyên nếu encode hỏng */ }
  s = s.replace(/Đ/g, 'D').replace(/đ/g, 'd')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s;
}

// Từ quá chung, không dùng để chấm điểm gần đúng.
const STOP = new Set(['va', 'cac', 'cua', 'hang', 'cong', 'ty', 'dich', 'vu', 'san', 'pham',
  'don', 'vi', 'nha', 'shop', 'website', 'web', 'trang', 'ban', 'mua', 'kinh', 'doanh', 'thi',
  'cong', 'truong', 'trung', 'tam', 'co', 'so', 'cho', 'thue']);

function tokens(slug) {
  return slug.split('-').filter((t) => t && !STOP.has(t));
}

/** Điểm giống nhau 0..1 giữa truy vấn và tên ngành (theo từ không dấu). */
function score(qSlug, nganh) {
  if (!qSlug) return 0;
  if (qSlug === nganh.slug) return 1;
  const q = tokens(qSlug);
  const n = tokens(nganh.slug);
  if (!q.length || !n.length) return 0;
  // Một bên nằm trọn trong bên kia theo ranh giới từ ("camera" trong "dich-vu-ban-lap-camera"):
  // điểm cao, phạt nhẹ khi bên dài hơn dài hơn nhiều (ưu tiên tên ngành ngắn, sát nhất).
  const short = q.length <= n.length ? q : n;
  const long = q.length <= n.length ? n : q;
  if (short.every((t) => long.includes(t))) {
    return 0.9 * Math.pow(short.length / long.length, 0.25);
  }
  let hit = 0;
  for (const t of q) if (n.includes(t)) hit += 1;
  if (!hit) return 0;
  // Khớp một phần: ưu tiên ngành phủ được nhiều từ của truy vấn, phạt ngành có tên quá dài.
  return 0.8 * (hit / q.length) * Math.sqrt(hit / n.length);
}

/**
 * Tìm ngành theo tên / slug / cụm từ mô tả.
 * @returns {{match:'exact'|'fuzzy'|'none', nganh:object|null, goi_y:object[]}}
 *   goi_y: tối đa `limit` ngành gần nhất (không gồm ngành đã khớp), mỗi phần tử có `diem`.
 */
export function timNganh(data, query, limit = 5) {
  const qSlug = slugify(query);
  // Toàn số: tra theo STT (AI gọi cố định bằng STT hoặc slug, không đoán theo từ).
  if (/^\d+$/.test(qSlug)) {
    const n = data.find((x) => String(x.stt) === qSlug) || null;
    return { match: n ? 'exact' : 'none', nganh: n, goi_y: [] };
  }
  const ranked = data
    .map((n) => ({ n, diem: score(qSlug, n) }))
    .filter((x) => x.diem > 0)
    .sort((a, b) => b.diem - a.diem || a.n.stt - b.n.stt);
  const top = ranked[0];
  let match = 'none';
  let nganh = null;
  if (top && top.diem >= 0.9) { match = top.diem === 1 ? 'exact' : 'fuzzy'; nganh = top.n; }
  else if (top && top.diem >= 0.6) { match = 'fuzzy'; nganh = top.n; }
  const goi_y = ranked
    .filter((x) => x.n !== nganh)
    .slice(0, limit)
    .map((x) => ({ ...tomTat(x.n), diem: Math.round(x.diem * 100) / 100 }));
  return { match, nganh, goi_y };
}

/** Bản gọn để liệt kê (không kèm bảng giá). */
export function tomTat(n) {
  return {
    stt: n.stt,
    ten: n.ten,
    slug: n.slug,
    gia_thap_nhat: n.gia_thap_nhat,
    gia_cao_nhat: n.gia_cao_nhat,
    so_mau: n.bang_gia.length,
  };
}

/** 2500000 -> '2.500.000đ' */
export function formatVnd(v) {
  if (v == null) return '';
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
}
