"""Same tab: test real product IDs from products-research.json through US/UK ship-to."""
import json
import re
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

with open("products-research.json", encoding="utf-8") as f:
    prods = json.load(f)
# first 10 test ids
TEST = prods[:10]

c = CDP()
pages = c.get_pages()
gen = [p for p in pages if "link_generator" in p.get("url", "")]
tid = gen[0]["targetId"]
sid = c.attach(tid)

results = {}
for p in TEST:
    pid = p["product_id"]
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
    time.sleep(8)
    txt = c.eval(sid, "document.body.innerText")
    m = re.search(r"Tracking Link:\s*\n\s*(https?://\S+)", txt)
    err = "cannot be sold or promoted" in txt
    link = m.group(1).strip() if m else None
    results[pid] = {"link": link, "blocked": err}
    print(f"{pid}: link={link} blocked={err}")
    time.sleep(1)

ok = [k for k, v in results.items() if v["link"]]
print(f"\n{len(ok)}/{len(TEST)} generated tracking links")
