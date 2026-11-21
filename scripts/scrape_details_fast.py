"""Detail scrape v3 — capture actual review TEXT and clean specs.
The review text sits in the same review-item container as list--itemDesc;
the desc element holds meta (author/date). Grab the sibling element."""
import json
import re
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

OUT = "products-details-new.json"

with open("products-research-new.json", encoding="utf-8") as f:
    prods = json.load(f)

with open(OUT, encoding="utf-8") as f:
    details = {d["product_id"]: d for d in json.load(f)}

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

  // review items: find containers that include both meta and text
  const reviews = [];
  const items = document.querySelectorAll('[class*=list--item], [class*=review-item], [class*=feedback]');
  for (const it of items) {
    const t = text(it);
    // skip meta-only or huge containers
    if (t.length < 30 || t.length > 500) continue;
    // remove trailing meta like 'Helpful (12)' 'Review for similar item'
    const cleaned = t.replace(/\\|?\\s*Review for similar item/g, '')
      .replace(/Helpful \\(\\d+\\)/g, '')
      .replace(/[a*\\w]* ?\\| ?\\d{1,2} \\w{3} \\d{4}/g, '')
      .replace(/AliExpress Shopper/g, '')
      .replace(/^\\s*[A-Z]?\\*{1,3}\\w?\\s*\\|?\\s*/g, '')
      .replace(/\\s{2,}/g, ' ').trim();
    if (cleaned.length > 25 && !reviews.includes(cleaned)) reviews.push(cleaned);
    if (reviews.length >= 8) break;
  }
  out.reviews = reviews;

  // chips with full words: fix the clipped 'eviews' issue by matching from body text
  const bodyText = document.body.innerText;
  const chips = [];
  for (const m of bodyText.matchAll(/([a-zA-Z][a-zA-Z ]{3,35}) \\((\\d{2,})\\)/g)) {
    const label = m[1].trim().toLowerCase();
    if (/ratings|reviews|purchases/.test(label)) continue;
    chips.push(label + ' (' + m[2] + ')');
    if (chips.length >= 10) break;
  }
  out.chips = [...new Set(chips)];

  // specs cleaned: split concatenated key like 'MaterialAluminum alloy'
  const specs = {};
  for (const line of document.querySelectorAll('[class*=specification--line]')) {
    const full = text(line);
    const m = full.match(/^([A-Za-z][A-Za-z -]{2,35})([A-Z].*)$/);
    if (m) specs[m[1].trim()] = m[2].trim().slice(0, 80);
    else if (full.length < 100) specs[full.slice(0, 35)] = full.slice(35, 80);
  }
  // property-style rows from the feature module
  for (const el of document.querySelectorAll('[class*=sku-item--property]')) {
    const t = text(el);
    if (t && t.length < 40) specs['option:' + t] = t;
  }
  out.specs = specs;

  // description: after the Description heading, page body text
  const idx = bodyText.indexOf('More to love');
  const dIdx = bodyText.search(/Description\\s*report/i);
  if (dIdx >= 0) {
    const seg = bodyText.slice(dIdx + 12, dIdx + 700).replace(/report\\s*View more/, '').trim();
    out.description = seg.slice(0, 500);
  } else {
    out.description = '';
  }
  return JSON.stringify(out);
})()
"""

for i, p in enumerate(prods):
    pid = p["product_id"]
    url = f"https://www.aliexpress.com/item/{pid}.html"
    c.send("Page.navigate", {"url": url}, sid)
    time.sleep(4.5)
    raw = c.eval(sid, DETAIL_JS)
    try:
        r = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        r = {"error": "parse"}
    if r.get("captcha"):
        print(f"CAPTCHA at {i+1} ({pid}) - STOP. Rerun later.")
        break
    prev = details.get(pid, {})
    details[pid] = {"product_id": pid, **r,
                    "chips": r.get("chips") or prev.get("chips", []),
                    "title": r.get("title") or prev.get("title", "")}
    print(f"{i+1}/{len(prods)} {pid}: specs={len(r.get('specs', {}))} reviews={len(r.get('reviews', []))} chips={len(details[pid]['chips'])}")
    if (i + 1) % 5 == 0 or i == len(prods) - 1:
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(list(details.values()), f, ensure_ascii=False, indent=1)
    time.sleep(0.8)

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(list(details.values()), f, ensure_ascii=False, indent=1)
print(f"saved {len(details)}")
