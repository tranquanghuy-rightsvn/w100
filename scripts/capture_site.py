#!/usr/bin/env python3
"""Chup screenshot mot website that (desktop + mobile viewport) bang Playwright.

Dung cho pipeline "khach hang moi" cua web100: chup dung ty le khung hinh can
thiet de mockup_warp.py ghep vao khung may tinh / dien thoai ma khong bi meo.

Usage:
    python3 capture_site.py <url> <out_desktop.png> <out_mobile.png>
"""
import sys

from playwright.sync_api import sync_playwright

# Ty le khung chup duoc tinh tu tu giac phoi canh da do trong mockup_warp.py
# (canh trung binh / chieu cao trung binh cua tung tu giac).
DESKTOP_VIEWPORT = {"width": 1536, "height": 832}
# 390x1002 = dung ty le vung man hinh dien thoai (0.389), do doc lap 2 lan:
# tu vien bezel trong mobile-customer.webp va tu mask cua trustcommedia.
# Doi ty le nay la anh bi keo gian, nhin la thay gia ngay.
MOBILE_VIEWPORT = {"width": 390, "height": 1002}

# Thay vi click (de gay scroll lung tung neu trung phai text trung ten o noi
# khac trong trang), an truc tiep bang JS moi phan tu co ve la banner
# cookie/consent: fixed/sticky position + tu khoa lien quan trong class/id/text.
_HIDE_OVERLAYS_JS = """
() => {
  const keyword = /cookie|consent|gdpr|cookiebot|onetrust|cc-window|cc-banner/i;
  const els = document.querySelectorAll('body *');
  let hidden = 0;
  for (const el of els) {
    if (!el.isConnected) continue;
    const style = getComputedStyle(el);
    if (style.position !== 'fixed' && style.position !== 'sticky') continue;
    const idClass = (el.id || '') + ' ' + (el.className || '');
    const text = (el.innerText || '').slice(0, 200);
    if (keyword.test(idClass) || keyword.test(text)) {
      el.style.setProperty('display', 'none', 'important');
      hidden++;
    }
  }
  window.scrollTo(0, 0);
  return hidden;
}
"""


def _dismiss_overlays(page):
    try:
        page.evaluate(_HIDE_OVERLAYS_JS)
    except Exception:
        pass


def capture(url: str, out_desktop: str, out_mobile: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()

        for viewport, out_path in ((DESKTOP_VIEWPORT, out_desktop), (MOBILE_VIEWPORT, out_mobile)):
            page = browser.new_page(viewport=viewport, device_scale_factor=2)
            try:
                page.goto(url, wait_until="networkidle", timeout=30000)
            except Exception:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(1200)
            _dismiss_overlays(page)
            page.wait_for_timeout(300)
            _dismiss_overlays(page)
            page.wait_for_timeout(300)
            page.screenshot(path=out_path)
            page.close()

        browser.close()


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python3 capture_site.py <url> <out_desktop.png> <out_mobile.png>")
        sys.exit(1)
    capture(sys.argv[1], sys.argv[2], sys.argv[3])
    print(f"OK: {sys.argv[2]}, {sys.argv[3]}")
