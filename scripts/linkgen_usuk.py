"""Attach to an EXISTING Link Generator tab (no new tabs).
Set ship-to = USA + UK only. Then test product URLs in that same tab."""
import re
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

c = CDP()
pages = c.get_pages()
gen = [p for p in pages if "link_generator" in p.get("url", "")]
if not gen:
    print("no existing link generator tab found; open tabs:")
    for p in pages:
        print("  ", p.get("url", "")[:100])
    sys.exit(1)

tid = gen[0]["targetId"]
print("using tab:", gen[0]["url"][:90])
sid = c.attach(tid)

# navigate the SAME tab to a fresh link generator page (same tab, no new tab)
c.eval(sid, "location.href = 'https://portals.aliexpress.com/affiportals/web/link_generator.htm'")
time.sleep(8)
sid = c.attach(tid)

# open ship-to dropdown
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

# deselect all currently selected, then select US + UK only
print(c.eval(sid, """
(() => {
  const af = [...document.querySelectorAll('li.next-menu-item')].find(li =>
    (li.textContent || '').trim() === 'Afghanistan');
  if (!af) return 'no menu';
  const items = [...af.closest('ul.next-menu').querySelectorAll('li.next-menu-item')];
  let de = 0;
  for (const li of items.filter(i => i.classList.contains('next-selected'))) {
    li.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
    li.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
    li.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    de++;
  }
  let sel = [];
  for (const want of ["United States", "United Kingdom"]) {
    const li = items.find(i => i.textContent.trim() === want);
    if (!li) { sel.push(want + '(MISSING)'); continue; }
    li.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
    li.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
    li.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    sel.push(want);
  }
  return 'deselected ' + de + ', selected ' + sel.join(', ');
})()
"""))
time.sleep(1)
print("tags:", c.eval(sid, "JSON.stringify([...document.querySelectorAll('.next-tag')].map(t => t.textContent.trim()).filter(Boolean))"))
