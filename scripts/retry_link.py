import json, sys, time
sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

c = CDP()
pages = c.get_pages()
tab = [p for p in pages if "aliexpress" in p.get("url", "")]
sid = c.attach(tab[0]["targetId"])

SET_URL = """(() => {
  const el = document.getElementById('targetUrl');
  if (!el) return 'NO_INPUT';
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set;
  setter.call(el, 'https://www.aliexpress.com/item/1005009760662550.html');
  el.dispatchEvent(new Event('input', {bubbles: true}));
  return 'SET';
})()"""
print(c.eval(sid, SET_URL))
time.sleep(1)
c.eval(sid, """(() => {
  const btn = [...document.querySelectorAll('*')].filter(e =>
    e.children.length === 0 && /^Get Tracking Link$/.test((e.textContent || '').trim()));
  if (btn[0]) btn[0].click();
})()""")
time.sleep(7)
GET_LINK = """(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode.textContent.trim();
    const m = t.match(/^https:\\/\\/s\\.click\\.aliexpress\\.com\\/[\\w/-]+$/);
    if (m) return m[0];
  }
  return null;
})()"""
link = c.eval(sid, GET_LINK)
err = c.eval(sid, "document.body.innerText.slice(-250).replace(/\\n/g, ' | ')")
print("LINK:", link)
print("ERR/last:", err)
if link:
    d = json.load(open("products-links-new.json", encoding="utf-8"))
    for x in d:
        if x["product_id"] == "1005009760662550":
            x["link"] = link
    json.dump(d, open("products-links-new.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("saved")
