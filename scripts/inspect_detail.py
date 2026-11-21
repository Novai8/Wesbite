"""Inspect one product detail page structure to fix selectors."""
import json
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

c = CDP()
pages = c.get_pages()
item = [p for p in pages if "aliexpress.com/item/" in p.get("url", "") or "aliexpress" in p.get("url", "")]
tid = item[0]["targetId"]
print("tab:", c.send("Target.getTargetInfo", {"targetId": tid})["targetInfo"]["url"][:90])
sid = c.attach(tid)
c.send("Page.navigate", {"url": "https://www.aliexpress.com/item/1005008932937285.html"}, sid)
time.sleep(8)

print(c.eval(sid, """
(() => {
  const out = {};
  // all elements with class containing spec/property/module
  const classes = new Set();
  for (const e of document.querySelectorAll('[class]')) {
    for (const cls of String(e.className).split(' ')) {
      if (/spec|property|module|desc|review|feedback/i.test(cls)) classes.add(cls);
    }
  }
  out.classes = [...classes].slice(0, 30);
  // body text length
  out.textLen = document.body.innerText.length;
  // find "About this item" or similar
  const idx = document.body.innerText.search(/About this item|Specification/i);
  out.aboutIdx = idx;
  if (idx > 0) out.aboutText = document.body.innerText.slice(idx, idx + 800);
  return JSON.stringify(out);
})()
"""))
