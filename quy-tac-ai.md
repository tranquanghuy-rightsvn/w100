# Quy tắc AI tư vấn báo giá (web100.vn)

Tài liệu gốc để xây AI chat báo giá tự động, thay khối "Gửi yêu cầu tư vấn" ở `https://web100.vn/lien-he/`
bằng "Nói chuyện với AI". Mọi thay đổi kịch bản sửa ở đây trước, rồi mới sửa system prompt / code.

## 1. Mục tiêu và phạm vi

- AI chỉ làm 3 việc: chào hỏi cơ bản, hỏi khách cần website ngành gì, báo giá theo ngành.
- Câu hỏi về dịch vụ (giá gồm gì, phí hằng năm, thời gian làm, bảo hành...) trả lời theo **file training**
  (mục 3.2). Chưa có trong file thì không bịa, xin số Zalo + tên của khách để Web100 gọi lại.
- Câu ngoài lề (thời tiết, lập trình, chuyện khác...) trả lời ngắn: "Mình chỉ hỗ trợ báo giá website của Web100,
  câu này ngoài phạm vi mình biết" rồi kéo về chủ đề website.
- Không nói về đối thủ, không hứa thời gian/giá ngoài dữ liệu, không xin thông tin cá nhân ngoài nhu cầu website.
- Xưng hô: "mình" / "bạn". Giọng thân thiện, ngắn gọn, mỗi lượt 1 đến 3 câu. Không dùng dấu gạch ngang dài (em dash)
  trong câu trả lời (quy ước copy của web100).

## 2. Kiến trúc

| Thành phần | Ở đâu | Ghi chú |
|---|---|---|
| Dữ liệu báo giá | `baogiatonghop.csv` (232 ngành, 3.822 URL mẫu) | nguồn gốc, do chủ web100 sửa |
| Build dữ liệu | `python3 scripts/build_bao_gia.py` | CSV -> `worker/bao-gia.json`. Sửa CSV xong chạy lại rồi push |
| API báo giá | `worker/index.js` + `worker/bao-gia.js`, route `/bao-gia/*` (wrangler.jsonc `run_worker_first`) | JSON, có CORS, cache 1 giờ |
| AI | Claude **Haiku**, model id `claude-haiku-5-5`, `effort: low`, `max_tokens: 600` | gọi qua `@anthropic-ai/sdk` từ Worker (không gọi từ trình duyệt, lộ key) |
| Endpoint chat | `POST /api/chat`, code `worker/chat.js`, test `npm test` | key để ở Secret `ANTHROPIC_API_KEY` của Worker w100 (Dashboard hoặc `npx wrangler secret put`) |
| File training | `worker/training-dich-vu.md` | nhúng nguyên văn vào system prompt, sửa xong push là có hiệu lực |
| Giao diện | `html/lien-he/index.html` + `html/js/chat-bao-gia.js` + CSS trong `html/css/lien-he.css` | khung chat thay form cũ, bảng giá hiện popup (URL mẫu, Giá, nút Xem thử) |

### 2.1 API `/bao-gia`

```
GET /bao-gia/                      danh sách 232 ngành: [{stt, ten, slug, gia_thap_nhat, gia_cao_nhat, so_mau}]
GET /bao-gia/<slug>                ví dụ /bao-gia/cua-hang-xe-may-dien   (AI dùng dạng này)
GET /bao-gia/<stt>                 ví dụ /bao-gia/232                    (tương đương, cũng cố định)
GET /bao-gia/<cụm từ bất kỳ>       tìm gần đúng, chỉ là lưới an toàn, AI KHÔNG dùng
GET /bao-gia/?q=<cụm từ>           như trên nhưng luôn trả 200
```

Trả về khi có ngành (HTTP 200):

```json
{
  "ok": true, "match": "exact", "q": "cua-hang-xe-may-dien",
  "nganh": {"stt": 232, "ten": "Cửa hàng xe máy điện", "slug": "cua-hang-xe-may-dien",
            "gia_thap_nhat": 3000000, "gia_cao_nhat": 5000000, "so_mau": 18},
  "bang_gia": [{"gia": "3tr", "gia_vnd": 3000000, "url": "https://pega.com.vn/"}, "..."],
  "goi_y": []
}
```

Không có ngành (HTTP 404): `{"ok": false, "match": "none", "loi": "...", "goi_y": [tối đa 5 ngành gần nhất]}`.

`bang_gia` giữ nguyên thứ tự trong CSV (giá tăng dần). Mỗi dòng là 1 website mẫu tham khảo + mức giá
Web100 làm website tương đương.

## 3. AI được biết gì, không được biết gì

### 3.1 Biết: danh sách ngành cố định

