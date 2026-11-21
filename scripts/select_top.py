"""Select top 50 products balanced across categories, convert PKR to USD."""
import json
import re
from datetime import date

RAW_PATH = "products-research-raw.json"
OUT_PATH = "products-research.json"

USD_PKR = 276.460596  # open.er-api.com, 2026-11-21

with open(RAW_PATH, encoding="utf-8") as f:
    products = json.load(f)


def orders_num(s):
    if not s:
        return 0
    digits = re.sub(r"[,+]", "", s.replace(" sold", "").replace(" sold", "").strip())
    try:
        return int(digits)
    except ValueError:
        return 0


# clean titles: strip algorithmic junk, keep the human-readable head
def clean_title(t):
    t = re.sub(r"\s+", " ", t).strip()
    # cut at common junk markers
    for marker in [" 4.9", " 4.8", " 4.7", " 4.6", " 5.0"]:
        idx = t.find(marker)
        if idx > 20:
            t = t[:idx]
    return t[:140].strip()


# score: orders desc, then rating
for p in products:
    p["_orders_n"] = orders_num(p.get("orders"))
    p["_rating_f"] = float(p["rating"]) if p.get("rating") else 0
    p["title_clean"] = clean_title(p.get("title") or p["raw_text"].split("\n")[0])

# balance: take top 8-9 per category by orders
by_cat = {}
for p in products:
    by_cat.setdefault(p["category_guess"], []).append(p)

selected = []
for cat, plist in sorted(by_cat.items()):
    plist.sort(key=lambda p: (p["_orders_n"], p["_rating_f"]), reverse=True)
    quota = 9 if cat in ("desk-setup", "gaming") else 8
    selected.extend(plist[:quota])

# trim / top up to exactly 50 by global order count
selected.sort(key=lambda p: (p["_orders_n"], p["_rating_f"]), reverse=True)
final = selected[:50]

out = []
today = date.today().isoformat()
for p in final:
    price_usd = round(p["price_pkr"] / USD_PKR, 2)
    orig_usd = round(p["original_price_pkr"] / USD_PKR, 2) if p.get("original_price_pkr") else None
    if orig_usd is not None and orig_usd <= price_usd:
        orig_usd = None
    out.append({
        "product_id": p["product_id"],
        "url": p["href"],
        "title": p["title_clean"],
        "raw_text": p.get("raw_text"),
        "image": p.get("image"),
        "category_guess": p["category_guess"],
        "search_query": p["search_query"],
        "price_pkr": p["price_pkr"],
        "original_price_pkr": p.get("original_price_pkr"),
        "price_usd": price_usd,
        "original_price_usd": orig_usd,
        "rating": p.get("rating"),
        "orders": p.get("orders"),
        "discount_pct": p.get("discount_pct"),
        "usd_pkr_rate": USD_PKR,
        "collected_at": today,
    })

with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)

from collections import Counter
print("total:", len(out))
print(Counter(p["category_guess"] for p in out))
print("\nsample:")
for p in out[:5]:
    print(f"  {p['title'][:70]} | ${p['price_usd']} | {p['orders']} sold | {p['rating']}")
