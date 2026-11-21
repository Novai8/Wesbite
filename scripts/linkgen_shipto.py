"""Inspect the Ship To selector options in the Link Generator."""
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

c = CDP()
tid = c.new_tab("https://portals.aliexpress.com/affiportals/web/link_generator.htm")
time.sleep(8)
sid = c.attach(tid)

# click on the shipTo input to open its dropdown
print(c.eval(sid, """
(() => {
  const inp = document.getElementById('shipTos');
  if (!inp) return 'no shipTos';
  inp.focus();
  inp.click();
  return 'clicked, value=' + JSON.stringify(inp.value);
})()
"""))
time.sleep(2)

# dump any dropdown / option list that appeared
print(c.eval(sid, """
(() => {
  const lists = [...document.querySelectorAll('ul, [class*=dropdown], [class*=popup], [class*=menu], [class*=option]')]
    .filter(e => e.offsetParent !== null && (e.innerText || '').length > 10
      && (e.innerText || '').length < 3000);
  return JSON.stringify(lists.slice(0, 6).map(e => e.innerText.slice(0, 600)));
})()
"""))
