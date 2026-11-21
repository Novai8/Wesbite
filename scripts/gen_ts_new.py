"""Generate the TypeScript append block for seed-products.ts."""
import json
import re

with open("products-research-new.json", encoding="utf-8") as f:
    prods = json.load(f)

CATEGORY_MAP = {
    "desk-setup": "Desk setup",
    "gaming": "Gaming",
    "storage-organisation": "Organisation",
    "study-stationery": "Stationery",
    "travel-accessories": "Travel",
    "kitchen-utility": "Kitchen",
}

SUBCATEGORY_HINTS = [
    ("laptop stand", "Laptop stands"), ("monitor", "Monitor arms"), ("desk mat", "Desk mats"),
    ("mouse pad", "Desk mats"), ("keyboard", "Keyboards"), ("desk", "Desks"),
    ("mouse", "Mice"), ("controller", "Controllers"), ("headset", "Headsets"),
    ("gamepad", "Controllers"), ("storage", "Storage"), ("organizer", "Storage"),
    ("organiser", "Storage"), ("sharpener", "Kitchen tools"), ("cup", "Drinkware"),
    ("bottle", "Drinkware"), ("water", "Drinkware"), ("tag", "Travel tags"),
    ("vacuum", "Packing"), ("packing", "Packing"), ("pen", "Pens"), ("marker", "Pens"),
    ("cable", "Cable management"), ("charger", "Charging"),
]


def subcategory_for(p):
    t = p["title"].lower()
    for kw, sub in SUBCATEGORY_HINTS:
        if kw in t:
            return sub
    return None


def ts_str(s, indent=6):
    """Emit a TS string literal, multiline arrays handled by caller."""
    return json.dumps(s, ensure_ascii=False)


def ts_multiline(items, indent=6):
    pad = " " * indent
    lines = []
    for it in items:
        lines.append(pad + ts_str(it) + ",")
    return "\n" + "\n".join(lines) + "\n" + " " * (indent - 2)


def ts_specs(specs, indent=8):
    pad = " " * indent
    lines = []
    for k, v in list(specs.items())[:6]:
        lines.append(f"{pad}{ts_str(k)}: {ts_str(v)},")
    return "\n" + "\n".join(lines) + "\n" + " " * (indent - 2)


entries = []
for p in prods:
    approved = p["approval_status"] == "approved"
    affiliate = p["affiliate_link"] or p["url"]
    specs = p["specs"] if len(p["specs"]) >= 2 else {
        "Ships from": "AliExpress",
        "Buyer rating": (f"{p['rating']} stars" if p.get("rating") else "See listing"),
        "Sold": p["orders"] or "See listing",
    }
    keywords = []
    for w in re.findall(r"[a-zA-Z]{3,}", p["title"].lower()):
        if w not in keywords and len(keywords) < 8:
            keywords.append(w)
    price = p["price_usd"]
    prev = p.get("original_price_usd")
    prev_s = f"\n    previousPrice: {prev}," if prev and prev > price else ""
    sub = subcategory_for(p)
    sub_s = f"\n    subcategory: {ts_str(sub)}," if sub else ""
    rating = p.get("rating")
    rating_s = f" ({rating} stars)" if rating else ""
    cons = p["cons"] if p["cons"] else [
        "Colour and exact variant availability vary by listing",
    ]
    pros = p["pros"] if p["pros"] else ["Popular with repeat buyers"]

    desc = p["description"]
    # ensure at least 2 sentences: append review chip if thin
    if desc.count(".") < 2:
        chips = p.get("rating_chips", [])
        if chips:
            desc = desc.rstrip(".") + f". Top buyer tag: \"{chips[0].rsplit(' (', 1)[0]}\"."

    entry = f"""  {{
    id: {ts_str(p['id'])},
    slug: {ts_str(p['slug'])},
    title: {ts_str(p['title'])},
    description:
      {ts_str(desc)},
    categorySlug: {ts_str(p['category_guess'])},{sub_s}
    imageUrls: [{ts_str(p['image'])}],
    merchant: "AliExpress",
    programSlug: "aliexpress",
    affiliateUrl: {ts_str(affiliate)},
    sourceUrl: {ts_str(p['url'])},
    price: {price},{prev_s}
    currency: "USD",
    specs: {{{ts_specs(specs)}
    }},
    pros: [{ts_multiline(pros)}],
    cons: [{ts_multiline(cons)}],
    availability: "in_stock",
    region: ["US", "GB"],
    keywords: [{ts_multiline(keywords)}],
    useCases: [{ts_multiline(p.get('use_cases') or ['everyday use'])}],
    budgetTier: {ts_str('budget' if price < 15 else ('mid' if price < 50 else 'premium'))},
    priceVerifiedAt: "{p['price_verified_at']}",
    approvalStatus: {ts_str("approved" if approved else "pending")},
    dataSource: "manual",
    createdAt: "{p['collected_at']}",
    updatedAt: "{p['price_verified_at']}",
  }},"""
    entries.append(entry)

block = "\n".join(entries)
header = """
  // ---- AliExpress hot-product research batch (2026-11-21) ----
  // 42 products researched live via the affiliate portal with prices
  // converted PKR -> USD at 276.460596 (open.er-api.com, 2026-11-21).
  // 37 have real portal tracking links (s.click.aliexpress.com) and are
  // approved; 5 could not be promoted in US/GB and keep the plain product
  // URL with approvalStatus "pending" until a valid link exists.
  // Raw data: products-research-new.json (repo root, not deployed).
"""
with open("scripts/seed-append-new.ts.txt", "w", encoding="utf-8") as f:
    f.write(header + "\n" + block + "\n")
print(f"wrote {len(entries)} TS entries to scripts/seed-append-new.ts.txt")
