#!/usr/bin/env python3
"""Sinh cac trang hub "Mau website <nganh>" o html/mau-website-dep/<hub>/index.html.

Noi dung chu (title, mo ta, bai huong dan, FAQ) nam o scripts/data/mau_hubs.json.
The mau (card) duoc COPY nguyen tu html/mau-website-dep/index.html theo
data-category, nen khi them mau moi vao trang danh sach chi can chay lai:

    python3 scripts/build_mau_hubs.py

Header/footer/popup lay tu chinh trang danh sach, nen sua menu o do roi chay lai.
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "html"
LIST = HTML / "mau-website-dep" / "index.html"
DATA = json.loads((ROOT / "scripts" / "data" / "mau_hubs.json").read_text(encoding="utf-8"))
BASE = "https://web100.vn"
ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>'

BLOG_TITLES = {}
for p in (HTML / "blog").rglob("index.html"):
    m = re.search(r"<h1>(.*?)</h1>", p.read_text(encoding="utf-8"), re.S)
    if m:
        BLOG_TITLES["/" + p.parent.relative_to(HTML).as_posix() + "/"] = html.unescape(m.group(1))

SERVICE_NAMES = {
    "/website-doanh-nghiep/": "Thiết kế website doanh nghiệp",
    "/website-ban-hang/": "Thiết kế website bán hàng",
    "/website-tin-tuc/": "Thiết kế website tin tức, blog",
    "/cai-tao-website/": "Cải tạo website cũ",
    "/seo-ben-vung/": "Dịch vụ SEO bền vững",
    "/chay-quang-cao/": "Chạy quảng cáo Google, Facebook, TikTok",
    "/thiet-ke-website-da-nang/": "Thiết kế website Đà Nẵng",
}


def attr(t: str) -> str:
    return html.escape(t, quote=True)


def plain(t: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", t)).split())


def main() -> None:
    src = LIST.read_text(encoding="utf-8")
    head_end = src.index("</head>")
    main_start = src.index('<main id="top">')
    main_end = src.index("</main>") + len("</main>")
    cards = re.findall(r'(?:[ \t]*<!--[^\n]*-->\n)?[ \t]*<article class="tpl-card[^"]*" data-category="([^"]*)">.*?</article>', src, re.S)
    card_html = re.findall(r'((?:[ \t]*<!--[^\n]*-->\n)?[ \t]*<article class="tpl-card[^"]*" data-category="[^"]*">.*?</article>)', src, re.S)
    hubs = DATA["hubs"]

    for slug, hub in hubs.items():
        members = [(c, h) for c, h in zip(cards, card_html) if slug in c.split()]
        items = []
        for _, h in members:
            detail = re.search(r'href="/mau-website-dep/([a-z0-9-]+)/"', h).group(1)
            name = plain(re.search(r"<h3>(.*?)</h3>", h).group(1))
            blurb = hub.get("blurbs", {}).get(detail)
            # anh trong hub: lazy (hub khong co anh LCP trong luoi — hero la chu)
            h = re.sub(r'\s(fetchpriority="high"|loading="lazy")', "", h)
            h = h.replace('class="tpl-thumb__shot"', 'class="tpl-thumb__shot" loading="lazy"', 1)
            h = h.replace(' reveal"', '"').replace('class="tpl-card reveal"', 'class="tpl-card"')
            if blurb:
                h = h.replace(f"<h3>{re.search(r'<h3>(.*?)</h3>', h).group(1)}</h3>",
                              f'<h3><a href="/mau-website-dep/{detail}/">{re.search(r"<h3>(.*?)</h3>", h).group(1)}</a></h3>\n          <p class="tpl-body__blurb">{attr(blurb)}</p>')
            items.append((detail, name, h))

        url = f"{BASE}/mau-website-dep/{slug}/"
        title, desc = hub["title"], hub["description"]
        head = src[:head_end]
        head = re.sub(r"<title>.*?</title>", f"<title>{attr(title)}</title>", head, flags=re.S)
        head = re.sub(r'(<meta name="description" content=")[^"]*', lambda m: m.group(1) + attr(desc), head)
        head = re.sub(r'(<link rel="canonical" href=")[^"]*', lambda m: m.group(1) + url, head)
        head = re.sub(r'(<meta property="og:url" content=")[^"]*', lambda m: m.group(1) + url, head)
        head = re.sub(r'(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*', lambda m: m.group(1) + attr(title), head)
        head = re.sub(r'(<meta (?:property="og:description"|name="twitter:description") content=")[^"]*', lambda m: m.group(1) + attr(desc), head)
        og = f"{BASE}/images/og/mau-website-dep--{slug}.jpg"
        head = re.sub(r'(<meta (?:property="og:image"|name="twitter:image") content=")[^"]*', lambda m: m.group(1) + og, head)
        head = re.sub(r'(<meta property="og:image:alt" content=")[^"]*', lambda m: m.group(1) + attr(title), head)
        ld = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "CollectionPage",
                    "@id": url + "#collection",
                    "name": hub["h1"],
                    "description": desc,
                    "url": url,
                    "inLanguage": "vi-VN",
                    "isPartOf": {"@id": f"{BASE}/mau-website-dep/#collection"},
                    "mainEntity": {
                        "@type": "ItemList",
                        "itemListElement": [
                            {"@type": "ListItem", "position": i + 1, "name": n, "url": f"{BASE}/mau-website-dep/{d}/"}
                            for i, (d, n, _) in enumerate(items)
                        ],
                    },
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {"@type": "ListItem", "position": 1, "name": "Trang chủ", "item": f"{BASE}/"},
                        {"@type": "ListItem", "position": 2, "name": "Mẫu web đẹp", "item": f"{BASE}/mau-website-dep/"},
                        {"@type": "ListItem", "position": 3, "name": hub["h1"]},
                    ],
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": [
                        {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": plain(f["a"])}}
                        for f in hub["faqs"]
                    ],
                },
            ],
        }
        head = re.sub(r'<script type="application/ld\+json">.*?</script>',
                      lambda m: '<script type="application/ld+json">\n' + json.dumps(ld, ensure_ascii=False, indent=2) + "\n</script>",
                      head, count=1, flags=re.S)

        chips = "\n".join(
            f'      <a href="/mau-website-dep/{s}/"' + (' aria-current="page"' if s == slug else "") + f'>{attr(h["name"])}</a>'
            for s, h in hubs.items()
        )
        guide = hub["guide"]
        guide_items = "\n".join(
            f'      <article class="guide__item{" guide__item--wide" if it.get("wide") else ""}">\n        <h3>{attr(it["h3"])}</h3>\n        {it["html"]}\n      </article>'
            for it in guide["items"]
        )
        faqs = "\n".join(
            f"""      <div class="faq-item">
        <button class="faq-trigger" aria-expanded="false">
          <span>{attr(f["q"])}</span>
          {CHEVRON}
        </button>
        <div class="faq-panel">
          {f["a"]}
        </div>
      </div>"""
            for f in hub["faqs"]
        )
        svc = hub["service"]
        blog_links = "\n".join(
            f'          <a href="{u}"><span><span class="related__name">{attr(BLOG_TITLES[u])}</span></span></a>'
            for u in hub.get("blog", []) if u in BLOG_TITLES
        )
        other_hubs = "\n".join(
            f'          <a href="/mau-website-dep/{s}/"><span><span class="related__name">Mẫu website {attr(h["name"].lower())}</span><span class="related__meta">{sum(1 for c in cards if s in c.split())} mẫu tham khảo</span></span></a>'
            for s, h in hubs.items() if s != slug
        )
        body = f"""<main id="top">

