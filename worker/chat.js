// AI chat báo giá (POST /api/chat). Kịch bản và quy tắc: quy-tac-ai.md. Model: Claude Haiku.
//
// Request:  { messages: [{ role: "user"|"assistant", content: "..." }, ...], sid?, trang? }  (tin cuối là user)
//           sid = mã phiên chat do trình duyệt tự sinh, dùng để ghi lịch sử hội thoại lên Google Drive (qua GAS).
//           kenh = "lien_he" (mặc định, trang /lien-he/) | "lp" (landing quảng cáo /lp/*), nguon = nguồn quảng cáo
// Response: { ok: true, reply: "...", bao_gia: null | { nganh, bang_gia, ly_do }, lien_he: null | { hoten, dienthoai } }
//           bao_gia có khi AI gọi tool tra_bao_gia; giao diện vẽ popup bảng giá từ đây.
//           lien_he có khi AI gọi gui_lien_he và GAS đã nhận (lưu tab "Khách để lại SĐT" + email báo Web100);
//           trình duyệt dùng nó để bắn conversion generate_lead (1 lần / phiên chat).
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
const MAX_TOOL_ROUNDS = 3; // tra_bao_gia + gui_lien_he có thể cùng 1 lượt
const MAX_TOKENS = 600;

// Ghi lịch sử chat: sau mỗi lượt trả lời, Worker gửi NGẦM (ctx.waitUntil, khách không phải chờ) toàn bộ
// hội thoại của phiên (sid) về GAS -> GAS ghi file JSON vào thư mục Google Drive + 1 dòng sheet ChatAI
// (xem gas/README.md). Cùng URL /exec với các form trên site (html/js/main.js).
export const GAS_URL = 'https://script.google.com/macros/s/AKfycbwgxqNs8MfhlObqxMmBL88CVvG_hQOTXffH3mlflBzDLSosukMKzsv7PLreUQjMp9E/exec';
const SID_RE = /^[a-z0-9-]{8,40}$/i;

const CAU_LOI = `Mình đang gặp trục trặc kỹ thuật, bạn nhắn Zalo ${ZALO} để Web100 báo giá trực tiếp nhé.`;
// Quy tắc 4 (quy-tac-ai.md): ngành không có thì câu trả lời phải mở đầu bằng câu này. Model được nhắc
// qua tool_result nhưng không phải lúc nào cũng tuân, nên server tự ghép vào nếu thiếu.
const CAU_GAN_NHAT = 'Ngành của bạn hiện chưa có trong dữ liệu báo giá mình biết, nhưng mình nghĩ các mẫu sau cũng có thể phù hợp.';

/** Đảm bảo câu dẫn cho trường hợp ngành gần nhất luôn mở đầu bằng CAU_GAN_NHAT. */
export function epCauGanNhat(text, baoGia) {
  if (!baoGia || baoGia.ly_do !== 'gan_nhat') return text;
  if (/chưa có trong dữ liệu/i.test(text)) return text;
  return `${CAU_GAN_NHAT} ${text}`.trim();
}

// Câu chào đã hiện sẵn trên giao diện, model vẫn hay mở đầu bằng "Chào bạn!..." nên server cắt câu chào ở đầu.
const RE_CHAO = /^\s*(?:xin\s+)?chào(?:\s+(?:bạn|anh|chị|anh\/chị|anh chị))?(?:\s+\p{L}+)?\s*[!,.]\s*/iu;

