"""Deselect all currently selected, then select the 8 available target countries."""
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

TARGETS = [
    "United States", "United Kingdom", "Australia", "India", "Pakistan",
    "Canada", "Germany", "Indonesia",
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

def click(js, wait=0.3):
    r = c.eval(sid, js)
    time.sleep(wait)
    return r

# first deselect everything that is selected
print(click("""
(() => {
  const af = [...document.querySelectorAll('li.next-menu-item')].find(li =>
    (li.textContent || '').trim() === 'Afghanistan');
  const items = [...af.closest('ul.next-menu').querySelectorAll('li.next-menu-item.next-selected')];
  for (const li of items) {
    li.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
    li.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
    li.dispatchEvent(new MouseEvent('click', {bubbles: true}));
  }
  return 'deselected ' + items.length;
})()
""", 1))

# now select the targets (deselect may have closed the menu; reopen if needed)
r = click("""
(() => {
  const af = [...document.querySelectorAll('li.next-menu-item')].find(li =>
    (li.textContent || '').trim() === 'Afghanistan');
  if (!af) return 'menu closed';
  const items = [...af.closest('ul.next-menu').querySelectorAll('li.next-menu-item')];
  const picked = [];
  for (const want of %s) {
    const li = items.find(i => i.textContent.trim() === want);
    if (li && !li.classList.contains('next-selected')) {
      li.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
      li.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
      li.dispatchEvent(new MouseEvent('click', {bubbles: true}));
      picked.push(want);
    } else if (li && li.classList.contains('next-selected')) {
      picked.push(want + '(already)');
    } else {
      picked.push(want + '(MISSING)');
    }
  }
  return 'picked: ' + picked.join(', ');
})()
""" % repr(TARGETS), 1)
print(r)

# close the menu
click("document.activeElement && document.activeElement.blur(); 'blurred'", 0.5)

# verify tags
print(c.eval(sid, """
(() => {
  const tags = [...document.querySelectorAll('.next-tag')].map(t => t.textContent.trim()).filter(Boolean);
  return JSON.stringify(tags);
})()
"""))
