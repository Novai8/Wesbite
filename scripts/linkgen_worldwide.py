"""Select ALL countries in ship-to, then generate one test link."""
import json
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

# open dropdown
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

# select every country
r = c.eval(sid, """
(() => {
  const af = [...document.querySelectorAll('li.next-menu-item')].find(li =>
    (li.textContent || '').trim() === 'Afghanistan');
  const menu = af.closest('ul.next-menu');
  const items = [...menu.querySelectorAll('li.next-menu-item')];
  let clicked = 0;
  for (const li of items) {
    if ((li.textContent || '').trim() === 'Pakistan') continue;  // already selected
    li.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
    li.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
    li.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    clicked++;
  }
  return 'clicked ' + clicked;
})()
""")
print(r)

# close dropdown by pressing Escape
c.eval(sid, "document.getElementById('shipTos').dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))")
time.sleep(1)

# check selected tags
print(c.eval(sid, """
(() => {
  const tags = [...document.querySelectorAll('.next-tag')]
    .map(t => t.textContent.trim()).filter(Boolean);
  return 'selected tags: ' + tags.length + ' -> ' + tags.slice(0, 5).join('|') + ' ... ' + tags.slice(-2).join('|');
})()
"""))
