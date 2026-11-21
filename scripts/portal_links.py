"""Find Featured Products / campaign links on the affiliate portal."""
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

c = CDP()
pages = c.get_pages()
tid = [p["targetId"] for p in pages if "portals.aliexpress" in p.get("url", "")][0]
sid = c.attach(tid)
time.sleep(2)

js = """
(() => {
  const links = [...document.querySelectorAll('a')];
  const pick = (re) => links.filter(a => re.test(a.innerText))
    .map(a => (a.href || 'nohref') + ' | ' + a.innerText.trim().slice(0, 60));
  return JSON.stringify({
    featured: pick(/featured products/i),
    campaigns: pick(/bestseller|black friday|cyber monday|promote/i),
    tools: pick(/link generator|code center|tools/i)
  }, null, 1);
})()
"""
print(c.eval(sid, js))