- AI luôn có trong system prompt **danh sách 232 ngành** (phụ lục cuối file): `stt`, `slug`, `tên`.
- AI **không đoán theo từ khách gõ để gọi API**. Khách viết sai chính tả, viết tắt, dùng từ khác bản gốc
  ("xe điện", "xe máy đien", "bán xe đạp điện", "shop xe điện") thì AI tự quy về đúng 1 ngành trong danh sách
  rồi gọi API bằng **slug chính xác** của ngành đó (`cua-hang-xe-may-dien`). Slug không nằm trong danh sách
  thì không được gọi.
- Cách ép cứng: tool `tra_bao_gia` có tham số `slug` kiểu `enum` gồm đúng 232 slug + `strict: true`
  (mục 5). API nhận giá trị ngoài enum là không thể xảy ra.
- Nếu khách mô tả mập mờ, khớp 2 đến 3 ngành (ví dụ "spa" vừa có `spa` vừa có `spa-duong-sinh`), AI hỏi lại
  1 câu ngắn để chọn, hoặc chọn ngành chung nhất và nói rõ "mình lấy theo ngành X nhé".

### 3.2 Biết: file training về dịch vụ (chủ web100 sẽ cung cấp)

File `worker/training-dich-vu.md` (đã tạo khung, chủ web100 điền). Gồm: giá trên bao gồm gì; phí hằng năm (domain, hosting, bảo trì);
thời gian hoàn thành; số lần chỉnh sửa; bàn giao gì; có SEO/quảng cáo không; thanh toán mấy đợt; bảo hành.
Toàn bộ file này được nhúng vào system prompt, đặt sau danh sách ngành, và bật prompt caching.

### 3.3 Không biết: nội dung bảng giá

AI không giữ 3.822 URL trong prompt (tốn token). Giá và URL chỉ về qua kết quả tool, và giao diện tự vẽ bảng từ
JSON đó. AI chỉ cần nói 1 câu dẫn, ví dụ "Website ngành cửa hàng xe máy điện có 18 mẫu, giá từ 3tr đến 5tr,
bạn xem bảng bên dưới nhé".

## 4. Kịch bản hội thoại

1. **Mở đầu**: chào + hỏi khách định làm website cho ngành/lĩnh vực gì. Nếu khách đã nói ngành ngay trong câu
   đầu thì bỏ qua bước hỏi.
2. **Khách nêu ngành có trong danh sách** (kể cả viết sai, viết khác): gọi ngay `tra_bao_gia(slug)`, không hỏi
   thêm. Kết quả hiện **popup bảng giá** gồm 3 cột: URL mẫu, Giá, nút **Xem thử** (mở URL ở tab mới). AI nói
   1 câu dẫn + 1 câu hỏi tiếp ("bạn ưng mẫu nào, mình nói thêm về mẫu đó").
3. **Câu hỏi về dịch vụ** (giá gồm gì, phí hằng năm, thời gian...): trả lời theo file training. Không có trong
   file (hoặc file ghi "liên hệ qua Zalo"): nói phần này cần tư vấn viên trả lời, rồi **xin số Zalo + tên** (mục 4.2).
4. **Ngành không có trong danh sách**: AI tự chọn 1 (tối đa 3) ngành gần nhất trong danh sách, nói đúng ý:
   "Ngành của bạn hiện chưa có trong dữ liệu báo giá mình biết, nhưng mình nghĩ các mẫu sau cũng có thể phù hợp",
   rồi gọi `tra_bao_gia` với ngành gần nhất để hiện bảng. Ví dụ: "bán cá cảnh" ->
   `ban-thu-cung-thuc-an-va-phu-kien-thu-cung`; "dạy guitar" -> `trung-tam-day-nhac-va-day-ve`;
   "bán đàn" -> `ban-nhac-cu`.
4b. **Khách chọn mẫu** (bấm "Chọn mẫu này" trong popup, chat tự gửi "Mình chọn mẫu <web> (giá ...) của ngành ..."):
   AI xác nhận mẫu + giá rồi xin liên hệ, khác nhau theo trang (`kenh` gửi kèm `/api/chat`, lấy từ `data-kenh`
   của `#lh-chat`):
   - `/lien-he/` (`lien_he`): giao diện hiện **khung nhập tên + SĐT** ngay dưới câu trả lời. Gửi khung ->
     GAS action `chat` (trình duyệt gửi).
   - `/lp/*` (`lp`): không có khung, **AI tự xin số Zalo + tên** trong chat rồi gọi tool `gui_lien_he` (mục 4.2).
5. **Khách không đồng ý** với mẫu gợi ý / muốn thứ khác: xin số Zalo + tên để Web100 gọi lại tư vấn đúng ngành.
6. **Yêu cầu chức năng đặc thù / khó** (đặt lịch online, thanh toán, app, quản lý kho, đa ngôn ngữ phức tạp,
   tích hợp phần mềm riêng, web thương mại điện tử lớn...): báo khung chung **5 đến 10 triệu**, nói rõ giá
   chính xác tuỳ yêu cầu, rồi xin số Zalo + tên. Vẫn có thể gọi `tra_bao_gia` ngành gần nhất để khách xem mẫu.
