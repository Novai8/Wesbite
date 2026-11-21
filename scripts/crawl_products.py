"""Crawl AliExpress bestsellers across Fyndra categories via the user's Chrome.

Collects product cards from search pages (SortType=orders_desc), dedupes by
product id, saves raw data to products-research-raw.json.
"""
import json
import re
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

RAW_PATH = "products-research-raw.json"

# One or two search terms per Fyndra category.
SEARCHES = [
    ("desk-setup", "monitor arm"),
    ("desk-setup", "laptop stand"),
    ("desk-setup", "desk mat"),
    ("gaming", "gaming controller"),
    ("gaming", "gaming mouse"),
    ("gaming", "gaming headset"),
    ("storage-organisation", "storage organizer box"),
    ("storage-organisation", "shelf storage"),
    ("study-stationery", "notebook"),
    ("study-stationery", "pen set"),
    ("travel-accessories", "packing cube"),
    ("travel-accessories", "cable organizer"),
    ("kitchen-utility", "kitchen gadget"),
    ("kitchen-utility", "water bottle"),
    ("kitchen-utility", "phone holder"),
]

CARD_JS = """
(() => {
  const seen = new Map();
  for (const a of document.querySelectorAll('a[href*="/item/"]')) {
    const m = a.href.match(/\\/item\\/(\\d+)\\.html/);
    if (!m) continue;
    const id = m[1];
    if (seen.has(id)) continue;
    const text = (a.innerText || '').trim();
    if (!text) continue;
    // main image
    let img = '';
    const imgEl = a.querySelector('img');
    if (imgEl) img = imgEl.src || imgEl.getAttribute('data-src') || '';
    seen.set(id, {
      product_id: id,
      href: 'https://www.aliexpress.com/item/' + id + '.html',
      title: text.split('\\n').filter(l => l.trim() && !/^Rs\\./.test(l.trim())
        && !/^PKR/.test(l.trim()) && !/^[\\d.]+$/.test(l.trim())).slice(0, 2).join(' '),
      raw_text: text.slice(0, 400),
      image: img
    });
  }
  return JSON.stringify([...seen.values()]);
})()
"""

PRICE_JS = """
(() => {
  const out = [];
  for (const a of document.querySelectorAll('a[href*="/item/"]')) {
    const m = a.href.match(/\\/item\\/(\\d+)\\.html/);
    if (!m) continue;
    const t = (a.innerText || '');
    const prices = [...t.matchAll(/Rs\\.?\\s*([\\d,]+\\.?\\d*)/g)].map(x => parseFloat(x[1].replace(/,/g, '')));
    const rating = (t.match(/(^|\\n)([0-5]\\.\\d)(\\n|$)/) || [])[2] || null;
    const orders = (t.match(/([\\d,]+\\+)\\s*sold/i) || (t.match(/([\\d,]+)\\s*sold/i)) || [])[1] || null;
    const pct = (t.match(/-(\\d+)%/) || [])[1] || null;
    out.push({ id: m[1], prices, rating, orders, discountPct: pct });
  }
  return JSON.stringify(out);
})()
"""


def main():
    c = CDP()
    all_products = {}

    for cat, query in SEARCHES:
        if len(all_products) >= 50:
            break
        url = f"https://www.aliexpress.com/w/wholesale-{query.replace(' ', '-')}.html?SortType=orders_desc"
        print(f"== [{cat}] {query}")
        try:
            tid = c.new_tab(url)
            time.sleep(9)
            sid = c.attach(tid)
            cards_raw = c.eval(sid, CARD_JS)
            cards = json.loads(cards_raw)
            meta_raw = c.eval(sid, PRICE_JS)
            meta = {m["id"]: m for m in json.loads(meta_raw)}
            time.sleep(1)
            c.send("Target.closeTarget", {"targetId": tid})
        except Exception as e:
            print("   error:", e)
            continue

        for card in cards:
            pid = card["product_id"]
            if pid in all_products:
                continue
            m = meta.get(pid, {})
            prices = [p for p in m.get("prices", []) if p > 0]
            if not prices:
                continue
            price = min(prices)
            original = max(prices) if max(prices) > price else None
            all_products[pid] = {
                **card,
                "category_guess": cat,
                "search_query": query,
                "price_pkr": price,
                "original_price_pkr": original,
                "rating": m.get("rating"),
                "orders": m.get("orders"),
                "discount_pct": m.get("discountPct"),
            }

        print(f"   total unique: {len(all_products)}")

    with open(RAW_PATH, "w", encoding="utf-8") as f:
        json.dump(list(all_products.values()), f, ensure_ascii=False, indent=1)
    print(f"\nSaved {len(all_products)} products to {RAW_PATH}")


if __name__ == "__main__":
    main()
