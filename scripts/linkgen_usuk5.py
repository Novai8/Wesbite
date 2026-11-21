"""Same tab: find where the tracking link actually lives (input value, clipboard, DOM)."""
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

c.eval(sid, """
(() => {
  const ta = document.getElementById('targetUrl');
  const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
  proto.set.call(ta, 'https://www.aliexpress.com/item/1005008932937285.html');
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
time.sleep(15)

# search all inputs for a value
print("INPUT VALUES:", c.eval(sid, """
JSON.stringify([...document.querySelectorAll('input')].map(i => ({
  name: i.name || i.id, value: i.value.slice(0, 150),
  cls: String(i.className).slice(0, 60)
})).filter(x => x.value))
"""))

# look for any text nodes with s.click or a tracker-looking URL
print("\nTEXT MATCHES:", c.eval(sid, """
(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const out = [];
  while (walker.nextNode()) {
    const t = walker.currentNode.textContent;
    if (/s\\.click|tracking|short/.test(t) && t.trim().length < 300 && t.trim()) out.push(t.trim().slice(0, 200));
  }
  return JSON.stringify(out.slice(0, 10));
})()
"""))

# the Copy button — maybe the link is in clipboard-related state. Check next-input components
print("\nCOPY AREA HTML:", c.eval(sid, """
(() => {
  const copy = [...document.querySelectorAll('*')].filter(e =>
    e.children.length === 0 && (e.textContent || '').trim() === 'Copy');
  if (!copy.length) return 'no copy btn';
  let e = copy[0];
  for (let i = 0; i < 5 && e; i++) e = e.parentElement;
  return e.outerHTML.slice(0, 1500);
})()
"""))
