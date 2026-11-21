"""Test single-mode link generation: switch to single tab, fill, submit."""
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

c = CDP()
tid = c.new_tab("https://portals.aliexpress.com/affiportals/web/link_generator.htm")
time.sleep(8)
sid = c.attach(tid)

r = c.eval(sid, """
(() => {
  const tabs = [...document.querySelectorAll('*')].filter(e =>
    e.children.length === 0 && (e.textContent || '').trim() === 'Generate Link');
  if (!tabs.length) return 'no single tab';
  tabs[0].click();
  return 'clicked';
})()
""")
print("tab:", r)
time.sleep(2)

r = c.eval(sid, """
(() => {
  const ta = document.getElementById('targetUrl');
  if (!ta) return 'no targetUrl';
  const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
  proto.set.call(ta, 'https://www.aliexpress.com/item/1005006738297489.html');
  ta.dispatchEvent(new Event('input', {bubbles: true}));
  ta.dispatchEvent(new Event('change', {bubbles: true}));
  return 'filled';
})()
""")
print("fill:", r)
time.sleep(1)

r = c.eval(sid, """
(() => {
  const btn = [...document.querySelectorAll('*')].filter(e =>
    e.children.length === 0 && /^Get Tracking Link$/.test((e.textContent || '').trim()));
  if (!btn.length) return 'no button';
  btn[0].click();
  return 'clicked';
})()
""")
print("click:", r)
time.sleep(10)

txt = c.eval(sid, "document.body.innerText")
import re
m = re.findall(r"https?://[^\s\"']+", txt)
print("links found in page:")
for u in m:
    print("  ", u)
