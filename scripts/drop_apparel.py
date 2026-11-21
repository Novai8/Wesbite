"""Drop the apparel product(s) that re-entered via the raw pool."""
import json
import re

PATH = "products-research.json"
with open(PATH, encoding="utf-8") as f:
    prods = json.load(f)

kept = []
for p in prods:
    blob = p["title"] + " " + p["description"]
    if re.search(r"\b(sleeve|sleeves|shirt|apparel|t-shirt|hoodie)\b", blob, re.I):
        print("DROP:", p["title"][:60])
        continue
    kept.append(p)

with open(PATH, "w", encoding="utf-8") as f:
    json.dump(kept, f, ensure_ascii=False, indent=1)
print(f"kept {len(kept)}")
