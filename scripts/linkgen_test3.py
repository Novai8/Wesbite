"""With 7 countries selected, generate a test tracking link for one product."""
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

# the page may remember 7 selected tags already; verify
tags_now = c.eval(sid, """
JSON.stringify([...document.querySelectorAll('.next-tag')].map(t => t.textContent.trim()).filter(Boolean))
""")
print("tags now:", tags_now)
if "United States" not in tags_now:
    # reopen dropdown and select the 7 countries
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
  const items = [...af.closest('ul.next-menu').querySelectorAll('li.next-menu-item')];
  const picked = [];
  for (const want of ["United States","United Kingdom","Australia","India","Pakistan","Canada","Germany"]) {
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
"""))
    time.sleep(1)
    print("tags after:", c.eval(sid, "JSON.stringify([...document.querySelectorAll('.next-tag')].map(t => t.textContent.trim()).filter(Boolean))"))

# switch to single Generate Link tab
c.eval(sid, """
(() => {
  const tabs = [...document.querySelectorAll('*')].filter(e =>
    e.children.length === 0 && (e.textContent || '').trim() === 'Generate Link');
  tabs[0].click();
})()
""")
time.sleep(2)

# fill the URL
print(c.eval(sid, """
(() => {
  const ta = document.getElementById('targetUrl');
  const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
  proto.set.call(ta, 'https://www.aliexpress.com/item/1005006738297489.html');
  ta.dispatchEvent(new Event('input', {bubbles: true}));
  return 'filled: ' + ta.value;
})()
"""))
time.sleep(1)

# submit
print(c.eval(sid, """
(() => {
  const btn = [...document.querySelectorAll('*')].filter(e =>
    e.children.length === 0 && /^Get Tracking Link$/.test((e.textContent || '').trim()));
  btn[0].click();
  return 'submitted';
})()
"""))
time.sleep(12)

txt = c.eval(sid, "document.body.innerText")
links = re.findall(r"https?://[^\s\"']+", txt)
print("links:", links)
print("---error lines---")
for line in txt.split("\n"):
    if "cannot" in line.lower() or "error" in line.lower() or "fail" in line.lower():
        print(" ", line.strip())
