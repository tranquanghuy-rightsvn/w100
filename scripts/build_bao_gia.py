#!/usr/bin/env python3
"""Chuyển baogiatonghop.csv (cột: STT, Ngành, Báo giá, Review) thành worker/bao-gia.json
cho API /bao-gia/<nganh> (worker/index.js).

Chạy:  python3 scripts/build_bao_gia.py            (đọc baogiatonghop.csv ở thư mục web100)
       python3 scripts/build_bao_gia.py duong/dan/file.csv

Mỗi ô "Báo giá" là nhiều khối:
    Giá 2tr5:
    https://a.com/
    https://b.com/
Parser chịu được các dạng lệch: "3tr5" (thiếu chữ Giá), "Gias 3tr" (gõ nhầm),
"1. https://..." (đánh số), dòng trống thừa. Dòng không hiểu được sẽ in cảnh báo, không dừng.
"""
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "baogiatonghop.csv"
OUT_PATH = ROOT / "worker" / "bao-gia.json"
RULES_PATH = ROOT / "quy-tac-ai.md"  # phụ lục danh sách ngành ở cuối file được ghi đè mỗi lần build
RULES_MARK = "## Phụ lục: danh sách ngành (STT | slug | tên)"

RE_PRICE = re.compile(r"^(?:gi[aá]s?\s*)?(\d+)\s*tr\s*(\d)?\s*:?\s*$", re.IGNORECASE)
RE_URL = re.compile(r"^(?:\d+\s*[.)]\s*)?(https?://\S+)\s*$")


def slugify(text: str) -> str:
    """'Cửa hàng xe máy điện' -> 'cua-hang-xe-may-dien' (đ -> d, bỏ dấu, chỉ a-z0-9 và '-')."""
    text = text.replace("Đ", "D").replace("đ", "d")
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^a-z0-9]+", "-", text.lower())
    return text.strip("-")


def parse_prices(stt: str, raw: str):
    """Trả về list [{gia, gia_vnd, url}] theo đúng thứ tự trong CSV."""
    items = []
    gia = None
    gia_vnd = None
    for line in raw.splitlines():
        s = line.strip()
        if not s:
            continue
        m = RE_PRICE.match(s)
        if m:
            trieu = int(m.group(1))
            le = int(m.group(2)) if m.group(2) else 0
            gia = f"{trieu}tr{le}" if le else f"{trieu}tr"
            gia_vnd = trieu * 1_000_000 + le * 100_000
            continue
        m = RE_URL.match(s)
        if m:
            if gia is None:
                print(f"  [STT {stt}] URL trước khi có mức giá, bỏ qua: {s}", file=sys.stderr)
                continue
            items.append({"gia": gia, "gia_vnd": gia_vnd, "url": m.group(1)})
            continue
        print(f"  [STT {stt}] Không hiểu dòng: {s!r}", file=sys.stderr)
    return items


def main():
    csv.field_size_limit(10**8)
    with open(CSV_PATH, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    nganh_list = []
    seen_slug = {}
    for r in rows:
        ten = " ".join(r["Ngành"].split())  # gọn khoảng trắng thừa
        if not ten:
            continue
        slug = slugify(ten)
        if slug in seen_slug:
            print(f"  Trùng slug {slug!r}: STT {seen_slug[slug]} và {r['STT']}", file=sys.stderr)
            slug = f"{slug}-{r['STT']}"
        seen_slug[slug] = r["STT"]
        bang_gia = parse_prices(r["STT"], r["Báo giá"])
        if not bang_gia:
            print(f"  [STT {r['STT']}] {ten}: không có mức giá nào", file=sys.stderr)
        gias = [x["gia_vnd"] for x in bang_gia]
        nganh_list.append({
            "stt": int(r["STT"]),
            "ten": ten,
            "slug": slug,
            "gia_thap_nhat": min(gias) if gias else None,
            "gia_cao_nhat": max(gias) if gias else None,
            "bang_gia": bang_gia,
        })

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(nganh_list, f, ensure_ascii=False, indent=1)
    tong_url = sum(len(n["bang_gia"]) for n in nganh_list)
    print(f"OK: {len(nganh_list)} ngành, {tong_url} URL -> {OUT_PATH.relative_to(ROOT)}")

    # Cập nhật phụ lục trong quy-tac-ai.md để danh sách AI học luôn khớp dữ liệu API.
    if RULES_PATH.exists():
        md = RULES_PATH.read_text(encoding="utf-8")
        if RULES_MARK in md:
            head = md.split(RULES_MARK)[0]
            lines = [f"{n['stt']} | {n['slug']} | {n['ten']}" for n in nganh_list]
            body = (f"{RULES_MARK}\n\n{len(nganh_list)} ngành, sinh tự động bởi "
                    f"`scripts/build_bao_gia.py`, không sửa tay.\n\n```\n" + "\n".join(lines) + "\n```\n")
            RULES_PATH.write_text(head + body, encoding="utf-8")
            print(f"OK: cập nhật phụ lục {RULES_PATH.name}")


if __name__ == "__main__":
    main()
