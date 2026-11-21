"""Final cleanup of the research list: fix orders parse, drop dupes/junk."""
import json
import re

PATH = "products-research.json"

with open(PATH, encoding="utf-8") as f:
    prods = json.load(f)

kept, dropped = [], []
for p in prods:
    t = p["title"]
    o = p.get("orders") or ""
    # only drop orders strings missing a comma-grouped format, like "395127"
    if o and not re.match(r"^[\d,]+\+?$", o):
        dropped.append((t[:55], f"bad orders string: {o!r}"))
        continue
    if re.search(r"\b(sleeve|keychain|peptide|penicillin)\b", t, re.I):
        dropped.append((t[:55], "off-category"))
        continue
    if p["price_usd"] < 0.5:
        dropped.append((t[:55], f"price ${p['price_usd']}"))
        continue
    kept.append(p)

# dedupe by fuzzy title prefix (same product from different searches)
seen_titles = set()
final = []
for p in kept:
    key = re.sub(r"[^a-z0-9]", "", p["title"].lower())[:40]
    if key in seen_titles:
        dropped.append((p["title"][:55], "duplicate title"))
        continue
    seen_titles.add(key)
    final.append(p)

with open(PATH, "w", encoding="utf-8") as f:
    json.dump(final, f, ensure_ascii=False, indent=1)

print(f"final: {len(final)}")
for t, why in dropped:
    print(f"  DROP ({why}): {t}")
from collections import Counter
print(Counter(p["category_guess"] for p in final))
