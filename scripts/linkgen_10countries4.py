"""Find Indonesia's exact name, add it, then generate a test link."""
import re
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
  const names = [...af.closest('ul.next-menu').querySelectorAll('li.next-menu-item')]
    .map(li => li.textContent.trim());
  return JSON.stringify({ind: names.filter(n => /indo/i.test(n)),
    starts_i: names.filter(n => n[0] === 'I')});
})()
"""))
