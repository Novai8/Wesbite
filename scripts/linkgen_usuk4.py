"""Same tab: submit one URL, dump the full result area to see the actual response format."""
import re
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

c = CDP()
pages = c.get_pages()
gen = [p for p in pages if "link_generator" in p.get("url", "")]
tid = gen[0]["targetId"]
sid = c.attach(tid)

c.eval(sid, """
(() => {
  const ta = document.getElementById('targetUrl');
  const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
  proto.set.call(ta, 'https://www.aliexpress.com/item/1005008932937285.html');
  ta.dispatchEvent(new Event('input', {bubbles: true}));
})()
""")
time.sleep(1)
c.eval(sid, """
(() => {
  const btn = [...document.querySelectorAll('*')].filter(e =>
    e.children.length === 0 && /^Get Tracking Link$/.test((e.textContent || '').trim()));
  btn[0].click();
})()
""")
time.sleep(15)

txt = c.eval(sid, "document.body.innerText")
idx = txt.find("Page's URL")
print(txt[idx:idx+1200] if idx >= 0 else txt[-1200:])