/** Bỏ câu chào lặp ở đầu câu trả lời ("Chào bạn! ...", "Xin chào, ..."), viết hoa chữ đầu phần còn lại. */
export function boChaoLai(text) {
  const m = String(text || '').match(RE_CHAO);
  if (!m) return text;
  const rest = text.slice(m[0].length).trim();
  if (!rest) return text;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

// Kịch bản (quy-tac-ai.md mục 4): AI KHÔNG bảo khách tự nhắn Zalo cho Web100 nữa, mà xin số Zalo + tên của
// khách rồi gọi tool gui_lien_he để Web100 chủ động gọi lại. Chỗ duy nhất còn đưa Zalo/điện thoại Web100 là câu
// báo lỗi kỹ thuật (lúc AI không chạy được thì không xin số được).
const QUY_TAC = `Bạn là trợ lý báo giá của Web100 (web100.vn), công ty thiết kế website tại Đà Nẵng, làm cho khách toàn quốc.
Xưng "mình", gọi khách là "bạn". Trả lời tiếng Việt, ngắn gọn, 1 đến 3 câu, văn nói tự nhiên.
Không dùng markdown (không in đậm, không gạch đầu dòng, không bảng), không dùng dấu gạch ngang dài.

Giao diện đã hiện sẵn câu chào của bạn: "Chào bạn, mình là AI tư vấn của Web100, nói chuyện với mình chút được không?".
Vì vậy KHÔNG BAO GIỜ chào lại hay giới thiệu lại bản thân: không mở đầu bằng "Chào bạn", "Xin chào", "Mình là AI...",
vào thẳng nội dung. Nếu tin đầu của khách chỉ là đồng ý hoặc chào lại (được, ok, ừ, chào...) thì hỏi luôn khách
định làm website cho ngành gì.

Việc của bạn: hỏi khách làm website ngành gì, báo giá theo ngành bằng tool tra_bao_gia, và xin số Zalo
cùng tên của khách để Web100 gọi lại tư vấn.
Khi khách nêu ngành (dù viết sai chính tả, viết tắt hay dùng từ khác), hãy tự đối chiếu với DANH SÁCH NGÀNH
bên dưới, chọn đúng 1 slug và gọi tra_bao_gia ngay trong lượt đó, không hỏi thêm. Không bao giờ bịa slug
ngoài danh sách. Nếu khách mô tả khớp 2 đến 3 ngành khác hẳn nhau thì hỏi lại 1 câu ngắn để chọn.
Nếu ngành của khách không có trong danh sách: nói đúng ý "Ngành của bạn hiện chưa có trong dữ liệu báo giá
mình biết, nhưng mình nghĩ các mẫu sau cũng có thể phù hợp", rồi gọi tra_bao_gia với ngành gần nhất
(ly_do = gan_nhat).
Sau khi tool trả kết quả, giao diện tự hiện bảng giá kèm nút xem thử từng mẫu; bạn chỉ nói 1 câu dẫn
(tên ngành, số mẫu, khoảng giá) và 1 câu hỏi tiếp, ví dụ hỏi khách ưng mẫu nào hoặc cần thêm gì.
Không tự liệt kê URL hay giá từng mẫu.

XIN ZALO VÀ TÊN (thay cho việc bảo khách tự nhắn Zalo cho Web100):
Không bao giờ bảo khách "nhắn Zalo", "liên hệ Zalo", "gọi số ..." của Web100, kể cả khi THÔNG TIN DỊCH VỤ ghi
"liên hệ qua Zalo". Thay vào đó xin khách số Zalo (hoặc số điện thoại) và tên, nói Web100 sẽ liên hệ lại trong
vòng vài giờ. Xin trong các trường hợp:
  khách không ưng mẫu gợi ý hoặc muốn ngành khác hẳn;
  khách cần chức năng đặc thù (đặt lịch online, thanh toán online, app, quản lý kho, đa ngôn ngữ phức tạp,
  tích hợp phần mềm riêng, sàn thương mại điện tử lớn...): báo khung 5 đến 10 triệu tuỳ yêu cầu, nói giá chính
  xác cần trao đổi, rồi xin Zalo và tên (vẫn có thể gọi tra_bao_gia ngành gần nhất để khách xem mẫu tham khảo).
  NGOẠI LỆ: tính năng nào có giá riêng trong mục TÍNH NĂNG THÊM CÓ GIÁ CỐ ĐỊNH của THÔNG TIN DỊCH VỤ (VD chat AI
  tự tư vấn / báo giá trên website, chatbot AI) thì báo đúng giá đó, KHÔNG xếp vào khung 5 đến 10 triệu;
  câu hỏi về dịch vụ mà THÔNG TIN DỊCH VỤ không có hoặc ghi "liên hệ qua Zalo": nói phần này cần tư vấn viên
  trả lời chính xác, rồi xin Zalo và tên;
  khách muốn được tư vấn, gọi lại, báo giá chi tiết, làm hợp đồng, hoặc hỏi cách liên hệ Web100;
  khách cảm ơn hoặc chào tạm biệt mà chưa để lại số: chúc ngắn và xin Zalo 1 lần.
Xin tối đa 1 lần mỗi 2 lượt, khách chưa muốn cho thì thôi, tiếp tục tư vấn bình thường, không ép.
MỖI LƯỢT CHỈ HỎI 1 ĐIỀU: không gộp nhiều câu hỏi hay nhiều yêu cầu vào cùng 1 tin. Cần hỏi thêm thông tin
(ngành, link website cũ...) thì hỏi riêng trước, khách trả lời xong mới xin Zalo và tên ở lượt sau.
Khách muốn nâng cấp / cải tạo website đang có: lượt đầu chỉ xin link website hiện tại; khách gửi link rồi mới
nói cần tư vấn viên xem trực tiếp để báo giá chính xác và xin Zalo và tên. Không cần hỏi ngành ở trường hợp này.
Khi đã có ĐỦ số điện thoại và tên trong hội thoại: gọi tool gui_lien_he ngay trong lượt đó (nhu_cau tóm tắt
ngắn khách cần gì: ngành, mẫu đã chọn và giá nếu có, chức năng đặc biệt...). Có số mà chưa có tên thì hỏi tên
1 câu; khách không muốn nói tên thì dùng hoten = "Khách". Không xin email, địa chỉ hay thông tin khác.
gui_lien_he trả ok: cảm ơn khách bằng tên, nói Web100 sẽ gọi lại số đó trong vòng vài giờ, hỏi khách có muốn
ghi chú thêm gì không. Trả lỗi số không hợp lệ: nhờ khách kiểm tra lại số. Đã gửi thành công rồi thì không gọi
lại gui_lien_he nữa (kể cả khi khách hỏi tiếp, cảm ơn, hay nhắc lại số), trừ khi khách nói rõ muốn đổi sang số khác.
Sau khi đã có số, các lượt sau chỉ trả lời câu khách hỏi, không xin lại Zalo.
Không nhắc tới tool, không nói "hệ thống", chỉ nói tự nhiên như người tư vấn.

Câu hỏi về dịch vụ (giá gồm gì, phí hằng năm, thời gian làm, bảo hành, thanh toán...): chỉ trả lời theo mục
THÔNG TIN DỊCH VỤ, không bịa.
Câu ngoài chủ đề website (thời tiết, lập trình, chuyện riêng...): nói ngắn rằng đây là ngoài phạm vi mình
hỗ trợ, rồi hỏi lại về website của khách. Không nói về đối thủ, không hứa gì ngoài dữ liệu.`;

// Bước "khách chọn mẫu" khác nhau theo trang:
//   /lien-he/ : giao diện có khung nhập tên + SĐT riêng ngay dưới câu trả lời (html/js/chat-bao-gia.js).
//   /lp/*     : không có khung, AI tự xin trong chat rồi gọi gui_lien_he.
const QUY_TAC_CHON_MAU = {
  lien_he: `KHÁCH CHỌN MẪU (tin dạng "Mình chọn mẫu <tên website> (giá ...) của ngành ..."): KHÔNG chúc mừng, không khen lựa chọn.
Nói đúng ý "Mình đã nhận thông tin bạn chọn mẫu <tên website>, giá <giá>", rồi mời khách để lại tên và số Zalo ở
khung ngay bên dưới để Web100 gọi lại trong vòng vài giờ.
Lượt này không hỏi số trong tin nhắn, không gọi lại tra_bao_gia.
Khách đã gửi khung (tin dạng "(Mình đã gửi tên ... và số điện thoại ...)"): thông tin đã tới Web100, không gọi
gui_lien_he, không xin lại; có thể hỏi khách muốn chỉnh gì so với mẫu (màu, bố cục, thêm trang...).`,
  lp: `KHÁCH CHỌN MẪU (tin dạng "Mình chọn mẫu <tên website> (giá ...) của ngành ..."): KHÔNG chúc mừng, không khen lựa chọn.
Nói đúng ý "Mình đã nhận thông tin bạn chọn mẫu <tên website>, giá <giá>", rồi xin khách số Zalo và tên (số điện thoại
cũng được) để Web100 gọi lại tư vấn trong vòng vài giờ. VD: "Mình đã nhận thông tin bạn chọn mẫu abc.vn, giá
3.000.000đ. Bạn cho mình xin số Zalo và tên để Web100 gọi lại tư vấn trong vòng vài giờ nhé." Không gọi lại
tra_bao_gia ở lượt này. Khi khách đưa đủ số và tên thì gọi gui_lien_he với nhu_cau có tên mẫu và giá.`,
};

export const KENH = ['lien_he', 'lp'];

/** System prompt: quy tắc + danh sách ngành + thông tin dịch vụ (training). Tĩnh theo kênh để cache được. */
export function buildSystem(training, kenh = 'lien_he') {
  const danhSach = data.map((n) => `${n.slug} | ${n.ten}`).join('\n');
  const chonMau = QUY_TAC_CHON_MAU[kenh] || QUY_TAC_CHON_MAU.lien_he;
  return `${QUY_TAC}\n\n${chonMau}\n\nDANH SÁCH NGÀNH (slug | tên):\n${danhSach}\n\nTHÔNG TIN DỊCH VỤ:\n${(training || '').trim() || '(chưa có, mọi câu hỏi về dịch vụ thì xin Zalo và tên của khách)'}`;
}

/** 0905 123 456 / +84 905.123.456 / 84905123456 -> "0905123456"; sai định dạng -> "" (giống main.js). */
export function chuanSdt(raw) {
  let d = String(raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+84')) d = '0' + d.slice(3);
  else if (d.startsWith('84') && d.length === 11) d = '0' + d.slice(2);
  return /^0\d{9,10}$/.test(d) ? d : '';
}

export const TOOL_LIEN_HE = {
  name: 'gui_lien_he',
  description: 'Gửi tên và số Zalo / số điện thoại của khách cho Web100 để tư vấn viên gọi lại trong vòng vài giờ. Chỉ gọi khi khách đã tự đưa số điện thoại trong hội thoại.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      hoten: { type: 'string', description: 'Tên khách tự xưng, hoặc "Khách" nếu khách không muốn nói tên' },
      dienthoai: { type: 'string', description: 'Số Zalo / số điện thoại đúng như khách gõ' },
      nhu_cau: { type: 'string', description: 'Tóm tắt ngắn khách cần gì: ngành, mẫu đã chọn và giá nếu có, chức năng đặc biệt...' },
    },
    required: ['hoten', 'dienthoai', 'nhu_cau'],
    additionalProperties: false,
  },
};

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
      ghi_chu: lyDo === 'gan_nhat'
        ? 'Ngành khách nói KHÔNG có trong dữ liệu, đây là ngành gần nhất. Câu trả lời PHẢI mở đầu đúng bằng: "Ngành của bạn hiện chưa có trong dữ liệu báo giá mình biết, nhưng mình nghĩ các mẫu sau cũng có thể phù hợp", rồi nêu tên ngành thay thế, số mẫu, khoảng giá. Bảng giá đã hiện cho khách.'
        : 'Bảng giá đầy đủ đã hiện cho khách, bạn chỉ nói 1 câu dẫn (tên ngành, số mẫu, khoảng giá) và 1 câu hỏi tiếp.',
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

