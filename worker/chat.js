// AI chat báo giá (POST /api/chat). Kịch bản và quy tắc: quy-tac-ai.md. Model: Claude Haiku.
//
// Request:  { messages: [{ role: "user"|"assistant", content: "..." }, ...] }  (tin cuối là user)
// Response: { ok: true, reply: "...", bao_gia: null | { nganh, bang_gia, ly_do } }
//           bao_gia có khi AI gọi tool tra_bao_gia; giao diện vẽ popup bảng giá từ đây.
//           Lỗi: { ok: false, reply: "<câu xin lỗi + Zalo>" } với mã 4xx/5xx.
//
// AI KHÔNG đoán ngành theo từ khách gõ ở phía API: tool tra_bao_gia nhận `slug` kiểu enum gồm đúng
// 232 slug trong worker/bao-gia.json (strict), AI tự đối chiếu danh sách ngành trong system prompt.
import Anthropic from '@anthropic-ai/sdk';
import data from './bao-gia.json' with { type: 'json' };
import { timNganh, tomTat } from './bao-gia.js';

export const MODEL = 'claude-haiku-5-5';
export const ZALO = '0964074043';
const MAX_MESSAGES = 24;      // 12 lượt hỏi đáp
const MAX_CONTENT_LEN = 1000; // ký tự mỗi tin
const MAX_TOOL_ROUNDS = 2;
const MAX_TOKENS = 600;

const CAU_LOI = `Mình đang gặp trục trặc kỹ thuật, bạn nhắn Zalo ${ZALO} để Web100 báo giá trực tiếp nhé.`;

const QUY_TAC = `Bạn là trợ lý báo giá của Web100 (web100.vn), công ty thiết kế website tại Đà Nẵng, làm cho khách toàn quốc.
Xưng "mình", gọi khách là "bạn". Trả lời tiếng Việt, ngắn gọn, 1 đến 3 câu, văn nói tự nhiên.
Không dùng markdown (không in đậm, không gạch đầu dòng, không bảng), không dùng dấu gạch ngang dài.

Việc của bạn: chào hỏi, hỏi khách làm website ngành gì, báo giá theo ngành bằng tool tra_bao_gia.
Khi khách nêu ngành (dù viết sai chính tả, viết tắt hay dùng từ khác), hãy tự đối chiếu với DANH SÁCH NGÀNH
bên dưới, chọn đúng 1 slug và gọi tra_bao_gia ngay trong lượt đó, không hỏi thêm. Không bao giờ bịa slug
ngoài danh sách. Nếu khách mô tả khớp 2 đến 3 ngành khác hẳn nhau thì hỏi lại 1 câu ngắn để chọn.
Nếu ngành của khách không có trong danh sách: nói đúng ý "Ngành của bạn hiện chưa có trong dữ liệu báo giá
mình biết, nhưng mình nghĩ các mẫu sau cũng có thể phù hợp", rồi gọi tra_bao_gia với ngành gần nhất
(ly_do = gan_nhat).
Sau khi tool trả kết quả, giao diện tự hiện bảng giá kèm nút xem thử từng mẫu; bạn chỉ nói 1 câu dẫn
(tên ngành, số mẫu, khoảng giá) và 1 câu hỏi tiếp, ví dụ hỏi khách ưng mẫu nào hoặc cần thêm gì.
Không tự liệt kê URL hay giá từng mẫu.
Khách không ưng gợi ý hoặc muốn ngành khác hẳn: mời liên hệ Zalo ${ZALO} để được tư vấn trực tiếp.
Khách cần chức năng đặc thù (đặt lịch online, thanh toán online, app, quản lý kho, đa ngôn ngữ phức tạp,
tích hợp phần mềm riêng, sàn thương mại điện tử lớn...): báo khung 5 đến 10 triệu tuỳ yêu cầu, nói rõ giá
chính xác cần trao đổi, và mời liên hệ Zalo ${ZALO}. Vẫn có thể gọi tra_bao_gia ngành gần nhất để khách xem
mẫu giao diện tham khảo.
Câu hỏi về dịch vụ (giá gồm gì, phí hằng năm, thời gian làm, bảo hành, thanh toán...): chỉ trả lời theo mục
THÔNG TIN DỊCH VỤ. Không có trong đó thì nói mình chưa có thông tin chính xác và mời nhắn Zalo ${ZALO}.
Câu ngoài chủ đề website (thời tiết, lập trình, chuyện riêng...): nói ngắn rằng đây là ngoài phạm vi mình
hỗ trợ, rồi hỏi lại về website của khách. Không nói về đối thủ, không hứa gì ngoài dữ liệu.
Thông tin liên hệ duy nhất được đưa: Zalo ${ZALO}. Đưa Zalo tối đa 1 lần mỗi 2 lượt, không lặp liên tục.
Khách cảm ơn hoặc xong việc: chúc ngắn gọn, nhắc Zalo 1 lần.`;

