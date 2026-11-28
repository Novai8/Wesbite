import type { Metadata } from "next";
import Link from "next/link";
import { CategoryShowcase } from "@/components/category-showcase";
import { getCatalogueSnapshot } from "@/lib/catalogue-server";
import { categoryTabs } from "@/lib/category-tabs";

export const metadata: Metadata = {
  title: "Categories",
  description:
    "Browse Fyndra by category: electronics, home and storage, travel and study. Every shelf holds approved products with a source price and a stated reason.",
};

type Props = {
  searchParams: Promise<{ tab?: string | string[] }>;
};

/**
 * Read the tab from the query string. A tab is selected explicitly by the
 * shopper or by a link (`?tab=home-storage`); there is no "first tab wins"
 * default, so a bare /categories lands on the tab index instead.
 */
function resolveTab(value: string | string[] | undefined) {
  const slug = Array.isArray(value) ? value[0] : value;
  return categoryTabs.find((tab) => tab.slug === slug);
}

export default async function CategoriesPage({ searchParams }: Props) {
  const params = await searchParams;
  const activeTab = resolveTab(params.tab);
  const { products, categories } = await getCatalogueSnapshot();

  const shelvesInTab = activeTab
    ? categories.filter((category) => activeTab.shelves.includes(category.slug))
    : [];
  const tabProducts = activeTab
    ? products.filter((product) => activeTab.shelves.includes(product.categorySlug))
    : [];
  const otherTabs = categoryTabs.filter((tab) => tab.slug !== activeTab?.slug);

  return (
    <main className="categories-page">
      <div className="container-page categories-head">
        <p className="eyebrow">The shelves</p>
        <h1>Choose a category.</h1>
        <p className="categories-lede">
          Six shelves, {products.length} approved records and no filler. Pick a
          shelf on its own, or start from the way you actually shop.
        </p>
      </div>

      <nav className="container-page categories-tabs" aria-label="Category tabs">
        {categoryTabs.map((tab) => (
          <Link
            key={tab.slug}
            href={`/categories?tab=${tab.slug}`}
            className="categories-tab"
            aria-current={tab.slug === activeTab?.slug ? "page" : undefined}
          >
            {tab.name}
          </Link>
        ))}
      </nav>

      {activeTab ? (
        <CategoryShowcase tab={activeTab} products={tabProducts} shelves={shelvesInTab} />
      ) : (
        <section className="container-page categories-body" aria-labelledby="categories-index">
          <h2 id="categories-index" className="categories-index-title">
            Start with what you are buying
          </h2>
          <div className="categories-index-grid">
            {categoryTabs.map((tab) => {
              const count = products.filter((product) =>
                tab.shelves.includes(product.categorySlug),
              ).length;
              return (
                <Link
                  key={tab.slug}
                  href={`/categories?tab=${tab.slug}`}
                  className="categories-index-card"
                >
                  <span className="categories-index-name">{tab.name}</span>
                  <span className="categories-index-blurb">{tab.blurb}</span>
                  <span className="categories-index-meta">{count} products</span>
                </Link>
              );
            })}
          </div>

          <h2 className="categories-index-title">Every shelf</h2>
          <ul className="categories-shelf-list">
            {categories.map((category) => {
              const count = products.filter(
                (product) => product.categorySlug === category.slug,
              ).length;
              return (
                <li key={category.slug}>
                  <Link href={`/discover?category=${category.slug}`}>
                    <span>{category.name}</span>
                    <span>{count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="container-page categories-foot">
        <Link className="quiet-link" href="/discover">
          Open the full catalogue
        </Link>
        {activeTab ? (
          <Link className="quiet-link" href="/categories">
            All categories
          </Link>
        ) : null}
        {otherTabs.map((tab) => (
          <Link key={tab.slug} className="quiet-link" href={`/categories?tab=${tab.slug}`}>
            {tab.name}
          </Link>
        ))}
      </div>
    </main>
  );
}
