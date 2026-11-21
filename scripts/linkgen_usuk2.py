"""Continue in the SAME link generator tab: remove Pakistan so only US+UK remain,
then test one product URL."""
import re
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

c = CDP()
pages = c.get_pages()
gen = [p for p in pages if "link_generator" in p.get("url", "")]
tid = gen[0]["targetId"]
sid = c.attach(tid)

# remove the Pakistan tag via its close button (it was pre-selected by default)
print(c.eval(sid, """
(() => {
  const tags = [...document.querySelectorAll('.next-tag')];
  const pk = tags.find(t => t.textContent.trim() === 'Pakistan');
  if (!pk) return 'no pakistan tag';
  const close = pk.querySelector('.next-tag-close-btn, [class*=close]');
  if (!close) return 'no close btn: ' + pk.innerHTML.slice(0, 200);
  close.click();
  return 'closed';
})()
"""))
time.sleep(1)
print("tags:", c.eval(sid, "JSON.stringify([...document.querySelectorAll('.next-tag')].map(t => t.textContent.trim()).filter(Boolean))"))

# switch to single Generate Link tab if needed
c.eval(sid, """
(() => {
  const tabs = [...document.querySelectorAll('*')].filter(e =>
    e.children.length === 0 && (e.textContent || '').trim() === 'Generate Link');
  if (tabs.length) tabs[0].click();
})()
""")
time.sleep(2)

# fill + submit for the first test product
c.eval(sid, """
(() => {
  const ta = document.getElementById('targetUrl');
  const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
  proto.set.call(ta, 'https://www.aliexpress.com/item/1005006738297489.html');
  ta.dispatchEvent(new Event('input', {bubbles: true}));
})()
""")
time.sleep(1)
c.eval(sid, """
(() => {
  const btn = [...document.querySelectorAll('*')].filter(e =>
    e.children.length === 0 && /^Get Tracking Link$/.test((e.textContent || '').trim()));
  btn[0].click();
})()
""")
time.sleep(12)

txt = c.eval(sid, "document.body.innerText")
m = re.search(r"Tracking Link:\s*\n(.*?)\nFeedback", txt, re.S)
print("tracking area:", repr(m.group(1)[:500]) if m else "not found")
links = re.findall(r"https?://\S+", txt)
print("all links:", [l for l in links if "s.click" in l or "aliexpress" in l][:5])
for line in txt.split("\n"):
    if "cannot" in line.lower() or "error" in line.lower():
        print("err:", line.strip())
