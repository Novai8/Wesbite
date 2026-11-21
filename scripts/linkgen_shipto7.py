"""Find the country multi-select menu specifically and check for select-all."""
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
  const af = [...document.querySelectorAll('li.next-menu-item')].find(li =>
    (li.textContent || '').trim() === 'Afghanistan');
  if (!af) return 'no afghanistan';
  let menu = af.closest('ul.next-menu');
  const items = [...menu.querySelectorAll('li.next-menu-item')];
  const all = items.map(i => i.textContent.trim());
  return JSON.stringify({count: all.length,
    hasSelectAll: all.filter(t => /all|select/i.test(t)).slice(0, 5),
    first5: all.slice(0, 5),
    last5: all.slice(-5)});
})()
"""))
