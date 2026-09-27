#!/usr/bin/env python3
"""Dong bo cac khoi noi dung dung chung tu scripts/build_lp.py sang trang SEO:

1) Bang gia 3 goi (PACKAGES + "Moi goi deu bao gom") sang cac trang co bang gia cung 3 goi:

- html/thiet-ke-website-da-nang/index.html  (danh sach trong the gia)
- html/website-doanh-nghiep/index.html       (danh sach trong the gia)

Thay <ul class="price-card__list"> cua tung the (giu nguyen ten goi, gia, mo ta, nut bam) va
khoi "Moi goi deu bao gom" ngay duoi luoi gia.
Trang chu (html/index.html) dung bo goi khac (Co ban...) nen KHONG dong bo o day.

2) /ve-chung-toi/: chen ngay duoi hero cac section du an top Google, uu dai & cam ket, quy trinh;
   chen FAQ ngay truoc cta-band. Moi khoi nam giua cap comment <!-- lp-shared:...:start/end --> nen
   chay lai bao nhieu lan cung chi ghi de dung cho do. Can css/lp-sections.css.

    python3 scripts/sync_shared_sections.py
    python3 scripts/sync_faq_schema.py      # cap nhat schema FAQPage sau khi FAQ doi
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_lp import (  # noqa: E402
    ASSET_V, PACKAGES, I_CHECK_PRICE, pricing_common_html,
    top_cases_section, perks_section, process_section, faq_section,
)

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["html/thiet-ke-website-da-nang/index.html", "html/website-doanh-nghiep/index.html"]


def card_list(pkg: dict, indent: str) -> str:
    rows = [f'{indent}  <li class="price-card__gift">{I_CHECK_PRICE} {g}</li>' for g in pkg["gifts"]]
    rows += [f"{indent}  <li>{I_CHECK_PRICE} {i}</li>" for i in pkg["items"]]
    return f'<ul class="price-card__list">\n' + "\n".join(rows) + f"\n{indent}</ul>"


ABOUT = "html/ve-chung-toi/index.html"


def put_block(text: str, name: str, html: str, insert_at) -> str:
    """Ghi de khoi giua <!-- lp-shared:NAME:start/end -->; chua co thi chen tai vi tri insert_at(text)."""
    start, end = f"<!-- lp-shared:{name}:start -->", f"<!-- lp-shared:{name}:end -->"
    block = f"{start}\n{html}\n{end}"
    if start in text:
        return re.sub(re.escape(start) + r".*?" + re.escape(end), lambda _m: block, text, count=1, flags=re.S)
    pos = insert_at(text)
    return text[:pos] + "\n" + block + "\n" + text[pos:]


def sync_about() -> None:
    path = ROOT / ABOUT
    text = path.read_text(encoding="utf-8")
    top = "\n\n".join([top_cases_section(), perks_section(), process_section()])

    def after_hero(t: str) -> int:  # het section hero (section dau tien trong <main>)
        main = t.index('<main id="top">')
        return t.index("</section>", main) + len("</section>")

    def before_cta(t: str) -> int:
        return t.index('<section class="cta-band">')

    text = put_block(text, "top", top, after_hero)
    text = put_block(text, "faq", faq_section(), before_cta)
    if "/css/lp-sections.css" not in text:
        link = '<link rel="stylesheet" href="/css/ve-chung-toi.css'
        i = text.index(link)
        text = text[:i] + f'<link rel="stylesheet" href="/css/lp-sections.css?v={ASSET_V}">\n' + text[i:]
    path.write_text(text, encoding="utf-8")
    print("synced", ABOUT)


def main() -> None:
    sync_about()
    for rel in PAGES:
        path = ROOT / rel
        text = path.read_text(encoding="utf-8")
        for pkg in PACKAGES:
            # the gia: <h3>Ten goi</h3> ... <ul class="price-card__list"> ... </ul>
            pat = re.compile(r'(<h3>%s</h3>.*?)(\n(\s*)<ul class="price-card__list">.*?</ul>)' % re.escape(pkg["name"]), re.S)
            m = pat.search(text)
            if not m:
                raise SystemExit(f"{rel}: khong tim thay the gia {pkg['name']}")
            indent = m.group(3)
            text = text[:m.start(2)] + "\n" + indent + card_list(pkg, indent) + text[m.end(2):]
        # khoi "Moi goi deu bao gom": ghi de neu da co, chua co thi chen ngay sau </div> cua pricing-grid
        common = pricing_common_html()
        if '<div class="pricing-common">' in text:
            text = re.sub(r'    <div class="pricing-common">.*?\n    </div>', lambda _m: common, text, count=1, flags=re.S)
        else:
            grid = re.search(r'\n    <div class="pricing-grid">.*?\n    </div>', text, re.S)
            if not grid:
                raise SystemExit(f"{rel}: khong tim thay pricing-grid")
            text = text[:grid.end()] + "\n" + common + text[grid.end():]
        path.write_text(text, encoding="utf-8")
        print("synced", rel)


if __name__ == "__main__":
    main()
