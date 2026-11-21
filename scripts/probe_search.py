"""Try a real search query on AliExpress wholesale page."""
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

c = CDP()
tid = c.new_tab("https://www.aliexpress.com/w/wholesale-phone-holder.html?SortType=orders_desc")
time.sleep(12)
sid = c.attach(tid)
print("TITLE:", c.eval(sid, "document.title"))
js = """
(() => {
  const cards = [...document.querySelectorAll('a[href*="/item/"]')].slice(0, 4);
  return JSON.stringify({
    n: cards.length,
    sample: cards.map(a => ({href: a.href.slice(0, 100), text: a.innerText.trim().slice(0, 120)}))
  }, null, 1);
})()
"""
print(c.eval(sid, js))