/** Payload gửi GAS cho 1 lượt chat. Trả null nếu không có sid hợp lệ (không ghi log). */
export function buildChatLog(body, messages, replyText, baoGia, request, env, lienHe = null) {
  const sid = String((body && body.sid) || '');
  if (!SID_RE.test(sid)) return null;
  return {
    action: 'chat_log',
    key: (env && env.CHAT_LOG_KEY) || '',
    sid,
    trang: String((body && body.trang) || '').slice(0, 200),
    thiet_bi: String(request.headers.get('user-agent') || '').slice(0, 300),
    nganh: baoGia ? baoGia.nganh.ten : '',
    lien_he: lienHe,
    messages: messages.concat([{ role: 'assistant', content: replyText }]),
  };
}

/** Gửi lead (tên + SĐT AI xin được) về GAS action "chat", CHỜ kết quả để báo lại cho AI. */
async function sendLead(payload) {
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    const d = JSON.parse(await res.text());
    return !!(d && (d.ok || d.error === 'rate_limited')); // rate_limited = cùng số vừa gửi, đã lưu rồi
  } catch (err) {
    console.error('gui_lien_he: lỗi gửi GAS', err && err.message);
    return false;
  }
}

/** Chạy tool gui_lien_he. Trả { forModel, lienHe|null }. */
export async function runLienHe(input, ctx) {
  const dienthoai = chuanSdt(input && input.dienthoai);
  if (!dienthoai) {
    return { forModel: { ok: false, loi: 'Số điện thoại không hợp lệ (cần 10 số, VD 0905 123 456). Nhờ khách kiểm tra lại.' }, lienHe: null };
  }
  const hoten = String((input && input.hoten) || '').trim().slice(0, 80) || 'Khách';
  const nhuCau = String((input && input.nhu_cau) || '').trim().slice(0, 500);
  // Phiên này đã gửi đúng số này cho Web100 rồi (trình duyệt báo qua body.da_gui): không gửi lại, không email.
  if (ctx.daGui === dienthoai) {
    return { forModel: { ok: true, ghi_chu: 'Số này đã gửi cho Web100 từ trước, KHÔNG cần gửi lại và đừng gọi gui_lien_he nữa. Chỉ tiếp tục tư vấn câu khách đang hỏi.' }, lienHe: null };
  }
  const ok = await ctx.sendLead({
    action: 'chat',
    hoten,
    dienthoai,
    sid: ctx.sid,
    nganh: ctx.nganh || '',
    nhu_cau: nhuCau,
    nguon: ctx.nguon,
    trang: ctx.trang,
    kenh: ctx.kenh,
    messages: ctx.messages, // để email báo có đủ hội thoại, kể cả lượt khách vừa đưa số
  });
  if (!ok) {
    return { forModel: { ok: false, loi: 'Chưa gửi được do lỗi kỹ thuật. Xin lỗi khách, nói Web100 vẫn sẽ cố liên hệ, và đưa số Zalo 0964074043 của Web100 để khách chủ động nhắn.' }, lienHe: null };
  }
  ctx.daGui = dienthoai;
  return {
    forModel: { ok: true, ghi_chu: `Đã gửi cho Web100: ${hoten}, ${dienthoai}. Cảm ơn khách bằng tên, nói Web100 sẽ gọi lại số này trong vòng vài giờ.` },
    lienHe: { hoten, dienthoai },
  };
}

