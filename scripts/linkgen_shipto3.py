"""Open ship-to dropdown and inspect multi-select structure (checkboxes?)."""
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

# dump HTML structure of the visible dropdown
html = c.eval(sid, """
(() => {
  const els = [...document.querySelectorAll('*')].filter(e =>
    e.offsetParent !== null && /Afghanistan/.test(e.textContent || '')
    && e.children.length > 3 && (e.textContent || '').length > 5000);
  if (!els.length) return 'no container';
  // innermost such container
  let e = els[els.length - 1];
  return e.outerHTML.slice(0, 4000);
})()
""")
print(html)
