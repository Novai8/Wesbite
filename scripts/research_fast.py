"""Fast research: find 10 NEW products (not in existing seed) from bestseller pages."""
import json
import re
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

c = CDP()
pages = c.get_pages()
tab = [p for p in pages if "aliexpress.com" in p.get("url", "")]
tid = tab[0]["targetId"]
sid = c.attach(tid)

EXTRA = set()
with open("products-research.json", encoding="utf-8") as f:
    for p in json.load(f):
        EXTRA.add(p["product_id"])
with open("products-research-raw.json", encoding="utf-8") as f:
    for p in json.load(f):
        EXTRA.add(p.get("product_id", ""))

JS = """
(() => {
  const out = [];
  for (const a of document.querySelectorAll('a[href*="/item/"]')) {
    const m = a.href.match(/item\\/(\\d{6,})\\.html/);
    if (!m) continue;
    const card = a.closest('div');
    const scope = a.closest('[class*=card], [class*=item], li, article') || a.parentElement?.parentElement || a;
    const txt = (scope.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 400);
    const priceM = txt.match(/[Rr]s\\.?\\s?([\\d,]+(?:\\.\\d{1,2})?)/);
    const oldM = txt.match(/[Rr]s\\.?\\s?([\\d,]+(?:\\.\\d{1,2})?)\\s*[\\u20b9|Rs]/) || null;
    const ordM = txt.match(/([\\d.,]+K?\\+?)\\s*sold/i);
    const rM = txt.match(/([\\d.]+)\\s*stars?/i) || txt.match(/\\b([45]\\.\\d)\\b/);
    const img = scope.querySelector('img[src*="aliexpress"], img[src*="alicdn"], img');
    out.push({
      product_id: m[1],
      url: 'https://www.aliexpress.com/item/' + m[1] + '.html',
      title: (a.getAttribute('title') || a.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 250),
      price_pkr: priceM ? parseFloat(priceM[1].replace(/,/g, '')) : null,
      original_price_pkr: null,
      orders: ordM ? ordM[1] + ' sold' : null,
      rating: rM ? parseFloat(rM[1]) : null,
      image: img ? (img.currentSrc || img.src) : null
    });
  }
  return JSON.stringify(out);
})()
"""

found = {}
searches = [
    ("https://www.aliexpress.com/w/wholesale-gaming.html?SortType=orders_desc", "gaming"),
    ("https://www.aliexpress.com/w/wholesale-organizer.html?SortType=orders_desc", "organizer"),
    ("https://www.aliexpress.com/w/wholesale-kitchen-gadget.html?SortType=orders_desc", "kitchen"),
    ("https://www.aliexpress.com/w/wholesale-travel-accessories.html?SortType=orders_desc", "travel"),
    ("https://www.aliexpress.com/w/wholesale-stationery.html?SortType=orders_desc", "stationery"),
]

for si, (url, q) in enumerate(searches):
    if len(found) >= 10:
        break
    c.send("Page.navigate", {"url": url}, sid)
    time.sleep(3.5)
    try:
        raw = c.eval(sid, JS)
        items = json.loads(raw)
    except Exception as e:
        print("parse err", si, e)
        continue
    for it in items:
        pid = it["product_id"]
        if pid in EXTRA or pid in found:
            continue
        if not it["price_pkr"] or not it["image"]:
            continue
        it["search_query"] = q
        it["collected_at"] = "2026-11-21"
        found[pid] = it
    print(f"search {si+1} ({q}): unique {len(found)}")
    time.sleep(1)

new = list(found.values())[:10]
with open("products-research-new.json", "w", encoding="utf-8") as f:
    json.dump(new, f, ensure_ascii=False, indent=1)
print(f"saved {len(new)} new products")
for n in new:
    print(" ", n["product_id"], n["price_pkr"], n["title"][:60])
