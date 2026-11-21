"""Find the dropdown container regardless of visibility checks."""
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

# walk up from an "Afghanistan" text node to its list parent
print(c.eval(sid, """
(() => {
  const els = [...document.querySelectorAll('*')].filter(e =>
    e.children.length === 0 && (e.textContent || '').trim() === 'Afghanistan');
  if (!els.length) return 'no afghanistan el';
  let e = els[0];
  const chain = [];
  for (let i = 0; i < 6 && e; i++) {
    chain.push(e.tagName + '.' + String(e.className).slice(0, 60));
    e = e.parentElement;
  }
  return JSON.stringify(chain);
})()
"""))

# check for checkboxes/select-alls in the document
print(c.eval(sid, """
JSON.stringify([...document.querySelectorAll('input[type=checkbox], [class*=check], [class*=Check], [class*=all], [class*=All]')]
  .filter(e => e.offsetParent !== null).map(e => ({
    tag: e.tagName, cls: String(e.className).slice(0, 50), txt: (e.textContent||'').trim().slice(0,40)
  })))
"""))
