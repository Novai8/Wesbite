/**
 * Category tabs.
 *
 * A tab is a named group of the six catalogue shelves. It exists so a shopper
 * can say "I am looking at electronics" instead of scanning every category,
 * and so the 3D "Choose category" button has somewhere to go.
 *
 * Every slug listed here is a real `affiliate_categories.slug`. A tab never
 * invents a shelf, and a tab with no matching shelf is a build-time error in
 * `tests/category-tabs.test.ts`, not a silent empty page.
 */

export type CategoryTab = {
  slug: string;
  name: string;
  /** One line, written for a shopper rather than a merchandiser. */
  blurb: string;
  /** `affiliate_categories.slug` values shown under this tab, in display order. */
  shelves: string[];
};

export const categoryTabs: CategoryTab[] = [
  {
    slug: "electronics",
    name: "Electronics",
    blurb:
      "Chargers, docks, cables, speakers and the small hardware that makes the rest of your setup work.",
    shelves: ["desk-setup", "gaming"],
  },
  {
    slug: "home-storage",
    name: "Home & Storage",
    blurb:
      "Drawer dividers, cable trays, closet organisers and the things that give a cramped room back its space.",
    shelves: ["storage-organisation", "kitchen-utility"],
  },
  {
    slug: "travel-study",
    name: "Travel & Study",
    blurb:
      "Packing cubes, wallets, bottles, notebooks and pens — the kit you carry rather than plug in.",
    shelves: ["travel-accessories", "study-stationery"],
  },
];

export function findCategoryTab(slug: string | null | undefined): CategoryTab | undefined {
  if (!slug) return undefined;
  return categoryTabs.find((tab) => tab.slug === slug);
}

/** One tab per shelf, so an unknown shelf is surfaced rather than hidden. */
export function tabsForShelf(shelf: string): CategoryTab[] {
  return categoryTabs.filter((tab) => tab.shelves.includes(shelf));
}
