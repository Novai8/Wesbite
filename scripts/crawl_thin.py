"""Third crawl pass — more searches for thin categories."""
import json
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

RAW_PATH = "products-research-raw.json"

SEARCHES = [
    ("kitchen-utility", "insulated water bottle"),
    ("kitchen-utility", "food storage container"),
    ("kitchen-utility", "knife sharpener"),
    ("study-stationery", "gel pen"),
    ("study-stationery", "desk organizer pen holder"),
    ("travel-accessories", "toiletry bag"),
    ("travel-accessories", "luggage tag"),
    ("storage-organisation", "drawer organizer"),
    ("storage-organisation", "hanging organizer"),
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
    with open(RAW_PATH, encoding="utf-8") as f:
        all_products = {p["product_id"]: p for p in json.load(f)}

    c = CDP()
    for cat, query in SEARCHES:
        url = f"https://www.aliexpress.com/w/wholesale-{query.replace(' ', '-')}.html?SortType=orders_desc"
        print(f"== [{cat}] {query}")
        try:
            tid = c.new_tab(url)
            time.sleep(9)
            sid = c.attach(tid)
            cards = json.loads(c.eval(sid, CARD_JS))
            meta = {m["id"]: m for m in json.loads(c.eval(sid, PRICE_JS))}
            time.sleep(1)
            c.send("Target.closeTarget", {"targetId": tid})
        except Exception as e:
            print("   error:", e)
            continue

        added = 0
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
            added += 1
        print(f"   +{added}, total: {len(all_products)}")

    with open(RAW_PATH, "w", encoding="utf-8") as f:
        json.dump(list(all_products.values()), f, ensure_ascii=False, indent=1)
    print(f"\nSaved {len(all_products)} total")


if __name__ == "__main__":
    main()
