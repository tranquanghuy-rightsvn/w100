#!/usr/bin/env python3
"""Gan/doi tham so phien ban ?v=... cho moi link CSS/JS noi bo trong html/.

_headers cho /css/* va /js/* cache 1 ngay. Ten file khong co hash, nen sau moi
lan sua CSS/JS PHAI chay script nay truoc khi deploy, neu khong trinh duyet cu
se dung CSS/JS cu voi HTML moi (lech giao dien toi 1 ngay).

Usage:
    python3 scripts/bump_asset_version.py            # v = ngay hom nay (YYYYMMDDHHMM)
    python3 scripts/bump_asset_version.py 20260923a  # v tuy chon
"""
import re
import sys
from datetime import datetime
from pathlib import Path

HTML_DIR = Path(__file__).resolve().parent.parent / "html"
VERSION = sys.argv[1] if len(sys.argv) > 1 else datetime.now().strftime("%Y%m%d%H%M")

# href="/css/x.css" | src="/js/x.js" | src="../js/x.js" (co hoac chua co ?v=)
PATTERN = re.compile(r'((?:href|src)="(?:\.\./)*/?(?:css|js)/[A-Za-z0-9_.-]+\.(?:css|js))(?:\?v=[^"]*)?"')


def main() -> None:
    changed = 0
    for path in HTML_DIR.rglob("*.html"):
        text = path.read_text(encoding="utf-8")
        new = PATTERN.sub(lambda m: f'{m.group(1)}?v={VERSION}"', text)
        if new != text:
            path.write_text(new, encoding="utf-8")
            changed += 1
    print(f"v={VERSION}: cap nhat {changed} file")


if __name__ == "__main__":
    main()
