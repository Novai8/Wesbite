"""Open ship-to dropdown and dump its full option list."""
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
  // dispatch mousedown/mouseup/click to trigger the dropdown
  for (const t of ['mousedown', 'mouseup', 'click']) {
    inp.dispatchEvent(new MouseEvent(t, {bubbles: true}));
  }
})()
""")
time.sleep(2)

# find any element containing "United States" that's newly visible
print(c.eval(sid, """
(() => {
  const els = [...document.querySelectorAll('li, [role=option], [class*=item], [class*=Option], [class*=Item]')]
    .filter(e => e.offsetParent !== null && /United States|Afghanistan|Pakistan/.test(e.textContent || ''));
  return JSON.stringify([...new Set(els.map(e => e.textContent.trim().replace(/\\n/g, ' ')))].slice(0, 40));
})()
"""))
