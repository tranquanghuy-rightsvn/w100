#!/usr/bin/env python3
"""Sinh cac landing page chay quang cao trong html/lp/ tu 1 template chung.

- /lp/thiet-ke-website-da-nang/     — nhom tu khoa gia re ("thiet ke web da nang gia re"...)
- /lp/website-doanh-nghiep-da-nang/ — nhom tu khoa doanh nghiep
- /lp/cam-on/                       — trang cam on sau khi gui form

Hai landing chi khac nhau o hero (headline, mo ta, 4 diem noi bat) va goi
duoc lam noi bat trong bang gia; moi section ben duoi dung chung. Muon sua
noi dung chung -> sua template o day roi chay lai:

    python3 scripts/build_lp.py
    python3 scripts/bump_asset_version.py

Tat ca trang deu noindex (khong vao sitemap, khong canh tranh voi trang SEO
/thiet-ke-website-da-nang/). KHONG chan /lp/ trong robots.txt — AdsBot can
crawl duoc trang dich, va Google phai doc duoc the noindex.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LP_DIR = ROOT / "html" / "lp"
ASSET_V = "20260926u"

PHONE_TEL = "+84964074043"
PHONE_TXT = "096.407.4043"
ZALO = "https://zalo.me/84964074043"
MESSENGER = "https://m.me/web100.vn"
# Trên máy tính m.me chuyển sang messenger.com (phiên đăng nhập riêng -> hay bắt login lại).
# main.js đổi các link [data-messenger] sang link này khi là máy tính (chuột + màn hình rộng):
# vẫn nằm trên facebook.com nên dùng luôn phiên đã đăng nhập. 134808919720474 = ID Fanpage web100.vn.
MESSENGER_DESKTOP = "https://www.facebook.com/messages/t/134808919720474"
FANPAGE = "https://www.facebook.com/web100.vn/"

# ------------------------------------------------------------------ icons
I_PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>'
I_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
I_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>'
I_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'
I_MSG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.15.26.35.27.57l.05 1.78a.8.8 0 0 0 1.12.71l1.98-.87a.8.8 0 0 1 .53-.04c.91.25 1.87.38 2.91.38 5.64 0 10-4.13 10-9.7S17.64 2 12 2Zm6 7.46-2.94 4.66a1.5 1.5 0 0 1-2.17.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63l2.94-4.66a1.5 1.5 0 0 1 2.17-.4l2.34 1.75a.6.6 0 0 0 .72 0l3.16-2.4c.42-.32.97.18.69.63Z"/></svg>'
I_DONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>'
I_CHECK_PRICE = I_CHECK.replace("<svg ", '<svg class="price-card__check" ', 1)
I_MSG_BRAND = I_MSG.replace("<svg ", '<svg class="lp-msg-icon" ', 1)
ZALO_IMG = '<img class="lp-zalo-icon" src="/images/zalo.webp" alt="" width="22" height="22">'

# ------------------------------------------------------------------ goi dich vu
# value = chuoi ghi vao cot goi_dich_vu cua Sheet
PACKAGES = [
    # 3 goi viet cung 1 khung: gifts (chu xanh dam) = ho tro -> hosting/ten mien -> bai viet -> san pham;
    # items = so trang -> giao dien -> SEO -> tinh nang -> ban giao. Trang SEO /thiet-ke-website-da-nang/,
    # /website-doanh-nghiep/ va bang so sanh trong blog chi-phi-thiet-ke-website dung chung noi dung nay
    # (scripts/sync_pricing.py) — sua o day roi chay lai ca 2 script.
    {
        "key": "normal", "name": "Normal", "value": "Normal 1.500.000đ", "short": "1,5 triệu",
        "price": "1.500.000",
        "desc": "Khởi đầu tinh gọn cho hộ kinh doanh, cửa hàng và doanh nghiệp mới.",
        "gifts": [
            "Hỗ trợ trọn đời MIỄN PHÍ",
            "Tặng hosting năm đầu (trị giá 450.000đ)",
            "Tặng 6 bài viết tin tức chuyên nghiệp",
            "Đăng tối đa 100 sản phẩm",
        ],
        "items": [
            "Thiết kế 1 trang chủ + tối đa 7 trang nội dung",
            "Giao diện responsive trên mọi thiết bị",
            "Chuẩn SEO theo tiêu chuẩn Google (tiêu đề, mô tả, heading, tốc độ)",
            "Form liên hệ tích hợp email",
            "Bàn giao trong 5–7 ngày làm việc",
            "Chưa bao gồm tên miền",
        ],
    },
    {
        "key": "pro", "name": "Chuyên nghiệp", "value": "Chuyên nghiệp 3.500.000đ", "short": "3,5 triệu",
        "price": "3.500.000",
        "desc": "Cân bằng nhất giữa chi phí và tính năng cho doanh nghiệp đang tăng trưởng.",
        "gifts": [
            "Hỗ trợ trọn đời MIỄN PHÍ",
            "Tặng tên miền + hosting năm đầu",
            "Tặng 20 bài viết tin tức chuyên nghiệp",
            "Đăng tối đa 500 sản phẩm",
        ],
        "items": [
            "Thiết kế 1 trang chủ + tối đa 12 trang nội dung",
            "Giao diện chuyên nghiệp theo bộ nhận diện thương hiệu",
            "Chuẩn SEO onpage đầy đủ + khai báo Google Search Console",
            "Tích hợp trang blog/tin tức tự quản trị",
            "Tối ưu tốc độ tải trang (Lighthouse 90+)",
            "Tích hợp AI chatbot",
            "Tích hợp tính năng thanh toán đối với website bán hàng",
            "Bàn giao trong 5–7 ngày làm việc",
        ],
    },
    {
        "key": "premium", "name": "Cao cấp", "value": "Cao cấp 7.500.000đ", "short": "7,5 triệu",
        "price": "7.500.000",
        "desc": "Giải pháp toàn diện cho doanh nghiệp lớn, chuỗi khách sạn và yêu cầu tuỳ biến sâu.",
        "gifts": [
            "Hỗ trợ trọn đời MIỄN PHÍ",
            "Tặng tên miền + hosting năm đầu",
        ],
        "items": [
            "Tất cả tính năng của gói Chuyên nghiệp",
            "Thiết kế không giới hạn trang nội dung",
            "Thiết kế tính năng đặc thù của website",
            "Tích hợp thanh toán tự động",
            "Quản trị viên riêng, phản hồi ưu tiên trong 2 giờ",
            "Bàn giao trong 5–7 ngày làm việc",
        ],
    },
]

# Goi nao cung co -> hien 1 lan duoi 3 the gia ("Moi goi deu bao gom"), KHONG liet ke rieng o goi
# Cao cap (khach se tuong 2 goi kia khong co).
PRICING_COMMON = [
    "Thiết kế độc quyền, tư vấn UX/UI chuyên sâu",
    "Chuẩn SEO kỹ thuật nâng cao + chiến lược từ khoá",
    "Bảo mật nâng cao (SSL, tường lửa ứng dụng)",
    "Cache toàn cầu, tốc độ nhanh ở bất kỳ quốc gia nào",
    "Đa ngôn ngữ (nếu cần)",
    "Tool kiểm tra chất lượng SEO của bài viết",
]


def pricing_common_html(indent: str = "    ") -> str:
    items = "".join(f"\n{indent}    <li>{I_CHECK_PRICE} {c}</li>" for c in PRICING_COMMON)
    return (f'{indent}<div class="pricing-common">\n{indent}  <p class="pricing-common__title">Mọi gói đều bao gồm</p>'
            f'\n{indent}  <ul class="pricing-common__list">{items}\n{indent}  </ul>\n{indent}</div>')

# ------------------------------------------------------------------ bien the landing
VARIANTS = [
    {
        "slug": "thiet-ke-website-da-nang",
        "title": "Thiết kế website Đà Nẵng từ 1,5 triệu | Web100",
        "description": "Thiết kế website tại Đà Nẵng từ 1.500.000đ: giao diện đẹp, chuẩn mobile, bàn giao 5–7 ngày, tặng hosting năm đầu, báo giá rõ ràng.",
        "h1": "Thiết kế website Đà Nẵng <span>từ 1,5 triệu</span>",
        "sub": "Giao diện đẹp, chuẩn điện thoại, bàn giao nhanh, báo giá rõ ràng trước khi làm, không phát sinh.",
        "points": [
            "<b>Tặng hosting</b> năm đầu (trị giá 450.000đ)",
            "<b>Giao diện bắt mắt</b> trên cả mobile và máy tính",
            "Hiển thị <b>dưới 0.5 giây</b> - mắt thường không cảm nhận được",
            "Thiết kế <b>chuẩn SEO</b> theo tiêu chuẩn Google",
            "Hỗ trợ <b>trọn đời MIỄN PHÍ</b>",
            "Văn phòng tại <b>Đà Nẵng</b>, gặp trực tiếp được",
        ],
        "featured": "normal",
        "badge": "Tiết kiệm nhất",
    },
    {
        "slug": "website-doanh-nghiep-da-nang",
        "title": "Thiết kế website doanh nghiệp Đà Nẵng | Web100",
        "description": "Website doanh nghiệp tại Đà Nẵng thiết kế theo thương hiệu, có dự án thực tế. Từ gói 3.500.000đ tặng tên miền + hosting năm đầu.",
        "h1": "Website doanh nghiệp Đà Nẵng",
        "sub": "Thiết kế theo bộ nhận diện, trình bày năng lực và dự án để tạo niềm tin với khách hàng, đối tác, đã làm cho doanh nghiệp thật tại Đà Nẵng.",
        "points": [
            "<b>Tặng tên miền + hosting</b> năm đầu (từ gói 3,5 triệu)",
            "<b>Giao diện theo bộ nhận diện</b> thương hiệu, trên cả mobile và máy tính",
            "Hiển thị <b>dưới 0.5 giây</b> - mắt thường không cảm nhận được",
            "Thiết kế <b>chuẩn SEO</b> theo tiêu chuẩn Google",
            "Hỗ trợ <b>trọn đời MIỄN PHÍ</b>",
            "Văn phòng tại <b>Đà Nẵng</b>, gặp trực tiếp được",
        ],
        "featured": "pro",
        "badge": "Được chọn nhiều",
    },
]

# ------------------------------------------------------------------ du an that (lay tu /khach-hang/<slug>/)
CASES = [
    # Link website khach: <button data-live-url> mo bang JS (initTemplateActions trong main.js),
    # KHONG dung <a href> de website khach khong nhan backlink tu trang quang cao (ke ca nofollow).
    # Bang chung thu hang: anh chup ket qua Google do chu Web100 cung cap. *.png = anh goc (mo khi
    # bam vao anh), *-full.webp = ban nen de hien thi (xevip da xoa chu "Text" thua).
    {"proof": "tre-truc-evidence", "w": 1600, "h": 805, "name": "Tre Việt Building",
     "site": "https://tretruc.com.vn", "go": "https://tretruc.com.vn",
     "desc": "Website được cải tạo từ 06/2026, lúc đó từ khoá chính mới ở top 13. Sau khi nâng cấp giao diện và triển khai SEO toàn diện, chỉ 1 tháng sau website lên top 1.",
     "desc2": "Lượng khách hàng tăng đột biến mà chính anh Hạnh (Chủ site) cũng phải bất ngờ."},
    {"proof": "xevip-evidence", "w": 1600, "h": 858, "name": "Xe VIP Nội Bài",
     # hien ten mien cu trong anh, nhung mo website moi cua cung khach hang
     "site": "https://xevipnoibai.com", "go": "https://xevipsanbay.com",
     "desc": "Được build mới hoàn toàn từ năm 2023, đến nay đã 3 năm tuổi. Vừa chạy quảng cáo vừa SEO bền vững, chúng tôi đã đưa Xe VIP từ một website vô danh lên top 1, top 2 với các từ khoá về dịch vụ đưa đón sân bay Nội Bài."},
    {"proof": "luatdong-evidence", "w": 1600, "h": 846, "name": "Luật Đông Hà Nội",
     "site": "https://luatdonghanoi.vn", "go": "https://luatdonghanoi.vn",
     "desc": "Website được làm mới từ năm 2024, đến nay đã hơn 2 năm tuổi. Không backlink, không chi phí SEO, chỉ thuần nội dung và chất lượng website chuẩn SEO. Website đã âm thầm leo lên top đầu với từ khoá uy tín địa phương, chỉ đứng sau fanpage của chính công ty."},
]

LOGOS = [
    ("mvngroup", "MVN Group", 300, 141), ("trustcommedia", "Trustcom", 196, 128),
    ("tretruc", "Tre Việt Building", 783, 648), ("dolphinhouse", "Dolphin House", 320, 100),
    ("tienductransport", "Tiến Đức Transport", 320, 309), ("miraihrvietnam", "Mirai HR Việt Nam", 297, 320),
    ("luatdonghanoi", "Luật Đông Hà Nội", 320, 103), ("kyucraft", "KYU Craft", 320, 132),
    ("zreview", "Zreview", 569, 132), ("xevipsanbay", "Xe VIP Sân Bay", 320, 105),
]

PERKS = [
    ("Bàn giao nhanh", "Nhanh nhất 3 ngày, thông thường 5–7 ngày làm việc, tính từ khi chốt nội dung và thiết kế."),
    ("Tặng hosting, tên miền", "Mọi gói tặng hosting năm đầu (trị giá 450.000đ). Từ gói Chuyên nghiệp tặng thêm tên miền năm đầu."),
    ("Chỉnh sửa miễn phí", "Góp ý chỉnh sửa không mất phí, Web100 tiến hành ngay khi nhận được yêu cầu."),
    ("Hỗ trợ trọn đời MIỄN PHÍ", "Sau bàn giao, cần sửa gì cứ gọi hoặc nhắn tin. Báo giá chi tiết trước khi làm, ký đúng giá, không phát sinh."),
]

STEPS = [
    ("Trao đổi nhu cầu", "Bạn chia sẻ nhu cầu, mục đích làm website, phong cách, màu sắc và giao diện tham khảo nếu có."),
    ("Web100 làm demo", "Dựng bản demo giao diện theo đúng những gì bạn chia sẻ."),
    ("Xem demo, ưng ý mới cọc", "Chỉ cọc 1 chút (10%) để cả hai bên cùng có trách nhiệm với sản phẩm của mình."),
    ("Hoàn thiện website", "Hoàn thiện website và chỉnh sửa theo ý bạn."),
    ("Chạy chính thức &amp; bàn giao", "Đưa website hoạt động chính thức, bàn giao và hỗ trợ trọn đời MIỄN PHÍ."),
]

FAQS = [
    ("Bao lâu thì có website?",
     "Có thể có website nhanh trong 3 ngày. Tuy nhiên thông thường sẽ mất 5–7 ngày làm việc, tính từ khi chốt nội dung và thiết kế."),
    ("Tên miền và hosting tính thế nào?",
     "Mọi gói đều được tặng hosting miễn phí năm đầu. Tên miền được tặng miễn phí năm đầu nếu bạn dùng gói Chuyên nghiệp trở lên."),
    ("Nếu đã có sẵn domain và hosting, có được giảm giá không?",
     "Có. Giá sẽ được trừ đi phần domain và hosting mà bạn đã chi trả."),
    ("Sau 1 năm thì chi phí thế nào?",
     "Từ năm thứ hai, phí gia hạn hosting là 450.000đ/năm. Phí gia hạn tên miền khoảng 250.000đ – 450.000đ/năm tuỳ tên miền .com hay .vn, khoản này bạn trả cho nhà phân phối tên miền, không trả cho Web100."),
    ("Cài đặt tên miền có dễ không?",
     "Rất dễ, chỉ 3 thao tác đơn giản là xong."),
    ("Chỉnh sửa có mất phí không?",
     "Không mất phí. Bạn xem demo và góp ý, Web100 chỉnh sửa đến khi bạn ưng ý."),
    ("Sau bàn giao có hỗ trợ không?",
     "Có. Web100 hỗ trợ trọn đời <strong>MIỄN PHÍ</strong>."),
    ("Sau bàn giao, nếu cần chỉnh sửa thì bao lâu Web100 xử lý xong?",
     "Sau khi website đã bàn giao, bạn cần sửa gì chỉ cần gọi hoặc nhắn Zalo, Messenger. Web100 bắt tay vào làm ngay khi nhận được yêu cầu."),
    ("Tôi có thể tự quản trị website không?",
     "Có, website quản trị được thiết kế đơn giản nhưng đầy đủ để bạn thay đổi nội dung website không cần hỗ trợ của lập trình viên."),
    ("Tôi ở Đà Nẵng, gặp trực tiếp được không?",
     f"Được. Web100 ở số 85 Hói Kiểng 22, Ngũ Hành Sơn. Gọi {PHONE_TXT} hoặc nhắn Zalo để hẹn gặp trực tiếp hoặc họp online."),
    ("Có cần cọc trước không?",
     "Chỉ khi hoàn thành demo và bạn ưng ý mới cần cọc. Cọc trước 10%, một số tiền nhỏ để cả 2 bên cùng có trách nhiệm với sản phẩm."),
]


# ------------------------------------------------------------------ khoi dung chung
def head(title: str, description: str, extra_css: str = "") -> str:
    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-PGB8CLSTDS"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', 'G-PGB8CLSTDS');
  </script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<!-- Landing page quảng cáo: không index, không canonical (tránh tín hiệu mâu thuẫn). -->
<meta name="robots" content="noindex, follow">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:image" content="https://web100.vn/images/og/thiet-ke-website-da-nang.jpg">
<meta property="og:type" content="website">
<meta property="og:locale" content="vi_VN">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png">
<link rel="apple-touch-icon" href="/images/apple-touch-icon.png">
<link rel="preload" href="/fonts/plus-jakarta-sans-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/plus-jakarta-sans-vietnamese.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/fonts.css?v={ASSET_V}">
<link rel="stylesheet" href="/css/style.css?v={ASSET_V}">
{extra_css}<link rel="stylesheet" href="/css/lp.css?v={ASSET_V}">
</head>"""


