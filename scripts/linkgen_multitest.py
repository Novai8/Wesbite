"""With 7 countries selected, try several product URLs to see which generate links."""
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

# select the 7 countries
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
c.eval(sid, """
(() => {
  const af = [...document.querySelectorAll('li.next-menu-item')].find(li =>
    (li.textContent || '').trim() === 'Afghanistan');
  const items = [...af.closest('ul.next-menu').querySelectorAll('li.next-menu-item')];
  for (const want of ["United States","United Kingdom","Australia","India","Pakistan","Canada","Germany"]) {
    const li = items.find(i => i.textContent.trim() === want);
    if (li && !li.classList.contains('next-selected')) {
      li.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
      li.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
      li.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    }
  }
})()
""")
time.sleep(1)

# switch to single tab
c.eval(sid, """
(() => {
  const tabs = [...document.querySelectorAll('*')].filter(e =>
    e.children.length === 0 && (e.textContent || '').trim() === 'Generate Link');
  tabs[0].click();
})()
""")
time.sleep(2)

TEST_IDS = [
    "1005006738297489",  # previous failure
    "1005005880484435",
    "1005007502990785",
    "3256806387599993",
    "1005009164562003",
]

for pid in TEST_IDS:
    # set value directly
    c.eval(sid, f"""
(() => {{
  const ta = document.getElementById('targetUrl');
  const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
  proto.set.call(ta, 'https://www.aliexpress.com/item/{pid}.html');
  ta.dispatchEvent(new Event('input', {{bubbles: true}}));
  return 'ok';
}})()
""")
    c.eval(sid, """
(() => {
  const btn = [...document.querySelectorAll('*')].filter(e =>
    e.children.length === 0 && /^Get Tracking Link$/.test((e.textContent || '').trim()));
  btn[0].click();
})()
""")
    time.sleep(9)
    txt = c.eval(sid, "document.body.innerText")
    link = re.search(r"https?://s\.click\.aliexpress\.com/[^\s\"']+|https?://[^\s\"']*aff[^\s\"']*",
                     txt) or re.search(r"Tracking Link:\s*\n?\s*(https?://\S+)", txt)
    err = [l.strip() for l in txt.split("\n") if "cannot" in l.lower()]
    print(f"{pid}: link={link.group(0) if link else None} err={err}")

# final page text for diagnostics
txt = c.eval(sid, "document.body.innerText")
m = re.search(r"Tracking Link:\s*\n(.*?)\nFeedback", txt, re.S)
print("final tracking area:", repr(m.group(1)[:400]) if m else "not found")