/** System prompt: quy tắc + danh sách ngành + thông tin dịch vụ (training). Tĩnh để cache được. */
export function buildSystem(training) {
  const danhSach = data.map((n) => `${n.slug} | ${n.ten}`).join('\n');
  return `${QUY_TAC}\n\nDANH SÁCH NGÀNH (slug | tên):\n${danhSach}\n\nTHÔNG TIN DỊCH VỤ:\n${(training || '').trim() || '(chưa có, mọi câu hỏi về dịch vụ mời nhắn Zalo)'}`;
}

export const TOOL = {
  name: 'tra_bao_gia',
  description: 'Lấy bảng giá website theo ngành từ dữ liệu web100.vn. Chỉ gọi với slug nằm đúng trong DANH SÁCH NGÀNH. Kết quả được giao diện hiển thị thành bảng popup cho khách, bạn chỉ cần nói 1 câu dẫn.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      slug: { type: 'string', enum: data.map((n) => n.slug) },
      ly_do: {
        type: 'string',
        enum: ['exact', 'gan_nhat'],
        description: 'exact nếu khách nói đúng ngành này; gan_nhat nếu ngành khách không có trong danh sách và đây là ngành gần nhất bạn chọn thay',
      },
    },
    required: ['slug', 'ly_do'],
    additionalProperties: false,
  },
};

/** Chạy tool: trả bản gọn cho model (ít token) và bản đầy đủ cho trình duyệt. */
export function runTool(input) {
  const slug = String((input && input.slug) || '');
  const lyDo = input && input.ly_do === 'gan_nhat' ? 'gan_nhat' : 'exact';
  const { nganh } = timNganh(data, slug);
  if (!nganh || nganh.slug !== slug) {
    return { forModel: { loi: `Không có ngành "${slug}" trong dữ liệu. Chọn lại đúng slug trong DANH SÁCH NGÀNH.` }, baoGia: null };
  }
  const gias = nganh.bang_gia.map((x) => x.gia_vnd);
  const nhan = (vnd) => (nganh.bang_gia.find((x) => x.gia_vnd === vnd) || {}).gia || '';
  return {
    forModel: {
      ten: nganh.ten,
      so_mau: nganh.bang_gia.length,
      gia_thap_nhat: nhan(Math.min(...gias)),
      gia_cao_nhat: nhan(Math.max(...gias)),
      ly_do: lyDo,
      ghi_chu: 'Bảng giá đầy đủ đã hiện cho khách, bạn chỉ nói 1 câu dẫn.',
    },
    baoGia: { nganh: tomTat(nganh), bang_gia: nganh.bang_gia, ly_do: lyDo },
  };
}

/** Kiểm tra và làm sạch messages từ trình duyệt. Trả về mảng hợp lệ hoặc chuỗi lỗi. */
export function cleanMessages(raw) {
  if (!Array.isArray(raw) || !raw.length) return 'Thiếu messages';
  if (raw.length > MAX_MESSAGES) return 'Hội thoại quá dài, bạn tải lại trang để bắt đầu lại nhé';
  const out = [];
  for (const m of raw) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return 'role không hợp lệ';
    const content = typeof m.content === 'string' ? m.content.trim() : '';
    if (!content) return 'Tin nhắn trống';
    if (content.length > MAX_CONTENT_LEN) return `Tin nhắn quá dài (tối đa ${MAX_CONTENT_LEN} ký tự)`;
    if (out.length && out[out.length - 1].role === m.role) return 'Thứ tự tin nhắn không hợp lệ';
    out.push({ role: m.role, content });
  }
  if (out[0].role !== 'user' || out[out.length - 1].role !== 'user') return 'Tin đầu và tin cuối phải là của khách';
  return out;
}