# Header toi gian: logo KHONG phai link (khong co loi thoat), chi co 1 nut goi (so dien thoai).
HEADER = f"""<header class="lp-header">
  <div class="container lp-header__inner">
    <span class="lp-header__logo"><img src="/images/logo.webp" alt="Web100" width="200" height="58"></span>
    <div class="lp-header__actions" data-track-area="header">
      <a class="btn btn-primary btn-sm lp-header__phone" href="tel:{PHONE_TEL}">{I_PHONE}<span>{PHONE_TXT}</span></a>
    </div>
  </div>
</header>"""

FOOTER = f"""<footer class="lp-footer">
  <div class="container lp-footer__inner" data-track-area="footer">
    <div>
      <img src="/images/logo.webp" alt="Web100" width="200" height="58" loading="lazy">
      <p>Số nhà 85, đường Hói Kiểng 22, Ngũ Hành Sơn, Đà Nẵng</p>
    </div>
    <div class="lp-footer__links">
      <a href="tel:{PHONE_TEL}">{PHONE_TXT}</a>
      <a href="mailto:web100.vn@gmail.com">web100.vn@gmail.com</a>
      <a href="{FANPAGE}" target="_blank" rel="noopener">Fanpage Web100</a>
      <a href="/chinh-sach-bao-mat-thong-tin/" target="_blank" rel="noopener">Chính sách bảo mật</a>
    </div>
  </div>
  <div class="container lp-footer__bottom">© 2026 Web100. Thành công khách hàng là mục tiêu hàng đầu.</div>
</footer>"""

