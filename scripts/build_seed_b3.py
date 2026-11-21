"""Build final products-research-b3.json + generate seed-products.ts entries.

Merges: research (prices/orders) + links (tracking) + details (specs/reviews).
Derives description / pros / cons FROM the scraped review text and chips,
never invented. All content traces to the scraped source.
"""
import json
import re
import unicodedata

with open("products-research-b3.json", encoding="utf-8") as f:
    prods = json.load(f)
with open("products-links-b3.json", encoding="utf-8") as f:
    links = {r["product_id"]: r for r in json.load(f)}
with open("products-details-b3.json", encoding="utf-8") as f:
    details = {d["product_id"]: d for d in json.load(f)}

# ---- helpers -----------------------------------------------------------

def clean_review(t):
    """Strip color/option prefixes and trailing noise from a review text."""
    t = re.sub(r"^(Color:[^ ]*|Capacity:[^ ]*|Size:[^ ]*|Style:[^ ]*)\s*", "", t)
    t = t.replace("+3AliExpress | Review for this item", "")
    t = t.replace("AliExpress | Review for this item", "")
    t = re.sub(r"\+\d?$", "", t)
    t = re.sub(r"Review for (this|similar) item.*$", "", t, flags=re.I)
    return t.strip()


def parse_orders(o):
    if not o:
        return 0
    o = re.sub(r"\s*sold", "", o, flags=re.I).strip()
    mult = 1000 if o.upper().endswith("K") else 1
    o = re.sub(r"[,+K+]", "", o, flags=re.I)
    return int(float(o) * mult)


# positive/negative sentiment word lists for mining review/chip text
POS_WORDS = [
    "sturdy", "excellent", "good quality", "solid", "well made", "useful",
    "comfortable", "easy to use", "works", "perfect", "great", "love",
    "recommend", "durable", "handy", "practical", "functional", "smooth",
    "bright", "sharp", "strong", "value", "cheap price", "fast delivery",
    "convenient", "compact", "lightweight", "reliable",
]
NEG_WORDS = [
    "broke", "broken", "small than expected", "smaller than expected",
    "flimsy", "cheap material", "stopped working", "not worth", "waste",
    "uncomfortable", "difficult", "fragile", "poor quality", "disappointed",
    "slow delivery", "wrong size", "does not fit", "doesn't fit", "bad smell",
]


def mine_pros_cons(detail):
    """Derive pros from chips + positive review sentences, cons from negatives."""
    pros, cons = [], []
    for chip in detail.get("chips", []):
        label = chip.rsplit(" (", 1)[0].lower()
        if any(w in label for w in NEG_WORDS) and "not " not in label:
            cons.append(label)
        elif any(w in label for w in POS_WORDS) or label not in [
            "all ratings", "reviews", "helpful"
        ]:
            pros.append(label)
    for rev in detail.get("reviews", []):
        r = clean_review(rev)
        low = r.lower()
        for sent in re.split(r"[.!?]", r):
            s = sent.strip()
            sl = s.lower()
            if len(s) < 15:
                continue
            if any(w in sl for w in NEG_WORDS) and len(cons) < 5:
                c = s if len(s) <= 110 else s[:107] + "..."
                if not any(c[:40].lower() in x for x in cons):
                    cons.append(c)
            elif any(w in sl for w in POS_WORDS) and len(pros) < 6:
                p = s if len(s) <= 110 else s[:107] + "..."
                if not any(p[:40].lower() in x for x in pros):
                    pros.append(p)
    return pros[:3], cons[:3]


def clean_specs(detail):
    """Clean the concatenated spec keys into proper key/value pairs."""
    out = {}
    for k, v in (detail.get("specs") or {}).items():
        if k.startswith("option:"):
            continue
        # fix 'MaterialAluminum alloyOrigin': 'Mainland China' style mangling
        m = re.match(r"^([A-Za-z][A-Za-z -]{2,30}?)([A-Z][a-z].*)$", k)
        if m and not v:
            out[m.group(1).strip()] = m.group(2).strip()[:60]
        elif m and v and k.endswith(m.group(2).split()[0]):
            out[m.group(1).strip()] = v[:60]
        else:
            out[k[:30]] = (v or "")[:60]
    # drop junk
    return {k: v for k, v in out.items() if len(k) > 2 and k.lower() != v.lower()}


def short_title(t):
    """Trim the raw AliExpress title to a readable display form."""
    t = re.sub(r"\s+", " ", t).strip()
    # cut filler suffixes
    t = re.split(r"\bTablelaptop\b", t)[0].strip(" -,/")
    if len(t) > 70:
        cut = t[:70]
        # break at last word boundary
        t = cut[:cut.rfind(" ")].rstrip(" ,-/") if " " in cut else cut
    return t


