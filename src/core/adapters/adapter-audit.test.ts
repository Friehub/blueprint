import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadCatalogFromRoot } from "../index.js";
import { loadAdapters, loadAdapter } from "./load.js";
import { validateAdapter, validateAdapterSelection } from "./validate.js";
import { loadSelection, addAdapter } from "./select.js";
import { resolveAdapters, listAdaptersByModule } from "./resolve.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const ADAPTERS_DIR = join(ROOT, "adapters");

describe("adapter system audit", () => {
  it("loads all adapters without errors", async () => {
    const { adapters, errors } = await loadAdapters(ADAPTERS_DIR);
    assert.equal(errors.length, 0, `No load errors: ${errors.join(", ")}`);
    assert.ok(adapters.length >= 82, `At least 82 adapters, got ${adapters.length}`);
  });

  it("every adapter has required fields", async () => {
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    for (const adapter of adapters) {
      assert.ok(adapter.name, `${adapter.module}/${adapter.name} has name`);
      assert.ok(adapter.module, `${adapter.name} has module`);
      assert.ok(adapter.version, `${adapter.name} has version`);
      assert.ok(adapter.implements.length > 0, `${adapter.name} implements functions`);
      assert.ok(adapter.config.required.length > 0, `${adapter.name} has required config`);
    }
  });

  it("every adapter module exists in catalog", async () => {
    const { adapters } = await loadAdapters(ADAPTERS_DIR);
    const result = await loadCatalogFromRoot(ROOT, "loose");

    for (const adapter of adapters) {
      const mod = result.value!.modules.find((m) => m.name === adapter.module);
      assert.ok(mod, `Module ${adapter.module} exists for adapter ${adapter.name}`);
    }
  });

  it("validates all adapters against their contracts", async () => {
    const { adapters } = await loadAdapters(ADAPTERS_DIR);
    const result = await loadCatalogFromRoot(ROOT, "loose");

    let totalErrors = 0;
    for (const adapter of adapters) {
      const validation = validateAdapter(adapter, result.value!);
      const errors = validation.issues.filter((i) => i.severity === "error");
      totalErrors += errors.length;
    }

    assert.equal(totalErrors, 0, `No validation errors across all adapters`);
  });

  it("lists adapters by module correctly", async () => {
    const { adapters } = await loadAdapters(ADAPTERS_DIR);
    const byModule = listAdaptersByModule(adapters);

    assert.ok(byModule.payments, "payments has adapters");
    assert.ok(byModule.payments.includes("stripe"), "payments has stripe");
    assert.ok(byModule.payments.includes("paystack"), "payments has paystack");
    assert.ok(byModule.payments.includes("adyen"), "payments has adyen");
  });

  it("adapter selection and resolution works", async () => {
    const { adapters } = await loadAdapters(ADAPTERS_DIR);
    const result = await loadCatalogFromRoot(ROOT, "loose");

    await addAdapter(ROOT, "payments", "stripe");
    await addAdapter(ROOT, "caching", "redis");

    const { selection } = await loadSelection(ROOT);
    const resolution = resolveAdapters(selection, adapters, result.value!);

    assert.equal(resolution.selected.payments, "stripe");
    assert.equal(resolution.selected.caching, "redis");
  });
});

describe("adapter coverage", () => {
  it("all 35 modules have at least one adapter", async () => {
    const { adapters } = await loadAdapters(ADAPTERS_DIR);
    const byModule = listAdaptersByModule(adapters);

    const expectedModules = [
      "payments", "billing", "subscriptions", "invoicing", "donations",
      "payouts", "chargebacks", "emails", "sms", "notifications",
      "webhooks", "caching", "storage", "search", "queues",
      "jobs", "feature_flags", "rate_limiting", "auth", "kyc",
      "analytics", "web_analytics", "fraud_detection", "error_tracking",
      "incident_management", "trace_query", "ip_intelligence", "media",
      "customer_support", "crm_leads", "projects", "tasks",
      "shipping", "taxation", "fulfillment",
    ];

    for (const module of expectedModules) {
      assert.ok(byModule[module], `${module} has adapters`);
      assert.ok(byModule[module].length >= 2, `${module} has at least 2 adapters`);
    }
  });
});