# Nut noi goc phai (desktop) + thanh lien he co dinh day man hinh (mobile).
CONTACT = f"""<div class="contact-float lp-float" data-track-area="float">
  <a class="contact-float__btn contact-float__phone" href="tel:{PHONE_TEL}" aria-label="Gọi điện thoại">{I_PHONE}</a>
  <a class="contact-float__btn contact-float__zalo" href="{ZALO}" target="_blank" rel="noopener" aria-label="Chat qua Zalo"></a>
  <a class="contact-float__btn lp-float__msg" href="{MESSENGER}" data-messenger="{MESSENGER_DESKTOP}" target="_blank" rel="noopener" aria-label="Chat qua Messenger">{I_MSG}</a>
</div>

<nav class="lp-bar" data-track-area="sticky-bar" aria-label="Liên hệ nhanh">
  <a class="lp-bar__item" href="tel:{PHONE_TEL}">{I_PHONE}<span>Gọi</span></a>
  <a class="lp-bar__item" href="{ZALO}" target="_blank" rel="noopener">{ZALO_IMG}<span>Zalo</span></a>
  <a class="lp-bar__item" href="{MESSENGER}" data-messenger="{MESSENGER_DESKTOP}" target="_blank" rel="noopener">{I_MSG_BRAND}<span>Messenger</span></a>
  <a class="lp-bar__cta" href="#dang-ky" data-goto-form>Nhận báo giá</a>
</nav>"""