async function sendChatLog(payload) {
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    const text = await res.text();
    if (!/"ok":\s*true/.test(text)) console.error('chat_log: GAS trả', res.status, text.slice(0, 200));
  } catch (err) {
    console.error('chat_log: lỗi gửi GAS', err && err.message);
  }
}

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

/**
 * Xử lý POST /api/chat.
 * @param deps.training  nội dung worker/training-dich-vu.md (index.js import dạng text)
 * @param deps.client    (test) client thay cho Anthropic thật
 * @param deps.ctx       ExecutionContext của Worker (waitUntil để ghi log chat sau khi đã trả lời)
 * @param deps.sendLog   (test) hàm thay cho sendChatLog
 * @param deps.sendLead  (test) hàm thay cho sendLead
 */
export async function handleChat(request, env, deps = {}) {
  if (request.method !== 'POST') return reply({ ok: false, reply: 'Chỉ hỗ trợ POST' }, 405);

  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (rateLimited(ip)) {
    return reply({ ok: false, reply: `Bạn gửi hơi nhanh, chờ vài phút rồi nhắn tiếp nhé.` }, 429);
  }

  let body;
  try { body = await request.json(); } catch (_) { return reply({ ok: false, reply: 'Body phải là JSON' }, 400); }
  const messages = cleanMessages(body && body.messages);
  if (typeof messages === 'string') return reply({ ok: false, reply: messages }, 400);
  const original = messages.map((m) => ({ role: m.role, content: m.content })); // trước khi chèn tool_use/tool_result
  const kenh = KENH.includes(body.kenh) ? body.kenh : 'lien_he';
  const sid = SID_RE.test(String(body.sid || '')) ? String(body.sid) : '';
  let lienHe = null;
  const leadCtx = {
    sid,
    kenh,
    nguon: String(body.nguon || '').slice(0, 1000),
    trang: String(body.trang || '').slice(0, 200),
    messages: original,
    sendLead: deps.sendLead || sendLead,
    nganh: '',
    daGui: chuanSdt(body.da_gui), // số khách đã để lại trong phiên (trình duyệt nhớ)
  };

  // Trả lời khách + ghi lịch sử chat ngầm (chỉ khi AI trả lời được, lỗi kỹ thuật không ghi).
  const done = (text, bg) => {
    text = boChaoLai(text);
    const payload = buildChatLog(body, original, text, bg, request, env, lienHe);
    if (payload) {
      const p = (deps.sendLog || sendChatLog)(payload);
      if (deps.ctx && deps.ctx.waitUntil) deps.ctx.waitUntil(p);
    }
    return reply({ ok: true, reply: text, bao_gia: bg, lien_he: lienHe });
  };

  if (!deps.client && !env.ANTHROPIC_API_KEY) {
    return reply({ ok: false, reply: `AI chưa được bật, bạn nhắn Zalo ${ZALO} để Web100 báo giá nhé.` }, 503);
  }
  const client = deps.client || new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 40_000 });
  const system = [{ type: 'text', text: buildSystem(deps.training, kenh), cache_control: { type: 'ephemeral' } }];

  let baoGia = null;
  let lastText = '';
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        output_config: { effort: 'low' },
        system,
        tools: [TOOL, TOOL_LIEN_HE],
        messages,
      });
      const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      if (text) lastText = text;

      if (res.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: res.content });
        const results = [];
        for (const b of res.content) {
          if (b.type !== 'tool_use') continue;
          if (b.name === 'gui_lien_he') {
            const r = await runLienHe(b.input, leadCtx);
            if (r.lienHe) lienHe = r.lienHe;
            results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(r.forModel) });
            continue;
          }
          const r = runTool(b.input);
          if (r.baoGia) { baoGia = r.baoGia; leadCtx.nganh = r.baoGia.nganh.ten; }
          results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(r.forModel) });
        }
        messages.push({ role: 'user', content: results });
        continue;
      }
      if (res.stop_reason === 'refusal') {
        return done('Câu này mình không hỗ trợ được, mình quay lại chuyện website của bạn nhé.', null);
      }
      return done(epCauGanNhat(text || lastText || CAU_LOI, baoGia), baoGia);
    }
    // Quá số vòng tool: vẫn trả bảng giá (nếu có) kèm câu dẫn chung.
    return done(
      epCauGanNhat(lastText || (lienHe ? `Cảm ơn ${lienHe.hoten}, Web100 sẽ gọi lại số ${lienHe.dienthoai} trong vòng vài giờ nhé.`
        : baoGia ? `Đây là bảng giá ngành ${baoGia.nganh.ten}, bạn xem mẫu nào ưng thì nói mình nhé.` : CAU_LOI), baoGia),
      baoGia,
    );
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
