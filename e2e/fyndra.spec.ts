import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("static pages", () => {
  const routes = [
    "/",
    "/assistant",
    "/setup-builder",
    "/problem-solver",
    "/discover",
    "/compare",
    "/guides",
    "/guides/how-scoring-works",
    "/guides/briefing-the-assistant",
    "/guides/reading-a-recommendation",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    "/affiliate-disclosure",
  ];

  for (const route of routes) {
    test(`${route} renders without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator("main")).toBeVisible();
      await expect(page).toHaveTitle(/Fyndra/);
      expect(errors, errors.join("\n")).toEqual([]);
    });
  }

  test("404 page renders for unknown product", async ({ page }) => {
    const response = await page.goto("/products/not-a-real-product");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("main")).toContainText(/shortlist|404|catalogue/i);
  });
});

test.describe("home", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("hero and core sections render", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Fyndra"
    );
    await expect(
      page.getByRole("heading", { name: "The catalogue is the point." })
    ).toBeVisible();
  });

  test("category tiles link to discover", async ({ page }) => {
    const categoryLinks = page
      .getByRole("link", { name: /Desk|Gaming|Storage|Study|Travel|Kitchen/i });
    const first = categoryLinks.first();
    await expect(first).toBeVisible();
    const href = await first.getAttribute("href");
    expect(href).toContain("/discover");
  });

  test("featured products link to product pages", async ({ page }) => {
    const productLinks = page.locator('a[href^="/products/"]');
    expect(await productLinks.count()).toBeGreaterThan(0);
  });

  test("passes axe accessibility checks", async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("assistant wizard", () => {
  test("full flow returns deterministic recommendations", async ({ page }) => {
    await page.goto("/assistant");

    await page
      .getByLabel(/What are you trying to solve/i)
      .fill("My back hurts working at my desk all day");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel(/Budget/i).fill("150");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: /Find my products/i }).click();

    await expect(page.getByText(/Top recommendation/i)).toBeVisible();
    await expect(page.getByText(/deterministic/i)).toBeVisible();
    await expect(page.getByText(/Remaining from budget/i)).toBeVisible();
    await expect(page.getByText(/Also worth a look/i)).toBeVisible();

    const reasons = page.locator("li", { hasText: "✓" });
    expect(await reasons.count()).toBeGreaterThan(0);
  });

  test("back navigation preserves state", async ({ page }) => {
    await page.goto("/assistant");
    await page
      .getByLabel(/What are you trying to solve/i)
      .fill("Small apartment, need more storage");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "← Back" }).click();
    await expect(page.getByLabel(/What are you trying to solve/i)).toHaveValue(
      "Small apartment, need more storage"
    );
  });

  test("passes axe accessibility checks", async ({ page }) => {
    await page.goto("/assistant");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("setup builder", () => {
  test("allocates budget across categories", async ({ page }) => {
    await page.goto("/setup-builder");

    const deskChip = page.getByRole("button", { name: "Desk & Workspace" });
    const gamingChip = page.getByRole("button", { name: "Gaming" });
    await expect(deskChip).toHaveClass(/is-on/);
    await expect(gamingChip).toHaveClass(/is-on/);
    await gamingChip.click();
    await expect(gamingChip).not.toHaveClass(/is-on/);

    await page.getByLabel(/Total budget/i).fill("200");
    await page.getByRole("button", { name: /Build my setup/i }).click();

    await expect(page.getByText(/Your setup/i)).toBeVisible();
    await expect(page.getByText(/Remaining/i)).toBeVisible();
  });

  test("passes axe accessibility checks", async ({ page }) => {
    await page.goto("/setup-builder");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("problem solver", () => {
  test("problem in, recommendations out", async ({ page }) => {
    await page.goto("/problem-solver");
    await page
      .getByLabel(/What.s the problem/i)
      .fill("I keep losing small cables and adapters in my bag");
    await page.getByRole("button", { name: /Find a fix/i }).click();

    await expect(page.getByText(/The fix/i)).toBeVisible();
    await expect(page.getByText(/Other approaches/i)).toBeVisible();
  });

  test("passes axe accessibility checks", async ({ page }) => {
    await page.goto("/problem-solver");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("discover", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/discover");
  });

  test("shows products and pagination", async ({ page }) => {
    const cards = page.locator('a[href^="/products/"]');
    await expect(cards.first()).toBeVisible();
  });

  test("search filters results and empty state works", async ({ page }) => {
    const allCards = await page.locator('a[href^="/products/"]').count();
    const search = page.getByLabel(/Search/i);
    await search.fill("cable");
    await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();
    const cableCount = await page.locator('a[href^="/products/"]').count();
    expect(cableCount).toBeLessThan(allCards);

    await search.fill("zzzznonexistent");
    await expect(page.getByRole("heading", { name: /That shelf is empty/i })).toBeVisible();
    await page.getByRole("button", { name: /Clear filters/i }).click();
    await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();
  });

  test("sort by price works", async ({ page }) => {
    await page.getByLabel(/Sort/i).selectOption("price-asc");
    await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();
  });

  test("passes axe accessibility checks", async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("product page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/discover");
    await page.locator('a[href^="/products/"]').first().click();
  });

  test("shows verified specs, pros/cons and labelled affiliate link", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/Specifications/i)).toBeVisible();
    await expect(page.getByText(/What.s good/i)).toBeVisible();
    await expect(page.getByText(/Trade-offs/i)).toBeVisible();

    const affiliate = page.locator('a[href^="/api/go"]');
    await expect(affiliate).toHaveCount(1);
    await expect(affiliate).toHaveAttribute("rel", /nofollow/);
    await expect(affiliate).toHaveAttribute("rel", /sponsored/);
    await expect(affiliate).toHaveAttribute("rel", /noopener/);
    await expect(affiliate).toContainText(/Affiliate/i);
  });

  test("shows related products", async ({ page }) => {
    await expect(page.getByText(/Solves the same problem/i)).toBeVisible();
  });

  test("passes axe accessibility checks", async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("compare", () => {
  test("pick two products, table renders merged specs", async ({ page }) => {
    await page.goto("/compare");

    const search = page.getByLabel(/Add products/i);
    await search.fill("monitor");
    await page
      .getByRole("button", { name: /Monitor Arm/i })
      .first()
      .click();

    await search.fill("keyboard");
    await page
      .getByRole("button", { name: /Keyboard/i })
      .first()
      .click();

    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table).toContainText("Monitor Arm");
    await expect(table).toContainText("Keyboard");
    await expect(table).toContainText("Price");
    await expect(table).toContainText("Merchant");
  });

  test("passes axe accessibility checks", async ({ page }) => {
    await page.goto("/compare");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("api/go guard", () => {
  test("rejects missing id", async ({ request }) => {
    const response = await request.get("/api/go");
    expect(response.status()).toBe(400);
  });

  test("rejects unknown product id", async ({ request }) => {
    const response = await request.get("/api/go?id=not-a-product");
    expect(response.status()).toBe(404);
  });
});

test.describe("navigation", () => {
  test("header links navigate", async ({ page, viewport }) => {
    await page.goto("/");
    const isMobile = (viewport?.width ?? 1440) < 768;
    if (isMobile) {
      await page.getByRole("button", { name: /toggle menu/i }).click();
    }
    await page.locator("a:visible").filter({ hasText: /^Discover$/ }).first().click();
    await expect(page).toHaveURL(/\/discover/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Good things"
    );
  });

  test("skip link is first focusable element", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  });
});

test.describe("mobile menu", () => {
  const mobileViewports: Array<{ w: number; h: number }> = [
    { w: 390, h: 844 },
    { w: 375, h: 812 },
  ];

  for (const { w, h } of mobileViewports) {
    test(`menu opens and navigates at ${w}×${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      const toggle = page.getByRole("button", { name: /toggle menu/i });
      await toggle.click();
      await page.locator("a:visible").filter({ hasText: /^Find a fix$/ }).first().click();
      await expect(page).toHaveURL(/\/problem-solver/);
    });
  }
});