def lead_form(form_id: str, area: str, title: str) -> str:
    return f"""<div class="modal lp-form" id="{form_id}" data-track-area="{area}">
        <div class="modal__body">
          <p class="lp-form__title">{title}</p>
          <p class="lp-form__desc">Để lại số điện thoại, Web100 phản hồi tư vấn và báo giá trong 1 giờ.</p>
          <form class="modal__form" data-form-action="lp" data-redirect="/lp/cam-on/">
            <label>
              <span>Số điện thoại / Zalo <b class="lp-req">*</b></span>
              <input type="tel" name="dienthoai" inputmode="tel" autocomplete="tel" placeholder="VD: 0905 123 456" required>
            </label>
            <label>
              <span>Website cần thiết kế</span>
              <select name="loai_website">
                <option value="" selected disabled hidden>Chọn loại website</option>
                <option>Doanh nghiệp</option>
                <option>Bán hàng</option>
                <option>Du lịch / Khách sạn</option>
                <option>Nhà hàng / Cafe</option>
                <option>Dịch vụ (spa, thẩm mỹ, sửa chữa…)</option>
                <option>Bất động sản</option>
                <option>Cải tạo website cũ</option>
                <option>Khác</option>
              </select>
            </label>
            <!-- Gói khách bấm ở bảng giá (nút data-pick-package) được main.js ghi vào đây. -->
            <input type="hidden" name="goi_dich_vu" value="">
            <label>
              <span>Tên của bạn <em>(không bắt buộc)</em></span>
              <input type="text" name="hoten" autocomplete="name" placeholder="VD: Anh Minh">
            </label>
            <button class="btn btn-primary btn-lg" type="submit">Nhận báo giá miễn phí {I_ARROW}</button>
            <p class="lp-form__privacy">Chỉ dùng để liên hệ tư vấn, không spam. <a href="/chinh-sach-bao-mat-thong-tin/" target="_blank" rel="noopener">Chính sách bảo mật</a></p>
          </form>
        </div>
        <div class="modal__done" hidden>
          {I_DONE}
          <h4>Đã gửi yêu cầu!</h4>
          <p>Web100 sẽ gọi lại cho bạn sớm nhất.</p>
        </div>
      </div>"""


