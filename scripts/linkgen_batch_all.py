"""Same tab: generate tracking links for ALL 43 products, US/UK ship-to.
The tracking link appears as a text node 'https://s.click.aliexpress.com/...'."""
import json
import re
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

with open("products-research.json", encoding="utf-8") as f:
    prods = json.load(f)

c = CDP()
pages = c.get_pages()
gen = [p for p in pages if "link_generator" in p.get("url", "")]
tid = gen[0]["targetId"]
sid = c.attach(tid)

results_path = "products-links.json"
try:
    with open(results_path, encoding="utf-8") as f:
        results = {r["product_id"]: r for r in json.load(f)}
except (FileNotFoundError, json.JSONDecodeError):
    results = {}

EXTRACT_JS = """
(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode.textContent.trim();
    const m = t.match(/^https:\\/\\/s\\.click\\.aliexpress\\.com\\/[\\w/-]+$/);
    if (m) return m[0];
  }
  return null;
})()
"""
ERR_JS = "document.body.innerText.includes('cannot be sold or promoted')"

for i, p in enumerate(prods):
    pid = p["product_id"]
    if pid in results and (results[pid]["link"] or results[pid]["blocked"]):
        continue
    c.eval(sid, f"""
(() => {{
  const ta = document.getElementById('targetUrl');
  const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
  proto.set.call(ta, 'https://www.aliexpress.com/item/{pid}.html');
  ta.dispatchEvent(new Event('input', {{bubbles: true}}));
}})()
""")
    time.sleep(0.5)
    c.eval(sid, """
(() => {
  const btn = [...document.querySelectorAll('*')].filter(e =>
    e.children.length === 0 && /^Get Tracking Link$/.test((e.textContent || '').trim()));
  btn[0].click();
})()
""")
    time.sleep(7)

    link = c.eval(sid, EXTRACT_JS)
    if not link:
        time.sleep(5)
        link = c.eval(sid, EXTRACT_JS)
    blocked = c.eval(sid, ERR_JS)
    results[pid] = {"product_id": pid, "link": link, "blocked": bool(blocked)}
    print(f"{i+1}/{len(prods)} {pid}: {'OK ' + link if link else ('BLOCKED' if blocked else 'NO LINK')}")

    # save periodically
    if (i + 1) % 5 == 0 or i == len(prods) - 1:
        with open(results_path, "w", encoding="utf-8") as f:
            json.dump(list(results.values()), f, ensure_ascii=False, indent=1)
    time.sleep(1)

ok = [r for r in results.values() if r["link"]]
blocked = [r for r in results.values() if r["blocked"]]
print(f"\ndone: {len(ok)} links, {len(blocked)} blocked, {len(results) - len(ok) - len(blocked)} no-link")
