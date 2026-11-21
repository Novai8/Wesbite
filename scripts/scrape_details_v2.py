"""Detail scrape v2 — correct selectors for aliexpress product pages.
Classes: specification--line (prop/desc pairs), description--wrap,
list--itemDesc (review texts), reviewer--reviews (ratings count).
Run after scrape_details.py finishes; overwrites thin records."""
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
item = [p for p in pages if "aliexpress" in p.get("url", "")]
tid = item[0]["targetId"]
sid = c.attach(tid)

DETAIL_JS = """
(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : '');
  const out = {captcha: /captcha|access denied|verify/i.test(document.title)};

  out.title = text(document.querySelector('h1'));

  // specs: specification--line has prop + desc children
  const specs = {};
  for (const line of document.querySelectorAll('[class*=specification--line]')) {
    const p = line.querySelector('[class*=specification--prop]');
    const d = line.querySelector('[class*=specification--desc]');
    if (p && d) {
      const key = text(p).replace(/:$/, '');
      const val = text(d).slice(0, 80);
      if (key && val && key.length < 40) specs[key] = val;
    }
  }
  // fallback: "Key: value" pairs in any property list
  if (Object.keys(specs).length === 0) {
    for (const el of document.querySelectorAll('[class*=property], [class*=sku-item--property]')) {
      const t = text(el);
      const m = t.match(/^([A-Za-z][A-Za-z /]{2,30}):\\s*(.{1,80})$/);
      if (m) specs[m[1].trim()] = m[2].trim();
    }
  }
  out.specs = specs;

  // description module: text below the "Description" tab content
  const descWrap = document.querySelector('[class*=description--wrap]');
  out.description = descWrap ? text(descWrap).slice(0, 800) : '';

  // review texts: list--itemDesc
  const reviews = [];
  for (const el of document.querySelectorAll('[class*=list--itemDesc]')) {
    const t = text(el);
    if (t.length > 20 && t.length < 400 && !reviews.includes(t)) reviews.push(t);
    if (reviews.length >= 10) break;
  }
  out.reviews = reviews;

  // rating tagline chips e.g. "very sturdy (36)"
  const chips = [];
  const bodyText = document.body.innerText;
  for (const m of bodyText.matchAll(/([a-z][a-z ]{4,30})\\((\\d{2,})\\)/g)) {
    chips.push(m[1].trim() + ' (' + m[2] + ')');
    if (chips.length >= 8) break;
  }
  out.chips = [...new Set(chips)];

  // bullets from "More to love" section
  const mtl = text(document.querySelector('[class*=more-to-love], [class*=moreToLove]'));
  out.moreToLove = mtl.slice(0, 400);
  return JSON.stringify(out);
})()
"""

for i, p in enumerate(prods):
    pid = p["product_id"]
    url = f"https://www.aliexpress.com/item/{pid}.html"
    c.send("Page.navigate", {"url": url}, sid)
    time.sleep(7)
    raw = c.eval(sid, DETAIL_JS)
    try:
        r = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        r = {"product_id": pid, "error": "parse"}
    if r.get("captcha"):
        print(f"CAPTCHA at {i+1} ({pid}) - STOP. Rerun later.")
        break
    details[pid] = {"product_id": pid, **r}
    print(f"{i+1}/{len(prods)} {pid}: specs={len(r.get('specs', {}))} reviews={len(r.get('reviews', []))} chips={len(r.get('chips', []))}")
    if (i + 1) % 5 == 0 or i == len(prods) - 1:
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(list(details.values()), f, ensure_ascii=False, indent=1)
    time.sleep(1.5)

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(list(details.values()), f, ensure_ascii=False, indent=1)
print(f"saved {len(details)}")
