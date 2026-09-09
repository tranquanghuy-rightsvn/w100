#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nhập bài viết từ web100.vn (bản cũ) sang blog của bản clone tĩnh.

Chạy:  python3 scripts/import_web100_posts.py

Script làm 4 việc:
  1. Tải trang gốc + toàn bộ ảnh trong bài về máy (cache ở scripts/.cache/).
  2. Dọn HTML gốc: bỏ <picture>/srcset, gỡ mã hoá &agrave;…, tách <br><br>
     thành <p>, nâng những dòng in đậm đứng riêng thành <h2> (bài gốc không
     có heading nào — rất bất lợi cho SEO).
  3. Sinh trang chi tiết + trang chuyên mục theo đúng design system của site
     (css/style.css, css/blog.css, css/blog-chi-tiet.css) kèm JSON-LD.
  4. Cập nhật lưới bài trên html/blog/index.html và khối Blog ở trang chủ.

Chạy lại nhiều lần cho ra cùng kết quả (idempotent) — các khối bị thay thế
được xác định bằng comment mốc trong HTML chứ không nối thêm.

Muốn nhập tiếp chuyên mục khác (Dự án, Hướng dẫn Web100…): đổi CATEGORY và
POSTS bên dưới rồi chạy lại.
"""
import html
import json
import math
import os
import re
import shutil
import urllib.parse
import urllib.request

# --------------------------------------------------------------------------
# Cấu hình
# --------------------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(os.path.dirname(HERE), 'html')
CACHE = os.path.join(HERE, '.cache')
ORIGIN = 'https://web100.vn'

CAT_SLUG = 'kinh-nghiem-seo-website'
CAT_NAME = 'Kinh nghiệm SEO website'
CAT_DESC = ('Tổng hợp kinh nghiệm SEO website thực chiến của Web100: tốc độ tải trang, '
            'Core Web Vitals, sitemap, tối ưu hình ảnh, SEO onpage và cách viết content lên top.')
AUTHOR = 'Web100 Team'
CAT_URL = f'/blog/{CAT_SLUG}/'    # site dùng URL sạch, không có .html

# (url gốc, slug mới). Bài "Chia sẻ kinh nghiệm và những hiểu lầm khi làm SEO"
# bị bỏ ra vì chính bài đó ghi rõ là chép nguyên văn từ Facebook "Nghiện SEO".
POSTS = [
    ('/hướng-dẫn-cách-viết-content-lên-top-tìm-kiếm.html',
     'huong-dan-viet-content-len-top-tim-kiem'),
    ('/tầm-quan-trọng-của-sitemap-trong-seo.html',
     'tam-quan-trong-cua-sitemap-trong-seo'),
    ('/10-mẹo-cải-thiện-chỉ-số-cls-cho-website.html',
     '10-meo-cai-thien-chi-so-cls-cho-website'),
    ('/cách-tối-ưu-hình-ảnh-cho-website-giúp-tăng-tốc-độ-tải-trang-cho-mobile.html',
     'toi-uu-hinh-anh-tang-toc-do-tai-trang-mobile'),
    ('/giải-thích-các-chỉ-số-của-lighthouse-trên-google-chrome-có-quan-trọng-cho-seo-không.html',
     'giai-thich-cac-chi-so-lighthouse-google-chrome'),
    ('/bí-mật-để-có-1-website-có-tốc-độ-tải-trang-cực-nhanh.html',
     'bi-mat-website-toc-do-tai-trang-cuc-nhanh'),
    ('/tầm-quan-trọng-của-seo-onpage-trong-chiến-lược-digital-marketing.html',
     'tam-quan-trong-cua-seo-onpage'),
]

MONTH_VI = {1: 'Th 1', 2: 'Th 2', 3: 'Th 3', 4: 'Th 4', 5: 'Th 5', 6: 'Th 6',
            7: 'Th 7', 8: 'Th 8', 9: 'Th 9', 10: 'Th 10', 11: 'Th 11', 12: 'Th 12'}
ARROW = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
         '<path d="M5 12h14M13 6l6 6-6 6"/></svg>')


# --------------------------------------------------------------------------
# 1. Tải về
# --------------------------------------------------------------------------
def fetch(url, dest):
    if os.path.exists(dest):
        return open(dest, 'rb').read()
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    # URL bài viết gốc có dấu tiếng Việt nên phải percent-encode phần path
    scheme, rest = url.split('://', 1)
    host, _, path = rest.partition('/')
    url = f'{scheme}://{host}/' + urllib.parse.quote(path)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    data = urllib.request.urlopen(req, timeout=40).read()
    open(dest, 'wb').write(data)
    return data


def scrape(path, slug):
    raw = fetch(ORIGIN + path, f'{CACHE}/pages/{slug}.html').decode('utf-8', 'ignore')
    title = html.unescape(re.search(r'<h1 class="the-article-title"[^>]*>(.*?)</h1>',
                                    raw, re.S).group(1)).strip()
    pub = re.search(r'the-article-publish"[^>]*>(.*?)</li>', raw, re.S)
    pub = html.unescape(re.sub(r'<[^>]+>', '', pub.group(1))).strip() if pub else ''
    desc = re.search(r'name="description" content="([^"]*)"', raw)
    desc = html.unescape(desc.group(1)).strip() if desc else ''
    og = re.search(r'property="og:image" content="([^"]*)"', raw).group(1)

    body = raw[raw.index('<div class="trix-content">'):]
    body = body[:body.index('</section>')]
    body = body.replace('<div class="trix-content">', '', 1)
    return dict(slug=slug, title=title, pub=pub, desc=desc, og=og, body=body)


# --------------------------------------------------------------------------
# 2. Dọn HTML
# --------------------------------------------------------------------------
def unescape_safe(s):
    """gỡ &agrave;… nhưng giữ nguyên &lt; &gt; &amp; để không phá ví dụ code"""
    s = s.replace('&lt;', '\x01').replace('&gt;', '\x02').replace('&amp;', '\x03')
    s = html.unescape(s)
    return s.replace('\x01', '&lt;').replace('\x02', '&gt;').replace('\x03', '&amp;')


def cache_img(src):
    """images/post2/75/246/ten.webp -> tải về cache, trả về tên file phẳng"""
    name = src.split('post2/')[-1].replace('/', '-')
    fetch(f'{ORIGIN}/{src.lstrip("/")}', f'{CACHE}/imgs/{name}')
    return name


def img_size(name):
    try:
        from PIL import Image
        return Image.open(f'{CACHE}/imgs/{name}').size
    except Exception:
        return None, None


def conv_figure(m, title):
    """<figure><picture><source srcset=…×3><img …> -> <figure><img> gọn"""
    fig = m.group(0)
    srcs = re.findall(r'srcset="([^"]+)"', fig)
    full = [s for s in srcs if not s.endswith(('_300.webp', '_480.webp'))]
    src = full[0] if full else (srcs[0] if srcs else '')
    if not src:
        return ''
    name = cache_img(src)
    iw, ih = img_size(name)
    cap = re.search(r'<figcaption[^>]*>(.*?)</figcaption>', fig, re.S)
    cap = re.sub(r'<[^>]+>', '', cap.group(1)).strip() if cap else ''
    size = f' width="{iw}" height="{ih}"' if iw else ''
    out = (f'<figure class="post-figure"><img src="{{IMGBASE}}{name}" '
           f'alt="{cap or title}" loading="lazy" decoding="async"{size}>')
    if cap:
        out += f'<figcaption>{cap}</figcaption>'
    return out + '</figure>'


def normalize_strong(chunk):
    """bài gốc hay viết <strong>Tiêu đề<br><br></strong>Nội dung… — đẩy các
       thẻ xuống dòng ra ngoài <strong> để lát nữa cắt đoạn không đứt thẻ"""
    chunk = re.sub(r'((?:<br\s*/?>\s*)+)</strong>', r'</strong>\1', chunk)
    chunk = re.sub(r'<strong>((?:<br\s*/?>\s*)+)', r'\1<strong>', chunk)
    chunk = re.sub(r'<strong>(\s|&nbsp;)*</strong>', ' ', chunk)
    return chunk


def rebalance_strong(parts):
    """có chỗ <strong> mở ở đoạn này mà đóng ở đoạn sau — đóng/mở lại cho khớp"""
    out, carry = [], False
    for p in parts:
        if carry:
            p = '<strong>' + p
        carry = len(re.findall(r'<strong>', p)) > len(re.findall(r'</strong>', p))
        if carry:
            p += '</strong>'
        out.append(p)
    return out


def blockify(chunk):
    """một <div> thô -> các <p>, đoạn nào chỉ gồm 1 <strong> thì nâng thành <h2>"""
    chunk = normalize_strong(chunk)
    chunk = re.sub(r'(?:<br\s*/?>\s*){2,}', '\x00', chunk)
    chunk = re.sub(r'(\x02FIG\d+\x02)', lambda m: '\x00' + m.group(1) + '\x00', chunk)
    parts = rebalance_strong([p.strip() for p in chunk.split('\x00')])
    out = []
    for p in parts:
        p = re.sub(r'^(?:<br\s*/?>\s*)+|(?:<br\s*/?>\s*)+$', '', p).strip()
        if not p or p in ('&nbsp;',):
            continue
        m = re.fullmatch(r'<strong>(.*?)</strong>', p, re.S)
        if m:
            t = re.sub(r'<br\s*/?>', ' ', m.group(1)).strip().rstrip(':').strip()
            if t and len(t) < 140:
                out.append(f'<h2>{t}</h2>')
                continue
        out.append(f'<p>{p}</p>')
    return '\n'.join(out)


def clean_body(body, title):
    b = unescape_safe(body)
    # chỉ bỏ đúng số </div> thừa mà bước cắt để lại
    extra = len(re.findall(r'</div>', b)) - len(re.findall(r'<div\b', b))
    for _ in range(max(extra, 0)):
        b = re.sub(r'\s*</div>\s*$', '', b)

    figs = []

    def stash(m):
        figs.append(conv_figure(m, title))
        return f'\x02FIG{len(figs) - 1}\x02'

    b = re.sub(r'<figure\b.*?</figure>', stash, b, flags=re.S)

    out = []
    for part in re.split(r'(<div>.*?</div>|<ul>.*?</ul>|<ol>.*?</ol>)', b, flags=re.S):
        s = part.strip()
        if not s:
            continue
        if s.startswith('<div>'):
            m = re.fullmatch(r'<div>(.*)</div>', s, re.S)
            out.append(blockify(m.group(1) if m else s[5:]))
        elif s.startswith(('<ul>', '<ol>')):
            out.append(s)
        else:
            out.append(blockify(s))
    b = '\n'.join(x for x in out if x.strip())

    b = re.sub(r'<p>\s*(\x02FIG\d+\x02)\s*</p>', r'\1', b)   # ảnh không nằm trong <p>
    b = re.sub(r'<p>\s*</p>', '', b)
    b = re.sub(r'\x02FIG(\d+)\x02', lambda m: figs[int(m.group(1))], b)
    return re.sub(r'\n{3,}', '\n\n', b).strip()


def slugify(s):
    s = re.sub(r'<[^>]+>', '', s).lower()
    for src, dst in (('àáạảãâầấậẩẫăằắặẳẵ', 'a'), ('èéẹẻẽêềếệểễ', 'e'), ('ìíịỉĩ', 'i'),
                     ('òóọỏõôồốộổỗơờớợởỡ', 'o'), ('ùúụủũưừứựửữ', 'u'),
                     ('ỳýỵỷỹ', 'y'), ('đ', 'd')):
        for ch in src:
            s = s.replace(ch, dst)
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-') or 'muc'


# --------------------------------------------------------------------------
# 3. Sinh trang
# --------------------------------------------------------------------------
def esc(s):
    return html.escape(s, quote=True)


def main():
    arts = []
    for path, slug in POSTS:
        a = scrape(path, slug)
        a['clean'] = clean_body(a['body'], esc(a['title']))
        d = re.search(r'(\d{2}):(\d{2}) (\d{2})/(\d{2})/(\d{4})', a['pub'])
        hh, mm, dd, mo, yy = (int(x) for x in d.groups())
        a['iso'] = f'{yy:04d}-{mo:02d}-{dd:02d}T{hh:02d}:{mm:02d}:00+07:00'
        a['date'], a['day'], a['month_vi'] = f'{dd:02d}/{mo:02d}/{yy}', f'{dd:02d}', MONTH_VI[mo]
        a['sort'] = (yy, mo, dd, hh, mm)
        a['read'] = max(3, math.ceil(len(re.sub(r'<[^>]+>', ' ', a['clean']).split()) / 200))
        arts.append(a)
    arts.sort(key=lambda x: x['sort'], reverse=True)

    # ---- ảnh: đổi sang tên theo slug rồi chép vào html/images/blog/
    imgdir = f'{ROOT}/images/blog'
    os.makedirs(imgdir, exist_ok=True)
    for a in arts:
        cover = cache_img_cover(a)
        a['cover'] = cover
        state = {'n': 0, 'seen': {}}

        def ren(m, a=a, state=state):
            old = m.group(1)
            if old not in state['seen']:
                state['n'] += 1
                new = f'{a["slug"]}-{state["n"]}.webp'
                shutil.copyfile(f'{CACHE}/imgs/{old}', f'{imgdir}/{new}')
                state['seen'][old] = new
            return '{IMGBASE}' + state['seen'][old]

        a['clean'] = re.sub(r'\{IMGBASE\}([^"]+)', ren, a['clean'])

        used = set()

        def addid(m):
            base = slugify(m.group(1))
            s, i = base, 2
            while s in used:
                s, i = f'{base}-{i}', i + 1
            used.add(s)
            return f'<h2 id="{s}">{m.group(1)}</h2>'

        a['html'] = re.sub(r'<h2>(.*?)</h2>', addid, a['clean'], flags=re.S)

    # ---- khung header/footer lấy thẳng từ trang blog để luôn đồng bộ menu
    shell = open(f'{ROOT}/blog/index.html', encoding='utf-8').read()
    header = shell[shell.index(MARK_HEAD):shell.index(MARK_MAIN)].rstrip()
    tail = shell[shell.index(MARK_CTA):].rstrip() + '\n'

    write_posts(arts, header, tail)
    write_category(arts, header, tail)
    update_blog_index(arts)
    update_home(arts)


MARK_HEAD = '<!-- ============================ HEADER'
MARK_MAIN = '<main id="top">'
MARK_CTA = '<!-- ============================ CTA BAND'
MARK_FEAT = '<!-- ============================ BÀI VIẾT NỔI BẬT ============================ -->'
MARK_FILT = '<!-- ============================ BỘ LỌC CHỦ ĐỀ ============================ -->'
MARK_GRID = '<!-- ============================ LƯỚI BÀI VIẾT ============================ -->'
MARK_NEWS = '<!-- ============================ ĐĂNG KÝ NHẬN BÀI VIẾT ============================ -->'


def cache_img_cover(a):
    """ảnh bìa = og:image của bài gốc (480×320)"""
    name = f'{a["slug"]}-cover.webp'
    src = f'{CACHE}/imgs/cover-{a["slug"]}.webp'
    fetch(a['og'], src)
    shutil.copyfile(src, f'{ROOT}/images/blog/{name}')
    return name


def excerpt(a, n=155):
    t = ' '.join((a['desc'] or re.sub(r'<[^>]+>', ' ', a['clean'])).split())
    return (t[:n].rsplit(' ', 1)[0] + '…') if len(t) > n else t


def card(a):
    return f'''      <a class="blog-card reveal" href="{CAT_URL}{a['slug']}/" data-category="{CAT_SLUG}">
        <div class="blog-cover">
          <img src="/images/blog/{a['cover']}" alt="{esc(a['title'])}" loading="lazy" width="480" height="320" />
        </div>
        <span class="blog-date"><strong>{a['day']}</strong><em>{a['month_vi']}</em></span>
        <div class="blog-card__body">
          <span class="blog-tag">{CAT_NAME}</span>
          <h3>{esc(a['title'])}</h3>
          <p>{esc(excerpt(a, 120))}</p>
          <div class="blog-meta">
            <span>{AUTHOR}</span>
            <span class="blog-meta__dot">•</span>
            <span>{a['read']} phút đọc</span>
          </div>
        </div>
      </a>'''


def toc(a):
    heads = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', a['html'], re.S)
    if len(heads) < 3:
        return ''
    items = '\n'.join(f'          <li><a href="#{i}">{re.sub(r"<[^>]+>", "", t)}</a></li>'
                      for i, t in heads)
    return f'''      <nav class="post-toc" aria-label="Mục lục bài viết">
        <p class="post-toc__title">Nội dung bài viết</p>
        <ol>
{items}
        </ol>
      </nav>
'''


def write_posts(arts, header, tail):
    for a in arts:
        related = '\n'.join(card(r)
                            for r in [x for x in arts if x is not a][:3])
        ld = json.dumps({
            "@context": "https://schema.org",
            "@graph": [
                {"@type": "BlogPosting", "headline": a['title'], "description": excerpt(a),
                 "image": f"{ORIGIN}/images/blog/{a['cover']}",
                 "datePublished": a['iso'], "dateModified": a['iso'],
                 "author": {"@type": "Organization", "name": "Web100"},
                 "publisher": {"@type": "Organization", "name": "Web100",
                               "logo": {"@type": "ImageObject", "url": f"{ORIGIN}/images/logo.png"}},
                 "articleSection": CAT_NAME, "inLanguage": "vi-VN"},
                {"@type": "BreadcrumbList", "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Trang chủ", "item": f"{ORIGIN}/"},
                    {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{ORIGIN}/blog/"},
                    {"@type": "ListItem", "position": 3, "name": CAT_NAME,
                     "item": f"{ORIGIN}/blog/{CAT_SLUG}/"},
                    {"@type": "ListItem", "position": 4, "name": a['title']}]}]
        }, ensure_ascii=False, indent=2)

        page = f'''<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(a['title'])} — Web100</title>
<meta name="description" content="{esc(a['desc'][:300])}">
<meta property="og:type" content="article">
<meta property="og:title" content="{esc(a['title'])}">
<meta property="og:description" content="{esc(a['desc'][:300])}">
<meta property="og:image" content="/images/blog/{a['cover']}">
<meta property="article:published_time" content="{a['iso']}">
<meta property="article:section" content="{CAT_NAME}">
<link rel="icon" type="image/png" href="/images/preview.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
<link rel="stylesheet" href="/css/blog.css">
<link rel="stylesheet" href="/css/blog-chi-tiet.css">
<script type="application/ld+json">
{ld}
</script>
</head>
<body>

{header}

<main id="top">

<article class="post">

  <!-- ============================ ĐẦU BÀI VIẾT ============================ -->
  <header class="post-head">
    <div class="container post-head__inner">
      <nav class="post-crumbs" aria-label="Breadcrumb">
        <a href="/">Trang chủ</a>
        <span>/</span>
        <a href="/blog/">Blog</a>
        <span>/</span>
        <a href="{CAT_URL}">{CAT_NAME}</a>
      </nav>
      <span class="blog-tag">{CAT_NAME}</span>
      <h1>{esc(a['title'])}</h1>
      <p class="post-head__lead">{esc(a['desc'][:230])}</p>
      <div class="post-head__meta">
        <img src="/images/logo.png" alt="" class="blog-meta__avatar">
        <span>{AUTHOR}</span>
        <span class="blog-meta__dot">•</span>
        <time datetime="{a['iso'][:10]}">{a['date']}</time>
        <span class="blog-meta__dot">•</span>
        <span>{a['read']} phút đọc</span>
      </div>
    </div>
  </header>

  <div class="container post-cover">
    <img src="/images/blog/{a['cover']}" alt="{esc(a['title'])}" width="480" height="320" fetchpriority="high">
  </div>

  <!-- ============================ NỘI DUNG ============================ -->
  <div class="container post-layout">
    <div class="post-body">
{toc(a)}{a['html'].replace('{IMGBASE}', '/images/blog/')}

      <div class="post-cta">
        <div>
          <h2>Muốn website của bạn đạt 100 điểm SEO?</h2>
          <p>Web100 thiết kế website tĩnh siêu nhẹ, chuẩn SEO ngay từ dòng code đầu tiên — không plugin, không phụ thuộc backend.</p>
        </div>
        <a class="btn btn-primary" href="/lien-he/">
          Nhận tư vấn miễn phí
          {ARROW}
        </a>
      </div>
    </div>
  </div>
</article>

<!-- ============================ BÀI VIẾT LIÊN QUAN ============================ -->
<section class="blog-gallery post-related">
  <div class="container">
    <div class="section-head">
      <div>
        <span class="eyebrow">Đọc tiếp {ARROW}</span>
        <h2>Bài viết liên quan</h2>
      </div>
      <a class="text-link" href="{CAT_URL}">Xem tất cả {ARROW}</a>
    </div>
    <div class="blog-grid">
{related}
    </div>
  </div>
</section>

{tail}
'''
        d = f'{ROOT}/blog/{CAT_SLUG}/{a["slug"]}'
        os.makedirs(d, exist_ok=True)
        open(f'{d}/index.html', 'w', encoding='utf-8').write(page)
        print(f'  bài  → {a["slug"]} ({a["read"]} phút đọc)')


def write_category(arts, header, tail):
    cards = '\n'.join(card(a) for a in arts)
    ld = json.dumps({"@context": "https://schema.org", "@type": "CollectionPage",
                     "name": CAT_NAME, "inLanguage": "vi-VN",
                     "url": f"{ORIGIN}/blog/{CAT_SLUG}/",
                     "hasPart": [{"@type": "BlogPosting", "headline": a['title'],
                                  "datePublished": a['iso'],
                                  "url": f"{ORIGIN}/blog/{CAT_SLUG}/{a['slug']}/"} for a in arts]},
                    ensure_ascii=False, indent=2)
    page = f'''<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{CAT_NAME} — Web100</title>
<meta name="description" content="{CAT_DESC}">
<meta property="og:title" content="{CAT_NAME} — Web100">
<meta property="og:description" content="{CAT_DESC}">
<meta property="og:image" content="/images/blog/{arts[0]['cover']}">
<link rel="icon" type="image/png" href="/images/preview.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
<link rel="stylesheet" href="/css/blog.css">
<link rel="stylesheet" href="/css/blog-chi-tiet.css">
<script type="application/ld+json">
{ld}
</script>
</head>
<body>

{header}

<main id="top">

<!-- ============================ INTRO CHUYÊN MỤC ============================ -->
<section class="blog-hero">
  <div class="container">
    <nav class="post-crumbs" aria-label="Breadcrumb">
      <a href="/">Trang chủ</a>
      <span>/</span>
      <a href="/blog/">Blog</a>
    </nav>
    <span class="eyebrow">
      Chuyên mục
      {ARROW}
    </span>
    <h1>{CAT_NAME}</h1>
    <p class="section-desc">{len(arts)} bài viết đúc kết từ những dự án thật của Web100 — tốc độ tải trang, Core Web Vitals, sitemap, tối ưu hình ảnh, SEO onpage và cách viết content lên top tìm kiếm.</p>
  </div>
</section>

<!-- ============================ LƯỚI BÀI VIẾT ============================ -->
<section class="blog-gallery">
  <div class="container">
    <div class="blog-grid">
{cards}
    </div>
  </div>
</section>

{tail}
'''
    open(f'{ROOT}/blog/{CAT_SLUG}/index.html', 'w', encoding='utf-8').write(page)
    print(f'  mục  → {CAT_SLUG} ({len(arts)} bài)')


def between(text, start, end, replacement):
    i = text.index(start)
    return text[:i] + replacement + text[text.index(end, i):]


def update_blog_index(arts):
    idx = open(f'{ROOT}/blog/index.html', encoding='utf-8').read()
    top, rest = arts[0], arts[1:]

    idx = between(idx, MARK_FEAT, MARK_FILT, f'''{MARK_FEAT}
<section class="blog-featured">
  <div class="container">
    <a class="blog-featured__card" href="{CAT_URL}{top['slug']}/">
      <div class="blog-cover blog-featured__cover">
        <img src="/images/blog/{top['cover']}" alt="{esc(top['title'])}" loading="lazy" width="480" height="320" />
      </div>
      <div class="blog-featured__body">
        <span class="blog-tag">{CAT_NAME}</span>
        <h2>{esc(top['title'])}</h2>
        <p>{esc(excerpt(top, 210))}</p>
        <div class="blog-meta">
          <img src="/images/logo.png" alt="" class="blog-meta__avatar">
          <span>{AUTHOR}</span>
          <span class="blog-meta__dot">•</span>
          <span>{top['date']}</span>
          <span class="blog-meta__dot">•</span>
          <span>{top['read']} phút đọc</span>
        </div>
        <span class="text-link">
          Đọc bài viết
          {ARROW}
        </span>
      </div>
    </a>
  </div>
</section>

''')

    idx = between(idx, MARK_FILT, MARK_GRID, f'''{MARK_FILT}
<div class="blog-filters-wrap">
  <div class="container">
    <div class="blog-filters" id="blogFilters">
      <button class="blog-filter is-active" type="button" data-filter="all">Tất cả</button>
      <button class="blog-filter" type="button" data-filter="{CAT_SLUG}">{CAT_NAME}</button>
    </div>
    <a class="text-link blog-filters__link" href="{CAT_URL}">
      Xem chuyên mục {CAT_NAME}
      {ARROW}
    </a>
  </div>
</div>

''')

    grid = '\n\n'.join(card(a) for a in rest)
    idx = between(idx, MARK_GRID, MARK_NEWS, f'''{MARK_GRID}
<section class="blog-gallery">
  <div class="container">
    <div class="blog-grid" id="blogGrid">

{grid}

    </div>

    <p class="blog-empty" id="blogEmpty">Chưa có bài viết nào trong chủ đề này.</p>
  </div>
</section>

''')
    open(f'{ROOT}/blog/index.html', 'w', encoding='utf-8').write(idx)
    print(f'  blog → 1 bài nổi bật + {len(rest)} thẻ')


def update_home(arts):
    home = open(f'{ROOT}/index.html', encoding='utf-8').read()
    cards = '\n\n'.join(f'''            <a class="blog-card" href="{CAT_URL}{a['slug']}/">
              <div class="blog-cover">
                <img src="/images/blog/{a['cover']}" alt="{esc(a['title'])}" loading="lazy" width="480" height="320" />
              </div>
              <span class="blog-date"><strong>{a['day']}</strong><em>{a['month_vi']}</em></span>
              <div class="blog-card__body">
                <span class="blog-tag">{CAT_NAME}</span>
                <h3>{esc(a['title'])}</h3>
                <p>{esc(excerpt(a, 120))}</p>
                <div class="blog-meta">
                  <span>{AUTHOR}</span>
                  <span class="blog-meta__dot">•</span>
                  <span>{a['read']} phút đọc</span>
                </div>
              </div>
            </a>''' for a in arts[:4])
    home, n = re.subn(
        r'(          <div class="home-blog-grid">\n).*?'
        r'(\n          </div>\n\n          <div class="projects-more">)',
        lambda m: m.group(1) + cards + m.group(2), home, flags=re.S)
    assert n == 1, 'không tìm thấy khối .home-blog-grid trên trang chủ'
    open(f'{ROOT}/index.html', 'w', encoding='utf-8').write(home)
    print('  home → 4 thẻ bài mới nhất')


if __name__ == '__main__':
    print(f'Nhập {len(POSTS)} bài vào chuyên mục "{CAT_NAME}"…')
    main()
    print('Xong.')
