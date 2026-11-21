"""Test single-mode link generation with one product URL."""
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

c = CDP()
tid = c.new_tab("https://portals.aliexpress.com/affiportals/web/link_generator.htm")
time.sleep(8)
sid = c.attach(tid)

# fill targetUrl textarea
r = c.eval(sid, """
(() => {
  const ta = document.getElementById('targetUrl');
  if (!ta) return 'no targetUrl';
  const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
  proto.set.call(ta, 'https://www.aliexpress.com/item/1005006738297489.html');
  ta.dispatchEvent(new Event('input', {bubbles: true}));
  ta.dispatchEvent(new Event('change', {bubbles: true}));
  return 'filled: ' + ta.value;
})()
""")
print("fill:", r)
time.sleep(1)

# click Get Tracking Link
r = c.eval(sid, """
(() => {
  const btn = [...document.querySelectorAll('button, a, span, div')].filter(e =>
    e.children.length === 0 && /^Get Tracking Link$/.test((e.textContent || '').trim()));
  if (!btn.length) return 'no button';
  btn[0].click();
  return 'clicked ' + btn[0].tagName;
})()
""")
print("click:", r)
time.sleep(8)

print(c.eval(sid, "document.body.innerText.slice(0, 3500)"))
