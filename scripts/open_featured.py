"""Open the Featured Products ad-center page and dump its content."""
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

c = CDP()
tid = c.new_tab("https://portals.aliexpress.com/affiportals/web/ad_center.htm?nameId=200648#activeKey=featuredProducts")
time.sleep(8)
sid = c.attach(tid)
c.eval(sid, "1")
text = c.eval(sid, "document.body.innerText.slice(0, 4000)")
print("URL:", c.eval(sid, "location.href"))
print(text)
