"""Visit product detail pages in ONE dedicated tab (reused), extracting:
- description snippets from the listing
- specs visible on the page
- review snippets for pros/cons (neutral)
Politeness: 1.5s+ sleeps. STOP on captcha."""
import json
import re
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

OUT = "products-details.json"

with open("products-research.json", encoding="utf-8") as f:
    prods = json.load(f)

try:
    with open(OUT, encoding="utf-8") as f:
        details = {d["product_id"]: d for d in json.load(f)}
except (FileNotFoundError, json.JSONDecodeError):
    details = {}

c = CDP()
pages = c.get_pages()
# reuse a single tab: prefer an existing aliexpress item tab, else the portal tab
item_tabs = [p for p in pages if re.match(r"https://www\.aliexpress\.com/item/", p.get("url", ""))]
if item_tabs:
    tid = item_tabs[0]["targetId"]
else:
    any_ae = [p for p in pages if "aliexpress.com" in p.get("url", "")]
    if not any_ae:
        print("no aliexpress tab available")
        sys.exit(1)
    tid = any_ae[0]["targetId"]
print("detail tab:", c.send("Target.getTargetInfo", {"targetId": tid})["targetInfo"]["url"][:80])
sid = c.attach(tid)

DETAIL_JS = """
(() => {
  const out = {captcha: !!document.querySelector('[class*=captcha], [class*=Captcha]')};
  // product title
  const h = document.querySelector('h1');
  out.title = h ? h.textContent.trim() : '';
  // breadcrumb category
  const bc = [...document.querySelectorAll('[class*=breadcrumb] a, .breadcrumb a')].map(a => a.textContent.trim()).filter(Boolean);
  out.breadcrumb = bc.slice(0, 4);
  // specs table (key/value rows)
  const specs = {};
  for (const el of document.querySelectorAll('[class*=specification] [class*=item], [class*=specification] div')) {
    const t = el.textContent || '';
    const m = t.match(/^\\s*([A-Za-z][A-Za-z /-]{2,30})\\s*:\\s*(.{1,60})$/);
    if (m) specs[m[1].trim()] = m[2].trim().slice(0, 60);
  }
  // fallback: product-property list
  if (Object.keys(specs).length < 3) {
    for (const el of document.querySelectorAll('[class*=property] li, [class*=property] div')) {
      const t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
      const m = t.match(/^([A-Za-z][A-Za-z /]{2,30}):\\s*(.{1,60})$/);
      if (m) specs[m[1].trim()] = m[2].trim();
    }
  }
  out.specs = specs;
  // description: first paragraph-ish text from description module
  const desc = document.querySelector('[class*=product-description], [class*=description]');
  out.description = desc ? desc.innerText.replace(/\\s+/g, ' ').slice(0, 600) : '';
  // reviews: capture short review texts
  const reviews = [];
  for (const el of document.querySelectorAll('[class*=review] [class*=content], [class*=feedback] [class*=content], [class*=review-item]')) {
    const t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    if (t.length > 15 && t.length < 300 && !reviews.includes(t)) reviews.push(t);
    if (reviews.length >= 8) break;
  }
  out.reviews = reviews;
  // bullet feature list near the buy box
  const bullets = [];
  for (const el of document.querySelectorAll('[class*=highlight] li, [class*=feature] li')) {
    const t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    if (t.length > 5 && t.length < 200) bullets.push(t);
  }
  out.bullets = bullets.slice(0, 8);
  return JSON.stringify(out);
})()
"""

for i, p in enumerate(prods):
    pid = p["product_id"]
    if pid in details:
        continue
    url = f"https://www.aliexpress.com/item/{pid}.html"
    c.send("Page.navigate", {"url": url}, sid)
    time.sleep(7)
    r = json.loads(c.eval(sid, DETAIL_JS))
    if r.get("captcha"):
        print(f"CAPTCHA at product {i+1} ({pid}) — STOPPING. Navigate manually and rerun.")
        break
    details[pid] = {"product_id": pid, **r}
    print(f"{i+1}/{len(prods)} {pid}: specs={len(r['specs'])} reviews={len(r['reviews'])} desc={'Y' if r['description'] else 'N'}")
    if (i + 1) % 5 == 0 or i == len(prods) - 1:
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(list(details.values()), f, ensure_ascii=False, indent=1)
    time.sleep(1.5)

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(list(details.values()), f, ensure_ascii=False, indent=1)
print(f"saved {len(details)} detail records")
