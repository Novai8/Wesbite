import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkFeedPermission,
  describeFeedEntries,
  feedIdFromLink,
  type PermissionProgramme,
} from "../src/lib/admitad/permissions.ts";

/**
 * Three-state permission machine.
 *
 * Live evidence modelled in `liveAliExpressProgramme()`: AliExpress WW is
 * connected, allows deeplinks, reports show_products_links=false, and still
 * advertises ten feeds including 14107. The signed URLs are never used here;
 * only feed ids are compared.
 */

function link(feedId: string, code = "test-code"): string {
  return `https://export.admitad.com/webmaster/websites/3025495/products/export_adv_products/?user=PID2611768&code=${code}&feed_id=${feedId}&format=xml`;
}

function liveAliExpressProgramme(overrides: Partial<PermissionProgramme> = {}): PermissionProgramme {
  return {
    id: 6115,
    name: "AliExpress WW",
    connection_status: "active",
    show_products_links: false,
    allow_deeplink: true,
    products_xml_link: link("14267"),
    products_csv_link: link("14267"),
    feeds_info: [
      { name: "10-25$", xml_link: link("14267"), csv_link: link("14267"), admitad_last_update: "2026-11-23 10:40:05+00:00" },
      { name: "до 10$", xml_link: link("14107"), csv_link: link("14107"), admitad_last_update: "2026-11-23 10:39:25+00:00" },
      { name: "hot products", xml_link: link("15830"), csv_link: link("15830") },
    ],
    ...overrides,
  };
}

test("allowed: show_products_links=true on an active connection", () => {
  const permission = checkFeedPermission(liveAliExpressProgramme({ show_products_links: true }));
  assert.equal(permission.state, "allowed");
  assert.equal(permission.allowed, true);
  assert.equal(permission.evidence.showProductsLinks, true);
  assert.equal(permission.evidence.connectionStatus, "active");
});

test("ambiguous: false flag plus a matching feed entry, still blocked", () => {
  const permission = checkFeedPermission(liveAliExpressProgramme());
  assert.equal(permission.state, "ambiguous");
  assert.equal(permission.allowed, false, "ambiguous must never be importable");
  assert.match(permission.reason, /show_products_links = false/);
  assert.match(permission.reason, /moderation does not indicate permission/i);
  assert.match(permission.reason, /blocked/i);
  assert.deepEqual(permission.evidence.matchingFeedIds, ["14107", "14267", "15830"]);
});

test("ambiguous when the requested feed id exists among several", () => {
  const permission = checkFeedPermission(liveAliExpressProgramme(), { feedId: "14107" });
  assert.equal(permission.state, "ambiguous");
  assert.equal(permission.evidence.requestedFeedId, "14107");
  assert.equal(permission.evidence.feedEntryCount, 1);
  assert.deepEqual(permission.evidence.matchingFeedIds, ["14107"]);
  assert.match(permission.reason, /feed 14107 exists/);
});

test("denied: false flag and the requested feed id is absent", () => {
  const permission = checkFeedPermission(liveAliExpressProgramme(), { feedId: "99999" });
  assert.equal(permission.state, "denied");
  assert.equal(permission.allowed, false);
  assert.equal(permission.evidence.requestedFeedId, "99999");
  assert.equal(permission.evidence.feedEntryCount, 0);
  assert.match(permission.reason, /99999 is not present/);
});

test("denied: false flag with no feed entries at all", () => {
  const permission = checkFeedPermission({
    id: 6115,
    name: "AliExpress WW",
    connection_status: "active",
    show_products_links: false,
  });
  assert.equal(permission.state, "denied");
  assert.equal(permission.evidence.feedEntryCount, 0);
  assert.deepEqual(permission.evidence.matchingFeedIds, []);
});

test("inactive programmes are denied before the flag is considered", () => {
  for (const status of ["pending", "declined", "suspended", "", undefined]) {
    const permission = checkFeedPermission(
      liveAliExpressProgramme({ show_products_links: true, connection_status: status }),
    );
    assert.equal(permission.state, "denied", `status ${String(status)} must be denied`);
    assert.equal(permission.allowed, false);
    assert.match(permission.reason, /cooperation status|active connection/i);
  }
});

test("a missing permission flag fails closed as denied, never ambiguous", () => {
  const programme = liveAliExpressProgramme();
  delete (programme as { show_products_links?: boolean }).show_products_links;
  const permission = checkFeedPermission(programme);
  assert.equal(permission.state, "denied");
  assert.equal(permission.allowed, false);
  assert.equal(permission.evidence.showProductsLinks, null);
  assert.match(permission.reason, /absent/);
  assert.match(permission.reason, /not consent/i);
});

test("a malformed permission flag fails closed and says it is malformed", () => {
  for (const bad of ["true", 1, {}, []]) {
    const permission = checkFeedPermission(
      liveAliExpressProgramme({ show_products_links: bad as unknown as boolean }),
    );
    assert.equal(permission.state, "denied", `flag ${JSON.stringify(bad)} must be denied`);
    assert.equal(permission.allowed, false);
    assert.equal(permission.evidence.malformedFlag, true);
    assert.match(permission.reason, /malformed/i);
  }
});

test("a disconnected programme is denied rather than throwing", () => {
  const permission = checkFeedPermission(null);
  assert.equal(permission.state, "denied");
  assert.equal(permission.allowed, false);
  assert.equal(permission.evidence.feedEntryCount, 0);
});

test("feed ids are read from signed links without retaining the link", () => {
  assert.equal(feedIdFromLink(link("14107")), "14107");
  assert.equal(feedIdFromLink("https://export.admitad.com/x?feed_id=abc"), null);
  assert.equal(feedIdFromLink("not a url"), null);
  assert.equal(feedIdFromLink(undefined), null);
});

test("feed entries are de-duplicated and carry no URLs", () => {
  const entries = describeFeedEntries(liveAliExpressProgramme());
  const ids = entries.map((entry) => entry.feedId);
  assert.deepEqual(ids.sort(), ["14107", "14267", "15830"]);
  for (const entry of entries) {
    assert.equal(JSON.stringify(entry).includes("code="), false, "signed links must not leak");
    assert.equal(JSON.stringify(entry).includes("PID"), false, "publisher id must not leak");
  }
});

test("permission evidence never contains a signed URL or code parameter", () => {
  const permission = checkFeedPermission(liveAliExpressProgramme());
  const serialised = JSON.stringify(permission);
  assert.equal(serialised.includes("code="), false);
  assert.equal(serialised.includes("export.admitad.com"), false);
  assert.equal(serialised.includes("PID2611768"), false);
});
