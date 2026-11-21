"""Select all countries in the ship-to multi-select."""
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

print(c.eval(sid, """
(() => {
  const menu = document.querySelector('ul.next-menu');
  if (!menu) return 'no menu';
  const items = [...menu.querySelectorAll('li.next-menu-item')];
  return JSON.stringify({count: items.length,
    first12: items.slice(0, 12).map(i => i.textContent.trim())});
})()
"""))