7. **Ngoài lề**: 1 câu từ chối nhẹ + kéo về chủ đề (mục 1).
8. **Kết thúc**: khách cảm ơn / xong việc mà chưa để lại số thì chúc ngắn + xin số Zalo 1 lần.

### 4.2 Xin số Zalo + tên (thay cho "mời nhắn Zalo 0964074043", từ 2026-11-10)

- AI **không bao giờ** bảo khách tự nhắn / gọi Zalo của Web100. Thay vào đó xin **số Zalo (hoặc SĐT) + tên** của
  khách, hẹn Web100 gọi lại trong vòng vài giờ. Xin tối đa 1 lần mỗi 2 lượt, khách chưa muốn cho thì thôi.
- **Mỗi lượt chỉ hỏi 1 điều**, không gộp. Ví dụ khách muốn nâng cấp website cũ: lượt 1 chỉ xin link website
  hiện tại; khách gửi link rồi lượt 2 mới nói cần tư vấn viên xem trực tiếp và xin số Zalo + tên.
- Có đủ số + tên trong hội thoại -> AI gọi tool `gui_lien_he {hoten, dienthoai, nhu_cau}` (có ở cả 2 trang).
  Có số mà chưa có tên thì hỏi tên 1 câu; khách không nói thì `hoten = "Khách"`.
- Worker chuẩn hoá SĐT (sai -> báo AI nhờ khách kiểm tra lại), gửi GAS action `chat` (kèm `nhu_cau`, `nguon` =
  gclid/utm, `kenh`, và hội thoại tới lúc đó) -> tab "Khách để lại SĐT" + email báo `NOTIFY_EMAIL`
  (web100.vn@gmail.com). Trả `lien_he` cho trình duyệt.
- **Conversion = dùng lại conversion "gửi form" có sẵn trên Google Ads** (GA4 `generate_lead` import sang Ads;
  site không có tag AW- riêng). Trình duyệt gọi đúng `trackLead()` của form cũ khi nhận `lien_he` hoặc khi gửi
  khung thành công, **1 lần / phiên chat**, tham số giống form cũ: `form = lp` (landing) / `contact` (/lien-he/),
  `package` = mẫu đã chọn hoặc "Chưa chọn", kèm SĐT cho enhanced conversions. Chỉ `form_location` khác
  (`chat-hero` / `chat`) để tách lead từ chat trong báo cáo. Không cần tạo conversion mới trên Ads.
- Số Zalo 0964074043 của Web100 chỉ còn xuất hiện ở câu báo lỗi kỹ thuật (AI không chạy được thì không xin số được).

### 4.1 Lịch sử chat (Google Drive)

Sau mỗi lượt AI trả lời, Worker (`worker/chat.js`, `ctx.waitUntil`, khách không phải chờ) gửi toàn bộ hội thoại của
phiên (`sid` do trình duyệt sinh) về GAS action `chat_log`: 1 file JSON / phiên trong thư mục Drive
"Web100 - Lịch sử chat AI" + 1 dòng sheet `ChatAI`. Xem / xoá ở trang quản trị `/admin/`, tab "Lịch sử chat AI".

## 5. Tool cho AI (định nghĩa gửi kèm request Messages API)

```json
{
  "name": "tra_bao_gia",
  "description": "Lấy bảng giá website theo ngành từ web100.vn. Chỉ gọi với slug nằm đúng trong danh sách ngành. Kết quả được giao diện hiển thị thành bảng popup, bạn chỉ cần nói 1 câu dẫn.",
  "strict": true,
  "input_schema": {
    "type": "object",
    "properties": {
      "slug": { "type": "string", "enum": ["du-lich-trong-nuoc", "...", "dich-vu-ban-lap-camera"] },
      "ly_do": { "type": "string", "description": "exact nếu khách nói đúng ngành này; gan_nhat nếu ngành khách không có và đây là ngành gần nhất bạn chọn", "enum": ["exact", "gan_nhat"] }
    },
    "required": ["slug", "ly_do"],
    "additionalProperties": false
  }
}
```

Worker xử lý tool: nhận `slug` -> gọi nội bộ `timNganh(data, slug)` (không cần HTTP ra ngoài) -> trả
`tool_result` cho AI **bản gọn** (`nganh` + `so_mau` + `gia_thap_nhat`/`gia_cao_nhat`, không kèm URL) để tiết
kiệm token, đồng thời gửi **bản đầy đủ** `bang_gia` cho trình duyệt vẽ popup.

