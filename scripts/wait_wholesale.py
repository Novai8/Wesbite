"""Wait longer for the wholesale page then inspect."""
import sys
import time

sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from cdp_research import CDP

c = CDP()
pages = c.get_pages()
tid = [p["targetId"] for p in pages if "aliexpress.com/wholesale" in p.get("url", "")][0]
sid = c.attach(tid)
for attempt in range(6):
    time.sleep(5)
    body_len = c.eval(sid, "document.body ? document.body.innerText.length : 0")
    title = c.eval(sid, "document.title")
    print(f"attempt {attempt}: title={title!r} bodyLen={body_len}")
    if body_len and body_len > 500:
        break
print("URL:", c.eval(sid, "location.href"))
text = c.eval(sid, "document.body.innerText.slice(0, 2500)")
print(text)
