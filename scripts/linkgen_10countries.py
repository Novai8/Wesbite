"""Deselect all, then select exactly the 10 target countries."""
import json
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

TARGETS = [
    "United States", "United Kingdom", "Australia", "India", "Pakistan",
    "Canada", "China", "Germany", "Russia", "Indonesia",
]

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

# show all menu item names matching targets (fuzzy find China/Russia variants)
print(c.eval(sid, """
(() => {
  const af = [...document.querySelectorAll('li.next-menu-item')].find(li =>
    (li.textContent || '').trim() === 'Afghanistan');
  if (!af) return 'no menu';
  const names = [...af.closest('ul.next-menu').querySelectorAll('li.next-menu-item')]
    .map(li => li.textContent.trim());
  const fuzzy = names.filter(n => /china|russia|united|india|indonesia|germany|australia|canada|pakistan/i.test(n));
  return JSON.stringify({total: names.length, fuzzy});
})()
"""))