def price_card(p: dict, featured: str, badge: str) -> str:
    is_feat = p["key"] == featured
    cls = "price-card price-card--featured" if is_feat else "price-card"
    btn = "btn btn-primary" if is_feat else "btn btn-outline"
    badge_html = f'\n        <span class="price-card__badge">{badge}</span>' if is_feat else ""
    gifts = "".join(f'\n          <li class="price-card__gift">{I_CHECK_PRICE} {g}</li>' for g in p["gifts"])
    items = "".join(f'\n          <li>{I_CHECK_PRICE} {i}</li>' for i in p["items"])
    return f"""      <div class="{cls}">{badge_html}
        <h3>{p["name"]}</h3>
        <p class="price-card__desc">{p["desc"]}</p>
        <div class="price-card__price"><span>{p["price"]}</span> đ</div>
        <ul class="price-card__list">{gifts}{items}
        </ul>
        <a class="{btn}" href="#dang-ky" data-pick-package="{p["value"]}">Chọn gói {p["name"]}</a>
      </div>"""


def landing(v: dict) -> str:
    points = "".join(f"\n          <li>{I_CHECK}<span>{pt}</span></li>" for pt in v["points"])
    def case_html(i: int, c: dict) -> str:
        return f"""
      <article class="lp-case reveal">
        <a class="lp-case__shot" href="/images/lp/{c["proof"]}.png" target="_blank" rel="noopener" aria-label="Xem ảnh gốc kết quả Google của {c["name"]}">
          <span class="lp-case__bar" aria-hidden="true"><i></i><i></i><i></i></span>
          <img src="/images/lp/{c["proof"]}-full.webp" alt="Kết quả tìm kiếm Google của website {c["name"]}" width="{c["w"]}" height="{c["h"]}" loading="lazy">
        </a>
        <div class="lp-case__body">
          <h3>{c["name"]}</h3>
          <p class="lp-case__desc">{c["desc"]}</p>{f'<p class="lp-case__desc">{c["desc2"]}</p>' if c.get("desc2") else ""}
          <button class="lp-case__link" type="button" data-live-url="{c["go"]}">{c["site"]} {I_ARROW}</button>
        </div>
      </article>"""

    cases = "".join(case_html(i, c) for i, c in enumerate(CASES, 1))
    logos = "".join(
        f'\n      <li><img src="/images/khach-hang/{s}.webp" alt="Logo {n}" width="{w}" height="{h}" loading="lazy"></li>'
        for s, n, w, h in LOGOS
    )
    cards = "\n".join(price_card(p, v["featured"], v["badge"]) for p in PACKAGES)
    perks = "".join(f"""
      <div class="lp-perk reveal">
        <span class="lp-perk__icon">{I_CHECK}</span>
        <h3>{t}</h3>
        <p>{d}</p>
      </div>""" for t, d in PERKS)
    steps = "".join(f"""
      <li class="lp-step"><span class="lp-step__num">{i:02d}</span><div><h3>{t}</h3><p>{d}</p></div></li>"""
                    for i, (t, d) in enumerate(STEPS, 1))
    faqs = "".join(f"""
      <div class="faq-item">
        <button class="faq-trigger" type="button" aria-expanded="false">
          <span>{q}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="faq-panel"><p>{a}</p></div>
      </div>""" for q, a in FAQS)

    return f"""{head(v["title"], v["description"], f'<link rel="stylesheet" href="/css/pricing.css?v={ASSET_V}">' + chr(10))}
<body class="lp">

{HEADER}

<main>

<!-- ============================ HERO + FORM ============================ -->
<section class="lp-hero">
  <div class="container lp-hero__grid">
    <div class="lp-hero__copy">
      <span class="lp-hero__loc">{I_PIN} Web100 · Ngũ Hành Sơn, Đà Nẵng</span>
      <h1>{v["h1"]}</h1>
      <p class="lp-hero__sub">{v["sub"]}</p>
      <ul class="lp-hero__points">{points}
      </ul>
      <div class="lp-hero__actions" data-track-area="hero">
        <a class="btn btn-primary btn-lg" href="tel:{PHONE_TEL}">{I_PHONE} Gọi {PHONE_TXT}</a>
        <div class="lp-hero__chat">
          <a class="btn btn-outline btn-lg" href="{ZALO}" target="_blank" rel="noopener">{ZALO_IMG} Zalo</a>
          <a class="btn btn-outline btn-lg" href="{MESSENGER}" data-messenger="{MESSENGER_DESKTOP}" target="_blank" rel="noopener">{I_MSG_BRAND} Messenger</a>
        </div>
      </div>
    </div>

    <div class="lp-hero__form reveal lp-from-right">
      {lead_form("dang-ky", "form-hero", "Nhận báo giá miễn phí")}
    </div>

    <figure class="lp-hero__proof">
      <img src="/images/ve-chung-toi-banner.webp" alt="CEO Quang Huy của Web100 ký hợp đồng với Honda Hiếu Nga Đà Nẵng" width="1300" height="868">
      <figcaption><strong>Honda Hiếu Nga Đà Nẵng</strong> ký hợp đồng cùng CEO Quang Huy của Web100.</figcaption>
    </figure>
  </div>
</section>

<!-- ============================ DỰ ÁN THẬT ============================ -->
<section class="lp-cases">
  <div class="container">
    <div class="lp-head">
      <h2>Website Web100 làm, đang đứng top Google</h2>
      <p class="lp-head__slogan">Thành công của khách hàng là mục tiêu hàng đầu</p>
    </div>
    <div class="lp-case-list">{cases}
    </div>
  </div>
</section>

<!-- ============================ LOGO KHÁCH HÀNG ============================ -->
<section class="lp-logos">
  <div class="container">
    <p class="lp-logos__title">Doanh nghiệp đã tin chọn Web100</p>
    <ul class="lp-logos__grid reveal">{logos}
    </ul>
    <p class="lp-logos__more">và hơn <strong>500</strong> doanh nghiệp khác</p>
  </div>
</section>

<!-- ============================ BẢNG GIÁ ============================ -->
<section class="pricing lp-pricing" id="bang-gia">
  <div class="container">
    <div class="lp-head">
      <span class="eyebrow">Bảng giá</span>
      <h2>3 gói thiết kế website, giá công khai</h2>
      <p>Chọn gói, để lại số điện thoại, Web100 gọi lại tư vấn chi tiết.</p>
    </div>
    <div class="pricing-grid reveal">
{cards}
    </div>
{pricing_common_html().replace('class="pricing-common"', 'class="pricing-common reveal"', 1)}
    <p class="lp-pricing__note">Báo giá chi tiết trước khi làm · <strong>Ký đúng giá, không phát sinh</strong>.</p>
  </div>
</section>

<!-- ============================ ƯU ĐÃI & CAM KẾT ============================ -->
<section class="lp-perks">
  <div class="container">
    <div class="lp-head">
      <span class="eyebrow">Ưu đãi &amp; cam kết</span>
      <h2>Bắt đầu nhẹ nhàng, không rủi ro</h2>
    </div>
    <div class="lp-perk-grid">{perks}
    </div>
  </div>
</section>

<!-- ============================ QUY TRÌNH ============================ -->
<section class="lp-process">
  <div class="container">
    <div class="lp-head">
      <span class="eyebrow">Quy trình</span>
      <h2>5 bước là có website</h2>
    </div>
    <ol class="lp-steps">{steps}
    </ol>
  </div>
</section>

<!-- ============================ FAQ ============================ -->
<section class="faq lp-faq">
  <div class="container lp-faq__inner">
    <div class="lp-head">
      <span class="eyebrow">Câu hỏi thường gặp</span>
      <h2>Trước khi làm website, khách thường hỏi</h2>
    </div>
    <div class="faq-list">{faqs}
    </div>
  </div>
</section>

<!-- ============================ CTA + FORM CUỐI ============================ -->
<section class="lp-final">
  <div class="container lp-final__grid">
    <div class="lp-final__copy">
      <h2>Nhận báo giá website trong 1 giờ</h2>
      <p>Để lại số điện thoại hoặc liên hệ trực tiếp, tư vấn miễn phí, không ràng buộc.</p>
      <div class="lp-final__contacts" data-track-area="final">
        <a href="tel:{PHONE_TEL}">{I_PHONE}<span>Gọi {PHONE_TXT}</span></a>
        <a href="{ZALO}" target="_blank" rel="noopener">{ZALO_IMG}<span>Nhắn Zalo</span></a>
        <a href="{MESSENGER}" data-messenger="{MESSENGER_DESKTOP}" target="_blank" rel="noopener">{I_MSG}<span>Nhắn Messenger</span></a>
      </div>
    </div>
    <div class="lp-final__form reveal lp-from-right">
      {lead_form("dang-ky-cuoi", "form-final", "Để lại số điện thoại")}
    </div>
  </div>
</section>

</main>

{FOOTER}

{CONTACT}

<script src="/js/main.js?v={ASSET_V}"></script>
</body>
</html>
"""