Tham số gọi model (mục 2): `model: "claude-haiku-5-5"`, `max_tokens: 600`, `output_config: {effort: "low"}`
(chat ngắn, không cần suy nghĩ sâu), `tool_choice: {type: "auto"}`, system prompt + tool đặt `cache_control`
để cache. Hội thoại lưu ở trình duyệt (sessionStorage), mỗi lượt gửi lại toàn bộ `messages`, giới hạn 20 lượt.

## 6. System prompt

Bản chạy thật nằm ở `QUY_TAC` + `QUY_TAC_CHON_MAU` trong `worker/chat.js` (đã cập nhật theo mục 4.2; bản nháp cũ
ở đây đã bỏ vì còn câu "mời liên hệ Zalo"). Ghép: QUY_TAC + bước chọn mẫu theo kênh + DANH SÁCH NGÀNH (phụ lục)
+ THÔNG TIN DỊCH VỤ (`worker/training-dich-vu.md`).

## 7. Việc còn lại

- [ ] Chủ web100 đặt Secret `ANTHROPIC_API_KEY` cho Worker w100 (chưa có thì chat trả 503 kèm câu mời Zalo).
- [ ] Chủ web100 điền `worker/training-dich-vu.md` (mục 3.2).
- [x] Worker `/api/chat`: Haiku + tool `tra_bao_gia` (enum 232 slug, strict), tool_result gọn cho model,
      `bao_gia` đầy đủ cho trình duyệt; chặn spam 30 request / IP / 10 phút, tối đa 24 tin, 1000 ký tự mỗi tin.
- [x] `/lien-he/`: khung chat + chip gợi ý + popup bảng giá; hội thoại lưu sessionStorage.
- [ ] Ghi log hội thoại về Google Sheet qua GAS (giống form cũ) để chủ web100 theo dõi lead.
- [ ] Sau 1 đến 2 tuần chạy thật: đọc log, chỉnh QUY_TAC trong `worker/chat.js` nếu AI trả lời lệch.
- [ ] Khi sửa `baogiatonghop.csv`: chạy `python3 scripts/build_bao_gia.py` (tự cập nhật `worker/bao-gia.json`
      và phụ lục bên dưới), kiểm tra enum của tool `tra_bao_gia` lấy từ cùng danh sách này, rồi push.

## Phụ lục: danh sách ngành (STT | slug | tên)

232 ngành, sinh tự động bởi `scripts/build_bao_gia.py`, không sửa tay.

