"""Probe public AliExpress bestseller page in the user's Chrome."""
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

c = CDP()
tid = c.new_tab("https://www.aliexpress.com/wholesale?SearchType=wholesale&SortType=orders_desc")
time.sleep(10)
sid = c.attach(tid)
print("URL:", c.eval(sid, "location.href"))
print("TITLE:", c.eval(sid, "document.title"))
js = """
(() => {
  const cards = [...document.querySelectorAll('a[href*="/item/"]')].slice(0, 3);
  return JSON.stringify({
    currencySignals: [...document.querySelectorAll('[class*="price"], [class*="currency"]')].slice(0, 5).map(e => e.innerText.trim().slice(0, 40)),
    cardSample: cards.map(a => ({href: a.href.slice(0, 120), text: a.innerText.trim().slice(0, 150)}))
  }, null, 1);
})()
"""
print(c.eval(sid, js))
