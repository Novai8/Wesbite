"""Filter out suspicious prices and off-category products from the 50."""
import json
import re

PATH = "products-research.json"

with open(PATH, encoding="utf-8") as f:
    prods = json.load(f)

# products that don't belong in Fyndra's catalogue (electronics too complex /
# wrong category entirely)
BAD_KEYWORDS = re.compile(
    r"\b(ultra slim laptop|notebook computer|chromebook|mini pc|cpu|tablet pc|i9|intel core)\b", re.I
)
# esports sleeves are clothing, not desk gear
BAD_KEYWORDS2 = re.compile(r"\b(sleeve|shirt|apparel)\b", re.I)


def suspect_price(p):
    """Prices below $0.50 or above $400 are almost always currency/parse noise."""
    return p["price_usd"] < 0.5 or p["price_usd"] > 400


kept, dropped = [], []
for p in prods:
    t = p["title"]
    if BAD_KEYWORDS.search(t) or BAD_KEYWORDS2.search(t):
        dropped.append((t[:60], "off-category"))
        continue
    if suspect_price(p):
        dropped.append((t[:60], f"suspicious price ${p['price_usd']}"))
        continue
    kept.append(p)

with open(PATH, "w", encoding="utf-8") as f:
    json.dump(kept, f, ensure_ascii=False, indent=1)

print(f"kept {len(kept)}, dropped {len(dropped)}")
for t, why in dropped:
    print(f"  DROP ({why}): {t}")