def thank_you() -> str:
    return f"""{head("Đã nhận yêu cầu | Web100", "Web100 đã nhận yêu cầu báo giá thiết kế website của bạn.")}
<body class="lp lp--thanks">

{HEADER}

<main>
<section class="lp-thanks">
  <div class="container">
    <div class="lp-thanks__card">
      {I_DONE}
      <h1>Web100 đã nhận yêu cầu của bạn</h1>
      <p>Chúng tôi sẽ gọi lại qua số điện thoại bạn vừa để lại để tư vấn và gửi báo giá trong 1 giờ.</p>
      <p class="lp-thanks__pkg" id="lpPkg" hidden></p>
      <p class="lp-thanks__fast">Muốn được tư vấn ngay?</p>
      <div class="lp-thanks__actions" data-track-area="thanks">
        <a class="btn btn-primary btn-lg" href="{ZALO}" target="_blank" rel="noopener">{ZALO_IMG} Nhắn Zalo</a>
        <a class="btn btn-outline btn-lg" href="{MESSENGER}" data-messenger="{MESSENGER_DESKTOP}" target="_blank" rel="noopener">{I_MSG_BRAND} Nhắn Messenger</a>
        <a class="btn btn-outline btn-lg" href="tel:{PHONE_TEL}">{I_PHONE} Gọi {PHONE_TXT}</a>
      </div>
      <a class="text-link lp-thanks__more" href="/khach-hang/">Trong lúc chờ, xem các dự án Web100 đã làm {I_ARROW}</a>
    </div>
  </div>
</section>
</main>

{FOOTER}

<script>
  // Hiện lại gói khách vừa chọn (?goi=...), chỉ để khách yên tâm đã chọn đúng.
  (function () {{
    var goi = new URLSearchParams(location.search).get('goi');
    var el = document.getElementById('lpPkg');
    if (goi && !/^Chưa/.test(goi) && el) {{ el.textContent = 'Gói bạn quan tâm: ' + goi; el.hidden = false; }}
  }})();
</script>
<script src="/js/main.js?v={ASSET_V}"></script>
</body>
</html>
"""


def main() -> None:
    for v in VARIANTS:
        out = LP_DIR / v["slug"] / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(landing(v), encoding="utf-8")
        print("wrote", out.relative_to(ROOT))
    out = LP_DIR / "cam-on" / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(thank_you(), encoding="utf-8")
    print("wrote", out.relative_to(ROOT))


if __name__ == "__main__":
    main()
