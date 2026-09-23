#!/usr/bin/env python3
"""Dong bo schema FAQPage (JSON-LD) voi khoi FAQ hien tren trang.

Doc cac .faq-item (cau hoi trong .faq-trigger > span, tra loi trong .faq-panel)
cua moi trang trong html/, roi them/ghi de phan tu FAQPage trong @graph cua
the <script type="application/ld+json"> dau tien. Trang khong co FAQ thi bo qua.

Chay lai moi khi sua cau hoi thuong gap:
    python3 scripts/sync_faq_schema.py
"""
import html
import json
import re
from pathlib import Path

HTML_DIR = Path(__file__).resolve().parent.parent / "html"
ITEM = re.compile(
    r'<div class="faq-item[^"]*">\s*<button class="faq-trigger"[^>]*>\s*<span\s*>(.*?)</span\s*>.*?</button>\s*'
    r'<div class="faq-panel">(.*?)</div>\s*</div>',
    re.S,
)
LD = re.compile(r'(<script type="application/ld\+json">)(.*?)(</script>)', re.S)


def plain(fragment: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", fragment)).split())


def main() -> None:
    changed = 0
    for page in sorted(HTML_DIR.rglob("*.html")):
        text = page.read_text(encoding="utf-8")
        items = [(plain(q), plain(a)) for q, a in ITEM.findall(text)]
        m = LD.search(text)
        if not items or not m:
            continue
        data = json.loads(m.group(2))
        graph = data.get("@graph")
        if graph is None:
            graph = [{k: v for k, v in data.items() if k != "@context"}]
            data = {"@context": data.get("@context", "https://schema.org"), "@graph": graph}
        faq = {
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
                for q, a in items
            ],
        }
        graph[:] = [g for g in graph if g.get("@type") != "FAQPage"]
        # dat FAQPage ngay truoc BreadcrumbList cho de doc
        pos = next((i for i, g in enumerate(graph) if g.get("@type") == "BreadcrumbList"), len(graph))
        graph.insert(pos, faq)
        new = text[: m.start(2)] + "\n" + json.dumps(data, ensure_ascii=False, indent=2) + "\n" + text[m.end(2):]
        if new != text:
            page.write_text(new, encoding="utf-8")
            changed += 1
            print(f"{page.relative_to(HTML_DIR)}: {len(items)} câu hỏi")
    print(f"cap nhat {changed} trang")


if __name__ == "__main__":
    main()
