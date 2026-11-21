"""Batch 3: research 50 NEW hot products, one tab, fast."""
import json
import re
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

EXTRA = set(json.load(open("scripts/existing-ids.json", encoding="utf-8")))

c = CDP()
pages = c.get_pages()
tab = [p for p in pages if "aliexpress" in p.get("url", "")][0]
sid = c.attach(tab["targetId"])

JS = """
(() => {
  const out = [];
  const seen = new Set();
  for (const a of document.querySelectorAll('a[href*="/item/"]')) {
    const m = a.href.match(/item\\/(\\d{6,})\\.html/);
    if (!m || seen.has(m[1])) continue;
    seen.add(m[1]);
    const scope = a.closest('[class*=card], li, article') || a.parentElement?.parentElement || a;
    const txt = (scope.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 400);
    const prices = [...txt.matchAll(/[Rr]s\\.?\\s?([\\d,]+(?:\\.\\d{1,2})?)/g)].map(x => parseFloat(x[1].replace(/,/g, '')));
    if (!prices.length) continue;
    const ordM = txt.match(/([\\d.,]+\\+?)\\s*sold/i);
    const rM = txt.match(/\\b([45]\\.\\d)\\b/);
    const img = scope.querySelector('img[src*="aliexpress"], img[src*="alicdn"], img');
    out.push({
      product_id: m[1],
      url: 'https://www.aliexpress.com/item/' + m[1] + '.html',
      title: (a.getAttribute('title') || a.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 250),
      price_pkr: Math.min(...prices),
      original_price_pkr: prices.length > 1 ? Math.max(...prices) : null,
      orders: ordM ? ordM[1] + ' sold' : null,
      rating: rM ? parseFloat(rM[1]) : null,
      image: img ? (img.currentSrc || img.src) : null
    });
  }
  return JSON.stringify(out);
})()
"""

SEARCHES = [
    ("https://www.aliexpress.com/w/wholesale-phone-holder.html?SortType=orders_desc&page=2", "desk-setup"),
    ("https://www.aliexpress.com/w/wholesale-kitchen-organizer.html?SortType=orders_desc", "kitchen-utility"),
    ("https://www.aliexpress.com/w/wholesale-storage-bag.html?SortType=orders_desc", "storage-organisation"),
    ("https://www.aliexpress.com/w/wholesale-pencil-case.html?SortType=orders_desc", "study-stationery"),
    ("https://www.aliexpress.com/w/wholesale-travel-bottle.html?SortType=orders_desc", "travel-accessories"),
    ("https://www.aliexpress.com/w/wholesale-cup.html?SortType=orders_desc", "kitchen-utility"),
    ("https://www.aliexpress.com/w/wholesale-keychain.html?SortType=orders_desc", "travel-accessories"),
    ("https://www.aliexpress.com/w/wholesale-book-end.html?SortType=orders_desc", "study-stationery"),
    ("https://www.aliexpress.com/w/wholesale-cable-clip.html?SortType=orders_desc", "storage-organisation"),
    ("https://www.aliexpress.com/w/wholesale-kitchen-tools.html?SortType=orders_desc", "kitchen-utility"),
    ("https://www.aliexpress.com/w/wholesale-hanger.html?SortType=orders_desc", "storage-organisation"),
    ("https://www.aliexpress.com/w/wholesale-backpack-organizer.html?SortType=orders_desc", "travel-accessories"),
    ("https://www.aliexpress.com/w/wholesale-sticky-notes.html?SortType=orders_desc", "study-stationery"),
    ("https://www.aliexpress.com/w/wholesale-desk-lamp.html?SortType=orders_desc", "desk-setup"),
    ("https://www.aliexpress.com/w/wholesale-food-container.html?SortType=orders_desc", "kitchen-utility"),
    ("https://www.aliexpress.com/w/wholesale-power-strip.html?SortType=orders_desc", "desk-setup"),
    ("https://www.aliexpress.com/w/wholesale-makeup-organizer.html?SortType=orders_desc", "storage-organisation"),
    ("https://www.aliexpress.com/w/wholesale-bookmark.html?SortType=orders_desc", "study-stationery"),
    ("https://www.aliexpress.com/w/wholesale-drawer-organizer.html?SortType=orders_desc", "storage-organisation"),
    ("https://www.aliexpress.com/w/wholesale-socks-organizer.html?SortType=orders_desc", "storage-organisation"),
]

found = {}
for si, (url, cat) in enumerate(SEARCHES):
    if len(found) >= 104:
        break
    c.send("Page.navigate", {"url": url}, sid)
    time.sleep(3.2)
    try:
        items = json.loads(c.eval(sid, JS))
    except Exception as e:
        print("parse err", si, str(e)[:60])
        continue
    added = 0
    for it in items:
        pid = it["product_id"]
        if pid in EXTRA or pid in found:
            continue
        if not it["price_pkr"] or not it["image"]:
            continue
        it["category_guess"] = cat
        it["search_query"] = url.split("wholesale-")[1].split(".html")[0]
        it["collected_at"] = "2026-11-21"
        found[pid] = it
        added += 1
    print(f"{si+1}/{len(SEARCHES)} {url.split('wholesale-')[1].split('.')[0]}: +{added} -> {len(found)}")

new = list(found.values())[:104]
json.dump(new, open("products-research-b4.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
from collections import Counter
print(f"saved {len(new)}")
print(Counter(p["category_guess"] for p in new))
