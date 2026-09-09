#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Đổi toàn bộ đường dẫn nội bộ sang URL sạch, gốc tuyệt đối.

    ../blog/index.html          ->  /blog/
    index.html                  ->  /
    ../index.html#lien-he       ->  /#lien-he
    ../tool-landing-builder.html->  /tool-landing-builder/
    ../../images/logo.png       ->  /images/logo.png
    ../css/style.css            ->  /css/style.css

Chạy:  python3 scripts/clean_urls.py [--check]

--check chỉ báo cáo, không ghi file.

Lưu ý: sau khi đổi, site phải được xem qua HTTP server (mở file:// sẽ không
tải được css/ảnh vì đường dẫn bắt đầu bằng "/"):

    python3 -m http.server 8000 --directory html

Script chạy lại nhiều lần vẫn an toàn — đường dẫn đã sạch thì giữ nguyên.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(os.path.dirname(HERE), 'html')

# File đã được di chuyển sang thư mục riêng: đường dẫn tương đối bên trong nó
# vẫn viết theo vị trí cũ, nên phải phân giải theo thư mục cũ.
MOVED = {
    'tool-landing-builder/index.html': '',   # trước ở html/tool-landing-builder.html
}

# Trang lẻ đã được chuyển thành thư mục: link cũ trỏ tới file không còn tồn
# tại nữa nên phải ánh xạ tay sang URL mới.
RENAMED = {
    'tool-landing-builder.html': '/tool-landing-builder/',
}

SKIP = ('http://', 'https://', '//', 'mailto:', 'tel:', 'data:', 'javascript:', '#')
ASSET_ATTRS = ('href', 'src', 'poster', 'content')


def to_clean_url(ref, base_dir):
    """ref tương đối (đã tách #frag/?query) -> URL gốc tuyệt đối, hoặc None.

    Chỉ đổi khi đường dẫn trỏ tới một file có thật trong html/ — nhờ vậy các
    thuộc tính content="…" chứa văn bản thường (title, description, viewport)
    không bị hiểu nhầm là đường dẫn."""
    target = os.path.normpath(os.path.join(base_dir, ref))
    if not target.startswith(WEB):
        return None
    if os.path.relpath(target, WEB) in RENAMED:
        return RENAMED[os.path.relpath(target, WEB)]
    if not os.path.exists(target):
        return None
    rel = os.path.relpath(target, WEB)
    if rel == '.':
        return '/'
    if os.path.basename(rel) == 'index.html':
        d = os.path.dirname(rel)
        return '/' if d in ('', '.') else '/' + d + '/'
    return '/' + rel


def rewrite(value, base_dir):
    """giữ nguyên #fragment và ?query, chỉ đổi phần đường dẫn"""
    if not value or value.startswith(SKIP) or value.startswith('/'):
        return value
    path, suffix = re.match(r'([^#?]*)([#?].*)?$', value).groups()
    if not path:
        return value
    clean = to_clean_url(path, base_dir)
    return value if clean is None else clean + (suffix or '')


def process(path, dry=False):
    rel = os.path.relpath(path, WEB)
    base_dir = os.path.join(WEB, MOVED[rel]) if rel in MOVED else os.path.dirname(path)
    src = open(path, encoding='utf-8').read()
    changes = []

    def attr(m):
        name, quote, value = m.group(1), m.group(2), m.group(3)
        new = rewrite(value, base_dir)
        if new != value:
            changes.append((value, new))
            return f'{name}={quote}{new}{quote}'
        return m.group(0)

    out = re.sub(r'\b(' + '|'.join(ASSET_ATTRS) + r')=(["\'])([^"\']*)\2', attr, src)

    def css_url(m):
        quote, value = m.group(1), m.group(2)
        new = rewrite(value, base_dir)
        if new != value:
            changes.append((value, new))
            return f'url({quote}{new}{quote})'
        return m.group(0)

    out = re.sub(r'url\((["\']?)([^)"\']+)\1\)', css_url, out)

    if changes and not dry:
        open(path, 'w', encoding='utf-8').write(out)
    return changes


def main():
    dry = '--check' in sys.argv
    total = 0
    for root, _, files in os.walk(WEB):
        for f in sorted(files):
            if not f.endswith('.html'):
                continue
            p = os.path.join(root, f)
            ch = process(p, dry)
            if ch:
                total += len(ch)
                print(f'{os.path.relpath(p, WEB)}: {len(ch)} đường dẫn')
    print(('[--check] ' if dry else '') + f'Tổng: {total} đường dẫn.')


if __name__ == '__main__':
    main()