```
1 | du-lich-trong-nuoc | Du lịch trong nước
2 | cong-ty-kien-truc-nha-cua | Công ty kiến trúc nhà cửa
3 | logicstic-van-tai | Logicstic, vận tải
4 | xuat-nhap-khau-nong-san-thuc-pham | Xuất nhập khẩu nông sản, thực phẩm
5 | spa | Spa
6 | khach-san | Khách sạn
7 | yen-sao | Yến Sào
8 | ban-hang-van-phong-pham | Bán hàng Văn phòng phẩm
9 | ban-hang-do-gia-dung | Bán hàng đồ gia dụng
10 | ban-hang-quan-ao | Bán hàng quần áo
11 | ban-hang-giay-dep | Bán hàng giày dép
12 | ban-hang-the-thao | Bán hàng thể thao
13 | cong-ty-xay-dung | Công ty xây dựng
14 | trung-tam-tieng-anh | Trung tâm tiếng anh
15 | ban-hang-my-pham | Bán hàng mỹ phẩm
16 | ban-hang-trang-suc-vang-bac | Bán hàng trang sức, vàng bạc
17 | ban-hang-dong-ho | Bán hàng đồng hồ
18 | ban-hang-dien-thoai-phu-kien-cong-nghe | Bán hàng điện thoại, phụ kiện công nghệ
19 | ban-hang-may-tinh-laptop | Bán hàng máy tính, laptop
20 | ban-hang-dien-may | Bán hàng điện máy
21 | ban-hang-noi-that | Bán hàng nội thất
22 | ban-hang-thiet-bi-nha-bep | Bán hàng thiết bị nhà bếp
23 | ban-hang-me-va-be | Bán hàng mẹ và bé
24 | ban-hang-do-choi-tre-em | Bán hàng đồ chơi trẻ em
25 | ban-hang-thuc-pham-sach-huu-co | Bán hàng thực phẩm sạch, hữu cơ
26 | ban-hang-dac-san-vung-mien | Bán hàng đặc sản vùng miền
27 | ban-hang-banh-keo | Bán hàng bánh kẹo
28 | ban-hang-hoa-tuoi-cay-canh | Bán hàng hoa tươi, cây cảnh
29 | ban-hang-vat-lieu-trang-tri | Bán hàng vật liệu trang trí
30 | ban-hang-vat-tu-nong-nghiep | Bán hàng vật tư nông nghiệp
31 | ban-hang-thiet-bi-y-te | Bán hàng thiết bị y tế
32 | ban-hang-do-handmade-qua-tang | Bán hàng đồ handmade, quà tặng
33 | ban-hang-do-decor-phong-thuy | Bán hàng đồ decor, phong thủy
34 | ban-hang-phu-tung-o-to-xe-may | Bán hàng phụ tùng ô tô, xe máy
35 | van-phong-luat-su | Văn phòng luật sư
36 | cong-ty-ke-toan-kiem-toan | Công ty kế toán, kiểm toán
37 | cong-ty-tu-van-thue | Công ty tư vấn thuế
38 | cong-ty-tu-van-doanh-nghiep | Công ty tư vấn doanh nghiệp
39 | cong-ty-marketing-quang-cao | Công ty marketing, quảng cáo
40 | cong-ty-phan-mem-cong-nghe | Công ty phần mềm, công nghệ
41 | cong-ty-thiet-ke-do-hoa-branding | Công ty thiết kế đồ họa, branding
42 | cong-ty-nhan-su-tuyen-dung-trong-nguoc | Công ty nhân sự, tuyển dụng trong ngước
43 | cong-ty-nhan-su-tuyen-dung-nuoc-ngoai | Công ty nhân sự, tuyển dụng nước ngoài
44 | cong-ty-bao-ve | Công ty bảo vệ
45 | cong-ty-ve-sinh-cong-nghiep | Công ty vệ sinh công nghiệp
46 | cong-ty-dich-vu-ke-toan | Công ty dịch vụ kế toán
47 | cong-ty-dich-thuat | Công ty dịch thuật
48 | cong-ty-to-chuc-su-kien | Công ty tổ chức sự kiện
49 | cong-ty-in-an-bao-bi | Công ty in ấn, bao bì
50 | cong-ty-cung-cap-thiet-bi-van-phong | Công ty cung cấp thiết bị văn phòng
51 | cong-ty-cho-thue-may-moc-thiet-bi | Công ty cho thuê máy móc, thiết bị
52 | cong-ty-bat-dong-san | Công ty bất động sản
53 | website-du-an-can-ho-chung-cu | Website dự án căn hộ, chung cư
54 | cong-ty-noi-that | Công ty nội thất
55 | cong-ty-thiet-ke-thi-cong-noi-that | Công ty thiết kế thi công nội thất
56 | cong-ty-thiet-ke-canh-quan | Công ty thiết kế cảnh quan
57 | cong-ty-co-dien-m-e | Công ty cơ điện M&E
58 | cong-ty-nhom-kinh | Công ty nhôm kính
59 | cong-ty-cua-cuon-cua-nhom | Công ty cửa cuốn, cửa nhôm
60 | cong-ty-dien-nang-luong-mat-troi | Công ty điện năng lượng mặt trời
61 | cong-ty-vat-lieu-xay-dung | Công ty vật liệu xây dựng
62 | cong-ty-son-chong-tham | Công ty sơn, chống thấm
63 | cong-ty-thiet-bi-ve-sinh | Công ty thiết bị vệ sinh
64 | cong-ty-thiet-ke-va-thi-cong-nha-o | Công ty thiết kế và thi công nhà ở
65 | cong-ty-giam-sat-tu-van-xay-dung | Công ty giám sát, tư vấn xây dựng
66 | homestay | Homestay
67 | resort-villa-nghi-duong | Resort, villa nghỉ dưỡng
68 | cong-ty-cho-thue-xe-du-lich | Công ty cho thuê xe du lịch
69 | cong-ty-cho-thue-xe-tu-lai | Công ty cho thuê xe tự lái
70 | cong-ty-to-chuc-tour-trai-nghiem | Công ty tổ chức tour trải nghiệm
71 | nha-hang | Nhà hàng
72 | quan-ca-phe | Quán cà phê
73 | do-an-vat | Đồ ăn vặt
74 | quan-tra-sua | Quán trà sữa
75 | quan-bar-lounge | Quán bar, lounge
76 | dich-vu-catering-tiec-cuoi | Dịch vụ catering, tiệc cưới
77 | khu-vui-choi-tre-em | Khu vui chơi trẻ em
78 | trung-tam-to-chuc-tiec-cuoi | Trung tâm tổ chức tiệc cưới
79 | phong-gym | Phòng gym
80 | trung-tam-yoga-fitness | Trung tâm yoga, fitness
81 | san-golf | Sân golf
82 | san-pickleball | Sân pickleball
83 | san-the-thao | Sân thể thao
84 | tham-my-vien | Thẩm mỹ viện
85 | phong-kham-da-lieu-tham-my | Phòng khám da liễu thẩm mỹ
86 | salon-toc | Salon tóc
87 | barber-shop | Barber shop
88 | nail-salon | Nail salon
89 | makeup-artist | Makeup artist
90 | studio-phun-xam-tham-my | Studio phun xăm thẩm mỹ
91 | trung-tam-cham-soc-da | Trung tâm chăm sóc da
92 | trung-tam-giam-beo | Trung tâm giảm béo
93 | dich-vu-massage | Dịch vụ massage
94 | trung-tam-cham-soc-suc-khoe | Trung tâm chăm sóc sức khỏe
95 | phong-kham-nha-khoa | Phòng khám nha khoa
96 | phong-kham-da-khoa | Phòng khám đa khoa
97 | phong-kham-mat | Phòng khám mắt
98 | phong-kham-thu-y | Phòng khám thú y
99 | truong-mam-non | Trường mầm non
100 | trung-tam-du-hoc | Trung tâm du học
101 | trung-tam-tu-van-du-hoc-nghe | Trung tâm tư vấn du học nghề
102 | trung-tam-day-nghe | Trung tâm dạy nghề
103 | trung-tam-dao-tao-tin-hoc | Trung tâm đào tạo tin học
104 | trung-tam-luyen-thi-ielts-toeic | Trung tâm luyện thi IELTS, TOEIC
105 | trung-tam-dao-tao-ky-nang-mem | Trung tâm đào tạo kỹ năng mềm
106 | trung-tam-dao-tao-thiet-ke-lap-trinh | Trung tâm đào tạo thiết kế, lập trình
107 | trung-tam-dao-tao-lai-xe | Trung tâm đào tạo lái xe
108 | trung-tam-gia-su | trung tâm Gia sư
109 | day-hoc-truc-tuyen | Dạy học trực tuyến
110 | website-khoa-hoc-online | Website khóa học online
111 | nha-may-san-xuat | Nhà máy sản xuất
112 | cong-ty-co-khi | Công ty cơ khí
113 | cong-ty-san-xuat-nhua | Công ty sản xuất nhựa
114 | cong-ty-san-xuat-bao-bi | Công ty sản xuất bao bì
115 | cong-ty-san-xuat-noi-that | Công ty sản xuất nội thất
116 | cong-ty-may-mac | Công ty may mặc
117 | cong-ty-san-xuat-thuc-pham | Công ty sản xuất thực phẩm
118 | cong-ty-duoc-pham | Công ty dược phẩm
119 | cong-ty-hoa-my-pham | Công ty hóa mỹ phẩm
120 | cong-ty-thiet-bi-dien | Công ty thiết bị điện
121 | cong-ty-tu-dong-hoa-cong-nghiep | Công ty tự động hóa công nghiệp
122 | cong-ty-xu-ly-nuoc-moi-truong | Công ty xử lý nước, môi trường
123 | cong-ty-nang-luong-tai-tao | Công ty năng lượng tái tạo
124 | trang-trai-nong-nghiep-cong-nghe-cao | Trang trại nông nghiệp công nghệ cao
125 | cong-ty-thuy-san | Công ty thủy sản
126 | cong-ty-che-bien-ca-phe | Công ty chế biến cà phê
127 | cong-ty-san-xuat-tra | Công ty sản xuất trà
128 | cong-ty-phan-bon | Công ty phân bón
129 | showroom-o-to | Showroom ô tô
130 | dai-ly-xe-may | Đại lý xe máy
131 | gara-sua-chua-o-to | Gara sửa chữa ô tô
132 | trung-tam-cham-soc-detailing-o-to | Trung tâm chăm sóc, detailing ô tô
133 | dich-vu-cuu-ho-giao-thong | Dịch vụ cứu hộ giao thông
134 | trung-tam-dang-kiem | Trung tâm đăng kiểm
135 | dich-vu-cho-thue-xe | Dịch vụ cho thuê xe
136 | cong-ty-chuyen-nha-chuyen-van-phong | Công ty chuyển nhà, chuyển văn phòng
137 | cong-ty-chuyen-phat-nhanh | Công ty chuyển phát nhanh
138 | cong-ty-kho-bai | Công ty kho bãi
139 | dai-ly-ve-may-bay | Đại lý vé máy bay
140 | cong-ty-bao-hiem | Công ty bảo hiểm
141 | cong-ty-tu-van-tai-chinh | Công ty tư vấn tài chính
142 | cong-ty-tu-van-dau-tu | Công ty tư vấn đầu tư
143 | cong-ty-chung-khoan | Công ty chứng khoán
144 | cong-ty-quan-ly-tai-san | Công ty quản lý tài sản
145 | dich-vu-ke-toan-ca-nhan-doanh-nghiep | Dịch vụ kế toán cá nhân, doanh nghiệp
146 | cong-ty-tu-van-vay-von | Công ty tư vấn vay vốn
147 | dich-vu-tu-van-dinh-cu | Dịch vụ tư vấn định cư
148 | cong-ty-tu-van-visa | Công ty tư vấn visa
149 | studio-chup-anh | Studio chụp ảnh
150 | studio-quay-phim | Studio quay phim
151 | cong-ty-san-xuat-video | Công ty sản xuất video
152 | wedding-studio | Wedding studio
153 | nhiep-anh-gia-ca-nhan | Nhiếp ảnh gia cá nhân
154 | ca-si-nghe-si-nguoi-noi-tieng | Ca sĩ, nghệ sĩ, người nổi tiếng
155 | portfolio-ca-nhan | Portfolio cá nhân
156 | cong-ty-truyen-thong | Công ty truyền thông
157 | blog-chuyen-nganh | Blog chuyên ngành
158 | website-to-chuc-phi-loi-nhuan | Website tổ chức phi lợi nhuận
159 | quy-tu-thien | Quỹ từ thiện
160 | nuoc-uong-giai-khat | Nước uống giải khát
161 | nha-xe-duong-dai | Nhà xe đường dài
162 | xe-taxi-xe-ghep | Xe taxi, xe ghép
163 | tiem-vang | Tiệm vàng
164 | nail | Nail
165 | dien-lanh | Điện lạnh
166 | in-lich-ban-lich | In lịch/bán lịch
167 | nuoc-uong-dua | Nước uống dừa
168 | cat-got-kim-loai-khoan-phay-tien-doa-ta-ro | Cắt gọt kim loại (khoan, phay, tiện, doa, ta rô...)
169 | tiem-banh-kem | Tiệm bánh kem
170 | chup-anh-cuoi | Chụp ảnh cưới
171 | cho-thue-vay-cuoi | Cho thuê váy cưới
172 | cong-ty-san-xuat-linh-kien-dien-tu-cnc-gia-cong-co-khi | Công ty sản xuất linh kiện điện tử CNC gia công cơ khí
173 | nha-cung-cap-thiet-bi-phong-thi-nghiem | Nhà cung cấp thiết bị phòng thí nghiệm
174 | cong-ty-kiem-dinh-chat-luong-san-pham | Công ty kiểm định chất lượng sản phẩm
175 | cong-ty-giam-dinh-hang-hoa | Công ty giám định hàng hóa
176 | nha-cung-cap-bao-bi-cong-nghiep | Nhà cung cấp bao bì công nghiệp
177 | nha-cung-cap-may-nen-khi-cong-nghiep | Nhà cung cấp máy nén khí công nghiệp
178 | nha-cung-cap-thiet-bi-pccc | Nhà cung cấp thiết bị PCCC
179 | ban-sach-nha-sach | Bán sách, nhà sách
180 | ban-nhac-cu | Bán nhạc cụ
181 | ban-thiet-bi-am-thanh-chuyen-nghiep | Bán thiết bị âm thanh chuyên nghiệp
182 | ban-may-anh-thiet-bi-quay-phim-va-phu-kien | Bán máy ảnh, thiết bị quay phim và phụ kiện
183 | ban-thu-cung-thuc-an-va-phu-kien-thu-cung | Bán thú cưng, thức ăn và phụ kiện thú cưng
184 | ban-do-cam-trai-da-ngoai-va-cau-ca | Bán đồ cắm trại, dã ngoại và câu cá
185 | ban-ruou-vang-va-do-uong-nhap-khau | Bán rượu vang và đồ uống nhập khẩu
186 | sua-chua-dien-nuoc-va-dien-lanh-dan-dung-tai-nha | Sửa chữa điện nước và điện lạnh dân dụng tại nhà
187 | dich-vu-diet-con-trung-moi-mot-tan-nha | Dịch vụ diệt côn trùng, mối mọt tận nhà
188 | sua-chua-cuu-ho-khoa-va-lap-dat-khoa-thong-minh | Sửa chữa, cứu hộ khóa và lắp đặt khóa thông minh
189 | dich-vu-thong-tac-cong-hut-be-phot-va-ve-sinh-be-nuoc | Dịch vụ thông tắc cống, hút bể phốt và vệ sinh bể nước
190 | lap-dat-bao-tri-camera-an-ninh-va-nha-thong-minh | Lắp đặt, bảo trì camera an ninh và nhà thông minh
191 | phong-kham-phuc-hoi-chuc-nang-va-vat-ly-tri-lieu | Phòng khám phục hồi chức năng và vật lý trị liệu
192 | phong-kham-dong-y-y-hoc-co-truyen-va-cham-cuu | Phòng khám Đông y, y học cổ truyền và châm cứu
193 | phong-kham-chuyen-khoa-tai-mui-hong-va-nhi-khoa | Phòng khám chuyên khoa tai mũi họng và nhi khoa
194 | phong-kham-phau-thuat-tham-my | Phòng khám phẫu thuật thẩm mỹ
195 | trung-tam-giao-duc-dac-biet-va-can-thiep-som-cho-tre-em | Trung tâm giáo dục đặc biệt và can thiệp sớm cho trẻ em
196 | nha-thuoc-va-chuoi-nha-thuoc-online | Nhà thuốc và chuỗi nhà thuốc online
197 | phong-kham-dinh-duong-va-tu-van-dinh-duong | Phòng khám dinh dưỡng và tư vấn dinh dưỡng
198 | trung-tam-xet-nghiem-y-khoa-doc-lap | Trung tâm xét nghiệm y khoa độc lập
199 | dich-vu-cam-do-va-cam-co-tai-san | Dịch vụ cầm đồ và cầm cố tài sản
200 | dich-vu-giat-la-giat-kho-va-la-hoi-cong-nghiep | Dịch vụ giặt là, giặt khô và là hơi công nghiệp
201 | cua-hang-sua-chua-thay-linh-kien-dien-thoai-va-laptop | Cửa hàng sửa chữa, thay linh kiện điện thoại và laptop
202 | dich-vu-cham-soc-thu-cung-grooming-khach-san-thu-cung-va-huan-luyen | Dịch vụ chăm sóc thú cưng, grooming, khách sạn thú cưng và huấn luyện
203 | dich-vu-cham-soc-nguoi-cao-tuoi-va-giup-viec-theo-gio | Dịch vụ chăm sóc người cao tuổi và giúp việc theo giờ
204 | dich-vu-cham-soc-me-va-be-sau-sinh-tai-nha | Dịch vụ chăm sóc mẹ và bé sau sinh tại nhà
205 | dai-ly-gas-va-nuoc-uong-dong-binh | Đại lý gas và nước uống đóng bình
206 | cua-hang-kinh-mat | Cửa hàng kính mắt
207 | quan-karaoke-va-phong-tra | Quán karaoke và phòng trà
208 | cau-lac-bo-bida-gaming-center-va-cyber-game | Câu lạc bộ bida, gaming center và cyber game
209 | dich-vu-tang-le-tron-goi-dai-hoa-than-va-mai-tang | Dịch vụ tang lễ trọn gói, đài hóa thân và mai táng
210 | tu-van-phong-thuy-xem-tu-vi-va-sim-so-dep | Tư vấn phong thủy, xem tử vi và sim số đẹp
211 | chua-nha-tho-co-so-ton-giao-va-ban-quan-ly-nghia-trang | Chùa, nhà thờ, cơ sở tôn giáo và ban quản lý nghĩa trang
212 | dich-vu-cho-thue-trang-phuc-ao-dai-cosplay-va-le-hoi | Dịch vụ cho thuê trang phục, áo dài, cosplay và lễ hội
213 | dich-vu-hosting-ten-mien-va-cloud | Dịch vụ hosting, tên miền và cloud
214 | cong-ty-an-ninh-mang-va-bao-mat | Công ty an ninh mạng và bảo mật
215 | san-xuat-va-phan-phoi-thiet-bi-bao-ho-lao-dong | Sản xuất và phân phối thiết bị bảo hộ lao động
216 | san-xuat-va-thi-cong-bien-hieu-quang-cao-led | Sản xuất và thi công biển hiệu quảng cáo, LED
217 | phan-phoi-may-nong-nghiep-va-thiet-bi-tuoi-tu-dong | Phân phối máy nông nghiệp và thiết bị tưới tự động
218 | san-xuat-va-phan-phoi-thuc-an-chan-nuoi | Sản xuất và phân phối thức ăn chăn nuôi
219 | trung-tam-day-tieng-nhat-han-va-trung | Trung tâm dạy tiếng Nhật, Hàn và Trung
220 | trung-tam-day-boi-day-vo-va-nang-khieu | Trung tâm dạy bơi, dạy võ và năng khiếu
221 | trung-tam-day-nhac-va-day-ve | Trung tâm dạy nhạc và dạy vẽ
222 | trung-tam-day-nau-an-va-pha-che | Trung tâm dạy nấu ăn và pha chế
223 | hop-tac-xa-nong-nghiep | Hợp tác xã nông nghiệp
224 | cong-ty-giong-cay-trong-va-vat-nuoi | Công ty giống cây trồng và vật nuôi
225 | trang-trai-du-lich-nong-nghiep | Trang trại du lịch nông nghiệp
226 | cong-ty-xuat-khau-go-va-lam-san | Công ty xuất khẩu gỗ và lâm sản
227 | trang-trai-nuoi-trong-thuy-san | Trang trại nuôi trồng thủy sản
228 | don-vi-thi-cong-dien-mat-troi-ap-mai-dan-dung | Đơn vị thi công điện mặt trời áp mái dân dụng
229 | spa-duong-sinh | spa dưỡng sinh
232 | cua-hang-xe-may-dien | Cửa hàng xe máy điện
233 | dich-vu-nau-an | dịch vụ nấu ăn
234 | dich-vu-ban-lap-camera | Dịch vụ bán lắp camera
```