def make_description(p, detail):
    """2-3 sentence description grounded in scraped data."""
    title = short_title(p["title"])
    parts = []
    parts.append(title.rstrip(". ,") + ".")
    # sentence 2: strongest review signal
    clean = [clean_review(r) for r in detail.get("reviews", [])]
    clean = [c for c in clean if len(c) > 40]
    if clean:
        best = max(clean, key=len)
        sent = re.split(r"[.!?]", best)[0].strip()
        # drop option-prefix fragments like "Silver" / "Ultra" / "Ship With 24H Ships From:China MainlandExactly as described"
        sent = re.sub(r"^(Silver|Black|White|Gray|Grey|Blue|Red|Pink|Green|Ultra|Set Size:[^ ]*Ship With[^A-Z]*|Size:\d+PCS|Gem Color:[^ ]*)\s*", "", sent)
        sent = re.sub(r"^([A-Z][a-z]{1,8}):[A-Za-z0-9 -]{1,25}", "", sent)
        if len(sent) > 25 and re.search(r"[a-z]{3} [a-z]{3}", sent):
            parts.append(("Buyers report: " + sent) if len(sent) < 160 else
                         ("Buyers report: " + sent[:157] + "..."))
    # sentence 3: rating/orders fact
    if p.get("rating"):
        parts.append(f"Rated {p['rating']} stars by buyers, with {p.get('orders', 'many')} sold on AliExpress.")
    else:
        parts.append(f"{p.get('orders', 'Many')} sold on AliExpress.")
    return " ".join(parts)


def make_slug(title, pid):
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60].strip("-")
    return slug + "-" + pid[-6:]


def budget_tier(price):
    return "budget" if price < 15 else ("mid" if price < 50 else "premium")


def keywords_for(p):
    words = set()
    for w in re.findall(r"[a-zA-Z]{3,}", p["title"].lower()):
        words.add(w)
    for w in re.findall(r"[a-zA-Z]{3,}", p.get("search_query", "").lower()):
        words.add(w)
    return sorted(list(words))[:10]


def use_cases_for(p):
    m = {
        "desk-setup": ["better desk setup", "workspace upgrades"],
        "gaming": ["gaming setup", "gaming accessories"],
        "storage-organisation": ["small space storage", "room organisation"],
        "study-stationery": ["study setup", "student essentials"],
        "travel-accessories": ["travel packing", "commuting"],
        "kitchen-utility": ["kitchen upgrades", "daily kitchen fixes"],
    }
    return m.get(p["category_guess"], ["everyday use"])


# ---- merge -------------------------------------------------------------

today = "2026-11-21"
final = []
for p in prods:
    pid = p["product_id"]
    link = links.get(pid, {})
    detail = details.get(pid, {})
    has_link = bool(link.get("link")) and not link.get("blocked")
    pros, cons = mine_pros_cons(detail)
    desc = make_description(p, detail)
    specs = clean_specs(detail)

    final.append({
        # identity
        "product_id": pid,
        "id": f"aliexpress-{pid}",
        "slug": make_slug(p["title"], pid),
        "title": short_title(p["title"]),
        "description": desc,
        "category_guess": p["category_guess"],
        # sourcing
        "url": p["url"],
        "affiliate_link": link.get("link") if has_link else None,
        "link_blocked": bool(link.get("blocked")),
        "image": p.get("image", ""),
        # price
        "price_pkr": p["price_pkr"],
        "original_price_pkr": p.get("original_price_pkr"),
        "price_usd": p["price_usd"],
        "original_price_usd": p.get("original_price_usd"),
        "usd_pkr_rate": p["usd_pkr_rate"],
        # demand
        "orders": p.get("orders"),
        "orders_count": parse_orders(p.get("orders")),
        "rating": p.get("rating"),
        "discount_pct": p.get("discount_pct"),
        # content (grounded)
        "specs": specs,
        "pros": pros,
        "cons": cons,
        "reviews_used": [clean_review(r) for r in detail.get("reviews", [])][:3],
        "rating_chips": detail.get("chips", []),
        # meta
        "price_verified_at": today,
        "collected_at": p.get("collected_at", today),
        "approval_status": "approved" if has_link else "pending",
        "data_source": "browser-research",
    })

final.sort(key=lambda x: (-x["orders_count"], x["category_guess"]))

with open("products-research-b3.json", "w", encoding="utf-8") as f:
    json.dump(final, f, ensure_ascii=False, indent=1)

n_link = sum(1 for x in final if x["affiliate_link"])
from collections import Counter
print(f"final: {len(final)} products, {n_link} with tracking links, {len(final)-n_link} pending")
print(Counter(x["category_guess"] for x in final))
print(Counter(x["approval_status"] for x in final))
