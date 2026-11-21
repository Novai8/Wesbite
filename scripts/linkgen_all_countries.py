"""Select all countries — repeat clicks in batches since menu may re-render."""
import json
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

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

# click unselected items, repeat until all selected
for round_i in range(30):
    r = json.loads(c.eval(sid, """
(() => {
  const af = [...document.querySelectorAll('li.next-menu-item')].find(li =>
    (li.textContent || '').trim() === 'Afghanistan');
  if (!af) return JSON.stringify({unsel: -1});
  const menu = af.closest('ul.next-menu');
  const items = [...menu.querySelectorAll('li.next-menu-item')];
  const unsel = items.filter(li => !li.classList.contains('next-selected'));
  for (const li of unsel.slice(0, 12)) {
    li.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
    li.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
    li.dispatchEvent(new MouseEvent('click', {bubbles: true}));
  }
  return JSON.stringify({unsel: unsel.length, total: items.length});
})()
"""))
    if round_i % 5 == 0 or r["unsel"] == 0:
        print(f"round {round_i}: {r}")
    if r["unsel"] <= 0:
        break
    time.sleep(0.5)

time.sleep(1)
print(c.eval(sid, """
(() => {
  const tags = [...document.querySelectorAll('.next-tag')].map(t => t.textContent.trim()).filter(Boolean);
  return 'selected: ' + tags.length;
})()
"""))