<!-- ============================ INTRO ============================ -->
<section class="tpl-hero">
  <div class="container">
    <nav class="hub-crumb" aria-label="Breadcrumb">
      <a href="/">Trang chủ</a><span aria-hidden="true">/</span>
      <a href="/mau-website-dep/">Mẫu web đẹp</a><span aria-hidden="true">/</span>
      <strong>{attr(hub["name"])}</strong>
    </nav>
    <h1>{attr(hub["h1"])}</h1>
    <p class="section-desc">{attr(hub["lead"])}</p>
    <nav class="hub-chips" aria-label="Mẫu website theo ngành">
{chips}
    </nav>
  </div>
</section>

<!-- ============================ LƯỚI MẪU ============================ -->
<section class="tpl-gallery">
  <div class="container">
    <div class="tpl-grid">
{chr(10).join(h for _, _, h in items)}
    </div>
  </div>
</section>

<!-- ============================ HƯỚNG DẪN ============================ -->
<section class="guide">
  <div class="container">
    <div class="section-head">
      <div>
        <span class="eyebrow">{attr(guide["eyebrow"])}</span>
        <h2>{attr(guide["h2"])}</h2>
        <p class="section-desc">{attr(guide["desc"])}</p>
      </div>
    </div>
    <div class="guide__grid">
{guide_items}
    </div>
  </div>
</section>

<!-- ============================ FAQ ============================ -->
<section class="faq">
  <div class="container">
    <div class="section-head">
      <div>
        <span class="eyebrow">Câu hỏi thường gặp</span>
        <h2>Hỏi đáp về thiết kế website {attr(hub["name"].lower())}</h2>
      </div>
    </div>
    <div class="faq-list">
{faqs}
    </div>
  </div>
</section>

<!-- ============================ THAM KHẢO THÊM ============================ -->
<section class="related">
  <div class="container">
    <div class="related__grid">
      <div class="related__col">
        <h3>Dịch vụ phù hợp</h3>
        <div class="related__list">
          <a href="{svc}"><span><span class="related__name">{attr(SERVICE_NAMES.get(svc, svc))}</span><span class="related__meta">Thiết kế riêng theo thương hiệu, chuẩn SEO</span></span></a>
          <a href="/seo-ben-vung/"><span><span class="related__name">Dịch vụ SEO bền vững</span><span class="related__meta">Tăng khách tự nhiên từ Google</span></span></a>
          <a href="/khach-hang/"><span><span class="related__name">Dự án khách hàng</span><span class="related__meta">Website Web100 đã thực hiện</span></span></a>
        </div>
      </div>
      <div class="related__col">
        <h3>Mẫu website ngành khác</h3>
        <div class="related__list">
{other_hubs}
        </div>
      </div>
      <div class="related__col">
        <h3>Bài viết hữu ích</h3>
        <div class="related__list">
{blog_links}
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ============================ CTA BAND ============================ -->
<section class="cta-band">
  <div class="container cta-inner">
    <div>
      <h2>Muốn một website {attr(hub["name"].lower())}<br>theo phong cách này?</h2>
      <p>Gửi mẫu bạn thích, Web100 tư vấn bố cục và báo giá thiết kế riêng theo thương hiệu của bạn trong 24 giờ.</p>
    </div>
    <a class="btn btn-primary btn-lg" href="https://zalo.me/84964074043" target="_blank" rel="noopener">
      Liên hệ tư vấn
      {ARROW}
    </a>
  </div>
</section>

</main>"""
        out = head + src[head_end:main_start] + body + src[main_end:]
        dest = HTML / "mau-website-dep" / slug / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(out, encoding="utf-8")
        print(f"{slug}: {len(items)} mẫu -> {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
