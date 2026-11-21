"""Batch 3 link generation: 52 products, one tab, 4s waits, incremental save."""
import json
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

prods = json.load(open("products-research-b3.json", encoding="utf-8"))

c = CDP()
pages = c.get_pages()
tab = [p for p in pages if "aliexpress" in p.get("url", "")]
sid = c.attach(tab[0]["targetId"])

# go to link generator (may already be there)
c.send("Page.navigate", {"url": "https://portals.aliexpress.com/affiportals/web/link_generator.htm"}, sid)
time.sleep(4)

SET_URL = """(() => {{
  const el = document.getElementById('targetUrl');
  if (!el) return 'NO_INPUT';
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set;
  setter.call(el, '{u}');
  el.dispatchEvent(new Event('input', {{bubbles: true}}));
  return 'SET';
}})()"""

CLICK = """(() => {
  const btn = [...document.querySelectorAll('*')].filter(e =>
    e.children.length === 0 && /^Get Tracking Link$/.test((e.textContent || '').trim()));
  if (btn[0]) btn[0].click();
})()"""

GET_LINK = """(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode.textContent.trim();
    const m = t.match(/^https:\\/\\/s\\.click\\.aliexpress\\.com\\/[\\w/-]+$/);
    if (m) return m[0];
  }
  return null;
})()"""

ERR_JS = "document.body.innerText.includes('cannot be sold or promoted') || document.body.innerText.includes(\"can't be used to generate links\")"

results = []
for i, p in enumerate(prods):
    r = c.eval(sid, SET_URL.format(u=p["url"]))
    if r == "NO_INPUT":
        time.sleep(2)
        c.eval(sid, SET_URL.format(u=p["url"]))
    time.sleep(0.4)
    c.eval(sid, CLICK)
    time.sleep(4)
    link = c.eval(sid, GET_LINK)
    blocked = c.eval(sid, ERR_JS)
    results.append({"product_id": p["product_id"], "link": link, "blocked": bool(blocked)})
    print(f"{i+1}/52 {p['product_id'][-6:]}: {'OK' if link else ('BLOCKED' if blocked else 'no-link')}")
    if (i + 1) % 10 == 0 or i == len(prods) - 1:
        json.dump(results, open("products-links-b3.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

ok = sum(1 for r in results if r["link"])
print(f"links: {ok}/{len(results)}")
