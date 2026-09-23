#!/usr/bin/env python3
"""Sinh lai html/sitemap.xml tu chinh cac trang trong html/.

- Lay moi <thu-muc>/index.html (URL dang /thu-muc/), bo qua trang co
  meta robots "noindex" (admin, demo, 404, ...).
- lastmod = ngay commit gan nhat cua file; file dang sua chua commit thi lay
  ngay hom nay.

Chay lai moi khi them/xoa trang:
    python3 scripts/build_sitemap.py
"""
import re
import subprocess
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_DIR = ROOT / "html"
BASE = "https://web100.vn"


def last_modified(path: Path) -> str:
    rel = path.relative_to(ROOT)
    dirty = subprocess.run(["git", "status", "--porcelain", "--", str(rel)], cwd=ROOT,
                           capture_output=True, text=True).stdout.strip()
    if dirty:
        return date.today().isoformat()
    out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", str(rel)], cwd=ROOT,
                         capture_output=True, text=True).stdout.strip()
    return out or date.today().isoformat()


def main() -> None:
    urls = []
    for page in sorted(HTML_DIR.rglob("index.html")):
        text = page.read_text(encoding="utf-8")
        robots = re.search(r'<meta\s+name="robots"\s+content="([^"]*)"', text)
        if robots and "noindex" in robots.group(1):
            continue
        rel = page.parent.relative_to(HTML_DIR).as_posix()
        loc = f"{BASE}/" if rel == "." else f"{BASE}/{rel}/"
        urls.append((loc, last_modified(page)))
    urls.sort(key=lambda u: (u[0].count("/"), u[0]))
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, mod in urls:
        lines += ["  <url>", f"    <loc>{loc}</loc>", f"    <lastmod>{mod}</lastmod>", "  </url>"]
    lines.append("</urlset>")
    (HTML_DIR / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"sitemap.xml: {len(urls)} URL")


if __name__ == "__main__":
    main()
