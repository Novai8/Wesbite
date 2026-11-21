"""Switch Link Generator to batch mode and inspect."""
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

c = CDP()
tid = c.new_tab("https://portals.aliexpress.com/affiportals/web/link_generator.htm")
time.sleep(8)
sid = c.attach(tid)

# click batch tab
r = c.eval(sid, """
(() => {
  const tabs = [...document.querySelectorAll('*')].filter(e =>
    e.children.length === 0 && /Generate Links\\(Batch\\)/.test(e.textContent || ''));
  if (!tabs.length) return 'no batch tab';
  tabs[0].click();
  return 'clicked';
})()
""")
print("click:", r)
time.sleep(2)
print(c.eval(sid, "document.body.innerText.slice(0, 2500)"))
print("\n--- inputs ---")
print(c.eval(sid, """
JSON.stringify([...document.querySelectorAll('input, textarea')].map(e => ({
  tag: e.tagName, type: e.type, name: e.name || '', id: e.id || '',
  placeholder: e.placeholder || ''
})), null, 1)
"""))
