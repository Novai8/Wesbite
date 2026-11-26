import { expect, test } from "@playwright/test";

const CART_STAGE = "[data-cart-stage]";

// The hero mounts a WebGL scene, and CI renders it through SwiftShader, where a
// frame costs hundreds of milliseconds. That is slower than the default budget.
test.describe.configure({ timeout: 120_000 });

test.describe("3D cart experience", () => {
  test("mounts exactly one transparent, click-through canvas on the home page", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    await expect(page.locator(CART_STAGE)).toHaveCount(1);
    await expect(page.locator("canvas")).toHaveCount(1);

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveCSS("pointer-events", "none");

    const box = await canvas.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(300);
    expect(box?.height ?? 0).toBeGreaterThan(300);

    expect(errors).toEqual([]);
  });

  test("does not mount the cart layer on other routes", async ({ page }) => {
    await page.goto("/discover");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Good things");
    await expect(page.locator(CART_STAGE)).toHaveCount(0);
  });

  test("follows the pointer and keeps the hero interactive", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toHaveCount(1);

    await page.mouse.move(420, 360, { steps: 8 });
    await page.waitForTimeout(400);
    await page.mouse.move(980, 560, { steps: 16 });
    await page.waitForTimeout(500);

    // Whatever the cart is doing, the element under the pointer must be page DOM.
    const hit = await page.evaluate(() => {
      const element = document.elementFromPoint(980, 560);
      return element?.tagName ?? "";
    });
    expect(hit).not.toBe("CANVAS");

    const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
    const target = isMobile
      ? page.getByRole("link", { name: /Explore the catalogue/i })
      : page.getByRole("link", { name: /Browse catalogue/i }).first();
    await target.click();
    await expect(page).toHaveURL(/\/discover/);
  });

  test("renders a non-animated cart when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await expect(page.locator(`${CART_STAGE}[data-cart-stage="static"]`)).toHaveCount(1);
    await expect(page.locator("canvas")).toHaveCount(1);

    await page.mouse.move(200, 700, { steps: 10 });
    await page.waitForTimeout(600);
    await expect(page.locator("canvas")).toHaveCount(1);
  });

  test("stays usable when WebGL is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function patched(
        this: HTMLCanvasElement,
        type: string,
        ...args: unknown[]
      ) {
        if (String(type).includes("webgl")) return null;
        return (original as (...params: unknown[]) => unknown).call(this, type, ...args);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Fyndra");
    await expect(page.locator(CART_STAGE)).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(0);

    await page.getByRole("link", { name: /Explore the catalogue/i }).click();
    await expect(page).toHaveURL(/\/discover/);
  });
});