// Chặn spam đơn giản theo IP, nhớ trong bộ nhớ isolate (không tuyệt đối, đủ để không bị quét ồ ạt).
const RATE_LIMIT = 30;           // request
const RATE_WINDOW_MS = 10 * 60e3; // mỗi 10 phút
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  let h = hits.get(ip);
  if (!h || now - h.start > RATE_WINDOW_MS) { h = { start: now, n: 0 }; hits.set(ip, h); }
  h.n += 1;
  if (hits.size > 5000) hits.clear();
  return h.n > RATE_LIMIT;
}

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

/**
 * Xử lý POST /api/chat.
 * @param deps.training  nội dung worker/training-dich-vu.md (index.js import dạng text)
 * @param deps.client    (test) client thay cho Anthropic thật
 */
export async function handleChat(request, env, deps = {}) {
  if (request.method !== 'POST') return reply({ ok: false, reply: 'Chỉ hỗ trợ POST' }, 405);

  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (rateLimited(ip)) {
    return reply({ ok: false, reply: `Bạn gửi hơi nhanh, chờ vài phút hoặc nhắn Zalo ${ZALO} nhé.` }, 429);
  }

  let body;
  try { body = await request.json(); } catch (_) { return reply({ ok: false, reply: 'Body phải là JSON' }, 400); }
  const messages = cleanMessages(body && body.messages);
  if (typeof messages === 'string') return reply({ ok: false, reply: messages }, 400);

  if (!deps.client && !env.ANTHROPIC_API_KEY) {
    return reply({ ok: false, reply: `AI chưa được bật, bạn nhắn Zalo ${ZALO} để Web100 báo giá nhé.` }, 503);
  }
  const client = deps.client || new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 40_000 });
  const system = [{ type: 'text', text: buildSystem(deps.training), cache_control: { type: 'ephemeral' } }];

  let baoGia = null;
  let lastText = '';
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        output_config: { effort: 'low' },
        system,
        tools: [TOOL],
        messages,
      });
      const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      if (text) lastText = text;

      if (res.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: res.content });
        const results = [];
        for (const b of res.content) {
          if (b.type !== 'tool_use') continue;
          const r = runTool(b.input);
          if (r.baoGia) baoGia = r.baoGia;
          results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(r.forModel) });
        }
        messages.push({ role: 'user', content: results });
        continue;
      }
      if (res.stop_reason === 'refusal') {
        return reply({ ok: true, reply: `Câu này mình không hỗ trợ được, bạn nhắn Zalo ${ZALO} nhé.`, bao_gia: null });
      }
      return reply({ ok: true, reply: text || lastText || CAU_LOI, bao_gia: baoGia });
    }
    // Quá số vòng tool: vẫn trả bảng giá (nếu có) kèm câu dẫn chung.
    return reply({
      ok: true,
      reply: lastText || (baoGia ? `Đây là bảng giá ngành ${baoGia.nganh.ten}, bạn xem mẫu nào ưng thì nói mình nhé.` : CAU_LOI),
      bao_gia: baoGia,
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('chat: API key sai hoặc hết hạn');
      return reply({ ok: false, reply: `AI chưa sẵn sàng, bạn nhắn Zalo ${ZALO} để Web100 báo giá nhé.` }, 503);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return reply({ ok: false, reply: `Hệ thống đang bận, bạn thử lại sau 1 phút hoặc nhắn Zalo ${ZALO}.` }, 429);
    }
    if (err instanceof Anthropic.APIError) {
      console.error('chat: API error', err.status, err.message);
      return reply({ ok: false, reply: CAU_LOI }, 502);
    }
    console.error('chat: lỗi', err && err.message);
    return reply({ ok: false, reply: CAU_LOI }, 500);
  }
}
