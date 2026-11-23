import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeConfig,
  getAdmitadConfig,
  isAdmitadConfigured,
  isAdmitadFullyConfigured,
} from "../src/lib/admitad/config.ts";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const CRED_KEYS = [
  "ADMITAD_CLIENT_ID",
  "ADMITAD_CLIENT_SECRET",
  "ADMITAD_ACCESS_TOKEN",
  "ADMITAD_WEBSITE_ID",
  "ADMITAD_CAMPAIGN_ID",
  "ADMITAD_SCOPE",
];

test("with nothing configured, status is honest and lists what is missing", () => {
  withEnv(Object.fromEntries(CRED_KEYS.map((k) => [k, undefined])), () => {
    const config = getAdmitadConfig();
    assert.equal(isAdmitadConfigured(config), false);
    assert.equal(isAdmitadFullyConfigured(config), false);

    const status = describeConfig(config);
    assert.equal(status.configured, false);
    assert.equal(status.canGenerateDeeplinks, false);
    assert.deepEqual(status.missing, [
      "ADMITAD_CLIENT_ID",
      "ADMITAD_CLIENT_SECRET",
      "ADMITAD_WEBSITE_ID",
    ]);
  });
});

test("client credentials alone are enough to authenticate", () => {
  withEnv({ ...Object.fromEntries(CRED_KEYS.map((k) => [k, undefined])), ADMITAD_CLIENT_ID: "id", ADMITAD_CLIENT_SECRET: "secret" }, () => {
    const config = getAdmitadConfig();
    assert.equal(isAdmitadConfigured(config), true);
    assert.equal(isAdmitadFullyConfigured(config), false, "deeplinks still need a website id");
    assert.deepEqual(describeConfig(config).missing, ["ADMITAD_WEBSITE_ID"]);
  });
});

test("full configuration enables deeplinks only when a campaign id exists", () => {
  const base = {
    ADMITAD_CLIENT_ID: "id",
    ADMITAD_CLIENT_SECRET: "secret",
    ADMITAD_WEBSITE_ID: "12345",
  };
  withEnv({ ...Object.fromEntries(CRED_KEYS.map((k) => [k, undefined])), ...base }, () => {
    const status = describeConfig(getAdmitadConfig());
    assert.equal(status.configured, true);
    assert.equal(status.canGenerateDeeplinks, false);
    assert.deepEqual(status.missing, [], "campaign id is not part of the credential trio");
  });
  withEnv({ ...Object.fromEntries(CRED_KEYS.map((k) => [k, undefined])), ...base, ADMITAD_CAMPAIGN_ID: "999" }, () => {
    assert.equal(describeConfig(getAdmitadConfig()).canGenerateDeeplinks, true);
  });
});

test("a static access token alone counts as configured but is flagged as such", () => {
  withEnv({ ...Object.fromEntries(CRED_KEYS.map((k) => [k, undefined])), ADMITAD_ACCESS_TOKEN: "tok" }, () => {
    const status = describeConfig(getAdmitadConfig());
    assert.equal(status.configured, true);
    assert.equal(status.usingStaticAccessToken, true);
  });
});

test("blank and whitespace-only env values are treated as unset", () => {
  withEnv({ ...Object.fromEntries(CRED_KEYS.map((k) => [k, undefined])), ADMITAD_CLIENT_ID: "   ", ADMITAD_CLIENT_SECRET: "" }, () => {
    assert.equal(isAdmitadConfigured(getAdmitadConfig()), false);
  });
});

test("scope env accepts comma or space separated values", () => {
  withEnv({ ...Object.fromEntries(CRED_KEYS.map((k) => [k, undefined])), ADMITAD_SCOPE: "advcampaigns,websites" }, () => {
    assert.equal(getAdmitadConfig().scope, "advcampaigns websites");
  });
});