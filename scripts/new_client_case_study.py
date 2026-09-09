#!/usr/bin/env python3
"""Chuan bi anh cho mot trang case-study khach hang moi cua web100.

Anh chup la 2 khoi CHU NHAT NGUYEN BAN (khong warp, khong nen du). Viec gan
vao khung mockup do CSS lo (class .mock__pc-screen-rect / .mock__ph-screen-rect
trong css/khach-hang-chi-tiet.css + clipPath #phone-screen-clip trong HTML).

Ty le viewport chup PHAI dung theo vung man hinh do tu anh khung:
  - desktop 1536x832  (ty le 1.846)
  - mobile  390x1002  (ty le 0.389)
Doi ty le la anh bi keo gian, nhin la thay gia ngay.

Usage:
    python3 new_client_case_study.py <slug> <url>

Vi du:
    python3 new_client_case_study.py acme https://acme.vn
"""
import sys
import tempfile
from pathlib import Path

from PIL import Image

from capture_site import capture

IMAGES_DIR = Path(__file__).resolve().parent.parent / "html" / "images" / "khach-hang"

HTML_SNIPPET = """
--- Dan doan nay vao trong .khd-showcase, thay cho <figure> cu ---

      <svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute">
        <defs>
          <clipPath id="phone-screen-clip" clipPathUnits="objectBoundingBox">
            <path d="M 0.17349 0.03322 A 0.14006 0.05451 0 0 0 0.03292 0.08984 L 0.02368 0.91016 A 0.14006 0.05451 0 0 0 0.16302 0.96673 L 0.83698 0.97667 A 0.14006 0.05451 0 0 0 0.97634 0.92422 L 0.96706 0.07578 A 0.14006 0.05451 0 0 0 0.82651 0.02338 Z" />
          </clipPath>
        </defs>
      </svg>

      <figure class="khd-showcase__media">
        <div class="mock" role="img" aria-label="Giao dien website {domain} tren may tinh va dien thoai">
          <img class="mock__layer mock__pc-frame" src="../../images/khach-hang/desktop-customer.webp" alt="" />
          <div class="mock__pc-screen-rect">
            <img src="../../images/khach-hang/{slug}-desktop.jpg" alt="" />
          </div>

          <div class="mock__phone">
            <img class="mock__layer mock__ph-frame" src="../../images/khach-hang/mobile-customer.webp" alt="" />
            <div class="mock__ph-screen-rect">
              <img src="../../images/khach-hang/{slug}-mobile.jpg" alt="" />
            </div>
            <img class="mock__layer mock__ph-island" src="../../images/khach-hang/mobile-customer-island.webp" alt="" />
          </div>
        </div>
      </figure>
"""


def run(slug: str, url: str, quality: int = 92):
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        raw_d = str(Path(tmp) / "d.png")
        raw_m = str(Path(tmp) / "m.png")
        print(f"[1/2] Chup {url} (desktop 1536x832 + mobile 390x1002) ...")
        capture(url, raw_d, raw_m)

        print("[2/2] Luu anh chu nhat nguyen ban ...")
        out_d = IMAGES_DIR / f"{slug}-desktop.jpg"
        out_m = IMAGES_DIR / f"{slug}-mobile.jpg"
        Image.open(raw_d).convert("RGB").save(out_d, "JPEG", quality=quality)
        Image.open(raw_m).convert("RGB").save(out_m, "JPEG", quality=quality)

    for p in (out_d, out_m):
        im = Image.open(p)
        print(f"  {p.name}: {im.size[0]}x{im.size[1]} (ty le {im.size[0]/im.size[1]:.4f})")
    print(HTML_SNIPPET.format(slug=slug, domain=slug))
    return out_d, out_m


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 new_client_case_study.py <slug> <url>")
        sys.exit(1)
    run(sys.argv[1], sys.argv[2])
