// Worker của web100.vn. Chỉ nhận các URL khai trong "run_worker_first" ở wrangler.jsonc
// (hiện là /bao-gia và /bao-gia/*); mọi URL khác Cloudflare phục vụ thẳng từ html/ như trước.
//
// API báo giá:
//   GET /bao-gia/                 -> danh sách ngành (stt, ten, slug, giá thấp/cao nhất, số mẫu)
//   GET /bao-gia/?q=xe may dien   -> tìm ngành gần đúng (giống /bao-gia/<nganh> nhưng không 404)
//   GET /bao-gia/<nganh>          -> bảng giá của ngành. <nganh> là slug (cua-hang-xe-may-dien)
//                                    hoặc STT (232): hai dạng cố định AI dùng để gọi. Tên có dấu
//                                    hay cụm mô tả (xe máy điện) cũng được, nhưng chỉ là tìm gần đúng.
//        200 + match: "exact"|"fuzzy"  -> có ngành, kèm bang_gia [{gia, gia_vnd, url}]
//        404 + match: "none"           -> không có, kèm goi_y [ngành gần nhất] để AI chọn thay thế
import data from './bao-gia.json';
import { timNganh, tomTat } from './bao-gia.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=3600',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function handleBaoGia(url) {
  const rest = url.pathname.replace(/^\/bao-gia\/?/, '').replace(/\/+$/, '');
  const q = rest || url.searchParams.get('q') || '';

  if (!q) {
    return json({ ok: true, tong: data.length, nganh: data.map(tomTat) });
  }

  const { match, nganh, goi_y } = timNganh(data, q);
  if (!nganh) {
    return json({
      ok: false,
      match,
      q,
      loi: 'Ngành này chưa có trong dữ liệu báo giá',
      goi_y,
    }, rest ? 404 : 200);
  }
  return json({
    ok: true,
    match,
    q,
    nganh: tomTat(nganh),
    bang_gia: nganh.bang_gia,
    goi_y,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/bao-gia' || url.pathname.startsWith('/bao-gia/')) {
      if (request.method === 'OPTIONS') return new Response(null, { headers: JSON_HEADERS });
      if (request.method !== 'GET') return json({ ok: false, loi: 'Chỉ hỗ trợ GET' }, 405);
      return handleBaoGia(url);
    }
    return env.ASSETS.fetch(request);
  },
};
