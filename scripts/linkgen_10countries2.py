"""Deselect all, then select exactly the 10 target countries and generate a test link."""
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

TARGETS = [
    "United States", "United Kingdom", "Australia", "India", "Pakistan",
    "Canada", "China", "Germany", "Russia", "Indonesia",
]
# Russia's menu name needs checking; China may be "China" standalone. Check both.
POSSIBLE = TARGETS + ["Russian Federation", "China,"]

c = CDP()
tid = c.new_tab("https://portals.aliexpress.com/affiportals/web/link_generator.htm")
time.sleep(8)
sid = c.attach(tid)

c.eval(sid, """
(() => {
  const inp = document.getElementById('shipTos');
  inp.focus();
  for (const t of ['mousedown', 'mouseup', 'click']) {
    inp.dispatchEvent(new MouseEvent(t, {bubbles: true}));
  }
})()
""")
time.sleep(2)

# find Russia / China exact names
print(c.eval(sid, """
(() => {
  const af = [...document.querySelectorAll('li.next-menu-item')].find(li =>
    (li.textContent || '').trim() === 'Afghanistan');
  const names = [...af.closest('ul.next-menu').querySelectorAll('li.next-menu-item')]
    .map(li => li.textContent.trim());
  return JSON.stringify({russia: names.filter(n => /russ/i.test(n)),
    china: names.filter(n => /china|kong|macau|taiwan/i.test(n))});
})()
"""))
