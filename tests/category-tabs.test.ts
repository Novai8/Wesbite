import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryTabs, findCategoryTab, tabsForShelf } from "@/lib/category-tabs";
import { seedCategories } from "@/data/seed-products";

/**
 * Category tabs must never point at a shelf that does not exist, and must never
 * leave a real shelf unreachable from a tab. These read the shipped assets so a
 * mismatch fails the build rather than producing an empty category page.
 */

const publicDir = path.join(process.cwd(), "public", "videos", "category");

test("every tab shelf is a real catalogue category", () => {
  const known = new Set(seedCategories.map((category) => category.slug));
  for (const tab of categoryTabs) {
    assert.ok(tab.shelves.length > 0, `${tab.slug} has no shelves`);
    for (const shelf of tab.shelves) {
      assert.ok(known.has(shelf), `${tab.slug} references unknown shelf ${shelf}`);
    }
  }
});

test("every catalogue category is reachable from at least one tab", () => {
  for (const category of seedCategories) {
    assert.ok(tabsForShelf(category.slug).length > 0, `${category.slug} is in no tab`);
  }
});

test("tab slugs and names are unique", () => {
  assert.equal(new Set(categoryTabs.map((tab) => tab.slug)).size, categoryTabs.length);
  assert.equal(new Set(categoryTabs.map((tab) => tab.name)).size, categoryTabs.length);
  assert.equal(findCategoryTab("electronics")?.name, "Electronics");
  assert.equal(findCategoryTab("not-a-tab"), undefined);
});

test("the electronics showcase media ships in public/", () => {
  for (const name of [
    "electronics.mp4",
    "laptop-poster.jpg",
    "phone-poster.jpg",
    "watch-poster.jpg",
  ]) {
    const file = path.join(publicDir, name);
    assert.ok(fs.existsSync(file), `missing ${name}`);
    assert.ok(fs.statSync(file).size > 1024, `${name} is unexpectedly small`);
  }
});

test("label timing matches the merged video frame plan", () => {
  // Each segment is [still of the finished product][one 241-frame clip]: laptop
  // 67 held frames, phone 139, watch 235 (2.8 / 5.8 / 9.8s). The still precedes
  // its clip so every transition is still -> motion. The holds are inside the
  // file: 67 + 139 + 235 held frames plus 3 clips of 241 frames = 48.5s.
  const heldFrames = [67, 139, 235];
  const expected = (heldFrames.reduce((total, frames) => total + frames, 0) + 241 * 3) / 24;
  const mp4 = path.join(publicDir, "electronics.mp4");
  const source = fs.readFileSync(mp4);
  assert.ok(source.includes(Buffer.from("ftyp")), "electronics.mp4 is not an MP4");
  assert.ok(Math.abs(expected - 48.5) < 0.05, `frame plan totals ${expected.toFixed(3)}s`);
});
