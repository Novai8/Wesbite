"""Open the portal Link Generator and inspect its UI."""
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

c = CDP()
tid = c.new_tab("https://portals.aliexpress.com/affiportals/web/link_generator.htm")
time.sleep(8)
sid = c.attach(tid)
print("URL:", c.eval(sid, "location.href"))
text = c.eval(sid, "document.body.innerText.slice(0, 3000)")
print(text)
print("\n--- inputs/textareas ---")
js = """
(() => {
  const els = [...document.querySelectorAll('input, textarea')];
  return JSON.stringify(els.map(e => ({
    tag: e.tagName, type: e.type, placeholder: e.placeholder || '',
    name: e.name || '', id: e.id || ''
  })), null, 1);
})()
"""
print(c.eval(sid, js))
