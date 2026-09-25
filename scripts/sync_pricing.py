#!/usr/bin/env python3
"""Dong bo noi dung 3 goi (Normal / Chuyen nghiep / Cao cap) tu scripts/build_lp.py (PACKAGES)
sang cac trang khac co bang gia cung 3 goi:

- html/thiet-ke-website-da-nang/index.html  (danh sach trong the gia)
- html/website-doanh-nghiep/index.html       (danh sach trong the gia)

Thay <ul class="price-card__list"> cua tung the (giu nguyen ten goi, gia, mo ta, nut bam) va
khoi "Moi goi deu bao gom" ngay duoi luoi gia.
Trang chu (html/index.html) dung bo goi khac (Co ban...) nen KHONG dong bo o day.

    python3 scripts/sync_pricing.py
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_lp import PACKAGES, I_CHECK_PRICE, pricing_common_html  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["html/thiet-ke-website-da-nang/index.html", "html/website-doanh-nghiep/index.html"]


def card_list(pkg: dict, indent: str) -> str:
    rows = [f'{indent}  <li class="price-card__gift">{I_CHECK_PRICE} {g}</li>' for g in pkg["gifts"]]
    rows += [f"{indent}  <li>{I_CHECK_PRICE} {i}</li>" for i in pkg["items"]]
    return f'<ul class="price-card__list">\n' + "\n".join(rows) + f"\n{indent}</ul>"


def main() -> None:
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
